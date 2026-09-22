import { describe, expect, it } from 'vitest';
import { createPdfExportResult, createPdfHeaderTemplate, submissionSignReasons } from '../../../shared/pdfExportShared.js';

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
