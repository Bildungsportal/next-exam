/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */


/**
 * PDF Parser Utility
 * Extracts form fields, cloze text, and drawn rectangles from PDF documents
 */

// Import PDF.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { filterMethods } from '../shared/filters.js';
import { detectorMethods } from './detectors.js';
import { fontAdjustments, fontMethods } from '../shared/fonts.js';

/**
 * PDF Parser Class
 * Handles parsing of PDF documents and extraction of interactive elements
 */
class PdfParser {
    constructor(options = {}) {
        // Prefer PDF.js operator codes (they changed across majors); fallback to legacy numeric values.
        const OPS = pdfjsLib?.OPS || {};
        this.OP_CODE = {
            moveTo: OPS.moveTo ?? 13,
            lineTo: OPS.lineTo ?? 14,
            curveTo: OPS.curveTo ?? 15,
            curveTo2: OPS.curveTo2 ?? 16,
            curveTo3: OPS.curveTo3 ?? 17,
            rectangle: OPS.rectangle ?? 19,
            transform: OPS.transform ?? 12,
            save: OPS.save ?? 0,
            restore: OPS.restore ?? 1,
        };
        this.DUPLICATE_TOLERANCE_PX = 12; // px tolerance for duplicate boxes
        this.MIN_SIZE_PDF_UNITS = 5; // roughly ~10px at scale 1.5
        this.CHECKBOX_MAX_SIZE = 25; // px threshold to treat as small checkbox
        this.MC_BOX_MAX_SIZE = options.mcBoxMaxSize ?? 80; // px upper limit for MC answer squares (deselect)
        this.SINGLE_LINE_TEXTAREA_MAX_HEIGHT = 30; // px threshold to downgrade textarea to input
        this.SCAN_MIN_BOXES = 2; // threshold to detect scan PDFs
        this.elementCounter = 0; // running id for generated overlay elements
        this.enableLogging = options.enableLogging ?? false;
        this.debugClozeFonts = this.enableLogging && (options.debugClozeFonts ?? false);
        this.pendingFontLogs = new Set();
        this.debugBoxExtraction = this.enableLogging && (options.debugBoxExtraction ?? false);

        this.fontAdjustments = fontAdjustments;
        
        // Feature flags - all enabled by default (true) for backward compatibility
        // Standard values are explicitly set to true for better visibility
        this.detectCheckboxes = options.detectCheckboxes ?? true; // Unicode checkboxes (☐, ☑, ☒)
        this.detectUnderscores = options.detectUnderscores ?? true; // Underscore gaps (____)
        this.detectDots = options.detectDots ?? true; // Dot gaps (....)
        this.detectDeselectFields = options.detectDeselectFields ?? true; // Standalone capital letters
        this.detectIsolatedLines = options.detectIsolatedLines ?? true; // Isolated horizontal lines
        this.detectFormFields = options.detectFormFields ?? true; // PDF form fields (AcroForms)
        this.detectBoxFields = options.detectBoxFields ?? true; // Drawn rectangles and tables
        
        // Filter options
        this.enableFilterAndMerge = options.enableFilterAndMerge ?? true; // Remove duplicates and containers
        this.enableFilterBoxesWithText = options.enableFilterBoxesWithText ?? true; // Filter boxes containing text
        this.enableFilterBoxesWithTextPrecise = options.enableFilterBoxesWithTextPrecise ?? true; // Precise text overlap filter 
      
    }






















    generateElementId(prefix = 'el') {
        this.elementCounter += 1;
        return `${prefix}_${this.elementCounter}`;
    }


