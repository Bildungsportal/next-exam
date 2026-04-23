import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { textItemRunWidthPx } from '../shared/filters.js';

/** Coalesce split border strokes at nearly the same x so buildRectanglesFromLines sees full-height guides. */
function mergeVerticalLineSegments(verticals, xTol = 4, yGapTol = 10) {
    if (!verticals || verticals.length === 0) return [];
    const sorted = [...verticals].sort((a, b) => a.x - b.x || a.y1 - b.y1);
    const merged = [];
    let cur = {
        x: sorted[0].x,
        y1: sorted[0].y1,
        y2: sorted[0].y2,
        fromRect: !!sorted[0].fromRect,
    };
    for (let i = 1; i < sorted.length; i += 1) {
        const v = sorted[i];
        if (Math.abs(v.x - cur.x) <= xTol) {
            if (v.y1 <= cur.y2 + yGapTol) {
                cur.y2 = Math.max(cur.y2, v.y2);
                cur.y1 = Math.min(cur.y1, v.y1);
                cur.x = (cur.x + v.x) / 2;
                cur.fromRect = cur.fromRect && !!v.fromRect;
            } else {
                merged.push(cur);
                cur = { x: v.x, y1: v.y1, y2: v.y2, fromRect: !!v.fromRect };
            }
        } else {
            merged.push(cur);
            cur = { x: v.x, y1: v.y1, y2: v.y2, fromRect: !!v.fromRect };
        }
    }
    merged.push(cur);
    return merged;
}

