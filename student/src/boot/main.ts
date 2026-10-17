import { defineBoot } from "#q-app/wrappers";
import i18n from "../locales/locales.js";
import Swal from 'sweetalert2';
import config from '../utils/config.js';
import {isIOS} from "../types/platform.js";
import { ipcRenderer as capacitorIpcRenderer } from "../plugins/ipc-renderer.js";
import IosUpdateListener from "../utils/ios/iosUpdateListener.ts";
import PdfHelper from "../utils/pdfHelper.ts";
import { useInfoStore } from "../stores/infoStore.ts";


// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli-vite/boot-files
export default defineBoot(async ( { app, router } ) => {
    const options = {
        confirmButtonColor: '#0aa2c0',
        cancelButtonColor: '#6c757d',
    };

    const hideNativeWebviewsForPopup = () => {
        if (isIOS()) window.ipcRenderer.invoke('set-native-webviews-hidden-for-popup', true);
    };
    const showNativeWebviewsForPopup = () => {
        if (isIOS()) window.ipcRenderer.invoke('set-native-webviews-hidden-for-popup', false);
    };

    // Office BrowserView stays collapsed while any MS365 swal is open, unless preview or focus-loss already owns it.
    let ms365SwalDepth = 0;
    const isMs365Exam = () => {
        try { if (useInfoStore().examtype === 'microsoft365') return true } catch { /* pinia not ready */ }
        return `${window.location.hash}${window.location.pathname}`.includes('/microsoft365');
    };
    const ms365HeldByOtherUi = () => {
        const preview = document.querySelector('#preview') as HTMLElement | null;
        if (preview && preview.style.display === 'block') return true;
        return !!document.getElementById('focuswarning');
    };
    const collapseMs365ForSwal = () => {
        if (!isMs365Exam()) return false;
        ms365SwalDepth += 1;
        if (ms365SwalDepth === 1) window.ipcRenderer?.send('collapse-browserview');
        return true;
    };
    // deferred: willClose fires while the popup is still mounted, and a fire() that replaces an open
    // popup skips its close hooks entirely - so restore only once no popup is left on screen
    const restoreMs365AfterSwal = (counted) => {
        if (!counted) return;
        setTimeout(() => {
            if (Swal.isVisible()) return;
            ms365SwalDepth = 0;
            if (isMs365Exam() && !ms365HeldByOtherUi()) window.ipcRenderer?.send('restore-browserview');
        }, 0);
    };

    // Wrap Swal.fire so every dialog hides native iOS WKWebViews on open and restores them on close.
    // Done at fire level (not plugin options) because per-call options (e.g. didOpen for showLoading/focus)
    // override plugin defaults — a plugin-level hook would miss those dialogs.
    const rawSwalFire = Swal.fire;
    (Swal as any).fire = function (this: any, ...args: any[]) {
        const opts = args.length === 1 && args[0] && typeof args[0] === 'object' && !(args[0] instanceof Element)
            ? args[0]
            : { title: args[0], html: args[1], icon: args[2] };
        let counted = false;
        let settled = false;
        const prevActive = document.activeElement as HTMLElement | null;
        const finishMs365Swal = () => {
            if (settled) return;
            settled = true;
            restoreMs365AfterSwal(counted);
        };
        return rawSwalFire.call(this, {
            ...opts,
            // swal's own returnFocus calls focus() without preventScroll → editor scrolls back to caret
            returnFocus: false,
            willOpen: (popup) => {
                counted = collapseMs365ForSwal();
                opts.willOpen?.(popup);
            },
            willClose: (popup) => {
                opts.willClose?.(popup);
                finishMs365Swal();
            },
            didOpen: (popup) => {
                opts.didOpen?.(popup);
                hideNativeWebviewsForPopup();

                // find elements: popup (passed from hook), container and backdrop (via DOM query)
                const elementsToControl = [
                    popup,
                    document.querySelector('.swal2-container'),
                ];

                // Remove transitions to prevent flickering on rapid events (like printing)
                elementsToControl
                    .filter(el => el)
                    .forEach(el => {
                        el.style.transition = 'none';
                        el.style.animation = 'none';
                        el.style.webkitAnimation = 'none';
                        el.style.webkitTransition = 'none';
                    });
            },
            didClose: () => {
                opts.didClose?.();
                showNativeWebviewsForPopup();
                finishMs365Swal();
                prevActive?.focus?.({ preventScroll: true });
            },
        });
    };

    // vue-sweetalert2 bundles its own copy of sweetalert2, so its $swal would bypass the wrap above.
    // Build $swal from the same (wrapped) sweetalert2 instance instead.
    const SwalMixin = Swal.mixin(options);
    const $swal: any = (...d: any[]) => SwalMixin.fire.call(SwalMixin, ...d);
    Object.assign($swal, Swal);
    Object.keys(Swal).filter((k) => typeof (Swal as any)[k] === 'function').forEach((k) => {
        $swal[k] = (SwalMixin as any)[k].bind(SwalMixin);
    });
    app.config.globalProperties.$swal = $swal;
    app.provide('$swal', $swal);

    app.config.globalProperties.$config = config;

    app.use(i18n);

// wait until router is ready before mounting to ensure hydration match
    router.isReady().then(() => {
        // Hide initial loading overlay from index.html with fade-out (works for all views)
        const initialOverlay = document.getElementById('initial-loading-overlay');
        if (initialOverlay) {
            initialOverlay.classList.add('fade-out');
            setTimeout(() => {
                initialOverlay.style.display = 'none';
            }, 300);
        }
    })

    if (isIOS()) {
        window.ipcRenderer = capacitorIpcRenderer
        IosUpdateListener.init();
    }

    PdfHelper.init();
})
