import { beforeEach, describe, expect, it } from 'vitest'
import multicastClient from './multicastclient.js'

const first = '11'.repeat(32)
const second = '22'.repeat(32)

describe('Teacher certificate TOFU', () => {
    beforeEach(() => {
        multicastClient.teacherCertificateHosts.clear()
        multicastClient.teacherCertificateFingerprints.clear()
        multicastClient.pendingTeacherCertificateFingerprints.clear()
        multicastClient.teacherCertificatePems.clear()
        multicastClient.onTeacherCertificateAccepted = null
    })

    it('pins first use and requires confirmation before replacing a changed fingerprint', () => {
        expect(multicastClient.observeTeacherCertificate('192.0.2.1', first).status).toBe('trusted')
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', first)).toBe(true)

        multicastClient.allowTeacherCertificateHost('192.0.2.1', second)
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', first)).toBe(true)
        expect(multicastClient.observeTeacherCertificate('192.0.2.1', second).status).toBe('fingerprint-changed')
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', second)).toBe(false)
        expect(multicastClient.pinTeacherCertificate('192.0.2.1', second)).toBe(true)
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', second)).toBe(true)
    })

    it('pins the certificate served now when the Teacher restarted during the dialog', () => {
        const third = '33'.repeat(32)
        multicastClient.observeTeacherCertificate('192.0.2.1', first)
        expect(multicastClient.observeTeacherCertificate('192.0.2.1', second).status).toBe('fingerprint-changed')

        // Teacher restarted again before the user confirmed: accept re-reads and pins `third`
        expect(multicastClient.pinTeacherCertificate('192.0.2.1', third)).toBe(true)
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', third)).toBe(true)
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', second)).toBe(false)
    })

    it('drops a stale PEM whenever the pinned fingerprint changes', () => {
        const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n'
        multicastClient.observeTeacherCertificate('192.0.2.1', first)
        multicastClient.setTeacherCertificatePem('192.0.2.1', pem)
        expect(multicastClient.getPinnedTeacherCertificate('192.0.2.1')).toEqual({ fingerprint: first, pem })

        // accepting a new certificate must not leave the previous PEM behind
        multicastClient.pinTeacherCertificate('192.0.2.1', second)
        expect(multicastClient.getPinnedTeacherCertificate('192.0.2.1')).toBe(null)
    })

    it('has no pinned certificate until a PEM was captured by the probe', () => {
        multicastClient.observeTeacherCertificate('192.0.2.1', first)
        expect(multicastClient.getPinnedTeacherCertificate('192.0.2.1')).toBe(null)
    })

    it('never leaves a host unpinned', () => {
        multicastClient.observeTeacherCertificate('192.0.2.1', first)
        expect(multicastClient.pinTeacherCertificate('192.0.2.1', null)).toBe(false)
        // failed probe must not drop the existing pin
        expect(multicastClient.isTeacherCertificateAllowed('192.0.2.1', first)).toBe(true)
    })
})
