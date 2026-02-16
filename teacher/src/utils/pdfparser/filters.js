import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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

        const tolerance = this.DUPLICATE_TOLERANCE_PX;
        const keep = new Array(boxes.length).fill(true);
        const rects = boxes.map((box) => this.getRectFromStyle(box.style));
        let removedDuplicates = 0;
        let removedContainers = 0;

        const contains = (rectA, rectB) =>
            rectB.left >= rectA.left &&
            rectB.right <= rectA.right &&
            rectB.top >= rectA.top &&
            rectB.bottom <= rectA.bottom;

        for (let i = 0; i < boxes.length; i += 1) {
            if (!keep[i]) continue;
            for (let j = i + 1; j < boxes.length; j += 1) {
                if (!keep[j]) continue;
                const ri = rects[i];
                const rj = rects[j];
                const samePos =
                    Math.abs(ri.left - rj.left) <= tolerance &&
                    Math.abs(ri.top - rj.top) <= tolerance;
                const sameSize =
                    Math.abs(ri.width - rj.width) <= tolerance &&
                    Math.abs(ri.height - rj.height) <= tolerance;

                if (samePos && sameSize) {
                    keep[j] = false;
                    removedDuplicates += 1;
                }
            }
        }

        for (let i = 0; i < boxes.length; i += 1) {
            if (!keep[i]) continue;
            const rectI = rects[i];
            const areaI = rectI.area;

            for (let j = 0; j < boxes.length; j += 1) {
                if (i === j || !keep[j]) continue;
                const rectJ = rects[j];
                const areaJ = rectJ.area;

                if (areaI > areaJ && contains(rectI, rectJ)) {
                    keep[i] = false;
                    removedContainers += 1;
                    break;
                }
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
    async filterBoxesWithText(boxFields, page, viewport) {
        if (!boxFields || boxFields.length === 0) return boxFields;

        const textContent = await page.getTextContent();
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

                const textWidth = typeof item.width === 'number' ? Math.abs(item.width) : fontSize * item.str.length * 0.6;
                const textLeft = itemX;
                const textRight = itemX + textWidth;
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
    async filterBoxesWithTextPrecise(boxFields, page, viewport) {
        if (!boxFields || boxFields.length === 0) return boxFields;

        const textContent = await page.getTextContent();
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
                const actualFullWidthRaw = typeof item.width === 'number' ? Math.abs(item.width) : measuredFullWidth;
                let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
                if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
                    widthScale = 1;
                }
                const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
                const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

                let textWidth = this.measureTextWidthWithMetrics(item.str, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust);

                const itemX = tx[4];
                const itemY = tx[5];

                const textLeft = itemX;
                const textRight = itemX + textWidth;
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
