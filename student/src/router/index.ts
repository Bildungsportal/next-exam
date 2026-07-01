/**
 * VUE.js Frontend - Routing
 */
import {createRouter, createWebHashHistory} from 'vue-router'
import {defineRouter} from '#q-app/wrappers';

/**
 * @license GPL LICENSE
 * Copyright (c) 2021-2023 Thomas Michael Weissel
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
// Import student directly since it's the initial route and needs to be available immediately
import student from '/src/pages/student.vue'
import {useConfigStore} from "../stores/configStore.js";
import {useInfoStore} from "../stores/infoStore.js";
// Lazy load other components for faster initial load
const notfound = () => import('/src/pages/notfound.vue')
const editor = () => import('/src/pages/editor.vue')
const geogebra = () => import('/src/pages/geogebra.vue')
const forms = () => import('/src/pages/forms.vue')
const lock = () => import('/src/pages/lock.vue')
const eduvidual = () => import('/src/pages/eduvidual.vue')
const microsoft365 = () => import('/src/pages/microsoft365.vue')
const website = () => import('/src/pages/website.vue')
const activesheets = () => import('/src/pages/activesheets.vue')
const rdpview = () => import('/src/pages/rdpview.vue')
const localvmview = () => import('/src/pages/localvmview.vue')


//console.log(config)  // config is exposed to the renderer (frontend) in preload.js (it's readonly here!)

// check if we run this app in electron (host is always "localhost" then)
let electron = false
const userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf(' electron/') > -1) {
    electron = true
}

const routes = [ // to load a specific view just replace the component at path: /
    { path: '/',                    name:"index",        component: student,      beforeEnter: []          },    // default component "student"
    { path: '/student',             name:"student",      component: student,      beforeEnter: []          },
    { path: '/editor/:token/:section',       name:"editor",       component: editor,       beforeEnter: [fetchInfo] },
    { path: '/math/:token/:section',         name:"math",         component: geogebra,     beforeEnter: [fetchInfo] },
    { path: '/forms/:token/:section',        name:"forms",        component: forms,        beforeEnter: [fetchInfo] },
    { path: '/eduvidual/:token/:section',    name:"eduvidual",    component: eduvidual,    beforeEnter: [fetchInfo] },
    { path: '/website/:token/:section',      name:"website",      component: website,      beforeEnter: [fetchInfo] },
    { path: '/activesheets/:token/:section', name:"activesheets", component: activesheets, beforeEnter: [fetchInfo] },
    { path: '/microsoft365/:token/:section', name:"microsoft365", component: microsoft365, beforeEnter: [fetchInfo] },
    { path: '/lock',                name:"lock",         component: lock },
    { path: '/rdp/:token/:section',          name:"rdp",          component: rdpview,      beforeEnter: [fetchInfo] },
    { path: '/localvm/:token/:section',      name:"localvm",      component: localvmview,  beforeEnter: [fetchInfo] },
    { path: '/:pathMatch(.*)*',     name:"404",          component: notfound },  
]

/**
 * push a lot of infos to the view
 */
async function fetchInfo() {
  return useInfoStore().updateInfo();
}


export default defineRouter(function ( { store }) {

// check if we run this app in electron (host is always "localhost" then)
    let configStore = useConfigStore(store);
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf(' electron/') > -1) {
        configStore.electron = true;
    }

    return createRouter({history: createWebHashHistory(), routes});   // use appropriate history implementation for server/client // import.meta.env.SSR is injected by Vite.
});
