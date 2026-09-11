<template>
    <div id="pages-root">
        <div v-for="(p, i) in printPages" :key="i" class="print-page" :style="{ width: p.width + 'px', height: p.height + 'px' }" >
            <img :src="p.imgSrc" alt="" />
        </div>
    </div>
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const PRINT_RENDER_SCALE = 3;

export default {
    name: 'SystemPrintPdf',
    data() {
        return {
            printPages: [],
        };
    },
    mounted() {
        this.ensurePdfWorker();
        this.runPrint();
    },
    methods: {
        ensurePdfWorker() {
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/legacy/build/pdf.worker.mjs',
                    import.meta.url
                ).href;
            }
        },
        base64ToUint8(data) {
            const comma = data.indexOf(',');
            const pure = comma >= 0 && data.slice(0, comma).includes('base64') ? data.slice(comma + 1) : data;
            const bin = atob(pure);
            const len = bin.length;
            const out = new Uint8Array(len);
            for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
            return out;
        },
        async rasterPdfToPrintPages(uint8) {
            const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: PRINT_RENDER_SCALE });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                pages.push({ width: viewport.width, height: viewport.height, imgSrc: canvas.toDataURL('image/png') });
            }
            return pages;
        },
        async runPrint() {
            const job = await window.ipcRenderer.invoke('print-consume-pending-job');
            if (!job || !job.printerName) {
                window.ipcRenderer.send('print-error', 'Missing print job or printer');
                return;
            }
            document.title = job.jobTitle || 'Next-Exam';
            try {
                const uint8 = this.base64ToUint8(job.docBase64);
                this.printPages = await this.rasterPdfToPrintPages(uint8);
                await this.$nextTick();
                const root = document.getElementById('pages-root');
                if (root) {
                    await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
                }
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                window.ipcRenderer.send('print-ready');
            } catch (err) {
                window.ipcRenderer.send('print-error', err && err.message ? err.message : String(err));
            }
        },
    },
};
</script>

<style scoped>
#pages-root {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    width: 100%;
    background: #fff;
}
.print-page {
    position: relative;
    flex: 0 0 auto;
    overflow: visible;
    background: #fff;
    page-break-after: always;
    break-after: page;
}
.print-page:last-child {
    page-break-after: auto;
    break-after: auto;
}
.print-page img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
@media print {
    @page {
        size: A4;
        margin: 0;
    }
    #pages-root {
        display: block;
        width: 100%;
    }
    .print-page {
        width: 100% !important;
        max-width: 210mm;
        height: auto !important;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        margin: 0 auto;
    }
    .print-page img {
        width: auto !important;
        height: auto !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        object-fit: contain;
    }
}
</style>

<style>
@media print {
    html,
    body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}
</style>
