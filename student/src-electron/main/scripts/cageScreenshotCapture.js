import log from 'electron-log';

const SCREENSHOT_MAX_WIDTH = 1200;
const HEADER_CROP_HEIGHT = 150;

/** Builds screenshot payload from a NativeImage (same shape as renderer captureFrameFromVideo). */
function frameFromNativeImage(image) {
    if (!image || image.isEmpty()) return null;
    const { width, height } = image.getSize();
    if (!width || !height) return null;

    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / width);
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    const resized = image.resize({ width: sw, height: sh, quality: 'good' });

    const headerHeight = Math.min(HEADER_CROP_HEIGHT, sh);
    const headerImg = resized.crop({ x: 0, y: 0, width: sw, height: headerHeight });

    const screenshotBase64 = resized.toJPEG(85).toString('base64');
    const headerBase64 = headerImg.toJPEG(85).toString('base64');

    // isAllBlack is a Windows getDisplayMedia concern only; Cage capturePage is never flagged black
    return { screenshotBase64, headerBase64, isblack: false };
}

/** Captures the active Next-Exam window via webContents.capturePage. */
export async function captureActiveWindowScreenshot(WindowHandler, multicastClient) {
    const examWin = WindowHandler?.examwindow;
    const useExam = examWin && !examWin.isDestroyed() && multicastClient?.clientinfo?.exammode;
    const win = useExam ? examWin : WindowHandler?.mainwindow;
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
