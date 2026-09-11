import log from 'electron-log';

const SCREENSHOT_MAX_WIDTH = 1200;

/** Builds screenshot payload from a NativeImage (same shape as renderer captureFrameFromVideo). */
function frameFromNativeImage(image) {
    if (!image || image.isEmpty()) return null;
    const { width, height } = image.getSize();
    if (!width || !height) return null;

    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / width);
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    const resized = image.resize({ width: sw, height: sh, quality: 'good' });

    const screenshotBase64 = resized.toJPEG(85).toString('base64');

    return { screenshotBase64 };
}

/** Captures the active Next-Exam window via webContents.capturePage. */
export async function captureActiveWindowScreenshot(WindowHandler, multicastClient) {
    const win = WindowHandler?.mainWin();
    if (!win || win.isDestroyed()) {
        log.warn('cageScreenshotCapture @ captureActiveWindowScreenshot: no target window');
        return null;
    }
    try {
        const image = await win.webContents.capturePage();
        return frameFromNativeImage(image);
    } catch (err) {
        log.warn('cageScreenshotCapture @ captureActiveWindowScreenshot:', err?.message || err);
        return null;
    }
}
