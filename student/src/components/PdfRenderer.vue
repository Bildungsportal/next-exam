<template>
    <div id="pdfrenderer" class="pdf-overlay-root">
        <ul v-if="enableAnnotations && parsedPages.length > 0" class="pdf-annotation-toolbar">
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-yellow' }" @click.stop="setTool('highlight-yellow')" title="Highlight yellow">
                    <span class="tool-swatch tool-swatch--yellow"></span>
                </button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-green' }" @click.stop="setTool('highlight-green')" title="Highlight green">
                    <span class="tool-swatch tool-swatch--green"></span>
                </button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'highlight-blue' }" @click.stop="setTool('highlight-blue')" title="Highlight blue">
                    <span class="tool-swatch tool-swatch--blue"></span>
                </button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'underline-red' }" @click.stop="setTool('underline-red')" title="Underline red">
                    <span class="tool-underline tool-underline--red"></span>
                </button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'pen-red' }" @click.stop="setTool('pen-red')" title="Pen red">
                    <img src="/src/assets/img/svg/document-edit.svg" class="white">
                </button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn pdf-tool-btn--text" :class="{ active: tool === 'text' }" @click.stop="setTool('text')" :title="$t('editor.pdfAnnotationText')">T</button>
            </li>
            <li>
                <button type="button" class="btn btn-light pdf-tool-btn" :class="{ active: tool === 'delete' }" @click.stop="setTool('delete')" title="Delete">
                    ✕
                </button>
            </li>
        </ul>
        <div v-if="effectiveLoading" class="overlay">
            <div class="spinner"></div>
            <p>Loading PDF...</p>
        </div>
        <div v-else-if="parsedPages.length > 0" class="pdf-scroll-container">
            <div
                v-for="(page, pageIndex) in parsedPages"
                :key="pageIndex"
                class="pdf-page-wrapper"
                :style="{ width: page.width + 'px', height: page.height + 'px' }"
                @mousedown="enableAnnotations && tool !== 'delete' && tool !== 'text' ? startDraw($event, pageIndex) : null"
                @mousemove="enableAnnotations && isDrawing ? updateDraw($event, pageIndex) : null"
                @mouseup="enableAnnotations && isDrawing ? finishDraw($event, pageIndex) : null"
                @mouseleave="enableAnnotations && isDrawing ? cancelDraw() : null"
                @click="enableAnnotations && tool === 'text' ? placeTextAnnotation($event, pageIndex) : null"
            >
                <img :src="page.imgSrc" class="pdf-bg-image" />

                <div
                    v-if="page.warnings && page.warnings.length"
                    class="pdf-warning"
                >
                    <p v-for="(warning, wIndex) in page.warnings" :key="wIndex">
                        {{ warning }}
                    </p>
                </div>

                <div
                    v-for="field in page.formFields"
                    :key="field.id"
                    v-show="!isBlacklisted(field.id)"
                    class="input-overlay"
                    :id="field.id + '_wrapper'"
                    :style="field.style"
                >
                    <input
                        v-if="field.type === 'checkbox'"
                        type="checkbox"
                        :checked="field.checked"
                        :name="field.name"
                        :id="field.id"
                        class="interactive-input checkbox"
                    />
                    <textarea
                        v-else-if="field.type === 'textarea'"
                        :name="field.name"
                        :id="field.id"
                        class="interactive-input textarea"
                    >
                        {{ field.value }}
                    </textarea>
                    <input
                        v-else
                        type="text"
                        :value="field.value"
                        :name="field.name"
                        :id="field.id"
                        class="interactive-input text"
                    />
                </div>

                <div
                    v-for="cloze in page.clozeFields"
                    :key="cloze.id"
                    v-show="!isBlacklisted(cloze.id)"
                    :class="['input-overlay', cloze.type === 'checkbox' || cloze.type === 'deselect' ? 'checkbox-overlay' : '']"
                    :id="cloze.id + '_wrapper'"
                    :style="cloze.style"
                >
                    <input
                        v-if="cloze.type === 'checkbox'"
                        type="checkbox"
                        :checked="cloze.checked || false"
                        :name="cloze.id"
                        :id="cloze.id"
                        class="interactive-input checkbox"
                    />
                    <input
                        v-else-if="cloze.type === 'deselect'"
                        type="checkbox"
                        :checked="cloze.checked || false"
                        :name="cloze.id"
                        :id="cloze.id"
                        class="interactive-input checkbox deselect-checkbox"
                    />
                    <input
                        v-else
                        type="text"
                        class="interactive-input cloze"
                        :name="cloze.id"
                        :id="cloze.id"
                    />
                </div>

                <div
                    v-for="box in page.boxFields"
                    :key="box.id"
                    v-show="!isBlacklisted(box.id)"
                    :class="['input-overlay', box.type === 'checkbox' ? 'checkbox-overlay' : '']"
                    :id="box.id + '_wrapper'"
                    :style="box.style"
                >
                    <input
                        v-if="box.type === 'checkbox'"
                        type="checkbox"
                        :name="box.id"
                        :id="box.id"
                        class="interactive-input checkbox"
                    />
                    <textarea
                        v-else-if="box.type === 'textarea' || box.isTextarea"
                        class="interactive-input textarea"
                        :name="box.id"
                        :id="box.id"
                    ></textarea>
                    <input
                        v-else
                        type="text"
                        class="interactive-input table-cell"
                        :name="box.id"
                        :id="box.id"
                    />
                </div>

                <div
                    v-for="customField in getCustomFieldsForPage(pageIndex)"
                    :key="customField.id"
                    class="input-overlay"
                    :id="customField.id + '_wrapper'"
                    :style="customField.style"
                >
                    <textarea
                        v-if="!customField.type || customField.type === 'textarea'"
                        class="interactive-input textarea"
                        :name="customField.id"
                        :id="customField.id"
                    ></textarea>
                    <input
                        v-else-if="customField.type === 'textinput'"
                        type="text"
                        class="interactive-input text"
                        :name="customField.id"
                        :id="customField.id"
                    />
                    <input
                        v-else-if="customField.type === 'checkbox'"
                        type="checkbox"
                        class="interactive-input checkbox"
                        :name="customField.id"
                        :id="customField.id"
                    />
                    <input
                        v-else
                        type="checkbox"
                        class="interactive-input checkbox deselect-checkbox"
                        :name="customField.id"
                        :id="customField.id"
                    />
                </div>

                <template v-if="enableAnnotations">
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
                        :style="{ position: 'absolute', left: 0, top: 0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none', zIndex: 21 }"
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
                        :style="{ position: 'absolute', left: 0, top: 0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none', zIndex: 22 }"
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
                    <div v-if="currentDraft && currentDraft.pageIndex === pageIndex" class="draft" :style="draftStyle"></div>
                    <svg v-if="draftLine && draftLine.pageIndex === pageIndex" class="draft-line" :style="{ position: 'absolute', left: 0, top: 0, width: page.width + 'px', height: page.height + 'px' }">
                        <line :x1="draftLine.x1" :y1="draftLine.y1" :x2="draftLine.x2" :y2="draftLine.y2" stroke="rgba(220,53,69,0.95)" stroke-width="3" stroke-linecap="round" />
                    </svg>
                    <svg v-if="draftPenPath && draftPenPath.pageIndex === pageIndex" class="draft-pen" :style="{ position: 'absolute', left: 0, top: 0, width: page.width + 'px', height: page.height + 'px', pointerEvents: 'none' }">
                        <polyline :points="penPointsAttr(draftPenPath.points)" fill="none" stroke="rgba(220,53,69,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </template>
            </div>
        </div>
        <div v-else class="pdf-empty-state">
            <p>Keine PDF Seiten vorhanden.</p>
        </div>
    </div>
