import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Horizontal advance of a text item in viewport px (pdfjs width is text-space; scale changed across majors). */
export function textItemRunWidthPx(tx, item, measureCtx, str) {
    const horizScale = Math.hypot(tx[0], tx[1]);
    const measured = measureCtx && str ? measureCtx.measureText(str).width || 0 : 0;
    if (typeof item.width !== 'number' || !Number.isFinite(item.width)) {
        return measured > 0 ? measured : horizScale * (str?.length || 0) * 0.6;
    }
    const wAbs = Math.abs(item.width);
    const scaled = wAbs * horizScale;
    if (measured > 0.5 && str && str.length > 0) {
        return Math.abs(measured - scaled) <= Math.abs(measured - wAbs) ? scaled : wAbs;
    }
    return scaled;
}

function rectIntersectionArea(a, b) {
    const L = Math.max(a.left, b.left);
    const R = Math.min(a.right, b.right);
    const T = Math.max(a.top, b.top);
    const Bo = Math.min(a.bottom, b.bottom);
    const w = Math.max(0, R - L);
    const h = Math.max(0, Bo - T);
    return w * h;
}

// Collection of filter utilities extracted from the PDF parser
export const filterMethods = {
    /**
     * Compute numeric rectangle info from style strings.
     */
    getRectFromStyle(style) {
        const left = parseFloat(style.left);
        const top = parseFloat(style.top);
        const width = parseFloat(style.width);
        const height = parseFloat(style.height);
        return {
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
            area: width * height,
        };
    },

    /** Smallest rendered body font (px) from text items; fallback when page has no extractable text. */
    computePageMinFontPx(textContent, viewport) {
        if (!textContent?.items?.length || !viewport) return 11;
        let minFs = 48;
        for (const item of textContent.items) {
            const vis = String(item.str || '')
                .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
                .trim();
            if (vis.length < 1) continue;
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fs = Math.hypot(tx[0], tx[1]);
            if (fs > 2.5 && fs < minFs) minFs = fs;
        }
        return minFs < 48 ? minFs : 11;
    },

    /** Remove unusable text/textarea hits (cloze noise); keep checkbox/deselect and all table hulls. */
    filterDegenerateInteractiveFields(fields, textContent = null, viewport = null) {
        if (!fields || fields.length === 0) return fields;
        const m = textContent && viewport ? this.computePageMinFontPx(textContent, viewport) : 11;
        const minW = Math.max(22, m * 0.95);
        const minH = Math.max(12, m * 0.9);
        return fields.filter((f) => {
            if (f.type === 'checkbox' || f.type === 'deselect') return true;
            // Cloze markers (underscore runs, dot fills, isolated underlines)
            // are intentional fill-in slots — exempt them from the 22px
            // minimum so "__10__" style worksheets keep all slots.
            if (f.isClozeField) return true;
            if (f.isTableCell) {
                const rTc = this.getRectFromStyle(f.style);
                // Drop line-reconstruction hulls that cover a huge fraction of the page (not a real cell).
                if (viewport?.width > 1 && viewport?.height > 1) {
                    const vpA = viewport.width * viewport.height;
                    if ((rTc.width * rTc.height) / vpA > 0.22) return false;
                }
                return true;
            }
            const r = this.getRectFromStyle(f.style);
            if (r.width < minW || r.height < minH) return false;
            if (f.type === 'text') {
                const ar = r.width / Math.max(r.height, 0.01);
                if (ar > 36 || ar < 0.06) return false;
            }
            return true;
        });
    },

    /**
     * Viewport axis-aligned bounds for a text content item (same geometry as filterBoxesWithTextPrecise).
     */
    computeTextItemViewportBounds(item, page, viewport, measureCtx) {
        if (!item.str || !String(item.str).trim()) return null;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        const fontName = item.fontName;
        const fontInfo = this.getFontInfo(page, fontName);
        let effectiveFontFamily = 'sans-serif';
        if (fontInfo) {
            const adj =
                this.findFontAdjustmentByName(fontInfo.baseFont) || this.findFontAdjustmentByName(fontInfo.fontName);
            if (adj) effectiveFontFamily = adj.family || effectiveFontFamily;
        }
        measureCtx.font = `${fontSize}px ${effectiveFontFamily}`;
        const actualFullWidthRaw = textItemRunWidthPx(tx, item, measureCtx, item.str);
        const itemX = tx[4];
        const itemY = tx[5];
        // textItemRunWidthPx already reconciles pdf text-space width vs canvas measureText; max() systematically over-estimated runs.
        const runWidthPx = actualFullWidthRaw || 0;
        const dir = tx[0] >= 0 ? 1 : -1;
        const xEnd = itemX + dir * runWidthPx;
        const textLeft = Math.min(itemX, xEnd);
        const textRight = Math.max(itemX, xEnd);
        const textTop = itemY - fontSize;
        const textBottom = itemY + 2;
        const top = Math.min(textTop, textBottom);
        const bottom = Math.max(textTop, textBottom);
        return { left: textLeft, right: textRight, top, bottom };
    },

    /**
     * True when extractable text clearly sits in this table cell (center-in wins; ratio rules only for off-center overlap).
     */
    tableCellHasMeaningfulPrintedText(cellRect, textContent, page, viewport, measureCtxIn = null) {
        if (!textContent?.items?.length) return false;
        let measureCtx = measureCtxIn;
        if (!measureCtx) {
            const measureCanvas = document.createElement('canvas');
            measureCtx = measureCanvas.getContext('2d');
        }
        for (const item of textContent.items) {
            const visible = String(item.str || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
                .trim();
            if (!visible.length) continue;
            const b = this.computeTextItemViewportBounds(item, page, viewport, measureCtx);
            if (!b) continue;
            const overlap = rectIntersectionArea(cellRect, b);
            if (overlap < 4) continue;
            const textArea = (b.right - b.left) * (b.bottom - b.top);
            if (textArea > 0 && overlap / textArea < 0.5) continue;
            const cx = (b.left + b.right) / 2;
            const tx2 = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontSize2 = Math.sqrt(tx2[0] * tx2[0] + tx2[1] * tx2[1]);
            const baseline = tx2[5];
            if (cx < cellRect.left || cx > cellRect.right) continue;
            if (baseline < cellRect.top || baseline > cellRect.bottom) continue;
            const cellHeight = cellRect.bottom - cellRect.top;
            const deadZoneTop = Math.min(fontSize2 * 0.5, cellHeight * 0.3);
            if (baseline < cellRect.top + deadZoneTop) continue;
            if (this.enableLogging) console.log(`[TC] text match "${visible}" → cell ${cellRect.left.toFixed(0)},${cellRect.top.toFixed(0)} ${(cellRect.right-cellRect.left).toFixed(0)}x${(cellRect.bottom-cellRect.top).toFixed(0)} → filtered`);
            return true;
        }
        return false;
    },

    /**
     * Remove cloze artifacts that sit on drawn checkbox/table-checkbox cells (isolated lines, underscores).
     */
    filterClozeAgainstBoxFields(clozeFields, boxFields) {
        if (!clozeFields || clozeFields.length === 0) return clozeFields;
        if (!boxFields || boxFields.length === 0) return clozeFields;
        const boxes = boxFields.map((bf) => ({
            r: this.getRectFromStyle(bf.style),
            type: bf.type,
            isTableCell: !!bf.isTableCell,
        }));
        const checkboxRects = boxes.filter((b) => b.type === 'checkbox' || b.type === 'deselect').map((b) => b.r);
        const tableCells = boxes.filter((b) => b.isTableCell).map((b) => b.r);
        const cellHasCheckbox = (cell) =>
            checkboxRects.some((cr) => {
                const cx = (cr.left + cr.right) / 2;
                const cy = (cr.top + cr.bottom) / 2;
                return cx >= cell.left - 3 && cx <= cell.right + 3 && cy >= cell.top - 3 && cy <= cell.bottom + 3;
            });
        return clozeFields.filter((c) => {
            const cr = this.getRectFromStyle(c.style);
            if (cr.area < 0.5) return true;
            const isTextLike = c.type === 'text' || c.type === undefined || c.type === null;
            for (const br of checkboxRects) {
                const oa = rectIntersectionArea(cr, br);
                if (oa / cr.area > 0.28) return false;
            }
            if (isTextLike) {
                for (const cell of tableCells) {
                    if (!cellHasCheckbox(cell)) continue;
                    const oa = rectIntersectionArea(cr, cell);
                    if (oa / cr.area > 0.35) return false;
                }
            }
            return true;
        });
    },

    /**
     * Overlapping overlay fields: keep smaller-area field when a larger one shares meaningful overlap (removes spanning hull vs cell double-hits).
     */
    resolveSmallerWinsAmongOverlappingFields(fields) {
        if (!fields || fields.length === 0) return fields;
        const bboxCenterInside = (inner, outer) => {
            const cx = (inner.left + inner.right) / 2;
            const cy = (inner.top + inner.bottom) / 2;
            return cx >= outer.left - 2 && cx <= outer.right + 2 && cy >= outer.top - 2 && cy <= outer.bottom + 2;
        };
        const unit = fields
            .map((field) => {
                const r = this.getRectFromStyle(field.style);
                return { field, r, area: Math.max(r.area, 1e-6) };
            })
            .sort((a, b) => {
                const d = a.area - b.area;
                if (d !== 0) return d;
                // Same footprint: keep table hull before text/cloze so underscore runs do not erase the cell.
                const pri = (x) => (x.field.isTableCell ? 0 : 1);
                return pri(a) - pri(b);
            });
        const kept = [];
        for (const cur of unit) {
            const curIsCb = cur.field.type === 'checkbox' || cur.field.type === 'deselect';
            // Checkbox/deselect wins the slot vs a line-reconstructed hull over the same mark (evict hull, not the mark).
            if (curIsCb) {
                for (let ki = kept.length - 1; ki >= 0; ki -= 1) {
                    const k = kept[ki];
                    if (!k.field.isTableCell) continue;
                    const oa = rectIntersectionArea(cur.r, k.r);
                    if (oa < 8) continue;
                    if (bboxCenterInside(cur.r, k.r)) kept.splice(ki, 1);
                }
            }
            let removeCur = false;
            if (cur.field.isTableCell && !curIsCb) {
                for (const k of kept) {
                    const kIsCb = k.field.type === 'checkbox' || k.field.type === 'deselect';
                    if (kIsCb && bboxCenterInside(k.r, cur.r)) {
                        removeCur = true;
                        break;
                    }
                }
                if (!removeCur) kept.push(cur);
                continue;
            }
            for (const k of kept) {
                const oa = rectIntersectionArea(cur.r, k.r);
                if (oa < 8) continue;
                // oaOverSm uses min(area); tiny cloze specks in `kept` falsely satisfy ratio and erase real checkbox marks.
                const kIsCb = k.field.type === 'checkbox' || k.field.type === 'deselect';
                const speckMaxArea = 220;
                if (curIsCb && !kIsCb && k.area <= speckMaxArea) continue;
                // Marks must not lose to reconstructed table hulls on overlap (hull is layout, mark is the control).
                if (curIsCb && k.field.isTableCell) continue;
                const sm = Math.min(cur.area, k.area);
                const lgOverSm = Math.max(cur.area, k.area) / sm;
                const oaOverSm = oa / sm;
                if (lgOverSm >= 1.12 && oaOverSm >= 0.2) {
                    removeCur = true;
                    break;
                }
                if (oaOverSm >= 0.88) {
                    removeCur = true;
                    break;
                }
            }
            if (!removeCur) kept.push(cur);
        }
        return kept.map((x) => x.field);
    },

    /**
     * Merge duplicate boxes and remove container boxes.
     */
    filterAndMergeBoxes(boxes) {
        if (!boxes || boxes.length === 0) {
            return [];
        }
        const dupTolerance = 4; // px tolerance for duplicate boxes at same position
        const keep = new Array(boxes.length).fill(true);
        const rects = boxes.map((box) => this.getRectFromStyle(box.style));
        let removedDuplicates = 0;
        let removedContainers = 0;

        const contains = (rectA, rectB) =>
            rectB.left >= rectA.left - 2 &&
            rectB.right <= rectA.right + 2 &&
            rectB.top >= rectA.top - 2 &&
            rectB.bottom <= rectA.bottom + 2;

        // Pass 1: remove true duplicates (same position AND same size within 3px)
        for (let i = 0; i < boxes.length; i += 1) {
            if (!keep[i]) continue;
            for (let j = i + 1; j < boxes.length; j += 1) {
                if (!keep[j]) continue;
                const ri = rects[i];
                const rj = rects[j];
                const samePos =
                    Math.abs(ri.left - rj.left) <= dupTolerance &&
                    Math.abs(ri.top - rj.top) <= dupTolerance;
                const sameSize =
                    Math.abs(ri.width - rj.width) <= dupTolerance &&
                    Math.abs(ri.height - rj.height) <= dupTolerance;

                if (samePos && sameSize) {
                    const iMark = boxes[i].type === 'checkbox' || boxes[i].type === 'deselect';
                    const jMark = boxes[j].type === 'checkbox' || boxes[j].type === 'deselect';
                    const iCell = !!boxes[i].isTableCell;
                    const jCell = !!boxes[j].isTableCell;
                    // Near-identical bbox: never treat table hull vs mark as duplicate — keep both for later overlap resolution.
                    if ((iMark && jCell) || (jMark && iCell)) continue;
                    keep[j] = false;
                    removedDuplicates += 1;
                }
            }
        }


        // Pass 2: remove structural container rectangles.
        // A box is a container if it contains at least one smaller kept box.
        // Small interactive fields (checkbox/deselect or tiny text boxes) are
        // never removed — they are always leaf nodes, never containers.
        const SMALL_FIELD_MAX = 40; // px — boxes smaller than this on both axes are protected
        for (let i = 0; i < boxes.length; i += 1) {
            if (!keep[i]) continue;
            const rectI = rects[i];
            const isCheckboxI = boxes[i].type === 'checkbox' || boxes[i].type === 'deselect';

            // Protect small fields, but not table cells (table cells can be small and still be containers).
            if (!boxes[i].isTableCell && rectI.width <= SMALL_FIELD_MAX && rectI.height <= SMALL_FIELD_MAX) continue;

            let shouldRemove = false;
            for (let j = 0; j < boxes.length; j += 1) {
                if (i === j || !keep[j]) continue;
                const rectJ = rects[j];
                // Remove if it contains a smaller kept box
                if (rectI.area > rectJ.area && contains(rectI, rectJ)) {
                    // Two table cells: only skip when areas are similar (shared-border contains() false positive); spanning hull >> smaller cell must still be removed.
                    if (boxes[i].isTableCell && boxes[j].isTableCell) {
                        const areaRatio = rectI.area / Math.max(rectJ.area, 1e-6);
                        if (areaRatio < 4.0) {
                            continue;
                        }
                        shouldRemove = true;
                        break;
                    }
                    // Table cells that enclose an actual interactive mark:
                    // - if the cell is only marginally larger than the checkbox, the "cell" is
                    //   just the checkbox border drawn as line segments → drop the phantom cell.
                    // - otherwise (real grading-grid row), drop the decorative mark, keep the cell.
                    if (boxes[i].isTableCell) {
                        const isInteractiveJ = boxes[j].type === 'checkbox' || boxes[j].type === 'deselect';
                        if (isInteractiveJ) {
                            const cellMuchLarger = rectI.area >= rectJ.area * 3;
                            // cellMuchLarger may only drop decorative checkbox marks inside a real grid row — never deselect (letter A etc.).
                            if (cellMuchLarger && boxes[j].type === 'checkbox' && !boxes[j].isTableCell) {
                                // Real interactive checkbox inside a TC — keep it, drop the TC instead
                                shouldRemove = true;
                                break;
                            }
                            if (cellMuchLarger && boxes[j].type === 'checkbox' && boxes[j].isTableCell) {
                                keep[j] = false;
                                removedDuplicates += 1;
                                continue;
                            }
                            if (cellMuchLarger && boxes[j].type === 'deselect') {
                                continue;
                            }
                            shouldRemove = true;
                            break;
                        }
                    } else {
                        shouldRemove = true;
                        break;
                    }
                }
                // Also remove non-checkbox boxes that significantly overlap a checkbox/deselect
                const isCheckboxJ = boxes[j].type === 'checkbox' || boxes[j].type === 'deselect';
                if (isCheckboxJ) {
                    // If a checkbox/deselect contains this box, always drop the inner one (glyph/decoration artifacts).
                    if (!isCheckboxI && contains(rectJ, rectI)) {
                        shouldRemove = true;
                        break;
                    }
                    const overlapLeft = Math.max(rectI.left, rectJ.left);
                    const overlapRight = Math.min(rectI.right, rectJ.right);
                    const overlapTop = Math.max(rectI.top, rectJ.top);
                    const overlapBottom = Math.min(rectI.bottom, rectJ.bottom);
                    const overlapW = Math.max(0, overlapRight - overlapLeft);
                    const overlapH = Math.max(0, overlapBottom - overlapTop);
                    const overlapArea = overlapW * overlapH;
                    // Never strip a table hull because a neighbor checkbox only grazes its bbox (that looked like an "empty" cell).
                    // Never let one checkbox erase another checkbox via partial overlap (duplicate hits from cloze+box paths).
                    if (!isCheckboxI && !boxes[i].isTableCell && overlapArea > rectJ.area * 0.3) {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (shouldRemove) {
                keep[i] = false;
                removedContainers += 1;
                if (this.enableLogging) {
                    console.log(`[filterAndMerge] removed box ${boxes[i].id}[${boxes[i].type}${boxes[i].isTableCell?'/TC':''}] ${rectI.width.toFixed(0)}x${rectI.height.toFixed(0)} @ ${rectI.left.toFixed(0)},${rectI.top.toFixed(0)}`);
                }
            }
        }

        const filtered = boxes.filter((_box, idx) => keep[idx]);
        if (this.enableLogging && this.debugBoxExtraction) {
            console.log(
                `pdfparser @ filterAndMergeBoxes: filtered ${boxes.length} boxes → ${filtered.length}; removed ${removedDuplicates} duplicates, ${removedContainers} containers`,
            );
        }
        return filtered;
    },

    /**
     * Filter out boxes that contain text items (coarse).
     */
    async filterBoxesWithText(boxFields, page, viewport, cachedTextContent = null) {
        if (!boxFields || boxFields.length === 0) return boxFields;

        const textContent = cachedTextContent ?? await page.getTextContent();
        if (!textContent || !textContent.items || textContent.items.length === 0) {
            return boxFields;
        }

        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');

        return boxFields.filter((box) => {
            if (!box.isTableCell) {
                return true;
            }

            const rect = this.getRectFromStyle(box.style);
            return !this.tableCellHasMeaningfulPrintedText(rect, textContent, page, viewport, measureCtx);
        });
    },

    /**
     * Filter out boxes that overlap text items (precise).
     */
    async filterBoxesWithTextPrecise(boxFields, page, viewport, cachedTextContent = null) {
        if (!boxFields || boxFields.length === 0) return boxFields;

        const textContent = cachedTextContent ?? await page.getTextContent();
        if (!textContent || !textContent.items || textContent.items.length === 0) {
            return boxFields;
        }

        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');

        return boxFields.filter((box) => {
            if (box.type === 'checkbox' || box.type === 'deselect') {
                return true;
            }

            const rect = this.getRectFromStyle(box.style);
            const overlapTol = 3;

            // Table cells: use overlap heuristics only — Angabe word-count would drop cells when header centers bleed in.
            if (box.isTableCell) {
                return !this.tableCellHasMeaningfulPrintedText(rect, textContent, page, viewport, measureCtx);
            }

            // --- Angabe-Rechteck detection (non-table boxes only) ---
            // Collect all text items whose center lies fully inside this box.
            // If the contained text has more than one word (or more than one
            // non-trivial token), the rectangle is a label/info frame and must
            // not become an interactive input field.
            const containedWords = [];
            for (const item of textContent.items) {
                if (!item.str || !item.str.trim()) continue;

                // Use the same geometry as the main text-overlap path below to avoid
                // tx2[0]*item.width unit mismatches across pdfjs versions.
                const b = this.computeTextItemViewportBounds(item, page, viewport, measureCtx);
                if (!b) continue;
                const cx = (b.left + b.right) / 2;
                const cy = (b.top + b.bottom) / 2;

                const inside =
                    cx >= rect.left - overlapTol &&
                    cx <= rect.right + overlapTol &&
                    cy >= rect.top - overlapTol &&
                    cy <= rect.bottom + overlapTol;

                if (inside) {
                    const words = item.str.trim().split(/\s+/).filter(w => w.length > 0);
                    containedWords.push(...words);
                }
            }

            // A single letter/digit or empty box → keep as interactive field.
            // Two or more distinct words → info/label frame → drop it.
            if (containedWords.length > 1) {
                // Still allow the box if the "words" are really just single
                // characters (e.g. "A B C D" answer labels inside a cell) — that
                // means every token is a single character.
                const allSingleChars = containedWords.every(w => w.length === 1);
                if (!allSingleChars) {
                    return false;
                }
            }
            // --- end Angabe-Rechteck detection ---

            for (const item of textContent.items) {
                if (!item.str || !item.str.trim()) continue;

                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
                const fontName = item.fontName;
                const fontInfo = this.getFontInfo(page, fontName);

                let effectiveFontFamily = 'sans-serif';
                if (fontInfo) {
                    const adj =
                        this.findFontAdjustmentByName(fontInfo.baseFont) ||
                        this.findFontAdjustmentByName(fontInfo.fontName);
                    if (adj) effectiveFontFamily = adj.family || effectiveFontFamily;
                }

                measureCtx.font = `${fontSize}px ${effectiveFontFamily}`;

                const actualFullWidthRaw = textItemRunWidthPx(tx, item, measureCtx, item.str);

                const itemX = tx[4];
                const itemY = tx[5];

                // Same width basis as computeTextItemViewportBounds / Angabe path; max() inflated runs and false-flagged label boxes.
                const runWidthPx = actualFullWidthRaw || 0;
                const dir = tx[0] >= 0 ? 1 : -1;
                const xEnd = itemX + dir * runWidthPx;
                const textLeft = Math.min(itemX, xEnd);
                const textRight = Math.max(itemX, xEnd);
                const textTop = itemY - fontSize;
                const textBottom = itemY + 2;

                const horizontalOverlap = rect.right > textLeft - overlapTol && rect.left < textRight + overlapTol;
                const verticalOverlap = rect.bottom > textTop - overlapTol && rect.top < textBottom + overlapTol;

                if (horizontalOverlap && verticalOverlap) {
                    if (box.type === 'textarea') {
                        return true;
                    }

                    if (box.type === 'text' && rect.height < fontSize * 1.5) {
                        return false;
                    }
                }
            }

            return true;
        });
    },

    /**
     * Map Unicode character code to PDF character code using encoding.
     */
    mapUnicodeToPdfCharCode(unicodeCharCode, encoding) {
        if (!encoding || encoding.baseEncoding !== 'WinAnsiEncoding') {
            return unicodeCharCode;
        }

        if (unicodeCharCode === 32) {
            return 32;
        }
        if (unicodeCharCode === 8230) {
            return 133;
        }

        if (encoding.differences) {
            const diffCodes = Object.keys(encoding.differences).map(Number);
            if (diffCodes.includes(unicodeCharCode)) {
                return unicodeCharCode;
            }
        }

        if (unicodeCharCode >= 32 && unicodeCharCode <= 255) {
            return unicodeCharCode;
        }

        return unicodeCharCode;
    },

    /**
     * Measure text width using glyph metrics when available; fallback to canvas.
     */
    measureTextWidthWithMetrics(text, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust) {
        let glyphWidths = null;
        if (customAdjust && customAdjust.glyphWidths) {
            glyphWidths = customAdjust.glyphWidths;
        }

        if (glyphWidths && glyphWidths.widths && Array.isArray(glyphWidths.widths)) {
            const { encoding } = customAdjust || {};
            let totalGlyphWidth = 0;

            for (let i = 0; i < text.length; i += 1) {
                const unicodeCharCode = text.charCodeAt(i);
                const pdfCharCode = this.mapUnicodeToPdfCharCode(unicodeCharCode, encoding);
                const glyphIndex = pdfCharCode - glyphWidths.firstChar;

                if (glyphIndex >= 0 && glyphIndex < glyphWidths.widths.length) {
                    const glyphWidth = glyphWidths.widths[glyphIndex];
                    if (glyphWidth > 0) {
                        totalGlyphWidth += glyphWidth;
                    } else {
                        totalGlyphWidth += (measureCtx.measureText(text[i]).width / fontSize) * 1000;
                    }
                } else {
                    totalGlyphWidth += (measureCtx.measureText(text[i]).width / fontSize) * 1000;
                }
            }

            const fontUnitsPerEm = 1000;
            let totalWidth = (totalGlyphWidth / fontUnitsPerEm) * fontSize;

            if (customAdjust && typeof customAdjust.kerningCompensationEm === 'number') {
                totalWidth += customAdjust.kerningCompensationEm * text.length * fontSize;
            }

            if (useScale) {
                totalWidth *= widthScale;
            }
            totalWidth *= fontScale;

            return totalWidth;
        }

        let width = measureCtx.measureText(text).width;

        if (useScale) {
            width *= widthScale;
        }
        width *= fontScale;

        return width;
    },
};
