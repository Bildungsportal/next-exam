import { Agent } from 'undici'
import { createHash } from 'crypto'
import { buildAppSecretHeaders } from '../../../../shared/nextExamApiSecret.js'
import multicastClient from './multicastclient.js'

// One dispatcher per host+fingerprint; a changed pin invalidates the entry so TLS is renegotiated.
const dispatchers = new Map()

/** undici dispatcher that trusts exactly the pinned Teacher leaf certificate. */
function pinnedDispatcher(hostname, { fingerprint, pem }) {
    const cached = dispatchers.get(hostname)
    if (cached?.fingerprint === fingerprint) return cached.dispatcher
    cached?.dispatcher.close().catch(() => {})
    const dispatcher = new Agent({
        connect: {
            // Pinning the leaf as the only trust anchor: it is self-signed with CA:FALSE, so this
            // accepts exactly this certificate and nothing else.
            ca: pem,
            rejectUnauthorized: true,
            // The Teacher only adds an IP SAN when it knew its host IP at startup; fall back to the
            // always-present localhost SAN and compare the fingerprint instead of the hostname.
            servername: 'localhost',
            checkServerIdentity: (_host, cert) => {
                const actual = createHash('sha256').update(cert.raw).digest('hex')
                return actual === fingerprint ? undefined : new Error('Teacher certificate fingerprint mismatch')
            },
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
