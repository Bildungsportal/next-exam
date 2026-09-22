import { describe, expect, it } from 'vitest'
import { isCertificateError } from './examApiFetch.js'

const withCause = (msg, causeMsg, code) => {
    const e = new TypeError(msg)
    e.cause = Object.assign(new Error(causeMsg), code ? { code } : {})
    return e
}

describe('isCertificateError', () => {
    it('detects the failure shapes measured against the real Teacher server', () => {
        // pinned fetch, fingerprint does not match
        expect(isCertificateError(withCause('fetch failed', 'Teacher certificate fingerprint mismatch'))).toBe(true)
        // stale PEM -> chain validation fails before checkServerIdentity
        expect(isCertificateError(withCause('fetch failed', 'self-signed certificate', 'DEPTH_ZERO_SELF_SIGNED_CERT'))).toBe(true)
        // examApiFetch refuses to send anything when no certificate is pinned
        expect(isCertificateError(new Error('net::ERR_CERT_AUTHORITY_INVALID (no pinned certificate for 10.0.0.100)'))).toBe(true)
    })

    it('leaves ordinary network errors on the normal retry path', () => {
        expect(isCertificateError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe(false)
        expect(isCertificateError(withCause('fetch failed', 'connect ECONNREFUSED 10.0.0.100:22422', 'ECONNREFUSED'))).toBe(false)
        expect(isCertificateError(new Error('The request timed out'))).toBe(false)
        expect(isCertificateError(undefined)).toBe(false)
    })
})
