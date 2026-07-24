<template>
    <div class="embed-container pdfview-pane-rendered" @click.stop>
        <ul class="nav nav-tabs bg-white pdf-toolbar">
        <li v-if="examtype === 'editor' && toolbar.showInsert" class="nav-item">
            <div class="nav-link btn btn-light btn-sm unstyled" id="insert-button" @click="insertImage()" :title="$t('editor.insert')">
            <img src="/img/svg/edit-download.svg" class="white">
            </div>
        </li>

        <li v-if="!localLockdown && toolbar.showPrint" class="nav-item">
            <div class="nav-link btn btn-success btn-sm unstyled unstyled-send" id="print-button" @click="printBase64(true)" :title="$t('editor.printToPrinter')">
            <img src="/img/svg/print.svg" class="white">
            <span class="ms-2 send-label">{{ $t('editor.printToPrinter') }}</span>
            </div>
        </li>

        <li v-if="!localLockdown && toolbar.showSend" class="nav-item">
            <div class="nav-link btn btn-success btn-sm unstyled unstyled-send" id="send-button" @click="printBase64()" :title="$t('editor.send')">
            <img src="/img/svg/document-send.svg" class="white">
            <span class="ms-2 send-label">{{ $t('editor.send') }}</span>
            </div>
        </li>

        <!-- annotation tools -->
        <li v-show="toolingVisible && !isSubmissionPreview" class="nav-item ">
            <button type="button" class="btn btn-light pdf-tool-btn " :class="{ active: tool === 'highlight-yellow' }" @click.stop="setTool('highlight-yellow')" title="Highlight yellow">
            <span class="tool-swatch tool-swatch--yellow"></span>
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-green' }" @click.stop="setTool('highlight-green')" title="Highlight green">
            <span class="tool-swatch tool-swatch--green"></span>
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-blue' }" @click.stop="setTool('highlight-blue')" title="Highlight blue">
            <span class="tool-swatch tool-swatch--blue"></span>
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'underline-red' }" @click.stop="setTool('underline-red')" title="Underline red">
            <span class="tool-underline tool-underline--red"></span>
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'pen-red' }" @click.stop="setTool('pen-red')" title="Pen red">
            <img src="/img/svg/document-edit.svg" class="white">
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn pdf-tool-btn--text" :class="{ active: tool === 'text' }" @click.stop="setTool('text')" :title="$t('editor.pdfAnnotationText')">T</button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'delete' }" @click.stop="setTool('delete')" :title="$t('editor.pdfAnnotationDelete')">
            <img src="/img/svg/edit-delete.svg" alt="">
            </button>
            <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === null }" @click.stop="setTool(null)" :title="$t('editor.pdfAnnotationClearTool')">✕</button>
            <span class="pdf-annotation-hint">{{ $t('editor.pdfAnnotationsNotStored') }}</span>
        </li>

        <li v-show="toolbar.showZoom && !isSubmissionPreview" class="nav-item ms-2">
            <button type="button" class="btn btn-light  pdf-tool-btn" @click.stop="zoomOut" :title="$t('editor.zoomOut')">−</button>
            <button type="button" class="btn btn-light  pdf-tool-btn" @click.stop="zoomIn" :title="$t('editor.zoomIn')">+</button>
            <span class="zoom-label" :title="`${Math.round(zoom * 100)}%`">{{ Math.round(zoom * 100) }}%</span>
        </li>

        <li v-if="showClose" class="nav-item ms-auto">
            <div type="button" class="nav-link btn btn-light btn-sm" :title="$t('editor.close')" @click.stop="closePane" style="width:40px; height:40px; text-align:center; font-weight:bold;">&times;</div>
        </li>
        </ul>

        <div v-if="isParsing" class="render-overlay">
        <div class="spinner"></div>
        <div class="mt-2 small text-muted">Loading PDF…</div>
        </div>

        <div v-else-if="imagePreviewUrl" class="pdf-scroll-container image-preview-container">
        <img :src="imagePreviewUrl" class="image-preview" draggable="false" />
        </div>

        <div v-else class="pdf-scroll-container">
        <div
        v-for="(page, pageIndex) in parsedPages"
        :key="pageIndex"
        class="pdf-page-layout"
        :style="{ width: (page.width * zoom) + 'px', height: (page.height * zoom) + 'px' }"
        >
        <div
            class="pdf-page-wrapper"
            :style="{ width: page.width + 'px', height: page.height + 'px', transform: `scale(${zoom})` }"
            @mousedown="tool !== 'delete' && tool !== 'text' ? startDraw($event, pageIndex) : null"
            @mousemove="isDrawing ? updateDraw($event, pageIndex) : null"
            @mouseup="isDrawing ? finishDraw($event, pageIndex) : null"
            @mouseleave="isDrawing ? cancelDraw() : null"
            @click="tool === 'text' ? placeTextAnnotation($event, pageIndex) : null"
        >
        <img :src="page.imgSrc" class="pdf-bg-image" draggable="false" />

            <template v-if="!isSubmissionPreview">
            <div
                v-for="ann in annotationsForPage(pageIndex)"
                :key="ann.id"
                :class="['ann', ann.kind]"
                :style="annotationStyle(ann)"
                @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : null"
            ></div>

            <svg
                v-for="ann in underlineForPage(pageIndex)"
                :key="ann.id"
                class="ann-underline"
                :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none', zIndex: 21 }"
            >
                <line
                :x1="ann.x1"
                :y1="ann.y1"
                :x2="ann.x2"
                :y2="ann.y2"
                :stroke="annotationInkStroke"
                stroke-width="3"
                stroke-linecap="round"
                @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : null"
                :style="{ pointerEvents: 'all', cursor: tool === 'delete' ? 'pointer' : 'default' }"
                />
            </svg>

            <svg
                v-for="ann in penForPage(pageIndex)"
                :key="ann.id"
                class="ann-pen"
                :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none', zIndex: 22 }"
            >
                <polyline
                :points="penPointsAttr(ann.points)"
                fill="none"
                :stroke="annotationInkStroke"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : null"
                :style="{ pointerEvents: 'all', cursor: tool === 'delete' ? 'pointer' : 'default' }"
                />
            </svg>
            <div
                v-for="ann in textForPage(pageIndex)"
                :key="ann.id"
                class="ann ann-text"
                :style="textAnnotationStyle(ann)"
                @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : (tool === 'text' ? startEditText(ann.id) : null)"
            >
                <textarea
                    v-if="editingTextId === ann.id"
                    :id="'ann-text-input-' + ann.id"
                    v-model="ann.text"
                    class="ann-text-input"
                    rows="1"
                    @blur="finishTextEdit(ann.id)"
                    @input="syncTextAnnotationInputSize($event.target, pageIndex)"
                    @focus="syncTextAnnotationInputSize($event.target, pageIndex)"
                    @mousedown.stop
                    @click.stop
                    @keydown.stop
                />
                <span v-else class="ann-text-display">{{ ann.text }}</span>
            </div>
            </template>

            <div v-if="currentDraft && currentDraft.pageIndex === pageIndex" class="draft" :style="draftStyle"></div>
            <svg v-if="draftLine && draftLine.pageIndex === pageIndex" class="draft-line" :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px' }">
            <line :x1="draftLine.x1" :y1="draftLine.y1" :x2="draftLine.x2" :y2="draftLine.y2" :stroke="annotationInkStroke" stroke-width="3" stroke-linecap="round" />
            </svg>
            <svg v-if="draftPenPath && draftPenPath.pageIndex === pageIndex" class="draft-pen" :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none' }">
            <polyline :points="penPointsAttr(draftPenPath.points)" fill="none" :stroke="annotationInkStroke" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </div>
        </div>
        </div>
    </div>
