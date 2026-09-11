export const submissionSignReasons = new Set(['submit', 'directsend', 'submitexam', 'previewSigned']);

/** Builds the standard Next-Exam PDF export result. */
export function createPdfExportResult(pdfBytes, { signed = false, signMode = null } = {}) {
    const base64pdf = btoa(Array.from(pdfBytes, byte => String.fromCharCode(byte)).join(''));
    return {
        sender: 'client',
        message: 'PDF generated',
        dataUrl: `data:application/pdf;base64,${base64pdf}`,
        base64pdf,
        status: 'success',
        signed,
        signMode,
    };
}

/** Creates the matching header for Electron and Capacitor PDF export. */
export function createPdfHeaderTemplate(servername, sectionname, submissionnumber, clientname) {
    return `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span style="float:left;">${sectionname}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:left;">&nbsp;|&nbsp;Abgabe: ${submissionnumber}</span><span style="float:right;">${clientname}</span></div>`;
}
