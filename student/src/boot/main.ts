import { defineBoot } from "#q-app/wrappers";
import i18n from "../locales/locales.js";
import VueSweetalert2 from "vue-sweetalert2";

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli-vite/boot-files
export default defineBoot(async ( { app, router } ) => {
    const options = {
        confirmButtonColor: '#0aa2c0',
        cancelButtonColor: '#6c757d',

        // register the global hook here (as part of the default options)
        didOpen: (popup) => {
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
        }
    };

    app.use(i18n);
// Das Plugin wird mit den Optionen installiert, die nun den globalen didOpen Hook enthalten.
    app.use(VueSweetalert2, options);

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
