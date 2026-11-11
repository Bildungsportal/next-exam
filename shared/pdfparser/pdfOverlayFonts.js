import './pdfOverlayFonts.css';

/** CSS font-family aliases used by pdfparser fontAdjustments + @font-face. */
export const PDF_OVERLAY_FONT_FAMILIES = [
    'hv',
    'carlito-regular',
    'carlito-bold',
    'carlito-italic',
    'carlito-bold-italic',
    'Latin-Modern-Math',
    'caladea',
    'dejavuserif',
    'notosanssymbols',
    'liberation-sans-regular',
    'liberation-sans-bold',
    'liberation-sans-italic',
    'liberation-sans-bold-italic',
    'liberation-serif-regular',
    'liberation-serif-bold',
    'liberation-serif-italic',
    'liberation-serif-bold-italic',
];

/** Load overlay webfonts before canvas.measureText in pdfparser. */
export async function ensurePdfOverlayFontsReady() {
    if (!document?.fonts) return;
    try {
        await Promise.all([
            ...PDF_OVERLAY_FONT_FAMILIES.map((family) => document.fonts.load(`16px ${family}`)),
            document.fonts.ready,
        ]);
    } catch (e) {
        console.warn('PdfOverlay: font loading skipped', e?.message || e);
    }
}