</template>

<script>
    import { parsePdfToPages } from 'next-exam-shared/pdfparser/index.js'
    import { pdfPageAnnotationsMixin } from 'next-exam-shared/pdfPageAnnotationsMixin.js'
    import { SignalBridge } from '../utils/signalBridge.js'
    import PdfHelper from "../utils/pdfHelper.ts";

    const signalBridge = new SignalBridge(window)

    export default {
    name: 'PdfviewPaneRendered',
    mixins: [pdfPageAnnotationsMixin],
    props: {
        localLockdown: { type: Boolean, default: false },
        examtype: { type: String, default: 'math' },
        toolbar: { type: Object, required: true },
        showClose: { type: Boolean, default: true },
        preview: { type: Object, default: null },
    },
    data() {
        return {
        isParsing: false,
        parsedPages: [],
        imagePreviewUrl: '',
        zoom: 1,
        annotationsKey: null,
        _saveTimer: null,
        }
    },
    computed: {
        toolingVisible() {
        // show tools only when a PDF is loaded
        return this.parsedPages.length > 0
        },
        isSubmissionPreview() {
        return !!(this.toolbar?.showSend || this.toolbar?.showPrint)
        },
    },
    watch: {
        preview: {
        deep: true,
        immediate: true,
        handler(p) {
            this.applyPreview(p)
        },
        },
    },
    beforeUnmount() {
        if (this._saveTimer) clearTimeout(this._saveTimer)
    },
    methods: {
        closePane() { this.$emit('close') },
        printBase64(base64 = false) { this.$emit('printBase64', base64) },
        insertImage() { this.$emit('insertImage') },
        zoomIn() { this.zoom = Math.min(2.5, Math.round((this.zoom + 0.1) * 10) / 10) },
        zoomOut() { this.zoom = Math.max(0.5, Math.round((this.zoom - 0.1) * 10) / 10) },
        resetZoom() { this.zoom = 1 },

        // Mixin-Hook: nach add/delete/undo Annotations persistieren
        onAnnotationsChange() { this.queueSave() },

        async applyPreview(preview) {
        const kind = preview?.kind || ''
        const url = preview?.url || ''
        const filename = preview?.filename || ''
        const fallbackUrl = preview?.fallbackUrl || ''

        if (kind === 'image' && url) {
            this.cancelDraw()
            this.isParsing = false
            this.parsedPages = []
            this.annotationsKey = null
            this.annotations = []
            this.imagePreviewUrl = url
            return
        }

        if (kind !== 'pdf' || !url) {
            this.cancelDraw()
            this.isParsing = false
            this.parsedPages = []
            this.imagePreviewUrl = ''
            this.annotationsKey = null
            this.annotations = []
            return
        }

        this.imagePreviewUrl = ''
        this.annotationsKey = filename ? filename : 'pdf-preview'
        await this.loadAnnotations()
        await this.renderPdfFromUrl(url, filename, fallbackUrl)
        },

        async renderPdfFromUrl(pdfUrl, filename = '', fallbackPdfUrl = '') {
        this.isParsing = true
        try {
            let uint8
            try {
            const res = await fetch(pdfUrl)
            const buf = await res.arrayBuffer()
            uint8 = new Uint8Array(buf)
            } catch (e) {
            try {
                if (!fallbackPdfUrl) throw e
                const res = await fetch(fallbackPdfUrl)
                const buf = await res.arrayBuffer()
                uint8 = new Uint8Array(buf)
            } catch (e2) {
                if (!filename) throw e2
                const data = await signalBridge.invoke('getpdfasync', filename)
                uint8 = new Uint8Array(data)
            }
            }
            this.parsedPages = await parsePdfToPages(uint8, {
            detectFormFields: false,
            detectBoxFields: false,
            detectCheckboxes: false,
            detectUnderscores: false,
            detectDots: false,
            detectDeselectFields: false,
            detectIsolatedLines: false,
            enableFilterAndMerge: false,
            enableFilterBoxesWithText: false,
            enableFilterBoxesWithTextPrecise: false,
            })
        } catch (e) {
            console.error('PdfviewPaneRendered: render failed', e)
            this.parsedPages = []
        } finally {
            this.isParsing = false
        }
        },

        async loadAnnotations() {
        try {
            const key = this.annotationsKey
            const raw = (await PdfHelper.readPdfAnnotations(key))?.data;
            if (!raw) {
            this.annotations = []
            return
            }
            const parsed = JSON.parse(raw)
            this.annotations = Array.isArray(parsed?.annotations) ? parsed.annotations : []
        } catch (e) {
            console.warn('PdfviewPaneRendered: loadAnnotations failed', e)
            this.annotations = []
        }
        },

        queueSave() {
        if (!this.annotationsKey) return
        if (this._saveTimer) clearTimeout(this._saveTimer)
        this._saveTimer = setTimeout(() => this.saveAnnotations(), 250)
        },

        async saveAnnotations() {
        try {
            const key = this.annotationsKey
            const payload = JSON.stringify({ version: 1, annotations: this.annotations }, null, 2)
            await PdfHelper.writePdfAnnotations(key, payload);
        } catch (e) {
            console.warn('PdfviewPaneRendered: saveAnnotations failed', e)
        }
        },
    },
    }
