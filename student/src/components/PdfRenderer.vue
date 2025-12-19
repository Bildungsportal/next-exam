<template>
    <div class="pdf-overlay-root">
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
            warningShown: false
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
        getCustomFieldsForPage(pageIndex) {
            if (!this.customFields || !Array.isArray(this.customFields)) {
                return [];
            }
            return this.customFields.filter(field => field.pageIndex === pageIndex);
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
</style>

