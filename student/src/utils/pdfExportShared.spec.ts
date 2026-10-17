import { describe, expect, it } from 'vitest';
import { createPdfExportResult, createPdfHeaderTemplate, submissionSignReasons, IOS_EDITOR_PDF_TOP_MARGIN, IOS_EDITOR_PDF_BOTTOM_MARGIN, IOS_EDITOR_PDF_HEADER_INSET, IOS_EDITOR_PDF_FOOTER_INSET, iosEditorPdfHeaderSpace, iosEditorPdfFooterSpace } from '../../../shared/pdfExportShared.js';

describe('pdf export helpers', () => {
    it('encodes PDF bytes in the standard export result', () => {
        expect(createPdfExportResult(new Uint8Array([1, 2, 3]))).toMatchObject({
            dataUrl: 'data:application/pdf;base64,AQID',
            base64pdf: 'AQID',
            status: 'success',
            signed: false,
        });
    });

    it('formats submission metadata in the PDF header', () => {
        expect(createPdfHeaderTemplate('math', 'section 1', 2, 'Alex')).toContain('math');
        expect(createPdfHeaderTemplate('math', 'section 1', 2, 'Alex')).toContain('Abgabe: 2');
    });

    it('only signs submission export reasons', () => {
        expect(submissionSignReasons.has('previewSigned')).toBe(true);
        expect(submissionSignReasons.has('print')).toBe(false);
    });
});

describe('iOS editor PDF header/footer spacing', () => {
    it('leaves clear space between the last text line and the footer', () => {
        const space = iosEditorPdfFooterSpace();
        expect(space).toBeGreaterThan(0);
        // The 10pt footer glyphs (~0.14in) must sit fully below the text area with a visible gap.
        expect(space).toBeGreaterThanOrEqual(0.15);
    });

    it('leaves clear space between the header and the first text line', () => {
        const space = iosEditorPdfHeaderSpace();
        expect(space).toBeGreaterThan(0);
        // The 10pt header glyphs (~0.14in) must sit fully above the text area with a visible gap.
        expect(space).toBeGreaterThanOrEqual(0.15);
    });

    it('reduces the writable area so header and footer fit inside the margins', () => {
        // Content box = top margin .. (page height - bottom margin) on A4 portrait (inches).
        const textTop = IOS_EDITOR_PDF_TOP_MARGIN;
        const textBottom = 11.69 - IOS_EDITOR_PDF_BOTTOM_MARGIN;
        expect(IOS_EDITOR_PDF_HEADER_INSET).toBeLessThan(textTop);
        expect(IOS_EDITOR_PDF_FOOTER_INSET).toBeLessThan(11.69 - textBottom);
    });
});
