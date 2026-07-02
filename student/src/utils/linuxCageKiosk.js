import { isElectronWindow } from '../types/platform';

let kioskInfoCache = null;

/** Cached Linux kiosk flags from main process (Cage install/session). */
export async function getLinuxKioskInfo(signalBridge) {
    if (kioskInfoCache) return kioskInfoCache;
    if (!isElectronWindow(window)) {
        kioskInfoCache = {
            cageInstalled: false,
            runningInCage: false,
            isWindowsKioskUser: false,
            assignedAccessActive: false,
            cageKioskAppImageInstalled: false,
            cageKioskDesktopInstalled: false,
            needsCageKioskSetup: false,
            displayServer: 'n/a',
            platform: 'n/a',
        };
        return kioskInfoCache;
    }
    kioskInfoCache = await signalBridge.invoke('get-platform-info');
    return kioskInfoCache;
}

/** Edge focus guards (mouseleave/blur) are disabled in Cage — false positives at screen edges. */
function shouldUseEdgeFocusGuards(platformKiosk, development = false) {
    if (development) return false;
    return !platformKiosk?.runningInCage;
}

/** True when mouseleave/focuslost edge guards should be skipped (e.g. Cage). */
export async function shouldSkipEdgeFocusLost(signalBridge, development = false) {
    const kiosk = await getLinuxKioskInfo(signalBridge);
    return !shouldUseEdgeFocusGuards(kiosk, development);
}

/** Registers body mouseleave for sendFocuslost unless Cage or development. */
export async function attachExamMouseleaveGuard(signalBridge, config, handler) {
    if (config?.development) return;
    const kiosk = await getLinuxKioskInfo(signalBridge);
    if (shouldUseEdgeFocusGuards(kiosk, config?.development)) {
        document.body.addEventListener('mouseleave', handler);
    }
}

/** Registers body mouseleave for sendFocuslost unless Cage or development. */
export async function attachExamMouseleaveGuardBoolean(signalBridge, development, handler) {
    if (development) return;
    const kiosk = await getLinuxKioskInfo(signalBridge);
    if (shouldUseEdgeFocusGuards(kiosk, development)) {
        document.body.addEventListener('mouseleave', handler);
    }
}
