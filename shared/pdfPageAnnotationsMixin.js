/** Shared highlight/underline annotation drawing for PDF page viewers (student+teacher).
 *  Optional component hooks:
 *    - onAnnotationsChange(): called after each push/delete (e.g. student queueSave)
 *    - onAnnotationUndoRestore(prev): called after successful undoAnnotation
 */
/** Ink color for pen strokes and free-text annotations (activesheet + preview). */
export const ANNOTATION_INK_COLOR = '#0a2472';
export const ANNOTATION_INK_STROKE = 'rgba(10, 36, 114, 0.95)';
const DRAW_ANNOTATION_TOOLS = new Set(['highlight-yellow', 'highlight-green', 'highlight-blue', 'highlight-red', 'underline-red', 'pen-red']);

export const pdfPageAnnotationsMixin = {
    data() {
        return {
            tool: null,
            annotationInkColor: ANNOTATION_INK_COLOR,
            annotationInkStroke: ANNOTATION_INK_STROKE,
            isDrawing: false,
            drawStart: null,
            currentDraft: null,
            draftLine: null,
            draftPenPath: null, // { pageIndex, points: [{x,y},...] } während Stift-Zeichnen
            annotations: [],
            annotationUndoStack: [],
            editingTextId: null,
        };
    },
    computed: {
        draftStyle() {
            return this.currentDraft?.style || {};
        },
        canUndoAnnotation() {
            return this.annotationUndoStack.length > 0;
        },
    },
    methods: {
        pushAnnotationUndoSnapshot(extra = {}) {
            this.annotationUndoStack.push({
                annotations: JSON.parse(JSON.stringify(this.annotations)),
                ...extra,
            });
        },
        undoAnnotation() {
            const prev = this.annotationUndoStack.pop();
            if (!prev) return false;
            this.annotations = prev.annotations;
            if (typeof this.onAnnotationUndoRestore === 'function') {
                this.onAnnotationUndoRestore(prev);
            }
            this.notifyAnnotationsChanged();
            return true;
        },
        setTool(tool) {
            if (tool !== this.tool) this.cancelDraw();
            this.tool = tool;
        },
        annotationsForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'highlight');
        },
        underlineForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'underline');
        },
        penForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'pen');
        },
        textForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'text');
        },
        // SVG-polyline points string aus {x,y}[] array
        penPointsAttr(points) {
            return (points || []).map((p) => `${p.x},${p.y}`).join(' ');
        },
        annotationStyle(ann) {
            if (ann.kind !== 'highlight') return {};
            return {
                position: 'absolute',
                left: `${ann.x}px`,
                top: `${ann.y}px`,
                width: `${ann.w}px`,
                height: `${ann.h}px`,
                backgroundColor: ann.color,
                borderRadius: '2px',
                pointerEvents: 'auto',
                cursor: this.tool === 'delete' ? 'pointer' : 'default',
                zIndex: 20,
            };
        },
        textAnnotationStyle(ann) {
            return {
                position: 'absolute',
                left: `${ann.x}px`,
                top: `${ann.y}px`,
                zIndex: 25,
                pointerEvents: 'auto',
                cursor: this.tool === 'delete' ? 'pointer' : 'text',
            };
        },
        // Hidden mirror for text annotation width/height measurement.
        getTextAnnotationMeasureMirror(el) {
            let mirror = document.getElementById('__annTextMeasure__');
            if (!mirror) {
                mirror = document.createElement('div');
                mirror.id = '__annTextMeasure__';
                mirror.setAttribute('aria-hidden', 'true');
                mirror.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;white-space:pre;';
                document.body.appendChild(mirror);
            }
            const cs = getComputedStyle(el);
            mirror.style.font = cs.font;
            mirror.style.fontSize = cs.fontSize;
            mirror.style.fontFamily = cs.fontFamily;
            mirror.style.lineHeight = cs.lineHeight;
            mirror.style.padding = cs.padding;
            mirror.style.border = cs.border;
            mirror.style.boxSizing = cs.boxSizing;
            return mirror;
        },
        // Grow textarea with typed content; cap width at remaining page space.
        syncTextAnnotationInputSize(el, pageIndex) {
            if (!el) return;
            const pageW = this.parsedPages?.[pageIndex]?.width;
            const ann = this.annotations.find((a) => a.id === this.editingTextId);
            const maxW = pageW && ann ? Math.max(80, pageW - ann.x - 8) : 320;
            const mirror = this.getTextAnnotationMeasureMirror(el);
            const cs = getComputedStyle(el);
            const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
            const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
                + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
            const lines = String(el.value ?? '').split('\n');
            const measureLines = lines.length ? lines : [''];

            mirror.style.whiteSpace = 'pre';
            mirror.style.width = 'auto';
            let contentW = 80;
            for (const line of measureLines) {
                mirror.textContent = line || ' ';
                contentW = Math.max(contentW, mirror.offsetWidth + 4);
            }
            const width = Math.min(maxW, contentW);
            const atMaxWidth = contentW >= maxW - 1;

            // While width still grows: height = explicit line breaks only (no wrap jitter).
            let height;
            if (!atMaxWidth) {
                height = Math.ceil(measureLines.length * lineHeight + padY);
            } else {
                mirror.style.whiteSpace = 'pre-wrap';
                mirror.style.wordBreak = 'break-word';
                mirror.style.width = `${width}px`;
                mirror.textContent = el.value || ' ';
                height = Math.ceil(mirror.offsetHeight);
            }

            el.style.maxWidth = `${maxW}px`;
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
        },
        deleteAnnotation(id) {
            this.pushAnnotationUndoSnapshot();
            this.annotations = this.annotations.filter((a) => a.id !== id);
            this.notifyAnnotationsChanged();
        },
        notifyAnnotationsChanged() {
            if (typeof this.onAnnotationsChange === 'function') {
                this.onAnnotationsChange();
            }
        },
        getRelativePoint(event) {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left) / this.zoom;
            const y = (event.clientY - rect.top) / this.zoom;
            return { x, y };
        },
        startDraw(event, pageIndex) {
            if (!DRAW_ANNOTATION_TOOLS.has(this.tool)) return;
            event.preventDefault();
            event.stopPropagation();
            const { x, y } = this.getRelativePoint(event);
            this.isDrawing = true;
            this.drawStart = { x, y, pageIndex };
            if (this.tool === 'pen-red') {
                this.draftPenPath = { pageIndex, points: [{ x, y }] };
            } else if (this.tool === 'underline-red') {
                this.draftLine = { pageIndex, x1: x, y1: y, x2: x, y2: y };
            } else {
                this.currentDraft = {
                    pageIndex,
                    style: {
                        position: 'absolute',
                        left: `${x}px`,
                        top: `${y}px`,
                        width: '0px',
                        height: '0px',
                        border: '1px dashed rgba(0,0,0,0.3)',
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                    },
                };
            }
        },
        updateDraw(event, pageIndex) {
            if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return;
            event.preventDefault();
            event.stopPropagation();
            const { x, y } = this.getRelativePoint(event);
            const sx = this.drawStart.x;
            const sy = this.drawStart.y;
            if (this.tool === 'pen-red') {
                if (this.draftPenPath) this.draftPenPath.points.push({ x, y });
                return;
            }
            if (this.tool === 'underline-red') {
                this.draftLine = { pageIndex, x1: sx, y1: sy, x2: x, y2: y };
                return;
            }
            const left = Math.min(sx, x);
            const top = Math.min(sy, y);
            const w = Math.abs(x - sx);
            const h = Math.abs(y - sy);
            this.currentDraft = {
                pageIndex,
                style: {
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                    border: '1px dashed rgba(0,0,0,0.3)',
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    pointerEvents: 'none',
                    zIndex: 1000,
                },
            };
        },
        finishDraw(event, pageIndex) {
            if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return;
            event.preventDefault();
            event.stopPropagation();
            const { x, y } = this.getRelativePoint(event);
            const sx = this.drawStart.x;
            const sy = this.drawStart.y;

            if (this.tool === 'pen-red') {
                const pts = this.draftPenPath?.points || [];
                if (pts.length >= 2) {
                    this.pushAnnotationUndoSnapshot();
                    this.annotations.push({
                        id: `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        kind: 'pen',
                        pageIndex,
                        points: pts.slice(),
                    });
                    this.notifyAnnotationsChanged();
                }
                this.cancelDraw();
                return;
            }

            if (this.tool === 'underline-red') {
                const dx = Math.abs(x - sx);
                const dy = Math.abs(y - sy);
                if (dx > 6 || dy > 6) {
                    this.pushAnnotationUndoSnapshot();
                    this.annotations.push({
                        id: `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        kind: 'underline',
                        pageIndex,
                        x1: sx,
                        y1: sy,
                        x2: x,
                        y2: y,
                    });
                    this.notifyAnnotationsChanged();
                }
                this.cancelDraw();
                return;
            }

            const left = Math.min(sx, x);
            const top = Math.min(sy, y);
            const w = Math.abs(x - sx);
            const h = Math.abs(y - sy);
            if (w > 10 && h > 6) {
                this.pushAnnotationUndoSnapshot();
                const color = this.tool === 'highlight-green'
                    ? 'rgba(0,255,90,0.28)'
                    : this.tool === 'highlight-blue'
                        ? 'rgba(0,170,255,0.26)'
                        : this.tool === 'highlight-red'
                            ? 'rgba(220,53,69,0.28)'
                            : 'rgba(255,255,0,0.32)';
                this.annotations.push({
                    id: `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    kind: 'highlight',
                    pageIndex,
                    x: left,
                    y: top,
                    w,
                    h,
                    color,
                });
                this.notifyAnnotationsChanged();
            }
            this.cancelDraw();
        },
        cancelDraw() {
            this.isDrawing = false;
            this.drawStart = null;
            this.currentDraft = null;
            this.draftLine = null;
            this.draftPenPath = null;
        },
        // Click-to-place free text annotation (activesheet / preview).
        placeTextAnnotation(event, pageIndex) {
            if (this.tool !== 'text') return;
            if (event.target.closest('.ann-text') || event.target.closest('.input-overlay')) return;
            event.preventDefault();
            event.stopPropagation();
            const { x, y } = this.getRelativePoint(event);
            this.pushAnnotationUndoSnapshot();
            const id = `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            this.annotations.push({
                id,
                kind: 'text',
                pageIndex,
                x,
                y,
                text: '',
                fontSize: 14,
                color: this.annotationInkColor,
            });
            this.editingTextId = id;
            this.notifyAnnotationsChanged();
            this.$nextTick(() => {
                const el = document.getElementById(`ann-text-input-${id}`);
                if (el) {
                    el.focus();
                    this.syncTextAnnotationInputSize(el, pageIndex);
                }
            });
        },
        startEditText(id) {
            if (this.tool !== 'text') return;
            const ann = this.annotations.find((a) => a.id === id);
            this.editingTextId = id;
            this.$nextTick(() => {
                const el = document.getElementById(`ann-text-input-${id}`);
                if (el) {
                    el.focus();
                    if (typeof el.select === 'function') el.select();
                    if (ann) this.syncTextAnnotationInputSize(el, ann.pageIndex);
                }
            });
        },
        finishTextEdit(id) {
            if (this.editingTextId !== id) return;
            const ann = this.annotations.find((a) => a.id === id);
            if (!ann) {
                this.editingTextId = null;
                return;
            }
            const text = String(ann.text ?? '').trim();
            if (!text) {
                this.annotations = this.annotations.filter((a) => a.id !== id);
            } else {
                ann.text = text;
            }
            this.editingTextId = null;
            this.notifyAnnotationsChanged();
        },
        resetAnnotations() {
            this.cancelDraw();
            this.editingTextId = null;
            this.annotations = [];
            this.annotationUndoStack = [];
        },
    },
};
