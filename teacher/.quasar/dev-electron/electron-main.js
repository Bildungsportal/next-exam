// src-electron/electron-main.js
import log8 from "electron-log";
import chalk from "chalk";
import { app as app4, BrowserWindow as BrowserWindow3, powerSaveBlocker, nativeTheme, globalShortcut, Menu } from "electron";

// src-electron/main/config.js
var config = {
  development: true,
  // disable kiosk mode on exam mode and other stuff (autofill input fields)
  showdevtools: true,
  bipIntegration: true,
  bipApiUrl: "https://www.bildung.gv.at/webservice/rest/next-exam/teacher",
  workdirectory: "",
  // (desktop path + examdir)
  tempdirectory: "",
  // (desktop path + 'tmp')
  backupdirectory: false,
  // (optional)
  serverdirectory: "EXAM-TEACHER",
  serverApiPort: 22422,
  // this is needed to be reachable on the teachers pc for basic functionality
  multicastClientPort: 6024,
  // only needed for exam autodiscovery
  multicastServerClientPort: 6025,
  // needed to find other exams in the network with the same name and prevent using the same exam name twice (confusion alert)
  multicastServerAdrr: "239.255.255.250",
  hostip: "0.0.0.0",
  // server.js
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
  version: "2.0.0.1",
  buildDate: "20260205",
  buildNumber: "1",
  info: "Release"
};
var config_default = config;

// src-electron/server/src/server.js
import express from "express";
import https from "https";
import cors from "cors";
import fileUpload from "express-fileupload";

// src-electron/server/src/routes/serverroutes.js
import { Router as Router3 } from "express";

// src-electron/server/src/routes/server/control.js
import { Router } from "express";

// src-electron/main/scripts/multicastserver.js
import { createSocket } from "dgram";
import crypto from "crypto";
import log from "electron-log";

// src-electron/main/scripts/schedulerservice.ts
import { EventEmitter } from "events";
var SchedulerService = class extends EventEmitter {
  action;
  handle;
  interval;
  constructor(action, ms) {
    super();
    this.action = action;
    this.handle = void 0;
    this.interval = ms;
    this.addListener("timeout", this.action);
  }
  start() {
    if (!this.handle) {
      this.handle = setInterval(() => this.emit("timeout"), this.interval);
    }
  }
  stop() {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = void 0;
    }
  }
};

// src-electron/main/scripts/multicastserver.js
var MulticastServer = class {
  constructor() {
    this.SRC_PORT = 0;
    this.ClientPORT = config_default.multicastClientPort;
    this.MULTICAST_ADDR = config_default.multicastServerAdrr;
    this.server = null;
    this.serverinfo = null;
    this.broadcastInterval = null;
    this.running = false;
    this.studentList = [];
    this.serverstatus = {};
  }
  /**
   * sets up an intervall to send serverinfo every 2 seconds
   * @param servername the given name of the server (for example "math")
   * @param pin the pin needed to register as student
   */
  init(servername, pin, password, bip = false, bipId = null) {
    this.server = createSocket("udp4");
    this.serverinfo = {
      servername,
      //should be unique if several servers are allowed
      pin,
      password,
      timestamp: 0,
      id: bipId ? bipId : crypto.randomUUID(),
      ip: config_default.hostip,
      servertoken: `server-${crypto.randomUUID()}`,
      bip,
      version: config_default.version
    };
    this.server.bind(this.SRC_PORT, "0.0.0.0", () => {
      this.server.setBroadcast(true);
      this.server.setMulticastTTL(128);
      this.server.setTTL(128);
      this.server.addMembership(this.MULTICAST_ADDR);
      this.broadcastInterval = new SchedulerService(this.sendMulticastMessage.bind(this), 2e3);
      this.broadcastInterval.start();
      log.info(`multicastserver @ init: UDP MC Server listening on http://${config_default.hostip}:${this.server.address().port}`);
    });
  }
  /**
   * updates the server timestamp and actually broadcasts the message (serverinfo)
   */
  sendMulticastMessage() {
    this.serverinfo.timestamp = (/* @__PURE__ */ new Date()).getTime();
    let message = {
      servername: this.serverinfo.servername,
      timestamp: this.serverinfo.timestamp,
      id: this.serverinfo.id,
      ip: this.serverinfo.ip,
      bip: this.serverinfo.bip,
      version: config_default.version
    };
    const preparedMessage = new Buffer.from(JSON.stringify(message));
    this.server.send(preparedMessage, 0, preparedMessage.length, this.ClientPORT, this.MULTICAST_ADDR);
    this.server.send(preparedMessage, 0, preparedMessage.length, config_default.multicastServerClientPort, this.MULTICAST_ADDR);
  }
};
var multicastserver_default = MulticastServer;

// src-electron/main/scripts/multicastclient.js
import dgram from "dgram";
import log2 from "electron-log";
var MulticastClient = class {
  constructor() {
    this.PORT = config_default.multicastServerClientPort;
    this.MULTICAST_ADDR = "239.255.255.250";
    this.client = null;
    this.examServerList = [];
    this.refreshExamsIntervall = null;
  }
  /**
   * receives messages and stores new exam instances in this.examServerList[]
   * starts an intervall to check server status by timestamp
   */
  init(gateway) {
    this.gateway = gateway;
    try {
      this.client = dgram.createSocket("udp4");
      this.client.bind(this.PORT, "0.0.0.0", () => {
        this.client.setBroadcast(true);
        this.client.setMulticastTTL(128);
        if (this.gateway) {
          this.client.addMembership(this.MULTICAST_ADDR);
        }
        if (!this.gateway) {
          log2.warn("multicastclient @ init: No Gateway! Starting MulticastClient without adding group membership");
        }
        log2.info(`multicastclient @ init: UDP MC Client listening on http://${config_default.hostip}:${this.client.address().port}`);
      });
    } catch (err) {
      log2.error(err);
    }
    this.client.on("message", (message, rinfo) => {
      this.messageReceived(message, rinfo);
    });
    this.refreshExamsScheduler = new SchedulerService(this.isDeprecatedInstance.bind(this), 5e3);
    this.refreshExamsScheduler.start();
  }
  async stop() {
    try {
      this.client.dropMembership(this.MULTICAST_ADDR);
    } catch (e) {
    }
    this.client.close();
    if (this.refreshExamsScheduler) this.refreshExamsScheduler.stop();
    return true;
  }
  /**
   * receives messages and stores new exam instances in this.examServerList[]
   */
  messageReceived(message, rinfo) {
    const serverInfo = JSON.parse(String(message));
    serverInfo.serverip = rinfo.address;
    serverInfo.serverport = rinfo.port;
    serverInfo.timestamp = (/* @__PURE__ */ new Date()).getTime();
    if (this.isNewExamInstance(serverInfo)) {
      log2.info(`multicastclient @ messageReceived: Adding new Exam Instance "${serverInfo.servername}" to Serverlist`);
      this.examServerList.push(serverInfo);
    }
  }
  /**
   * checks if the message came from a new exam instance or an old one that is already registered
   */
  isNewExamInstance(obj) {
    for (let i = 0; i < this.examServerList.length; i++) {
      if (this.examServerList[i].id === obj.id) {
        this.examServerList[i].timestamp = obj.timestamp;
        return false;
      }
    }
    return true;
  }
  /**
   * checks servertimestamp and removes server from list if older than 1 minute
   */
  isDeprecatedInstance() {
    for (let i = 0; i < this.examServerList.length; i++) {
      const now = (/* @__PURE__ */ new Date()).getTime();
      if (now - 16e3 > this.examServerList[i].timestamp) {
        log2.warn(`multicastclient @ isDeprecatedInstance: Removing inactive server '${this.examServerList[i].servername}' from list`);
        this.examServerList.splice(i, 1);
      }
    }
  }
};
var multicastclient_default = new MulticastClient();

// src-electron/server/src/routes/server/control.js
import crypto2 from "crypto";
import path2 from "path";

// src/locales/locales.js
import { createI18n } from "vue-i18n";

// src/locales/en.json
var en_default = {
  general: {
    startserver: "Start Exam",
    slist: "Aktive Exams",
    ok: "OK",
    offline: "No Network Connection"
  },
  serverlist: {
    pwd: "Password",
    name: "Name",
    login: "login",
    nopw: "Please provide a password"
  },
  startserver: {
    connected: "connected",
    start: "Start Exam",
    resume: "Resume Exam",
    examname: "Name",
    pwd: "Password",
    emptypw: "Please provide a valid password",
    emptyname: "Please provide a valid username",
    advanced: "advanced",
    simple: "simple",
    workfolder: "Workdirectory",
    select: "Select Workdirectory",
    freespacewarning: "Not enough free discspace",
    directoryerror: "Directory not writeable",
    previousexams: "Local previous Exams",
    folderdelete: "Delete local exam folder?",
    onlineexams: "BiP Exams",
    bipnotloggedin: "Please log in to BiP before starting the exam",
    noNews: "No News available",
    backupfolder: "Backup-Directory",
    backupfolderinfo: "Please provide a path for the backup directory",
    extendedsettings: "Extended Settings",
    incompatible: "Incompatible with current version",
    selectinterface: "Select Network Interface",
    selectinterfaceinfo: "Please select a preferred network interface!"
  },
  dashboard: {
    removeURL: "Remove URL",
    removeURLconfirm: "Are you sure you want to remove this URL?",
    remoteassistant: "Remote Assistant",
    server: "Server",
    name: "Name",
    pin: "Pin",
    connected: "connected",
    stopserver: "Stop Exam",
    filesend: "Send Files",
    filesendtext: "Please choose one or several Files",
    officefilesend: "Upload File",
    officefilesendtext: "Please choose an xlsx or docx File for the Exam",
    cancel: "Cancel",
    nofiles: "No Files selected",
    uploadfiles: "uploading files",
    filessent: "Files sent",
    noclients: "No students connected",
    lang: "Language",
    math: "Math",
    activesheets: "Active Sheets",
    activesheetshint: "Please select a PDF file that contains interactive form fields.",
    acceptPdf: "Accept PDF File",
    selectOtherPdf: "Select other PDF file",
    nopdfselected: "Please select a PDF file!",
    invalidpdf: "Invalid PDF file!",
    pdfprocessingerror: "Error processing PDF file.",
    eduvidual: "Eduvidual",
    website: "Website URL",
    autoget: "Backup interval",
    startexam: "Secure devices",
    startexamsingle: "Secure device",
    startexamdesc: "This starts the Exam Mode for all students",
    sendfile: "Send Files to all students",
    sendfileSingle: "Send Files",
    getfile: "Fetch Work of all students",
    getfileSingle: "Fetch Work",
    getfiles: "Fetch Work",
    stopexam: "Release devices",
    stopexamsingle: "Release device",
    sure: "Are you sure?",
    exitexamsure: "Close Exam Server?",
    exitexam: "This kills the connection to all students \nDid you backup everything?",
    exitexaminfo: "all active connections will be closed",
    exitkiosk: "exit safe exam mode. this closes the exam window for all students",
    exitkioskshort: "Exit Exam Server",
    reallykick: "remove student from server",
    kick: "remove",
    leftkiosk: "safemode left",
    online: "details",
    offline: "offline",
    secure: "secured",
    secureinfo: "student is secured",
    restore: "restore",
    resumeinfo: "resume focus state",
    exammodeactive: "student already in safe exam mode",
    close: "close",
    del: "clean workfolder",
    delsure: "Delete all contents of the students workfolders",
    delsingle: "clean remote workfolder",
    delsinglesure: "Delete contents of the students workfolder",
    attention: "Attention!",
    backuprequest: "Requesting files from all students",
    showworkfolder: "Show Workfolder",
    workfolder: "Show Workfolder",
    shownewestfolder: "Show newest Workfolder",
    filesfolder: "Workfolder files",
    choosestudent: "Select Student",
    chooserequire: "You need to choose a student!",
    nopdf: "Students work not found",
    summarizepdf: "Download newest versions \nas single pdf",
    summarizepdfshort: "All Exams as PDF",
    printrequest: "printrequest received",
    printrequestshow: "Do you want to open the document and print it?",
    download: "download",
    print: "print",
    preview: "preview",
    send: "send",
    activate: "activate",
    Activate: "Activate",
    virtualized: "virtual environment detected",
    delete: "delete",
    filedelete: "Do you really want to delete this file/folder?",
    cannotDeleteActiveSheet: "Active Sheet cannot be deleted during exam",
    exitdelete: "Delete all exam-related files on students devices",
    spellcheck: "Spellcheck",
    spellcheckactivate: "activate spellcheck",
    spellcheckchoose: "Please choose a language",
    suggest: "Show suggestions",
    customhost: "Custom LT Host",
    languagetoolhost: "LanguageTool Host",
    none: "none",
    cmargin: "Correction Margin Position",
    "cmargin-left": "left",
    "cmargin-right": "right",
    "cmargin-value": "Correction Margin size (cm)",
    texteditor: "Texteditor Settings",
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    sl: "Slovenian",
    backupauto: "Automatic Retreival",
    backupautoquestion: "Please set the interval for automatic retreival?",
    backupautohint: "(Timeframe in minutes)",
    eduvidualid: "Eduvidual / Moodle",
    eduvidualidhint: "Please enter a valid test URL!",
    gformshint: "Please enter a valid Google Forms ID!",
    eduvidualdomain: "Please provide your moodle domain if it's not eduvidual.at",
    moodleInvalidDomain: "Please enter a valid Moodle domain!",
    invalidDomain: "Please enter a valid domain!",
    moodleInvalidId: "Please enter a valid test ID!",
    lock: "lock displays",
    unlock: "unlock displays",
    freespacewarning: "Running out of free discspace!!",
    invalid_file: "Wrong Filetype",
    invalid_file_text: "Only Files with the .xlsx or .docx extension are allowed",
    replace: "Replace existing Files on OneDrive?",
    examrequest: "Exam requested",
    screenshot: "Screenshotupdate",
    screenshottitle: "Screenshot Update",
    screenshotquestion: "Set the interval to update Screenshots",
    screenshothint: "(Time in seconds. 0 == deaktivated)",
    oldpdfwarning: "Some of the files are older than 5 minutes!",
    oldpdfwarningsingle: "The local version of the file may be outdated!",
    gforms: "Google Forms",
    accessDenied: "Access Denied!",
    accessDeniedtext: "Contact your organizations Administrator to grant Access to Next-Exam",
    msoWarn: "You need to reconnect and select an MSOFile before reconnecting all students",
    allowspellcheck: "Activate spellcheck for specific student",
    linespacing: "Linespacing",
    fontfamily: "Fontfamily",
    defaultprinter: "Select default printer",
    allowdirectprint: "Allow direct print for students",
    noprinter: "No printer found",
    directprint: "Direct print",
    open: "Open file in external viewer",
    ocr: "Activate OCR saftey feature",
    audiorepeattitle: "Audio restrictions",
    audioallow: "no restrictions",
    audiorepeat1: "repetition",
    audiorepeat2: "repetitions",
    bildungsportal: "Bildungsportal",
    bildungsportalactivate: "Activate Bildungsportal",
    bildungsportalsettings: "Extended Settings for Bildungsportal",
    groups: "Activate groups",
    groupinfo: "Divide students in two groups",
    extendedsettings: "Extended Settings",
    save: "save",
    disabled: "disabled",
    ocrinfo: "Search for current exam pin in screenshots",
    bipinfo: "BiP-Status defines if authenticated clients can connect",
    logoutBiP: "Are you sure you want to log out?",
    activatesections: "Activate exam sections",
    examsections: "exam sections",
    examsectionsinfo: "You are in secured mode. Do you want to activate this exam section for all connected clients?",
    no: "No",
    yes: "Yes",
    exammode: "Exam-Mode",
    materials: "Materials",
    definematerials: "Define Materials",
    processingfiles: "Processing Files",
    fontsizetitle: "Fontsize",
    fontsize: "Fontsize",
    removefile: "Delete File",
    removefileconfirm: "Are you sure you want to delete this file?",
    sectionname: "Section Name",
    sectionnameinfo: "Please enter a name for this section",
    groupA: "Group A",
    groupB: "Group B",
    allowedURL: "Allowed URL",
    allowedURLinfo: "Please enter a URL that is allowed during the exam",
    extendedsettings_mode: "Extended Settings for Exam-Mode",
    rdp: "Web RDP",
    rdpconfig: "RDP Configuration",
    rdpconfiginfo: "Please enter the domain (URL) of the RDP-Server",
    muteaudio: "Mute audio",
    muteaudiointro: "If this option is activated, audio signals during the exam will not be played",
    showsubmission: "Show submission",
    studentinfo: "Show student details",
    virtualizedinfo: "The exam environment is possibly running in a virtual machine",
    leftkioskinfo: "The secure mode was left attempt!",
    examrequestinfo: "Backup requests were made",
    remoteassistantinfo: "Remote Assistant Software is possibly running on the client device",
    documentsinfo: "Documents on the client device: ",
    filesizewarning: "File Size",
    filesizewarningtext: "{filename} is larger than 8 MB ({size} MB). Large files may slow down the transfer.",
    noprinterChosen: "please select a printer"
  },
  control: {
    tokennotvalid: "token is not valid",
    invalidregistration: "no serverside registration",
    statechange: "statechange",
    alreadyregistered: "student already registered",
    registered: "student registered",
    serverexists: "Exam Server already exists",
    serverexistsLAN: "Exam Server already active in local area network",
    serverstarted: "Exam Server started",
    serverstopped: "Exam Server stopped",
    notfound: "Exam doesn't exist",
    wrongpw: "Wrong Password",
    wrongpin: "Wrong PIN",
    correctpw: "Password OK",
    studentremove: "Removed student from Exam Server",
    actiondenied: "action denied",
    nofiles: "no files were uploaded",
    studentupdate: "student updated",
    studentleft: "student left the exam",
    staterestore: "safe exam state restored",
    virtualized: "next-exam is run in a virtual machine",
    versionmismatch: "Application versions mismatch",
    examrequest: "Exams requested",
    biprequired: "Bildungsportal authentification mandatory!",
    submissionfailed: "Submission failed!",
    submissions: "Submissions"
  },
  data: {
    tokennotvalid: "the token is not valid",
    denied: "permission denied",
    nofiles: "no files were uploaded",
    noclients: "no students connected",
    filessent: "files sent",
    couldnotstore: "student could not store file",
    filereceived: "files received",
    nofilereceived: "no files received",
    fdeleted: "deleted",
    fileerror: "reading file failed"
  },
  pdf: {
    warningTitle: "Possibly scanned PDF",
    warningPrefix: "On",
    warningMessage: "less than 2 interactive form fields were found.",
    warningMessage2: "This indicates that this is a scanned PDF that does not contain active form fields or tables.",
    understood: "Understood",
    page: "Page",
    pages: "Pages",
    activesheets: "Please double check the rendering of the active sheets form fields before starting the exam!",
    edit: "Edit",
    save: "Save"
  }
};

// src/locales/de.json
var de_default = {
  general: {
    startserver: "Pr\xFCfung anlegen",
    slist: "Aktive Pr\xFCfungen",
    ok: "OK",
    offline: "Keine Netzwerkverbindung"
  },
  serverlist: {
    pwd: "Passwort",
    name: "Name",
    login: "anmelden",
    nopw: "Bitte geben Sie ein Passwort ein"
  },
  startserver: {
    connected: "verbunden",
    start: "Pr\xFCfung starten",
    resume: "Pr\xFCfung fortsetzen",
    examname: "Pr\xFCfungsname",
    pwd: "Passwort",
    emptypw: "Bitte geben Sie ein Passwort an",
    emptyname: "Bitte geben Sie einen Namen an",
    advanced: "fortgeschritten",
    simple: "einfach",
    workfolder: "Arbeitsverzeichnis",
    select: "Arbeitsverzeichnis w\xE4hlen",
    freespacewarning: "Zu wenig freier Speicherplatz",
    directoryerror: "Fehlende Schreibrechte im gew\xE4hlten Verzeichnis",
    previousexams: "Lokal gesicherte Pr\xFCfungen",
    folderdelete: "Wollen Sie die den lokalen Pr\xFCfungsordner l\xF6schen?",
    onlineexams: "BiP Pr\xFCfungen",
    bipnotloggedin: "Bitte melden Sie sich am BiP an, bevor Sie die Pr\xFCfung starten",
    noNews: "Keine Neuigkeiten verf\xFCgbar",
    backupfolder: "Backupverzeichnis",
    backupfolderinfo: "Bitte geben Sie einen Pfad f\xFCr das Backup-Verzeichnis ein",
    extendedsettings: "Erweitert",
    incompatible: "Nicht kompatibel mit der aktuellen Version",
    selectinterface: "Netzwerk-Schnittstelle w\xE4hlen",
    selectinterfaceinfo: "Bitte w\xE4hlen Sie eine bevorzugte Netzwerkschnittstelle aus!"
  },
  dashboard: {
    removeURL: "URL entfernen",
    removeURLconfirm: "Sind Sie sicher, dass Sie diese URL entfernen m\xF6chten?",
    remoteassistant: "Remote Assistant",
    server: "Server-Adresse",
    name: "Pr\xFCfungsname",
    pin: "Pincode",
    connected: "verbunden",
    stopserver: "Pr\xFCfung verlassen",
    filesend: "Dateien senden",
    filesendtext: "Bitte w\xE4hlen Sie eine oder mehrere Dateien",
    officefilesend: "Datei hochladen",
    officefilesendtext: "Bitte w\xE4hlen Sie eine .xlsx bzw. .docx Datei als Template f\xFCr die Sch\xFCler:innen",
    cancel: "Abbrechen",
    nofiles: "Keine Dateien ausgew\xE4hlt",
    uploadfiles: "Dateien werden hochgeladen",
    filessent: "Dateien gesendet",
    noclients: "Keine Sch\xFCler:innen verbunden",
    lang: "Sprachen",
    math: "Mathematik",
    activesheets: "Active Sheets",
    activesheetshint: "Bitte w\xE4hlen Sie eine PDF-Datei aus, die interaktive Formularfelder enth\xE4lt.",
    acceptPdf: "PDF Datei \xFCbernehmen",
    selectOtherPdf: "andere PDF Datei w\xE4hlen",
    nopdfselected: "Bitte w\xE4hlen Sie eine PDF-Datei aus!",
    invalidpdf: "Ung\xFCltige PDF-Datei!",
    pdfprocessingerror: "Fehler beim Verarbeiten der PDF-Datei.",
    eduvidual: "Eduvidual / Moodle",
    website: "Website-URL",
    autoget: "Backup-Intervall",
    startexam: "Ger\xE4te absichern",
    startexamsingle: "Ger\xE4t absichern",
    startexamdesc: "Startet den abgesicherten Pr\xFCfungsmodus auf den Ger\xE4ten der Sch\xFCler:innen",
    sendfile: "Dateien an alle Sch\xFCler:innen senden (pdf, jpg, mp3, bak, ggb, png, gif, wav, ogg)",
    sendfileSingle: "Datei senden",
    getfile: "Sicherungen von allen Sch\xFCler:innen holen",
    getfileSingle: "Sicherung holen",
    getfiles: "Sicherung holen",
    stopexam: "Ger\xE4te freigeben",
    stopexamsingle: "Ger\xE4t freigeben",
    sure: "Sind Sie sicher?",
    exitexamsure: "Pr\xFCfungsserver schlie\xDFen?",
    exitexam: "Dies beendet den Pr\xFCfungsserver.\nDie Sch\xFCler:innen k\xF6nnen im abgesicherten Modus auch ohne Verbindung weiterarbeiten.",
    exitexaminfo: "Alle bestehenden Verbindungen werden unterbrochen",
    exitkiosk: "Abgesicherten Modus beenden. Dies schlie\xDFt das Pr\xFCfungsfenster f\xFCr alle Sch\xFCler:innen!",
    exitkioskshort: "Abgesicherten Modus beenden.",
    reallykick: "vom Pr\xFCfungsserver entfernen",
    kick: "Verbindung trennen",
    leftkiosk: "Absicherung verlassen",
    online: "Info",
    offline: "offline",
    secure: "Exam",
    secureinfo: "Sch\xFCler:in ist abgesichert",
    restore: "fortsetzen",
    resumeinfo: "Tempor\xE4re Blockade aufheben",
    exammodeactive: "Sch\xFCler:in bereits im abgesicherten Modus",
    close: "schlie\xDFen",
    del: "Arbeitsordner auf Ger\xE4ten der Sch\xFCler:innen bereinigen",
    delsure: "Die Arbeitsordner auf den Ger\xE4ten der Sch\xFCler:innen werden geleert",
    delsingle: "Arbeitsordner auf Sch\xFCler:innen-Seite bereinigen",
    delsinglesure: "Der Arbeitsordner auf dem Sch\xFCler:innen-Ger\xE4t wird geleert",
    attention: "Achtung!",
    backuprequest: "Arbeiten werden geholt",
    showworkfolder: "Lokalen Arbeitsordner anzeigen",
    workfolder: "Ordner \xF6ffnen",
    shownewestfolder: "Neuesten Ordner anzeigen",
    filesfolder: "Dateien im Arbeitsordner",
    choosestudent: "W\xE4hlen Sie eine Person",
    chooserequire: "Sie m\xFCssen eine Option w\xE4hlen!",
    nopdf: "Keine Sch\xFClerarbeiten gefunden",
    summarizepdf: "Letzte Abgaben in\neiner PDF-Datei\nzusammenfassen",
    summarizepdfshort: "Letzte Abgaben zusammenfassen",
    printrequest: "Druckanfrage erhalten",
    printrequestshow: "Wollen Sie das Dokument ansehen und drucken?",
    download: "herunterladen",
    print: "drucken",
    preview: "ansehen",
    send: "versenden",
    activate: "aktivieren",
    Activate: "Aktivieren",
    virtualized: "virtualiserte Arbeitsumgebung",
    delete: "l\xF6schen",
    filedelete: "Wollen Sie die Datei/den Ordner wirklich l\xF6schen?",
    cannotDeleteActiveSheet: "Active Sheet kann w\xE4hrend der Pr\xFCfung nicht gel\xF6scht werden",
    exitdelete: "Pr\xFCfungsdaten auf Sch\xFClerPCs l\xF6schen",
    spellcheck: "Rechtschreibhilfe",
    spellcheckactivate: "Rechtschreibhilfe aktivieren",
    spellcheckchoose: "Bitte w\xE4hlen Sie eine Sprache f\xFCr die Pr\xFCfung",
    suggest: "Vorschl\xE4ge zeigen",
    customhost: "Eigener LT Host",
    languagetoolhost: "LanguageTool Host",
    none: "andere",
    cmargin: "Korrekturrand Position",
    "cmargin-left": "links",
    "cmargin-right": "rechts",
    "cmargin-value": "Korrekturrand im PDF",
    texteditor: "Texteditor-Einstellungen",
    de: "Deutsch",
    en: "Englisch",
    es: "Spanisch",
    fr: "Franz\xF6sisch",
    it: "Italienisch",
    sl: "Slowenisch",
    backupauto: "Automatische Sicherung",
    backupautoquestion: "In welchen Abst\xE4nden sollen die Arbeiten geholt werden?",
    backupautohint: "(Zeitangabe in Minuten)",
    eduvidualid: "Eduvidual / Moodle",
    eduvidualidhint: "Bitte geben Sie eine g\xFCltige Test-URL ein!",
    gformshint: "Bitte geben Sie eine g\xFCltige Google Forms ID ein!",
    eduvidualdomain: "Sollte ihre Moodleinstanz unter einer anderen Domain erreichbar sein, geben Sie diese an",
    moodleInvalidDomain: "Bitte geben Sie eine g\xFCltige Moodle-Domain an!",
    invalidDomain: "Bitte geben Sie eine g\xFCltige Domain ein!",
    moodleInvalidId: "Bitte geben Sie eine g\xFCltige Test-ID an!",
    lock: "Bildschirme sperren",
    unlock: "Bildschirme freigeben",
    freespacewarning: "Freier Speicherplatz zu gering!",
    invalid_file: "Falscher Dateityp",
    invalid_file_text: "Nur Dateien mit der Endung .xlsx und .docx sind erlaubt.",
    replace: "Vorhandene Dateien auf OneDrive ersetzen?",
    examrequest: "Sicherung angefordert",
    screenshot: "Screenshotupdate",
    screenshottitle: "Screenshot Update",
    screenshotquestion: "In welchen Abst\xE4nden sollen die Screenshots aktualisiert werden?",
    screenshothint: "(Zeitangabe in Sekunden. 0 == deaktiviert)",
    oldpdfwarning: "Manche Abgaben sind mehr als 5 Minuten alt!",
    oldpdfwarningsingle: "Die lokale Version der Datei ist m\xF6glicherweise veraltet!",
    gforms: "Google Forms",
    accessDenied: "Zugriff verweigert!",
    accessDeniedtext: "Bitte kontaktieren Sie ihren Systemadministrator, um der Applikation Next-Exam Zugriff zu gew\xE4hren",
    msoWarn: "Bevor die Sch\xFCler:innen die Verbindung wieder aufnehmen k\xF6nnen, m\xFCssen Sie sich zu ihrer Microsoft Cloud verbinden und die MSODatei erneut ausw\xE4hlen!",
    allowspellcheck: "Rechtschreibhilfe f\xFCr Sch\xFCler:in aktivieren",
    linespacing: "Zeilenabstand im PDF",
    fontfamily: "Schriftart",
    defaultprinter: "Standard-Drucker w\xE4hlen",
    allowdirectprint: "Sch\xFCler:innen erlauben Druckauftr\xE4ge direkt zu starten",
    noprinter: "Keine Drucker gefunden",
    directprint: "Autonomer Druck",
    open: "Datei in externem Betrachter \xF6ffnen",
    ocr: "OCR Sicherheit",
    audiorepeattitle: "Abspielen von Audiodateien einschr\xE4nken",
    audioallow: "Keine Einschr\xE4nkung",
    audiorepeat1: "x abspielen",
    audiorepeat2: "x abspielen",
    bildungsportal: "Bildungsportal",
    bildungsportalactivate: "Bildungsportal aktivieren",
    bildungsportalsettings: "Erweiterte Einstellungen zum Bildungsportal",
    groups: "Gruppen",
    groupinfo: "Sch\xFCler:innen in zwei Gruppen aufteilen",
    extendedsettings: "Erweiterte Einstellungen",
    save: "speichern",
    disabled: "deaktiviert",
    ocrinfo: "Aktuelle Pr\xFCfungs-PIN im Screenshot erkennen",
    bipinfo: "BiP-Status gibt an ob sich authentifizierte Clients verbinden k\xF6nnen",
    logoutBiP: "Sind Sie sicher, dass Sie sich abmelden m\xF6chten?",
    activatesections: "Pr\xFCfungsabschnitte aktivieren",
    examsections: "Pr\xFCfungsabschnitte",
    examsectionsinfo: "Sie befinden sich im abgesicherten Modus. Soll dieser Pr\xFCfungsabschnitt f\xFCr alle verbundenen Clients aktiviert werden?",
    no: "Nein",
    yes: "Ja",
    exammode: "Pr\xFCfungsmodus",
    materials: "Pr\xFCfungsmaterialien",
    definematerials: "Materialien festlegen die w\xE4hrend der Pr\xFCfung verf\xFCgbar sein sollen",
    processingfiles: "Materialien werden verarbeitet",
    fontsizetitle: "Schriftgr\xF6\xDFe im PDF",
    fontsize: "Schriftgr\xF6\xDFe",
    removefile: "Datei l\xF6schen",
    removefileconfirm: "Wollen Sie die Datei wirklich l\xF6schen?",
    sectionname: "Abschnittsname",
    sectionnameinfo: "Bitte geben Sie einen Namen f\xFCr diesen Abschnitt ein",
    groupA: "Gruppe A",
    groupB: "Gruppe B",
    allowedURL: "Erlaubte URL",
    allowedURLinfo: "Bitte geben Sie eine URL ein, die w\xE4hrend der Pr\xFCfung erlaubt ist",
    extendedsettings_mode: "Erweiterte Einstellungen zum Pr\xFCfungsmodus",
    rdp: "Web RDP",
    rdpconfig: "RDP Konfiguration",
    rdpconfiginfo: "Bitte geben Sie die Domain(URL) des RDP-Servers ein",
    muteaudio: "Audio stummschalten",
    muteaudiointro: "Wenn diese Option aktiviert ist, werden akustische Signale w\xE4hrend der Pr\xFCfung nicht abgespielt",
    showsubmission: "Abgabe anzeigen",
    studentinfo: "Details von Sch\xFCler:in anzeigen",
    virtualizedinfo: "Die Pr\xFCfungsumgebung wird m\xF6glicherweise in einer virtuellen Maschine ausgef\xFChrt",
    leftkioskinfo: "Es wurde versucht den abgesicherten Modus zu verlassen!",
    examrequestinfo: "Sicherungen wurden angefordert",
    remoteassistantinfo: "Remote Assistant Software l\xE4uft m\xF6glicherweise am Sch\xFCler:innen-Ger\xE4t",
    documentsinfo: "Dokumente auf dem Sch\xFCler:innen-Ger\xE4t: ",
    filesizewarning: "Dateigr\xF6\xDFe",
    filesizewarningtext: "{filename} ist gr\xF6\xDFer als 8 MB ({size} MB). Gro\xDFe Dateien k\xF6nnen die \xDCbertragung verlangsamen.",
    noprinterChosen: "Bitte w\xE4hlen Sie einen Drucker"
  },
  control: {
    tokennotvalid: "Das Token ist ung\xFCltig",
    invalidregistration: "Keine Registrierung vorgefunden",
    statechange: "Vertrauensstellung ge\xE4ndert",
    alreadyregistered: "Sch\xFCler:in unter diesem Namen bereits angemeldet",
    registered: "Sch\xFCler:in angemeldet",
    serverexists: "Pr\xFCfungsserver existiert bereits",
    serverexistsLAN: "Pr\xFCfungsserver existiert bereits im loklen Netzwerk",
    serverstarted: "Pr\xFCfungsserver gestartet",
    serverstopped: "Pr\xFCfungsserver beendet",
    notfound: "Pr\xFCfung existiert nicht",
    wrongpw: "Passwort falsch",
    wrongpin: "Falscher PIN",
    correctpw: "Passwort OK",
    studentremove: "Sch\xFCler:in von Pr\xFCfungsserver entfernt",
    actiondenied: "Aktion verboten",
    nofiles: "Es wurden keine Dateien hochgeladen",
    studentupdate: "Sch\xFClerdaten aktualisiert",
    studentleft: "Sch\xFCler:in hat den Pr\xFCfungsserver verlassen",
    staterestore: "Vertrauensstellung wiederhergestellt",
    virtualized: ": Die Pr\xFCfungsumgebung wird in einer virtuellen Maschine ausgef\xFChrt",
    versionmismatch: "Die Programmversionen stimmen nicht \xFCberein",
    examrequest: "Sicherungen wurden angefordert",
    biprequired: "Dies erzwingt die Authentifizierung der Sch\xFCler:innen durch das Bildungsportal.",
    submissionfailed: "Abgabe fehlgeschlagen!",
    submissions: "Abgaben"
  },
  data: {
    tokennotvalid: "das token ist ung\xFCltig",
    denied: "Zugriff verweigert",
    nofiles: "Es wurden keine Dateien hochgeladen",
    noclients: "Keine Sch\xFCler:innen verbunden",
    filessent: "Dateien gesendet",
    couldnotstore: "Sch\xFCler:in konnte die Datei nicht speichern",
    filereceived: "Daten erhalten",
    nofilereceived: "Keine Dateien erhalten",
    fdeleted: "gel\xF6scht",
    fileerror: "lesen der Datei fehlgeschlagen"
  },
  pdf: {
    warningTitle: "M\xF6glicherweise gescanntes PDF",
    warningPrefix: "Auf",
    warningMessage: "wurden weniger als 2 interaktive Formularfelder gefunden.",
    warningMessage2: "Dies deutet darauf hin, dass es sich um ein gescanntes PDF handelt, das keine aktiven Formularfelder oder Tabellen enth\xE4lt.",
    understood: "Verstanden",
    page: "Seite",
    pages: "Seiten",
    activesheets: "Bitte \xFCberpr\xFCfen Sie die Darstellung und Positionierung der aktiven Formularfelder vor dem Start der Pr\xFCfung!",
    edit: "Bearbeiten",
    save: "Speichern"
  }
};

// src/locales/locales.js
var i18n = createI18n({
  locale: "de",
  fallbackLocale: "en",
  legacy: false,
  messages: {
    en: en_default,
    de: de_default
  }
});
var locales_default = i18n;

// src-electron/server/src/routes/server/control.js
import fs from "fs";
import qs from "qs";
import axios from "axios";

// src/msalutils/authConfig.ts
import { LogLevel, PublicClientApplication } from "@azure/msal-browser";
var msalConfig = {
  auth: {
    clientId: "c952edde-d7c2-4281-a846-034fb039e1f5",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "https://localhost:22422/server/control/msauth",
    postLogoutRedirectUri: "https://localhost:22422/server/control/msauth"
  },
  cache: {
    cacheLocation: "localStorage"
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
      logLevel: LogLevel.Verbose
    }
  }
};
var msalInstance = new PublicClientApplication(msalConfig);

// src-electron/server/src/routes/server/control.js
import log4 from "electron-log";

// src-electron/main/scripts/windowhandler.js
import { app, BrowserWindow, dialog, screen } from "electron";
import { join } from "path";
import path from "path";
import { fileURLToPath } from "node:url";
import log3 from "electron-log";
var __dirname = import.meta.dirname;
var WindowHandler = class {
  constructor() {
    this.mainwindow = null;
    this.authwindow = null;
    this.config = null;
    this.multicastClient = null;
    this.multicastServer = null;
  }
  init(mc, config2) {
    this.multicastClient = mc;
    this.config = config2;
  }
  createBiPLoginWin(biptest) {
    this.bipwindow = new BrowserWindow({
      title: "Next-Exam",
      icon: join(__dirname, "../../public/icons/icon.png"),
      center: true,
      width: 1200,
      height: 920,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      // resizable: false,
      minimizable: false,
      // movable: false,
      // frame: false,
      show: false
      // transparent: true
    });
    if (biptest) {
      this.bipwindow.loadURL(`https://q.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`);
    } else {
      this.bipwindow.loadURL(`https://www.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`);
    }
    this.bipwindow.webContents.once("did-finish-load", () => {
      if (this.bipwindow && !this.bipwindow.isVisible()) {
        this.bipwindow.show();
      }
    });
    this.bipwindow.webContents.on("did-navigate", (event, url) => {
      log3.info("did-navigate");
      log3.info(url);
    });
    this.bipwindow.webContents.on("will-navigate", (event, url) => {
      log3.info("will-navigate");
      log3.info(url);
    });
    this.bipwindow.webContents.on("new-window", (event, url) => {
      log3.info("new-window");
      log3.info(url);
      event.preventDefault();
    });
    this.bipwindow.webContents.setWindowOpenHandler(({ url }) => {
      log3.info("target: _blank");
      log3.info(url);
      return { action: "deny" };
    });
    this.bipwindow.webContents.on("will-redirect", (event, url) => {
      log3.info("Redirecting to:", url);
      if (url.startsWith("bildungsportal://")) {
        event.preventDefault();
        const prefix = "bildungsportal://token=";
        const token = url.substring(prefix.length);
        log3.info("Captured Token:");
        log3.info(token);
        this.mainwindow.webContents.send("bipToken", token);
        this.bipwindow.close();
      }
    });
  }
  createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = { width: 800, height: 800 };
    const currentDir = fileURLToPath(new URL(".", import.meta.url));
    this.mainwindow = new BrowserWindow({
      title: "Next-Exam-Teacher",
      backgroundColor: "#2e2c29",
      show: false,
      icon: join(__dirname, "../../public/icons/icon.png"),
      center: true,
      width,
      height,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        preload: "/home/student/Webroot/GIT/next-exam/teacher/.quasar/dev-electron/preload" ? path.resolve(currentDir, path.join("/home/student/Webroot/GIT/next-exam/teacher/.quasar/dev-electron/preload", "electron-preload.cjs")) : join(__dirname, "../preload/preload.mjs"),
        spellcheck: false,
        webviewTag: true
      }
    });
    this.mainwindow.webContents.once("did-finish-load", () => {
      log3.info("windowhandler @ createWindow: did-finish-load - showing window");
      if (this.mainwindow && !this.mainwindow.isVisible()) {
        this.mainwindow.show();
        this.mainwindow.moveTop();
      }
    });
    if (app.isPackaged || process.env["DEBUG"]) {
      const filePath = join(__dirname, "../renderer/index.html");
      log3.info(`windowhandler @ createWindow: Loading file: ${filePath}`);
      this.mainwindow.removeMenu();
      this.mainwindow.loadFile(filePath);
    } else {
      const url = "http://localhost:9300";
      log3.info(`windowhandler @ createWindow: Loading URL: ${url}`);
      this.mainwindow.removeMenu();
      this.mainwindow.loadURL(url);
    }
    if (this.config.showdevtools) {
      this.mainwindow.webContents.openDevTools();
    }
    this.mainwindow.webContents.session.setCertificateVerifyProc((request, callback) => {
      var { hostname, certificate, validatedCertificate, verificationResult, errorCode } = request;
      callback(0);
    });
    this.mainwindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log3.warn(`windowhandler @ createWindow: did-fail-load - Error ${errorCode}: ${errorDescription} for URL: ${validatedURL}`);
      if (this.mainwindow && !this.mainwindow.isVisible()) {
        log3.info("windowhandler @ createWindow: Showing window after did-fail-load");
        this.mainwindow.show();
        this.mainwindow.moveTop();
      }
    });
    this.mainwindow.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
    });
    this.mainwindow.webContents.on("new-window", (event, url) => {
      event.preventDefault();
    });
    this.mainwindow.webContents.setWindowOpenHandler(({ url }) => {
      return { action: "deny" };
    });
    this.mainwindow.on("close", async (e) => {
      if (!this.config.development && this.mainwindow?.webContents.getURL().includes("dashboard")) {
        log3.info("windowhandler @ close: do not close running exam this way");
        e.preventDefault();
        dialog.showMessageBoxSync(this.mainwindow, {
          type: "info",
          buttons: ["OK"],
          // Nur ein Button
          defaultId: 0,
          title: "Pr\xFCfung l\xE4uft",
          message: "Beenden Sie zuerst die laufende Pr\xFCfung!"
        });
        return;
      } else {
        app.quit();
        process.exit(0);
      }
    });
  }
  /**
   * Microsoft 365 Auth Window 
   */
  createMsauthWindow() {
    const currentDir = fileURLToPath(new URL(".", import.meta.url));
    this.authwindow = new BrowserWindow({
      show: false,
      center: true,
      title: "OAuth",
      width: 500,
      height: 800,
      minimizable: false,
      icon: join(__dirname, "../../public/icons/icon.png"),
      webPreferences: {
        preload: "/home/student/Webroot/GIT/next-exam/teacher/.quasar/dev-electron/preload" ? path.resolve(currentDir, path.join("/home/student/Webroot/GIT/next-exam/teacher/.quasar/dev-electron/preload", "electron-preload.cjs")) : join(__dirname, "../preload/preload.mjs")
      }
    });
    let url = `https://localhost:22422/server/control/oauth`;
    this.authwindow.loadURL(url);
    if (this.config.showdevtools) {
      this.authwindow.webContents.openDevTools();
    }
    this.authwindow.webContents.once("did-finish-load", () => {
      if (this.authwindow && !this.authwindow.isVisible()) {
        this.authwindow.removeMenu();
        this.authwindow.setMinimizable(false);
        this.authwindow.show();
        this.authwindow.moveTop();
      }
    });
  }
};
var windowhandler_default = new WindowHandler();

// src-electron/server/src/routes/server/control.js
import Tesseract from "tesseract.js";
import { app as app2 } from "electron";
var router = Router();
var { t } = locales_default.global;
var TesseractWorker = false;
var __dirname2 = import.meta.dirname;
var fsp = fs.promises;
router.get("/oauth", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = base64UrlEncode(sha256(Buffer.from(codeVerifier, "utf-8")));
  res.cookie("codeVerifier", codeVerifier, { httpOnly: true });
  config_default.codeVerifier = codeVerifier;
  const authUrlParams = {
    client_id: msalConfig.auth.clientId,
    response_type: "code",
    redirect_uri: msalConfig.auth.redirectUri,
    response_mode: "query",
    scope: "openid profile offline_access Files.ReadWrite.AppFolder Files.Read Files.ReadWrite",
    state: "12345",
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  };
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${qs.stringify(authUrlParams)}`;
  res.redirect(authUrl);
});
router.get("/msauth", async (req, res) => {
  const code = req.query.code;
  const codeVerifier = config_default.codeVerifier;
  try {
    const response = await axios.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", qs.stringify({
      client_id: msalConfig.auth.clientId,
      grant_type: "authorization_code",
      scope: "openid profile offline_access Files.ReadWrite.AppFolder Files.Read Files.ReadWrite",
      code,
      redirect_uri: msalConfig.auth.redirectUri,
      code_verifier: codeVerifier
    }), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://localhost"
      }
    });
    config_default.accessToken = response.data.access_token;
    let html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Custom Button</title>
                <link rel="stylesheet" href="/static/css/staticstyles.css">
                <script>
                function closeWindowAfterFourSeconds() { setTimeout(function() { window.close(); }, 4000); }
                </script>
            </head>
            <body onload="closeWindowAfterFourSeconds()"><br>
                <h3>Login OK!</h3> <br>
            </body>
        </html>`;
    res.send(html);
  } catch (error) {
    console.error(error.response.data);
    let html = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Custom Button</title>
                <link rel="stylesheet" href="/static/css/staticstyles.css">
            </head>
            <body><br>
                <h4>${error.response.data.error_description}</h4> <br>
                Please close this Window and try again! <br>
                <button onclick="window.close()" class="custom-btn custom-btn-danger">Close Window</button>
            </body>
        </html>`;
    res.status(500).send(html);
  }
});
router.post("/start/:servername/:passwd?", async function(req, res, next) {
  if (!requestSourceAllowed(req, res)) return;
  const bip = req.body.bip;
  const bipId = req.body.bipId;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  let pin = String(Math.floor(Math.random() * 9e3) + 1e3);
  if (config_default.development) {
    pin = "1111";
  }
  if (mcServer) {
    return res.send({ sender: "server", message: t("control.serverexists"), status: "error" });
  }
  for (const exam of multicastclient_default.examServerList) {
    if (servername == exam.servername) {
      return res.send({ sender: "server", message: t("control.serverexistsLAN"), status: "error" });
    }
  }
  log4.info("control @ start: Initializing new Exam Server:", servername);
  let mcs = new multicastserver_default();
  if (!req.params.passwd) {
    mcs.init(servername, pin, "", bip, bipId);
  } else {
    mcs.init(servername, pin, req.params.passwd, bip, bipId);
  }
  config_default.examServerList[servername] = mcs;
  let serverinstancedir = path2.join(config_default.workdirectory, servername);
  try {
    await fs.promises.mkdir(serverinstancedir, { recursive: true });
  } catch (err) {
  }
  res.send({ sender: "server", message: t("control.serverstarted"), status: "success" });
});
router.get("/stopserver/:servername/:csrfservertoken", function(req, res, next) {
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  if (mcServer && req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    mcServer.broadcastInterval.stop();
    mcServer.server.close();
    delete config_default.examServerList[servername];
    res.send({ sender: "server", message: t("control.serverstopped"), status: "success" });
  }
});
router.get("/checkpasswd/:servername/:passwd?", function(req, res, next) {
  const servername = req.params.servername;
  let passwd = req.params.passwd;
  if (!passwd) {
    passwd = "";
  }
  const mcServer = config_default.examServerList[servername];
  if (mcServer) {
    if (passwd === mcServer.serverinfo.password) {
      return res.send({
        sender: "server",
        message: t("control.correctpw"),
        status: "success",
        data: {
          pin: mcServer.serverinfo.pin,
          servertoken: mcServer.serverinfo.servertoken,
          serverip: mcServer.serverinfo.ip
        }
      });
    } else {
      return res.send({ sender: "server", message: t("control.wrongpw"), status: "error" });
    }
  } else {
    res.send({ sender: "server", message: t("control.notfound"), status: "error" });
  }
});
router.get("/serverlist", function(req, res, next) {
  let serverlist = [];
  Object.values(config_default.examServerList).forEach((server2) => {
    serverlist.push({ servername: server2.serverinfo.servername, id: server2.serverinfo.id, serverip: server2.serverinfo.ip, reachable: true, password: server2.serverinfo.password, version: server2.serverinfo.version });
  });
  res.send({ serverlist, status: "success" });
});
router.get("/pong", function(req, res, next) {
  res.send("pong");
});
router.post("/pong", function(req, res, next) {
  res.send({ status: "success" });
});
var democlients = [];
for (let i = 0; i < 16; i++) {
  let democlient = {
    clientname: `user-${crypto2.randomBytes(6).toString("hex")}`,
    token: `csrf-${crypto2.randomUUID()}`,
    ip: false,
    hostname: false,
    serverip: false,
    servername: false,
    focus: true,
    exammode: false,
    timestamp: (/* @__PURE__ */ new Date()).getTime(),
    virtualized: true,
    // this config setting is set by simplevmdetect.js (electron preload)
    examtype: false,
    pin: false,
    screenlock: false,
    imageurl: "user-black.svg",
    status: {}
  };
  democlients.push(democlient);
}
router.get("/registerclient/:servername/:pin/:clientname/:clientip/:hostname/:version/:bipuserid", async function(req, res, next) {
  const clientname = req.params.clientname;
  const clientip = req.params.clientip;
  const pin = req.params.pin;
  const version = req.params.version;
  const servername = req.params.servername;
  const token = `csrf-${crypto2.randomUUID()}`;
  const mcServer = config_default.examServerList[servername];
  const hostname = req.params.hostname;
  const bipuserID = req.params.bipuserid;
  log4.info("control @ registerclient: Client Version:", version);
  let vteacher = config_default.version.split(".").slice(0, 2), versionteacher = vteacher.join(".");
  let vstudent = version.split(".").slice(0, 2), versionstudent = vstudent.join(".");
  if (!mcServer) {
    return res.send({ sender: "server", message: t("control.notfound"), status: "error" });
  }
  if (`${versionteacher}` !== versionstudent) {
    return res.send({ sender: "server", message: t("control.versionmismatch"), status: "error", version: config_default.version, versioninfo: config_default.info });
  }
  if (mcServer.serverstatus.requireBiP && bipuserID == "false") {
    return res.send({ sender: "server", message: t("control.biprequired"), status: "error" });
  }
  try {
    if (pin == mcServer.serverinfo.pin) {
      let registeredClient = mcServer.studentList.find((element) => element.clientname === clientname);
      if (!registeredClient) {
        log4.info(`control @ registerclient: adding new client '${clientname}'`);
        let group = false;
        if (mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA?.users?.includes(clientname)) {
          group = "a";
        } else if (mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB?.users?.includes(clientname)) {
          group = "b";
        } else {
          group = "a";
          mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA.users.push(clientname);
        }
        const client = {
          // we have a different representation of the clientobject on the server than on the client - why exactly? we could just send the whole client object via POST (as we already do in /update route )
          clientname,
          hostname,
          token,
          clientip,
          timestamp: (/* @__PURE__ */ new Date()).getTime(),
          focus: true,
          exammode: false,
          imageurl: false,
          virtualized: false,
          bipuserID,
          // we can use this in the future to re-check if this user is in the pre-defined userlist for this specific BIP exam
          status: { group: group || "a" }
          // we use this to store (per student) information about whats going on on the serverside (tasklist) and send it back on /update
          // we allow two groups (this is just used for distribution of files by now)
        };
        let studentfolder = path2.join(config_default.workdirectory, mcServer.serverinfo.servername, clientname);
        try {
          await fs.promises.access(studentfolder);
          const parentDir = path2.dirname(studentfolder);
          const targetDirName = path2.basename(studentfolder);
          const directories = (await fs.promises.readdir(parentDir, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
          if (!directories.includes(targetDirName)) {
            const existingDir = directories.find((dir) => dir.toLowerCase() === targetDirName.toLowerCase());
            if (existingDir) {
              const oldPath = path2.join(parentDir, existingDir);
              const newPath = path2.join(parentDir, `backup-${existingDir}`);
              await fs.promises.rename(oldPath, newPath);
              log4.warn(`control @ registerclient: Renaming ${oldPath} to ${newPath} - thx bill gates for the worst operating system otw`);
            }
          } else {
            log4.warn(`control @ registerclient: Using already existing directory: ${targetDirName}`);
          }
        } catch (err) {
          try {
            await fs.promises.mkdir(studentfolder, { recursive: true });
            log4.info(`control @ registerclient: Creating ${studentfolder}`);
          } catch (mkdirErr) {
            log4.error(`control @ registerclient: Error creating directory: ${mkdirErr}`);
          }
        }
        try {
          await fs.promises.mkdir(config_default.tempdirectory, { recursive: true });
        } catch (err) {
        }
        mcServer.studentList.push(client);
        return res.json({ sender: "server", message: t("control.registered"), status: "success", token });
      } else {
        let now = (/* @__PURE__ */ new Date()).getTime();
        if (now - 2e4 > registeredClient.timestamp) {
          registeredClient.timestamp = now;
          log4.info("control @ registerclient: student reconnected");
          windowhandler_default.mainwindow.webContents.send("reconnected", registeredClient);
          return res.json({ sender: "server", message: t("control.registered"), status: "success", token: registeredClient.token });
        } else {
          return res.json({ sender: "server", message: t("control.alreadyregistered"), status: "error" });
        }
      }
    } else {
      return res.json({ sender: "server", message: t("control.wrongpin"), status: "error" });
    }
  } catch (err) {
    log4.error(`control @ registerclient: ${err}`);
    return res.json({ sender: "server", message: "an unknown error occured", status: "error" });
  }
});
router.post("/sendtoclient/:servername/:csrfservertoken/:studenttoken", function(req, res, next) {
  const servername = req.params.servername;
  const studenttoken = req.params.studenttoken;
  const mcServer = config_default.examServerList[servername];
  const files = req.body.files;
  if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    if (studenttoken === "all") {
      for (let student of mcServer.studentList) {
        student.status["fetchfiles"] = true;
        student.status["files"] = files;
      }
    } else {
      let student = mcServer.studentList.find((element) => element.token === studenttoken);
      if (student) {
        student.status["fetchfiles"] = true;
        student.status["files"] = files;
      }
    }
    res.send({ sender: "server", message: t("control.examrequest"), status: "success" });
  } else {
    res.send({ sender: "server", message: t("control.actiondenied"), status: "error" });
  }
});
router.post("/sharelink/:servername/:csrfservertoken/:studenttoken", function(req, res, next) {
  const servername = req.params.servername;
  const studenttoken = req.params.studenttoken;
  const mcServer = config_default.examServerList[servername];
  const sharelink = req.body.sharelink;
  if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    let student = mcServer.studentList.find((element) => element.token === studenttoken);
    if (student) {
      student.status.msofficeshare = sharelink;
    }
    res.send({ sender: "server", message: t("control.studentupdate"), status: "success" });
  } else {
    res.send({ sender: "server", message: t("control.actiondenied"), status: "error" });
  }
});
router.get("/restore/:servername/:csrfservertoken/:studenttoken", function(req, res, next) {
  const servername = req.params.servername;
  const studenttoken = req.params.studenttoken;
  const mcServer = config_default.examServerList[servername];
  if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    let student = mcServer.studentList.find((element) => element.token === studenttoken);
    if (student) {
      student.status.restorefocusstate = true;
    }
    res.send({ sender: "server", message: t("control.staterestore"), status: "success" });
  } else {
    res.send({ sender: "server", message: t("control.actiondenied"), status: "error" });
  }
});
router.get("/fetch/:servername/:csrfservertoken/:studenttoken", function(req, res, next) {
  const servername = req.params.servername;
  const studenttoken = req.params.studenttoken;
  const mcServer = config_default.examServerList[servername];
  if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    if (studenttoken === "all") {
      for (let student of mcServer.studentList) {
        student.status["sendexam"] = true;
      }
    } else {
      let student = mcServer.studentList.find((element) => element.token === studenttoken);
      if (student) {
        student.status["sendexam"] = true;
      }
    }
    res.send({ sender: "server", message: t("control.examrequest"), status: "success" });
  } else {
    res.send({ sender: "server", message: t("control.actiondenied"), status: "error" });
  }
});
router.post("/getserverstatus/:servername/:csrfservertoken", async function(req, res, next) {
  const csrfservertoken = req.params.csrfservertoken;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: t("control.notfound"), status: "error" });
  }
  if (csrfservertoken !== mcServer.serverinfo.servertoken) {
    return res.send({ sender: "server", message: t("control.tokennotvalid"), status: "error" });
  }
  const filePath = path2.join(config_default.workdirectory, mcServer.serverinfo.servername, "serverstatus.json");
  let serverstatus;
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf-8");
    serverstatus = JSON.parse(fileContent);
    mcServer.serverinfo.pin = serverstatus.pin;
  } catch (error) {
    serverstatus = false;
  }
  return res.json({ sender: "server", status: "success", serverstatus });
});
router.get("/getcurrentserverstatus/:servername/:csrfservertoken", function(req, res, next) {
  const csrfservertoken = req.params.csrfservertoken;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: t("control.notfound"), status: "error" });
  }
  if (csrfservertoken !== mcServer.serverinfo.servertoken) {
    return res.send({ sender: "server", message: t("control.tokennotvalid"), status: "error" });
  }
  return res.json({ sender: "server", status: "success", serverstatus: mcServer.serverstatus });
});
router.post("/setserverstatus/:servername/:csrfservertoken", async function(req, res, next) {
  const csrfservertoken = req.params.csrfservertoken;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: t("control.notfound"), status: "error" });
  }
  if (csrfservertoken !== mcServer.serverinfo.servertoken) {
    return res.send({ sender: "server", message: t("control.tokennotvalid"), status: "error" });
  }
  mcServer.serverstatus = req.body.serverstatus;
  mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].msOfficeFile = false;
  log4.info("control @ setserverstatus: saving server status to disc");
  const workdir = path2.join(config_default.workdirectory, mcServer.serverinfo.servername);
  const filePath = path2.join(config_default.workdirectory, mcServer.serverinfo.servername, "serverstatus.json");
  try {
    await fs.promises.mkdir(workdir, { recursive: true });
    const jsonString = JSON.stringify(mcServer.serverstatus, null, 2);
    JSON.parse(jsonString);
    await fs.promises.writeFile(filePath, jsonString);
  } catch (error) {
    log4.error(`control @ setserverstatus: ${error}`);
    return res.json({ sender: "server", message: "could not save serverstatus to disc", status: "error" });
  }
  res.json({ sender: "server", message: t("general.ok"), status: "success" });
});
router.post("/setstudentstatus/:servername/:csrfservertoken/:studenttoken", function(req, res, next) {
  const servername = req.params.servername;
  const studenttoken = req.params.studenttoken;
  const mcServer = config_default.examServerList[servername];
  const printdenied = req.body.printdenied;
  const delfolder = req.body.delfolder;
  const activatePrivateSpellcheck = req.body.activatePrivateSpellcheck;
  const activatePrivateSuggestions = req.body.activatePrivateSuggestions;
  const removeprintrequest = req.body.removeprintrequest;
  const group = req.body.group;
  const kicked = req.body.kick;
  const msofficeshare = req.body.msofficeshare;
  const getmaterials = req.body.getmaterials;
  if (req.params.csrfservertoken === mcServer.serverinfo.servertoken) {
    if (studenttoken === "all") {
      for (let student of mcServer.studentList) {
        if (delfolder) {
          student.status.delfolder = true;
        }
        if (group) {
          student.status.group = group;
        }
        if (typeof msofficeshare !== "undefined") {
          student.status.msofficeshare = msofficeshare;
        }
        if (getmaterials) {
          student.status.getmaterials = true;
        }
      }
    } else {
      let student = mcServer.studentList.find((element) => element.token === studenttoken);
      if (student) {
        if (printdenied) {
          student.status.printdenied = true;
          student.printrequest = false;
        }
        if (delfolder) {
          student.status.delfolder = true;
        }
        if (activatePrivateSpellcheck) {
          student.status.activatePrivateSpellcheck = true;
          student.status.activatePrivateSuggestions = activatePrivateSuggestions;
        } else {
          student.status.activatePrivateSpellcheck = false;
          student.status.activateSuggestions = false;
        }
        if (removeprintrequest == true) {
          student.printrequest = false;
        }
        if (group) {
          student.status.group = group;
        }
        if (typeof msofficeshare !== "undefined") {
          student.status.msofficeshare = msofficeshare;
        }
        if (kicked) {
          student.status.kicked = true;
        }
        if (getmaterials) {
          student.status.getmaterials = true;
        }
      }
      let now = (/* @__PURE__ */ new Date()).getTime();
      if (now - 2e4 > student.timestamp && student.status.kicked) {
        let student2 = mcServer.studentList.find((element) => element.token === studenttoken);
        if (student2) {
          mcServer.studentList = mcServer.studentList.filter((el) => el.token !== studenttoken);
        }
      }
    }
    res.send({ sender: "server", message: t("control.studentupdate"), status: "success" });
  } else {
    res.send({ sender: "server", message: t("control.actiondenied"), status: "error" });
  }
});
router.post("/update", function(req, res, next) {
  const clientinfo = req.body.clientinfo;
  const studenttoken = clientinfo.token;
  const exammode = clientinfo.exammode;
  const servername = clientinfo.servername;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: "notavailable", status: "error" });
  }
  let student = mcServer.studentList.find((element) => element.token === studenttoken);
  if (!student) {
    return res.send({ sender: "server", message: "removed", status: "error" });
  }
  student.focus = clientinfo.focus;
  student.virtualized = clientinfo.virtualized;
  student.timestamp = (/* @__PURE__ */ new Date()).getTime();
  student.exammode = exammode;
  student.files = clientinfo.numberOfFiles;
  student.remoteassistant = clientinfo.remoteassistant;
  if (clientinfo.focus) {
    student.status.restorefocusstate = false;
  }
  if (clientinfo.screenshotinterval == 0) {
    student.imageurl = "person-lines-fill.svg";
  }
  let studentstatus = JSON.parse(JSON.stringify(student.status));
  if (student.status.kicked) {
    let student2 = mcServer.studentList.find((element) => element.token === studenttoken);
    if (student2) {
      mcServer.studentList = mcServer.studentList.filter((el) => el.token !== studenttoken);
    }
  }
  student.status.printdenied = false;
  student.status.delfolder = false;
  student.status.sendexam = false;
  student.status.focus = true;
  student.status.getmaterials = false;
  const serverstatusCopy = { ...mcServer.serverstatus };
  serverstatusCopy.examSections = { ...mcServer.serverstatus.examSections };
  for (let sectionKey of [1, 2, 3, 4]) {
    if (serverstatusCopy.examSections[sectionKey]) {
      serverstatusCopy.examSections[sectionKey] = {
        ...serverstatusCopy.examSections[sectionKey],
        groupA: {
          ...serverstatusCopy.examSections[sectionKey].groupA,
          examInstructionFiles: []
        },
        groupB: {
          ...serverstatusCopy.examSections[sectionKey].groupB,
          examInstructionFiles: []
        }
      };
    }
  }
  res.charset = "utf-8";
  res.send({ sender: "server", message: t("control.studentupdate"), status: "success", serverstatus: serverstatusCopy, studentstatus });
});
router.post("/updatescreenshot", async function(req, res, next) {
  const clientinfo = req.body.clientinfo;
  const studenttoken = clientinfo.token;
  const servername = clientinfo.servername;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: "notavailable", status: "error" });
  }
  let student = mcServer.studentList.find((element) => element.token === studenttoken);
  if (!student) {
    return res.send({ sender: "server", message: "removed from server", status: "error" });
  }
  if (req.body.screenshot) {
    const screenshotBase64 = req.body.screenshot;
    student.imageurl = "data:image/jpeg;base64," + screenshotBase64;
    if (mcServer.serverstatus.exammode && mcServer.serverstatus.screenshotocr && !student.status.restorefocusstate && student.focus) {
      try {
        const header = req.body.header.split(";base64,").pop();
        const headerimageBuffer = Buffer.from(header, "base64");
        const publicPath2 = app2.isPackaged ? path2.join(process.resourcesPath, "app.asar.unpacked", "public") : path2.resolve(__dirname2, "../../public");
        if (!TesseractWorker) {
          TesseractWorker = await Tesseract.createWorker("eng", 1, {
            langPath: publicPath2
          });
        }
        const { data: { text } } = await TesseractWorker.recognize(headerimageBuffer);
        let pincodeVisible = text.includes(mcServer.serverinfo.pin);
        if (!pincodeVisible) {
          student.focus = pincodeVisible;
          student.status.focus = pincodeVisible;
          log4.info("control @ updatescreenshot (ocr): Student Screenshot does not include Exam PIN");
        }
      } catch (err) {
        log4.info(`control @ updatescreenshot (ocr): ${err}`);
      }
    }
    if (!student.focus) {
      log4.info("control @ updatescreenshot: Student out of focus - securing screenshots");
      let time = (/* @__PURE__ */ new Date()).toISOString().substr(11, 8).replace(/:/g, "_");
      let filepath = path2.join(config_default.workdirectory, mcServer.serverinfo.servername, student.clientname, "focuslost");
      let absoluteFilename = path2.join(filepath, `${time}-${req.body.screenshotfilename}`);
      try {
        await fs.promises.mkdir(filepath, { recursive: true });
        let screenshotBuffer = Buffer.from(req.body.screenshot, "base64");
        await fs.promises.writeFile(absoluteFilename, screenshotBuffer);
      } catch (err) {
        log4.error(`control @ updatescreenshot: ${err}`);
      }
    }
  } else {
    student.imageurl = "person-lines-fill.svg";
  }
  res.send({ sender: "server", message: t("control.studentupdate"), status: "success" });
});
router.post("/printrequest/:servername/:studenttoken", async function(req, res, next) {
  const studenttoken = req.params.studenttoken;
  const servername = req.params.servername;
  const pdfDocument = req.body.document;
  const printrequest = req.body.printrequest;
  const submissionnumber = req.body.submissionnumber;
  const lockedsection = req.body.lockedsection || 1;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer) {
    return res.send({ sender: "server", message: "notavailable", status: "error" });
  }
  let student = mcServer.studentList.find((element) => element.token === studenttoken);
  if (!student) {
    return res.send({ sender: "server", message: "removed", status: "error" });
  }
  if (printrequest) {
    student.printrequest = pdfDocument;
  }
  let safeStudent = student.clientname.replace(/\s+/g, "_");
  let now = /* @__PURE__ */ new Date();
  let timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  let filename = `${servername}-${safeStudent}-${submissionnumber}-${timestamp}.pdf`;
  const pdfBuffer = Buffer.from(pdfDocument, "base64");
  try {
    const filepath = path2.join(config_default.workdirectory, mcServer.serverinfo.servername, student.clientname, "ABGABE", lockedsection.toString());
    await fsp.mkdir(filepath, { recursive: true });
    const absoluteFilename = path2.join(filepath, filename);
    await fsp.writeFile(absoluteFilename, pdfBuffer);
    log4.info(`control @ printrequest: Received and stored submission file for user: ${student.clientname}`);
    let backupStatus = "skipped";
    if (config_default.backupdirectory) {
      const backuppath = path2.join(config_default.backupdirectory, mcServer.serverinfo.servername, student.clientname, "ABGABE", lockedsection.toString());
      await fsp.mkdir(backuppath, { recursive: true });
      const absoluteBackupFilename = path2.join(backuppath, filename);
      await fsp.writeFile(absoluteBackupFilename, pdfBuffer);
      backupStatus = "ok";
    }
    res.send({ sender: "server", message: "success", status: "success", backup: backupStatus });
  } catch (err) {
    log4.error(`control @ printrequest: ${err}`);
    let message = t("control.submissionfailed");
    res.status(500).send({ sender: "server", message, status: "error" });
  }
});
var control_default = router;
function requestSourceAllowed(req, res) {
  if (req.ip == "::1" || req.ip == "127.0.0.1" || req.ip.includes("127.0.0.1")) {
    return true;
  }
  log4.error(`Blocked request from remote Host: ${req.ip}`);
  res.json("Request denied");
  return false;
}
function generateCodeVerifier() {
  return crypto2.randomBytes(32).toString("hex");
}
function sha256(buffer) {
  return crypto2.createHash("sha256").update(buffer).digest();
}
function base64UrlEncode(str) {
  return str.toString("base64").replace("+", "-").replace("/", "_").replace(/=+$/, "");
}

// src-electron/server/src/routes/server/data.js
import { Router as Router2 } from "express";
import path3 from "path";
import fs2 from "fs";
import extract from "extract-zip";
import archiver from "archiver";
import { PDFDocument, rgb } from "pdf-lib/dist/pdf-lib.js";
import log5 from "electron-log";
import moment from "moment";
import pdf from "@bingsjs/pdf-parse";
var router2 = Router2();
var { t: t2 } = locales_default.global;
router2.post("/getfiles/:servername/:token", async function(req, res, next) {
  const token = req.params.token;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const dir = req.body.dir;
  if (token !== mcServer.serverinfo.servertoken) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  let folders = [];
  folders.push({ currentdirectory: dir, parentdirectory: path3.dirname(dir) });
  const omitExtensions = [".json"];
  try {
    const files = await fs2.promises.readdir(dir);
    for (const file of files) {
      const filepath = path3.join(dir, file);
      let ext = path3.extname(file).toLowerCase();
      try {
        const stats = await fs2.promises.stat(filepath);
        if (stats.isDirectory()) {
          folders.push({ path: filepath, name: file, type: "dir", ext: "", parent: dir });
        } else if (stats.isFile() && !omitExtensions.includes(ext)) {
          folders.push({ path: filepath, name: file, type: "file", ext, parent: dir });
        }
      } catch (innerErr) {
        console.error("data @ getfiles: Fehler beim Zugriff auf Datei oder Verzeichnis: ", innerErr);
      }
    }
  } catch (err) {
    console.error("data @ getfiles: Fehler beim Lesen des Verzeichnisses: ", err);
    return res.status(500).json({ status: "error", message: t2("data.fileerror") });
  }
  return res.send(folders);
});
router2.post("/getlatest/:servername/:token", async function(req, res, next) {
  const token = req.params.token;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const submissions = req.body.submissions;
  let warning = false;
  if (token !== mcServer.serverinfo.servertoken) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  let latestFiles = [];
  for (let student of submissions) {
    for (let section = 1; section <= 4; section++) {
      if (student.sections[section].path) {
        latestFiles.push(student.sections[section].path);
      }
    }
  }
  console.log("data @ getlatest: latestFiles", latestFiles);
  if (latestFiles.length === 0) {
    return res.json({ warning, pdfBuffer: null });
  } else {
    let indexPDFdata = await createIndexPDF(submissions, servername);
    let indexPDFpath = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, "index.pdf");
    try {
      await fs2.promises.writeFile(indexPDFpath, indexPDFdata);
      log5.info("data @ getlatest: Index PDF saved successfully!");
    } catch (err) {
      log5.error("data @ getlatest:", err);
    }
    latestFiles.unshift(indexPDFpath);
    let PDF = await concatPages(latestFiles);
    let pdfBuffer = Buffer.from(PDF);
    let pdfPath = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, "combined.pdf");
    try {
      await fs2.promises.writeFile(pdfPath, pdfBuffer);
      log5.info("data @ getlatest: PDF saved successfully!");
    } catch (err) {
      log5.error("data @ getlatest:", err);
    }
    return res.json({ warning, pdfBuffer, pdfPath });
  }
});
function isValidPdf(data) {
  const header = new Uint8Array(data, 0, 5);
  const pdfHeader = [37, 80, 68, 70, 45];
  for (let i = 0; i < pdfHeader.length; i++) {
    if (header[i] !== pdfHeader[i]) {
      log5.warn("data @ isValidPdf: invalid PDF processed");
      return false;
    }
  }
  return true;
}
async function countCharsOfPDF(pdfPath, studentname, servername) {
  const dataBuffer = await fs2.promises.readFile(pdfPath);
  let chars = 0;
  if (isValidPdf(dataBuffer)) {
    chars = await pdf(dataBuffer).then((data) => {
      if (data && data.text && studentname) {
        let numberOfCharacters = data.text.length;
        let header = ` ${servername} | 10.10.24, 10:10 `;
        let footer = ` Zeichen: 10 | W\xF6rter: 10  1/1 `;
        numberOfCharacters = numberOfCharacters;
        let regex = /Zeichen: (\d+)/;
        let matches = data.text.match(regex);
        let zeichenAnzahl = matches ? matches[1] : "notfound";
        if (zeichenAnzahl !== "notfound") {
          return zeichenAnzahl;
        } else {
          regex = /Zeichen:(\d+)/;
          matches = data.text.match(regex);
          zeichenAnzahl = matches ? matches[1] : "notfound";
          if (zeichenAnzahl !== "notfound") {
            return zeichenAnzahl;
          } else {
            console.log(data.text);
            return numberOfCharacters >= 0 ? `~ ${numberOfCharacters}` : "~ 0";
          }
        }
      } else {
        return 0;
      }
    }).catch((err) => {
      log5.error(`data @ countCharsOfPDF: ${err}`);
      return 0;
    });
  } else {
    chars = "no pdf";
  }
  return chars;
}
async function createIndexPDF(submissions, servername) {
  let tabledata = [["Name", "Abschnitt", "Datum", "Zeichen", "Dateiname"]];
  for (const student of submissions) {
    let hasSubmission = false;
    const trimmedName = student.studentName.length > 20 ? student.studentName.slice(0, 20) + "..." : student.studentName;
    for (let section = 1; section <= 4; section++) {
      let name = "-";
      let sectionName = "-";
      let time = "-";
      let chars = "0";
      let filename = "-";
      if (student.sections[section].path) {
        name = trimmedName;
        sectionName = student.sections[section].sectionname || `Abschnitt ${section}`;
        sectionName = sectionName.length > 20 ? sectionName.slice(0, 20) + "..." : sectionName;
        time = moment(student.sections[section].date).format("DD.MM.YYYY HH:mm");
        chars = await countCharsOfPDF(student.sections[section].path, student.studentName, servername);
        filename = student.sections[section].filename.length > 25 ? student.sections[section].filename.slice(0, 25) + "..." : student.sections[section].filename;
        tabledata.push([name, sectionName, time, chars, filename]);
        hasSubmission = true;
      }
    }
    if (!hasSubmission) {
      tabledata.push([trimmedName, "", "", "", ""]);
    }
  }
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const startX = 50;
  const startY = page.getHeight() - 50;
  const rowHeight = 15;
  const columnWidths = [110, 130, 80, 40, 140];
  const drawCell = (x, y, width, height) => {
    page.drawRectangle({ x, y, width, height, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  };
  const addText = (text, x, y) => {
    text = String(text);
    page.drawText(text, { x, y, size: 9, color: rgb(0, 0, 0) });
  };
  tabledata.forEach((row, rowIndex) => {
    const yPos = startY - rowIndex * rowHeight;
    row.forEach((cellText, columnIndex) => {
      const xPos = startX + columnWidths.slice(0, columnIndex).reduce((acc, val) => acc + val, 0);
      drawCell(xPos, yPos - rowHeight, columnWidths[columnIndex], rowHeight);
      addText(cellText, xPos + 3, yPos - rowHeight + 4);
    });
  });
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
async function concatPages(pdfsToMerge) {
  const tempPDF = await PDFDocument.create();
  for (const pdfpath of pdfsToMerge) {
    let pdfBytes = await fs2.promises.readFile(pdfpath);
    if (isValidPdf(pdfBytes)) {
      const pdf2 = await PDFDocument.load(pdfBytes);
      const copiedPages = await tempPDF.copyPages(pdf2, pdf2.getPageIndices());
      copiedPages.forEach((page) => {
        tempPDF.addPage(page);
      });
    }
  }
  const finalPDF = await tempPDF.save();
  return finalPDF;
}
router2.post("/delete/:servername/:token", async function(req, res, next) {
  const token = req.params.token;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  if (token !== mcServer.serverinfo.servertoken) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  const filepath = req.body.filepath;
  if (filepath) {
    try {
      const stats = await fs2.promises.stat(filepath);
      if (stats.isDirectory()) {
        await fs2.promises.rm(filepath, { recursive: true, force: true });
      } else {
        await fs2.promises.unlink(filepath);
      }
      res.json({ status: "success", sender: "server", message: t2("data.fdeleted") });
    } catch (err) {
      log5.error("data @ delete:", err);
      res.status(500).json({ status: "error", sender: "server", message: t2("data.fileerror") });
    }
  }
});
router2.post("/getpdf/:servername/:token", function(req, res, next) {
  const { token, servername } = req.params;
  const mcServer = config_default.examServerList[servername];
  if (!mcServer || token !== mcServer.serverinfo?.servertoken) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  const { filename } = req.body;
  if (filename) {
    res.sendFile(filename, (err) => {
      if (err) {
        log5.error(err);
        res.status(404).json({ status: t2("data.fileerror") });
      }
    });
  } else {
    res.status(400).json({ status: t2("data.fileerror") });
  }
});
router2.post("/download/:servername/:token", async (req, res, next) => {
  const token = req.params.token;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const type = req.body.type;
  const filename = req.body.filename;
  const filepath = req.body.path;
  const files = req.body.files;
  if (token !== mcServer.serverinfo.servertoken && !checkToken(token, mcServer)) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  if (type === "studentfilerequest") {
    let student = mcServer.studentList.find((element) => element.token === token);
    if (student) {
      student.status["fetchfiles"] = false;
      student.status["files"] = [];
      res.zip({ files });
    }
  } else if (type === "file") {
    res.setHeader("Content-disposition", "attachment; filename=" + filename);
    res.download(filepath);
  } else if (type === "dir") {
    let zipfilename = filename.concat(".zip");
    let zipfilepath = path3.join(config_default.tempdirectory, zipfilename);
    await zipDirectory(filepath, zipfilepath);
    res.setHeader("Content-disposition", "attachment; filename=" + filename);
    res.download(zipfilepath, filename);
  }
});
router2.post("/getexammaterials/:servername/:token", async (req, res, next) => {
  const token = req.params.token;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const group = req.body.group;
  if (token !== mcServer.serverinfo.servertoken && !checkToken(token, mcServer)) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  let student = mcServer.studentList.find((element) => element.token === token);
  if (student) {
    let serverstatus = mcServer.serverstatus;
    let examSection = serverstatus.examSections[serverstatus.activeSection];
    let groupA = examSection.groupA;
    let groupB = examSection.groupB;
    let materials = [];
    let allowedUrls = [];
    if (group === "a") {
      materials = groupA.examInstructionFiles;
      allowedUrls = groupA.allowedUrls;
    } else if (group === "b") {
      materials = groupB.examInstructionFiles;
      allowedUrls = groupB.allowedUrls;
    }
    res.json({ status: "success", sender: "server", materials, allowedUrls });
  } else {
    res.json({ status: "error", sender: "server", message: t2("data.tokennotvalid") });
  }
});
router2.post("/receive/:servername/:studenttoken", async (req, res, next) => {
  const studenttoken = req.params.studenttoken;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const { file, filename } = req.body;
  const fileContent = Buffer.from(file, "base64");
  if (!checkToken(studenttoken, mcServer)) {
    res.json({ status: t2("data.tokennotvalid") });
  } else {
    let errors = 0;
    const now = /* @__PURE__ */ new Date();
    let time = now.toLocaleTimeString("de-DE");
    let timestring = String(time).replace(/:/g, "_");
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateString = `${year}${month}${day}`;
    let tstring = `${dateString}_${timestring}`;
    let student = mcServer.studentList.find((element) => element.token === studenttoken);
    let absoluteFilepath = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, student.clientname, filename);
    let studentdirectory = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, student.clientname);
    let studentarchivedir = path3.join(studentdirectory, tstring);
    try {
      await fs2.promises.mkdir(studentdirectory, { recursive: true });
      await fs2.promises.mkdir(studentarchivedir, { recursive: true });
    } catch (err) {
      log5.error("data @ receive: ", err);
    }
    if (file) {
      if (filename.includes(".zip")) {
        log5.info("data @ receive: Received ZIP File from user:", student.clientname);
        let success = await archiveAndExtractZip(absoluteFilepath, studentarchivedir, fileContent);
        if (config_default.backupdirectory && success) {
          let backupdir = path3.join(config_default.backupdirectory, mcServer.serverinfo.servername, student.clientname, tstring);
          log5.info(`data @ receive: Copying to backup directory: ${studentarchivedir} ->   ${backupdir} `);
          try {
            await fs2.promises.mkdir(backupdir, { recursive: true });
            await fs2.promises.cp(studentarchivedir, backupdir, { recursive: true });
          } catch (err) {
            log5.error("data @ receive: ", err);
          }
        }
        res.json({ status: "success", sender: "server", message: t2("data.filereceived"), errors });
      } else {
        log5.error("data @ receive: No ZIP file received");
        res.json({ status: "error", sender: "server", message: t2("data.nofilereceived"), errors });
      }
    } else {
      res.json({ status: "error", sender: "server", message: t2("data.nofilereceived"), errors });
    }
  }
});
router2.post("/upload/:servername/:servertoken/:studenttoken", async (req, res, next) => {
  const servertoken = req.params.servertoken;
  const servername = req.params.servername;
  const mcServer = config_default.examServerList[servername];
  const studenttoken = req.params.studenttoken;
  if (servertoken !== mcServer.serverinfo.servertoken) {
    return res.json({ status: t2("data.tokennotvalid") });
  }
  let uploaddirectory = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, "UPLOADS");
  try {
    await fs2.promises.mkdir(uploaddirectory, { recursive: true });
  } catch (err) {
  }
  if (req.files) {
    let filesArray = [];
    if (!Array.isArray(req.files.files)) {
      filesArray.push(req.files.files);
    } else {
      filesArray = req.files.files;
    }
    let files = [];
    for await (let file of filesArray) {
      let filename = decodeURIComponent(file.name);
      let absoluteFilepath = path3.join(uploaddirectory, filename);
      await file.mv(absoluteFilepath, (err) => {
        if (err) {
          log5.error(t2("data.couldnotstore"));
        }
      });
      files.push({ name: filename, path: absoluteFilepath });
    }
    if (studenttoken === "all") {
      for (let student of mcServer.studentList) {
        student.status["fetchfiles"] = true;
        student.status["files"] = files;
      }
    } else if (studenttoken == "a" || studenttoken == "b") {
      let groupArray = [];
      if (studenttoken == "a") {
        groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupA.users;
      }
      if (studenttoken == "b") {
        groupArray = mcServer.serverstatus.examSections[mcServer.serverstatus.activeSection].groupB.users;
      }
      if (groupArray.length > 0) {
        for (let name of groupArray) {
          let student = mcServer.studentList.find((element) => element.clientname === name);
          if (student) {
            student.status["fetchfiles"] = true;
            student.status["files"] = files;
          }
        }
      } else {
        return res.json({ status: "error", sender: "server", message: t2("data.nofilereceived") });
      }
    } else {
      let student = mcServer.studentList.find((element) => element.token === studenttoken);
      if (student) {
        student.status["fetchfiles"] = true;
        student.status["files"] = files;
      }
    }
    res.json({ status: "success", sender: "server", message: t2("data.filereceived") });
  } else {
    res.json({ status: "error", sender: "server", message: t2("data.nofilereceived") });
  }
});
var data_default = router2;
var MAX_PARALLEL_EXTRACTS = 4;
var runningExtracts = 0;
var extractQueue = [];
function runNextExtract() {
  if (runningExtracts >= MAX_PARALLEL_EXTRACTS) return;
  const job = extractQueue.shift();
  if (!job) return;
  runningExtracts++;
  job().catch(() => {
  }).finally(() => {
    runningExtracts--;
    setImmediate(runNextExtract);
  });
}
async function archiveAndExtractZip(absoluteFilepath, studentarchivedir, fileContent) {
  return new Promise((resolve) => {
    const exec2 = async () => {
      try {
        await fs2.promises.writeFile(absoluteFilepath, fileContent);
        await extract(absoluteFilepath, {
          dir: studentarchivedir,
          onEntry: (entry, zipfile) => {
            const target = path3.normalize(path3.join(studentarchivedir, entry.fileName));
            if (!target.startsWith(path3.normalize(studentarchivedir + path3.sep))) {
              zipfile.close();
              throw new Error("Blocked path traversal: " + entry.fileName);
            }
          }
        });
        try {
          await fs2.promises.unlink(absoluteFilepath);
        } catch (e) {
        }
        log5.info(`data @ receive: Successfully extracted ZIP file to ${studentarchivedir}`);
        resolve(true);
      } catch (err) {
        log5.error("data @ receive (extract): ", err);
        try {
          await fs2.promises.unlink(absoluteFilepath);
        } catch (e) {
        }
        resolve(false);
      }
    };
    extractQueue.push(exec2);
    if (runningExtracts < MAX_PARALLEL_EXTRACTS) setImmediate(runNextExtract);
  });
}
function checkToken(token, mcserver) {
  let tokenexists = false;
  try {
    mcserver.studentList.forEach((student) => {
      if (token === student.token) {
        tokenexists = true;
      }
    });
  } catch (err) {
    log5.error(`data: ${err}`);
  }
  return tokenexists;
}
function zipDirectory(sourceDir, outPath) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs2.createWriteStream(outPath);
  return new Promise((resolve, reject) => {
    archive.directory(sourceDir, false).on("error", (err) => reject(err)).pipe(stream);
    stream.on("close", () => resolve());
    archive.finalize();
  });
}

// src-electron/server/src/routes/serverroutes.js
var serverRouter = Router3();
serverRouter.use("/control/", control_default);
serverRouter.use("/data/", data_default);

// src-electron/server/src/server.js
import fsExtra from "fs-extra";
import path4 from "path";
import rateLimit from "express-rate-limit";
import ip from "ip";
import zip from "express-easy-zip";
import fs3 from "fs";
import os from "os";
import forge from "node-forge";
import { gateway4sync } from "default-gateway";
import cookieParser from "cookie-parser";
import { app as app3 } from "electron";
import log6 from "electron-log";
forge.options.usePureJavaScript = true;
config_default.homedirectory = os.homedir();
config_default.workdirectory = path4.join(config_default.homedirectory, config_default.serverdirectory);
config_default.tempdirectory = path4.join(os.tmpdir(), "exam-tmp");
if (!fs3.existsSync(config_default.workdirectory)) {
  fs3.mkdirSync(config_default.workdirectory, { recursive: true });
}
if (!fs3.existsSync(config_default.tempdirectory)) {
  fs3.mkdirSync(config_default.tempdirectory, { recursive: true });
}
var desktopPath = process.platform === "win32" ? path4.join(process.env["USERPROFILE"], "Desktop") : path4.join(config_default.homedirectory, "Desktop");
if (!fs3.existsSync(desktopPath)) {
  fs3.mkdirSync(desktopPath, { recursive: true });
}
var linkPath = path4.join(desktopPath, config_default.serverdirectory);
try {
  fs3.unlinkSync(linkPath);
} catch (e) {
}
try {
  if (!fs3.existsSync(linkPath)) {
    fs3.symlinkSync(config_default.workdirectory, linkPath, "junction");
  }
} catch (e) {
  log6.error("main: can't create symlink");
}
try {
  const { gateway, interface: iface } = gateway4sync();
  config_default.hostip = ip.address(iface);
  config_default.gateway = true;
} catch (e) {
  log6.error("main: unable to determine default gateway");
  config_default.hostip = ip.address();
  log6.info(`main: IP ${config_default.hostip}`);
  config_default.gateway = false;
}
var limiter = rateLimit({
  windowMs: 1 * 60 * 1e3,
  // 1 minutes
  max: 400,
  // Limit each IP to 400 requests per `window` 
  standardHeaders: true,
  // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false
  // Disable the `X-RateLimit-*` headers
});
fsExtra.emptyDirSync(config_default.tempdirectory);
var publicPath = app3.isPackaged ? path4.join(process.resourcesPath, "app.asar.unpacked", "public") : path4.join("public");
var api = express();
api.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));
api.use(express.json({ limit: "50mb" }));
api.use(express.urlencoded({ extended: true }));
api.use(zip());
api.use(cors());
api.use("/static", express.static(config_default.tempdirectory));
api.use(cookieParser());
var activeConnections = 0;
api.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = `${req.method} ${req.url}`;
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    if (duration > 5e3) {
      log6.warn(`server: Slow request detected: ${requestId} took ${duration}ms`);
    }
    if (activeConnections > 150) {
      log6.warn(`server: High load - ${activeConnections} active connections during ${requestId}`);
    }
  });
  res.on("close", () => {
    if (!res.headersSent) {
      const duration = Date.now() - startTime;
      log6.warn(`server: Request closed before completion: ${requestId} after ${duration}ms`);
    }
  });
  next();
});
api.use("/server", serverRouter);
var certs = createCACert();
var options = {
  key: certs.key,
  cert: certs.cert,
  requestCert: false,
  rejectUnauthorized: false,
  agent: false
};
var server = https.createServer(options, api);
server.timeout = 3e4;
server.keepAliveTimeout = 5e3;
server.maxConnections = 200;
server.on("connection", (socket) => {
  activeConnections++;
  if (activeConnections > 150) {
    log6.warn(`server: High connection count: ${activeConnections}`);
  }
  socket.on("close", () => {
    activeConnections--;
  });
});
if (config_default.buildforWEB) {
  server.listen(config_default.serverApiPort, () => {
    log6.info(`server: Express listening on https://${config_default.hostip}:${config_default.serverApiPort}`);
  });
  if (config_default.hostip) {
    multicastclient_default.init();
  }
}
var server_default = server;
function createCACert() {
  let rsa = forge.pki.rsa;
  let pki = forge.pki;
  let seed = forge.random.getBytesSync(32);
  let keys = rsa.generateKeyPair({ bits: 1024, seed });
  var cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.privateKey = keys.privateKey;
  cert.sign(keys.privateKey);
  var pem_pkey = pki.privateKeyToPem(keys.privateKey);
  var pem_cert = pki.certificateToPem(cert);
  return { key: pem_pkey, cert: pem_cert };
}

// src-electron/main/scripts/ipchandler.js
import fs4 from "fs";
import { BrowserWindow as BrowserWindow2, ipcMain, dialog as dialog2 } from "electron";
import { join as join2 } from "path";
import log7 from "electron-log";
import { networkInterfaces } from "os";
import { exec } from "child_process";
import { gateway4sync as gateway4sync2 } from "default-gateway";
import ip2 from "ip";
import checkDiskSpace from "check-disk-space";
var IpcHandler = class {
  constructor() {
    this.multicastClient = null;
    this.config = null;
    this.WindowHandler = null;
    this.printQueue = [];
    this.isProcessingPrint = false;
  }
  init(mc, config2, wh, ch) {
    this.multicastClient = mc;
    this.config = config2;
    this.WindowHandler = wh;
    this.CommunicationHandler = ch;
    this._processPrintQueue = async () => {
      if (this.isProcessingPrint) {
        return;
      }
      this.isProcessingPrint = true;
      while (this.printQueue.length > 0) {
        const job = this.printQueue.shift();
        log7.info(`ipchandler @ _processPrintQueue: Processing print job (${this.printQueue.length} remaining in queue)`);
        try {
          await this._processPrintJob(job.docBase64, job.printerName, job.previewType);
          job.resolve(true);
        } catch (error) {
          log7.error(`ipchandler @ _processPrintQueue: Print job failed: ${error.message}`);
          job.reject(error);
        }
      }
      this.isProcessingPrint = false;
      log7.info("ipchandler @ _processPrintQueue: Print queue empty, processing stopped");
    };
    this._processPrintJob = async (docBase64, printerName, previewType) => {
      return new Promise((resolve, reject) => {
        let hiddenWin = new BrowserWindow2({
          show: false,
          useContentSize: true,
          // Ensure width/height refers to content area
          webPreferences: {
            plugins: true,
            webSecurity: false,
            zoomFactor: 1
            // Force 1:1 scaling to ignore system scale factor
          }
        });
        hiddenWin.webContents.setZoomFactor(1);
        let dataUrl = ``;
        if (previewType === "pdf") {
          dataUrl = `data:application/pdf;base64,${docBase64}`;
        } else if (previewType === "image") {
          dataUrl = `data:image/jpeg;base64,${docBase64}`;
        } else {
          log7.error("ipchandler @ _processPrintJob: Invalid preview type!");
          if (hiddenWin && !hiddenWin.isDestroyed()) {
            hiddenWin.close();
          }
          reject(new Error("Invalid preview type"));
          return;
        }
        hiddenWin.on("closed", () => {
          hiddenWin = null;
        });
        hiddenWin.webContents.on("did-stop-loading", async () => {
          try {
            const isPDFRendered = await hiddenWin.webContents.executeJavaScript(`
                            new Promise(resolve => {
                                let elapsed = 0;
                                const interval = 500; // Check every 500 ms
                                const timeout = 2000; // Maximum 2 seconds wait
                                const checkPDFLoaded = () => {
                                    const embed = document.querySelector('embed[type="application/pdf"]');
                                    const img = document.querySelector('img');

                                    if (embed && embed.clientHeight > 0) {
                                        clearInterval(timer);
                                        setTimeout(() => {
                                            resolve(true); // PDF is assumed to be fully rendered
                                        }, 1000);
                                    } 
                                    else if (img && img.clientHeight > 0) {
                                        clearInterval(timer);
                                        resolve(true); // Image is fully rendered
                                    }    
                                    else if (elapsed >= timeout) {
                                        clearInterval(timer);
                                        resolve(false); // Time expired, not rendered
                                    } 
                                    else { elapsed += interval; }
                                };
                                const timer = setInterval(checkPDFLoaded, interval);
                            });
                        `);
            if (isPDFRendered) {
              log7.info(`ipchandler @ _processPrintJob: base64 ${previewType} received - printing on: ${printerName}`);
              const printTimeout = setTimeout(() => {
                log7.error(`ipchandler @ _processPrintJob: print job timeout for printer ${printerName}`);
                if (hiddenWin && !hiddenWin.isDestroyed()) {
                  hiddenWin.close();
                }
                reject(new Error("Print job timeout"));
              }, 1e4);
              hiddenWin.webContents.print({
                silent: true,
                deviceName: printerName,
                printBackground: true,
                scaleFactor: 1,
                pagesPerSheet: 1,
                landscape: false,
                dpi: {
                  horizontal: 600,
                  vertical: 600
                },
                pageSize: "A4",
                margins: {
                  marginType: "none"
                }
              }, (success, failureReason) => {
                clearTimeout(printTimeout);
                if (!success) {
                  log7.error(`ipchandler @ _processPrintJob: print job failed for printer ${printerName}: ${failureReason || "unknown reason"}`);
                  if (hiddenWin && !hiddenWin.isDestroyed()) {
                    hiddenWin.close();
                  }
                  reject(new Error(failureReason || "Print job failed"));
                } else {
                  log7.info(`ipchandler @ _processPrintJob: print job successfully handed over to OS for printer ${printerName}`);
                  if (hiddenWin && !hiddenWin.isDestroyed()) {
                    hiddenWin.close();
                  }
                  resolve(true);
                }
              });
            } else {
              log7.error("ipchandler @ _processPrintJob: Rendering/Print failed!");
              if (hiddenWin && !hiddenWin.isDestroyed()) {
                hiddenWin.close();
              }
              reject(new Error("Rendering/Print failed"));
            }
          } catch (error) {
            log7.error(`ipchandler @ _processPrintJob: Error during print job: ${error.message}`);
            if (hiddenWin && !hiddenWin.isDestroyed()) {
              hiddenWin.close();
            }
            reject(error);
          }
        });
        hiddenWin.loadURL(dataUrl).catch((error) => {
          log7.error(`ipchandler @ _processPrintJob: Error loading URL: ${error.message}`);
          if (hiddenWin && !hiddenWin.isDestroyed()) {
            hiddenWin.close();
          }
          reject(error);
        });
      });
    };
    ipcMain.on("loginBiP", (event, biptest) => {
      log7.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest);
      this.WindowHandler.createBiPLoginWin(biptest);
      event.returnValue = "hello from bip logon";
    });
    ipcMain.handle("getserverstatus", (event, servername) => {
      const mcServer = this.config.examServerList[servername];
      if (mcServer) {
        return mcServer.serverstatus;
      } else {
        return false;
      }
    });
    ipcMain.handle("stopserver", (event, servername) => {
      const mcServer = this.config.examServerList[servername];
      if (mcServer) {
        mcServer.broadcastInterval.stop();
        mcServer.server.close();
        delete config2.examServerList[servername];
        this.multicastClient.examServerList = this.multicastClient.examServerList.filter((exam) => exam.servername !== servername);
        return true;
      } else {
        return false;
      }
    });
    ipcMain.handle("studentlist", (event, servername) => {
      const mcServer = this.config.examServerList[servername];
      if (mcServer) {
        return { studentlist: mcServer.studentList };
      } else {
        return { sender: "server", message: "notfound", status: "error", studentlist: [] };
      }
    });
    ipcMain.on("openmsauth", (event) => {
      this.WindowHandler.createMsauthWindow();
      event.returnValue = true;
    });
    ipcMain.on("getconfig", (event) => {
      event.returnValue = this.copyConfig(config2);
    });
    ipcMain.handle("getconfigasync", (event) => {
      return this.copyConfig(config2);
    });
    ipcMain.handle("resetToken", async (event) => {
      const win = this.WindowHandler.mainwindow;
      if (!win) return;
      await win.webContents.session.clearCache();
      await win.webContents.session.clearStorageData({
        storages: ["cookies"]
      });
      config2.accessToken = false;
      log7.info("ipchandler @ resetToken: Logged out of Office365");
      return this.copyConfig(config2);
    });
    ipcMain.handle("openfile", (event, filepath) => {
      const cmd = process.platform === "win32" ? `start " " "${filepath}"` : process.platform === "darwin" ? `open "${filepath}"` : `xdg-open "${filepath}"`;
      try {
        exec(cmd, (error) => {
          if (error) {
            log7.error("ipchandler @ openfile: Error opening PDF in external reader:", error);
            return false;
          }
          log7.info("ipchandler @ openfile: File opened in external reader");
          return true;
        });
      } catch (err) {
        log7.error("ipchandler @ openfile: Error opening PDF:", err);
        return false;
      }
    });
    ipcMain.on("getCurrentWorkdir", (event) => {
      event.returnValue = config2.workdirectory;
    });
    ipcMain.handle("checkDiscspace", async () => {
      let diskSpace = await checkDiskSpace(config2.workdirectory);
      let free = Math.round(diskSpace.free / 1024 / 1024 / 1024 * 1e3) / 1e3;
      return free;
    });
    ipcMain.handle("setbackupdir", async (event, arg) => {
      const result = await dialog2.showOpenDialog(this.WindowHandler.mainwindow, { properties: ["openDirectory"] });
      if (!result.canceled) {
        log7.info("directories selected", result.filePaths);
        let message = "";
        try {
          let testdir = join2(result.filePaths[0], config2.serverdirectory);
          if (!fs4.existsSync(testdir)) {
            fs4.mkdirSync(testdir);
          }
          message = "success";
          config2.backupdirectory = testdir;
          log7.info("ipchandler @ setbackupdir:", config2);
        } catch (e) {
          message = "error";
          log7.error(e);
        }
        return { backupdir: config2.backupdirectory, message };
      } else {
        return { backupdir: config2.backupdirectory, message: "canceled" };
      }
    });
    ipcMain.on("setPreviousWorkdir", async (event, workdir) => {
      if (workdir) {
        log7.info("previous directory selected", workdir);
        let message = "";
        try {
          if (!fs4.existsSync(workdir)) {
            fs4.mkdirSync(workdir);
          }
          message = "success";
          config2.workdirectory = workdir;
        } catch (e) {
          message = "error";
          log7.error(e);
        }
        event.returnValue = { workdir: config2.workdirectory, message };
      } else {
        event.returnValue = { workdir: config2.workdirectory, message: "canceled" };
      }
    });
    ipcMain.handle("createBipExamdirectory", async (event, exam) => {
      let message = "";
      const workdir = join2(config2.workdirectory, exam.examName);
      const filePath = join2(workdir, "serverstatus.json");
      try {
        if (!fs4.existsSync(workdir)) {
          fs4.mkdirSync(workdir);
        }
        message = "success";
      } catch (e) {
        message = e.message;
        log7.error(e);
      }
      try {
        const jsonString = JSON.stringify(exam, null, 2);
        JSON.parse(jsonString);
        fs4.writeFileSync(filePath, jsonString);
      } catch (error) {
        log7.error(`ipchandler @ createBipExamdirectory: JSON validation or write failed: ${error}`);
        message = "error";
      }
      event.returnValue = { message };
    });
    ipcMain.handle("getlog", async (event) => {
      const workdir = join2(config2.workdirectory, "/");
      let filepath = join2(workdir, "next-exam-teacher.log");
      try {
        let data = fs4.readFileSync(filepath, "utf8");
        let serverlog = data.trim().split("\n").map((line) => {
          const match = line.match(/^\[(.+?)\]\s+\[(.+?)\]\s+(.*)$/);
          if (match) {
            const [, date, type, rawText] = match;
            let color;
            switch (type.toLowerCase()) {
              case "info":
                color = "#0aa2c0";
                break;
              case "warn":
                color = "var(--bs-warning)";
                break;
              case "error":
                color = "var(--bs-danger)";
                break;
              default:
                color = "var(--bs-cyan)";
            }
            let source = "next-exam";
            let text = rawText;
            if (rawText.includes(":")) {
              const colonIndex = rawText.indexOf(":");
              source = rawText.substring(0, colonIndex).trim();
              text = rawText.substring(colonIndex + 1).trim();
            }
            return { date, type, text, color, source };
          }
          return null;
        }).filter((item) => item !== null);
        return serverlog;
      } catch (err) {
        log7.error(`ipchandler @ getlog: ${err}`);
        return false;
      }
    });
    ipcMain.handle("scanWorkdir", async (event, arg) => {
      let examfolders = [];
      if (fs4.existsSync(config2.workdirectory)) {
        const folders = fs4.readdirSync(config2.workdirectory, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
        for (const dirname of folders) {
          const serverstatusPath = join2(config2.workdirectory, dirname, "serverstatus.json");
          if (fs4.existsSync(serverstatusPath)) {
            try {
              const serverstatus = JSON.parse(fs4.readFileSync(serverstatusPath, "utf-8"));
              if (!serverstatus.examName) {
                serverstatus.examName = dirname;
              }
              examfolders.push(serverstatus);
            } catch (e) {
              log7.error(`ipchandler @ scanWorkdir: Error parsing serverstatus.json in ${dirname}:`, e);
            }
          }
        }
      }
      return examfolders;
    });
    ipcMain.handle("delPrevious", async (event, arg) => {
      let examdir = join2(config2.workdirectory, arg);
      if (fs4.statSync(examdir).isDirectory()) {
        try {
          fs4.rmSync(examdir, { recursive: true, force: true });
        } catch (e) {
          log7.error(e);
        }
      }
      return examdir;
    });
    ipcMain.handle("getSpecificSubmissionBase64", async (event, filepath) => {
      try {
        const submission = fs4.readFileSync(filepath, "base64");
        return { submission, status: "success" };
      } catch (e) {
        log7.error(`ipchandler @ getSpecificSubmissionBase64: ${e}`);
        return { submission: false, status: "error" };
      }
    });
    ipcMain.handle("getSubmissions", async (event, servername, currentserverstatus) => {
      const mcServer = this.config.examServerList[servername];
      const serverstatus = JSON.parse(currentserverstatus);
      if (!mcServer) {
        return { sender: "server", message: "notfound", status: "error", submissions: [] };
      }
      let submissions = [];
      let dir = join2(config2.workdirectory, mcServer.serverinfo.servername);
      if (fs4.existsSync(dir)) {
        const folders = fs4.readdirSync(dir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
        for (const studentName of folders) {
          if (studentName.toUpperCase() === "UPLOADS") {
            continue;
          }
          let sections = {};
          let submissionDir = join2(dir, studentName, "ABGABE");
          for (let section = 1; section <= 4; section++) {
            let sectionDir = join2(submissionDir, String(section));
            sections[section] = {
              path: null,
              filename: "",
              date: false,
              sectionname: ""
            };
            if (fs4.existsSync(sectionDir)) {
              let sectionFiles = fs4.readdirSync(sectionDir, { withFileTypes: true }).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
              if (sectionFiles.length > 0) {
                let latestSubmission = sectionFiles.map((file) => {
                  let filePath = join2(sectionDir, file);
                  return { file, mtime: fs4.statSync(filePath).mtime };
                }).sort((a, b) => b.mtime - a.mtime)[0];
                sections[section] = {
                  path: join2(sectionDir, latestSubmission.file),
                  filename: latestSubmission.file,
                  date: latestSubmission.mtime,
                  sectionname: serverstatus.examSections[section].sectionname
                };
              }
            }
          }
          submissions.push({
            studentName,
            sections
          });
        }
      }
      return submissions;
    });
    ipcMain.handle("getLatestBakFile", async (event, servername, studentName) => {
      const mcServer = this.config.examServerList[servername];
      if (!mcServer) {
        return { sender: "server", message: "notfound", status: "error", filepath: false };
      }
      let latestBakFile = null;
      let dir = join2(config2.workdirectory, mcServer.serverinfo.servername, studentName);
      if (!fs4.existsSync(dir)) {
        return { sender: "server", message: "notfound", status: "error", filepath: false };
      }
      const backupDirectories = fs4.readdirSync(dir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory() && dirent.name !== "ABGABE" && dirent.name !== "focuslost").map((dirent) => {
        let filePath = join2(dir, dirent.name);
        return { name: dirent.name, mtime: fs4.statSync(filePath).mtime };
      }).sort((a, b) => b.mtime - a.mtime);
      if (backupDirectories.length === 0) {
        return { sender: "server", message: "notfound", status: "error", filepath: false };
      }
      let latestBackupDirectory = backupDirectories[0].name;
      log7.info("ipchandler @ getLatestBakFile: Searching for latest backup file in:", dir, latestBackupDirectory);
      const latestBakFilepath = join2(dir, latestBackupDirectory, studentName + ".bak");
      const latestBackupDirectoryPath = join2(dir, latestBackupDirectory);
      if (!fs4.existsSync(latestBakFilepath)) {
        return { sender: "server", message: "notfound", status: "error", filepath: false, latestBackupDirectoryPath: latestBackupDirectoryPath || false };
      }
      return { sender: "server", message: "success", status: "success", filepath: latestBakFilepath, latestBackupDirectoryPath };
    });
    ipcMain.handle("getprinters", async () => {
      const printers = await this.WindowHandler.mainwindow.webContents.getPrintersAsync();
      const printerData = printers.map((printer) => ({
        printerName: printer.name,
        isDefault: printers.length === 1 ? true : printer.isDefault,
        // deprecated in electron 36, set to true if only one printer
        description: printer.description
      }));
      return printerData;
    });
    ipcMain.handle("printBase64", async (event, docBase64, printerName, previewType) => {
      try {
        return await new Promise((resolve, reject) => {
          this.printQueue.push({
            docBase64,
            printerName,
            previewType,
            resolve,
            reject
          });
          log7.info(`ipchandler @ printBase64: Print request added to queue (${this.printQueue.length} jobs in queue)`);
          if (!this.isProcessingPrint) {
            this._processPrintQueue().catch((error) => {
              log7.error(`ipchandler @ printBase64: Queue processing error: ${error.message}`);
            });
          }
        });
      } catch (error) {
        log7.warn(`ipchandler @ printBase64: returning error to renderer: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    ipcMain.on("checkhostip", async (event) => {
      const interfaces = networkInterfaces();
      this.availableInterfaces = null;
      Object.keys(interfaces).forEach((interfaceName) => {
        interfaces[interfaceName].forEach((iface) => {
          if (iface.family === "IPv4" && !iface.address.startsWith("127.") && !iface.address.startsWith("169.254.")) {
            if (!this.availableInterfaces) {
              this.availableInterfaces = [];
            }
            this.availableInterfaces.push({
              name: interfaceName,
              address: iface.address
            });
          }
        });
      });
      const oldHostIp = this.config.hostip;
      if (this.preferredInterface) {
        const preferred = this.availableInterfaces?.find((iface) => iface.name === this.preferredInterface);
        if (preferred) {
          this.config.hostip = preferred.address;
          this.config.interface = preferred.name;
          try {
            const { gateway, version, int } = gateway4sync2(preferred.name);
            this.config.gateway = int === this.preferredInterface;
          } catch (e) {
            this.config.gateway = false;
          }
        }
      } else {
        try {
          const { gateway, version, int } = gateway4sync2();
          this.config.hostip = ip2.address(int);
          this.config.interface = int;
          this.config.gateway = true;
        } catch (e) {
          this.config.hostip = false;
          this.config.gateway = false;
        }
        if (!this.config.hostip) {
          try {
            this.config.hostip = ip2.address();
            const interfaceName = Object.keys(interfaces).find((key) => interfaces[key].some((iface) => iface.address === this.config.hostip));
            this.config.interface = interfaceName;
          } catch (e) {
            log7.error("ipcHandler @ checkhostip: Unable to determine ip address");
            this.config.hostip = false;
            this.config.gateway = false;
            this.config.interface = false;
          }
        }
      }
      if (this.config.hostip == "127.0.0.1") {
        this.config.hostip = false;
      }
      if (oldHostIp !== this.config.hostip && this.config.hostip) {
        log7.info(`main: IP changed from ${oldHostIp} to ${this.config.hostip}, reinitializing services...`);
        if (this.multicastClient && this.multicastClient.client.address()) {
          try {
            await this.multicastClient.stop();
            this.multicastClient.init(this.config.gateway);
            log7.info("main: Multicast client reinitialized");
          } catch (e) {
            log7.error("main: Failed to reinitialize multicast client:", e);
          }
        }
        if (server_default) {
          if (server_default.listening) {
            server_default.close(() => {
              log7.info(`main: Express server stopped due to IP change`);
              server_default.listen(config2.serverApiPort, () => {
                log7.info(`main: Express server restarted on https://${config2.hostip}:${config2.serverApiPort}`);
              });
            });
          } else {
            server_default.listen(config2.serverApiPort, () => {
              log7.info(`main: Express server started on https://${config2.hostip}:${config2.serverApiPort}`);
            });
          }
        }
      }
      event.returnValue = {
        hostip: this.config.hostip,
        interface: this.config.interface,
        availableInterfaces: this.availableInterfaces,
        preferredInterface: this.preferredInterface
      };
    });
    ipcMain.handle("setPreferredInterface", (event, arg) => {
      this.preferredInterface = arg;
    });
    ipcMain.on("unsetPreferredInterface", (event) => {
      this.preferredInterface = false;
      event.returnValue = {
        hostip: this.config.hostip,
        interface: this.config.interface,
        availableInterfaces: this.availableInterfaces,
        preferredInterface: this.preferredInterface
      };
    });
    ipcMain.on("storeOnedriveFiles", async (event, args) => {
      log7.info("downloading onedrive files...");
      const studentName = args.studentName;
      const accessToken = args.accessToken;
      const fileName = args.fileName;
      const fileID = args.fileID;
      const servername = args.servername;
      let studentdirectory = join2(config2.workdirectory, servername, studentName);
      let time = new Date((/* @__PURE__ */ new Date()).getTime()).toLocaleTimeString();
      let tstring = String(time).replace(/:/g, "_");
      let studentarchivedir = join2(studentdirectory, tstring);
      try {
        if (!fs4.existsSync(studentdirectory)) {
          fs4.mkdirSync(studentdirectory, { recursive: true });
        }
        if (!fs4.existsSync(studentarchivedir)) {
          fs4.mkdirSync(studentarchivedir, { recursive: true });
        }
      } catch (e) {
        log7.error(e);
      }
      const fileResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileID}/content`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      }).catch((err) => {
        log7.error(err);
      });
      try {
        const fileBuffer = await fileResponse.arrayBuffer();
        fs4.writeFileSync(join2(studentarchivedir, fileName), Buffer.from(fileBuffer));
      } catch (e) {
        log7.error(e);
      }
      const pdfFileResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileID}/content?format=pdf`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      }).catch((err) => {
        log7.error(err);
      });
      if (pdfFileResponse.ok) {
        const pdfFileBuffer = await pdfFileResponse.arrayBuffer();
        const pdfFilePath = join2(studentarchivedir, `${fileName}.pdf`);
        try {
          fs4.writeFileSync(pdfFilePath, Buffer.from(pdfFileBuffer));
          log7.info(`Downloaded ${fileName} and ${fileName}.pdf`);
        } catch (e) {
          log7.error(e);
        }
      } else {
        log7.error("there was a problem downloading the files as pdf");
      }
    });
  }
  isPdfUrl(url) {
    let pdf2 = false;
    try {
      pdf2 = url.toLowerCase().endsWith(".pdf");
    } catch (err) {
      log7.info(`ipchandler: isPdfUrl: ${err}`);
    }
    return pdf2;
  }
  copyConfig(conf) {
    let configCopy = {
      development: conf.development,
      showdevtools: conf.showdevtools,
      bipIntegration: conf.bipIntegration,
      bipDemo: conf.bipDemo,
      workdirectory: conf.workdirectory,
      tempdirectory: conf.tempdirectory,
      serverdirectory: conf.serverdirectory,
      serverApiPort: conf.serverApiPort,
      multicastClientPort: conf.multicastClientPort,
      multicastServerClientPort: conf.multicastServerClientPort,
      multicastServerAdrr: conf.multicastServerAdrr,
      hostip: conf.hostip,
      gateway: conf.gateway,
      accessToken: conf.accessToken,
      version: conf.version,
      info: conf.info,
      buildforWEB: conf.buildforWEB,
      exammodes: conf.exammodes
    };
    return configCopy;
  }
};
var ipchandler_default = new IpcHandler();

// src-electron/electron-main.js
app4.setName("next-exam-teacher");
log8.initialize();
var logfile = `${config_default.workdirectory}/next-exam-teacher.log`;
log8.eventLogger.startLogging();
log8.errorHandler.startCatching();
log8.transports.file.resolvePathFn = () => {
  return logfile;
};
log8.transports.console.format = (message) => {
  switch (message.level) {
    case "info":
      return [chalk.green(message.data.join ? message.data.join(" ") : String(message.data))];
    case "warn":
      return [chalk.yellow(message.data.join ? message.data.join(" ") : String(message.data))];
    case "error":
      return [chalk.red(message.data.join ? message.data.join(" ") : String(message.data))];
    case "debug":
      return [chalk.blue(message.data.join ? message.data.join(" ") : String(message.data))];
    case "verbose":
      return [chalk.magenta(message.data.join ? message.data.join(" ") : String(message.data))];
    default:
      return [String(message.data)];
  }
};
log8.verbose(`main @ init: -------------------`);
log8.verbose(`main @ init: starting Next-Exam Teacher "${config_default.version} ${config_default.info}" (${process.platform})${config_default.development ? " (devmode on)" : ""}`);
log8.verbose(`main @ init: -------------------`);
log8.info(`main @ init: Logfilelocation at ${logfile}`);
Menu.setApplicationMenu(null);
app4.commandLine.appendSwitch("enable-features", "Metal,CanvasOopRasterization");
app4.commandLine.appendSwitch("lang", "de");
app4.commandLine.appendSwitch("allow-file-access-from-files");
if (config_default.workdirectory) {
  app4.commandLine.appendSwitch("user-data-dir", config_default.workdirectory);
}
windowhandler_default.init(multicastclient_default, config_default);
ipchandler_default.init(multicastclient_default, config_default, windowhandler_default);
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") {
    log8.transports.console.level = false;
  }
});
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE") {
    log8.transports.console.level = false;
    log8.warn("main: EPIPE Error: Der stdout-Stream des ElectronLoggers wird deaktiviert.");
  } else {
    log8.error("main:", err.message);
  }
});
if (process.platform === "win32") app4.setAppUserModelId(app4.getName());
if (!app4.requestSingleInstanceLock()) {
  app4.quit();
  process.exit(0);
}
app4.commandLine.appendSwitch("log-level", "3");
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
var originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, options2) => {
  if (warning && warning.includes && warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")) {
    return;
  }
  return originalEmitWarning.call(process, warning, options2);
};
app4.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
app4.on("web-contents-created", (event, webContents) => {
  webContents.on("did-fail-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
    log8.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
    if (errorCode === -3) {
      log8.warn(`main @ did-fail-load: Aborted load for blob URL or PDF viewer - this is usually safe to ignore`);
      return;
    }
    if (errorCode !== -3) {
      log8.error(`main @ did-fail-load: Unexpected error ${errorCode} - ${errorDescription}`);
    }
  });
});
app4.on("window-all-closed", () => {
  windowhandler_default.mainwindow = null;
  app4.quit();
});
app4.on("second-instance", () => {
  if (windowhandler_default.mainwindow) {
    if (windowhandler_default.mainwindow.isMinimized()) windowhandler_default.mainwindow.restore();
    windowhandler_default.mainwindow.focus();
  }
});
app4.on("activate", () => {
  const allWindows = BrowserWindow3.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    windowhandler_default.createWindow();
  }
});
app4.whenReady().then(() => {
  server_default.listen(config_default.serverApiPort, () => {
    log8.info(`main @ ready: Express listening on https://${config_default.hostip}:${config_default.serverApiPort}`);
  });
}).then(async () => {
  nativeTheme.themeSource = "light";
  if (config_default.hostip == "127.0.0.1") {
    config_default.hostip = false;
  }
  if (config_default.hostip) {
    multicastclient_default.init(config_default.gateway);
  }
  powerSaveBlocker.start("prevent-display-sleep");
  windowhandler_default.createWindow();
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    const win = BrowserWindow3.getFocusedWindow();
    if (win) {
      win.webContents.toggleDevTools();
    }
  });
  globalShortcut.register("Alt+Left", () => {
    return false;
  });
});
/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or any later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>
 */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL2VsZWN0cm9uLW1haW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVycm91dGVzLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3JvdXRlcy9zZXJ2ZXIvY29udHJvbC5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3NjaGVkdWxlcnNlcnZpY2UudHMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9lbi5qc29uIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2RlLmpzb24iLCAiLi4vLi4vc3JjL21zYWx1dGlscy9hdXRoQ29uZmlnLnRzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVyL2RhdGEuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuXG5cbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBzZXJ2ZXIgZnJvbSAnLi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnO1xuXG4vLyBTbyBFbGVjdHJvbiBzaW5nbGUtaW5zdGFuY2UgbG9jayB1c2VzIGEgZGlmZmVyZW50IHVzZXJEYXRhIHRoYW4gc3R1ZGVudCAobG9jayBrZXkgPSB1c2VyRGF0YSArIGV4ZWNQYXRoKVxuYXBwLnNldE5hbWUoJ25leHQtZXhhbS10ZWFjaGVyJyk7XG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxldCBsb2dmaWxlID0gYCR7Y29uZmlnLndvcmtkaXJlY3Rvcnl9L25leHQtZXhhbS10ZWFjaGVyLmxvZ2BcblxubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5cbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIGxvZ2ZpbGUgIH1cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcbmxvZy52ZXJib3NlKGBtYWluIEAgaW5pdDogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IHN0YXJ0aW5nIE5leHQtRXhhbSBUZWFjaGVyIFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW4gQCBpbml0OiBMb2dmaWxlbG9jYXRpb24gYXQgJHtsb2dmaWxlfWApXG5cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7XG4vLyBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdmb3JjZS1kZXZpY2Utc2NhbGUtZmFjdG9yJywgJzEnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2FsbG93LWZpbGUtYWNjZXNzLWZyb20tZmlsZXMnKTtcblxuXG5pZiAoY29uZmlnLndvcmtkaXJlY3RvcnkpIHtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCd1c2VyLWRhdGEtZGlyJywgY29uZmlnLndvcmtkaXJlY3RvcnkpO1xufVxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluOiBFUElQRSBFcnJvcjogRGVyIHN0ZG91dC1TdHJlYW0gZGVzIEVsZWN0cm9uTG9nZ2VycyB3aXJkIGRlYWt0aXZpZXJ0LicpO1xuICAgIH0gXG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW46JywgZXJyLm1lc3NhZ2UpOyB9ICAvLyBBbmRlcmUgRmVobGVyIHByb3Rva29sbGllcmVuIG9kZXIgYW56ZWlnZW5cbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKVxuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkge1xuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuIC8vIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udHJvbCBvdmVyIGNvbnNvbGUgZXJyb3JzXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUsIGZyYW1lUHJvY2Vzc0lkLCBmcmFtZVJvdXRpbmdJZCkgPT4ge1xuICAgICAgICAvLyBMb2cgdGhlIGVycm9yIGJ1dCBkb24ndCBjcmFzaCB0aGUgYXBwXG4gICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhhbmRsZSBzcGVjaWZpYyBlcnJvciBjb2Rlc1xuICAgICAgICBpZiAoZXJyb3JDb2RlID09PSAtMykge1xuICAgICAgICAgICAgLy8gLTMgaXMgRVJSX0FCT1JURUQsIG9mdGVuIHJlbGF0ZWQgdG8gYmxvYiBVUkxzIG9yIFBERiB2aWV3ZXJzXG4gICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IEFib3J0ZWQgbG9hZCBmb3IgYmxvYiBVUkwgb3IgUERGIHZpZXdlciAtIHRoaXMgaXMgdXN1YWxseSBzYWZlIHRvIGlnbm9yZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGb3Igb3RoZXIgZXJyb3IgY29kZXMsIGxvZyBidXQgY29udGludWVcbiAgICAgICAgaWYgKGVycm9yQ29kZSAhPT0gLTMpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IFVuZXhwZWN0ZWQgZXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufWApO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cgPSBudWxsXG4gICAgLy9pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIGFwcC5xdWl0KClcbiAgICBhcHAucXVpdCgpXG59KVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSkgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpfSAvLyBpZiB0aGVyZSBpcyBhIHdpbmRvdyAtIGZvY3VzXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KCkgfSAgICAgICAvLyBpZiBub3QgY3JlYXRlIG5ld1xufSlcblxuYXBwLndoZW5SZWFkeSgpLnRoZW4oKCk9PnsgICAgXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgLy8gc3RhcnQgZXhwcmVzcyBBUElcbiAgICAgICAgbG9nLmluZm8oYG1haW4gQCByZWFkeTogRXhwcmVzcyBsaXN0ZW5pbmcgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICB9KSBcbn0pXG4udGhlbihhc3luYyAoKT0+e1xuICAgIG5hdGl2ZVRoZW1lLnRoZW1lU291cmNlID0gJ2xpZ2h0JyAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3QgYXBwbHkgZGFyayBzeXN0ZW0gdGhlbWVzICh3ZSBoYXZlIGRhcmsgaWNvbnMgaW4gZWRpdG9yKVxuICAgIFxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG4gICAgcG93ZXJTYXZlQmxvY2tlci5zdGFydCgncHJldmVudC1kaXNwbGF5LXNsZWVwJylcblxuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KClcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K0QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcblxufSkiLCAiXG4vKipcbiAqIERPIE5PVCBFRElUIC0gdGhpcyBmaWxlIGlzIHdyaXR0ZW4gYnkgcHJlYnVpbGQuanMgdmlhIGVsZWN0cm9uLWJ1aWxkZXIuZW52IC0gZWRpdCB2YXJzIGluIGVsZWN0cm9uLWJ1aWxkZXIuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwQXBpVXJsOiAnaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC93ZWJzZXJ2aWNlL3Jlc3QvbmV4dC1leGFtL3RlYWNoZXInLFxuXG4gICAgd29ya2RpcmVjdG9yeSA6IFwiXCIsICAgLy8gKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgdGVtcGRpcmVjdG9yeSA6IFwiXCIsICAgLy8gKGRlc2t0b3AgcGF0aCArICd0bXAnKVxuICAgIGJhY2t1cGRpcmVjdG9yeTogZmFsc2UsICAvLyAob3B0aW9uYWwpXG4gICAgc2VydmVyZGlyZWN0b3J5OiAnRVhBTS1URUFDSEVSJyxcblxuICAgIHNlcnZlckFwaVBvcnQ6IDIyNDIyLCAgLy8gdGhpcyBpcyBuZWVkZWQgdG8gYmUgcmVhY2hhYmxlIG9uIHRoZSB0ZWFjaGVycyBwYyBmb3IgYmFzaWMgZnVuY3Rpb25hbGl0eVxuICAgIG11bHRpY2FzdENsaWVudFBvcnQ6IDYwMjQsICAvLyBvbmx5IG5lZWRlZCBmb3IgZXhhbSBhdXRvZGlzY292ZXJ5XG4gICAgbXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydDogNjAyNSwgICAvLyBuZWVkZWQgdG8gZmluZCBvdGhlciBleGFtcyBpbiB0aGUgbmV0d29yayB3aXRoIHRoZSBzYW1lIG5hbWUgYW5kIHByZXZlbnQgdXNpbmcgdGhlIHNhbWUgZXhhbSBuYW1lIHR3aWNlIChjb25mdXNpb24gYWxlcnQpXG5cbiAgICBtdWx0aWNhc3RTZXJ2ZXJBZHJyOiAnMjM5LjI1NS4yNTUuMjUwJyxcbiAgICBob3N0aXA6IFwiMC4wLjAuMFwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIGV4YW1TZXJ2ZXJMaXN0OiB7fSxcbiAgICBhY2Nlc3NUb2tlbjogZmFsc2UsXG4gICAgYnVpbGRmb3JXRUI6IGZhbHNlLFxuICAgIGlzUHVhdm86IGZhbHNlLFxuICAgIFxuICAgIGV4YW1tb2Rlczoge1xuICAgICAgICByZHA6IHRydWUsXG4gICAgICAgIHdlYnNpdGU6IHRydWUsXG4gICAgICAgIGdmb3JtczogdHJ1ZSxcbiAgICAgICAgZWR1dmlkdWFsOiB0cnVlLFxuICAgICAgICBlZGl0b3I6IHRydWUsXG4gICAgICAgIG1hdGg6IHRydWUsXG4gICAgICAgIG1pY3Jvc29mdDM2NTogdHJ1ZSxcbiAgICAgICAgYWN0aXZlc2hlZXRzOiB0cnVlXG4gICAgfSxcblxuICAgIHZlcnNpb246ICcyLjAuMC4xJyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDIwNScsXG4gICAgYnVpbGROdW1iZXI6ICcxJyxcbiAgICBpbmZvOiAnUmVsZWFzZSdcbn1cbmV4cG9ydCBkZWZhdWx0IGNvbmZpZztcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgZXhwcmVzcyBmcm9tIFwiZXhwcmVzc1wiXG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnXG5pbXBvcnQgY29ycyBmcm9tICdjb3JzJ1xuaW1wb3J0IGZpbGVVcGxvYWQgZnJvbSBcImV4cHJlc3MtZmlsZXVwbG9hZFwiO1xuaW1wb3J0IHtzZXJ2ZXJSb3V0ZXJ9IGZyb20gJy4vcm91dGVzL3NlcnZlcnJvdXRlcy5qcycgXG5pbXBvcnQgY29uZmlnIGZyb20gJy4uLy4uL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBmc0V4dHJhIGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHJhdGVMaW1pdCAgZnJvbSAnZXhwcmVzcy1yYXRlLWxpbWl0JyAgLy9zaW1wbGUgZGRvcyBwcm90ZWN0aW9uXG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgemlwIGZyb20gJ2V4cHJlc3MtZWFzeS16aXAnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgb3MgZnJvbSAnb3MnXG5pbXBvcnQgZm9yZ2UgZnJvbSAnbm9kZS1mb3JnZSdcbmZvcmdlLm9wdGlvbnMudXNlUHVyZUphdmFTY3JpcHQgPSB0cnVlOyBcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4uLy4uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMnXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gJ2Nvb2tpZS1wYXJzZXInXG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IG9zLmhvbWVkaXIoKVxuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwYXRoLmpvaW4oY29uZmlnLmhvbWVkaXJlY3RvcnksIGNvbmZpZy5zZXJ2ZXJkaXJlY3RvcnkpO1xuY29uZmlnLnRlbXBkaXJlY3RvcnkgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksICdleGFtLXRtcCcpXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuXG5cbi8vIERlZmluZSB0aGUgZGVza3RvcCBwYXRoIGJhc2VkIG9uIHRoZSBwbGF0Zm9ybVxuY29uc3QgZGVza3RvcFBhdGggPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5lbnZbJ1VTRVJQUk9GSUxFJ10sICdEZXNrdG9wJylcbiAgICA6IHBhdGguam9pbihjb25maWcuaG9tZWRpcmVjdG9yeSwgJ0Rlc2t0b3AnKTtcblxuLy8gQ3JlYXRlIHRoZSBzeW1ib2xpYyBsaW5rXG5pZiAoIWZzLmV4aXN0c1N5bmMoZGVza3RvcFBhdGgpKSB7ICBmcy5ta2RpclN5bmMoZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuY29uc3QgbGlua1BhdGggPSBwYXRoLmpvaW4oZGVza3RvcFBhdGgsIGNvbmZpZy5zZXJ2ZXJkaXJlY3RvcnkpOyAgLy8gRGVmaW5lIHRoZSBwYXRoIGZvciB0aGUgc3ltYm9saWMgbGlua1xudHJ5IHtmcy51bmxpbmtTeW5jKGxpbmtQYXRoKSB9Y2F0Y2goZSl7fVxudHJ5IHsgICBpZiAoIWZzLmV4aXN0c1N5bmMobGlua1BhdGgpKSB7IGZzLnN5bWxpbmtTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBsaW5rUGF0aCwgJ2p1bmN0aW9uJyk7IH19XG5jYXRjaChlKXtsb2cuZXJyb3IoXCJtYWluOiBjYW4ndCBjcmVhdGUgc3ltbGlua1wiKX1cblxuXG5cblxudHJ5IHtcbiAgICBjb25zdCB7Z2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSAgZ2F0ZXdheTRzeW5jKClcbiAgICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSkgICAgLy8gdGhpcyByZXR1cm5zIHRoZSBpcCBvZiB0aGUgaW50ZXJmYWNlIHRoYXQgaGFzIGEgZGVmYXVsdCBnYXRld2F5Li4gIHNob3VsZCB3b3JrIGluIE1PU1QgY2FzZXMuICBwcm9iYWJseSBwcm92aWRlIFwiaXAtb3B0aW9uc1wiIGluIFVJID9cbiAgICBjb25maWcuZ2F0ZXdheSA9IHRydWVcbn1cbiBjYXRjaCAoZSkge1xuICAgbG9nLmVycm9yKFwibWFpbjogdW5hYmxlIHRvIGRldGVybWluZSBkZWZhdWx0IGdhdGV3YXlcIilcbiAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgXG4gICBsb2cuaW5mbyhgbWFpbjogSVAgJHtjb25maWcuaG9zdGlwfWApXG4gICBjb25maWcuZ2F0ZXdheSA9IGZhbHNlXG5cbiB9XG5cblxuXG5cblxuY29uc3QgbGltaXRlciA9IHJhdGVMaW1pdCh7XG4gICAgd2luZG93TXM6IDEgKiA2MCAqIDEwMDAsIC8vIDEgbWludXRlc1xuICAgIG1heDogNDAwLCAvLyBMaW1pdCBlYWNoIElQIHRvIDQwMCByZXF1ZXN0cyBwZXIgYHdpbmRvd2AgXG4gICAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLCAvLyBSZXR1cm4gcmF0ZSBsaW1pdCBpbmZvIGluIHRoZSBgUmF0ZUxpbWl0LSpgIGhlYWRlcnNcbiAgICBsZWdhY3lIZWFkZXJzOiBmYWxzZSwgLy8gRGlzYWJsZSB0aGUgYFgtUmF0ZUxpbWl0LSpgIGhlYWRlcnNcbn0pXG5cbi8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSlcblxuLy8gTGVnZW4gU2llIGRlbiBQZmFkIHp1ciBgcHVibGljL2AtUmVzc291cmNlIGJhc2llcmVuZCBhdWYgZGVtIE1vZHVzIGZlc3QuXG5jb25zdCBwdWJsaWNQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnKVxuICA6IHBhdGguam9pbigncHVibGljJyk7XG5cbi8vIEtvcGllcmVuIFNpZSBkZW4gSW5oYWx0IHZvbiBgcHVibGljL2AgaW4gZGFzIGBjb25maWcudGVtcGRpcmVjdG9yeWAuXG4vLyBmc0V4dHJhLmNvcHkocHVibGljUGF0aCwgYCR7Y29uZmlnLnRlbXBkaXJlY3Rvcnl9L2AsIGZ1bmN0aW9uIChlcnIpIHtcbi8vICAgaWYgKGVycikgcmV0dXJuIGNvbnNvbGUuZXJyb3IoZXJyKTtcbi8vICAgbG9nLmluZm8oJ3NlcnZlcjogY29waWVkIHB1YmxpYyBkaXJlY3RvcnkgdG8gdGVtcC4uLicpO1xuLy8gfSk7XG5cblxuXG5cblxuXG4vLyBpbml0IGV4cHJlc3MgQVBJXG5jb25zdCBhcGkgPSBleHByZXNzKClcbmFwaS51c2UoZmlsZVVwbG9hZCh7IGxpbWl0czogeyBmaWxlU2l6ZTogNTAgKiAxMDI0ICogMTAyNCB9LCB9KSkgIC8vV2hlbiB5b3UgdXBsb2FkIGEgZmlsZSwgdGhlIGZpbGUgd2lsbCBiZSBhY2Nlc3NpYmxlIGZyb20gcmVxLmZpbGVzIChpbml0IGJlZm9yZSByb3V0ZXMpXG5hcGkudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiAnNTBtYicgfSkpXG5hcGkudXNlKGV4cHJlc3MudXJsZW5jb2RlZCh7ZXh0ZW5kZWQ6IHRydWV9KSk7XG5hcGkudXNlKHppcCgpKVxuYXBpLnVzZShjb3JzKCkpXG5hcGkudXNlKFwiL3N0YXRpY1wiLGV4cHJlc3Muc3RhdGljKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSk7XG5hcGkudXNlKGNvb2tpZVBhcnNlcigpKTtcblxuLy8gVHJhY2sgY29ubmVjdGlvbiBtZXRyaWNzIGZvciBtb25pdG9yaW5nIChkZWNsYXJlZCBoZXJlIHNvIGl0IGNhbiBiZSB1c2VkIGluIG1pZGRsZXdhcmUpXG5sZXQgYWN0aXZlQ29ubmVjdGlvbnMgPSAwO1xuXG4vLyBSZXF1ZXN0IG1vbml0b3JpbmcgbWlkZGxld2FyZSAtIGxvZ3MgcmVxdWVzdCBkdXJhdGlvbiBhbmQgd2FybnMgb24gc2xvdyByZXF1ZXN0c1xuYXBpLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHJlcXVlc3RJZCA9IGAke3JlcS5tZXRob2R9ICR7cmVxLnVybH1gO1xuICAgIFxuICAgIHJlcy5vbignZmluaXNoJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIGlmIChkdXJhdGlvbiA+IDUwMDApIHsgLy8gV2FybiBpZiByZXF1ZXN0IHRha2VzIGxvbmdlciB0aGFuIDUgc2Vjb25kc1xuICAgICAgICAgICAgbG9nLndhcm4oYHNlcnZlcjogU2xvdyByZXF1ZXN0IGRldGVjdGVkOiAke3JlcXVlc3RJZH0gdG9vayAke2R1cmF0aW9ufW1zYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFjdGl2ZUNvbm5lY3Rpb25zID4gMTUwKSB7XG4gICAgICAgICAgICBsb2cud2Fybihgc2VydmVyOiBIaWdoIGxvYWQgLSAke2FjdGl2ZUNvbm5lY3Rpb25zfSBhY3RpdmUgY29ubmVjdGlvbnMgZHVyaW5nICR7cmVxdWVzdElkfWApO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgcmVzLm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgaWYgKCFyZXMuaGVhZGVyc1NlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IFJlcXVlc3QgY2xvc2VkIGJlZm9yZSBjb21wbGV0aW9uOiAke3JlcXVlc3RJZH0gYWZ0ZXIgJHtkdXJhdGlvbn1tc2ApO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgbmV4dCgpO1xufSk7XG5cbmFwaS51c2UoJy9zZXJ2ZXInLCBzZXJ2ZXJSb3V0ZXIpXG4vL2FwaS51c2UobGltaXRlcikgIC8vZGlzYWJsZWQgZm9yIG5vdyBiZWNhdXNlIHRoaXMgbmVlZCBhIGxvdCBvZiB0ZXN0aW5nIHRvIGZpbmQgZ29vZCBwYXJhbWV0ZXJzXG5cblxuXG5cblxuXG5cblxuXG5sZXQgY2VydHMgPSBjcmVhdGVDQUNlcnQoKSAgLy8gd2UgY2FuIG5vdCB1c2Ugc2VsZiBzaWduZWQgY2VydHMgZm9yIHdlYiAoZmFsbGJhY2sgdG8gbGV0J3MgZW5jcnlwdCEpXG5cbnZhciBvcHRpb25zID0ge1xuICAgIGtleTogY2VydHMua2V5LFxuICAgIGNlcnQ6IGNlcnRzLmNlcnQsXG4gICAgcmVxdWVzdENlcnQ6IGZhbHNlLFxuICAgIHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UsXG4gICAgYWdlbnQ6IGZhbHNlXG4gIH07XG5cbmNvbnN0IHNlcnZlciA9IGh0dHBzLmNyZWF0ZVNlcnZlcihvcHRpb25zLCBhcGkpO1xuXG4vLyBDb25maWd1cmUgdGltZW91dHMgYW5kIGNvbm5lY3Rpb24gbGltaXRzIHRvIHByZXZlbnQgcmVzb3VyY2UgZXhoYXVzdGlvblxuc2VydmVyLnRpbWVvdXQgPSAzMDAwMDsgLy8gMzAgc2Vjb25kcyAtIGNsb3NlIGlkbGUgY29ubmVjdGlvbnMgYWZ0ZXIgMzBzXG5zZXJ2ZXIua2VlcEFsaXZlVGltZW91dCA9IDUwMDA7IC8vIDUgc2Vjb25kcyAtIGNsb3NlIGtlZXAtYWxpdmUgY29ubmVjdGlvbnMgYWZ0ZXIgNXMgb2YgaW5hY3Rpdml0eVxuc2VydmVyLm1heENvbm5lY3Rpb25zID0gMjAwOyAvLyBMaW1pdCBjb25jdXJyZW50IGNvbm5lY3Rpb25zIHRvIHByZXZlbnQgb3ZlcmxvYWRcblxuLy8gVHJhY2sgY29ubmVjdGlvbiBtZXRyaWNzIGZvciBtb25pdG9yaW5nXG5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCAoc29ja2V0KSA9PiB7XG4gICAgYWN0aXZlQ29ubmVjdGlvbnMrKztcbiAgICBpZiAoYWN0aXZlQ29ubmVjdGlvbnMgPiAxNTApIHtcbiAgICAgICAgbG9nLndhcm4oYHNlcnZlcjogSGlnaCBjb25uZWN0aW9uIGNvdW50OiAke2FjdGl2ZUNvbm5lY3Rpb25zfWApO1xuICAgIH1cbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgICBhY3RpdmVDb25uZWN0aW9ucy0tO1xuICAgIH0pO1xufSk7XG5cbmlmIChjb25maWcuYnVpbGRmb3JXRUIpeyAgLy8gdGhlIGFwaSBpcyBzdGFydGVkIGJ5IHRoZSBlbGVjdHJvbiBtYWluIHByb2Nlc3MgLSBmb3Igd2ViIHdlIGRvIGl0IGhlcmVcbiAgICBzZXJ2ZXIubGlzdGVuKGNvbmZpZy5zZXJ2ZXJBcGlQb3J0LCAoKSA9PiB7ICBcbiAgICAgICAgbG9nLmluZm8oYHNlcnZlcjogRXhwcmVzcyBsaXN0ZW5pbmcgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICB9KVxuICAgIGlmIChjb25maWcuaG9zdGlwKSB7XG4gICAgICAgIG11bHRpY2FzdENsaWVudC5pbml0KClcbiAgICB9XG59XG5cbiBcbiBcblxuXG5leHBvcnQgZGVmYXVsdCBzZXJ2ZXI7XG5cblxuXG5cbmZ1bmN0aW9uIGNyZWF0ZUNBQ2VydCgpIHtcbiAgICBsZXQgcnNhID0gIGZvcmdlLnBraS5yc2E7XG4gICAgbGV0IHBraSA9IGZvcmdlLnBraTtcbiAgICBsZXQgc2VlZCA9IGZvcmdlLnJhbmRvbS5nZXRCeXRlc1N5bmMoMzIpO1xuICAgIGxldCBrZXlzID0gcnNhLmdlbmVyYXRlS2V5UGFpcih7Yml0czogMTAyNCwgc2VlZDogc2VlZH0pO1xuICAgIHZhciBjZXJ0ID0gcGtpLmNyZWF0ZUNlcnRpZmljYXRlKCk7XG4gICAgY2VydC5wdWJsaWNLZXkgPSBrZXlzLnB1YmxpY0tleTtcbiAgICBjZXJ0LnByaXZhdGVLZXkgPSBrZXlzLnByaXZhdGVLZXk7XG4gICAgY2VydC5zaWduKGtleXMucHJpdmF0ZUtleSk7XG4gICAgdmFyIHBlbV9wa2V5ID0gcGtpLnByaXZhdGVLZXlUb1BlbShrZXlzLnByaXZhdGVLZXkpO1xuICAgIHZhciBwZW1fY2VydCA9IHBraS5jZXJ0aWZpY2F0ZVRvUGVtKGNlcnQpO1xuICAgIHJldHVybiB7a2V5OiBwZW1fcGtleSAsIGNlcnQ6IHBlbV9jZXJ0fVxufTtcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdleHByZXNzJztcbmV4cG9ydCBjb25zdCBzZXJ2ZXJSb3V0ZXIgPSBSb3V0ZXIoKVxuXG5pbXBvcnQgY29udHJvbFJvdXRlcyBmcm9tICcuL3NlcnZlci9jb250cm9sLmpzJztcbmltcG9ydCBkYXRhUm91dGVzIGZyb20gJy4vc2VydmVyL2RhdGEuanMnO1xuXG5cbnNlcnZlclJvdXRlci51c2UoJy9jb250cm9sLycsIGNvbnRyb2xSb3V0ZXMpO1xuc2VydmVyUm91dGVyLnVzZSgnL2RhdGEvJywgZGF0YVJvdXRlcyk7XG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IFJvdXRlciB9IGZyb20gJ2V4cHJlc3MnXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKVxuaW1wb3J0IG11bHRpQ2FzdHNlcnZlciBmcm9tICcuLi8uLi8uLi8uLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0c2VydmVyLmpzJ1xuaW1wb3J0IG11bHRpQ2FzdGNsaWVudCBmcm9tICcuLi8uLi8uLi8uLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi8uLi8uLi9tYWluL2NvbmZpZy5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3QgeyB0IH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBxcyBmcm9tICdxcydcbmltcG9ydCBheGlvcyBmcm9tIFwiYXhpb3NcIlxuaW1wb3J0IHsgbXNhbENvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NyYy9tc2FsdXRpbHMvYXV0aENvbmZpZy50cydcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgVGVzc2VyYWN0IGZyb20gJ3Rlc3NlcmFjdC5qcyc7XG5sZXQgVGVzc2VyYWN0V29ya2VyID0gZmFsc2VcblxuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuY29uc3QgZnNwID0gZnMucHJvbWlzZXMgXG5cbi8qKlxuICogdGhpcyByb3V0ZSBnZW5lcmF0ZXMgdGhlIG5lc3Nlc2FyeSBjb2RlVmVyaWZpZXIgYW5kIGNvZGVDaGFsbGVuZ2UgZlx1MDBGQ3IgUEtDRSBcbiAqIGF1dGhvcml6YXRpb24gZmxvdyBmb3IgdGhlIG1pY3Jvc29mdCBvbmVkcml2ZSBncmFwaCBBUElcbiAqIGl0IHJlY2VpdmVzIGEgY29kZSBhbmQgdGhlbiByZWRpcmVjdHMgdG8gL21zYXV0aCB3aGljaCB3aWxsIGFxdWlyZSBhblxuICogYWNjZXNzdG9rZW5cbiAqL1xuICBcbnJvdXRlci5nZXQoJy9vYXV0aCcsIChyZXEsIHJlcykgPT4ge1xuICAgIGNvbnN0IGNvZGVWZXJpZmllciA9IGdlbmVyYXRlQ29kZVZlcmlmaWVyKCk7XG4gICAgY29uc3QgY29kZUNoYWxsZW5nZSA9IGJhc2U2NFVybEVuY29kZShzaGEyNTYoQnVmZmVyLmZyb20oY29kZVZlcmlmaWVyLCAndXRmLTgnKSkpO1xuICAgIHJlcy5jb29raWUoJ2NvZGVWZXJpZmllcicsIGNvZGVWZXJpZmllciwgeyBodHRwT25seTogdHJ1ZSB9KTtcbiAgICBjb25maWcuY29kZVZlcmlmaWVyID0gY29kZVZlcmlmaWVyXG5cbiAgICBjb25zdCBhdXRoVXJsUGFyYW1zID0ge1xuICAgICAgICBjbGllbnRfaWQ6IG1zYWxDb25maWcuYXV0aC5jbGllbnRJZCxcbiAgICAgICAgcmVzcG9uc2VfdHlwZTogJ2NvZGUnLFxuICAgICAgICByZWRpcmVjdF91cmk6IG1zYWxDb25maWcuYXV0aC5yZWRpcmVjdFVyaSxcbiAgICAgICAgcmVzcG9uc2VfbW9kZTogJ3F1ZXJ5JyxcbiAgICAgICAgc2NvcGU6ICdvcGVuaWQgcHJvZmlsZSBvZmZsaW5lX2FjY2VzcyBGaWxlcy5SZWFkV3JpdGUuQXBwRm9sZGVyIEZpbGVzLlJlYWQgRmlsZXMuUmVhZFdyaXRlJyxcbiAgICAgICAgc3RhdGU6ICcxMjM0NScsXG4gICAgICAgIGNvZGVfY2hhbGxlbmdlOiBjb2RlQ2hhbGxlbmdlLFxuICAgICAgICBjb2RlX2NoYWxsZW5nZV9tZXRob2Q6ICdTMjU2JyxcbiAgICB9O1xuICAgIGNvbnN0IGF1dGhVcmwgPSBgaHR0cHM6Ly9sb2dpbi5taWNyb3NvZnRvbmxpbmUuY29tL2NvbW1vbi9vYXV0aDIvdjIuMC9hdXRob3JpemU/JHtxcy5zdHJpbmdpZnkoYXV0aFVybFBhcmFtcyl9YDtcbiAgICByZXMucmVkaXJlY3QoYXV0aFVybCk7XG59KTtcbiAgXG4vKipcbiAqIHRoaXMgdXNlcyB0aGUgY29kZSBmcm9tIC9vYXV0aCByb3V0ZSB0b2dldGhlciB3aXRoIHRoZSBjbGllbnRfaWQgdG8gcmVjZWl2ZVxuICogYW4gYWNjZXNzVG9rZW4gZm9yIHRoZSBtaWNyb3NvZnQgb25kcml2ZSBBUElcbiAqIHRoZSB0b2tlbiBpcyBzdG9yZWQgb24gdGhlIGdsb2JhbCBjb25maWcgb2JqZWN0IGFuZCBjYW4gYmUgcmVxdWVzdGVkIHZpYSAvZ2V0Y29uZmlnIG9yIGlwY1JlbmRlcmVyICdnZXRjb25maWdcbiAqL1xucm91dGVyLmdldCgnL21zYXV0aCcsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIGNvbnN0IGNvZGUgPSByZXEucXVlcnkuY29kZTtcbiAgICBjb25zdCBjb2RlVmVyaWZpZXIgPSAgY29uZmlnLmNvZGVWZXJpZmllcjtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLnBvc3QoJ2h0dHBzOi8vbG9naW4ubWljcm9zb2Z0b25saW5lLmNvbS9jb21tb24vb2F1dGgyL3YyLjAvdG9rZW4nLCBxcy5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgY2xpZW50X2lkOiBtc2FsQ29uZmlnLmF1dGguY2xpZW50SWQsXG4gICAgICAgICAgICBncmFudF90eXBlOiAnYXV0aG9yaXphdGlvbl9jb2RlJyxcbiAgICAgICAgICAgIHNjb3BlOiAnb3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgRmlsZXMuUmVhZFdyaXRlLkFwcEZvbGRlciBGaWxlcy5SZWFkIEZpbGVzLlJlYWRXcml0ZScsXG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgcmVkaXJlY3RfdXJpOiBtc2FsQ29uZmlnLmF1dGgucmVkaXJlY3RVcmksXG4gICAgICAgICAgICBjb2RlX3ZlcmlmaWVyOiBjb2RlVmVyaWZpZXIsXG4gICAgICAgICAgICB9KSwge1xuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyxcbiAgICAgICAgICAgICAgICAnT3JpZ2luJzogJ2h0dHBzOi8vbG9jYWxob3N0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpZy5hY2Nlc3NUb2tlbiA9IHJlc3BvbnNlLmRhdGEuYWNjZXNzX3Rva2VuICAgICAvLyB3ZSByZWNlaXZlZCB0aGUgYWNjZXNzIHRva2VuIC0gc3RvcmUgaXQgb24gZ2xvYmFsIGNvbmZpZyBvYmplY3RcblxuICAgICAgICBsZXQgaHRtbCA9IGBcbiAgICAgICAgPCFET0NUWVBFIGh0bWw+XG4gICAgICAgIDxodG1sIGxhbmc9XCJlblwiPlxuICAgICAgICAgICAgPGhlYWQ+XG4gICAgICAgICAgICAgICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCI+XG4gICAgICAgICAgICAgICAgPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjBcIj5cbiAgICAgICAgICAgICAgICA8dGl0bGU+Q3VzdG9tIEJ1dHRvbjwvdGl0bGU+XG4gICAgICAgICAgICAgICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCIvc3RhdGljL2Nzcy9zdGF0aWNzdHlsZXMuY3NzXCI+XG4gICAgICAgICAgICAgICAgPHNjcmlwdD5cbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBjbG9zZVdpbmRvd0FmdGVyRm91clNlY29uZHMoKSB7IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IHdpbmRvdy5jbG9zZSgpOyB9LCA0MDAwKTsgfVxuICAgICAgICAgICAgICAgIDwvc2NyaXB0PlxuICAgICAgICAgICAgPC9oZWFkPlxuICAgICAgICAgICAgPGJvZHkgb25sb2FkPVwiY2xvc2VXaW5kb3dBZnRlckZvdXJTZWNvbmRzKClcIj48YnI+XG4gICAgICAgICAgICAgICAgPGgzPkxvZ2luIE9LITwvaDM+IDxicj5cbiAgICAgICAgICAgIDwvYm9keT5cbiAgICAgICAgPC9odG1sPmBcbiAgICAgICAgcmVzLnNlbmQoaHRtbCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvci5yZXNwb25zZS5kYXRhKTtcbiAgICAgICAgbGV0IGh0bWwgPSBgXG4gICAgICAgIDwhRE9DVFlQRSBodG1sPlxuICAgICAgICA8aHRtbCBsYW5nPVwiZW5cIj5cbiAgICAgICAgICAgIDxoZWFkPlxuICAgICAgICAgICAgICAgIDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiPlxuICAgICAgICAgICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCI+XG4gICAgICAgICAgICAgICAgPHRpdGxlPkN1c3RvbSBCdXR0b248L3RpdGxlPlxuICAgICAgICAgICAgICAgIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiL3N0YXRpYy9jc3Mvc3RhdGljc3R5bGVzLmNzc1wiPlxuICAgICAgICAgICAgPC9oZWFkPlxuICAgICAgICAgICAgPGJvZHk+PGJyPlxuICAgICAgICAgICAgICAgIDxoND4ke2Vycm9yLnJlc3BvbnNlLmRhdGEuZXJyb3JfZGVzY3JpcHRpb259PC9oND4gPGJyPlxuICAgICAgICAgICAgICAgIFBsZWFzZSBjbG9zZSB0aGlzIFdpbmRvdyBhbmQgdHJ5IGFnYWluISA8YnI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBvbmNsaWNrPVwid2luZG93LmNsb3NlKClcIiBjbGFzcz1cImN1c3RvbS1idG4gY3VzdG9tLWJ0bi1kYW5nZXJcIj5DbG9zZSBXaW5kb3c8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvYm9keT5cbiAgICAgICAgPC9odG1sPmBcbiAgICAgICAgcmVzLnN0YXR1cyg1MDApLnNlbmQoaHRtbCk7XG4gICAgfVxuICB9KTtcblxuXG5cblxuXG5cbi8qKlxuICogU1RBUlRTIGFuIGV4YW0gc2VydmVyIGluc3RhbmNlXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgY2hvc2VuIG5hbWUgKGZvciBleGFtcGxlIFwibWF0aGVcIilcbiAqIEBwYXJhbSBwYXNzd29yZCB0aGUgcGFzc3dvcmQgdG8gZW50ZXIgdGhlIGV4YW0gKG5vdCBuZWNjZXNzYXJ5IG9uIHNpbmdsZSBpbnN0YW5jZSBzeXN0ZW0gKGFwcCkgYnV0IHdpbGwgYmUgdXNlZCB0byBleGl0IHNlY3VyZSBleGFtIG1vZGUgaW4gdGhlIGZ1dHVyZSlcbiAqICNGSVhNRSAhISEgIFRoaXMgcm91dGUgbmVlZHMgdG8gYmUgc2VjdXJlZCAoYW55b25lIGNhbiBzdGFydCBhIHNlcnZlciByaWdodCBub3cgLSBvciAxMDAwIHNlcnZlcnMpXG4gKi9cbiByb3V0ZXIucG9zdCgnL3N0YXJ0LzpzZXJ2ZXJuYW1lLzpwYXNzd2Q/JywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgLy8gdGhpcyByb3V0ZSBtYXkgYmUgdXNlZCBieSBsb2NhbGhvc3Qgb25seVxuICAgIGlmICghcmVxdWVzdFNvdXJjZUFsbG93ZWQocmVxLCByZXMpKSByZXR1cm4gICAvLyBmb3IgdGhlIHdlYnZlcnNpb24gd2UgbmVlZCB0byBjaGVjayB1c2VyIHBlcm1pc3Npb25zIGhlcmUgKGZ1dHVyZSBzdHVmZilcblxuICAgIGNvbnN0IGJpcCA9IHJlcS5ib2R5LmJpcCAgLy8gdGhpcyBpbmZvIGlzIGFsc28gc2VudCB2aWEgbXVsdGljYXN0c2VydmVyIG1lc3NhZ2VcbiAgICBjb25zdCBiaXBJZCA9IHJlcS5ib2R5LmJpcElkXG5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lIFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICAvLyBsb2cuaW5mbyhyZXEuYm9keSkgLy8gaG9sZHMgd29ya2Rpcjogd2UgY291bGQgc3RvcmUgdGhlIGN1cnJlbnQgd29ya2RpcmVjdG9yeSBmb3IgZXZlcnkgbWNzZXJ2ZXIgb24gbWNzZXJ2ZXIuc2VydmVyaW5mbyBpbiB0aGUgZnV0dXJlXG4gICAgXG4gICAgLy9nZW5lcmF0ZSByYW5kb20gcGluXG4gICAgbGV0IHBpbiA9IFN0cmluZyhNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqOTAwMCkgKyAxMDAwKSAgLy8gNCBkaWdpdHMgaXMgZW5vdWdoICBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiA5MDAwKSArIDEwMDA7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCl7IHBpbiA9IFwiMTExMVwiIH0gIFxuXG4gICAgLy8gLy8gY2hlY2sgaWYgc2VydmVyIGlzIGFscmVhZHkgcnVubmluZyBsb2NhbGx5IG9yIGluIExBTlxuICAgIGlmIChtY1NlcnZlcikgeyBcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zZXJ2ZXJleGlzdHNcIiksIHN0YXR1czogXCJlcnJvclwifSlcbiAgICB9IFxuXG4gICAgZm9yIChjb25zdCBleGFtIG9mIG11bHRpQ2FzdGNsaWVudC5leGFtU2VydmVyTGlzdCkgeyAgLy8gZG8gbm90IHVzZSBmb3JFYWNoKCkgYmVjYXVzZSBpdHMgcnVuIGFzeW5jIGFuZCB0aGUgaW50ZXJwcmV0ZXIgd2lsbCBub3Qgd2FpdCBmb3IgaXQgdG8gZmluaXNoXG4gICAgICAgIGlmIChzZXJ2ZXJuYW1lID09IGV4YW0uc2VydmVybmFtZSApe1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zZXJ2ZXJleGlzdHNMQU5cIiksIHN0YXR1czogXCJlcnJvclwifSlcbiAgICAgICAgfVxuICAgICB9XG4gICAgXG4gICAgbG9nLmluZm8oJ2NvbnRyb2wgQCBzdGFydDogSW5pdGlhbGl6aW5nIG5ldyBFeGFtIFNlcnZlcjonLCBzZXJ2ZXJuYW1lKVxuICAgIGxldCBtY3MgPSBuZXcgbXVsdGlDYXN0c2VydmVyKCk7XG5cbiAgICBpZiAoIXJlcS5wYXJhbXMucGFzc3dkKXsgXG4gICAgICAgIG1jcy5pbml0KHNlcnZlcm5hbWUsIHBpbiwgXCJcIiwgYmlwLCBiaXBJZClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIG1jcy5pbml0KHNlcnZlcm5hbWUsIHBpbiwgcmVxLnBhcmFtcy5wYXNzd2QsIGJpcCwgYmlwSWQpXG4gICAgfVxuXG4gICAgY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdPW1jc1xuICAgIC8vIGxvZy5pbmZvKGNvbmZpZy53b3JrZGlyZWN0b3J5KVxuICAgIGxldCBzZXJ2ZXJpbnN0YW5jZWRpciA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgc2VydmVybmFtZSlcblxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHNlcnZlcmluc3RhbmNlZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gRGlyZWN0b3J5IG1pZ2h0IGFscmVhZHkgZXhpc3QsIHRoYXQncyBva1xuICAgIH1cbiAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyc3RhcnRlZFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0pXG4gICAgXG59KVxuXG5cblxuLyoqXG4gKiBTVE9QUyBhbiBleGFtIHNlcnZlciBpbnN0YW5jZVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIGV4YW0gc2VydmVyIGluIHF1ZXN0aW9uXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIGNzcmYgdG9rZW4gbmVlZGVkIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgKGdlbmVyYXRlZCBhbmQgdHJhbnNmZXJyZWQgdG8gdGhlIHdlYmJyb3dzZXIgb24gbG9naW4pIFxuICovXG4gcm91dGVyLmdldCgnL3N0b3BzZXJ2ZXIvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKG1jU2VydmVyICYmIHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7XG4gICAgICBcbiAgICAgICAgbWNTZXJ2ZXIuYnJvYWRjYXN0SW50ZXJ2YWwuc3RvcCgpXG5cbiAgICAgICAgbWNTZXJ2ZXIuc2VydmVyLmNsb3NlKCk7XG4gICAgICAgIC8vZGVsZXRlIG1jU2VydmVyXG4gICAgICAgIGRlbGV0ZSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnNlcnZlcnN0b3BwZWRcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9KVxuXG4gICAgICAgIFxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBjaGVja3Mgc2VydmVycGFzc3dvcmQgZm9yIGxvZ2luIHZpYSBWVUUgUk9VVEVSXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgY2hvc2VuIG5hbWUgKGZvciBleGFtcGxlIFwibWF0aGVcIilcbiAqIEBwYXJhbSBwYXNzd2QgdGhlIHBhc3N3b3JkIG5lZWRlZCB0byBlbnRlciB0aGUgZGFzaGJvYXJkICAhIUZJWE1FOiB1c2UgaHR0cHMgYW5kIHByb3BlciBhdXRoIFxuICoqL1xuIHJvdXRlci5nZXQoJy9jaGVja3Bhc3N3ZC86c2VydmVybmFtZS86cGFzc3dkPycsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWUgXG4gICAgbGV0IHBhc3N3ZCA9IHJlcS5wYXJhbXMucGFzc3dkXG4gICAgaWYgKCFwYXNzd2QpeyBwYXNzd2QgPSBcIlwifSAgIC8vIHdlIGFsbG93IGVtcHR5IHBhc3N3b3JkcyBmb3Igbm93XG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIGlmIChtY1NlcnZlcikgeyBcbiAgICAgICAgaWYgKHBhc3N3ZCA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5wYXNzd29yZCl7IFxuICAgICAgICByZXR1cm4gcmVzLnNlbmQoIHtcbiAgICAgICAgICAgIHNlbmRlcjogXCJzZXJ2ZXJcIiwgXG4gICAgICAgICAgICBtZXNzYWdlOiB0KFwiY29udHJvbC5jb3JyZWN0cHdcIiksIFxuICAgICAgICAgICAgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBwaW46IG1jU2VydmVyLnNlcnZlcmluZm8ucGluLFxuICAgICAgICAgICAgc2VydmVydG9rZW46IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4sXG4gICAgICAgICAgICBzZXJ2ZXJpcDogbWNTZXJ2ZXIuc2VydmVyaW5mby5pcFxuICAgICAgICAgICAgfSBcbiAgICAgICAgfSApfSBcbiAgICAgICAgZWxzZSB7IHJldHVybiByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wud3Jvbmdwd1wiKSwgc3RhdHVzOiBcImVycm9yXCJ9KSB9XG4gICAgfSBcbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgfVxufSlcblxuXG4vKipcbiAqICBzZW5kcyBhIGxpc3Qgb2YgYWxsIHJ1bm5pbmcgZXhhbSBzZXJ2ZXJzXG4gKi9cbnJvdXRlci5nZXQoJy9zZXJ2ZXJsaXN0JywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgbGV0IHNlcnZlcmxpc3QgPSBbXVxuICAgIE9iamVjdC52YWx1ZXMoY29uZmlnLmV4YW1TZXJ2ZXJMaXN0KS5mb3JFYWNoKCBzZXJ2ZXIgPT4ge1xuICAgICAgICBzZXJ2ZXJsaXN0LnB1c2goe3NlcnZlcm5hbWU6IHNlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIGlkOiBzZXJ2ZXIuc2VydmVyaW5mby5pZCwgc2VydmVyaXA6IHNlcnZlci5zZXJ2ZXJpbmZvLmlwLCByZWFjaGFibGU6IHRydWUsIHBhc3N3b3JkOiBzZXJ2ZXIuc2VydmVyaW5mby5wYXNzd29yZCwgdmVyc2lvbjogc2VydmVyLnNlcnZlcmluZm8udmVyc2lvbn0pIFxuICAgIH0pO1xuICAgIHJlcy5zZW5kKHtzZXJ2ZXJsaXN0OnNlcnZlcmxpc3QsIHN0YXR1czogXCJzdWNjZXNzXCJ9KVxufSlcblxuLyoqXG4gKiAgc2VuZHMgYW4gXCJhbGl2ZVwiIHNpZ25hbCBiYWNrXG4gKi9cbiByb3V0ZXIuZ2V0KCcvcG9uZycsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIHJlcy5zZW5kKCdwb25nJylcbn0pXG5cblxucm91dGVyLnBvc3QoJy9wb25nJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgcmVzLnNlbmQoeyBzdGF0dXM6IFwic3VjY2Vzc1wifSlcbn0pXG5cblxuXG5cbmxldCBkZW1vY2xpZW50cyA9IFtdXG5mb3IgKGxldCBpID0gMDsgaTwxNjsgaSsrICl7XG4gICAgbGV0IGRlbW9jbGllbnQgPSB7XG4gICAgICAgIGNsaWVudG5hbWU6IGB1c2VyLSR7IGNyeXB0by5yYW5kb21CeXRlcyg2KS50b1N0cmluZygnaGV4JykgIH1gLFxuICAgICAgICB0b2tlbjogYGNzcmYtJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWAsXG4gICAgICAgIGlwOiBmYWxzZSxcbiAgICAgICAgaG9zdG5hbWU6IGZhbHNlLFxuICAgICAgICBzZXJ2ZXJpcDogZmFsc2UsXG4gICAgICAgIHNlcnZlcm5hbWU6IGZhbHNlLFxuICAgICAgICBmb2N1czogdHJ1ZSxcbiAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkuZ2V0VGltZSgpICxcbiAgICAgICAgdmlydHVhbGl6ZWQ6IHRydWUsICAvLyB0aGlzIGNvbmZpZyBzZXR0aW5nIGlzIHNldCBieSBzaW1wbGV2bWRldGVjdC5qcyAoZWxlY3Ryb24gcHJlbG9hZClcbiAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgcGluOiBmYWxzZSxcbiAgICAgICAgc2NyZWVubG9jazogZmFsc2UsXG4gICAgICAgIGltYWdldXJsOlwidXNlci1ibGFjay5zdmdcIixcbiAgICAgICAgc3RhdHVzIDoge30gXG4gICAgfVxuICAgIGRlbW9jbGllbnRzLnB1c2goZGVtb2NsaWVudClcbn1cblxuXG5cblxuXG5cbi8qKlxuICogIFJFR0lTVEVSIENMSUVOVFxuICogIGNoZWNrcyBwaW4gY29kZSwgY3JlYXRlcyBjc3JmIHRva2VuIGZvciBjbGllbnQsIGFuc3dlcmVzIHdpdGggdG9rZW5cbiAqXG4gKiAgQHBhcmFtIHBpbiAgdGhlIHBpbmNvZGUgdG8gY29ubmVjdCB0byB0aGUgc2VydmVyaW5zdGFuY2VcbiAqICBAcGFyYW0gY2xpZW50bmFtZSB0aGUgbmFtZSBvZiB0aGUgc3R1ZGVudFxuICogIEBwYXJhbSBjbGllbnRpcCB0aGUgY2xpZW50cyBpcCBhZGRyZXNzIGZvciBhcGkgY2FsbHNcbiAqL1xuXG5cblxuIHJvdXRlci5nZXQoJy9yZWdpc3RlcmNsaWVudC86c2VydmVybmFtZS86cGluLzpjbGllbnRuYW1lLzpjbGllbnRpcC86aG9zdG5hbWUvOnZlcnNpb24vOmJpcHVzZXJpZCcsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNsaWVudG5hbWUgPSByZXEucGFyYW1zLmNsaWVudG5hbWVcbiAgICBjb25zdCBjbGllbnRpcCA9IHJlcS5wYXJhbXMuY2xpZW50aXBcbiAgICBjb25zdCBwaW4gPSByZXEucGFyYW1zLnBpblxuICAgIGNvbnN0IHZlcnNpb24gPSByZXEucGFyYW1zLnZlcnNpb25cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgdG9rZW4gPSBgY3NyZi0ke2NyeXB0by5yYW5kb21VVUlEKCl9YFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IGhvc3RuYW1lID0gcmVxLnBhcmFtcy5ob3N0bmFtZVxuICAgIGNvbnN0IGJpcHVzZXJJRCA9IHJlcS5wYXJhbXMuYmlwdXNlcmlkXG5cbiAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogQ2xpZW50IFZlcnNpb246XCIsdmVyc2lvbilcbiAgICAvLyB0aGlzIG5lZWRzIHRvIGNoYW5nZSBvbmNlIHdlIHJlYWNoZWQgdjEuMCAoZmVhdHVyZWZyZWV6ZSBmb3Igc3RhYmxlIHZlcnNpb24pXG4gICAgbGV0IHZ0ZWFjaGVyID0gY29uZmlnLnZlcnNpb24uc3BsaXQoJy4nKS5zbGljZSgwLCAyKSxcbiAgICB2ZXJzaW9udGVhY2hlciA9IHZ0ZWFjaGVyLmpvaW4oJy4nKTsgXG4gICAgbGV0IHZzdHVkZW50ID0gdmVyc2lvbi5zcGxpdCgnLicpLnNsaWNlKDAsIDIpLFxuICAgIHZlcnNpb25zdHVkZW50ID0gdnN0dWRlbnQuam9pbignLicpOyBcblxuICAgIC8vY29uc29sZS5sb2codmVyc2lvbnRlYWNoZXIsIHZlcnNpb25zdHVkZW50KVxuICBcbiAgICBpZiAoIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBpZiAoYCR7dmVyc2lvbnRlYWNoZXJ9YCAhPT0gdmVyc2lvbnN0dWRlbnQgKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC52ZXJzaW9ubWlzbWF0Y2hcIiksIHN0YXR1czogXCJlcnJvclwiLCB2ZXJzaW9uOiBjb25maWcudmVyc2lvbiwgdmVyc2lvbmluZm86IGNvbmZpZy5pbmZvfSApICB9ICBcbiAgICBcbiAgICBpZiAobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLnJlcXVpcmVCaVAgJiYgYmlwdXNlcklEID09ICdmYWxzZScpeyAvLyByZXEucGFyYW1zIGNvbWUgYXMgc3RyaW5nLi4gbm90IG5pY2UgYnV0IHNpbXBsZVxuICAgICAgICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5iaXByZXF1aXJlZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgXG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmIChwaW4gPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5waW4pIHtcbiAgICAgICAgICAgIGxldCByZWdpc3RlcmVkQ2xpZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQuY2xpZW50bmFtZSA9PT0gY2xpZW50bmFtZSlcbiAgICAgICAgXG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgaWYgKCFyZWdpc3RlcmVkQ2xpZW50KSB7ICAgLy8gY3JlYXRlIGNsaWVudCBvYmplY3RcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBhZGRpbmcgbmV3IGNsaWVudCAnJHtjbGllbnRuYW1lfSdgKVxuXG5cbiAgICAgICAgICAgICAgICAvL2dyb3VwIGhhbmRsaW5nIC0gZXZlcnlib2R5IGlzIGluIGdyb3VwQSBleGNlcHQgdGhlcmUgaXMgYWxyZWFkeSBhIGdyb3VwIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICAgICAgICBsZXQgZ3JvdXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBBPy51c2Vycz8uaW5jbHVkZXMoY2xpZW50bmFtZSkpIHsgZ3JvdXAgPSAnYSc7IH0gXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBCPy51c2Vycz8uaW5jbHVkZXMoY2xpZW50bmFtZSkpIHsgZ3JvdXAgPSAnYic7ICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7ICAvLyB1c2VyIGlzIG5vdCBpbiBhbnkgZ3JvdXAgb3Igbm8gZ3JvdXAgaXMgY29uZmlndXJlZFxuICAgICAgICAgICAgICAgICAgICBncm91cCA9ICdhJ1xuICAgICAgICAgICAgICAgICAgIG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQS51c2Vycy5wdXNoKGNsaWVudG5hbWUpXG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjbGllbnQgPSB7ICAgIC8vIHdlIGhhdmUgYSBkaWZmZXJlbnQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNsaWVudG9iamVjdCBvbiB0aGUgc2VydmVyIHRoYW4gb24gdGhlIGNsaWVudCAtIHdoeSBleGFjdGx5PyB3ZSBjb3VsZCBqdXN0IHNlbmQgdGhlIHdob2xlIGNsaWVudCBvYmplY3QgdmlhIFBPU1QgKGFzIHdlIGFscmVhZHkgZG8gaW4gL3VwZGF0ZSByb3V0ZSApXG4gICAgICAgICAgICAgICAgICAgIGNsaWVudG5hbWU6IGNsaWVudG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGhvc3RuYW1lOiBob3N0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgICAgICAgICAgICAgICBjbGllbnRpcDogY2xpZW50aXAsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgICAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGltYWdldXJsOmZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGJpcHVzZXJJRDogYmlwdXNlcklELCAgLy8gd2UgY2FuIHVzZSB0aGlzIGluIHRoZSBmdXR1cmUgdG8gcmUtY2hlY2sgaWYgdGhpcyB1c2VyIGlzIGluIHRoZSBwcmUtZGVmaW5lZCB1c2VybGlzdCBmb3IgdGhpcyBzcGVjaWZpYyBCSVAgZXhhbVxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHsgZ3JvdXA6IGdyb3VwIHx8ICdhJ30sICAgIC8vIHdlIHVzZSB0aGlzIHRvIHN0b3JlIChwZXIgc3R1ZGVudCkgaW5mb3JtYXRpb24gYWJvdXQgd2hhdHMgZ29pbmcgb24gb24gdGhlIHNlcnZlcnNpZGUgKHRhc2tsaXN0KSBhbmQgc2VuZCBpdCBiYWNrIG9uIC91cGRhdGVcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgYWxsb3cgdHdvIGdyb3VwcyAodGhpcyBpcyBqdXN0IHVzZWQgZm9yIGRpc3RyaWJ1dGlvbiBvZiBmaWxlcyBieSBub3cpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vY3JlYXRlIGZvbGRlciBmb3Igc3R1ZGVudFxuICAgICAgICAgICAgICAgIGxldCBzdHVkZW50Zm9sZGVyID1wYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSAsIGNsaWVudG5hbWUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5hY2Nlc3Moc3R1ZGVudGZvbGRlcik7IC8vIENoZWNrIGlmIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgLy8gZGFzIHZlcnplaWNobmlzIGZcdTAwRkNyIGRpZXNlbiBzdHVkZW50IGV4aXN0aWVydCBcbiAgICAgICAgICAgICAgICAgICAgLy8gYXVmIHVuaXggaXN0IGRlciBvcmRuZXJuYW1lIDEwMCUgaWRlbnQgLSBhdWYgd2luZG93cyBrXHUwMEY2bm50ZSBlcyBhYmVyIGluIGRlciBncm9zcy9rbGVpbnNjaHJlaWJ1bmcgdW50ZXJzY2hpZWRlIGdlYmVuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByXHUwMEZDZmUgb2IgZXMgRVhBS1QgZ2xlaWNoIGdlc2NocmllYmVuIHd1cmRlIChjYXNlLXNlbnNpdGl2KVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHN0dWRlbnRmb2xkZXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXREaXJOYW1lID0gcGF0aC5iYXNlbmFtZShzdHVkZW50Zm9sZGVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlyZWN0b3JpZXMgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcihwYXJlbnREaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSk7XG5cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRpcmVjdG9yaWVzLmluY2x1ZGVzKHRhcmdldERpck5hbWUpKSB7ICAvLyB3aXIgaGFiZW4gd2luZG93cyBlcnRhcHB0Li4gZGVyIGRhdGVpbmFtZSBpc3QgbmljaHQgMTAwJSBpZGVudCBcIlRlc3RcIiAhPT0gXCJ0ZXN0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdEaXIgPSBkaXJlY3Rvcmllcy5maW5kKGRpciA9PiBkaXIudG9Mb3dlckNhc2UoKSA9PT0gdGFyZ2V0RGlyTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChleGlzdGluZ0Rpcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBwYXRoLmpvaW4ocGFyZW50RGlyLCBleGlzdGluZ0Rpcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbihwYXJlbnREaXIsIGBiYWNrdXAtJHtleGlzdGluZ0Rpcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5yZW5hbWUob2xkUGF0aCwgbmV3UGF0aCk7ICAvLyBVbWJlbmVubmVuIGRlcyBhbHRlbiBWZXJ6ZWljaG5pc3Nlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IFJlbmFtaW5nICR7b2xkUGF0aH0gdG8gJHtuZXdQYXRofSAtIHRoeCBiaWxsIGdhdGVzIGZvciB0aGUgd29yc3Qgb3BlcmF0aW5nIHN5c3RlbSBvdHdgKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogVXNpbmcgYWxyZWFkeSBleGlzdGluZyBkaXJlY3Rvcnk6ICR7dGFyZ2V0RGlyTmFtZX1gKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIERhcyBWZXJ6ZWljaG5pcyBleGlzdGllcnQgbmljaHQsIGVyc3RlbGxlIGVzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihzdHVkZW50Zm9sZGVyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IENyZWF0aW5nICR7c3R1ZGVudGZvbGRlcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAobWtkaXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBFcnJvciBjcmVhdGluZyBkaXJlY3Rvcnk6ICR7bWtkaXJFcnJ9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcihjb25maWcudGVtcGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIERpcmVjdG9yeSBtaWdodCBhbHJlYWR5IGV4aXN0LCB0aGF0J3Mgb2tcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtY1NlcnZlci5zdHVkZW50TGlzdC5wdXNoKGNsaWVudClcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5yZWdpc3RlcmVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCB0b2tlbjogdG9rZW59KSAgLy8gb24gc3VjY2VzcyByZXR1cm4gY2xpZW50IHRva2VuIChhdXRoIG5lZWRlZCBmb3Igc2VydmVyIGFwaSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgbGV0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICAgICAgICAgaWYgKG5vdyAtIDIwMDAwID4gcmVnaXN0ZXJlZENsaWVudC50aW1lc3RhbXApIHsgLy8gc3R1ZGVudCBwcm9iYWJseSB3ZW50IG9mZmxpbmUgKHRlYWNoZXIgY29ubmVjdGlvbiBsb3NzKSBidXQgaXMgY29taW5nIGJhY2sgbm93XG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRDbGllbnQudGltZXN0YW1wID0gbm93XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBzdHVkZW50IHJlY29ubmVjdGVkXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgLy9pbmZvcm0gZnJvbnRlbmQgYWJvdXQgcmUtY29ubmVjdGlvblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZChcInJlY29ubmVjdGVkXCIsIHJlZ2lzdGVyZWRDbGllbnQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnJlZ2lzdGVyZWRcIiksIHN0YXR1czogXCJzdWNjZXNzXCIsIHRva2VuOiByZWdpc3RlcmVkQ2xpZW50LnRva2VufSkgIC8vc2VuZCBiYWNrIG9sZCB0b2tlblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wuYWxyZWFkeXJlZ2lzdGVyZWRcIiksIHN0YXR1czogXCJlcnJvclwifSlcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLndyb25ncGluXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgICAgIH1cbiAgICB9XG4gICAgY2F0Y2ggKGVycil7XG4gICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiAke2Vycn1gKTtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJhbiB1bmtub3duIGVycm9yIG9jY3VyZWRcIiwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgIH1cbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIElORk9STSBDbGllbnQocykgYWJvdXQgYSBcInNlbmRmaWxlXCIgcmVxdWVzdCBmcm9tIHRoZSBzZXJ2ZXIgKGNsaWVudHMgc2hvdWxkIGRvd25sb2FkIHRoZSBmaWxlKHMpIHZpYSAvZGF0YS9kb3dubG9hZC8uLi4gcm91dGUpIFxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIHRoYXQgd2FpdHMgd2l0aCB0aGUgZmlsZVxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgc2VuZCB0aGUgZXhhbSAoZmFsc2UgbWVhbnMgZXZlcnlib2R5KVxuICovXG4gcm91dGVyLnBvc3QoJy9zZW5kdG9jbGllbnQvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBjb25zdCBmaWxlcyA9IHJlcS5ib2R5LmZpbGVzICAgLy8gIHsgZmlsZXM6WyB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0sIHtuYW1lOmZpbGUubmFtZSwgcGF0aDpmaWxlLnBhdGggfSBdIH1cbiAgIFxuICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3RcbiAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PT0gXCJhbGxcIil7XG4gICAgICAgICAgICBmb3IgKGxldCBzdHVkZW50IG9mIG1jU2VydmVyLnN0dWRlbnRMaXN0KXsgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXSA9IHRydWUgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gIGZpbGVzXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXT0gdHJ1ZSBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9IGZpbGVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmV4YW1yZXF1ZXN0XCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuICAgIH1cbn0pXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogIEtJQ0sgY2xpZW50IC0gY2xpZW50IHdpbGwgZ2V0IGVycm9yIHJlc3BvbnNlIG9uIG5leHQgdXBkYXRlIGFuZCByZW1vdmUgY29ubmVjdGlvbiBhdXRvbWF0aWNhbGx5XG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgdGhhdCB3YW50cyB0byBraWNrIHRoZSBjbGllbnRcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIGJlIGtpY2tlZFxuICovXG4vLyAgcm91dGVyLmdldCgnL2tpY2svOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4vLyAgICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuLy8gICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4vLyAgICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuLy8gICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3Rcbi8vICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuLy8gICAgICAgICBpZiAoc3R1ZGVudCkgeyAgIG1jU2VydmVyLnN0dWRlbnRMaXN0ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmlsdGVyKCBlbCA9PiBlbC50b2tlbiAhPT0gIHN0dWRlbnR0b2tlbik7IH0gLy8gcmVtb3ZlIGNsaWVudCBmcm9tIHN0dWRlbnRsaXN0XG4vLyAgICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zdHVkZW50cmVtb3ZlXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4vLyAgICAgfVxuLy8gICAgIGVsc2Uge1xuLy8gICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuLy8gICAgIH1cbi8vIH0pXG5cblxuXG5cbi8qKlxuICogU0VUIGNpZW50cyBTSEFSRSBMSU5LIGZvciBtaWNyb3NvZnQzNjUgbW9kZVxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVycyBuYW1lXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBiZSBraWNrZWRcbiAqL1xucm91dGVyLnBvc3QoJy9zaGFyZWxpbmsvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBjb25zdCBzaGFyZWxpbmsgPSByZXEuYm9keS5zaGFyZWxpbmtcblxuICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3RcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICBpZiAoc3R1ZGVudCkgeyAgIFxuICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMubXNvZmZpY2VzaGFyZSA9IHNoYXJlbGlua1xuICAgICAgICAgfVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc3R1ZGVudHVwZGF0ZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG4vKipcbiAqIFJFU1RPUkUgY2llbnRzIGZvY3VzZWQgc3RhdGUgICEhIFVTRSAvc2V0c3R1ZGVudHN0YXR1cy8gaW5zdGVhZCAoc2ltcGxpZnkgY29kZSlcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciBcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8ncyBzdGF0ZSBzaG91bGQgYmUgcmVzdG9yZWRcbiAqL1xuIHJvdXRlci5nZXQoJy9yZXN0b3JlLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBcbiAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID0gdHJ1ZSAgLy8gc2V0IHN0dWRlbnQuc3RhdHVzIHNvIHRoYXQgdGhlIHN0dWRlbnQgY2FuIHJlc3RvcmUgaXRzIGZvY3VzIHN0YXRlIG9uIHRoZSBuZXh0IHVwZGF0ZVxuICAgICAgICAgfVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc3RhdGVyZXN0b3JlXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuICAgIH1cbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBGRVRDSCBFWEFNUyBmcm9tIGNvbm5lY3RlZCBjbGllbnRzIChzZXQgc3R1ZGVudC5zdGF0dXMgLSBzdHVkZW50cyB3aWxsIHRoZW4gc2VuZCB0aGVpciB3b3JrZGlyZWN0b3J5IHRvIC9kYXRhL3JlY2VpdmUpXG4gKiBhdHRlbnRpb24hISAgbW92ZSB0byBzZXRTdHVkZW50U3RhdHVzIGV2ZW50dWFsbHkuLiBiZWNhdXNlIGl0cyByZWR1bmRhbnRcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciB0aGF0IHdhbnRzIHRvIGtpY2sgdGhlIGNsaWVudFxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgc2VuZCB0aGUgZXhhbSAoZmFsc2UgbWVhbnMgZXZlcnlib2R5KVxuICovXG4gcm91dGVyLmdldCgnL2ZldGNoLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IHN0dWRlbnQuc3RhdHVzWydzZW5kZXhhbSddID0gdHJ1ZSAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIHN0dWRlbnQuc3RhdHVzWydzZW5kZXhhbSddPSB0cnVlICB9ICAgXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmV4YW1yZXF1ZXN0XCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuICAgIH1cbn0pXG5cblxuXG5cblxuXG4vKipcbiAqIEdldCBwcmV2aW91cyBTZXJ2ZXJzdGF0dXMgYW5kIHJldHVybiBTZXJ2ZXJzdGF0dXMgZnJvbSBGSUxFIChmcm9tIHByZXZpb3VzIGludGVycnVwdGVkIGV4YW0gaW4gb3JkZXIgdG8gcmVzdW1lKVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gc2VydmVydG9rZW4gdG8gYXV0aGVudGljYXRlIGJlZm9yZSB0aGUgcmVxdWVzdCBpcyBwcm9jZXNzZWRcbiAqL1xucm91dGVyLnBvc3QoJy9nZXRzZXJ2ZXJzdGF0dXMvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNzcmZzZXJ2ZXJ0b2tlbiA9IHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgaWYgKGNzcmZzZXJ2ZXJ0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC50b2tlbm5vdHZhbGlkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKX1cbiAgICAvLyBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMgdm9uIGRlciBKU09OLURhdGVpIHdpZWRlciBpbXBvcnRpZXJlblxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsICdzZXJ2ZXJzdGF0dXMuanNvbicpO1xuICAgIGxldCBzZXJ2ZXJzdGF0dXM7XG4gICAgdHJ5IHsgIFxuICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgc2VydmVyc3RhdHVzID0gSlNPTi5wYXJzZShmaWxlQ29udGVudCk7IFxuICAgICAgICBtY1NlcnZlci5zZXJ2ZXJpbmZvLnBpbiA9IHNlcnZlcnN0YXR1cy5waW4gIC8vYWxzbyByZXN0b3JlIGxhc3QgcGluIHRvIG1ha2UgaXQgZWFzaWVyIGZvciBzdHVkZW50c1xuICAgIH0gICAgXG4gICAgY2F0Y2ggKGVycm9yKSB7ICBzZXJ2ZXJzdGF0dXMgPSBmYWxzZTsgIH1cbiAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXN9KSBcbn0pXG5cbi8vZ2V0IGN1cnJlbnQgc2VydmVyc3RhdHVzIGZyb20gbWNzZXJ2ZXJcbnJvdXRlci5nZXQoJy9nZXRjdXJyZW50c2VydmVyc3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjc3Jmc2VydmVydG9rZW4gPSByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChjc3Jmc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudG9rZW5ub3R2YWxpZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICl9XG4gICBcbiAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgc2VydmVyc3RhdHVzOiBtY1NlcnZlci5zZXJ2ZXJzdGF0dXN9KSBcbn0pXG5cblxuXG5cbi8qKlxuICogU2V0IFNlcnZlcnN0YXR1cyBcbiAqIFN0dWRlbnRzIGZldGNoIHRoZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0IGV2ZXJ5IHVwZGF0ZWN5Y2xlIGFuZCBhY3Qgb24gaXQgKHN0YXJ0IGV4YW0sIGxvY2tzY3JlZW5zLGV0YylcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXJcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gc2VydmVydG9rZW4gdG8gYXV0aGVudGljYXRlIGJlZm9yZSB0aGUgcmVxdWVzdCBpcyBwcm9jZXNzZWRcbiAqIEBwYXJhbSByZXEuYm9keS5zZXJ2ZXJzdGF0dXMgY29udGFpbnMgdGhlIHdob2xlIHNlcnZlcnN0YXR1cyBvYmplY3RcbiAqL1xucm91dGVyLnBvc3QoJy9zZXRzZXJ2ZXJzdGF0dXMvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNzcmZzZXJ2ZXJ0b2tlbiA9IHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgaWYgKGNzcmZzZXJ2ZXJ0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC50b2tlbm5vdHZhbGlkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKX1cbiAgICBcbiAgICBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMgPSByZXEuYm9keS5zZXJ2ZXJzdGF0dXNcbiAgICBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5tc09mZmljZUZpbGUgPSBmYWxzZSAgLy8gd2UgY2FudCBzdG9yZSBhIGZpbGUgb2JqZWN0IGFzIGpzb25cblxuICAgIC8vY29uc29sZS5sb2coXCJjb250cm9sOlwiLCBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMpXG4gICAgbG9nLmluZm8oXCJjb250cm9sIEAgc2V0c2VydmVyc3RhdHVzOiBzYXZpbmcgc2VydmVyIHN0YXR1cyB0byBkaXNjXCIpXG4gICAgXG4gICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lKVxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsICdzZXJ2ZXJzdGF0dXMuanNvbicpO1xuXG4gICAgdHJ5IHsgIFxuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcih3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgY29uc3QganNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KG1jU2VydmVyLnNlcnZlcnN0YXR1cywgbnVsbCwgMik7XG4gICAgICAgIC8vIFZhbGlkYXRlIEpTT04gYmVmb3JlIHdyaXRpbmcgdG8gcHJldmVudCBpbnZhbGlkIEpTT04gZmlsZXNcbiAgICAgICAgSlNPTi5wYXJzZShqc29uU3RyaW5nKTtcbiAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCBqc29uU3RyaW5nKTsgIFxuICAgIH0gICAvLyBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMgYWxzIEpTT04tRGF0ZWkgc3BlaWNoZXJuXG4gICAgY2F0Y2ggKGVycm9yKSB7ICBcbiAgICAgICAgbG9nLmVycm9yKGBjb250cm9sIEAgc2V0c2VydmVyc3RhdHVzOiAke2Vycm9yfWAgKTtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwiY291bGQgbm90IHNhdmUgc2VydmVyc3RhdHVzIHRvIGRpc2NcIiwgc3RhdHVzOiBcImVycm9yXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImdlbmVyYWwub2tcIiksIHN0YXR1czogXCJzdWNjZXNzXCIgfSlcbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIFNldCBTVFVERU5ULlNUQVRVUyBhbmQgdGhlcmVmb3JlIEluZm9ybSBDbGllbnQgb24gdGhlIG5leHQgdXBkYXRlIGN5Y2xlIGFib3V0IGEgZGVuaWVkIHByaW50cmVxdWVzdCAod2UgaGFuZGxlIG9uZSByZXF1ZXN0IGF0IGEgdGltZSkgYW5kIG90aGVyIHRoaW5ncy5cbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciBcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIGJlIGluZm9ybWVkXG4gKi9cbnJvdXRlci5wb3N0KCcvc2V0c3R1ZGVudHN0YXR1cy86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIFxuICAgIGNvbnN0IHByaW50ZGVuaWVkID0gcmVxLmJvZHkucHJpbnRkZW5pZWRcbiAgICBjb25zdCBkZWxmb2xkZXIgPSByZXEuYm9keS5kZWxmb2xkZXJcbiAgICBjb25zdCBhY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID0gcmVxLmJvZHkuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVja1xuICAgIGNvbnN0IGFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zID0gcmVxLmJvZHkuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcbiAgICBjb25zdCByZW1vdmVwcmludHJlcXVlc3QgPSByZXEuYm9keS5yZW1vdmVwcmludHJlcXVlc3RcbiAgICBjb25zdCBncm91cCA9IHJlcS5ib2R5Lmdyb3VwXG4gICAgY29uc3Qga2lja2VkID0gcmVxLmJvZHkua2lja1xuICAgIGNvbnN0IG1zb2ZmaWNlc2hhcmUgPSByZXEuYm9keS5tc29mZmljZXNoYXJlXG4gICAgY29uc3QgZ2V0bWF0ZXJpYWxzID0gcmVxLmJvZHkuZ2V0bWF0ZXJpYWxzXG5cblxuICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3RcbiAgICAgICAgXG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IFxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIpICB7IHN0dWRlbnQuc3RhdHVzLmRlbGZvbGRlciA9IHRydWUgICB9IC8vIG9uIHRoZSBuZXh0IHVwZGF0ZSBjeWNsZSB0aGUgc3R1ZGVudCBnZXRzIGluZm9ybWVkIHRvIGRlbGV0ZSB3b3JrZm9sZGVyXG4gICAgICAgICAgICAgICAgaWYgKGdyb3VwKSB7c3R1ZGVudC5zdGF0dXMuZ3JvdXAgPSBncm91cDsgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbXNvZmZpY2VzaGFyZSAhPT0gJ3VuZGVmaW5lZCcpIHtzdHVkZW50LnN0YXR1cy5tc29mZmljZXNoYXJlID0gbXNvZmZpY2VzaGFyZTsgfSAgIC8vIHdlIG5lZWQgdG8gc2V0IHRoaXMgdG8gZmFsc2UgZm9yIGV2ZXJ5IHN0dWRlbnQgdG8gdHJpZ2dlciBhIG5ldyB1cGxvYWQgb2YgdGhlIG1zT2ZmaWNlRmlsZSBvbiBzZWN0aW9uIGNoYW5nZVxuICAgICAgICAgICAgICAgIGlmIChnZXRtYXRlcmlhbHMpIHtzdHVkZW50LnN0YXR1cy5nZXRtYXRlcmlhbHMgPSB0cnVlOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgXG4gICAgICAgICAgICAgICAgLy8gaGVyZSB3ZSBoYW5kbGUgZGlmZmVyZW50IGZvcm1zIG9mIGluZm9ybWF0aW9uIHRoYXQgbmVlZHMgdG8gYmUgc2V0IG9uIHN0dWRlbnRzdGF0dXMgKGRvbnQgZm9yZ2V0IHRvIHJlc2V0IHRob3NlIHZhbHVlcyBpbiAvdXBkYXRlL3JvdXRlKVxuICAgICAgICAgICAgICAgIGlmIChwcmludGRlbmllZCl7IFxuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5wcmludGRlbmllZCA9IHRydWUgLy8gc2V0IHN0dWRlbnQuc3RhdHVzIHNvIHRoYXQgdGhlIHN0dWRlbnQgY2FuIGFjdCBvbiBpdCBvbiB0aGUgbmV4dCB1cGRhdGVcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5wcmludHJlcXVlc3QgPSBmYWxzZSAgLy8gdW5zZXQgcHJpbnRyZXF1ZXN0IHNvIHRoYXQgZGFzaGJvYXJkIGZldGNoSW5mbyAod2hpY2ggZmV0Y2hlcyB0aGUgc3R1ZGVudGxpc3QpIGRvZXNudCB0cmlnZ2VyIGl0IGFnYWluXG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyKSAgeyBzdHVkZW50LnN0YXR1cy5kZWxmb2xkZXIgPSB0cnVlICAgfSAvLyBvbiB0aGUgbmV4dCB1cGRhdGUgY3ljbGUgdGhlIHN0dWRlbnQgZ2V0cyBpbmZvcm1lZCB0byBkZWxldGUgd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgIGlmIChhY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrKSB7ICAgIC8vIGFsbG93IHNwZWxsY2hlY2sgZm9yIHRoaXMgc3BlY2lmaWMgc3R1ZGVudCAoc3BlY2lhbCBjYXNlcylcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IHRydWU7IFxuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9ucyA9IGFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5hY3RpdmF0ZVN1Z2dlc3Rpb25zID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZW1vdmVwcmludHJlcXVlc3QgPT0gdHJ1ZSl7IHN0dWRlbnQucHJpbnRyZXF1ZXN0ID0gZmFsc2UgfSAgLy8gdW5zZXQgcHJpbnRyZXF1ZXN0IHNvIHRoYXQgZGFzaGJvYXJkIGZldGNoSW5mbyAod2hpY2ggZmV0Y2hlcyB0aGUgc3R1ZGVudGxpc3QpIGRvZXNudCB0cmlnZ2VyIGl0IGFnYWluXG4gICAgICAgICAgICAgICAgaWYgKGdyb3VwKSB7c3R1ZGVudC5zdGF0dXMuZ3JvdXAgPSBncm91cDsgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbXNvZmZpY2VzaGFyZSAhPT0gJ3VuZGVmaW5lZCcpIHtzdHVkZW50LnN0YXR1cy5tc29mZmljZXNoYXJlID0gbXNvZmZpY2VzaGFyZTsgfVxuICAgICAgICAgICAgICAgIGlmIChraWNrZWQpIHsgc3R1ZGVudC5zdGF0dXMua2lja2VkID0gdHJ1ZSB9XG4gICAgICAgICAgICAgICAgaWYgKGdldG1hdGVyaWFscykge3N0dWRlbnQuc3RhdHVzLmdldG1hdGVyaWFscyA9IHRydWU7IH1cblxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJjb250cm9sIEAgc2V0c3R1ZGVudHN0YXR1czpcIiwgcmVxLmJvZHkpXG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICBcbiAgICAgICAgICAgIGlmIChub3cgLSAyMDAwMCA+IHN0dWRlbnQudGltZXN0YW1wICYmIHN0dWRlbnQuc3RhdHVzLmtpY2tlZCkgICAge1xuICAgICAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgIG1jU2VydmVyLnN0dWRlbnRMaXN0ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmlsdGVyKCBlbCA9PiBlbC50b2tlbiAhPT0gIHN0dWRlbnR0b2tlbik7IH0gLy8gcmVtb3ZlIGNsaWVudCBmcm9tIHN0dWRlbnRsaXN0XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc3R1ZGVudHVwZGF0ZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cbi8qKlxuICogVEhFIEZPTExPV0lORyBST1VURVMgQVJFIEFDQ0VTU0VEIEJZIFNUVURFTlRTIE9OTFlcbiAqL1xuXG5cbi8qKlxuICogVVBEQVRFUyBDbGllbnRpbmZvIC0gdGhlIHNwZWNpZmllZCBzdHVkZW50cyB0aW1lc3RhbXAgKHVzZWQgaW4gZGFzaGJvYXJkIHRvIG1hcmsgdXNlciBhcyBvbmxpbmUpIGFuZCBvdGhlciBzdGF0dXMgdXBkYXRlc1xuICogRkVUQ0hFUyBTZXJ2ZXJzdGF0dXMgJiBTdHVkZW50c3RhdHVzXG4gKiB1c3VhbGx5IHRyaWdnZXJlZCBieSB0aGUgY2xpZW50cyBkaXJlY3RseSBmcm9tIHRoZSBNYWluIFByb2Nlc3MgKGxvb3ApXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIGF0IHdoaWNoIHRoZSBzdHVkZW50IGlzIHJlZ2lzdGVyZWRcbiAqIEBwYXJhbSB0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gdG8gc2VhcmNoIGFuZCB1cGRhdGUgdGhlIGVudHJ5IGluIHRoZSBsaXN0XG4gKi9cbiByb3V0ZXIucG9zdCgnL3VwZGF0ZScsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNsaWVudGluZm8gPSByZXEuYm9keS5jbGllbnRpbmZvXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgIGNvbnN0IGV4YW1tb2RlID0gY2xpZW50aW5mby5leGFtbW9kZVxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcblxuICAgIC8vY2hlY2sgaWYgc2VydmVyIGFuZCBzdHVkZW50IGV4aXN0XG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoICFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3RhdmFpbGFibGVcIiwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH0gIC8vIHNlcnZlciBpcyBnb25lIC0gZGlzY29ubmVjdCBzdHVkZW50XG5cbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgaWYgKCAhc3R1ZGVudCApIHtyZXR1cm4gcmVzLnNlbmQoeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJyZW1vdmVkXCIsIHN0YXR1czogXCJlcnJvclwiIH0pIH0gLy8gc3R1ZGVudCBraWNrZWQgLSBkaXNjb25uZWN0IHN0dWRlbnRcblxuICAgIC8vdXBkYXRlIGltcG9ydGFudCBzdHVkZW50IGF0dHJpYnV0ZXNcbiAgICBzdHVkZW50LmZvY3VzID0gY2xpZW50aW5mby5mb2N1c1xuICAgIHN0dWRlbnQudmlydHVhbGl6ZWQgPSBjbGllbnRpbmZvLnZpcnR1YWxpemVkXG4gICAgc3R1ZGVudC50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vbGFzdCBzZWVuICAvIHRoaXMgaXMgbGlrZSBhIGhlYXJ0YmVhdCAtIHVwZGF0ZSBsYXN0c2VlblxuICAgIHN0dWRlbnQuZXhhbW1vZGUgPSBleGFtbW9kZSAgXG4gICAgc3R1ZGVudC5maWxlcyA9IGNsaWVudGluZm8ubnVtYmVyT2ZGaWxlc1xuICAgIHN0dWRlbnQucmVtb3RlYXNzaXN0YW50ID0gY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnRcblxuICAgIGlmIChjbGllbnRpbmZvLmZvY3VzKSB7IHN0dWRlbnQuc3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID0gZmFsc2UgfSAgLy8gcmVtb3ZlIHRhc2sgYmVjYXVzZSBpdHMgb2J2aW91c2x5IGRvbmVcbiAgICBpZiAoY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCl7IHN0dWRlbnQuaW1hZ2V1cmwgPSBcInBlcnNvbi1saW5lcy1maWxsLnN2Z1wiICB9XG5cbiAgICBsZXQgc3R1ZGVudHN0YXR1cyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc3R1ZGVudC5zdGF0dXMpKSAgLy8gY29weSBjdXJyZW50IHN0YXR1cyA+IHNlbmQgY29weSBvZiBvcmlnaW5hbCB0byBzdHVkZW50XG4gICBcbiAgICAvLyB0ZWFjaGVyIHNldHMgc3R1ZGVudHN0YXR1cy5raWNrIHRvIHRydWUgLSB0aGUgbW9tZW50IHRoZSBzdHVkZW50IGZldGNoZXMgaGlzIHN0YXR1cyBhbmQga253b24gaGUncyBraWNrZWQgaGUgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIHNlcnZlclxuICAgIGlmIChzdHVkZW50LnN0YXR1cy5raWNrZWQpICAgIHtcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICBpZiAoc3R1ZGVudCkgeyAgIG1jU2VydmVyLnN0dWRlbnRMaXN0ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmlsdGVyKCBlbCA9PiBlbC50b2tlbiAhPT0gIHN0dWRlbnR0b2tlbik7IH0gLy8gcmVtb3ZlIGNsaWVudCBmcm9tIHN0dWRlbnRsaXN0XG4gICAgfVxuXG5cbiAgICAvLyByZXNldCBzb21lIHN0YXR1cyB2YWx1ZXMgdGhhdCBhcmUgb25seSB1c2VkIHRvIHRyYW5zcG9ydCBzb21ldGhpbmcgb25jZVxuICAgIHN0dWRlbnQuc3RhdHVzLnByaW50ZGVuaWVkID0gZmFsc2UgXG4gICAgc3R1ZGVudC5zdGF0dXMuZGVsZm9sZGVyID0gZmFsc2UgXG4gICAgc3R1ZGVudC5zdGF0dXMuc2VuZGV4YW0gPSBmYWxzZSAvLyByZXF1ZXN0IG9ubHkgb25jZVxuICAgIHN0dWRlbnQuc3RhdHVzLmZvY3VzID0gdHJ1ZVxuICAgIHN0dWRlbnQuc3RhdHVzLmdldG1hdGVyaWFscyA9IGZhbHNlXG4gICAgLy9zdHVkZW50LnN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID0gZmFsc2UgICAvLyBhY3RpdmF0ZSBvbmx5IG9uY2UgLSB3aGVuIHN0dWRlbnQgcmV0cmlldmVkIFwic3R1ZGVudHN0YXR1c1wiIHdlIGNhbiByZXNldCBzb21lIHZhbHVlcyBvZiBcInN0dWRlbnQuc3RhdHVzXCJcblxuICAgIC8vIHJldHVybiBjdXJyZW50IHNlcnZlcmluZm9ybWF0aW9uIHRvIHByb2Nlc3Mgb24gY2xpZW50c2lkZSBcbiAgICAvLyBDcmVhdGUgb3B0aW1pemVkIHNoYWxsb3cgY29weSBvZiBzZXJ2ZXJzdGF0dXMgd2l0aG91dCBleGFtSW5zdHJ1Y3Rpb25GaWxlcyB0byByZWR1Y2UgcGF5bG9hZCBzaXplXG4gICAgY29uc3Qgc2VydmVyc3RhdHVzQ29weSA9IHsgLi4ubWNTZXJ2ZXIuc2VydmVyc3RhdHVzIH07XG4gICAgc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnMgPSB7IC4uLm1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnMgfTtcbiAgICBcbiAgICAvLyBDbGVhciBleGFtSW5zdHJ1Y3Rpb25GaWxlcyBpbiBhbGwgNCBleGFtU2VjdGlvbnMgZm9yIGJvdGggZ3JvdXBBIGFuZCBncm91cEIgKHdlIGRvbnQgd2FudCB0byBzZW5kIHRoZSBtYXRlcmlhbHMgdG8gdGhlIHN0dWRlbnQgb24gZXZlcnkgdXBkYXRlKVxuICAgIGZvciAobGV0IHNlY3Rpb25LZXkgb2YgWzEsIDIsIDMsIDRdKSB7XG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XSkge1xuICAgICAgICAgICAgc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0gPSB7XG4gICAgICAgICAgICAgICAgLi4uc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0sXG4gICAgICAgICAgICAgICAgZ3JvdXBBOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldLmdyb3VwQSxcbiAgICAgICAgICAgICAgICAgICAgZXhhbUluc3RydWN0aW9uRmlsZXM6IFtdXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBncm91cEI6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0uZ3JvdXBCLFxuICAgICAgICAgICAgICAgICAgICBleGFtSW5zdHJ1Y3Rpb25GaWxlczogW11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJlcy5jaGFyc2V0ID0gJ3V0Zi04JztcbiAgICByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VydmVyc3RhdHVzOnNlcnZlcnN0YXR1c0NvcHksIHN0dWRlbnRzdGF0dXM6IHN0dWRlbnRzdGF0dXMgfSlcbn0pXG5cblxuLyoqXG4gKiBVUERBVEUgU0NSRUVOU0hPVFxuICogUE9TVCBEYXRhIGNvbnRhaW5zIGEgc2NyZWVuc2hvdCBvZiB0aGUgY2xpZW50cyBkZXNrdG9wICEhXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIGF0IHdoaWNoIHRoZSBzdHVkZW50IGlzIHJlZ2lzdGVyZWRcbiAqIEBwYXJhbSB0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gdG8gc2VhcmNoIGFuZCB1cGRhdGUgdGhlIHNjcmVlbnNob3RcbiAqL1xucm91dGVyLnBvc3QoJy91cGRhdGVzY3JlZW5zaG90JywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY2xpZW50aW5mbyA9IHJlcS5ib2R5LmNsaWVudGluZm9cbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IGNsaWVudGluZm8uc2VydmVybmFtZVxuXG4gICAgLy8gY2hlY2sgaWYgc3R1ZGVudEBzZXJ2ZXIgZXhpc3RzXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoICFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3RhdmFpbGFibGVcIiwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgaWYgKCAhc3R1ZGVudCApIHtyZXR1cm4gcmVzLnNlbmQoeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJyZW1vdmVkIGZyb20gc2VydmVyXCIsIHN0YXR1czogXCJlcnJvclwiIH0pIH0gLy9jaGVjayBpZiB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkIG9uIHRoaXMgc2VydmVyXG4gIFxuICAgIGlmIChyZXEuYm9keS5zY3JlZW5zaG90ICkge1xuICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gcmVxLmJvZHkuc2NyZWVuc2hvdDsgICAvLyBEZXIgQmFzZTY0LVN0cmluZyBtdXNzIG5pY2h0IGtvbnZlcnRpZXJ0IHdlcmRlbiwgZXIga2FubiBkaXJla3QgdmVyd2VuZGV0IHdlcmRlblxuICAgICAgICAvL2xldCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShCdWZmZXIuZnJvbShzY3JlZW5zaG90QmFzZTY0LCAnYmFzZTY0JykpLmRpZ2VzdChcImhleFwiKTsgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICBcbiAgICAgICAgICAgIHN0dWRlbnQuaW1hZ2V1cmwgPSAnZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwnICsgc2NyZWVuc2hvdEJhc2U2NDsgLy8gb2RlciAnZGF0YTppbWFnZS9wbmc7YmFzZTY0LCcgamUgbmFjaCB0YXRzXHUwMEU0Y2hsaWNoZW0gQmlsZGZvcm1hdCAgXG5cbiAgICAgICAgICAgIC8vIG9ubHkgc2NhbiBzY3JlZW5zaG90IGluIGV4YW0gbW9kZSBhbmQgTk9UIGlmIGEgcmVzdG9yaW5nL3VubG9ja2luZyBvcGVyYXRpb24gaXMgYWxyZWFkeSBpbiBwcm9jZXNzIChvdGhlcndpc2UgaXQgd2lsbCBsb2NrIHRoZSB1bmxvY2tlZCBhZ2FpbilcbiAgICAgICAgICAgIGlmIChtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLnNjcmVlbnNob3RvY3IgJiYgIXN0dWRlbnQuc3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlICYmIHN0dWRlbnQuZm9jdXMpe1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gcmVxLmJvZHkuaGVhZGVyLnNwbGl0KCc7YmFzZTY0LCcpLnBvcCgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJpbWFnZUJ1ZmZlciA9IEJ1ZmZlci5mcm9tKGhlYWRlciwgJ2Jhc2U2NCcpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IGFwcC5pc1BhY2thZ2VkXG4gICAgICAgICAgICAgICAgICAgID8gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJylcbiAgICAgICAgICAgICAgICAgICAgOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIVRlc3NlcmFjdFdvcmtlcil7XG4gICAgICAgICAgICAgICAgICAgICAgICBUZXNzZXJhY3RXb3JrZXIgPSBhd2FpdCBUZXNzZXJhY3QuY3JlYXRlV29ya2VyKCdlbmcnLDEse1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdQYXRoOiBwdWJsaWNQYXRoICwgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgPSBhd2FpdCBUZXNzZXJhY3RXb3JrZXIucmVjb2duaXplKGhlYWRlcmltYWdlQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBpbmNvZGVWaXNpYmxlID0gdGV4dC5pbmNsdWRlcyhtY1NlcnZlci5zZXJ2ZXJpbmZvLnBpbilcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXBpbmNvZGVWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuZm9jdXMgPSBwaW5jb2RlVmlzaWJsZSAgLy8gdGhpcyBpcyB0aGUgbG9jYWwgc3R1ZGVudCBvYmplY3QgZm9yIHRoZSBmcm9udGVuZFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuZm9jdXMgPSBwaW5jb2RlVmlzaWJsZSAgLy8gdGhpcyBzZXRzIHRoZSBzdHVkZW50c3RhdHVzIG9iamVjdCB3aGljaCBpcyBmZXRjaGVkIG9uIGV2ZXJ5IHVwZGF0ZSAtIHRoZSBzdHVkZW50cyByZWFjdCBvbiB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCB1cGRhdGVzY3JlZW5zaG90IChvY3IpOiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgaW5jbHVkZSBFeGFtIFBJTlwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuaW5mbyhgY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3QgKG9jcik6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghc3R1ZGVudC5mb2N1cykgeyAvLyBBcmNoaXZpZXJlIFNjcmVlbnNob3QsIHdlbm4gU3R1ZGVudCBuaWNodCBmb2t1c3NpZXJ0IGlzdFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3Q6IFN0dWRlbnQgb3V0IG9mIGZvY3VzIC0gc2VjdXJpbmcgc2NyZWVuc2hvdHNcIik7XG4gICAgICAgICAgICAgICAgbGV0IHRpbWUgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3Vic3RyKDExLCA4KS5yZXBsYWNlKC86L2csIFwiX1wiKTtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCBcImZvY3VzbG9zdFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgYWJzb2x1dGVGaWxlbmFtZSA9IHBhdGguam9pbihmaWxlcGF0aCwgYCR7dGltZX0tJHtyZXEuYm9keS5zY3JlZW5zaG90ZmlsZW5hbWV9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzY3JlZW5zaG90QnVmZmVyID0gQnVmZmVyLmZyb20ocmVxLmJvZHkuc2NyZWVuc2hvdCwgJ2Jhc2U2NCcpOyAgICAvLyBLb252ZXJ0aWVyZW4gZGVzIEJhc2U2NC1TdHJpbmdzIGluIGVpbmVuIEJ1ZmZlciB1bmQgU3BlaWNoZXJuIGRlciBEYXRlaVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlbmFtZSwgc2NyZWVuc2hvdEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3Q6ICR7ZXJyfWAgKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy9sb2cud2FybignY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3Q6IFNjcmVlbnNob3Qgb3IgaGFzaCBub3QgcHJvdmlkZWQnKTtcbiAgICAgICAgc3R1ZGVudC5pbWFnZXVybCA9IFwicGVyc29uLWxpbmVzLWZpbGwuc3ZnXCJcbiAgICB9XG4gICAgcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5zdHVkZW50dXBkYXRlXCIpLCBzdGF0dXM6XCJzdWNjZXNzXCIgfSlcbn0pXG5cblxuLyoqXG4gKiBSZWNlaXZlIEFCR0FCRSAmIFBSSU5UUkVRVUVTVCBGcm9tIFN0dWRlbnRcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgYXQgd2hpY2ggdGhlIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZFxuICogQHBhcmFtIHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB0byBzZWFyY2ggYW5kIHVwZGF0ZSB0aGUgZW50cnkgaW4gdGhlIGxpc3RcbiAqL1xucm91dGVyLnBvc3QoJy9wcmludHJlcXVlc3QvOnNlcnZlcm5hbWUvOnN0dWRlbnR0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHBkZkRvY3VtZW50ID0gcmVxLmJvZHkuZG9jdW1lbnRcbiAgICBjb25zdCBwcmludHJlcXVlc3QgPSByZXEuYm9keS5wcmludHJlcXVlc3RcbiAgICBjb25zdCBzdWJtaXNzaW9ubnVtYmVyID0gcmVxLmJvZHkuc3VibWlzc2lvbm51bWJlclxuICAgIGNvbnN0IGxvY2tlZHNlY3Rpb24gPSByZXEuYm9keS5sb2NrZWRzZWN0aW9uIHx8IDEgLy8gZGVmYXVsdCB0byBzZWN0aW9uIDEgaWYgbm90IHByb3ZpZGVkXG5cblxuICAgIC8vY2hlY2sgaWYgc2VydmVyIGV4aXN0cyBcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICggIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGF2YWlsYWJsZVwiLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuXG4gICAgLy9jaGVjayBpZiBzdHVkZW50IGlzIHJlZ2lzdGVyZWQgb24gc2VydmVyXG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgIGlmICggIXN0dWRlbnQgKSB7cmV0dXJuIHJlcy5zZW5kKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwicmVtb3ZlZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KSB9XG4gICAgXG4gICAgaWYgKHByaW50cmVxdWVzdCl7ICAgXG4gICAgICAgIHN0dWRlbnQucHJpbnRyZXF1ZXN0ID0gcGRmRG9jdW1lbnQgIC8vIHdlIHB1dCB0aGUgYmFzZTY0IHN0cmluZyBvZiB0aGUgZG9jdW1lbnQgb24gcHJpbnRyZXF1ZXN0IHdoaWNoIGlzIGNoZWNrZWQgYnkgdGhlIGZyb250ZW5kIG9uIGV2ZXJ5IGZldGNoIGN5Y2xlXG4gICAgfVxuXG4gICAgLy8gdHJhY2sgc3R1ZGVudCBzdWJtaXNzaW9ucyBvbiB0aGUgc2VydmVyIGJlY2F1c2Ugb2YgcG9zc2libGUgcmVjb25uZWN0cyBhbmQgcmVzZXRzIG9uIHRoZSBzdHVkZW50IHNpZGVcbiAgICAvLyBpZiAoc3R1ZGVudC5zdWJtaXNzaW9ubnVtYmVyID09PSB1bmRlZmluZWQpe1xuICAgIC8vICAgICBzdHVkZW50LnN1Ym1pc3Npb25udW1iZXIgPSAxICAgIC8vIGZpcnN0IHN1Ym1pc3Npb25cbiAgICAvLyB9XG4gICAgLy8gZWxzZSB7XG4gICAgLy8gICAgIHN0dWRlbnQuc3VibWlzc2lvbm51bWJlciArPSAxXG4gICAgLy8gfVxuXG4gICAgbGV0IHNhZmVTdHVkZW50ID0gc3R1ZGVudC5jbGllbnRuYW1lLnJlcGxhY2UoL1xccysvZywgJ18nKSAgLy8gcmVwbGFjZSBzcGFjZXMgd2l0aCBcIl9cIlxuICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpXG4gIFxuICAgIGxldCB0aW1lc3RhbXAgPSBgJHtub3cuZ2V0RnVsbFllYXIoKX0ke1N0cmluZyhub3cuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCcwJyl9JHtTdHJpbmcobm93LmdldERhdGUoKSkucGFkU3RhcnQoMiwnMCcpfS0ke1N0cmluZyhub3cuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwnMCcpfSR7U3RyaW5nKG5vdy5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsJzAnKX0ke1N0cmluZyhub3cuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCcwJyl9YFxuICAgIGxldCBmaWxlbmFtZSA9IGAke3NlcnZlcm5hbWV9LSR7c2FmZVN0dWRlbnR9LSR7c3VibWlzc2lvbm51bWJlcn0tJHt0aW1lc3RhbXB9LnBkZmBcblxuXG4gICBcbiAgICBjb25zdCBwZGZCdWZmZXIgPSBCdWZmZXIuZnJvbShwZGZEb2N1bWVudCwgJ2Jhc2U2NCcpO1xuXG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWxlcGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsICdBQkdBQkUnLCBsb2NrZWRzZWN0aW9uLnRvU3RyaW5nKCkgKSAvLyB0YXJnZXQgZGlyXG4gICAgICAgIGF3YWl0IGZzcC5ta2RpcihmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGRpclxuICAgICAgICBjb25zdCBhYnNvbHV0ZUZpbGVuYW1lID0gcGF0aC5qb2luKGZpbGVwYXRoLCBmaWxlbmFtZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBidWlsZCBwYXRoXG4gICAgICAgIGF3YWl0IGZzcC53cml0ZUZpbGUoYWJzb2x1dGVGaWxlbmFtZSwgcGRmQnVmZmVyKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIG1haW5cbiAgICAgIFxuICAgICAgICBsb2cuaW5mbyhgY29udHJvbCBAIHByaW50cmVxdWVzdDogUmVjZWl2ZWQgYW5kIHN0b3JlZCBzdWJtaXNzaW9uIGZpbGUgZm9yIHVzZXI6ICR7c3R1ZGVudC5jbGllbnRuYW1lfWApXG4gICAgICAgIC8vIGNyZWF0ZSBiYWNrdXAgb2YgYWJnYWJlXG4gICAgICAgIGxldCBiYWNrdXBTdGF0dXMgPSAnc2tpcHBlZCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgYmFja3VwIHN0YXR1c1xuICAgICAgICBpZiAoY29uZmlnLmJhY2t1cGRpcmVjdG9yeSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBvcHRpb25hbCBiYWNrdXBcbiAgICAgICAgICBjb25zdCBiYWNrdXBwYXRoID0gcGF0aC5qb2luKGNvbmZpZy5iYWNrdXBkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCAnQUJHQUJFJywgbG9ja2Vkc2VjdGlvbi50b1N0cmluZygpIClcbiAgICAgICAgICBhd2FpdCBmc3AubWtkaXIoYmFja3VwcGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGJhY2t1cCBkaXJcbiAgICAgICAgICBjb25zdCBhYnNvbHV0ZUJhY2t1cEZpbGVuYW1lID0gcGF0aC5qb2luKGJhY2t1cHBhdGgsIGZpbGVuYW1lKSAgICAgICAgICAgICAgICAgICAgICAgLy8gYmFja3VwIHBhdGhcbiAgICAgICAgICBhd2FpdCBmc3Aud3JpdGVGaWxlKGFic29sdXRlQmFja3VwRmlsZW5hbWUsIHBkZkJ1ZmZlcikgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgYmFja3VwXG4gICAgICAgICAgYmFja3VwU3RhdHVzID0gJ29rJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJhY2t1cCBva1xuICAgICAgICB9XG4gICAgICBcbiAgICAgICAgcmVzLnNlbmQoeyBzZW5kZXI6ICdzZXJ2ZXInLCBtZXNzYWdlOiAnc3VjY2VzcycsIHN0YXR1czogJ3N1Y2Nlc3MnLCBiYWNrdXA6IGJhY2t1cFN0YXR1cyB9KSAvLyByZXNwb25kIHN1Y2Nlc3NcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCBwcmludHJlcXVlc3Q6ICR7ZXJyfWApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsb2cgZXJyb3JcbiAgICAgICAgbGV0IG1lc3NhZ2UgPSB0KFwiY29udHJvbC5zdWJtaXNzaW9uZmFpbGVkXCIpXG4gICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKHsgc2VuZGVyOiAnc2VydmVyJywgbWVzc2FnZTogbWVzc2FnZSwgc3RhdHVzOiAnZXJyb3InIH0pICAgLy8gcmVzcG9uZCBlcnJvclxuICAgICAgfVxuICAgIFxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IHJvdXRlclxuXG5cblxuLy9kbyBub3QgYWxsb3cgcmVxdWVzdHMgZnJvbSBleHRlcm5hbCBob3N0c1xuZnVuY3Rpb24gcmVxdWVzdFNvdXJjZUFsbG93ZWQocmVxLHJlcyl7XG4gICAgaWYgKHJlcS5pcCA9PSBcIjo6MVwiICB8fCByZXEuaXAgPT0gXCIxMjcuMC4wLjFcIiB8fCByZXEuaXAuaW5jbHVkZXMoJzEyNy4wLjAuMScpICl7IFxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9ICBcbiAgICBsb2cuZXJyb3IoYEJsb2NrZWQgcmVxdWVzdCBmcm9tIHJlbW90ZSBIb3N0OiAke3JlcS5pcH1gKTsgXG4gICAgcmVzLmpzb24oJ1JlcXVlc3QgZGVuaWVkJykgXG4gICAgcmV0dXJuIGZhbHNlIFxufVxuLy90aGlzIGlzIG5lZWRlZCBieSB0aGUgL29hdXRoIGFuZCAvbXNhdXRoIHJvdXRlcyBcbmZ1bmN0aW9uIGdlbmVyYXRlQ29kZVZlcmlmaWVyKCkge1xuICAgIHJldHVybiBjcnlwdG8ucmFuZG9tQnl0ZXMoMzIpLnRvU3RyaW5nKCdoZXgnKTtcbn1cbmZ1bmN0aW9uIHNoYTI1NihidWZmZXIpIHtcbiAgICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShidWZmZXIpLmRpZ2VzdCgpO1xufVxuZnVuY3Rpb24gYmFzZTY0VXJsRW5jb2RlKHN0cikge1xuICAgIHJldHVybiBzdHIudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgLnJlcGxhY2UoJysnLCAnLScpXG4gICAgLnJlcGxhY2UoJy8nLCAnXycpXG4gICAgLnJlcGxhY2UoLz0rJC8sICcnKTtcbn1cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlU29ja2V0IH0gZnJvbSAnZGdyYW0nXG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcydcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG5cbi8qKlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgYnJvYWRjYXN0cyBpbmZvcm1hdGlvbiBhYm91dCB0aGlzIHNlcnZlclxuICogb25lIG11bHRpY2FzdFNlcnZlciBpbnN0YW5jZSBmb3IgZXZlcnkgZXhhbSAoaG9sZHMgYWxsIHN0dWRlbnQgaW5mb3JtYXRpb24gYW5kIHNlcnZlcnN0YXR1cylcbiAqL1xuY2xhc3MgTXVsdGljYXN0U2VydmVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuU1JDX1BPUlQgPSAwICAvLyBpbiBvcmRlciB0byBhbGxvdyBzZXZlcmFsIG11bHRpY2FzdCBzZXJ2ZXJzIChtb3JlIGV4YW1zIG9uIHRoZSBzYW1lIG1hY2hpbmUpIHRoaXMgcG9ydCBuZWVkcyB0byBiZSBzZXQgZHluYW1pY2FsbHlcbiAgICAgICAgdGhpcy5DbGllbnRQT1JUID0gY29uZmlnLm11bHRpY2FzdENsaWVudFBvcnRcbiAgICAgICAgdGhpcy5NVUxUSUNBU1RfQUREUiA9IGNvbmZpZy5tdWx0aWNhc3RTZXJ2ZXJBZHJyXG4gICAgICAgIHRoaXMuc2VydmVyID0gbnVsbFxuICAgICAgICB0aGlzLnNlcnZlcmluZm8gPSBudWxsXG4gICAgICAgIHRoaXMuYnJvYWRjYXN0SW50ZXJ2YWwgPSBudWxsXG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlXG4gICAgICAgIHRoaXMuc3R1ZGVudExpc3QgPSBbXVxuICAgICAgICB0aGlzLnNlcnZlcnN0YXR1cyA9IHt9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0cyB1cCBhbiBpbnRlcnZhbGwgdG8gc2VuZCBzZXJ2ZXJpbmZvIGV2ZXJ5IDIgc2Vjb25kc1xuICAgICAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBnaXZlbiBuYW1lIG9mIHRoZSBzZXJ2ZXIgKGZvciBleGFtcGxlIFwibWF0aFwiKVxuICAgICAqIEBwYXJhbSBwaW4gdGhlIHBpbiBuZWVkZWQgdG8gcmVnaXN0ZXIgYXMgc3R1ZGVudFxuICAgICAqL1xuICAgIGluaXQgKHNlcnZlcm5hbWUsIHBpbiwgcGFzc3dvcmQsIGJpcD1mYWxzZSwgYmlwSWQ9bnVsbCkge1xuICAgICAgICB0aGlzLnNlcnZlciA9IGNyZWF0ZVNvY2tldCgndWRwNCcpXG4gICAgICAgIHRoaXMuc2VydmVyaW5mbyA9IHtcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IHNlcnZlcm5hbWUsICAgLy9zaG91bGQgYmUgdW5pcXVlIGlmIHNldmVyYWwgc2VydmVycyBhcmUgYWxsb3dlZFxuICAgICAgICAgICAgcGluOiBwaW4sXG4gICAgICAgICAgICBwYXNzd29yZDogcGFzc3dvcmQsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IDAsXG4gICAgICAgICAgICBpZDogYmlwSWQgPyBiaXBJZCA6IGNyeXB0by5yYW5kb21VVUlEKCksXG4gICAgICAgICAgICBpcDogY29uZmlnLmhvc3RpcCxcbiAgICAgICAgICAgIHNlcnZlcnRva2VuOiBgc2VydmVyLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gLFxuICAgICAgICAgICAgYmlwOiBiaXAsXG4gICAgICAgICAgICB2ZXJzaW9uOiBjb25maWcudmVyc2lvblxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLnNlcnZlci5iaW5kKHRoaXMuU1JDX1BPUlQsJzAuMC4wLjAnLCAgKCkgPT4geyAvLyBBZGQgdGhlIEhPU1RfSVBfQUREUkVTUyBmb3IgcmVsaWFiaWxpdHlcbiAgICAgICAgICAgIHRoaXMuc2VydmVyLnNldEJyb2FkY2FzdCh0cnVlKVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuc2V0TXVsdGljYXN0VFRMKDEyOClcbiAgICAgICAgICAgIHRoaXMuc2VydmVyLnNldFRUTCgxMjgpXG4gICAgICAgICAgICB0aGlzLnNlcnZlci5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpOyBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGZvciBkZXByZWNhdGVkIGluc3RhbmNlIGluIGEgbG9vcFxuICAgICAgICAgICAgdGhpcy5icm9hZGNhc3RJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuc2VuZE11bHRpY2FzdE1lc3NhZ2UuYmluZCh0aGlzKSwgMjAwMClcbiAgICAgICAgICAgIHRoaXMuYnJvYWRjYXN0SW50ZXJ2YWwuc3RhcnQoKVxuXG5cbiAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RzZXJ2ZXIgQCBpbml0OiBVRFAgTUMgU2VydmVyIGxpc3RlbmluZyBvbiBodHRwOi8vJHtjb25maWcuaG9zdGlwfToke3RoaXMuc2VydmVyLmFkZHJlc3MoKS5wb3J0fWApXG4gICAgICAgIH0pXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGVzIHRoZSBzZXJ2ZXIgdGltZXN0YW1wIGFuZCBhY3R1YWxseSBicm9hZGNhc3RzIHRoZSBtZXNzYWdlIChzZXJ2ZXJpbmZvKVxuICAgICAqL1xuICAgIHNlbmRNdWx0aWNhc3RNZXNzYWdlICgpIHtcbiAgICAgICAgdGhpcy5zZXJ2ZXJpbmZvLnRpbWVzdGFtcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgIGxldCBtZXNzYWdlID0ge1xuICAgICAgICAgICAgc2VydmVybmFtZTogdGhpcy5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IHRoaXMuc2VydmVyaW5mby50aW1lc3RhbXAsXG4gICAgICAgICAgICBpZDogdGhpcy5zZXJ2ZXJpbmZvLmlkLFxuICAgICAgICAgICAgaXA6IHRoaXMuc2VydmVyaW5mby5pcCxcbiAgICAgICAgICAgIGJpcDogdGhpcy5zZXJ2ZXJpbmZvLmJpcCxcbiAgICAgICAgICAgIHZlcnNpb246IGNvbmZpZy52ZXJzaW9uXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcHJlcGFyZWRNZXNzYWdlID0gbmV3IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKVxuICAgICAgICB0aGlzLnNlcnZlci5zZW5kKHByZXBhcmVkTWVzc2FnZSwgMCwgcHJlcGFyZWRNZXNzYWdlLmxlbmd0aCwgdGhpcy5DbGllbnRQT1JULCB0aGlzLk1VTFRJQ0FTVF9BRERSKSAgLy9icm9hZGNhc3QgdG8gY2xpZW50c1xuICAgICAgICB0aGlzLnNlcnZlci5zZW5kKHByZXBhcmVkTWVzc2FnZSwgMCwgcHJlcGFyZWRNZXNzYWdlLmxlbmd0aCwgY29uZmlnLm11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQsIHRoaXMuTVVMVElDQVNUX0FERFIpICAgICAgICAvL2Jyb2FkY2FzdCB0byBvdGhlciBzZXJ2ZXIoY2xpZW50cykgLSBzZXJ2ZXJzIGFsc28gd2FudCB0byBrbm93IHdoYXQgb3RoZXIgc2VydmVycyBhcmUgaW4gdGhlIG5ldHdvcmtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11bHRpY2FzdFNlcnZlclxuIiwgImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5cbmV4cG9ydCBjbGFzcyBTY2hlZHVsZXJTZXJ2aWNlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgIGFjdGlvbjogKCkgPT4gdm9pZDtcbiAgICBoYW5kbGU6IE5vZGVKUy5UaW1lcjtcbiAgICBpbnRlcnZhbDogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYWN0aW9uOiAoKSA9PiB2b2lkLCBtczogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuYWN0aW9uID0gYWN0aW9uO1xuICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5pbnRlcnZhbCA9IG1zO1xuICAgICAgICB0aGlzLmFkZExpc3RlbmVyKCd0aW1lb3V0JywgdGhpcy5hY3Rpb24pO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGFydCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLmVtaXQoJ3RpbWVvdXQnKSwgdGhpcy5pbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaGFuZGxlKTtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufSIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnOyAgLy8gbm9kZSBub3QgdnVlIChyZWxhdGl2ZSBwYXRoIG5lZWRlZClcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG5cbi8qKlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgbGlzdGVucyBmb3IgbXVsaXRjYXN0IG1lc3NhZ2VzXG4gKi9cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gJzIzOS4yNTUuMjU1LjI1MCdcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc0ludGVydmFsbCA9IG51bGxcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYnkgdGltZXN0YW1wXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudCA9IGRncmFtLmNyZWF0ZVNvY2tldCgndWRwNCcpXG4gICAgICAgICAgICB0aGlzLmNsaWVudC5iaW5kKHRoaXMuUE9SVCwgJzAuMC4wLjAnLCAoKSA9PiB7IFxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50LnNldEJyb2FkY2FzdCh0cnVlKVxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50LnNldE11bHRpY2FzdFRUTCgxMjgpOyBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5nYXRld2F5KSB7IHRoaXMuY2xpZW50LmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUikgfVxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBObyBHYXRld2F5ISBTdGFydGluZyBNdWx0aWNhc3RDbGllbnQgd2l0aG91dCBhZGRpbmcgZ3JvdXAgbWVtYmVyc2hpcFwiKX1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLmNsaWVudC5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKXtsb2cuZXJyb3IoZXJyKX1cblxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcblxuICAgICAgICAvL2NoZWNrIGZvciBkZXByZWNhdGVkIGluc3RhbmNlIGluIGEgbG9vcFxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuaXNEZXByZWNhdGVkSW5zdGFuY2UuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIuc3RhcnQoKVxuXG5cbiAgICB9XG5cbiAgICBhc3luYyBzdG9wICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmRyb3BNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpIC8vIGVudGZlcm50IE11bHRpY2FzdC1NaXRnbGllZHNjaGFmdFxuICAgICAgICB9IGNhdGNoKGUpe31cbiAgICAgICAgdGhpcy5jbGllbnQuY2xvc2UoKSAvLyBzY2hsaWVcdTAwREZ0IGRlbiBVRFAtU29ja2V0XG4gICAgICAgIGlmICh0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlcikgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIuc3RvcCgpIC8vIHN0b3BwdCBkZW4gU2NoZWR1bGVyXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vcmVjb3JkIHRpbWVzdGFtcCBvZiBsYXN0IG1lc3NhZ2UgZnJvbSBzZXJ2ZXJcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmlzTmV3RXhhbUluc3RhbmNlKHNlcnZlckluZm8pKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgbWVzc2FnZVJlY2VpdmVkOiBBZGRpbmcgbmV3IEV4YW0gSW5zdGFuY2UgXCIke3NlcnZlckluZm8uc2VydmVybmFtZX1cIiB0byBTZXJ2ZXJsaXN0YClcbiAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QucHVzaChzZXJ2ZXJJbmZvKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHRoZSBtZXNzYWdlIGNhbWUgZnJvbSBhIG5ldyBleGFtIGluc3RhbmNlIG9yIGFuIG9sZCBvbmUgdGhhdCBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBpc05ld0V4YW1JbnN0YW5jZSAob2JqKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbVNlcnZlckxpc3RbaV0uaWQgPT09IG9iai5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICAgICAgaWYgKG5vdyAtIDE2MDAwID4gdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXApIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgbXVsdGljYXN0Y2xpZW50IEAgaXNEZXByZWNhdGVkSW5zdGFuY2U6IFJlbW92aW5nIGluYWN0aXZlIHNlcnZlciAnJHt0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnNlcnZlcm5hbWV9JyBmcm9tIGxpc3RgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3Quc3BsaWNlKGksIDEpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBNdWx0aWNhc3RDbGllbnQoKVxuIiwgIlxuaW1wb3J0IHsgY3JlYXRlSTE4biB9IGZyb20gJ3Z1ZS1pMThuJ1xuLy9pbXBvcnQgeyBjcmVhdGVJMThuIH0gZnJvbSAndnVlLWkxOG4nXG5cbmltcG9ydCBlbiBmcm9tICcuL2VuLmpzb24nXG5pbXBvcnQgZGUgZnJvbSAnLi9kZS5qc29uJ1xuXG5jb25zdCBpMThuID0gY3JlYXRlSTE4bih7XG4gICAgbG9jYWxlOiAnZGUnLFxuICAgIGZhbGxiYWNrTG9jYWxlOiAnZW4nLFxuICAgIGxlZ2FjeTogZmFsc2UsXG4gICAgbWVzc2FnZXM6IHtcbiAgICAgIGVuLFxuICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4blxuXG5cblxuXG4iLCAieyBcbiAgICBcImdlbmVyYWxcIjoge1xuICAgICAgICBcInN0YXJ0c2VydmVyXCI6XCJTdGFydCBFeGFtXCIsXG4gICAgICAgIFwic2xpc3RcIjogXCJBa3RpdmUgRXhhbXNcIixcbiAgICAgICAgXCJva1wiOiBcIk9LXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIk5vIE5ldHdvcmsgQ29ubmVjdGlvblwiXG4gICAgfSxcbiAgICBcInNlcnZlcmxpc3RcIiA6IHtcbiAgICAgICAgXCJwd2RcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwibG9naW5cIjogXCJsb2dpblwiLFxuICAgICAgICBcIm5vcHdcIjogXCJQbGVhc2UgcHJvdmlkZSBhIHBhc3N3b3JkXCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwic3RhcnRzZXJ2ZXJcIiA6IHtcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJjb25uZWN0ZWRcIixcbiAgICAgICAgXCJzdGFydFwiOiBcIlN0YXJ0IEV4YW1cIixcbiAgICAgICAgXCJyZXN1bWVcIjogXCJSZXN1bWUgRXhhbVwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwiZW1wdHlwd1wiOiBcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgcGFzc3dvcmRcIixcbiAgICAgICAgXCJlbXB0eW5hbWVcIjogXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIHVzZXJuYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIndvcmtmb2xkZXJcIjogXCJXb3JrZGlyZWN0b3J5XCIsXG4gICAgICAgIFwic2VsZWN0XCI6IFwiU2VsZWN0IFdvcmtkaXJlY3RvcnlcIixcbiAgICAgICAgXCJmcmVlc3BhY2V3YXJuaW5nXCIgOiBcIk5vdCBlbm91Z2ggZnJlZSBkaXNjc3BhY2VcIixcbiAgICAgICAgXCJkaXJlY3RvcnllcnJvclwiOiBcIkRpcmVjdG9yeSBub3Qgd3JpdGVhYmxlXCIsXG4gICAgICAgIFwicHJldmlvdXNleGFtc1wiOiBcIkxvY2FsIHByZXZpb3VzIEV4YW1zXCIsXG4gICAgICAgIFwiZm9sZGVyZGVsZXRlXCI6IFwiRGVsZXRlIGxvY2FsIGV4YW0gZm9sZGVyP1wiLFxuICAgICAgICBcIm9ubGluZWV4YW1zXCI6IFwiQmlQIEV4YW1zXCIsXG4gICAgICAgIFwiYmlwbm90bG9nZ2VkaW5cIjogXCJQbGVhc2UgbG9nIGluIHRvIEJpUCBiZWZvcmUgc3RhcnRpbmcgdGhlIGV4YW1cIixcbiAgICAgICAgXCJub05ld3NcIjpcIk5vIE5ld3MgYXZhaWxhYmxlXCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyXCI6IFwiQmFja3VwLURpcmVjdG9yeVwiLFxuICAgICAgICBcImJhY2t1cGZvbGRlcmluZm9cIjogXCJQbGVhc2UgcHJvdmlkZSBhIHBhdGggZm9yIHRoZSBiYWNrdXAgZGlyZWN0b3J5XCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc1wiOiBcIkV4dGVuZGVkIFNldHRpbmdzXCIsXG4gICAgICAgIFwiaW5jb21wYXRpYmxlXCI6IFwiSW5jb21wYXRpYmxlIHdpdGggY3VycmVudCB2ZXJzaW9uXCIsXG4gICAgICAgIFwic2VsZWN0aW50ZXJmYWNlXCI6IFwiU2VsZWN0IE5ldHdvcmsgSW50ZXJmYWNlXCIsXG4gICAgICAgIFwic2VsZWN0aW50ZXJmYWNlaW5mb1wiOiBcIlBsZWFzZSBzZWxlY3QgYSBwcmVmZXJyZWQgbmV0d29yayBpbnRlcmZhY2UhXCJcbiAgICB9LFxuICAgIFwiZGFzaGJvYXJkXCI6e1xuICAgICAgICBcInJlbW92ZVVSTFwiOiBcIlJlbW92ZSBVUkxcIixcbiAgICAgICAgXCJyZW1vdmVVUkxjb25maXJtXCI6IFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHJlbW92ZSB0aGlzIFVSTD9cIixcbiAgICAgICAgXCJyZW1vdGVhc3Npc3RhbnRcIjogXCJSZW1vdGUgQXNzaXN0YW50XCIsXG4gICAgICAgIFwic2VydmVyXCI6IFwiU2VydmVyXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5cIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJjb25uZWN0ZWRcIixcbiAgICAgICAgXCJzdG9wc2VydmVyXCI6IFwiU3RvcCBFeGFtXCIsXG4gICAgICAgIFwiZmlsZXNlbmRcIjogXCJTZW5kIEZpbGVzXCIsXG4gICAgICAgIFwiZmlsZXNlbmR0ZXh0XCI6IFwiUGxlYXNlIGNob29zZSBvbmUgb3Igc2V2ZXJhbCBGaWxlc1wiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kXCI6IFwiVXBsb2FkIEZpbGVcIixcbiAgICAgICAgXCJvZmZpY2VmaWxlc2VuZHRleHRcIjogXCJQbGVhc2UgY2hvb3NlIGFuIHhsc3ggb3IgZG9jeCBGaWxlIGZvciB0aGUgRXhhbVwiLFxuICAgICAgICBcImNhbmNlbFwiOiBcIkNhbmNlbFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJObyBGaWxlcyBzZWxlY3RlZFwiLFxuICAgICAgICBcInVwbG9hZGZpbGVzXCI6IFwidXBsb2FkaW5nIGZpbGVzXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiRmlsZXMgc2VudFwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIk5vIHN0dWRlbnRzIGNvbm5lY3RlZFwiLFxuICAgICAgICBcImxhbmdcIjogXCJMYW5ndWFnZVwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzXCI6IFwiQWN0aXZlIFNoZWV0c1wiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c2hpbnRcIjogXCJQbGVhc2Ugc2VsZWN0IGEgUERGIGZpbGUgdGhhdCBjb250YWlucyBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcy5cIixcbiAgICAgICAgXCJhY2NlcHRQZGZcIjogXCJBY2NlcHQgUERGIEZpbGVcIixcbiAgICAgICAgXCJzZWxlY3RPdGhlclBkZlwiOiBcIlNlbGVjdCBvdGhlciBQREYgZmlsZVwiLFxuICAgICAgICBcIm5vcGRmc2VsZWN0ZWRcIjogXCJQbGVhc2Ugc2VsZWN0IGEgUERGIGZpbGUhXCIsXG4gICAgICAgIFwiaW52YWxpZHBkZlwiOiBcIkludmFsaWQgUERGIGZpbGUhXCIsXG4gICAgICAgIFwicGRmcHJvY2Vzc2luZ2Vycm9yXCI6IFwiRXJyb3IgcHJvY2Vzc2luZyBQREYgZmlsZS5cIixcbiAgICAgICAgXCJlZHV2aWR1YWxcIjogXCJFZHV2aWR1YWxcIixcbiAgICAgICAgXCJ3ZWJzaXRlXCI6IFwiV2Vic2l0ZSBVUkxcIixcbiAgICAgICAgXCJhdXRvZ2V0XCI6IFwiQmFja3VwIGludGVydmFsXCIsXG4gICAgICAgIFwic3RhcnRleGFtXCI6IFwiU2VjdXJlIGRldmljZXNcIixcbiAgICAgICAgXCJzdGFydGV4YW1zaW5nbGVcIjogXCJTZWN1cmUgZGV2aWNlXCIsXG4gICAgICAgIFwic3RhcnRleGFtZGVzY1wiOiBcIlRoaXMgc3RhcnRzIHRoZSBFeGFtIE1vZGUgZm9yIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcInNlbmRmaWxlXCI6IFwiU2VuZCBGaWxlcyB0byBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJzZW5kZmlsZVNpbmdsZVwiOiBcIlNlbmQgRmlsZXNcIixcbiAgICAgICAgXCJnZXRmaWxlXCI6IFwiRmV0Y2ggV29yayBvZiBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJnZXRmaWxlU2luZ2xlXCI6IFwiRmV0Y2ggV29ya1wiLFxuICAgICAgICBcImdldGZpbGVzXCI6IFwiRmV0Y2ggV29ya1wiLFxuICAgICAgICBcInN0b3BleGFtXCI6IFwiUmVsZWFzZSBkZXZpY2VzXCIsXG4gICAgICAgIFwic3RvcGV4YW1zaW5nbGVcIjogXCJSZWxlYXNlIGRldmljZVwiLFxuICAgICAgICBcInN1cmVcIjogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1zdXJlXCI6IFwiQ2xvc2UgRXhhbSBTZXJ2ZXI/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1cIjogXCJUaGlzIGtpbGxzIHRoZSBjb25uZWN0aW9uIHRvIGFsbCBzdHVkZW50cyBcXG5EaWQgeW91IGJhY2t1cCBldmVyeXRoaW5nP1wiLFxuICAgICAgICBcImV4aXRleGFtaW5mb1wiOiBcImFsbCBhY3RpdmUgY29ubmVjdGlvbnMgd2lsbCBiZSBjbG9zZWRcIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJleGl0IHNhZmUgZXhhbSBtb2RlLiB0aGlzIGNsb3NlcyB0aGUgZXhhbSB3aW5kb3cgZm9yIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcImV4aXRraW9za3Nob3J0XCI6IFwiRXhpdCBFeGFtIFNlcnZlclwiLFxuICAgICAgICBcInJlYWxseWtpY2tcIjogXCJyZW1vdmUgc3R1ZGVudCBmcm9tIHNlcnZlclwiLFxuICAgICAgICBcImtpY2tcIjogXCJyZW1vdmVcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJzYWZlbW9kZSBsZWZ0XCIsXG4gICAgICAgIFwib25saW5lXCI6XCJkZXRhaWxzXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOlwib2ZmbGluZVwiLFxuICAgICAgICBcInNlY3VyZVwiOlwic2VjdXJlZFwiLFxuICAgICAgICBcInNlY3VyZWluZm9cIjpcInN0dWRlbnQgaXMgc2VjdXJlZFwiLFxuICAgICAgICBcInJlc3RvcmVcIjpcInJlc3RvcmVcIixcbiAgICAgICAgXCJyZXN1bWVpbmZvXCI6XCJyZXN1bWUgZm9jdXMgc3RhdGVcIixcbiAgICAgICAgXCJleGFtbW9kZWFjdGl2ZVwiOiBcInN0dWRlbnQgYWxyZWFkeSBpbiBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImNsb3NlXCI6XCJjbG9zZVwiLFxuICAgICAgICBcImRlbFwiOiBcImNsZWFuIHdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJkZWxzdXJlXCI6IFwiRGVsZXRlIGFsbCBjb250ZW50cyBvZiB0aGUgc3R1ZGVudHMgd29ya2ZvbGRlcnNcIixcbiAgICAgICAgXCJkZWxzaW5nbGVcIjogXCJjbGVhbiByZW1vdGUgd29ya2ZvbGRlclwiLFxuICAgICAgICBcImRlbHNpbmdsZXN1cmVcIjogXCJEZWxldGUgY29udGVudHMgb2YgdGhlIHN0dWRlbnRzIHdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJhdHRlbnRpb25cIjogXCJBdHRlbnRpb24hXCIsXG4gICAgICAgIFwiYmFja3VwcmVxdWVzdFwiOiBcIlJlcXVlc3RpbmcgZmlsZXMgZnJvbSBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJzaG93d29ya2ZvbGRlclwiOiBcIlNob3cgV29ya2ZvbGRlclwiLFxuICAgICAgICBcIndvcmtmb2xkZXJcIjogXCJTaG93IFdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJzaG93bmV3ZXN0Zm9sZGVyXCI6IFwiU2hvdyBuZXdlc3QgV29ya2ZvbGRlclwiLFxuICAgICAgICBcImZpbGVzZm9sZGVyXCI6IFwiV29ya2ZvbGRlciBmaWxlc1wiLFxuICAgICAgICBcImNob29zZXN0dWRlbnRcIjogXCJTZWxlY3QgU3R1ZGVudFwiLFxuICAgICAgICBcImNob29zZXJlcXVpcmVcIjogXCJZb3UgbmVlZCB0byBjaG9vc2UgYSBzdHVkZW50IVwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiU3R1ZGVudHMgd29yayBub3QgZm91bmRcIixcbiAgICAgICAgXCJzdW1tYXJpemVwZGZcIjogXCJEb3dubG9hZCBuZXdlc3QgdmVyc2lvbnMgXFxuYXMgc2luZ2xlIHBkZlwiLFxuICAgICAgICBcInN1bW1hcml6ZXBkZnNob3J0XCI6IFwiQWxsIEV4YW1zIGFzIFBERlwiLFxuICAgICAgICBcInByaW50cmVxdWVzdFwiOiBcInByaW50cmVxdWVzdCByZWNlaXZlZFwiLFxuICAgICAgICBcInByaW50cmVxdWVzdHNob3dcIjogXCJEbyB5b3Ugd2FudCB0byBvcGVuIHRoZSBkb2N1bWVudCBhbmQgcHJpbnQgaXQ/XCIsXG4gICAgICAgIFwiZG93bmxvYWRcIjogXCJkb3dubG9hZFwiLFxuICAgICAgICBcInByaW50XCI6IFwicHJpbnRcIixcbiAgICAgICAgXCJwcmV2aWV3XCI6IFwicHJldmlld1wiLFxuICAgICAgICBcInNlbmRcIjogXCJzZW5kXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjpcImFjdGl2YXRlXCIsXG4gICAgICAgIFwiQWN0aXZhdGVcIjpcIkFjdGl2YXRlXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRcIjogXCJ2aXJ0dWFsIGVudmlyb25tZW50IGRldGVjdGVkXCIsXG4gICAgICAgIFwiZGVsZXRlXCI6IFwiZGVsZXRlXCIsXG4gICAgICAgIFwiZmlsZWRlbGV0ZVwiOiBcIkRvIHlvdSByZWFsbHkgd2FudCB0byBkZWxldGUgdGhpcyBmaWxlL2ZvbGRlcj9cIixcbiAgICAgICAgXCJjYW5ub3REZWxldGVBY3RpdmVTaGVldFwiOiBcIkFjdGl2ZSBTaGVldCBjYW5ub3QgYmUgZGVsZXRlZCBkdXJpbmcgZXhhbVwiLFxuICAgICAgICBcImV4aXRkZWxldGVcIjogXCJEZWxldGUgYWxsIGV4YW0tcmVsYXRlZCBmaWxlcyBvbiBzdHVkZW50cyBkZXZpY2VzXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrYWN0aXZhdGVcIjogXCJhY3RpdmF0ZSBzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIlBsZWFzZSBjaG9vc2UgYSBsYW5ndWFnZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJjdXN0b21ob3N0XCI6IFwiQ3VzdG9tIExUIEhvc3RcIixcbiAgICAgICAgXCJsYW5ndWFnZXRvb2xob3N0XCI6IFwiTGFuZ3VhZ2VUb29sIEhvc3RcIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcImNtYXJnaW5cIjogXCJDb3JyZWN0aW9uIE1hcmdpbiBQb3NpdGlvblwiLFxuICAgICAgICBcImNtYXJnaW4tbGVmdFwiOiBcImxlZnRcIixcbiAgICAgICAgXCJjbWFyZ2luLXJpZ2h0XCI6IFwicmlnaHRcIixcbiAgICAgICAgXCJjbWFyZ2luLXZhbHVlXCI6IFwiQ29ycmVjdGlvbiBNYXJnaW4gc2l6ZSAoY20pXCIsXG4gICAgICAgIFwidGV4dGVkaXRvclwiOiBcIlRleHRlZGl0b3IgU2V0dGluZ3NcIixcbiAgICAgICAgXCJkZVwiOiBcIkdlcm1hblwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJlbmNoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpYW5cIixcbiAgICAgICAgXCJzbFwiOlwiU2xvdmVuaWFuXCIsXG4gICAgICAgIFwiYmFja3VwYXV0b1wiOlwiQXV0b21hdGljIFJldHJlaXZhbFwiLFxuICAgICAgICBcImJhY2t1cGF1dG9xdWVzdGlvblwiOlwiUGxlYXNlIHNldCB0aGUgaW50ZXJ2YWwgZm9yIGF1dG9tYXRpYyByZXRyZWl2YWw/XCIsXG4gICAgICAgIFwiYmFja3VwYXV0b2hpbnRcIjpcIihUaW1lZnJhbWUgaW4gbWludXRlcylcIixcbiAgICAgICAgXCJlZHV2aWR1YWxpZFwiOiBcIkVkdXZpZHVhbCAvIE1vb2RsZVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkaGludFwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIHRlc3QgVVJMIVwiLFxuICAgICAgICBcImdmb3Jtc2hpbnRcIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCBHb29nbGUgRm9ybXMgSUQhXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsZG9tYWluXCI6IFwiUGxlYXNlIHByb3ZpZGUgeW91ciBtb29kbGUgZG9tYWluIGlmIGl0J3Mgbm90IGVkdXZpZHVhbC5hdFwiLFxuICAgICAgICBcIm1vb2RsZUludmFsaWREb21haW5cIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCBNb29kbGUgZG9tYWluIVwiLFxuICAgICAgICBcImludmFsaWREb21haW5cIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCBkb21haW4hXCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZElkXCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgdGVzdCBJRCFcIixcbiAgICAgICAgXCJsb2NrXCI6XCJsb2NrIGRpc3BsYXlzXCIsXG4gICAgICAgIFwidW5sb2NrXCI6XCJ1bmxvY2sgZGlzcGxheXNcIixcbiAgICAgICAgXCJmcmVlc3BhY2V3YXJuaW5nXCIgOiBcIlJ1bm5pbmcgb3V0IG9mIGZyZWUgZGlzY3NwYWNlISFcIixcbiAgICAgICAgXCJpbnZhbGlkX2ZpbGVcIiA6IFwiV3JvbmcgRmlsZXR5cGVcIixcbiAgICAgICAgXCJpbnZhbGlkX2ZpbGVfdGV4dFwiOiBcIk9ubHkgRmlsZXMgd2l0aCB0aGUgLnhsc3ggb3IgLmRvY3ggZXh0ZW5zaW9uIGFyZSBhbGxvd2VkXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiUmVwbGFjZSBleGlzdGluZyBGaWxlcyBvbiBPbmVEcml2ZT9cIixcbiAgICAgICAgXCJleGFtcmVxdWVzdFwiOlwiRXhhbSByZXF1ZXN0ZWRcIixcbiAgICAgICAgXCJzY3JlZW5zaG90XCI6XCJTY3JlZW5zaG90dXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHRpdGxlXCI6XCJTY3JlZW5zaG90IFVwZGF0ZVwiLFxuICAgICAgICBcInNjcmVlbnNob3RxdWVzdGlvblwiOlwiU2V0IHRoZSBpbnRlcnZhbCB0byB1cGRhdGUgU2NyZWVuc2hvdHNcIixcbiAgICAgICAgXCJzY3JlZW5zaG90aGludFwiOlwiKFRpbWUgaW4gc2Vjb25kcy4gMCA9PSBkZWFrdGl2YXRlZClcIixcbiAgICAgICAgXCJvbGRwZGZ3YXJuaW5nXCI6XCJTb21lIG9mIHRoZSBmaWxlcyBhcmUgb2xkZXIgdGhhbiA1IG1pbnV0ZXMhXCIsXG4gICAgICAgIFwib2xkcGRmd2FybmluZ3NpbmdsZVwiOlwiVGhlIGxvY2FsIHZlcnNpb24gb2YgdGhlIGZpbGUgbWF5IGJlIG91dGRhdGVkIVwiLFxuICAgICAgICBcImdmb3Jtc1wiOiBcIkdvb2dsZSBGb3Jtc1wiLFxuICAgICAgICBcImFjY2Vzc0RlbmllZFwiOlwiQWNjZXNzIERlbmllZCFcIixcbiAgICAgICAgXCJhY2Nlc3NEZW5pZWR0ZXh0XCI6XCJDb250YWN0IHlvdXIgb3JnYW5pemF0aW9ucyBBZG1pbmlzdHJhdG9yIHRvIGdyYW50IEFjY2VzcyB0byBOZXh0LUV4YW1cIixcbiAgICAgICAgXCJtc29XYXJuXCI6IFwiWW91IG5lZWQgdG8gcmVjb25uZWN0IGFuZCBzZWxlY3QgYW4gTVNPRmlsZSBiZWZvcmUgcmVjb25uZWN0aW5nIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcImFsbG93c3BlbGxjaGVja1wiOlwiQWN0aXZhdGUgc3BlbGxjaGVjayBmb3Igc3BlY2lmaWMgc3R1ZGVudFwiLFxuICAgICAgICBcImxpbmVzcGFjaW5nXCI6IFwiTGluZXNwYWNpbmdcIixcbiAgICAgICAgXCJmb250ZmFtaWx5XCI6IFwiRm9udGZhbWlseVwiLFxuICAgICAgICBcImRlZmF1bHRwcmludGVyXCI6IFwiU2VsZWN0IGRlZmF1bHQgcHJpbnRlclwiLFxuICAgICAgICBcImFsbG93ZGlyZWN0cHJpbnRcIjogXCJBbGxvdyBkaXJlY3QgcHJpbnQgZm9yIHN0dWRlbnRzXCIsXG4gICAgICAgIFwibm9wcmludGVyXCI6IFwiTm8gcHJpbnRlciBmb3VuZFwiLFxuICAgICAgICBcImRpcmVjdHByaW50XCI6IFwiRGlyZWN0IHByaW50XCIsXG4gICAgICAgIFwib3BlblwiOiBcIk9wZW4gZmlsZSBpbiBleHRlcm5hbCB2aWV3ZXJcIixcbiAgICAgICAgXCJvY3JcIjogXCJBY3RpdmF0ZSBPQ1Igc2FmdGV5IGZlYXR1cmVcIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdHRpdGxlXCI6IFwiQXVkaW8gcmVzdHJpY3Rpb25zXCIsXG4gICAgICAgIFwiYXVkaW9hbGxvd1wiOiBcIm5vIHJlc3RyaWN0aW9uc1wiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MVwiOiBcInJlcGV0aXRpb25cIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdDJcIjogXCJyZXBldGl0aW9uc1wiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6IFwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbGFjdGl2YXRlXCI6IFwiQWN0aXZhdGUgQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbHNldHRpbmdzXCI6IFwiRXh0ZW5kZWQgU2V0dGluZ3MgZm9yIEJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwiZ3JvdXBzXCI6XCJBY3RpdmF0ZSBncm91cHNcIixcbiAgICAgICAgXCJncm91cGluZm9cIjogXCJEaXZpZGUgc3R1ZGVudHMgaW4gdHdvIGdyb3Vwc1wiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NcIjogXCJFeHRlbmRlZCBTZXR0aW5nc1wiLFxuICAgICAgICBcInNhdmVcIjogXCJzYXZlXCIsXG4gICAgICAgIFwiZGlzYWJsZWRcIjogXCJkaXNhYmxlZFwiLFxuICAgICAgICBcIm9jcmluZm9cIjpcIlNlYXJjaCBmb3IgY3VycmVudCBleGFtIHBpbiBpbiBzY3JlZW5zaG90c1wiLFxuICAgICAgICBcImJpcGluZm9cIjogXCJCaVAtU3RhdHVzIGRlZmluZXMgaWYgYXV0aGVudGljYXRlZCBjbGllbnRzIGNhbiBjb25uZWN0XCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6IFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGxvZyBvdXQ/XCIsXG4gICAgICAgIFwiYWN0aXZhdGVzZWN0aW9uc1wiOiBcIkFjdGl2YXRlIGV4YW0gc2VjdGlvbnNcIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNcIjogXCJleGFtIHNlY3Rpb25zXCIsXG4gICAgICAgIFwiZXhhbXNlY3Rpb25zaW5mb1wiOiBcIllvdSBhcmUgaW4gc2VjdXJlZCBtb2RlLiBEbyB5b3Ugd2FudCB0byBhY3RpdmF0ZSB0aGlzIGV4YW0gc2VjdGlvbiBmb3IgYWxsIGNvbm5lY3RlZCBjbGllbnRzP1wiLFxuICAgICAgICBcIm5vXCI6XCJOb1wiLFxuICAgICAgICBcInllc1wiOlwiWWVzXCIsXG4gICAgICAgIFwiZXhhbW1vZGVcIjpcIkV4YW0tTW9kZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOlwiTWF0ZXJpYWxzXCIsXG4gICAgICAgIFwiZGVmaW5lbWF0ZXJpYWxzXCI6XCJEZWZpbmUgTWF0ZXJpYWxzXCIsXG4gICAgICAgIFwicHJvY2Vzc2luZ2ZpbGVzXCI6XCJQcm9jZXNzaW5nIEZpbGVzXCIsXG4gICAgICAgIFwiZm9udHNpemV0aXRsZVwiOiBcIkZvbnRzaXplXCIsXG4gICAgICAgIFwiZm9udHNpemVcIjogXCJGb250c2l6ZVwiLFxuICAgICAgICBcInJlbW92ZWZpbGVcIjogXCJEZWxldGUgRmlsZVwiLFxuICAgICAgICBcInJlbW92ZWZpbGVjb25maXJtXCI6IFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGlzIGZpbGU/XCIsXG4gICAgICAgIFwic2VjdGlvbm5hbWVcIjogXCJTZWN0aW9uIE5hbWVcIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZWluZm9cIjogXCJQbGVhc2UgZW50ZXIgYSBuYW1lIGZvciB0aGlzIHNlY3Rpb25cIixcbiAgICAgICAgXCJncm91cEFcIjogXCJHcm91cCBBXCIsXG4gICAgICAgIFwiZ3JvdXBCXCI6IFwiR3JvdXAgQlwiLFxuICAgICAgICBcImFsbG93ZWRVUkxcIjogXCJBbGxvd2VkIFVSTFwiLFxuICAgICAgICBcImFsbG93ZWRVUkxpbmZvXCI6IFwiUGxlYXNlIGVudGVyIGEgVVJMIHRoYXQgaXMgYWxsb3dlZCBkdXJpbmcgdGhlIGV4YW1cIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzX21vZGVcIjogXCJFeHRlbmRlZCBTZXR0aW5ncyBmb3IgRXhhbS1Nb2RlXCIsXG4gICAgICAgIFwicmRwXCI6IFwiV2ViIFJEUFwiLFxuICAgICAgICBcInJkcGNvbmZpZ1wiOiBcIlJEUCBDb25maWd1cmF0aW9uXCIsXG4gICAgICAgIFwicmRwY29uZmlnaW5mb1wiOiBcIlBsZWFzZSBlbnRlciB0aGUgZG9tYWluIChVUkwpIG9mIHRoZSBSRFAtU2VydmVyXCIsXG4gICAgICAgIFwibXV0ZWF1ZGlvXCI6IFwiTXV0ZSBhdWRpb1wiLFxuICAgICAgICBcIm11dGVhdWRpb2ludHJvXCI6IFwiSWYgdGhpcyBvcHRpb24gaXMgYWN0aXZhdGVkLCBhdWRpbyBzaWduYWxzIGR1cmluZyB0aGUgZXhhbSB3aWxsIG5vdCBiZSBwbGF5ZWRcIixcbiAgICAgICAgXCJzaG93c3VibWlzc2lvblwiOiBcIlNob3cgc3VibWlzc2lvblwiLFxuICAgICAgICBcInN0dWRlbnRpbmZvXCI6IFwiU2hvdyBzdHVkZW50IGRldGFpbHNcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZGluZm9cIjogXCJUaGUgZXhhbSBlbnZpcm9ubWVudCBpcyBwb3NzaWJseSBydW5uaW5nIGluIGEgdmlydHVhbCBtYWNoaW5lXCIsXG4gICAgICAgIFwibGVmdGtpb3NraW5mb1wiOiBcIlRoZSBzZWN1cmUgbW9kZSB3YXMgbGVmdCBhdHRlbXB0IVwiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0aW5mb1wiOiBcIkJhY2t1cCByZXF1ZXN0cyB3ZXJlIG1hZGVcIixcbiAgICAgICAgXCJyZW1vdGVhc3Npc3RhbnRpbmZvXCI6IFwiUmVtb3RlIEFzc2lzdGFudCBTb2Z0d2FyZSBpcyBwb3NzaWJseSBydW5uaW5nIG9uIHRoZSBjbGllbnQgZGV2aWNlXCIsXG4gICAgICAgIFwiZG9jdW1lbnRzaW5mb1wiOiBcIkRvY3VtZW50cyBvbiB0aGUgY2xpZW50IGRldmljZTogXCIsXG4gICAgICAgIFwiZmlsZXNpemV3YXJuaW5nXCI6IFwiRmlsZSBTaXplXCIsXG4gICAgICAgIFwiZmlsZXNpemV3YXJuaW5ndGV4dFwiOiBcIntmaWxlbmFtZX0gaXMgbGFyZ2VyIHRoYW4gOCBNQiAoe3NpemV9IE1CKS4gTGFyZ2UgZmlsZXMgbWF5IHNsb3cgZG93biB0aGUgdHJhbnNmZXIuXCIsXG4gICAgICAgIFwibm9wcmludGVyQ2hvc2VuXCI6IFwicGxlYXNlIHNlbGVjdCBhIHByaW50ZXJcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwiaW52YWxpZHJlZ2lzdHJhdGlvblwiOiBcIm5vIHNlcnZlcnNpZGUgcmVnaXN0cmF0aW9uXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJzdGF0ZWNoYW5nZVwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCBhbHJlYWR5IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwic2VydmVyZXhpc3RzXCI6IFwiRXhhbSBTZXJ2ZXIgYWxyZWFkeSBleGlzdHNcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNMQU5cIjogXCJFeGFtIFNlcnZlciBhbHJlYWR5IGFjdGl2ZSBpbiBsb2NhbCBhcmVhIG5ldHdvcmtcIixcbiAgICAgICAgXCJzZXJ2ZXJzdGFydGVkXCI6IFwiRXhhbSBTZXJ2ZXIgc3RhcnRlZFwiLFxuICAgICAgICBcInNlcnZlcnN0b3BwZWRcIjogXCJFeGFtIFNlcnZlciBzdG9wcGVkXCIsXG4gICAgICAgIFwibm90Zm91bmRcIjogXCJFeGFtIGRvZXNuJ3QgZXhpc3RcIixcbiAgICAgICAgXCJ3cm9uZ3B3XCI6IFwiV3JvbmcgUGFzc3dvcmRcIixcbiAgICAgICAgXCJ3cm9uZ3BpblwiOiBcIldyb25nIFBJTlwiLFxuICAgICAgICBcImNvcnJlY3Rwd1wiOiBcIlBhc3N3b3JkIE9LXCIsXG4gICAgICAgIFwic3R1ZGVudHJlbW92ZVwiOiBcIlJlbW92ZWQgc3R1ZGVudCBmcm9tIEV4YW0gU2VydmVyXCIsXG4gICAgICAgIFwiYWN0aW9uZGVuaWVkXCI6IFwiYWN0aW9uIGRlbmllZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwic3R1ZGVudHVwZGF0ZVwiOiBcInN0dWRlbnQgdXBkYXRlZFwiLFxuICAgICAgICBcInN0dWRlbnRsZWZ0XCI6IFwic3R1ZGVudCBsZWZ0IHRoZSBleGFtXCIsXG4gICAgICAgIFwic3RhdGVyZXN0b3JlXCI6IFwic2FmZSBleGFtIHN0YXRlIHJlc3RvcmVkXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRcIjogXCJuZXh0LWV4YW0gaXMgcnVuIGluIGEgdmlydHVhbCBtYWNoaW5lXCIsXG4gICAgICAgIFwidmVyc2lvbm1pc21hdGNoXCI6IFwiQXBwbGljYXRpb24gdmVyc2lvbnMgbWlzbWF0Y2hcIixcbiAgICAgICAgXCJleGFtcmVxdWVzdFwiOiBcIkV4YW1zIHJlcXVlc3RlZFwiLFxuICAgICAgICBcImJpcHJlcXVpcmVkXCI6IFwiQmlsZHVuZ3Nwb3J0YWwgYXV0aGVudGlmaWNhdGlvbiBtYW5kYXRvcnkhXCIsXG4gICAgICAgIFwic3VibWlzc2lvbmZhaWxlZFwiOiBcIlN1Ym1pc3Npb24gZmFpbGVkIVwiLFxuICAgICAgICBcInN1Ym1pc3Npb25zXCI6IFwiU3VibWlzc2lvbnNcIlxuICAgIH0sICBcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0aGUgdG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwiZGVuaWVkXCI6IFwicGVybWlzc2lvbiBkZW5pZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIm5vIHN0dWRlbnRzIGNvbm5lY3RlZFwiLFxuICAgICAgICBcImZpbGVzc2VudFwiOiBcImZpbGVzIHNlbnRcIixcbiAgICAgICAgXCJjb3VsZG5vdHN0b3JlXCI6IFwic3R1ZGVudCBjb3VsZCBub3Qgc3RvcmUgZmlsZVwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcImZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwibm9maWxlcmVjZWl2ZWRcIjogXCJubyBmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcImZkZWxldGVkXCI6IFwiZGVsZXRlZFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcInJlYWRpbmcgZmlsZSBmYWlsZWRcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzXCI6IFwiUGxlYXNlIGRvdWJsZSBjaGVjayB0aGUgcmVuZGVyaW5nIG9mIHRoZSBhY3RpdmUgc2hlZXRzIGZvcm0gZmllbGRzIGJlZm9yZSBzdGFydGluZyB0aGUgZXhhbSFcIixcbiAgICAgICAgXCJlZGl0XCI6IFwiRWRpdFwiLFxuICAgICAgICBcInNhdmVcIjogXCJTYXZlXCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcImdlbmVyYWxcIjoge1xuICAgICAgICBcInN0YXJ0c2VydmVyXCI6XCJQclx1MDBGQ2Z1bmcgYW5sZWdlblwiLFxuICAgICAgICBcInNsaXN0XCI6IFwiQWt0aXZlIFByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwib2tcIjogXCJPS1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJLZWluZSBOZXR6d2Vya3ZlcmJpbmR1bmdcIlxuICAgIH0sXG4gICAgXCJzZXJ2ZXJsaXN0XCIgOiB7XG4gICAgICAgIFwicHdkXCI6IFwiUGFzc3dvcnRcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcImxvZ2luXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJub3B3XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbiBQYXNzd29ydCBlaW5cIlxuICAgIH0sXG4gICAgXCJzdGFydHNlcnZlclwiIDoge1xuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcInN0YXJ0XCI6IFwiUHJcdTAwRkNmdW5nIHN0YXJ0ZW5cIixcbiAgICAgICAgXCJyZXN1bWVcIjogXCJQclx1MDBGQ2Z1bmcgZm9ydHNldHplblwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6IFwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJwd2RcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImVtcHR5cHdcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluIFBhc3N3b3J0IGFuXCIsXG4gICAgICAgIFwiZW1wdHluYW1lXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmVuIE5hbWVuIGFuXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJmb3J0Z2VzY2hyaXR0ZW5cIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJlaW5mYWNoXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIkFyYmVpdHN2ZXJ6ZWljaG5pc1wiLFxuICAgICAgICBcInNlbGVjdFwiOiBcIkFyYmVpdHN2ZXJ6ZWljaG5pcyB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiWnUgd2VuaWcgZnJlaWVyIFNwZWljaGVycGxhdHpcIixcbiAgICAgICAgXCJkaXJlY3RvcnllcnJvclwiOiBcIkZlaGxlbmRlIFNjaHJlaWJyZWNodGUgaW0gZ2V3XHUwMEU0aGx0ZW4gVmVyemVpY2huaXNcIixcbiAgICAgICAgXCJwcmV2aW91c2V4YW1zXCI6IFwiTG9rYWwgZ2VzaWNoZXJ0ZSBQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcImZvbGRlcmRlbGV0ZVwiOiBcIldvbGxlbiBTaWUgZGllIGRlbiBsb2thbGVuIFByXHUwMEZDZnVuZ3NvcmRuZXIgbFx1MDBGNnNjaGVuP1wiLFxuICAgICAgICBcIm9ubGluZWV4YW1zXCI6IFwiQmlQIFByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwiYmlwbm90bG9nZ2VkaW5cIjogXCJCaXR0ZSBtZWxkZW4gU2llIHNpY2ggYW0gQmlQIGFuLCBiZXZvciBTaWUgZGllIFByXHUwMEZDZnVuZyBzdGFydGVuXCIsXG4gICAgICAgIFwibm9OZXdzXCI6XCJLZWluZSBOZXVpZ2tlaXRlbiB2ZXJmXHUwMEZDZ2JhclwiLFxuICAgICAgICBcImJhY2t1cGZvbGRlclwiOiBcIkJhY2t1cHZlcnplaWNobmlzXCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyaW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lbiBQZmFkIGZcdTAwRkNyIGRhcyBCYWNrdXAtVmVyemVpY2huaXMgZWluXCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc1wiOiBcIkVyd2VpdGVydFwiLFxuICAgICAgICBcImluY29tcGF0aWJsZVwiOiBcIk5pY2h0IGtvbXBhdGliZWwgbWl0IGRlciBha3R1ZWxsZW4gVmVyc2lvblwiLFxuICAgICAgICBcInNlbGVjdGludGVyZmFjZVwiOiBcIk5ldHp3ZXJrLVNjaG5pdHRzdGVsbGUgd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VpbmZvXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgYmV2b3J6dWd0ZSBOZXR6d2Vya3NjaG5pdHRzdGVsbGUgYXVzIVwiXG4gICAgfSxcbiAgICBcImRhc2hib2FyZFwiOntcbiAgICAgICAgXCJyZW1vdmVVUkxcIjogXCJVUkwgZW50ZmVybmVuXCIsXG4gICAgICAgIFwicmVtb3ZlVVJMY29uZmlybVwiOiBcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgZGllc2UgVVJMIGVudGZlcm5lbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwicmVtb3RlYXNzaXN0YW50XCI6IFwiUmVtb3RlIEFzc2lzdGFudFwiLFxuICAgICAgICBcInNlcnZlclwiOiBcIlNlcnZlci1BZHJlc3NlXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIlByXHUwMEZDZnVuZ3NuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcInN0b3BzZXJ2ZXJcIjogXCJQclx1MDBGQ2Z1bmcgdmVybGFzc2VuXCIsXG4gICAgICAgIFwiZmlsZXNlbmRcIjogXCJEYXRlaWVuIHNlbmRlblwiLFxuICAgICAgICBcImZpbGVzZW5kdGV4dFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIG9kZXIgbWVocmVyZSBEYXRlaWVuXCIsXG4gICAgICAgIFwib2ZmaWNlZmlsZXNlbmRcIjogXCJEYXRlaSBob2NobGFkZW5cIixcbiAgICAgICAgXCJvZmZpY2VmaWxlc2VuZHRleHRcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSAueGxzeCBiencuIC5kb2N4IERhdGVpIGFscyBUZW1wbGF0ZSBmXHUwMEZDciBkaWUgU2NoXHUwMEZDbGVyOmlubmVuXCIsXG4gICAgICAgIFwiY2FuY2VsXCI6IFwiQWJicmVjaGVuXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIktlaW5lIERhdGVpZW4gYXVzZ2V3XHUwMEU0aGx0XCIsXG4gICAgICAgIFwidXBsb2FkZmlsZXNcIjogXCJEYXRlaWVuIHdlcmRlbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcImZpbGVzc2VudFwiOiBcIkRhdGVpZW4gZ2VzZW5kZXRcIixcbiAgICAgICAgXCJub2NsaWVudHNcIjogXCJLZWluZSBTY2hcdTAwRkNsZXI6aW5uZW4gdmVyYnVuZGVuXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIlNwcmFjaGVuXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWtcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJBY3RpdmUgU2hlZXRzXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzaGludFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFBERi1EYXRlaSBhdXMsIGRpZSBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwiYWNjZXB0UGRmXCI6IFwiUERGIERhdGVpIFx1MDBGQ2Jlcm5laG1lblwiLFxuICAgICAgICBcInNlbGVjdE90aGVyUGRmXCI6IFwiYW5kZXJlIFBERiBEYXRlaSB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcIm5vcGRmc2VsZWN0ZWRcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBQREYtRGF0ZWkgYXVzIVwiLFxuICAgICAgICBcImludmFsaWRwZGZcIjogXCJVbmdcdTAwRkNsdGlnZSBQREYtRGF0ZWkhXCIsXG4gICAgICAgIFwicGRmcHJvY2Vzc2luZ2Vycm9yXCI6IFwiRmVobGVyIGJlaW0gVmVyYXJiZWl0ZW4gZGVyIFBERi1EYXRlaS5cIixcbiAgICAgICAgXCJlZHV2aWR1YWxcIjogXCJFZHV2aWR1YWwgLyBNb29kbGVcIixcbiAgICAgICAgXCJ3ZWJzaXRlXCI6IFwiV2Vic2l0ZS1VUkxcIixcbiAgICAgICAgXCJhdXRvZ2V0XCI6IFwiQmFja3VwLUludGVydmFsbFwiLFxuICAgICAgICBcInN0YXJ0ZXhhbVwiOiBcIkdlclx1MDBFNHRlIGFic2ljaGVyblwiLFxuICAgICAgICBcInN0YXJ0ZXhhbXNpbmdsZVwiOiBcIkdlclx1MDBFNHQgYWJzaWNoZXJuXCIsXG4gICAgICAgIFwic3RhcnRleGFtZGVzY1wiOiBcIlN0YXJ0ZXQgZGVuIGFiZ2VzaWNoZXJ0ZW4gUHJcdTAwRkNmdW5nc21vZHVzIGF1ZiBkZW4gR2VyXHUwMEU0dGVuIGRlciBTY2hcdTAwRkNsZXI6aW5uZW5cIixcbiAgICAgICAgXCJzZW5kZmlsZVwiOiBcIkRhdGVpZW4gYW4gYWxsZSBTY2hcdTAwRkNsZXI6aW5uZW4gc2VuZGVuIChwZGYsIGpwZywgbXAzLCBiYWssIGdnYiwgcG5nLCBnaWYsIHdhdiwgb2dnKVwiLFxuICAgICAgICBcInNlbmRmaWxlU2luZ2xlXCI6IFwiRGF0ZWkgc2VuZGVuXCIsXG4gICAgICAgIFwiZ2V0ZmlsZVwiOiBcIlNpY2hlcnVuZ2VuIHZvbiBhbGxlbiBTY2hcdTAwRkNsZXI6aW5uZW4gaG9sZW5cIixcbiAgICAgICAgXCJnZXRmaWxlU2luZ2xlXCI6IFwiU2ljaGVydW5nIGhvbGVuXCIsXG4gICAgICAgIFwiZ2V0ZmlsZXNcIjogXCJTaWNoZXJ1bmcgaG9sZW5cIixcbiAgICAgICAgXCJzdG9wZXhhbVwiOiBcIkdlclx1MDBFNHRlIGZyZWlnZWJlblwiLFxuICAgICAgICBcInN0b3BleGFtc2luZ2xlXCI6IFwiR2VyXHUwMEU0dCBmcmVpZ2ViZW5cIixcbiAgICAgICAgXCJzdXJlXCI6IFwiU2luZCBTaWUgc2ljaGVyP1wiLFxuICAgICAgICBcImV4aXRleGFtc3VyZVwiOiBcIlByXHUwMEZDZnVuZ3NzZXJ2ZXIgc2NobGllXHUwMERGZW4/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1cIjogXCJEaWVzIGJlZW5kZXQgZGVuIFByXHUwMEZDZnVuZ3NzZXJ2ZXIuXFxuRGllIFNjaFx1MDBGQ2xlcjppbm5lbiBrXHUwMEY2bm5lbiBpbSBhYmdlc2ljaGVydGVuIE1vZHVzIGF1Y2ggb2huZSBWZXJiaW5kdW5nIHdlaXRlcmFyYmVpdGVuLlwiLFxuICAgICAgICBcImV4aXRleGFtaW5mb1wiOiBcIkFsbGUgYmVzdGVoZW5kZW4gVmVyYmluZHVuZ2VuIHdlcmRlbiB1bnRlcmJyb2NoZW5cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4uIERpZXMgc2NobGllXHUwMERGdCBkYXMgUHJcdTAwRkNmdW5nc2ZlbnN0ZXIgZlx1MDBGQ3IgYWxsZSBTY2hcdTAwRkNsZXI6aW5uZW4hXCIsXG4gICAgICAgIFwiZXhpdGtpb3Nrc2hvcnRcIjogXCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4uXCIsXG4gICAgICAgIFwicmVhbGx5a2lja1wiOiBcInZvbSBQclx1MDBGQ2Z1bmdzc2VydmVyIGVudGZlcm5lblwiLFxuICAgICAgICBcImtpY2tcIjogXCJWZXJiaW5kdW5nIHRyZW5uZW5cIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJBYnNpY2hlcnVuZyB2ZXJsYXNzZW5cIixcbiAgICAgICAgXCJvbmxpbmVcIjpcIkluZm9cIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwib2ZmbGluZVwiLFxuICAgICAgICBcInNlY3VyZVwiOlwiRXhhbVwiLFxuICAgICAgICBcInNlY3VyZWluZm9cIjpcIlNjaFx1MDBGQ2xlcjppbiBpc3QgYWJnZXNpY2hlcnRcIixcbiAgICAgICAgXCJyZXN0b3JlXCI6XCJmb3J0c2V0emVuXCIsXG4gICAgICAgIFwicmVzdW1laW5mb1wiOlwiVGVtcG9yXHUwMEU0cmUgQmxvY2thZGUgYXVmaGViZW5cIixcbiAgICAgICAgXCJleGFtbW9kZWFjdGl2ZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBiZXJlaXRzIGltIGFiZ2VzaWNoZXJ0ZW4gTW9kdXNcIixcbiAgICAgICAgXCJjbG9zZVwiOlwic2NobGllXHUwMERGZW5cIixcbiAgICAgICAgXCJkZWxcIjogXCJBcmJlaXRzb3JkbmVyIGF1ZiBHZXJcdTAwRTR0ZW4gZGVyIFNjaFx1MDBGQ2xlcjppbm5lbiBiZXJlaW5pZ2VuXCIsXG4gICAgICAgIFwiZGVsc3VyZVwiOiBcIkRpZSBBcmJlaXRzb3JkbmVyIGF1ZiBkZW4gR2VyXHUwMEU0dGVuIGRlciBTY2hcdTAwRkNsZXI6aW5uZW4gd2VyZGVuIGdlbGVlcnRcIixcbiAgICAgICAgXCJkZWxzaW5nbGVcIjogXCJBcmJlaXRzb3JkbmVyIGF1ZiBTY2hcdTAwRkNsZXI6aW5uZW4tU2VpdGUgYmVyZWluaWdlblwiLFxuICAgICAgICBcImRlbHNpbmdsZXN1cmVcIjogXCJEZXIgQXJiZWl0c29yZG5lciBhdWYgZGVtIFNjaFx1MDBGQ2xlcjppbm5lbi1HZXJcdTAwRTR0IHdpcmQgZ2VsZWVydFwiLFxuICAgICAgICBcImF0dGVudGlvblwiOiBcIkFjaHR1bmchXCIsXG4gICAgICAgIFwiYmFja3VwcmVxdWVzdFwiOiBcIkFyYmVpdGVuIHdlcmRlbiBnZWhvbHRcIixcbiAgICAgICAgXCJzaG93d29ya2ZvbGRlclwiOiBcIkxva2FsZW4gQXJiZWl0c29yZG5lciBhbnplaWdlblwiLFxuICAgICAgICBcIndvcmtmb2xkZXJcIjogXCJPcmRuZXIgXHUwMEY2ZmZuZW5cIixcbiAgICAgICAgXCJzaG93bmV3ZXN0Zm9sZGVyXCI6IFwiTmV1ZXN0ZW4gT3JkbmVyIGFuemVpZ2VuXCIsXG4gICAgICAgIFwiZmlsZXNmb2xkZXJcIjogXCJEYXRlaWVuIGltIEFyYmVpdHNvcmRuZXJcIixcbiAgICAgICAgXCJjaG9vc2VzdHVkZW50XCI6IFwiV1x1MDBFNGhsZW4gU2llIGVpbmUgUGVyc29uXCIsXG4gICAgICAgIFwiY2hvb3NlcmVxdWlyZVwiOiBcIlNpZSBtXHUwMEZDc3NlbiBlaW5lIE9wdGlvbiB3XHUwMEU0aGxlbiFcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIFNjaFx1MDBGQ2xlcmFyYmVpdGVuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmXCI6IFwiTGV0enRlIEFiZ2FiZW4gaW5cXG5laW5lciBQREYtRGF0ZWlcXG56dXNhbW1lbmZhc3NlblwiLFxuICAgICAgICBcInN1bW1hcml6ZXBkZnNob3J0XCI6IFwiTGV0enRlIEFiZ2FiZW4genVzYW1tZW5mYXNzZW5cIixcbiAgICAgICAgXCJwcmludHJlcXVlc3RcIjogXCJEcnVja2FuZnJhZ2UgZXJoYWx0ZW5cIixcbiAgICAgICAgXCJwcmludHJlcXVlc3RzaG93XCI6IFwiV29sbGVuIFNpZSBkYXMgRG9rdW1lbnQgYW5zZWhlbiB1bmQgZHJ1Y2tlbj9cIixcbiAgICAgICAgXCJkb3dubG9hZFwiOiBcImhlcnVudGVybGFkZW5cIixcbiAgICAgICAgXCJwcmludFwiOiBcImRydWNrZW5cIixcbiAgICAgICAgXCJwcmV2aWV3XCI6IFwiYW5zZWhlblwiLFxuICAgICAgICBcInNlbmRcIjogXCJ2ZXJzZW5kZW5cIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOlwiYWt0aXZpZXJlblwiLFxuICAgICAgICBcIkFjdGl2YXRlXCI6IFwiQWt0aXZpZXJlblwiLFxuICAgICAgICBcInZpcnR1YWxpemVkXCI6IFwidmlydHVhbGlzZXJ0ZSBBcmJlaXRzdW1nZWJ1bmdcIixcbiAgICAgICAgXCJkZWxldGVcIjogXCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJmaWxlZGVsZXRlXCI6IFwiV29sbGVuIFNpZSBkaWUgRGF0ZWkvZGVuIE9yZG5lciB3aXJrbGljaCBsXHUwMEY2c2NoZW4/XCIsXG4gICAgICAgIFwiY2Fubm90RGVsZXRlQWN0aXZlU2hlZXRcIjogXCJBY3RpdmUgU2hlZXQga2FubiB3XHUwMEU0aHJlbmQgZGVyIFByXHUwMEZDZnVuZyBuaWNodCBnZWxcdTAwRjZzY2h0IHdlcmRlblwiLFxuICAgICAgICBcImV4aXRkZWxldGVcIjogXCJQclx1MDBGQ2Z1bmdzZGF0ZW4gYXVmIFNjaFx1MDBGQ2xlclBDcyBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWliaGlsZmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrYWN0aXZhdGVcIjogXCJSZWNodHNjaHJlaWJoaWxmZSBha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFNwcmFjaGUgZlx1MDBGQ3IgZGllIFByXHUwMEZDZnVuZ1wiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlZvcnNjaGxcdTAwRTRnZSB6ZWlnZW5cIixcbiAgICAgICAgXCJjdXN0b21ob3N0XCI6IFwiRWlnZW5lciBMVCBIb3N0XCIsXG4gICAgICAgIFwibGFuZ3VhZ2V0b29saG9zdFwiOiBcIkxhbmd1YWdlVG9vbCBIb3N0XCIsXG4gICAgICAgIFwibm9uZVwiOiBcImFuZGVyZVwiLFxuICAgICAgICBcImNtYXJnaW5cIjogXCJLb3JyZWt0dXJyYW5kIFBvc2l0aW9uXCIsXG4gICAgICAgIFwiY21hcmdpbi1sZWZ0XCI6IFwibGlua3NcIixcbiAgICAgICAgXCJjbWFyZ2luLXJpZ2h0XCI6IFwicmVjaHRzXCIsXG4gICAgICAgIFwiY21hcmdpbi12YWx1ZVwiOiBcIktvcnJla3R1cnJhbmQgaW0gUERGXCIsXG4gICAgICAgIFwidGV4dGVkaXRvclwiOiBcIlRleHRlZGl0b3ItRWluc3RlbGx1bmdlblwiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJiYWNrdXBhdXRvXCI6XCJBdXRvbWF0aXNjaGUgU2ljaGVydW5nXCIsXG4gICAgICAgIFwiYmFja3VwYXV0b3F1ZXN0aW9uXCI6XCJJbiB3ZWxjaGVuIEFic3RcdTAwRTRuZGVuIHNvbGxlbiBkaWUgQXJiZWl0ZW4gZ2Vob2x0IHdlcmRlbj9cIixcbiAgICAgICAgXCJiYWNrdXBhdXRvaGludFwiOlwiKFplaXRhbmdhYmUgaW4gTWludXRlbilcIixcbiAgICAgICAgXCJlZHV2aWR1YWxpZFwiOiBcIkVkdXZpZHVhbCAvIE1vb2RsZVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkaGludFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIGdcdTAwRkNsdGlnZSBUZXN0LVVSTCBlaW4hXCIsXG4gICAgICAgIFwiZ2Zvcm1zaGludFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIGdcdTAwRkNsdGlnZSBHb29nbGUgRm9ybXMgSUQgZWluIVwiLFxuICAgICAgICBcImVkdXZpZHVhbGRvbWFpblwiOiBcIlNvbGx0ZSBpaHJlIE1vb2RsZWluc3RhbnogdW50ZXIgZWluZXIgYW5kZXJlbiBEb21haW4gZXJyZWljaGJhciBzZWluLCBnZWJlbiBTaWUgZGllc2UgYW5cIixcbiAgICAgICAgXCJtb29kbGVJbnZhbGlkRG9tYWluXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIE1vb2RsZS1Eb21haW4gYW4hXCIsXG4gICAgICAgIFwiaW52YWxpZERvbWFpblwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIGdcdTAwRkNsdGlnZSBEb21haW4gZWluIVwiLFxuICAgICAgICBcIm1vb2RsZUludmFsaWRJZFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIGdcdTAwRkNsdGlnZSBUZXN0LUlEIGFuIVwiLFxuICAgICAgICBcImxvY2tcIjpcIkJpbGRzY2hpcm1lIHNwZXJyZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjpcIkJpbGRzY2hpcm1lIGZyZWlnZWJlblwiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiRnJlaWVyIFNwZWljaGVycGxhdHogenUgZ2VyaW5nIVwiLFxuICAgICAgICBcImludmFsaWRfZmlsZVwiIDogXCJGYWxzY2hlciBEYXRlaXR5cFwiLFxuICAgICAgICBcImludmFsaWRfZmlsZV90ZXh0XCI6IFwiTnVyIERhdGVpZW4gbWl0IGRlciBFbmR1bmcgLnhsc3ggdW5kIC5kb2N4IHNpbmQgZXJsYXVidC5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJWb3JoYW5kZW5lIERhdGVpZW4gYXVmIE9uZURyaXZlIGVyc2V0emVuP1wiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6XCJTaWNoZXJ1bmcgYW5nZWZvcmRlcnRcIixcbiAgICAgICAgXCJzY3JlZW5zaG90XCI6XCJTY3JlZW5zaG90dXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHRpdGxlXCI6XCJTY3JlZW5zaG90IFVwZGF0ZVwiLFxuICAgICAgICBcInNjcmVlbnNob3RxdWVzdGlvblwiOlwiSW4gd2VsY2hlbiBBYnN0XHUwMEU0bmRlbiBzb2xsZW4gZGllIFNjcmVlbnNob3RzIGFrdHVhbGlzaWVydCB3ZXJkZW4/XCIsXG4gICAgICAgIFwic2NyZWVuc2hvdGhpbnRcIjpcIihaZWl0YW5nYWJlIGluIFNla3VuZGVuLiAwID09IGRlYWt0aXZpZXJ0KVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdcIjpcIk1hbmNoZSBBYmdhYmVuIHNpbmQgbWVociBhbHMgNSBNaW51dGVuIGFsdCFcIixcbiAgICAgICAgXCJvbGRwZGZ3YXJuaW5nc2luZ2xlXCI6XCJEaWUgbG9rYWxlIFZlcnNpb24gZGVyIERhdGVpIGlzdCBtXHUwMEY2Z2xpY2hlcndlaXNlIHZlcmFsdGV0IVwiLFxuICAgICAgICBcImdmb3Jtc1wiOiBcIkdvb2dsZSBGb3Jtc1wiLFxuICAgICAgICBcImFjY2Vzc0RlbmllZFwiOlwiWnVncmlmZiB2ZXJ3ZWlnZXJ0IVwiLFxuICAgICAgICBcImFjY2Vzc0RlbmllZHRleHRcIjpcIkJpdHRlIGtvbnRha3RpZXJlbiBTaWUgaWhyZW4gU3lzdGVtYWRtaW5pc3RyYXRvciwgdW0gZGVyIEFwcGxpa2F0aW9uIE5leHQtRXhhbSBadWdyaWZmIHp1IGdld1x1MDBFNGhyZW5cIixcbiAgICAgICAgXCJtc29XYXJuXCI6IFwiQmV2b3IgZGllIFNjaFx1MDBGQ2xlcjppbm5lbiBkaWUgVmVyYmluZHVuZyB3aWVkZXIgYXVmbmVobWVuIGtcdTAwRjZubmVuLCBtXHUwMEZDc3NlbiBTaWUgc2ljaCB6dSBpaHJlciBNaWNyb3NvZnQgQ2xvdWQgdmVyYmluZGVuIHVuZCBkaWUgTVNPRGF0ZWkgZXJuZXV0IGF1c3dcdTAwRTRobGVuIVwiLFxuICAgICAgICBcImFsbG93c3BlbGxjaGVja1wiOlwiUmVjaHRzY2hyZWliaGlsZmUgZlx1MDBGQ3IgU2NoXHUwMEZDbGVyOmluIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJsaW5lc3BhY2luZ1wiOiBcIlplaWxlbmFic3RhbmQgaW0gUERGXCIsXG4gICAgICAgIFwiZm9udGZhbWlseVwiOiBcIlNjaHJpZnRhcnRcIixcbiAgICAgICAgXCJkZWZhdWx0cHJpbnRlclwiOiBcIlN0YW5kYXJkLURydWNrZXIgd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJhbGxvd2RpcmVjdHByaW50XCI6IFwiU2NoXHUwMEZDbGVyOmlubmVuIGVybGF1YmVuIERydWNrYXVmdHJcdTAwRTRnZSBkaXJla3QgenUgc3RhcnRlblwiLFxuICAgICAgICBcIm5vcHJpbnRlclwiOiBcIktlaW5lIERydWNrZXIgZ2VmdW5kZW5cIixcbiAgICAgICAgXCJkaXJlY3RwcmludFwiOiBcIkF1dG9ub21lciBEcnVja1wiLFxuICAgICAgICBcIm9wZW5cIjogXCJEYXRlaSBpbiBleHRlcm5lbSBCZXRyYWNodGVyIFx1MDBGNmZmbmVuXCIsXG4gICAgICAgIFwib2NyXCI6IFwiT0NSIFNpY2hlcmhlaXRcIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdHRpdGxlXCI6IFwiQWJzcGllbGVuIHZvbiBBdWRpb2RhdGVpZW4gZWluc2Noclx1MDBFNG5rZW5cIixcbiAgICAgICAgXCJhdWRpb2FsbG93XCI6IFwiS2VpbmUgRWluc2Noclx1MDBFNG5rdW5nXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXQxXCI6IFwieCBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdDJcIjogXCJ4IGFic3BpZWxlblwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6IFwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbGFjdGl2YXRlXCI6IFwiQmlsZHVuZ3Nwb3J0YWwgYWt0aXZpZXJlblwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsc2V0dGluZ3NcIjogXCJFcndlaXRlcnRlIEVpbnN0ZWxsdW5nZW4genVtIEJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwiZ3JvdXBzXCI6IFwiR3J1cHBlblwiLFxuICAgICAgICBcImdyb3VwaW5mb1wiOiBcIlNjaFx1MDBGQ2xlcjppbm5lbiBpbiB6d2VpIEdydXBwZW4gYXVmdGVpbGVuXCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc1wiOiBcIkVyd2VpdGVydGUgRWluc3RlbGx1bmdlblwiLFxuICAgICAgICBcInNhdmVcIjogXCJzcGVpY2hlcm5cIixcbiAgICAgICAgXCJkaXNhYmxlZFwiOiBcImRlYWt0aXZpZXJ0XCIsXG4gICAgICAgIFwib2NyaW5mb1wiOlwiQWt0dWVsbGUgUHJcdTAwRkNmdW5ncy1QSU4gaW0gU2NyZWVuc2hvdCBlcmtlbm5lblwiLFxuICAgICAgICBcImJpcGluZm9cIjogXCJCaVAtU3RhdHVzIGdpYnQgYW4gb2Igc2ljaCBhdXRoZW50aWZpemllcnRlIENsaWVudHMgdmVyYmluZGVuIGtcdTAwRjZubmVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6IFwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBzaWNoIGFibWVsZGVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJhY3RpdmF0ZXNlY3Rpb25zXCI6IFwiUHJcdTAwRkNmdW5nc2Fic2Nobml0dGUgYWt0aXZpZXJlblwiLFxuICAgICAgICBcImV4YW1zZWN0aW9uc1wiOiBcIlByXHUwMEZDZnVuZ3NhYnNjaG5pdHRlXCIsXG4gICAgICAgIFwiZXhhbXNlY3Rpb25zaW5mb1wiOiBcIlNpZSBiZWZpbmRlbiBzaWNoIGltIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMuIFNvbGwgZGllc2VyIFByXHUwMEZDZnVuZ3NhYnNjaG5pdHQgZlx1MDBGQ3IgYWxsZSB2ZXJidW5kZW5lbiBDbGllbnRzIGFrdGl2aWVydCB3ZXJkZW4/XCIsXG4gICAgICAgIFwibm9cIjpcIk5laW5cIixcbiAgICAgICAgXCJ5ZXNcIjpcIkphXCIsXG4gICAgICAgIFwiZXhhbW1vZGVcIjpcIlByXHUwMEZDZnVuZ3Ntb2R1c1wiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOlwiUHJcdTAwRkNmdW5nc21hdGVyaWFsaWVuXCIsXG4gICAgICAgIFwiZGVmaW5lbWF0ZXJpYWxzXCI6XCJNYXRlcmlhbGllbiBmZXN0bGVnZW4gZGllIHdcdTAwRTRocmVuZCBkZXIgUHJcdTAwRkNmdW5nIHZlcmZcdTAwRkNnYmFyIHNlaW4gc29sbGVuXCIsXG4gICAgICAgIFwicHJvY2Vzc2luZ2ZpbGVzXCI6XCJNYXRlcmlhbGllbiB3ZXJkZW4gdmVyYXJiZWl0ZXRcIixcbiAgICAgICAgXCJmb250c2l6ZXRpdGxlXCI6IFwiU2NocmlmdGdyXHUwMEY2XHUwMERGZSBpbSBQREZcIixcbiAgICAgICAgXCJmb250c2l6ZVwiOiBcIlNjaHJpZnRnclx1MDBGNlx1MDBERmVcIixcbiAgICAgICAgXCJyZW1vdmVmaWxlXCI6IFwiRGF0ZWkgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZWNvbmZpcm1cIjogXCJXb2xsZW4gU2llIGRpZSBEYXRlaSB3aXJrbGljaCBsXHUwMEY2c2NoZW4/XCIsXG4gICAgICAgIFwic2VjdGlvbm5hbWVcIjogXCJBYnNjaG5pdHRzbmFtZVwiLFxuICAgICAgICBcInNlY3Rpb25uYW1laW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lbiBOYW1lbiBmXHUwMEZDciBkaWVzZW4gQWJzY2huaXR0IGVpblwiLFxuICAgICAgICBcImdyb3VwQVwiOiBcIkdydXBwZSBBXCIsXG4gICAgICAgIFwiZ3JvdXBCXCI6IFwiR3J1cHBlIEJcIixcbiAgICAgICAgXCJhbGxvd2VkVVJMXCI6IFwiRXJsYXVidGUgVVJMXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTGluZm9cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBVUkwgZWluLCBkaWUgd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgZXJsYXVidCBpc3RcIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzX21vZGVcIjogXCJFcndlaXRlcnRlIEVpbnN0ZWxsdW5nZW4genVtIFByXHUwMEZDZnVuZ3Ntb2R1c1wiLFxuICAgICAgICBcInJkcFwiOiBcIldlYiBSRFBcIixcbiAgICAgICAgXCJyZHBjb25maWdcIjogXCJSRFAgS29uZmlndXJhdGlvblwiLFxuICAgICAgICBcInJkcGNvbmZpZ2luZm9cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZGllIERvbWFpbihVUkwpIGRlcyBSRFAtU2VydmVycyBlaW5cIixcbiAgICAgICAgXCJtdXRlYXVkaW9cIjogXCJBdWRpbyBzdHVtbXNjaGFsdGVuXCIsXG4gICAgICAgIFwibXV0ZWF1ZGlvaW50cm9cIjogXCJXZW5uIGRpZXNlIE9wdGlvbiBha3RpdmllcnQgaXN0LCB3ZXJkZW4gYWt1c3Rpc2NoZSBTaWduYWxlIHdcdTAwRTRocmVuZCBkZXIgUHJcdTAwRkNmdW5nIG5pY2h0IGFiZ2VzcGllbHRcIixcbiAgICAgICAgXCJzaG93c3VibWlzc2lvblwiOiBcIkFiZ2FiZSBhbnplaWdlblwiLFxuICAgICAgICBcInN0dWRlbnRpbmZvXCI6IFwiRGV0YWlscyB2b24gU2NoXHUwMEZDbGVyOmluIGFuemVpZ2VuXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRpbmZvXCI6IFwiRGllIFByXHUwMEZDZnVuZ3N1bWdlYnVuZyB3aXJkIG1cdTAwRjZnbGljaGVyd2Vpc2UgaW4gZWluZXIgdmlydHVlbGxlbiBNYXNjaGluZSBhdXNnZWZcdTAwRkNocnRcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tpbmZvXCI6IFwiRXMgd3VyZGUgdmVyc3VjaHQgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgenUgdmVybGFzc2VuIVwiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0aW5mb1wiOiBcIlNpY2hlcnVuZ2VuIHd1cmRlbiBhbmdlZm9yZGVydFwiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudGluZm9cIjogXCJSZW1vdGUgQXNzaXN0YW50IFNvZnR3YXJlIGxcdTAwRTR1ZnQgbVx1MDBGNmdsaWNoZXJ3ZWlzZSBhbSBTY2hcdTAwRkNsZXI6aW5uZW4tR2VyXHUwMEU0dFwiLFxuICAgICAgICBcImRvY3VtZW50c2luZm9cIjogXCJEb2t1bWVudGUgYXVmIGRlbSBTY2hcdTAwRkNsZXI6aW5uZW4tR2VyXHUwMEU0dDogXCIsXG4gICAgICAgIFwiZmlsZXNpemV3YXJuaW5nXCI6IFwiRGF0ZWlnclx1MDBGNlx1MDBERmVcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmd0ZXh0XCI6IFwie2ZpbGVuYW1lfSBpc3QgZ3JcdTAwRjZcdTAwREZlciBhbHMgOCBNQiAoe3NpemV9IE1CKS4gR3JvXHUwMERGZSBEYXRlaWVuIGtcdTAwRjZubmVuIGRpZSBcdTAwRENiZXJ0cmFndW5nIHZlcmxhbmdzYW1lbi5cIixcbiAgICAgICAgXCJub3ByaW50ZXJDaG9zZW5cIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZW4gRHJ1Y2tlclwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJEYXMgVG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJpbnZhbGlkcmVnaXN0cmF0aW9uXCI6IFwiS2VpbmUgUmVnaXN0cmllcnVuZyB2b3JnZWZ1bmRlblwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIGdlXHUwMEU0bmRlcnRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiB1bnRlciBkaWVzZW0gTmFtZW4gYmVyZWl0cyBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwic2VydmVyZXhpc3RzXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBleGlzdGllcnQgYmVyZWl0c1wiLFxuICAgICAgICBcInNlcnZlcmV4aXN0c0xBTlwiOiBcIlByXHUwMEZDZnVuZ3NzZXJ2ZXIgZXhpc3RpZXJ0IGJlcmVpdHMgaW0gbG9rbGVuIE5ldHp3ZXJrXCIsXG4gICAgICAgIFwic2VydmVyc3RhcnRlZFwiOiBcIlByXHUwMEZDZnVuZ3NzZXJ2ZXIgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwic2VydmVyc3RvcHBlZFwiOiBcIlByXHUwMEZDZnVuZ3NzZXJ2ZXIgYmVlbmRldFwiLFxuICAgICAgICBcIm5vdGZvdW5kXCI6IFwiUHJcdTAwRkNmdW5nIGV4aXN0aWVydCBuaWNodFwiLFxuICAgICAgICBcIndyb25ncHdcIjogXCJQYXNzd29ydCBmYWxzY2hcIixcbiAgICAgICAgXCJ3cm9uZ3BpblwiOiBcIkZhbHNjaGVyIFBJTlwiLFxuICAgICAgICBcImNvcnJlY3Rwd1wiOiBcIlBhc3N3b3J0IE9LXCIsXG4gICAgICAgIFwic3R1ZGVudHJlbW92ZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiB2b24gUHJcdTAwRkNmdW5nc3NlcnZlciBlbnRmZXJudFwiLFxuICAgICAgICBcImFjdGlvbmRlbmllZFwiOiBcIkFrdGlvbiB2ZXJib3RlblwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcInN0dWRlbnR1cGRhdGVcIjogXCJTY2hcdTAwRkNsZXJkYXRlbiBha3R1YWxpc2llcnRcIixcbiAgICAgICAgXCJzdHVkZW50bGVmdFwiOiBcIlNjaFx1MDBGQ2xlcjppbiBoYXQgZGVuIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgdmVybGFzc2VuXCIsXG4gICAgICAgIFwic3RhdGVyZXN0b3JlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIHdpZWRlcmhlcmdlc3RlbGx0XCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRcIjogXCI6IERpZSBQclx1MDBGQ2Z1bmdzdW1nZWJ1bmcgd2lyZCBpbiBlaW5lciB2aXJ0dWVsbGVuIE1hc2NoaW5lIGF1c2dlZlx1MDBGQ2hydFwiLFxuICAgICAgICBcInZlcnNpb25taXNtYXRjaFwiOiBcIkRpZSBQcm9ncmFtbXZlcnNpb25lbiBzdGltbWVuIG5pY2h0IFx1MDBGQ2JlcmVpblwiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6IFwiU2ljaGVydW5nZW4gd3VyZGVuIGFuZ2Vmb3JkZXJ0XCIsXG4gICAgICAgIFwiYmlwcmVxdWlyZWRcIjogXCJEaWVzIGVyendpbmd0IGRpZSBBdXRoZW50aWZpemllcnVuZyBkZXIgU2NoXHUwMEZDbGVyOmlubmVuIGR1cmNoIGRhcyBCaWxkdW5nc3BvcnRhbC5cIixcbiAgICAgICAgXCJzdWJtaXNzaW9uZmFpbGVkXCI6IFwiQWJnYWJlIGZlaGxnZXNjaGxhZ2VuIVwiLFxuICAgICAgICBcInN1Ym1pc3Npb25zXCI6IFwiQWJnYWJlblwiXG5cblxuICAgIH0sICBcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJkZW5pZWRcIjogXCJadWdyaWZmIHZlcndlaWdlcnRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJub2NsaWVudHNcIjogXCJLZWluZSBTY2hcdTAwRkNsZXI6aW5uZW4gdmVyYnVuZGVuXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiRGF0ZWllbiBnZXNlbmRldFwiLFxuICAgICAgICBcImNvdWxkbm90c3RvcmVcIjogXCJTY2hcdTAwRkNsZXI6aW4ga29ubnRlIGRpZSBEYXRlaSBuaWNodCBzcGVpY2hlcm5cIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJEYXRlbiBlcmhhbHRlblwiLFxuICAgICAgICBcIm5vZmlsZXJlY2VpdmVkXCI6IFwiS2VpbmUgRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZkZWxldGVkXCI6IFwiZ2VsXHUwMEY2c2NodFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcImxlc2VuIGRlciBEYXRlaSBmZWhsZ2VzY2hsYWdlblwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiTVx1MDBGNmdsaWNoZXJ3ZWlzZSBnZXNjYW5udGVzIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJBdWZcIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcInd1cmRlbiB3ZW5pZ2VyIGFscyAyIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGdlZnVuZGVuLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIkRpZXMgZGV1dGV0IGRhcmF1ZiBoaW4sIGRhc3MgZXMgc2ljaCB1bSBlaW4gZ2VzY2FubnRlcyBQREYgaGFuZGVsdCwgZGFzIGtlaW5lIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgb2RlciBUYWJlbGxlbiBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlZlcnN0YW5kZW5cIixcbiAgICAgICAgXCJwYWdlXCI6IFwiU2VpdGVcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlNlaXRlblwiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c1wiOiBcIkJpdHRlIFx1MDBGQ2JlcnByXHUwMEZDZmVuIFNpZSBkaWUgRGFyc3RlbGx1bmcgdW5kIFBvc2l0aW9uaWVydW5nIGRlciBha3RpdmVuIEZvcm11bGFyZmVsZGVyIHZvciBkZW0gU3RhcnQgZGVyIFByXHUwMEZDZnVuZyFcIixcbiAgICAgICAgXCJlZGl0XCI6IFwiQmVhcmJlaXRlblwiLFxuICAgICAgICBcInNhdmVcIjogXCJTcGVpY2hlcm5cIlxuICAgIH1cbn1cbiIsICJpbXBvcnQgeyBMb2dMZXZlbCwgUHVibGljQ2xpZW50QXBwbGljYXRpb24gfSBmcm9tICdAYXp1cmUvbXNhbC1icm93c2VyJztcblxuLy8gQ29uZmlnIG9iamVjdCB0byBiZSBwYXNzZWQgdG8gTXNhbCBvbiBjcmVhdGlvblxuZXhwb3J0IGNvbnN0IG1zYWxDb25maWcgPSB7XG4gIGF1dGg6IHtcbiAgICBjbGllbnRJZDogJ2M5NTJlZGRlLWQ3YzItNDI4MS1hODQ2LTAzNGZiMDM5ZTFmNScsXG4gICAgYXV0aG9yaXR5OiAnaHR0cHM6Ly9sb2dpbi5taWNyb3NvZnRvbmxpbmUuY29tL2NvbW1vbicsXG4gICAgcmVkaXJlY3RVcmk6ICdodHRwczovL2xvY2FsaG9zdDoyMjQyMi9zZXJ2ZXIvY29udHJvbC9tc2F1dGgnLFxuICAgIHBvc3RMb2dvdXRSZWRpcmVjdFVyaTogJ2h0dHBzOi8vbG9jYWxob3N0OjIyNDIyL3NlcnZlci9jb250cm9sL21zYXV0aCdcbiAgfSxcbiAgY2FjaGU6IHtcbiAgICBjYWNoZUxvY2F0aW9uOiAnbG9jYWxTdG9yYWdlJ1xuICB9LFxuICBzeXN0ZW06IHtcbiAgICAgIGxvZ2dlck9wdGlvbnM6IHtcbiAgICAgICAgICBsb2dnZXJDYWxsYmFjazogKGxldmVsOiBMb2dMZXZlbCwgbWVzc2FnZTogc3RyaW5nLCBjb250YWluc1BpaTogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICBpZiAoY29udGFpbnNQaWkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzd2l0Y2ggKGxldmVsKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlIExvZ0xldmVsLkVycm9yOlxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgY2FzZSBMb2dMZXZlbC5JbmZvOlxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICBjYXNlIExvZ0xldmVsLlZlcmJvc2U6XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICBjYXNlIExvZ0xldmVsLldhcm5pbmc6XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBsb2dMZXZlbDogTG9nTGV2ZWwuVmVyYm9zZVxuICAgICAgfVxuICB9XG59O1xuXG5leHBvcnQgY29uc3QgbXNhbEluc3RhbmNlID0gbmV3IFB1YmxpY0NsaWVudEFwcGxpY2F0aW9uKG1zYWxDb25maWcpO1xuXG4vLyBBZGQgaGVyZSBzY29wZXMgZm9yIGlkIHRva2VuIHRvIGJlIHVzZWQgYXQgTVMgSWRlbnRpdHkgUGxhdGZvcm0gZW5kcG9pbnRzLlxuZXhwb3J0IGNvbnN0IGxvZ2luUmVxdWVzdCA9IHtcbiAgc2NvcGVzOiBbJ1VzZXIuUmVhZCcsJ29wZW5pZCcsICdwcm9maWxlJywgJ29mZmxpbmVfYWNjZXNzJywgJ0ZpbGVzLlJlYWQnLCAnRmlsZXMuUmVhZFdyaXRlJywnRmlsZXMuUmVhZFdyaXRlLkFwcEZvbGRlciddLFxufTtcblxuLy8gQWRkIGhlcmUgdGhlIGVuZHBvaW50cyBmb3IgTVMgR3JhcGggQVBJIHNlcnZpY2VzIHlvdSB3b3VsZCBsaWtlIHRvIHVzZS5cbmV4cG9ydCBjb25zdCBncmFwaENvbmZpZyA9IHtcbiAgZ3JhcGhNZUVuZHBvaW50OiAnaHR0cHM6Ly9ncmFwaC5taWNyb3NvZnQuY29tL3YxLjAvbWUnLFxufTtcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgZGlhbG9nLCBzY3JlZW4gfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCdcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lXG5cblxuXG5jbGFzcyBXaW5kb3dIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmF1dGh3aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RTZXJ2ZXIgPSBudWxsXG4gICAgIFxuICBcbiAgICB9XG5cbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICB9XG5cblxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEyMDAsXG4gICAgICAgICAgICBoZWlnaHQ6OTIwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcImRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIm5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwidGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ0NhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBjcmVhdGVXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSB7IHdpZHRoOiA4MDAsIGhlaWdodDogODAwIH1cbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpXG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0tVGVhY2hlcicsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMmUyYzI5JyxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjogdHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDEyMDAsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IDgwMCxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSXG4gICAgICAgICAgICAgICAgICAgID8gcGF0aC5yZXNvbHZlKGN1cnJlbnREaXIsIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIChwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04gfHwgJy5janMnKSkpXG4gICAgICAgICAgICAgICAgICAgIDogam9pbihfX2Rpcm5hbWUsICcuLi9wcmVsb2FkL3ByZWxvYWQubWpzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgd2Vidmlld1RhZzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVXaW5kb3c6IGRpZC1maW5pc2gtbG9hZCAtIHNob3dpbmcgd2luZG93JylcbiAgICAgICAgICAgIGlmICh0aGlzLm1haW53aW5kb3cgJiYgIXRoaXMubWFpbndpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkIHx8IHByb2Nlc3MuZW52WydERUJVRyddKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vcmVuZGVyZXIvaW5kZXguaHRtbCcpXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogTG9hZGluZyBmaWxlOiAke2ZpbGVQYXRofWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZEZpbGUoZmlsZVBhdGgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBwcm9jZXNzLmVudi5BUFBfVVJMIHx8IGBodHRwOi8vJHtwcm9jZXNzLmVudlsnVklURV9ERVZfU0VSVkVSX0hPU1QnXSB8fCAnbG9jYWxob3N0J306JHtwcm9jZXNzLmVudlsnVklURV9ERVZfU0VSVkVSX1BPUlQnXSB8fCAnOTMwMCd9YFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVXaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZXNzaW9uLnNldENlcnRpZmljYXRlVmVyaWZ5UHJvYygocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgIHZhciB7IGhvc3RuYW1lLCBjZXJ0aWZpY2F0ZSwgdmFsaWRhdGVkQ2VydGlmaWNhdGUsIHZlcmlmaWNhdGlvblJlc3VsdCwgZXJyb3JDb2RlIH0gPSByZXF1ZXN0O1xuICAgICAgICAgICAgY2FsbGJhY2soMCk7XG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICBcbiAgICAgICAgLy8gU2hvdyB3aW5kb3cgZXZlbiBpZiBsb2FkaW5nIGZhaWxzIChFbGVjdHJvbiAzOSBjb21wYXRpYmlsaXR5KVxuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSkgPT4ge1xuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVXaW5kb3c6IGRpZC1mYWlsLWxvYWQgLSBFcnJvciAke2Vycm9yQ29kZX06ICR7ZXJyb3JEZXNjcmlwdGlvbn0gZm9yIFVSTDogJHt2YWxpZGF0ZWRVUkx9YClcbiAgICAgICAgICAgIC8vIFN0aWxsIHNob3cgdGhlIHdpbmRvdyBldmVuIGlmIGxvYWRpbmcgZmFpbGVkXG4gICAgICAgICAgICBpZiAodGhpcy5tYWlud2luZG93ICYmICF0aGlzLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogU2hvd2luZyB3aW5kb3cgYWZ0ZXIgZGlkLWZhaWwtbG9hZCcpXG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LnNob3coKVxuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICAvLyBCbG9jayBuYXZpZ2F0aW9uIG9uIG1haW53aW5kb3cud2ViQ29udGVudHMgdG8gYXZvaWQgYW55IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBhcHAgZXhjZXB0IGZvciBpbnRlcm5hbCBsaW5rc1xuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gUHJldmVudCBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgYXBwXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgLy8gUHJldmVudCBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvL2FzayBiZWZvcmUgY2xvc2luZ1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiB0aGlzLm1haW53aW5kb3c/LndlYkNvbnRlbnRzLmdldFVSTCgpLmluY2x1ZGVzKFwiZGFzaGJvYXJkXCIpKSB7XG4gICAgICAgICAgICAgICAgLy8gZG8gbm90IGNsb3NlIGEgcnVubmluZyBleGFtIGJ5IGFjY2lkZW50IFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNsb3NlOiBkbyBub3QgY2xvc2UgcnVubmluZyBleGFtIHRoaXMgd2F5XCIpOyBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveFN5bmModGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJywgXG4gICAgICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snXSwgLy8gTnVyIGVpbiBCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdElkOiAwLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1ByXHUwMEZDZnVuZyBsXHUwMEU0dWZ0JyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0JlZW5kZW4gU2llIHp1ZXJzdCBkaWUgbGF1ZmVuZGUgUHJcdTAwRkNmdW5nISdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgICAgICAgICBwcm9jZXNzLmV4aXQoMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogTWljcm9zb2Z0IDM2NSBBdXRoIFdpbmRvdyBcbiAgICAgKi9cbiAgICBjcmVhdGVNc2F1dGhXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKVxuICAgICAgICB0aGlzLmF1dGh3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIGNlbnRlcjogdHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnT0F1dGgnLFxuICAgICAgICAgICAgd2lkdGg6IDUwMCxcbiAgICAgICAgICAgIGhlaWdodDogODAwLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSXG4gICAgICAgICAgICAgICAgICAgID8gcGF0aC5yZXNvbHZlKGN1cnJlbnREaXIsIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIChwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04gfHwgJy5janMnKSkpXG4gICAgICAgICAgICAgICAgICAgIDogam9pbihfX2Rpcm5hbWUsICcuLi9wcmVsb2FkL3ByZWxvYWQubWpzJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICBcbiAgICAgICAgbGV0IHVybCA9IGBodHRwczovL2xvY2FsaG9zdDoyMjQyMi9zZXJ2ZXIvY29udHJvbC9vYXV0aGBcbiAgICAgICAgdGhpcy5hdXRod2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuYXV0aHdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5hdXRod2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmF1dGh3aW5kb3cgJiYgIXRoaXMuYXV0aHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXV0aHdpbmRvdy5yZW1vdmVNZW51KCkgXG4gICAgICAgICAgICAgICAgdGhpcy5hdXRod2luZG93LnNldE1pbmltaXphYmxlKGZhbHNlKVxuICAgICAgICAgICAgICAgIHRoaXMuYXV0aHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IFdpbmRvd0hhbmRsZXIoKVxuICIsICJcbi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IFJvdXRlciB9IGZyb20gJ2V4cHJlc3MnXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKVxuaW1wb3J0IHBhdGggIGZyb20gJ3BhdGgnXG5pbXBvcnQgY29uZmlnIGZyb20gJy4uLy4uLy4uLy4uL21haW4vY29uZmlnLmpzJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbmNvbnN0IHsgdCB9ID0gaTE4bi5nbG9iYWxcbmltcG9ydCBhcmNoaXZlciBmcm9tICdhcmNoaXZlcidcbmltcG9ydCB7IFBERkRvY3VtZW50LCByZ2IgfSBmcm9tICdwZGYtbGliL2Rpc3QvcGRmLWxpYi5qcycgIC8vIHdlIGltcG9ydCB0aGUgY29tcGxpZWQgdmVyc2lvbiBvdGhlcndpc2Ugd2UgZ2V0IDEwMDAgc291cmNlbWFwIHdhcm5pbmdzXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgbW9tZW50IGZyb20gJ21vbWVudCc7XG5pbXBvcnQgcGRmIGZyb20gJ0BiaW5nc2pzL3BkZi1wYXJzZSc7XG5cblxuLyoqXG4gKiBHRVQgYSBGSUxFLUxJU1QgZnJvbSB3b3JrZGlyZWN0b3J5XG4gKi8gXG4gcm91dGVyLnBvc3QoJy9nZXRmaWxlcy86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgZGlyID1yZXEuYm9keS5kaXJcbiAgICBcbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgXG4gICAgbGV0IGZvbGRlcnMgPSBbXVxuICAgIGZvbGRlcnMucHVzaCgge2N1cnJlbnRkaXJlY3Rvcnk6IGRpciwgcGFyZW50ZGlyZWN0b3J5OiBwYXRoLmRpcm5hbWUoZGlyKX0pIC8vIHNvIHRoaXMgaW5mb3JtYXRpb24gaXMgYWx3YXlzIG9uIGZpbGVsaXN0WzBdID4+IG5vdCB0aGUgbW9zdCByb2J1c3QgaWRlYSBidXQgdXNlZCBpbiBmaWxlZXhwbG9yZXIgLSBiZSBjYXJlZnVsXG4gICAgXG4gICAgY29uc3Qgb21pdEV4dGVuc2lvbnMgPSBbJy5qc29uJ107ICAgLy8gdGhlc2UgZmlsZXR5cGVzIGFyZSBub3QgcGFydCBvZiB0aGUgZmlsZWxpc3Qgc2VudCB0byB0aGUgZnJvbnRlbmQgKHVzZWQgdG8gZGlzcGxheSB0aGUgdXNlciBkaXJlY3RvcmllcyBpbiB0aGUgZmlsZWV4cGxvcmVyIHBhcnQgb2YgdGhlIGRhc2hib2FyZClcbiAgICBcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcihkaXIpO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVwYXRoID0gcGF0aC5qb2luKGRpciwgZmlsZSk7XG4gICAgICAgICAgICBsZXQgZXh0ID0gcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgICBmb2xkZXJzLnB1c2goeyBwYXRoOiBmaWxlcGF0aCwgbmFtZTogZmlsZSwgdHlwZTogXCJkaXJcIiwgZXh0OiBcIlwiLCBwYXJlbnQ6IGRpciB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoc3RhdHMuaXNGaWxlKCkgJiYgIW9taXRFeHRlbnNpb25zLmluY2x1ZGVzKGV4dCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9sZGVycy5wdXNoKHsgcGF0aDogZmlsZXBhdGgsIG5hbWU6IGZpbGUsIHR5cGU6IFwiZmlsZVwiLCBleHQ6IGV4dCwgcGFyZW50OiBkaXIgfSk7IC8vIEtvcnJpZ2llcnQgYHBhcmVudDogJydgIHp1IGBwYXJlbnQ6IGRpcmAgZlx1MDBGQ3IgS29uc2lzdGVuelxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGlubmVyRXJyKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVoYW5kZWxuIFNpZSBGZWhsZXIsIGRpZSB2b24gZnMucHJvbWlzZXMuc3RhdCBnZXdvcmZlbiB3ZXJkZW5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiZGF0YSBAIGdldGZpbGVzOiBGZWhsZXIgYmVpbSBadWdyaWZmIGF1ZiBEYXRlaSBvZGVyIFZlcnplaWNobmlzOiBcIiwgaW5uZXJFcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIEJlaGFuZGVsbiBTaWUgRmVobGVyLCBkaWUgdm9uIGZzLnByb21pc2VzLnJlYWRkaXIgZ2V3b3JmZW4gd2VyZGVuXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJkYXRhIEAgZ2V0ZmlsZXM6IEZlaGxlciBiZWltIExlc2VuIGRlcyBWZXJ6ZWljaG5pc3NlczogXCIsIGVycik7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiB0KFwiZGF0YS5maWxlZXJyb3JcIikgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXMuc2VuZCggZm9sZGVycyApXG59KVxuXG5cblxuXG5cbi8qKlxuICogQ1JFQVRFIENPTUJJTkVEIFBERiBTVEFSVCA+Pj4+Pj4+Pj4+Pj4+Pj4+Pj5cbiAqL1xuXG5cblxuLyoqXG4gKiBHRVQgYSBsYXRlc3Qgd29yayBmcm9tIGFsbCBzdHVkZW50c1xuICogVGhpcyBBUEkgUm91dGUgY3JlYXRlcyBhIGxpc3Qgb2YgdGhlIGxhdGVzdCBwZGYgZmlsZXBhdGhzIG9mIGFsbCBjb25uZWN0ZWQgc3R1ZGVudHNcbiAqIGFuZCBjb25jYXRzIGVhY2ggb2YgdGhlIHBkZnMgdG8gb25lXG4gKi8gXG4gcm91dGVyLnBvc3QoJy9nZXRsYXRlc3QvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IHN1Ym1pc3Npb25zID0gcmVxLmJvZHkuc3VibWlzc2lvbnNcbiAgICBsZXQgd2FybmluZyA9IGZhbHNlXG5cbiAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGEgbGVnaXQgY2FsbCBmcm9tIHRoZSB0ZWFjaGVyIGZyb250ZW5kXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cblxuXG4gICAgICAgXG5cbiAgICAvL2NyZWF0ZSBhcnJheSB0aGF0IGNvbnRhaW5zIG9ubHkgZmlsZXBhdGhzXG4gICAgLy8gd2UgaXRlcmF0ZSBvdmVyIHRoZSBzdWJtaXNzaW9ucyBhcnJheSBhbmQgZ2V0IHRoZSBsYXRlc3QgZmlsZXBhdGhzIGZvciBlYWNoIHNlY3Rpb25cbiAgICBsZXQgbGF0ZXN0RmlsZXMgPSBbXVxuICAgIGZvciAobGV0IHN0dWRlbnQgb2Ygc3VibWlzc2lvbnMpIHtcbiAgICAgICAgZm9yIChsZXQgc2VjdGlvbiA9IDE7IHNlY3Rpb24gPD0gNDsgc2VjdGlvbisrKSB7XG4gICAgICAgICAgICBpZiAoc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5wYXRoKXtcbiAgICAgICAgICAgICAgICBsYXRlc3RGaWxlcy5wdXNoKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zb2xlLmxvZyhcImRhdGEgQCBnZXRsYXRlc3Q6IGxhdGVzdEZpbGVzXCIsIGxhdGVzdEZpbGVzKVxuXG4gICAgLy8gbm93IGNyZWF0ZSBvbmUgbWVyZ2VkIHBkZiBvdXQgb2YgYWxsIGZpbGVzXG4gICAgaWYgKGxhdGVzdEZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oe3dhcm5pbmc6IHdhcm5pbmcsIHBkZkJ1ZmZlcjogbnVsbH0pXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBsZXQgaW5kZXhQREZkYXRhID0gYXdhaXQgY3JlYXRlSW5kZXhQREYoc3VibWlzc2lvbnMsIHNlcnZlcm5hbWUpICAgLy9jb250YWlucyB0aGUgaW5kZXggdGFibGUgcGRmIGFzIHVpbnQ4YXJyYXlcbiAgICAgICAgbGV0IGluZGV4UERGcGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLFwiaW5kZXgucGRmXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoaW5kZXhQREZwYXRoLCBpbmRleFBERmRhdGEpO1xuICAgICAgICAgICAgbG9nLmluZm8oJ2RhdGEgQCBnZXRsYXRlc3Q6IEluZGV4IFBERiBzYXZlZCBzdWNjZXNzZnVsbHkhJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtsb2cuZXJyb3IoXCJkYXRhIEAgZ2V0bGF0ZXN0OlwiLGVycil9XG4gICAgICAgIGxhdGVzdEZpbGVzLnVuc2hpZnQoaW5kZXhQREZwYXRoKVxuXG5cbiAgICAgICAgLy8gbm93IGNvbmNhdCB0aGUgcGRmcyBvZiBhbGwgc2VjdGlvbnMgdG8gb25lIGNvbWJpbmVkIHBkZlxuICAgICAgICBsZXQgUERGID0gYXdhaXQgY29uY2F0UGFnZXMobGF0ZXN0RmlsZXMpXG4gICAgICAgIGxldCBwZGZCdWZmZXIgPSBCdWZmZXIuZnJvbShQREYpIFxuICAgICAgICBsZXQgcGRmUGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLFwiY29tYmluZWQucGRmXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUocGRmUGF0aCwgcGRmQnVmZmVyKTtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdkYXRhIEAgZ2V0bGF0ZXN0OiBQREYgc2F2ZWQgc3VjY2Vzc2Z1bGx5IScpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7bG9nLmVycm9yKFwiZGF0YSBAIGdldGxhdGVzdDpcIixlcnIpfVxuICAgICAgICByZXR1cm4gcmVzLmpzb24oe3dhcm5pbmc6IHdhcm5pbmcsIHBkZkJ1ZmZlcjpwZGZCdWZmZXIsIHBkZlBhdGg6cGRmUGF0aCB9KTtcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5mdW5jdGlvbiBpc1ZhbGlkUGRmKGRhdGEpIHtcbiAgICBjb25zdCBoZWFkZXIgPSBuZXcgVWludDhBcnJheShkYXRhLCAwLCA1KTsgLy8gTGVzZSBkaWUgZXJzdGVuIDUgQnl0ZXMgZlx1MDBGQ3IgXCIlUERGLVwiXG4gICAgLy8gVW13YW5kbHVuZyBkZXIgQnl0ZXMgaW4gSGV4YWRlemltYWx3ZXJ0ZSBmXHUwMEZDciBkZW4gVmVyZ2xlaWNoXG4gICAgY29uc3QgcGRmSGVhZGVyID0gWzB4MjUsIDB4NTAsIDB4NDQsIDB4NDYsIDB4MkRdOyAvLyBcIiVQREYtXCIgaW4gSGV4XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwZGZIZWFkZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGhlYWRlcltpXSAhPT0gcGRmSGVhZGVyW2ldKSB7XG4gICAgICAgICAgICBsb2cud2FybignZGF0YSBAIGlzVmFsaWRQZGY6IGludmFsaWQgUERGIHByb2Nlc3NlZCcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIEZyXHUwMEZDaGVyIEFiYnJ1Y2gsIHdlbm4gZWluIEJ5dGUgbmljaHQgXHUwMEZDYmVyZWluc3RpbW10XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7IC8vIEFsbGUgQnl0ZXMgc3RpbW1lbiBtaXQgZGVtIFBERi1IZWFkZXIgXHUwMEZDYmVyZWluXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvdW50Q2hhcnNPZlBERihwZGZQYXRoLCBzdHVkZW50bmFtZSwgc2VydmVybmFtZSl7XG4gICAgY29uc3QgZGF0YUJ1ZmZlciA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKHBkZlBhdGgpOy8vIFJlYWQgdGhlIFBERiBmaWxlXG4gICAgbGV0IGNoYXJzID0gMCBcblxuICAgIGlmIChpc1ZhbGlkUGRmKGRhdGFCdWZmZXIpKXtcbiAgICAgICAgY2hhcnMgPSBhd2FpdCBwZGYoZGF0YUJ1ZmZlcikudGhlbiggZGF0YSA9PiB7ICAgIC8vIFBhcnNlIHRoZSBQREYgIC8vIGRhdGEudGV4dCBjb250YWlucyBhbGwgdGhlIHRleHQgZXh0cmFjdGVkIGZyb20gdGhlIFBERlxuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS50ZXh0ICYmIHN0dWRlbnRuYW1lKSB7ICAgXG4gICAgICAgICAgICAgICAgbGV0IG51bWJlck9mQ2hhcmFjdGVycyA9IGRhdGEudGV4dC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhgTnVtYmVyIG9mIGNoYXJhY3RlcnMgaW4gdGhlIFBERjogJHtudW1iZXJPZkNoYXJhY3RlcnN9YCwgc3R1ZGVudG5hbWUsIHNlcnZlcm5hbWUpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGhlYWRlciA9IGAgJHtzZXJ2ZXJuYW1lfSB8IDEwLjEwLjI0LCAxMDoxMCBgXG4gICAgICAgICAgICAgICAgbGV0IGZvb3RlciA9IGAgWmVpY2hlbjogMTAgfCBXXHUwMEY2cnRlcjogMTAgIDEvMSBgICAgLy9hcHByb3hpbWF0ZWx5XG5cbiAgICAgICAgICAgICAgICBudW1iZXJPZkNoYXJhY3RlcnMgPSBudW1iZXJPZkNoYXJhY3RlcnMgLy8gLSBoZWFkZXIubGVuZ3RoIC0gc3R1ZGVudG5hbWUubGVuZ3RoIC0gZm9vdGVyLmxlbmd0aCAvLyAtNSBmb3IgYXZlcmFnZSBuYW1lIGxlbmd0aCAgLy8gZlx1MDBGQ3IgbXN3b3JkIG9wdGlvbiAtIGhpZXIgZ2lidHMga2VpbmVuIGhlYWRlclxuXG5cbiAgICAgICAgICAgICAgICAvL3dlIHRyeSB0byBmaWx0ZXIgb3V0IHRoZSBpbXBvcnRhbnQgcGFydCBvZiB0aGUgZG9jdW1lbnQgdGhhdCBzaG93cyB0aGUgYWN0dWFsIG51bWJlciBvZiBjaGFyc1xuICAgICAgICAgICAgICAgIGxldCByZWdleCA9IC9aZWljaGVuOiAoXFxkKykvO1xuICAgICAgICAgICAgICAgIGxldCBtYXRjaGVzID0gZGF0YS50ZXh0Lm1hdGNoKHJlZ2V4KTtcbiAgICAgICAgICAgICAgICBsZXQgemVpY2hlbkFuemFobCA9IG1hdGNoZXMgPyBtYXRjaGVzWzFdIDogXCJub3Rmb3VuZFwiO1xuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHplaWNoZW5BbnphaGwgIT09IFwibm90Zm91bmRcIil7ICAgLy93ZSBmb3VuZCBpdCAhXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZWljaGVuQW56YWhsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZWdleCA9IC9aZWljaGVuOihcXGQrKS87ICAvL3RyeSBzbGlnaHRseSBkaWZmZXJlbnQgcmVnZXggYmVjYXVzZSBzb21lIHBkZnMgKHByb2JhYmx5IGZyb20gbWFjKSByZW1vdmUgc3BhY2VzIHdoZW4gcmVhZFxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzID0gZGF0YS50ZXh0Lm1hdGNoKHJlZ2V4KTtcbiAgICAgICAgICAgICAgICAgICAgemVpY2hlbkFuemFobCA9IG1hdGNoZXMgPyBtYXRjaGVzWzFdIDogXCJub3Rmb3VuZFwiO1xuICAgICAgICAgICAgICAgICAgICBpZiAoemVpY2hlbkFuemFobCAhPT0gXCJub3Rmb3VuZFwiKXsgIC8vIG5vdyB3ZSBmb3VuZCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHplaWNoZW5BbnphaGxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEudGV4dClcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudW1iZXJPZkNoYXJhY3RlcnMgPj0gMCA/IGB+ICR7bnVtYmVyT2ZDaGFyYWN0ZXJzfWAgOiAnfiAwJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAwXG4gICAgICAgICAgICB9XG4gICAgXG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge2xvZy5lcnJvcihgZGF0YSBAIGNvdW50Q2hhcnNPZlBERjogJHtlcnJ9YCk7IHJldHVybiAwICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNoYXJzID0gXCJubyBwZGZcIlxuICAgIH1cbiBcbiAgICByZXR1cm4gY2hhcnMgXG59XG5cblxuXG5cblxuXG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUluZGV4UERGKHN1Ym1pc3Npb25zLCBzZXJ2ZXJuYW1lKXtcbiAgICBsZXQgdGFibGVkYXRhID0gW1tcIk5hbWVcIiwgXCJBYnNjaG5pdHRcIiwgXCJEYXR1bVwiLCBcIlplaWNoZW5cIiwgXCJEYXRlaW5hbWVcIl1dXG4gICAgZm9yIChjb25zdCBzdHVkZW50IG9mIHN1Ym1pc3Npb25zKXtcbiAgICAgICAgbGV0IGhhc1N1Ym1pc3Npb24gPSBmYWxzZSAvLyB0cmFjayBpZiBzdHVkZW50IGhhcyBhdCBsZWFzdCBvbmUgc3VibWlzc2lvblxuICAgICAgICBjb25zdCB0cmltbWVkTmFtZSA9IHN0dWRlbnQuc3R1ZGVudE5hbWUubGVuZ3RoID4gMjAgPyBzdHVkZW50LnN0dWRlbnROYW1lLnNsaWNlKDAsIDIwKSArIFwiLi4uXCIgOiBzdHVkZW50LnN0dWRlbnROYW1lXG4gICAgICAgIGZvciAobGV0IHNlY3Rpb24gPSAxOyBzZWN0aW9uIDw9IDQ7IHNlY3Rpb24rKykge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSBcIi1cIlxuICAgICAgICAgICAgbGV0IHNlY3Rpb25OYW1lID0gXCItXCJcbiAgICAgICAgICAgIGxldCB0aW1lID0gXCItXCJcbiAgICAgICAgICAgIGxldCBjaGFycyA9IFwiMFwiXG4gICAgICAgICAgICBsZXQgZmlsZW5hbWUgPSBcIi1cIlxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5wYXRoKXtcbiAgICAgICAgICAgICAgICBuYW1lID0gdHJpbW1lZE5hbWU7XG4gICAgICAgICAgICAgICAgc2VjdGlvbk5hbWUgPSBzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnNlY3Rpb25uYW1lIHx8IGBBYnNjaG5pdHQgJHtzZWN0aW9ufWBcbiAgICAgICAgICAgICAgICBzZWN0aW9uTmFtZSA9IHNlY3Rpb25OYW1lLmxlbmd0aCA+IDIwID8gc2VjdGlvbk5hbWUuc2xpY2UoMCwgMjApICsgXCIuLi5cIiA6IHNlY3Rpb25OYW1lO1xuICAgICAgICAgICAgICAgIHRpbWUgPSBtb21lbnQoc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5kYXRlKS5mb3JtYXQoJ0RELk1NLllZWVkgSEg6bW0nKVxuICAgICAgICAgICAgICAgIGNoYXJzID0gYXdhaXQgY291bnRDaGFyc09mUERGKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aCwgc3R1ZGVudC5zdHVkZW50TmFtZSwgc2VydmVybmFtZSlcbiAgICAgICAgICAgICAgICBmaWxlbmFtZSA9IHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uZmlsZW5hbWUubGVuZ3RoID4gMjUgPyBzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLmZpbGVuYW1lLnNsaWNlKDAsIDI1KSArIFwiLi4uXCIgOiBzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLmZpbGVuYW1lIDtcbiAgICAgICAgICAgICAgICB0YWJsZWRhdGEucHVzaChbIG5hbWUsIHNlY3Rpb25OYW1lLCB0aW1lLCBjaGFycywgZmlsZW5hbWUgXSlcbiAgICAgICAgICAgICAgICBoYXNTdWJtaXNzaW9uID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghaGFzU3VibWlzc2lvbikge1xuICAgICAgICAgICAgdGFibGVkYXRhLnB1c2goWyB0cmltbWVkTmFtZSwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiBdKVxuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHBkZkRvYyA9IGF3YWl0IFBERkRvY3VtZW50LmNyZWF0ZSgpOy8vIENyZWF0ZSBhIG5ldyBQREZEb2N1bWVudFxuICAgIGNvbnN0IHBhZ2UgPSBwZGZEb2MuYWRkUGFnZSgpOyAvLyBBZGQgYSBwYWdlIHRvIHRoZSBkb2N1bWVudFxuXG4gICAgLy8gU2V0IHVwIHRhYmxlIGRpbWVuc2lvbnMgYW5kIHN0eWxlc1xuICAgIGNvbnN0IHN0YXJ0WCA9IDUwOyAvLyBYLWNvb3JkaW5hdGUgd2hlcmUgdGhlIHRhYmxlIHN0YXJ0c1xuICAgIGNvbnN0IHN0YXJ0WSA9IHBhZ2UuZ2V0SGVpZ2h0KCkgLSA1MDsgLy8gWS1jb29yZGluYXRlIHdoZXJlIHRoZSB0YWJsZSBzdGFydHMgKGZyb20gdG9wKVxuICAgIGNvbnN0IHJvd0hlaWdodCA9IDE1OyAvLyBIZWlnaHQgb2YgZWFjaCByb3cgKHJlZHVjZWQgZm9yIHNtYWxsZXIgZm9udCBzaXplKVxuICAgIGNvbnN0IGNvbHVtbldpZHRocyA9IFsxMTAsIDEzMCwgODAsIDQwLCAxNDBdOyAvLyBXaWR0aCBvZiBlYWNoIGNvbHVtbjogTmFtZSwgQWJzY2huaXR0LCBEYXR1bSwgWmVpY2hlbiwgRGF0ZWluYW1lXG5cbiAgICAvLyBGdW5jdGlvbiB0byBkcmF3IGEgY2VsbFxuICAgIGNvbnN0IGRyYXdDZWxsID0gKHgsIHksIHdpZHRoLCBoZWlnaHQpID0+IHsgcGFnZS5kcmF3UmVjdGFuZ2xlKHsgeCwgeSwgd2lkdGgsIGhlaWdodCwgYm9yZGVyQ29sb3I6IHJnYigwLCAwLCAwKSwgIGJvcmRlcldpZHRoOiAxLCAgfSk7ICB9O1xuICAgIC8vIEZ1bmN0aW9uIHRvIGFkZCB0ZXh0IHRvIGEgY2VsbFxuICAgIGNvbnN0IGFkZFRleHQgPSAodGV4dCwgeCwgeSkgPT4geyAgdGV4dCA9IFN0cmluZyh0ZXh0KTsgICAgcGFnZS5kcmF3VGV4dCh0ZXh0LCB7IHgsIHksIHNpemU6IDksIGNvbG9yOiByZ2IoMCwgMCwgMCksICB9KTsgIH07XG5cbiAgICB0YWJsZWRhdGEuZm9yRWFjaCgocm93LCByb3dJbmRleCkgPT4ge1xuICAgICAgICBjb25zdCB5UG9zID0gc3RhcnRZIC0gcm93SW5kZXggKiByb3dIZWlnaHQ7IC8vIENhbGN1bGF0ZSBZIHBvc2l0aW9uIGZvciB0aGUgY3VycmVudCByb3dcbiAgICAgICAgcm93LmZvckVhY2goKGNlbGxUZXh0LCBjb2x1bW5JbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgeFBvcyA9IHN0YXJ0WCArIGNvbHVtbldpZHRocy5zbGljZSgwLCBjb2x1bW5JbmRleCkucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjICsgdmFsLCAwKTsgLy8gQ2FsY3VsYXRlIFggcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IGNlbGxcbiAgICAgICAgICAgIGRyYXdDZWxsKHhQb3MsIHlQb3MgLSByb3dIZWlnaHQsIGNvbHVtbldpZHRoc1tjb2x1bW5JbmRleF0sIHJvd0hlaWdodCk7XG4gICAgICAgICAgICBhZGRUZXh0KGNlbGxUZXh0LCB4UG9zICsgMywgeVBvcyAtIHJvd0hlaWdodCArIDQpOyAvLyBBZGp1c3QgdGV4dCBwb3NpdGlvbiB3aXRoaW4gdGhlIGNlbGwgKHJlZHVjZWQgcGFkZGluZyBmb3Igc21hbGxlciByb3cgaGVpZ2h0KVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICAvLyBTZXJpYWxpemUgdGhlIFBERkRvY3VtZW50IHRvIGJ5dGVzIChhIFVpbnQ4QXJyYXkpXG4gICAgY29uc3QgcGRmQnl0ZXMgPSBhd2FpdCBwZGZEb2Muc2F2ZSgpO1xuICAgIHJldHVybiBwZGZCeXRlcyBcbn1cblxuXG4vKipcbiAqIENSRUFURSBDT01CSU5FRCBQREYgRU5EID4+Pj4+Pj4+Pj4+Pj4+Pj4+PlxuICovXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuYXN5bmMgZnVuY3Rpb24gY29uY2F0UGFnZXMocGRmc1RvTWVyZ2UpIHtcbiAgICAvLyBDcmVhdGUgYSBuZXcgUERGRG9jdW1lbnRcbiAgICBjb25zdCB0ZW1wUERGID0gYXdhaXQgUERGRG9jdW1lbnQuY3JlYXRlKCk7XG4gICAgZm9yIChjb25zdCBwZGZwYXRoIG9mIHBkZnNUb01lcmdlKSB7IFxuICAgICAgICBsZXQgcGRmQnl0ZXMgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShwZGZwYXRoKTtcbiAgICAgICAgLy9jaGVjayBpZiB0aGlzIGFjdHVhbGx5IGlzIGEgcGRmXG4gICAgICAgIGlmIChpc1ZhbGlkUGRmKHBkZkJ5dGVzKSl7XG4gICAgICAgICAgICBjb25zdCBwZGYgPSBhd2FpdCBQREZEb2N1bWVudC5sb2FkKHBkZkJ5dGVzKTsgXG4gICAgICAgICAgICBjb25zdCBjb3BpZWRQYWdlcyA9IGF3YWl0IHRlbXBQREYuY29weVBhZ2VzKHBkZiwgcGRmLmdldFBhZ2VJbmRpY2VzKCkpO1xuICAgICAgICAgICAgY29waWVkUGFnZXMuZm9yRWFjaCgocGFnZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRlbXBQREYuYWRkUGFnZShwYWdlKTsgXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgIH1cbiAgICAgICBcbiAgICB9IFxuICAgIC8vIFNlcmlhbGl6ZSB0aGUgUERGRG9jdW1lbnQgdG8gYnl0ZXMgKGEgVWludDhBcnJheSlcbiAgICBjb25zdCBmaW5hbFBERiA9IGF3YWl0IHRlbXBQREYuc2F2ZSgpXG4gICAgcmV0dXJuIGZpbmFsUERGXG59XG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBERUxFVEUgRmlsZSBmcm9tIEVYQU0gZGlyZWN0b3J5XG4gKi8gXG4gcm91dGVyLnBvc3QoJy9kZWxldGUvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG5cbiAgXG4gICAgY29uc3QgZmlsZXBhdGggPSByZXEuYm9keS5maWxlcGF0aFxuICAgIGlmIChmaWxlcGF0aCkgeyAvL3JldHVybiBzcGVjaWZpYyBmaWxlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnByb21pc2VzLnN0YXQoZmlsZXBhdGgpO1xuICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpe1xuICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLnJtKGZpbGVwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoZmlsZXBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5mZGVsZXRlZFwiKSwgIH0pXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiZGF0YSBAIGRlbGV0ZTpcIiwgZXJyKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVlcnJvclwiKSB9KVxuICAgICAgICB9XG4gICAgfVxufSlcblxuXG5cblxuXG4vKipcbiAqIEdFVCBQREYgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICovIFxuXG5yb3V0ZXIucG9zdCgnL2dldHBkZi86c2VydmVybmFtZS86dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCB7IHRva2VuLCBzZXJ2ZXJuYW1lIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdO1xuXG4gICAgLy8gUHJcdTAwRkNmZW4sIG9iIG1jU2VydmVyIGV4aXN0aWVydCB1bmQgZGVyIFRva2VuIFx1MDBGQ2JlcmVpbnN0aW1tdFxuICAgIGlmICghbWNTZXJ2ZXIgfHwgdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8/LnNlcnZlcnRva2VuKSB7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGZpbGVuYW1lIH0gPSByZXEuYm9keTtcbiAgICBpZiAoZmlsZW5hbWUpIHtcbiAgICAgICAgcmVzLnNlbmRGaWxlKGZpbGVuYW1lLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLmZpbGVlcnJvclwiKSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQW50d29ydCwgZmFsbHMga2VpbiBEYXRlaW5hbWUgYW5nZWdlYmVuIHd1cmRlXG4gICAgICAgIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS5maWxlZXJyb3JcIikgfSk7XG4gICAgfVxufSk7XG5cblxuXG5cblxuXG4vKipcbiAqIEdFVCBBTlkgRmlsZS9Gb2xkZXIgZnJvbSBFWEFNIGRpcmVjdG9yeSAtIGRvd25sb2FkICFcbiAqIENhbiBiZSB0cmlnZ2VyZWQgYnkgVEVBQ0hFUiAoZGFzaGJvYXJkIGV4cGxvcmVyKSBvciBTVFVERU5UIChmaWxlcmVxdWVzdClcbiAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAqLyBcbiByb3V0ZXIucG9zdCgnL2Rvd25sb2FkLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCB0eXBlID0gcmVxLmJvZHkudHlwZSAgLy8gZmlsZSwgZGlyLCBzdHVkZW50ZmlsZXJlcXVlc3RcbiAgICBjb25zdCBmaWxlbmFtZSA9IHJlcS5ib2R5LmZpbGVuYW1lXG4gICAgY29uc3QgZmlsZXBhdGggPSByZXEuYm9keS5wYXRoXG4gICAgY29uc3QgZmlsZXMgPSByZXEuYm9keS5maWxlcyAgLy8gaW4gY2FzZSBvZiBzdHVkZW50ZmlsZXJlcXVlc3QgJ2ZpbGVzJyBpcyBhbiBhcnJheSBvZiBmaWxlb2JqZWN0cyBbIHtuYW1lOmZpbGUubmFtZSwgcGF0aDpmaWxlLnBhdGggfSwge25hbWU6ZmlsZS5uYW1lLCBwYXRoOmZpbGUucGF0aCB9IF0gXG5cbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICYmICFjaGVja1Rva2VuKHRva2VuLCBtY1NlcnZlciApKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG4gICBcblxuICAgXG4gICAgaWYgKHR5cGUgPT09IFwic3R1ZGVudGZpbGVyZXF1ZXN0XCIpIHtcbiAgICAgICAgLy8gaWYgdGhpcyByZXF1ZXN0IGNhbWUgZnJvbSBhIHN0dWRlbnQgcmVzZXQgc3R1ZGVudHN0YXR1c1xuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSB0b2tlbikgLy8gZ2V0IHN0dWRlbnQgZnJvbSB0b2tlblxuICAgICAgICBpZiAoc3R1ZGVudCkgeyAgXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddID0gZmFsc2UgIC8vcmVzZXQgZmlsZXJlcXVlc3Qgc3RhdHVzIGZvciBzdHVkZW50IC8vIGl0IGlzIHRoZW9yZXRpY2FsbHkgcG9zc2libGUgdGhhdCB0aGUgY2xpZW50IHNlbmRzIGEgc2Vjb25kIGZpbGUgcmVxdWVzdCBhbmQgZmV0Y2hlcyB0aGUgZmlsZSB0d2ljZSBiZWZvcmUgdGhpcyBzZXR0aW5nIGlzIHJlc2V0IGJ1dCBpIGd1ZXNzIHRoaXMgZG9lbid0IHJlYWxseSBtYXR0ZXJcbiAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gW10gICAgICAgICAgLy8gdGhlcmVyIGlzIG5vIGNvbnRyb2wgc3lzdGVtIGluIHBsYWNlIHRvIHJlLWNoZWNrIGlmIHRoZSBmaWxlIHdhcyBhY3R1YWxseSByZWNlaXZlZFxuICAgICAgICAgICAgcmVzLnppcCh7ZmlsZXM6IGZpbGVzfSk7ICBcbiAgICAgICAgfSBcbiAgICB9ICBcbiAgICBlbHNlIGlmICh0eXBlID09PSBcImZpbGVcIikge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsICdhdHRhY2htZW50OyBmaWxlbmFtZT0nICsgZmlsZW5hbWUpO1xuICAgICAgICAgICAgcmVzLmRvd25sb2FkKGZpbGVwYXRoKTsgIFxuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlID09PSBcImRpclwiKSB7XG4gICAgICAgIC8vemlwIGZvbGRlciBhbmQgdGhlbiBzZW5kXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IGZpbGVuYW1lLmNvbmNhdCgnLnppcCcpXG4gICAgICAgIGxldCB6aXBmaWxlcGF0aCA9IHBhdGguam9pbihjb25maWcudGVtcGRpcmVjdG9yeSwgemlwZmlsZW5hbWUpO1xuICAgICAgICBhd2FpdCB6aXBEaXJlY3RvcnkoZmlsZXBhdGgsIHppcGZpbGVwYXRoKVxuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LWRpc3Bvc2l0aW9uJywgJ2F0dGFjaG1lbnQ7IGZpbGVuYW1lPScgKyBmaWxlbmFtZSk7XG4gICAgICAgIHJlcy5kb3dubG9hZCh6aXBmaWxlcGF0aCxmaWxlbmFtZSk7IFxuICAgIH1cbiBcbn0pXG5cblxuXG5cblxucm91dGVyLnBvc3QoJy9nZXRleGFtbWF0ZXJpYWxzLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBncm91cCA9IHJlcS5ib2R5Lmdyb3VwXG5cbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICYmICFjaGVja1Rva2VuKHRva2VuLCBtY1NlcnZlciApKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG4gICBcblxuICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHRva2VuKSAvLyBnZXQgc3R1ZGVudCBmcm9tIHRva2VuXG4gICAgaWYgKHN0dWRlbnQpIHsgIFxuXG4gICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSBtY1NlcnZlci5zZXJ2ZXJzdGF0dXNcbiAgICAgICAgbGV0IGV4YW1TZWN0aW9uID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl1cbiAgICAgICAgbGV0IGdyb3VwQSA9IGV4YW1TZWN0aW9uLmdyb3VwQVxuICAgICAgICBsZXQgZ3JvdXBCID0gZXhhbVNlY3Rpb24uZ3JvdXBCXG4gICAgXG4gICAgICAgIGxldCBtYXRlcmlhbHMgPSBbXVxuICAgICAgICBsZXQgYWxsb3dlZFVybHMgPSBbXVxuICAgICAgICBpZiAoZ3JvdXAgPT09IFwiYVwiKSB7XG4gICAgICAgICAgICBtYXRlcmlhbHMgPSBncm91cEEuZXhhbUluc3RydWN0aW9uRmlsZXNcbiAgICAgICAgICAgIGFsbG93ZWRVcmxzID0gZ3JvdXBBLmFsbG93ZWRVcmxzXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZ3JvdXAgPT09IFwiYlwiKSB7XG4gICAgICAgICAgICBtYXRlcmlhbHMgPSBncm91cEIuZXhhbUluc3RydWN0aW9uRmlsZXNcbiAgICAgICAgICAgIGFsbG93ZWRVcmxzID0gZ3JvdXBCLmFsbG93ZWRVcmxzXG4gICAgICAgIH1cblxuXG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1hdGVyaWFsczogbWF0ZXJpYWxzLCBhbGxvd2VkVXJsczogYWxsb3dlZFVybHMgIH0pXG4gICAgfSBcbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSAgfSlcbiAgICB9XG4gICAgXG5cbiBcbn0pXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogU3RvcmVzIGZpbGUocykgdG8gdGhlIHdvcmtkaXJlY3RvcnkgKGZpbGVzIGNvbWluZyBGUk9NIENMSUVOVFMgKEJBQ0tVUFMpIClcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIC0gdGhpcyBoYXMgdG8gYmUgdmFsaWQgKGNvbWluZyBmcm9tIGEgcmVnaXN0ZXJlZCB1c2VyKSBcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBzZXJ2ZXItZXhhbSBpbnN0YW5jZSB0aGUgc3R1ZGVudHMgdG9rZW4gYmVsb25ncyB0b1xuICogaW4gb3JkZXIgdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCAtIERPIE5PVCBTVE9SRSBGSUxFUyBDT01JTkcgZnJvbSBhbnl3aGVyZS4uIGFsd2F5cyBjaGVjayBpZiB0b2tlbiBiZWxvbmdzIHRvIGEgcmVnaXN0ZXJlZCBzdHVkZW50IChvciBzZXJ2ZXIpXG4gKi9cbiByb3V0ZXIucG9zdCgnL3JlY2VpdmUvOnNlcnZlcm5hbWUvOnN0dWRlbnR0b2tlbicsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4geyAgXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgeyBmaWxlLCBmaWxlbmFtZSB9ID0gcmVxLmJvZHk7XG4gICAgY29uc3QgZmlsZUNvbnRlbnQgPSBCdWZmZXIuZnJvbShmaWxlLCAnYmFzZTY0Jyk7XG5cbiAgICBpZiAoICFjaGVja1Rva2VuKHN0dWRlbnR0b2tlbiwgbWNTZXJ2ZXIgKSApIHsgcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgIGVsc2Uge1xuICAgICAgICBsZXQgZXJyb3JzID0gMFxuICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBsZXQgdGltZSA9IG5vdy50b0xvY2FsZVRpbWVTdHJpbmcoJ2RlLURFJyk7ICAvL2NvbnZlcnQgdG8gbG9jYWxlIHN0cmluZyBvdGhlcndpc2UgdGhlIGZvbGRlcm5hbWVzIHdpbGwgYmUgY3JlYXRlZCBpbiBVVENcbiAgICAgICAgbGV0IHRpbWVzdHJpbmcgPSBTdHJpbmcodGltZSkucmVwbGFjZSgvOi9nLCBcIl9cIik7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB5ZWFyID0gbm93LmdldEZ1bGxZZWFyKCk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gU3RyaW5nKG5vdy5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKTsgLy8gTW9uYXRlOiAwLTExLCBkYWhlciArMVxuICAgICAgICBjb25zdCBkYXkgPSBTdHJpbmcobm93LmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IGAke3llYXJ9JHttb250aH0ke2RheX1gO1xuICAgICAgICBcbiAgICAgICAgbGV0IHRzdHJpbmcgPSBgJHtkYXRlU3RyaW5nfV8ke3RpbWVzdHJpbmd9YDtcbiAgICAgICAgXG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbikgLy8gZ2V0IHN0dWRlbnQgZnJvbSB0b2tlblxuICAgICAgICBsZXQgYWJzb2x1dGVGaWxlcGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsIGZpbGVuYW1lKTtcbiAgICAgICAgbGV0IHN0dWRlbnRkaXJlY3RvcnkgPSAgcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSlcbiAgICAgICAgXG4gICAgICAgIGxldCBzdHVkZW50YXJjaGl2ZWRpciA9IHBhdGguam9pbihzdHVkZW50ZGlyZWN0b3J5LCB0c3RyaW5nKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3R1ZGVudGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihzdHVkZW50YXJjaGl2ZWRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiZGF0YSBAIHJlY2VpdmU6IFwiLCBlcnIpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmlsZSl7XG5cbiAgICAgICAgICAgIGlmIChmaWxlbmFtZS5pbmNsdWRlcyhcIi56aXBcIikpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiZGF0YSBAIHJlY2VpdmU6IFJlY2VpdmVkIFpJUCBGaWxlIGZyb20gdXNlcjpcIiwgc3R1ZGVudC5jbGllbnRuYW1lKVxuICAgICAgICAgICAgICAgIGxldCBzdWNjZXNzID0gYXdhaXQgYXJjaGl2ZUFuZEV4dHJhY3RaaXAoYWJzb2x1dGVGaWxlcGF0aCwgc3R1ZGVudGFyY2hpdmVkaXIsIGZpbGVDb250ZW50KVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuYmFja3VwZGlyZWN0b3J5ICYmIHN1Y2Nlc3MpeyAgICAgLy8gY29weSB0byBiYWNrdXAgZGlyZWN0b3J5IC0gZG8gbm90IHVuemlwIGEgc2Vjb25kIHRpbWUgLSB0aGlzIGlzIGFscmVhZHkgZG9uZSBpbiBhcmNoaXZlQW5kRXh0cmFjdFppcFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJhY2t1cGRpciA9ICBwYXRoLmpvaW4oY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsIHRzdHJpbmcpIC8vIHNhbWUgY29uY2VwdCBhcyBpbiBzdHVkZW50YXJjaGl2ZWRpclxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgZGF0YSBAIHJlY2VpdmU6IENvcHlpbmcgdG8gYmFja3VwIGRpcmVjdG9yeTogJHtzdHVkZW50YXJjaGl2ZWRpcn0gLT4gICAke2JhY2t1cGRpcn0gYClcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKGJhY2t1cGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5jcChzdHVkZW50YXJjaGl2ZWRpciwgYmFja3VwZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCByZWNlaXZlOiBcIiwgZXJyKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXJlY2VpdmVkXCIpLCBlcnJvcnM6IGVycm9ycyAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCByZWNlaXZlOiBObyBaSVAgZmlsZSByZWNlaXZlZFwiKVxuICAgICAgICAgICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5ub2ZpbGVyZWNlaXZlZFwiKSwgZXJyb3JzOiBlcnJvcnMgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5ub2ZpbGVyZWNlaXZlZFwiKSwgZXJyb3JzOiBlcnJvcnMgfSlcbiAgICAgICAgfVxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBVUExPQURTIEZpbGVzIGZyb20gdGhlIFRlYWNoZXIgRnJvbnRlbmQgYW5kIFxuICogc3RvcmVzIHRoZSBmaWxlcyBpbnRvIHRoZSB3b3JrZGlyZWN0b3J5XG4gKiB0aGVuIHVwZGF0ZXMgc3R1ZGVudC5zdGF0dXMuZmV0Y2hmaWxlcyBpbiBvcmRlciB0byB0cmlnZ2VyIGEgZmlsZXJlcXVlc3QgZnJvbSB0aGUgc3R1ZGVudChzKSBcbiAqL1xuXG5yb3V0ZXIucG9zdCgnL3VwbG9hZC86c2VydmVybmFtZS86c2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4geyAgXG4gICAgY29uc3Qgc2VydmVydG9rZW4gPSByZXEucGFyYW1zLnNlcnZlcnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG5cbiAgICBpZiAoIHNlcnZlcnRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuXG4gICAgLy8gY3JlYXRlIHVwbG9hZHMgZGlyZWN0b3J5XG4gICAgbGV0IHVwbG9hZGRpcmVjdG9yeSA9ICBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgJ1VQTE9BRFMnKVxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHVwbG9hZGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIERpcmVjdG9yeSBtaWdodCBhbHJlYWR5IGV4aXN0LCB0aGF0J3Mgb2tcbiAgICB9XG5cblxuICAgIGlmIChyZXEuZmlsZXMpe1xuXG4gICAgICAgIGxldCBmaWxlc0FycmF5ID0gW10gIC8vIGRlcGVuZGluZyBvbiB0aGUgbnVtYmVyIG9mIGZpbGVzIHRoaXMgY29tZXMgYXMgYXJyYXkgb2Ygb2JqZWN0cyBvciBvYmplY3RcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJlcS5maWxlcy5maWxlcykpeyBmaWxlc0FycmF5LnB1c2gocmVxLmZpbGVzLmZpbGVzKX1cbiAgICAgICAgZWxzZSB7ZmlsZXNBcnJheSA9IHJlcS5maWxlcy5maWxlc31cblxuICAgICAgICBsZXQgZmlsZXMgPSBbXSAgICAgICAgXG4gICAgXG4gICAgICAgIGZvciBhd2FpdCAobGV0IGZpbGUgb2YgIGZpbGVzQXJyYXkpIHtcbiAgICAgICAgICAgIGxldCBmaWxlbmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChmaWxlLm5hbWUpICAvL2VuY29kZSB0byBwcmV2ZW50IG5vbi1hc2NpaSBjaGFycyB3ZWlyZG5lc3NcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gcGF0aC5qb2luKHVwbG9hZGRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgYXdhaXQgZmlsZS5tdihhYnNvbHV0ZUZpbGVwYXRoLCAoZXJyKSA9PiB7ICBcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7IGxvZy5lcnJvciggdChcImRhdGEuY291bGRub3RzdG9yZVwiKSApIH1cbiAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgIGZpbGVzLnB1c2goeyBuYW1lOmZpbGVuYW1lICwgcGF0aDphYnNvbHV0ZUZpbGVwYXRoIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5mb3JtIHN0dWRlbnRzIGFib3V0IHRoaXMgc2VuZC1maWxlIHJlcXVlc3Qgc28gdGhhdCB0aGV5IHRyaWdnZXIgYSBkb3dubG9hZCByZXF1ZXN0IGZvciB0aGUgZ2l2ZW4gZmlsZXNcbiAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PT0gXCJhbGxcIil7XG4gICAgICAgICAgICBmb3IgKGxldCBzdHVkZW50IG9mIG1jU2VydmVyLnN0dWRlbnRMaXN0KXsgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXSA9IHRydWUgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gIGZpbGVzXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3R1ZGVudHRva2VuID09IFwiYVwiIHx8IHN0dWRlbnR0b2tlbiA9PSBcImJcIil7XG4gICAgICAgICAgICBsZXQgZ3JvdXBBcnJheSA9IFtdXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09IFwiYVwiKXtncm91cEFycmF5ID0gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBBLnVzZXJzIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT0gXCJiXCIpe2dyb3VwQXJyYXkgPSBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEIudXNlcnMgfVxuXG4gICAgICAgICAgICBpZiAoZ3JvdXBBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbmFtZSBvZiBncm91cEFycmF5KXtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC5jbGllbnRuYW1lID09PSBuYW1lKVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddPSB0cnVlIFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBmaWxlc1xuICAgICAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5ub2ZpbGVyZWNlaXZlZFwiKSB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXT0gdHJ1ZSBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9IGZpbGVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH1cbiAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlcmVjZWl2ZWRcIikgIH0pXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIikgfSlcbiAgICB9XG4gICAgXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCByb3V0ZXJcblxuLy8gU2ltcGxlIGNvbmN1cnJlbmN5IGxpbWl0ZXIgZm9yIFpJUCBleHRyYWN0aW9uXG5jb25zdCBNQVhfUEFSQUxMRUxfRVhUUkFDVFMgPSA0OyAvLyBsaW1pdCBzaW11bHRhbmVvdXMgZXh0cmFjdGlvbnMgdG8gc3RhYmlsaXplIGxhdGVuY3lcbmxldCBydW5uaW5nRXh0cmFjdHMgPSAwO1xuY29uc3QgZXh0cmFjdFF1ZXVlID0gW107XG5cbmZ1bmN0aW9uIHJ1bk5leHRFeHRyYWN0KCkge1xuICAgIGlmIChydW5uaW5nRXh0cmFjdHMgPj0gTUFYX1BBUkFMTEVMX0VYVFJBQ1RTKSByZXR1cm47XG4gICAgY29uc3Qgam9iID0gZXh0cmFjdFF1ZXVlLnNoaWZ0KCk7XG4gICAgaWYgKCFqb2IpIHJldHVybjtcblxuICAgIHJ1bm5pbmdFeHRyYWN0cysrO1xuICAgIC8vIGNvbnN0IHN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG5cbiAgICBqb2IoKVxuICAgICAgICAuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIC8vIGNvbnN0IG1zID0gRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdDtcbiAgICAgICAgICAgIC8vIGxvZy5pbmZvKGBkYXRhIEAgZXh0cmFjdDogZmluaXNoZWQgaW4gJHttc31tcyAocnVubmluZz0ke3J1bm5pbmdFeHRyYWN0cy0xfSwgcXVldWVkPSR7ZXh0cmFjdFF1ZXVlLmxlbmd0aH0pYCk7XG4gICAgICAgICAgICBydW5uaW5nRXh0cmFjdHMtLTtcbiAgICAgICAgICAgIHNldEltbWVkaWF0ZShydW5OZXh0RXh0cmFjdCk7XG4gICAgICAgIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcmNoaXZlQW5kRXh0cmFjdFppcChhYnNvbHV0ZUZpbGVwYXRoLCBzdHVkZW50YXJjaGl2ZWRpciwgZmlsZUNvbnRlbnQpe1xuICAgIC8vIGxvZy5pbmZvKGBkYXRhIEAgcmVjZWl2ZTogU3RvcmluZyBaaXBmaWxlIHRvICR7YWJzb2x1dGVGaWxlcGF0aH1gKVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IGV4ZWMgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVwYXRoLCBmaWxlQ29udGVudCk7XG5cbiAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhgZGF0YSBAIHJlY2VpdmU6IEV4dHJhY3RpbmcgWmlwZmlsZSB0byAke3N0dWRlbnRhcmNoaXZlZGlyfWApO1xuICAgICAgICAgICAgICAgIGF3YWl0IGV4dHJhY3QoYWJzb2x1dGVGaWxlcGF0aCwge1xuICAgICAgICAgICAgICAgICAgICBkaXI6IHN0dWRlbnRhcmNoaXZlZGlyLFxuICAgICAgICAgICAgICAgICAgICBvbkVudHJ5OiAoZW50cnksIHppcGZpbGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHBhdGgubm9ybWFsaXplKHBhdGguam9pbihzdHVkZW50YXJjaGl2ZWRpciwgZW50cnkuZmlsZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0LnN0YXJ0c1dpdGgocGF0aC5ub3JtYWxpemUoc3R1ZGVudGFyY2hpdmVkaXIgKyBwYXRoLnNlcCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQmxvY2tlZCBwYXRoIHRyYXZlcnNhbDogJyArIGVudHJ5LmZpbGVOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHsgYXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBTdWNjZXNzZnVsbHkgZXh0cmFjdGVkIFpJUCBmaWxlIHRvICR7c3R1ZGVudGFyY2hpdmVkaXJ9YCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCByZWNlaXZlIChleHRyYWN0KTogXCIsIGVycik7XG4gICAgICAgICAgICAgICAgdHJ5IHsgYXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZXh0cmFjdFF1ZXVlLnB1c2goZXhlYyk7XG4gICAgICAgIGlmIChydW5uaW5nRXh0cmFjdHMgPCBNQVhfUEFSQUxMRUxfRVhUUkFDVFMpIHNldEltbWVkaWF0ZShydW5OZXh0RXh0cmFjdCk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB0b2tlbiBpcyB2YWxpZCBpbiBvcmRlciB0byBwcm9jZXNzIGFwaSByZXF1ZXN0XG4gKiBBdHRlbnRpb246IG5vIGFsbCBhcGkgcmVxdWVzdHMgY2hlY2sgdG9rZW5zIGF0bSFcbiAqL1xuZnVuY3Rpb24gY2hlY2tUb2tlbih0b2tlbiwgbWNzZXJ2ZXIpe1xuICAgIGxldCB0b2tlbmV4aXN0cyA9IGZhbHNlXG4gICAgLy8gbG9nLmluZm8oXCJkYXRhIEAgY2hlY2tUb2tlbjogY2hlY2tpbmcgaWYgc3R1ZGVudCBpcyByZWdpc3RlcmVkIG9uIHRoaXMgc2VydmVyXCIpXG4gICAgdHJ5IHtcbiAgICAgICAgbWNzZXJ2ZXIuc3R1ZGVudExpc3QuZm9yRWFjaCggKHN0dWRlbnQpID0+IHtcbiAgICAgICAgICAgIGlmICh0b2tlbiA9PT0gc3R1ZGVudC50b2tlbikge1xuICAgICAgICAgICAgICAgIHRva2VuZXhpc3RzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgY2F0Y2goZXJyKXtcbiAgICAgICAgbG9nLmVycm9yKGBkYXRhOiAke2Vycn1gKVxuICAgIH1cblxuICAgIHJldHVybiB0b2tlbmV4aXN0c1xufVxuXG4vKipcbiAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VEaXI6IC9zb21lL2ZvbGRlci90by9jb21wcmVzc1xuICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuZnVuY3Rpb24gemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcignemlwJywgeyB6bGliOiB7IGxldmVsOiA5IH19KTtcbiAgICBjb25zdCBzdHJlYW0gPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShvdXRQYXRoKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgYXJjaGl2ZVxuICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXG4gICAgICAgIC5waXBlKHN0cmVhbSlcbiAgICAgIDtcbiAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgYXJjaGl2ZS5maW5hbGl6ZSgpO1xuICAgIH0pO1xufSIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cblxuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuLy9pbXBvcnQgaTE4biBmcm9tICcuLi8uLi9yZW5kZXJlci9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuLy9jb25zdCB7IHQgfSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnQgeyBCcm93c2VyV2luZG93LCBpcGNNYWluLCBkaWFsb2cgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7am9pbn0gZnJvbSAncGF0aCdcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IG5ldHdvcmtJbnRlcmZhY2VzIH0gZnJvbSAnb3MnXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBnYXRld2F5NHN5bmN9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5cbmltcG9ydCBzZXJ2ZXIgZnJvbSBcIi4uLy4uL3NlcnZlci9zcmMvc2VydmVyLmpzXCJcbmltcG9ydCBjaGVja0Rpc2tTcGFjZSBmcm9tICdjaGVjay1kaXNrLXNwYWNlJztcblxuXG5jbGFzcyBJcGNIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLnByaW50UXVldWUgPSBbXVxuICAgICAgICB0aGlzLmlzUHJvY2Vzc2luZ1ByaW50ID0gZmFsc2VcbiAgICB9XG4gICAgaW5pdCAobWMsIGNvbmZpZywgd2gsIGNoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gd2ggIFxuICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyID0gY2hcblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJvY2VzcyBwcmludCBxdWV1ZSBzZXF1ZW50aWFsbHkgLSBvbmUgam9iIGF0IGEgdGltZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJvY2Vzc1ByaW50UXVldWUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5pc1Byb2Nlc3NpbmdQcmludCkge1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy8gQWxyZWFkeSBwcm9jZXNzaW5nXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaXNQcm9jZXNzaW5nUHJpbnQgPSB0cnVlO1xuXG4gICAgICAgICAgICB3aGlsZSAodGhpcy5wcmludFF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBqb2IgPSB0aGlzLnByaW50UXVldWUuc2hpZnQoKTsgLy8gR2V0IGZpcnN0IGpvYiBmcm9tIHF1ZXVlXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50UXVldWU6IFByb2Nlc3NpbmcgcHJpbnQgam9iICgke3RoaXMucHJpbnRRdWV1ZS5sZW5ndGh9IHJlbWFpbmluZyBpbiBxdWV1ZSlgKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX3Byb2Nlc3NQcmludEpvYihqb2IuZG9jQmFzZTY0LCBqb2IucHJpbnRlck5hbWUsIGpvYi5wcmV2aWV3VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGpvYi5yZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRRdWV1ZTogUHJpbnQgam9iIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICBqb2IucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuaXNQcm9jZXNzaW5nUHJpbnQgPSBmYWxzZTtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludFF1ZXVlOiBQcmludCBxdWV1ZSBlbXB0eSwgcHJvY2Vzc2luZyBzdG9wcGVkJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByb2Nlc3MgYSBzaW5nbGUgcHJpbnQgam9iIC0gcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgYWZ0ZXIgcHJpbnQgY2FsbGJhY2sgY29tcGxldGVzXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wcm9jZXNzUHJpbnRKb2IgPSBhc3luYyAoZG9jQmFzZTY0LCBwcmludGVyTmFtZSwgcHJldmlld1R5cGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IGhpZGRlbldpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHVzZUNvbnRlbnRTaXplOiB0cnVlLCAvLyBFbnN1cmUgd2lkdGgvaGVpZ2h0IHJlZmVycyB0byBjb250ZW50IGFyZWFcbiAgICAgICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbnM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB3ZWJTZWN1cml0eTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB6b29tRmFjdG9yOiAxLjAgIC8vIEZvcmNlIDE6MSBzY2FsaW5nIHRvIGlnbm9yZSBzeXN0ZW0gc2NhbGUgZmFjdG9yXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBTZXQgem9vbSBmYWN0b3IgdG8gMS4wIHRvIGlnbm9yZSBzeXN0ZW0gRFBJIHNjYWxpbmcgKGZpeGVzIENocm9taXVtIHByaW50IGJ1ZylcbiAgICAgICAgICAgICAgICBoaWRkZW5XaW4ud2ViQ29udGVudHMuc2V0Wm9vbUZhY3RvcigxLjApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBkYXRhVXJsID0gYGA7XG4gICAgICAgICAgICAgICAgaWYgKHByZXZpZXdUeXBlID09PSBcInBkZlwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFVcmwgPSBgZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LCR7ZG9jQmFzZTY0fWA7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChwcmV2aWV3VHlwZSA9PT0gXCJpbWFnZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFVcmwgPSBgZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwke2RvY0Jhc2U2NH1gO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IEludmFsaWQgcHJldmlldyB0eXBlIScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignSW52YWxpZCBwcmV2aWV3IHR5cGUnKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBoaWRkZW5XaW4ub24oJ2Nsb3NlZCcsICgpID0+IHsgaGlkZGVuV2luID0gbnVsbDsgfSk7XG5cbiAgICAgICAgICAgICAgICBoaWRkZW5XaW4ud2ViQ29udGVudHMub24oJ2RpZC1zdG9wLWxvYWRpbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1BERlJlbmRlcmVkID0gYXdhaXQgaGlkZGVuV2luLndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsYXBzZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRlcnZhbCA9IDUwMDsgLy8gQ2hlY2sgZXZlcnkgNTAwIG1zXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSAyMDAwOyAvLyBNYXhpbXVtIDIgc2Vjb25kcyB3YWl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoZWNrUERGTG9hZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW1iZWQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdlbWJlZFt0eXBlPVwiYXBwbGljYXRpb24vcGRmXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdpbWcnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVtYmVkICYmIGVtYmVkLmNsaWVudEhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTsgLy8gUERGIGlzIGFzc3VtZWQgdG8gYmUgZnVsbHkgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChpbWcgJiYgaW1nLmNsaWVudEhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpOyAvLyBJbWFnZSBpcyBmdWxseSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGVsYXBzZWQgPj0gdGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpOyAvLyBUaW1lIGV4cGlyZWQsIG5vdCByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBlbGFwc2VkICs9IGludGVydmFsOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVyID0gc2V0SW50ZXJ2YWwoY2hlY2tQREZMb2FkZWQsIGludGVydmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNQREZSZW5kZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogYmFzZTY0ICR7cHJldmlld1R5cGV9IHJlY2VpdmVkIC0gcHJpbnRpbmcgb246ICR7cHJpbnRlck5hbWV9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGltZW91dCB0byBhdm9pZCBoYW5naW5nIHF1ZXVlIHdoZW4gcHJpbnQgY2FsbGJhY2sgbmV2ZXIgZmlyZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmludFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogcHJpbnQgam9iIHRpbWVvdXQgZm9yIHByaW50ZXIgJHtwcmludGVyTmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1ByaW50IGpvYiB0aW1lb3V0JykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIDEwMDAwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi53ZWJDb250ZW50cy5wcmludCh7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWxlbnQ6IHRydWUsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2VOYW1lOiBwcmludGVyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUZhY3RvcjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZXNQZXJTaGVldDogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHBpOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob3Jpem9udGFsOiA2MDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZXJ0aWNhbDogNjAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luVHlwZTogJ25vbmUnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCAoc3VjY2VzcywgZmFpbHVyZVJlYXNvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQocHJpbnRUaW1lb3V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbG9nIGlmIHByaW50IGpvYiB3YXMgaGFuZGVkIG92ZXIgdG8gT1Mgb3IgZmFpbGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogcHJpbnQgam9iIGZhaWxlZCBmb3IgcHJpbnRlciAke3ByaW50ZXJOYW1lfTogJHtmYWlsdXJlUmVhc29uIHx8ICd1bmtub3duIHJlYXNvbid9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihmYWlsdXJlUmVhc29uIHx8ICdQcmludCBqb2IgZmFpbGVkJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBwcmludCBqb2Igc3VjY2Vzc2Z1bGx5IGhhbmRlZCBvdmVyIHRvIE9TIGZvciBwcmludGVyICR7cHJpbnRlck5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2lwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBSZW5kZXJpbmcvUHJpbnQgZmFpbGVkIScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdSZW5kZXJpbmcvUHJpbnQgZmFpbGVkJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogRXJyb3IgZHVyaW5nIHByaW50IGpvYjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGhpZGRlbldpbi5sb2FkVVJMKGRhdGFVcmwpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBFcnJvciBsb2FkaW5nIFVSTDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvLyByZXR1cm5zIHRoZSBjdXJyZW50IHNlcnZlcnN0YXR1cyBvYmplY3Qgb2YgdGhlIGdpdmVuIHNlcnZlcihuYW1lKVxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0c2VydmVyc3RhdHVzJywgKGV2ZW50LCBzZXJ2ZXJuYW1lKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgaWYgKG1jU2VydmVyICkgeyByZXR1cm4gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgIHJldHVybiBmYWxzZSAgfVxuICAgICAgICB9KSBcblxuXG4gICAgICAgIC8vIHN0b3BzIHRoZSBjdXJyZW50IGV4YW0gc2VydmVyIFxuICAgICAgICAvLyAodGhpcyBpcyBhIGNvcHkgb2YgdGhlIC9zdG9wc2VydmVyLzpzZXJ2ZXJuYW1lIHJvdXRlIGluIGNvbnRyb2wuanMgKVxuICAgICAgICAvLyByZXRoaW5rIGNvbmNlcHQgdGhhdCBsb2NhbCByZXF1ZXN0cyBnbyB0byB0aGUgQVBJICh0aGlzIGhhZCBhIG5vbiBlbGVjdHJvbiBzZXJ2ZXIgdmVyc2lvbiBpbiBtaW5kIGJ1dCBtYWtlcyBubyBzZW5zZSBpbiBlbGVjdHJvbiBvbmx5IGFwcClcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0b3BzZXJ2ZXInLCAoZXZlbnQsIHNlcnZlcm5hbWUpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBtY1NlcnZlciA9IHRoaXMuY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgICAgICBpZiAobWNTZXJ2ZXIgKSB7IFxuICAgICAgICAgICAgICAgIG1jU2VydmVyLmJyb2FkY2FzdEludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIG1jU2VydmVyLnNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gICAgLy9kZWxldGUgbWNTZXJ2ZXJcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LmZpbHRlcihleGFtID0+IGV4YW0uc2VydmVybmFtZSAhPT0gc2VydmVybmFtZSkgIC8vIG11bHRpY2FzdGNsaWVudCBrZWVwcyB0cmFjayBvZiBydW5uaW5nIHNlcnZlcnMgaW4gdGhlIGxhblxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIHJldHVybiBmYWxzZSAgfVxuICAgICAgICB9KSBcblxuXG4gICAgICAgIC8vcmV0dXJuIGN1cnJlbnQgc3R1ZGVudGxpc3RcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0dWRlbnRsaXN0JywgKGV2ZW50LCBzZXJ2ZXJuYW1lKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgaWYgKG1jU2VydmVyICkgeyBcbiAgICAgICAgICAgICAgICByZXR1cm4ge3N0dWRlbnRsaXN0OiBtY1NlcnZlci5zdHVkZW50TGlzdH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgc3R1ZGVudGxpc3Q6IFtdfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KSBcblxuXG5cblxuICAgICAgICAvLyBvcGVucyBhIGxvZ2lud2luZG93IGZvciBtaWNyb3NvZnQgMzY1XG4gICAgICAgIGlwY01haW4ub24oJ29wZW5tc2F1dGgnLCAoZXZlbnQpID0+IHsgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZU1zYXV0aFdpbmRvdygpOyAgZXZlbnQucmV0dXJuVmFsdWUgPSB0cnVlIH0pICBcblxuXG4gICAgICAgIC8vIHJldHVybnMgY3VycmVudCBjb25maWdcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0Y29uZmlnJywgKGV2ZW50KSA9PiB7ICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb3B5Q29uZmlnKGNvbmZpZyk7IFxuICAgICAgICB9KSAgXG5cblxuICAgICAgICAvLyByZXR1cm5zIGN1cnJlbnQgY29uZmlnIGFzeW5jXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRjb25maWdhc3luYycsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb3B5Q29uZmlnKGNvbmZpZylcbiAgICAgICAgfSkgIFxuXG5cbiAgICAgICAgLy8gbG9nIG91dCBvZiBtaWNyb3NvZnQgMzY1XG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdyZXNldFRva2VuJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgY29uc3Qgd2luID0gdGhpcy5XaW5kb3dIYW5kbGVyLm1haW53aW5kb3c7IC8vIE9kZXIgd2llIGF1Y2ggaW1tZXIgU2llIGF1ZiBJaHIgQnJvd3NlcldpbmRvdy1PYmpla3QgenVncmVpZmVuXG4gICAgICAgICAgICBpZiAoIXdpbikgcmV0dXJuO1xuXG4gICAgICAgICAgICBhd2FpdCB3aW4ud2ViQ29udGVudHMuc2Vzc2lvbi5jbGVhckNhY2hlKCk7XG4gICAgICAgICAgICBhd2FpdCB3aW4ud2ViQ29udGVudHMuc2Vzc2lvbi5jbGVhclN0b3JhZ2VEYXRhKHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlczogWydjb29raWVzJ11cbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbmZpZy5hY2Nlc3NUb2tlbiA9IGZhbHNlXG5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHJlc2V0VG9rZW46IExvZ2dlZCBvdXQgb2YgT2ZmaWNlMzY1XCIpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb3B5Q29uZmlnKGNvbmZpZyk7ICAvLyB3ZSBjYW50IGp1c3QgY29weSB0aGUgY29uZmlnIGJlY2F1c2UgaXQgY29udGFpbnMgZXhhbVNlcnZlckxpc3Qgd2hpY2ggY29udGFpbnMgY29uZmlnIChjaXJjdWxhciBzdHJ1Y3R1cmUpXG4gICAgICAgIH0pICBcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBvcGVucyBmaWxlIGluIGV4dGVybmFsIHByb2dyYW0gLSBwbGF0Zm9ybSBkZXBlbmRlbnRcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdvcGVuZmlsZScsIChldmVudCwgZmlsZXBhdGgpID0+IHsgIFxuICAgICAgICAgICAgY29uc3QgY21kID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IGBzdGFydCBcIiBcIiBcIiR7ZmlsZXBhdGh9XCJgIDpcbiAgICAgICAgICAgIHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nID8gYG9wZW4gXCIke2ZpbGVwYXRofVwiYCA6XG4gICAgICAgICAgICBgeGRnLW9wZW4gXCIke2ZpbGVwYXRofVwiYDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBleGVjKGNtZCwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgb3BlbmZpbGU6IEVycm9yIG9wZW5pbmcgUERGIGluIGV4dGVybmFsIHJlYWRlcjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnaXBjaGFuZGxlciBAIG9wZW5maWxlOiBGaWxlIG9wZW5lZCBpbiBleHRlcm5hbCByZWFkZXInKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgb3BlbmZpbGU6IEVycm9yIG9wZW5pbmcgUERGOicsIGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pICBcblxuXG4gICAgICAgIGlwY01haW4ub24oJ2dldEN1cnJlbnRXb3JrZGlyJywgKGV2ZW50KSA9PiB7ICAgZXZlbnQucmV0dXJuVmFsdWUgPSBjb25maWcud29ya2RpcmVjdG9yeSAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja0Rpc2NzcGFjZScsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgZGlza1NwYWNlID0gYXdhaXQgY2hlY2tEaXNrU3BhY2UoY29uZmlnLndvcmtkaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgIGxldCBmcmVlID0gTWF0aC5yb3VuZChkaXNrU3BhY2UuZnJlZSAvIDEwMjQgLyAxMDI0IC8gMTAyNCAqIDEwMDApIC8gMTAwMDtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGNoZWNrRGlza3NwYWNlOlwiLGRpc2tTcGFjZSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJlZTsgICAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzZXRiYWNrdXBkaXInLCBhc3luYyAoZXZlbnQsIGFyZykgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGlhbG9nLnNob3dPcGVuRGlhbG9nKCB0aGlzLldpbmRvd0hhbmRsZXIubWFpbndpbmRvdywgeyBwcm9wZXJ0aWVzOiBbJ29wZW5EaXJlY3RvcnknXSAgfSlcbiAgICAgICAgICAgIGlmICghcmVzdWx0LmNhbmNlbGVkKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnZGlyZWN0b3JpZXMgc2VsZWN0ZWQnLCByZXN1bHQuZmlsZVBhdGhzKVxuICAgICAgICAgICAgICAgIGxldCBtZXNzYWdlID0gXCJcIlxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0ZXN0ZGlyID0gam9pbihyZXN1bHQuZmlsZVBhdGhzWzBdICAgLCBjb25maWcuc2VydmVyZGlyZWN0b3J5KVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModGVzdGRpcikpe2ZzLm1rZGlyU3luYyh0ZXN0ZGlyKX1cbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwic3VjY2Vzc1wiXG4gICAgICAgICAgICAgICAgICAgIC8vY29uZmlnLndvcmtkaXJlY3RvcnkgPSB0ZXN0ZGlyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5iYWNrdXBkaXJlY3RvcnkgPSB0ZXN0ZGlyXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHNldGJhY2t1cGRpcjpcIiwgY29uZmlnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSl7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcImVycm9yXCJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7YmFja3VwZGlyOiBjb25maWcuYmFja3VwZGlyZWN0b3J5LCBtZXNzYWdlIDogbWVzc2FnZX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB7YmFja3VwZGlyOiBjb25maWcuYmFja3VwZGlyZWN0b3J5LCBtZXNzYWdlIDogJ2NhbmNlbGVkJ31cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4ub24oJ3NldFByZXZpb3VzV29ya2RpcicsIGFzeW5jIChldmVudCwgd29ya2RpcikgPT4ge1xuICAgICAgICAgICAgaWYgKHdvcmtkaXIpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdwcmV2aW91cyBkaXJlY3Rvcnkgc2VsZWN0ZWQnLCB3b3JrZGlyKVxuICAgICAgICAgICAgICAgIGxldCBtZXNzYWdlID0gXCJcIlxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7ZnMubWtkaXJTeW5jKHdvcmtkaXIpfVxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJzdWNjZXNzXCJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLndvcmtkaXJlY3RvcnkgPSB3b3JrZGlyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwiZXJyb3JcIlxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7d29ya2RpcjogY29uZmlnLndvcmtkaXJlY3RvcnksIG1lc3NhZ2UgOiBtZXNzYWdlfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHt3b3JrZGlyOiBjb25maWcud29ya2RpcmVjdG9yeSwgbWVzc2FnZSA6ICdjYW5jZWxlZCd9IH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjcmVhdGVCaXBFeGFtZGlyZWN0b3J5JywgYXN5bmMgKGV2ZW50LCBleGFtKSA9PiB7XG4gICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiXCJcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBleGFtLmV4YW1OYW1lKVxuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHdvcmtkaXIsICdzZXJ2ZXJzdGF0dXMuanNvbicpO1xuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXtmcy5ta2RpclN5bmMod29ya2Rpcil9XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwic3VjY2Vzc1wiXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSl7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGUubWVzc2FnZVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkgeyAgXG4gICAgICAgICAgICAgICAgY29uc3QganNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KGV4YW0sIG51bGwsIDIpO1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIEpTT04gYmVmb3JlIHdyaXRpbmcgdG8gcHJldmVudCBpbnZhbGlkIEpTT04gZmlsZXNcbiAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGpzb25TdHJpbmcpO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZmlsZVBhdGgsIGpzb25TdHJpbmcpOyAgXG4gICAgICAgICAgICB9ICAgLy8gc2F2ZSBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMgYXMgSlNPTiBmaWxlXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHsgIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGNyZWF0ZUJpcEV4YW1kaXJlY3Rvcnk6IEpTT04gdmFsaWRhdGlvbiBvciB3cml0ZSBmYWlsZWQ6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwiZXJyb3JcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7bWVzc2FnZSA6IG1lc3NhZ2V9XG5cbiAgICAgICAgfSlcblxuICAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBMT0cgRklMRSBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0bG9nJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gam9pbihjb25maWcud29ya2RpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IGpvaW4od29ya2RpcixcIm5leHQtZXhhbS10ZWFjaGVyLmxvZ1wiKVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgc2VydmVybG9nID0gZGF0YS50cmltKClcbiAgICAgICAgICAgICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAgICAgICAgICAgLm1hcChsaW5lID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxcWyguKz8pXFxdXFxzK1xcWyguKz8pXFxdXFxzKyguKikkLyk7XG4gICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgWywgZGF0ZSwgdHlwZSwgcmF3VGV4dF0gPSBtYXRjaDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBjb2xvciBiYXNlZCBvbiBsb2cgdHlwZVxuICAgICAgICAgICAgICAgICAgICBsZXQgY29sb3I7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAodHlwZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW5mbyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9ICcjMGFhMmMwJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3dhcm4nOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAndmFyKC0tYnMtd2FybmluZyknO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAndmFyKC0tYnMtZGFuZ2VyKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAndmFyKC0tYnMtY3lhbiknO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICBsZXQgc291cmNlID0gJ25leHQtZXhhbSc7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0ZXh0ID0gcmF3VGV4dDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIGEgY29sb24gaXMgcHJlc2VudDogZXZlcnl0aGluZyBiZWZvcmUgdGhlIGZpcnN0IGNvbG9uIGFzICdzb3VyY2UnXG4gICAgICAgICAgICAgICAgICAgIGlmIChyYXdUZXh0LmluY2x1ZGVzKCc6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvbkluZGV4ID0gcmF3VGV4dC5pbmRleE9mKCc6Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgc291cmNlID0gcmF3VGV4dC5zdWJzdHJpbmcoMCwgY29sb25JbmRleCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQgPSByYXdUZXh0LnN1YnN0cmluZyhjb2xvbkluZGV4ICsgMSkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBkYXRlLCB0eXBlLCB0ZXh0LCBjb2xvciwgc291cmNlIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoaXRlbSA9PiBpdGVtICE9PSBudWxsKTtcblxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcnZlcmxvZ1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGxvZzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBvbGQgZXhhbSBmb2xkZXJzIGluIHdvcmtkaXJlY3RvcnlcbiAgICAgICAgICovXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NjYW5Xb3JrZGlyJywgYXN5bmMgKGV2ZW50LCBhcmcpID0+IHtcbiAgICAgICAgICAgIGxldCBleGFtZm9sZGVycyA9IFtdIC8vIGFycmF5IGZvciByZXN1bHRzXG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpIHsgLy8gY2hlY2sgaWYgYmFzZSBkaXIgZXhpc3RzXG4gICAgICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IGZzLnJlYWRkaXJTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRGlyZWN0b3J5KCkpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZGlybmFtZSBvZiBmb2xkZXJzKSB7IC8vIGl0ZXJhdGUgb3ZlciBkaXJlY3RvcnkgbmFtZXNcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyc3RhdHVzUGF0aCA9IGpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIGRpcm5hbWUsICdzZXJ2ZXJzdGF0dXMuanNvbicpXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNlcnZlcnN0YXR1c1BhdGgpKSB7IC8vIGNoZWNrIGlmIGZpbGUgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJzdGF0dXMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzZXJ2ZXJzdGF0dXNQYXRoLCAndXRmLTgnKSkgLy8gcGFyc2UgSlNPTiB0byBvYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VydmVyc3RhdHVzLmV4YW1OYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzLmV4YW1OYW1lID0gZGlybmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXhhbWZvbGRlcnMucHVzaChzZXJ2ZXJzdGF0dXMpIC8vIGFkZCBvYmplY3QgdG8gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2NhbldvcmtkaXI6IEVycm9yIHBhcnNpbmcgc2VydmVyc3RhdHVzLmpzb24gaW4gJHtkaXJuYW1lfTpgLCBlKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXhhbWZvbGRlcnMgLy8gcmV0dXJuIHJlc3VsdHNcbiAgICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZGVsZXRlcyBvbGQgZXhhbSBmb2xkZXIgaW4gd29ya2RpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2RlbFByZXZpb3VzJywgYXN5bmMgKGV2ZW50LCBhcmcpID0+IHtcbiAgICAgICAgICAgIGxldCBleGFtZGlyID0gam9pbiggY29uZmlnLndvcmtkaXJlY3RvcnksIGFyZylcbiAgICAgICAgICAgIGlmIChmcy5zdGF0U3luYyhleGFtZGlyKS5pc0RpcmVjdG9yeSgpKXtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmMoZXhhbWRpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge2xvZy5lcnJvcihlKX1cbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIHJldHVybiBleGFtZGlyXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKiogR2V0IFNwZWNpZmljIFN1Ym1pc3Npb24gYnkgZmlsZXBhdGggYXMgYmFzZTY0IHN0cmluZyAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0U3BlY2lmaWNTdWJtaXNzaW9uQmFzZTY0JywgYXN5bmMgKGV2ZW50LCBmaWxlcGF0aCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJtaXNzaW9uID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAnYmFzZTY0JylcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWJtaXNzaW9uOiBzdWJtaXNzaW9uLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0U3BlY2lmaWNTdWJtaXNzaW9uQmFzZTY0OiAke2V9YClcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWJtaXNzaW9uOiBmYWxzZSwgc3RhdHVzOiBcImVycm9yXCIgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgLyoqXG4gICAgICAgICAqIGdldCBsYXRlc3Qgc3VibWlzaW9ucyBmcm9tIGFsbCBzdHVkZW50c1xuICAgICAgICAgKiByZXR1cm4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIHN0dWRlbnRuYW1lLCBsYXRlc3RmaWxlcGF0aCwgbGF0ZXN0ZmlsZW5hbWUgYW5kIHN1Ym1pc3Npb25kYXRlICh0aW1lc3RhbXApXG4gICAgICAgICAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgdG8gZ2V0IHRoZSBzdWJtaXNzaW9ucyBmcm9tXG4gICAgICAgICAqIEByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJzdWNjZXNzXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIHN1Ym1pc3Npb25zOiBzdWJtaXNzaW9ucyB9XG4gICAgICAgICAqL1xuICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRTdWJtaXNzaW9ucycsIGFzeW5jIChldmVudCwgc2VydmVybmFtZSwgY3VycmVudHNlcnZlcnN0YXR1cykgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgY29uc3Qgc2VydmVyc3RhdHVzID0gSlNPTi5wYXJzZShjdXJyZW50c2VydmVyc3RhdHVzKVxuICAgICAgICAgICAgaWYgKCFtY1NlcnZlcikgeyByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgc3VibWlzc2lvbnM6IFtdIH0gfVxuICAgICAgICAgICAgbGV0IHN1Ym1pc3Npb25zID0gW11cbiAgICAgICAgICAgIGxldCBkaXIgPSAgam9pbiggY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSk7XG4gICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZGlyKSkgeyAvLyBjaGVjayBpZiBiYXNlIGRpciBleGlzdHNcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJzID0gZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRGlyZWN0b3J5KCkpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzdHVkZW50TmFtZSBvZiBmb2xkZXJzKSB7IC8vIGl0ZXJhdGUgb3ZlciBkaXJlY3RvcnkgbmFtZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0dWRlbnROYW1lLnRvVXBwZXJDYXNlKCkgPT09ICdVUExPQURTJykgeyAvLyBpZ25vcmUgVVBMT0FEUyBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBzZWN0aW9ucyA9IHt9XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdWJtaXNzaW9uRGlyID0gam9pbihkaXIsIHN0dWRlbnROYW1lLCBcIkFCR0FCRVwiKVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gaXRlcmF0ZSBvdmVyIGV4YW0gc2VjdGlvbnMgMS00XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHNlY3Rpb24gPSAxOyBzZWN0aW9uIDw9IDQ7IHNlY3Rpb24rKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNlY3Rpb25EaXIgPSBqb2luKHN1Ym1pc3Npb25EaXIsIFN0cmluZyhzZWN0aW9uKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBzZWN0aW9uIHdpdGggZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25zW3NlY3Rpb25dID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbm5hbWU6IFwiXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2VjdGlvbkRpcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgc2VjdGlvbkZpbGVzID0gZnMucmVhZGRpclN5bmMoc2VjdGlvbkRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSkgLy8gb25seSBmaWxlcywgbm90IGRpcmVjdG9yaWVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWN0aW9uRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGF0ZXN0U3VibWlzc2lvbiA9IHNlY3Rpb25GaWxlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZVBhdGggPSBqb2luKHNlY3Rpb25EaXIsIGZpbGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZmlsZSwgbXRpbWU6IGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIubXRpbWUgLSBhLm10aW1lKVswXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbnNbc2VjdGlvbl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBqb2luKHNlY3Rpb25EaXIsIGxhdGVzdFN1Ym1pc3Npb24uZmlsZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZTogbGF0ZXN0U3VibWlzc2lvbi5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZTogbGF0ZXN0U3VibWlzc2lvbi5tdGltZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25uYW1lOiBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlY3Rpb25dLnNlY3Rpb25uYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudE5hbWU6IHN0dWRlbnROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbnM6IHNlY3Rpb25zXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Ym1pc3Npb25zXG4gICAgICAgIH0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgbGF0ZXN0IGJhayBmaWxlIGZyb20gc3BlY2lmaWMgc3R1ZGVudCBkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRMYXRlc3RCYWtGaWxlJywgYXN5bmMgKGV2ZW50LCBzZXJ2ZXJuYW1lLCBzdHVkZW50TmFtZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgaWYgKCFtY1NlcnZlcikgeyByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgZmlsZXBhdGg6IGZhbHNlIH0gfVxuICAgICAgICAgICAgbGV0IGxhdGVzdEJha0ZpbGUgPSBudWxsXG4gICAgICAgICAgICBsZXQgZGlyID0gIGpvaW4oIGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnROYW1lKTtcbiAgICBcbiAgICAgICAgICAgIC8vY2hlY2sgaWYgZGlyZWN0b3J5IGV4aXN0c1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIGZpbGVwYXRoOiBmYWxzZSB9IH1cblxuICAgICAgICAgICAgLy9pbiB0aGUgc3R1ZGVudCBkaXJlY3Ryb3kgdGhlcmUgYXJlIHNldmVyYWwgYmFja3VwIGRpcmVjdG9yaWVzICB0aGF0IGNvbnRhaW4gYSBiYWsgZmlsZSAvMjAyNTExMTJfMTBfMjBfMTMvXG4gICAgICAgICAgICAvLyB0aGUgYmFrZmlsZSBuYW1pbmcgc2NoZW1lIGlzIHN0dWRlbnRuYW1lLmJhayAuLi4gd2Ugb25seSBuZWVkIHRoZSBsYXRlc3Qgb25lIHRoYXQgaGFzIHRoZSBzdHVkZW50bmFtZSBhcyBmaWxlbmFtZVxuICAgICAgICAgICAgLy8gaWdub3JlIGRpcmVjdG9yaWVzOiBBQkdBQkUgYW5kIGZvY3VzbG9zdFxuICAgICAgICAgICAgY29uc3QgYmFja3VwRGlyZWN0b3JpZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpICYmIGRpcmVudC5uYW1lICE9PSAnQUJHQUJFJyAmJiBkaXJlbnQubmFtZSAhPT0gJ2ZvY3VzbG9zdCcpXG4gICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZVBhdGggPSBqb2luKGRpciwgZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IG5hbWU6IGRpcmVudC5uYW1lLCBtdGltZTogZnMuc3RhdFN5bmMoZmlsZVBhdGgpLm10aW1lIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLm10aW1lIC0gYS5tdGltZSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGJhY2t1cERpcmVjdG9yaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgbGF0ZXN0QmFja3VwRGlyZWN0b3J5ID0gYmFja3VwRGlyZWN0b3JpZXNbMF0ubmFtZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0TGF0ZXN0QmFrRmlsZTogU2VhcmNoaW5nIGZvciBsYXRlc3QgYmFja3VwIGZpbGUgaW46XCIsIGRpciwgbGF0ZXN0QmFja3VwRGlyZWN0b3J5KVxuICAgICAgICAgICAgY29uc3QgbGF0ZXN0QmFrRmlsZXBhdGggPSBqb2luKGRpciwgbGF0ZXN0QmFja3VwRGlyZWN0b3J5LCBzdHVkZW50TmFtZSArICcuYmFrJylcbiAgICAgICAgICAgIGNvbnN0IGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGggPSBqb2luKGRpciwgbGF0ZXN0QmFja3VwRGlyZWN0b3J5KVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvL2dldCBsYXRlc3QgYmFrIGZpbGUgIC0gY2hlY2sgaWYgZmlsZSBleGlzdHNcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhsYXRlc3RCYWtGaWxlcGF0aCkpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIGZpbGVwYXRoOiBmYWxzZSwgbGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aDpsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoIHx8IGZhbHNlIH0gfVxuICAgICAgICAgICAgLy9yZXR1cm4gdGhlIGV4aXN0aW5nIGFuZCBjaGVja2VkIGZpbGVwYXRoIG9yIGlmIG5vIGZpbGUgd2FzIGZvdW5kIGZhbHNlXG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJzdWNjZXNzXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIGZpbGVwYXRoOiBsYXRlc3RCYWtGaWxlcGF0aCwgbGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aDogbGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aCB9XG5cbiAgICAgICAgfSlcblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgc3lzdGVtIHByaW50ZXJzXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0cHJpbnRlcnMnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwcmludGVycyA9IGF3YWl0IHRoaXMuV2luZG93SGFuZGxlci5tYWlud2luZG93LndlYkNvbnRlbnRzLmdldFByaW50ZXJzQXN5bmMoKTtcbiAgICAgICAgICAgIC8vbG9nLmluZm8oJ2lwY2hhbmRsZXIgQCBnZXRwcmludGVyczogcHJpbnRlcnMnLCBwcmludGVycylcbiAgICAgICAgICAgIGNvbnN0IHByaW50ZXJEYXRhID0gcHJpbnRlcnMubWFwKHByaW50ZXIgPT4gKHtcbiAgICAgICAgICAgICAgICBwcmludGVyTmFtZTogcHJpbnRlci5uYW1lLFxuICAgICAgICAgICAgICAgIGlzRGVmYXVsdDogcHJpbnRlcnMubGVuZ3RoID09PSAxID8gdHJ1ZSA6IHByaW50ZXIuaXNEZWZhdWx0LCAvLyBkZXByZWNhdGVkIGluIGVsZWN0cm9uIDM2LCBzZXQgdG8gdHJ1ZSBpZiBvbmx5IG9uZSBwcmludGVyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHByaW50ZXIuZGVzY3JpcHRpb25cbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIHByaW50ZXJEYXRhXG4gICAgICAgIH0pXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJpbnQgYSBEb2N1bWVudCBhcyBiYXNlNjQgc3RyaW5nIHZpYSB3ZWJjb250ZW50cy5wcmludCgpIHdpdGhvdXQgc3BlY2lmaWMgcGxhdGZvcm1kZXBlbmRlbnQgbGlicmFyaWVzXG4gICAgICAgICAqIElORk86IGl0IGlzIGN1cnJlbnRseSBub3QgcG9zc2libGUgdG8gZ2V0IGEgXCJmaW5pc2hlZC1yZW5kZXJpbmdcIiBldmVudCBmcm9tIHRoZSBjaHJvbWUtcGRmLXBsdWdpbi4gdGhlcmVmb3JlIHRpbWVvdXRzIGFyZSB1c2VkIGFzIGEgd29ya2Fyb3VuZFxuICAgICAgICAgKiBVc2VzIGEgcHJpbnQgcXVldWUgdG8gaGFuZGxlIG11bHRpcGxlIHNpbXVsdGFuZW91cyByZXF1ZXN0cyBzZXF1ZW50aWFsbHlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdwcmludEJhc2U2NCcsIGFzeW5jIChldmVudCwgZG9jQmFzZTY0LCBwcmludGVyTmFtZSwgcHJldmlld1R5cGUpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIGpvYiB0byBxdWV1ZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW50UXVldWUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb2NCYXNlNjQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmludGVyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpZXdUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdFxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHByaW50QmFzZTY0OiBQcmludCByZXF1ZXN0IGFkZGVkIHRvIHF1ZXVlICgke3RoaXMucHJpbnRRdWV1ZS5sZW5ndGh9IGpvYnMgaW4gcXVldWUpYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnQgcXVldWUgcHJvY2Vzc2luZyBpZiBub3QgYWxyZWFkeSBydW5uaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1Byb2Nlc3NpbmdQcmludCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcHJvY2Vzc1ByaW50UXVldWUoKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludEJhc2U2NDogUXVldWUgcHJvY2Vzc2luZyBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludEJhc2U2NDogcmV0dXJuaW5nIGVycm9yIHRvIHJlbmRlcmVyOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2hlY2tob3N0aXAnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCBhdmFpbGFibGUgbmV0d29yayBpbnRlcmZhY2VzIHdpdGggSVAgYWRkcmVzc2VzXG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VzID0gbmV0d29ya0ludGVyZmFjZXMoKVxuICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzID0gbnVsbFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCBJUHY0IGFkZHJlc3Nlc1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoaW50ZXJmYWNlcykuZm9yRWFjaCgoaW50ZXJmYWNlTmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIGludGVyZmFjZXNbaW50ZXJmYWNlTmFtZV0uZm9yRWFjaCgoaWZhY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmlsdGVyIG91dCBsb29wYmFjayBhbmQgbG9jYWwgYWRkcmVzc2VzXG4gICAgICAgICAgICAgICAgICAgIGlmIChpZmFjZS5mYW1pbHkgPT09ICdJUHY0JyAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgICFpZmFjZS5hZGRyZXNzLnN0YXJ0c1dpdGgoJzEyNy4nKSAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgICFpZmFjZS5hZGRyZXNzLnN0YXJ0c1dpdGgoJzE2OS4yNTQuJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzID0gW11cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBpbnRlcmZhY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6IGlmYWNlLmFkZHJlc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgb2xkIElQIGFkZHJlc3NcbiAgICAgICAgICAgIGNvbnN0IG9sZEhvc3RJcCA9IHRoaXMuY29uZmlnLmhvc3RpcFxuXG4gICAgICAgICAgICAvLyBJZiBhIHByZWZlcnJlZCBpbnRlcmZhY2UgaXMgc2V0LCB1c2UgaXQgdG8gcXVpY2tseSBnZXQgYW4gSVBcbiAgICAgICAgICAgIGlmICh0aGlzLnByZWZlcnJlZEludGVyZmFjZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZlcnJlZCA9IHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcz8uZmluZChpZmFjZSA9PiBpZmFjZS5uYW1lID09PSB0aGlzLnByZWZlcnJlZEludGVyZmFjZSlcbiAgICAgICAgICAgICAgICBpZiAocHJlZmVycmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IHByZWZlcnJlZC5hZGRyZXNzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IHByZWZlcnJlZC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGEgZ2F0ZXdheSBleGlzdHMgZm9yIHRoZSBwcmVmZXJyZWQgaW50ZXJmYWNlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7Z2F0ZXdheSwgdmVyc2lvbiwgaW50fSA9IGdhdGV3YXk0c3luYyhwcmVmZXJyZWQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBpbnQgPT09IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgICAgICBjb25zdCB7Z2F0ZXdheSwgdmVyc2lvbiwgaW50fSA9ICBnYXRld2F5NHN5bmMoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGludClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaW50ZXJmYWNlID0gaW50XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuaG9zdGlwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgLy90aGlzIGRlbGl2ZXJzIGFuIGlwIGV2ZW4gaWYgZ2F0ZXdheSBpcyBub3Qgc2V0IC0gdGhlIGZpcnN0IGlwIGFkZHJlc3Mgb2YgdGhlIHN5c3RlbVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHRoaXMgYWRkcmVzcyB0byBmaW5kIHRoZSBuYW1lIG9mIHRoZSBpbnRlcmZhY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZU5hbWUgPSBPYmplY3Qua2V5cyhpbnRlcmZhY2VzKS5maW5kKGtleSA9PiBpbnRlcmZhY2VzW2tleV0uc29tZShpZmFjZSA9PiBpZmFjZS5hZGRyZXNzID09PSB0aGlzLmNvbmZpZy5ob3N0aXApKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaW50ZXJmYWNlID0gaW50ZXJmYWNlTmFtZVxuXG4gICAgICAgICAgICAgICAgICAgIH0gIFxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgbXVsdGljYXN0IGNsaWVudCBpcyBydW5uaW5nIC0gb3RoZXJ3aXNlIHN0YXJ0IGl0XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2UgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgSVAgaGFzIGNoYW5nZWQgYW5kIHJlaW5pdGlhbGl6ZSBldmVyeXRoaW5nIGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgaWYgKG9sZEhvc3RJcCAhPT0gdGhpcy5jb25maWcuaG9zdGlwICYmIHRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtYWluOiBJUCBjaGFuZ2VkIGZyb20gJHtvbGRIb3N0SXB9IHRvICR7dGhpcy5jb25maWcuaG9zdGlwfSwgcmVpbml0aWFsaXppbmcgc2VydmljZXMuLi5gKVxuXG4gICAgICAgICAgICAgICAgLy8gUmVpbml0aWFsaXplIG11bHRpY2FzdCBjbGllbnQgb24gSVAgY2hhbmdlIChtdWx0aWNhc3RjbGllbnQgaXMgb25seSB1c2VkIGZvciBkaXNjb3Zlcnkgb2Ygb3RoZXIgZXhhbSBzZXJ2ZXJzKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudCAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpKSB7IC8vIGNoZWNrIGlmIG11bHRpY2FzdCBjbGllbnQgaXMgYWN0dWFsbHkgcnVubmluZ1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuc3RvcCgpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5pbml0KHRoaXMuY29uZmlnLmdhdGV3YXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbWFpbjogTXVsdGljYXN0IGNsaWVudCByZWluaXRpYWxpemVkJylcbiAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbjogRmFpbGVkIHRvIHJlaW5pdGlhbGl6ZSBtdWx0aWNhc3QgY2xpZW50OicsIGUpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZXN0YXJ0IEV4cHJlc3Mgc2VydmVyIG9uIElQIGNoYW5nZVxuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlci5saXN0ZW5pbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5jbG9zZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYG1haW46IEV4cHJlc3Mgc2VydmVyIHN0b3BwZWQgZHVlIHRvIElQIGNoYW5nZWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogRXhwcmVzcyBzZXJ2ZXIgcmVzdGFydGVkIG9uIGh0dHBzOi8vJHtjb25maWcuaG9zdGlwfToke2NvbmZpZy5zZXJ2ZXJBcGlQb3J0fWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtYWluOiBFeHByZXNzIHNlcnZlciBzdGFydGVkIG9uIGh0dHBzOi8vJHtjb25maWcuaG9zdGlwfToke2NvbmZpZy5zZXJ2ZXJBcGlQb3J0fWApXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIC8vIGVsc2UgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCAmJiB0aGlzLm11bHRpY2FzdENsaWVudCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKSkgeyAgLy8gSWYgbm8gSVAgY2hhbmdlIGJ1dCBtdWx0aWNhc3QgY2xpZW50IGlzIG5vdCBydW5uaW5nXG4gICAgICAgICAgICAvLyAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KVxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBcbiAgICAgICAgICAgICAgICBob3N0aXA6IHRoaXMuY29uZmlnLmhvc3RpcCwgXG4gICAgICAgICAgICAgICAgaW50ZXJmYWNlOiB0aGlzLmNvbmZpZy5pbnRlcmZhY2UsXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlSW50ZXJmYWNlczogdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzLFxuICAgICAgICAgICAgICAgIHByZWZlcnJlZEludGVyZmFjZTogdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gZG9lcyB3aGF0IGl0IHNheXMuLiAgaWYgbW9yZSB0aGFuIG9uZSBpbnRlcmZhY2UgaXMgZm91bmQgdGhpcyB3aWxsIHNldCB0aGUgcHJlZmVycmVkIGludGVyZmFjZVxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2V0UHJlZmVycmVkSW50ZXJmYWNlJywgKGV2ZW50LCBhcmcpID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJlZmVycmVkSW50ZXJmYWNlID0gYXJnXG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigndW5zZXRQcmVmZXJyZWRJbnRlcmZhY2UnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJlZmVycmVkSW50ZXJmYWNlID0gZmFsc2VcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBcbiAgICAgICAgICAgICAgICBob3N0aXA6IHRoaXMuY29uZmlnLmhvc3RpcCwgXG4gICAgICAgICAgICAgICAgaW50ZXJmYWNlOiB0aGlzLmNvbmZpZy5pbnRlcmZhY2UsXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlSW50ZXJmYWNlczogdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzLFxuICAgICAgICAgICAgICAgIHByZWZlcnJlZEludGVyZmFjZTogdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERvd25sb2FkcyB0aGUgZmlsZXMgZm9yIGEgc3BlY2lmaWMgc3R1ZGVudCB0byBoaXMgd29ya2RpcmVjdG9yeSAoYWJnYWJlKVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVPbmVkcml2ZUZpbGVzJywgYXN5bmMgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgbG9nLmluZm8oXCJkb3dubG9hZGluZyBvbmVkcml2ZSBmaWxlcy4uLlwiKSAgXG4gICAgICAgICAgICBjb25zdCBzdHVkZW50TmFtZSA9IGFyZ3Muc3R1ZGVudE5hbWVcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc1Rva2VuID0gYXJncy5hY2Nlc3NUb2tlblxuICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBhcmdzLmZpbGVOYW1lXG4gICAgICAgICAgICBjb25zdCBmaWxlSUQgPSBhcmdzLmZpbGVJRFxuICAgICAgICAgICAgY29uc3Qgc2VydmVybmFtZSA9IGFyZ3Muc2VydmVybmFtZVxuXG4gICAgICAgICAgICAvLyBjcmVhdGUgdXNlciBhYmdhYmUgZGlyZWN0b3J5ICAvLyBjcmVhdGUgYXJjaGl2ZSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGxldCBzdHVkZW50ZGlyZWN0b3J5ID0gIGpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHNlcnZlcm5hbWUgLHN0dWRlbnROYW1lKVxuICAgICAgICAgICAgbGV0IHRpbWUgPSBuZXcgRGF0ZShuZXcgRGF0ZSgpLmdldFRpbWUoKSkudG9Mb2NhbGVUaW1lU3RyaW5nKCk7ICAvL2NvbnZlcnQgdG8gbG9jYWxlIHN0cmluZyBvdGhlcndpc2UgdGhlIGZvbGRlcm5hbWVzIHdpbGwgYmUgY3JlYXRlZCBpbiBVVENcbiAgICAgICAgICAgIGxldCB0c3RyaW5nID0gU3RyaW5nKHRpbWUpLnJlcGxhY2UoLzovZywgXCJfXCIpO1xuICAgICAgICAgICAgbGV0IHN0dWRlbnRhcmNoaXZlZGlyID0gam9pbihzdHVkZW50ZGlyZWN0b3J5LCB0c3RyaW5nKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzdHVkZW50ZGlyZWN0b3J5KSkgeyBmcy5ta2RpclN5bmMoc3R1ZGVudGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7ICB9XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHN0dWRlbnRhcmNoaXZlZGlyKSl7IGZzLm1rZGlyU3luYyhzdHVkZW50YXJjaGl2ZWRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtsb2cuZXJyb3IoZSl9XG4gICAgICAgICBcblxuICAgICAgICAgICAgY29uc3QgZmlsZVJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vZ3JhcGgubWljcm9zb2Z0LmNvbS92MS4wL21lL2RyaXZlL2l0ZW1zLyR7ZmlsZUlEfS9jb250ZW50YCwge1xuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHthY2Nlc3NUb2tlbn1gLCAgfSxcbiAgICAgICAgICAgIH0pLmNhdGNoKCBlcnIgPT4ge2xvZy5lcnJvcihlcnIpfSk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZUJ1ZmZlciA9IGF3YWl0IGZpbGVSZXNwb25zZS5hcnJheUJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoam9pbihzdHVkZW50YXJjaGl2ZWRpciwgZmlsZU5hbWUpLCBCdWZmZXIuZnJvbShmaWxlQnVmZmVyKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfVxuXG4gICAgICAgICAgICBjb25zdCBwZGZGaWxlUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9ncmFwaC5taWNyb3NvZnQuY29tL3YxLjAvbWUvZHJpdmUvaXRlbXMvJHtmaWxlSUR9L2NvbnRlbnQ/Zm9ybWF0PXBkZmAsIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YWNjZXNzVG9rZW59YCwgIH0sXG4gICAgICAgICAgICB9KS5jYXRjaCggZXJyID0+IHtsb2cuZXJyb3IoZXJyKX0pO1xuXG4gICAgICAgICAgICBpZiAocGRmRmlsZVJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmRmlsZUJ1ZmZlciA9IGF3YWl0IHBkZkZpbGVSZXNwb25zZS5hcnJheUJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBkZkZpbGVQYXRoID0gam9pbihzdHVkZW50YXJjaGl2ZWRpciwgYCR7ZmlsZU5hbWV9LnBkZmApO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGRmRmlsZVBhdGgsIEJ1ZmZlci5mcm9tKHBkZkZpbGVCdWZmZXIpKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYERvd25sb2FkZWQgJHtmaWxlTmFtZX0gYW5kICR7ZmlsZU5hbWV9LnBkZmApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtsb2cuZXJyb3IoZSl9ICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcInRoZXJlIHdhcyBhIHByb2JsZW0gZG93bmxvYWRpbmcgdGhlIGZpbGVzIGFzIHBkZlwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0pXG5cblxuXG4gICAgfVxuXG4gICAgaXNQZGZVcmwodXJsKSB7XG4gICAgICAgIGxldCBwZGYgPSBmYWxzZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICBwZGYgPSAgdXJsLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5wZGYnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlcjogaXNQZGZVcmw6ICR7ZXJyfWApIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwZGZcbiAgICB9XG5cbiAgICBjb3B5Q29uZmlnKGNvbmYpIHtcbiAgICAgICAgbGV0IGNvbmZpZ0NvcHkgPSB7XG4gICAgICAgICAgICBkZXZlbG9wbWVudDogY29uZi5kZXZlbG9wbWVudCwgXG4gICAgICAgICAgICBzaG93ZGV2dG9vbHM6IGNvbmYuc2hvd2RldnRvb2xzLFxuICAgICAgICAgICAgYmlwSW50ZWdyYXRpb246IGNvbmYuYmlwSW50ZWdyYXRpb24sXG4gICAgICAgICAgICBiaXBEZW1vOiBjb25mLmJpcERlbW8sXG4gICAgICAgICAgICB3b3JrZGlyZWN0b3J5OiBjb25mLndvcmtkaXJlY3RvcnksXG4gICAgICAgICAgICB0ZW1wZGlyZWN0b3J5OiBjb25mLnRlbXBkaXJlY3RvcnksXG4gICAgICAgICAgICBzZXJ2ZXJkaXJlY3Rvcnk6IGNvbmYuc2VydmVyZGlyZWN0b3J5LFxuICAgICAgICAgICBcbiAgICAgICAgICAgIHNlcnZlckFwaVBvcnQ6IGNvbmYuc2VydmVyQXBpUG9ydCxcbiAgICAgICAgICAgIG11bHRpY2FzdENsaWVudFBvcnQ6IGNvbmYubXVsdGljYXN0Q2xpZW50UG9ydCxcbiAgICAgICAgICAgIG11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQ6IGNvbmYubXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydCxcbiAgICAgICAgICAgXG4gICAgICAgICAgICBtdWx0aWNhc3RTZXJ2ZXJBZHJyOiBjb25mLm11bHRpY2FzdFNlcnZlckFkcnIsXG4gICAgICAgICAgICBob3N0aXA6IGNvbmYuaG9zdGlwLFxuICAgICAgICAgICAgZ2F0ZXdheTogY29uZi5nYXRld2F5LFxuICAgICAgICAgICAgYWNjZXNzVG9rZW46IGNvbmYuYWNjZXNzVG9rZW4sXG4gICAgICAgICAgICB2ZXJzaW9uOiBjb25mLnZlcnNpb24sXG4gICAgICAgICAgICBpbmZvOiBjb25mLmluZm8sXG4gICAgICAgICAgICBidWlsZGZvcldFQjogY29uZi5idWlsZGZvcldFQixcbiAgICAgICAgICAgIGV4YW1tb2RlczogY29uZi5leGFtbW9kZXNcbiAgICAgICAgICB9O1xuICAgICAgICByZXR1cm4gY29uZmlnQ29weVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IElwY0hhbmRsZXIoKVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQXNCQSxPQUFPQSxVQUFTO0FBQ2hCLE9BQU8sV0FBVztBQUNsQixTQUFTLE9BQUFDLE1BQUssaUJBQUFDLGdCQUFlLGtCQUFrQixhQUFhLGdCQUFnQixZQUFZOzs7QUNuQnhGLElBQU0sU0FBUztBQUFBLEVBQ1gsYUFBYTtBQUFBO0FBQUEsRUFDYixjQUFjO0FBQUEsRUFDZCxnQkFBZ0I7QUFBQSxFQUNoQixXQUFXO0FBQUEsRUFFWCxlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBO0FBQUEsRUFDakIsaUJBQWlCO0FBQUEsRUFFakIsZUFBZTtBQUFBO0FBQUEsRUFDZixxQkFBcUI7QUFBQTtBQUFBLEVBQ3JCLDJCQUEyQjtBQUFBO0FBQUEsRUFFM0IscUJBQXFCO0FBQUEsRUFDckIsUUFBUTtBQUFBO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxFQUNiLFNBQVM7QUFBQSxFQUVULFdBQVc7QUFBQSxJQUNQLEtBQUs7QUFBQSxJQUNMLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLGNBQWM7QUFBQSxFQUNsQjtBQUFBLEVBRUEsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsYUFBYTtBQUFBLEVBQ2IsTUFBTTtBQUNWO0FBQ0EsSUFBTyxpQkFBUTs7O0FDM0JmLE9BQU8sYUFBYTtBQUNwQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sZ0JBQWdCOzs7QUNIdkIsU0FBUyxVQUFBQyxlQUFjOzs7QUNBdkIsU0FBUyxjQUFjOzs7QUNBdkIsU0FBUyxvQkFBb0I7QUFFN0IsT0FBTyxZQUFZO0FBQ25CLE9BQU8sU0FBUzs7O0FDcEJoQixTQUFTLG9CQUFvQjtBQUV0QixJQUFNLG1CQUFOLGNBQStCLGFBQWE7QUFBQSxFQUUvQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFFQSxZQUFZLFFBQW9CLElBQVk7QUFDeEMsVUFBTTtBQUNOLFNBQUssU0FBUztBQUNkLFNBQUssU0FBUztBQUNkLFNBQUssV0FBVztBQUNoQixTQUFLLFlBQVksV0FBVyxLQUFLLE1BQU07QUFBQSxFQUMzQztBQUFBLEVBRU8sUUFBUTtBQUNYLFFBQUksQ0FBQyxLQUFLLFFBQVE7QUFDZCxXQUFLLFNBQVMsWUFBWSxNQUFNLEtBQUssS0FBSyxTQUFTLEdBQUcsS0FBSyxRQUFRO0FBQUEsSUFDdkU7QUFBQSxFQUNKO0FBQUEsRUFFTyxPQUFPO0FBQ1YsUUFBSSxLQUFLLFFBQVE7QUFDYixvQkFBYyxLQUFLLE1BQU07QUFDekIsV0FBSyxTQUFTO0FBQUEsSUFDbEI7QUFBQSxFQUNKO0FBQ0o7OztBREFBLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxXQUFXO0FBQ2hCLFNBQUssYUFBYSxlQUFPO0FBQ3pCLFNBQUssaUJBQWlCLGVBQU87QUFDN0IsU0FBSyxTQUFTO0FBQ2QsU0FBSyxhQUFhO0FBQ2xCLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssVUFBVTtBQUNmLFNBQUssY0FBYyxDQUFDO0FBQ3BCLFNBQUssZUFBZSxDQUFDO0FBQUEsRUFDekI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxLQUFNLFlBQVksS0FBSyxVQUFVLE1BQUksT0FBTyxRQUFNLE1BQU07QUFDcEQsU0FBSyxTQUFTLGFBQWEsTUFBTTtBQUNqQyxTQUFLLGFBQWE7QUFBQSxNQUNkO0FBQUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsSUFBSSxRQUFRLFFBQVEsT0FBTyxXQUFXO0FBQUEsTUFDdEMsSUFBSSxlQUFPO0FBQUEsTUFDWCxhQUFhLFVBQVUsT0FBTyxXQUFXLENBQUM7QUFBQSxNQUMxQztBQUFBLE1BQ0EsU0FBUyxlQUFPO0FBQUEsSUFDcEI7QUFFQSxTQUFLLE9BQU8sS0FBSyxLQUFLLFVBQVMsV0FBWSxNQUFNO0FBQzdDLFdBQUssT0FBTyxhQUFhLElBQUk7QUFDN0IsV0FBSyxPQUFPLGdCQUFnQixHQUFHO0FBQy9CLFdBQUssT0FBTyxPQUFPLEdBQUc7QUFDdEIsV0FBSyxPQUFPLGNBQWMsS0FBSyxjQUFjO0FBSTdDLFdBQUssb0JBQW9CLElBQUksaUJBQWlCLEtBQUsscUJBQXFCLEtBQUssSUFBSSxHQUFHLEdBQUk7QUFDeEYsV0FBSyxrQkFBa0IsTUFBTTtBQUc3QixVQUFJLEtBQUssNkRBQTZELGVBQU8sTUFBTSxJQUFJLEtBQUssT0FBTyxRQUFRLEVBQUUsSUFBSSxFQUFFO0FBQUEsSUFDdkgsQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHVCQUF3QjtBQUNwQixTQUFLLFdBQVcsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUMvQyxRQUFJLFVBQVU7QUFBQSxNQUNWLFlBQVksS0FBSyxXQUFXO0FBQUEsTUFDNUIsV0FBVyxLQUFLLFdBQVc7QUFBQSxNQUMzQixJQUFJLEtBQUssV0FBVztBQUFBLE1BQ3BCLElBQUksS0FBSyxXQUFXO0FBQUEsTUFDcEIsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNyQixTQUFTLGVBQU87QUFBQSxJQUNwQjtBQUNBLFVBQU0sa0JBQWtCLElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxPQUFPLENBQUM7QUFDL0QsU0FBSyxPQUFPLEtBQUssaUJBQWlCLEdBQUcsZ0JBQWdCLFFBQVEsS0FBSyxZQUFZLEtBQUssY0FBYztBQUNqRyxTQUFLLE9BQU8sS0FBSyxpQkFBaUIsR0FBRyxnQkFBZ0IsUUFBUSxlQUFPLDJCQUEyQixLQUFLLGNBQWM7QUFBQSxFQUN0SDtBQUNKO0FBRUEsSUFBTywwQkFBUTs7O0FFL0VmLE9BQU8sV0FBVztBQUVsQixPQUFPQyxVQUFTO0FBT2hCLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxPQUFPLGVBQU87QUFDbkIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyxpQkFBaUIsQ0FBQztBQUN2QixTQUFLLHdCQUF3QjtBQUFBLEVBQ2pDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLEtBQU0sU0FBUztBQUNYLFNBQUssVUFBVTtBQUNmLFFBQUk7QUFDQSxXQUFLLFNBQVMsTUFBTSxhQUFhLE1BQU07QUFDdkMsV0FBSyxPQUFPLEtBQUssS0FBSyxNQUFNLFdBQVcsTUFBTTtBQUN6QyxhQUFLLE9BQU8sYUFBYSxJQUFJO0FBQzdCLGFBQUssT0FBTyxnQkFBZ0IsR0FBRztBQUMvQixZQUFJLEtBQUssU0FBUztBQUFFLGVBQUssT0FBTyxjQUFjLEtBQUssY0FBYztBQUFBLFFBQUU7QUFDbkUsWUFBSSxDQUFDLEtBQUssU0FBUztBQUFDLFVBQUFDLEtBQUksS0FBSyw4RkFBOEY7QUFBQSxRQUFDO0FBQzVILFFBQUFBLEtBQUksS0FBSyw2REFBNkQsZUFBTyxNQUFNLElBQUksS0FBSyxPQUFPLFFBQVEsRUFBRSxJQUFJLEVBQUU7QUFBQSxNQUN2SCxDQUFDO0FBQUEsSUFDTCxTQUNPLEtBQUk7QUFBQyxNQUFBQSxLQUFJLE1BQU0sR0FBRztBQUFBLElBQUM7QUFFMUIsU0FBSyxPQUFPLEdBQUcsV0FBVyxDQUFDLFNBQVMsVUFBVTtBQUFFLFdBQUssZ0JBQWdCLFNBQVMsS0FBSztBQUFBLElBQUUsQ0FBQztBQUd0RixTQUFLLHdCQUF3QixJQUFJLGlCQUFpQixLQUFLLHFCQUFxQixLQUFLLElBQUksR0FBRyxHQUFJO0FBQzVGLFNBQUssc0JBQXNCLE1BQU07QUFBQSxFQUdyQztBQUFBLEVBRUEsTUFBTSxPQUFRO0FBQ1YsUUFBSTtBQUNBLFdBQUssT0FBTyxlQUFlLEtBQUssY0FBYztBQUFBLElBQ2xELFNBQVEsR0FBRTtBQUFBLElBQUM7QUFDWCxTQUFLLE9BQU8sTUFBTTtBQUNsQixRQUFJLEtBQUssc0JBQXVCLE1BQUssc0JBQXNCLEtBQUs7QUFDaEUsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLGdCQUFpQixTQUFTLE9BQU87QUFDN0IsVUFBTSxhQUFhLEtBQUssTUFBTSxPQUFPLE9BQU8sQ0FBQztBQUM3QyxlQUFXLFdBQVcsTUFBTTtBQUM1QixlQUFXLGFBQWEsTUFBTTtBQUM5QixlQUFXLGFBQVksb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFFMUMsUUFBSSxLQUFLLGtCQUFrQixVQUFVLEdBQUc7QUFDcEMsTUFBQUEsS0FBSSxLQUFLLGdFQUFnRSxXQUFXLFVBQVUsaUJBQWlCO0FBQy9HLFdBQUssZUFBZSxLQUFLLFVBQVU7QUFBQSxJQUN2QztBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGtCQUFtQixLQUFLO0FBQ3BCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxlQUFlLFFBQVEsS0FBSztBQUNqRCxVQUFJLEtBQUssZUFBZSxDQUFDLEVBQUUsT0FBTyxJQUFJLElBQUk7QUFDdEMsYUFBSyxlQUFlLENBQUMsRUFBRSxZQUFZLElBQUk7QUFDdkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKO0FBQ0EsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLHVCQUF3QjtBQUNwQixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssZUFBZSxRQUFRLEtBQUs7QUFDakQsWUFBTSxPQUFNLG9CQUFJLEtBQUssR0FBRSxRQUFRO0FBQy9CLFVBQUksTUFBTSxPQUFRLEtBQUssZUFBZSxDQUFDLEVBQUUsV0FBVztBQUNoRCxRQUFBQSxLQUFJLEtBQUsscUVBQXFFLEtBQUssZUFBZSxDQUFDLEVBQUUsVUFBVSxhQUFhO0FBQzVILGFBQUssZUFBZSxPQUFPLEdBQUcsQ0FBQztBQUFBLE1BQ25DO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSjtBQUVBLElBQU8sMEJBQVEsSUFBSSxnQkFBZ0I7OztBSDdGbkMsT0FBT0MsYUFBWTtBQUVuQixPQUFPQyxXQUFVOzs7QUl0QmpCLFNBQVMsa0JBQWtCOzs7QUNEM0I7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFFWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVTtBQUFBLElBQ1YsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVM7QUFBQSxJQUNULFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUN6UkE7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFDWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBWTtBQUFBLElBQ1osYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVU7QUFBQSxJQUNWLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUduQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUZuUkEsSUFBTSxPQUFPLFdBQVc7QUFBQSxFQUNwQixRQUFRO0FBQUEsRUFDUixnQkFBZ0I7QUFBQSxFQUNoQixRQUFRO0FBQUEsRUFDUixVQUFVO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBQSxFQUNBO0FBQ0osQ0FBQztBQUVILElBQU8sa0JBQVE7OztBSlNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sV0FBVzs7O0FPNUJsQixTQUFTLFVBQVUsK0JBQStCO0FBRzNDLElBQU0sYUFBYTtBQUFBLEVBQ3hCLE1BQU07QUFBQSxJQUNKLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLGFBQWE7QUFBQSxJQUNiLHVCQUF1QjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsRUFDakI7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNKLGVBQWU7QUFBQSxNQUNYLGdCQUFnQixDQUFDLE9BQWlCLFNBQWlCLGdCQUF5QjtBQUN4RSxZQUFJLGFBQWE7QUFDYjtBQUFBLFFBQ0o7QUFDQSxnQkFBUSxPQUFPO0FBQUEsVUFDWCxLQUFLLFNBQVM7QUFDVixvQkFBUSxNQUFNLE9BQU87QUFDckI7QUFBQSxVQUNKLEtBQUssU0FBUztBQUNWLG9CQUFRLEtBQUssT0FBTztBQUNwQjtBQUFBLFVBQ0osS0FBSyxTQUFTO0FBQ1Ysb0JBQVEsTUFBTSxPQUFPO0FBQ3JCO0FBQUEsVUFDSixLQUFLLFNBQVM7QUFDVixvQkFBUSxLQUFLLE9BQU87QUFDcEI7QUFBQSxVQUNKO0FBQ0k7QUFBQSxRQUNSO0FBQUEsTUFDSjtBQUFBLE1BQ0EsVUFBVSxTQUFTO0FBQUEsSUFDdkI7QUFBQSxFQUNKO0FBQ0Y7QUFFTyxJQUFNLGVBQWUsSUFBSSx3QkFBd0IsVUFBVTs7O0FQWGxFLE9BQU9DLFVBQVM7OztBUVpoQixTQUFTLEtBQUssZUFBZSxRQUFRLGNBQWM7QUFDbkQsU0FBUyxZQUFZO0FBQ3JCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUM5QixPQUFPQyxVQUFTO0FBRWhCLElBQU0sWUFBWSxZQUFZO0FBSTlCLElBQU0sZ0JBQU4sTUFBb0I7QUFBQSxFQUNoQixjQUFlO0FBQ2IsU0FBSyxhQUFhO0FBQ2xCLFNBQUssYUFBYTtBQUNsQixTQUFLLFNBQVM7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGtCQUFrQjtBQUFBLEVBR3pCO0FBQUEsRUFFQSxLQUFNLElBQUlDLFNBQVE7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVNBO0FBQUEsRUFDbEI7QUFBQSxFQUtBLGtCQUFrQixTQUFTO0FBQ3ZCLFNBQUssWUFBWSxJQUFJLGNBQWM7QUFBQSxNQUMvQixPQUFPO0FBQUEsTUFDUCxNQUFNLEtBQUssV0FBVyw2QkFBNkI7QUFBQSxNQUNuRCxRQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxRQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixhQUFZO0FBQUEsTUFDWixpQkFBaUI7QUFBQTtBQUFBLE1BRWpCLGFBQWE7QUFBQTtBQUFBO0FBQUEsTUFHYixNQUFNO0FBQUE7QUFBQSxJQUVWLENBQUM7QUFFRCxRQUFJLFNBQVE7QUFBSSxXQUFLLFVBQVUsUUFBUSxtR0FBbUc7QUFBQSxJQUFJLE9BQ3pJO0FBQVcsV0FBSyxVQUFVLFFBQVEscUdBQXFHO0FBQUEsSUFBSTtBQUdoSixTQUFLLFVBQVUsWUFBWSxLQUFLLG1CQUFtQixNQUFNO0FBQ3JELFVBQUksS0FBSyxhQUFhLENBQUMsS0FBSyxVQUFVLFVBQVUsR0FBRztBQUMvQyxhQUFLLFVBQVUsS0FBSztBQUFBLE1BQ3hCO0FBQUEsSUFDSixDQUFDO0FBRUQsU0FBSyxVQUFVLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLFFBQVE7QUFDMUQsTUFBQUQsS0FBSSxLQUFLLGNBQWM7QUFDdkIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFBQSxJQUNoQixDQUFDO0FBQ0QsU0FBSyxVQUFVLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDM0QsTUFBQUEsS0FBSSxLQUFLLGVBQWU7QUFDeEIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFBQSxJQUNoQixDQUFDO0FBRUEsU0FBSyxVQUFVLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxRQUFRO0FBQ3pELE1BQUFBLEtBQUksS0FBSyxZQUFZO0FBQ3JCLE1BQUFBLEtBQUksS0FBSyxHQUFHO0FBQ1osWUFBTSxlQUFlO0FBQUEsSUFDekIsQ0FBQztBQUdBLFNBQUssVUFBVSxZQUFZLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQzFELE1BQUFBLEtBQUksS0FBSyxnQkFBZ0I7QUFDekIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFDWixhQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsSUFDNUIsQ0FBQztBQUVELFNBQUssVUFBVSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxRQUFRO0FBQzNELE1BQUFBLEtBQUksS0FBSyxtQkFBbUIsR0FBRztBQUUvQixVQUFJLElBQUksV0FBVyxtQkFBbUIsR0FBRztBQUNyQyxjQUFNLGVBQWU7QUFDckIsY0FBTSxTQUFTO0FBRWYsY0FBTSxRQUFRLElBQUksVUFBVSxPQUFPLE1BQU07QUFHekMsUUFBQUEsS0FBSSxLQUFLLGlCQUFpQjtBQUMxQixRQUFBQSxLQUFJLEtBQUssS0FBSztBQUNkLGFBQUssV0FBVyxZQUFZLEtBQUssWUFBWSxLQUFLO0FBQ2xELGFBQUssVUFBVSxNQUFNO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUVQO0FBQUEsRUFnQkEsZUFBZTtBQUNYLFVBQU0saUJBQWlCLE9BQU8sa0JBQWtCO0FBQ2hELFVBQU0sRUFBRSxPQUFPLE9BQU8sSUFBSSxFQUFFLE9BQU8sS0FBSyxRQUFRLElBQUk7QUFDcEQsVUFBTSxhQUFhLGNBQWMsSUFBSSxJQUFJLEtBQUssWUFBWSxHQUFHLENBQUM7QUFFOUQsU0FBSyxhQUFhLElBQUksY0FBYztBQUFBLE1BQ2hDLE9BQU87QUFBQSxNQUNQLGlCQUFpQjtBQUFBLE1BQ2pCLE1BQU07QUFBQSxNQUNOLE1BQU0sS0FBSyxXQUFXLDZCQUE2QjtBQUFBLE1BQ25ELFFBQVE7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLE1BQ0EsVUFBVTtBQUFBLE1BQ1YsV0FBVztBQUFBLE1BQ1gsZ0JBQWdCO0FBQUEsUUFDWixTQUFTLDZFQUNILEtBQUssUUFBUSxZQUFZLEtBQUssS0FBSyw0RUFBNEMsc0JBQThFLENBQUMsSUFDOUosS0FBSyxXQUFXLHdCQUF3QjtBQUFBLFFBQzlDLFlBQVk7QUFBQSxRQUNaLFlBQVk7QUFBQSxNQUNoQjtBQUFBLElBQ0osQ0FBQztBQUdELFNBQUssV0FBVyxZQUFZLEtBQUssbUJBQW1CLE1BQU07QUFDdEQsTUFBQUEsS0FBSSxLQUFLLGdFQUFnRTtBQUN6RSxVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDakQsYUFBSyxXQUFXLEtBQUs7QUFDckIsYUFBSyxXQUFXLFFBQVE7QUFBQSxNQUM1QjtBQUFBLElBQ0osQ0FBQztBQUVELFFBQUksSUFBSSxjQUFjLFFBQVEsSUFBSSxPQUFPLEdBQUc7QUFDeEMsWUFBTSxXQUFXLEtBQUssV0FBVyx3QkFBd0I7QUFDekQsTUFBQUEsS0FBSSxLQUFLLCtDQUErQyxRQUFRLEVBQUU7QUFDbEUsV0FBSyxXQUFXLFdBQVc7QUFDM0IsV0FBSyxXQUFXLFNBQVMsUUFBUTtBQUFBLElBQ3JDLE9BQU87QUFDSCxZQUFNLE1BQU07QUFDWixNQUFBQSxLQUFJLEtBQUssOENBQThDLEdBQUcsRUFBRTtBQUM1RCxXQUFLLFdBQVcsV0FBVztBQUMzQixXQUFLLFdBQVcsUUFBUSxHQUFHO0FBQUEsSUFDL0I7QUFFQSxRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsU0FBSyxXQUFXLFlBQVksUUFBUSx5QkFBeUIsQ0FBQyxTQUFTLGFBQWE7QUFDaEYsVUFBSSxFQUFFLFVBQVUsYUFBYSxzQkFBc0Isb0JBQW9CLFVBQVUsSUFBSTtBQUNyRixlQUFTLENBQUM7QUFBQSxJQUNkLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sV0FBVyxrQkFBa0IsY0FBYyxnQkFBZ0I7QUFDL0csTUFBQUEsS0FBSSxLQUFLLHVEQUF1RCxTQUFTLEtBQUssZ0JBQWdCLGFBQWEsWUFBWSxFQUFFO0FBRXpILFVBQUksS0FBSyxjQUFjLENBQUMsS0FBSyxXQUFXLFVBQVUsR0FBRztBQUNqRCxRQUFBQSxLQUFJLEtBQUssa0VBQWtFO0FBQzNFLGFBQUssV0FBVyxLQUFLO0FBQ3JCLGFBQUssV0FBVyxRQUFRO0FBQUEsTUFDNUI7QUFBQSxJQUNKLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sUUFBUTtBQUM1RCxZQUFNLGVBQWU7QUFBQSxJQUN6QixDQUFDO0FBRUQsU0FBSyxXQUFXLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxRQUFRO0FBQ3pELFlBQU0sZUFBZTtBQUFBLElBQ3pCLENBQUM7QUFFRCxTQUFLLFdBQVcsWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLElBQUksTUFBTTtBQUMxRCxhQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsSUFDNUIsQ0FBQztBQUdELFNBQUssV0FBVyxHQUFHLFNBQVMsT0FBUSxNQUFNO0FBQ3RDLFVBQUksQ0FBQyxLQUFLLE9BQU8sZUFBZSxLQUFLLFlBQVksWUFBWSxPQUFPLEVBQUUsU0FBUyxXQUFXLEdBQUc7QUFFekYsUUFBQUEsS0FBSSxLQUFLLDJEQUEyRDtBQUFHLFVBQUUsZUFBZTtBQUN4RixlQUFPLG1CQUFtQixLQUFLLFlBQVk7QUFBQSxVQUN2QyxNQUFNO0FBQUEsVUFDTixTQUFTLENBQUMsSUFBSTtBQUFBO0FBQUEsVUFDZCxXQUFXO0FBQUEsVUFDWCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsUUFDYixDQUFDO0FBQ0Q7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJLEtBQUs7QUFDVCxnQkFBUSxLQUFLLENBQUM7QUFBQSxNQUNsQjtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHFCQUFxQjtBQUNqQixVQUFNLGFBQWEsY0FBYyxJQUFJLElBQUksS0FBSyxZQUFZLEdBQUcsQ0FBQztBQUM5RCxTQUFLLGFBQWEsSUFBSSxjQUFjO0FBQUEsTUFDaEMsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsTUFBTSxLQUFLLFdBQVcsNkJBQTZCO0FBQUEsTUFDbkQsZ0JBQWdCO0FBQUEsUUFDWixTQUFTLDZFQUNILEtBQUssUUFBUSxZQUFZLEtBQUssS0FBSyw0RUFBNEMsc0JBQThFLENBQUMsSUFDOUosS0FBSyxXQUFXLHdCQUF3QjtBQUFBLE1BQ2xEO0FBQUEsSUFDSixDQUFDO0FBRUQsUUFBSSxNQUFNO0FBQ1YsU0FBSyxXQUFXLFFBQVEsR0FBRztBQUMzQixRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsU0FBSyxXQUFXLFlBQVksS0FBSyxtQkFBbUIsTUFBTTtBQUN0RCxVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDakQsYUFBSyxXQUFXLFdBQVc7QUFDM0IsYUFBSyxXQUFXLGVBQWUsS0FBSztBQUNwQyxhQUFLLFdBQVcsS0FBSztBQUNyQixhQUFLLFdBQVcsUUFBUTtBQUFBLE1BQzVCO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTDtBQUNKO0FBRUEsSUFBTyx3QkFBUSxJQUFJLGNBQWM7OztBUnhPakMsT0FBTyxlQUFlO0FBR3RCLFNBQVMsT0FBQUUsWUFBVztBQWxCcEIsSUFBTSxTQUFTLE9BQU87QUFPdEIsSUFBTSxFQUFFLEVBQUUsSUFBSSxnQkFBSztBQVNuQixJQUFJLGtCQUFrQjtBQUd0QixJQUFNQyxhQUFZLFlBQVk7QUFDOUIsSUFBTSxNQUFNLEdBQUc7QUFTZixPQUFPLElBQUksVUFBVSxDQUFDLEtBQUssUUFBUTtBQUMvQixRQUFNLGVBQWUscUJBQXFCO0FBQzFDLFFBQU0sZ0JBQWdCLGdCQUFnQixPQUFPLE9BQU8sS0FBSyxjQUFjLE9BQU8sQ0FBQyxDQUFDO0FBQ2hGLE1BQUksT0FBTyxnQkFBZ0IsY0FBYyxFQUFFLFVBQVUsS0FBSyxDQUFDO0FBQzNELGlCQUFPLGVBQWU7QUFFdEIsUUFBTSxnQkFBZ0I7QUFBQSxJQUNsQixXQUFXLFdBQVcsS0FBSztBQUFBLElBQzNCLGVBQWU7QUFBQSxJQUNmLGNBQWMsV0FBVyxLQUFLO0FBQUEsSUFDOUIsZUFBZTtBQUFBLElBQ2YsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBLElBQ1AsZ0JBQWdCO0FBQUEsSUFDaEIsdUJBQXVCO0FBQUEsRUFDM0I7QUFDQSxRQUFNLFVBQVUsa0VBQWtFLEdBQUcsVUFBVSxhQUFhLENBQUM7QUFDN0csTUFBSSxTQUFTLE9BQU87QUFDeEIsQ0FBQztBQU9ELE9BQU8sSUFBSSxXQUFXLE9BQU8sS0FBSyxRQUFRO0FBQ3RDLFFBQU0sT0FBTyxJQUFJLE1BQU07QUFDdkIsUUFBTSxlQUFnQixlQUFPO0FBQzdCLE1BQUk7QUFDQSxVQUFNLFdBQVcsTUFBTSxNQUFNLEtBQUssOERBQThELEdBQUcsVUFBVTtBQUFBLE1BQ3pHLFdBQVcsV0FBVyxLQUFLO0FBQUEsTUFDM0IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1A7QUFBQSxNQUNBLGNBQWMsV0FBVyxLQUFLO0FBQUEsTUFDOUIsZUFBZTtBQUFBLElBQ2YsQ0FBQyxHQUFHO0FBQUEsTUFDSixTQUFTO0FBQUEsUUFDTCxnQkFBZ0I7QUFBQSxRQUNoQixVQUFVO0FBQUEsTUFDZDtBQUFBLElBQ0osQ0FBQztBQUVELG1CQUFPLGNBQWMsU0FBUyxLQUFLO0FBRW5DLFFBQUksT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWdCWCxRQUFJLEtBQUssSUFBSTtBQUFBLEVBQ2pCLFNBQVMsT0FBTztBQUNaLFlBQVEsTUFBTSxNQUFNLFNBQVMsSUFBSTtBQUNqQyxRQUFJLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFVRyxNQUFNLFNBQVMsS0FBSyxpQkFBaUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUtuRCxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssSUFBSTtBQUFBLEVBQzdCO0FBQ0YsQ0FBQztBQWFGLE9BQU8sS0FBSywrQkFBK0IsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFFeEUsTUFBSSxDQUFDLHFCQUFxQixLQUFLLEdBQUcsRUFBRztBQUVyQyxRQUFNLE1BQU0sSUFBSSxLQUFLO0FBQ3JCLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFFdkIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFLakQsTUFBSSxNQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFFLEdBQUksSUFBSSxHQUFJO0FBQ3RELE1BQUksZUFBTyxhQUFZO0FBQUUsVUFBTTtBQUFBLEVBQU87QUFHdEMsTUFBSSxVQUFVO0FBQ1YsV0FBTyxJQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFDO0FBQUEsRUFDNUY7QUFFQSxhQUFXLFFBQVEsd0JBQWdCLGdCQUFnQjtBQUMvQyxRQUFJLGNBQWMsS0FBSyxZQUFZO0FBQy9CLGFBQU8sSUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx5QkFBeUIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQy9GO0FBQUEsRUFDSDtBQUVELEVBQUFDLEtBQUksS0FBSyxrREFBa0QsVUFBVTtBQUNyRSxNQUFJLE1BQU0sSUFBSSx3QkFBZ0I7QUFFOUIsTUFBSSxDQUFDLElBQUksT0FBTyxRQUFPO0FBQ25CLFFBQUksS0FBSyxZQUFZLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxFQUM1QyxPQUNLO0FBQ0QsUUFBSSxLQUFLLFlBQVksS0FBSyxJQUFJLE9BQU8sUUFBUSxLQUFLLEtBQUs7QUFBQSxFQUMzRDtBQUVBLGlCQUFPLGVBQWUsVUFBVSxJQUFFO0FBRWxDLE1BQUksb0JBQW9CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFVBQVU7QUFFbEUsTUFBSTtBQUNBLFVBQU0sR0FBRyxTQUFTLE1BQU0sbUJBQW1CLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxFQUNsRSxTQUFTLEtBQUs7QUFBQSxFQUVkO0FBQ0EsTUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBQztBQUV4RixDQUFDO0FBU0EsT0FBTyxJQUFJLDRDQUE0QyxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQzlFLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBRWpELE1BQUksWUFBWSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBRTVFLGFBQVMsa0JBQWtCLEtBQUs7QUFFaEMsYUFBUyxPQUFPLE1BQU07QUFFdEIsV0FBTyxlQUFPLGVBQWUsVUFBVTtBQUN2QyxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHVCQUF1QixHQUFHLFFBQVEsVUFBUyxDQUFDO0FBQUEsRUFHeEY7QUFDSixDQUFDO0FBUUEsT0FBTyxJQUFJLHFDQUFxQyxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3ZFLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsTUFBSSxTQUFTLElBQUksT0FBTztBQUN4QixNQUFJLENBQUMsUUFBTztBQUFFLGFBQVM7QUFBQSxFQUFFO0FBQ3pCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUVqRCxNQUFJLFVBQVU7QUFDVixRQUFJLFdBQVcsU0FBUyxXQUFXLFVBQVM7QUFDNUMsYUFBTyxJQUFJLEtBQU07QUFBQSxRQUNiLFFBQVE7QUFBQSxRQUNSLFNBQVMsRUFBRSxtQkFBbUI7QUFBQSxRQUM5QixRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsVUFDTixLQUFLLFNBQVMsV0FBVztBQUFBLFVBQ3pCLGFBQWEsU0FBUyxXQUFXO0FBQUEsVUFDakMsVUFBVSxTQUFTLFdBQVc7QUFBQSxRQUM5QjtBQUFBLE1BQ0osQ0FBRTtBQUFBLElBQUMsT0FDRTtBQUFFLGFBQU8sSUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxpQkFBaUIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQUU7QUFBQSxFQUNoRyxPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLEVBQ2pGO0FBQ0osQ0FBQztBQU1ELE9BQU8sSUFBSSxlQUFlLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDaEQsTUFBSSxhQUFhLENBQUM7QUFDbEIsU0FBTyxPQUFPLGVBQU8sY0FBYyxFQUFFLFFBQVMsQ0FBQUMsWUFBVTtBQUNwRCxlQUFXLEtBQUssRUFBQyxZQUFZQSxRQUFPLFdBQVcsWUFBWSxJQUFJQSxRQUFPLFdBQVcsSUFBSSxVQUFVQSxRQUFPLFdBQVcsSUFBSSxXQUFXLE1BQU0sVUFBVUEsUUFBTyxXQUFXLFVBQVUsU0FBU0EsUUFBTyxXQUFXLFFBQU8sQ0FBQztBQUFBLEVBQ25OLENBQUM7QUFDRCxNQUFJLEtBQUssRUFBQyxZQUF1QixRQUFRLFVBQVMsQ0FBQztBQUN2RCxDQUFDO0FBS0EsT0FBTyxJQUFJLFNBQVMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzQyxNQUFJLEtBQUssTUFBTTtBQUNuQixDQUFDO0FBR0QsT0FBTyxLQUFLLFNBQVMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzQyxNQUFJLEtBQUssRUFBRSxRQUFRLFVBQVMsQ0FBQztBQUNqQyxDQUFDO0FBS0QsSUFBSSxjQUFjLENBQUM7QUFDbkIsU0FBUyxJQUFJLEdBQUcsSUFBRSxJQUFJLEtBQUs7QUFDdkIsTUFBSSxhQUFhO0FBQUEsSUFDYixZQUFZLFFBQVNDLFFBQU8sWUFBWSxDQUFDLEVBQUUsU0FBUyxLQUFLLENBQUc7QUFBQSxJQUM1RCxPQUFPLFFBQVFBLFFBQU8sV0FBVyxDQUFDO0FBQUEsSUFDbEMsSUFBSTtBQUFBLElBQ0osVUFBVTtBQUFBLElBQ1YsVUFBVTtBQUFBLElBQ1YsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsWUFBVyxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUFBLElBQzlCLGFBQWE7QUFBQTtBQUFBLElBQ2IsVUFBVztBQUFBLElBQ1gsS0FBSztBQUFBLElBQ0wsWUFBWTtBQUFBLElBQ1osVUFBUztBQUFBLElBQ1QsUUFBUyxDQUFDO0FBQUEsRUFDZDtBQUNBLGNBQVksS0FBSyxVQUFVO0FBQy9CO0FBa0JDLE9BQU8sSUFBSSx3RkFBd0YsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDaEksUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsSUFBSSxPQUFPO0FBQzVCLFFBQU0sTUFBTSxJQUFJLE9BQU87QUFDdkIsUUFBTSxVQUFVLElBQUksT0FBTztBQUMzQixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sUUFBUSxRQUFRQSxRQUFPLFdBQVcsQ0FBQztBQUN6QyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxXQUFXLElBQUksT0FBTztBQUM1QixRQUFNLFlBQVksSUFBSSxPQUFPO0FBRTdCLEVBQUFILEtBQUksS0FBSyw2Q0FBNEMsT0FBTztBQUU1RCxNQUFJLFdBQVcsZUFBTyxRQUFRLE1BQU0sR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLEdBQ25ELGlCQUFpQixTQUFTLEtBQUssR0FBRztBQUNsQyxNQUFJLFdBQVcsUUFBUSxNQUFNLEdBQUcsRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUM1QyxpQkFBaUIsU0FBUyxLQUFLLEdBQUc7QUFJbEMsTUFBSSxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsa0JBQWtCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFHO0FBQ3hHLE1BQUksR0FBRyxjQUFjLE9BQU8sZ0JBQWlCO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLHlCQUF5QixHQUFHLFFBQVEsU0FBUyxTQUFTLGVBQU8sU0FBUyxhQUFhLGVBQU8sS0FBSSxDQUFFO0FBQUEsRUFBRztBQUVoTSxNQUFJLFNBQVMsYUFBYSxjQUFjLGFBQWEsU0FBUTtBQUN6RCxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUscUJBQXFCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUMxRjtBQUNBLE1BQUk7QUFDQSxRQUFJLE9BQU8sU0FBUyxXQUFXLEtBQUs7QUFDaEMsVUFBSSxtQkFBbUIsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLGVBQWUsVUFBVTtBQUk3RixVQUFJLENBQUMsa0JBQWtCO0FBQ25CLFFBQUFBLEtBQUksS0FBSyxnREFBZ0QsVUFBVSxHQUFHO0FBSXRFLFlBQUksUUFBUTtBQUNaLFlBQUksU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxRQUFRLE9BQU8sU0FBUyxVQUFVLEdBQUc7QUFBRSxrQkFBUTtBQUFBLFFBQUssV0FDdkgsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxRQUFRLE9BQU8sU0FBUyxVQUFVLEdBQUc7QUFBRSxrQkFBUTtBQUFBLFFBQU0sT0FDakk7QUFDRCxrQkFBUTtBQUNULG1CQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLE9BQU8sTUFBTSxLQUFLLFVBQVU7QUFBQSxRQUV2RztBQUVBLGNBQU0sU0FBUztBQUFBO0FBQUEsVUFDWDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsWUFBVyxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUFBLFVBQzlCLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLFVBQVM7QUFBQSxVQUNULGFBQWE7QUFBQSxVQUNiO0FBQUE7QUFBQSxVQUNBLFFBQVEsRUFBRSxPQUFPLFNBQVMsSUFBRztBQUFBO0FBQUE7QUFBQSxRQUVqQztBQUVBLFlBQUksZ0JBQWVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQWEsVUFBVTtBQUc5RixZQUFJO0FBQ0EsZ0JBQU0sR0FBRyxTQUFTLE9BQU8sYUFBYTtBQUt0QyxnQkFBTSxZQUFZQSxNQUFLLFFBQVEsYUFBYTtBQUM1QyxnQkFBTSxnQkFBZ0JBLE1BQUssU0FBUyxhQUFhO0FBQ2pELGdCQUFNLGVBQWUsTUFBTSxHQUFHLFNBQVMsUUFBUSxXQUFXLEVBQUUsZUFBZSxLQUFLLENBQUMsR0FDNUQsT0FBTyxZQUFVLE9BQU8sWUFBWSxDQUFDLEVBQ3JDLElBQUksWUFBVSxPQUFPLElBQUk7QUFHOUMsY0FBSSxDQUFDLFlBQVksU0FBUyxhQUFhLEdBQUc7QUFFdEMsa0JBQU0sY0FBYyxZQUFZLEtBQUssU0FBTyxJQUFJLFlBQVksTUFBTSxjQUFjLFlBQVksQ0FBQztBQUM3RixnQkFBSSxhQUFhO0FBQ2Isb0JBQU0sVUFBVUEsTUFBSyxLQUFLLFdBQVcsV0FBVztBQUNoRCxvQkFBTSxVQUFVQSxNQUFLLEtBQUssV0FBVyxVQUFVLFdBQVcsRUFBRTtBQUM1RCxvQkFBTSxHQUFHLFNBQVMsT0FBTyxTQUFTLE9BQU87QUFDekMsY0FBQUQsS0FBSSxLQUFLLHNDQUFzQyxPQUFPLE9BQU8sT0FBTyxzREFBc0Q7QUFBQSxZQUM5SDtBQUFBLFVBQ0osT0FDSztBQUNELFlBQUFBLEtBQUksS0FBSywrREFBK0QsYUFBYSxFQUFFO0FBQUEsVUFDM0Y7QUFBQSxRQUNKLFNBQVMsS0FBSztBQUVWLGNBQUk7QUFDQSxrQkFBTSxHQUFHLFNBQVMsTUFBTSxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDMUQsWUFBQUEsS0FBSSxLQUFLLHNDQUFzQyxhQUFhLEVBQUU7QUFBQSxVQUNsRSxTQUFTLFVBQVU7QUFDZixZQUFBQSxLQUFJLE1BQU0sdURBQXVELFFBQVEsRUFBRTtBQUFBLFVBQy9FO0FBQUEsUUFDSjtBQUVBLFlBQUk7QUFDQSxnQkFBTSxHQUFHLFNBQVMsTUFBTSxlQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQ3JFLFNBQVMsS0FBSztBQUFBLFFBRWQ7QUFFQSxpQkFBUyxZQUFZLEtBQUssTUFBTTtBQUNoQyxlQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsb0JBQW9CLEdBQUcsUUFBUSxXQUFXLE1BQVksQ0FBQztBQUFBLE1BQ3hHLE9BQ0s7QUFFRCxZQUFJLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFDN0IsWUFBSSxNQUFNLE1BQVEsaUJBQWlCLFdBQVc7QUFDMUMsMkJBQWlCLFlBQVk7QUFDN0IsVUFBQUEsS0FBSSxLQUFLLCtDQUErQztBQUd4RCxnQ0FBYyxXQUFXLFlBQVksS0FBSyxlQUFlLGdCQUFnQjtBQUN6RSxpQkFBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLG9CQUFvQixHQUFHLFFBQVEsV0FBVyxPQUFPLGlCQUFpQixNQUFLLENBQUM7QUFBQSxRQUN6SCxPQUNLO0FBQ0QsaUJBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSwyQkFBMkIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLFFBQy9GO0FBQUEsTUFDSjtBQUFBLElBQ0osT0FDSztBQUNELGFBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQ3RGO0FBQUEsRUFDSixTQUNPLEtBQUk7QUFDUCxJQUFBQSxLQUFJLE1BQU0sNkJBQTZCLEdBQUcsRUFBRTtBQUM1QyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLDRCQUE0QixRQUFRLFFBQU8sQ0FBQztBQUFBLEVBQzNGO0FBQ0osQ0FBQztBQXlCQSxPQUFPLEtBQUssNERBQTRELFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDL0YsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLGVBQWUsSUFBSSxPQUFPO0FBQ2hDLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLGlCQUFpQixPQUFNO0FBQ3ZCLGVBQVMsV0FBVyxTQUFTLGFBQVk7QUFDckMsZ0JBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsZ0JBQVEsT0FBTyxPQUFPLElBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0osT0FDSztBQUNELFVBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFVBQUksU0FBUztBQUNULGdCQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLGdCQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsTUFDOUI7QUFBQSxJQUNKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxxQkFBcUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3ZGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBeUNELE9BQU8sS0FBSyx5REFBeUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzRixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sWUFBWSxJQUFJLEtBQUs7QUFFM0IsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFFBQUksU0FBUztBQUNULGNBQVEsT0FBTyxnQkFBZ0I7QUFBQSxJQUNsQztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN6RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVdBLE9BQU8sSUFBSSx1REFBdUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUN6RixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBRWpELE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixRQUFJLFNBQVM7QUFDVCxjQUFRLE9BQU8sb0JBQW9CO0FBQUEsSUFDdEM7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsVUFBUyxDQUFFO0FBQUEsRUFDeEYsT0FDSztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsc0JBQXNCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUN0RjtBQUNKLENBQUM7QUF5QkEsT0FBTyxJQUFJLHFEQUFxRCxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3ZGLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksaUJBQWlCLE9BQU07QUFDdkIsZUFBUyxXQUFXLFNBQVMsYUFBWTtBQUFFLGdCQUFRLE9BQU8sVUFBVSxJQUFJO0FBQUEsTUFBTTtBQUFBLElBQ2xGLE9BQ0s7QUFDRCxVQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixVQUFJLFNBQVM7QUFBRyxnQkFBUSxPQUFPLFVBQVUsSUFBRztBQUFBLE1BQU07QUFBQSxJQUN0RDtBQUNBLFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUscUJBQXFCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN2RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVlELE9BQU8sS0FBSyxpREFBaUQsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosUUFBTSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLG1CQUFtQjtBQUNwRyxNQUFJO0FBQ0osTUFBSTtBQUNBLFVBQU0sY0FBYyxNQUFNLEdBQUcsU0FBUyxTQUFTLFVBQVUsT0FBTztBQUNoRSxtQkFBZSxLQUFLLE1BQU0sV0FBVztBQUNyQyxhQUFTLFdBQVcsTUFBTSxhQUFhO0FBQUEsRUFDM0MsU0FDTyxPQUFPO0FBQUcsbUJBQWU7QUFBQSxFQUFRO0FBQ3hDLFNBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFFBQVEsV0FBVyxhQUEwQixDQUFDO0FBQ3JGLENBQUM7QUFHRCxPQUFPLElBQUksd0RBQXdELFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosU0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsUUFBUSxXQUFXLGNBQWMsU0FBUyxhQUFZLENBQUM7QUFDOUYsQ0FBQztBQVlELE9BQU8sS0FBSyxpREFBaUQsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosV0FBUyxlQUFlLElBQUksS0FBSztBQUNqQyxXQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLGVBQWU7QUFHdkYsRUFBQUQsS0FBSSxLQUFLLHlEQUF5RDtBQUVsRSxRQUFNLFVBQVVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFVBQVU7QUFDOUUsUUFBTSxXQUFXQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLG1CQUFtQjtBQUVwRyxNQUFJO0FBQ0EsVUFBTSxHQUFHLFNBQVMsTUFBTSxTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDcEQsVUFBTSxhQUFhLEtBQUssVUFBVSxTQUFTLGNBQWMsTUFBTSxDQUFDO0FBRWhFLFNBQUssTUFBTSxVQUFVO0FBQ3JCLFVBQU0sR0FBRyxTQUFTLFVBQVUsVUFBVSxVQUFVO0FBQUEsRUFDcEQsU0FDTyxPQUFPO0FBQ1YsSUFBQUQsS0FBSSxNQUFNLDhCQUE4QixLQUFLLEVBQUc7QUFDaEQsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUSx1Q0FBdUMsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUN4RztBQUVBLE1BQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLEVBQUUsWUFBWSxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQzdFLENBQUM7QUFzQkQsT0FBTyxLQUFLLGdFQUFnRSxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ2xHLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsUUFBTSxjQUFjLElBQUksS0FBSztBQUM3QixRQUFNLFlBQVksSUFBSSxLQUFLO0FBQzNCLFFBQU0sNEJBQTRCLElBQUksS0FBSztBQUMzQyxRQUFNLDZCQUE2QixJQUFJLEtBQUs7QUFDNUMsUUFBTSxxQkFBcUIsSUFBSSxLQUFLO0FBQ3BDLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFDdkIsUUFBTSxTQUFTLElBQUksS0FBSztBQUN4QixRQUFNLGdCQUFnQixJQUFJLEtBQUs7QUFDL0IsUUFBTSxlQUFlLElBQUksS0FBSztBQUc5QixNQUFJLElBQUksT0FBTyxvQkFBb0IsU0FBUyxXQUFXLGFBQWE7QUFFaEUsUUFBSSxpQkFBaUIsT0FBTTtBQUN2QixlQUFTLFdBQVcsU0FBUyxhQUFZO0FBQ3JDLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSxPQUFPO0FBQUMsa0JBQVEsT0FBTyxRQUFRO0FBQUEsUUFBTztBQUMxQyxZQUFJLE9BQU8sa0JBQWtCLGFBQWE7QUFBQyxrQkFBUSxPQUFPLGdCQUFnQjtBQUFBLFFBQWU7QUFDekYsWUFBSSxjQUFjO0FBQUMsa0JBQVEsT0FBTyxlQUFlO0FBQUEsUUFBTTtBQUFBLE1BQzNEO0FBQUEsSUFDSixPQUNLO0FBQ0QsVUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsVUFBSSxTQUFTO0FBRVQsWUFBSSxhQUFZO0FBQ1osa0JBQVEsT0FBTyxjQUFjO0FBQzdCLGtCQUFRLGVBQWU7QUFBQSxRQUMzQjtBQUNBLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSwyQkFBMkI7QUFDM0Isa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyw2QkFBNkI7QUFBQSxRQUNoRCxPQUNLO0FBQ0Qsa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyxzQkFBc0I7QUFBQSxRQUN6QztBQUNBLFlBQUksc0JBQXNCLE1BQUs7QUFBRSxrQkFBUSxlQUFlO0FBQUEsUUFBTTtBQUM5RCxZQUFJLE9BQU87QUFBQyxrQkFBUSxPQUFPLFFBQVE7QUFBQSxRQUFPO0FBQzFDLFlBQUksT0FBTyxrQkFBa0IsYUFBYTtBQUFDLGtCQUFRLE9BQU8sZ0JBQWdCO0FBQUEsUUFBZTtBQUN6RixZQUFJLFFBQVE7QUFBRSxrQkFBUSxPQUFPLFNBQVM7QUFBQSxRQUFLO0FBQzNDLFlBQUksY0FBYztBQUFDLGtCQUFRLE9BQU8sZUFBZTtBQUFBLFFBQU07QUFBQSxNQUkzRDtBQUNBLFVBQUksT0FBTSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUU3QixVQUFJLE1BQU0sTUFBUSxRQUFRLGFBQWEsUUFBUSxPQUFPLFFBQVc7QUFDN0QsWUFBSUksV0FBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFlBQUlBLFVBQVM7QUFBSSxtQkFBUyxjQUFjLFNBQVMsWUFBWSxPQUFRLFFBQU0sR0FBRyxVQUFXLFlBQVk7QUFBQSxRQUFHO0FBQUEsTUFDNUc7QUFBQSxJQUVKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3pGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBa0JBLE9BQU8sS0FBSyxXQUFXLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDOUMsUUFBTSxhQUFhLElBQUksS0FBSztBQUM1QixRQUFNLGVBQWUsV0FBVztBQUNoQyxRQUFNLFdBQVcsV0FBVztBQUM1QixRQUFNLGFBQWEsV0FBVztBQUc5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsTUFBSyxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLGdCQUFnQixRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFFbEcsTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsTUFBSyxDQUFDLFNBQVU7QUFBQyxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLFdBQVcsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUFFO0FBRzNGLFVBQVEsUUFBUSxXQUFXO0FBQzNCLFVBQVEsY0FBYyxXQUFXO0FBQ2pDLFVBQVEsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUN2QyxVQUFRLFdBQVc7QUFDbkIsVUFBUSxRQUFRLFdBQVc7QUFDM0IsVUFBUSxrQkFBa0IsV0FBVztBQUVyQyxNQUFJLFdBQVcsT0FBTztBQUFFLFlBQVEsT0FBTyxvQkFBb0I7QUFBQSxFQUFNO0FBQ2pFLE1BQUksV0FBVyxzQkFBc0IsR0FBRTtBQUFFLFlBQVEsV0FBVztBQUFBLEVBQXlCO0FBRXJGLE1BQUksZ0JBQWdCLEtBQUssTUFBTSxLQUFLLFVBQVUsUUFBUSxNQUFNLENBQUM7QUFHN0QsTUFBSSxRQUFRLE9BQU8sUUFBVztBQUMxQixRQUFJQSxXQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsUUFBSUEsVUFBUztBQUFJLGVBQVMsY0FBYyxTQUFTLFlBQVksT0FBUSxRQUFNLEdBQUcsVUFBVyxZQUFZO0FBQUEsSUFBRztBQUFBLEVBQzVHO0FBSUEsVUFBUSxPQUFPLGNBQWM7QUFDN0IsVUFBUSxPQUFPLFlBQVk7QUFDM0IsVUFBUSxPQUFPLFdBQVc7QUFDMUIsVUFBUSxPQUFPLFFBQVE7QUFDdkIsVUFBUSxPQUFPLGVBQWU7QUFLOUIsUUFBTSxtQkFBbUIsRUFBRSxHQUFHLFNBQVMsYUFBYTtBQUNwRCxtQkFBaUIsZUFBZSxFQUFFLEdBQUcsU0FBUyxhQUFhLGFBQWE7QUFHeEUsV0FBUyxjQUFjLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHO0FBQ2pDLFFBQUksaUJBQWlCLGFBQWEsVUFBVSxHQUFHO0FBQzNDLHVCQUFpQixhQUFhLFVBQVUsSUFBSTtBQUFBLFFBQ3hDLEdBQUcsaUJBQWlCLGFBQWEsVUFBVTtBQUFBLFFBQzNDLFFBQVE7QUFBQSxVQUNKLEdBQUcsaUJBQWlCLGFBQWEsVUFBVSxFQUFFO0FBQUEsVUFDN0Msc0JBQXNCLENBQUM7QUFBQSxRQUMzQjtBQUFBLFFBQ0EsUUFBUTtBQUFBLFVBQ0osR0FBRyxpQkFBaUIsYUFBYSxVQUFVLEVBQUU7QUFBQSxVQUM3QyxzQkFBc0IsQ0FBQztBQUFBLFFBQzNCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBRUEsTUFBSSxVQUFVO0FBQ2QsTUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFPLFdBQVcsY0FBYSxrQkFBa0IsY0FBNkIsQ0FBQztBQUNuSixDQUFDO0FBU0QsT0FBTyxLQUFLLHFCQUFxQixlQUFnQixLQUFLLEtBQUssTUFBTTtBQUM3RCxRQUFNLGFBQWEsSUFBSSxLQUFLO0FBQzVCLFFBQU0sZUFBZSxXQUFXO0FBQ2hDLFFBQU0sYUFBYSxXQUFXO0FBRzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxNQUFLLENBQUMsVUFBVTtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsZ0JBQWdCLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUNsRyxNQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixNQUFLLENBQUMsU0FBVTtBQUFDLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFNBQVEsdUJBQXVCLFFBQVEsUUFBUSxDQUFDO0FBQUEsRUFBRTtBQUV2RyxNQUFJLElBQUksS0FBSyxZQUFhO0FBQ3RCLFVBQU0sbUJBQW1CLElBQUksS0FBSztBQUc5QixZQUFRLFdBQVcsNEJBQTRCO0FBRy9DLFFBQUksU0FBUyxhQUFhLFlBQVksU0FBUyxhQUFhLGlCQUFpQixDQUFDLFFBQVEsT0FBTyxxQkFBcUIsUUFBUSxPQUFNO0FBQzVILFVBQUc7QUFDQyxjQUFNLFNBQVMsSUFBSSxLQUFLLE9BQU8sTUFBTSxVQUFVLEVBQUUsSUFBSTtBQUNyRCxjQUFNLG9CQUFvQixPQUFPLEtBQUssUUFBUSxRQUFRO0FBR3RELGNBQU1DLGNBQWFQLEtBQUksYUFDckJHLE1BQUssS0FBSyxRQUFRLGVBQWMscUJBQXFCLFFBQVEsSUFDN0RBLE1BQUssUUFBUUYsWUFBVyxjQUFjO0FBRXhDLFlBQUksQ0FBQyxpQkFBZ0I7QUFDakIsNEJBQWtCLE1BQU0sVUFBVSxhQUFhLE9BQU0sR0FBRTtBQUFBLFlBQ25ELFVBQVVNO0FBQUEsVUFDZCxDQUFDO0FBQUEsUUFDTDtBQUVBLGNBQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUssTUFBTSxnQkFBZ0IsVUFBVSxpQkFBaUI7QUFDN0UsWUFBSSxpQkFBaUIsS0FBSyxTQUFTLFNBQVMsV0FBVyxHQUFHO0FBRTFELFlBQUksQ0FBQyxnQkFBZTtBQUNoQixrQkFBUSxRQUFRO0FBQ2hCLGtCQUFRLE9BQU8sUUFBUTtBQUN2QixVQUFBTCxLQUFJLEtBQUssZ0ZBQWdGO0FBQUEsUUFDN0Y7QUFBQSxNQUNKLFNBQ00sS0FBSTtBQUFFLFFBQUFBLEtBQUksS0FBSyxxQ0FBcUMsR0FBRyxFQUFFO0FBQUEsTUFBRztBQUFBLElBQ3RFO0FBRUEsUUFBSSxDQUFDLFFBQVEsT0FBTztBQUNoQixNQUFBQSxLQUFJLEtBQUsseUVBQXlFO0FBQ2xGLFVBQUksUUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFDbkUsVUFBSSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxXQUFXO0FBQzlHLFVBQUksbUJBQW1CQSxNQUFLLEtBQUssVUFBVSxHQUFHLElBQUksSUFBSSxJQUFJLEtBQUssa0JBQWtCLEVBQUU7QUFFbkYsVUFBSTtBQUNBLGNBQU0sR0FBRyxTQUFTLE1BQU0sVUFBVSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3JELFlBQUksbUJBQW1CLE9BQU8sS0FBSyxJQUFJLEtBQUssWUFBWSxRQUFRO0FBQ2hFLGNBQU0sR0FBRyxTQUFTLFVBQVUsa0JBQWtCLGdCQUFnQjtBQUFBLE1BQ2xFLFNBQVMsS0FBSztBQUFFLFFBQUFELEtBQUksTUFBTSwrQkFBK0IsR0FBRyxFQUFHO0FBQUEsTUFBRztBQUFBLElBQ3RFO0FBQUEsRUFFUixPQUFPO0FBRUgsWUFBUSxXQUFXO0FBQUEsRUFDdkI7QUFDQSxNQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLHVCQUF1QixHQUFHLFFBQU8sVUFBVSxDQUFDO0FBQ3RGLENBQUM7QUFRRCxPQUFPLEtBQUssMkNBQTJDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ25GLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLGNBQWMsSUFBSSxLQUFLO0FBQzdCLFFBQU0sZUFBZSxJQUFJLEtBQUs7QUFDOUIsUUFBTSxtQkFBbUIsSUFBSSxLQUFLO0FBQ2xDLFFBQU0sZ0JBQWdCLElBQUksS0FBSyxpQkFBaUI7QUFJaEQsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUssQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxnQkFBZ0IsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFHO0FBR2xHLE1BQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLE1BQUssQ0FBQyxTQUFVO0FBQUMsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUSxXQUFXLFFBQVEsUUFBUSxDQUFDO0FBQUEsRUFBRTtBQUUzRixNQUFJLGNBQWE7QUFDYixZQUFRLGVBQWU7QUFBQSxFQUMzQjtBQVVBLE1BQUksY0FBYyxRQUFRLFdBQVcsUUFBUSxRQUFRLEdBQUc7QUFDeEQsTUFBSSxNQUFNLG9CQUFJLEtBQUs7QUFFbkIsTUFBSSxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsR0FBRyxPQUFPLElBQUksU0FBUyxJQUFFLENBQUMsRUFBRSxTQUFTLEdBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxJQUFJLFFBQVEsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLEVBQUUsU0FBUyxHQUFFLEdBQUcsQ0FBQyxHQUFHLE9BQU8sSUFBSSxXQUFXLENBQUMsRUFBRSxTQUFTLEdBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxJQUFJLFdBQVcsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUM7QUFDdlAsTUFBSSxXQUFXLEdBQUcsVUFBVSxJQUFJLFdBQVcsSUFBSSxnQkFBZ0IsSUFBSSxTQUFTO0FBSTVFLFFBQU0sWUFBWSxPQUFPLEtBQUssYUFBYSxRQUFRO0FBR25ELE1BQUk7QUFDQSxVQUFNLFdBQVdDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLFVBQVUsY0FBYyxTQUFTLENBQUU7QUFDeEksVUFBTSxJQUFJLE1BQU0sVUFBVSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQzdDLFVBQU0sbUJBQW1CQSxNQUFLLEtBQUssVUFBVSxRQUFRO0FBQ3JELFVBQU0sSUFBSSxVQUFVLGtCQUFrQixTQUFTO0FBRS9DLElBQUFELEtBQUksS0FBSyx5RUFBeUUsUUFBUSxVQUFVLEVBQUU7QUFFdEcsUUFBSSxlQUFlO0FBQ25CLFFBQUksZUFBTyxpQkFBaUI7QUFDMUIsWUFBTSxhQUFhQyxNQUFLLEtBQUssZUFBTyxpQkFBaUIsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLFVBQVUsY0FBYyxTQUFTLENBQUU7QUFDNUksWUFBTSxJQUFJLE1BQU0sWUFBWSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQy9DLFlBQU0seUJBQXlCQSxNQUFLLEtBQUssWUFBWSxRQUFRO0FBQzdELFlBQU0sSUFBSSxVQUFVLHdCQUF3QixTQUFTO0FBQ3JELHFCQUFlO0FBQUEsSUFDakI7QUFFQSxRQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUyxXQUFXLFFBQVEsV0FBVyxRQUFRLGFBQWEsQ0FBQztBQUFBLEVBQzVGLFNBQVMsS0FBSztBQUNaLElBQUFELEtBQUksTUFBTSwyQkFBMkIsR0FBRyxFQUFFO0FBQzFDLFFBQUksVUFBVSxFQUFFLDBCQUEwQjtBQUMxQyxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBa0IsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUM5RTtBQUVOLENBQUM7QUFnQkQsSUFBTyxrQkFBUTtBQUtmLFNBQVMscUJBQXFCLEtBQUksS0FBSTtBQUNsQyxNQUFJLElBQUksTUFBTSxTQUFVLElBQUksTUFBTSxlQUFlLElBQUksR0FBRyxTQUFTLFdBQVcsR0FBRztBQUM3RSxXQUFPO0FBQUEsRUFDVDtBQUNBLEVBQUFBLEtBQUksTUFBTSxxQ0FBcUMsSUFBSSxFQUFFLEVBQUU7QUFDdkQsTUFBSSxLQUFLLGdCQUFnQjtBQUN6QixTQUFPO0FBQ1g7QUFFQSxTQUFTLHVCQUF1QjtBQUM1QixTQUFPRyxRQUFPLFlBQVksRUFBRSxFQUFFLFNBQVMsS0FBSztBQUNoRDtBQUNBLFNBQVMsT0FBTyxRQUFRO0FBQ3BCLFNBQU9BLFFBQU8sV0FBVyxRQUFRLEVBQUUsT0FBTyxNQUFNLEVBQUUsT0FBTztBQUM3RDtBQUNBLFNBQVMsZ0JBQWdCLEtBQUs7QUFDMUIsU0FBTyxJQUFJLFNBQVMsUUFBUSxFQUMzQixRQUFRLEtBQUssR0FBRyxFQUNoQixRQUFRLEtBQUssR0FBRyxFQUNoQixRQUFRLE9BQU8sRUFBRTtBQUN0Qjs7O0FTOWdDQSxTQUFTLFVBQUFHLGVBQWM7QUFFdkIsT0FBT0MsV0FBVztBQUVsQixPQUFPQyxTQUFRO0FBQ2YsT0FBTyxhQUFhO0FBR3BCLE9BQU8sY0FBYztBQUNyQixTQUFTLGFBQWEsV0FBVztBQUNqQyxPQUFPQyxVQUFTO0FBQ2hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFNBQVM7QUFYaEIsSUFBTUMsVUFBU0MsUUFBTztBQU10QixJQUFNLEVBQUUsR0FBQUMsR0FBRSxJQUFJLGdCQUFLO0FBV2xCRixRQUFPLEtBQUssZ0NBQWdDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ3pFLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxNQUFLLElBQUksS0FBSztBQUVwQixNQUFLLFVBQVUsU0FBUyxXQUFXLGFBQWM7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFFeEcsTUFBSSxVQUFVLENBQUM7QUFDZixVQUFRLEtBQU0sRUFBQyxrQkFBa0IsS0FBSyxpQkFBaUJDLE1BQUssUUFBUSxHQUFHLEVBQUMsQ0FBQztBQUV6RSxRQUFNLGlCQUFpQixDQUFDLE9BQU87QUFHL0IsTUFBSTtBQUNBLFVBQU0sUUFBUSxNQUFNQyxJQUFHLFNBQVMsUUFBUSxHQUFHO0FBQzNDLGVBQVcsUUFBUSxPQUFPO0FBQ3RCLFlBQU0sV0FBV0QsTUFBSyxLQUFLLEtBQUssSUFBSTtBQUNwQyxVQUFJLE1BQU1BLE1BQUssUUFBUSxJQUFJLEVBQUUsWUFBWTtBQUV6QyxVQUFJO0FBQ0EsY0FBTSxRQUFRLE1BQU1DLElBQUcsU0FBUyxLQUFLLFFBQVE7QUFDN0MsWUFBSSxNQUFNLFlBQVksR0FBRztBQUNyQixrQkFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLE1BQU0sTUFBTSxNQUFNLE9BQU8sS0FBSyxJQUFJLFFBQVEsSUFBSSxDQUFDO0FBQUEsUUFDbEYsV0FDUyxNQUFNLE9BQU8sS0FBSyxDQUFDLGVBQWUsU0FBUyxHQUFHLEdBQUc7QUFDdEQsa0JBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxNQUFNLE1BQU0sTUFBTSxRQUFRLEtBQVUsUUFBUSxJQUFJLENBQUM7QUFBQSxRQUNwRjtBQUFBLE1BQ0osU0FBUyxVQUFVO0FBRWYsZ0JBQVEsTUFBTSxxRUFBcUUsUUFBUTtBQUFBLE1BQy9GO0FBQUEsSUFDSjtBQUFBLEVBQ0osU0FBUyxLQUFLO0FBRVYsWUFBUSxNQUFNLDJEQUEyRCxHQUFHO0FBQzVFLFdBQU8sSUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxTQUFTLFNBQVNGLEdBQUUsZ0JBQWdCLEVBQUUsQ0FBQztBQUFBLEVBQ2pGO0FBQ0EsU0FBTyxJQUFJLEtBQU0sT0FBUTtBQUM3QixDQUFDO0FBaUJBRixRQUFPLEtBQUssaUNBQWlDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQzFFLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxjQUFjLElBQUksS0FBSztBQUM3QixNQUFJLFVBQVU7QUFHZCxNQUFLLFVBQVUsU0FBUyxXQUFXLGFBQWM7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFPeEcsTUFBSSxjQUFjLENBQUM7QUFDbkIsV0FBUyxXQUFXLGFBQWE7QUFDN0IsYUFBUyxVQUFVLEdBQUcsV0FBVyxHQUFHLFdBQVc7QUFDM0MsVUFBSSxRQUFRLFNBQVMsT0FBTyxFQUFFLE1BQUs7QUFDL0Isb0JBQVksS0FBSyxRQUFRLFNBQVMsT0FBTyxFQUFFLElBQUk7QUFBQSxNQUNuRDtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0EsVUFBUSxJQUFJLGlDQUFpQyxXQUFXO0FBR3hELE1BQUksWUFBWSxXQUFXLEdBQUc7QUFDMUIsV0FBTyxJQUFJLEtBQUssRUFBQyxTQUFrQixXQUFXLEtBQUksQ0FBQztBQUFBLEVBQ3ZELE9BQ0s7QUFDRCxRQUFJLGVBQWUsTUFBTSxlQUFlLGFBQWEsVUFBVTtBQUMvRCxRQUFJLGVBQWVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVcsV0FBVztBQUM3RixRQUFJO0FBQ0EsWUFBTUMsSUFBRyxTQUFTLFVBQVUsY0FBYyxZQUFZO0FBQ3RELE1BQUFMLEtBQUksS0FBSyxpREFBaUQ7QUFBQSxJQUM5RCxTQUNNLEtBQUk7QUFBQyxNQUFBQSxLQUFJLE1BQU0scUJBQW9CLEdBQUc7QUFBQSxJQUFDO0FBQzdDLGdCQUFZLFFBQVEsWUFBWTtBQUloQyxRQUFJLE1BQU0sTUFBTSxZQUFZLFdBQVc7QUFDdkMsUUFBSSxZQUFZLE9BQU8sS0FBSyxHQUFHO0FBQy9CLFFBQUksVUFBVUksTUFBSyxLQUFLLGVBQU8sZUFBZSxTQUFTLFdBQVcsWUFBVyxjQUFjO0FBQzNGLFFBQUk7QUFDQSxZQUFNQyxJQUFHLFNBQVMsVUFBVSxTQUFTLFNBQVM7QUFDOUMsTUFBQUwsS0FBSSxLQUFLLDJDQUEyQztBQUFBLElBQ3hELFNBQ00sS0FBSTtBQUFDLE1BQUFBLEtBQUksTUFBTSxxQkFBb0IsR0FBRztBQUFBLElBQUM7QUFDN0MsV0FBTyxJQUFJLEtBQUssRUFBQyxTQUFrQixXQUFxQixRQUFnQixDQUFDO0FBQUEsRUFDN0U7QUFDSixDQUFDO0FBV0QsU0FBUyxXQUFXLE1BQU07QUFDdEIsUUFBTSxTQUFTLElBQUksV0FBVyxNQUFNLEdBQUcsQ0FBQztBQUV4QyxRQUFNLFlBQVksQ0FBQyxJQUFNLElBQU0sSUFBTSxJQUFNLEVBQUk7QUFDL0MsV0FBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUN2QyxRQUFJLE9BQU8sQ0FBQyxNQUFNLFVBQVUsQ0FBQyxHQUFHO0FBQzVCLE1BQUFBLEtBQUksS0FBSywwQ0FBMEM7QUFDbkQsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQ0EsU0FBTztBQUNYO0FBRUEsZUFBZSxnQkFBZ0IsU0FBUyxhQUFhLFlBQVc7QUFDNUQsUUFBTSxhQUFhLE1BQU1LLElBQUcsU0FBUyxTQUFTLE9BQU87QUFDckQsTUFBSSxRQUFRO0FBRVosTUFBSSxXQUFXLFVBQVUsR0FBRTtBQUN2QixZQUFRLE1BQU0sSUFBSSxVQUFVLEVBQUUsS0FBTSxVQUFRO0FBQ3hDLFVBQUksUUFBUSxLQUFLLFFBQVEsYUFBYTtBQUNsQyxZQUFJLHFCQUFxQixLQUFLLEtBQUs7QUFHbkMsWUFBSSxTQUFTLElBQUksVUFBVTtBQUMzQixZQUFJLFNBQVM7QUFFYiw2QkFBcUI7QUFJckIsWUFBSSxRQUFRO0FBQ1osWUFBSSxVQUFVLEtBQUssS0FBSyxNQUFNLEtBQUs7QUFDbkMsWUFBSSxnQkFBZ0IsVUFBVSxRQUFRLENBQUMsSUFBSTtBQUUzQyxZQUFJLGtCQUFrQixZQUFXO0FBQzdCLGlCQUFPO0FBQUEsUUFDWCxPQUNLO0FBQ0Qsa0JBQVE7QUFDUixvQkFBVSxLQUFLLEtBQUssTUFBTSxLQUFLO0FBQy9CLDBCQUFnQixVQUFVLFFBQVEsQ0FBQyxJQUFJO0FBQ3ZDLGNBQUksa0JBQWtCLFlBQVc7QUFDN0IsbUJBQU87QUFBQSxVQUNYLE9BQ0s7QUFDRCxvQkFBUSxJQUFJLEtBQUssSUFBSTtBQUNyQixtQkFBTyxzQkFBc0IsSUFBSSxLQUFLLGtCQUFrQixLQUFLO0FBQUEsVUFDakU7QUFBQSxRQUNKO0FBQUEsTUFDSixPQUNLO0FBQ0QsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUVKLENBQUMsRUFDQSxNQUFNLFNBQU87QUFBQyxNQUFBTCxLQUFJLE1BQU0sMkJBQTJCLEdBQUcsRUFBRTtBQUFHLGFBQU87QUFBQSxJQUFHLENBQUM7QUFBQSxFQUMzRSxPQUNLO0FBQ0QsWUFBUTtBQUFBLEVBQ1o7QUFFQSxTQUFPO0FBQ1g7QUFRQSxlQUFlLGVBQWUsYUFBYSxZQUFXO0FBQ2xELE1BQUksWUFBWSxDQUFDLENBQUMsUUFBUSxhQUFhLFNBQVMsV0FBVyxXQUFXLENBQUM7QUFDdkUsYUFBVyxXQUFXLGFBQVk7QUFDOUIsUUFBSSxnQkFBZ0I7QUFDcEIsVUFBTSxjQUFjLFFBQVEsWUFBWSxTQUFTLEtBQUssUUFBUSxZQUFZLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUSxRQUFRO0FBQ3pHLGFBQVMsVUFBVSxHQUFHLFdBQVcsR0FBRyxXQUFXO0FBQzNDLFVBQUksT0FBTztBQUNYLFVBQUksY0FBYztBQUNsQixVQUFJLE9BQU87QUFDWCxVQUFJLFFBQVE7QUFDWixVQUFJLFdBQVc7QUFFZixVQUFJLFFBQVEsU0FBUyxPQUFPLEVBQUUsTUFBSztBQUMvQixlQUFPO0FBQ1Asc0JBQWMsUUFBUSxTQUFTLE9BQU8sRUFBRSxlQUFlLGFBQWEsT0FBTztBQUMzRSxzQkFBYyxZQUFZLFNBQVMsS0FBSyxZQUFZLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUTtBQUMzRSxlQUFPLE9BQU8sUUFBUSxTQUFTLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxrQkFBa0I7QUFDdkUsZ0JBQVEsTUFBTSxnQkFBZ0IsUUFBUSxTQUFTLE9BQU8sRUFBRSxNQUFNLFFBQVEsYUFBYSxVQUFVO0FBQzdGLG1CQUFXLFFBQVEsU0FBUyxPQUFPLEVBQUUsU0FBUyxTQUFTLEtBQUssUUFBUSxTQUFTLE9BQU8sRUFBRSxTQUFTLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUSxRQUFRLFNBQVMsT0FBTyxFQUFFO0FBQ2hKLGtCQUFVLEtBQUssQ0FBRSxNQUFNLGFBQWEsTUFBTSxPQUFPLFFBQVMsQ0FBQztBQUMzRCx3QkFBZ0I7QUFBQSxNQUNwQjtBQUFBLElBQ0o7QUFDQSxRQUFJLENBQUMsZUFBZTtBQUNoQixnQkFBVSxLQUFLLENBQUUsYUFBYSxJQUFJLElBQUksSUFBSSxFQUFHLENBQUM7QUFBQSxJQUNsRDtBQUFBLEVBQ0o7QUFFQSxRQUFNLFNBQVMsTUFBTSxZQUFZLE9BQU87QUFDeEMsUUFBTSxPQUFPLE9BQU8sUUFBUTtBQUc1QixRQUFNLFNBQVM7QUFDZixRQUFNLFNBQVMsS0FBSyxVQUFVLElBQUk7QUFDbEMsUUFBTSxZQUFZO0FBQ2xCLFFBQU0sZUFBZSxDQUFDLEtBQUssS0FBSyxJQUFJLElBQUksR0FBRztBQUczQyxRQUFNLFdBQVcsQ0FBQyxHQUFHLEdBQUcsT0FBTyxXQUFXO0FBQUUsU0FBSyxjQUFjLEVBQUUsR0FBRyxHQUFHLE9BQU8sUUFBUSxhQUFhLElBQUksR0FBRyxHQUFHLENBQUMsR0FBSSxhQUFhLEVBQUksQ0FBQztBQUFBLEVBQUk7QUFFeEksUUFBTSxVQUFVLENBQUMsTUFBTSxHQUFHLE1BQU07QUFBRyxXQUFPLE9BQU8sSUFBSTtBQUFNLFNBQUssU0FBUyxNQUFNLEVBQUUsR0FBRyxHQUFHLE1BQU0sR0FBRyxPQUFPLElBQUksR0FBRyxHQUFHLENBQUMsRUFBSSxDQUFDO0FBQUEsRUFBSTtBQUUzSCxZQUFVLFFBQVEsQ0FBQyxLQUFLLGFBQWE7QUFDakMsVUFBTSxPQUFPLFNBQVMsV0FBVztBQUNqQyxRQUFJLFFBQVEsQ0FBQyxVQUFVLGdCQUFnQjtBQUNuQyxZQUFNLE9BQU8sU0FBUyxhQUFhLE1BQU0sR0FBRyxXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssUUFBUSxNQUFNLEtBQUssQ0FBQztBQUMxRixlQUFTLE1BQU0sT0FBTyxXQUFXLGFBQWEsV0FBVyxHQUFHLFNBQVM7QUFDckUsY0FBUSxVQUFVLE9BQU8sR0FBRyxPQUFPLFlBQVksQ0FBQztBQUFBLElBQ3BELENBQUM7QUFBQSxFQUNMLENBQUM7QUFFRCxRQUFNLFdBQVcsTUFBTSxPQUFPLEtBQUs7QUFDbkMsU0FBTztBQUNYO0FBZ0NBLGVBQWUsWUFBWSxhQUFhO0FBRXBDLFFBQU0sVUFBVSxNQUFNLFlBQVksT0FBTztBQUN6QyxhQUFXLFdBQVcsYUFBYTtBQUMvQixRQUFJLFdBQVcsTUFBTUssSUFBRyxTQUFTLFNBQVMsT0FBTztBQUVqRCxRQUFJLFdBQVcsUUFBUSxHQUFFO0FBQ3JCLFlBQU1DLE9BQU0sTUFBTSxZQUFZLEtBQUssUUFBUTtBQUMzQyxZQUFNLGNBQWMsTUFBTSxRQUFRLFVBQVVBLE1BQUtBLEtBQUksZUFBZSxDQUFDO0FBQ3JFLGtCQUFZLFFBQVEsQ0FBQyxTQUFTO0FBQzFCLGdCQUFRLFFBQVEsSUFBSTtBQUFBLE1BQ3hCLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFFSjtBQUVBLFFBQU0sV0FBVyxNQUFNLFFBQVEsS0FBSztBQUNwQyxTQUFPO0FBQ1g7QUFlQ0wsUUFBTyxLQUFLLDhCQUE4QixlQUFnQixLQUFLLEtBQUssTUFBTTtBQUN2RSxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUssVUFBVSxTQUFTLFdBQVcsYUFBYztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQUd4RyxRQUFNLFdBQVcsSUFBSSxLQUFLO0FBQzFCLE1BQUksVUFBVTtBQUNWLFFBQUk7QUFDQSxZQUFNLFFBQVEsTUFBTUUsSUFBRyxTQUFTLEtBQUssUUFBUTtBQUM3QyxVQUFJLE1BQU0sWUFBWSxHQUFFO0FBQ3BCLGNBQU1BLElBQUcsU0FBUyxHQUFHLFVBQVUsRUFBRSxXQUFXLE1BQU0sT0FBTyxLQUFLLENBQUM7QUFBQSxNQUNuRSxPQUNLO0FBQ0QsY0FBTUEsSUFBRyxTQUFTLE9BQU8sUUFBUTtBQUFBLE1BQ3JDO0FBQ0EsVUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRRixHQUFFLGVBQWUsRUFBSSxDQUFDO0FBQUEsSUFDakYsU0FBUyxLQUFLO0FBQ1YsTUFBQUgsS0FBSSxNQUFNLGtCQUFrQixHQUFHO0FBQy9CLFVBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQU8sU0FBUyxRQUFRLFVBQVUsU0FBUUcsR0FBRSxnQkFBZ0IsRUFBRSxDQUFDO0FBQUEsSUFDMUY7QUFBQSxFQUNKO0FBQ0osQ0FBQztBQVdERixRQUFPLEtBQUssOEJBQThCLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDaEUsUUFBTSxFQUFFLE9BQU8sV0FBVyxJQUFJLElBQUk7QUFDbEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBR2pELE1BQUksQ0FBQyxZQUFZLFVBQVUsU0FBUyxZQUFZLGFBQWE7QUFDekQsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUN2RDtBQUVBLFFBQU0sRUFBRSxTQUFTLElBQUksSUFBSTtBQUN6QixNQUFJLFVBQVU7QUFDVixRQUFJLFNBQVMsVUFBVSxDQUFDLFFBQVE7QUFDNUIsVUFBSSxLQUFLO0FBQ0wsUUFBQUgsS0FBSSxNQUFNLEdBQUc7QUFDYixZQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRRyxHQUFFLGdCQUFnQixFQUFFLENBQUM7QUFBQSxNQUN4RDtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUVILFFBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVFBLEdBQUUsZ0JBQWdCLEVBQUUsQ0FBQztBQUFBLEVBQ3hEO0FBQ0osQ0FBQztBQVlBRixRQUFPLEtBQUssZ0NBQWdDLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDbkUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLE9BQU8sSUFBSSxLQUFLO0FBQ3RCLFFBQU0sV0FBVyxJQUFJLEtBQUs7QUFDMUIsUUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUssVUFBVSxTQUFTLFdBQVcsZUFBZSxDQUFDLFdBQVcsT0FBTyxRQUFTLEdBQUc7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFJeEksTUFBSSxTQUFTLHNCQUFzQjtBQUUvQixRQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsS0FBSztBQUMxRSxRQUFJLFNBQVM7QUFDVCxjQUFRLE9BQU8sWUFBWSxJQUFJO0FBQy9CLGNBQVEsT0FBTyxPQUFPLElBQUksQ0FBQztBQUMzQixVQUFJLElBQUksRUFBQyxNQUFZLENBQUM7QUFBQSxJQUMxQjtBQUFBLEVBQ0osV0FDUyxTQUFTLFFBQVE7QUFDbEIsUUFBSSxVQUFVLHVCQUF1QiwwQkFBMEIsUUFBUTtBQUN2RSxRQUFJLFNBQVMsUUFBUTtBQUFBLEVBQzdCLFdBQ1MsU0FBUyxPQUFPO0FBRXJCLFFBQUksY0FBYyxTQUFTLE9BQU8sTUFBTTtBQUN4QyxRQUFJLGNBQWNDLE1BQUssS0FBSyxlQUFPLGVBQWUsV0FBVztBQUM3RCxVQUFNLGFBQWEsVUFBVSxXQUFXO0FBQ3hDLFFBQUksVUFBVSx1QkFBdUIsMEJBQTBCLFFBQVE7QUFDdkUsUUFBSSxTQUFTLGFBQVksUUFBUTtBQUFBLEVBQ3JDO0FBRUosQ0FBQztBQU1ESCxRQUFPLEtBQUssd0NBQXdDLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDMUUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUssVUFBVSxTQUFTLFdBQVcsZUFBZSxDQUFDLFdBQVcsT0FBTyxRQUFTLEdBQUc7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFHeEksTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLEtBQUs7QUFDMUUsTUFBSSxTQUFTO0FBRVQsUUFBSSxlQUFlLFNBQVM7QUFDNUIsUUFBSSxjQUFjLGFBQWEsYUFBYSxhQUFhLGFBQWE7QUFDdEUsUUFBSSxTQUFTLFlBQVk7QUFDekIsUUFBSSxTQUFTLFlBQVk7QUFFekIsUUFBSSxZQUFZLENBQUM7QUFDakIsUUFBSSxjQUFjLENBQUM7QUFDbkIsUUFBSSxVQUFVLEtBQUs7QUFDZixrQkFBWSxPQUFPO0FBQ25CLG9CQUFjLE9BQU87QUFBQSxJQUN6QixXQUNTLFVBQVUsS0FBSztBQUNwQixrQkFBWSxPQUFPO0FBQ25CLG9CQUFjLE9BQU87QUFBQSxJQUN6QjtBQUdBLFFBQUksS0FBSyxFQUFFLFFBQU8sV0FBVyxRQUFRLFVBQVUsV0FBc0IsWUFBMEIsQ0FBQztBQUFBLEVBQ3BHLE9BQ0s7QUFDRCxRQUFJLEtBQUssRUFBRSxRQUFPLFNBQVMsUUFBUSxVQUFVLFNBQVFBLEdBQUUsb0JBQW9CLEVBQUcsQ0FBQztBQUFBLEVBQ25GO0FBSUosQ0FBQztBQWlCQUYsUUFBTyxLQUFLLHNDQUFzQyxPQUFPLEtBQUssS0FBSyxTQUFTO0FBQ3pFLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxFQUFFLE1BQU0sU0FBUyxJQUFJLElBQUk7QUFDL0IsUUFBTSxjQUFjLE9BQU8sS0FBSyxNQUFNLFFBQVE7QUFFOUMsTUFBSyxDQUFDLFdBQVcsY0FBYyxRQUFTLEdBQUk7QUFBRSxRQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUFFLE9BQ3ZGO0FBQ0QsUUFBSSxTQUFTO0FBQ2IsVUFBTSxNQUFNLG9CQUFJLEtBQUs7QUFDckIsUUFBSSxPQUFPLElBQUksbUJBQW1CLE9BQU87QUFDekMsUUFBSSxhQUFhLE9BQU8sSUFBSSxFQUFFLFFBQVEsTUFBTSxHQUFHO0FBRS9DLFVBQU0sT0FBTyxJQUFJLFlBQVk7QUFDN0IsVUFBTSxRQUFRLE9BQU8sSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHO0FBQ3hELFVBQU0sTUFBTSxPQUFPLElBQUksUUFBUSxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDakQsVUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxHQUFHO0FBRXhDLFFBQUksVUFBVSxHQUFHLFVBQVUsSUFBSSxVQUFVO0FBRXpDLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFFBQUksbUJBQW1CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxRQUFRO0FBQ25ILFFBQUksbUJBQW9CQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsVUFBVTtBQUUxRyxRQUFJLG9CQUFvQkEsTUFBSyxLQUFLLGtCQUFrQixPQUFPO0FBQzNELFFBQUk7QUFDQSxZQUFNQyxJQUFHLFNBQVMsTUFBTSxrQkFBa0IsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUM3RCxZQUFNQSxJQUFHLFNBQVMsTUFBTSxtQkFBbUIsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLElBQ2xFLFNBQ08sS0FBSztBQUNSLE1BQUFMLEtBQUksTUFBTSxvQkFBb0IsR0FBRztBQUFBLElBQ3JDO0FBRUEsUUFBSSxNQUFLO0FBRUwsVUFBSSxTQUFTLFNBQVMsTUFBTSxHQUFFO0FBQzFCLFFBQUFBLEtBQUksS0FBSyxnREFBZ0QsUUFBUSxVQUFVO0FBQzNFLFlBQUksVUFBVSxNQUFNLHFCQUFxQixrQkFBa0IsbUJBQW1CLFdBQVc7QUFFekYsWUFBSSxlQUFPLG1CQUFtQixTQUFRO0FBRWxDLGNBQUksWUFBYUksTUFBSyxLQUFLLGVBQU8saUJBQWlCLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxPQUFPO0FBQzlHLFVBQUFKLEtBQUksS0FBSyxnREFBZ0QsaUJBQWlCLFNBQVMsU0FBUyxHQUFHO0FBQy9GLGNBQUk7QUFDQSxrQkFBTUssSUFBRyxTQUFTLE1BQU0sV0FBVyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3RELGtCQUFNQSxJQUFHLFNBQVMsR0FBRyxtQkFBbUIsV0FBVyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsVUFDMUUsU0FDTyxLQUFLO0FBQ1IsWUFBQUwsS0FBSSxNQUFNLG9CQUFvQixHQUFHO0FBQUEsVUFDckM7QUFBQSxRQUNKO0FBQ0EsWUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRRyxHQUFFLG1CQUFtQixHQUFHLE9BQWdCLENBQUM7QUFBQSxNQUNwRyxPQUNLO0FBQ0QsUUFBQUgsS0FBSSxNQUFNLHNDQUFzQztBQUNoRCxZQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFHLEdBQUUscUJBQXFCLEdBQUcsT0FBZSxDQUFDO0FBQUEsTUFDcEc7QUFBQSxJQUNKLE9BQ0s7QUFDRCxVQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFBLEdBQUUscUJBQXFCLEdBQUcsT0FBZSxDQUFDO0FBQUEsSUFDcEc7QUFBQSxFQUNKO0FBQ0osQ0FBQztBQVNERixRQUFPLEtBQUssa0RBQWtELE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDcEYsUUFBTSxjQUFjLElBQUksT0FBTztBQUMvQixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLGVBQWUsSUFBSSxPQUFPO0FBRWhDLE1BQUssZ0JBQWdCLFNBQVMsV0FBVyxhQUFjO0FBQUUsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUFFO0FBRzlHLE1BQUksa0JBQW1CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFNBQVM7QUFDaEcsTUFBSTtBQUNBLFVBQU1DLElBQUcsU0FBUyxNQUFNLGlCQUFpQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsRUFDaEUsU0FBUyxLQUFLO0FBQUEsRUFFZDtBQUdBLE1BQUksSUFBSSxPQUFNO0FBRVYsUUFBSSxhQUFhLENBQUM7QUFDbEIsUUFBSSxDQUFDLE1BQU0sUUFBUSxJQUFJLE1BQU0sS0FBSyxHQUFFO0FBQUUsaUJBQVcsS0FBSyxJQUFJLE1BQU0sS0FBSztBQUFBLElBQUMsT0FDakU7QUFBQyxtQkFBYSxJQUFJLE1BQU07QUFBQSxJQUFLO0FBRWxDLFFBQUksUUFBUSxDQUFDO0FBRWIsbUJBQWUsUUFBUyxZQUFZO0FBQ2hDLFVBQUksV0FBVyxtQkFBbUIsS0FBSyxJQUFJO0FBQzNDLFVBQUksbUJBQW1CRCxNQUFLLEtBQUssaUJBQWlCLFFBQVE7QUFDMUQsWUFBTSxLQUFLLEdBQUcsa0JBQWtCLENBQUMsUUFBUTtBQUNyQyxZQUFJLEtBQUs7QUFBRSxVQUFBSixLQUFJLE1BQU9HLEdBQUUsb0JBQW9CLENBQUU7QUFBQSxRQUFFO0FBQUEsTUFDcEQsQ0FBQztBQUNELFlBQU0sS0FBSyxFQUFFLE1BQUssVUFBVyxNQUFLLGlCQUFpQixDQUFDO0FBQUEsSUFDeEQ7QUFHQSxRQUFJLGlCQUFpQixPQUFNO0FBQ3ZCLGVBQVMsV0FBVyxTQUFTLGFBQVk7QUFDckMsZ0JBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsZ0JBQVEsT0FBTyxPQUFPLElBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0osV0FDUyxnQkFBZ0IsT0FBTyxnQkFBZ0IsS0FBSTtBQUNoRCxVQUFJLGFBQWEsQ0FBQztBQUNsQixVQUFJLGdCQUFnQixLQUFJO0FBQUMscUJBQWEsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxPQUFPO0FBQUEsTUFBTTtBQUMzSCxVQUFJLGdCQUFnQixLQUFJO0FBQUMscUJBQWEsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxPQUFPO0FBQUEsTUFBTTtBQUUzSCxVQUFJLFdBQVcsU0FBUyxHQUFHO0FBQ3ZCLGlCQUFTLFFBQVEsWUFBVztBQUN4QixjQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLGVBQWUsSUFBSTtBQUM5RSxjQUFJLFNBQVM7QUFDVCxvQkFBUSxPQUFPLFlBQVksSUFBRztBQUM5QixvQkFBUSxPQUFPLE9BQU8sSUFBSTtBQUFBLFVBQzlCO0FBQUEsUUFDSjtBQUFBLE1BQ0osT0FDSztBQUNELGVBQU8sSUFBSSxLQUFLLEVBQUUsUUFBTyxTQUFVLFFBQVEsVUFBVSxTQUFRQSxHQUFFLHFCQUFxQixFQUFFLENBQUM7QUFBQSxNQUMzRjtBQUFBLElBRUosT0FDSztBQUNELFVBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFVBQUksU0FBUztBQUNULGdCQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLGdCQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsTUFDOUI7QUFBQSxJQUNKO0FBQ0EsUUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRQSxHQUFFLG1CQUFtQixFQUFHLENBQUM7QUFBQSxFQUNwRixPQUNLO0FBQ0QsUUFBSSxLQUFLLEVBQUUsUUFBTyxTQUFVLFFBQVEsVUFBVSxTQUFRQSxHQUFFLHFCQUFxQixFQUFFLENBQUM7QUFBQSxFQUNwRjtBQUVKLENBQUM7QUFvQkQsSUFBTyxlQUFRRjtBQUdmLElBQU0sd0JBQXdCO0FBQzlCLElBQUksa0JBQWtCO0FBQ3RCLElBQU0sZUFBZSxDQUFDO0FBRXRCLFNBQVMsaUJBQWlCO0FBQ3RCLE1BQUksbUJBQW1CLHNCQUF1QjtBQUM5QyxRQUFNLE1BQU0sYUFBYSxNQUFNO0FBQy9CLE1BQUksQ0FBQyxJQUFLO0FBRVY7QUFHQSxNQUFJLEVBQ0MsTUFBTSxNQUFNO0FBQUEsRUFBQyxDQUFDLEVBQ2QsUUFBUSxNQUFNO0FBR1g7QUFDQSxpQkFBYSxjQUFjO0FBQUEsRUFDL0IsQ0FBQztBQUNUO0FBRUEsZUFBZSxxQkFBcUIsa0JBQWtCLG1CQUFtQixhQUFZO0FBR2pGLFNBQU8sSUFBSSxRQUFRLENBQUMsWUFBWTtBQUM1QixVQUFNTSxRQUFPLFlBQVk7QUFDckIsVUFBSTtBQUNBLGNBQU1GLElBQUcsU0FBUyxVQUFVLGtCQUFrQixXQUFXO0FBR3pELGNBQU0sUUFBUSxrQkFBa0I7QUFBQSxVQUM1QixLQUFLO0FBQUEsVUFDTCxTQUFTLENBQUMsT0FBTyxZQUFZO0FBQ3pCLGtCQUFNLFNBQVNELE1BQUssVUFBVUEsTUFBSyxLQUFLLG1CQUFtQixNQUFNLFFBQVEsQ0FBQztBQUMxRSxnQkFBSSxDQUFDLE9BQU8sV0FBV0EsTUFBSyxVQUFVLG9CQUFvQkEsTUFBSyxHQUFHLENBQUMsR0FBRztBQUNsRSxzQkFBUSxNQUFNO0FBQ2Qsb0JBQU0sSUFBSSxNQUFNLDZCQUE2QixNQUFNLFFBQVE7QUFBQSxZQUMvRDtBQUFBLFVBQ0o7QUFBQSxRQUNKLENBQUM7QUFFRCxZQUFJO0FBQUUsZ0JBQU1DLElBQUcsU0FBUyxPQUFPLGdCQUFnQjtBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUEsUUFBZTtBQUM3RSxRQUFBTCxLQUFJLEtBQUssc0RBQXNELGlCQUFpQixFQUFFO0FBQ2xGLGdCQUFRLElBQUk7QUFBQSxNQUNoQixTQUFTLEtBQUs7QUFDVixRQUFBQSxLQUFJLE1BQU0sOEJBQThCLEdBQUc7QUFDM0MsWUFBSTtBQUFFLGdCQUFNSyxJQUFHLFNBQVMsT0FBTyxnQkFBZ0I7QUFBQSxRQUFHLFNBQVMsR0FBRztBQUFBLFFBQWU7QUFDN0UsZ0JBQVEsS0FBSztBQUFBLE1BQ2pCO0FBQUEsSUFDSjtBQUVBLGlCQUFhLEtBQUtFLEtBQUk7QUFDdEIsUUFBSSxrQkFBa0Isc0JBQXVCLGNBQWEsY0FBYztBQUFBLEVBQzVFLENBQUM7QUFDTDtBQU1BLFNBQVMsV0FBVyxPQUFPLFVBQVM7QUFDaEMsTUFBSSxjQUFjO0FBRWxCLE1BQUk7QUFDQSxhQUFTLFlBQVksUUFBUyxDQUFDLFlBQVk7QUFDdkMsVUFBSSxVQUFVLFFBQVEsT0FBTztBQUN6QixzQkFBYztBQUFBLE1BQ2xCO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTCxTQUNNLEtBQUk7QUFDTixJQUFBUCxLQUFJLE1BQU0sU0FBUyxHQUFHLEVBQUU7QUFBQSxFQUM1QjtBQUVBLFNBQU87QUFDWDtBQU9BLFNBQVMsYUFBYSxXQUFXLFNBQVM7QUFDdEMsUUFBTSxVQUFVLFNBQVMsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBQyxDQUFDO0FBQ3JELFFBQU0sU0FBU0ssSUFBRyxrQkFBa0IsT0FBTztBQUMzQyxTQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN0QyxZQUNHLFVBQVUsV0FBVyxLQUFLLEVBQzFCLEdBQUcsU0FBUyxTQUFPLE9BQU8sR0FBRyxDQUFDLEVBQzlCLEtBQUssTUFBTTtBQUVkLFdBQU8sR0FBRyxTQUFTLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLFlBQVEsU0FBUztBQUFBLEVBQ25CLENBQUM7QUFDTDs7O0FWN3VCTyxJQUFNLGVBQWVHLFFBQU87QUFNbkMsYUFBYSxJQUFJLGFBQWEsZUFBYTtBQUMzQyxhQUFhLElBQUksVUFBVSxZQUFVOzs7QURGckMsT0FBTyxhQUFhO0FBQ3BCLE9BQU9DLFdBQVU7QUFDakIsT0FBTyxlQUFnQjtBQUN2QixPQUFPLFFBQVE7QUFDZixPQUFPLFNBQVM7QUFDaEIsT0FBT0MsU0FBUTtBQUNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sV0FBVztBQUVsQixTQUFTLG9CQUFvQjtBQUU3QixPQUFPLGtCQUFrQjtBQUN6QixTQUFTLE9BQUFDLFlBQVc7QUFDcEIsT0FBT0MsVUFBUztBQUxoQixNQUFNLFFBQVEsb0JBQW9CO0FBUWxDLGVBQU8sZ0JBQWdCLEdBQUcsUUFBUTtBQUNsQyxlQUFPLGdCQUFnQkMsTUFBSyxLQUFLLGVBQU8sZUFBZSxlQUFPLGVBQWU7QUFDN0UsZUFBTyxnQkFBZ0JBLE1BQUssS0FBSyxHQUFHLE9BQU8sR0FBRyxVQUFVO0FBRXhELElBQUksQ0FBQ0MsSUFBRyxXQUFXLGVBQU8sYUFBYSxHQUFFO0FBQUUsRUFBQUEsSUFBRyxVQUFVLGVBQU8sZUFBZSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUc7QUFDcEcsSUFBSSxDQUFDQSxJQUFHLFdBQVcsZUFBTyxhQUFhLEdBQUU7QUFBRSxFQUFBQSxJQUFHLFVBQVUsZUFBTyxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBRztBQUlwRyxJQUFNLGNBQWMsUUFBUSxhQUFhLFVBQ25DRCxNQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsR0FBRyxTQUFTLElBQy9DQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVM7QUFHL0MsSUFBSSxDQUFDQyxJQUFHLFdBQVcsV0FBVyxHQUFHO0FBQUcsRUFBQUEsSUFBRyxVQUFVLGFBQWEsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFHO0FBQ3BGLElBQU0sV0FBV0QsTUFBSyxLQUFLLGFBQWEsZUFBTyxlQUFlO0FBQzlELElBQUk7QUFBQyxFQUFBQyxJQUFHLFdBQVcsUUFBUTtBQUFFLFNBQU8sR0FBRTtBQUFDO0FBQ3ZDLElBQUk7QUFBSSxNQUFJLENBQUNBLElBQUcsV0FBVyxRQUFRLEdBQUc7QUFBRSxJQUFBQSxJQUFHLFlBQVksZUFBTyxlQUFlLFVBQVUsVUFBVTtBQUFBLEVBQUc7QUFBQyxTQUMvRixHQUFFO0FBQUMsRUFBQUYsS0FBSSxNQUFNLDRCQUE0QjtBQUFDO0FBS2hELElBQUk7QUFDQSxRQUFNLEVBQUMsU0FBUyxXQUFXLE1BQUssSUFBSyxhQUFhO0FBQ2xELGlCQUFPLFNBQVMsR0FBRyxRQUFRLEtBQUs7QUFDaEMsaUJBQU8sVUFBVTtBQUNyQixTQUNRLEdBQUc7QUFDUixFQUFBQSxLQUFJLE1BQU0sMkNBQTJDO0FBQ3JELGlCQUFPLFNBQVMsR0FBRyxRQUFRO0FBQzNCLEVBQUFBLEtBQUksS0FBSyxZQUFZLGVBQU8sTUFBTSxFQUFFO0FBQ3BDLGlCQUFPLFVBQVU7QUFFbkI7QUFNRCxJQUFNLFVBQVUsVUFBVTtBQUFBLEVBQ3RCLFVBQVUsSUFBSSxLQUFLO0FBQUE7QUFBQSxFQUNuQixLQUFLO0FBQUE7QUFBQSxFQUNMLGlCQUFpQjtBQUFBO0FBQUEsRUFDakIsZUFBZTtBQUFBO0FBQ25CLENBQUM7QUFHRCxRQUFRLGFBQWEsZUFBTyxhQUFhO0FBR3pDLElBQU0sYUFBYUQsS0FBSSxhQUNuQkUsTUFBSyxLQUFLLFFBQVEsZUFBYyxxQkFBcUIsUUFBUSxJQUM3REEsTUFBSyxLQUFLLFFBQVE7QUFjdEIsSUFBTSxNQUFNLFFBQVE7QUFDcEIsSUFBSSxJQUFJLFdBQVcsRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLE9BQU8sS0FBSyxFQUFHLENBQUMsQ0FBQztBQUMvRCxJQUFJLElBQUksUUFBUSxLQUFLLEVBQUUsT0FBTyxPQUFPLENBQUMsQ0FBQztBQUN2QyxJQUFJLElBQUksUUFBUSxXQUFXLEVBQUMsVUFBVSxLQUFJLENBQUMsQ0FBQztBQUM1QyxJQUFJLElBQUksSUFBSSxDQUFDO0FBQ2IsSUFBSSxJQUFJLEtBQUssQ0FBQztBQUNkLElBQUksSUFBSSxXQUFVLFFBQVEsT0FBTyxlQUFPLGFBQWEsQ0FBQztBQUN0RCxJQUFJLElBQUksYUFBYSxDQUFDO0FBR3RCLElBQUksb0JBQW9CO0FBR3hCLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3hCLFFBQU0sWUFBWSxLQUFLLElBQUk7QUFDM0IsUUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLElBQUksSUFBSSxHQUFHO0FBRTFDLE1BQUksR0FBRyxVQUFVLE1BQU07QUFDbkIsVUFBTSxXQUFXLEtBQUssSUFBSSxJQUFJO0FBQzlCLFFBQUksV0FBVyxLQUFNO0FBQ2pCLE1BQUFELEtBQUksS0FBSyxrQ0FBa0MsU0FBUyxTQUFTLFFBQVEsSUFBSTtBQUFBLElBQzdFO0FBQ0EsUUFBSSxvQkFBb0IsS0FBSztBQUN6QixNQUFBQSxLQUFJLEtBQUssdUJBQXVCLGlCQUFpQiw4QkFBOEIsU0FBUyxFQUFFO0FBQUEsSUFDOUY7QUFBQSxFQUNKLENBQUM7QUFFRCxNQUFJLEdBQUcsU0FBUyxNQUFNO0FBQ2xCLFFBQUksQ0FBQyxJQUFJLGFBQWE7QUFDbEIsWUFBTSxXQUFXLEtBQUssSUFBSSxJQUFJO0FBQzlCLE1BQUFBLEtBQUksS0FBSyw2Q0FBNkMsU0FBUyxVQUFVLFFBQVEsSUFBSTtBQUFBLElBQ3pGO0FBQUEsRUFDSixDQUFDO0FBRUQsT0FBSztBQUNULENBQUM7QUFFRCxJQUFJLElBQUksV0FBVyxZQUFZO0FBVy9CLElBQUksUUFBUSxhQUFhO0FBRXpCLElBQUksVUFBVTtBQUFBLEVBQ1YsS0FBSyxNQUFNO0FBQUEsRUFDWCxNQUFNLE1BQU07QUFBQSxFQUNaLGFBQWE7QUFBQSxFQUNiLG9CQUFvQjtBQUFBLEVBQ3BCLE9BQU87QUFDVDtBQUVGLElBQU0sU0FBUyxNQUFNLGFBQWEsU0FBUyxHQUFHO0FBRzlDLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLGlCQUFpQjtBQUd4QixPQUFPLEdBQUcsY0FBYyxDQUFDLFdBQVc7QUFDaEM7QUFDQSxNQUFJLG9CQUFvQixLQUFLO0FBQ3pCLElBQUFBLEtBQUksS0FBSyxrQ0FBa0MsaUJBQWlCLEVBQUU7QUFBQSxFQUNsRTtBQUNBLFNBQU8sR0FBRyxTQUFTLE1BQU07QUFDckI7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDO0FBRUQsSUFBSSxlQUFPLGFBQVk7QUFDbkIsU0FBTyxPQUFPLGVBQU8sZUFBZSxNQUFNO0FBQ3RDLElBQUFBLEtBQUksS0FBSyx3Q0FBd0MsZUFBTyxNQUFNLElBQUksZUFBTyxhQUFhLEVBQUU7QUFBQSxFQUM1RixDQUFDO0FBQ0QsTUFBSSxlQUFPLFFBQVE7QUFDZiw0QkFBZ0IsS0FBSztBQUFBLEVBQ3pCO0FBQ0o7QUFNQSxJQUFPLGlCQUFRO0FBS2YsU0FBUyxlQUFlO0FBQ3BCLE1BQUksTUFBTyxNQUFNLElBQUk7QUFDckIsTUFBSSxNQUFNLE1BQU07QUFDaEIsTUFBSSxPQUFPLE1BQU0sT0FBTyxhQUFhLEVBQUU7QUFDdkMsTUFBSSxPQUFPLElBQUksZ0JBQWdCLEVBQUMsTUFBTSxNQUFNLEtBQVUsQ0FBQztBQUN2RCxNQUFJLE9BQU8sSUFBSSxrQkFBa0I7QUFDakMsT0FBSyxZQUFZLEtBQUs7QUFDdEIsT0FBSyxhQUFhLEtBQUs7QUFDdkIsT0FBSyxLQUFLLEtBQUssVUFBVTtBQUN6QixNQUFJLFdBQVcsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVO0FBQ2xELE1BQUksV0FBVyxJQUFJLGlCQUFpQixJQUFJO0FBQ3hDLFNBQU8sRUFBQyxLQUFLLFVBQVcsTUFBTSxTQUFRO0FBQzFDOzs7QVlqTUEsT0FBT0csU0FBUTtBQUdmLFNBQVMsaUJBQUFDLGdCQUFlLFNBQVMsVUFBQUMsZUFBYztBQUMvQyxTQUFRLFFBQUFDLGFBQVc7QUFDbkIsT0FBT0MsVUFBUztBQUNoQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxnQkFBQUMscUJBQW1CO0FBQzVCLE9BQU9DLFNBQVE7QUFHZixPQUFPLG9CQUFvQjtBQUczQixJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQUNiLGNBQWU7QUFDWCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVM7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGFBQWEsQ0FBQztBQUNuQixTQUFLLG9CQUFvQjtBQUFBLEVBQzdCO0FBQUEsRUFDQSxLQUFNLElBQUlDLFNBQVEsSUFBSSxJQUFJO0FBQ3RCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBU0E7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLHVCQUF1QjtBQUs1QixTQUFLLHFCQUFxQixZQUFZO0FBQ2xDLFVBQUksS0FBSyxtQkFBbUI7QUFDeEI7QUFBQSxNQUNKO0FBRUEsV0FBSyxvQkFBb0I7QUFFekIsYUFBTyxLQUFLLFdBQVcsU0FBUyxHQUFHO0FBQy9CLGNBQU0sTUFBTSxLQUFLLFdBQVcsTUFBTTtBQUNsQyxRQUFBQyxLQUFJLEtBQUssMERBQTBELEtBQUssV0FBVyxNQUFNLHNCQUFzQjtBQUUvRyxZQUFJO0FBQ0EsZ0JBQU0sS0FBSyxpQkFBaUIsSUFBSSxXQUFXLElBQUksYUFBYSxJQUFJLFdBQVc7QUFDM0UsY0FBSSxRQUFRLElBQUk7QUFBQSxRQUNwQixTQUFTLE9BQU87QUFDWixVQUFBQSxLQUFJLE1BQU0sc0RBQXNELE1BQU0sT0FBTyxFQUFFO0FBQy9FLGNBQUksT0FBTyxLQUFLO0FBQUEsUUFDcEI7QUFBQSxNQUNKO0FBRUEsV0FBSyxvQkFBb0I7QUFDekIsTUFBQUEsS0FBSSxLQUFLLHdFQUF3RTtBQUFBLElBQ3JGO0FBS0EsU0FBSyxtQkFBbUIsT0FBTyxXQUFXLGFBQWEsZ0JBQWdCO0FBQ25FLGFBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLFlBQUksWUFBWSxJQUFJQyxlQUFjO0FBQUEsVUFDOUIsTUFBTTtBQUFBLFVBQ04sZ0JBQWdCO0FBQUE7QUFBQSxVQUNoQixnQkFBZ0I7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULGFBQWE7QUFBQSxZQUNiLFlBQVk7QUFBQTtBQUFBLFVBQ2hCO0FBQUEsUUFDSixDQUFDO0FBR0Qsa0JBQVUsWUFBWSxjQUFjLENBQUc7QUFFdkMsWUFBSSxVQUFVO0FBQ2QsWUFBSSxnQkFBZ0IsT0FBTztBQUN2QixvQkFBVSwrQkFBK0IsU0FBUztBQUFBLFFBQ3RELFdBQ1MsZ0JBQWdCLFNBQVM7QUFDOUIsb0JBQVUsMEJBQTBCLFNBQVM7QUFBQSxRQUNqRCxPQUFPO0FBQ0gsVUFBQUQsS0FBSSxNQUFNLHNEQUFzRDtBQUNoRSxjQUFJLGFBQWEsQ0FBQyxVQUFVLFlBQVksR0FBRztBQUN2QyxzQkFBVSxNQUFNO0FBQUEsVUFDcEI7QUFDQSxpQkFBTyxJQUFJLE1BQU0sc0JBQXNCLENBQUM7QUFDeEM7QUFBQSxRQUNKO0FBRUEsa0JBQVUsR0FBRyxVQUFVLE1BQU07QUFBRSxzQkFBWTtBQUFBLFFBQU0sQ0FBQztBQUVsRCxrQkFBVSxZQUFZLEdBQUcsb0JBQW9CLFlBQVk7QUFDckQsY0FBSTtBQUNBLGtCQUFNLGdCQUFnQixNQUFNLFVBQVUsWUFBWSxrQkFBa0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBMkJuRTtBQUVELGdCQUFJLGVBQWU7QUFDZixjQUFBQSxLQUFJLEtBQUsseUNBQXlDLFdBQVcsNEJBQTRCLFdBQVcsRUFBRTtBQUd0RyxvQkFBTSxlQUFlLFdBQVcsTUFBTTtBQUNsQyxnQkFBQUEsS0FBSSxNQUFNLGdFQUFnRSxXQUFXLEVBQUU7QUFDdkYsb0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDRCQUFVLE1BQU07QUFBQSxnQkFDcEI7QUFDQSx1QkFBTyxJQUFJLE1BQU0sbUJBQW1CLENBQUM7QUFBQSxjQUN6QyxHQUFHLEdBQUs7QUFFUix3QkFBVSxZQUFZLE1BQU07QUFBQSxnQkFDeEIsUUFBUTtBQUFBLGdCQUNSLFlBQVk7QUFBQSxnQkFDWixpQkFBaUI7QUFBQSxnQkFDakIsYUFBYTtBQUFBLGdCQUNiLGVBQWU7QUFBQSxnQkFDZixXQUFXO0FBQUEsZ0JBQ1gsS0FBSztBQUFBLGtCQUNELFlBQVk7QUFBQSxrQkFDWixVQUFVO0FBQUEsZ0JBQ2Q7QUFBQSxnQkFDQSxVQUFVO0FBQUEsZ0JBQ1YsU0FBUztBQUFBLGtCQUNMLFlBQVk7QUFBQSxnQkFDaEI7QUFBQSxjQUNKLEdBQUcsQ0FBQyxTQUFTLGtCQUFrQjtBQUMzQiw2QkFBYSxZQUFZO0FBRXpCLG9CQUFJLENBQUMsU0FBUztBQUNWLGtCQUFBQSxLQUFJLE1BQU0sK0RBQStELFdBQVcsS0FBSyxpQkFBaUIsZ0JBQWdCLEVBQUU7QUFDNUgsc0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDhCQUFVLE1BQU07QUFBQSxrQkFDcEI7QUFDQSx5QkFBTyxJQUFJLE1BQU0saUJBQWlCLGtCQUFrQixDQUFDO0FBQUEsZ0JBQ3pELE9BQU87QUFDSCxrQkFBQUEsS0FBSSxLQUFLLHVGQUF1RixXQUFXLEVBQUU7QUFDN0csc0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDhCQUFVLE1BQU07QUFBQSxrQkFDcEI7QUFDQSwwQkFBUSxJQUFJO0FBQUEsZ0JBQ2hCO0FBQUEsY0FDSixDQUFDO0FBQUEsWUFDTCxPQUFPO0FBQ0gsY0FBQUEsS0FBSSxNQUFNLHdEQUF3RDtBQUNsRSxrQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsMEJBQVUsTUFBTTtBQUFBLGNBQ3BCO0FBQ0EscUJBQU8sSUFBSSxNQUFNLHdCQUF3QixDQUFDO0FBQUEsWUFDOUM7QUFBQSxVQUNKLFNBQVMsT0FBTztBQUNaLFlBQUFBLEtBQUksTUFBTSwwREFBMEQsTUFBTSxPQUFPLEVBQUU7QUFDbkYsZ0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLHdCQUFVLE1BQU07QUFBQSxZQUNwQjtBQUNBLG1CQUFPLEtBQUs7QUFBQSxVQUNoQjtBQUFBLFFBQ0osQ0FBQztBQUVELGtCQUFVLFFBQVEsT0FBTyxFQUFFLE1BQU0sQ0FBQyxVQUFVO0FBQ3hDLFVBQUFBLEtBQUksTUFBTSxxREFBcUQsTUFBTSxPQUFPLEVBQUU7QUFDOUUsY0FBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsc0JBQVUsTUFBTTtBQUFBLFVBQ3BCO0FBQ0EsaUJBQU8sS0FBSztBQUFBLFFBQ2hCLENBQUM7QUFBQSxNQUNMLENBQUM7QUFBQSxJQUNMO0FBS0EsWUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLFlBQVk7QUFDdkMsTUFBQUEsS0FBSSxLQUFLLCtEQUErRCxPQUFPO0FBQy9FLFdBQUssY0FBYyxrQkFBa0IsT0FBTztBQUM1QyxZQUFNLGNBQWM7QUFBQSxJQUN4QixDQUFDO0FBS0QsWUFBUSxPQUFPLG1CQUFtQixDQUFDLE9BQU8sZUFBZTtBQUNyRCxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLFVBQVc7QUFBRSxlQUFPLFNBQVM7QUFBQSxNQUFjLE9BQzFDO0FBQVksZUFBTztBQUFBLE1BQU87QUFBQSxJQUNuQyxDQUFDO0FBTUQsWUFBUSxPQUFPLGNBQWMsQ0FBQyxPQUFPLGVBQWU7QUFDaEQsWUFBTSxXQUFXLEtBQUssT0FBTyxlQUFlLFVBQVU7QUFDdEQsVUFBSSxVQUFXO0FBQ1gsaUJBQVMsa0JBQWtCLEtBQUs7QUFDaEMsaUJBQVMsT0FBTyxNQUFNO0FBQ3RCLGVBQU9ELFFBQU8sZUFBZSxVQUFVO0FBQ3ZDLGFBQUssZ0JBQWdCLGlCQUFpQixLQUFLLGdCQUFnQixlQUFlLE9BQU8sVUFBUSxLQUFLLGVBQWUsVUFBVTtBQUN2SCxlQUFPO0FBQUEsTUFDWCxPQUNLO0FBQUcsZUFBTztBQUFBLE1BQU87QUFBQSxJQUMxQixDQUFDO0FBSUQsWUFBUSxPQUFPLGVBQWUsQ0FBQyxPQUFPLGVBQWU7QUFDakQsWUFBTSxXQUFXLEtBQUssT0FBTyxlQUFlLFVBQVU7QUFDdEQsVUFBSSxVQUFXO0FBQ1gsZUFBTyxFQUFDLGFBQWEsU0FBUyxZQUFXO0FBQUEsTUFDN0MsT0FDSztBQUNELGVBQU8sRUFBQyxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxhQUFhLENBQUMsRUFBQztBQUFBLE1BQ2xGO0FBQUEsSUFDSixDQUFDO0FBTUQsWUFBUSxHQUFHLGNBQWMsQ0FBQyxVQUFVO0FBQUUsV0FBSyxjQUFjLG1CQUFtQjtBQUFJLFlBQU0sY0FBYztBQUFBLElBQUssQ0FBQztBQUkxRyxZQUFRLEdBQUcsYUFBYSxDQUFDLFVBQVU7QUFDL0IsWUFBTSxjQUFjLEtBQUssV0FBV0EsT0FBTTtBQUFBLElBQzlDLENBQUM7QUFJRCxZQUFRLE9BQU8sa0JBQWtCLENBQUMsVUFBVTtBQUN4QyxhQUFPLEtBQUssV0FBV0EsT0FBTTtBQUFBLElBQ2pDLENBQUM7QUFJRCxZQUFRLE9BQU8sY0FBYyxPQUFPLFVBQVU7QUFDMUMsWUFBTSxNQUFNLEtBQUssY0FBYztBQUMvQixVQUFJLENBQUMsSUFBSztBQUVWLFlBQU0sSUFBSSxZQUFZLFFBQVEsV0FBVztBQUN6QyxZQUFNLElBQUksWUFBWSxRQUFRLGlCQUFpQjtBQUFBLFFBQzNDLFVBQVUsQ0FBQyxTQUFTO0FBQUEsTUFDdEIsQ0FBQztBQUVILE1BQUFBLFFBQU8sY0FBYztBQUVyQixNQUFBQyxLQUFJLEtBQUssa0RBQWtEO0FBQzNELGFBQU8sS0FBSyxXQUFXRCxPQUFNO0FBQUEsSUFDakMsQ0FBQztBQU1ELFlBQVEsT0FBTyxZQUFZLENBQUMsT0FBTyxhQUFhO0FBQzVDLFlBQU0sTUFBTSxRQUFRLGFBQWEsVUFBVSxjQUFjLFFBQVEsTUFDakUsUUFBUSxhQUFhLFdBQVcsU0FBUyxRQUFRLE1BQ2pELGFBQWEsUUFBUTtBQUVyQixVQUFJO0FBQ0EsYUFBSyxLQUFLLENBQUMsVUFBVTtBQUNqQixjQUFJLE9BQU87QUFDUCxZQUFBQyxLQUFJLE1BQU0sZ0VBQWdFLEtBQUs7QUFDL0UsbUJBQU87QUFBQSxVQUNYO0FBQ0EsVUFBQUEsS0FBSSxLQUFLLHVEQUF1RDtBQUNoRSxpQkFBTztBQUFBLFFBQ1gsQ0FBQztBQUFBLE1BQ0wsU0FDTSxLQUFJO0FBQ04sUUFBQUEsS0FBSSxNQUFNLDZDQUE2QyxHQUFHO0FBQzFELGVBQU87QUFBQSxNQUNYO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxHQUFHLHFCQUFxQixDQUFDLFVBQVU7QUFBSSxZQUFNLGNBQWNELFFBQU87QUFBQSxJQUFlLENBQUM7QUFHMUYsWUFBUSxPQUFPLGtCQUFrQixZQUFZO0FBQ3JDLFVBQUksWUFBWSxNQUFNLGVBQWVBLFFBQU8sYUFBYTtBQUN6RCxVQUFJLE9BQU8sS0FBSyxNQUFNLFVBQVUsT0FBTyxPQUFPLE9BQU8sT0FBTyxHQUFJLElBQUk7QUFFcEUsYUFBTztBQUFBLElBQ2YsQ0FBQztBQUVELFlBQVEsT0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFFBQVE7QUFDakQsWUFBTSxTQUFTLE1BQU1HLFFBQU8sZUFBZ0IsS0FBSyxjQUFjLFlBQVksRUFBRSxZQUFZLENBQUMsZUFBZSxFQUFHLENBQUM7QUFDN0csVUFBSSxDQUFDLE9BQU8sVUFBUztBQUNqQixRQUFBRixLQUFJLEtBQUssd0JBQXdCLE9BQU8sU0FBUztBQUNqRCxZQUFJLFVBQVU7QUFDZCxZQUFJO0FBQ0EsY0FBSSxVQUFVRyxNQUFLLE9BQU8sVUFBVSxDQUFDLEdBQU1KLFFBQU8sZUFBZTtBQUNqRSxjQUFJLENBQUNLLElBQUcsV0FBVyxPQUFPLEdBQUU7QUFBQyxZQUFBQSxJQUFHLFVBQVUsT0FBTztBQUFBLFVBQUM7QUFDbEQsb0JBQVU7QUFFVixVQUFBTCxRQUFPLGtCQUFrQjtBQUN6QixVQUFBQyxLQUFJLEtBQUssOEJBQThCRCxPQUFNO0FBQUEsUUFDakQsU0FDTyxHQUFFO0FBQ0wsb0JBQVU7QUFDVixVQUFBQyxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQ2Y7QUFDQSxlQUFPLEVBQUMsV0FBV0QsUUFBTyxpQkFBaUIsUUFBaUI7QUFBQSxNQUNoRSxPQUNLO0FBQ0QsZUFBTyxFQUFDLFdBQVdBLFFBQU8saUJBQWlCLFNBQVUsV0FBVTtBQUFBLE1BQ25FO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxHQUFHLHNCQUFzQixPQUFPLE9BQU8sWUFBWTtBQUN2RCxVQUFJLFNBQVE7QUFDUixRQUFBQyxLQUFJLEtBQUssK0JBQStCLE9BQU87QUFDL0MsWUFBSSxVQUFVO0FBQ2QsWUFBSTtBQUNBLGNBQUksQ0FBQ0ksSUFBRyxXQUFXLE9BQU8sR0FBRTtBQUFDLFlBQUFBLElBQUcsVUFBVSxPQUFPO0FBQUEsVUFBQztBQUNsRCxvQkFBVTtBQUNWLFVBQUFMLFFBQU8sZ0JBQWdCO0FBQUEsUUFDM0IsU0FDTyxHQUFFO0FBQ0wsb0JBQVU7QUFDVixVQUFBQyxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQ2Y7QUFDQSxjQUFNLGNBQWMsRUFBQyxTQUFTRCxRQUFPLGVBQWUsUUFBaUI7QUFBQSxNQUN6RSxPQUNLO0FBQUcsY0FBTSxjQUFjLEVBQUMsU0FBU0EsUUFBTyxlQUFlLFNBQVUsV0FBVTtBQUFBLE1BQUU7QUFBQSxJQUN0RixDQUFDO0FBR0QsWUFBUSxPQUFPLDBCQUEwQixPQUFPLE9BQU8sU0FBUztBQUM1RCxVQUFJLFVBQVU7QUFDZCxZQUFNLFVBQVVJLE1BQUtKLFFBQU8sZUFBZSxLQUFLLFFBQVE7QUFDeEQsWUFBTSxXQUFXSSxNQUFLLFNBQVMsbUJBQW1CO0FBR2xELFVBQUk7QUFDQSxZQUFJLENBQUNDLElBQUcsV0FBVyxPQUFPLEdBQUU7QUFBQyxVQUFBQSxJQUFHLFVBQVUsT0FBTztBQUFBLFFBQUM7QUFDbEQsa0JBQVU7QUFBQSxNQUNkLFNBQ08sR0FBRTtBQUNMLGtCQUFVLEVBQUU7QUFDWixRQUFBSixLQUFJLE1BQU0sQ0FBQztBQUFBLE1BQ2Y7QUFFQSxVQUFJO0FBQ0EsY0FBTSxhQUFhLEtBQUssVUFBVSxNQUFNLE1BQU0sQ0FBQztBQUUvQyxhQUFLLE1BQU0sVUFBVTtBQUNyQixRQUFBSSxJQUFHLGNBQWMsVUFBVSxVQUFVO0FBQUEsTUFDekMsU0FDTyxPQUFPO0FBQ1YsUUFBQUosS0FBSSxNQUFNLHlFQUF5RSxLQUFLLEVBQUU7QUFDMUYsa0JBQVU7QUFBQSxNQUNkO0FBRUEsWUFBTSxjQUFjLEVBQUMsUUFBaUI7QUFBQSxJQUUxQyxDQUFDO0FBS0QsWUFBUSxPQUFPLFVBQVUsT0FBTyxVQUFVO0FBQ3RDLFlBQU0sVUFBVUcsTUFBS0osUUFBTyxlQUFjLEdBQUc7QUFDN0MsVUFBSSxXQUFXSSxNQUFLLFNBQVEsdUJBQXVCO0FBRW5ELFVBQUk7QUFDQSxZQUFJLE9BQU9DLElBQUcsYUFBYSxVQUFVLE1BQU07QUFFM0MsWUFBSSxZQUFZLEtBQUssS0FBSyxFQUN6QixNQUFNLElBQUksRUFDVixJQUFJLFVBQVE7QUFDWCxnQkFBTSxRQUFRLEtBQUssTUFBTSxnQ0FBZ0M7QUFDekQsY0FBSSxPQUFPO0FBQ1Qsa0JBQU0sQ0FBQyxFQUFFLE1BQU0sTUFBTSxPQUFPLElBQUk7QUFHaEMsZ0JBQUk7QUFDSixvQkFBUSxLQUFLLFlBQVksR0FBRztBQUFBLGNBQzFCLEtBQUs7QUFDSCx3QkFBUTtBQUNSO0FBQUEsY0FDRixLQUFLO0FBQ0gsd0JBQVE7QUFDUjtBQUFBLGNBQ0YsS0FBSztBQUNILHdCQUFRO0FBQ1I7QUFBQSxjQUNGO0FBQ0Usd0JBQVE7QUFBQSxZQUNaO0FBR0EsZ0JBQUksU0FBUztBQUNiLGdCQUFJLE9BQU87QUFHWCxnQkFBSSxRQUFRLFNBQVMsR0FBRyxHQUFHO0FBQ3pCLG9CQUFNLGFBQWEsUUFBUSxRQUFRLEdBQUc7QUFDdEMsdUJBQVMsUUFBUSxVQUFVLEdBQUcsVUFBVSxFQUFFLEtBQUs7QUFDL0MscUJBQU8sUUFBUSxVQUFVLGFBQWEsQ0FBQyxFQUFFLEtBQUs7QUFBQSxZQUNoRDtBQUVBLG1CQUFPLEVBQUUsTUFBTSxNQUFNLE1BQU0sT0FBTyxPQUFPO0FBQUEsVUFDM0M7QUFDQSxpQkFBTztBQUFBLFFBQ1QsQ0FBQyxFQUNBLE9BQU8sVUFBUSxTQUFTLElBQUk7QUFHN0IsZUFBTztBQUFBLE1BQ1gsU0FDTyxLQUFLO0FBQ1IsUUFBQUosS0FBSSxNQUFNLHdCQUF3QixHQUFHLEVBQUU7QUFDdkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUVKLENBQUM7QUFPRCxZQUFRLE9BQU8sZUFBZSxPQUFPLE9BQU8sUUFBUTtBQUNoRCxVQUFJLGNBQWMsQ0FBQztBQUNuQixVQUFJSSxJQUFHLFdBQVdMLFFBQU8sYUFBYSxHQUFHO0FBQ3JDLGNBQU0sVUFBVUssSUFBRyxZQUFZTCxRQUFPLGVBQWUsRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUN2RSxPQUFPLFlBQVUsT0FBTyxZQUFZLENBQUMsRUFDckMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUM5QixtQkFBVyxXQUFXLFNBQVM7QUFDM0IsZ0JBQU0sbUJBQW1CSSxNQUFLSixRQUFPLGVBQWUsU0FBUyxtQkFBbUI7QUFDaEYsY0FBSUssSUFBRyxXQUFXLGdCQUFnQixHQUFHO0FBQ3JDLGdCQUFJO0FBQ0Esb0JBQU0sZUFBZSxLQUFLLE1BQU1BLElBQUcsYUFBYSxrQkFBa0IsT0FBTyxDQUFDO0FBQzFFLGtCQUFJLENBQUMsYUFBYSxVQUFVO0FBQ3hCLDZCQUFhLFdBQVc7QUFBQSxjQUM1QjtBQUNBLDBCQUFZLEtBQUssWUFBWTtBQUFBLFlBQ2pDLFNBQVMsR0FBRztBQUNSLGNBQUFKLEtBQUksTUFBTSxnRUFBZ0UsT0FBTyxLQUFLLENBQUM7QUFBQSxZQUMzRjtBQUFBLFVBQ0E7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUNBLGFBQU87QUFBQSxJQUNULENBQUM7QUFPSCxZQUFRLE9BQU8sZUFBZSxPQUFPLE9BQU8sUUFBUTtBQUNoRCxVQUFJLFVBQVVHLE1BQU1KLFFBQU8sZUFBZSxHQUFHO0FBQzdDLFVBQUlLLElBQUcsU0FBUyxPQUFPLEVBQUUsWUFBWSxHQUFFO0FBQ25DLFlBQUk7QUFDQSxVQUFBQSxJQUFHLE9BQU8sU0FBUyxFQUFFLFdBQVcsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUFBLFFBQ3ZELFNBQ08sR0FBRztBQUFDLFVBQUFKLEtBQUksTUFBTSxDQUFDO0FBQUEsUUFBQztBQUFBLE1BQzNCO0FBQ0EsYUFBTztBQUFBLElBQ1gsQ0FBQztBQUlELFlBQVEsT0FBTywrQkFBK0IsT0FBTyxPQUFPLGFBQWE7QUFDckUsVUFBSTtBQUNBLGNBQU0sYUFBYUksSUFBRyxhQUFhLFVBQVUsUUFBUTtBQUNyRCxlQUFPLEVBQUUsWUFBd0IsUUFBUSxVQUFVO0FBQUEsTUFDdkQsU0FDTyxHQUFHO0FBQ04sUUFBQUosS0FBSSxNQUFNLDZDQUE2QyxDQUFDLEVBQUU7QUFDMUQsZUFBTyxFQUFFLFlBQVksT0FBTyxRQUFRLFFBQVE7QUFBQSxNQUNoRDtBQUFBLElBQ0osQ0FBQztBQVdGLFlBQVEsT0FBTyxrQkFBa0IsT0FBTyxPQUFPLFlBQVksd0JBQXdCO0FBQzlFLFlBQU0sV0FBVyxLQUFLLE9BQU8sZUFBZSxVQUFVO0FBQ3RELFlBQU0sZUFBZSxLQUFLLE1BQU0sbUJBQW1CO0FBQ25ELFVBQUksQ0FBQyxVQUFVO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLGFBQWEsQ0FBQyxFQUFFO0FBQUEsTUFBRTtBQUNuRyxVQUFJLGNBQWMsQ0FBQztBQUNuQixVQUFJLE1BQU9HLE1BQU1KLFFBQU8sZUFBZSxTQUFTLFdBQVcsVUFBVTtBQUVyRSxVQUFJSyxJQUFHLFdBQVcsR0FBRyxHQUFHO0FBQ3BCLGNBQU0sVUFBVUEsSUFBRyxZQUFZLEtBQUssRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUN0RCxPQUFPLFlBQVUsT0FBTyxZQUFZLENBQUMsRUFDckMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUU5QixtQkFBVyxlQUFlLFNBQVM7QUFDL0IsY0FBSSxZQUFZLFlBQVksTUFBTSxXQUFXO0FBQ3pDO0FBQUEsVUFDSjtBQUVBLGNBQUksV0FBVyxDQUFDO0FBQ2hCLGNBQUksZ0JBQWdCRCxNQUFLLEtBQUssYUFBYSxRQUFRO0FBR25ELG1CQUFTLFVBQVUsR0FBRyxXQUFXLEdBQUcsV0FBVztBQUMzQyxnQkFBSSxhQUFhQSxNQUFLLGVBQWUsT0FBTyxPQUFPLENBQUM7QUFHcEQscUJBQVMsT0FBTyxJQUFJO0FBQUEsY0FDaEIsTUFBTTtBQUFBLGNBQ04sVUFBVTtBQUFBLGNBQ1YsTUFBTTtBQUFBLGNBQ04sYUFBYTtBQUFBLFlBQ2pCO0FBRUEsZ0JBQUlDLElBQUcsV0FBVyxVQUFVLEdBQUc7QUFDM0Isa0JBQUksZUFBZUEsSUFBRyxZQUFZLFlBQVksRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUNoRSxPQUFPLFlBQVUsT0FBTyxPQUFPLENBQUMsRUFDaEMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUU5QixrQkFBSSxhQUFhLFNBQVMsR0FBRztBQUN6QixvQkFBSSxtQkFBbUIsYUFDbEIsSUFBSSxVQUFRO0FBQ1Qsc0JBQUksV0FBV0QsTUFBSyxZQUFZLElBQUk7QUFDcEMseUJBQU8sRUFBRSxNQUFNLE9BQU9DLElBQUcsU0FBUyxRQUFRLEVBQUUsTUFBTTtBQUFBLGdCQUN0RCxDQUFDLEVBQ0EsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQztBQUV4Qyx5QkFBUyxPQUFPLElBQUk7QUFBQSxrQkFDaEIsTUFBTUQsTUFBSyxZQUFZLGlCQUFpQixJQUFJO0FBQUEsa0JBQzVDLFVBQVUsaUJBQWlCO0FBQUEsa0JBQzNCLE1BQU0saUJBQWlCO0FBQUEsa0JBQ3ZCLGFBQWEsYUFBYSxhQUFhLE9BQU8sRUFBRTtBQUFBLGdCQUNwRDtBQUFBLGNBQ0o7QUFBQSxZQUNKO0FBQUEsVUFDSjtBQUVBLHNCQUFZLEtBQUs7QUFBQSxZQUNiO0FBQUEsWUFDQTtBQUFBLFVBQ0osQ0FBQztBQUFBLFFBQ0w7QUFBQSxNQUNKO0FBQ0EsYUFBTztBQUFBLElBQ1gsQ0FBQztBQWlCRCxZQUFRLE9BQU8sb0JBQW9CLE9BQU8sT0FBTyxZQUFZLGdCQUFnQjtBQUN6RSxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLENBQUMsVUFBVTtBQUFFLGVBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxVQUFVLE1BQU07QUFBQSxNQUFFO0FBQ25HLFVBQUksZ0JBQWdCO0FBQ3BCLFVBQUksTUFBT0EsTUFBTUosUUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFdBQVc7QUFHbEYsVUFBSSxDQUFDSyxJQUFHLFdBQVcsR0FBRyxHQUFHO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsTUFBTTtBQUFBLE1BQUU7QUFLN0csWUFBTSxvQkFBb0JBLElBQUcsWUFBWSxLQUFLLEVBQUUsZUFBZSxLQUFLLENBQUMsRUFDaEUsT0FBTyxZQUFVLE9BQU8sWUFBWSxLQUFLLE9BQU8sU0FBUyxZQUFZLE9BQU8sU0FBUyxXQUFXLEVBQ2hHLElBQUksWUFBVTtBQUNYLFlBQUksV0FBV0QsTUFBSyxLQUFLLE9BQU8sSUFBSTtBQUNwQyxlQUFPLEVBQUUsTUFBTSxPQUFPLE1BQU0sT0FBT0MsSUFBRyxTQUFTLFFBQVEsRUFBRSxNQUFNO0FBQUEsTUFDbkUsQ0FBQyxFQUNBLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSztBQUVyQyxVQUFJLGtCQUFrQixXQUFXLEdBQUc7QUFDaEMsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsTUFBTTtBQUFBLE1BQ3BGO0FBRUEsVUFBSSx3QkFBd0Isa0JBQWtCLENBQUMsRUFBRTtBQUNqRCxNQUFBSixLQUFJLEtBQUssdUVBQXVFLEtBQUsscUJBQXFCO0FBQzFHLFlBQU0sb0JBQW9CRyxNQUFLLEtBQUssdUJBQXVCLGNBQWMsTUFBTTtBQUMvRSxZQUFNLDRCQUE0QkEsTUFBSyxLQUFLLHFCQUFxQjtBQUdqRSxVQUFJLENBQUNDLElBQUcsV0FBVyxpQkFBaUIsR0FBRztBQUFFLGVBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxVQUFVLE9BQU8sMkJBQTBCLDZCQUE2QixNQUFNO0FBQUEsTUFBRTtBQUV6TCxhQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVEsV0FBVyxRQUFRLFdBQVcsVUFBVSxtQkFBbUIsMEJBQXFEO0FBQUEsSUFFdkosQ0FBQztBQWVELFlBQVEsT0FBTyxlQUFlLFlBQVk7QUFDdEMsWUFBTSxXQUFXLE1BQU0sS0FBSyxjQUFjLFdBQVcsWUFBWSxpQkFBaUI7QUFFbEYsWUFBTSxjQUFjLFNBQVMsSUFBSSxjQUFZO0FBQUEsUUFDekMsYUFBYSxRQUFRO0FBQUEsUUFDckIsV0FBVyxTQUFTLFdBQVcsSUFBSSxPQUFPLFFBQVE7QUFBQTtBQUFBLFFBQ2xELGFBQWEsUUFBUTtBQUFBLE1BQ3pCLEVBQUU7QUFFRixhQUFPO0FBQUEsSUFDWCxDQUFDO0FBV0QsWUFBUSxPQUFPLGVBQWUsT0FBTyxPQUFPLFdBQVcsYUFBYSxnQkFBZ0I7QUFDaEYsVUFBSTtBQUNBLGVBQU8sTUFBTSxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFFMUMsZUFBSyxXQUFXLEtBQUs7QUFBQSxZQUNqQjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKLENBQUM7QUFFRCxVQUFBSixLQUFJLEtBQUssMkRBQTJELEtBQUssV0FBVyxNQUFNLGlCQUFpQjtBQUczRyxjQUFJLENBQUMsS0FBSyxtQkFBbUI7QUFDekIsaUJBQUssbUJBQW1CLEVBQUUsTUFBTSxDQUFDLFVBQVU7QUFDdkMsY0FBQUEsS0FBSSxNQUFNLHFEQUFxRCxNQUFNLE9BQU8sRUFBRTtBQUFBLFlBQ2xGLENBQUM7QUFBQSxVQUNMO0FBQUEsUUFDSixDQUFDO0FBQUEsTUFDTCxTQUFTLE9BQU87QUFDWixRQUFBQSxLQUFJLEtBQUssMERBQTBELE1BQU0sT0FBTyxFQUFFO0FBQ2xGLGVBQU8sRUFBRSxTQUFTLE9BQU8sT0FBTyxNQUFNLFFBQVE7QUFBQSxNQUNsRDtBQUFBLElBQ0osQ0FBQztBQVFELFlBQVEsR0FBRyxlQUFlLE9BQU8sVUFBVTtBQUV2QyxZQUFNLGFBQWEsa0JBQWtCO0FBQ3JDLFdBQUssc0JBQXNCO0FBRzNCLGFBQU8sS0FBSyxVQUFVLEVBQUUsUUFBUSxDQUFDLGtCQUFrQjtBQUMvQyxtQkFBVyxhQUFhLEVBQUUsUUFBUSxDQUFDLFVBQVU7QUFFekMsY0FBSSxNQUFNLFdBQVcsVUFDakIsQ0FBQyxNQUFNLFFBQVEsV0FBVyxNQUFNLEtBQ2hDLENBQUMsTUFBTSxRQUFRLFdBQVcsVUFBVSxHQUFHO0FBQ3ZDLGdCQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDM0IsbUJBQUssc0JBQXNCLENBQUM7QUFBQSxZQUNoQztBQUNBLGlCQUFLLG9CQUFvQixLQUFLO0FBQUEsY0FDMUIsTUFBTTtBQUFBLGNBQ04sU0FBUyxNQUFNO0FBQUEsWUFDbkIsQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKLENBQUM7QUFBQSxNQUNMLENBQUM7QUFHRCxZQUFNLFlBQVksS0FBSyxPQUFPO0FBRzlCLFVBQUksS0FBSyxvQkFBb0I7QUFDekIsY0FBTSxZQUFZLEtBQUsscUJBQXFCLEtBQUssV0FBUyxNQUFNLFNBQVMsS0FBSyxrQkFBa0I7QUFDaEcsWUFBSSxXQUFXO0FBQ1gsZUFBSyxPQUFPLFNBQVMsVUFBVTtBQUMvQixlQUFLLE9BQU8sWUFBWSxVQUFVO0FBRWxDLGNBQUk7QUFDQSxrQkFBTSxFQUFDLFNBQVMsU0FBUyxJQUFHLElBQUlLLGNBQWEsVUFBVSxJQUFJO0FBQzNELGlCQUFLLE9BQU8sVUFBVSxRQUFRLEtBQUs7QUFBQSxVQUN2QyxTQUFTLEdBQUc7QUFDUixpQkFBSyxPQUFPLFVBQVU7QUFBQSxVQUMxQjtBQUFBLFFBQ0o7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJO0FBQ0EsZ0JBQU0sRUFBQyxTQUFTLFNBQVMsSUFBRyxJQUFLQSxjQUFhO0FBQzlDLGVBQUssT0FBTyxTQUFTQyxJQUFHLFFBQVEsR0FBRztBQUNuQyxlQUFLLE9BQU8sWUFBWTtBQUN4QixlQUFLLE9BQU8sVUFBVTtBQUFBLFFBQzFCLFNBQ08sR0FBRztBQUNOLGVBQUssT0FBTyxTQUFTO0FBQ3JCLGVBQUssT0FBTyxVQUFVO0FBQUEsUUFDMUI7QUFFQSxZQUFJLENBQUMsS0FBSyxPQUFPLFFBQVE7QUFDckIsY0FBSTtBQUNBLGlCQUFLLE9BQU8sU0FBU0EsSUFBRyxRQUFRO0FBRWhDLGtCQUFNLGdCQUFnQixPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssU0FBTyxXQUFXLEdBQUcsRUFBRSxLQUFLLFdBQVMsTUFBTSxZQUFZLEtBQUssT0FBTyxNQUFNLENBQUM7QUFDN0gsaUJBQUssT0FBTyxZQUFZO0FBQUEsVUFFNUIsU0FDTyxHQUFHO0FBQ04sWUFBQU4sS0FBSSxNQUFNLDBEQUEwRDtBQUNwRSxpQkFBSyxPQUFPLFNBQVM7QUFDckIsaUJBQUssT0FBTyxVQUFVO0FBQ3RCLGlCQUFLLE9BQU8sWUFBWTtBQUFBLFVBQzVCO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFHQSxVQUFJLEtBQUssT0FBTyxVQUFVLGFBQWE7QUFBRSxhQUFLLE9BQU8sU0FBUztBQUFBLE1BQU07QUFHcEUsVUFBSSxjQUFjLEtBQUssT0FBTyxVQUFVLEtBQUssT0FBTyxRQUFRO0FBQ3hELFFBQUFBLEtBQUksS0FBSyx5QkFBeUIsU0FBUyxPQUFPLEtBQUssT0FBTyxNQUFNLDhCQUE4QjtBQUdsRyxZQUFJLEtBQUssbUJBQW1CLEtBQUssZ0JBQWdCLE9BQU8sUUFBUSxHQUFHO0FBQy9ELGNBQUk7QUFDQSxrQkFBTSxLQUFLLGdCQUFnQixLQUFLO0FBQ2hDLGlCQUFLLGdCQUFnQixLQUFLLEtBQUssT0FBTyxPQUFPO0FBQzdDLFlBQUFBLEtBQUksS0FBSyxzQ0FBc0M7QUFBQSxVQUNuRCxTQUNPLEdBQUc7QUFDTixZQUFBQSxLQUFJLE1BQU0sa0RBQWtELENBQUM7QUFBQSxVQUNqRTtBQUFBLFFBQ0o7QUFHQSxZQUFJLGdCQUFRO0FBQ1IsY0FBSSxlQUFPLFdBQVc7QUFDbEIsMkJBQU8sTUFBTSxNQUFNO0FBQ2YsY0FBQUEsS0FBSSxLQUFLLCtDQUErQztBQUN4RCw2QkFBTyxPQUFPRCxRQUFPLGVBQWUsTUFBTTtBQUN0QyxnQkFBQUMsS0FBSSxLQUFLLDZDQUE2Q0QsUUFBTyxNQUFNLElBQUlBLFFBQU8sYUFBYSxFQUFFO0FBQUEsY0FDakcsQ0FBQztBQUFBLFlBQ0wsQ0FBQztBQUFBLFVBQ0wsT0FDSztBQUNELDJCQUFPLE9BQU9BLFFBQU8sZUFBZSxNQUFNO0FBQ3RDLGNBQUFDLEtBQUksS0FBSywyQ0FBMkNELFFBQU8sTUFBTSxJQUFJQSxRQUFPLGFBQWEsRUFBRTtBQUFBLFlBQy9GLENBQUM7QUFBQSxVQUNMO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFLQSxZQUFNLGNBQWM7QUFBQSxRQUNoQixRQUFRLEtBQUssT0FBTztBQUFBLFFBQ3BCLFdBQVcsS0FBSyxPQUFPO0FBQUEsUUFDdkIscUJBQXFCLEtBQUs7QUFBQSxRQUMxQixvQkFBb0IsS0FBSztBQUFBLE1BQzdCO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxPQUFPLHlCQUF5QixDQUFDLE9BQU8sUUFBUTtBQUNwRCxXQUFLLHFCQUFxQjtBQUFBLElBQzlCLENBQUM7QUFFRCxZQUFRLEdBQUcsMkJBQTJCLENBQUMsVUFBVTtBQUM3QyxXQUFLLHFCQUFxQjtBQUMxQixZQUFNLGNBQWM7QUFBQSxRQUNoQixRQUFRLEtBQUssT0FBTztBQUFBLFFBQ3BCLFdBQVcsS0FBSyxPQUFPO0FBQUEsUUFDdkIscUJBQXFCLEtBQUs7QUFBQSxRQUMxQixvQkFBb0IsS0FBSztBQUFBLE1BQzdCO0FBQUEsSUFDSixDQUFDO0FBb0JELFlBQVEsR0FBRyxzQkFBc0IsT0FBTyxPQUFPLFNBQVM7QUFDcEQsTUFBQUMsS0FBSSxLQUFLLCtCQUErQjtBQUN4QyxZQUFNLGNBQWMsS0FBSztBQUN6QixZQUFNLGNBQWMsS0FBSztBQUN6QixZQUFNLFdBQVcsS0FBSztBQUN0QixZQUFNLFNBQVMsS0FBSztBQUNwQixZQUFNLGFBQWEsS0FBSztBQUd4QixVQUFJLG1CQUFvQkcsTUFBS0osUUFBTyxlQUFlLFlBQVksV0FBVztBQUMxRSxVQUFJLE9BQU8sSUFBSSxNQUFLLG9CQUFJLEtBQUssR0FBRSxRQUFRLENBQUMsRUFBRSxtQkFBbUI7QUFDN0QsVUFBSSxVQUFVLE9BQU8sSUFBSSxFQUFFLFFBQVEsTUFBTSxHQUFHO0FBQzVDLFVBQUksb0JBQW9CSSxNQUFLLGtCQUFrQixPQUFPO0FBRXRELFVBQUk7QUFDQSxZQUFJLENBQUNDLElBQUcsV0FBVyxnQkFBZ0IsR0FBRztBQUFFLFVBQUFBLElBQUcsVUFBVSxrQkFBa0IsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQUk7QUFDOUYsWUFBSSxDQUFDQSxJQUFHLFdBQVcsaUJBQWlCLEdBQUU7QUFBRSxVQUFBQSxJQUFHLFVBQVUsbUJBQW1CLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxRQUFHO0FBQUEsTUFDbEcsU0FBUyxHQUFHO0FBQUMsUUFBQUosS0FBSSxNQUFNLENBQUM7QUFBQSxNQUFDO0FBR3pCLFlBQU0sZUFBZSxNQUFNLE1BQU0sbURBQW1ELE1BQU0sWUFBWTtBQUFBLFFBQ2xHLFNBQVMsRUFBQyxpQkFBaUIsVUFBVSxXQUFXLEdBQUs7QUFBQSxNQUN6RCxDQUFDLEVBQUUsTUFBTyxTQUFPO0FBQUMsUUFBQUEsS0FBSSxNQUFNLEdBQUc7QUFBQSxNQUFDLENBQUM7QUFFakMsVUFBSTtBQUNBLGNBQU0sYUFBYSxNQUFNLGFBQWEsWUFBWTtBQUNsRCxRQUFBSSxJQUFHLGNBQWNELE1BQUssbUJBQW1CLFFBQVEsR0FBRyxPQUFPLEtBQUssVUFBVSxDQUFDO0FBQUEsTUFDL0UsU0FBUyxHQUFHO0FBQUMsUUFBQUgsS0FBSSxNQUFNLENBQUM7QUFBQSxNQUFDO0FBRXpCLFlBQU0sa0JBQWtCLE1BQU0sTUFBTSxtREFBbUQsTUFBTSx1QkFBdUI7QUFBQSxRQUNoSCxTQUFTLEVBQUMsaUJBQWlCLFVBQVUsV0FBVyxHQUFLO0FBQUEsTUFDekQsQ0FBQyxFQUFFLE1BQU8sU0FBTztBQUFDLFFBQUFBLEtBQUksTUFBTSxHQUFHO0FBQUEsTUFBQyxDQUFDO0FBRWpDLFVBQUksZ0JBQWdCLElBQUk7QUFDcEIsY0FBTSxnQkFBZ0IsTUFBTSxnQkFBZ0IsWUFBWTtBQUN4RCxjQUFNLGNBQWNHLE1BQUssbUJBQW1CLEdBQUcsUUFBUSxNQUFNO0FBQzdELFlBQUk7QUFDQSxVQUFBQyxJQUFHLGNBQWMsYUFBYSxPQUFPLEtBQUssYUFBYSxDQUFDO0FBQ3hELFVBQUFKLEtBQUksS0FBSyxjQUFjLFFBQVEsUUFBUSxRQUFRLE1BQU07QUFBQSxRQUN6RCxTQUFTLEdBQUc7QUFBQyxVQUFBQSxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQUM7QUFBQSxNQUM3QixPQUNLO0FBQ0QsUUFBQUEsS0FBSSxNQUFNLGtEQUFrRDtBQUFBLE1BQ2hFO0FBQUEsSUFFSixDQUFDO0FBQUEsRUFJTDtBQUFBLEVBRUEsU0FBUyxLQUFLO0FBQ1YsUUFBSU8sT0FBTTtBQUNWLFFBQUk7QUFDRCxNQUFBQSxPQUFPLElBQUksWUFBWSxFQUFFLFNBQVMsTUFBTTtBQUFBLElBQzNDLFNBQ08sS0FBSztBQUNSLE1BQUFQLEtBQUksS0FBSyx5QkFBeUIsR0FBRyxFQUFFO0FBQUEsSUFDM0M7QUFDQSxXQUFPTztBQUFBLEVBQ1g7QUFBQSxFQUVBLFdBQVcsTUFBTTtBQUNiLFFBQUksYUFBYTtBQUFBLE1BQ2IsYUFBYSxLQUFLO0FBQUEsTUFDbEIsY0FBYyxLQUFLO0FBQUEsTUFDbkIsZ0JBQWdCLEtBQUs7QUFBQSxNQUNyQixTQUFTLEtBQUs7QUFBQSxNQUNkLGVBQWUsS0FBSztBQUFBLE1BQ3BCLGVBQWUsS0FBSztBQUFBLE1BQ3BCLGlCQUFpQixLQUFLO0FBQUEsTUFFdEIsZUFBZSxLQUFLO0FBQUEsTUFDcEIscUJBQXFCLEtBQUs7QUFBQSxNQUMxQiwyQkFBMkIsS0FBSztBQUFBLE1BRWhDLHFCQUFxQixLQUFLO0FBQUEsTUFDMUIsUUFBUSxLQUFLO0FBQUEsTUFDYixTQUFTLEtBQUs7QUFBQSxNQUNkLGFBQWEsS0FBSztBQUFBLE1BQ2xCLFNBQVMsS0FBSztBQUFBLE1BQ2QsTUFBTSxLQUFLO0FBQUEsTUFDWCxhQUFhLEtBQUs7QUFBQSxNQUNsQixXQUFXLEtBQUs7QUFBQSxJQUNsQjtBQUNGLFdBQU87QUFBQSxFQUNYO0FBQ0o7QUFFQSxJQUFPLHFCQUFRLElBQUksV0FBVzs7O0FkdjVCOUJDLEtBQUksUUFBUSxtQkFBbUI7QUFFL0JDLEtBQUksV0FBVztBQUNmLElBQUksVUFBVSxHQUFHLGVBQU8sYUFBYTtBQUVyQ0EsS0FBSSxZQUFZLGFBQWE7QUFDN0JBLEtBQUksYUFBYSxjQUFjO0FBRS9CQSxLQUFJLFdBQVcsS0FBSyxnQkFBZ0IsTUFBTTtBQUFFLFNBQU87QUFBUztBQUM1REEsS0FBSSxXQUFXLFFBQVEsU0FBUyxDQUFDLFlBQVk7QUFFekMsVUFBUSxRQUFRLE9BQU87QUFBQSxJQUNyQixLQUFLO0FBQVEsYUFBTyxDQUFDLE1BQU0sTUFBTSxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDbkcsS0FBSztBQUFRLGFBQU8sQ0FBQyxNQUFNLE9BQU8sUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ3BHLEtBQUs7QUFBUyxhQUFPLENBQUMsTUFBTSxJQUFJLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNsRyxLQUFLO0FBQVMsYUFBTyxDQUFDLE1BQU0sS0FBSyxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDbkcsS0FBSztBQUFXLGFBQU8sQ0FBQyxNQUFNLFFBQVEsUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ3hHO0FBQWEsYUFBTyxDQUFDLE9BQU8sUUFBUSxJQUFJLENBQUM7QUFBQSxFQUMzQztBQUNKO0FBQ0FBLEtBQUksUUFBUSxrQ0FBa0M7QUFDOUNBLEtBQUksUUFBUSw0Q0FBNEMsZUFBTyxPQUFPLElBQUksZUFBTyxJQUFJLE1BQU0sUUFBUSxRQUFRLElBQUksZUFBTyxjQUFjLGtCQUFrQixFQUFFLEVBQUU7QUFDMUpBLEtBQUksUUFBUSxrQ0FBa0M7QUFDOUNBLEtBQUksS0FBSyxtQ0FBbUMsT0FBTyxFQUFFO0FBSXJELEtBQUssbUJBQW1CLElBQUk7QUFDNUJELEtBQUksWUFBWSxhQUFhLG1CQUFtQiw4QkFBOEI7QUFFOUVBLEtBQUksWUFBWSxhQUFhLFFBQVEsSUFBSTtBQUN6Q0EsS0FBSSxZQUFZLGFBQWEsOEJBQThCO0FBRzNELElBQUksZUFBTyxlQUFlO0FBQ3RCLEVBQUFBLEtBQUksWUFBWSxhQUFhLGlCQUFpQixlQUFPLGFBQWE7QUFDdEU7QUFFQSxzQkFBYyxLQUFLLHlCQUFpQixjQUFNO0FBQzFDLG1CQUFXLEtBQUsseUJBQWlCLGdCQUFRLHFCQUFhO0FBT3RELFFBQVEsT0FBTyxHQUFHLFNBQVMsQ0FBQyxRQUFRO0FBQUUsTUFBSSxJQUFJLFNBQVMsU0FBUztBQUFFLElBQUFDLEtBQUksV0FBVyxRQUFRLFFBQVE7QUFBQSxFQUFNO0FBQUUsQ0FBQztBQUUxRyxRQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBUTtBQUNyQyxNQUFJLElBQUksU0FBUyxTQUFTO0FBQ3RCLElBQUFBLEtBQUksV0FBVyxRQUFRLFFBQVE7QUFDL0IsSUFBQUEsS0FBSSxLQUFLLDRFQUE0RTtBQUFBLEVBQ3pGLE9BQ0s7QUFBRyxJQUFBQSxLQUFJLE1BQU0sU0FBUyxJQUFJLE9BQU87QUFBQSxFQUFHO0FBQzdDLENBQUM7QUFHRCxJQUFJLFFBQVEsYUFBYSxRQUFTLENBQUFELEtBQUksa0JBQWtCQSxLQUFJLFFBQVEsQ0FBQztBQUdyRSxJQUFJLENBQUNBLEtBQUksMEJBQTBCLEdBQUc7QUFDbEMsRUFBQUEsS0FBSSxLQUFLO0FBQ1QsVUFBUSxLQUFLLENBQUM7QUFDbEI7QUFHQUEsS0FBSSxZQUFZLGFBQWEsYUFBYSxHQUFHO0FBRzdDLFFBQVEsSUFBSSw4QkFBOEIsSUFBSTtBQUM5QyxJQUFNLHNCQUFzQixRQUFRO0FBQ3BDLFFBQVEsY0FBYyxDQUFDLFNBQVNFLGFBQVk7QUFDeEMsTUFBSSxXQUFXLFFBQVEsWUFBWSxRQUFRLFNBQVMsOEJBQThCLEdBQUc7QUFBRztBQUFBLEVBQU87QUFDL0YsU0FBTyxvQkFBb0IsS0FBSyxTQUFTLFNBQVNBLFFBQU87QUFDN0Q7QUFFQUYsS0FBSSxHQUFHLHFCQUFxQixDQUFDLE9BQU8sYUFBYSxLQUFLLE9BQU8sYUFBYSxhQUFhO0FBQ25GLFFBQU0sZUFBZTtBQUNyQixXQUFTLElBQUk7QUFDakIsQ0FBQztBQUdEQSxLQUFJLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxnQkFBZ0I7QUFDbkQsY0FBWSxHQUFHLGlCQUFpQixDQUFDRyxRQUFPLFdBQVcsa0JBQWtCLGNBQWMsYUFBYSxnQkFBZ0IsbUJBQW1CO0FBRS9ILElBQUFGLEtBQUksS0FBSywrQkFBK0IsU0FBUyxNQUFNLGdCQUFnQixhQUFhLFlBQVksRUFBRTtBQUdsRyxRQUFJLGNBQWMsSUFBSTtBQUVsQixNQUFBQSxLQUFJLEtBQUssZ0dBQWdHO0FBQ3pHO0FBQUEsSUFDSjtBQUdBLFFBQUksY0FBYyxJQUFJO0FBQ2xCLE1BQUFBLEtBQUksTUFBTSwwQ0FBMEMsU0FBUyxNQUFNLGdCQUFnQixFQUFFO0FBQUEsSUFDekY7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDO0FBRURELEtBQUksR0FBRyxxQkFBcUIsTUFBTTtBQUM5Qix3QkFBYyxhQUFhO0FBRTNCLEVBQUFBLEtBQUksS0FBSztBQUNiLENBQUM7QUFFREEsS0FBSSxHQUFHLG1CQUFtQixNQUFNO0FBQzVCLE1BQUksc0JBQWMsWUFBWTtBQUMxQixRQUFJLHNCQUFjLFdBQVcsWUFBWSxFQUFHLHVCQUFjLFdBQVcsUUFBUTtBQUM3RSwwQkFBYyxXQUFXLE1BQU07QUFBQSxFQUNuQztBQUNKLENBQUM7QUFFREEsS0FBSSxHQUFHLFlBQVksTUFBTTtBQUNyQixRQUFNLGFBQWFJLGVBQWMsY0FBYztBQUMvQyxNQUFJLFdBQVcsUUFBUTtBQUFFLGVBQVcsQ0FBQyxFQUFFLE1BQU07QUFBQSxFQUFDLE9BQ3pDO0FBQUUsMEJBQWMsYUFBYTtBQUFBLEVBQUU7QUFDeEMsQ0FBQztBQUVESixLQUFJLFVBQVUsRUFBRSxLQUFLLE1BQUk7QUFDckIsaUJBQU8sT0FBTyxlQUFPLGVBQWUsTUFBTTtBQUN0QyxJQUFBQyxLQUFJLEtBQUssOENBQThDLGVBQU8sTUFBTSxJQUFJLGVBQU8sYUFBYSxFQUFFO0FBQUEsRUFDbEcsQ0FBQztBQUNMLENBQUMsRUFDQSxLQUFLLFlBQVU7QUFDWixjQUFZLGNBQWM7QUFFMUIsTUFBSSxlQUFPLFVBQVUsYUFBYTtBQUFFLG1CQUFPLFNBQVM7QUFBQSxFQUFNO0FBQzFELE1BQUksZUFBTyxRQUFRO0FBQUUsNEJBQWdCLEtBQUssZUFBTyxPQUFPO0FBQUEsRUFBRztBQUMzRCxtQkFBaUIsTUFBTSx1QkFBdUI7QUFFOUMsd0JBQWMsYUFBYTtBQUUzQixpQkFBZSxTQUFTLDRCQUE0QixNQUFNO0FBQUcsVUFBTSxNQUFNRyxlQUFjLGlCQUFpQjtBQUFHLFFBQUksS0FBSztBQUFFLFVBQUksWUFBWSxlQUFlO0FBQUEsSUFBRTtBQUFBLEVBQUMsQ0FBQztBQUN6SixpQkFBZSxTQUFTLFlBQVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFFL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIlJvdXRlciIsICJsb2ciLCAibG9nIiwgImNyeXB0byIsICJwYXRoIiwgImxvZyIsICJsb2ciLCAiY29uZmlnIiwgImFwcCIsICJfX2Rpcm5hbWUiLCAibG9nIiwgInBhdGgiLCAic2VydmVyIiwgImNyeXB0byIsICJzdHVkZW50IiwgInB1YmxpY1BhdGgiLCAiUm91dGVyIiwgInBhdGgiLCAiZnMiLCAibG9nIiwgInJvdXRlciIsICJSb3V0ZXIiLCAidCIsICJwYXRoIiwgImZzIiwgInBkZiIsICJleGVjIiwgIlJvdXRlciIsICJwYXRoIiwgImZzIiwgImFwcCIsICJsb2ciLCAicGF0aCIsICJmcyIsICJmcyIsICJCcm93c2VyV2luZG93IiwgImRpYWxvZyIsICJqb2luIiwgImxvZyIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAiY29uZmlnIiwgImxvZyIsICJCcm93c2VyV2luZG93IiwgImRpYWxvZyIsICJqb2luIiwgImZzIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJwZGYiLCAiYXBwIiwgImxvZyIsICJvcHRpb25zIiwgImV2ZW50IiwgIkJyb3dzZXJXaW5kb3ciXQp9Cg==