    setupWorker() {
        if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            // Resolved at runtime in Electron renderer; alias in quasar.config provides build-time path
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.mjs',
                import.meta.url
            ).toString();
        }
    }

    async renderPageToCanvas(page, viewport) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        return canvas.toDataURL('image/png');
    }

    async processPage(page, pageNum) {
const initialViewport = page.getViewport({ scale: 1.5 });
        const rotationCorrection = await this.detectTextRotation(page, initialViewport);
        const isContentRotated = rotationCorrection !== null;
        const viewport = page.getViewport({ scale: 1.5, rotation: rotationCorrection || 0 });

        if (isContentRotated && this.enableLogging) {
            console.log(`pdfparser @ processPage: Page ${pageNum} - Content detected as rotated, applying ${rotationCorrection}° correction (original: ${initialViewport.width.toFixed(1)}x${initialViewport.height.toFixed(1)}, corrected: ${viewport.width.toFixed(1)}x${viewport.height.toFixed(1)})`);
        }

        // PNG hochaufgeloest rendern (Print/Display schaerfer); Detector+Output bleiben in 1.5x-Raum
        const renderViewport = page.getViewport({ scale: 3, rotation: rotationCorrection || 0 });
        const imgSrc = await this.renderPageToCanvas(page, renderViewport);

        // Two-pass: extract box geometry first so cloze detection can use it as context
        const [formFields, rawBoxFields] = await Promise.all([
            this.detectFormFields ? this.extractFormFields(page, viewport, pageNum) : Promise.resolve([]),
            this.detectBoxFields ? this.extractBoxFields(page, viewport) : Promise.resolve([])
        ]);

        // Detect vectorized/flattened PDFs: no extractable text and no AcroForm fields.
        // These are typically iLovePDF or similar exports where all content is vector paths.
        // Field detection is unreliable for such PDFs.
        const textContent = await page.getTextContent();
        const isVectorizedPage = formFields.length === 0 && textContent.items.length === 0 && rawBoxFields.length === 0;

        // Build a simple rect array from raw box fields for context lookup.
        // Scoped isolated-line suppression: reject isolated lines only when they sit inside
        // a reconstructed table cell (cell borders), not page-wide.
        const knownBoxRects = rawBoxFields.map(b => this.getRectFromStyle(b.style));
        const tableCellRects = rawBoxFields
            .filter((b) => b.isTableCell)
            .map((b) => this.getRectFromStyle(b.style));
        const clozeFields = await this.extractClozeFields(page, viewport, knownBoxRects, textContent, tableCellRects);

        if (this.enableLogging) {
            const _dbgBoxByType = rawBoxFields.reduce((a, b) => { a[b.type] = (a[b.type]||0)+1; return a; }, {});
            const _dbgBoxSizes  = [...new Set(rawBoxFields.map(b => `${parseFloat(b.style.width).toFixed(0)}x${parseFloat(b.style.height).toFixed(0)}`))].slice(0, 20);
            console.log(`[PDF p${pageNum}] boxFields: ${rawBoxFields.length} total`, _dbgBoxByType, '| unique sizes:', _dbgBoxSizes.join(', '));
            console.log(`[PDF p${pageNum}] formFields: ${formFields.length}`, formFields.reduce((a,f)=>{ a[f.type]=(a[f.type]||0)+1; return a; }, {}));
            console.log(`[PDF p${pageNum}] clozeFields: ${clozeFields.length}`, clozeFields.reduce((a,c)=>{ a[c.type]=(a[c.type]||0)+1; return a; }, {}));
        }

        if (this.enableLogging && this.debugBoxExtraction) {
            const tableCells = rawBoxFields.filter(b => b.isTableCell);
            console.log(`processPage: rawBoxFields=${rawBoxFields.length}, table-cells=${tableCells.length}`);
        }

        const fmt = (fields) => {
            const tc = fields.filter(b => b.isTableCell).length;
            const cb = fields.filter(b => b.type === 'checkbox' || b.type === 'deselect').length;
            const cl = fields.filter(b => b.type === 'cloze' || b.type === 'input' || b.type === 'text').length - tc;
            return `${fields.length} total  TC:${tc}  cb:${cb}  cloze:${Math.max(0,cl)}`;
        };

        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] raw:`, rawBoxFields.map(b=>`${b.id}[${b.type}${b.isTableCell?'/TC':''}] ${parseFloat(b.style.left).toFixed(0)},${parseFloat(b.style.top).toFixed(0)} ${parseFloat(b.style.width).toFixed(0)}x${parseFloat(b.style.height).toFixed(0)}`));
        }
        let boxFields = this.enableFilterAndMerge ? this.filterAndMergeBoxes(rawBoxFields) : rawBoxFields;
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] raw=${rawBoxFields.length} → filterAndMerge → ${fmt(boxFields)}`);
        }

        const boxFieldsWithoutText = this.enableFilterBoxesWithText ? await this.filterBoxesWithText(boxFields, page, viewport, textContent) : boxFields;
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] filterBoxesWithText     → ${fmt(boxFieldsWithoutText)}`);
        }

        const boxFieldsPreciseFilter = this.enableFilterBoxesWithTextPrecise ? await this.filterBoxesWithTextPrecise(boxFieldsWithoutText, page, viewport, textContent) : boxFieldsWithoutText;
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] filterBoxesWithTextPrec → ${fmt(boxFieldsPreciseFilter)}`);
        }

        const clozePruned = this.filterClozeAgainstBoxFields(clozeFields, boxFieldsPreciseFilter);
        const allFields = [...clozePruned, ...boxFieldsPreciseFilter];
        const filteredAllFields = this.enableFilterAndMerge ? this.filterAndMergeBoxes(allFields) : allFields;
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] +cloze(${clozePruned.length}) → 2.filterAndMerge → ${fmt(filteredAllFields)}`);
        }

        const filteredClozeFields = filteredAllFields.filter(field => clozePruned.some(cf => cf.id === field.id));
        const filteredBoxFields = filteredAllFields.filter(field => boxFieldsPreciseFilter.some(bf => bf.id === field.id));

        const clozeIdSet = new Set(filteredClozeFields.map((f) => f.id));
        const boxIdSet = new Set(filteredBoxFields.map((f) => f.id));
        const overlapResolved = this.resolveSmallerWinsAmongOverlappingFields([...filteredClozeFields, ...filteredBoxFields]);
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] resolveSmallerWins      → ${fmt(overlapResolved)}`);
        }

        const filteredClozeFieldsOut = this.filterDegenerateInteractiveFields(
            overlapResolved.filter((f) => clozeIdSet.has(f.id)),
            textContent,
            viewport,
        );
        const filteredBoxFieldsOut = this.filterDegenerateInteractiveFields(
            overlapResolved.filter((f) => boxIdSet.has(f.id)),
            textContent,
            viewport,
        );
        const formFieldsFiltered = this.filterDegenerateInteractiveFields(formFields, textContent, viewport);
        if (this.enableLogging) {
            console.log(`[PIPE p${pageNum}] filterDegenerate        → box:${filteredBoxFieldsOut.length}  cloze:${filteredClozeFieldsOut.length}  form:${formFieldsFiltered.length}`);
        }

        const totalFields = formFieldsFiltered.length + filteredClozeFieldsOut.length + filteredBoxFieldsOut.length;
        if (this.enableLogging) {
            console.log(`pdfparser p${pageNum}: ${totalFields} active fields`);
        }
        const warnings = [];
        const hasWarning = isVectorizedPage || totalFields < this.SCAN_MIN_BOXES;
        if (isVectorizedPage) {
            warnings.push(`This PDF appears to be a fully vectorized export. Automatic field detection is not supported — please add form fields manually.`);
        } else if (totalFields < this.SCAN_MIN_BOXES) {
            const warningMsg = `pdfparser @ processPage: only ${totalFields} fields found (${formFieldsFiltered.length} form fields, ${filteredClozeFieldsOut.length} cloze fields, ${filteredBoxFieldsOut.length} box fields) - possible scanned PDF without detectable forms`;
            warnings.push(warningMsg);
        }

        return {
            width: viewport.width,
            height: viewport.height,
            imgSrc: imgSrc,
            formFields: formFieldsFiltered,
            clozeFields: filteredClozeFieldsOut,
            boxFields: isVectorizedPage ? [] : filteredBoxFieldsOut,
            warnings,
            hasWarning: hasWarning,
            isVectorizedPage: isVectorizedPage,
            isContentRotated: isContentRotated
        };
    }

    async parse(pdfData) {
        this.setupWorker();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
        const pdfDocument = await loadingTask.promise;
        const pagesData = [];
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const pageData = await this.processPage(page, pageNum);
            pagesData.push(pageData);
        }
        return pagesData;
    }

    extractFormFields(page, viewport, pageNum) {
        return detectorMethods.extractFormFields.call(this, page, viewport, pageNum);
    }

    async extractClozeFields(page, viewport, knownBoxRects = [], cachedTextContent = null, tableCellRects = []) {
        return detectorMethods.extractClozeFields.call(this, page, viewport, knownBoxRects, cachedTextContent, tableCellRects);
    }

    async findIsolatedHorizontalLines(page, viewport, knownBoxRects = []) {
        return detectorMethods.findIsolatedHorizontalLines.call(this, page, viewport, knownBoxRects);
    }


    async extractDeselectFields(page, viewport) {
        return detectorMethods.extractDeselectFields.call(this, page, viewport);
    }

    determineBoxType(widthPx, heightPx) {
        return detectorMethods.determineBoxType.call(this, widthPx, heightPx);
    }

    addBox(rawX, rawY, rawW, rawH, matrix, viewport, boxFields) {
        return detectorMethods.addBox.call(this, rawX, rawY, rawW, rawH, matrix, viewport, boxFields);
    }

    isPathClosed(points) {
        return detectorMethods.isPathClosed.call(this, points);
    }

    processPathPoints(points, matrix, viewport, boxFields) {
        return detectorMethods.processPathPoints.call(this, points, matrix, viewport, boxFields);
    }

    addBoxFromPdfRect(pdfRect, viewport, boxFields, skipSmallCheck = false, typeHint = null, isTableCell = false) {
        return detectorMethods.addBoxFromPdfRect.call(this, pdfRect, viewport, boxFields, skipSmallCheck, typeHint, isTableCell);
    }

    transformPoint(x, y, matrix) {
        return detectorMethods.transformPoint.call(this, x, y, matrix);
    }

    processLinePathForRectangles(ops, data, ctm, viewport, boxFields, lineStore) {
        return detectorMethods.processLinePathForRectangles.call(this, ops, data, ctm, viewport, boxFields, lineStore);
    }

    findCorner(hLine, vLine, tolerance) {
        return detectorMethods.findCorner.call(this, hLine, vLine, tolerance);
    }

    buildRectanglesFromLines(lineStore, viewport, boxFields) {
        return detectorMethods.buildRectanglesFromLines.call(this, lineStore, viewport, boxFields);
    }

    getRectFromStyle(style) {
        return filterMethods.getRectFromStyle.call(this, style);
    }

    filterAndMergeBoxes(boxes) { 
        return filterMethods.filterAndMergeBoxes.call(this, boxes);
    }

    async filterBoxesWithText(boxFields, page, viewport, cachedTextContent = null) {
        return filterMethods.filterBoxesWithText.call(this, boxFields, page, viewport, cachedTextContent);
    }

    async filterBoxesWithTextPrecise(boxFields, page, viewport, cachedTextContent = null) {
        return filterMethods.filterBoxesWithTextPrecise.call(this, boxFields, page, viewport, cachedTextContent);
    }

    async extractBoxFields(page, viewport) {
        return detectorMethods.extractBoxFields.call(this, page, viewport);
    }

    async detectTextRotation(page, viewport) {
        return detectorMethods.detectTextRotation.call(this, page, viewport);
    }




    mapUnicodeToPdfCharCode(unicodeCharCode, encoding) {
        return filterMethods.mapUnicodeToPdfCharCode.call(this, unicodeCharCode, encoding);
    }

    measureTextWidthWithMetrics(text, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust) {
        return filterMethods.measureTextWidthWithMetrics.call(this, text, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust);
    }
}








Object.assign(PdfParser.prototype, filterMethods, detectorMethods, fontMethods);

/**
 * Parse PDF data and extract interactive elements
 * @param {Uint8Array|ArrayBuffer} pdfData - Raw PDF file data
 * @param {Object} options - Optional configuration object to enable/disable features
 * @param {boolean} options.detectCheckboxes - Enable/disable Unicode checkbox detection (default: true)
 * @param {boolean} options.detectUnderscores - Enable/disable underscore gap detection (default: true)
 * @param {boolean} options.detectDots - Enable/disable dot gap detection (default: true)
 * @param {boolean} options.detectDeselectFields - Enable/disable deselect field detection (default: true)
 * @param {boolean} options.detectIsolatedLines - Enable/disable isolated line detection (default: true)
 * @param {boolean} options.detectFormFields - Enable/disable PDF form field detection (default: true)
 * @param {boolean} options.detectBoxFields - Enable/disable drawn rectangle/table detection (default: true)
 * @returns {Promise<Array>} Array of page objects with form fields, cloze fields, and box fields
 */
export async function parsePdfToPages(pdfData, options = {}) {
    const parser = new PdfParser(options);
    return parser.parse(pdfData);
}
