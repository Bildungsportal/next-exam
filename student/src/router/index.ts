/**
 * VUE.js Frontend - Routing
 */
import {createRouter, createWebHashHistory, RouteLocationNormalized, RouteLocationNormalizedLoaded} from 'vue-router'
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
// Lazy load other components for faster initial load
const notfound = () => import('/src/pages/notfound.vue')
const editor = () => import('/src/pages/editor.vue')
const geogebra = () => import('/src/pages/geogebra.vue')
const gforms = () => import('/src/pages/forms.vue')
const lock = () => import('/src/pages/lock.vue')
const eduvidual = () => import('/src/pages/eduvidual.vue')
const microsoft365 = () => import('/src/pages/microsoft365.vue')
const website = () => import('/src/pages/website.vue')
const activesheets = () => import('/src/pages/activesheets.vue')
const rdpview = () => import('/src/pages/rdpview.vue')



import {isElectronWindow} from '../types/platform.js';
import {SignalBridge} from '../utils/signalBridge.js';

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);



//console.log(config)  // config is exposed to the renderer (frontend) in preload.js (it's readonly here!)

// check if we run this app in electron (host is always "localhost" then)
let electron = false
const userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf(' electron/') > -1) {
    electron = true
}

const routes = [ // to load a specific view just replace the component at path: /
    { path: '/',                    name:"index",        component: student,      beforeEnter: [addParams]            },    // default component "student"
    { path: '/student',             name:"student",      component: student,      beforeEnter: [addParams]            },
    { path: '/editor/:token',       name:"editor",       component: editor,       beforeEnter: [addParams, fetchInfo] },  
    { path: '/math/:token',         name:"math",         component: geogebra,     beforeEnter: [addParams, fetchInfo] },
    { path: '/gforms/:token',       name:"gforms",       component: gforms,       beforeEnter: [addParams, fetchInfo] },
    { path: '/eduvidual/:token',    name:"eduvidual",    component: eduvidual,    beforeEnter: [addParams, fetchInfo] },
    { path: '/website/:token',      name:"website",      component: website,      beforeEnter: [addParams, fetchInfo] },
    { path: '/activesheets/:token', name:"activesheets", component: activesheets, beforeEnter: [addParams, fetchInfo] },
    { path: '/microsoft365/:token', name:"microsoft365", component: microsoft365, beforeEnter: [addParams, fetchInfo] },
    { path: '/lock',                name:"lock",         component: lock },
    { path: '/rdp/:token',          name:"rdp",          component: rdpview,      beforeEnter: [addParams, fetchInfo] },
    { path: '/:pathMatch(.*)*',     name:"404",          component: notfound },  
]

// TODO Search fitting type that allows non-string params
function addParams(to: any) {
    if (isElectronWindow()) {
        const config = require('../utils/config.js');
        to.params.version = config.version
        to.params.serverApiPort = config.serverApiPort
        //to.params.clientApiPort = config.clientApiPort
        to.params.electron = electron
        to.params.config = config
    }
}


/**
 * push a lot of infos to the view
 */
async function fetchInfo(to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded) {
  let response = await signalBridge.invoke('getinfoasync')
  if (response) {
    let clientinfo = response.clientinfo
    let serverstatus = response.serverstatus

    to.params.serverstatus = serverstatus
    to.params.examtype = clientinfo.examtype
    to.params.serverip = clientinfo.serverip
    to.params.servername = clientinfo.servername 
    to.params.servertoken = clientinfo.servertoken
    to.params.clientname = clientinfo.name
    to.params.pincode = clientinfo.pin
    to.params.cmargin = clientinfo.cmargin
    to.params.localLockdown = clientinfo.localLockdown
  }
  return true
}


export default defineRouter(function (/* { store, ssrContext } */) {
  return createRouter({history: createWebHashHistory(), routes})   // use appropriate history implementation for server/client // import.meta.env.SSR is injected by Vite.
});
