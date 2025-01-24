import pjson from "../../package.json"


const config = {
    development: process.env.NODE_ENV === 'development',  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: process.env.NODE_ENV === 'development',
    
    bipIntegration: true,
    bipDemo:true,

    workdirectory : "",   // (desktop path + examdir)
    tempdirectory : "",   // (desktop path + 'tmp')
    homedirectory : "",   // set in main.ts
    examdirectory : "",    // set after registering in ipcHandler
    clientdirectory: "EXAM-STUDENT",

    serverApiPort:22422,  // this is needed to be reachable on the teachers pc for basic functionality
    multicastClientPort: 6024,  // only needed for exam autodiscovery

    multicastServerAdrr: '239.255.255.250',
    hostip: "",       // server.js
    gateway: true,
    electron: false,
    virtualized: false,
    version: pjson.version,
    info: process.env.NODE_ENV === 'development' ? process.env.NODE_ENV : 'dev'
}
export default config
