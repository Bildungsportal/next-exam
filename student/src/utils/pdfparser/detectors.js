import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Rectangle and field detection utilities extracted from the PDF parser
export const detectorMethods = {
    /**
     * Decide input type by measured box dimensions.
     * Returns checkbox for small squares, textarea for tall boxes, else text.
     */
    determineBoxType(widthPx, heightPx) {
        const SQUARE_TOLERANCE = 5;
        const isSquare = Math.abs(widthPx - heightPx) <= SQUARE_TOLERANCE;
        if (isSquare && widthPx <= this.CHECKBOX_MAX_SIZE && heightPx <= this.CHECKBOX_MAX_SIZE) {
            return 'checkbox';
        }
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

    if ((inputType === 'textarea' || typeHint === 'textarea') && cssH <= this.SINGLE_LINE_TEXTAREA_MAX_HEIGHT) {
      inputType = 'text';
    }

    boxFields.push({
      id: this.generateElementId('box'),
      type: inputType,
      isTextarea: inputType === 'textarea',
      isTableCell,
      style: {
        position: 'absolute',
        left: `${cssX}px`,
        top: `${cssY}px`,
        width: `${cssW}px`,
        height: `${cssH}px`,
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
        this.addBox(data[dIndex], data[dIndex + 1], data[dIndex + 2], data[dIndex + 3], ctm, viewport, boxFields);
        dIndex += 4;
      } else if (op === 15) {
        dIndex += 6;
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
    const verticals = lineStore.vLines;
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

    for (let i = 0; i < normHoriz.length; i += 1) {
      for (let j = i + 1; j < normHoriz.length; j += 1) {
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

        const intersectingVerticals = normVert.filter((v) => {
          const spansHeight = v.y1 <= cellTop + tol && v.y2 >= cellBottom - tol;
          const almostSpansHeight =
            (v.y1 <= cellTop + tol * 2 && v.y2 >= cellBottom - tol * 2) ||
            (v.y1 <= cellTop && v.y2 >= cellBottom - tol * 3);
          const inRange = v.x >= leftBound - tol && v.x <= rightBound + tol;
          return (spansHeight || almostSpansHeight) && inRange;
        });

        if (intersectingVerticals.length < 2) {
          skippedNoIntersection += 1;
          continue;
        }

        for (let k = 0; k < intersectingVerticals.length; k += 1) {
          for (let l = k + 1; l < intersectingVerticals.length; l += 1) {
            const leftVert = intersectingVerticals[k];
            const rightVert = intersectingVerticals[l];
            const cellLeft = Math.min(leftVert.x, rightVert.x);
            const cellRight = Math.max(leftVert.x, rightVert.x);
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
            this.addBoxFromPdfRect(pdfRect, viewport, boxFields, false, 'textarea', true);
            added += 1;
          }
        }
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
          } else if (op === 15) {
            dIndex += 6;
          }
        }
        if (pathPoints.length > 2 && this.isPathClosed(pathPoints)) {
          this.processPathPoints(pathPoints, ctm, viewport, boxFields);
        }

        this.processLinePathForRectangles(ops, data, ctm, viewport, boxFields, lineStore);
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
  async extractClozeFields(page, viewport) {
    const textContent = await page.getTextContent();
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
      const actualFullWidthRaw = typeof item.width === 'number' ? Math.abs(item.width) : measuredFullWidth;
      let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
      if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
        widthScale = 1;
      }

      const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
      const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

      if (this.detectUnderscores) {
        const regex = /(_+)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
          const underscoreStr = match[0];
          const startIndex = match.index;
          const prefixText = text.substring(0, startIndex);
          const prefixWidth = this.measureTextWidthWithMetrics(
            prefixText,
            measureCtx,
            fontSize,
            useScale,
            widthScale,
            fontScale,
            customAdjust,
          );
          const underscoreWidth = this.measureTextWidthWithMetrics(
            underscoreStr,
            measureCtx,
            fontSize,
            useScale,
            widthScale,
            fontScale,
            customAdjust,
          );
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

          const prefixText = text.substring(0, startIndex);
          const prefixWidth = this.measureTextWidthWithMetrics(
            prefixText,
            measureCtx,
            fontSize,
            useScale,
            widthScale,
            fontScale,
            customAdjust,
          );
          const dotWidth = this.measureTextWidthWithMetrics(
            dotStr,
            measureCtx,
            fontSize,
            useScale,
            widthScale,
            fontScale,
            customAdjust,
          );
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
            const prefixWidth = this.measureTextWidthWithMetrics(
              prefixText,
              measureCtx,
              fontSize,
              useScale,
              widthScale,
              fontScale,
              customAdjust,
            );

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
      const isolatedLineFields = await this.findIsolatedHorizontalLines(page, viewport);
      clozeFields.push(...isolatedLineFields);
    }

    return clozeFields;
  },

  // Detect isolated horizontal lines as cloze fields
  /**
   * Detect isolated horizontal lines and convert them to cloze fields.
   */
  async findIsolatedHorizontalLines(page, viewport) {
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
          } else if (op === this.OP_CODE.rectangle) dIndex += 4;
          else if (op === 15) dIndex += 6;
        }
      }
    }

    const Y_TOLERANCE = 2;
    const MIN_X_DISTANCE = 20;
    const VERTICAL_PROXIMITY = 5;

    const isolatedLines = hLines.filter((line) => {
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

      return !hasNearbyVLine;
    });

    isolatedLines.forEach((line) => {
      const lineWidth = line.x2 - line.x1;
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
      const actualFullWidthRaw = typeof item.width === 'number' ? Math.abs(item.width) : measuredFullWidth;
      let widthScale = measuredFullWidth > 0 ? actualFullWidthRaw / measuredFullWidth : 1;
      if (!Number.isFinite(widthScale) || widthScale <= 0.2 || widthScale >= 3) {
        widthScale = 1;
      }

      const usesExtremeSpacing = typeof item.charSpacing === 'number' && Math.abs(item.charSpacing) > fontSize * 0.2;
      const useScale = usesExtremeSpacing && Math.abs(widthScale - 1) > 0.15;

      const capitalLetterRegex = /(?<![A-Za-z])([A-Z])/g;
      let capitalMatch;

      while ((capitalMatch = capitalLetterRegex.exec(text)) !== null) {
        const letter = capitalMatch[1];
        const startIndex = capitalMatch.index;
        const afterLetter = text.substring(startIndex + 1, startIndex + 3);
        const hasOnlySpacesOrEnd = afterLetter.length === 0 || /^\s{0,2}$/.test(afterLetter);
        const nextChar = text[startIndex + 1];
        const isFollowedByLetter = nextChar && /[A-Za-z]/.test(nextChar);
        if (!hasOnlySpacesOrEnd || isFollowedByLetter) {
          continue;
        }

        const prefixText = text.substring(0, startIndex);
        const prefixWidth = this.measureTextWidthWithMetrics(
          prefixText,
          measureCtx,
          fontSize,
          useScale,
          widthScale,
          fontScale,
          customAdjust,
        );

        const letterWidth = this.measureTextWidthWithMetrics(
          letter,
          measureCtx,
          fontSize,
          useScale,
          widthScale,
          fontScale,
          customAdjust,
        );

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
