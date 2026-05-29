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

            <li v-if="currentpreviewPath" class="nav-item">
                <button type="button" class="btn btn-light pdf-tool-btn" id="openPDF" @click="openFileExternal(currentpreviewPath)" :title="$t('dashboard.open')">
                    <img src="/src/assets/img/svg/stock_exit_up.svg" class="white">
                </button>
            </li>

            <template v-if="correctionMode">
                <li class="nav-item ms-2">
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
                    <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'pen-red' }" @click.stop="setTool('pen-red')" title="Pen red">
                        <img src="/src/assets/img/svg/document-edit.svg" class="white">
                    </button>
                    <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'delete' }" @click.stop="setTool('delete')" title="Delete">
                        ✕
                    </button>
                </li>
                <li class="nav-item ms-1">
                    <button type="button" class="btn btn-light pdf-tool-btn" :disabled="!canUndoAnnotation" @click.stop="undoCorrection" title="Undo">↶</button>
                </li>
                <li class="nav-item ms-2">
                    <button
                        type="button"
                        class="btn btn-sm"
                        :class="showMismatchOverlay ? 'btn-warning' : 'btn-outline-secondary'"
                        :disabled="!activesheetsCorrection?.canAutocorrect"
                        :title="autocorrectTitle"
                        @click.stop="toggleAutocorrect"
                    >
                        {{ $t('pdf.autocorrect') }}
                    </button>
                </li>
                <li class="nav-item ms-1">
                    <button type="button" class="btn btn-sm btn-primary" @click.stop="$emit('save-correction')">
                        {{ $t('pdf.saveCorrection') }}
                    </button>
                </li>
            </template>

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

        <div v-else-if="embedFallback" class="pdf-scroll-container embed-fallback-container">
            <p class="small text-muted embed-fallback-hint">{{ $t('pdf.previewEmbedFallback') }}</p>
            <embed :src="src" type="application/pdf" class="pdf-embed-fallback" />
        </div>

        <div v-else class="pdf-scroll-container">
            <p v-if="correctionBasePreview" class="small text-warning correction-base-preview-hint">
                {{ $t('pdf.correctionBasePreviewNotice') }}
            </p>
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

                <ActivesheetsFieldLayer
                    v-if="correctionMode && basePageForIndex(pageIndex)"
                    :page="basePageForIndex(pageIndex)"
                    :page-index="pageIndex"
                    :custom-fields="activesheetsCorrection.customFields"
                    :blacklist="activesheetsCorrection.blacklist"
                    :interactive="false"
                    :show-mismatch-overlay="showMismatchOverlay"
                    :mismatch-field-ids="activesheetsCorrection.mismatchFieldIds"
                    :dismissed-mismatch-ids="dismissedMismatchIds"
                    :delete-tool-active="tool === 'delete'"
                    @dismissMismatch="dismissMismatch"
                />

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
                        stroke="rgba(220,53,69,0.95)"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        @click.stop="tool === 'delete' ? deleteAnnotation(ann.id) : null"
                        :style="{ pointerEvents: 'all', cursor: tool === 'delete' ? 'pointer' : 'default' }"
                    />
                </svg>

                <div v-if="currentDraft && currentDraft.pageIndex === pageIndex" class="draft" :style="draftStyle"></div>
                <svg v-if="draftLine && draftLine.pageIndex === pageIndex" class="draft-line" :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px' }">
                    <line :x1="draftLine.x1" :y1="draftLine.y1" :x2="draftLine.x2" :y2="draftLine.y2" stroke="rgba(220,53,69,0.95)" stroke-width="3" stroke-linecap="round" />
                </svg>
                <svg v-if="draftPenPath && draftPenPath.pageIndex === pageIndex" class="draft-pen" :style="{ position:'absolute', left:0, top:0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none' }">
                    <polyline :points="penPointsAttr(draftPenPath.points)" fill="none" stroke="rgba(220,53,69,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
            </div>
        </div>

        <div id="pdfembed" aria-hidden="true"></div>
    </div>
</template>

