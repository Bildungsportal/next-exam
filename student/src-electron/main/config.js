
/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: true,
    useBundledJRE: true,
    bipIntegration: true,
    bipDemo: true,
    bipApiUrl: 'https://localhost:8443',

    workdirectory : "",   // (desktop path + examdir)
    tempdirectory : "",   // (desktop path + 'tmp')
    homedirectory : "",   // set in main.ts
    examdirectory : "",    // set after registering in ipcHandler
    clientdirectory: 'EXAM-STUDENT',

    serverApiPort: 22422,  // this is needed to be reachable on the teachers pc for basic functionality
    multicastClientPort: 6024,  // only needed for exam autodiscovery

    multicastServerAdrr: '239.1.1.1',
    hostip: "",       // server.js
    gateway: true,
    virtualized: false,
    isPuavo: false,
    
<<<<<<< HEAD
    version: '1.1.0.18',
<<<<<<< HEAD:student/packages/main/config.js
    buildDate: '20251212',
=======
    buildDate: '20260119',
>>>>>>> 91bccce18460f62abc119b1408e74334412cc8fa:student/src-electron/main/config.js
    buildNumber: '18',
=======
    version: '2.0.0.1',
    buildDate: '20260213',
    buildNumber: '1',
>>>>>>> e4c5fb6fd76bc1d6e4d1c6599be2d5d290d31c5e
    info: 'Release'
}
export default config;
