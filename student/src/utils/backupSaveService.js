/**
 * Shared "save backup copy" orchestration for editor + activesheets on electron + iOS.
 * The platform-specific file operations are injected via `io`; only their order and the
 * after-PDF file-list refresh are shared:
 *   1. write HTML backup (electron: ipcRenderer.send('storeHTML'|'saveActivesheetsBak');
 *      iOS: iosUpdateListener.storeHTML)
 *   2. generate + write PDF (electron: 'printpdf' IPC / getPDFbase64+printpdf;
 *      iOS: getBase64PDF + iosUpdateListener.storePDF)
 *   3. refresh the file list AFTER the PDF exists (electron editor: main process replies
 *      'loadfilelist'; iOS + activesheets: explicit loadFilelist())
 */
export async function storeBackupCopyWithPdf({ filename, editorContent, why, io }) {
    // 1. HTML backup — the adapter surfaces its own errors (fileerror/error) and resolves
    //    { ok: true } so the flow continues — both platforms proceed to the PDF step after an
    //    HTML write failure, mirroring the electron storeHTML → printpdf flow.
    await io.writeHtml({ filename, editorContent, why });
    // 2. PDF — adapter returns { ok: true } or { ok: false, error }.
    const pdfResult = await io.writePdf({ filename, why });
    if (!pdfResult?.ok) {
        io.onPdfError?.(pdfResult, why);
        return false;
    }
    // 3. File list refresh after the PDF exists.
    await io.reloadFileList?.();
    return true;
}