</template>

<script>
import { parsePdfToPages, ensurePdfOverlayFontsReady } from 'next-exam-shared/pdfparser/index.js';
import { pdfPageAnnotationsMixin } from 'next-exam-shared/pdfPageAnnotationsMixin.js';
import { SignalBridge } from '../utils/signalBridge.js';
import Swal from 'sweetalert2';

const signalBridge = new SignalBridge(window);

export default {
    name: 'PdfOverlay',
    mixins: [pdfPageAnnotationsMixin],
    props: {
        pdfBase64: {
            type: String,
            default: null
        },
        loading: {
            type: Boolean,
            default: false
        },
        customFields: {
            type: Array,
            default: () => []
        },
        blacklist: {
            type: Array,
            default: () => []
        },
        enableAnnotations: {
            type: Boolean,
            default: false
        },
        annotationsKey: {
            type: String,
            default: ''
        },
        contentZoom: {
            type: Number,
            default: 1
        }
    },
    data() {
        return {
            parsedPages: [],
            isParsing: false,
            warningShown: false,
            localBlacklist: [],
            zoom: 1,
            _saveTimer: null,
            _loadedAnnotationsKey: null,
        };
    },
    computed: {
        effectiveLoading() {
            return this.loading || this.isParsing;
        }
    },
    watch: {
        pdfBase64: {
            immediate: true,
            handler(newData) {
                this.processPdf(newData);
            }
        },
        contentZoom: {
            immediate: true,
            handler(v) {
                this.zoom = v || 1;
            }
        },
        annotationsKey: {
            immediate: true,
            handler(key) {
                if (!this.enableAnnotations) return;
                this.loadAnnotationsForKey(key);
            }
        },
        blacklist: {
            immediate: true,
            handler(newList) {
                this.localBlacklist = Array.isArray(newList) ? [...newList] : [];
            }
        },
        parsedPages: {
            handler(newPages) {
                // if (newPages && newPages.length > 0 && !this.warningShown) {
                //     const pagesWithWarning = newPages.filter(page => page.hasWarning);
                //     if (pagesWithWarning.length > 0) {
                //         this.showWarningDialog(pagesWithWarning);
                //     }
                // }
            },
            immediate: false
        }
    },
    beforeUnmount() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
    },
    methods: {
        onAnnotationsChange() {
            this.queueSaveAnnotations();
        },
        queueSaveAnnotations() {
            if (!this.enableAnnotations || !this._loadedAnnotationsKey) return;
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(() => this.saveAnnotations(), 250);
        },
        async loadAnnotationsForKey(key) {
            this._loadedAnnotationsKey = key || null;
            this.resetAnnotations();
            if (!key) return;
            try {
                const raw = await signalBridge.invoke('readPdfAnnotations', key);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                this.annotations = Array.isArray(parsed?.annotations) ? parsed.annotations : [];
            } catch (e) {
                console.warn('PdfOverlay: loadAnnotations failed', e);
                this.annotations = [];
            }
        },
        async saveAnnotations() {
            if (!this._loadedAnnotationsKey) return;
            try {
                const payload = JSON.stringify({ version: 1, annotations: this.annotations }, null, 2);
                await signalBridge.invoke('writePdfAnnotations', this._loadedAnnotationsKey, payload);
            } catch (e) {
                console.warn('PdfOverlay: saveAnnotations failed', e);
            }
        },
        async processPdf(base64Data) {
            if (!base64Data) {
                this.parsedPages = [];
                this.warningShown = false;
                if (this.enableAnnotations) this.resetAnnotations();
                return;
            }
            this.isParsing = true;
            this.warningShown = false; // Reset warning flag for new PDF
            try {
                await ensurePdfOverlayFontsReady();
                const uint8 = this.base64ToUint8Array(base64Data);
                this.parsedPages = await parsePdfToPages(uint8);
            } catch (error) {
                console.error('PdfOverlay: Failed to parse PDF data', error);
                this.parsedPages = [];
            } finally {
                this.isParsing = false;
            }
        },
        base64ToUint8Array(data) {
            const commaIndex = data.indexOf(',');
            const pureBase64 = commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
            const binaryString = atob(pureBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        },
        showWarningDialog(pagesWithWarning) {
            this.warningShown = true;
            // Find page numbers by checking which pages in parsedPages have warnings
            const pageNumbers = [];
            this.parsedPages.forEach((page, index) => {
                if (page.hasWarning) {
                    pageNumbers.push(index + 1);
                }
            });
            
            const pageLabel = pageNumbers.length === 1 ? this.$t('pdf.page') : this.$t('pdf.pages');
            const pageText = pageNumbers.length === 1 
                ? `${pageLabel} ${pageNumbers[0]}` 
                : `${pageLabel} ${pageNumbers.join(', ')}`;
            
            Swal.fire({
                icon: 'warning',
                title: this.$t('pdf.warningTitle'),
                html: `${this.$t('pdf.warningPrefix')} ${pageText} ${this.$t('pdf.warningMessage')}<br><br>${this.$t('pdf.warningMessage2')}`,
                confirmButtonText: this.$t('pdf.understood'),
               
                allowEscapeKey: true
            }).then(() => {
                this.warningShown = false;
            });
        },
        getCustomFieldsForPage(pageIndex) {
            if (!this.customFields || !Array.isArray(this.customFields)) {
                return [];
            }
            return this.customFields.filter(field => field.pageIndex === pageIndex);
        },
        isBlacklisted(fieldId) {
            return this.localBlacklist.includes(fieldId);
        }
    }
};
</script>

