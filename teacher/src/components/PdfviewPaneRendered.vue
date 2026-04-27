<template>
    <div v-if="src" class="embed-container pdfview-pane-rendered" @click.stop>
        <ul class="nav nav-tabs bg-white pdf-toolbar">
            <li class="nav-item">
                <button type="button" class="btn btn-light pdf-tool-btn" id="printPDF" @click="printBase64()" :title="$t('dashboard.print')">
                    <img src="/src/assets/img/svg/print.svg" class="white">
                </button>
            </li>

            <li class="nav-item">
                <button type="button" class="btn btn-light pdf-tool-btn" id="downloadPDF" @click="downloadFile('current')" :title="$t('dashboard.save')">
                    <img src="/src/assets/img/svg/edit-download.svg" class="white">
                </button>
            </li>

            <li class="nav-item">
                <button type="button" class="btn btn-light pdf-tool-btn" id="openPDF" @click="openFileExternal(currentpreviewPath)" :title="$t('dashboard.open')">
                    <img src="/src/assets/img/svg/stock_exit_up.svg" class="white">
                </button>
            </li>

            <li v-show="false" class="nav-item ms-2">
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-yellow' }" @click.stop="setTool('highlight-yellow')" title="Highlight yellow">
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
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'delete' }" @click.stop="setTool('delete')" title="Delete">
                    ✕
                </button>
            </li>

            <li v-show="toolingVisible" class="nav-item ms-2">
                <button type="button" class="btn btn-light pdf-tool-btn" @click.stop="zoomOut" :title="$t('dashboard.zoomOut')">−</button>
                <button type="button" class="btn btn-light pdf-tool-btn" @click.stop="zoomIn" :title="$t('dashboard.zoomIn')">+</button>
                <span class="zoom-label" :title="`${Math.round(zoom * 100)}%`">{{ Math.round(zoom * 100) }}%</span>
            </li>

            <li class="nav-item ms-auto">
                <button type="button" id="closePDF" class="btn btn-light pdf-tool-btn" :title="$t('dashboard.close')" @click.stop="closePane" style="font-weight:bold;">&times;</button>
            </li>
        </ul>

        <div v-if="isParsing" class="render-overlay">
            <div class="spinner"></div>
            <div class="mt-2 small text-muted">Loading PDF…</div>
        </div>

        <div v-if="currentpreviewType === 'image'" class="pdf-scroll-container image-preview-container">
            <img :src="src" class="image-preview" draggable="false" />
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
                @mousedown="tool !== 'delete' ? startDraw($event, pageIndex) : null"
                @mousemove="isDrawing ? updateDraw($event, pageIndex) : null"
                @mouseup="isDrawing ? finishDraw($event, pageIndex) : null"
                @mouseleave="isDrawing ? cancelDraw() : null"
            >
                <img :src="page.imgSrc" class="pdf-bg-image" draggable="false" />

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
                        stroke="rgba(220,53,69,0.95)"
                        stroke-width="3"
                        stroke-linecap="round"
                        @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : null"
                        style="pointer-events: all;"
                    />
                </svg>

                <div v-if="currentDraft && currentDraft.pageIndex === pageIndex" class="draft" :style="draftStyle"></div>
                <svg v-if="draftLine && draftLine.pageIndex === pageIndex" class="draft-line" :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px' }">
                    <line :x1="draftLine.x1" :y1="draftLine.y1" :x2="draftLine.x2" :y2="draftLine.y2" stroke="rgba(220,53,69,0.95)" stroke-width="3" stroke-linecap="round" />
                </svg>
            </div>
            </div>
        </div>

        <div id="pdfembed" aria-hidden="true"></div>
    </div>
</template>

