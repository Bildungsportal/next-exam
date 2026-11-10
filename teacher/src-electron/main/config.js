/**
 * DO NOT EDIT - this file is written by prebuild.js from .env - edit vars in .env file!
 */

const config = {
    development: true,
    showdevtools: true,
    bipIntegration: true,
    bipDemo: true,
    bipApiUrl: 'https://www.bildung.gv.at/webservice/rest/server.php',
    bipLoginUrl: 'https://www.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam',
    demoBipApiUrl: 'https://localhost:8443/webservice/rest/server.php',
    demoBipLoginUrl: 'https://localhost:8443/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam',

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
    msRefreshToken: false,
    msAccessTokenExpiresAt: 0,
    buildforWEB: false,
    isPuavo: false,

    exammodes: {
        rdp: true,
        website: true,
        forms: true,
        eduvidual: true,
        editor: true,
        math: true,
        microsoft365: true,
        activesheets: true,
        localvm: true
    },

    exposeStudents: false,

    version: '2.1.0.1',
    buildDate: '20261110',
    buildNumber: '1',
    info: 'Development'
}
import { applyCliOverrides } from './applyCliOverrides.js';
applyCliOverrides(config, process.argv);
export default config;