<script>
    import log from 'electron-log/renderer';
    import { parsePdfToPages } from 'next-exam-shared/pdfparser/index.js'
    import { pdfPageAnnotationsMixin } from 'next-exam-shared/pdfPageAnnotationsMixin.js'
    import ActivesheetsFieldLayer from './ActivesheetsFieldLayer.vue'
    import { base64ToUint8Array } from '../utils/filemanager.js'

    export default {
        name: 'PdfviewPaneRendered',
        components: { ActivesheetsFieldLayer },
        mixins: [pdfPageAnnotationsMixin],
        props: {
            src: { type: String, default: '' },
            currentpreviewPath: { type: String, default: '' },
            currentpreviewBase64: { type: String, default: '' },
            currentpreviewType: { type: String, default: 'pdf' },
            activesheetsCorrection: { type: Object, default: null },
        },
        data() {
            return {
                isParsing: false,
                parsedPages: [],
                embedFallback: false,
                correctionBasePreview: false,
                zoom: 1,
                showMismatchOverlay: false,
                dismissedMismatchIds: [],
            }
        },
        computed: {
            correctionMode() {
                return !!this.activesheetsCorrection;
            },
            toolingVisible() {
                return this.parsedPages.length > 0 || this.embedFallback;
            },
            autocorrectTitle() {
                if (this.activesheetsCorrection?.canAutocorrect) return this.$t('pdf.autocorrect');
                return this.activesheetsCorrection?.disabledReason || this.$t('pdf.correctionNoTemplate');
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
            zoomIn() { this.zoom = Math.min(2.5, Math.round((this.zoom + 0.1) * 10) / 10) },
            zoomOut() { this.zoom = Math.max(0.5, Math.round((this.zoom - 0.1) * 10) / 10) },
            basePageForIndex(pageIndex) {
                return this.activesheetsCorrection?.baseParsedPages?.[pageIndex] || null;
            },
            toggleAutocorrect() {
                if (!this.activesheetsCorrection?.canAutocorrect) return;
                this.showMismatchOverlay = !this.showMismatchOverlay;
            },
            dismissMismatch(fieldId) {
                this.pushAnnotationUndoSnapshot({ dismissedMismatchIds: [...this.dismissedMismatchIds] });
                if (!this.dismissedMismatchIds.includes(fieldId)) {
                    this.dismissedMismatchIds.push(fieldId);
                }
            },
            onAnnotationUndoRestore(prev) {
                if (Array.isArray(prev.dismissedMismatchIds)) {
                    this.dismissedMismatchIds = [...prev.dismissedMismatchIds];
                }
            },
            undoCorrection() {
                this.undoAnnotation();
            },
            async applySrc(nextSrc) {
                if (!nextSrc) {
                    this.cancelDraw();
                    this.isParsing = false;
                    this.parsedPages = [];
                    this.embedFallback = false;
                    this.correctionBasePreview = false;
                    this.resetAnnotations();
                    this.showMismatchOverlay = false;
                    this.dismissedMismatchIds = [];
                    return;
                }
                if (this.currentpreviewType === 'image') {
                    this.cancelDraw();
                    this.isParsing = false;
                    this.parsedPages = [];
                    this.embedFallback = false;
                    this.correctionBasePreview = false;
                    this.resetAnnotations();
                    return;
                }
                await this.renderPdfFromUrl(nextSrc, this.currentpreviewBase64);
            },

            pdfPreviewParseOptions() {
                return {
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
                };
            },

            async renderPdfFromUrl(pdfUrl, pdfBase64Fallback = '') {
                this.isParsing = true;
                this.embedFallback = false;
                this.correctionBasePreview = false;
                try {
                    let uint8 = null;
                    if (pdfBase64Fallback) {
                        uint8 = base64ToUint8Array(pdfBase64Fallback);
                    } else if (pdfUrl) {
                        const res = await fetch(pdfUrl);
                        uint8 = new Uint8Array(await res.arrayBuffer());
                    }
                    if (!uint8?.length || uint8[0] !== 0x25 || uint8[1] !== 0x50) {
                        throw new Error('Invalid PDF header');
                    }
                    try {
                        this.parsedPages = await parsePdfToPages(uint8, this.pdfPreviewParseOptions());
                    } catch (parseErr) {
                        const basePages = this.activesheetsCorrection?.baseParsedPages;
                        if (this.correctionMode && basePages?.length) {
                            log.warn('PdfviewPaneRendered: submission parse failed, using base layout', parseErr);
                            this.parsedPages = basePages;
                            this.correctionBasePreview = true;
                        } else if (pdfUrl) {
                            log.warn('PdfviewPaneRendered: parse failed, embed fallback', parseErr);
                            this.parsedPages = [];
                            this.embedFallback = true;
                        } else {
                            throw parseErr;
                        }
                    }
                } catch (e) {
                    log.error('PdfviewPaneRendered: render failed', e);
                    this.parsedPages = [];
                    this.embedFallback = !!pdfUrl;
                } finally {
                    this.isParsing = false;
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

    .embed-fallback-container {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        min-height: 60vh;
    }

    .pdf-embed-fallback {
        flex: 1;
        width: 100%;
        min-height: 55vh;
        border: 0;
    }

    .embed-fallback-hint,
    .correction-base-preview-hint {
        margin: 8px 12px 0;
    }

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

    @media print {
        /* A4 ohne Rand: sonst ragt skalierte Seite (zoom 8/9) ueber bedruckbare Hoehe -> Folgeseite + Leerblatt */
        @page { size: A4; margin: 0; }
        html, body { height: auto !important; overflow: visible !important; }
        .pdf-toolbar, .render-overlay, .correction-base-preview-hint { display: none !important; }
        .embed-container.pdfview-pane-rendered { display: block !important; overflow: visible !important;  }
        /* zoom-Basis 8/9: pdfparser rendert scale 1.5 (1pt=1.5px), printToPDF mappt 1pt=96/72=1.333px -> 1.333/1.5=8/9.
           Bei Teacher ragt die so skalierte Seite um Subpixel ueber die A4-Druckhoehe (anders als student/, wo .pdf-overlay-root absolut positioniert ist) -> minimal kleiner (0.882) + break-before pro Folgeseite ergibt exakt N Blaetter ohne Leerseite. */
        .pdf-scroll-container { position: static !important; top: auto !important; padding: 0 !important; height: auto !important; overflow: hidden !important; background: #fff !important; zoom: 0.882; }
        .pdf-page-wrapper { transform: none !important; margin: 0 !important; box-shadow: none !important; }
        .pdf-page-layout { width: auto !important; height: auto !important; margin: 0 !important; overflow: hidden !important; break-inside: avoid; page-break-inside: avoid; }
        .pdf-page-layout + .pdf-page-layout { break-before: page; page-break-before: always; }
    }
</style>

<style>
/* unscoped: forciert weisser hintergrund + page-fluss im print, scope-unabhaengig */
@media print {
    html, body { background: #fff !important; }
    .pdf-scroll-container, .pdf-page-layout, .pdf-page-wrapper { background: #fff !important; }
    .pdf-page-wrapper { transform: none !important; margin: 0 !important; box-shadow: none !important; }
    .pdf-page-layout { margin: 0 !important; overflow: hidden !important; break-inside: avoid; page-break-inside: avoid; }
    .pdf-page-layout + .pdf-page-layout { break-before: page; page-break-before: always; }
}
</style>

