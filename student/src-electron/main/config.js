
/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: false,
    useBundledJRE: true,
    bipIntegration: true,
    bipDemo: true,
    bipApiUrl: 'https://localhost:8444',

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
    
    version: '2.0.0.1',
    buildDate: '20260302',
    buildNumber: '1',
    info: 'Release'
}
export default config;
