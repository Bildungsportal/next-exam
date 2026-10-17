import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoState = vi.hoisted(() => ({
    exammode: false,
    servername: 'math',
    clientname: 'alex',
    submissionnumber: 0,
}));
const worker = vi.hoisted(() => ({
    prop: {
        pdf: {
            internal: {
                pageSize: { getWidth: () => 595, getHeight: () => 842 },
                getNumberOfPages: () => 1,
            },
            text: vi.fn(),
            setPage: vi.fn(),
            setFont: vi.fn(),
            setFontSize: vi.fn(),
            setTextColor: vi.fn(),
            output: vi.fn(() => 'data:application/pdf;base64,JVBERi0xLjQK'),
        },
    },
    set: vi.fn(),
    from: vi.fn(),
    toContainer: vi.fn(),
    toPdf: vi.fn(),
}));
const html2pdfMock = vi.hoisted(() => vi.fn());
const signingService = vi.hoisted(() => ({ ensureSubmissionSigningIdentity: vi.fn() }));
const submissionPdfSign = vi.hoisted(() => ({
    createSubmissionSignOptions: vi.fn((name, mode) => ({ name, signMode: mode, reason: 'Next-Exam submission' })),
    signSubmissionPdf: vi.fn(async (bytes) => bytes),
}));
const countWordsAndChars = vi.hoisted(() => vi.fn(() => ({ words: 0, chars: 0 })));

vi.mock('../../stores/infoStore.js', () => ({ useInfoStore: () => infoState }));
vi.mock('../loggingBridge.js', () => ({ default: { debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('html2pdf-jspdf2', () => ({ default: html2pdfMock }));
vi.mock('./IosSubmissionSigningService.js', () => ({ default: signingService }));
vi.mock('../../../../shared/submissionPdfSign.js', () => submissionPdfSign);
vi.mock('../pdfExportClient.js', () => ({ countWordsAndChars }));
vi.mock('../../locales/locales.js', () => ({ default: { global: { t: (key) => key } } }));

import pdfService from './IosPdfService.js';

describe('IosPdfService', () => {
    beforeEach(() => {
        infoState.exammode = false;
        infoState.servername = 'math';
        infoState.clientname = 'alex';
        infoState.submissionnumber = 0;
        document.body.innerHTML = '';
        worker.prop.pdf.text.mockReset();
        worker.prop.pdf.setPage.mockReset();
        worker.prop.pdf.setFont.mockReset();
        worker.prop.pdf.setFontSize.mockReset();
        worker.prop.pdf.setTextColor.mockReset();
        worker.prop.pdf.output.mockReturnValue('data:application/pdf;base64,JVBERi0xLjQK');
        worker.set.mockReturnValue(worker);
        worker.from.mockReturnValue(worker);
        worker.toContainer.mockResolvedValue(worker);
        worker.toPdf.mockResolvedValue(worker);
        html2pdfMock.mockReturnValue(worker);
        signingService.ensureSubmissionSigningIdentity.mockReset();
        submissionPdfSign.signSubmissionPdf.mockReset();
        submissionPdfSign.signSubmissionPdf.mockImplementation(async (bytes) => bytes);
    });

    it('refuses PDF export outside exam mode', async () => {
        infoState.exammode = false;
        const result = await pdfService.getBase64PDF({}, 'print');
        expect(result).toEqual({ sender: 'client', message: 'not in exam mode', status: 'error' });
    });

    it('refuses PDF export when no source element exists', async () => {
        infoState.exammode = true;
        document.body.innerHTML = '<div id="other">no editor</div>';
        const result = await pdfService.getBase64PDF({ sourceElementId: 'editorcontent' }, 'print');
        expect(result).toEqual({ sender: 'client', message: 'no PDF content', status: 'error' });
    });

    it('generates an unsigned fullpage PDF and bumps the submission number', async () => {
        infoState.exammode = true;
        infoState.submissionnumber = 3;
        document.body.innerHTML = '<div id="editorcontent">hello</div>';

        const result = await pdfService.getBase64PDF(
            { pageMode: 'fullpage', sourceElementId: 'editorcontent', submissionnumber: 3 },
            'print',
        );

        expect(result.status).toBe('success');
        expect(result.signed).toBe(false);
        expect(result.signMode).toBeNull();
        expect(result.base64pdf).toBe('JVBERi0xLjQK');
        expect(infoState.submissionnumber).toBe(4);
        expect(worker.prop.pdf.text).toHaveBeenCalled();
        expect(submissionPdfSign.signSubmissionPdf).not.toHaveBeenCalled();
    });

    it('signs submission exports with the cached signing identity', async () => {
        infoState.exammode = true;
        infoState.submissionnumber = 1;
        document.body.innerHTML = '<div id="editorcontent">hello</div>';
        signingService.ensureSubmissionSigningIdentity.mockResolvedValue({ mode: 'bip', name: 'identity' });
        submissionPdfSign.signSubmissionPdf.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

        const result = await pdfService.getBase64PDF(
            { pageMode: 'fullpage', sourceElementId: 'editorcontent', submissionnumber: 1 },
            'submit',
        );

        expect(result.status).toBe('success');
        expect(result.signed).toBe(true);
        expect(result.signMode).toBe('bip');
        expect(result.base64pdf).toBe('AQIDBA==');
        expect(submissionPdfSign.signSubmissionPdf).toHaveBeenCalledWith(
            expect.any(Uint8Array),
            { mode: 'bip', name: 'identity' },
            { name: 'alex', signMode: 'bip', reason: 'Next-Exam submission' },
        );
    });

    it('pushes straddling text lines whole onto the next page for non-fullpage exports', async () => {
        infoState.exammode = true;
        document.body.innerHTML = '<div id="editorcontent">hello</div>';

        await pdfService.getBase64PDF({ sourceElementId: 'editorcontent', submissionnumber: 0 }, 'print');

        expect(worker.set).toHaveBeenCalledWith(expect.objectContaining({ pagebreak: { mode: 'avoid-all' } }));
    });

    it('leaves pre-laid-out fullpage exports without page breaks', async () => {
        infoState.exammode = true;
        document.body.innerHTML = '<div id="editorcontent">hello</div>';

        await pdfService.getBase64PDF({ pageMode: 'fullpage', sourceElementId: 'editorcontent', submissionnumber: 0 }, 'print');

        const setCall = worker.set.mock.calls.find(c => c[0] && c[0].margin === 0);
        expect(setCall).toBeTruthy();
        expect(setCall[0]).not.toHaveProperty('pagebreak');
    });
});
