/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,
    showdevtools: true,
    bipIntegration: true,
    bipApiUrl: 'https://www.bildung.gv.at/webservice/rest/next-exam/teacher',

    workdirectory : "",
    tempdirectory : "",
    backupdirectory: false,
    serverdirectory: 'EXAM-TEACHER',

    serverApiPort: 22422,
    multicastClientPort: 6024,
    multicastServerClientPort: 6025,

    multicastServerAdrr: '239.1.1.1',
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
    buildDate: '20260216',
    buildNumber: '1',
    info: 'Release'
}
export default config;
