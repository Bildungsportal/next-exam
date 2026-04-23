/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 *
 * Router: pdfjs major >= 5 uses v5/detectors (constructPath decode); else legacy/ for v4-shaped operator lists.
 * Set VITE_PDF_PARSER=legacy or v5 to force either implementation.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePdfToPages as parseLegacy } from './legacy/index.js';
import { parsePdfToPages as parseV5 } from './v5/index.js';

function pdfjsMajorVersion() {
    const v = pdfjsLib?.version ?? '0';
    const m = parseInt(String(v).split('.')[0], 10);
    return Number.isFinite(m) ? m : 0;
}

function pickParseImpl() {
    const force = import.meta.env?.VITE_PDF_PARSER;
    if (force === 'legacy') return parseLegacy;
    if (force === 'v5') return parseV5;
    return pdfjsMajorVersion() >= 5 ? parseV5 : parseLegacy;
}

const parseImpl = pickParseImpl();

export async function parsePdfToPages(pdfData, options = {}) {
    return parseImpl(pdfData, options);
}
