import pjson from "../../package.json"

/**
 * achtung:
 *  config enthält rekursive elemente 
 *  und wird daher in ipchandler.copyConfig() für das frontend kopiert
 */

const config = {

    development: process.env.NODE_ENV === 'development',
    showdevtools: process.env.NODE_ENV === 'development',

    bipIntegration: true,
    bipDemo: true,


    workdirectory : "",   // set by server.js (desktop path + examdir)
    tempdirectory : "",   // set by server.js (desktop path + 'tmp')
    serverdirectory: "EXAM-TEACHER",

    serverApiPort:22422,  //this must be reachable at the teachers machine otherwise nothing is going to work
    multicastClientPort: 6024,  //needed for exam autodiscovery by the student
    multicastServerClientPort: 6025,   // needed to find other exams in the network with the same name and prevent using the same exam name twice (confusion alert)

    multicastServerAdrr: '239.255.255.250',
    hostip: "0.0.0.0",
    gateway: true,
    examServerList: {},
    accessToken: false,
    version: pjson.version,
    buildforWEB: false,
    info: process.env.NODE_ENV === 'development' ? process.env.NODE_ENV : 'dev'
  
}
export default config
