/** 
 * VUE.js Frontend - Routing 
*/
import { createRouter as _createRouter, createWebHashHistory } from 'vue-router'
import notfound from '../pages/notfound.vue';
import startserver from '../pages/startserver.vue';
import dashboard from '../pages/dashboard.vue';
import SystemPrintPdf from '../pages/SystemPrintPdf.vue';

// config is exposed to renderer via preload (contextBridge)
function getConfig() { return typeof window !== 'undefined' && window.config ? window.config : {}; }

// check if we run this app in electron (host is always "localhost" then)
let electron = false

const userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf(' electron/') > -1) {
    electron = true
    // console.log(`Electron App: ${electron}`)
}



const routes = [
    { path: '/',                  component: startserver, beforeEnter: [addParams] },
    { path: '/startserver/:bipToken/:bipUsername/:bipuserID:',  name:"startserver",     component: startserver, beforeEnter: [addParams] },
    { path: '/system-print', name: 'system-print', component: SystemPrintPdf, beforeEnter: [addParams] },
    { path: '/dashboard/:servername/:passwd?/:bipToken/:bipUsername/:bipuserID:/:biptest', name:"dashboard", component: dashboard, beforeEnter: [addParams, getServerInfo] },
    { path: '/:pathMatch(.*)*',   component: notfound },
]

function addParams(to){
    const config = getConfig();

    to.params.version = config.version
    to.params.serverApiPort = config.serverApiPort
    to.params.clientApiPort = config.clientApiPort
    to.params.electron = electron
    to.params.workdirectory = config.workdirectory   //attention.. this is the server base workdirectory > we add servername to get the actual exam workdirectory in the view

    to.params.config = config
}



//we double check the password for now..  use proper auth process in the future ;-)
// since we almost moved to single and local instance teacher server password is not needed at all #REFACTOR ? 
async function getServerInfo(to){

    let res
    try {
        res = await window.ipcRenderer.invoke('getServerInfoForDashboard', to.params.servername)
    } catch (err) {
        console.error(`router @ getServerInfo: ${err}`)
        return false
    }

    if (res.status === "success") { 
        to.params.pin = res.data.pin; 
        to.params.servertoken = res.data.servertoken; 
        to.params.serverip = res.data.serverip; 
        to.params.id = res.data.id
        return true 
    }
    else {  
        console.log("router @ getServerInfo: serverinfo error"); 
        return false
    }
}



function extractServername(path) {
    const segments = path.split('/');
    const dashboardIndex = segments.indexOf('dashboard');
    const passwordIndex = segments.indexOf('password');
    if (dashboardIndex !== -1 && passwordIndex !== -1 && passwordIndex > dashboardIndex) { // ensure both keywords are present and 'password' comes after 'dashboard'
        if (dashboardIndex + 1 < passwordIndex) {    // return the segment directly after 'dashboard' if present
            return segments[dashboardIndex + 1];
        }
    }
    return null; // return null if no valid structure was found
}



export function createRouter() {
    const router = _createRouter({
        history: createWebHashHistory(),
        routes
    });

    router.beforeEach(async (to, from) => {
        if (from.name == "dashboard") {  // coming from an exam server - block navigation while in exam mode
            let servername = extractServername(from.path)
            const serverstatus = await window.ipcRenderer?.invoke("getserverstatus", servername)

            // if (serverstatus && serverstatus.exammode) {
            if (serverstatus) {     // always block while the server is still running - "End Exam" button kills the server - then serverstatus = false
                console.warn("router @ createRouter: Exam mode is active. Keyboard/mouse hotkey navigation is not allowed.");
                return false
            }
        }
        return true
    });

    return router;
}

export default createRouter
