
/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: true,
    useBundledJRE: true,
    bipIntegration: true,
    bipApiUrl: 'https://www.bildung.gv.at/webservice/rest/next-exam/student',

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
    virtualized: false,
    isPuavo: false,
    
    version: '2.0.0.1',
    buildDate: '20260206',
    buildNumber: '1',
    info: 'Release'
}
export default config;
