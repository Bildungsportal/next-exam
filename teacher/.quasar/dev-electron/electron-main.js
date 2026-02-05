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
import fs2 from "fs";
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
import fs from "fs";
import { app, BrowserWindow, dialog, screen } from "electron";
import { join } from "path";
import path from "path";
import { fileURLToPath } from "node:url";
import log3 from "electron-log";
var __dirname = import.meta.dirname;
function getPublicBase() {
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, "app.asar.unpacked", "public");
    return fs.existsSync(unpacked) ? unpacked : join(process.resourcesPath, "app.asar.unpacked");
  }
  return join(__dirname, "../../../public");
}
function getRendererIndexPath() {
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, "app.asar.unpacked", "public", "index.html");
    if (fs.existsSync(unpacked)) return unpacked;
  }
  const publicPath2 = join(__dirname, "public", "index.html");
  if (fs.existsSync(publicPath2)) return publicPath2;
  const distRendererPath = join(__dirname, "dist", "renderer", "index.html");
  if (fs.existsSync(distRendererPath)) return distRendererPath;
  const quasarPath = join(__dirname, "index.html");
  if (fs.existsSync(quasarPath)) return quasarPath;
  return join(__dirname, "../renderer/index.html");
}
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
      icon: join(getPublicBase(), "icons", "icon.png"),
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
      icon: join(getPublicBase(), "icons", "icon.png"),
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
      const filePath = getRendererIndexPath();
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
      icon: join(getPublicBase(), "icons", "icon.png"),
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
var fsp = fs2.promises;
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
    await fs2.promises.mkdir(serverinstancedir, { recursive: true });
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
          await fs2.promises.access(studentfolder);
          const parentDir = path2.dirname(studentfolder);
          const targetDirName = path2.basename(studentfolder);
          const directories = (await fs2.promises.readdir(parentDir, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
          if (!directories.includes(targetDirName)) {
            const existingDir = directories.find((dir) => dir.toLowerCase() === targetDirName.toLowerCase());
            if (existingDir) {
              const oldPath = path2.join(parentDir, existingDir);
              const newPath = path2.join(parentDir, `backup-${existingDir}`);
              await fs2.promises.rename(oldPath, newPath);
              log4.warn(`control @ registerclient: Renaming ${oldPath} to ${newPath} - thx bill gates for the worst operating system otw`);
            }
          } else {
            log4.warn(`control @ registerclient: Using already existing directory: ${targetDirName}`);
          }
        } catch (err) {
          try {
            await fs2.promises.mkdir(studentfolder, { recursive: true });
            log4.info(`control @ registerclient: Creating ${studentfolder}`);
          } catch (mkdirErr) {
            log4.error(`control @ registerclient: Error creating directory: ${mkdirErr}`);
          }
        }
        try {
          await fs2.promises.mkdir(config_default.tempdirectory, { recursive: true });
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
    const fileContent = await fs2.promises.readFile(filePath, "utf-8");
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
    await fs2.promises.mkdir(workdir, { recursive: true });
    const jsonString = JSON.stringify(mcServer.serverstatus, null, 2);
    JSON.parse(jsonString);
    await fs2.promises.writeFile(filePath, jsonString);
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
            langPath: publicPath2,
            cachePath: config_default.workdirectory
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
        await fs2.promises.mkdir(filepath, { recursive: true });
        let screenshotBuffer = Buffer.from(req.body.screenshot, "base64");
        await fs2.promises.writeFile(absoluteFilename, screenshotBuffer);
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
import fs3 from "fs";
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
    const files = await fs3.promises.readdir(dir);
    for (const file of files) {
      const filepath = path3.join(dir, file);
      let ext = path3.extname(file).toLowerCase();
      try {
        const stats = await fs3.promises.stat(filepath);
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
      await fs3.promises.writeFile(indexPDFpath, indexPDFdata);
      log5.info("data @ getlatest: Index PDF saved successfully!");
    } catch (err) {
      log5.error("data @ getlatest:", err);
    }
    latestFiles.unshift(indexPDFpath);
    let PDF = await concatPages(latestFiles);
    let pdfBuffer = Buffer.from(PDF);
    let pdfPath = path3.join(config_default.workdirectory, mcServer.serverinfo.servername, "combined.pdf");
    try {
      await fs3.promises.writeFile(pdfPath, pdfBuffer);
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
  const dataBuffer = await fs3.promises.readFile(pdfPath);
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
    let pdfBytes = await fs3.promises.readFile(pdfpath);
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
      const stats = await fs3.promises.stat(filepath);
      if (stats.isDirectory()) {
        await fs3.promises.rm(filepath, { recursive: true, force: true });
      } else {
        await fs3.promises.unlink(filepath);
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
      await fs3.promises.mkdir(studentdirectory, { recursive: true });
      await fs3.promises.mkdir(studentarchivedir, { recursive: true });
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
            await fs3.promises.mkdir(backupdir, { recursive: true });
            await fs3.promises.cp(studentarchivedir, backupdir, { recursive: true });
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
    await fs3.promises.mkdir(uploaddirectory, { recursive: true });
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
        await fs3.promises.writeFile(absoluteFilepath, fileContent);
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
          await fs3.promises.unlink(absoluteFilepath);
        } catch (e) {
        }
        log5.info(`data @ receive: Successfully extracted ZIP file to ${studentarchivedir}`);
        resolve(true);
      } catch (err) {
        log5.error("data @ receive (extract): ", err);
        try {
          await fs3.promises.unlink(absoluteFilepath);
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
  const stream = fs3.createWriteStream(outPath);
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
import fs4 from "fs";
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
if (!fs4.existsSync(config_default.workdirectory)) {
  fs4.mkdirSync(config_default.workdirectory, { recursive: true });
}
if (!fs4.existsSync(config_default.tempdirectory)) {
  fs4.mkdirSync(config_default.tempdirectory, { recursive: true });
}
var desktopPath = process.platform === "win32" ? path4.join(process.env["USERPROFILE"], "Desktop") : path4.join(config_default.homedirectory, "Desktop");
if (!fs4.existsSync(desktopPath)) {
  fs4.mkdirSync(desktopPath, { recursive: true });
}
var linkPath = path4.join(desktopPath, config_default.serverdirectory);
try {
  fs4.unlinkSync(linkPath);
} catch (e) {
}
try {
  if (!fs4.existsSync(linkPath)) {
    fs4.symlinkSync(config_default.workdirectory, linkPath, "junction");
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
import fs5 from "fs";
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
          if (!fs5.existsSync(testdir)) {
            fs5.mkdirSync(testdir);
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
          if (!fs5.existsSync(workdir)) {
            fs5.mkdirSync(workdir);
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
        if (!fs5.existsSync(workdir)) {
          fs5.mkdirSync(workdir);
        }
        message = "success";
      } catch (e) {
        message = e.message;
        log7.error(e);
      }
      try {
        const jsonString = JSON.stringify(exam, null, 2);
        JSON.parse(jsonString);
        fs5.writeFileSync(filePath, jsonString);
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
        let data = fs5.readFileSync(filepath, "utf8");
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
      if (fs5.existsSync(config2.workdirectory)) {
        const folders = fs5.readdirSync(config2.workdirectory, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
        for (const dirname of folders) {
          const serverstatusPath = join2(config2.workdirectory, dirname, "serverstatus.json");
          if (fs5.existsSync(serverstatusPath)) {
            try {
              const serverstatus = JSON.parse(fs5.readFileSync(serverstatusPath, "utf-8"));
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
      if (fs5.statSync(examdir).isDirectory()) {
        try {
          fs5.rmSync(examdir, { recursive: true, force: true });
        } catch (e) {
          log7.error(e);
        }
      }
      return examdir;
    });
    ipcMain.handle("getSpecificSubmissionBase64", async (event, filepath) => {
      try {
        const submission = fs5.readFileSync(filepath, "base64");
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
      if (fs5.existsSync(dir)) {
        const folders = fs5.readdirSync(dir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
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
            if (fs5.existsSync(sectionDir)) {
              let sectionFiles = fs5.readdirSync(sectionDir, { withFileTypes: true }).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
              if (sectionFiles.length > 0) {
                let latestSubmission = sectionFiles.map((file) => {
                  let filePath = join2(sectionDir, file);
                  return { file, mtime: fs5.statSync(filePath).mtime };
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
      if (!fs5.existsSync(dir)) {
        return { sender: "server", message: "notfound", status: "error", filepath: false };
      }
      const backupDirectories = fs5.readdirSync(dir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory() && dirent.name !== "ABGABE" && dirent.name !== "focuslost").map((dirent) => {
        let filePath = join2(dir, dirent.name);
        return { name: dirent.name, mtime: fs5.statSync(filePath).mtime };
      }).sort((a, b) => b.mtime - a.mtime);
      if (backupDirectories.length === 0) {
        return { sender: "server", message: "notfound", status: "error", filepath: false };
      }
      let latestBackupDirectory = backupDirectories[0].name;
      log7.info("ipchandler @ getLatestBakFile: Searching for latest backup file in:", dir, latestBackupDirectory);
      const latestBakFilepath = join2(dir, latestBackupDirectory, studentName + ".bak");
      const latestBackupDirectoryPath = join2(dir, latestBackupDirectory);
      if (!fs5.existsSync(latestBakFilepath)) {
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
        if (!fs5.existsSync(studentdirectory)) {
          fs5.mkdirSync(studentdirectory, { recursive: true });
        }
        if (!fs5.existsSync(studentarchivedir)) {
          fs5.mkdirSync(studentarchivedir, { recursive: true });
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
        fs5.writeFileSync(join2(studentarchivedir, fileName), Buffer.from(fileBuffer));
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
          fs5.writeFileSync(pdfFilePath, Buffer.from(pdfFileBuffer));
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL2VsZWN0cm9uLW1haW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVycm91dGVzLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9zZXJ2ZXIvc3JjL3JvdXRlcy9zZXJ2ZXIvY29udHJvbC5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3NjaGVkdWxlcnNlcnZpY2UudHMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9lbi5qc29uIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2RlLmpzb24iLCAiLi4vLi4vc3JjL21zYWx1dGlscy9hdXRoQ29uZmlnLnRzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vc2VydmVyL3NyYy9yb3V0ZXMvc2VydmVyL2RhdGEuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuXG5cbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBzZXJ2ZXIgZnJvbSAnLi9zZXJ2ZXIvc3JjL3NlcnZlci5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnO1xuXG4vLyBTbyBFbGVjdHJvbiBzaW5nbGUtaW5zdGFuY2UgbG9jayB1c2VzIGEgZGlmZmVyZW50IHVzZXJEYXRhIHRoYW4gc3R1ZGVudCAobG9jayBrZXkgPSB1c2VyRGF0YSArIGV4ZWNQYXRoKVxuYXBwLnNldE5hbWUoJ25leHQtZXhhbS10ZWFjaGVyJyk7XG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxldCBsb2dmaWxlID0gYCR7Y29uZmlnLndvcmtkaXJlY3Rvcnl9L25leHQtZXhhbS10ZWFjaGVyLmxvZ2BcblxubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5cbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIGxvZ2ZpbGUgIH1cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcbmxvZy52ZXJib3NlKGBtYWluIEAgaW5pdDogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IHN0YXJ0aW5nIE5leHQtRXhhbSBUZWFjaGVyIFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbiBAIGluaXQ6IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW4gQCBpbml0OiBMb2dmaWxlbG9jYXRpb24gYXQgJHtsb2dmaWxlfWApXG5cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7XG4vLyBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdmb3JjZS1kZXZpY2Utc2NhbGUtZmFjdG9yJywgJzEnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2FsbG93LWZpbGUtYWNjZXNzLWZyb20tZmlsZXMnKTtcblxuXG5pZiAoY29uZmlnLndvcmtkaXJlY3RvcnkpIHtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCd1c2VyLWRhdGEtZGlyJywgY29uZmlnLndvcmtkaXJlY3RvcnkpO1xufVxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluOiBFUElQRSBFcnJvcjogRGVyIHN0ZG91dC1TdHJlYW0gZGVzIEVsZWN0cm9uTG9nZ2VycyB3aXJkIGRlYWt0aXZpZXJ0LicpO1xuICAgIH0gXG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW46JywgZXJyLm1lc3NhZ2UpOyB9ICAvLyBBbmRlcmUgRmVobGVyIHByb3Rva29sbGllcmVuIG9kZXIgYW56ZWlnZW5cbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKVxuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkge1xuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuIC8vIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udHJvbCBvdmVyIGNvbnNvbGUgZXJyb3JzXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUsIGZyYW1lUHJvY2Vzc0lkLCBmcmFtZVJvdXRpbmdJZCkgPT4ge1xuICAgICAgICAvLyBMb2cgdGhlIGVycm9yIGJ1dCBkb24ndCBjcmFzaCB0aGUgYXBwXG4gICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhhbmRsZSBzcGVjaWZpYyBlcnJvciBjb2Rlc1xuICAgICAgICBpZiAoZXJyb3JDb2RlID09PSAtMykge1xuICAgICAgICAgICAgLy8gLTMgaXMgRVJSX0FCT1JURUQsIG9mdGVuIHJlbGF0ZWQgdG8gYmxvYiBVUkxzIG9yIFBERiB2aWV3ZXJzXG4gICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IEFib3J0ZWQgbG9hZCBmb3IgYmxvYiBVUkwgb3IgUERGIHZpZXdlciAtIHRoaXMgaXMgdXN1YWxseSBzYWZlIHRvIGlnbm9yZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGb3Igb3RoZXIgZXJyb3IgY29kZXMsIGxvZyBidXQgY29udGludWVcbiAgICAgICAgaWYgKGVycm9yQ29kZSAhPT0gLTMpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IFVuZXhwZWN0ZWQgZXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufWApO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cgPSBudWxsXG4gICAgLy9pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIGFwcC5xdWl0KClcbiAgICBhcHAucXVpdCgpXG59KVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSkgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpfSAvLyBpZiB0aGVyZSBpcyBhIHdpbmRvdyAtIGZvY3VzXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KCkgfSAgICAgICAvLyBpZiBub3QgY3JlYXRlIG5ld1xufSlcblxuYXBwLndoZW5SZWFkeSgpLnRoZW4oKCk9PnsgICAgXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgLy8gc3RhcnQgZXhwcmVzcyBBUElcbiAgICAgICAgbG9nLmluZm8oYG1haW4gQCByZWFkeTogRXhwcmVzcyBsaXN0ZW5pbmcgb24gaHR0cHM6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7Y29uZmlnLnNlcnZlckFwaVBvcnR9YClcbiAgICB9KSBcbn0pXG4udGhlbihhc3luYyAoKT0+e1xuICAgIG5hdGl2ZVRoZW1lLnRoZW1lU291cmNlID0gJ2xpZ2h0JyAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3QgYXBwbHkgZGFyayBzeXN0ZW0gdGhlbWVzICh3ZSBoYXZlIGRhcmsgaWNvbnMgaW4gZWRpdG9yKVxuICAgIFxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG4gICAgcG93ZXJTYXZlQmxvY2tlci5zdGFydCgncHJldmVudC1kaXNwbGF5LXNsZWVwJylcblxuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlV2luZG93KClcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K0QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcblxufSkiLCAiLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLFxuICAgIHNob3dkZXZ0b29sczogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBBcGlVcmw6ICdodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L3dlYnNlcnZpY2UvcmVzdC9uZXh0LWV4YW0vdGVhY2hlcicsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIixcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIixcbiAgICBiYWNrdXBkaXJlY3Rvcnk6IGZhbHNlLFxuICAgIHNlcnZlcmRpcmVjdG9yeTogJ0VYQU0tVEVBQ0hFUicsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMixcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LFxuICAgIG11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQ6IDYwMjUsXG5cbiAgICBtdWx0aWNhc3RTZXJ2ZXJBZHJyOiAnMjM5LjI1NS4yNTUuMjUwJyxcbiAgICBob3N0aXA6IFwiMC4wLjAuMFwiLFxuICAgIGdhdGV3YXk6IHRydWUsXG4gICAgZXhhbVNlcnZlckxpc3Q6IHt9LFxuICAgIGFjY2Vzc1Rva2VuOiBmYWxzZSxcbiAgICBidWlsZGZvcldFQjogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG5cbiAgICBleGFtbW9kZXM6IHtcbiAgICAgICAgcmRwOiB0cnVlLFxuICAgICAgICB3ZWJzaXRlOiB0cnVlLFxuICAgICAgICBnZm9ybXM6IHRydWUsXG4gICAgICAgIGVkdXZpZHVhbDogdHJ1ZSxcbiAgICAgICAgZWRpdG9yOiB0cnVlLFxuICAgICAgICBtYXRoOiB0cnVlLFxuICAgICAgICBtaWNyb3NvZnQzNjU6IHRydWUsXG4gICAgICAgIGFjdGl2ZXNoZWV0czogdHJ1ZVxuICAgIH0sXG5cbiAgICB2ZXJzaW9uOiAnMi4wLjAuMScsXG4gICAgYnVpbGREYXRlOiAnMjAyNjAyMDUnLFxuICAgIGJ1aWxkTnVtYmVyOiAnMScsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIlxuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJ1xuaW1wb3J0IGNvcnMgZnJvbSAnY29ycydcbmltcG9ydCBmaWxlVXBsb2FkIGZyb20gXCJleHByZXNzLWZpbGV1cGxvYWRcIjtcbmltcG9ydCB7c2VydmVyUm91dGVyfSBmcm9tICcuL3JvdXRlcy9zZXJ2ZXJyb3V0ZXMuanMnIFxuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgZnNFeHRyYSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCByYXRlTGltaXQgIGZyb20gJ2V4cHJlc3MtcmF0ZS1saW1pdCcgIC8vc2ltcGxlIGRkb3MgcHJvdGVjdGlvblxuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHppcCBmcm9tICdleHByZXNzLWVhc3ktemlwJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGZvcmdlIGZyb20gJ25vZGUtZm9yZ2UnXG5mb3JnZS5vcHRpb25zLnVzZVB1cmVKYXZhU2NyaXB0ID0gdHJ1ZTsgXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG11bHRpY2FzdENsaWVudCBmcm9tICcuLi8uLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tICdjb29raWUtcGFyc2VyJ1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuY29uZmlnLmhvbWVkaXJlY3RvcnkgPSBvcy5ob21lZGlyKClcbmNvbmZpZy53b3JrZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy5ob21lZGlyZWN0b3J5LCBjb25maWcuc2VydmVyZGlyZWN0b3J5KTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKVxuXG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cblxuXG4vLyBEZWZpbmUgdGhlIGRlc2t0b3AgcGF0aCBiYXNlZCBvbiB0aGUgcGxhdGZvcm1cbmNvbnN0IGRlc2t0b3BQYXRoID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xuICAgID8gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpXG4gICAgOiBwYXRoLmpvaW4oY29uZmlnLmhvbWVkaXJlY3RvcnksICdEZXNrdG9wJyk7XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGlua1xuaWYgKCFmcy5leGlzdHNTeW5jKGRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKGRlc2t0b3BQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSAgLy8gQ2hlY2sgaWYgdGhlIGRlc2t0b3AgZm9sZGVyIGV4aXN0cyBhbmQgY3JlYXRlIGlmIGl0IGRvZXNuJ3RcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKGRlc2t0b3BQYXRoLCBjb25maWcuc2VydmVyZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbjogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxuXG5cbnRyeSB7XG4gICAgY29uc3Qge2dhdGV3YXksIGludGVyZmFjZTogaWZhY2V9ID0gIGdhdGV3YXk0c3luYygpXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW46IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuXG4gfVxuXG5cblxuXG5cbmNvbnN0IGxpbWl0ZXIgPSByYXRlTGltaXQoe1xuICAgIHdpbmRvd01zOiAxICogNjAgKiAxMDAwLCAvLyAxIG1pbnV0ZXNcbiAgICBtYXg6IDQwMCwgLy8gTGltaXQgZWFjaCBJUCB0byA0MDAgcmVxdWVzdHMgcGVyIGB3aW5kb3dgIFxuICAgIHN0YW5kYXJkSGVhZGVyczogdHJ1ZSwgLy8gUmV0dXJuIHJhdGUgbGltaXQgaW5mbyBpbiB0aGUgYFJhdGVMaW1pdC0qYCBoZWFkZXJzXG4gICAgbGVnYWN5SGVhZGVyczogZmFsc2UsIC8vIERpc2FibGUgdGhlIGBYLVJhdGVMaW1pdC0qYCBoZWFkZXJzXG59KVxuXG4vLyBjbGVhbiB0ZW1wIGRpcmVjdG9yeVxuZnNFeHRyYS5lbXB0eURpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpXG5cbi8vIExlZ2VuIFNpZSBkZW4gUGZhZCB6dXIgYHB1YmxpYy9gLVJlc3NvdXJjZSBiYXNpZXJlbmQgYXVmIGRlbSBNb2R1cyBmZXN0LlxuY29uc3QgcHVibGljUGF0aCA9IGFwcC5pc1BhY2thZ2VkXG4gID8gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJylcbiAgOiBwYXRoLmpvaW4oJ3B1YmxpYycpO1xuXG4vLyBLb3BpZXJlbiBTaWUgZGVuIEluaGFsdCB2b24gYHB1YmxpYy9gIGluIGRhcyBgY29uZmlnLnRlbXBkaXJlY3RvcnlgLlxuLy8gZnNFeHRyYS5jb3B5KHB1YmxpY1BhdGgsIGAke2NvbmZpZy50ZW1wZGlyZWN0b3J5fS9gLCBmdW5jdGlvbiAoZXJyKSB7XG4vLyAgIGlmIChlcnIpIHJldHVybiBjb25zb2xlLmVycm9yKGVycik7XG4vLyAgIGxvZy5pbmZvKCdzZXJ2ZXI6IGNvcGllZCBwdWJsaWMgZGlyZWN0b3J5IHRvIHRlbXAuLi4nKTtcbi8vIH0pO1xuXG5cblxuXG5cblxuLy8gaW5pdCBleHByZXNzIEFQSVxuY29uc3QgYXBpID0gZXhwcmVzcygpXG5hcGkudXNlKGZpbGVVcGxvYWQoeyBsaW1pdHM6IHsgZmlsZVNpemU6IDUwICogMTAyNCAqIDEwMjQgfSwgfSkpICAvL1doZW4geW91IHVwbG9hZCBhIGZpbGUsIHRoZSBmaWxlIHdpbGwgYmUgYWNjZXNzaWJsZSBmcm9tIHJlcS5maWxlcyAoaW5pdCBiZWZvcmUgcm91dGVzKVxuYXBpLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogJzUwbWInIH0pKVxuYXBpLnVzZShleHByZXNzLnVybGVuY29kZWQoe2V4dGVuZGVkOiB0cnVlfSkpO1xuYXBpLnVzZSh6aXAoKSlcbmFwaS51c2UoY29ycygpKVxuYXBpLnVzZShcIi9zdGF0aWNcIixleHByZXNzLnN0YXRpYyhjb25maWcudGVtcGRpcmVjdG9yeSkpO1xuYXBpLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbi8vIFRyYWNrIGNvbm5lY3Rpb24gbWV0cmljcyBmb3IgbW9uaXRvcmluZyAoZGVjbGFyZWQgaGVyZSBzbyBpdCBjYW4gYmUgdXNlZCBpbiBtaWRkbGV3YXJlKVxubGV0IGFjdGl2ZUNvbm5lY3Rpb25zID0gMDtcblxuLy8gUmVxdWVzdCBtb25pdG9yaW5nIG1pZGRsZXdhcmUgLSBsb2dzIHJlcXVlc3QgZHVyYXRpb24gYW5kIHdhcm5zIG9uIHNsb3cgcmVxdWVzdHNcbmFwaS51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXF1ZXN0SWQgPSBgJHtyZXEubWV0aG9kfSAke3JlcS51cmx9YDtcbiAgICBcbiAgICByZXMub24oJ2ZpbmlzaCcsICgpID0+IHtcbiAgICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICBpZiAoZHVyYXRpb24gPiA1MDAwKSB7IC8vIFdhcm4gaWYgcmVxdWVzdCB0YWtlcyBsb25nZXIgdGhhbiA1IHNlY29uZHNcbiAgICAgICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IFNsb3cgcmVxdWVzdCBkZXRlY3RlZDogJHtyZXF1ZXN0SWR9IHRvb2sgJHtkdXJhdGlvbn1tc2ApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhY3RpdmVDb25uZWN0aW9ucyA+IDE1MCkge1xuICAgICAgICAgICAgbG9nLndhcm4oYHNlcnZlcjogSGlnaCBsb2FkIC0gJHthY3RpdmVDb25uZWN0aW9uc30gYWN0aXZlIGNvbm5lY3Rpb25zIGR1cmluZyAke3JlcXVlc3RJZH1gKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIHJlcy5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgIGlmICghcmVzLmhlYWRlcnNTZW50KSB7XG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgICAgICBsb2cud2Fybihgc2VydmVyOiBSZXF1ZXN0IGNsb3NlZCBiZWZvcmUgY29tcGxldGlvbjogJHtyZXF1ZXN0SWR9IGFmdGVyICR7ZHVyYXRpb259bXNgKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIG5leHQoKTtcbn0pO1xuXG5hcGkudXNlKCcvc2VydmVyJywgc2VydmVyUm91dGVyKVxuLy9hcGkudXNlKGxpbWl0ZXIpICAvL2Rpc2FibGVkIGZvciBub3cgYmVjYXVzZSB0aGlzIG5lZWQgYSBsb3Qgb2YgdGVzdGluZyB0byBmaW5kIGdvb2QgcGFyYW1ldGVyc1xuXG5cblxuXG5cblxuXG5cblxubGV0IGNlcnRzID0gY3JlYXRlQ0FDZXJ0KCkgIC8vIHdlIGNhbiBub3QgdXNlIHNlbGYgc2lnbmVkIGNlcnRzIGZvciB3ZWIgKGZhbGxiYWNrIHRvIGxldCdzIGVuY3J5cHQhKVxuXG52YXIgb3B0aW9ucyA9IHtcbiAgICBrZXk6IGNlcnRzLmtleSxcbiAgICBjZXJ0OiBjZXJ0cy5jZXJ0LFxuICAgIHJlcXVlc3RDZXJ0OiBmYWxzZSxcbiAgICByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlLFxuICAgIGFnZW50OiBmYWxzZVxuICB9O1xuXG5jb25zdCBzZXJ2ZXIgPSBodHRwcy5jcmVhdGVTZXJ2ZXIob3B0aW9ucywgYXBpKTtcblxuLy8gQ29uZmlndXJlIHRpbWVvdXRzIGFuZCBjb25uZWN0aW9uIGxpbWl0cyB0byBwcmV2ZW50IHJlc291cmNlIGV4aGF1c3Rpb25cbnNlcnZlci50aW1lb3V0ID0gMzAwMDA7IC8vIDMwIHNlY29uZHMgLSBjbG9zZSBpZGxlIGNvbm5lY3Rpb25zIGFmdGVyIDMwc1xuc2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSA1MDAwOyAvLyA1IHNlY29uZHMgLSBjbG9zZSBrZWVwLWFsaXZlIGNvbm5lY3Rpb25zIGFmdGVyIDVzIG9mIGluYWN0aXZpdHlcbnNlcnZlci5tYXhDb25uZWN0aW9ucyA9IDIwMDsgLy8gTGltaXQgY29uY3VycmVudCBjb25uZWN0aW9ucyB0byBwcmV2ZW50IG92ZXJsb2FkXG5cbi8vIFRyYWNrIGNvbm5lY3Rpb24gbWV0cmljcyBmb3IgbW9uaXRvcmluZ1xuc2VydmVyLm9uKCdjb25uZWN0aW9uJywgKHNvY2tldCkgPT4ge1xuICAgIGFjdGl2ZUNvbm5lY3Rpb25zKys7XG4gICAgaWYgKGFjdGl2ZUNvbm5lY3Rpb25zID4gMTUwKSB7XG4gICAgICAgIGxvZy53YXJuKGBzZXJ2ZXI6IEhpZ2ggY29ubmVjdGlvbiBjb3VudDogJHthY3RpdmVDb25uZWN0aW9uc31gKTtcbiAgICB9XG4gICAgc29ja2V0Lm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgYWN0aXZlQ29ubmVjdGlvbnMtLTtcbiAgICB9KTtcbn0pO1xuXG5pZiAoY29uZmlnLmJ1aWxkZm9yV0VCKXsgIC8vIHRoZSBhcGkgaXMgc3RhcnRlZCBieSB0aGUgZWxlY3Ryb24gbWFpbiBwcm9jZXNzIC0gZm9yIHdlYiB3ZSBkbyBpdCBoZXJlXG4gICAgc2VydmVyLmxpc3Rlbihjb25maWcuc2VydmVyQXBpUG9ydCwgKCkgPT4geyAgXG4gICAgICAgIGxvZy5pbmZvKGBzZXJ2ZXI6IEV4cHJlc3MgbGlzdGVuaW5nIG9uIGh0dHBzOi8vJHtjb25maWcuaG9zdGlwfToke2NvbmZpZy5zZXJ2ZXJBcGlQb3J0fWApXG4gICAgfSlcbiAgICBpZiAoY29uZmlnLmhvc3RpcCkge1xuICAgICAgICBtdWx0aWNhc3RDbGllbnQuaW5pdCgpXG4gICAgfVxufVxuXG4gXG4gXG5cblxuZXhwb3J0IGRlZmF1bHQgc2VydmVyO1xuXG5cblxuXG5mdW5jdGlvbiBjcmVhdGVDQUNlcnQoKSB7XG4gICAgbGV0IHJzYSA9ICBmb3JnZS5wa2kucnNhO1xuICAgIGxldCBwa2kgPSBmb3JnZS5wa2k7XG4gICAgbGV0IHNlZWQgPSBmb3JnZS5yYW5kb20uZ2V0Qnl0ZXNTeW5jKDMyKTtcbiAgICBsZXQga2V5cyA9IHJzYS5nZW5lcmF0ZUtleVBhaXIoe2JpdHM6IDEwMjQsIHNlZWQ6IHNlZWR9KTtcbiAgICB2YXIgY2VydCA9IHBraS5jcmVhdGVDZXJ0aWZpY2F0ZSgpO1xuICAgIGNlcnQucHVibGljS2V5ID0ga2V5cy5wdWJsaWNLZXk7XG4gICAgY2VydC5wcml2YXRlS2V5ID0ga2V5cy5wcml2YXRlS2V5O1xuICAgIGNlcnQuc2lnbihrZXlzLnByaXZhdGVLZXkpO1xuICAgIHZhciBwZW1fcGtleSA9IHBraS5wcml2YXRlS2V5VG9QZW0oa2V5cy5wcml2YXRlS2V5KTtcbiAgICB2YXIgcGVtX2NlcnQgPSBwa2kuY2VydGlmaWNhdGVUb1BlbShjZXJ0KTtcbiAgICByZXR1cm4ge2tleTogcGVtX3BrZXkgLCBjZXJ0OiBwZW1fY2VydH1cbn07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgUm91dGVyIH0gZnJvbSAnZXhwcmVzcyc7XG5leHBvcnQgY29uc3Qgc2VydmVyUm91dGVyID0gUm91dGVyKClcblxuaW1wb3J0IGNvbnRyb2xSb3V0ZXMgZnJvbSAnLi9zZXJ2ZXIvY29udHJvbC5qcyc7XG5pbXBvcnQgZGF0YVJvdXRlcyBmcm9tICcuL3NlcnZlci9kYXRhLmpzJztcblxuXG5zZXJ2ZXJSb3V0ZXIudXNlKCcvY29udHJvbC8nLCBjb250cm9sUm91dGVzKTtcbnNlcnZlclJvdXRlci51c2UoJy9kYXRhLycsIGRhdGFSb3V0ZXMpO1xuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdleHByZXNzJ1xuY29uc3Qgcm91dGVyID0gUm91dGVyKClcbmltcG9ydCBtdWx0aUNhc3RzZXJ2ZXIgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9zY3JpcHRzL211bHRpY2FzdHNlcnZlci5qcydcbmltcG9ydCBtdWx0aUNhc3RjbGllbnQgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vLi4vLi4vbWFpbi9jb25maWcuanMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbmNvbnN0IHsgdCB9ID0gaTE4bi5nbG9iYWxcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgcXMgZnJvbSAncXMnXG5pbXBvcnQgYXhpb3MgZnJvbSBcImF4aW9zXCJcbmltcG9ydCB7IG1zYWxDb25maWcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zcmMvbXNhbHV0aWxzL2F1dGhDb25maWcudHMnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4uLy4uLy4uLy4uL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xubGV0IFRlc3NlcmFjdFdvcmtlciA9IGZhbHNlXG5cbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJ1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbmNvbnN0IGZzcCA9IGZzLnByb21pc2VzIFxuXG4vKipcbiAqIHRoaXMgcm91dGUgZ2VuZXJhdGVzIHRoZSBuZXNzZXNhcnkgY29kZVZlcmlmaWVyIGFuZCBjb2RlQ2hhbGxlbmdlIGZcdTAwRkNyIFBLQ0UgXG4gKiBhdXRob3JpemF0aW9uIGZsb3cgZm9yIHRoZSBtaWNyb3NvZnQgb25lZHJpdmUgZ3JhcGggQVBJXG4gKiBpdCByZWNlaXZlcyBhIGNvZGUgYW5kIHRoZW4gcmVkaXJlY3RzIHRvIC9tc2F1dGggd2hpY2ggd2lsbCBhcXVpcmUgYW5cbiAqIGFjY2Vzc3Rva2VuXG4gKi9cbiAgXG5yb3V0ZXIuZ2V0KCcvb2F1dGgnLCAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCBjb2RlVmVyaWZpZXIgPSBnZW5lcmF0ZUNvZGVWZXJpZmllcigpO1xuICAgIGNvbnN0IGNvZGVDaGFsbGVuZ2UgPSBiYXNlNjRVcmxFbmNvZGUoc2hhMjU2KEJ1ZmZlci5mcm9tKGNvZGVWZXJpZmllciwgJ3V0Zi04JykpKTtcbiAgICByZXMuY29va2llKCdjb2RlVmVyaWZpZXInLCBjb2RlVmVyaWZpZXIsIHsgaHR0cE9ubHk6IHRydWUgfSk7XG4gICAgY29uZmlnLmNvZGVWZXJpZmllciA9IGNvZGVWZXJpZmllclxuXG4gICAgY29uc3QgYXV0aFVybFBhcmFtcyA9IHtcbiAgICAgICAgY2xpZW50X2lkOiBtc2FsQ29uZmlnLmF1dGguY2xpZW50SWQsXG4gICAgICAgIHJlc3BvbnNlX3R5cGU6ICdjb2RlJyxcbiAgICAgICAgcmVkaXJlY3RfdXJpOiBtc2FsQ29uZmlnLmF1dGgucmVkaXJlY3RVcmksXG4gICAgICAgIHJlc3BvbnNlX21vZGU6ICdxdWVyeScsXG4gICAgICAgIHNjb3BlOiAnb3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgRmlsZXMuUmVhZFdyaXRlLkFwcEZvbGRlciBGaWxlcy5SZWFkIEZpbGVzLlJlYWRXcml0ZScsXG4gICAgICAgIHN0YXRlOiAnMTIzNDUnLFxuICAgICAgICBjb2RlX2NoYWxsZW5nZTogY29kZUNoYWxsZW5nZSxcbiAgICAgICAgY29kZV9jaGFsbGVuZ2VfbWV0aG9kOiAnUzI1NicsXG4gICAgfTtcbiAgICBjb25zdCBhdXRoVXJsID0gYGh0dHBzOi8vbG9naW4ubWljcm9zb2Z0b25saW5lLmNvbS9jb21tb24vb2F1dGgyL3YyLjAvYXV0aG9yaXplPyR7cXMuc3RyaW5naWZ5KGF1dGhVcmxQYXJhbXMpfWA7XG4gICAgcmVzLnJlZGlyZWN0KGF1dGhVcmwpO1xufSk7XG4gIFxuLyoqXG4gKiB0aGlzIHVzZXMgdGhlIGNvZGUgZnJvbSAvb2F1dGggcm91dGUgdG9nZXRoZXIgd2l0aCB0aGUgY2xpZW50X2lkIHRvIHJlY2VpdmVcbiAqIGFuIGFjY2Vzc1Rva2VuIGZvciB0aGUgbWljcm9zb2Z0IG9uZHJpdmUgQVBJXG4gKiB0aGUgdG9rZW4gaXMgc3RvcmVkIG9uIHRoZSBnbG9iYWwgY29uZmlnIG9iamVjdCBhbmQgY2FuIGJlIHJlcXVlc3RlZCB2aWEgL2dldGNvbmZpZyBvciBpcGNSZW5kZXJlciAnZ2V0Y29uZmlnXG4gKi9cbnJvdXRlci5nZXQoJy9tc2F1dGgnLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCBjb2RlID0gcmVxLnF1ZXJ5LmNvZGU7XG4gICAgY29uc3QgY29kZVZlcmlmaWVyID0gIGNvbmZpZy5jb2RlVmVyaWZpZXI7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5wb3N0KCdodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uL29hdXRoMi92Mi4wL3Rva2VuJywgcXMuc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGNsaWVudF9pZDogbXNhbENvbmZpZy5hdXRoLmNsaWVudElkLFxuICAgICAgICAgICAgZ3JhbnRfdHlwZTogJ2F1dGhvcml6YXRpb25fY29kZScsXG4gICAgICAgICAgICBzY29wZTogJ29wZW5pZCBwcm9maWxlIG9mZmxpbmVfYWNjZXNzIEZpbGVzLlJlYWRXcml0ZS5BcHBGb2xkZXIgRmlsZXMuUmVhZCBGaWxlcy5SZWFkV3JpdGUnLFxuICAgICAgICAgICAgY29kZSxcbiAgICAgICAgICAgIHJlZGlyZWN0X3VyaTogbXNhbENvbmZpZy5hdXRoLnJlZGlyZWN0VXJpLFxuICAgICAgICAgICAgY29kZV92ZXJpZmllcjogY29kZVZlcmlmaWVyLFxuICAgICAgICAgICAgfSksIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL2xvY2FsaG9zdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25maWcuYWNjZXNzVG9rZW4gPSByZXNwb25zZS5kYXRhLmFjY2Vzc190b2tlbiAgICAgLy8gd2UgcmVjZWl2ZWQgdGhlIGFjY2VzcyB0b2tlbiAtIHN0b3JlIGl0IG9uIGdsb2JhbCBjb25maWcgb2JqZWN0XG5cbiAgICAgICAgbGV0IGh0bWwgPSBgXG4gICAgICAgIDwhRE9DVFlQRSBodG1sPlxuICAgICAgICA8aHRtbCBsYW5nPVwiZW5cIj5cbiAgICAgICAgICAgIDxoZWFkPlxuICAgICAgICAgICAgICAgIDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiPlxuICAgICAgICAgICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCI+XG4gICAgICAgICAgICAgICAgPHRpdGxlPkN1c3RvbSBCdXR0b248L3RpdGxlPlxuICAgICAgICAgICAgICAgIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiL3N0YXRpYy9jc3Mvc3RhdGljc3R5bGVzLmNzc1wiPlxuICAgICAgICAgICAgICAgIDxzY3JpcHQ+XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gY2xvc2VXaW5kb3dBZnRlckZvdXJTZWNvbmRzKCkgeyBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyB3aW5kb3cuY2xvc2UoKTsgfSwgNDAwMCk7IH1cbiAgICAgICAgICAgICAgICA8L3NjcmlwdD5cbiAgICAgICAgICAgIDwvaGVhZD5cbiAgICAgICAgICAgIDxib2R5IG9ubG9hZD1cImNsb3NlV2luZG93QWZ0ZXJGb3VyU2Vjb25kcygpXCI+PGJyPlxuICAgICAgICAgICAgICAgIDxoMz5Mb2dpbiBPSyE8L2gzPiA8YnI+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgIDwvaHRtbD5gXG4gICAgICAgIHJlcy5zZW5kKGh0bWwpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IucmVzcG9uc2UuZGF0YSk7XG4gICAgICAgIGxldCBodG1sID0gYFxuICAgICAgICA8IURPQ1RZUEUgaHRtbD5cbiAgICAgICAgPGh0bWwgbGFuZz1cImVuXCI+XG4gICAgICAgICAgICA8aGVhZD5cbiAgICAgICAgICAgICAgICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIj5cbiAgICAgICAgICAgICAgICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMFwiPlxuICAgICAgICAgICAgICAgIDx0aXRsZT5DdXN0b20gQnV0dG9uPC90aXRsZT5cbiAgICAgICAgICAgICAgICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIi9zdGF0aWMvY3NzL3N0YXRpY3N0eWxlcy5jc3NcIj5cbiAgICAgICAgICAgIDwvaGVhZD5cbiAgICAgICAgICAgIDxib2R5Pjxicj5cbiAgICAgICAgICAgICAgICA8aDQ+JHtlcnJvci5yZXNwb25zZS5kYXRhLmVycm9yX2Rlc2NyaXB0aW9ufTwvaDQ+IDxicj5cbiAgICAgICAgICAgICAgICBQbGVhc2UgY2xvc2UgdGhpcyBXaW5kb3cgYW5kIHRyeSBhZ2FpbiEgPGJyPlxuICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz1cIndpbmRvdy5jbG9zZSgpXCIgY2xhc3M9XCJjdXN0b20tYnRuIGN1c3RvbS1idG4tZGFuZ2VyXCI+Q2xvc2UgV2luZG93PC9idXR0b24+XG4gICAgICAgICAgICA8L2JvZHk+XG4gICAgICAgIDwvaHRtbD5gXG4gICAgICAgIHJlcy5zdGF0dXMoNTAwKS5zZW5kKGh0bWwpO1xuICAgIH1cbiAgfSk7XG5cblxuXG5cblxuXG4vKipcbiAqIFNUQVJUUyBhbiBleGFtIHNlcnZlciBpbnN0YW5jZVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGNob3NlbiBuYW1lIChmb3IgZXhhbXBsZSBcIm1hdGhlXCIpXG4gKiBAcGFyYW0gcGFzc3dvcmQgdGhlIHBhc3N3b3JkIHRvIGVudGVyIHRoZSBleGFtIChub3QgbmVjY2Vzc2FyeSBvbiBzaW5nbGUgaW5zdGFuY2Ugc3lzdGVtIChhcHApIGJ1dCB3aWxsIGJlIHVzZWQgdG8gZXhpdCBzZWN1cmUgZXhhbSBtb2RlIGluIHRoZSBmdXR1cmUpXG4gKiAjRklYTUUgISEhICBUaGlzIHJvdXRlIG5lZWRzIHRvIGJlIHNlY3VyZWQgKGFueW9uZSBjYW4gc3RhcnQgYSBzZXJ2ZXIgcmlnaHQgbm93IC0gb3IgMTAwMCBzZXJ2ZXJzKVxuICovXG4gcm91dGVyLnBvc3QoJy9zdGFydC86c2VydmVybmFtZS86cGFzc3dkPycsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIC8vIHRoaXMgcm91dGUgbWF5IGJlIHVzZWQgYnkgbG9jYWxob3N0IG9ubHlcbiAgICBpZiAoIXJlcXVlc3RTb3VyY2VBbGxvd2VkKHJlcSwgcmVzKSkgcmV0dXJuICAgLy8gZm9yIHRoZSB3ZWJ2ZXJzaW9uIHdlIG5lZWQgdG8gY2hlY2sgdXNlciBwZXJtaXNzaW9ucyBoZXJlIChmdXR1cmUgc3R1ZmYpXG5cbiAgICBjb25zdCBiaXAgPSByZXEuYm9keS5iaXAgIC8vIHRoaXMgaW5mbyBpcyBhbHNvIHNlbnQgdmlhIG11bHRpY2FzdHNlcnZlciBtZXNzYWdlXG4gICAgY29uc3QgYmlwSWQgPSByZXEuYm9keS5iaXBJZFxuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZSBcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgLy8gbG9nLmluZm8ocmVxLmJvZHkpIC8vIGhvbGRzIHdvcmtkaXI6IHdlIGNvdWxkIHN0b3JlIHRoZSBjdXJyZW50IHdvcmtkaXJlY3RvcnkgZm9yIGV2ZXJ5IG1jc2VydmVyIG9uIG1jc2VydmVyLnNlcnZlcmluZm8gaW4gdGhlIGZ1dHVyZVxuICAgIFxuICAgIC8vZ2VuZXJhdGUgcmFuZG9tIHBpblxuICAgIGxldCBwaW4gPSBTdHJpbmcoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKjkwMDApICsgMTAwMCkgIC8vIDQgZGlnaXRzIGlzIGVub3VnaCAgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogOTAwMCkgKyAxMDAwO1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpeyBwaW4gPSBcIjExMTFcIiB9ICBcblxuICAgIC8vIC8vIGNoZWNrIGlmIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcgbG9jYWxseSBvciBpbiBMQU5cbiAgICBpZiAobWNTZXJ2ZXIpIHsgXG4gICAgICAgIHJldHVybiByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyZXhpc3RzXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgfSBcblxuICAgIGZvciAoY29uc3QgZXhhbSBvZiBtdWx0aUNhc3RjbGllbnQuZXhhbVNlcnZlckxpc3QpIHsgIC8vIGRvIG5vdCB1c2UgZm9yRWFjaCgpIGJlY2F1c2UgaXRzIHJ1biBhc3luYyBhbmQgdGhlIGludGVycHJldGVyIHdpbGwgbm90IHdhaXQgZm9yIGl0IHRvIGZpbmlzaFxuICAgICAgICBpZiAoc2VydmVybmFtZSA9PSBleGFtLnNlcnZlcm5hbWUgKXtcbiAgICAgICAgICAgIHJldHVybiByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc2VydmVyZXhpc3RzTEFOXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgICAgIH1cbiAgICAgfVxuICAgIFxuICAgIGxvZy5pbmZvKCdjb250cm9sIEAgc3RhcnQ6IEluaXRpYWxpemluZyBuZXcgRXhhbSBTZXJ2ZXI6Jywgc2VydmVybmFtZSlcbiAgICBsZXQgbWNzID0gbmV3IG11bHRpQ2FzdHNlcnZlcigpO1xuXG4gICAgaWYgKCFyZXEucGFyYW1zLnBhc3N3ZCl7IFxuICAgICAgICBtY3MuaW5pdChzZXJ2ZXJuYW1lLCBwaW4sIFwiXCIsIGJpcCwgYmlwSWQpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBtY3MuaW5pdChzZXJ2ZXJuYW1lLCBwaW4sIHJlcS5wYXJhbXMucGFzc3dkLCBiaXAsIGJpcElkKVxuICAgIH1cblxuICAgIGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXT1tY3NcbiAgICAvLyBsb2cuaW5mbyhjb25maWcud29ya2RpcmVjdG9yeSlcbiAgICBsZXQgc2VydmVyaW5zdGFuY2VkaXIgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHNlcnZlcm5hbWUpXG5cbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihzZXJ2ZXJpbnN0YW5jZWRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIERpcmVjdG9yeSBtaWdodCBhbHJlYWR5IGV4aXN0LCB0aGF0J3Mgb2tcbiAgICB9XG4gICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnNlcnZlcnN0YXJ0ZWRcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9KVxuICAgIFxufSlcblxuXG5cbi8qKlxuICogU1RPUFMgYW4gZXhhbSBzZXJ2ZXIgaW5zdGFuY2VcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBleGFtIHNlcnZlciBpbiBxdWVzdGlvblxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyBjc3JmIHRva2VuIG5lZWRlZCB0byBwcm9jZXNzIHRoZSByZXF1ZXN0IChnZW5lcmF0ZWQgYW5kIHRyYW5zZmVycmVkIHRvIHRoZSB3ZWJicm93c2VyIG9uIGxvZ2luKSBcbiAqL1xuIHJvdXRlci5nZXQoJy9zdG9wc2VydmVyLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cblxuICAgIGlmIChtY1NlcnZlciAmJiByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlbiA9PT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbikge1xuICAgICAgXG4gICAgICAgIG1jU2VydmVyLmJyb2FkY2FzdEludGVydmFsLnN0b3AoKVxuXG4gICAgICAgIG1jU2VydmVyLnNlcnZlci5jbG9zZSgpO1xuICAgICAgICAvL2RlbGV0ZSBtY1NlcnZlclxuICAgICAgICBkZWxldGUgY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5zZXJ2ZXJzdG9wcGVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wifSlcblxuICAgICAgICBcbiAgICB9XG59KVxuXG5cbi8qKlxuICogY2hlY2tzIHNlcnZlcnBhc3N3b3JkIGZvciBsb2dpbiB2aWEgVlVFIFJPVVRFUlxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGNob3NlbiBuYW1lIChmb3IgZXhhbXBsZSBcIm1hdGhlXCIpXG4gKiBAcGFyYW0gcGFzc3dkIHRoZSBwYXNzd29yZCBuZWVkZWQgdG8gZW50ZXIgdGhlIGRhc2hib2FyZCAgISFGSVhNRTogdXNlIGh0dHBzIGFuZCBwcm9wZXIgYXV0aCBcbiAqKi9cbiByb3V0ZXIuZ2V0KCcvY2hlY2twYXNzd2QvOnNlcnZlcm5hbWUvOnBhc3N3ZD8nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lIFxuICAgIGxldCBwYXNzd2QgPSByZXEucGFyYW1zLnBhc3N3ZFxuICAgIGlmICghcGFzc3dkKXsgcGFzc3dkID0gXCJcIn0gICAvLyB3ZSBhbGxvdyBlbXB0eSBwYXNzd29yZHMgZm9yIG5vd1xuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbiAgICBpZiAobWNTZXJ2ZXIpIHsgXG4gICAgICAgIGlmIChwYXNzd2QgPT09IG1jU2VydmVyLnNlcnZlcmluZm8ucGFzc3dvcmQpeyBcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kKCB7XG4gICAgICAgICAgICBzZW5kZXI6IFwic2VydmVyXCIsIFxuICAgICAgICAgICAgbWVzc2FnZTogdChcImNvbnRyb2wuY29ycmVjdHB3XCIpLCBcbiAgICAgICAgICAgIHN0YXR1czogXCJzdWNjZXNzXCIsIFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcGluOiBtY1NlcnZlci5zZXJ2ZXJpbmZvLnBpbixcbiAgICAgICAgICAgIHNlcnZlcnRva2VuOiBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuLFxuICAgICAgICAgICAgc2VydmVyaXA6IG1jU2VydmVyLnNlcnZlcmluZm8uaXBcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH0gKX0gXG4gICAgICAgIGVsc2UgeyByZXR1cm4gcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLndyb25ncHdcIiksIHN0YXR1czogXCJlcnJvclwifSkgfVxuICAgIH0gXG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiAgc2VuZHMgYSBsaXN0IG9mIGFsbCBydW5uaW5nIGV4YW0gc2VydmVyc1xuICovXG5yb3V0ZXIuZ2V0KCcvc2VydmVybGlzdCcsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGxldCBzZXJ2ZXJsaXN0ID0gW11cbiAgICBPYmplY3QudmFsdWVzKGNvbmZpZy5leGFtU2VydmVyTGlzdCkuZm9yRWFjaCggc2VydmVyID0+IHtcbiAgICAgICAgc2VydmVybGlzdC5wdXNoKHtzZXJ2ZXJuYW1lOiBzZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBpZDogc2VydmVyLnNlcnZlcmluZm8uaWQsIHNlcnZlcmlwOiBzZXJ2ZXIuc2VydmVyaW5mby5pcCwgcmVhY2hhYmxlOiB0cnVlLCBwYXNzd29yZDogc2VydmVyLnNlcnZlcmluZm8ucGFzc3dvcmQsIHZlcnNpb246IHNlcnZlci5zZXJ2ZXJpbmZvLnZlcnNpb259KSBcbiAgICB9KTtcbiAgICByZXMuc2VuZCh7c2VydmVybGlzdDpzZXJ2ZXJsaXN0LCBzdGF0dXM6IFwic3VjY2Vzc1wifSlcbn0pXG5cbi8qKlxuICogIHNlbmRzIGFuIFwiYWxpdmVcIiBzaWduYWwgYmFja1xuICovXG4gcm91dGVyLmdldCgnL3BvbmcnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICByZXMuc2VuZCgncG9uZycpXG59KVxuXG5cbnJvdXRlci5wb3N0KCcvcG9uZycsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIHJlcy5zZW5kKHsgc3RhdHVzOiBcInN1Y2Nlc3NcIn0pXG59KVxuXG5cblxuXG5sZXQgZGVtb2NsaWVudHMgPSBbXVxuZm9yIChsZXQgaSA9IDA7IGk8MTY7IGkrKyApe1xuICAgIGxldCBkZW1vY2xpZW50ID0ge1xuICAgICAgICBjbGllbnRuYW1lOiBgdXNlci0keyBjcnlwdG8ucmFuZG9tQnl0ZXMoNikudG9TdHJpbmcoJ2hleCcpICB9YCxcbiAgICAgICAgdG9rZW46IGBjc3JmLSR7Y3J5cHRvLnJhbmRvbVVVSUQoKX1gLFxuICAgICAgICBpcDogZmFsc2UsXG4gICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgc2VydmVyaXA6IGZhbHNlLFxuICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgIGV4YW1tb2RlOiBmYWxzZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAsXG4gICAgICAgIHZpcnR1YWxpemVkOiB0cnVlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgIGV4YW10eXBlIDogZmFsc2UsXG4gICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICBpbWFnZXVybDpcInVzZXItYmxhY2suc3ZnXCIsXG4gICAgICAgIHN0YXR1cyA6IHt9IFxuICAgIH1cbiAgICBkZW1vY2xpZW50cy5wdXNoKGRlbW9jbGllbnQpXG59XG5cblxuXG5cblxuXG4vKipcbiAqICBSRUdJU1RFUiBDTElFTlRcbiAqICBjaGVja3MgcGluIGNvZGUsIGNyZWF0ZXMgY3NyZiB0b2tlbiBmb3IgY2xpZW50LCBhbnN3ZXJlcyB3aXRoIHRva2VuXG4gKlxuICogIEBwYXJhbSBwaW4gIHRoZSBwaW5jb2RlIHRvIGNvbm5lY3QgdG8gdGhlIHNlcnZlcmluc3RhbmNlXG4gKiAgQHBhcmFtIGNsaWVudG5hbWUgdGhlIG5hbWUgb2YgdGhlIHN0dWRlbnRcbiAqICBAcGFyYW0gY2xpZW50aXAgdGhlIGNsaWVudHMgaXAgYWRkcmVzcyBmb3IgYXBpIGNhbGxzXG4gKi9cblxuXG5cbiByb3V0ZXIuZ2V0KCcvcmVnaXN0ZXJjbGllbnQvOnNlcnZlcm5hbWUvOnBpbi86Y2xpZW50bmFtZS86Y2xpZW50aXAvOmhvc3RuYW1lLzp2ZXJzaW9uLzpiaXB1c2VyaWQnLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjbGllbnRuYW1lID0gcmVxLnBhcmFtcy5jbGllbnRuYW1lXG4gICAgY29uc3QgY2xpZW50aXAgPSByZXEucGFyYW1zLmNsaWVudGlwXG4gICAgY29uc3QgcGluID0gcmVxLnBhcmFtcy5waW5cbiAgICBjb25zdCB2ZXJzaW9uID0gcmVxLnBhcmFtcy52ZXJzaW9uXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHRva2VuID0gYGNzcmYtJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWBcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBob3N0bmFtZSA9IHJlcS5wYXJhbXMuaG9zdG5hbWVcbiAgICBjb25zdCBiaXB1c2VySUQgPSByZXEucGFyYW1zLmJpcHVzZXJpZFxuXG4gICAgbG9nLmluZm8oXCJjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IENsaWVudCBWZXJzaW9uOlwiLHZlcnNpb24pXG4gICAgLy8gdGhpcyBuZWVkcyB0byBjaGFuZ2Ugb25jZSB3ZSByZWFjaGVkIHYxLjAgKGZlYXR1cmVmcmVlemUgZm9yIHN0YWJsZSB2ZXJzaW9uKVxuICAgIGxldCB2dGVhY2hlciA9IGNvbmZpZy52ZXJzaW9uLnNwbGl0KCcuJykuc2xpY2UoMCwgMiksXG4gICAgdmVyc2lvbnRlYWNoZXIgPSB2dGVhY2hlci5qb2luKCcuJyk7IFxuICAgIGxldCB2c3R1ZGVudCA9IHZlcnNpb24uc3BsaXQoJy4nKS5zbGljZSgwLCAyKSxcbiAgICB2ZXJzaW9uc3R1ZGVudCA9IHZzdHVkZW50LmpvaW4oJy4nKTsgXG5cbiAgICAvL2NvbnNvbGUubG9nKHZlcnNpb250ZWFjaGVyLCB2ZXJzaW9uc3R1ZGVudClcbiAgXG4gICAgaWYgKCFtY1NlcnZlcikgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wubm90Zm91bmRcIiksIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgaWYgKGAke3ZlcnNpb250ZWFjaGVyfWAgIT09IHZlcnNpb25zdHVkZW50ICkgeyAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudmVyc2lvbm1pc21hdGNoXCIpLCBzdGF0dXM6IFwiZXJyb3JcIiwgdmVyc2lvbjogY29uZmlnLnZlcnNpb24sIHZlcnNpb25pbmZvOiBjb25maWcuaW5mb30gKSAgfSAgXG4gICAgXG4gICAgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5yZXF1aXJlQmlQICYmIGJpcHVzZXJJRCA9PSAnZmFsc2UnKXsgLy8gcmVxLnBhcmFtcyBjb21lIGFzIHN0cmluZy4uIG5vdCBuaWNlIGJ1dCBzaW1wbGVcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wuYmlwcmVxdWlyZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApIFxuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAocGluID09IG1jU2VydmVyLnNlcnZlcmluZm8ucGluKSB7XG4gICAgICAgICAgICBsZXQgcmVnaXN0ZXJlZENsaWVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LmNsaWVudG5hbWUgPT09IGNsaWVudG5hbWUpXG4gICAgICAgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmICghcmVnaXN0ZXJlZENsaWVudCkgeyAgIC8vIGNyZWF0ZSBjbGllbnQgb2JqZWN0XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogYWRkaW5nIG5ldyBjbGllbnQgJyR7Y2xpZW50bmFtZX0nYClcblxuXG4gICAgICAgICAgICAgICAgLy9ncm91cCBoYW5kbGluZyAtIGV2ZXJ5Ym9keSBpcyBpbiBncm91cEEgZXhjZXB0IHRoZXJlIGlzIGFscmVhZHkgYSBncm91cCBjb25maWd1cmF0aW9uXG4gICAgICAgICAgICAgICAgbGV0IGdyb3VwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQT8udXNlcnM/LmluY2x1ZGVzKGNsaWVudG5hbWUpKSB7IGdyb3VwID0gJ2EnOyB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQj8udXNlcnM/LmluY2x1ZGVzKGNsaWVudG5hbWUpKSB7IGdyb3VwID0gJ2InOyAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgLy8gdXNlciBpcyBub3QgaW4gYW55IGdyb3VwIG9yIG5vIGdyb3VwIGlzIGNvbmZpZ3VyZWRcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAgPSAnYSdcbiAgICAgICAgICAgICAgICAgICBtY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW21jU2VydmVyLnNlcnZlcnN0YXR1cy5hY3RpdmVTZWN0aW9uXS5ncm91cEEudXNlcnMucHVzaChjbGllbnRuYW1lKVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY2xpZW50ID0geyAgICAvLyB3ZSBoYXZlIGEgZGlmZmVyZW50IHJlcHJlc2VudGF0aW9uIG9mIHRoZSBjbGllbnRvYmplY3Qgb24gdGhlIHNlcnZlciB0aGFuIG9uIHRoZSBjbGllbnQgLSB3aHkgZXhhY3RseT8gd2UgY291bGQganVzdCBzZW5kIHRoZSB3aG9sZSBjbGllbnQgb2JqZWN0IHZpYSBQT1NUIChhcyB3ZSBhbHJlYWR5IGRvIGluIC91cGRhdGUgcm91dGUgKVxuICAgICAgICAgICAgICAgICAgICBjbGllbnRuYW1lOiBjbGllbnRuYW1lLFxuICAgICAgICAgICAgICAgICAgICBob3N0bmFtZTogaG9zdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbixcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50aXA6IGNsaWVudGlwLFxuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICAgICAgICAgICAgICBmb2N1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZXVybDpmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBiaXB1c2VySUQ6IGJpcHVzZXJJRCwgIC8vIHdlIGNhbiB1c2UgdGhpcyBpbiB0aGUgZnV0dXJlIHRvIHJlLWNoZWNrIGlmIHRoaXMgdXNlciBpcyBpbiB0aGUgcHJlLWRlZmluZWQgdXNlcmxpc3QgZm9yIHRoaXMgc3BlY2lmaWMgQklQIGV4YW1cbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiB7IGdyb3VwOiBncm91cCB8fCAnYSd9LCAgICAvLyB3ZSB1c2UgdGhpcyB0byBzdG9yZSAocGVyIHN0dWRlbnQpIGluZm9ybWF0aW9uIGFib3V0IHdoYXRzIGdvaW5nIG9uIG9uIHRoZSBzZXJ2ZXJzaWRlICh0YXNrbGlzdCkgYW5kIHNlbmQgaXQgYmFjayBvbiAvdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIGFsbG93IHR3byBncm91cHMgKHRoaXMgaXMganVzdCB1c2VkIGZvciBkaXN0cmlidXRpb24gb2YgZmlsZXMgYnkgbm93KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2NyZWF0ZSBmb2xkZXIgZm9yIHN0dWRlbnRcbiAgICAgICAgICAgICAgICBsZXQgc3R1ZGVudGZvbGRlciA9cGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUgLCBjbGllbnRuYW1lKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMuYWNjZXNzKHN0dWRlbnRmb2xkZXIpOyAvLyBDaGVjayBpZiBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIC8vIGRhcyB2ZXJ6ZWljaG5pcyBmXHUwMEZDciBkaWVzZW4gc3R1ZGVudCBleGlzdGllcnQgXG4gICAgICAgICAgICAgICAgICAgIC8vIGF1ZiB1bml4IGlzdCBkZXIgb3JkbmVybmFtZSAxMDAlIGlkZW50IC0gYXVmIHdpbmRvd3Mga1x1MDBGNm5udGUgZXMgYWJlciBpbiBkZXIgZ3Jvc3Mva2xlaW5zY2hyZWlidW5nIHVudGVyc2NoaWVkZSBnZWJlblxuICAgICAgICAgICAgICAgICAgICAvLyBwclx1MDBGQ2ZlIG9iIGVzIEVYQUtUIGdsZWljaCBnZXNjaHJpZWJlbiB3dXJkZSAoY2FzZS1zZW5zaXRpdilcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudERpciA9IHBhdGguZGlybmFtZShzdHVkZW50Zm9sZGVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGlyTmFtZSA9IHBhdGguYmFzZW5hbWUoc3R1ZGVudGZvbGRlcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpcmVjdG9yaWVzID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIocGFyZW50RGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRGlyZWN0b3J5KCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkaXJlY3Rvcmllcy5pbmNsdWRlcyh0YXJnZXREaXJOYW1lKSkgeyAgLy8gd2lyIGhhYmVuIHdpbmRvd3MgZXJ0YXBwdC4uIGRlciBkYXRlaW5hbWUgaXN0IG5pY2h0IDEwMCUgaWRlbnQgXCJUZXN0XCIgIT09IFwidGVzdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nRGlyID0gZGlyZWN0b3JpZXMuZmluZChkaXIgPT4gZGlyLnRvTG93ZXJDYXNlKCkgPT09IHRhcmdldERpck5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmdEaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKHBhcmVudERpciwgZXhpc3RpbmdEaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4ocGFyZW50RGlyLCBgYmFja3VwLSR7ZXhpc3RpbmdEaXJ9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMucmVuYW1lKG9sZFBhdGgsIG5ld1BhdGgpOyAgLy8gVW1iZW5lbm5lbiBkZXMgYWx0ZW4gVmVyemVpY2huaXNzZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBSZW5hbWluZyAke29sZFBhdGh9IHRvICR7bmV3UGF0aH0gLSB0aHggYmlsbCBnYXRlcyBmb3IgdGhlIHdvcnN0IG9wZXJhdGluZyBzeXN0ZW0gb3R3YClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb250cm9sIEAgcmVnaXN0ZXJjbGllbnQ6IFVzaW5nIGFscmVhZHkgZXhpc3RpbmcgZGlyZWN0b3J5OiAke3RhcmdldERpck5hbWV9YClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBEYXMgVmVyemVpY2huaXMgZXhpc3RpZXJ0IG5pY2h0LCBlcnN0ZWxsZSBlc1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3R1ZGVudGZvbGRlciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29udHJvbCBAIHJlZ2lzdGVyY2xpZW50OiBDcmVhdGluZyAke3N0dWRlbnRmb2xkZXJ9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKG1rZGlyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogRXJyb3IgY3JlYXRpbmcgZGlyZWN0b3J5OiAke21rZGlyRXJyfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBEaXJlY3RvcnkgbWlnaHQgYWxyZWFkeSBleGlzdCwgdGhhdCdzIG9rXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWNTZXJ2ZXIuc3R1ZGVudExpc3QucHVzaChjbGllbnQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wucmVnaXN0ZXJlZFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIiwgdG9rZW46IHRva2VufSkgIC8vIG9uIHN1Y2Nlc3MgcmV0dXJuIGNsaWVudCB0b2tlbiAoYXV0aCBuZWVkZWQgZm9yIHNlcnZlciBhcGkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgIGlmIChub3cgLSAyMDAwMCA+IHJlZ2lzdGVyZWRDbGllbnQudGltZXN0YW1wKSB7IC8vIHN0dWRlbnQgcHJvYmFibHkgd2VudCBvZmZsaW5lICh0ZWFjaGVyIGNvbm5lY3Rpb24gbG9zcykgYnV0IGlzIGNvbWluZyBiYWNrIG5vd1xuICAgICAgICAgICAgICAgICAgICByZWdpc3RlcmVkQ2xpZW50LnRpbWVzdGFtcCA9IG5vd1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogc3R1ZGVudCByZWNvbm5lY3RlZFwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vaW5mb3JtIGZyb250ZW5kIGFib3V0IHJlLWNvbm5lY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoXCJyZWNvbm5lY3RlZFwiLCByZWdpc3RlcmVkQ2xpZW50KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5yZWdpc3RlcmVkXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCB0b2tlbjogcmVnaXN0ZXJlZENsaWVudC50b2tlbn0pICAvL3NlbmQgYmFjayBvbGQgdG9rZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0pXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC53cm9uZ3BpblwiKSwgc3RhdHVzOiBcImVycm9yXCJ9KVxuICAgICAgICB9XG4gICAgfVxuICAgIGNhdGNoIChlcnIpe1xuICAgICAgICBsb2cuZXJyb3IoYGNvbnRyb2wgQCByZWdpc3RlcmNsaWVudDogJHtlcnJ9YCk7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwiYW4gdW5rbm93biBlcnJvciBvY2N1cmVkXCIsIHN0YXR1czogXCJlcnJvclwifSlcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBJTkZPUk0gQ2xpZW50KHMpIGFib3V0IGEgXCJzZW5kZmlsZVwiIHJlcXVlc3QgZnJvbSB0aGUgc2VydmVyIChjbGllbnRzIHNob3VsZCBkb3dubG9hZCB0aGUgZmlsZShzKSB2aWEgL2RhdGEvZG93bmxvYWQvLi4uIHJvdXRlKSBcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlciB0aGF0IHdhaXRzIHdpdGggdGhlIGZpbGVcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIHNlbmQgdGhlIGV4YW0gKGZhbHNlIG1lYW5zIGV2ZXJ5Ym9keSlcbiAqL1xuIHJvdXRlci5wb3N0KCcvc2VuZHRvY2xpZW50LzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgY29uc3QgZmlsZXMgPSByZXEuYm9keS5maWxlcyAgIC8vICB7IGZpbGVzOlsge25hbWU6ZmlsZS5uYW1lLCBwYXRoOmZpbGUucGF0aCB9LCB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0gXSB9XG4gICBcbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ10gPSB0cnVlICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9ICBmaWxlc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ109IHRydWUgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBmaWxlc1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5leGFtcmVxdWVzdFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqICBLSUNLIGNsaWVudCAtIGNsaWVudCB3aWxsIGdldCBlcnJvciByZXNwb25zZSBvbiBuZXh0IHVwZGF0ZSBhbmQgcmVtb3ZlIGNvbm5lY3Rpb24gYXV0b21hdGljYWxseVxuICogQHBhcmFtIHNlcnZlbmFtZSB0aGUgc2VydmVyIHRoYXQgd2FudHMgdG8ga2ljayB0aGUgY2xpZW50XG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBiZSBraWNrZWRcbiAqL1xuLy8gIHJvdXRlci5nZXQoJy9raWNrLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuLy8gICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbi8vICAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuLy8gICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG5cbi8vICAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4vLyAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbi8vICAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuLy8gICAgICAgICByZXMuc2VuZCgge3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuc3R1ZGVudHJlbW92ZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuLy8gICAgIH1cbi8vICAgICBlbHNlIHtcbi8vICAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbi8vICAgICB9XG4vLyB9KVxuXG5cblxuXG4vKipcbiAqIFNFVCBjaWVudHMgU0hBUkUgTElOSyBmb3IgbWljcm9zb2Z0MzY1IG1vZGVcbiAqIEBwYXJhbSBzZXJ2ZW5hbWUgdGhlIHNlcnZlcnMgbmFtZVxuICogQHBhcmFtIGNzcmZzZXJ2ZXJ0b2tlbiB0aGUgc2VydmVycyB0b2tlbiB0byBhdXRoZW50aWNhdGVcbiAqIEBwYXJhbSBzdHVkZW50dG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHdobyBzaG91bGQgYmUga2lja2VkXG4gKi9cbnJvdXRlci5wb3N0KCcvc2hhcmVsaW5rLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4vOnN0dWRlbnR0b2tlbicsIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgY29uc3Qgc2hhcmVsaW5rID0gcmVxLmJvZHkuc2hhcmVsaW5rXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBcbiAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLm1zb2ZmaWNlc2hhcmUgPSBzaGFyZWxpbmtcbiAgICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuLyoqXG4gKiBSRVNUT1JFIGNpZW50cyBmb2N1c2VkIHN0YXRlICAhISBVU0UgL3NldHN0dWRlbnRzdGF0dXMvIGluc3RlYWQgKHNpbXBsaWZ5IGNvZGUpXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvJ3Mgc3RhdGUgc2hvdWxkIGJlIHJlc3RvcmVkXG4gKi9cbiByb3V0ZXIuZ2V0KCcvcmVzdG9yZS86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgIGlmIChzdHVkZW50KSB7ICAgXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9IHRydWUgIC8vIHNldCBzdHVkZW50LnN0YXR1cyBzbyB0aGF0IHRoZSBzdHVkZW50IGNhbiByZXN0b3JlIGl0cyBmb2N1cyBzdGF0ZSBvbiB0aGUgbmV4dCB1cGRhdGVcbiAgICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0YXRlcmVzdG9yZVwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogRkVUQ0ggRVhBTVMgZnJvbSBjb25uZWN0ZWQgY2xpZW50cyAoc2V0IHN0dWRlbnQuc3RhdHVzIC0gc3R1ZGVudHMgd2lsbCB0aGVuIHNlbmQgdGhlaXIgd29ya2RpcmVjdG9yeSB0byAvZGF0YS9yZWNlaXZlKVxuICogYXR0ZW50aW9uISEgIG1vdmUgdG8gc2V0U3R1ZGVudFN0YXR1cyBldmVudHVhbGx5Li4gYmVjYXVzZSBpdHMgcmVkdW5kYW50XG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgdGhhdCB3YW50cyB0byBraWNrIHRoZSBjbGllbnRcbiAqIEBwYXJhbSBjc3Jmc2VydmVydG9rZW4gdGhlIHNlcnZlcnMgdG9rZW4gdG8gYXV0aGVudGljYXRlXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiB3aG8gc2hvdWxkIHNlbmQgdGhlIGV4YW0gKGZhbHNlIG1lYW5zIGV2ZXJ5Ym9keSlcbiAqL1xuIHJvdXRlci5nZXQoJy9mZXRjaC86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuXG4gICAgaWYgKHJlcS5wYXJhbXMuY3NyZnNlcnZlcnRva2VuID09PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7ICAvL2ZpcnN0IGNoZWNrIGlmIGNzcmYgdG9rZW4gaXMgdmFsaWQgYW5kIHNlcnZlciBpcyBhbGxvd2VkIHRvIHRyaWdnZXIgdGhpcyBhcGkgcmVxdWVzdFxuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBzdHVkZW50LnN0YXR1c1snc2VuZGV4YW0nXSA9IHRydWUgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgICAgIGlmIChzdHVkZW50KSB7ICBzdHVkZW50LnN0YXR1c1snc2VuZGV4YW0nXT0gdHJ1ZSAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5leGFtcmVxdWVzdFwiKSwgc3RhdHVzOiBcInN1Y2Nlc3NcIn0gKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFjdGlvbmRlbmllZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9IClcbiAgICB9XG59KVxuXG5cblxuXG5cblxuLyoqXG4gKiBHZXQgcHJldmlvdXMgU2VydmVyc3RhdHVzIGFuZCByZXR1cm4gU2VydmVyc3RhdHVzIGZyb20gRklMRSAoZnJvbSBwcmV2aW91cyBpbnRlcnJ1cHRlZCBleGFtIGluIG9yZGVyIHRvIHJlc3VtZSlcbiAqIEBwYXJhbSBzZXJ2ZXJuYW1lIHRoZSBuYW1lIG9mIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHNlcnZlcnRva2VuIHRvIGF1dGhlbnRpY2F0ZSBiZWZvcmUgdGhlIHJlcXVlc3QgaXMgcHJvY2Vzc2VkXG4gKi9cbnJvdXRlci5wb3N0KCcvZ2V0c2VydmVyc3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjc3Jmc2VydmVydG9rZW4gPSByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChjc3Jmc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudG9rZW5ub3R2YWxpZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICl9XG4gICAgLy8gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIHZvbiBkZXIgSlNPTi1EYXRlaSB3aWVkZXIgaW1wb3J0aWVyZW5cbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcbiAgICBsZXQgc2VydmVyc3RhdHVzO1xuICAgIHRyeSB7ICBcbiAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIHNlcnZlcnN0YXR1cyA9IEpTT04ucGFyc2UoZmlsZUNvbnRlbnQpOyBcbiAgICAgICAgbWNTZXJ2ZXIuc2VydmVyaW5mby5waW4gPSBzZXJ2ZXJzdGF0dXMucGluICAvL2Fsc28gcmVzdG9yZSBsYXN0IHBpbiB0byBtYWtlIGl0IGVhc2llciBmb3Igc3R1ZGVudHNcbiAgICB9ICAgIFxuICAgIGNhdGNoIChlcnJvcikgeyAgc2VydmVyc3RhdHVzID0gZmFsc2U7ICB9XG4gICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzfSkgXG59KVxuXG4vL2dldCBjdXJyZW50IHNlcnZlcnN0YXR1cyBmcm9tIG1jc2VydmVyXG5yb3V0ZXIuZ2V0KCcvZ2V0Y3VycmVudHNlcnZlcnN0YXR1cy86c2VydmVybmFtZS86Y3NyZnNlcnZlcnRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgY3NyZnNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBpZiAoIW1jU2VydmVyKSB7ICByZXR1cm4gcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5ub3Rmb3VuZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICkgIH1cbiAgICBpZiAoY3NyZnNlcnZlcnRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuKSB7IHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnRva2Vubm90dmFsaWRcIiksIHN0YXR1czogXCJlcnJvclwifSApfVxuICAgXG4gICAgcmV0dXJuIHJlcy5qc29uKHtzZW5kZXI6IFwic2VydmVyXCIsIHN0YXR1czogXCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czogbWNTZXJ2ZXIuc2VydmVyc3RhdHVzfSkgXG59KVxuXG5cblxuXG4vKipcbiAqIFNldCBTZXJ2ZXJzdGF0dXMgXG4gKiBTdHVkZW50cyBmZXRjaCB0aGUgc2VydmVyc3RhdHVzIG9iamVjdCBldmVyeSB1cGRhdGVjeWNsZSBhbmQgYWN0IG9uIGl0IChzdGFydCBleGFtLCBsb2Nrc2NyZWVucyxldGMpXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHNlcnZlcnRva2VuIHRvIGF1dGhlbnRpY2F0ZSBiZWZvcmUgdGhlIHJlcXVlc3QgaXMgcHJvY2Vzc2VkXG4gKiBAcGFyYW0gcmVxLmJvZHkuc2VydmVyc3RhdHVzIGNvbnRhaW5zIHRoZSB3aG9sZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0XG4gKi9cbnJvdXRlci5wb3N0KCcvc2V0c2VydmVyc3RhdHVzLzpzZXJ2ZXJuYW1lLzpjc3Jmc2VydmVydG9rZW4nLCBhc3luYyBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjc3Jmc2VydmVydG9rZW4gPSByZXEucGFyYW1zLmNzcmZzZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgIGlmICghbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLm5vdGZvdW5kXCIpLCBzdGF0dXM6IFwiZXJyb3JcIn0gKSAgfVxuICAgIGlmIChjc3Jmc2VydmVydG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgcmV0dXJuIHJlcy5zZW5kKHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImNvbnRyb2wudG9rZW5ub3R2YWxpZFwiKSwgc3RhdHVzOiBcImVycm9yXCJ9ICl9XG4gICAgXG4gICAgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzID0gcmVxLmJvZHkuc2VydmVyc3RhdHVzXG4gICAgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0ubXNPZmZpY2VGaWxlID0gZmFsc2UgIC8vIHdlIGNhbnQgc3RvcmUgYSBmaWxlIG9iamVjdCBhcyBqc29uXG5cbiAgICAvL2NvbnNvbGUubG9nKFwiY29udHJvbDpcIiwgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzKVxuICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHNldHNlcnZlcnN0YXR1czogc2F2aW5nIHNlcnZlciBzdGF0dXMgdG8gZGlzY1wiKVxuICAgIFxuICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSlcbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcblxuICAgIHRyeSB7ICBcbiAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShtY1NlcnZlci5zZXJ2ZXJzdGF0dXMsIG51bGwsIDIpO1xuICAgICAgICAvLyBWYWxpZGF0ZSBKU09OIGJlZm9yZSB3cml0aW5nIHRvIHByZXZlbnQgaW52YWxpZCBKU09OIGZpbGVzXG4gICAgICAgIEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwganNvblN0cmluZyk7ICBcbiAgICB9ICAgLy8gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIGFscyBKU09OLURhdGVpIHNwZWljaGVyblxuICAgIGNhdGNoIChlcnJvcikgeyAgXG4gICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHNldHNlcnZlcnN0YXR1czogJHtlcnJvcn1gICk7XG4gICAgICAgIHJldHVybiByZXMuanNvbih7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcImNvdWxkIG5vdCBzYXZlIHNlcnZlcnN0YXR1cyB0byBkaXNjXCIsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJnZW5lcmFsLm9rXCIpLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH0pXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuLyoqXG4gKiBTZXQgU1RVREVOVC5TVEFUVVMgYW5kIHRoZXJlZm9yZSBJbmZvcm0gQ2xpZW50IG9uIHRoZSBuZXh0IHVwZGF0ZSBjeWNsZSBhYm91dCBhIGRlbmllZCBwcmludHJlcXVlc3QgKHdlIGhhbmRsZSBvbmUgcmVxdWVzdCBhdCBhIHRpbWUpIGFuZCBvdGhlciB0aGluZ3MuXG4gKiBAcGFyYW0gc2VydmVuYW1lIHRoZSBzZXJ2ZXIgXG4gKiBAcGFyYW0gY3NyZnNlcnZlcnRva2VuIHRoZSBzZXJ2ZXJzIHRva2VuIHRvIGF1dGhlbnRpY2F0ZVxuICogQHBhcmFtIHN0dWRlbnR0b2tlbiB0aGUgc3R1ZGVudHMgdG9rZW4gd2hvIHNob3VsZCBiZSBpbmZvcm1lZFxuICovXG5yb3V0ZXIucG9zdCgnL3NldHN0dWRlbnRzdGF0dXMvOnNlcnZlcm5hbWUvOmNzcmZzZXJ2ZXJ0b2tlbi86c3R1ZGVudHRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICBcbiAgICBjb25zdCBwcmludGRlbmllZCA9IHJlcS5ib2R5LnByaW50ZGVuaWVkXG4gICAgY29uc3QgZGVsZm9sZGVyID0gcmVxLmJvZHkuZGVsZm9sZGVyXG4gICAgY29uc3QgYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IHJlcS5ib2R5LmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2tcbiAgICBjb25zdCBhY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9ucyA9IHJlcS5ib2R5LmFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zXG4gICAgY29uc3QgcmVtb3ZlcHJpbnRyZXF1ZXN0ID0gcmVxLmJvZHkucmVtb3ZlcHJpbnRyZXF1ZXN0XG4gICAgY29uc3QgZ3JvdXAgPSByZXEuYm9keS5ncm91cFxuICAgIGNvbnN0IGtpY2tlZCA9IHJlcS5ib2R5LmtpY2tcbiAgICBjb25zdCBtc29mZmljZXNoYXJlID0gcmVxLmJvZHkubXNvZmZpY2VzaGFyZVxuICAgIGNvbnN0IGdldG1hdGVyaWFscyA9IHJlcS5ib2R5LmdldG1hdGVyaWFsc1xuXG5cbiAgICBpZiAocmVxLnBhcmFtcy5jc3Jmc2VydmVydG9rZW4gPT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4pIHsgIC8vZmlyc3QgY2hlY2sgaWYgY3NyZiB0b2tlbiBpcyB2YWxpZCBhbmQgc2VydmVyIGlzIGFsbG93ZWQgdG8gdHJpZ2dlciB0aGlzIGFwaSByZXF1ZXN0XG4gICAgICAgIFxuICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09PSBcImFsbFwiKXtcbiAgICAgICAgICAgIGZvciAobGV0IHN0dWRlbnQgb2YgbWNTZXJ2ZXIuc3R1ZGVudExpc3QpeyBcbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyKSAgeyBzdHVkZW50LnN0YXR1cy5kZWxmb2xkZXIgPSB0cnVlICAgfSAvLyBvbiB0aGUgbmV4dCB1cGRhdGUgY3ljbGUgdGhlIHN0dWRlbnQgZ2V0cyBpbmZvcm1lZCB0byBkZWxldGUgd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgIGlmIChncm91cCkge3N0dWRlbnQuc3RhdHVzLmdyb3VwID0gZ3JvdXA7IH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1zb2ZmaWNlc2hhcmUgIT09ICd1bmRlZmluZWQnKSB7c3R1ZGVudC5zdGF0dXMubXNvZmZpY2VzaGFyZSA9IG1zb2ZmaWNlc2hhcmU7IH0gICAvLyB3ZSBuZWVkIHRvIHNldCB0aGlzIHRvIGZhbHNlIGZvciBldmVyeSBzdHVkZW50IHRvIHRyaWdnZXIgYSBuZXcgdXBsb2FkIG9mIHRoZSBtc09mZmljZUZpbGUgb24gc2VjdGlvbiBjaGFuZ2VcbiAgICAgICAgICAgICAgICBpZiAoZ2V0bWF0ZXJpYWxzKSB7c3R1ZGVudC5zdGF0dXMuZ2V0bWF0ZXJpYWxzID0gdHJ1ZTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIC8vIGhlcmUgd2UgaGFuZGxlIGRpZmZlcmVudCBmb3JtcyBvZiBpbmZvcm1hdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHNldCBvbiBzdHVkZW50c3RhdHVzIChkb250IGZvcmdldCB0byByZXNldCB0aG9zZSB2YWx1ZXMgaW4gL3VwZGF0ZS9yb3V0ZSlcbiAgICAgICAgICAgICAgICBpZiAocHJpbnRkZW5pZWQpeyBcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMucHJpbnRkZW5pZWQgPSB0cnVlIC8vIHNldCBzdHVkZW50LnN0YXR1cyBzbyB0aGF0IHRoZSBzdHVkZW50IGNhbiBhY3Qgb24gaXQgb24gdGhlIG5leHQgdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vIHVuc2V0IHByaW50cmVxdWVzdCBzbyB0aGF0IGRhc2hib2FyZCBmZXRjaEluZm8gKHdoaWNoIGZldGNoZXMgdGhlIHN0dWRlbnRsaXN0KSBkb2VzbnQgdHJpZ2dlciBpdCBhZ2FpblxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgaWYgKGRlbGZvbGRlcikgIHsgc3R1ZGVudC5zdGF0dXMuZGVsZm9sZGVyID0gdHJ1ZSAgIH0gLy8gb24gdGhlIG5leHQgdXBkYXRlIGN5Y2xlIHRoZSBzdHVkZW50IGdldHMgaW5mb3JtZWQgdG8gZGVsZXRlIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjaykgeyAgICAvLyBhbGxvdyBzcGVsbGNoZWNrIGZvciB0aGlzIHNwZWNpZmljIHN0dWRlbnQgKHNwZWNpYWwgY2FzZXMpXG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSB0cnVlOyBcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnMgPSBhY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9ucztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVTdWdnZXN0aW9ucyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVtb3ZlcHJpbnRyZXF1ZXN0ID09IHRydWUpeyBzdHVkZW50LnByaW50cmVxdWVzdCA9IGZhbHNlIH0gIC8vIHVuc2V0IHByaW50cmVxdWVzdCBzbyB0aGF0IGRhc2hib2FyZCBmZXRjaEluZm8gKHdoaWNoIGZldGNoZXMgdGhlIHN0dWRlbnRsaXN0KSBkb2VzbnQgdHJpZ2dlciBpdCBhZ2FpblxuICAgICAgICAgICAgICAgIGlmIChncm91cCkge3N0dWRlbnQuc3RhdHVzLmdyb3VwID0gZ3JvdXA7IH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1zb2ZmaWNlc2hhcmUgIT09ICd1bmRlZmluZWQnKSB7c3R1ZGVudC5zdGF0dXMubXNvZmZpY2VzaGFyZSA9IG1zb2ZmaWNlc2hhcmU7IH1cbiAgICAgICAgICAgICAgICBpZiAoa2lja2VkKSB7IHN0dWRlbnQuc3RhdHVzLmtpY2tlZCA9IHRydWUgfVxuICAgICAgICAgICAgICAgIGlmIChnZXRtYXRlcmlhbHMpIHtzdHVkZW50LnN0YXR1cy5nZXRtYXRlcmlhbHMgPSB0cnVlOyB9XG5cbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiY29udHJvbCBAIHNldHN0dWRlbnRzdGF0dXM6XCIsIHJlcS5ib2R5KVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgXG4gICAgICAgICAgICBpZiAobm93IC0gMjAwMDAgPiBzdHVkZW50LnRpbWVzdGFtcCAmJiBzdHVkZW50LnN0YXR1cy5raWNrZWQpICAgIHtcbiAgICAgICAgICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnNlbmQoIHtzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czogXCJzdWNjZXNzXCJ9IClcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5zZW5kKCB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hY3Rpb25kZW5pZWRcIiksIHN0YXR1czogXCJlcnJvclwifSApXG4gICAgfVxufSlcblxuXG5cblxuXG4vKipcbiAqIFRIRSBGT0xMT1dJTkcgUk9VVEVTIEFSRSBBQ0NFU1NFRCBCWSBTVFVERU5UUyBPTkxZXG4gKi9cblxuXG4vKipcbiAqIFVQREFURVMgQ2xpZW50aW5mbyAtIHRoZSBzcGVjaWZpZWQgc3R1ZGVudHMgdGltZXN0YW1wICh1c2VkIGluIGRhc2hib2FyZCB0byBtYXJrIHVzZXIgYXMgb25saW5lKSBhbmQgb3RoZXIgc3RhdHVzIHVwZGF0ZXNcbiAqIEZFVENIRVMgU2VydmVyc3RhdHVzICYgU3R1ZGVudHN0YXR1c1xuICogdXN1YWxseSB0cmlnZ2VyZWQgYnkgdGhlIGNsaWVudHMgZGlyZWN0bHkgZnJvbSB0aGUgTWFpbiBQcm9jZXNzIChsb29wKVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBlbnRyeSBpbiB0aGUgbGlzdFxuICovXG4gcm91dGVyLnBvc3QoJy91cGRhdGUnLCBmdW5jdGlvbiAocmVxLCByZXMsIG5leHQpIHtcbiAgICBjb25zdCBjbGllbnRpbmZvID0gcmVxLmJvZHkuY2xpZW50aW5mb1xuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICBjb25zdCBleGFtbW9kZSA9IGNsaWVudGluZm8uZXhhbW1vZGVcbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG5cbiAgICAvL2NoZWNrIGlmIHNlcnZlciBhbmQgc3R1ZGVudCBleGlzdFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9ICAvLyBzZXJ2ZXIgaXMgZ29uZSAtIGRpc2Nvbm5lY3Qgc3R1ZGVudFxuXG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgIGlmICggIXN0dWRlbnQgKSB7cmV0dXJuIHJlcy5zZW5kKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwicmVtb3ZlZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KSB9IC8vIHN0dWRlbnQga2lja2VkIC0gZGlzY29ubmVjdCBzdHVkZW50XG5cbiAgICAvL3VwZGF0ZSBpbXBvcnRhbnQgc3R1ZGVudCBhdHRyaWJ1dGVzXG4gICAgc3R1ZGVudC5mb2N1cyA9IGNsaWVudGluZm8uZm9jdXNcbiAgICBzdHVkZW50LnZpcnR1YWxpemVkID0gY2xpZW50aW5mby52aXJ0dWFsaXplZFxuICAgIHN0dWRlbnQudGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL2xhc3Qgc2VlbiAgLyB0aGlzIGlzIGxpa2UgYSBoZWFydGJlYXQgLSB1cGRhdGUgbGFzdHNlZW5cbiAgICBzdHVkZW50LmV4YW1tb2RlID0gZXhhbW1vZGUgIFxuICAgIHN0dWRlbnQuZmlsZXMgPSBjbGllbnRpbmZvLm51bWJlck9mRmlsZXNcbiAgICBzdHVkZW50LnJlbW90ZWFzc2lzdGFudCA9IGNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50XG5cbiAgICBpZiAoY2xpZW50aW5mby5mb2N1cykgeyBzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9IGZhbHNlIH0gIC8vIHJlbW92ZSB0YXNrIGJlY2F1c2UgaXRzIG9idmlvdXNseSBkb25lXG4gICAgaWYgKGNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID09IDApeyBzdHVkZW50LmltYWdldXJsID0gXCJwZXJzb24tbGluZXMtZmlsbC5zdmdcIiAgfVxuXG4gICAgbGV0IHN0dWRlbnRzdGF0dXMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHN0dWRlbnQuc3RhdHVzKSkgIC8vIGNvcHkgY3VycmVudCBzdGF0dXMgPiBzZW5kIGNvcHkgb2Ygb3JpZ2luYWwgdG8gc3R1ZGVudFxuICAgXG4gICAgLy8gdGVhY2hlciBzZXRzIHN0dWRlbnRzdGF0dXMua2ljayB0byB0cnVlIC0gdGhlIG1vbWVudCB0aGUgc3R1ZGVudCBmZXRjaGVzIGhpcyBzdGF0dXMgYW5kIGtud29uIGhlJ3Mga2lja2VkIGhlIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICBpZiAoc3R1ZGVudC5zdGF0dXMua2lja2VkKSAgICB7XG4gICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQudG9rZW4gPT09IHN0dWRlbnR0b2tlbilcbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgICBtY1NlcnZlci5zdHVkZW50TGlzdCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbHRlciggZWwgPT4gZWwudG9rZW4gIT09ICBzdHVkZW50dG9rZW4pOyB9IC8vIHJlbW92ZSBjbGllbnQgZnJvbSBzdHVkZW50bGlzdFxuICAgIH1cblxuXG4gICAgLy8gcmVzZXQgc29tZSBzdGF0dXMgdmFsdWVzIHRoYXQgYXJlIG9ubHkgdXNlZCB0byB0cmFuc3BvcnQgc29tZXRoaW5nIG9uY2VcbiAgICBzdHVkZW50LnN0YXR1cy5wcmludGRlbmllZCA9IGZhbHNlIFxuICAgIHN0dWRlbnQuc3RhdHVzLmRlbGZvbGRlciA9IGZhbHNlIFxuICAgIHN0dWRlbnQuc3RhdHVzLnNlbmRleGFtID0gZmFsc2UgLy8gcmVxdWVzdCBvbmx5IG9uY2VcbiAgICBzdHVkZW50LnN0YXR1cy5mb2N1cyA9IHRydWVcbiAgICBzdHVkZW50LnN0YXR1cy5nZXRtYXRlcmlhbHMgPSBmYWxzZVxuICAgIC8vc3R1ZGVudC5zdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9IGZhbHNlICAgLy8gYWN0aXZhdGUgb25seSBvbmNlIC0gd2hlbiBzdHVkZW50IHJldHJpZXZlZCBcInN0dWRlbnRzdGF0dXNcIiB3ZSBjYW4gcmVzZXQgc29tZSB2YWx1ZXMgb2YgXCJzdHVkZW50LnN0YXR1c1wiXG5cbiAgICAvLyByZXR1cm4gY3VycmVudCBzZXJ2ZXJpbmZvcm1hdGlvbiB0byBwcm9jZXNzIG9uIGNsaWVudHNpZGUgXG4gICAgLy8gQ3JlYXRlIG9wdGltaXplZCBzaGFsbG93IGNvcHkgb2Ygc2VydmVyc3RhdHVzIHdpdGhvdXQgZXhhbUluc3RydWN0aW9uRmlsZXMgdG8gcmVkdWNlIHBheWxvYWQgc2l6ZVxuICAgIGNvbnN0IHNlcnZlcnN0YXR1c0NvcHkgPSB7IC4uLm1jU2VydmVyLnNlcnZlcnN0YXR1cyB9O1xuICAgIHNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zID0geyAuLi5tY1NlcnZlci5zZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zIH07XG4gICAgXG4gICAgLy8gQ2xlYXIgZXhhbUluc3RydWN0aW9uRmlsZXMgaW4gYWxsIDQgZXhhbVNlY3Rpb25zIGZvciBib3RoIGdyb3VwQSBhbmQgZ3JvdXBCICh3ZSBkb250IHdhbnQgdG8gc2VuZCB0aGUgbWF0ZXJpYWxzIHRvIHRoZSBzdHVkZW50IG9uIGV2ZXJ5IHVwZGF0ZSlcbiAgICBmb3IgKGxldCBzZWN0aW9uS2V5IG9mIFsxLCAyLCAzLCA0XSkge1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzQ29weS5leGFtU2VjdGlvbnNbc2VjdGlvbktleV0pIHtcbiAgICAgICAgICAgIHNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldID0ge1xuICAgICAgICAgICAgICAgIC4uLnNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldLFxuICAgICAgICAgICAgICAgIGdyb3VwQToge1xuICAgICAgICAgICAgICAgICAgICAuLi5zZXJ2ZXJzdGF0dXNDb3B5LmV4YW1TZWN0aW9uc1tzZWN0aW9uS2V5XS5ncm91cEEsXG4gICAgICAgICAgICAgICAgICAgIGV4YW1JbnN0cnVjdGlvbkZpbGVzOiBbXVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ3JvdXBCOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNlcnZlcnN0YXR1c0NvcHkuZXhhbVNlY3Rpb25zW3NlY3Rpb25LZXldLmdyb3VwQixcbiAgICAgICAgICAgICAgICAgICAgZXhhbUluc3RydWN0aW9uRmlsZXM6IFtdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXMuY2hhcnNldCA9ICd1dGYtOCc7XG4gICAgcmVzLnNlbmQoe3NlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiY29udHJvbC5zdHVkZW50dXBkYXRlXCIpLCBzdGF0dXM6XCJzdWNjZXNzXCIsIHNlcnZlcnN0YXR1czpzZXJ2ZXJzdGF0dXNDb3B5LCBzdHVkZW50c3RhdHVzOiBzdHVkZW50c3RhdHVzIH0pXG59KVxuXG5cbi8qKlxuICogVVBEQVRFIFNDUkVFTlNIT1RcbiAqIFBPU1QgRGF0YSBjb250YWlucyBhIHNjcmVlbnNob3Qgb2YgdGhlIGNsaWVudHMgZGVza3RvcCAhIVxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBzY3JlZW5zaG90XG4gKi9cbnJvdXRlci5wb3N0KCcvdXBkYXRlc2NyZWVuc2hvdCcsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IGNsaWVudGluZm8gPSByZXEuYm9keS5jbGllbnRpbmZvXG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcblxuICAgIC8vIGNoZWNrIGlmIHN0dWRlbnRAc2VydmVyIGV4aXN0c1xuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9XG4gICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgIGlmICggIXN0dWRlbnQgKSB7cmV0dXJuIHJlcy5zZW5kKHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwicmVtb3ZlZCBmcm9tIHNlcnZlclwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9KSB9IC8vY2hlY2sgaWYgdGhlIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiB0aGlzIHNlcnZlclxuICBcbiAgICBpZiAocmVxLmJvZHkuc2NyZWVuc2hvdCApIHtcbiAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IHJlcS5ib2R5LnNjcmVlbnNob3Q7ICAgLy8gRGVyIEJhc2U2NC1TdHJpbmcgbXVzcyBuaWNodCBrb252ZXJ0aWVydCB3ZXJkZW4sIGVyIGthbm4gZGlyZWt0IHZlcndlbmRldCB3ZXJkZW5cbiAgICAgICAgLy9sZXQgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgXG4gICAgICAgICAgICBzdHVkZW50LmltYWdldXJsID0gJ2RhdGE6aW1hZ2UvanBlZztiYXNlNjQsJyArIHNjcmVlbnNob3RCYXNlNjQ7IC8vIG9kZXIgJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCwnIGplIG5hY2ggdGF0c1x1MDBFNGNobGljaGVtIEJpbGRmb3JtYXQgIFxuXG4gICAgICAgICAgICAvLyBvbmx5IHNjYW4gc2NyZWVuc2hvdCBpbiBleGFtIG1vZGUgYW5kIE5PVCBpZiBhIHJlc3RvcmluZy91bmxvY2tpbmcgb3BlcmF0aW9uIGlzIGFscmVhZHkgaW4gcHJvY2VzcyAob3RoZXJ3aXNlIGl0IHdpbGwgbG9jayB0aGUgdW5sb2NrZWQgYWdhaW4pXG4gICAgICAgICAgICBpZiAobWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIG1jU2VydmVyLnNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyICYmICFzdHVkZW50LnN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSAmJiBzdHVkZW50LmZvY3VzKXtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHJlcS5ib2R5LmhlYWRlci5zcGxpdCgnO2Jhc2U2NCwnKS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyaW1hZ2VCdWZmZXIgPSBCdWZmZXIuZnJvbShoZWFkZXIsICdiYXNlNjQnKTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBhcHAuaXNQYWNrYWdlZFxuICAgICAgICAgICAgICAgICAgICA/IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycpXG4gICAgICAgICAgICAgICAgICAgIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFUZXNzZXJhY3RXb3JrZXIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgVGVzc2VyYWN0V29ya2VyID0gYXdhaXQgVGVzc2VyYWN0LmNyZWF0ZVdvcmtlcignZW5nJywxLHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nUGF0aDogcHVibGljUGF0aCAsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlUGF0aDogY29uZmlnLndvcmtkaXJlY3RvcnkgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhOiB7IHRleHQgfSB9ICA9IGF3YWl0IFRlc3NlcmFjdFdvcmtlci5yZWNvZ25pemUoaGVhZGVyaW1hZ2VCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGluY29kZVZpc2libGUgPSB0ZXh0LmluY2x1ZGVzKG1jU2VydmVyLnNlcnZlcmluZm8ucGluKVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGluY29kZVZpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5mb2N1cyA9IHBpbmNvZGVWaXNpYmxlICAvLyB0aGlzIGlzIHRoZSBsb2NhbCBzdHVkZW50IG9iamVjdCBmb3IgdGhlIGZyb250ZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1cy5mb2N1cyA9IHBpbmNvZGVWaXNpYmxlICAvLyB0aGlzIHNldHMgdGhlIHN0dWRlbnRzdGF0dXMgb2JqZWN0IHdoaWNoIGlzIGZldGNoZWQgb24gZXZlcnkgdXBkYXRlIC0gdGhlIHN0dWRlbnRzIHJlYWN0IG9uIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29udHJvbCBAIHVwZGF0ZXNjcmVlbnNob3QgKG9jcik6IFN0dWRlbnQgU2NyZWVuc2hvdCBkb2VzIG5vdCBpbmNsdWRlIEV4YW0gUElOXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5pbmZvKGBjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdCAob2NyKTogJHtlcnJ9YCk7IH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFzdHVkZW50LmZvY3VzKSB7IC8vIEFyY2hpdmllcmUgU2NyZWVuc2hvdCwgd2VubiBTdHVkZW50IG5pY2h0IGZva3Vzc2llcnQgaXN0XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogU3R1ZGVudCBvdXQgb2YgZm9jdXMgLSBzZWN1cmluZyBzY3JlZW5zaG90c1wiKTtcbiAgICAgICAgICAgICAgICBsZXQgdGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zdWJzdHIoMTEsIDgpLnJlcGxhY2UoLzovZywgXCJfXCIpO1xuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsIFwiZm9jdXNsb3N0XCIpO1xuICAgICAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVuYW1lID0gcGF0aC5qb2luKGZpbGVwYXRoLCBgJHt0aW1lfS0ke3JlcS5ib2R5LnNjcmVlbnNob3RmaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKGZpbGVwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RCdWZmZXIgPSBCdWZmZXIuZnJvbShyZXEuYm9keS5zY3JlZW5zaG90LCAnYmFzZTY0Jyk7ICAgIC8vIEtvbnZlcnRpZXJlbiBkZXMgQmFzZTY0LVN0cmluZ3MgaW4gZWluZW4gQnVmZmVyIHVuZCBTcGVpY2hlcm4gZGVyIERhdGVpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVuYW1lLCBzY3JlZW5zaG90QnVmZmVyKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogJHtlcnJ9YCApOyB9XG4gICAgICAgICAgICB9XG4gICAgICBcbiAgICB9IGVsc2Uge1xuICAgICAgICAvL2xvZy53YXJuKCdjb250cm9sIEAgdXBkYXRlc2NyZWVuc2hvdDogU2NyZWVuc2hvdCBvciBoYXNoIG5vdCBwcm92aWRlZCcpO1xuICAgICAgICBzdHVkZW50LmltYWdldXJsID0gXCJwZXJzb24tbGluZXMtZmlsbC5zdmdcIlxuICAgIH1cbiAgICByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJjb250cm9sLnN0dWRlbnR1cGRhdGVcIiksIHN0YXR1czpcInN1Y2Nlc3NcIiB9KVxufSlcblxuXG4vKipcbiAqIFJlY2VpdmUgQUJHQUJFICYgUFJJTlRSRVFVRVNUIEZyb20gU3R1ZGVudFxuICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIG5hbWUgb2YgdGhlIHNlcnZlciBhdCB3aGljaCB0aGUgc3R1ZGVudCBpcyByZWdpc3RlcmVkXG4gKiBAcGFyYW0gdG9rZW4gdGhlIHN0dWRlbnRzIHRva2VuIHRvIHNlYXJjaCBhbmQgdXBkYXRlIHRoZSBlbnRyeSBpbiB0aGUgbGlzdFxuICovXG5yb3V0ZXIucG9zdCgnL3ByaW50cmVxdWVzdC86c2VydmVybmFtZS86c3R1ZGVudHRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3Qgc3R1ZGVudHRva2VuID0gcmVxLnBhcmFtcy5zdHVkZW50dG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgcGRmRG9jdW1lbnQgPSByZXEuYm9keS5kb2N1bWVudFxuICAgIGNvbnN0IHByaW50cmVxdWVzdCA9IHJlcS5ib2R5LnByaW50cmVxdWVzdFxuICAgIGNvbnN0IHN1Ym1pc3Npb25udW1iZXIgPSByZXEuYm9keS5zdWJtaXNzaW9ubnVtYmVyXG4gICAgY29uc3QgbG9ja2Vkc2VjdGlvbiA9IHJlcS5ib2R5LmxvY2tlZHNlY3Rpb24gfHwgMSAvLyBkZWZhdWx0IHRvIHNlY3Rpb24gMSBpZiBub3QgcHJvdmlkZWRcblxuXG4gICAgLy9jaGVjayBpZiBzZXJ2ZXIgZXhpc3RzIFxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdXG4gICAgaWYgKCAhbWNTZXJ2ZXIpIHsgIHJldHVybiByZXMuc2VuZCh7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90YXZhaWxhYmxlXCIsIHN0YXR1czogXCJlcnJvclwifSApICB9XG5cbiAgICAvL2NoZWNrIGlmIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXJcbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pXG4gICAgaWYgKCAhc3R1ZGVudCApIHtyZXR1cm4gcmVzLnNlbmQoeyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJyZW1vdmVkXCIsIHN0YXR1czogXCJlcnJvclwiIH0pIH1cbiAgICBcbiAgICBpZiAocHJpbnRyZXF1ZXN0KXsgICBcbiAgICAgICAgc3R1ZGVudC5wcmludHJlcXVlc3QgPSBwZGZEb2N1bWVudCAgLy8gd2UgcHV0IHRoZSBiYXNlNjQgc3RyaW5nIG9mIHRoZSBkb2N1bWVudCBvbiBwcmludHJlcXVlc3Qgd2hpY2ggaXMgY2hlY2tlZCBieSB0aGUgZnJvbnRlbmQgb24gZXZlcnkgZmV0Y2ggY3ljbGVcbiAgICB9XG5cbiAgICAvLyB0cmFjayBzdHVkZW50IHN1Ym1pc3Npb25zIG9uIHRoZSBzZXJ2ZXIgYmVjYXVzZSBvZiBwb3NzaWJsZSByZWNvbm5lY3RzIGFuZCByZXNldHMgb24gdGhlIHN0dWRlbnQgc2lkZVxuICAgIC8vIGlmIChzdHVkZW50LnN1Ym1pc3Npb25udW1iZXIgPT09IHVuZGVmaW5lZCl7XG4gICAgLy8gICAgIHN0dWRlbnQuc3VibWlzc2lvbm51bWJlciA9IDEgICAgLy8gZmlyc3Qgc3VibWlzc2lvblxuICAgIC8vIH1cbiAgICAvLyBlbHNlIHtcbiAgICAvLyAgICAgc3R1ZGVudC5zdWJtaXNzaW9ubnVtYmVyICs9IDFcbiAgICAvLyB9XG5cbiAgICBsZXQgc2FmZVN0dWRlbnQgPSBzdHVkZW50LmNsaWVudG5hbWUucmVwbGFjZSgvXFxzKy9nLCAnXycpICAvLyByZXBsYWNlIHNwYWNlcyB3aXRoIFwiX1wiXG4gICAgbGV0IG5vdyA9IG5ldyBEYXRlKClcbiAgXG4gICAgbGV0IHRpbWVzdGFtcCA9IGAke25vdy5nZXRGdWxsWWVhcigpfSR7U3RyaW5nKG5vdy5nZXRNb250aCgpKzEpLnBhZFN0YXJ0KDIsJzAnKX0ke1N0cmluZyhub3cuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCcwJyl9LSR7U3RyaW5nKG5vdy5nZXRIb3VycygpKS5wYWRTdGFydCgyLCcwJyl9JHtTdHJpbmcobm93LmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwnMCcpfSR7U3RyaW5nKG5vdy5nZXRTZWNvbmRzKCkpLnBhZFN0YXJ0KDIsJzAnKX1gXG4gICAgbGV0IGZpbGVuYW1lID0gYCR7c2VydmVybmFtZX0tJHtzYWZlU3R1ZGVudH0tJHtzdWJtaXNzaW9ubnVtYmVyfS0ke3RpbWVzdGFtcH0ucGRmYFxuXG5cbiAgIFxuICAgIGNvbnN0IHBkZkJ1ZmZlciA9IEJ1ZmZlci5mcm9tKHBkZkRvY3VtZW50LCAnYmFzZTY0Jyk7XG5cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbGVwYXRoID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsIHN0dWRlbnQuY2xpZW50bmFtZSwgJ0FCR0FCRScsIGxvY2tlZHNlY3Rpb24udG9TdHJpbmcoKSApIC8vIHRhcmdldCBkaXJcbiAgICAgICAgYXdhaXQgZnNwLm1rZGlyKGZpbGVwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgZGlyXG4gICAgICAgIGNvbnN0IGFic29sdXRlRmlsZW5hbWUgPSBwYXRoLmpvaW4oZmlsZXBhdGgsIGZpbGVuYW1lKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1aWxkIHBhdGhcbiAgICAgICAgYXdhaXQgZnNwLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVuYW1lLCBwZGZCdWZmZXIpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgbWFpblxuICAgICAgXG4gICAgICAgIGxvZy5pbmZvKGBjb250cm9sIEAgcHJpbnRyZXF1ZXN0OiBSZWNlaXZlZCBhbmQgc3RvcmVkIHN1Ym1pc3Npb24gZmlsZSBmb3IgdXNlcjogJHtzdHVkZW50LmNsaWVudG5hbWV9YClcbiAgICAgICAgLy8gY3JlYXRlIGJhY2t1cCBvZiBhYmdhYmVcbiAgICAgICAgbGV0IGJhY2t1cFN0YXR1cyA9ICdza2lwcGVkJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBiYWNrdXAgc3RhdHVzXG4gICAgICAgIGlmIChjb25maWcuYmFja3VwZGlyZWN0b3J5KSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9wdGlvbmFsIGJhY2t1cFxuICAgICAgICAgIGNvbnN0IGJhY2t1cHBhdGggPSBwYXRoLmpvaW4oY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUsICdBQkdBQkUnLCBsb2NrZWRzZWN0aW9uLnRvU3RyaW5nKCkgKVxuICAgICAgICAgIGF3YWl0IGZzcC5ta2RpcihiYWNrdXBwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgYmFja3VwIGRpclxuICAgICAgICAgIGNvbnN0IGFic29sdXRlQmFja3VwRmlsZW5hbWUgPSBwYXRoLmpvaW4oYmFja3VwcGF0aCwgZmlsZW5hbWUpICAgICAgICAgICAgICAgICAgICAgICAvLyBiYWNrdXAgcGF0aFxuICAgICAgICAgIGF3YWl0IGZzcC53cml0ZUZpbGUoYWJzb2x1dGVCYWNrdXBGaWxlbmFtZSwgcGRmQnVmZmVyKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSBiYWNrdXBcbiAgICAgICAgICBiYWNrdXBTdGF0dXMgPSAnb2snICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYmFja3VwIG9rXG4gICAgICAgIH1cbiAgICAgIFxuICAgICAgICByZXMuc2VuZCh7IHNlbmRlcjogJ3NlcnZlcicsIG1lc3NhZ2U6ICdzdWNjZXNzJywgc3RhdHVzOiAnc3VjY2VzcycsIGJhY2t1cDogYmFja3VwU3RhdHVzIH0pIC8vIHJlc3BvbmQgc3VjY2Vzc1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY29udHJvbCBAIHByaW50cmVxdWVzdDogJHtlcnJ9YCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvZyBlcnJvclxuICAgICAgICBsZXQgbWVzc2FnZSA9IHQoXCJjb250cm9sLnN1Ym1pc3Npb25mYWlsZWRcIilcbiAgICAgICAgcmVzLnN0YXR1cyg1MDApLnNlbmQoeyBzZW5kZXI6ICdzZXJ2ZXInLCBtZXNzYWdlOiBtZXNzYWdlLCBzdGF0dXM6ICdlcnJvcicgfSkgICAvLyByZXNwb25kIGVycm9yXG4gICAgICB9XG4gICAgXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgcm91dGVyXG5cblxuXG4vL2RvIG5vdCBhbGxvdyByZXF1ZXN0cyBmcm9tIGV4dGVybmFsIGhvc3RzXG5mdW5jdGlvbiByZXF1ZXN0U291cmNlQWxsb3dlZChyZXEscmVzKXtcbiAgICBpZiAocmVxLmlwID09IFwiOjoxXCIgIHx8IHJlcS5pcCA9PSBcIjEyNy4wLjAuMVwiIHx8IHJlcS5pcC5pbmNsdWRlcygnMTI3LjAuMC4xJykgKXsgXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gIFxuICAgIGxvZy5lcnJvcihgQmxvY2tlZCByZXF1ZXN0IGZyb20gcmVtb3RlIEhvc3Q6ICR7cmVxLmlwfWApOyBcbiAgICByZXMuanNvbignUmVxdWVzdCBkZW5pZWQnKSBcbiAgICByZXR1cm4gZmFsc2UgXG59XG4vL3RoaXMgaXMgbmVlZGVkIGJ5IHRoZSAvb2F1dGggYW5kIC9tc2F1dGggcm91dGVzIFxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlVmVyaWZpZXIoKSB7XG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21CeXRlcygzMikudG9TdHJpbmcoJ2hleCcpO1xufVxuZnVuY3Rpb24gc2hhMjU2KGJ1ZmZlcikge1xuICAgIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGJ1ZmZlcikuZGlnZXN0KCk7XG59XG5mdW5jdGlvbiBiYXNlNjRVcmxFbmNvZGUoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci50b1N0cmluZygnYmFzZTY0JylcbiAgICAucmVwbGFjZSgnKycsICctJylcbiAgICAucmVwbGFjZSgnLycsICdfJylcbiAgICAucmVwbGFjZSgvPSskLywgJycpO1xufVxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVTb2NrZXQgfSBmcm9tICdkZ3JhbSdcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJ1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cblxuLyoqXG4gKiBTdGFydHMgYSBkZ3JhbSAodWRwKSBzb2NrZXQgdGhhdCBicm9hZGNhc3RzIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgc2VydmVyXG4gKiBvbmUgbXVsdGljYXN0U2VydmVyIGluc3RhbmNlIGZvciBldmVyeSBleGFtIChob2xkcyBhbGwgc3R1ZGVudCBpbmZvcm1hdGlvbiBhbmQgc2VydmVyc3RhdHVzKVxuICovXG5jbGFzcyBNdWx0aWNhc3RTZXJ2ZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5TUkNfUE9SVCA9IDAgIC8vIGluIG9yZGVyIHRvIGFsbG93IHNldmVyYWwgbXVsdGljYXN0IHNlcnZlcnMgKG1vcmUgZXhhbXMgb24gdGhlIHNhbWUgbWFjaGluZSkgdGhpcyBwb3J0IG5lZWRzIHRvIGJlIHNldCBkeW5hbWljYWxseVxuICAgICAgICB0aGlzLkNsaWVudFBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5zZXJ2ZXIgPSBudWxsXG4gICAgICAgIHRoaXMuc2VydmVyaW5mbyA9IG51bGxcbiAgICAgICAgdGhpcy5icm9hZGNhc3RJbnRlcnZhbCA9IG51bGxcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICAgICAgdGhpcy5zdHVkZW50TGlzdCA9IFtdXG4gICAgICAgIHRoaXMuc2VydmVyc3RhdHVzID0ge31cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzZXRzIHVwIGFuIGludGVydmFsbCB0byBzZW5kIHNlcnZlcmluZm8gZXZlcnkgMiBzZWNvbmRzXG4gICAgICogQHBhcmFtIHNlcnZlcm5hbWUgdGhlIGdpdmVuIG5hbWUgb2YgdGhlIHNlcnZlciAoZm9yIGV4YW1wbGUgXCJtYXRoXCIpXG4gICAgICogQHBhcmFtIHBpbiB0aGUgcGluIG5lZWRlZCB0byByZWdpc3RlciBhcyBzdHVkZW50XG4gICAgICovXG4gICAgaW5pdCAoc2VydmVybmFtZSwgcGluLCBwYXNzd29yZCwgYmlwPWZhbHNlLCBiaXBJZD1udWxsKSB7XG4gICAgICAgIHRoaXMuc2VydmVyID0gY3JlYXRlU29ja2V0KCd1ZHA0JylcbiAgICAgICAgdGhpcy5zZXJ2ZXJpbmZvID0ge1xuICAgICAgICAgICAgc2VydmVybmFtZTogc2VydmVybmFtZSwgICAvL3Nob3VsZCBiZSB1bmlxdWUgaWYgc2V2ZXJhbCBzZXJ2ZXJzIGFyZSBhbGxvd2VkXG4gICAgICAgICAgICBwaW46IHBpbixcbiAgICAgICAgICAgIHBhc3N3b3JkOiBwYXNzd29yZCxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogMCxcbiAgICAgICAgICAgIGlkOiBiaXBJZCA/IGJpcElkIDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICAgICAgICAgIGlwOiBjb25maWcuaG9zdGlwLFxuICAgICAgICAgICAgc2VydmVydG9rZW46IGBzZXJ2ZXItJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWAsXG4gICAgICAgICAgICBiaXA6IGJpcCxcbiAgICAgICAgICAgIHZlcnNpb246IGNvbmZpZy52ZXJzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuc2VydmVyLmJpbmQodGhpcy5TUkNfUE9SVCwnMC4wLjAuMCcsICAoKSA9PiB7IC8vIEFkZCB0aGUgSE9TVF9JUF9BRERSRVNTIGZvciByZWxpYWJpbGl0eVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICB0aGlzLnNlcnZlci5zZXRNdWx0aWNhc3RUVEwoMTI4KVxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIuc2V0VFRMKDEyOClcbiAgICAgICAgICAgIHRoaXMuc2VydmVyLmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUik7IFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgICAgICB0aGlzLmJyb2FkY2FzdEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5zZW5kTXVsdGljYXN0TWVzc2FnZS5iaW5kKHRoaXMpLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5icm9hZGNhc3RJbnRlcnZhbC5zdGFydCgpXG5cblxuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdHNlcnZlciBAIGluaXQ6IFVEUCBNQyBTZXJ2ZXIgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5zZXJ2ZXIuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgfSlcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZXMgdGhlIHNlcnZlciB0aW1lc3RhbXAgYW5kIGFjdHVhbGx5IGJyb2FkY2FzdHMgdGhlIG1lc3NhZ2UgKHNlcnZlcmluZm8pXG4gICAgICovXG4gICAgc2VuZE11bHRpY2FzdE1lc3NhZ2UgKCkge1xuICAgICAgICB0aGlzLnNlcnZlcmluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgbGV0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiB0aGlzLnNlcnZlcmluZm8uc2VydmVybmFtZSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogdGhpcy5zZXJ2ZXJpbmZvLnRpbWVzdGFtcCxcbiAgICAgICAgICAgIGlkOiB0aGlzLnNlcnZlcmluZm8uaWQsXG4gICAgICAgICAgICBpcDogdGhpcy5zZXJ2ZXJpbmZvLmlwLFxuICAgICAgICAgICAgYmlwOiB0aGlzLnNlcnZlcmluZm8uYmlwLFxuICAgICAgICAgICAgdmVyc2lvbjogY29uZmlnLnZlcnNpb25cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcmVwYXJlZE1lc3NhZ2UgPSBuZXcgQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpXG4gICAgICAgIHRoaXMuc2VydmVyLnNlbmQocHJlcGFyZWRNZXNzYWdlLCAwLCBwcmVwYXJlZE1lc3NhZ2UubGVuZ3RoLCB0aGlzLkNsaWVudFBPUlQsIHRoaXMuTVVMVElDQVNUX0FERFIpICAvL2Jyb2FkY2FzdCB0byBjbGllbnRzXG4gICAgICAgIHRoaXMuc2VydmVyLnNlbmQocHJlcGFyZWRNZXNzYWdlLCAwLCBwcmVwYXJlZE1lc3NhZ2UubGVuZ3RoLCBjb25maWcubXVsdGljYXN0U2VydmVyQ2xpZW50UG9ydCwgdGhpcy5NVUxUSUNBU1RfQUREUikgICAgICAgIC8vYnJvYWRjYXN0IHRvIG90aGVyIHNlcnZlcihjbGllbnRzKSAtIHNlcnZlcnMgYWxzbyB3YW50IHRvIGtub3cgd2hhdCBvdGhlciBzZXJ2ZXJzIGFyZSBpbiB0aGUgbmV0d29ya1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVsdGljYXN0U2VydmVyXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBkZ3JhbSBmcm9tICdkZ3JhbSc7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7ICAvLyBub2RlIG5vdCB2dWUgKHJlbGF0aXZlIHBhdGggbmVlZGVkKVxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cblxuLyoqXG4gKiBTdGFydHMgYSBkZ3JhbSAodWRwKSBzb2NrZXQgdGhhdCBsaXN0ZW5zIGZvciBtdWxpdGNhc3QgbWVzc2FnZXNcbiAqL1xuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSAnMjM5LjI1NS4yNTUuMjUwJ1xuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zSW50ZXJ2YWxsID0gbnVsbFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBieSB0aW1lc3RhbXBcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JylcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmJpbmQodGhpcy5QT1JULCAnMC4wLjAuMCcsICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHsgdGhpcy5jbGllbnQuYWRkTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSKSB9XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm11bHRpY2FzdGNsaWVudCBAIGluaXQ6IE5vIEdhdGV3YXkhIFN0YXJ0aW5nIE11bHRpY2FzdENsaWVudCB3aXRob3V0IGFkZGluZyBncm91cCBtZW1iZXJzaGlwXCIpfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBVRFAgTUMgQ2xpZW50IGxpc3RlbmluZyBvbiBodHRwOi8vJHtjb25maWcuaG9zdGlwfToke3RoaXMuY2xpZW50LmFkZHJlc3MoKS5wb3J0fWApXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe2xvZy5lcnJvcihlcnIpfVxuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlJywgKG1lc3NhZ2UsIHJpbmZvKSA9PiB7IHRoaXMubWVzc2FnZVJlY2VpdmVkKG1lc3NhZ2UsIHJpbmZvKSB9KVxuXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG5cblxuICAgIH1cblxuICAgIGFzeW5jIHN0b3AgKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuZHJvcE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUikgLy8gZW50ZmVybnQgTXVsdGljYXN0LU1pdGdsaWVkc2NoYWZ0XG4gICAgICAgIH0gY2F0Y2goZSl7fVxuICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpIC8vIHNjaGxpZVx1MDBERnQgZGVuIFVEUC1Tb2NrZXRcbiAgICAgICAgaWYgKHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyKSB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdG9wKCkgLy8gc3RvcHB0IGRlbiBTY2hlZHVsZXJcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICBcbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICBtZXNzYWdlUmVjZWl2ZWQgKG1lc3NhZ2UsIHJpbmZvKSB7XG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnRpbWVzdGFtcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICAgLy9yZWNvcmQgdGltZXN0YW1wIG9mIGxhc3QgbWVzc2FnZSBmcm9tIHNlcnZlclxuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMuaXNOZXdFeGFtSW5zdGFuY2Uoc2VydmVySW5mbykpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBtZXNzYWdlUmVjZWl2ZWQ6IEFkZGluZyBuZXcgRXhhbSBJbnN0YW5jZSBcIiR7c2VydmVySW5mby5zZXJ2ZXJuYW1lfVwiIHRvIFNlcnZlcmxpc3RgKVxuICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5wdXNoKHNlcnZlckluZm8pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3MgaWYgdGhlIG1lc3NhZ2UgY2FtZSBmcm9tIGEgbmV3IGV4YW0gaW5zdGFuY2Ugb3IgYW4gb2xkIG9uZSB0aGF0IGlzIGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAqL1xuICAgIGlzTmV3RXhhbUluc3RhbmNlIChvYmopIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtU2VydmVyTGlzdFtpXS5pZCA9PT0gb2JqLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiXG5pbXBvcnQgeyBjcmVhdGVJMThuIH0gZnJvbSAndnVlLWkxOG4nXG4vL2ltcG9ydCB7IGNyZWF0ZUkxOG4gfSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbGVnYWN5OiBmYWxzZSxcbiAgICBtZXNzYWdlczoge1xuICAgICAgZW4sXG4gICAgICBkZVxuICAgICAgfVxuICB9KVxuXG5leHBvcnQgZGVmYXVsdCBpMThuXG5cblxuXG5cbiIsICJ7IFxuICAgIFwiZ2VuZXJhbFwiOiB7XG4gICAgICAgIFwic3RhcnRzZXJ2ZXJcIjpcIlN0YXJ0IEV4YW1cIixcbiAgICAgICAgXCJzbGlzdFwiOiBcIkFrdGl2ZSBFeGFtc1wiLFxuICAgICAgICBcIm9rXCI6IFwiT0tcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCJcbiAgICB9LFxuICAgIFwic2VydmVybGlzdFwiIDoge1xuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJsb2dpblwiOiBcImxvZ2luXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIlBsZWFzZSBwcm92aWRlIGEgcGFzc3dvcmRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJzdGFydHNlcnZlclwiIDoge1xuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcInN0YXJ0XCI6IFwiU3RhcnQgRXhhbVwiLFxuICAgICAgICBcInJlc3VtZVwiOiBcIlJlc3VtZSBFeGFtXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicHdkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJlbXB0eXB3XCI6IFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBwYXNzd29yZFwiLFxuICAgICAgICBcImVtcHR5bmFtZVwiOiBcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgdXNlcm5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIldvcmtkaXJlY3RvcnlcIixcbiAgICAgICAgXCJzZWxlY3RcIjogXCJTZWxlY3QgV29ya2RpcmVjdG9yeVwiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiTm90IGVub3VnaCBmcmVlIGRpc2NzcGFjZVwiLFxuICAgICAgICBcImRpcmVjdG9yeWVycm9yXCI6IFwiRGlyZWN0b3J5IG5vdCB3cml0ZWFibGVcIixcbiAgICAgICAgXCJwcmV2aW91c2V4YW1zXCI6IFwiTG9jYWwgcHJldmlvdXMgRXhhbXNcIixcbiAgICAgICAgXCJmb2xkZXJkZWxldGVcIjogXCJEZWxldGUgbG9jYWwgZXhhbSBmb2xkZXI/XCIsXG4gICAgICAgIFwib25saW5lZXhhbXNcIjogXCJCaVAgRXhhbXNcIixcbiAgICAgICAgXCJiaXBub3Rsb2dnZWRpblwiOiBcIlBsZWFzZSBsb2cgaW4gdG8gQmlQIGJlZm9yZSBzdGFydGluZyB0aGUgZXhhbVwiLFxuICAgICAgICBcIm5vTmV3c1wiOlwiTm8gTmV3cyBhdmFpbGFibGVcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJcIjogXCJCYWNrdXAtRGlyZWN0b3J5XCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyaW5mb1wiOiBcIlBsZWFzZSBwcm92aWRlIGEgcGF0aCBmb3IgdGhlIGJhY2t1cCBkaXJlY3RvcnlcIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXh0ZW5kZWQgU2V0dGluZ3NcIixcbiAgICAgICAgXCJpbmNvbXBhdGlibGVcIjogXCJJbmNvbXBhdGlibGUgd2l0aCBjdXJyZW50IHZlcnNpb25cIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VcIjogXCJTZWxlY3QgTmV0d29yayBJbnRlcmZhY2VcIixcbiAgICAgICAgXCJzZWxlY3RpbnRlcmZhY2VpbmZvXCI6IFwiUGxlYXNlIHNlbGVjdCBhIHByZWZlcnJlZCBuZXR3b3JrIGludGVyZmFjZSFcIlxuICAgIH0sXG4gICAgXCJkYXNoYm9hcmRcIjp7XG4gICAgICAgIFwicmVtb3ZlVVJMXCI6IFwiUmVtb3ZlIFVSTFwiLFxuICAgICAgICBcInJlbW92ZVVSTGNvbmZpcm1cIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcmVtb3ZlIHRoaXMgVVJMP1wiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudFwiOiBcIlJlbW90ZSBBc3Npc3RhbnRcIixcbiAgICAgICAgXCJzZXJ2ZXJcIjogXCJTZXJ2ZXJcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpblwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcInN0b3BzZXJ2ZXJcIjogXCJTdG9wIEV4YW1cIixcbiAgICAgICAgXCJmaWxlc2VuZFwiOiBcIlNlbmQgRmlsZXNcIixcbiAgICAgICAgXCJmaWxlc2VuZHRleHRcIjogXCJQbGVhc2UgY2hvb3NlIG9uZSBvciBzZXZlcmFsIEZpbGVzXCIsXG4gICAgICAgIFwib2ZmaWNlZmlsZXNlbmRcIjogXCJVcGxvYWQgRmlsZVwiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kdGV4dFwiOiBcIlBsZWFzZSBjaG9vc2UgYW4geGxzeCBvciBkb2N4IEZpbGUgZm9yIHRoZSBFeGFtXCIsXG4gICAgICAgIFwiY2FuY2VsXCI6IFwiQ2FuY2VsXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIk5vIEZpbGVzIHNlbGVjdGVkXCIsXG4gICAgICAgIFwidXBsb2FkZmlsZXNcIjogXCJ1cGxvYWRpbmcgZmlsZXNcIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJGaWxlcyBzZW50XCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwiTm8gc3R1ZGVudHMgY29ubmVjdGVkXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJBY3RpdmUgU2hlZXRzXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzaGludFwiOiBcIlBsZWFzZSBzZWxlY3QgYSBQREYgZmlsZSB0aGF0IGNvbnRhaW5zIGludGVyYWN0aXZlIGZvcm0gZmllbGRzLlwiLFxuICAgICAgICBcImFjY2VwdFBkZlwiOiBcIkFjY2VwdCBQREYgRmlsZVwiLFxuICAgICAgICBcInNlbGVjdE90aGVyUGRmXCI6IFwiU2VsZWN0IG90aGVyIFBERiBmaWxlXCIsXG4gICAgICAgIFwibm9wZGZzZWxlY3RlZFwiOiBcIlBsZWFzZSBzZWxlY3QgYSBQREYgZmlsZSFcIixcbiAgICAgICAgXCJpbnZhbGlkcGRmXCI6IFwiSW52YWxpZCBQREYgZmlsZSFcIixcbiAgICAgICAgXCJwZGZwcm9jZXNzaW5nZXJyb3JcIjogXCJFcnJvciBwcm9jZXNzaW5nIFBERiBmaWxlLlwiLFxuICAgICAgICBcImVkdXZpZHVhbFwiOiBcIkVkdXZpZHVhbFwiLFxuICAgICAgICBcIndlYnNpdGVcIjogXCJXZWJzaXRlIFVSTFwiLFxuICAgICAgICBcImF1dG9nZXRcIjogXCJCYWNrdXAgaW50ZXJ2YWxcIixcbiAgICAgICAgXCJzdGFydGV4YW1cIjogXCJTZWN1cmUgZGV2aWNlc1wiLFxuICAgICAgICBcInN0YXJ0ZXhhbXNpbmdsZVwiOiBcIlNlY3VyZSBkZXZpY2VcIixcbiAgICAgICAgXCJzdGFydGV4YW1kZXNjXCI6IFwiVGhpcyBzdGFydHMgdGhlIEV4YW0gTW9kZSBmb3IgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwic2VuZGZpbGVcIjogXCJTZW5kIEZpbGVzIHRvIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcInNlbmRmaWxlU2luZ2xlXCI6IFwiU2VuZCBGaWxlc1wiLFxuICAgICAgICBcImdldGZpbGVcIjogXCJGZXRjaCBXb3JrIG9mIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcImdldGZpbGVTaW5nbGVcIjogXCJGZXRjaCBXb3JrXCIsXG4gICAgICAgIFwiZ2V0ZmlsZXNcIjogXCJGZXRjaCBXb3JrXCIsXG4gICAgICAgIFwic3RvcGV4YW1cIjogXCJSZWxlYXNlIGRldmljZXNcIixcbiAgICAgICAgXCJzdG9wZXhhbXNpbmdsZVwiOiBcIlJlbGVhc2UgZGV2aWNlXCIsXG4gICAgICAgIFwic3VyZVwiOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgXCJleGl0ZXhhbXN1cmVcIjogXCJDbG9zZSBFeGFtIFNlcnZlcj9cIixcbiAgICAgICAgXCJleGl0ZXhhbVwiOiBcIlRoaXMga2lsbHMgdGhlIGNvbm5lY3Rpb24gdG8gYWxsIHN0dWRlbnRzIFxcbkRpZCB5b3UgYmFja3VwIGV2ZXJ5dGhpbmc/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1pbmZvXCI6IFwiYWxsIGFjdGl2ZSBjb25uZWN0aW9ucyB3aWxsIGJlIGNsb3NlZFwiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcImV4aXQgc2FmZSBleGFtIG1vZGUuIHRoaXMgY2xvc2VzIHRoZSBleGFtIHdpbmRvdyBmb3IgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwiZXhpdGtpb3Nrc2hvcnRcIjogXCJFeGl0IEV4YW0gU2VydmVyXCIsXG4gICAgICAgIFwicmVhbGx5a2lja1wiOiBcInJlbW92ZSBzdHVkZW50IGZyb20gc2VydmVyXCIsXG4gICAgICAgIFwia2lja1wiOiBcInJlbW92ZVwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcInNhZmVtb2RlIGxlZnRcIixcbiAgICAgICAgXCJvbmxpbmVcIjpcImRldGFpbHNcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6XCJvZmZsaW5lXCIsXG4gICAgICAgIFwic2VjdXJlXCI6XCJzZWN1cmVkXCIsXG4gICAgICAgIFwic2VjdXJlaW5mb1wiOlwic3R1ZGVudCBpcyBzZWN1cmVkXCIsXG4gICAgICAgIFwicmVzdG9yZVwiOlwicmVzdG9yZVwiLFxuICAgICAgICBcInJlc3VtZWluZm9cIjpcInJlc3VtZSBmb2N1cyBzdGF0ZVwiLFxuICAgICAgICBcImV4YW1tb2RlYWN0aXZlXCI6IFwic3R1ZGVudCBhbHJlYWR5IGluIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiY2xvc2VcIjpcImNsb3NlXCIsXG4gICAgICAgIFwiZGVsXCI6IFwiY2xlYW4gd29ya2ZvbGRlclwiLFxuICAgICAgICBcImRlbHN1cmVcIjogXCJEZWxldGUgYWxsIGNvbnRlbnRzIG9mIHRoZSBzdHVkZW50cyB3b3JrZm9sZGVyc1wiLFxuICAgICAgICBcImRlbHNpbmdsZVwiOiBcImNsZWFuIHJlbW90ZSB3b3JrZm9sZGVyXCIsXG4gICAgICAgIFwiZGVsc2luZ2xlc3VyZVwiOiBcIkRlbGV0ZSBjb250ZW50cyBvZiB0aGUgc3R1ZGVudHMgd29ya2ZvbGRlclwiLFxuICAgICAgICBcImF0dGVudGlvblwiOiBcIkF0dGVudGlvbiFcIixcbiAgICAgICAgXCJiYWNrdXByZXF1ZXN0XCI6IFwiUmVxdWVzdGluZyBmaWxlcyBmcm9tIGFsbCBzdHVkZW50c1wiLFxuICAgICAgICBcInNob3d3b3JrZm9sZGVyXCI6IFwiU2hvdyBXb3JrZm9sZGVyXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIlNob3cgV29ya2ZvbGRlclwiLFxuICAgICAgICBcInNob3duZXdlc3Rmb2xkZXJcIjogXCJTaG93IG5ld2VzdCBXb3JrZm9sZGVyXCIsXG4gICAgICAgIFwiZmlsZXNmb2xkZXJcIjogXCJXb3JrZm9sZGVyIGZpbGVzXCIsXG4gICAgICAgIFwiY2hvb3Nlc3R1ZGVudFwiOiBcIlNlbGVjdCBTdHVkZW50XCIsXG4gICAgICAgIFwiY2hvb3NlcmVxdWlyZVwiOiBcIllvdSBuZWVkIHRvIGNob29zZSBhIHN0dWRlbnQhXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJTdHVkZW50cyB3b3JrIG5vdCBmb3VuZFwiLFxuICAgICAgICBcInN1bW1hcml6ZXBkZlwiOiBcIkRvd25sb2FkIG5ld2VzdCB2ZXJzaW9ucyBcXG5hcyBzaW5nbGUgcGRmXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmc2hvcnRcIjogXCJBbGwgRXhhbXMgYXMgUERGXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0XCI6IFwicHJpbnRyZXF1ZXN0IHJlY2VpdmVkXCIsXG4gICAgICAgIFwicHJpbnRyZXF1ZXN0c2hvd1wiOiBcIkRvIHlvdSB3YW50IHRvIG9wZW4gdGhlIGRvY3VtZW50IGFuZCBwcmludCBpdD9cIixcbiAgICAgICAgXCJkb3dubG9hZFwiOiBcImRvd25sb2FkXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInByZXZpZXdcIjogXCJwcmV2aWV3XCIsXG4gICAgICAgIFwic2VuZFwiOiBcInNlbmRcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOlwiYWN0aXZhdGVcIixcbiAgICAgICAgXCJBY3RpdmF0ZVwiOlwiQWN0aXZhdGVcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcInZpcnR1YWwgZW52aXJvbm1lbnQgZGV0ZWN0ZWRcIixcbiAgICAgICAgXCJkZWxldGVcIjogXCJkZWxldGVcIixcbiAgICAgICAgXCJmaWxlZGVsZXRlXCI6IFwiRG8geW91IHJlYWxseSB3YW50IHRvIGRlbGV0ZSB0aGlzIGZpbGUvZm9sZGVyP1wiLFxuICAgICAgICBcImNhbm5vdERlbGV0ZUFjdGl2ZVNoZWV0XCI6IFwiQWN0aXZlIFNoZWV0IGNhbm5vdCBiZSBkZWxldGVkIGR1cmluZyBleGFtXCIsXG4gICAgICAgIFwiZXhpdGRlbGV0ZVwiOiBcIkRlbGV0ZSBhbGwgZXhhbS1yZWxhdGVkIGZpbGVzIG9uIHN0dWRlbnRzIGRldmljZXNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiU3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2thY3RpdmF0ZVwiOiBcImFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcImN1c3RvbWhvc3RcIjogXCJDdXN0b20gTFQgSG9zdFwiLFxuICAgICAgICBcImxhbmd1YWdldG9vbGhvc3RcIjogXCJMYW5ndWFnZVRvb2wgSG9zdFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwiY21hcmdpblwiOiBcIkNvcnJlY3Rpb24gTWFyZ2luIFBvc2l0aW9uXCIsXG4gICAgICAgIFwiY21hcmdpbi1sZWZ0XCI6IFwibGVmdFwiLFxuICAgICAgICBcImNtYXJnaW4tcmlnaHRcIjogXCJyaWdodFwiLFxuICAgICAgICBcImNtYXJnaW4tdmFsdWVcIjogXCJDb3JyZWN0aW9uIE1hcmdpbiBzaXplIChjbSlcIixcbiAgICAgICAgXCJ0ZXh0ZWRpdG9yXCI6IFwiVGV4dGVkaXRvciBTZXR0aW5nc1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJiYWNrdXBhdXRvXCI6XCJBdXRvbWF0aWMgUmV0cmVpdmFsXCIsXG4gICAgICAgIFwiYmFja3VwYXV0b3F1ZXN0aW9uXCI6XCJQbGVhc2Ugc2V0IHRoZSBpbnRlcnZhbCBmb3IgYXV0b21hdGljIHJldHJlaXZhbD9cIixcbiAgICAgICAgXCJiYWNrdXBhdXRvaGludFwiOlwiKFRpbWVmcmFtZSBpbiBtaW51dGVzKVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkXCI6IFwiRWR1dmlkdWFsIC8gTW9vZGxlXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRoaW50XCI6IFwiUGxlYXNlIGVudGVyIGEgdmFsaWQgdGVzdCBVUkwhXCIsXG4gICAgICAgIFwiZ2Zvcm1zaGludFwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIEdvb2dsZSBGb3JtcyBJRCFcIixcbiAgICAgICAgXCJlZHV2aWR1YWxkb21haW5cIjogXCJQbGVhc2UgcHJvdmlkZSB5b3VyIG1vb2RsZSBkb21haW4gaWYgaXQncyBub3QgZWR1dmlkdWFsLmF0XCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZERvbWFpblwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIE1vb2RsZSBkb21haW4hXCIsXG4gICAgICAgIFwiaW52YWxpZERvbWFpblwiOiBcIlBsZWFzZSBlbnRlciBhIHZhbGlkIGRvbWFpbiFcIixcbiAgICAgICAgXCJtb29kbGVJbnZhbGlkSWRcIjogXCJQbGVhc2UgZW50ZXIgYSB2YWxpZCB0ZXN0IElEIVwiLFxuICAgICAgICBcImxvY2tcIjpcImxvY2sgZGlzcGxheXNcIixcbiAgICAgICAgXCJ1bmxvY2tcIjpcInVubG9jayBkaXNwbGF5c1wiLFxuICAgICAgICBcImZyZWVzcGFjZXdhcm5pbmdcIiA6IFwiUnVubmluZyBvdXQgb2YgZnJlZSBkaXNjc3BhY2UhIVwiLFxuICAgICAgICBcImludmFsaWRfZmlsZVwiIDogXCJXcm9uZyBGaWxldHlwZVwiLFxuICAgICAgICBcImludmFsaWRfZmlsZV90ZXh0XCI6IFwiT25seSBGaWxlcyB3aXRoIHRoZSAueGxzeCBvciAuZG9jeCBleHRlbnNpb24gYXJlIGFsbG93ZWRcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlIGV4aXN0aW5nIEZpbGVzIG9uIE9uZURyaXZlP1wiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6XCJFeGFtIHJlcXVlc3RlZFwiLFxuICAgICAgICBcInNjcmVlbnNob3RcIjpcIlNjcmVlbnNob3R1cGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90dGl0bGVcIjpcIlNjcmVlbnNob3QgVXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHF1ZXN0aW9uXCI6XCJTZXQgdGhlIGludGVydmFsIHRvIHVwZGF0ZSBTY3JlZW5zaG90c1wiLFxuICAgICAgICBcInNjcmVlbnNob3RoaW50XCI6XCIoVGltZSBpbiBzZWNvbmRzLiAwID09IGRlYWt0aXZhdGVkKVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdcIjpcIlNvbWUgb2YgdGhlIGZpbGVzIGFyZSBvbGRlciB0aGFuIDUgbWludXRlcyFcIixcbiAgICAgICAgXCJvbGRwZGZ3YXJuaW5nc2luZ2xlXCI6XCJUaGUgbG9jYWwgdmVyc2lvbiBvZiB0aGUgZmlsZSBtYXkgYmUgb3V0ZGF0ZWQhXCIsXG4gICAgICAgIFwiZ2Zvcm1zXCI6IFwiR29vZ2xlIEZvcm1zXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkXCI6XCJBY2Nlc3MgRGVuaWVkIVwiLFxuICAgICAgICBcImFjY2Vzc0RlbmllZHRleHRcIjpcIkNvbnRhY3QgeW91ciBvcmdhbml6YXRpb25zIEFkbWluaXN0cmF0b3IgdG8gZ3JhbnQgQWNjZXNzIHRvIE5leHQtRXhhbVwiLFxuICAgICAgICBcIm1zb1dhcm5cIjogXCJZb3UgbmVlZCB0byByZWNvbm5lY3QgYW5kIHNlbGVjdCBhbiBNU09GaWxlIGJlZm9yZSByZWNvbm5lY3RpbmcgYWxsIHN0dWRlbnRzXCIsXG4gICAgICAgIFwiYWxsb3dzcGVsbGNoZWNrXCI6XCJBY3RpdmF0ZSBzcGVsbGNoZWNrIGZvciBzcGVjaWZpYyBzdHVkZW50XCIsXG4gICAgICAgIFwibGluZXNwYWNpbmdcIjogXCJMaW5lc3BhY2luZ1wiLFxuICAgICAgICBcImZvbnRmYW1pbHlcIjogXCJGb250ZmFtaWx5XCIsXG4gICAgICAgIFwiZGVmYXVsdHByaW50ZXJcIjogXCJTZWxlY3QgZGVmYXVsdCBwcmludGVyXCIsXG4gICAgICAgIFwiYWxsb3dkaXJlY3RwcmludFwiOiBcIkFsbG93IGRpcmVjdCBwcmludCBmb3Igc3R1ZGVudHNcIixcbiAgICAgICAgXCJub3ByaW50ZXJcIjogXCJObyBwcmludGVyIGZvdW5kXCIsXG4gICAgICAgIFwiZGlyZWN0cHJpbnRcIjogXCJEaXJlY3QgcHJpbnRcIixcbiAgICAgICAgXCJvcGVuXCI6IFwiT3BlbiBmaWxlIGluIGV4dGVybmFsIHZpZXdlclwiLFxuICAgICAgICBcIm9jclwiOiBcIkFjdGl2YXRlIE9DUiBzYWZ0ZXkgZmVhdHVyZVwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0dGl0bGVcIjogXCJBdWRpbyByZXN0cmljdGlvbnNcIixcbiAgICAgICAgXCJhdWRpb2FsbG93XCI6IFwibm8gcmVzdHJpY3Rpb25zXCIsXG4gICAgICAgIFwiYXVkaW9yZXBlYXQxXCI6IFwicmVwZXRpdGlvblwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MlwiOiBcInJlcGV0aXRpb25zXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjogXCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsYWN0aXZhdGVcIjogXCJBY3RpdmF0ZSBCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsc2V0dGluZ3NcIjogXCJFeHRlbmRlZCBTZXR0aW5ncyBmb3IgQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJncm91cHNcIjpcIkFjdGl2YXRlIGdyb3Vwc1wiLFxuICAgICAgICBcImdyb3VwaW5mb1wiOiBcIkRpdmlkZSBzdHVkZW50cyBpbiB0d28gZ3JvdXBzXCIsXG4gICAgICAgIFwiZXh0ZW5kZWRzZXR0aW5nc1wiOiBcIkV4dGVuZGVkIFNldHRpbmdzXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcInNhdmVcIixcbiAgICAgICAgXCJkaXNhYmxlZFwiOiBcImRpc2FibGVkXCIsXG4gICAgICAgIFwib2NyaW5mb1wiOlwiU2VhcmNoIGZvciBjdXJyZW50IGV4YW0gcGluIGluIHNjcmVlbnNob3RzXCIsXG4gICAgICAgIFwiYmlwaW5mb1wiOiBcIkJpUC1TdGF0dXMgZGVmaW5lcyBpZiBhdXRoZW50aWNhdGVkIGNsaWVudHMgY2FuIGNvbm5lY3RcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nIG91dD9cIixcbiAgICAgICAgXCJhY3RpdmF0ZXNlY3Rpb25zXCI6IFwiQWN0aXZhdGUgZXhhbSBzZWN0aW9uc1wiLFxuICAgICAgICBcImV4YW1zZWN0aW9uc1wiOiBcImV4YW0gc2VjdGlvbnNcIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNpbmZvXCI6IFwiWW91IGFyZSBpbiBzZWN1cmVkIG1vZGUuIERvIHlvdSB3YW50IHRvIGFjdGl2YXRlIHRoaXMgZXhhbSBzZWN0aW9uIGZvciBhbGwgY29ubmVjdGVkIGNsaWVudHM/XCIsXG4gICAgICAgIFwibm9cIjpcIk5vXCIsXG4gICAgICAgIFwieWVzXCI6XCJZZXNcIixcbiAgICAgICAgXCJleGFtbW9kZVwiOlwiRXhhbS1Nb2RlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6XCJNYXRlcmlhbHNcIixcbiAgICAgICAgXCJkZWZpbmVtYXRlcmlhbHNcIjpcIkRlZmluZSBNYXRlcmlhbHNcIixcbiAgICAgICAgXCJwcm9jZXNzaW5nZmlsZXNcIjpcIlByb2Nlc3NpbmcgRmlsZXNcIixcbiAgICAgICAgXCJmb250c2l6ZXRpdGxlXCI6IFwiRm9udHNpemVcIixcbiAgICAgICAgXCJmb250c2l6ZVwiOiBcIkZvbnRzaXplXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZVwiOiBcIkRlbGV0ZSBGaWxlXCIsXG4gICAgICAgIFwicmVtb3ZlZmlsZWNvbmZpcm1cIjogXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoaXMgZmlsZT9cIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZVwiOiBcIlNlY3Rpb24gTmFtZVwiLFxuICAgICAgICBcInNlY3Rpb25uYW1laW5mb1wiOiBcIlBsZWFzZSBlbnRlciBhIG5hbWUgZm9yIHRoaXMgc2VjdGlvblwiLFxuICAgICAgICBcImdyb3VwQVwiOiBcIkdyb3VwIEFcIixcbiAgICAgICAgXCJncm91cEJcIjogXCJHcm91cCBCXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTFwiOiBcIkFsbG93ZWQgVVJMXCIsXG4gICAgICAgIFwiYWxsb3dlZFVSTGluZm9cIjogXCJQbGVhc2UgZW50ZXIgYSBVUkwgdGhhdCBpcyBhbGxvd2VkIGR1cmluZyB0aGUgZXhhbVwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NfbW9kZVwiOiBcIkV4dGVuZGVkIFNldHRpbmdzIGZvciBFeGFtLU1vZGVcIixcbiAgICAgICAgXCJyZHBcIjogXCJXZWIgUkRQXCIsXG4gICAgICAgIFwicmRwY29uZmlnXCI6IFwiUkRQIENvbmZpZ3VyYXRpb25cIixcbiAgICAgICAgXCJyZHBjb25maWdpbmZvXCI6IFwiUGxlYXNlIGVudGVyIHRoZSBkb21haW4gKFVSTCkgb2YgdGhlIFJEUC1TZXJ2ZXJcIixcbiAgICAgICAgXCJtdXRlYXVkaW9cIjogXCJNdXRlIGF1ZGlvXCIsXG4gICAgICAgIFwibXV0ZWF1ZGlvaW50cm9cIjogXCJJZiB0aGlzIG9wdGlvbiBpcyBhY3RpdmF0ZWQsIGF1ZGlvIHNpZ25hbHMgZHVyaW5nIHRoZSBleGFtIHdpbGwgbm90IGJlIHBsYXllZFwiLFxuICAgICAgICBcInNob3dzdWJtaXNzaW9uXCI6IFwiU2hvdyBzdWJtaXNzaW9uXCIsXG4gICAgICAgIFwic3R1ZGVudGluZm9cIjogXCJTaG93IHN0dWRlbnQgZGV0YWlsc1wiLFxuICAgICAgICBcInZpcnR1YWxpemVkaW5mb1wiOiBcIlRoZSBleGFtIGVudmlyb25tZW50IGlzIHBvc3NpYmx5IHJ1bm5pbmcgaW4gYSB2aXJ0dWFsIG1hY2hpbmVcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tpbmZvXCI6IFwiVGhlIHNlY3VyZSBtb2RlIHdhcyBsZWZ0IGF0dGVtcHQhXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RpbmZvXCI6IFwiQmFja3VwIHJlcXVlc3RzIHdlcmUgbWFkZVwiLFxuICAgICAgICBcInJlbW90ZWFzc2lzdGFudGluZm9cIjogXCJSZW1vdGUgQXNzaXN0YW50IFNvZnR3YXJlIGlzIHBvc3NpYmx5IHJ1bm5pbmcgb24gdGhlIGNsaWVudCBkZXZpY2VcIixcbiAgICAgICAgXCJkb2N1bWVudHNpbmZvXCI6IFwiRG9jdW1lbnRzIG9uIHRoZSBjbGllbnQgZGV2aWNlOiBcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmdcIjogXCJGaWxlIFNpemVcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmd0ZXh0XCI6IFwie2ZpbGVuYW1lfSBpcyBsYXJnZXIgdGhhbiA4IE1CICh7c2l6ZX0gTUIpLiBMYXJnZSBmaWxlcyBtYXkgc2xvdyBkb3duIHRoZSB0cmFuc2Zlci5cIixcbiAgICAgICAgXCJub3ByaW50ZXJDaG9zZW5cIjogXCJwbGVhc2Ugc2VsZWN0IGEgcHJpbnRlclwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJpbnZhbGlkcmVnaXN0cmF0aW9uXCI6IFwibm8gc2VydmVyc2lkZSByZWdpc3RyYXRpb25cIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInN0YXRlY2hhbmdlXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNcIjogXCJFeGFtIFNlcnZlciBhbHJlYWR5IGV4aXN0c1wiLFxuICAgICAgICBcInNlcnZlcmV4aXN0c0xBTlwiOiBcIkV4YW0gU2VydmVyIGFscmVhZHkgYWN0aXZlIGluIGxvY2FsIGFyZWEgbmV0d29ya1wiLFxuICAgICAgICBcInNlcnZlcnN0YXJ0ZWRcIjogXCJFeGFtIFNlcnZlciBzdGFydGVkXCIsXG4gICAgICAgIFwic2VydmVyc3RvcHBlZFwiOiBcIkV4YW0gU2VydmVyIHN0b3BwZWRcIixcbiAgICAgICAgXCJub3Rmb3VuZFwiOiBcIkV4YW0gZG9lc24ndCBleGlzdFwiLFxuICAgICAgICBcIndyb25ncHdcIjogXCJXcm9uZyBQYXNzd29yZFwiLFxuICAgICAgICBcIndyb25ncGluXCI6IFwiV3JvbmcgUElOXCIsXG4gICAgICAgIFwiY29ycmVjdHB3XCI6IFwiUGFzc3dvcmQgT0tcIixcbiAgICAgICAgXCJzdHVkZW50cmVtb3ZlXCI6IFwiUmVtb3ZlZCBzdHVkZW50IGZyb20gRXhhbSBTZXJ2ZXJcIixcbiAgICAgICAgXCJhY3Rpb25kZW5pZWRcIjogXCJhY3Rpb24gZGVuaWVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJzdHVkZW50dXBkYXRlXCI6IFwic3R1ZGVudCB1cGRhdGVkXCIsXG4gICAgICAgIFwic3R1ZGVudGxlZnRcIjogXCJzdHVkZW50IGxlZnQgdGhlIGV4YW1cIixcbiAgICAgICAgXCJzdGF0ZXJlc3RvcmVcIjogXCJzYWZlIGV4YW0gc3RhdGUgcmVzdG9yZWRcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcIm5leHQtZXhhbSBpcyBydW4gaW4gYSB2aXJ0dWFsIG1hY2hpbmVcIixcbiAgICAgICAgXCJ2ZXJzaW9ubWlzbWF0Y2hcIjogXCJBcHBsaWNhdGlvbiB2ZXJzaW9ucyBtaXNtYXRjaFwiLFxuICAgICAgICBcImV4YW1yZXF1ZXN0XCI6IFwiRXhhbXMgcmVxdWVzdGVkXCIsXG4gICAgICAgIFwiYmlwcmVxdWlyZWRcIjogXCJCaWxkdW5nc3BvcnRhbCBhdXRoZW50aWZpY2F0aW9uIG1hbmRhdG9yeSFcIixcbiAgICAgICAgXCJzdWJtaXNzaW9uZmFpbGVkXCI6IFwiU3VibWlzc2lvbiBmYWlsZWQhXCIsXG4gICAgICAgIFwic3VibWlzc2lvbnNcIjogXCJTdWJtaXNzaW9uc1wiXG4gICAgfSwgIFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRoZSB0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJkZW5pZWRcIjogXCJwZXJtaXNzaW9uIGRlbmllZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwibm9jbGllbnRzXCI6IFwibm8gc3R1ZGVudHMgY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiZmlsZXMgc2VudFwiLFxuICAgICAgICBcImNvdWxkbm90c3RvcmVcIjogXCJzdHVkZW50IGNvdWxkIG5vdCBzdG9yZSBmaWxlXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJub2ZpbGVyZWNlaXZlZFwiOiBcIm5vIGZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmRlbGV0ZWRcIjogXCJkZWxldGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwicmVhZGluZyBmaWxlIGZhaWxlZFwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNcIjogXCJQbGVhc2UgZG91YmxlIGNoZWNrIHRoZSByZW5kZXJpbmcgb2YgdGhlIGFjdGl2ZSBzaGVldHMgZm9ybSBmaWVsZHMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBleGFtIVwiLFxuICAgICAgICBcImVkaXRcIjogXCJFZGl0XCIsXG4gICAgICAgIFwic2F2ZVwiOiBcIlNhdmVcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwiZ2VuZXJhbFwiOiB7XG4gICAgICAgIFwic3RhcnRzZXJ2ZXJcIjpcIlByXHUwMEZDZnVuZyBhbmxlZ2VuXCIsXG4gICAgICAgIFwic2xpc3RcIjogXCJBa3RpdmUgUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJva1wiOiBcIk9LXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiXG4gICAgfSxcbiAgICBcInNlcnZlcmxpc3RcIiA6IHtcbiAgICAgICAgXCJwd2RcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwibG9naW5cIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcIm5vcHdcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluIFBhc3N3b3J0IGVpblwiXG4gICAgfSxcbiAgICBcInN0YXJ0c2VydmVyXCIgOiB7XG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwic3RhcnRcIjogXCJQclx1MDBGQ2Z1bmcgc3RhcnRlblwiLFxuICAgICAgICBcInJlc3VtZVwiOiBcIlByXHUwMEZDZnVuZyBmb3J0c2V0emVuXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjogXCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcInB3ZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZW1wdHlwd1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW4gUGFzc3dvcnQgYW5cIixcbiAgICAgICAgXCJlbXB0eW5hbWVcIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZW4gTmFtZW4gYW5cIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJ3b3JrZm9sZGVyXCI6IFwiQXJiZWl0c3ZlcnplaWNobmlzXCIsXG4gICAgICAgIFwic2VsZWN0XCI6IFwiQXJiZWl0c3ZlcnplaWNobmlzIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJadSB3ZW5pZyBmcmVpZXIgU3BlaWNoZXJwbGF0elwiLFxuICAgICAgICBcImRpcmVjdG9yeWVycm9yXCI6IFwiRmVobGVuZGUgU2NocmVpYnJlY2h0ZSBpbSBnZXdcdTAwRTRobHRlbiBWZXJ6ZWljaG5pc1wiLFxuICAgICAgICBcInByZXZpb3VzZXhhbXNcIjogXCJMb2thbCBnZXNpY2hlcnRlIFByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwiZm9sZGVyZGVsZXRlXCI6IFwiV29sbGVuIFNpZSBkaWUgZGVuIGxva2FsZW4gUHJcdTAwRkNmdW5nc29yZG5lciBsXHUwMEY2c2NoZW4/XCIsXG4gICAgICAgIFwib25saW5lZXhhbXNcIjogXCJCaVAgUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJiaXBub3Rsb2dnZWRpblwiOiBcIkJpdHRlIG1lbGRlbiBTaWUgc2ljaCBhbSBCaVAgYW4sIGJldm9yIFNpZSBkaWUgUHJcdTAwRkNmdW5nIHN0YXJ0ZW5cIixcbiAgICAgICAgXCJub05ld3NcIjpcIktlaW5lIE5ldWlna2VpdGVuIHZlcmZcdTAwRkNnYmFyXCIsXG4gICAgICAgIFwiYmFja3VwZm9sZGVyXCI6IFwiQmFja3VwdmVyemVpY2huaXNcIixcbiAgICAgICAgXCJiYWNrdXBmb2xkZXJpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmVuIFBmYWQgZlx1MDBGQ3IgZGFzIEJhY2t1cC1WZXJ6ZWljaG5pcyBlaW5cIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXJ3ZWl0ZXJ0XCIsXG4gICAgICAgIFwiaW5jb21wYXRpYmxlXCI6IFwiTmljaHQga29tcGF0aWJlbCBtaXQgZGVyIGFrdHVlbGxlbiBWZXJzaW9uXCIsXG4gICAgICAgIFwic2VsZWN0aW50ZXJmYWNlXCI6IFwiTmV0endlcmstU2Nobml0dHN0ZWxsZSB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcInNlbGVjdGludGVyZmFjZWluZm9cIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBiZXZvcnp1Z3RlIE5ldHp3ZXJrc2Nobml0dHN0ZWxsZSBhdXMhXCJcbiAgICB9LFxuICAgIFwiZGFzaGJvYXJkXCI6e1xuICAgICAgICBcInJlbW92ZVVSTFwiOiBcIlVSTCBlbnRmZXJuZW5cIixcbiAgICAgICAgXCJyZW1vdmVVUkxjb25maXJtXCI6IFwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBkaWVzZSBVUkwgZW50ZmVybmVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJyZW1vdGVhc3Npc3RhbnRcIjogXCJSZW1vdGUgQXNzaXN0YW50XCIsXG4gICAgICAgIFwic2VydmVyXCI6IFwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwic3RvcHNlcnZlclwiOiBcIlByXHUwMEZDZnVuZyB2ZXJsYXNzZW5cIixcbiAgICAgICAgXCJmaWxlc2VuZFwiOiBcIkRhdGVpZW4gc2VuZGVuXCIsXG4gICAgICAgIFwiZmlsZXNlbmR0ZXh0XCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgb2RlciBtZWhyZXJlIERhdGVpZW5cIixcbiAgICAgICAgXCJvZmZpY2VmaWxlc2VuZFwiOiBcIkRhdGVpIGhvY2hsYWRlblwiLFxuICAgICAgICBcIm9mZmljZWZpbGVzZW5kdGV4dFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIC54bHN4IGJ6dy4gLmRvY3ggRGF0ZWkgYWxzIFRlbXBsYXRlIGZcdTAwRkNyIGRpZSBTY2hcdTAwRkNsZXI6aW5uZW5cIixcbiAgICAgICAgXCJjYW5jZWxcIjogXCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiS2VpbmUgRGF0ZWllbiBhdXNnZXdcdTAwRTRobHRcIixcbiAgICAgICAgXCJ1cGxvYWRmaWxlc1wiOiBcIkRhdGVpZW4gd2VyZGVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZXNzZW50XCI6IFwiRGF0ZWllbiBnZXNlbmRldFwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIktlaW5lIFNjaFx1MDBGQ2xlcjppbm5lbiB2ZXJidW5kZW5cIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcImFjdGl2ZXNoZWV0c1wiOiBcIkFjdGl2ZSBTaGVldHNcIixcbiAgICAgICAgXCJhY3RpdmVzaGVldHNoaW50XCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgUERGLURhdGVpIGF1cywgZGllIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJhY2NlcHRQZGZcIjogXCJQREYgRGF0ZWkgXHUwMEZDYmVybmVobWVuXCIsXG4gICAgICAgIFwic2VsZWN0T3RoZXJQZGZcIjogXCJhbmRlcmUgUERGIERhdGVpIHdcdTAwRTRobGVuXCIsXG4gICAgICAgIFwibm9wZGZzZWxlY3RlZFwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFBERi1EYXRlaSBhdXMhXCIsXG4gICAgICAgIFwiaW52YWxpZHBkZlwiOiBcIlVuZ1x1MDBGQ2x0aWdlIFBERi1EYXRlaSFcIixcbiAgICAgICAgXCJwZGZwcm9jZXNzaW5nZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBWZXJhcmJlaXRlbiBkZXIgUERGLURhdGVpLlwiLFxuICAgICAgICBcImVkdXZpZHVhbFwiOiBcIkVkdXZpZHVhbCAvIE1vb2RsZVwiLFxuICAgICAgICBcIndlYnNpdGVcIjogXCJXZWJzaXRlLVVSTFwiLFxuICAgICAgICBcImF1dG9nZXRcIjogXCJCYWNrdXAtSW50ZXJ2YWxsXCIsXG4gICAgICAgIFwic3RhcnRleGFtXCI6IFwiR2VyXHUwMEU0dGUgYWJzaWNoZXJuXCIsXG4gICAgICAgIFwic3RhcnRleGFtc2luZ2xlXCI6IFwiR2VyXHUwMEU0dCBhYnNpY2hlcm5cIixcbiAgICAgICAgXCJzdGFydGV4YW1kZXNjXCI6IFwiU3RhcnRldCBkZW4gYWJnZXNpY2hlcnRlbiBQclx1MDBGQ2Z1bmdzbW9kdXMgYXVmIGRlbiBHZXJcdTAwRTR0ZW4gZGVyIFNjaFx1MDBGQ2xlcjppbm5lblwiLFxuICAgICAgICBcInNlbmRmaWxlXCI6IFwiRGF0ZWllbiBhbiBhbGxlIFNjaFx1MDBGQ2xlcjppbm5lbiBzZW5kZW4gKHBkZiwganBnLCBtcDMsIGJhaywgZ2diLCBwbmcsIGdpZiwgd2F2LCBvZ2cpXCIsXG4gICAgICAgIFwic2VuZGZpbGVTaW5nbGVcIjogXCJEYXRlaSBzZW5kZW5cIixcbiAgICAgICAgXCJnZXRmaWxlXCI6IFwiU2ljaGVydW5nZW4gdm9uIGFsbGVuIFNjaFx1MDBGQ2xlcjppbm5lbiBob2xlblwiLFxuICAgICAgICBcImdldGZpbGVTaW5nbGVcIjogXCJTaWNoZXJ1bmcgaG9sZW5cIixcbiAgICAgICAgXCJnZXRmaWxlc1wiOiBcIlNpY2hlcnVuZyBob2xlblwiLFxuICAgICAgICBcInN0b3BleGFtXCI6IFwiR2VyXHUwMEU0dGUgZnJlaWdlYmVuXCIsXG4gICAgICAgIFwic3RvcGV4YW1zaW5nbGVcIjogXCJHZXJcdTAwRTR0IGZyZWlnZWJlblwiLFxuICAgICAgICBcInN1cmVcIjogXCJTaW5kIFNpZSBzaWNoZXI/XCIsXG4gICAgICAgIFwiZXhpdGV4YW1zdXJlXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBzY2hsaWVcdTAwREZlbj9cIixcbiAgICAgICAgXCJleGl0ZXhhbVwiOiBcIkRpZXMgYmVlbmRldCBkZW4gUHJcdTAwRkNmdW5nc3NlcnZlci5cXG5EaWUgU2NoXHUwMEZDbGVyOmlubmVuIGtcdTAwRjZubmVuIGltIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYXVjaCBvaG5lIFZlcmJpbmR1bmcgd2VpdGVyYXJiZWl0ZW4uXCIsXG4gICAgICAgIFwiZXhpdGV4YW1pbmZvXCI6IFwiQWxsZSBiZXN0ZWhlbmRlbiBWZXJiaW5kdW5nZW4gd2VyZGVuIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbi4gRGllcyBzY2hsaWVcdTAwREZ0IGRhcyBQclx1MDBGQ2Z1bmdzZmVuc3RlciBmXHUwMEZDciBhbGxlIFNjaFx1MDBGQ2xlcjppbm5lbiFcIixcbiAgICAgICAgXCJleGl0a2lvc2tzaG9ydFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbi5cIixcbiAgICAgICAgXCJyZWFsbHlraWNrXCI6IFwidm9tIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgZW50ZmVybmVuXCIsXG4gICAgICAgIFwia2lja1wiOiBcIlZlcmJpbmR1bmcgdHJlbm5lblwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIkFic2ljaGVydW5nIHZlcmxhc3NlblwiLFxuICAgICAgICBcIm9ubGluZVwiOlwiSW5mb1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJvZmZsaW5lXCIsXG4gICAgICAgIFwic2VjdXJlXCI6XCJFeGFtXCIsXG4gICAgICAgIFwic2VjdXJlaW5mb1wiOlwiU2NoXHUwMEZDbGVyOmluIGlzdCBhYmdlc2ljaGVydFwiLFxuICAgICAgICBcInJlc3RvcmVcIjpcImZvcnRzZXR6ZW5cIixcbiAgICAgICAgXCJyZXN1bWVpbmZvXCI6XCJUZW1wb3JcdTAwRTRyZSBCbG9ja2FkZSBhdWZoZWJlblwiLFxuICAgICAgICBcImV4YW1tb2RlYWN0aXZlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGJlcmVpdHMgaW0gYWJnZXNpY2hlcnRlbiBNb2R1c1wiLFxuICAgICAgICBcImNsb3NlXCI6XCJzY2hsaWVcdTAwREZlblwiLFxuICAgICAgICBcImRlbFwiOiBcIkFyYmVpdHNvcmRuZXIgYXVmIEdlclx1MDBFNHRlbiBkZXIgU2NoXHUwMEZDbGVyOmlubmVuIGJlcmVpbmlnZW5cIixcbiAgICAgICAgXCJkZWxzdXJlXCI6IFwiRGllIEFyYmVpdHNvcmRuZXIgYXVmIGRlbiBHZXJcdTAwRTR0ZW4gZGVyIFNjaFx1MDBGQ2xlcjppbm5lbiB3ZXJkZW4gZ2VsZWVydFwiLFxuICAgICAgICBcImRlbHNpbmdsZVwiOiBcIkFyYmVpdHNvcmRuZXIgYXVmIFNjaFx1MDBGQ2xlcjppbm5lbi1TZWl0ZSBiZXJlaW5pZ2VuXCIsXG4gICAgICAgIFwiZGVsc2luZ2xlc3VyZVwiOiBcIkRlciBBcmJlaXRzb3JkbmVyIGF1ZiBkZW0gU2NoXHUwMEZDbGVyOmlubmVuLUdlclx1MDBFNHQgd2lyZCBnZWxlZXJ0XCIsXG4gICAgICAgIFwiYXR0ZW50aW9uXCI6IFwiQWNodHVuZyFcIixcbiAgICAgICAgXCJiYWNrdXByZXF1ZXN0XCI6IFwiQXJiZWl0ZW4gd2VyZGVuIGdlaG9sdFwiLFxuICAgICAgICBcInNob3d3b3JrZm9sZGVyXCI6IFwiTG9rYWxlbiBBcmJlaXRzb3JkbmVyIGFuemVpZ2VuXCIsXG4gICAgICAgIFwid29ya2ZvbGRlclwiOiBcIk9yZG5lciBcdTAwRjZmZm5lblwiLFxuICAgICAgICBcInNob3duZXdlc3Rmb2xkZXJcIjogXCJOZXVlc3RlbiBPcmRuZXIgYW56ZWlnZW5cIixcbiAgICAgICAgXCJmaWxlc2ZvbGRlclwiOiBcIkRhdGVpZW4gaW0gQXJiZWl0c29yZG5lclwiLFxuICAgICAgICBcImNob29zZXN0dWRlbnRcIjogXCJXXHUwMEU0aGxlbiBTaWUgZWluZSBQZXJzb25cIixcbiAgICAgICAgXCJjaG9vc2VyZXF1aXJlXCI6IFwiU2llIG1cdTAwRkNzc2VuIGVpbmUgT3B0aW9uIHdcdTAwRTRobGVuIVwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgU2NoXHUwMEZDbGVyYXJiZWl0ZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJzdW1tYXJpemVwZGZcIjogXCJMZXR6dGUgQWJnYWJlbiBpblxcbmVpbmVyIFBERi1EYXRlaVxcbnp1c2FtbWVuZmFzc2VuXCIsXG4gICAgICAgIFwic3VtbWFyaXplcGRmc2hvcnRcIjogXCJMZXR6dGUgQWJnYWJlbiB6dXNhbW1lbmZhc3NlblwiLFxuICAgICAgICBcInByaW50cmVxdWVzdFwiOiBcIkRydWNrYW5mcmFnZSBlcmhhbHRlblwiLFxuICAgICAgICBcInByaW50cmVxdWVzdHNob3dcIjogXCJXb2xsZW4gU2llIGRhcyBEb2t1bWVudCBhbnNlaGVuIHVuZCBkcnVja2VuP1wiLFxuICAgICAgICBcImRvd25sb2FkXCI6IFwiaGVydW50ZXJsYWRlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInByZXZpZXdcIjogXCJhbnNlaGVuXCIsXG4gICAgICAgIFwic2VuZFwiOiBcInZlcnNlbmRlblwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6XCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwiQWN0aXZhdGVcIjogXCJBa3RpdmllcmVuXCIsXG4gICAgICAgIFwidmlydHVhbGl6ZWRcIjogXCJ2aXJ0dWFsaXNlcnRlIEFyYmVpdHN1bWdlYnVuZ1wiLFxuICAgICAgICBcImRlbGV0ZVwiOiBcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImZpbGVkZWxldGVcIjogXCJXb2xsZW4gU2llIGRpZSBEYXRlaS9kZW4gT3JkbmVyIHdpcmtsaWNoIGxcdTAwRjZzY2hlbj9cIixcbiAgICAgICAgXCJjYW5ub3REZWxldGVBY3RpdmVTaGVldFwiOiBcIkFjdGl2ZSBTaGVldCBrYW5uIHdcdTAwRTRocmVuZCBkZXIgUHJcdTAwRkNmdW5nIG5pY2h0IGdlbFx1MDBGNnNjaHQgd2VyZGVuXCIsXG4gICAgICAgIFwiZXhpdGRlbGV0ZVwiOiBcIlByXHUwMEZDZnVuZ3NkYXRlbiBhdWYgU2NoXHUwMEZDbGVyUENzIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJoaWxmZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2thY3RpdmF0ZVwiOiBcIlJlY2h0c2NocmVpYmhpbGZlIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgU3ByYWNoZSBmXHUwMEZDciBkaWUgUHJcdTAwRkNmdW5nXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcImN1c3RvbWhvc3RcIjogXCJFaWdlbmVyIExUIEhvc3RcIixcbiAgICAgICAgXCJsYW5ndWFnZXRvb2xob3N0XCI6IFwiTGFuZ3VhZ2VUb29sIEhvc3RcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwiY21hcmdpblwiOiBcIktvcnJla3R1cnJhbmQgUG9zaXRpb25cIixcbiAgICAgICAgXCJjbWFyZ2luLWxlZnRcIjogXCJsaW5rc1wiLFxuICAgICAgICBcImNtYXJnaW4tcmlnaHRcIjogXCJyZWNodHNcIixcbiAgICAgICAgXCJjbWFyZ2luLXZhbHVlXCI6IFwiS29ycmVrdHVycmFuZCBpbSBQREZcIixcbiAgICAgICAgXCJ0ZXh0ZWRpdG9yXCI6IFwiVGV4dGVkaXRvci1FaW5zdGVsbHVuZ2VuXCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcImJhY2t1cGF1dG9cIjpcIkF1dG9tYXRpc2NoZSBTaWNoZXJ1bmdcIixcbiAgICAgICAgXCJiYWNrdXBhdXRvcXVlc3Rpb25cIjpcIkluIHdlbGNoZW4gQWJzdFx1MDBFNG5kZW4gc29sbGVuIGRpZSBBcmJlaXRlbiBnZWhvbHQgd2VyZGVuP1wiLFxuICAgICAgICBcImJhY2t1cGF1dG9oaW50XCI6XCIoWmVpdGFuZ2FiZSBpbiBNaW51dGVuKVwiLFxuICAgICAgICBcImVkdXZpZHVhbGlkXCI6IFwiRWR1dmlkdWFsIC8gTW9vZGxlXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsaWRoaW50XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIFRlc3QtVVJMIGVpbiFcIixcbiAgICAgICAgXCJnZm9ybXNoaW50XCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIEdvb2dsZSBGb3JtcyBJRCBlaW4hXCIsXG4gICAgICAgIFwiZWR1dmlkdWFsZG9tYWluXCI6IFwiU29sbHRlIGlocmUgTW9vZGxlaW5zdGFueiB1bnRlciBlaW5lciBhbmRlcmVuIERvbWFpbiBlcnJlaWNoYmFyIHNlaW4sIGdlYmVuIFNpZSBkaWVzZSBhblwiLFxuICAgICAgICBcIm1vb2RsZUludmFsaWREb21haW5cIjogXCJCaXR0ZSBnZWJlbiBTaWUgZWluZSBnXHUwMEZDbHRpZ2UgTW9vZGxlLURvbWFpbiBhbiFcIixcbiAgICAgICAgXCJpbnZhbGlkRG9tYWluXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIERvbWFpbiBlaW4hXCIsXG4gICAgICAgIFwibW9vZGxlSW52YWxpZElkXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmUgZ1x1MDBGQ2x0aWdlIFRlc3QtSUQgYW4hXCIsXG4gICAgICAgIFwibG9ja1wiOlwiQmlsZHNjaGlybWUgc3BlcnJlblwiLFxuICAgICAgICBcInVubG9ja1wiOlwiQmlsZHNjaGlybWUgZnJlaWdlYmVuXCIsXG4gICAgICAgIFwiZnJlZXNwYWNld2FybmluZ1wiIDogXCJGcmVpZXIgU3BlaWNoZXJwbGF0eiB6dSBnZXJpbmchXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlXCIgOiBcIkZhbHNjaGVyIERhdGVpdHlwXCIsXG4gICAgICAgIFwiaW52YWxpZF9maWxlX3RleHRcIjogXCJOdXIgRGF0ZWllbiBtaXQgZGVyIEVuZHVuZyAueGxzeCB1bmQgLmRvY3ggc2luZCBlcmxhdWJ0LlwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlZvcmhhbmRlbmUgRGF0ZWllbiBhdWYgT25lRHJpdmUgZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjpcIlNpY2hlcnVuZyBhbmdlZm9yZGVydFwiLFxuICAgICAgICBcInNjcmVlbnNob3RcIjpcIlNjcmVlbnNob3R1cGRhdGVcIixcbiAgICAgICAgXCJzY3JlZW5zaG90dGl0bGVcIjpcIlNjcmVlbnNob3QgVXBkYXRlXCIsXG4gICAgICAgIFwic2NyZWVuc2hvdHF1ZXN0aW9uXCI6XCJJbiB3ZWxjaGVuIEFic3RcdTAwRTRuZGVuIHNvbGxlbiBkaWUgU2NyZWVuc2hvdHMgYWt0dWFsaXNpZXJ0IHdlcmRlbj9cIixcbiAgICAgICAgXCJzY3JlZW5zaG90aGludFwiOlwiKFplaXRhbmdhYmUgaW4gU2VrdW5kZW4uIDAgPT0gZGVha3RpdmllcnQpXCIsXG4gICAgICAgIFwib2xkcGRmd2FybmluZ1wiOlwiTWFuY2hlIEFiZ2FiZW4gc2luZCBtZWhyIGFscyA1IE1pbnV0ZW4gYWx0IVwiLFxuICAgICAgICBcIm9sZHBkZndhcm5pbmdzaW5nbGVcIjpcIkRpZSBsb2thbGUgVmVyc2lvbiBkZXIgRGF0ZWkgaXN0IG1cdTAwRjZnbGljaGVyd2Vpc2UgdmVyYWx0ZXQhXCIsXG4gICAgICAgIFwiZ2Zvcm1zXCI6IFwiR29vZ2xlIEZvcm1zXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkXCI6XCJadWdyaWZmIHZlcndlaWdlcnQhXCIsXG4gICAgICAgIFwiYWNjZXNzRGVuaWVkdGV4dFwiOlwiQml0dGUga29udGFrdGllcmVuIFNpZSBpaHJlbiBTeXN0ZW1hZG1pbmlzdHJhdG9yLCB1bSBkZXIgQXBwbGlrYXRpb24gTmV4dC1FeGFtIFp1Z3JpZmYgenUgZ2V3XHUwMEU0aHJlblwiLFxuICAgICAgICBcIm1zb1dhcm5cIjogXCJCZXZvciBkaWUgU2NoXHUwMEZDbGVyOmlubmVuIGRpZSBWZXJiaW5kdW5nIHdpZWRlciBhdWZuZWhtZW4ga1x1MDBGNm5uZW4sIG1cdTAwRkNzc2VuIFNpZSBzaWNoIHp1IGlocmVyIE1pY3Jvc29mdCBDbG91ZCB2ZXJiaW5kZW4gdW5kIGRpZSBNU09EYXRlaSBlcm5ldXQgYXVzd1x1MDBFNGhsZW4hXCIsXG4gICAgICAgIFwiYWxsb3dzcGVsbGNoZWNrXCI6XCJSZWNodHNjaHJlaWJoaWxmZSBmXHUwMEZDciBTY2hcdTAwRkNsZXI6aW4gYWt0aXZpZXJlblwiLFxuICAgICAgICBcImxpbmVzcGFjaW5nXCI6IFwiWmVpbGVuYWJzdGFuZCBpbSBQREZcIixcbiAgICAgICAgXCJmb250ZmFtaWx5XCI6IFwiU2NocmlmdGFydFwiLFxuICAgICAgICBcImRlZmF1bHRwcmludGVyXCI6IFwiU3RhbmRhcmQtRHJ1Y2tlciB3XHUwMEU0aGxlblwiLFxuICAgICAgICBcImFsbG93ZGlyZWN0cHJpbnRcIjogXCJTY2hcdTAwRkNsZXI6aW5uZW4gZXJsYXViZW4gRHJ1Y2thdWZ0clx1MDBFNGdlIGRpcmVrdCB6dSBzdGFydGVuXCIsXG4gICAgICAgIFwibm9wcmludGVyXCI6IFwiS2VpbmUgRHJ1Y2tlciBnZWZ1bmRlblwiLFxuICAgICAgICBcImRpcmVjdHByaW50XCI6IFwiQXV0b25vbWVyIERydWNrXCIsXG4gICAgICAgIFwib3BlblwiOiBcIkRhdGVpIGluIGV4dGVybmVtIEJldHJhY2h0ZXIgXHUwMEY2ZmZuZW5cIixcbiAgICAgICAgXCJvY3JcIjogXCJPQ1IgU2ljaGVyaGVpdFwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0dGl0bGVcIjogXCJBYnNwaWVsZW4gdm9uIEF1ZGlvZGF0ZWllbiBlaW5zY2hyXHUwMEU0bmtlblwiLFxuICAgICAgICBcImF1ZGlvYWxsb3dcIjogXCJLZWluZSBFaW5zY2hyXHUwMEU0bmt1bmdcIixcbiAgICAgICAgXCJhdWRpb3JlcGVhdDFcIjogXCJ4IGFic3BpZWxlblwiLFxuICAgICAgICBcImF1ZGlvcmVwZWF0MlwiOiBcInggYWJzcGllbGVuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjogXCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsYWN0aXZhdGVcIjogXCJCaWxkdW5nc3BvcnRhbCBha3RpdmllcmVuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxzZXR0aW5nc1wiOiBcIkVyd2VpdGVydGUgRWluc3RlbGx1bmdlbiB6dW0gQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJncm91cHNcIjogXCJHcnVwcGVuXCIsXG4gICAgICAgIFwiZ3JvdXBpbmZvXCI6IFwiU2NoXHUwMEZDbGVyOmlubmVuIGluIHp3ZWkgR3J1cHBlbiBhdWZ0ZWlsZW5cIixcbiAgICAgICAgXCJleHRlbmRlZHNldHRpbmdzXCI6IFwiRXJ3ZWl0ZXJ0ZSBFaW5zdGVsbHVuZ2VuXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcInNwZWljaGVyblwiLFxuICAgICAgICBcImRpc2FibGVkXCI6IFwiZGVha3RpdmllcnRcIixcbiAgICAgICAgXCJvY3JpbmZvXCI6XCJBa3R1ZWxsZSBQclx1MDBGQ2Z1bmdzLVBJTiBpbSBTY3JlZW5zaG90IGVya2VubmVuXCIsXG4gICAgICAgIFwiYmlwaW5mb1wiOiBcIkJpUC1TdGF0dXMgZ2lidCBhbiBvYiBzaWNoIGF1dGhlbnRpZml6aWVydGUgQ2xpZW50cyB2ZXJiaW5kZW4ga1x1MDBGNm5uZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjogXCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImFjdGl2YXRlc2VjdGlvbnNcIjogXCJQclx1MDBGQ2Z1bmdzYWJzY2huaXR0ZSBha3RpdmllcmVuXCIsXG4gICAgICAgIFwiZXhhbXNlY3Rpb25zXCI6IFwiUHJcdTAwRkNmdW5nc2Fic2Nobml0dGVcIixcbiAgICAgICAgXCJleGFtc2VjdGlvbnNpbmZvXCI6IFwiU2llIGJlZmluZGVuIHNpY2ggaW0gYWJnZXNpY2hlcnRlbiBNb2R1cy4gU29sbCBkaWVzZXIgUHJcdTAwRkNmdW5nc2Fic2Nobml0dCBmXHUwMEZDciBhbGxlIHZlcmJ1bmRlbmVuIENsaWVudHMgYWt0aXZpZXJ0IHdlcmRlbj9cIixcbiAgICAgICAgXCJub1wiOlwiTmVpblwiLFxuICAgICAgICBcInllc1wiOlwiSmFcIixcbiAgICAgICAgXCJleGFtbW9kZVwiOlwiUHJcdTAwRkNmdW5nc21vZHVzXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6XCJQclx1MDBGQ2Z1bmdzbWF0ZXJpYWxpZW5cIixcbiAgICAgICAgXCJkZWZpbmVtYXRlcmlhbHNcIjpcIk1hdGVyaWFsaWVuIGZlc3RsZWdlbiBkaWUgd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgdmVyZlx1MDBGQ2diYXIgc2VpbiBzb2xsZW5cIixcbiAgICAgICAgXCJwcm9jZXNzaW5nZmlsZXNcIjpcIk1hdGVyaWFsaWVuIHdlcmRlbiB2ZXJhcmJlaXRldFwiLFxuICAgICAgICBcImZvbnRzaXpldGl0bGVcIjogXCJTY2hyaWZ0Z3JcdTAwRjZcdTAwREZlIGltIFBERlwiLFxuICAgICAgICBcImZvbnRzaXplXCI6IFwiU2NocmlmdGdyXHUwMEY2XHUwMERGZVwiLFxuICAgICAgICBcInJlbW92ZWZpbGVcIjogXCJEYXRlaSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJyZW1vdmVmaWxlY29uZmlybVwiOiBcIldvbGxlbiBTaWUgZGllIERhdGVpIHdpcmtsaWNoIGxcdTAwRjZzY2hlbj9cIixcbiAgICAgICAgXCJzZWN0aW9ubmFtZVwiOiBcIkFic2Nobml0dHNuYW1lXCIsXG4gICAgICAgIFwic2VjdGlvbm5hbWVpbmZvXCI6IFwiQml0dGUgZ2ViZW4gU2llIGVpbmVuIE5hbWVuIGZcdTAwRkNyIGRpZXNlbiBBYnNjaG5pdHQgZWluXCIsXG4gICAgICAgIFwiZ3JvdXBBXCI6IFwiR3J1cHBlIEFcIixcbiAgICAgICAgXCJncm91cEJcIjogXCJHcnVwcGUgQlwiLFxuICAgICAgICBcImFsbG93ZWRVUkxcIjogXCJFcmxhdWJ0ZSBVUkxcIixcbiAgICAgICAgXCJhbGxvd2VkVVJMaW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBlaW5lIFVSTCBlaW4sIGRpZSB3XHUwMEU0aHJlbmQgZGVyIFByXHUwMEZDZnVuZyBlcmxhdWJ0IGlzdFwiLFxuICAgICAgICBcImV4dGVuZGVkc2V0dGluZ3NfbW9kZVwiOiBcIkVyd2VpdGVydGUgRWluc3RlbGx1bmdlbiB6dW0gUHJcdTAwRkNmdW5nc21vZHVzXCIsXG4gICAgICAgIFwicmRwXCI6IFwiV2ViIFJEUFwiLFxuICAgICAgICBcInJkcGNvbmZpZ1wiOiBcIlJEUCBLb25maWd1cmF0aW9uXCIsXG4gICAgICAgIFwicmRwY29uZmlnaW5mb1wiOiBcIkJpdHRlIGdlYmVuIFNpZSBkaWUgRG9tYWluKFVSTCkgZGVzIFJEUC1TZXJ2ZXJzIGVpblwiLFxuICAgICAgICBcIm11dGVhdWRpb1wiOiBcIkF1ZGlvIHN0dW1tc2NoYWx0ZW5cIixcbiAgICAgICAgXCJtdXRlYXVkaW9pbnRyb1wiOiBcIldlbm4gZGllc2UgT3B0aW9uIGFrdGl2aWVydCBpc3QsIHdlcmRlbiBha3VzdGlzY2hlIFNpZ25hbGUgd1x1MDBFNGhyZW5kIGRlciBQclx1MDBGQ2Z1bmcgbmljaHQgYWJnZXNwaWVsdFwiLFxuICAgICAgICBcInNob3dzdWJtaXNzaW9uXCI6IFwiQWJnYWJlIGFuemVpZ2VuXCIsXG4gICAgICAgIFwic3R1ZGVudGluZm9cIjogXCJEZXRhaWxzIHZvbiBTY2hcdTAwRkNsZXI6aW4gYW56ZWlnZW5cIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZGluZm9cIjogXCJEaWUgUHJcdTAwRkNmdW5nc3VtZ2VidW5nIHdpcmQgbVx1MDBGNmdsaWNoZXJ3ZWlzZSBpbiBlaW5lciB2aXJ0dWVsbGVuIE1hc2NoaW5lIGF1c2dlZlx1MDBGQ2hydFwiLFxuICAgICAgICBcImxlZnRraW9za2luZm9cIjogXCJFcyB3dXJkZSB2ZXJzdWNodCBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB6dSB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RpbmZvXCI6IFwiU2ljaGVydW5nZW4gd3VyZGVuIGFuZ2Vmb3JkZXJ0XCIsXG4gICAgICAgIFwicmVtb3RlYXNzaXN0YW50aW5mb1wiOiBcIlJlbW90ZSBBc3Npc3RhbnQgU29mdHdhcmUgbFx1MDBFNHVmdCBtXHUwMEY2Z2xpY2hlcndlaXNlIGFtIFNjaFx1MDBGQ2xlcjppbm5lbi1HZXJcdTAwRTR0XCIsXG4gICAgICAgIFwiZG9jdW1lbnRzaW5mb1wiOiBcIkRva3VtZW50ZSBhdWYgZGVtIFNjaFx1MDBGQ2xlcjppbm5lbi1HZXJcdTAwRTR0OiBcIixcbiAgICAgICAgXCJmaWxlc2l6ZXdhcm5pbmdcIjogXCJEYXRlaWdyXHUwMEY2XHUwMERGZVwiLFxuICAgICAgICBcImZpbGVzaXpld2FybmluZ3RleHRcIjogXCJ7ZmlsZW5hbWV9IGlzdCBnclx1MDBGNlx1MDBERmVyIGFscyA4IE1CICh7c2l6ZX0gTUIpLiBHcm9cdTAwREZlIERhdGVpZW4ga1x1MDBGNm5uZW4gZGllIFx1MDBEQ2JlcnRyYWd1bmcgdmVybGFuZ3NhbWVuLlwiLFxuICAgICAgICBcIm5vcHJpbnRlckNob3NlblwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lbiBEcnVja2VyXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcIkRhcyBUb2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImludmFsaWRyZWdpc3RyYXRpb25cIjogXCJLZWluZSBSZWdpc3RyaWVydW5nIHZvcmdlZnVuZGVuXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgZ2VcdTAwRTRuZGVydFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIHVudGVyIGRpZXNlbSBOYW1lbiBiZXJlaXRzIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJzZXJ2ZXJleGlzdHNcIjogXCJQclx1MDBGQ2Z1bmdzc2VydmVyIGV4aXN0aWVydCBiZXJlaXRzXCIsXG4gICAgICAgIFwic2VydmVyZXhpc3RzTEFOXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBleGlzdGllcnQgYmVyZWl0cyBpbSBsb2tsZW4gTmV0endlcmtcIixcbiAgICAgICAgXCJzZXJ2ZXJzdGFydGVkXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJzZXJ2ZXJzdG9wcGVkXCI6IFwiUHJcdTAwRkNmdW5nc3NlcnZlciBiZWVuZGV0XCIsXG4gICAgICAgIFwibm90Zm91bmRcIjogXCJQclx1MDBGQ2Z1bmcgZXhpc3RpZXJ0IG5pY2h0XCIsXG4gICAgICAgIFwid3Jvbmdwd1wiOiBcIlBhc3N3b3J0IGZhbHNjaFwiLFxuICAgICAgICBcIndyb25ncGluXCI6IFwiRmFsc2NoZXIgUElOXCIsXG4gICAgICAgIFwiY29ycmVjdHB3XCI6IFwiUGFzc3dvcnQgT0tcIixcbiAgICAgICAgXCJzdHVkZW50cmVtb3ZlXCI6IFwiU2NoXHUwMEZDbGVyOmluIHZvbiBQclx1MDBGQ2Z1bmdzc2VydmVyIGVudGZlcm50XCIsXG4gICAgICAgIFwiYWN0aW9uZGVuaWVkXCI6IFwiQWt0aW9uIHZlcmJvdGVuXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwic3R1ZGVudHVwZGF0ZVwiOiBcIlNjaFx1MDBGQ2xlcmRhdGVuIGFrdHVhbGlzaWVydFwiLFxuICAgICAgICBcInN0dWRlbnRsZWZ0XCI6IFwiU2NoXHUwMEZDbGVyOmluIGhhdCBkZW4gUHJcdTAwRkNmdW5nc3NlcnZlciB2ZXJsYXNzZW5cIixcbiAgICAgICAgXCJzdGF0ZXJlc3RvcmVcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgd2llZGVyaGVyZ2VzdGVsbHRcIixcbiAgICAgICAgXCJ2aXJ0dWFsaXplZFwiOiBcIjogRGllIFByXHUwMEZDZnVuZ3N1bWdlYnVuZyB3aXJkIGluIGVpbmVyIHZpcnR1ZWxsZW4gTWFzY2hpbmUgYXVzZ2VmXHUwMEZDaHJ0XCIsXG4gICAgICAgIFwidmVyc2lvbm1pc21hdGNoXCI6IFwiRGllIFByb2dyYW1tdmVyc2lvbmVuIHN0aW1tZW4gbmljaHQgXHUwMEZDYmVyZWluXCIsXG4gICAgICAgIFwiZXhhbXJlcXVlc3RcIjogXCJTaWNoZXJ1bmdlbiB3dXJkZW4gYW5nZWZvcmRlcnRcIixcbiAgICAgICAgXCJiaXByZXF1aXJlZFwiOiBcIkRpZXMgZXJ6d2luZ3QgZGllIEF1dGhlbnRpZml6aWVydW5nIGRlciBTY2hcdTAwRkNsZXI6aW5uZW4gZHVyY2ggZGFzIEJpbGR1bmdzcG9ydGFsLlwiLFxuICAgICAgICBcInN1Ym1pc3Npb25mYWlsZWRcIjogXCJBYmdhYmUgZmVobGdlc2NobGFnZW4hXCIsXG4gICAgICAgIFwic3VibWlzc2lvbnNcIjogXCJBYmdhYmVuXCJcblxuXG4gICAgfSwgIFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImRlbmllZFwiOiBcIlp1Z3JpZmYgdmVyd2VpZ2VydFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcIm5vY2xpZW50c1wiOiBcIktlaW5lIFNjaFx1MDBGQ2xlcjppbm5lbiB2ZXJidW5kZW5cIixcbiAgICAgICAgXCJmaWxlc3NlbnRcIjogXCJEYXRlaWVuIGdlc2VuZGV0XCIsXG4gICAgICAgIFwiY291bGRub3RzdG9yZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBrb25udGUgZGllIERhdGVpIG5pY2h0IHNwZWljaGVyblwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcIkRhdGVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwibm9maWxlcmVjZWl2ZWRcIjogXCJLZWluZSBEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmRlbGV0ZWRcIjogXCJnZWxcdTAwRjZzY2h0XCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwibGVzZW4gZGVyIERhdGVpIGZlaGxnZXNjaGxhZ2VuXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJNXHUwMEY2Z2xpY2hlcndlaXNlIGdlc2Nhbm50ZXMgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIkF1ZlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwid3VyZGVuIHdlbmlnZXIgYWxzIDIgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZ2VmdW5kZW4uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiRGllcyBkZXV0ZXQgZGFyYXVmIGhpbiwgZGFzcyBlcyBzaWNoIHVtIGVpbiBnZXNjYW5udGVzIFBERiBoYW5kZWx0LCBkYXMga2VpbmUgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciBvZGVyIFRhYmVsbGVuIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVmVyc3RhbmRlblwiLFxuICAgICAgICBcInBhZ2VcIjogXCJTZWl0ZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiU2VpdGVuXCIsXG4gICAgICAgIFwiYWN0aXZlc2hlZXRzXCI6IFwiQml0dGUgXHUwMEZDYmVycHJcdTAwRkNmZW4gU2llIGRpZSBEYXJzdGVsbHVuZyB1bmQgUG9zaXRpb25pZXJ1bmcgZGVyIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgdm9yIGRlbSBTdGFydCBkZXIgUHJcdTAwRkNmdW5nIVwiLFxuICAgICAgICBcImVkaXRcIjogXCJCZWFyYmVpdGVuXCIsXG4gICAgICAgIFwic2F2ZVwiOiBcIlNwZWljaGVyblwiXG4gICAgfVxufVxuIiwgImltcG9ydCB7IExvZ0xldmVsLCBQdWJsaWNDbGllbnRBcHBsaWNhdGlvbiB9IGZyb20gJ0BhenVyZS9tc2FsLWJyb3dzZXInO1xuXG4vLyBDb25maWcgb2JqZWN0IHRvIGJlIHBhc3NlZCB0byBNc2FsIG9uIGNyZWF0aW9uXG5leHBvcnQgY29uc3QgbXNhbENvbmZpZyA9IHtcbiAgYXV0aDoge1xuICAgIGNsaWVudElkOiAnYzk1MmVkZGUtZDdjMi00MjgxLWE4NDYtMDM0ZmIwMzllMWY1JyxcbiAgICBhdXRob3JpdHk6ICdodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uJyxcbiAgICByZWRpcmVjdFVyaTogJ2h0dHBzOi8vbG9jYWxob3N0OjIyNDIyL3NlcnZlci9jb250cm9sL21zYXV0aCcsXG4gICAgcG9zdExvZ291dFJlZGlyZWN0VXJpOiAnaHR0cHM6Ly9sb2NhbGhvc3Q6MjI0MjIvc2VydmVyL2NvbnRyb2wvbXNhdXRoJ1xuICB9LFxuICBjYWNoZToge1xuICAgIGNhY2hlTG9jYXRpb246ICdsb2NhbFN0b3JhZ2UnXG4gIH0sXG4gIHN5c3RlbToge1xuICAgICAgbG9nZ2VyT3B0aW9uczoge1xuICAgICAgICAgIGxvZ2dlckNhbGxiYWNrOiAobGV2ZWw6IExvZ0xldmVsLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRhaW5zUGlpOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChjb250YWluc1BpaSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHN3aXRjaCAobGV2ZWwpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuRXJyb3I6XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICBjYXNlIExvZ0xldmVsLkluZm86XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuVmVyYm9zZTpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmRlYnVnKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIGNhc2UgTG9nTGV2ZWwuV2FybmluZzpcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvZ0xldmVsOiBMb2dMZXZlbC5WZXJib3NlXG4gICAgICB9XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBtc2FsSW5zdGFuY2UgPSBuZXcgUHVibGljQ2xpZW50QXBwbGljYXRpb24obXNhbENvbmZpZyk7XG5cbi8vIEFkZCBoZXJlIHNjb3BlcyBmb3IgaWQgdG9rZW4gdG8gYmUgdXNlZCBhdCBNUyBJZGVudGl0eSBQbGF0Zm9ybSBlbmRwb2ludHMuXG5leHBvcnQgY29uc3QgbG9naW5SZXF1ZXN0ID0ge1xuICBzY29wZXM6IFsnVXNlci5SZWFkJywnb3BlbmlkJywgJ3Byb2ZpbGUnLCAnb2ZmbGluZV9hY2Nlc3MnLCAnRmlsZXMuUmVhZCcsICdGaWxlcy5SZWFkV3JpdGUnLCdGaWxlcy5SZWFkV3JpdGUuQXBwRm9sZGVyJ10sXG59O1xuXG4vLyBBZGQgaGVyZSB0aGUgZW5kcG9pbnRzIGZvciBNUyBHcmFwaCBBUEkgc2VydmljZXMgeW91IHdvdWxkIGxpa2UgdG8gdXNlLlxuZXhwb3J0IGNvbnN0IGdyYXBoQ29uZmlnID0ge1xuICBncmFwaE1lRW5kcG9pbnQ6ICdodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20vdjEuMC9tZScsXG59O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgZGlhbG9nLCBzY3JlZW4gfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCdcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lXG5cbi8vIEJhc2UgcGF0aCBmb3IgcHVibGljIGFzc2V0cyAoaWNvbnMsIGV0Yy4pOiBwYWNrYWdlZCA9IGFwcC5hc2FyLnVucGFja2VkL3B1YmxpYywgZGV2ID0gcHJvamVjdCBwdWJsaWNcbmZ1bmN0aW9uIGdldFB1YmxpY0Jhc2UoKSB7XG4gIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnKTtcbiAgICByZXR1cm4gZnMuZXhpc3RzU3luYyh1bnBhY2tlZCkgPyB1bnBhY2tlZCA6IGpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnKTtcbiAgfVxuICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9wdWJsaWMnKTtcbn1cblxuLy8gUmVuZGVyZXIgYnVpbHQgaW50byBwdWJsaWMvIChvbmUgY29weSk7IHdoZW4gcGFja2FnZWQgdXNlIGFwcC5hc2FyLnVucGFja2VkL3B1YmxpY1xuZnVuY3Rpb24gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSB7XG4gIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCAnaW5kZXguaHRtbCcpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHVucGFja2VkKSkgcmV0dXJuIHVucGFja2VkO1xuICB9XG4gIGNvbnN0IHB1YmxpY1BhdGggPSBqb2luKF9fZGlybmFtZSwgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHB1YmxpY1BhdGgpKSByZXR1cm4gcHVibGljUGF0aDtcbiAgY29uc3QgZGlzdFJlbmRlcmVyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnZGlzdCcsICdyZW5kZXJlcicsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKGRpc3RSZW5kZXJlclBhdGgpKSByZXR1cm4gZGlzdFJlbmRlcmVyUGF0aDtcbiAgY29uc3QgcXVhc2FyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpO1xuICBpZiAoZnMuZXhpc3RzU3luYyhxdWFzYXJQYXRoKSkgcmV0dXJuIHF1YXNhclBhdGg7XG4gIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbn1cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5hdXRod2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgIHRoaXMubXVsdGljYXN0U2VydmVyID0gbnVsbFxuICAgICBcbiAgXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgfVxuXG5cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oZ2V0UHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEyMDAsXG4gICAgICAgICAgICBoZWlnaHQ6OTIwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcImRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIm5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwidGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ0NhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBjcmVhdGVXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSB7IHdpZHRoOiA4MDAsIGhlaWdodDogODAwIH1cbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpXG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0tVGVhY2hlcicsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMmUyYzI5JyxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihnZXRQdWJsaWNCYXNlKCksICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOiB0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICBtaW5XaWR0aDogMTIwMCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogODAwLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVJcbiAgICAgICAgICAgICAgICAgICAgPyBwYXRoLnJlc29sdmUoY3VycmVudERpciwgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTiB8fCAnLmNqcycpKSlcbiAgICAgICAgICAgICAgICAgICAgOiBqb2luKF9fZGlybmFtZSwgJy4uL3ByZWxvYWQvcHJlbG9hZC5tanMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogZGlkLWZpbmlzaC1sb2FkIC0gc2hvd2luZyB3aW5kb3cnKVxuICAgICAgICAgICAgaWYgKHRoaXMubWFpbndpbmRvdyAmJiAhdGhpcy5tYWlud2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LnNob3coKVxuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbJ0RFQlVHJ10pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKTtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IHByb2Nlc3MuZW52LkFQUF9VUkwgfHwgYGh0dHA6Ly8ke3Byb2Nlc3MuZW52WydWSVRFX0RFVl9TRVJWRVJfSE9TVCddIHx8ICdsb2NhbGhvc3QnfToke3Byb2Nlc3MuZW52WydWSVRFX0RFVl9TRVJWRVJfUE9SVCddIHx8ICc5MzAwJ31gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogTG9hZGluZyBVUkw6ICR7dXJsfWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICBcbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4ge1xuICAgICAgICAgICAgdmFyIHsgaG9zdG5hbWUsIGNlcnRpZmljYXRlLCB2YWxpZGF0ZWRDZXJ0aWZpY2F0ZSwgdmVyaWZpY2F0aW9uUmVzdWx0LCBlcnJvckNvZGUgfSA9IHJlcXVlc3Q7XG4gICAgICAgICAgICBjYWxsYmFjaygwKTtcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIFxuICAgICAgICAvLyBTaG93IHdpbmRvdyBldmVuIGlmIGxvYWRpbmcgZmFpbHMgKEVsZWN0cm9uIDM5IGNvbXBhdGliaWxpdHkpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lKSA9PiB7XG4gICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZVdpbmRvdzogZGlkLWZhaWwtbG9hZCAtIEVycm9yICR7ZXJyb3JDb2RlfTogJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKVxuICAgICAgICAgICAgLy8gU3RpbGwgc2hvdyB0aGUgd2luZG93IGV2ZW4gaWYgbG9hZGluZyBmYWlsZWRcbiAgICAgICAgICAgIGlmICh0aGlzLm1haW53aW5kb3cgJiYgIXRoaXMubWFpbndpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlV2luZG93OiBTaG93aW5nIHdpbmRvdyBhZnRlciBkaWQtZmFpbC1sb2FkJylcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuc2hvdygpXG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gbWFpbndpbmRvdy53ZWJDb250ZW50cyB0byBhdm9pZCBhbnkgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGFwcCBleGNlcHQgZm9yIGludGVybmFsIGxpbmtzXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBhcHBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAvLyBQcmV2ZW50IG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubWFpbndpbmRvdz8ud2ViQ29udGVudHMuZ2V0VVJMKCkuaW5jbHVkZXMoXCJkYXNoYm9hcmRcIikpIHtcbiAgICAgICAgICAgICAgICAvLyBkbyBub3QgY2xvc2UgYSBydW5uaW5nIGV4YW0gYnkgYWNjaWRlbnQgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY2xvc2U6IGRvIG5vdCBjbG9zZSBydW5uaW5nIGV4YW0gdGhpcyB3YXlcIik7IGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgZGlhbG9nLnNob3dNZXNzYWdlQm94U3luYyh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luZm8nLCBcbiAgICAgICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLCAvLyBOdXIgZWluIEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0SWQ6IDAsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJcdTAwRkNmdW5nIGxcdTAwRTR1ZnQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQmVlbmRlbiBTaWUgenVlcnN0IGRpZSBsYXVmZW5kZSBQclx1MDBGQ2Z1bmchJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBNaWNyb3NvZnQgMzY1IEF1dGggV2luZG93IFxuICAgICAqL1xuICAgIGNyZWF0ZU1zYXV0aFdpbmRvdygpIHtcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgY2VudGVyOiB0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdPQXV0aCcsXG4gICAgICAgICAgICB3aWR0aDogNTAwLFxuICAgICAgICAgICAgaGVpZ2h0OiA4MDAsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKGdldFB1YmxpY0Jhc2UoKSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUlxuICAgICAgICAgICAgICAgICAgICA/IHBhdGgucmVzb2x2ZShjdXJyZW50RGlyLCBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyAocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OIHx8ICcuY2pzJykpKVxuICAgICAgICAgICAgICAgICAgICA6IGpvaW4oX19kaXJuYW1lLCAnLi4vcHJlbG9hZC9wcmVsb2FkLm1qcycpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBgaHR0cHM6Ly9sb2NhbGhvc3Q6MjI0MjIvc2VydmVyL2NvbnRyb2wvb2F1dGhgXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLmF1dGh3aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYXV0aHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRod2luZG93ICYmICF0aGlzLmF1dGh3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgICAgIHRoaXMuYXV0aHdpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGh3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICAgICAgdGhpcy5hdXRod2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiAiLCAiXG4vKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgeyBSb3V0ZXIgfSBmcm9tICdleHByZXNzJ1xuY29uc3Qgcm91dGVyID0gUm91dGVyKClcbmltcG9ydCBwYXRoICBmcm9tICdwYXRoJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi8uLi8uLi9tYWluL2NvbmZpZy5qcydcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgZXh0cmFjdCBmcm9tICdleHRyYWN0LXppcCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7IHQgfSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInXG5pbXBvcnQgeyBQREZEb2N1bWVudCwgcmdiIH0gZnJvbSAncGRmLWxpYi9kaXN0L3BkZi1saWIuanMnICAvLyB3ZSBpbXBvcnQgdGhlIGNvbXBsaWVkIHZlcnNpb24gb3RoZXJ3aXNlIHdlIGdldCAxMDAwIHNvdXJjZW1hcCB3YXJuaW5nc1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuaW1wb3J0IHBkZiBmcm9tICdAYmluZ3Nqcy9wZGYtcGFyc2UnO1xuXG5cbi8qKlxuICogR0VUIGEgRklMRS1MSVNUIGZyb20gd29ya2RpcmVjdG9yeVxuICovIFxuIHJvdXRlci5wb3N0KCcvZ2V0ZmlsZXMvOnNlcnZlcm5hbWUvOnRva2VuJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEucGFyYW1zLnRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IGRpciA9cmVxLmJvZHkuZGlyXG4gICAgXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgIFxuICAgIGxldCBmb2xkZXJzID0gW11cbiAgICBmb2xkZXJzLnB1c2goIHtjdXJyZW50ZGlyZWN0b3J5OiBkaXIsIHBhcmVudGRpcmVjdG9yeTogcGF0aC5kaXJuYW1lKGRpcil9KSAvLyBzbyB0aGlzIGluZm9ybWF0aW9uIGlzIGFsd2F5cyBvbiBmaWxlbGlzdFswXSA+PiBub3QgdGhlIG1vc3Qgcm9idXN0IGlkZWEgYnV0IHVzZWQgaW4gZmlsZWV4cGxvcmVyIC0gYmUgY2FyZWZ1bFxuICAgIFxuICAgIGNvbnN0IG9taXRFeHRlbnNpb25zID0gWycuanNvbiddOyAgIC8vIHRoZXNlIGZpbGV0eXBlcyBhcmUgbm90IHBhcnQgb2YgdGhlIGZpbGVsaXN0IHNlbnQgdG8gdGhlIGZyb250ZW5kICh1c2VkIHRvIGRpc3BsYXkgdGhlIHVzZXIgZGlyZWN0b3JpZXMgaW4gdGhlIGZpbGVleHBsb3JlciBwYXJ0IG9mIHRoZSBkYXNoYm9hcmQpXG4gICAgXG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIoZGlyKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcGF0aCA9IHBhdGguam9pbihkaXIsIGZpbGUpO1xuICAgICAgICAgICAgbGV0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMucHJvbWlzZXMuc3RhdChmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9sZGVycy5wdXNoKHsgcGF0aDogZmlsZXBhdGgsIG5hbWU6IGZpbGUsIHR5cGU6IFwiZGlyXCIsIGV4dDogXCJcIiwgcGFyZW50OiBkaXIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHN0YXRzLmlzRmlsZSgpICYmICFvbWl0RXh0ZW5zaW9ucy5pbmNsdWRlcyhleHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvbGRlcnMucHVzaCh7IHBhdGg6IGZpbGVwYXRoLCBuYW1lOiBmaWxlLCB0eXBlOiBcImZpbGVcIiwgZXh0OiBleHQsIHBhcmVudDogZGlyIH0pOyAvLyBLb3JyaWdpZXJ0IGBwYXJlbnQ6ICcnYCB6dSBgcGFyZW50OiBkaXJgIGZcdTAwRkNyIEtvbnNpc3RlbnpcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChpbm5lckVycikge1xuICAgICAgICAgICAgICAgIC8vIEJlaGFuZGVsbiBTaWUgRmVobGVyLCBkaWUgdm9uIGZzLnByb21pc2VzLnN0YXQgZ2V3b3JmZW4gd2VyZGVuXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcImRhdGEgQCBnZXRmaWxlczogRmVobGVyIGJlaW0gWnVncmlmZiBhdWYgRGF0ZWkgb2RlciBWZXJ6ZWljaG5pczogXCIsIGlubmVyRXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBCZWhhbmRlbG4gU2llIEZlaGxlciwgZGllIHZvbiBmcy5wcm9taXNlcy5yZWFkZGlyIGdld29yZmVuIHdlcmRlblxuICAgICAgICBjb25zb2xlLmVycm9yKFwiZGF0YSBAIGdldGZpbGVzOiBGZWhsZXIgYmVpbSBMZXNlbiBkZXMgVmVyemVpY2huaXNzZXM6IFwiLCBlcnIpO1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogdChcImRhdGEuZmlsZWVycm9yXCIpIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzLnNlbmQoIGZvbGRlcnMgKVxufSlcblxuXG5cblxuXG4vKipcbiAqIENSRUFURSBDT01CSU5FRCBQREYgU1RBUlQgPj4+Pj4+Pj4+Pj4+Pj4+Pj4+XG4gKi9cblxuXG5cbi8qKlxuICogR0VUIGEgbGF0ZXN0IHdvcmsgZnJvbSBhbGwgc3R1ZGVudHNcbiAqIFRoaXMgQVBJIFJvdXRlIGNyZWF0ZXMgYSBsaXN0IG9mIHRoZSBsYXRlc3QgcGRmIGZpbGVwYXRocyBvZiBhbGwgY29ubmVjdGVkIHN0dWRlbnRzXG4gKiBhbmQgY29uY2F0cyBlYWNoIG9mIHRoZSBwZGZzIHRvIG9uZVxuICovIFxuIHJvdXRlci5wb3N0KCcvZ2V0bGF0ZXN0LzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBzdWJtaXNzaW9ucyA9IHJlcS5ib2R5LnN1Ym1pc3Npb25zXG4gICAgbGV0IHdhcm5pbmcgPSBmYWxzZVxuXG4gICAgLy8gY2hlY2sgaWYgdGhpcyBpcyBhIGxlZ2l0IGNhbGwgZnJvbSB0aGUgdGVhY2hlciBmcm9udGVuZFxuICAgIGlmICggdG9rZW4gIT09IG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVydG9rZW4gKSB7IHJldHVybiByZXMuanNvbih7IHN0YXR1czogdChcImRhdGEudG9rZW5ub3R2YWxpZFwiKSB9KSB9XG5cblxuICAgICAgIFxuXG4gICAgLy9jcmVhdGUgYXJyYXkgdGhhdCBjb250YWlucyBvbmx5IGZpbGVwYXRoc1xuICAgIC8vIHdlIGl0ZXJhdGUgb3ZlciB0aGUgc3VibWlzc2lvbnMgYXJyYXkgYW5kIGdldCB0aGUgbGF0ZXN0IGZpbGVwYXRocyBmb3IgZWFjaCBzZWN0aW9uXG4gICAgbGV0IGxhdGVzdEZpbGVzID0gW11cbiAgICBmb3IgKGxldCBzdHVkZW50IG9mIHN1Ym1pc3Npb25zKSB7XG4gICAgICAgIGZvciAobGV0IHNlY3Rpb24gPSAxOyBzZWN0aW9uIDw9IDQ7IHNlY3Rpb24rKykge1xuICAgICAgICAgICAgaWYgKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aCl7XG4gICAgICAgICAgICAgICAgbGF0ZXN0RmlsZXMucHVzaChzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2coXCJkYXRhIEAgZ2V0bGF0ZXN0OiBsYXRlc3RGaWxlc1wiLCBsYXRlc3RGaWxlcylcblxuICAgIC8vIG5vdyBjcmVhdGUgb25lIG1lcmdlZCBwZGYgb3V0IG9mIGFsbCBmaWxlc1xuICAgIGlmIChsYXRlc3RGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHt3YXJuaW5nOiB3YXJuaW5nLCBwZGZCdWZmZXI6IG51bGx9KVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbGV0IGluZGV4UERGZGF0YSA9IGF3YWl0IGNyZWF0ZUluZGV4UERGKHN1Ym1pc3Npb25zLCBzZXJ2ZXJuYW1lKSAgIC8vY29udGFpbnMgdGhlIGluZGV4IHRhYmxlIHBkZiBhcyB1aW50OGFycmF5XG4gICAgICAgIGxldCBpbmRleFBERnBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSxcImluZGV4LnBkZlwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGluZGV4UERGcGF0aCwgaW5kZXhQREZkYXRhKTtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdkYXRhIEAgZ2V0bGF0ZXN0OiBJbmRleCBQREYgc2F2ZWQgc3VjY2Vzc2Z1bGx5IScpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7bG9nLmVycm9yKFwiZGF0YSBAIGdldGxhdGVzdDpcIixlcnIpfVxuICAgICAgICBsYXRlc3RGaWxlcy51bnNoaWZ0KGluZGV4UERGcGF0aClcblxuXG4gICAgICAgIC8vIG5vdyBjb25jYXQgdGhlIHBkZnMgb2YgYWxsIHNlY3Rpb25zIHRvIG9uZSBjb21iaW5lZCBwZGZcbiAgICAgICAgbGV0IFBERiA9IGF3YWl0IGNvbmNhdFBhZ2VzKGxhdGVzdEZpbGVzKVxuICAgICAgICBsZXQgcGRmQnVmZmVyID0gQnVmZmVyLmZyb20oUERGKSBcbiAgICAgICAgbGV0IHBkZlBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSxcImNvbWJpbmVkLnBkZlwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKHBkZlBhdGgsIHBkZkJ1ZmZlcik7XG4gICAgICAgICAgICBsb2cuaW5mbygnZGF0YSBAIGdldGxhdGVzdDogUERGIHNhdmVkIHN1Y2Nlc3NmdWxseSEnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe2xvZy5lcnJvcihcImRhdGEgQCBnZXRsYXRlc3Q6XCIsZXJyKX1cbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHt3YXJuaW5nOiB3YXJuaW5nLCBwZGZCdWZmZXI6cGRmQnVmZmVyLCBwZGZQYXRoOnBkZlBhdGggfSk7XG4gICAgfVxufSlcblxuXG5cblxuXG5cblxuXG5cblxuZnVuY3Rpb24gaXNWYWxpZFBkZihkYXRhKSB7XG4gICAgY29uc3QgaGVhZGVyID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSwgMCwgNSk7IC8vIExlc2UgZGllIGVyc3RlbiA1IEJ5dGVzIGZcdTAwRkNyIFwiJVBERi1cIlxuICAgIC8vIFVtd2FuZGx1bmcgZGVyIEJ5dGVzIGluIEhleGFkZXppbWFsd2VydGUgZlx1MDBGQ3IgZGVuIFZlcmdsZWljaFxuICAgIGNvbnN0IHBkZkhlYWRlciA9IFsweDI1LCAweDUwLCAweDQ0LCAweDQ2LCAweDJEXTsgLy8gXCIlUERGLVwiIGluIEhleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGRmSGVhZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChoZWFkZXJbaV0gIT09IHBkZkhlYWRlcltpXSkge1xuICAgICAgICAgICAgbG9nLndhcm4oJ2RhdGEgQCBpc1ZhbGlkUGRmOiBpbnZhbGlkIFBERiBwcm9jZXNzZWQnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBGclx1MDBGQ2hlciBBYmJydWNoLCB3ZW5uIGVpbiBCeXRlIG5pY2h0IFx1MDBGQ2JlcmVpbnN0aW1tdFxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlOyAvLyBBbGxlIEJ5dGVzIHN0aW1tZW4gbWl0IGRlbSBQREYtSGVhZGVyIFx1MDBGQ2JlcmVpblxufVxuXG5hc3luYyBmdW5jdGlvbiBjb3VudENoYXJzT2ZQREYocGRmUGF0aCwgc3R1ZGVudG5hbWUsIHNlcnZlcm5hbWUpe1xuICAgIGNvbnN0IGRhdGFCdWZmZXIgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShwZGZQYXRoKTsvLyBSZWFkIHRoZSBQREYgZmlsZVxuICAgIGxldCBjaGFycyA9IDAgXG5cbiAgICBpZiAoaXNWYWxpZFBkZihkYXRhQnVmZmVyKSl7XG4gICAgICAgIGNoYXJzID0gYXdhaXQgcGRmKGRhdGFCdWZmZXIpLnRoZW4oIGRhdGEgPT4geyAgICAvLyBQYXJzZSB0aGUgUERGICAvLyBkYXRhLnRleHQgY29udGFpbnMgYWxsIHRoZSB0ZXh0IGV4dHJhY3RlZCBmcm9tIHRoZSBQREZcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEudGV4dCAmJiBzdHVkZW50bmFtZSkgeyAgIFxuICAgICAgICAgICAgICAgIGxldCBudW1iZXJPZkNoYXJhY3RlcnMgPSBkYXRhLnRleHQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coYE51bWJlciBvZiBjaGFyYWN0ZXJzIGluIHRoZSBQREY6ICR7bnVtYmVyT2ZDaGFyYWN0ZXJzfWAsIHN0dWRlbnRuYW1lLCBzZXJ2ZXJuYW1lKTtcblxuICAgICAgICAgICAgICAgIGxldCBoZWFkZXIgPSBgICR7c2VydmVybmFtZX0gfCAxMC4xMC4yNCwgMTA6MTAgYFxuICAgICAgICAgICAgICAgIGxldCBmb290ZXIgPSBgIFplaWNoZW46IDEwIHwgV1x1MDBGNnJ0ZXI6IDEwICAxLzEgYCAgIC8vYXBwcm94aW1hdGVseVxuXG4gICAgICAgICAgICAgICAgbnVtYmVyT2ZDaGFyYWN0ZXJzID0gbnVtYmVyT2ZDaGFyYWN0ZXJzIC8vIC0gaGVhZGVyLmxlbmd0aCAtIHN0dWRlbnRuYW1lLmxlbmd0aCAtIGZvb3Rlci5sZW5ndGggLy8gLTUgZm9yIGF2ZXJhZ2UgbmFtZSBsZW5ndGggIC8vIGZcdTAwRkNyIG1zd29yZCBvcHRpb24gLSBoaWVyIGdpYnRzIGtlaW5lbiBoZWFkZXJcblxuXG4gICAgICAgICAgICAgICAgLy93ZSB0cnkgdG8gZmlsdGVyIG91dCB0aGUgaW1wb3J0YW50IHBhcnQgb2YgdGhlIGRvY3VtZW50IHRoYXQgc2hvd3MgdGhlIGFjdHVhbCBudW1iZXIgb2YgY2hhcnNcbiAgICAgICAgICAgICAgICBsZXQgcmVnZXggPSAvWmVpY2hlbjogKFxcZCspLztcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2hlcyA9IGRhdGEudGV4dC5tYXRjaChyZWdleCk7XG4gICAgICAgICAgICAgICAgbGV0IHplaWNoZW5BbnphaGwgPSBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6IFwibm90Zm91bmRcIjtcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh6ZWljaGVuQW56YWhsICE9PSBcIm5vdGZvdW5kXCIpeyAgIC8vd2UgZm91bmQgaXQgIVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gemVpY2hlbkFuemFobFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVnZXggPSAvWmVpY2hlbjooXFxkKykvOyAgLy90cnkgc2xpZ2h0bHkgZGlmZmVyZW50IHJlZ2V4IGJlY2F1c2Ugc29tZSBwZGZzIChwcm9iYWJseSBmcm9tIG1hYykgcmVtb3ZlIHNwYWNlcyB3aGVuIHJlYWRcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyA9IGRhdGEudGV4dC5tYXRjaChyZWdleCk7XG4gICAgICAgICAgICAgICAgICAgIHplaWNoZW5BbnphaGwgPSBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6IFwibm90Zm91bmRcIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHplaWNoZW5BbnphaGwgIT09IFwibm90Zm91bmRcIil7ICAvLyBub3cgd2UgZm91bmQgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZWljaGVuQW56YWhsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhLnRleHQpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVtYmVyT2ZDaGFyYWN0ZXJzID49IDAgPyBgfiAke251bWJlck9mQ2hhcmFjdGVyc31gIDogJ34gMCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMFxuICAgICAgICAgICAgfVxuICAgIFxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtsb2cuZXJyb3IoYGRhdGEgQCBjb3VudENoYXJzT2ZQREY6ICR7ZXJyfWApOyByZXR1cm4gMCAgfSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjaGFycyA9IFwibm8gcGRmXCJcbiAgICB9XG4gXG4gICAgcmV0dXJuIGNoYXJzIFxufVxuXG5cblxuXG5cblxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVJbmRleFBERihzdWJtaXNzaW9ucywgc2VydmVybmFtZSl7XG4gICAgbGV0IHRhYmxlZGF0YSA9IFtbXCJOYW1lXCIsIFwiQWJzY2huaXR0XCIsIFwiRGF0dW1cIiwgXCJaZWljaGVuXCIsIFwiRGF0ZWluYW1lXCJdXVxuICAgIGZvciAoY29uc3Qgc3R1ZGVudCBvZiBzdWJtaXNzaW9ucyl7XG4gICAgICAgIGxldCBoYXNTdWJtaXNzaW9uID0gZmFsc2UgLy8gdHJhY2sgaWYgc3R1ZGVudCBoYXMgYXQgbGVhc3Qgb25lIHN1Ym1pc3Npb25cbiAgICAgICAgY29uc3QgdHJpbW1lZE5hbWUgPSBzdHVkZW50LnN0dWRlbnROYW1lLmxlbmd0aCA+IDIwID8gc3R1ZGVudC5zdHVkZW50TmFtZS5zbGljZSgwLCAyMCkgKyBcIi4uLlwiIDogc3R1ZGVudC5zdHVkZW50TmFtZVxuICAgICAgICBmb3IgKGxldCBzZWN0aW9uID0gMTsgc2VjdGlvbiA8PSA0OyBzZWN0aW9uKyspIHtcbiAgICAgICAgICAgIGxldCBuYW1lID0gXCItXCJcbiAgICAgICAgICAgIGxldCBzZWN0aW9uTmFtZSA9IFwiLVwiXG4gICAgICAgICAgICBsZXQgdGltZSA9IFwiLVwiXG4gICAgICAgICAgICBsZXQgY2hhcnMgPSBcIjBcIlxuICAgICAgICAgICAgbGV0IGZpbGVuYW1lID0gXCItXCJcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0ucGF0aCl7XG4gICAgICAgICAgICAgICAgbmFtZSA9IHRyaW1tZWROYW1lO1xuICAgICAgICAgICAgICAgIHNlY3Rpb25OYW1lID0gc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5zZWN0aW9ubmFtZSB8fCBgQWJzY2huaXR0ICR7c2VjdGlvbn1gXG4gICAgICAgICAgICAgICAgc2VjdGlvbk5hbWUgPSBzZWN0aW9uTmFtZS5sZW5ndGggPiAyMCA/IHNlY3Rpb25OYW1lLnNsaWNlKDAsIDIwKSArIFwiLi4uXCIgOiBzZWN0aW9uTmFtZTtcbiAgICAgICAgICAgICAgICB0aW1lID0gbW9tZW50KHN0dWRlbnQuc2VjdGlvbnNbc2VjdGlvbl0uZGF0ZSkuZm9ybWF0KCdERC5NTS5ZWVlZIEhIOm1tJylcbiAgICAgICAgICAgICAgICBjaGFycyA9IGF3YWl0IGNvdW50Q2hhcnNPZlBERihzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLnBhdGgsIHN0dWRlbnQuc3R1ZGVudE5hbWUsIHNlcnZlcm5hbWUpXG4gICAgICAgICAgICAgICAgZmlsZW5hbWUgPSBzdHVkZW50LnNlY3Rpb25zW3NlY3Rpb25dLmZpbGVuYW1lLmxlbmd0aCA+IDI1ID8gc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5maWxlbmFtZS5zbGljZSgwLCAyNSkgKyBcIi4uLlwiIDogc3R1ZGVudC5zZWN0aW9uc1tzZWN0aW9uXS5maWxlbmFtZSA7XG4gICAgICAgICAgICAgICAgdGFibGVkYXRhLnB1c2goWyBuYW1lLCBzZWN0aW9uTmFtZSwgdGltZSwgY2hhcnMsIGZpbGVuYW1lIF0pXG4gICAgICAgICAgICAgICAgaGFzU3VibWlzc2lvbiA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWhhc1N1Ym1pc3Npb24pIHtcbiAgICAgICAgICAgIHRhYmxlZGF0YS5wdXNoKFsgdHJpbW1lZE5hbWUsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIgXSlcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBwZGZEb2MgPSBhd2FpdCBQREZEb2N1bWVudC5jcmVhdGUoKTsvLyBDcmVhdGUgYSBuZXcgUERGRG9jdW1lbnRcbiAgICBjb25zdCBwYWdlID0gcGRmRG9jLmFkZFBhZ2UoKTsgLy8gQWRkIGEgcGFnZSB0byB0aGUgZG9jdW1lbnRcblxuICAgIC8vIFNldCB1cCB0YWJsZSBkaW1lbnNpb25zIGFuZCBzdHlsZXNcbiAgICBjb25zdCBzdGFydFggPSA1MDsgLy8gWC1jb29yZGluYXRlIHdoZXJlIHRoZSB0YWJsZSBzdGFydHNcbiAgICBjb25zdCBzdGFydFkgPSBwYWdlLmdldEhlaWdodCgpIC0gNTA7IC8vIFktY29vcmRpbmF0ZSB3aGVyZSB0aGUgdGFibGUgc3RhcnRzIChmcm9tIHRvcClcbiAgICBjb25zdCByb3dIZWlnaHQgPSAxNTsgLy8gSGVpZ2h0IG9mIGVhY2ggcm93IChyZWR1Y2VkIGZvciBzbWFsbGVyIGZvbnQgc2l6ZSlcbiAgICBjb25zdCBjb2x1bW5XaWR0aHMgPSBbMTEwLCAxMzAsIDgwLCA0MCwgMTQwXTsgLy8gV2lkdGggb2YgZWFjaCBjb2x1bW46IE5hbWUsIEFic2Nobml0dCwgRGF0dW0sIFplaWNoZW4sIERhdGVpbmFtZVxuXG4gICAgLy8gRnVuY3Rpb24gdG8gZHJhdyBhIGNlbGxcbiAgICBjb25zdCBkcmF3Q2VsbCA9ICh4LCB5LCB3aWR0aCwgaGVpZ2h0KSA9PiB7IHBhZ2UuZHJhd1JlY3RhbmdsZSh7IHgsIHksIHdpZHRoLCBoZWlnaHQsIGJvcmRlckNvbG9yOiByZ2IoMCwgMCwgMCksICBib3JkZXJXaWR0aDogMSwgIH0pOyAgfTtcbiAgICAvLyBGdW5jdGlvbiB0byBhZGQgdGV4dCB0byBhIGNlbGxcbiAgICBjb25zdCBhZGRUZXh0ID0gKHRleHQsIHgsIHkpID0+IHsgIHRleHQgPSBTdHJpbmcodGV4dCk7ICAgIHBhZ2UuZHJhd1RleHQodGV4dCwgeyB4LCB5LCBzaXplOiA5LCBjb2xvcjogcmdiKDAsIDAsIDApLCAgfSk7ICB9O1xuXG4gICAgdGFibGVkYXRhLmZvckVhY2goKHJvdywgcm93SW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgeVBvcyA9IHN0YXJ0WSAtIHJvd0luZGV4ICogcm93SGVpZ2h0OyAvLyBDYWxjdWxhdGUgWSBwb3NpdGlvbiBmb3IgdGhlIGN1cnJlbnQgcm93XG4gICAgICAgIHJvdy5mb3JFYWNoKChjZWxsVGV4dCwgY29sdW1uSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHhQb3MgPSBzdGFydFggKyBjb2x1bW5XaWR0aHMuc2xpY2UoMCwgY29sdW1uSW5kZXgpLnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyArIHZhbCwgMCk7IC8vIENhbGN1bGF0ZSBYIHBvc2l0aW9uIGZvciB0aGUgY3VycmVudCBjZWxsXG4gICAgICAgICAgICBkcmF3Q2VsbCh4UG9zLCB5UG9zIC0gcm93SGVpZ2h0LCBjb2x1bW5XaWR0aHNbY29sdW1uSW5kZXhdLCByb3dIZWlnaHQpO1xuICAgICAgICAgICAgYWRkVGV4dChjZWxsVGV4dCwgeFBvcyArIDMsIHlQb3MgLSByb3dIZWlnaHQgKyA0KTsgLy8gQWRqdXN0IHRleHQgcG9zaXRpb24gd2l0aGluIHRoZSBjZWxsIChyZWR1Y2VkIHBhZGRpbmcgZm9yIHNtYWxsZXIgcm93IGhlaWdodClcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgLy8gU2VyaWFsaXplIHRoZSBQREZEb2N1bWVudCB0byBieXRlcyAoYSBVaW50OEFycmF5KVxuICAgIGNvbnN0IHBkZkJ5dGVzID0gYXdhaXQgcGRmRG9jLnNhdmUoKTtcbiAgICByZXR1cm4gcGRmQnl0ZXMgXG59XG5cblxuLyoqXG4gKiBDUkVBVEUgQ09NQklORUQgUERGIEVORCA+Pj4+Pj4+Pj4+Pj4+Pj4+Pj5cbiAqL1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbmFzeW5jIGZ1bmN0aW9uIGNvbmNhdFBhZ2VzKHBkZnNUb01lcmdlKSB7XG4gICAgLy8gQ3JlYXRlIGEgbmV3IFBERkRvY3VtZW50XG4gICAgY29uc3QgdGVtcFBERiA9IGF3YWl0IFBERkRvY3VtZW50LmNyZWF0ZSgpO1xuICAgIGZvciAoY29uc3QgcGRmcGF0aCBvZiBwZGZzVG9NZXJnZSkgeyBcbiAgICAgICAgbGV0IHBkZkJ5dGVzID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUocGRmcGF0aCk7XG4gICAgICAgIC8vY2hlY2sgaWYgdGhpcyBhY3R1YWxseSBpcyBhIHBkZlxuICAgICAgICBpZiAoaXNWYWxpZFBkZihwZGZCeXRlcykpe1xuICAgICAgICAgICAgY29uc3QgcGRmID0gYXdhaXQgUERGRG9jdW1lbnQubG9hZChwZGZCeXRlcyk7IFxuICAgICAgICAgICAgY29uc3QgY29waWVkUGFnZXMgPSBhd2FpdCB0ZW1wUERGLmNvcHlQYWdlcyhwZGYsIHBkZi5nZXRQYWdlSW5kaWNlcygpKTtcbiAgICAgICAgICAgIGNvcGllZFBhZ2VzLmZvckVhY2goKHBhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICB0ZW1wUERGLmFkZFBhZ2UocGFnZSk7IFxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9XG4gICAgICAgXG4gICAgfSBcbiAgICAvLyBTZXJpYWxpemUgdGhlIFBERkRvY3VtZW50IHRvIGJ5dGVzIChhIFVpbnQ4QXJyYXkpXG4gICAgY29uc3QgZmluYWxQREYgPSBhd2FpdCB0ZW1wUERGLnNhdmUoKVxuICAgIHJldHVybiBmaW5hbFBERlxufVxuXG5cblxuXG5cblxuXG5cblxuXG5cbi8qKlxuICogREVMRVRFIEZpbGUgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICovIFxuIHJvdXRlci5wb3N0KCcvZGVsZXRlLzpzZXJ2ZXJuYW1lLzp0b2tlbicsIGFzeW5jIGZ1bmN0aW9uIChyZXEsIHJlcywgbmV4dCkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLnBhcmFtcy50b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBpZiAoIHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcnRva2VuICkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuXG4gIFxuICAgIGNvbnN0IGZpbGVwYXRoID0gcmVxLmJvZHkuZmlsZXBhdGhcbiAgICBpZiAoZmlsZXBhdGgpIHsgLy9yZXR1cm4gc3BlY2lmaWMgZmlsZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKXtcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ybShmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGZpbGVwYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmRlbGV0ZWRcIiksICB9KVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCBkZWxldGU6XCIsIGVycik7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IHN0YXR1czpcImVycm9yXCIsIHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlZXJyb3JcIikgfSlcbiAgICAgICAgfVxuICAgIH1cbn0pXG5cblxuXG5cblxuLyoqXG4gKiBHRVQgUERGIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAqLyBcblxucm91dGVyLnBvc3QoJy9nZXRwZGYvOnNlcnZlcm5hbWUvOnRva2VuJywgZnVuY3Rpb24gKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgY29uc3QgeyB0b2tlbiwgc2VydmVybmFtZSB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXTtcblxuICAgIC8vIFByXHUwMEZDZmVuLCBvYiBtY1NlcnZlciBleGlzdGllcnQgdW5kIGRlciBUb2tlbiBcdTAwRkNiZXJlaW5zdGltbXRcbiAgICBpZiAoIW1jU2VydmVyIHx8IHRva2VuICE9PSBtY1NlcnZlci5zZXJ2ZXJpbmZvPy5zZXJ2ZXJ0b2tlbikge1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBmaWxlbmFtZSB9ID0gcmVxLmJvZHk7XG4gICAgaWYgKGZpbGVuYW1lKSB7XG4gICAgICAgIHJlcy5zZW5kRmlsZShmaWxlbmFtZSwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS5maWxlZXJyb3JcIikgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFudHdvcnQsIGZhbGxzIGtlaW4gRGF0ZWluYW1lIGFuZ2VnZWJlbiB3dXJkZVxuICAgICAgICByZXMuc3RhdHVzKDQwMCkuanNvbih7IHN0YXR1czogdChcImRhdGEuZmlsZWVycm9yXCIpIH0pO1xuICAgIH1cbn0pO1xuXG5cblxuXG5cblxuLyoqXG4gKiBHRVQgQU5ZIEZpbGUvRm9sZGVyIGZyb20gRVhBTSBkaXJlY3RvcnkgLSBkb3dubG9hZCAhXG4gKiBDYW4gYmUgdHJpZ2dlcmVkIGJ5IFRFQUNIRVIgKGRhc2hib2FyZCBleHBsb3Jlcikgb3IgU1RVREVOVCAoZmlsZXJlcXVlc3QpXG4gKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gKi8gXG4gcm91dGVyLnBvc3QoJy9kb3dubG9hZC86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgdHlwZSA9IHJlcS5ib2R5LnR5cGUgIC8vIGZpbGUsIGRpciwgc3R1ZGVudGZpbGVyZXF1ZXN0XG4gICAgY29uc3QgZmlsZW5hbWUgPSByZXEuYm9keS5maWxlbmFtZVxuICAgIGNvbnN0IGZpbGVwYXRoID0gcmVxLmJvZHkucGF0aFxuICAgIGNvbnN0IGZpbGVzID0gcmVxLmJvZHkuZmlsZXMgIC8vIGluIGNhc2Ugb2Ygc3R1ZGVudGZpbGVyZXF1ZXN0ICdmaWxlcycgaXMgYW4gYXJyYXkgb2YgZmlsZW9iamVjdHMgWyB7bmFtZTpmaWxlLm5hbWUsIHBhdGg6ZmlsZS5wYXRoIH0sIHtuYW1lOmZpbGUubmFtZSwgcGF0aDpmaWxlLnBhdGggfSBdIFxuXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiAmJiAhY2hlY2tUb2tlbih0b2tlbiwgbWNTZXJ2ZXIgKSkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgXG5cbiAgIFxuICAgIGlmICh0eXBlID09PSBcInN0dWRlbnRmaWxlcmVxdWVzdFwiKSB7XG4gICAgICAgIC8vIGlmIHRoaXMgcmVxdWVzdCBjYW1lIGZyb20gYSBzdHVkZW50IHJlc2V0IHN0dWRlbnRzdGF0dXNcbiAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gdG9rZW4pIC8vIGdldCBzdHVkZW50IGZyb20gdG9rZW5cbiAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXSA9IGZhbHNlICAvL3Jlc2V0IGZpbGVyZXF1ZXN0IHN0YXR1cyBmb3Igc3R1ZGVudCAvLyBpdCBpcyB0aGVvcmV0aWNhbGx5IHBvc3NpYmxlIHRoYXQgdGhlIGNsaWVudCBzZW5kcyBhIHNlY29uZCBmaWxlIHJlcXVlc3QgYW5kIGZldGNoZXMgdGhlIGZpbGUgdHdpY2UgYmVmb3JlIHRoaXMgc2V0dGluZyBpcyByZXNldCBidXQgaSBndWVzcyB0aGlzIGRvZW4ndCByZWFsbHkgbWF0dGVyXG4gICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9IFtdICAgICAgICAgIC8vIHRoZXJlciBpcyBubyBjb250cm9sIHN5c3RlbSBpbiBwbGFjZSB0byByZS1jaGVjayBpZiB0aGUgZmlsZSB3YXMgYWN0dWFsbHkgcmVjZWl2ZWRcbiAgICAgICAgICAgIHJlcy56aXAoe2ZpbGVzOiBmaWxlc30pOyAgXG4gICAgICAgIH0gXG4gICAgfSAgXG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJmaWxlXCIpIHtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtZGlzcG9zaXRpb24nLCAnYXR0YWNobWVudDsgZmlsZW5hbWU9JyArIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHJlcy5kb3dubG9hZChmaWxlcGF0aCk7ICBcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gXCJkaXJcIikge1xuICAgICAgICAvL3ppcCBmb2xkZXIgYW5kIHRoZW4gc2VuZFxuICAgICAgICBsZXQgemlwZmlsZW5hbWUgPSBmaWxlbmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgICAgYXdhaXQgemlwRGlyZWN0b3J5KGZpbGVwYXRoLCB6aXBmaWxlcGF0aClcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsICdhdHRhY2htZW50OyBmaWxlbmFtZT0nICsgZmlsZW5hbWUpO1xuICAgICAgICByZXMuZG93bmxvYWQoemlwZmlsZXBhdGgsZmlsZW5hbWUpOyBcbiAgICB9XG4gXG59KVxuXG5cblxuXG5cbnJvdXRlci5wb3N0KCcvZ2V0ZXhhbW1hdGVyaWFscy86c2VydmVybmFtZS86dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5wYXJhbXMudG9rZW5cbiAgICBjb25zdCBzZXJ2ZXJuYW1lID0gcmVxLnBhcmFtcy5zZXJ2ZXJuYW1lXG4gICAgY29uc3QgbWNTZXJ2ZXIgPSBjb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV0gLy8gZ2V0IHRoZSBtdWx0aWNhc3RzZXJ2ZXIgb2JqZWN0XG4gICAgY29uc3QgZ3JvdXAgPSByZXEuYm9keS5ncm91cFxuXG4gICAgaWYgKCB0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiAmJiAhY2hlY2tUb2tlbih0b2tlbiwgbWNTZXJ2ZXIgKSkgeyByZXR1cm4gcmVzLmpzb24oeyBzdGF0dXM6IHQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgfSkgfVxuICAgXG5cbiAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSB0b2tlbikgLy8gZ2V0IHN0dWRlbnQgZnJvbSB0b2tlblxuICAgIGlmIChzdHVkZW50KSB7ICBcblxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzXG4gICAgICAgIGxldCBleGFtU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dXG4gICAgICAgIGxldCBncm91cEEgPSBleGFtU2VjdGlvbi5ncm91cEFcbiAgICAgICAgbGV0IGdyb3VwQiA9IGV4YW1TZWN0aW9uLmdyb3VwQlxuICAgIFxuICAgICAgICBsZXQgbWF0ZXJpYWxzID0gW11cbiAgICAgICAgbGV0IGFsbG93ZWRVcmxzID0gW11cbiAgICAgICAgaWYgKGdyb3VwID09PSBcImFcIikge1xuICAgICAgICAgICAgbWF0ZXJpYWxzID0gZ3JvdXBBLmV4YW1JbnN0cnVjdGlvbkZpbGVzXG4gICAgICAgICAgICBhbGxvd2VkVXJscyA9IGdyb3VwQS5hbGxvd2VkVXJsc1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGdyb3VwID09PSBcImJcIikge1xuICAgICAgICAgICAgbWF0ZXJpYWxzID0gZ3JvdXBCLmV4YW1JbnN0cnVjdGlvbkZpbGVzXG4gICAgICAgICAgICBhbGxvd2VkVXJscyA9IGdyb3VwQi5hbGxvd2VkVXJsc1xuICAgICAgICB9XG5cblxuICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtYXRlcmlhbHM6IG1hdGVyaWFscywgYWxsb3dlZFVybHM6IGFsbG93ZWRVcmxzICB9KVxuICAgIH0gXG4gICAgZWxzZSB7XG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwiZXJyb3JcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLnRva2Vubm90dmFsaWRcIikgIH0pXG4gICAgfVxuICAgIFxuXG4gXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG4vKipcbiAqIFN0b3JlcyBmaWxlKHMpIHRvIHRoZSB3b3JrZGlyZWN0b3J5IChmaWxlcyBjb21pbmcgRlJPTSBDTElFTlRTIChCQUNLVVBTKSApXG4gKiBAcGFyYW0gc3R1ZGVudHRva2VuIHRoZSBzdHVkZW50cyB0b2tlbiAtIHRoaXMgaGFzIHRvIGJlIHZhbGlkIChjb21pbmcgZnJvbSBhIHJlZ2lzdGVyZWQgdXNlcikgXG4gKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgc2VydmVyLWV4YW0gaW5zdGFuY2UgdGhlIHN0dWRlbnRzIHRva2VuIGJlbG9uZ3MgdG9cbiAqIGluIG9yZGVyIHRvIHByb2Nlc3MgdGhlIHJlcXVlc3QgLSBETyBOT1QgU1RPUkUgRklMRVMgQ09NSU5HIGZyb20gYW55d2hlcmUuLiBhbHdheXMgY2hlY2sgaWYgdG9rZW4gYmVsb25ncyB0byBhIHJlZ2lzdGVyZWQgc3R1ZGVudCAob3Igc2VydmVyKVxuICovXG4gcm91dGVyLnBvc3QoJy9yZWNlaXZlLzpzZXJ2ZXJuYW1lLzpzdHVkZW50dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHsgIFxuICAgIGNvbnN0IHN0dWRlbnR0b2tlbiA9IHJlcS5wYXJhbXMuc3R1ZGVudHRva2VuXG4gICAgY29uc3Qgc2VydmVybmFtZSA9IHJlcS5wYXJhbXMuc2VydmVybmFtZVxuICAgIGNvbnN0IG1jU2VydmVyID0gY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdIC8vIGdldCB0aGUgbXVsdGljYXN0c2VydmVyIG9iamVjdFxuICAgIGNvbnN0IHsgZmlsZSwgZmlsZW5hbWUgfSA9IHJlcS5ib2R5O1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gQnVmZmVyLmZyb20oZmlsZSwgJ2Jhc2U2NCcpO1xuXG4gICAgaWYgKCAhY2hlY2tUb2tlbihzdHVkZW50dG9rZW4sIG1jU2VydmVyICkgKSB7IHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbGV0IGVycm9ycyA9IDBcbiAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgICAgbGV0IHRpbWUgPSBub3cudG9Mb2NhbGVUaW1lU3RyaW5nKCdkZS1ERScpOyAgLy9jb252ZXJ0IHRvIGxvY2FsZSBzdHJpbmcgb3RoZXJ3aXNlIHRoZSBmb2xkZXJuYW1lcyB3aWxsIGJlIGNyZWF0ZWQgaW4gVVRDXG4gICAgICAgIGxldCB0aW1lc3RyaW5nID0gU3RyaW5nKHRpbWUpLnJlcGxhY2UoLzovZywgXCJfXCIpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgeWVhciA9IG5vdy5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCBtb250aCA9IFN0cmluZyhub3cuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyk7IC8vIE1vbmF0ZTogMC0xMSwgZGFoZXIgKzFcbiAgICAgICAgY29uc3QgZGF5ID0gU3RyaW5nKG5vdy5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgICAgIGNvbnN0IGRhdGVTdHJpbmcgPSBgJHt5ZWFyfSR7bW9udGh9JHtkYXl9YDtcbiAgICAgICAgXG4gICAgICAgIGxldCB0c3RyaW5nID0gYCR7ZGF0ZVN0cmluZ31fJHt0aW1lc3RyaW5nfWA7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3R1ZGVudCA9IG1jU2VydmVyLnN0dWRlbnRMaXN0LmZpbmQoZWxlbWVudCA9PiBlbGVtZW50LnRva2VuID09PSBzdHVkZW50dG9rZW4pIC8vIGdldCBzdHVkZW50IGZyb20gdG9rZW5cbiAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCBmaWxlbmFtZSk7XG4gICAgICAgIGxldCBzdHVkZW50ZGlyZWN0b3J5ID0gIHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50LmNsaWVudG5hbWUpXG4gICAgICAgIFxuICAgICAgICBsZXQgc3R1ZGVudGFyY2hpdmVkaXIgPSBwYXRoLmpvaW4oc3R1ZGVudGRpcmVjdG9yeSwgdHN0cmluZylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHN0dWRlbnRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3R1ZGVudGFyY2hpdmVkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImRhdGEgQCByZWNlaXZlOiBcIiwgZXJyKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGUpe1xuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuaW5jbHVkZXMoXCIuemlwXCIpKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImRhdGEgQCByZWNlaXZlOiBSZWNlaXZlZCBaSVAgRmlsZSBmcm9tIHVzZXI6XCIsIHN0dWRlbnQuY2xpZW50bmFtZSlcbiAgICAgICAgICAgICAgICBsZXQgc3VjY2VzcyA9IGF3YWl0IGFyY2hpdmVBbmRFeHRyYWN0WmlwKGFic29sdXRlRmlsZXBhdGgsIHN0dWRlbnRhcmNoaXZlZGlyLCBmaWxlQ29udGVudClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmJhY2t1cGRpcmVjdG9yeSAmJiBzdWNjZXNzKXsgICAgIC8vIGNvcHkgdG8gYmFja3VwIGRpcmVjdG9yeSAtIGRvIG5vdCB1bnppcCBhIHNlY29uZCB0aW1lIC0gdGhpcyBpcyBhbHJlYWR5IGRvbmUgaW4gYXJjaGl2ZUFuZEV4dHJhY3RaaXBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBiYWNrdXBkaXIgPSAgcGF0aC5qb2luKGNvbmZpZy5iYWNrdXBkaXJlY3RvcnksIG1jU2VydmVyLnNlcnZlcmluZm8uc2VydmVybmFtZSwgc3R1ZGVudC5jbGllbnRuYW1lLCB0c3RyaW5nKSAvLyBzYW1lIGNvbmNlcHQgYXMgaW4gc3R1ZGVudGFyY2hpdmVkaXJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBDb3B5aW5nIHRvIGJhY2t1cCBkaXJlY3Rvcnk6ICR7c3R1ZGVudGFyY2hpdmVkaXJ9IC0+ICAgJHtiYWNrdXBkaXJ9IGApXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihiYWNrdXBkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMuY3Aoc3R1ZGVudGFyY2hpdmVkaXIsIGJhY2t1cGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZTogXCIsIGVycilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcInN1Y2Nlc3NcIiwgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVyZWNlaXZlZFwiKSwgZXJyb3JzOiBlcnJvcnMgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZTogTm8gWklQIGZpbGUgcmVjZWl2ZWRcIilcbiAgICAgICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIiksIGVycm9yczogZXJyb3JzIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIiksIGVycm9yczogZXJyb3JzIH0pXG4gICAgICAgIH1cbiAgICB9XG59KVxuXG5cbi8qKlxuICogVVBMT0FEUyBGaWxlcyBmcm9tIHRoZSBUZWFjaGVyIEZyb250ZW5kIGFuZCBcbiAqIHN0b3JlcyB0aGUgZmlsZXMgaW50byB0aGUgd29ya2RpcmVjdG9yeVxuICogdGhlbiB1cGRhdGVzIHN0dWRlbnQuc3RhdHVzLmZldGNoZmlsZXMgaW4gb3JkZXIgdG8gdHJpZ2dlciBhIGZpbGVyZXF1ZXN0IGZyb20gdGhlIHN0dWRlbnQocykgXG4gKi9cblxucm91dGVyLnBvc3QoJy91cGxvYWQvOnNlcnZlcm5hbWUvOnNlcnZlcnRva2VuLzpzdHVkZW50dG9rZW4nLCBhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHsgIFxuICAgIGNvbnN0IHNlcnZlcnRva2VuID0gcmVxLnBhcmFtcy5zZXJ2ZXJ0b2tlblxuICAgIGNvbnN0IHNlcnZlcm5hbWUgPSByZXEucGFyYW1zLnNlcnZlcm5hbWVcbiAgICBjb25zdCBtY1NlcnZlciA9IGNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXSAvLyBnZXQgdGhlIG11bHRpY2FzdHNlcnZlciBvYmplY3RcbiAgICBjb25zdCBzdHVkZW50dG9rZW4gPSByZXEucGFyYW1zLnN0dWRlbnR0b2tlblxuXG4gICAgaWYgKCBzZXJ2ZXJ0b2tlbiAhPT0gbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJ0b2tlbiApIHsgcmV0dXJuIHJlcy5qc29uKHsgc3RhdHVzOiB0KFwiZGF0YS50b2tlbm5vdHZhbGlkXCIpIH0pIH1cblxuICAgIC8vIGNyZWF0ZSB1cGxvYWRzIGRpcmVjdG9yeVxuICAgIGxldCB1cGxvYWRkaXJlY3RvcnkgPSAgcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUsICdVUExPQURTJylcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcih1cGxvYWRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBEaXJlY3RvcnkgbWlnaHQgYWxyZWFkeSBleGlzdCwgdGhhdCdzIG9rXG4gICAgfVxuXG5cbiAgICBpZiAocmVxLmZpbGVzKXtcblxuICAgICAgICBsZXQgZmlsZXNBcnJheSA9IFtdICAvLyBkZXBlbmRpbmcgb24gdGhlIG51bWJlciBvZiBmaWxlcyB0aGlzIGNvbWVzIGFzIGFycmF5IG9mIG9iamVjdHMgb3Igb2JqZWN0XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyZXEuZmlsZXMuZmlsZXMpKXsgZmlsZXNBcnJheS5wdXNoKHJlcS5maWxlcy5maWxlcyl9XG4gICAgICAgIGVsc2Uge2ZpbGVzQXJyYXkgPSByZXEuZmlsZXMuZmlsZXN9XG5cbiAgICAgICAgbGV0IGZpbGVzID0gW10gICAgICAgIFxuICAgIFxuICAgICAgICBmb3IgYXdhaXQgKGxldCBmaWxlIG9mICBmaWxlc0FycmF5KSB7XG4gICAgICAgICAgICBsZXQgZmlsZW5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQoZmlsZS5uYW1lKSAgLy9lbmNvZGUgdG8gcHJldmVudCBub24tYXNjaWkgY2hhcnMgd2VpcmRuZXNzXG4gICAgICAgICAgICBsZXQgYWJzb2x1dGVGaWxlcGF0aCA9IHBhdGguam9pbih1cGxvYWRkaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGF3YWl0IGZpbGUubXYoYWJzb2x1dGVGaWxlcGF0aCwgKGVycikgPT4geyAgXG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoIHQoXCJkYXRhLmNvdWxkbm90c3RvcmVcIikgKSB9XG4gICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICBmaWxlcy5wdXNoKHsgbmFtZTpmaWxlbmFtZSAsIHBhdGg6YWJzb2x1dGVGaWxlcGF0aCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluZm9ybSBzdHVkZW50cyBhYm91dCB0aGlzIHNlbmQtZmlsZSByZXF1ZXN0IHNvIHRoYXQgdGhleSB0cmlnZ2VyIGEgZG93bmxvYWQgcmVxdWVzdCBmb3IgdGhlIGdpdmVuIGZpbGVzXG4gICAgICAgIGlmIChzdHVkZW50dG9rZW4gPT09IFwiYWxsXCIpe1xuICAgICAgICAgICAgZm9yIChsZXQgc3R1ZGVudCBvZiBtY1NlcnZlci5zdHVkZW50TGlzdCl7IFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ10gPSB0cnVlICBcbiAgICAgICAgICAgICAgICBzdHVkZW50LnN0YXR1c1snZmlsZXMnXSA9ICBmaWxlc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0dWRlbnR0b2tlbiA9PSBcImFcIiB8fCBzdHVkZW50dG9rZW4gPT0gXCJiXCIpe1xuICAgICAgICAgICAgbGV0IGdyb3VwQXJyYXkgPSBbXVxuICAgICAgICAgICAgaWYgKHN0dWRlbnR0b2tlbiA9PSBcImFcIil7Z3JvdXBBcnJheSA9IG1jU2VydmVyLnNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmFjdGl2ZVNlY3Rpb25dLmdyb3VwQS51c2VycyB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHRva2VuID09IFwiYlwiKXtncm91cEFycmF5ID0gbWNTZXJ2ZXIuc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1ttY1NlcnZlci5zZXJ2ZXJzdGF0dXMuYWN0aXZlU2VjdGlvbl0uZ3JvdXBCLnVzZXJzIH1cblxuICAgICAgICAgICAgaWYgKGdyb3VwQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IG5hbWUgb2YgZ3JvdXBBcnJheSl7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdHVkZW50ID0gbWNTZXJ2ZXIuc3R1ZGVudExpc3QuZmluZChlbGVtZW50ID0+IGVsZW1lbnQuY2xpZW50bmFtZSA9PT0gbmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZldGNoZmlsZXMnXT0gdHJ1ZSBcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmaWxlcyddID0gZmlsZXNcbiAgICAgICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXMuanNvbih7IHN0YXR1czpcImVycm9yXCIsICBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEubm9maWxlcmVjZWl2ZWRcIikgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0dWRlbnQgPSBtY1NlcnZlci5zdHVkZW50TGlzdC5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC50b2tlbiA9PT0gc3R1ZGVudHRva2VuKVxuICAgICAgICAgICAgaWYgKHN0dWRlbnQpIHsgIFxuICAgICAgICAgICAgICAgIHN0dWRlbnQuc3RhdHVzWydmZXRjaGZpbGVzJ109IHRydWUgXG4gICAgICAgICAgICAgICAgc3R1ZGVudC5zdGF0dXNbJ2ZpbGVzJ10gPSBmaWxlc1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9XG4gICAgICAgIHJlcy5qc29uKHsgc3RhdHVzOlwic3VjY2Vzc1wiLCBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXJlY2VpdmVkXCIpICB9KVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLmpzb24oeyBzdGF0dXM6XCJlcnJvclwiLCAgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOnQoXCJkYXRhLm5vZmlsZXJlY2VpdmVkXCIpIH0pXG4gICAgfVxuICAgIFxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgcm91dGVyXG5cbi8vIFNpbXBsZSBjb25jdXJyZW5jeSBsaW1pdGVyIGZvciBaSVAgZXh0cmFjdGlvblxuY29uc3QgTUFYX1BBUkFMTEVMX0VYVFJBQ1RTID0gNDsgLy8gbGltaXQgc2ltdWx0YW5lb3VzIGV4dHJhY3Rpb25zIHRvIHN0YWJpbGl6ZSBsYXRlbmN5XG5sZXQgcnVubmluZ0V4dHJhY3RzID0gMDtcbmNvbnN0IGV4dHJhY3RRdWV1ZSA9IFtdO1xuXG5mdW5jdGlvbiBydW5OZXh0RXh0cmFjdCgpIHtcbiAgICBpZiAocnVubmluZ0V4dHJhY3RzID49IE1BWF9QQVJBTExFTF9FWFRSQUNUUykgcmV0dXJuO1xuICAgIGNvbnN0IGpvYiA9IGV4dHJhY3RRdWV1ZS5zaGlmdCgpO1xuICAgIGlmICgham9iKSByZXR1cm47XG5cbiAgICBydW5uaW5nRXh0cmFjdHMrKztcbiAgICAvLyBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuXG4gICAgam9iKClcbiAgICAgICAgLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAvLyBjb25zdCBtcyA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gICAgICAgICAgICAvLyBsb2cuaW5mbyhgZGF0YSBAIGV4dHJhY3Q6IGZpbmlzaGVkIGluICR7bXN9bXMgKHJ1bm5pbmc9JHtydW5uaW5nRXh0cmFjdHMtMX0sIHF1ZXVlZD0ke2V4dHJhY3RRdWV1ZS5sZW5ndGh9KWApO1xuICAgICAgICAgICAgcnVubmluZ0V4dHJhY3RzLS07XG4gICAgICAgICAgICBzZXRJbW1lZGlhdGUocnVuTmV4dEV4dHJhY3QpO1xuICAgICAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXJjaGl2ZUFuZEV4dHJhY3RaaXAoYWJzb2x1dGVGaWxlcGF0aCwgc3R1ZGVudGFyY2hpdmVkaXIsIGZpbGVDb250ZW50KXtcbiAgICAvLyBsb2cuaW5mbyhgZGF0YSBAIHJlY2VpdmU6IFN0b3JpbmcgWmlwZmlsZSB0byAke2Fic29sdXRlRmlsZXBhdGh9YClcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBleGVjID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgZmlsZUNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oYGRhdGEgQCByZWNlaXZlOiBFeHRyYWN0aW5nIFppcGZpbGUgdG8gJHtzdHVkZW50YXJjaGl2ZWRpcn1gKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHtcbiAgICAgICAgICAgICAgICAgICAgZGlyOiBzdHVkZW50YXJjaGl2ZWRpcixcbiAgICAgICAgICAgICAgICAgICAgb25FbnRyeTogKGVudHJ5LCB6aXBmaWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGVudHJ5LmZpbGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldC5zdGFydHNXaXRoKHBhdGgubm9ybWFsaXplKHN0dWRlbnRhcmNoaXZlZGlyICsgcGF0aC5zZXApKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Jsb2NrZWQgcGF0aCB0cmF2ZXJzYWw6ICcgKyBlbnRyeS5maWxlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRyeSB7IGF3YWl0IGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBkYXRhIEAgcmVjZWl2ZTogU3VjY2Vzc2Z1bGx5IGV4dHJhY3RlZCBaSVAgZmlsZSB0byAke3N0dWRlbnRhcmNoaXZlZGlyfWApO1xuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJkYXRhIEAgcmVjZWl2ZSAoZXh0cmFjdCk6IFwiLCBlcnIpO1xuICAgICAgICAgICAgICAgIHRyeSB7IGF3YWl0IGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgfSBjYXRjaCAoZSkgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGV4dHJhY3RRdWV1ZS5wdXNoKGV4ZWMpO1xuICAgICAgICBpZiAocnVubmluZ0V4dHJhY3RzIDwgTUFYX1BBUkFMTEVMX0VYVFJBQ1RTKSBzZXRJbW1lZGlhdGUocnVuTmV4dEV4dHJhY3QpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgdG9rZW4gaXMgdmFsaWQgaW4gb3JkZXIgdG8gcHJvY2VzcyBhcGkgcmVxdWVzdFxuICogQXR0ZW50aW9uOiBubyBhbGwgYXBpIHJlcXVlc3RzIGNoZWNrIHRva2VucyBhdG0hXG4gKi9cbmZ1bmN0aW9uIGNoZWNrVG9rZW4odG9rZW4sIG1jc2VydmVyKXtcbiAgICBsZXQgdG9rZW5leGlzdHMgPSBmYWxzZVxuICAgIC8vIGxvZy5pbmZvKFwiZGF0YSBAIGNoZWNrVG9rZW46IGNoZWNraW5nIGlmIHN0dWRlbnQgaXMgcmVnaXN0ZXJlZCBvbiB0aGlzIHNlcnZlclwiKVxuICAgIHRyeSB7XG4gICAgICAgIG1jc2VydmVyLnN0dWRlbnRMaXN0LmZvckVhY2goIChzdHVkZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAodG9rZW4gPT09IHN0dWRlbnQudG9rZW4pIHtcbiAgICAgICAgICAgICAgICB0b2tlbmV4aXN0cyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNhdGNoKGVycil7XG4gICAgICAgIGxvZy5lcnJvcihgZGF0YTogJHtlcnJ9YClcbiAgICB9XG5cbiAgICByZXR1cm4gdG9rZW5leGlzdHNcbn1cblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBvdXRQYXRoOiAvcGF0aC90by9jcmVhdGVkLnppcFxuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIHppcERpcmVjdG9yeShzb3VyY2VEaXIsIG91dFBhdGgpIHtcbiAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGFyY2hpdmVcbiAgICAgICAgLmRpcmVjdG9yeShzb3VyY2VEaXIsIGZhbHNlKVxuICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICA7XG4gICAgICBzdHJlYW0ub24oJ2Nsb3NlJywgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICB9KTtcbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5cbmltcG9ydCBmcyBmcm9tICdmcydcbi8vaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vcmVuZGVyZXIvc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbi8vY29uc3QgeyB0IH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgaXBjTWFpbiwgZGlhbG9nIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBuZXR3b3JrSW50ZXJmYWNlcyB9IGZyb20gJ29zJ1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuXG5pbXBvcnQgc2VydmVyIGZyb20gXCIuLi8uLi9zZXJ2ZXIvc3JjL3NlcnZlci5qc1wiXG5pbXBvcnQgY2hlY2tEaXNrU3BhY2UgZnJvbSAnY2hlY2stZGlzay1zcGFjZSc7XG5cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5wcmludFF1ZXVlID0gW11cbiAgICAgICAgdGhpcy5pc1Byb2Nlc3NpbmdQcmludCA9IGZhbHNlXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByb2Nlc3MgcHJpbnQgcXVldWUgc2VxdWVudGlhbGx5IC0gb25lIGpvYiBhdCBhIHRpbWVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQcmludFF1ZXVlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcm9jZXNzaW5nUHJpbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vIEFscmVhZHkgcHJvY2Vzc2luZ1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmlzUHJvY2Vzc2luZ1ByaW50ID0gdHJ1ZTtcblxuICAgICAgICAgICAgd2hpbGUgKHRoaXMucHJpbnRRdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgam9iID0gdGhpcy5wcmludFF1ZXVlLnNoaWZ0KCk7IC8vIEdldCBmaXJzdCBqb2IgZnJvbSBxdWV1ZVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludFF1ZXVlOiBQcm9jZXNzaW5nIHByaW50IGpvYiAoJHt0aGlzLnByaW50UXVldWUubGVuZ3RofSByZW1haW5pbmcgaW4gcXVldWUpYCk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9wcm9jZXNzUHJpbnRKb2Ioam9iLmRvY0Jhc2U2NCwgam9iLnByaW50ZXJOYW1lLCBqb2IucHJldmlld1R5cGUpO1xuICAgICAgICAgICAgICAgICAgICBqb2IucmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50UXVldWU6IFByaW50IGpvYiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgam9iLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmlzUHJvY2Vzc2luZ1ByaW50ID0gZmFsc2U7XG4gICAgICAgICAgICBsb2cuaW5mbygnaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRRdWV1ZTogUHJpbnQgcXVldWUgZW1wdHksIHByb2Nlc3Npbmcgc3RvcHBlZCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQcm9jZXNzIGEgc2luZ2xlIHByaW50IGpvYiAtIHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIGFmdGVyIHByaW50IGNhbGxiYWNrIGNvbXBsZXRlc1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJvY2Vzc1ByaW50Sm9iID0gYXN5bmMgKGRvY0Jhc2U2NCwgcHJpbnRlck5hbWUsIHByZXZpZXdUeXBlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBoaWRkZW5XaW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB1c2VDb250ZW50U2l6ZTogdHJ1ZSwgLy8gRW5zdXJlIHdpZHRoL2hlaWdodCByZWZlcnMgdG8gY29udGVudCBhcmVhXG4gICAgICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbHVnaW5zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbUZhY3RvcjogMS4wICAvLyBGb3JjZSAxOjEgc2NhbGluZyB0byBpZ25vcmUgc3lzdGVtIHNjYWxlIGZhY3RvclxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gU2V0IHpvb20gZmFjdG9yIHRvIDEuMCB0byBpZ25vcmUgc3lzdGVtIERQSSBzY2FsaW5nIChmaXhlcyBDaHJvbWl1bSBwcmludCBidWcpXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLndlYkNvbnRlbnRzLnNldFpvb21GYWN0b3IoMS4wKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgZGF0YVVybCA9IGBgO1xuICAgICAgICAgICAgICAgIGlmIChwcmV2aWV3VHlwZSA9PT0gXCJwZGZcIikge1xuICAgICAgICAgICAgICAgICAgICBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2RvY0Jhc2U2NH1gO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocHJldmlld1R5cGUgPT09IFwiaW1hZ2VcIikge1xuICAgICAgICAgICAgICAgICAgICBkYXRhVXJsID0gYGRhdGE6aW1hZ2UvanBlZztiYXNlNjQsJHtkb2NCYXNlNjR9YDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2lwY2hhbmRsZXIgQCBfcHJvY2Vzc1ByaW50Sm9iOiBJbnZhbGlkIHByZXZpZXcgdHlwZSEnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0ludmFsaWQgcHJldmlldyB0eXBlJykpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLm9uKCdjbG9zZWQnLCAoKSA9PiB7IGhpZGRlbldpbiA9IG51bGw7IH0pO1xuXG4gICAgICAgICAgICAgICAgaGlkZGVuV2luLndlYkNvbnRlbnRzLm9uKCdkaWQtc3RvcC1sb2FkaW5nJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNQREZSZW5kZXJlZCA9IGF3YWl0IGhpZGRlbldpbi53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGFwc2VkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW50ZXJ2YWwgPSA1MDA7IC8vIENoZWNrIGV2ZXJ5IDUwMCBtc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gMjAwMDsgLy8gTWF4aW11bSAyIHNlY29uZHMgd2FpdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGVja1BERkxvYWRlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtYmVkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZW1iZWRbdHlwZT1cImFwcGxpY2F0aW9uL3BkZlwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaW1nJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbWJlZCAmJiBlbWJlZC5jbGllbnRIZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7IC8vIFBERiBpcyBhc3N1bWVkIHRvIGJlIGZ1bGx5IHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoaW1nICYmIGltZy5jbGllbnRIZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTsgLy8gSW1hZ2UgaXMgZnVsbHkgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChlbGFwc2VkID49IHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGZhbHNlKTsgLy8gVGltZSBleHBpcmVkLCBub3QgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZWxhcHNlZCArPSBpbnRlcnZhbDsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lciA9IHNldEludGVydmFsKGNoZWNrUERGTG9hZGVkLCBpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzUERGUmVuZGVyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IGJhc2U2NCAke3ByZXZpZXdUeXBlfSByZWNlaXZlZCAtIHByaW50aW5nIG9uOiAke3ByaW50ZXJOYW1lfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRpbWVvdXQgdG8gYXZvaWQgaGFuZ2luZyBxdWV1ZSB3aGVuIHByaW50IGNhbGxiYWNrIG5ldmVyIGZpcmVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJpbnRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IHByaW50IGpvYiB0aW1lb3V0IGZvciBwcmludGVyICR7cHJpbnRlck5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdQcmludCBqb2IgdGltZW91dCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCAxMDAwMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4ud2ViQ29udGVudHMucHJpbnQoeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lsZW50OiB0cnVlLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlTmFtZTogcHJpbnRlck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVGYWN0b3I6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2VzUGVyU2hlZXQ6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRwaToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9yaXpvbnRhbDogNjAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGljYWw6IDYwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblR5cGU6ICdub25lJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgKHN1Y2Nlc3MsIGZhaWx1cmVSZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHByaW50VGltZW91dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvZyBpZiBwcmludCBqb2Igd2FzIGhhbmRlZCBvdmVyIHRvIE9TIG9yIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IHByaW50IGpvYiBmYWlsZWQgZm9yIHByaW50ZXIgJHtwcmludGVyTmFtZX06ICR7ZmFpbHVyZVJlYXNvbiB8fCAndW5rbm93biByZWFzb24nfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoZmFpbHVyZVJlYXNvbiB8fCAnUHJpbnQgam9iIGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogcHJpbnQgam9iIHN1Y2Nlc3NmdWxseSBoYW5kZWQgb3ZlciB0byBPUyBmb3IgcHJpbnRlciAke3ByaW50ZXJOYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogUmVuZGVyaW5nL1ByaW50IGZhaWxlZCEnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGlkZGVuV2luICYmICFoaWRkZW5XaW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWRkZW5XaW4uY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUmVuZGVyaW5nL1ByaW50IGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIF9wcm9jZXNzUHJpbnRKb2I6IEVycm9yIGR1cmluZyBwcmludCBqb2I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoaWRkZW5XaW4gJiYgIWhpZGRlbldpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlkZGVuV2luLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBoaWRkZW5XaW4ubG9hZFVSTChkYXRhVXJsKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgX3Byb2Nlc3NQcmludEpvYjogRXJyb3IgbG9hZGluZyBVUkw6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhpZGRlbldpbiAmJiAhaGlkZGVuV2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpZGRlbldpbi5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9naW5CaVAnLCAoZXZlbnQsIGJpcHRlc3QpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvZ2luQmlQOiBvcGVuaW5nIGJpcCB3aW5kb3cuIHRlc3RlbnZpcm9ubWVudDpcIiwgYmlwdGVzdClcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KVxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gYmlwIGxvZ29uXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLy8gcmV0dXJucyB0aGUgY3VycmVudCBzZXJ2ZXJzdGF0dXMgb2JqZWN0IG9mIHRoZSBnaXZlbiBzZXJ2ZXIobmFtZSlcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHNlcnZlcnN0YXR1cycsIChldmVudCwgc2VydmVybmFtZSkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmIChtY1NlcnZlciApIHsgcmV0dXJuIG1jU2VydmVyLnNlcnZlcnN0YXR1cyAgfVxuICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICByZXR1cm4gZmFsc2UgIH1cbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvLyBzdG9wcyB0aGUgY3VycmVudCBleGFtIHNlcnZlciBcbiAgICAgICAgLy8gKHRoaXMgaXMgYSBjb3B5IG9mIHRoZSAvc3RvcHNlcnZlci86c2VydmVybmFtZSByb3V0ZSBpbiBjb250cm9sLmpzIClcbiAgICAgICAgLy8gcmV0aGluayBjb25jZXB0IHRoYXQgbG9jYWwgcmVxdWVzdHMgZ28gdG8gdGhlIEFQSSAodGhpcyBoYWQgYSBub24gZWxlY3Ryb24gc2VydmVyIHZlcnNpb24gaW4gbWluZCBidXQgbWFrZXMgbm8gc2Vuc2UgaW4gZWxlY3Ryb24gb25seSBhcHApXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdG9wc2VydmVyJywgKGV2ZW50LCBzZXJ2ZXJuYW1lKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgbWNTZXJ2ZXIgPSB0aGlzLmNvbmZpZy5leGFtU2VydmVyTGlzdFtzZXJ2ZXJuYW1lXVxuICAgICAgICAgICAgaWYgKG1jU2VydmVyICkgeyBcbiAgICAgICAgICAgICAgICBtY1NlcnZlci5icm9hZGNhc3RJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICBtY1NlcnZlci5zZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgY29uZmlnLmV4YW1TZXJ2ZXJMaXN0W3NlcnZlcm5hbWVdICAgIC8vZGVsZXRlIG1jU2VydmVyXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbVNlcnZlckxpc3QgPSB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdC5maWx0ZXIoZXhhbSA9PiBleGFtLnNlcnZlcm5hbWUgIT09IHNlcnZlcm5hbWUpICAvLyBtdWx0aWNhc3RjbGllbnQga2VlcHMgdHJhY2sgb2YgcnVubmluZyBzZXJ2ZXJzIGluIHRoZSBsYW5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICByZXR1cm4gZmFsc2UgIH1cbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvL3JldHVybiBjdXJyZW50IHN0dWRlbnRsaXN0XG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdHVkZW50bGlzdCcsIChldmVudCwgc2VydmVybmFtZSkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmIChtY1NlcnZlciApIHsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtzdHVkZW50bGlzdDogbWNTZXJ2ZXIuc3R1ZGVudExpc3R9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7c2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIHN0dWRlbnRsaXN0OiBbXX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkgXG5cblxuXG5cbiAgICAgICAgLy8gb3BlbnMgYSBsb2dpbndpbmRvdyBmb3IgbWljcm9zb2Z0IDM2NVxuICAgICAgICBpcGNNYWluLm9uKCdvcGVubXNhdXRoJywgKGV2ZW50KSA9PiB7IHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVNc2F1dGhXaW5kb3coKTsgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZSB9KSAgXG5cblxuICAgICAgICAvLyByZXR1cm5zIGN1cnJlbnQgY29uZmlnXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29weUNvbmZpZyhjb25maWcpOyBcbiAgICAgICAgfSkgIFxuXG5cbiAgICAgICAgLy8gcmV0dXJucyBjdXJyZW50IGNvbmZpZyBhc3luY1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0Y29uZmlnYXN5bmMnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29weUNvbmZpZyhjb25maWcpXG4gICAgICAgIH0pICBcblxuXG4gICAgICAgIC8vIGxvZyBvdXQgb2YgbWljcm9zb2Z0IDM2NVxuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVzZXRUb2tlbicsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHdpbiA9IHRoaXMuV2luZG93SGFuZGxlci5tYWlud2luZG93OyAvLyBPZGVyIHdpZSBhdWNoIGltbWVyIFNpZSBhdWYgSWhyIEJyb3dzZXJXaW5kb3ctT2JqZWt0IHp1Z3JlaWZlblxuICAgICAgICAgICAgaWYgKCF3aW4pIHJldHVybjtcblxuICAgICAgICAgICAgYXdhaXQgd2luLndlYkNvbnRlbnRzLnNlc3Npb24uY2xlYXJDYWNoZSgpO1xuICAgICAgICAgICAgYXdhaXQgd2luLndlYkNvbnRlbnRzLnNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7XG4gICAgICAgICAgICAgICAgc3RvcmFnZXM6IFsnY29va2llcyddXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25maWcuYWNjZXNzVG9rZW4gPSBmYWxzZVxuXG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCByZXNldFRva2VuOiBMb2dnZWQgb3V0IG9mIE9mZmljZTM2NVwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29weUNvbmZpZyhjb25maWcpOyAgLy8gd2UgY2FudCBqdXN0IGNvcHkgdGhlIGNvbmZpZyBiZWNhdXNlIGl0IGNvbnRhaW5zIGV4YW1TZXJ2ZXJMaXN0IHdoaWNoIGNvbnRhaW5zIGNvbmZpZyAoY2lyY3VsYXIgc3RydWN0dXJlKVxuICAgICAgICB9KSAgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogb3BlbnMgZmlsZSBpbiBleHRlcm5hbCBwcm9ncmFtIC0gcGxhdGZvcm0gZGVwZW5kZW50XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnb3BlbmZpbGUnLCAoZXZlbnQsIGZpbGVwYXRoKSA9PiB7ICBcbiAgICAgICAgICAgIGNvbnN0IGNtZCA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyBgc3RhcnQgXCIgXCIgXCIke2ZpbGVwYXRofVwiYCA6XG4gICAgICAgICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyA/IGBvcGVuIFwiJHtmaWxlcGF0aH1cImAgOlxuICAgICAgICAgICAgYHhkZy1vcGVuIFwiJHtmaWxlcGF0aH1cImA7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZXhlYyhjbWQsIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIG9wZW5maWxlOiBFcnJvciBvcGVuaW5nIFBERiBpbiBleHRlcm5hbCByZWFkZXI6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2lwY2hhbmRsZXIgQCBvcGVuZmlsZTogRmlsZSBvcGVuZWQgaW4gZXh0ZXJuYWwgcmVhZGVyJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignaXBjaGFuZGxlciBAIG9wZW5maWxlOiBFcnJvciBvcGVuaW5nIFBERjonLCBlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KSAgXG5cblxuICAgICAgICBpcGNNYWluLm9uKCdnZXRDdXJyZW50V29ya2RpcicsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gY29uZmlnLndvcmtkaXJlY3RvcnkgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY2hlY2tEaXNjc3BhY2UnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IGRpc2tTcGFjZSA9IGF3YWl0IGNoZWNrRGlza1NwYWNlKGNvbmZpZy53b3JrZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICBsZXQgZnJlZSA9IE1hdGgucm91bmQoZGlza1NwYWNlLmZyZWUgLyAxMDI0IC8gMTAyNCAvIDEwMjQgKiAxMDAwKSAvIDEwMDA7XG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBjaGVja0Rpc2tzcGFjZTpcIixkaXNrU3BhY2UpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZyZWU7ICAgIFxuICAgICAgICB9KTtcblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2V0YmFja3VwZGlyJywgYXN5bmMgKGV2ZW50LCBhcmcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyggdGhpcy5XaW5kb3dIYW5kbGVyLm1haW53aW5kb3csIHsgcHJvcGVydGllczogWydvcGVuRGlyZWN0b3J5J10gIH0pXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5jYW5jZWxlZCl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ2RpcmVjdG9yaWVzIHNlbGVjdGVkJywgcmVzdWx0LmZpbGVQYXRocylcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiXCJcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdGVzdGRpciA9IGpvaW4ocmVzdWx0LmZpbGVQYXRoc1swXSAgICwgY29uZmlnLnNlcnZlcmRpcmVjdG9yeSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRlc3RkaXIpKXtmcy5ta2RpclN5bmModGVzdGRpcil9XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcInN1Y2Nlc3NcIlxuICAgICAgICAgICAgICAgICAgICAvL2NvbmZpZy53b3JrZGlyZWN0b3J5ID0gdGVzdGRpclxuICAgICAgICAgICAgICAgICAgICBjb25maWcuYmFja3VwZGlyZWN0b3J5ID0gdGVzdGRpclxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzZXRiYWNrdXBkaXI6XCIsIGNvbmZpZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJlcnJvclwiXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4ge2JhY2t1cGRpcjogY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWVzc2FnZSA6IG1lc3NhZ2V9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge2JhY2t1cGRpcjogY29uZmlnLmJhY2t1cGRpcmVjdG9yeSwgbWVzc2FnZSA6ICdjYW5jZWxlZCd9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLm9uKCdzZXRQcmV2aW91c1dvcmtkaXInLCBhc3luYyAoZXZlbnQsIHdvcmtkaXIpID0+IHtcbiAgICAgICAgICAgIGlmICh3b3JrZGlyKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygncHJldmlvdXMgZGlyZWN0b3J5IHNlbGVjdGVkJywgd29ya2RpcilcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiXCJcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2Rpcikpe2ZzLm1rZGlyU3luYyh3b3JrZGlyKX1cbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IFwic3VjY2Vzc1wiXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy53b3JrZGlyZWN0b3J5ID0gd29ya2RpclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSl7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcImVycm9yXCJcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0ge3dvcmtkaXI6IGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtZXNzYWdlIDogbWVzc2FnZX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgZXZlbnQucmV0dXJuVmFsdWUgPSB7d29ya2RpcjogY29uZmlnLndvcmtkaXJlY3RvcnksIG1lc3NhZ2UgOiAnY2FuY2VsZWQnfSB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY3JlYXRlQmlwRXhhbWRpcmVjdG9yeScsIGFzeW5jIChldmVudCwgZXhhbSkgPT4ge1xuICAgICAgICAgICAgbGV0IG1lc3NhZ2UgPSBcIlwiXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgZXhhbS5leGFtTmFtZSlcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbih3b3JrZGlyLCAnc2VydmVyc3RhdHVzLmpzb24nKTtcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7ZnMubWtkaXJTeW5jKHdvcmtkaXIpfVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcInN1Y2Nlc3NcIlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHsgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShleGFtLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBKU09OIGJlZm9yZSB3cml0aW5nIHRvIHByZXZlbnQgaW52YWxpZCBKU09OIGZpbGVzXG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZShqc29uU3RyaW5nKTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBqc29uU3RyaW5nKTsgIFxuICAgICAgICAgICAgfSAgIC8vIHNhdmUgbWNTZXJ2ZXIuc2VydmVyc3RhdHVzIGFzIEpTT04gZmlsZVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7ICBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBjcmVhdGVCaXBFeGFtZGlyZWN0b3J5OiBKU09OIHZhbGlkYXRpb24gb3Igd3JpdGUgZmFpbGVkOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcImVycm9yXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0ge21lc3NhZ2UgOiBtZXNzYWdlfVxuXG4gICAgICAgIH0pXG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgTE9HIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGxvZycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IGpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBqb2luKHdvcmtkaXIsXCJuZXh0LWV4YW0tdGVhY2hlci5sb2dcIilcbiAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHNlcnZlcmxvZyA9IGRhdGEudHJpbSgpXG4gICAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgICAgICAgICAgIC5tYXAobGluZSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXFsoLis/KVxcXVxccytcXFsoLis/KVxcXVxccysoLiopJC8pO1xuICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFssIGRhdGUsIHR5cGUsIHJhd1RleHRdID0gbWF0Y2g7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBTZXQgY29sb3IgYmFzZWQgb24gbG9nIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbG9yO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHR5cGUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAnIzBhYTJjMCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICd3YXJuJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLXdhcm5pbmcpJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLWRhbmdlciknO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJ3ZhcigtLWJzLWN5YW4pJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gRGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNvdXJjZSA9ICduZXh0LWV4YW0nO1xuICAgICAgICAgICAgICAgICAgICBsZXQgdGV4dCA9IHJhd1RleHQ7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIGNvbG9uIGlzIHByZXNlbnQ6IGV2ZXJ5dGhpbmcgYmVmb3JlIHRoZSBmaXJzdCBjb2xvbiBhcyAnc291cmNlJ1xuICAgICAgICAgICAgICAgICAgICBpZiAocmF3VGV4dC5pbmNsdWRlcygnOicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb25JbmRleCA9IHJhd1RleHQuaW5kZXhPZignOicpO1xuICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IHJhd1RleHQuc3Vic3RyaW5nKDAsIGNvbG9uSW5kZXgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0ID0gcmF3VGV4dC5zdWJzdHJpbmcoY29sb25JbmRleCArIDEpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZGF0ZSwgdHlwZSwgdGV4dCwgY29sb3IsIHNvdXJjZSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbSAhPT0gbnVsbCk7XG5cblxuICAgICAgICAgICAgICAgIHJldHVybiBzZXJ2ZXJsb2dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRsb2c6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJldHVybnMgb2xkIGV4YW0gZm9sZGVycyBpbiB3b3JrZGlyZWN0b3J5XG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzY2FuV29ya2RpcicsIGFzeW5jIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICBsZXQgZXhhbWZvbGRlcnMgPSBbXSAvLyBhcnJheSBmb3IgcmVzdWx0c1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnkpKSB7IC8vIGNoZWNrIGlmIGJhc2UgZGlyIGV4aXN0c1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBmcy5yZWFkZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRpcm5hbWUgb2YgZm9sZGVycykgeyAvLyBpdGVyYXRlIG92ZXIgZGlyZWN0b3J5IG5hbWVzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1c1BhdGggPSBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBkaXJuYW1lLCAnc2VydmVyc3RhdHVzLmpzb24nKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXJ2ZXJzdGF0dXNQYXRoKSkgeyAvLyBjaGVjayBpZiBmaWxlIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyc3RhdHVzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2VydmVyc3RhdHVzUGF0aCwgJ3V0Zi04JykpIC8vIHBhcnNlIEpTT04gdG8gb2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlcnZlcnN0YXR1cy5leGFtTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1cy5leGFtTmFtZSA9IGRpcm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW1mb2xkZXJzLnB1c2goc2VydmVyc3RhdHVzKSAvLyBhZGQgb2JqZWN0IHRvIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNjYW5Xb3JrZGlyOiBFcnJvciBwYXJzaW5nIHNlcnZlcnN0YXR1cy5qc29uIGluICR7ZGlybmFtZX06YCwgZSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV4YW1mb2xkZXJzIC8vIHJldHVybiByZXN1bHRzXG4gICAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRlbGV0ZXMgb2xkIGV4YW0gZm9sZGVyIGluIHdvcmtkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdkZWxQcmV2aW91cycsIGFzeW5jIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICBsZXQgZXhhbWRpciA9IGpvaW4oIGNvbmZpZy53b3JrZGlyZWN0b3J5LCBhcmcpXG4gICAgICAgICAgICBpZiAoZnMuc3RhdFN5bmMoZXhhbWRpcikuaXNEaXJlY3RvcnkoKSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKGV4YW1kaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtsb2cuZXJyb3IoZSl9XG4gICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICByZXR1cm4gZXhhbWRpclxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqIEdldCBTcGVjaWZpYyBTdWJtaXNzaW9uIGJ5IGZpbGVwYXRoIGFzIGJhc2U2NCBzdHJpbmcgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFNwZWNpZmljU3VibWlzc2lvbkJhc2U2NCcsIGFzeW5jIChldmVudCwgZmlsZXBhdGgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VibWlzc2lvbiA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ2Jhc2U2NCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VibWlzc2lvbjogc3VibWlzc2lvbiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFNwZWNpZmljU3VibWlzc2lvbkJhc2U2NDogJHtlfWApXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VibWlzc2lvbjogZmFsc2UsIHN0YXR1czogXCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgbGF0ZXN0IHN1Ym1pc2lvbnMgZnJvbSBhbGwgc3R1ZGVudHNcbiAgICAgICAgICogcmV0dXJuIGFycmF5IG9mIG9iamVjdHMgd2l0aCBzdHVkZW50bmFtZSwgbGF0ZXN0ZmlsZXBhdGgsIGxhdGVzdGZpbGVuYW1lIGFuZCBzdWJtaXNzaW9uZGF0ZSAodGltZXN0YW1wKVxuICAgICAgICAgKiBAcGFyYW0gc2VydmVybmFtZSB0aGUgbmFtZSBvZiB0aGUgc2VydmVyIHRvIGdldCB0aGUgc3VibWlzc2lvbnMgZnJvbVxuICAgICAgICAgKiBAcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwic3VjY2Vzc1wiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBzdWJtaXNzaW9uczogc3VibWlzc2lvbnMgfVxuICAgICAgICAgKi9cbiAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0U3VibWlzc2lvbnMnLCBhc3luYyAoZXZlbnQsIHNlcnZlcm5hbWUsIGN1cnJlbnRzZXJ2ZXJzdGF0dXMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1cyA9IEpTT04ucGFyc2UoY3VycmVudHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIGlmICghbWNTZXJ2ZXIpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIHN1Ym1pc3Npb25zOiBbXSB9IH1cbiAgICAgICAgICAgIGxldCBzdWJtaXNzaW9ucyA9IFtdXG4gICAgICAgICAgICBsZXQgZGlyID0gIGpvaW4oIGNvbmZpZy53b3JrZGlyZWN0b3J5LCBtY1NlcnZlci5zZXJ2ZXJpbmZvLnNlcnZlcm5hbWUpO1xuICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGRpcikpIHsgLy8gY2hlY2sgaWYgYmFzZSBkaXIgZXhpc3RzXG4gICAgICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IGZzLnJlYWRkaXJTeW5jKGRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0RpcmVjdG9yeSgpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3R1ZGVudE5hbWUgb2YgZm9sZGVycykgeyAvLyBpdGVyYXRlIG92ZXIgZGlyZWN0b3J5IG5hbWVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHVkZW50TmFtZS50b1VwcGVyQ2FzZSgpID09PSAnVVBMT0FEUycpIHsgLy8gaWdub3JlIFVQTE9BRFMgZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc2VjdGlvbnMgPSB7fVxuICAgICAgICAgICAgICAgICAgICBsZXQgc3VibWlzc2lvbkRpciA9IGpvaW4oZGlyLCBzdHVkZW50TmFtZSwgXCJBQkdBQkVcIilcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGl0ZXJhdGUgb3ZlciBleGFtIHNlY3Rpb25zIDEtNFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBzZWN0aW9uID0gMTsgc2VjdGlvbiA8PSA0OyBzZWN0aW9uKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzZWN0aW9uRGlyID0gam9pbihzdWJtaXNzaW9uRGlyLCBTdHJpbmcoc2VjdGlvbikpXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluaXRpYWxpemUgc2VjdGlvbiB3aXRoIGRlZmF1bHQgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9uc1tzZWN0aW9uXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25uYW1lOiBcIlwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHNlY3Rpb25EaXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNlY3Rpb25GaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHNlY3Rpb25EaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpIC8vIG9ubHkgZmlsZXMsIG5vdCBkaXJlY3Rvcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VjdGlvbkZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxhdGVzdFN1Ym1pc3Npb24gPSBzZWN0aW9uRmlsZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVQYXRoID0gam9pbihzZWN0aW9uRGlyLCBmaWxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGZpbGUsIG10aW1lOiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWUgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLm10aW1lIC0gYS5tdGltZSlbMF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25zW3NlY3Rpb25dID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogam9pbihzZWN0aW9uRGlyLCBsYXRlc3RTdWJtaXNzaW9uLmZpbGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGxhdGVzdFN1Ym1pc3Npb24uZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGU6IGxhdGVzdFN1Ym1pc3Npb24ubXRpbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9ubmFtZTogc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZWN0aW9uXS5zZWN0aW9ubmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9ucy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWRlbnROYW1lOiBzdHVkZW50TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb25zOiBzZWN0aW9uc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWJtaXNzaW9uc1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGxhdGVzdCBiYWsgZmlsZSBmcm9tIHNwZWNpZmljIHN0dWRlbnQgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0TGF0ZXN0QmFrRmlsZScsIGFzeW5jIChldmVudCwgc2VydmVybmFtZSwgc3R1ZGVudE5hbWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1jU2VydmVyID0gdGhpcy5jb25maWcuZXhhbVNlcnZlckxpc3Rbc2VydmVybmFtZV1cbiAgICAgICAgICAgIGlmICghbWNTZXJ2ZXIpIHsgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwibm90Zm91bmRcIiwgc3RhdHVzOiBcImVycm9yXCIsIGZpbGVwYXRoOiBmYWxzZSB9IH1cbiAgICAgICAgICAgIGxldCBsYXRlc3RCYWtGaWxlID0gbnVsbFxuICAgICAgICAgICAgbGV0IGRpciA9ICBqb2luKCBjb25maWcud29ya2RpcmVjdG9yeSwgbWNTZXJ2ZXIuc2VydmVyaW5mby5zZXJ2ZXJuYW1lLCBzdHVkZW50TmFtZSk7XG4gICAgXG4gICAgICAgICAgICAvL2NoZWNrIGlmIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UgfSB9XG5cbiAgICAgICAgICAgIC8vaW4gdGhlIHN0dWRlbnQgZGlyZWN0cm95IHRoZXJlIGFyZSBzZXZlcmFsIGJhY2t1cCBkaXJlY3RvcmllcyAgdGhhdCBjb250YWluIGEgYmFrIGZpbGUgLzIwMjUxMTEyXzEwXzIwXzEzL1xuICAgICAgICAgICAgLy8gdGhlIGJha2ZpbGUgbmFtaW5nIHNjaGVtZSBpcyBzdHVkZW50bmFtZS5iYWsgLi4uIHdlIG9ubHkgbmVlZCB0aGUgbGF0ZXN0IG9uZSB0aGF0IGhhcyB0aGUgc3R1ZGVudG5hbWUgYXMgZmlsZW5hbWVcbiAgICAgICAgICAgIC8vIGlnbm9yZSBkaXJlY3RvcmllczogQUJHQUJFIGFuZCBmb2N1c2xvc3RcbiAgICAgICAgICAgIGNvbnN0IGJhY2t1cERpcmVjdG9yaWVzID0gZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNEaXJlY3RvcnkoKSAmJiBkaXJlbnQubmFtZSAhPT0gJ0FCR0FCRScgJiYgZGlyZW50Lm5hbWUgIT09ICdmb2N1c2xvc3QnKVxuICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVQYXRoID0gam9pbihkaXIsIGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBuYW1lOiBkaXJlbnQubmFtZSwgbXRpbWU6IGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZSB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5tdGltZSAtIGEubXRpbWUpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChiYWNrdXBEaXJlY3Rvcmllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwic2VydmVyXCIsIG1lc3NhZ2U6XCJub3Rmb3VuZFwiLCBzdGF0dXM6IFwiZXJyb3JcIiwgZmlsZXBhdGg6IGZhbHNlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGxhdGVzdEJhY2t1cERpcmVjdG9yeSA9IGJhY2t1cERpcmVjdG9yaWVzWzBdLm5hbWVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldExhdGVzdEJha0ZpbGU6IFNlYXJjaGluZyBmb3IgbGF0ZXN0IGJhY2t1cCBmaWxlIGluOlwiLCBkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSlcbiAgICAgICAgICAgIGNvbnN0IGxhdGVzdEJha0ZpbGVwYXRoID0gam9pbihkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSwgc3R1ZGVudE5hbWUgKyAnLmJhaycpXG4gICAgICAgICAgICBjb25zdCBsYXRlc3RCYWNrdXBEaXJlY3RvcnlQYXRoID0gam9pbihkaXIsIGxhdGVzdEJhY2t1cERpcmVjdG9yeSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy9nZXQgbGF0ZXN0IGJhayBmaWxlICAtIGNoZWNrIGlmIGZpbGUgZXhpc3RzXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobGF0ZXN0QmFrRmlsZXBhdGgpKSB7IHJldHVybiB7IHNlbmRlcjogXCJzZXJ2ZXJcIiwgbWVzc2FnZTpcIm5vdGZvdW5kXCIsIHN0YXR1czogXCJlcnJvclwiLCBmaWxlcGF0aDogZmFsc2UsIGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGg6bGF0ZXN0QmFja3VwRGlyZWN0b3J5UGF0aCB8fCBmYWxzZSB9IH1cbiAgICAgICAgICAgIC8vcmV0dXJuIHRoZSBleGlzdGluZyBhbmQgY2hlY2tlZCBmaWxlcGF0aCBvciBpZiBubyBmaWxlIHdhcyBmb3VuZCBmYWxzZVxuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcInNlcnZlclwiLCBtZXNzYWdlOlwic3VjY2Vzc1wiLCBzdGF0dXM6IFwic3VjY2Vzc1wiLCBmaWxlcGF0aDogbGF0ZXN0QmFrRmlsZXBhdGgsIGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGg6IGxhdGVzdEJhY2t1cERpcmVjdG9yeVBhdGggfVxuXG4gICAgICAgIH0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IHN5c3RlbSBwcmludGVyc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHByaW50ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJpbnRlcnMgPSBhd2FpdCB0aGlzLldpbmRvd0hhbmRsZXIubWFpbndpbmRvdy53ZWJDb250ZW50cy5nZXRQcmludGVyc0FzeW5jKCk7XG4gICAgICAgICAgICAvL2xvZy5pbmZvKCdpcGNoYW5kbGVyIEAgZ2V0cHJpbnRlcnM6IHByaW50ZXJzJywgcHJpbnRlcnMpXG4gICAgICAgICAgICBjb25zdCBwcmludGVyRGF0YSA9IHByaW50ZXJzLm1hcChwcmludGVyID0+ICh7XG4gICAgICAgICAgICAgICAgcHJpbnRlck5hbWU6IHByaW50ZXIubmFtZSxcbiAgICAgICAgICAgICAgICBpc0RlZmF1bHQ6IHByaW50ZXJzLmxlbmd0aCA9PT0gMSA/IHRydWUgOiBwcmludGVyLmlzRGVmYXVsdCwgLy8gZGVwcmVjYXRlZCBpbiBlbGVjdHJvbiAzNiwgc2V0IHRvIHRydWUgaWYgb25seSBvbmUgcHJpbnRlclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBwcmludGVyLmRlc2NyaXB0aW9uXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcmludGVyRGF0YVxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByaW50IGEgRG9jdW1lbnQgYXMgYmFzZTY0IHN0cmluZyB2aWEgd2ViY29udGVudHMucHJpbnQoKSB3aXRob3V0IHNwZWNpZmljIHBsYXRmb3JtZGVwZW5kZW50IGxpYnJhcmllc1xuICAgICAgICAgKiBJTkZPOiBpdCBpcyBjdXJyZW50bHkgbm90IHBvc3NpYmxlIHRvIGdldCBhIFwiZmluaXNoZWQtcmVuZGVyaW5nXCIgZXZlbnQgZnJvbSB0aGUgY2hyb21lLXBkZi1wbHVnaW4uIHRoZXJlZm9yZSB0aW1lb3V0cyBhcmUgdXNlZCBhcyBhIHdvcmthcm91bmRcbiAgICAgICAgICogVXNlcyBhIHByaW50IHF1ZXVlIHRvIGhhbmRsZSBtdWx0aXBsZSBzaW11bHRhbmVvdXMgcmVxdWVzdHMgc2VxdWVudGlhbGx5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncHJpbnRCYXNlNjQnLCBhc3luYyAoZXZlbnQsIGRvY0Jhc2U2NCwgcHJpbnRlck5hbWUsIHByZXZpZXdUeXBlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBqb2IgdG8gcXVldWVcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmludFF1ZXVlLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jQmFzZTY0LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRlck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aWV3VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBwcmludEJhc2U2NDogUHJpbnQgcmVxdWVzdCBhZGRlZCB0byBxdWV1ZSAoJHt0aGlzLnByaW50UXVldWUubGVuZ3RofSBqb2JzIGluIHF1ZXVlKWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFN0YXJ0IHF1ZXVlIHByb2Nlc3NpbmcgaWYgbm90IGFscmVhZHkgcnVubmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNQcm9jZXNzaW5nUHJpbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Byb2Nlc3NQcmludFF1ZXVlKCkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRCYXNlNjQ6IFF1ZXVlIHByb2Nlc3NpbmcgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgcHJpbnRCYXNlNjQ6IHJldHVybmluZyBlcnJvciB0byByZW5kZXJlcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgYXZhaWxhYmxlIG5ldHdvcmsgaW50ZXJmYWNlcyB3aXRoIElQIGFkZHJlc3Nlc1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlcyA9IG5ldHdvcmtJbnRlcmZhY2VzKClcbiAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyA9IG51bGxcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgSVB2NCBhZGRyZXNzZXNcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGludGVyZmFjZXMpLmZvckVhY2goKGludGVyZmFjZU5hbWUpID0+IHtcbiAgICAgICAgICAgICAgICBpbnRlcmZhY2VzW2ludGVyZmFjZU5hbWVdLmZvckVhY2goKGlmYWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgbG9vcGJhY2sgYW5kIGxvY2FsIGFkZHJlc3Nlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWZhY2UuZmFtaWx5ID09PSAnSVB2NCcgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgICAhaWZhY2UuYWRkcmVzcy5zdGFydHNXaXRoKCcxMjcuJykgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgICAhaWZhY2UuYWRkcmVzcy5zdGFydHNXaXRoKCcxNjkuMjU0LicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaW50ZXJmYWNlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBpZmFjZS5hZGRyZXNzXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIG9sZCBJUCBhZGRyZXNzXG4gICAgICAgICAgICBjb25zdCBvbGRIb3N0SXAgPSB0aGlzLmNvbmZpZy5ob3N0aXBcblxuICAgICAgICAgICAgLy8gSWYgYSBwcmVmZXJyZWQgaW50ZXJmYWNlIGlzIHNldCwgdXNlIGl0IHRvIHF1aWNrbHkgZ2V0IGFuIElQXG4gICAgICAgICAgICBpZiAodGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmZXJyZWQgPSB0aGlzLmF2YWlsYWJsZUludGVyZmFjZXM/LmZpbmQoaWZhY2UgPT4gaWZhY2UubmFtZSA9PT0gdGhpcy5wcmVmZXJyZWRJbnRlcmZhY2UpXG4gICAgICAgICAgICAgICAgaWYgKHByZWZlcnJlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBwcmVmZXJyZWQuYWRkcmVzc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBwcmVmZXJyZWQubmFtZVxuICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBhIGdhdGV3YXkgZXhpc3RzIGZvciB0aGUgcHJlZmVycmVkIGludGVyZmFjZVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qge2dhdGV3YXksIHZlcnNpb24sIGludH0gPSBnYXRld2F5NHN5bmMocHJlZmVycmVkLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gaW50ID09PSB0aGlzLnByZWZlcnJlZEludGVyZmFjZVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge2dhdGV3YXksIHZlcnNpb24sIGludH0gPSAgZ2F0ZXdheTRzeW5jKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpbnQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IGludFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIC8vdGhpcyBkZWxpdmVycyBhbiBpcCBldmVuIGlmIGdhdGV3YXkgaXMgbm90IHNldCAtIHRoZSBmaXJzdCBpcCBhZGRyZXNzIG9mIHRoZSBzeXN0ZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVzZSB0aGlzIGFkZHJlc3MgdG8gZmluZCB0aGUgbmFtZSBvZiB0aGUgaW50ZXJmYWNlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gT2JqZWN0LmtleXMoaW50ZXJmYWNlcykuZmluZChrZXkgPT4gaW50ZXJmYWNlc1trZXldLnNvbWUoaWZhY2UgPT4gaWZhY2UuYWRkcmVzcyA9PT0gdGhpcy5jb25maWcuaG9zdGlwKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmludGVyZmFjZSA9IGludGVyZmFjZU5hbWVcblxuICAgICAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogVW5hYmxlIHRvIGRldGVybWluZSBpcCBhZGRyZXNzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5pbnRlcmZhY2UgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIG11bHRpY2FzdCBjbGllbnQgaXMgcnVubmluZyAtIG90aGVyd2lzZSBzdGFydCBpdFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PSBcIjEyNy4wLjAuMVwiKSB7IHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIElQIGhhcyBjaGFuZ2VkIGFuZCByZWluaXRpYWxpemUgZXZlcnl0aGluZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgICAgIGlmIChvbGRIb3N0SXAgIT09IHRoaXMuY29uZmlnLmhvc3RpcCAmJiB0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogSVAgY2hhbmdlZCBmcm9tICR7b2xkSG9zdElwfSB0byAke3RoaXMuY29uZmlnLmhvc3RpcH0sIHJlaW5pdGlhbGl6aW5nIHNlcnZpY2VzLi4uYClcblxuICAgICAgICAgICAgICAgIC8vIFJlaW5pdGlhbGl6ZSBtdWx0aWNhc3QgY2xpZW50IG9uIElQIGNoYW5nZSAobXVsdGljYXN0Y2xpZW50IGlzIG9ubHkgdXNlZCBmb3IgZGlzY292ZXJ5IG9mIG90aGVyIGV4YW0gc2VydmVycylcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKSkgeyAvLyBjaGVjayBpZiBtdWx0aWNhc3QgY2xpZW50IGlzIGFjdHVhbGx5IHJ1bm5pbmdcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LnN0b3AoKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ21haW46IE11bHRpY2FzdCBjbGllbnQgcmVpbml0aWFsaXplZCcpXG4gICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW46IEZhaWxlZCB0byByZWluaXRpYWxpemUgbXVsdGljYXN0IGNsaWVudDonLCBlKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVzdGFydCBFeHByZXNzIHNlcnZlciBvbiBJUCBjaGFuZ2VcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXIubGlzdGVuaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuY2xvc2UoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtYWluOiBFeHByZXNzIHNlcnZlciBzdG9wcGVkIGR1ZSB0byBJUCBjaGFuZ2VgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5saXN0ZW4oY29uZmlnLnNlcnZlckFwaVBvcnQsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYG1haW46IEV4cHJlc3Mgc2VydmVyIHJlc3RhcnRlZCBvbiBodHRwczovLyR7Y29uZmlnLmhvc3RpcH06JHtjb25maWcuc2VydmVyQXBpUG9ydH1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5saXN0ZW4oY29uZmlnLnNlcnZlckFwaVBvcnQsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbWFpbjogRXhwcmVzcyBzZXJ2ZXIgc3RhcnRlZCBvbiBodHRwczovLyR7Y29uZmlnLmhvc3RpcH06JHtjb25maWcuc2VydmVyQXBpUG9ydH1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAvLyBlbHNlIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudC5hZGRyZXNzKCkpIHsgIC8vIElmIG5vIElQIGNoYW5nZSBidXQgbXVsdGljYXN0IGNsaWVudCBpcyBub3QgcnVubmluZ1xuICAgICAgICAgICAgLy8gICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSlcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgXG4gICAgICAgICAgICAgICAgaG9zdGlwOiB0aGlzLmNvbmZpZy5ob3N0aXAsIFxuICAgICAgICAgICAgICAgIGludGVyZmFjZTogdGhpcy5jb25maWcuaW50ZXJmYWNlLFxuICAgICAgICAgICAgICAgIGF2YWlsYWJsZUludGVyZmFjZXM6IHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRJbnRlcmZhY2U6IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIGRvZXMgd2hhdCBpdCBzYXlzLi4gIGlmIG1vcmUgdGhhbiBvbmUgaW50ZXJmYWNlIGlzIGZvdW5kIHRoaXMgd2lsbCBzZXQgdGhlIHByZWZlcnJlZCBpbnRlcmZhY2VcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NldFByZWZlcnJlZEludGVyZmFjZScsIChldmVudCwgYXJnKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByZWZlcnJlZEludGVyZmFjZSA9IGFyZ1xuICAgICAgICB9KVxuXG4gICAgICAgIGlwY01haW4ub24oJ3Vuc2V0UHJlZmVycmVkSW50ZXJmYWNlJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByZWZlcnJlZEludGVyZmFjZSA9IGZhbHNlXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgXG4gICAgICAgICAgICAgICAgaG9zdGlwOiB0aGlzLmNvbmZpZy5ob3N0aXAsIFxuICAgICAgICAgICAgICAgIGludGVyZmFjZTogdGhpcy5jb25maWcuaW50ZXJmYWNlLFxuICAgICAgICAgICAgICAgIGF2YWlsYWJsZUludGVyZmFjZXM6IHRoaXMuYXZhaWxhYmxlSW50ZXJmYWNlcyxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRJbnRlcmZhY2U6IHRoaXMucHJlZmVycmVkSW50ZXJmYWNlIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEb3dubG9hZHMgdGhlIGZpbGVzIGZvciBhIHNwZWNpZmljIHN0dWRlbnQgdG8gaGlzIHdvcmtkaXJlY3RvcnkgKGFiZ2FiZSlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3N0b3JlT25lZHJpdmVGaWxlcycsIGFzeW5jIChldmVudCwgYXJncykgPT4geyBcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiZG93bmxvYWRpbmcgb25lZHJpdmUgZmlsZXMuLi5cIikgIFxuICAgICAgICAgICAgY29uc3Qgc3R1ZGVudE5hbWUgPSBhcmdzLnN0dWRlbnROYW1lXG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NUb2tlbiA9IGFyZ3MuYWNjZXNzVG9rZW5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gYXJncy5maWxlTmFtZVxuICAgICAgICAgICAgY29uc3QgZmlsZUlEID0gYXJncy5maWxlSURcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcblxuICAgICAgICAgICAgLy8gY3JlYXRlIHVzZXIgYWJnYWJlIGRpcmVjdG9yeSAgLy8gY3JlYXRlIGFyY2hpdmUgZGlyZWN0b3J5XG4gICAgICAgICAgICBsZXQgc3R1ZGVudGRpcmVjdG9yeSA9ICBqb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBzZXJ2ZXJuYW1lICxzdHVkZW50TmFtZSlcbiAgICAgICAgICAgIGxldCB0aW1lID0gbmV3IERhdGUobmV3IERhdGUoKS5nZXRUaW1lKCkpLnRvTG9jYWxlVGltZVN0cmluZygpOyAgLy9jb252ZXJ0IHRvIGxvY2FsZSBzdHJpbmcgb3RoZXJ3aXNlIHRoZSBmb2xkZXJuYW1lcyB3aWxsIGJlIGNyZWF0ZWQgaW4gVVRDXG4gICAgICAgICAgICBsZXQgdHN0cmluZyA9IFN0cmluZyh0aW1lKS5yZXBsYWNlKC86L2csIFwiX1wiKTtcbiAgICAgICAgICAgIGxldCBzdHVkZW50YXJjaGl2ZWRpciA9IGpvaW4oc3R1ZGVudGRpcmVjdG9yeSwgdHN0cmluZylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc3R1ZGVudGRpcmVjdG9yeSkpIHsgZnMubWtkaXJTeW5jKHN0dWRlbnRkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfVxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzdHVkZW50YXJjaGl2ZWRpcikpeyBmcy5ta2RpclN5bmMoc3R1ZGVudGFyY2hpdmVkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfVxuICAgICAgICAgXG5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVSZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20vdjEuMC9tZS9kcml2ZS9pdGVtcy8ke2ZpbGVJRH0vY29udGVudGAsIHtcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7YWNjZXNzVG9rZW59YCwgIH0sXG4gICAgICAgICAgICB9KS5jYXRjaCggZXJyID0+IHtsb2cuZXJyb3IoZXJyKX0pO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVCdWZmZXIgPSBhd2FpdCBmaWxlUmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGZpbGVOYW1lKSwgQnVmZmVyLmZyb20oZmlsZUJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge2xvZy5lcnJvcihlKX1cblxuICAgICAgICAgICAgY29uc3QgcGRmRmlsZVJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vZ3JhcGgubWljcm9zb2Z0LmNvbS92MS4wL21lL2RyaXZlL2l0ZW1zLyR7ZmlsZUlEfS9jb250ZW50P2Zvcm1hdD1wZGZgLCB7XG4gICAgICAgICAgICAgICAgaGVhZGVyczogeydBdXRob3JpemF0aW9uJzogYEJlYXJlciAke2FjY2Vzc1Rva2VufWAsICB9LFxuICAgICAgICAgICAgfSkuY2F0Y2goIGVyciA9PiB7bG9nLmVycm9yKGVycil9KTtcblxuICAgICAgICAgICAgaWYgKHBkZkZpbGVSZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBkZkZpbGVCdWZmZXIgPSBhd2FpdCBwZGZGaWxlUmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwZGZGaWxlUGF0aCA9IGpvaW4oc3R1ZGVudGFyY2hpdmVkaXIsIGAke2ZpbGVOYW1lfS5wZGZgKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBkZkZpbGVQYXRoLCBCdWZmZXIuZnJvbShwZGZGaWxlQnVmZmVyKSk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBEb3dubG9hZGVkICR7ZmlsZU5hbWV9IGFuZCAke2ZpbGVOYW1lfS5wZGZgKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7bG9nLmVycm9yKGUpfSAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJ0aGVyZSB3YXMgYSBwcm9ibGVtIGRvd25sb2FkaW5nIHRoZSBmaWxlcyBhcyBwZGZcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9KVxuXG5cblxuICAgIH1cblxuICAgIGlzUGRmVXJsKHVybCkge1xuICAgICAgICBsZXQgcGRmID0gZmFsc2VcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgcGRmID0gIHVybC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcucGRmJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXI6IGlzUGRmVXJsOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGRmXG4gICAgfVxuXG4gICAgY29weUNvbmZpZyhjb25mKSB7XG4gICAgICAgIGxldCBjb25maWdDb3B5ID0ge1xuICAgICAgICAgICAgZGV2ZWxvcG1lbnQ6IGNvbmYuZGV2ZWxvcG1lbnQsIFxuICAgICAgICAgICAgc2hvd2RldnRvb2xzOiBjb25mLnNob3dkZXZ0b29scyxcbiAgICAgICAgICAgIGJpcEludGVncmF0aW9uOiBjb25mLmJpcEludGVncmF0aW9uLFxuICAgICAgICAgICAgYmlwRGVtbzogY29uZi5iaXBEZW1vLFxuICAgICAgICAgICAgd29ya2RpcmVjdG9yeTogY29uZi53b3JrZGlyZWN0b3J5LFxuICAgICAgICAgICAgdGVtcGRpcmVjdG9yeTogY29uZi50ZW1wZGlyZWN0b3J5LFxuICAgICAgICAgICAgc2VydmVyZGlyZWN0b3J5OiBjb25mLnNlcnZlcmRpcmVjdG9yeSxcbiAgICAgICAgICAgXG4gICAgICAgICAgICBzZXJ2ZXJBcGlQb3J0OiBjb25mLnNlcnZlckFwaVBvcnQsXG4gICAgICAgICAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiBjb25mLm11bHRpY2FzdENsaWVudFBvcnQsXG4gICAgICAgICAgICBtdWx0aWNhc3RTZXJ2ZXJDbGllbnRQb3J0OiBjb25mLm11bHRpY2FzdFNlcnZlckNsaWVudFBvcnQsXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbXVsdGljYXN0U2VydmVyQWRycjogY29uZi5tdWx0aWNhc3RTZXJ2ZXJBZHJyLFxuICAgICAgICAgICAgaG9zdGlwOiBjb25mLmhvc3RpcCxcbiAgICAgICAgICAgIGdhdGV3YXk6IGNvbmYuZ2F0ZXdheSxcbiAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBjb25mLmFjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgdmVyc2lvbjogY29uZi52ZXJzaW9uLFxuICAgICAgICAgICAgaW5mbzogY29uZi5pbmZvLFxuICAgICAgICAgICAgYnVpbGRmb3JXRUI6IGNvbmYuYnVpbGRmb3JXRUIsXG4gICAgICAgICAgICBleGFtbW9kZXM6IGNvbmYuZXhhbW1vZGVzXG4gICAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbmZpZ0NvcHlcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFzQkEsT0FBT0EsVUFBUztBQUNoQixPQUFPLFdBQVc7QUFDbEIsU0FBUyxPQUFBQyxNQUFLLGlCQUFBQyxnQkFBZSxrQkFBa0IsYUFBYSxnQkFBZ0IsWUFBWTs7O0FDcEJ4RixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGdCQUFnQjtBQUFBLEVBQ2hCLFdBQVc7QUFBQSxFQUVYLGVBQWdCO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUNqQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUEsRUFDZixxQkFBcUI7QUFBQSxFQUNyQiwyQkFBMkI7QUFBQSxFQUUzQixxQkFBcUI7QUFBQSxFQUNyQixRQUFRO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxFQUNiLFNBQVM7QUFBQSxFQUVULFdBQVc7QUFBQSxJQUNQLEtBQUs7QUFBQSxJQUNMLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLGNBQWM7QUFBQSxFQUNsQjtBQUFBLEVBRUEsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsYUFBYTtBQUFBLEVBQ2IsTUFBTTtBQUNWO0FBQ0EsSUFBTyxpQkFBUTs7O0FDMUJmLE9BQU8sYUFBYTtBQUNwQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sZ0JBQWdCOzs7QUNIdkIsU0FBUyxVQUFBQyxlQUFjOzs7QUNBdkIsU0FBUyxjQUFjOzs7QUNBdkIsU0FBUyxvQkFBb0I7QUFFN0IsT0FBTyxZQUFZO0FBQ25CLE9BQU8sU0FBUzs7O0FDcEJoQixTQUFTLG9CQUFvQjtBQUV0QixJQUFNLG1CQUFOLGNBQStCLGFBQWE7QUFBQSxFQUUvQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFFQSxZQUFZLFFBQW9CLElBQVk7QUFDeEMsVUFBTTtBQUNOLFNBQUssU0FBUztBQUNkLFNBQUssU0FBUztBQUNkLFNBQUssV0FBVztBQUNoQixTQUFLLFlBQVksV0FBVyxLQUFLLE1BQU07QUFBQSxFQUMzQztBQUFBLEVBRU8sUUFBUTtBQUNYLFFBQUksQ0FBQyxLQUFLLFFBQVE7QUFDZCxXQUFLLFNBQVMsWUFBWSxNQUFNLEtBQUssS0FBSyxTQUFTLEdBQUcsS0FBSyxRQUFRO0FBQUEsSUFDdkU7QUFBQSxFQUNKO0FBQUEsRUFFTyxPQUFPO0FBQ1YsUUFBSSxLQUFLLFFBQVE7QUFDYixvQkFBYyxLQUFLLE1BQU07QUFDekIsV0FBSyxTQUFTO0FBQUEsSUFDbEI7QUFBQSxFQUNKO0FBQ0o7OztBREFBLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxXQUFXO0FBQ2hCLFNBQUssYUFBYSxlQUFPO0FBQ3pCLFNBQUssaUJBQWlCLGVBQU87QUFDN0IsU0FBSyxTQUFTO0FBQ2QsU0FBSyxhQUFhO0FBQ2xCLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssVUFBVTtBQUNmLFNBQUssY0FBYyxDQUFDO0FBQ3BCLFNBQUssZUFBZSxDQUFDO0FBQUEsRUFDekI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxLQUFNLFlBQVksS0FBSyxVQUFVLE1BQUksT0FBTyxRQUFNLE1BQU07QUFDcEQsU0FBSyxTQUFTLGFBQWEsTUFBTTtBQUNqQyxTQUFLLGFBQWE7QUFBQSxNQUNkO0FBQUE7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsV0FBVztBQUFBLE1BQ1gsSUFBSSxRQUFRLFFBQVEsT0FBTyxXQUFXO0FBQUEsTUFDdEMsSUFBSSxlQUFPO0FBQUEsTUFDWCxhQUFhLFVBQVUsT0FBTyxXQUFXLENBQUM7QUFBQSxNQUMxQztBQUFBLE1BQ0EsU0FBUyxlQUFPO0FBQUEsSUFDcEI7QUFFQSxTQUFLLE9BQU8sS0FBSyxLQUFLLFVBQVMsV0FBWSxNQUFNO0FBQzdDLFdBQUssT0FBTyxhQUFhLElBQUk7QUFDN0IsV0FBSyxPQUFPLGdCQUFnQixHQUFHO0FBQy9CLFdBQUssT0FBTyxPQUFPLEdBQUc7QUFDdEIsV0FBSyxPQUFPLGNBQWMsS0FBSyxjQUFjO0FBSTdDLFdBQUssb0JBQW9CLElBQUksaUJBQWlCLEtBQUsscUJBQXFCLEtBQUssSUFBSSxHQUFHLEdBQUk7QUFDeEYsV0FBSyxrQkFBa0IsTUFBTTtBQUc3QixVQUFJLEtBQUssNkRBQTZELGVBQU8sTUFBTSxJQUFJLEtBQUssT0FBTyxRQUFRLEVBQUUsSUFBSSxFQUFFO0FBQUEsSUFDdkgsQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHVCQUF3QjtBQUNwQixTQUFLLFdBQVcsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUMvQyxRQUFJLFVBQVU7QUFBQSxNQUNWLFlBQVksS0FBSyxXQUFXO0FBQUEsTUFDNUIsV0FBVyxLQUFLLFdBQVc7QUFBQSxNQUMzQixJQUFJLEtBQUssV0FBVztBQUFBLE1BQ3BCLElBQUksS0FBSyxXQUFXO0FBQUEsTUFDcEIsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNyQixTQUFTLGVBQU87QUFBQSxJQUNwQjtBQUNBLFVBQU0sa0JBQWtCLElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxPQUFPLENBQUM7QUFDL0QsU0FBSyxPQUFPLEtBQUssaUJBQWlCLEdBQUcsZ0JBQWdCLFFBQVEsS0FBSyxZQUFZLEtBQUssY0FBYztBQUNqRyxTQUFLLE9BQU8sS0FBSyxpQkFBaUIsR0FBRyxnQkFBZ0IsUUFBUSxlQUFPLDJCQUEyQixLQUFLLGNBQWM7QUFBQSxFQUN0SDtBQUNKO0FBRUEsSUFBTywwQkFBUTs7O0FFL0VmLE9BQU8sV0FBVztBQUVsQixPQUFPQyxVQUFTO0FBT2hCLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNsQixjQUFlO0FBQ1gsU0FBSyxPQUFPLGVBQU87QUFDbkIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyxpQkFBaUIsQ0FBQztBQUN2QixTQUFLLHdCQUF3QjtBQUFBLEVBQ2pDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLEtBQU0sU0FBUztBQUNYLFNBQUssVUFBVTtBQUNmLFFBQUk7QUFDQSxXQUFLLFNBQVMsTUFBTSxhQUFhLE1BQU07QUFDdkMsV0FBSyxPQUFPLEtBQUssS0FBSyxNQUFNLFdBQVcsTUFBTTtBQUN6QyxhQUFLLE9BQU8sYUFBYSxJQUFJO0FBQzdCLGFBQUssT0FBTyxnQkFBZ0IsR0FBRztBQUMvQixZQUFJLEtBQUssU0FBUztBQUFFLGVBQUssT0FBTyxjQUFjLEtBQUssY0FBYztBQUFBLFFBQUU7QUFDbkUsWUFBSSxDQUFDLEtBQUssU0FBUztBQUFDLFVBQUFDLEtBQUksS0FBSyw4RkFBOEY7QUFBQSxRQUFDO0FBQzVILFFBQUFBLEtBQUksS0FBSyw2REFBNkQsZUFBTyxNQUFNLElBQUksS0FBSyxPQUFPLFFBQVEsRUFBRSxJQUFJLEVBQUU7QUFBQSxNQUN2SCxDQUFDO0FBQUEsSUFDTCxTQUNPLEtBQUk7QUFBQyxNQUFBQSxLQUFJLE1BQU0sR0FBRztBQUFBLElBQUM7QUFFMUIsU0FBSyxPQUFPLEdBQUcsV0FBVyxDQUFDLFNBQVMsVUFBVTtBQUFFLFdBQUssZ0JBQWdCLFNBQVMsS0FBSztBQUFBLElBQUUsQ0FBQztBQUd0RixTQUFLLHdCQUF3QixJQUFJLGlCQUFpQixLQUFLLHFCQUFxQixLQUFLLElBQUksR0FBRyxHQUFJO0FBQzVGLFNBQUssc0JBQXNCLE1BQU07QUFBQSxFQUdyQztBQUFBLEVBRUEsTUFBTSxPQUFRO0FBQ1YsUUFBSTtBQUNBLFdBQUssT0FBTyxlQUFlLEtBQUssY0FBYztBQUFBLElBQ2xELFNBQVEsR0FBRTtBQUFBLElBQUM7QUFDWCxTQUFLLE9BQU8sTUFBTTtBQUNsQixRQUFJLEtBQUssc0JBQXVCLE1BQUssc0JBQXNCLEtBQUs7QUFDaEUsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLGdCQUFpQixTQUFTLE9BQU87QUFDN0IsVUFBTSxhQUFhLEtBQUssTUFBTSxPQUFPLE9BQU8sQ0FBQztBQUM3QyxlQUFXLFdBQVcsTUFBTTtBQUM1QixlQUFXLGFBQWEsTUFBTTtBQUM5QixlQUFXLGFBQVksb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFFMUMsUUFBSSxLQUFLLGtCQUFrQixVQUFVLEdBQUc7QUFDcEMsTUFBQUEsS0FBSSxLQUFLLGdFQUFnRSxXQUFXLFVBQVUsaUJBQWlCO0FBQy9HLFdBQUssZUFBZSxLQUFLLFVBQVU7QUFBQSxJQUN2QztBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGtCQUFtQixLQUFLO0FBQ3BCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxlQUFlLFFBQVEsS0FBSztBQUNqRCxVQUFJLEtBQUssZUFBZSxDQUFDLEVBQUUsT0FBTyxJQUFJLElBQUk7QUFDdEMsYUFBSyxlQUFlLENBQUMsRUFBRSxZQUFZLElBQUk7QUFDdkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKO0FBQ0EsV0FBTztBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLHVCQUF3QjtBQUNwQixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssZUFBZSxRQUFRLEtBQUs7QUFDakQsWUFBTSxPQUFNLG9CQUFJLEtBQUssR0FBRSxRQUFRO0FBQy9CLFVBQUksTUFBTSxPQUFRLEtBQUssZUFBZSxDQUFDLEVBQUUsV0FBVztBQUNoRCxRQUFBQSxLQUFJLEtBQUsscUVBQXFFLEtBQUssZUFBZSxDQUFDLEVBQUUsVUFBVSxhQUFhO0FBQzVILGFBQUssZUFBZSxPQUFPLEdBQUcsQ0FBQztBQUFBLE1BQ25DO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSjtBQUVBLElBQU8sMEJBQVEsSUFBSSxnQkFBZ0I7OztBSDdGbkMsT0FBT0MsYUFBWTtBQUVuQixPQUFPQyxXQUFVOzs7QUl0QmpCLFNBQVMsa0JBQWtCOzs7QUNEM0I7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFFWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVTtBQUFBLElBQ1YsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVM7QUFBQSxJQUNULFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUN6UkE7QUFBQSxFQUNJLFNBQVc7QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULElBQU07QUFBQSxJQUNOLFNBQVc7QUFBQSxFQUNmO0FBQUEsRUFDQSxZQUFlO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFDWjtBQUFBLEVBQ0EsYUFBZ0I7QUFBQSxJQUNaLFdBQWE7QUFBQSxJQUNiLE9BQVM7QUFBQSxJQUNULFFBQVU7QUFBQSxJQUNWLFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUNkLFFBQVU7QUFBQSxJQUNWLGtCQUFxQjtBQUFBLElBQ3JCLGdCQUFrQjtBQUFBLElBQ2xCLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixnQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLGtCQUFvQjtBQUFBLElBQ3BCLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsRUFDM0I7QUFBQSxFQUNBLFdBQVk7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGlCQUFtQjtBQUFBLElBQ25CLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLEtBQU87QUFBQSxJQUNQLFdBQWE7QUFBQSxJQUNiLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsb0JBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsY0FBZ0I7QUFBQSxJQUNoQixrQkFBb0I7QUFBQSxJQUNwQixXQUFhO0FBQUEsSUFDYixnQkFBa0I7QUFBQSxJQUNsQixlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLG9CQUFzQjtBQUFBLElBQ3RCLFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsVUFBWTtBQUFBLElBQ1osZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixVQUFZO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsSUFDUixjQUFnQjtBQUFBLElBQ2hCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsSUFDaEIsV0FBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsUUFBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsUUFBUztBQUFBLElBQ1QsWUFBYTtBQUFBLElBQ2IsU0FBVTtBQUFBLElBQ1YsWUFBYTtBQUFBLElBQ2IsZ0JBQWtCO0FBQUEsSUFDbEIsT0FBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1AsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFlBQWM7QUFBQSxJQUNkLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxJQUNmLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixPQUFTO0FBQUEsSUFDVCxjQUFnQjtBQUFBLElBQ2hCLG1CQUFxQjtBQUFBLElBQ3JCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsVUFBVztBQUFBLElBQ1gsVUFBWTtBQUFBLElBQ1osYUFBZTtBQUFBLElBQ2YsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QseUJBQTJCO0FBQUEsSUFDM0IsWUFBYztBQUFBLElBQ2QsWUFBYztBQUFBLElBQ2Qsb0JBQXNCO0FBQUEsSUFDdEIsa0JBQW9CO0FBQUEsSUFDcEIsU0FBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2Qsa0JBQW9CO0FBQUEsSUFDcEIsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsZ0JBQWdCO0FBQUEsSUFDaEIsaUJBQWlCO0FBQUEsSUFDakIsaUJBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsSUFBTTtBQUFBLElBQ04sSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsSUFBSztBQUFBLElBQ0wsWUFBYTtBQUFBLElBQ2Isb0JBQXFCO0FBQUEsSUFDckIsZ0JBQWlCO0FBQUEsSUFDakIsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxrQkFBcUI7QUFBQSxJQUNyQixjQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLElBQ3JCLFNBQVU7QUFBQSxJQUNWLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLGlCQUFrQjtBQUFBLElBQ2xCLG9CQUFxQjtBQUFBLElBQ3JCLGdCQUFpQjtBQUFBLElBQ2pCLGVBQWdCO0FBQUEsSUFDaEIscUJBQXNCO0FBQUEsSUFDdEIsUUFBVTtBQUFBLElBQ1YsY0FBZTtBQUFBLElBQ2Ysa0JBQW1CO0FBQUEsSUFDbkIsU0FBVztBQUFBLElBQ1gsaUJBQWtCO0FBQUEsSUFDbEIsYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsZ0JBQWtCO0FBQUEsSUFDbEIsa0JBQW9CO0FBQUEsSUFDcEIsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsTUFBUTtBQUFBLElBQ1IsS0FBTztBQUFBLElBQ1Asa0JBQW9CO0FBQUEsSUFDcEIsWUFBYztBQUFBLElBQ2QsY0FBZ0I7QUFBQSxJQUNoQixjQUFnQjtBQUFBLElBQ2hCLGdCQUFrQjtBQUFBLElBQ2xCLHdCQUEwQjtBQUFBLElBQzFCLHdCQUEwQjtBQUFBLElBQzFCLFFBQVU7QUFBQSxJQUNWLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLFNBQVc7QUFBQSxJQUNYLFdBQWE7QUFBQSxJQUNiLGtCQUFvQjtBQUFBLElBQ3BCLGNBQWdCO0FBQUEsSUFDaEIsa0JBQW9CO0FBQUEsSUFDcEIsSUFBSztBQUFBLElBQ0wsS0FBTTtBQUFBLElBQ04sVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osaUJBQWtCO0FBQUEsSUFDbEIsaUJBQWtCO0FBQUEsSUFDbEIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixZQUFjO0FBQUEsSUFDZCxtQkFBcUI7QUFBQSxJQUNyQixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixRQUFVO0FBQUEsSUFDVixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxnQkFBa0I7QUFBQSxJQUNsQix1QkFBeUI7QUFBQSxJQUN6QixLQUFPO0FBQUEsSUFDUCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLFdBQWE7QUFBQSxJQUNiLGdCQUFrQjtBQUFBLElBQ2xCLGdCQUFrQjtBQUFBLElBQ2xCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsaUJBQW1CO0FBQUEsSUFDbkIscUJBQXVCO0FBQUEsSUFDdkIsZUFBaUI7QUFBQSxJQUNqQixpQkFBbUI7QUFBQSxJQUNuQixxQkFBdUI7QUFBQSxJQUN2QixpQkFBbUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxJQUNqQixxQkFBdUI7QUFBQSxJQUN2QixhQUFlO0FBQUEsSUFDZixtQkFBcUI7QUFBQSxJQUNyQixZQUFjO0FBQUEsSUFDZCxjQUFnQjtBQUFBLElBQ2hCLGlCQUFtQjtBQUFBLElBQ25CLGVBQWlCO0FBQUEsSUFDakIsZUFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGFBQWU7QUFBQSxJQUNmLGFBQWU7QUFBQSxJQUNmLGtCQUFvQjtBQUFBLElBQ3BCLGFBQWU7QUFBQSxFQUduQjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osZUFBaUI7QUFBQSxJQUNqQixRQUFVO0FBQUEsSUFDVixTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDSCxjQUFnQjtBQUFBLElBQ2hCLGVBQWlCO0FBQUEsSUFDakIsZ0JBQWtCO0FBQUEsSUFDbEIsaUJBQW1CO0FBQUEsSUFDbkIsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsY0FBZ0I7QUFBQSxJQUNoQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsRUFDWjtBQUNKOzs7QUZuUkEsSUFBTSxPQUFPLFdBQVc7QUFBQSxFQUNwQixRQUFRO0FBQUEsRUFDUixnQkFBZ0I7QUFBQSxFQUNoQixRQUFRO0FBQUEsRUFDUixVQUFVO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBQSxFQUNBO0FBQ0osQ0FBQztBQUVILElBQU8sa0JBQVE7OztBSlNmLE9BQU9DLFNBQVE7QUFDZixPQUFPLFFBQVE7QUFDZixPQUFPLFdBQVc7OztBTzVCbEIsU0FBUyxVQUFVLCtCQUErQjtBQUczQyxJQUFNLGFBQWE7QUFBQSxFQUN4QixNQUFNO0FBQUEsSUFDSixVQUFVO0FBQUEsSUFDVixXQUFXO0FBQUEsSUFDWCxhQUFhO0FBQUEsSUFDYix1QkFBdUI7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDSixlQUFlO0FBQUEsTUFDWCxnQkFBZ0IsQ0FBQyxPQUFpQixTQUFpQixnQkFBeUI7QUFDeEUsWUFBSSxhQUFhO0FBQ2I7QUFBQSxRQUNKO0FBQ0EsZ0JBQVEsT0FBTztBQUFBLFVBQ1gsS0FBSyxTQUFTO0FBQ1Ysb0JBQVEsTUFBTSxPQUFPO0FBQ3JCO0FBQUEsVUFDSixLQUFLLFNBQVM7QUFDVixvQkFBUSxLQUFLLE9BQU87QUFDcEI7QUFBQSxVQUNKLEtBQUssU0FBUztBQUNWLG9CQUFRLE1BQU0sT0FBTztBQUNyQjtBQUFBLFVBQ0osS0FBSyxTQUFTO0FBQ1Ysb0JBQVEsS0FBSyxPQUFPO0FBQ3BCO0FBQUEsVUFDSjtBQUNJO0FBQUEsUUFDUjtBQUFBLE1BQ0o7QUFBQSxNQUNBLFVBQVUsU0FBUztBQUFBLElBQ3ZCO0FBQUEsRUFDSjtBQUNGO0FBRU8sSUFBTSxlQUFlLElBQUksd0JBQXdCLFVBQVU7OztBUFhsRSxPQUFPQyxVQUFTOzs7QVFaaEIsT0FBTyxRQUFRO0FBQ2YsU0FBUyxLQUFLLGVBQWUsUUFBUSxjQUFjO0FBQ25ELFNBQVMsWUFBWTtBQUNyQixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFDOUIsT0FBT0MsVUFBUztBQUVoQixJQUFNLFlBQVksWUFBWTtBQUc5QixTQUFTLGdCQUFnQjtBQUN2QixNQUFJLElBQUksWUFBWTtBQUNsQixVQUFNLFdBQVcsS0FBSyxRQUFRLGVBQWUscUJBQXFCLFFBQVE7QUFDMUUsV0FBTyxHQUFHLFdBQVcsUUFBUSxJQUFJLFdBQVcsS0FBSyxRQUFRLGVBQWUsbUJBQW1CO0FBQUEsRUFDN0Y7QUFDQSxTQUFPLEtBQUssV0FBVyxpQkFBaUI7QUFDMUM7QUFHQSxTQUFTLHVCQUF1QjtBQUM5QixNQUFJLElBQUksWUFBWTtBQUNsQixVQUFNLFdBQVcsS0FBSyxRQUFRLGVBQWUscUJBQXFCLFVBQVUsWUFBWTtBQUN4RixRQUFJLEdBQUcsV0FBVyxRQUFRLEVBQUcsUUFBTztBQUFBLEVBQ3RDO0FBQ0EsUUFBTUMsY0FBYSxLQUFLLFdBQVcsVUFBVSxZQUFZO0FBQ3pELE1BQUksR0FBRyxXQUFXQSxXQUFVLEVBQUcsUUFBT0E7QUFDdEMsUUFBTSxtQkFBbUIsS0FBSyxXQUFXLFFBQVEsWUFBWSxZQUFZO0FBQ3pFLE1BQUksR0FBRyxXQUFXLGdCQUFnQixFQUFHLFFBQU87QUFDNUMsUUFBTSxhQUFhLEtBQUssV0FBVyxZQUFZO0FBQy9DLE1BQUksR0FBRyxXQUFXLFVBQVUsRUFBRyxRQUFPO0FBQ3RDLFNBQU8sS0FBSyxXQUFXLHdCQUF3QjtBQUNqRDtBQUVBLElBQU0sZ0JBQU4sTUFBb0I7QUFBQSxFQUNoQixjQUFlO0FBQ2IsU0FBSyxhQUFhO0FBQ2xCLFNBQUssYUFBYTtBQUNsQixTQUFLLFNBQVM7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGtCQUFrQjtBQUFBLEVBR3pCO0FBQUEsRUFFQSxLQUFNLElBQUlDLFNBQVE7QUFDZCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVNBO0FBQUEsRUFDbEI7QUFBQSxFQUtBLGtCQUFrQixTQUFTO0FBQ3ZCLFNBQUssWUFBWSxJQUFJLGNBQWM7QUFBQSxNQUMvQixPQUFPO0FBQUEsTUFDUCxNQUFNLEtBQUssY0FBYyxHQUFHLFNBQVMsVUFBVTtBQUFBLE1BQy9DLFFBQU87QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQLFFBQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLGFBQVk7QUFBQSxNQUNaLGlCQUFpQjtBQUFBO0FBQUEsTUFFakIsYUFBYTtBQUFBO0FBQUE7QUFBQSxNQUdiLE1BQU07QUFBQTtBQUFBLElBRVYsQ0FBQztBQUVELFFBQUksU0FBUTtBQUFJLFdBQUssVUFBVSxRQUFRLG1HQUFtRztBQUFBLElBQUksT0FDekk7QUFBVyxXQUFLLFVBQVUsUUFBUSxxR0FBcUc7QUFBQSxJQUFJO0FBR2hKLFNBQUssVUFBVSxZQUFZLEtBQUssbUJBQW1CLE1BQU07QUFDckQsVUFBSSxLQUFLLGFBQWEsQ0FBQyxLQUFLLFVBQVUsVUFBVSxHQUFHO0FBQy9DLGFBQUssVUFBVSxLQUFLO0FBQUEsTUFDeEI7QUFBQSxJQUNKLENBQUM7QUFFRCxTQUFLLFVBQVUsWUFBWSxHQUFHLGdCQUFnQixDQUFDLE9BQU8sUUFBUTtBQUMxRCxNQUFBRixLQUFJLEtBQUssY0FBYztBQUN2QixNQUFBQSxLQUFJLEtBQUssR0FBRztBQUFBLElBQ2hCLENBQUM7QUFDRCxTQUFLLFVBQVUsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sUUFBUTtBQUMzRCxNQUFBQSxLQUFJLEtBQUssZUFBZTtBQUN4QixNQUFBQSxLQUFJLEtBQUssR0FBRztBQUFBLElBQ2hCLENBQUM7QUFFQSxTQUFLLFVBQVUsWUFBWSxHQUFHLGNBQWMsQ0FBQyxPQUFPLFFBQVE7QUFDekQsTUFBQUEsS0FBSSxLQUFLLFlBQVk7QUFDckIsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFDWixZQUFNLGVBQWU7QUFBQSxJQUN6QixDQUFDO0FBR0EsU0FBSyxVQUFVLFlBQVkscUJBQXFCLENBQUMsRUFBRSxJQUFJLE1BQU07QUFDMUQsTUFBQUEsS0FBSSxLQUFLLGdCQUFnQjtBQUN6QixNQUFBQSxLQUFJLEtBQUssR0FBRztBQUNaLGFBQU8sRUFBRSxRQUFRLE9BQU87QUFBQSxJQUM1QixDQUFDO0FBRUQsU0FBSyxVQUFVLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDM0QsTUFBQUEsS0FBSSxLQUFLLG1CQUFtQixHQUFHO0FBRS9CLFVBQUksSUFBSSxXQUFXLG1CQUFtQixHQUFHO0FBQ3JDLGNBQU0sZUFBZTtBQUNyQixjQUFNLFNBQVM7QUFFZixjQUFNLFFBQVEsSUFBSSxVQUFVLE9BQU8sTUFBTTtBQUd6QyxRQUFBQSxLQUFJLEtBQUssaUJBQWlCO0FBQzFCLFFBQUFBLEtBQUksS0FBSyxLQUFLO0FBQ2QsYUFBSyxXQUFXLFlBQVksS0FBSyxZQUFZLEtBQUs7QUFDbEQsYUFBSyxVQUFVLE1BQU07QUFBQSxNQUN6QjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBRVA7QUFBQSxFQWdCQSxlQUFlO0FBQ1gsVUFBTSxpQkFBaUIsT0FBTyxrQkFBa0I7QUFDaEQsVUFBTSxFQUFFLE9BQU8sT0FBTyxJQUFJLEVBQUUsT0FBTyxLQUFLLFFBQVEsSUFBSTtBQUNwRCxVQUFNLGFBQWEsY0FBYyxJQUFJLElBQUksS0FBSyxZQUFZLEdBQUcsQ0FBQztBQUU5RCxTQUFLLGFBQWEsSUFBSSxjQUFjO0FBQUEsTUFDaEMsT0FBTztBQUFBLE1BQ1AsaUJBQWlCO0FBQUEsTUFDakIsTUFBTTtBQUFBLE1BQ04sTUFBTSxLQUFLLGNBQWMsR0FBRyxTQUFTLFVBQVU7QUFBQSxNQUMvQyxRQUFRO0FBQUEsTUFDUjtBQUFBLE1BQ0E7QUFBQSxNQUNBLFVBQVU7QUFBQSxNQUNWLFdBQVc7QUFBQSxNQUNYLGdCQUFnQjtBQUFBLFFBQ1osU0FBUyw2RUFDSCxLQUFLLFFBQVEsWUFBWSxLQUFLLEtBQUssNEVBQTRDLHNCQUE4RSxDQUFDLElBQzlKLEtBQUssV0FBVyx3QkFBd0I7QUFBQSxRQUM5QyxZQUFZO0FBQUEsUUFDWixZQUFZO0FBQUEsTUFDaEI7QUFBQSxJQUNKLENBQUM7QUFHRCxTQUFLLFdBQVcsWUFBWSxLQUFLLG1CQUFtQixNQUFNO0FBQ3RELE1BQUFBLEtBQUksS0FBSyxnRUFBZ0U7QUFDekUsVUFBSSxLQUFLLGNBQWMsQ0FBQyxLQUFLLFdBQVcsVUFBVSxHQUFHO0FBQ2pELGFBQUssV0FBVyxLQUFLO0FBQ3JCLGFBQUssV0FBVyxRQUFRO0FBQUEsTUFDNUI7QUFBQSxJQUNKLENBQUM7QUFFRCxRQUFJLElBQUksY0FBYyxRQUFRLElBQUksT0FBTyxHQUFHO0FBQ3hDLFlBQU0sV0FBVyxxQkFBcUI7QUFDdEMsTUFBQUEsS0FBSSxLQUFLLCtDQUErQyxRQUFRLEVBQUU7QUFDbEUsV0FBSyxXQUFXLFdBQVc7QUFDM0IsV0FBSyxXQUFXLFNBQVMsUUFBUTtBQUFBLElBQ3JDLE9BQU87QUFDSCxZQUFNLE1BQU07QUFDWixNQUFBQSxLQUFJLEtBQUssOENBQThDLEdBQUcsRUFBRTtBQUM1RCxXQUFLLFdBQVcsV0FBVztBQUMzQixXQUFLLFdBQVcsUUFBUSxHQUFHO0FBQUEsSUFDL0I7QUFFQSxRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsU0FBSyxXQUFXLFlBQVksUUFBUSx5QkFBeUIsQ0FBQyxTQUFTLGFBQWE7QUFDaEYsVUFBSSxFQUFFLFVBQVUsYUFBYSxzQkFBc0Isb0JBQW9CLFVBQVUsSUFBSTtBQUNyRixlQUFTLENBQUM7QUFBQSxJQUNkLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sV0FBVyxrQkFBa0IsY0FBYyxnQkFBZ0I7QUFDL0csTUFBQUEsS0FBSSxLQUFLLHVEQUF1RCxTQUFTLEtBQUssZ0JBQWdCLGFBQWEsWUFBWSxFQUFFO0FBRXpILFVBQUksS0FBSyxjQUFjLENBQUMsS0FBSyxXQUFXLFVBQVUsR0FBRztBQUNqRCxRQUFBQSxLQUFJLEtBQUssa0VBQWtFO0FBQzNFLGFBQUssV0FBVyxLQUFLO0FBQ3JCLGFBQUssV0FBVyxRQUFRO0FBQUEsTUFDNUI7QUFBQSxJQUNKLENBQUM7QUFJRCxTQUFLLFdBQVcsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sUUFBUTtBQUM1RCxZQUFNLGVBQWU7QUFBQSxJQUN6QixDQUFDO0FBRUQsU0FBSyxXQUFXLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxRQUFRO0FBQ3pELFlBQU0sZUFBZTtBQUFBLElBQ3pCLENBQUM7QUFFRCxTQUFLLFdBQVcsWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLElBQUksTUFBTTtBQUMxRCxhQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsSUFDNUIsQ0FBQztBQUdELFNBQUssV0FBVyxHQUFHLFNBQVMsT0FBUSxNQUFNO0FBQ3RDLFVBQUksQ0FBQyxLQUFLLE9BQU8sZUFBZSxLQUFLLFlBQVksWUFBWSxPQUFPLEVBQUUsU0FBUyxXQUFXLEdBQUc7QUFFekYsUUFBQUEsS0FBSSxLQUFLLDJEQUEyRDtBQUFHLFVBQUUsZUFBZTtBQUN4RixlQUFPLG1CQUFtQixLQUFLLFlBQVk7QUFBQSxVQUN2QyxNQUFNO0FBQUEsVUFDTixTQUFTLENBQUMsSUFBSTtBQUFBO0FBQUEsVUFDZCxXQUFXO0FBQUEsVUFDWCxPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsUUFDYixDQUFDO0FBQ0Q7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJLEtBQUs7QUFDVCxnQkFBUSxLQUFLLENBQUM7QUFBQSxNQUNsQjtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLHFCQUFxQjtBQUNqQixVQUFNLGFBQWEsY0FBYyxJQUFJLElBQUksS0FBSyxZQUFZLEdBQUcsQ0FBQztBQUM5RCxTQUFLLGFBQWEsSUFBSSxjQUFjO0FBQUEsTUFDaEMsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsTUFBTSxLQUFLLGNBQWMsR0FBRyxTQUFTLFVBQVU7QUFBQSxNQUMvQyxnQkFBZ0I7QUFBQSxRQUNaLFNBQVMsNkVBQ0gsS0FBSyxRQUFRLFlBQVksS0FBSyxLQUFLLDRFQUE0QyxzQkFBOEUsQ0FBQyxJQUM5SixLQUFLLFdBQVcsd0JBQXdCO0FBQUEsTUFDbEQ7QUFBQSxJQUNKLENBQUM7QUFFRCxRQUFJLE1BQU07QUFDVixTQUFLLFdBQVcsUUFBUSxHQUFHO0FBQzNCLFFBQUksS0FBSyxPQUFPLGNBQWM7QUFBRSxXQUFLLFdBQVcsWUFBWSxhQUFhO0FBQUEsSUFBRztBQUU1RSxTQUFLLFdBQVcsWUFBWSxLQUFLLG1CQUFtQixNQUFNO0FBQ3RELFVBQUksS0FBSyxjQUFjLENBQUMsS0FBSyxXQUFXLFVBQVUsR0FBRztBQUNqRCxhQUFLLFdBQVcsV0FBVztBQUMzQixhQUFLLFdBQVcsZUFBZSxLQUFLO0FBQ3BDLGFBQUssV0FBVyxLQUFLO0FBQ3JCLGFBQUssV0FBVyxRQUFRO0FBQUEsTUFDNUI7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQ0o7QUFFQSxJQUFPLHdCQUFRLElBQUksY0FBYzs7O0FSL1BqQyxPQUFPLGVBQWU7QUFHdEIsU0FBUyxPQUFBRyxZQUFXO0FBbEJwQixJQUFNLFNBQVMsT0FBTztBQU90QixJQUFNLEVBQUUsRUFBRSxJQUFJLGdCQUFLO0FBU25CLElBQUksa0JBQWtCO0FBR3RCLElBQU1DLGFBQVksWUFBWTtBQUM5QixJQUFNLE1BQU1DLElBQUc7QUFTZixPQUFPLElBQUksVUFBVSxDQUFDLEtBQUssUUFBUTtBQUMvQixRQUFNLGVBQWUscUJBQXFCO0FBQzFDLFFBQU0sZ0JBQWdCLGdCQUFnQixPQUFPLE9BQU8sS0FBSyxjQUFjLE9BQU8sQ0FBQyxDQUFDO0FBQ2hGLE1BQUksT0FBTyxnQkFBZ0IsY0FBYyxFQUFFLFVBQVUsS0FBSyxDQUFDO0FBQzNELGlCQUFPLGVBQWU7QUFFdEIsUUFBTSxnQkFBZ0I7QUFBQSxJQUNsQixXQUFXLFdBQVcsS0FBSztBQUFBLElBQzNCLGVBQWU7QUFBQSxJQUNmLGNBQWMsV0FBVyxLQUFLO0FBQUEsSUFDOUIsZUFBZTtBQUFBLElBQ2YsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBLElBQ1AsZ0JBQWdCO0FBQUEsSUFDaEIsdUJBQXVCO0FBQUEsRUFDM0I7QUFDQSxRQUFNLFVBQVUsa0VBQWtFLEdBQUcsVUFBVSxhQUFhLENBQUM7QUFDN0csTUFBSSxTQUFTLE9BQU87QUFDeEIsQ0FBQztBQU9ELE9BQU8sSUFBSSxXQUFXLE9BQU8sS0FBSyxRQUFRO0FBQ3RDLFFBQU0sT0FBTyxJQUFJLE1BQU07QUFDdkIsUUFBTSxlQUFnQixlQUFPO0FBQzdCLE1BQUk7QUFDQSxVQUFNLFdBQVcsTUFBTSxNQUFNLEtBQUssOERBQThELEdBQUcsVUFBVTtBQUFBLE1BQ3pHLFdBQVcsV0FBVyxLQUFLO0FBQUEsTUFDM0IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1A7QUFBQSxNQUNBLGNBQWMsV0FBVyxLQUFLO0FBQUEsTUFDOUIsZUFBZTtBQUFBLElBQ2YsQ0FBQyxHQUFHO0FBQUEsTUFDSixTQUFTO0FBQUEsUUFDTCxnQkFBZ0I7QUFBQSxRQUNoQixVQUFVO0FBQUEsTUFDZDtBQUFBLElBQ0osQ0FBQztBQUVELG1CQUFPLGNBQWMsU0FBUyxLQUFLO0FBRW5DLFFBQUksT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWdCWCxRQUFJLEtBQUssSUFBSTtBQUFBLEVBQ2pCLFNBQVMsT0FBTztBQUNaLFlBQVEsTUFBTSxNQUFNLFNBQVMsSUFBSTtBQUNqQyxRQUFJLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFVRyxNQUFNLFNBQVMsS0FBSyxpQkFBaUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUtuRCxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssSUFBSTtBQUFBLEVBQzdCO0FBQ0YsQ0FBQztBQWFGLE9BQU8sS0FBSywrQkFBK0IsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFFeEUsTUFBSSxDQUFDLHFCQUFxQixLQUFLLEdBQUcsRUFBRztBQUVyQyxRQUFNLE1BQU0sSUFBSSxLQUFLO0FBQ3JCLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFFdkIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFLakQsTUFBSSxNQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFFLEdBQUksSUFBSSxHQUFJO0FBQ3RELE1BQUksZUFBTyxhQUFZO0FBQUUsVUFBTTtBQUFBLEVBQU87QUFHdEMsTUFBSSxVQUFVO0FBQ1YsV0FBTyxJQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFDO0FBQUEsRUFDNUY7QUFFQSxhQUFXLFFBQVEsd0JBQWdCLGdCQUFnQjtBQUMvQyxRQUFJLGNBQWMsS0FBSyxZQUFZO0FBQy9CLGFBQU8sSUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx5QkFBeUIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQy9GO0FBQUEsRUFDSDtBQUVELEVBQUFDLEtBQUksS0FBSyxrREFBa0QsVUFBVTtBQUNyRSxNQUFJLE1BQU0sSUFBSSx3QkFBZ0I7QUFFOUIsTUFBSSxDQUFDLElBQUksT0FBTyxRQUFPO0FBQ25CLFFBQUksS0FBSyxZQUFZLEtBQUssSUFBSSxLQUFLLEtBQUs7QUFBQSxFQUM1QyxPQUNLO0FBQ0QsUUFBSSxLQUFLLFlBQVksS0FBSyxJQUFJLE9BQU8sUUFBUSxLQUFLLEtBQUs7QUFBQSxFQUMzRDtBQUVBLGlCQUFPLGVBQWUsVUFBVSxJQUFFO0FBRWxDLE1BQUksb0JBQW9CQyxNQUFLLEtBQUssZUFBTyxlQUFlLFVBQVU7QUFFbEUsTUFBSTtBQUNBLFVBQU1GLElBQUcsU0FBUyxNQUFNLG1CQUFtQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsRUFDbEUsU0FBUyxLQUFLO0FBQUEsRUFFZDtBQUNBLE1BQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxVQUFTLENBQUM7QUFFeEYsQ0FBQztBQVNBLE9BQU8sSUFBSSw0Q0FBNEMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUM5RSxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUVqRCxNQUFJLFlBQVksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUU1RSxhQUFTLGtCQUFrQixLQUFLO0FBRWhDLGFBQVMsT0FBTyxNQUFNO0FBRXRCLFdBQU8sZUFBTyxlQUFlLFVBQVU7QUFDdkMsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBQztBQUFBLEVBR3hGO0FBQ0osQ0FBQztBQVFBLE9BQU8sSUFBSSxxQ0FBcUMsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUN2RSxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLE1BQUksU0FBUyxJQUFJLE9BQU87QUFDeEIsTUFBSSxDQUFDLFFBQU87QUFBRSxhQUFTO0FBQUEsRUFBRTtBQUN6QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsTUFBSSxVQUFVO0FBQ1YsUUFBSSxXQUFXLFNBQVMsV0FBVyxVQUFTO0FBQzVDLGFBQU8sSUFBSSxLQUFNO0FBQUEsUUFDYixRQUFRO0FBQUEsUUFDUixTQUFTLEVBQUUsbUJBQW1CO0FBQUEsUUFDOUIsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFVBQ04sS0FBSyxTQUFTLFdBQVc7QUFBQSxVQUN6QixhQUFhLFNBQVMsV0FBVztBQUFBLFVBQ2pDLFVBQVUsU0FBUyxXQUFXO0FBQUEsUUFDOUI7QUFBQSxNQUNKLENBQUU7QUFBQSxJQUFDLE9BQ0U7QUFBRSxhQUFPLElBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsaUJBQWlCLEdBQUcsUUFBUSxRQUFPLENBQUM7QUFBQSxJQUFFO0FBQUEsRUFDaEcsT0FDSztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsa0JBQWtCLEdBQUcsUUFBUSxRQUFPLENBQUM7QUFBQSxFQUNqRjtBQUNKLENBQUM7QUFNRCxPQUFPLElBQUksZUFBZSxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ2hELE1BQUksYUFBYSxDQUFDO0FBQ2xCLFNBQU8sT0FBTyxlQUFPLGNBQWMsRUFBRSxRQUFTLENBQUFHLFlBQVU7QUFDcEQsZUFBVyxLQUFLLEVBQUMsWUFBWUEsUUFBTyxXQUFXLFlBQVksSUFBSUEsUUFBTyxXQUFXLElBQUksVUFBVUEsUUFBTyxXQUFXLElBQUksV0FBVyxNQUFNLFVBQVVBLFFBQU8sV0FBVyxVQUFVLFNBQVNBLFFBQU8sV0FBVyxRQUFPLENBQUM7QUFBQSxFQUNuTixDQUFDO0FBQ0QsTUFBSSxLQUFLLEVBQUMsWUFBdUIsUUFBUSxVQUFTLENBQUM7QUFDdkQsQ0FBQztBQUtBLE9BQU8sSUFBSSxTQUFTLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDM0MsTUFBSSxLQUFLLE1BQU07QUFDbkIsQ0FBQztBQUdELE9BQU8sS0FBSyxTQUFTLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDM0MsTUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFTLENBQUM7QUFDakMsQ0FBQztBQUtELElBQUksY0FBYyxDQUFDO0FBQ25CLFNBQVMsSUFBSSxHQUFHLElBQUUsSUFBSSxLQUFLO0FBQ3ZCLE1BQUksYUFBYTtBQUFBLElBQ2IsWUFBWSxRQUFTQyxRQUFPLFlBQVksQ0FBQyxFQUFFLFNBQVMsS0FBSyxDQUFHO0FBQUEsSUFDNUQsT0FBTyxRQUFRQSxRQUFPLFdBQVcsQ0FBQztBQUFBLElBQ2xDLElBQUk7QUFBQSxJQUNKLFVBQVU7QUFBQSxJQUNWLFVBQVU7QUFBQSxJQUNWLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLFlBQVcsb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFBQSxJQUM5QixhQUFhO0FBQUE7QUFBQSxJQUNiLFVBQVc7QUFBQSxJQUNYLEtBQUs7QUFBQSxJQUNMLFlBQVk7QUFBQSxJQUNaLFVBQVM7QUFBQSxJQUNULFFBQVMsQ0FBQztBQUFBLEVBQ2Q7QUFDQSxjQUFZLEtBQUssVUFBVTtBQUMvQjtBQWtCQyxPQUFPLElBQUksd0ZBQXdGLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ2hJLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLElBQUksT0FBTztBQUM1QixRQUFNLE1BQU0sSUFBSSxPQUFPO0FBQ3ZCLFFBQU0sVUFBVSxJQUFJLE9BQU87QUFDM0IsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFFBQVEsUUFBUUEsUUFBTyxXQUFXLENBQUM7QUFDekMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sV0FBVyxJQUFJLE9BQU87QUFDNUIsUUFBTSxZQUFZLElBQUksT0FBTztBQUU3QixFQUFBSCxLQUFJLEtBQUssNkNBQTRDLE9BQU87QUFFNUQsTUFBSSxXQUFXLGVBQU8sUUFBUSxNQUFNLEdBQUcsRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUNuRCxpQkFBaUIsU0FBUyxLQUFLLEdBQUc7QUFDbEMsTUFBSSxXQUFXLFFBQVEsTUFBTSxHQUFHLEVBQUUsTUFBTSxHQUFHLENBQUMsR0FDNUMsaUJBQWlCLFNBQVMsS0FBSyxHQUFHO0FBSWxDLE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLEdBQUcsY0FBYyxPQUFPLGdCQUFpQjtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx5QkFBeUIsR0FBRyxRQUFRLFNBQVMsU0FBUyxlQUFPLFNBQVMsYUFBYSxlQUFPLEtBQUksQ0FBRTtBQUFBLEVBQUc7QUFFaE0sTUFBSSxTQUFTLGFBQWEsY0FBYyxhQUFhLFNBQVE7QUFDekQsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLHFCQUFxQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDMUY7QUFDQSxNQUFJO0FBQ0EsUUFBSSxPQUFPLFNBQVMsV0FBVyxLQUFLO0FBQ2hDLFVBQUksbUJBQW1CLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxlQUFlLFVBQVU7QUFJN0YsVUFBSSxDQUFDLGtCQUFrQjtBQUNuQixRQUFBQSxLQUFJLEtBQUssZ0RBQWdELFVBQVUsR0FBRztBQUl0RSxZQUFJLFFBQVE7QUFDWixZQUFJLFNBQVMsYUFBYSxhQUFhLFNBQVMsYUFBYSxhQUFhLEVBQUUsUUFBUSxPQUFPLFNBQVMsVUFBVSxHQUFHO0FBQUUsa0JBQVE7QUFBQSxRQUFLLFdBQ3ZILFNBQVMsYUFBYSxhQUFhLFNBQVMsYUFBYSxhQUFhLEVBQUUsUUFBUSxPQUFPLFNBQVMsVUFBVSxHQUFHO0FBQUUsa0JBQVE7QUFBQSxRQUFNLE9BQ2pJO0FBQ0Qsa0JBQVE7QUFDVCxtQkFBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxPQUFPLE1BQU0sS0FBSyxVQUFVO0FBQUEsUUFFdkc7QUFFQSxjQUFNLFNBQVM7QUFBQTtBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBLFlBQVcsb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFBQSxVQUM5QixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixVQUFTO0FBQUEsVUFDVCxhQUFhO0FBQUEsVUFDYjtBQUFBO0FBQUEsVUFDQSxRQUFRLEVBQUUsT0FBTyxTQUFTLElBQUc7QUFBQTtBQUFBO0FBQUEsUUFFakM7QUFFQSxZQUFJLGdCQUFlQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFhLFVBQVU7QUFHOUYsWUFBSTtBQUNBLGdCQUFNRixJQUFHLFNBQVMsT0FBTyxhQUFhO0FBS3RDLGdCQUFNLFlBQVlFLE1BQUssUUFBUSxhQUFhO0FBQzVDLGdCQUFNLGdCQUFnQkEsTUFBSyxTQUFTLGFBQWE7QUFDakQsZ0JBQU0sZUFBZSxNQUFNRixJQUFHLFNBQVMsUUFBUSxXQUFXLEVBQUUsZUFBZSxLQUFLLENBQUMsR0FDNUQsT0FBTyxZQUFVLE9BQU8sWUFBWSxDQUFDLEVBQ3JDLElBQUksWUFBVSxPQUFPLElBQUk7QUFHOUMsY0FBSSxDQUFDLFlBQVksU0FBUyxhQUFhLEdBQUc7QUFFdEMsa0JBQU0sY0FBYyxZQUFZLEtBQUssU0FBTyxJQUFJLFlBQVksTUFBTSxjQUFjLFlBQVksQ0FBQztBQUM3RixnQkFBSSxhQUFhO0FBQ2Isb0JBQU0sVUFBVUUsTUFBSyxLQUFLLFdBQVcsV0FBVztBQUNoRCxvQkFBTSxVQUFVQSxNQUFLLEtBQUssV0FBVyxVQUFVLFdBQVcsRUFBRTtBQUM1RCxvQkFBTUYsSUFBRyxTQUFTLE9BQU8sU0FBUyxPQUFPO0FBQ3pDLGNBQUFDLEtBQUksS0FBSyxzQ0FBc0MsT0FBTyxPQUFPLE9BQU8sc0RBQXNEO0FBQUEsWUFDOUg7QUFBQSxVQUNKLE9BQ0s7QUFDRCxZQUFBQSxLQUFJLEtBQUssK0RBQStELGFBQWEsRUFBRTtBQUFBLFVBQzNGO0FBQUEsUUFDSixTQUFTLEtBQUs7QUFFVixjQUFJO0FBQ0Esa0JBQU1ELElBQUcsU0FBUyxNQUFNLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUMxRCxZQUFBQyxLQUFJLEtBQUssc0NBQXNDLGFBQWEsRUFBRTtBQUFBLFVBQ2xFLFNBQVMsVUFBVTtBQUNmLFlBQUFBLEtBQUksTUFBTSx1REFBdUQsUUFBUSxFQUFFO0FBQUEsVUFDL0U7QUFBQSxRQUNKO0FBRUEsWUFBSTtBQUNBLGdCQUFNRCxJQUFHLFNBQVMsTUFBTSxlQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQ3JFLFNBQVMsS0FBSztBQUFBLFFBRWQ7QUFFQSxpQkFBUyxZQUFZLEtBQUssTUFBTTtBQUNoQyxlQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsb0JBQW9CLEdBQUcsUUFBUSxXQUFXLE1BQVksQ0FBQztBQUFBLE1BQ3hHLE9BQ0s7QUFFRCxZQUFJLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFDN0IsWUFBSSxNQUFNLE1BQVEsaUJBQWlCLFdBQVc7QUFDMUMsMkJBQWlCLFlBQVk7QUFDN0IsVUFBQUMsS0FBSSxLQUFLLCtDQUErQztBQUd4RCxnQ0FBYyxXQUFXLFlBQVksS0FBSyxlQUFlLGdCQUFnQjtBQUN6RSxpQkFBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLG9CQUFvQixHQUFHLFFBQVEsV0FBVyxPQUFPLGlCQUFpQixNQUFLLENBQUM7QUFBQSxRQUN6SCxPQUNLO0FBQ0QsaUJBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSwyQkFBMkIsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLFFBQy9GO0FBQUEsTUFDSjtBQUFBLElBQ0osT0FDSztBQUNELGFBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBQztBQUFBLElBQ3RGO0FBQUEsRUFDSixTQUNPLEtBQUk7QUFDUCxJQUFBQSxLQUFJLE1BQU0sNkJBQTZCLEdBQUcsRUFBRTtBQUM1QyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLDRCQUE0QixRQUFRLFFBQU8sQ0FBQztBQUFBLEVBQzNGO0FBQ0osQ0FBQztBQXlCQSxPQUFPLEtBQUssNERBQTRELFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDL0YsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLGVBQWUsSUFBSSxPQUFPO0FBQ2hDLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLGlCQUFpQixPQUFNO0FBQ3ZCLGVBQVMsV0FBVyxTQUFTLGFBQVk7QUFDckMsZ0JBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsZ0JBQVEsT0FBTyxPQUFPLElBQUs7QUFBQSxNQUMvQjtBQUFBLElBQ0osT0FDSztBQUNELFVBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFVBQUksU0FBUztBQUNULGdCQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLGdCQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsTUFDOUI7QUFBQSxJQUNKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxxQkFBcUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3ZGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBeUNELE9BQU8sS0FBSyx5REFBeUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUMzRixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sWUFBWSxJQUFJLEtBQUs7QUFFM0IsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFFBQUksU0FBUztBQUNULGNBQVEsT0FBTyxnQkFBZ0I7QUFBQSxJQUNsQztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN6RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVdBLE9BQU8sSUFBSSx1REFBdUQsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUN6RixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sZUFBZSxJQUFJLE9BQU87QUFDaEMsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBRWpELE1BQUksSUFBSSxPQUFPLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUNoRSxRQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixRQUFJLFNBQVM7QUFDVCxjQUFRLE9BQU8sb0JBQW9CO0FBQUEsSUFDdEM7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsVUFBUyxDQUFFO0FBQUEsRUFDeEYsT0FDSztBQUNELFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUsc0JBQXNCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUN0RjtBQUNKLENBQUM7QUF5QkEsT0FBTyxJQUFJLHFEQUFxRCxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3ZGLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsTUFBSSxJQUFJLE9BQU8sb0JBQW9CLFNBQVMsV0FBVyxhQUFhO0FBQ2hFLFFBQUksaUJBQWlCLE9BQU07QUFDdkIsZUFBUyxXQUFXLFNBQVMsYUFBWTtBQUFFLGdCQUFRLE9BQU8sVUFBVSxJQUFJO0FBQUEsTUFBTTtBQUFBLElBQ2xGLE9BQ0s7QUFDRCxVQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixVQUFJLFNBQVM7QUFBRyxnQkFBUSxPQUFPLFVBQVUsSUFBRztBQUFBLE1BQU07QUFBQSxJQUN0RDtBQUNBLFFBQUksS0FBTSxFQUFDLFFBQVEsVUFBVSxTQUFTLEVBQUUscUJBQXFCLEdBQUcsUUFBUSxVQUFTLENBQUU7QUFBQSxFQUN2RixPQUNLO0FBQ0QsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSxzQkFBc0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQ3RGO0FBQ0osQ0FBQztBQVlELE9BQU8sS0FBSyxpREFBaUQsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekYsUUFBTSxrQkFBa0IsSUFBSSxPQUFPO0FBQ25DLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELE1BQUksQ0FBQyxVQUFVO0FBQUcsV0FBTyxJQUFJLEtBQUssRUFBQyxRQUFRLFVBQVUsU0FBUSxFQUFFLGtCQUFrQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUN4RyxNQUFJLG9CQUFvQixTQUFTLFdBQVcsYUFBYTtBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUM7QUFFcEosUUFBTSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLG1CQUFtQjtBQUNwRyxNQUFJO0FBQ0osTUFBSTtBQUNBLFVBQU0sY0FBYyxNQUFNRixJQUFHLFNBQVMsU0FBUyxVQUFVLE9BQU87QUFDaEUsbUJBQWUsS0FBSyxNQUFNLFdBQVc7QUFDckMsYUFBUyxXQUFXLE1BQU0sYUFBYTtBQUFBLEVBQzNDLFNBQ08sT0FBTztBQUFHLG1CQUFlO0FBQUEsRUFBUTtBQUN4QyxTQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxRQUFRLFdBQVcsYUFBMEIsQ0FBQztBQUNyRixDQUFDO0FBR0QsT0FBTyxJQUFJLHdEQUF3RCxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ3pGLFFBQU0sa0JBQWtCLElBQUksT0FBTztBQUNuQyxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxNQUFJLENBQUMsVUFBVTtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFDeEcsTUFBSSxvQkFBb0IsU0FBUyxXQUFXLGFBQWE7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFDO0FBRXBKLFNBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFFBQVEsV0FBVyxjQUFjLFNBQVMsYUFBWSxDQUFDO0FBQzlGLENBQUM7QUFZRCxPQUFPLEtBQUssaURBQWlELGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ3pGLFFBQU0sa0JBQWtCLElBQUksT0FBTztBQUNuQyxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxNQUFJLENBQUMsVUFBVTtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSxrQkFBa0IsR0FBRyxRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFDeEcsTUFBSSxvQkFBb0IsU0FBUyxXQUFXLGFBQWE7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsdUJBQXVCLEdBQUcsUUFBUSxRQUFPLENBQUU7QUFBQSxFQUFDO0FBRXBKLFdBQVMsZUFBZSxJQUFJLEtBQUs7QUFDakMsV0FBUyxhQUFhLGFBQWEsU0FBUyxhQUFhLGFBQWEsRUFBRSxlQUFlO0FBR3ZGLEVBQUFDLEtBQUksS0FBSyx5REFBeUQ7QUFFbEUsUUFBTSxVQUFVQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxVQUFVO0FBQzlFLFFBQU0sV0FBV0EsTUFBSyxLQUFLLGVBQU8sZUFBZSxTQUFTLFdBQVcsWUFBWSxtQkFBbUI7QUFFcEcsTUFBSTtBQUNBLFVBQU1GLElBQUcsU0FBUyxNQUFNLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUNwRCxVQUFNLGFBQWEsS0FBSyxVQUFVLFNBQVMsY0FBYyxNQUFNLENBQUM7QUFFaEUsU0FBSyxNQUFNLFVBQVU7QUFDckIsVUFBTUEsSUFBRyxTQUFTLFVBQVUsVUFBVSxVQUFVO0FBQUEsRUFDcEQsU0FDTyxPQUFPO0FBQ1YsSUFBQUMsS0FBSSxNQUFNLDhCQUE4QixLQUFLLEVBQUc7QUFDaEQsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsU0FBUSx1Q0FBdUMsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUN4RztBQUVBLE1BQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLEVBQUUsWUFBWSxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQzdFLENBQUM7QUFzQkQsT0FBTyxLQUFLLGdFQUFnRSxTQUFVLEtBQUssS0FBSyxNQUFNO0FBQ2xHLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFFakQsUUFBTSxjQUFjLElBQUksS0FBSztBQUM3QixRQUFNLFlBQVksSUFBSSxLQUFLO0FBQzNCLFFBQU0sNEJBQTRCLElBQUksS0FBSztBQUMzQyxRQUFNLDZCQUE2QixJQUFJLEtBQUs7QUFDNUMsUUFBTSxxQkFBcUIsSUFBSSxLQUFLO0FBQ3BDLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFDdkIsUUFBTSxTQUFTLElBQUksS0FBSztBQUN4QixRQUFNLGdCQUFnQixJQUFJLEtBQUs7QUFDL0IsUUFBTSxlQUFlLElBQUksS0FBSztBQUc5QixNQUFJLElBQUksT0FBTyxvQkFBb0IsU0FBUyxXQUFXLGFBQWE7QUFFaEUsUUFBSSxpQkFBaUIsT0FBTTtBQUN2QixlQUFTLFdBQVcsU0FBUyxhQUFZO0FBQ3JDLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSxPQUFPO0FBQUMsa0JBQVEsT0FBTyxRQUFRO0FBQUEsUUFBTztBQUMxQyxZQUFJLE9BQU8sa0JBQWtCLGFBQWE7QUFBQyxrQkFBUSxPQUFPLGdCQUFnQjtBQUFBLFFBQWU7QUFDekYsWUFBSSxjQUFjO0FBQUMsa0JBQVEsT0FBTyxlQUFlO0FBQUEsUUFBTTtBQUFBLE1BQzNEO0FBQUEsSUFDSixPQUNLO0FBQ0QsVUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsVUFBSSxTQUFTO0FBRVQsWUFBSSxhQUFZO0FBQ1osa0JBQVEsT0FBTyxjQUFjO0FBQzdCLGtCQUFRLGVBQWU7QUFBQSxRQUMzQjtBQUNBLFlBQUksV0FBWTtBQUFFLGtCQUFRLE9BQU8sWUFBWTtBQUFBLFFBQU87QUFDcEQsWUFBSSwyQkFBMkI7QUFDM0Isa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyw2QkFBNkI7QUFBQSxRQUNoRCxPQUNLO0FBQ0Qsa0JBQVEsT0FBTyw0QkFBNEI7QUFDM0Msa0JBQVEsT0FBTyxzQkFBc0I7QUFBQSxRQUN6QztBQUNBLFlBQUksc0JBQXNCLE1BQUs7QUFBRSxrQkFBUSxlQUFlO0FBQUEsUUFBTTtBQUM5RCxZQUFJLE9BQU87QUFBQyxrQkFBUSxPQUFPLFFBQVE7QUFBQSxRQUFPO0FBQzFDLFlBQUksT0FBTyxrQkFBa0IsYUFBYTtBQUFDLGtCQUFRLE9BQU8sZ0JBQWdCO0FBQUEsUUFBZTtBQUN6RixZQUFJLFFBQVE7QUFBRSxrQkFBUSxPQUFPLFNBQVM7QUFBQSxRQUFLO0FBQzNDLFlBQUksY0FBYztBQUFDLGtCQUFRLE9BQU8sZUFBZTtBQUFBLFFBQU07QUFBQSxNQUkzRDtBQUNBLFVBQUksT0FBTSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUU3QixVQUFJLE1BQU0sTUFBUSxRQUFRLGFBQWEsUUFBUSxPQUFPLFFBQVc7QUFDN0QsWUFBSUksV0FBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxZQUFZO0FBQ2pGLFlBQUlBLFVBQVM7QUFBSSxtQkFBUyxjQUFjLFNBQVMsWUFBWSxPQUFRLFFBQU0sR0FBRyxVQUFXLFlBQVk7QUFBQSxRQUFHO0FBQUEsTUFDNUc7QUFBQSxJQUVKO0FBQ0EsUUFBSSxLQUFNLEVBQUMsUUFBUSxVQUFVLFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxRQUFRLFVBQVMsQ0FBRTtBQUFBLEVBQ3pGLE9BQ0s7QUFDRCxRQUFJLEtBQU0sRUFBQyxRQUFRLFVBQVUsU0FBUyxFQUFFLHNCQUFzQixHQUFHLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFDdEY7QUFDSixDQUFDO0FBa0JBLE9BQU8sS0FBSyxXQUFXLFNBQVUsS0FBSyxLQUFLLE1BQU07QUFDOUMsUUFBTSxhQUFhLElBQUksS0FBSztBQUM1QixRQUFNLGVBQWUsV0FBVztBQUNoQyxRQUFNLFdBQVcsV0FBVztBQUM1QixRQUFNLGFBQWEsV0FBVztBQUc5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsTUFBSyxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLGdCQUFnQixRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFFbEcsTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsTUFBSyxDQUFDLFNBQVU7QUFBQyxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLFdBQVcsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUFFO0FBRzNGLFVBQVEsUUFBUSxXQUFXO0FBQzNCLFVBQVEsY0FBYyxXQUFXO0FBQ2pDLFVBQVEsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUN2QyxVQUFRLFdBQVc7QUFDbkIsVUFBUSxRQUFRLFdBQVc7QUFDM0IsVUFBUSxrQkFBa0IsV0FBVztBQUVyQyxNQUFJLFdBQVcsT0FBTztBQUFFLFlBQVEsT0FBTyxvQkFBb0I7QUFBQSxFQUFNO0FBQ2pFLE1BQUksV0FBVyxzQkFBc0IsR0FBRTtBQUFFLFlBQVEsV0FBVztBQUFBLEVBQXlCO0FBRXJGLE1BQUksZ0JBQWdCLEtBQUssTUFBTSxLQUFLLFVBQVUsUUFBUSxNQUFNLENBQUM7QUFHN0QsTUFBSSxRQUFRLE9BQU8sUUFBVztBQUMxQixRQUFJQSxXQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsUUFBSUEsVUFBUztBQUFJLGVBQVMsY0FBYyxTQUFTLFlBQVksT0FBUSxRQUFNLEdBQUcsVUFBVyxZQUFZO0FBQUEsSUFBRztBQUFBLEVBQzVHO0FBSUEsVUFBUSxPQUFPLGNBQWM7QUFDN0IsVUFBUSxPQUFPLFlBQVk7QUFDM0IsVUFBUSxPQUFPLFdBQVc7QUFDMUIsVUFBUSxPQUFPLFFBQVE7QUFDdkIsVUFBUSxPQUFPLGVBQWU7QUFLOUIsUUFBTSxtQkFBbUIsRUFBRSxHQUFHLFNBQVMsYUFBYTtBQUNwRCxtQkFBaUIsZUFBZSxFQUFFLEdBQUcsU0FBUyxhQUFhLGFBQWE7QUFHeEUsV0FBUyxjQUFjLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHO0FBQ2pDLFFBQUksaUJBQWlCLGFBQWEsVUFBVSxHQUFHO0FBQzNDLHVCQUFpQixhQUFhLFVBQVUsSUFBSTtBQUFBLFFBQ3hDLEdBQUcsaUJBQWlCLGFBQWEsVUFBVTtBQUFBLFFBQzNDLFFBQVE7QUFBQSxVQUNKLEdBQUcsaUJBQWlCLGFBQWEsVUFBVSxFQUFFO0FBQUEsVUFDN0Msc0JBQXNCLENBQUM7QUFBQSxRQUMzQjtBQUFBLFFBQ0EsUUFBUTtBQUFBLFVBQ0osR0FBRyxpQkFBaUIsYUFBYSxVQUFVLEVBQUU7QUFBQSxVQUM3QyxzQkFBc0IsQ0FBQztBQUFBLFFBQzNCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBRUEsTUFBSSxVQUFVO0FBQ2QsTUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsRUFBRSx1QkFBdUIsR0FBRyxRQUFPLFdBQVcsY0FBYSxrQkFBa0IsY0FBNkIsQ0FBQztBQUNuSixDQUFDO0FBU0QsT0FBTyxLQUFLLHFCQUFxQixlQUFnQixLQUFLLEtBQUssTUFBTTtBQUM3RCxRQUFNLGFBQWEsSUFBSSxLQUFLO0FBQzVCLFFBQU0sZUFBZSxXQUFXO0FBQ2hDLFFBQU0sYUFBYSxXQUFXO0FBRzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxNQUFLLENBQUMsVUFBVTtBQUFHLFdBQU8sSUFBSSxLQUFLLEVBQUMsUUFBUSxVQUFVLFNBQVEsZ0JBQWdCLFFBQVEsUUFBTyxDQUFFO0FBQUEsRUFBRztBQUNsRyxNQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsWUFBWTtBQUNqRixNQUFLLENBQUMsU0FBVTtBQUFDLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFNBQVEsdUJBQXVCLFFBQVEsUUFBUSxDQUFDO0FBQUEsRUFBRTtBQUV2RyxNQUFJLElBQUksS0FBSyxZQUFhO0FBQ3RCLFVBQU0sbUJBQW1CLElBQUksS0FBSztBQUc5QixZQUFRLFdBQVcsNEJBQTRCO0FBRy9DLFFBQUksU0FBUyxhQUFhLFlBQVksU0FBUyxhQUFhLGlCQUFpQixDQUFDLFFBQVEsT0FBTyxxQkFBcUIsUUFBUSxPQUFNO0FBQzVILFVBQUc7QUFDQyxjQUFNLFNBQVMsSUFBSSxLQUFLLE9BQU8sTUFBTSxVQUFVLEVBQUUsSUFBSTtBQUNyRCxjQUFNLG9CQUFvQixPQUFPLEtBQUssUUFBUSxRQUFRO0FBR3RELGNBQU1DLGNBQWFSLEtBQUksYUFDckJJLE1BQUssS0FBSyxRQUFRLGVBQWMscUJBQXFCLFFBQVEsSUFDN0RBLE1BQUssUUFBUUgsWUFBVyxjQUFjO0FBRXhDLFlBQUksQ0FBQyxpQkFBZ0I7QUFDakIsNEJBQWtCLE1BQU0sVUFBVSxhQUFhLE9BQU0sR0FBRTtBQUFBLFlBQ25ELFVBQVVPO0FBQUEsWUFDVixXQUFXLGVBQU87QUFBQSxVQUN0QixDQUFDO0FBQUEsUUFDTDtBQUVBLGNBQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUssTUFBTSxnQkFBZ0IsVUFBVSxpQkFBaUI7QUFDN0UsWUFBSSxpQkFBaUIsS0FBSyxTQUFTLFNBQVMsV0FBVyxHQUFHO0FBRTFELFlBQUksQ0FBQyxnQkFBZTtBQUNoQixrQkFBUSxRQUFRO0FBQ2hCLGtCQUFRLE9BQU8sUUFBUTtBQUN2QixVQUFBTCxLQUFJLEtBQUssZ0ZBQWdGO0FBQUEsUUFDN0Y7QUFBQSxNQUNKLFNBQ00sS0FBSTtBQUFFLFFBQUFBLEtBQUksS0FBSyxxQ0FBcUMsR0FBRyxFQUFFO0FBQUEsTUFBRztBQUFBLElBQ3RFO0FBRUEsUUFBSSxDQUFDLFFBQVEsT0FBTztBQUNoQixNQUFBQSxLQUFJLEtBQUsseUVBQXlFO0FBQ2xGLFVBQUksUUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFDbkUsVUFBSSxXQUFXQyxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFZLFFBQVEsWUFBWSxXQUFXO0FBQzlHLFVBQUksbUJBQW1CQSxNQUFLLEtBQUssVUFBVSxHQUFHLElBQUksSUFBSSxJQUFJLEtBQUssa0JBQWtCLEVBQUU7QUFFbkYsVUFBSTtBQUNBLGNBQU1GLElBQUcsU0FBUyxNQUFNLFVBQVUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUNyRCxZQUFJLG1CQUFtQixPQUFPLEtBQUssSUFBSSxLQUFLLFlBQVksUUFBUTtBQUNoRSxjQUFNQSxJQUFHLFNBQVMsVUFBVSxrQkFBa0IsZ0JBQWdCO0FBQUEsTUFDbEUsU0FBUyxLQUFLO0FBQUUsUUFBQUMsS0FBSSxNQUFNLCtCQUErQixHQUFHLEVBQUc7QUFBQSxNQUFHO0FBQUEsSUFDdEU7QUFBQSxFQUVSLE9BQU87QUFFSCxZQUFRLFdBQVc7QUFBQSxFQUN2QjtBQUNBLE1BQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLEVBQUUsdUJBQXVCLEdBQUcsUUFBTyxVQUFVLENBQUM7QUFDdEYsQ0FBQztBQVFELE9BQU8sS0FBSywyQ0FBMkMsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDbkYsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sY0FBYyxJQUFJLEtBQUs7QUFDN0IsUUFBTSxlQUFlLElBQUksS0FBSztBQUM5QixRQUFNLG1CQUFtQixJQUFJLEtBQUs7QUFDbEMsUUFBTSxnQkFBZ0IsSUFBSSxLQUFLLGlCQUFpQjtBQUloRCxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsTUFBSyxDQUFDLFVBQVU7QUFBRyxXQUFPLElBQUksS0FBSyxFQUFDLFFBQVEsVUFBVSxTQUFRLGdCQUFnQixRQUFRLFFBQU8sQ0FBRTtBQUFBLEVBQUc7QUFHbEcsTUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsTUFBSyxDQUFDLFNBQVU7QUFBQyxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFRLFdBQVcsUUFBUSxRQUFRLENBQUM7QUFBQSxFQUFFO0FBRTNGLE1BQUksY0FBYTtBQUNiLFlBQVEsZUFBZTtBQUFBLEVBQzNCO0FBVUEsTUFBSSxjQUFjLFFBQVEsV0FBVyxRQUFRLFFBQVEsR0FBRztBQUN4RCxNQUFJLE1BQU0sb0JBQUksS0FBSztBQUVuQixNQUFJLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxHQUFHLE9BQU8sSUFBSSxTQUFTLElBQUUsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUMsR0FBRyxPQUFPLElBQUksUUFBUSxDQUFDLEVBQUUsU0FBUyxHQUFFLEdBQUcsQ0FBQyxJQUFJLE9BQU8sSUFBSSxTQUFTLENBQUMsRUFBRSxTQUFTLEdBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxJQUFJLFdBQVcsQ0FBQyxFQUFFLFNBQVMsR0FBRSxHQUFHLENBQUMsR0FBRyxPQUFPLElBQUksV0FBVyxDQUFDLEVBQUUsU0FBUyxHQUFFLEdBQUcsQ0FBQztBQUN2UCxNQUFJLFdBQVcsR0FBRyxVQUFVLElBQUksV0FBVyxJQUFJLGdCQUFnQixJQUFJLFNBQVM7QUFJNUUsUUFBTSxZQUFZLE9BQU8sS0FBSyxhQUFhLFFBQVE7QUFHbkQsTUFBSTtBQUNBLFVBQU0sV0FBV0MsTUFBSyxLQUFLLGVBQU8sZUFBZSxTQUFTLFdBQVcsWUFBWSxRQUFRLFlBQVksVUFBVSxjQUFjLFNBQVMsQ0FBRTtBQUN4SSxVQUFNLElBQUksTUFBTSxVQUFVLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDN0MsVUFBTSxtQkFBbUJBLE1BQUssS0FBSyxVQUFVLFFBQVE7QUFDckQsVUFBTSxJQUFJLFVBQVUsa0JBQWtCLFNBQVM7QUFFL0MsSUFBQUQsS0FBSSxLQUFLLHlFQUF5RSxRQUFRLFVBQVUsRUFBRTtBQUV0RyxRQUFJLGVBQWU7QUFDbkIsUUFBSSxlQUFPLGlCQUFpQjtBQUMxQixZQUFNLGFBQWFDLE1BQUssS0FBSyxlQUFPLGlCQUFpQixTQUFTLFdBQVcsWUFBWSxRQUFRLFlBQVksVUFBVSxjQUFjLFNBQVMsQ0FBRTtBQUM1SSxZQUFNLElBQUksTUFBTSxZQUFZLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDL0MsWUFBTSx5QkFBeUJBLE1BQUssS0FBSyxZQUFZLFFBQVE7QUFDN0QsWUFBTSxJQUFJLFVBQVUsd0JBQXdCLFNBQVM7QUFDckQscUJBQWU7QUFBQSxJQUNqQjtBQUVBLFFBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFTLFdBQVcsUUFBUSxXQUFXLFFBQVEsYUFBYSxDQUFDO0FBQUEsRUFDNUYsU0FBUyxLQUFLO0FBQ1osSUFBQUQsS0FBSSxNQUFNLDJCQUEyQixHQUFHLEVBQUU7QUFDMUMsUUFBSSxVQUFVLEVBQUUsMEJBQTBCO0FBQzFDLFFBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsVUFBVSxTQUFrQixRQUFRLFFBQVEsQ0FBQztBQUFBLEVBQzlFO0FBRU4sQ0FBQztBQWdCRCxJQUFPLGtCQUFRO0FBS2YsU0FBUyxxQkFBcUIsS0FBSSxLQUFJO0FBQ2xDLE1BQUksSUFBSSxNQUFNLFNBQVUsSUFBSSxNQUFNLGVBQWUsSUFBSSxHQUFHLFNBQVMsV0FBVyxHQUFHO0FBQzdFLFdBQU87QUFBQSxFQUNUO0FBQ0EsRUFBQUEsS0FBSSxNQUFNLHFDQUFxQyxJQUFJLEVBQUUsRUFBRTtBQUN2RCxNQUFJLEtBQUssZ0JBQWdCO0FBQ3pCLFNBQU87QUFDWDtBQUVBLFNBQVMsdUJBQXVCO0FBQzVCLFNBQU9HLFFBQU8sWUFBWSxFQUFFLEVBQUUsU0FBUyxLQUFLO0FBQ2hEO0FBQ0EsU0FBUyxPQUFPLFFBQVE7QUFDcEIsU0FBT0EsUUFBTyxXQUFXLFFBQVEsRUFBRSxPQUFPLE1BQU0sRUFBRSxPQUFPO0FBQzdEO0FBQ0EsU0FBUyxnQkFBZ0IsS0FBSztBQUMxQixTQUFPLElBQUksU0FBUyxRQUFRLEVBQzNCLFFBQVEsS0FBSyxHQUFHLEVBQ2hCLFFBQVEsS0FBSyxHQUFHLEVBQ2hCLFFBQVEsT0FBTyxFQUFFO0FBQ3RCOzs7QVMvZ0NBLFNBQVMsVUFBQUcsZUFBYztBQUV2QixPQUFPQyxXQUFXO0FBRWxCLE9BQU9DLFNBQVE7QUFDZixPQUFPLGFBQWE7QUFHcEIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsYUFBYSxXQUFXO0FBQ2pDLE9BQU9DLFVBQVM7QUFDaEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sU0FBUztBQVhoQixJQUFNQyxVQUFTQyxRQUFPO0FBTXRCLElBQU0sRUFBRSxHQUFBQyxHQUFFLElBQUksZ0JBQUs7QUFXbEJGLFFBQU8sS0FBSyxnQ0FBZ0MsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDekUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLE1BQUssSUFBSSxLQUFLO0FBRXBCLE1BQUssVUFBVSxTQUFTLFdBQVcsYUFBYztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQUV4RyxNQUFJLFVBQVUsQ0FBQztBQUNmLFVBQVEsS0FBTSxFQUFDLGtCQUFrQixLQUFLLGlCQUFpQkMsTUFBSyxRQUFRLEdBQUcsRUFBQyxDQUFDO0FBRXpFLFFBQU0saUJBQWlCLENBQUMsT0FBTztBQUcvQixNQUFJO0FBQ0EsVUFBTSxRQUFRLE1BQU1DLElBQUcsU0FBUyxRQUFRLEdBQUc7QUFDM0MsZUFBVyxRQUFRLE9BQU87QUFDdEIsWUFBTSxXQUFXRCxNQUFLLEtBQUssS0FBSyxJQUFJO0FBQ3BDLFVBQUksTUFBTUEsTUFBSyxRQUFRLElBQUksRUFBRSxZQUFZO0FBRXpDLFVBQUk7QUFDQSxjQUFNLFFBQVEsTUFBTUMsSUFBRyxTQUFTLEtBQUssUUFBUTtBQUM3QyxZQUFJLE1BQU0sWUFBWSxHQUFHO0FBQ3JCLGtCQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsTUFBTSxNQUFNLE1BQU0sT0FBTyxLQUFLLElBQUksUUFBUSxJQUFJLENBQUM7QUFBQSxRQUNsRixXQUNTLE1BQU0sT0FBTyxLQUFLLENBQUMsZUFBZSxTQUFTLEdBQUcsR0FBRztBQUN0RCxrQkFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLE1BQU0sTUFBTSxNQUFNLFFBQVEsS0FBVSxRQUFRLElBQUksQ0FBQztBQUFBLFFBQ3BGO0FBQUEsTUFDSixTQUFTLFVBQVU7QUFFZixnQkFBUSxNQUFNLHFFQUFxRSxRQUFRO0FBQUEsTUFDL0Y7QUFBQSxJQUNKO0FBQUEsRUFDSixTQUFTLEtBQUs7QUFFVixZQUFRLE1BQU0sMkRBQTJELEdBQUc7QUFDNUUsV0FBTyxJQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLFNBQVMsU0FBU0YsR0FBRSxnQkFBZ0IsRUFBRSxDQUFDO0FBQUEsRUFDakY7QUFDQSxTQUFPLElBQUksS0FBTSxPQUFRO0FBQzdCLENBQUM7QUFpQkFGLFFBQU8sS0FBSyxpQ0FBaUMsZUFBZ0IsS0FBSyxLQUFLLE1BQU07QUFDMUUsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLGNBQWMsSUFBSSxLQUFLO0FBQzdCLE1BQUksVUFBVTtBQUdkLE1BQUssVUFBVSxTQUFTLFdBQVcsYUFBYztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQU94RyxNQUFJLGNBQWMsQ0FBQztBQUNuQixXQUFTLFdBQVcsYUFBYTtBQUM3QixhQUFTLFVBQVUsR0FBRyxXQUFXLEdBQUcsV0FBVztBQUMzQyxVQUFJLFFBQVEsU0FBUyxPQUFPLEVBQUUsTUFBSztBQUMvQixvQkFBWSxLQUFLLFFBQVEsU0FBUyxPQUFPLEVBQUUsSUFBSTtBQUFBLE1BQ25EO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDQSxVQUFRLElBQUksaUNBQWlDLFdBQVc7QUFHeEQsTUFBSSxZQUFZLFdBQVcsR0FBRztBQUMxQixXQUFPLElBQUksS0FBSyxFQUFDLFNBQWtCLFdBQVcsS0FBSSxDQUFDO0FBQUEsRUFDdkQsT0FDSztBQUNELFFBQUksZUFBZSxNQUFNLGVBQWUsYUFBYSxVQUFVO0FBQy9ELFFBQUksZUFBZUMsTUFBSyxLQUFLLGVBQU8sZUFBZSxTQUFTLFdBQVcsWUFBVyxXQUFXO0FBQzdGLFFBQUk7QUFDQSxZQUFNQyxJQUFHLFNBQVMsVUFBVSxjQUFjLFlBQVk7QUFDdEQsTUFBQUwsS0FBSSxLQUFLLGlEQUFpRDtBQUFBLElBQzlELFNBQ00sS0FBSTtBQUFDLE1BQUFBLEtBQUksTUFBTSxxQkFBb0IsR0FBRztBQUFBLElBQUM7QUFDN0MsZ0JBQVksUUFBUSxZQUFZO0FBSWhDLFFBQUksTUFBTSxNQUFNLFlBQVksV0FBVztBQUN2QyxRQUFJLFlBQVksT0FBTyxLQUFLLEdBQUc7QUFDL0IsUUFBSSxVQUFVSSxNQUFLLEtBQUssZUFBTyxlQUFlLFNBQVMsV0FBVyxZQUFXLGNBQWM7QUFDM0YsUUFBSTtBQUNBLFlBQU1DLElBQUcsU0FBUyxVQUFVLFNBQVMsU0FBUztBQUM5QyxNQUFBTCxLQUFJLEtBQUssMkNBQTJDO0FBQUEsSUFDeEQsU0FDTSxLQUFJO0FBQUMsTUFBQUEsS0FBSSxNQUFNLHFCQUFvQixHQUFHO0FBQUEsSUFBQztBQUM3QyxXQUFPLElBQUksS0FBSyxFQUFDLFNBQWtCLFdBQXFCLFFBQWdCLENBQUM7QUFBQSxFQUM3RTtBQUNKLENBQUM7QUFXRCxTQUFTLFdBQVcsTUFBTTtBQUN0QixRQUFNLFNBQVMsSUFBSSxXQUFXLE1BQU0sR0FBRyxDQUFDO0FBRXhDLFFBQU0sWUFBWSxDQUFDLElBQU0sSUFBTSxJQUFNLElBQU0sRUFBSTtBQUMvQyxXQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBQ3ZDLFFBQUksT0FBTyxDQUFDLE1BQU0sVUFBVSxDQUFDLEdBQUc7QUFDNUIsTUFBQUEsS0FBSSxLQUFLLDBDQUEwQztBQUNuRCxhQUFPO0FBQUEsSUFDWDtBQUFBLEVBQ0o7QUFDQSxTQUFPO0FBQ1g7QUFFQSxlQUFlLGdCQUFnQixTQUFTLGFBQWEsWUFBVztBQUM1RCxRQUFNLGFBQWEsTUFBTUssSUFBRyxTQUFTLFNBQVMsT0FBTztBQUNyRCxNQUFJLFFBQVE7QUFFWixNQUFJLFdBQVcsVUFBVSxHQUFFO0FBQ3ZCLFlBQVEsTUFBTSxJQUFJLFVBQVUsRUFBRSxLQUFNLFVBQVE7QUFDeEMsVUFBSSxRQUFRLEtBQUssUUFBUSxhQUFhO0FBQ2xDLFlBQUkscUJBQXFCLEtBQUssS0FBSztBQUduQyxZQUFJLFNBQVMsSUFBSSxVQUFVO0FBQzNCLFlBQUksU0FBUztBQUViLDZCQUFxQjtBQUlyQixZQUFJLFFBQVE7QUFDWixZQUFJLFVBQVUsS0FBSyxLQUFLLE1BQU0sS0FBSztBQUNuQyxZQUFJLGdCQUFnQixVQUFVLFFBQVEsQ0FBQyxJQUFJO0FBRTNDLFlBQUksa0JBQWtCLFlBQVc7QUFDN0IsaUJBQU87QUFBQSxRQUNYLE9BQ0s7QUFDRCxrQkFBUTtBQUNSLG9CQUFVLEtBQUssS0FBSyxNQUFNLEtBQUs7QUFDL0IsMEJBQWdCLFVBQVUsUUFBUSxDQUFDLElBQUk7QUFDdkMsY0FBSSxrQkFBa0IsWUFBVztBQUM3QixtQkFBTztBQUFBLFVBQ1gsT0FDSztBQUNELG9CQUFRLElBQUksS0FBSyxJQUFJO0FBQ3JCLG1CQUFPLHNCQUFzQixJQUFJLEtBQUssa0JBQWtCLEtBQUs7QUFBQSxVQUNqRTtBQUFBLFFBQ0o7QUFBQSxNQUNKLE9BQ0s7QUFDRCxlQUFPO0FBQUEsTUFDWDtBQUFBLElBRUosQ0FBQyxFQUNBLE1BQU0sU0FBTztBQUFDLE1BQUFMLEtBQUksTUFBTSwyQkFBMkIsR0FBRyxFQUFFO0FBQUcsYUFBTztBQUFBLElBQUcsQ0FBQztBQUFBLEVBQzNFLE9BQ0s7QUFDRCxZQUFRO0FBQUEsRUFDWjtBQUVBLFNBQU87QUFDWDtBQVFBLGVBQWUsZUFBZSxhQUFhLFlBQVc7QUFDbEQsTUFBSSxZQUFZLENBQUMsQ0FBQyxRQUFRLGFBQWEsU0FBUyxXQUFXLFdBQVcsQ0FBQztBQUN2RSxhQUFXLFdBQVcsYUFBWTtBQUM5QixRQUFJLGdCQUFnQjtBQUNwQixVQUFNLGNBQWMsUUFBUSxZQUFZLFNBQVMsS0FBSyxRQUFRLFlBQVksTUFBTSxHQUFHLEVBQUUsSUFBSSxRQUFRLFFBQVE7QUFDekcsYUFBUyxVQUFVLEdBQUcsV0FBVyxHQUFHLFdBQVc7QUFDM0MsVUFBSSxPQUFPO0FBQ1gsVUFBSSxjQUFjO0FBQ2xCLFVBQUksT0FBTztBQUNYLFVBQUksUUFBUTtBQUNaLFVBQUksV0FBVztBQUVmLFVBQUksUUFBUSxTQUFTLE9BQU8sRUFBRSxNQUFLO0FBQy9CLGVBQU87QUFDUCxzQkFBYyxRQUFRLFNBQVMsT0FBTyxFQUFFLGVBQWUsYUFBYSxPQUFPO0FBQzNFLHNCQUFjLFlBQVksU0FBUyxLQUFLLFlBQVksTUFBTSxHQUFHLEVBQUUsSUFBSSxRQUFRO0FBQzNFLGVBQU8sT0FBTyxRQUFRLFNBQVMsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLGtCQUFrQjtBQUN2RSxnQkFBUSxNQUFNLGdCQUFnQixRQUFRLFNBQVMsT0FBTyxFQUFFLE1BQU0sUUFBUSxhQUFhLFVBQVU7QUFDN0YsbUJBQVcsUUFBUSxTQUFTLE9BQU8sRUFBRSxTQUFTLFNBQVMsS0FBSyxRQUFRLFNBQVMsT0FBTyxFQUFFLFNBQVMsTUFBTSxHQUFHLEVBQUUsSUFBSSxRQUFRLFFBQVEsU0FBUyxPQUFPLEVBQUU7QUFDaEosa0JBQVUsS0FBSyxDQUFFLE1BQU0sYUFBYSxNQUFNLE9BQU8sUUFBUyxDQUFDO0FBQzNELHdCQUFnQjtBQUFBLE1BQ3BCO0FBQUEsSUFDSjtBQUNBLFFBQUksQ0FBQyxlQUFlO0FBQ2hCLGdCQUFVLEtBQUssQ0FBRSxhQUFhLElBQUksSUFBSSxJQUFJLEVBQUcsQ0FBQztBQUFBLElBQ2xEO0FBQUEsRUFDSjtBQUVBLFFBQU0sU0FBUyxNQUFNLFlBQVksT0FBTztBQUN4QyxRQUFNLE9BQU8sT0FBTyxRQUFRO0FBRzVCLFFBQU0sU0FBUztBQUNmLFFBQU0sU0FBUyxLQUFLLFVBQVUsSUFBSTtBQUNsQyxRQUFNLFlBQVk7QUFDbEIsUUFBTSxlQUFlLENBQUMsS0FBSyxLQUFLLElBQUksSUFBSSxHQUFHO0FBRzNDLFFBQU0sV0FBVyxDQUFDLEdBQUcsR0FBRyxPQUFPLFdBQVc7QUFBRSxTQUFLLGNBQWMsRUFBRSxHQUFHLEdBQUcsT0FBTyxRQUFRLGFBQWEsSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFJLGFBQWEsRUFBSSxDQUFDO0FBQUEsRUFBSTtBQUV4SSxRQUFNLFVBQVUsQ0FBQyxNQUFNLEdBQUcsTUFBTTtBQUFHLFdBQU8sT0FBTyxJQUFJO0FBQU0sU0FBSyxTQUFTLE1BQU0sRUFBRSxHQUFHLEdBQUcsTUFBTSxHQUFHLE9BQU8sSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFJLENBQUM7QUFBQSxFQUFJO0FBRTNILFlBQVUsUUFBUSxDQUFDLEtBQUssYUFBYTtBQUNqQyxVQUFNLE9BQU8sU0FBUyxXQUFXO0FBQ2pDLFFBQUksUUFBUSxDQUFDLFVBQVUsZ0JBQWdCO0FBQ25DLFlBQU0sT0FBTyxTQUFTLGFBQWEsTUFBTSxHQUFHLFdBQVcsRUFBRSxPQUFPLENBQUMsS0FBSyxRQUFRLE1BQU0sS0FBSyxDQUFDO0FBQzFGLGVBQVMsTUFBTSxPQUFPLFdBQVcsYUFBYSxXQUFXLEdBQUcsU0FBUztBQUNyRSxjQUFRLFVBQVUsT0FBTyxHQUFHLE9BQU8sWUFBWSxDQUFDO0FBQUEsSUFDcEQsQ0FBQztBQUFBLEVBQ0wsQ0FBQztBQUVELFFBQU0sV0FBVyxNQUFNLE9BQU8sS0FBSztBQUNuQyxTQUFPO0FBQ1g7QUFnQ0EsZUFBZSxZQUFZLGFBQWE7QUFFcEMsUUFBTSxVQUFVLE1BQU0sWUFBWSxPQUFPO0FBQ3pDLGFBQVcsV0FBVyxhQUFhO0FBQy9CLFFBQUksV0FBVyxNQUFNSyxJQUFHLFNBQVMsU0FBUyxPQUFPO0FBRWpELFFBQUksV0FBVyxRQUFRLEdBQUU7QUFDckIsWUFBTUMsT0FBTSxNQUFNLFlBQVksS0FBSyxRQUFRO0FBQzNDLFlBQU0sY0FBYyxNQUFNLFFBQVEsVUFBVUEsTUFBS0EsS0FBSSxlQUFlLENBQUM7QUFDckUsa0JBQVksUUFBUSxDQUFDLFNBQVM7QUFDMUIsZ0JBQVEsUUFBUSxJQUFJO0FBQUEsTUFDeEIsQ0FBQztBQUFBLElBQ0w7QUFBQSxFQUVKO0FBRUEsUUFBTSxXQUFXLE1BQU0sUUFBUSxLQUFLO0FBQ3BDLFNBQU87QUFDWDtBQWVDTCxRQUFPLEtBQUssOEJBQThCLGVBQWdCLEtBQUssS0FBSyxNQUFNO0FBQ3ZFLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsUUFBTSxhQUFhLElBQUksT0FBTztBQUM5QixRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFDakQsTUFBSyxVQUFVLFNBQVMsV0FBVyxhQUFjO0FBQUUsV0FBTyxJQUFJLEtBQUssRUFBRSxRQUFRRSxHQUFFLG9CQUFvQixFQUFFLENBQUM7QUFBQSxFQUFFO0FBR3hHLFFBQU0sV0FBVyxJQUFJLEtBQUs7QUFDMUIsTUFBSSxVQUFVO0FBQ1YsUUFBSTtBQUNBLFlBQU0sUUFBUSxNQUFNRSxJQUFHLFNBQVMsS0FBSyxRQUFRO0FBQzdDLFVBQUksTUFBTSxZQUFZLEdBQUU7QUFDcEIsY0FBTUEsSUFBRyxTQUFTLEdBQUcsVUFBVSxFQUFFLFdBQVcsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQ25FLE9BQ0s7QUFDRCxjQUFNQSxJQUFHLFNBQVMsT0FBTyxRQUFRO0FBQUEsTUFDckM7QUFDQSxVQUFJLEtBQUssRUFBRSxRQUFPLFdBQVcsUUFBUSxVQUFVLFNBQVFGLEdBQUUsZUFBZSxFQUFJLENBQUM7QUFBQSxJQUNqRixTQUFTLEtBQUs7QUFDVixNQUFBSCxLQUFJLE1BQU0sa0JBQWtCLEdBQUc7QUFDL0IsVUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBTyxTQUFTLFFBQVEsVUFBVSxTQUFRRyxHQUFFLGdCQUFnQixFQUFFLENBQUM7QUFBQSxJQUMxRjtBQUFBLEVBQ0o7QUFDSixDQUFDO0FBV0RGLFFBQU8sS0FBSyw4QkFBOEIsU0FBVSxLQUFLLEtBQUssTUFBTTtBQUNoRSxRQUFNLEVBQUUsT0FBTyxXQUFXLElBQUksSUFBSTtBQUNsQyxRQUFNLFdBQVcsZUFBTyxlQUFlLFVBQVU7QUFHakQsTUFBSSxDQUFDLFlBQVksVUFBVSxTQUFTLFlBQVksYUFBYTtBQUN6RCxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQ3ZEO0FBRUEsUUFBTSxFQUFFLFNBQVMsSUFBSSxJQUFJO0FBQ3pCLE1BQUksVUFBVTtBQUNWLFFBQUksU0FBUyxVQUFVLENBQUMsUUFBUTtBQUM1QixVQUFJLEtBQUs7QUFDTCxRQUFBSCxLQUFJLE1BQU0sR0FBRztBQUNiLFlBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVFHLEdBQUUsZ0JBQWdCLEVBQUUsQ0FBQztBQUFBLE1BQ3hEO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTCxPQUFPO0FBRUgsUUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUUEsR0FBRSxnQkFBZ0IsRUFBRSxDQUFDO0FBQUEsRUFDeEQ7QUFDSixDQUFDO0FBWUFGLFFBQU8sS0FBSyxnQ0FBZ0MsT0FBTyxLQUFLLEtBQUssU0FBUztBQUNuRSxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sT0FBTyxJQUFJLEtBQUs7QUFDdEIsUUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixRQUFNLFdBQVcsSUFBSSxLQUFLO0FBQzFCLFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFFdkIsTUFBSyxVQUFVLFNBQVMsV0FBVyxlQUFlLENBQUMsV0FBVyxPQUFPLFFBQVMsR0FBRztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQUl4SSxNQUFJLFNBQVMsc0JBQXNCO0FBRS9CLFFBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsVUFBVSxLQUFLO0FBQzFFLFFBQUksU0FBUztBQUNULGNBQVEsT0FBTyxZQUFZLElBQUk7QUFDL0IsY0FBUSxPQUFPLE9BQU8sSUFBSSxDQUFDO0FBQzNCLFVBQUksSUFBSSxFQUFDLE1BQVksQ0FBQztBQUFBLElBQzFCO0FBQUEsRUFDSixXQUNTLFNBQVMsUUFBUTtBQUNsQixRQUFJLFVBQVUsdUJBQXVCLDBCQUEwQixRQUFRO0FBQ3ZFLFFBQUksU0FBUyxRQUFRO0FBQUEsRUFDN0IsV0FDUyxTQUFTLE9BQU87QUFFckIsUUFBSSxjQUFjLFNBQVMsT0FBTyxNQUFNO0FBQ3hDLFFBQUksY0FBY0MsTUFBSyxLQUFLLGVBQU8sZUFBZSxXQUFXO0FBQzdELFVBQU0sYUFBYSxVQUFVLFdBQVc7QUFDeEMsUUFBSSxVQUFVLHVCQUF1QiwwQkFBMEIsUUFBUTtBQUN2RSxRQUFJLFNBQVMsYUFBWSxRQUFRO0FBQUEsRUFDckM7QUFFSixDQUFDO0FBTURILFFBQU8sS0FBSyx3Q0FBd0MsT0FBTyxLQUFLLEtBQUssU0FBUztBQUMxRSxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sUUFBUSxJQUFJLEtBQUs7QUFFdkIsTUFBSyxVQUFVLFNBQVMsV0FBVyxlQUFlLENBQUMsV0FBVyxPQUFPLFFBQVMsR0FBRztBQUFFLFdBQU8sSUFBSSxLQUFLLEVBQUUsUUFBUUUsR0FBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQUEsRUFBRTtBQUd4SSxNQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssYUFBVyxRQUFRLFVBQVUsS0FBSztBQUMxRSxNQUFJLFNBQVM7QUFFVCxRQUFJLGVBQWUsU0FBUztBQUM1QixRQUFJLGNBQWMsYUFBYSxhQUFhLGFBQWEsYUFBYTtBQUN0RSxRQUFJLFNBQVMsWUFBWTtBQUN6QixRQUFJLFNBQVMsWUFBWTtBQUV6QixRQUFJLFlBQVksQ0FBQztBQUNqQixRQUFJLGNBQWMsQ0FBQztBQUNuQixRQUFJLFVBQVUsS0FBSztBQUNmLGtCQUFZLE9BQU87QUFDbkIsb0JBQWMsT0FBTztBQUFBLElBQ3pCLFdBQ1MsVUFBVSxLQUFLO0FBQ3BCLGtCQUFZLE9BQU87QUFDbkIsb0JBQWMsT0FBTztBQUFBLElBQ3pCO0FBR0EsUUFBSSxLQUFLLEVBQUUsUUFBTyxXQUFXLFFBQVEsVUFBVSxXQUFzQixZQUEwQixDQUFDO0FBQUEsRUFDcEcsT0FDSztBQUNELFFBQUksS0FBSyxFQUFFLFFBQU8sU0FBUyxRQUFRLFVBQVUsU0FBUUEsR0FBRSxvQkFBb0IsRUFBRyxDQUFDO0FBQUEsRUFDbkY7QUFJSixDQUFDO0FBaUJBRixRQUFPLEtBQUssc0NBQXNDLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDekUsUUFBTSxlQUFlLElBQUksT0FBTztBQUNoQyxRQUFNLGFBQWEsSUFBSSxPQUFPO0FBQzlCLFFBQU0sV0FBVyxlQUFPLGVBQWUsVUFBVTtBQUNqRCxRQUFNLEVBQUUsTUFBTSxTQUFTLElBQUksSUFBSTtBQUMvQixRQUFNLGNBQWMsT0FBTyxLQUFLLE1BQU0sUUFBUTtBQUU5QyxNQUFLLENBQUMsV0FBVyxjQUFjLFFBQVMsR0FBSTtBQUFFLFFBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUUsT0FDdkY7QUFDRCxRQUFJLFNBQVM7QUFDYixVQUFNLE1BQU0sb0JBQUksS0FBSztBQUNyQixRQUFJLE9BQU8sSUFBSSxtQkFBbUIsT0FBTztBQUN6QyxRQUFJLGFBQWEsT0FBTyxJQUFJLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFFL0MsVUFBTSxPQUFPLElBQUksWUFBWTtBQUM3QixVQUFNLFFBQVEsT0FBTyxJQUFJLFNBQVMsSUFBSSxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDeEQsVUFBTSxNQUFNLE9BQU8sSUFBSSxRQUFRLENBQUMsRUFBRSxTQUFTLEdBQUcsR0FBRztBQUNqRCxVQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsS0FBSyxHQUFHLEdBQUc7QUFFeEMsUUFBSSxVQUFVLEdBQUcsVUFBVSxJQUFJLFVBQVU7QUFFekMsUUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsUUFBSSxtQkFBbUJDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLFFBQVE7QUFDbkgsUUFBSSxtQkFBb0JBLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksUUFBUSxVQUFVO0FBRTFHLFFBQUksb0JBQW9CQSxNQUFLLEtBQUssa0JBQWtCLE9BQU87QUFDM0QsUUFBSTtBQUNBLFlBQU1DLElBQUcsU0FBUyxNQUFNLGtCQUFrQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQzdELFlBQU1BLElBQUcsU0FBUyxNQUFNLG1CQUFtQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsSUFDbEUsU0FDTyxLQUFLO0FBQ1IsTUFBQUwsS0FBSSxNQUFNLG9CQUFvQixHQUFHO0FBQUEsSUFDckM7QUFFQSxRQUFJLE1BQUs7QUFFTCxVQUFJLFNBQVMsU0FBUyxNQUFNLEdBQUU7QUFDMUIsUUFBQUEsS0FBSSxLQUFLLGdEQUFnRCxRQUFRLFVBQVU7QUFDM0UsWUFBSSxVQUFVLE1BQU0scUJBQXFCLGtCQUFrQixtQkFBbUIsV0FBVztBQUV6RixZQUFJLGVBQU8sbUJBQW1CLFNBQVE7QUFFbEMsY0FBSSxZQUFhSSxNQUFLLEtBQUssZUFBTyxpQkFBaUIsU0FBUyxXQUFXLFlBQVksUUFBUSxZQUFZLE9BQU87QUFDOUcsVUFBQUosS0FBSSxLQUFLLGdEQUFnRCxpQkFBaUIsU0FBUyxTQUFTLEdBQUc7QUFDL0YsY0FBSTtBQUNBLGtCQUFNSyxJQUFHLFNBQVMsTUFBTSxXQUFXLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDdEQsa0JBQU1BLElBQUcsU0FBUyxHQUFHLG1CQUFtQixXQUFXLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxVQUMxRSxTQUNPLEtBQUs7QUFDUixZQUFBTCxLQUFJLE1BQU0sb0JBQW9CLEdBQUc7QUFBQSxVQUNyQztBQUFBLFFBQ0o7QUFDQSxZQUFJLEtBQUssRUFBRSxRQUFPLFdBQVcsUUFBUSxVQUFVLFNBQVFHLEdBQUUsbUJBQW1CLEdBQUcsT0FBZ0IsQ0FBQztBQUFBLE1BQ3BHLE9BQ0s7QUFDRCxRQUFBSCxLQUFJLE1BQU0sc0NBQXNDO0FBQ2hELFlBQUksS0FBSyxFQUFFLFFBQU8sU0FBVSxRQUFRLFVBQVUsU0FBUUcsR0FBRSxxQkFBcUIsR0FBRyxPQUFlLENBQUM7QUFBQSxNQUNwRztBQUFBLElBQ0osT0FDSztBQUNELFVBQUksS0FBSyxFQUFFLFFBQU8sU0FBVSxRQUFRLFVBQVUsU0FBUUEsR0FBRSxxQkFBcUIsR0FBRyxPQUFlLENBQUM7QUFBQSxJQUNwRztBQUFBLEVBQ0o7QUFDSixDQUFDO0FBU0RGLFFBQU8sS0FBSyxrREFBa0QsT0FBTyxLQUFLLEtBQUssU0FBUztBQUNwRixRQUFNLGNBQWMsSUFBSSxPQUFPO0FBQy9CLFFBQU0sYUFBYSxJQUFJLE9BQU87QUFDOUIsUUFBTSxXQUFXLGVBQU8sZUFBZSxVQUFVO0FBQ2pELFFBQU0sZUFBZSxJQUFJLE9BQU87QUFFaEMsTUFBSyxnQkFBZ0IsU0FBUyxXQUFXLGFBQWM7QUFBRSxXQUFPLElBQUksS0FBSyxFQUFFLFFBQVFFLEdBQUUsb0JBQW9CLEVBQUUsQ0FBQztBQUFBLEVBQUU7QUFHOUcsTUFBSSxrQkFBbUJDLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksU0FBUztBQUNoRyxNQUFJO0FBQ0EsVUFBTUMsSUFBRyxTQUFTLE1BQU0saUJBQWlCLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxFQUNoRSxTQUFTLEtBQUs7QUFBQSxFQUVkO0FBR0EsTUFBSSxJQUFJLE9BQU07QUFFVixRQUFJLGFBQWEsQ0FBQztBQUNsQixRQUFJLENBQUMsTUFBTSxRQUFRLElBQUksTUFBTSxLQUFLLEdBQUU7QUFBRSxpQkFBVyxLQUFLLElBQUksTUFBTSxLQUFLO0FBQUEsSUFBQyxPQUNqRTtBQUFDLG1CQUFhLElBQUksTUFBTTtBQUFBLElBQUs7QUFFbEMsUUFBSSxRQUFRLENBQUM7QUFFYixtQkFBZSxRQUFTLFlBQVk7QUFDaEMsVUFBSSxXQUFXLG1CQUFtQixLQUFLLElBQUk7QUFDM0MsVUFBSSxtQkFBbUJELE1BQUssS0FBSyxpQkFBaUIsUUFBUTtBQUMxRCxZQUFNLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxRQUFRO0FBQ3JDLFlBQUksS0FBSztBQUFFLFVBQUFKLEtBQUksTUFBT0csR0FBRSxvQkFBb0IsQ0FBRTtBQUFBLFFBQUU7QUFBQSxNQUNwRCxDQUFDO0FBQ0QsWUFBTSxLQUFLLEVBQUUsTUFBSyxVQUFXLE1BQUssaUJBQWlCLENBQUM7QUFBQSxJQUN4RDtBQUdBLFFBQUksaUJBQWlCLE9BQU07QUFDdkIsZUFBUyxXQUFXLFNBQVMsYUFBWTtBQUNyQyxnQkFBUSxPQUFPLFlBQVksSUFBSTtBQUMvQixnQkFBUSxPQUFPLE9BQU8sSUFBSztBQUFBLE1BQy9CO0FBQUEsSUFDSixXQUNTLGdCQUFnQixPQUFPLGdCQUFnQixLQUFJO0FBQ2hELFVBQUksYUFBYSxDQUFDO0FBQ2xCLFVBQUksZ0JBQWdCLEtBQUk7QUFBQyxxQkFBYSxTQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLE9BQU87QUFBQSxNQUFNO0FBQzNILFVBQUksZ0JBQWdCLEtBQUk7QUFBQyxxQkFBYSxTQUFTLGFBQWEsYUFBYSxTQUFTLGFBQWEsYUFBYSxFQUFFLE9BQU87QUFBQSxNQUFNO0FBRTNILFVBQUksV0FBVyxTQUFTLEdBQUc7QUFDdkIsaUJBQVMsUUFBUSxZQUFXO0FBQ3hCLGNBQUksVUFBVSxTQUFTLFlBQVksS0FBSyxhQUFXLFFBQVEsZUFBZSxJQUFJO0FBQzlFLGNBQUksU0FBUztBQUNULG9CQUFRLE9BQU8sWUFBWSxJQUFHO0FBQzlCLG9CQUFRLE9BQU8sT0FBTyxJQUFJO0FBQUEsVUFDOUI7QUFBQSxRQUNKO0FBQUEsTUFDSixPQUNLO0FBQ0QsZUFBTyxJQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFBLEdBQUUscUJBQXFCLEVBQUUsQ0FBQztBQUFBLE1BQzNGO0FBQUEsSUFFSixPQUNLO0FBQ0QsVUFBSSxVQUFVLFNBQVMsWUFBWSxLQUFLLGFBQVcsUUFBUSxVQUFVLFlBQVk7QUFDakYsVUFBSSxTQUFTO0FBQ1QsZ0JBQVEsT0FBTyxZQUFZLElBQUc7QUFDOUIsZ0JBQVEsT0FBTyxPQUFPLElBQUk7QUFBQSxNQUM5QjtBQUFBLElBQ0o7QUFDQSxRQUFJLEtBQUssRUFBRSxRQUFPLFdBQVcsUUFBUSxVQUFVLFNBQVFBLEdBQUUsbUJBQW1CLEVBQUcsQ0FBQztBQUFBLEVBQ3BGLE9BQ0s7QUFDRCxRQUFJLEtBQUssRUFBRSxRQUFPLFNBQVUsUUFBUSxVQUFVLFNBQVFBLEdBQUUscUJBQXFCLEVBQUUsQ0FBQztBQUFBLEVBQ3BGO0FBRUosQ0FBQztBQW9CRCxJQUFPLGVBQVFGO0FBR2YsSUFBTSx3QkFBd0I7QUFDOUIsSUFBSSxrQkFBa0I7QUFDdEIsSUFBTSxlQUFlLENBQUM7QUFFdEIsU0FBUyxpQkFBaUI7QUFDdEIsTUFBSSxtQkFBbUIsc0JBQXVCO0FBQzlDLFFBQU0sTUFBTSxhQUFhLE1BQU07QUFDL0IsTUFBSSxDQUFDLElBQUs7QUFFVjtBQUdBLE1BQUksRUFDQyxNQUFNLE1BQU07QUFBQSxFQUFDLENBQUMsRUFDZCxRQUFRLE1BQU07QUFHWDtBQUNBLGlCQUFhLGNBQWM7QUFBQSxFQUMvQixDQUFDO0FBQ1Q7QUFFQSxlQUFlLHFCQUFxQixrQkFBa0IsbUJBQW1CLGFBQVk7QUFHakYsU0FBTyxJQUFJLFFBQVEsQ0FBQyxZQUFZO0FBQzVCLFVBQU1NLFFBQU8sWUFBWTtBQUNyQixVQUFJO0FBQ0EsY0FBTUYsSUFBRyxTQUFTLFVBQVUsa0JBQWtCLFdBQVc7QUFHekQsY0FBTSxRQUFRLGtCQUFrQjtBQUFBLFVBQzVCLEtBQUs7QUFBQSxVQUNMLFNBQVMsQ0FBQyxPQUFPLFlBQVk7QUFDekIsa0JBQU0sU0FBU0QsTUFBSyxVQUFVQSxNQUFLLEtBQUssbUJBQW1CLE1BQU0sUUFBUSxDQUFDO0FBQzFFLGdCQUFJLENBQUMsT0FBTyxXQUFXQSxNQUFLLFVBQVUsb0JBQW9CQSxNQUFLLEdBQUcsQ0FBQyxHQUFHO0FBQ2xFLHNCQUFRLE1BQU07QUFDZCxvQkFBTSxJQUFJLE1BQU0sNkJBQTZCLE1BQU0sUUFBUTtBQUFBLFlBQy9EO0FBQUEsVUFDSjtBQUFBLFFBQ0osQ0FBQztBQUVELFlBQUk7QUFBRSxnQkFBTUMsSUFBRyxTQUFTLE9BQU8sZ0JBQWdCO0FBQUEsUUFBRyxTQUFTLEdBQUc7QUFBQSxRQUFlO0FBQzdFLFFBQUFMLEtBQUksS0FBSyxzREFBc0QsaUJBQWlCLEVBQUU7QUFDbEYsZ0JBQVEsSUFBSTtBQUFBLE1BQ2hCLFNBQVMsS0FBSztBQUNWLFFBQUFBLEtBQUksTUFBTSw4QkFBOEIsR0FBRztBQUMzQyxZQUFJO0FBQUUsZ0JBQU1LLElBQUcsU0FBUyxPQUFPLGdCQUFnQjtBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUEsUUFBZTtBQUM3RSxnQkFBUSxLQUFLO0FBQUEsTUFDakI7QUFBQSxJQUNKO0FBRUEsaUJBQWEsS0FBS0UsS0FBSTtBQUN0QixRQUFJLGtCQUFrQixzQkFBdUIsY0FBYSxjQUFjO0FBQUEsRUFDNUUsQ0FBQztBQUNMO0FBTUEsU0FBUyxXQUFXLE9BQU8sVUFBUztBQUNoQyxNQUFJLGNBQWM7QUFFbEIsTUFBSTtBQUNBLGFBQVMsWUFBWSxRQUFTLENBQUMsWUFBWTtBQUN2QyxVQUFJLFVBQVUsUUFBUSxPQUFPO0FBQ3pCLHNCQUFjO0FBQUEsTUFDbEI7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMLFNBQ00sS0FBSTtBQUNOLElBQUFQLEtBQUksTUFBTSxTQUFTLEdBQUcsRUFBRTtBQUFBLEVBQzVCO0FBRUEsU0FBTztBQUNYO0FBT0EsU0FBUyxhQUFhLFdBQVcsU0FBUztBQUN0QyxRQUFNLFVBQVUsU0FBUyxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFDLENBQUM7QUFDckQsUUFBTSxTQUFTSyxJQUFHLGtCQUFrQixPQUFPO0FBQzNDLFNBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3RDLFlBQ0csVUFBVSxXQUFXLEtBQUssRUFDMUIsR0FBRyxTQUFTLFNBQU8sT0FBTyxHQUFHLENBQUMsRUFDOUIsS0FBSyxNQUFNO0FBRWQsV0FBTyxHQUFHLFNBQVMsTUFBTSxRQUFRLENBQUM7QUFDbEMsWUFBUSxTQUFTO0FBQUEsRUFDbkIsQ0FBQztBQUNMOzs7QVY3dUJPLElBQU0sZUFBZUcsUUFBTztBQU1uQyxhQUFhLElBQUksYUFBYSxlQUFhO0FBQzNDLGFBQWEsSUFBSSxVQUFVLFlBQVU7OztBREZyQyxPQUFPLGFBQWE7QUFDcEIsT0FBT0MsV0FBVTtBQUNqQixPQUFPLGVBQWdCO0FBQ3ZCLE9BQU8sUUFBUTtBQUNmLE9BQU8sU0FBUztBQUNoQixPQUFPQyxTQUFRO0FBQ2YsT0FBTyxRQUFRO0FBQ2YsT0FBTyxXQUFXO0FBRWxCLFNBQVMsb0JBQW9CO0FBRTdCLE9BQU8sa0JBQWtCO0FBQ3pCLFNBQVMsT0FBQUMsWUFBVztBQUNwQixPQUFPQyxVQUFTO0FBTGhCLE1BQU0sUUFBUSxvQkFBb0I7QUFRbEMsZUFBTyxnQkFBZ0IsR0FBRyxRQUFRO0FBQ2xDLGVBQU8sZ0JBQWdCQyxNQUFLLEtBQUssZUFBTyxlQUFlLGVBQU8sZUFBZTtBQUM3RSxlQUFPLGdCQUFnQkEsTUFBSyxLQUFLLEdBQUcsT0FBTyxHQUFHLFVBQVU7QUFFeEQsSUFBSSxDQUFDQyxJQUFHLFdBQVcsZUFBTyxhQUFhLEdBQUU7QUFBRSxFQUFBQSxJQUFHLFVBQVUsZUFBTyxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBRztBQUNwRyxJQUFJLENBQUNBLElBQUcsV0FBVyxlQUFPLGFBQWEsR0FBRTtBQUFFLEVBQUFBLElBQUcsVUFBVSxlQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFHO0FBSXBHLElBQU0sY0FBYyxRQUFRLGFBQWEsVUFDbkNELE1BQUssS0FBSyxRQUFRLElBQUksYUFBYSxHQUFHLFNBQVMsSUFDL0NBLE1BQUssS0FBSyxlQUFPLGVBQWUsU0FBUztBQUcvQyxJQUFJLENBQUNDLElBQUcsV0FBVyxXQUFXLEdBQUc7QUFBRyxFQUFBQSxJQUFHLFVBQVUsYUFBYSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUc7QUFDcEYsSUFBTSxXQUFXRCxNQUFLLEtBQUssYUFBYSxlQUFPLGVBQWU7QUFDOUQsSUFBSTtBQUFDLEVBQUFDLElBQUcsV0FBVyxRQUFRO0FBQUUsU0FBTyxHQUFFO0FBQUM7QUFDdkMsSUFBSTtBQUFJLE1BQUksQ0FBQ0EsSUFBRyxXQUFXLFFBQVEsR0FBRztBQUFFLElBQUFBLElBQUcsWUFBWSxlQUFPLGVBQWUsVUFBVSxVQUFVO0FBQUEsRUFBRztBQUFDLFNBQy9GLEdBQUU7QUFBQyxFQUFBRixLQUFJLE1BQU0sNEJBQTRCO0FBQUM7QUFLaEQsSUFBSTtBQUNBLFFBQU0sRUFBQyxTQUFTLFdBQVcsTUFBSyxJQUFLLGFBQWE7QUFDbEQsaUJBQU8sU0FBUyxHQUFHLFFBQVEsS0FBSztBQUNoQyxpQkFBTyxVQUFVO0FBQ3JCLFNBQ1EsR0FBRztBQUNSLEVBQUFBLEtBQUksTUFBTSwyQ0FBMkM7QUFDckQsaUJBQU8sU0FBUyxHQUFHLFFBQVE7QUFDM0IsRUFBQUEsS0FBSSxLQUFLLFlBQVksZUFBTyxNQUFNLEVBQUU7QUFDcEMsaUJBQU8sVUFBVTtBQUVuQjtBQU1ELElBQU0sVUFBVSxVQUFVO0FBQUEsRUFDdEIsVUFBVSxJQUFJLEtBQUs7QUFBQTtBQUFBLEVBQ25CLEtBQUs7QUFBQTtBQUFBLEVBQ0wsaUJBQWlCO0FBQUE7QUFBQSxFQUNqQixlQUFlO0FBQUE7QUFDbkIsQ0FBQztBQUdELFFBQVEsYUFBYSxlQUFPLGFBQWE7QUFHekMsSUFBTSxhQUFhRCxLQUFJLGFBQ25CRSxNQUFLLEtBQUssUUFBUSxlQUFjLHFCQUFxQixRQUFRLElBQzdEQSxNQUFLLEtBQUssUUFBUTtBQWN0QixJQUFNLE1BQU0sUUFBUTtBQUNwQixJQUFJLElBQUksV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLEtBQUssT0FBTyxLQUFLLEVBQUcsQ0FBQyxDQUFDO0FBQy9ELElBQUksSUFBSSxRQUFRLEtBQUssRUFBRSxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZDLElBQUksSUFBSSxRQUFRLFdBQVcsRUFBQyxVQUFVLEtBQUksQ0FBQyxDQUFDO0FBQzVDLElBQUksSUFBSSxJQUFJLENBQUM7QUFDYixJQUFJLElBQUksS0FBSyxDQUFDO0FBQ2QsSUFBSSxJQUFJLFdBQVUsUUFBUSxPQUFPLGVBQU8sYUFBYSxDQUFDO0FBQ3RELElBQUksSUFBSSxhQUFhLENBQUM7QUFHdEIsSUFBSSxvQkFBb0I7QUFHeEIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFNBQVM7QUFDeEIsUUFBTSxZQUFZLEtBQUssSUFBSTtBQUMzQixRQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sSUFBSSxJQUFJLEdBQUc7QUFFMUMsTUFBSSxHQUFHLFVBQVUsTUFBTTtBQUNuQixVQUFNLFdBQVcsS0FBSyxJQUFJLElBQUk7QUFDOUIsUUFBSSxXQUFXLEtBQU07QUFDakIsTUFBQUQsS0FBSSxLQUFLLGtDQUFrQyxTQUFTLFNBQVMsUUFBUSxJQUFJO0FBQUEsSUFDN0U7QUFDQSxRQUFJLG9CQUFvQixLQUFLO0FBQ3pCLE1BQUFBLEtBQUksS0FBSyx1QkFBdUIsaUJBQWlCLDhCQUE4QixTQUFTLEVBQUU7QUFBQSxJQUM5RjtBQUFBLEVBQ0osQ0FBQztBQUVELE1BQUksR0FBRyxTQUFTLE1BQU07QUFDbEIsUUFBSSxDQUFDLElBQUksYUFBYTtBQUNsQixZQUFNLFdBQVcsS0FBSyxJQUFJLElBQUk7QUFDOUIsTUFBQUEsS0FBSSxLQUFLLDZDQUE2QyxTQUFTLFVBQVUsUUFBUSxJQUFJO0FBQUEsSUFDekY7QUFBQSxFQUNKLENBQUM7QUFFRCxPQUFLO0FBQ1QsQ0FBQztBQUVELElBQUksSUFBSSxXQUFXLFlBQVk7QUFXL0IsSUFBSSxRQUFRLGFBQWE7QUFFekIsSUFBSSxVQUFVO0FBQUEsRUFDVixLQUFLLE1BQU07QUFBQSxFQUNYLE1BQU0sTUFBTTtBQUFBLEVBQ1osYUFBYTtBQUFBLEVBQ2Isb0JBQW9CO0FBQUEsRUFDcEIsT0FBTztBQUNUO0FBRUYsSUFBTSxTQUFTLE1BQU0sYUFBYSxTQUFTLEdBQUc7QUFHOUMsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sbUJBQW1CO0FBQzFCLE9BQU8saUJBQWlCO0FBR3hCLE9BQU8sR0FBRyxjQUFjLENBQUMsV0FBVztBQUNoQztBQUNBLE1BQUksb0JBQW9CLEtBQUs7QUFDekIsSUFBQUEsS0FBSSxLQUFLLGtDQUFrQyxpQkFBaUIsRUFBRTtBQUFBLEVBQ2xFO0FBQ0EsU0FBTyxHQUFHLFNBQVMsTUFBTTtBQUNyQjtBQUFBLEVBQ0osQ0FBQztBQUNMLENBQUM7QUFFRCxJQUFJLGVBQU8sYUFBWTtBQUNuQixTQUFPLE9BQU8sZUFBTyxlQUFlLE1BQU07QUFDdEMsSUFBQUEsS0FBSSxLQUFLLHdDQUF3QyxlQUFPLE1BQU0sSUFBSSxlQUFPLGFBQWEsRUFBRTtBQUFBLEVBQzVGLENBQUM7QUFDRCxNQUFJLGVBQU8sUUFBUTtBQUNmLDRCQUFnQixLQUFLO0FBQUEsRUFDekI7QUFDSjtBQU1BLElBQU8saUJBQVE7QUFLZixTQUFTLGVBQWU7QUFDcEIsTUFBSSxNQUFPLE1BQU0sSUFBSTtBQUNyQixNQUFJLE1BQU0sTUFBTTtBQUNoQixNQUFJLE9BQU8sTUFBTSxPQUFPLGFBQWEsRUFBRTtBQUN2QyxNQUFJLE9BQU8sSUFBSSxnQkFBZ0IsRUFBQyxNQUFNLE1BQU0sS0FBVSxDQUFDO0FBQ3ZELE1BQUksT0FBTyxJQUFJLGtCQUFrQjtBQUNqQyxPQUFLLFlBQVksS0FBSztBQUN0QixPQUFLLGFBQWEsS0FBSztBQUN2QixPQUFLLEtBQUssS0FBSyxVQUFVO0FBQ3pCLE1BQUksV0FBVyxJQUFJLGdCQUFnQixLQUFLLFVBQVU7QUFDbEQsTUFBSSxXQUFXLElBQUksaUJBQWlCLElBQUk7QUFDeEMsU0FBTyxFQUFDLEtBQUssVUFBVyxNQUFNLFNBQVE7QUFDMUM7OztBWWpNQSxPQUFPRyxTQUFRO0FBR2YsU0FBUyxpQkFBQUMsZ0JBQWUsU0FBUyxVQUFBQyxlQUFjO0FBQy9DLFNBQVEsUUFBQUMsYUFBVztBQUNuQixPQUFPQyxVQUFTO0FBQ2hCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsWUFBWTtBQUNyQixTQUFTLGdCQUFBQyxxQkFBbUI7QUFDNUIsT0FBT0MsU0FBUTtBQUdmLE9BQU8sb0JBQW9CO0FBRzNCLElBQU0sYUFBTixNQUFpQjtBQUFBLEVBQ2IsY0FBZTtBQUNYLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBUztBQUNkLFNBQUssZ0JBQWdCO0FBQ3JCLFNBQUssYUFBYSxDQUFDO0FBQ25CLFNBQUssb0JBQW9CO0FBQUEsRUFDN0I7QUFBQSxFQUNBLEtBQU0sSUFBSUMsU0FBUSxJQUFJLElBQUk7QUFDdEIsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxTQUFTQTtBQUNkLFNBQUssZ0JBQWdCO0FBQ3JCLFNBQUssdUJBQXVCO0FBSzVCLFNBQUsscUJBQXFCLFlBQVk7QUFDbEMsVUFBSSxLQUFLLG1CQUFtQjtBQUN4QjtBQUFBLE1BQ0o7QUFFQSxXQUFLLG9CQUFvQjtBQUV6QixhQUFPLEtBQUssV0FBVyxTQUFTLEdBQUc7QUFDL0IsY0FBTSxNQUFNLEtBQUssV0FBVyxNQUFNO0FBQ2xDLFFBQUFDLEtBQUksS0FBSywwREFBMEQsS0FBSyxXQUFXLE1BQU0sc0JBQXNCO0FBRS9HLFlBQUk7QUFDQSxnQkFBTSxLQUFLLGlCQUFpQixJQUFJLFdBQVcsSUFBSSxhQUFhLElBQUksV0FBVztBQUMzRSxjQUFJLFFBQVEsSUFBSTtBQUFBLFFBQ3BCLFNBQVMsT0FBTztBQUNaLFVBQUFBLEtBQUksTUFBTSxzREFBc0QsTUFBTSxPQUFPLEVBQUU7QUFDL0UsY0FBSSxPQUFPLEtBQUs7QUFBQSxRQUNwQjtBQUFBLE1BQ0o7QUFFQSxXQUFLLG9CQUFvQjtBQUN6QixNQUFBQSxLQUFJLEtBQUssd0VBQXdFO0FBQUEsSUFDckY7QUFLQSxTQUFLLG1CQUFtQixPQUFPLFdBQVcsYUFBYSxnQkFBZ0I7QUFDbkUsYUFBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDcEMsWUFBSSxZQUFZLElBQUlDLGVBQWM7QUFBQSxVQUM5QixNQUFNO0FBQUEsVUFDTixnQkFBZ0I7QUFBQTtBQUFBLFVBQ2hCLGdCQUFnQjtBQUFBLFlBQ1osU0FBUztBQUFBLFlBQ1QsYUFBYTtBQUFBLFlBQ2IsWUFBWTtBQUFBO0FBQUEsVUFDaEI7QUFBQSxRQUNKLENBQUM7QUFHRCxrQkFBVSxZQUFZLGNBQWMsQ0FBRztBQUV2QyxZQUFJLFVBQVU7QUFDZCxZQUFJLGdCQUFnQixPQUFPO0FBQ3ZCLG9CQUFVLCtCQUErQixTQUFTO0FBQUEsUUFDdEQsV0FDUyxnQkFBZ0IsU0FBUztBQUM5QixvQkFBVSwwQkFBMEIsU0FBUztBQUFBLFFBQ2pELE9BQU87QUFDSCxVQUFBRCxLQUFJLE1BQU0sc0RBQXNEO0FBQ2hFLGNBQUksYUFBYSxDQUFDLFVBQVUsWUFBWSxHQUFHO0FBQ3ZDLHNCQUFVLE1BQU07QUFBQSxVQUNwQjtBQUNBLGlCQUFPLElBQUksTUFBTSxzQkFBc0IsQ0FBQztBQUN4QztBQUFBLFFBQ0o7QUFFQSxrQkFBVSxHQUFHLFVBQVUsTUFBTTtBQUFFLHNCQUFZO0FBQUEsUUFBTSxDQUFDO0FBRWxELGtCQUFVLFlBQVksR0FBRyxvQkFBb0IsWUFBWTtBQUNyRCxjQUFJO0FBQ0Esa0JBQU0sZ0JBQWdCLE1BQU0sVUFBVSxZQUFZLGtCQUFrQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkEyQm5FO0FBRUQsZ0JBQUksZUFBZTtBQUNmLGNBQUFBLEtBQUksS0FBSyx5Q0FBeUMsV0FBVyw0QkFBNEIsV0FBVyxFQUFFO0FBR3RHLG9CQUFNLGVBQWUsV0FBVyxNQUFNO0FBQ2xDLGdCQUFBQSxLQUFJLE1BQU0sZ0VBQWdFLFdBQVcsRUFBRTtBQUN2RixvQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsNEJBQVUsTUFBTTtBQUFBLGdCQUNwQjtBQUNBLHVCQUFPLElBQUksTUFBTSxtQkFBbUIsQ0FBQztBQUFBLGNBQ3pDLEdBQUcsR0FBSztBQUVSLHdCQUFVLFlBQVksTUFBTTtBQUFBLGdCQUN4QixRQUFRO0FBQUEsZ0JBQ1IsWUFBWTtBQUFBLGdCQUNaLGlCQUFpQjtBQUFBLGdCQUNqQixhQUFhO0FBQUEsZ0JBQ2IsZUFBZTtBQUFBLGdCQUNmLFdBQVc7QUFBQSxnQkFDWCxLQUFLO0FBQUEsa0JBQ0QsWUFBWTtBQUFBLGtCQUNaLFVBQVU7QUFBQSxnQkFDZDtBQUFBLGdCQUNBLFVBQVU7QUFBQSxnQkFDVixTQUFTO0FBQUEsa0JBQ0wsWUFBWTtBQUFBLGdCQUNoQjtBQUFBLGNBQ0osR0FBRyxDQUFDLFNBQVMsa0JBQWtCO0FBQzNCLDZCQUFhLFlBQVk7QUFFekIsb0JBQUksQ0FBQyxTQUFTO0FBQ1Ysa0JBQUFBLEtBQUksTUFBTSwrREFBK0QsV0FBVyxLQUFLLGlCQUFpQixnQkFBZ0IsRUFBRTtBQUM1SCxzQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsOEJBQVUsTUFBTTtBQUFBLGtCQUNwQjtBQUNBLHlCQUFPLElBQUksTUFBTSxpQkFBaUIsa0JBQWtCLENBQUM7QUFBQSxnQkFDekQsT0FBTztBQUNILGtCQUFBQSxLQUFJLEtBQUssdUZBQXVGLFdBQVcsRUFBRTtBQUM3RyxzQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsOEJBQVUsTUFBTTtBQUFBLGtCQUNwQjtBQUNBLDBCQUFRLElBQUk7QUFBQSxnQkFDaEI7QUFBQSxjQUNKLENBQUM7QUFBQSxZQUNMLE9BQU87QUFDSCxjQUFBQSxLQUFJLE1BQU0sd0RBQXdEO0FBQ2xFLGtCQUFJLGFBQWEsQ0FBQyxVQUFVLFlBQVksR0FBRztBQUN2QywwQkFBVSxNQUFNO0FBQUEsY0FDcEI7QUFDQSxxQkFBTyxJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFBQSxZQUM5QztBQUFBLFVBQ0osU0FBUyxPQUFPO0FBQ1osWUFBQUEsS0FBSSxNQUFNLDBEQUEwRCxNQUFNLE9BQU8sRUFBRTtBQUNuRixnQkFBSSxhQUFhLENBQUMsVUFBVSxZQUFZLEdBQUc7QUFDdkMsd0JBQVUsTUFBTTtBQUFBLFlBQ3BCO0FBQ0EsbUJBQU8sS0FBSztBQUFBLFVBQ2hCO0FBQUEsUUFDSixDQUFDO0FBRUQsa0JBQVUsUUFBUSxPQUFPLEVBQUUsTUFBTSxDQUFDLFVBQVU7QUFDeEMsVUFBQUEsS0FBSSxNQUFNLHFEQUFxRCxNQUFNLE9BQU8sRUFBRTtBQUM5RSxjQUFJLGFBQWEsQ0FBQyxVQUFVLFlBQVksR0FBRztBQUN2QyxzQkFBVSxNQUFNO0FBQUEsVUFDcEI7QUFDQSxpQkFBTyxLQUFLO0FBQUEsUUFDaEIsQ0FBQztBQUFBLE1BQ0wsQ0FBQztBQUFBLElBQ0w7QUFLQSxZQUFRLEdBQUcsWUFBWSxDQUFDLE9BQU8sWUFBWTtBQUN2QyxNQUFBQSxLQUFJLEtBQUssK0RBQStELE9BQU87QUFDL0UsV0FBSyxjQUFjLGtCQUFrQixPQUFPO0FBQzVDLFlBQU0sY0FBYztBQUFBLElBQ3hCLENBQUM7QUFLRCxZQUFRLE9BQU8sbUJBQW1CLENBQUMsT0FBTyxlQUFlO0FBQ3JELFlBQU0sV0FBVyxLQUFLLE9BQU8sZUFBZSxVQUFVO0FBQ3RELFVBQUksVUFBVztBQUFFLGVBQU8sU0FBUztBQUFBLE1BQWMsT0FDMUM7QUFBWSxlQUFPO0FBQUEsTUFBTztBQUFBLElBQ25DLENBQUM7QUFNRCxZQUFRLE9BQU8sY0FBYyxDQUFDLE9BQU8sZUFBZTtBQUNoRCxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLFVBQVc7QUFDWCxpQkFBUyxrQkFBa0IsS0FBSztBQUNoQyxpQkFBUyxPQUFPLE1BQU07QUFDdEIsZUFBT0QsUUFBTyxlQUFlLFVBQVU7QUFDdkMsYUFBSyxnQkFBZ0IsaUJBQWlCLEtBQUssZ0JBQWdCLGVBQWUsT0FBTyxVQUFRLEtBQUssZUFBZSxVQUFVO0FBQ3ZILGVBQU87QUFBQSxNQUNYLE9BQ0s7QUFBRyxlQUFPO0FBQUEsTUFBTztBQUFBLElBQzFCLENBQUM7QUFJRCxZQUFRLE9BQU8sZUFBZSxDQUFDLE9BQU8sZUFBZTtBQUNqRCxZQUFNLFdBQVcsS0FBSyxPQUFPLGVBQWUsVUFBVTtBQUN0RCxVQUFJLFVBQVc7QUFDWCxlQUFPLEVBQUMsYUFBYSxTQUFTLFlBQVc7QUFBQSxNQUM3QyxPQUNLO0FBQ0QsZUFBTyxFQUFDLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLGFBQWEsQ0FBQyxFQUFDO0FBQUEsTUFDbEY7QUFBQSxJQUNKLENBQUM7QUFNRCxZQUFRLEdBQUcsY0FBYyxDQUFDLFVBQVU7QUFBRSxXQUFLLGNBQWMsbUJBQW1CO0FBQUksWUFBTSxjQUFjO0FBQUEsSUFBSyxDQUFDO0FBSTFHLFlBQVEsR0FBRyxhQUFhLENBQUMsVUFBVTtBQUMvQixZQUFNLGNBQWMsS0FBSyxXQUFXQSxPQUFNO0FBQUEsSUFDOUMsQ0FBQztBQUlELFlBQVEsT0FBTyxrQkFBa0IsQ0FBQyxVQUFVO0FBQ3hDLGFBQU8sS0FBSyxXQUFXQSxPQUFNO0FBQUEsSUFDakMsQ0FBQztBQUlELFlBQVEsT0FBTyxjQUFjLE9BQU8sVUFBVTtBQUMxQyxZQUFNLE1BQU0sS0FBSyxjQUFjO0FBQy9CLFVBQUksQ0FBQyxJQUFLO0FBRVYsWUFBTSxJQUFJLFlBQVksUUFBUSxXQUFXO0FBQ3pDLFlBQU0sSUFBSSxZQUFZLFFBQVEsaUJBQWlCO0FBQUEsUUFDM0MsVUFBVSxDQUFDLFNBQVM7QUFBQSxNQUN0QixDQUFDO0FBRUgsTUFBQUEsUUFBTyxjQUFjO0FBRXJCLE1BQUFDLEtBQUksS0FBSyxrREFBa0Q7QUFDM0QsYUFBTyxLQUFLLFdBQVdELE9BQU07QUFBQSxJQUNqQyxDQUFDO0FBTUQsWUFBUSxPQUFPLFlBQVksQ0FBQyxPQUFPLGFBQWE7QUFDNUMsWUFBTSxNQUFNLFFBQVEsYUFBYSxVQUFVLGNBQWMsUUFBUSxNQUNqRSxRQUFRLGFBQWEsV0FBVyxTQUFTLFFBQVEsTUFDakQsYUFBYSxRQUFRO0FBRXJCLFVBQUk7QUFDQSxhQUFLLEtBQUssQ0FBQyxVQUFVO0FBQ2pCLGNBQUksT0FBTztBQUNQLFlBQUFDLEtBQUksTUFBTSxnRUFBZ0UsS0FBSztBQUMvRSxtQkFBTztBQUFBLFVBQ1g7QUFDQSxVQUFBQSxLQUFJLEtBQUssdURBQXVEO0FBQ2hFLGlCQUFPO0FBQUEsUUFDWCxDQUFDO0FBQUEsTUFDTCxTQUNNLEtBQUk7QUFDTixRQUFBQSxLQUFJLE1BQU0sNkNBQTZDLEdBQUc7QUFDMUQsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKLENBQUM7QUFHRCxZQUFRLEdBQUcscUJBQXFCLENBQUMsVUFBVTtBQUFJLFlBQU0sY0FBY0QsUUFBTztBQUFBLElBQWUsQ0FBQztBQUcxRixZQUFRLE9BQU8sa0JBQWtCLFlBQVk7QUFDckMsVUFBSSxZQUFZLE1BQU0sZUFBZUEsUUFBTyxhQUFhO0FBQ3pELFVBQUksT0FBTyxLQUFLLE1BQU0sVUFBVSxPQUFPLE9BQU8sT0FBTyxPQUFPLEdBQUksSUFBSTtBQUVwRSxhQUFPO0FBQUEsSUFDZixDQUFDO0FBRUQsWUFBUSxPQUFPLGdCQUFnQixPQUFPLE9BQU8sUUFBUTtBQUNqRCxZQUFNLFNBQVMsTUFBTUcsUUFBTyxlQUFnQixLQUFLLGNBQWMsWUFBWSxFQUFFLFlBQVksQ0FBQyxlQUFlLEVBQUcsQ0FBQztBQUM3RyxVQUFJLENBQUMsT0FBTyxVQUFTO0FBQ2pCLFFBQUFGLEtBQUksS0FBSyx3QkFBd0IsT0FBTyxTQUFTO0FBQ2pELFlBQUksVUFBVTtBQUNkLFlBQUk7QUFDQSxjQUFJLFVBQVVHLE1BQUssT0FBTyxVQUFVLENBQUMsR0FBTUosUUFBTyxlQUFlO0FBQ2pFLGNBQUksQ0FBQ0ssSUFBRyxXQUFXLE9BQU8sR0FBRTtBQUFDLFlBQUFBLElBQUcsVUFBVSxPQUFPO0FBQUEsVUFBQztBQUNsRCxvQkFBVTtBQUVWLFVBQUFMLFFBQU8sa0JBQWtCO0FBQ3pCLFVBQUFDLEtBQUksS0FBSyw4QkFBOEJELE9BQU07QUFBQSxRQUNqRCxTQUNPLEdBQUU7QUFDTCxvQkFBVTtBQUNWLFVBQUFDLEtBQUksTUFBTSxDQUFDO0FBQUEsUUFDZjtBQUNBLGVBQU8sRUFBQyxXQUFXRCxRQUFPLGlCQUFpQixRQUFpQjtBQUFBLE1BQ2hFLE9BQ0s7QUFDRCxlQUFPLEVBQUMsV0FBV0EsUUFBTyxpQkFBaUIsU0FBVSxXQUFVO0FBQUEsTUFDbkU7QUFBQSxJQUNKLENBQUM7QUFHRCxZQUFRLEdBQUcsc0JBQXNCLE9BQU8sT0FBTyxZQUFZO0FBQ3ZELFVBQUksU0FBUTtBQUNSLFFBQUFDLEtBQUksS0FBSywrQkFBK0IsT0FBTztBQUMvQyxZQUFJLFVBQVU7QUFDZCxZQUFJO0FBQ0EsY0FBSSxDQUFDSSxJQUFHLFdBQVcsT0FBTyxHQUFFO0FBQUMsWUFBQUEsSUFBRyxVQUFVLE9BQU87QUFBQSxVQUFDO0FBQ2xELG9CQUFVO0FBQ1YsVUFBQUwsUUFBTyxnQkFBZ0I7QUFBQSxRQUMzQixTQUNPLEdBQUU7QUFDTCxvQkFBVTtBQUNWLFVBQUFDLEtBQUksTUFBTSxDQUFDO0FBQUEsUUFDZjtBQUNBLGNBQU0sY0FBYyxFQUFDLFNBQVNELFFBQU8sZUFBZSxRQUFpQjtBQUFBLE1BQ3pFLE9BQ0s7QUFBRyxjQUFNLGNBQWMsRUFBQyxTQUFTQSxRQUFPLGVBQWUsU0FBVSxXQUFVO0FBQUEsTUFBRTtBQUFBLElBQ3RGLENBQUM7QUFHRCxZQUFRLE9BQU8sMEJBQTBCLE9BQU8sT0FBTyxTQUFTO0FBQzVELFVBQUksVUFBVTtBQUNkLFlBQU0sVUFBVUksTUFBS0osUUFBTyxlQUFlLEtBQUssUUFBUTtBQUN4RCxZQUFNLFdBQVdJLE1BQUssU0FBUyxtQkFBbUI7QUFHbEQsVUFBSTtBQUNBLFlBQUksQ0FBQ0MsSUFBRyxXQUFXLE9BQU8sR0FBRTtBQUFDLFVBQUFBLElBQUcsVUFBVSxPQUFPO0FBQUEsUUFBQztBQUNsRCxrQkFBVTtBQUFBLE1BQ2QsU0FDTyxHQUFFO0FBQ0wsa0JBQVUsRUFBRTtBQUNaLFFBQUFKLEtBQUksTUFBTSxDQUFDO0FBQUEsTUFDZjtBQUVBLFVBQUk7QUFDQSxjQUFNLGFBQWEsS0FBSyxVQUFVLE1BQU0sTUFBTSxDQUFDO0FBRS9DLGFBQUssTUFBTSxVQUFVO0FBQ3JCLFFBQUFJLElBQUcsY0FBYyxVQUFVLFVBQVU7QUFBQSxNQUN6QyxTQUNPLE9BQU87QUFDVixRQUFBSixLQUFJLE1BQU0seUVBQXlFLEtBQUssRUFBRTtBQUMxRixrQkFBVTtBQUFBLE1BQ2Q7QUFFQSxZQUFNLGNBQWMsRUFBQyxRQUFpQjtBQUFBLElBRTFDLENBQUM7QUFLRCxZQUFRLE9BQU8sVUFBVSxPQUFPLFVBQVU7QUFDdEMsWUFBTSxVQUFVRyxNQUFLSixRQUFPLGVBQWMsR0FBRztBQUM3QyxVQUFJLFdBQVdJLE1BQUssU0FBUSx1QkFBdUI7QUFFbkQsVUFBSTtBQUNBLFlBQUksT0FBT0MsSUFBRyxhQUFhLFVBQVUsTUFBTTtBQUUzQyxZQUFJLFlBQVksS0FBSyxLQUFLLEVBQ3pCLE1BQU0sSUFBSSxFQUNWLElBQUksVUFBUTtBQUNYLGdCQUFNLFFBQVEsS0FBSyxNQUFNLGdDQUFnQztBQUN6RCxjQUFJLE9BQU87QUFDVCxrQkFBTSxDQUFDLEVBQUUsTUFBTSxNQUFNLE9BQU8sSUFBSTtBQUdoQyxnQkFBSTtBQUNKLG9CQUFRLEtBQUssWUFBWSxHQUFHO0FBQUEsY0FDMUIsS0FBSztBQUNILHdCQUFRO0FBQ1I7QUFBQSxjQUNGLEtBQUs7QUFDSCx3QkFBUTtBQUNSO0FBQUEsY0FDRixLQUFLO0FBQ0gsd0JBQVE7QUFDUjtBQUFBLGNBQ0Y7QUFDRSx3QkFBUTtBQUFBLFlBQ1o7QUFHQSxnQkFBSSxTQUFTO0FBQ2IsZ0JBQUksT0FBTztBQUdYLGdCQUFJLFFBQVEsU0FBUyxHQUFHLEdBQUc7QUFDekIsb0JBQU0sYUFBYSxRQUFRLFFBQVEsR0FBRztBQUN0Qyx1QkFBUyxRQUFRLFVBQVUsR0FBRyxVQUFVLEVBQUUsS0FBSztBQUMvQyxxQkFBTyxRQUFRLFVBQVUsYUFBYSxDQUFDLEVBQUUsS0FBSztBQUFBLFlBQ2hEO0FBRUEsbUJBQU8sRUFBRSxNQUFNLE1BQU0sTUFBTSxPQUFPLE9BQU87QUFBQSxVQUMzQztBQUNBLGlCQUFPO0FBQUEsUUFDVCxDQUFDLEVBQ0EsT0FBTyxVQUFRLFNBQVMsSUFBSTtBQUc3QixlQUFPO0FBQUEsTUFDWCxTQUNPLEtBQUs7QUFDUixRQUFBSixLQUFJLE1BQU0sd0JBQXdCLEdBQUcsRUFBRTtBQUN2QyxlQUFPO0FBQUEsTUFDWDtBQUFBLElBRUosQ0FBQztBQU9ELFlBQVEsT0FBTyxlQUFlLE9BQU8sT0FBTyxRQUFRO0FBQ2hELFVBQUksY0FBYyxDQUFDO0FBQ25CLFVBQUlJLElBQUcsV0FBV0wsUUFBTyxhQUFhLEdBQUc7QUFDckMsY0FBTSxVQUFVSyxJQUFHLFlBQVlMLFFBQU8sZUFBZSxFQUFFLGVBQWUsS0FBSyxDQUFDLEVBQ3ZFLE9BQU8sWUFBVSxPQUFPLFlBQVksQ0FBQyxFQUNyQyxJQUFJLFlBQVUsT0FBTyxJQUFJO0FBQzlCLG1CQUFXLFdBQVcsU0FBUztBQUMzQixnQkFBTSxtQkFBbUJJLE1BQUtKLFFBQU8sZUFBZSxTQUFTLG1CQUFtQjtBQUNoRixjQUFJSyxJQUFHLFdBQVcsZ0JBQWdCLEdBQUc7QUFDckMsZ0JBQUk7QUFDQSxvQkFBTSxlQUFlLEtBQUssTUFBTUEsSUFBRyxhQUFhLGtCQUFrQixPQUFPLENBQUM7QUFDMUUsa0JBQUksQ0FBQyxhQUFhLFVBQVU7QUFDeEIsNkJBQWEsV0FBVztBQUFBLGNBQzVCO0FBQ0EsMEJBQVksS0FBSyxZQUFZO0FBQUEsWUFDakMsU0FBUyxHQUFHO0FBQ1IsY0FBQUosS0FBSSxNQUFNLGdFQUFnRSxPQUFPLEtBQUssQ0FBQztBQUFBLFlBQzNGO0FBQUEsVUFDQTtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQ0EsYUFBTztBQUFBLElBQ1QsQ0FBQztBQU9ILFlBQVEsT0FBTyxlQUFlLE9BQU8sT0FBTyxRQUFRO0FBQ2hELFVBQUksVUFBVUcsTUFBTUosUUFBTyxlQUFlLEdBQUc7QUFDN0MsVUFBSUssSUFBRyxTQUFTLE9BQU8sRUFBRSxZQUFZLEdBQUU7QUFDbkMsWUFBSTtBQUNBLFVBQUFBLElBQUcsT0FBTyxTQUFTLEVBQUUsV0FBVyxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQUEsUUFDdkQsU0FDTyxHQUFHO0FBQUMsVUFBQUosS0FBSSxNQUFNLENBQUM7QUFBQSxRQUFDO0FBQUEsTUFDM0I7QUFDQSxhQUFPO0FBQUEsSUFDWCxDQUFDO0FBSUQsWUFBUSxPQUFPLCtCQUErQixPQUFPLE9BQU8sYUFBYTtBQUNyRSxVQUFJO0FBQ0EsY0FBTSxhQUFhSSxJQUFHLGFBQWEsVUFBVSxRQUFRO0FBQ3JELGVBQU8sRUFBRSxZQUF3QixRQUFRLFVBQVU7QUFBQSxNQUN2RCxTQUNPLEdBQUc7QUFDTixRQUFBSixLQUFJLE1BQU0sNkNBQTZDLENBQUMsRUFBRTtBQUMxRCxlQUFPLEVBQUUsWUFBWSxPQUFPLFFBQVEsUUFBUTtBQUFBLE1BQ2hEO0FBQUEsSUFDSixDQUFDO0FBV0YsWUFBUSxPQUFPLGtCQUFrQixPQUFPLE9BQU8sWUFBWSx3QkFBd0I7QUFDOUUsWUFBTSxXQUFXLEtBQUssT0FBTyxlQUFlLFVBQVU7QUFDdEQsWUFBTSxlQUFlLEtBQUssTUFBTSxtQkFBbUI7QUFDbkQsVUFBSSxDQUFDLFVBQVU7QUFBRSxlQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVEsWUFBWSxRQUFRLFNBQVMsYUFBYSxDQUFDLEVBQUU7QUFBQSxNQUFFO0FBQ25HLFVBQUksY0FBYyxDQUFDO0FBQ25CLFVBQUksTUFBT0csTUFBTUosUUFBTyxlQUFlLFNBQVMsV0FBVyxVQUFVO0FBRXJFLFVBQUlLLElBQUcsV0FBVyxHQUFHLEdBQUc7QUFDcEIsY0FBTSxVQUFVQSxJQUFHLFlBQVksS0FBSyxFQUFFLGVBQWUsS0FBSyxDQUFDLEVBQ3RELE9BQU8sWUFBVSxPQUFPLFlBQVksQ0FBQyxFQUNyQyxJQUFJLFlBQVUsT0FBTyxJQUFJO0FBRTlCLG1CQUFXLGVBQWUsU0FBUztBQUMvQixjQUFJLFlBQVksWUFBWSxNQUFNLFdBQVc7QUFDekM7QUFBQSxVQUNKO0FBRUEsY0FBSSxXQUFXLENBQUM7QUFDaEIsY0FBSSxnQkFBZ0JELE1BQUssS0FBSyxhQUFhLFFBQVE7QUFHbkQsbUJBQVMsVUFBVSxHQUFHLFdBQVcsR0FBRyxXQUFXO0FBQzNDLGdCQUFJLGFBQWFBLE1BQUssZUFBZSxPQUFPLE9BQU8sQ0FBQztBQUdwRCxxQkFBUyxPQUFPLElBQUk7QUFBQSxjQUNoQixNQUFNO0FBQUEsY0FDTixVQUFVO0FBQUEsY0FDVixNQUFNO0FBQUEsY0FDTixhQUFhO0FBQUEsWUFDakI7QUFFQSxnQkFBSUMsSUFBRyxXQUFXLFVBQVUsR0FBRztBQUMzQixrQkFBSSxlQUFlQSxJQUFHLFlBQVksWUFBWSxFQUFFLGVBQWUsS0FBSyxDQUFDLEVBQ2hFLE9BQU8sWUFBVSxPQUFPLE9BQU8sQ0FBQyxFQUNoQyxJQUFJLFlBQVUsT0FBTyxJQUFJO0FBRTlCLGtCQUFJLGFBQWEsU0FBUyxHQUFHO0FBQ3pCLG9CQUFJLG1CQUFtQixhQUNsQixJQUFJLFVBQVE7QUFDVCxzQkFBSSxXQUFXRCxNQUFLLFlBQVksSUFBSTtBQUNwQyx5QkFBTyxFQUFFLE1BQU0sT0FBT0MsSUFBRyxTQUFTLFFBQVEsRUFBRSxNQUFNO0FBQUEsZ0JBQ3RELENBQUMsRUFDQSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDO0FBRXhDLHlCQUFTLE9BQU8sSUFBSTtBQUFBLGtCQUNoQixNQUFNRCxNQUFLLFlBQVksaUJBQWlCLElBQUk7QUFBQSxrQkFDNUMsVUFBVSxpQkFBaUI7QUFBQSxrQkFDM0IsTUFBTSxpQkFBaUI7QUFBQSxrQkFDdkIsYUFBYSxhQUFhLGFBQWEsT0FBTyxFQUFFO0FBQUEsZ0JBQ3BEO0FBQUEsY0FDSjtBQUFBLFlBQ0o7QUFBQSxVQUNKO0FBRUEsc0JBQVksS0FBSztBQUFBLFlBQ2I7QUFBQSxZQUNBO0FBQUEsVUFDSixDQUFDO0FBQUEsUUFDTDtBQUFBLE1BQ0o7QUFDQSxhQUFPO0FBQUEsSUFDWCxDQUFDO0FBaUJELFlBQVEsT0FBTyxvQkFBb0IsT0FBTyxPQUFPLFlBQVksZ0JBQWdCO0FBQ3pFLFlBQU0sV0FBVyxLQUFLLE9BQU8sZUFBZSxVQUFVO0FBQ3RELFVBQUksQ0FBQyxVQUFVO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsTUFBTTtBQUFBLE1BQUU7QUFDbkcsVUFBSSxnQkFBZ0I7QUFDcEIsVUFBSSxNQUFPQSxNQUFNSixRQUFPLGVBQWUsU0FBUyxXQUFXLFlBQVksV0FBVztBQUdsRixVQUFJLENBQUNLLElBQUcsV0FBVyxHQUFHLEdBQUc7QUFBRSxlQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVEsWUFBWSxRQUFRLFNBQVMsVUFBVSxNQUFNO0FBQUEsTUFBRTtBQUs3RyxZQUFNLG9CQUFvQkEsSUFBRyxZQUFZLEtBQUssRUFBRSxlQUFlLEtBQUssQ0FBQyxFQUNoRSxPQUFPLFlBQVUsT0FBTyxZQUFZLEtBQUssT0FBTyxTQUFTLFlBQVksT0FBTyxTQUFTLFdBQVcsRUFDaEcsSUFBSSxZQUFVO0FBQ1gsWUFBSSxXQUFXRCxNQUFLLEtBQUssT0FBTyxJQUFJO0FBQ3BDLGVBQU8sRUFBRSxNQUFNLE9BQU8sTUFBTSxPQUFPQyxJQUFHLFNBQVMsUUFBUSxFQUFFLE1BQU07QUFBQSxNQUNuRSxDQUFDLEVBQ0EsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLO0FBRXJDLFVBQUksa0JBQWtCLFdBQVcsR0FBRztBQUNoQyxlQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVEsWUFBWSxRQUFRLFNBQVMsVUFBVSxNQUFNO0FBQUEsTUFDcEY7QUFFQSxVQUFJLHdCQUF3QixrQkFBa0IsQ0FBQyxFQUFFO0FBQ2pELE1BQUFKLEtBQUksS0FBSyx1RUFBdUUsS0FBSyxxQkFBcUI7QUFDMUcsWUFBTSxvQkFBb0JHLE1BQUssS0FBSyx1QkFBdUIsY0FBYyxNQUFNO0FBQy9FLFlBQU0sNEJBQTRCQSxNQUFLLEtBQUsscUJBQXFCO0FBR2pFLFVBQUksQ0FBQ0MsSUFBRyxXQUFXLGlCQUFpQixHQUFHO0FBQUUsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLFlBQVksUUFBUSxTQUFTLFVBQVUsT0FBTywyQkFBMEIsNkJBQTZCLE1BQU07QUFBQSxNQUFFO0FBRXpMLGFBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxXQUFXLFFBQVEsV0FBVyxVQUFVLG1CQUFtQiwwQkFBcUQ7QUFBQSxJQUV2SixDQUFDO0FBZUQsWUFBUSxPQUFPLGVBQWUsWUFBWTtBQUN0QyxZQUFNLFdBQVcsTUFBTSxLQUFLLGNBQWMsV0FBVyxZQUFZLGlCQUFpQjtBQUVsRixZQUFNLGNBQWMsU0FBUyxJQUFJLGNBQVk7QUFBQSxRQUN6QyxhQUFhLFFBQVE7QUFBQSxRQUNyQixXQUFXLFNBQVMsV0FBVyxJQUFJLE9BQU8sUUFBUTtBQUFBO0FBQUEsUUFDbEQsYUFBYSxRQUFRO0FBQUEsTUFDekIsRUFBRTtBQUVGLGFBQU87QUFBQSxJQUNYLENBQUM7QUFXRCxZQUFRLE9BQU8sZUFBZSxPQUFPLE9BQU8sV0FBVyxhQUFhLGdCQUFnQjtBQUNoRixVQUFJO0FBQ0EsZUFBTyxNQUFNLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUUxQyxlQUFLLFdBQVcsS0FBSztBQUFBLFlBQ2pCO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0osQ0FBQztBQUVELFVBQUFKLEtBQUksS0FBSywyREFBMkQsS0FBSyxXQUFXLE1BQU0saUJBQWlCO0FBRzNHLGNBQUksQ0FBQyxLQUFLLG1CQUFtQjtBQUN6QixpQkFBSyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsVUFBVTtBQUN2QyxjQUFBQSxLQUFJLE1BQU0scURBQXFELE1BQU0sT0FBTyxFQUFFO0FBQUEsWUFDbEYsQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKLENBQUM7QUFBQSxNQUNMLFNBQVMsT0FBTztBQUNaLFFBQUFBLEtBQUksS0FBSywwREFBMEQsTUFBTSxPQUFPLEVBQUU7QUFDbEYsZUFBTyxFQUFFLFNBQVMsT0FBTyxPQUFPLE1BQU0sUUFBUTtBQUFBLE1BQ2xEO0FBQUEsSUFDSixDQUFDO0FBUUQsWUFBUSxHQUFHLGVBQWUsT0FBTyxVQUFVO0FBRXZDLFlBQU0sYUFBYSxrQkFBa0I7QUFDckMsV0FBSyxzQkFBc0I7QUFHM0IsYUFBTyxLQUFLLFVBQVUsRUFBRSxRQUFRLENBQUMsa0JBQWtCO0FBQy9DLG1CQUFXLGFBQWEsRUFBRSxRQUFRLENBQUMsVUFBVTtBQUV6QyxjQUFJLE1BQU0sV0FBVyxVQUNqQixDQUFDLE1BQU0sUUFBUSxXQUFXLE1BQU0sS0FDaEMsQ0FBQyxNQUFNLFFBQVEsV0FBVyxVQUFVLEdBQUc7QUFDdkMsZ0JBQUksQ0FBQyxLQUFLLHFCQUFxQjtBQUMzQixtQkFBSyxzQkFBc0IsQ0FBQztBQUFBLFlBQ2hDO0FBQ0EsaUJBQUssb0JBQW9CLEtBQUs7QUFBQSxjQUMxQixNQUFNO0FBQUEsY0FDTixTQUFTLE1BQU07QUFBQSxZQUNuQixDQUFDO0FBQUEsVUFDTDtBQUFBLFFBQ0osQ0FBQztBQUFBLE1BQ0wsQ0FBQztBQUdELFlBQU0sWUFBWSxLQUFLLE9BQU87QUFHOUIsVUFBSSxLQUFLLG9CQUFvQjtBQUN6QixjQUFNLFlBQVksS0FBSyxxQkFBcUIsS0FBSyxXQUFTLE1BQU0sU0FBUyxLQUFLLGtCQUFrQjtBQUNoRyxZQUFJLFdBQVc7QUFDWCxlQUFLLE9BQU8sU0FBUyxVQUFVO0FBQy9CLGVBQUssT0FBTyxZQUFZLFVBQVU7QUFFbEMsY0FBSTtBQUNBLGtCQUFNLEVBQUMsU0FBUyxTQUFTLElBQUcsSUFBSUssY0FBYSxVQUFVLElBQUk7QUFDM0QsaUJBQUssT0FBTyxVQUFVLFFBQVEsS0FBSztBQUFBLFVBQ3ZDLFNBQVMsR0FBRztBQUNSLGlCQUFLLE9BQU8sVUFBVTtBQUFBLFVBQzFCO0FBQUEsUUFDSjtBQUFBLE1BQ0osT0FDSztBQUNELFlBQUk7QUFDQSxnQkFBTSxFQUFDLFNBQVMsU0FBUyxJQUFHLElBQUtBLGNBQWE7QUFDOUMsZUFBSyxPQUFPLFNBQVNDLElBQUcsUUFBUSxHQUFHO0FBQ25DLGVBQUssT0FBTyxZQUFZO0FBQ3hCLGVBQUssT0FBTyxVQUFVO0FBQUEsUUFDMUIsU0FDTyxHQUFHO0FBQ04sZUFBSyxPQUFPLFNBQVM7QUFDckIsZUFBSyxPQUFPLFVBQVU7QUFBQSxRQUMxQjtBQUVBLFlBQUksQ0FBQyxLQUFLLE9BQU8sUUFBUTtBQUNyQixjQUFJO0FBQ0EsaUJBQUssT0FBTyxTQUFTQSxJQUFHLFFBQVE7QUFFaEMsa0JBQU0sZ0JBQWdCLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSyxTQUFPLFdBQVcsR0FBRyxFQUFFLEtBQUssV0FBUyxNQUFNLFlBQVksS0FBSyxPQUFPLE1BQU0sQ0FBQztBQUM3SCxpQkFBSyxPQUFPLFlBQVk7QUFBQSxVQUU1QixTQUNPLEdBQUc7QUFDTixZQUFBTixLQUFJLE1BQU0sMERBQTBEO0FBQ3BFLGlCQUFLLE9BQU8sU0FBUztBQUNyQixpQkFBSyxPQUFPLFVBQVU7QUFDdEIsaUJBQUssT0FBTyxZQUFZO0FBQUEsVUFDNUI7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUdBLFVBQUksS0FBSyxPQUFPLFVBQVUsYUFBYTtBQUFFLGFBQUssT0FBTyxTQUFTO0FBQUEsTUFBTTtBQUdwRSxVQUFJLGNBQWMsS0FBSyxPQUFPLFVBQVUsS0FBSyxPQUFPLFFBQVE7QUFDeEQsUUFBQUEsS0FBSSxLQUFLLHlCQUF5QixTQUFTLE9BQU8sS0FBSyxPQUFPLE1BQU0sOEJBQThCO0FBR2xHLFlBQUksS0FBSyxtQkFBbUIsS0FBSyxnQkFBZ0IsT0FBTyxRQUFRLEdBQUc7QUFDL0QsY0FBSTtBQUNBLGtCQUFNLEtBQUssZ0JBQWdCLEtBQUs7QUFDaEMsaUJBQUssZ0JBQWdCLEtBQUssS0FBSyxPQUFPLE9BQU87QUFDN0MsWUFBQUEsS0FBSSxLQUFLLHNDQUFzQztBQUFBLFVBQ25ELFNBQ08sR0FBRztBQUNOLFlBQUFBLEtBQUksTUFBTSxrREFBa0QsQ0FBQztBQUFBLFVBQ2pFO0FBQUEsUUFDSjtBQUdBLFlBQUksZ0JBQVE7QUFDUixjQUFJLGVBQU8sV0FBVztBQUNsQiwyQkFBTyxNQUFNLE1BQU07QUFDZixjQUFBQSxLQUFJLEtBQUssK0NBQStDO0FBQ3hELDZCQUFPLE9BQU9ELFFBQU8sZUFBZSxNQUFNO0FBQ3RDLGdCQUFBQyxLQUFJLEtBQUssNkNBQTZDRCxRQUFPLE1BQU0sSUFBSUEsUUFBTyxhQUFhLEVBQUU7QUFBQSxjQUNqRyxDQUFDO0FBQUEsWUFDTCxDQUFDO0FBQUEsVUFDTCxPQUNLO0FBQ0QsMkJBQU8sT0FBT0EsUUFBTyxlQUFlLE1BQU07QUFDdEMsY0FBQUMsS0FBSSxLQUFLLDJDQUEyQ0QsUUFBTyxNQUFNLElBQUlBLFFBQU8sYUFBYSxFQUFFO0FBQUEsWUFDL0YsQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUtBLFlBQU0sY0FBYztBQUFBLFFBQ2hCLFFBQVEsS0FBSyxPQUFPO0FBQUEsUUFDcEIsV0FBVyxLQUFLLE9BQU87QUFBQSxRQUN2QixxQkFBcUIsS0FBSztBQUFBLFFBQzFCLG9CQUFvQixLQUFLO0FBQUEsTUFDN0I7QUFBQSxJQUNKLENBQUM7QUFHRCxZQUFRLE9BQU8seUJBQXlCLENBQUMsT0FBTyxRQUFRO0FBQ3BELFdBQUsscUJBQXFCO0FBQUEsSUFDOUIsQ0FBQztBQUVELFlBQVEsR0FBRywyQkFBMkIsQ0FBQyxVQUFVO0FBQzdDLFdBQUsscUJBQXFCO0FBQzFCLFlBQU0sY0FBYztBQUFBLFFBQ2hCLFFBQVEsS0FBSyxPQUFPO0FBQUEsUUFDcEIsV0FBVyxLQUFLLE9BQU87QUFBQSxRQUN2QixxQkFBcUIsS0FBSztBQUFBLFFBQzFCLG9CQUFvQixLQUFLO0FBQUEsTUFDN0I7QUFBQSxJQUNKLENBQUM7QUFvQkQsWUFBUSxHQUFHLHNCQUFzQixPQUFPLE9BQU8sU0FBUztBQUNwRCxNQUFBQyxLQUFJLEtBQUssK0JBQStCO0FBQ3hDLFlBQU0sY0FBYyxLQUFLO0FBQ3pCLFlBQU0sY0FBYyxLQUFLO0FBQ3pCLFlBQU0sV0FBVyxLQUFLO0FBQ3RCLFlBQU0sU0FBUyxLQUFLO0FBQ3BCLFlBQU0sYUFBYSxLQUFLO0FBR3hCLFVBQUksbUJBQW9CRyxNQUFLSixRQUFPLGVBQWUsWUFBWSxXQUFXO0FBQzFFLFVBQUksT0FBTyxJQUFJLE1BQUssb0JBQUksS0FBSyxHQUFFLFFBQVEsQ0FBQyxFQUFFLG1CQUFtQjtBQUM3RCxVQUFJLFVBQVUsT0FBTyxJQUFJLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFDNUMsVUFBSSxvQkFBb0JJLE1BQUssa0JBQWtCLE9BQU87QUFFdEQsVUFBSTtBQUNBLFlBQUksQ0FBQ0MsSUFBRyxXQUFXLGdCQUFnQixHQUFHO0FBQUUsVUFBQUEsSUFBRyxVQUFVLGtCQUFrQixFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsUUFBSTtBQUM5RixZQUFJLENBQUNBLElBQUcsV0FBVyxpQkFBaUIsR0FBRTtBQUFFLFVBQUFBLElBQUcsVUFBVSxtQkFBbUIsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUNsRyxTQUFTLEdBQUc7QUFBQyxRQUFBSixLQUFJLE1BQU0sQ0FBQztBQUFBLE1BQUM7QUFHekIsWUFBTSxlQUFlLE1BQU0sTUFBTSxtREFBbUQsTUFBTSxZQUFZO0FBQUEsUUFDbEcsU0FBUyxFQUFDLGlCQUFpQixVQUFVLFdBQVcsR0FBSztBQUFBLE1BQ3pELENBQUMsRUFBRSxNQUFPLFNBQU87QUFBQyxRQUFBQSxLQUFJLE1BQU0sR0FBRztBQUFBLE1BQUMsQ0FBQztBQUVqQyxVQUFJO0FBQ0EsY0FBTSxhQUFhLE1BQU0sYUFBYSxZQUFZO0FBQ2xELFFBQUFJLElBQUcsY0FBY0QsTUFBSyxtQkFBbUIsUUFBUSxHQUFHLE9BQU8sS0FBSyxVQUFVLENBQUM7QUFBQSxNQUMvRSxTQUFTLEdBQUc7QUFBQyxRQUFBSCxLQUFJLE1BQU0sQ0FBQztBQUFBLE1BQUM7QUFFekIsWUFBTSxrQkFBa0IsTUFBTSxNQUFNLG1EQUFtRCxNQUFNLHVCQUF1QjtBQUFBLFFBQ2hILFNBQVMsRUFBQyxpQkFBaUIsVUFBVSxXQUFXLEdBQUs7QUFBQSxNQUN6RCxDQUFDLEVBQUUsTUFBTyxTQUFPO0FBQUMsUUFBQUEsS0FBSSxNQUFNLEdBQUc7QUFBQSxNQUFDLENBQUM7QUFFakMsVUFBSSxnQkFBZ0IsSUFBSTtBQUNwQixjQUFNLGdCQUFnQixNQUFNLGdCQUFnQixZQUFZO0FBQ3hELGNBQU0sY0FBY0csTUFBSyxtQkFBbUIsR0FBRyxRQUFRLE1BQU07QUFDN0QsWUFBSTtBQUNBLFVBQUFDLElBQUcsY0FBYyxhQUFhLE9BQU8sS0FBSyxhQUFhLENBQUM7QUFDeEQsVUFBQUosS0FBSSxLQUFLLGNBQWMsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUFBLFFBQ3pELFNBQVMsR0FBRztBQUFDLFVBQUFBLEtBQUksTUFBTSxDQUFDO0FBQUEsUUFBQztBQUFBLE1BQzdCLE9BQ0s7QUFDRCxRQUFBQSxLQUFJLE1BQU0sa0RBQWtEO0FBQUEsTUFDaEU7QUFBQSxJQUVKLENBQUM7QUFBQSxFQUlMO0FBQUEsRUFFQSxTQUFTLEtBQUs7QUFDVixRQUFJTyxPQUFNO0FBQ1YsUUFBSTtBQUNELE1BQUFBLE9BQU8sSUFBSSxZQUFZLEVBQUUsU0FBUyxNQUFNO0FBQUEsSUFDM0MsU0FDTyxLQUFLO0FBQ1IsTUFBQVAsS0FBSSxLQUFLLHlCQUF5QixHQUFHLEVBQUU7QUFBQSxJQUMzQztBQUNBLFdBQU9PO0FBQUEsRUFDWDtBQUFBLEVBRUEsV0FBVyxNQUFNO0FBQ2IsUUFBSSxhQUFhO0FBQUEsTUFDYixhQUFhLEtBQUs7QUFBQSxNQUNsQixjQUFjLEtBQUs7QUFBQSxNQUNuQixnQkFBZ0IsS0FBSztBQUFBLE1BQ3JCLFNBQVMsS0FBSztBQUFBLE1BQ2QsZUFBZSxLQUFLO0FBQUEsTUFDcEIsZUFBZSxLQUFLO0FBQUEsTUFDcEIsaUJBQWlCLEtBQUs7QUFBQSxNQUV0QixlQUFlLEtBQUs7QUFBQSxNQUNwQixxQkFBcUIsS0FBSztBQUFBLE1BQzFCLDJCQUEyQixLQUFLO0FBQUEsTUFFaEMscUJBQXFCLEtBQUs7QUFBQSxNQUMxQixRQUFRLEtBQUs7QUFBQSxNQUNiLFNBQVMsS0FBSztBQUFBLE1BQ2QsYUFBYSxLQUFLO0FBQUEsTUFDbEIsU0FBUyxLQUFLO0FBQUEsTUFDZCxNQUFNLEtBQUs7QUFBQSxNQUNYLGFBQWEsS0FBSztBQUFBLE1BQ2xCLFdBQVcsS0FBSztBQUFBLElBQ2xCO0FBQ0YsV0FBTztBQUFBLEVBQ1g7QUFDSjtBQUVBLElBQU8scUJBQVEsSUFBSSxXQUFXOzs7QWR2NUI5QkMsS0FBSSxRQUFRLG1CQUFtQjtBQUUvQkMsS0FBSSxXQUFXO0FBQ2YsSUFBSSxVQUFVLEdBQUcsZUFBTyxhQUFhO0FBRXJDQSxLQUFJLFlBQVksYUFBYTtBQUM3QkEsS0FBSSxhQUFhLGNBQWM7QUFFL0JBLEtBQUksV0FBVyxLQUFLLGdCQUFnQixNQUFNO0FBQUUsU0FBTztBQUFTO0FBQzVEQSxLQUFJLFdBQVcsUUFBUSxTQUFTLENBQUMsWUFBWTtBQUV6QyxVQUFRLFFBQVEsT0FBTztBQUFBLElBQ3JCLEtBQUs7QUFBUSxhQUFPLENBQUMsTUFBTSxNQUFNLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNuRyxLQUFLO0FBQVEsYUFBTyxDQUFDLE1BQU0sT0FBTyxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDcEcsS0FBSztBQUFTLGFBQU8sQ0FBQyxNQUFNLElBQUksUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ2xHLEtBQUs7QUFBUyxhQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNuRyxLQUFLO0FBQVcsYUFBTyxDQUFDLE1BQU0sUUFBUSxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDeEc7QUFBYSxhQUFPLENBQUMsT0FBTyxRQUFRLElBQUksQ0FBQztBQUFBLEVBQzNDO0FBQ0o7QUFDQUEsS0FBSSxRQUFRLGtDQUFrQztBQUM5Q0EsS0FBSSxRQUFRLDRDQUE0QyxlQUFPLE9BQU8sSUFBSSxlQUFPLElBQUksTUFBTSxRQUFRLFFBQVEsSUFBSSxlQUFPLGNBQWMsa0JBQWtCLEVBQUUsRUFBRTtBQUMxSkEsS0FBSSxRQUFRLGtDQUFrQztBQUM5Q0EsS0FBSSxLQUFLLG1DQUFtQyxPQUFPLEVBQUU7QUFJckQsS0FBSyxtQkFBbUIsSUFBSTtBQUM1QkQsS0FBSSxZQUFZLGFBQWEsbUJBQW1CLDhCQUE4QjtBQUU5RUEsS0FBSSxZQUFZLGFBQWEsUUFBUSxJQUFJO0FBQ3pDQSxLQUFJLFlBQVksYUFBYSw4QkFBOEI7QUFHM0QsSUFBSSxlQUFPLGVBQWU7QUFDdEIsRUFBQUEsS0FBSSxZQUFZLGFBQWEsaUJBQWlCLGVBQU8sYUFBYTtBQUN0RTtBQUVBLHNCQUFjLEtBQUsseUJBQWlCLGNBQU07QUFDMUMsbUJBQVcsS0FBSyx5QkFBaUIsZ0JBQVEscUJBQWE7QUFPdEQsUUFBUSxPQUFPLEdBQUcsU0FBUyxDQUFDLFFBQVE7QUFBRSxNQUFJLElBQUksU0FBUyxTQUFTO0FBQUUsSUFBQUMsS0FBSSxXQUFXLFFBQVEsUUFBUTtBQUFBLEVBQU07QUFBRSxDQUFDO0FBRTFHLFFBQVEsR0FBRyxxQkFBcUIsQ0FBQyxRQUFRO0FBQ3JDLE1BQUksSUFBSSxTQUFTLFNBQVM7QUFDdEIsSUFBQUEsS0FBSSxXQUFXLFFBQVEsUUFBUTtBQUMvQixJQUFBQSxLQUFJLEtBQUssNEVBQTRFO0FBQUEsRUFDekYsT0FDSztBQUFHLElBQUFBLEtBQUksTUFBTSxTQUFTLElBQUksT0FBTztBQUFBLEVBQUc7QUFDN0MsQ0FBQztBQUdELElBQUksUUFBUSxhQUFhLFFBQVMsQ0FBQUQsS0FBSSxrQkFBa0JBLEtBQUksUUFBUSxDQUFDO0FBR3JFLElBQUksQ0FBQ0EsS0FBSSwwQkFBMEIsR0FBRztBQUNsQyxFQUFBQSxLQUFJLEtBQUs7QUFDVCxVQUFRLEtBQUssQ0FBQztBQUNsQjtBQUdBQSxLQUFJLFlBQVksYUFBYSxhQUFhLEdBQUc7QUFHN0MsUUFBUSxJQUFJLDhCQUE4QixJQUFJO0FBQzlDLElBQU0sc0JBQXNCLFFBQVE7QUFDcEMsUUFBUSxjQUFjLENBQUMsU0FBU0UsYUFBWTtBQUN4QyxNQUFJLFdBQVcsUUFBUSxZQUFZLFFBQVEsU0FBUyw4QkFBOEIsR0FBRztBQUFHO0FBQUEsRUFBTztBQUMvRixTQUFPLG9CQUFvQixLQUFLLFNBQVMsU0FBU0EsUUFBTztBQUM3RDtBQUVBRixLQUFJLEdBQUcscUJBQXFCLENBQUMsT0FBTyxhQUFhLEtBQUssT0FBTyxhQUFhLGFBQWE7QUFDbkYsUUFBTSxlQUFlO0FBQ3JCLFdBQVMsSUFBSTtBQUNqQixDQUFDO0FBR0RBLEtBQUksR0FBRyx3QkFBd0IsQ0FBQyxPQUFPLGdCQUFnQjtBQUNuRCxjQUFZLEdBQUcsaUJBQWlCLENBQUNHLFFBQU8sV0FBVyxrQkFBa0IsY0FBYyxhQUFhLGdCQUFnQixtQkFBbUI7QUFFL0gsSUFBQUYsS0FBSSxLQUFLLCtCQUErQixTQUFTLE1BQU0sZ0JBQWdCLGFBQWEsWUFBWSxFQUFFO0FBR2xHLFFBQUksY0FBYyxJQUFJO0FBRWxCLE1BQUFBLEtBQUksS0FBSyxnR0FBZ0c7QUFDekc7QUFBQSxJQUNKO0FBR0EsUUFBSSxjQUFjLElBQUk7QUFDbEIsTUFBQUEsS0FBSSxNQUFNLDBDQUEwQyxTQUFTLE1BQU0sZ0JBQWdCLEVBQUU7QUFBQSxJQUN6RjtBQUFBLEVBQ0osQ0FBQztBQUNMLENBQUM7QUFFREQsS0FBSSxHQUFHLHFCQUFxQixNQUFNO0FBQzlCLHdCQUFjLGFBQWE7QUFFM0IsRUFBQUEsS0FBSSxLQUFLO0FBQ2IsQ0FBQztBQUVEQSxLQUFJLEdBQUcsbUJBQW1CLE1BQU07QUFDNUIsTUFBSSxzQkFBYyxZQUFZO0FBQzFCLFFBQUksc0JBQWMsV0FBVyxZQUFZLEVBQUcsdUJBQWMsV0FBVyxRQUFRO0FBQzdFLDBCQUFjLFdBQVcsTUFBTTtBQUFBLEVBQ25DO0FBQ0osQ0FBQztBQUVEQSxLQUFJLEdBQUcsWUFBWSxNQUFNO0FBQ3JCLFFBQU0sYUFBYUksZUFBYyxjQUFjO0FBQy9DLE1BQUksV0FBVyxRQUFRO0FBQUUsZUFBVyxDQUFDLEVBQUUsTUFBTTtBQUFBLEVBQUMsT0FDekM7QUFBRSwwQkFBYyxhQUFhO0FBQUEsRUFBRTtBQUN4QyxDQUFDO0FBRURKLEtBQUksVUFBVSxFQUFFLEtBQUssTUFBSTtBQUNyQixpQkFBTyxPQUFPLGVBQU8sZUFBZSxNQUFNO0FBQ3RDLElBQUFDLEtBQUksS0FBSyw4Q0FBOEMsZUFBTyxNQUFNLElBQUksZUFBTyxhQUFhLEVBQUU7QUFBQSxFQUNsRyxDQUFDO0FBQ0wsQ0FBQyxFQUNBLEtBQUssWUFBVTtBQUNaLGNBQVksY0FBYztBQUUxQixNQUFJLGVBQU8sVUFBVSxhQUFhO0FBQUUsbUJBQU8sU0FBUztBQUFBLEVBQU07QUFDMUQsTUFBSSxlQUFPLFFBQVE7QUFBRSw0QkFBZ0IsS0FBSyxlQUFPLE9BQU87QUFBQSxFQUFHO0FBQzNELG1CQUFpQixNQUFNLHVCQUF1QjtBQUU5Qyx3QkFBYyxhQUFhO0FBRTNCLGlCQUFlLFNBQVMsNEJBQTRCLE1BQU07QUFBRyxVQUFNLE1BQU1HLGVBQWMsaUJBQWlCO0FBQUcsUUFBSSxLQUFLO0FBQUUsVUFBSSxZQUFZLGVBQWU7QUFBQSxJQUFFO0FBQUEsRUFBQyxDQUFDO0FBQ3pKLGlCQUFlLFNBQVMsWUFBWSxNQUFNO0FBQUcsV0FBTztBQUFBLEVBQU0sQ0FBQztBQUUvRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJsb2ciLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAiUm91dGVyIiwgImxvZyIsICJsb2ciLCAiY3J5cHRvIiwgInBhdGgiLCAiZnMiLCAibG9nIiwgImxvZyIsICJwdWJsaWNQYXRoIiwgImNvbmZpZyIsICJhcHAiLCAiX19kaXJuYW1lIiwgImZzIiwgImxvZyIsICJwYXRoIiwgInNlcnZlciIsICJjcnlwdG8iLCAic3R1ZGVudCIsICJwdWJsaWNQYXRoIiwgIlJvdXRlciIsICJwYXRoIiwgImZzIiwgImxvZyIsICJyb3V0ZXIiLCAiUm91dGVyIiwgInQiLCAicGF0aCIsICJmcyIsICJwZGYiLCAiZXhlYyIsICJSb3V0ZXIiLCAicGF0aCIsICJmcyIsICJhcHAiLCAibG9nIiwgInBhdGgiLCAiZnMiLCAiZnMiLCAiQnJvd3NlcldpbmRvdyIsICJkaWFsb2ciLCAiam9pbiIsICJsb2ciLCAiZ2F0ZXdheTRzeW5jIiwgImlwIiwgImNvbmZpZyIsICJsb2ciLCAiQnJvd3NlcldpbmRvdyIsICJkaWFsb2ciLCAiam9pbiIsICJmcyIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAicGRmIiwgImFwcCIsICJsb2ciLCAib3B0aW9ucyIsICJldmVudCIsICJCcm93c2VyV2luZG93Il0KfQo=
