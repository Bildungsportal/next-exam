import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.mjs', import.meta.url).href;

const PRINT_RENDER_SCALE = 1.5;

async function rasterPdfToPrintPages(uint8) {
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: PRINT_RENDER_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        pages.push({ width: viewport.width, height: viewport.height, imgSrc: canvas.toDataURL('image/jpeg', 0.92) });
    }
    return pages;
}

async function main() {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get('fileUrl');
    const printerName = params.get('printer');
    const title = params.get('title') || 'Next-Exam';

    if (!fileUrl || !printerName) {
        window.printBridge.error('Missing fileUrl or printer param');
        return;
    }

    document.title = title;

    try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
        const uint8 = new Uint8Array(await res.arrayBuffer());
        const pages = await rasterPdfToPrintPages(uint8);

        const root = document.getElementById('pages-root');
        root.replaceChildren();
        for (const p of pages) {
            const wrap = document.createElement('div');
            wrap.className = 'print-page';
            wrap.style.width = `${p.width}px`;
            wrap.style.height = `${p.height}px`;
            const img = document.createElement('img');
            img.src = p.imgSrc;
            img.alt = '';
            wrap.appendChild(img);
            root.appendChild(wrap);
        }

        await Promise.all([...root.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
        // two rAF: let Chromium commit layout before print()
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Signal Main that the DOM is ready — Main calls webContents.print() with silent + deviceName options.
        window.printBridge.ready();
    } catch (err) {
        window.printBridge.error(err.message);
    }
}

main();
