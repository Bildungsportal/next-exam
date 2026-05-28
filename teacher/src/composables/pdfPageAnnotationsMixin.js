/** Shared highlight/underline annotation drawing for PDF page viewers. */
export const pdfPageAnnotationsMixin = {
    data() {
        return {
            tool: 'highlight-yellow',
            isDrawing: false,
            drawStart: null,
            currentDraft: null,
            draftLine: null,
            annotations: [],
            annotationUndoStack: [],
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
            return true;
        },
        setTool(tool) {
            this.tool = tool;
        },
        annotationsForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'highlight');
        },
        underlineForPage(pageIndex) {
            return this.annotations.filter((a) => a.pageIndex === pageIndex && a.kind === 'underline');
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
        deleteAnnotation(id) {
            this.pushAnnotationUndoSnapshot();
            this.annotations = this.annotations.filter((a) => a.id !== id);
        },
        getRelativePoint(event) {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left) / this.zoom;
            const y = (event.clientY - rect.top) / this.zoom;
            return { x, y };
        },
        startDraw(event, pageIndex) {
            if (this.tool === 'delete') return;
            event.preventDefault();
            event.stopPropagation();
            const { x, y } = this.getRelativePoint(event);
            this.isDrawing = true;
            this.drawStart = { x, y, pageIndex };
            if (this.tool === 'underline-red') {
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
            }
            this.cancelDraw();
        },
        cancelDraw() {
            this.isDrawing = false;
            this.drawStart = null;
            this.currentDraft = null;
            this.draftLine = null;
        },
        resetAnnotations() {
            this.cancelDraw();
            this.annotations = [];
            this.annotationUndoStack = [];
        },
    },
};
