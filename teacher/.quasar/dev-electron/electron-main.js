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
  bipDemo: false,
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
  buildDate: "20260203",
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
      const url = "http://localhost:9301";
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
if (typeof window !== "undefined") {
  if (window.process.type == "renderer") config_default.electron = true;
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
      buildforWEB: conf.buildforWEB
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL2VsZWN0cm9uLW1haW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVycm91dGVzLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3JvdXRlcy9zZXJ2ZXIvY29udHJvbC5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3NjaGVkdWxlcnNlcnZpY2UudHMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9lbi5qc29uIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2RlLmpzb24iLCAiLi4vLi4vc3JjL21zYWx1dGlscy9hdXRoQ29uZmlnLnRzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVyL2RhdGEuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuXG5cbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBzZXJ2ZXIgZnJvbSAnLi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnO1xuXG4vLyBTbyBFbGVjdHJvbiBzaW5nbGUtaW5zdGFuY2UgbG9jayB1c2VzIGEgZGlmZmVyZW50IHVzZXJEYXRhIHRoYW4gc3R1ZGVudCAobG9jayBrZXkgPSB1c2VyRGF0YSArIGV4ZWNQYXRoKVxuYXBwLnNldE5hbWUoJ25leHQtZXhhbS10ZWFjaGVyJyk7XG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxldCBsb2dmaWxlID0gYCR7Y29uZmlnLndvcmtkaXJlY3Rvcnl9L25leHQtZXhhbS10ZWFjaGVyLmxvZ2BcblxubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5cbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIGxvZ2ZpbGUgIH1cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcbmxvZy52ZXJib3NlKGBtYWluIEAgaW5pdDogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IHN0YXJ0aW5nIE5leHQtRXhhbSBUZWFjaGVyIFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW4gQCBpbml0OiBMb2dmaWxlbG9jYXRpb24gYXQgJHtsb2dmaWxlfWApXG5cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7XG4vLyBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdmb3JjZS1kZXZpY2Utc2NhbGUtZmFjdG9yJywgJzEnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2FsbG93LWZpbGUtYWNjZXNzLWZyb20tZmlsZXMnKTtcblxuXG5pZiAoY29uZmlnLndvcmtkaXJlY3RvcnkpIHtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCd1c2VyLWRhdGEtZGlyJywgY29uZmlnLndvcmtkaXJlY3RvcnkpO1xufVxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluOiBFUElQRSBFcnJvcjogRGVyIHN0ZG91dC1TdHJlYW0gZGVzIEVsZWN0cm9uTG9nZ2VycyB3aXJkIGRlYWt0aXZpZXJ0LicpO1xuICAgIH0gXG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW46JywgZXJyLm1lc3NhZ2UpOyB9ICAvLyBBbmRlcmUgRmVobGVyIHByb3Rva29sbGllcmVuIG9kZXIgYW56ZWlnZW5cbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKVxuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkge1xuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuIC8vIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udHJvbCBvdmVyIGNvbnNvbGUgZXJyb3JzXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUsIGZyYW1lUHJvY2Vzc0lkLCBmcmFtZVJvdXRpbmdJZCkgPT4ge1xuICAgICAgICAvLyBMb2cgdGhlIGVycm9yIGJ1dCBkb24ndCBjcmFzaCB0aGUgYXBwXG4gICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhhbmRsZSBzcGVjaWZpYyBlcnJvciBjb2Rlc1xuICAgICAgICBpZiAoZXJyb3JDb2RlID09PSAtMykge1xuICAgICAgICAgICAgLy8gLTMgaXMgRVJSX0FCT1JURUQsIG9mdGVuIHJlbGF0ZWQgdG8gYmxvYiBVUkxzIG9yIFBERiB2aWV3ZXJzXG4gICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IEFib3J0ZWQgbG9hZCBmb3IgYmxvYiBVUkwgb3IgUERGIHZpZXdlciAtIHRoaXMgaXMgdXN1YWxseSBzYWZlIHRvIGlnbm9yZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGb3Igb3RoZXIgZXJyb3IgY29kZXMsIGxvZyBidXQgY29udGludWVcbiAgICAgICAgaWYgKGVycm9yQ29kZSAhPT0gLTMpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IFVuZXhwZWN0ZWQgZXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufWApO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cgPSBudWxsXG4gICAgLy9pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIGFwcC5xdWl0KClcbiAgICBhcHAucXVpdCgpXG59KVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSkgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpfSAvLyBpZiB0aGVyZSBpcyBhIHdpbmRvdyAtIGZvY3VzXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KCkgfSAgICAgICAvLyBpZiBub3QgY3JlYXRlIG5ld1xufSlcblxuYXBwLndoZW5SZWFkeSgpLnRoZW4oKCk9PnsgICAgXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgLy8gc3RhcnQgZXhwcmVzcyBBUElcbiAgICAgICAgbG9nLmluZm8oYG1haW4gQCByZWFkeTogRXhwcmVzcyBsaXN0ZW5pbmcgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICB9KSBcbn0pXG4udGhlbihhc3luYyAoKT0+e1xuICAgIG5hdGl2ZVRoZW1lLnRoZW1lU291cmNlID0gJ2xpZ2h0JyAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3QgYXBwbHkgZGFyayBzeXN0ZW0gdGhlbWVzICh3ZSBoYXZlIGRhcmsgaWNvbnMgaW4gZWRpdG9yKVxuICAgIFxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG4gICAgcG93ZXJTYXZlQmxvY2tlci5zdGFydCgncHJldmVudC1kaXNwbGF5LXNsZWVwJylcblxuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KClcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K0QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcblxufSkiLCAiXG4vKipcbiAqIERPIE5PVCBFRElUIC0gdGhpcyBmaWxlIGlzIHdyaXR0ZW4gYnkgcHJlYnVpbGQuanMgdmlhIGVsZWN0cm9uLWJ1aWxkZXIuZW52IC0gZWRpdCB2YXJzIGluIGVsZWN0cm9uLWJ1aWxkZXIuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwRGVtbzogZmFsc2UsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgYmFja3VwZGlyZWN0b3J5OiBmYWxzZSwgIC8vIChvcHRpb25hbClcbiAgICBzZXJ2ZXJkaXJlY3Rvcnk6ICdFWEFNLVRFQUNIRVInLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcbiAgICBtdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0OiA2MDI1LCAgIC8vIG5lZWRlZCB0byBmaW5kIG90aGVyIGV4YW1zIGluIHRoZSBuZXR3b3JrIHdpdGggdGhlIHNhbWUgbmFtZSBhbmQgcHJldmVudCB1c2luZyB0aGUgc2FtZSBleGFtIG5hbWUgdHdpY2UgKGNvbmZ1c2lvbiBhbGVydClcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCIwLjAuMC4wXCIsICAgICAgIC8vIHNlcnZlci5qc1xuICAgIGdhdGV3YXk6IHRydWUsXG4gICAgZXhhbVNlcnZlckxpc3Q6IHt9LFxuICAgIGFjY2Vzc1Rva2VuOiBmYWxzZSxcbiAgICBidWlsZGZvcldFQjogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgZXhhbW1vZGVzOiB7XG4gICAgICAgIHJkcDogdHJ1ZSxcbiAgICAgICAgd2Vic2l0ZTogdHJ1ZSxcbiAgICAgICAgZ2Zvcm1zOiB0cnVlLFxuICAgICAgICBlZHV2aWR1YWw6IHRydWUsXG4gICAgICAgIGVkaXRvcjogdHJ1ZSxcbiAgICAgICAgbWF0aDogdHJ1ZSxcbiAgICAgICAgbWljcm9zb2Z0MzY1OiB0cnVlLFxuICAgICAgICBhY3RpdmVzaGVldHM6IHRydWVcbiAgICB9LFxuXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMjAzJyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBleHByZXNzIGZyb20gXCJleHByZXNzXCJcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcydcbmltcG9ydCBjb3JzIGZyb20gJ2NvcnMnXG5pbXBvcnQgZmlsZVVwbG9hZCBmcm9tIFwiZXhwcmVzcy1maWxldXBsb2FkXCI7XG5pbXBvcnQge3NlcnZlclJvdXRlcn0gZnJvbSAnLi9yb3V0ZXMvc2VydmVycm91dGVzLmpzJyBcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vbWFpbi9jb25maWcuanMnO1xuaW1wb3J0IGZzRXh0cmEgZnJvbSBcImZzLWV4dHJhXCJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgcmF0ZUxpbWl0ICBmcm9tICdleHByZXNzLXJhdGUtbGltaXQnICAvL3NpbXBsZSBkZG9zIHByb3RlY3Rpb25cbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB6aXAgZnJvbSAnZXhwcmVzcy1lYXN5LXppcCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCBvcyBmcm9tICdvcydcbmltcG9ydCBmb3JnZSBmcm9tICdub2RlLWZvcmdlJ1xuZm9yZ2Uub3B0aW9ucy51c2VQdXJlSmF2YVNjcmlwdCA9IHRydWU7IFxuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi4vLi4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBjb29raWVQYXJzZXIgZnJvbSAnY29va2llLXBhcnNlcidcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5cbmNvbmZpZy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpXG5jb25maWcud29ya2RpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcuaG9tZWRpcmVjdG9yeSwgY29uZmlnLnNlcnZlcmRpcmVjdG9yeSk7XG5jb25maWcudGVtcGRpcmVjdG9yeSA9IHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2V4YW0tdG1wJylcblxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5cblxuLy8gRGVmaW5lIHRoZSBkZXNrdG9wIHBhdGggYmFzZWQgb24gdGhlIHBsYXRmb3JtXG5jb25zdCBkZXNrdG9wUGF0aCA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMidcbiAgICA/IHBhdGguam9pbihwcm9jZXNzLmVudlsnVVNFUlBST0ZJTEUnXSwgJ0Rlc2t0b3AnKVxuICAgIDogcGF0aC5qb2luKGNvbmZpZy5ob21lZGlyZWN0b3J5LCAnRGVza3RvcCcpO1xuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmtcbmlmICghZnMuZXhpc3RzU3luYyhkZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhkZXNrdG9wUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIENoZWNrIGlmIHRoZSBkZXNrdG9wIGZvbGRlciBleGlzdHMgYW5kIGNyZWF0ZSBpZiBpdCBkb2Vzbid0XG5jb25zdCBsaW5rUGF0aCA9IHBhdGguam9pbihkZXNrdG9wUGF0aCwgY29uZmlnLnNlcnZlcmRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW46IGNhbid0IGNyZWF0ZSBzeW1saW5rXCIpfVxuXG5cblxuXG50cnkge1xuICAgIGNvbnN0IHtnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlfSA9ICBnYXRld2F5NHN5bmMoKVxuICAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKSAgICAvLyB0aGlzIHJldHVybnMgdGhlIGlwIG9mIHRoZSBpbnRlcmZhY2UgdGhhdCBoYXMgYSBkZWZhdWx0IGdhdGV3YXkuLiAgc2hvdWxkIHdvcmsgaW4gTU9TVCBjYXNlcy4gIHByb2JhYmx5IHByb3ZpZGUgXCJpcC1vcHRpb25zXCIgaW4gVUkgP1xuICAgIGNvbmZpZy5nYXRld2F5ID0gdHJ1ZVxufVxuIGNhdGNoIChlKSB7XG4gICBsb2cuZXJyb3IoXCJtYWluOiB1bmFibGUgdG8gZGV0ZXJtaW5lIGRlZmF1bHQgZ2F0ZXdheVwiKVxuICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKSBcbiAgIGxvZy5pbmZvKGBtYWluOiBJUCAke2NvbmZpZy5ob3N0aXB9YClcbiAgIGNvbmZpZy5nYXRld2F5ID0gZmFsc2VcblxuIH1cblxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpe1xuICAgIGlmICh3aW5kb3cucHJvY2Vzcy50eXBlID09IFwicmVuZGVyZXJcIikgY29uZmlnLmVsZWN0cm9uID0gdHJ1ZVxuICAgXG59XG5cblxuXG5jb25zdCBsaW1pdGVyID0gcmF0ZUxpbWl0KHtcbiAgICB3aW5kb3dNczogMSAqIDYwICogMTAwMCwgLy8gMSBtaW51dGVzXG4gICAgbWF4OiA0MDAsIC8vIExpbWl0IGVhY2ggSVAgdG8gNDAwIHJlcXVlc3RzIHBlciBgd2luZG93YCBcbiAgICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsIC8vIFJldHVybiByYXRlIGxpbWl0IGluZm8gaW4gdGhlIGBSYXRlTGltaXQtKmAgaGVhZGVyc1xuICAgIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLCAvLyBEaXNhYmxlIHRoZSBgWC1SYXRlTGltaXQtKmAgaGVhZGVyc1xufSlcblxuLy8gY2xlYW4gdGVtcCBkaXJlY3RvcnlcbmZzRXh0cmEuZW1wdHlEaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KVxuXG4vLyBMZWdlbiBTaWUgZGVuIFBmYWQgenVyIGBwdWJsaWMvYC1SZXNzb3VyY2UgYmFzaWVyZW5kIGF1ZiBkZW0gTW9kdXMgZmVzdC5cbmNvbnN0IHB1YmxpY1BhdGggPSBhcHAuaXNQYWNrYWdlZFxuICA/IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycpXG4gIDogcGF0aC5qb2luKCdwdWJsaWMnKTtcblxuLy8gS29waWVyZW4gU2llIGRlbiBJbmhhbHQgdm9uIGBwdWJsaWMvYCBpbiBkYXMgYGNvbmZpZy50ZW1wZGlyZWN0b3J5YC5cbi8vIGZzRXh0cmEuY29weShwdWJsaWNQYXRoLCBgJHtjb25maWcudGVtcGRpcmVjdG9yeX0vYCwgZnVuY3Rpb24gKGVycikge1xuLy8gICBpZiAoZXJyKSByZXR1cm4gY29uc29sZS5lcnJvcihlcnIpO1xuLy8gICBsb2cuaW5mbygnc2VydmVyOiBjb3BpZWQgcHVibGljIGRpcmVjdG9yeSB0byB0ZW1wLi4uJyk7XG4vLyB9KTtcblxuXG5cblxuXG5cbi8vIGluaXQgZXhwcmVzcyBBUElcbmNvbnN0IGFwaSA9IGV4cHJlc3MoKVxuYXBpLnVzZShmaWxlVXBsb2FkKHsgbGltaXRzOiB7IGZpbGVTaXplOiA1MCAqIDEwMjQgKiAxMDI0IH0sIH0pKSAgLy9XaGVuIHlvdSB1cGxvYWQgYSBmaWxlLCB0aGUgZmlsZSB3aWxsIGJlIGFjY2Vzc2libGUgZnJvbSByZXEuZmlsZXMgKGluaXQgYmVmb3JlIHJvdXRlcylcbmFwaS51c2UoZXhwcmVzcy5qc29uKHsgbGltaXQ6ICc1MG1iJyB9KSlcbmFwaS51c2UoZXhwcmVzcy51cmxlbmNvZGVkKHtleHRlbmRlZDogdHJ1ZX0pKTtcbmFwaS51c2UoemlwKCkpXG5hcGkudXNlKGNvcnMoKSlcbmFwaS51c2UoXCIvc3RhdGljXCIsZXhwcmVzcy5zdGF0aWMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKTtcbmFwaS51c2UoY29va2llUGFyc2VyKCkpO1xuXG4vLyBUcmFjayBjb25uZWN0aW9uIG1ldHJpY3MgZm9yIG1vbml0b3JpbmcgKGRlY2xhcmVkIGhlcmUgc28gaXQgY2FuIGJlIHVzZWQgaW4gbWlkZGxld2FyZSlcbmxldCBhY3RpdmVDb25uZWN0aW9ucyA9IDA7XG5cbi8vIFJlcXVlc3QgbW9uaXRvcmluZyBtaWRkbGV3YXJlIC0gbG9ncyByZXF1ZXN0IGR1cmF0aW9uIGFuZCB3YXJucyBvbiBzbG93IHJlcXVlc3RzXG5hcGkudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc3QgcmVxdWVzdElkID0gYCR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfWA7XG4gICAgXG4gICAgcmVzLm9uKCdmaW5pc2gnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgaWYgKGR1cmF0aW9uID4gNTAwMCkgeyAvLyBXYXJuIGlmIHJlcXVlc3QgdGFrZXMgbG9uZ2VyIHRoYW4gNSBzZWNvbmRzXG4gICAgICAgICAgICBsb2cud2Fybihgc2VydmVyOiBTbG93IHJlcXVlc3QgZGV0ZWN0ZWQ6ICR7cmVxdWVzdElkfSB0b29rICR7ZHVyYXRpb259bXNgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYWN0aXZlQ29ubmVjdGlvbnMgPiAxNTApIHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IEhpZ2ggbG9hZCAtICR7YWN0aXZlQ29ubmVjdGlvbnN9IGFjdGl2ZSBjb25uZWN0aW9ucyBkdXJpbmcgJHtyZXF1ZXN0SWR9YCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICByZXMub24oJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgbG9nLndhcm4oYHNlcnZlcjogUmVxdWVzdCBjbG9zZWQgYmVmb3JlIGNvbXBsZXRpb246ICR7cmVxdWVzdElkfSBhZnRlciAke2R1cmF0aW9ufW1zYCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBuZXh0KCk7XG59KTtcblxuYXBpLnVzZSgnL3NlcnZlcicsIHNlcnZlclJvdXRlcilcbi8vYXBpLnVzZShsaW1pdGVyKSAgLy9kaXNhYmxlZCBmb3Igbm93IGJlY2F1c2UgdGhpcyBuZWVkIGEgbG90IG9mIHRlc3RpbmcgdG8gZmluZCBnb29kIHBhcmFtZXRlcnNcblxuXG5cblxuXG5cblxuXG5cbmxldCBjZXJ0cyA9IGNyZWF0ZUNBQ2VydCgpICAvLyB3ZSBjYW4gbm90IHVzZSBzZWxmIHNpZ25lZCBjZXJ0cyBmb3Igd2ViIChmYWxsYmFjayB0byBsZXQncyBlbmNyeXB0ISlcblxudmFyIG9wdGlvbnMgPSB7XG4gICAga2V5OiBjZXJ0cy5rZXksXG4gICAgY2VydDogY2VydHMuY2VydCxcbiAgICByZXF1ZXN0Q2VydDogZmFsc2UsXG4gICAgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSxcbiAgICBhZ2VudDogZmFsc2VcbiAgfTtcblxuY29uc3Qgc2VydmVyID0gaHR0cHMuY3JlYXRlU2VydmVyKG9wdGlvbnMsIGFwaSk7XG5cbi8vIENvbmZpZ3VyZSB0aW1lb3V0cyBhbmQgY29ubmVjdGlvbiBsaW1pdHMgdG8gcHJldmVudCByZXNvdXJjZSBleGhhdXN0aW9uXG5zZXJ2ZXIudGltZW91dCA9IDMwMDAwOyAvLyAzMCBzZWNvbmRzIC0gY2xvc2UgaWRsZSBjb25uZWN0aW9ucyBhZnRlciAzMHNcbnNlcnZlci5rZWVwQWxpdmVUaW1lb3V0ID0gNTAwMDsgLy8gNSBzZWNvbmRzIC0gY2xvc2Uga2VlcC1hbGl2ZSBjb25uZWN0aW9ucyBhZnRlciA1cyBvZiBpbmFjdGl2aXR5XG5zZXJ2ZXIubWF4Q29ubmVjdGlvbnMgPSAyMDA7IC8vIExpbWl0IGNvbmN1cnJlbnQgY29ubmVjdGlvbnMgdG8gcHJldmVudCBvdmVybG9hZFxuXG4vLyBUcmFjayBjb25uZWN0aW9uIG1ldHJpY3MgZm9yIG1vbml0b3JpbmdcbnNlcnZlci5vbignY29ubmVjdGlvbicsIChzb2NrZXQpID0+IHtcbiAgICBhY3RpdmVDb25uZWN0aW9ucysrO1xuICAgIGlmIChhY3RpdmVDb25uZWN0aW9ucyA+IDE1MCkge1xuICAgICAgICBsb2cud2Fybihgc2VydmVyOiBIaWdoIGNvbm5lY3Rpb24gY291bnQ6ICR7YWN0aXZlQ29ubmVjdGlvbnN9YCk7XG4gICAgfVxuICAgIHNvY2tldC5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgIGFjdGl2ZUNvbm5lY3Rpb25zLS07XG4gICAgfSk7XG59KTtcblxuaWYgKGNvbmZpZy5idWlsZGZvcldFQil7ICAvLyB0aGUgYXBpIGlzIHN0YXJ0ZWQgYnkgdGhlIGVsZWN0cm9uIG1haW4gcHJvY2VzcyAtIGZvciB3ZWIgd2UgZG8gaXQgaGVyZVxuICAgIHNlcnZlci5saXN0ZW4oY29uZmlnLnNlcnZlckFwaVBvcnQsICgpID0+IHsgIFxuICAgICAgICBsb2cuaW5mbyhgc2VydmVyOiBFeHByZXNzIGxpc3RlbmluZyBvbiBodHRwczovLyR7Y29uZmlnLmhvc3RpcH06JHtjb25maWcuc2VydmVyQXBpUG9ydH1gKVxuICAgIH0pXG4gICAgaWYgKGNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgbXVsdGljYXN0Q2xpZW50LmluaXQoKVxuICAgIH1cbn1cblxuIFxuIFxuXG5cbmV4cG9ydCBkZWZhdWx0IHNlcnZlcjtcblxuXG5cblxuZnVuY3Rpb24gY3JlYXRlQ0FDZXJ0KCkge1xuICAgIGxldCByc2EgPSAgZm9yZ2UucGtpLnJzYTtcbiAgICBsZXQgcGtpID0gZm9yZ2UucGtpO1xuICAgIGxldCBzZWVkID0gZm9yZ2UucmFuZG9tLmdldEJ5dGVzU3luYygzMik7XG4gICAgbGV0IGtleXMgPSByc2EuZ2VuZXJhdGVLZXlQYWlyKHtiaXRzOiAxMDI0LCBzZWVkOiBzZWVkfSk7XG4gICAgdmFyIGNlcnQgPSBwa2kuY3JlYXRlQ2VydGlmaWNhdGUoKTtcbiAgICBjZXJ0LnB1YmxpY0tleSA9IGtleXMucHVibGljS2V5O1xuICAgIGNlcnQucHJpdmF0ZUtleSA9IGtleXMucHJpdmF0ZUtleTtcbiAgICBjZXJ0LnNpZ24oa2V5cy5wcml2YXRlS2V5KTtcbiAgICB2YXIgcGVtX3BrZXkgPSBwa2kucHJpdmF0ZUtleVRvUGVtKGtleXMucHJpdmF0ZUtleSk7XG4gICAgdmFyIHBlbV9jZXJ0ID0gcGtpLmNlcnRpZmljYXRlVG9QZW0oY2VydCk7XG4gICAgcmV0dXJuIHtrZXk6IHBlbV9wa2V5ICwgY2VydDogcGVtX2NlcnR9XG59O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IFJvdXRlciB9IGZyb20gJ2V4cHJlc3MnO1xuZXhwb3J0IGNvbnN0IHNlcnZlclJvdXRlciA9IFJvdXRlcigpXG5cbmltcG9ydCBjb250cm9sUm91dGVzIGZyb20gJy4vc2VydmVyL2NvbnRyb2wuanMnO1xuaW1wb3J0IGRhdGFSb3V0ZXMgZnJvbSAnLi9zZXJ2ZXIvZGF0YS5qcyc7XG5cblxuc2VydmVyUm91dGVyLnVzZSgnL2NvbnRyb2wvJywgY29udHJvbFJvdXRlcyk7XG5zZXJ2ZXJSb3V0ZXIudXNlKCcvZGF0YS8nLCBkYXRhUm91dGVzKTtcblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgUm91dGVyIH0gZnJvbSAnZXhwcmVzcydcbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpXG5pbXBvcnQgbXVsdGlDYXN0c2VydmVyIGZyb20gJy4uLy4uLy4uLy4uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RzZXJ2ZXIuanMnXG5pbXBvcnQgbXVsdGlDYXN0Y2xpZW50IGZyb20gJy4uLy4uLy4uLy4uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMnXG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uLy4uLy4uLy4uL21haW4vY29uZmlnLmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7IHQgfSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnQgZnMgZnJvbSAnZnMnIFxuaW1wb3J0IHFzIGZyb20gJ3FzJ1xuaW1wb3J0IGF4aW9zIGZyb20gXCJheGlvc1wiXG5pbXBvcnQgeyBtc2FsQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc3JjL21zYWx1dGlscy9hdXRoQ29uZmlnLnRzJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuLi8uLi8uLi8uLi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmxldCBUZXNzZXJhY3RXb3JrZXIgPSBmYWxzZVxuXG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbidcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5jb25zdCBmc3AgPSBmcy5wcm9taXNlcyBcblxuLyoqXG4gKiB0aGlzIHJvdXRlIGdlbmVyYXRlcyB0aGUgbmVzc2VzYXJ5IGNvZGVWZXJpZmllciBhbmQgY29kZUNoYWxsZW5nZSBmXHUwMEZDciBQS0NFIFxuICogYXV0aG9yaXphdGlvbiBmbG93IGZvciB0aGUgbWljcm9zb2Z0IG9uZWRyaXZlIGdyYXBoIEFQSVxuICogaXQgcmVjZWl2ZXMgYSBjb2RlIGFuZCB0aGVuIHJlZGlyZWN0cyB0byAvbXNhdXRoIHdoaWNoIHdpbGwgYXF1aXJlIGFuXG4gKiBhY2Nlc3N0b2tlblxuICovXG4gIFxucm91dGVyLmdldCgnL29hdXRoJywgKHJlcSwgcmVzKSA9PiB7XG4gICAgY29uc3QgY29kZVZlcmlmaWVyID0gZ2VuZXJhdGVDb2RlVmVyaWZpZXIoKTtcbiAgICBjb25zdCBjb2RlQ2hhbGxlbmdlID0gYmFzZTY0VXJsRW5jb2RlKHNoYTI1NihCdWZmZXIuZnJvbShjb2RlVmVyaWZpZXIsICd1dGYtOCcpKSk7XG4gICAgcmVzLmNvb2tpZSgnY29kZVZlcmlmaWVyJywgY29kZVZlcmlmaWVyLCB7IGh0dHBPbmx5OiB0cnVlIH0pO1xuICAgIGNvbmZpZy5jb2RlVmVyaWZpZXIgPSBjb2RlVmVyaWZpZXJcblxuICAgIGNvbnN0IGF1dGhVcmxQYXJhbXMgPSB7XG4gICAgICAgIGNsaWVudF9pZDogbXNhbENvbmZpZy5hdXRoLmNsaWVudElkLFxuICAgICAgICByZXNwb25zZV90eXBlOiAnY29kZScsXG4gICAgICAgIHJlZGlyZWN0X3VyaTogbXNhbENvbmZpZy5hdXRoLnJlZGlyZWN0VXJpLFxuICAgICAgICByZXNwb25zZV9tb2RlOiAncXVlcnknLFxuICAgICAgICBzY29wZTogJ29wZW5pZCBwcm9maWxlIG9mZmxpbmVfYWNjZXNzIEZpbGVzLlJlYWRXcml0ZS5BcHBGb2xkZXIgRmlsZXMuUmVhZCBGaWxlcy5SZWFkV3JpdGUnLFxuICAgICAgICBzdGF0ZTogJzEyMzQ1JyxcbiAgICAgICAgY29kZV9jaGFsbGVuZ2U6IGNvZGVDaGFsbGVuZ2UsXG4gICAgICAgIGNvZGVfY2hhbGxlbmdlX21ldGhvZDogJ1MyNTYnLFxuICAgIH07XG4gICAgY29uc3QgYXV0aFVybCA9IGBodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uL29hdXRoMi92Mi4wL2F1dGhvcml6ZT8ke3FzLnN0cmluZ2lmeShhdXRoVXJsUGFyYW1zKX1gO1xuICAgIHJlcy5yZWRpcmVjdChhdXRoVXJsKTtcbn0pO1xuICBcbi8qKlxuICogdGhpcyB1c2VzIHRoZSBjb2RlIGZyb20gL29hdXRoIHJvdXRlIHRvZ2V0aGVyIHdpdGggdGhlIGNsaWVudF9pZCB0byByZWNlaXZlXG4gKiBhbiBhY2Nlc3NUb2tlbiBmb3IgdGhlIG1pY3Jvc29mdCBvbmRyaXZlIEFQSVxuICogdGhlIHRva2VuIGlzIHN0b3JlZCBvbiB0aGUgZ2xvYmFsIGNvbmZpZyBvYmplY3QgYW5kIGNhbiBiZSByZXF1ZXN0ZWQgdmlhIC9nZXRjb25maWcgb3IgaXBjUmVuZGVyZXIgJ2dldGNvbmZpZ1xuICovXG5yb3V0ZXIuZ2V0KCcvbXNhdXRoJywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgY29uc3QgY29kZSA9IHJlcS5xdWVyeS5jb2RlO1xuICAgIGNvbnN0IGNvZGVWZXJpZmllciA9ICBjb25maWcuY29kZVZlcmlmaWVyO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdCgnaHR0cHM6Ly9sb2dpbi5taWNyb3NvZnRvbmxpbmUuY29tL2NvbW1vbi9vYXV0aDIvdjIuMC90b2tlbicsIHFzLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBjbGllbnRfaWQ6IG1zYWxDb25maWcuYXV0aC5jbGllbnRJZCxcbiAgICAgICAgICAgIGdyYW50X3R5cGU6ICdhdXRob3JpemF0aW9uX2NvZGUnLFxuICAgICAgICAgICAgc2NvcGU6ICdvcGVuaWQgcHJvZmlsZSBvZmZsaW5lX2FjY2VzcyBGaWxlcy5SZWFkV3JpdGUuQXBwRm9sZGVyIEZpbGVzLlJlYWQgRmlsZXMuUmVhZFdyaXRlJyxcbiAgICAgICAgICAgIGNvZGUsXG4gICAgICAgICAgICByZWRpcmVjdF91cmk6IG1zYWxDb25maWcuYXV0aC5yZWRpcmVjdFVyaSxcbiAgICAgICAgICAgIGNvZGVfdmVyaWZpZXI6IGNvZGVWZXJpZmllcixcbiAgICAgICAgICAgIH0pLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnLFxuICAgICAgICAgICAgICAgICdPcmlnaW4nOiAnaHR0cHM6Ly9sb2NhbGhvc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uZmlnLmFjY2Vzc1Rva2VuID0gcmVzcG9uc2UuZGF0YS5hY2Nlc3NfdG9rZW4gICAgIC8vIHdlIHJlY2VpdmVkIHRoZSBhY2Nlc3MgdG9rZW4gLSBzdG9yZSBpdCBvbiBnbG9iYWwgY29uZmlnIG9iamVjdFxuXG4gICAgICAgIGxldCBodG1sID0gYFxuICAgICAgICA8IURPQ1RZUEUgaHRtbD5cbiAgICAgICAgPGh0bWwgbGFuZz1cImVuXCI+XG4gICAgICAgICAgICA8aGVhZD5cbiAgICAgICAgICAgICAgICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIj5cbiAgICAgICAgICAgICAgICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMFwiPlxuICAgICAgICAgICAgICAgIDx0aXRsZT5DdXN0b20gQnV0dG9uPC90aXRsZT5cbiAgICAgICAgICAgICAgICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIi9zdGF0aWMvY3NzL3N0YXRpY3N0eWxlcy5jc3NcIj5cbiAgICAgICAgICAgICAgICA8c2NyaXB0PlxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGNsb3NlV2luZG93QWZ0ZXJGb3VyU2Vjb25kcygpIHsgc2V0VGltZW91dChmdW5jdGlvbigpIHsgd2luZG93LmNsb3NlKCk7IH0sIDQwMDApOyB9XG4gICAgICAgICAgICAgICAgPC9zY3JpcHQ+XG4gICAgICAgICAgICA8L2hlYWQ+XG4gICAgICAgICAgICA8Ym9keSBvbmxvYWQ9XCJjbG9zZVdpbmRvd0FmdGVyRm91clNlY29uZHMoKVwiPjxicj5cbiAgICAgICAgICAgICAgICA8aDM+TG9naW4gT0shPC9oMz4gPGJyPlxuICAgICAgICAgICAgPC9ib2R5PlxuICAgICAgICA8L2h0bWw+YFxuICAgICAgICByZXMuc2VuZChodG1sKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yLnJlc3BvbnNlLmRhdGEpO1xuICAgICAgICBsZXQgaHRtbCA9IGBcbiAgICAgICAgPCFET0NUWVBFIGh0bWw+XG4gICAgICAgIDxodG1sIGxhbmc9XCJlblwiPlxuICAgICAgICAgICAgPGhlYWQ+XG4gICAgICAgICAgICAgICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCI+XG4gICAgICAgICAgICAgICAgPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjBcIj5cbiAgICAgICAgICAgICAgICA8dGl0bGU+Q3VzdG9tIEJ1dHRvbjwvdGl0bGU+XG4gICAgICAgICAgICAgICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCIvc3RhdGljL2Nzcy9zdGF0aWNzdHlsZXMuY3NzXCI+XG4gICAgICAgICAgICA8L2hlYWQ+XG4gICAgICAgICAgICA8Ym9keT48YnI+XG4gICAgICAgICAgICAgICAgPGg0PiR7ZXJyb3IucmVzcG9uc2UuZGF0YS5lcnJvcl9kZXNjcmlwdGlvbn08L2g0PiA8YnI+XG4gICAgICAgICAgICAgICAgUGxlYXNlIGNsb3NlIHRoaXMgV2luZG93IGFuZCB0cnkgYWdhaW4hIDxicj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIG9uY2xpY2s9XCJ3aW5kb3cuY2xvc2UoKVwiIGNsYXNzPVwiY3VzdG9tLWJ0biBjdXN0b20tYnRuLWRhbmdlclwiPkNsb3NlIFdpbmRvdzwvYnV0dG9uPlxuICAgICAgICAgICAgPC9ib2R5PlxuICAgICAgICA8L2h0bWw+YFxuICAgICAgICByZXMuc3RhdHVzKDUwMCkuc2VuZChodG1sKTtcbiAgICB9XG4gIH0pO1xuXG5cblxuXG5cblxuLyoqXG4gKiBTVEFSVFMgYW4gZXhhbSBzZXJ2ZXIgaW5zdGFuY2VcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBjaG9zZW4gbmFtZSAoZm9yIGV4YW1wbGUgXCJtYXRoZVwiKVxuICogQHBhcmFtIHBhc3N3b3JkIHRoZSBwYXNzd29yZCB0byBlbnRlciB0aGUgZXhhbSAobm90IG5lY2Nlc3Nhcnkgb24gc2luZ2xlIGluc3RhbmNlIHN5c3RlbSAoYXBwKSBidXQgd2lsbCBiZSB1c2VkIHRvIGV4aXQgc2VjdXJlIGV4YW0gbW9kZSBpbiB0aGUgZnV0dXJlKVxuICogI0ZJWE1FICEhISAgVGhpcyByb3V0ZSBuZWVkcyB0byBiZSBzZWN1cmVkIChhbnlvbmUgY2FuIHN0YXJ0IGEgc2VydmVyIHJpZ2h0IG5vdyAtIG9yIDEwMDAgc2VydmVycylcbiAqL1xuIHJvdXRlci5wb3N0KCcvc3RhcnQvOnNlcnZlcm5hbWUvOnBhc3N3ZD8nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICAvLyB0aGlzIHJvdXRlIG1heSBiZSB1c2VkIGJ5IGxvY2FsaG9zdCBvbmx5XG4gICAgaWYgKCFyZXF1ZXN0U291cmNlQWxsb3dlZChyZXEsIHJlcykpIHJldHVybiAgIC8vIGZvciB0aGUgd2VidmVyc2lvbiB3ZSBuZWVkIHRvIGNoZWNrIHVzZXIgcGVybWlzc2lvbnMgaGVyZSAoZnV0dXJlIHN0dWZmKVxuXG4gICAgY29uc3QgYmlwID0gcmVxLmJvZHkuYmlwICAvLyB0aGlzIGluZm8gaXMgYWxzbyBzZW50IHZpYSBtdWx0aWNhc3RzZXJ2ZXIgbWVzc2FnZVxuICAgIGNvbnN0IGJpcElkID0gcmVxLmJvZHkuYmlwSWRcblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWUgXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIC8vIGxvZy5pbmZvKHJlcS5ib2R5KSAvLyBob2xkcyB3b3JrZGlyOiB3ZSBjb3VsZCBzdG9yZSB0aGUgY3VycmVudCB3b3JrZGlyZWN0b3J5IGZvciBldmVyeSBtY3NlcnZlciBvbiBtY3NlcnZlci5zZXJ2ZXJpbmZvIGluIHRoZSBmdXR1cmVcbiAgICBcbiAgICAvL2dlbmVyYXRlIHJhbmRvbSBwaW5cbiAgICBsZXQgcGluID0gU3RyaW5nKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSo5MDAwKSArIDEwMDApICAvLyA0IGRpZ2l0cyBpcyBlbm91Z2ggIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDkwMDApICsgMTAwMDtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXsgcGluID0gXCIxMTExXCIgfSAgXG5cbiAgICAvLyAvLyBjaGVjayBpZiBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nIGxvY2FsbHkgb3IgaW4gTEFOXG4gICAgaWYgKG1jU2VydmVyKSB7IFxuICAgICAgICByZXR1cm4gcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnNlcnZlcmV4aXN0c1wiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgIH0gXG5cbiAgICBmb3IgKGNvbnN0IGV4YW0gb2YgbXVsdGlDYXN0Y2xpZW50LmV4YW1TZXJ2ZXJMaXN0KSB7ICAvLyBkbyBub3QgdXNlIGZvckVhY2goKSBiZWNhdXNlIGl0cyBydW4gYXN5bmMgYW5kIHRoZSBpbnRlcnByZXRlciB3aWxsIG5vdCB3YWl0IGZvciBpdCB0byBmaW5pc2hcbiAgICAgICAgaWYgKHNlcnZlcm5hbWUgPT0gZXhhbS5zZXJ2ZXJuYW1lICl7XG4gICAgICAgICAgICByZXR1cm4gcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnNlcnZlcmV4aXN0c0xBTlwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgICAgICB9XG4gICAgIH1cbiAgICBcbiAgICBsb2cuaW5mbygnY29udHJvbCBAIHN0YXJ0OiBJbml0aWFsaXppbmcgbmV3IEV4YW0gU2VydmVyOicsIHNlcnZlcm5hbWUpXG4gICAgbGV0IG1jcyA9IG5ldyBtdWx0aUNhc3RzZXJ2ZXIoKTtcblxuICAgIGlmICghcmVxLnBhcmFtcy5wYXNzd2QpeyBcbiAgICAgICAgbWNzLmluaXQoc2VydmVybmFtZSwgcGluLCBcIlwiLCBiaXAsIGJpcElkKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbWNzLmluaXQoc2VydmVybmFtZSwgcGluLCByZXEucGFyYW1zLnBhc3N3ZCwgYmlwLCBiaXBJZClcbiAgICB9XG5cbiAgICBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV09bWNzXG4gICAgLy8gbG9nLmluZm8oY29uZmlnLndvcmtkaXJlY3RvcnkpXG4gICAgbGV0IHNlcnZlcmluc3RhbmNlZGlyID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBzZXJ2ZXJuYW1lKVxuXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc2VydmVyaW5zdGFuY2VkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBEaXJlY3RvcnkgbWlnaHQgYWxyZWFkeSBleGlzdCwgdGhhdCdzIG9rXG4gICAgfVxuICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zZXJ2ZXJzdGFydGVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSlcbiAgICBcbn0pXG5cblxuXG4vKipcbiAqIFNUT1BTIGFuIGV4YW0gc2VydmVyIGluc3RhbmNlXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgZXhhbSBzZXJ2ZXIgaW4gcXVlc3Rpb25cbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgY3NyZiB0b2tlbiBuZWVkZWQgdG8gcHJvY2VzcyB0aGUgcmVxdWVzdCAoZ2VuZXJhdGVkIGFuZCB0cmFuc2ZlcnJlZCB0byB0aGUgd2ViYnJvd3NlciBvbiBsb2dpbikgXG4gKi9cbiByb3V0ZXIuZ2V0KCcvc3RvcHNlcnZlci86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICBpZiAobWNTZXJ2ZXIgJiYgcmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHtcbiAgICAgIFxuICAgICAgICBtY1NlcnZlci5icm9hZGNhc3RJbnRlcnZhbC5zdG9wKClcblxuICAgICAgICBtY1NlcnZlci5zZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgLy9kZWxldGUgbWNTZXJ2ZXJcbiAgICAgICAgZGVsZXRlIGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyc3RvcHBlZFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0pXG5cbiAgICAgICAgXG4gICAgfVxufSlcblxuXG4vKipcbiAqIGNoZWNrcyBzZXJ2ZXJwYXNzd29yZCBmb3IgbG9naW4gdmlhIFZVRSBST1VURVJcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBjaG9zZW4gbmFtZSAoZm9yIGV4YW1wbGUgXCJtYXRoZVwiKVxuICogQHBhcmFtIHBhc3N3ZCB0aGUgcGFzc3dvcmQgbmVlZGVkIHRvIGVudGVyIHRoZSBkYXNoYm9hcmQgICEhRklYTUU6IHVzZSBodHRwcyBhbmQgcHJvcGVyIGF1dGggXG4gKiovXG4gcm91dGVyLmdldCgnL2NoZWNrcGFzc3dkLzpzZXJ2ZXJuYW1lLzpwYXNzd2Q/JywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZSBcbiAgICBsZXQgcGFzc3dkID0gcmVxLnBhcmFtcy5wYXNzd2RcbiAgICBpZiAoIXBhc3N3ZCl7IHBhc3N3ZCA9IFwiXCJ9ICAgLy8gd2UgYWxsb3cgZW1wdHkgcGFzc3dvcmRzIGZvciBub3dcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKG1jU2VydmVyKSB7IFxuICAgICAgICBpZiAocGFzc3dkID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnBhc3N3b3JkKXsgXG4gICAgICAgIHJldHVybiByZXMuc2VuZCgge1xuICAgICAgICAgICAgc2VuZGVyOiBcInNlcnZlclwiLCBcbiAgICAgICAgICAgIG1lc3NhZ2U6IHQoXCJjb250cm9sLmNvcnJlY3Rwd1wiKSwgXG4gICAgICAgICAgICBzdGF0dXM6IFwic3VjY2Vzc1wiLCBcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHBpbjogbWNTZXJ2ZXIuc2VydmVyaW5mby5waW4sXG4gICAgICAgICAgICBzZXJ2ZXJ0b2tlbjogbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbixcbiAgICAgICAgICAgIHNlcnZlcmlwOiBtY1NlcnZlci5zZXJ2ZXJpbmZvLmlwXG4gICAgICAgICAgICB9IFxuICAgICAgICB9ICl9IFxuICAgICAgICBlbHNlIHsgcmV0dXJuIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC53cm9uZ3B3XCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pIH1cbiAgICB9IFxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSlcbiAgICB9XG59KVxuXG5cbi8qKlxuICogIHNlbmRzIGEgbGlzdCBvZiBhbGwgcnVubmluZyBleGFtIHNlcnZlcnNcbiAqL1xucm91dGVyLmdldCgnL3NlcnZlcmxpc3QnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBsZXQgc2VydmVybGlzdCA9IFtdXG4gICAgT2JqZWN0LnZhbHVlcyhjb25maWcuZXhhbVNlcnZlckxpc3QpLmZvckVhY2goIHNlcnZlciA9PiB7XG4gICAgICAgIHNlcnZlcmxpc3QucHVzaCh7c2VydmVybmFtZTogc2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgaWQ6IHNlcnZlci5zZXJ2ZXJpbmZvLmlkLCBzZXJ2ZXJpcDogc2VydmVyLnNlcnZlcmluZm8uaXAsIHJlYWNoYWJsZTogdHJ1ZSwgcGFzc3dvcmQ6IHNlcnZlci5zZXJ2ZXJpbmZvLnBhc3N3b3JkLCB2ZXJzaW9uOiBzZXJ2ZXIuc2VydmVyaW5mby52ZXJzaW9ufSkgXG4gICAgfSk7XG4gICAgcmVzLnNlbmQoe3NlcnZlcmxpc3Q6c2VydmVybGlzdCwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0pXG59KVxuXG4vKipcbiAqICBzZW5kcyBhbiBcImFsaXZlXCIgc2lnbmFsIGJhY2tcbiAqL1xuIHJvdXRlci5nZXQoJy9wb25nJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgcmVzLnNlbmQoJ3BvbmcnKVxufSlcblxuXG5yb3V0ZXIucG9zdCgnL3BvbmcnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICByZXMuc2VuZCh7IHN0YXR1czogXCJzdWNjZXNzXCJ9KVxufSlcblxuXG5cblxubGV0IGRlbW9jbGllbnRzID0gW11cbmZvciAobGV0IGkgPSAwOyBpPDE2OyBpKysgKXtcbiAgICBsZXQgZGVtb2NsaWVudCA9IHtcbiAgICAgICAgY2xpZW50bmFtZTogYHVzZXItJHsgY3J5cHRvLnJhbmRvbUJ5dGVzKDYpLnRvU3RyaW5nKCdoZXgnKSAgfWAsXG4gICAgICAgIHRva2VuOiBgY3NyZi0ke2NyeXB0by5yYW5kb21VVUlEKCl9YCxcbiAgICAgICAgaXA6IGZhbHNlLFxuICAgICAgICBob3N0bmFtZTogZmFsc2UsXG4gICAgICAgIHNlcnZlcmlwOiBmYWxzZSxcbiAgICAgICAgc2VydmVybmFtZTogZmFsc2UsXG4gICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS5nZXRUaW1lKCkgLFxuICAgICAgICB2aXJ0dWFsaXplZDogdHJ1ZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICBleGFtdHlwZSA6IGZhbHNlLFxuICAgICAgICBwaW46IGZhbHNlLFxuICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgaW1hZ2V1cmw6XCJ1c2VyLWJsYWNrLnN2Z1wiLFxuICAgICAgICBzdGF0dXMgOiB7fSBcbiAgICB9XG4gICAgZGVtb2NsaWVudHMucHVzaChkZW1vY2xpZW50KVxufVxuXG5cblxuXG5cblxuLyoqXG4gKiAgUkVHSVNURVIgQ0xJRU5UXG4gKiAgY2hlY2tzIHBpbiBjb2RlLCBjcmVhdGVzIGNzcmYgdG9rZW4gZm9yIGNsaWVudCwgYW5zd2VyZXMgd2l0aCB0b2tlblxuICpcbiAqICBAcGFyYW0gcGluICB0aGUgcGluY29kZSB0byBjb25uZWN0IHRvIHRoZSBzZXJ2ZXJpbnN0YW5jZVxuICogIEBwYXJhbSBjbGllbnRuYW1lIHRoZSBuYW1lIG9mIHRoZSBzdHVkZW50XG4gKiAgQHBhcmFtIGNsaWVudGlwIHRoZSBjbGllbnRzIGlwIGFkZHJlc3MgZm9yIGFwaSBjYWxsc1xuICovXG5cblxuXG4gcm91dGVyLmdldCgnL3JlZ2lzdGVyY2xpZW50LzpzZXJ2ZXJuYW1lLzpwaW4vOmNsaWVudG5hbWUvOmNsaWVudGlwLzpob3N0bmFtZS86dmVyc2lvbi86YmlwdXNlcmlkJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY2xpZW50bmFtZSA9IHJlcS5wYXJhbXMuY2xpZW50bmFtZVxuICAgIGNvbnN0IGNsaWVudGlwID0gcmVxLnBhcmFtcy5jbGllbnRpcFxuICAgIGNvbnN0IHBpbiA9IHJlcS5wYXJhbXMucGluXG4gICAgY29uc3QgdmVyc2lvbiA9IHJlcS5wYXJhbXMudmVyc2lvblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCB0b2tlbiA9IGBjc3JmLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgaG9zdG5hbWUgPSByZXEucGFyYW1zLmhvc3RuYW1lXG4gICAgY29uc3QgYmlwdXNlcklEID0gcmVxLnBhcmFtcy5iaXB1c2VyaWRcblxuICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBDbGllbnQgVmVyc2lvbjpcIix2ZXJzaW9uKVxuICAgIC8vIHRoaXMgbmVlZHMgdG8gY2hhbmdlIG9uY2Ugd2UgcmVhY2hlZCB2MS4wIChmZWF0dXJlZnJlZXplIGZvciBzdGFibGUgdmVyc2lvbilcbiAgICBsZXQgdnRlYWNoZXIgPSBjb25maWcudmVyc2lvbi5zcGxpdCgnLicpLnNsaWNlKDAsIDIpLFxuICAgIHZlcnNpb250ZWFjaGVyID0gdnRlYWNoZXIuam9pbignLicpOyBcbiAgICBsZXQgdnN0dWRlbnQgPSB2ZXJzaW9uLnNwbGl0KCcuJykuc2xpY2UoMCwgMiksXG4gICAgdmVyc2lvbnN0dWRlbnQgPSB2c3R1ZGVudC5qb2luKCcuJyk7IFxuXG4gICAgLy9jb25zb2xlLmxvZyh2ZXJzaW9udGVhY2hlciwgdmVyc2lvbnN0dWRlbnQpXG4gIFxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChgJHt2ZXJzaW9udGVhY2hlcn1gICE9PSB2ZXJzaW9uc3R1ZGVudCApIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnZlcnNpb25taXNtYXRjaFwiKSwgc3RhdHVzOiBcImVycm9yXCIsIHZlcnNpb246IGNvbmZpZy52ZXJzaW9uLCB2ZXJzaW9uaW5mbzogY29uZmlnLmluZm99ICkgIH0gIFxuICAgIFxuICAgIGlmIChtY1NlcnZlci5zZXJ2ZXJzdGF0dXMucmVxdWlyZUJpUCAmJiBiaXB1c2VySUQgPT0gJ2ZhbHNlJyl7IC8vIHJlcS5wYXJhbXMgY29tZSBhcyBzdHJpbmcuLiBub3QgbmljZSBidXQgc2ltcGxlXG4gICAgICAgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLmJpcHJlcXVpcmVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSBcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHBpbiA9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnBpbikge1xuICAgICAgICAgICAgbGV0IHJlZ2lzdGVyZWRDbGllbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC5jbGllbnRuYW1lID09PSBjbGllbnRuYW1lKVxuICAgICAgICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoIXJlZ2lzdGVyZWRDbGllbnQpIHsgICAvLyBjcmVhdGUgY2xpZW50IG9iamVjdFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IGFkZGluZyBuZXcgY2xpZW50ICcke2NsaWVudG5hbWV9J2ApXG5cblxuICAgICAgICAgICAgICAgIC8vZ3JvdXAgaGFuZGxpbmcgLSBldmVyeWJvZHkgaXMgaW4gZ3JvdXBBIGV4Y2VwdCB0aGVyZSBpcyBhbHJlYWR5IGEgZ3JvdXAgY29uZmlndXJhdGlvblxuICAgICAgICAgICAgICAgIGxldCBncm91cCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEE/LnVzZXJzPy5pbmNsdWRlcyhjbGllbnRuYW1lKSkgeyBncm91cCA9ICdhJzsgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEI/LnVzZXJzPy5pbmNsdWRlcyhjbGllbnRuYW1lKSkgeyBncm91cCA9ICdiJzsgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgIC8vIHVzZXIgaXMgbm90IGluIGFueSBncm91cCBvciBubyBncm91cCBpcyBjb25maWd1cmVkXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwID0gJ2EnXG4gICAgICAgICAgICAgICAgICAgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBBLnVzZXJzLnB1c2goY2xpZW50bmFtZSlcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNsaWVudCA9IHsgICAgLy8gd2UgaGF2ZSBhIGRpZmZlcmVudCByZXByZXNlbnRhdGlvbiBvZiB0aGUgY2xpZW50b2JqZWN0IG9uIHRoZSBzZXJ2ZXIgdGhhbiBvbiB0aGUgY2xpZW50IC0gd2h5IGV4YWN0bHk/IHdlIGNvdWxkIGp1c3Qgc2VuZCB0aGUgd2hvbGUgY2xpZW50IG9iamVjdCB2aWEgUE9TVCAoYXMgd2UgYWxyZWFkeSBkbyBpbiAvdXBkYXRlIHJvdXRlIClcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50bmFtZTogY2xpZW50bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaG9zdG5hbWU6IGhvc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIGNsaWVudGlwOiBjbGllbnRpcCxcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcbiAgICAgICAgICAgICAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YW1tb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2V1cmw6ZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgYmlwdXNlcklEOiBiaXB1c2VySUQsICAvLyB3ZSBjYW4gdXNlIHRoaXMgaW4gdGhlIGZ1dHVyZSB0byByZS1jaGVjayBpZiB0aGlzIHVzZXIgaXMgaW4gdGhlIHByZS1kZWZpbmVkIHVzZXJsaXN0IGZvciB0aGlzIHNwZWNpZmljIEJJUCBleGFtXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogeyBncm91cDogZ3JvdXAgfHwgJ2EnfSwgICAgLy8gd2UgdXNlIHRoaXMgdG8gc3RvcmUgKHBlciBzdHVkZW50KSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0cyBnb2luZyBvbiBvbiB0aGUgc2VydmVyc2lkZSAodGFza2xpc3QpIGFuZCBzZW5kIGl0IGJhY2sgb24gL3VwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBhbGxvdyB0d28gZ3JvdXBzICh0aGlzIGlzIGp1c3QgdXNlZCBmb3IgZGlzdHJpYnV0aW9uIG9mIGZpbGVzIGJ5IG5vdylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9jcmVhdGUgZm9sZGVyIGZvciBzdHVkZW50XG4gICAgICAgICAgICAgICAgbGV0IHN0dWRlbnRmb2xkZXIgPXBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lICwgY2xpZW50bmFtZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLmFjY2VzcyhzdHVkZW50Zm9sZGVyKTsgLy8gQ2hlY2sgaWYgZGlyZWN0b3J5IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAvLyBkYXMgdmVyemVpY2huaXMgZlx1MDBGQ3IgZGllc2VuIHN0dWRlbnQgZXhpc3RpZXJ0IFxuICAgICAgICAgICAgICAgICAgICAvLyBhdWYgdW5peCBpc3QgZGVyIG9yZG5lcm5hbWUgMTAwJSBpZGVudCAtIGF1ZiB3aW5kb3dzIGtcdTAwRjZubnRlIGVzIGFiZXIgaW4gZGVyIGdyb3NzL2tsZWluc2NocmVpYnVuZyB1bnRlcnNjaGllZGUgZ2ViZW5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJcdTAwRkNmZSBvYiBlcyBFWEFLVCBnbGVpY2ggZ2VzY2hyaWViZW4gd3VyZGUgKGNhc2Utc2Vuc2l0aXYpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUoc3R1ZGVudGZvbGRlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldERpck5hbWUgPSBwYXRoLmJhc2VuYW1lKHN0dWRlbnRmb2xkZXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXJlY3RvcmllcyA9IChhd2FpdCBmcy5wcm9taXNlcy5yZWFkZGlyKHBhcmVudERpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghZGlyZWN0b3JpZXMuaW5jbHVkZXModGFyZ2V0RGlyTmFtZSkpIHsgIC8vIHdpciBoYWJlbiB3aW5kb3dzIGVydGFwcHQuLiBkZXIgZGF0ZWluYW1lIGlzdCBuaWNodCAxMDAlIGlkZW50IFwiVGVzdFwiICE9PSBcInRlc3RcIlxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ0RpciA9IGRpcmVjdG9yaWVzLmZpbmQoZGlyID0+IGRpci50b0xvd2VyQ2FzZSgpID09PSB0YXJnZXREaXJOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV4aXN0aW5nRGlyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IHBhdGguam9pbihwYXJlbnREaXIsIGV4aXN0aW5nRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKHBhcmVudERpciwgYGJhY2t1cC0ke2V4aXN0aW5nRGlyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLnJlbmFtZShvbGRQYXRoLCBuZXdQYXRoKTsgIC8vIFVtYmVuZW5uZW4gZGVzIGFsdGVuIFZlcnplaWNobmlzc2VzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogUmVuYW1pbmcgJHtvbGRQYXRofSB0byAke25ld1BhdGh9IC0gdGh4IGJpbGwgZ2F0ZXMgZm9yIHRoZSB3b3JzdCBvcGVyYXRpbmcgc3lzdGVtIG90d2ApXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBVc2luZyBhbHJlYWR5IGV4aXN0aW5nIGRpcmVjdG9yeTogJHt0YXJnZXREaXJOYW1lfWApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRGFzIFZlcnplaWNobmlzIGV4aXN0aWVydCBuaWNodCwgZXJzdGVsbGUgZXNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHN0dWRlbnRmb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogQ3JlYXRpbmcgJHtzdHVkZW50Zm9sZGVyfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChta2RpckVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IEVycm9yIGNyZWF0aW5nIGRpcmVjdG9yeTogJHtta2RpckVycn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRGlyZWN0b3J5IG1pZ2h0IGFscmVhZHkgZXhpc3QsIHRoYXQncyBva1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1jU2VydmVyLnN0dWRlbnRMaXN0LnB1c2goY2xpZW50KVxuICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnJlZ2lzdGVyZWRcIiksIHN0YXR1czogXCJzdWNjZXNzXCIsIHRva2VuOiB0b2tlbn0pICAvLyBvbiBzdWNjZXNzIHJldHVybiBjbGllbnQgdG9rZW4gKGF1dGggbmVlZGVkIGZvciBzZXJ2ZXIgYXBpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBsZXQgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgICAgICAgICBpZiAobm93IC0gMjAwMDAgPiByZWdpc3RlcmVkQ2xpZW50LnRpbWVzdGFtcCkgeyAvLyBzdHVkZW50IHByb2JhYmx5IHdlbnQgb2ZmbGluZSAodGVhY2hlciBjb25uZWN0aW9uIGxvc3MpIGJ1dCBpcyBjb21pbmcgYmFjayBub3dcbiAgICAgICAgICAgICAgICAgICAgcmVnaXN0ZXJlZENsaWVudC50aW1lc3RhbXAgPSBub3dcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IHN0dWRlbnQgcmVjb25uZWN0ZWRcIilcblxuICAgICAgICAgICAgICAgICAgICAvL2luZm9ybSBmcm9udGVuZCBhYm91dCByZS1jb25uZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKFwicmVjb25uZWN0ZWRcIiwgcmVnaXN0ZXJlZENsaWVudClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wucmVnaXN0ZXJlZFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgdG9rZW46IHJlZ2lzdGVyZWRDbGllbnQudG9rZW59KSAgLy9zZW5kIGJhY2sgb2xkIHRva2VuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgICAgICAgICAgICAgIH0gIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wud3JvbmdwaW5cIiksIHN0YXR1czogXCJlcnJvclwifSlcbiAgICAgICAgfVxuICAgIH1cbiAgICBjYXRjaCAoZXJyKXtcbiAgICAgICAgbG9nLmVycm9yKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6ICR7ZXJyfWApO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcImFuIHVua25vd24gZXJyb3Igb2NjdXJlZFwiLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgfVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogSU5GT1JNIENsaWVudChzKSBhYm91dCBhIFwic2VuZGZpbGVcIiByZXF1ZXN0IGZyb20gdGhlIHNlcnZlciAoY2xpZW50cyBzaG91bGQgZG93bmxvYWQgdGhlIGZpbGUocykgdmlhIC9kYXRhL2Rvd25sb2FkLy4uLiByb3V0ZSkgXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgdGhhdCB3YWl0cyB3aXRoIHRoZSBmaWxlXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBzZW5kIHRoZSBleGFtIChmYWxzZSBtZWFucyBldmVyeWJvZHkpXG4gKi9cbiByb3V0ZXIucG9zdCgnL3NlbmR0b2NsaWVudC86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGNvbnN0IGZpbGVzID0gcmVxLmJvZHkuZmlsZXMgICAvLyAgeyBmaWxlczpbIHtuYW1lOmZpbGUubmFtZSwgcGF0aDpmaWxlLnBhdGggfSwge25hbWU6ZmlsZS5uYW1lLCBwYXRoOmZpbGUucGF0aCB9IF0gfVxuICAgXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddID0gdHJ1ZSAgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSAgZmlsZXNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddPSB0cnVlIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gZmlsZXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuZXhhbXJlcXVlc3RcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiAgS0lDSyBjbGllbnQgLSBjbGllbnQgd2lsbCBnZXQgZXJyb3IgcmVzcG9uc2Ugb24gbmV4dCB1cGRhdGUgYW5kIHJlbW92ZSBjb25uZWN0aW9uIGF1dG9tYXRpY2FsbHlcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciB0aGF0IHdhbnRzIHRvIGtpY2sgdGhlIGNsaWVudFxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgYmUga2lja2VkXG4gKi9cbi8vICByb3V0ZXIuZ2V0KCcva2ljay86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbi8vICAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4vLyAgICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbi8vICAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4vLyAgICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuLy8gICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4vLyAgICAgICAgIGlmIChzdHVkZW50KSB7ICAgbWNTZXJ2ZXIuc3R1ZGVudExpc3QgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maWx0ZXIoIGVsID0+IGVsLnRva2VuICE9PSAgc3R1ZGVudHRva2VuKTsgfSAvLyByZW1vdmUgY2xpZW50IGZyb20gc3R1ZGVudGxpc3Rcbi8vICAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0dWRlbnRyZW1vdmVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbi8vICAgICB9XG4vLyAgICAgZWxzZSB7XG4vLyAgICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4vLyAgICAgfVxuLy8gfSlcblxuXG5cblxuLyoqXG4gKiBTRVQgY2llbnRzIFNIQVJFIExJTksgZm9yIG1pY3Jvc29mdDM2NSBtb2RlXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXJzIG5hbWVcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIGJlIGtpY2tlZFxuICovXG5yb3V0ZXIucG9zdCgnL3NoYXJlbGluay86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGNvbnN0IHNoYXJlbGluayA9IHJlcS5ib2R5LnNoYXJlbGlua1xuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgIGlmIChzdHVkZW50KSB7ICAgXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5tc29mZmljZXNoYXJlID0gc2hhcmVsaW5rXG4gICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zdHVkZW50dXBkYXRlXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuICAgIH1cbn0pXG5cblxuXG5cbi8qKlxuICogUkVTVE9SRSBjaWVudHMgZm9jdXNlZCBzdGF0ZSAgISEgVVNFIC9zZXRzdHVkZW50c3RhdHVzLyBpbnN0ZWFkIChzaW1wbGlmeSBjb2RlKVxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIFxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobydzIHN0YXRlIHNob3VsZCBiZSByZXN0b3JlZFxuICovXG4gcm91dGVyLmdldCgnL3Jlc3RvcmUvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3RcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICBpZiAoc3R1ZGVudCkgeyAgIFxuICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMucmVzdG9yZWZvY3Vzc3RhdGUgPSB0cnVlICAvLyBzZXQgc3R1ZGVudC5zdGF0dXMgc28gdGhhdCB0aGUgc3R1ZGVudCBjYW4gcmVzdG9yZSBpdHMgZm9jdXMgc3RhdGUgb24gdGhlIG5leHQgdXBkYXRlXG4gICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zdGF0ZXJlc3RvcmVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIEZFVENIIEVYQU1TIGZyb20gY29ubmVjdGVkIGNsaWVudHMgKHNldCBzdHVkZW50LnN0YXR1cyAtIHN0dWRlbnRzIHdpbGwgdGhlbiBzZW5kIHRoZWlyIHdvcmtkaXJlY3RvcnkgdG8gL2RhdGEvcmVjZWl2ZSlcbiAqIGF0dGVudGlvbiEhICBtb3ZlIHRvIHNldFN0dWRlbnRTdGF0dXMgZXZlbnR1YWxseS4uIGJlY2F1c2UgaXRzIHJlZHVuZGFudFxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIHRoYXQgd2FudHMgdG8ga2ljayB0aGUgY2xpZW50XG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBzZW5kIHRoZSBleGFtIChmYWxzZSBtZWFucyBldmVyeWJvZHkpXG4gKi9cbiByb3V0ZXIuZ2V0KCcvZmV0Y2gvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIGlmIChyZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyAgLy9maXJzdCBjaGVjayBpZiBjc3JmIHRva2VuIGlzIHZhbGlkIGFuZCBzZXJ2ZXIgaXMgYWxsb3dlZCB0byB0cmlnZ2VyIHRoaXMgYXBpIHJlcXVlc3RcbiAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PT0gXCJhbGxcIil7XG4gICAgICAgICAgICBmb3IgKGxldCBzdHVkZW50IG9mIG1jU2VydmVyLnN0dWRlbnRMaXN0KXsgc3R1ZGVudC5zdGF0dXNbJ3NlbmRleGFtJ10gPSB0cnVlICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICBpZiAoc3R1ZGVudCkgeyAgc3R1ZGVudC5zdGF0dXNbJ3NlbmRleGFtJ109IHRydWUgIH0gICBcbiAgICAgICAgfVxuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuZXhhbXJlcXVlc3RcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuXG5cbi8qKlxuICogR2V0IHByZXZpb3VzIFNlcnZlcnN0YXR1cyBhbmQgcmV0dXJuIFNlcnZlcnN0YXR1cyBmcm9tIEZJTEUgKGZyb20gcHJldmlvdXMgaW50ZXJydXB0ZWQgZXhhbSBpbiBvcmRlciB0byByZXN1bWUpXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIFxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiBzZXJ2ZXJ0b2tlbiB0byBhdXRoZW50aWNhdGUgYmVmb3JlIHRoZSByZXF1ZXN0IGlzIHByb2Nlc3NlZFxuICovXG5yb3V0ZXIucG9zdCgnL2dldHNlcnZlcnN0YXR1cy86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY3NyZnNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBpZiAoY3NyZnNlcnZlcnRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7IHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnRva2Vubm90dmFsaWRcIiksIHN0YXR1czogXCJlcnJvclwifSApfVxuICAgIC8vIG1jU2VydmVyLnNlcnZlcnN0YXR1cyB2b24gZGVyIEpTT04tRGF0ZWkgd2llZGVyIGltcG9ydGllcmVuXG4gICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgJ3NlcnZlcnN0YXR1cy5qc29uJyk7XG4gICAgbGV0IHNlcnZlcnN0YXR1cztcbiAgICB0cnkgeyAgXG4gICAgICAgIGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgICBzZXJ2ZXJzdGF0dXMgPSBKU09OLnBhcnNlKGZpbGVDb250ZW50KTsgXG4gICAgICAgIG1jU2VydmVyLnNlcnZlcmluZm8ucGluID0gc2VydmVyc3RhdHVzLnBpbiAgLy9hbHNvIHJlc3RvcmUgbGFzdCBwaW4gdG8gbWFrZSBpdCBlYXNpZXIgZm9yIHN0dWRlbnRzXG4gICAgfSAgICBcbiAgICBjYXRjaCAoZXJyb3IpIHsgIHNlcnZlcnN0YXR1cyA9IGZhbHNlOyAgfVxuICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBzZXJ2ZXJzdGF0dXM6IHNlcnZlcnN0YXR1c30pIFxufSlcblxuLy9nZXQgY3VycmVudCBzZXJ2ZXJzdGF0dXMgZnJvbSBtY3NlcnZlclxucm91dGVyLmdldCgnL2dldGN1cnJlbnRzZXJ2ZXJzdGF0dXMvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNzcmZzZXJ2ZXJ0b2tlbiA9IHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgaWYgKGNzcmZzZXJ2ZXJ0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikgeyByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC50b2tlbm5vdHZhbGlkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKX1cbiAgIFxuICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBzZXJ2ZXJzdGF0dXM6IG1jU2VydmVyLnNlcnZlcnN0YXR1c30pIFxufSlcblxuXG5cblxuLyoqXG4gKiBTZXQgU2VydmVyc3RhdHVzIFxuICogU3R1ZGVudHMgZmV0Y2ggdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgZXZlcnkgdXBkYXRlY3ljbGUgYW5kIGFjdCBvbiBpdCAoc3RhcnQgZXhhbSwgbG9ja3NjcmVlbnMsZXRjKVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlclxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiBzZXJ2ZXJ0b2tlbiB0byBhdXRoZW50aWNhdGUgYmVmb3JlIHRoZSByZXF1ZXN0IGlzIHByb2Nlc3NlZFxuICogQHBhcmFtIHJlcS5ib2R5LnNlcnZlcnN0YXR1cyBjb250YWlucyB0aGUgd2hvbGUgc2VydmVyc3RhdHVzIG9iamVjdFxuICovXG5yb3V0ZXIucG9zdCgnL3NldHNlcnZlcnN0YXR1cy86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY3NyZnNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBpZiAoY3NyZnNlcnZlcnRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7IHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnRva2Vubm90dmFsaWRcIiksIHN0YXR1czogXCJlcnJvclwifSApfVxuICAgIFxuICAgIG1jU2VydmVyLnNlcnZlcnN0YXR1cyA9IHJlcS5ib2R5LnNlcnZlcnN0YXR1c1xuICAgIG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLm1zT2ZmaWNlRmlsZSA9IGZhbHNlICAvLyB3ZSBjYW50IHN0b3JlIGEgZmlsZSBvYmplY3QgYXMganNvblxuXG4gICAgLy9jb25zb2xlLmxvZyhcImNvbnRyb2w6XCIsIG1jU2VydmVyLnNlcnZlcnN0YXR1cylcbiAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCBzZXRzZXJ2ZXJzdGF0dXM6IHNhdmluZyBzZXJ2ZXIgc3RhdHVzIHRvIGRpc2NcIilcbiAgICBcbiAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUpXG4gICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgJ3NlcnZlcnN0YXR1cy5qc29uJyk7XG5cbiAgICB0cnkgeyAgXG4gICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLCBudWxsLCAyKTtcbiAgICAgICAgLy8gVmFsaWRhdGUgSlNPTiBiZWZvcmUgd3JpdGluZyB0byBwcmV2ZW50IGludmFsaWQgSlNPTiBmaWxlc1xuICAgICAgICBKU09OLnBhcnNlKGpzb25TdHJpbmcpO1xuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsIGpzb25TdHJpbmcpOyAgXG4gICAgfSAgIC8vIG1jU2VydmVyLnNlcnZlcnN0YXR1cyBhbHMgSlNPTi1EYXRlaSBzcGVpY2hlcm5cbiAgICBjYXRjaCAoZXJyb3IpIHsgIFxuICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCBzZXRzZXJ2ZXJzdGF0dXM6ICR7ZXJyb3J9YCApO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJjb3VsZCBub3Qgc2F2ZSBzZXJ2ZXJzdGF0dXMgdG8gZGlzY1wiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZ2VuZXJhbC5va1wiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9KVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogU2V0IFNUVURFTlQuU1RBVFVTIGFuZCB0aGVyZWZvcmUgSW5mb3JtIENsaWVudCBvbiB0aGUgbmV4dCB1cGRhdGUgY3ljbGUgYWJvdXQgYSBkZW5pZWQgcHJpbnRyZXF1ZXN0ICh3ZSBoYW5kbGUgb25lIHJlcXVlc3QgYXQgYSB0aW1lKSBhbmQgb3RoZXIgdGhpbmdzLlxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIFxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgYmUgaW5mb3JtZWRcbiAqL1xucm91dGVyLnBvc3QoJy9zZXRzdHVkZW50c3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgXG4gICAgY29uc3QgcHJpbnRkZW5pZWQgPSByZXEuYm9keS5wcmludGRlbmllZFxuICAgIGNvbnN0IGRlbGZvbGRlciA9IHJlcS5ib2R5LmRlbGZvbGRlclxuICAgIGNvbnN0IGFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSByZXEuYm9keS5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrXG4gICAgY29uc3QgYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnMgPSByZXEuYm9keS5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuICAgIGNvbnN0IHJlbW92ZXByaW50cmVxdWVzdCA9IHJlcS5ib2R5LnJlbW92ZXByaW50cmVxdWVzdFxuICAgIGNvbnN0IGdyb3VwID0gcmVxLmJvZHkuZ3JvdXBcbiAgICBjb25zdCBraWNrZWQgPSByZXEuYm9keS5raWNrXG4gICAgY29uc3QgbXNvZmZpY2VzaGFyZSA9IHJlcS5ib2R5Lm1zb2ZmaWNlc2hhcmVcbiAgICBjb25zdCBnZXRtYXRlcmlhbHMgPSByZXEuYm9keS5nZXRtYXRlcmlhbHNcblxuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBcbiAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PT0gXCJhbGxcIil7XG4gICAgICAgICAgICBmb3IgKGxldCBzdHVkZW50IG9mIG1jU2VydmVyLnN0dWRlbnRMaXN0KXsgXG4gICAgICAgICAgICAgICAgaWYgKGRlbGZvbGRlcikgIHsgc3R1ZGVudC5zdGF0dXMuZGVsZm9sZGVyID0gdHJ1ZSAgIH0gLy8gb24gdGhlIG5leHQgdXBkYXRlIGN5Y2xlIHRoZSBzdHVkZW50IGdldHMgaW5mb3JtZWQgdG8gZGVsZXRlIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICBpZiAoZ3JvdXApIHtzdHVkZW50LnN0YXR1cy5ncm91cCA9IGdyb3VwOyB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtc29mZmljZXNoYXJlICE9PSAndW5kZWZpbmVkJykge3N0dWRlbnQuc3RhdHVzLm1zb2ZmaWNlc2hhcmUgPSBtc29mZmljZXNoYXJlOyB9ICAgLy8gd2UgbmVlZCB0byBzZXQgdGhpcyB0byBmYWxzZSBmb3IgZXZlcnkgc3R1ZGVudCB0byB0cmlnZ2VyIGEgbmV3IHVwbG9hZCBvZiB0aGUgbXNPZmZpY2VGaWxlIG9uIHNlY3Rpb24gY2hhbmdlXG4gICAgICAgICAgICAgICAgaWYgKGdldG1hdGVyaWFscykge3N0dWRlbnQuc3RhdHVzLmdldG1hdGVyaWFscyA9IHRydWU7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBcbiAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIGhhbmRsZSBkaWZmZXJlbnQgZm9ybXMgb2YgaW5mb3JtYXRpb24gdGhhdCBuZWVkcyB0byBiZSBzZXQgb24gc3R1ZGVudHN0YXR1cyAoZG9udCBmb3JnZXQgdG8gcmVzZXQgdGhvc2UgdmFsdWVzIGluIC91cGRhdGUvcm91dGUpXG4gICAgICAgICAgICAgICAgaWYgKHByaW50ZGVuaWVkKXsgXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLnByaW50ZGVuaWVkID0gdHJ1ZSAvLyBzZXQgc3R1ZGVudC5zdGF0dXMgc28gdGhhdCB0aGUgc3R1ZGVudCBjYW4gYWN0IG9uIGl0IG9uIHRoZSBuZXh0IHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnByaW50cmVxdWVzdCA9IGZhbHNlICAvLyB1bnNldCBwcmludHJlcXVlc3Qgc28gdGhhdCBkYXNoYm9hcmQgZmV0Y2hJbmZvICh3aGljaCBmZXRjaGVzIHRoZSBzdHVkZW50bGlzdCkgZG9lc250IHRyaWdnZXIgaXQgYWdhaW5cbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIpICB7IHN0dWRlbnQuc3RhdHVzLmRlbGZvbGRlciA9IHRydWUgICB9IC8vIG9uIHRoZSBuZXh0IHVwZGF0ZSBjeWNsZSB0aGUgc3R1ZGVudCBnZXRzIGluZm9ybWVkIHRvIGRlbGV0ZSB3b3JrZm9sZGVyXG4gICAgICAgICAgICAgICAgaWYgKGFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2spIHsgICAgLy8gYWxsb3cgc3BlbGxjaGVjayBmb3IgdGhpcyBzcGVjaWZpYyBzdHVkZW50IChzcGVjaWFsIGNhc2VzKVxuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID0gdHJ1ZTsgXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zID0gYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlU3VnZ2VzdGlvbnMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlbW92ZXByaW50cmVxdWVzdCA9PSB0cnVlKXsgc3R1ZGVudC5wcmludHJlcXVlc3QgPSBmYWxzZSB9ICAvLyB1bnNldCBwcmludHJlcXVlc3Qgc28gdGhhdCBkYXNoYm9hcmQgZmV0Y2hJbmZvICh3aGljaCBmZXRjaGVzIHRoZSBzdHVkZW50bGlzdCkgZG9lc250IHRyaWdnZXIgaXQgYWdhaW5cbiAgICAgICAgICAgICAgICBpZiAoZ3JvdXApIHtzdHVkZW50LnN0YXR1cy5ncm91cCA9IGdyb3VwOyB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtc29mZmljZXNoYXJlICE9PSAndW5kZWZpbmVkJykge3N0dWRlbnQuc3RhdHVzLm1zb2ZmaWNlc2hhcmUgPSBtc29mZmljZXNoYXJlOyB9XG4gICAgICAgICAgICAgICAgaWYgKGtpY2tlZCkgeyBzdHVkZW50LnN0YXR1cy5raWNrZWQgPSB0cnVlIH1cbiAgICAgICAgICAgICAgICBpZiAoZ2V0bWF0ZXJpYWxzKSB7c3R1ZGVudC5zdGF0dXMuZ2V0bWF0ZXJpYWxzID0gdHJ1ZTsgfVxuXG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImNvbnRyb2wgQCBzZXRzdHVkZW50c3RhdHVzOlwiLCByZXEuYm9keSlcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgIFxuICAgICAgICAgICAgaWYgKG5vdyAtIDIwMDAwID4gc3R1ZGVudC50aW1lc3RhbXAgJiYgc3R1ZGVudC5zdGF0dXMua2lja2VkKSAgICB7XG4gICAgICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICAgbWNTZXJ2ZXIuc3R1ZGVudExpc3QgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maWx0ZXIoIGVsID0+IGVsLnRva2VuICE9PSAgc3R1ZGVudHRva2VuKTsgfSAvLyByZW1vdmUgY2xpZW50IGZyb20gc3R1ZGVudGxpc3RcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zdHVkZW50dXBkYXRlXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSApXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWN0aW9uZGVuaWVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKVxuICAgIH1cbn0pXG5cblxuXG5cblxuLyoqXG4gKiBUSEUgRk9MTE9XSU5HIFJPVVRFUyBBUkUgQUNDRVNTRUQgQlkgU1RVREVOVFMgT05MWVxuICovXG5cblxuLyoqXG4gKiBVUERBVEVTIENsaWVudGluZm8gLSB0aGUgc3BlY2lmaWVkIHN0dWRlbnRzIHRpbWVzdGFtcCAodXNlZCBpbiBkYXNoYm9hcmQgdG8gbWFyayB1c2VyIGFzIG9ubGluZSkgYW5kIG90aGVyIHN0YXR1cyB1cGRhdGVzXG4gKiBGRVRDSEVTIFNlcnZlcnN0YXR1cyAmIFN0dWRlbnRzdGF0dXNcbiAqIHVzdWFsbHkgdHJpZ2dlcmVkIGJ5IHRoZSBjbGllbnRzIGRpcmVjdGx5IGZyb20gdGhlIE1haW4gUHJvY2VzcyAobG9vcClcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgYXQgd2hpY2ggdGhlIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZFxuICogQHBhcmFtIHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB0byBzZWFyY2ggYW5kIHVwZGF0ZSB0aGUgZW50cnkgaW4gdGhlIGxpc3RcbiAqL1xuIHJvdXRlci5wb3N0KCcvdXBkYXRlJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY2xpZW50aW5mbyA9IHJlcS5ib2R5LmNsaWVudGluZm9cbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgY29uc3QgZXhhbW1vZGUgPSBjbGllbnRpbmZvLmV4YW1tb2RlXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IGNsaWVudGluZm8uc2VydmVybmFtZVxuXG4gICAgLy9jaGVjayBpZiBzZXJ2ZXIgYW5kIHN0dWRlbnQgZXhpc3RcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICggIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGF2YWlsYWJsZVwiLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfSAgLy8gc2VydmVyIGlzIGdvbmUgLSBkaXNjb25uZWN0IHN0dWRlbnRcblxuICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICBpZiAoICFzdHVkZW50ICkge3JldHVybiByZXMuc2VuZCh7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcInJlbW92ZWRcIiwgc3RhdHVzOiBcImVycm9yXCIgfSkgfSAvLyBzdHVkZW50IGtpY2tlZCAtIGRpc2Nvbm5lY3Qgc3R1ZGVudFxuXG4gICAgLy91cGRhdGUgaW1wb3J0YW50IHN0dWRlbnQgYXR0cmlidXRlc1xuICAgIHN0dWRlbnQuZm9jdXMgPSBjbGllbnRpbmZvLmZvY3VzXG4gICAgc3R1ZGVudC52aXJ0dWFsaXplZCA9IGNsaWVudGluZm8udmlydHVhbGl6ZWRcbiAgICBzdHVkZW50LnRpbWVzdGFtcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICAgLy9sYXN0IHNlZW4gIC8gdGhpcyBpcyBsaWtlIGEgaGVhcnRiZWF0IC0gdXBkYXRlIGxhc3RzZWVuXG4gICAgc3R1ZGVudC5leGFtbW9kZSA9IGV4YW1tb2RlICBcbiAgICBzdHVkZW50LmZpbGVzID0gY2xpZW50aW5mby5udW1iZXJPZkZpbGVzXG4gICAgc3R1ZGVudC5yZW1vdGVhc3Npc3RhbnQgPSBjbGllbnRpbmZvLnJlbW90ZWFzc2lzdGFudFxuXG4gICAgaWYgKGNsaWVudGluZm8uZm9jdXMpIHsgc3R1ZGVudC5zdGF0dXMucmVzdG9yZWZvY3Vzc3RhdGUgPSBmYWxzZSB9ICAvLyByZW1vdmUgdGFzayBiZWNhdXNlIGl0cyBvYnZpb3VzbHkgZG9uZVxuICAgIGlmIChjbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA9PSAwKXsgc3R1ZGVudC5pbWFnZXVybCA9IFwicGVyc29uLWxpbmVzLWZpbGwuc3ZnXCIgIH1cblxuICAgIGxldCBzdHVkZW50c3RhdHVzID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShzdHVkZW50LnN0YXR1cykpICAvLyBjb3B5IGN1cnJlbnQgc3RhdHVzID4gc2VuZCBjb3B5IG9mIG9yaWdpbmFsIHRvIHN0dWRlbnRcbiAgIFxuICAgIC8vIHRlYWNoZXIgc2V0cyBzdHVkZW50c3RhdHVzLmtpY2sgdG8gdHJ1ZSAtIHRoZSBtb21lbnQgdGhlIHN0dWRlbnQgZmV0Y2hlcyBoaXMgc3RhdHVzIGFuZCBrbndvbiBoZSdzIGtpY2tlZCBoZSB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgc2VydmVyXG4gICAgaWYgKHN0dWRlbnQuc3RhdHVzLmtpY2tlZCkgICAge1xuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgIGlmIChzdHVkZW50KSB7ICAgbWNTZXJ2ZXIuc3R1ZGVudExpc3QgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maWx0ZXIoIGVsID0+IGVsLnRva2VuICE9PSAgc3R1ZGVudHRva2VuKTsgfSAvLyByZW1vdmUgY2xpZW50IGZyb20gc3R1ZGVudGxpc3RcbiAgICB9XG5cblxuICAgIC8vIHJlc2V0IHNvbWUgc3RhdHVzIHZhbHVlcyB0aGF0IGFyZSBvbmx5IHVzZWQgdG8gdHJhbnNwb3J0IHNvbWV0aGluZyBvbmNlXG4gICAgc3R1ZGVudC5zdGF0dXMucHJpbnRkZW5pZWQgPSBmYWxzZSBcbiAgICBzdHVkZW50LnN0YXR1cy5kZWxmb2xkZXIgPSBmYWxzZSBcbiAgICBzdHVkZW50LnN0YXR1cy5zZW5kZXhhbSA9IGZhbHNlIC8vIHJlcXVlc3Qgb25seSBvbmNlXG4gICAgc3R1ZGVudC5zdGF0dXMuZm9jdXMgPSB0cnVlXG4gICAgc3R1ZGVudC5zdGF0dXMuZ2V0bWF0ZXJpYWxzID0gZmFsc2VcbiAgICAvL3N0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSBmYWxzZSAgIC8vIGFjdGl2YXRlIG9ubHkgb25jZSAtIHdoZW4gc3R1ZGVudCByZXRyaWV2ZWQgXCJzdHVkZW50c3RhdHVzXCIgd2UgY2FuIHJlc2V0IHNvbWUgdmFsdWVzIG9mIFwic3R1ZGVudC5zdGF0dXNcIlxuXG4gICAgLy8gcmV0dXJuIGN1cnJlbnQgc2VydmVyaW5mb3JtYXRpb24gdG8gcHJvY2VzcyBvbiBjbGllbnRzaWRlIFxuICAgIC8vIENyZWF0ZSBvcHRpbWl6ZWQgc2hhbGxvdyBjb3B5IG9mIHNlcnZlcnN0YXR1cyB3aXRob3V0IGV4YW1JbnN0cnVjdGlvbkZpbGVzIHRvIHJlZHVjZSBwYXlsb2FkIHNpemVcbiAgICBjb25zdCBzZXJ2ZXJzdGF0dXNDb3B5ID0geyAuLi5tY1NlcnZlci5zZXJ2ZXJzdGF0dXMgfTtcbiAgICBzZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9ucyA9IHsgLi4ubWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9ucyB9O1xuICAgIFxuICAgIC8vIENsZWFyIGV4YW1JbnN0cnVjdGlvbkZpbGVzIGluIGFsbCA0IGV4YW1TZWN0aW9ucyBmb3IgYm90aCBncm91cEEgYW5kIGdyb3VwQiAod2UgZG9udCB3YW50IHRvIHNlbmQgdGhlIG1hdGVyaWFscyB0byB0aGUgc3R1ZGVudCBvbiBldmVyeSB1cGRhdGUpXG4gICAgZm9yIChsZXQgc2VjdGlvbktleSBvZiBbMSwgMiwgMywgNF0pIHtcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldKSB7XG4gICAgICAgICAgICBzZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XSA9IHtcbiAgICAgICAgICAgICAgICAuLi5zZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XSxcbiAgICAgICAgICAgICAgICBncm91cEE6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0uZ3JvdXBBLFxuICAgICAgICAgICAgICAgICAgICBleGFtSW5zdHJ1Y3Rpb25GaWxlczogW11cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdyb3VwQjoge1xuICAgICAgICAgICAgICAgICAgICAuLi5zZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XS5ncm91cEIsXG4gICAgICAgICAgICAgICAgICAgIGV4YW1JbnN0cnVjdGlvbkZpbGVzOiBbXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmVzLmNoYXJzZXQgPSAndXRmLTgnO1xuICAgIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wuc3R1ZGVudHVwZGF0ZVwiKSwgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZXJ2ZXJzdGF0dXM6c2VydmVyc3RhdHVzQ29weSwgc3R1ZGVudHN0YXR1czogc3R1ZGVudHN0YXR1cyB9KVxufSlcblxuXG4vKipcbiAqIFVQREFURSBTQ1JFRU5TSE9UXG4gKiBQT1NUIERhdGEgY29udGFpbnMgYSBzY3JlZW5zaG90IG9mIHRoZSBjbGllbnRzIGRlc2t0b3AgISFcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgYXQgd2hpY2ggdGhlIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZFxuICogQHBhcmFtIHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB0byBzZWFyY2ggYW5kIHVwZGF0ZSB0aGUgc2NyZWVuc2hvdFxuICovXG5yb3V0ZXIucG9zdCgnL3VwZGF0ZXNjcmVlbnNob3QnLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjbGllbnRpbmZvID0gcmVxLmJvZHkuY2xpZW50aW5mb1xuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG5cbiAgICAvLyBjaGVjayBpZiBzdHVkZW50QHNlcnZlciBleGlzdHNcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICggIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGF2YWlsYWJsZVwiLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICBpZiAoICFzdHVkZW50ICkge3JldHVybiByZXMuc2VuZCh7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcInJlbW92ZWQgZnJvbSBzZXJ2ZXJcIiwgc3RhdHVzOiBcImVycm9yXCIgfSkgfSAvL2NoZWNrIGlmIHRoZSBzdHVkZW50IGlzIHJlZ2lzdGVyZWQgb24gdGhpcyBzZXJ2ZXJcbiAgXG4gICAgaWYgKHJlcS5ib2R5LnNjcmVlbnNob3QgKSB7XG4gICAgICAgIGNvbnN0IHNjcmVlbnNob3RCYXNlNjQgPSByZXEuYm9keS5zY3JlZW5zaG90OyAgIC8vIERlciBCYXNlNjQtU3RyaW5nIG11c3MgbmljaHQga29udmVydGllcnQgd2VyZGVuLCBlciBrYW5uIGRpcmVrdCB2ZXJ3ZW5kZXQgd2VyZGVuXG4gICAgICAgIC8vbGV0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgIFxuICAgICAgICAgICAgc3R1ZGVudC5pbWFnZXVybCA9ICdkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCcgKyBzY3JlZW5zaG90QmFzZTY0OyAvLyBvZGVyICdkYXRhOmltYWdlL3BuZztiYXNlNjQsJyBqZSBuYWNoIHRhdHNcdTAwRTRjaGxpY2hlbSBCaWxkZm9ybWF0ICBcblxuICAgICAgICAgICAgLy8gb25seSBzY2FuIHNjcmVlbnNob3QgaW4gZXhhbSBtb2RlIGFuZCBOT1QgaWYgYSByZXN0b3JpbmcvdW5sb2NraW5nIG9wZXJhdGlvbiBpcyBhbHJlYWR5IGluIHByb2Nlc3MgKG90aGVyd2lzZSBpdCB3aWxsIGxvY2sgdGhlIHVubG9ja2VkIGFnYWluKVxuICAgICAgICAgICAgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jciAmJiAhc3R1ZGVudC5zdGF0dXMucmVzdG9yZWZvY3Vzc3RhdGUgJiYgc3R1ZGVudC5mb2N1cyl7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXIgPSByZXEuYm9keS5oZWFkZXIuc3BsaXQoJztiYXNlNjQsJykucG9wKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcmltYWdlQnVmZmVyID0gQnVmZmVyLmZyb20oaGVhZGVyLCAnYmFzZTY0Jyk7XG5cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgICAgICAgICAgICAgICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnKVxuICAgICAgICAgICAgICAgICAgICA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmICghVGVzc2VyYWN0V29ya2VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIFRlc3NlcmFjdFdvcmtlciA9IGF3YWl0IFRlc3NlcmFjdC5jcmVhdGVXb3JrZXIoJ2VuZycsMSx7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ1BhdGg6IHB1YmxpY1BhdGggLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhOiB7IHRleHQgfSB9ICA9IGF3YWl0IFRlc3NlcmFjdFdvcmtlci5yZWNvZ25pemUoaGVhZGVyaW1hZ2VCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGluY29kZVZpc2libGUgPSB0ZXh0LmluY2x1ZGVzKG1jU2VydmVyLnNlcnZlcmluZm8ucGluKVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGluY29kZVZpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5mb2N1cyA9IHBpbmNvZGVWaXNpYmxlICAvLyB0aGlzIGlzIHRoZSBsb2NhbCBzdHVkZW50IG9iamVjdCBmb3IgdGhlIGZyb250ZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5mb2N1cyA9IHBpbmNvZGVWaXNpYmxlICAvLyB0aGlzIHNldHMgdGhlIHN0dWRlbnRzdGF0dXMgb2JqZWN0IHdoaWNoIGlzIGZldGNoZWQgb24gZXZlcnkgdXBkYXRlIC0gdGhlIHN0dWRlbnRzIHJlYWN0IG9uIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3QgKG9jcik6IFN0dWRlbnQgU2NyZWVuc2hvdCBkb2VzIG5vdCBpbmNsdWRlIEV4YW0gUElOXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5pbmZvKGBjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdCAob2NyKTogJHtlcnJ9YCk7IH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFzdHVkZW50LmZvY3VzKSB7IC8vIEFyY2hpdmllcmUgU2NyZWVuc2hvdCwgd2VubiBTdHVkZW50IG5pY2h0IGZva3Vzc2llcnQgaXN0XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogU3R1ZGVudCBvdXQgb2YgZm9jdXMgLSBzZWN1cmluZyBzY3JlZW5zaG90c1wiKTtcbiAgICAgICAgICAgICAgICBsZXQgdGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zdWJzdHIoMTEsIDgpLnJlcGxhY2UoLzovZywgXCJfXCIpO1xuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsIFwiZm9jdXNsb3N0XCIpO1xuICAgICAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVuYW1lID0gcGF0aC5qb2luKGZpbGVwYXRoLCBgJHt0aW1lfS0ke3JlcS5ib2R5LnNjcmVlbnNob3RmaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKGZpbGVwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RCdWZmZXIgPSBCdWZmZXIuZnJvbShyZXEuYm9keS5zY3JlZW5zaG90LCAnYmFzZTY0Jyk7ICAgIC8vIEtvbnZlcnRpZXJlbiBkZXMgQmFzZTY0LVN0cmluZ3MgaW4gZWluZW4gQnVmZmVyIHVuZCBTcGVpY2hlcm4gZGVyIERhdGVpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVuYW1lLCBzY3JlZW5zaG90QnVmZmVyKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogJHtlcnJ9YCApOyB9XG4gICAgICAgICAgICB9XG4gICAgICBcbiAgICB9IGVsc2Uge1xuICAgICAgICAvL2xvZy53YXJuKCdjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogU2NyZWVuc2hvdCBvciBoYXNoIG5vdCBwcm92aWRlZCcpO1xuICAgICAgICBzdHVkZW50LmltYWdldXJsID0gXCJwZXJzb24tbGluZXMtZmlsbC5zdmdcIlxuICAgIH1cbiAgICByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czpcInN1Y2Nlc3NcIiB9KVxufSlcblxuXG4vKipcbiAqIFJlY2VpdmUgQUJHQUJFICYgUFJJTlRSRVFVRVNUIEZyb20gU3R1ZGVudFxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBlbnRyeSBpbiB0aGUgbGlzdFxuICovXG5yb3V0ZXIucG9zdCgnL3ByaW50cmVxdWVzdC86c2VydmVybmFtZS86c3R1ZGVudHRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgcGRmRG9jdW1lbnQgPSByZXEuYm9keS5kb2N1bWVudFxuICAgIGNvbnN0IHByaW50cmVxdWVzdCA9IHJlcS5ib2R5LnByaW50cmVxdWVzdFxuICAgIGNvbnN0IHN1Ym1pc3Npb25udW1iZXIgPSByZXEuYm9keS5zdWJtaXNzaW9ubnVtYmVyXG4gICAgY29uc3QgbG9ja2Vkc2VjdGlvbiA9IHJlcS5ib2R5LmxvY2tlZHNlY3Rpb24gfHwgMSAvLyBkZWZhdWx0IHRvIHNlY3Rpb24gMSBpZiBub3QgcHJvdmlkZWRcblxuXG4gICAgLy9jaGVjayBpZiBzZXJ2ZXIgZXhpc3RzIFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9XG5cbiAgICAvL2NoZWNrIGlmIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXJcbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgaWYgKCAhc3R1ZGVudCApIHtyZXR1cm4gcmVzLnNlbmQoeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJyZW1vdmVkXCIsIHN0YXR1czogXCJlcnJvclwiIH0pIH1cbiAgICBcbiAgICBpZiAocHJpbnRyZXF1ZXN0KXsgICBcbiAgICAgICAgc3R1ZGVudC5wcmludHJlcXVlc3QgPSBwZGZEb2N1bWVudCAgLy8gd2UgcHV0IHRoZSBiYXNlNjQgc3RyaW5nIG9mIHRoZSBkb2N1bWVudCBvbiBwcmludHJlcXVlc3Qgd2hpY2ggaXMgY2hlY2tlZCBieSB0aGUgZnJvbnRlbmQgb24gZXZlcnkgZmV0Y2ggY3ljbGVcbiAgICB9XG5cbiAgICAvLyB0cmFjayBzdHVkZW50IHN1Ym1pc3Npb25zIG9uIHRoZSBzZXJ2ZXIgYmVjYXVzZSBvZiBwb3NzaWJsZSByZWNvbm5lY3RzIGFuZCByZXNldHMgb24gdGhlIHN0dWRlbnQgc2lkZVxuICAgIC8vIGlmIChzdHVkZW50LnN1Ym1pc3Npb25udW1iZXIgPT09IHVuZGVmaW5lZCl7XG4gICAgLy8gICAgIHN0dWRlbnQuc3VibWlzc2lvbm51bWJlciA9IDEgICAgLy8gZmlyc3Qgc3VibWlzc2lvblxuICAgIC8vIH1cbiAgICAvLyBlbHNlIHtcbiAgICAvLyAgICAgc3R1ZGVudC5zdWJtaXNzaW9ubnVtYmVyICs9IDFcbiAgICAvLyB9XG5cbiAgICBsZXQgc2FmZVN0dWRlbnQgPSBzdHVkZW50LmNsaWVudG5hbWUucmVwbGFjZSgvXFxzKy9nLCAnXycpICAvLyByZXBsYWNlIHNwYWNlcyB3aXRoIFwiX1wiXG4gICAgbGV0IG5vdyA9IG5ldyBEYXRlKClcbiAgXG4gICAgbGV0IHRpbWVzdGFtcCA9IGAke25vdy5nZXRGdWxsWWVhcigpfSR7U3RyaW5nKG5vdy5nZXRNb250aCgpKzEpLnBhZFN0YXJ0KDIsJzAnKX0ke1N0cmluZyhub3cuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCcwJyl9LSR7U3RyaW5nKG5vdy5nZXRIb3VycygpKS5wYWRTdGFydCgyLCcwJyl9JHtTdHJpbmcobm93LmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwnMCcpfSR7U3RyaW5nKG5vdy5nZXRTZWNvbmRzKCkpLnBhZFN0YXJ0KDIsJzAnKX1gXG4gICAgbGV0IGZpbGVuYW1lID0gYCR7c2VydmVybmFtZX0tJHtzYWZlU3R1ZGVudH0tJHtzdWJtaXNzaW9ubnVtYmVyfS0ke3RpbWVzdGFtcH0ucGRmYFxuXG5cbiAgIFxuICAgIGNvbnN0IHBkZkJ1ZmZlciA9IEJ1ZmZlci5mcm9tKHBkZkRvY3VtZW50LCAnYmFzZTY0Jyk7XG5cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbGVwYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgJ0FCR0FCRScsIGxvY2tlZHNlY3Rpb24udG9TdHJpbmcoKSApIC8vIHRhcmdldCBkaXJcbiAgICAgICAgYXdhaXQgZnNwLm1rZGlyKGZpbGVwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgZGlyXG4gICAgICAgIGNvbnN0IGFic29sdXRlRmlsZW5hbWUgPSBwYXRoLmpvaW4oZmlsZXBhdGgsIGZpbGVuYW1lKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1aWxkIHBhdGhcbiAgICAgICAgYXdhaXQgZnNwLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVuYW1lLCBwZGZCdWZmZXIpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgbWFpblxuICAgICAgXG4gICAgICAgIGxvZy5pbmZvKGBjb250cm9sIEAgcHJpbnRyZXF1ZXN0OiBSZWNlaXZlZCBhbmQgc3RvcmVkIHN1Ym1pc3Npb24gZmlsZSBmb3IgdXNlcjogJHtzdHVkZW50LmNsaWVudG5hbWV9YClcbiAgICAgICAgLy8gY3JlYXRlIGJhY2t1cCBvZiBhYmdhYmVcbiAgICAgICAgbGV0IGJhY2t1cFN0YXR1cyA9ICdza2lwcGVkJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBiYWNrdXAgc3RhdHVzXG4gICAgICAgIGlmIChjb25maWcuYmFja3VwZGlyZWN0b3J5KSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9wdGlvbmFsIGJhY2t1cFxuICAgICAgICAgIGNvbnN0IGJhY2t1cHBhdGggPSBwYXRoLmpvaW4oY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsICdBQkdBQkUnLCBsb2NrZWRzZWN0aW9uLnRvU3RyaW5nKCkgKVxuICAgICAgICAgIGF3YWl0IGZzcC5ta2RpcihiYWNrdXBwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgYmFja3VwIGRpclxuICAgICAgICAgIGNvbnN0IGFic29sdXRlQmFja3VwRmlsZW5hbWUgPSBwYXRoLmpvaW4oYmFja3VwcGF0aCwgZmlsZW5hbWUpICAgICAgICAgICAgICAgICAgICAgICAvLyBiYWNrdXAgcGF0aFxuICAgICAgICAgIGF3YWl0IGZzcC53cml0ZUZpbGUoYWJzb2x1dGVCYWNrdXBGaWxlbmFtZSwgcGRmQnVmZmVyKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSBiYWNrdXBcbiAgICAgICAgICBiYWNrdXBTdGF0dXMgPSAnb2snICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYmFja3VwIG9rXG4gICAgICAgIH1cbiAgICAgIFxuICAgICAgICByZXMuc2VuZCh7IHNlbmRlcjogJ3NlcnZlcicsIG1lc3NhZ2U6ICdzdWNjZXNzJywgc3RhdHVzOiAnc3VjY2VzcycsIGJhY2t1cDogYmFja3VwU3RhdHVzIH0pIC8vIHJlc3BvbmQgc3VjY2Vzc1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHByaW50cmVxdWVzdDogJHtlcnJ9YCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvZyBlcnJvclxuICAgICAgICBsZXQgbWVzc2FnZSA9IHQoXCJjb250cm9sLnN1Ym1pc3Npb25mYWlsZWRcIilcbiAgICAgICAgcmVzLnN0YXR1cyg1MDApLnNlbmQoeyBzZW5kZXI6ICdzZXJ2ZXInLCBtZXNzYWdlOiBtZXNzYWdlLCBzdGF0dXM6ICdlcnJvcicgfSkgICAvLyByZXNwb25kIGVycm9yXG4gICAgICB9XG4gICAgXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgcm91dGVyXG5cblxuXG4vL2RvIG5vdCBhbGxvdyByZXF1ZXN0cyBmcm9tIGV4dGVybmFsIGhvc3RzXG5mdW5jdGlvbiByZXF1ZXN0U291cmNlQWxsb3dlZChyZXEscmVzKXtcbiAgICBpZiAocmVxLmlwID09IFwiOjoxXCIgIHx8IHJlcS5pcCA9PSBcIjEyNy4wLjAuMVwiIHx8IHJlcS5pcC5pbmNsdWRlcygnMTI3LjAuMC4xJykgKXsgXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gIFxuICAgIGxvZy5lcnJvcihgQmxvY2tlZCByZXF1ZXN0IGZyb20gcmVtb3RlIEhvc3Q6ICR7cmVxLmlwfWApOyBcbiAgICByZXMuanNvbignUmVxdWVzdCBkZW5pZWQnKSBcbiAgICByZXR1cm4gZmFsc2UgXG59XG4vL3RoaXMgaXMgbmVlZGVkIGJ5IHRoZSAvb2F1dGggYW5kIC9tc2F1dGggcm91dGVzIFxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlVmVyaWZpZXIoKSB7XG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21CeXRlcygzMikudG9TdHJpbmcoJ2hleCcpO1xufVxuZnVuY3Rpb24gc2hhMjU2KGJ1ZmZlcikge1xuICAgIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGJ1ZmZlcikuZGlnZXN0KCk7XG59XG5mdW5jdGlvbiBiYXNlNjRVcmxFbmNvZGUoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci50b1N0cmluZygnYmFzZTY0JylcbiAgICAucmVwbGFjZSgnKycsICctJylcbiAgICAucmVwbGFjZSgnLycsICdfJylcbiAgICAucmVwbGFjZSgvPSskLywgJycpO1xufVxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVTb2NrZXQgfSBmcm9tICdkZ3JhbSdcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJ1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cblxuLyoqXG4gKiBTdGFydHMgYSBkZ3JhbSAodWRwKSBzb2NrZXQgdGhhdCBicm9hZGNhc3RzIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgc2VydmVyXG4gKiBvbmUgbXVsdGljYXN0U2VydmVyIGluc3RhbmNlIGZvciBldmVyeSBleGFtIChob2xkcyBhbGwgc3R1ZGVudCBpbmZvcm1hdGlvbiBhbmQgc2VydmVyc3RhdHVzKVxuICovXG5jbGFzcyBNdWx0aWNhc3RTZXJ2ZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5TUkNfUE9SVCA9IDAgIC8vIGluIG9yZGVyIHRvIGFsbG93IHNldmVyYWwgbXVsdGljYXN0IHNlcnZlcnMgKG1vcmUgZXhhbXMgb24gdGhlIHNhbWUgbWFjaGluZSkgdGhpcyBwb3J0IG5lZWRzIHRvIGJlIHNldCBkeW5hbWljYWxseVxuICAgICAgICB0aGlzLkNsaWVudFBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5zZXJ2ZXIgPSBudWxsXG4gICAgICAgIHRoaXMuc2VydmVyaW5mbyA9IG51bGxcbiAgICAgICAgdGhpcy5icm9hZGNhc3RJbnRlcnZhbCA9IG51bGxcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICAgICAgdGhpcy5zdHVkZW50TGlzdCA9IFtdXG4gICAgICAgIHRoaXMuc2VydmVyc3RhdHVzID0ge31cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzZXRzIHVwIGFuIGludGVydmFsbCB0byBzZW5kIHNlcnZlcmluZm8gZXZlcnkgMiBzZWNvbmRzXG4gICAgICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGdpdmVuIG5hbWUgb2YgdGhlIHNlcnZlciAoZm9yIGV4YW1wbGUgXCJtYXRoXCIpXG4gICAgICogQHBhcmFtIHBpbiB0aGUgcGluIG5lZWRlZCB0byByZWdpc3RlciBhcyBzdHVkZW50XG4gICAgICovXG4gICAgaW5pdCAoc2VydmVybmFtZSwgcGluLCBwYXNzd29yZCwgYmlwPWZhbHNlLCBiaXBJZD1udWxsKSB7XG4gICAgICAgIHRoaXMuc2VydmVyID0gY3JlYXRlU29ja2V0KCd1ZHA0JylcbiAgICAgICAgdGhpcy5zZXJ2ZXJpbmZvID0ge1xuICAgICAgICAgICAgc2VydmVybmFtZTogc2VydmVybmFtZSwgICAvL3Nob3VsZCBiZSB1bmlxdWUgaWYgc2V2ZXJhbCBzZXJ2ZXJzIGFyZSBhbGxvd2VkXG4gICAgICAgICAgICBwaW46IHBpbixcbiAgICAgICAgICAgIHBhc3N3b3JkOiBwYXNzd29yZCxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogMCxcbiAgICAgICAgICAgIGlkOiBiaXBJZCA/IGJpcElkIDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgICAgIGlwOiBjb25maWcuaG9zdGlwLFxuICAgICAgICAgICAgc2VydmVydG9rZW46IGBzZXJ2ZXItJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWAsXG4gICAgICAgICAgICBiaXA6IGJpcCxcbiAgICAgICAgICAgIHZlcnNpb246IGNvbmZpZy52ZXJzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuc2VydmVyLmJpbmQodGhpcy5TUkNfUE9SVCwnMC4wLjAuMCcsICAoKSA9PiB7IC8vIEFkZCB0aGUgSE9TVF9JUF9BRERSRVNTIGZvciByZWxpYWJpbGl0eVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICB0aGlzLnNlcnZlci5zZXRNdWx0aWNhc3RUVEwoMTI4KVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuc2V0VFRMKDEyOClcbiAgICAgICAgICAgIHRoaXMuc2VydmVyLmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUik7IFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgICAgICB0aGlzLmJyb2FkY2FzdEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5zZW5kTXVsdGljYXN0TWVzc2FnZS5iaW5kKHRoaXMpLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5icm9hZGNhc3RJbnRlcnZhbC5zdGFydCgpXG5cblxuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdHNlcnZlciBAIGluaXQ6IFVEUCBNQyBTZXJ2ZXIgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5zZXJ2ZXIuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgfSlcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZXMgdGhlIHNlcnZlciB0aW1lc3RhbXAgYW5kIGFjdHVhbGx5IGJyb2FkY2FzdHMgdGhlIG1lc3NhZ2UgKHNlcnZlcmluZm8pXG4gICAgICovXG4gICAgc2VuZE11bHRpY2FzdE1lc3NhZ2UgKCkge1xuICAgICAgICB0aGlzLnNlcnZlcmluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgbGV0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiB0aGlzLnNlcnZlcmluZm8uc2VydmVybmFtZSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogdGhpcy5zZXJ2ZXJpbmZvLnRpbWVzdGFtcCxcbiAgICAgICAgICAgIGlkOiB0aGlzLnNlcnZlcmluZm8uaWQsXG4gICAgICAgICAgICBpcDogdGhpcy5zZXJ2ZXJpbmZvLmlwLFxuICAgICAgICAgICAgYmlwOiB0aGlzLnNlcnZlcmluZm8uYmlwLFxuICAgICAgICAgICAgdmVyc2lvbjogY29uZmlnLnZlcnNpb25cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcmVwYXJlZE1lc3NhZ2UgPSBuZXcgQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpXG4gICAgICAgIHRoaXMuc2VydmVyLnNlbmQocHJlcGFyZWRNZXNzYWdlLCAwLCBwcmVwYXJlZE1lc3NhZ2UubGVuZ3RoLCB0aGlzLkNsaWVudFBPUlQsIHRoaXMuTVVMVElDQVNUX0FERFIpICAvL2Jyb2FkY2FzdCB0byBjbGllbnRzXG4gICAgICAgIHRoaXMuc2VydmVyLnNlbmQocHJlcGFyZWRNZXNzYWdlLCAwLCBwcmVwYXJlZE1lc3NhZ2UubGVuZ3RoLCBjb25maWcubXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydCwgdGhpcy5NVUxUSUNBU1RfQUREUikgICAgICAgIC8vYnJvYWRjYXN0IHRvIG90aGVyIHNlcnZlcihjbGllbnRzKSAtIHNlcnZlcnMgYWxzbyB3YW50IHRvIGtub3cgd2hhdCBvdGhlciBzZXJ2ZXJzIGFyZSBpbiB0aGUgbmV0d29ya1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVsdGljYXN0U2VydmVyXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBkZ3JhbSBmcm9tICdkZ3JhbSc7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7ICAvLyBub2RlIG5vdCB2dWUgKHJlbGF0aXZlIHBhdGggbmVlZGVkKVxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cblxuLyoqXG4gKiBTdGFydHMgYSBkZ3JhbSAodWRwKSBzb2NrZXQgdGhhdCBsaXN0ZW5zIGZvciBtdWxpdGNhc3QgbWVzc2FnZXNcbiAqL1xuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSAnMjM5LjI1NS4yNTUuMjUwJ1xuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zSW50ZXJ2YWxsID0gbnVsbFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBieSB0aW1lc3RhbXBcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JylcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmJpbmQodGhpcy5QT1JULCAnMC4wLjAuMCcsICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHsgdGhpcy5jbGllbnQuYWRkTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSKSB9XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm11bHRpY2FzdGNsaWVudCBAIGluaXQ6IE5vIEdhdGV3YXkhIFN0YXJ0aW5nIE11bHRpY2FzdENsaWVudCB3aXRob3V0IGFkZGluZyBncm91cCBtZW1iZXJzaGlwXCIpfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBVRFAgTUMgQ2xpZW50IGxpc3RlbmluZyBvbiBodHRwOi8vJHtjb25maWcuaG9zdGlwfToke3RoaXMuY2xpZW50LmFkZHJlc3MoKS5wb3J0fWApXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe2xvZy5lcnJvcihlcnIpfVxuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlJywgKG1lc3NhZ2UsIHJpbmZvKSA9PiB7IHRoaXMubWVzc2FnZVJlY2VpdmVkKG1lc3NhZ2UsIHJpbmZvKSB9KVxuXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG5cblxuICAgIH1cblxuICAgIGFzeW5jIHN0b3AgKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuZHJvcE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUikgLy8gZW50ZmVybnQgTXVsdGljYXN0LU1pdGdsaWVkc2NoYWZ0XG4gICAgICAgIH0gY2F0Y2goZSl7fVxuICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpIC8vIHNjaGxpZVx1MDBERnQgZGVuIFVEUC1Tb2NrZXRcbiAgICAgICAgaWYgKHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyKSB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdG9wKCkgLy8gc3RvcHB0IGRlbiBTY2hlZHVsZXJcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICBcbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICBtZXNzYWdlUmVjZWl2ZWQgKG1lc3NhZ2UsIHJpbmZvKSB7XG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnRpbWVzdGFtcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICAgLy9yZWNvcmQgdGltZXN0YW1wIG9mIGxhc3QgbWVzc2FnZSBmcm9tIHNlcnZlclxuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMuaXNOZXdFeGFtSW5zdGFuY2Uoc2VydmVySW5mbykpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBtZXNzYWdlUmVjZWl2ZWQ6IEFkZGluZyBuZXcgRXhhbSBJbnN0YW5jZSBcIiR7c2VydmVySW5mby5zZXJ2ZXJuYW1lfVwiIHRvIFNlcnZlcmxpc3RgKVxuICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5wdXNoKHNlcnZlckluZm8pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3MgaWYgdGhlIG1lc3NhZ2UgY2FtZSBmcm9tIGEgbmV3IGV4YW0gaW5zdGFuY2Ugb3IgYW4gb2xkIG9uZSB0aGF0IGlzIGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAqL1xuICAgIGlzTmV3RXhhbUluc3RhbmNlIChvYmopIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtU2VydmVyTGlzdFtpXS5pZCA9PT0gb2JqLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiXG5pbXBvcnQgeyBjcmVhdGVJMThuIH0gZnJvbSAndnVlLWkxOG4nXG4vL2ltcG9ydCB7IGNyZWF0ZUkxOG4gfSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbGVnYWN5OiBmYWxzZSxcbiAgICBtZXNzYWdlczoge1xuICAgICAgZW4sXG4gICAgICBkZVxuICAgICAgfVxuICB9KVxuXG5leHBvcnQgZGVmYXVsdCBpMThuXG5cblxuXG5cbiIsICJ7IFxuICAgIFwiZ2VuZXJhbFwiOiB7XG4gICAgICAgIFwic3RhcnRzZXJ2ZXJcIjpcIlN0YXJ0IEV4YW1cIixcbiAgICAgICAgXCJzbGlzdFwiOiBcIkFrdGl2ZSBFeGFtc1wiLFxuICAgICAgICBcIm9rXCI6IFwiT0tcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCJcbiAgICB9LFxuICAgIFwic2VydmVybGlzdFwiIDoge1xuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJsb2dpblwiOiBcImxvZ2luXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIlBsZWFzZSBwcm92aWRlIGEgcGFzc3dvcmRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJzdGFydHNlcnZlclwiIDoge1xuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcInN0YXJ0XCI6IFwiU3RhcnQgRXhhbVwiLFxuICAgICAgICBcInJlc3VtZVwiOiBcIlJlc3VtZSBFeGFtXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicHdkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJlbXB0eXB3XCI6IFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBwYXNzd29yZFwiLFxuICAgICAgICBcImVtcHR5bmFtZVwiOiBcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgdXNlcm5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIldvcmtkaXJlY3RvcnlcIixcbiAgICAgICAgXCJzZWxlY3RcIjogXCJTZWxlY3QgV29ya2RpcmVjdG9yeVwiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiTm90IGVub3VnaCBmcmVlIGRpc2NzcGFjZVwiLFxuICAgICAgICBcImRpcmVjdG9yeWVycm9yXCI6IFwiRGlyZWN0b3J5IG5vdCB3cml0ZWFibGVcIixcbiAgICAgICAgXCJwcmV2aW91c2V4YW1zXCI6IFwiTG9jYWwgcHJldmlvdXMgRXhhbXNcIixcbiAgICAgICAgXCJmb2xkZXJkZWxldGVcIjogXCJEZWxldGUgbG9jYWwgZXhhbSBmb2xkZXI/XCIsXG4gICAgICAgIFwib25saW5lZXhhbXNcIjogXCJCaVAgRXhhbXNcIixcbiAgICAgICAgXCJiaXBub3Rsb2dnZWRpblwiOiBcIlBsZWFzZSBsb2cgaW4gdG8gQmlQIGJlZm9yZSBzdGFydGluZyB0aGUgZXhhbVwiLFxuICAgICAgICBcIm5vTmV3c1wiOlwiTm8gTmV3cyBhdmFpbGFibGVcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJcIjogXCJCYWNrdXAtRGlyZWN0b3J5XCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyaW5mb1wiOiBcIlBsZWFzZSBwcm92aWRlIGEgcGF0aCBmb3IgdGhlIGJhY2t1cCBkaXJlY3RvcnlcIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXh0ZW5kZWQgU2V0dGluZ3NcIixcbiAgICAgICAgXCJpbmNvbXBhdGlibGVcIjogXCJJbmNvbXBhdGlibGUgd2l0aCBjdXJyZW50IHZlcnNpb25cIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VcIjogXCJTZWxlY3QgTmV0d29yayBJbnRlcmZhY2VcIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VpbmZvXCI6IFwiUGxlYXNlIHNlbGVjdCBhIHByZWZlcnJlZCBuZXR3b3JrIGludGVyZmFjZSFcIlxuICAgIH0sXG4gICAgXCJkYXNoYm9hcmRcIjp7XG4gICAgICAgIFwicmVtb3ZlVVJMXCI6IFwiUmVtb3ZlIFVSTFwiLFxuICAgICAgICBcInJlbW92ZVVSTGNvbmZpcm1cIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcmVtb3ZlIHRoaXMgVVJMP1wiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudFwiOiBcIlJlbW90ZSBBc3Npc3RhbnRcIixcbiAgICAgICAgXCJzZXJ2ZXJcIjogXCJTZXJ2ZXJcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpblwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcInN0b3BzZXJ2ZXJcIjogXCJTdG9wIEV4YW1cIixcbiAgICAgICAgXCJmaWxlc2VuZFwiOiBcIlNlbmQgRmlsZXNcIixcbiAgICAgICAgXCJmaWxlc2VuZHRleHRcIjogXCJQbGVhc2UgY2hvb3NlIG9uZSBvciBzZXZlcmFsIEZpbGVzXCIsXG4gICAgICAgIFwib2ZmaWNlZmlsZXNlbmRcIjogXCJVcGxvYWQgRmlsZVwiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kdGV4dFwiOiBcIlBsZWFzZSBjaG9vc2UgYW4geGxzeCBvciBkb2N4IEZpbGUgZm9yIHRoZSBFeGFtXCIsXG4gICAgICAgIFwiY2FuY2VsXCI6IFwiQ2FuY2VsXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIk5vIEZpbGVzIHNlbGVjdGVkXCIsXG4gICAgICAgIFwidXBsb2FkZmlsZXNcIjogXCJ1cGxvYWRpbmcgZmlsZXNcIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJGaWxlcyBzZW50XCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwiTm8gc3R1ZGVudHMgY29ubmVjdGVkXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJBY3RpdmUgU2hlZXRzXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzaGludFwiOiBcIlBsZWFzZSBzZWxlY3QgYSBQREYgZmlsZSB0aGF0IGNvbnRhaW5zIGludGVyYWN0aXZlIGZvcm0gZmllbGRzLlwiLFxuICAgICAgICBcImFjY2VwdFBkZlwiOiBcIkFjY2VwdCBQREYgRmlsZVwiLFxuICAgICAgICBcInNlbGVjdE90aGVyUGRmXCI6IFwiU2VsZWN0IG90aGVyIFBERiBmaWxlXCIsXG4gICAgICAgIFwibm9wZGZzZWxlY3RlZFwiOiBcIlBsZWFzZSBzZWxlY3QgYSBQREYgZmlsZSFcIixcbiAgICAgICAgXCJpbnZhbGlkcGRmXCI6IFwiSW52YWxpZCBQREYgZmlsZSFcIixcbiAgICAgICAgXCJwZGZwcm9jZXNzaW5nZXJyb3JcIjogXCJFcnJvciBwcm9jZXNzaW5nIFBERiBmaWxlLlwiLFxuICAgICAgICBcImVkdXZpZHVhbFwiOiBcIkVkdXZpZHVhbFwiLFxuICAgICAgICBcIndlYnNpdGVcIjogXCJXZWJzaXRlIFVSTFwiLFxuICAgICAgICBcImF1dG9nZXRcIjogXCJCYWNrdXAgaW50ZXJ2YWxcIixcbiAgICAgICAgXCJzdGFydGV4YW1cIjogXCJTZWN1cmUgZGV2aWNlc1wiLFxuICAgICAgICBcInN0YXJ0ZXhhbXNpbmdsZVwiOiBcIlNlY3VyZSBkZXZpY2VcIixcbiAgICAgICAgXCJzdGFydGV4YW1kZXNjXCI6IFwiVGhpcyBzdGFydHMgdGhlIEV4YW0gTW9kZSBmb3IgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwic2VuZGZpbGVcIjogXCJTZW5kIEZpbGVzIHRvIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcInNlbmRmaWxlU2luZ2xlXCI6IFwiU2VuZCBGaWxlc1wiLFxuICAgICAgICBcImdldGZpbGVcIjogXCJGZXRjaCBXb3JrIG9mIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcImdldGZpbGVTaW5nbGVcIjogXCJGZXRjaCBXb3JrXCIsXG4gICAgICAgIFwiZ2V0ZmlsZXNcIjogXCJGZXRjaCBXb3JrXCIsXG4gICAgICAgIFwic3RvcGV4YW1cIjogXCJSZWxlYXNlIGRldmljZXNcIixcbiAgICAgICAgXCJzdG9wZXhhbXNpbmdsZVwiOiBcIlJlbGVhc2UgZGV2aWNlXCIsXG4gICAgICAgIFwic3VyZVwiOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgXCJleGl0ZXhhbXN1cmVcIjogXCJDbG9zZSBFeGFtIFNlcnZlcj9cIixcbiAgICAgICAgXCJleGl0ZXhhbVwiOiBcIlRoaXMga2lsbHMgdGhlIGNvbm5lY3Rpb24gdG8gYWxsIHN0dWRlbnRzIFxcbkRpZCB5b3UgYmFja3VwIGV2ZXJ5dGhpbmc/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1pbmZvXCI6IFwiYWxsIGFjdGl2ZSBjb25uZWN0aW9ucyB3aWxsIGJlIGNsb3NlZFwiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcImV4aXQgc2FmZSBleGFtIG1vZGUuIHRoaXMgY2xvc2VzIHRoZSBleGFtIHdpbmRvdyBmb3IgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwiZXhpdGtpb3Nrc2hvcnRcIjogXCJFeGl0IEV4YW0gU2VydmVyXCIsXG4gICAgICAgIFwicmVhbGx5a2lja1wiOiBcInJlbW92ZSBzdHVkZW50IGZyb20gc2VydmVyXCIsXG4gICAgICAgIFwia2lja1wiOiBcInJlbW92ZVwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcInNhZmVtb2RlIGxlZnRcIixcbiAgICAgICAgXCJvbmxpbmVcIjpcImRldGFpbHNcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6XCJvZmZsaW5lXCIsXG4gICAgICAgIFwic2VjdXJlXCI6XCJzZWN1cmVkXCIsXG4gICAgICAgIFwic2VjdXJlaW5mb1wiOlwic3R1ZGVudCBpcyBzZWN1cmVkXCIsXG4gICAgICAgIFwicmVzdG9yZVwiOlwicmVzdG9yZVwiLFxuICAgICAgICBcInJlc3VtZWluZm9cIjpcInJlc3VtZSBmb2N1cyBzdGF0ZVwiLFxuICAgICAgICBcImV4YW1tb2RlYWN0aXZlXCI6IFwic3R1ZGVudCBhbHJlYWR5IGluIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiY2xvc2VcIjpcImNsb3NlXCIsXG4gICAgICAgIFwiZGVsXCI6IFwiY2xlYW4gd29ya2ZvbGRlclwiLFxuICAgICAgICBcImRlbHN1cmVcIjogXCJEZWxldGUgYWxsIGNvbnRlbnRzIG9mIHRoZSBzdHVkZW50cyB3b3JrZm9sZGVyc1wiLFxuICAgICAgICBcImRlbHNpbmdsZVwiOiBcImNsZWFuIHJlbW90ZSB3b3JrZm9sZGVyXCIsXG4gICAgICAgIFwiZGVsc2luZ2xlc3VyZVwiOiBcIkRlbGV0ZSBjb250ZW50cyBvZiB0aGUgc3R1ZGVudHMgd29ya2ZvbGRlclwiLFxuICAgICAgICBcImF0dGVudGlvblwiOiBcIkF0dGVudGlvbiFcIixcbiAgICAgICAgXCJiYWNrdXByZXF1ZXN0XCI6IFwiUmVxdWVzdGluZyBmaWxlcyBmcm9tIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcInNob3d3b3JrZm9sZGVyXCI6IFwiU2hvdyBXb3JrZm9sZGVyXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIlNob3cgV29ya2ZvbGRlclwiLFxuICAgICAgICBcInNob3duZXdlc3Rmb2xkZXJcIjogXCJTaG93IG5ld2VzdCBXb3JrZm9sZGVyXCIsXG4gICAgICAgIFwiZmlsZXNmb2xkZXJcIjogXCJXb3JrZm9sZGVyIGZpbGVzXCIsXG4gICAgICAgIFwiY2hvb3Nlc3R1ZGVudFwiOiBcIlNlbGVjdCBTdHVkZW50XCIsXG4gICAgICAgIFwiY2hvb3NlcmVxdWlyZVwiOiBcIllvdSBuZWVkIHRvIGNob29zZSBhIHN0dWRlbnQhXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJTdHVkZW50cyB3b3JrIG5vdCBmb3VuZFwiLFxuICAgICAgICBcInN1bW1hcml6ZXBkZlwiOiBcIkRvd25sb2FkIG5ld2VzdCB2ZXJzaW9ucyBcXG5hcyBzaW5nbGUgcGRmXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmc2hvcnRcIjogXCJBbGwgRXhhbXMgYXMgUERGXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0XCI6IFwicHJpbnRyZXF1ZXN0IHJlY2VpdmVkXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0c2hvd1wiOiBcIkRvIHlvdSB3YW50IHRvIG9wZW4gdGhlIGRvY3VtZW50IGFuZCBwcmludCBpdD9cIixcbiAgICAgICAgXCJkb3dubG9hZFwiOiBcImRvd25sb2FkXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInByZXZpZXdcIjogXCJwcmV2aWV3XCIsXG4gICAgICAgIFwic2VuZFwiOiBcInNlbmRcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOlwiYWN0aXZhdGVcIixcbiAgICAgICAgXCJBY3RpdmF0ZVwiOlwiQWN0aXZhdGVcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcInZpcnR1YWwgZW52aXJvbm1lbnQgZGV0ZWN0ZWRcIixcbiAgICAgICAgXCJkZWxldGVcIjogXCJkZWxldGVcIixcbiAgICAgICAgXCJmaWxlZGVsZXRlXCI6IFwiRG8geW91IHJlYWxseSB3YW50IHRvIGRlbGV0ZSB0aGlzIGZpbGUvZm9sZGVyP1wiLFxuICAgICAgICBcImNhbm5vdERlbGV0ZUFjdGl2ZVNoZWV0XCI6IFwiQWN0aXZlIFNoZWV0IGNhbm5vdCBiZSBkZWxldGVkIGR1cmluZyBleGFtXCIsXG4gICAgICAgIFwiZXhpdGRlbGV0ZVwiOiBcIkRlbGV0ZSBhbGwgZXhhbS1yZWxhdGVkIGZpbGVzIG9uIHN0dWRlbnRzIGRldmljZXNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiU3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2thY3RpdmF0ZVwiOiBcImFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcImN1c3RvbWhvc3RcIjogXCJDdXN0b20gTFQgSG9zdFwiLFxuICAgICAgICBcImxhbmd1YWdldG9vbGhvc3RcIjogXCJMYW5ndWFnZVRvb2wgSG9zdFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwiY21hcmdpblwiOiBcIkNvcnJlY3Rpb24gTWFyZ2luIFBvc2l0aW9uXCIsXG4gICAgICAgIFwiY21hcmdpbi1sZWZ0XCI6IFwibGVmdFwiLFxuICAgICAgICBcImNtYXJnaW4tcmlnaHRcIjogXCJyaWdodFwiLFxuICAgICAgICBcImNtYXJnaW4tdmFsdWVcIjogXCJDb3JyZWN0aW9uIE1hcmdpbiBzaXplIChjbSlcIixcbiAgICAgICAgXCJ0ZXh0ZWRpdG9yXCI6IFwiVGV4dGVkaXRvciBTZXR0aW5nc1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJiYWNrdXBhdXRvXCI6XCJBdXRvbWF0aWMgUmV0cmVpdmFsXCIsXG4gICAgICAgIFwiYmFja3VwYXV0b3F1ZXN0aW9uXCI6XCJQbGVhc2Ugc2V0IHRoZSBpbnRlcnZhbCBmb3IgYXV0b21hdGljIHJldHJlaXZhbD9cIixcbiAgICAgICAgXCJiYWNrdXBhdXRvaGludFwiOlwiKFRpbWVmcmFtZSBpbiBtaW51dGVzKVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkXCI6IFwiRWR1dmlkdWFsIC8gTW9vZGxlXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRoaW50XCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgdGVzdCBVUkwhXCIsXG4gICAgICAgIFwiZ2Zvcm1zaGludFwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIEdvb2dsZSBGb3JtcyBJRCFcIixcbiAgICAgICAgXCJlZHV2aWR1YWxkb21haW5cIjogXCJQbGVhc2UgcHJvdmlkZSB5b3VyIG1vb2RsZSBkb21haW4gaWYgaXQncyBub3QgZWR1dmlkdWFsLmF0XCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZERvbWFpblwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIE1vb2RsZSBkb21haW4hXCIsXG4gICAgICAgIFwiaW52YWxpZERvbWFpblwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIGRvbWFpbiFcIixcbiAgICAgICAgXCJtb29kbGVJbnZhbGlkSWRcIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCB0ZXN0IElEIVwiLFxuICAgICAgICBcImxvY2tcIjpcImxvY2sgZGlzcGxheXNcIixcbiAgICAgICAgXCJ1bmxvY2tcIjpcInVubG9jayBkaXNwbGF5c1wiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiUnVubmluZyBvdXQgb2YgZnJlZSBkaXNjc3BhY2UhIVwiLFxuICAgICAgICBcImludmFsaWRfZmlsZVwiIDogXCJXcm9uZyBGaWxldHlwZVwiLFxuICAgICAgICBcImludmFsaWRfZmlsZV90ZXh0XCI6IFwiT25seSBGaWxlcyB3aXRoIHRoZSAueGxzeCBvciAuZG9jeCBleHRlbnNpb24gYXJlIGFsbG93ZWRcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlIGV4aXN0aW5nIEZpbGVzIG9uIE9uZURyaXZlP1wiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6XCJFeGFtIHJlcXVlc3RlZFwiLFxuICAgICAgICBcInNjcmVlbnNob3RcIjpcIlNjcmVlbnNob3R1cGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90dGl0bGVcIjpcIlNjcmVlbnNob3QgVXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHF1ZXN0aW9uXCI6XCJTZXQgdGhlIGludGVydmFsIHRvIHVwZGF0ZSBTY3JlZW5zaG90c1wiLFxuICAgICAgICBcInNjcmVlbnNob3RoaW50XCI6XCIoVGltZSBpbiBzZWNvbmRzLiAwID09IGRlYWt0aXZhdGVkKVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdcIjpcIlNvbWUgb2YgdGhlIGZpbGVzIGFyZSBvbGRlciB0aGFuIDUgbWludXRlcyFcIixcbiAgICAgICAgXCJvbGRwZGZ3YXJuaW5nc2luZ2xlXCI6XCJUaGUgbG9jYWwgdmVyc2lvbiBvZiB0aGUgZmlsZSBtYXkgYmUgb3V0ZGF0ZWQhXCIsXG4gICAgICAgIFwiZ2Zvcm1zXCI6IFwiR29vZ2xlIEZvcm1zXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkXCI6XCJBY2Nlc3MgRGVuaWVkIVwiLFxuICAgICAgICBcImFjY2Vzc0RlbmllZHRleHRcIjpcIkNvbnRhY3QgeW91ciBvcmdhbml6YXRpb25zIEFkbWluaXN0cmF0b3IgdG8gZ3JhbnQgQWNjZXNzIHRvIE5leHQtRXhhbVwiLFxuICAgICAgICBcIm1zb1dhcm5cIjogXCJZb3UgbmVlZCB0byByZWNvbm5lY3QgYW5kIHNlbGVjdCBhbiBNU09GaWxlIGJlZm9yZSByZWNvbm5lY3RpbmcgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwiYWxsb3dzcGVsbGNoZWNrXCI6XCJBY3RpdmF0ZSBzcGVsbGNoZWNrIGZvciBzcGVjaWZpYyBzdHVkZW50XCIsXG4gICAgICAgIFwibGluZXNwYWNpbmdcIjogXCJMaW5lc3BhY2luZ1wiLFxuICAgICAgICBcImZvbnRmYW1pbHlcIjogXCJGb250ZmFtaWx5XCIsXG4gICAgICAgIFwiZGVmYXVsdHByaW50ZXJcIjogXCJTZWxlY3QgZGVmYXVsdCBwcmludGVyXCIsXG4gICAgICAgIFwiYWxsb3dkaXJlY3RwcmludFwiOiBcIkFsbG93IGRpcmVjdCBwcmludCBmb3Igc3R1ZGVudHNcIixcbiAgICAgICAgXCJub3ByaW50ZXJcIjogXCJObyBwcmludGVyIGZvdW5kXCIsXG4gICAgICAgIFwiZGlyZWN0cHJpbnRcIjogXCJEaXJlY3QgcHJpbnRcIixcbiAgICAgICAgXCJvcGVuXCI6IFwiT3BlbiBmaWxlIGluIGV4dGVybmFsIHZpZXdlclwiLFxuICAgICAgICBcIm9jclwiOiBcIkFjdGl2YXRlIE9DUiBzYWZ0ZXkgZmVhdHVyZVwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0dGl0bGVcIjogXCJBdWRpbyByZXN0cmljdGlvbnNcIixcbiAgICAgICAgXCJhdWRpb2FsbG93XCI6IFwibm8gcmVzdHJpY3Rpb25zXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXQxXCI6IFwicmVwZXRpdGlvblwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MlwiOiBcInJlcGV0aXRpb25zXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjogXCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsYWN0aXZhdGVcIjogXCJBY3RpdmF0ZSBCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsc2V0dGluZ3NcIjogXCJFeHRlbmRlZCBTZXR0aW5ncyBmb3IgQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJncm91cHNcIjpcIkFjdGl2YXRlIGdyb3Vwc1wiLFxuICAgICAgICBcImdyb3VwaW5mb1wiOiBcIkRpdmlkZSBzdHVkZW50cyBpbiB0d28gZ3JvdXBzXCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc1wiOiBcIkV4dGVuZGVkIFNldHRpbmdzXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcInNhdmVcIixcbiAgICAgICAgXCJkaXNhYmxlZFwiOiBcImRpc2FibGVkXCIsXG4gICAgICAgIFwib2NyaW5mb1wiOlwiU2VhcmNoIGZvciBjdXJyZW50IGV4YW0gcGluIGluIHNjcmVlbnNob3RzXCIsXG4gICAgICAgIFwiYmlwaW5mb1wiOiBcIkJpUC1TdGF0dXMgZGVmaW5lcyBpZiBhdXRoZW50aWNhdGVkIGNsaWVudHMgY2FuIGNvbm5lY3RcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nIG91dD9cIixcbiAgICAgICAgXCJhY3RpdmF0ZXNlY3Rpb25zXCI6IFwiQWN0aXZhdGUgZXhhbSBzZWN0aW9uc1wiLFxuICAgICAgICBcImV4YW1zZWN0aW9uc1wiOiBcImV4YW0gc2VjdGlvbnNcIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNpbmZvXCI6IFwiWW91IGFyZSBpbiBzZWN1cmVkIG1vZGUuIERvIHlvdSB3YW50IHRvIGFjdGl2YXRlIHRoaXMgZXhhbSBzZWN0aW9uIGZvciBhbGwgY29ubmVjdGVkIGNsaWVudHM/XCIsXG4gICAgICAgIFwibm9cIjpcIk5vXCIsXG4gICAgICAgIFwieWVzXCI6XCJZZXNcIixcbiAgICAgICAgXCJleGFtbW9kZVwiOlwiRXhhbS1Nb2RlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6XCJNYXRlcmlhbHNcIixcbiAgICAgICAgXCJkZWZpbmVtYXRlcmlhbHNcIjpcIkRlZmluZSBNYXRlcmlhbHNcIixcbiAgICAgICAgXCJwcm9jZXNzaW5nZmlsZXNcIjpcIlByb2Nlc3NpbmcgRmlsZXNcIixcbiAgICAgICAgXCJmb250c2l6ZXRpdGxlXCI6IFwiRm9udHNpemVcIixcbiAgICAgICAgXCJmb250c2l6ZVwiOiBcIkZvbnRzaXplXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZVwiOiBcIkRlbGV0ZSBGaWxlXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZWNvbmZpcm1cIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoaXMgZmlsZT9cIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZVwiOiBcIlNlY3Rpb24gTmFtZVwiLFxuICAgICAgICBcInNlY3Rpb25uYW1laW5mb1wiOiBcIlBsZWFzZSBlbnRlciBhIG5hbWUgZm9yIHRoaXMgc2VjdGlvblwiLFxuICAgICAgICBcImdyb3VwQVwiOiBcIkdyb3VwIEFcIixcbiAgICAgICAgXCJncm91cEJcIjogXCJHcm91cCBCXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTFwiOiBcIkFsbG93ZWQgVVJMXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTGluZm9cIjogXCJQbGVhc2UgZW50ZXIgYSBVUkwgdGhhdCBpcyBhbGxvd2VkIGR1cmluZyB0aGUgZXhhbVwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NfbW9kZVwiOiBcIkV4dGVuZGVkIFNldHRpbmdzIGZvciBFeGFtLU1vZGVcIixcbiAgICAgICAgXCJyZHBcIjogXCJXZWIgUkRQXCIsXG4gICAgICAgIFwicmRwY29uZmlnXCI6IFwiUkRQIENvbmZpZ3VyYXRpb25cIixcbiAgICAgICAgXCJyZHBjb25maWdpbmZvXCI6IFwiUGxlYXNlIGVudGVyIHRoZSBkb21haW4gKFVSTCkgb2YgdGhlIFJEUC1TZXJ2ZXJcIixcbiAgICAgICAgXCJtdXRlYXVkaW9cIjogXCJNdXRlIGF1ZGlvXCIsXG4gICAgICAgIFwibXV0ZWF1ZGlvaW50cm9cIjogXCJJZiB0aGlzIG9wdGlvbiBpcyBhY3RpdmF0ZWQsIGF1ZGlvIHNpZ25hbHMgZHVyaW5nIHRoZSBleGFtIHdpbGwgbm90IGJlIHBsYXllZFwiLFxuICAgICAgICBcInNob3dzdWJtaXNzaW9uXCI6IFwiU2hvdyBzdWJtaXNzaW9uXCIsXG4gICAgICAgIFwic3R1ZGVudGluZm9cIjogXCJTaG93IHN0dWRlbnQgZGV0YWlsc1wiLFxuICAgICAgICBcInZpcnR1YWxpemVkaW5mb1wiOiBcIlRoZSBleGFtIGVudmlyb25tZW50IGlzIHBvc3NpYmx5IHJ1bm5pbmcgaW4gYSB2aXJ0dWFsIG1hY2hpbmVcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tpbmZvXCI6IFwiVGhlIHNlY3VyZSBtb2RlIHdhcyBsZWZ0IGF0dGVtcHQhXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RpbmZvXCI6IFwiQmFja3VwIHJlcXVlc3RzIHdlcmUgbWFkZVwiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudGluZm9cIjogXCJSZW1vdGUgQXNzaXN0YW50IFNvZnR3YXJlIGlzIHBvc3NpYmx5IHJ1bm5pbmcgb24gdGhlIGNsaWVudCBkZXZpY2VcIixcbiAgICAgICAgXCJkb2N1bWVudHNpbmZvXCI6IFwiRG9jdW1lbnRzIG9uIHRoZSBjbGllbnQgZGV2aWNlOiBcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmdcIjogXCJGaWxlIFNpemVcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmd0ZXh0XCI6IFwie2ZpbGVuYW1lfSBpcyBsYXJnZXIgdGhhbiA4IE1CICh7c2l6ZX0gTUIpLiBMYXJnZSBmaWxlcyBtYXkgc2xvdyBkb3duIHRoZSB0cmFuc2Zlci5cIixcbiAgICAgICAgXCJub3ByaW50ZXJDaG9zZW5cIjogXCJwbGVhc2Ugc2VsZWN0IGEgcHJpbnRlclwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJpbnZhbGlkcmVnaXN0cmF0aW9uXCI6IFwibm8gc2VydmVyc2lkZSByZWdpc3RyYXRpb25cIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInN0YXRlY2hhbmdlXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNcIjogXCJFeGFtIFNlcnZlciBhbHJlYWR5IGV4aXN0c1wiLFxuICAgICAgICBcInNlcnZlcmV4aXN0c0xBTlwiOiBcIkV4YW0gU2VydmVyIGFscmVhZHkgYWN0aXZlIGluIGxvY2FsIGFyZWEgbmV0d29ya1wiLFxuICAgICAgICBcInNlcnZlcnN0YXJ0ZWRcIjogXCJFeGFtIFNlcnZlciBzdGFydGVkXCIsXG4gICAgICAgIFwic2VydmVyc3RvcHBlZFwiOiBcIkV4YW0gU2VydmVyIHN0b3BwZWRcIixcbiAgICAgICAgXCJub3Rmb3VuZFwiOiBcIkV4YW0gZG9lc24ndCBleGlzdFwiLFxuICAgICAgICBcIndyb25ncHdcIjogXCJXcm9uZyBQYXNzd29yZFwiLFxuICAgICAgICBcIndyb25ncGluXCI6IFwiV3JvbmcgUElOXCIsXG4gICAgICAgIFwiY29ycmVjdHB3XCI6IFwiUGFzc3dvcmQgT0tcIixcbiAgICAgICAgXCJzdHVkZW50cmVtb3ZlXCI6IFwiUmVtb3ZlZCBzdHVkZW50IGZyb20gRXhhbSBTZXJ2ZXJcIixcbiAgICAgICAgXCJhY3Rpb25kZW5pZWRcIjogXCJhY3Rpb24gZGVuaWVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJzdHVkZW50dXBkYXRlXCI6IFwic3R1ZGVudCB1cGRhdGVkXCIsXG4gICAgICAgIFwic3R1ZGVudGxlZnRcIjogXCJzdHVkZW50IGxlZnQgdGhlIGV4YW1cIixcbiAgICAgICAgXCJzdGF0ZXJlc3RvcmVcIjogXCJzYWZlIGV4YW0gc3RhdGUgcmVzdG9yZWRcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcIm5leHQtZXhhbSBpcyBydW4gaW4gYSB2aXJ0dWFsIG1hY2hpbmVcIixcbiAgICAgICAgXCJ2ZXJzaW9ubWlzbWF0Y2hcIjogXCJBcHBsaWNhdGlvbiB2ZXJzaW9ucyBtaXNtYXRjaFwiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6IFwiRXhhbXMgcmVxdWVzdGVkXCIsXG4gICAgICAgIFwiYmlwcmVxdWlyZWRcIjogXCJCaWxkdW5nc3BvcnRhbCBhdXRoZW50aWZpY2F0aW9uIG1hbmRhdG9yeSFcIixcbiAgICAgICAgXCJzdWJtaXNzaW9uZmFpbGVkXCI6IFwiU3VibWlzc2lvbiBmYWlsZWQhXCIsXG4gICAgICAgIFwic3VibWlzc2lvbnNcIjogXCJTdWJtaXNzaW9uc1wiXG4gICAgfSwgIFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRoZSB0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJkZW5pZWRcIjogXCJwZXJtaXNzaW9uIGRlbmllZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwibm8gc3R1ZGVudHMgY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiZmlsZXMgc2VudFwiLFxuICAgICAgICBcImNvdWxkbm90c3RvcmVcIjogXCJzdHVkZW50IGNvdWxkIG5vdCBzdG9yZSBmaWxlXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJub2ZpbGVyZWNlaXZlZFwiOiBcIm5vIGZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmRlbGV0ZWRcIjogXCJkZWxldGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwicmVhZGluZyBmaWxlIGZhaWxlZFwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJQbGVhc2UgZG91YmxlIGNoZWNrIHRoZSByZW5kZXJpbmcgb2YgdGhlIGFjdGl2ZSBzaGVldHMgZm9ybSBmaWVsZHMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBleGFtIVwiLFxuICAgICAgICBcImVkaXRcIjogXCJFZGl0XCIsXG4gICAgICAgIFwic2F2ZVwiOiBcIlNhdmVcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwiZ2VuZXJhbFwiOiB7XG4gICAgICAgIFwic3RhcnRzZXJ2ZXJcIjpcIlByXHUwMEZDZnVuZyBhbmxlZ2VuXCIsXG4gICAgICAgIFwic2xpc3RcIjogXCJBa3RpdmUgUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJva1wiOiBcIk9LXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiXG4gICAgfSxcbiAgICBcInNlcnZlcmxpc3RcIiA6IHtcbiAgICAgICAgXCJwd2RcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwibG9naW5cIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcIm5vcHdcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluIFBhc3N3b3J0IGVpblwiXG4gICAgfSxcbiAgICBcInN0YXJ0c2VydmVyXCIgOiB7XG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwic3RhcnRcIjogXCJQclx1MDBGQ2Z1bmcgc3RhcnRlblwiLFxuICAgICAgICBcInJlc3VtZVwiOiBcIlByXHUwMEZDZnVuZyBmb3J0c2V0emVuXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjogXCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZW1wdHlwd1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW4gUGFzc3dvcnQgYW5cIixcbiAgICAgICAgXCJlbXB0eW5hbWVcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZW4gTmFtZW4gYW5cIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJ3b3JrZm9sZGVyXCI6IFwiQXJiZWl0c3ZlcnplaWNobmlzXCIsXG4gICAgICAgIFwic2VsZWN0XCI6IFwiQXJiZWl0c3ZlcnplaWNobmlzIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJadSB3ZW5pZyBmcmVpZXIgU3BlaWNoZXJwbGF0elwiLFxuICAgICAgICBcImRpcmVjdG9yeWVycm9yXCI6IFwiRmVobGVuZGUgU2NocmVpYnJlY2h0ZSBpbSBnZXdcdTAwRTRobHRlbiBWZXJ6ZWljaG5pc1wiLFxuICAgICAgICBcInByZXZpb3VzZXhhbXNcIjogXCJMb2thbCBnZXNpY2hlcnRlIFByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwiZm9sZGVyZGVsZXRlXCI6IFwiV29sbGVuIFNpZSBkaWUgZGVuIGxva2FsZW4gUHJcdTAwRkNmdW5nc29yZG5lciBsXHUwMEY2c2NoZW4/XCIsXG4gICAgICAgIFwib25saW5lZXhhbXNcIjogXCJCaVAgUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJiaXBub3Rsb2dnZWRpblwiOiBcIkJpdHRlIG1lbGRlbiBTaWUgc2ljaCBhbSBCaVAgYW4sIGJldm9yIFNpZSBkaWUgUHJcdTAwRkNmdW5nIHN0YXJ0ZW5cIixcbiAgICAgICAgXCJub05ld3NcIjpcIktlaW5lIE5ldWlna2VpdGVuIHZlcmZcdTAwRkNnYmFyXCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyXCI6IFwiQmFja3VwdmVyemVpY2huaXNcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmVuIFBmYWQgZlx1MDBGQ3IgZGFzIEJhY2t1cC1WZXJ6ZWljaG5pcyBlaW5cIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXJ3ZWl0ZXJ0XCIsXG4gICAgICAgIFwiaW5jb21wYXRpYmxlXCI6IFwiTmljaHQga29tcGF0aWJlbCBtaXQgZGVyIGFrdHVlbGxlbiBWZXJzaW9uXCIsXG4gICAgICAgIFwic2VsZWN0aW50ZXJmYWNlXCI6IFwiTmV0endlcmstU2Nobml0dHN0ZWxsZSB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcInNlbGVjdGludGVyZmFjZWluZm9cIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBiZXZvcnp1Z3RlIE5ldHp3ZXJrc2Nobml0dHN0ZWxsZSBhdXMhXCJcbiAgICB9LFxuICAgIFwiZGFzaGJvYXJkXCI6e1xuICAgICAgICBcInJlbW92ZVVSTFwiOiBcIlVSTCBlbnRmZXJuZW5cIixcbiAgICAgICAgXCJyZW1vdmVVUkxjb25maXJtXCI6IFwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBkaWVzZSBVUkwgZW50ZmVybmVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJyZW1vdGVhc3Npc3RhbnRcIjogXCJSZW1vdGUgQXNzaXN0YW50XCIsXG4gICAgICAgIFwic2VydmVyXCI6IFwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwic3RvcHNlcnZlclwiOiBcIlByXHUwMEZDZnVuZyB2ZXJsYXNzZW5cIixcbiAgICAgICAgXCJmaWxlc2VuZFwiOiBcIkRhdGVpZW4gc2VuZGVuXCIsXG4gICAgICAgIFwiZmlsZXNlbmR0ZXh0XCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgb2RlciBtZWhyZXJlIERhdGVpZW5cIixcbiAgICAgICAgXCJvZmZpY2VmaWxlc2VuZFwiOiBcIkRhdGVpIGhvY2hsYWRlblwiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kdGV4dFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIC54bHN4IGJ6dy4gLmRvY3ggRGF0ZWkgYWxzIFRlbXBsYXRlIGZcdTAwRkNyIGRpZSBTY2hcdTAwRkNsZXI6aW5uZW5cIixcbiAgICAgICAgXCJjYW5jZWxcIjogXCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiS2VpbmUgRGF0ZWllbiBhdXNnZXdcdTAwRTRobHRcIixcbiAgICAgICAgXCJ1cGxvYWRmaWxlc1wiOiBcIkRhdGVpZW4gd2VyZGVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiRGF0ZWllbiBnZXNlbmRldFwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIktlaW5lIFNjaFx1MDBGQ2xlcjppbm5lbiB2ZXJidW5kZW5cIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c1wiOiBcIkFjdGl2ZSBTaGVldHNcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNoaW50XCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgUERGLURhdGVpIGF1cywgZGllIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJhY2NlcHRQZGZcIjogXCJQREYgRGF0ZWkgXHUwMEZDYmVybmVobWVuXCIsXG4gICAgICAgIFwic2VsZWN0T3RoZXJQZGZcIjogXCJhbmRlcmUgUERGIERhdGVpIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwibm9wZGZzZWxlY3RlZFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFBERi1EYXRlaSBhdXMhXCIsXG4gICAgICAgIFwiaW52YWxpZHBkZlwiOiBcIlVuZ1x1MDBGQ2x0aWdlIFBERi1EYXRlaSFcIixcbiAgICAgICAgXCJwZGZwcm9jZXNzaW5nZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBWZXJhcmJlaXRlbiBkZXIgUERGLURhdGVpLlwiLFxuICAgICAgICBcImVkdXZpZHVhbFwiOiBcIkVkdXZpZHVhbCAvIE1vb2RsZVwiLFxuICAgICAgICBcIndlYnNpdGVcIjogXCJXZWJzaXRlLVVSTFwiLFxuICAgICAgICBcImF1dG9nZXRcIjogXCJCYWNrdXAtSW50ZXJ2YWxsXCIsXG4gICAgICAgIFwic3RhcnRleGFtXCI6IFwiR2VyXHUwMEU0dGUgYWJzaWNoZXJuXCIsXG4gICAgICAgIFwic3RhcnRleGFtc2luZ2xlXCI6IFwiR2VyXHUwMEU0dCBhYnNpY2hlcm5cIixcbiAgICAgICAgXCJzdGFydGV4YW1kZXNjXCI6IFwiU3RhcnRldCBkZW4gYWJnZXNpY2hlcnRlbiBQclx1MDBGQ2Z1bmdzbW9kdXMgYXVmIGRlbiBHZXJcdTAwRTR0ZW4gZGVyIFNjaFx1MDBGQ2xlcjppbm5lblwiLFxuICAgICAgICBcInNlbmRmaWxlXCI6IFwiRGF0ZWllbiBhbiBhbGxlIFNjaFx1MDBGQ2xlcjppbm5lbiBzZW5kZW4gKHBkZiwganBnLCBtcDMsIGJhaywgZ2diLCBwbmcsIGdpZiwgd2F2LCBvZ2cpXCIsXG4gICAgICAgIFwic2VuZGZpbGVTaW5nbGVcIjogXCJEYXRlaSBzZW5kZW5cIixcbiAgICAgICAgXCJnZXRmaWxlXCI6IFwiU2ljaGVydW5nZW4gdm9uIGFsbGVuIFNjaFx1MDBGQ2xlcjppbm5lbiBob2xlblwiLFxuICAgICAgICBcImdldGZpbGVTaW5nbGVcIjogXCJTaWNoZXJ1bmcgaG9sZW5cIixcbiAgICAgICAgXCJnZXRmaWxlc1wiOiBcIlNpY2hlcnVuZyBob2xlblwiLFxuICAgICAgICBcInN0b3BleGFtXCI6IFwiR2VyXHUwMEU0dGUgZnJlaWdlYmVuXCIsXG4gICAgICAgIFwic3RvcGV4YW1zaW5nbGVcIjogXCJHZXJcdTAwRTR0IGZyZWlnZWJlblwiLFxuICAgICAgICBcInN1cmVcIjogXCJTaW5kIFNpZSBzaWNoZXI/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1zdXJlXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBzY2hsaWVcdTAwREZlbj9cIixcbiAgICAgICAgXCJleGl0ZXhhbVwiOiBcIkRpZXMgYmVlbmRldCBkZW4gUHJcdTAwRkNmdW5nc3NlcnZlci5cXG5EaWUgU2NoXHUwMEZDbGVyOmlubmVuIGtcdTAwRjZubmVuIGltIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYXVjaCBvaG5lIFZlcmJpbmR1bmcgd2VpdGVyYXJiZWl0ZW4uXCIsXG4gICAgICAgIFwiZXhpdGV4YW1pbmZvXCI6IFwiQWxsZSBiZXN0ZWhlbmRlbiBWZXJiaW5kdW5nZW4gd2VyZGVuIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbi4gRGllcyBzY2hsaWVcdTAwREZ0IGRhcyBQclx1MDBGQ2Z1bmdzZmVuc3RlciBmXHUwMEZDciBhbGxlIFNjaFx1MDBGQ2xlcjppbm5lbiFcIixcbiAgICAgICAgXCJleGl0a2lvc2tzaG9ydFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbi5cIixcbiAgICAgICAgXCJyZWFsbHlraWNrXCI6IFwidm9tIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgZW50ZmVybmVuXCIsXG4gICAgICAgIFwia2lja1wiOiBcIlZlcmJpbmR1bmcgdHJlbm5lblwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIkFic2ljaGVydW5nIHZlcmxhc3NlblwiLFxuICAgICAgICBcIm9ubGluZVwiOlwiSW5mb1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJvZmZsaW5lXCIsXG4gICAgICAgIFwic2VjdXJlXCI6XCJFeGFtXCIsXG4gICAgICAgIFwic2VjdXJlaW5mb1wiOlwiU2NoXHUwMEZDbGVyOmluIGlzdCBhYmdlc2ljaGVydFwiLFxuICAgICAgICBcInJlc3RvcmVcIjpcImZvcnRzZXR6ZW5cIixcbiAgICAgICAgXCJyZXN1bWVpbmZvXCI6XCJUZW1wb3JcdTAwRTRyZSBCbG9ja2FkZSBhdWZoZWJlblwiLFxuICAgICAgICBcImV4YW1tb2RlYWN0aXZlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGJlcmVpdHMgaW0gYWJnZXNpY2hlcnRlbiBNb2R1c1wiLFxuICAgICAgICBcImNsb3NlXCI6XCJzY2hsaWVcdTAwREZlblwiLFxuICAgICAgICBcImRlbFwiOiBcIkFyYmVpdHNvcmRuZXIgYXVmIEdlclx1MDBFNHRlbiBkZXIgU2NoXHUwMEZDbGVyOmlubmVuIGJlcmVpbmlnZW5cIixcbiAgICAgICAgXCJkZWxzdXJlXCI6IFwiRGllIEFyYmVpdHNvcmRuZXIgYXVmIGRlbiBHZXJcdTAwRTR0ZW4gZGVyIFNjaFx1MDBGQ2xlcjppbm5lbiB3ZXJkZW4gZ2VsZWVydFwiLFxuICAgICAgICBcImRlbHNpbmdsZVwiOiBcIkFyYmVpdHNvcmRuZXIgYXVmIFNjaFx1MDBGQ2xlcjppbm5lbi1TZWl0ZSBiZXJlaW5pZ2VuXCIsXG4gICAgICAgIFwiZGVsc2luZ2xlc3VyZVwiOiBcIkRlciBBcmJlaXRzb3JkbmVyIGF1ZiBkZW0gU2NoXHUwMEZDbGVyOmlubmVuLUdlclx1MDBFNHQgd2lyZCBnZWxlZXJ0XCIsXG4gICAgICAgIFwiYXR0ZW50aW9uXCI6IFwiQWNodHVuZyFcIixcbiAgICAgICAgXCJiYWNrdXByZXF1ZXN0XCI6IFwiQXJiZWl0ZW4gd2VyZGVuIGdlaG9sdFwiLFxuICAgICAgICBcInNob3d3b3JrZm9sZGVyXCI6IFwiTG9rYWxlbiBBcmJlaXRzb3JkbmVyIGFuemVpZ2VuXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIk9yZG5lciBcdTAwRjZmZm5lblwiLFxuICAgICAgICBcInNob3duZXdlc3Rmb2xkZXJcIjogXCJOZXVlc3RlbiBPcmRuZXIgYW56ZWlnZW5cIixcbiAgICAgICAgXCJmaWxlc2ZvbGRlclwiOiBcIkRhdGVpZW4gaW0gQXJiZWl0c29yZG5lclwiLFxuICAgICAgICBcImNob29zZXN0dWRlbnRcIjogXCJXXHUwMEU0aGxlbiBTaWUgZWluZSBQZXJzb25cIixcbiAgICAgICAgXCJjaG9vc2VyZXF1aXJlXCI6IFwiU2llIG1cdTAwRkNzc2VuIGVpbmUgT3B0aW9uIHdcdTAwRTRobGVuIVwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgU2NoXHUwMEZDbGVyYXJiZWl0ZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJzdW1tYXJpemVwZGZcIjogXCJMZXR6dGUgQWJnYWJlbiBpblxcbmVpbmVyIFBERi1EYXRlaVxcbnp1c2FtbWVuZmFzc2VuXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmc2hvcnRcIjogXCJMZXR6dGUgQWJnYWJlbiB6dXNhbW1lbmZhc3NlblwiLFxuICAgICAgICBcInByaW50cmVxdWVzdFwiOiBcIkRydWNrYW5mcmFnZSBlcmhhbHRlblwiLFxuICAgICAgICBcInByaW50cmVxdWVzdHNob3dcIjogXCJXb2xsZW4gU2llIGRhcyBEb2t1bWVudCBhbnNlaGVuIHVuZCBkcnVja2VuP1wiLFxuICAgICAgICBcImRvd25sb2FkXCI6IFwiaGVydW50ZXJsYWRlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInByZXZpZXdcIjogXCJhbnNlaGVuXCIsXG4gICAgICAgIFwic2VuZFwiOiBcInZlcnNlbmRlblwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6XCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwiQWN0aXZhdGVcIjogXCJBa3RpdmllcmVuXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRcIjogXCJ2aXJ0dWFsaXNlcnRlIEFyYmVpdHN1bWdlYnVuZ1wiLFxuICAgICAgICBcImRlbGV0ZVwiOiBcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImZpbGVkZWxldGVcIjogXCJXb2xsZW4gU2llIGRpZSBEYXRlaS9kZW4gT3JkbmVyIHdpcmtsaWNoIGxcdTAwRjZzY2hlbj9cIixcbiAgICAgICAgXCJjYW5ub3REZWxldGVBY3RpdmVTaGVldFwiOiBcIkFjdGl2ZSBTaGVldCBrYW5uIHdcdTAwRTRocmVuZCBkZXIgUHJcdTAwRkNmdW5nIG5pY2h0IGdlbFx1MDBGNnNjaHQgd2VyZGVuXCIsXG4gICAgICAgIFwiZXhpdGRlbGV0ZVwiOiBcIlByXHUwMEZDZnVuZ3NkYXRlbiBhdWYgU2NoXHUwMEZDbGVyUENzIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJoaWxmZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2thY3RpdmF0ZVwiOiBcIlJlY2h0c2NocmVpYmhpbGZlIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgU3ByYWNoZSBmXHUwMEZDciBkaWUgUHJcdTAwRkNmdW5nXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcImN1c3RvbWhvc3RcIjogXCJFaWdlbmVyIExUIEhvc3RcIixcbiAgICAgICAgXCJsYW5ndWFnZXRvb2xob3N0XCI6IFwiTGFuZ3VhZ2VUb29sIEhvc3RcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwiY21hcmdpblwiOiBcIktvcnJla3R1cnJhbmQgUG9zaXRpb25cIixcbiAgICAgICAgXCJjbWFyZ2luLWxlZnRcIjogXCJsaW5rc1wiLFxuICAgICAgICBcImNtYXJnaW4tcmlnaHRcIjogXCJyZWNodHNcIixcbiAgICAgICAgXCJjbWFyZ2luLXZhbHVlXCI6IFwiS29ycmVrdHVycmFuZCBpbSBQREZcIixcbiAgICAgICAgXCJ0ZXh0ZWRpdG9yXCI6IFwiVGV4dGVkaXRvci1FaW5zdGVsbHVuZ2VuXCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcImJhY2t1cGF1dG9cIjpcIkF1dG9tYXRpc2NoZSBTaWNoZXJ1bmdcIixcbiAgICAgICAgXCJiYWNrdXBhdXRvcXVlc3Rpb25cIjpcIkluIHdlbGNoZW4gQWJzdFx1MDBFNG5kZW4gc29sbGVuIGRpZSBBcmJlaXRlbiBnZWhvbHQgd2VyZGVuP1wiLFxuICAgICAgICBcImJhY2t1cGF1dG9oaW50XCI6XCIoWmVpdGFuZ2FiZSBpbiBNaW51dGVuKVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkXCI6IFwiRWR1dmlkdWFsIC8gTW9vZGxlXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRoaW50XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIFRlc3QtVVJMIGVpbiFcIixcbiAgICAgICAgXCJnZm9ybXNoaW50XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIEdvb2dsZSBGb3JtcyBJRCBlaW4hXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsZG9tYWluXCI6IFwiU29sbHRlIGlocmUgTW9vZGxlaW5zdGFueiB1bnRlciBlaW5lciBhbmRlcmVuIERvbWFpbiBlcnJlaWNoYmFyIHNlaW4sIGdlYmVuIFNpZSBkaWVzZSBhblwiLFxuICAgICAgICBcIm1vb2RsZUludmFsaWREb21haW5cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgTW9vZGxlLURvbWFpbiBhbiFcIixcbiAgICAgICAgXCJpbnZhbGlkRG9tYWluXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIERvbWFpbiBlaW4hXCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZElkXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIFRlc3QtSUQgYW4hXCIsXG4gICAgICAgIFwibG9ja1wiOlwiQmlsZHNjaGlybWUgc3BlcnJlblwiLFxuICAgICAgICBcInVubG9ja1wiOlwiQmlsZHNjaGlybWUgZnJlaWdlYmVuXCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJGcmVpZXIgU3BlaWNoZXJwbGF0eiB6dSBnZXJpbmchXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlXCIgOiBcIkZhbHNjaGVyIERhdGVpdHlwXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlX3RleHRcIjogXCJOdXIgRGF0ZWllbiBtaXQgZGVyIEVuZHVuZyAueGxzeCB1bmQgLmRvY3ggc2luZCBlcmxhdWJ0LlwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlZvcmhhbmRlbmUgRGF0ZWllbiBhdWYgT25lRHJpdmUgZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjpcIlNpY2hlcnVuZyBhbmdlZm9yZGVydFwiLFxuICAgICAgICBcInNjcmVlbnNob3RcIjpcIlNjcmVlbnNob3R1cGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90dGl0bGVcIjpcIlNjcmVlbnNob3QgVXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHF1ZXN0aW9uXCI6XCJJbiB3ZWxjaGVuIEFic3RcdTAwRTRuZGVuIHNvbGxlbiBkaWUgU2NyZWVuc2hvdHMgYWt0dWFsaXNpZXJ0IHdlcmRlbj9cIixcbiAgICAgICAgXCJzY3JlZW5zaG90aGludFwiOlwiKFplaXRhbmdhYmUgaW4gU2VrdW5kZW4uIDAgPT0gZGVha3RpdmllcnQpXCIsXG4gICAgICAgIFwib2xkcGRmd2FybmluZ1wiOlwiTWFuY2hlIEFiZ2FiZW4gc2luZCBtZWhyIGFscyA1IE1pbnV0ZW4gYWx0IVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdzaW5nbGVcIjpcIkRpZSBsb2thbGUgVmVyc2lvbiBkZXIgRGF0ZWkgaXN0IG1cdTAwRjZnbGljaGVyd2Vpc2UgdmVyYWx0ZXQhXCIsXG4gICAgICAgIFwiZ2Zvcm1zXCI6IFwiR29vZ2xlIEZvcm1zXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkXCI6XCJadWdyaWZmIHZlcndlaWdlcnQhXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkdGV4dFwiOlwiQml0dGUga29udGFrdGllcmVuIFNpZSBpaHJlbiBTeXN0ZW1hZG1pbmlzdHJhdG9yLCB1bSBkZXIgQXBwbGlrYXRpb24gTmV4dC1FeGFtIFp1Z3JpZmYgenUgZ2V3XHUwMEU0aHJlblwiLFxuICAgICAgICBcIm1zb1dhcm5cIjogXCJCZXZvciBkaWUgU2NoXHUwMEZDbGVyOmlubmVuIGRpZSBWZXJiaW5kdW5nIHdpZWRlciBhdWZuZWhtZW4ga1x1MDBGNm5uZW4sIG1cdTAwRkNzc2VuIFNpZSBzaWNoIHp1IGlocmVyIE1pY3Jvc29mdCBDbG91ZCB2ZXJiaW5kZW4gdW5kIGRpZSBNU09EYXRlaSBlcm5ldXQgYXVzd1x1MDBFNGhsZW4hXCIsXG4gICAgICAgIFwiYWxsb3dzcGVsbGNoZWNrXCI6XCJSZWNodHNjaHJlaWJoaWxmZSBmXHUwMEZDciBTY2hcdTAwRkNsZXI6aW4gYWt0aXZpZXJlblwiLFxuICAgICAgICBcImxpbmVzcGFjaW5nXCI6IFwiWmVpbGVuYWJzdGFuZCBpbSBQREZcIixcbiAgICAgICAgXCJmb250ZmFtaWx5XCI6IFwiU2NocmlmdGFydFwiLFxuICAgICAgICBcImRlZmF1bHRwcmludGVyXCI6IFwiU3RhbmRhcmQtRHJ1Y2tlciB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcImFsbG93ZGlyZWN0cHJpbnRcIjogXCJTY2hcdTAwRkNsZXI6aW5uZW4gZXJsYXViZW4gRHJ1Y2thdWZ0clx1MDBFNGdlIGRpcmVrdCB6dSBzdGFydGVuXCIsXG4gICAgICAgIFwibm9wcmludGVyXCI6IFwiS2VpbmUgRHJ1Y2tlciBnZWZ1bmRlblwiLFxuICAgICAgICBcImRpcmVjdHByaW50XCI6IFwiQXV0b25vbWVyIERydWNrXCIsXG4gICAgICAgIFwib3BlblwiOiBcIkRhdGVpIGluIGV4dGVybmVtIEJldHJhY2h0ZXIgXHUwMEY2ZmZuZW5cIixcbiAgICAgICAgXCJvY3JcIjogXCJPQ1IgU2ljaGVyaGVpdFwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0dGl0bGVcIjogXCJBYnNwaWVsZW4gdm9uIEF1ZGlvZGF0ZWllbiBlaW5zY2hyXHUwMEU0bmtlblwiLFxuICAgICAgICBcImF1ZGlvYWxsb3dcIjogXCJLZWluZSBFaW5zY2hyXHUwMEU0bmt1bmdcIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdDFcIjogXCJ4IGFic3BpZWxlblwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MlwiOiBcInggYWJzcGllbGVuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjogXCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsYWN0aXZhdGVcIjogXCJCaWxkdW5nc3BvcnRhbCBha3RpdmllcmVuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxzZXR0aW5nc1wiOiBcIkVyd2VpdGVydGUgRWluc3RlbGx1bmdlbiB6dW0gQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJncm91cHNcIjogXCJHcnVwcGVuXCIsXG4gICAgICAgIFwiZ3JvdXBpbmZvXCI6IFwiU2NoXHUwMEZDbGVyOmlubmVuIGluIHp3ZWkgR3J1cHBlbiBhdWZ0ZWlsZW5cIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXJ3ZWl0ZXJ0ZSBFaW5zdGVsbHVuZ2VuXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcInNwZWljaGVyblwiLFxuICAgICAgICBcImRpc2FibGVkXCI6IFwiZGVha3RpdmllcnRcIixcbiAgICAgICAgXCJvY3JpbmZvXCI6XCJBa3R1ZWxsZSBQclx1MDBGQ2Z1bmdzLVBJTiBpbSBTY3JlZW5zaG90IGVya2VubmVuXCIsXG4gICAgICAgIFwiYmlwaW5mb1wiOiBcIkJpUC1TdGF0dXMgZ2lidCBhbiBvYiBzaWNoIGF1dGhlbnRpZml6aWVydGUgQ2xpZW50cyB2ZXJiaW5kZW4ga1x1MDBGNm5uZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjogXCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImFjdGl2YXRlc2VjdGlvbnNcIjogXCJQclx1MDBGQ2Z1bmdzYWJzY2huaXR0ZSBha3RpdmllcmVuXCIsXG4gICAgICAgIFwiZXhhbXNlY3Rpb25zXCI6IFwiUHJcdTAwRkNmdW5nc2Fic2Nobml0dGVcIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNpbmZvXCI6IFwiU2llIGJlZmluZGVuIHNpY2ggaW0gYWJnZXNpY2hlcnRlbiBNb2R1cy4gU29sbCBkaWVzZXIgUHJcdTAwRkNmdW5nc2Fic2Nobml0dCBmXHUwMEZDciBhbGxlIHZlcmJ1bmRlbmVuIENsaWVudHMgYWt0aXZpZXJ0IHdlcmRlbj9cIixcbiAgICAgICAgXCJub1wiOlwiTmVpblwiLFxuICAgICAgICBcInllc1wiOlwiSmFcIixcbiAgICAgICAgXCJleGFtbW9kZVwiOlwiUHJcdTAwRkNmdW5nc21vZHVzXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6XCJQclx1MDBGQ2Z1bmdzbWF0ZXJpYWxpZW5cIixcbiAgICAgICAgXCJkZWZpbmVtYXRlcmlhbHNcIjpcIk1hdGVyaWFsaWVuIGZlc3RsZWdlbiBkaWUgd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgdmVyZlx1MDBGQ2diYXIgc2VpbiBzb2xsZW5cIixcbiAgICAgICAgXCJwcm9jZXNzaW5nZmlsZXNcIjpcIk1hdGVyaWFsaWVuIHdlcmRlbiB2ZXJhcmJlaXRldFwiLFxuICAgICAgICBcImZvbnRzaXpldGl0bGVcIjogXCJTY2hyaWZ0Z3JcdTAwRjZcdTAwREZlIGltIFBERlwiLFxuICAgICAgICBcImZvbnRzaXplXCI6IFwiU2NocmlmdGdyXHUwMEY2XHUwMERGZVwiLFxuICAgICAgICBcInJlbW92ZWZpbGVcIjogXCJEYXRlaSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJyZW1vdmVmaWxlY29uZmlybVwiOiBcIldvbGxlbiBTaWUgZGllIERhdGVpIHdpcmtsaWNoIGxcdTAwRjZzY2hlbj9cIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZVwiOiBcIkFic2Nobml0dHNuYW1lXCIsXG4gICAgICAgIFwic2VjdGlvbm5hbWVpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmVuIE5hbWVuIGZcdTAwRkNyIGRpZXNlbiBBYnNjaG5pdHQgZWluXCIsXG4gICAgICAgIFwiZ3JvdXBBXCI6IFwiR3J1cHBlIEFcIixcbiAgICAgICAgXCJncm91cEJcIjogXCJHcnVwcGUgQlwiLFxuICAgICAgICBcImFsbG93ZWRVUkxcIjogXCJFcmxhdWJ0ZSBVUkxcIixcbiAgICAgICAgXCJhbGxvd2VkVVJMaW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIFVSTCBlaW4sIGRpZSB3XHUwMEU0aHJlbmQgZGVyIFByXHUwMEZDZnVuZyBlcmxhdWJ0IGlzdFwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NfbW9kZVwiOiBcIkVyd2VpdGVydGUgRWluc3RlbGx1bmdlbiB6dW0gUHJcdTAwRkNmdW5nc21vZHVzXCIsXG4gICAgICAgIFwicmRwXCI6IFwiV2ViIFJEUFwiLFxuICAgICAgICBcInJkcGNvbmZpZ1wiOiBcIlJEUCBLb25maWd1cmF0aW9uXCIsXG4gICAgICAgIFwicmRwY29uZmlnaW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBkaWUgRG9tYWluKFVSTCkgZGVzIFJEUC1TZXJ2ZXJzIGVpblwiLFxuICAgICAgICBcIm11dGVhdWRpb1wiOiBcIkF1ZGlvIHN0dW1tc2NoYWx0ZW5cIixcbiAgICAgICAgXCJtdXRlYXVkaW9pbnRyb1wiOiBcIldlbm4gZGllc2UgT3B0aW9uIGFrdGl2aWVydCBpc3QsIHdlcmRlbiBha3VzdGlzY2hlIFNpZ25hbGUgd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgbmljaHQgYWJnZXNwaWVsdFwiLFxuICAgICAgICBcInNob3dzdWJtaXNzaW9uXCI6IFwiQWJnYWJlIGFuemVpZ2VuXCIsXG4gICAgICAgIFwic3R1ZGVudGluZm9cIjogXCJEZXRhaWxzIHZvbiBTY2hcdTAwRkNsZXI6aW4gYW56ZWlnZW5cIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZGluZm9cIjogXCJEaWUgUHJcdTAwRkNmdW5nc3VtZ2VidW5nIHdpcmQgbVx1MDBGNmdsaWNoZXJ3ZWlzZSBpbiBlaW5lciB2aXJ0dWVsbGVuIE1hc2NoaW5lIGF1c2dlZlx1MDBGQ2hydFwiLFxuICAgICAgICBcImxlZnRraW9za2luZm9cIjogXCJFcyB3dXJkZSB2ZXJzdWNodCBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB6dSB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RpbmZvXCI6IFwiU2ljaGVydW5nZW4gd3VyZGVuIGFuZ2Vmb3JkZXJ0XCIsXG4gICAgICAgIFwicmVtb3RlYXNzaXN0YW50aW5mb1wiOiBcIlJlbW90ZSBBc3Npc3RhbnQgU29mdHdhcmUgbFx1MDBFNHVmdCBtXHUwMEY2Z2xpY2hlcndlaXNlIGFtIFNjaFx1MDBGQ2xlcjppbm5lbi1HZXJcdTAwRTR0XCIsXG4gICAgICAgIFwiZG9jdW1lbnRzaW5mb1wiOiBcIkRva3VtZW50ZSBhdWYgZGVtIFNjaFx1MDBGQ2xlcjppbm5lbi1HZXJcdTAwRTR0OiBcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmdcIjogXCJEYXRlaWdyXHUwMEY2XHUwMERGZVwiLFxuICAgICAgICBcImZpbGVzaXpld2FybmluZ3RleHRcIjogXCJ7ZmlsZW5hbWV9IGlzdCBnclx1MDBGNlx1MDBERmVyIGFscyA4IE1CICh7c2l6ZX0gTUIpLiBHcm9cdTAwREZlIERhdGVpZW4ga1x1MDBGNm5uZW4gZGllIFx1MDBEQ2JlcnRyYWd1bmcgdmVybGFuZ3NhbWVuLlwiLFxuICAgICAgICBcIm5vcHJpbnRlckNob3NlblwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lbiBEcnVja2VyXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcIkRhcyBUb2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImludmFsaWRyZWdpc3RyYXRpb25cIjogXCJLZWluZSBSZWdpc3RyaWVydW5nIHZvcmdlZnVuZGVuXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgZ2VcdTAwRTRuZGVydFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIHVudGVyIGRpZXNlbSBOYW1lbiBiZXJlaXRzIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNcIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIGV4aXN0aWVydCBiZXJlaXRzXCIsXG4gICAgICAgIFwic2VydmVyZXhpc3RzTEFOXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBleGlzdGllcnQgYmVyZWl0cyBpbSBsb2tsZW4gTmV0endlcmtcIixcbiAgICAgICAgXCJzZXJ2ZXJzdGFydGVkXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJzZXJ2ZXJzdG9wcGVkXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBiZWVuZGV0XCIsXG4gICAgICAgIFwibm90Zm91bmRcIjogXCJQclx1MDBGQ2Z1bmcgZXhpc3RpZXJ0IG5pY2h0XCIsXG4gICAgICAgIFwid3Jvbmdwd1wiOiBcIlBhc3N3b3J0IGZhbHNjaFwiLFxuICAgICAgICBcIndyb25ncGluXCI6IFwiRmFsc2NoZXIgUElOXCIsXG4gICAgICAgIFwiY29ycmVjdHB3XCI6IFwiUGFzc3dvcnQgT0tcIixcbiAgICAgICAgXCJzdHVkZW50cmVtb3ZlXCI6IFwiU2NoXHUwMEZDbGVyOmluIHZvbiBQclx1MDBGQ2Z1bmdzc2VydmVyIGVudGZlcm50XCIsXG4gICAgICAgIFwiYWN0aW9uZGVuaWVkXCI6IFwiQWt0aW9uIHZlcmJvdGVuXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwic3R1ZGVudHVwZGF0ZVwiOiBcIlNjaFx1MDBGQ2xlcmRhdGVuIGFrdHVhbGlzaWVydFwiLFxuICAgICAgICBcInN0dWRlbnRsZWZ0XCI6IFwiU2NoXHUwMEZDbGVyOmluIGhhdCBkZW4gUHJcdTAwRkNmdW5nc3NlcnZlciB2ZXJsYXNzZW5cIixcbiAgICAgICAgXCJzdGF0ZXJlc3RvcmVcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgd2llZGVyaGVyZ2VzdGVsbHRcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcIjogRGllIFByXHUwMEZDZnVuZ3N1bWdlYnVuZyB3aXJkIGluIGVpbmVyIHZpcnR1ZWxsZW4gTWFzY2hpbmUgYXVzZ2VmXHUwMEZDaHJ0XCIsXG4gICAgICAgIFwidmVyc2lvbm1pc21hdGNoXCI6IFwiRGllIFByb2dyYW1tdmVyc2lvbmVuIHN0aW1tZW4gbmljaHQgXHUwMEZDYmVyZWluXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjogXCJTaWNoZXJ1bmdlbiB3dXJkZW4gYW5nZWZvcmRlcnRcIixcbiAgICAgICAgXCJiaXByZXF1aXJlZFwiOiBcIkRpZXMgZXJ6d2luZ3QgZGllIEF1dGhlbnRpZml6aWVydW5nIGRlciBTY2hcdTAwRkNsZXI6aW5uZW4gZHVyY2ggZGFzIEJpbGR1bmdzcG9ydGFsLlwiLFxuICAgICAgICBcInN1Ym1pc3Npb25mYWlsZWRcIjogXCJBYmdhYmUgZmVobGdlc2NobGFnZW4hXCIsXG4gICAgICAgIFwic3VibWlzc2lvbnNcIjogXCJBYmdhYmVuXCJcblxuXG4gICAgfSwgIFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImRlbmllZFwiOiBcIlp1Z3JpZmYgdmVyd2VpZ2VydFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIktlaW5lIFNjaFx1MDBGQ2xlcjppbm5lbiB2ZXJidW5kZW5cIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJEYXRlaWVuIGdlc2VuZGV0XCIsXG4gICAgICAgIFwiY291bGRub3RzdG9yZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBrb25udGUgZGllIERhdGVpIG5pY2h0IHNwZWljaGVyblwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcIkRhdGVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwibm9maWxlcmVjZWl2ZWRcIjogXCJLZWluZSBEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmRlbGV0ZWRcIjogXCJnZWxcdTAwRjZzY2h0XCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwibGVzZW4gZGVyIERhdGVpIGZlaGxnZXNjaGxhZ2VuXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJNXHUwMEY2Z2xpY2hlcndlaXNlIGdlc2Nhbm50ZXMgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIkF1ZlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwid3VyZGVuIHdlbmlnZXIgYWxzIDIgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZ2VmdW5kZW4uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiRGllcyBkZXV0ZXQgZGFyYXVmIGhpbiwgZGFzcyBlcyBzaWNoIHVtIGVpbiBnZXNjYW5udGVzIFBERiBoYW5kZWx0LCBkYXMga2VpbmUgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciBvZGVyIFRhYmVsbGVuIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVmVyc3RhbmRlblwiLFxuICAgICAgICBcInBhZ2VcIjogXCJTZWl0ZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiU2VpdGVuXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzXCI6IFwiQml0dGUgXHUwMEZDYmVycHJcdTAwRkNmZW4gU2llIGRpZSBEYXJzdGVsbHVuZyB1bmQgUG9zaXRpb25pZXJ1bmcgZGVyIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgdm9yIGRlbSBTdGFydCBkZXIgUHJcdTAwRkNmdW5nIVwiLFxuICAgICAgICBcImVkaXRcIjogXCJCZWFyYmVpdGVuXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcIlNwZWljaGVyblwiXG4gICAgfVxufVxuIiwgImltcG9ydCB7IExvZ0xldmVsLCBQdWJsaWNDbGllbnRBcHBsaWNhdGlvbiB9IGZyb20gJ0BhenVyZS9tc2FsLWJyb3dzZXInO1xuXG4vLyBDb25maWcgb2JqZWN0IHRvIGJlIHBhc3NlZCB0byBNc2FsIG9uIGNyZWF0aW9uXG5leHBvcnQgY29uc3QgbXNhbENvbmZpZyA9IHtcbiAgYXV0aDoge1xuICAgIGNsaWVudElkOiAnYzk1MmVkZGUtZDdjMi00MjgxLWE4NDYtMDM0ZmIwMzllMWY1JyxcbiAgICBhdXRob3JpdHk6ICdodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uJyxcbiAgICByZWRpcmVjdFVyaTogJ2h0dHBzOi8vbG9jYWxob3N0OjIyNDIyL3NlcnZlci9jb250cm9sL21zYXV0aCcsXG4gICAgcG9zdExvZ291dFJlZGlyZWN0VXJpOiAnaHR0cHM6Ly9sb2NhbGhvc3Q6MjI0MjIvc2VydmVyL2NvbnRyb2wvbXNhdXRoJ1xuICB9LFxuICBjYWNoZToge1xuICAgIGNhY2hlTG9jYXRpb246ICdsb2NhbFN0b3JhZ2UnXG4gIH0sXG4gIHN5c3RlbToge1xuICAgICAgbG9nZ2VyT3B0aW9uczoge1xuICAgICAgICAgIGxvZ2dlckNhbGxiYWNrOiAobGV2ZWw6IExvZ0xldmVsLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRhaW5zUGlpOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChjb250YWluc1BpaSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHN3aXRjaCAobGV2ZWwpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuRXJyb3I6XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICBjYXNlIExvZ0xldmVsLkluZm86XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuVmVyYm9zZTpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmRlYnVnKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuV2FybmluZzpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvZ0xldmVsOiBMb2dMZXZlbC5WZXJib3NlXG4gICAgICB9XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBtc2FsSW5zdGFuY2UgPSBuZXcgUHVibGljQ2xpZW50QXBwbGljYXRpb24obXNhbENvbmZpZyk7XG5cbi8vIEFkZCBoZXJlIHNjb3BlcyBmb3IgaWQgdG9rZW4gdG8gYmUgdXNlZCBhdCBNUyBJZGVudGl0eSBQbGF0Zm9ybSBlbmRwb2ludHMuXG5leHBvcnQgY29uc3QgbG9naW5SZXF1ZXN0ID0ge1xuICBzY29wZXM6IFsnVXNlci5SZWFkJywnb3BlbmlkJywgJ3Byb2ZpbGUnLCAnb2ZmbGluZV9hY2Nlc3MnLCAnRmlsZXMuUmVhZCcsICdGaWxlcy5SZWFkV3JpdGUnLCdGaWxlcy5SZWFkV3JpdGUuQXBwRm9sZGVyJ10sXG59O1xuXG4vLyBBZGQgaGVyZSB0aGUgZW5kcG9pbnRzIGZvciBNUyBHcmFwaCBBUEkgc2VydmljZXMgeW91IHdvdWxkIGxpa2UgdG8gdXNlLlxuZXhwb3J0IGNvbnN0IGdyYXBoQ29uZmlnID0ge1xuICBncmFwaE1lRW5kcG9pbnQ6ICdodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20vdjEuMC9tZScsXG59O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBkaWFsb2csIHNjcmVlbiB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWVcblxuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMubWFpbndpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuYXV0aHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdFNlcnZlciA9IG51bGxcbiAgICAgXG4gIFxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgIH1cblxuXG5cblxuICAgIGNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpIHtcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTIwMCxcbiAgICAgICAgICAgIGhlaWdodDo5MjAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwiZGlkLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2lsbC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7ICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGxvZy5pbmZvKFwibmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ0YXJnZXQ6IF9ibGFua1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtcmVkaXJlY3QnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ1JlZGlyZWN0aW5nIHRvOicsIHVybCk7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgZGllIFVSTCBkYXMgZ2V3XHUwMEZDbnNjaHRlIEZvcm1hdCBoYXRcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnYmlsZHVuZ3Nwb3J0YWw6Ly8nKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcnQgZGVuIFN0YW5kYXJkLVJlZGlyZWN0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gJ2JpbGR1bmdzcG9ydGFsOi8vdG9rZW49JztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdXJsLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8odG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiaXBUb2tlbicsIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGNyZWF0ZVdpbmRvdygpIHtcbiAgICAgICAgY29uc3QgcHJpbWFyeURpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA4MDAgfVxuICAgICAgICBjb25zdCBjdXJyZW50RGlyID0gZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuJywgaW1wb3J0Lm1ldGEudXJsKSlcblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbS1UZWFjaGVyJyxcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogJyMyZTJjMjknLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOiB0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBtaW5XaWR0aDogMTIwMCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogODAwLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVJcbiAgICAgICAgICAgICAgICAgICAgPyBwYXRoLnJlc29sdmUoY3VycmVudERpciwgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTiB8fCAnLmNqcycpKSlcbiAgICAgICAgICAgICAgICAgICAgOiBqb2luKF9fZGlybmFtZSwgJy4uL3ByZWxvYWQvcHJlbG9hZC5tanMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogZGlkLWZpbmlzaC1sb2FkIC0gc2hvd2luZyB3aW5kb3cnKVxuICAgICAgICAgICAgaWYgKHRoaXMubWFpbndpbmRvdyAmJiAhdGhpcy5tYWlud2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LnNob3coKVxuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbJ0RFQlVHJ10pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi9yZW5kZXJlci9pbmRleC5odG1sJylcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IHByb2Nlc3MuZW52LkFQUF9VUkwgfHwgYGh0dHA6Ly8ke3Byb2Nlc3MuZW52WydWSVRFX0RFVl9TRVJWRVJfSE9TVCddIHx8ICdsb2NhbGhvc3QnfToke3Byb2Nlc3MuZW52WydWSVRFX0RFVl9TRVJWRVJfUE9SVCddIHx8ICc5MzAwJ31gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogTG9hZGluZyBVUkw6ICR7dXJsfWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICBcbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4ge1xuICAgICAgICAgICAgdmFyIHsgaG9zdG5hbWUsIGNlcnRpZmljYXRlLCB2YWxpZGF0ZWRDZXJ0aWZpY2F0ZSwgdmVyaWZpY2F0aW9uUmVzdWx0LCBlcnJvckNvZGUgfSA9IHJlcXVlc3Q7XG4gICAgICAgICAgICBjYWxsYmFjaygwKTtcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIFxuICAgICAgICAvLyBTaG93IHdpbmRvdyBldmVuIGlmIGxvYWRpbmcgZmFpbHMgKEVsZWN0cm9uIDM5IGNvbXBhdGliaWxpdHkpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lKSA9PiB7XG4gICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogZGlkLWZhaWwtbG9hZCAtIEVycm9yICR7ZXJyb3JDb2RlfTogJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKVxuICAgICAgICAgICAgLy8gU3RpbGwgc2hvdyB0aGUgd2luZG93IGV2ZW4gaWYgbG9hZGluZyBmYWlsZWRcbiAgICAgICAgICAgIGlmICh0aGlzLm1haW53aW5kb3cgJiYgIXRoaXMubWFpbndpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBTaG93aW5nIHdpbmRvdyBhZnRlciBkaWQtZmFpbC1sb2FkJylcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuc2hvdygpXG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gbWFpbndpbmRvdy53ZWJDb250ZW50cyB0byBhdm9pZCBhbnkgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGFwcCBleGNlcHQgZm9yIGludGVybmFsIGxpbmtzXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBhcHBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAvLyBQcmV2ZW50IG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubWFpbndpbmRvdz8ud2ViQ29udGVudHMuZ2V0VVJMKCkuaW5jbHVkZXMoXCJkYXNoYm9hcmRcIikpIHtcbiAgICAgICAgICAgICAgICAvLyBkbyBub3QgY2xvc2UgYSBydW5uaW5nIGV4YW0gYnkgYWNjaWRlbnQgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY2xvc2U6IGRvIG5vdCBjbG9zZSBydW5uaW5nIGV4YW0gdGhpcyB3YXlcIik7IGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgZGlhbG9nLnNob3dNZXNzYWdlQm94U3luYyh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luZm8nLCBcbiAgICAgICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLCAvLyBOdXIgZWluIEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0SWQ6IDAsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJcdTAwRkNmdW5nIGxcdTAwRTR1ZnQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQmVlbmRlbiBTaWUgenVlcnN0IGRpZSBsYXVmZW5kZSBQclx1MDBGQ2Z1bmchJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBNaWNyb3NvZnQgMzY1IEF1dGggV2luZG93IFxuICAgICAqL1xuICAgIGNyZWF0ZU1zYXV0aFdpbmRvdygpIHtcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgY2VudGVyOiB0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdPQXV0aCcsXG4gICAgICAgICAgICB3aWR0aDogNTAwLFxuICAgICAgICAgICAgaGVpZ2h0OiA4MDAsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVJcbiAgICAgICAgICAgICAgICAgICAgPyBwYXRoLnJlc29sdmUoY3VycmVudERpciwgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTiB8fCAnLmNqcycpKSlcbiAgICAgICAgICAgICAgICAgICAgOiBqb2luKF9fZGlybmFtZSwgJy4uL3ByZWxvYWQvcHJlbG9hZC5tanMnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIFxuICAgICAgICBsZXQgdXJsID0gYGh0dHBzOi8vbG9jYWxob3N0OjIyNDIyL3NlcnZlci9jb250cm9sL29hdXRoYFxuICAgICAgICB0aGlzLmF1dGh3aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5hdXRod2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmF1dGh3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0aHdpbmRvdyAmJiAhdGhpcy5hdXRod2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdXRod2luZG93LnJlbW92ZU1lbnUoKSBcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cuc2V0TWluaW1pemFibGUoZmFsc2UpXG4gICAgICAgICAgICAgICAgdGhpcy5hdXRod2luZG93LnNob3coKVxuICAgICAgICAgICAgICAgIHRoaXMuYXV0aHdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgV2luZG93SGFuZGxlcigpXG4gIiwgIlxuLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgUm91dGVyIH0gZnJvbSAnZXhwcmVzcydcbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpXG5pbXBvcnQgcGF0aCAgZnJvbSAncGF0aCdcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9jb25maWcuanMnXG5pbXBvcnQgZnMgZnJvbSAnZnMnIFxuaW1wb3J0IGV4dHJhY3QgZnJvbSAnZXh0cmFjdC16aXAnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3QgeyB0IH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0IGFyY2hpdmVyIGZyb20gJ2FyY2hpdmVyJ1xuaW1wb3J0IHsgUERGRG9jdW1lbnQsIHJnYiB9IGZyb20gJ3BkZi1saWIvZGlzdC9wZGYtbGliLmpzJyAgLy8gd2UgaW1wb3J0IHRoZSBjb21wbGllZCB2ZXJzaW9uIG90aGVyd2lzZSB3ZSBnZXQgMTAwMCBzb3VyY2VtYXAgd2FybmluZ3NcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50JztcbmltcG9ydCBwZGYgZnJvbSAnQGJpbmdzanMvcGRmLXBhcnNlJztcblxuXG4vKipcbiAqIEdFVCBhIEZJTEUtTElTVCBmcm9tIHdvcmtkaXJlY3RvcnlcbiAqLyBcbiByb3V0ZXIucG9zdCgnL2dldGZpbGVzLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBkaXIgPXJlcS5ib2R5LmRpclxuICAgIFxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG4gICBcbiAgICBsZXQgZm9sZGVycyA9IFtdXG4gICAgZm9sZGVycy5wdXNoKCB7Y3VycmVudGRpcmVjdG9yeTogZGlyLCBwYXJlbnRkaXJlY3Rvcnk6IHBhdGguZGlybmFtZShkaXIpfSkgLy8gc28gdGhpcyBpbmZvcm1hdGlvbiBpcyBhbHdheXMgb24gZmlsZWxpc3RbMF0gPj4gbm90IHRoZSBtb3N0IHJvYnVzdCBpZGVhIGJ1dCB1c2VkIGluIGZpbGVleHBsb3JlciAtIGJlIGNhcmVmdWxcbiAgICBcbiAgICBjb25zdCBvbWl0RXh0ZW5zaW9ucyA9IFsnLmpzb24nXTsgICAvLyB0aGVzZSBmaWxldHlwZXMgYXJlIG5vdCBwYXJ0IG9mIHRoZSBmaWxlbGlzdCBzZW50IHRvIHRoZSBmcm9udGVuZCAodXNlZCB0byBkaXNwbGF5IHRoZSB1c2VyIGRpcmVjdG9yaWVzIGluIHRoZSBmaWxlZXhwbG9yZXIgcGFydCBvZiB0aGUgZGFzaGJvYXJkKVxuICAgIFxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsZXMgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkZGlyKGRpcik7XG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgY29uc3QgZmlsZXBhdGggPSBwYXRoLmpvaW4oZGlyLCBmaWxlKTtcbiAgICAgICAgICAgIGxldCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnByb21pc2VzLnN0YXQoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvbGRlcnMucHVzaCh7IHBhdGg6IGZpbGVwYXRoLCBuYW1lOiBmaWxlLCB0eXBlOiBcImRpclwiLCBleHQ6IFwiXCIsIHBhcmVudDogZGlyIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzdGF0cy5pc0ZpbGUoKSAmJiAhb21pdEV4dGVuc2lvbnMuaW5jbHVkZXMoZXh0KSkge1xuICAgICAgICAgICAgICAgICAgICBmb2xkZXJzLnB1c2goeyBwYXRoOiBmaWxlcGF0aCwgbmFtZTogZmlsZSwgdHlwZTogXCJmaWxlXCIsIGV4dDogZXh0LCBwYXJlbnQ6IGRpciB9KTsgLy8gS29ycmlnaWVydCBgcGFyZW50OiAnJ2AgenUgYHBhcmVudDogZGlyYCBmXHUwMEZDciBLb25zaXN0ZW56XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoaW5uZXJFcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWhhbmRlbG4gU2llIEZlaGxlciwgZGllIHZvbiBmcy5wcm9taXNlcy5zdGF0IGdld29yZmVuIHdlcmRlblxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJkYXRhIEAgZ2V0ZmlsZXM6IEZlaGxlciBiZWltIFp1Z3JpZmYgYXVmIERhdGVpIG9kZXIgVmVyemVpY2huaXM6IFwiLCBpbm5lckVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gQmVoYW5kZWxuIFNpZSBGZWhsZXIsIGRpZSB2b24gZnMucHJvbWlzZXMucmVhZGRpciBnZXdvcmZlbiB3ZXJkZW5cbiAgICAgICAgY29uc29sZS5lcnJvcihcImRhdGEgQCBnZXRmaWxlczogRmVobGVyIGJlaW0gTGVzZW4gZGVzIFZlcnplaWNobmlzc2VzOiBcIiwgZXJyKTtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IHQoXCJkYXRhLmZpbGVlcnJvclwiKSB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcy5zZW5kKCBmb2xkZXJzIClcbn0pXG5cblxuXG5cblxuLyoqXG4gKiBDUkVBVEUgQ09NQklORUQgUERGIFNUQVJUID4+Pj4+Pj4+Pj4+Pj4+Pj4+PlxuICovXG5cblxuXG4vKipcbiAqIEdFVCBhIGxhdGVzdCB3b3JrIGZyb20gYWxsIHN0dWRlbnRzXG4gKiBUaGlzIEFQSSBSb3V0ZSBjcmVhdGVzIGEgbGlzdCBvZiB0aGUgbGF0ZXN0IHBkZiBmaWxlcGF0aHMgb2YgYWxsIGNvbm5lY3RlZCBzdHVkZW50c1xuICogYW5kIGNvbmNhdHMgZWFjaCBvZiB0aGUgcGRmcyB0byBvbmVcbiAqLyBcbiByb3V0ZXIucG9zdCgnL2dldGxhdGVzdC86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3Qgc3VibWlzc2lvbnMgPSByZXEuYm9keS5zdWJtaXNzaW9uc1xuICAgIGxldCB3YXJuaW5nID0gZmFsc2VcblxuICAgIC8vIGNoZWNrIGlmIHRoaXMgaXMgYSBsZWdpdCBjYWxsIGZyb20gdGhlIHRlYWNoZXIgZnJvbnRlbmRcbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuXG5cbiAgICAgICBcblxuICAgIC8vY3JlYXRlIGFycmF5IHRoYXQgY29udGFpbnMgb25seSBmaWxlcGF0aHNcbiAgICAvLyB3ZSBpdGVyYXRlIG92ZXIgdGhlIHN1Ym1pc3Npb25zIGFycmF5IGFuZCBnZXQgdGhlIGxhdGVzdCBmaWxlcGF0aHMgZm9yIGVhY2ggc2VjdGlvblxuICAgIGxldCBsYXRlc3RGaWxlcyA9IFtdXG4gICAgZm9yIChsZXQgc3R1ZGVudCBvZiBzdWJtaXNzaW9ucykge1xuICAgICAgICBmb3IgKGxldCBzZWN0aW9uID0gMTsgc2VjdGlvbiA8PSA0OyBzZWN0aW9uKyspIHtcbiAgICAgICAgICAgIGlmIChzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgpe1xuICAgICAgICAgICAgICAgIGxhdGVzdEZpbGVzLnB1c2goc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5wYXRoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKFwiZGF0YSBAIGdldGxhdGVzdDogbGF0ZXN0RmlsZXNcIiwgbGF0ZXN0RmlsZXMpXG5cbiAgICAvLyBub3cgY3JlYXRlIG9uZSBtZXJnZWQgcGRmIG91dCBvZiBhbGwgZmlsZXNcbiAgICBpZiAobGF0ZXN0RmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7d2FybmluZzogd2FybmluZywgcGRmQnVmZmVyOiBudWxsfSlcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxldCBpbmRleFBERmRhdGEgPSBhd2FpdCBjcmVhdGVJbmRleFBERihzdWJtaXNzaW9ucywgc2VydmVybmFtZSkgICAvL2NvbnRhaW5zIHRoZSBpbmRleCB0YWJsZSBwZGYgYXMgdWludDhhcnJheVxuICAgICAgICBsZXQgaW5kZXhQREZwYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsXCJpbmRleC5wZGZcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShpbmRleFBERnBhdGgsIGluZGV4UERGZGF0YSk7XG4gICAgICAgICAgICBsb2cuaW5mbygnZGF0YSBAIGdldGxhdGVzdDogSW5kZXggUERGIHNhdmVkIHN1Y2Nlc3NmdWxseSEnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe2xvZy5lcnJvcihcImRhdGEgQCBnZXRsYXRlc3Q6XCIsZXJyKX1cbiAgICAgICAgbGF0ZXN0RmlsZXMudW5zaGlmdChpbmRleFBERnBhdGgpXG5cblxuICAgICAgICAvLyBub3cgY29uY2F0IHRoZSBwZGZzIG9mIGFsbCBzZWN0aW9ucyB0byBvbmUgY29tYmluZWQgcGRmXG4gICAgICAgIGxldCBQREYgPSBhd2FpdCBjb25jYXRQYWdlcyhsYXRlc3RGaWxlcylcbiAgICAgICAgbGV0IHBkZkJ1ZmZlciA9IEJ1ZmZlci5mcm9tKFBERikgXG4gICAgICAgIGxldCBwZGZQYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsXCJjb21iaW5lZC5wZGZcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShwZGZQYXRoLCBwZGZCdWZmZXIpO1xuICAgICAgICAgICAgbG9nLmluZm8oJ2RhdGEgQCBnZXRsYXRlc3Q6IFBERiBzYXZlZCBzdWNjZXNzZnVsbHkhJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtsb2cuZXJyb3IoXCJkYXRhIEAgZ2V0bGF0ZXN0OlwiLGVycil9XG4gICAgICAgIHJldHVybiByZXMuanNvbih7d2FybmluZzogd2FybmluZywgcGRmQnVmZmVyOnBkZkJ1ZmZlciwgcGRmUGF0aDpwZGZQYXRoIH0pO1xuICAgIH1cbn0pXG5cblxuXG5cblxuXG5cblxuXG5cbmZ1bmN0aW9uIGlzVmFsaWRQZGYoZGF0YSkge1xuICAgIGNvbnN0IGhlYWRlciA9IG5ldyBVaW50OEFycmF5KGRhdGEsIDAsIDUpOyAvLyBMZXNlIGRpZSBlcnN0ZW4gNSBCeXRlcyBmXHUwMEZDciBcIiVQREYtXCJcbiAgICAvLyBVbXdhbmRsdW5nIGRlciBCeXRlcyBpbiBIZXhhZGV6aW1hbHdlcnRlIGZcdTAwRkNyIGRlbiBWZXJnbGVpY2hcbiAgICBjb25zdCBwZGZIZWFkZXIgPSBbMHgyNSwgMHg1MCwgMHg0NCwgMHg0NiwgMHgyRF07IC8vIFwiJVBERi1cIiBpbiBIZXhcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBkZkhlYWRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaGVhZGVyW2ldICE9PSBwZGZIZWFkZXJbaV0pIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdkYXRhIEAgaXNWYWxpZFBkZjogaW52YWxpZCBQREYgcHJvY2Vzc2VkJylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gRnJcdTAwRkNoZXIgQWJicnVjaCwgd2VubiBlaW4gQnl0ZSBuaWNodCBcdTAwRkNiZXJlaW5zdGltbXRcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTsgLy8gQWxsZSBCeXRlcyBzdGltbWVuIG1pdCBkZW0gUERGLUhlYWRlciBcdTAwRkNiZXJlaW5cbn1cblxuYXN5bmMgZnVuY3Rpb24gY291bnRDaGFyc09mUERGKHBkZlBhdGgsIHN0dWRlbnRuYW1lLCBzZXJ2ZXJuYW1lKXtcbiAgICBjb25zdCBkYXRhQnVmZmVyID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUocGRmUGF0aCk7Ly8gUmVhZCB0aGUgUERGIGZpbGVcbiAgICBsZXQgY2hhcnMgPSAwIFxuXG4gICAgaWYgKGlzVmFsaWRQZGYoZGF0YUJ1ZmZlcikpe1xuICAgICAgICBjaGFycyA9IGF3YWl0IHBkZihkYXRhQnVmZmVyKS50aGVuKCBkYXRhID0+IHsgICAgLy8gUGFyc2UgdGhlIFBERiAgLy8gZGF0YS50ZXh0IGNvbnRhaW5zIGFsbCB0aGUgdGV4dCBleHRyYWN0ZWQgZnJvbSB0aGUgUERGXG4gICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnRleHQgJiYgc3R1ZGVudG5hbWUpIHsgICBcbiAgICAgICAgICAgICAgICBsZXQgbnVtYmVyT2ZDaGFyYWN0ZXJzID0gZGF0YS50ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGBOdW1iZXIgb2YgY2hhcmFjdGVycyBpbiB0aGUgUERGOiAke251bWJlck9mQ2hhcmFjdGVyc31gLCBzdHVkZW50bmFtZSwgc2VydmVybmFtZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgaGVhZGVyID0gYCAke3NlcnZlcm5hbWV9IHwgMTAuMTAuMjQsIDEwOjEwIGBcbiAgICAgICAgICAgICAgICBsZXQgZm9vdGVyID0gYCBaZWljaGVuOiAxMCB8IFdcdTAwRjZydGVyOiAxMCAgMS8xIGAgICAvL2FwcHJveGltYXRlbHlcblxuICAgICAgICAgICAgICAgIG51bWJlck9mQ2hhcmFjdGVycyA9IG51bWJlck9mQ2hhcmFjdGVycyAvLyAtIGhlYWRlci5sZW5ndGggLSBzdHVkZW50bmFtZS5sZW5ndGggLSBmb290ZXIubGVuZ3RoIC8vIC01IGZvciBhdmVyYWdlIG5hbWUgbGVuZ3RoICAvLyBmXHUwMEZDciBtc3dvcmQgb3B0aW9uIC0gaGllciBnaWJ0cyBrZWluZW4gaGVhZGVyXG5cblxuICAgICAgICAgICAgICAgIC8vd2UgdHJ5IHRvIGZpbHRlciBvdXQgdGhlIGltcG9ydGFudCBwYXJ0IG9mIHRoZSBkb2N1bWVudCB0aGF0IHNob3dzIHRoZSBhY3R1YWwgbnVtYmVyIG9mIGNoYXJzXG4gICAgICAgICAgICAgICAgbGV0IHJlZ2V4ID0gL1plaWNoZW46IChcXGQrKS87XG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoZXMgPSBkYXRhLnRleHQubWF0Y2gocmVnZXgpO1xuICAgICAgICAgICAgICAgIGxldCB6ZWljaGVuQW56YWhsID0gbWF0Y2hlcyA/IG1hdGNoZXNbMV0gOiBcIm5vdGZvdW5kXCI7XG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoemVpY2hlbkFuemFobCAhPT0gXCJub3Rmb3VuZFwiKXsgICAvL3dlIGZvdW5kIGl0ICFcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHplaWNoZW5BbnphaGxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4ID0gL1plaWNoZW46KFxcZCspLzsgIC8vdHJ5IHNsaWdodGx5IGRpZmZlcmVudCByZWdleCBiZWNhdXNlIHNvbWUgcGRmcyAocHJvYmFibHkgZnJvbSBtYWMpIHJlbW92ZSBzcGFjZXMgd2hlbiByZWFkXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMgPSBkYXRhLnRleHQubWF0Y2gocmVnZXgpO1xuICAgICAgICAgICAgICAgICAgICB6ZWljaGVuQW56YWhsID0gbWF0Y2hlcyA/IG1hdGNoZXNbMV0gOiBcIm5vdGZvdW5kXCI7XG4gICAgICAgICAgICAgICAgICAgIGlmICh6ZWljaGVuQW56YWhsICE9PSBcIm5vdGZvdW5kXCIpeyAgLy8gbm93IHdlIGZvdW5kIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gemVpY2hlbkFuemFobFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YS50ZXh0KVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bWJlck9mQ2hhcmFjdGVycyA+PSAwID8gYH4gJHtudW1iZXJPZkNoYXJhY3RlcnN9YCA6ICd+IDAnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDBcbiAgICAgICAgICAgIH1cbiAgICBcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiB7bG9nLmVycm9yKGBkYXRhIEAgY291bnRDaGFyc09mUERGOiAke2Vycn1gKTsgcmV0dXJuIDAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY2hhcnMgPSBcIm5vIHBkZlwiXG4gICAgfVxuIFxuICAgIHJldHVybiBjaGFycyBcbn1cblxuXG5cblxuXG5cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlSW5kZXhQREYoc3VibWlzc2lvbnMsIHNlcnZlcm5hbWUpe1xuICAgIGxldCB0YWJsZWRhdGEgPSBbW1wiTmFtZVwiLCBcIkFic2Nobml0dFwiLCBcIkRhdHVtXCIsIFwiWmVpY2hlblwiLCBcIkRhdGVpbmFtZVwiXV1cbiAgICBmb3IgKGNvbnN0IHN0dWRlbnQgb2Ygc3VibWlzc2lvbnMpe1xuICAgICAgICBsZXQgaGFzU3VibWlzc2lvbiA9IGZhbHNlIC8vIHRyYWNrIGlmIHN0dWRlbnQgaGFzIGF0IGxlYXN0IG9uZSBzdWJtaXNzaW9uXG4gICAgICAgIGNvbnN0IHRyaW1tZWROYW1lID0gc3R1ZGVudC5zdHVkZW50TmFtZS5sZW5ndGggPiAyMCA/IHN0dWRlbnQuc3R1ZGVudE5hbWUuc2xpY2UoMCwgMjApICsgXCIuLi5cIiA6IHN0dWRlbnQuc3R1ZGVudE5hbWVcbiAgICAgICAgZm9yIChsZXQgc2VjdGlvbiA9IDE7IHNlY3Rpb24gPD0gNDsgc2VjdGlvbisrKSB7XG4gICAgICAgICAgICBsZXQgbmFtZSA9IFwiLVwiXG4gICAgICAgICAgICBsZXQgc2VjdGlvbk5hbWUgPSBcIi1cIlxuICAgICAgICAgICAgbGV0IHRpbWUgPSBcIi1cIlxuICAgICAgICAgICAgbGV0IGNoYXJzID0gXCIwXCJcbiAgICAgICAgICAgIGxldCBmaWxlbmFtZSA9IFwiLVwiXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgpe1xuICAgICAgICAgICAgICAgIG5hbWUgPSB0cmltbWVkTmFtZTtcbiAgICAgICAgICAgICAgICBzZWN0aW9uTmFtZSA9IHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uc2VjdGlvbm5hbWUgfHwgYEFic2Nobml0dCAke3NlY3Rpb259YFxuICAgICAgICAgICAgICAgIHNlY3Rpb25OYW1lID0gc2VjdGlvbk5hbWUubGVuZ3RoID4gMjAgPyBzZWN0aW9uTmFtZS5zbGljZSgwLCAyMCkgKyBcIi4uLlwiIDogc2VjdGlvbk5hbWU7XG4gICAgICAgICAgICAgICAgdGltZSA9IG1vbWVudChzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLmRhdGUpLmZvcm1hdCgnREQuTU0uWVlZWSBISDptbScpXG4gICAgICAgICAgICAgICAgY2hhcnMgPSBhd2FpdCBjb3VudENoYXJzT2ZQREYoc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5wYXRoLCBzdHVkZW50LnN0dWRlbnROYW1lLCBzZXJ2ZXJuYW1lKVxuICAgICAgICAgICAgICAgIGZpbGVuYW1lID0gc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5maWxlbmFtZS5sZW5ndGggPiAyNSA/IHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uZmlsZW5hbWUuc2xpY2UoMCwgMjUpICsgXCIuLi5cIiA6IHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uZmlsZW5hbWUgO1xuICAgICAgICAgICAgICAgIHRhYmxlZGF0YS5wdXNoKFsgbmFtZSwgc2VjdGlvbk5hbWUsIHRpbWUsIGNoYXJzLCBmaWxlbmFtZSBdKVxuICAgICAgICAgICAgICAgIGhhc1N1Ym1pc3Npb24gPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFoYXNTdWJtaXNzaW9uKSB7XG4gICAgICAgICAgICB0YWJsZWRhdGEucHVzaChbIHRyaW1tZWROYW1lLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiIF0pXG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGRmRG9jID0gYXdhaXQgUERGRG9jdW1lbnQuY3JlYXRlKCk7Ly8gQ3JlYXRlIGEgbmV3IFBERkRvY3VtZW50XG4gICAgY29uc3QgcGFnZSA9IHBkZkRvYy5hZGRQYWdlKCk7IC8vIEFkZCBhIHBhZ2UgdG8gdGhlIGRvY3VtZW50XG5cbiAgICAvLyBTZXQgdXAgdGFibGUgZGltZW5zaW9ucyBhbmQgc3R5bGVzXG4gICAgY29uc3Qgc3RhcnRYID0gNTA7IC8vIFgtY29vcmRpbmF0ZSB3aGVyZSB0aGUgdGFibGUgc3RhcnRzXG4gICAgY29uc3Qgc3RhcnRZID0gcGFnZS5nZXRIZWlnaHQoKSAtIDUwOyAvLyBZLWNvb3JkaW5hdGUgd2hlcmUgdGhlIHRhYmxlIHN0YXJ0cyAoZnJvbSB0b3ApXG4gICAgY29uc3Qgcm93SGVpZ2h0ID0gMTU7IC8vIEhlaWdodCBvZiBlYWNoIHJvdyAocmVkdWNlZCBmb3Igc21hbGxlciBmb250IHNpemUpXG4gICAgY29uc3QgY29sdW1uV2lkdGhzID0gWzExMCwgMTMwLCA4MCwgNDAsIDE0MF07IC8vIFdpZHRoIG9mIGVhY2ggY29sdW1uOiBOYW1lLCBBYnNjaG5pdHQsIERhdHVtLCBaZWljaGVuLCBEYXRlaW5hbWVcblxuICAgIC8vIEZ1bmN0aW9uIHRvIGRyYXcgYSBjZWxsXG4gICAgY29uc3QgZHJhd0NlbGwgPSAoeCwgeSwgd2lkdGgsIGhlaWdodCkgPT4geyBwYWdlLmRyYXdSZWN0YW5nbGUoeyB4LCB5LCB3aWR0aCwgaGVpZ2h0LCBib3JkZXJDb2xvcjogcmdiKDAsIDAsIDApLCAgYm9yZGVyV2lkdGg6IDEsICB9KTsgIH07XG4gICAgLy8gRnVuY3Rpb24gdG8gYWRkIHRleHQgdG8gYSBjZWxsXG4gICAgY29uc3QgYWRkVGV4dCA9ICh0ZXh0LCB4LCB5KSA9PiB7ICB0ZXh0ID0gU3RyaW5nKHRleHQpOyAgICBwYWdlLmRyYXdUZXh0KHRleHQsIHsgeCwgeSwgc2l6ZTogOSwgY29sb3I6IHJnYigwLCAwLCAwKSwgIH0pOyAgfTtcblxuICAgIHRhYmxlZGF0YS5mb3JFYWNoKChyb3csIHJvd0luZGV4KSA9PiB7XG4gICAgICAgIGNvbnN0IHlQb3MgPSBzdGFydFkgLSByb3dJbmRleCAqIHJvd0hlaWdodDsgLy8gQ2FsY3VsYXRlIFkgcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IHJvd1xuICAgICAgICByb3cuZm9yRWFjaCgoY2VsbFRleHQsIGNvbHVtbkluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB4UG9zID0gc3RhcnRYICsgY29sdW1uV2lkdGhzLnNsaWNlKDAsIGNvbHVtbkluZGV4KS5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MgKyB2YWwsIDApOyAvLyBDYWxjdWxhdGUgWCBwb3NpdGlvbiBmb3IgdGhlIGN1cnJlbnQgY2VsbFxuICAgICAgICAgICAgZHJhd0NlbGwoeFBvcywgeVBvcyAtIHJvd0hlaWdodCwgY29sdW1uV2lkdGhzW2NvbHVtbkluZGV4XSwgcm93SGVpZ2h0KTtcbiAgICAgICAgICAgIGFkZFRleHQoY2VsbFRleHQsIHhQb3MgKyAzLCB5UG9zIC0gcm93SGVpZ2h0ICsgNCk7IC8vIEFkanVzdCB0ZXh0IHBvc2l0aW9uIHdpdGhpbiB0aGUgY2VsbCAocmVkdWNlZCBwYWRkaW5nIGZvciBzbWFsbGVyIHJvdyBoZWlnaHQpXG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIC8vIFNlcmlhbGl6ZSB0aGUgUERGRG9jdW1lbnQgdG8gYnl0ZXMgKGEgVWludDhBcnJheSlcbiAgICBjb25zdCBwZGZCeXRlcyA9IGF3YWl0IHBkZkRvYy5zYXZlKCk7XG4gICAgcmV0dXJuIHBkZkJ5dGVzIFxufVxuXG5cbi8qKlxuICogQ1JFQVRFIENPTUJJTkVEIFBERiBFTkQgPj4+Pj4+Pj4+Pj4+Pj4+Pj4+XG4gKi9cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5hc3luYyBmdW5jdGlvbiBjb25jYXRQYWdlcyhwZGZzVG9NZXJnZSkge1xuICAgIC8vIENyZWF0ZSBhIG5ldyBQREZEb2N1bWVudFxuICAgIGNvbnN0IHRlbXBQREYgPSBhd2FpdCBQREZEb2N1bWVudC5jcmVhdGUoKTtcbiAgICBmb3IgKGNvbnN0IHBkZnBhdGggb2YgcGRmc1RvTWVyZ2UpIHsgXG4gICAgICAgIGxldCBwZGZCeXRlcyA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKHBkZnBhdGgpO1xuICAgICAgICAvL2NoZWNrIGlmIHRoaXMgYWN0dWFsbHkgaXMgYSBwZGZcbiAgICAgICAgaWYgKGlzVmFsaWRQZGYocGRmQnl0ZXMpKXtcbiAgICAgICAgICAgIGNvbnN0IHBkZiA9IGF3YWl0IFBERkRvY3VtZW50LmxvYWQocGRmQnl0ZXMpOyBcbiAgICAgICAgICAgIGNvbnN0IGNvcGllZFBhZ2VzID0gYXdhaXQgdGVtcFBERi5jb3B5UGFnZXMocGRmLCBwZGYuZ2V0UGFnZUluZGljZXMoKSk7XG4gICAgICAgICAgICBjb3BpZWRQYWdlcy5mb3JFYWNoKChwYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGVtcFBERi5hZGRQYWdlKHBhZ2UpOyBcbiAgICAgICAgICAgIH0pOyBcbiAgICAgICAgfVxuICAgICAgIFxuICAgIH0gXG4gICAgLy8gU2VyaWFsaXplIHRoZSBQREZEb2N1bWVudCB0byBieXRlcyAoYSBVaW50OEFycmF5KVxuICAgIGNvbnN0IGZpbmFsUERGID0gYXdhaXQgdGVtcFBERi5zYXZlKClcbiAgICByZXR1cm4gZmluYWxQREZcbn1cblxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIERFTEVURSBGaWxlIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAqLyBcbiByb3V0ZXIucG9zdCgnL2RlbGV0ZS86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cblxuICBcbiAgICBjb25zdCBmaWxlcGF0aCA9IHJlcS5ib2R5LmZpbGVwYXRoXG4gICAgaWYgKGZpbGVwYXRoKSB7IC8vcmV0dXJuIHNwZWNpZmljIGZpbGVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMucHJvbWlzZXMuc3RhdChmaWxlcGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSl7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMucm0oZmlsZXBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLnVubGluayhmaWxlcGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLmZkZWxldGVkXCIpLCAgfSlcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgZGVsZXRlOlwiLCBlcnIpO1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZWVycm9yXCIpIH0pXG4gICAgICAgIH1cbiAgICB9XG59KVxuXG5cblxuXG5cbi8qKlxuICogR0VUIFBERiBmcm9tIEVYQU0gZGlyZWN0b3J5XG4gKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gKi8gXG5cbnJvdXRlci5wb3N0KCcvZ2V0cGRmLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHsgdG9rZW4sIHNlcnZlcm5hbWUgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV07XG5cbiAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgbWNTZXJ2ZXIgZXhpc3RpZXJ0IHVuZCBkZXIgVG9rZW4gXHUwMEZDYmVyZWluc3RpbW10XG4gICAgaWYgKCFtY1NlcnZlciB8fCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mbz8uc2VydmVydG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgZmlsZW5hbWUgfSA9IHJlcS5ib2R5O1xuICAgIGlmIChmaWxlbmFtZSkge1xuICAgICAgICByZXMuc2VuZEZpbGUoZmlsZW5hbWUsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzKDQwNCkuanNvbih7IHN0YXR1czogdChcImRhdGEuZmlsZWVycm9yXCIpIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBbnR3b3J0LCBmYWxscyBrZWluIERhdGVpbmFtZSBhbmdlZ2ViZW4gd3VyZGVcbiAgICAgICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLmZpbGVlcnJvclwiKSB9KTtcbiAgICB9XG59KTtcblxuXG5cblxuXG5cbi8qKlxuICogR0VUIEFOWSBGaWxlL0ZvbGRlciBmcm9tIEVYQU0gZGlyZWN0b3J5IC0gZG93bmxvYWQgIVxuICogQ2FuIGJlIHRyaWdnZXJlZCBieSBURUFDSEVSIChkYXNoYm9hcmQgZXhwbG9yZXIpIG9yIFNUVURFTlQgKGZpbGVyZXF1ZXN0KVxuICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICovIFxuIHJvdXRlci5wb3N0KCcvZG93bmxvYWQvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IHR5cGUgPSByZXEuYm9keS50eXBlICAvLyBmaWxlLCBkaXIsIHN0dWRlbnRmaWxlcmVxdWVzdFxuICAgIGNvbnN0IGZpbGVuYW1lID0gcmVxLmJvZHkuZmlsZW5hbWVcbiAgICBjb25zdCBmaWxlcGF0aCA9IHJlcS5ib2R5LnBhdGhcbiAgICBjb25zdCBmaWxlcyA9IHJlcS5ib2R5LmZpbGVzICAvLyBpbiBjYXNlIG9mIHN0dWRlbnRmaWxlcmVxdWVzdCAnZmlsZXMnIGlzIGFuIGFycmF5IG9mIGZpbGVvYmplY3RzIFsge25hbWU6ZmlsZS5uYW1lLCBwYXRoOmZpbGUucGF0aCB9LCB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0gXSBcblxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gJiYgIWNoZWNrVG9rZW4odG9rZW4sIG1jU2VydmVyICkpIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgIFxuXG4gICBcbiAgICBpZiAodHlwZSA9PT0gXCJzdHVkZW50ZmlsZXJlcXVlc3RcIikge1xuICAgICAgICAvLyBpZiB0aGlzIHJlcXVlc3QgY2FtZSBmcm9tIGEgc3R1ZGVudCByZXNldCBzdHVkZW50c3RhdHVzXG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHRva2VuKSAvLyBnZXQgc3R1ZGVudCBmcm9tIHRva2VuXG4gICAgICAgIGlmIChzdHVkZW50KSB7ICBcbiAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ10gPSBmYWxzZSAgLy9yZXNldCBmaWxlcmVxdWVzdCBzdGF0dXMgZm9yIHN0dWRlbnQgLy8gaXQgaXMgdGhlb3JldGljYWxseSBwb3NzaWJsZSB0aGF0IHRoZSBjbGllbnQgc2VuZHMgYSBzZWNvbmQgZmlsZSByZXF1ZXN0IGFuZCBmZXRjaGVzIHRoZSBmaWxlIHR3aWNlIGJlZm9yZSB0aGlzIHNldHRpbmcgaXMgcmVzZXQgYnV0IGkgZ3Vlc3MgdGhpcyBkb2VuJ3QgcmVhbGx5IG1hdHRlclxuICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBbXSAgICAgICAgICAvLyB0aGVyZXIgaXMgbm8gY29udHJvbCBzeXN0ZW0gaW4gcGxhY2UgdG8gcmUtY2hlY2sgaWYgdGhlIGZpbGUgd2FzIGFjdHVhbGx5IHJlY2VpdmVkXG4gICAgICAgICAgICByZXMuemlwKHtmaWxlczogZmlsZXN9KTsgIFxuICAgICAgICB9IFxuICAgIH0gIFxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LWRpc3Bvc2l0aW9uJywgJ2F0dGFjaG1lbnQ7IGZpbGVuYW1lPScgKyBmaWxlbmFtZSk7XG4gICAgICAgICAgICByZXMuZG93bmxvYWQoZmlsZXBhdGgpOyAgXG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT09IFwiZGlyXCIpIHtcbiAgICAgICAgLy96aXAgZm9sZGVyIGFuZCB0aGVuIHNlbmRcbiAgICAgICAgbGV0IHppcGZpbGVuYW1lID0gZmlsZW5hbWUuY29uY2F0KCcuemlwJylcbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gcGF0aC5qb2luKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgICAgIGF3YWl0IHppcERpcmVjdG9yeShmaWxlcGF0aCwgemlwZmlsZXBhdGgpXG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtZGlzcG9zaXRpb24nLCAnYXR0YWNobWVudDsgZmlsZW5hbWU9JyArIGZpbGVuYW1lKTtcbiAgICAgICAgcmVzLmRvd25sb2FkKHppcGZpbGVwYXRoLGZpbGVuYW1lKTsgXG4gICAgfVxuIFxufSlcblxuXG5cblxuXG5yb3V0ZXIucG9zdCgnL2dldGV4YW1tYXRlcmlhbHMvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IGdyb3VwID0gcmVxLmJvZHkuZ3JvdXBcblxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gJiYgIWNoZWNrVG9rZW4odG9rZW4sIG1jU2VydmVyICkpIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgIFxuXG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gdG9rZW4pIC8vIGdldCBzdHVkZW50IGZyb20gdG9rZW5cbiAgICBpZiAoc3R1ZGVudCkgeyAgXG5cbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IG1jU2VydmVyLnNlcnZlcnN0YXR1c1xuICAgICAgICBsZXQgZXhhbVNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXVxuICAgICAgICBsZXQgZ3JvdXBBID0gZXhhbVNlY3Rpb24uZ3JvdXBBXG4gICAgICAgIGxldCBncm91cEIgPSBleGFtU2VjdGlvbi5ncm91cEJcbiAgICBcbiAgICAgICAgbGV0IG1hdGVyaWFscyA9IFtdXG4gICAgICAgIGxldCBhbGxvd2VkVXJscyA9IFtdXG4gICAgICAgIGlmIChncm91cCA9PT0gXCJhXCIpIHtcbiAgICAgICAgICAgIG1hdGVyaWFscyA9IGdyb3VwQS5leGFtSW5zdHJ1Y3Rpb25GaWxlc1xuICAgICAgICAgICAgYWxsb3dlZFVybHMgPSBncm91cEEuYWxsb3dlZFVybHNcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChncm91cCA9PT0gXCJiXCIpIHtcbiAgICAgICAgICAgIG1hdGVyaWFscyA9IGdyb3VwQi5leGFtSW5zdHJ1Y3Rpb25GaWxlc1xuICAgICAgICAgICAgYWxsb3dlZFVybHMgPSBncm91cEIuYWxsb3dlZFVybHNcbiAgICAgICAgfVxuXG5cbiAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWF0ZXJpYWxzOiBtYXRlcmlhbHMsIGFsbG93ZWRVcmxzOiBhbGxvd2VkVXJscyAgfSlcbiAgICB9IFxuICAgIGVsc2Uge1xuICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpICB9KVxuICAgIH1cbiAgICBcblxuIFxufSlcblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBTdG9yZXMgZmlsZShzKSB0byB0aGUgd29ya2RpcmVjdG9yeSAoZmlsZXMgY29taW5nIEZST00gQ0xJRU5UUyAoQkFDS1VQUykgKVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gLSB0aGlzIGhhcyB0byBiZSB2YWxpZCAoY29taW5nIGZyb20gYSByZWdpc3RlcmVkIHVzZXIpIFxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIHNlcnZlci1leGFtIGluc3RhbmNlIHRoZSBzdHVkZW50cyB0b2tlbiBiZWxvbmdzIHRvXG4gKiBpbiBvcmRlciB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IC0gRE8gTk9UIFNUT1JFIEZJTEVTIENPTUlORyBmcm9tIGFueXdoZXJlLi4gYWx3YXlzIGNoZWNrIGlmIHRva2VuIGJlbG9uZ3MgdG8gYSByZWdpc3RlcmVkIHN0dWRlbnQgKG9yIHNlcnZlcilcbiAqL1xuIHJvdXRlci5wb3N0KCcvcmVjZWl2ZS86c2VydmVybmFtZS86c3R1ZGVudHRva2VuJywgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7ICBcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCB7IGZpbGUsIGZpbGVuYW1lIH0gPSByZXEuYm9keTtcbiAgICBjb25zdCBmaWxlQ29udGVudCA9IEJ1ZmZlci5mcm9tKGZpbGUsICdiYXNlNjQnKTtcblxuICAgIGlmICggIWNoZWNrVG9rZW4oc3R1ZGVudHRva2VuLCBtY1NlcnZlciApICkgeyByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxldCBlcnJvcnMgPSAwXG4gICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGxldCB0aW1lID0gbm93LnRvTG9jYWxlVGltZVN0cmluZygnZGUtREUnKTsgIC8vY29udmVydCB0byBsb2NhbGUgc3RyaW5nIG90aGVyd2lzZSB0aGUgZm9sZGVybmFtZXMgd2lsbCBiZSBjcmVhdGVkIGluIFVUQ1xuICAgICAgICBsZXQgdGltZXN0cmluZyA9IFN0cmluZyh0aW1lKS5yZXBsYWNlKC86L2csIFwiX1wiKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHllYXIgPSBub3cuZ2V0RnVsbFllYXIoKTtcbiAgICAgICAgY29uc3QgbW9udGggPSBTdHJpbmcobm93LmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpOyAvLyBNb25hdGU6IDAtMTEsIGRhaGVyICsxXG4gICAgICAgIGNvbnN0IGRheSA9IFN0cmluZyhub3cuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBjb25zdCBkYXRlU3RyaW5nID0gYCR7eWVhcn0ke21vbnRofSR7ZGF5fWA7XG4gICAgICAgIFxuICAgICAgICBsZXQgdHN0cmluZyA9IGAke2RhdGVTdHJpbmd9XyR7dGltZXN0cmluZ31gO1xuICAgICAgICBcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKSAvLyBnZXQgc3R1ZGVudCBmcm9tIHRva2VuXG4gICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgZmlsZW5hbWUpO1xuICAgICAgICBsZXQgc3R1ZGVudGRpcmVjdG9yeSA9ICBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lKVxuICAgICAgICBcbiAgICAgICAgbGV0IHN0dWRlbnRhcmNoaXZlZGlyID0gcGF0aC5qb2luKHN0dWRlbnRkaXJlY3RvcnksIHRzdHJpbmcpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihzdHVkZW50ZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHN0dWRlbnRhcmNoaXZlZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZTogXCIsIGVycilcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWxlKXtcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lLmluY2x1ZGVzKFwiLnppcFwiKSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJkYXRhIEAgcmVjZWl2ZTogUmVjZWl2ZWQgWklQIEZpbGUgZnJvbSB1c2VyOlwiLCBzdHVkZW50LmNsaWVudG5hbWUpXG4gICAgICAgICAgICAgICAgbGV0IHN1Y2Nlc3MgPSBhd2FpdCBhcmNoaXZlQW5kRXh0cmFjdFppcChhYnNvbHV0ZUZpbGVwYXRoLCBzdHVkZW50YXJjaGl2ZWRpciwgZmlsZUNvbnRlbnQpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5iYWNrdXBkaXJlY3RvcnkgJiYgc3VjY2Vzcyl7ICAgICAvLyBjb3B5IHRvIGJhY2t1cCBkaXJlY3RvcnkgLSBkbyBub3QgdW56aXAgYSBzZWNvbmQgdGltZSAtIHRoaXMgaXMgYWxyZWFkeSBkb25lIGluIGFyY2hpdmVBbmRFeHRyYWN0WmlwXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgYmFja3VwZGlyID0gIHBhdGguam9pbihjb25maWcuYmFja3VwZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgdHN0cmluZykgLy8gc2FtZSBjb25jZXB0IGFzIGluIHN0dWRlbnRhcmNoaXZlZGlyXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBkYXRhIEAgcmVjZWl2ZTogQ29weWluZyB0byBiYWNrdXAgZGlyZWN0b3J5OiAke3N0dWRlbnRhcmNoaXZlZGlyfSAtPiAgICR7YmFja3VwZGlyfSBgKVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoYmFja3VwZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLmNwKHN0dWRlbnRhcmNoaXZlZGlyLCBiYWNrdXBkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiZGF0YSBAIHJlY2VpdmU6IFwiLCBlcnIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlcmVjZWl2ZWRcIiksIGVycm9yczogZXJyb3JzICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiZGF0YSBAIHJlY2VpdmU6IE5vIFpJUCBmaWxlIHJlY2VpdmVkXCIpXG4gICAgICAgICAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCAgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLm5vZmlsZXJlY2VpdmVkXCIpLCBlcnJvcnM6IGVycm9ycyB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCAgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLm5vZmlsZXJlY2VpdmVkXCIpLCBlcnJvcnM6IGVycm9ycyB9KVxuICAgICAgICB9XG4gICAgfVxufSlcblxuXG4vKipcbiAqIFVQTE9BRFMgRmlsZXMgZnJvbSB0aGUgVGVhY2hlciBGcm9udGVuZCBhbmQgXG4gKiBzdG9yZXMgdGhlIGZpbGVzIGludG8gdGhlIHdvcmtkaXJlY3RvcnlcbiAqIHRoZW4gdXBkYXRlcyBzdHVkZW50LnN0YXR1cy5mZXRjaGZpbGVzIGluIG9yZGVyIHRvIHRyaWdnZXIgYSBmaWxlcmVxdWVzdCBmcm9tIHRoZSBzdHVkZW50KHMpIFxuICovXG5cbnJvdXRlci5wb3N0KCcvdXBsb2FkLzpzZXJ2ZXJuYW1lLzpzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7ICBcbiAgICBjb25zdCBzZXJ2ZXJ0b2tlbiA9IHJlcS5wYXJhbXMuc2VydmVydG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cblxuICAgIGlmICggc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG5cbiAgICAvLyBjcmVhdGUgdXBsb2FkcyBkaXJlY3RvcnlcbiAgICBsZXQgdXBsb2FkZGlyZWN0b3J5ID0gIHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCAnVVBMT0FEUycpXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIodXBsb2FkZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gRGlyZWN0b3J5IG1pZ2h0IGFscmVhZHkgZXhpc3QsIHRoYXQncyBva1xuICAgIH1cblxuXG4gICAgaWYgKHJlcS5maWxlcyl7XG5cbiAgICAgICAgbGV0IGZpbGVzQXJyYXkgPSBbXSAgLy8gZGVwZW5kaW5nIG9uIHRoZSBudW1iZXIgb2YgZmlsZXMgdGhpcyBjb21lcyBhcyBhcnJheSBvZiBvYmplY3RzIG9yIG9iamVjdFxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocmVxLmZpbGVzLmZpbGVzKSl7IGZpbGVzQXJyYXkucHVzaChyZXEuZmlsZXMuZmlsZXMpfVxuICAgICAgICBlbHNlIHtmaWxlc0FycmF5ID0gcmVxLmZpbGVzLmZpbGVzfVxuXG4gICAgICAgIGxldCBmaWxlcyA9IFtdICAgICAgICBcbiAgICBcbiAgICAgICAgZm9yIGF3YWl0IChsZXQgZmlsZSBvZiAgZmlsZXNBcnJheSkge1xuICAgICAgICAgICAgbGV0IGZpbGVuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KGZpbGUubmFtZSkgIC8vZW5jb2RlIHRvIHByZXZlbnQgbm9uLWFzY2lpIGNoYXJzIHdlaXJkbmVzc1xuICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBwYXRoLmpvaW4odXBsb2FkZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICBhd2FpdCBmaWxlLm12KGFic29sdXRlRmlsZXBhdGgsIChlcnIpID0+IHsgIFxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKCB0KFwiZGF0YS5jb3VsZG5vdHN0b3JlXCIpICkgfVxuICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgZmlsZXMucHVzaCh7IG5hbWU6ZmlsZW5hbWUgLCBwYXRoOmFic29sdXRlRmlsZXBhdGggfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbmZvcm0gc3R1ZGVudHMgYWJvdXQgdGhpcyBzZW5kLWZpbGUgcmVxdWVzdCBzbyB0aGF0IHRoZXkgdHJpZ2dlciBhIGRvd25sb2FkIHJlcXVlc3QgZm9yIHRoZSBnaXZlbiBmaWxlc1xuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddID0gdHJ1ZSAgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSAgZmlsZXNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdHVkZW50dG9rZW4gPT0gXCJhXCIgfHwgc3R1ZGVudHRva2VuID09IFwiYlwiKXtcbiAgICAgICAgICAgIGxldCBncm91cEFycmF5ID0gW11cbiAgICAgICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT0gXCJhXCIpe2dyb3VwQXJyYXkgPSBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEEudXNlcnMgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PSBcImJcIil7Z3JvdXBBcnJheSA9IG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQi51c2VycyB9XG5cbiAgICAgICAgICAgIGlmIChncm91cEFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuYW1lIG9mIGdyb3VwQXJyYXkpe1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LmNsaWVudG5hbWUgPT09IG5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ109IHRydWUgXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9IGZpbGVzXG4gICAgICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCAgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLm5vZmlsZXJlY2VpdmVkXCIpIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmV0Y2hmaWxlcyddPSB0cnVlIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gZmlsZXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfVxuICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVyZWNlaXZlZFwiKSAgfSlcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5ub2ZpbGVyZWNlaXZlZFwiKSB9KVxuICAgIH1cbiAgICBcbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IHJvdXRlclxuXG4vLyBTaW1wbGUgY29uY3VycmVuY3kgbGltaXRlciBmb3IgWklQIGV4dHJhY3Rpb25cbmNvbnN0IE1BWF9QQVJBTExFTF9FWFRSQUNUUyA9IDQ7IC8vIGxpbWl0IHNpbXVsdGFuZW91cyBleHRyYWN0aW9ucyB0byBzdGFiaWxpemUgbGF0ZW5jeVxubGV0IHJ1bm5pbmdFeHRyYWN0cyA9IDA7XG5jb25zdCBleHRyYWN0UXVldWUgPSBbXTtcblxuZnVuY3Rpb24gcnVuTmV4dEV4dHJhY3QoKSB7XG4gICAgaWYgKHJ1bm5pbmdFeHRyYWN0cyA+PSBNQVhfUEFSQUxMRUxfRVhUUkFDVFMpIHJldHVybjtcbiAgICBjb25zdCBqb2IgPSBleHRyYWN0UXVldWUuc2hpZnQoKTtcbiAgICBpZiAoIWpvYikgcmV0dXJuO1xuXG4gICAgcnVubmluZ0V4dHJhY3RzKys7XG4gICAgLy8gY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcblxuICAgIGpvYigpXG4gICAgICAgIC5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgLy8gY29uc3QgbXMgPSBEYXRlLm5vdygpIC0gc3RhcnRlZEF0O1xuICAgICAgICAgICAgLy8gbG9nLmluZm8oYGRhdGEgQCBleHRyYWN0OiBmaW5pc2hlZCBpbiAke21zfW1zIChydW5uaW5nPSR7cnVubmluZ0V4dHJhY3RzLTF9LCBxdWV1ZWQ9JHtleHRyYWN0UXVldWUubGVuZ3RofSlgKTtcbiAgICAgICAgICAgIHJ1bm5pbmdFeHRyYWN0cy0tO1xuICAgICAgICAgICAgc2V0SW1tZWRpYXRlKHJ1bk5leHRFeHRyYWN0KTtcbiAgICAgICAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFyY2hpdmVBbmRFeHRyYWN0WmlwKGFic29sdXRlRmlsZXBhdGgsIHN0dWRlbnRhcmNoaXZlZGlyLCBmaWxlQ29udGVudCl7XG4gICAgLy8gbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBTdG9yaW5nIFppcGZpbGUgdG8gJHthYnNvbHV0ZUZpbGVwYXRofWApXG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZXhlYyA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGFic29sdXRlRmlsZXBhdGgsIGZpbGVDb250ZW50KTtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKGBkYXRhIEAgcmVjZWl2ZTogRXh0cmFjdGluZyBaaXBmaWxlIHRvICR7c3R1ZGVudGFyY2hpdmVkaXJ9YCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZXh0cmFjdChhYnNvbHV0ZUZpbGVwYXRoLCB7XG4gICAgICAgICAgICAgICAgICAgIGRpcjogc3R1ZGVudGFyY2hpdmVkaXIsXG4gICAgICAgICAgICAgICAgICAgIG9uRW50cnk6IChlbnRyeSwgemlwZmlsZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gcGF0aC5ub3JtYWxpemUocGF0aC5qb2luKHN0dWRlbnRhcmNoaXZlZGlyLCBlbnRyeS5maWxlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXQuc3RhcnRzV2l0aChwYXRoLm5vcm1hbGl6ZShzdHVkZW50YXJjaGl2ZWRpciArIHBhdGguc2VwKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCbG9ja2VkIHBhdGggdHJhdmVyc2FsOiAnICsgZW50cnkuZmlsZU5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0cnkgeyBhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoYWJzb2x1dGVGaWxlcGF0aCk7IH0gY2F0Y2ggKGUpIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgZGF0YSBAIHJlY2VpdmU6IFN1Y2Nlc3NmdWxseSBleHRyYWN0ZWQgWklQIGZpbGUgdG8gJHtzdHVkZW50YXJjaGl2ZWRpcn1gKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiZGF0YSBAIHJlY2VpdmUgKGV4dHJhY3QpOiBcIiwgZXJyKTtcbiAgICAgICAgICAgICAgICB0cnkgeyBhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoYWJzb2x1dGVGaWxlcGF0aCk7IH0gY2F0Y2ggKGUpIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBleHRyYWN0UXVldWUucHVzaChleGVjKTtcbiAgICAgICAgaWYgKHJ1bm5pbmdFeHRyYWN0cyA8IE1BWF9QQVJBTExFTF9FWFRSQUNUUykgc2V0SW1tZWRpYXRlKHJ1bk5leHRFeHRyYWN0KTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHRva2VuIGlzIHZhbGlkIGluIG9yZGVyIHRvIHByb2Nlc3MgYXBpIHJlcXVlc3RcbiAqIEF0dGVudGlvbjogbm8gYWxsIGFwaSByZXF1ZXN0cyBjaGVjayB0b2tlbnMgYXRtIVxuICovXG5mdW5jdGlvbiBjaGVja1Rva2VuKHRva2VuLCBtY3NlcnZlcil7XG4gICAgbGV0IHRva2VuZXhpc3RzID0gZmFsc2VcbiAgICAvLyBsb2cuaW5mbyhcImRhdGEgQCBjaGVja1Rva2VuOiBjaGVja2luZyBpZiBzdHVkZW50IGlzIHJlZ2lzdGVyZWQgb24gdGhpcyBzZXJ2ZXJcIilcbiAgICB0cnkge1xuICAgICAgICBtY3NlcnZlci5zdHVkZW50TGlzdC5mb3JFYWNoKCAoc3R1ZGVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRva2VuID09PSBzdHVkZW50LnRva2VuKSB7XG4gICAgICAgICAgICAgICAgdG9rZW5leGlzdHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBjYXRjaChlcnIpe1xuICAgICAgICBsb2cuZXJyb3IoYGRhdGE6ICR7ZXJyfWApXG4gICAgfVxuXG4gICAgcmV0dXJuIHRva2VuZXhpc3RzXG59XG5cbi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gKiBAcGFyYW0ge1N0cmluZ30gb3V0UGF0aDogL3BhdGgvdG8vY3JlYXRlZC56aXBcbiAqIEByZXR1cm5zIHtQcm9taXNlfVxuICovXG5mdW5jdGlvbiB6aXBEaXJlY3Rvcnkoc291cmNlRGlyLCBvdXRQYXRoKSB7XG4gICAgY29uc3QgYXJjaGl2ZSA9IGFyY2hpdmVyKCd6aXAnLCB7IHpsaWI6IHsgbGV2ZWw6IDkgfX0pO1xuICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBhcmNoaXZlXG4gICAgICAgIC5kaXJlY3Rvcnkoc291cmNlRGlyLCBmYWxzZSlcbiAgICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiByZWplY3QoZXJyKSlcbiAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgO1xuICAgICAgc3RyZWFtLm9uKCdjbG9zZScsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgfSk7XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG4vL2ltcG9ydCBpMThuIGZyb20gJy4uLy4uL3JlbmRlcmVyL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG4vL2NvbnN0IHsgdCB9ID0gaTE4bi5nbG9iYWxcbmltcG9ydCB7IEJyb3dzZXJXaW5kb3csIGlwY01haW4sIGRpYWxvZyB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHtqb2lufSBmcm9tICdwYXRoJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgbmV0d29ya0ludGVyZmFjZXMgfSBmcm9tICdvcydcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGdhdGV3YXk0c3luY30gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBpcCBmcm9tICdpcCdcblxuaW1wb3J0IHNlcnZlciBmcm9tIFwiLi4vLi4vc2VydmVyL3NyYy9zZXJ2ZXIuanNcIlxuaW1wb3J0IGNoZWNrRGlza1NwYWNlIGZyb20gJ2NoZWNrLWRpc2stc3BhY2UnO1xuXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMucHJpbnRRdWV1ZSA9IFtdXG4gICAgICAgIHRoaXMuaXNQcm9jZXNzaW5nUHJpbnQgPSBmYWxzZVxuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQcm9jZXNzIHByaW50IHF1ZXVlIHNlcXVlbnRpYWxseSAtIG9uZSBqb2IgYXQgYSB0aW1lXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wcm9jZXNzUHJpbnRRdWV1ZSA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJvY2Vzc2luZ1ByaW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvLyBBbHJlYWR5IHByb2Nlc3NpbmdcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pc1Byb2Nlc3NpbmdQcmludCA9IHRydWU7XG5cbiAgICAgICAgICAgIHdoaWxlICh0aGlzLnByaW50UXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGpvYiA9IHRoaXMucHJpbnRRdWV1ZS5zaGlmdCgpOyAvLyBHZXQgZmlyc3Qgam9iIGZyb20gcXVldWVcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRRdWV1ZTogUHJvY2Vzc2luZyBwcmludCBqb2IgKCR7dGhpcy5wcmludFF1ZXVlLmxlbmd0aH0gcmVtYWluaW5nIGluIHF1ZXVlKWApO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5fcHJvY2Vzc1ByaW50Sm9iKGpvYi5kb2NCYXNlNjQsIGpvYi5wcmludGVyTmFtZSwgam9iLnByZXZpZXdUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgam9iLnJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludFF1ZXVlOiBQcmludCBqb2IgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgIGpvYi5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5pc1Byb2Nlc3NpbmdQcmludCA9IGZhbHNlO1xuICAgICAgICAgICAgbG9nLmluZm8oJ2lwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50UXVldWU6IFByaW50IHF1ZXVlIGVtcHR5LCBwcm9jZXNzaW5nIHN0b3BwZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJvY2VzcyBhIHNpbmdsZSBwcmludCBqb2IgLSByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyBhZnRlciBwcmludCBjYWxsYmFjayBjb21wbGV0ZXNcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQcmludEpvYiA9IGFzeW5jIChkb2NCYXNlNjQsIHByaW50ZXJOYW1lLCBwcmV2aWV3VHlwZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgaGlkZGVuV2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdXNlQ29udGVudFNpemU6IHRydWUsIC8vIEVuc3VyZSB3aWR0aC9oZWlnaHQgcmVmZXJzIHRvIGNvbnRlbnQgYXJlYVxuICAgICAgICAgICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGx1Z2luczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHpvb21GYWN0b3I6IDEuMCAgLy8gRm9yY2UgMToxIHNjYWxpbmcgdG8gaWdub3JlIHN5c3RlbSBzY2FsZSBmYWN0b3JcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFNldCB6b29tIGZhY3RvciB0byAxLjAgdG8gaWdub3JlIHN5c3RlbSBEUEkgc2NhbGluZyAoZml4ZXMgQ2hyb21pdW0gcHJpbnQgYnVnKVxuICAgICAgICAgICAgICAgIGhpZGRlbldpbi53ZWJDb250ZW50cy5zZXRab29tRmFjdG9yKDEuMCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IGRhdGFVcmwgPSBgYDtcbiAgICAgICAgICAgICAgICBpZiAocHJldmlld1R5cGUgPT09IFwicGRmXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtkb2NCYXNlNjR9YDtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHByZXZpZXdUeXBlID09PSBcImltYWdlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVVybCA9IGBkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCR7ZG9jQmFzZTY0fWA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogSW52YWxpZCBwcmV2aWV3IHR5cGUhJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdJbnZhbGlkIHByZXZpZXcgdHlwZScpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhpZGRlbldpbi5vbignY2xvc2VkJywgKCkgPT4geyBoaWRkZW5XaW4gPSBudWxsOyB9KTtcblxuICAgICAgICAgICAgICAgIGhpZGRlbldpbi53ZWJDb250ZW50cy5vbignZGlkLXN0b3AtbG9hZGluZycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUERGUmVuZGVyZWQgPSBhd2FpdCBoaWRkZW5XaW4ud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxhcHNlZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludGVydmFsID0gNTAwOyAvLyBDaGVjayBldmVyeSA1MDAgbXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGltZW91dCA9IDIwMDA7IC8vIE1heGltdW0gMiBzZWNvbmRzIHdhaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hlY2tQREZMb2FkZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbWJlZCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2VtYmVkW3R5cGU9XCJhcHBsaWNhdGlvbi9wZGZcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW1iZWQgJiYgZW1iZWQuY2xpZW50SGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpOyAvLyBQREYgaXMgYXNzdW1lZCB0byBiZSBmdWxseSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIDEwMDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGltZyAmJiBpbWcuY2xpZW50SGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7IC8vIEltYWdlIGlzIGZ1bGx5IHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZWxhcHNlZCA+PSB0aW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShmYWxzZSk7IC8vIFRpbWUgZXhwaXJlZCwgbm90IHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGVsYXBzZWQgKz0gaW50ZXJ2YWw7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGltZXIgPSBzZXRJbnRlcnZhbChjaGVja1BERkxvYWRlZCwgaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1BERlJlbmRlcmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBiYXNlNjQgJHtwcmV2aWV3VHlwZX0gcmVjZWl2ZWQgLSBwcmludGluZyBvbjogJHtwcmludGVyTmFtZX1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aW1lb3V0IHRvIGF2b2lkIGhhbmdpbmcgcXVldWUgd2hlbiBwcmludCBjYWxsYmFjayBuZXZlciBmaXJlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByaW50VGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBwcmludCBqb2IgdGltZW91dCBmb3IgcHJpbnRlciAke3ByaW50ZXJOYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUHJpbnQgam9iIHRpbWVvdXQnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgMTAwMDApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLndlYkNvbnRlbnRzLnByaW50KHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpbGVudDogdHJ1ZSwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZU5hbWU6IHByaW50ZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlRmFjdG9yOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWdlc1BlclNoZWV0OiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcGk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvcml6b250YWw6IDYwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRpY2FsOiA2MDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5UeXBlOiAnbm9uZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIChzdWNjZXNzLCBmYWlsdXJlUmVhc29uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChwcmludFRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBsb2cgaWYgcHJpbnQgam9iIHdhcyBoYW5kZWQgb3ZlciB0byBPUyBvciBmYWlsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBwcmludCBqb2IgZmFpbGVkIGZvciBwcmludGVyICR7cHJpbnRlck5hbWV9OiAke2ZhaWx1cmVSZWFzb24gfHwgJ3Vua25vd24gcmVhc29uJ31gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGZhaWx1cmVSZWFzb24gfHwgJ1ByaW50IGpvYiBmYWlsZWQnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IHByaW50IGpvYiBzdWNjZXNzZnVsbHkgaGFuZGVkIG92ZXIgdG8gT1MgZm9yIHByaW50ZXIgJHtwcmludGVyTmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IFJlbmRlcmluZy9QcmludCBmYWlsZWQhJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1JlbmRlcmluZy9QcmludCBmYWlsZWQnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBFcnJvciBkdXJpbmcgcHJpbnQgam9iOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLmxvYWRVUkwoZGF0YVVybCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IEVycm9yIGxvYWRpbmcgVVJMOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBCSVAgTG9naW4gU2VxdWVuY2VcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8vIHJldHVybnMgdGhlIGN1cnJlbnQgc2VydmVyc3RhdHVzIG9iamVjdCBvZiB0aGUgZ2l2ZW4gc2VydmVyKG5hbWUpXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRzZXJ2ZXJzdGF0dXMnLCAoZXZlbnQsIHNlcnZlcm5hbWUpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBtY1NlcnZlciA9IHRoaXMuY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgICAgICBpZiAobWNTZXJ2ZXIgKSB7IHJldHVybiBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgcmV0dXJuIGZhbHNlICB9XG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLy8gc3RvcHMgdGhlIGN1cnJlbnQgZXhhbSBzZXJ2ZXIgXG4gICAgICAgIC8vICh0aGlzIGlzIGEgY29weSBvZiB0aGUgL3N0b3BzZXJ2ZXIvOnNlcnZlcm5hbWUgcm91dGUgaW4gY29udHJvbC5qcyApXG4gICAgICAgIC8vIHJldGhpbmsgY29uY2VwdCB0aGF0IGxvY2FsIHJlcXVlc3RzIGdvIHRvIHRoZSBBUEkgKHRoaXMgaGFkIGEgbm9uIGVsZWN0cm9uIHNlcnZlciB2ZXJzaW9uIGluIG1pbmQgYnV0IG1ha2VzIG5vIHNlbnNlIGluIGVsZWN0cm9uIG9ubHkgYXBwKVxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RvcHNlcnZlcicsIChldmVudCwgc2VydmVybmFtZSkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmIChtY1NlcnZlciApIHsgXG4gICAgICAgICAgICAgICAgbWNTZXJ2ZXIuYnJvYWRjYXN0SW50ZXJ2YWwuc3RvcCgpXG4gICAgICAgICAgICAgICAgbWNTZXJ2ZXIuc2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAgICAvL2RlbGV0ZSBtY1NlcnZlclxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0ID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbVNlcnZlckxpc3QuZmlsdGVyKGV4YW0gPT4gZXhhbS5zZXJ2ZXJuYW1lICE9PSBzZXJ2ZXJuYW1lKSAgLy8gbXVsdGljYXN0Y2xpZW50IGtlZXBzIHRyYWNrIG9mIHJ1bm5pbmcgc2VydmVycyBpbiB0aGUgbGFuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgcmV0dXJuIGZhbHNlICB9XG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLy9yZXR1cm4gY3VycmVudCBzdHVkZW50bGlzdFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3R1ZGVudGxpc3QnLCAoZXZlbnQsIHNlcnZlcm5hbWUpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBtY1NlcnZlciA9IHRoaXMuY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgICAgICBpZiAobWNTZXJ2ZXIgKSB7IFxuICAgICAgICAgICAgICAgIHJldHVybiB7c3R1ZGVudGxpc3Q6IG1jU2VydmVyLnN0dWRlbnRMaXN0fVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBzdHVkZW50bGlzdDogW119XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pIFxuXG5cblxuXG4gICAgICAgIC8vIG9wZW5zIGEgbG9naW53aW5kb3cgZm9yIG1pY3Jvc29mdCAzNjVcbiAgICAgICAgaXBjTWFpbi5vbignb3Blbm1zYXV0aCcsIChldmVudCkgPT4geyB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlTXNhdXRoV2luZG93KCk7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHRydWUgfSkgIFxuXG5cbiAgICAgICAgLy8gcmV0dXJucyBjdXJyZW50IGNvbmZpZ1xuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmNvcHlDb25maWcoY29uZmlnKTsgXG4gICAgICAgIH0pICBcblxuXG4gICAgICAgIC8vIHJldHVybnMgY3VycmVudCBjb25maWcgYXN5bmNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGNvbmZpZ2FzeW5jJywgKGV2ZW50KSA9PiB7ICBcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvcHlDb25maWcoY29uZmlnKVxuICAgICAgICB9KSAgXG5cblxuICAgICAgICAvLyBsb2cgb3V0IG9mIG1pY3Jvc29mdCAzNjVcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3Jlc2V0VG9rZW4nLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICBjb25zdCB3aW4gPSB0aGlzLldpbmRvd0hhbmRsZXIubWFpbndpbmRvdzsgLy8gT2RlciB3aWUgYXVjaCBpbW1lciBTaWUgYXVmIElociBCcm93c2VyV2luZG93LU9iamVrdCB6dWdyZWlmZW5cbiAgICAgICAgICAgIGlmICghd2luKSByZXR1cm47XG5cbiAgICAgICAgICAgIGF3YWl0IHdpbi53ZWJDb250ZW50cy5zZXNzaW9uLmNsZWFyQ2FjaGUoKTtcbiAgICAgICAgICAgIGF3YWl0IHdpbi53ZWJDb250ZW50cy5zZXNzaW9uLmNsZWFyU3RvcmFnZURhdGEoe1xuICAgICAgICAgICAgICAgIHN0b3JhZ2VzOiBbJ2Nvb2tpZXMnXVxuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uZmlnLmFjY2Vzc1Rva2VuID0gZmFsc2VcblxuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcmVzZXRUb2tlbjogTG9nZ2VkIG91dCBvZiBPZmZpY2UzNjVcIilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvcHlDb25maWcoY29uZmlnKTsgIC8vIHdlIGNhbnQganVzdCBjb3B5IHRoZSBjb25maWcgYmVjYXVzZSBpdCBjb250YWlucyBleGFtU2VydmVyTGlzdCB3aGljaCBjb250YWlucyBjb25maWcgKGNpcmN1bGFyIHN0cnVjdHVyZSlcbiAgICAgICAgfSkgIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIG9wZW5zIGZpbGUgaW4gZXh0ZXJuYWwgcHJvZ3JhbSAtIHBsYXRmb3JtIGRlcGVuZGVudFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ29wZW5maWxlJywgKGV2ZW50LCBmaWxlcGF0aCkgPT4geyAgXG4gICAgICAgICAgICBjb25zdCBjbWQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gYHN0YXJ0IFwiIFwiIFwiJHtmaWxlcGF0aH1cImAgOlxuICAgICAgICAgICAgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicgPyBgb3BlbiBcIiR7ZmlsZXBhdGh9XCJgIDpcbiAgICAgICAgICAgIGB4ZGctb3BlbiBcIiR7ZmlsZXBhdGh9XCJgO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGV4ZWMoY21kLCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2lwY2hhbmRsZXIgQCBvcGVuZmlsZTogRXJyb3Igb3BlbmluZyBQREYgaW4gZXh0ZXJuYWwgcmVhZGVyOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdpcGNoYW5kbGVyIEAgb3BlbmZpbGU6IEZpbGUgb3BlbmVkIGluIGV4dGVybmFsIHJlYWRlcicpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2lwY2hhbmRsZXIgQCBvcGVuZmlsZTogRXJyb3Igb3BlbmluZyBQREY6JywgZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkgIFxuXG5cbiAgICAgICAgaXBjTWFpbi5vbignZ2V0Q3VycmVudFdvcmtkaXInLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNrRGlzY3NwYWNlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBkaXNrU3BhY2UgPSBhd2FpdCBjaGVja0Rpc2tTcGFjZShjb25maWcud29ya2RpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgbGV0IGZyZWUgPSBNYXRoLnJvdW5kKGRpc2tTcGFjZS5mcmVlIC8gMTAyNCAvIDEwMjQgLyAxMDI0ICogMTAwMCkgLyAxMDAwO1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgY2hlY2tEaXNrc3BhY2U6XCIsZGlza1NwYWNlKVxuICAgICAgICAgICAgICAgIHJldHVybiBmcmVlOyAgICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NldGJhY2t1cGRpcicsIGFzeW5jIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkaWFsb2cuc2hvd09wZW5EaWFsb2coIHRoaXMuV2luZG93SGFuZGxlci5tYWlud2luZG93LCB7IHByb3BlcnRpZXM6IFsnb3BlbkRpcmVjdG9yeSddICB9KVxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuY2FuY2VsZWQpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdkaXJlY3RvcmllcyBzZWxlY3RlZCcsIHJlc3VsdC5maWxlUGF0aHMpXG4gICAgICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBcIlwiXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHRlc3RkaXIgPSBqb2luKHJlc3VsdC5maWxlUGF0aHNbMF0gICAsIGNvbmZpZy5zZXJ2ZXJkaXJlY3RvcnkpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0ZXN0ZGlyKSl7ZnMubWtkaXJTeW5jKHRlc3RkaXIpfVxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJzdWNjZXNzXCJcbiAgICAgICAgICAgICAgICAgICAgLy9jb25maWcud29ya2RpcmVjdG9yeSA9IHRlc3RkaXJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLmJhY2t1cGRpcmVjdG9yeSA9IHRlc3RkaXJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2V0YmFja3VwZGlyOlwiLCBjb25maWcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwiZXJyb3JcIlxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtiYWNrdXBkaXI6IGNvbmZpZy5iYWNrdXBkaXJlY3RvcnksIG1lc3NhZ2UgOiBtZXNzYWdlfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtiYWNrdXBkaXI6IGNvbmZpZy5iYWNrdXBkaXJlY3RvcnksIG1lc3NhZ2UgOiAnY2FuY2VsZWQnfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5vbignc2V0UHJldmlvdXNXb3JrZGlyJywgYXN5bmMgKGV2ZW50LCB3b3JrZGlyKSA9PiB7XG4gICAgICAgICAgICBpZiAod29ya2Rpcil7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3ByZXZpb3VzIGRpcmVjdG9yeSBzZWxlY3RlZCcsIHdvcmtkaXIpXG4gICAgICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBcIlwiXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXtmcy5ta2RpclN5bmMod29ya2Rpcil9XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcInN1Y2Nlc3NcIlxuICAgICAgICAgICAgICAgICAgICBjb25maWcud29ya2RpcmVjdG9yeSA9IHdvcmtkaXJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJlcnJvclwiXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHt3b3JrZGlyOiBjb25maWcud29ya2RpcmVjdG9yeSwgbWVzc2FnZSA6IG1lc3NhZ2V9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIGV2ZW50LnJldHVyblZhbHVlID0ge3dvcmtkaXI6IGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtZXNzYWdlIDogJ2NhbmNlbGVkJ30gfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NyZWF0ZUJpcEV4YW1kaXJlY3RvcnknLCBhc3luYyAoZXZlbnQsIGV4YW0pID0+IHtcbiAgICAgICAgICAgIGxldCBtZXNzYWdlID0gXCJcIlxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IGpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIGV4YW0uZXhhbU5hbWUpXG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4od29ya2RpciwgJ3NlcnZlcnN0YXR1cy5qc29uJyk7XG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2Rpcikpe2ZzLm1rZGlyU3luYyh3b3JrZGlyKX1cbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJzdWNjZXNzXCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKXtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gZS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGUpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7ICBcbiAgICAgICAgICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoZXhhbSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgSlNPTiBiZWZvcmUgd3JpdGluZyB0byBwcmV2ZW50IGludmFsaWQgSlNPTiBmaWxlc1xuICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwganNvblN0cmluZyk7ICBcbiAgICAgICAgICAgIH0gICAvLyBzYXZlIG1jU2VydmVyLnNlcnZlcnN0YXR1cyBhcyBKU09OIGZpbGVcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikgeyAgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgY3JlYXRlQmlwRXhhbWRpcmVjdG9yeTogSlNPTiB2YWxpZGF0aW9uIG9yIHdyaXRlIGZhaWxlZDogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJlcnJvclwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHttZXNzYWdlIDogbWVzc2FnZX1cblxuICAgICAgICB9KVxuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIExPRyBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRsb2cnLCBhc3luYyAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gam9pbih3b3JrZGlyLFwibmV4dC1leGFtLXRlYWNoZXIubG9nXCIpXG4gICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBzZXJ2ZXJsb2cgPSBkYXRhLnRyaW0oKVxuICAgICAgICAgICAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgICAgICAgICAgICAubWFwKGxpbmUgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxbKC4rPylcXF1cXHMrXFxbKC4rPylcXF1cXHMrKC4qKSQvKTtcbiAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbLCBkYXRlLCB0eXBlLCByYXdUZXh0XSA9IG1hdGNoO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gU2V0IGNvbG9yIGJhc2VkIG9uIGxvZyB0eXBlXG4gICAgICAgICAgICAgICAgICAgIGxldCBjb2xvcjtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoICh0eXBlLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdpbmZvJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJyMwYWEyYzAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnd2Fybic6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9ICd2YXIoLS1icy13YXJuaW5nKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9ICd2YXIoLS1icy1kYW5nZXIpJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9ICd2YXIoLS1icy1jeWFuKSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIERlZmF1bHQgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgIGxldCBzb3VyY2UgPSAnbmV4dC1leGFtJztcbiAgICAgICAgICAgICAgICAgICAgbGV0IHRleHQgPSByYXdUZXh0O1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBjb2xvbiBpcyBwcmVzZW50OiBldmVyeXRoaW5nIGJlZm9yZSB0aGUgZmlyc3QgY29sb24gYXMgJ3NvdXJjZSdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJhd1RleHQuaW5jbHVkZXMoJzonKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9uSW5kZXggPSByYXdUZXh0LmluZGV4T2YoJzonKTtcbiAgICAgICAgICAgICAgICAgICAgICBzb3VyY2UgPSByYXdUZXh0LnN1YnN0cmluZygwLCBjb2xvbkluZGV4KS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgdGV4dCA9IHJhd1RleHQuc3Vic3RyaW5nKGNvbG9uSW5kZXggKyAxKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGRhdGUsIHR5cGUsIHRleHQsIGNvbG9yLCBzb3VyY2UgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmZpbHRlcihpdGVtID0+IGl0ZW0gIT09IG51bGwpO1xuXG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2VydmVybG9nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0bG9nOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIG9sZCBleGFtIGZvbGRlcnMgaW4gd29ya2RpcmVjdG9yeVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2NhbldvcmtkaXInLCBhc3luYyAoZXZlbnQsIGFyZykgPT4ge1xuICAgICAgICAgICAgbGV0IGV4YW1mb2xkZXJzID0gW10gLy8gYXJyYXkgZm9yIHJlc3VsdHNcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSkgeyAvLyBjaGVjayBpZiBiYXNlIGRpciBleGlzdHNcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJzID0gZnMucmVhZGRpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkaXJuYW1lIG9mIGZvbGRlcnMpIHsgLy8gaXRlcmF0ZSBvdmVyIGRpcmVjdG9yeSBuYW1lc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJzdGF0dXNQYXRoID0gam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgZGlybmFtZSwgJ3NlcnZlcnN0YXR1cy5qc29uJylcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2VydmVyc3RhdHVzUGF0aCkpIHsgLy8gY2hlY2sgaWYgZmlsZSBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1cyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNlcnZlcnN0YXR1c1BhdGgsICd1dGYtOCcpKSAvLyBwYXJzZSBKU09OIHRvIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJzdGF0dXMuZXhhbU5hbWUgPSBkaXJuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtZm9sZGVycy5wdXNoKHNlcnZlcnN0YXR1cykgLy8gYWRkIG9iamVjdCB0byBhcnJheVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzY2FuV29ya2RpcjogRXJyb3IgcGFyc2luZyBzZXJ2ZXJzdGF0dXMuanNvbiBpbiAke2Rpcm5hbWV9OmAsIGUpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBleGFtZm9sZGVycyAvLyByZXR1cm4gcmVzdWx0c1xuICAgICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkZWxldGVzIG9sZCBleGFtIGZvbGRlciBpbiB3b3JrZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZGVsUHJldmlvdXMnLCBhc3luYyAoZXZlbnQsIGFyZykgPT4ge1xuICAgICAgICAgICAgbGV0IGV4YW1kaXIgPSBqb2luKCBjb25maWcud29ya2RpcmVjdG9yeSwgYXJnKVxuICAgICAgICAgICAgaWYgKGZzLnN0YXRTeW5jKGV4YW1kaXIpLmlzRGlyZWN0b3J5KCkpe1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyhleGFtZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfVxuICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgcmV0dXJuIGV4YW1kaXJcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKiBHZXQgU3BlY2lmaWMgU3VibWlzc2lvbiBieSBmaWxlcGF0aCBhcyBiYXNlNjQgc3RyaW5nICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRTcGVjaWZpY1N1Ym1pc3Npb25CYXNlNjQnLCBhc3luYyAoZXZlbnQsIGZpbGVwYXRoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Ym1pc3Npb24gPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICdiYXNlNjQnKVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Ym1pc3Npb246IHN1Ym1pc3Npb24sIHN0YXR1czogXCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRTcGVjaWZpY1N1Ym1pc3Npb25CYXNlNjQ6ICR7ZX1gKVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Ym1pc3Npb246IGZhbHNlLCBzdGF0dXM6IFwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGxhdGVzdCBzdWJtaXNpb25zIGZyb20gYWxsIHN0dWRlbnRzXG4gICAgICAgICAqIHJldHVybiBhcnJheSBvZiBvYmplY3RzIHdpdGggc3R1ZGVudG5hbWUsIGxhdGVzdGZpbGVwYXRoLCBsYXRlc3RmaWxlbmFtZSBhbmQgc3VibWlzc2lvbmRhdGUgKHRpbWVzdGFtcClcbiAgICAgICAgICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciB0byBnZXQgdGhlIHN1Ym1pc3Npb25zIGZyb21cbiAgICAgICAgICogQHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcInN1Y2Nlc3NcIiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgc3VibWlzc2lvbnM6IHN1Ym1pc3Npb25zIH1cbiAgICAgICAgICovXG4gICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFN1Ym1pc3Npb25zJywgYXN5bmMgKGV2ZW50LCBzZXJ2ZXJuYW1lLCBjdXJyZW50c2VydmVyc3RhdHVzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtY1NlcnZlciA9IHRoaXMuY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJzdGF0dXMgPSBKU09OLnBhcnNlKGN1cnJlbnRzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBpZiAoIW1jU2VydmVyKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBzdWJtaXNzaW9uczogW10gfSB9XG4gICAgICAgICAgICBsZXQgc3VibWlzc2lvbnMgPSBbXVxuICAgICAgICAgICAgbGV0IGRpciA9ICBqb2luKCBjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lKTtcbiAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhkaXIpKSB7IC8vIGNoZWNrIGlmIGJhc2UgZGlyIGV4aXN0c1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNEaXJlY3RvcnkoKSlcbiAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN0dWRlbnROYW1lIG9mIGZvbGRlcnMpIHsgLy8gaXRlcmF0ZSBvdmVyIGRpcmVjdG9yeSBuYW1lc1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3R1ZGVudE5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ1VQTE9BRFMnKSB7IC8vIGlnbm9yZSBVUExPQURTIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNlY3Rpb25zID0ge31cbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1Ym1pc3Npb25EaXIgPSBqb2luKGRpciwgc3R1ZGVudE5hbWUsIFwiQUJHQUJFXCIpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBpdGVyYXRlIG92ZXIgZXhhbSBzZWN0aW9ucyAxLTRcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgc2VjdGlvbiA9IDE7IHNlY3Rpb24gPD0gNDsgc2VjdGlvbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgc2VjdGlvbkRpciA9IGpvaW4oc3VibWlzc2lvbkRpciwgU3RyaW5nKHNlY3Rpb24pKVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbml0aWFsaXplIHNlY3Rpb24gd2l0aCBkZWZhdWx0IHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbnNbc2VjdGlvbl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZTogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9ubmFtZTogXCJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZWN0aW9uRGlyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzZWN0aW9uRmlsZXMgPSBmcy5yZWFkZGlyU3luYyhzZWN0aW9uRGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKSAvLyBvbmx5IGZpbGVzLCBub3QgZGlyZWN0b3JpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlY3Rpb25GaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBsYXRlc3RTdWJtaXNzaW9uID0gc2VjdGlvbkZpbGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlUGF0aCA9IGpvaW4oc2VjdGlvbkRpciwgZmlsZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBmaWxlLCBtdGltZTogZnMuc3RhdFN5bmMoZmlsZVBhdGgpLm10aW1lIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5tdGltZSAtIGEubXRpbWUpWzBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9uc1tzZWN0aW9uXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGpvaW4oc2VjdGlvbkRpciwgbGF0ZXN0U3VibWlzc2lvbi5maWxlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBsYXRlc3RTdWJtaXNzaW9uLmZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRlOiBsYXRlc3RTdWJtaXNzaW9uLm10aW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbm5hbWU6IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VjdGlvbl0uc2VjdGlvbm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50TmFtZTogc3R1ZGVudE5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9uczogc2VjdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VibWlzc2lvbnNcbiAgICAgICAgfSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBsYXRlc3QgYmFrIGZpbGUgZnJvbSBzcGVjaWZpYyBzdHVkZW50IGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldExhdGVzdEJha0ZpbGUnLCBhc3luYyAoZXZlbnQsIHNlcnZlcm5hbWUsIHN0dWRlbnROYW1lKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtY1NlcnZlciA9IHRoaXMuY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgICAgICBpZiAoIW1jU2VydmVyKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UgfSB9XG4gICAgICAgICAgICBsZXQgbGF0ZXN0QmFrRmlsZSA9IG51bGxcbiAgICAgICAgICAgIGxldCBkaXIgPSAgam9pbiggY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudE5hbWUpO1xuICAgIFxuICAgICAgICAgICAgLy9jaGVjayBpZiBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyKSkgeyByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgZmlsZXBhdGg6IGZhbHNlIH0gfVxuXG4gICAgICAgICAgICAvL2luIHRoZSBzdHVkZW50IGRpcmVjdHJveSB0aGVyZSBhcmUgc2V2ZXJhbCBiYWNrdXAgZGlyZWN0b3JpZXMgIHRoYXQgY29udGFpbiBhIGJhayBmaWxlIC8yMDI1MTExMl8xMF8yMF8xMy9cbiAgICAgICAgICAgIC8vIHRoZSBiYWtmaWxlIG5hbWluZyBzY2hlbWUgaXMgc3R1ZGVudG5hbWUuYmFrIC4uLiB3ZSBvbmx5IG5lZWQgdGhlIGxhdGVzdCBvbmUgdGhhdCBoYXMgdGhlIHN0dWRlbnRuYW1lIGFzIGZpbGVuYW1lXG4gICAgICAgICAgICAvLyBpZ25vcmUgZGlyZWN0b3JpZXM6IEFCR0FCRSBhbmQgZm9jdXNsb3N0XG4gICAgICAgICAgICBjb25zdCBiYWNrdXBEaXJlY3RvcmllcyA9IGZzLnJlYWRkaXJTeW5jKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRGlyZWN0b3J5KCkgJiYgZGlyZW50Lm5hbWUgIT09ICdBQkdBQkUnICYmIGRpcmVudC5uYW1lICE9PSAnZm9jdXNsb3N0JylcbiAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlUGF0aCA9IGpvaW4oZGlyLCBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgbmFtZTogZGlyZW50Lm5hbWUsIG10aW1lOiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWUgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIubXRpbWUgLSBhLm10aW1lKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoYmFja3VwRGlyZWN0b3JpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIGZpbGVwYXRoOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBsYXRlc3RCYWNrdXBEaXJlY3RvcnkgPSBiYWNrdXBEaXJlY3Rvcmllc1swXS5uYW1lXG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRMYXRlc3RCYWtGaWxlOiBTZWFyY2hpbmcgZm9yIGxhdGVzdCBiYWNrdXAgZmlsZSBpbjpcIiwgZGlyLCBsYXRlc3RCYWNrdXBEaXJlY3RvcnkpXG4gICAgICAgICAgICBjb25zdCBsYXRlc3RCYWtGaWxlcGF0aCA9IGpvaW4oZGlyLCBsYXRlc3RCYWNrdXBEaXJlY3RvcnksIHN0dWRlbnROYW1lICsgJy5iYWsnKVxuICAgICAgICAgICAgY29uc3QgbGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aCA9IGpvaW4oZGlyLCBsYXRlc3RCYWNrdXBEaXJlY3RvcnkpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vZ2V0IGxhdGVzdCBiYWsgZmlsZSAgLSBjaGVjayBpZiBmaWxlIGV4aXN0c1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGxhdGVzdEJha0ZpbGVwYXRoKSkgeyByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgZmlsZXBhdGg6IGZhbHNlLCBsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoOmxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGggfHwgZmFsc2UgfSB9XG4gICAgICAgICAgICAvL3JldHVybiB0aGUgZXhpc3RpbmcgYW5kIGNoZWNrZWQgZmlsZXBhdGggb3IgaWYgbm8gZmlsZSB3YXMgZm91bmQgZmFsc2VcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcInN1Y2Nlc3NcIiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgZmlsZXBhdGg6IGxhdGVzdEJha0ZpbGVwYXRoLCBsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoOiBsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoIH1cblxuICAgICAgICB9KVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBzeXN0ZW0gcHJpbnRlcnNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwcmludGVycycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByaW50ZXJzID0gYXdhaXQgdGhpcy5XaW5kb3dIYW5kbGVyLm1haW53aW5kb3cud2ViQ29udGVudHMuZ2V0UHJpbnRlcnNBc3luYygpO1xuICAgICAgICAgICAgLy9sb2cuaW5mbygnaXBjaGFuZGxlciBAIGdldHByaW50ZXJzOiBwcmludGVycycsIHByaW50ZXJzKVxuICAgICAgICAgICAgY29uc3QgcHJpbnRlckRhdGEgPSBwcmludGVycy5tYXAocHJpbnRlciA9PiAoe1xuICAgICAgICAgICAgICAgIHByaW50ZXJOYW1lOiBwcmludGVyLm5hbWUsXG4gICAgICAgICAgICAgICAgaXNEZWZhdWx0OiBwcmludGVycy5sZW5ndGggPT09IDEgPyB0cnVlIDogcHJpbnRlci5pc0RlZmF1bHQsIC8vIGRlcHJlY2F0ZWQgaW4gZWxlY3Ryb24gMzYsIHNldCB0byB0cnVlIGlmIG9ubHkgb25lIHByaW50ZXJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogcHJpbnRlci5kZXNjcmlwdGlvblxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICByZXR1cm4gcHJpbnRlckRhdGFcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQcmludCBhIERvY3VtZW50IGFzIGJhc2U2NCBzdHJpbmcgdmlhIHdlYmNvbnRlbnRzLnByaW50KCkgd2l0aG91dCBzcGVjaWZpYyBwbGF0Zm9ybWRlcGVuZGVudCBsaWJyYXJpZXNcbiAgICAgICAgICogSU5GTzogaXQgaXMgY3VycmVudGx5IG5vdCBwb3NzaWJsZSB0byBnZXQgYSBcImZpbmlzaGVkLXJlbmRlcmluZ1wiIGV2ZW50IGZyb20gdGhlIGNocm9tZS1wZGYtcGx1Z2luLiB0aGVyZWZvcmUgdGltZW91dHMgYXJlIHVzZWQgYXMgYSB3b3JrYXJvdW5kXG4gICAgICAgICAqIFVzZXMgYSBwcmludCBxdWV1ZSB0byBoYW5kbGUgbXVsdGlwbGUgc2ltdWx0YW5lb3VzIHJlcXVlc3RzIHNlcXVlbnRpYWxseVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3ByaW50QmFzZTY0JywgYXN5bmMgKGV2ZW50LCBkb2NCYXNlNjQsIHByaW50ZXJOYW1lLCBwcmV2aWV3VHlwZSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBBZGQgam9iIHRvIHF1ZXVlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbnRRdWV1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY0Jhc2U2NCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByaW50ZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgcHJpbnRCYXNlNjQ6IFByaW50IHJlcXVlc3QgYWRkZWQgdG8gcXVldWUgKCR7dGhpcy5wcmludFF1ZXVlLmxlbmd0aH0gam9icyBpbiBxdWV1ZSlgKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCBxdWV1ZSBwcm9jZXNzaW5nIGlmIG5vdCBhbHJlYWR5IHJ1bm5pbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzUHJvY2Vzc2luZ1ByaW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wcm9jZXNzUHJpbnRRdWV1ZSgpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50QmFzZTY0OiBRdWV1ZSBwcm9jZXNzaW5nIGVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50QmFzZTY0OiByZXR1cm5pbmcgZXJyb3IgdG8gcmVuZGVyZXI6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlLWNoZWNrIGhvc3RpcCBhbmQgZW5hYmxlIG11bHRpY2FzdCBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIC8vIENvbGxlY3QgYWxsIGF2YWlsYWJsZSBuZXR3b3JrIGludGVyZmFjZXMgd2l0aCBJUCBhZGRyZXNzZXNcbiAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZXMgPSBuZXR3b3JrSW50ZXJmYWNlcygpXG4gICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMgPSBudWxsXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENvbGxlY3QgYWxsIElQdjQgYWRkcmVzc2VzXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhpbnRlcmZhY2VzKS5mb3JFYWNoKChpbnRlcmZhY2VOYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgaW50ZXJmYWNlc1tpbnRlcmZhY2VOYW1lXS5mb3JFYWNoKChpZmFjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBGaWx0ZXIgb3V0IGxvb3BiYWNrIGFuZCBsb2NhbCBhZGRyZXNzZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlmYWNlLmZhbWlseSA9PT0gJ0lQdjQnICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgIWlmYWNlLmFkZHJlc3Muc3RhcnRzV2l0aCgnMTI3LicpICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgIWlmYWNlLmFkZHJlc3Muc3RhcnRzV2l0aCgnMTY5LjI1NC4nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMgPSBbXVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGludGVyZmFjZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogaWZhY2UuYWRkcmVzc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBTYXZlIHRoZSBvbGQgSVAgYWRkcmVzc1xuICAgICAgICAgICAgY29uc3Qgb2xkSG9zdElwID0gdGhpcy5jb25maWcuaG9zdGlwXG5cbiAgICAgICAgICAgIC8vIElmIGEgcHJlZmVycmVkIGludGVyZmFjZSBpcyBzZXQsIHVzZSBpdCB0byBxdWlja2x5IGdldCBhbiBJUFxuICAgICAgICAgICAgaWYgKHRoaXMucHJlZmVycmVkSW50ZXJmYWNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZmVycmVkID0gdGhpcy5hdmFpbGFibGVJbnRlcmZhY2VzPy5maW5kKGlmYWNlID0+IGlmYWNlLm5hbWUgPT09IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlKVxuICAgICAgICAgICAgICAgIGlmIChwcmVmZXJyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gcHJlZmVycmVkLmFkZHJlc3NcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaW50ZXJmYWNlID0gcHJlZmVycmVkLm5hbWVcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYSBnYXRld2F5IGV4aXN0cyBmb3IgdGhlIHByZWZlcnJlZCBpbnRlcmZhY2VcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHtnYXRld2F5LCB2ZXJzaW9uLCBpbnR9ID0gZ2F0ZXdheTRzeW5jKHByZWZlcnJlZC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGludCA9PT0gdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2VcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHtnYXRld2F5LCB2ZXJzaW9uLCBpbnR9ID0gIGdhdGV3YXk0c3luYygpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaW50KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBpbnRcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKSAvL3RoaXMgZGVsaXZlcnMgYW4gaXAgZXZlbiBpZiBnYXRld2F5IGlzIG5vdCBzZXQgLSB0aGUgZmlyc3QgaXAgYWRkcmVzcyBvZiB0aGUgc3lzdGVtXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2UgdGhpcyBhZGRyZXNzIHRvIGZpbmQgdGhlIG5hbWUgb2YgdGhlIGludGVyZmFjZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IE9iamVjdC5rZXlzKGludGVyZmFjZXMpLmZpbmQoa2V5ID0+IGludGVyZmFjZXNba2V5XS5zb21lKGlmYWNlID0+IGlmYWNlLmFkZHJlc3MgPT09IHRoaXMuY29uZmlnLmhvc3RpcCkpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBpbnRlcmZhY2VOYW1lXG5cbiAgICAgICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaW50ZXJmYWNlID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBtdWx0aWNhc3QgY2xpZW50IGlzIHJ1bm5pbmcgLSBvdGhlcndpc2Ugc3RhcnQgaXRcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT0gXCIxMjcuMC4wLjFcIikgeyB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZSB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBJUCBoYXMgY2hhbmdlZCBhbmQgcmVpbml0aWFsaXplIGV2ZXJ5dGhpbmcgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBpZiAob2xkSG9zdElwICE9PSB0aGlzLmNvbmZpZy5ob3N0aXAgJiYgdGhpcy5jb25maWcuaG9zdGlwKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG1haW46IElQIGNoYW5nZWQgZnJvbSAke29sZEhvc3RJcH0gdG8gJHt0aGlzLmNvbmZpZy5ob3N0aXB9LCByZWluaXRpYWxpemluZyBzZXJ2aWNlcy4uLmApXG5cbiAgICAgICAgICAgICAgICAvLyBSZWluaXRpYWxpemUgbXVsdGljYXN0IGNsaWVudCBvbiBJUCBjaGFuZ2UgKG11bHRpY2FzdGNsaWVudCBpcyBvbmx5IHVzZWQgZm9yIGRpc2NvdmVyeSBvZiBvdGhlciBleGFtIHNlcnZlcnMpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudC5hZGRyZXNzKCkpIHsgLy8gY2hlY2sgaWYgbXVsdGljYXN0IGNsaWVudCBpcyBhY3R1YWxseSBydW5uaW5nXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm11bHRpY2FzdENsaWVudC5zdG9wKClcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdtYWluOiBNdWx0aWNhc3QgY2xpZW50IHJlaW5pdGlhbGl6ZWQnKVxuICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluOiBGYWlsZWQgdG8gcmVpbml0aWFsaXplIG11bHRpY2FzdCBjbGllbnQ6JywgZSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlc3RhcnQgRXhwcmVzcyBzZXJ2ZXIgb24gSVAgY2hhbmdlXG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VydmVyLmxpc3RlbmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmNsb3NlKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogRXhwcmVzcyBzZXJ2ZXIgc3RvcHBlZCBkdWUgdG8gSVAgY2hhbmdlYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIubGlzdGVuKGNvbmZpZy5zZXJ2ZXJBcGlQb3J0LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtYWluOiBFeHByZXNzIHNlcnZlciByZXN0YXJ0ZWQgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIubGlzdGVuKGNvbmZpZy5zZXJ2ZXJBcGlQb3J0LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYG1haW46IEV4cHJlc3Mgc2VydmVyIHN0YXJ0ZWQgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgLy8gZWxzZSBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmIHRoaXMubXVsdGljYXN0Q2xpZW50ICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpKSB7ICAvLyBJZiBubyBJUCBjaGFuZ2UgYnV0IG11bHRpY2FzdCBjbGllbnQgaXMgbm90IHJ1bm5pbmdcbiAgICAgICAgICAgIC8vICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5pbml0KHRoaXMuY29uZmlnLmdhdGV3YXkpXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IFxuICAgICAgICAgICAgICAgIGhvc3RpcDogdGhpcy5jb25maWcuaG9zdGlwLCBcbiAgICAgICAgICAgICAgICBpbnRlcmZhY2U6IHRoaXMuY29uZmlnLmludGVyZmFjZSxcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVJbnRlcmZhY2VzOiB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMsXG4gICAgICAgICAgICAgICAgcHJlZmVycmVkSW50ZXJmYWNlOiB0aGlzLnByZWZlcnJlZEludGVyZmFjZSBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBkb2VzIHdoYXQgaXQgc2F5cy4uICBpZiBtb3JlIHRoYW4gb25lIGludGVyZmFjZSBpcyBmb3VuZCB0aGlzIHdpbGwgc2V0IHRoZSBwcmVmZXJyZWQgaW50ZXJmYWNlXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzZXRQcmVmZXJyZWRJbnRlcmZhY2UnLCAoZXZlbnQsIGFyZykgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UgPSBhcmdcbiAgICAgICAgfSlcblxuICAgICAgICBpcGNNYWluLm9uKCd1bnNldFByZWZlcnJlZEludGVyZmFjZScsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UgPSBmYWxzZVxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IFxuICAgICAgICAgICAgICAgIGhvc3RpcDogdGhpcy5jb25maWcuaG9zdGlwLCBcbiAgICAgICAgICAgICAgICBpbnRlcmZhY2U6IHRoaXMuY29uZmlnLmludGVyZmFjZSxcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVJbnRlcmZhY2VzOiB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMsXG4gICAgICAgICAgICAgICAgcHJlZmVycmVkSW50ZXJmYWNlOiB0aGlzLnByZWZlcnJlZEludGVyZmFjZSBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogRG93bmxvYWRzIHRoZSBmaWxlcyBmb3IgYSBzcGVjaWZpYyBzdHVkZW50IHRvIGhpcyB3b3JrZGlyZWN0b3J5IChhYmdhYmUpXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZU9uZWRyaXZlRmlsZXMnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICBsb2cuaW5mbyhcImRvd25sb2FkaW5nIG9uZWRyaXZlIGZpbGVzLi4uXCIpICBcbiAgICAgICAgICAgIGNvbnN0IHN0dWRlbnROYW1lID0gYXJncy5zdHVkZW50TmFtZVxuICAgICAgICAgICAgY29uc3QgYWNjZXNzVG9rZW4gPSBhcmdzLmFjY2Vzc1Rva2VuXG4gICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IGFyZ3MuZmlsZU5hbWVcbiAgICAgICAgICAgIGNvbnN0IGZpbGVJRCA9IGFyZ3MuZmlsZUlEXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJuYW1lID0gYXJncy5zZXJ2ZXJuYW1lXG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSB1c2VyIGFiZ2FiZSBkaXJlY3RvcnkgIC8vIGNyZWF0ZSBhcmNoaXZlIGRpcmVjdG9yeVxuICAgICAgICAgICAgbGV0IHN0dWRlbnRkaXJlY3RvcnkgPSAgam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgc2VydmVybmFtZSAsc3R1ZGVudE5hbWUpXG4gICAgICAgICAgICBsZXQgdGltZSA9IG5ldyBEYXRlKG5ldyBEYXRlKCkuZ2V0VGltZSgpKS50b0xvY2FsZVRpbWVTdHJpbmcoKTsgIC8vY29udmVydCB0byBsb2NhbGUgc3RyaW5nIG90aGVyd2lzZSB0aGUgZm9sZGVybmFtZXMgd2lsbCBiZSBjcmVhdGVkIGluIFVUQ1xuICAgICAgICAgICAgbGV0IHRzdHJpbmcgPSBTdHJpbmcodGltZSkucmVwbGFjZSgvOi9nLCBcIl9cIik7XG4gICAgICAgICAgICBsZXQgc3R1ZGVudGFyY2hpdmVkaXIgPSBqb2luKHN0dWRlbnRkaXJlY3RvcnksIHRzdHJpbmcpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHN0dWRlbnRkaXJlY3RvcnkpKSB7IGZzLm1rZGlyU3luYyhzdHVkZW50ZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc3R1ZGVudGFyY2hpdmVkaXIpKXsgZnMubWtkaXJTeW5jKHN0dWRlbnRhcmNoaXZlZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge2xvZy5lcnJvcihlKX1cbiAgICAgICAgIFxuXG4gICAgICAgICAgICBjb25zdCBmaWxlUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9ncmFwaC5taWNyb3NvZnQuY29tL3YxLjAvbWUvZHJpdmUvaXRlbXMvJHtmaWxlSUR9L2NvbnRlbnRgLCB7XG4gICAgICAgICAgICAgICAgaGVhZGVyczogeydBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2FjY2Vzc1Rva2VufWAsICB9LFxuICAgICAgICAgICAgfSkuY2F0Y2goIGVyciA9PiB7bG9nLmVycm9yKGVycil9KTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlQnVmZmVyID0gYXdhaXQgZmlsZVJlc3BvbnNlLmFycmF5QnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhqb2luKHN0dWRlbnRhcmNoaXZlZGlyLCBmaWxlTmFtZSksIEJ1ZmZlci5mcm9tKGZpbGVCdWZmZXIpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtsb2cuZXJyb3IoZSl9XG5cbiAgICAgICAgICAgIGNvbnN0IHBkZkZpbGVSZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20vdjEuMC9tZS9kcml2ZS9pdGVtcy8ke2ZpbGVJRH0vY29udGVudD9mb3JtYXQ9cGRmYCwge1xuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHthY2Nlc3NUb2tlbn1gLCAgfSxcbiAgICAgICAgICAgIH0pLmNhdGNoKCBlcnIgPT4ge2xvZy5lcnJvcihlcnIpfSk7XG5cbiAgICAgICAgICAgIGlmIChwZGZGaWxlUmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwZGZGaWxlQnVmZmVyID0gYXdhaXQgcGRmRmlsZVJlc3BvbnNlLmFycmF5QnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmRmlsZVBhdGggPSBqb2luKHN0dWRlbnRhcmNoaXZlZGlyLCBgJHtmaWxlTmFtZX0ucGRmYCk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwZGZGaWxlUGF0aCwgQnVmZmVyLmZyb20ocGRmRmlsZUJ1ZmZlcikpO1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgRG93bmxvYWRlZCAke2ZpbGVOYW1lfSBhbmQgJHtmaWxlTmFtZX0ucGRmYCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge2xvZy5lcnJvcihlKX0gIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwidGhlcmUgd2FzIGEgcHJvYmxlbSBkb3dubG9hZGluZyB0aGUgZmlsZXMgYXMgcGRmXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSlcblxuXG5cbiAgICB9XG5cbiAgICBpc1BkZlVybCh1cmwpIHtcbiAgICAgICAgbGV0IHBkZiA9IGZhbHNlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgIHBkZiA9ICB1cmwudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLnBkZicpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyOiBpc1BkZlVybDogJHtlcnJ9YCkgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBkZlxuICAgIH1cblxuICAgIGNvcHlDb25maWcoY29uZikge1xuICAgICAgICBsZXQgY29uZmlnQ29weSA9IHtcbiAgICAgICAgICAgIGRldmVsb3BtZW50OiBjb25mLmRldmVsb3BtZW50LCBcbiAgICAgICAgICAgIHNob3dkZXZ0b29sczogY29uZi5zaG93ZGV2dG9vbHMsXG4gICAgICAgICAgICBiaXBJbnRlZ3JhdGlvbjogY29uZi5iaXBJbnRlZ3JhdGlvbixcbiAgICAgICAgICAgIGJpcERlbW86IGNvbmYuYmlwRGVtbyxcbiAgICAgICAgICAgIHdvcmtkaXJlY3Rvcnk6IGNvbmYud29ya2RpcmVjdG9yeSxcbiAgICAgICAgICAgIHRlbXBkaXJlY3Rvcnk6IGNvbmYudGVtcGRpcmVjdG9yeSxcbiAgICAgICAgICAgIHNlcnZlcmRpcmVjdG9yeTogY29uZi5zZXJ2ZXJkaXJlY3RvcnksXG4gICAgICAgICAgIFxuICAgICAgICAgICAgc2VydmVyQXBpUG9ydDogY29uZi5zZXJ2ZXJBcGlQb3J0LFxuICAgICAgICAgICAgbXVsdGljYXN0Q2xpZW50UG9ydDogY29uZi5tdWx0aWNhc3RDbGllbnRQb3J0LFxuICAgICAgICAgICAgbXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydDogY29uZi5tdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0LFxuICAgICAgICAgICBcbiAgICAgICAgICAgIG11bHRpY2FzdFNlcnZlckFkcnI6IGNvbmYubXVsdGljYXN0U2VydmVyQWRycixcbiAgICAgICAgICAgIGhvc3RpcDogY29uZi5ob3N0aXAsXG4gICAgICAgICAgICBnYXRld2F5OiBjb25mLmdhdGV3YXksXG4gICAgICAgICAgICBhY2Nlc3NUb2tlbjogY29uZi5hY2Nlc3NUb2tlbixcbiAgICAgICAgICAgIHZlcnNpb246IGNvbmYudmVyc2lvbixcbiAgICAgICAgICAgIGluZm86IGNvbmYuaW5mbyxcbiAgICAgICAgICAgIGJ1aWxkZm9yV0VCOiBjb25mLmJ1aWxkZm9yV0VCXG4gICAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbmZpZ0NvcHlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFzQkEsT0FBT0EsVUFBUztBQUNoQixPQUFPLFdBQVc7QUFDbEIsU0FBUyxPQUFBQyxNQUFLLGlCQUFBQyxnQkFBZSxrQkFBa0IsYUFBYSxnQkFBZ0IsWUFBWTs7O0FDbkJ4RixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQTtBQUFBLEVBQ2IsY0FBYztBQUFBLEVBQ2QsZ0JBQWdCO0FBQUEsRUFDaEIsU0FBUztBQUFBLEVBRVQsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixpQkFBaUI7QUFBQTtBQUFBLEVBQ2pCLGlCQUFpQjtBQUFBLEVBRWpCLGVBQWU7QUFBQTtBQUFBLEVBQ2YscUJBQXFCO0FBQUE7QUFBQSxFQUNyQiwyQkFBMkI7QUFBQTtBQUFBLEVBRTNCLHFCQUFxQjtBQUFBLEVBQ3JCLFFBQVE7QUFBQTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsZ0JBQWdCLENBQUM7QUFBQSxFQUNqQixhQUFhO0FBQUEsRUFDYixhQUFhO0FBQUEsRUFDYixTQUFTO0FBQUEsRUFFVCxXQUFXO0FBQUEsSUFDUCxLQUFLO0FBQUEsSUFDTCxTQUFTO0FBQUEsSUFDVCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEs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VUFBSSxZQUFZLGVBQWU7QUFBQSxJQUFFO0FBQUEsRUFBQyxDQUFDO0FBQ3pKLGlCQUFlLFNBQVMsWUFBWSxNQUFNO0FBQUcsV0FBTztBQUFBLEVBQU0sQ0FBQztBQUUvRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJsb2ciLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAiUm91dGVyIiwgImxvZyIsICJsb2ciLCAiY3J5cHRvIiwgInBhdGgiLCAibG9nIiwgImxvZyIsICJjb25maWciLCAiYXBwIiwgIl9fZGlybmFtZSIsICJsb2ciLCAicGF0aCIsICJzZXJ2ZXIiLCAiY3J5cHRvIiwgInN0dWRlbnQiLCAicHVibGljUGF0aCIsICJSb3V0ZXIiLCAicGF0aCIsICJmcyIsICJsb2ciLCAicm91dGVyIiwgIlJvdXRlciIsICJ0IiwgInBhdGgiLCAiZnMiLCAicGRmIiwgImV4ZWMiLCAiUm91dGVyIiwgInBhdGgiLCAiZnMiLCAiYXBwIiwgImxvZyIsICJwYXRoIiwgImZzIiwgImZzIiwgIkJyb3dzZXJXaW5kb3ciLCAiZGlhbG9nIiwgImpvaW4iLCAibG9nIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJjb25maWciLCAibG9nIiwgIkJyb3dzZXJXaW5kb3ciLCAiZGlhbG9nIiwgImpvaW4iLCAiZnMiLCAiZ2F0ZXdheTRzeW5jIiwgImlwIiwgInBkZiIsICJhcHAiLCAibG9nIiwgIm9wdGlvbnMiLCAiZXZlbnQiLCAiQnJvd3NlcldpbmRvdyJdCn0K
