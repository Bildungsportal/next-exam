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

/** Page-number footer template as rendered by Electron for non-signing exports. */
export function createPdfFooterTemplate() {
    return "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>";
}

/** Current date/time as shown in the PDF header (dd.MM.yyyy HH:mm). */
export function formatPdfHeaderDate(date = new Date()) {
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Plain-text header parts for PDF engines without HTML header templates (jsPDF / Capacitor).
 * Mirrors createPdfHeaderTemplate: left block = servername | sectionname | date | Abgabe: N,
 * right block = clientname (rendered right-aligned on the page).
 */
export function createPdfHeaderText(servername, sectionname, submissionnumber, clientname, dateStr = formatPdfHeaderDate()) {
    return {
        left: `${servername} | ${sectionname} | ${dateStr} | Abgabe: ${submissionnumber}`,
        right: clientname,
    };
}

/** Page-number footer as shown by Electron for non-signing exports (pageNumber|totalPages). */
export function createPdfFooterText(pageNumber, totalPages) {
    return `${pageNumber}|${totalPages}`;
}

/** Top margin (inches) of the non-fullpage iOS editor PDF export; keeps the header clear of the first text line. */
export const IOS_EDITOR_PDF_TOP_MARGIN = 0.5;
/** Bottom margin (inches) of the non-fullpage iOS editor PDF export; keeps the footer clear of the last text line. */
export const IOS_EDITOR_PDF_BOTTOM_MARGIN = 0.5;
/** Header text baseline distance from the page top (inches) of the non-fullpage iOS editor PDF export. */
export const IOS_EDITOR_PDF_HEADER_INSET = 0.2;
/** Footer text baseline distance from the page bottom (inches) of the non-fullpage iOS editor PDF export. */
export const IOS_EDITOR_PDF_FOOTER_INSET = 0.2;

/**
 * Vertical space (inches) between the header glyphs and the first text line for the
 * non-fullpage iOS editor PDF export (content top = top margin, header glyph bottom =
 * header inset + glyph height).
 */
export function iosEditorPdfHeaderSpace(topMargin = IOS_EDITOR_PDF_TOP_MARGIN, headerInset = IOS_EDITOR_PDF_HEADER_INSET, headerFontSizePt = 10) {
    return topMargin - headerInset - headerFontSizePt / 72;
}

/**
 * Vertical space (inches) between the last text line and the footer glyphs for the
 * non-fullpage iOS editor PDF export (content bottom = page bottom - bottom margin,
 * footer glyph top = page bottom - inset - glyph height).
 */
export function iosEditorPdfFooterSpace(bottomMargin = IOS_EDITOR_PDF_BOTTOM_MARGIN, footerInset = IOS_EDITOR_PDF_FOOTER_INSET, footerFontSizePt = 10) {
    return bottomMargin - footerInset - footerFontSizePt / 72;
}
