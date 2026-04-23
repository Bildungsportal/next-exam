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

            // Protect small fields unconditionally
            if (rectI.width <= SMALL_FIELD_MAX && rectI.height <= SMALL_FIELD_MAX) continue;

            let shouldRemove = false;
            for (let j = 0; j < boxes.length; j += 1) {
                if (i === j || !keep[j]) continue;
                const rectJ = rects[j];
                // Remove if it contains a smaller kept box
                if (rectI.area > rectJ.area && contains(rectI, rectJ)) {
                    shouldRemove = true;
                    break;
                }
                // Also remove non-checkbox boxes that significantly overlap a checkbox/deselect
                const isCheckboxJ = boxes[j].type === 'checkbox' || boxes[j].type === 'deselect';
                if (isCheckboxJ) {
                    const overlapLeft = Math.max(rectI.left, rectJ.left);
                    const overlapRight = Math.min(rectI.right, rectJ.right);
                    const overlapTop = Math.max(rectI.top, rectJ.top);
                    const overlapBottom = Math.min(rectI.bottom, rectJ.bottom);
                    const overlapW = Math.max(0, overlapRight - overlapLeft);
                    const overlapH = Math.max(0, overlapBottom - overlapTop);
                    const overlapArea = overlapW * overlapH;
                    if (overlapArea > rectJ.area * 0.3) {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (shouldRemove) {
                keep[i] = false;
                removedContainers += 1;
            }
        }

        const filtered = boxes.filter((box, idx) => keep[idx]);
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

        return boxFields.filter((box) => {
            if (!box.isTableCell) {
                return true;
            }

            const rect = this.getRectFromStyle(box.style);

            for (const item of textContent.items) {
                if (!item.str || !item.str.trim()) continue;

                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
                const itemX = tx[4];
                const itemY = tx[5];

                let textLeft;
                let textRight;
                if (typeof item.width === 'number' && item.width !== 0) {
                    const xEnd = itemX + tx[0] * item.width;
                    textLeft = Math.min(itemX, xEnd);
                    textRight = Math.max(itemX, xEnd);
                } else {
                    const est = fontSize * item.str.length * 0.6;
                    textLeft = itemX;
                    textRight = itemX + est;
                }
                const textTop = itemY - fontSize;
                const textBottom = itemY;
                const textCenterX = (textLeft + textRight) / 2;
                const textCenterY = (textTop + textBottom) / 2;

                const tolerance = 5;
                const centerInside =
                    textCenterX >= rect.left - tolerance &&
                    textCenterX <= rect.right + tolerance &&
                    textCenterY >= rect.top - tolerance &&
                    textCenterY <= rect.bottom + tolerance;

                const overlapLeft = Math.max(textLeft, rect.left);
                const overlapRight = Math.min(textRight, rect.right);
                const overlapTop = Math.max(textTop, rect.top);
                const overlapBottom = Math.min(textBottom, rect.bottom);
                const overlapWidth = Math.max(0, overlapRight - overlapLeft);
                const overlapHeight = Math.max(0, overlapBottom - overlapTop);
                const textArea = (textRight - textLeft) * (textBottom - textTop);
                const overlapArea = overlapWidth * overlapHeight;
                const overlapRatio = textArea > 0 ? overlapArea / textArea : 0;

                if (centerInside && overlapRatio >= 0.3) {
                    return false;
                }
            }
            return true;
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

            // --- Angabe-Rechteck detection ---
            // Collect all text items whose center lies fully inside this box.
            // If the contained text has more than one word (or more than one
            // non-trivial token), the rectangle is a label/info frame and must
            // not become an interactive input field.
            const containedWords = [];
            for (const item of textContent.items) {
                if (!item.str || !item.str.trim()) continue;

                const tx2 = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fs2 = Math.sqrt(tx2[0] * tx2[0] + tx2[1] * tx2[1]);
                const wRaw = typeof item.width === 'number' ? item.width : 0;
                let cx;
                let cy;
                if (wRaw !== 0) {
                    cx = tx2[4] + (tx2[0] * wRaw) / 2;
                    cy = tx2[5] + (tx2[1] * wRaw) / 2 - fs2 / 2;
                } else {
                    cx = tx2[4] + fs2 / 2;
                    cy = tx2[5] - fs2 / 2;
                }

                const inside =
                    cx >= rect.left - overlapTol &&
                    cx <= rect.right + overlapTol &&
                    cy >= rect.top - overlapTol &&
                    cy <= rect.bottom + overlapTol;

                if (inside) {
                    // Count words in this item
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

                let customAdjust = null;
                let effectiveFontFamily = 'sans-serif';
                let fontScale = 1;

                if (fontInfo) {
                    customAdjust =
                        this.findFontAdjustmentByName(fontInfo.baseFont) ||
                        this.findFontAdjustmentByName(fontInfo.fontName);
                    if (customAdjust) {
                        effectiveFontFamily = customAdjust.family || effectiveFontFamily;
                        fontScale = customAdjust.scale || fontScale;
                    }
                }

                measureCtx.font = `${fontSize}px ${effectiveFontFamily}`;

                const measuredFullWidth = measureCtx.measureText(item.str).width || 0;
                const actualFullWidthRaw = textItemRunWidthPx(tx, item, measureCtx, item.str);
                let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
                if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
                    widthScale = 1;
                }
                const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
                const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

                let textWidth = this.measureTextWidthWithMetrics(item.str, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust);

                const itemX = tx[4];
                const itemY = tx[5];

                let textLeft;
                let textRight;
                if (typeof item.width === 'number' && item.width !== 0) {
                    const xEnd = itemX + tx[0] * item.width;
                    textLeft = Math.min(itemX, xEnd);
                    textRight = Math.max(itemX, xEnd);
                } else {
                    textLeft = itemX;
                    textRight = itemX + textWidth;
                }
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
