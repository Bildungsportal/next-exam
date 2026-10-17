import { Agent } from 'undici'
import { createHash } from 'crypto'
import tls from 'tls'
import { buildAppSecretHeaders } from '../../../../shared/nextExamApiSecret.js'
import multicastClient from './multicastclient.js'

// One dispatcher per host+fingerprint; a changed pin invalidates the entry so TLS is renegotiated.
const dispatchers = new Map()

/** undici dispatcher that trusts exactly the pinned Teacher leaf (fingerprint pin; no CA path). */
function pinnedDispatcher(hostname, { fingerprint }) {
    const cached = dispatchers.get(hostname)
    if (cached?.fingerprint === fingerprint) return cached.dispatcher
    cached?.dispatcher.close().catch(() => {})
    // Leaf-as-ca breaks on some Windows OpenSSL builds; pin by fingerprint after insecure handshake.
    const dispatcher = new Agent({
        connect(opts, callback) {
            const socket = tls.connect({
                host: opts.hostname || opts.host,
                port: Number(opts.port),
                servername: 'localhost',
                rejectUnauthorized: false,
                ALPNProtocols: ['http/1.1'],
            }, () => {
                const raw = socket.getPeerCertificate()?.raw
                const actual = raw ? createHash('sha256').update(raw).digest('hex') : ''
                if (actual !== fingerprint) {
                    socket.destroy()
                    callback(new Error('Teacher certificate fingerprint mismatch'))
                    return
                }
                callback(null, socket)
            })
            socket.once('error', callback)
        },
    })
    dispatchers.set(hostname, { fingerprint, dispatcher })
    return dispatcher
}

/**
 * True for TLS/certificate rejections. Node fetch reports them as "fetch failed" and keeps the real
 * reason in error.cause, while Chromium puts net::ERR_CERT_* directly into the message.
 */
export function isCertificateError(error) {
    const cause = error?.cause
    const text = `${error?.message || error} ${cause?.message || ''}`
    return text.includes('ERR_CERT')
        || text.includes('fingerprint mismatch')
        || String(cause?.code || '').includes('CERT')
}

/** Drop pooled connections so the next request performs a fresh handshake against the current pin. */
export function resetExamApiConnections() {
    for (const { dispatcher } of dispatchers.values()) { dispatcher.close().catch(() => {}) }
    dispatchers.clear()
}

/** Fetch Teacher API over Node TLS, validating the leaf against the pinned certificate. */
export async function examApiFetch(input, init = {}) {
    const headers = new Headers(init.headers ?? undefined)
    const auth = await buildAppSecretHeaders()
    for (const [key, value] of Object.entries(auth)) headers.set(key, value)

    const hostname = new URL(typeof input === 'string' ? input : input.url).hostname.toLowerCase()
    const pinned = multicastClient.getPinnedTeacherCertificate(hostname)
    if (!pinned) throw new Error(`net::ERR_CERT_AUTHORITY_INVALID (no pinned certificate for ${hostname})`)

    return fetch(input, { ...init, headers, dispatcher: pinnedDispatcher(hostname, pinned) })
}
