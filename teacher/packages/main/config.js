import pjson from "../../package.json"

const config = {
    development: true,  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    showdevtools: false,
   
    workdirectory : "",   // set by server.js (desktop path + examdir)
    tempdirectory : "",   // set by server.js (desktop path + 'tmp')
    examdirectory: "EXAM-TEACHER",

    serverApiPort:22422,  //this must be reachable at the teachers machine otherwise nothing is going to work
    multicastClientPort: 6024,  //needed for exam autodiscovery by the student
    multicastServerClientPort: 6025,   // needed to find other exams in the network with the same name and prevent using the same exam name twice (confusion alert)

    multicastServerAdrr: '239.255.255.250',
    hostip: "0.0.0.0",
    gateway: true,
    examServerList: {},
    accessToken: false,
    version: pjson.version,
    info: "Release Candidate 6",
    buildforWEB: false

}
export default config
