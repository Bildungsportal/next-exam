/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 *
 * PDF parser entrypoint (pdfjs 5.x).
 */

import { parsePdfToPages as parseV5 } from './v5/index.js';

export async function parsePdfToPages(pdfData, options = {}) {
    return parseV5(pdfData, options);
}

export { ensurePdfOverlayFontsReady, PDF_OVERLAY_FONT_FAMILIES } from './pdfOverlayFonts.js';

