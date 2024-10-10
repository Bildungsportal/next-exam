/** 
 * VUE.js Frontend - Routing 
*/
import { createRouter as _createRouter, createWebHashHistory } from 'vue-router'
import axios from 'axios'
import notfound from '/src/pages/notfound.vue'
import startserver from '/src/pages/startserver.vue'
import dashboard from '/src/pages/dashboard.vue'
import serverlist from '/src/pages/serverlist.vue'


//import { ipcRenderer } from 'electron'
import config from '../../main/config.js';

// check if we run this app in electron (host is always "localhost" then)
let electron = false

const userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf(' electron/') > -1) {
    electron = true
    // console.log(`Electron App: ${electron}`)
}



const routes = [
    { path: '/',                  component: startserver, beforeEnter: [addParams] },
    { path: '/startserver',       component: startserver, beforeEnter: [addParams] },
    { path: '/serverlist',        component: serverlist,   beforeEnter: [addParams]},
    { path: '/dashboard/:servername/:passwd', name:"dashboard", component: dashboard, beforeEnter: [addParams, checkPasswd] },
    { path: '/:pathMatch(.*)*',   component: notfound },
]

function addParams(to){
    to.params.version = config.version
    to.params.serverApiPort = config.serverApiPort 
    to.params.clientApiPort = config.clientApiPort
    to.params.electron = electron
    to.params.workdirectory = config.workdirectory   //attention.. this is the server base workdirectory > we add servername to get the actual exam workdirectory in the view

    to.params.config = config
}


//we double check the password for now..  use proper auth process in the future ;-)
// since we almost moved to single and local instance teacher server password is not needed at all #REFACTOR ? 
async function checkPasswd(to){
    let hostname = electron ? "localhost" : window.location.hostname

    let res = await axios.get(`https://${hostname}:${config.serverApiPort}/server/control/checkpasswd/${to.params.servername}/${to.params.passwd}`)
    .then(response => {  return response.data  })
    .catch( err => {console.error(`router @ checkPasswd:    ${err}`)})

    if (res.status === "success") { 
        to.params.pin = res.data.pin; 
        to.params.servertoken = res.data.servertoken; 
        to.params.serverip = res.data.serverip; 
        //console.log("router @ checkPasswd: password ok"); 
        return true 
    }
    else {  
        console.log("router @ checkPasswd: password error"); 
        return { path: '/startserver'}
    }
}



function extractServername(path) {
    const segments = path.split('/');
    const dashboardIndex = segments.indexOf('dashboard');
    const passwordIndex = segments.indexOf('password');
    if (dashboardIndex !== -1 && passwordIndex !== -1 && passwordIndex > dashboardIndex) { // Sicherstellen, dass beide Schlüsselwörter vorhanden sind und 'password' nach 'dashboard' kommt
        if (dashboardIndex + 1 < passwordIndex) {    // Gibt das Segment direkt nach 'dashboard' zurück, falls vorhanden
            return segments[dashboardIndex + 1];
        }
    }
    return null; // Rückgabe von null, wenn keine gültige Struktur gefunden wurde
}



export function createRouter() {
    const router = _createRouter({
        history: createWebHashHistory(),
        routes
    });

    router.beforeEach(async (to, from, next) => {
        if (from.name == "dashboard"){  // wir kommen aus einem exam server - blockiere verlassen sofern im exam mode
            let servername = extractServername(from.path)
            const serverstatus = await ipcRenderer.invoke("getserverstatus", servername)  //check exammode
         
             // if (serverstatus && serverstatus.exammode) {
            if (serverstatus) {     // blockiere immer sofern der server noch läuft - "Exam beenden" Button killt den server - dann ist serverstatus = false
                console.warn("router @ createRouter: Der Exam-Modus ist aktiv. Keyboard/Mouse Hotkey Navigation ist nicht erlaubt.");
                next(false);  // Verhindert die Navigation
            } 
            else {  next();  }
        } else {  next();  }
    });

    return router;
}