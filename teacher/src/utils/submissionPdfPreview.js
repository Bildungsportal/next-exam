import { Buffer } from 'buffer'
import { swalQueued } from './swalQueue.js'

/** Shows integrity result swal after verifySubmissionPdfIntegrity IPC. */
async function showIntegrityResultSwal(vm, integrity) {
    if (integrity?.ok) {
        const warnKey = integrity.signMode === 'local'
            ? 'dashboard.signedPdfIntegrityOkLocalWarn'
            : 'dashboard.signedPdfIntegrityOkNoBipCheck'
        await swalQueued({
            icon: 'success',
            title: vm.$t('dashboard.signedPdfIntegrityOkTitle'),
            text: vm.$t(warnKey),
        })
        return
    }
    await swalQueued({
        icon: 'error',
        title: vm.$t('dashboard.signedPdfValidateFailIntegrity'),
        text: integrity?.verifyError || '',
    })
}

/** Runs BiP issuer verification and shows result swal. */
async function runIssuerVerificationSwal(vm, pdfBase64) {
    const result = await window.ipcRenderer.invoke('verifySubmissionPdfViaBip', {
        pdfBase64,
        biptest: !!vm.biptest,
    })
    if (result?.ok) {
        await swalQueued({
            icon: 'success',
            title: vm.$t('dashboard.signedPdfValidateBipOk'),
        })
        return
    }
    const keyByCode = {
        INTEGRITY_FAIL: 'dashboard.signedPdfValidateFailIntegrity',
        NOT_BIP_SIGNED: 'dashboard.signedPdfValidateNotBipSigned',
        BIP_IDENTITY_MISMATCH: 'dashboard.signedPdfValidateBipMismatch',
        BIP_TOKEN_INVALID: 'dashboard.signedPdfValidateBipError',
        BIP_SECRET_MISSING: 'dashboard.signedPdfValidateBipError',
        BIP_AUTH_CANCELLED: 'dashboard.signedPdfValidateBipCancelled',
        BIP_AUTH_PENDING: 'dashboard.signedPdfValidateBipPending',
        BIP_LOGIN_TIMEOUT: 'dashboard.signedPdfValidateBipTimeout',
        NO_SIGNATURE: 'dashboard.signedPdfValidateFailIntegrity',
    }
    const i18nKey = keyByCode[result?.code] || 'dashboard.signedPdfValidateBipError'
    await swalQueued({
        icon: 'error',
        title: vm.$t(i18nKey),
        text: keyByCode[result?.code] ? '' : (result?.verifyError || ''),
    })
}

/** Swal + IPC: open as-is, BiP issuer check, or integrity-only check for signed PDFs. */
export async function maybePromptVerifySignedSubmissionPdf(vm, pdfBytes) {
    const buf = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
    const pdfBase64 = Buffer.from(buf).toString('base64')
    const probe = await window.ipcRenderer.invoke('submissionPdfHasSignature', { pdfBase64 })
    if (!probe?.hasSignature) {
        return
    }

    const ask = await swalQueued({
        title: vm.$t('dashboard.signedPdfValidateTitle'),
        text: vm.$t('dashboard.signedPdfValidateBipPrompt'),
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        cancelButtonText: vm.$t('dashboard.signedPdfValidateOpen'),
        denyButtonText: vm.$t('dashboard.signedPdfValidateIssuer'),
        confirmButtonText: vm.$t('dashboard.signedPdfValidateIntegrity'),
        cancelButtonColor: '#0d9488',
        denyButtonColor: '#0aa2c0',
        confirmButtonColor: '#0aa2c0',
        focusCancel: true,
        focusDeny: false,
        focusConfirm: false,
        customClass: { actions: 'my-swal2-actions', cancelButton: 'nx-swal-open-default' },
        didOpen: () => {
            const openBtn = document.querySelector('.swal2-actions .swal2-cancel')
            openBtn?.focus()
        },
    })

    if (ask.isConfirmed) {
        const integrity = await window.ipcRenderer.invoke('verifySubmissionPdfIntegrity', { pdfBase64 })
        await showIntegrityResultSwal(vm, integrity)
        return
    }

    if (ask.isDenied) {
        await runIssuerVerificationSwal(vm, pdfBase64)
    }
}