<script>
    import { parsePdfToPages } from '../utils/pdfparser/index.js'

    export default {
        name: 'PdfviewPaneRendered',
        props: {
            src: { type: String, default: '' },
            currentpreviewPath: { type: String, default: '' },
            currentpreviewBase64: { type: String, default: '' },
            currentpreviewType: { type: String, default: 'pdf' },
        },
        data() {
            return {
                isParsing: false,
                parsedPages: [],
                zoom: 1,
                tool: 'highlight-yellow',
                isDrawing: false,
                drawStart: null,
                currentDraft: null,
                draftLine: null,
                annotations: [],
            }
        },
        computed: {
            toolingVisible() {
                return this.parsedPages.length > 0
            },
            draftStyle() {
                return this.currentDraft?.style || {}
            },
        },
        watch: {
            src: {
                immediate: true,
                handler(nextSrc) {
                    this.applySrc(nextSrc)
                },
            },
        },
        methods: {
            closePane() { this.$emit('close') },
            printBase64() { this.$emit('printBase64', this.currentpreviewBase64) },
            downloadFile(file) { this.$emit('downloadFile', file) },
            openFileExternal(path) { this.$emit('openFileExternal', path) },
            setTool(tool) { this.tool = tool },
            zoomIn() { this.zoom = Math.min(2.5, Math.round((this.zoom + 0.1) * 10) / 10) },
            zoomOut() { this.zoom = Math.max(0.5, Math.round((this.zoom - 0.1) * 10) / 10) },

            annotationsForPage(pageIndex) {
                return this.annotations.filter(a => a.pageIndex === pageIndex && a.kind === 'highlight')
            },
            underlineForPage(pageIndex) {
                return this.annotations.filter(a => a.pageIndex === pageIndex && a.kind === 'underline')
            },
            annotationStyle(ann) {
                if (ann.kind !== 'highlight') return {}
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
                }
            },

            deleteAnnotation(id) {
                this.annotations = this.annotations.filter(a => a.id !== id)
            },

            getRelativePoint(event) {
                const pageWrapper = event.currentTarget
                const rect = pageWrapper.getBoundingClientRect()
                const x = (event.clientX - rect.left) / this.zoom
                const y = (event.clientY - rect.top) / this.zoom
                return { x, y }
            },

            startDraw(event, pageIndex) {
                if (this.tool === 'delete') return
                event.preventDefault()
                event.stopPropagation()
                const { x, y } = this.getRelativePoint(event)
                this.isDrawing = true
                this.drawStart = { x, y, pageIndex }
                if (this.tool === 'underline-red') {
                    this.draftLine = { pageIndex, x1: x, y1: y, x2: x, y2: y }
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
                    }
                }
            },

            updateDraw(event, pageIndex) {
                if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return
                event.preventDefault()
                event.stopPropagation()
                const { x, y } = this.getRelativePoint(event)
                const sx = this.drawStart.x
                const sy = this.drawStart.y
                if (this.tool === 'underline-red') {
                    this.draftLine = { pageIndex, x1: sx, y1: sy, x2: x, y2: y }
                    return
                }
                const left = Math.min(sx, x)
                const top = Math.min(sy, y)
                const w = Math.abs(x - sx)
                const h = Math.abs(y - sy)
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
                }
            },

            finishDraw(event, pageIndex) {
                if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return
                event.preventDefault()
                event.stopPropagation()
                const { x, y } = this.getRelativePoint(event)
                const sx = this.drawStart.x
                const sy = this.drawStart.y

                if (this.tool === 'underline-red') {
                    const dx = Math.abs(x - sx)
                    const dy = Math.abs(y - sy)
                    if (dx > 6 || dy > 6) {
                        this.annotations.push({
                            id: `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                            kind: 'underline',
                            pageIndex,
                            x1: sx, y1: sy, x2: x, y2: y,
                        })
                    }
                    this.cancelDraw()
                    return
                }

                const left = Math.min(sx, x)
                const top = Math.min(sy, y)
                const w = Math.abs(x - sx)
                const h = Math.abs(y - sy)
                if (w > 10 && h > 6) {
                    const color = this.tool === 'highlight-green'
                        ? 'rgba(0,255,90,0.28)'
                        : this.tool === 'highlight-blue'
                            ? 'rgba(0,170,255,0.26)'
                            : 'rgba(255,255,0,0.32)'
                    this.annotations.push({
                        id: `ann_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        kind: 'highlight',
                        pageIndex,
                        x: left,
                        y: top,
                        w,
                        h,
                        color,
                    })
                }
                this.cancelDraw()
            },

            cancelDraw() {
                this.isDrawing = false
                this.drawStart = null
                this.currentDraft = null
                this.draftLine = null
            },

            async applySrc(nextSrc) {
                if (!nextSrc) {
                    this.cancelDraw()
                    this.isParsing = false
                    this.parsedPages = []
                    this.annotations = []
                    return
                }
                if (this.currentpreviewType === 'image') {
                    this.cancelDraw()
                    this.isParsing = false
                    this.parsedPages = []
                    this.annotations = []
                    return
                }
                await this.renderPdfFromUrl(nextSrc, this.currentpreviewBase64)
            },

            async renderPdfFromUrl(pdfUrl, pdfBase64Fallback = '') {
                this.isParsing = true
                try {
                    let uint8
                    try {
                        const res = await fetch(pdfUrl)
                        const buf = await res.arrayBuffer()
                        uint8 = new Uint8Array(buf)
                    } catch (e) {
                        if (!pdfBase64Fallback) throw e
                        const fallbackUrl = `data:application/pdf;base64,${pdfBase64Fallback}`
                        const res = await fetch(fallbackUrl)
                        const buf = await res.arrayBuffer()
                        uint8 = new Uint8Array(buf)
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
                    console.error('PdfviewPaneRendered: render failed', e) // one line comment
                    this.parsedPages = []
                } finally {
                    this.isParsing = false
                }
            },
        },
    }
