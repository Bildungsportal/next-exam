<template>
    <div class="pdf-overlay-root" id="pdfrenderer" @click.stop>
        <ul class="nav nav-tabs position-sticky top-0 start-0 end-0 w-100 bg-white" style="z-index:2000; pointer-events:auto; font-size:1.1rem; height:45px; display: flex; align-items: center; flex-shrink: 0;">
            <li class="nav-item " style="margin-left: 10px;">
                <button 
                    type="button" 
                    class=" btn btn-sm" 
                    :class="editMode ? 'btn-warning' : 'btn-success'"
                    @click.stop="toggleEditMode"
                    style="min-width: 110px;"
                >
                    {{ editMode ? $t('pdf.save') : $t('pdf.edit') }}
                </button>
                <button 
                    type="button" 
                    class=" btn btn-sm btn-success" 
                    :disabled="localCustomFields.length === 0"
                    @click.stop="undoLastField"
                    style="  margin-left: 5px;"
                    title="Rückgängig"
                >
                    ↶
                </button>
            </li>
            <li class="nav-item position-absolute" style="right: 0;">  
                <div type="button" id="closePDF" class="nav-link btn btn-light btn-sm" :title="$t('dashboard.close')" @click.stop="closePane" style="width:40px; height:45px !important;text-align:center; font-weight:bold;">&times;</div> 
            </li>
        </ul>
        <div class="activesheets-banner">
            <div class="banner-pill">
                {{ $t('pdf.activesheets') }}
            </div>
        </div>
        <div v-if="editMode" class="edit-floating-menu">
            <button
                type="button"
                :class="['btn btn-sm edit-tool-btn', drawMode === 'textarea' ? 'edit-tool-active' : 'edit-tool-inactive']"
                @click.stop="setDrawMode('textarea')"
                title="Textfeld zeichnen"
            >
                <span class="edit-tool-icon edit-tool-icon-rect">▭</span>
                <span class="edit-tool-label">Textarea</span>
            </button>
            <button
                type="button"
                :class="['btn btn-sm edit-tool-btn', drawMode === 'checkbox' ? 'edit-tool-active' : 'edit-tool-inactive']"
                @click.stop="setDrawMode('checkbox')"
                title="Checkbox platzieren"
            >
                <span class="edit-tool-icon">☑</span>
                <span class="edit-tool-label">Checkbox</span>
            </button>
            <button
                type="button"
                :class="['btn btn-sm edit-tool-btn', drawMode === 'deselect' ? 'edit-tool-active' : 'edit-tool-inactive']"
                @click.stop="setDrawMode('deselect')"
                title="Deselect platzieren"
            >
                <span class="edit-tool-icon edit-tool-icon-deselect"></span>
                <span class="edit-tool-label">Deselect</span>
            </button>
            <button
                type="button"
                :class="['btn btn-sm edit-tool-btn', drawMode === 'textinput' ? 'edit-tool-active' : 'edit-tool-inactive']"
                @click.stop="setDrawMode('textinput')"
                title="Textfeld (1 Zeile) zeichnen"
            >
                <span class="edit-tool-icon">─</span>
                <span class="edit-tool-label">Text</span>
            </button>
        </div>
        <div v-if="effectiveLoading" class="overlay">
            <div class="spinner"></div>
            <p>Loading PDF...</p>
        </div>
        <div v-else-if="parsedPages.length > 0" class="pdf-scroll-container" :class="{ 'edit-mode': editMode }">
            <div
                v-for="(page, pageIndex) in parsedPages"
                :key="pageIndex"
                class="pdf-page-wrapper"
                :style="{ width: page.width + 'px', height: page.height + 'px' }"
                @mousedown="editMode ? startDrawing($event, pageIndex) : null"
                @mousemove="editMode && isDrawing ? updateDrawing($event, pageIndex) : null"
                @mouseup="editMode && isDrawing ? finishDrawing($event, pageIndex) : null"
                @mouseleave="editMode && isDrawing ? cancelDrawing() : null"
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

                <div
                    v-if="currentRect && currentRect.pageIndex === pageIndex"
                    class="drawing-rectangle"
                    :style="currentRect.style"
                ></div>
            </div>
        </div>
        <div v-else class="pdf-empty-state">
            <p>Keine PDF Seiten vorhanden.</p>
        </div>
    </div>
</template>

<script>
import { parsePdfToPages } from '../utils/pdfparser/index.js';
import Swal from 'sweetalert2';

