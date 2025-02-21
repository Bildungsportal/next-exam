
/**
 * DO NOT EDIT - this file is written by prebuild.js via electron-builder.env - edit vars in electron-builder.env file!
 */

const config = {
    development: false,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: false,
    bipIntegration: true,
    bipDemo: true,

    workdirectory : "",   // (desktop path + examdir)
    tempdirectory : "",   // (desktop path + 'tmp')
    homedirectory : "",   // set in main.ts
    examdirectory : "",    // set after registering in ipcHandler
    clientdirectory: 'EXAM-STUDENT',

    serverApiPort: 22422,  // this is needed to be reachable on the teachers pc for basic functionality
    multicastClientPort: 6024,  // only needed for exam autodiscovery

    multicastServerAdrr: '239.255.255.250',
    hostip: "",       // server.js
    gateway: true,
    electron: false,
    virtualized: false,
    version: '1.1.0-1',
    info: 'Development Version'
}
export default config;
