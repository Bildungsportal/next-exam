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
import { filterMethods } from './filters.js';
import { detectorMethods } from './detectors.js';
import { fontAdjustments, fontMethods } from './fonts.js';

/**
 * PDF Parser Class
 * Handles parsing of PDF documents and extraction of interactive elements
 */
class PdfParser {
    constructor(options = {}) {
        // Manual lookup for op codes to be safe
        this.OP_CODE = { moveTo: 13, lineTo: 14, rectangle: 19, transform: 12, save: 0, restore: 1 };
        this.DUPLICATE_TOLERANCE_PX = 12; // px tolerance for duplicate boxes
        this.MIN_SIZE_PDF_UNITS = 5; // roughly ~10px at scale 1.5
        this.CHECKBOX_MAX_SIZE = 25; // px threshold to treat as checkbox
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

        const imgSrc = await this.renderPageToCanvas(page, viewport);

        const [formFields, clozeFields, rawBoxFields] = await Promise.all([
            this.detectFormFields ? this.extractFormFields(page, viewport, pageNum) : Promise.resolve([]),
            this.extractClozeFields(page, viewport),
            this.detectBoxFields ? this.extractBoxFields(page, viewport) : Promise.resolve([])
        ]);

        if (this.debugBoxExtraction) {
            console.log(`processPage: rawBoxFields=${rawBoxFields.length}`);
            const tableCells = rawBoxFields.filter(b => b.isTableCell);
            console.log(`processPage: table-cells in rawBoxFields=${tableCells.length}`);
        }

        let boxFields = this.enableFilterAndMerge ? this.filterAndMergeBoxes(rawBoxFields) : rawBoxFields;
        if (this.debugBoxExtraction) {
            const tableCellsAfterFilter = boxFields.filter(b => b.isTableCell);
            console.log(`processPage: table-cells after filterAndMergeBoxes=${tableCellsAfterFilter.length}`);
        }

        const boxFieldsWithoutText = this.enableFilterBoxesWithText ? await this.filterBoxesWithText(boxFields, page, viewport) : boxFields;
        const boxFieldsPreciseFilter = this.enableFilterBoxesWithTextPrecise ? await this.filterBoxesWithTextPrecise(boxFieldsWithoutText, page, viewport) : boxFieldsWithoutText;

        const allFields = [...clozeFields, ...boxFieldsPreciseFilter];
        const filteredAllFields = this.enableFilterAndMerge ? this.filterAndMergeBoxes(allFields) : allFields;
        const filteredClozeFields = filteredAllFields.filter(field => clozeFields.some(cf => cf.id === field.id));
        const filteredBoxFields = filteredAllFields.filter(field => boxFieldsPreciseFilter.some(bf => bf.id === field.id));

        const totalFields = formFields.length + filteredClozeFields.length + filteredBoxFields.length;
        const warnings = [];
        const hasWarning = totalFields < this.SCAN_MIN_BOXES;
        if (hasWarning) {
            const warningMsg = `pdfparser @ processPage: only ${totalFields} fields found (${formFields.length} form fields, ${filteredClozeFields.length} cloze fields, ${filteredBoxFields.length} box fields) - possible scanned PDF without detectable forms`;
            warnings.push(warningMsg);
        }

        return {
            width: viewport.width,
            height: viewport.height,
            imgSrc: imgSrc,
            formFields: formFields,
            clozeFields: filteredClozeFields,
            boxFields: filteredBoxFields,
            warnings,
            hasWarning: hasWarning,
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

    async extractClozeFields(page, viewport) {
        return detectorMethods.extractClozeFields.call(this, page, viewport);
    }

    async findIsolatedHorizontalLines(page, viewport) {
        return detectorMethods.findIsolatedHorizontalLines.call(this, page, viewport);
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

    async filterBoxesWithText(boxFields, page, viewport) {
        return filterMethods.filterBoxesWithText.call(this, boxFields, page, viewport);
    }

    async filterBoxesWithTextPrecise(boxFields, page, viewport) {
        return filterMethods.filterBoxesWithTextPrecise.call(this, boxFields, page, viewport);
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
    return await parser.parse(pdfData);
}
