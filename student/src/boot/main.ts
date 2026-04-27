import { defineBoot } from '#q-app/wrappers'
import i18n from "../locales/locales.js";
import VueSweetalert2 from "vue-sweetalert2";
import config from '../utils/config.js';
import NavigationHandler from "../utils/navigationHandler.js";
import multicastclient from "../../src-electron/main/scripts/multicastclient.js";
import LoggingBridge from "../utils/loggingBridge.js";
import IosTaskDispatcher from "../utils/ios/iosTaskDispatcher.js";
import {isIOS} from "../types/platform.js";
import { ipcRenderer as capacitorIpcRenderer } from "../plugins/ipc-renderer.js";

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli-vite/boot-files
export default defineBoot(async ( { app, router } ) => {
    const options = {
        confirmButtonColor: '#198754',
        cancelButtonColor: '#ff7674',

        // HIER verschieben wir den globalen Hook (als Teil der Standardoptionen)
        didOpen: (popup) => {
            // Elemente finden: popup (vom Hook übergeben), Container und Backdrop (über DOM-Query)
            const elementsToControl = [
                popup,
                document.querySelector('.swal2-container'),
            ];

            // Transitions entfernen, um Flimmern bei schnellen Events (wie Druck) zu verhindern
            elementsToControl
                .filter(el => el)
                .forEach(el => {
                    el.style.transition = 'none';
                    el.style.animation = 'none';
                    el.style.webkitAnimation = 'none';
                    el.style.webkitTransition = 'none';
                });
        }
    };
    app.config.globalProperties.$config = config;

    app.use(i18n)
// Das Plugin wird mit den Optionen installiert, die nun den globalen didOpen Hook enthalten.
    app.use(VueSweetalert2, options)

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
    LoggingBridge.init(window);
    NavigationHandler.init(LoggingBridge, multicastclient, config, router);
    IosTaskDispatcher.init(LoggingBridge, multicastclient, NavigationHandler);

    if (isIOS()) {
        window.ipcRenderer = capacitorIpcRenderer
    }
})
