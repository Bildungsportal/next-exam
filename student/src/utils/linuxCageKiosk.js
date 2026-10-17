import { isElectronWindow } from '../types/platform';
import loggingBridge from './loggingBridge.js';

let kioskInfoCache = null;
const mouseleaveWrappers = new WeakMap();
let lastPenTouchAt = 0;
// pen lift / touch end fires compat mouseleave with edge coords right after its pointerout → skip only those (time-bound, never sticky)
['pointerdown', 'pointermove', 'pointerup', 'pointerout'].forEach((t) => document.addEventListener(t, (e) => {
    if (e.pointerType !== 'mouse') lastPenTouchAt = Date.now();
}, true));

/** Cached Linux kiosk flags from main process (Cage install/session). */
export async function getLinuxKioskInfo() {
    if (kioskInfoCache) return kioskInfoCache;
    if (!isElectronWindow(window)) {
        kioskInfoCache = {
            cageInstalled: false,
            runningInCage: false,
            cageKioskAppImageInstalled: false,
            cageKioskDesktopInstalled: false,
            needsCageKioskSetup: false,
            displayServer: 'n/a',
            platform: 'n/a',
        };
        return kioskInfoCache;
    }
    kioskInfoCache = await window.ipcRenderer.invoke('get-platform-info');
    return kioskInfoCache;
}

/** Edge focus guards (mouseleave/blur) are disabled in Cage — false positives at screen edges. */
function shouldUseEdgeFocusGuards(platformKiosk, development = false) {
    if (development) return false;
    return !platformKiosk?.runningInCage;
}

/** True when mouseleave/focuslost edge guards should be skipped (e.g. Cage). */
export async function shouldSkipEdgeFocusLost(development = false) {
    const kiosk = await getLinuxKioskInfo();
    return !shouldUseEdgeFocusGuards(kiosk, development);
}

/** Registers body mouseleave for sendFocuslost unless Cage or development; ignores leaves with cursor inside the window. */
export async function attachExamMouseleaveGuardBoolean(development, handler) {
    if (development) return;
    const kiosk = await getLinuxKioskInfo();
    if (!shouldUseEdgeFocusGuards(kiosk, development)) return;
    // header <-> browserview/webview/canvas and DOM swaps fire mouseleave mid-window - only an edge exit is real
    const wrapper = (e) => {
        if (Date.now() - lastPenTouchAt < 500) {
            loggingBridge.warn(`mouseleave ignored: pen/touch input ${Date.now() - lastPenTouchAt}ms ago`);
            return;
        }
        const edge = 2;
        const inside = e?.clientX > edge && e?.clientY > edge
            && e?.clientX < window.innerWidth - edge && e?.clientY < window.innerHeight - edge;
        if (inside) {
            loggingBridge.warn(`mouseleave ignored: inside window (x=${e?.clientX} y=${e?.clientY} win=${window.innerWidth}x${window.innerHeight})`);
            return;
        }
        handler(e);
    };
    mouseleaveWrappers.set(handler, wrapper);
    document.body.addEventListener('mouseleave', wrapper);
}

/** Removes the body mouseleave guard registered for handler. */
export function detachExamMouseleaveGuard(handler) {
    const wrapper = mouseleaveWrappers.get(handler);
    if (!wrapper) return;
    document.body.removeEventListener('mouseleave', wrapper);
    mouseleaveWrappers.delete(handler);
}