export default {
    name: 'PdfOverlay',
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
        }
    },
    data() {
        return {
            parsedPages: [],
            isParsing: false,
            warningShown: false,
            editMode: false,
            localCustomFields: [],
            customFieldCounter: 0,
            drawMode: 'textinput',
            isDrawing: false,
            drawStart: null,
            currentRect: null
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
        customFields: {
            immediate: true,
            handler(newFields) {
                if (newFields && Array.isArray(newFields)) {
                    this.localCustomFields = JSON.parse(JSON.stringify(newFields));
                    if (newFields.length > 0) {
                        const maxId = Math.max(...newFields.map(f => {
                            const match = f.id?.match(/Custom(\d+)/);
                            return match ? parseInt(match[1]) : 0;
                        }));
                        this.customFieldCounter = maxId;
                    }
                } else {
                    this.localCustomFields = [];
                    this.customFieldCounter = 0;
                }
            }
        },
        parsedPages: {
            handler(newPages) {
                if (newPages && newPages.length > 0 && !this.warningShown) {
                    const pagesWithWarning = newPages.filter(page => page.hasWarning);
                    if (pagesWithWarning.length > 0) {
                        this.showWarningDialog(pagesWithWarning);
                    }
                }
            },
            immediate: false
        }
    },
    methods: {
        async processPdf(base64Data) {
            if (!base64Data) {
                this.parsedPages = [];
                this.warningShown = false;
                return;
            }
            this.isParsing = true;
            this.warningShown = false; // Reset warning flag for new PDF
            try {
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
        closePane() {
            this.$emit('close');
        },
        toggleEditMode() {
            if (this.editMode) {
                // Save mode: emit customFields before turning off edit mode
                this.$emit('save-custom-fields', JSON.parse(JSON.stringify(this.localCustomFields)));
            }
            this.editMode = !this.editMode;
            if (!this.editMode) {
                this.cancelDrawing();
            }
        },
        setDrawMode(mode) {
            this.drawMode = mode;
        },
        startDrawing(event, pageIndex) {
            event.preventDefault();
            event.stopPropagation();

            // Checkbox placement mode: place checkbox instantly at click position
            if (this.drawMode === 'checkbox' || this.drawMode === 'deselect') {
                const pageWrapper = event.currentTarget;
                const rect = pageWrapper.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                this.customFieldCounter++;
                const size = this.drawMode === 'deselect' ? 24 : 18;
                const half = size / 2;
                const customField = {
                    id: `Custom${this.customFieldCounter}`,
                    type: this.drawMode,
                    pageIndex: pageIndex,
                    style: {
                        position: 'absolute',
                        left: x - half + 'px',
                        top: y - half + 'px',
                        width: size + 'px',
                        height: size + 'px'
                    }
                };
                this.localCustomFields.push(customField);
                // Ensure edit mode stays on to allow saving
                if (!this.editMode) {
                    this.editMode = true;
                }
                return;
            }

            // Textarea or textinput drawing mode
            const pageWrapper = event.currentTarget;
            const rect = pageWrapper.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.isDrawing = true;
            this.drawStart = { x, y, pageIndex };
            this.currentRect = {
                pageIndex,
                style: {
                    position: 'absolute',
                    left: x + 'px',
                    top: y + 'px',
                    width: '0px',
                    height: '0px',
                    border: '2px dashed #0d6efd',
                    pointerEvents: 'none',
                    zIndex: 1000
                }
            };
        },
        updateDrawing(event, pageIndex) {
            if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return;
            event.preventDefault();
            event.stopPropagation();
            const pageWrapper = event.currentTarget;
            const rect = pageWrapper.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;
            const startX = this.drawStart.x;
            const startY = this.drawStart.y;
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            let height = Math.abs(currentY - startY);
            if (this.drawMode === 'textinput') {
                height = Math.max(20, Math.min(height, 30));
            }
            this.currentRect = {
                pageIndex,
                style: {
                    position: 'absolute',
                    left: left + 'px',
                    top: top + 'px',
                    width: width + 'px',
                    height: height + 'px',
                    border: '2px dashed #0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    pointerEvents: 'none',
                    zIndex: 1000
                }
            };
        },
        finishDrawing(event, pageIndex) {
            if (!this.isDrawing || !this.drawStart || this.drawStart.pageIndex !== pageIndex) return;
            event.preventDefault();
            event.stopPropagation();
            const pageWrapper = event.currentTarget;
            const rect = pageWrapper.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;
            const startX = this.drawStart.x;
            const startY = this.drawStart.y;
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            if (width > 10 && height > 10) {
                this.customFieldCounter++;
                const fieldType = this.drawMode === 'textinput' ? 'textinput' : 'textarea';
                const fieldHeight = this.drawMode === 'textinput' ? Math.max(20, Math.min(height, 30)) : height;
                const customField = {
                    id: `Custom${this.customFieldCounter}`,
                    type: fieldType,
                    pageIndex: pageIndex,
                    style: {
                        position: 'absolute',
                        left: left + 'px',
                        top: top + 'px',
                        width: width + 'px',
                        height: fieldHeight + 'px'
                    }
                };
                this.localCustomFields.push(customField);
            }
            this.cancelDrawing();
        },
        cancelDrawing() {
            this.isDrawing = false;
            this.drawStart = null;
            this.currentRect = null;
        },
        undoLastField() {
            if (this.localCustomFields.length > 0) {
                this.localCustomFields.pop();
                // Activate edit mode to allow saving the change
                if (!this.editMode) {
                    this.editMode = true;
                }
            }
        },
        getCustomFieldsForPage(pageIndex) {
            return this.localCustomFields.filter(field => field.pageIndex === pageIndex);
        }
    }
};
</script>

<style>
/* Fonts made from <a href="http://www.webfontfree.com">Web Font Free</a> is licensed by CC BY 4.0 */
@font-face {
    font-family: 'hv';
    src: url('/src/assets/fonts/HelveticaNeueLTPro-Lt.woff2') format('woff2');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'carlito-bold';
    src: url('/src/assets/fonts/Carlito-Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'carlito-regular';
    src: url('/src/assets/fonts/Carlito-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'carlito-italic';
    src: url('/src/assets/fonts/Carlito-Italic.ttf') format('truetype');
    font-weight: normal;
    font-style: italic;
    font-display: swap;
}

@font-face {
    font-family: 'carlito-bold-italic';
    src: url('/src/assets/fonts/Carlito-BoldItalic.ttf') format('truetype');
    font-weight: bold;
    font-style: italic;
    font-display: swap;
}
@font-face {
    font-family: 'Latin-Modern-Math';
    src: url('/src/assets/fonts/LatinmodernmathRegular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'caladea';
    src: url('/src/assets/fonts/Caladea-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'dejavuserif';
    src: url('/src/assets/fonts/DejaVuSerif.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
} 
@font-face {
    font-family: 'notosanssymbols';
    src: url('/src/assets/fonts/NotoSansSymbols-VariableFont_wght.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}




</style>

<style scoped>
.pdf-overlay-root {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 6px;
    box-shadow: 0 0 15px rgba(22, 9, 9, 0.5);
    overflow: hidden;
}

.overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
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
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    position: relative;
}

.pdf-scroll-container.edit-mode {
    cursor: crosshair;
}

.pdf-page-wrapper {
    position: relative;
    background: white;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.pdf-page-wrapper.edit-mode-active {
    cursor: crosshair;
}

.drawing-rectangle {
    position: absolute;
    pointer-events: none;
    z-index: 1000;
}

.edit-floating-menu {
    position: absolute;
    top: 55px;
    left: 10px;
    z-index: 2100;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.edit-tool-btn {
    width: 55px;
    height: 55px;
    padding: 2px 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    line-height: 1;
    border-radius: 6px;
    border: 1px solid transparent;
    box-shadow: none;
}

.edit-tool-inactive {
    background-color: rgba(13, 110, 253, 0.08);
    border-color: rgba(13, 110, 253, 0.25);
    color: #444;
}

.edit-tool-inactive:hover {
    background-color: rgba(13, 110, 253, 0.16);
    border-color: rgba(13, 110, 253, 0.38);
    color: #222;
}

.edit-tool-icon {
    font-size: 1rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.edit-tool-icon-rect {
    font-size: 1.5rem;
}

.edit-tool-icon-deselect {
    width: 20px;
    height: 16px;
    border: 1px solid #333;
    border-radius: 0px;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 110% 110%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cline x1='0' y1='100' x2='100' y2='0' stroke='%23000' stroke-width='6'/%3E%3C/svg%3E");
}

.edit-tool-label {
    font-size: 0.65rem;
    line-height: 1;
    margin-top: 2px;
}

.edit-tool-active {
    color: #5a3c00;
    background-color: rgba(255, 235, 186, 0.9);
    border-color: #f5c06a;
}

.edit-tool-active:hover {
    background-color: rgba(255, 235, 186, 1);
    border-color: #e0a94f;
    color: #5a3c00;
}

.activesheets-banner {
    position: fixed;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1800;
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
background-color: transparent;
}

.banner-pill {
    min-width:620px;
    max-width: 90%;
    padding: 6px 12px;
    text-align: center;
    font-size: 0.95rem;
    color: #5a3c00;
    background-color: #ffeeba6c;
    border: 1px solid #f5c06a;
    border-radius: 15px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    pointer-events: none;
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
    pointer-events: auto;
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
    appearance: none;
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.interactive-input.checkbox:checked {
    background-color: rgba(13, 109, 253, 0.5);
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
    font-size: 14px;
}

.interactive-input.cloze:focus {
    background: #fff;
}

.interactive-input.table-cell {
    background-color: rgba(0, 255, 0, 0.1);
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
    background-color: rgba(0, 255, 0, 0.1);
   
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
</style>

