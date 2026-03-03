
/**
 * DO NOT EDIT - this file is written by prebuild.js via electron-builder.env - edit vars in electron-builder.env file!
 */

const config = {
    development: false,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: false,
    bipIntegration: false,
    bipDemo: false,

    workdirectory : "",   // (desktop path + examdir)
    tempdirectory : "",   // (desktop path + 'tmp')
    backupdirectory: false,  // (optional)
    serverdirectory: 'EXAM-TEACHER',

    serverApiPort: 22422,  // this is needed to be reachable on the teachers pc for basic functionality
    multicastClientPort: 6024,  // only needed for exam autodiscovery
    multicastServerClientPort: 6025,   // needed to find other exams in the network with the same name and prevent using the same exam name twice (confusion alert)

    multicastServerAdrr: '239.1.1.1',
    hostip: "0.0.0.0",       // server.js
    gateway: true,
    examServerList: {},
    accessToken: false,
    buildforWEB: false,
    isPuavo: false,
    
    exammodes: {
        rdp: true,
        website: true,
        gforms: true,
        eduvidual: true,
        editor: true,
        math: true,
        microsoft365: true,
        activesheets: false
    },

    version: '1.1.2.1',
    buildDate: '20260303',
    buildNumber: '1',
    info: 'Release'
}
export default config;
