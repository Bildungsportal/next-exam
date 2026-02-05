/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,
    showdevtools: true,
    bipIntegration: true,
    bipDemo: true,
    bipApiUrl: 'http://localhost:80/moodle',

    workdirectory : "",
    tempdirectory : "",
    backupdirectory: false,
    serverdirectory: 'EXAM-TEACHER',

    serverApiPort: 22422,
    multicastClientPort: 6024,
    multicastServerClientPort: 6025,

    multicastServerAdrr: '239.255.255.250',
    hostip: "0.0.0.0",
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
        activesheets: true
    },

    version: '2.0.0.1',
    buildDate: '20260205',
    buildNumber: '1',
    info: 'Release'
}
export default config;
