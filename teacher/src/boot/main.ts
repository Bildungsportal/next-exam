import { defineBoot } from "#q-app/wrappers";
import i18n from "../locales/locales.js";
import VueSweetalert2 from "vue-sweetalert2";
import 'bootstrap/dist/js/bootstrap.bundle.min';

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli-vite/boot-files
export default defineBoot(async ( { app } ) => {
    const options = {
        confirmButtonColor: '#0aa2c0',
        cancelButtonColor: '#6c757d',
    };
    app.use(i18n);
    app.use(VueSweetalert2, options);
})
