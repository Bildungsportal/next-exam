import loggingBridge from "../loggingBridge.js";
import {useInfoStore} from "../../stores/infoStore.js";
import html2pdf from "html2pdf-jspdf2";
import { createPdfExportResult, createPdfFooterText, createPdfHeaderText, formatPdfHeaderDate, submissionSignReasons, IOS_EDITOR_PDF_TOP_MARGIN, IOS_EDITOR_PDF_BOTTOM_MARGIN, IOS_EDITOR_PDF_HEADER_INSET, IOS_EDITOR_PDF_FOOTER_INSET } from "../../../../shared/pdfExportShared.js";
import { createSubmissionSignOptions, signSubmissionPdf } from "../../../../shared/submissionPdfSign.js";
import { countWordsAndChars } from "../pdfExportClient.js";
import i18n from "../../locales/locales.js";
import signingService from "./IosSubmissionSigningService.js";
const {t} = i18n.global

/**
 * Generates the editor/activesheets PDF on iOS (html2pdf + jsPDF), adds the
 * Electron-equivalent header/footer and signs the result for submissions.
 */
class IosPdfService {
    get infoStore() {
        return useInfoStore();
    }

    /** Generates and optionally signs a PDF from the current Capacitor document. */
    async getBase64PDF(args: any, reason: string) {
        if (!this.infoStore.exammode) {
            return { sender: 'client', message: 'not in exam mode', status: 'error' };
        }
        try {
            const source = document.getElementById(args.sourceElementId || 'editorcontent');
            if (!source) return { sender: 'client', message: 'no PDF content', status: 'error' };

            const isFullpage = args.pageMode === 'fullpage';
            const isSigningExport = submissionSignReasons.has(reason);
            const worker = html2pdf()
                .set({
                    margin: isFullpage ? 0 : [IOS_EDITOR_PDF_TOP_MARGIN, 0, IOS_EDITOR_PDF_BOTTOM_MARGIN, 0],
                    html2canvas: { backgroundColor: '#ffffff', scale: 2 },
                    jsPDF: { format: 'a4', orientation: 'portrait', unit: 'in' },
                    // Fixed-height canvas slicing splits text lines across pages; push any straddling
                    // element whole onto the next page instead (not for fullpage/activesheets: pages are pre-laid-out).
                    ...(isFullpage ? {} : { pagebreak: { mode: 'avoid-all' } }),
                })
                .from(source);
            let documentTotal: { words: number; chars: number } = { words: 0, chars: 0 };
            if (!isFullpage) {
                await worker.toContainer();
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const container = document.querySelector('.html2pdf__container');
                if (container) {
                    documentTotal = countWordsAndChars(this.collectDocumentText(container));
                }
                const sectionMarkers: { top: number; words: number; chars: number }[] = [];
                const sectionTail = this.collectSectionMarkers(sectionMarkers);
                if (sectionMarkers.length > 0) {
                    this.appendTrailingSectionMarker(sectionTail);
                }
            }
            await worker.toPdf();
            this.addPdfHeaderFooter(worker.prop.pdf, args, isFullpage, documentTotal);
            const dataUrl = worker.prop.pdf.output('datauristring');
            const pdfBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), byte => byte.charCodeAt(0));
            const signing = isSigningExport;
            const identity = signing ? await signingService.ensureSubmissionSigningIdentity() : null;
            const signedPdf = identity
                ? await signSubmissionPdf(pdfBytes, identity, createSubmissionSignOptions(this.infoStore.clientname, identity.mode))
                : pdfBytes;
            this.infoStore.submissionnumber = args.submissionnumber + 1;
            return createPdfExportResult(signedPdf, {
                signed: signing,
                signMode: identity?.mode ?? null,
            });
        } catch (error) {
            loggingBridge.error(`iosUpdateListener @ getBase64PDF: ${error}`);
            return { sender: 'client', message: 'Error generating PDF', status: 'error' };
        }
    }

    /**
     * Captures the section markers (statsRule badge positions and counts) from the live
     * html2pdf container after an explicit toContainer() plus two animation frames, so the
     * badge geometry matches exactly what html2canvas will render into the canvas.
     * Returns the plain text of the section after the last marker, or the whole document
     * text when the document defines no sections.
     */
    private collectSectionMarkers(markers: { top: number; words: number; chars: number }[]): string {
        const container = document.querySelector('.html2pdf__container');
        if (!container) return '';
        const containerTop = container.getBoundingClientRect().top;
        const badges = Array.from(container.querySelectorAll('.stats-rule-block'));
        markers.length = 0;
        for (const el of badges) {
            const badge = el.querySelector('.stats-rule-badge');
            const nums = badge ? (badge.textContent || '').match(/\d+/g) : null;
            markers.push({
                top: el.getBoundingClientRect().top - containerTop,
                words: nums && nums[0] ? parseInt(nums[0], 10) : 0,
                chars: nums && nums[1] ? parseInt(nums[1], 10) : 0,
            });
        }
        return badges.length ? this.collectTextAfter(badges[badges.length - 1]!) : this.collectDocumentText(container);
    }

    /**
     * Appends a statsRule marker after the last character of the trailing section in the cloned
     * html2pdf container so the last section is rendered like any finished section (mirrors
     * Electron, where a marker under the last section shows its badge). The badge text carries
     * the section's count.
     */
    private appendTrailingSectionMarker(sectionTail: string): void {
        const container = document.querySelector('.html2pdf__container');
        const blocks = container ? container.querySelectorAll('.stats-rule-block') : null;
        const last = blocks ? blocks[blocks.length - 1] : null;
        if (!container || !last) return;
        const { words, chars } = countWordsAndChars(sectionTail);
        const block = document.createElement('div');
        block.className = 'stats-rule-block';
        const hr = document.createElement('div');
        hr.className = 'stats-rule-hr';
        const badge = document.createElement('div');
        badge.className = 'stats-rule-badge';
        badge.setAttribute('contenteditable', 'false');
        badge.textContent = `${words} ${t('editor.words')}, ${chars} ${t('editor.chars')}`;
        block.appendChild(hr);
        block.appendChild(badge);
        // statsRule nodes are direct document children; appending to their parent puts the
        // marker after the whole document (incl. the trailing section), not before it.
        last.parentElement?.appendChild(block);
    }

    /** Collects the plain text after a section marker, inserting newlines between block elements. */
    private collectTextAfter(node: Element): string {
        const out = { value: '' };
        const siblings: Node[] = [];
        let sibling = node.nextSibling;
        while (sibling) {
            siblings.push(sibling);
            sibling = sibling.nextSibling;
        }
        this.appendTextWithBlockBreaks(siblings, out);
        return out.value;
    }

    /** Appends text from the given nodes, skipping statsRule blocks and inserting newlines between block elements. */
    private appendTextWithBlockBreaks(nodes: NodeListOf<Node> | Node[], out: { value: string }): void {
        const visit = (n: Node): void => {
            if (n.nodeType === Node.TEXT_NODE) {
                out.value += n.textContent;
                return;
            }
            if (n.nodeType !== Node.ELEMENT_NODE) return;
            const el = n as Element;
            if (el.classList && el.classList.contains('stats-rule-block')) return;
            const hadText = out.value.length > 0;
            for (const c of Array.from(n.childNodes)) visit(c);
            if (hadText && out.value.length && !out.value.endsWith('\n') && /^(block|list-item|table-row|flex|grid)$/.test(window.getComputedStyle(el).display)) {
                out.value += '\n';
            }
        };
        for (const n of Array.from(nodes)) visit(n);
    }

    /** Collects the plain text of the whole container, inserting newlines between block elements. */
    private collectDocumentText(container: Element): string {
        const out = { value: '' };
        this.appendTextWithBlockBreaks(container.childNodes, out);
        return out.value;
    }

    /**
     * Adds the Electron-equivalent header (and footer page numbers) to a jsPDF document.
     * Mirrors the Electron printToPDF options in communicationhandler.js:
     *  - non-fullpage: header on every page inside the top margin; footer pageNumber|totalPages
     *    on every page (Electron leaves the footer empty for signing exports, iOS always renders it)
     *  - fullpage: header on the first printed page only (Electron renders it as a DOM overlay)
     * The footer also shows the whole-document word/character count on every non-fullpage page.
     */
    private addPdfHeaderFooter(
        doc: any,
        args: any,
        isFullpage: boolean,
        documentTotal: { words: number; chars: number } = { words: 0, chars: 0 },
    ): void {
        const { left, right } = createPdfHeaderText(
            this.infoStore.servername,
            args.sectionname,
            args.submissionnumber,
            this.infoStore.clientname,
            formatPdfHeaderDate(),
        );
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageCount = doc.internal.getNumberOfPages();
        const inset = 0.32; // 30px left/right inset of the Electron header/footer templates (72dpi)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);
            if (isFullpage) {
                if (page === 1) {
                    doc.text(left, pageWidth * 0.075, 0.35);
                    doc.text(right, pageWidth * 0.925, 0.35, { align: 'right' });
                }
                continue;
            }
            doc.text(left, inset, IOS_EDITOR_PDF_HEADER_INSET);
            doc.text(right, pageWidth - inset, IOS_EDITOR_PDF_HEADER_INSET, { align: 'right' });
            if (documentTotal.words > 0 || documentTotal.chars > 0) {
                doc.text(
                    `${documentTotal.words} ${t('editor.words')}, ${documentTotal.chars} ${t('editor.chars')}`,
                    inset,
                    pageHeight - IOS_EDITOR_PDF_FOOTER_INSET,
                );
            }
            doc.text(createPdfFooterText(page, pageCount), pageWidth - inset, pageHeight - IOS_EDITOR_PDF_FOOTER_INSET, { align: 'right' });
        }
    }
}

export default new IosPdfService();