<style scoped>
.pdf-overlay-root {
    position: relative;
    width: 100%;
}

.overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 12px;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top-color: #0d6efd;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.pdf-scroll-container {
    background-color: #eee;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: fit-content;
}

.pdf-page-wrapper {
    position: relative;
    background: white;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.pdf-bg-image {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.pdf-warning {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    background: rgba(255, 193, 7, 0.9);
    color: #000;
    padding: 6px 10px;
    font-size: 0.85rem;
    border-radius: 4px;
    z-index: 20;
}

.pdf-warning p {
    margin: 0;
}

.pdf-empty-state {
    text-align: center;
    padding: 40px 0;
    color: #666;
}

.input-overlay {
    position: absolute;
}

.checkbox-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
}

.interactive-input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    margin: 0;
    background-color: rgba(255, 230, 0, 0.15);
    border: 1px solid transparent;
}

.interactive-input:focus {
    background-color: rgba(255, 255, 255, 0.9);
    border: 2px solid #0d6efd;
    outline: none;
    box-shadow: 0 0 5px rgba(13, 110, 253, 0.5);
}

.interactive-input.checkbox {
    cursor: pointer;
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 38, 255, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    appearance: none;
}

.interactive-input.checkbox:checked {
    background-color: rgba(13, 110, 253, 0.85);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23fff' d='M6.4 11.2 3.5 8.3l1.4-1.4 1.5 1.5 4.3-4.3 1.4 1.4z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 70% 70%;
}

