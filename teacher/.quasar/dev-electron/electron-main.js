// src-electron/electron-main.js
import log8 from "electron-log";
import chalk from "chalk";
import { app as app4, BrowserWindow as BrowserWindow3, powerSaveBlocker, nativeTheme, globalShortcut, Menu } from "electron";

// src-electron/main/config.js
var config = {
  development: true,
  showdevtools: true,
  bipIntegration: true,
  bipApiUrl: "https://www.bildung.gv.at/webservice/rest/next-exam/teacher",
  workdirectory: "",
  tempdirectory: "",
  backupdirectory: false,
  serverdirectory: "EXAM-TEACHER",
  serverApiPort: 22422,
  multicastClientPort: 6024,
  multicastServerClientPort: 6025,
  multicastServerAdrr: "239.255.255.250",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL2VsZWN0cm9uLW1haW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVycm91dGVzLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3JvdXRlcy9zZXJ2ZXIvY29udHJvbC5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3NjaGVkdWxlcnNlcnZpY2UudHMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9lbi5qc29uIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2RlLmpzb24iLCAiLi4vLi4vc3JjL21zYWx1dGlscy9hdXRoQ29uZmlnLnRzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVyL2RhdGEuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuXG5cbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBzZXJ2ZXIgZnJvbSAnLi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnO1xuXG4vLyBTbyBFbGVjdHJvbiBzaW5nbGUtaW5zdGFuY2UgbG9jayB1c2VzIGEgZGlmZmVyZW50IHVzZXJEYXRhIHRoYW4gc3R1ZGVudCAobG9jayBrZXkgPSB1c2VyRGF0YSArIGV4ZWNQYXRoKVxuYXBwLnNldE5hbWUoJ25leHQtZXhhbS10ZWFjaGVyJyk7XG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxldCBsb2dmaWxlID0gYCR7Y29uZmlnLndvcmtkaXJlY3Rvcnl9L25leHQtZXhhbS10ZWFjaGVyLmxvZ2BcblxubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5cbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIGxvZ2ZpbGUgIH1cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcbmxvZy52ZXJib3NlKGBtYWluIEAgaW5pdDogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IHN0YXJ0aW5nIE5leHQtRXhhbSBUZWFjaGVyIFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW4gQCBpbml0OiBMb2dmaWxlbG9jYXRpb24gYXQgJHtsb2dmaWxlfWApXG5cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7XG4vLyBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdmb3JjZS1kZXZpY2Utc2NhbGUtZmFjdG9yJywgJzEnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2FsbG93LWZpbGUtYWNjZXNzLWZyb20tZmlsZXMnKTtcblxuXG5pZiAoY29uZmlnLndvcmtkaXJlY3RvcnkpIHtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCd1c2VyLWRhdGEtZGlyJywgY29uZmlnLndvcmtkaXJlY3RvcnkpO1xufVxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluOiBFUElQRSBFcnJvcjogRGVyIHN0ZG91dC1TdHJlYW0gZGVzIEVsZWN0cm9uTG9nZ2VycyB3aXJkIGRlYWt0aXZpZXJ0LicpO1xuICAgIH0gXG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW46JywgZXJyLm1lc3NhZ2UpOyB9ICAvLyBBbmRlcmUgRmVobGVyIHByb3Rva29sbGllcmVuIG9kZXIgYW56ZWlnZW5cbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKVxuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkge1xuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuIC8vIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udHJvbCBvdmVyIGNvbnNvbGUgZXJyb3JzXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUsIGZyYW1lUHJvY2Vzc0lkLCBmcmFtZVJvdXRpbmdJZCkgPT4ge1xuICAgICAgICAvLyBMb2cgdGhlIGVycm9yIGJ1dCBkb24ndCBjcmFzaCB0aGUgYXBwXG4gICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhhbmRsZSBzcGVjaWZpYyBlcnJvciBjb2Rlc1xuICAgICAgICBpZiAoZXJyb3JDb2RlID09PSAtMykge1xuICAgICAgICAgICAgLy8gLTMgaXMgRVJSX0FCT1JURUQsIG9mdGVuIHJlbGF0ZWQgdG8gYmxvYiBVUkxzIG9yIFBERiB2aWV3ZXJzXG4gICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IEFib3J0ZWQgbG9hZCBmb3IgYmxvYiBVUkwgb3IgUERGIHZpZXdlciAtIHRoaXMgaXMgdXN1YWxseSBzYWZlIHRvIGlnbm9yZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGb3Igb3RoZXIgZXJyb3IgY29kZXMsIGxvZyBidXQgY29udGludWVcbiAgICAgICAgaWYgKGVycm9yQ29kZSAhPT0gLTMpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IFVuZXhwZWN0ZWQgZXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufWApO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cgPSBudWxsXG4gICAgLy9pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIGFwcC5xdWl0KClcbiAgICBhcHAucXVpdCgpXG59KVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSkgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpfSAvLyBpZiB0aGVyZSBpcyBhIHdpbmRvdyAtIGZvY3VzXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KCkgfSAgICAgICAvLyBpZiBub3QgY3JlYXRlIG5ld1xufSlcblxuYXBwLndoZW5SZWFkeSgpLnRoZW4oKCk9PnsgICAgXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgLy8gc3RhcnQgZXhwcmVzcyBBUElcbiAgICAgICAgbG9nLmluZm8oYG1haW4gQCByZWFkeTogRXhwcmVzcyBsaXN0ZW5pbmcgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICB9KSBcbn0pXG4udGhlbihhc3luYyAoKT0+e1xuICAgIG5hdGl2ZVRoZW1lLnRoZW1lU291cmNlID0gJ2xpZ2h0JyAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3QgYXBwbHkgZGFyayBzeXN0ZW0gdGhlbWVzICh3ZSBoYXZlIGRhcmsgaWNvbnMgaW4gZWRpdG9yKVxuICAgIFxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG4gICAgcG93ZXJTYXZlQmxvY2tlci5zdGFydCgncHJldmVudC1kaXNwbGF5LXNsZWVwJylcblxuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KClcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K0QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcblxufSkiLCAiLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLFxuICAgIHNob3dkZXZ0b29sczogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBBcGlVcmw6ICdodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L3dlYnNlcnZpY2UvcmVzdC9uZXh0LWV4YW0vdGVhY2hlcicsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIixcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIixcbiAgICBiYWNrdXBkaXJlY3Rvcnk6IGZhbHNlLFxuICAgIHNlcnZlcmRpcmVjdG9yeTogJ0VYQU0tVEVBQ0hFUicsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMixcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LFxuICAgIG11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQ6IDYwMjUsXG5cbiAgICBtdWx0aWNhc3RTZXJ2ZXJBZHJyOiAnMjM5LjI1NS4yNTUuMjUwJyxcbiAgICBob3N0aXA6IFwiMC4wLjAuMFwiLFxuICAgIGdhdGV3YXk6IHRydWUsXG4gICAgZXhhbVNlcnZlckxpc3Q6IHt9LFxuICAgIGFjY2Vzc1Rva2VuOiBmYWxzZSxcbiAgICBidWlsZGZvcldFQjogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG5cbiAgICBleGFtbW9kZXM6IHtcbiAgICAgICAgcmRwOiB0cnVlLFxuICAgICAgICB3ZWJzaXRlOiB0cnVlLFxuICAgICAgICBnZm9ybXM6IHRydWUsXG4gICAgICAgIGVkdXZpZHVhbDogdHJ1ZSxcbiAgICAgICAgZWRpdG9yOiB0cnVlLFxuICAgICAgICBtYXRoOiB0cnVlLFxuICAgICAgICBtaWNyb3NvZnQzNjU6IHRydWUsXG4gICAgICAgIGFjdGl2ZXNoZWV0czogdHJ1ZVxuICAgIH0sXG5cbiAgICB2ZXJzaW9uOiAnMi4wLjAuMScsXG4gICAgYnVpbGREYXRlOiAnMjAyNjAyMDUnLFxuICAgIGJ1aWxkTnVtYmVyOiAnMScsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIlxuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJ1xuaW1wb3J0IGNvcnMgZnJvbSAnY29ycydcbmltcG9ydCBmaWxlVXBsb2FkIGZyb20gXCJleHByZXNzLWZpbGV1cGxvYWRcIjtcbmltcG9ydCB7c2VydmVyUm91dGVyfSBmcm9tICcuL3JvdXRlcy9zZXJ2ZXJyb3V0ZXMuanMnIFxuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgZnNFeHRyYSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCByYXRlTGltaXQgIGZyb20gJ2V4cHJlc3MtcmF0ZS1saW1pdCcgIC8vc2ltcGxlIGRkb3MgcHJvdGVjdGlvblxuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHppcCBmcm9tICdleHByZXNzLWVhc3ktemlwJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGZvcmdlIGZyb20gJ25vZGUtZm9yZ2UnXG5mb3JnZS5vcHRpb25zLnVzZVB1cmVKYXZhU2NyaXB0ID0gdHJ1ZTsgXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG11bHRpY2FzdENsaWVudCBmcm9tICcuLi8uLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tICdjb29raWUtcGFyc2VyJ1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuY29uZmlnLmhvbWVkaXJlY3RvcnkgPSBvcy5ob21lZGlyKClcbmNvbmZpZy53b3JrZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy5ob21lZGlyZWN0b3J5LCBjb25maWcuc2VydmVyZGlyZWN0b3J5KTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKVxuXG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cblxuXG4vLyBEZWZpbmUgdGhlIGRlc2t0b3AgcGF0aCBiYXNlZCBvbiB0aGUgcGxhdGZvcm1cbmNvbnN0IGRlc2t0b3BQYXRoID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xuICAgID8gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpXG4gICAgOiBwYXRoLmpvaW4oY29uZmlnLmhvbWVkaXJlY3RvcnksICdEZXNrdG9wJyk7XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGlua1xuaWYgKCFmcy5leGlzdHNTeW5jKGRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKGRlc2t0b3BQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSAgLy8gQ2hlY2sgaWYgdGhlIGRlc2t0b3AgZm9sZGVyIGV4aXN0cyBhbmQgY3JlYXRlIGlmIGl0IGRvZXNuJ3RcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKGRlc2t0b3BQYXRoLCBjb25maWcuc2VydmVyZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbjogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxuXG5cbnRyeSB7XG4gICAgY29uc3Qge2dhdGV3YXksIGludGVyZmFjZTogaWZhY2V9ID0gIGdhdGV3YXk0c3luYygpXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW46IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuXG4gfVxuXG5cblxuXG5cbmNvbnN0IGxpbWl0ZXIgPSByYXRlTGltaXQoe1xuICAgIHdpbmRvd01zOiAxICogNjAgKiAxMDAwLCAvLyAxIG1pbnV0ZXNcbiAgICBtYXg6IDQwMCwgLy8gTGltaXQgZWFjaCBJUCB0byA0MDAgcmVxdWVzdHMgcGVyIGB3aW5kb3dgIFxuICAgIHN0YW5kYXJkSGVhZGVyczogdHJ1ZSwgLy8gUmV0dXJuIHJhdGUgbGltaXQgaW5mbyBpbiB0aGUgYFJhdGVMaW1pdC0qYCBoZWFkZXJzXG4gICAgbGVnYWN5SGVhZGVyczogZmFsc2UsIC8vIERpc2FibGUgdGhlIGBYLVJhdGVMaW1pdC0qYCBoZWFkZXJzXG59KVxuXG4vLyBjbGVhbiB0ZW1wIGRpcmVjdG9yeVxuZnNFeHRyYS5lbXB0eURpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpXG5cbi8vIExlZ2VuIFNpZSBkZW4gUGZhZCB6dXIgYHB1YmxpYy9gLVJlc3NvdXJjZSBiYXNpZXJlbmQgYXVmIGRlbSBNb2R1cyBmZXN0LlxuY29uc3QgcHVibGljUGF0aCA9IGFwcC5pc1BhY2thZ2VkXG4gID8gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJylcbiAgOiBwYXRoLmpvaW4oJ3B1YmxpYycpO1xuXG4vLyBLb3BpZXJlbiBTaWUgZGVuIEluaGFsdCB2b24gYHB1YmxpYy9gIGluIGRhcyBgY29uZmlnLnRlbXBkaXJlY3RvcnlgLlxuLy8gZnNFeHRyYS5jb3B5KHB1YmxpY1BhdGgsIGAke2NvbmZpZy50ZW1wZGlyZWN0b3J5fS9gLCBmdW5jdGlvbiAoZXJyKSB7XG4vLyAgIGlmIChlcnIpIHJldHVybiBjb25zb2xlLmVycm9yKGVycik7XG4vLyAgIGxvZy5pbmZvKCdzZXJ2ZXI6IGNvcGllZCBwdWJsaWMgZGlyZWN0b3J5IHRvIHRlbXAuLi4nKTtcbi8vIH0pO1xuXG5cblxuXG5cblxuLy8gaW5pdCBleHByZXNzIEFQSVxuY29uc3QgYXBpID0gZXhwcmVzcygpXG5hcGkudXNlKGZpbGVVcGxvYWQoeyBsaW1pdHM6IHsgZmlsZVNpemU6IDUwICogMTAyNCAqIDEwMjQgfSwgfSkpICAvL1doZW4geW91IHVwbG9hZCBhIGZpbGUsIHRoZSBmaWxlIHdpbGwgYmUgYWNjZXNzaWJsZSBmcm9tIHJlcS5maWxlcyAoaW5pdCBiZWZvcmUgcm91dGVzKVxuYXBpLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogJzUwbWInIH0pKVxuYXBpLnVzZShleHByZXNzLnVybGVuY29kZWQoe2V4dGVuZGVkOiB0cnVlfSkpO1xuYXBpLnVzZSh6aXAoKSlcbmFwaS51c2UoY29ycygpKVxuYXBpLnVzZShcIi9zdGF0aWNcIixleHByZXNzLnN0YXRpYyhjb25maWcudGVtcGRpcmVjdG9yeSkpO1xuYXBpLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbi8vIFRyYWNrIGNvbm5lY3Rpb24gbWV0cmljcyBmb3IgbW9uaXRvcmluZyAoZGVjbGFyZWQgaGVyZSBzbyBpdCBjYW4gYmUgdXNlZCBpbiBtaWRkbGV3YXJlKVxubGV0IGFjdGl2ZUNvbm5lY3Rpb25zID0gMDtcblxuLy8gUmVxdWVzdCBtb25pdG9yaW5nIG1pZGRsZXdhcmUgLSBsb2dzIHJlcXVlc3QgZHVyYXRpb24gYW5kIHdhcm5zIG9uIHNsb3cgcmVxdWVzdHNcbmFwaS51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXF1ZXN0SWQgPSBgJHtyZXEubWV0aG9kfSAke3JlcS51cmx9YDtcbiAgICBcbiAgICByZXMub24oJ2ZpbmlzaCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICBpZiAoZHVyYXRpb24gPiA1MDAwKSB7IC8vIFdhcm4gaWYgcmVxdWVzdCB0YWtlcyBsb25nZXIgdGhhbiA1IHNlY29uZHNcbiAgICAgICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IFNsb3cgcmVxdWVzdCBkZXRlY3RlZDogJHtyZXF1ZXN0SWR9IHRvb2sgJHtkdXJhdGlvbn1tc2ApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhY3RpdmVDb25uZWN0aW9ucyA+IDE1MCkge1xuICAgICAgICAgICAgbG9nLndhcm4oYHNlcnZlcjogSGlnaCBsb2FkIC0gJHthY3RpdmVDb25uZWN0aW9uc30gYWN0aXZlIGNvbm5lY3Rpb25zIGR1cmluZyAke3JlcXVlc3RJZH1gKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIHJlcy5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgICAgICBsb2cud2Fybihgc2VydmVyOiBSZXF1ZXN0IGNsb3NlZCBiZWZvcmUgY29tcGxldGlvbjogJHtyZXF1ZXN0SWR9IGFmdGVyICR7ZHVyYXRpb259bXNgKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIG5leHQoKTtcbn0pO1xuXG5hcGkudXNlKCcvc2VydmVyJywgc2VydmVyUm91dGVyKVxuLy9hcGkudXNlKGxpbWl0ZXIpICAvL2Rpc2FibGVkIGZvciBub3cgYmVjYXVzZSB0aGlzIG5lZWQgYSBsb3Qgb2YgdGVzdGluZyB0byBmaW5kIGdvb2QgcGFyYW1ldGVyc1xuXG5cblxuXG5cblxuXG5cblxubGV0IGNlcnRzID0gY3JlYXRlQ0FDZXJ0KCkgIC8vIHdlIGNhbiBub3QgdXNlIHNlbGYgc2lnbmVkIGNlcnRzIGZvciB3ZWIgKGZhbGxiYWNrIHRvIGxldCdzIGVuY3J5cHQhKVxuXG52YXIgb3B0aW9ucyA9IHtcbiAgICBrZXk6IGNlcnRzLmtleSxcbiAgICBjZXJ0OiBjZXJ0cy5jZXJ0LFxuICAgIHJlcXVlc3RDZXJ0OiBmYWxzZSxcbiAgICByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlLFxuICAgIGFnZW50OiBmYWxzZVxuICB9O1xuXG5jb25zdCBzZXJ2ZXIgPSBodHRwcy5jcmVhdGVTZXJ2ZXIob3B0aW9ucywgYXBpKTtcblxuLy8gQ29uZmlndXJlIHRpbWVvdXRzIGFuZCBjb25uZWN0aW9uIGxpbWl0cyB0byBwcmV2ZW50IHJlc291cmNlIGV4aGF1c3Rpb25cbnNlcnZlci50aW1lb3V0ID0gMzAwMDA7IC8vIDMwIHNlY29uZHMgLSBjbG9zZSBpZGxlIGNvbm5lY3Rpb25zIGFmdGVyIDMwc1xuc2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSA1MDAwOyAvLyA1IHNlY29uZHMgLSBjbG9zZSBrZWVwLWFsaXZlIGNvbm5lY3Rpb25zIGFmdGVyIDVzIG9mIGluYWN0aXZpdHlcbnNlcnZlci5tYXhDb25uZWN0aW9ucyA9IDIwMDsgLy8gTGltaXQgY29uY3VycmVudCBjb25uZWN0aW9ucyB0byBwcmV2ZW50IG92ZXJsb2FkXG5cbi8vIFRyYWNrIGNvbm5lY3Rpb24gbWV0cmljcyBmb3IgbW9uaXRvcmluZ1xuc2VydmVyLm9uKCdjb25uZWN0aW9uJywgKHNvY2tldCkgPT4ge1xuICAgIGFjdGl2ZUNvbm5lY3Rpb25zKys7XG4gICAgaWYgKGFjdGl2ZUNvbm5lY3Rpb25zID4gMTUwKSB7XG4gICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IEhpZ2ggY29ubmVjdGlvbiBjb3VudDogJHthY3RpdmVDb25uZWN0aW9uc31gKTtcbiAgICB9XG4gICAgc29ja2V0Lm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgYWN0aXZlQ29ubmVjdGlvbnMtLTtcbiAgICB9KTtcbn0pO1xuXG5pZiAoY29uZmlnLmJ1aWxkZm9yV0VCKXsgIC8vIHRoZSBhcGkgaXMgc3RhcnRlZCBieSB0aGUgZWxlY3Ryb24gbWFpbiBwcm9jZXNzIC0gZm9yIHdlYiB3ZSBkbyBpdCBoZXJlXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgXG4gICAgICAgIGxvZy5pbmZvKGBzZXJ2ZXI6IEV4cHJlc3MgbGlzdGVuaW5nIG9uIGh0dHBzOi8vJHtjb25maWcuaG9zdGlwfToke2NvbmZpZy5zZXJ2ZXJBcGlQb3J0fWApXG4gICAgfSlcbiAgICBpZiAoY29uZmlnLmhvc3RpcCkge1xuICAgICAgICBtdWx0aWNhc3RDbGllbnQuaW5pdCgpXG4gICAgfVxufVxuXG4gXG4gXG5cblxuZXhwb3J0IGRlZmF1bHQgc2VydmVyO1xuXG5cblxuXG5mdW5jdGlvbiBjcmVhdGVDQUNlcnQoKSB7XG4gICAgbGV0IHJzYSA9ICBmb3JnZS5wa2kucnNhO1xuICAgIGxldCBwa2kgPSBmb3JnZS5wa2k7XG4gICAgbGV0IHNlZWQgPSBmb3JnZS5yYW5kb20uZ2V0Qnl0ZXNTeW5jKDMyKTtcbiAgICBsZXQga2V5cyA9IHJzYS5nZW5lcmF0ZUtleVBhaXIoe2JpdHM6IDEwMjQsIHNlZWQ6IHNlZWR9KTtcbiAgICB2YXIgY2VydCA9IHBraS5jcmVhdGVDZXJ0aWZpY2F0ZSgpO1xuICAgIGNlcnQucHVibGljS2V5ID0ga2V5cy5wdWJsaWNLZXk7XG4gICAgY2VydC5wcml2YXRlS2V5ID0ga2V5cy5wcml2YXRlS2V5O1xuICAgIGNlcnQuc2lnbihrZXlzLnByaXZhdGVLZXkpO1xuICAgIHZhciBwZW1fcGtleSA9IHBraS5wcml2YXRlS2V5VG9QZW0oa2V5cy5wcml2YXRlS2V5KTtcbiAgICB2YXIgcGVtX2NlcnQgPSBwa2kuY2VydGlmaWNhdGVUb1BlbShjZXJ0KTtcbiAgICByZXR1cm4ge2tleTogcGVtX3BrZXkgLCBjZXJ0OiBwZW1fY2VydH1cbn07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgUm91dGVyIH0gZnJvbSAnZXhwcmVzcyc7XG5leHBvcnQgY29uc3Qgc2VydmVyUm91dGVyID0gUm91dGVyKClcblxuaW1wb3J0IGNvbnRyb2xSb3V0ZXMgZnJvbSAnLi9zZXJ2ZXIvY29udHJvbC5qcyc7XG5pbXBvcnQgZGF0YVJvdXRlcyBmcm9tICcuL3NlcnZlci9kYXRhLmpzJztcblxuXG5zZXJ2ZXJSb3V0ZXIudXNlKCcvY29udHJvbC8nLCBjb250cm9sUm91dGVzKTtcbnNlcnZlclJvdXRlci51c2UoJy9kYXRhLycsIGRhdGFSb3V0ZXMpO1xuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdleHByZXNzJ1xuY29uc3Qgcm91dGVyID0gUm91dGVyKClcbmltcG9ydCBtdWx0aUNhc3RzZXJ2ZXIgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcydcbmltcG9ydCBtdWx0aUNhc3RjbGllbnQgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9jb25maWcuanMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbmNvbnN0IHsgdCB9ID0gaTE4bi5nbG9iYWxcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgcXMgZnJvbSAncXMnXG5pbXBvcnQgYXhpb3MgZnJvbSBcImF4aW9zXCJcbmltcG9ydCB7IG1zYWxDb25maWcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbXNhbHV0aWxzL2F1dGhDb25maWcudHMnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4uLy4uLy4uLy4uL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xubGV0IFRlc3NlcmFjdFdvcmtlciA9IGZhbHNlXG5cbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJ1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbmNvbnN0IGZzcCA9IGZzLnByb21pc2VzIFxuXG4vKipcbiAqIHRoaXMgcm91dGUgZ2VuZXJhdGVzIHRoZSBuZXNzZXNhcnkgY29kZVZlcmlmaWVyIGFuZCBjb2RlQ2hhbGxlbmdlIGZcdTAwRkNyIFBLQ0UgXG4gKiBhdXRob3JpemF0aW9uIGZsb3cgZm9yIHRoZSBtaWNyb3NvZnQgb25lZHJpdmUgZ3JhcGggQVBJXG4gKiBpdCByZWNlaXZlcyBhIGNvZGUgYW5kIHRoZW4gcmVkaXJlY3RzIHRvIC9tc2F1dGggd2hpY2ggd2lsbCBhcXVpcmUgYW5cbiAqIGFjY2Vzc3Rva2VuXG4gKi9cbiAgXG5yb3V0ZXIuZ2V0KCcvb2F1dGgnLCAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCBjb2RlVmVyaWZpZXIgPSBnZW5lcmF0ZUNvZGVWZXJpZmllcigpO1xuICAgIGNvbnN0IGNvZGVDaGFsbGVuZ2UgPSBiYXNlNjRVcmxFbmNvZGUoc2hhMjU2KEJ1ZmZlci5mcm9tKGNvZGVWZXJpZmllciwgJ3V0Zi04JykpKTtcbiAgICByZXMuY29va2llKCdjb2RlVmVyaWZpZXInLCBjb2RlVmVyaWZpZXIsIHsgaHR0cE9ubHk6IHRydWUgfSk7XG4gICAgY29uZmlnLmNvZGVWZXJpZmllciA9IGNvZGVWZXJpZmllclxuXG4gICAgY29uc3QgYXV0aFVybFBhcmFtcyA9IHtcbiAgICAgICAgY2xpZW50X2lkOiBtc2FsQ29uZmlnLmF1dGguY2xpZW50SWQsXG4gICAgICAgIHJlc3BvbnNlX3R5cGU6ICdjb2RlJyxcbiAgICAgICAgcmVkaXJlY3RfdXJpOiBtc2FsQ29uZmlnLmF1dGgucmVkaXJlY3RVcmksXG4gICAgICAgIHJlc3BvbnNlX21vZGU6ICdxdWVyeScsXG4gICAgICAgIHNjb3BlOiAnb3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgRmlsZXMuUmVhZFdyaXRlLkFwcEZvbGRlciBGaWxlcy5SZWFkIEZpbGVzLlJlYWRXcml0ZScsXG4gICAgICAgIHN0YXRlOiAnMTIzNDUnLFxuICAgICAgICBjb2RlX2NoYWxsZW5nZTogY29kZUNoYWxsZW5nZSxcbiAgICAgICAgY29kZV9jaGFsbGVuZ2VfbWV0aG9kOiAnUzI1NicsXG4gICAgfTtcbiAgICBjb25zdCBhdXRoVXJsID0gYGh0dHBzOi8vbG9naW4ubWljcm9zb2Z0b25saW5lLmNvbS9jb21tb24vb2F1dGgyL3YyLjAvYXV0aG9yaXplPyR7cXMuc3RyaW5naWZ5KGF1dGhVcmxQYXJhbXMpfWA7XG4gICAgcmVzLnJlZGlyZWN0KGF1dGhVcmwpO1xufSk7XG4gIFxuLyoqXG4gKiB0aGlzIHVzZXMgdGhlIGNvZGUgZnJvbSAvb2F1dGggcm91dGUgdG9nZXRoZXIgd2l0aCB0aGUgY2xpZW50X2lkIHRvIHJlY2VpdmVcbiAqIGFuIGFjY2Vzc1Rva2VuIGZvciB0aGUgbWljcm9zb2Z0IG9uZHJpdmUgQVBJXG4gKiB0aGUgdG9rZW4gaXMgc3RvcmVkIG9uIHRoZSBnbG9iYWwgY29uZmlnIG9iamVjdCBhbmQgY2FuIGJlIHJlcXVlc3RlZCB2aWEgL2dldGNvbmZpZyBvciBpcGNSZW5kZXJlciAnZ2V0Y29uZmlnXG4gKi9cbnJvdXRlci5nZXQoJy9tc2F1dGgnLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCBjb2RlID0gcmVxLnF1ZXJ5LmNvZGU7XG4gICAgY29uc3QgY29kZVZlcmlmaWVyID0gIGNvbmZpZy5jb2RlVmVyaWZpZXI7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5wb3N0KCdodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uL29hdXRoMi92Mi4wL3Rva2VuJywgcXMuc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGNsaWVudF9pZDogbXNhbENvbmZpZy5hdXRoLmNsaWVudElkLFxuICAgICAgICAgICAgZ3JhbnRfdHlwZTogJ2F1dGhvcml6YXRpb25fY29kZScsXG4gICAgICAgICAgICBzY29wZTogJ29wZW5pZCBwcm9maWxlIG9mZmxpbmVfYWNjZXNzIEZpbGVzLlJlYWRXcml0ZS5BcHBGb2xkZXIgRmlsZXMuUmVhZCBGaWxlcy5SZWFkV3JpdGUnLFxuICAgICAgICAgICAgY29kZSxcbiAgICAgICAgICAgIHJlZGlyZWN0X3VyaTogbXNhbENvbmZpZy5hdXRoLnJlZGlyZWN0VXJpLFxuICAgICAgICAgICAgY29kZV92ZXJpZmllcjogY29kZVZlcmlmaWVyLFxuICAgICAgICAgICAgfSksIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL2xvY2FsaG9zdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25maWcuYWNjZXNzVG9rZW4gPSByZXNwb25zZS5kYXRhLmFjY2Vzc190b2tlbiAgICAgLy8gd2UgcmVjZWl2ZWQgdGhlIGFjY2VzcyB0b2tlbiAtIHN0b3JlIGl0IG9uIGdsb2JhbCBjb25maWcgb2JqZWN0XG5cbiAgICAgICAgbGV0IGh0bWwgPSBgXG4gICAgICAgIDwhRE9DVFlQRSBodG1sPlxuICAgICAgICA8aHRtbCBsYW5nPVwiZW5cIj5cbiAgICAgICAgICAgIDxoZWFkPlxuICAgICAgICAgICAgICAgIDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiPlxuICAgICAgICAgICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCI+XG4gICAgICAgICAgICAgICAgPHRpdGxlPkN1c3RvbSBCdXR0b248L3RpdGxlPlxuICAgICAgICAgICAgICAgIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiL3N0YXRpYy9jc3Mvc3RhdGljc3R5bGVzLmNzc1wiPlxuICAgICAgICAgICAgICAgIDxzY3JpcHQ+XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gY2xvc2VXaW5kb3dBZnRlckZvdXJTZWNvbmRzKCkgeyBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyB3aW5kb3cuY2xvc2UoKTsgfSwgNDAwMCk7IH1cbiAgICAgICAgICAgICAgICA8L3NjcmlwdD5cbiAgICAgICAgICAgIDwvaGVhZD5cbiAgICAgICAgICAgIDxib2R5IG9ubG9hZD1cImNsb3NlV2luZG93QWZ0ZXJGb3VyU2Vjb25kcygpXCI+PGJyPlxuICAgICAgICAgICAgICAgIDxoMz5Mb2dpbiBPSyE8L2gzPiA8YnI+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgIDwvaHRtbD5gXG4gICAgICAgIHJlcy5zZW5kKGh0bWwpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IucmVzcG9uc2UuZGF0YSk7XG4gICAgICAgIGxldCBodG1sID0gYFxuICAgICAgICA8IURPQ1RZUEUgaHRtbD5cbiAgICAgICAgPGh0bWwgbGFuZz1cImVuXCI+XG4gICAgICAgICAgICA8aGVhZD5cbiAgICAgICAgICAgICAgICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIj5cbiAgICAgICAgICAgICAgICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMFwiPlxuICAgICAgICAgICAgICAgIDx0aXRsZT5DdXN0b20gQnV0dG9uPC90aXRsZT5cbiAgICAgICAgICAgICAgICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIi9zdGF0aWMvY3NzL3N0YXRpY3N0eWxlcy5jc3NcIj5cbiAgICAgICAgICAgIDwvaGVhZD5cbiAgICAgICAgICAgIDxib2R5Pjxicj5cbiAgICAgICAgICAgICAgICA8aDQ+JHtlcnJvci5yZXNwb25zZS5kYXRhLmVycm9yX2Rlc2NyaXB0aW9ufTwvaDQ+IDxicj5cbiAgICAgICAgICAgICAgICBQbGVhc2UgY2xvc2UgdGhpcyBXaW5kb3cgYW5kIHRyeSBhZ2FpbiEgPGJyPlxuICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz1cIndpbmRvdy5jbG9zZSgpXCIgY2xhc3M9XCJjdXN0b20tYnRuIGN1c3RvbS1idG4tZGFuZ2VyXCI+Q2xvc2UgV2luZG93PC9idXR0b24+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgIDwvaHRtbD5gXG4gICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKGh0bWwpO1xuICAgIH1cbiAgfSk7XG5cblxuXG5cblxuXG4vKipcbiAqIFNUQVJUUyBhbiBleGFtIHNlcnZlciBpbnN0YW5jZVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGNob3NlbiBuYW1lIChmb3IgZXhhbXBsZSBcIm1hdGhlXCIpXG4gKiBAcGFyYW0gcGFzc3dvcmQgdGhlIHBhc3N3b3JkIHRvIGVudGVyIHRoZSBleGFtIChub3QgbmVjY2Vzc2FyeSBvbiBzaW5nbGUgaW5zdGFuY2Ugc3lzdGVtIChhcHApIGJ1dCB3aWxsIGJlIHVzZWQgdG8gZXhpdCBzZWN1cmUgZXhhbSBtb2RlIGluIHRoZSBmdXR1cmUpXG4gKiAjRklYTUUgISEhICBUaGlzIHJvdXRlIG5lZWRzIHRvIGJlIHNlY3VyZWQgKGFueW9uZSBjYW4gc3RhcnQgYSBzZXJ2ZXIgcmlnaHQgbm93IC0gb3IgMTAwMCBzZXJ2ZXJzKVxuICovXG4gcm91dGVyLnBvc3QoJy9zdGFydC86c2VydmVybmFtZS86cGFzc3dkPycsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIC8vIHRoaXMgcm91dGUgbWF5IGJlIHVzZWQgYnkgbG9jYWxob3N0IG9ubHlcbiAgICBpZiAoIXJlcXVlc3RTb3VyY2VBbGxvd2VkKHJlcSwgcmVzKSkgcmV0dXJuICAgLy8gZm9yIHRoZSB3ZWJ2ZXJzaW9uIHdlIG5lZWQgdG8gY2hlY2sgdXNlciBwZXJtaXNzaW9ucyBoZXJlIChmdXR1cmUgc3R1ZmYpXG5cbiAgICBjb25zdCBiaXAgPSByZXEuYm9keS5iaXAgIC8vIHRoaXMgaW5mbyBpcyBhbHNvIHNlbnQgdmlhIG11bHRpY2FzdHNlcnZlciBtZXNzYWdlXG4gICAgY29uc3QgYmlwSWQgPSByZXEuYm9keS5iaXBJZFxuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZSBcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgLy8gbG9nLmluZm8ocmVxLmJvZHkpIC8vIGhvbGRzIHdvcmtkaXI6IHdlIGNvdWxkIHN0b3JlIHRoZSBjdXJyZW50IHdvcmtkaXJlY3RvcnkgZm9yIGV2ZXJ5IG1jc2VydmVyIG9uIG1jc2VydmVyLnNlcnZlcmluZm8gaW4gdGhlIGZ1dHVyZVxuICAgIFxuICAgIC8vZ2VuZXJhdGUgcmFuZG9tIHBpblxuICAgIGxldCBwaW4gPSBTdHJpbmcoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKjkwMDApICsgMTAwMCkgIC8vIDQgZGlnaXRzIGlzIGVub3VnaCAgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogOTAwMCkgKyAxMDAwO1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpeyBwaW4gPSBcIjExMTFcIiB9ICBcblxuICAgIC8vIC8vIGNoZWNrIGlmIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcgbG9jYWxseSBvciBpbiBMQU5cbiAgICBpZiAobWNTZXJ2ZXIpIHsgXG4gICAgICAgIHJldHVybiByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyZXhpc3RzXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgfSBcblxuICAgIGZvciAoY29uc3QgZXhhbSBvZiBtdWx0aUNhc3RjbGllbnQuZXhhbVNlcnZlckxpc3QpIHsgIC8vIGRvIG5vdCB1c2UgZm9yRWFjaCgpIGJlY2F1c2UgaXRzIHJ1biBhc3luYyBhbmQgdGhlIGludGVycHJldGVyIHdpbGwgbm90IHdhaXQgZm9yIGl0IHRvIGZpbmlzaFxuICAgICAgICBpZiAoc2VydmVybmFtZSA9PSBleGFtLnNlcnZlcm5hbWUgKXtcbiAgICAgICAgICAgIHJldHVybiByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyZXhpc3RzTEFOXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgICAgIH1cbiAgICAgfVxuICAgIFxuICAgIGxvZy5pbmZvKCdjb250cm9sIEAgc3RhcnQ6IEluaXRpYWxpemluZyBuZXcgRXhhbSBTZXJ2ZXI6Jywgc2VydmVybmFtZSlcbiAgICBsZXQgbWNzID0gbmV3IG11bHRpQ2FzdHNlcnZlcigpO1xuXG4gICAgaWYgKCFyZXEucGFyYW1zLnBhc3N3ZCl7IFxuICAgICAgICBtY3MuaW5pdChzZXJ2ZXJuYW1lLCBwaW4sIFwiXCIsIGJpcCwgYmlwSWQpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBtY3MuaW5pdChzZXJ2ZXJuYW1lLCBwaW4sIHJlcS5wYXJhbXMucGFzc3dkLCBiaXAsIGJpcElkKVxuICAgIH1cblxuICAgIGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXT1tY3NcbiAgICAvLyBsb2cuaW5mbyhjb25maWcud29ya2RpcmVjdG9yeSlcbiAgICBsZXQgc2VydmVyaW5zdGFuY2VkaXIgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHNlcnZlcm5hbWUpXG5cbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihzZXJ2ZXJpbnN0YW5jZWRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIERpcmVjdG9yeSBtaWdodCBhbHJlYWR5IGV4aXN0LCB0aGF0J3Mgb2tcbiAgICB9XG4gICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnNlcnZlcnN0YXJ0ZWRcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9KVxuICAgIFxufSlcblxuXG5cbi8qKlxuICogU1RPUFMgYW4gZXhhbSBzZXJ2ZXIgaW5zdGFuY2VcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBleGFtIHNlcnZlciBpbiBxdWVzdGlvblxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyBjc3JmIHRva2VuIG5lZWRlZCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IChnZW5lcmF0ZWQgYW5kIHRyYW5zZmVycmVkIHRvIHRoZSB3ZWJicm93c2VyIG9uIGxvZ2luKSBcbiAqL1xuIHJvdXRlci5nZXQoJy9zdG9wc2VydmVyLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIGlmIChtY1NlcnZlciAmJiByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikge1xuICAgICAgXG4gICAgICAgIG1jU2VydmVyLmJyb2FkY2FzdEludGVydmFsLnN0b3AoKVxuXG4gICAgICAgIG1jU2VydmVyLnNlcnZlci5jbG9zZSgpO1xuICAgICAgICAvL2RlbGV0ZSBtY1NlcnZlclxuICAgICAgICBkZWxldGUgY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zZXJ2ZXJzdG9wcGVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSlcblxuICAgICAgICBcbiAgICB9XG59KVxuXG5cbi8qKlxuICogY2hlY2tzIHNlcnZlcnBhc3N3b3JkIGZvciBsb2dpbiB2aWEgVlVFIFJPVVRFUlxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGNob3NlbiBuYW1lIChmb3IgZXhhbXBsZSBcIm1hdGhlXCIpXG4gKiBAcGFyYW0gcGFzc3dkIHRoZSBwYXNzd29yZCBuZWVkZWQgdG8gZW50ZXIgdGhlIGRhc2hib2FyZCAgISFGSVhNRTogdXNlIGh0dHBzIGFuZCBwcm9wZXIgYXV0aCBcbiAqKi9cbiByb3V0ZXIuZ2V0KCcvY2hlY2twYXNzd2QvOnNlcnZlcm5hbWUvOnBhc3N3ZD8nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lIFxuICAgIGxldCBwYXNzd2QgPSByZXEucGFyYW1zLnBhc3N3ZFxuICAgIGlmICghcGFzc3dkKXsgcGFzc3dkID0gXCJcIn0gICAvLyB3ZSBhbGxvdyBlbXB0eSBwYXNzd29yZHMgZm9yIG5vd1xuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICBpZiAobWNTZXJ2ZXIpIHsgXG4gICAgICAgIGlmIChwYXNzd2QgPT09IG1jU2VydmVyLnNlcnZlcmluZm8ucGFzc3dvcmQpeyBcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kKCB7XG4gICAgICAgICAgICBzZW5kZXI6IFwic2VydmVyXCIsIFxuICAgICAgICAgICAgbWVzc2FnZTogdChcImNvbnRyb2wuY29ycmVjdHB3XCIpLCBcbiAgICAgICAgICAgIHN0YXR1czogXCJzdWNjZXNzXCIsIFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcGluOiBtY1NlcnZlci5zZXJ2ZXJpbmZvLnBpbixcbiAgICAgICAgICAgIHNlcnZlcnRva2VuOiBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuLFxuICAgICAgICAgICAgc2VydmVyaXA6IG1jU2VydmVyLnNlcnZlcmluZm8uaXBcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH0gKX0gXG4gICAgICAgIGVsc2UgeyByZXR1cm4gcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLndyb25ncHdcIiksIHN0YXR1czogXCJlcnJvclwifSkgfVxuICAgIH0gXG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiAgc2VuZHMgYSBsaXN0IG9mIGFsbCBydW5uaW5nIGV4YW0gc2VydmVyc1xuICovXG5yb3V0ZXIuZ2V0KCcvc2VydmVybGlzdCcsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGxldCBzZXJ2ZXJsaXN0ID0gW11cbiAgICBPYmplY3QudmFsdWVzKGNvbmZpZy5leGFtU2VydmVyTGlzdCkuZm9yRWFjaCggc2VydmVyID0+IHtcbiAgICAgICAgc2VydmVybGlzdC5wdXNoKHtzZXJ2ZXJuYW1lOiBzZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBpZDogc2VydmVyLnNlcnZlcmluZm8uaWQsIHNlcnZlcmlwOiBzZXJ2ZXIuc2VydmVyaW5mby5pcCwgcmVhY2hhYmxlOiB0cnVlLCBwYXNzd29yZDogc2VydmVyLnNlcnZlcmluZm8ucGFzc3dvcmQsIHZlcnNpb246IHNlcnZlci5zZXJ2ZXJpbmZvLnZlcnNpb259KSBcbiAgICB9KTtcbiAgICByZXMuc2VuZCh7c2VydmVybGlzdDpzZXJ2ZXJsaXN0LCBzdGF0dXM6IFwic3VjY2Vzc1wifSlcbn0pXG5cbi8qKlxuICogIHNlbmRzIGFuIFwiYWxpdmVcIiBzaWduYWwgYmFja1xuICovXG4gcm91dGVyLmdldCgnL3BvbmcnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICByZXMuc2VuZCgncG9uZycpXG59KVxuXG5cbnJvdXRlci5wb3N0KCcvcG9uZycsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIHJlcy5zZW5kKHsgc3RhdHVzOiBcInN1Y2Nlc3NcIn0pXG59KVxuXG5cblxuXG5sZXQgZGVtb2NsaWVudHMgPSBbXVxuZm9yIChsZXQgaSA9IDA7IGk8MTY7IGkrKyApe1xuICAgIGxldCBkZW1vY2xpZW50ID0ge1xuICAgICAgICBjbGllbnRuYW1lOiBgdXNlci0keyBjcnlwdG8ucmFuZG9tQnl0ZXMoNikudG9TdHJpbmcoJ2hleCcpICB9YCxcbiAgICAgICAgdG9rZW46IGBjc3JmLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gLFxuICAgICAgICBpcDogZmFsc2UsXG4gICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgc2VydmVyaXA6IGZhbHNlLFxuICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgIGV4YW1tb2RlOiBmYWxzZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAsXG4gICAgICAgIHZpcnR1YWxpemVkOiB0cnVlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgIGV4YW10eXBlIDogZmFsc2UsXG4gICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICBpbWFnZXVybDpcInVzZXItYmxhY2suc3ZnXCIsXG4gICAgICAgIHN0YXR1cyA6IHt9IFxuICAgIH1cbiAgICBkZW1vY2xpZW50cy5wdXNoKGRlbW9jbGllbnQpXG59XG5cblxuXG5cblxuXG4vKipcbiAqICBSRUdJU1RFUiBDTElFTlRcbiAqICBjaGVja3MgcGluIGNvZGUsIGNyZWF0ZXMgY3NyZiB0b2tlbiBmb3IgY2xpZW50LCBhbnN3ZXJlcyB3aXRoIHRva2VuXG4gKlxuICogIEBwYXJhbSBwaW4gIHRoZSBwaW5jb2RlIHRvIGNvbm5lY3QgdG8gdGhlIHNlcnZlcmluc3RhbmNlXG4gKiAgQHBhcmFtIGNsaWVudG5hbWUgdGhlIG5hbWUgb2YgdGhlIHN0dWRlbnRcbiAqICBAcGFyYW0gY2xpZW50aXAgdGhlIGNsaWVudHMgaXAgYWRkcmVzcyBmb3IgYXBpIGNhbGxzXG4gKi9cblxuXG5cbiByb3V0ZXIuZ2V0KCcvcmVnaXN0ZXJjbGllbnQvOnNlcnZlcm5hbWUvOnBpbi86Y2xpZW50bmFtZS86Y2xpZW50aXAvOmhvc3RuYW1lLzp2ZXJzaW9uLzpiaXB1c2VyaWQnLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjbGllbnRuYW1lID0gcmVxLnBhcmFtcy5jbGllbnRuYW1lXG4gICAgY29uc3QgY2xpZW50aXAgPSByZXEucGFyYW1zLmNsaWVudGlwXG4gICAgY29uc3QgcGluID0gcmVxLnBhcmFtcy5waW5cbiAgICBjb25zdCB2ZXJzaW9uID0gcmVxLnBhcmFtcy52ZXJzaW9uXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHRva2VuID0gYGNzcmYtJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWBcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBob3N0bmFtZSA9IHJlcS5wYXJhbXMuaG9zdG5hbWVcbiAgICBjb25zdCBiaXB1c2VySUQgPSByZXEucGFyYW1zLmJpcHVzZXJpZFxuXG4gICAgbG9nLmluZm8oXCJjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IENsaWVudCBWZXJzaW9uOlwiLHZlcnNpb24pXG4gICAgLy8gdGhpcyBuZWVkcyB0byBjaGFuZ2Ugb25jZSB3ZSByZWFjaGVkIHYxLjAgKGZlYXR1cmVmcmVlemUgZm9yIHN0YWJsZSB2ZXJzaW9uKVxuICAgIGxldCB2dGVhY2hlciA9IGNvbmZpZy52ZXJzaW9uLnNwbGl0KCcuJykuc2xpY2UoMCwgMiksXG4gICAgdmVyc2lvbnRlYWNoZXIgPSB2dGVhY2hlci5qb2luKCcuJyk7IFxuICAgIGxldCB2c3R1ZGVudCA9IHZlcnNpb24uc3BsaXQoJy4nKS5zbGljZSgwLCAyKSxcbiAgICB2ZXJzaW9uc3R1ZGVudCA9IHZzdHVkZW50LmpvaW4oJy4nKTsgXG5cbiAgICAvL2NvbnNvbGUubG9nKHZlcnNpb250ZWFjaGVyLCB2ZXJzaW9uc3R1ZGVudClcbiAgXG4gICAgaWYgKCFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgaWYgKGAke3ZlcnNpb250ZWFjaGVyfWAgIT09IHZlcnNpb25zdHVkZW50ICkgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudmVyc2lvbm1pc21hdGNoXCIpLCBzdGF0dXM6IFwiZXJyb3JcIiwgdmVyc2lvbjogY29uZmlnLnZlcnNpb24sIHZlcnNpb25pbmZvOiBjb25maWcuaW5mb30gKSAgfSAgXG4gICAgXG4gICAgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5yZXF1aXJlQmlQICYmIGJpcHVzZXJJRCA9PSAnZmFsc2UnKXsgLy8gcmVxLnBhcmFtcyBjb21lIGFzIHN0cmluZy4uIG5vdCBuaWNlIGJ1dCBzaW1wbGVcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wuYmlwcmVxdWlyZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApIFxuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAocGluID09IG1jU2VydmVyLnNlcnZlcmluZm8ucGluKSB7XG4gICAgICAgICAgICBsZXQgcmVnaXN0ZXJlZENsaWVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LmNsaWVudG5hbWUgPT09IGNsaWVudG5hbWUpXG4gICAgICAgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmICghcmVnaXN0ZXJlZENsaWVudCkgeyAgIC8vIGNyZWF0ZSBjbGllbnQgb2JqZWN0XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogYWRkaW5nIG5ldyBjbGllbnQgJyR7Y2xpZW50bmFtZX0nYClcblxuXG4gICAgICAgICAgICAgICAgLy9ncm91cCBoYW5kbGluZyAtIGV2ZXJ5Ym9keSBpcyBpbiBncm91cEEgZXhjZXB0IHRoZXJlIGlzIGFscmVhZHkgYSBncm91cCBjb25maWd1cmF0aW9uXG4gICAgICAgICAgICAgICAgbGV0IGdyb3VwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQT8udXNlcnM/LmluY2x1ZGVzKGNsaWVudG5hbWUpKSB7IGdyb3VwID0gJ2EnOyB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQj8udXNlcnM/LmluY2x1ZGVzKGNsaWVudG5hbWUpKSB7IGdyb3VwID0gJ2InOyAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgLy8gdXNlciBpcyBub3QgaW4gYW55IGdyb3VwIG9yIG5vIGdyb3VwIGlzIGNvbmZpZ3VyZWRcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAgPSAnYSdcbiAgICAgICAgICAgICAgICAgICBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEEudXNlcnMucHVzaChjbGllbnRuYW1lKVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY2xpZW50ID0geyAgICAvLyB3ZSBoYXZlIGEgZGlmZmVyZW50IHJlcHJlc2VudGF0aW9uIG9mIHRoZSBjbGllbnRvYmplY3Qgb24gdGhlIHNlcnZlciB0aGFuIG9uIHRoZSBjbGllbnQgLSB3aHkgZXhhY3RseT8gd2UgY291bGQganVzdCBzZW5kIHRoZSB3aG9sZSBjbGllbnQgb2JqZWN0IHZpYSBQT1NUIChhcyB3ZSBhbHJlYWR5IGRvIGluIC91cGRhdGUgcm91dGUgKVxuICAgICAgICAgICAgICAgICAgICBjbGllbnRuYW1lOiBjbGllbnRuYW1lLFxuICAgICAgICAgICAgICAgICAgICBob3N0bmFtZTogaG9zdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbixcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50aXA6IGNsaWVudGlwLFxuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgICAgICAgICBmb2N1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZXVybDpmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBiaXB1c2VySUQ6IGJpcHVzZXJJRCwgIC8vIHdlIGNhbiB1c2UgdGhpcyBpbiB0aGUgZnV0dXJlIHRvIHJlLWNoZWNrIGlmIHRoaXMgdXNlciBpcyBpbiB0aGUgcHJlLWRlZmluZWQgdXNlcmxpc3QgZm9yIHRoaXMgc3BlY2lmaWMgQklQIGV4YW1cbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiB7IGdyb3VwOiBncm91cCB8fCAnYSd9LCAgICAvLyB3ZSB1c2UgdGhpcyB0byBzdG9yZSAocGVyIHN0dWRlbnQpIGluZm9ybWF0aW9uIGFib3V0IHdoYXRzIGdvaW5nIG9uIG9uIHRoZSBzZXJ2ZXJzaWRlICh0YXNrbGlzdCkgYW5kIHNlbmQgaXQgYmFjayBvbiAvdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIGFsbG93IHR3byBncm91cHMgKHRoaXMgaXMganVzdCB1c2VkIGZvciBkaXN0cmlidXRpb24gb2YgZmlsZXMgYnkgbm93KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2NyZWF0ZSBmb2xkZXIgZm9yIHN0dWRlbnRcbiAgICAgICAgICAgICAgICBsZXQgc3R1ZGVudGZvbGRlciA9cGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUgLCBjbGllbnRuYW1lKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMuYWNjZXNzKHN0dWRlbnRmb2xkZXIpOyAvLyBDaGVjayBpZiBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIC8vIGRhcyB2ZXJ6ZWljaG5pcyBmXHUwMEZDciBkaWVzZW4gc3R1ZGVudCBleGlzdGllcnQgXG4gICAgICAgICAgICAgICAgICAgIC8vIGF1ZiB1bml4IGlzdCBkZXIgb3JkbmVybmFtZSAxMDAlIGlkZW50IC0gYXVmIHdpbmRvd3Mga1x1MDBGNm5udGUgZXMgYWJlciBpbiBkZXIgZ3Jvc3Mva2xlaW5zY2hyZWlidW5nIHVudGVyc2NoaWVkZSBnZWJlblxuICAgICAgICAgICAgICAgICAgICAvLyBwclx1MDBGQ2ZlIG9iIGVzIEVYQUtUIGdsZWljaCBnZXNjaHJpZWJlbiB3dXJkZSAoY2FzZS1zZW5zaXRpdilcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudERpciA9IHBhdGguZGlybmFtZShzdHVkZW50Zm9sZGVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGlyTmFtZSA9IHBhdGguYmFzZW5hbWUoc3R1ZGVudGZvbGRlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpcmVjdG9yaWVzID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIocGFyZW50RGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRGlyZWN0b3J5KCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkaXJlY3Rvcmllcy5pbmNsdWRlcyh0YXJnZXREaXJOYW1lKSkgeyAgLy8gd2lyIGhhYmVuIHdpbmRvd3MgZXJ0YXBwdC4uIGRlciBkYXRlaW5hbWUgaXN0IG5pY2h0IDEwMCUgaWRlbnQgXCJUZXN0XCIgIT09IFwidGVzdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nRGlyID0gZGlyZWN0b3JpZXMuZmluZChkaXIgPT4gZGlyLnRvTG93ZXJDYXNlKCkgPT09IHRhcmdldERpck5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmdEaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKHBhcmVudERpciwgZXhpc3RpbmdEaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4ocGFyZW50RGlyLCBgYmFja3VwLSR7ZXhpc3RpbmdEaXJ9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMucmVuYW1lKG9sZFBhdGgsIG5ld1BhdGgpOyAgLy8gVW1iZW5lbm5lbiBkZXMgYWx0ZW4gVmVyemVpY2huaXNzZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBSZW5hbWluZyAke29sZFBhdGh9IHRvICR7bmV3UGF0aH0gLSB0aHggYmlsbCBnYXRlcyBmb3IgdGhlIHdvcnN0IG9wZXJhdGluZyBzeXN0ZW0gb3R3YClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IFVzaW5nIGFscmVhZHkgZXhpc3RpbmcgZGlyZWN0b3J5OiAke3RhcmdldERpck5hbWV9YClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBEYXMgVmVyemVpY2huaXMgZXhpc3RpZXJ0IG5pY2h0LCBlcnN0ZWxsZSBlc1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3R1ZGVudGZvbGRlciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBDcmVhdGluZyAke3N0dWRlbnRmb2xkZXJ9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKG1rZGlyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogRXJyb3IgY3JlYXRpbmcgZGlyZWN0b3J5OiAke21rZGlyRXJyfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBEaXJlY3RvcnkgbWlnaHQgYWxyZWFkeSBleGlzdCwgdGhhdCdzIG9rXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWNTZXJ2ZXIuc3R1ZGVudExpc3QucHVzaChjbGllbnQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wucmVnaXN0ZXJlZFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgdG9rZW46IHRva2VufSkgIC8vIG9uIHN1Y2Nlc3MgcmV0dXJuIGNsaWVudCB0b2tlbiAoYXV0aCBuZWVkZWQgZm9yIHNlcnZlciBhcGkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgIGlmIChub3cgLSAyMDAwMCA+IHJlZ2lzdGVyZWRDbGllbnQudGltZXN0YW1wKSB7IC8vIHN0dWRlbnQgcHJvYmFibHkgd2VudCBvZmZsaW5lICh0ZWFjaGVyIGNvbm5lY3Rpb24gbG9zcykgYnV0IGlzIGNvbWluZyBiYWNrIG5vd1xuICAgICAgICAgICAgICAgICAgICByZWdpc3RlcmVkQ2xpZW50LnRpbWVzdGFtcCA9IG5vd1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogc3R1ZGVudCByZWNvbm5lY3RlZFwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vaW5mb3JtIGZyb250ZW5kIGFib3V0IHJlLWNvbm5lY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoXCJyZWNvbm5lY3RlZFwiLCByZWdpc3RlcmVkQ2xpZW50KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5yZWdpc3RlcmVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCB0b2tlbjogcmVnaXN0ZXJlZENsaWVudC50b2tlbn0pICAvL3NlbmQgYmFjayBvbGQgdG9rZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC53cm9uZ3BpblwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgICAgICB9XG4gICAgfVxuICAgIGNhdGNoIChlcnIpe1xuICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogJHtlcnJ9YCk7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwiYW4gdW5rbm93biBlcnJvciBvY2N1cmVkXCIsIHN0YXR1czogXCJlcnJvclwifSlcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBJTkZPUk0gQ2xpZW50KHMpIGFib3V0IGEgXCJzZW5kZmlsZVwiIHJlcXVlc3QgZnJvbSB0aGUgc2VydmVyIChjbGllbnRzIHNob3VsZCBkb3dubG9hZCB0aGUgZmlsZShzKSB2aWEgL2RhdGEvZG93bmxvYWQvLi4uIHJvdXRlKSBcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciB0aGF0IHdhaXRzIHdpdGggdGhlIGZpbGVcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIHNlbmQgdGhlIGV4YW0gKGZhbHNlIG1lYW5zIGV2ZXJ5Ym9keSlcbiAqL1xuIHJvdXRlci5wb3N0KCcvc2VuZHRvY2xpZW50LzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgY29uc3QgZmlsZXMgPSByZXEuYm9keS5maWxlcyAgIC8vICB7IGZpbGVzOlsge25hbWU6ZmlsZS5uYW1lLCBwYXRoOmZpbGUucGF0aCB9LCB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0gXSB9XG4gICBcbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ10gPSB0cnVlICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9ICBmaWxlc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ109IHRydWUgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBmaWxlc1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5leGFtcmVxdWVzdFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqICBLSUNLIGNsaWVudCAtIGNsaWVudCB3aWxsIGdldCBlcnJvciByZXNwb25zZSBvbiBuZXh0IHVwZGF0ZSBhbmQgcmVtb3ZlIGNvbm5lY3Rpb24gYXV0b21hdGljYWxseVxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIHRoYXQgd2FudHMgdG8ga2ljayB0aGUgY2xpZW50XG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBiZSBraWNrZWRcbiAqL1xuLy8gIHJvdXRlci5nZXQoJy9raWNrLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuLy8gICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbi8vICAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuLy8gICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbi8vICAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4vLyAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbi8vICAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuLy8gICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc3R1ZGVudHJlbW92ZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuLy8gICAgIH1cbi8vICAgICBlbHNlIHtcbi8vICAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbi8vICAgICB9XG4vLyB9KVxuXG5cblxuXG4vKipcbiAqIFNFVCBjaWVudHMgU0hBUkUgTElOSyBmb3IgbWljcm9zb2Z0MzY1IG1vZGVcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlcnMgbmFtZVxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgYmUga2lja2VkXG4gKi9cbnJvdXRlci5wb3N0KCcvc2hhcmVsaW5rLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgY29uc3Qgc2hhcmVsaW5rID0gcmVxLmJvZHkuc2hhcmVsaW5rXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBcbiAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLm1zb2ZmaWNlc2hhcmUgPSBzaGFyZWxpbmtcbiAgICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuLyoqXG4gKiBSRVNUT1JFIGNpZW50cyBmb2N1c2VkIHN0YXRlICAhISBVU0UgL3NldHN0dWRlbnRzdGF0dXMvIGluc3RlYWQgKHNpbXBsaWZ5IGNvZGUpXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvJ3Mgc3RhdGUgc2hvdWxkIGJlIHJlc3RvcmVkXG4gKi9cbiByb3V0ZXIuZ2V0KCcvcmVzdG9yZS86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgIGlmIChzdHVkZW50KSB7ICAgXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9IHRydWUgIC8vIHNldCBzdHVkZW50LnN0YXR1cyBzbyB0aGF0IHRoZSBzdHVkZW50IGNhbiByZXN0b3JlIGl0cyBmb2N1cyBzdGF0ZSBvbiB0aGUgbmV4dCB1cGRhdGVcbiAgICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0YXRlcmVzdG9yZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogRkVUQ0ggRVhBTVMgZnJvbSBjb25uZWN0ZWQgY2xpZW50cyAoc2V0IHN0dWRlbnQuc3RhdHVzIC0gc3R1ZGVudHMgd2lsbCB0aGVuIHNlbmQgdGhlaXIgd29ya2RpcmVjdG9yeSB0byAvZGF0YS9yZWNlaXZlKVxuICogYXR0ZW50aW9uISEgIG1vdmUgdG8gc2V0U3R1ZGVudFN0YXR1cyBldmVudHVhbGx5Li4gYmVjYXVzZSBpdHMgcmVkdW5kYW50XG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgdGhhdCB3YW50cyB0byBraWNrIHRoZSBjbGllbnRcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIHNlbmQgdGhlIGV4YW0gKGZhbHNlIG1lYW5zIGV2ZXJ5Ym9keSlcbiAqL1xuIHJvdXRlci5nZXQoJy9mZXRjaC86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBzdHVkZW50LnN0YXR1c1snc2VuZGV4YW0nXSA9IHRydWUgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBzdHVkZW50LnN0YXR1c1snc2VuZGV4YW0nXT0gdHJ1ZSAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5leGFtcmVxdWVzdFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuLyoqXG4gKiBHZXQgcHJldmlvdXMgU2VydmVyc3RhdHVzIGFuZCByZXR1cm4gU2VydmVyc3RhdHVzIGZyb20gRklMRSAoZnJvbSBwcmV2aW91cyBpbnRlcnJ1cHRlZCBleGFtIGluIG9yZGVyIHRvIHJlc3VtZSlcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHNlcnZlcnRva2VuIHRvIGF1dGhlbnRpY2F0ZSBiZWZvcmUgdGhlIHJlcXVlc3QgaXMgcHJvY2Vzc2VkXG4gKi9cbnJvdXRlci5wb3N0KCcvZ2V0c2VydmVyc3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjc3Jmc2VydmVydG9rZW4gPSByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChjc3Jmc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudG9rZW5ub3R2YWxpZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICl9XG4gICAgLy8gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIHZvbiBkZXIgSlNPTi1EYXRlaSB3aWVkZXIgaW1wb3J0aWVyZW5cbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcbiAgICBsZXQgc2VydmVyc3RhdHVzO1xuICAgIHRyeSB7ICBcbiAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIHNlcnZlcnN0YXR1cyA9IEpTT04ucGFyc2UoZmlsZUNvbnRlbnQpOyBcbiAgICAgICAgbWNTZXJ2ZXIuc2VydmVyaW5mby5waW4gPSBzZXJ2ZXJzdGF0dXMucGluICAvL2Fsc28gcmVzdG9yZSBsYXN0IHBpbiB0byBtYWtlIGl0IGVhc2llciBmb3Igc3R1ZGVudHNcbiAgICB9ICAgIFxuICAgIGNhdGNoIChlcnJvcikgeyAgc2VydmVyc3RhdHVzID0gZmFsc2U7ICB9XG4gICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzfSkgXG59KVxuXG4vL2dldCBjdXJyZW50IHNlcnZlcnN0YXR1cyBmcm9tIG1jc2VydmVyXG5yb3V0ZXIuZ2V0KCcvZ2V0Y3VycmVudHNlcnZlcnN0YXR1cy86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY3NyZnNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBpZiAoY3NyZnNlcnZlcnRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7IHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnRva2Vubm90dmFsaWRcIiksIHN0YXR1czogXCJlcnJvclwifSApfVxuICAgXG4gICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czogbWNTZXJ2ZXIuc2VydmVyc3RhdHVzfSkgXG59KVxuXG5cblxuXG4vKipcbiAqIFNldCBTZXJ2ZXJzdGF0dXMgXG4gKiBTdHVkZW50cyBmZXRjaCB0aGUgc2VydmVyc3RhdHVzIG9iamVjdCBldmVyeSB1cGRhdGVjeWNsZSBhbmQgYWN0IG9uIGl0IChzdGFydCBleGFtLCBsb2Nrc2NyZWVucyxldGMpXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHNlcnZlcnRva2VuIHRvIGF1dGhlbnRpY2F0ZSBiZWZvcmUgdGhlIHJlcXVlc3QgaXMgcHJvY2Vzc2VkXG4gKiBAcGFyYW0gcmVxLmJvZHkuc2VydmVyc3RhdHVzIGNvbnRhaW5zIHRoZSB3aG9sZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0XG4gKi9cbnJvdXRlci5wb3N0KCcvc2V0c2VydmVyc3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjc3Jmc2VydmVydG9rZW4gPSByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChjc3Jmc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudG9rZW5ub3R2YWxpZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICl9XG4gICAgXG4gICAgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzID0gcmVxLmJvZHkuc2VydmVyc3RhdHVzXG4gICAgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0ubXNPZmZpY2VGaWxlID0gZmFsc2UgIC8vIHdlIGNhbnQgc3RvcmUgYSBmaWxlIG9iamVjdCBhcyBqc29uXG5cbiAgICAvL2NvbnNvbGUubG9nKFwiY29udHJvbDpcIiwgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzKVxuICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHNldHNlcnZlcnN0YXR1czogc2F2aW5nIHNlcnZlciBzdGF0dXMgdG8gZGlzY1wiKVxuICAgIFxuICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSlcbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcblxuICAgIHRyeSB7ICBcbiAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShtY1NlcnZlci5zZXJ2ZXJzdGF0dXMsIG51bGwsIDIpO1xuICAgICAgICAvLyBWYWxpZGF0ZSBKU09OIGJlZm9yZSB3cml0aW5nIHRvIHByZXZlbnQgaW52YWxpZCBKU09OIGZpbGVzXG4gICAgICAgIEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwganNvblN0cmluZyk7ICBcbiAgICB9ICAgLy8gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIGFscyBKU09OLURhdGVpIHNwZWljaGVyblxuICAgIGNhdGNoIChlcnJvcikgeyAgXG4gICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHNldHNlcnZlcnN0YXR1czogJHtlcnJvcn1gICk7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcImNvdWxkIG5vdCBzYXZlIHNlcnZlcnN0YXR1cyB0byBkaXNjXCIsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJnZW5lcmFsLm9rXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH0pXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBTZXQgU1RVREVOVC5TVEFUVVMgYW5kIHRoZXJlZm9yZSBJbmZvcm0gQ2xpZW50IG9uIHRoZSBuZXh0IHVwZGF0ZSBjeWNsZSBhYm91dCBhIGRlbmllZCBwcmludHJlcXVlc3QgKHdlIGhhbmRsZSBvbmUgcmVxdWVzdCBhdCBhIHRpbWUpIGFuZCBvdGhlciB0aGluZ3MuXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBiZSBpbmZvcm1lZFxuICovXG5yb3V0ZXIucG9zdCgnL3NldHN0dWRlbnRzdGF0dXMvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBcbiAgICBjb25zdCBwcmludGRlbmllZCA9IHJlcS5ib2R5LnByaW50ZGVuaWVkXG4gICAgY29uc3QgZGVsZm9sZGVyID0gcmVxLmJvZHkuZGVsZm9sZGVyXG4gICAgY29uc3QgYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IHJlcS5ib2R5LmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2tcbiAgICBjb25zdCBhY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9ucyA9IHJlcS5ib2R5LmFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zXG4gICAgY29uc3QgcmVtb3ZlcHJpbnRyZXF1ZXN0ID0gcmVxLmJvZHkucmVtb3ZlcHJpbnRyZXF1ZXN0XG4gICAgY29uc3QgZ3JvdXAgPSByZXEuYm9keS5ncm91cFxuICAgIGNvbnN0IGtpY2tlZCA9IHJlcS5ib2R5LmtpY2tcbiAgICBjb25zdCBtc29mZmljZXNoYXJlID0gcmVxLmJvZHkubXNvZmZpY2VzaGFyZVxuICAgIGNvbnN0IGdldG1hdGVyaWFscyA9IHJlcS5ib2R5LmdldG1hdGVyaWFsc1xuXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIFxuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBcbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyKSAgeyBzdHVkZW50LnN0YXR1cy5kZWxmb2xkZXIgPSB0cnVlICAgfSAvLyBvbiB0aGUgbmV4dCB1cGRhdGUgY3ljbGUgdGhlIHN0dWRlbnQgZ2V0cyBpbmZvcm1lZCB0byBkZWxldGUgd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgIGlmIChncm91cCkge3N0dWRlbnQuc3RhdHVzLmdyb3VwID0gZ3JvdXA7IH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1zb2ZmaWNlc2hhcmUgIT09ICd1bmRlZmluZWQnKSB7c3R1ZGVudC5zdGF0dXMubXNvZmZpY2VzaGFyZSA9IG1zb2ZmaWNlc2hhcmU7IH0gICAvLyB3ZSBuZWVkIHRvIHNldCB0aGlzIHRvIGZhbHNlIGZvciBldmVyeSBzdHVkZW50IHRvIHRyaWdnZXIgYSBuZXcgdXBsb2FkIG9mIHRoZSBtc09mZmljZUZpbGUgb24gc2VjdGlvbiBjaGFuZ2VcbiAgICAgICAgICAgICAgICBpZiAoZ2V0bWF0ZXJpYWxzKSB7c3R1ZGVudC5zdGF0dXMuZ2V0bWF0ZXJpYWxzID0gdHJ1ZTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIC8vIGhlcmUgd2UgaGFuZGxlIGRpZmZlcmVudCBmb3JtcyBvZiBpbmZvcm1hdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHNldCBvbiBzdHVkZW50c3RhdHVzIChkb250IGZvcmdldCB0byByZXNldCB0aG9zZSB2YWx1ZXMgaW4gL3VwZGF0ZS9yb3V0ZSlcbiAgICAgICAgICAgICAgICBpZiAocHJpbnRkZW5pZWQpeyBcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMucHJpbnRkZW5pZWQgPSB0cnVlIC8vIHNldCBzdHVkZW50LnN0YXR1cyBzbyB0aGF0IHRoZSBzdHVkZW50IGNhbiBhY3Qgb24gaXQgb24gdGhlIG5leHQgdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vIHVuc2V0IHByaW50cmVxdWVzdCBzbyB0aGF0IGRhc2hib2FyZCBmZXRjaEluZm8gKHdoaWNoIGZldGNoZXMgdGhlIHN0dWRlbnRsaXN0KSBkb2VzbnQgdHJpZ2dlciBpdCBhZ2FpblxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgaWYgKGRlbGZvbGRlcikgIHsgc3R1ZGVudC5zdGF0dXMuZGVsZm9sZGVyID0gdHJ1ZSAgIH0gLy8gb24gdGhlIG5leHQgdXBkYXRlIGN5Y2xlIHRoZSBzdHVkZW50IGdldHMgaW5mb3JtZWQgdG8gZGVsZXRlIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjaykgeyAgICAvLyBhbGxvdyBzcGVsbGNoZWNrIGZvciB0aGlzIHNwZWNpZmljIHN0dWRlbnQgKHNwZWNpYWwgY2FzZXMpXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSB0cnVlOyBcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnMgPSBhY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9ucztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVTdWdnZXN0aW9ucyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVtb3ZlcHJpbnRyZXF1ZXN0ID09IHRydWUpeyBzdHVkZW50LnByaW50cmVxdWVzdCA9IGZhbHNlIH0gIC8vIHVuc2V0IHByaW50cmVxdWVzdCBzbyB0aGF0IGRhc2hib2FyZCBmZXRjaEluZm8gKHdoaWNoIGZldGNoZXMgdGhlIHN0dWRlbnRsaXN0KSBkb2VzbnQgdHJpZ2dlciBpdCBhZ2FpblxuICAgICAgICAgICAgICAgIGlmIChncm91cCkge3N0dWRlbnQuc3RhdHVzLmdyb3VwID0gZ3JvdXA7IH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1zb2ZmaWNlc2hhcmUgIT09ICd1bmRlZmluZWQnKSB7c3R1ZGVudC5zdGF0dXMubXNvZmZpY2VzaGFyZSA9IG1zb2ZmaWNlc2hhcmU7IH1cbiAgICAgICAgICAgICAgICBpZiAoa2lja2VkKSB7IHN0dWRlbnQuc3RhdHVzLmtpY2tlZCA9IHRydWUgfVxuICAgICAgICAgICAgICAgIGlmIChnZXRtYXRlcmlhbHMpIHtzdHVkZW50LnN0YXR1cy5nZXRtYXRlcmlhbHMgPSB0cnVlOyB9XG5cbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiY29udHJvbCBAIHNldHN0dWRlbnRzdGF0dXM6XCIsIHJlcS5ib2R5KVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgXG4gICAgICAgICAgICBpZiAobm93IC0gMjAwMDAgPiBzdHVkZW50LnRpbWVzdGFtcCAmJiBzdHVkZW50LnN0YXR1cy5raWNrZWQpICAgIHtcbiAgICAgICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuXG4vKipcbiAqIFRIRSBGT0xMT1dJTkcgUk9VVEVTIEFSRSBBQ0NFU1NFRCBCWSBTVFVERU5UUyBPTkxZXG4gKi9cblxuXG4vKipcbiAqIFVQREFURVMgQ2xpZW50aW5mbyAtIHRoZSBzcGVjaWZpZWQgc3R1ZGVudHMgdGltZXN0YW1wICh1c2VkIGluIGRhc2hib2FyZCB0byBtYXJrIHVzZXIgYXMgb25saW5lKSBhbmQgb3RoZXIgc3RhdHVzIHVwZGF0ZXNcbiAqIEZFVENIRVMgU2VydmVyc3RhdHVzICYgU3R1ZGVudHN0YXR1c1xuICogdXN1YWxseSB0cmlnZ2VyZWQgYnkgdGhlIGNsaWVudHMgZGlyZWN0bHkgZnJvbSB0aGUgTWFpbiBQcm9jZXNzIChsb29wKVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBlbnRyeSBpbiB0aGUgbGlzdFxuICovXG4gcm91dGVyLnBvc3QoJy91cGRhdGUnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjbGllbnRpbmZvID0gcmVxLmJvZHkuY2xpZW50aW5mb1xuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICBjb25zdCBleGFtbW9kZSA9IGNsaWVudGluZm8uZXhhbW1vZGVcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG5cbiAgICAvL2NoZWNrIGlmIHNlcnZlciBhbmQgc3R1ZGVudCBleGlzdFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9ICAvLyBzZXJ2ZXIgaXMgZ29uZSAtIGRpc2Nvbm5lY3Qgc3R1ZGVudFxuXG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgIGlmICggIXN0dWRlbnQgKSB7cmV0dXJuIHJlcy5zZW5kKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwicmVtb3ZlZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KSB9IC8vIHN0dWRlbnQga2lja2VkIC0gZGlzY29ubmVjdCBzdHVkZW50XG5cbiAgICAvL3VwZGF0ZSBpbXBvcnRhbnQgc3R1ZGVudCBhdHRyaWJ1dGVzXG4gICAgc3R1ZGVudC5mb2N1cyA9IGNsaWVudGluZm8uZm9jdXNcbiAgICBzdHVkZW50LnZpcnR1YWxpemVkID0gY2xpZW50aW5mby52aXJ0dWFsaXplZFxuICAgIHN0dWRlbnQudGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL2xhc3Qgc2VlbiAgLyB0aGlzIGlzIGxpa2UgYSBoZWFydGJlYXQgLSB1cGRhdGUgbGFzdHNlZW5cbiAgICBzdHVkZW50LmV4YW1tb2RlID0gZXhhbW1vZGUgIFxuICAgIHN0dWRlbnQuZmlsZXMgPSBjbGllbnRpbmZvLm51bWJlck9mRmlsZXNcbiAgICBzdHVkZW50LnJlbW90ZWFzc2lzdGFudCA9IGNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50XG5cbiAgICBpZiAoY2xpZW50aW5mby5mb2N1cykgeyBzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9IGZhbHNlIH0gIC8vIHJlbW92ZSB0YXNrIGJlY2F1c2UgaXRzIG9idmlvdXNseSBkb25lXG4gICAgaWYgKGNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID09IDApeyBzdHVkZW50LmltYWdldXJsID0gXCJwZXJzb24tbGluZXMtZmlsbC5zdmdcIiAgfVxuXG4gICAgbGV0IHN0dWRlbnRzdGF0dXMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHN0dWRlbnQuc3RhdHVzKSkgIC8vIGNvcHkgY3VycmVudCBzdGF0dXMgPiBzZW5kIGNvcHkgb2Ygb3JpZ2luYWwgdG8gc3R1ZGVudFxuICAgXG4gICAgLy8gdGVhY2hlciBzZXRzIHN0dWRlbnRzdGF0dXMua2ljayB0byB0cnVlIC0gdGhlIG1vbWVudCB0aGUgc3R1ZGVudCBmZXRjaGVzIGhpcyBzdGF0dXMgYW5kIGtud29uIGhlJ3Mga2lja2VkIGhlIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICBpZiAoc3R1ZGVudC5zdGF0dXMua2lja2VkKSAgICB7XG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuICAgIH1cblxuXG4gICAgLy8gcmVzZXQgc29tZSBzdGF0dXMgdmFsdWVzIHRoYXQgYXJlIG9ubHkgdXNlZCB0byB0cmFuc3BvcnQgc29tZXRoaW5nIG9uY2VcbiAgICBzdHVkZW50LnN0YXR1cy5wcmludGRlbmllZCA9IGZhbHNlIFxuICAgIHN0dWRlbnQuc3RhdHVzLmRlbGZvbGRlciA9IGZhbHNlIFxuICAgIHN0dWRlbnQuc3RhdHVzLnNlbmRleGFtID0gZmFsc2UgLy8gcmVxdWVzdCBvbmx5IG9uY2VcbiAgICBzdHVkZW50LnN0YXR1cy5mb2N1cyA9IHRydWVcbiAgICBzdHVkZW50LnN0YXR1cy5nZXRtYXRlcmlhbHMgPSBmYWxzZVxuICAgIC8vc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IGZhbHNlICAgLy8gYWN0aXZhdGUgb25seSBvbmNlIC0gd2hlbiBzdHVkZW50IHJldHJpZXZlZCBcInN0dWRlbnRzdGF0dXNcIiB3ZSBjYW4gcmVzZXQgc29tZSB2YWx1ZXMgb2YgXCJzdHVkZW50LnN0YXR1c1wiXG5cbiAgICAvLyByZXR1cm4gY3VycmVudCBzZXJ2ZXJpbmZvcm1hdGlvbiB0byBwcm9jZXNzIG9uIGNsaWVudHNpZGUgXG4gICAgLy8gQ3JlYXRlIG9wdGltaXplZCBzaGFsbG93IGNvcHkgb2Ygc2VydmVyc3RhdHVzIHdpdGhvdXQgZXhhbUluc3RydWN0aW9uRmlsZXMgdG8gcmVkdWNlIHBheWxvYWQgc2l6ZVxuICAgIGNvbnN0IHNlcnZlcnN0YXR1c0NvcHkgPSB7IC4uLm1jU2VydmVyLnNlcnZlcnN0YXR1cyB9O1xuICAgIHNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zID0geyAuLi5tY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zIH07XG4gICAgXG4gICAgLy8gQ2xlYXIgZXhhbUluc3RydWN0aW9uRmlsZXMgaW4gYWxsIDQgZXhhbVNlY3Rpb25zIGZvciBib3RoIGdyb3VwQSBhbmQgZ3JvdXBCICh3ZSBkb250IHdhbnQgdG8gc2VuZCB0aGUgbWF0ZXJpYWxzIHRvIHRoZSBzdHVkZW50IG9uIGV2ZXJ5IHVwZGF0ZSlcbiAgICBmb3IgKGxldCBzZWN0aW9uS2V5IG9mIFsxLCAyLCAzLCA0XSkge1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0pIHtcbiAgICAgICAgICAgIHNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldID0ge1xuICAgICAgICAgICAgICAgIC4uLnNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldLFxuICAgICAgICAgICAgICAgIGdyb3VwQToge1xuICAgICAgICAgICAgICAgICAgICAuLi5zZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XS5ncm91cEEsXG4gICAgICAgICAgICAgICAgICAgIGV4YW1JbnN0cnVjdGlvbkZpbGVzOiBbXVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ3JvdXBCOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldLmdyb3VwQixcbiAgICAgICAgICAgICAgICAgICAgZXhhbUluc3RydWN0aW9uRmlsZXM6IFtdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXMuY2hhcnNldCA9ICd1dGYtOCc7XG4gICAgcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5zdHVkZW50dXBkYXRlXCIpLCBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czpzZXJ2ZXJzdGF0dXNDb3B5LCBzdHVkZW50c3RhdHVzOiBzdHVkZW50c3RhdHVzIH0pXG59KVxuXG5cbi8qKlxuICogVVBEQVRFIFNDUkVFTlNIT1RcbiAqIFBPU1QgRGF0YSBjb250YWlucyBhIHNjcmVlbnNob3Qgb2YgdGhlIGNsaWVudHMgZGVza3RvcCAhIVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBzY3JlZW5zaG90XG4gKi9cbnJvdXRlci5wb3N0KCcvdXBkYXRlc2NyZWVuc2hvdCcsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNsaWVudGluZm8gPSByZXEuYm9keS5jbGllbnRpbmZvXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcblxuICAgIC8vIGNoZWNrIGlmIHN0dWRlbnRAc2VydmVyIGV4aXN0c1xuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgIGlmICggIXN0dWRlbnQgKSB7cmV0dXJuIHJlcy5zZW5kKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwicmVtb3ZlZCBmcm9tIHNlcnZlclwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KSB9IC8vY2hlY2sgaWYgdGhlIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiB0aGlzIHNlcnZlclxuICBcbiAgICBpZiAocmVxLmJvZHkuc2NyZWVuc2hvdCApIHtcbiAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IHJlcS5ib2R5LnNjcmVlbnNob3Q7ICAgLy8gRGVyIEJhc2U2NC1TdHJpbmcgbXVzcyBuaWNodCBrb252ZXJ0aWVydCB3ZXJkZW4sIGVyIGthbm4gZGlyZWt0IHZlcndlbmRldCB3ZXJkZW5cbiAgICAgICAgLy9sZXQgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgXG4gICAgICAgICAgICBzdHVkZW50LmltYWdldXJsID0gJ2RhdGE6aW1hZ2UvanBlZztiYXNlNjQsJyArIHNjcmVlbnNob3RCYXNlNjQ7IC8vIG9kZXIgJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCwnIGplIG5hY2ggdGF0c1x1MDBFNGNobGljaGVtIEJpbGRmb3JtYXQgIFxuXG4gICAgICAgICAgICAvLyBvbmx5IHNjYW4gc2NyZWVuc2hvdCBpbiBleGFtIG1vZGUgYW5kIE5PVCBpZiBhIHJlc3RvcmluZy91bmxvY2tpbmcgb3BlcmF0aW9uIGlzIGFscmVhZHkgaW4gcHJvY2VzcyAob3RoZXJ3aXNlIGl0IHdpbGwgbG9jayB0aGUgdW5sb2NrZWQgYWdhaW4pXG4gICAgICAgICAgICBpZiAobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIG1jU2VydmVyLnNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyICYmICFzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSAmJiBzdHVkZW50LmZvY3VzKXtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHJlcS5ib2R5LmhlYWRlci5zcGxpdCgnO2Jhc2U2NCwnKS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyaW1hZ2VCdWZmZXIgPSBCdWZmZXIuZnJvbShoZWFkZXIsICdiYXNlNjQnKTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBhcHAuaXNQYWNrYWdlZFxuICAgICAgICAgICAgICAgICAgICA/IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycpXG4gICAgICAgICAgICAgICAgICAgIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFUZXNzZXJhY3RXb3JrZXIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgVGVzc2VyYWN0V29ya2VyID0gYXdhaXQgVGVzc2VyYWN0LmNyZWF0ZVdvcmtlcignZW5nJywxLHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nUGF0aDogcHVibGljUGF0aCAsIFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGRhdGE6IHsgdGV4dCB9IH0gID0gYXdhaXQgVGVzc2VyYWN0V29ya2VyLnJlY29nbml6ZShoZWFkZXJpbWFnZUJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwaW5jb2RlVmlzaWJsZSA9IHRleHQuaW5jbHVkZXMobWNTZXJ2ZXIuc2VydmVyaW5mby5waW4pXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwaW5jb2RlVmlzaWJsZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50LmZvY3VzID0gcGluY29kZVZpc2libGUgIC8vIHRoaXMgaXMgdGhlIGxvY2FsIHN0dWRlbnQgb2JqZWN0IGZvciB0aGUgZnJvbnRlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmZvY3VzID0gcGluY29kZVZpc2libGUgIC8vIHRoaXMgc2V0cyB0aGUgc3R1ZGVudHN0YXR1cyBvYmplY3Qgd2hpY2ggaXMgZmV0Y2hlZCBvbiBldmVyeSB1cGRhdGUgLSB0aGUgc3R1ZGVudHMgcmVhY3Qgb24gdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdCAob2NyKTogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGluY2x1ZGUgRXhhbSBQSU5cIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXsgbG9nLmluZm8oYGNvbnRyb2wgQCB1cGRhdGVzY3JlZW5zaG90IChvY3IpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXN0dWRlbnQuZm9jdXMpIHsgLy8gQXJjaGl2aWVyZSBTY3JlZW5zaG90LCB3ZW5uIFN0dWRlbnQgbmljaHQgZm9rdXNzaWVydCBpc3RcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCB1cGRhdGVzY3JlZW5zaG90OiBTdHVkZW50IG91dCBvZiBmb2N1cyAtIHNlY3VyaW5nIHNjcmVlbnNob3RzXCIpO1xuICAgICAgICAgICAgICAgIGxldCB0aW1lID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnN1YnN0cigxMSwgOCkucmVwbGFjZSgvOi9nLCBcIl9cIik7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgXCJmb2N1c2xvc3RcIik7XG4gICAgICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZW5hbWUgPSBwYXRoLmpvaW4oZmlsZXBhdGgsIGAke3RpbWV9LSR7cmVxLmJvZHkuc2NyZWVuc2hvdGZpbGVuYW1lfWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoZmlsZXBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2NyZWVuc2hvdEJ1ZmZlciA9IEJ1ZmZlci5mcm9tKHJlcS5ib2R5LnNjcmVlbnNob3QsICdiYXNlNjQnKTsgICAgLy8gS29udmVydGllcmVuIGRlcyBCYXNlNjQtU3RyaW5ncyBpbiBlaW5lbiBCdWZmZXIgdW5kIFNwZWljaGVybiBkZXIgRGF0ZWlcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGFic29sdXRlRmlsZW5hbWUsIHNjcmVlbnNob3RCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGNvbnRyb2wgQCB1cGRhdGVzY3JlZW5zaG90OiAke2Vycn1gICk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgIFxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vbG9nLndhcm4oJ2NvbnRyb2wgQCB1cGRhdGVzY3JlZW5zaG90OiBTY3JlZW5zaG90IG9yIGhhc2ggbm90IHByb3ZpZGVkJyk7XG4gICAgICAgIHN0dWRlbnQuaW1hZ2V1cmwgPSBcInBlcnNvbi1saW5lcy1maWxsLnN2Z1wiXG4gICAgfVxuICAgIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wuc3R1ZGVudHVwZGF0ZVwiKSwgc3RhdHVzOlwic3VjY2Vzc1wiIH0pXG59KVxuXG5cbi8qKlxuICogUmVjZWl2ZSBBQkdBQkUgJiBQUklOVFJFUVVFU1QgRnJvbSBTdHVkZW50XG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIGF0IHdoaWNoIHRoZSBzdHVkZW50IGlzIHJlZ2lzdGVyZWRcbiAqIEBwYXJhbSB0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gdG8gc2VhcmNoIGFuZCB1cGRhdGUgdGhlIGVudHJ5IGluIHRoZSBsaXN0XG4gKi9cbnJvdXRlci5wb3N0KCcvcHJpbnRyZXF1ZXN0LzpzZXJ2ZXJuYW1lLzpzdHVkZW50dG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBwZGZEb2N1bWVudCA9IHJlcS5ib2R5LmRvY3VtZW50XG4gICAgY29uc3QgcHJpbnRyZXF1ZXN0ID0gcmVxLmJvZHkucHJpbnRyZXF1ZXN0XG4gICAgY29uc3Qgc3VibWlzc2lvbm51bWJlciA9IHJlcS5ib2R5LnN1Ym1pc3Npb25udW1iZXJcbiAgICBjb25zdCBsb2NrZWRzZWN0aW9uID0gcmVxLmJvZHkubG9ja2Vkc2VjdGlvbiB8fCAxIC8vIGRlZmF1bHQgdG8gc2VjdGlvbiAxIGlmIG5vdCBwcm92aWRlZFxuXG5cbiAgICAvL2NoZWNrIGlmIHNlcnZlciBleGlzdHMgXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoICFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3RhdmFpbGFibGVcIiwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cblxuICAgIC8vY2hlY2sgaWYgc3R1ZGVudCBpcyByZWdpc3RlcmVkIG9uIHNlcnZlclxuICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICBpZiAoICFzdHVkZW50ICkge3JldHVybiByZXMuc2VuZCh7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcInJlbW92ZWRcIiwgc3RhdHVzOiBcImVycm9yXCIgfSkgfVxuICAgIFxuICAgIGlmIChwcmludHJlcXVlc3QpeyAgIFxuICAgICAgICBzdHVkZW50LnByaW50cmVxdWVzdCA9IHBkZkRvY3VtZW50ICAvLyB3ZSBwdXQgdGhlIGJhc2U2NCBzdHJpbmcgb2YgdGhlIGRvY3VtZW50IG9uIHByaW50cmVxdWVzdCB3aGljaCBpcyBjaGVja2VkIGJ5IHRoZSBmcm9udGVuZCBvbiBldmVyeSBmZXRjaCBjeWNsZVxuICAgIH1cblxuICAgIC8vIHRyYWNrIHN0dWRlbnQgc3VibWlzc2lvbnMgb24gdGhlIHNlcnZlciBiZWNhdXNlIG9mIHBvc3NpYmxlIHJlY29ubmVjdHMgYW5kIHJlc2V0cyBvbiB0aGUgc3R1ZGVudCBzaWRlXG4gICAgLy8gaWYgKHN0dWRlbnQuc3VibWlzc2lvbm51bWJlciA9PT0gdW5kZWZpbmVkKXtcbiAgICAvLyAgICAgc3R1ZGVudC5zdWJtaXNzaW9ubnVtYmVyID0gMSAgICAvLyBmaXJzdCBzdWJtaXNzaW9uXG4gICAgLy8gfVxuICAgIC8vIGVsc2Uge1xuICAgIC8vICAgICBzdHVkZW50LnN1Ym1pc3Npb25udW1iZXIgKz0gMVxuICAgIC8vIH1cblxuICAgIGxldCBzYWZlU3R1ZGVudCA9IHN0dWRlbnQuY2xpZW50bmFtZS5yZXBsYWNlKC9cXHMrL2csICdfJykgIC8vIHJlcGxhY2Ugc3BhY2VzIHdpdGggXCJfXCJcbiAgICBsZXQgbm93ID0gbmV3IERhdGUoKVxuICBcbiAgICBsZXQgdGltZXN0YW1wID0gYCR7bm93LmdldEZ1bGxZZWFyKCl9JHtTdHJpbmcobm93LmdldE1vbnRoKCkrMSkucGFkU3RhcnQoMiwnMCcpfSR7U3RyaW5nKG5vdy5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsJzAnKX0tJHtTdHJpbmcobm93LmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsJzAnKX0ke1N0cmluZyhub3cuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCcwJyl9JHtTdHJpbmcobm93LmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwnMCcpfWBcbiAgICBsZXQgZmlsZW5hbWUgPSBgJHtzZXJ2ZXJuYW1lfS0ke3NhZmVTdHVkZW50fS0ke3N1Ym1pc3Npb25udW1iZXJ9LSR7dGltZXN0YW1wfS5wZGZgXG5cblxuICAgXG4gICAgY29uc3QgcGRmQnVmZmVyID0gQnVmZmVyLmZyb20ocGRmRG9jdW1lbnQsICdiYXNlNjQnKTtcblxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCAnQUJHQUJFJywgbG9ja2Vkc2VjdGlvbi50b1N0cmluZygpICkgLy8gdGFyZ2V0IGRpclxuICAgICAgICBhd2FpdCBmc3AubWtkaXIoZmlsZXBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBkaXJcbiAgICAgICAgY29uc3QgYWJzb2x1dGVGaWxlbmFtZSA9IHBhdGguam9pbihmaWxlcGF0aCwgZmlsZW5hbWUpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnVpbGQgcGF0aFxuICAgICAgICBhd2FpdCBmc3Aud3JpdGVGaWxlKGFic29sdXRlRmlsZW5hbWUsIHBkZkJ1ZmZlcikgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSBtYWluXG4gICAgICBcbiAgICAgICAgbG9nLmluZm8oYGNvbnRyb2wgQCBwcmludHJlcXVlc3Q6IFJlY2VpdmVkIGFuZCBzdG9yZWQgc3VibWlzc2lvbiBmaWxlIGZvciB1c2VyOiAke3N0dWRlbnQuY2xpZW50bmFtZX1gKVxuICAgICAgICAvLyBjcmVhdGUgYmFja3VwIG9mIGFiZ2FiZVxuICAgICAgICBsZXQgYmFja3VwU3RhdHVzID0gJ3NraXBwZWQnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IGJhY2t1cCBzdGF0dXNcbiAgICAgICAgaWYgKGNvbmZpZy5iYWNrdXBkaXJlY3RvcnkpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3B0aW9uYWwgYmFja3VwXG4gICAgICAgICAgY29uc3QgYmFja3VwcGF0aCA9IHBhdGguam9pbihjb25maWcuYmFja3VwZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgJ0FCR0FCRScsIGxvY2tlZHNlY3Rpb24udG9TdHJpbmcoKSApXG4gICAgICAgICAgYXdhaXQgZnNwLm1rZGlyKGJhY2t1cHBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBiYWNrdXAgZGlyXG4gICAgICAgICAgY29uc3QgYWJzb2x1dGVCYWNrdXBGaWxlbmFtZSA9IHBhdGguam9pbihiYWNrdXBwYXRoLCBmaWxlbmFtZSkgICAgICAgICAgICAgICAgICAgICAgIC8vIGJhY2t1cCBwYXRoXG4gICAgICAgICAgYXdhaXQgZnNwLndyaXRlRmlsZShhYnNvbHV0ZUJhY2t1cEZpbGVuYW1lLCBwZGZCdWZmZXIpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIGJhY2t1cFxuICAgICAgICAgIGJhY2t1cFN0YXR1cyA9ICdvaycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBiYWNrdXAgb2tcbiAgICAgICAgfVxuICAgICAgXG4gICAgICAgIHJlcy5zZW5kKHsgc2VuZGVyOiAnc2VydmVyJywgbWVzc2FnZTogJ3N1Y2Nlc3MnLCBzdGF0dXM6ICdzdWNjZXNzJywgYmFja3VwOiBiYWNrdXBTdGF0dXMgfSkgLy8gcmVzcG9uZCBzdWNjZXNzXG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjb250cm9sIEAgcHJpbnRyZXF1ZXN0OiAke2Vycn1gKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbG9nIGVycm9yXG4gICAgICAgIGxldCBtZXNzYWdlID0gdChcImNvbnRyb2wuc3VibWlzc2lvbmZhaWxlZFwiKVxuICAgICAgICByZXMuc3RhdHVzKDUwMCkuc2VuZCh7IHNlbmRlcjogJ3NlcnZlcicsIG1lc3NhZ2U6IG1lc3NhZ2UsIHN0YXR1czogJ2Vycm9yJyB9KSAgIC8vIHJlc3BvbmQgZXJyb3JcbiAgICAgIH1cbiAgICBcbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCByb3V0ZXJcblxuXG5cbi8vZG8gbm90IGFsbG93IHJlcXVlc3RzIGZyb20gZXh0ZXJuYWwgaG9zdHNcbmZ1bmN0aW9uIHJlcXVlc3RTb3VyY2VBbGxvd2VkKHJlcSxyZXMpe1xuICAgIGlmIChyZXEuaXAgPT0gXCI6OjFcIiAgfHwgcmVxLmlwID09IFwiMTI3LjAuMC4xXCIgfHwgcmVxLmlwLmluY2x1ZGVzKCcxMjcuMC4wLjEnKSApeyBcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSAgXG4gICAgbG9nLmVycm9yKGBCbG9ja2VkIHJlcXVlc3QgZnJvbSByZW1vdGUgSG9zdDogJHtyZXEuaXB9YCk7IFxuICAgIHJlcy5qc29uKCdSZXF1ZXN0IGRlbmllZCcpIFxuICAgIHJldHVybiBmYWxzZSBcbn1cbi8vdGhpcyBpcyBuZWVkZWQgYnkgdGhlIC9vYXV0aCBhbmQgL21zYXV0aCByb3V0ZXMgXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGVWZXJpZmllcigpIHtcbiAgICByZXR1cm4gY3J5cHRvLnJhbmRvbUJ5dGVzKDMyKS50b1N0cmluZygnaGV4Jyk7XG59XG5mdW5jdGlvbiBzaGEyNTYoYnVmZmVyKSB7XG4gICAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoYnVmZmVyKS5kaWdlc3QoKTtcbn1cbmZ1bmN0aW9uIGJhc2U2NFVybEVuY29kZShzdHIpIHtcbiAgICByZXR1cm4gc3RyLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgIC5yZXBsYWNlKCcrJywgJy0nKVxuICAgIC5yZXBsYWNlKCcvJywgJ18nKVxuICAgIC5yZXBsYWNlKC89KyQvLCAnJyk7XG59XG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IGNyZWF0ZVNvY2tldCB9IGZyb20gJ2RncmFtJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnXG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuXG4vKipcbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGJyb2FkY2FzdHMgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBzZXJ2ZXJcbiAqIG9uZSBtdWx0aWNhc3RTZXJ2ZXIgaW5zdGFuY2UgZm9yIGV2ZXJ5IGV4YW0gKGhvbGRzIGFsbCBzdHVkZW50IGluZm9ybWF0aW9uIGFuZCBzZXJ2ZXJzdGF0dXMpXG4gKi9cbmNsYXNzIE11bHRpY2FzdFNlcnZlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlNSQ19QT1JUID0gMCAgLy8gaW4gb3JkZXIgdG8gYWxsb3cgc2V2ZXJhbCBtdWx0aWNhc3Qgc2VydmVycyAobW9yZSBleGFtcyBvbiB0aGUgc2FtZSBtYWNoaW5lKSB0aGlzIHBvcnQgbmVlZHMgdG8gYmUgc2V0IGR5bmFtaWNhbGx5XG4gICAgICAgIHRoaXMuQ2xpZW50UE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSBjb25maWcubXVsdGljYXN0U2VydmVyQWRyclxuICAgICAgICB0aGlzLnNlcnZlciA9IG51bGxcbiAgICAgICAgdGhpcy5zZXJ2ZXJpbmZvID0gbnVsbFxuICAgICAgICB0aGlzLmJyb2FkY2FzdEludGVydmFsID0gbnVsbFxuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICB0aGlzLnN0dWRlbnRMaXN0ID0gW11cbiAgICAgICAgdGhpcy5zZXJ2ZXJzdGF0dXMgPSB7fVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldHMgdXAgYW4gaW50ZXJ2YWxsIHRvIHNlbmQgc2VydmVyaW5mbyBldmVyeSAyIHNlY29uZHNcbiAgICAgKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgZ2l2ZW4gbmFtZSBvZiB0aGUgc2VydmVyIChmb3IgZXhhbXBsZSBcIm1hdGhcIilcbiAgICAgKiBAcGFyYW0gcGluIHRoZSBwaW4gbmVlZGVkIHRvIHJlZ2lzdGVyIGFzIHN0dWRlbnRcbiAgICAgKi9cbiAgICBpbml0IChzZXJ2ZXJuYW1lLCBwaW4sIHBhc3N3b3JkLCBiaXA9ZmFsc2UsIGJpcElkPW51bGwpIHtcbiAgICAgICAgdGhpcy5zZXJ2ZXIgPSBjcmVhdGVTb2NrZXQoJ3VkcDQnKVxuICAgICAgICB0aGlzLnNlcnZlcmluZm8gPSB7XG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBzZXJ2ZXJuYW1lLCAgIC8vc2hvdWxkIGJlIHVuaXF1ZSBpZiBzZXZlcmFsIHNlcnZlcnMgYXJlIGFsbG93ZWRcbiAgICAgICAgICAgIHBpbjogcGluLFxuICAgICAgICAgICAgcGFzc3dvcmQ6IHBhc3N3b3JkLFxuICAgICAgICAgICAgdGltZXN0YW1wOiAwLFxuICAgICAgICAgICAgaWQ6IGJpcElkID8gYmlwSWQgOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgICAgaXA6IGNvbmZpZy5ob3N0aXAsXG4gICAgICAgICAgICBzZXJ2ZXJ0b2tlbjogYHNlcnZlci0ke2NyeXB0by5yYW5kb21VVUlEKCl9YCxcbiAgICAgICAgICAgIGJpcDogYmlwLFxuICAgICAgICAgICAgdmVyc2lvbjogY29uZmlnLnZlcnNpb25cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5zZXJ2ZXIuYmluZCh0aGlzLlNSQ19QT1JULCcwLjAuMC4wJywgICgpID0+IHsgLy8gQWRkIHRoZSBIT1NUX0lQX0FERFJFU1MgZm9yIHJlbGlhYmlsaXR5XG4gICAgICAgICAgICB0aGlzLnNlcnZlci5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgIHRoaXMuc2VydmVyLnNldE11bHRpY2FzdFRUTCgxMjgpXG4gICAgICAgICAgICB0aGlzLnNlcnZlci5zZXRUVEwoMTI4KVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuYWRkTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSKTsgXG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgICAgIHRoaXMuYnJvYWRjYXN0SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRNdWx0aWNhc3RNZXNzYWdlLmJpbmQodGhpcyksIDIwMDApXG4gICAgICAgICAgICB0aGlzLmJyb2FkY2FzdEludGVydmFsLnN0YXJ0KClcblxuXG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0c2VydmVyIEAgaW5pdDogVURQIE1DIFNlcnZlciBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLnNlcnZlci5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICB9KVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlcyB0aGUgc2VydmVyIHRpbWVzdGFtcCBhbmQgYWN0dWFsbHkgYnJvYWRjYXN0cyB0aGUgbWVzc2FnZSAoc2VydmVyaW5mbylcbiAgICAgKi9cbiAgICBzZW5kTXVsdGljYXN0TWVzc2FnZSAoKSB7XG4gICAgICAgIHRoaXMuc2VydmVyaW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICBsZXQgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IHRoaXMuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLFxuICAgICAgICAgICAgdGltZXN0YW1wOiB0aGlzLnNlcnZlcmluZm8udGltZXN0YW1wLFxuICAgICAgICAgICAgaWQ6IHRoaXMuc2VydmVyaW5mby5pZCxcbiAgICAgICAgICAgIGlwOiB0aGlzLnNlcnZlcmluZm8uaXAsXG4gICAgICAgICAgICBiaXA6IHRoaXMuc2VydmVyaW5mby5iaXAsXG4gICAgICAgICAgICB2ZXJzaW9uOiBjb25maWcudmVyc2lvblxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHByZXBhcmVkTWVzc2FnZSA9IG5ldyBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShtZXNzYWdlKSlcbiAgICAgICAgdGhpcy5zZXJ2ZXIuc2VuZChwcmVwYXJlZE1lc3NhZ2UsIDAsIHByZXBhcmVkTWVzc2FnZS5sZW5ndGgsIHRoaXMuQ2xpZW50UE9SVCwgdGhpcy5NVUxUSUNBU1RfQUREUikgIC8vYnJvYWRjYXN0IHRvIGNsaWVudHNcbiAgICAgICAgdGhpcy5zZXJ2ZXIuc2VuZChwcmVwYXJlZE1lc3NhZ2UsIDAsIHByZXBhcmVkTWVzc2FnZS5sZW5ndGgsIGNvbmZpZy5tdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0LCB0aGlzLk1VTFRJQ0FTVF9BRERSKSAgICAgICAgLy9icm9hZGNhc3QgdG8gb3RoZXIgc2VydmVyKGNsaWVudHMpIC0gc2VydmVycyBhbHNvIHdhbnQgdG8ga25vdyB3aGF0IG90aGVyIHNlcnZlcnMgYXJlIGluIHRoZSBuZXR3b3JrXG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdWx0aWNhc3RTZXJ2ZXJcbiIsICJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuXG5leHBvcnQgY2xhc3MgU2NoZWR1bGVyU2VydmljZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICBhY3Rpb246ICgpID0+IHZvaWQ7XG4gICAgaGFuZGxlOiBOb2RlSlMuVGltZXI7XG4gICAgaW50ZXJ2YWw6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFjdGlvbjogKCkgPT4gdm9pZCwgbXM6IG51bWJlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBtcztcbiAgICAgICAgdGhpcy5hZGRMaXN0ZW5lcigndGltZW91dCcsIHRoaXMuYWN0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5lbWl0KCd0aW1lb3V0JyksIHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuXG4vKipcbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5jbGFzcyBNdWx0aWNhc3RDbGllbnQge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5QT1JUID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckNsaWVudFBvcnRcbiAgICAgICAgdGhpcy5NVUxUSUNBU1RfQUREUiA9ICcyMzkuMjU1LjI1NS4yNTAnXG4gICAgICAgIHRoaXMuY2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0ID0gW11cbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNJbnRlcnZhbGwgPSBudWxsXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICogc3RhcnRzIGFuIGludGVydmFsbCB0byBjaGVjayBzZXJ2ZXIgc3RhdHVzIGJ5IHRpbWVzdGFtcFxuICAgICAqL1xuICAgIGluaXQgKGdhdGV3YXkpIHtcbiAgICAgICAgdGhpcy5nYXRld2F5ID0gZ2F0ZXdheVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKVxuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgKCkgPT4geyBcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRNdWx0aWNhc3RUVEwoMTI4KTsgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2F0ZXdheSkgeyB0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpIH1cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ2F0ZXdheSkge2xvZy53YXJuKFwibXVsdGljYXN0Y2xpZW50IEAgaW5pdDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7bG9nLmVycm9yKGVycil9XG5cbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG5cbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcblxuXG4gICAgfVxuXG4gICAgYXN5bmMgc3RvcCAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5kcm9wTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSKSAvLyBlbnRmZXJudCBNdWx0aWNhc3QtTWl0Z2xpZWRzY2hhZnRcbiAgICAgICAgfSBjYXRjaChlKXt9XG4gICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCkgLy8gc2NobGllXHUwMERGdCBkZW4gVURQLVNvY2tldFxuICAgICAgICBpZiAodGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIpIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0b3AoKSAvLyBzdG9wcHQgZGVuIFNjaGVkdWxlclxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIFxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqL1xuICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgICAgY29uc3Qgc2VydmVySW5mbyA9IEpTT04ucGFyc2UoU3RyaW5nKG1lc3NhZ2UpKVxuICAgICAgICBzZXJ2ZXJJbmZvLnNlcnZlcmlwID0gcmluZm8uYWRkcmVzc1xuICAgICAgICBzZXJ2ZXJJbmZvLnNlcnZlcnBvcnQgPSByaW5mby5wb3J0XG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCA9IG9iai50aW1lc3RhbXAgLy8gZXhpc3Rpbmcgc2VydmVyIC0gdXBkYXRlIHRpbWVzdGFtcFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIHNlcnZlcnRpbWVzdGFtcCBhbmQgcmVtb3ZlcyBzZXJ2ZXIgZnJvbSBsaXN0IGlmIG9sZGVyIHRoYW4gMSBtaW51dGVcbiAgICAgKi9cbiAgICBpc0RlcHJlY2F0ZWRJbnN0YW5jZSAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgICAgIGlmIChub3cgLSAxNjAwMCA+IHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYG11bHRpY2FzdGNsaWVudCBAIGlzRGVwcmVjYXRlZEluc3RhbmNlOiBSZW1vdmluZyBpbmFjdGl2ZSBzZXJ2ZXIgJyR7dGhpcy5leGFtU2VydmVyTGlzdFtpXS5zZXJ2ZXJuYW1lfScgZnJvbSBsaXN0YClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnNwbGljZShpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVsdGljYXN0Q2xpZW50KClcbiIsICJcbmltcG9ydCB7IGNyZWF0ZUkxOG4gfSBmcm9tICd2dWUtaTE4bidcbi8vaW1wb3J0IHsgY3JlYXRlSTE4biB9IGZyb20gJ3Z1ZS1pMThuJ1xuXG5pbXBvcnQgZW4gZnJvbSAnLi9lbi5qc29uJ1xuaW1wb3J0IGRlIGZyb20gJy4vZGUuanNvbidcblxuY29uc3QgaTE4biA9IGNyZWF0ZUkxOG4oe1xuICAgIGxvY2FsZTogJ2RlJyxcbiAgICBmYWxsYmFja0xvY2FsZTogJ2VuJyxcbiAgICBsZWdhY3k6IGZhbHNlLFxuICAgIG1lc3NhZ2VzOiB7XG4gICAgICBlbixcbiAgICAgIGRlXG4gICAgICB9XG4gIH0pXG5cbmV4cG9ydCBkZWZhdWx0IGkxOG5cblxuXG5cblxuIiwgInsgXG4gICAgXCJnZW5lcmFsXCI6IHtcbiAgICAgICAgXCJzdGFydHNlcnZlclwiOlwiU3RhcnQgRXhhbVwiLFxuICAgICAgICBcInNsaXN0XCI6IFwiQWt0aXZlIEV4YW1zXCIsXG4gICAgICAgIFwib2tcIjogXCJPS1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJObyBOZXR3b3JrIENvbm5lY3Rpb25cIlxuICAgIH0sXG4gICAgXCJzZXJ2ZXJsaXN0XCIgOiB7XG4gICAgICAgIFwicHdkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcImxvZ2luXCI6IFwibG9naW5cIixcbiAgICAgICAgXCJub3B3XCI6IFwiUGxlYXNlIHByb3ZpZGUgYSBwYXNzd29yZFwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcInN0YXJ0c2VydmVyXCIgOiB7XG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwic3RhcnRcIjogXCJTdGFydCBFeGFtXCIsXG4gICAgICAgIFwicmVzdW1lXCI6IFwiUmVzdW1lIEV4YW1cIixcbiAgICAgICAgXCJleGFtbmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJwd2RcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImVtcHR5cHdcIjogXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIHBhc3N3b3JkXCIsXG4gICAgICAgIFwiZW1wdHluYW1lXCI6IFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCB1c2VybmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiYWR2YW5jZWRcIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJzaW1wbGVcIixcbiAgICAgICAgXCJ3b3JrZm9sZGVyXCI6IFwiV29ya2RpcmVjdG9yeVwiLFxuICAgICAgICBcInNlbGVjdFwiOiBcIlNlbGVjdCBXb3JrZGlyZWN0b3J5XCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJOb3QgZW5vdWdoIGZyZWUgZGlzY3NwYWNlXCIsXG4gICAgICAgIFwiZGlyZWN0b3J5ZXJyb3JcIjogXCJEaXJlY3Rvcnkgbm90IHdyaXRlYWJsZVwiLFxuICAgICAgICBcInByZXZpb3VzZXhhbXNcIjogXCJMb2NhbCBwcmV2aW91cyBFeGFtc1wiLFxuICAgICAgICBcImZvbGRlcmRlbGV0ZVwiOiBcIkRlbGV0ZSBsb2NhbCBleGFtIGZvbGRlcj9cIixcbiAgICAgICAgXCJvbmxpbmVleGFtc1wiOiBcIkJpUCBFeGFtc1wiLFxuICAgICAgICBcImJpcG5vdGxvZ2dlZGluXCI6IFwiUGxlYXNlIGxvZyBpbiB0byBCaVAgYmVmb3JlIHN0YXJ0aW5nIHRoZSBleGFtXCIsXG4gICAgICAgIFwibm9OZXdzXCI6XCJObyBOZXdzIGF2YWlsYWJsZVwiLFxuICAgICAgICBcImJhY2t1cGZvbGRlclwiOiBcIkJhY2t1cC1EaXJlY3RvcnlcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJpbmZvXCI6IFwiUGxlYXNlIHByb3ZpZGUgYSBwYXRoIGZvciB0aGUgYmFja3VwIGRpcmVjdG9yeVwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NcIjogXCJFeHRlbmRlZCBTZXR0aW5nc1wiLFxuICAgICAgICBcImluY29tcGF0aWJsZVwiOiBcIkluY29tcGF0aWJsZSB3aXRoIGN1cnJlbnQgdmVyc2lvblwiLFxuICAgICAgICBcInNlbGVjdGludGVyZmFjZVwiOiBcIlNlbGVjdCBOZXR3b3JrIEludGVyZmFjZVwiLFxuICAgICAgICBcInNlbGVjdGludGVyZmFjZWluZm9cIjogXCJQbGVhc2Ugc2VsZWN0IGEgcHJlZmVycmVkIG5ldHdvcmsgaW50ZXJmYWNlIVwiXG4gICAgfSxcbiAgICBcImRhc2hib2FyZFwiOntcbiAgICAgICAgXCJyZW1vdmVVUkxcIjogXCJSZW1vdmUgVVJMXCIsXG4gICAgICAgIFwicmVtb3ZlVVJMY29uZmlybVwiOiBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byByZW1vdmUgdGhpcyBVUkw/XCIsXG4gICAgICAgIFwicmVtb3RlYXNzaXN0YW50XCI6IFwiUmVtb3RlIEFzc2lzdGFudFwiLFxuICAgICAgICBcInNlcnZlclwiOiBcIlNlcnZlclwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwic3RvcHNlcnZlclwiOiBcIlN0b3AgRXhhbVwiLFxuICAgICAgICBcImZpbGVzZW5kXCI6IFwiU2VuZCBGaWxlc1wiLFxuICAgICAgICBcImZpbGVzZW5kdGV4dFwiOiBcIlBsZWFzZSBjaG9vc2Ugb25lIG9yIHNldmVyYWwgRmlsZXNcIixcbiAgICAgICAgXCJvZmZpY2VmaWxlc2VuZFwiOiBcIlVwbG9hZCBGaWxlXCIsXG4gICAgICAgIFwib2ZmaWNlZmlsZXNlbmR0ZXh0XCI6IFwiUGxlYXNlIGNob29zZSBhbiB4bHN4IG9yIGRvY3ggRmlsZSBmb3IgdGhlIEV4YW1cIixcbiAgICAgICAgXCJjYW5jZWxcIjogXCJDYW5jZWxcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiTm8gRmlsZXMgc2VsZWN0ZWRcIixcbiAgICAgICAgXCJ1cGxvYWRmaWxlc1wiOiBcInVwbG9hZGluZyBmaWxlc1wiLFxuICAgICAgICBcImZpbGVzc2VudFwiOiBcIkZpbGVzIHNlbnRcIixcbiAgICAgICAgXCJub2NsaWVudHNcIjogXCJObyBzdHVkZW50cyBjb25uZWN0ZWRcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiTGFuZ3VhZ2VcIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aFwiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c1wiOiBcIkFjdGl2ZSBTaGVldHNcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNoaW50XCI6IFwiUGxlYXNlIHNlbGVjdCBhIFBERiBmaWxlIHRoYXQgY29udGFpbnMgaW50ZXJhY3RpdmUgZm9ybSBmaWVsZHMuXCIsXG4gICAgICAgIFwiYWNjZXB0UGRmXCI6IFwiQWNjZXB0IFBERiBGaWxlXCIsXG4gICAgICAgIFwic2VsZWN0T3RoZXJQZGZcIjogXCJTZWxlY3Qgb3RoZXIgUERGIGZpbGVcIixcbiAgICAgICAgXCJub3BkZnNlbGVjdGVkXCI6IFwiUGxlYXNlIHNlbGVjdCBhIFBERiBmaWxlIVwiLFxuICAgICAgICBcImludmFsaWRwZGZcIjogXCJJbnZhbGlkIFBERiBmaWxlIVwiLFxuICAgICAgICBcInBkZnByb2Nlc3NpbmdlcnJvclwiOiBcIkVycm9yIHByb2Nlc3NpbmcgUERGIGZpbGUuXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsXCI6IFwiRWR1dmlkdWFsXCIsXG4gICAgICAgIFwid2Vic2l0ZVwiOiBcIldlYnNpdGUgVVJMXCIsXG4gICAgICAgIFwiYXV0b2dldFwiOiBcIkJhY2t1cCBpbnRlcnZhbFwiLFxuICAgICAgICBcInN0YXJ0ZXhhbVwiOiBcIlNlY3VyZSBkZXZpY2VzXCIsXG4gICAgICAgIFwic3RhcnRleGFtc2luZ2xlXCI6IFwiU2VjdXJlIGRldmljZVwiLFxuICAgICAgICBcInN0YXJ0ZXhhbWRlc2NcIjogXCJUaGlzIHN0YXJ0cyB0aGUgRXhhbSBNb2RlIGZvciBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJzZW5kZmlsZVwiOiBcIlNlbmQgRmlsZXMgdG8gYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwic2VuZGZpbGVTaW5nbGVcIjogXCJTZW5kIEZpbGVzXCIsXG4gICAgICAgIFwiZ2V0ZmlsZVwiOiBcIkZldGNoIFdvcmsgb2YgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwiZ2V0ZmlsZVNpbmdsZVwiOiBcIkZldGNoIFdvcmtcIixcbiAgICAgICAgXCJnZXRmaWxlc1wiOiBcIkZldGNoIFdvcmtcIixcbiAgICAgICAgXCJzdG9wZXhhbVwiOiBcIlJlbGVhc2UgZGV2aWNlc1wiLFxuICAgICAgICBcInN0b3BleGFtc2luZ2xlXCI6IFwiUmVsZWFzZSBkZXZpY2VcIixcbiAgICAgICAgXCJzdXJlXCI6IFwiQXJlIHlvdSBzdXJlP1wiLFxuICAgICAgICBcImV4aXRleGFtc3VyZVwiOiBcIkNsb3NlIEV4YW0gU2VydmVyP1wiLFxuICAgICAgICBcImV4aXRleGFtXCI6IFwiVGhpcyBraWxscyB0aGUgY29ubmVjdGlvbiB0byBhbGwgc3R1ZGVudHMgXFxuRGlkIHlvdSBiYWNrdXAgZXZlcnl0aGluZz9cIixcbiAgICAgICAgXCJleGl0ZXhhbWluZm9cIjogXCJhbGwgYWN0aXZlIGNvbm5lY3Rpb25zIHdpbGwgYmUgY2xvc2VkXCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiZXhpdCBzYWZlIGV4YW0gbW9kZS4gdGhpcyBjbG9zZXMgdGhlIGV4YW0gd2luZG93IGZvciBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJleGl0a2lvc2tzaG9ydFwiOiBcIkV4aXQgRXhhbSBTZXJ2ZXJcIixcbiAgICAgICAgXCJyZWFsbHlraWNrXCI6IFwicmVtb3ZlIHN0dWRlbnQgZnJvbSBzZXJ2ZXJcIixcbiAgICAgICAgXCJraWNrXCI6IFwicmVtb3ZlXCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwic2FmZW1vZGUgbGVmdFwiLFxuICAgICAgICBcIm9ubGluZVwiOlwiZGV0YWlsc1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjpcIm9mZmxpbmVcIixcbiAgICAgICAgXCJzZWN1cmVcIjpcInNlY3VyZWRcIixcbiAgICAgICAgXCJzZWN1cmVpbmZvXCI6XCJzdHVkZW50IGlzIHNlY3VyZWRcIixcbiAgICAgICAgXCJyZXN0b3JlXCI6XCJyZXN0b3JlXCIsXG4gICAgICAgIFwicmVzdW1laW5mb1wiOlwicmVzdW1lIGZvY3VzIHN0YXRlXCIsXG4gICAgICAgIFwiZXhhbW1vZGVhY3RpdmVcIjogXCJzdHVkZW50IGFscmVhZHkgaW4gc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiY2xvc2VcIixcbiAgICAgICAgXCJkZWxcIjogXCJjbGVhbiB3b3JrZm9sZGVyXCIsXG4gICAgICAgIFwiZGVsc3VyZVwiOiBcIkRlbGV0ZSBhbGwgY29udGVudHMgb2YgdGhlIHN0dWRlbnRzIHdvcmtmb2xkZXJzXCIsXG4gICAgICAgIFwiZGVsc2luZ2xlXCI6IFwiY2xlYW4gcmVtb3RlIHdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJkZWxzaW5nbGVzdXJlXCI6IFwiRGVsZXRlIGNvbnRlbnRzIG9mIHRoZSBzdHVkZW50cyB3b3JrZm9sZGVyXCIsXG4gICAgICAgIFwiYXR0ZW50aW9uXCI6IFwiQXR0ZW50aW9uIVwiLFxuICAgICAgICBcImJhY2t1cHJlcXVlc3RcIjogXCJSZXF1ZXN0aW5nIGZpbGVzIGZyb20gYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwic2hvd3dvcmtmb2xkZXJcIjogXCJTaG93IFdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJ3b3JrZm9sZGVyXCI6IFwiU2hvdyBXb3JrZm9sZGVyXCIsXG4gICAgICAgIFwic2hvd25ld2VzdGZvbGRlclwiOiBcIlNob3cgbmV3ZXN0IFdvcmtmb2xkZXJcIixcbiAgICAgICAgXCJmaWxlc2ZvbGRlclwiOiBcIldvcmtmb2xkZXIgZmlsZXNcIixcbiAgICAgICAgXCJjaG9vc2VzdHVkZW50XCI6IFwiU2VsZWN0IFN0dWRlbnRcIixcbiAgICAgICAgXCJjaG9vc2VyZXF1aXJlXCI6IFwiWW91IG5lZWQgdG8gY2hvb3NlIGEgc3R1ZGVudCFcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIlN0dWRlbnRzIHdvcmsgbm90IGZvdW5kXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmXCI6IFwiRG93bmxvYWQgbmV3ZXN0IHZlcnNpb25zIFxcbmFzIHNpbmdsZSBwZGZcIixcbiAgICAgICAgXCJzdW1tYXJpemVwZGZzaG9ydFwiOiBcIkFsbCBFeGFtcyBhcyBQREZcIixcbiAgICAgICAgXCJwcmludHJlcXVlc3RcIjogXCJwcmludHJlcXVlc3QgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJwcmludHJlcXVlc3RzaG93XCI6IFwiRG8geW91IHdhbnQgdG8gb3BlbiB0aGUgZG9jdW1lbnQgYW5kIHByaW50IGl0P1wiLFxuICAgICAgICBcImRvd25sb2FkXCI6IFwiZG93bmxvYWRcIixcbiAgICAgICAgXCJwcmludFwiOiBcInByaW50XCIsXG4gICAgICAgIFwicHJldmlld1wiOiBcInByZXZpZXdcIixcbiAgICAgICAgXCJzZW5kXCI6IFwic2VuZFwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6XCJhY3RpdmF0ZVwiLFxuICAgICAgICBcIkFjdGl2YXRlXCI6XCJBY3RpdmF0ZVwiLFxuICAgICAgICBcInZpcnR1YWxpemVkXCI6IFwidmlydHVhbCBlbnZpcm9ubWVudCBkZXRlY3RlZFwiLFxuICAgICAgICBcImRlbGV0ZVwiOiBcImRlbGV0ZVwiLFxuICAgICAgICBcImZpbGVkZWxldGVcIjogXCJEbyB5b3UgcmVhbGx5IHdhbnQgdG8gZGVsZXRlIHRoaXMgZmlsZS9mb2xkZXI/XCIsXG4gICAgICAgIFwiY2Fubm90RGVsZXRlQWN0aXZlU2hlZXRcIjogXCJBY3RpdmUgU2hlZXQgY2Fubm90IGJlIGRlbGV0ZWQgZHVyaW5nIGV4YW1cIixcbiAgICAgICAgXCJleGl0ZGVsZXRlXCI6IFwiRGVsZXRlIGFsbCBleGFtLXJlbGF0ZWQgZmlsZXMgb24gc3R1ZGVudHMgZGV2aWNlc1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2FjdGl2YXRlXCI6IFwiYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJQbGVhc2UgY2hvb3NlIGEgbGFuZ3VhZ2VcIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJTaG93IHN1Z2dlc3Rpb25zXCIsXG4gICAgICAgIFwiY3VzdG9taG9zdFwiOiBcIkN1c3RvbSBMVCBIb3N0XCIsXG4gICAgICAgIFwibGFuZ3VhZ2V0b29saG9zdFwiOiBcIkxhbmd1YWdlVG9vbCBIb3N0XCIsXG4gICAgICAgIFwibm9uZVwiOiBcIm5vbmVcIixcbiAgICAgICAgXCJjbWFyZ2luXCI6IFwiQ29ycmVjdGlvbiBNYXJnaW4gUG9zaXRpb25cIixcbiAgICAgICAgXCJjbWFyZ2luLWxlZnRcIjogXCJsZWZ0XCIsXG4gICAgICAgIFwiY21hcmdpbi1yaWdodFwiOiBcInJpZ2h0XCIsXG4gICAgICAgIFwiY21hcmdpbi12YWx1ZVwiOiBcIkNvcnJlY3Rpb24gTWFyZ2luIHNpemUgKGNtKVwiLFxuICAgICAgICBcInRleHRlZGl0b3JcIjogXCJUZXh0ZWRpdG9yIFNldHRpbmdzXCIsXG4gICAgICAgIFwiZGVcIjogXCJHZXJtYW5cIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyZW5jaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWFuXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3ZlbmlhblwiLFxuICAgICAgICBcImJhY2t1cGF1dG9cIjpcIkF1dG9tYXRpYyBSZXRyZWl2YWxcIixcbiAgICAgICAgXCJiYWNrdXBhdXRvcXVlc3Rpb25cIjpcIlBsZWFzZSBzZXQgdGhlIGludGVydmFsIGZvciBhdXRvbWF0aWMgcmV0cmVpdmFsP1wiLFxuICAgICAgICBcImJhY2t1cGF1dG9oaW50XCI6XCIoVGltZWZyYW1lIGluIG1pbnV0ZXMpXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRcIjogXCJFZHV2aWR1YWwgLyBNb29kbGVcIixcbiAgICAgICAgXCJlZHV2aWR1YWxpZGhpbnRcIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCB0ZXN0IFVSTCFcIixcbiAgICAgICAgXCJnZm9ybXNoaW50XCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgR29vZ2xlIEZvcm1zIElEIVwiLFxuICAgICAgICBcImVkdXZpZHVhbGRvbWFpblwiOiBcIlBsZWFzZSBwcm92aWRlIHlvdXIgbW9vZGxlIGRvbWFpbiBpZiBpdCdzIG5vdCBlZHV2aWR1YWwuYXRcIixcbiAgICAgICAgXCJtb29kbGVJbnZhbGlkRG9tYWluXCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgTW9vZGxlIGRvbWFpbiFcIixcbiAgICAgICAgXCJpbnZhbGlkRG9tYWluXCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgZG9tYWluIVwiLFxuICAgICAgICBcIm1vb2RsZUludmFsaWRJZFwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIHRlc3QgSUQhXCIsXG4gICAgICAgIFwibG9ja1wiOlwibG9jayBkaXNwbGF5c1wiLFxuICAgICAgICBcInVubG9ja1wiOlwidW5sb2NrIGRpc3BsYXlzXCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJSdW5uaW5nIG91dCBvZiBmcmVlIGRpc2NzcGFjZSEhXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlXCIgOiBcIldyb25nIEZpbGV0eXBlXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlX3RleHRcIjogXCJPbmx5IEZpbGVzIHdpdGggdGhlIC54bHN4IG9yIC5kb2N4IGV4dGVuc2lvbiBhcmUgYWxsb3dlZFwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlJlcGxhY2UgZXhpc3RpbmcgRmlsZXMgb24gT25lRHJpdmU/XCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjpcIkV4YW0gcmVxdWVzdGVkXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdFwiOlwiU2NyZWVuc2hvdHVwZGF0ZVwiLFxuICAgICAgICBcInNjcmVlbnNob3R0aXRsZVwiOlwiU2NyZWVuc2hvdCBVcGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90cXVlc3Rpb25cIjpcIlNldCB0aGUgaW50ZXJ2YWwgdG8gdXBkYXRlIFNjcmVlbnNob3RzXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdGhpbnRcIjpcIihUaW1lIGluIHNlY29uZHMuIDAgPT0gZGVha3RpdmF0ZWQpXCIsXG4gICAgICAgIFwib2xkcGRmd2FybmluZ1wiOlwiU29tZSBvZiB0aGUgZmlsZXMgYXJlIG9sZGVyIHRoYW4gNSBtaW51dGVzIVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdzaW5nbGVcIjpcIlRoZSBsb2NhbCB2ZXJzaW9uIG9mIHRoZSBmaWxlIG1heSBiZSBvdXRkYXRlZCFcIixcbiAgICAgICAgXCJnZm9ybXNcIjogXCJHb29nbGUgRm9ybXNcIixcbiAgICAgICAgXCJhY2Nlc3NEZW5pZWRcIjpcIkFjY2VzcyBEZW5pZWQhXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkdGV4dFwiOlwiQ29udGFjdCB5b3VyIG9yZ2FuaXphdGlvbnMgQWRtaW5pc3RyYXRvciB0byBncmFudCBBY2Nlc3MgdG8gTmV4dC1FeGFtXCIsXG4gICAgICAgIFwibXNvV2FyblwiOiBcIllvdSBuZWVkIHRvIHJlY29ubmVjdCBhbmQgc2VsZWN0IGFuIE1TT0ZpbGUgYmVmb3JlIHJlY29ubmVjdGluZyBhbGwgc3R1ZGVudHNcIixcbiAgICAgICAgXCJhbGxvd3NwZWxsY2hlY2tcIjpcIkFjdGl2YXRlIHNwZWxsY2hlY2sgZm9yIHNwZWNpZmljIHN0dWRlbnRcIixcbiAgICAgICAgXCJsaW5lc3BhY2luZ1wiOiBcIkxpbmVzcGFjaW5nXCIsXG4gICAgICAgIFwiZm9udGZhbWlseVwiOiBcIkZvbnRmYW1pbHlcIixcbiAgICAgICAgXCJkZWZhdWx0cHJpbnRlclwiOiBcIlNlbGVjdCBkZWZhdWx0IHByaW50ZXJcIixcbiAgICAgICAgXCJhbGxvd2RpcmVjdHByaW50XCI6IFwiQWxsb3cgZGlyZWN0IHByaW50IGZvciBzdHVkZW50c1wiLFxuICAgICAgICBcIm5vcHJpbnRlclwiOiBcIk5vIHByaW50ZXIgZm91bmRcIixcbiAgICAgICAgXCJkaXJlY3RwcmludFwiOiBcIkRpcmVjdCBwcmludFwiLFxuICAgICAgICBcIm9wZW5cIjogXCJPcGVuIGZpbGUgaW4gZXh0ZXJuYWwgdmlld2VyXCIsXG4gICAgICAgIFwib2NyXCI6IFwiQWN0aXZhdGUgT0NSIHNhZnRleSBmZWF0dXJlXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXR0aXRsZVwiOiBcIkF1ZGlvIHJlc3RyaWN0aW9uc1wiLFxuICAgICAgICBcImF1ZGlvYWxsb3dcIjogXCJubyByZXN0cmljdGlvbnNcIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdDFcIjogXCJyZXBldGl0aW9uXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXQyXCI6IFwicmVwZXRpdGlvbnNcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOiBcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxhY3RpdmF0ZVwiOiBcIkFjdGl2YXRlIEJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxzZXR0aW5nc1wiOiBcIkV4dGVuZGVkIFNldHRpbmdzIGZvciBCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImdyb3Vwc1wiOlwiQWN0aXZhdGUgZ3JvdXBzXCIsXG4gICAgICAgIFwiZ3JvdXBpbmZvXCI6IFwiRGl2aWRlIHN0dWRlbnRzIGluIHR3byBncm91cHNcIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXh0ZW5kZWQgU2V0dGluZ3NcIixcbiAgICAgICAgXCJzYXZlXCI6IFwic2F2ZVwiLFxuICAgICAgICBcImRpc2FibGVkXCI6IFwiZGlzYWJsZWRcIixcbiAgICAgICAgXCJvY3JpbmZvXCI6XCJTZWFyY2ggZm9yIGN1cnJlbnQgZXhhbSBwaW4gaW4gc2NyZWVuc2hvdHNcIixcbiAgICAgICAgXCJiaXBpbmZvXCI6IFwiQmlQLVN0YXR1cyBkZWZpbmVzIGlmIGF1dGhlbnRpY2F0ZWQgY2xpZW50cyBjYW4gY29ubmVjdFwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOiBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBsb2cgb3V0P1wiLFxuICAgICAgICBcImFjdGl2YXRlc2VjdGlvbnNcIjogXCJBY3RpdmF0ZSBleGFtIHNlY3Rpb25zXCIsXG4gICAgICAgIFwiZXhhbXNlY3Rpb25zXCI6IFwiZXhhbSBzZWN0aW9uc1wiLFxuICAgICAgICBcImV4YW1zZWN0aW9uc2luZm9cIjogXCJZb3UgYXJlIGluIHNlY3VyZWQgbW9kZS4gRG8geW91IHdhbnQgdG8gYWN0aXZhdGUgdGhpcyBleGFtIHNlY3Rpb24gZm9yIGFsbCBjb25uZWN0ZWQgY2xpZW50cz9cIixcbiAgICAgICAgXCJub1wiOlwiTm9cIixcbiAgICAgICAgXCJ5ZXNcIjpcIlllc1wiLFxuICAgICAgICBcImV4YW1tb2RlXCI6XCJFeGFtLU1vZGVcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjpcIk1hdGVyaWFsc1wiLFxuICAgICAgICBcImRlZmluZW1hdGVyaWFsc1wiOlwiRGVmaW5lIE1hdGVyaWFsc1wiLFxuICAgICAgICBcInByb2Nlc3NpbmdmaWxlc1wiOlwiUHJvY2Vzc2luZyBGaWxlc1wiLFxuICAgICAgICBcImZvbnRzaXpldGl0bGVcIjogXCJGb250c2l6ZVwiLFxuICAgICAgICBcImZvbnRzaXplXCI6IFwiRm9udHNpemVcIixcbiAgICAgICAgXCJyZW1vdmVmaWxlXCI6IFwiRGVsZXRlIEZpbGVcIixcbiAgICAgICAgXCJyZW1vdmVmaWxlY29uZmlybVwiOiBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgdGhpcyBmaWxlP1wiLFxuICAgICAgICBcInNlY3Rpb25uYW1lXCI6IFwiU2VjdGlvbiBOYW1lXCIsXG4gICAgICAgIFwic2VjdGlvbm5hbWVpbmZvXCI6IFwiUGxlYXNlIGVudGVyIGEgbmFtZSBmb3IgdGhpcyBzZWN0aW9uXCIsXG4gICAgICAgIFwiZ3JvdXBBXCI6IFwiR3JvdXAgQVwiLFxuICAgICAgICBcImdyb3VwQlwiOiBcIkdyb3VwIEJcIixcbiAgICAgICAgXCJhbGxvd2VkVVJMXCI6IFwiQWxsb3dlZCBVUkxcIixcbiAgICAgICAgXCJhbGxvd2VkVVJMaW5mb1wiOiBcIlBsZWFzZSBlbnRlciBhIFVSTCB0aGF0IGlzIGFsbG93ZWQgZHVyaW5nIHRoZSBleGFtXCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc19tb2RlXCI6IFwiRXh0ZW5kZWQgU2V0dGluZ3MgZm9yIEV4YW0tTW9kZVwiLFxuICAgICAgICBcInJkcFwiOiBcIldlYiBSRFBcIixcbiAgICAgICAgXCJyZHBjb25maWdcIjogXCJSRFAgQ29uZmlndXJhdGlvblwiLFxuICAgICAgICBcInJkcGNvbmZpZ2luZm9cIjogXCJQbGVhc2UgZW50ZXIgdGhlIGRvbWFpbiAoVVJMKSBvZiB0aGUgUkRQLVNlcnZlclwiLFxuICAgICAgICBcIm11dGVhdWRpb1wiOiBcIk11dGUgYXVkaW9cIixcbiAgICAgICAgXCJtdXRlYXVkaW9pbnRyb1wiOiBcIklmIHRoaXMgb3B0aW9uIGlzIGFjdGl2YXRlZCwgYXVkaW8gc2lnbmFscyBkdXJpbmcgdGhlIGV4YW0gd2lsbCBub3QgYmUgcGxheWVkXCIsXG4gICAgICAgIFwic2hvd3N1Ym1pc3Npb25cIjogXCJTaG93IHN1Ym1pc3Npb25cIixcbiAgICAgICAgXCJzdHVkZW50aW5mb1wiOiBcIlNob3cgc3R1ZGVudCBkZXRhaWxzXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRpbmZvXCI6IFwiVGhlIGV4YW0gZW52aXJvbm1lbnQgaXMgcG9zc2libHkgcnVubmluZyBpbiBhIHZpcnR1YWwgbWFjaGluZVwiLFxuICAgICAgICBcImxlZnRraW9za2luZm9cIjogXCJUaGUgc2VjdXJlIG1vZGUgd2FzIGxlZnQgYXR0ZW1wdCFcIixcbiAgICAgICAgXCJleGFtcmVxdWVzdGluZm9cIjogXCJCYWNrdXAgcmVxdWVzdHMgd2VyZSBtYWRlXCIsXG4gICAgICAgIFwicmVtb3RlYXNzaXN0YW50aW5mb1wiOiBcIlJlbW90ZSBBc3Npc3RhbnQgU29mdHdhcmUgaXMgcG9zc2libHkgcnVubmluZyBvbiB0aGUgY2xpZW50IGRldmljZVwiLFxuICAgICAgICBcImRvY3VtZW50c2luZm9cIjogXCJEb2N1bWVudHMgb24gdGhlIGNsaWVudCBkZXZpY2U6IFwiLFxuICAgICAgICBcImZpbGVzaXpld2FybmluZ1wiOiBcIkZpbGUgU2l6ZVwiLFxuICAgICAgICBcImZpbGVzaXpld2FybmluZ3RleHRcIjogXCJ7ZmlsZW5hbWV9IGlzIGxhcmdlciB0aGFuIDggTUIgKHtzaXplfSBNQikuIExhcmdlIGZpbGVzIG1heSBzbG93IGRvd24gdGhlIHRyYW5zZmVyLlwiLFxuICAgICAgICBcIm5vcHJpbnRlckNob3NlblwiOiBcInBsZWFzZSBzZWxlY3QgYSBwcmludGVyXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcImludmFsaWRyZWdpc3RyYXRpb25cIjogXCJubyBzZXJ2ZXJzaWRlIHJlZ2lzdHJhdGlvblwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwic3RhdGVjaGFuZ2VcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgYWxyZWFkeSByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcInNlcnZlcmV4aXN0c1wiOiBcIkV4YW0gU2VydmVyIGFscmVhZHkgZXhpc3RzXCIsXG4gICAgICAgIFwic2VydmVyZXhpc3RzTEFOXCI6IFwiRXhhbSBTZXJ2ZXIgYWxyZWFkeSBhY3RpdmUgaW4gbG9jYWwgYXJlYSBuZXR3b3JrXCIsXG4gICAgICAgIFwic2VydmVyc3RhcnRlZFwiOiBcIkV4YW0gU2VydmVyIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJzZXJ2ZXJzdG9wcGVkXCI6IFwiRXhhbSBTZXJ2ZXIgc3RvcHBlZFwiLFxuICAgICAgICBcIm5vdGZvdW5kXCI6IFwiRXhhbSBkb2Vzbid0IGV4aXN0XCIsXG4gICAgICAgIFwid3Jvbmdwd1wiOiBcIldyb25nIFBhc3N3b3JkXCIsXG4gICAgICAgIFwid3JvbmdwaW5cIjogXCJXcm9uZyBQSU5cIixcbiAgICAgICAgXCJjb3JyZWN0cHdcIjogXCJQYXNzd29yZCBPS1wiLFxuICAgICAgICBcInN0dWRlbnRyZW1vdmVcIjogXCJSZW1vdmVkIHN0dWRlbnQgZnJvbSBFeGFtIFNlcnZlclwiLFxuICAgICAgICBcImFjdGlvbmRlbmllZFwiOiBcImFjdGlvbiBkZW5pZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcInN0dWRlbnR1cGRhdGVcIjogXCJzdHVkZW50IHVwZGF0ZWRcIixcbiAgICAgICAgXCJzdHVkZW50bGVmdFwiOiBcInN0dWRlbnQgbGVmdCB0aGUgZXhhbVwiLFxuICAgICAgICBcInN0YXRlcmVzdG9yZVwiOiBcInNhZmUgZXhhbSBzdGF0ZSByZXN0b3JlZFwiLFxuICAgICAgICBcInZpcnR1YWxpemVkXCI6IFwibmV4dC1leGFtIGlzIHJ1biBpbiBhIHZpcnR1YWwgbWFjaGluZVwiLFxuICAgICAgICBcInZlcnNpb25taXNtYXRjaFwiOiBcIkFwcGxpY2F0aW9uIHZlcnNpb25zIG1pc21hdGNoXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjogXCJFeGFtcyByZXF1ZXN0ZWRcIixcbiAgICAgICAgXCJiaXByZXF1aXJlZFwiOiBcIkJpbGR1bmdzcG9ydGFsIGF1dGhlbnRpZmljYXRpb24gbWFuZGF0b3J5IVwiLFxuICAgICAgICBcInN1Ym1pc3Npb25mYWlsZWRcIjogXCJTdWJtaXNzaW9uIGZhaWxlZCFcIixcbiAgICAgICAgXCJzdWJtaXNzaW9uc1wiOiBcIlN1Ym1pc3Npb25zXCJcbiAgICB9LCAgXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidGhlIHRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcImRlbmllZFwiOiBcInBlcm1pc3Npb24gZGVuaWVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJub2NsaWVudHNcIjogXCJubyBzdHVkZW50cyBjb25uZWN0ZWRcIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJmaWxlcyBzZW50XCIsXG4gICAgICAgIFwiY291bGRub3RzdG9yZVwiOiBcInN0dWRlbnQgY291bGQgbm90IHN0b3JlIGZpbGVcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcIm5vZmlsZXJlY2VpdmVkXCI6IFwibm8gZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJmZGVsZXRlZFwiOiBcImRlbGV0ZWRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJyZWFkaW5nIGZpbGUgZmFpbGVkXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJQb3NzaWJseSBzY2FubmVkIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJPblwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwibGVzcyB0aGFuIDIgaW50ZXJhY3RpdmUgZm9ybSBmaWVsZHMgd2VyZSBmb3VuZC5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJUaGlzIGluZGljYXRlcyB0aGF0IHRoaXMgaXMgYSBzY2FubmVkIFBERiB0aGF0IGRvZXMgbm90IGNvbnRhaW4gYWN0aXZlIGZvcm0gZmllbGRzIG9yIHRhYmxlcy5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVW5kZXJzdG9vZFwiLFxuICAgICAgICBcInBhZ2VcIjogXCJQYWdlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJQYWdlc1wiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c1wiOiBcIlBsZWFzZSBkb3VibGUgY2hlY2sgdGhlIHJlbmRlcmluZyBvZiB0aGUgYWN0aXZlIHNoZWV0cyBmb3JtIGZpZWxkcyBiZWZvcmUgc3RhcnRpbmcgdGhlIGV4YW0hXCIsXG4gICAgICAgIFwiZWRpdFwiOiBcIkVkaXRcIixcbiAgICAgICAgXCJzYXZlXCI6IFwiU2F2ZVwiXG4gICAgfVxufVxuIiwgInsgXG4gICAgXCJnZW5lcmFsXCI6IHtcbiAgICAgICAgXCJzdGFydHNlcnZlclwiOlwiUHJcdTAwRkNmdW5nIGFubGVnZW5cIixcbiAgICAgICAgXCJzbGlzdFwiOiBcIkFrdGl2ZSBQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcIm9rXCI6IFwiT0tcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiS2VpbmUgTmV0endlcmt2ZXJiaW5kdW5nXCJcbiAgICB9LFxuICAgIFwic2VydmVybGlzdFwiIDoge1xuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJsb2dpblwiOiBcImFubWVsZGVuXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW4gUGFzc3dvcnQgZWluXCJcbiAgICB9LFxuICAgIFwic3RhcnRzZXJ2ZXJcIiA6IHtcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJzdGFydFwiOiBcIlByXHUwMEZDZnVuZyBzdGFydGVuXCIsXG4gICAgICAgIFwicmVzdW1lXCI6IFwiUHJcdTAwRkNmdW5nIGZvcnRzZXR6ZW5cIixcbiAgICAgICAgXCJleGFtbmFtZVwiOiBcIlByXHUwMEZDZnVuZ3NuYW1lXCIsXG4gICAgICAgIFwicHdkXCI6IFwiUGFzc3dvcnRcIixcbiAgICAgICAgXCJlbXB0eXB3XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbiBQYXNzd29ydCBhblwiLFxuICAgICAgICBcImVtcHR5bmFtZVwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lbiBOYW1lbiBhblwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiZm9ydGdlc2Nocml0dGVuXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwiZWluZmFjaFwiLFxuICAgICAgICBcIndvcmtmb2xkZXJcIjogXCJBcmJlaXRzdmVyemVpY2huaXNcIixcbiAgICAgICAgXCJzZWxlY3RcIjogXCJBcmJlaXRzdmVyemVpY2huaXMgd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJmcmVlc3BhY2V3YXJuaW5nXCIgOiBcIlp1IHdlbmlnIGZyZWllciBTcGVpY2hlcnBsYXR6XCIsXG4gICAgICAgIFwiZGlyZWN0b3J5ZXJyb3JcIjogXCJGZWhsZW5kZSBTY2hyZWlicmVjaHRlIGltIGdld1x1MDBFNGhsdGVuIFZlcnplaWNobmlzXCIsXG4gICAgICAgIFwicHJldmlvdXNleGFtc1wiOiBcIkxva2FsIGdlc2ljaGVydGUgUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJmb2xkZXJkZWxldGVcIjogXCJXb2xsZW4gU2llIGRpZSBkZW4gbG9rYWxlbiBQclx1MDBGQ2Z1bmdzb3JkbmVyIGxcdTAwRjZzY2hlbj9cIixcbiAgICAgICAgXCJvbmxpbmVleGFtc1wiOiBcIkJpUCBQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcImJpcG5vdGxvZ2dlZGluXCI6IFwiQml0dGUgbWVsZGVuIFNpZSBzaWNoIGFtIEJpUCBhbiwgYmV2b3IgU2llIGRpZSBQclx1MDBGQ2Z1bmcgc3RhcnRlblwiLFxuICAgICAgICBcIm5vTmV3c1wiOlwiS2VpbmUgTmV1aWdrZWl0ZW4gdmVyZlx1MDBGQ2diYXJcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJcIjogXCJCYWNrdXB2ZXJ6ZWljaG5pc1wiLFxuICAgICAgICBcImJhY2t1cGZvbGRlcmluZm9cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZW4gUGZhZCBmXHUwMEZDciBkYXMgQmFja3VwLVZlcnplaWNobmlzIGVpblwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NcIjogXCJFcndlaXRlcnRcIixcbiAgICAgICAgXCJpbmNvbXBhdGlibGVcIjogXCJOaWNodCBrb21wYXRpYmVsIG1pdCBkZXIgYWt0dWVsbGVuIFZlcnNpb25cIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VcIjogXCJOZXR6d2Vyay1TY2huaXR0c3RlbGxlIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwic2VsZWN0aW50ZXJmYWNlaW5mb1wiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIGJldm9yenVndGUgTmV0endlcmtzY2huaXR0c3RlbGxlIGF1cyFcIlxuICAgIH0sXG4gICAgXCJkYXNoYm9hcmRcIjp7XG4gICAgICAgIFwicmVtb3ZlVVJMXCI6IFwiVVJMIGVudGZlcm5lblwiLFxuICAgICAgICBcInJlbW92ZVVSTGNvbmZpcm1cIjogXCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIGRpZXNlIFVSTCBlbnRmZXJuZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudFwiOiBcIlJlbW90ZSBBc3Npc3RhbnRcIixcbiAgICAgICAgXCJzZXJ2ZXJcIjogXCJTZXJ2ZXItQWRyZXNzZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJzdG9wc2VydmVyXCI6IFwiUHJcdTAwRkNmdW5nIHZlcmxhc3NlblwiLFxuICAgICAgICBcImZpbGVzZW5kXCI6IFwiRGF0ZWllbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaWxlc2VuZHRleHRcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBvZGVyIG1laHJlcmUgRGF0ZWllblwiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kXCI6IFwiRGF0ZWkgaG9jaGxhZGVuXCIsXG4gICAgICAgIFwib2ZmaWNlZmlsZXNlbmR0ZXh0XCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgLnhsc3ggYnp3LiAuZG9jeCBEYXRlaSBhbHMgVGVtcGxhdGUgZlx1MDBGQ3IgZGllIFNjaFx1MDBGQ2xlcjppbm5lblwiLFxuICAgICAgICBcImNhbmNlbFwiOiBcIkFiYnJlY2hlblwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJLZWluZSBEYXRlaWVuIGF1c2dld1x1MDBFNGhsdFwiLFxuICAgICAgICBcInVwbG9hZGZpbGVzXCI6IFwiRGF0ZWllbiB3ZXJkZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJEYXRlaWVuIGdlc2VuZGV0XCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwiS2VpbmUgU2NoXHUwMEZDbGVyOmlubmVuIHZlcmJ1bmRlblwiLFxuICAgICAgICBcImxhbmdcIjogXCJTcHJhY2hlblwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGlrXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzXCI6IFwiQWN0aXZlIFNoZWV0c1wiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c2hpbnRcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBQREYtRGF0ZWkgYXVzLCBkaWUgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcImFjY2VwdFBkZlwiOiBcIlBERiBEYXRlaSBcdTAwRkNiZXJuZWhtZW5cIixcbiAgICAgICAgXCJzZWxlY3RPdGhlclBkZlwiOiBcImFuZGVyZSBQREYgRGF0ZWkgd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJub3BkZnNlbGVjdGVkXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgUERGLURhdGVpIGF1cyFcIixcbiAgICAgICAgXCJpbnZhbGlkcGRmXCI6IFwiVW5nXHUwMEZDbHRpZ2UgUERGLURhdGVpIVwiLFxuICAgICAgICBcInBkZnByb2Nlc3NpbmdlcnJvclwiOiBcIkZlaGxlciBiZWltIFZlcmFyYmVpdGVuIGRlciBQREYtRGF0ZWkuXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsXCI6IFwiRWR1dmlkdWFsIC8gTW9vZGxlXCIsXG4gICAgICAgIFwid2Vic2l0ZVwiOiBcIldlYnNpdGUtVVJMXCIsXG4gICAgICAgIFwiYXV0b2dldFwiOiBcIkJhY2t1cC1JbnRlcnZhbGxcIixcbiAgICAgICAgXCJzdGFydGV4YW1cIjogXCJHZXJcdTAwRTR0ZSBhYnNpY2hlcm5cIixcbiAgICAgICAgXCJzdGFydGV4YW1zaW5nbGVcIjogXCJHZXJcdTAwRTR0IGFic2ljaGVyblwiLFxuICAgICAgICBcInN0YXJ0ZXhhbWRlc2NcIjogXCJTdGFydGV0IGRlbiBhYmdlc2ljaGVydGVuIFByXHUwMEZDZnVuZ3Ntb2R1cyBhdWYgZGVuIEdlclx1MDBFNHRlbiBkZXIgU2NoXHUwMEZDbGVyOmlubmVuXCIsXG4gICAgICAgIFwic2VuZGZpbGVcIjogXCJEYXRlaWVuIGFuIGFsbGUgU2NoXHUwMEZDbGVyOmlubmVuIHNlbmRlbiAocGRmLCBqcGcsIG1wMywgYmFrLCBnZ2IsIHBuZywgZ2lmLCB3YXYsIG9nZylcIixcbiAgICAgICAgXCJzZW5kZmlsZVNpbmdsZVwiOiBcIkRhdGVpIHNlbmRlblwiLFxuICAgICAgICBcImdldGZpbGVcIjogXCJTaWNoZXJ1bmdlbiB2b24gYWxsZW4gU2NoXHUwMEZDbGVyOmlubmVuIGhvbGVuXCIsXG4gICAgICAgIFwiZ2V0ZmlsZVNpbmdsZVwiOiBcIlNpY2hlcnVuZyBob2xlblwiLFxuICAgICAgICBcImdldGZpbGVzXCI6IFwiU2ljaGVydW5nIGhvbGVuXCIsXG4gICAgICAgIFwic3RvcGV4YW1cIjogXCJHZXJcdTAwRTR0ZSBmcmVpZ2ViZW5cIixcbiAgICAgICAgXCJzdG9wZXhhbXNpbmdsZVwiOiBcIkdlclx1MDBFNHQgZnJlaWdlYmVuXCIsXG4gICAgICAgIFwic3VyZVwiOiBcIlNpbmQgU2llIHNpY2hlcj9cIixcbiAgICAgICAgXCJleGl0ZXhhbXN1cmVcIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIHNjaGxpZVx1MDBERmVuP1wiLFxuICAgICAgICBcImV4aXRleGFtXCI6IFwiRGllcyBiZWVuZGV0IGRlbiBQclx1MDBGQ2Z1bmdzc2VydmVyLlxcbkRpZSBTY2hcdTAwRkNsZXI6aW5uZW4ga1x1MDBGNm5uZW4gaW0gYWJnZXNpY2hlcnRlbiBNb2R1cyBhdWNoIG9obmUgVmVyYmluZHVuZyB3ZWl0ZXJhcmJlaXRlbi5cIixcbiAgICAgICAgXCJleGl0ZXhhbWluZm9cIjogXCJBbGxlIGJlc3RlaGVuZGVuIFZlcmJpbmR1bmdlbiB3ZXJkZW4gdW50ZXJicm9jaGVuXCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuLiBEaWVzIHNjaGxpZVx1MDBERnQgZGFzIFByXHUwMEZDZnVuZ3NmZW5zdGVyIGZcdTAwRkNyIGFsbGUgU2NoXHUwMEZDbGVyOmlubmVuIVwiLFxuICAgICAgICBcImV4aXRraW9za3Nob3J0XCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuLlwiLFxuICAgICAgICBcInJlYWxseWtpY2tcIjogXCJ2b20gUHJcdTAwRkNmdW5nc3NlcnZlciBlbnRmZXJuZW5cIixcbiAgICAgICAgXCJraWNrXCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiQWJzaWNoZXJ1bmcgdmVybGFzc2VuXCIsXG4gICAgICAgIFwib25saW5lXCI6XCJJbmZvXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIm9mZmxpbmVcIixcbiAgICAgICAgXCJzZWN1cmVcIjpcIkV4YW1cIixcbiAgICAgICAgXCJzZWN1cmVpbmZvXCI6XCJTY2hcdTAwRkNsZXI6aW4gaXN0IGFiZ2VzaWNoZXJ0XCIsXG4gICAgICAgIFwicmVzdG9yZVwiOlwiZm9ydHNldHplblwiLFxuICAgICAgICBcInJlc3VtZWluZm9cIjpcIlRlbXBvclx1MDBFNHJlIEJsb2NrYWRlIGF1ZmhlYmVuXCIsXG4gICAgICAgIFwiZXhhbW1vZGVhY3RpdmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gYmVyZWl0cyBpbSBhYmdlc2ljaGVydGVuIE1vZHVzXCIsXG4gICAgICAgIFwiY2xvc2VcIjpcInNjaGxpZVx1MDBERmVuXCIsXG4gICAgICAgIFwiZGVsXCI6IFwiQXJiZWl0c29yZG5lciBhdWYgR2VyXHUwMEU0dGVuIGRlciBTY2hcdTAwRkNsZXI6aW5uZW4gYmVyZWluaWdlblwiLFxuICAgICAgICBcImRlbHN1cmVcIjogXCJEaWUgQXJiZWl0c29yZG5lciBhdWYgZGVuIEdlclx1MDBFNHRlbiBkZXIgU2NoXHUwMEZDbGVyOmlubmVuIHdlcmRlbiBnZWxlZXJ0XCIsXG4gICAgICAgIFwiZGVsc2luZ2xlXCI6IFwiQXJiZWl0c29yZG5lciBhdWYgU2NoXHUwMEZDbGVyOmlubmVuLVNlaXRlIGJlcmVpbmlnZW5cIixcbiAgICAgICAgXCJkZWxzaW5nbGVzdXJlXCI6IFwiRGVyIEFyYmVpdHNvcmRuZXIgYXVmIGRlbSBTY2hcdTAwRkNsZXI6aW5uZW4tR2VyXHUwMEU0dCB3aXJkIGdlbGVlcnRcIixcbiAgICAgICAgXCJhdHRlbnRpb25cIjogXCJBY2h0dW5nIVwiLFxuICAgICAgICBcImJhY2t1cHJlcXVlc3RcIjogXCJBcmJlaXRlbiB3ZXJkZW4gZ2Vob2x0XCIsXG4gICAgICAgIFwic2hvd3dvcmtmb2xkZXJcIjogXCJMb2thbGVuIEFyYmVpdHNvcmRuZXIgYW56ZWlnZW5cIixcbiAgICAgICAgXCJ3b3JrZm9sZGVyXCI6IFwiT3JkbmVyIFx1MDBGNmZmbmVuXCIsXG4gICAgICAgIFwic2hvd25ld2VzdGZvbGRlclwiOiBcIk5ldWVzdGVuIE9yZG5lciBhbnplaWdlblwiLFxuICAgICAgICBcImZpbGVzZm9sZGVyXCI6IFwiRGF0ZWllbiBpbSBBcmJlaXRzb3JkbmVyXCIsXG4gICAgICAgIFwiY2hvb3Nlc3R1ZGVudFwiOiBcIldcdTAwRTRobGVuIFNpZSBlaW5lIFBlcnNvblwiLFxuICAgICAgICBcImNob29zZXJlcXVpcmVcIjogXCJTaWUgbVx1MDBGQ3NzZW4gZWluZSBPcHRpb24gd1x1MDBFNGhsZW4hXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJLZWluZSBTY2hcdTAwRkNsZXJhcmJlaXRlbiBnZWZ1bmRlblwiLFxuICAgICAgICBcInN1bW1hcml6ZXBkZlwiOiBcIkxldHp0ZSBBYmdhYmVuIGluXFxuZWluZXIgUERGLURhdGVpXFxuenVzYW1tZW5mYXNzZW5cIixcbiAgICAgICAgXCJzdW1tYXJpemVwZGZzaG9ydFwiOiBcIkxldHp0ZSBBYmdhYmVuIHp1c2FtbWVuZmFzc2VuXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0XCI6IFwiRHJ1Y2thbmZyYWdlIGVyaGFsdGVuXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0c2hvd1wiOiBcIldvbGxlbiBTaWUgZGFzIERva3VtZW50IGFuc2VoZW4gdW5kIGRydWNrZW4/XCIsXG4gICAgICAgIFwiZG93bmxvYWRcIjogXCJoZXJ1bnRlcmxhZGVuXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJkcnVja2VuXCIsXG4gICAgICAgIFwicHJldmlld1wiOiBcImFuc2VoZW5cIixcbiAgICAgICAgXCJzZW5kXCI6IFwidmVyc2VuZGVuXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjpcImFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJBY3RpdmF0ZVwiOiBcIkFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcInZpcnR1YWxpc2VydGUgQXJiZWl0c3VtZ2VidW5nXCIsXG4gICAgICAgIFwiZGVsZXRlXCI6IFwibFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiZmlsZWRlbGV0ZVwiOiBcIldvbGxlbiBTaWUgZGllIERhdGVpL2RlbiBPcmRuZXIgd2lya2xpY2ggbFx1MDBGNnNjaGVuP1wiLFxuICAgICAgICBcImNhbm5vdERlbGV0ZUFjdGl2ZVNoZWV0XCI6IFwiQWN0aXZlIFNoZWV0IGthbm4gd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgbmljaHQgZ2VsXHUwMEY2c2NodCB3ZXJkZW5cIixcbiAgICAgICAgXCJleGl0ZGVsZXRlXCI6IFwiUHJcdTAwRkNmdW5nc2RhdGVuIGF1ZiBTY2hcdTAwRkNsZXJQQ3MgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2FjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWliaGlsZmUgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJWb3JzY2hsXHUwMEU0Z2UgemVpZ2VuXCIsXG4gICAgICAgIFwiY3VzdG9taG9zdFwiOiBcIkVpZ2VuZXIgTFQgSG9zdFwiLFxuICAgICAgICBcImxhbmd1YWdldG9vbGhvc3RcIjogXCJMYW5ndWFnZVRvb2wgSG9zdFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJhbmRlcmVcIixcbiAgICAgICAgXCJjbWFyZ2luXCI6IFwiS29ycmVrdHVycmFuZCBQb3NpdGlvblwiLFxuICAgICAgICBcImNtYXJnaW4tbGVmdFwiOiBcImxpbmtzXCIsXG4gICAgICAgIFwiY21hcmdpbi1yaWdodFwiOiBcInJlY2h0c1wiLFxuICAgICAgICBcImNtYXJnaW4tdmFsdWVcIjogXCJLb3JyZWt0dXJyYW5kIGltIFBERlwiLFxuICAgICAgICBcInRleHRlZGl0b3JcIjogXCJUZXh0ZWRpdG9yLUVpbnN0ZWxsdW5nZW5cIixcbiAgICAgICAgXCJkZVwiOiBcIkRldXRzY2hcIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzY2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzY2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJhbnpcdTAwRjZzaXNjaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWVuaXNjaFwiLFxuICAgICAgICBcInNsXCI6XCJTbG93ZW5pc2NoXCIsXG4gICAgICAgIFwiYmFja3VwYXV0b1wiOlwiQXV0b21hdGlzY2hlIFNpY2hlcnVuZ1wiLFxuICAgICAgICBcImJhY2t1cGF1dG9xdWVzdGlvblwiOlwiSW4gd2VsY2hlbiBBYnN0XHUwMEU0bmRlbiBzb2xsZW4gZGllIEFyYmVpdGVuIGdlaG9sdCB3ZXJkZW4/XCIsXG4gICAgICAgIFwiYmFja3VwYXV0b2hpbnRcIjpcIihaZWl0YW5nYWJlIGluIE1pbnV0ZW4pXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRcIjogXCJFZHV2aWR1YWwgLyBNb29kbGVcIixcbiAgICAgICAgXCJlZHV2aWR1YWxpZGhpbnRcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgVGVzdC1VUkwgZWluIVwiLFxuICAgICAgICBcImdmb3Jtc2hpbnRcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgR29vZ2xlIEZvcm1zIElEIGVpbiFcIixcbiAgICAgICAgXCJlZHV2aWR1YWxkb21haW5cIjogXCJTb2xsdGUgaWhyZSBNb29kbGVpbnN0YW56IHVudGVyIGVpbmVyIGFuZGVyZW4gRG9tYWluIGVycmVpY2hiYXIgc2VpbiwgZ2ViZW4gU2llIGRpZXNlIGFuXCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZERvbWFpblwiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIGdcdTAwRkNsdGlnZSBNb29kbGUtRG9tYWluIGFuIVwiLFxuICAgICAgICBcImludmFsaWREb21haW5cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgRG9tYWluIGVpbiFcIixcbiAgICAgICAgXCJtb29kbGVJbnZhbGlkSWRcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgVGVzdC1JRCBhbiFcIixcbiAgICAgICAgXCJsb2NrXCI6XCJCaWxkc2NoaXJtZSBzcGVycmVuXCIsXG4gICAgICAgIFwidW5sb2NrXCI6XCJCaWxkc2NoaXJtZSBmcmVpZ2ViZW5cIixcbiAgICAgICAgXCJmcmVlc3BhY2V3YXJuaW5nXCIgOiBcIkZyZWllciBTcGVpY2hlcnBsYXR6IHp1IGdlcmluZyFcIixcbiAgICAgICAgXCJpbnZhbGlkX2ZpbGVcIiA6IFwiRmFsc2NoZXIgRGF0ZWl0eXBcIixcbiAgICAgICAgXCJpbnZhbGlkX2ZpbGVfdGV4dFwiOiBcIk51ciBEYXRlaWVuIG1pdCBkZXIgRW5kdW5nIC54bHN4IHVuZCAuZG9jeCBzaW5kIGVybGF1YnQuXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiVm9yaGFuZGVuZSBEYXRlaWVuIGF1ZiBPbmVEcml2ZSBlcnNldHplbj9cIixcbiAgICAgICAgXCJleGFtcmVxdWVzdFwiOlwiU2ljaGVydW5nIGFuZ2Vmb3JkZXJ0XCIsXG4gICAgICAgIFwic2NyZWVuc2hvdFwiOlwiU2NyZWVuc2hvdHVwZGF0ZVwiLFxuICAgICAgICBcInNjcmVlbnNob3R0aXRsZVwiOlwiU2NyZWVuc2hvdCBVcGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90cXVlc3Rpb25cIjpcIkluIHdlbGNoZW4gQWJzdFx1MDBFNG5kZW4gc29sbGVuIGRpZSBTY3JlZW5zaG90cyBha3R1YWxpc2llcnQgd2VyZGVuP1wiLFxuICAgICAgICBcInNjcmVlbnNob3RoaW50XCI6XCIoWmVpdGFuZ2FiZSBpbiBTZWt1bmRlbi4gMCA9PSBkZWFrdGl2aWVydClcIixcbiAgICAgICAgXCJvbGRwZGZ3YXJuaW5nXCI6XCJNYW5jaGUgQWJnYWJlbiBzaW5kIG1laHIgYWxzIDUgTWludXRlbiBhbHQhXCIsXG4gICAgICAgIFwib2xkcGRmd2FybmluZ3NpbmdsZVwiOlwiRGllIGxva2FsZSBWZXJzaW9uIGRlciBEYXRlaSBpc3QgbVx1MDBGNmdsaWNoZXJ3ZWlzZSB2ZXJhbHRldCFcIixcbiAgICAgICAgXCJnZm9ybXNcIjogXCJHb29nbGUgRm9ybXNcIixcbiAgICAgICAgXCJhY2Nlc3NEZW5pZWRcIjpcIlp1Z3JpZmYgdmVyd2VpZ2VydCFcIixcbiAgICAgICAgXCJhY2Nlc3NEZW5pZWR0ZXh0XCI6XCJCaXR0ZSBrb250YWt0aWVyZW4gU2llIGlocmVuIFN5c3RlbWFkbWluaXN0cmF0b3IsIHVtIGRlciBBcHBsaWthdGlvbiBOZXh0LUV4YW0gWnVncmlmZiB6dSBnZXdcdTAwRTRocmVuXCIsXG4gICAgICAgIFwibXNvV2FyblwiOiBcIkJldm9yIGRpZSBTY2hcdTAwRkNsZXI6aW5uZW4gZGllIFZlcmJpbmR1bmcgd2llZGVyIGF1Zm5laG1lbiBrXHUwMEY2bm5lbiwgbVx1MDBGQ3NzZW4gU2llIHNpY2ggenUgaWhyZXIgTWljcm9zb2Z0IENsb3VkIHZlcmJpbmRlbiB1bmQgZGllIE1TT0RhdGVpIGVybmV1dCBhdXN3XHUwMEU0aGxlbiFcIixcbiAgICAgICAgXCJhbGxvd3NwZWxsY2hlY2tcIjpcIlJlY2h0c2NocmVpYmhpbGZlIGZcdTAwRkNyIFNjaFx1MDBGQ2xlcjppbiBha3RpdmllcmVuXCIsXG4gICAgICAgIFwibGluZXNwYWNpbmdcIjogXCJaZWlsZW5hYnN0YW5kIGltIFBERlwiLFxuICAgICAgICBcImZvbnRmYW1pbHlcIjogXCJTY2hyaWZ0YXJ0XCIsXG4gICAgICAgIFwiZGVmYXVsdHByaW50ZXJcIjogXCJTdGFuZGFyZC1EcnVja2VyIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwiYWxsb3dkaXJlY3RwcmludFwiOiBcIlNjaFx1MDBGQ2xlcjppbm5lbiBlcmxhdWJlbiBEcnVja2F1ZnRyXHUwMEU0Z2UgZGlyZWt0IHp1IHN0YXJ0ZW5cIixcbiAgICAgICAgXCJub3ByaW50ZXJcIjogXCJLZWluZSBEcnVja2VyIGdlZnVuZGVuXCIsXG4gICAgICAgIFwiZGlyZWN0cHJpbnRcIjogXCJBdXRvbm9tZXIgRHJ1Y2tcIixcbiAgICAgICAgXCJvcGVuXCI6IFwiRGF0ZWkgaW4gZXh0ZXJuZW0gQmV0cmFjaHRlciBcdTAwRjZmZm5lblwiLFxuICAgICAgICBcIm9jclwiOiBcIk9DUiBTaWNoZXJoZWl0XCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXR0aXRsZVwiOiBcIkFic3BpZWxlbiB2b24gQXVkaW9kYXRlaWVuIGVpbnNjaHJcdTAwRTRua2VuXCIsXG4gICAgICAgIFwiYXVkaW9hbGxvd1wiOiBcIktlaW5lIEVpbnNjaHJcdTAwRTRua3VuZ1wiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MVwiOiBcInggYWJzcGllbGVuXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXQyXCI6IFwieCBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOiBcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxhY3RpdmF0ZVwiOiBcIkJpbGR1bmdzcG9ydGFsIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbHNldHRpbmdzXCI6IFwiRXJ3ZWl0ZXJ0ZSBFaW5zdGVsbHVuZ2VuIHp1bSBCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImdyb3Vwc1wiOiBcIkdydXBwZW5cIixcbiAgICAgICAgXCJncm91cGluZm9cIjogXCJTY2hcdTAwRkNsZXI6aW5uZW4gaW4gendlaSBHcnVwcGVuIGF1ZnRlaWxlblwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NcIjogXCJFcndlaXRlcnRlIEVpbnN0ZWxsdW5nZW5cIixcbiAgICAgICAgXCJzYXZlXCI6IFwic3BlaWNoZXJuXCIsXG4gICAgICAgIFwiZGlzYWJsZWRcIjogXCJkZWFrdGl2aWVydFwiLFxuICAgICAgICBcIm9jcmluZm9cIjpcIkFrdHVlbGxlIFByXHUwMEZDZnVuZ3MtUElOIGltIFNjcmVlbnNob3QgZXJrZW5uZW5cIixcbiAgICAgICAgXCJiaXBpbmZvXCI6IFwiQmlQLVN0YXR1cyBnaWJ0IGFuIG9iIHNpY2ggYXV0aGVudGlmaXppZXJ0ZSBDbGllbnRzIHZlcmJpbmRlbiBrXHUwMEY2bm5lblwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOiBcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgc2ljaCBhYm1lbGRlbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwiYWN0aXZhdGVzZWN0aW9uc1wiOiBcIlByXHUwMEZDZnVuZ3NhYnNjaG5pdHRlIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNcIjogXCJQclx1MDBGQ2Z1bmdzYWJzY2huaXR0ZVwiLFxuICAgICAgICBcImV4YW1zZWN0aW9uc2luZm9cIjogXCJTaWUgYmVmaW5kZW4gc2ljaCBpbSBhYmdlc2ljaGVydGVuIE1vZHVzLiBTb2xsIGRpZXNlciBQclx1MDBGQ2Z1bmdzYWJzY2huaXR0IGZcdTAwRkNyIGFsbGUgdmVyYnVuZGVuZW4gQ2xpZW50cyBha3RpdmllcnQgd2VyZGVuP1wiLFxuICAgICAgICBcIm5vXCI6XCJOZWluXCIsXG4gICAgICAgIFwieWVzXCI6XCJKYVwiLFxuICAgICAgICBcImV4YW1tb2RlXCI6XCJQclx1MDBGQ2Z1bmdzbW9kdXNcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjpcIlByXHUwMEZDZnVuZ3NtYXRlcmlhbGllblwiLFxuICAgICAgICBcImRlZmluZW1hdGVyaWFsc1wiOlwiTWF0ZXJpYWxpZW4gZmVzdGxlZ2VuIGRpZSB3XHUwMEU0aHJlbmQgZGVyIFByXHUwMEZDZnVuZyB2ZXJmXHUwMEZDZ2JhciBzZWluIHNvbGxlblwiLFxuICAgICAgICBcInByb2Nlc3NpbmdmaWxlc1wiOlwiTWF0ZXJpYWxpZW4gd2VyZGVuIHZlcmFyYmVpdGV0XCIsXG4gICAgICAgIFwiZm9udHNpemV0aXRsZVwiOiBcIlNjaHJpZnRnclx1MDBGNlx1MDBERmUgaW0gUERGXCIsXG4gICAgICAgIFwiZm9udHNpemVcIjogXCJTY2hyaWZ0Z3JcdTAwRjZcdTAwREZlXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZVwiOiBcIkRhdGVpIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcInJlbW92ZWZpbGVjb25maXJtXCI6IFwiV29sbGVuIFNpZSBkaWUgRGF0ZWkgd2lya2xpY2ggbFx1MDBGNnNjaGVuP1wiLFxuICAgICAgICBcInNlY3Rpb25uYW1lXCI6IFwiQWJzY2huaXR0c25hbWVcIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZWluZm9cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZW4gTmFtZW4gZlx1MDBGQ3IgZGllc2VuIEFic2Nobml0dCBlaW5cIixcbiAgICAgICAgXCJncm91cEFcIjogXCJHcnVwcGUgQVwiLFxuICAgICAgICBcImdyb3VwQlwiOiBcIkdydXBwZSBCXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTFwiOiBcIkVybGF1YnRlIFVSTFwiLFxuICAgICAgICBcImFsbG93ZWRVUkxpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgVVJMIGVpbiwgZGllIHdcdTAwRTRocmVuZCBkZXIgUHJcdTAwRkNmdW5nIGVybGF1YnQgaXN0XCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc19tb2RlXCI6IFwiRXJ3ZWl0ZXJ0ZSBFaW5zdGVsbHVuZ2VuIHp1bSBQclx1MDBGQ2Z1bmdzbW9kdXNcIixcbiAgICAgICAgXCJyZHBcIjogXCJXZWIgUkRQXCIsXG4gICAgICAgIFwicmRwY29uZmlnXCI6IFwiUkRQIEtvbmZpZ3VyYXRpb25cIixcbiAgICAgICAgXCJyZHBjb25maWdpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGRpZSBEb21haW4oVVJMKSBkZXMgUkRQLVNlcnZlcnMgZWluXCIsXG4gICAgICAgIFwibXV0ZWF1ZGlvXCI6IFwiQXVkaW8gc3R1bW1zY2hhbHRlblwiLFxuICAgICAgICBcIm11dGVhdWRpb2ludHJvXCI6IFwiV2VubiBkaWVzZSBPcHRpb24gYWt0aXZpZXJ0IGlzdCwgd2VyZGVuIGFrdXN0aXNjaGUgU2lnbmFsZSB3XHUwMEU0aHJlbmQgZGVyIFByXHUwMEZDZnVuZyBuaWNodCBhYmdlc3BpZWx0XCIsXG4gICAgICAgIFwic2hvd3N1Ym1pc3Npb25cIjogXCJBYmdhYmUgYW56ZWlnZW5cIixcbiAgICAgICAgXCJzdHVkZW50aW5mb1wiOiBcIkRldGFpbHMgdm9uIFNjaFx1MDBGQ2xlcjppbiBhbnplaWdlblwiLFxuICAgICAgICBcInZpcnR1YWxpemVkaW5mb1wiOiBcIkRpZSBQclx1MDBGQ2Z1bmdzdW1nZWJ1bmcgd2lyZCBtXHUwMEY2Z2xpY2hlcndlaXNlIGluIGVpbmVyIHZpcnR1ZWxsZW4gTWFzY2hpbmUgYXVzZ2VmXHUwMEZDaHJ0XCIsXG4gICAgICAgIFwibGVmdGtpb3NraW5mb1wiOiBcIkVzIHd1cmRlIHZlcnN1Y2h0IGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHp1IHZlcmxhc3NlbiFcIixcbiAgICAgICAgXCJleGFtcmVxdWVzdGluZm9cIjogXCJTaWNoZXJ1bmdlbiB3dXJkZW4gYW5nZWZvcmRlcnRcIixcbiAgICAgICAgXCJyZW1vdGVhc3Npc3RhbnRpbmZvXCI6IFwiUmVtb3RlIEFzc2lzdGFudCBTb2Z0d2FyZSBsXHUwMEU0dWZ0IG1cdTAwRjZnbGljaGVyd2Vpc2UgYW0gU2NoXHUwMEZDbGVyOmlubmVuLUdlclx1MDBFNHRcIixcbiAgICAgICAgXCJkb2N1bWVudHNpbmZvXCI6IFwiRG9rdW1lbnRlIGF1ZiBkZW0gU2NoXHUwMEZDbGVyOmlubmVuLUdlclx1MDBFNHQ6IFwiLFxuICAgICAgICBcImZpbGVzaXpld2FybmluZ1wiOiBcIkRhdGVpZ3JcdTAwRjZcdTAwREZlXCIsXG4gICAgICAgIFwiZmlsZXNpemV3YXJuaW5ndGV4dFwiOiBcIntmaWxlbmFtZX0gaXN0IGdyXHUwMEY2XHUwMERGZXIgYWxzIDggTUIgKHtzaXplfSBNQikuIEdyb1x1MDBERmUgRGF0ZWllbiBrXHUwMEY2bm5lbiBkaWUgXHUwMERDYmVydHJhZ3VuZyB2ZXJsYW5nc2FtZW4uXCIsXG4gICAgICAgIFwibm9wcmludGVyQ2hvc2VuXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmVuIERydWNrZXJcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiRGFzIFRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiaW52YWxpZHJlZ2lzdHJhdGlvblwiOiBcIktlaW5lIFJlZ2lzdHJpZXJ1bmcgdm9yZ2VmdW5kZW5cIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gYW5nZW1lbGRldFwiLFxuICAgICAgICBcInNlcnZlcmV4aXN0c1wiOiBcIlByXHUwMEZDZnVuZ3NzZXJ2ZXIgZXhpc3RpZXJ0IGJlcmVpdHNcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNMQU5cIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIGV4aXN0aWVydCBiZXJlaXRzIGltIGxva2xlbiBOZXR6d2Vya1wiLFxuICAgICAgICBcInNlcnZlcnN0YXJ0ZWRcIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIGdlc3RhcnRldFwiLFxuICAgICAgICBcInNlcnZlcnN0b3BwZWRcIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIGJlZW5kZXRcIixcbiAgICAgICAgXCJub3Rmb3VuZFwiOiBcIlByXHUwMEZDZnVuZyBleGlzdGllcnQgbmljaHRcIixcbiAgICAgICAgXCJ3cm9uZ3B3XCI6IFwiUGFzc3dvcnQgZmFsc2NoXCIsXG4gICAgICAgIFwid3JvbmdwaW5cIjogXCJGYWxzY2hlciBQSU5cIixcbiAgICAgICAgXCJjb3JyZWN0cHdcIjogXCJQYXNzd29ydCBPS1wiLFxuICAgICAgICBcInN0dWRlbnRyZW1vdmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gdm9uIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgZW50ZmVybnRcIixcbiAgICAgICAgXCJhY3Rpb25kZW5pZWRcIjogXCJBa3Rpb24gdmVyYm90ZW5cIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJzdHVkZW50dXBkYXRlXCI6IFwiU2NoXHUwMEZDbGVyZGF0ZW4gYWt0dWFsaXNpZXJ0XCIsXG4gICAgICAgIFwic3R1ZGVudGxlZnRcIjogXCJTY2hcdTAwRkNsZXI6aW4gaGF0IGRlbiBQclx1MDBGQ2Z1bmdzc2VydmVyIHZlcmxhc3NlblwiLFxuICAgICAgICBcInN0YXRlcmVzdG9yZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyB3aWVkZXJoZXJnZXN0ZWxsdFwiLFxuICAgICAgICBcInZpcnR1YWxpemVkXCI6IFwiOiBEaWUgUHJcdTAwRkNmdW5nc3VtZ2VidW5nIHdpcmQgaW4gZWluZXIgdmlydHVlbGxlbiBNYXNjaGluZSBhdXNnZWZcdTAwRkNocnRcIixcbiAgICAgICAgXCJ2ZXJzaW9ubWlzbWF0Y2hcIjogXCJEaWUgUHJvZ3JhbW12ZXJzaW9uZW4gc3RpbW1lbiBuaWNodCBcdTAwRkNiZXJlaW5cIixcbiAgICAgICAgXCJleGFtcmVxdWVzdFwiOiBcIlNpY2hlcnVuZ2VuIHd1cmRlbiBhbmdlZm9yZGVydFwiLFxuICAgICAgICBcImJpcHJlcXVpcmVkXCI6IFwiRGllcyBlcnp3aW5ndCBkaWUgQXV0aGVudGlmaXppZXJ1bmcgZGVyIFNjaFx1MDBGQ2xlcjppbm5lbiBkdXJjaCBkYXMgQmlsZHVuZ3Nwb3J0YWwuXCIsXG4gICAgICAgIFwic3VibWlzc2lvbmZhaWxlZFwiOiBcIkFiZ2FiZSBmZWhsZ2VzY2hsYWdlbiFcIixcbiAgICAgICAgXCJzdWJtaXNzaW9uc1wiOiBcIkFiZ2FiZW5cIlxuXG5cbiAgICB9LCAgXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZGVuaWVkXCI6IFwiWnVncmlmZiB2ZXJ3ZWlnZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwiS2VpbmUgU2NoXHUwMEZDbGVyOmlubmVuIHZlcmJ1bmRlblwiLFxuICAgICAgICBcImZpbGVzc2VudFwiOiBcIkRhdGVpZW4gZ2VzZW5kZXRcIixcbiAgICAgICAgXCJjb3VsZG5vdHN0b3JlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGtvbm50ZSBkaWUgRGF0ZWkgbmljaHQgc3BlaWNoZXJuXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZW4gZXJoYWx0ZW5cIixcbiAgICAgICAgXCJub2ZpbGVyZWNlaXZlZFwiOiBcIktlaW5lIERhdGVpZW4gZXJoYWx0ZW5cIixcbiAgICAgICAgXCJmZGVsZXRlZFwiOiBcImdlbFx1MDBGNnNjaHRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJsZXNlbiBkZXIgRGF0ZWkgZmVobGdlc2NobGFnZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJCaXR0ZSBcdTAwRkNiZXJwclx1MDBGQ2ZlbiBTaWUgZGllIERhcnN0ZWxsdW5nIHVuZCBQb3NpdGlvbmllcnVuZyBkZXIgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciB2b3IgZGVtIFN0YXJ0IGRlciBQclx1MDBGQ2Z1bmchXCIsXG4gICAgICAgIFwiZWRpdFwiOiBcIkJlYXJiZWl0ZW5cIixcbiAgICAgICAgXCJzYXZlXCI6IFwiU3BlaWNoZXJuXCJcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgTG9nTGV2ZWwsIFB1YmxpY0NsaWVudEFwcGxpY2F0aW9uIH0gZnJvbSAnQGF6dXJlL21zYWwtYnJvd3Nlcic7XG5cbi8vIENvbmZpZyBvYmplY3QgdG8gYmUgcGFzc2VkIHRvIE1zYWwgb24gY3JlYXRpb25cbmV4cG9ydCBjb25zdCBtc2FsQ29uZmlnID0ge1xuICBhdXRoOiB7XG4gICAgY2xpZW50SWQ6ICdjOTUyZWRkZS1kN2MyLTQyODEtYTg0Ni0wMzRmYjAzOWUxZjUnLFxuICAgIGF1dGhvcml0eTogJ2h0dHBzOi8vbG9naW4ubWljcm9zb2Z0b25saW5lLmNvbS9jb21tb24nLFxuICAgIHJlZGlyZWN0VXJpOiAnaHR0cHM6Ly9sb2NhbGhvc3Q6MjI0MjIvc2VydmVyL2NvbnRyb2wvbXNhdXRoJyxcbiAgICBwb3N0TG9nb3V0UmVkaXJlY3RVcmk6ICdodHRwczovL2xvY2FsaG9zdDoyMjQyMi9zZXJ2ZXIvY29udHJvbC9tc2F1dGgnXG4gIH0sXG4gIGNhY2hlOiB7XG4gICAgY2FjaGVMb2NhdGlvbjogJ2xvY2FsU3RvcmFnZSdcbiAgfSxcbiAgc3lzdGVtOiB7XG4gICAgICBsb2dnZXJPcHRpb25zOiB7XG4gICAgICAgICAgbG9nZ2VyQ2FsbGJhY2s6IChsZXZlbDogTG9nTGV2ZWwsIG1lc3NhZ2U6IHN0cmluZywgY29udGFpbnNQaWk6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgaWYgKGNvbnRhaW5zUGlpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc3dpdGNoIChsZXZlbCkge1xuICAgICAgICAgICAgICAgICAgY2FzZSBMb2dMZXZlbC5FcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuSW5mbzpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmluZm8obWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgY2FzZSBMb2dMZXZlbC5WZXJib3NlOlxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgY2FzZSBMb2dMZXZlbC5XYXJuaW5nOlxuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgbG9nTGV2ZWw6IExvZ0xldmVsLlZlcmJvc2VcbiAgICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IG1zYWxJbnN0YW5jZSA9IG5ldyBQdWJsaWNDbGllbnRBcHBsaWNhdGlvbihtc2FsQ29uZmlnKTtcblxuLy8gQWRkIGhlcmUgc2NvcGVzIGZvciBpZCB0b2tlbiB0byBiZSB1c2VkIGF0IE1TIElkZW50aXR5IFBsYXRmb3JtIGVuZHBvaW50cy5cbmV4cG9ydCBjb25zdCBsb2dpblJlcXVlc3QgPSB7XG4gIHNjb3BlczogWydVc2VyLlJlYWQnLCdvcGVuaWQnLCAncHJvZmlsZScsICdvZmZsaW5lX2FjY2VzcycsICdGaWxlcy5SZWFkJywgJ0ZpbGVzLlJlYWRXcml0ZScsJ0ZpbGVzLlJlYWRXcml0ZS5BcHBGb2xkZXInXSxcbn07XG5cbi8vIEFkZCBoZXJlIHRoZSBlbmRwb2ludHMgZm9yIE1TIEdyYXBoIEFQSSBzZXJ2aWNlcyB5b3Ugd291bGQgbGlrZSB0byB1c2UuXG5leHBvcnQgY29uc3QgZ3JhcGhDb25maWcgPSB7XG4gIGdyYXBoTWVFbmRwb2ludDogJ2h0dHBzOi8vZ3JhcGgubWljcm9zb2Z0LmNvbS92MS4wL21lJyxcbn07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIGRpYWxvZywgc2NyZWVuIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZydcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZVxuXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5hdXRod2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgIHRoaXMubXVsdGljYXN0U2VydmVyID0gbnVsbFxuICAgICBcbiAgXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgfVxuXG5cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiAxMjAwLFxuICAgICAgICAgICAgaGVpZ2h0OjkyMCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgLy8gcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAvLyB0cmFuc3BhcmVudDogdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaWYgKGJpcHRlc3QpeyAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vcS5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cbiAgICAgICAgZWxzZSB7ICAgICAgICAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vd3d3LmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5iaXB3aW5kb3cgJiYgIXRoaXMuYmlwd2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJkaWQtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aWxsLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG5cbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJuZXctd2luZG93XCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG4gICAgIFxuICAgICAgICAgXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBsb2cuaW5mbyhcInRhcmdldDogX2JsYW5rXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1yZWRpcmVjdCcsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnUmVkaXJlY3RpbmcgdG86JywgdXJsKTtcbiAgICAgICAgICAgIC8vIFByXHUwMEZDZmVuLCBvYiBkaWUgVVJMIGRhcyBnZXdcdTAwRkNuc2NodGUgRm9ybWF0IGhhdFxuICAgICAgICAgICAgaWYgKHVybC5zdGFydHNXaXRoKCdiaWxkdW5nc3BvcnRhbDovLycpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVydCBkZW4gU3RhbmRhcmQtUmVkaXJlY3RcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSAnYmlsZHVuZ3Nwb3J0YWw6Ly90b2tlbj0nO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9rZW4gPSB1cmwuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdDYXB0dXJlZCBUb2tlbjonKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyh0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JpcFRva2VuJywgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgY3JlYXRlV2luZG93KCkge1xuICAgICAgICBjb25zdCBwcmltYXJ5RGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0geyB3aWR0aDogODAwLCBoZWlnaHQ6IDgwMCB9XG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtLVRlYWNoZXInLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiAnIzJlMmMyOScsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6IHRydWUsXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIG1pbldpZHRoOiAxMjAwLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiA4MDAsXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUlxuICAgICAgICAgICAgICAgICAgICA/IHBhdGgucmVzb2x2ZShjdXJyZW50RGlyLCBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyAocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OIHx8ICcuY2pzJykpKVxuICAgICAgICAgICAgICAgICAgICA6IGpvaW4oX19kaXJuYW1lLCAnLi4vcHJlbG9hZC9wcmVsb2FkLm1qcycpLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBkaWQtZmluaXNoLWxvYWQgLSBzaG93aW5nIHdpbmRvdycpXG4gICAgICAgICAgICBpZiAodGhpcy5tYWlud2luZG93ICYmICF0aGlzLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuc2hvdygpXG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudlsnREVCVUcnXSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKVxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVXaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gcHJvY2Vzcy5lbnYuQVBQX1VSTCB8fCBgaHR0cDovLyR7cHJvY2Vzcy5lbnZbJ1ZJVEVfREVWX1NFUlZFUl9IT1NUJ10gfHwgJ2xvY2FsaG9zdCd9OiR7cHJvY2Vzcy5lbnZbJ1ZJVEVfREVWX1NFUlZFUl9QT1JUJ10gfHwgJzkzMDAnfWBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBMb2FkaW5nIFVSTDogJHt1cmx9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgIFxuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2Vzc2lvbi5zZXRDZXJ0aWZpY2F0ZVZlcmlmeVByb2MoKHJlcXVlc3QsIGNhbGxiYWNrKSA9PiB7XG4gICAgICAgICAgICB2YXIgeyBob3N0bmFtZSwgY2VydGlmaWNhdGUsIHZhbGlkYXRlZENlcnRpZmljYXRlLCB2ZXJpZmljYXRpb25SZXN1bHQsIGVycm9yQ29kZSB9ID0gcmVxdWVzdDtcbiAgICAgICAgICAgIGNhbGxiYWNrKDApO1xuICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgXG4gICAgICAgIC8vIFNob3cgd2luZG93IGV2ZW4gaWYgbG9hZGluZyBmYWlscyAoRWxlY3Ryb24gMzkgY29tcGF0aWJpbGl0eSlcbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUpID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBkaWQtZmFpbC1sb2FkIC0gRXJyb3IgJHtlcnJvckNvZGV9OiAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApXG4gICAgICAgICAgICAvLyBTdGlsbCBzaG93IHRoZSB3aW5kb3cgZXZlbiBpZiBsb2FkaW5nIGZhaWxlZFxuICAgICAgICAgICAgaWYgKHRoaXMubWFpbndpbmRvdyAmJiAhdGhpcy5tYWlud2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVXaW5kb3c6IFNob3dpbmcgd2luZG93IGFmdGVyIGRpZC1mYWlsLWxvYWQnKVxuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLy8gQmxvY2sgbmF2aWdhdGlvbiBvbiBtYWlud2luZG93LndlYkNvbnRlbnRzIHRvIGF2b2lkIGFueSBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgYXBwIGV4Y2VwdCBmb3IgaW50ZXJuYWwgbGlua3NcbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGFwcFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gUHJldmVudCBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7XG5cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy9hc2sgYmVmb3JlIGNsb3NpbmdcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tYWlud2luZG93Py53ZWJDb250ZW50cy5nZXRVUkwoKS5pbmNsdWRlcyhcImRhc2hib2FyZFwiKSkge1xuICAgICAgICAgICAgICAgIC8vIGRvIG5vdCBjbG9zZSBhIHJ1bm5pbmcgZXhhbSBieSBhY2NpZGVudCBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjbG9zZTogZG8gbm90IGNsb3NlIHJ1bm5pbmcgZXhhbSB0aGlzIHdheVwiKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyBcbiAgICAgICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW5mbycsIFxuICAgICAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sIC8vIE51ciBlaW4gQnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRJZDogMCxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdQclx1MDBGQ2Z1bmcgbFx1MDBFNHVmdCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdCZWVuZGVuIFNpZSB6dWVyc3QgZGllIGxhdWZlbmRlIFByXHUwMEZDZnVuZyEnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIE1pY3Jvc29mdCAzNjUgQXV0aCBXaW5kb3cgXG4gICAgICovXG4gICAgY3JlYXRlTXNhdXRoV2luZG93KCkge1xuICAgICAgICBjb25zdCBjdXJyZW50RGlyID0gZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuJywgaW1wb3J0Lm1ldGEudXJsKSlcbiAgICAgICAgdGhpcy5hdXRod2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICBjZW50ZXI6IHRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ09BdXRoJyxcbiAgICAgICAgICAgIHdpZHRoOiA1MDAsXG4gICAgICAgICAgICBoZWlnaHQ6IDgwMCxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUlxuICAgICAgICAgICAgICAgICAgICA/IHBhdGgucmVzb2x2ZShjdXJyZW50RGlyLCBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyAocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OIHx8ICcuY2pzJykpKVxuICAgICAgICAgICAgICAgICAgICA6IGpvaW4oX19kaXJuYW1lLCAnLi4vcHJlbG9hZC9wcmVsb2FkLm1qcycpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBgaHR0cHM6Ly9sb2NhbGhvc3Q6MjI0MjIvc2VydmVyL2NvbnRyb2wvb2F1dGhgXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLmF1dGh3aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRod2luZG93ICYmICF0aGlzLmF1dGh3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgICAgIHRoaXMuYXV0aHdpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICAgICAgdGhpcy5hdXRod2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiAiLCAiXG4vKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdleHByZXNzJ1xuY29uc3Qgcm91dGVyID0gUm91dGVyKClcbmltcG9ydCBwYXRoICBmcm9tICdwYXRoJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi8uLi8uLi9tYWluL2NvbmZpZy5qcydcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgZXh0cmFjdCBmcm9tICdleHRyYWN0LXppcCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7IHQgfSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInXG5pbXBvcnQgeyBQREZEb2N1bWVudCwgcmdiIH0gZnJvbSAncGRmLWxpYi9kaXN0L3BkZi1saWIuanMnICAvLyB3ZSBpbXBvcnQgdGhlIGNvbXBsaWVkIHZlcnNpb24gb3RoZXJ3aXNlIHdlIGdldCAxMDAwIHNvdXJjZW1hcCB3YXJuaW5nc1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuaW1wb3J0IHBkZiBmcm9tICdAYmluZ3Nqcy9wZGYtcGFyc2UnO1xuXG5cbi8qKlxuICogR0VUIGEgRklMRS1MSVNUIGZyb20gd29ya2RpcmVjdG9yeVxuICovIFxuIHJvdXRlci5wb3N0KCcvZ2V0ZmlsZXMvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IGRpciA9cmVxLmJvZHkuZGlyXG4gICAgXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgIFxuICAgIGxldCBmb2xkZXJzID0gW11cbiAgICBmb2xkZXJzLnB1c2goIHtjdXJyZW50ZGlyZWN0b3J5OiBkaXIsIHBhcmVudGRpcmVjdG9yeTogcGF0aC5kaXJuYW1lKGRpcil9KSAvLyBzbyB0aGlzIGluZm9ybWF0aW9uIGlzIGFsd2F5cyBvbiBmaWxlbGlzdFswXSA+PiBub3QgdGhlIG1vc3Qgcm9idXN0IGlkZWEgYnV0IHVzZWQgaW4gZmlsZWV4cGxvcmVyIC0gYmUgY2FyZWZ1bFxuICAgIFxuICAgIGNvbnN0IG9taXRFeHRlbnNpb25zID0gWycuanNvbiddOyAgIC8vIHRoZXNlIGZpbGV0eXBlcyBhcmUgbm90IHBhcnQgb2YgdGhlIGZpbGVsaXN0IHNlbnQgdG8gdGhlIGZyb250ZW5kICh1c2VkIHRvIGRpc3BsYXkgdGhlIHVzZXIgZGlyZWN0b3JpZXMgaW4gdGhlIGZpbGVleHBsb3JlciBwYXJ0IG9mIHRoZSBkYXNoYm9hcmQpXG4gICAgXG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIoZGlyKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcGF0aCA9IHBhdGguam9pbihkaXIsIGZpbGUpO1xuICAgICAgICAgICAgbGV0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMucHJvbWlzZXMuc3RhdChmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9sZGVycy5wdXNoKHsgcGF0aDogZmlsZXBhdGgsIG5hbWU6IGZpbGUsIHR5cGU6IFwiZGlyXCIsIGV4dDogXCJcIiwgcGFyZW50OiBkaXIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHN0YXRzLmlzRmlsZSgpICYmICFvbWl0RXh0ZW5zaW9ucy5pbmNsdWRlcyhleHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvbGRlcnMucHVzaCh7IHBhdGg6IGZpbGVwYXRoLCBuYW1lOiBmaWxlLCB0eXBlOiBcImZpbGVcIiwgZXh0OiBleHQsIHBhcmVudDogZGlyIH0pOyAvLyBLb3JyaWdpZXJ0IGBwYXJlbnQ6ICcnYCB6dSBgcGFyZW50OiBkaXJgIGZcdTAwRkNyIEtvbnNpc3RlbnpcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChpbm5lckVycikge1xuICAgICAgICAgICAgICAgIC8vIEJlaGFuZGVsbiBTaWUgRmVobGVyLCBkaWUgdm9uIGZzLnByb21pc2VzLnN0YXQgZ2V3b3JmZW4gd2VyZGVuXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcImRhdGEgQCBnZXRmaWxlczogRmVobGVyIGJlaW0gWnVncmlmZiBhdWYgRGF0ZWkgb2RlciBWZXJ6ZWljaG5pczogXCIsIGlubmVyRXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBCZWhhbmRlbG4gU2llIEZlaGxlciwgZGllIHZvbiBmcy5wcm9taXNlcy5yZWFkZGlyIGdld29yZmVuIHdlcmRlblxuICAgICAgICBjb25zb2xlLmVycm9yKFwiZGF0YSBAIGdldGZpbGVzOiBGZWhsZXIgYmVpbSBMZXNlbiBkZXMgVmVyemVpY2huaXNzZXM6IFwiLCBlcnIpO1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogdChcImRhdGEuZmlsZWVycm9yXCIpIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzLnNlbmQoIGZvbGRlcnMgKVxufSlcblxuXG5cblxuXG4vKipcbiAqIENSRUFURSBDT01CSU5FRCBQREYgU1RBUlQgPj4+Pj4+Pj4+Pj4+Pj4+Pj4+XG4gKi9cblxuXG5cbi8qKlxuICogR0VUIGEgbGF0ZXN0IHdvcmsgZnJvbSBhbGwgc3R1ZGVudHNcbiAqIFRoaXMgQVBJIFJvdXRlIGNyZWF0ZXMgYSBsaXN0IG9mIHRoZSBsYXRlc3QgcGRmIGZpbGVwYXRocyBvZiBhbGwgY29ubmVjdGVkIHN0dWRlbnRzXG4gKiBhbmQgY29uY2F0cyBlYWNoIG9mIHRoZSBwZGZzIHRvIG9uZVxuICovIFxuIHJvdXRlci5wb3N0KCcvZ2V0bGF0ZXN0LzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBzdWJtaXNzaW9ucyA9IHJlcS5ib2R5LnN1Ym1pc3Npb25zXG4gICAgbGV0IHdhcm5pbmcgPSBmYWxzZVxuXG4gICAgLy8gY2hlY2sgaWYgdGhpcyBpcyBhIGxlZ2l0IGNhbGwgZnJvbSB0aGUgdGVhY2hlciBmcm9udGVuZFxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG5cblxuICAgICAgIFxuXG4gICAgLy9jcmVhdGUgYXJyYXkgdGhhdCBjb250YWlucyBvbmx5IGZpbGVwYXRoc1xuICAgIC8vIHdlIGl0ZXJhdGUgb3ZlciB0aGUgc3VibWlzc2lvbnMgYXJyYXkgYW5kIGdldCB0aGUgbGF0ZXN0IGZpbGVwYXRocyBmb3IgZWFjaCBzZWN0aW9uXG4gICAgbGV0IGxhdGVzdEZpbGVzID0gW11cbiAgICBmb3IgKGxldCBzdHVkZW50IG9mIHN1Ym1pc3Npb25zKSB7XG4gICAgICAgIGZvciAobGV0IHNlY3Rpb24gPSAxOyBzZWN0aW9uIDw9IDQ7IHNlY3Rpb24rKykge1xuICAgICAgICAgICAgaWYgKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aCl7XG4gICAgICAgICAgICAgICAgbGF0ZXN0RmlsZXMucHVzaChzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2coXCJkYXRhIEAgZ2V0bGF0ZXN0OiBsYXRlc3RGaWxlc1wiLCBsYXRlc3RGaWxlcylcblxuICAgIC8vIG5vdyBjcmVhdGUgb25lIG1lcmdlZCBwZGYgb3V0IG9mIGFsbCBmaWxlc1xuICAgIGlmIChsYXRlc3RGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHt3YXJuaW5nOiB3YXJuaW5nLCBwZGZCdWZmZXI6IG51bGx9KVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbGV0IGluZGV4UERGZGF0YSA9IGF3YWl0IGNyZWF0ZUluZGV4UERGKHN1Ym1pc3Npb25zLCBzZXJ2ZXJuYW1lKSAgIC8vY29udGFpbnMgdGhlIGluZGV4IHRhYmxlIHBkZiBhcyB1aW50OGFycmF5XG4gICAgICAgIGxldCBpbmRleFBERnBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSxcImluZGV4LnBkZlwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGluZGV4UERGcGF0aCwgaW5kZXhQREZkYXRhKTtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdkYXRhIEAgZ2V0bGF0ZXN0OiBJbmRleCBQREYgc2F2ZWQgc3VjY2Vzc2Z1bGx5IScpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7bG9nLmVycm9yKFwiZGF0YSBAIGdldGxhdGVzdDpcIixlcnIpfVxuICAgICAgICBsYXRlc3RGaWxlcy51bnNoaWZ0KGluZGV4UERGcGF0aClcblxuXG4gICAgICAgIC8vIG5vdyBjb25jYXQgdGhlIHBkZnMgb2YgYWxsIHNlY3Rpb25zIHRvIG9uZSBjb21iaW5lZCBwZGZcbiAgICAgICAgbGV0IFBERiA9IGF3YWl0IGNvbmNhdFBhZ2VzKGxhdGVzdEZpbGVzKVxuICAgICAgICBsZXQgcGRmQnVmZmVyID0gQnVmZmVyLmZyb20oUERGKSBcbiAgICAgICAgbGV0IHBkZlBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSxcImNvbWJpbmVkLnBkZlwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKHBkZlBhdGgsIHBkZkJ1ZmZlcik7XG4gICAgICAgICAgICBsb2cuaW5mbygnZGF0YSBAIGdldGxhdGVzdDogUERGIHNhdmVkIHN1Y2Nlc3NmdWxseSEnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe2xvZy5lcnJvcihcImRhdGEgQCBnZXRsYXRlc3Q6XCIsZXJyKX1cbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHt3YXJuaW5nOiB3YXJuaW5nLCBwZGZCdWZmZXI6cGRmQnVmZmVyLCBwZGZQYXRoOnBkZlBhdGggfSk7XG4gICAgfVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuZnVuY3Rpb24gaXNWYWxpZFBkZihkYXRhKSB7XG4gICAgY29uc3QgaGVhZGVyID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSwgMCwgNSk7IC8vIExlc2UgZGllIGVyc3RlbiA1IEJ5dGVzIGZcdTAwRkNyIFwiJVBERi1cIlxuICAgIC8vIFVtd2FuZGx1bmcgZGVyIEJ5dGVzIGluIEhleGFkZXppbWFsd2VydGUgZlx1MDBGQ3IgZGVuIFZlcmdsZWljaFxuICAgIGNvbnN0IHBkZkhlYWRlciA9IFsweDI1LCAweDUwLCAweDQ0LCAweDQ2LCAweDJEXTsgLy8gXCIlUERGLVwiIGluIEhleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGRmSGVhZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChoZWFkZXJbaV0gIT09IHBkZkhlYWRlcltpXSkge1xuICAgICAgICAgICAgbG9nLndhcm4oJ2RhdGEgQCBpc1ZhbGlkUGRmOiBpbnZhbGlkIFBERiBwcm9jZXNzZWQnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBGclx1MDBGQ2hlciBBYmJydWNoLCB3ZW5uIGVpbiBCeXRlIG5pY2h0IFx1MDBGQ2JlcmVpbnN0aW1tdFxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlOyAvLyBBbGxlIEJ5dGVzIHN0aW1tZW4gbWl0IGRlbSBQREYtSGVhZGVyIFx1MDBGQ2JlcmVpblxufVxuXG5hc3luYyBmdW5jdGlvbiBjb3VudENoYXJzT2ZQREYocGRmUGF0aCwgc3R1ZGVudG5hbWUsIHNlcnZlcm5hbWUpe1xuICAgIGNvbnN0IGRhdGFCdWZmZXIgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShwZGZQYXRoKTsvLyBSZWFkIHRoZSBQREYgZmlsZVxuICAgIGxldCBjaGFycyA9IDAgXG5cbiAgICBpZiAoaXNWYWxpZFBkZihkYXRhQnVmZmVyKSl7XG4gICAgICAgIGNoYXJzID0gYXdhaXQgcGRmKGRhdGFCdWZmZXIpLnRoZW4oIGRhdGEgPT4geyAgICAvLyBQYXJzZSB0aGUgUERGICAvLyBkYXRhLnRleHQgY29udGFpbnMgYWxsIHRoZSB0ZXh0IGV4dHJhY3RlZCBmcm9tIHRoZSBQREZcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEudGV4dCAmJiBzdHVkZW50bmFtZSkgeyAgIFxuICAgICAgICAgICAgICAgIGxldCBudW1iZXJPZkNoYXJhY3RlcnMgPSBkYXRhLnRleHQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coYE51bWJlciBvZiBjaGFyYWN0ZXJzIGluIHRoZSBQREY6ICR7bnVtYmVyT2ZDaGFyYWN0ZXJzfWAsIHN0dWRlbnRuYW1lLCBzZXJ2ZXJuYW1lKTtcblxuICAgICAgICAgICAgICAgIGxldCBoZWFkZXIgPSBgICR7c2VydmVybmFtZX0gfCAxMC4xMC4yNCwgMTA6MTAgYFxuICAgICAgICAgICAgICAgIGxldCBmb290ZXIgPSBgIFplaWNoZW46IDEwIHwgV1x1MDBGNnJ0ZXI6IDEwICAxLzEgYCAgIC8vYXBwcm94aW1hdGVseVxuXG4gICAgICAgICAgICAgICAgbnVtYmVyT2ZDaGFyYWN0ZXJzID0gbnVtYmVyT2ZDaGFyYWN0ZXJzIC8vIC0gaGVhZGVyLmxlbmd0aCAtIHN0dWRlbnRuYW1lLmxlbmd0aCAtIGZvb3Rlci5sZW5ndGggLy8gLTUgZm9yIGF2ZXJhZ2UgbmFtZSBsZW5ndGggIC8vIGZcdTAwRkNyIG1zd29yZCBvcHRpb24gLSBoaWVyIGdpYnRzIGtlaW5lbiBoZWFkZXJcblxuXG4gICAgICAgICAgICAgICAgLy93ZSB0cnkgdG8gZmlsdGVyIG91dCB0aGUgaW1wb3J0YW50IHBhcnQgb2YgdGhlIGRvY3VtZW50IHRoYXQgc2hvd3MgdGhlIGFjdHVhbCBudW1iZXIgb2YgY2hhcnNcbiAgICAgICAgICAgICAgICBsZXQgcmVnZXggPSAvWmVpY2hlbjogKFxcZCspLztcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2hlcyA9IGRhdGEudGV4dC5tYXRjaChyZWdleCk7XG4gICAgICAgICAgICAgICAgbGV0IHplaWNoZW5BbnphaGwgPSBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6IFwibm90Zm91bmRcIjtcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh6ZWljaGVuQW56YWhsICE9PSBcIm5vdGZvdW5kXCIpeyAgIC8vd2UgZm91bmQgaXQgIVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gemVpY2hlbkFuemFobFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVnZXggPSAvWmVpY2hlbjooXFxkKykvOyAgLy90cnkgc2xpZ2h0bHkgZGlmZmVyZW50IHJlZ2V4IGJlY2F1c2Ugc29tZSBwZGZzIChwcm9iYWJseSBmcm9tIG1hYykgcmVtb3ZlIHNwYWNlcyB3aGVuIHJlYWRcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyA9IGRhdGEudGV4dC5tYXRjaChyZWdleCk7XG4gICAgICAgICAgICAgICAgICAgIHplaWNoZW5BbnphaGwgPSBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6IFwibm90Zm91bmRcIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHplaWNoZW5BbnphaGwgIT09IFwibm90Zm91bmRcIil7ICAvLyBub3cgd2UgZm91bmQgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZWljaGVuQW56YWhsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhLnRleHQpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVtYmVyT2ZDaGFyYWN0ZXJzID49IDAgPyBgfiAke251bWJlck9mQ2hhcmFjdGVyc31gIDogJ34gMCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMFxuICAgICAgICAgICAgfVxuICAgIFxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtsb2cuZXJyb3IoYGRhdGEgQCBjb3VudENoYXJzT2ZQREY6ICR7ZXJyfWApOyByZXR1cm4gMCAgfSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjaGFycyA9IFwibm8gcGRmXCJcbiAgICB9XG4gXG4gICAgcmV0dXJuIGNoYXJzIFxufVxuXG5cblxuXG5cblxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVJbmRleFBERihzdWJtaXNzaW9ucywgc2VydmVybmFtZSl7XG4gICAgbGV0IHRhYmxlZGF0YSA9IFtbXCJOYW1lXCIsIFwiQWJzY2huaXR0XCIsIFwiRGF0dW1cIiwgXCJaZWljaGVuXCIsIFwiRGF0ZWluYW1lXCJdXVxuICAgIGZvciAoY29uc3Qgc3R1ZGVudCBvZiBzdWJtaXNzaW9ucyl7XG4gICAgICAgIGxldCBoYXNTdWJtaXNzaW9uID0gZmFsc2UgLy8gdHJhY2sgaWYgc3R1ZGVudCBoYXMgYXQgbGVhc3Qgb25lIHN1Ym1pc3Npb25cbiAgICAgICAgY29uc3QgdHJpbW1lZE5hbWUgPSBzdHVkZW50LnN0dWRlbnROYW1lLmxlbmd0aCA+IDIwID8gc3R1ZGVudC5zdHVkZW50TmFtZS5zbGljZSgwLCAyMCkgKyBcIi4uLlwiIDogc3R1ZGVudC5zdHVkZW50TmFtZVxuICAgICAgICBmb3IgKGxldCBzZWN0aW9uID0gMTsgc2VjdGlvbiA8PSA0OyBzZWN0aW9uKyspIHtcbiAgICAgICAgICAgIGxldCBuYW1lID0gXCItXCJcbiAgICAgICAgICAgIGxldCBzZWN0aW9uTmFtZSA9IFwiLVwiXG4gICAgICAgICAgICBsZXQgdGltZSA9IFwiLVwiXG4gICAgICAgICAgICBsZXQgY2hhcnMgPSBcIjBcIlxuICAgICAgICAgICAgbGV0IGZpbGVuYW1lID0gXCItXCJcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aCl7XG4gICAgICAgICAgICAgICAgbmFtZSA9IHRyaW1tZWROYW1lO1xuICAgICAgICAgICAgICAgIHNlY3Rpb25OYW1lID0gc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5zZWN0aW9ubmFtZSB8fCBgQWJzY2huaXR0ICR7c2VjdGlvbn1gXG4gICAgICAgICAgICAgICAgc2VjdGlvbk5hbWUgPSBzZWN0aW9uTmFtZS5sZW5ndGggPiAyMCA/IHNlY3Rpb25OYW1lLnNsaWNlKDAsIDIwKSArIFwiLi4uXCIgOiBzZWN0aW9uTmFtZTtcbiAgICAgICAgICAgICAgICB0aW1lID0gbW9tZW50KHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uZGF0ZSkuZm9ybWF0KCdERC5NTS5ZWVlZIEhIOm1tJylcbiAgICAgICAgICAgICAgICBjaGFycyA9IGF3YWl0IGNvdW50Q2hhcnNPZlBERihzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgsIHN0dWRlbnQuc3R1ZGVudE5hbWUsIHNlcnZlcm5hbWUpXG4gICAgICAgICAgICAgICAgZmlsZW5hbWUgPSBzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLmZpbGVuYW1lLmxlbmd0aCA+IDI1ID8gc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5maWxlbmFtZS5zbGljZSgwLCAyNSkgKyBcIi4uLlwiIDogc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5maWxlbmFtZSA7XG4gICAgICAgICAgICAgICAgdGFibGVkYXRhLnB1c2goWyBuYW1lLCBzZWN0aW9uTmFtZSwgdGltZSwgY2hhcnMsIGZpbGVuYW1lIF0pXG4gICAgICAgICAgICAgICAgaGFzU3VibWlzc2lvbiA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWhhc1N1Ym1pc3Npb24pIHtcbiAgICAgICAgICAgIHRhYmxlZGF0YS5wdXNoKFsgdHJpbW1lZE5hbWUsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIgXSlcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBwZGZEb2MgPSBhd2FpdCBQREZEb2N1bWVudC5jcmVhdGUoKTsvLyBDcmVhdGUgYSBuZXcgUERGRG9jdW1lbnRcbiAgICBjb25zdCBwYWdlID0gcGRmRG9jLmFkZFBhZ2UoKTsgLy8gQWRkIGEgcGFnZSB0byB0aGUgZG9jdW1lbnRcblxuICAgIC8vIFNldCB1cCB0YWJsZSBkaW1lbnNpb25zIGFuZCBzdHlsZXNcbiAgICBjb25zdCBzdGFydFggPSA1MDsgLy8gWC1jb29yZGluYXRlIHdoZXJlIHRoZSB0YWJsZSBzdGFydHNcbiAgICBjb25zdCBzdGFydFkgPSBwYWdlLmdldEhlaWdodCgpIC0gNTA7IC8vIFktY29vcmRpbmF0ZSB3aGVyZSB0aGUgdGFibGUgc3RhcnRzIChmcm9tIHRvcClcbiAgICBjb25zdCByb3dIZWlnaHQgPSAxNTsgLy8gSGVpZ2h0IG9mIGVhY2ggcm93IChyZWR1Y2VkIGZvciBzbWFsbGVyIGZvbnQgc2l6ZSlcbiAgICBjb25zdCBjb2x1bW5XaWR0aHMgPSBbMTEwLCAxMzAsIDgwLCA0MCwgMTQwXTsgLy8gV2lkdGggb2YgZWFjaCBjb2x1bW46IE5hbWUsIEFic2Nobml0dCwgRGF0dW0sIFplaWNoZW4sIERhdGVpbmFtZVxuXG4gICAgLy8gRnVuY3Rpb24gdG8gZHJhdyBhIGNlbGxcbiAgICBjb25zdCBkcmF3Q2VsbCA9ICh4LCB5LCB3aWR0aCwgaGVpZ2h0KSA9PiB7IHBhZ2UuZHJhd1JlY3RhbmdsZSh7IHgsIHksIHdpZHRoLCBoZWlnaHQsIGJvcmRlckNvbG9yOiByZ2IoMCwgMCwgMCksICBib3JkZXJXaWR0aDogMSwgIH0pOyAgfTtcbiAgICAvLyBGdW5jdGlvbiB0byBhZGQgdGV4dCB0byBhIGNlbGxcbiAgICBjb25zdCBhZGRUZXh0ID0gKHRleHQsIHgsIHkpID0+IHsgIHRleHQgPSBTdHJpbmcodGV4dCk7ICAgIHBhZ2UuZHJhd1RleHQodGV4dCwgeyB4LCB5LCBzaXplOiA5LCBjb2xvcjogcmdiKDAsIDAsIDApLCAgfSk7ICB9O1xuXG4gICAgdGFibGVkYXRhLmZvckVhY2goKHJvdywgcm93SW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgeVBvcyA9IHN0YXJ0WSAtIHJvd0luZGV4ICogcm93SGVpZ2h0OyAvLyBDYWxjdWxhdGUgWSBwb3NpdGlvbiBmb3IgdGhlIGN1cnJlbnQgcm93XG4gICAgICAgIHJvdy5mb3JFYWNoKChjZWxsVGV4dCwgY29sdW1uSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHhQb3MgPSBzdGFydFggKyBjb2x1bW5XaWR0aHMuc2xpY2UoMCwgY29sdW1uSW5kZXgpLnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyArIHZhbCwgMCk7IC8vIENhbGN1bGF0ZSBYIHBvc2l0aW9uIGZvciB0aGUgY3VycmVudCBjZWxsXG4gICAgICAgICAgICBkcmF3Q2VsbCh4UG9zLCB5UG9zIC0gcm93SGVpZ2h0LCBjb2x1bW5XaWR0aHNbY29sdW1uSW5kZXhdLCByb3dIZWlnaHQpO1xuICAgICAgICAgICAgYWRkVGV4dChjZWxsVGV4dCwgeFBvcyArIDMsIHlQb3MgLSByb3dIZWlnaHQgKyA0KTsgLy8gQWRqdXN0IHRleHQgcG9zaXRpb24gd2l0aGluIHRoZSBjZWxsIChyZWR1Y2VkIHBhZGRpbmcgZm9yIHNtYWxsZXIgcm93IGhlaWdodClcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgLy8gU2VyaWFsaXplIHRoZSBQREZEb2N1bWVudCB0byBieXRlcyAoYSBVaW50OEFycmF5KVxuICAgIGNvbnN0IHBkZkJ5dGVzID0gYXdhaXQgcGRmRG9jLnNhdmUoKTtcbiAgICByZXR1cm4gcGRmQnl0ZXMgXG59XG5cblxuLyoqXG4gKiBDUkVBVEUgQ09NQklORUQgUERGIEVORCA+Pj4+Pj4+Pj4+Pj4+Pj4+Pj5cbiAqL1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbmFzeW5jIGZ1bmN0aW9uIGNvbmNhdFBhZ2VzKHBkZnNUb01lcmdlKSB7XG4gICAgLy8gQ3JlYXRlIGEgbmV3IFBERkRvY3VtZW50XG4gICAgY29uc3QgdGVtcFBERiA9IGF3YWl0IFBERkRvY3VtZW50LmNyZWF0ZSgpO1xuICAgIGZvciAoY29uc3QgcGRmcGF0aCBvZiBwZGZzVG9NZXJnZSkgeyBcbiAgICAgICAgbGV0IHBkZkJ5dGVzID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUocGRmcGF0aCk7XG4gICAgICAgIC8vY2hlY2sgaWYgdGhpcyBhY3R1YWxseSBpcyBhIHBkZlxuICAgICAgICBpZiAoaXNWYWxpZFBkZihwZGZCeXRlcykpe1xuICAgICAgICAgICAgY29uc3QgcGRmID0gYXdhaXQgUERGRG9jdW1lbnQubG9hZChwZGZCeXRlcyk7IFxuICAgICAgICAgICAgY29uc3QgY29waWVkUGFnZXMgPSBhd2FpdCB0ZW1wUERGLmNvcHlQYWdlcyhwZGYsIHBkZi5nZXRQYWdlSW5kaWNlcygpKTtcbiAgICAgICAgICAgIGNvcGllZFBhZ2VzLmZvckVhY2goKHBhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICB0ZW1wUERGLmFkZFBhZ2UocGFnZSk7IFxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9XG4gICAgICAgXG4gICAgfSBcbiAgICAvLyBTZXJpYWxpemUgdGhlIFBERkRvY3VtZW50IHRvIGJ5dGVzIChhIFVpbnQ4QXJyYXkpXG4gICAgY29uc3QgZmluYWxQREYgPSBhd2FpdCB0ZW1wUERGLnNhdmUoKVxuICAgIHJldHVybiBmaW5hbFBERlxufVxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogREVMRVRFIEZpbGUgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICovIFxuIHJvdXRlci5wb3N0KCcvZGVsZXRlLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuXG4gIFxuICAgIGNvbnN0IGZpbGVwYXRoID0gcmVxLmJvZHkuZmlsZXBhdGhcbiAgICBpZiAoZmlsZXBhdGgpIHsgLy9yZXR1cm4gc3BlY2lmaWMgZmlsZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKXtcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ybShmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGZpbGVwYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmRlbGV0ZWRcIiksICB9KVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCBkZWxldGU6XCIsIGVycik7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IHN0YXR1czpcImVycm9yXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlZXJyb3JcIikgfSlcbiAgICAgICAgfVxuICAgIH1cbn0pXG5cblxuXG5cblxuLyoqXG4gKiBHRVQgUERGIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAqLyBcblxucm91dGVyLnBvc3QoJy9nZXRwZGYvOnNlcnZlcm5hbWUvOnRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgeyB0b2tlbiwgc2VydmVybmFtZSB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXTtcblxuICAgIC8vIFByXHUwMEZDZmVuLCBvYiBtY1NlcnZlciBleGlzdGllcnQgdW5kIGRlciBUb2tlbiBcdTAwRkNiZXJlaW5zdGltbXRcbiAgICBpZiAoIW1jU2VydmVyIHx8IHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvPy5zZXJ2ZXJ0b2tlbikge1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBmaWxlbmFtZSB9ID0gcmVxLmJvZHk7XG4gICAgaWYgKGZpbGVuYW1lKSB7XG4gICAgICAgIHJlcy5zZW5kRmlsZShmaWxlbmFtZSwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS5maWxlZXJyb3JcIikgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFudHdvcnQsIGZhbGxzIGtlaW4gRGF0ZWluYW1lIGFuZ2VnZWJlbiB3dXJkZVxuICAgICAgICByZXMuc3RhdHVzKDQwMCkuanNvbih7IHN0YXR1czogdChcImRhdGEuZmlsZWVycm9yXCIpIH0pO1xuICAgIH1cbn0pO1xuXG5cblxuXG5cblxuLyoqXG4gKiBHRVQgQU5ZIEZpbGUvRm9sZGVyIGZyb20gRVhBTSBkaXJlY3RvcnkgLSBkb3dubG9hZCAhXG4gKiBDYW4gYmUgdHJpZ2dlcmVkIGJ5IFRFQUNIRVIgKGRhc2hib2FyZCBleHBsb3Jlcikgb3IgU1RVREVOVCAoZmlsZXJlcXVlc3QpXG4gKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gKi8gXG4gcm91dGVyLnBvc3QoJy9kb3dubG9hZC86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgdHlwZSA9IHJlcS5ib2R5LnR5cGUgIC8vIGZpbGUsIGRpciwgc3R1ZGVudGZpbGVyZXF1ZXN0XG4gICAgY29uc3QgZmlsZW5hbWUgPSByZXEuYm9keS5maWxlbmFtZVxuICAgIGNvbnN0IGZpbGVwYXRoID0gcmVxLmJvZHkucGF0aFxuICAgIGNvbnN0IGZpbGVzID0gcmVxLmJvZHkuZmlsZXMgIC8vIGluIGNhc2Ugb2Ygc3R1ZGVudGZpbGVyZXF1ZXN0ICdmaWxlcycgaXMgYW4gYXJyYXkgb2YgZmlsZW9iamVjdHMgWyB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0sIHtuYW1lOmZpbGUubmFtZSwgcGF0aDpmaWxlLnBhdGggfSBdIFxuXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiAmJiAhY2hlY2tUb2tlbih0b2tlbiwgbWNTZXJ2ZXIgKSkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgXG5cbiAgIFxuICAgIGlmICh0eXBlID09PSBcInN0dWRlbnRmaWxlcmVxdWVzdFwiKSB7XG4gICAgICAgIC8vIGlmIHRoaXMgcmVxdWVzdCBjYW1lIGZyb20gYSBzdHVkZW50IHJlc2V0IHN0dWRlbnRzdGF0dXNcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gdG9rZW4pIC8vIGdldCBzdHVkZW50IGZyb20gdG9rZW5cbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXSA9IGZhbHNlICAvL3Jlc2V0IGZpbGVyZXF1ZXN0IHN0YXR1cyBmb3Igc3R1ZGVudCAvLyBpdCBpcyB0aGVvcmV0aWNhbGx5IHBvc3NpYmxlIHRoYXQgdGhlIGNsaWVudCBzZW5kcyBhIHNlY29uZCBmaWxlIHJlcXVlc3QgYW5kIGZldGNoZXMgdGhlIGZpbGUgdHdpY2UgYmVmb3JlIHRoaXMgc2V0dGluZyBpcyByZXNldCBidXQgaSBndWVzcyB0aGlzIGRvZW4ndCByZWFsbHkgbWF0dGVyXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9IFtdICAgICAgICAgIC8vIHRoZXJlciBpcyBubyBjb250cm9sIHN5c3RlbSBpbiBwbGFjZSB0byByZS1jaGVjayBpZiB0aGUgZmlsZSB3YXMgYWN0dWFsbHkgcmVjZWl2ZWRcbiAgICAgICAgICAgIHJlcy56aXAoe2ZpbGVzOiBmaWxlc30pOyAgXG4gICAgICAgIH0gXG4gICAgfSAgXG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJmaWxlXCIpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtZGlzcG9zaXRpb24nLCAnYXR0YWNobWVudDsgZmlsZW5hbWU9JyArIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHJlcy5kb3dubG9hZChmaWxlcGF0aCk7ICBcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJkaXJcIikge1xuICAgICAgICAvL3ppcCBmb2xkZXIgYW5kIHRoZW4gc2VuZFxuICAgICAgICBsZXQgemlwZmlsZW5hbWUgPSBmaWxlbmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgICAgYXdhaXQgemlwRGlyZWN0b3J5KGZpbGVwYXRoLCB6aXBmaWxlcGF0aClcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsICdhdHRhY2htZW50OyBmaWxlbmFtZT0nICsgZmlsZW5hbWUpO1xuICAgICAgICByZXMuZG93bmxvYWQoemlwZmlsZXBhdGgsZmlsZW5hbWUpOyBcbiAgICB9XG4gXG59KVxuXG5cblxuXG5cbnJvdXRlci5wb3N0KCcvZ2V0ZXhhbW1hdGVyaWFscy86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgZ3JvdXAgPSByZXEuYm9keS5ncm91cFxuXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiAmJiAhY2hlY2tUb2tlbih0b2tlbiwgbWNTZXJ2ZXIgKSkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgXG5cbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSB0b2tlbikgLy8gZ2V0IHN0dWRlbnQgZnJvbSB0b2tlblxuICAgIGlmIChzdHVkZW50KSB7ICBcblxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzXG4gICAgICAgIGxldCBleGFtU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dXG4gICAgICAgIGxldCBncm91cEEgPSBleGFtU2VjdGlvbi5ncm91cEFcbiAgICAgICAgbGV0IGdyb3VwQiA9IGV4YW1TZWN0aW9uLmdyb3VwQlxuICAgIFxuICAgICAgICBsZXQgbWF0ZXJpYWxzID0gW11cbiAgICAgICAgbGV0IGFsbG93ZWRVcmxzID0gW11cbiAgICAgICAgaWYgKGdyb3VwID09PSBcImFcIikge1xuICAgICAgICAgICAgbWF0ZXJpYWxzID0gZ3JvdXBBLmV4YW1JbnN0cnVjdGlvbkZpbGVzXG4gICAgICAgICAgICBhbGxvd2VkVXJscyA9IGdyb3VwQS5hbGxvd2VkVXJsc1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGdyb3VwID09PSBcImJcIikge1xuICAgICAgICAgICAgbWF0ZXJpYWxzID0gZ3JvdXBCLmV4YW1JbnN0cnVjdGlvbkZpbGVzXG4gICAgICAgICAgICBhbGxvd2VkVXJscyA9IGdyb3VwQi5hbGxvd2VkVXJsc1xuICAgICAgICB9XG5cblxuICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtYXRlcmlhbHM6IG1hdGVyaWFscywgYWxsb3dlZFVybHM6IGFsbG93ZWRVcmxzICB9KVxuICAgIH0gXG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgIH0pXG4gICAgfVxuICAgIFxuXG4gXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIFN0b3JlcyBmaWxlKHMpIHRvIHRoZSB3b3JrZGlyZWN0b3J5IChmaWxlcyBjb21pbmcgRlJPTSBDTElFTlRTIChCQUNLVVBTKSApXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiAtIHRoaXMgaGFzIHRvIGJlIHZhbGlkIChjb21pbmcgZnJvbSBhIHJlZ2lzdGVyZWQgdXNlcikgXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgc2VydmVyLWV4YW0gaW5zdGFuY2UgdGhlIHN0dWRlbnRzIHRva2VuIGJlbG9uZ3MgdG9cbiAqIGluIG9yZGVyIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgLSBETyBOT1QgU1RPUkUgRklMRVMgQ09NSU5HIGZyb20gYW55d2hlcmUuLiBhbHdheXMgY2hlY2sgaWYgdG9rZW4gYmVsb25ncyB0byBhIHJlZ2lzdGVyZWQgc3R1ZGVudCAob3Igc2VydmVyKVxuICovXG4gcm91dGVyLnBvc3QoJy9yZWNlaXZlLzpzZXJ2ZXJuYW1lLzpzdHVkZW50dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHsgIFxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IHsgZmlsZSwgZmlsZW5hbWUgfSA9IHJlcS5ib2R5O1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gQnVmZmVyLmZyb20oZmlsZSwgJ2Jhc2U2NCcpO1xuXG4gICAgaWYgKCAhY2hlY2tUb2tlbihzdHVkZW50dG9rZW4sIG1jU2VydmVyICkgKSB7IHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbGV0IGVycm9ycyA9IDBcbiAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgICAgbGV0IHRpbWUgPSBub3cudG9Mb2NhbGVUaW1lU3RyaW5nKCdkZS1ERScpOyAgLy9jb252ZXJ0IHRvIGxvY2FsZSBzdHJpbmcgb3RoZXJ3aXNlIHRoZSBmb2xkZXJuYW1lcyB3aWxsIGJlIGNyZWF0ZWQgaW4gVVRDXG4gICAgICAgIGxldCB0aW1lc3RyaW5nID0gU3RyaW5nKHRpbWUpLnJlcGxhY2UoLzovZywgXCJfXCIpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgeWVhciA9IG5vdy5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCBtb250aCA9IFN0cmluZyhub3cuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyk7IC8vIE1vbmF0ZTogMC0xMSwgZGFoZXIgKzFcbiAgICAgICAgY29uc3QgZGF5ID0gU3RyaW5nKG5vdy5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgICAgIGNvbnN0IGRhdGVTdHJpbmcgPSBgJHt5ZWFyfSR7bW9udGh9JHtkYXl9YDtcbiAgICAgICAgXG4gICAgICAgIGxldCB0c3RyaW5nID0gYCR7ZGF0ZVN0cmluZ31fJHt0aW1lc3RyaW5nfWA7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pIC8vIGdldCBzdHVkZW50IGZyb20gdG9rZW5cbiAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCBmaWxlbmFtZSk7XG4gICAgICAgIGxldCBzdHVkZW50ZGlyZWN0b3J5ID0gIHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUpXG4gICAgICAgIFxuICAgICAgICBsZXQgc3R1ZGVudGFyY2hpdmVkaXIgPSBwYXRoLmpvaW4oc3R1ZGVudGRpcmVjdG9yeSwgdHN0cmluZylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHN0dWRlbnRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3R1ZGVudGFyY2hpdmVkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCByZWNlaXZlOiBcIiwgZXJyKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGUpe1xuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuaW5jbHVkZXMoXCIuemlwXCIpKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImRhdGEgQCByZWNlaXZlOiBSZWNlaXZlZCBaSVAgRmlsZSBmcm9tIHVzZXI6XCIsIHN0dWRlbnQuY2xpZW50bmFtZSlcbiAgICAgICAgICAgICAgICBsZXQgc3VjY2VzcyA9IGF3YWl0IGFyY2hpdmVBbmRFeHRyYWN0WmlwKGFic29sdXRlRmlsZXBhdGgsIHN0dWRlbnRhcmNoaXZlZGlyLCBmaWxlQ29udGVudClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmJhY2t1cGRpcmVjdG9yeSAmJiBzdWNjZXNzKXsgICAgIC8vIGNvcHkgdG8gYmFja3VwIGRpcmVjdG9yeSAtIGRvIG5vdCB1bnppcCBhIHNlY29uZCB0aW1lIC0gdGhpcyBpcyBhbHJlYWR5IGRvbmUgaW4gYXJjaGl2ZUFuZEV4dHJhY3RaaXBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBiYWNrdXBkaXIgPSAgcGF0aC5qb2luKGNvbmZpZy5iYWNrdXBkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCB0c3RyaW5nKSAvLyBzYW1lIGNvbmNlcHQgYXMgaW4gc3R1ZGVudGFyY2hpdmVkaXJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBDb3B5aW5nIHRvIGJhY2t1cCBkaXJlY3Rvcnk6ICR7c3R1ZGVudGFyY2hpdmVkaXJ9IC0+ICAgJHtiYWNrdXBkaXJ9IGApXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihiYWNrdXBkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMuY3Aoc3R1ZGVudGFyY2hpdmVkaXIsIGJhY2t1cGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZTogXCIsIGVycilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVyZWNlaXZlZFwiKSwgZXJyb3JzOiBlcnJvcnMgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZTogTm8gWklQIGZpbGUgcmVjZWl2ZWRcIilcbiAgICAgICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIiksIGVycm9yczogZXJyb3JzIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIiksIGVycm9yczogZXJyb3JzIH0pXG4gICAgICAgIH1cbiAgICB9XG59KVxuXG5cbi8qKlxuICogVVBMT0FEUyBGaWxlcyBmcm9tIHRoZSBUZWFjaGVyIEZyb250ZW5kIGFuZCBcbiAqIHN0b3JlcyB0aGUgZmlsZXMgaW50byB0aGUgd29ya2RpcmVjdG9yeVxuICogdGhlbiB1cGRhdGVzIHN0dWRlbnQuc3RhdHVzLmZldGNoZmlsZXMgaW4gb3JkZXIgdG8gdHJpZ2dlciBhIGZpbGVyZXF1ZXN0IGZyb20gdGhlIHN0dWRlbnQocykgXG4gKi9cblxucm91dGVyLnBvc3QoJy91cGxvYWQvOnNlcnZlcm5hbWUvOnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHsgIFxuICAgIGNvbnN0IHNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5zZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuXG4gICAgaWYgKCBzZXJ2ZXJ0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cblxuICAgIC8vIGNyZWF0ZSB1cGxvYWRzIGRpcmVjdG9yeVxuICAgIGxldCB1cGxvYWRkaXJlY3RvcnkgPSAgcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsICdVUExPQURTJylcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcih1cGxvYWRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBEaXJlY3RvcnkgbWlnaHQgYWxyZWFkeSBleGlzdCwgdGhhdCdzIG9rXG4gICAgfVxuXG5cbiAgICBpZiAocmVxLmZpbGVzKXtcblxuICAgICAgICBsZXQgZmlsZXNBcnJheSA9IFtdICAvLyBkZXBlbmRpbmcgb24gdGhlIG51bWJlciBvZiBmaWxlcyB0aGlzIGNvbWVzIGFzIGFycmF5IG9mIG9iamVjdHMgb3Igb2JqZWN0XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyZXEuZmlsZXMuZmlsZXMpKXsgZmlsZXNBcnJheS5wdXNoKHJlcS5maWxlcy5maWxlcyl9XG4gICAgICAgIGVsc2Uge2ZpbGVzQXJyYXkgPSByZXEuZmlsZXMuZmlsZXN9XG5cbiAgICAgICAgbGV0IGZpbGVzID0gW10gICAgICAgIFxuICAgIFxuICAgICAgICBmb3IgYXdhaXQgKGxldCBmaWxlIG9mICBmaWxlc0FycmF5KSB7XG4gICAgICAgICAgICBsZXQgZmlsZW5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQoZmlsZS5uYW1lKSAgLy9lbmNvZGUgdG8gcHJldmVudCBub24tYXNjaWkgY2hhcnMgd2VpcmRuZXNzXG4gICAgICAgICAgICBsZXQgYWJzb2x1dGVGaWxlcGF0aCA9IHBhdGguam9pbih1cGxvYWRkaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGF3YWl0IGZpbGUubXYoYWJzb2x1dGVGaWxlcGF0aCwgKGVycikgPT4geyAgXG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoIHQoXCJkYXRhLmNvdWxkbm90c3RvcmVcIikgKSB9XG4gICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICBmaWxlcy5wdXNoKHsgbmFtZTpmaWxlbmFtZSAsIHBhdGg6YWJzb2x1dGVGaWxlcGF0aCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluZm9ybSBzdHVkZW50cyBhYm91dCB0aGlzIHNlbmQtZmlsZSByZXF1ZXN0IHNvIHRoYXQgdGhleSB0cmlnZ2VyIGEgZG93bmxvYWQgcmVxdWVzdCBmb3IgdGhlIGdpdmVuIGZpbGVzXG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ10gPSB0cnVlICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9ICBmaWxlc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0dWRlbnR0b2tlbiA9PSBcImFcIiB8fCBzdHVkZW50dG9rZW4gPT0gXCJiXCIpe1xuICAgICAgICAgICAgbGV0IGdyb3VwQXJyYXkgPSBbXVxuICAgICAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PSBcImFcIil7Z3JvdXBBcnJheSA9IG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQS51c2VycyB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09IFwiYlwiKXtncm91cEFycmF5ID0gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBCLnVzZXJzIH1cblxuICAgICAgICAgICAgaWYgKGdyb3VwQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IG5hbWUgb2YgZ3JvdXBBcnJheSl7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQuY2xpZW50bmFtZSA9PT0gbmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXT0gdHJ1ZSBcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gZmlsZXNcbiAgICAgICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIikgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ109IHRydWUgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBmaWxlc1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXJlY2VpdmVkXCIpICB9KVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCAgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLm5vZmlsZXJlY2VpdmVkXCIpIH0pXG4gICAgfVxuICAgIFxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgcm91dGVyXG5cbi8vIFNpbXBsZSBjb25jdXJyZW5jeSBsaW1pdGVyIGZvciBaSVAgZXh0cmFjdGlvblxuY29uc3QgTUFYX1BBUkFMTEVMX0VYVFJBQ1RTID0gNDsgLy8gbGltaXQgc2ltdWx0YW5lb3VzIGV4dHJhY3Rpb25zIHRvIHN0YWJpbGl6ZSBsYXRlbmN5XG5sZXQgcnVubmluZ0V4dHJhY3RzID0gMDtcbmNvbnN0IGV4dHJhY3RRdWV1ZSA9IFtdO1xuXG5mdW5jdGlvbiBydW5OZXh0RXh0cmFjdCgpIHtcbiAgICBpZiAocnVubmluZ0V4dHJhY3RzID49IE1BWF9QQVJBTExFTF9FWFRSQUNUUykgcmV0dXJuO1xuICAgIGNvbnN0IGpvYiA9IGV4dHJhY3RRdWV1ZS5zaGlmdCgpO1xuICAgIGlmICgham9iKSByZXR1cm47XG5cbiAgICBydW5uaW5nRXh0cmFjdHMrKztcbiAgICAvLyBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuXG4gICAgam9iKClcbiAgICAgICAgLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAvLyBjb25zdCBtcyA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gICAgICAgICAgICAvLyBsb2cuaW5mbyhgZGF0YSBAIGV4dHJhY3Q6IGZpbmlzaGVkIGluICR7bXN9bXMgKHJ1bm5pbmc9JHtydW5uaW5nRXh0cmFjdHMtMX0sIHF1ZXVlZD0ke2V4dHJhY3RRdWV1ZS5sZW5ndGh9KWApO1xuICAgICAgICAgICAgcnVubmluZ0V4dHJhY3RzLS07XG4gICAgICAgICAgICBzZXRJbW1lZGlhdGUocnVuTmV4dEV4dHJhY3QpO1xuICAgICAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXJjaGl2ZUFuZEV4dHJhY3RaaXAoYWJzb2x1dGVGaWxlcGF0aCwgc3R1ZGVudGFyY2hpdmVkaXIsIGZpbGVDb250ZW50KXtcbiAgICAvLyBsb2cuaW5mbyhgZGF0YSBAIHJlY2VpdmU6IFN0b3JpbmcgWmlwZmlsZSB0byAke2Fic29sdXRlRmlsZXBhdGh9YClcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBleGVjID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgZmlsZUNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBFeHRyYWN0aW5nIFppcGZpbGUgdG8gJHtzdHVkZW50YXJjaGl2ZWRpcn1gKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHtcbiAgICAgICAgICAgICAgICAgICAgZGlyOiBzdHVkZW50YXJjaGl2ZWRpcixcbiAgICAgICAgICAgICAgICAgICAgb25FbnRyeTogKGVudHJ5LCB6aXBmaWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGVudHJ5LmZpbGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldC5zdGFydHNXaXRoKHBhdGgubm9ybWFsaXplKHN0dWRlbnRhcmNoaXZlZGlyICsgcGF0aC5zZXApKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Jsb2NrZWQgcGF0aCB0cmF2ZXJzYWw6ICcgKyBlbnRyeS5maWxlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRyeSB7IGF3YWl0IGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBkYXRhIEAgcmVjZWl2ZTogU3VjY2Vzc2Z1bGx5IGV4dHJhY3RlZCBaSVAgZmlsZSB0byAke3N0dWRlbnRhcmNoaXZlZGlyfWApO1xuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZSAoZXh0cmFjdCk6IFwiLCBlcnIpO1xuICAgICAgICAgICAgICAgIHRyeSB7IGF3YWl0IGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGV4dHJhY3RRdWV1ZS5wdXNoKGV4ZWMpO1xuICAgICAgICBpZiAocnVubmluZ0V4dHJhY3RzIDwgTUFYX1BBUkFMTEVMX0VYVFJBQ1RTKSBzZXRJbW1lZGlhdGUocnVuTmV4dEV4dHJhY3QpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgdG9rZW4gaXMgdmFsaWQgaW4gb3JkZXIgdG8gcHJvY2VzcyBhcGkgcmVxdWVzdFxuICogQXR0ZW50aW9uOiBubyBhbGwgYXBpIHJlcXVlc3RzIGNoZWNrIHRva2VucyBhdG0hXG4gKi9cbmZ1bmN0aW9uIGNoZWNrVG9rZW4odG9rZW4sIG1jc2VydmVyKXtcbiAgICBsZXQgdG9rZW5leGlzdHMgPSBmYWxzZVxuICAgIC8vIGxvZy5pbmZvKFwiZGF0YSBAIGNoZWNrVG9rZW46IGNoZWNraW5nIGlmIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiB0aGlzIHNlcnZlclwiKVxuICAgIHRyeSB7XG4gICAgICAgIG1jc2VydmVyLnN0dWRlbnRMaXN0LmZvckVhY2goIChzdHVkZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAodG9rZW4gPT09IHN0dWRlbnQudG9rZW4pIHtcbiAgICAgICAgICAgICAgICB0b2tlbmV4aXN0cyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNhdGNoKGVycil7XG4gICAgICAgIGxvZy5lcnJvcihgZGF0YTogJHtlcnJ9YClcbiAgICB9XG5cbiAgICByZXR1cm4gdG9rZW5leGlzdHNcbn1cblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBvdXRQYXRoOiAvcGF0aC90by9jcmVhdGVkLnppcFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIHppcERpcmVjdG9yeShzb3VyY2VEaXIsIG91dFBhdGgpIHtcbiAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGFyY2hpdmVcbiAgICAgICAgLmRpcmVjdG9yeShzb3VyY2VEaXIsIGZhbHNlKVxuICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICA7XG4gICAgICBzdHJlYW0ub24oJ2Nsb3NlJywgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICB9KTtcbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5cbmltcG9ydCBmcyBmcm9tICdmcydcbi8vaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vcmVuZGVyZXIvc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbi8vY29uc3QgeyB0IH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgaXBjTWFpbiwgZGlhbG9nIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBuZXR3b3JrSW50ZXJmYWNlcyB9IGZyb20gJ29zJ1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuXG5pbXBvcnQgc2VydmVyIGZyb20gXCIuLi8uLi9zZXJ2ZXIvc3JjL3NlcnZlci5qc1wiXG5pbXBvcnQgY2hlY2tEaXNrU3BhY2UgZnJvbSAnY2hlY2stZGlzay1zcGFjZSc7XG5cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5wcmludFF1ZXVlID0gW11cbiAgICAgICAgdGhpcy5pc1Byb2Nlc3NpbmdQcmludCA9IGZhbHNlXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByb2Nlc3MgcHJpbnQgcXVldWUgc2VxdWVudGlhbGx5IC0gb25lIGpvYiBhdCBhIHRpbWVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQcmludFF1ZXVlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcm9jZXNzaW5nUHJpbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vIEFscmVhZHkgcHJvY2Vzc2luZ1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmlzUHJvY2Vzc2luZ1ByaW50ID0gdHJ1ZTtcblxuICAgICAgICAgICAgd2hpbGUgKHRoaXMucHJpbnRRdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgam9iID0gdGhpcy5wcmludFF1ZXVlLnNoaWZ0KCk7IC8vIEdldCBmaXJzdCBqb2IgZnJvbSBxdWV1ZVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludFF1ZXVlOiBQcm9jZXNzaW5nIHByaW50IGpvYiAoJHt0aGlzLnByaW50UXVldWUubGVuZ3RofSByZW1haW5pbmcgaW4gcXVldWUpYCk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9wcm9jZXNzUHJpbnRKb2Ioam9iLmRvY0Jhc2U2NCwgam9iLnByaW50ZXJOYW1lLCBqb2IucHJldmlld1R5cGUpO1xuICAgICAgICAgICAgICAgICAgICBqb2IucmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50UXVldWU6IFByaW50IGpvYiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgam9iLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmlzUHJvY2Vzc2luZ1ByaW50ID0gZmFsc2U7XG4gICAgICAgICAgICBsb2cuaW5mbygnaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRRdWV1ZTogUHJpbnQgcXVldWUgZW1wdHksIHByb2Nlc3Npbmcgc3RvcHBlZCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQcm9jZXNzIGEgc2luZ2xlIHByaW50IGpvYiAtIHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIGFmdGVyIHByaW50IGNhbGxiYWNrIGNvbXBsZXRlc1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJvY2Vzc1ByaW50Sm9iID0gYXN5bmMgKGRvY0Jhc2U2NCwgcHJpbnRlck5hbWUsIHByZXZpZXdUeXBlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBoaWRkZW5XaW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB1c2VDb250ZW50U2l6ZTogdHJ1ZSwgLy8gRW5zdXJlIHdpZHRoL2hlaWdodCByZWZlcnMgdG8gY29udGVudCBhcmVhXG4gICAgICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW5zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbUZhY3RvcjogMS4wICAvLyBGb3JjZSAxOjEgc2NhbGluZyB0byBpZ25vcmUgc3lzdGVtIHNjYWxlIGZhY3RvclxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gU2V0IHpvb20gZmFjdG9yIHRvIDEuMCB0byBpZ25vcmUgc3lzdGVtIERQSSBzY2FsaW5nIChmaXhlcyBDaHJvbWl1bSBwcmludCBidWcpXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLndlYkNvbnRlbnRzLnNldFpvb21GYWN0b3IoMS4wKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgZGF0YVVybCA9IGBgO1xuICAgICAgICAgICAgICAgIGlmIChwcmV2aWV3VHlwZSA9PT0gXCJwZGZcIikge1xuICAgICAgICAgICAgICAgICAgICBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2RvY0Jhc2U2NH1gO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocHJldmlld1R5cGUgPT09IFwiaW1hZ2VcIikge1xuICAgICAgICAgICAgICAgICAgICBkYXRhVXJsID0gYGRhdGE6aW1hZ2UvanBlZztiYXNlNjQsJHtkb2NCYXNlNjR9YDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2lwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBJbnZhbGlkIHByZXZpZXcgdHlwZSEnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0ludmFsaWQgcHJldmlldyB0eXBlJykpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLm9uKCdjbG9zZWQnLCAoKSA9PiB7IGhpZGRlbldpbiA9IG51bGw7IH0pO1xuXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLndlYkNvbnRlbnRzLm9uKCdkaWQtc3RvcC1sb2FkaW5nJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNQREZSZW5kZXJlZCA9IGF3YWl0IGhpZGRlbldpbi53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGFwc2VkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW50ZXJ2YWwgPSA1MDA7IC8vIENoZWNrIGV2ZXJ5IDUwMCBtc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gMjAwMDsgLy8gTWF4aW11bSAyIHNlY29uZHMgd2FpdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGVja1BERkxvYWRlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtYmVkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZW1iZWRbdHlwZT1cImFwcGxpY2F0aW9uL3BkZlwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaW1nJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbWJlZCAmJiBlbWJlZC5jbGllbnRIZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7IC8vIFBERiBpcyBhc3N1bWVkIHRvIGJlIGZ1bGx5IHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoaW1nICYmIGltZy5jbGllbnRIZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTsgLy8gSW1hZ2UgaXMgZnVsbHkgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChlbGFwc2VkID49IHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGZhbHNlKTsgLy8gVGltZSBleHBpcmVkLCBub3QgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZWxhcHNlZCArPSBpbnRlcnZhbDsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lciA9IHNldEludGVydmFsKGNoZWNrUERGTG9hZGVkLCBpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzUERGUmVuZGVyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IGJhc2U2NCAke3ByZXZpZXdUeXBlfSByZWNlaXZlZCAtIHByaW50aW5nIG9uOiAke3ByaW50ZXJOYW1lfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRpbWVvdXQgdG8gYXZvaWQgaGFuZ2luZyBxdWV1ZSB3aGVuIHByaW50IGNhbGxiYWNrIG5ldmVyIGZpcmVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJpbnRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IHByaW50IGpvYiB0aW1lb3V0IGZvciBwcmludGVyICR7cHJpbnRlck5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdQcmludCBqb2IgdGltZW91dCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCAxMDAwMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4ud2ViQ29udGVudHMucHJpbnQoeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lsZW50OiB0cnVlLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlTmFtZTogcHJpbnRlck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVGYWN0b3I6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2VzUGVyU2hlZXQ6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRwaToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9yaXpvbnRhbDogNjAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGljYWw6IDYwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblR5cGU6ICdub25lJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgKHN1Y2Nlc3MsIGZhaWx1cmVSZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHByaW50VGltZW91dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvZyBpZiBwcmludCBqb2Igd2FzIGhhbmRlZCBvdmVyIHRvIE9TIG9yIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IHByaW50IGpvYiBmYWlsZWQgZm9yIHByaW50ZXIgJHtwcmludGVyTmFtZX06ICR7ZmFpbHVyZVJlYXNvbiB8fCAndW5rbm93biByZWFzb24nfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoZmFpbHVyZVJlYXNvbiB8fCAnUHJpbnQgam9iIGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogcHJpbnQgam9iIHN1Y2Nlc3NmdWxseSBoYW5kZWQgb3ZlciB0byBPUyBmb3IgcHJpbnRlciAke3ByaW50ZXJOYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogUmVuZGVyaW5nL1ByaW50IGZhaWxlZCEnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUmVuZGVyaW5nL1ByaW50IGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IEVycm9yIGR1cmluZyBwcmludCBqb2I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBoaWRkZW5XaW4ubG9hZFVSTChkYXRhVXJsKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogRXJyb3IgbG9hZGluZyBVUkw6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9naW5CaVAnLCAoZXZlbnQsIGJpcHRlc3QpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvZ2luQmlQOiBvcGVuaW5nIGJpcCB3aW5kb3cuIHRlc3RlbnZpcm9ubWVudDpcIiwgYmlwdGVzdClcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KVxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gYmlwIGxvZ29uXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLy8gcmV0dXJucyB0aGUgY3VycmVudCBzZXJ2ZXJzdGF0dXMgb2JqZWN0IG9mIHRoZSBnaXZlbiBzZXJ2ZXIobmFtZSlcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHNlcnZlcnN0YXR1cycsIChldmVudCwgc2VydmVybmFtZSkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmIChtY1NlcnZlciApIHsgcmV0dXJuIG1jU2VydmVyLnNlcnZlcnN0YXR1cyAgfVxuICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICByZXR1cm4gZmFsc2UgIH1cbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvLyBzdG9wcyB0aGUgY3VycmVudCBleGFtIHNlcnZlciBcbiAgICAgICAgLy8gKHRoaXMgaXMgYSBjb3B5IG9mIHRoZSAvc3RvcHNlcnZlci86c2VydmVybmFtZSByb3V0ZSBpbiBjb250cm9sLmpzIClcbiAgICAgICAgLy8gcmV0aGluayBjb25jZXB0IHRoYXQgbG9jYWwgcmVxdWVzdHMgZ28gdG8gdGhlIEFQSSAodGhpcyBoYWQgYSBub24gZWxlY3Ryb24gc2VydmVyIHZlcnNpb24gaW4gbWluZCBidXQgbWFrZXMgbm8gc2Vuc2UgaW4gZWxlY3Ryb24gb25seSBhcHApXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdG9wc2VydmVyJywgKGV2ZW50LCBzZXJ2ZXJuYW1lKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgaWYgKG1jU2VydmVyICkgeyBcbiAgICAgICAgICAgICAgICBtY1NlcnZlci5icm9hZGNhc3RJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICBtY1NlcnZlci5zZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdICAgIC8vZGVsZXRlIG1jU2VydmVyXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbVNlcnZlckxpc3QgPSB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdC5maWx0ZXIoZXhhbSA9PiBleGFtLnNlcnZlcm5hbWUgIT09IHNlcnZlcm5hbWUpICAvLyBtdWx0aWNhc3RjbGllbnQga2VlcHMgdHJhY2sgb2YgcnVubmluZyBzZXJ2ZXJzIGluIHRoZSBsYW5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICByZXR1cm4gZmFsc2UgIH1cbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvL3JldHVybiBjdXJyZW50IHN0dWRlbnRsaXN0XG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdHVkZW50bGlzdCcsIChldmVudCwgc2VydmVybmFtZSkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmIChtY1NlcnZlciApIHsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtzdHVkZW50bGlzdDogbWNTZXJ2ZXIuc3R1ZGVudExpc3R9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIHN0dWRlbnRsaXN0OiBbXX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkgXG5cblxuXG5cbiAgICAgICAgLy8gb3BlbnMgYSBsb2dpbndpbmRvdyBmb3IgbWljcm9zb2Z0IDM2NVxuICAgICAgICBpcGNNYWluLm9uKCdvcGVubXNhdXRoJywgKGV2ZW50KSA9PiB7IHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVNc2F1dGhXaW5kb3coKTsgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZSB9KSAgXG5cblxuICAgICAgICAvLyByZXR1cm5zIGN1cnJlbnQgY29uZmlnXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29weUNvbmZpZyhjb25maWcpOyBcbiAgICAgICAgfSkgIFxuXG5cbiAgICAgICAgLy8gcmV0dXJucyBjdXJyZW50IGNvbmZpZyBhc3luY1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0Y29uZmlnYXN5bmMnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29weUNvbmZpZyhjb25maWcpXG4gICAgICAgIH0pICBcblxuXG4gICAgICAgIC8vIGxvZyBvdXQgb2YgbWljcm9zb2Z0IDM2NVxuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVzZXRUb2tlbicsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHdpbiA9IHRoaXMuV2luZG93SGFuZGxlci5tYWlud2luZG93OyAvLyBPZGVyIHdpZSBhdWNoIGltbWVyIFNpZSBhdWYgSWhyIEJyb3dzZXJXaW5kb3ctT2JqZWt0IHp1Z3JlaWZlblxuICAgICAgICAgICAgaWYgKCF3aW4pIHJldHVybjtcblxuICAgICAgICAgICAgYXdhaXQgd2luLndlYkNvbnRlbnRzLnNlc3Npb24uY2xlYXJDYWNoZSgpO1xuICAgICAgICAgICAgYXdhaXQgd2luLndlYkNvbnRlbnRzLnNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7XG4gICAgICAgICAgICAgICAgc3RvcmFnZXM6IFsnY29va2llcyddXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25maWcuYWNjZXNzVG9rZW4gPSBmYWxzZVxuXG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCByZXNldFRva2VuOiBMb2dnZWQgb3V0IG9mIE9mZmljZTM2NVwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29weUNvbmZpZyhjb25maWcpOyAgLy8gd2UgY2FudCBqdXN0IGNvcHkgdGhlIGNvbmZpZyBiZWNhdXNlIGl0IGNvbnRhaW5zIGV4YW1TZXJ2ZXJMaXN0IHdoaWNoIGNvbnRhaW5zIGNvbmZpZyAoY2lyY3VsYXIgc3RydWN0dXJlKVxuICAgICAgICB9KSAgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogb3BlbnMgZmlsZSBpbiBleHRlcm5hbCBwcm9ncmFtIC0gcGxhdGZvcm0gZGVwZW5kZW50XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnb3BlbmZpbGUnLCAoZXZlbnQsIGZpbGVwYXRoKSA9PiB7ICBcbiAgICAgICAgICAgIGNvbnN0IGNtZCA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyBgc3RhcnQgXCIgXCIgXCIke2ZpbGVwYXRofVwiYCA6XG4gICAgICAgICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyA/IGBvcGVuIFwiJHtmaWxlcGF0aH1cImAgOlxuICAgICAgICAgICAgYHhkZy1vcGVuIFwiJHtmaWxlcGF0aH1cImA7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZXhlYyhjbWQsIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIG9wZW5maWxlOiBFcnJvciBvcGVuaW5nIFBERiBpbiBleHRlcm5hbCByZWFkZXI6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2lwY2hhbmRsZXIgQCBvcGVuZmlsZTogRmlsZSBvcGVuZWQgaW4gZXh0ZXJuYWwgcmVhZGVyJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIG9wZW5maWxlOiBFcnJvciBvcGVuaW5nIFBERjonLCBlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KSAgXG5cblxuICAgICAgICBpcGNNYWluLm9uKCdnZXRDdXJyZW50V29ya2RpcicsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gY29uZmlnLndvcmtkaXJlY3RvcnkgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY2hlY2tEaXNjc3BhY2UnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IGRpc2tTcGFjZSA9IGF3YWl0IGNoZWNrRGlza1NwYWNlKGNvbmZpZy53b3JrZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICBsZXQgZnJlZSA9IE1hdGgucm91bmQoZGlza1NwYWNlLmZyZWUgLyAxMDI0IC8gMTAyNCAvIDEwMjQgKiAxMDAwKSAvIDEwMDA7XG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBjaGVja0Rpc2tzcGFjZTpcIixkaXNrU3BhY2UpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyZWU7ICAgIFxuICAgICAgICB9KTtcblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2V0YmFja3VwZGlyJywgYXN5bmMgKGV2ZW50LCBhcmcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyggdGhpcy5XaW5kb3dIYW5kbGVyLm1haW53aW5kb3csIHsgcHJvcGVydGllczogWydvcGVuRGlyZWN0b3J5J10gIH0pXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5jYW5jZWxlZCl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ2RpcmVjdG9yaWVzIHNlbGVjdGVkJywgcmVzdWx0LmZpbGVQYXRocylcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiXCJcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdGVzdGRpciA9IGpvaW4ocmVzdWx0LmZpbGVQYXRoc1swXSAgICwgY29uZmlnLnNlcnZlcmRpcmVjdG9yeSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRlc3RkaXIpKXtmcy5ta2RpclN5bmModGVzdGRpcil9XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcInN1Y2Nlc3NcIlxuICAgICAgICAgICAgICAgICAgICAvL2NvbmZpZy53b3JrZGlyZWN0b3J5ID0gdGVzdGRpclxuICAgICAgICAgICAgICAgICAgICBjb25maWcuYmFja3VwZGlyZWN0b3J5ID0gdGVzdGRpclxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzZXRiYWNrdXBkaXI6XCIsIGNvbmZpZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJlcnJvclwiXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4ge2JhY2t1cGRpcjogY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWVzc2FnZSA6IG1lc3NhZ2V9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge2JhY2t1cGRpcjogY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWVzc2FnZSA6ICdjYW5jZWxlZCd9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLm9uKCdzZXRQcmV2aW91c1dvcmtkaXInLCBhc3luYyAoZXZlbnQsIHdvcmtkaXIpID0+IHtcbiAgICAgICAgICAgIGlmICh3b3JrZGlyKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygncHJldmlvdXMgZGlyZWN0b3J5IHNlbGVjdGVkJywgd29ya2RpcilcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiXCJcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2Rpcikpe2ZzLm1rZGlyU3luYyh3b3JrZGlyKX1cbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwic3VjY2Vzc1wiXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy53b3JrZGlyZWN0b3J5ID0gd29ya2RpclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSl7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcImVycm9yXCJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0ge3dvcmtkaXI6IGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtZXNzYWdlIDogbWVzc2FnZX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgZXZlbnQucmV0dXJuVmFsdWUgPSB7d29ya2RpcjogY29uZmlnLndvcmtkaXJlY3RvcnksIG1lc3NhZ2UgOiAnY2FuY2VsZWQnfSB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY3JlYXRlQmlwRXhhbWRpcmVjdG9yeScsIGFzeW5jIChldmVudCwgZXhhbSkgPT4ge1xuICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBcIlwiXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgZXhhbS5leGFtTmFtZSlcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbih3b3JrZGlyLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7ZnMubWtkaXJTeW5jKHdvcmtkaXIpfVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcInN1Y2Nlc3NcIlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHsgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShleGFtLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBKU09OIGJlZm9yZSB3cml0aW5nIHRvIHByZXZlbnQgaW52YWxpZCBKU09OIGZpbGVzXG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZShqc29uU3RyaW5nKTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBqc29uU3RyaW5nKTsgIFxuICAgICAgICAgICAgfSAgIC8vIHNhdmUgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIGFzIEpTT04gZmlsZVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7ICBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBjcmVhdGVCaXBFeGFtZGlyZWN0b3J5OiBKU09OIHZhbGlkYXRpb24gb3Igd3JpdGUgZmFpbGVkOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcImVycm9yXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0ge21lc3NhZ2UgOiBtZXNzYWdlfVxuXG4gICAgICAgIH0pXG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgTE9HIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGxvZycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IGpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBqb2luKHdvcmtkaXIsXCJuZXh0LWV4YW0tdGVhY2hlci5sb2dcIilcbiAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHNlcnZlcmxvZyA9IGRhdGEudHJpbSgpXG4gICAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgICAgICAgICAgIC5tYXAobGluZSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXFsoLis/KVxcXVxccytcXFsoLis/KVxcXVxccysoLiopJC8pO1xuICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFssIGRhdGUsIHR5cGUsIHJhd1RleHRdID0gbWF0Y2g7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBTZXQgY29sb3IgYmFzZWQgb24gbG9nIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbG9yO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAnIzBhYTJjMCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICd3YXJuJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLXdhcm5pbmcpJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLWRhbmdlciknO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLWN5YW4pJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNvdXJjZSA9ICduZXh0LWV4YW0nO1xuICAgICAgICAgICAgICAgICAgICBsZXQgdGV4dCA9IHJhd1RleHQ7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIGNvbG9uIGlzIHByZXNlbnQ6IGV2ZXJ5dGhpbmcgYmVmb3JlIHRoZSBmaXJzdCBjb2xvbiBhcyAnc291cmNlJ1xuICAgICAgICAgICAgICAgICAgICBpZiAocmF3VGV4dC5pbmNsdWRlcygnOicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb25JbmRleCA9IHJhd1RleHQuaW5kZXhPZignOicpO1xuICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IHJhd1RleHQuc3Vic3RyaW5nKDAsIGNvbG9uSW5kZXgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0ID0gcmF3VGV4dC5zdWJzdHJpbmcoY29sb25JbmRleCArIDEpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZGF0ZSwgdHlwZSwgdGV4dCwgY29sb3IsIHNvdXJjZSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbSAhPT0gbnVsbCk7XG5cblxuICAgICAgICAgICAgICAgIHJldHVybiBzZXJ2ZXJsb2dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRsb2c6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJldHVybnMgb2xkIGV4YW0gZm9sZGVycyBpbiB3b3JrZGlyZWN0b3J5XG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzY2FuV29ya2RpcicsIGFzeW5jIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICBsZXQgZXhhbWZvbGRlcnMgPSBbXSAvLyBhcnJheSBmb3IgcmVzdWx0c1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnkpKSB7IC8vIGNoZWNrIGlmIGJhc2UgZGlyIGV4aXN0c1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBmcy5yZWFkZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRpcm5hbWUgb2YgZm9sZGVycykgeyAvLyBpdGVyYXRlIG92ZXIgZGlyZWN0b3J5IG5hbWVzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1c1BhdGggPSBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBkaXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXJ2ZXJzdGF0dXNQYXRoKSkgeyAvLyBjaGVjayBpZiBmaWxlIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyc3RhdHVzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2VydmVyc3RhdHVzUGF0aCwgJ3V0Zi04JykpIC8vIHBhcnNlIEpTT04gdG8gb2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlcnZlcnN0YXR1cy5leGFtTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1cy5leGFtTmFtZSA9IGRpcm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW1mb2xkZXJzLnB1c2goc2VydmVyc3RhdHVzKSAvLyBhZGQgb2JqZWN0IHRvIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNjYW5Xb3JrZGlyOiBFcnJvciBwYXJzaW5nIHNlcnZlcnN0YXR1cy5qc29uIGluICR7ZGlybmFtZX06YCwgZSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV4YW1mb2xkZXJzIC8vIHJldHVybiByZXN1bHRzXG4gICAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRlbGV0ZXMgb2xkIGV4YW0gZm9sZGVyIGluIHdvcmtkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdkZWxQcmV2aW91cycsIGFzeW5jIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICBsZXQgZXhhbWRpciA9IGpvaW4oIGNvbmZpZy53b3JrZGlyZWN0b3J5LCBhcmcpXG4gICAgICAgICAgICBpZiAoZnMuc3RhdFN5bmMoZXhhbWRpcikuaXNEaXJlY3RvcnkoKSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKGV4YW1kaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtsb2cuZXJyb3IoZSl9XG4gICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICByZXR1cm4gZXhhbWRpclxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqIEdldCBTcGVjaWZpYyBTdWJtaXNzaW9uIGJ5IGZpbGVwYXRoIGFzIGJhc2U2NCBzdHJpbmcgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFNwZWNpZmljU3VibWlzc2lvbkJhc2U2NCcsIGFzeW5jIChldmVudCwgZmlsZXBhdGgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VibWlzc2lvbiA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ2Jhc2U2NCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VibWlzc2lvbjogc3VibWlzc2lvbiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFNwZWNpZmljU3VibWlzc2lvbkJhc2U2NDogJHtlfWApXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VibWlzc2lvbjogZmFsc2UsIHN0YXR1czogXCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgbGF0ZXN0IHN1Ym1pc2lvbnMgZnJvbSBhbGwgc3R1ZGVudHNcbiAgICAgICAgICogcmV0dXJuIGFycmF5IG9mIG9iamVjdHMgd2l0aCBzdHVkZW50bmFtZSwgbGF0ZXN0ZmlsZXBhdGgsIGxhdGVzdGZpbGVuYW1lIGFuZCBzdWJtaXNzaW9uZGF0ZSAodGltZXN0YW1wKVxuICAgICAgICAgKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIHRvIGdldCB0aGUgc3VibWlzc2lvbnMgZnJvbVxuICAgICAgICAgKiBAcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwic3VjY2Vzc1wiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBzdWJtaXNzaW9uczogc3VibWlzc2lvbnMgfVxuICAgICAgICAgKi9cbiAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0U3VibWlzc2lvbnMnLCBhc3luYyAoZXZlbnQsIHNlcnZlcm5hbWUsIGN1cnJlbnRzZXJ2ZXJzdGF0dXMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1cyA9IEpTT04ucGFyc2UoY3VycmVudHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIGlmICghbWNTZXJ2ZXIpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIHN1Ym1pc3Npb25zOiBbXSB9IH1cbiAgICAgICAgICAgIGxldCBzdWJtaXNzaW9ucyA9IFtdXG4gICAgICAgICAgICBsZXQgZGlyID0gIGpvaW4oIGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUpO1xuICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGRpcikpIHsgLy8gY2hlY2sgaWYgYmFzZSBkaXIgZXhpc3RzXG4gICAgICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IGZzLnJlYWRkaXJTeW5jKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3R1ZGVudE5hbWUgb2YgZm9sZGVycykgeyAvLyBpdGVyYXRlIG92ZXIgZGlyZWN0b3J5IG5hbWVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHVkZW50TmFtZS50b1VwcGVyQ2FzZSgpID09PSAnVVBMT0FEUycpIHsgLy8gaWdub3JlIFVQTE9BRFMgZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc2VjdGlvbnMgPSB7fVxuICAgICAgICAgICAgICAgICAgICBsZXQgc3VibWlzc2lvbkRpciA9IGpvaW4oZGlyLCBzdHVkZW50TmFtZSwgXCJBQkdBQkVcIilcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGl0ZXJhdGUgb3ZlciBleGFtIHNlY3Rpb25zIDEtNFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBzZWN0aW9uID0gMTsgc2VjdGlvbiA8PSA0OyBzZWN0aW9uKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzZWN0aW9uRGlyID0gam9pbihzdWJtaXNzaW9uRGlyLCBTdHJpbmcoc2VjdGlvbikpXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluaXRpYWxpemUgc2VjdGlvbiB3aXRoIGRlZmF1bHQgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9uc1tzZWN0aW9uXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25uYW1lOiBcIlwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNlY3Rpb25EaXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNlY3Rpb25GaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHNlY3Rpb25EaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpIC8vIG9ubHkgZmlsZXMsIG5vdCBkaXJlY3Rvcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VjdGlvbkZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxhdGVzdFN1Ym1pc3Npb24gPSBzZWN0aW9uRmlsZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVQYXRoID0gam9pbihzZWN0aW9uRGlyLCBmaWxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGZpbGUsIG10aW1lOiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWUgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLm10aW1lIC0gYS5tdGltZSlbMF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25zW3NlY3Rpb25dID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogam9pbihzZWN0aW9uRGlyLCBsYXRlc3RTdWJtaXNzaW9uLmZpbGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGxhdGVzdFN1Ym1pc3Npb24uZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGU6IGxhdGVzdFN1Ym1pc3Npb24ubXRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9ubmFtZTogc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZWN0aW9uXS5zZWN0aW9ubmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9ucy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnROYW1lOiBzdHVkZW50TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25zOiBzZWN0aW9uc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWJtaXNzaW9uc1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGxhdGVzdCBiYWsgZmlsZSBmcm9tIHNwZWNpZmljIHN0dWRlbnQgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0TGF0ZXN0QmFrRmlsZScsIGFzeW5jIChldmVudCwgc2VydmVybmFtZSwgc3R1ZGVudE5hbWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmICghbWNTZXJ2ZXIpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIGZpbGVwYXRoOiBmYWxzZSB9IH1cbiAgICAgICAgICAgIGxldCBsYXRlc3RCYWtGaWxlID0gbnVsbFxuICAgICAgICAgICAgbGV0IGRpciA9ICBqb2luKCBjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50TmFtZSk7XG4gICAgXG4gICAgICAgICAgICAvL2NoZWNrIGlmIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UgfSB9XG5cbiAgICAgICAgICAgIC8vaW4gdGhlIHN0dWRlbnQgZGlyZWN0cm95IHRoZXJlIGFyZSBzZXZlcmFsIGJhY2t1cCBkaXJlY3RvcmllcyAgdGhhdCBjb250YWluIGEgYmFrIGZpbGUgLzIwMjUxMTEyXzEwXzIwXzEzL1xuICAgICAgICAgICAgLy8gdGhlIGJha2ZpbGUgbmFtaW5nIHNjaGVtZSBpcyBzdHVkZW50bmFtZS5iYWsgLi4uIHdlIG9ubHkgbmVlZCB0aGUgbGF0ZXN0IG9uZSB0aGF0IGhhcyB0aGUgc3R1ZGVudG5hbWUgYXMgZmlsZW5hbWVcbiAgICAgICAgICAgIC8vIGlnbm9yZSBkaXJlY3RvcmllczogQUJHQUJFIGFuZCBmb2N1c2xvc3RcbiAgICAgICAgICAgIGNvbnN0IGJhY2t1cERpcmVjdG9yaWVzID0gZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNEaXJlY3RvcnkoKSAmJiBkaXJlbnQubmFtZSAhPT0gJ0FCR0FCRScgJiYgZGlyZW50Lm5hbWUgIT09ICdmb2N1c2xvc3QnKVxuICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVQYXRoID0gam9pbihkaXIsIGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBuYW1lOiBkaXJlbnQubmFtZSwgbXRpbWU6IGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZSB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5tdGltZSAtIGEubXRpbWUpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChiYWNrdXBEaXJlY3Rvcmllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgZmlsZXBhdGg6IGZhbHNlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGxhdGVzdEJhY2t1cERpcmVjdG9yeSA9IGJhY2t1cERpcmVjdG9yaWVzWzBdLm5hbWVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldExhdGVzdEJha0ZpbGU6IFNlYXJjaGluZyBmb3IgbGF0ZXN0IGJhY2t1cCBmaWxlIGluOlwiLCBkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSlcbiAgICAgICAgICAgIGNvbnN0IGxhdGVzdEJha0ZpbGVwYXRoID0gam9pbihkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSwgc3R1ZGVudE5hbWUgKyAnLmJhaycpXG4gICAgICAgICAgICBjb25zdCBsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoID0gam9pbihkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy9nZXQgbGF0ZXN0IGJhayBmaWxlICAtIGNoZWNrIGlmIGZpbGUgZXhpc3RzXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobGF0ZXN0QmFrRmlsZXBhdGgpKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UsIGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGg6bGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aCB8fCBmYWxzZSB9IH1cbiAgICAgICAgICAgIC8vcmV0dXJuIHRoZSBleGlzdGluZyBhbmQgY2hlY2tlZCBmaWxlcGF0aCBvciBpZiBubyBmaWxlIHdhcyBmb3VuZCBmYWxzZVxuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwic3VjY2Vzc1wiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBmaWxlcGF0aDogbGF0ZXN0QmFrRmlsZXBhdGgsIGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGg6IGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGggfVxuXG4gICAgICAgIH0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IHN5c3RlbSBwcmludGVyc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHByaW50ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJpbnRlcnMgPSBhd2FpdCB0aGlzLldpbmRvd0hhbmRsZXIubWFpbndpbmRvdy53ZWJDb250ZW50cy5nZXRQcmludGVyc0FzeW5jKCk7XG4gICAgICAgICAgICAvL2xvZy5pbmZvKCdpcGNoYW5kbGVyIEAgZ2V0cHJpbnRlcnM6IHByaW50ZXJzJywgcHJpbnRlcnMpXG4gICAgICAgICAgICBjb25zdCBwcmludGVyRGF0YSA9IHByaW50ZXJzLm1hcChwcmludGVyID0+ICh7XG4gICAgICAgICAgICAgICAgcHJpbnRlck5hbWU6IHByaW50ZXIubmFtZSxcbiAgICAgICAgICAgICAgICBpc0RlZmF1bHQ6IHByaW50ZXJzLmxlbmd0aCA9PT0gMSA/IHRydWUgOiBwcmludGVyLmlzRGVmYXVsdCwgLy8gZGVwcmVjYXRlZCBpbiBlbGVjdHJvbiAzNiwgc2V0IHRvIHRydWUgaWYgb25seSBvbmUgcHJpbnRlclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBwcmludGVyLmRlc2NyaXB0aW9uXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcmludGVyRGF0YVxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByaW50IGEgRG9jdW1lbnQgYXMgYmFzZTY0IHN0cmluZyB2aWEgd2ViY29udGVudHMucHJpbnQoKSB3aXRob3V0IHNwZWNpZmljIHBsYXRmb3JtZGVwZW5kZW50IGxpYnJhcmllc1xuICAgICAgICAgKiBJTkZPOiBpdCBpcyBjdXJyZW50bHkgbm90IHBvc3NpYmxlIHRvIGdldCBhIFwiZmluaXNoZWQtcmVuZGVyaW5nXCIgZXZlbnQgZnJvbSB0aGUgY2hyb21lLXBkZi1wbHVnaW4uIHRoZXJlZm9yZSB0aW1lb3V0cyBhcmUgdXNlZCBhcyBhIHdvcmthcm91bmRcbiAgICAgICAgICogVXNlcyBhIHByaW50IHF1ZXVlIHRvIGhhbmRsZSBtdWx0aXBsZSBzaW11bHRhbmVvdXMgcmVxdWVzdHMgc2VxdWVudGlhbGx5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncHJpbnRCYXNlNjQnLCBhc3luYyAoZXZlbnQsIGRvY0Jhc2U2NCwgcHJpbnRlck5hbWUsIHByZXZpZXdUeXBlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBqb2IgdG8gcXVldWVcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmludFF1ZXVlLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jQmFzZTY0LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRlck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aWV3VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBwcmludEJhc2U2NDogUHJpbnQgcmVxdWVzdCBhZGRlZCB0byBxdWV1ZSAoJHt0aGlzLnByaW50UXVldWUubGVuZ3RofSBqb2JzIGluIHF1ZXVlKWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFN0YXJ0IHF1ZXVlIHByb2Nlc3NpbmcgaWYgbm90IGFscmVhZHkgcnVubmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNQcm9jZXNzaW5nUHJpbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Byb2Nlc3NQcmludFF1ZXVlKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRCYXNlNjQ6IFF1ZXVlIHByb2Nlc3NpbmcgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgcHJpbnRCYXNlNjQ6IHJldHVybmluZyBlcnJvciB0byByZW5kZXJlcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgYXZhaWxhYmxlIG5ldHdvcmsgaW50ZXJmYWNlcyB3aXRoIElQIGFkZHJlc3Nlc1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlcyA9IG5ldHdvcmtJbnRlcmZhY2VzKClcbiAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyA9IG51bGxcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgSVB2NCBhZGRyZXNzZXNcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGludGVyZmFjZXMpLmZvckVhY2goKGludGVyZmFjZU5hbWUpID0+IHtcbiAgICAgICAgICAgICAgICBpbnRlcmZhY2VzW2ludGVyZmFjZU5hbWVdLmZvckVhY2goKGlmYWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgbG9vcGJhY2sgYW5kIGxvY2FsIGFkZHJlc3Nlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWZhY2UuZmFtaWx5ID09PSAnSVB2NCcgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgICAhaWZhY2UuYWRkcmVzcy5zdGFydHNXaXRoKCcxMjcuJykgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgICAhaWZhY2UuYWRkcmVzcy5zdGFydHNXaXRoKCcxNjkuMjU0LicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaW50ZXJmYWNlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBpZmFjZS5hZGRyZXNzXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIG9sZCBJUCBhZGRyZXNzXG4gICAgICAgICAgICBjb25zdCBvbGRIb3N0SXAgPSB0aGlzLmNvbmZpZy5ob3N0aXBcblxuICAgICAgICAgICAgLy8gSWYgYSBwcmVmZXJyZWQgaW50ZXJmYWNlIGlzIHNldCwgdXNlIGl0IHRvIHF1aWNrbHkgZ2V0IGFuIElQXG4gICAgICAgICAgICBpZiAodGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmZXJyZWQgPSB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXM/LmZpbmQoaWZhY2UgPT4gaWZhY2UubmFtZSA9PT0gdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UpXG4gICAgICAgICAgICAgICAgaWYgKHByZWZlcnJlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBwcmVmZXJyZWQuYWRkcmVzc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBwcmVmZXJyZWQubmFtZVxuICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBhIGdhdGV3YXkgZXhpc3RzIGZvciB0aGUgcHJlZmVycmVkIGludGVyZmFjZVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qge2dhdGV3YXksIHZlcnNpb24sIGludH0gPSBnYXRld2F5NHN5bmMocHJlZmVycmVkLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gaW50ID09PSB0aGlzLnByZWZlcnJlZEludGVyZmFjZVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge2dhdGV3YXksIHZlcnNpb24sIGludH0gPSAgZ2F0ZXdheTRzeW5jKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpbnQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IGludFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIC8vdGhpcyBkZWxpdmVycyBhbiBpcCBldmVuIGlmIGdhdGV3YXkgaXMgbm90IHNldCAtIHRoZSBmaXJzdCBpcCBhZGRyZXNzIG9mIHRoZSBzeXN0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVzZSB0aGlzIGFkZHJlc3MgdG8gZmluZCB0aGUgbmFtZSBvZiB0aGUgaW50ZXJmYWNlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gT2JqZWN0LmtleXMoaW50ZXJmYWNlcykuZmluZChrZXkgPT4gaW50ZXJmYWNlc1trZXldLnNvbWUoaWZhY2UgPT4gaWZhY2UuYWRkcmVzcyA9PT0gdGhpcy5jb25maWcuaG9zdGlwKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IGludGVyZmFjZU5hbWVcblxuICAgICAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogVW5hYmxlIHRvIGRldGVybWluZSBpcCBhZGRyZXNzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIG11bHRpY2FzdCBjbGllbnQgaXMgcnVubmluZyAtIG90aGVyd2lzZSBzdGFydCBpdFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PSBcIjEyNy4wLjAuMVwiKSB7IHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIElQIGhhcyBjaGFuZ2VkIGFuZCByZWluaXRpYWxpemUgZXZlcnl0aGluZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgICAgIGlmIChvbGRIb3N0SXAgIT09IHRoaXMuY29uZmlnLmhvc3RpcCAmJiB0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogSVAgY2hhbmdlZCBmcm9tICR7b2xkSG9zdElwfSB0byAke3RoaXMuY29uZmlnLmhvc3RpcH0sIHJlaW5pdGlhbGl6aW5nIHNlcnZpY2VzLi4uYClcblxuICAgICAgICAgICAgICAgIC8vIFJlaW5pdGlhbGl6ZSBtdWx0aWNhc3QgY2xpZW50IG9uIElQIGNoYW5nZSAobXVsdGljYXN0Y2xpZW50IGlzIG9ubHkgdXNlZCBmb3IgZGlzY292ZXJ5IG9mIG90aGVyIGV4YW0gc2VydmVycylcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKSkgeyAvLyBjaGVjayBpZiBtdWx0aWNhc3QgY2xpZW50IGlzIGFjdHVhbGx5IHJ1bm5pbmdcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LnN0b3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ21haW46IE11bHRpY2FzdCBjbGllbnQgcmVpbml0aWFsaXplZCcpXG4gICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW46IEZhaWxlZCB0byByZWluaXRpYWxpemUgbXVsdGljYXN0IGNsaWVudDonLCBlKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVzdGFydCBFeHByZXNzIHNlcnZlciBvbiBJUCBjaGFuZ2VcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXIubGlzdGVuaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuY2xvc2UoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtYWluOiBFeHByZXNzIHNlcnZlciBzdG9wcGVkIGR1ZSB0byBJUCBjaGFuZ2VgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5saXN0ZW4oY29uZmlnLnNlcnZlckFwaVBvcnQsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYG1haW46IEV4cHJlc3Mgc2VydmVyIHJlc3RhcnRlZCBvbiBodHRwczovLyR7Y29uZmlnLmhvc3RpcH06JHtjb25maWcuc2VydmVyQXBpUG9ydH1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5saXN0ZW4oY29uZmlnLnNlcnZlckFwaVBvcnQsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogRXhwcmVzcyBzZXJ2ZXIgc3RhcnRlZCBvbiBodHRwczovLyR7Y29uZmlnLmhvc3RpcH06JHtjb25maWcuc2VydmVyQXBpUG9ydH1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAvLyBlbHNlIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudC5hZGRyZXNzKCkpIHsgIC8vIElmIG5vIElQIGNoYW5nZSBidXQgbXVsdGljYXN0IGNsaWVudCBpcyBub3QgcnVubmluZ1xuICAgICAgICAgICAgLy8gICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSlcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgXG4gICAgICAgICAgICAgICAgaG9zdGlwOiB0aGlzLmNvbmZpZy5ob3N0aXAsIFxuICAgICAgICAgICAgICAgIGludGVyZmFjZTogdGhpcy5jb25maWcuaW50ZXJmYWNlLFxuICAgICAgICAgICAgICAgIGF2YWlsYWJsZUludGVyZmFjZXM6IHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRJbnRlcmZhY2U6IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIGRvZXMgd2hhdCBpdCBzYXlzLi4gIGlmIG1vcmUgdGhhbiBvbmUgaW50ZXJmYWNlIGlzIGZvdW5kIHRoaXMgd2lsbCBzZXQgdGhlIHByZWZlcnJlZCBpbnRlcmZhY2VcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NldFByZWZlcnJlZEludGVyZmFjZScsIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByZWZlcnJlZEludGVyZmFjZSA9IGFyZ1xuICAgICAgICB9KVxuXG4gICAgICAgIGlwY01haW4ub24oJ3Vuc2V0UHJlZmVycmVkSW50ZXJmYWNlJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByZWZlcnJlZEludGVyZmFjZSA9IGZhbHNlXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgXG4gICAgICAgICAgICAgICAgaG9zdGlwOiB0aGlzLmNvbmZpZy5ob3N0aXAsIFxuICAgICAgICAgICAgICAgIGludGVyZmFjZTogdGhpcy5jb25maWcuaW50ZXJmYWNlLFxuICAgICAgICAgICAgICAgIGF2YWlsYWJsZUludGVyZmFjZXM6IHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRJbnRlcmZhY2U6IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEb3dubG9hZHMgdGhlIGZpbGVzIGZvciBhIHNwZWNpZmljIHN0dWRlbnQgdG8gaGlzIHdvcmtkaXJlY3RvcnkgKGFiZ2FiZSlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3N0b3JlT25lZHJpdmVGaWxlcycsIGFzeW5jIChldmVudCwgYXJncykgPT4geyBcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiZG93bmxvYWRpbmcgb25lZHJpdmUgZmlsZXMuLi5cIikgIFxuICAgICAgICAgICAgY29uc3Qgc3R1ZGVudE5hbWUgPSBhcmdzLnN0dWRlbnROYW1lXG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NUb2tlbiA9IGFyZ3MuYWNjZXNzVG9rZW5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gYXJncy5maWxlTmFtZVxuICAgICAgICAgICAgY29uc3QgZmlsZUlEID0gYXJncy5maWxlSURcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcblxuICAgICAgICAgICAgLy8gY3JlYXRlIHVzZXIgYWJnYWJlIGRpcmVjdG9yeSAgLy8gY3JlYXRlIGFyY2hpdmUgZGlyZWN0b3J5XG4gICAgICAgICAgICBsZXQgc3R1ZGVudGRpcmVjdG9yeSA9ICBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBzZXJ2ZXJuYW1lICxzdHVkZW50TmFtZSlcbiAgICAgICAgICAgIGxldCB0aW1lID0gbmV3IERhdGUobmV3IERhdGUoKS5nZXRUaW1lKCkpLnRvTG9jYWxlVGltZVN0cmluZygpOyAgLy9jb252ZXJ0IHRvIGxvY2FsZSBzdHJpbmcgb3RoZXJ3aXNlIHRoZSBmb2xkZXJuYW1lcyB3aWxsIGJlIGNyZWF0ZWQgaW4gVVRDXG4gICAgICAgICAgICBsZXQgdHN0cmluZyA9IFN0cmluZyh0aW1lKS5yZXBsYWNlKC86L2csIFwiX1wiKTtcbiAgICAgICAgICAgIGxldCBzdHVkZW50YXJjaGl2ZWRpciA9IGpvaW4oc3R1ZGVudGRpcmVjdG9yeSwgdHN0cmluZylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc3R1ZGVudGRpcmVjdG9yeSkpIHsgZnMubWtkaXJTeW5jKHN0dWRlbnRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfVxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzdHVkZW50YXJjaGl2ZWRpcikpeyBmcy5ta2RpclN5bmMoc3R1ZGVudGFyY2hpdmVkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfVxuICAgICAgICAgXG5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVSZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20vdjEuMC9tZS9kcml2ZS9pdGVtcy8ke2ZpbGVJRH0vY29udGVudGAsIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YWNjZXNzVG9rZW59YCwgIH0sXG4gICAgICAgICAgICB9KS5jYXRjaCggZXJyID0+IHtsb2cuZXJyb3IoZXJyKX0pO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVCdWZmZXIgPSBhd2FpdCBmaWxlUmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGZpbGVOYW1lKSwgQnVmZmVyLmZyb20oZmlsZUJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge2xvZy5lcnJvcihlKX1cblxuICAgICAgICAgICAgY29uc3QgcGRmRmlsZVJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vZ3JhcGgubWljcm9zb2Z0LmNvbS92MS4wL21lL2RyaXZlL2l0ZW1zLyR7ZmlsZUlEfS9jb250ZW50P2Zvcm1hdD1wZGZgLCB7XG4gICAgICAgICAgICAgICAgaGVhZGVyczogeydBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2FjY2Vzc1Rva2VufWAsICB9LFxuICAgICAgICAgICAgfSkuY2F0Y2goIGVyciA9PiB7bG9nLmVycm9yKGVycil9KTtcblxuICAgICAgICAgICAgaWYgKHBkZkZpbGVSZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBkZkZpbGVCdWZmZXIgPSBhd2FpdCBwZGZGaWxlUmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwZGZGaWxlUGF0aCA9IGpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGAke2ZpbGVOYW1lfS5wZGZgKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBkZkZpbGVQYXRoLCBCdWZmZXIuZnJvbShwZGZGaWxlQnVmZmVyKSk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBEb3dubG9hZGVkICR7ZmlsZU5hbWV9IGFuZCAke2ZpbGVOYW1lfS5wZGZgKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfSAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJ0aGVyZSB3YXMgYSBwcm9ibGVtIGRvd25sb2FkaW5nIHRoZSBmaWxlcyBhcyBwZGZcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9KVxuXG5cblxuICAgIH1cblxuICAgIGlzUGRmVXJsKHVybCkge1xuICAgICAgICBsZXQgcGRmID0gZmFsc2VcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgcGRmID0gIHVybC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXI6IGlzUGRmVXJsOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGRmXG4gICAgfVxuXG4gICAgY29weUNvbmZpZyhjb25mKSB7XG4gICAgICAgIGxldCBjb25maWdDb3B5ID0ge1xuICAgICAgICAgICAgZGV2ZWxvcG1lbnQ6IGNvbmYuZGV2ZWxvcG1lbnQsIFxuICAgICAgICAgICAgc2hvd2RldnRvb2xzOiBjb25mLnNob3dkZXZ0b29scyxcbiAgICAgICAgICAgIGJpcEludGVncmF0aW9uOiBjb25mLmJpcEludGVncmF0aW9uLFxuICAgICAgICAgICAgYmlwRGVtbzogY29uZi5iaXBEZW1vLFxuICAgICAgICAgICAgd29ya2RpcmVjdG9yeTogY29uZi53b3JrZGlyZWN0b3J5LFxuICAgICAgICAgICAgdGVtcGRpcmVjdG9yeTogY29uZi50ZW1wZGlyZWN0b3J5LFxuICAgICAgICAgICAgc2VydmVyZGlyZWN0b3J5OiBjb25mLnNlcnZlcmRpcmVjdG9yeSxcbiAgICAgICAgICAgXG4gICAgICAgICAgICBzZXJ2ZXJBcGlQb3J0OiBjb25mLnNlcnZlckFwaVBvcnQsXG4gICAgICAgICAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiBjb25mLm11bHRpY2FzdENsaWVudFBvcnQsXG4gICAgICAgICAgICBtdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0OiBjb25mLm11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQsXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbXVsdGljYXN0U2VydmVyQWRycjogY29uZi5tdWx0aWNhc3RTZXJ2ZXJBZHJyLFxuICAgICAgICAgICAgaG9zdGlwOiBjb25mLmhvc3RpcCxcbiAgICAgICAgICAgIGdhdGV3YXk6IGNvbmYuZ2F0ZXdheSxcbiAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBjb25mLmFjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgdmVyc2lvbjogY29uZi52ZXJzaW9uLFxuICAgICAgICAgICAgaW5mbzogY29uZi5pbmZvLFxuICAgICAgICAgICAgYnVpbGRmb3JXRUI6IGNvbmYuYnVpbGRmb3JXRUIsXG4gICAgICAgICAgICBleGFtbW9kZXM6IGNvbmYuZXhhbW1vZGVzXG4gICAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbmZpZ0NvcHlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFzQkEsT0FBT0EsVUFBUztBQUNoQixPQUFPLFdBQVc7QUFDbEIsU0FBUyxPQUFBQyxNQUFLLGlCQUFBQyxnQkFBZSxrQkFBa0IsYUFBYSxnQkFBZ0IsWUFBWTs7O0FDcEJ4RixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGdCQUFnQjtBQUFBLEVBQ2hCLFdBQVc7QUFBQSxFQUVYLGVBQWdCO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUNqQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUEsRUFDZixxQkFBcUI7QUFBQSxFQUNyQiwyQkFBMkI7QUFBQSxFQUUzQixxQkFBcUI7QUFBQSxFQUNyQixRQUFRO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxFQUNiLFNBQVM7QUFBQSxFQUVULFdBQVc7QUFBQSxJQUNQLEtBQUs7QUFBQSxJQUNMLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLGNBQWM7QUFBQSxFQUNsQjtBQUFBLEVBRUEsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsYUFBYTtBQUFBLEVBQ2IsTUFBTTtBQUNWO0FBQ0EsSUFBTyxpQkFBUTs7O0FDMUJmLE9BQU8sYUFBYTtBQUNwQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sZ0JBQWdCOzs7QUNIdkIsU0FBUyxVQUFBQyxlQUFjOzs7QUNBdkIsU0FBUyxjQUFjOzs7QUNBdkIsU0FBUyxvQkFBb0I7QUFFN0IsT0FBTyxZQUFZO0FBQ25CLE9BQU8sU0FBUzs7O0FDcEJoQixTQUFTLG9CQUFvQjtBQUV0QixJQUFNLG1CQUFOLGNBQStCLGFBQWE7QUFBQSxFQUUvQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFFQSxZQUFZLFFBQW9CLElBQVk7QUFDeEMsVUFBTTtBQUNOLFNBQUssU0FBUztBQUNkLFNBQUssU0FBUztBQUNkLFNBQUssV0FBVztBQUNoQixTQUFLLFlBQVksV0FBVyxLQUFLLE1BQU07QUFBQSxFQUMzQztBQUFBLEVBRU8sUUFBUTtBQUNYLFFBQUksQ0FBQyxLQUFLLFFBQVE7QUFDZCxXQUFLLFNBQVMsWUFBWSxNQUFNLEtBQUssS0FBSyxTQUFTLEdBQUcsS0FBSyxRQUFRO0FBQUEsSUFDdkU7QUFBQSxFQUNKO0FBQUEsRUFFTyxPQUFPO0FBQ1YsUUFBSSxLQUFLLFFBQVE7QUFDYixvQkFBYyxLQUFLLE1BQU07QUFDekIsV0FBSyxTQUFTO0FBQUEsSUFDbEI7QUFBQSxFQUNKO0FBQ0o7OztBREFBLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxXQUFXO0FBQ2hCLFNBQUssYUFBYSxlQUFPO0FBQ3pCLFNBQUssaUJBQWlCLGVBQU87QUFDN0IsU0FBSyxTQUFTO0FBQ2QsU0FBSyxhQUFhO0FBQ2xCLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssVUFBVTtBQUNmLFNBQUssY0FBYyxDQUFDO0FBQ3BCLFNBQUssZUFBZSxDQUFDO0FBQUEsRUFDekI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxLQUFNLFlBQVksS0FBSyxVQUFVLE1BQUksT0FBTyxRQUFNLE1BQU07QUFDcEQsU0FBSyxTQUFTLGFBQWEsTUFBTTtBQUNqQyxTQUFLLGFBQWE7QUFBQSxNQUNkO0FBQUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsSUFBSSxRQUFRLFFBQVEsT0FBTyxXQUFXO0FBQUEsTUFDdEMsSUFBSSxlQUFPO0FBQUEsTUFDWCxhQUFhLFVBQVUsT0FBTyxXQUFXLENBQUM7QUFBQSxNQUMxQztBQUFBLE1BQ0EsU0FBUyxlQUFPO0FBQUEsSUFDcEI7QUFFQSxTQUFLLE9BQU8sS0FBSyxLQUFLLFVBQVMsV0FBWSxNQUFNO0FBQzdDLFdBQUssT0FBTyxhQUFhLElBQUk7QUFDN0IsV0FBSyxPQUFPLGdCQUFnQixHQUFHO0FBQy9CLFdBQUssT0FBTyxPQUFPLEdBQUc7QUFDdEIsV0FBSyxPQUFPLGNBQWMsS0FBSyxjQUFjO0FBSTdDLFdBQUssb0JBQW9CLElBQUksaUJBQWlCLEtBQUsscUJBQXFCLEtBQUssSUFBSSxHQUFHLEdBQUk7QUFDeEYsV0FBSyxrQkFBa0IsTUFBTTtBQUc3QixVQUFJLEtBQUssNkRBQTZELGVBQU8sTUFBTSxJQUFJLEtBQUssT0FBTyxRQUFRLEVBQUUsSUFBSSxFQUFFO0FBQUEsSUFDdkgsQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHVCQUF3QjtBQUNwQixTQUFLLFdBQVcsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUMvQyxRQUFJLFVBQVU7QUFBQSxNQUNWLFlBQVksS0FBSyxXQUFXO0FBQUEsTUFDNUIsV0FBVyxLQUFLLFdBQVc7QUFBQSxNQUMzQixJQUFJLEtBQUssV0FBVztBQUFBLE1BQ3BCLElBQUksS0FBSyxXQUFXO0FBQUEsTUFDcEIsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNyQixTQUFTLGVBQU87QUFBQSxJQUNwQjtBQUNBLFVBQU0sa0JBQWtCLElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxPQUFPLENBQUM7QUFDL0QsU0FBSyxPQUFPLEtBQUssaUJBQWlCLEdBQUcsZ0JBQWdCLFFBQVEsS0FBSyxZQUFZLEtBQUssY0FBYztBQUNqRyxTQUFLLE9BQU8sS0FBSyxpQkFBaUIsR0FBRyxnQkFBZ0IsUUFBUSxlQUFPLDJCQUEyQixLQUFLLGNBQWM7QUFBQSxFQUN0SDtBQUNKO0FBRUEsSUFBTywwQkFBUTs7O0FFL0VmLE9BQU8sV0FBVztBQUVsQixPQUFPQyxVQUFTO0FBT2hCLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxPQUFPLGVBQU87QUFDbkIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyxpQkFBaUIsQ0FBQztBQUN2QixTQUFLLHdCQUF3QjtBQUFBLEVBQ2pDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLEtBQU0sU0FBUztBQUNYLFNBQUssVUFBVTtBQUNmLFFBQUk7QUFDQSxXQUFLLFNBQVMsTUFBTSxhQUFhLE1BQU07QUFDdkMsV0FBSyxPQUFPLEtBQUssS0FBSyxNQUFNLFdBQVcsTUFBTTtBQUN6QyxhQUFLLE9BQU8sYUFBYSxJQUFJO0FBQzdCLGFBQUssT0FBTyxnQkFBZ0IsR0FBRztBQUMvQixZQUFJLEtBQUssU0FBUztBQUFFLGVBQUssT0FBTyxjQUFjLEtBQUssY0FBYztBQUFBLFFBQUU7QUFDbkUsWUFBSSxDQUFDLEtBQUssU0FBUztBQUFDLFVBQUFDLEtBQUksS0FBSyw4RkFBOEY7QUFBQSxRQUFDO0FBQzVILFFBQUFBLEtBQUksS0FBSyw2REFBNkQsZUFBTyxNQUFNLElBQUksS0FBSyxPQUFPLFFBQVEsRUFBRSxJQUFJLEVBQUU7QUFBQSxNQUN2SCxDQUFDO0FBQUEsSUFDTCxTQUNPLEtBQUk7QUFBQyxNQUFBQSxLQUFJLE1BQU0sR0FBRztBQUFBLElBQUM7QUFFMUIsU0FBSyxPQUFPLEdBQUcsV0FBVyxDQUFDLFNBQVMsVUFBVTtBQUFFLFdBQUssZ0JBQWdCLFNBQVMsS0FBSztBQUFBLElBQUUsQ0FBQztBQUd0RixTQUFLLHdCQUF3QixJQUFJLGlCQUFpQixLQUFLLHFCQUFxQixLQUFLLElBQUksR0FBRyxHQUFJO0FBQzVGLFNBQUssc0JBQXNCLE1BQU07QUFBQSxFQUdyQztBQUFBLEVBRUEsTUFBTSxPQUFRO0FBQ1YsUUFBSTtBQUNBLFdBQUssT0FBTyxlQUFlLEtBQUssY0FBYztBQUFBLElBQ2xELFNBQVEsR0FBRTtBQUFBLElBQUM7QUFDWCxTQUFLLE9BQU8sTUFBTTtBQUNsQixRQUFJLEtBQUssc0JBQXVCLE1BQUssc0JBQXNCLEtBQUs7QUFDaEUsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLGdCQUFpQixTQUFTLE9BQU87QUFDN0IsVUFBTSxhQUFhLEtBQUssTUFBTSxPQUFPLE9BQU8sQ0FBQztBQUM3QyxlQUFXLFdBQVcsTUFBTTtBQUM1QixlQUFXLGFBQWEsTUFBTTtBQUM5QixlQUFXLGFBQVksb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFFMUMsUUFBSSxLQUFLLGtCQUFrQixVQUFVLEdBQUc7QUFDcEMsTUFBQUEsS0FBSSxLQUFLLGdFQUFnRSxXQUFXLFVBQVUsaUJBQWlCO0FBQy9HLFdBQUssZUFBZSxLQUFLLFVBQVU7QUFBQSxJQUN2QztBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGtCQUFtQixLQUFLO0FBQ3BCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxlQUFlLFFBQVEsS0FBSztBQUNqRCxVQUFJLEtBQUssZUFBZSxDQUFDLEVBQUUsT0FBTyxJQUFJLElBQUk7QUFDdEMsYUFBSyxlQUFlLENBQUMsRUFBRSxZQUFZLElBQUk7QUFDdkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKO0FBQ0EsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLHVCQUF3QjtBQUNwQixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssZUFBZSxRQUFRLEtBQUs7QUFDakQsWUFBTSxPQUFNLG9CQUFJLEtBQUssR0FBRSxRQUFRO0FBQy9CLFVBQUksTUFBTSxPQUFRLEtBQUssZUFBZSxDQUFDLEVBQUUsV0FBVztBQUNoRCxRQUFBQSxLQUFJLEtBQUsscUVBQXFFLEtBQUssZUFBZSxDQUFDLEVBQUUsVUFBVSxhQUFhO0FBQzVILGFBQUssZUFBZSxPQUFPLEdBQUcsQ0FBQztBQUFBLE1BQ25DO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSjtBQUVBLElBQU8sMEJBQVEsSUFBSSxnQkFBZ0I7OztBSDdGbkMsT0FBT0MsYUFBWTtBQUVuQixPQUFPQyxXQUFVOzs7QUl0QmpCLFNBQVMsa0JBQWtCOzs7QUNEM0I7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFFWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVTtBQUFBLElBQ1YsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVM7QUFBQSxJQUNULFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUN6UkE7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFDWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBWTtBQUFBLElBQ1osYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVU7QUFBQSxJQUNWLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUduQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUZuUkEsSUFBTSxPQUFPLFdBQVc7QUFBQSxFQUNwQixRQUFRO0FBQUEsRUFDUixnQkFBZ0I7QUFBQSxFQUNoQixRQUFRO0FBQUEsRUFDUixVQUFVO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBQSxFQUNBO0FBQ0osQ0FBQztBQUVILElBQU8sa0JBQVE7OztBSlNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sV0FBVzs7O0FPNUJsQixTQUFTLFVBQVUsK0JBQStCO0FBRzNDLElBQU0sYUFBYTtBQUFBLEVBQ3hCLE1BQU07QUFBQSxJQUNKLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLGFBQWE7QUFBQSxJQUNiLHVCQUF1QjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsRUFDakI7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNKLGVBQWU7QUFBQSxNQUNYLGdCQUFnQixDQUFDLE9BQWlCLFNBQWlCLGdCQUF5QjtBQUN4RSxZQUFJLGFBQWE7QUFDYjtBQUFBLFFBQ0o7QUFDQSxnQkFBUSxPQUFPO0FBQUEsVUFDWCxLQUFLLFNBQVM7QUFDVixvQkFBUSxNQUFNLE9BQU87QUFDckI7QUFBQSxVQUNKLEtBQUssU0FBUztBQUNWLG9CQUFRLEtBQUssT0FBTztBQUNwQjtBQUFBLFVBQ0osS0FBSyxTQUFTO0FBQ1Ysb0JBQVEsTUFBTSxPQUFPO0FBQ3JCO0FBQUEsVUFDSixLQUFLLFNBQVM7QUFDVixvQkFBUSxLQUFLLE9BQU87QUFDcEI7QUFBQSxVQUNKO0FBQ0k7QUFBQSxRQUNSO0FBQUEsTUFDSjtBQUFBLE1BQ0EsVUFBVSxTQUFTO0FBQUEsSUFDdkI7QUFBQSxFQUNKO0FBQ0Y7QUFFTyxJQUFNLGVBQWUsSUFBSSx3QkFBd0IsVUFBVTs7O0FQWGxFLE9BQU9DLFVBQVM7OztBUVpoQixTQUFTLEtBQUssZUFBZSxRQUFRLGNBQWM7QUFDbkQsU0FBUyxZQUFZO0FBQ3JCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUM5QixPQUFPQyxVQUFTO0FBRWhCLElBQU0sWUFBWSxZQUFZO0FBSTlCLElBQU0sZ0JBQU4sTUFBb0I7QUFBQSxFQUNoQixjQUFlO0FBQ2IsU0FBSyxhQUFhO0FBQ2xCLFNBQUssYUFBYTtBQUNsQixTQUFLLFNBQVM7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGtCQUFrQjtBQUFBLEVBR3pCO0FBQUEsRUFFQSxLQUFNLElBQUlDLFNBQVE7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVNBO0FBQUEsRUFDbEI7QUFBQSxFQUtBLGtCQUFrQixTQUFTO0FBQ3ZCLFNBQUssWUFBWSxJQUFJLGNBQWM7QUFBQSxNQUMvQixPQUFPO0FBQUEsTUFDUCxNQUFNLEtBQUssV0FBVyw2QkFBNkI7QUFBQSxNQUNuRCxRQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxRQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixhQUFZO0FBQUEsTUFDWixpQkFBaUI7QUFBQTtBQUFBLE1BRWpCLGFBQWE7QUFBQTtBQUFBO0FBQUEsTUFHYixNQUFNO0FBQUE7QUFBQSxJQUVWLENBQUM7QUFFRCxRQUFJLFNBQVE7QUFBSSxXQUFLLFVBQVUsUUFBUSxtR0FBbUc7QUFBQSxJQUFJLE9BQ3pJO0FBQVcsV0FBSyxVQUFVLFFBQVEscUdBQXFHO0FBQUEsSUFBSTtBQUdoSixTQUFLLFVBQVUsWUFBWSxLQUFLLG1CQUFtQixNQUFNO0FBQ3JELFVBQUksS0FBSyxhQUFhLENBQUMsS0FBSyxVQUFVLFVBQVUsR0FBRztBQUMvQyxhQUFLLFVBQVUsS0FBSztBQUFBLE1BQ3hCO0FBQUEsSUFDSixDQUFDO0FBRUQsU0FBSyxVQUFVLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLFFBQVE7QUFDMUQsTUFBQUQsS0FBSSxLQUFLLGNBQWM7QUFDdkIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFBQSxJQUNoQixDQUFDO0FBQ0QsU0FBSyxVQUFVLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDM0QsTUFBQUEsS0FBSSxLQUFLLGVBQWU7QUFDeEIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFBQSxJQUNoQixDQUFDO0FBRUEsU0FBSyxVQUFVLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxRQUFRO0FBQ3pELE1BQUFBLEtBQUksS0FBSyxZQUFZO0FBQ3JCLE1BQUFBLEtBQUksS0FBSyxHQUFHO0FBQ1osWUFBTSxlQUFlO0FBQUEsSUFDekIsQ0FBQztBQUdBLFNBQUssVUFBVSxZQUFZLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQzFELE1BQUFBLEtBQUksS0FBSyxnQkFBZ0I7QUFDekIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFDWixhQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsSUFDNUIsQ0FBQztBQUVELFNBQUssVUFBVSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxRQUFRO0FBQzNELE1BQUFBLEtBQUksS0FBSyxtQkFBbUIsR0FBRztBQUUvQixVQUFJLElBQUksV0FBVyxtQkFBbUIsR0FBRztBQUNyQyxjQUFNLGVBQWU7QUFDckIsY0FBTSxTQUFTO0FBRWYsY0FBTSxRQUFRLElBQUksVUFBVSxPQUFPLE1BQU07QUFHekMsUUFBQUEsS0FBSSxLQUFLLGlCQUFpQjtBQUMxQixRQUFBQSxLQUFJLEtBQUssS0FBSztBQUNkLGFBQUssV0FBVyxZQUFZLEtBQUssWUFBWSxLQUFLO0FBQ2xELGFBQUssVUFBVSxNQUFNO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUVQO0FBQUEsRUFnQkEsZUFBZTtBQUNYLFVBQU0saUJBQWlCLE9BQU8sa0JBQWtCO0FBQ2hELFVBQU0sRUFBRSxPQUFPLE9BQU8sSUFBSSxFQUFFLE9BQU8sS0FBSyxRQUFRLElBQUk7QUFDcEQsVUFBTSxhQUFhLGNBQWMsSUFBSSxJQUFJLEtBQUssWUFBWSxHQUFHLENBQUM7QUFFOUQsU0FBSyxhQUFhLElBQUksY0FBYztBQUFBLE1BQ2hDLE9BQU87QUFBQSxNQUNQLGlCQUFpQjtBQUFBLE1BQ2pCLE1BQU07QUFBQSxNQUNOLE1BQU0sS0FBSyxXQUFXLDZCQUE2QjtBQUFBLE1BQ25ELFFBQVE7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLE1BQ0EsVUFBVTtBQUFBLE1BQ1YsV0FBVztBQUFBLE1BQ1gsZ0JBQWdCO0FBQUEsUUFDWixTQUFTLDZFQUNILEtBQUssUUFBUSxZQUFZLEtBQUssS0FBSyw0RUFBNEMsc0JBQThFLENBQUMsSUFDOUosS0FBSyxXQUFXLHdCQUF3QjtBQUFBLFFBQzlDLFlBQVk7QUFBQSxRQUNaLFlBQVk7QUFBQSxNQUNoQjtBQUFBLElBQ0osQ0FBQztBQUdELFNBQUssV0FBVyxZQUFZLEtBQUssbUJBQW1CLE1BQU07QUFDdEQsTUFBQUEsS0FBSSxLQUFLLGdFQUFnRTtBQUN6RSxVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDakQsYUFBSyxXQUFXLEtBQUs7QUFDckIsYUFBSyxXQUFXLFFBQVE7QUFBQSxNQUM1QjtBQUFBLElBQ0osQ0FBQztBQUVELFFBQUksSUFBSSxjQUFjLFFBQVEsSUFBSSxPQUFPLEdBQUc7QUFDeEMsWUFBTSxXQUFXLEtBQUssV0FBVyx3QkFBd0I7QUFDekQsTUFBQUEsS0FBSSxLQUFLLCtDQUErQyxRQUFRLEVBQUU7QUFDbEUsV0FBSyxXQUFXLFdBQVc7QUFDM0IsV0FBSyxXQUFXLFNBQVMsUUFBUTtBQUFBLElBQ3JDLE9BQU87QUFDSCxZQUFNLE1BQU07QUFDWixNQUFBQSxLQUFJLEtBQUssOENBQThDLEdBQUcsRUFBRTtBQUM1RCxXQUFLLFdBQVcsV0FBVztBQUMzQixXQUFLLFdBQVcsUUFBUSxHQUFHO0FBQUEsSUFDL0I7QUFFQSxRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsU0FBSyxXQUFXLFlBQVksUUFBUSx5QkFBeUIsQ0FBQyxTQUFTLGFBQWE7QUFDaEYsVUFBSSxFQUFFLFVBQVUsYUFBYSxzQkFBc0Isb0JBQW9CLFVBQVUsSUFBSTtBQUNyRixlQUFTLENBQUM7QUFBQSxJQUNkLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sV0FBVyxrQkFBa0IsY0FBYyxnQkFBZ0I7QUFDL0csTUFBQUEsS0FBSSxLQUFLLHVEQUF1RCxTQUFTLEtBQUssZ0JBQWdCLGFBQWEsWUFBWSxFQUFFO0FBRXpILFVBQUksS0FBSyxjQUFjLENBQUMsS0FBSyxXQUFXLFVBQVUsR0FBRztBQUNqRCxRQUFBQSxLQUFJLEtBQUssa0VBQWtFO0FBQzNFLGFBQUssV0FBVyxLQUFLO0FBQ3JCLGFBQUssV0FBVyxRQUFRO0FBQUEsTUFDNUI7QUFBQSxJQUNKLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sUUFBUTtBQUM1RCxZQUFNLGVBQWU7QUFBQSxJQUN6QixDQUFDO0FBRUQsU0FBSyxXQUFXLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxRQUFRO0FBQ3pELFlBQU0sZUFBZTtBQUFBLElBQ3pCLENBQUM7QUFFRCxTQUFLLFdBQVcsWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLElBQUksTUFBTTtBQUMxRCxhQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsSUFDNUIsQ0FBQztBQUdELFNBQUssV0FBVyxHQUFHLFNBQVMsT0FBUSxNQUFNO0FBQ3RDLFVBQUksQ0FBQyxLQUFLLE9BQU8sZUFBZSxLQUFLLFlBQVksWUFBWSxPQUFPLEVBQUUsU0FBUyxXQUFXLEdBQUc7QUFFekYsUUFBQUEsS0FBSSxLQUFLLDJEQUEyRDtBQUFHLFVBQUUsZUFBZTtBQUN4RixlQUFPLG1CQUFtQixLQUFLLFlBQVk7QUFBQSxVQUN2QyxNQUFNO0FBQUEsVUFDTixTQUFTLENBQUMsSUFBSTtBQUFBO0FBQUEsVUFDZCxXQUFXO0FBQUEsVUFDWCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsUUFDYixDQUFDO0FBQ0Q7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJLEtBQUs7QUFDVCxnQkFBUSxLQUFLLENBQUM7QUFBQSxNQUNsQjtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHFCQUFxQjtBQUNqQixVQUFNLGFBQWEsY0FBYyxJQUFJLElBQUksS0FBSyxZQUFZLEdBQUcsQ0FBQztBQUM5RCxTQUFLLGFBQWEsSUFBSSxjQUFjO0FBQUEsTUFDaEMsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsTUFBTSxLQUFLLFdBQVcsNkJBQTZCO0FBQUEsTUFDbkQsZ0JBQWdCO0FBQUEsUUFDWixTQUFTLDZFQUNILEtBQUssUUFBUSxZQUFZLEtBQUssS0FBSyw0RUFBNEMsc0JBQThFLENBQUMsSUFDOUosS0FBSyxXQUFXLHdCQUF3QjtBQUFBLE1BQ2xEO0FBQUEsSUFDSixDQUFDO0FBRUQsUUFBSSxNQUFNO0FBQ1YsU0FBSyxXQUFXLFFBQVEsR0FBRztBQUMzQixRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsU0FBSyxXQUFXLFlBQVksS0FBSyxtQkFBbUIsTUFBTTtBQUN0RCxVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDakQsYUFBSyxXQUFXLFdBQVc7QUFDM0IsYUFBSyxXQUFXLGVBQWUsS0FBSztBQUNwQyxhQUFLLFdBQVcsS0FBSztBQUNyQixhQUFLLFdBQVcsUUFBUTtBQUFBLE1BQzVCO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTDtBQUNKO0FBRUEsSUFBTyx3QkFBUSxJQUFJLGNBQWM7OztBUnhPakMsT0FBTyxlQUFlO0FBR3RCLFNBQVMsT0FBQUUsWUFBVztBQWxCcEIsSUFBTSxTQUFTLE9BQU87QUFPdEIsSUFBTSxFQUFFLEVBQUUsSUFBSSxnQkFBSztBQVNuQixJQUFJLGtCQUFrQjtBQUd0QixJQUFNQyxhQUFZLFlBQVk7QUFDOUIsSUFBTSxNQUFNLEdBQUc7QUFTZixPQUFPLElBQUksVUFBVSxDQUFDLEtBQUssUUFBUTtBQUMvQixRQUFNLGVBQWUscUJBQXFCO0FBQzFDLFFBQU0sZ0JBQWdCLGdCQUFnQixPQUFPLE9BQU8sS0FBSyxjQUFjLE9BQU8sQ0FBQyxDQUFDO0FBQ2hGLE1BQUksT0FBTyxnQkFBZ0IsY0FBYyxFQUFFLFVBQVUsS0FBSyxDQUFDO0FBQzNELGlCQUFPLGVBQWU7QUFFdEIsUUFBTSxnQkFBZ0I7QUFBQSxJQUNsQixXQUFXLFdBQVcsS0FBSztBQUFBLElBQzNCLGVBQWU7QUFBQSxJQUNmLGNBQWMsV0FBVyxLQUFLO0FBQUEsSUFDOUIsZUFBZTtBQUFBLElBQ2YsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBLElBQ1AsZ0JBQWdCO0FBQUEsSUFDaEIsdUJBQXVCO0FBQUEsRUFDM0I7QUFDQSxRQUFNLFVBQVUsa0VBQWtFLEdBQUcsVUFBVSxhQUFhLENBQUM7QUFDN0csTUFBSSxTQUFTLE9BQU87QUFDeEIsQ0FBQztBQU9ELE9BQU8sSUFBSSxXQUFXLE9BQU8sS0FBSyxRQUFRO0FBQ3RDLFFBQU0sT0FBTyxJQUFJLE1BQU07QUFDdkIsUUFBTSxlQUFnQixlQUFPO0FBQzdCLE1BQUk7QUFDQSxVQUFNLFdBQVcsTUFBTSxNQUFNLEtBQUssOERBQThELEdBQUcsVUFBVTtBQUFBLE1BQ3pHLFdBQVcsV0FBVyxLQUFLO0FBQUEsTUFDM0IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1A7QUFBQSxNQUNBLGNBQWMsV0FBVyxLQUFLO0FBQUEsTUFDOUIsZUFBZTtBQUFBLElBQ2YsQ0FBQyxHQUFHO0FBQUEsTUFDSixTQUFTO0FBQUEsUUFDTCxnQkFBZ0I7QUFBQSxRQUNoQixVQUFVO0FBQUEsTUFDZDtBQUFBLElBQ0osQ0FBQztBQUVELG1CQUFPLGNBQWMsU0FBUyxLQUFLO0FBRW5DLFFBQUksT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWdCWCxRQUFJLEtBQUssSUFBSTtBQUFBLEVBQ2pCLFNBQVMsT0FBTztBQUNaLFlBQVEsTUFBTSxNQUFNLFNBQVMsSUFBSTtBQUNqQyxRQUFJLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFVRyxNQUFNLFNBQVMsS0FBSyxpQkFBaUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUtuRCxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssSUFBSTtBQUFBLEVBQzdCO0FBQ0YsQ0FBQztBQWFGLE9BQU8sS0FBSywrQkFBK0IsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFFeEUsTUFBSSxDQUFDLHFCQUFxQixLQUFLLEdBQUcsRUFBRztBQUVyQyxRQUFNLE1BQU0sSUFBSSxLQUFLO0FBQ3JCLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFFdkIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFLakQsTUFBSSxNQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFFLEdBQUksSUFBSSxHQUFJO0FBQ3RELE1BQUksZUFBTyxhQUFZO0FBQUUsVUFBTTtBQUFBLEVBQU87QUFHdEMsTUFBSSxVQUFVO0FBQ1YsV0FBTyxJQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFDO0FBQUEsRUFDNUY7QUFFQSxhQUFXLFFBQVEsd0JBQWdCLGdCQUFnQjtBQUMvQyxRQUFJLGNBQWMsS0FBSyxZQUFZO0FBQy9CLGFBQU8sSUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx5QkFBeUIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQy9GO0FBQUEsRUFDSDtBQUVELEVBQUFDLEtBQUksS0FBSyxrREFBa0QsVUFBVTtBQUNyRSxNQUFJLE1BQU0sSUFBSSx3QkFBZ0I7QUFFOUIsTUFBSSxDQUFDLElBQUksT0FBTyxRQUFPO0FBQ25CLFFBQUksS0FBSyxZQUFZLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxFQUM1QyxPQUNLO0FBQ0QsUUFBSSxLQUFLLFlBQVksS0FBSyxJQUFJLE9BQU8sUUFBUSxLQUFLLEtBQUs7QUFBQSxFQUMzRDtBQUVBLGlCQUFPLGVBQWUsVUFBVSxJQUFFO0FBRWxDLE1BQUksb0JBQW9CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFVBQVU7QUFFbEUsTUFBSTtBQUNBLFVBQU0sR0FBRyxTQUFTLE1BQU0sbUJBQW1CLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxFQUNsRSxTQUFTLEtBQUs7QUFBQSxFQUVkO0FBQ0EsTUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBQztBQUV4RixDQUFDO0FBU0EsT0FBTyxJQUFJLDRDQUE0QyxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQzlFLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBRWpELE1BQUksWUFBWSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBRTVFLGFBQVMsa0JBQWtCLEtBQUs7QUFFaEMsYUFBUyxPQUFPLE1BQU07QUFFdEIsV0FBTyxlQUFPLGVBQWUsVUFBVTtBQUN2QyxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHVCQUF1QixHQUFHLFFBQVEsVUFBUyxDQUFDO0FBQUEsRUFHeEY7QUFDSixDQUFDO0FBUUEsT0FBTyxJQUFJLHFDQUFxQyxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3ZFLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsTUFBSSxTQUFTLElBQUksT0FBTztBQUN4QixNQUFJLENBQUMsUUFBTztBQUFFLGFBQVM7QUFBQSxFQUFFO0FBQ3pCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUVqRCxNQUFJLFVBQVU7QUFDVixRQUFJLFdBQVcsU0FBUyxXQUFXLFVBQVM7QUFDNUMsYUFBTyxJQUFJLEtBQU07QUFBQSxRQUNiLFFBQVE7QUFBQSxRQUNSLFNBQVMsRUFBRSxtQkFBbUI7QUFBQSxRQUM5QixRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsVUFDTixLQUFLLFNBQVMsV0FBVztBQUFBLFVBQ3pCLGFBQWEsU0FBUyxXQUFXO0FBQUEsVUFDakMsVUFBVSxTQUFTLFdBQVc7QUFBQSxRQUM5QjtBQUFBLE1BQ0osQ0FBRTtBQUFBLElBQUMsT0FDRTtBQUFFLGFBQU8sSUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxpQkFBaUIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQUU7QUFBQSxFQUNoRyxPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLEVBQ2pGO0FBQ0osQ0FBQztBQU1ELE9BQU8sSUFBSSxlQUFlLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDaEQsTUFBSSxhQUFhLENBQUM7QUFDbEIsU0FBTyxPQUFPLGVBQU8sY0FBYyxFQUFFLFFBQVMsQ0FBQUMsWUFBVTtBQUNwRCxlQUFXLEtBQUssRUFBQyxZQUFZQSxRQUFPLFdBQVcsWUFBWSxJQUFJQSxRQUFPLFdBQVcsSUFBSSxVQUFVQSxRQUFPLFdBQVcsSUFBSSxXQUFXLE1BQU0sVUFBVUEsUUFBTyxXQUFXLFVBQVUsU0FBU0EsUUFBTyxXQUFXLFFBQU8sQ0FBQztBQUFBLEVBQ25OLENBQUM7QUFDRCxNQUFJLEtBQUssRUFBQyxZQUF1QixRQUFRLFVBQVMsQ0FBQztBQUN2RCxDQUFDO0FBS0EsT0FBTyxJQUFJLFNBQVMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzQyxNQUFJLEtBQUssTUFBTTtBQUNuQixDQUFDO0FBR0QsT0FBTyxLQUFLLFNBQVMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzQyxNQUFJLEtBQUssRUFBRSxRQUFRLFVBQVMsQ0FBQztBQUNqQyxDQUFDO0FBS0QsSUFBSSxjQUFjLENBQUM7QUFDbkIsU0FBUyxJQUFJLEdBQUcsSUFBRSxJQUFJLEtBQUs7QUFDdkIsTUFBSSxhQUFhO0FBQUEsSUFDYixZQUFZLFFBQVNDLFFBQU8sWUFBWSxDQUFDLEVBQUUsU0FBUyxLQUFLLENBQUc7QUFBQSxJQUM1RCxPQUFPLFFBQVFBLFFBQU8sV0FBVyxDQUFDO0FBQUEsSUFDbEMsSUFBSTtBQUFBLElBQ0osVUFBVTtBQUFBLElBQ1YsVUFBVTtBQUFBLElBQ1YsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsWUFBVyxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUFBLElBQzlCLGFBQWE7QUFBQTtBQUFBLElBQ2IsVUFBVztBQUFBLElBQ1gsS0FBSztBQUFBLElBQ0wsWUFBWTtBQUFBLElBQ1osVUFBUztBQUFBLElBQ1QsUUFBUyxDQUFDO0FBQUEsRUFDZDtBQUNBLGNBQVksS0FBSyxVQUFVO0FBQy9CO0FBa0JDLE9BQU8sSUFBSSx3RkFBd0YsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDaEksUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsSUFBSSxPQUFPO0FBQzVCLFFBQU0sTUFBTSxJQUFJLE9BQU87QUFDdkIsUUFBTSxVQUFVLElBQUksT0FBTztBQUMzQixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sUUFBUSxRQUFRQSxRQUFPLFdBQVcsQ0FBQztBQUN6QyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxXQUFXLElBQUksT0FBTztBQUM1QixRQUFNLFlBQVksSUFBSSxPQUFPO0FBRTdCLEVBQUFILEtBQUksS0FBSyw2Q0FBNEMsT0FBTztBQUU1RCxNQUFJLFdBQVcsZUFBTyxRQUFRLE1BQU0sR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLEdBQ25ELGlCQUFpQixTQUFTLEtBQUssR0FBRztBQUNsQyxNQUFJLFdBQVcsUUFBUSxNQUFNLEdBQUcsRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUM1QyxpQkFBaUIsU0FBUyxLQUFLLEdBQUc7QUFJbEMsTUFBSSxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsa0JBQWtCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFHO0FBQ3hHLE1BQUksR0FBRyxjQUFjLE9BQU8sZ0JBQWlCO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLHlCQUF5QixHQUFHLFFBQVEsU0FBUyxTQUFTLGVBQU8sU0FBUyxhQUFhLGVBQU8sS0FBSSxDQUFFO0FBQUEsRUFBRztBQUVoTSxNQUFJLFNBQVMsYUFBYSxjQUFjLGFBQWEsU0FBUTtBQUN6RCxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUscUJBQXFCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUMxRjtBQUNBLE1BQUk7QUFDQSxRQUFJLE9BQU8sU0FBUyxXQUFXLEtBQUs7QUFDaEMsVUFBSSxtQkFBbUIsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLGVBQWUsVUFBVTtBQUk3RixVQUFJLENBQUMsa0JBQWtCO0FBQ25CLFFBQUFBLEtBQUksS0FBSyxnREFBZ0QsVUFBVSxHQUFHO0FBSXRFLFlBQUksUUFBUTtBQUNaLFlBQUksU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxRQUFRLE9BQU8sU0FBUyxVQUFVLEdBQUc7QUFBRSxrQkFBUTtBQUFBLFFBQUssV0FDdkgsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxRQUFRLE9BQU8sU0FBUyxVQUFVLEdBQUc7QUFBRSxrQkFBUTtBQUFBLFFBQU0sT0FDakk7QUFDRCxrQkFBUTtBQUNULG1CQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLE9BQU8sTUFBTSxLQUFLLFVBQVU7QUFBQSxRQUV2RztBQUVBLGNBQU0sU0FBUztBQUFBO0FBQUEsVUFDWDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsWUFBVyxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUFBLFVBQzlCLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLFVBQVM7QUFBQSxVQUNULGFBQWE7QUFBQSxVQUNiO0FBQUE7QUFBQSxVQUNBLFFBQVEsRUFBRSxPQUFPLFNBQVMsSUFBRztBQUFBO0FBQUE7QUFBQSxRQUVqQztBQUVBLFlBQUksZ0JBQWVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQWEsVUFBVTtBQUc5RixZQUFJO0FBQ0EsZ0JBQU0sR0FBRyxTQUFTLE9BQU8sYUFBYTtBQUt0QyxnQkFBTSxZQUFZQSxNQUFLLFFBQVEsYUFBYTtBQUM1QyxnQkFBTSxnQkFBZ0JBLE1BQUssU0FBUyxhQUFhO0FBQ2pELGdCQUFNLGVBQWUsTUFBTSxHQUFHLFNBQVMsUUFBUSxXQUFXLEVBQUUsZUFBZSxLQUFLLENBQUMsR0FDNUQsT0FBTyxZQUFVLE9BQU8sWUFBWSxDQUFDLEVBQ3JDLElBQUksWUFBVSxPQUFPLElBQUk7QUFHOUMsY0FBSSxDQUFDLFlBQVksU0FBUyxhQUFhLEdBQUc7QUFFdEMsa0JBQU0sY0FBYyxZQUFZLEtBQUssU0FBTyxJQUFJLFlBQVksTUFBTSxjQUFjLFlBQVksQ0FBQztBQUM3RixnQkFBSSxhQUFhO0FBQ2Isb0JBQU0sVUFBVUEsTUFBSyxLQUFLLFdBQVcsV0FBVztBQUNoRCxvQkFBTSxVQUFVQSxNQUFLLEtBQUssV0FBVyxVQUFVLFdBQVcsRUFBRTtBQUM1RCxvQkFBTSxHQUFHLFNBQVMsT0FBTyxTQUFTLE9BQU87QUFDekMsY0FBQUQsS0FBSSxLQUFLLHNDQUFzQyxPQUFPLE9BQU8sT0FBTyxzREFBc0Q7QUFBQSxZQUM5SDtBQUFBLFVBQ0osT0FDSztBQUNELFlBQUFBLEtBQUksS0FBSywrREFBK0QsYUFBYSxFQUFFO0FBQUEsVUFDM0Y7QUFBQSxRQUNKLFNBQVMsS0FBSztBQUVWLGNBQUk7QUFDQSxrQkFBTSxHQUFHLFNBQVMsTUFBTSxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDMUQsWUFBQUEsS0FBSSxLQUFLLHNDQUFzQyxhQUFhLEVBQUU7QUFBQSxVQUNsRSxTQUFTLFVBQVU7QUFDZixZQUFBQSxLQUFJLE1BQU0sdURBQXVELFFBQVEsRUFBRTtBQUFBLFVBQy9FO0FBQUEsUUFDSjtBQUVBLFlBQUk7QUFDQSxnQkFBTSxHQUFHLFNBQVMsTUFBTSxlQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQ3JFLFNBQVMsS0FBSztBQUFBLFFBRWQ7QUFFQSxpQkFBUyxZQUFZLEtBQUssTUFBTTtBQUNoQyxlQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsb0JBQW9CLEdBQUcsUUFBUSxXQUFXLE1BQVksQ0FBQztBQUFBLE1BQ3hHLE9BQ0s7QUFFRCxZQUFJLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFDN0IsWUFBSSxNQUFNLE1BQVEsaUJBQWlCLFdBQVc7QUFDMUMsMkJBQWlCLFlBQVk7QUFDN0IsVUFBQUEsS0FBSSxLQUFLLCtDQUErQztBQUd4RCxnQ0FBYyxXQUFXLFlBQVksS0FBSyxlQUFlLGdCQUFnQjtBQUN6RSxpQkFBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLG9CQUFvQixHQUFHLFFBQVEsV0FBVyxPQUFPLGlCQUFpQixNQUFLLENBQUM7QUFBQSxRQUN6SCxPQUNLO0FBQ0QsaUJBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSwyQkFBMkIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLFFBQy9GO0FBQUEsTUFDSjtBQUFBLElBQ0osT0FDSztBQUNELGFBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQ3RGO0FBQUEsRUFDSixTQUNPLEtBQUk7QUFDUCxJQUFBQSxLQUFJLE1BQU0sNkJBQTZCLEdBQUcsRUFBRTtBQUM1QyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLDRCQUE0QixRQUFRLFFBQU8sQ0FBQztBQUFBLEVBQzNGO0FBQ0osQ0FBQztBQXlCQSxPQUFPLEtBQUssNERBQTRELFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDL0YsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLGVBQWUsSUFBSSxPQUFPO0FBQ2hDLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLGlCQUFpQixPQUFNO0FBQ3ZCLGVBQVMsV0FBVyxTQUFTLGFBQVk7QUFDckMsZ0JBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsZ0JBQVEsT0FBTyxPQUFPLElBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0osT0FDSztBQUNELFVBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFVBQUksU0FBUztBQUNULGdCQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLGdCQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsTUFDOUI7QUFBQSxJQUNKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxxQkFBcUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3ZGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBeUNELE9BQU8sS0FBSyx5REFBeUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzRixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sWUFBWSxJQUFJLEtBQUs7QUFFM0IsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFFBQUksU0FBUztBQUNULGNBQVEsT0FBTyxnQkFBZ0I7QUFBQSxJQUNsQztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN6RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVdBLE9BQU8sSUFBSSx1REFBdUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUN6RixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBRWpELE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixRQUFJLFNBQVM7QUFDVCxjQUFRLE9BQU8sb0JBQW9CO0FBQUEsSUFDdEM7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsVUFBUyxDQUFFO0FBQUEsRUFDeEYsT0FDSztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsc0JBQXNCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUN0RjtBQUNKLENBQUM7QUF5QkEsT0FBTyxJQUFJLHFEQUFxRCxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3ZGLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksaUJBQWlCLE9BQU07QUFDdkIsZUFBUyxXQUFXLFNBQVMsYUFBWTtBQUFFLGdCQUFRLE9BQU8sVUFBVSxJQUFJO0FBQUEsTUFBTTtBQUFBLElBQ2xGLE9BQ0s7QUFDRCxVQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixVQUFJLFNBQVM7QUFBRyxnQkFBUSxPQUFPLFVBQVUsSUFBRztBQUFBLE1BQU07QUFBQSxJQUN0RDtBQUNBLFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUscUJBQXFCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN2RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVlELE9BQU8sS0FBSyxpREFBaUQsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosUUFBTSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLG1CQUFtQjtBQUNwRyxNQUFJO0FBQ0osTUFBSTtBQUNBLFVBQU0sY0FBYyxNQUFNLEdBQUcsU0FBUyxTQUFTLFVBQVUsT0FBTztBQUNoRSxtQkFBZSxLQUFLLE1BQU0sV0FBVztBQUNyQyxhQUFTLFdBQVcsTUFBTSxhQUFhO0FBQUEsRUFDM0MsU0FDTyxPQUFPO0FBQUcsbUJBQWU7QUFBQSxFQUFRO0FBQ3hDLFNBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFFBQVEsV0FBVyxhQUEwQixDQUFDO0FBQ3JGLENBQUM7QUFHRCxPQUFPLElBQUksd0RBQXdELFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosU0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsUUFBUSxXQUFXLGNBQWMsU0FBUyxhQUFZLENBQUM7QUFDOUYsQ0FBQztBQVlELE9BQU8sS0FBSyxpREFBaUQsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosV0FBUyxlQUFlLElBQUksS0FBSztBQUNqQyxXQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLGVBQWU7QUFHdkYsRUFBQUQsS0FBSSxLQUFLLHlEQUF5RDtBQUVsRSxRQUFNLFVBQVVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFVBQVU7QUFDOUUsUUFBTSxXQUFXQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLG1CQUFtQjtBQUVwRyxNQUFJO0FBQ0EsVUFBTSxHQUFHLFNBQVMsTUFBTSxTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDcEQsVUFBTSxhQUFhLEtBQUssVUFBVSxTQUFTLGNBQWMsTUFBTSxDQUFDO0FBRWhFLFNBQUssTUFBTSxVQUFVO0FBQ3JCLFVBQU0sR0FBRyxTQUFTLFVBQVUsVUFBVSxVQUFVO0FBQUEsRUFDcEQsU0FDTyxPQUFPO0FBQ1YsSUFBQUQsS0FBSSxNQUFNLDhCQUE4QixLQUFLLEVBQUc7QUFDaEQsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUSx1Q0FBdUMsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUN4RztBQUVBLE1BQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLEVBQUUsWUFBWSxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQzdFLENBQUM7QUFzQkQsT0FBTyxLQUFLLGdFQUFnRSxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ2xHLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsUUFBTSxjQUFjLElBQUksS0FBSztBQUM3QixRQUFNLFlBQVksSUFBSSxLQUFLO0FBQzNCLFFBQU0sNEJBQTRCLElBQUksS0FBSztBQUMzQyxRQUFNLDZCQUE2QixJQUFJLEtBQUs7QUFDNUMsUUFBTSxxQkFBcUIsSUFBSSxLQUFLO0FBQ3BDLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFDdkIsUUFBTSxTQUFTLElBQUksS0FBSztBQUN4QixRQUFNLGdCQUFnQixJQUFJLEtBQUs7QUFDL0IsUUFBTSxlQUFlLElBQUksS0FBSztBQUc5QixNQUFJLElBQUksT0FBTyxvQkFBb0IsU0FBUyxXQUFXLGFBQWE7QUFFaEUsUUFBSSxpQkFBaUIsT0FBTTtBQUN2QixlQUFTLFdBQVcsU0FBUyxhQUFZO0FBQ3JDLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSxPQUFPO0FBQUMsa0JBQVEsT0FBTyxRQUFRO0FBQUEsUUFBTztBQUMxQyxZQUFJLE9BQU8sa0JBQWtCLGFBQWE7QUFBQyxrQkFBUSxPQUFPLGdCQUFnQjtBQUFBLFFBQWU7QUFDekYsWUFBSSxjQUFjO0FBQUMsa0JBQVEsT0FBTyxlQUFlO0FBQUEsUUFBTTtBQUFBLE1BQzNEO0FBQUEsSUFDSixPQUNLO0FBQ0QsVUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsVUFBSSxTQUFTO0FBRVQsWUFBSSxhQUFZO0FBQ1osa0JBQVEsT0FBTyxjQUFjO0FBQzdCLGtCQUFRLGVBQWU7QUFBQSxRQUMzQjtBQUNBLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSwyQkFBMkI7QUFDM0Isa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyw2QkFBNkI7QUFBQSxRQUNoRCxPQUNLO0FBQ0Qsa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyxzQkFBc0I7QUFBQSxRQUN6QztBQUNBLFlBQUksc0JBQXNCLE1BQUs7QUFBRSxrQkFBUSxlQUFlO0FBQUEsUUFBTTtBQUM5RCxZQUFJLE9BQU87QUFBQyxrQkFBUSxPQUFPLFFBQVE7QUFBQSxRQUFPO0FBQzFDLFlBQUksT0FBTyxrQkFBa0IsYUFBYTtBQUFDLGtCQUFRLE9BQU8sZ0JBQWdCO0FBQUEsUUFBZTtBQUN6RixZQUFJLFFBQVE7QUFBRSxrQkFBUSxPQUFPLFNBQVM7QUFBQSxRQUFLO0FBQzNDLFlBQUksY0FBYztBQUFDLGtCQUFRLE9BQU8sZUFBZTtBQUFBLFFBQU07QUFBQSxNQUkzRDtBQUNBLFVBQUksT0FBTSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUU3QixVQUFJLE1BQU0sTUFBUSxRQUFRLGFBQWEsUUFBUSxPQUFPLFFBQVc7QUFDN0QsWUFBSUksV0FBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFlBQUlBLFVBQVM7QUFBSSxtQkFBUyxjQUFjLFNBQVMsWUFBWSxPQUFRLFFBQU0sR0FBRyxVQUFXLFlBQVk7QUFBQSxRQUFHO0FBQUEsTUFDNUc7QUFBQSxJQUVKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3pGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBa0JBLE9BQU8sS0FBSyxXQUFXLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDOUMsUUFBTSxhQUFhLElBQUksS0FBSztBQUM1QixRQUFNLGVBQWUsV0FBVztBQUNoQyxRQUFNLFdBQVcsV0FBVztBQUM1QixRQUFNLGFBQWEsV0FBVztBQUc5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsTUFBSyxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLGdCQUFnQixRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFFbEcsTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsTUFBSyxDQUFDLFNBQVU7QUFBQyxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLFdBQVcsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUFFO0FBRzNGLFVBQVEsUUFBUSxXQUFXO0FBQzNCLFVBQVEsY0FBYyxXQUFXO0FBQ2pDLFVBQVEsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUN2QyxVQUFRLFdBQVc7QUFDbkIsVUFBUSxRQUFRLFdBQVc7QUFDM0IsVUFBUSxrQkFBa0IsV0FBVztBQUVyQyxNQUFJLFdBQVcsT0FBTztBQUFFLFlBQVEsT0FBTyxvQkFBb0I7QUFBQSxFQUFNO0FBQ2pFLE1BQUksV0FBVyxzQkFBc0IsR0FBRTtBQUFFLFlBQVEsV0FBVztBQUFBLEVBQXlCO0FBRXJGLE1BQUksZ0JBQWdCLEtBQUssTUFBTSxLQUFLLFVBQVUsUUFBUSxNQUFNLENBQUM7QUFHN0QsTUFBSSxRQUFRLE9BQU8sUUFBVztBQUMxQixRQUFJQSxXQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsUUFBSUEsVUFBUztBQUFJLGVBQVMsY0FBYyxTQUFTLFlBQVksT0FBUSxRQUFNLEdBQUcsVUFBVyxZQUFZO0FBQUEsSUFBRztBQUFBLEVBQzVHO0FBSUEsVUFBUSxPQUFPLGNBQWM7QUFDN0IsVUFBUSxPQUFPLFlBQVk7QUFDM0IsVUFBUSxPQUFPLFdBQVc7QUFDMUIsVUFBUSxPQUFPLFFBQVE7QUFDdkIsVUFBUSxPQUFPLGVBQWU7QUFLOUIsUUFBTSxtQkFBbUIsRUFBRSxHQUFHLFNBQVMsYUFBYTtBQUNwRCxtQkFBaUIsZUFBZSxFQUFFLEdBQUcsU0FBUyxhQUFhLGFBQWE7QUFHeEUsV0FBUyxjQUFjLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHO0FBQ2pDLFFBQUksaUJBQWlCLGFBQWEsVUFBVSxHQUFHO0FBQzNDLHVCQUFpQixhQUFhLFVBQVUsSUFBSTtBQUFBLFFBQ3hDLEdBQUcsaUJBQWlCLGFBQWEsVUFBVTtBQUFBLFFBQzNDLFFBQVE7QUFBQSxVQUNKLEdBQUcsaUJBQWlCLGFBQWEsVUFBVSxFQUFFO0FBQUEsVUFDN0Msc0JBQXNCLENBQUM7QUFBQSxRQUMzQjtBQUFBLFFBQ0EsUUFBUTtBQUFBLFVBQ0osR0FBRyxpQkFBaUIsYUFBYSxVQUFVLEVBQUU7QUFBQSxVQUM3QyxzQkFBc0IsQ0FBQztBQUFBLFFBQzNCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBRUEsTUFBSSxVQUFVO0FBQ2QsTUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFPLFdBQVcsY0FBYSxrQkFBa0IsY0FBNkIsQ0FBQztBQUNuSixDQUFDO0FBU0QsT0FBTyxLQUFLLHFCQUFxQixlQUFnQixLQUFLLEtBQUssTUFBTTtBQUM3RCxRQUFNLGFBQWEsSUFBSSxLQUFLO0FBQzVCLFFBQU0sZUFBZSxXQUFXO0FBQ2hDLFFBQU0sYUFBYSxXQUFXO0FBRzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxNQUFLLENBQUMsVUFBVTtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsZ0JBQWdCLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUNsRyxNQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixNQUFLLENBQUMsU0FBVTtBQUFDLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFNBQVEsdUJBQXVCLFFBQVEsUUFBUSxDQUFDO0FBQUEsRUFBRTtBQUV2RyxNQUFJLElBQUksS0FBSyxZQUFhO0FBQ3RCLFVBQU0sbUJBQW1CLElBQUksS0FBSztBQUc5QixZQUFRLFdBQVcsNEJBQTRCO0FBRy9DLFFBQUksU0FBUyxhQUFhLFlBQVksU0FBUyxhQUFhLGlCQUFpQixDQUFDLFFBQVEsT0FBTyxxQkFBcUIsUUFBUSxPQUFNO0FBQzVILFVBQUc7QUFDQyxjQUFNLFNBQVMsSUFBSSxLQUFLLE9BQU8sTUFBTSxVQUFVLEVBQUUsSUFBSTtBQUNyRCxjQUFNLG9CQUFvQixPQUFPLEtBQUssUUFBUSxRQUFRO0FBR3RELGNBQU1DLGNBQWFQLEtBQUksYUFDckJHLE1BQUssS0FBSyxRQUFRLGVBQWMscUJBQXFCLFFBQVEsSUFDN0RBLE1BQUssUUFBUUYsWUFBVyxjQUFjO0FBRXhDLFlBQUksQ0FBQyxpQkFBZ0I7QUFDakIsNEJBQWtCLE1BQU0sVUFBVSxhQUFhLE9BQU0sR0FBRTtBQUFBLFlBQ25ELFVBQVVNO0FBQUEsVUFDZCxDQUFDO0FBQUEsUUFDTDtBQUVBLGNBQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUssTUFBTSxnQkFBZ0IsVUFBVSxpQkFBaUI7QUFDN0UsWUFBSSxpQkFBaUIsS0FBSyxTQUFTLFNBQVMsV0FBVyxHQUFHO0FBRTFELFlBQUksQ0FBQyxnQkFBZTtBQUNoQixrQkFBUSxRQUFRO0FBQ2hCLGtCQUFRLE9BQU8sUUFBUTtBQUN2QixVQUFBTCxLQUFJLEtBQUssZ0ZBQWdGO0FBQUEsUUFDN0Y7QUFBQSxNQUNKLFNBQ00sS0FBSTtBQUFFLFFBQUFBLEtBQUksS0FBSyxxQ0FBcUMsR0FBRyxFQUFFO0FBQUEsTUFBRztBQUFBLElBQ3RFO0FBRUEsUUFBSSxDQUFDLFFBQVEsT0FBTztBQUNoQixNQUFBQSxLQUFJLEtBQUsseUVBQXlFO0FBQ2xGLFVBQUksUUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFDbkUsVUFBSSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxXQUFXO0FBQzlHLFVBQUksbUJBQW1CQSxNQUFLLEtBQUssVUFBVSxHQUFHLElBQUksSUFBSSxJQUFJLEtBQUssa0JBQWtCLEVBQUU7QUFFbkYsVUFBSTtBQUNBLGNBQU0sR0FBRyxTQUFTLE1BQU0sVUFBVSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3JELFlBQUksbUJBQW1CLE9BQU8sS0FBSyxJQUFJLEtBQUssWUFBWSxRQUFRO0FBQ2hFLGNBQU0sR0FBRyxTQUFTLFVBQVUsa0JBQWtCLGdCQUFnQjtBQUFBLE1BQ2xFLFNBQVMsS0FBSztBQUFFLFFBQUFELEtBQUksTUFBTSwrQkFBK0IsR0FBRyxFQUFHO0FBQUEsTUFBRztBQUFBLElBQ3RFO0FBQUEsRUFFUixPQUFPO0FBRUgsWUFBUSxXQUFXO0FBQUEsRUFDdkI7QUFDQSxNQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLHVCQUF1QixHQUFHLFFBQU8sVUFBVSxDQUFDO0FBQ3RGLENBQUM7QUFRRCxPQUFPLEtBQUssMkNBQTJDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ25GLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLGNBQWMsSUFBSSxLQUFLO0FBQzdCLFFBQU0sZUFBZSxJQUFJLEtBQUs7QUFDOUIsUUFBTSxtQkFBbUIsSUFBSSxLQUFLO0FBQ2xDLFFBQU0sZ0JBQWdCLElBQUksS0FBSyxpQkFBaUI7QUFJaEQsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUssQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxnQkFBZ0IsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFHO0FBR2xHLE1BQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLE1BQUssQ0FBQyxTQUFVO0FBQUMsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUSxXQUFXLFFBQVEsUUFBUSxDQUFDO0FBQUEsRUFBRTtBQUUzRixNQUFJLGNBQWE7QUFDYixZQUFRLGVBQWU7QUFBQSxFQUMzQjtBQVVBLE1BQUksY0FBYyxRQUFRLFdBQVcsUUFBUSxRQUFRLEdBQUc7QUFDeEQsTUFBSSxNQUFNLG9CQUFJLEtBQUs7QUFFbkIsTUFBSSxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsR0FBRyxPQUFPLElBQUksU0FBUyxJQUFFLENBQUMsRUFBRSxTQUFTLEdBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxJQUFJLFFBQVEsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLEVBQUUsU0FBUyxHQUFFLEdBQUcsQ0FBQyxHQUFHLE9BQU8sSUFBSSxXQUFXLENBQUMsRUFBRSxTQUFTLEdBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxJQUFJLFdBQVcsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUM7QUFDdlAsTUFBSSxXQUFXLEdBQUcsVUFBVSxJQUFJLFdBQVcsSUFBSSxnQkFBZ0IsSUFBSSxTQUFTO0FBSTVFLFFBQU0sWUFBWSxPQUFPLEtBQUssYUFBYSxRQUFRO0FBR25ELE1BQUk7QUFDQSxVQUFNLFdBQVdDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLFVBQVUsY0FBYyxTQUFTLENBQUU7QUFDeEksVUFBTSxJQUFJLE1BQU0sVUFBVSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQzdDLFVBQU0sbUJBQW1CQSxNQUFLLEtBQUssVUFBVSxRQUFRO0FBQ3JELFVBQU0sSUFBSSxVQUFVLGtCQUFrQixTQUFTO0FBRS9DLElBQUFELEtBQUksS0FBSyx5RUFBeUUsUUFBUSxVQUFVLEVBQUU7QUFFdEcsUUFBSSxlQUFlO0FBQ25CLFFBQUksZUFBTyxpQkFBaUI7QUFDMUIsWUFBTSxhQUFhQyxNQUFLLEtBQUssZUFBTyxpQkFBaUIsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLFVBQVUsY0FBYyxTQUFTLENBQUU7QUFDNUksWUFBTSxJQUFJLE1BQU0sWUFBWSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQy9DLFlBQU0seUJBQXlCQSxNQUFLLEtBQUssWUFBWSxRQUFRO0FBQzdELFlBQU0sSUFBSSxVQUFVLHdCQUF3QixTQUFTO0FBQ3JELHFCQUFlO0FBQUEsSUFDakI7QUFFQSxRQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUyxXQUFXLFFBQVEsV0FBVyxRQUFRLGFBQWEsQ0FBQztBQUFBLEVBQzVGLFNBQVMsS0FBSztBQUNaLElBQUFELEtBQUksTUFBTSwyQkFBMkIsR0FBRyxFQUFFO0FBQzFDLFFBQUksVUFBVSxFQUFFLDBCQUEwQjtBQUMxQyxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBa0IsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUM5RTtBQUVOLENBQUM7QUFnQkQsSUFBTyxrQkFBUTtBQUtmLFNBQVMscUJBQXFCLEtBQUksS0FBSTtBQUNsQyxNQUFJLElBQUksTUFBTSxTQUFVLElBQUksTUFBTSxlQUFlLElBQUksR0FBRyxTQUFTLFdBQVcsR0FBRztBQUM3RSxXQUFPO0FBQUEsRUFDVDtBQUNBLEVBQUFBLEtBQUksTUFBTSxxQ0FBcUMsSUFBSSxFQUFFLEVBQUU7QUFDdkQsTUFBSSxLQUFLLGdCQUFnQjtBQUN6QixTQUFPO0FBQ1g7QUFFQSxTQUFTLHVCQUF1QjtBQUM1QixTQUFPRyxRQUFPLFlBQVksRUFBRSxFQUFFLFNBQVMsS0FBSztBQUNoRDtBQUNBLFNBQVMsT0FBTyxRQUFRO0FBQ3BCLFNBQU9BLFFBQU8sV0FBVyxRQUFRLEVBQUUsT0FBTyxNQUFNLEVBQUUsT0FBTztBQUM3RDtBQUNBLFNBQVMsZ0JBQWdCLEtBQUs7QUFDMUIsU0FBTyxJQUFJLFNBQVMsUUFBUSxFQUMzQixRQUFRLEtBQUssR0FBRyxFQUNoQixRQUFRLEtBQUssR0FBRyxFQUNoQixRQUFRLE9BQU8sRUFBRTtBQUN0Qjs7O0FTOWdDQSxTQUFTLFVBQUFHLGVBQWM7QUFFdkIsT0FBT0MsV0FBVztBQUVsQixPQUFPQyxTQUFRO0FBQ2YsT0FBTyxhQUFhO0FBR3BCLE9BQU8sY0FBYztBQUNyQixTQUFTLGFBQWEsV0FBVztBQUNqQyxPQUFPQyxVQUFTO0FBQ2hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFNBQVM7QUFYaEIsSUFBTUMsVUFBU0MsUUFBTztBQU10QixJQUFNLEVBQUUsR0FBQUMsR0FBRSxJQUFJLGdCQUFLO0FBV2xCRixRQUFPLEtBQUssZ0NBQWdDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ3pFLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxNQUFLLElBQUksS0FBSztBQUVwQixNQUFLLFVBQVUsU0FBUyxXQUFXLGFBQWM7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFFeEcsTUFBSSxVQUFVLENBQUM7QUFDZixVQUFRLEtBQU0sRUFBQyxrQkFBa0IsS0FBSyxpQkFBaUJDLE1BQUssUUFBUSxHQUFHLEVBQUMsQ0FBQztBQUV6RSxRQUFNLGlCQUFpQixDQUFDLE9BQU87QUFHL0IsTUFBSTtBQUNBLFVBQU0sUUFBUSxNQUFNQyxJQUFHLFNBQVMsUUFBUSxHQUFHO0FBQzNDLGVBQVcsUUFBUSxPQUFPO0FBQ3RCLFlBQU0sV0FBV0QsTUFBSyxLQUFLLEtBQUssSUFBSTtBQUNwQyxVQUFJLE1BQU1BLE1BQUssUUFBUSxJQUFJLEVBQUUsWUFBWTtBQUV6QyxVQUFJO0FBQ0EsY0FBTSxRQUFRLE1BQU1DLElBQUcsU0FBUyxLQUFLLFFBQVE7QUFDN0MsWUFBSSxNQUFNLFlBQVksR0FBRztBQUNyQixrQkFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLE1BQU0sTUFBTSxNQUFNLE9BQU8sS0FBSyxJQUFJLFFBQVEsSUFBSSxDQUFDO0FBQUEsUUFDbEYsV0FDUyxNQUFNLE9BQU8sS0FBSyxDQUFDLGVBQWUsU0FBUyxHQUFHLEdBQUc7QUFDdEQsa0JBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxNQUFNLE1BQU0sTUFBTSxRQUFRLEtBQVUsUUFBUSxJQUFJLENBQUM7QUFBQSxRQUNwRjtBQUFBLE1BQ0osU0FBUyxVQUFVO0FBRWYsZ0JBQVEsTUFBTSxxRUFBcUUsUUFBUTtBQUFBLE1BQy9GO0FBQUEsSUFDSjtBQUFBLEVBQ0osU0FBUyxLQUFLO0FBRVYsWUFBUSxNQUFNLDJEQUEyRCxHQUFHO0FBQzVFLFdBQU8sSUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxTQUFTLFNBQVNGLEdBQUUsZ0JBQWdCLEVBQUUsQ0FBQztBQUFBLEVBQ2pGO0FBQ0EsU0FBTyxJQUFJLEtBQU0sT0FBUTtBQUM3QixDQUFDO0FBaUJBRixRQUFPLEtBQUssaUNBQWlDLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQzFFLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxjQUFjLElBQUksS0FBSztBQUM3QixNQUFJLFVBQVU7QUFHZCxNQUFLLFVBQVUsU0FBUyxXQUFXLGFBQWM7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFPeEcsTUFBSSxjQUFjLENBQUM7QUFDbkIsV0FBUyxXQUFXLGFBQWE7QUFDN0IsYUFBUyxVQUFVLEdBQUcsV0FBVyxHQUFHLFdBQVc7QUFDM0MsVUFBSSxRQUFRLFNBQVMsT0FBTyxFQUFFLE1BQUs7QUFDL0Isb0JBQVksS0FBSyxRQUFRLFNBQVMsT0FBTyxFQUFFLElBQUk7QUFBQSxNQUNuRDtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0EsVUFBUSxJQUFJLGlDQUFpQyxXQUFXO0FBR3hELE1BQUksWUFBWSxXQUFXLEdBQUc7QUFDMUIsV0FBTyxJQUFJLEtBQUssRUFBQyxTQUFrQixXQUFXLEtBQUksQ0FBQztBQUFBLEVBQ3ZELE9BQ0s7QUFDRCxRQUFJLGVBQWUsTUFBTSxlQUFlLGFBQWEsVUFBVTtBQUMvRCxRQUFJLGVBQWVDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVcsV0FBVztBQUM3RixRQUFJO0FBQ0EsWUFBTUMsSUFBRyxTQUFTLFVBQVUsY0FBYyxZQUFZO0FBQ3RELE1BQUFMLEtBQUksS0FBSyxpREFBaUQ7QUFBQSxJQUM5RCxTQUNNLEtBQUk7QUFBQyxNQUFBQSxLQUFJLE1BQU0scUJBQW9CLEdBQUc7QUFBQSxJQUFDO0FBQzdDLGdCQUFZLFFBQVEsWUFBWTtBQUloQyxRQUFJLE1BQU0sTUFBTSxZQUFZLFdBQVc7QUFDdkMsUUFBSSxZQUFZLE9BQU8sS0FBSyxHQUFHO0FBQy9CLFFBQUksVUFBVUksTUFBSyxLQUFLLGVBQU8sZUFBZSxTQUFTLFdBQVcsWUFBVyxjQUFjO0FBQzNGLFFBQUk7QUFDQSxZQUFNQyxJQUFHLFNBQVMsVUFBVSxTQUFTLFNBQVM7QUFDOUMsTUFBQUwsS0FBSSxLQUFLLDJDQUEyQztBQUFBLElBQ3hELFNBQ00sS0FBSTtBQUFDLE1BQUFBLEtBQUksTUFBTSxxQkFBb0IsR0FBRztBQUFBLElBQUM7QUFDN0MsV0FBTyxJQUFJLEtBQUssRUFBQyxTQUFrQixXQUFxQixRQUFnQixDQUFDO0FBQUEsRUFDN0U7QUFDSixDQUFDO0FBV0QsU0FBUyxXQUFXLE1BQU07QUFDdEIsUUFBTSxTQUFTLElBQUksV0FBVyxNQUFNLEdBQUcsQ0FBQztBQUV4QyxRQUFNLFlBQVksQ0FBQyxJQUFNLElBQU0sSUFBTSxJQUFNLEVBQUk7QUFDL0MsV0FBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUN2QyxRQUFJLE9BQU8sQ0FBQyxNQUFNLFVBQVUsQ0FBQyxHQUFHO0FBQzVCLE1BQUFBLEtBQUksS0FBSywwQ0FBMEM7QUFDbkQsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQ0EsU0FBTztBQUNYO0FBRUEsZUFBZSxnQkFBZ0IsU0FBUyxhQUFhLFlBQVc7QUFDNUQsUUFBTSxhQUFhLE1BQU1LLElBQUcsU0FBUyxTQUFTLE9BQU87QUFDckQsTUFBSSxRQUFRO0FBRVosTUFBSSxXQUFXLFVBQVUsR0FBRTtBQUN2QixZQUFRLE1BQU0sSUFBSSxVQUFVLEVBQUUsS0FBTSxVQUFRO0FBQ3hDLFVBQUksUUFBUSxLQUFLLFFBQVEsYUFBYTtBQUNsQyxZQUFJLHFCQUFxQixLQUFLLEtBQUs7QUFHbkMsWUFBSSxTQUFTLElBQUksVUFBVTtBQUMzQixZQUFJLFNBQVM7QUFFYiw2QkFBcUI7QUFJckIsWUFBSSxRQUFRO0FBQ1osWUFBSSxVQUFVLEtBQUssS0FBSyxNQUFNLEtBQUs7QUFDbkMsWUFBSSxnQkFBZ0IsVUFBVSxRQUFRLENBQUMsSUFBSTtBQUUzQyxZQUFJLGtCQUFrQixZQUFXO0FBQzdCLGlCQUFPO0FBQUEsUUFDWCxPQUNLO0FBQ0Qsa0JBQVE7QUFDUixvQkFBVSxLQUFLLEtBQUssTUFBTSxLQUFLO0FBQy9CLDBCQUFnQixVQUFVLFFBQVEsQ0FBQyxJQUFJO0FBQ3ZDLGNBQUksa0JBQWtCLFlBQVc7QUFDN0IsbUJBQU87QUFBQSxVQUNYLE9BQ0s7QUFDRCxvQkFBUSxJQUFJLEtBQUssSUFBSTtBQUNyQixtQkFBTyxzQkFBc0IsSUFBSSxLQUFLLGtCQUFrQixLQUFLO0FBQUEsVUFDakU7QUFBQSxRQUNKO0FBQUEsTUFDSixPQUNLO0FBQ0QsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUVKLENBQUMsRUFDQSxNQUFNLFNBQU87QUFBQyxNQUFBTCxLQUFJLE1BQU0sMkJBQTJCLEdBQUcsRUFBRTtBQUFHLGFBQU87QUFBQSxJQUFHLENBQUM7QUFBQSxFQUMzRSxPQUNLO0FBQ0QsWUFBUTtBQUFBLEVBQ1o7QUFFQSxTQUFPO0FBQ1g7QUFRQSxlQUFlLGVBQWUsYUFBYSxZQUFXO0FBQ2xELE1BQUksWUFBWSxDQUFDLENBQUMsUUFBUSxhQUFhLFNBQVMsV0FBVyxXQUFXLENBQUM7QUFDdkUsYUFBVyxXQUFXLGFBQVk7QUFDOUIsUUFBSSxnQkFBZ0I7QUFDcEIsVUFBTSxjQUFjLFFBQVEsWUFBWSxTQUFTLEtBQUssUUFBUSxZQUFZLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUSxRQUFRO0FBQ3pHLGFBQVMsVUFBVSxHQUFHLFdBQVcsR0FBRyxXQUFXO0FBQzNDLFVBQUksT0FBTztBQUNYLFVBQUksY0FBYztBQUNsQixVQUFJLE9BQU87QUFDWCxVQUFJLFFBQVE7QUFDWixVQUFJLFdBQVc7QUFFZixVQUFJLFFBQVEsU0FBUyxPQUFPLEVBQUUsTUFBSztBQUMvQixlQUFPO0FBQ1Asc0JBQWMsUUFBUSxTQUFTLE9BQU8sRUFBRSxlQUFlLGFBQWEsT0FBTztBQUMzRSxzQkFBYyxZQUFZLFNBQVMsS0FBSyxZQUFZLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUTtBQUMzRSxlQUFPLE9BQU8sUUFBUSxTQUFTLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxrQkFBa0I7QUFDdkUsZ0JBQVEsTUFBTSxnQkFBZ0IsUUFBUSxTQUFTLE9BQU8sRUFBRSxNQUFNLFFBQVEsYUFBYSxVQUFVO0FBQzdGLG1CQUFXLFFBQVEsU0FBUyxPQUFPLEVBQUUsU0FBUyxTQUFTLEtBQUssUUFBUSxTQUFTLE9BQU8sRUFBRSxTQUFTLE1BQU0sR0FBRyxFQUFFLElBQUksUUFBUSxRQUFRLFNBQVMsT0FBTyxFQUFFO0FBQ2hKLGtCQUFVLEtBQUssQ0FBRSxNQUFNLGFBQWEsTUFBTSxPQUFPLFFBQVMsQ0FBQztBQUMzRCx3QkFBZ0I7QUFBQSxNQUNwQjtBQUFBLElBQ0o7QUFDQSxRQUFJLENBQUMsZUFBZTtBQUNoQixnQkFBVSxLQUFLLENBQUUsYUFBYSxJQUFJLElBQUksSUFBSSxFQUFHLENBQUM7QUFBQSxJQUNsRDtBQUFBLEVBQ0o7QUFFQSxRQUFNLFNBQVMsTUFBTSxZQUFZLE9BQU87QUFDeEMsUUFBTSxPQUFPLE9BQU8sUUFBUTtBQUc1QixRQUFNLFNBQVM7QUFDZixRQUFNLFNBQVMsS0FBSyxVQUFVLElBQUk7QUFDbEMsUUFBTSxZQUFZO0FBQ2xCLFFBQU0sZUFBZSxDQUFDLEtBQUssS0FBSyxJQUFJLElBQUksR0FBRztBQUczQyxRQUFNLFdBQVcsQ0FBQyxHQUFHLEdBQUcsT0FBTyxXQUFXO0FBQUUsU0FBSyxjQUFjLEVBQUUsR0FBRyxHQUFHLE9BQU8sUUFBUSxhQUFhLElBQUksR0FBRyxHQUFHLENBQUMsR0FBSSxhQUFhLEVBQUksQ0FBQztBQUFBLEVBQUk7QUFFeEksUUFBTSxVQUFVLENBQUMsTUFBTSxHQUFHLE1BQU07QUFBRyxXQUFPLE9BQU8sSUFBSTtBQUFNLFNBQUssU0FBUyxNQUFNLEVBQUUsR0FBRyxHQUFHLE1BQU0sR0FBRyxPQUFPLElBQUksR0FBRyxHQUFHLENBQUMsRUFBSSxDQUFDO0FBQUEsRUFBSTtBQUUzSCxZQUFVLFFBQVEsQ0FBQyxLQUFLLGFBQWE7QUFDakMsVUFBTSxPQUFPLFNBQVMsV0FBVztBQUNqQyxRQUFJLFFBQVEsQ0FBQyxVQUFVLGdCQUFnQjtBQUNuQyxZQUFNLE9BQU8sU0FBUyxhQUFhLE1BQU0sR0FBRyxXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssUUFBUSxNQUFNLEtBQUssQ0FBQztBQUMxRixlQUFTLE1BQU0sT0FBTyxXQUFXLGFBQWEsV0FBVyxHQUFHLFNBQVM7QUFDckUsY0FBUSxVQUFVLE9BQU8sR0FBRyxPQUFPLFlBQVksQ0FBQztBQUFBLElBQ3BELENBQUM7QUFBQSxFQUNMLENBQUM7QUFFRCxRQUFNLFdBQVcsTUFBTSxPQUFPLEtBQUs7QUFDbkMsU0FBTztBQUNYO0FBZ0NBLGVBQWUsWUFBWSxhQUFhO0FBRXBDLFFBQU0sVUFBVSxNQUFNLFlBQVksT0FBTztBQUN6QyxhQUFXLFdBQVcsYUFBYTtBQUMvQixRQUFJLFdBQVcsTUFBTUssSUFBRyxTQUFTLFNBQVMsT0FBTztBQUVqRCxRQUFJLFdBQVcsUUFBUSxHQUFFO0FBQ3JCLFlBQU1DLE9BQU0sTUFBTSxZQUFZLEtBQUssUUFBUTtBQUMzQyxZQUFNLGNBQWMsTUFBTSxRQUFRLFVBQVVBLE1BQUtBLEtBQUksZUFBZSxDQUFDO0FBQ3JFLGtCQUFZLFFBQVEsQ0FBQyxTQUFTO0FBQzFCLGdCQUFRLFFBQVEsSUFBSTtBQUFBLE1BQ3hCLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFFSjtBQUVBLFFBQU0sV0FBVyxNQUFNLFFBQVEsS0FBSztBQUNwQyxTQUFPO0FBQ1g7QUFlQ0wsUUFBTyxLQUFLLDhCQUE4QixlQUFnQixLQUFLLEtBQUssTUFBTTtBQUN2RSxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUssVUFBVSxTQUFTLFdBQVcsYUFBYztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQUd4RyxRQUFNLFdBQVcsSUFBSSxLQUFLO0FBQzFCLE1BQUksVUFBVTtBQUNWLFFBQUk7QUFDQSxZQUFNLFFBQVEsTUFBTUUsSUFBRyxTQUFTLEtBQUssUUFBUTtBQUM3QyxVQUFJLE1BQU0sWUFBWSxHQUFFO0FBQ3BCLGNBQU1BLElBQUcsU0FBUyxHQUFHLFVBQVUsRUFBRSxXQUFXLE1BQU0sT0FBTyxLQUFLLENBQUM7QUFBQSxNQUNuRSxPQUNLO0FBQ0QsY0FBTUEsSUFBRyxTQUFTLE9BQU8sUUFBUTtBQUFBLE1BQ3JDO0FBQ0EsVUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRRixHQUFFLGVBQWUsRUFBSSxDQUFDO0FBQUEsSUFDakYsU0FBUyxLQUFLO0FBQ1YsTUFBQUgsS0FBSSxNQUFNLGtCQUFrQixHQUFHO0FBQy9CLFVBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQU8sU0FBUyxRQUFRLFVBQVUsU0FBUUcsR0FBRSxnQkFBZ0IsRUFBRSxDQUFDO0FBQUEsSUFDMUY7QUFBQSxFQUNKO0FBQ0osQ0FBQztBQVdERixRQUFPLEtBQUssOEJBQThCLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDaEUsUUFBTSxFQUFFLE9BQU8sV0FBVyxJQUFJLElBQUk7QUFDbEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBR2pELE1BQUksQ0FBQyxZQUFZLFVBQVUsU0FBUyxZQUFZLGFBQWE7QUFDekQsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUN2RDtBQUVBLFFBQU0sRUFBRSxTQUFTLElBQUksSUFBSTtBQUN6QixNQUFJLFVBQVU7QUFDVixRQUFJLFNBQVMsVUFBVSxDQUFDLFFBQVE7QUFDNUIsVUFBSSxLQUFLO0FBQ0wsUUFBQUgsS0FBSSxNQUFNLEdBQUc7QUFDYixZQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRRyxHQUFFLGdCQUFnQixFQUFFLENBQUM7QUFBQSxNQUN4RDtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUVILFFBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVFBLEdBQUUsZ0JBQWdCLEVBQUUsQ0FBQztBQUFBLEVBQ3hEO0FBQ0osQ0FBQztBQVlBRixRQUFPLEtBQUssZ0NBQWdDLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDbkUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLE9BQU8sSUFBSSxLQUFLO0FBQ3RCLFFBQU0sV0FBVyxJQUFJLEtBQUs7QUFDMUIsUUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUssVUFBVSxTQUFTLFdBQVcsZUFBZSxDQUFDLFdBQVcsT0FBTyxRQUFTLEdBQUc7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFJeEksTUFBSSxTQUFTLHNCQUFzQjtBQUUvQixRQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsS0FBSztBQUMxRSxRQUFJLFNBQVM7QUFDVCxjQUFRLE9BQU8sWUFBWSxJQUFJO0FBQy9CLGNBQVEsT0FBTyxPQUFPLElBQUksQ0FBQztBQUMzQixVQUFJLElBQUksRUFBQyxNQUFZLENBQUM7QUFBQSxJQUMxQjtBQUFBLEVBQ0osV0FDUyxTQUFTLFFBQVE7QUFDbEIsUUFBSSxVQUFVLHVCQUF1QiwwQkFBMEIsUUFBUTtBQUN2RSxRQUFJLFNBQVMsUUFBUTtBQUFBLEVBQzdCLFdBQ1MsU0FBUyxPQUFPO0FBRXJCLFFBQUksY0FBYyxTQUFTLE9BQU8sTUFBTTtBQUN4QyxRQUFJLGNBQWNDLE1BQUssS0FBSyxlQUFPLGVBQWUsV0FBVztBQUM3RCxVQUFNLGFBQWEsVUFBVSxXQUFXO0FBQ3hDLFFBQUksVUFBVSx1QkFBdUIsMEJBQTBCLFFBQVE7QUFDdkUsUUFBSSxTQUFTLGFBQVksUUFBUTtBQUFBLEVBQ3JDO0FBRUosQ0FBQztBQU1ESCxRQUFPLEtBQUssd0NBQXdDLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDMUUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUssVUFBVSxTQUFTLFdBQVcsZUFBZSxDQUFDLFdBQVcsT0FBTyxRQUFTLEdBQUc7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFHeEksTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLEtBQUs7QUFDMUUsTUFBSSxTQUFTO0FBRVQsUUFBSSxlQUFlLFNBQVM7QUFDNUIsUUFBSSxjQUFjLGFBQWEsYUFBYSxhQUFhLGFBQWE7QUFDdEUsUUFBSSxTQUFTLFlBQVk7QUFDekIsUUFBSSxTQUFTLFlBQVk7QUFFekIsUUFBSSxZQUFZLENBQUM7QUFDakIsUUFBSSxjQUFjLENBQUM7QUFDbkIsUUFBSSxVQUFVLEtBQUs7QUFDZixrQkFBWSxPQUFPO0FBQ25CLG9CQUFjLE9BQU87QUFBQSxJQUN6QixXQUNTLFVBQVUsS0FBSztBQUNwQixrQkFBWSxPQUFPO0FBQ25CLG9CQUFjLE9BQU87QUFBQSxJQUN6QjtBQUdBLFFBQUksS0FBSyxFQUFFLFFBQU8sV0FBVyxRQUFRLFVBQVUsV0FBc0IsWUFBMEIsQ0FBQztBQUFBLEVBQ3BHLE9BQ0s7QUFDRCxRQUFJLEtBQUssRUFBRSxRQUFPLFNBQVMsUUFBUSxVQUFVLFNBQVFBLEdBQUUsb0JBQW9CLEVBQUcsQ0FBQztBQUFBLEVBQ25GO0FBSUosQ0FBQztBQWlCQUYsUUFBTyxLQUFLLHNDQUFzQyxPQUFPLEtBQUssS0FBSyxTQUFTO0FBQ3pFLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsUUFBTSxFQUFFLE1BQU0sU0FBUyxJQUFJLElBQUk7QUFDL0IsUUFBTSxjQUFjLE9BQU8sS0FBSyxNQUFNLFFBQVE7QUFFOUMsTUFBSyxDQUFDLFdBQVcsY0FBYyxRQUFTLEdBQUk7QUFBRSxRQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUFFLE9BQ3ZGO0FBQ0QsUUFBSSxTQUFTO0FBQ2IsVUFBTSxNQUFNLG9CQUFJLEtBQUs7QUFDckIsUUFBSSxPQUFPLElBQUksbUJBQW1CLE9BQU87QUFDekMsUUFBSSxhQUFhLE9BQU8sSUFBSSxFQUFFLFFBQVEsTUFBTSxHQUFHO0FBRS9DLFVBQU0sT0FBTyxJQUFJLFlBQVk7QUFDN0IsVUFBTSxRQUFRLE9BQU8sSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHO0FBQ3hELFVBQU0sTUFBTSxPQUFPLElBQUksUUFBUSxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDakQsVUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxHQUFHO0FBRXhDLFFBQUksVUFBVSxHQUFHLFVBQVUsSUFBSSxVQUFVO0FBRXpDLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFFBQUksbUJBQW1CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxRQUFRO0FBQ25ILFFBQUksbUJBQW9CQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsVUFBVTtBQUUxRyxRQUFJLG9CQUFvQkEsTUFBSyxLQUFLLGtCQUFrQixPQUFPO0FBQzNELFFBQUk7QUFDQSxZQUFNQyxJQUFHLFNBQVMsTUFBTSxrQkFBa0IsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUM3RCxZQUFNQSxJQUFHLFNBQVMsTUFBTSxtQkFBbUIsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLElBQ2xFLFNBQ08sS0FBSztBQUNSLE1BQUFMLEtBQUksTUFBTSxvQkFBb0IsR0FBRztBQUFBLElBQ3JDO0FBRUEsUUFBSSxNQUFLO0FBRUwsVUFBSSxTQUFTLFNBQVMsTUFBTSxHQUFFO0FBQzFCLFFBQUFBLEtBQUksS0FBSyxnREFBZ0QsUUFBUSxVQUFVO0FBQzNFLFlBQUksVUFBVSxNQUFNLHFCQUFxQixrQkFBa0IsbUJBQW1CLFdBQVc7QUFFekYsWUFBSSxlQUFPLG1CQUFtQixTQUFRO0FBRWxDLGNBQUksWUFBYUksTUFBSyxLQUFLLGVBQU8saUJBQWlCLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxPQUFPO0FBQzlHLFVBQUFKLEtBQUksS0FBSyxnREFBZ0QsaUJBQWlCLFNBQVMsU0FBUyxHQUFHO0FBQy9GLGNBQUk7QUFDQSxrQkFBTUssSUFBRyxTQUFTLE1BQU0sV0FBVyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3RELGtCQUFNQSxJQUFHLFNBQVMsR0FBRyxtQkFBbUIsV0FBVyxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsVUFDMUUsU0FDTyxLQUFLO0FBQ1IsWUFBQUwsS0FBSSxNQUFNLG9CQUFvQixHQUFHO0FBQUEsVUFDckM7QUFBQSxRQUNKO0FBQ0EsWUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRRyxHQUFFLG1CQUFtQixHQUFHLE9BQWdCLENBQUM7QUFBQSxNQUNwRyxPQUNLO0FBQ0QsUUFBQUgsS0FBSSxNQUFNLHNDQUFzQztBQUNoRCxZQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFHLEdBQUUscUJBQXFCLEdBQUcsT0FBZSxDQUFDO0FBQUEsTUFDcEc7QUFBQSxJQUNKLE9BQ0s7QUFDRCxVQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFBLEdBQUUscUJBQXFCLEdBQUcsT0FBZSxDQUFDO0FBQUEsSUFDcEc7QUFBQSxFQUNKO0FBQ0osQ0FBQztBQVNERixRQUFPLEtBQUssa0RBQWtELE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDcEYsUUFBTSxjQUFjLElBQUksT0FBTztBQUMvQixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLGVBQWUsSUFBSSxPQUFPO0FBRWhDLE1BQUssZ0JBQWdCLFNBQVMsV0FBVyxhQUFjO0FBQUUsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUFFO0FBRzlHLE1BQUksa0JBQW1CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFNBQVM7QUFDaEcsTUFBSTtBQUNBLFVBQU1DLElBQUcsU0FBUyxNQUFNLGlCQUFpQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsRUFDaEUsU0FBUyxLQUFLO0FBQUEsRUFFZDtBQUdBLE1BQUksSUFBSSxPQUFNO0FBRVYsUUFBSSxhQUFhLENBQUM7QUFDbEIsUUFBSSxDQUFDLE1BQU0sUUFBUSxJQUFJLE1BQU0sS0FBSyxHQUFFO0FBQUUsaUJBQVcsS0FBSyxJQUFJLE1BQU0sS0FBSztBQUFBLElBQUMsT0FDakU7QUFBQyxtQkFBYSxJQUFJLE1BQU07QUFBQSxJQUFLO0FBRWxDLFFBQUksUUFBUSxDQUFDO0FBRWIsbUJBQWUsUUFBUyxZQUFZO0FBQ2hDLFVBQUksV0FBVyxtQkFBbUIsS0FBSyxJQUFJO0FBQzNDLFVBQUksbUJBQW1CRCxNQUFLLEtBQUssaUJBQWlCLFFBQVE7QUFDMUQsWUFBTSxLQUFLLEdBQUcsa0JBQWtCLENBQUMsUUFBUTtBQUNyQyxZQUFJLEtBQUs7QUFBRSxVQUFBSixLQUFJLE1BQU9HLEdBQUUsb0JBQW9CLENBQUU7QUFBQSxRQUFFO0FBQUEsTUFDcEQsQ0FBQztBQUNELFlBQU0sS0FBSyxFQUFFLE1BQUssVUFBVyxNQUFLLGlCQUFpQixDQUFDO0FBQUEsSUFDeEQ7QUFHQSxRQUFJLGlCQUFpQixPQUFNO0FBQ3ZCLGVBQVMsV0FBVyxTQUFTLGFBQVk7QUFDckMsZ0JBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsZ0JBQVEsT0FBTyxPQUFPLElBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0osV0FDUyxnQkFBZ0IsT0FBTyxnQkFBZ0IsS0FBSTtBQUNoRCxVQUFJLGFBQWEsQ0FBQztBQUNsQixVQUFJLGdCQUFnQixLQUFJO0FBQUMscUJBQWEsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxPQUFPO0FBQUEsTUFBTTtBQUMzSCxVQUFJLGdCQUFnQixLQUFJO0FBQUMscUJBQWEsU0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxPQUFPO0FBQUEsTUFBTTtBQUUzSCxVQUFJLFdBQVcsU0FBUyxHQUFHO0FBQ3ZCLGlCQUFTLFFBQVEsWUFBVztBQUN4QixjQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLGVBQWUsSUFBSTtBQUM5RSxjQUFJLFNBQVM7QUFDVCxvQkFBUSxPQUFPLFlBQVksSUFBRztBQUM5QixvQkFBUSxPQUFPLE9BQU8sSUFBSTtBQUFBLFVBQzlCO0FBQUEsUUFDSjtBQUFBLE1BQ0osT0FDSztBQUNELGVBQU8sSUFBSSxLQUFLLEVBQUUsUUFBTyxTQUFVLFFBQVEsVUFBVSxTQUFRQSxHQUFFLHFCQUFxQixFQUFFLENBQUM7QUFBQSxNQUMzRjtBQUFBLElBRUosT0FDSztBQUNELFVBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFVBQUksU0FBUztBQUNULGdCQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLGdCQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsTUFDOUI7QUFBQSxJQUNKO0FBQ0EsUUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxTQUFRQSxHQUFFLG1CQUFtQixFQUFHLENBQUM7QUFBQSxFQUNwRixPQUNLO0FBQ0QsUUFBSSxLQUFLLEVBQUUsUUFBTyxTQUFVLFFBQVEsVUFBVSxTQUFRQSxHQUFFLHFCQUFxQixFQUFFLENBQUM7QUFBQSxFQUNwRjtBQUVKLENBQUM7QUFvQkQsSUFBTyxlQUFRRjtBQUdmLElBQU0sd0JBQXdCO0FBQzlCLElBQUksa0JBQWtCO0FBQ3RCLElBQU0sZUFBZSxDQUFDO0FBRXRCLFNBQVMsaUJBQWlCO0FBQ3RCLE1BQUksbUJBQW1CLHNCQUF1QjtBQUM5QyxRQUFNLE1BQU0sYUFBYSxNQUFNO0FBQy9CLE1BQUksQ0FBQyxJQUFLO0FBRVY7QUFHQSxNQUFJLEVBQ0MsTUFBTSxNQUFNO0FBQUEsRUFBQyxDQUFDLEVBQ2QsUUFBUSxNQUFNO0FBR1g7QUFDQSxpQkFBYSxjQUFjO0FBQUEsRUFDL0IsQ0FBQztBQUNUO0FBRUEsZUFBZSxxQkFBcUIsa0JBQWtCLG1CQUFtQixhQUFZO0FBR2pGLFNBQU8sSUFBSSxRQUFRLENBQUMsWUFBWTtBQUM1QixVQUFNTSxRQUFPLFlBQVk7QUFDckIsVUFBSTtBQUNBLGNBQU1GLElBQUcsU0FBUyxVQUFVLGtCQUFrQixXQUFXO0FBR3pELGNBQU0sUUFBUSxrQkFBa0I7QUFBQSxVQUM1QixLQUFLO0FBQUEsVUFDTCxTQUFTLENBQUMsT0FBTyxZQUFZO0FBQ3pCLGtCQUFNLFNBQVNELE1BQUssVUFBVUEsTUFBSyxLQUFLLG1CQUFtQixNQUFNLFFBQVEsQ0FBQztBQUMxRSxnQkFBSSxDQUFDLE9BQU8sV0FBV0EsTUFBSyxVQUFVLG9CQUFvQkEsTUFBSyxHQUFHLENBQUMsR0FBRztBQUNsRSxzQkFBUSxNQUFNO0FBQ2Qsb0JBQU0sSUFBSSxNQUFNLDZCQUE2QixNQUFNLFFBQVE7QUFBQSxZQUMvRDtBQUFBLFVBQ0o7QUFBQSxRQUNKLENBQUM7QUFFRCxZQUFJO0FBQUUsZ0JBQU1DLElBQUcsU0FBUyxPQUFPLGdCQUFnQjtBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUEsUUFBZTtBQUM3RSxRQUFBTCxLQUFJLEtBQUssc0RBQXNELGlCQUFpQixFQUFFO0FBQ2xGLGdCQUFRLElBQUk7QUFBQSxNQUNoQixTQUFTLEtBQUs7QUFDVixRQUFBQSxLQUFJLE1BQU0sOEJBQThCLEdBQUc7QUFDM0MsWUFBSTtBQUFFLGdCQUFNSyxJQUFHLFNBQVMsT0FBTyxnQkFBZ0I7QUFBQSxRQUFHLFNBQVMsR0FBRztBQUFBLFFBQWU7QUFDN0UsZ0JBQVEsS0FBSztBQUFBLE1BQ2pCO0FBQUEsSUFDSjtBQUVBLGlCQUFhLEtBQUtFLEtBQUk7QUFDdEIsUUFBSSxrQkFBa0Isc0JBQXVCLGNBQWEsY0FBYztBQUFBLEVBQzVFLENBQUM7QUFDTDtBQU1BLFNBQVMsV0FBVyxPQUFPLFVBQVM7QUFDaEMsTUFBSSxjQUFjO0FBRWxCLE1BQUk7QUFDQSxhQUFTLFlBQVksUUFBUyxDQUFDLFlBQVk7QUFDdkMsVUFBSSxVQUFVLFFBQVEsT0FBTztBQUN6QixzQkFBYztBQUFBLE1BQ2xCO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTCxTQUNNLEtBQUk7QUFDTixJQUFBUCxLQUFJLE1BQU0sU0FBUyxHQUFHLEVBQUU7QUFBQSxFQUM1QjtBQUVBLFNBQU87QUFDWDtBQU9BLFNBQVMsYUFBYSxXQUFXLFNBQVM7QUFDdEMsUUFBTSxVQUFVLFNBQVMsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBQyxDQUFDO0FBQ3JELFFBQU0sU0FBU0ssSUFBRyxrQkFBa0IsT0FBTztBQUMzQyxTQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN0QyxZQUNHLFVBQVUsV0FBVyxLQUFLLEVBQzFCLEdBQUcsU0FBUyxTQUFPLE9BQU8sR0FBRyxDQUFDLEVBQzlCLEtBQUssTUFBTTtBQUVkLFdBQU8sR0FBRyxTQUFTLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLFlBQVEsU0FBUztBQUFBLEVBQ25CLENBQUM7QUFDTDs7O0FWN3VCTyxJQUFNLGVBQWVHLFFBQU87QUFNbkMsYUFBYSxJQUFJLGFBQWEsZUFBYTtBQUMzQyxhQUFhLElBQUksVUFBVSxZQUFVOzs7QURGckMsT0FBTyxhQUFhO0FBQ3BCLE9BQU9DLFdBQVU7QUFDakIsT0FBTyxlQUFnQjtBQUN2QixPQUFPLFFBQVE7QUFDZixPQUFPLFNBQVM7QUFDaEIsT0FBT0MsU0FBUTtBQUNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sV0FBVztBQUVsQixTQUFTLG9CQUFvQjtBQUU3QixPQUFPLGtCQUFrQjtBQUN6QixTQUFTLE9BQUFDLFlBQVc7QUFDcEIsT0FBT0MsVUFBUztBQUxoQixNQUFNLFFBQVEsb0JBQW9CO0FBUWxDLGVBQU8sZ0JBQWdCLEdBQUcsUUFBUTtBQUNsQyxlQUFPLGdCQUFnQkMsTUFBSyxLQUFLLGVBQU8sZUFBZSxlQUFPLGVBQWU7QUFDN0UsZUFBTyxnQkFBZ0JBLE1BQUssS0FBSyxHQUFHLE9BQU8sR0FBRyxVQUFVO0FBRXhELElBQUksQ0FBQ0MsSUFBRyxXQUFXLGVBQU8sYUFBYSxHQUFFO0FBQUUsRUFBQUEsSUFBRyxVQUFVLGVBQU8sZUFBZSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUc7QUFDcEcsSUFBSSxDQUFDQSxJQUFHLFdBQVcsZUFBTyxhQUFhLEdBQUU7QUFBRSxFQUFBQSxJQUFHLFVBQVUsZUFBTyxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBRztBQUlwRyxJQUFNLGNBQWMsUUFBUSxhQUFhLFVBQ25DRCxNQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsR0FBRyxTQUFTLElBQy9DQSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVM7QUFHL0MsSUFBSSxDQUFDQyxJQUFHLFdBQVcsV0FBVyxHQUFHO0FBQUcsRUFBQUEsSUFBRyxVQUFVLGFBQWEsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFHO0FBQ3BGLElBQU0sV0FBV0QsTUFBSyxLQUFLLGFBQWEsZUFBTyxlQUFlO0FBQzlELElBQUk7QUFBQyxFQUFBQyxJQUFHLFdBQVcsUUFBUTtBQUFFLFNBQU8sR0FBRTtBQUFDO0FBQ3ZDLElBQUk7QUFBSSxNQUFJLENBQUNBLElBQUcsV0FBVyxRQUFRLEdBQUc7QUFBRSxJQUFBQSxJQUFHLFlBQVksZUFBTyxlQUFlLFVBQVUsVUFBVTtBQUFBLEVBQUc7QUFBQyxTQUMvRixHQUFFO0FBQUMsRUFBQUYsS0FBSSxNQUFNLDRCQUE0QjtBQUFDO0FBS2hELElBQUk7QUFDQSxRQUFNLEVBQUMsU0FBUyxXQUFXLE1BQUssSUFBSyxhQUFhO0FBQ2xELGlCQUFPLFNBQVMsR0FBRyxRQUFRLEtBQUs7QUFDaEMsaUJBQU8sVUFBVTtBQUNyQixTQUNRLEdBQUc7QUFDUixFQUFBQSxLQUFJLE1BQU0sMkNBQTJDO0FBQ3JELGlCQUFPLFNBQVMsR0FBRyxRQUFRO0FBQzNCLEVBQUFBLEtBQUksS0FBSyxZQUFZLGVBQU8sTUFBTSxFQUFFO0FBQ3BDLGlCQUFPLFVBQVU7QUFFbkI7QUFNRCxJQUFNLFVBQVUsVUFBVTtBQUFBLEVBQ3RCLFVBQVUsSUFBSSxLQUFLO0FBQUE7QUFBQSxFQUNuQixLQUFLO0FBQUE7QUFBQSxFQUNMLGlCQUFpQjtBQUFBO0FBQUEsRUFDakIsZUFBZTtBQUFBO0FBQ25CLENBQUM7QUFHRCxRQUFRLGFBQWEsZUFBTyxhQUFhO0FBR3pDLElBQU0sYUFBYUQsS0FBSSxhQUNuQkUsTUFBSyxLQUFLLFFBQVEsZUFBYyxxQkFBcUIsUUFBUSxJQUM3REEsTUFBSyxLQUFLLFFBQVE7QUFjdEIsSUFBTSxNQUFNLFFBQVE7QUFDcEIsSUFBSSxJQUFJLFdBQVcsRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLE9BQU8sS0FBSyxFQUFHLENBQUMsQ0FBQztBQUMvRCxJQUFJLElBQUksUUFBUSxLQUFLLEVBQUUsT0FBTyxPQUFPLENBQUMsQ0FBQztBQUN2QyxJQUFJLElBQUksUUFBUSxXQUFXLEVBQUMsVUFBVSxLQUFJLENBQUMsQ0FBQztBQUM1QyxJQUFJLElBQUksSUFBSSxDQUFDO0FBQ2IsSUFBSSxJQUFJLEtBQUssQ0FBQztBQUNkLElBQUksSUFBSSxXQUFVLFFBQVEsT0FBTyxlQUFPLGFBQWEsQ0FBQztBQUN0RCxJQUFJLElBQUksYUFBYSxDQUFDO0FBR3RCLElBQUksb0JBQW9CO0FBR3hCLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3hCLFFBQU0sWUFBWSxLQUFLLElBQUk7QUFDM0IsUUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLElBQUksSUFBSSxHQUFHO0FBRTFDLE1BQUksR0FBRyxVQUFVLE1BQU07QUFDbkIsVUFBTSxXQUFXLEtBQUssSUFBSSxJQUFJO0FBQzlCLFFBQUksV0FBVyxLQUFNO0FBQ2pCLE1BQUFELEtBQUksS0FBSyxrQ0FBa0MsU0FBUyxTQUFTLFFBQVEsSUFBSTtBQUFBLElBQzdFO0FBQ0EsUUFBSSxvQkFBb0IsS0FBSztBQUN6QixNQUFBQSxLQUFJLEtBQUssdUJBQXVCLGlCQUFpQiw4QkFBOEIsU0FBUyxFQUFFO0FBQUEsSUFDOUY7QUFBQSxFQUNKLENBQUM7QUFFRCxNQUFJLEdBQUcsU0FBUyxNQUFNO0FBQ2xCLFFBQUksQ0FBQyxJQUFJLGFBQWE7QUFDbEIsWUFBTSxXQUFXLEtBQUssSUFBSSxJQUFJO0FBQzlCLE1BQUFBLEtBQUksS0FBSyw2Q0FBNkMsU0FBUyxVQUFVLFFBQVEsSUFBSTtBQUFBLElBQ3pGO0FBQUEsRUFDSixDQUFDO0FBRUQsT0FBSztBQUNULENBQUM7QUFFRCxJQUFJLElBQUksV0FBVyxZQUFZO0FBVy9CLElBQUksUUFBUSxhQUFhO0FBRXpCLElBQUksVUFBVTtBQUFBLEVBQ1YsS0FBSyxNQUFNO0FBQUEsRUFDWCxNQUFNLE1BQU07QUFBQSxFQUNaLGFBQWE7QUFBQSxFQUNiLG9CQUFvQjtBQUFBLEVBQ3BCLE9BQU87QUFDVDtBQUVGLElBQU0sU0FBUyxNQUFNLGFBQWEsU0FBUyxHQUFHO0FBRzlDLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLGlCQUFpQjtBQUd4QixPQUFPLEdBQUcsY0FBYyxDQUFDLFdBQVc7QUFDaEM7QUFDQSxNQUFJLG9CQUFvQixLQUFLO0FBQ3pCLElBQUFBLEtBQUksS0FBSyxrQ0FBa0MsaUJBQWlCLEVBQUU7QUFBQSxFQUNsRTtBQUNBLFNBQU8sR0FBRyxTQUFTLE1BQU07QUFDckI7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDO0FBRUQsSUFBSSxlQUFPLGFBQVk7QUFDbkIsU0FBTyxPQUFPLGVBQU8sZUFBZSxNQUFNO0FBQ3RDLElBQUFBLEtBQUksS0FBSyx3Q0FBd0MsZUFBTyxNQUFNLElBQUksZUFBTyxhQUFhLEVBQUU7QUFBQSxFQUM1RixDQUFDO0FBQ0QsTUFBSSxlQUFPLFFBQVE7QUFDZiw0QkFBZ0IsS0FBSztBQUFBLEVBQ3pCO0FBQ0o7QUFNQSxJQUFPLGlCQUFRO0FBS2YsU0FBUyxlQUFlO0FBQ3BCLE1BQUksTUFBTyxNQUFNLElBQUk7QUFDckIsTUFBSSxNQUFNLE1BQU07QUFDaEIsTUFBSSxPQUFPLE1BQU0sT0FBTyxhQUFhLEVBQUU7QUFDdkMsTUFBSSxPQUFPLElBQUksZ0JBQWdCLEVBQUMsTUFBTSxNQUFNLEtBQVUsQ0FBQztBQUN2RCxNQUFJLE9BQU8sSUFBSSxrQkFBa0I7QUFDakMsT0FBSyxZQUFZLEtBQUs7QUFDdEIsT0FBSyxhQUFhLEtBQUs7QUFDdkIsT0FBSyxLQUFLLEtBQUssVUFBVTtBQUN6QixNQUFJLFdBQVcsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVO0FBQ2xELE1BQUksV0FBVyxJQUFJLGlCQUFpQixJQUFJO0FBQ3hDLFNBQU8sRUFBQyxLQUFLLFVBQVcsTUFBTSxTQUFRO0FBQzFDOzs7QVlqTUEsT0FBT0csU0FBUTtBQUdmLFNBQVMsaUJBQUFDLGdCQUFlLFNBQVMsVUFBQUMsZUFBYztBQUMvQyxTQUFRLFFBQUFDLGFBQVc7QUFDbkIsT0FBT0MsVUFBUztBQUNoQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxnQkFBQUMscUJBQW1CO0FBQzVCLE9BQU9DLFNBQVE7QUFHZixPQUFPLG9CQUFvQjtBQUczQixJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQUNiLGNBQWU7QUFDWCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVM7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGFBQWEsQ0FBQztBQUNuQixTQUFLLG9CQUFvQjtBQUFBLEVBQzdCO0FBQUEsRUFDQSxLQUFNLElBQUlDLFNBQVEsSUFBSSxJQUFJO0FBQ3RCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBU0E7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLHVCQUF1QjtBQUs1QixTQUFLLHFCQUFxQixZQUFZO0FBQ2xDLFVBQUksS0FBSyxtQkFBbUI7QUFDeEI7QUFBQSxNQUNKO0FBRUEsV0FBSyxvQkFBb0I7QUFFekIsYUFBTyxLQUFLLFdBQVcsU0FBUyxHQUFHO0FBQy9CLGNBQU0sTUFBTSxLQUFLLFdBQVcsTUFBTTtBQUNsQyxRQUFBQyxLQUFJLEtBQUssMERBQTBELEtBQUssV0FBVyxNQUFNLHNCQUFzQjtBQUUvRyxZQUFJO0FBQ0EsZ0JBQU0sS0FBSyxpQkFBaUIsSUFBSSxXQUFXLElBQUksYUFBYSxJQUFJLFdBQVc7QUFDM0UsY0FBSSxRQUFRLElBQUk7QUFBQSxRQUNwQixTQUFTLE9BQU87QUFDWixVQUFBQSxLQUFJLE1BQU0sc0RBQXNELE1BQU0sT0FBTyxFQUFFO0FBQy9FLGNBQUksT0FBTyxLQUFLO0FBQUEsUUFDcEI7QUFBQSxNQUNKO0FBRUEsV0FBSyxvQkFBb0I7QUFDekIsTUFBQUEsS0FBSSxLQUFLLHdFQUF3RTtBQUFBLElBQ3JGO0FBS0EsU0FBSyxtQkFBbUIsT0FBTyxXQUFXLGFBQWEsZ0JBQWdCO0FBQ25FLGFBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLFlBQUksWUFBWSxJQUFJQyxlQUFjO0FBQUEsVUFDOUIsTUFBTTtBQUFBLFVBQ04sZ0JBQWdCO0FBQUE7QUFBQSxVQUNoQixnQkFBZ0I7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULGFBQWE7QUFBQSxZQUNiLFlBQVk7QUFBQTtBQUFBLFVBQ2hCO0FBQUEsUUFDSixDQUFDO0FBR0Qsa0JBQVUsWUFBWSxjQUFjLENBQUc7QUFFdkMsWUFBSSxVQUFVO0FBQ2QsWUFBSSxnQkFBZ0IsT0FBTztBQUN2QixvQkFBVSwrQkFBK0IsU0FBUztBQUFBLFFBQ3RELFdBQ1MsZ0JBQWdCLFNBQVM7QUFDOUIsb0JBQVUsMEJBQTBCLFNBQVM7QUFBQSxRQUNqRCxPQUFPO0FBQ0gsVUFBQUQsS0FBSSxNQUFNLHNEQUFzRDtBQUNoRSxjQUFJLGFBQWEsQ0FBQyxVQUFVLFlBQVksR0FBRztBQUN2QyxzQkFBVSxNQUFNO0FBQUEsVUFDcEI7QUFDQSxpQkFBTyxJQUFJLE1BQU0sc0JBQXNCLENBQUM7QUFDeEM7QUFBQSxRQUNKO0FBRUEsa0JBQVUsR0FBRyxVQUFVLE1BQU07QUFBRSxzQkFBWTtBQUFBLFFBQU0sQ0FBQztBQUVsRCxrQkFBVSxZQUFZLEdBQUcsb0JBQW9CLFlBQVk7QUFDckQsY0FBSTtBQUNBLGtCQUFNLGdCQUFnQixNQUFNLFVBQVUsWUFBWSxrQkFBa0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBMkJuRTtBQUVELGdCQUFJLGVBQWU7QUFDZixjQUFBQSxLQUFJLEtBQUsseUNBQXlDLFdBQVcsNEJBQTRCLFdBQVcsRUFBRTtBQUd0RyxvQkFBTSxlQUFlLFdBQVcsTUFBTTtBQUNsQyxnQkFBQUEsS0FBSSxNQUFNLGdFQUFnRSxXQUFXLEVBQUU7QUFDdkYsb0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDRCQUFVLE1BQU07QUFBQSxnQkFDcEI7QUFDQSx1QkFBTyxJQUFJLE1BQU0sbUJBQW1CLENBQUM7QUFBQSxjQUN6QyxHQUFHLEdBQUs7QUFFUix3QkFBVSxZQUFZLE1BQU07QUFBQSxnQkFDeEIsUUFBUTtBQUFBLGdCQUNSLFlBQVk7QUFBQSxnQkFDWixpQkFBaUI7QUFBQSxnQkFDakIsYUFBYTtBQUFBLGdCQUNiLGVBQWU7QUFBQSxnQkFDZixXQUFXO0FBQUEsZ0JBQ1gsS0FBSztBQUFBLGtCQUNELFlBQVk7QUFBQSxrQkFDWixVQUFVO0FBQUEsZ0JBQ2Q7QUFBQSxnQkFDQSxVQUFVO0FBQUEsZ0JBQ1YsU0FBUztBQUFBLGtCQUNMLFlBQVk7QUFBQSxnQkFDaEI7QUFBQSxjQUNKLEdBQUcsQ0FBQyxTQUFTLGtCQUFrQjtBQUMzQiw2QkFBYSxZQUFZO0FBRXpCLG9CQUFJLENBQUMsU0FBUztBQUNWLGtCQUFBQSxLQUFJLE1BQU0sK0RBQStELFdBQVcsS0FBSyxpQkFBaUIsZ0JBQWdCLEVBQUU7QUFDNUgsc0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDhCQUFVLE1BQU07QUFBQSxrQkFDcEI7QUFDQSx5QkFBTyxJQUFJLE1BQU0saUJBQWlCLGtCQUFrQixDQUFDO0FBQUEsZ0JBQ3pELE9BQU87QUFDSCxrQkFBQUEsS0FBSSxLQUFLLHVGQUF1RixXQUFXLEVBQUU7QUFDN0csc0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLDhCQUFVLE1BQU07QUFBQSxrQkFDcEI7QUFDQSwwQkFBUSxJQUFJO0FBQUEsZ0JBQ2hCO0FBQUEsY0FDSixDQUFDO0FBQUEsWUFDTCxPQUFPO0FBQ0gsY0FBQUEsS0FBSSxNQUFNLHdEQUF3RDtBQUNsRSxrQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsMEJBQVUsTUFBTTtBQUFBLGNBQ3BCO0FBQ0EscUJBQU8sSUFBSSxNQUFNLHdCQUF3QixDQUFDO0FBQUEsWUFDOUM7QUFBQSxVQUNKLFNBQVMsT0FBTztBQUNaLFlBQUFBLEtBQUksTUFBTSwwREFBMEQsTUFBTSxPQUFPLEVBQUU7QUFDbkYsZ0JBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLHdCQUFVLE1BQU07QUFBQSxZQUNwQjtBQUNBLG1CQUFPLEtBQUs7QUFBQSxVQUNoQjtBQUFBLFFBQ0osQ0FBQztBQUVELGtCQUFVLFFBQVEsT0FBTyxFQUFFLE1BQU0sQ0FBQyxVQUFVO0FBQ3hDLFVBQUFBLEtBQUksTUFBTSxxREFBcUQsTUFBTSxPQUFPLEVBQUU7QUFDOUUsY0FBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsc0JBQVUsTUFBTTtBQUFBLFVBQ3BCO0FBQ0EsaUJBQU8sS0FBSztBQUFBLFFBQ2hCLENBQUM7QUFBQSxNQUNMLENBQUM7QUFBQSxJQUNMO0FBS0EsWUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLFlBQVk7QUFDdkMsTUFBQUEsS0FBSSxLQUFLLCtEQUErRCxPQUFPO0FBQy9FLFdBQUssY0FBYyxrQkFBa0IsT0FBTztBQUM1QyxZQUFNLGNBQWM7QUFBQSxJQUN4QixDQUFDO0FBS0QsWUFBUSxPQUFPLG1CQUFtQixDQUFDLE9BQU8sZUFBZTtBQUNyRCxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLFVBQVc7QUFBRSxlQUFPLFNBQVM7QUFBQSxNQUFjLE9BQzFDO0FBQVksZUFBTztBQUFBLE1BQU87QUFBQSxJQUNuQyxDQUFDO0FBTUQsWUFBUSxPQUFPLGNBQWMsQ0FBQyxPQUFPLGVBQWU7QUFDaEQsWUFBTSxXQUFXLEtBQUssT0FBTyxlQUFlLFVBQVU7QUFDdEQsVUFBSSxVQUFXO0FBQ1gsaUJBQVMsa0JBQWtCLEtBQUs7QUFDaEMsaUJBQVMsT0FBTyxNQUFNO0FBQ3RCLGVBQU9ELFFBQU8sZUFBZSxVQUFVO0FBQ3ZDLGFBQUssZ0JBQWdCLGlCQUFpQixLQUFLLGdCQUFnQixlQUFlLE9BQU8sVUFBUSxLQUFLLGVBQWUsVUFBVTtBQUN2SCxlQUFPO0FBQUEsTUFDWCxPQUNLO0FBQUcsZUFBTztBQUFBLE1BQU87QUFBQSxJQUMxQixDQUFDO0FBSUQsWUFBUSxPQUFPLGVBQWUsQ0FBQyxPQUFPLGVBQWU7QUFDakQsWUFBTSxXQUFXLEtBQUssT0FBTyxlQUFlLFVBQVU7QUFDdEQsVUFBSSxVQUFXO0FBQ1gsZUFBTyxFQUFDLGFBQWEsU0FBUyxZQUFXO0FBQUEsTUFDN0MsT0FDSztBQUNELGVBQU8sRUFBQyxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxhQUFhLENBQUMsRUFBQztBQUFBLE1BQ2xGO0FBQUEsSUFDSixDQUFDO0FBTUQsWUFBUSxHQUFHLGNBQWMsQ0FBQyxVQUFVO0FBQUUsV0FBSyxjQUFjLG1CQUFtQjtBQUFJLFlBQU0sY0FBYztBQUFBLElBQUssQ0FBQztBQUkxRyxZQUFRLEdBQUcsYUFBYSxDQUFDLFVBQVU7QUFDL0IsWUFBTSxjQUFjLEtBQUssV0FBV0EsT0FBTTtBQUFBLElBQzlDLENBQUM7QUFJRCxZQUFRLE9BQU8sa0JBQWtCLENBQUMsVUFBVTtBQUN4QyxhQUFPLEtBQUssV0FBV0EsT0FBTTtBQUFBLElBQ2pDLENBQUM7QUFJRCxZQUFRLE9BQU8sY0FBYyxPQUFPLFVBQVU7QUFDMUMsWUFBTSxNQUFNLEtBQUssY0FBYztBQUMvQixVQUFJLENBQUMsSUFBSztBQUVWLFlBQU0sSUFBSSxZQUFZLFFBQVEsV0FBVztBQUN6QyxZQUFNLElBQUksWUFBWSxRQUFRLGlCQUFpQjtBQUFBLFFBQzNDLFVBQVUsQ0FBQyxTQUFTO0FBQUEsTUFDdEIsQ0FBQztBQUVILE1BQUFBLFFBQU8sY0FBYztBQUVyQixNQUFBQyxLQUFJLEtBQUssa0RBQWtEO0FBQzNELGFBQU8sS0FBSyxXQUFXRCxPQUFNO0FBQUEsSUFDakMsQ0FBQztBQU1ELFlBQVEsT0FBTyxZQUFZLENBQUMsT0FBTyxhQUFhO0FBQzVDLFlBQU0sTUFBTSxRQUFRLGFBQWEsVUFBVSxjQUFjLFFBQVEsTUFDakUsUUFBUSxhQUFhLFdBQVcsU0FBUyxRQUFRLE1BQ2pELGFBQWEsUUFBUTtBQUVyQixVQUFJO0FBQ0EsYUFBSyxLQUFLLENBQUMsVUFBVTtBQUNqQixjQUFJLE9BQU87QUFDUCxZQUFBQyxLQUFJLE1BQU0sZ0VBQWdFLEtBQUs7QUFDL0UsbUJBQU87QUFBQSxVQUNYO0FBQ0EsVUFBQUEsS0FBSSxLQUFLLHVEQUF1RDtBQUNoRSxpQkFBTztBQUFBLFFBQ1gsQ0FBQztBQUFBLE1BQ0wsU0FDTSxLQUFJO0FBQ04sUUFBQUEsS0FBSSxNQUFNLDZDQUE2QyxHQUFHO0FBQzFELGVBQU87QUFBQSxNQUNYO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxHQUFHLHFCQUFxQixDQUFDLFVBQVU7QUFBSSxZQUFNLGNBQWNELFFBQU87QUFBQSxJQUFlLENBQUM7QUFHMUYsWUFBUSxPQUFPLGtCQUFrQixZQUFZO0FBQ3JDLFVBQUksWUFBWSxNQUFNLGVBQWVBLFFBQU8sYUFBYTtBQUN6RCxVQUFJLE9BQU8sS0FBSyxNQUFNLFVBQVUsT0FBTyxPQUFPLE9BQU8sT0FBTyxHQUFJLElBQUk7QUFFcEUsYUFBTztBQUFBLElBQ2YsQ0FBQztBQUVELFlBQVEsT0FBTyxnQkFBZ0IsT0FBTyxPQUFPLFFBQVE7QUFDakQsWUFBTSxTQUFTLE1BQU1HLFFBQU8sZUFBZ0IsS0FBSyxjQUFjLFlBQVksRUFBRSxZQUFZLENBQUMsZUFBZSxFQUFHLENBQUM7QUFDN0csVUFBSSxDQUFDLE9BQU8sVUFBUztBQUNqQixRQUFBRixLQUFJLEtBQUssd0JBQXdCLE9BQU8sU0FBUztBQUNqRCxZQUFJLFVBQVU7QUFDZCxZQUFJO0FBQ0EsY0FBSSxVQUFVRyxNQUFLLE9BQU8sVUFBVSxDQUFDLEdBQU1KLFFBQU8sZUFBZTtBQUNqRSxjQUFJLENBQUNLLElBQUcsV0FBVyxPQUFPLEdBQUU7QUFBQyxZQUFBQSxJQUFHLFVBQVUsT0FBTztBQUFBLFVBQUM7QUFDbEQsb0JBQVU7QUFFVixVQUFBTCxRQUFPLGtCQUFrQjtBQUN6QixVQUFBQyxLQUFJLEtBQUssOEJBQThCRCxPQUFNO0FBQUEsUUFDakQsU0FDTyxHQUFFO0FBQ0wsb0JBQVU7QUFDVixVQUFBQyxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQ2Y7QUFDQSxlQUFPLEVBQUMsV0FBV0QsUUFBTyxpQkFBaUIsUUFBaUI7QUFBQSxNQUNoRSxPQUNLO0FBQ0QsZUFBTyxFQUFDLFdBQVdBLFFBQU8saUJBQWlCLFNBQVUsV0FBVTtBQUFBLE1BQ25FO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxHQUFHLHNCQUFzQixPQUFPLE9BQU8sWUFBWTtBQUN2RCxVQUFJLFNBQVE7QUFDUixRQUFBQyxLQUFJLEtBQUssK0JBQStCLE9BQU87QUFDL0MsWUFBSSxVQUFVO0FBQ2QsWUFBSTtBQUNBLGNBQUksQ0FBQ0ksSUFBRyxXQUFXLE9BQU8sR0FBRTtBQUFDLFlBQUFBLElBQUcsVUFBVSxPQUFPO0FBQUEsVUFBQztBQUNsRCxvQkFBVTtBQUNWLFVBQUFMLFFBQU8sZ0JBQWdCO0FBQUEsUUFDM0IsU0FDTyxHQUFFO0FBQ0wsb0JBQVU7QUFDVixVQUFBQyxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQ2Y7QUFDQSxjQUFNLGNBQWMsRUFBQyxTQUFTRCxRQUFPLGVBQWUsUUFBaUI7QUFBQSxNQUN6RSxPQUNLO0FBQUcsY0FBTSxjQUFjLEVBQUMsU0FBU0EsUUFBTyxlQUFlLFNBQVUsV0FBVTtBQUFBLE1BQUU7QUFBQSxJQUN0RixDQUFDO0FBR0QsWUFBUSxPQUFPLDBCQUEwQixPQUFPLE9BQU8sU0FBUztBQUM1RCxVQUFJLFVBQVU7QUFDZCxZQUFNLFVBQVVJLE1BQUtKLFFBQU8sZUFBZSxLQUFLLFFBQVE7QUFDeEQsWUFBTSxXQUFXSSxNQUFLLFNBQVMsbUJBQW1CO0FBR2xELFVBQUk7QUFDQSxZQUFJLENBQUNDLElBQUcsV0FBVyxPQUFPLEdBQUU7QUFBQyxVQUFBQSxJQUFHLFVBQVUsT0FBTztBQUFBLFFBQUM7QUFDbEQsa0JBQVU7QUFBQSxNQUNkLFNBQ08sR0FBRTtBQUNMLGtCQUFVLEVBQUU7QUFDWixRQUFBSixLQUFJLE1BQU0sQ0FBQztBQUFBLE1BQ2Y7QUFFQSxVQUFJO0FBQ0EsY0FBTSxhQUFhLEtBQUssVUFBVSxNQUFNLE1BQU0sQ0FBQztBQUUvQyxhQUFLLE1BQU0sVUFBVTtBQUNyQixRQUFBSSxJQUFHLGNBQWMsVUFBVSxVQUFVO0FBQUEsTUFDekMsU0FDTyxPQUFPO0FBQ1YsUUFBQUosS0FBSSxNQUFNLHlFQUF5RSxLQUFLLEVBQUU7QUFDMUYsa0JBQVU7QUFBQSxNQUNkO0FBRUEsWUFBTSxjQUFjLEVBQUMsUUFBaUI7QUFBQSxJQUUxQyxDQUFDO0FBS0QsWUFBUSxPQUFPLFVBQVUsT0FBTyxVQUFVO0FBQ3RDLFlBQU0sVUFBVUcsTUFBS0osUUFBTyxlQUFjLEdBQUc7QUFDN0MsVUFBSSxXQUFXSSxNQUFLLFNBQVEsdUJBQXVCO0FBRW5ELFVBQUk7QUFDQSxZQUFJLE9BQU9DLElBQUcsYUFBYSxVQUFVLE1BQU07QUFFM0MsWUFBSSxZQUFZLEtBQUssS0FBSyxFQUN6QixNQUFNLElBQUksRUFDVixJQUFJLFVBQVE7QUFDWCxnQkFBTSxRQUFRLEtBQUssTUFBTSxnQ0FBZ0M7QUFDekQsY0FBSSxPQUFPO0FBQ1Qsa0JBQU0sQ0FBQyxFQUFFLE1BQU0sTUFBTSxPQUFPLElBQUk7QUFHaEMsZ0JBQUk7QUFDSixvQkFBUSxLQUFLLFlBQVksR0FBRztBQUFBLGNBQzFCLEtBQUs7QUFDSCx3QkFBUTtBQUNSO0FBQUEsY0FDRixLQUFLO0FBQ0gsd0JBQVE7QUFDUjtBQUFBLGNBQ0YsS0FBSztBQUNILHdCQUFRO0FBQ1I7QUFBQSxjQUNGO0FBQ0Usd0JBQVE7QUFBQSxZQUNaO0FBR0EsZ0JBQUksU0FBUztBQUNiLGdCQUFJLE9BQU87QUFHWCxnQkFBSSxRQUFRLFNBQVMsR0FBRyxHQUFHO0FBQ3pCLG9CQUFNLGFBQWEsUUFBUSxRQUFRLEdBQUc7QUFDdEMsdUJBQVMsUUFBUSxVQUFVLEdBQUcsVUFBVSxFQUFFLEtBQUs7QUFDL0MscUJBQU8sUUFBUSxVQUFVLGFBQWEsQ0FBQyxFQUFFLEtBQUs7QUFBQSxZQUNoRDtBQUVBLG1CQUFPLEVBQUUsTUFBTSxNQUFNLE1BQU0sT0FBTyxPQUFPO0FBQUEsVUFDM0M7QUFDQSxpQkFBTztBQUFBLFFBQ1QsQ0FBQyxFQUNBLE9BQU8sVUFBUSxTQUFTLElBQUk7QUFHN0IsZUFBTztBQUFBLE1BQ1gsU0FDTyxLQUFLO0FBQ1IsUUFBQUosS0FBSSxNQUFNLHdCQUF3QixHQUFHLEVBQUU7QUFDdkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUVKLENBQUM7QUFPRCxZQUFRLE9BQU8sZUFBZSxPQUFPLE9BQU8sUUFBUTtBQUNoRCxVQUFJLGNBQWMsQ0FBQztBQUNuQixVQUFJSSxJQUFHLFdBQVdMLFFBQU8sYUFBYSxHQUFHO0FBQ3JDLGNBQU0sVUFBVUssSUFBRyxZQUFZTCxRQUFPLGVBQWUsRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUN2RSxPQUFPLFlBQVUsT0FBTyxZQUFZLENBQUMsRUFDckMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUM5QixtQkFBVyxXQUFXLFNBQVM7QUFDM0IsZ0JBQU0sbUJBQW1CSSxNQUFLSixRQUFPLGVBQWUsU0FBUyxtQkFBbUI7QUFDaEYsY0FBSUssSUFBRyxXQUFXLGdCQUFnQixHQUFHO0FBQ3JDLGdCQUFJO0FBQ0Esb0JBQU0sZUFBZSxLQUFLLE1BQU1BLElBQUcsYUFBYSxrQkFBa0IsT0FBTyxDQUFDO0FBQzFFLGtCQUFJLENBQUMsYUFBYSxVQUFVO0FBQ3hCLDZCQUFhLFdBQVc7QUFBQSxjQUM1QjtBQUNBLDBCQUFZLEtBQUssWUFBWTtBQUFBLFlBQ2pDLFNBQVMsR0FBRztBQUNSLGNBQUFKLEtBQUksTUFBTSxnRUFBZ0UsT0FBTyxLQUFLLENBQUM7QUFBQSxZQUMzRjtBQUFBLFVBQ0E7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUNBLGFBQU87QUFBQSxJQUNULENBQUM7QUFPSCxZQUFRLE9BQU8sZUFBZSxPQUFPLE9BQU8sUUFBUTtBQUNoRCxVQUFJLFVBQVVHLE1BQU1KLFFBQU8sZUFBZSxHQUFHO0FBQzdDLFVBQUlLLElBQUcsU0FBUyxPQUFPLEVBQUUsWUFBWSxHQUFFO0FBQ25DLFlBQUk7QUFDQSxVQUFBQSxJQUFHLE9BQU8sU0FBUyxFQUFFLFdBQVcsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUFBLFFBQ3ZELFNBQ08sR0FBRztBQUFDLFVBQUFKLEtBQUksTUFBTSxDQUFDO0FBQUEsUUFBQztBQUFBLE1BQzNCO0FBQ0EsYUFBTztBQUFBLElBQ1gsQ0FBQztBQUlELFlBQVEsT0FBTywrQkFBK0IsT0FBTyxPQUFPLGFBQWE7QUFDckUsVUFBSTtBQUNBLGNBQU0sYUFBYUksSUFBRyxhQUFhLFVBQVUsUUFBUTtBQUNyRCxlQUFPLEVBQUUsWUFBd0IsUUFBUSxVQUFVO0FBQUEsTUFDdkQsU0FDTyxHQUFHO0FBQ04sUUFBQUosS0FBSSxNQUFNLDZDQUE2QyxDQUFDLEVBQUU7QUFDMUQsZUFBTyxFQUFFLFlBQVksT0FBTyxRQUFRLFFBQVE7QUFBQSxNQUNoRDtBQUFBLElBQ0osQ0FBQztBQVdGLFlBQVEsT0FBTyxrQkFBa0IsT0FBTyxPQUFPLFlBQVksd0JBQXdCO0FBQzlFLFlBQU0sV0FBVyxLQUFLLE9BQU8sZUFBZSxVQUFVO0FBQ3RELFlBQU0sZUFBZSxLQUFLLE1BQU0sbUJBQW1CO0FBQ25ELFVBQUksQ0FBQyxVQUFVO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLGFBQWEsQ0FBQyxFQUFFO0FBQUEsTUFBRTtBQUNuRyxVQUFJLGNBQWMsQ0FBQztBQUNuQixVQUFJLE1BQU9HLE1BQU1KLFFBQU8sZUFBZSxTQUFTLFdBQVcsVUFBVTtBQUVyRSxVQUFJSyxJQUFHLFdBQVcsR0FBRyxHQUFHO0FBQ3BCLGNBQU0sVUFBVUEsSUFBRyxZQUFZLEtBQUssRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUN0RCxPQUFPLFlBQVUsT0FBTyxZQUFZLENBQUMsRUFDckMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUU5QixtQkFBVyxlQUFlLFNBQVM7QUFDL0IsY0FBSSxZQUFZLFlBQVksTUFBTSxXQUFXO0FBQ3pDO0FBQUEsVUFDSjtBQUVBLGNBQUksV0FBVyxDQUFDO0FBQ2hCLGNBQUksZ0JBQWdCRCxNQUFLLEtBQUssYUFBYSxRQUFRO0FBR25ELG1CQUFTLFVBQVUsR0FBRyxXQUFXLEdBQUcsV0FBVztBQUMzQyxnQkFBSSxhQUFhQSxNQUFLLGVBQWUsT0FBTyxPQUFPLENBQUM7QUFHcEQscUJBQVMsT0FBTyxJQUFJO0FBQUEsY0FDaEIsTUFBTTtBQUFBLGNBQ04sVUFBVTtBQUFBLGNBQ1YsTUFBTTtBQUFBLGNBQ04sYUFBYTtBQUFBLFlBQ2pCO0FBRUEsZ0JBQUlDLElBQUcsV0FBVyxVQUFVLEdBQUc7QUFDM0Isa0JBQUksZUFBZUEsSUFBRyxZQUFZLFlBQVksRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUNoRSxPQUFPLFlBQVUsT0FBTyxPQUFPLENBQUMsRUFDaEMsSUFBSSxZQUFVLE9BQU8sSUFBSTtBQUU5QixrQkFBSSxhQUFhLFNBQVMsR0FBRztBQUN6QixvQkFBSSxtQkFBbUIsYUFDbEIsSUFBSSxVQUFRO0FBQ1Qsc0JBQUksV0FBV0QsTUFBSyxZQUFZLElBQUk7QUFDcEMseUJBQU8sRUFBRSxNQUFNLE9BQU9DLElBQUcsU0FBUyxRQUFRLEVBQUUsTUFBTTtBQUFBLGdCQUN0RCxDQUFDLEVBQ0EsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQztBQUV4Qyx5QkFBUyxPQUFPLElBQUk7QUFBQSxrQkFDaEIsTUFBTUQsTUFBSyxZQUFZLGlCQUFpQixJQUFJO0FBQUEsa0JBQzVDLFVBQVUsaUJBQWlCO0FBQUEsa0JBQzNCLE1BQU0saUJBQWlCO0FBQUEsa0JBQ3ZCLGFBQWEsYUFBYSxhQUFhLE9BQU8sRUFBRTtBQUFBLGdCQUNwRDtBQUFBLGNBQ0o7QUFBQSxZQUNKO0FBQUEsVUFDSjtBQUVBLHNCQUFZLEtBQUs7QUFBQSxZQUNiO0FBQUEsWUFDQTtBQUFBLFVBQ0osQ0FBQztBQUFBLFFBQ0w7QUFBQSxNQUNKO0FBQ0EsYUFBTztBQUFBLElBQ1gsQ0FBQztBQWlCRCxZQUFRLE9BQU8sb0JBQW9CLE9BQU8sT0FBTyxZQUFZLGdCQUFnQjtBQUN6RSxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLENBQUMsVUFBVTtBQUFFLGVBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxVQUFVLE1BQU07QUFBQSxNQUFFO0FBQ25HLFVBQUksZ0JBQWdCO0FBQ3BCLFVBQUksTUFBT0EsTUFBTUosUUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFdBQVc7QUFHbEYsVUFBSSxDQUFDSyxJQUFHLFdBQVcsR0FBRyxHQUFHO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsTUFBTTtBQUFBLE1BQUU7QUFLN0csWUFBTSxvQkFBb0JBLElBQUcsWUFBWSxLQUFLLEVBQUUsZUFBZSxLQUFLLENBQUMsRUFDaEUsT0FBTyxZQUFVLE9BQU8sWUFBWSxLQUFLLE9BQU8sU0FBUyxZQUFZLE9BQU8sU0FBUyxXQUFXLEVBQ2hHLElBQUksWUFBVTtBQUNYLFlBQUksV0FBV0QsTUFBSyxLQUFLLE9BQU8sSUFBSTtBQUNwQyxlQUFPLEVBQUUsTUFBTSxPQUFPLE1BQU0sT0FBT0MsSUFBRyxTQUFTLFFBQVEsRUFBRSxNQUFNO0FBQUEsTUFDbkUsQ0FBQyxFQUNBLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSztBQUVyQyxVQUFJLGtCQUFrQixXQUFXLEdBQUc7QUFDaEMsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsTUFBTTtBQUFBLE1BQ3BGO0FBRUEsVUFBSSx3QkFBd0Isa0JBQWtCLENBQUMsRUFBRTtBQUNqRCxNQUFBSixLQUFJLEtBQUssdUVBQXVFLEtBQUsscUJBQXFCO0FBQzFHLFlBQU0sb0JBQW9CRyxNQUFLLEtBQUssdUJBQXVCLGNBQWMsTUFBTTtBQUMvRSxZQUFNLDRCQUE0QkEsTUFBSyxLQUFLLHFCQUFxQjtBQUdqRSxVQUFJLENBQUNDLElBQUcsV0FBVyxpQkFBaUIsR0FBRztBQUFFLGVBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxZQUFZLFFBQVEsU0FBUyxVQUFVLE9BQU8sMkJBQTBCLDZCQUE2QixNQUFNO0FBQUEsTUFBRTtBQUV6TCxhQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVEsV0FBVyxRQUFRLFdBQVcsVUFBVSxtQkFBbUIsMEJBQXFEO0FBQUEsSUFFdkosQ0FBQztBQWVELFlBQVEsT0FBTyxlQUFlLFlBQVk7QUFDdEMsWUFBTSxXQUFXLE1BQU0sS0FBSyxjQUFjLFdBQVcsWUFBWSxpQkFBaUI7QUFFbEYsWUFBTSxjQUFjLFNBQVMsSUFBSSxjQUFZO0FBQUEsUUFDekMsYUFBYSxRQUFRO0FBQUEsUUFDckIsV0FBVyxTQUFTLFdBQVcsSUFBSSxPQUFPLFFBQVE7QUFBQTtBQUFBLFFBQ2xELGFBQWEsUUFBUTtBQUFBLE1BQ3pCLEVBQUU7QUFFRixhQUFPO0FBQUEsSUFDWCxDQUFDO0FBV0QsWUFBUSxPQUFPLGVBQWUsT0FBTyxPQUFPLFdBQVcsYUFBYSxnQkFBZ0I7QUFDaEYsVUFBSTtBQUNBLGVBQU8sTUFBTSxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFFMUMsZUFBSyxXQUFXLEtBQUs7QUFBQSxZQUNqQjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKLENBQUM7QUFFRCxVQUFBSixLQUFJLEtBQUssMkRBQTJELEtBQUssV0FBVyxNQUFNLGlCQUFpQjtBQUczRyxjQUFJLENBQUMsS0FBSyxtQkFBbUI7QUFDekIsaUJBQUssbUJBQW1CLEVBQUUsTUFBTSxDQUFDLFVBQVU7QUFDdkMsY0FBQUEsS0FBSSxNQUFNLHFEQUFxRCxNQUFNLE9BQU8sRUFBRTtBQUFBLFlBQ2xGLENBQUM7QUFBQSxVQUNMO0FBQUEsUUFDSixDQUFDO0FBQUEsTUFDTCxTQUFTLE9BQU87QUFDWixRQUFBQSxLQUFJLEtBQUssMERBQTBELE1BQU0sT0FBTyxFQUFFO0FBQ2xGLGVBQU8sRUFBRSxTQUFTLE9BQU8sT0FBTyxNQUFNLFFBQVE7QUFBQSxNQUNsRDtBQUFBLElBQ0osQ0FBQztBQVFELFlBQVEsR0FBRyxlQUFlLE9BQU8sVUFBVTtBQUV2QyxZQUFNLGFBQWEsa0JBQWtCO0FBQ3JDLFdBQUssc0JBQXNCO0FBRzNCLGFBQU8sS0FBSyxVQUFVLEVBQUUsUUFBUSxDQUFDLGtCQUFrQjtBQUMvQyxtQkFBVyxhQUFhLEVBQUUsUUFBUSxDQUFDLFVBQVU7QUFFekMsY0FBSSxNQUFNLFdBQVcsVUFDakIsQ0FBQyxNQUFNLFFBQVEsV0FBVyxNQUFNLEtBQ2hDLENBQUMsTUFBTSxRQUFRLFdBQVcsVUFBVSxHQUFHO0FBQ3ZDLGdCQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDM0IsbUJBQUssc0JBQXNCLENBQUM7QUFBQSxZQUNoQztBQUNBLGlCQUFLLG9CQUFvQixLQUFLO0FBQUEsY0FDMUIsTUFBTTtBQUFBLGNBQ04sU0FBUyxNQUFNO0FBQUEsWUFDbkIsQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKLENBQUM7QUFBQSxNQUNMLENBQUM7QUFHRCxZQUFNLFlBQVksS0FBSyxPQUFPO0FBRzlCLFVBQUksS0FBSyxvQkFBb0I7QUFDekIsY0FBTSxZQUFZLEtBQUsscUJBQXFCLEtBQUssV0FBUyxNQUFNLFNBQVMsS0FBSyxrQkFBa0I7QUFDaEcsWUFBSSxXQUFXO0FBQ1gsZUFBSyxPQUFPLFNBQVMsVUFBVTtBQUMvQixlQUFLLE9BQU8sWUFBWSxVQUFVO0FBRWxDLGNBQUk7QUFDQSxrQkFBTSxFQUFDLFNBQVMsU0FBUyxJQUFHLElBQUlLLGNBQWEsVUFBVSxJQUFJO0FBQzNELGlCQUFLLE9BQU8sVUFBVSxRQUFRLEtBQUs7QUFBQSxVQUN2QyxTQUFTLEdBQUc7QUFDUixpQkFBSyxPQUFPLFVBQVU7QUFBQSxVQUMxQjtBQUFBLFFBQ0o7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJO0FBQ0EsZ0JBQU0sRUFBQyxTQUFTLFNBQVMsSUFBRyxJQUFLQSxjQUFhO0FBQzlDLGVBQUssT0FBTyxTQUFTQyxJQUFHLFFBQVEsR0FBRztBQUNuQyxlQUFLLE9BQU8sWUFBWTtBQUN4QixlQUFLLE9BQU8sVUFBVTtBQUFBLFFBQzFCLFNBQ08sR0FBRztBQUNOLGVBQUssT0FBTyxTQUFTO0FBQ3JCLGVBQUssT0FBTyxVQUFVO0FBQUEsUUFDMUI7QUFFQSxZQUFJLENBQUMsS0FBSyxPQUFPLFFBQVE7QUFDckIsY0FBSTtBQUNBLGlCQUFLLE9BQU8sU0FBU0EsSUFBRyxRQUFRO0FBRWhDLGtCQUFNLGdCQUFnQixPQUFPLEtBQUssVUFBVSxFQUFFLEtBQUssU0FBTyxXQUFXLEdBQUcsRUFBRSxLQUFLLFdBQVMsTUFBTSxZQUFZLEtBQUssT0FBTyxNQUFNLENBQUM7QUFDN0gsaUJBQUssT0FBTyxZQUFZO0FBQUEsVUFFNUIsU0FDTyxHQUFHO0FBQ04sWUFBQU4sS0FBSSxNQUFNLDBEQUEwRDtBQUNwRSxpQkFBSyxPQUFPLFNBQVM7QUFDckIsaUJBQUssT0FBTyxVQUFVO0FBQ3RCLGlCQUFLLE9BQU8sWUFBWTtBQUFBLFVBQzVCO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFHQSxVQUFJLEtBQUssT0FBTyxVQUFVLGFBQWE7QUFBRSxhQUFLLE9BQU8sU0FBUztBQUFBLE1BQU07QUFHcEUsVUFBSSxjQUFjLEtBQUssT0FBTyxVQUFVLEtBQUssT0FBTyxRQUFRO0FBQ3hELFFBQUFBLEtBQUksS0FBSyx5QkFBeUIsU0FBUyxPQUFPLEtBQUssT0FBTyxNQUFNLDhCQUE4QjtBQUdsRyxZQUFJLEtBQUssbUJBQW1CLEtBQUssZ0JBQWdCLE9BQU8sUUFBUSxHQUFHO0FBQy9ELGNBQUk7QUFDQSxrQkFBTSxLQUFLLGdCQUFnQixLQUFLO0FBQ2hDLGlCQUFLLGdCQUFnQixLQUFLLEtBQUssT0FBTyxPQUFPO0FBQzdDLFlBQUFBLEtBQUksS0FBSyxzQ0FBc0M7QUFBQSxVQUNuRCxTQUNPLEdBQUc7QUFDTixZQUFBQSxLQUFJLE1BQU0sa0RBQWtELENBQUM7QUFBQSxVQUNqRTtBQUFBLFFBQ0o7QUFHQSxZQUFJLGdCQUFRO0FBQ1IsY0FBSSxlQUFPLFdBQVc7QUFDbEIsMkJBQU8sTUFBTSxNQUFNO0FBQ2YsY0FBQUEsS0FBSSxLQUFLLCtDQUErQztBQUN4RCw2QkFBTyxPQUFPRCxRQUFPLGVBQWUsTUFBTTtBQUN0QyxnQkFBQUMsS0FBSSxLQUFLLDZDQUE2Q0QsUUFBTyxNQUFNLElBQUlBLFFBQU8sYUFBYSxFQUFFO0FBQUEsY0FDakcsQ0FBQztBQUFBLFlBQ0wsQ0FBQztBQUFBLFVBQ0wsT0FDSztBQUNELDJCQUFPLE9BQU9BLFFBQU8sZUFBZSxNQUFNO0FBQ3RDLGNBQUFDLEtBQUksS0FBSywyQ0FBMkNELFFBQU8sTUFBTSxJQUFJQSxRQUFPLGFBQWEsRUFBRTtBQUFBLFlBQy9GLENBQUM7QUFBQSxVQUNMO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFLQSxZQUFNLGNBQWM7QUFBQSxRQUNoQixRQUFRLEtBQUssT0FBTztBQUFBLFFBQ3BCLFdBQVcsS0FBSyxPQUFPO0FBQUEsUUFDdkIscUJBQXFCLEtBQUs7QUFBQSxRQUMxQixvQkFBb0IsS0FBSztBQUFBLE1BQzdCO0FBQUEsSUFDSixDQUFDO0FBR0QsWUFBUSxPQUFPLHlCQUF5QixDQUFDLE9BQU8sUUFBUTtBQUNwRCxXQUFLLHFCQUFxQjtBQUFBLElBQzlCLENBQUM7QUFFRCxZQUFRLEdBQUcsMkJBQTJCLENBQUMsVUFBVTtBQUM3QyxXQUFLLHFCQUFxQjtBQUMxQixZQUFNLGNBQWM7QUFBQSxRQUNoQixRQUFRLEtBQUssT0FBTztBQUFBLFFBQ3BCLFdBQVcsS0FBSyxPQUFPO0FBQUEsUUFDdkIscUJBQXFCLEtBQUs7QUFBQSxRQUMxQixvQkFBb0IsS0FBSztBQUFBLE1BQzdCO0FBQUEsSUFDSixDQUFDO0FBb0JELFlBQVEsR0FBRyxzQkFBc0IsT0FBTyxPQUFPLFNBQVM7QUFDcEQsTUFBQUMsS0FBSSxLQUFLLCtCQUErQjtBQUN4QyxZQUFNLGNBQWMsS0FBSztBQUN6QixZQUFNLGNBQWMsS0FBSztBQUN6QixZQUFNLFdBQVcsS0FBSztBQUN0QixZQUFNLFNBQVMsS0FBSztBQUNwQixZQUFNLGFBQWEsS0FBSztBQUd4QixVQUFJLG1CQUFvQkcsTUFBS0osUUFBTyxlQUFlLFlBQVksV0FBVztBQUMxRSxVQUFJLE9BQU8sSUFBSSxNQUFLLG9CQUFJLEtBQUssR0FBRSxRQUFRLENBQUMsRUFBRSxtQkFBbUI7QUFDN0QsVUFBSSxVQUFVLE9BQU8sSUFBSSxFQUFFLFFBQVEsTUFBTSxHQUFHO0FBQzVDLFVBQUksb0JBQW9CSSxNQUFLLGtCQUFrQixPQUFPO0FBRXRELFVBQUk7QUFDQSxZQUFJLENBQUNDLElBQUcsV0FBVyxnQkFBZ0IsR0FBRztBQUFFLFVBQUFBLElBQUcsVUFBVSxrQkFBa0IsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQUk7QUFDOUYsWUFBSSxDQUFDQSxJQUFHLFdBQVcsaUJBQWlCLEdBQUU7QUFBRSxVQUFBQSxJQUFHLFVBQVUsbUJBQW1CLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxRQUFHO0FBQUEsTUFDbEcsU0FBUyxHQUFHO0FBQUMsUUFBQUosS0FBSSxNQUFNLENBQUM7QUFBQSxNQUFDO0FBR3pCLFlBQU0sZUFBZSxNQUFNLE1BQU0sbURBQW1ELE1BQU0sWUFBWTtBQUFBLFFBQ2xHLFNBQVMsRUFBQyxpQkFBaUIsVUFBVSxXQUFXLEdBQUs7QUFBQSxNQUN6RCxDQUFDLEVBQUUsTUFBTyxTQUFPO0FBQUMsUUFBQUEsS0FBSSxNQUFNLEdBQUc7QUFBQSxNQUFDLENBQUM7QUFFakMsVUFBSTtBQUNBLGNBQU0sYUFBYSxNQUFNLGFBQWEsWUFBWTtBQUNsRCxRQUFBSSxJQUFHLGNBQWNELE1BQUssbUJBQW1CLFFBQVEsR0FBRyxPQUFPLEtBQUssVUFBVSxDQUFDO0FBQUEsTUFDL0UsU0FBUyxHQUFHO0FBQUMsUUFBQUgsS0FBSSxNQUFNLENBQUM7QUFBQSxNQUFDO0FBRXpCLFlBQU0sa0JBQWtCLE1BQU0sTUFBTSxtREFBbUQsTUFBTSx1QkFBdUI7QUFBQSxRQUNoSCxTQUFTLEVBQUMsaUJBQWlCLFVBQVUsV0FBVyxHQUFLO0FBQUEsTUFDekQsQ0FBQyxFQUFFLE1BQU8sU0FBTztBQUFDLFFBQUFBLEtBQUksTUFBTSxHQUFHO0FBQUEsTUFBQyxDQUFDO0FBRWpDLFVBQUksZ0JBQWdCLElBQUk7QUFDcEIsY0FBTSxnQkFBZ0IsTUFBTSxnQkFBZ0IsWUFBWTtBQUN4RCxjQUFNLGNBQWNHLE1BQUssbUJBQW1CLEdBQUcsUUFBUSxNQUFNO0FBQzdELFlBQUk7QUFDQSxVQUFBQyxJQUFHLGNBQWMsYUFBYSxPQUFPLEtBQUssYUFBYSxDQUFDO0FBQ3hELFVBQUFKLEtBQUksS0FBSyxjQUFjLFFBQVEsUUFBUSxRQUFRLE1BQU07QUFBQSxRQUN6RCxTQUFTLEdBQUc7QUFBQyxVQUFBQSxLQUFJLE1BQU0sQ0FBQztBQUFBLFFBQUM7QUFBQSxNQUM3QixPQUNLO0FBQ0QsUUFBQUEsS0FBSSxNQUFNLGtEQUFrRDtBQUFBLE1BQ2hFO0FBQUEsSUFFSixDQUFDO0FBQUEsRUFJTDtBQUFBLEVBRUEsU0FBUyxLQUFLO0FBQ1YsUUFBSU8sT0FBTTtBQUNWLFFBQUk7QUFDRCxNQUFBQSxPQUFPLElBQUksWUFBWSxFQUFFLFNBQVMsTUFBTTtBQUFBLElBQzNDLFNBQ08sS0FBSztBQUNSLE1BQUFQLEtBQUksS0FBSyx5QkFBeUIsR0FBRyxFQUFFO0FBQUEsSUFDM0M7QUFDQSxXQUFPTztBQUFBLEVBQ1g7QUFBQSxFQUVBLFdBQVcsTUFBTTtBQUNiLFFBQUksYUFBYTtBQUFBLE1BQ2IsYUFBYSxLQUFLO0FBQUEsTUFDbEIsY0FBYyxLQUFLO0FBQUEsTUFDbkIsZ0JBQWdCLEtBQUs7QUFBQSxNQUNyQixTQUFTLEtBQUs7QUFBQSxNQUNkLGVBQWUsS0FBSztBQUFBLE1BQ3BCLGVBQWUsS0FBSztBQUFBLE1BQ3BCLGlCQUFpQixLQUFLO0FBQUEsTUFFdEIsZUFBZSxLQUFLO0FBQUEsTUFDcEIscUJBQXFCLEtBQUs7QUFBQSxNQUMxQiwyQkFBMkIsS0FBSztBQUFBLE1BRWhDLHFCQUFxQixLQUFLO0FBQUEsTUFDMUIsUUFBUSxLQUFLO0FBQUEsTUFDYixTQUFTLEtBQUs7QUFBQSxNQUNkLGFBQWEsS0FBSztBQUFBLE1BQ2xCLFNBQVMsS0FBSztBQUFBLE1BQ2QsTUFBTSxLQUFLO0FBQUEsTUFDWCxhQUFhLEtBQUs7QUFBQSxNQUNsQixXQUFXLEtBQUs7QUFBQSxJQUNsQjtBQUNGLFdBQU87QUFBQSxFQUNYO0FBQ0o7QUFFQSxJQUFPLHFCQUFRLElBQUksV0FBVzs7O0FkdjVCOUJDLEtBQUksUUFBUSxtQkFBbUI7QUFFL0JDLEtBQUksV0FBVztBQUNmLElBQUksVUFBVSxHQUFHLGVBQU8sYUFBYTtBQUVyQ0EsS0FBSSxZQUFZLGFBQWE7QUFDN0JBLEtBQUksYUFBYSxjQUFjO0FBRS9CQSxLQUFJLFdBQVcsS0FBSyxnQkFBZ0IsTUFBTTtBQUFFLFNBQU87QUFBUztBQUM1REEsS0FBSSxXQUFXLFFBQVEsU0FBUyxDQUFDLFlBQVk7QUFFekMsVUFBUSxRQUFRLE9BQU87QUFBQSxJQUNyQixLQUFLO0FBQVEsYUFBTyxDQUFDLE1BQU0sTUFBTSxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDbkcsS0FBSztBQUFRLGFBQU8sQ0FBQyxNQUFNLE9BQU8sUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ3BHLEtBQUs7QUFBUyxhQUFPLENBQUMsTUFBTSxJQUFJLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNsRyxLQUFLO0FBQVMsYUFBTyxDQUFDLE1BQU0sS0FBSyxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDbkcsS0FBSztBQUFXLGFBQU8sQ0FBQyxNQUFNLFFBQVEsUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ3hHO0FBQWEsYUFBTyxDQUFDLE9BQU8sUUFBUSxJQUFJLENBQUM7QUFBQSxFQUMzQztBQUNKO0FBQ0FBLEtBQUksUUFBUSxrQ0FBa0M7QUFDOUNBLEtBQUksUUFBUSw0Q0FBNEMsZUFBTyxPQUFPLElBQUksZUFBTyxJQUFJLE1BQU0sUUFBUSxRQUFRLElBQUksZUFBTyxjQUFjLGtCQUFrQixFQUFFLEVBQUU7QUFDMUpBLEtBQUksUUFBUSxrQ0FBa0M7QUFDOUNBLEtBQUksS0FBSyxtQ0FBbUMsT0FBTyxFQUFFO0FBSXJELEtBQUssbUJBQW1CLElBQUk7QUFDNUJELEtBQUksWUFBWSxhQUFhLG1CQUFtQiw4QkFBOEI7QUFFOUVBLEtBQUksWUFBWSxhQUFhLFFBQVEsSUFBSTtBQUN6Q0EsS0FBSSxZQUFZLGFBQWEsOEJBQThCO0FBRzNELElBQUksZUFBTyxlQUFlO0FBQ3RCLEVBQUFBLEtBQUksWUFBWSxhQUFhLGlCQUFpQixlQUFPLGFBQWE7QUFDdEU7QUFFQSxzQkFBYyxLQUFLLHlCQUFpQixjQUFNO0FBQzFDLG1CQUFXLEtBQUsseUJBQWlCLGdCQUFRLHFCQUFhO0FBT3RELFFBQVEsT0FBTyxHQUFHLFNBQVMsQ0FBQyxRQUFRO0FBQUUsTUFBSSxJQUFJLFNBQVMsU0FBUztBQUFFLElBQUFDLEtBQUksV0FBVyxRQUFRLFFBQVE7QUFBQSxFQUFNO0FBQUUsQ0FBQztBQUUxRyxRQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBUTtBQUNyQyxNQUFJLElBQUksU0FBUyxTQUFTO0FBQ3RCLElBQUFBLEtBQUksV0FBVyxRQUFRLFFBQVE7QUFDL0IsSUFBQUEsS0FBSSxLQUFLLDRFQUE0RTtBQUFBLEVBQ3pGLE9BQ0s7QUFBRyxJQUFBQSxLQUFJLE1BQU0sU0FBUyxJQUFJLE9BQU87QUFBQSxFQUFHO0FBQzdDLENBQUM7QUFHRCxJQUFJLFFBQVEsYUFBYSxRQUFTLENBQUFELEtBQUksa0JBQWtCQSxLQUFJLFFBQVEsQ0FBQztBQUdyRSxJQUFJLENBQUNBLEtBQUksMEJBQTBCLEdBQUc7QUFDbEMsRUFBQUEsS0FBSSxLQUFLO0FBQ1QsVUFBUSxLQUFLLENBQUM7QUFDbEI7QUFHQUEsS0FBSSxZQUFZLGFBQWEsYUFBYSxHQUFHO0FBRzdDLFFBQVEsSUFBSSw4QkFBOEIsSUFBSTtBQUM5QyxJQUFNLHNCQUFzQixRQUFRO0FBQ3BDLFFBQVEsY0FBYyxDQUFDLFNBQVNFLGFBQVk7QUFDeEMsTUFBSSxXQUFXLFFBQVEsWUFBWSxRQUFRLFNBQVMsOEJBQThCLEdBQUc7QUFBRztBQUFBLEVBQU87QUFDL0YsU0FBTyxvQkFBb0IsS0FBSyxTQUFTLFNBQVNBLFFBQU87QUFDN0Q7QUFFQUYsS0FBSSxHQUFHLHFCQUFxQixDQUFDLE9BQU8sYUFBYSxLQUFLLE9BQU8sYUFBYSxhQUFhO0FBQ25GLFFBQU0sZUFBZTtBQUNyQixXQUFTLElBQUk7QUFDakIsQ0FBQztBQUdEQSxLQUFJLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxnQkFBZ0I7QUFDbkQsY0FBWSxHQUFHLGlCQUFpQixDQUFDRyxRQUFPLFdBQVcsa0JBQWtCLGNBQWMsYUFBYSxnQkFBZ0IsbUJBQW1CO0FBRS9ILElBQUFGLEtBQUksS0FBSywrQkFBK0IsU0FBUyxNQUFNLGdCQUFnQixhQUFhLFlBQVksRUFBRTtBQUdsRyxRQUFJLGNBQWMsSUFBSTtBQUVsQixNQUFBQSxLQUFJLEtBQUssZ0dBQWdHO0FBQ3pHO0FBQUEsSUFDSjtBQUdBLFFBQUksY0FBYyxJQUFJO0FBQ2xCLE1BQUFBLEtBQUksTUFBTSwwQ0FBMEMsU0FBUyxNQUFNLGdCQUFnQixFQUFFO0FBQUEsSUFDekY7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDO0FBRURELEtBQUksR0FBRyxxQkFBcUIsTUFBTTtBQUM5Qix3QkFBYyxhQUFhO0FBRTNCLEVBQUFBLEtBQUksS0FBSztBQUNiLENBQUM7QUFFREEsS0FBSSxHQUFHLG1CQUFtQixNQUFNO0FBQzVCLE1BQUksc0JBQWMsWUFBWTtBQUMxQixRQUFJLHNCQUFjLFdBQVcsWUFBWSxFQUFHLHVCQUFjLFdBQVcsUUFBUTtBQUM3RSwwQkFBYyxXQUFXLE1BQU07QUFBQSxFQUNuQztBQUNKLENBQUM7QUFFREEsS0FBSSxHQUFHLFlBQVksTUFBTTtBQUNyQixRQUFNLGFBQWFJLGVBQWMsY0FBYztBQUMvQyxNQUFJLFdBQVcsUUFBUTtBQUFFLGVBQVcsQ0FBQyxFQUFFLE1BQU07QUFBQSxFQUFDLE9BQ3pDO0FBQUUsMEJBQWMsYUFBYTtBQUFBLEVBQUU7QUFDeEMsQ0FBQztBQUVESixLQUFJLFVBQVUsRUFBRSxLQUFLLE1BQUk7QUFDckIsaUJBQU8sT0FBTyxlQUFPLGVBQWUsTUFBTTtBQUN0QyxJQUFBQyxLQUFJLEtBQUssOENBQThDLGVBQU8sTUFBTSxJQUFJLGVBQU8sYUFBYSxFQUFFO0FBQUEsRUFDbEcsQ0FBQztBQUNMLENBQUMsRUFDQSxLQUFLLFlBQVU7QUFDWixjQUFZLGNBQWM7QUFFMUIsTUFBSSxlQUFPLFVBQVUsYUFBYTtBQUFFLG1CQUFPLFNBQVM7QUFBQSxFQUFNO0FBQzFELE1BQUksZUFBTyxRQUFRO0FBQUUsNEJBQWdCLEtBQUssZUFBTyxPQUFPO0FBQUEsRUFBRztBQUMzRCxtQkFBaUIsTUFBTSx1QkFBdUI7QUFFOUMsd0JBQWMsYUFBYTtBQUUzQixpQkFBZSxTQUFTLDRCQUE0QixNQUFNO0FBQUcsVUFBTSxNQUFNRyxlQUFjLGlCQUFpQjtBQUFHLFFBQUksS0FBSztBQUFFLFVBQUksWUFBWSxlQUFlO0FBQUEsSUFBRTtBQUFBLEVBQUMsQ0FBQztBQUN6SixpQkFBZSxTQUFTLFlBQVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFFL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIlJvdXRlciIsICJsb2ciLCAibG9nIiwgImNyeXB0byIsICJwYXRoIiwgImxvZyIsICJsb2ciLCAiY29uZmlnIiwgImFwcCIsICJfX2Rpcm5hbWUiLCAibG9nIiwgInBhdGgiLCAic2VydmVyIiwgImNyeXB0byIsICJzdHVkZW50IiwgInB1YmxpY1BhdGgiLCAiUm91dGVyIiwgInBhdGgiLCAiZnMiLCAibG9nIiwgInJvdXRlciIsICJSb3V0ZXIiLCAidCIsICJwYXRoIiwgImZzIiwgInBkZiIsICJleGVjIiwgIlJvdXRlciIsICJwYXRoIiwgImZzIiwgImFwcCIsICJsb2ciLCAicGF0aCIsICJmcyIsICJmcyIsICJCcm93c2VyV2luZG93IiwgImRpYWxvZyIsICJqb2luIiwgImxvZyIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAiY29uZmlnIiwgImxvZyIsICJCcm93c2VyV2luZG93IiwgImRpYWxvZyIsICJqb2luIiwgImZzIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJwZGYiLCAiYXBwIiwgImxvZyIsICJvcHRpb25zIiwgImV2ZW50IiwgIkJyb3dzZXJXaW5kb3ciXQp9Cg==
