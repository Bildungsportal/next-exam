// @vitest-environment jsdom
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

    const cloneMarkup = `<div id="editorcontent">hi</div>
        <div class="html2pdf__container"><div class="pdf-overlay-root" style="height:900px">
            <ul class="pdf-annotation-toolbar"></ul>
            <div class="pdf-scroll-container" style="padding:20px;background-color:#eee">
                <div class="pdf-page-wrapper" style="margin-bottom:20px">
                    <div class="input-overlay"><input type="checkbox" id="c1" class="interactive-input checkbox" checked></div>
                </div>
                <div class="pdf-page-wrapper" style="margin-bottom:20px">
                    <div class="input-overlay"><input type="checkbox" id="c2" class="interactive-input checkbox deselect-checkbox" checked></div>
                </div>
            </div>
        </div></div>`;
    const getOnclone = () => worker.set.mock.calls[worker.set.mock.calls.length - 1][0].html2canvas.onclone;

    it('rebuilds checkboxes and applies the 8/9 print scale on the fullpage clone', async () => {
        infoState.exammode = true;
        document.body.innerHTML = cloneMarkup;

        await pdfService.getBase64PDF({ pageMode: 'fullpage', sourceElementId: 'editorcontent', submissionnumber: 0 }, 'print');
        const overlay = document.querySelector('.pdf-overlay-root') as HTMLElement;
        // jsdom does no layout (offsetWidth/offsetHeight are always 0) — stub the laid-out geometry.
        Object.defineProperty(overlay, 'offsetWidth', { value: 794, configurable: true });
        Object.defineProperty(overlay, 'offsetHeight', { value: 900, configurable: true });
        getOnclone()(document, document.querySelector('.html2pdf__container'));

        expect(document.querySelector('input#c1')).toBeNull();
        expect(document.querySelector('input#c2')).toBeNull();
        const check = document.querySelector('span#c1') as HTMLElement;
        expect(check.style.backgroundColor).toContain('253');
        expect(check.style.backgroundImage).toContain("viewBox='0 0 16 16'");
        const slash = document.querySelector('span#c2') as HTMLElement;
        expect(slash.style.backgroundImage).toContain("viewBox='0 0 100 100'");
        expect(overlay.style.transform).toBe(`scale(${8 / 9})`);
        expect(overlay.style.transformOrigin).toBe('50% 0%');
        const container = document.querySelector('.html2pdf__container') as HTMLElement;
        // 794px wide, 900*8/9 tall → one whole A4 page: floor(794*2*297/210)/2 = 1122px
        expect(container.style.height).toBe('1122px');
        expect(container.style.overflow).toBe('hidden');
        const scroller = document.querySelector('.pdf-scroll-container') as HTMLElement;
        expect(scroller.style.padding).toBe('0px');
        expect(scroller.style.backgroundColor).toBe('rgb(255, 255, 255)');
        const wrappers = document.querySelectorAll('.pdf-page-wrapper');
        wrappers.forEach((w) => expect((w as HTMLElement).style.marginBottom).toBe('0px'));
        expect((document.querySelector('.pdf-annotation-toolbar') as HTMLElement).style.display).toBe('none');
    });

    it('does not apply the 8/9 print scale on the non-fullpage clone', async () => {
        infoState.exammode = true;
        document.body.innerHTML = cloneMarkup;

        await pdfService.getBase64PDF({ sourceElementId: 'editorcontent', submissionnumber: 0 }, 'print');
        expect(() => getOnclone()(document, document.querySelector('.html2pdf__container'))).not.toThrow();

        expect((document.querySelector('.pdf-overlay-root') as HTMLElement).style.transform).toBe('');
    });
});
