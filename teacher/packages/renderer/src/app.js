/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */

import { createApp } from 'vue'
import App from './App.vue'
import { createRouter } from './router'
import i18n from './locales/locales.js'
import VueSweetalert2 from 'vue-sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import './assets/custom.scss'

const options = {
    confirmButtonColor: '#198754',
    cancelButtonColor: '#b02a37',
};

const router = createRouter()
const vApp = createApp(App)

vApp.use(router)
vApp.use(i18n)
vApp.use(VueSweetalert2, options)
//vApp.config.unwrapInjectedRef = true  // should not be neccecary in future versions (suppress specific warning)

// wait until router is ready before mounting to ensure hydration match
router.isReady().then(() => {
    vApp.mount('#app')
})