</script>

<style scoped>
    .pdf-toolbar {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 2000;
        pointer-events: auto;
        font-size: 1.1rem;
        height: 45px;
        display: flex;
        align-items: center;
        gap: 2px !important;
        padding: 0 8px;
        top: 0;
        width: 100%;
        box-sizing: border-box;
    }

    .pdf-toolbar > .nav-item {
        margin-right: 2px;
        display: flex;
        align-items: center;
    }
    .pdf-toolbar > .nav-item:last-child {
        margin-right: 0;
    }

    .pdf-tool-btn {
        width: 40px;
        min-width: 40px;
        padding-left: 0 !important;
        padding-right: 0 !important;
        height: 40px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 6px !important;
    }
    .pdf-tool-btn img {
        width: 20px !important;
        height: 20px !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    .pdf-tool-btn.active {
        border: 2px solid rgba(13, 110, 253, 0.35) !important;
        background: transparent !important;
        box-shadow: none !important;
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
        border-top: 3px solid rgba(220,53,69,0.95);
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
        position: absolute;
        top: 45px;
        left: 0;
        right: 0;
        width: 100%;
        box-sizing: border-box;
        bottom: 0;
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
        top: 45px;
        width: 100%;
        height: calc(100% - 45px);
        overflow: auto;
        padding: 16px;
        background: rgba(33, 37, 41, 0.92);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
    }
    .pdf-page-layout {
        flex-shrink: 0;
        margin-bottom: 16px;
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
    .ann-underline {
        z-index: 21;
    }

    .unstyled{
        box-shadow: none !important;
        padding: 10px !important;
        margin: 0px !important;
        border: none !important;
        border-radius: 0px !important;
        align-items: center !important;
        width: 40px !important;
        height: 40px !important;
        text-align: center !important;
    }
    .unstyled img{
        width: 20px !important;
        height: 20px !important;
        margin: 0px !important;
        padding: 0px !important;
    }

    #pdfembed {
        display: none !important;
    }

    .embed-container {
        position: relative;
        width: 100%;
        max-width: 100%;
        margin-left: auto;
        margin-right: auto;
        height: 100%;
        display: flex;
        align-items: flex-start;
        box-sizing: border-box;
    }
</style>