// Rectangle and field detection utilities extracted from the PDF parser
export const detectorMethods = {
    /**
     * Decide input type by measured box dimensions.
     * Returns checkbox for small squares, textarea for tall boxes, else text.
     */
    determineBoxType(widthPx, heightPx) {
        const SQUARE_TOLERANCE = 5;
        const MC_BOX_MAX_SIZE = this.MC_BOX_MAX_SIZE ?? 80;
        const isSquare = Math.abs(widthPx - heightPx) <= SQUARE_TOLERANCE;

        // Small squares: standard checkbox (tick)
        if (isSquare && widthPx <= this.CHECKBOX_MAX_SIZE) {
            return 'checkbox';
        }
        // Medium-to-large squares (26-80px): MC answer box filled with slash
        if (isSquare && widthPx > this.CHECKBOX_MAX_SIZE && widthPx <= MC_BOX_MAX_SIZE) {
            return 'deselect';
        }
        // Tall rectangles: textarea
        if (heightPx > 35) {
            return 'textarea';
        }
        return 'text';
    },

    /**
     * Transform PDF rectangle to viewport coordinates and append as box field.
     */
    addBox(rawX, rawY, rawW, rawH, matrix, viewport, boxFields) {
        const p1 = { x: rawX, y: rawY };
        const p2 = { x: rawX + rawW, y: rawY + rawH };

        const tx1 = matrix[0] * p1.x + matrix[2] * p1.y + matrix[4];
        const ty1 = matrix[1] * p1.x + matrix[3] * p1.y + matrix[5];
        const tx2 = matrix[0] * p2.x + matrix[2] * p2.y + matrix[4];
        const ty2 = matrix[1] * p2.x + matrix[3] * p2.y + matrix[5];

        const pdfRect = [Math.min(tx1, tx2), Math.min(ty1, ty2), Math.max(tx1, tx2), Math.max(ty1, ty2)];
        this.addBoxFromPdfRect(pdfRect, viewport, boxFields);
    },

    /**
     * Check if a path is closed (first≈last point).
     */
    isPathClosed(points) {
        if (points.length < 3) return false;
        const first = points[0];
        const last = points[points.length - 1];
        const distance = Math.hypot(last.x - first.x, last.y - first.y);
        return distance < 2.0;
    },

  /**
   * Convert closed path points to a bounding box and add it.
   */
  processPathPoints(points, matrix, viewport, boxFields) {
    const pdfPoints = points.map((p) => ({
      x: matrix[0] * p.x + matrix[2] * p.y + matrix[4],
      y: matrix[1] * p.x + matrix[3] * p.y + matrix[5],
    }));

    const xs = pdfPoints.map((p) => p.x);
    const ys = pdfPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Reject paths that are too small to be interactive fields (glyph outlines, decorations).
    // Real checkboxes are typically ≥8 PDF units; letter glyphs are 2–7 units.
    const MIN_PATH_PDF_UNITS = 8;
    if ((maxX - minX) < MIN_PATH_PDF_UNITS || (maxY - minY) < MIN_PATH_PDF_UNITS) {
      return;
    }

    this.addBoxFromPdfRect([minX, minY, maxX, maxY], viewport, boxFields, true);
  },

  /**
   * Add box from PDF rect, applying size thresholds and type hints.
   */
  addBoxFromPdfRect(pdfRect, viewport, boxFields, skipSmallCheck = false, typeHint = null, isTableCell = false) {
    const [minX, minY, maxX, maxY] = pdfRect;
    const width = maxX - minX;
    const height = maxY - minY;

    if (!skipSmallCheck && (width < this.MIN_SIZE_PDF_UNITS || height < this.MIN_SIZE_PDF_UNITS)) {
      return;
    }

    const vRect = viewport.convertToViewportRectangle([minX, minY, maxX, maxY]);
    const cssX = Math.min(vRect[0], vRect[2]);
    const cssY = Math.min(vRect[1], vRect[3]);
    const cssW = Math.abs(vRect[2] - vRect[0]);
    const cssH = Math.abs(vRect[3] - vRect[1]);

    if (cssW < 10 || cssH < 10) return;
    if (cssW > viewport.width * 0.95 && cssH > viewport.height * 0.95) return;

    let inputType = typeHint || this.determineBoxType(cssW, cssH);

    if (inputType === 'textarea' && cssH <= this.SINGLE_LINE_TEXTAREA_MAX_HEIGHT) {
      inputType = 'text';
    }

    // Reconstructed table cells are single-line inputs regardless of height.
    if (isTableCell && inputType === 'textarea') {
      inputType = 'text';
    }

    // Normalize checkbox size to a minimum of 18x18px.
    // The drawn path is often a sub-element of the visible checkbox (e.g. inner
    // fill area), so we expand outward from the center.
    let finalX = cssX;
    let finalY = cssY;
    let finalW = cssW;
    let finalH = cssH;
    if (inputType === 'checkbox' || inputType === 'deselect') {
      const MIN_CB = 18;
      const centerX = cssX + cssW / 2;
      const centerY = cssY + cssH / 2;
      finalW = Math.max(cssW, MIN_CB);
      finalH = Math.max(cssH, MIN_CB);
      finalX = centerX - finalW / 2;
      finalY = centerY - finalH / 2;
    }

    boxFields.push({
      id: this.generateElementId('box'),
      type: inputType,
      isTextarea: inputType === 'textarea',
      isTableCell,
      style: {
        position: 'absolute',
        left: `${finalX}px`,
        top: `${finalY}px`,
        width: `${finalW}px`,
        height: `${finalH}px`,
        zIndex: 5,
      },
    });
  },

  /**
   * Apply current transformation matrix to a point.
   */
  transformPoint(x, y, matrix) {
    return {
      x: matrix[0] * x + matrix[2] * y + matrix[4],
      y: matrix[1] * x + matrix[3] * y + matrix[5],
    };
  },

  /**
   * Collect line segments and direct rectangles from path operations.
   */
  processLinePathForRectangles(ops, data, ctm, viewport, boxFields, lineStore) {
    let dIndex = 0;
    let currentX = 0;
    let currentY = 0;
    const segments = [];

    for (let j = 0; j < ops.length; j += 1) {
      const op = ops[j];
      if (op === this.OP_CODE.moveTo) {
        currentX = data[dIndex];
        currentY = data[dIndex + 1];
        dIndex += 2;
      } else if (op === this.OP_CODE.lineTo) {
        const nextX = data[dIndex];
        const nextY = data[dIndex + 1];
        const start = this.transformPoint(currentX, currentY, ctm);
        const end = this.transformPoint(nextX, nextY, ctm);
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (length >= this.MIN_SIZE_PDF_UNITS) {
          segments.push({ p1: start, p2: end });
        }
        currentX = nextX;
        currentY = nextY;
        dIndex += 2;
      } else if (op === this.OP_CODE.rectangle) {
        // addBox already runs in extractBoxFields inner loop — skip duplicate (constructPath).
        dIndex += 4;
      } else if (op === this.OP_CODE.curveTo) {
        // curveTo: skip 6 values (3 points), update current position to endpoint
        currentX = data[dIndex + 4];
        currentY = data[dIndex + 5];
        dIndex += 6;
      } else if (op === this.OP_CODE.curveTo2 || op === this.OP_CODE.curveTo3) {
        // curveTo1/curveTo2: skip 4 values
        currentX = data[dIndex + 2];
        currentY = data[dIndex + 3];
        dIndex += 4;
      }
    }

    const AXIS_TOLERANCE = 3.0;
    const MIN_LINE_LENGTH = this.MIN_SIZE_PDF_UNITS;

    const horizontals = segments.filter((seg) => Math.abs(seg.p1.y - seg.p2.y) <= AXIS_TOLERANCE);
    const verticals = segments.filter((seg) => Math.abs(seg.p1.x - seg.p2.x) <= AXIS_TOLERANCE);

    horizontals.forEach((seg) => {
      const x1 = Math.min(seg.p1.x, seg.p2.x);
      const x2 = Math.max(seg.p1.x, seg.p2.x);
      const y = (seg.p1.y + seg.p2.y) / 2;
      if (x2 - x1 >= MIN_LINE_LENGTH) {
        lineStore.hLines.push({ x1, x2, y });
      }
    });

    verticals.forEach((seg) => {
      const y1 = Math.min(seg.p1.y, seg.p2.y);
      const y2 = Math.max(seg.p1.y, seg.p2.y);
      const x = (seg.p1.x + seg.p2.x) / 2;
      if (y2 - y1 >= MIN_LINE_LENGTH) {
        lineStore.vLines.push({ y1, y2, x });
      }
    });
  },

  /**
   * Find intersection corner between horizontal and vertical line within tolerance.
   */
  findCorner(hLine, vLine, tolerance) {
    const pointsH = [hLine.p1, hLine.p2];
    const pointsV = [vLine.p1, vLine.p2];
    for (const hp of pointsH) {
      for (const vp of pointsV) {
        if (Math.abs(hp.x - vp.x) <= tolerance && Math.abs(hp.y - vp.y) <= tolerance) {
          return hp;
        }
      }
    }
    return null;
  },

  /**
   * Build rectangles (table cells) from collected horizontal/vertical lines.
   */
  buildRectanglesFromLines(lineStore, viewport, boxFields) {
    const horizontals = lineStore.hLines;
    const verticals = mergeVerticalLineSegments(lineStore.vLines);
    if (!horizontals.length || !verticals.length) {
      return;
    }

    const tol = 5;
    const minSpan = this.MIN_SIZE_PDF_UNITS;
    let added = 0;
    let skippedTooSmall = 0;
    let skippedNoIntersection = 0;

    const normHoriz = horizontals.sort((a, b) => a.y - b.y);
    const normVert = verticals.sort((a, b) => a.x - b.x);

    // Adjacent horizontal bands only — C(n,2) pairs span whole tables and create phantom isTableCell hulls.
    for (let i = 0; i < normHoriz.length - 1; i += 1) {
      const j = i + 1;
        const topLine = normHoriz[i];
        const bottomLine = normHoriz[j];
        const cellTop = topLine.y;
        const cellBottom = bottomLine.y;
        const height = cellBottom - cellTop;

        if (height < minSpan) {
          skippedTooSmall += 1;
          continue;
        }

        const leftBound = Math.max(topLine.x1, bottomLine.x1);
        const rightBound = Math.min(topLine.x2, bottomLine.x2);

        if (leftBound >= rightBound) {
          skippedNoIntersection += 1;
          continue;
        }

        const cellH = Math.max(cellBottom - cellTop, 1e-6);
        const intersectingVerticals = normVert.filter((v) => {
          const spansHeight = v.y1 <= cellTop + tol && v.y2 >= cellBottom - tol;
          const almostSpansHeight =
            (v.y1 <= cellTop + tol * 2 && v.y2 >= cellBottom - tol * 2) ||
            (v.y1 <= cellTop && v.y2 >= cellBottom - tol * 3);
          const overlapV = Math.max(0, Math.min(v.y2, cellBottom + tol) - Math.max(v.y1, cellTop - tol));
          const looseSpan = overlapV / cellH >= 0.62;
          const crossesBand = v.y1 < cellBottom - tol && v.y2 > cellTop + tol;
          const inRange = v.x >= leftBound - tol && v.x <= rightBound + tol;
          return (spansHeight || almostSpansHeight || (looseSpan && crossesBand)) && inRange;
        });

        if (intersectingVerticals.length < 2) {
          skippedNoIntersection += 1;
          continue;
        }

        // Build only cells between ADJACENT x-sorted verticals (k,k+1).
        // Using all pairs C(V,2) generates spanning phantom hulls over real cells.
        const vSorted = [...intersectingVerticals].sort((a, b) => a.x - b.x);
        for (let k = 0; k < vSorted.length - 1; k += 1) {
          const leftVert = vSorted[k];
          const rightVert = vSorted[k + 1];
          const cellLeft = leftVert.x;
          const cellRight = rightVert.x;
          const width = cellRight - cellLeft;

          if (width < minSpan) {
            skippedTooSmall += 1;
            continue;
          }

          const rectLeft = Math.max(cellLeft, leftBound);
          const rectRight = Math.min(cellRight, rightBound);
          const rectWidth = rectRight - rectLeft;

          if (rectWidth < minSpan) {
            skippedTooSmall += 1;
            continue;
          }

          const pdfRect = [rectLeft, cellTop, rectRight, cellBottom];
          this.addBoxFromPdfRect(pdfRect, viewport, boxFields, false, null, true);
          added += 1;
        }
    }

    if (this.enableLogging && this.debugBoxExtraction) {
      console.log(
        `pdfparser @ buildRectanglesFromLines: ${horizontals.length} horizontal lines, ${verticals.length} vertical lines`,
      );
      console.log(
        `pdfparser @ buildRectanglesFromLines: constructed ${added} rectangles, skipped ${skippedTooSmall} too small, ${skippedNoIntersection} no intersection`,
      );
    }
  },

  /**
   * Extract drawn rectangles and tables from a page (operator analysis + line assembly).
   */
  async extractBoxFields(page, viewport) {
    const boxFields = [];
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    const lineStore = { hLines: [], vLines: [] };

    let ctm = [1, 0, 0, 1, 0, 0];
    const transformStack = [];

    for (let i = 0; i < opList.fnArray.length; i += 1) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        transformStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        if (transformStack.length) ctm = transformStack.pop();
      } else if (fn === OPS.transform) {
        const [a, b, c, d, e, f] = args;
        const [a1, b1, c1, d1, e1, f1] = ctm;
        ctm = [
          a1 * a + c1 * b,
          b1 * a + d1 * b,
          a1 * c + c1 * d,
          b1 * c + d1 * d,
          a1 * e + c1 * f + e1,
          b1 * e + d1 * f + f1,
        ];
      } else if (fn === OPS.rectangle) {
        this.addBox(args[0], args[1], args[2], args[3], ctm, viewport, boxFields);
      } else if (fn === OPS.constructPath) {
        const ops = args[0];
        const data = args[1];
        if (!Array.isArray(ops) || !Array.isArray(data)) continue;
        let dIndex = 0;
        let pathPoints = [];

        for (let j = 0; j < ops.length; j += 1) {
          const op = ops[j];
          if (op === this.OP_CODE.rectangle) {
            this.addBox(data[dIndex], data[dIndex + 1], data[dIndex + 2], data[dIndex + 3], ctm, viewport, boxFields);
            dIndex += 4;
          } else if (op === this.OP_CODE.moveTo) {
            if (pathPoints.length > 2 && this.isPathClosed(pathPoints)) {
              this.processPathPoints(pathPoints, ctm, viewport, boxFields);
            }
            pathPoints = [{ x: data[dIndex], y: data[dIndex + 1] }];
            dIndex += 2;
          } else if (op === this.OP_CODE.lineTo) {
            pathPoints.push({ x: data[dIndex], y: data[dIndex + 1] });
            dIndex += 2;
          } else if (op === this.OP_CODE.curveTo) {
            dIndex += 6;
          } else if (op === this.OP_CODE.curveTo2 || op === this.OP_CODE.curveTo3) {
            dIndex += 4;
          }
        }
        if (pathPoints.length > 2 && this.isPathClosed(pathPoints)) {
          this.processPathPoints(pathPoints, ctm, viewport, boxFields);
        }

        const hasPathLineTo = ops.some((op) => op === this.OP_CODE.lineTo);
        if (hasPathLineTo) {
          this.processLinePathForRectangles(ops, data, ctm, viewport, boxFields, lineStore);
        }
      }
    }

    this.buildRectanglesFromLines(lineStore, viewport, boxFields);

    const byType = boxFields.reduce((acc, box) => {
      const next = acc;
      next[box.type] = (next[box.type] || 0) + 1;
      return next;
    }, {});
    if (this.enableLogging && this.debugBoxExtraction) {
      console.log(`Page: Found ${boxFields.length} total boxes via robust coord calculation:`, byType);
    }

    return boxFields;
  },

  /**
   * Extract PDF form widgets (AcroForms) from annotations.
   */
  extractFormFields(page, viewport, pageNum) {
    return page.getAnnotations().then((annotations) =>
      annotations
        .filter((ann) => ann.subtype === 'Widget')
        .map((ann) => {
          const rect = viewport.convertToViewportRectangle(ann.rect);
          const width = Math.abs(rect[2] - rect[0]);
          const height = Math.abs(rect[3] - rect[1]);
          const left = Math.min(rect[0], rect[2]);
          const top = Math.min(rect[1], rect[3]);

          const isCheckbox = ann.checkBox || ann.fieldType === 'Btn';
          const isTextarea = height > width * 1.5 || (ann.fieldType === 'Tx' && height > 50);

          return {
            id: this.generateElementId('form'),
            type: isCheckbox ? 'checkbox' : isTextarea ? 'textarea' : 'text',
            name: ann.fieldName || `field_${pageNum}_${ann.id}`,
            value: ann.fieldValue || '',
            checked: isCheckbox && ann.buttonValue === 'Yes',
            style: {
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              zIndex: 10,
            },
          };
        }),
    );
  },

  /**
   * Detect cloze fields (underscores/dots) and Unicode checkboxes on a page.
   */
  async extractClozeFields(page, viewport, knownBoxRects = [], cachedTextContent = null, tableCellRects = []) {
    const textContent = cachedTextContent ?? await page.getTextContent();
    const clozeFields = [];

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    textContent.items.forEach((item) => {
      const text = item.str;
      if (!text) return;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const itemX = tx[4];
      const itemY = tx[5];

      const fontName = item.fontName;
      const fontStyle = textContent.styles[fontName];
      const baseFontFamily = fontStyle ? fontStyle.fontFamily : 'sans-serif';
      const fontInfo = this.getFontInfo(page, fontName);
      let effectiveFontFamily = baseFontFamily;
      let fontScale = 1;
      let customAdjust = null;
      if (fontInfo) {
        customAdjust =
          this.findFontAdjustmentByName(fontInfo.baseFont) || this.findFontAdjustmentByName(fontInfo.fontName);
        if (customAdjust) {
          if (customAdjust.family) {
            effectiveFontFamily = customAdjust.family;
          }
          if (typeof customAdjust.scale === 'number') {
            fontScale = customAdjust.scale;
          }
        } else if (this.enableLogging && this.debugClozeFonts) {
          console.log(`pdfparser @ font adjustment not found:`, {
            baseFont: fontInfo.baseFont,
            fontName: fontInfo.fontName,
            family: fontInfo.family,
            currentEffectiveFont: effectiveFontFamily,
          });
        }
      }
      measureCtx.font = `${fontSize}px ${effectiveFontFamily}`;

      const measuredFullWidth = measureCtx.measureText(text).width || 0;
      const actualFullWidthRaw = textItemRunWidthPx(tx, item, measureCtx, text);
      let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
      if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
        widthScale = 1;
      }

      const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
      const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

      // When the font has no adjustment entry, canvas measurements use the wrong
      // substitute font → positions drift.  Use item.width (PDF-native, always
      // reliable) to interpolate substring widths proportionally instead.
      const knownFont = !!customAdjust;
      const itemWidthPdf = typeof item.width === 'number' ? actualFullWidthRaw : null;

      const measureSubstringWidth = (subText) => {
        if (knownFont || !itemWidthPdf || !text.length) {
          return this.measureTextWidthWithMetrics(subText, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust);
        }
        // Proportional split: measure relative widths with canvas (font shape
        // may be wrong but proportions within the same font are consistent),
        // then scale to the known total width from the PDF stream.
        const measuredTotal = measureCtx.measureText(text).width || 1;
        const measuredSub   = measureCtx.measureText(subText).width || 0;
        return itemWidthPdf * (measuredSub / measuredTotal);
      };

      if (this.detectUnderscores) {
        const regex = /(_+)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
          const underscoreStr = match[0];
          const startIndex = match.index;
          const prefixText = text.substring(0, startIndex);
          const prefixWidth = measureSubstringWidth(prefixText);
          const underscoreWidth = measureSubstringWidth(underscoreStr);
          if (underscoreWidth < 12) continue;
          const finalX = itemX + prefixWidth;

          clozeFields.push({
            id: this.generateElementId('cloze'),
            type: 'text',
            style: {
              position: 'absolute',
              left: `${finalX}px`,
              top: `${itemY - fontSize}px`,
              width: `${underscoreWidth}px`,
              height: `${fontSize + 2}px`,
              zIndex: 10,
            },
          });
        }
      }

      if (this.detectDots) {
        const dotRegex = /([.…]+)/g;
        let dotMatch;
        let lastIndex = 0;

        while ((dotMatch = dotRegex.exec(text)) !== null) {
          const dotStr = dotMatch[0];
          const startIndex = dotMatch.index;
          if (startIndex < lastIndex) {
            continue;
          }

          let totalDotCount = 0;
          for (let i = 0; i < dotStr.length; i += 1) {
            if (dotStr[i] === '.') totalDotCount += 1;
            else if (dotStr[i] === '…') totalDotCount += 3;
          }

          if ((totalDotCount === 3 && dotStr === '...') || (totalDotCount === 3 && dotStr === '…')) {
            lastIndex = startIndex + dotStr.length;
            continue;
          }
          if (totalDotCount < 4) {
            lastIndex = startIndex + dotStr.length;
            continue;
          }

          // Reject table-of-contents patterns:
          // "Kapitel 1...." → letter/digit directly before dots (no space)
          const charBeforeDots = startIndex > 0 ? text[startIndex - 1] : '';
          if (/[A-Za-z0-9]/.test(charBeforeDots)) {
            lastIndex = startIndex + dotStr.length;
            continue;
          }
          // ".... 12" or "....12" → page number directly after dots
          const afterDots = text.substring(startIndex + dotStr.length, startIndex + dotStr.length + 6);
          if (/^\s*\d+\s*$/.test(afterDots)) {
            lastIndex = startIndex + dotStr.length;
            continue;
          }

          const prefixText = text.substring(0, startIndex);
          const prefixWidth = measureSubstringWidth(prefixText);
          const dotWidth = measureSubstringWidth(dotStr);
          if (dotWidth < 12) {
            lastIndex = startIndex + dotStr.length;
            continue;
          }
          const finalX = itemX + prefixWidth;

          clozeFields.push({
            id: this.generateElementId('cloze'),
            type: 'text',
            style: {
              position: 'absolute',
              left: `${finalX}px`,
              top: `${itemY - fontSize}px`,
              width: `${dotWidth}px`,
              height: `${fontSize + 2}px`,
              zIndex: 10,
            },
          });

          lastIndex = startIndex + dotStr.length;
        }
      }

      if (this.detectCheckboxes && (text.includes('☐') || text.includes('☑') || text.includes('☒'))) {
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] === '☐' || text[i] === '☑' || text[i] === '☒') {
            const prefixText = text.substring(0, i);
            const prefixWidth = measureSubstringWidth(prefixText);

            clozeFields.push({
              id: this.generateElementId('cloze'),
              type: 'checkbox',
              checked: text[i] === '☑' || text[i] === '☒',
              style: {
                position: 'absolute',
                left: `${itemX + prefixWidth}px`,
                top: `${itemY - fontSize}px`,
                width: `${fontSize}px`,
                height: `${fontSize}px`,
                zIndex: 10,
              },
            });
          }
        }
      }
    });

    if (this.detectDeselectFields) {
      const deselectFields = await this.extractDeselectFields(page, viewport);
      clozeFields.push(...deselectFields);
    }

    if (this.detectIsolatedLines) {
      const isolatedLineFields = await this.findIsolatedHorizontalLines(page, viewport, knownBoxRects, tableCellRects);
      clozeFields.push(...isolatedLineFields);
    }

    return clozeFields;
  },

  // Detect isolated horizontal lines as cloze fields
  /**
   * Detect isolated horizontal lines and convert them to cloze fields.
   */
  async findIsolatedHorizontalLines(page, viewport, knownBoxRects = [], tableCellRects = []) {
    const clozeFields = [];
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    const hLines = [];
    const vLines = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const transformStack = [];

    for (let i = 0; i < opList.fnArray.length; i += 1) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) transformStack.push([...ctm]);
      else if (fn === OPS.restore && transformStack.length) ctm = transformStack.pop();
      else if (fn === OPS.transform) {
        const [a, b, c, d, e, f] = args;
        const [a1, b1, c1, d1, e1, f1] = ctm;
        ctm = [a1 * a + c1 * b, b1 * a + d1 * b, a1 * c + c1 * d, b1 * c + d1 * d, a1 * e + c1 * f + e1, b1 * e + d1 * f + f1];
      } else if (fn === OPS.constructPath) {
        const ops = args[0];
        const data = args[1];
        if (!Array.isArray(ops) || !Array.isArray(data)) continue;
        let dIndex = 0;
        let currentX = 0;
        let currentY = 0;
        for (let j = 0; j < ops.length; j += 1) {
          const op = ops[j];
          if (op === this.OP_CODE.moveTo) {
            currentX = data[dIndex];
            currentY = data[dIndex + 1];
            dIndex += 2;
          } else if (op === this.OP_CODE.lineTo) {
            const nextX = data[dIndex];
            const nextY = data[dIndex + 1];
            const start = this.transformPoint(currentX, currentY, ctm);
            const end = this.transformPoint(nextX, nextY, ctm);
            const dx = Math.abs(end.x - start.x);
            const dy = Math.abs(end.y - start.y);

            if (dy <= 3.0 && dx >= 10) {
              const x1 = Math.min(start.x, end.x);
              const x2 = Math.max(start.x, end.x);
              const y = (start.y + end.y) / 2;
              const pdfRect = [x1, y - 0.5, x2, y + 0.5];
              const vRect = viewport.convertToViewportRectangle(pdfRect);
              const vX1 = Math.min(vRect[0], vRect[2]);
              const vX2 = Math.max(vRect[0], vRect[2]);
              const vY = (Math.min(vRect[1], vRect[3]) + Math.max(vRect[1], vRect[3])) / 2;
              hLines.push({ x1: vX1, x2: vX2, y: vY });
            } else if (dx <= 3.0 && dy >= 10) {
              const y1 = Math.min(start.y, end.y);
              const y2 = Math.max(start.y, end.y);
              const x = (start.x + end.x) / 2;
              const pdfRect = [x - 0.5, y1, x + 0.5, y2];
              const vRect = viewport.convertToViewportRectangle(pdfRect);
              const vY1 = Math.min(vRect[1], vRect[3]);
              const vY2 = Math.max(vRect[1], vRect[3]);
              const vX = (Math.min(vRect[0], vRect[2]) + Math.max(vRect[0], vRect[2])) / 2;
              vLines.push({ x: vX, y1: vY1, y2: vY2 });
            }
            currentX = nextX;
            currentY = nextY;
            dIndex += 2;
          } else if (op === this.OP_CODE.rectangle) {
            // Synthesize all 4 edges of the rectangle so its top/bottom edges
            // are never mistaken for isolated horizontal lines
            const rx = data[dIndex];
            const ry = data[dIndex + 1];
            const rw = data[dIndex + 2];
            const rh = data[dIndex + 3];
            dIndex += 4;

            const tl = this.transformPoint(rx,      ry,      ctm);
            const tr = this.transformPoint(rx + rw, ry,      ctm);
            const bl = this.transformPoint(rx,      ry + rh, ctm);
            const br = this.transformPoint(rx + rw, ry + rh, ctm);

            const toVp = (p1, p2) => viewport.convertToViewportRectangle([
              Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
              Math.max(p1.x, p2.x), Math.max(p1.y, p2.y),
            ]);

            // top and bottom horizontal edges
            const topR = toVp(tl, tr);
            hLines.push({ x1: Math.min(topR[0], topR[2]), x2: Math.max(topR[0], topR[2]), y: (topR[1] + topR[3]) / 2, fromRect: true });
            const botR = toVp(bl, br);
            hLines.push({ x1: Math.min(botR[0], botR[2]), x2: Math.max(botR[0], botR[2]), y: (botR[1] + botR[3]) / 2, fromRect: true });

            // left and right vertical edges
            const leftR = toVp(tl, bl);
            vLines.push({ x: (leftR[0] + leftR[2]) / 2, y1: Math.min(leftR[1], leftR[3]), y2: Math.max(leftR[1], leftR[3]), fromRect: true });
            const rightR = toVp(tr, br);
            vLines.push({ x: (rightR[0] + rightR[2]) / 2, y1: Math.min(rightR[1], rightR[3]), y2: Math.max(rightR[1], rightR[3]), fromRect: true });
          } else if (op === this.OP_CODE.curveTo) {
            currentX = data[dIndex + 4];
            currentY = data[dIndex + 5];
            dIndex += 6;
          } else if (op === this.OP_CODE.curveTo2 || op === this.OP_CODE.curveTo3) {
            currentX = data[dIndex + 2];
            currentY = data[dIndex + 3];
            dIndex += 4;
          }
        }
      }
    }

    const Y_TOLERANCE = 2;
    const MIN_X_DISTANCE = 20;
    const VERTICAL_PROXIMITY = 5;

    const isolatedLines = hLines.filter((line) => {
      // Lines that were synthesized from rectangle opcodes are never isolated
      if (line.fromRect) return false;

      const hasNearbyHLine = hLines.some((otherLine) => {
        if (line === otherLine) return false;
        const yDistance = Math.abs(line.y - otherLine.y);
        if (yDistance > Y_TOLERANCE) return false;
        const lineLeft = line.x1;
        const lineRight = line.x2;
        const otherLeft = otherLine.x1;
        const otherRight = otherLine.x2;
        const overlap = !(lineRight < otherLeft || lineLeft > otherRight);
        let minXDistance;
        if (overlap) {
          minXDistance = 0;
        } else if (lineRight < otherLeft) {
          minXDistance = otherLeft - lineRight;
        } else {
          minXDistance = lineLeft - otherRight;
        }
        return overlap || minXDistance < MIN_X_DISTANCE;
      });

      if (hasNearbyHLine) return false;

      const hasNearbyVLine = vLines.some((vLine) => {
        const vLineInRange = vLine.x >= line.x1 - VERTICAL_PROXIMITY && vLine.x <= line.x2 + VERTICAL_PROXIMITY;
        if (!vLineInRange) return false;
        const yDistance = Math.abs(vLine.y1 - line.y);
        const yDistance2 = Math.abs(vLine.y2 - line.y);
        const minYDistance = Math.min(yDistance, yDistance2);
        const crossesY =
          (vLine.y1 <= line.y && vLine.y2 >= line.y) || (vLine.y2 <= line.y && vLine.y1 >= line.y);
        return crossesY || minYDistance <= VERTICAL_PROXIMITY;
      });

      if (hasNearbyVLine) return false;

      // Third guard: reject lines that match the top or bottom edge of a known box field
      const isBoxEdge = knownBoxRects.some((rect) => {
        const xOverlap = line.x1 >= rect.left - 6 && line.x2 <= rect.right + 6;
        const onTopEdge    = Math.abs(line.y - rect.top) <= 4;
        const onBottomEdge = Math.abs(line.y - (rect.top + rect.height)) <= 4;
        return xOverlap && (onTopEdge || onBottomEdge);
      });
      if (isBoxEdge) return false;

      // Fourth guard: reject lines that sit inside a reconstructed table cell
      // (cell borders/separators), not page-wide suppression.
      const midX = (line.x1 + line.x2) / 2;
      const inTableCell = tableCellRects.some((rect) => {
        const right = rect.right ?? (rect.left + rect.width);
        const bottom = rect.bottom ?? (rect.top + rect.height);
        return midX >= rect.left - 2 && midX <= right + 2 && line.y >= rect.top - 2 && line.y <= bottom + 2;
      });
      if (inTableCell) return false;

      return true;
    });

    isolatedLines.forEach((line) => {
      const lineWidth = line.x2 - line.x1;
      if (lineWidth < 22) return;
      const fontSize = 18;

      clozeFields.push({
        id: this.generateElementId('cloze'),
        type: 'text',
        style: {
          position: 'absolute',
          left: `${line.x1}px`,
          top: `${line.y - fontSize - 2}px`,
          width: `${lineWidth}px`,
          height: `${fontSize}px`,
          zIndex: 10,
        },
      });
    });

    return clozeFields;
  },

  // Detect standalone capital letters as deselect fields
  /**
   * Detect standalone capital letters and create deselect (checkbox) fields.
   */
  async extractDeselectFields(page, viewport) {
    const textContent = await page.getTextContent();
    const deselectFields = [];
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    textContent.items.forEach((item) => {
      const text = item.str;
      if (!text) return;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const itemX = tx[4];
      const itemY = tx[5];

      const fontName = item.fontName;
      const fontStyle = textContent.styles[fontName];
      const baseFontFamily = fontStyle ? fontStyle.fontFamily : 'sans-serif';
      const fontInfo = this.getFontInfo(page, fontName);
      let effectiveFontFamily = baseFontFamily;
      let fontScale = 1;
      let customAdjust = null;
      if (fontInfo) {
        customAdjust =
          this.findFontAdjustmentByName(fontInfo.baseFont) || this.findFontAdjustmentByName(fontInfo.fontName);
        if (customAdjust) {
          if (customAdjust.family) {
            effectiveFontFamily = customAdjust.family;
          }
          if (typeof customAdjust.scale === 'number') {
            fontScale = customAdjust.scale;
          }
        }
      }
      measureCtx.font = `${fontSize}px ${effectiveFontFamily}`;

      const measuredFullWidth = measureCtx.measureText(text).width || 0;
      const actualFullWidthRaw = textItemRunWidthPx(tx, item, measureCtx, text);
      let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
      if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
        widthScale = 1;
      }

      const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
      const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

      // Proportional substring measurement (same logic as extractClozeFields)
      const knownFontD = !!customAdjust;
      const itemWidthPdfD = typeof item.width === 'number' ? actualFullWidthRaw : null;
      const measureSubstringWidthD = (subText) => {
        if (knownFontD || !itemWidthPdfD || !text.length) {
          return this.measureTextWidthWithMetrics(subText, measureCtx, fontSize, useScale, widthScale, fontScale, customAdjust);
        }
        const measuredTotal = measureCtx.measureText(text).width || 1;
        const measuredSub   = measureCtx.measureText(subText).width || 0;
        return itemWidthPdfD * (measuredSub / measuredTotal);
      };

      // Only A-F are valid MC answer labels; wider alphabet causes too many false positives
      const capitalLetterRegex = /(?<![A-Za-z])([A-F])(?![A-Za-z0-9])/g;
      let capitalMatch;

      // Pre-scan: how many isolated A-F tokens exist in this text item?
      // Two or more is a strong signal that this is a genuine MC row.
      const mcTokens = [...text.matchAll(/(?<![A-Za-z])([A-F])(?![A-Za-z0-9])/g)].map(m => m[1]);
      const uniqueMcTokens = new Set(mcTokens);
      const isMcRow = uniqueMcTokens.size >= 2;

      while ((capitalMatch = capitalLetterRegex.exec(text)) !== null) {
        const letter = capitalMatch[1];
        const startIndex = capitalMatch.index;

        // Must not be followed by letters or digits (already in regex, belt-and-suspenders)
        const nextChar = text[startIndex + 1];
        if (nextChar && /[A-Za-z0-9]/.test(nextChar)) continue;

        // Must not be preceded by a letter (already in regex)
        const prevChar = startIndex > 0 ? text[startIndex - 1] : '';
        if (/[A-Za-z]/.test(prevChar)) continue;

        // Reject sentence-start: capital letter after ". " or at position 0 of a long sentence
        const before5 = text.substring(Math.max(0, startIndex - 5), startIndex);
        const afterSentenceEnd = /[.!?]\s+$/.test(before5);
        if (afterSentenceEnd && !isMcRow) continue;

        // Require at least one MC-like context clue when not a clear MC row:
        // letter is alone in the item, or surrounded by MC punctuation (.) () :
        if (!isMcRow) {
          const after3 = text.substring(startIndex + 1, startIndex + 4);
          const hasMcPunctAfter  = /^[\s.\):,]/.test(after3) || startIndex + 1 >= text.length;
          const hasMcPunctBefore = startIndex === 0 || /[\s.\):(]$/.test(before5);
          if (!hasMcPunctAfter || !hasMcPunctBefore) continue;
        }

        const prefixText = text.substring(0, startIndex);
        const prefixWidth = measureSubstringWidthD(prefixText);
        const letterWidth = measureSubstringWidthD(letter);

        const checkboxSize = fontSize * 1.1;
        const checkboxLeft = itemX + prefixWidth - (checkboxSize - letterWidth) / 2;
        const checkboxTop = itemY - fontSize - (checkboxSize - fontSize) / 2 + 2;

        deselectFields.push({
          id: this.generateElementId('deselect'),
          type: 'deselect',
          style: {
            position: 'absolute',
            left: `${checkboxLeft}px`,
            top: `${checkboxTop}px`,
            width: `${checkboxSize}px`,
            height: `${checkboxSize}px`,
            zIndex: 20,
          },
        });
      }
    });

    return deselectFields;
  },

  /**
   * Detect page text rotation (90/-90) by sampling text item transforms.
   */
  async detectTextRotation(page, viewport) {
    const pageIsPortrait = viewport.width < viewport.height;
    if (!pageIsPortrait) return null;

    try {
      const textContent = await page.getTextContent();
      if (!textContent.items || textContent.items.length < 3) return null;

      let rotated90Count = 0;
      let rotated270Count = 0;
      let totalTextItems = 0;

      textContent.items.forEach((item) => {
        if (!item.str || item.str.trim().length === 0) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const a = tx[0];
        const b = tx[1];
        const angle = Math.atan2(b, a) * (180 / Math.PI);
        const normalizedAngle = ((angle % 360) + 360) % 360;

        if (normalizedAngle >= 80 && normalizedAngle <= 100) {
          rotated90Count += 1;
        } else if (normalizedAngle >= 260 && normalizedAngle <= 280) {
          rotated270Count += 1;
        }
        totalTextItems += 1;
      });

      const totalRotated = rotated90Count + rotated270Count;
      if (totalTextItems > 0 && totalRotated / totalTextItems > 0.3) {
        if (rotated90Count > rotated270Count) {
          return -90;
        }
        return 90;
      }

      return null;
    } catch (error) {
      if (this.enableLogging) {
        console.warn(`pdfparser @ detectTextRotation: Error analyzing text orientation:`, error);
      }
      return null;
    }
  },
};
