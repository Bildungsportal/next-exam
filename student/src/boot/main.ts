import { defineBoot } from '#q-app/wrappers'
import i18n from "../locales/locales.js";
import VueSweetalert2 from "vue-sweetalert2";
import {createApp} from "vue";
import App from "../App.vue";

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

// --- ENDE DES BEREINIGTEN CODE ---

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
})