.interactive-input.checkbox.deselect-checkbox {
    background-color: rgba(0, 255, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0;
}

.interactive-input.checkbox.deselect-checkbox:checked {
    background-color: rgba(0, 255, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.2);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cline x1='0' y1='100' x2='100' y2='0' stroke='%23000' stroke-width='8'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
}

.interactive-input.cloze {
    border-bottom: 0;
    background-color: rgba(0, 255, 0, 0.1);
}

.interactive-input.cloze:focus {
    background: #fff;
}

.interactive-input.table-cell {
    background-color: rgba(0, 255, 0, 0.05);
    border: none;
    padding: 5px;
}

.interactive-input.table-cell:focus {
    background-color: rgba(255, 255, 255, 0.9);
    border: 2px solid #0d6efd;
}

.interactive-input.text {
    background-color: rgba(0, 255, 0, 0.1);
    border: none;
    padding: 5px;
}

.interactive-input.text:focus {
    background-color: rgba(255, 255, 255, 0.9);
    border: 2px solid #0d6efd;
    outline: none;
}

.interactive-input.textarea {
    resize: none;
    background-color: rgba(0, 255, 0, 0.05);
    border: none;
    font-family: inherit;
    font-size: inherit;
    padding: 5px;
}

.interactive-input.textarea:focus {
    background-color: rgba(255, 255, 255, 0.95);
    border: 2px solid #0d6efd;
    outline: none;
}

.pdf-annotation-toolbar {
    position: fixed;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1200;
    list-style: none;
    margin: 0;
    padding: 6px 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.pdf-annotation-toolbar li {
    margin: 0;
    padding: 0;
}

.pdf-tool-btn {
    width: 36px;
    min-width: 36px;
    height: 36px;
    padding: 0 !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.pdf-tool-btn img {
    width: 18px;
    height: 18px;
}

.pdf-tool-btn.active {
    border: 2px solid rgba(13, 110, 253, 0.35) !important;
    background: transparent !important;
}

.tool-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.25);
    display: inline-block;
}

.tool-swatch--yellow { background: rgba(255, 255, 0, 1); }
.tool-swatch--green { background: rgba(0, 255, 90, 0.95); }
.tool-swatch--blue { background: rgba(0, 170, 255, 0.95); }

.tool-underline {
    width: 16px;
    height: 0;
    border-top: 3px solid rgba(220, 53, 69, 0.95);
    display: inline-block;
    border-radius: 2px;
}

.ann.highlight {
    mix-blend-mode: multiply;
}

.draft {
    position: absolute;
}

.ann-text-display {
    display: inline-block;
    font-size: 14px;
    line-height: 1.3;
    color: #111;
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
    color: #111;
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

@media print {
    .pdf-annotation-toolbar {
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