</script>

<style scoped>
    .pdf-toolbar {
    position: relative;
    flex-shrink: 0;
    container-type: inline-size;
    z-index: 2000;
    pointer-events: auto;
    font-size: 1.1rem;
    min-height: 45px;
    height: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    row-gap: 2px;
    gap: 2px !important;
    padding: 0 8px;
    width: 100%;
    box-sizing: border-box;
    }

    /* Bootstrap nav-tabs can collapse spacing; enforce per-item spacing */
    .pdf-toolbar > .nav-item {
    margin-right: 2px;
    }
    .pdf-toolbar > .nav-item:last-child {
    margin-right: 0;
    }

    /* Also space individual controls inside a nav-item (tools, zoom, etc.). */
    .pdf-toolbar .nav-item > * {
    margin-right: 2px;
    }
    .pdf-toolbar .nav-item > *:last-child {
    margin-right: 0;
    }

    .pdf-toolbar .nav-item {
    display: flex;
    align-items: center;

    }

    .pdf-toolbar .btn,
    .pdf-toolbar .nav-link {
    height: 40px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    line-height: 1 !important;
    border-radius: 6px !important;
    }

    .pdf-toolbar img {
    display: block;
    }


    .pdf-tool-btn {
    width: 40px;
    min-width: 40px;
    padding-left: 0 !important;
    padding-right: 0 !important;
    }
    .pdf-tool-btn img {
    width: 20px !important;
    height: 20px !important;
    margin: 0 !important;
    padding: 0 !important;
    }

    .pdf-annotation-hint {
    margin-left: 8px;
    font-size: 0.78rem;
    color: rgba(108, 117, 125, 0.85);
    white-space: nowrap;
    user-select: none;
    }

    @container (max-width: 720px) {
    .pdf-annotation-hint {
        display: none;
    }
    }

    .pdf-tool-btn.active {
    border: 2px solid rgba(13, 110, 253, 0.35) !important;
    background: transparent !important;
    box-shadow: none !important;
    }

    /* Bootstrap dims active buttons via filter; keep tool colors vivid. */
    .pdf-toolbar .btn:active,
    .pdf-toolbar .btn.active,
    .pdf-toolbar .nav-link:active,
    .pdf-toolbar .nav-link.active,
    .pdf-tool-btn:active,
    .pdf-tool-btn.active {
    filter: none !important;
    }

    .tool-swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.25);
    display: inline-block;
    }
    .tool-swatch--yellow { background: rgba(255, 255, 0, 1); }
    .tool-swatch--green  { background: rgba(0, 255, 90, 0.95); }
    .tool-swatch--blue   { background: rgba(0, 170, 255, 0.95); }

    .tool-underline {
    width: 18px;
    height: 0;
    border-top: 3px solid rgba(10, 36, 114, 0.95);
    display: inline-block;
    border-radius: 2px;
    }

    .zoom-label {
    height: 40px;
    min-width: 62px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid rgba(0,0,0,0.12);
    background: rgba(248, 249, 250, 0.9);
    color: rgba(0,0,0,0.75);
    font-size: 0.9rem;
    user-select: none;
    }
    .render-overlay {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 6px;
    z-index: 1500;
    }
    .spinner {
    width: 26px;
    height: 26px;
    border: 3px solid rgba(0,0,0,0.1);
    border-top-color: rgba(0,0,0,0.5);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .pdf-scroll-container {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: auto;
    padding: 16px;
    background: rgba(33, 37, 41, 0.92);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    }
    .pdf-page-layout {
    flex-shrink: 0;
    margin-bottom: 16px;
    margin-left: auto;
    margin-right: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    }
    .pdf-page-wrapper {
    position: relative;
    transform-origin: top center;
    flex-shrink: 0;
    }
    .pdf-bg-image {
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
    }

    .image-preview-container {
    display: flex;
    align-items: center;
    justify-content: center;
    }

    .image-preview {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
    }
    .draft {
    position: absolute;
    }
    .ann.highlight {
    mix-blend-mode: multiply;
    z-index: 20;
    }

    .ann-underline {
    z-index: 21;
    }

    .ann-text-display {
    display: inline-block;
    font-size: 14px;
    line-height: 1.3;
    color: #0a2472;
    background: rgba(255, 255, 255, 0.85);
    padding: 2px 4px;
    border-radius: 2px;
    white-space: pre-wrap;
    word-break: break-word;
    }

    .ann-text-input {
    box-sizing: border-box;
    display: block;
    font-size: 14px;
    line-height: 1.3;
    color: #0a2472;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(13, 110, 253, 0.5);
    border-radius: 2px;
    padding: 2px 4px;
    resize: none;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    min-width: 80px;
    }

    .pdf-tool-btn--text {
    font-weight: 700;
    font-size: 1rem;
    }

    .unstyled{
    box-shadow: none !important;
    padding: 10px !important;
    margin: 0px !important;
    border: none !important;
    border-radius: 6px !important;
    align-items: center !important;
    width: 40px !important;
    height: 40px !important;
    text-align: center !important;
    }
    .unstyled.unstyled-send {
    width: auto !important;
    min-width: 120px !important;
    display: inline-flex !important;
    justify-content: center !important;
    color: #000 !important;
    }
    .unstyled-send .send-label { color: #000 !important; }
    .unstyled img{
    width: 20px !important;
    height: 20px !important;
    margin: 0px !important;
    padding: 0px !important;
    }

    .embed-container {
    position: relative;
    /* Single place for overlay width; children use 100% of this box. */
    width: var(--nx-preview-content-width, 100%);
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding-top: var(--nx-preview-top-offset, 0px);
    box-sizing: border-box;
    }

    @media print {
        .pdfview-pane-rendered {
            display: none !important;
        }

        .ann-text-input,
        .ann-text-display {
            border: none !important;
            background: transparent !important;
            outline: none !important;
            box-shadow: none !important;
        }
    }

</style>

