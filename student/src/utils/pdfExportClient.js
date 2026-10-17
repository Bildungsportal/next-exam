import { examApiFetch } from 'next-exam-shared/examApiFetch.js';

/** Common getPDFbase64 args shared by editor + activesheets (each adds its exam-type extras). */
export function buildPdfInvokeArgs(vm, extra = {}) {
    return {
        landscape: false,
        servername: vm.servername,
        clientname: vm.clientname,
        submissionnumber: vm.submissionnumber,
        sectionname: vm.serverstatus?.examSections?.[vm.lockedSection]?.sectionname,
        ...extra,
    };
}

/** Posts the current PDF preview to the teacher as a submission or print job (shared by editor + activesheets). */
export async function submitPdfToTeacher(vm, printrequest = false, saveReason = 'n/a', extraPayload = {}) {
    if (!vm.currentpreviewBase64) {
        console.warn('pdfExportClient @ submitPdfToTeacher: No PDF available to send')
        vm.$swal.fire({ title: vm.$t('editor.noPdfToSend'), icon: 'error' })
        return
    }

    const endpoint = printrequest ? 'printjob' : 'submission'
    const url = `https://${vm.serverip}:${vm.serverApiPort}/server/control/${endpoint}/${vm.servername}`;
    const sr = typeof saveReason === 'string' ? saveReason : 'n/a'
    const payload = {
        document: vm.currentpreviewBase64,
        printrequest: printrequest,
        submissionnumber: vm.submissionnumber,
        lockedsection: vm.lockedSection,
        saveReason: sr,
        ...extraPayload,
    }

    try {
        const response = await examApiFetch(url, {
            method: "POST",
            cache: "no-store",
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${vm.token}`},
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.message == "success") {
            if (!printrequest) { vm.submissionnumber++ }
            let message = vm.$t("editor.saved")
            if (printrequest) { message = vm.$t("editor.requestsent") }
            vm.$swal.fire({
                title: message,
                icon: "info",
            })
        }
        else {
            // teacher auth codes → readable text (notavailable = exam instance gone, authrequired = no token, removed = not in student list)
            const authTexts = {
                notavailable: 'editor.submissionTeacherUnavailable',
                authrequired: 'editor.submissionAuthRequired',
                removed: 'editor.submissionRemoved',
            }
            vm.$swal.fire({
                title: authTexts[data.message] ? vm.$t(authTexts[data.message]) : data.message,
                icon: "error",
            })
        }
    } catch (error) {
        console.log("pdfExportClient @ submitPdfToTeacher:", error.message)
        vm.$swal.fire({ title: vm.$t('editor.submissionNetworkFailed'), icon: 'error' })
    }
}

/** Word/character counts matching the editor's section counter (statsRule badges). */
export function countWordsAndChars(text) {
    const normalized = text.replace(/\r\n/g, '\n');
    const words = normalized.trim() ? normalized.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = normalized.replace(/\s/g, '').length;
    return { chars, words };
}