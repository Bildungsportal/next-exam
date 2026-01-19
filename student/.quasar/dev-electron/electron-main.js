var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src-electron/main/scripts/platformDispatcher.js
import { execSync as execSync2 } from "child_process";
import { join } from "path";
import { app } from "electron";
import log from "electron-log";

// src-electron/main/config.js
var config = {
  development: true,
  // disable kiosk mode on exam mode and other stuff (autofill input fields)
  showdevtools: true,
  useBundledJRE: true,
  bipIntegration: false,
  bipDemo: false,
  workdirectory: "",
  // (desktop path + examdir)
  tempdirectory: "",
  // (desktop path + 'tmp')
  homedirectory: "",
  // set in main.ts
  examdirectory: "",
  // set after registering in ipcHandler
  clientdirectory: "EXAM-STUDENT",
  serverApiPort: 22422,
  // this is needed to be reachable on the teachers pc for basic functionality
  multicastClientPort: 6024,
  // only needed for exam autodiscovery
  multicastServerAdrr: "239.255.255.250",
  hostip: "",
  // server.js
  gateway: true,
  electron: false,
  virtualized: false,
  isPuavo: false,
  version: "1.1.0.18",
  buildDate: "20260119",
  buildNumber: "18",
  info: "Release"
};
var config_default = config;

// src-electron/main/scripts/platformDispatcher.js
import { pathToFileURL } from "url";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: "electron-builder.env" });
var __dirname = import.meta.dirname;
var PlatformDispatcher = class {
  constructor() {
    this._platform = process.platform;
    this._arch = process.arch;
    this._env = process.env;
    this.messages = [];
    this.arch = this._normalizeArch();
    this.displayServer = this._getDisplayServer();
    this.flameshot = this._getVersion("flameshot");
    this.imagemagick = this._getVersion("convert");
    this.imVersion = this._getImageMagickVersion();
    this.workerFileName = this._getWorkerFileName();
    this.useWorker = this._getUseWorker();
    this.screenshotAbility = this._getScreenshotAbility();
    this.jre = this._detectJREId();
    this.jreDir = this._resolveJREDir();
    this.javaBin = this._resolveJavaBin();
    this.jreInfo = this._getJRE();
    this.homedirectory = os.homedir();
    this.desktopPath = this._getDesktopPath();
    this.workerURL = this._getWorkerURL();
    this.tempdirectory = this._getTempdirectory();
    this.workdirectory = this._getWorkdirectory();
    this.logfile = this._getLogfile();
  }
  _getWorkdirectory() {
    return join(this.homedirectory, config_default.clientdirectory);
  }
  _getTempdirectory() {
    return join(os.tmpdir(), "exam-tmp");
  }
  _getLogfile() {
    return join(this.workdirectory, "next-exam-student.log");
  }
  _normalizeArch() {
    if (this._arch === "ia32") return "i586";
    if (["x64", "arm64"].includes(this._arch)) return this._arch;
    this._fail(`unsupported architecture: ${this._arch}`);
  }
  _detectJREId() {
    if (this._platform === "linux") return "minimal-jre-11-lin";
    if (this._platform === "win32") return "minimal-jre-11-win";
    if (this._platform === "darwin") {
      return this._arch === "arm64" ? "minimal-jre-11-mac-arm64" : "minimal-jre-11-mac";
    }
  }
  /**
   * 
   * @returns {string} the jre directory
   * @description this function resolves the jre directory
   * it first checks if the useBundledJRE environment variable is set to true
   * if it is, it returns the bundled jre directory
   * if it is not, it checks if the system jre is installed
   * if it is, it returns the system jre directory
   * if it is not, it returns the bundled jre directory
   * the bundled jre is located in the public directory of the app
   * 
   * FIXME: if system jre is selected by ENV do not include the jre directory in the final build
   */
  _resolveJREDir() {
    if (process.env.useBundledJRE) {
      if (app.isPackaged) {
        this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(process.resourcesPath, "app.asar.unpacked", "public", this.jre));
        return join(process.resourcesPath, "app.asar.unpacked", "public", this.jre);
      } else {
        this.messages.push("platformDispatcher @ _resolveJREDir: !app.isPackaged: " + join(__dirname, "../../public", this.jre));
        return join(__dirname, "../../public", this.jre);
      }
    } else {
      try {
        const javaCommand = this._platform === "win32" ? "where java" : "which java";
        const javaPath = execSync2(javaCommand, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        if (javaPath) {
          const javaDir = path.dirname(javaPath);
          const jreRoot = path.dirname(path.dirname(javaDir));
          return jreRoot;
        }
      } catch (err) {
      }
      log.warn("platformDispatcher @ _resolveJREDir: No system Java found, falling back to bundled JRE");
      if (app.isPackaged) {
        return join(process.resourcesPath, "app.asar.unpacked", "public", this.jre);
      } else {
        return join(__dirname, "../../public", this.jre);
      }
    }
  }
  _resolveJavaBin() {
    switch (this._platform) {
      case "darwin":
        return ["bin", "java"];
      case "win32":
        return ["bin", "javaw.exe"];
      case "linux":
        return ["bin", "java"];
      default:
        this._fail(`unsupported platform: ${this._platform}`);
    }
  }
  _getDisplayServer() {
    if (this._platform !== "linux") return "n/a";
    if (this._env.XDG_SESSION_TYPE === "wayland") return "wayland";
    if (this._env.XDG_SESSION_TYPE === "x11" || this._env.DISPLAY) return "x11";
    return "unknown";
  }
  _getVersion(cmd) {
    try {
      const output = execSync2(`${cmd} --version`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).split("\n")[0];
      const version = output.match(/[\d]+(\.[\d]+)+/);
      return { found: true, version: version?.[0] || "unknown" };
    } catch {
      return { found: false, version: null };
    }
  }
  _getJRE() {
    try {
      const output = execSync2("java -version", { encoding: "utf-8", stdio: ["pipe", "ignore", "pipe"] });
      const version = output.match(/version "([\d._]+)"/)?.[1] || "unknown";
      const javaHome = this._env.JAVA_HOME || "";
      return { found: true, version, path: javaHome };
    } catch {
      return { found: false, version: null, path: null };
    }
  }
  _getWorkerFileName() {
    return this._platform === "linux" ? "imageWorkerLinux.mjs" : "imageWorkerSharp.mjs";
  }
  _getWorkerURL() {
    const baseDir = app.isPackaged ? process.resourcesPath : import.meta.dirname;
    const workerPath = app.isPackaged ? join(baseDir, "app.asar.unpacked", "public", this.workerFileName) : join(baseDir, "../../public", this.workerFileName);
    return pathToFileURL(workerPath);
  }
  isWayland() {
    return this._env.XDG_SESSION_TYPE === "wayland";
  }
  _isKDE() {
    try {
      const out = execSync2("echo $XDG_CURRENT_DESKTOP", { shell: "/bin/bash", encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      return out === "KDE";
    } catch {
      this.messages.push("platformDispatcher @ _isKDE: no data");
      return false;
    }
  }
  _isGNOME() {
    try {
      const out = execSync2("echo $XDG_CURRENT_DESKTOP", { shell: "/bin/bash", encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim().toLowerCase();
      return out.includes("gnome");
    } catch (err) {
      this.messages.push("platformDispatcher @ _isGNOME: no data");
      return false;
    }
  }
  _isUNITY() {
    try {
      const out = execSync2("echo $XDG_CURRENT_DESKTOP", { shell: "/bin/bash", encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim().toLowerCase();
      return out.includes("unity");
    } catch (err) {
      log.warn("platformDispatcher @ _isUNITY: no data", err);
      return false;
    }
  }
  _imagemagickAvailable() {
    try {
      execSync2("magick -version", { stdio: "ignore" });
      return true;
    } catch {
      try {
        execSync2("which import", { stdio: "ignore" });
        return true;
      } catch (err) {
        this.messages.push("platformDispatcher @ _imagemagickAvailable: ImageMagick not found");
        return false;
      }
    }
  }
  _flameshotAvailable() {
    try {
      execSync2("which flameshot", { stdio: "ignore" });
      return true;
    } catch {
      this.messages.push("platformDispatcher @ _flameshotAvailable: Flameshot not found");
      return false;
    }
  }
  _setupDesktopPath() {
    this.desktopPath = this._getDesktopPath();
  }
  _getDesktopPath() {
    if (this._platform === "win32") {
      return path.join(process.env["USERPROFILE"], "Desktop");
    } else {
      return path.join(os.homedir(), "Desktop");
    }
  }
  _fail(msg) {
    throw new Error(`[platformDispatcher] ${msg}`);
  }
  _getImageMagickVersion() {
    try {
      execSync2("magick -version", { stdio: "ignore" });
      this.messages.push("platformDispatcher @ _getImageMagickVersion: Found ImageMagick v7 (magick)");
      return "7";
    } catch {
      try {
        execSync2("which import", { stdio: "ignore" });
        this.messages.push("platformDispatcher @ _getImageMagickVersion: Found ImageMagick <7 (import)");
        return "<7";
      } catch (err) {
        this.messages.push("platformDispatcher @ _getImageMagickVersion: ImageMagick not found");
        return null;
      }
    }
  }
  _getUseWorker() {
    if (this._platform === "linux") {
      return this._imagemagickAvailable();
    } else {
      return true;
    }
  }
  _getScreenshotAbility() {
    if (this._platform === "linux") {
      if ((this._isGNOME() || this._isUNITY()) && this.isWayland()) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: GNOME/Unity + Wayland \u2013 ScreenshotAbility set to false");
        return false;
      } else if (this._isKDE() && this.isWayland() && this._flameshotAvailable()) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: KDE/Wayland + Flameshot \u2013 ScreenshotAbility set to true");
        return true;
      } else if (!this.isWayland() && this.useWorker) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: X11 + ImageMagick \u2013 ScreenshotAbility set to true");
        return true;
      } else {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: ScreenshotAbility set to false \u2013 fallback to pagecapture");
        return false;
      }
    } else {
      return true;
    }
  }
};
var platformDispatcher = new PlatformDispatcher();
var platformDispatcher_default = platformDispatcher;

// src-electron/electron-main.js
import chalk from "chalk";
import log13 from "electron-log";
import { app as app10, BrowserWindow as BrowserWindow3, powerSaveBlocker, nativeTheme, globalShortcut as globalShortcut2, Tray as Tray2, Menu as Menu2, dialog as dialog3, session } from "electron";

// src-electron/main/scripts/multicastclient.js
import dgram from "dgram";
import log2 from "electron-log";

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

// src-electron/main/scripts/multicastclient.js
var MulticastClient = class {
  constructor() {
    this.PORT = config_default.multicastClientPort;
    this.MULTICAST_ADDR = config_default.multicastServerAdrr;
    this.client = null;
    this.beaconsLost = 0;
    this.examServerList = [];
    this.clientinfo = {
      name: "DemoUser",
      token: false,
      ip: false,
      // ip address wird vom multicastserver teacher mit geschickt
      hostname: false,
      serverip: false,
      // wird lokal gesetzt (ist aber logischerweise gleich der ip des multicastservers)
      servername: false,
      focus: true,
      exammode: false,
      timestamp: false,
      virtualized: false,
      // this config setting is set by simplevmdetect.js (electron preload)
      examtype: false,
      pin: false,
      screenlock: false,
      msofficeshare: false,
      screenshotinterval: 4e3,
      //milliseconds
      printrequest: false,
      privateSpellcheck: { activated: false },
      localLockdown: false,
      group: "a",
      submissionnumber: 0
    };
  }
  /**
   * receives messages and stores new exam instances in this.examServerList[]
   * starts an intervall to check server status and reacts on information given by the server instance
   */
  init(gateway) {
    this.gateway = gateway;
    this.client = dgram.createSocket("udp4");
    this.client.on("error", (err) => {
      log2.error(`multicastclient @ init: UDP MC Client error:
${err.stack}`);
      this.client.close();
    });
    try {
      this.client.bind(this.PORT, "0.0.0.0", () => {
        this.client.setBroadcast(true);
        this.client.setMulticastTTL(128);
        if (this.gateway) {
          this.client.addMembership(this.MULTICAST_ADDR);
        }
        if (!this.gateway) {
          log2.warn("mcclient: No Gateway! Starting MulticastClient without adding group membership");
        }
        log2.info(`multicastclient @ init: UDP MC Client listening on http://${config_default.hostip}:${this.client.address().port}`);
      });
    } catch (e) {
      log2.error(`mulitcastclient @ init: ${e}`);
    }
    this.client.on("message", (message, rinfo) => {
      this.messageReceived(message, rinfo);
    });
    this.refreshExamsScheduler = new SchedulerService(this.isDeprecatedInstance.bind(this), 5e3);
    this.refreshExamsScheduler.start();
  }
  /**
   * receives messages and stores new exam instances in this.examServerList[]
   */
  messageReceived(message, rinfo) {
    const serverInfo = JSON.parse(String(message));
    serverInfo.serverip = rinfo.address;
    serverInfo.serverport = rinfo.port;
    serverInfo.reachable = true;
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

// src-electron/electron-main.js
import path8 from "path";
import fs5 from "fs";
import * as fsExtra from "fs-extra";
import ip2 from "ip";
import { gateway4sync as gateway4sync2 } from "default-gateway";

// src-electron/main/scripts/windowhandler.js
import { app as app5, BrowserWindow, BrowserView, dialog, screen } from "electron";
import path4, { join as join3 } from "path";

// src-electron/main/scripts/platformrestrictions.js
import { join as join2 } from "path";
import childProcess from "child_process";
import { app as app2, TouchBar, clipboard, globalShortcut } from "electron";
import log3 from "electron-log";
var __dirname2 = import.meta.dirname;
var gnomeKeybindings = [
  "activate-window-menu",
  "maximize-horizontally",
  "move-to-side-n",
  "move-to-workspace-8",
  "switch-applications",
  "switch-to-workspace-3",
  "switch-windows-backward",
  "always-on-top",
  "maximize-vertically",
  "move-to-side-s",
  "move-to-workspace-9",
  "switch-applications-backward",
  "  switch-to-workspace-4",
  "toggle-above",
  "begin-move",
  "minimize",
  "move-to-side-w",
  "move-to-workspace-down",
  "switch-group",
  "switch-to-workspace-5",
  "toggle-fullscreen",
  "begin-resize",
  "move-to-center",
  "move-to-workspace-1",
  "move-to-workspace-last",
  "switch-group-backward",
  "switch-to-workspace-6",
  "toggle-maximized",
  "close",
  "move-to-corner-ne",
  "move-to-workspace-10",
  "move-to-workspace-left",
  "switch-input-source",
  "switch-to-workspace-7",
  "toggle-on-all-workspaces",
  "cycle-group",
  "move-to-corner-nw",
  "move-to-workspace-11",
  "move-to-workspace-right",
  "switch-input-source-backward  switch-to-workspace-8",
  "toggle-shaded",
  "cycle-group-backward",
  "move-to-corner-se",
  "move-to-workspace-12",
  "move-to-workspace-up",
  "switch-panels",
  "switch-to-workspace-9",
  "unmaximize",
  "cycle-panels",
  "move-to-corner-sw",
  "move-to-workspace-2",
  "panel-main-menu",
  "switch-panels-backward",
  "switch-to-workspace-down",
  "cycle-panels-backward",
  "move-to-monitor-down",
  "move-to-workspace-3",
  "panel-run-dialog",
  "switch-to-workspace-1",
  "switch-to-workspace-last",
  "cycle-windows",
  "move-to-monitor-left",
  "move-to-workspace-4",
  "raise",
  "switch-to-workspace-10",
  "switch-to-workspace-left",
  "cycle-windows-backward",
  "move-to-monitor-right",
  "move-to-workspace-5",
  "raise-or-lower",
  "switch-to-workspace-11",
  "switch-to-workspace-right",
  "lower",
  "move-to-monitor-up",
  "move-to-workspace-6",
  "set-spew-mark",
  "switch-to-workspace-12",
  "switch-to-workspace-up",
  "maximize",
  "move-to-side-e",
  "move-to-workspace-7",
  "show-desktop",
  "switch-to-workspace-2",
  "switch-windows"
];
var gnomeShellKeybindings = [
  "focus-active-notification",
  "open-application-menu",
  "screenshot",
  "screenshot-window",
  "shift-overview-down",
  "shift-overview-up",
  "switch-to-application-1",
  "switch-to-application-2",
  "switch-to-application-3",
  "switch-to-application-4",
  "switch-to-application-5",
  "switch-to-application-6",
  "switch-to-application-7",
  "switch-to-application-8",
  "switch-to-application-9",
  "show-screenshot-ui",
  "show-screen-recording-ui",
  "toggle-application-view",
  "toggle-message-tray",
  "toggle-overview"
];
var gnomeMutterKeybindings = ["rotate-monitor", "switch-monitor", "tab-popup-cancel", "tab-popup-select", "toggle-tiled-left", "toggle-tiled-right"];
var gnomeDashToDockKeybindings = [
  "app-ctrl-hotkey-1",
  "app-ctrl-hotkey-10",
  "app-ctrl-hotkey-2",
  "app-ctrl-hotkey-3",
  "app-ctrl-hotkey-4",
  "app-ctrl-hotkey-5",
  "app-ctrl-hotkey-6",
  "app-ctrl-hotkey-7",
  "app-ctrl-hotkey-8",
  "app-ctrl-hotkey-9",
  "app-hotkey-1",
  "app-hotkey-10",
  "app-hotkey-2",
  "app-hotkey-3",
  "app-hotkey-4",
  "app-hotkey-5",
  "app-hotkey-6",
  "app-hotkey-7",
  "app-hotkey-8",
  "app-hotkey-9",
  "app-shift-hotkey-1",
  "app-shift-hotkey-10",
  "app-shift-hotkey-2",
  "app-shift-hotkey-3",
  "app-shift-hotkey-4",
  "app-shift-hotkey-5",
  "app-shift-hotkey-6",
  "app-shift-hotkey-7",
  "app-shift-hotkey-8",
  "app-shift-hotkey-9",
  "shortcut"
];
var gnomeWaylandKeybindings = ["switch-to-session-1", "switch-to-session-2", "switch-to-session-3", "switch-to-session-4", "switch-to-session-5", "switch-to-session-6", "switch-to-session-7", "switch-to-session-8", "switch-to-session-9", "switch-to-session-10", "switch-to-session-11", "switch-to-session-12"];
var clipboardInterval;
var configStore = {
  linux: {},
  windows: {},
  macos: {}
};
var appsToClose = ["chatgpt", "ChatGPT", "NortonSecurity", "NAV", "Teams", "ms-teams", "zoom.us", "Google Chrome", "Microsoft Edge", "Microsoft Teams", "firefox", "discord", "zoom", "chrome", "msedge", "teams", "teamviewer", "google-chrome", "skypeforlinux", "skype", "brave", "opera", "anydesk", "safari"];
var isKDE = false;
var isGNOME = false;
childProcess.exec("echo $XDG_CURRENT_DESKTOP", (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  if (stdout.trim() === "KDE") {
    isKDE = true;
  }
  if (stdout.trim() === "GNOME") {
    isGNOME = true;
  }
});
function enableRestrictions(winhandler) {
  if (config_default.development) {
    return;
  }
  log3.info("platformrestrictions @ enableRestrictions: enabling platform restrictions");
  globalShortcut.register("CommandOrControl+V", () => {
    console.log("no clipboard");
  });
  globalShortcut.register("CommandOrControl+Shift+V", () => {
    console.log("no clipboard");
  });
  globalShortcut.register("CommandOrControl+X", () => {
    console.log("no clipboard");
  });
  globalShortcut.register("CommandOrControl+C", () => {
    console.log("no clipboard");
  });
  clipboard.clear();
  clipboardInterval = new SchedulerService(() => {
    clipboard.clear();
  }, 1e3);
  clipboardInterval.start();
  if (process.platform === "linux") {
    try {
      appsToClose.forEach((app11) => {
        childProcess.exec(`pgrep -i "${app11}"`, (pgrepError, stdout) => {
          if (!pgrepError && stdout && stdout.trim()) {
            childProcess.exec(`pgrep -i "${app11}" | xargs -r kill -9`, (killError) => {
              if (!killError) {
                log3.info(`platformrestrictions @ enableRestrictions: closed ${app11}`);
              }
            });
          }
        });
      });
    } catch (err) {
    }
    if (isKDE) {
      log3.info("platformrestrictions @ enableRestrictions: enabling KDE restrictions");
      childProcess.execFile("kreadconfig5", ["--file", "kwinrc", "--group", "Desktops", "--key", "Number"], (error, stdout, stderr) => {
        if (error) {
          log3.error(`platformrestrictions @ enableRestrictions (kreadconfig): ${error.message}`);
          configStore.linux.numberOfDesktops = 1;
          return;
        }
        configStore.linux.numberOfDesktops = stdout.trim();
      });
      log3.info(`platformrestrictions @ enableRestrictions: reconfiguring kwin`);
      childProcess.execFile("kwriteconfig5", ["--file", `${config_default.homedirectory}/.config/kwinrc`, "--group", "ModifierOnlyShortcuts", "--key", "Meta", '""']);
      childProcess.execFile("kwriteconfig5", ["--file", `kwinrc`, "--group", "Desktops", "--key", "Number", "1"]);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "reconfigure"]);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "setCurrentDesktop", "1"]);
      log3.info(`platformrestrictions @ enableRestrictions: disabling effects`);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "desktopgrid"]);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "screenedge"]);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "overview"]);
      log3.info(`platformrestrictions @ enableRestrictions: additional tty's`);
      childProcess.execFile("kwriteconfig5", ["--file", "kxkbrc", "--group", "Layout", "--key", "Options", "srvrkeys:none"]);
      childProcess.execFile("dbus-send", ["--session", "--type=signal", "--dest=org.kde.keyboard", "/Layouts", "org.kde.keyboard.reloadConfig"]);
      log3.info(`platformrestrictions @ enableRestrictions: clearing clipboard history`);
      childProcess.execFile("qdbus", ["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.clearClipboardHistory"]);
      setTimeout(() => {
        log3.info(`platformrestrictions @ enableRestrictions: disabling global keyboardshortcuts`);
        childProcess.execFile("qdbus", ["org.kde.kglobalaccel", "/kglobalaccel", "org.kde.KGlobalAccel.blockGlobalShortcuts", "true"]);
      }, 2e3);
    }
    if (isGNOME) {
      log3.info("platformrestrictions @ enableRestrictions: enabling GNOME restrictions");
      try {
        for (let binding of gnomeKeybindings) {
          childProcess.execFile("gsettings", ["set", "org.gnome.desktop.wm.keybindings", `${binding}`, `['']`]);
        }
        for (let binding of gnomeWaylandKeybindings) {
          childProcess.execFile("gsettings", ["set", "org.gnome.mutter.wayland.keybindings", `${binding}`, `['']`]);
        }
        for (let binding of gnomeShellKeybindings) {
          childProcess.execFile("gsettings", ["set", "org.gnome.shell.keybindings", `${binding}`, `['']`]);
        }
        for (let binding of gnomeMutterKeybindings) {
          childProcess.execFile("gsettings", ["set", "org.gnome.mutter.keybindings", `${binding}`, `['']`]);
        }
        for (let binding of gnomeDashToDockKeybindings) {
          childProcess.execFile("gsettings", ["set", "org.gnome.shell.extensions.dash-to-dock", `${binding}`, `['']`]);
        }
        childProcess.execFile("gsettings", ["set", "org.gnome.mutter", `overlay-key`, `''`]);
        childProcess.exec("gsettings set org.gnome.mutter dynamic-workspaces false");
        childProcess.exec("gsettings set org.gnome.desktop.wm.preferences num-workspaces 1");
      } catch (err) {
        log3.error(`platformrestrictions @ enableRestrictions (gsettings): ${err}`);
      }
    }
    try {
      childProcess.execFile("wl-copy", ["-c"]);
      childProcess.exec("xclip -i /dev/null");
      childProcess.exec("xclip -selection clipboard");
      childProcess.exec("xsel -bc");
    } catch (err) {
      log3.error(`platformrestrictions @ enableRestrictions (gsettings): ${err}`);
    }
  }
  if (process.platform === "win32") {
    try {
      let executable1 = join2(__dirname2, "../../public/disable-shortcuts.exe");
      childProcess.execFile(executable1, [], { detached: true, stdio: "ignore", shell: false, windowsHide: true });
      log3.info("platformrestrictions @ enableRestrictions: windows shortcuts disabled");
    } catch (err) {
      log3.error(`platformrestrictions @ enableRestrictions (win shortcuts): ${err}`);
    }
    try {
      appsToClose.forEach((app11) => {
        const escapedApp = app11.replace(/'/g, "''");
        const command = `powershell -NoProfile -Command "$appName = '${escapedApp}'; try { $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ilike ('*' + $appName + '*') }; if ($procs -and $procs.Count -gt 0) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output 'killed' } } catch { }"`;
        childProcess.exec(command, (error, stdout, stderr) => {
          if (!error && stdout && stdout.trim().includes("killed")) {
            log3.info(`platformrestrictions @ enableRestrictions: closed ${app11}`);
          }
        });
      });
    } catch (err) {
    }
    try {
      childProcess.exec("taskkill /f /im explorer.exe", (error, stdout, stderr) => {
        if (!error && stdout) {
          log3.info(`platformrestrictions @ enableRestrictions: closed explorer.exe`);
        }
      });
    } catch (err) {
    }
  }
  if (process.platform === "darwin") {
    const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
    const textlabel = new TouchBarLabel({ label: "Next-Exam" });
    const touchBar = new TouchBar({
      items: [
        new TouchBarSpacer({ size: "flexible" }),
        textlabel,
        new TouchBarSpacer({ size: "flexible" })
      ]
    });
    winhandler.examwindow?.setTouchBar(touchBar);
    childProcess.exec("pbcopy < /dev/null");
    appsToClose.forEach((app11) => {
      childProcess.exec(`pkill -9 -f "${app11}"`, (error, stderr, stdout) => {
      });
    });
    let mcscriptfile = join2(__dirname2, "../../public/spaces.applescript");
    if (app2.isPackaged) {
      mcscriptfile = join2(process.resourcesPath, "app.asar.unpacked", "public/spaces.applescript");
    }
    childProcess.execFile("osascript", [mcscriptfile], (error, stdout, stderr) => {
      if (stderr) {
        log3.info(stderr);
      }
    });
  }
}
function disableRestrictions() {
  if (config_default.development) {
    return;
  }
  log3.info("platformrestrictions @ disableRestrictions: removing restrictions...");
  if (clipboardInterval) {
    clipboardInterval.stop();
  }
  globalShortcut.unregister("CommandOrControl+V", () => {
    console.log("activate clipboard");
  });
  globalShortcut.unregister("CommandOrControl+Shift+V", () => {
    console.log("activate clipboard");
  });
  globalShortcut.unregister("CommandOrControl+C", () => {
    console.log("activate clipboard");
  });
  globalShortcut.unregister("CommandOrControl+X", () => {
    console.log("activate clipboard");
  });
  if (process.platform === "linux") {
    childProcess.execFile("wl-copy", ["-c"]);
    childProcess.exec("xclip -i /dev/null");
    childProcess.exec("xclip -selection clipboard");
    childProcess.exec("xsel -bc");
    childProcess.exec("echo $XDG_CURRENT_DESKTOP", (error, stdout, stderr) => {
      if (error) {
        log3.error(`platformrestrictions @ disableRestrictions (linux): exec error: ${error}`);
        return;
      }
      if (stdout.trim() === "KDE") {
        log3.info("platformrestrictions @ disableRestrictions (linux): KDE detected");
        childProcess.execFile("qdbus", ["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.clearClipboardHistory"]);
        childProcess.execFile("qdbus", ["org.kde.kglobalaccel", "/kglobalaccel", "blockGlobalShortcuts", "false"]);
        childProcess.execFile("qdbus", ["org.kde.KWin", "/Compositor", "org.kde.kwin.Compositing.resume"]);
        childProcess.exec("kstart5 kglobalaccel5&");
        childProcess.execFile("kwriteconfig5", ["--file", `${config_default.homedirectory}/.config/kwinrc`, "--group", "ModifierOnlyShortcuts", "--key", "Meta", "--delete"]);
        childProcess.execFile("kwriteconfig5", ["--file", `kwinrc`, "--group", "Desktops", "--key", "Number", configStore.linux.numberOfDesktops]);
        childProcess.execFile("kwriteconfig5", ["--file", "kxkbrc", "--group", "Layout", "--key", "Options", ""]);
        childProcess.execFile("dbus-send", ["--session", "--type=signal", "--dest=org.kde.keyboard", "/Layouts", "org.kde.keyboard.reloadConfig"]);
        childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "reconfigure"]);
        const child = childProcess.exec("kstart5 plasmashell &", {
          detached: true,
          // run independently
          stdio: "ignore"
          // disconnect stdio
        });
        child.unref();
      }
    });
    for (let binding of gnomeKeybindings) {
      childProcess.execFile("gsettings", ["reset", "org.gnome.desktop.wm.keybindings", `${binding}`]);
    }
    for (let binding of gnomeShellKeybindings) {
      childProcess.execFile("gsettings", ["reset", "org.gnome.shell.keybindings", `${binding}`]);
    }
    for (let binding of gnomeMutterKeybindings) {
      childProcess.execFile("gsettings", ["reset", "org.gnome.mutter.keybindings", `${binding}`]);
    }
    for (let binding of gnomeDashToDockKeybindings) {
      childProcess.execFile("gsettings", ["reset", "org.gnome.shell.extensions.dash-to-dock", `${binding}`]);
    }
    childProcess.execFile("gsettings", ["reset", "org.gnome.mutter", `overlay-key`]);
  }
  if (process.platform === "win32") {
    log3.info("platformrestrictions @ disableRestrictions (win): unblocking shortcuts...");
    try {
      childProcess.exec(`taskkill  /IM "disable-shortcuts.exe" /T /F`, (error, stdout, stderr) => {
        if (!error && stdout) {
          log3.info(`platformrestrictions @ disableRestrictions: closed disable-shortcuts.exe`);
        }
      });
    } catch (e) {
    }
    try {
      childProcess.exec('tasklist /FI "IMAGENAME eq explorer.exe"', (error, stdout, stderr) => {
        if (error) {
          log3.error(`tasklist error: ${error}`);
          return;
        }
        if (!stdout.includes("explorer.exe")) {
          log3.info("platformrestrictions @ disableRestrictions (win): restarting explorer...");
          const child = childProcess.exec("start explorer.exe", {
            detached: true,
            // run independently
            stdio: "ignore"
            // disconnect stdio
          });
          child.unref();
        }
      });
    } catch (e) {
      log3.error(`platformrestrictions @ disablerestrictions (win explorer): ${e.message}`);
    }
  }
}

// src-electron/main/scripts/windowhandler.js
import log6 from "electron-log";
import { activeWindow } from "get-windows";

// src-electron/main/scripts/lt-server.js
import path3 from "path";
import log5 from "electron-log";
import { app as app4 } from "electron";

// src-electron/main/scripts/jre-handler.js
import fs2 from "fs";
import path2 from "path";
import process2 from "process";
import { spawn } from "child_process";
import { app as app3 } from "electron";
import log4 from "electron-log";
var __dirname3 = import.meta.dirname;
var JreHandler = class {
  constructor() {
  }
  init() {
    this.jTest();
  }
  fail(reason) {
    log4.error(reason);
    process2.exit(1);
  }
  getDirectories(dirPath) {
    let dirs = fs2.readdirSync(dirPath).filter(
      (file) => fs2.statSync(path2.join(dirPath, file)).isDirectory()
    );
    return dirs;
  }
  driver() {
    var d = platformDispatcher_default.javaBin.slice();
    d.unshift(platformDispatcher_default.jreDir);
    return path2.join.apply(path2, d);
  }
  getArgs(classpath, classname, args) {
    args = (args || []).slice();
    classpath = classpath || [];
    args.unshift(classname);
    args.unshift(classpath.join(this._platform === "win32" ? ";" : ":"));
    args.unshift("-cp");
    return args;
  }
  jSpawn(classpath, classname, args) {
    let javapath = this.driver();
    let javaargs = this.getArgs(classpath, classname, args);
    let javacmdline = `${javapath} ${javaargs.join(" ")} `;
    log4.info(`jre-handler @ jSpawn: '${platformDispatcher_default.jre}' selected`);
    log4.info(`jre-handler @ jSpawn: spawning java process: ${javacmdline}`);
    return spawn(javapath, javaargs, { shell: false });
  }
  jTest() {
    let javapath = this.driver();
    const proc = spawn(javapath, ["-version"]);
    proc.stderr.on("data", (data) => {
      const lines = data.toString().split("\n");
      log4.debug(`jre-handler @ jTest: ${lines[0]}`);
    });
  }
};
var jre_handler_default = new JreHandler();

// src-electron/main/scripts/lt-server.js
import { exec } from "child_process";
import os2 from "os";
var __dirname4 = import.meta.dirname;
var languageToolJarPath = path3.join(__dirname4, "../../public/LanguageTool/languagetool-server.jar");
if (app4.isPackaged) {
  languageToolJarPath = path3.join(process.resourcesPath, "app.asar.unpacked", "public/LanguageTool/languagetool-server.jar");
}
var languageToolConfigPath = path3.join(__dirname4, "../../public/LanguageTool/server.properties");
if (app4.isPackaged) {
  languageToolConfigPath = path3.join(process.resourcesPath, "app.asar.unpacked", "public/LanguageTool/server.properties");
}
var LanguageToolServer = class {
  constructor() {
    this.languageToolProcess = null;
    this.port = 8088;
  }
  startServer() {
    if (this.languageToolProcess && !this.languageToolProcess.killed) {
      log5.warn("lt-server @ startserver: LanguageTool server is already running.");
      return;
    }
    try {
      this.languageToolProcess = jre_handler_default.jSpawn(
        [languageToolJarPath],
        // Klassenpfad
        "org.languagetool.server.HTTPServer",
        // Hauptklasse der LanguageTool API
        ["--port", this.port, "--config", languageToolConfigPath, "--allow-origin", "'*'"]
        // Zusätzliche Argumente, z.B. Port und CORS-Erlaubnis
      );
      log5.info("lt-server @ startserver: LanguageTool API running at localhost:8088");
      this.languageToolProcess.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.toLowerCase().includes("error")) {
          log5.info("lt-server @ startserver  data-error:", output);
        }
        if (output.toLowerCase().includes("starting")) {
          log5.info("lt-server @ startserver  data-info:", output);
        }
        if (output.toLowerCase().includes("check done")) {
          log5.info("lt-server @ startserver  data-info:", output);
        }
        if (output.toLowerCase().includes("handled request")) {
          log5.info("lt-server @ startserver  data-info:", output);
        }
      });
      let stderrBuffer = "";
      this.languageToolProcess.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderrBuffer += chunk;
        const portStr = String(this.port);
        const fullResponse = stderrBuffer;
        const isPortError = fullResponse.includes(portStr) || fullResponse.includes("Adresse wird bereits verwendet") || fullResponse.includes("Maybe something else is running on that port") || fullResponse.includes("Address already in use");
        if (isPortError) {
          log5.warn("lt-server @ startserver: another LanguageTool server is probably already running on port:", this.port);
          stderrBuffer = "";
        } else if (chunk.includes("\n") || fullResponse.length > 200) {
          log5.error("lt-server @ startserver data-error:", fullResponse.trim());
          stderrBuffer = "";
        }
      });
      this.languageToolProcess.on("exit", (code) => {
        log5.warn(`lt-server @ startserver: LanguageTool server exited with code ${code}`);
        this.languageToolProcess = null;
      });
    } catch (err) {
      log5.error("lt-server @ startserver general-error:", err);
    }
  }
  stopServer() {
    if (!this.languageToolProcess) {
      log5.info("lt-server @ stopServer: LanguageTool server was never started, nothing to stop");
      return;
    }
    if (!this.languageToolProcess.killed) {
      try {
        this.languageToolProcess.kill();
        log5.info("lt-server @ stopServer: LanguageTool server process killed");
        this.languageToolProcess = null;
        return;
      } catch (err) {
        log5.warn("lt-server @ stopServer: failed to kill process directly, trying platform-specific method:", err);
      }
    }
    const platform = os2.platform();
    let command;
    if (platform === "win32") {
      command = `wmic process where "commandline like '%languagetool-server.jar%'" delete 2>nul || powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*languagetool-server.jar*'} | Stop-Process -Force" 2>nul || for /f "tokens=5" %a in ('netstat -ano ^| findstr :8088') do taskkill /F /PID %a 2>nul`;
    } else if (platform === "darwin" || platform === "linux") {
      command = "pkill -f languagetool-server.jar";
    } else {
      log5.warn("lt-server @ stopServer: unsupported platform:", platform);
      return;
    }
    exec(command, (error, stdout, stderr) => {
      if (error) {
        if (error.code !== 1 && !error.message.includes("not found") && !stderr.toString().includes("No such process")) {
          log5.warn("lt-server @ stopServer: error killing LanguageTool server:", error.message);
        } else {
          log5.info("lt-server @ stopServer: LanguageTool server process not found (may already be stopped)");
        }
      } else {
        log5.info("lt-server @ stopServer: LanguageTool server stopped successfully");
      }
      this.languageToolProcess = null;
    });
  }
};
var lt_server_default = new LanguageToolServer();

// src-electron/main/scripts/windowhandler.js
import { fileURLToPath } from "node:url";
var __dirname5 = import.meta.dirname;
var WindowHandler = class {
  constructor() {
    this.blockwindows = [];
    this.screenlockwindows = [];
    this.screenlockWindow = null;
    this.mainwindow = null;
    this.examwindow = null;
    this.examDisplayId = null;
    this.splashwin = null;
    this.bipwindow = null;
    this.config = null;
    this.multicastClient = null;
    this.exitWarningOpen = false;
    this.exitQuestionOpen = false;
    this.minimizeWarningOpen = false;
  }
  init(mc, config2) {
    this.multicastClient = mc;
    this.config = config2;
    this.checkWindowInterval = new SchedulerService(this.windowTracker.bind(this), 1e3);
    this.focusTargetAllowed = true;
  }
  // return electron window in focus or an other electron window depending on the hierachy
  getCurrentFocusedWindow() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      return focusedWindow;
    } else {
      if (this.screenlockWindow) {
        return this.screenlockWindow;
      } else if (this.examwindow) {
        return this.examwindow;
      } else if (this.mainwindow) {
        return this.mainwindow;
      } else {
        return false;
      }
    }
  }
  createBiPLoginWin(biptest) {
    this.bipwindow = new BrowserWindow({
      title: "Next-Exam",
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      center: true,
      width: 1e3,
      height: 800,
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
      log6.info("did-navigate");
      log6.info(url);
    });
    this.bipwindow.webContents.on("will-navigate", (event, url) => {
      log6.info("will-navigate");
      log6.info(url);
    });
    this.bipwindow.webContents.on("new-window", (event, url) => {
      log6.info("new-window");
      log6.info(url);
      event.preventDefault();
    });
    this.bipwindow.webContents.setWindowOpenHandler(({ url }) => {
      log6.info("target: _blank");
      log6.info(url);
      return { action: "deny" };
    });
    this.bipwindow.webContents.on("will-redirect", (event, url) => {
      log6.info("Redirecting to:", url);
      if (url.startsWith("bildungsportal://")) {
        event.preventDefault();
        const prefix = "bildungsportal://token=";
        const token = url.substring(prefix.length);
        log6.info("Captured Token:");
        log6.info(token);
        this.mainwindow.webContents.send("bipToken", token);
        this.bipwindow.close();
      }
    });
  }
  /**
   * this is an easter egg
   */
  createEasterWin() {
    this.easterwin = new BrowserWindow({
      title: "Next-Exam",
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      center: true,
      width: 768,
      height: 480,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      movable: false,
      frame: true,
      show: false,
      transparent: false
    });
    this.easterwin.loadFile(join3(__dirname5, `../../public/cowsonice/index.html`));
    this.easterwin.webContents.once("did-finish-load", () => {
      if (this.easterwin && !this.easterwin.isVisible()) {
        this.easterwin.show();
      }
    });
  }
  /**
   * BlockWindow (to cover additional screens)
   * @param display 
   */
  newBlockWin(display) {
    let blockwin = new BrowserWindow({
      x: display.bounds.x + 0,
      y: display.bounds.y + 0,
      parent: this.examwindow,
      skipTaskbar: true,
      title: "Next-Exam",
      width: display.bounds.width,
      height: display.bounds.height,
      closable: false,
      alwaysOnTop: true,
      focusable: false,
      //doesn't work with kiosk mode (no kiosk mode possible.. why?)
      minimizable: false,
      // resizable:false,   // leads to weird 20px bottomspace on windows
      movable: false,
      frame: false,
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join3(__dirname5, "./preload/electron-preload.cjs")
      }
    });
    let url = "notfound";
    if (app5.isPackaged) {
      let path9 = join3(__dirname5, `../renderer/index.html`);
      blockwin.loadFile(path9, { hash: `#/${url}/` });
    } else {
      url = `${"http://localhost:9300"}/#/${url}/`;
      blockwin.loadURL(url);
    }
    blockwin.removeMenu();
    blockwin.setMinimizable(false);
    blockwin.setBounds({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    });
    blockwin.setAlwaysOnTop(true, "screen-saver", 1);
    blockwin.show();
    if (process.platform === "darwin") {
      blockwin.setFullScreen(true);
      blockwin.on("leave-full-screen", () => {
        blockwin.setFullScreen(true);
      });
    } else {
      blockwin.setKiosk(true);
    }
    blockwin.moveTop();
    blockwin.display = display;
    this.blockwindows.push(blockwin);
  }
  // block all screens with a blockwindow
  async initBlockWindows() {
    let displays = screen.getAllDisplays();
    if (!this.config.development) {
      if (this.examwindow && !this.examwindow.isDestroyed()) {
        let retries = 0;
        const maxRetries = 10;
        while (!this.examwindow.isVisible() && retries < maxRetries) {
          await this.sleep(100);
          retries++;
        }
        await this.sleep(200);
      }
      this.blockwindows = this.blockwindows.filter((blockwin) => blockwin && !blockwin.isDestroyed());
      const usedDisplayIds = /* @__PURE__ */ new Set();
      if (this.examDisplayId) {
        usedDisplayIds.add(this.examDisplayId);
      }
      const primaryDisplay = screen.getPrimaryDisplay();
      if (primaryDisplay && primaryDisplay.id) {
        usedDisplayIds.add(primaryDisplay.id);
      }
      if (this.examwindow && !this.examwindow.isDestroyed()) {
        try {
          const bounds = this.examwindow.getBounds();
          const display = screen.getDisplayMatching(bounds);
          usedDisplayIds.add(display.id);
          log6.info(`windowhandler @ initBlockWindows: exam window is on display ${display.id}`);
        } catch (err) {
          log6.error(`windowhandler @ initBlockWindows: error getting exam window display: ${err}`);
        }
      }
      for (const blockwin of this.blockwindows) {
        try {
          const bounds = blockwin.getBounds();
          const display = screen.getDisplayMatching(bounds);
          usedDisplayIds.add(display.id);
          log6.info(`windowhandler @ initBlockWindows: block window found on display ${display.id}`);
        } catch (err) {
          log6.error(`windowhandler @ initBlockWindows: error getting block window display: ${err}`);
        }
      }
      for (let display of displays) {
        if (usedDisplayIds.has(display.id)) {
          log6.info(`windowhandler @ initBlockWindows: skipping display ${display.id} - already has exam or block window`);
          continue;
        }
        log6.info("windowhandler @ initBlockWindows: create blockwin on:", display.id);
        this.newBlockWin(display);
      }
      await this.sleep(1e3);
      this.blockwindows.forEach((blockwin) => {
        if (blockwin && !blockwin.isDestroyed()) {
          blockwin.moveTop();
        }
      });
    }
  }
  /**
   * Screenlock Window (to cover the mainscreen) - block students from working
   * @param display 
   */
  createScreenlockWindow(display) {
    let screenlockWindow = new BrowserWindow({
      show: false,
      x: display.bounds.x + 0,
      y: display.bounds.y + 0,
      // parent: this.mainwindow,   // leads to visible titlebar in gnome-desktop
      skipTaskbar: true,
      title: "Screenlock",
      width: display.bounds.width,
      height: display.bounds.height,
      closable: false,
      alwaysOnTop: true,
      //focusable: false,   //doesn't work with kiosk mode (no kiosk mode possible.. why?)
      minimizable: false,
      // resizable:false, // leads to weird 20px bottomspace on windows
      movable: false,
      frame: false,
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join3(__dirname5, "./preload/electron-preload.cjs")
      }
    });
    let url = "lock";
    if (app5.isPackaged) {
      let path9 = join3(__dirname5, `../renderer/index.html`);
      screenlockWindow.loadFile(path9, { hash: `#/${url}/` });
    } else {
      url = `${"http://localhost:9300"}/#/${url}/`;
      screenlockWindow.loadURL(url);
    }
    if (this.config.showdevtools) {
      screenlockWindow.webContents.openDevTools();
    }
    this.screenlockwindows.push(screenlockWindow);
    screenlockWindow.webContents.once("did-finish-load", () => {
      if (!screenlockWindow) return;
      screenlockWindow.removeMenu();
      screenlockWindow.setMinimizable(false);
      screenlockWindow.setKiosk(true);
      screenlockWindow.setAlwaysOnTop(true, "pop-up-menu", 1);
      screenlockWindow.show();
      screenlockWindow.moveTop();
      screenlockWindow.setClosable(true);
      screenlockWindow.setVisibleOnAllWorkspaces(true);
      this.addBlurListener("screenlock");
    });
    screenlockWindow.on("close", async (e) => {
      if (!this.config.development) {
        e.preventDefault();
      }
    });
    screenlockWindow.on("closed", () => {
      this.screenlockwindows = this.screenlockwindows.filter((win) => win && win !== screenlockWindow && !win.isDestroyed());
    });
  }
  /**
   * Examwindow
   * @param examtype eduvidual, math, language
   * @param token student token
   * @param serverstatus the serverstatus object containing info about spellcheck language etc. 
   */
  async createExamWindow(examtype, token, serverstatus, primarydisplay) {
    if (examtype !== "rdp" && examtype !== "website" && examtype !== "gforms" && examtype !== "eduvidual" && examtype !== "editor" && examtype !== "math" && examtype !== "microsoft365" && examtype !== "activesheets" || !token) {
      log6.warn("missing parameters for exam-mode or mode not in allowed list!");
      examtype = "editor";
    }
    if (!primarydisplay || !primarydisplay.bounds || !primarydisplay.id) {
      primarydisplay = screen.getPrimaryDisplay();
      if (!primarydisplay || !primarydisplay.bounds) {
        const displays = screen.getAllDisplays();
        primarydisplay = displays[0] || primarydisplay;
      }
    }
    if (primarydisplay && primarydisplay.id) {
      this.examDisplayId = primarydisplay.id;
      log6.info(`windowhandler @ createExamWindow: reserving display ${this.examDisplayId} for exam window`);
    }
    let px = 0;
    let py = 0;
    if (primarydisplay && primarydisplay.bounds && primarydisplay.bounds.x) {
      px = primarydisplay.bounds.x;
      py = primarydisplay.bounds.y;
    }
    this.examwindow = new BrowserWindow({
      x: px + 0,
      y: py + 0,
      title: "Exam",
      width: 1440,
      height: 768,
      // parent: win,  //this doesnt work together with kiosk on ubuntu gnome ?? wtf
      // modal: true,  // this blocks the main window on windows while the exam window is open
      // closable: false,  // if we can't define 'parent' this window has to be closable - why?
      //alwaysOnTop: true,
      opacity: 1,
      skipTaskbar: true,
      autoHideMenuBar: true,
      minimizable: false,
      visibleOnAllWorkspaces: true,
      kiosk: this.config.development ? false : true,
      show: true,
      transparent: false,
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join3(__dirname5, "./preload/electron-preload.cjs"),
        spellcheck: false,
        contextIsolation: true,
        webviewTag: true,
        webSecurity: false
      }
    });
    this.examwindow.webContents.once("did-finish-load", async () => {
      if (!this.examwindow) return;
      if (this.config.showdevtools) {
        this.examwindow.webContents.openDevTools();
      }
      if (!this.config.development) {
        try {
          this.examwindow.removeMenu();
          this.examwindow.setAlwaysOnTop(true, "screen-saver", 1);
          this.examwindow.setKiosk(true);
          await this.sleep(500);
          await this.initBlockWindows();
          this.examwindow.moveTop();
          this.examwindow.focus();
          if (!this.isWayland) {
            this.checkWindowInterval.start();
          }
          enableRestrictions(this);
          await this.sleep(1e3);
          this.addBlurListener();
        } catch (e) {
          log6.error("windowhandler @ did-finish-load: error in examwindow setup", e);
        }
      }
    });
    this.examwindow.serverstatus = serverstatus;
    this.examwindow.menuHeight = 94;
    if (examtype === "microsoft365") {
      log6.info("starting microsoft365 exam...");
      let urlview = this.multicastClient.clientinfo.msofficeshare;
      if (!urlview) {
        log6.warn("windowhandler @ createExamWindow: no url for microsoft365 was set yet - waiting for next update tick");
        this.examwindow.destroy();
        this.examwindow = null;
        this.examDisplayId = null;
        disableRestrictions(this.examwindow);
        this.multicastClient.clientinfo.exammode = false;
        this.multicastClient.clientinfo.focus = true;
        return;
      }
      let url = examtype;
      if (app5.isPackaged) {
        let path9 = join3(__dirname5, `../renderer/index.html`);
        this.examwindow.loadFile(path9, { hash: `#/${url}/${token}` });
      } else {
        let backgroundurl = `${"http://localhost:9300"}/#/${url}/${token}/`;
        this.examwindow.loadURL(backgroundurl);
      }
      let contentView = new BrowserView({
        webPreferences: {
          spellcheck: false,
          contextIsolation: true
        }
      });
      contentView.setBounds({
        x: 0,
        y: this.examwindow.menuHeight,
        width: this.examwindow.getBounds().width,
        height: this.examwindow.getBounds().height - this.examwindow.menuHeight
      });
      contentView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true });
      contentView.webContents.loadURL(urlview);
      if (this.config.showdevtools) {
        contentView.webContents.openDevTools();
      }
      this.examwindow.addBrowserView(contentView);
      this.examwindow.on("enter-full-screen", () => {
        this.examwindow.setBrowserView(contentView);
        let newBounds = this.examwindow.getBounds();
        contentView.setBounds({
          x: 0,
          y: this.examwindow.menuHeight,
          width: newBounds.width,
          height: newBounds.height - this.examwindow.menuHeight
        });
      });
      this.examwindow.on("resize", () => {
        let newBounds = this.examwindow.getBounds();
        contentView.setBounds({
          x: 0,
          y: this.examwindow.menuHeight,
          width: newBounds.width,
          height: newBounds.height - this.examwindow.menuHeight
        });
      });
    } else {
      let url = examtype;
      if (app5.isPackaged) {
        let path9 = join3(__dirname5, `../renderer/index.html`);
        this.examwindow.loadFile(path9, { hash: `#/${url}/${token}` });
      } else {
        url = `${"http://localhost:9300"}/#/${url}/${token}/`;
        this.examwindow.loadURL(url);
      }
    }
    const examTypesWithPdfInHeader = ["gforms", "website", "eduvidual", "editor", "rdp", "microsoft365", "activesheets"];
    if (examTypesWithPdfInHeader.includes(serverstatus.examSections[serverstatus.lockedSection].examtype)) {
      this.examwindow.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
      });
      this.examwindow.webContents.on("new-window", (event, url) => {
        log6.warn("windowhandler @ examwindow: blocked new-window", url);
        event.preventDefault();
      });
      this.examwindow.webContents.setWindowOpenHandler(({ url }) => {
        log6.warn("windowhandler @ examwindow: blocked setWindowOpenHandler", url);
        return { action: "deny" };
      });
    }
    if (serverstatus.examSections[serverstatus.lockedSection].examtype === "microsoft365") {
      const browserView = this.examwindow.getBrowserView(0);
      browserView.webContents.on("will-navigate", (event, url) => {
        if (url !== this.multicastClient.clientinfo.msofficeshare) {
          log6.warn("do not navigate away from this test.. ");
          event.preventDefault();
        }
      });
      browserView.webContents.on("new-window", (event, url) => {
        event.preventDefault();
      });
      browserView.webContents.setWindowOpenHandler(({ url }) => {
        return { action: "deny" };
      });
      let executeCode = `
                    function lock(){
                        // 'WACDialogOuterContainer','WACDialogInnerContainer','WACDialogPanel',
                        const hideusByID = ['ShowHideEquationToolsPane','LinkGroup','GraphicsEditor','InsertTableOfContentsInInsertTab','InsertOnlinevideo','Picture','Ribbon-PictureMenuMLRDropdown','InsertAddInFlyout','Designer','Editor','FarPane','Help','InsertAppsForOffice','FileMenuLauncherContainer','Help-wrapper','Review-wrapper','Header','FarPeripheralControlsContainer','BusinessBar']
                        for (entry of hideusByID) {
                            let element = document.getElementById(entry)
                            if (element) { 
                                element.style.display = "none" 
                                element.style.setProperty("display", "none", "important");
                            }
                        }

                        let buttonAppsOverflow = document.getElementsByName('Add-Ins')[0];  // this button is redrawn on resize (doesn't happen in exam mode but still there must be a cleaner way - inserting css before it appears is not working)
                        if (buttonAppsOverflow){ buttonAppsOverflow.style.display = "none" }

                        let elements = document.querySelectorAll('[aria-label="Suchen"]');
                        elements.forEach(element => { element.style.display = 'none';});
                        elements = document.querySelectorAll('[aria-label="\xDCbersetzen"]');
                        elements.forEach(element => { element.style.display = 'none';});
                        elements = document.querySelectorAll('[aria-label="Copilot"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[aria-label="Add-Ins"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="ContextMenu-SmartLookupContextMenu"]');
                        elements.forEach(element => {element.style.display = 'none';});
                        elements = document.querySelectorAll('[data-unique-id="ContextMenu-SmartLookupSynonyms"]');
                        elements.forEach(element => {element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="Ribbon-ReferencesSmartLookUp"]');
                        elements.forEach(element => {element.style.display = 'none';});
                        elements = document.querySelectorAll('[data-unique-id="Dictation"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="GetAddins"]');
                        elements.forEach(element => { element.style.display = 'none'; });
                        elements = document.querySelectorAll('[data-unique-id="Pictures_MLR"]');
                        elements.forEach(element => { element.style.display = 'none'; });  
                    }
                    lock()  //for some reason excel delays that call.. doesnt happen on page finish load
                    `;
      let schedulerInstance = null;
      this.lockCallback = () => this.lock365(browserView, executeCode, schedulerInstance);
      schedulerInstance = new SchedulerService(this.lockCallback, 400);
      this.lockScheduler = schedulerInstance;
      schedulerInstance.start();
      browserView.webContents.on("did-finish-load", async () => {
        browserView.webContents.mainFrame.frames.filter((frame) => {
          if (frame) {
            frame.executeJavaScript(executeCode);
          }
        });
      });
    }
    this.examwindow.on("app-command", (e, cmd) => {
      if (cmd === "browser-backward" || cmd === "browser-forward") {
        log6.warn("no navigation allowed");
        e.preventDefault();
      }
    });
    this.examwindow.on("close", async (e) => {
      if (this.multicastClient.clientinfo.exammode) {
        if (!this.config.development) {
          e.preventDefault();
        }
      } else {
        this.examwindow.destroy();
        this.examwindow = null;
        this.examDisplayId = null;
        this.checkWindowInterval.stop();
        this.multicastClient.clientinfo.exammode = false;
        this.multicastClient.clientinfo.focus = true;
      }
    });
  }
  async lock365(browserView, executeCode, schedulerInstance) {
    if (browserView.webContents && browserView.webContents.mainFrame) {
      browserView.webContents.mainFrame.frames.filter((frame) => {
        if (frame && (frame.name === "WebApplicationFrame" || frame.name === "WacFrame_Word_0" || frame.name === "WacFrame_Excel_0")) {
          frame.executeJavaScript(executeCode);
        }
      });
    } else if (schedulerInstance) {
      log6.info("windowhandler @ lock365: stopping lockScheduler");
      schedulerInstance.stop();
      if (this.lockScheduler === schedulerInstance) {
        this.lockScheduler = null;
      }
    } else {
      log6.error("windowhandler @ lock365: no browserView or lockScheduler found");
    }
  }
  /****************************
   * MAIN WINDOW
   ***************************/
  async createMainWindow() {
    let primarydisplay = screen.getPrimaryDisplay();
    const currentDir = fileURLToPath(new URL(".", import.meta.url));
    if (!primarydisplay || !primarydisplay.bounds) {
      primarydisplay = screen.getAllDisplays()[0];
    }
    const windowWidth = 1024;
    const windowHeight = 640;
    let x = 0;
    let y = 0;
    if (primarydisplay && primarydisplay.bounds) {
      x = primarydisplay.bounds.x + Math.floor((primarydisplay.bounds.width - windowWidth) / 2);
      y = primarydisplay.bounds.y + Math.floor((primarydisplay.bounds.height - windowHeight) / 2);
    }
    this.mainwindow = new BrowserWindow({
      title: "Main window",
      icon: join3(__dirname5, "../../public/icons/icon.png"),
      x,
      y,
      width: windowWidth,
      height: windowHeight,
      minWidth: 850,
      minHeight: 600,
      resizable: false,
      // verhindert das Ändern der Größe  
      fullscreenable: false,
      // verhindert den Vollbildmodus - wichtig für macos denn wenn auf macos das mainwindow auf fullscreen ist greift beim examwindow der kiosk mode nicht  - electron bug (needs example code): >> https://github.com/electron/electron/issues/44755
      show: true,
      visibleOnAllWorkspaces: true,
      webPreferences: {
        preload: path4.resolve(
          currentDir,
          path4.join("/home/student/Webroot/GIT/next-exam/student/.quasar/dev-electron/preload", "electron-preload.cjs")
        ),
        spellcheck: false
      }
    });
    this.mainwindow.on("close", async (e) => {
      if (!this.config.development && !this.mainwindow.allowexit) {
        if (this.multicastClient.clientinfo.token) {
          const allowTray = !platformDispatcher_default._isGNOME();
          if (!allowTray) {
            log6.warn(`windowhandler @ createMainWindow: GNOME detected, quitting instead of tray minimize`);
            this.mainwindow.allowexit = true;
            return;
          }
          this.mainwindow.hide();
          e.preventDefault();
          await this.showMinimizeWarning();
          log6.warn(`windowhandler @ createMainWindow: Minimizing Next-Exam to Systemtray`);
          return;
        }
      }
    });
    this.mainwindow.removeMenu();
    this.mainwindow.focus();
    this.mainwindow.moveTop();
    if (this.config.showdevtools) {
      this.mainwindow.webContents.openDevTools();
    }
    if (app5.isPackaged || process.env["DEBUG"]) {
      const filePath = join3(__dirname5, "../renderer/index.html");
      log6.info(`windowhandler @ createMainWindow: Loading file: ${filePath}`);
      this.mainwindow.loadFile(filePath);
    } else {
      const url = `${"http://localhost:9300"}`;
      log6.info(`windowhandler @ createMainWindow: Loading URL: ${url}`);
      this.mainwindow.loadURL(url);
    }
  }
  async showExitWarning(message) {
    this.exitWarningOpen = true;
    this.mainwindow.allowexit = true;
    try {
      await dialog.showMessageBox(this.mainwindow, {
        type: "warning",
        buttons: ["Ok"],
        title: "Programm Beenden",
        message,
        cancelId: 1
      });
      app5.quit();
    } finally {
      this.exitWarningOpen = false;
    }
  }
  async showExitQuestion() {
    if (this.exitQuestionOpen) {
      log6.info("Windowhandler @ showExitQuestion: dialog already open, skipping");
      return;
    }
    this.exitQuestionOpen = true;
    try {
      let choice = await dialog.showMessageBox(this.mainwindow, {
        type: "question",
        buttons: ["Ja", "Nein"],
        title: "Programm beenden",
        message: "Wollen sie die Anwendung Next-Exam beenden?",
        cancelId: 1
      });
      if (choice.response == 1) {
        log6.info("Windowhandler @ showExitQuestion: do not close Next-Exam after finished Exam");
      } else {
        this.mainwindow.allowexit = true;
        app5.quit();
      }
    } finally {
      this.exitQuestionOpen = false;
    }
  }
  async showMinimizeWarning() {
    this.minimizeWarningOpen = true;
    try {
      await dialog.showMessageBox(this.mainwindow, {
        type: "info",
        buttons: ["OK"],
        title: "Minimize to System Tray",
        message: "Die Anwendung Next-Exam wurde minimiert!"
      });
    } finally {
      this.minimizeWarningOpen = false;
    }
  }
  /**
   * Additional Functions
   */
  isWayland() {
    return process.env.XDG_SESSION_TYPE === "wayland";
  }
  // this function uses active-win to receive name and url from active window - yet another way to figure out if the focus is still on nextexam
  // this is used to introduce exemptions for the blur listener
  // (downgraded from get-windows because of napi v9 issue) https://github.com/sindresorhus/get-windows/issues/186
  async windowTracker() {
    try {
      const activeWin = await activeWindow();
      if (activeWin && activeWin.owner && activeWin.owner.name) {
        let name = activeWin.owner.name;
        let wpath = activeWin.owner.path;
        let nameLower = name.toLowerCase();
        let wpathLower = wpath.toLowerCase();
        if (nameLower.includes("exam") || nameLower.includes("next") || nameLower.includes("electron") || wpathLower.includes("easeofaccessdialog") || wpathLower.includes("disable-shortcuts")) {
          this.focusTargetAllowed = true;
        } else {
          if (this.focusTargetAllowed) {
            log6.warn(`windowhandler @ windowTracker: focus lost event was triggered. app: ${wpath} - ${name} `);
          }
          this.multicastClient.clientinfo.focus = false;
          this.focusTargetAllowed = false;
        }
      }
    } catch (err) {
      log6.error(`windowhandler @ windowTracker: ${err}`);
    }
  }
  //adds blur listener when entering exammode   // blur event isnt fired on macos MISSIONCONTROL (which cant be deactivated anymore) - damn you apple!
  addBlurListener(window = "examwindow") {
    if (window === "examwindow") {
      log6.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}`);
      this.examwindow.addListener("blur", () => this.blurevent(this));
    } else if (window === "screenlock") {
      log6.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}window`);
      for (let screenlockwindow of this.screenlockwindows) {
        screenlockwindow.addListener("blur", () => this.blureventScreenlock(this));
      }
    }
  }
  //removes blur listener when leaving exam mode
  removeBlurListener() {
    if (this.examwindow) {
      this.examwindow.removeAllListeners("blur");
      log6.info("windowhandler @ removeBlurListener: removing blur listener");
    }
  }
  // implementing a sleep (wait) function
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  //student fogus went to another window
  async blurevent(winhandler) {
    log6.info("windowhandler @ blurevent: student tried to leave exam window");
    if (process.platform !== "linux") {
      await this.windowTracker();
      log6.info("windowtracker check done...");
    }
    winhandler.screenlockwindows = winhandler.screenlockwindows.filter((win) => win && !win.isDestroyed());
    const hasActiveScreenlock = winhandler.screenlockwindows.some((win) => win && !win.isDestroyed() && win.isVisible());
    if (hasActiveScreenlock || winhandler.multicastClient?.clientinfo?.screenlock) {
      return;
    }
    if (winhandler.focusTargetAllowed) {
      winhandler.examwindow.moveTop();
      winhandler.examwindow.show();
      winhandler.examwindow.focus();
      log6.warn(`windowhandler @ blurevent: blurevent was triggered but target is allowed`);
      return;
    }
    winhandler.multicastClient.clientinfo.focus = false;
    winhandler.examwindow.moveTop();
    winhandler.examwindow.setKiosk(true);
    winhandler.examwindow.show();
    winhandler.examwindow.focus();
  }
  //special blur event for temporary low security screenlock
  blureventScreenlock(winhandler) {
    log6.info("windowhandler @ blureventScreenlock: blur-screenlock triggered");
    try {
      winhandler.screenlockwindows[0].show();
      winhandler.screenlockwindows[0].moveTop();
      winhandler.screenlockwindows[0].focus();
    } catch (err) {
      log6.error(`windowhandler @ blureventScreenlock: ${err}`);
    }
  }
};
var windowhandler_default = new WindowHandler();

// src-electron/main/scripts/communicationhandler.js
import fs4 from "fs";
import archiver from "archiver";
import extract from "extract-zip";
import { join as join4 } from "path";
import { screen as screen2, ipcMain as ipcMain2, app as app9, BrowserWindow as BrowserWindow2, webContents as webContents2 } from "electron";

// src-electron/main/scripts/ipchandler.js
import path6 from "path";
import fs3 from "fs";
import ip from "ip";
import net from "net";

// src/locales/locales.ts
import { createI18n } from "vue-i18n";

// src/locales/en.json
var en_default = {
  main: {
    tray: {
      restore: "Restore",
      disconnect: "Disconnect",
      exit: "Exit"
    }
  },
  student: {
    password: "Password",
    exams: "Exams",
    username: "Username",
    pin: "Pincode",
    ip: "Server address",
    examname: "Exam Name",
    advanced: "advanced",
    simple: "simple",
    name: "Name",
    register: "register",
    registering: "registering...",
    registered: "registered",
    connected: "connected",
    disconnected: "disconnected",
    registeredinfo: "Successfully registered on server! \n\nPlease wait for the activation of the exam mode by the teacher!",
    started: "search started",
    nopw: "wrong username or pin",
    nouser: "no username given",
    noip: "Serveraddresse oder Examname missing",
    offline: "No Network Connection",
    nopin: "no pincode given",
    unreachable: "Server API unreachable",
    timeout: "Timeout! Exam-Teacher is behind Firewall.",
    noapi: "No Teacher API found on the given address",
    bildungsportal: "Bildungsportal",
    localLockdown: "Local lockdown",
    manualsearch: "Manual search",
    noexams: "No exams found",
    logoutBiP: "Are you sure you want to logout?",
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    sl: "Slovenian",
    none: "none",
    spellcheck: "Spellcheck",
    activate: "activate",
    suggest: "Show suggestions",
    spellcheckchoose: "Please choose a language",
    lang: "Languages",
    math: "Mathematics",
    selectexammode: "Select exam mode",
    outdated: "Version",
    outdatedinfo: "Please install the same version as the exam server!"
  },
  control: {
    tokennotvalid: "token is not valid",
    tokenvalid: "token is valid",
    statechange: "safe exam status changed",
    alreadyregistered: "student already registered",
    examinit: "started safe exam mode",
    examexit: "stopped safe exam mode",
    noexam: "safe exam mode not active",
    clientunsubscribe: "student removed from server"
  },
  data: {
    tokennotvalid: "token is valid",
    filereceived: "files received",
    filestored: "files stored",
    nofiles: "no files were uploaded",
    fileerror: "file error",
    fileerrorinfo: "please check if the 'EXAM-STUDENT' directory is writeable and has enough space",
    fileerrorinfo2: "A local backup could not be created. Please use the manual submission option.",
    dontshow: "don't show again"
  },
  editor: {
    backupfound: "Backup found",
    getmaterials: "Get materials",
    sendfinalexam: "Send final exam",
    finalsubmit: "Final submit",
    materials: "Materials:",
    localfiles: "Local files:",
    update: "Update",
    splitview: "Splitview",
    leftkiosk: "You have left the safe exam mode!",
    tellsomeone: "Please inform a teacher!",
    replacecontent1: "Do you want to replace the content of the editor with the content of ",
    replacecontent2: "?",
    cancel: "Cancel",
    replace: "Replace",
    backupnotfound: "Backup file could not be read",
    backuploaded: "Backup successfully loaded",
    backuperror: "Error loading backup file",
    error: "Error",
    success: "Success",
    chars: "chars",
    words: "words",
    reconnect: "reconnect",
    unlock: "unlock",
    exit: "Exit safe exam mode?",
    exitkiosk: "Do not leave safe exam mode without permission.",
    info: "If this process fails unlock and try again!",
    saved: "Creating backup",
    savedclip: "Creating backup and clipboard copy",
    leaving: "Leaving Exam mode",
    backup: "backup",
    undo: "undo",
    redo: "redo",
    clear: "clear",
    bold: "bold",
    italic: "italic",
    underline: "underline",
    heading1: "heading1",
    heading2: "heading2",
    heading3: "heading3",
    heading4: "heading4",
    heading5: "heading5",
    heading6: "heading6",
    subscript: "subscript",
    superscript: "superscript",
    bulletlist: "bulletlist",
    list: "list",
    codeblock: "codeblock",
    code: "code",
    blockquote: "blockquote",
    line: "pagebreak",
    left: "left",
    center: "center",
    right: "right",
    textcolor: "textcolor",
    linebreak: "linebreak",
    more: "more",
    inserttable: "inserttable",
    deletetable: "deletetable",
    columnafter: "columnafter",
    rowafter: "rowafter",
    delcolumn: "delcolumn",
    delrow: "delrow",
    mergeorsplit: "mergeorsplit",
    headercolumn: "headercolumn",
    headerrow: "headerrow",
    selected: "selected words/chars",
    requestsent: "print request sent",
    requestdenied: "print request denied",
    paste: "paste",
    copy: "copy",
    spellcheck: "spellcheck",
    spellcheckdeactivate: "deactivate spellcheck",
    reload: "Reload",
    reloadtext: "Would you like to reinitialize the Editor?",
    reloadcontent: "keep content",
    specialchar: "Insert specialcharacter",
    print: "print",
    playaudio: "Play Audio",
    reallyplay: "Do you want to play the audiofile?",
    audioremaining: "Remaining playbacks:",
    audionotallowed: "You don't have the permission to play this file!",
    insert: "Insert Image",
    insertmug: "Insert Mugshot",
    bildungsportal: "Bildungsportal",
    send: "Send work to teacher",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    close: "Close"
  },
  math: {
    exit: "Exit safe exam mode",
    filename: "Filename",
    nospecial: "Please enter only letters and numbers without special characters",
    clear: "clear content?"
  },
  general: {
    error: "Error",
    nopdf: "No valid PDF File",
    wrongpassword: "Wrong password"
  },
  website: {
    reloadwebview: "Reload webview"
  },
  pdf: {
    warningTitle: "Possibly scanned PDF",
    warningPrefix: "On",
    warningMessage: "less than 2 interactive form fields were found.",
    warningMessage2: "This indicates that this is a scanned PDF that does not contain active form fields or tables.",
    understood: "Understood",
    page: "Page",
    pages: "Pages"
  }
};

// src/locales/de.json
var de_default = {
  main: {
    tray: {
      restore: "Wiederherstellen",
      disconnect: "Verbindung trennen",
      exit: "Beenden"
    }
  },
  student: {
    password: "Passwort",
    exams: "Pr\xFCfungen",
    username: "Benutzername",
    pin: "Pincode",
    ip: "Server-Adresse",
    examname: "Pr\xFCfungsname",
    advanced: "fortgeschritten",
    simple: "einfach",
    name: "Name",
    register: "anmelden",
    registering: "melde an...",
    registered: "angemeldet",
    connected: "verbunden",
    disconnected: "Verbindung unterbrochen",
    registeredinfo: "Sie haben sich erfolgreich am Server registriert! \n\nBitte warten Sie auf die Aktivierung des Pr\xFCfungsmodus durch die Lehrperson!",
    started: "Suche gestartet",
    nopw: "Falscher Benutzername oder Pincode",
    nouser: "Benutzername fehlt",
    noip: "Serveradresse oder Pr\xFCfungsname fehlt",
    offline: "Keine Netzwerkverbindung",
    nopin: "Pincode fehlt",
    unreachable: "Server API nicht erreichbar.",
    timeout: "Timeout! Exam-Teacher befindet sich m\xF6glicherweise hinter einer Firewall.",
    noapi: "Keine Pr\xFCfungsserver an angegebener Adresse",
    bildungsportal: "Bildungsportal",
    localLockdown: "Lokal absperren",
    manualsearch: "Manuell suchen",
    noexams: "Keine Pr\xFCfungen gefunden",
    logoutBiP: "Sind Sie sicher, dass Sie sich abmelden m\xF6chten?",
    de: "Deutsch",
    en: "Englisch",
    es: "Spanisch",
    fr: "Franz\xF6sisch",
    it: "Italienisch",
    sl: "Slowenisch",
    none: "andere",
    spellcheck: "Rechtschreibhilfe",
    activate: "aktivieren",
    suggest: "Vorschl\xE4ge zeigen",
    spellcheckchoose: "Bitte w\xE4hlen Sie eine Sprache f\xFCr die Pr\xFCfung",
    lang: "Sprachen",
    math: "Mathematik",
    selectexammode: "Pr\xFCfungsmodus ausw\xE4hlen",
    outdated: "Version",
    outdatedinfo: "Bitte installieren sie die selbe Version wie am Pr\xFCfungsserver!"
  },
  control: {
    tokennotvalid: "das token ist ung\xFCltig",
    tokenvalid: "das token ist g\xFCltig",
    statechange: "Vertrauensstellung ge\xE4ndert",
    alreadyregistered: "Sch\xFCler:in unter diesem Namen bereits angemeldet",
    examinit: "Abgesicherter Modus gestartet",
    examexit: "Abgesicherter Modus beendet",
    noexam: "Abgesicherter Modus nicht aktiv",
    clientunsubscribe: "Sch\xFCler:in entfernt"
  },
  data: {
    tokennotvalid: "das token ist ung\xFCltig",
    filereceived: "Dateien erhalten",
    filestored: "Dateien gespeichert",
    nofiles: "Es wurden keine Dateien hochgeladen",
    fileerror: "Fehler beim Schreiben der Datei",
    fileerrorinfo: "Bitte stellen Sie sicher, dass das 'EXAM-STUDENT' Verzeichnis f\xFCr Next-Exam schreibbar ist und gen\xFCgend Speicherplatz vorhanden ist.",
    fileerrorinfo2: "Eine lokale Sicherung konnte nicht erstellt werden. Nutzen Sie die manuelle Abgabe um Ihre Arbeit direkt an die Lehrperson zu senden.",
    dontshow: "Nicht mehr anzeigen"
  },
  editor: {
    backupfound: "Backup gefunden",
    getmaterials: "Materialien holen",
    sendfinalexam: "Finale Abgabe an Lehrperson senden",
    finalsubmit: "Abgabe",
    materials: "Materialien:",
    update: "Aktualisieren",
    localfiles: "Lokale Dateien:",
    splitview: "Spaltenansicht",
    leftkiosk: "Sie haben den abgesicherten Modus verlassen!",
    tellsomeone: "Melden Sie sich umgehend bei der Aufsichtsperson!",
    replacecontent1: "Wollen Sie den Inhalt des Editors durch den Inhalt der Datei",
    replacecontent2: "ersetzen?",
    cancel: "Abbrechen",
    replace: "Ersetzen",
    backupnotfound: "Backup-Datei konnte nicht gelesen werden",
    backuploaded: "Backup erfolgreich geladen",
    backuperror: "Fehler beim Laden der Backup-Datei",
    error: "Fehler",
    success: "Erfolg",
    chars: "Zeichen",
    words: "W\xF6rter",
    reconnect: "neu verbinden",
    unlock: "entsperren",
    exit: "Abgesicherten Modus beenden?",
    exitkiosk: "Verlassen Sie den abgesicherten Modus nie ohne Freigabe einer Lehrperson.",
    info: "Sollte der Vorgang fehlschlagen beenden Sie bitte den abgesicherten Modus und versuchen Sie es erneut!",
    saved: "Ihre Arbeit wurde erfolgreich gesichert!",
    savedclip: "Die aktuelle Arbeit wird gesichert und in die Zwischenablage kopiert!",
    leaving: "Abgesicherter Modus beendet",
    backup: "sichern",
    undo: "r\xFCckg\xE4ngig",
    redo: "wiederholen",
    clear: "l\xF6schen",
    bold: "fett",
    italic: "kursiv",
    underline: "unterstrichen",
    heading1: "\xDCberschrift 1",
    heading2: "\xDCberschrift 2",
    heading3: "\xDCberschrift 3",
    heading4: "\xDCberschrift 4",
    heading5: "\xDCberschrift 5",
    heading6: "\xDCberschrift 6",
    subscript: "tiefgestellt",
    superscript: "hochgestellt",
    bulletlist: "ungeordnete Liste",
    list: "geordnete Liste",
    codeblock: "Codeblock",
    code: "Code",
    blockquote: "Zitat",
    line: "Seitenumbruch",
    left: "Linksb\xFCndig",
    center: "Zentriert",
    right: "Rechtsb\xFCndig",
    textcolor: "Textfarbe",
    linebreak: "Zeilenumbruch",
    more: "mehr",
    inserttable: "Tabelle einf\xFCgen",
    deletetable: "Tabelle l\xF6schen",
    columnafter: "Spalte einf\xFCgen",
    rowafter: "Reihe einf\xFCgen",
    delcolumn: "Spalte l\xF6schen",
    delrow: "Reihe l\xF6schen",
    mergeorsplit: "Vereinen oder Teilen",
    headercolumn: "Titelspalte",
    headerrow: "Titelreihe",
    selected: "W\xF6rter/Zeichen in Auswahl",
    requestsent: "Druckanfrage gesendet!",
    requestdenied: "Druckanfrage abgelehnt. Bitte warten und erneut senden.",
    paste: "einf\xFCgen",
    copy: "kopieren",
    spellcheck: "Rechtschreibpr\xFCfung aktivieren",
    spellcheckdeactivate: "Rechtschreibpr\xFCfung deaktivieren",
    reload: "Neu laden",
    reloadtext: "Wollen Sie den Texteditor neu initialisieren?",
    reloadcontent: "Inhalt beibehalten",
    specialchar: "Sonderzeichen einf\xFCgen",
    print: "drucken",
    playaudio: "Audio abspielen",
    reallyplay: "Wollen Sie das H\xF6rbeispiel jetzt abspielen?",
    audioremaining: "Verbleibende Durchl\xE4ufe:",
    audionotallowed: "Sie haben keine Berechtigung die Audiodatei erneut abzuspielen!",
    insert: "Bild einf\xFCgen",
    insertmug: "Mugshot einf\xFCgen",
    bildungsportal: "Bildungsportal",
    send: "Arbeit an Lehrperson senden",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    close: "Schlie\xDFen"
  },
  math: {
    exit: "Abgesicherten Modus beenden?",
    filename: "Dateiname",
    nospecial: "Bitte geben Sie nur Buchstaben oder Zahlen ein.",
    clear: "Alle Berechnungen l\xF6schen?"
  },
  general: {
    error: "Fehler",
    nopdf: "Keine g\xFCltige PDF Datei",
    wrongpassword: "Falsches Passwort"
  },
  website: {
    reloadwebview: "Webview neu laden"
  },
  pdf: {
    warningTitle: "M\xF6glicherweise gescanntes PDF",
    warningPrefix: "Auf",
    warningMessage: "wurden weniger als 2 interaktive Formularfelder gefunden.",
    warningMessage2: "Dies deutet darauf hin, dass es sich um ein gescanntes PDF handelt, das keine aktiven Formularfelder oder Tabellen enth\xE4lt.",
    understood: "Verstanden",
    page: "Seite",
    pages: "Seiten"
  }
};

// src/locales/locales.ts
var i18n = createI18n({
  locale: "de",
  fallbackLocale: "en",
  messages: {
    en: en_default,
    de: de_default
  }
});
var locales_default = i18n;

// src-electron/main/scripts/ipchandler.js
import { ipcMain, clipboard as clipboard2, app as app8, webContents } from "electron";
import { gateway4sync } from "default-gateway";
import os4 from "os";
import log10 from "electron-log";
import mammoth from "mammoth";

// src-electron/main/scripts/traymenu.js
import { app as app6, Tray, Menu } from "electron";
import path5 from "path";
import log7 from "electron-log";
var __dirname6 = import.meta.dirname;
var tray = null;
var iconPath = path5.join(__dirname6, "../../public/icons", "icon24x24.png");
var setLocale = (loc) => {
  const gl = locales_default.global;
  if (gl && typeof gl.locale === "object" && gl.locale) {
    if ("value" in gl.locale) gl.locale.value = loc;
    else gl.locale = loc;
  } else {
    gl.locale = loc;
  }
};
var updateSystemTray = (locale) => {
  setLocale(locale);
  const t2 = (k) => locales_default.global.t(k);
  if (!tray) {
    tray = new Tray(iconPath);
    tray.on("click", () => {
      windowhandler_default.mainwindow.isVisible() ? windowhandler_default.mainwindow.hide() : windowhandler_default.mainwindow.show();
    });
  }
  const contextMenu = Menu.buildFromTemplate([
    { label: t2("main.tray.restore"), click: () => windowhandler_default.mainwindow.show() },
    // show window
    {
      label: t2("main.tray.disconnect"),
      click: () => {
        log7.info("main @ systemtray: removing registration");
        communicationhandler_default.resetConnection();
      }
    },
    // disconnect
    {
      label: t2("main.tray.exit"),
      click: () => {
        log7.warn("main @ systemtray: Closing Next-Exam");
        log7.warn("main @ systemtray: ----------------------------------------");
        windowhandler_default.mainwindow.allowexit = true;
        app6.quit();
      }
    }
    // exit
  ]);
  tray.setToolTip("Next-Exam Student");
  tray.setContextMenu(contextMenu);
};

// src-electron/main/scripts/testpermissionsMac.js
import { exec as exec2 } from "child_process";
import { dialog as dialog2, app as app7 } from "electron";
import log8 from "electron-log";
async function testNetworkPermission(serverip, serverApiPort) {
  try {
    const res = await fetch(`https://${serverip}:${serverApiPort}/server/control/pong`, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
async function resetTCC() {
  return new Promise((resolve, reject) => {
    exec2(`tccutil reset All com.nextexam.student`, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
    exec2(`tccutil reset All com.nextexam-student.app`, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}
async function ensureNetworkOrReset(serverip, serverApiPort) {
  const ok = await testNetworkPermission(serverip, serverApiPort);
  if (ok) {
    log8.info(`testpermissionsMac @ ensureNetworkOrReset: Network access is allowed`);
    return "ok";
  }
  log8.warn(`testpermissionsMac @ ensureNetworkOrReset: No HTTP requests allowed!`);
  try {
    let choice = await dialog2.showMessageBox({
      type: "question",
      message: "Der Server ist nicht erreichbar. M\xF6chten Sie die Berechtigungen zur\xFCcksetzen und Next-Exam manuell neu starten?",
      buttons: ["OK", "Abbrechen"]
    });
    if (choice.response === 0) {
      log8.warn(`testpermissionsMac @ ensureNetworkOrReset: Resetting network permissions and quitting app`);
      await resetTCC();
      return "reset";
    } else {
      return false;
    }
  } catch (e) {
    log8.error(`testpermissionsMac @ ensureNetworkOrReset: Error resetting network permissions: ${e}`);
    await dialog2.showMessageBox({
      type: "error",
      message: "Fehler beim Zur\xFCcksetzen der Berechtigungen",
      detail: String(e.err || e)
    });
    return false;
  }
}

// src-electron/main/scripts/getwlaninfo.js
import { exec as exec3 } from "child_process";
import { promisify } from "util";
import os3 from "os";
import log9 from "electron-log";
var execAsync = promisify(exec3);
var failureCounter = 0;
var MAX_FAILURES = 3;
function dbmToQualityPercent(dbm) {
  if (dbm === null || Number.isNaN(dbm)) return null;
  const minDbm = -100;
  const maxDbm = -30;
  const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
  const percent = (clamped - minDbm) / (maxDbm - minDbm) * 100;
  return Math.round(percent);
}
async function getWlanInfo() {
  if (failureCounter >= MAX_FAILURES) {
    return { ssid: null, bssid: null, quality: null, message: "givingup" };
  }
  try {
    const platform = os3.platform();
    let result;
    switch (platform) {
      case "linux":
        result = await getWlanInfoLinux();
        break;
      case "win32":
        result = await getWlanInfoWindows();
        break;
      case "darwin":
        result = await getWlanInfoMacOS();
        break;
      default:
        failureCounter++;
        return { ssid: null, bssid: null, quality: null, message: "givingup" };
    }
    if (!result || typeof result !== "object") {
      failureCounter++;
      return { ssid: null, bssid: null, quality: null, message: "error" };
    }
    if (result.ssid || result.bssid || result.quality !== null) {
      failureCounter = 0;
    } else {
      failureCounter++;
    }
    return result;
  } catch (error) {
    failureCounter++;
    return { ssid: null, bssid: null, quality: null, message: "error" };
  }
}
async function getWlanInfoLinux() {
  try {
    try {
      let stdout = null;
      try {
        const result = await execAsync("nmcli -t -f active,ssid,bssid,signal device wifi list", {
          timeout: 4e3,
          maxBuffer: 1024 * 64
        });
        stdout = result.stdout;
      } catch (execError) {
        if (execError.stdout && execError.stdout.trim().length > 0) {
          stdout = execError.stdout;
        } else {
          throw execError;
        }
      }
      if (!stdout || stdout.trim().length === 0) {
        throw new Error("No output from nmcli");
      }
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        const parts = line.split(":");
        if ((parts[0] === "yes" || parts[0] === "ja") && parts.length >= 4) {
          const ssid = parts[1] || "";
          const bssidMatch = line.match(/[a-f0-9]{2}(?:\\:[a-f0-9]{2}){5}/i);
          let bssid = null;
          if (bssidMatch) {
            bssid = bssidMatch[0].replace(/\\:/g, ":").toUpperCase();
          } else {
            const normalMatch = line.match(/[a-f0-9]{2}(?::[a-f0-9]{2}){5}/i);
            if (normalMatch) {
              bssid = normalMatch[0].toUpperCase();
            } else {
              bssid = parts[2] || "";
            }
          }
          const signalStr = parts[parts.length - 1] ? parts[parts.length - 1].trim() : "";
          const signal = signalStr ? parseInt(signalStr, 10) || null : null;
          return {
            ssid: ssid || null,
            bssid: bssid || null,
            quality: signal,
            message: null
          };
        }
      }
    } catch (nmcliError) {
      const isRealError = nmcliError.code === "ENOENT" || nmcliError.code === "ETIMEDOUT" || nmcliError.message && !nmcliError.message.includes("No output");
      if (isRealError) {
        log9.error("getWlanInfoLinux: nmcli command failed:", nmcliError.message || nmcliError);
      }
      try {
        const { stdout: iwStdout } = await execAsync('iw dev | grep -E "^s*ssid|^s*link"', {
          timeout: 2e3,
          maxBuffer: 1024 * 64
        });
        const { stdout: iwlinkStdout } = await execAsync('iw dev | grep -A 5 "^s*link"', {
          timeout: 2e3,
          maxBuffer: 1024 * 64
        });
        const ssidMatch = iwStdout ? iwStdout.match(/ssid\s+(.+)/) : null;
        const ssid = ssidMatch ? ssidMatch[1].trim() : null;
        const bssidMatch = iwlinkStdout ? iwlinkStdout.match(/addr:\s+([a-f0-9:]{17})/i) : null;
        const bssid = bssidMatch ? bssidMatch[1].toUpperCase() : null;
        const signalMatch = iwlinkStdout ? iwlinkStdout.match(/signal:\s+(-?\d+)/) : null;
        const signalDbm = signalMatch ? parseInt(signalMatch[1], 10) || null : null;
        const quality = signalDbm !== null ? dbmToQualityPercent(signalDbm) : null;
        return {
          ssid,
          bssid,
          quality,
          message: null
        };
      } catch (iwError) {
        const isRealError2 = iwError.code === "ENOENT" || iwError.code === "ETIMEDOUT";
        if (isRealError2) {
          log9.error("getWlanInfoLinux: iw command failed:", iwError.message || iwError);
        }
        try {
          const { stdout } = await execAsync('iwconfig 2>/dev/null | grep -E "ESSID|Access Point|Signal level"', {
            timeout: 2e3,
            maxBuffer: 1024 * 64
          });
          const lines = stdout.split("\n");
          let ssid = null;
          let bssid = null;
          let signal = null;
          for (const line of lines) {
            const ssidMatch = line.match(/ESSID:"([^"]+)"/);
            if (ssidMatch) ssid = ssidMatch[1];
            const bssidMatch = line.match(/Access Point:\s+([a-f0-9:]{17})/i);
            if (bssidMatch) bssid = bssidMatch[1].toUpperCase();
            const signalMatch = line.match(/Signal level=(-?\d+)/);
            if (signalMatch) {
              const parsed = parseInt(signalMatch[1], 10);
              signal = isNaN(parsed) ? null : parsed;
            }
          }
          return {
            ssid,
            bssid,
            quality: dbmToQualityPercent(signal),
            message: null
          };
        } catch (iwconfigError) {
          const isRealError3 = iwconfigError.code === "ENOENT" || iwconfigError.code === "ETIMEDOUT";
          if (isRealError3) {
            log9.error("getWlanInfoLinux: All methods (nmcli, iw, iwconfig) failed. Last error:", iwconfigError.message || iwconfigError);
          }
        }
      }
    }
  } catch (error) {
    log9.error("getWlanInfoLinux: Unexpected error:", error.message || error);
    return {
      ssid: null,
      bssid: null,
      quality: null,
      message: "error"
    };
  }
  return {
    ssid: null,
    bssid: null,
    quality: null,
    message: "nointerface"
  };
}
async function getWlanInfoWindows() {
  try {
    const { stdout, stderr } = await execAsync("netsh wlan show interfaces", {
      timeout: 5e3,
      maxBuffer: 1024 * 64
    });
    const errorOutput = (stderr || "").toLowerCase();
    const output = (stdout || "").toLowerCase();
    const combinedOutput = output + " " + errorOutput;
    if (combinedOutput.includes("wlansvc") || combinedOutput.includes("wlan autoconfig") || combinedOutput.includes("automatisch wlan") || combinedOutput.includes("wlan-konfiguration") || combinedOutput.includes("wird nicht ausgef\xFChrt") || combinedOutput.includes("is not running") || combinedOutput.includes("service is not running") || combinedOutput.includes("der dienst") && combinedOutput.includes("wird nicht ausgef\xFChrt")) {
      return { ssid: null, bssid: null, quality: null, message: "nointerface" };
    }
    if (combinedOutput.includes("standortberechtigungen") || combinedOutput.includes("standort") && (combinedOutput.includes("ben\xF6tigen") || combinedOutput.includes("ben\xF6tigt")) || combinedOutput.includes("location permissions") || combinedOutput.includes("location") && combinedOutput.includes("required") || combinedOutput.includes("positionsdienste") || combinedOutput.includes("datenschutz") && combinedOutput.includes("standort") || combinedOutput.includes("privacy") && combinedOutput.includes("location") || combinedOutput.includes("netzwerkshellbefehle") && combinedOutput.includes("standort")) {
      return await getWlanInfoWindowsPowerShell();
    }
    if (!stdout || stdout.trim().length === 0) {
      return { ssid: null, bssid: null, quality: null, message: "nointerface" };
    }
    if (stdout.includes("There is no wireless interface") || stdout.includes("Es gibt keine Drahtlos-Schnittstelle") || stdout.match(/No wireless/i)) {
      return { ssid: null, bssid: null, quality: null, message: "nointerface" };
    }
    const lines = stdout.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    let ssid = null;
    let bssid = null;
    let signal = null;
    for (const line of lines) {
      if (line.match(/(?<!B)SSID\s*:/i)) {
        const match = line.match(/(?<!B)SSID\s*:\s*(.+)/i);
        if (match) {
          const extracted = match[1].trim();
          if (extracted && extracted.length > 0 && !extracted.match(/^(N\/A|n\/a|none|keine)$/i)) {
            ssid = extracted;
          }
        }
      } else if (line.match(/BSSID\s*:/i)) {
        const match = line.match(/BSSID\s*:\s*([a-f0-9]{2}(?:[-:\s][a-f0-9]{2}){5})/i);
        if (match) {
          bssid = match[1].replace(/[- ]/g, ":").toUpperCase();
        }
      } else if (line.match(/Signal|Signalstärke|Intensité|Señal/i)) {
        let match = line.match(/:\s*(\d+)\s*%/i);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            signal = parsed;
          }
        } else {
          match = line.match(/:\s*(-?\d+)\s*dBm/i);
          if (match) {
            const dbm = parseInt(match[1], 10);
            if (!isNaN(dbm)) {
              signal = dbmToQualityPercent(dbm);
            }
          }
        }
      }
    }
    return {
      ssid: ssid && ssid.length > 0 ? ssid : null,
      bssid: bssid && bssid.length > 0 ? bssid : null,
      quality: signal,
      message: null
    };
  } catch (error) {
    const errorMessage = (error.message || "").toLowerCase();
    const errorStdout = (error.stdout || "").toLowerCase();
    const errorStderr = (error.stderr || "").toLowerCase();
    const combinedErrorOutput = errorMessage + " " + errorStdout + " " + errorStderr;
    if (combinedErrorOutput.includes("standortberechtigungen") || combinedErrorOutput.includes("standort") && (combinedErrorOutput.includes("ben\xF6tigen") || combinedErrorOutput.includes("ben\xF6tigt")) || combinedErrorOutput.includes("location permissions") || combinedErrorOutput.includes("location") && combinedErrorOutput.includes("required") || combinedErrorOutput.includes("positionsdienste") || combinedErrorOutput.includes("datenschutz") && combinedErrorOutput.includes("standort") || combinedErrorOutput.includes("privacy") && combinedErrorOutput.includes("location") || combinedErrorOutput.includes("netzwerkshellbefehle") && combinedErrorOutput.includes("standort")) {
      return await getWlanInfoWindowsPowerShell();
    }
    log9.error("getWlanInfoWindows: Error executing netsh command:", error.message || error);
    return { ssid: null, bssid: null, quality: null, message: "error" };
  }
}
async function getWlanInfoWindowsPowerShell() {
  try {
    let ssid = null;
    try {
      const { stdout: ssidOutput } = await execAsync(`powershell -Command "$profile = Get-NetConnectionProfile | Where-Object {$_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*'} | Select-Object -First 1; if ($profile) { $profile.Name }"`, {
        timeout: 3e3,
        maxBuffer: 1024 * 64
      });
      const ssidStr = ssidOutput.trim();
      if (ssidStr && ssidStr.length > 0 && !ssidStr.match(/^(N\/A|n\/a|none|keine)$/i)) {
        ssid = ssidStr;
      }
    } catch (ssidError) {
    }
    const bssid = null;
    return {
      ssid: ssid || null,
      bssid: bssid || null,
      quality: null,
      message: "nopermissions"
    };
  } catch (error) {
    log9.error("getWlanInfoWindowsPowerShell: PowerShell fallback failed:", error.message || error);
    return { ssid: null, bssid: null, quality: null, message: "error" };
  }
}
async function getWlanInfoMacOS() {
  try {
    try {
      const { stdout: airportPath } = await execAsync("which airport 2>/dev/null || echo /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", {
        timeout: 1e3,
        maxBuffer: 1024 * 64
      });
      const airport = airportPath.trim();
      const { stdout } = await execAsync(`${airport} -I`, {
        timeout: 2e3,
        maxBuffer: 1024 * 64
      });
      const lines = stdout.split("\n").map((line) => line.trim());
      let ssid = null;
      let bssid = null;
      let rssiDbm = null;
      let signalPercent = null;
      for (const line of lines) {
        if (line.startsWith("SSID:")) {
          ssid = line.replace("SSID:", "").trim();
        } else if (line.startsWith("BSSID:")) {
          const bssidMatch = line.match(/BSSID:\s*([a-f0-9]{2}(?::[a-f0-9]{2}){5})/i);
          bssid = bssidMatch ? bssidMatch[1].toUpperCase() : null;
        } else if (line.startsWith("agrCtlRSSI:")) {
          const rssiStr = line.replace("agrCtlRSSI:", "").trim();
          const rssi = rssiStr ? parseInt(rssiStr, 10) || null : null;
          rssiDbm = rssi;
        } else if (line.startsWith("link auth:")) {
          const signalMatch = line.match(/(\d+)%/);
          if (signalMatch && signalPercent === null) {
            const parsed = parseInt(signalMatch[1], 10);
            signalPercent = isNaN(parsed) ? null : parsed;
          }
        }
      }
      let quality = null;
      if (signalPercent !== null) {
        quality = signalPercent;
      } else if (rssiDbm !== null) {
        quality = dbmToQualityPercent(rssiDbm);
      }
      if (ssid || bssid || quality !== null) {
        return {
          ssid: ssid || null,
          bssid: bssid || null,
          quality,
          message: null
        };
      }
    } catch (airportError) {
      if (airportError.code !== "ENOENT" && airportError.message && !airportError.message.includes("permission")) {
        log9.error("getWlanInfoMacOS: airport command failed:", airportError.message || airportError);
      }
    }
    try {
      const { stdout: interfaceOutput } = await execAsync("networksetup -listallhardwareports | awk '/Wi-Fi|AirPort/{getline; print $NF}'", {
        timeout: 2e3,
        maxBuffer: 1024 * 64
      });
      const interfaceName = interfaceOutput.trim();
      if (!interfaceName) {
        return { ssid: null, bssid: null, quality: null, message: "nointerface" };
      }
      let ssid = null;
      try {
        const { stdout: ssidOutput } = await execAsync(`ipconfig getsummary "${interfaceName}" | awk -F' SSID : ' '/ SSID : / {print $2}'`, {
          timeout: 2e3,
          maxBuffer: 1024 * 64
        });
        ssid = ssidOutput.trim() || null;
      } catch (ssidError) {
      }
      let bssid = null;
      try {
        const { stdout: bssidOutput } = await execAsync(`ipconfig getsummary "${interfaceName}" | grep 'BSSID :' | awk '{print $3}'`, {
          timeout: 2e3,
          maxBuffer: 1024 * 64
        });
        const bssidStr = bssidOutput.trim();
        if (bssidStr && /^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/i.test(bssidStr)) {
          bssid = bssidStr.toUpperCase();
        }
      } catch (bssidError) {
      }
      return {
        ssid: ssid || null,
        bssid: bssid || null,
        quality: null,
        message: null
      };
    } catch (networksetupError) {
      log9.error("getWlanInfoMacOS: networksetup/ipconfig fallback failed:", networksetupError.message || networksetupError);
      return { ssid: null, bssid: null, quality: null, message: "error" };
    }
  } catch (error) {
    log9.error("getWlanInfoMacOS: Unexpected error:", error.message || error);
    return { ssid: null, bssid: null, quality: null, message: "error" };
  }
  return { ssid: null, bssid: null, quality: null, message: "nointerface" };
}

// src-electron/main/scripts/ipchandler.js
var { t } = locales_default.global;
var __dirname7 = import.meta.dirname;
var checkPortOpen = (port, host = "127.0.0.1", timeout = 1500) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (running, error = null) => {
      socket.destroy();
      resolve({ running, port, host, error });
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (err) => finish(false, err.message));
    try {
      socket.connect(port, host);
    } catch (err) {
      finish(false, err.message);
    }
  });
};
var IpcHandler = class {
  constructor() {
    this.multicastClient = null;
    this.config = null;
    this.WindowHandler = null;
    this.isPrintingPdf = false;
  }
  init(mc, config2, wh, ch) {
    this.multicastClient = mc;
    this.config = config2;
    this.WindowHandler = wh;
    this.CommunicationHandler = ch;
    ipcMain.on("set-new-locale", (event, locale) => {
      log10.info(`ipchandler @ set-new-locale: setting new locale to ${locale}`);
      locales_default.locale = locale;
      updateSystemTray(locales_default.locale);
    });
    ipcMain.handle("getExamMaterials", async (event) => {
      let clientinfo = this.multicastClient.clientinfo;
      let servername = clientinfo.servername;
      let serverip = clientinfo.serverip;
      let token = clientinfo.token;
      let payload = {
        group: clientinfo.group
      };
      let examMaterials = false;
      if (this.multicastClient.clientinfo.localLockdown) {
        return false;
      } else {
        examMaterials = await fetch(`https://${serverip}:${this.config.serverApiPort}/server/data/getexammaterials/${servername}/${token}`, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }
        }).then((response) => response.json()).then((data) => {
          return data;
        }).catch((err) => log10.error(`ipchandler @ getExamMaterials: ${err}`));
        return examMaterials;
      }
    });
    ipcMain.handle("start-blocking-for-webview", (event, { guestId, allowedUrls }) => {
      const guest = webContents.fromId(Number(guestId));
      if (!guest || guest.isDestroyed?.()) return false;
      guest.removeAllListeners("will-navigate");
      const allow = allowedUrls.map((s) => String(s).toLowerCase());
      guest.setWindowOpenHandler(({ url }) => {
        const urlStr = String(url || "").toLowerCase();
        if (allow.some((u) => urlStr.includes(u))) {
          guest.loadURL(url);
          log10.warn("ipchandler @ start-blocking-for-webview: allowed navigation to", url);
        } else return { action: "deny" };
      });
      guest.on("will-navigate", (e, url) => {
        const urlStr = String(url || "").toLowerCase();
        if (!allow.some((u) => urlStr.includes(u))) {
          e.preventDefault();
          log10.warn("ipchandler @ start-blocking-for-webview: blocked navigation to", url);
        }
      });
      return true;
    });
    const checkCommonExceptions = (targetUrl) => {
      if (targetUrl.includes("login") && targetUrl.includes("Microsoft")) return true;
      if (targetUrl.includes("login") && targetUrl.includes("Google")) return true;
      if (targetUrl.includes("accounts") && targetUrl.includes("google.com")) return true;
      if (targetUrl.includes("mysignins") && targetUrl.includes("microsoft")) return true;
      if (targetUrl.includes("account") && targetUrl.includes("windowsazure")) return true;
      if (targetUrl.includes("login") && targetUrl.includes("microsoftonline")) return true;
      if (targetUrl.includes("lookup") && targetUrl.includes("google")) return true;
      if (targetUrl.includes("bildung.gv.at") && targetUrl.includes("SAML2")) return true;
      if (targetUrl.includes("Shibboleth") && targetUrl.includes("SAML2")) return true;
      if (targetUrl.includes("id-austria.gv.at") && targetUrl.includes("authHandler")) return true;
      if (targetUrl.includes("eu-mobile.events.data") && targetUrl.includes("microsoft")) return true;
      if (targetUrl.includes("gstatic.com")) return true;
      if (targetUrl.includes("aadcdn") && targetUrl.includes("microsoftonline")) return true;
      if (targetUrl.includes("login") && targetUrl.includes("live.com")) return true;
      if (targetUrl.includes("login") && targetUrl.includes("msftauth.net")) return true;
      if (targetUrl.includes("aadcdn") && targetUrl.includes("msftauth.net")) return true;
      return false;
    };
    ipcMain.handle("start-blocking-for-website-webview", (event, { guestId, mode, allowedDomain, baseUrl, moodleTestId, moodleDomain, gformsTestId }) => {
      const guest = webContents.fromId(Number(guestId));
      if (!guest || guest.isDestroyed?.()) return false;
      guest.removeAllListeners("will-navigate");
      const isUrlAllowed = (targetUrl) => {
        if (mode === "website") {
          if (!targetUrl || targetUrl.includes(baseUrl)) return true;
          try {
            const urlObj = new URL(targetUrl);
            const domain = urlObj.hostname;
            if (domain === allowedDomain) return true;
            if (domain.endsWith("." + allowedDomain)) {
              const prefix = domain.slice(0, -(allowedDomain.length + 1));
              if (prefix && !prefix.includes(".") && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(prefix)) {
                return true;
              }
            }
          } catch (error) {
            return false;
          }
        } else if (mode === "eduvidual") {
          if (targetUrl.includes(moodleTestId)) {
            return true;
          }
          if (targetUrl.includes("startattempt.php") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("processattempt.php") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("logout") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("login") && targetUrl.includes("eduvidual")) {
            return true;
          }
          if (targetUrl.includes("login") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("policy") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("auth") && targetUrl.includes(moodleDomain)) {
            return true;
          }
          if (targetUrl.includes("SAML2") && targetUrl.includes("portal.tirol.gv.at")) {
            return true;
          }
          if (targetUrl.includes("login") && targetUrl.includes("portal.tirol.gv.at")) {
            return true;
          }
          if (targetUrl.includes("login") && targetUrl.includes("tirol.gv.at")) {
            return true;
          }
        } else if (mode === "forms") {
          if (targetUrl.includes(gformsTestId)) {
            return true;
          }
          if (targetUrl.includes("docs.google.com") && targetUrl.includes("formResponse")) {
            return true;
          }
          if (targetUrl.includes("docs.google.com") && targetUrl.includes("viewscore")) {
            return true;
          }
        } else if (mode === "rdp") {
          return true;
        }
        return checkCommonExceptions(targetUrl);
      };
      guest.setWindowOpenHandler(({ url }) => {
        if (isUrlAllowed(url)) {
          log10.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed window.open to`, url);
          guest.loadURL(url);
          return { action: "deny" };
        } else {
          log10.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked window.open to`, url);
          return { action: "deny" };
        }
      });
      guest.on("will-navigate", (e, url) => {
        if (!isUrlAllowed(url)) {
          log10.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked navigation to`, url);
          e.preventDefault();
          guest.stop();
        } else {
          log10.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed navigation to`, url);
        }
      });
      return true;
    });
    ipcMain.handle("start-blocking-for-eduvidual-webview", (event, { guestId, moodleTestId, moodleDomain }) => {
      const unifiedHandler = ipcMain.listeners("start-blocking-for-website-webview")[0];
      if (unifiedHandler) {
        return unifiedHandler(event, { guestId, mode: "eduvidual", moodleTestId, moodleDomain });
      }
      return false;
    });
    ipcMain.handle("reload-browser-view", (event, url) => {
      const browserView = this.WindowHandler.examwindow.getBrowserView(0);
      browserView.webContents.loadURL(url);
    });
    ipcMain.handle("startLanguageTool", (event) => {
      try {
        lt_server_default.startServer();
      } catch (err) {
        return false;
      }
      return true;
    });
    ipcMain.on("startLanguageTool", (event) => {
      try {
        lt_server_default.startServer();
      } catch (err) {
        return false;
      }
      return true;
    });
    ipcMain.handle("isLanguageToolRunning", async () => {
      const port = lt_server_default.port || 8088;
      const hosts = ["127.0.0.1", "::1", "localhost"];
      const results = await Promise.all(hosts.map((host) => checkPortOpen(port, host, 2500)));
      const successResult = results.find((result) => result.running);
      return successResult || results[results.length - 1];
    });
    ipcMain.on("locallockdown", (event, args) => {
      log10.info("ipchandler @ locallockdown: locking down client without teacher connection");
      let serverstatus = {
        exammode: true,
        delfolderonexit: false,
        spellcheck: true,
        spellchecklang: "de-DE",
        suggestions: false,
        moodleTestType: "",
        moodleDomain: "",
        screenshotinterval: 0,
        msOfficeFile: false,
        screenslocked: false,
        pin: "0000",
        unlockonexit: false,
        fontfamily: "sans-serif",
        moodleTestId: "",
        languagetool: false,
        password: args.password,
        useExamSections: false,
        //if false exam section 1 is used and no tabs are displayed
        activeSection: 1,
        lockedSection: 1,
        examSections: {
          1: {
            examtype: args.exammode,
            cmargin: { side: "right", size: 3 },
            linespacing: "2",
            audioRepeat: 3,
            languagetool: args.languagetool || false,
            spellchecklang: args.spellchecklang || "de-DE",
            suggestions: args.suggestions || false
          }
        }
      };
      this.multicastClient.clientinfo.name = args.clientname;
      this.multicastClient.clientinfo.serverip = "127.0.0.1";
      this.multicastClient.clientinfo.servername = "localhost";
      this.multicastClient.clientinfo.pin = "0000";
      this.multicastClient.clientinfo.token = "0000";
      this.multicastClient.clientinfo.group = "a";
      this.multicastClient.clientinfo.localLockdown = true;
      this.CommunicationHandler.startExam(serverstatus);
      event.returnValue = "hello from locallockdown";
    });
    ipcMain.on("loginBiP", (event, biptest) => {
      log10.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest);
      this.WindowHandler.createBiPLoginWin(biptest);
      event.returnValue = "hello from bip logon";
    });
    ipcMain.on("virtualized", () => {
      this.multicastClient.clientinfo.virtualized = true;
    });
    ipcMain.handle("focuslost", (event, ctrlalt = false) => {
      let answer = false;
      if (this.config.development || !this.multicastClient.exammode) {
        answer = { sender: "client", focus: true };
      } else if (this.WindowHandler.screenlockwindows.length > 0) {
        answer = { sender: "client", focus: true };
      } else if (this.WindowHandler.focusTargetAllowed && ctrlalt == false) {
        log10.warn(`ipchandler @ focuslost: mouseleave event was triggered but target is allowed`);
        answer = { sender: "client", focus: true };
      } else {
        this.WindowHandler.examwindow.moveTop();
        this.WindowHandler.examwindow.setKiosk(true);
        this.WindowHandler.examwindow.show();
        this.WindowHandler.examwindow.focus();
        this.multicastClient.clientinfo.focus = false;
        answer = { sender: "client", focus: false };
      }
      return answer;
    });
    ipcMain.on("getconfig", (event) => {
      event.returnValue = this.config;
    });
    ipcMain.on("gracefullyexit", () => {
      log10.info(`ipchandler @ gracefullyexit: gracefully leaving locked exam mode`);
      this.CommunicationHandler.gracefullyEndExam();
      this.CommunicationHandler.resetConnection();
    });
    ipcMain.on("restrictions", () => {
      disableRestrictions(this.WindowHandler.examwindow);
    });
    ipcMain.on("clipboard", (event, text) => {
      clipboard2.writeText(text);
    });
    ipcMain.handle("checkhostip", async (event) => {
      let address = false;
      try {
        address = this.multicastClient.client.address();
      } catch (e) {
        log10.error("ipcHandler @ checkhostip: multicastclient not running");
      }
      if (address) {
        return this.config.hostip;
      }
      try {
        const { gateway, interface: iface } = await new Promise((resolve, reject) => {
          try {
            const res = gateway4sync();
            resolve(res);
          } catch (err) {
            reject(err);
          }
        });
        this.config.hostip = ip.address(iface);
        this.config.gateway = true;
      } catch (e) {
        this.config.hostip = false;
        this.config.gateway = false;
      }
      if (!this.config.hostip) {
        try {
          this.config.hostip = ip.address();
        } catch (e) {
          log10.error("ipcHandler @ checkhostip: Unable to determine ip address", e);
          this.config.hostip = false;
          this.config.gateway = false;
        }
      }
      if (this.config.hostip === "127.0.0.1") {
        this.config.hostip = false;
      }
      if (this.config.hostip && !address) {
        try {
          await this.multicastClient.init(this.config.gateway);
        } catch (err) {
          log10.error("ipcHandler @ checkhostip: Error initializing multicast client", err);
        }
      }
      return this.config.hostip;
    });
    ipcMain.on("storeHTML", (event, args) => {
      const htmlContent = args.editorcontent;
      const filename = args.filename;
      let htmlfilename = `${this.multicastClient.clientinfo.name}.bak`;
      if (filename) {
        htmlfilename = `${filename}.bak`;
        log10.info(`ipchandler: storeHTML: creating manual backup as ${htmlfilename}`);
      }
      const htmlfile = path6.join(this.config.examdirectory, htmlfilename);
      if (htmlContent) {
        try {
          fs3.writeFile(htmlfile, htmlContent, (err) => {
            if (err) {
              log10.error(`ipchandler @ storeHTML: ${err.message}`);
              let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`;
              log10.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath);
              fs3.writeFile(alternatepath, htmlContent, function(err2) {
                if (err2) {
                  log10.error(err2.message);
                  log10.error("ipchandler @ storeHTML: giving up");
                  event.reply("fileerror", { sender: "client", message: err2, status: "error" });
                } else {
                  log10.info("ipchandler @ storeHTML: success!");
                  event.reply("loadfilelist");
                }
              });
            }
            event.reply("loadfilelist");
          });
        } catch (err) {
          log10.error(err);
          event.returnValue = { sender: "client", message: err, status: "error" };
        }
      }
    });
    ipcMain.handle("getPDFbase64", async (event, args) => {
      log10.info("ipchandler @ getPDFbase64: getting base64 encoded pdf");
      this.multicastClient.clientinfo.submissionnumber = args.submissionnumber + 1;
      let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground);
      return result;
    });
    ipcMain.on("printpdf", (event, args) => {
      if (!this.multicastClient?.clientinfo?.exammode) {
        log10.warn("ipchandler @ printpdf: exammode is false - skipping print");
        return;
      }
      if (this.isPrintingPdf) {
        log10.warn("ipchandler @ printpdf: print already in progress - skipping new request");
        return;
      }
      if (this.WindowHandler.examwindow) {
        const options = {
          // define print options
          margins: { top: 0.5, right: 0, bottom: 0.5, left: 0 },
          pageSize: "A4",
          printBackground: false,
          printSelectionOnly: false,
          landscape: args.landscape,
          displayHeaderFooter: true,
          footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
          headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${args.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:right;">${args.clientname}</span></div>`,
          preferCSSPageSize: false
        };
        let pdffilename = `${this.multicastClient.clientinfo.name}.pdf`;
        if (args.filename) {
          pdffilename = `${args.filename}.pdf`;
          log10.info(`ipchandler @ printpdf: creating manual backup as ${pdffilename}`);
        }
        const pdffilepath = path6.join(this.config.examdirectory, pdffilename);
        const alternatefilename = `${pdffilename}-aux.pdf`;
        const alternatebackupfilename = `${pdffilename}-old.pdf`;
        const alternatepath = path6.join(this.config.examdirectory, alternatefilename);
        try {
          const files = fs3.readdirSync(this.config.examdirectory);
          files.forEach((file) => {
            if (file === alternatefilename) {
              const newPath = path6.join(this.config.examdirectory, alternatebackupfilename);
              fs3.renameSync(alternatepath, newPath);
            }
          });
        } catch (err) {
          log10.error(`ipchandler @ printpdf: ${err.message}`);
        }
        const examWindow = this.WindowHandler.examwindow;
        const webContents3 = examWindow?.webContents;
        if (!webContents3) {
          log10.error("ipchandler @ printpdf: no webContents found for examwindow");
          event.reply("fileerror", { sender: "client", message: "no webContents found for examwindow", status: "error" });
          return;
        }
        this.isPrintingPdf = true;
        webContents3.printToPDF(options).then((data) => {
          try {
            if (fs3.existsSync(pdffilepath)) {
              fs3.unlinkSync(pdffilepath);
            }
          } catch (err) {
            log10.error(`ipchandler @ printpdf: ${err.message}`);
          }
          fs3.writeFile(pdffilepath, data, (err) => {
            if (err) {
              log10.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `);
              try {
                if (fs3.existsSync(alternatepath)) {
                  fs3.unlinkSync(alternatepath);
                }
              } catch (err2) {
                log10.error(`ipchandler @ printpdf (alternativer Pfad): ${err2.message}`);
              }
              fs3.writeFile(alternatepath, data, (err2) => {
                if (err2) {
                  log10.error(err2.message);
                  log10.error("ipchandler @ printpdf: giving up");
                  event.reply("fileerror", { sender: "client", message: err2.message, status: "error" });
                } else {
                  if (args.reason === "teacherrequest") {
                    this.CommunicationHandler.sendToTeacher();
                  }
                  event.reply("loadfilelist");
                }
              });
            } else {
              if (args.reason === "teacherrequest") {
                this.CommunicationHandler.sendToTeacher();
              }
              event.reply("loadfilelist");
            }
          });
        }).catch((error) => {
          log10.error(`ipchandler @ printpdf: ${error.message}`);
          event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
        }).finally(() => {
          this.isPrintingPdf = false;
        });
      }
    });
    ipcMain.on("saveActivesheetsBak", (event, args) => {
      try {
        const bakFilename = args.filename ? `${args.filename}.bak` : `${this.multicastClient.clientinfo.name}.bak`;
        const bakFilePath = path6.join(this.config.examdirectory, bakFilename);
        const jsonData = JSON.stringify(args.formData, null, 2);
        fs3.writeFileSync(bakFilePath, jsonData, "utf8");
        log10.info(`ipchandler @ saveActivesheetsBak: saved form data to ${bakFilename}`);
      } catch (error) {
        log10.error(`ipchandler @ saveActivesheetsBak: ${error.message}`);
        event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
      }
    });
    ipcMain.handle("getinfoasync", async (event) => {
      let serverstatus = false;
      if (this.WindowHandler.examwindow) {
        serverstatus = this.WindowHandler.examwindow.serverstatus;
      }
      if (!this.multicastClient.clientinfo.exammode) {
        const workdir = path6.join(config2.examdirectory, "/");
        try {
          await fs3.promises.mkdir(workdir, { recursive: true });
          const filelist = (await fs3.promises.readdir(workdir, { withFileTypes: true })).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
          this.multicastClient.clientinfo.numberOfFiles = filelist.length;
        } catch (err) {
          this.multicastClient.clientinfo.numberOfFiles = 0;
        }
      }
      return {
        serverlist: this.multicastClient.examServerList,
        clientinfo: this.multicastClient.clientinfo,
        serverstatus
      };
    });
    ipcMain.on("collapse-browserview", (event) => {
      const mainWindow = this.WindowHandler.examwindow;
      if (!mainWindow) {
        return;
      }
      const contentView = mainWindow.getBrowserView(0);
      contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    });
    ipcMain.on("restore-browserview", (event) => {
      const mainWindow = this.WindowHandler.examwindow;
      if (!mainWindow) {
        return;
      }
      const menuHeight = mainWindow.menuHeight;
      const newBounds = mainWindow.getBounds();
      const contentView = mainWindow.getBrowserView(0);
      contentView.setBounds({
        x: 0,
        y: menuHeight,
        width: newBounds.width,
        // full width of the mainWindow
        height: newBounds.height - menuHeight
        // remaining height after the menu
      });
    });
    ipcMain.on("update-menu-height", (event, height) => {
      const mainWindow = this.WindowHandler.examwindow;
      if (mainWindow && height > 0) {
        mainWindow.menuHeight = height;
        const newBounds = mainWindow.getBounds();
        const contentView = mainWindow.getBrowserView(0);
        if (contentView) {
          contentView.setBounds({
            x: 0,
            y: height,
            width: newBounds.width,
            height: newBounds.height - height
          });
        }
      }
    });
    ipcMain.on("register", (event, args) => {
      const clientname = args.clientname;
      const pin = args.pin;
      const serverip = args.serverip;
      const servername = args.servername;
      const clientip = ip.address();
      const hostname = os4.hostname();
      const version = this.config.version;
      const bipuserID = args.bipuserID;
      if (this.multicastClient.clientinfo.token) {
        event.returnValue = { sender: "client", message: t("control.alreadyregistered"), status: "error" };
      }
      const url = `https://${serverip}:${this.config.serverApiPort}/server/control/registerclient/${servername}/${pin}/${clientname}/${clientip}/${hostname}/${version}/${bipuserID}`;
      const signal = AbortSignal.timeout(8e3);
      fetch(url, { method: "GET", signal }).then((response) => response.json()).then((data) => {
        if (data && data.status == "success") {
          this.multicastClient.clientinfo.name = clientname;
          this.multicastClient.clientinfo.serverip = serverip;
          this.multicastClient.clientinfo.servername = servername;
          this.multicastClient.clientinfo.ip = clientip;
          this.multicastClient.clientinfo.hostname = hostname;
          this.multicastClient.clientinfo.token = data.token;
          this.multicastClient.clientinfo.focus = true;
          this.multicastClient.clientinfo.pin = pin;
          log10.info(`ipchandler @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
          event.returnValue = data;
          let uniqueexamName = `${servername}-${pin}`;
          config2.examdirectory = path6.join(config2.workdirectory, uniqueexamName);
          if (!fs3.existsSync(config2.examdirectory)) {
            fs3.mkdirSync(config2.examdirectory, { recursive: true });
          }
        } else {
          if (data.version) {
            const comparisonResult = this.compareSoftware(config2.version, config2.info, data.version, data.versioninfo);
            if (comparisonResult > 0) {
              event.returnValue = { status: "error", message: "Ihre Version von Next-Exam ist neuer als die der Lehrperson!" };
            } else if (comparisonResult < 0) {
              event.returnValue = { status: "error", message: "Ihre Version von Next-Exam ist zu alt. Laden sie sich eine aktuelle Version herunter!" };
            } else {
              event.returnValue = { status: "error", message: "Unbekannter Fehler beim Verbindungsaufbau." };
            }
          }
          event.returnValue = { status: "error", message: data.message };
        }
      }).catch(async (error) => {
        let errorMessage = error.message;
        if (error.name === "AbortError") {
          errorMessage = "The request timed out";
        }
        log10.error(`ipchandler @ register: ${errorMessage}`);
        if (process.platform === "darwin") {
          let response = await ensureNetworkOrReset(serverip, this.config.serverApiPort);
          if (response && response === "reset") {
            app8.quit();
            return;
          }
        }
        event.returnValue = { sender: "client", message: "Es gibt ein Problem mit dem Netzwerk, den Firewallregeln oder den Netzwerkberechtigungen! Bitte beheben sie dieses Problem und starten Sie Next-Exam neu!", status: "error" };
        return;
      });
    });
    ipcMain.handle("saveGGB", (event, args) => {
      const content = args.content;
      const filename = args.filename;
      const reason = args.reason;
      const ggbFilePath = path6.join(this.config.examdirectory, filename);
      if (content) {
        const fileData = Buffer.from(content, "base64");
        try {
          fs3.writeFileSync(ggbFilePath, fileData);
          if (reason === "teacherrequest") {
            this.CommunicationHandler.sendToTeacher();
          }
          return { sender: "client", message: t("data.filestored"), status: "success" };
        } catch (err) {
          this.WindowHandler.examwindow.webContents.send("fileerror", err);
          log10.error(`ipchandler @ saveGGB: ${err}`);
          return { sender: "client", message: err, status: "error" };
        }
      }
    });
    ipcMain.handle("loadGGB", (event, filename) => {
      const ggbFilePath = path6.join(this.config.examdirectory, filename);
      try {
        const fileData = fs3.readFileSync(ggbFilePath);
        const base64GgbFile = fileData.toString("base64");
        return { sender: "client", content: base64GgbFile, status: "success" };
      } catch (error) {
        return { sender: "client", content: false, status: "error" };
      }
    });
    ipcMain.handle("getpdfasync", (event, filename, image = false) => {
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path6.join(workdir, filename);
        try {
          let data = fs3.readFileSync(filepath);
          if (image) {
            return data.toString("base64");
          }
          return data;
        } catch (error) {
          return { sender: "client", content: false, status: "error" };
        }
      }
    });
    ipcMain.handle("getAudioFile", async (event, filename, publicdir = false) => {
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename && !publicdir) {
        let filepath = path6.join(workdir, filename);
        const audioData = fs3.readFileSync(filepath);
        return audioData.toString("base64");
      }
      if (filename && publicdir) {
        let filepath = path6.join(__dirname7, "../../public", filename);
        const audioData = fs3.readFileSync(filepath);
        return audioData.toString("base64");
      }
      return false;
    });
    ipcMain.handle("getfilesasync", async (event, filename, audio = false, docx = false) => {
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path6.join(workdir, filename);
        if (audio == true) {
          const audioData = fs3.readFileSync(filepath);
          return audioData.toString("base64");
        } else if (docx) {
          let result = await mammoth.convertToHtml({ path: filepath }).then((data) => {
            return data;
          }).catch(function(error) {
            console.error(error);
          });
          return result;
        } else {
          try {
            let data = fs3.readFileSync(filepath, "utf8");
            return data;
          } catch (err) {
            log10.error(`ipchandler @ getfilesasync: ${err}`);
            return false;
          }
        }
      } else {
        try {
          if (!fs3.existsSync(workdir)) {
            fs3.mkdirSync(workdir, { recursive: true });
          }
          let filelist = fs3.readdirSync(workdir, { withFileTypes: true }).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
          let files = [];
          filelist.forEach((file) => {
            let modified = fs3.statSync(path6.join(workdir, file)).mtime;
            let mod = modified.getTime();
            if (path6.extname(file).toLowerCase() === ".pdf") {
              files.push({ name: file, type: "pdf", mod });
            } else if (path6.extname(file).toLowerCase() === ".bak") {
              files.push({ name: file, type: "bak", mod });
            } else if (path6.extname(file).toLowerCase() === ".docx") {
              files.push({ name: file, type: "docx", mod });
            } else if (path6.extname(file).toLowerCase() === ".ggb") {
              files.push({ name: file, type: "ggb", mod });
            } else if (path6.extname(file).toLowerCase() === ".mp3" || path6.extname(file).toLowerCase() === ".ogg" || path6.extname(file).toLowerCase() === ".wav") {
              files.push({ name: file, type: "audio", mod });
            } else if (path6.extname(file).toLowerCase() === ".jpg" || path6.extname(file).toLowerCase() === ".png" || path6.extname(file).toLowerCase() === ".gif") {
              files.push({ name: file, type: "image", mod });
            }
          });
          this.multicastClient.clientinfo.numberOfFiles = filelist.length;
          return files;
        } catch (err) {
          log10.error(`ipchandler @ getfilesasync: ${err}`);
          return false;
        }
      }
    });
    ipcMain.handle("getbackupfile", async (event, filename) => {
      log10.info(`ipchandler @ getbackupfile: Request received for filename: ${filename}`);
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path6.join(workdir, filename);
        log10.info(`ipchandler @ getbackupfile: Full file path: ${filepath}`);
        try {
          if (!fs3.existsSync(filepath)) {
            log10.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`);
            return false;
          }
          log10.info(`ipchandler @ getbackupfile: backup file exists, reading content`);
          let data = fs3.readFileSync(filepath, "utf8");
          log10.info(`ipchandler @ getbackupfile: Successfully read backup file, content length: ${data.length}`);
          return data;
        } catch (err) {
          log10.error(`ipchandler @ getbackupfile: Error reading backup file: ${err}`);
          log10.error(`ipchandler @ getbackupfile: Error stack: ${err.stack}`);
          return false;
        }
      } else {
        log10.warn(`ipchandler @ getbackupfile: no filename provided`);
        return false;
      }
    });
    ipcMain.on("reload-url", (event) => {
      this.WindowHandler.createEasterWin();
    });
    ipcMain.on("sendPrintRequest", (event) => {
      this.multicastClient.clientinfo.printrequest = true;
      event.returnValue = true;
    });
    ipcMain.on("get-cpu-info", (event) => {
      event.returnValue = this.isVirtualMachine();
    });
    ipcMain.handle("get-wlan-info", async (event) => {
      const wlanInfo = await getWlanInfo();
      return wlanInfo;
    });
    ipcMain.handle("getPdfFromPublic", async (event, pdfFilename) => {
      try {
        const __dirname10 = import.meta.dirname;
        let pdfPath;
        if (app8.isPackaged) {
          pdfPath = path6.join(process.resourcesPath, "app.asar.unpacked", "public", pdfFilename);
        } else {
          pdfPath = path6.join(__dirname10, "../../public", pdfFilename);
        }
        if (!fs3.existsSync(pdfPath)) {
          log10.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
          return null;
        }
        const buffer = fs3.readFileSync(pdfPath);
        return buffer.toString("base64");
      } catch (error) {
        log10.error(`ipchandler @ getPdfFromPublic: Error: ${error.message}`, error);
        return null;
      }
    });
  }
  isVirtualMachine() {
    const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|microsoft|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|google|azure)/i;
    const warnAndReturn = (reason) => {
      log10.warn(`ipchandler @ isVirtualMachine: Verdacht auf VM - ${reason}`);
      return true;
    };
    if (process.platform === "linux") {
      try {
        const cpuinfo = readFileSync("/proc/cpuinfo", "utf8");
        if (/^flags.*\bhypervisor\b/m.test(cpuinfo)) return warnAndReturn("hypervisor flag in /proc/cpuinfo");
      } catch {
      }
      try {
        const files = [
          "/sys/class/dmi/id/sys_vendor",
          "/sys/class/dmi/id/product_name",
          "/sys/class/dmi/id/product_version",
          "/sys/class/dmi/id/board_vendor",
          "/sys/class/dmi/id/bios_vendor",
          "/sys/class/dmi/id/chassis_vendor"
        ];
        const dmi = files.map((p) => {
          try {
            return readFileSync(p, "utf8");
          } catch {
            return "";
          }
        }).join(" ");
        if (VENDORS.test(dmi)) return warnAndReturn("DMI-Vendor-Match");
      } catch {
      }
      try {
        execSync("systemd-detect-virt -q", { stdio: "ignore" });
        return warnAndReturn("systemd-detect-virt meldet Virtualisierung");
      } catch {
      }
      try {
        const qemuDevices = [
          "/dev/vhost-vsock"
        ];
        for (const device of qemuDevices) {
          try {
            if (__require("fs").existsSync(device)) {
              return warnAndReturn(`QEMU-Ger\xE4t gefunden: ${device}`);
            }
          } catch {
          }
        }
      } catch {
      }
      try {
        const ps = execSync("ps aux | grep -i qemu", { encoding: "utf8" });
        if (ps.includes("qemu") && !ps.includes("grep")) {
          return warnAndReturn("QEMU-Prozess l\xE4uft");
        }
      } catch {
      }
    }
    if (process.platform === "win32") {
      try {
        const ps = `powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem | ForEach-Object { $_.Manufacturer, $_.Model }) -join ' '"`;
        const basic = execSync(ps, { encoding: "utf8" }).trim();
        if (VENDORS.test(basic)) return warnAndReturn("Windows Hersteller/Modell passt zu VM");
      } catch {
      }
      try {
        const psRobust = `powershell -NoProfile -Command "$o=@();try{$cs=Get-CimInstance Win32_ComputerSystem;$o+=@($cs.Manufacturer,$cs.Model)}catch{};try{$bb=Get-CimInstance Win32_BaseBoard;$o+=@($bb.Manufacturer,$bb.Product)}catch{};try{$bios=Get-CimInstance Win32_BIOS;$o+=@($bios.SMBIOSBIOSVersion)}catch{};try{$csp=Get-CimInstance Win32_ComputerSystemProduct;$o+=@($csp.Name)}catch{};Write-Output (($o -join ' ').Trim())"`;
        const robust = execSync(psRobust, { encoding: "utf8" }).trim();
        if (VENDORS.test(robust)) return warnAndReturn("Windows Hersteller/BIOS-Infos passen zu VM");
      } catch {
      }
      try {
        const qemuProcesses = execSync('tasklist /FI "IMAGENAME eq qemu*"', { encoding: "utf8" });
        if (qemuProcesses.includes("qemu")) return warnAndReturn("QEMU-Prozess unter Windows");
      } catch {
      }
    }
    if (process.platform === "darwin") {
      try {
        const hwModel = execSync("sysctl -n hw.model", { encoding: "utf8" });
        if (/^virtual/i.test(hwModel) || VENDORS.test(hwModel)) return warnAndReturn("macOS Hardwaremodell deutet auf VM");
      } catch {
      }
      try {
        const sp = execSync("system_profiler SPHardwareDataType", { encoding: "utf8" });
        if (VENDORS.test(sp)) return warnAndReturn("macOS system_profiler meldet VM-Vendor");
      } catch {
      }
    }
    return false;
  }
  compareVersions(versionA, versionB) {
    const partsA = versionA.split(".").map(Number);
    const partsB = versionB.split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }
    return 0;
  }
  compareReleaseNumbers(statusA, statusB) {
    const numberA = parseInt(statusA.match(/\d+/), 10) || 0;
    const numberB = parseInt(statusB.match(/\d+/), 10) || 0;
    if (numberA < numberB) return -1;
    if (numberA > numberB) return 1;
    return 0;
  }
  compareSoftware(versionA, statusA, versionB, statusB) {
    const versionComparison = this.compareVersions(versionA, versionB);
    if (versionComparison !== 0) return versionComparison;
    return this.compareReleaseNumbers(statusA, statusB);
  }
};
var ipchandler_default = new IpcHandler();

// src-electron/main/scripts/communicationhandler.js
import log11 from "electron-log";
import Tesseract from "tesseract.js";
import crypto from "crypto";
import path7 from "path";
import https from "https";
import screenshot from "screenshot-desktop-wayland";
import { Worker } from "worker_threads";

// src-electron/main/scripts/remotecheck/remoteWin.js
import { exec as exec4 } from "child_process";
import { promisify as promisify2 } from "util";
var execAsync2 = promisify2(exec4);
var suspiciousKeywords = [
  "teamviewer",
  "anydesk",
  "rustdesk",
  "vnc",
  "zoom",
  "discord",
  "skype",
  "teams",
  "chromeremotedesktop",
  "splashtop",
  "dwagent",
  "logmein",
  "screenconnect",
  "zoho",
  "parallels",
  "chatgpt",
  "remoteutilities",
  "g2comm",
  "pcvisit",
  "pcvisit_support",
  "pcvisit_customer",
  "support 15"
];
var suspiciousPorts = [
  53,
  2002,
  5222,
  5650,
  5900,
  5901,
  5902,
  5938,
  7070,
  6783,
  6784,
  6785,
  8040,
  8041,
  8042,
  21115,
  21116
];
async function checkProcesses() {
  const foundKeywords = [];
  try {
    const { stdout } = await execAsync2("tasklist /fo csv", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    const out = stdout.toLowerCase();
    for (const keyword of suspiciousKeywords) {
      if (out.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    return foundKeywords;
  } catch (error) {
    return [];
  }
}
async function checkPorts() {
  const foundPorts = [];
  try {
    const { stdout } = await execAsync2("netstat -ano", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    for (const port of suspiciousPorts) {
      const regex = new RegExp(`:${port}\\s`, "g");
      if (regex.test(stdout)) {
        foundPorts.push(port);
      }
    }
    return foundPorts;
  } catch (error) {
    return [];
  }
}
async function runRemoteCheck() {
  try {
    const [foundKeywords, foundPorts] = await Promise.all([
      checkProcesses(),
      checkPorts()
    ]);
    if (foundKeywords.length === 0 && foundPorts.length === 0) {
      return false;
    }
    return {
      // Return found keywords and ports
      keywords: foundKeywords,
      ports: foundPorts
    };
  } catch (error) {
    return false;
  }
}

// src-electron/main/scripts/remotecheck/remoteMac.js
import { exec as exec5 } from "child_process";
import { promisify as promisify3 } from "util";
var execAsync3 = promisify3(exec5);
var suspiciousKeywords2 = [
  "teamviewer",
  "anydesk",
  "rustdesk",
  "vnc",
  "zoom",
  "discord",
  "skype",
  "com.microsoft.teams",
  "chromeremotedesktop",
  "splashtop",
  "dwagent",
  "logmein",
  "screenconnect",
  "zoho",
  "parallels",
  "chatgpt",
  "remoteutilities",
  "g2comm",
  "pcvisit",
  "pcvisit_support",
  "pcvisit_customer",
  "support 15"
];
var suspiciousPorts2 = [
  53,
  2002,
  5222,
  5650,
  5900,
  5901,
  5902,
  5938,
  7070,
  6783,
  6784,
  6785,
  8040,
  8041,
  8042,
  21115,
  21116
];
async function checkProcesses2() {
  const foundKeywords = [];
  try {
    const { stdout } = await execAsync3("ps aux", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    const out = stdout.toLowerCase();
    for (const keyword of suspiciousKeywords2) {
      if (out.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    return foundKeywords;
  } catch (error) {
    return [];
  }
}
async function checkPorts2() {
  const foundPorts = [];
  try {
    const { stdout } = await execAsync3("lsof -i -n -P", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    const out = stdout.toLowerCase();
    for (const port of suspiciousPorts2) {
      const portRegex = new RegExp(`:${port}(?:\\s|->|\\(|$)`, "i");
      if (portRegex.test(out)) {
        foundPorts.push(port);
      }
    }
    return foundPorts;
  } catch (error) {
    return [];
  }
}
async function runRemoteCheck2() {
  try {
    const [foundKeywords, foundPorts] = await Promise.all([
      checkProcesses2(),
      checkPorts2()
    ]);
    if (foundKeywords.length === 0 && foundPorts.length === 0) {
      return false;
    }
    return {
      // Return found keywords and ports
      keywords: foundKeywords,
      ports: foundPorts
    };
  } catch (error) {
    return false;
  }
}

// src-electron/main/scripts/remotecheck/remoteLin.js
import { exec as exec6 } from "child_process";
import { promisify as promisify4 } from "util";
var execAsync4 = promisify4(exec6);
var suspiciousKeywords3 = [
  "teamviewer",
  "anydesk",
  "rustdesk",
  "vnc",
  "zoom",
  "discord",
  "skype",
  "teams",
  "chromeremotedesktop",
  "splashtop",
  "dwagent",
  "logmein",
  "screenconnect",
  "zoho",
  "parallels",
  "remoteutilities",
  "g2comm",
  "pcvisit",
  "pcvisit_support",
  "pcvisit_customer",
  "support 15"
];
var suspiciousPorts3 = [
  53,
  2002,
  5222,
  5650,
  5900,
  5901,
  5902,
  5938,
  7070,
  6783,
  6784,
  6785,
  8040,
  8041,
  8042,
  21115,
  21116
];
async function checkProcesses3() {
  const foundKeywords = [];
  try {
    const { stdout } = await execAsync4("ps aux", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    const out = stdout.toLowerCase();
    for (const keyword of suspiciousKeywords3) {
      if (out.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    return foundKeywords;
  } catch (error) {
    return [];
  }
}
async function checkPorts3() {
  const foundPorts = [];
  try {
    const { stdout } = await execAsync4("lsof -i -n -P", {
      encoding: "utf8",
      timeout: 3e3,
      // 3 second timeout
      maxBuffer: 1024 * 1024 * 2
      // 2MB buffer
    });
    const out = stdout.toLowerCase();
    for (const port of suspiciousPorts3) {
      const portRegex = new RegExp(`:${port}(?:\\s|->|\\(|$)`, "i");
      if (portRegex.test(out)) {
        foundPorts.push(port);
      }
    }
    return foundPorts;
  } catch (error) {
    return [];
  }
}
async function runRemoteCheck3() {
  try {
    const [foundKeywords, foundPorts] = await Promise.all([
      checkProcesses3(),
      checkPorts3()
    ]);
    if (foundKeywords.length === 0 && foundPorts.length === 0) {
      return false;
    }
    return {
      // Return found keywords and ports
      keywords: foundKeywords,
      ports: foundPorts
    };
  } catch (error) {
    return false;
  }
}

// src-electron/main/scripts/remoteCheck.js
async function runRemoteCheck4(platform = "win32") {
  if (platform === "win32") return await runRemoteCheck();
  if (platform === "darwin") return await runRemoteCheck2();
  return await runRemoteCheck3();
}

// src-electron/main/scripts/communicationhandler.js
var agent = new https.Agent({ rejectUnauthorized: false });
var __dirname8 = import.meta.dirname;
var CommHandler = class {
  constructor() {
    this.multicastClient = null;
    this.config = null;
    this.updateStudentIntervall = null;
    this.WindowHandler = null;
    this.screenshotAbility = false;
    this.screenshotFails = 0;
    this.firstCheckScreenshot = true;
    this.timer = 0;
    this.worker = null;
    this.useWorker = true;
    this.workerFails = 0;
  }
  init(mc, config2) {
    this.multicastClient = mc;
    this.config = config2;
    this.updateScheduler = new SchedulerService(this.requestUpdate.bind(this), 5e3);
    this.updateScheduler.start();
    this.screenshotScheduler = new SchedulerService(this.sendScreenshot.bind(this), this.multicastClient.clientinfo.screenshotinterval);
    this.screenshotScheduler.start();
    if (!this.worker && platformDispatcher_default.useWorker) {
      this.setupImageWorker();
    }
  }
  /**
   * Setup the image worker
   * uses fork to create a new child process
   * uses the imageWorkerLinux.js or imageWorkerSharp.js file
   * the worker is used to process the screenshot in a separate process
   */
  async setupImageWorker() {
    const workerURL = platformDispatcher_default.workerURL;
    this.worker = new Worker(workerURL, { type: "module", env: { ...process.env } });
    log11.debug("communicationhandler @ setupImageWorker: ImageWorker initialized. Using " + platformDispatcher_default.workerFileName);
    this.worker.on("error", (error) => {
      log11.error("communicationhandler @ setupImageWorker: Worker error:", error);
    });
    this.worker.on("exit", (code) => {
      if (code !== 0) {
        this.workerFails += 1;
        if (this.workerFails > 4) {
          this.useWorker = false;
          log11.error("communicationhandler @ setupImageWorker: Worker failed 5 times - switching to no processing");
        } else {
          this.setupImageWorker();
        }
      }
    });
  }
  /**
   * Process the screenshot 
   * if useWorker is true, the screenshot is processed in a separate process
   * otherwise the screenshot is not processed and the original screenshot is returned
   */
  async processImage(imgBuffer) {
    if (platformDispatcher_default.useWorker) {
      if (!this.worker) {
        platformDispatcher_default.useWorker = false;
        throw new Error("Worker not initialized");
      }
      this.worker.postMessage({ imgBuffer: Array.from(imgBuffer), imVersion: platformDispatcher_default.imVersion });
      const result = await new Promise((resolve) => {
        this.worker.once("message", (message) => {
          resolve(message);
        });
      });
      if (!result.success) throw new Error(result.error);
      return result;
    } else {
      const screenshotBase64 = Buffer.from(imgBuffer).toString("base64");
      const headerBase64 = screenshotBase64;
      return { success: true, screenshotBase64, headerBase64, isblack: false, imgBuffer };
    }
  }
  /** 
   * Update current Serverstatus + Studenttstatus (every 5 seconds)
   */
  async requestUpdate() {
    this.timer++;
    if (this.timer % 20 === 0) {
      const usesRemoteAssistant = await runRemoteCheck4(process.platform);
      if (usesRemoteAssistant) {
        log11.warn("main @ ready: Possible remote assistance detected");
        for (const keyword of usesRemoteAssistant.keywords) {
          log11.warn(`main @ ready: Keyword ${keyword} detected`);
        }
        for (const port of usesRemoteAssistant.ports) {
          log11.warn(`main @ ready: Port ${port} detected`);
        }
        this.multicastClient.clientinfo.remoteassistant = usesRemoteAssistant;
      }
      if (this.multicastClient.clientinfo.exammode) {
        windowhandler_default.initBlockWindows();
      }
    }
    if (this.multicastClient.clientinfo.localLockdown) {
      return;
    }
    if (this.multicastClient.beaconsLost >= 5) {
      if (!this.multicastClient.kicked) {
        log11.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.");
        this.multicastClient.beaconsLost = 0;
        this.resetConnection();
        this.killScreenlock();
      }
    }
    if (this.multicastClient.clientinfo.serverip) {
      let payload = { clientinfo: this.multicastClient.clientinfo };
      fetch(`https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/update`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      }).then((data) => {
        if (data.status === "error") {
          if (data.message === "notavailable") {
            log11.warn("communicationhandler @ requestUpdate: Exam Instance not found!");
            this.multicastClient.beaconsLost = 5;
          } else if (data.message === "removed") {
            log11.warn("communicationhandler @ requestUpdate: Student registration not found!");
            this.kickStudent();
          } else {
            log11.warn(`communicationhandler @ requestUpdate: ${this.multicastClient.beaconsLost} Heartbeat lost..`);
            this.multicastClient.beaconsLost += 1;
          }
        } else if (data.status === "success") {
          this.multicastClient.beaconsLost = 0;
          this.multicastClient.clientinfo.printrequest = false;
          const serverStatusDeepCopy = JSON.parse(JSON.stringify(data.serverstatus));
          const studentStatusDeepCopy = JSON.parse(JSON.stringify(data.studentstatus));
          this.processUpdatedServerstatus(serverStatusDeepCopy, studentStatusDeepCopy);
        }
      }).catch((error) => {
        this.multicastClient.beaconsLost += 1;
        log11.error(`communicationhandler @ requestUpdate: (${this.multicastClient.beaconsLost}) ${error}`);
      });
    } else {
      this.multicastClient.clientinfo.focus = true;
    }
  }
  async sendScreenshot() {
    if (this.multicastClient.clientinfo.localLockdown) {
      return;
    }
    if (this.multicastClient.beaconsLost >= 5) {
      return;
    }
    if (this.multicastClient.clientinfo.serverip) {
      let success, screenshotBase64, headerBase64, isblack;
      let imgBuffer = null;
      try {
        if (platformDispatcher_default.screenshotAbility) {
          imgBuffer = await screenshot({ format: "png" });
          ({ success, screenshotBase64, headerBase64, isblack, imgBuffer } = await this.processImage(imgBuffer));
          if (success) {
            this.screenshotFails = 0;
          } else {
            throw new Error("Image processing failed");
          }
        } else {
          let currentFocusedMindow = windowhandler_default.getCurrentFocusedWindow();
          if (currentFocusedMindow) {
            let result = await currentFocusedMindow.webContents.capturePage();
            imgBuffer = result.toPNG();
          }
          ({ success, screenshotBase64, headerBase64, isblack } = await this.processImage(imgBuffer));
        }
      } catch (err) {
        this.screenshotFails += 1;
        log11.error(`communicationhandler @ sendScreenshot: processImage failed: ${err}`);
      }
      if (process.platform === "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = app9.isPackaged ? path7.join(process.resourcesPath, "app.asar.unpacked", "public") : path7.resolve(__dirname8, "../../public");
        try {
          const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng", { langPath: publicPath });
          let appWindowVisible = text.includes("Exam");
          if (!appWindowVisible) {
            platformDispatcher_default.screenshotAbility = false;
            log11.warn("communicationhandler @ sendScreenshot (macos): Please check your screenshot permissions - Switching to PageCapture");
          } else {
            log11.info("communicationhandler @ sendScreenshot (macos): MacOS screenshotpermissions check OK");
          }
        } catch (err) {
          log11.error(`communicationhandler @ sendScreenshot (macos): ${err}`);
        }
      }
      if (!screenshotBase64) {
        if (this.screenshotFails > 4 && platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.screenshotAbility = false;
          log11.error(`communicationhandler @ sendScreenshot: Screenshot error -> Switching to PageCapture`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.useWorker = false;
          log11.error(`communicationhandler @ sendScreenshot: PageCapture error -> Switching to No-Processing`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility && !platformDispatcher_default.useWorker) {
          log11.error(`communicationhandler @ sendScreenshot: no screenshot available - please fix your setup`);
        }
        return;
      }
      if (this.multicastClient.clientinfo.exammode && !this.config.development && this.multicastClient.clientinfo.focus) {
        if (isblack) {
          this.multicastClient.clientinfo.focus = false;
          log11.info("communicationhandler @ sendScreenshot: Student Screenshot does not fit requirements (allblack)");
        }
      }
      let screenshothash = null;
      try {
        screenshothash = crypto.createHash("md5").update(Buffer.from(screenshotBase64, "base64")).digest("hex");
      } catch (err) {
        log11.error(`communicationhandler @ sendScreenshot: creating hash failed: ${err.message}`);
      }
      const payload = {
        clientinfo: this.multicastClient.clientinfo,
        screenshot: screenshotBase64,
        screenshothash,
        header: headerBase64,
        screenshotfilename: this.multicastClient.clientinfo.token + ".jpg"
      };
      let attempt = 0;
      const maxRetries = 2;
      const url = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/updatescreenshot`;
      this.doScreenshotUpdate(url, payload, agent, attempt, maxRetries);
    }
  }
  doScreenshotUpdate(url, payload, agent2, attempt = 0, maxRetries) {
    fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      agent: agent2
    }).then((response) => {
      if (!response.ok) {
        throw new Error("communicationhandler @ doScreenshotUpdate: Network response was not ok");
      }
      return response.json();
    }).then((data) => {
      if (data && data.status === "error") {
        log11.error("communicationhandler @ doScreenshotUpdate: Status Error:", data.message);
      }
    }).catch((error) => {
      if (attempt < maxRetries - 1) {
        this.doScreenshotUpdate(url, payload, agent2, attempt + 1, maxRetries);
      } else if (attempt === maxRetries - 1 && this.multicastClient.beaconsLost === 0) {
        log11.error(`communicationhandler @ doScreenshotUpdate (fetch): ${error.message}`);
      }
    });
  }
  async kickStudent(studentstatus) {
    log11.warn("communicationhandler @ kickStudent: Student got kicked by Teacher");
    this.multicastClient.kicked = false;
    this.multicastClient.beaconsLost = 0;
    let serverstatus = { delfolderonexit: false };
    if (studentstatus && studentstatus.delfolder) {
      serverstatus.delfolderonexit = true;
    }
    this.endExam(serverstatus);
    this.resetConnection();
    return;
  }
  /**
   * react to server status 
   * this currently only handle startexam & endexam
   * could also handle kick, focusrestore, and even trigger file requests
   */
  async processUpdatedServerstatus(serverstatus, studentstatus) {
    if (studentstatus && Object.keys(studentstatus).length !== 0) {
      if (studentstatus.printdenied) {
        windowhandler_default.examwindow.webContents.send("denied");
      }
      if (studentstatus.kicked) {
        this.kickStudent(studentstatus);
        return;
      }
      if (studentstatus.delfolder === true) {
        log11.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder");
        let delfolder = true;
        try {
          if (fs4.existsSync(this.config.examdirectory)) {
            fs4.rmSync(this.config.examdirectory, { recursive: true });
            fs4.mkdirSync(this.config.examdirectory);
          }
        } catch (error) {
          delfolder = false;
          windowhandler_default.examwindow.webContents.send("fileerror", error);
          log11.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `);
        }
        if (delfolder == false) {
          if (fs4.existsSync(this.config.examdirectory)) {
            const files = fs4.readdirSync(this.config.examdirectory);
            files.forEach((file) => {
              const filePath = join4(this.config.examdirectory, file);
              try {
                const stats = fs4.statSync(filePath);
                if (stats.isDirectory()) {
                  fs4.rmSync(filePath, { recursive: true });
                } else {
                  fs4.unlinkSync(filePath);
                }
              } catch (error) {
                log11.error(`communicationhandler @ processUpdatedServerstatus: (delfolder) Fehler beim L\xF6schen der Datei/Verzeichnis: ${filePath}`, error);
              }
            });
          }
        }
        if (windowhandler_default.examwindow) {
          windowhandler_default.examwindow.webContents.send("loadfilelist");
        }
      }
      if (studentstatus.focus == false) {
        this.multicastClient.clientinfo.focus = false;
      }
      if (studentstatus.restorefocusstate === true) {
        log11.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student");
        this.multicastClient.clientinfo.focus = true;
        if (windowhandler_default.examwindow && !this.config.development) {
          windowhandler_default.examwindow.setKiosk(true);
          windowhandler_default.examwindow.focus();
        }
      }
      if (studentstatus.activatePrivateSpellcheck == true && this.multicastClient.clientinfo.privateSpellcheck.activated == false) {
        log11.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student");
        this.multicastClient.clientinfo.privateSpellcheck.activate = true;
        this.multicastClient.clientinfo.privateSpellcheck.activated = true;
        ipcMain2.emit("startLanguageTool");
      }
      if (studentstatus.activatePrivateSpellcheck == false && this.multicastClient.clientinfo.privateSpellcheck.activated == true) {
        log11.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student");
        this.multicastClient.clientinfo.privateSpellcheck.activate = false;
        this.multicastClient.clientinfo.privateSpellcheck.activated = false;
      }
      this.multicastClient.clientinfo.privateSpellcheck.suggestions = studentstatus.activatePrivateSuggestions;
      if (studentstatus.sendexam === true) {
        this.sendExamToTeacher();
      }
      if (studentstatus.fetchfiles === true) {
        this.requestFileFromServer(studentstatus.files);
      }
      this.multicastClient.clientinfo.msofficeshare = studentstatus.msofficeshare;
      if (studentstatus.group) {
        if (this.multicastClient.clientinfo.group !== studentstatus.group) {
          this.multicastClient.clientinfo.group = studentstatus.group;
          if (windowhandler_default.examwindow) {
            windowhandler_default.examwindow.webContents.send("getmaterials");
          }
        }
      }
    }
    if (serverstatus.exammode && this.multicastClient.clientinfo.exammode) {
      if (serverstatus.lockedSection !== this.multicastClient.clientinfo.lockedSection) {
        log11.warn(`communicationhandler @ processUpdatedServerstatus: changing section to ${serverstatus.lockedSection} ${serverstatus.examSections[serverstatus.lockedSection].sectionname} , Examtype: ${serverstatus.examSections[serverstatus.lockedSection].examtype}`);
        const currentLockedSection = this.multicastClient.clientinfo.lockedSection;
        const newLockedSection = serverstatus.lockedSection;
        const examDir = this.config.examdirectory;
        if (this.multicastClient.clientinfo.examtype === "editor") {
          log11.info("communicationhandler @ processUpdatedServerstatus: sending exam to teacher (final submit)");
          let pdf = await this.getBase64PDF(this.multicastClient.clientinfo.submissionnumber, serverstatus.examSections[currentLockedSection].sectionname);
          if (pdf.status === "success") {
            this.sendBase64PDFtoTeacher(pdf.base64pdf, currentLockedSection);
          }
        }
        this.sendToTeacher();
        await this.sleep(2e3);
        this.multicastClient.clientinfo.examtype = serverstatus.examSections[serverstatus.lockedSection].examtype;
        this.multicastClient.clientinfo.lockedSection = newLockedSection;
        try {
          if (fs4.existsSync(examDir) && currentLockedSection != null && currentLockedSection !== void 0) {
            log11.debug(`communicationhandler @ processUpdatedServerstatus: Saving content from examDir to section ${currentLockedSection}`);
            const savePath = `${examDir}/${currentLockedSection}`;
            if (!fs4.existsSync(savePath)) {
              fs4.mkdirSync(savePath, { recursive: true });
            }
            const files = fs4.readdirSync(examDir);
            log11.info(`communicationhandler @ processUpdatedServerstatus: Found ${files.length} items in examDir to save`);
            let filesSaved = 0;
            for (const file of files) {
              const oldPath = `${examDir}/${file}`;
              const stat = fs4.statSync(oldPath);
              if (stat.isFile()) {
                const newPath = `${savePath}/${file}`;
                fs4.copyFileSync(oldPath, newPath);
                fs4.unlinkSync(oldPath);
                filesSaved++;
                log11.info(`communicationhandler @ processUpdatedServerstatus: Saved file ${file} to section ${currentLockedSection}`);
              } else {
                log11.info(`communicationhandler @ processUpdatedServerstatus: Skipping non-file (folder) item ${file} in examDir`);
              }
            }
            log11.info(`communicationhandler @ processUpdatedServerstatus: Successfully saved ${filesSaved} files to section ${currentLockedSection}`);
          } else {
            log11.warn(`communicationhandler @ processUpdatedServerstatus: Skipping save - examDir exists: ${fs4.existsSync(examDir)}, currentLockedSection: ${currentLockedSection}`);
          }
          if (newLockedSection != null && newLockedSection !== void 0) {
            log11.debug(`communicationhandler @ processUpdatedServerstatus: Loading content from section ${newLockedSection} to examDir`);
            const loadPath = `${examDir}/${newLockedSection}`;
            if (fs4.existsSync(loadPath)) {
              const filesToLoad = fs4.readdirSync(loadPath);
              log11.info(`communicationhandler @ processUpdatedServerstatus: Found ${filesToLoad.length} items in section ${newLockedSection} directory`);
              let filesCopied = 0;
              for (const file of filesToLoad) {
                const sourcePath = `${loadPath}/${file}`;
                const destPath = `${examDir}/${file}`;
                const stat = fs4.statSync(sourcePath);
                if (stat.isFile()) {
                  fs4.copyFileSync(sourcePath, destPath);
                  filesCopied++;
                  log11.info(`communicationhandler @ processUpdatedServerstatus: Copied file ${file} from section ${newLockedSection} to examDir`);
                } else {
                  log11.warn(`communicationhandler @ processUpdatedServerstatus: Skipping non-file item ${file} in section ${newLockedSection} directory`);
                }
              }
              log11.info(`communicationhandler @ processUpdatedServerstatus: Successfully copied ${filesCopied} files from section ${newLockedSection} to examDir`);
            } else {
              log11.info(`communicationhandler @ processUpdatedServerstatus: New locked section directory ${newLockedSection} does not exist. Starting with a clean state.`);
            }
          } else {
            log11.warn(`communicationhandler @ processUpdatedServerstatus: newLockedSection is falsy (${newLockedSection}), skipping file load`);
          }
        } catch (error) {
          log11.error(`communicationhandler @ processUpdatedServerstatus: Error during folder operation - ${error}`);
          log11.error(`communicationhandler @ processUpdatedServerstatus: Error stack: ${error.stack}`);
          log11.error(`communicationhandler @ processUpdatedServerstatus: currentLockedSection: ${currentLockedSection}, newLockedSection: ${newLockedSection}, examDir: ${examDir}`);
        }
        if (windowhandler_default.examwindow) {
          if (this.config.development) {
            webContents2.getAllWebContents().forEach((wc) => {
              if (wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
                log11.info("communicationhandler @ switchExamSection: destroying devtools window");
                wc.closeDevTools();
              }
            });
          }
          windowhandler_default.examwindow.once("closed", () => {
            windowhandler_default.examwindow = null;
            this.startExam(serverstatus);
          });
          windowhandler_default.examwindow.close();
          windowhandler_default.examwindow.destroy();
        }
      }
    }
    if (serverstatus.screenslocked && !this.multicastClient.clientinfo.screenlock) {
      this.activateScreenlock();
    } else if (!serverstatus.screenslocked) {
      this.killScreenlock();
    }
    if (serverstatus.screenshotocr) {
      this.multicastClient.clientinfo.screenshotocr = true;
    } else {
      this.multicastClient.clientinfo.screenshotocr = false;
    }
    if (serverstatus.examSections[serverstatus.lockedSection].groups) {
      this.multicastClient.clientinfo.groups = true;
    } else {
      this.multicastClient.clientinfo.groups = false;
    }
    if (serverstatus.screenshotinterval || serverstatus.screenshotinterval === 0) {
      if (this.multicastClient.clientinfo.screenshotinterval !== serverstatus.screenshotinterval * 1e3) {
        log11.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to", serverstatus.screenshotinterval * 1e3);
        this.multicastClient.clientinfo.screenshotinterval = serverstatus.screenshotinterval * 1e3;
        if (serverstatus.screenshotinterval == 0) {
          log11.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!");
        }
        this.screenshotScheduler.stop();
        if (this.multicastClient.clientinfo.screenshotinterval > 0) {
          this.screenshotScheduler.interval = this.multicastClient.clientinfo.screenshotinterval;
          this.screenshotScheduler.start();
        }
      }
    }
    if (serverstatus.exammode && !this.multicastClient.clientinfo.exammode) {
      this.killScreenlock();
      this.startExam(serverstatus);
    } else if (!serverstatus.exammode && this.multicastClient.clientinfo.exammode) {
      this.killScreenlock();
      this.endExam(serverstatus);
    }
  }
  // send base64 pdf to teacher
  sendBase64PDFtoTeacher(base64pdf, section = 1) {
    const url = `https://${this.multicastClient.clientinfo.serverip}:${this.config.serverApiPort}/server/control/printrequest/${this.multicastClient.clientinfo.servername}/${this.multicastClient.clientinfo.token}`;
    const payload = {
      document: base64pdf,
      printrequest: false,
      submissionnumber: this.multicastClient.clientinfo.submissionnumber,
      lockedsection: section
    };
    fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    }).then((response) => {
      return response.json();
    }).then((data) => {
      if (data.message == "success") {
        this.multicastClient.clientinfo.submissionnumber++;
      }
    }).catch((error) => {
      console.log("editor @ printbase64:", error.message);
    });
  }
  //get base64 pdf from editor
  // ATTENTION: there is a similar method in ipchandler.js that also generates a pdf but stores it as file in the exam directory
  async getBase64PDF(submissionnumber, sectionname, printBackground = false) {
    log11.info("communicationhandler @ getBase64PDF: getting base64 encoded pdf");
    var options = {
      margins: { top: 0.5, right: 0, bottom: 0.5, left: 0 },
      pageSize: "A4",
      printBackground,
      printSelectionOnly: false,
      landscape: false,
      displayHeaderFooter: true,
      footerTemplate: "<div style='height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-bottom:10px;'><span class=pageNumber></span>|<span class=totalPages></span></div>",
      headerTemplate: `<div style='display: inline-block; height:12px; font-size:10px; text-align: right; width:100%; margin-right: 30px;margin-left: 30px; margin-top:10px;'><span style="float:left;">${this.multicastClient.clientinfo.servername}</span><span style="float:left;">&nbsp;|&nbsp; </span><span style="float:left;">${sectionname}</span><span style="float:left;">&nbsp;|&nbsp; </span><span class=date style="float:left;"></span><span style="float:left;">&nbsp;|&nbsp;Abgabe: ${submissionnumber}</span><span style="float:right;">${this.multicastClient.clientinfo.name}</span></div>`,
      preferCSSPageSize: false
    };
    await windowhandler_default.examwindow.webContents.executeJavaScript(`document.title = "${this.multicastClient.clientinfo.clientname} - ${this.multicastClient.clientinfo.servername} - Version ${submissionnumber}"`);
    try {
      const data = await windowhandler_default.examwindow.webContents.printToPDF(options);
      const base64pdf = data.toString("base64");
      const dataUrl = `data:application/pdf;base64,${base64pdf}`;
      return { sender: "client", message: "PDF generated", dataUrl, base64pdf, status: "success" };
    } catch (error) {
      log11.error("Error generating PDF:", error);
      return { sender: "client", message: "Error generating PDF", status: "error" };
    }
  }
  // show temporary screenlock window
  activateScreenlock() {
    let displays = screen2.getAllDisplays();
    let primary = screen2.getPrimaryDisplay();
    if (!primary || primary === "" || !primary.id) {
      primary = displays[0];
    }
    if (windowhandler_default.screenlockwindows.length == 0) {
      this.multicastClient.clientinfo.screenlock = true;
      for (let display of displays) {
        windowhandler_default.createScreenlockWindow(display);
      }
    }
  }
  // remove temporary screenlockwindow
  killScreenlock() {
    try {
      for (let screenlockwindow of windowhandler_default.screenlockwindows) {
        if (screenlockwindow && !screenlockwindow.isDestroyed()) {
          screenlockwindow.close();
          screenlockwindow.destroy();
        }
      }
    } catch (e) {
      log11.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle");
    }
    windowhandler_default.screenlockwindows = [];
    this.multicastClient.clientinfo.screenlock = false;
  }
  /**
   * Starts exam mode for student
   * deletes workfolder contents (if set)
   * opens a new window in kiosk mode with the given examtype
   * enables the blur listener and activates restrictions (disable keyboarshortcuts etc.)
   * @param serverstatus contains information about exammode, examtype, and other settings from the teacher instance
   */
  async startExam(serverstatus) {
    if (windowhandler_default.exitWarningOpen || windowhandler_default.exitQuestionOpen || windowhandler_default.minimizeWarningOpen) {
      log11.warn("communicationhandler @ startExam: Dialog is still open - exam will start anyway");
    }
    let displays = screen2.getAllDisplays();
    let primary = screen2.getPrimaryDisplay();
    if (!primary || primary === "" || !primary.id) {
      primary = displays[0];
    }
    this.multicastClient.clientinfo.exammode = true;
    this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection;
    this.multicastClient.clientinfo.cmargin = serverstatus.examSections[serverstatus.lockedSection].cmargin;
    this.multicastClient.clientinfo.linespacing = serverstatus.examSections[serverstatus.lockedSection].linespacing;
    this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[serverstatus.lockedSection].audioRepeat;
    if (!windowhandler_default.examwindow) {
      log11.info("communicationhandler @ startExam: creating exam window");
      this.multicastClient.clientinfo.examtype = serverstatus.examSections[serverstatus.lockedSection].examtype;
      windowhandler_default.createExamWindow(serverstatus.examSections[serverstatus.lockedSection].examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
    } else if (windowhandler_default.examwindow) {
      log11.error("communicationhandler @ startExam: found existing Examwindow..");
      try {
        windowhandler_default.examwindow.show();
        if (!this.config.development) {
          windowhandler_default.examwindow.setFullScreen(true);
          windowhandler_default.examwindow.setAlwaysOnTop(true, "screen-saver", 1);
          enableRestrictions(windowhandler_default);
          await this.sleep(2e3);
          windowhandler_default.addBlurListener();
          await this.sleep(500);
          await windowhandler_default.initBlockWindows();
          windowhandler_default.examwindow.moveTop();
          windowhandler_default.examwindow.focus();
        }
      } catch (e) {
        log11.error("communicationhandler @ startExam: no functional examwindow found.. resetting");
        disableRestrictions(windowhandler_default.examwindow);
        windowhandler_default.examwindow = null;
        this.multicastClient.clientinfo.exammode = false;
        this.multicastClient.clientinfo.focus = true;
        return;
      }
    }
  }
  /**
   * Disables Exam mode
   * closes exam window
   * disables restrictions and blur 
   */
  async endExam(serverstatus) {
    windowhandler_default.removeBlurListener();
    if (this.multicastClient.clientinfo.exammode) {
      this.multicastClient.clientinfo.exammode = false;
      disableRestrictions();
    }
    if (serverstatus && serverstatus.delfolderonexit === true) {
      log11.info("communicationhandler @ endExam: cleaning exam workfolder on exit");
      try {
        if (fs4.existsSync(this.config.examdirectory)) {
          fs4.rmSync(this.config.examdirectory, { recursive: true });
          fs4.mkdirSync(this.config.examdirectory);
        }
      } catch (error) {
        log11.error("communicationhandler @ endExam: ", error);
      }
    }
    if (windowhandler_default.examwindow) {
      try {
        if (this.config.development || this.config.showdevtools) {
          const allWebContents = webContents2.getAllWebContents();
          for (const wc of allWebContents) {
            if (windowhandler_default.examwindow && wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
              log11.info("communicationhandler @ endExam: destroying devtools window");
              wc.closeDevTools();
            }
          }
          await this.sleep(1e3);
        }
        this.closeExamWindowSafely();
      } catch (e) {
        log11.error("communicationhandler @ endExam: ", e);
      }
      try {
        for (let blockwindow of windowhandler_default.blockwindows) {
          blockwindow.close();
          blockwindow.destroy();
          blockwindow = null;
        }
      } catch (e) {
        windowhandler_default.blockwindows = [];
        log11.error("communicationhandler @ endExam: no functional blockwindow to handle");
      }
    }
    windowhandler_default.blockwindows = [];
    this.multicastClient.clientinfo.msofficeshare = false;
    this.multicastClient.clientinfo.focus = true;
    this.multicastClient.clientinfo.localLockdown = false;
    if (lt_server_default.languageToolProcess) {
      lt_server_default.stopServer();
    }
    await windowhandler_default.showExitQuestion();
  }
  /**
   * Closes examwindow only when no printToPDF operation is running
   */
  closeExamWindowSafely() {
    const examWin = windowhandler_default.examwindow;
    if (!examWin) {
      return;
    }
    if (ipchandler_default.isPrintingPdf) {
      log11.warn("communicationhandler @ closeExamWindowSafely: printToPDF in progress - retry in 1s");
      setTimeout(() => {
        this.closeExamWindowSafely();
      }, 1e3);
      return;
    }
    try {
      if (!examWin.isDestroyed?.()) {
        examWin.close();
      }
    } catch (e) {
      log11.error("communicationhandler @ closeExamWindowSafely: error while closing examwindow", e);
    } finally {
      windowhandler_default.examwindow = null;
    }
  }
  // this is manually triggered if connection is lost during exam - we allow the student to get out of the kiosk mode 
  // INFO: this is basically redundant 
  async gracefullyEndExam() {
    this.endExam();
  }
  // reset all variables that signal or need a valid teacher connection
  resetConnection() {
    this.multicastClient.clientinfo.token = false;
    this.multicastClient.clientinfo.ip = false;
    this.multicastClient.clientinfo.serverip = false;
    this.multicastClient.clientinfo.servername = false;
    this.multicastClient.clientinfo.focus = true;
    this.multicastClient.clientinfo.timestamp = false;
    this.multicastClient.clientinfo.localLockdown = false;
  }
  /**
   * diese methode holt sich, die vom teacher zum download bereitgelegten dateien
   * über das update interval wird der trigger zum download und die filelist erhalten
   * @param {*} files 
   */
  requestFileFromServer(files) {
    let servername = this.multicastClient.clientinfo.servername;
    let serverip = this.multicastClient.clientinfo.serverip;
    let token = this.multicastClient.clientinfo.token;
    let backupfile = false;
    for (const file of files) {
      if (file.name && file.name.includes("bak")) {
        backupfile = file.name;
      }
    }
    let data = JSON.stringify({ "files": files, "type": "studentfilerequest" });
    fetch(`https://${serverip}:${this.config.serverApiPort}/server/data/download/${servername}/${token}`, {
      method: "POST",
      body: data,
      headers: { "Content-Type": "application/json" }
    }).then((response) => response.arrayBuffer()).then((buffer) => {
      let absoluteFilepath = join4(this.config.tempdirectory, token.concat(".zip"));
      fs4.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
        if (err) {
          log11.error(err);
        } else {
          extract(absoluteFilepath, { dir: this.config.examdirectory }).then(() => {
            log11.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
            return fs4.promises.unlink(absoluteFilepath);
          }).then(() => {
            if (backupfile && windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("backup", backupfile);
              log11.warn("CommunicationHandler @ requestFileFromServer: Trigger Replace Event");
            }
            if (windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("loadfilelist");
            }
          }).catch((err2) => {
            log11.error(err2);
          });
        }
      });
    }).catch((err) => log11.error(`CommunicationHandler - requestFileFromServer: ${err}`));
  }
  async sendExamToTeacher() {
    if (windowhandler_default.examwindow) {
      try {
        windowhandler_default.examwindow.webContents.send("save", "teacherrequest");
      } catch (err) {
        log11.error(`Communication handler @ sendExamToTeacher: Could not save students work. Is exammode active?`);
      }
    } else {
      this.sendToTeacher();
    }
  }
  //zip config.work directory and send to teacher
  async sendToTeacher() {
    try {
      if (!fs4.existsSync(this.config.tempdirectory)) {
        fs4.mkdirSync(this.config.tempdirectory);
      }
    } catch (e) {
      log11.error(e);
    }
    let logfilepath = platformDispatcher_default.logfile;
    if (fs4.existsSync(logfilepath)) {
      try {
        fs4.copyFileSync(logfilepath, join4(this.config.examdirectory, "next-exam-student.log"));
      } catch (e) {
        log11.error("communicationhandler @ sendToTeacher: could not copy logfile to examdirectory");
      }
    }
    let zipfilename = this.multicastClient.clientinfo.name.concat(".zip");
    let servername = this.multicastClient.clientinfo.servername;
    let serverip = this.multicastClient.clientinfo.serverip;
    let token = this.multicastClient.clientinfo.token;
    let zipfilepath = join4(this.config.tempdirectory, zipfilename);
    let base64File = null;
    try {
      await this.zipDirectory(this.config.examdirectory, zipfilepath);
      const fileContent = fs4.readFileSync(zipfilepath);
      base64File = fileContent.toString("base64");
    } catch (e) {
      log11.error(e);
    }
    const url = `https://${serverip}:${this.config.serverApiPort}/server/data/receive/${servername}/${token}`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: base64File, filename: zipfilename })
    }).then((response) => response.json()).then((data) => {
      log11.info(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`);
    }).catch((error) => {
      log11.error(`communicationhandler @ sendExamToTeacher: ${error}`);
    });
  }
  /**
   * @param {String} sourceDir: /some/folder/to/compress
   * @param {String} outPath: /path/to/created.zip
   * @returns {Promise}
   */
  zipDirectory(sourceDir, outPath) {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = fs4.createWriteStream(outPath);
    return new Promise((resolve, reject) => {
      archive.directory(sourceDir, false).on("error", (err) => reject(err)).pipe(stream);
      stream.on("close", () => resolve());
      archive.finalize();
    }).catch((error) => {
      log11.error(error);
    });
  }
  // timeout 
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
var communicationhandler_default = new CommHandler();

// src-electron/main/scripts/checkparent.js
import { exec as exec7 } from "child_process";
import { promisify as promisify5 } from "util";
import { readFile } from "fs/promises";
import log12 from "electron-log";
var execAsync5 = promisify5(exec7);
var browserKeywords = [
  "chrom",
  "chrome.exe",
  "edge",
  "msedge.exe",
  "fire",
  "firefox.exe",
  "brave",
  "brave.exe",
  "opera",
  "opera.exe",
  "browser",
  // Generic browser process
  "iexplore",
  // Internet Explorer
  "safari"
  // For macOS
];
async function getProcessInfoWindows(pid) {
  try {
    const command = `powershell.exe -NoLogo -NoProfile -Command "& { $proc = Get-CimInstance -Class Win32_Process -Filter 'ProcessId=${pid}'; if ($proc) { $proc.ParentProcessId; $proc.Name } }"`;
    const { stdout } = await execAsync5(command, {
      encoding: "utf8",
      timeout: 3e3,
      maxBuffer: 1024 * 64
    });
    const lines = stdout.trim().split("\n").map((line) => line.trim()).filter((line) => line);
    if (lines.length < 2) {
      return null;
    }
    const ppid = parseInt(lines[0], 10);
    const name = lines[1].toLowerCase();
    if (isNaN(ppid)) {
      return null;
    }
    return { ppid, name };
  } catch (error) {
    log12.error(`checkparent @ getProcessInfoWindows: Error for PID ${pid}: ${error.message}`);
    return null;
  }
}
async function getProcessInfoUnix(pid) {
  try {
    const [statContent, commContent] = await Promise.all([
      readFile(`/proc/${pid}/stat`, "utf8").catch(() => null),
      readFile(`/proc/${pid}/comm`, "utf8").catch(() => null)
    ]);
    if (statContent) {
      const statMatch = statContent.match(/^\d+\s+\(([^)]+)\)\s+\S+\s+(\d+)/);
      if (statMatch) {
        const name2 = (commContent || statMatch[1]).trim().toLowerCase();
        const ppid2 = parseInt(statMatch[2], 10);
        return { ppid: ppid2, name: name2 };
      }
    }
    const command = `ps -p ${pid} -o ppid=,comm=`;
    const { stdout } = await execAsync5(command, {
      encoding: "utf8",
      timeout: 2e3,
      maxBuffer: 1024 * 64
    });
    const parts = stdout.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }
    const ppid = parseInt(parts[0], 10);
    const name = parts.slice(1).join(" ").toLowerCase();
    if (isNaN(ppid)) {
      return null;
    }
    return { ppid, name };
  } catch (error) {
    log12.error(`checkparent @ getProcessInfoUnix: Error for PID ${pid}: ${error.message}`);
    return null;
  }
}
async function getProcessInfo(pid) {
  const platform = process.platform;
  if (platform === "win32") {
    return await getProcessInfoWindows(pid);
  } else if (platform === "linux" || platform === "darwin") {
    return await getProcessInfoUnix(pid);
  }
  return null;
}
async function findParentProcess(pid, maxDepth, visitedPids) {
  if (pid === 1 || pid === 0) {
    log12.info("checkparent @ findParentProcess: Root PID reached. No web browser found.");
    return false;
  }
  if (maxDepth <= 0) {
    return false;
  }
  if (visitedPids.has(pid)) {
    return false;
  }
  visitedPids.add(pid);
  const processInfo = await getProcessInfo(pid);
  if (!processInfo) {
    return false;
  }
  const { ppid, name } = processInfo;
  log12.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
  if (browserKeywords.some((browser) => name.includes(browser))) {
    log12.info(`checkparent @ findParentProcess: Browser found: ${name}`);
    return true;
  } else if (name.includes("explorer") || ppid <= 1) {
    log12.info(`checkparent @ findParentProcess: Reached system process or explorer`);
    return false;
  } else {
    return await findParentProcess(ppid, maxDepth - 1, visitedPids);
  }
}
async function checkParentProcess() {
  try {
    const foundBrowser = await findParentProcess(process.ppid, 6, /* @__PURE__ */ new Set());
    log12.info(`checkparent @ checkParentProcess: Browser detection result: ${foundBrowser}`);
    return { success: true, foundBrowser };
  } catch (error) {
    log12.error(`checkparent @ checkParentProcess: Error in browser detection: ${error.message}`);
    return { success: false, foundBrowser: false, error: error.message };
  }
}

// src-electron/electron-main.js
jre_handler_default.init();
app10.commandLine.appendSwitch("lang", "de");
app10.commandLine.appendSwitch("enable-unsafe-swiftshader");
app10.commandLine.appendSwitch("log-level", "3");
if (process.platform === "linux") {
  app10.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,OutOfProcessRasterization,CanvasOopRasterization");
  app10.commandLine.appendSwitch("disable-zero-copy");
} else if (process.platform === "darwin") {
  app10.commandLine.appendSwitch("enable-features", "Metal,CanvasOopRasterization");
}
log13.initialize();
log13.eventLogger.startLogging();
log13.errorHandler.startCatching();
log13.transports.file.resolvePathFn = () => {
  return platformDispatcher_default.logfile;
};
log13.transports.console.format = (message) => {
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
log13.verbose();
log13.verbose(`main: -------------------`);
log13.verbose(`main: starting Next-Exam Student "${config_default.version} ${config_default.info}" (${process.platform})${config_default.development ? " (devmode on)" : ""}`);
log13.verbose(`main: -------------------`);
log13.info(`main: Logfilelocation at ${platformDispatcher_default.logfile}`);
platformDispatcher_default.messages.forEach((message) => {
  log13.debug(message);
});
log13.debug(`main: Electron version: ${process.versions.electron}`);
log13.debug(`main: Chromium version: ${process.versions.chrome}`);
log13.debug(`main: Node version: ${process.versions.node}`);
log13.debug(`main: V8 version: ${process.versions.v8}`);
log13.debug(`main: OS: ${process.platform} ${process.arch}`);
log13.debug(`main: Arch: ${process.arch}`);
windowhandler_default.init(multicastclient_default, config_default);
communicationhandler_default.init(multicastclient_default, config_default);
ipchandler_default.init(multicastclient_default, config_default, windowhandler_default, communicationhandler_default);
Menu2.setApplicationMenu(null);
if (!app10.requestSingleInstanceLock()) {
  log13.warn("main @ singleinstance: next-exam already running.");
  app10.quit();
  process.exit(0);
}
app10.on("second-instance", () => {
  log13.warn("main @ singleinstance: prevented second start of next-exam. Restoring existing Next-Exam window.");
  if (windowhandler_default.mainwindow) {
    if (windowhandler_default.mainwindow.isMinimized() || !windowhandler_default.mainwindow.isVisible()) {
      windowhandler_default.mainwindow.show();
      windowhandler_default.mainwindow.restore();
    }
    windowhandler_default.mainwindow.focus();
  }
});
var __dirname9 = import.meta.dirname;
config_default.electron = true;
config_default.homedirectory = platformDispatcher_default.homedirectory;
config_default.workdirectory = platformDispatcher_default.workdirectory;
config_default.tempdirectory = platformDispatcher_default.tempdirectory;
config_default.examdirectory = config_default.workdirectory;
if (!fs5.existsSync(config_default.workdirectory)) {
  fs5.mkdirSync(config_default.workdirectory, { recursive: true });
}
if (!fs5.existsSync(config_default.tempdirectory)) {
  fs5.mkdirSync(config_default.tempdirectory, { recursive: true });
}
if (!fs5.existsSync(platformDispatcher_default.desktopPath)) {
  fs5.mkdirSync(platformDispatcher_default.desktopPath, { recursive: true });
}
var linkPath = path8.join(platformDispatcher_default.desktopPath, config_default.clientdirectory);
try {
  fs5.unlinkSync(linkPath);
} catch (e) {
}
try {
  if (!fs5.existsSync(linkPath)) {
    fs5.symlinkSync(config_default.workdirectory, linkPath, "junction");
  }
} catch (e) {
  log13.error("main @ create-symlink: can't create symlink");
}
try {
  const { gateway, interface: iface } = gateway4sync2();
  config_default.hostip = ip2.address(iface);
  config_default.gateway = true;
} catch (e) {
  log13.error("main @ gateway4sync: unable to determine default gateway");
  config_default.hostip = ip2.address();
  log13.info(`main: IP ${config_default.hostip}`);
  config_default.gateway = false;
}
fsExtra.emptyDirSync(config_default.tempdirectory);
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") {
    log13.transports.console.level = false;
  }
});
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE") {
    log13.transports.console.level = false;
    log13.warn("main @ uncaughtException: EPIPE Error: The stdout stream of the ElectronLogger will be disabled.");
  } else if (err.message?.includes("Render frame was disposed")) return;
  else {
    log13.error("main @ uncaughtException:", err.message);
  }
});
process.on("unhandledRejection", (reason, promise) => {
  log13.error("main @ unhandledRejection: Unhandled promise rejection:", reason);
  if (reason instanceof Error) {
    log13.error("main @ unhandledRejection: Stack:", reason.stack);
  }
});
app10.on("render-process-gone", (event, webContents3, details) => {
  log13.error("main @ render-process-gone: Renderer process crashed");
  log13.error("main @ render-process-gone: Reason:", details.reason);
  log13.error("main @ render-process-gone: Exit code:", details.exitCode);
  const allWindows = BrowserWindow3.getAllWindows();
  const crashedWindow = allWindows.find((win) => win.webContents.id === webContents3.id);
  if (crashedWindow) {
    log13.error(`main @ render-process-gone: Window title: ${crashedWindow.getTitle()}`);
    if (crashedWindow === windowhandler_default.examwindow) {
      log13.warn("main @ render-process-gone: Exam window crashed, attempting to close gracefully");
      try {
        if (!crashedWindow.isDestroyed()) {
          crashedWindow.destroy();
        }
        windowhandler_default.examwindow = null;
        windowhandler_default.examDisplayId = null;
      } catch (err) {
        log13.error("main @ render-process-gone: Error closing exam window:", err);
      }
    }
  }
  event.preventDefault();
});
app10.on("child-process-gone", (event, details) => {
  log13.error("main @ child-process-gone: Child process crashed");
  log13.error("main @ child-process-gone: Type:", details.type);
  log13.error("main @ child-process-gone: Reason:", details.reason);
  log13.error("main @ child-process-gone: Exit code:", details.exitCode);
  event.preventDefault();
});
if (process.platform === "win32") {
  app10.setAppUserModelId(app10.getName());
}
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, options) => {
  if (warning && warning.includes && warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")) {
    return;
  }
  return originalEmitWarning.call(process, warning, options);
};
app10.on("certificate-error", (event, webContents3, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
app10.on("web-contents-created", (event, webContents3) => {
  webContents3.on("did-fail-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
    log13.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
  });
  webContents3.on("render-process-gone", (event2, details) => {
    log13.error("main @ webContents render-process-gone: Renderer process crashed for specific webContents");
    log13.error("main @ webContents render-process-gone: Reason:", details.reason);
    log13.error("main @ webContents render-process-gone: Exit code:", details.exitCode);
    const allWindows = BrowserWindow3.getAllWindows();
    const crashedWindow = allWindows.find((win) => win.webContents.id === webContents3.id);
    if (crashedWindow) {
      log13.error(`main @ webContents render-process-gone: Window title: ${crashedWindow.getTitle()}`);
      log13.error(`main @ webContents render-process-gone: Window URL: ${crashedWindow.webContents.getURL()}`);
      if (crashedWindow === windowhandler_default.examwindow) {
        log13.warn("main @ webContents render-process-gone: Exam window crashed, attempting to close gracefully");
        try {
          if (!crashedWindow.isDestroyed()) {
            crashedWindow.destroy();
          }
          windowhandler_default.examwindow = null;
          windowhandler_default.examDisplayId = null;
        } catch (err) {
          log13.error("main @ webContents render-process-gone: Error closing exam window:", err);
        }
      }
    }
    event2.preventDefault();
  });
});
app10.on("window-all-closed", () => {
  clearInterval(communicationhandler_default.updateStudentIntervall);
  windowhandler_default.mainwindow = null;
  app10.quit();
});
app10.on("before-quit", async () => {
  try {
    await session.defaultSession.clearStorageData({});
  } catch (err) {
    log13.error("main @ before-quit: Error clearing cache:", err);
  }
});
app10.on("activate", () => {
  const allWindows = BrowserWindow3.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    windowhandler_default.createMainWindow();
  }
});
async function runParentProcessCheck() {
  try {
    const result = await checkParentProcess();
    if (!result.success) {
      log13.error("main @ checkParent:", result.error);
      return;
    }
    if (result.foundBrowser) {
      log13.warn("main @ checkParent: The app was started directly from a browser");
      dialog3.showMessageBoxSync(windowhandler_default.mainwindow, {
        type: "question",
        buttons: ["OK"],
        title: "Terminate Program",
        message: "Unerlaubter Programmstart aus einem Webbrowser erkannt.\nNext-Exam wird beendet!"
      });
      windowhandler_default.mainwindow.allowexit = true;
      app10.quit();
    } else {
      log13.info("main @ checkparent: Parent Process Check OK");
    }
  } catch (error) {
    log13.error("main @ checkParent error:", error);
  }
}
app10.whenReady().then(async () => {
  nativeTheme.themeSource = "light";
  session.defaultSession.setUserAgent(`Next-Exam/${config_default.version} (${config_default.info}) ${process.platform}`);
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0);
  });
  windowhandler_default.createMainWindow();
  if (config_default.hostip == "127.0.0.1") {
    config_default.hostip = false;
  }
  if (config_default.hostip) {
    multicastclient_default.init(config_default.gateway);
  }
  const allowTray = !platformDispatcher_default._isGNOME();
  if (!config_default.development) {
    powerSaveBlocker.start("prevent-display-sleep");
    if (allowTray) {
      updateSystemTray("de");
    } else {
      log13.info("main @ tray: GNOME detected, skipping system tray");
    }
    runParentProcessCheck();
  }
  if (config_default.development) {
    globalShortcut2.register("CommandOrControl+Shift+G", () => {
      if (global && global.gc) {
        global.gc({ type: "mayor", execution: "async" });
        global.gc({ type: "minor", execution: "async" });
      }
    });
    globalShortcut2.register("CommandOrControl+Shift+T", () => {
      const win = BrowserWindow3.getFocusedWindow();
      if (win) {
        win.webContents.toggleDevTools();
      }
    });
  }
  globalShortcut2.register("CommandOrControl+R", () => {
  });
  globalShortcut2.register("F5", () => {
  });
  globalShortcut2.register("CommandOrControl+Shift+R", () => {
  });
  globalShortcut2.register("Alt+F4", () => {
  });
  globalShortcut2.register("CommandOrControl+W", () => {
  });
  globalShortcut2.register("CommandOrControl+Q", () => {
  });
  globalShortcut2.register("CommandOrControl+D", () => {
  });
  globalShortcut2.register("CommandOrControl+L", () => {
  });
  globalShortcut2.register("CommandOrControl+P", () => {
  });
  globalShortcut2.register("Alt+Left", () => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMudHMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvZW4uanNvbiIsICIuLi8uLi9zcmMvbG9jYWxlcy9kZS5qc29uIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLl9wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcbiAgICBcbiAgXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmZsYW1lc2hvdCA9IHRoaXMuX2dldFZlcnNpb24oJ2ZsYW1lc2hvdCcpO1xuICAgIHRoaXMuaW1hZ2VtYWdpY2sgPSB0aGlzLl9nZXRWZXJzaW9uKCdjb252ZXJ0Jyk7XG4gICAgdGhpcy5pbVZlcnNpb24gPSB0aGlzLl9nZXRJbWFnZU1hZ2lja1ZlcnNpb24oKTtcbiAgICB0aGlzLndvcmtlckZpbGVOYW1lID0gdGhpcy5fZ2V0V29ya2VyRmlsZU5hbWUoKTtcbiAgICB0aGlzLnVzZVdvcmtlciA9IHRoaXMuX2dldFVzZVdvcmtlcigpO1xuICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSB0aGlzLl9nZXRTY3JlZW5zaG90QWJpbGl0eSgpO1xuICAgIHRoaXMuanJlID0gdGhpcy5fZGV0ZWN0SlJFSWQoKTtcbiAgICB0aGlzLmpyZURpciA9IHRoaXMuX3Jlc29sdmVKUkVEaXIoKTtcbiAgICB0aGlzLmphdmFCaW4gPSB0aGlzLl9yZXNvbHZlSmF2YUJpbigpO1xuICAgIHRoaXMuanJlSW5mbyA9IHRoaXMuX2dldEpSRSgpO1xuICAgIFxuICAgIHRoaXMuaG9tZWRpcmVjdG9yeSA9IG9zLmhvbWVkaXIoKTtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgICB0aGlzLndvcmtlclVSTCA9IHRoaXMuX2dldFdvcmtlclVSTCgpO1xuICAgIHRoaXMudGVtcGRpcmVjdG9yeSA9IHRoaXMuX2dldFRlbXBkaXJlY3RvcnkoKTtcbiAgICB0aGlzLndvcmtkaXJlY3RvcnkgPSB0aGlzLl9nZXRXb3JrZGlyZWN0b3J5KCk7XG4gICAgdGhpcy5sb2dmaWxlID0gdGhpcy5fZ2V0TG9nZmlsZSgpO1xuXG4gIH1cblxuICBfZ2V0V29ya2RpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLmhvbWVkaXJlY3RvcnksIGNvbmZpZy5jbGllbnRkaXJlY3RvcnkpO1xuICB9XG5cbiAgX2dldFRlbXBkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4ob3MudG1wZGlyKCksICdleGFtLXRtcCcpO1xuICB9XG5cblxuICBfZ2V0TG9nZmlsZSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLndvcmtkaXJlY3RvcnksICduZXh0LWV4YW0tc3R1ZGVudC5sb2cnKTtcbiAgfVxuXG4gIF9ub3JtYWxpemVBcmNoKCkge1xuICAgIGlmICh0aGlzLl9hcmNoID09PSAnaWEzMicpIHJldHVybiAnaTU4Nic7XG4gICAgaWYgKFsneDY0JywgJ2FybTY0J10uaW5jbHVkZXModGhpcy5fYXJjaCkpIHJldHVybiB0aGlzLl9hcmNoO1xuICAgIHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZTogJHt0aGlzLl9hcmNofWApO1xuICB9XG5cbiAgX2RldGVjdEpSRUlkKCkge1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hcmNoID09PSAnYXJtNjQnID8gJ21pbmltYWwtanJlLTExLW1hYy1hcm02NCcgOiAnbWluaW1hbC1qcmUtMTEtbWFjJztcbiAgICB9XG4gIH1cblxuXG5cblxuXG4gIC8qKlxuICAgKiBcbiAgICogQHJldHVybnMge3N0cmluZ30gdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogQGRlc2NyaXB0aW9uIHRoaXMgZnVuY3Rpb24gcmVzb2x2ZXMgdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogaXQgZmlyc3QgY2hlY2tzIGlmIHRoZSB1c2VCdW5kbGVkSlJFIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHNldCB0byB0cnVlXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCBjaGVja3MgaWYgdGhlIHN5c3RlbSBqcmUgaXMgaW5zdGFsbGVkXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBzeXN0ZW0ganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiB0aGUgYnVuZGxlZCBqcmUgaXMgbG9jYXRlZCBpbiB0aGUgcHVibGljIGRpcmVjdG9yeSBvZiB0aGUgYXBwXG4gICAqIFxuICAgKiBGSVhNRTogaWYgc3lzdGVtIGpyZSBpcyBzZWxlY3RlZCBieSBFTlYgZG8gbm90IGluY2x1ZGUgdGhlIGpyZSBkaXJlY3RvcnkgaW4gdGhlIGZpbmFsIGJ1aWxkXG4gICAqL1xuXG4gIF9yZXNvbHZlSlJFRGlyKCkge1xuICAgIC8vIHVzZSBidW5kbGVkIGpyZSBiZWNhdXNlIGl0cyBzbWFsbGVyIGFuZCBwcm92aWRlcyBvbmx5IHRoZSBuZWVkZWQgamF2YSBtb2R1bGVzXG4gICAgaWYgKHByb2Nlc3MuZW52LnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogIWFwcC5pc1BhY2thZ2VkOiBcIiArIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInID8gJ3doZXJlIGphdmEnIDogJ3doaWNoIGphdmEnO1xuICAgICAgICBjb25zdCBqYXZhUGF0aCA9IGV4ZWNTeW5jKGphdmFDb21tYW5kLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuXG4gICAgICAgIGlmIChqYXZhUGF0aCkge1xuICAgICAgICAgIC8vIEdldCB0aGUgZGlyZWN0b3J5IGNvbnRhaW5pbmcgdGhlIGphdmEgZXhlY3V0YWJsZVxuICAgICAgICAgIGNvbnN0IGphdmFEaXIgPSBwYXRoLmRpcm5hbWUoamF2YVBhdGgpO1xuICAgICAgICAgIC8vIEdvIHVwIHRvIHRoZSBKUkUvSkRLIHJvb3QgKHVzdWFsbHkgMiBsZXZlbHMgdXAgZnJvbSBiaW4vKVxuICAgICAgICAgIGNvbnN0IGpyZVJvb3QgPSBwYXRoLmRpcm5hbWUocGF0aC5kaXJuYW1lKGphdmFEaXIpKTtcbiAgICAgICAgICByZXR1cm4ganJlUm9vdDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIEphdmEgbm90IGZvdW5kIGluIFBBVEhcbiAgICAgIH1cblxuICAgICAgLy8gSWYgbm8gSmF2YSBmb3VuZCwgZmFsbCBiYWNrIHRvIGJ1bmRsZWQgSlJFXG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBObyBzeXN0ZW0gSmF2YSBmb3VuZCwgZmFsbGluZyBiYWNrIHRvIGJ1bmRsZWQgSlJFXCIpO1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfcmVzb2x2ZUphdmFCaW4oKSB7XG4gICAgc3dpdGNoICh0aGlzLl9wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5fcGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtICE9PSAnbGludXgnKSByZXR1cm4gJ24vYSc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCcpIHJldHVybiAnd2F5bGFuZCc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAneDExJyB8fCB0aGlzLl9lbnYuRElTUExBWSkgcmV0dXJuICd4MTEnO1xuICAgIHJldHVybiAndW5rbm93bic7XG4gIH1cblxuICBfZ2V0VmVyc2lvbihjbWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoYCR7Y21kfSAtLXZlcnNpb25gLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkuc3BsaXQoJ1xcbicpWzBdO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvW1xcZF0rKFxcLltcXGRdKykrLyk7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbjogdmVyc2lvbj8uWzBdIHx8ICd1bmtub3duJyB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldEpSRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoJ2phdmEgLXZlcnNpb24nLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ2lnbm9yZScsICdwaXBlJ10gfSk7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC92ZXJzaW9uIFwiKFtcXGQuX10rKVwiLyk/LlsxXSB8fCAndW5rbm93bic7XG4gICAgICBjb25zdCBqYXZhSG9tZSA9IHRoaXMuX2Vudi5KQVZBX0hPTUUgfHwgJyc7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbiwgcGF0aDogamF2YUhvbWUgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCwgcGF0aDogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRXb3JrZXJGaWxlTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG5cbiAgICByZXR1cm4gcGF0aFRvRmlsZVVSTCh3b3JrZXJQYXRoKTtcbiAgfVxuXG4gIGlzV2F5bGFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJztcbiAgfVxuXG4gIF9pc0tERSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICByZXR1cm4gb3V0ID09PSAnS0RFJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0tERTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNHTk9NRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ2dub21lJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNHTk9NRTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNVTklUWSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ3VuaXR5Jyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc1VOSVRZOiBubyBkYXRhXCIsIGVycik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZsYW1lc2hvdEF2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJ3aGljaCBmbGFtZXNob3RcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9mbGFtZXNob3RBdmFpbGFibGU6IEZsYW1lc2hvdCBub3QgZm91bmRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX3NldHVwRGVza3RvcFBhdGgoKSB7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gIH1cblxuICBfZ2V0RGVza3RvcFBhdGgoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBpZiAoKHRoaXMuX2lzR05PTUUoKSB8fCB0aGlzLl9pc1VOSVRZKCkpICYmIHRoaXMuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBHTk9NRS9Vbml0eSArIFdheWxhbmQgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc0tERSgpICYmIHRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy5fZmxhbWVzaG90QXZhaWxhYmxlKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBLREUvV2F5bGFuZCArIEZsYW1lc2hvdCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLnVzZVdvcmtlcikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFgxMSArIEltYWdlTWFnaWNrIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZSBcdTIwMTMgZmFsbGJhY2sgdG8gcGFnZWNhcHR1cmVcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IHBsYXRmb3JtRGlzcGF0Y2hlciA9IG5ldyBQbGF0Zm9ybURpc3BhdGNoZXIoKTtcbmV4cG9ydCBkZWZhdWx0IHBsYXRmb3JtRGlzcGF0Y2hlcjtcbiIsICJcbi8qKlxuICogRE8gTk9UIEVESVQgLSB0aGlzIGZpbGUgaXMgd3JpdHRlbiBieSBwcmVidWlsZC5qcyB2aWEgZWxlY3Ryb24tYnVpbGRlci5lbnYgLSBlZGl0IHZhcnMgaW4gZWxlY3Ryb24tYnVpbGRlci5lbnYgZmlsZSFcbiAqL1xuXG5jb25zdCBjb25maWcgPSB7XG4gICAgZGV2ZWxvcG1lbnQ6IHRydWUsICAvLyBkaXNhYmxlIGtpb3NrIG1vZGUgb24gZXhhbSBtb2RlIGFuZCBvdGhlciBzdHVmZiAoYXV0b2ZpbGwgaW5wdXQgZmllbGRzKVxuICAgIHNob3dkZXZ0b29sczogdHJ1ZSxcbiAgICB1c2VCdW5kbGVkSlJFOiB0cnVlLFxuICAgIGJpcEludGVncmF0aW9uOiBmYWxzZSxcbiAgICBiaXBEZW1vOiBmYWxzZSxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIGVsZWN0cm9uOiBmYWxzZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzEuMS4wLjE4JyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDExOScsXG4gICAgYnVpbGROdW1iZXI6ICcxOCcsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgcG93ZXJTYXZlQmxvY2tlciwgbmF0aXZlVGhlbWUsIGdsb2JhbFNob3J0Y3V0LCBUcmF5LCBNZW51LCBkaWFsb2csIHNlc3Npb259IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCAqIGFzIGZzRXh0cmEgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3RyYXltZW51LmpzJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tQYXJlbnRQcm9jZXNzIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMnO1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuZWxlY3Ryb24gPSB0cnVlXG5cbmNvbmZpZy5ob21lZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnk7XG5jb25maWcud29ya2RpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZGlyZWN0b3J5O1xuY29uZmlnLnRlbXBkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeTtcbmNvbmZpZy5leGFtZGlyZWN0b3J5ID0gY29uZmlnLndvcmtkaXJlY3RvcnkgICAgLy8gd2UgbmVlZCB0aGlzIHZhcmlhYmxlIHNldHVwIGV2ZW4gaWYgd2UgZG8gbm90IGNvbm5lY3QgdG8gYSB0ZWFjaGVyIGluc3RhbmNlXG5cblxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIENoZWNrIGlmIHRoZSBkZXNrdG9wIGZvbGRlciBleGlzdHMgYW5kIGNyZWF0ZSBpZiBpdCBkb2Vzbid0XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGluayB0byB0aGUgd29ya2RpcmVjdG9yeSBvbiB0aGUgZGVza3RvcFxuY29uc3QgbGlua1BhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoLCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbiBAIGNyZWF0ZS1zeW1saW5rOiBjYW4ndCBjcmVhdGUgc3ltbGlua1wiKX1cblxuXG50cnkgeyAvL2JpbmQgdG8gdGhlIGNvcnJlY3QgaW50ZXJmYWNlXG4gICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlfSA9IGdhdGV3YXk0c3luYygpOyBcbiAgICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSkgICAgLy8gdGhpcyByZXR1cm5zIHRoZSBpcCBvZiB0aGUgaW50ZXJmYWNlIHRoYXQgaGFzIGEgZGVmYXVsdCBnYXRld2F5Li4gIHNob3VsZCB3b3JrIGluIE1PU1QgY2FzZXMuICBwcm9iYWJseSBwcm92aWRlIFwiaXAtb3B0aW9uc1wiIGluIFVJID9cbiAgICBjb25maWcuZ2F0ZXdheSA9IHRydWVcbn1cbiBjYXRjaCAoZSkge1xuICAgbG9nLmVycm9yKFwibWFpbiBAIGdhdGV3YXk0c3luYzogdW5hYmxlIHRvIGRldGVybWluZSBkZWZhdWx0IGdhdGV3YXlcIilcbiAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgXG4gICBsb2cuaW5mbyhgbWFpbjogSVAgJHtjb25maWcuaG9zdGlwfWApXG4gICBjb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gfVxuXG5cbmZzRXh0cmEuZW1wdHlEaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSAgLy8gY2xlYW4gdGVtcCBkaXJlY3RvcnlcblxuXG5cblxuXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZmFpbC1sb2FkJywgKGV2ZW50LCBlcnJvckNvZGUsIGVycm9yRGVzY3JpcHRpb24sIHZhbGlkYXRlZFVSTCwgaXNNYWluRnJhbWUsIGZyYW1lUHJvY2Vzc0lkLCBmcmFtZVJvdXRpbmdJZCkgPT4ge1xuICAgICAgICAvLyBMb2cgdGhlIGVycm9yIGJ1dCBkb24ndCBjcmFzaCB0aGUgYXBwXG4gICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcblxuICAgIH0pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgKCkgPT4geyAgLy8gaWYgd2luZG93IGlzIGNsb3NlZFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcbiAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpeyBhcHAucXVpdCgpIH1cbiAgICBhcHAucXVpdCgpICAgXG59KVxuXG5hcHAub24oJ2JlZm9yZS1xdWl0JywgYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7fSk7IC8vIGNsZWFyIGNvb2tpZXMsIGNhY2hlLCBsb2NhbFN0b3JhZ2UgZXRjLlxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBiZWZvcmUtcXVpdDogRXJyb3IgY2xlYXJpbmcgY2FjaGU6JywgZXJyKTtcbiAgICB9XG4gIH0pO1xuXG5hcHAub24oJ2FjdGl2YXRlJywgKCkgPT4ge1xuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKVxuICAgIGlmIChhbGxXaW5kb3dzLmxlbmd0aCkgeyBhbGxXaW5kb3dzWzBdLmZvY3VzKCkgfSBcbiAgICBlbHNlIHsgV2luZG93SGFuZGxlci5jcmVhdGVNYWluV2luZG93KCkgfVxufSlcblxuLyoqXG4gKiBDaGVjayBpZiB0aGUgYXBwIHdhcyBzdGFydGVkIGZyb20gd2l0aGluIGEgYnJvd3NlciBhbmQgcXVpdCBpZiBkZXRlY3RlZFxuICovXG5hc3luYyBmdW5jdGlvbiBydW5QYXJlbnRQcm9jZXNzQ2hlY2soKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hlY2tQYXJlbnRQcm9jZXNzKCk7XG4gICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIGNoZWNrUGFyZW50OicsIHJlc3VsdC5lcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVzdWx0LmZvdW5kQnJvd3Nlcikge1xuICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCBjaGVja1BhcmVudDogVGhlIGFwcCB3YXMgc3RhcnRlZCBkaXJlY3RseSBmcm9tIGEgYnJvd3NlcicpO1xuICAgICAgICAgICAgZGlhbG9nLnNob3dNZXNzYWdlQm94U3luYyhXaW5kb3dIYW5kbGVyLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Rlcm1pbmF0ZSBQcm9ncmFtJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnVW5lcmxhdWJ0ZXIgUHJvZ3JhbW1zdGFydCBhdXMgZWluZW0gV2ViYnJvd3NlciBlcmthbm50Llxcbk5leHQtRXhhbSB3aXJkIGJlZW5kZXQhJyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7XG4gICAgICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nLmluZm8oJ21haW4gQCBjaGVja3BhcmVudDogUGFyZW50IFByb2Nlc3MgQ2hlY2sgT0snKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIGNoZWNrUGFyZW50IGVycm9yOicsIGVycm9yKTtcbiAgICB9XG59XG5cbmFwcC53aGVuUmVhZHkoKVxuLnRoZW4oYXN5bmMgKCk9PntcblxuICAgIG5hdGl2ZVRoZW1lLnRoZW1lU291cmNlID0gJ2xpZ2h0JyAgLy8gcHJldmVudCB0aGVtZSBzZXR0aW5ncyBmcm9tIGJlaW5nIGFkb3B0ZWQgZnJvbSB3aW5kb3dzXG4gICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRVc2VyQWdlbnQoYE5leHQtRXhhbS8ke2NvbmZpZy52ZXJzaW9ufSAoJHtjb25maWcuaW5mb30pICR7cHJvY2Vzcy5wbGF0Zm9ybX1gKTsgIC8vIHNldCB1c2VyIGFnZW50IGZvciBhbGwgc2Vzc2lvbnNcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldENlcnRpZmljYXRlVmVyaWZ5UHJvYygocmVxdWVzdCwgY2FsbGJhY2spID0+IHsgY2FsbGJhY2soMCk7IH0pOyAgIC8vIHNldCBjZXJ0aWZpY2F0ZSB2ZXJpZmljYXRpb24gZ2xvYmFsbHkgZm9yIGFsbCBzZXNzaW9uc1xuXG4gICBcbiAgICAvKioqKioqKiBDcmVhdGUgbWFpbiB3aW5kb3cgKioqKioqKi9cbiAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKVxuXG5cbiAgICBpZiAoY29uZmlnLmhvc3RpcCA9PSBcIjEyNy4wLjAuMVwiKSB7IGNvbmZpZy5ob3N0aXAgPSBmYWxzZSB9XG4gICAgaWYgKGNvbmZpZy5ob3N0aXApIHsgbXVsdGljYXN0Q2xpZW50LmluaXQoY29uZmlnLmdhdGV3YXkpICB9IC8vbXVsdGljYXN0IGNsaWVudCBvbmx5IHRyYWNrcyBvdGhlciBleGFtIGluc3RhbmNlcyBvbiB0aGUgbmV0d29ya1xuXG4gICAgY29uc3QgYWxsb3dUcmF5ID0gIXBsYXRmb3JtRGlzcGF0Y2hlci5faXNHTk9NRSgpOyAvLyBHTk9NRSBoaWRlcyBsZWdhY3kgdHJheVxuICAgIGlmICghY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgcG93ZXJTYXZlQmxvY2tlci5zdGFydCgncHJldmVudC1kaXNwbGF5LXNsZWVwJykgICAvLyBwcmV2ZW50IHRoZSBkZXZpY2UgZnJvbSBnb2luZyB0byBzbGVlcFxuICAgICAgICBpZiAoYWxsb3dUcmF5KSB7IHVwZGF0ZVN5c3RlbVRyYXkoJ2RlJyk7IH0gICAgICAgIC8vIHNraXAgdHJheSBvbiBHTk9NRVxuICAgICAgICBlbHNlIHsgbG9nLmluZm8oJ21haW4gQCB0cmF5OiBHTk9NRSBkZXRlY3RlZCwgc2tpcHBpbmcgc3lzdGVtIHRyYXknKTsgfVxuICAgICAgICBydW5QYXJlbnRQcm9jZXNzQ2hlY2soKTsgIC8vIHRoaXMgY2hlY2tzIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIChkaXJlY3RseSBhZnRlciBkb3dubG9hZClcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K0cnLCAoKSA9PiB7ICBpZiAoZ2xvYmFsICYmIGdsb2JhbC5nYyl7IGdsb2JhbC5nYyh7dHlwZTonbWF5b3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyBnbG9iYWwuZ2Moe3R5cGU6J21pbm9yJyxleGVjdXRpb246ICdhc3luYyd9KTsgIH19KTtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVCcsICgpID0+IHsgIGNvbnN0IHdpbiA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpOyBpZiAod2luKSB7IHdpbi53ZWJDb250ZW50cy50b2dnbGVEZXZUb29scygpIH19KTtcbiAgICB9XG5cbiAgICAvL3RoZXNlIGFyZSBzb21lIHNob3J0Y3V0cyB3ZSB0cnkgdG8gY2FwdHVyZVxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1InLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0Y1JywgKCkgPT4ge30pOyAgLy9yZWxvYWQgcGFnZVxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1InLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtGNCcsICgpID0+IHt9KTsgIC8vZXhpdCBhcHBcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtXJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1EnLCAoKSA9PiB7fSk7ICAvL3F1aXRcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtEJywgKCkgPT4ge30pOyAgLy9zaG93IGRlc2t0b3BcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtMJywgKCkgPT4ge30pOyAgLy9sb2Nrc2NyZWVuXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUCcsICgpID0+IHt9KTsgIC8vY2hhbmdlIHNjcmVlbiBsYXlvdXRcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0xlZnQnLCAoKSA9PiB7ICByZXR1cm4gZmFsc2UgfSk7ICAvLyBOYXZpZ2F0aW9uIGF0dGVtcHQgYmxvY2tlZFxufSkiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnOyAgLy8gbm9kZSBub3QgdnVlIChyZWxhdGl2ZSBwYXRoIG5lZWRlZClcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG4vKipcbiAqIFNUT1JFUyBBTEwgQ0xJRU5UL1NlcnZlciBJTkZPUk1BVElPTlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgbGlzdGVucyBmb3IgbXVsaXRjYXN0IG1lc3NhZ2VzXG4gKi9cblxuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSBjb25maWcubXVsdGljYXN0U2VydmVyQWRyclxuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMuY2xpZW50aW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IFwiRGVtb1VzZXJcIixcbiAgICAgICAgICAgIHRva2VuOiBmYWxzZSxcbiAgICAgICAgICAgIGlwOiBmYWxzZSwgIC8vIGlwIGFkZHJlc3Mgd2lyZCB2b20gbXVsdGljYXN0c2VydmVyIHRlYWNoZXIgbWl0IGdlc2NoaWNrdFxuICAgICAgICAgICAgaG9zdG5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2VydmVyaXA6IGZhbHNlLCAgIC8vIHdpcmQgbG9rYWwgZ2VzZXR6dCAoaXN0IGFiZXIgbG9naXNjaGVyd2Vpc2UgZ2xlaWNoIGRlciBpcCBkZXMgbXVsdGljYXN0c2VydmVycylcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IGZhbHNlLFxuICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgICAgICBleGFtdHlwZSA6IGZhbHNlLFxuICAgICAgICAgICAgcGluOiBmYWxzZSxcbiAgICAgICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICAgICAgbXNvZmZpY2VzaGFyZTogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDQwMDAsICAgLy9taWxsaXNlY29uZHNcbiAgICAgICAgICAgIHByaW50cmVxdWVzdCA6IGZhbHNlLFxuICAgICAgICAgICAgcHJpdmF0ZVNwZWxsY2hlY2s6IHthY3RpdmF0ZWQ6IGZhbHNlfSxcbiAgICAgICAgICAgIGxvY2FsTG9ja2Rvd246IGZhbHNlLFxuICAgICAgICAgICAgZ3JvdXA6ICdhJyxcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IDBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBhbmQgcmVhY3RzIG9uIGluZm9ybWF0aW9uIGdpdmVuIGJ5IHRoZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKSAgLy8gbW92aW5nIHRoaXMgaGVyZSB3aWxsIGFsbG93IHRvIHJlc3Bhd24gaXQgaWYgYmluZGluZyBmYWlsc1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5iaW5kKHRoaXMuUE9SVCwgJzAuMC4wLjAnLCAgKCkgPT4geyBcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRNdWx0aWNhc3RUVEwoMTI4KTsgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2F0ZXdheSkge3RoaXMuY2xpZW50LmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUil9IC8vIGVzIGlzdCBmXHUwMEZDciBlaW4gdmVybFx1MDBFNHNzbGljaGVzIG11bHRpY2FzdCBzaW5udm9sbCBkZXIgZ3J1cHBlIGJlaXp1dHJldGVuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm1jY2xpZW50OiBObyBHYXRld2F5ISBTdGFydGluZyBNdWx0aWNhc3RDbGllbnQgd2l0aG91dCBhZGRpbmcgZ3JvdXAgbWVtYmVyc2hpcFwiKX1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLmNsaWVudC5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7IFxuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWxpdGNhc3RjbGllbnQgQCBpbml0OiAke2V9YCkgXG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcbiBcbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgXG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnJlYWNoYWJsZSA9IHRydWVcbiAgICAgICAgc2VydmVySW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vcmVjb3JkIHRpbWVzdGFtcCBvZiBsYXN0IG1lc3NhZ2UgZnJvbSBzZXJ2ZXIgKGlnbm9yZSBzZXJ2ZXJ0aW1lc3RhbXAgYmVjYXVzZSBpdCBtYXkgaGF2ZSBhIGRpZmZlcmVudCBzeXN0ZW0gdGltZSlcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmlzTmV3RXhhbUluc3RhbmNlKHNlcnZlckluZm8pKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgbWVzc2FnZVJlY2VpdmVkOiBBZGRpbmcgbmV3IEV4YW0gSW5zdGFuY2UgXCIke3NlcnZlckluZm8uc2VydmVybmFtZX1cIiB0byBTZXJ2ZXJsaXN0YClcbiAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QucHVzaChzZXJ2ZXJJbmZvKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHRoZSBtZXNzYWdlIGNhbWUgZnJvbSBhIG5ldyBleGFtIGluc3RhbmNlIG9yIGFuIG9sZCBvbmUgdGhhdCBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBpc05ld0V4YW1JbnN0YW5jZSAob2JqKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbVNlcnZlckxpc3RbaV0uaWQgPT09IG9iai5pZCkge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oJ2V4aXN0aW5nIHNlcnZlciAtIHVwZGF0aW5nIHRpbWVzdGFtcCcpXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG5cbiAgICAgICAgICAgIGlmIChub3cgLSAxNjAwMCA+IHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYG11bHRpY2FzdGNsaWVudCBAIGlzRGVwcmVjYXRlZEluc3RhbmNlOiBSZW1vdmluZyBpbmFjdGl2ZSBzZXJ2ZXIgJyR7dGhpcy5leGFtU2VydmVyTGlzdFtpXS5zZXJ2ZXJuYW1lfScgZnJvbSBsaXN0YClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnNwbGljZShpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVsdGljYXN0Q2xpZW50KClcbiIsICJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuXG5leHBvcnQgY2xhc3MgU2NoZWR1bGVyU2VydmljZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICBhY3Rpb246ICgpID0+IHZvaWQ7XG4gICAgaGFuZGxlOiBOb2RlSlMuVGltZXI7XG4gICAgaW50ZXJ2YWw6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFjdGlvbjogKCkgPT4gdm9pZCwgbXM6IG51bWJlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBtcztcbiAgICAgICAgdGhpcy5hZGRMaXN0ZW5lcigndGltZW91dCcsIHRoaXMuYWN0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5lbWl0KCd0aW1lb3V0JyksIHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5cbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQnJvd3NlclZpZXcsIGRpYWxvZywgc2NyZWVufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJyBcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcblxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCB7IGFjdGl2ZVdpbmRvdyB9IGZyb20gJ2dldC13aW5kb3dzJztcbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQge2ZpbGVVUkxUb1BhdGh9IGZyb20gXCJub2RlOnVybFwiO1xuXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cblxuXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gV2luZG93IGhhbmRsaW5nIChpcGNSZW5kZXJlciBQcm9jZXNzIC0gRnJvbnRlbmQpIFNUQVJUXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuXG5jbGFzcyBXaW5kb3dIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja1dpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMubWFpbndpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2VydmVkIGRpc3BsYXkgSUQgZm9yIGV4YW0gd2luZG93IChzZXQgaW1tZWRpYXRlbHkgd2hlbiB3aW5kb3cgaXMgY3JlYXRlZClcbiAgICAgIHRoaXMuc3BsYXNod2luID0gbnVsbFxuICAgICAgdGhpcy5iaXB3aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgIFxuICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgZXhpdCB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgZXhpdCBxdWVzdGlvbiBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIG1pbmltaXplIHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICB9XG5cbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy53aW5kb3dUcmFja2VyLmJpbmQodGhpcyksIDEwMDApXG4gICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgIH1cblxuICAgIC8vIHJldHVybiBlbGVjdHJvbiB3aW5kb3cgaW4gZm9jdXMgb3IgYW4gb3RoZXIgZWxlY3Ryb24gd2luZG93IGRlcGVuZGluZyBvbiB0aGUgaGllcmFjaHlcbiAgICBnZXRDdXJyZW50Rm9jdXNlZFdpbmRvdygpIHtcbiAgICAgICAgY29uc3QgZm9jdXNlZFdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICAgICAgICBpZiAoZm9jdXNlZFdpbmRvdykge1xuICAgICAgICAgIHJldHVybiBmb2N1c2VkV2luZG93XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zY3JlZW5sb2NrV2luZG93KXtyZXR1cm4gdGhpcy5zY3JlZW5sb2NrV2luZG93fVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5leGFtd2luZG93KXtyZXR1cm4gdGhpcy5leGFtd2luZG93fVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5tYWlud2luZG93KXtyZXR1cm4gdGhpcy5tYWlud2luZG93fVxuICAgICAgICAgICAgZWxzZSB7IHJldHVybiBmYWxzZSB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpIHtcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTAwMCxcbiAgICAgICAgICAgIGhlaWdodDo4MDAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwiZGlkLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2lsbC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7ICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGxvZy5pbmZvKFwibmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ0YXJnZXQ6IF9ibGFua1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtcmVkaXJlY3QnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ1JlZGlyZWN0aW5nIHRvOicsIHVybCk7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgZGllIFVSTCBkYXMgZ2V3XHUwMEZDbnNjaHRlIEZvcm1hdCBoYXRcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnYmlsZHVuZ3Nwb3J0YWw6Ly8nKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcnQgZGVuIFN0YW5kYXJkLVJlZGlyZWN0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gJ2JpbGR1bmdzcG9ydGFsOi8vdG9rZW49JztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdXJsLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8odG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiaXBUb2tlbicsIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiB0aGlzIGlzIGFuIGVhc3RlciBlZ2dcbiAgICAgKi9cbiAgICBjcmVhdGVFYXN0ZXJXaW4oKSB7XG4gICAgICAgIHRoaXMuZWFzdGVyd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDc2OCxcbiAgICAgICAgICAgIGhlaWdodDo0ODAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi5sb2FkRmlsZShqb2luKF9fZGlybmFtZSwgYC4uLy4uL3B1YmxpYy9jb3dzb25pY2UvaW5kZXguaHRtbGApKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgbGV0IHVybCA9IFwibm90Zm91bmRcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJsb2Nrd2luLnJlbW92ZU1lbnUoKSBcbiAgICAgICAgYmxvY2t3aW4uc2V0TWluaW1pemFibGUoZmFsc2UpXG5cbiAgICAgICAgLy8gUG9zaXRpb24gd2luZG93IG9uIHNwZWNpZmljIGRpc3BsYXkgQkVGT1JFIHNob3dpbmcgaXRcbiAgICAgICAgYmxvY2t3aW4uc2V0Qm91bmRzKHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLngsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55LFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYmxvY2t3aW4uc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgIGJsb2Nrd2luLnNob3coKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTtcbiAgICAgICAgICAgIGJsb2Nrd2luLm9uKCdsZWF2ZS1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpOyAvLyBzb2ZvcnQgd2llZGVyIHp1clx1MDBGQ2Nrc2V0emVuXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgIH0gIFxuICAgICAgICBlbHNlIHsgICBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEtpb3NrKHRydWUpOyAvLyBLaW9zayA9IFwidGFrZSBvdmVyIG1haW4gc2NyZWVuXCIuIG9uIG1hY29zIHRoYXQncyB3aHkgd2UgdXNlIGZ1bGxTY3JlZW4gd29ya2Fyb3VuZCB3aXRoIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIH1cbiAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICBibG9ja3dpbi5kaXNwbGF5ID0gZGlzcGxheVxuICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5wdXNoKGJsb2Nrd2luKVxuICAgIH1cblxuXG4gICAgLy8gYmxvY2sgYWxsIHNjcmVlbnMgd2l0aCBhIGJsb2Nrd2luZG93XG4gICAgYXN5bmMgaW5pdEJsb2NrV2luZG93cygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAvL2xvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZm91bmQgJHtkaXNwbGF5cy5sZW5ndGh9IGRpc3BsYXlzYClcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgIC8vIGxvY2sgYWxsIHNjcmVlbnNcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGV4YW0gd2luZG93IHRvIGJlIHZpc2libGUgYW5kIHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0cmllcyA9IDBcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTBcbiAgICAgICAgICAgICAgICB3aGlsZSAoIXRoaXMuZXhhbXdpbmRvdy5pc1Zpc2libGUoKSAmJiByZXRyaWVzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMClcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllcysrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFkZGl0aW9uYWwgd2FpdCB0byBlbnN1cmUgcG9zaXRpb25pbmcgaXMgY29tcGxldGUgb24gV2F5bGFuZFxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgYmxvY2sgd2luZG93cyBmcm9tIGFycmF5XG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IHRoaXMuYmxvY2t3aW5kb3dzLmZpbHRlcihibG9ja3dpbiA9PiBibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGFsbCBleGlzdGluZyB3aW5kb3dzIGFuZCBkZXRlcm1pbmUgdGhlaXIgZGlzcGxheXNcbiAgICAgICAgICAgIGNvbnN0IHVzZWREaXNwbGF5SWRzID0gbmV3IFNldCgpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpcnN0LCB1c2UgdGhlIHJlc2VydmVkIGV4YW0gZGlzcGxheSBJRCAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gZXhhbSB3aW5kb3cgd2FzIGNyZWF0ZWQpXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIHNjcmVlbiBpcyByZXNlcnZlZCBldmVuIGlmIHRoZSB3aW5kb3cgaXNuJ3QgZnVsbHkgaW5pdGlhbGl6ZWQgeWV0XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtRGlzcGxheUlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHRoaXMuZXhhbURpc3BsYXlJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWx3YXlzIGV4Y2x1ZGUgcHJpbWFyeSBkaXNwbGF5IChleGFtIHdpbmRvdyBsb2NhdGlvbilcbiAgICAgICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmIChwcmltYXJ5RGlzcGxheSAmJiBwcmltYXJ5RGlzcGxheS5pZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChwcmltYXJ5RGlzcGxheS5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgZXhhbSB3aW5kb3cgZGlzcGxheSAoYXMgZmFsbGJhY2svdmVyaWZpY2F0aW9uLCBidXQgcmVzZXJ2ZWQgSUQgdGFrZXMgcHJpb3JpdHkpXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGV4YW0gd2luZG93IGlzIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgZXhhbSB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGJsb2NrIHdpbmRvd3MgZGlzcGxheXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmxvY2t3aW4gb2YgdGhpcy5ibG9ja3dpbmRvd3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBibG9ja3dpbi5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGJsb2NrIHdpbmRvdyBmb3VuZCBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGJsb2NrIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIGJsb2NrIHdpbmRvd3MgZm9yIGRpc3BsYXlzIHRoYXQgZG9uJ3QgaGF2ZSBleGFtIG9yIGJsb2NrIHdpbmRvd3NcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIGlmICh1c2VkRGlzcGxheUlkcy5oYXMoZGlzcGxheS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBza2lwcGluZyBkaXNwbGF5ICR7ZGlzcGxheS5pZH0gLSBhbHJlYWR5IGhhcyBleGFtIG9yIGJsb2NrIHdpbmRvd2ApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGNyZWF0ZSBibG9ja3dpbiBvbjpcIixkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgIHRoaXMubmV3QmxvY2tXaW4oZGlzcGxheSkgIC8vIGFkZCBibG9ja3dpbmRvd3MgZm9yIGRpc3BsYXlzIHdpdGhvdXQgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MuZm9yRWFjaCggKGJsb2Nrd2luKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU2NyZWVubG9jayBXaW5kb3cgKHRvIGNvdmVyIHRoZSBtYWluc2NyZWVuKSAtIGJsb2NrIHN0dWRlbnRzIGZyb20gd29ya2luZ1xuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIGNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkge1xuICAgICAgICBsZXQgc2NyZWVubG9ja1dpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogdGhpcy5tYWlud2luZG93LCAgIC8vIGxlYWRzIHRvIHZpc2libGUgdGl0bGViYXIgaW4gZ25vbWUtZGVza3RvcFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnU2NyZWVubG9jaycsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgLy9mb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHVybCA9IFwibG9ja1wiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICAvLyBBZGQgd2luZG93IHRvIGFycmF5IGZpcnN0LCBiZWZvcmUgYWRkaW5nIGJsdXIgbGlzdGVuZXJcbiAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5wdXNoKHNjcmVlbmxvY2tXaW5kb3cpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzY3JlZW5sb2NrV2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJwb3AtdXAtbWVudVwiLCAxKSAgIC8vYWJvdmUgZXhhbSB3aW5kb3cgKHBvcC11cC1tZW51LCAwKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRDbG9zYWJsZSh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUpOyAvLyBwdXQgdGhlIHdpbmRvdyBvbiBhbGwgdmlydHVhbCB3b3Jrc3BhY2VzXG4gICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcihcInNjcmVlbmxvY2tcIilcbiAgICAgICAgfSlcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfSAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHsgICAvLyByZW1vdmUgd2luZG93IGZyb20gYXJyYXkgd2hlbiBhY3R1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmIHdpbiAhPT0gc2NyZWVubG9ja1dpbmRvdyAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBFeGFtd2luZG93XG4gICAgICogQHBhcmFtIGV4YW10eXBlIGVkdXZpZHVhbCwgbWF0aCwgbGFuZ3VhZ2VcbiAgICAgKiBAcGFyYW0gdG9rZW4gc3R1ZGVudCB0b2tlblxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgY29udGFpbmluZyBpbmZvIGFib3V0IHNwZWxsY2hlY2sgbGFuZ3VhZ2UgZXRjLiBcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVFeGFtV2luZG93KGV4YW10eXBlLCB0b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5ZGlzcGxheSkge1xuICAgICAgICAvLyBqdXN0IHRvIGJlIHN1cmUgd2UgY2hlY2sgc29tZSBpbXBvcnRhbnQgdmFycyBoZXJlXG4gICAgICAgIGlmIChleGFtdHlwZSAhPT0gXCJyZHBcIiAmJiBleGFtdHlwZSAhPT0gXCJ3ZWJzaXRlXCIgJiYgIGV4YW10eXBlICE9PSBcImdmb3Jtc1wiICYmIGV4YW10eXBlICE9PSBcImVkdXZpZHVhbFwiICYmIGV4YW10eXBlICE9PSBcImVkaXRvclwiICYmIGV4YW10eXBlICE9PSBcIm1hdGhcIiAmJiBleGFtdHlwZSAhPT0gXCJtaWNyb3NvZnQzNjVcIiAmJiBleGFtdHlwZSAhPT0gXCJhY3RpdmVzaGVldHNcIiB8fCAhdG9rZW4peyAgLy8gZm9yIG5vdy4uIHdlIHByb2JhYmx5IHNob3VsZCBzdG9wIGV2ZXJ5dGhpbmcgaGVyZVxuICAgICAgICAgICAgbG9nLndhcm4oXCJtaXNzaW5nIHBhcmFtZXRlcnMgZm9yIGV4YW0tbW9kZSBvciBtb2RlIG5vdCBpbiBhbGxvd2VkIGxpc3QhXCIpXG4gICAgICAgICAgICBleGFtdHlwZSA9IFwiZWRpdG9yXCIgXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICAvLyBBbHdheXMgdXNlIHByaW1hcnkgZGlzcGxheSBmb3IgZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzIHx8ICFwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gZGlzcGxheXNbMF0gfHwgcHJpbWFyeWRpc3BsYXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gSW1tZWRpYXRlbHkgcmVzZXJ2ZSB0aGUgZGlzcGxheSBJRCBmb3IgdGhlIGV4YW0gd2luZG93IChiZWZvcmUgd2luZG93IGlzIGZ1bGx5IGluaXRpYWxpemVkKVxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIGJsb2NrIHdpbmRvd3MgZnJvbSBiZWluZyBjcmVhdGVkIG9uIHRoZSBzYW1lIHNjcmVlblxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IHByaW1hcnlkaXNwbGF5LmlkXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IHJlc2VydmluZyBkaXNwbGF5ICR7dGhpcy5leGFtRGlzcGxheUlkfSBmb3IgZXhhbSB3aW5kb3dgKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgcHggPSAwXG4gICAgICAgIGxldCBweSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcyAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCkge1xuICAgICAgICAgICAgcHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueFxuICAgICAgICAgICAgcHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogcHggKyAwLFxuICAgICAgICAgICAgeTogcHkgKyAwLFxuICAgICAgICAgICAgdGl0bGU6ICdFeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiAxNDQwLFxuICAgICAgICAgICAgaGVpZ2h0OiA3NjgsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHdpbiwgIC8vdGhpcyBkb2VzbnQgd29yayB0b2dldGhlciB3aXRoIGtpb3NrIG9uIHVidW50dSBnbm9tZSA/PyB3dGZcbiAgICAgICAgICAgIC8vIG1vZGFsOiB0cnVlLCAgLy8gdGhpcyBibG9ja3MgdGhlIG1haW4gd2luZG93IG9uIHdpbmRvd3Mgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIG9wZW5cbiAgICAgICAgICAgIC8vIGNsb3NhYmxlOiBmYWxzZSwgIC8vIGlmIHdlIGNhbid0IGRlZmluZSAncGFyZW50JyB0aGlzIHdpbmRvdyBoYXMgdG8gYmUgY2xvc2FibGUgLSB3aHk/XG4gICAgICAgICAgICAvL2Fsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgb3BhY2l0eTogMSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICB2aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAga2lvc2s6IHRoaXMuY29uZmlnLmRldmVsb3BtZW50ID8gZmFsc2UgOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZXhhbXdpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZU1lbnUoKSAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZm9jdXMoKVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1dheWxhbmQpeyB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RhcnQoKSB9IC8vIGNvbnN0YW50bHkgY2hlY2sgaWYgdGhlIGFjdGl2ZSB3aW5kb3cgaXMgdGhlIGV4YW13aW5kb3cgLSBpZiBub3QsIGJyaW5nIGl0IHRvIGZyb250XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZVJlc3RyaWN0aW9ucyh0aGlzKSAgLy8gZGlzYWJsZSBrZXlib2FyZCBzaG9ydGN1dHMgZXRjLlxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKSAgLy8gZG8gbm90IHNldCBibHVyIGxpc3RlbmVyIHRvbyBlYXJseVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcigpICAvLyBhZGQgYmx1ciBsaXN0ZW5lciB0byB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKFwid2luZG93aGFuZGxlciBAIGRpZC1maW5pc2gtbG9hZDogZXJyb3IgaW4gZXhhbXdpbmRvdyBzZXR1cFwiLCBlKX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXJ2ZXJzdGF0dXMgPSBzZXJ2ZXJzdGF0dXMgLy93ZSBrZWVwIGl0IHRoZXJlIHRvIG1ha2UgaXQgYWNjZXNzYWJsZSB2aWEgZXhhbXdpbmRvdyBpbiBpcGNIYW5kbGVyXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0ID0gOTQgICAvLyBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIGNvbnRlbnQgdmlld1xuICAgICAgICBcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWljcm9zb2Z0IDM2NSBlbWViZWRzIGl0cyBlZGl0b3IgaW4gYW4gaWZyYW1lIHdpdGggYWN0aXZlIENvbnRlbnQgU2VjdXJpdHkgUG9saWN5IChDU1ApXG4gICAgICAgICAqIFRoZSBvbmx5IHdheSB0byBiZSBhYmxlIHRvIGluamVjdCBjb2RlIGlzIHRvIGxvYWQgaXQgZGlyZWN0bHkgaW4gdGhlIG1haW4gd2luZG93IDxlbWJlZD4gPGlmcmFtZT4gb3IgZXZlbiA8d2Vidmlldz4gb2ZmZXJzIG5vIHdvcmthcm91bmRcbiAgICAgICAgICogdGhlcmVmb3JlIHdlIHVzZSBcIkJyb3dzZXJWaWV3XCIgaW4gb3JkZXIgdG8gZGlzcGxheSB0d28gcGFnZXMgaW4gb25lIHdpbmRvdzogb24gdG9wID4gZXhhbSBoZWFkZXIsIG9uIGJvdHRvbSA+IG9mZmljZVxuICAgICAgICAgKi9cblxuICAgICAgICBpZiAoZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIgICkgeyAvL2V4dGVybmFsIHBhZ2VcbiAgICAgICAgICAgIGxvZy5pbmZvKFwic3RhcnRpbmcgbWljcm9zb2Z0MzY1IGV4YW0uLi5cIilcbiAgICAgICAgICAgIGxldCB1cmx2aWV3ID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICAgXG4gICAgICAgICAgICBpZiAoIXVybHZpZXcpIHsvLyB3ZSB3YWl0IGZvciB0aGUgbmV4dCB1cGRhdGUgdGljayAtIG1zb2ZmaWNlc2hhcmUgbmVlZHMgdG8gYmUgc2V0ICEgKGNvdWxkIGhhcHBlbiB3aGVuIGEgc3R1ZGVudCBjb25uZWN0cyBsYXRlciB0aGVuIGV4YW0gbW9kZSBpcyBzZXQgYnV0IGhpcyBzaGFyZSB1cmwgbmVlZHMgc29tZSB0aW1lKVxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IG5vIHVybCBmb3IgbWljcm9zb2Z0MzY1IHdhcyBzZXQgeWV0IC0gd2FpdGluZyBmb3IgbmV4dCB1cGRhdGUgdGlja1wiKVxuICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgZGVzdHJveWVkXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxvYWQgdG9wIG1lbnUgaW4gTWFpblBhZ2VcbiAgICAgICAgICAgIGxldCB1cmwgPSBleGFtdHlwZSAgIC8vIGVkaXRvciB8fCBtYXRoIHx8IGVkdXZpZHVhbCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgYmFja2dyb3VuZHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTChiYWNrZ3JvdW5kdXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlZmluZSB0aGUgTWFpbkNvbnRlbnRQYWdlIHZpZXdcbiAgICAgICAgICAgIGxldCBjb250ZW50VmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLCAgXG4gICAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEF1dG9SZXNpemUoeyB3aWR0aDogdHJ1ZSwgaGVpZ2h0OiB0cnVlLCBob3Jpem9udGFsOiB0cnVlLCB2ZXJ0aWNhbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsdmlldyk7XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7ICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpIH1cblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdlbnRlci1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdyZXNpemUnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSBub3JtYWwgZXhhbSBtb2RlIChlZGl0b3IsIG1hdGgsIGVkdXZpZHVhbCwgd2Vic2l0ZSwgZ2Zvcm1zKVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGUgc3BlY2lhbCBOQVZJR0FUSU9OIHNpdHVhdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBGb3JtcywgV2Vic2l0ZSwgRWR1dmlkdWFsLCBFZGl0b3IsIFJEUCwgTWljcm9zb2Z0MzY1XG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gZXhhbXdpbmRvdy53ZWJDb250ZW50cyBsZXZlbCBmb3IgYWxsIG1vZGVzIHRoYXQgY2FuIGRpc3BsYXkgUERGcyBpbiBleGFtaGVhZGVyXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgbmF2aWdhdGlvbiB3aGVuIGNsaWNraW5nIGxpbmtzIGluIFBERnMgZGlzcGxheWVkIGluIHRoZSBleGFtaGVhZGVyXG4gICAgICAgIC8vIFdlYnZpZXcvQnJvd3NlclZpZXcgYmxvY2tpbmcgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5IHZpYSBJUEMgaW4gaXBjaGFuZGxlci5qcyBvciBtb2RlLXNwZWNpZmljIGhhbmRsZXJzIGJlbG93XG4gICAgICAgIGNvbnN0IGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlciA9IFtcImdmb3Jtc1wiLCBcIndlYnNpdGVcIiwgXCJlZHV2aWR1YWxcIiwgXCJlZGl0b3JcIiwgXCJyZHBcIiwgXCJtaWNyb3NvZnQzNjVcIiwgXCJhY3RpdmVzaGVldHNcIl07XG4gICAgICAgIGlmIChleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIuaW5jbHVkZXMoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIFZ1ZSBhcHAgKGUuZy4gZnJvbSBQREYgbGlua3MgaW4gZXhhbWhlYWRlcilcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IG5ldyB3aW5kb3dzIGZyb20gb3BlbmluZyBpbiB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBuZXctd2luZG93XCIsIHVybCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICBcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIHNldFdpbmRvd09wZW5IYW5kbGVyXCIsIHVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgTWljcm9zb2Z0IEV4Y2VsL1dvcmRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIil7ICAvLyBkbyBub3QgdW5kZXIgYW55IGNpcmN1bXN0YW5jZXMgYWxsb3cgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGN1cnJlbnQgZXhhbSB1cmxcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YW50cyB0byBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyBwYWdlXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImRvIG5vdCBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyB0ZXN0Li4gXCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICBcbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRlQ29kZSA9ICBgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGxvY2soKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICdXQUNEaWFsb2dPdXRlckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ0lubmVyQ29udGFpbmVyJywnV0FDRGlhbG9nUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGlkZXVzQnlJRCA9IFsnU2hvd0hpZGVFcXVhdGlvblRvb2xzUGFuZScsJ0xpbmtHcm91cCcsJ0dyYXBoaWNzRWRpdG9yJywnSW5zZXJ0VGFibGVPZkNvbnRlbnRzSW5JbnNlcnRUYWInLCdJbnNlcnRPbmxpbmV2aWRlbycsJ1BpY3R1cmUnLCdSaWJib24tUGljdHVyZU1lbnVNTFJEcm9wZG93bicsJ0luc2VydEFkZEluRmx5b3V0JywnRGVzaWduZXInLCdFZGl0b3InLCdGYXJQYW5lJywnSGVscCcsJ0luc2VydEFwcHNGb3JPZmZpY2UnLCdGaWxlTWVudUxhdW5jaGVyQ29udGFpbmVyJywnSGVscC13cmFwcGVyJywnUmV2aWV3LXdyYXBwZXInLCdIZWFkZXInLCdGYXJQZXJpcGhlcmFsQ29udHJvbHNDb250YWluZXInLCdCdXNpbmVzc0JhciddXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGVudHJ5IG9mIGhpZGV1c0J5SUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudHJ5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImRpc3BsYXlcIiwgXCJub25lXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJ1dHRvbkFwcHNPdmVyZmxvdyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdBZGQtSW5zJylbMF07ICAvLyB0aGlzIGJ1dHRvbiBpcyByZWRyYXduIG9uIHJlc2l6ZSAoZG9lc24ndCBoYXBwZW4gaW4gZXhhbSBtb2RlIGJ1dCBzdGlsbCB0aGVyZSBtdXN0IGJlIGEgY2xlYW5lciB3YXkgLSBpbnNlcnRpbmcgY3NzIGJlZm9yZSBpdCBhcHBlYXJzIGlzIG5vdCB3b3JraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1dHRvbkFwcHNPdmVyZmxvdyl7IGJ1dHRvbkFwcHNPdmVyZmxvdy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlN1Y2hlblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlx1MDBEQ2JlcnNldHplblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkNvcGlsb3RcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQWRkLUluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBDb250ZXh0TWVudVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwU3lub255bXNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUmliYm9uLVJlZmVyZW5jZXNTbWFydExvb2tVcFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkRpY3RhdGlvblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiR2V0QWRkaW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJQaWN0dXJlc19NTFJcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2NrKCkgIC8vZm9yIHNvbWUgcmVhc29uIGV4Y2VsIGRlbGF5cyB0aGF0IGNhbGwuLiBkb2VzbnQgaGFwcGVuIG9uIHBhZ2UgZmluaXNoIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgYFxuXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGVySW5zdGFuY2UgPSBudWxsXG4gICAgICAgICAgICB0aGlzLmxvY2tDYWxsYmFjayA9ICgpID0+IHRoaXMubG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKTsgXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZSA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMubG9ja0NhbGxiYWNrLCA0MDApXG4gICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBzY2hlZHVsZXJJbnN0YW5jZVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RhcnQoKVxuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgd2ViQ29udGVudHMgaXMgZnVsbHkgbG9hZGVkICAvLyB0aGlzIGlzIG5vdCB3b3JraW5nIHJlbGlhYmx5IGJlY2F1c2UgdGhlIHBhZ2UgaXMgbG9hZGVkIGluIG1hbnkgc3RlcHMgYW5kIHRoZSB1aSBlbGVtZW50cyBhcmUgbm90IGF2YWlsYWJsZSB5ZXRcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignYXBwLWNvbW1hbmQnLCAoZSwgY21kKSA9PiB7XG4gICAgICAgICAgICAvLyAnYnJvd3Nlci1iYWNrd2FyZCcgdW5kICdicm93c2VyLWZvcndhcmQnIHNpbmQgZGllIEJlZmVobGUsIGRpZSBiZWltIEtsaWNrIGF1ZiBkaWUgTWF1c3Rhc3RlbiBnZXNlbmRldCB3ZXJkZW5cbiAgICAgICAgICAgIGlmIChjbWQgPT09ICdicm93c2VyLWJhY2t3YXJkJyB8fCBjbWQgPT09ICdicm93c2VyLWZvcndhcmQnKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJubyBuYXZpZ2F0aW9uIGFsbG93ZWRcIilcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcm4gU2llIGRhcyBTdGFuZGFyZHZlcmhhbHRlblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIC8vZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpICAvL2RvIG5vdCBkaXNhYmxlIHR3aWNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBsb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2Upe1xuICAgICAgICBpZiAoYnJvd3NlclZpZXcud2ViQ29udGVudHMgJiYgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lKXtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiLCBmcmFtZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChmcmFtZSAmJiAoZnJhbWUubmFtZSA9PT0gJ1dlYkFwcGxpY2F0aW9uRnJhbWUnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9Xb3JkXzAnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9FeGNlbF8wJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogc3RvcHBpbmcgbG9ja1NjaGVkdWxlclwiKVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RvcCgpXG4gICAgICAgICAgICBpZiAodGhpcy5sb2NrU2NoZWR1bGVyID09PSBzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBubyBicm93c2VyVmlldyBvciBsb2NrU2NoZWR1bGVyIGZvdW5kXCIpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIFxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBNQUlOIFdJTkRPV1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgYXN5bmMgY3JlYXRlTWFpbldpbmRvdygpIHtcbiAgICAgICAgbGV0IHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpO1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClbMF1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdpbmRvdyBkaW1lbnNpb25zIC0gZGVmaW5lZCBvbmNlLCB1c2VkIGV2ZXJ5d2hlcmVcbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSAxMDI0XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IDY0MFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBjZW50ZXIgcG9zaXRpb24gb24gcHJpbWFyeSBkaXNwbGF5XG4gICAgICAgIGxldCB4ID0gMFxuICAgICAgICBsZXQgeSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgeCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLndpZHRoIC0gd2luZG93V2lkdGgpIC8gMilcbiAgICAgICAgICAgIHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueSArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy5oZWlnaHQgLSB3aW5kb3dIZWlnaHQpIC8gMilcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTWFpbiB3aW5kb3cnLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICB5OiB5LFxuICAgICAgICAgICAgd2lkdGg6IHdpbmRvd1dpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB3aW5kb3dIZWlnaHQsXG4gICAgICAgICAgICBtaW5XaWR0aDogODUwLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiA2MDAsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRhcyBcdTAwQzRuZGVybiBkZXIgR3JcdTAwRjZcdTAwREZlICBcbiAgICAgICAgICAgIGZ1bGxzY3JlZW5hYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkZW4gVm9sbGJpbGRtb2R1cyAtIHdpY2h0aWcgZlx1MDBGQ3IgbWFjb3MgZGVubiB3ZW5uIGF1ZiBtYWNvcyBkYXMgbWFpbndpbmRvdyBhdWYgZnVsbHNjcmVlbiBpc3QgZ3JlaWZ0IGJlaW0gZXhhbXdpbmRvdyBkZXIga2lvc2sgbW9kZSBuaWNodCAgLSBlbGVjdHJvbiBidWcgKG5lZWRzIGV4YW1wbGUgY29kZSk6ID4+IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvNDQ3NTVcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB2aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnREaXIsXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTilcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnMgYmVmb3JlIGxvYWRpbmdcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIGFzayBiZWZvcmUgY2xvc2luZ1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiAhdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCkgeyAgLy8gYWxsb3dleGl0IGlzdCBlaW4gb3ZlcnJpZGUgdm9tIGNvbnRleHQgbWVudSBvZGVyIHNjcmVlbnNob3QgdGVzdC4gZGllc2VyIGthbm4gZGllIGFwcCBzY2hsaWVzc2VuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4pe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhhcyBubyBsZWdhY3kgdHJheVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsbG93VHJheSkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogR05PTUUgZGV0ZWN0ZWQsIHF1aXR0aW5nIGluc3RlYWQgb2YgdHJheSBtaW5pbWl6ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7ICAvLyBhbGxvdyBjbG9zZSBmbG93XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNob3dNaW5pbWl6ZVdhcm5pbmcoKVxuICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IE1pbmltaXppbmcgTmV4dC1FeGFtIHRvIFN5c3RlbXRyYXlgKSBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgd2luZG93IHByb3BlcnRpZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuZm9jdXMoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbXCJERUJVR1wiXSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKVxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9YFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIFVSTDogJHt1cmx9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBhc3luYyBzaG93RXhpdFdhcm5pbmcobWVzc2FnZSl7XG4gICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09rJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBCZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dFeGl0UXVlc3Rpb24oKXtcbiAgICAgICAgaWYgKHRoaXMuZXhpdFF1ZXN0aW9uT3Blbikge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZGlhbG9nIGFscmVhZHkgb3Blbiwgc2tpcHBpbmdcIilcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ0phJywgJ05laW4nXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIGJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdXb2xsZW4gc2llIGRpZSBBbndlbmR1bmcgTmV4dC1FeGFtIGJlZW5kZW4/JyxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZihjaG9pY2UucmVzcG9uc2UgPT0gMSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZG8gbm90IGNsb3NlIE5leHQtRXhhbSBhZnRlciBmaW5pc2hlZCBFeGFtXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93TWluaW1pemVXYXJuaW5nKCl7XG4gICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW5mbycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWluaW1pemUgdG8gU3lzdGVtIFRyYXknLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdEaWUgQW53ZW5kdW5nIE5leHQtRXhhbSB3dXJkZSBtaW5pbWllcnQhJyxcbiAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogQWRkaXRpb25hbCBGdW5jdGlvbnNcbiAgICAgKi9cblxuICAgIGlzV2F5bGFuZCgpe1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnOyBcbiAgICB9XG5cbiAgICAvLyB0aGlzIGZ1bmN0aW9uIHVzZXMgYWN0aXZlLXdpbiB0byByZWNlaXZlIG5hbWUgYW5kIHVybCBmcm9tIGFjdGl2ZSB3aW5kb3cgLSB5ZXQgYW5vdGhlciB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGUgZm9jdXMgaXMgc3RpbGwgb24gbmV4dGV4YW1cbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gaW50cm9kdWNlIGV4ZW1wdGlvbnMgZm9yIHRoZSBibHVyIGxpc3RlbmVyXG4gICAgLy8gKGRvd25ncmFkZWQgZnJvbSBnZXQtd2luZG93cyBiZWNhdXNlIG9mIG5hcGkgdjkgaXNzdWUpIGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvZ2V0LXdpbmRvd3MvaXNzdWVzLzE4NlxuICAgIGFzeW5jIHdpbmRvd1RyYWNrZXIoKXtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgLy8gY29uc3QgZ2V0d2luID0gYXdhaXQgdGhpcy5nZXRBY3RpdmVXaW5kb3coKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZVdpbiA9IGF3YWl0IGFjdGl2ZVdpbmRvdygpXG4gICAgICAgICBcbiAgICAgICAgICAgIGlmIChhY3RpdmVXaW4gJiYgYWN0aXZlV2luLm93bmVyICYmIGFjdGl2ZVdpbi5vd25lci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgbGV0IG5hbWUgPSBhY3RpdmVXaW4ub3duZXIubmFtZVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aCA9IGFjdGl2ZVdpbi5vd25lci5wYXRoXG4gICAgICAgICAgICAgICAgbGV0IG5hbWVMb3dlciA9IG5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aExvd2VyID0gd3BhdGgudG9Mb3dlckNhc2UoKVxuXG4gICAgICAgICAgICAgICAgaWYgKG5hbWVMb3dlci5pbmNsdWRlcyhcImV4YW1cIikgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwibmV4dFwiKSAgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwiZWxlY3Ryb25cIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJlYXNlb2ZhY2Nlc3NkaWFsb2dcIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJkaXNhYmxlLXNob3J0Y3V0c1wiKSApeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGZva3VzIGlzIG9uIGFsbG93ZWQgd2luZG93IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgLy9mb2N1cyBpcyBub3Qgb24gbmV4dC1leGFtIG9yIGFueSBvdGhlciBhbGxvd2VkIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5mb2N1c1RhcmdldEFsbG93ZWQpeyAgLy9sb2cganVzdCBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6IGZvY3VzIGxvc3QgZXZlbnQgd2FzIHRyaWdnZXJlZC4gYXBwOiAke3dwYXRofSAtICR7bmFtZX0gYClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogJHtlcnJ9YCkgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2FkZHMgYmx1ciBsaXN0ZW5lciB3aGVuIGVudGVyaW5nIGV4YW1tb2RlICAgLy8gYmx1ciBldmVudCBpc250IGZpcmVkIG9uIG1hY29zIE1JU1NJT05DT05UUk9MICh3aGljaCBjYW50IGJlIGRlYWN0aXZhdGVkIGFueW1vcmUpIC0gZGFtbiB5b3UgYXBwbGUhXG4gICAgYWRkQmx1ckxpc3RlbmVyKHdpbmRvdyA9IFwiZXhhbXdpbmRvd1wiKXtcbiAgICAgICAgaWYgKHdpbmRvdyA9PT0gXCJleGFtd2luZG93XCIpeyBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fWApXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudCh0aGlzKSkgXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2luZG93ID09PSBcInNjcmVlbmxvY2tcIikge1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9d2luZG93YClcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50U2NyZWVubG9jayh0aGlzKSkgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvL3JlbW92ZXMgYmx1ciBsaXN0ZW5lciB3aGVuIGxlYXZpbmcgZXhhbSBtb2RlXG4gICAgcmVtb3ZlQmx1ckxpc3RlbmVyKCl7XG4gICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZUFsbExpc3RlbmVycygnYmx1cicpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCByZW1vdmVCbHVyTGlzdGVuZXI6IHJlbW92aW5nIGJsdXIgbGlzdGVuZXJcIilcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBpbXBsZW1lbnRpbmcgYSBzbGVlcCAod2FpdCkgZnVuY3Rpb25cbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgIC8vc3R1ZGVudCBmb2d1cyB3ZW50IHRvIGFub3RoZXIgd2luZG93XG4gICAgYXN5bmMgYmx1cmV2ZW50KHdpbmhhbmRsZXIpIHsgXG5cbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBzdHVkZW50IHRyaWVkIHRvIGxlYXZlIGV4YW0gd2luZG93XCIpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcpe1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53aW5kb3dUcmFja2VyKCkgIC8vY2hlY2tzIGlmIG5ldyBmb2N1cyB3aW5kb3cgaXMgYWxsb3dlZFxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3d0cmFja2VyIGNoZWNrIGRvbmUuLi5cIilcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgc2NyZWVubG9jayB3aW5kb3dzIGZyb20gYXJyYXkgYW5kIGNoZWNrIGlmIGFueSBzdGlsbCBleGlzdFxuICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIGNvbnN0IGhhc0FjdGl2ZVNjcmVlbmxvY2sgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLnNvbWUod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkgJiYgd2luLmlzVmlzaWJsZSgpKVxuICAgICAgICAvLyBBbHNvIGNoZWNrIGNsaWVudGluZm8uc2NyZWVubG9jayBmbGFnIGFzIGZhbGxiYWNrIGluIGNhc2UgYXJyYXkgd2FzIGNsZWFyZWQgYnV0IHdpbmRvd3Mgc3RpbGwgZXhpc3RcbiAgICAgICAgaWYgKGhhc0FjdGl2ZVNjcmVlbmxvY2sgfHwgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LnNjcmVlbmxvY2spIHsgcmV0dXJuIH0vLyBkbyBub3RoaW5nIGlmIHNjcmVlbmxvY2t3aW5kb3cgc3RvbGUgZm9jdXMgLy8gZG8gbm90IHRyaWdnZXIgYW4gaW5maW5pdGUgbG9vcCBiZXR3ZWVuIGV4YW0gd2luZG93IGFuZCBzY3JlZW5sb2NrIHdpbmRvdyAoc3RlYWxpbmcgZWFjaCBvdGhlcnMgZm9jdXMgYmVjYXVzZSBzY3JlZW5sb2Nrd2luZG93IGFwcGVhcnMgYWJvdmUgZXhhbSB3aW5kb3cgYW5kIHdpbGwgY2FwdHVyZSBhIGtsaWNrIGFuZCB0aGVyZWZvcmUgc3RlYWwgZm9jdXMpXG4gICAgICAgIGlmICh3aW5oYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCl7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7IC8vdHJvdHpkZW0gZm9jdXMgenVyXHUwMEZDY2sgYXVmIGRpZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBibHVyZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2UgICAvL2luZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuXG4gICAgICAgIC8vdHVybiB2b2x1bWUgdXAgXl5cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgc3Bhd24oJ3Bvd2Vyc2hlbGwnLCBbJ1NldC1Wb2x1bWVMZXZlbCAtTGV2ZWwgMTAwOyBTZXQtVm9sdW1lTXV0ZSAtTXV0ZSAkZmFsc2UnXSk7IH1cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgZXhlYygnb3Nhc2NyaXB0IC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgdm9sdW1lIDEwMFwiIC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgbXV0ZWQgZmFsc2VcIicpOyB9ICBcbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHsgXG4gICAgICAgIC8vICAgICBleGVjKCdhbWl4ZXIgc2V0IE1hc3RlciAxMDAlICcpO1xuICAgICAgICAvLyAgICAgZXhlYygncGFjdGwgc2V0LXNpbmstbXV0ZSBgcGFjdGwgZ2V0LWRlZmF1bHQtc2lua2AgMCcpO1xuICAgICAgICAvLyB9XG4gICAgICAgIFxuICAgICAgICAvL3dlIGNvdWxkIHBsYXkgYSBzb3VuZCBmaWxlIGhlcmUuLiB0YmQuICBcbiAgICB9XG4gICAgLy9zcGVjaWFsIGJsdXIgZXZlbnQgZm9yIHRlbXBvcmFyeSBsb3cgc2VjdXJpdHkgc2NyZWVubG9ja1xuICAgIGJsdXJldmVudFNjcmVlbmxvY2sod2luaGFuZGxlcikgeyBcbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogYmx1ci1zY3JlZW5sb2NrIHRyaWdnZXJlZFwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9kb24ndCBjeWNsZSB0aHJvdWdoIGFsbCBvZiB0aGVtIC4uIGl0IHdpbGwgY3JlYXRlIGFuIGluZmluaXRlIGZvY3VzIHJhY2VcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uc2hvdygpOyAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0ubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogJHtlcnJ9YClcbiAgICAgICAgfVxuICAgIFxuICAgIH1cbiAgICBcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgV2luZG93SGFuZGxlcigpXG4gXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBtb3N0IG9mIHRoZSBrZXlib2FyZCByZXN0cmljdGlvbnMgY291bGQgYmUgaGFuZGxlZCBieSBcImlvaG9va1wiIGZvciBhbGwgcGxhdGZvcm1zXG4gKiB1bmZvcnR1bmFsZXR5IGl0J3Mgbm90IHlldCByZWxlYXNlZCBmb3Igbm9kZSB2MTYueCBhbmQgZWxlY3Ryb24gdjE2LnggIChhbHNvIGl0J3MgXCJiaWcgc3VyXCIgaW50ZWwgb25seSBvbiBtYWNzKVxuICogaHR0cHM6Ly93aWxpeC10ZWFtLmdpdGh1Yi5pby9pb2hvb2svaW5zdGFsbGF0aW9uLmh0bWxcbiAqIFxuICogXCJub2RlLWdsb2JhbC1rZXktbGlzdGVuZXJcIiB3b3VsZCBiZSBhbm90aGVyIHNvbHV0aW9uIGZvciB3aW5kb3dzIGFuZCBtYWNvcyAoYWx0aG91Z2ggaXQgcmVxdWlyZXMgXCJhY2Nlc3NhYmlsaXR5XCIgcGVybWlzc2lvbnMgb24gbWFjKVxuICogYnV0IGZvciBub3cgaXQgc2VlbXMgdGhlIG1vZHVsZSBjYW4gbm90IHJ1biBpbiBhIGZpbmFsIGVsZWN0cm9uIGJ1aWxkXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTGF1bmNoTWVudS9ub2RlLWdsb2JhbC1rZXktbGlzdGVuZXIvaXNzdWVzLzE4XG4gKiBcbiAqIGhhcmRjb2RpbmcgdGhlIGtleWJvYXJkc2hvcnRjdXRzIHdlIHdhbnQgdG8gY2FwdHVyZSBpbnRvIGlvaG9vayhvciBuLWctay1sKSBhbmQgbWFudWFsbHkgY29tcGlsaW5nIGl0IGZvciBtYWMgYW5kIHdpbmRvd3MgY291bGQgYmUgZG9uZSAtIChidXQgbm90IHVudGlsIGkgZ2V0IHBhaWQgZm9yIHRoaXMgYW1vdW50IG9mIHdvcmsgOy0pIFxuICovXG5cblxuLyoqXG4gKiB0aGUgbmV4dCBiZXN0IHNvbHV0aW9uIGkgY2FtZSB1cCB3aXRoIGlzIHRvIGtpbGwgYWxsIG9mIHRoZSBzaGVsbHMgLSBzdGFydGluZyB3aXRoIGV4cGxvcmVyLmV4ZSBiZWNhdXNlIGl0cyBhYnNvbHV0ZWx5IGltcG9zc2libGUgdG8gXG4gKiBkZWFjdGl2YXRlIHRoaXMgbmFzdHkgXCJ3aW5kb3dzXCIgYnV0dG9uIG9yIDNGaW5nZXJTbGlkZVVwIEdlc3R1cmUgaW4gd2luZG93cyAxMSAtIHlvdSBjb3VsZCBlZGl0IHRoZSByZWdpc3RyeSBhbmQgcmVib290IGJ1dCB0aGF0cyBvYnZpb3VzbHkgbm90IHdoYXQgd2Ugd2FudFxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJyAgIC8vbmVlZGVkIHRvIHJ1biBiYXNoIGNvbW1hbmRzIG9uIGxpbnV4IFxuaW1wb3J0IHsgYXBwLCBUb3VjaEJhciwgY2xpcGJvYXJkLCBnbG9iYWxTaG9ydGN1dH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gdW5mb3J0dW5hdGVseSB0aGVyZSBpcyBubyBjb252ZW5pZW50IHdheSBmb3IgZ25vbWUtc2hlbGwgdG8gdW4tc2V0IEFMTCBzaG9ydGN1dHMgYXQgb25jZVxuY29uc3QgZ25vbWVLZXliaW5kaW5ncyA9IFsgIFxuICAgICdhY3RpdmF0ZS13aW5kb3ctbWVudScsJ21heGltaXplLWhvcml6b250YWxseScsJ21vdmUtdG8tc2lkZS1uJywnbW92ZS10by13b3Jrc3BhY2UtOCcsJ3N3aXRjaC1hcHBsaWNhdGlvbnMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTMnLCdzd2l0Y2gtd2luZG93cy1iYWNrd2FyZCcsXG4gICAgJ2Fsd2F5cy1vbi10b3AnLCdtYXhpbWl6ZS12ZXJ0aWNhbGx5JywnbW92ZS10by1zaWRlLXMnLCdtb3ZlLXRvLXdvcmtzcGFjZS05Jywnc3dpdGNoLWFwcGxpY2F0aW9ucy1iYWNrd2FyZCcsJyAgc3dpdGNoLXRvLXdvcmtzcGFjZS00JywndG9nZ2xlLWFib3ZlJyxcbiAgICAnYmVnaW4tbW92ZScsJ21pbmltaXplJywnbW92ZS10by1zaWRlLXcnLCdtb3ZlLXRvLXdvcmtzcGFjZS1kb3duJywnc3dpdGNoLWdyb3VwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS01JywndG9nZ2xlLWZ1bGxzY3JlZW4nLFxuICAgICdiZWdpbi1yZXNpemUnLCdtb3ZlLXRvLWNlbnRlcicsJ21vdmUtdG8td29ya3NwYWNlLTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sYXN0Jywnc3dpdGNoLWdyb3VwLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS02JywndG9nZ2xlLW1heGltaXplZCcsXG4gICAgJ2Nsb3NlJywnbW92ZS10by1jb3JuZXItbmUnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMCcsJ21vdmUtdG8td29ya3NwYWNlLWxlZnQnLCdzd2l0Y2gtaW5wdXQtc291cmNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS03JywndG9nZ2xlLW9uLWFsbC13b3Jrc3BhY2VzJyxcbiAgICAnY3ljbGUtZ3JvdXAnLCdtb3ZlLXRvLWNvcm5lci1udycsJ21vdmUtdG8td29ya3NwYWNlLTExJywnbW92ZS10by13b3Jrc3BhY2UtcmlnaHQnLCdzd2l0Y2gtaW5wdXQtc291cmNlLWJhY2t3YXJkICBzd2l0Y2gtdG8td29ya3NwYWNlLTgnLCd0b2dnbGUtc2hhZGVkJyxcbiAgICAnY3ljbGUtZ3JvdXAtYmFja3dhcmQnLCdtb3ZlLXRvLWNvcm5lci1zZScsJ21vdmUtdG8td29ya3NwYWNlLTEyJywnbW92ZS10by13b3Jrc3BhY2UtdXAnLCdzd2l0Y2gtcGFuZWxzJywnc3dpdGNoLXRvLXdvcmtzcGFjZS05JywndW5tYXhpbWl6ZScsXG4gICAgJ2N5Y2xlLXBhbmVscycsJ21vdmUtdG8tY29ybmVyLXN3JywnbW92ZS10by13b3Jrc3BhY2UtMicsJ3BhbmVsLW1haW4tbWVudScsJ3N3aXRjaC1wYW5lbHMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWRvd24nLCAgICAgIFxuICAgICdjeWNsZS1wYW5lbHMtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItZG93bicsJ21vdmUtdG8td29ya3NwYWNlLTMnLCdwYW5lbC1ydW4tZGlhbG9nJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sYXN0JywgICAgICAgICAgICAgIFxuICAgICdjeWNsZS13aW5kb3dzJywnbW92ZS10by1tb25pdG9yLWxlZnQnLCdtb3ZlLXRvLXdvcmtzcGFjZS00JywncmFpc2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sZWZ0JywgICAgXG4gICAgJ2N5Y2xlLXdpbmRvd3MtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItcmlnaHQnLCdtb3ZlLXRvLXdvcmtzcGFjZS01JywncmFpc2Utb3ItbG93ZXInLCdzd2l0Y2gtdG8td29ya3NwYWNlLTExJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1yaWdodCcsICAgXG4gICAgJ2xvd2VyJywnbW92ZS10by1tb25pdG9yLXVwJywnbW92ZS10by13b3Jrc3BhY2UtNicsJ3NldC1zcGV3LW1hcmsnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS11cCcsICAgICBcbiAgICAnbWF4aW1pemUnLCdtb3ZlLXRvLXNpZGUtZScsJ21vdmUtdG8td29ya3NwYWNlLTcnLCdzaG93LWRlc2t0b3AnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTInLCdzd2l0Y2gtd2luZG93cycgIFxuXVxuY29uc3QgZ25vbWVTaGVsbEtleWJpbmRpbmdzID0gWydmb2N1cy1hY3RpdmUtbm90aWZpY2F0aW9uJywnb3Blbi1hcHBsaWNhdGlvbi1tZW51Jywnc2NyZWVuc2hvdCcsJ3NjcmVlbnNob3Qtd2luZG93Jywnc2hpZnQtb3ZlcnZpZXctZG93bicsXG4gICAgJ3NoaWZ0LW92ZXJ2aWV3LXVwJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTEnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0zJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTQnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNScsXG4gICAgJ3N3aXRjaC10by1hcHBsaWNhdGlvbi02Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTcnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi05Jywnc2hvdy1zY3JlZW5zaG90LXVpJywnc2hvdy1zY3JlZW4tcmVjb3JkaW5nLXVpJyxcbiAgICAndG9nZ2xlLWFwcGxpY2F0aW9uLXZpZXcnLCd0b2dnbGUtbWVzc2FnZS10cmF5JywndG9nZ2xlLW92ZXJ2aWV3JyAgXVxuXG5jb25zdCBnbm9tZU11dHRlcktleWJpbmRpbmdzID0gWydyb3RhdGUtbW9uaXRvcicsJ3N3aXRjaC1tb25pdG9yJywndGFiLXBvcHVwLWNhbmNlbCcsJ3RhYi1wb3B1cC1zZWxlY3QnLCd0b2dnbGUtdGlsZWQtbGVmdCcsJ3RvZ2dsZS10aWxlZC1yaWdodCddXG5cbmNvbnN0IGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzID0gWydhcHAtY3RybC1ob3RrZXktMScsJ2FwcC1jdHJsLWhvdGtleS0xMCcsJ2FwcC1jdHJsLWhvdGtleS0yJywnYXBwLWN0cmwtaG90a2V5LTMnLCdhcHAtY3RybC1ob3RrZXktNCcsJ2FwcC1jdHJsLWhvdGtleS01JyxcbiAgICAnYXBwLWN0cmwtaG90a2V5LTYnLCdhcHAtY3RybC1ob3RrZXktNycsJ2FwcC1jdHJsLWhvdGtleS04JywnYXBwLWN0cmwtaG90a2V5LTknLFxuICAgICdhcHAtaG90a2V5LTEnLCdhcHAtaG90a2V5LTEwJywnYXBwLWhvdGtleS0yJywnYXBwLWhvdGtleS0zJywnYXBwLWhvdGtleS00JywnYXBwLWhvdGtleS01JywnYXBwLWhvdGtleS02JywnYXBwLWhvdGtleS03JywnYXBwLWhvdGtleS04JywnYXBwLWhvdGtleS05JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS0xJywnYXBwLXNoaWZ0LWhvdGtleS0xMCcsJ2FwcC1zaGlmdC1ob3RrZXktMicsJ2FwcC1zaGlmdC1ob3RrZXktMycsJ2FwcC1zaGlmdC1ob3RrZXktNCcsJ2FwcC1zaGlmdC1ob3RrZXktNScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktNicsJ2FwcC1zaGlmdC1ob3RrZXktNycsJ2FwcC1zaGlmdC1ob3RrZXktOCcsJ2FwcC1zaGlmdC1ob3RrZXktOScsJ3Nob3J0Y3V0J11cblxuY29uc3QgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MgPSBbJ3N3aXRjaC10by1zZXNzaW9uLTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0yJywnc3dpdGNoLXRvLXNlc3Npb24tMycsJ3N3aXRjaC10by1zZXNzaW9uLTQnLCdzd2l0Y2gtdG8tc2Vzc2lvbi01Jywnc3dpdGNoLXRvLXNlc3Npb24tNicsJ3N3aXRjaC10by1zZXNzaW9uLTcnLCdzd2l0Y2gtdG8tc2Vzc2lvbi04Jywnc3dpdGNoLXRvLXNlc3Npb24tOScsJ3N3aXRjaC10by1zZXNzaW9uLTEwJywnc3dpdGNoLXRvLXNlc3Npb24tMTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMicgXVxuXG5sZXQgY2xpcGJvYXJkSW50ZXJ2YWxcbmxldCBjb25maWdTdG9yZSA9IHtcbiAgICBsaW51eDoge30sXG4gICAgd2luZG93czoge30sXG4gICAgbWFjb3M6IHt9XG59XG5cbi8vIGxpc3Qgb2YgYXBwcyB3ZSBkbyBub3Qgd2FudCB0byBydW4gaW4gYmFja2dyb3VuZFxuY29uc3QgYXBwc1RvQ2xvc2UgPSBbJ2NoYXRncHQnLCdDaGF0R1BUJywnTm9ydG9uU2VjdXJpdHknLCdOQVYnLCdUZWFtcycsJ21zLXRlYW1zJywgJ3pvb20udXMnLCAnR29vZ2xlIENocm9tZScsICdNaWNyb3NvZnQgRWRnZScsICdNaWNyb3NvZnQgVGVhbXMnLCdmaXJlZm94JywgJ2Rpc2NvcmQnLCAnem9vbScsICdjaHJvbWUnLCAnbXNlZGdlJywgJ3RlYW1zJywgJ3RlYW12aWV3ZXInLCAnZ29vZ2xlLWNocm9tZScsJ3NreXBlZm9ybGludXgnLCdza3lwZScsJ2JyYXZlJywnb3BlcmEnLCdhbnlkZXNrJywnc2FmYXJpJ107XG5cbmxldCBpc0tERSA9IGZhbHNlXG5sZXQgaXNHTk9NRSA9IGZhbHNlXG5cbmNoaWxkUHJvY2Vzcy5leGVjKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9IFxuICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnS0RFJykgeyBpc0tERSA9IHRydWUgfSBcbiAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0dOT01FJykgeyBpc0dOT01FID0gdHJ1ZSB9XG59KTtcblxuXG5cblxuZnVuY3Rpb24gZW5hYmxlUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIpe1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHtyZXR1cm59XG4gICAgXG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgcGxhdGZvcm0gcmVzdHJpY3Rpb25zXCIpXG5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4ge2NvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7Y29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHtjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4ge2NvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKX0pO1xuICAgIFxuICAgIGNsaXBib2FyZC5jbGVhcigpICAvL3RoaXMgc2hvdWxkIGNsZWFuIHRoZSBjbGlwYm9hcmQgZm9yIHRoZSBlbGVjdHJvbiBhcHBcbiAgXG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSggKCk9PiB7ICBjbGlwYm9hcmQuY2xlYXIoKTt9ICAsIDEwMDApXG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RhcnQoKVxuXG5cbiAgICAvKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBMIEkgTiBVIFhcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGaXJzdCBjaGVjayBpZiBwcm9jZXNzIGV4aXN0cywgdGhlbiBraWxsIGl0XG4gICAgICAgICAgICAgICAgLy8gVXNlIHBncmVwIHRvIGZpbmQgcHJvY2Vzc2VzIGJ5IG5hbWUgKGNhc2UtaW5zZW5zaXRpdmUsIHByb2Nlc3MgbmFtZSBvbmx5LCBub3QgZnVsbCBjb21tYW5kIGxpbmUpXG4gICAgICAgICAgICAgICAgLy8gV2l0aG91dCAtZiBmbGFnLCBwZ3JlcCBvbmx5IHNlYXJjaGVzIHByb2Nlc3MgbmFtZXMsIG5vdCBjb21tYW5kIGxpbmVzXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBhdm9pZHMga2lsbGluZyBwcm9jZXNzZXMgdGhhdCBvbmx5IGNvbnRhaW4gdGhlIGFwcCBuYW1lIGluIHRoZWlyIGNvbW1hbmQgbGluZSAoZS5nLiBDdXJzb3IgY29udGFpbmluZyBcImNocm9tZVwiKVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiYCwgKHBncmVwRXJyb3IsIHN0ZG91dCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXBncmVwRXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgZm91bmQsIG5vdyBraWxsIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cIiB8IHhhcmdzIC1yIGtpbGwgLTlgLCAoa2lsbEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFraWxsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgcGdyZXAgcmV0dXJucyBlcnJvciBvciBubyBvdXRwdXQsIHByb2Nlc3MgZG9lc24ndCBleGlzdCAtIG5vIGxvZ2dpbmcgbmVlZGVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgIH1cblxuICAgICAgICAvLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBQTEFTTUFTSEVMTFxuICAgICAgICAvLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIGlmIChpc0tERSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgS0RFIHJlc3RyaWN0aW9uc1wiKVxuICAgICAgICAgICAgLy8gcmVhZCBhbmQgc2F2ZSBjdXJyZW50IGNvbmZpZ1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrcmVhZGNvbmZpZzUnLCBbJy0tZmlsZScsICdrd2lucmMnLCAnLS1ncm91cCcsICdEZXNrdG9wcycsICctLWtleScsICdOdW1iZXInXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChrcmVhZGNvbmZpZyk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IDFcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy9kaXNhYmxlIE1FVEEgS2V5IGZvciBMYXVuY2hlcm1lbnUgXG5cbiAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogcmVjb25maWd1cmluZyBrd2luYCk7IFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsIGAke2NvbmZpZy5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCAnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnXCJcIiddKSAgICAgICAgICAgICAgXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYGt3aW5yY2AsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywnMSddKSAgLy9yZW1vdmUgdmlydHVhbCBkZXNrdG9wc1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKSAgIC8vIGRhcyByZWxvYWRlZCBhbGxlIGNvbmZpZ3MgdW5kIHdcdTAwRkNyZGUgYXVjaCBhbmRlcmUgc2V0dGluZ3MgbmV1IGxhZGVuIHNvIHdpZSBrZ2xvYWxhY2NlbCB1bmQga2xpcGVyXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3NldEN1cnJlbnREZXNrdG9wJywnMSddKSAgLy8gc2V0enQgZGllIGFrdHVlbGxlIGRlc2t0b3AgYXVmIDFcbiAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZWZmZWN0c2AgIClcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ2Rlc2t0b3BncmlkJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnc2NyZWVuZWRnZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ292ZXJ2aWV3J10pO1xuXG4gICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGFkZGl0aW9uYWwgdHR5J3NgICApXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICdzcnZya2V5czpub25lJ10pXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pXG5cblxuICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbGVhcmluZyBjbGlwYm9hcmQgaGlzdG9yeWAgIClcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSkgLy8gQ2xlYXIgQ2xpcGJvYXJkIGhpc3RvcnkgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNldFRpbWVvdXQoICgpID0+IHsgIC8vbmVlZHMgdGltZW91dCBvdGhlcndpc2Uga3dpbiAvcmVjb25maWd1cmUgd2lsbCByZXNldCBpdFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGdsb2JhbCBrZXlib2FyZHNob3J0Y3V0c2AgIClcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ29yZy5rZGUuS0dsb2JhbEFjY2VsLmJsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ3RydWUnXSkgLy8gVGVtcG9yYXJpbHkgZGVhY3RpdmF0ZSBBTEwgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzIFxuICAgICAgICAgICAgfSwgMjAwMClcbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gIFxuICAgICAgICBcblxuICAgXG4gICAgICAgXG5cblxuICAgICAgICAvLy8vLy8vLy8vXG4gICAgICAgIC8vIEdOT01FXG4gICAgICAgIC8vLy8vLy8vLy8vXG5cbiAgICAgICAgLy93ZSBwcm9iYWJseSBzaG91bGQgZG8gaXQgdGhlIFwid2luZG93cyAtIHdheVwiIGFuZCBqdXN0IGtpbGwgZ25vbWVzaGVsbCBmb3IgYXMgbG9uZyBhcyB0aGUgZXhhbS1tb2RlIGlzIGFjdGl2ZVxuICAgICAgICAvL2J1dCBpdCBzZWVtcyB0aGVyZSBpcyBubyBjb252ZW5pZW50IHdheSB0byBraWxsIGdub21lLXNoZWxsIHdpdGhvdXQgYWxsIGFwcGxpY2F0aW9ucyBzdGFydGVkIG9uIHRvcCBvZiBpdCBcbiAgICAgICAgIC8vIGZvciBnbm9tZTMgd2UgbmVlZCB0byBzZXQgZXZlcnkga2V5IGluZGl2aWR1YWxseSA9PiByZXNldCB3aWxsIG9idmlvdXNseSBzZXQgZGVmYXVsdHMgKHNvIHdlIG1heSBtZXNzIHVwIGN1c3RvbWl6ZWQgc2hvcnRjdXRzIGhlcmUpXG4gICAgICAgIC8vIHBvc3NpYmxlIGZpeDogaW5zdGVhZCBvZiBzZXQgPiByZXNldCB3ZSBjb3VsZCB1c2UgZ2V0IC0gc2V0IC0gc2V0Li4gZmlyc3QgZ2V0IHRoZSBjdXJyZW50IGJpbmRpbmdzIGFuZCBzdG9yZSB0aGVtIC0gdGhlbiBzZXQgdG8gbm90aGluZyAtIHRoZW4gc2V0IHRvIHByZXZpb3VzIHNldHRpbmdcbiAgICAgICAgICAgIFxuICAgICAgICBpZiAoaXNHTk9NRSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgR05PTUUgcmVzdHJpY3Rpb25zXCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKXtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKXsgIC8vIHdlIGNvdWxkIHVzZSBnc2V0dGluZ3MgcmVzZXQtcmVjdXJzaXZlbHkgb3JnLmdub21lLnNoZWxsIHRvIHJlc2V0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlcicsIGBvdmVybGF5LWtleWAsIGAnJ2BdKSAgLy8ga2luZCBvZiB0aGUgbWVudSBrZXlcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUubXV0dGVyIGR5bmFtaWMtd29ya3NwYWNlcyBmYWxzZScpICAvLyBkZWFjdGl2YXRlIG11bHRpcGxlIGRlc2t0b3BzXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLmRlc2t0b3Aud20ucHJlZmVyZW5jZXMgbnVtLXdvcmtzcGFjZXMgMScpICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG4gICAgICAgIH1cblxuICAgICAgICB0cnkgeyAvLyBjbGVhciBjbGlwYm9hcmQgICh0aGlzIHdpbGwgZmFpbCB1bmxlc3MgeGNsaXAgb3IgeHNlbGwgYXJlIGluc3RhbGxlZClcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSkgICAvLyB3YXlsYW5kXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJylcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApIH1cbiAgICAgICAgXG4gICAgICAgIFxuICAgIH1cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogIFcgSSBOIEQgTyBXIFNcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgXG4gICAgICAgIC8vYmxvY2sgaW1wb3J0YW50IGtleWJvYXJkIHNob3J0Y3V0cyAoZGlzYWJsZS1zaG9ydGN1dHMuZXhlIGlzIGEgc2VsZm1hZGUgQyBhcHBsaWNhdGlvbiAtIHNob3J0Y3V0cyBhcmUgaGFyZGNvZGVkIHRoZXJlIC0gbmVlZCB0byByZWJ1aWxkIGlmIGFkZGluZyBzaG9ydGN1dHMpXG4gICAgICAgIHRyeSB7ICAgIFxuICAgICAgICAgICAgbGV0IGV4ZWN1dGFibGUxID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvZGlzYWJsZS1zaG9ydGN1dHMuZXhlJylcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMSwgW10sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJywgc2hlbGw6IGZhbHNlLCB3aW5kb3dzSGlkZTogdHJ1ZX0pXG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiB3aW5kb3dzIHNob3J0Y3V0cyBkaXNhYmxlZFwiKVxuICAgICAgICAgICAgLy9zdWJwcm9jZXNzLnVucmVmKCk7ICAvL2NvbXBsZXRlbHkgZGV0YWNoXG4gICAgICAgIH0gY2F0Y2ggKGVycil7bG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAod2luIHNob3J0Y3V0cyk6ICR7ZXJyfWApO31cbiAgICAgICAgXG5cbiAgICAgICAgLy9jbGVhciBjbGlwYm9hcmQgLSBzdG9wIGNvcHkgYmVmb3JlIGFuZCBwYXN0ZSBhZnRlciBleGFtc3RhcnRcbiAgICAgICAgLy8gdHJ5IHtcbiAgICAgICAgLy8gICAgIGxldCBleGVjdXRhYmxlMCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2NsZWFyLWNsaXBib2FyZC5iYXQnKVxuICAgICAgICAvLyAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKGV4ZWN1dGFibGUwLCBbXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAvLyAgICAgICAgIGlmIChlcnJvcikgIHsgIFxuICAgICAgICAvLyAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gY2xpcGJvYXJkKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAvLyAgICAgICAgIH1cbiAgICAgICAgLy8gICAgIH0pXG4gICAgICAgIC8vIH0gY2F0Y2ggKGVycil7bG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAod2luIGNsaXBib2FyZCk6ICR7ZXJyfWApO31cbiAgICAgICBcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEVzY2FwZSBhcHAgbmFtZSBmb3IgUG93ZXJTaGVsbCAtIHJlcGxhY2Ugc2luZ2xlIHF1b3RlcyB3aXRoIGRvdWJsZSBzaW5nbGUgcXVvdGVzXG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZEFwcCA9IGFwcC5yZXBsYWNlKC8nL2csIFwiJydcIik7XG4gICAgICAgICAgICAgICAgLy8gUG93ZXJTaGVsbCBjb21tYW5kOiBzZXQgYXBwIG5hbWUgYXMgdmFyaWFibGUgZmlyc3QgdG8gYXZvaWQgc3RyaW5nIGludGVycG9sYXRpb24gaXNzdWVzXG4gICAgICAgICAgICAgICAgLy8gVXNlcyAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB0byBoYW5kbGUgYWNjZXNzIGRlbmllZCBhbmQgb3RoZXIgZXJyb3JzIGdyYWNlZnVsbHlcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRhcHBOYW1lID0gJyR7ZXNjYXBlZEFwcH0nOyB0cnkgeyAkcHJvY3MgPSBHZXQtUHJvY2VzcyAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7ICRfLlByb2Nlc3NOYW1lIC1pbGlrZSAoJyonICsgJGFwcE5hbWUgKyAnKicpIH07IGlmICgkcHJvY3MgLWFuZCAkcHJvY3MuQ291bnQgLWd0IDApIHsgJHByb2NzIHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZTsgV3JpdGUtT3V0cHV0ICdraWxsZWQnIH0gfSBjYXRjaCB7IH1cImA7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpLmluY2x1ZGVzKCdraWxsZWQnKSkgeyAvLyBzdWNjZXNzIC0gcHJvY2VzcyB3YXMgZm91bmQgYW5kIGtpbGxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gcHJvY2VzcyBmb3VuZCBvciBvdGhlciBlcnJvcnMgYXJlIHNpbGVudGx5IGlnbm9yZWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgfVxuICAgICAgICAgIFxuXG5cbiAgICAgICAgLy9tdXN0IGJlIHRlc3RlZCBiZWNhdXNlIGl0cyBkYW5nZXJvdXMgLSBpIHBvdGVudGlhbGx5IGtpbGxzIHVud2FudGVkIHByb2Nlc3NlcyBiZWNhdXNlIGl0IHNlYXJjaGVzIGZvciBzdWJzdHJpbmdzIGluIHByb2Nlc3MgbmFtZXNcbiAgICAgICAgLy8gdHJ5IHtcbiAgICAgICAgLy8gICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgLy8gICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyB8IFdoZXJlLU9iamVjdCB7ICRfLk5hbWUgLWxpa2UgJyoke2FwcH0qJyB9IHwgRm9yRWFjaC1PYmplY3QgeyAkXy5LaWxsKCkgfVwiYDtcbiAgICAgICAgLy8gICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIC8vICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBFcnJvciBjbG9zaW5nIGFwcDogJHthcHB9YCwgZXJyb3IpO1xuICAgICAgICAvLyAgICAgICAgICAgICB9XG4gICAgICAgIC8vICAgICAgICAgICAgIGlmIChzdGRlcnIpIHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgc3RkZXJyOiAke3N0ZGVycn1gKTtcbiAgICAgICAgLy8gICAgICAgICAgICAgfVxuICAgICAgICAvLyAgICAgICAgICAgICBpZiAoc3Rkb3V0KSB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgc3Rkb3V0OiAke3N0ZG91dH1gKTtcbiAgICAgICAgLy8gICAgICAgICAgICAgfVxuICAgICAgICAvLyAgICAgICAgIH0pO1xuICAgICAgICAvLyAgICAgfSk7XG4gICAgICAgIC8vIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoUG93ZXJTaGVsbCk6ICR7ZXJyfWApO1xuICAgICAgICAvLyB9XG5cblxuXG5cbiAgICAgICAgLy8ga2lsbCBFWFBMT1JFUiB3aW5kb3dzYnV0dG9uIGFuZCBzd2lwZSBnZXN0dXJlcyAtIGtpbGwgZXZlcnl0aGluZyBlbHNlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2tpbGwgL2YgL2ltIGV4cGxvcmVyLmV4ZScsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiB0YXNra2lsbCB3YXMgc3VjY2Vzc2Z1bCAocHJvY2VzcyBmb3VuZCBhbmQga2lsbGVkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBleHBsb3Jlci5leGVgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gSWYgZXJyb3IgKGUuZy4gcHJvY2VzcyBub3QgZm91bmQpLCBzaWxlbnRseSBpZ25vcmUgLSBubyBsb2dnaW5nIG5lZWRlZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycil7XG4gICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBNIEEgQyBPIFMgIFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBjb25zdCB7IFRvdWNoQmFyTGFiZWwsIFRvdWNoQmFyQnV0dG9uLCBUb3VjaEJhclNwYWNlciB9ID0gVG91Y2hCYXJcbiAgICAgICAgY29uc3QgdGV4dGxhYmVsID0gbmV3IFRvdWNoQmFyTGFiZWwoe2xhYmVsOiBcIk5leHQtRXhhbVwifSlcbiAgICAgICAgY29uc3QgdG91Y2hCYXIgPSBuZXcgVG91Y2hCYXIoe1xuICAgICAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgICAgICB0ZXh0bGFiZWwsXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3c/LnNldFRvdWNoQmFyKHRvdWNoQmFyKVxuXG4gICAgICAgIC8vIGNsZWFyIGNsaXBib2FyZFxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygncGJjb3B5IDwgL2Rldi9udWxsJylcblxuICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICAvLyBwa2lsbC1CZWZlaGwgZlx1MDBGQ3IgbWFjT1NcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwa2lsbCAtOSAtZiBcIiR7YXBwfVwiYCwgKGVycm9yLCBzdGRlcnIsIHN0ZG91dCkgPT4ge1xuICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9taXNzaW9uIGNvbnRyb2xcbiAgICAgICAgLy9sZXQgc2NyaXB0ZmlsZSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL21jLmFwcGVsc2NyaXB0JykgICAvL3NwYWNlcywgc2hvcnRjdXRzXG4gICAgICAgIGxldCBtY3NjcmlwdGZpbGUgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9zcGFjZXMuYXBwbGVzY3JpcHQnKVxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHsgbWNzY3JpcHRmaWxlID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMvc3BhY2VzLmFwcGxlc2NyaXB0JykgfVxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ29zYXNjcmlwdCcsIFttY3NjcmlwdGZpbGVdLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7aWYgKHN0ZGVycikgeyBsb2cuaW5mbyhzdGRlcnIpICB9IH0pXG4gICAgfVxufVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuZnVuY3Rpb24gZGlzYWJsZVJlc3RyaWN0aW9ucygpe1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHtyZXR1cm59XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHJlbW92aW5nIHJlc3RyaWN0aW9ucy4uLlwiKVxuXG4gICAgaWYgKGNsaXBib2FyZEludGVydmFsKSB7ICAgIFxuICAgICAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdG9wKClcbiAgICB9XG5cbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7Y29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4ge2NvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHtjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7Y29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpfSk7XG5cblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqXG4gICAgICogTCBJIE4gVSBYXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgLy8gb24gd2F5bGFuZFxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pXG4gICAgICAgIC8vIGNsZWFyIGNsaXBib2FyZCBnbm9tZSBhbmQgeDExICAodGhpcyB3aWxsIGZhaWwgdW5sZXNzIHhjbGlwIG9yIHhzZWxsIGFyZSBpbnN0YWxsZWQpXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKVxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKVxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKVxuXG4gICAgICAgIC8vZW5hYmxlIE1FVEEgS2V5IGZvciBMYXVuY2hlcm1lbnVcbiAgICAgICAgLy9jaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3NlZCcsIFsnLWknLCAnLWUnLCAncy9nbG9iYWw9LiovZ2xvYmFsPUFsdCtGMS9nJywgYCR7Y29uZmlnLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcvcGxhc21hLW9yZy5rZGUucGxhc21hLmRlc2t0b3AtYXBwbGV0c3JjYCBdKVxuICAgICAgICAvL2NoaWxkUHJvY2Vzcy5leGVjKCdrd2luIC0tcmVwbGFjZSAmJylcblxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBleGVjIGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBLREUgZGV0ZWN0ZWRcIilcbiAgICAgICAgICAgICAgICAvLyBDbGVhciBDbGlwYm9hcmQgaGlzdG9yeSBcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pXG4gICAgICAgICAgICAgICAgLy8gcmVzZXQgYWxsIHNob3J0Y3V0cyBLREVcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ2Jsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ2ZhbHNlJ10pXG4gICAgICAgICAgICAgICAgLy8gYWN0aXZhdGUgQUxMIDNkIEVmZmVjdHMgKHByZXNlbnQgd2luZG93LCBjaGFuZ2UgZGVza3RvcCwgZXRjLikgXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJyAsJy9Db21wb3NpdG9yJywgJ29yZy5rZGUua3dpbi5Db21wb3NpdGluZy5yZXN1bWUnXSlcbiAgICAgICAgICAgICAgICAvLyByZWFjdGl2YXRlIHNob3J0Y3V0c3N5c3RlbVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IGtnbG9iYWxhY2NlbDUmJylcbiAgICAgICAgICAgICAgICAvLyBlbmFibGUgbWV0YSBrZXksIGt3aW4gYW5kIHJlc3RhcnQgcGxhc21hc2hlbGxcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYCR7Y29uZmlnLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJy0tZGVsZXRlJ10pIFxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJyxga3dpbnJjYCwnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHNdKSAgLy9hZGQgcHJldmlvdXMgdmlydHVhbCBkZXNrdG9wc1xuXG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICcnXSlcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pXG4gICAgXG5cblxuXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKVxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUgcGxhc21hc2hlbGwgJicsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWNoZWQ6IHRydWUsICAgICAgICAgICAgICAgLy8gcnVuIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgc3RkaW86ICdpZ25vcmUnICAgICAgICAgICAgICAgLy8gZGlzY29ubmVjdCBzdGRpb1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7ICAgICAgICAgICAgICAgICAgLy8gZnVsbHkgZGV0YWNoIHByb2Nlc3NcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gcmVzZXQgc3BlY2lmaWMgc2hvcnRjdXRzIEdOT01FXG4gICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKXtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pXG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gXSlcbiAgICAgICAgfVxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlcicsIGBvdmVybGF5LWtleWBdKVxuXG4gICAgfVxuXG5cbiAgICAvKioqKioqKioqKioqKioqKlxuICAgICAqICBXIEkgTiBEIE8gVyBTXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAvLyB1bmJsb2NrIGltcG9ydGFudCBrZXlib2FyZCBzaG9ydGN1dHMgKGRpc2FibGUtc2hvcnRjdXRzLmV4ZSlcbiAgICAgICAgLy8gaGllciBnaWJ0IGVzIGlyZ2VuZGVpbmUgcmFjZSBjb25kaXRpb24gb2RlciBhYmhcdTAwRTRuZ2lna2VpdCB2b24gZXhwbG9yZXIuZXhlLiAgZWluZmFjaCByZWloZW5mb2xnZSB1bWtlaHJlbiB1bmQgZWluIHRpbWVvdXQgc2V0emVuXG5cbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHVuYmxvY2tpbmcgc2hvcnRjdXRzLi4uXCIpXG4gICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHRhc2traWxsICAvSU0gXCJkaXNhYmxlLXNob3J0Y3V0cy5leGVcIiAvVCAvRmAsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgdGFza2tpbGwgd2FzIHN1Y2Nlc3NmdWwgKHByb2Nlc3MgZm91bmQgYW5kIGtpbGxlZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGRpc2FibGUtc2hvcnRjdXRzLmV4ZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBJZiBlcnJvciAoZS5nLiBwcm9jZXNzIG5vdCBmb3VuZCksIHNpbGVudGx5IGlnbm9yZSAtIG5vIGxvZ2dpbmcgbmVlZGVkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfWNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RhcnQgZXhwbG9yZXIuZXhlIHdpbmRvd3NzaGVsbCBhZ2FpblxuICAgICAgICAvLyBcdTAwRENiZXJwclx1MDBGQ2ZlLCBvYiBleHBsb3Jlci5leGUgbFx1MDBFNHVmdFxuICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgZXhwbG9yZXIuZXhlXCInLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgdGFza2xpc3QgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBQclx1MDBGQ2ZlLCBvYiBcImV4cGxvcmVyLmV4ZVwiIGluIGRlciBBdXNnYWJlIHZvcmhhbmRlbiBpc3RcbiAgICAgICAgICAgICAgICBpZiAoIXN0ZG91dC5pbmNsdWRlcygnZXhwbG9yZXIuZXhlJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnRlIGV4cGxvcmVyLmV4ZSwgd2VubiBlcyBuaWNodCBsXHUwMEU0dWZ0XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiByZXN0YXJ0aW5nIGV4cGxvcmVyLi4uXCIpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ3N0YXJ0IGV4cGxvcmVyLmV4ZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFjaGVkOiB0cnVlLCAgICAgICAgICAgICAgIC8vIHJ1biBpbmRlcGVuZGVudGx5XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGRpbzogJ2lnbm9yZScgICAgICAgICAgICAgICAvLyBkaXNjb25uZWN0IHN0ZGlvXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7ICAgICAgICAgICAgICAgICAgLy8gZnVsbHkgZGV0YWNoIHByb2Nlc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9Y2F0Y2goZSl7bG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVyZXN0cmljdGlvbnMgKHdpbiBleHBsb3Jlcik6ICR7ZS5tZXNzYWdlfWApfVxuXG5cbiAgICAgICAgLy8gdHJ5e1xuICAgICAgICAvLyAgICAgLy9jbGVhciBjbGlwYm9hcmQgLSBzdG9wIGtlZXBpbmcgc2NyZWVuc2hvdHMgb2YgZXhhbSBpbiBjbGlwYm9hcmRcbiAgICAgICAgLy8gICAgIGxldCBleGVjdXRhYmxlMCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2NsZWFyLWNsaXBib2FyZC5iYXQnKVxuICAgICAgICAvLyAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKGV4ZWN1dGFibGUwLCBbXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAvLyAgICAgICAgIGlmIChzdGRlcnIpIHsgbG9nLmluZm8oc3RkZXJyKSB9XG4gICAgICAgIC8vICAgICAgICAgaWYgKGVycm9yKSB7IGxvZy5pbmZvKGVycm9yKSB9XG4gICAgICAgIC8vICAgICB9KVxuICAgICAgICAvLyB9Y2F0Y2goZSl7bG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVyZXN0cmljdGlvbnMgKHdpbiBjbGlwYm9hcmQpOiAke2UubWVzc2FnZX1gKX1cblxuICAgIH1cblxuICAgIC8vIFRPRE86IHVuZG8gcmVzdHJpY3Rpb25zIG1hYyAoY3VycmVudGx5IG9ubHkgdG91Y2hiYXIgd2hpY2ggc2hvdWxkIGJlIHJlc2V0IG9uY2Ugd2UgY2xvc2UgbmV4dC1leGFtKVxufVxuXG5leHBvcnQge2VuYWJsZVJlc3RyaWN0aW9ucywgZGlzYWJsZVJlc3RyaWN0aW9uc31cbiIsICJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuXG5sZXQgbGFuZ3VhZ2VUb29sSmFyUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJylcbmlmIChhcHAuaXNQYWNrYWdlZCkgeyBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYy9MYW5ndWFnZVRvb2wvbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInKSB9XG5cbmxldCBsYW5ndWFnZVRvb2xDb25maWdQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9MYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKVxuaWYgKGFwcC5pc1BhY2thZ2VkKSB7IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljL0xhbmd1YWdlVG9vbC9zZXJ2ZXIucHJvcGVydGllcycpIH1cblxuXG5cblxuXG5jbGFzcyBMYW5ndWFnZVRvb2xTZXJ2ZXIge1xuICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIEluaXRpYWxpc2llcnQgZGllIFByb3plc3N2YXJpYWJsZVxuICAgICAgICAgdGhpcy5wb3J0ID0gODA4OFxuICAgICB9XG4gXG4gICAgIHN0YXJ0U2VydmVyKCkge1xuICAgICAgICAgaWYgKHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyAmJiAhdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcuJyk7XG4gICAgICAgICAgICAgcmV0dXJuOyAvLyBWZXJoaW5kZXJ0IGRhcyBlcm5ldXRlIFN0YXJ0ZW4sIHdlbm4gZGVyIFNlcnZlciBiZXJlaXRzIGxcdTAwRTR1ZnRcbiAgICAgICAgIH1cbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBKcmVIYW5kbGVyLmpTcGF3bihcbiAgICAgICAgICAgICAgICBbbGFuZ3VhZ2VUb29sSmFyUGF0aF0sIC8vIEtsYXNzZW5wZmFkXG4gICAgICAgICAgICAgICAgJ29yZy5sYW5ndWFnZXRvb2wuc2VydmVyLkhUVFBTZXJ2ZXInLCAvLyBIYXVwdGtsYXNzZSBkZXIgTGFuZ3VhZ2VUb29sIEFQSVxuICAgICAgICAgICAgICAgIFsnLS1wb3J0JywgdGhpcy5wb3J0LCctLWNvbmZpZycsbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCwgJy0tYWxsb3ctb3JpZ2luJywgXCInKidcIiBdIC8vIFp1c1x1MDBFNHR6bGljaGUgQXJndW1lbnRlLCB6LkIuIFBvcnQgdW5kIENPUlMtRXJsYXVibmlzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKVxuICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgQVBJIHJ1bm5pbmcgYXQgbG9jYWxob3N0OjgwODgnKTtcblxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIGRhdGEgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGE6IFJlY2VpdmVkIGRhdGEgZnJvbSBMYW5ndWFnZVRvb2wgQVBJJywgZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdlcnJvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1lcnJvcjonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3N0YXJ0aW5nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjaGVjayBkb25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdoYW5kbGVkIHJlcXVlc3QnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gQWNjdW11bGF0ZSBzdGRlcnIgZGF0YSB0byBoYW5kbGUgY2h1bmtlZCBvdXRwdXRcbiAgICAgICAgICAgIGxldCBzdGRlcnJCdWZmZXIgPSAnJztcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydFN0ciA9IFN0cmluZyh0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGJvdGggY3VycmVudCBjaHVuayBhbmQgYWNjdW11bGF0ZWQgYnVmZmVyIGZvciBwb3J0LXJlbGF0ZWQgZXJyb3JzXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFJlc3BvbnNlID0gc3RkZXJyQnVmZmVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUG9ydEVycm9yID0gZnVsbFJlc3BvbnNlLmluY2x1ZGVzKHBvcnRTdHIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZHJlc3NlIHdpcmQgYmVyZWl0cyB2ZXJ3ZW5kZXRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIk1heWJlIHNvbWV0aGluZyBlbHNlIGlzIHJ1bm5pbmcgb24gdGhhdCBwb3J0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZGRyZXNzIGFscmVhZHkgaW4gdXNlXCIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpc1BvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IGFub3RoZXIgTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBwcm9iYWJseSBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydDonLCB0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuay5pbmNsdWRlcygnXFxuJykgfHwgZnVsbFJlc3BvbnNlLmxlbmd0aCA+IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgd2UgaGF2ZSBhIG5ld2xpbmUgKGxpa2VseSBjb21wbGV0ZSBtZXNzYWdlKSBvciBidWZmZXIgaXMgZ2V0dGluZyBsYXJnZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGEtZXJyb3I6JywgZnVsbFJlc3BvbnNlLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgbG9nZ2luZ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGx0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIFNldHp0IGRlbiBQcm96ZXNzIHp1clx1MDBGQ2NrLCB3ZW5uIGVyIGJlZW5kZXQgd2lyZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZ2VuZXJhbC1lcnJvcjonLCBlcnIpO1xuICAgICAgICB9XG5cblxuICAgICB9XG5cbiAgICAgc3RvcFNlcnZlcigpIHtcbiAgICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWRcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKSB7XG4gICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWQsIG5vdGhpbmcgdG8gc3RvcCcpO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGtpbGwgdGhlIHByb2Nlc3MgZGlyZWN0bHkgaWYgd2UgaGF2ZSBhIHJlZmVyZW5jZVxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBraWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZmFpbGVkIHRvIGtpbGwgcHJvY2VzcyBkaXJlY3RseSwgdHJ5aW5nIHBsYXRmb3JtLXNwZWNpZmljIG1ldGhvZDonLCBlcnIpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBwbGF0Zm9ybS1zcGVjaWZpYyBjb21tYW5kcyB0byBraWxsIHRoZSBwcm9jZXNzIChvbmx5IGlmIHdlIGhhZCBhIHByb2Nlc3MgcmVmZXJlbmNlKVxuICAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICAgbGV0IGNvbW1hbmQ7XG5cbiAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgIC8vIFdpbmRvd3M6IGZpbmQgYW5kIGtpbGwgamF2YSBwcm9jZXNzZXMgcnVubmluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB3bWljICh3b3JrcyBvbiBvbGRlciBXaW5kb3dzKSwgdGhlbiB0cnkgUG93ZXJTaGVsbCwgdGhlbiBmYWxsYmFjayB0byBwb3J0LWJhc2VkIGtpbGxcbiAgICAgICAgICAgICBjb21tYW5kID0gYHdtaWMgcHJvY2VzcyB3aGVyZSBcImNvbW1hbmRsaW5lIGxpa2UgJyVsYW5ndWFnZXRvb2wtc2VydmVyLmphciUnXCIgZGVsZXRlIDI+bnVsIHx8IHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyBqYXZhIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHskXy5Db21tYW5kTGluZSAtbGlrZSAnKmxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyKid9IHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZVwiIDI+bnVsIHx8IGZvciAvZiBcInRva2Vucz01XCIgJWEgaW4gKCduZXRzdGF0IC1hbm8gXnwgZmluZHN0ciA6ODA4OCcpIGRvIHRhc2traWxsIC9GIC9QSUQgJWEgMj5udWxgO1xuICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICAgICAvLyBtYWNPUyBhbmQgTGludXg6IHVzZSBwa2lsbCB0byBraWxsIHByb2Nlc3NlcyBtYXRjaGluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIGNvbW1hbmQgPSAncGtpbGwgLWYgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogdW5zdXBwb3J0ZWQgcGxhdGZvcm06JywgcGxhdGZvcm0pO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIC8vIEl0J3Mgb2theSBpZiB0aGUgcHJvY2VzcyBpcyBub3QgZm91bmQgKGFscmVhZHkga2lsbGVkKVxuICAgICAgICAgICAgICAgICAvLyBwa2lsbCByZXR1cm5zIGNvZGUgMSB3aGVuIG5vIHByb2Nlc3MgaXMgZm91bmQsIHdoaWNoIGlzIGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAxICYmICFlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSAmJiAhc3RkZXJyLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ05vIHN1Y2ggcHJvY2VzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZXJyb3Iga2lsbGluZyBMYW5ndWFnZVRvb2wgc2VydmVyOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBub3QgZm91bmQgKG1heSBhbHJlYWR5IGJlIHN0b3BwZWQpJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBzdG9wcGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgfSk7XG4gICAgIH1cbiB9XG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBMYW5ndWFnZVRvb2xTZXJ2ZXIoKVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbiAvLyBldmVyeSBwbGF0Zm9ybSBuZWVkcyBpdCdzIG93biBqcmUgKGxpbnV4LCB3aW4zMiwgZGFyd2luKSAvL2ZpeG1lOiB1c2UgR3JhYWxWTSB0byBwcmVjb21waWxlIGxhbmd1YWdldG9vbCBpbiBvcmRlciB0byBzYXZlIHNwYWNlIGFuZCBnZXQgcmlkIG9mIGpyZT9cbmNsYXNzIEpyZUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHsgfVxuXG4gICAgaW5pdCgpeyBcbiAgICAgICAgdGhpcy5qVGVzdCgpXG4gICAgfVxuXG4gICAgZmFpbChyZWFzb24pIHtcbiAgICAgICAgbG9nLmVycm9yKHJlYXNvbik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBnZXREaXJlY3RvcmllcyhkaXJQYXRoKSB7XG4gICAgICAgIGxldCBkaXJzID0gZnMucmVhZGRpclN5bmMoZGlyUGF0aCkuZmlsdGVyKFxuICAgICAgICAgICAgZmlsZSA9PiBmcy5zdGF0U3luYyhwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZSkpLmlzRGlyZWN0b3J5KClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGRpcnNcbiAgICB9IFxuXG4gICAgZHJpdmVyKCl7XG4gICAgICAgIHZhciBkID0gcGxhdGZvcm1EaXNwYXRjaGVyLmphdmFCaW4uc2xpY2UoKTtcbiAgICAgICAgZC51bnNoaWZ0KHBsYXRmb3JtRGlzcGF0Y2hlci5qcmVEaXIpO1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luLmFwcGx5KHBhdGgsIGQpO1xuICAgIH1cblxuICAgIGdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKS5zbGljZSgpO1xuICAgICAgICBjbGFzc3BhdGggPSBjbGFzc3BhdGggfHwgW107XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc25hbWUpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NwYXRoLmpvaW4odGhpcy5fcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOicpKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KCctY3AnKTtcbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgalNwYXduKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIFxuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpXG4gICAgICAgIGxldCBqYXZhYXJncyA9IHRoaXMuZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncylcbiAgICAgICAgbGV0IGphdmFjbWRsaW5lID0gIGAke2phdmFwYXRofSAke2phdmFhcmdzLmpvaW4oJyAnKX0gYFxuXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogJyR7cGxhdGZvcm1EaXNwYXRjaGVyLmpyZX0nIHNlbGVjdGVkYClcbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiBzcGF3bmluZyBqYXZhIHByb2Nlc3M6ICR7amF2YWNtZGxpbmV9YClcbiAgICAgICAgcmV0dXJuIHNwYXduKGphdmFwYXRoLCBqYXZhYXJncywge3NoZWxsOmZhbHNlfSk7XG4gICAgICAgLy8gcmV0dXJuIHNwYXduKGphdmFjbWRsaW5lKTtcbiAgICB9XG4gICAgalRlc3QoKXtcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKTsgLy8gJy9wZmFkL3p1ci9qYXZhJ1xuICAgICAgICBjb25zdCBwcm9jID0gc3Bhd24oamF2YXBhdGgsIFsnLXZlcnNpb24nXSk7XG4gICAgXG4gICAgICAgIHByb2Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGRhdGEudG9TdHJpbmcoKS5zcGxpdCgnXFxuJyk7IC8vIGluIFplaWxlbiBzcGxpdHRlblxuICAgICAgICAgICAgbG9nLmRlYnVnKGBqcmUtaGFuZGxlciBAIGpUZXN0OiAke2xpbmVzWzBdfWApOyAvLyBudXIgZGllIGVyc3RlIFplaWxlIGxvZ2dlblxuICAgICAgICB9KTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IEpyZUhhbmRsZXIoKVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbid1c2Ugc3RyaWN0J1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBhcmNoaXZlciBmcm9tICdhcmNoaXZlcicgICAvLyBkYXMgbWFjaHQga3Jhc3Nlc3RlIHJhY2Vjb2RpdGlvbnMgbWl0IGVsZWN0cm9uIGVpZ2VuZW4gdmVyc2lvbmVuIC0gdW5iZWRpbmd0IGRpZSBzZWxiZSB2ZXJzaW9uIGJlaGFsdGVuIHdpZSBlbGVjdHJvblxuaW1wb3J0IGV4dHJhY3QgZnJvbSAnZXh0cmFjdC16aXAnXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IHNjcmVlbiwgaXBjTWFpbiwgYXBwLCBCcm93c2VyV2luZG93LCB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0IHNjcmVlbnNob3QgZnJvbSAnc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQnO1xuaW1wb3J0IHsgV29ya2VyIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBydW5SZW1vdGVDaGVjayB9IGZyb20gJy4vcmVtb3RlQ2hlY2suanMnXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyLmpzJztcblxuY29uc3Qgc2hlbGwgPSAoY21kKSA9PiB7ICAgcmV0dXJuIGV4ZWNTeW5jKGNtZCwgeyBlbmNvZGluZzogJ3V0ZjgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSk7IH07ICAvLyBzdGRlcnIgdW50ZXJkclx1MDBGQ2NrdCBcbmNvbnN0IGFnZW50ID0gbmV3IGh0dHBzLkFnZW50KHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9KTtcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IFxuXG4gLyoqXG4gICogSGFuZGxlcyBpbmZvcm1hdGlvbiBmZXRjaGluZyBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGFjdHMgb24gc3RhdHVzIHVwZGF0ZXNcbiAgKi9cbiBcbiBjbGFzcyBDb21tSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMudXBkYXRlU3R1ZGVudEludGVydmFsbCA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gZmFsc2VcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwIC8vIHdlIGNvdW50IGZhaWxzIGFuZCBkZWFjdGl2YXRlIG9uIDQgY29uc2VxdWVudCBmYWlsc1xuICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gdHJ1ZVxuICAgICAgICB0aGlzLnRpbWVyID0gMFxuICAgICAgICB0aGlzLndvcmtlciA9IG51bGxcbiAgICAgICAgdGhpcy51c2VXb3JrZXIgPSB0cnVlXG4gICAgICAgIHRoaXMud29ya2VyRmFpbHMgPSAwXG4gICAgfVxuIFxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMucmVxdWVzdFVwZGF0ZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuc2VuZFNjcmVlbnNob3QuYmluZCh0aGlzKSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIGlmICghdGhpcy53b3JrZXIgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7ICB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKSAgfVxuICAgIH1cbiBcblxuICAgIC8qKlxuICAgICAqIFNldHVwIHRoZSBpbWFnZSB3b3JrZXJcbiAgICAgKiB1c2VzIGZvcmsgdG8gY3JlYXRlIGEgbmV3IGNoaWxkIHByb2Nlc3NcbiAgICAgKiB1c2VzIHRoZSBpbWFnZVdvcmtlckxpbnV4LmpzIG9yIGltYWdlV29ya2VyU2hhcnAuanMgZmlsZVxuICAgICAqIHRoZSB3b3JrZXIgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSBzY3JlZW5zaG90IGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHNldHVwSW1hZ2VXb3JrZXIoKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlclVSTCA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJVUkw7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyVVJMLCB7IHR5cGU6ICdtb2R1bGUnLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYgfSB9KTtcbiAgICAgICAgbG9nLmRlYnVnKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBJbWFnZVdvcmtlciBpbml0aWFsaXplZC4gVXNpbmcgXCIgKyBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyRmlsZU5hbWUpXG4gICAgICAgIFxuXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdlcnJvcicsIGVycm9yID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyRmFpbHMgKz0gMVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLndvcmtlckZhaWxzID4gNCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBmYWlsZWQgNSB0aW1lcyAtIHN3aXRjaGluZyB0byBubyBwcm9jZXNzaW5nJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBzY3JlZW5zaG90IFxuICAgICAqIGlmIHVzZVdvcmtlciBpcyB0cnVlLCB0aGUgc2NyZWVuc2hvdCBpcyBwcm9jZXNzZWQgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICogb3RoZXJ3aXNlIHRoZSBzY3JlZW5zaG90IGlzIG5vdCBwcm9jZXNzZWQgYW5kIHRoZSBvcmlnaW5hbCBzY3JlZW5zaG90IGlzIHJldHVybmVkXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikge1xuICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLndvcmtlcikgeyAvL3RyaXBsZSBjaGVjayBpZiB3b3JrZXIgaXMgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dvcmtlciBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHsgaW1nQnVmZmVyOiBBcnJheS5mcm9tKGltZ0J1ZmZlciksIGltVmVyc2lvbjogcGxhdGZvcm1EaXNwYXRjaGVyLmltVmVyc2lvbiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyLm9uY2UoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmYWxsYmFjayB0byBubyBwcm9jZXNzaW5nICAgXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gQnVmZmVyLmZyb20oaW1nQnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJCYXNlNjQgPSBzY3JlZW5zaG90QmFzZTY0XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBzY3JlZW5zaG90QmFzZTY0OiBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQ6IGhlYWRlckJhc2U2NCwgaXNibGFjazogZmFsc2UsIGltZ0J1ZmZlcjogaW1nQnVmZmVyIH07XG5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuICAgIC8qKiBcbiAgICAgKiBVcGRhdGUgY3VycmVudCBTZXJ2ZXJzdGF0dXMgKyBTdHVkZW50dHN0YXR1cyAoZXZlcnkgNSBzZWNvbmRzKVxuICAgICAqL1xuICAgIGFzeW5jIHJlcXVlc3RVcGRhdGUoKXtcblxuICAgICAgICB0aGlzLnRpbWVyKysgICAvLyB3ZSB1c2UgdGltZXIgdG8gdGltZSBsb29wcyB3aXRoIGRpZmZlcmVudCBpbnRlcnZhbHMgd2l0aG91dCBpbnRyb2R1Y2luZyBuZXcgdW5uZWNjZXNhcnkgc2NoZWR1bGVyc1xuICAgICAgICBpZiAodGhpcy50aW1lciAlIDIwID09PSAwICl7ICAvLyBydW4gZXZlcnkgMjAqNSAodXBkYXRlbG9vcCkgc2Vjb25kc1xuXG4gICAgICAgICAgICBjb25zdCB1c2VzUmVtb3RlQXNzaXN0YW50ID0gYXdhaXQgcnVuUmVtb3RlQ2hlY2socHJvY2Vzcy5wbGF0Zm9ybSlcblxuICAgICAgICAgICAgaWYgKHVzZXNSZW1vdGVBc3Npc3RhbnQpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlYWR5OiBQb3NzaWJsZSByZW1vdGUgYXNzaXN0YW5jZSBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LmtleXdvcmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IEtleXdvcmQgJHtrZXl3b3JkfSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvcnQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5wb3J0cykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBQb3J0ICR7cG9ydH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnQgPSB1c2VzUmVtb3RlQXNzaXN0YW50XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKSAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgc2NyZWVuIHRoYXQgbmVlZHMgdG8gYmUgYmxvY2tlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZCAgbm8gc2VydmVyc2lnbmFsIGZvciAyMCBzZWNvbmRzXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7ICBcbiAgICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IENvbm5lY3Rpb24gdG8gVGVhY2hlciBsb3N0ISBSZW1vdmluZyByZWdpc3RyYXRpb24uXCIpIC8vcmVtb3ZlIHNlcnZlciByZWdpc3RyYXRpb24gbG9jYWxseSAoc2FtZSBhcyAna2ljaycpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSAgIC8vIHRoaXMgYWxzbyByZXNldHMgc2VydmVyaXAgdGhlcmVmb3JlIG5vIGFwaSBjYWxscyBhcmUgbWFkZSBhZnRlcndhcmRzXG4gICAgICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpICAgICAgIC8vIGp1c3QgaW4gY2FzZSBzY3JlZW5zIGFyZSBibG9ja2VkLi4gbGV0IHN0dWRlbnRzIHdvcmtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgXG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7Y2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb31cblxuICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsgdGhyb3cgbmV3IEVycm9yKCdOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgICAgICAoZGF0YS5tZXNzYWdlID09PSBcIm5vdGF2YWlsYWJsZVwiKXsgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogRXhhbSBJbnN0YW5jZSBub3QgZm91bmQhJyk7ICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDU7IH0gICAgLy8gZXhhbSBpbnN0YW5jZSBub3QgYXZhaWxhYmxlIGJ1dCBzZXJ2ZXIgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdGEubWVzc2FnZSA9PT0gXCJyZW1vdmVkXCIpeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogU3R1ZGVudCByZWdpc3RyYXRpb24gbm90IGZvdW5kIScpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoKVxuICAgICAgICAgICAgICAgICAgICB9ICAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIC0gd2UgaGFuZGxlIHRoaXMgZGlmZmVyZW50bHkgbm93LiB0ZWFjaGVyIHN0b3JlcyBcImtpY2tlZFwiIGZvciBzdHVkZW50IHRvIGNvbGxlY3QuIHN0dWRlbnQgaXMgcmVtb3ZlZCBmcm9tIHNlcnZlciB3aGVuIGNvbGxlY3Rpbmcga2lja2VkIGluZm8uIHN0dWRlbnQgY2xvc2VzIGV4YW0gYW5kIGNsZWFucyB1cC5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9IEhlYXJ0YmVhdCBsb3N0Li5gKTsgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7fSAgIC8vIGhlYXJ0YmVhdCBsb3N0IHNlcnZlciBub3QgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwOyAvLyBEaWVzIHpcdTAwRTRobHQgZWJlbmZhbGxzIGFscyBlcmZvbGdyZWljaGVyIEhlYXJ0YmVhdCAtIFZlcmJpbmR1bmcgaGFsdGVuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc2VydmVyc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zdHVkZW50c3RhdHVzKSk7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlclN0YXR1c0RlZXBDb3B5LCBzdHVkZW50U3RhdHVzRGVlcENvcHkpOy8vIFZlcmFyYmVpdHVuZyBkZXIgZW1wZmFuZ2VuZW4gRGF0ZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAoJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0pICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgLy8gcHJldmVudCBmb2N1cyB3YXJuaW5nIGJsb2NrIGlmIG5vIGNvbm5lY3Rpb24gXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gaWYgbm90IGNvbm5lY3RlZCBidXQgc3RpbGwgaW4gZXhhbSBtb2RlIHlvdSBjb3VsZCB0cmlnZ2VyIGEgZm9jdXMgd2FybmluZyBhbmQgbm9ib2R5IGlzIGFibGUgdG8gdW5sb2NrIHlvdVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIGFzeW5jIHNlbmRTY3JlZW5zaG90KCl7XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXtyZXR1cm59ICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjazsgLy8gVmFyaWFibGVuIGF1XHUwMERGZXJoYWxiIGRlcyBpZi1CbG9ja3MgZGVmaW5pZXJlblxuICAgICAgICAgICAgbGV0IGltZ0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIHNjcmVlbnNob3QgZnJvbSBkZXNrdG9wIHZpYSBzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCAoZmxhbWVzaG90LCBpbWFnZW1hZ2ljLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3QoeyBmb3JtYXQ6ICdwbmcnIH0pO1xuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2ssIGltZ0J1ZmZlciB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7ICAvLyBrZWluIGltYWdlQnVmZmVyIG1pdGdlZ2ViZW4gYmVkZXV0ZXQgbnV0emUgc2NyZWVuc2hvdC1kZXNrdG9wIGltIHdvcmtlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcykgeyB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDA7fVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbWFnZSBwcm9jZXNzaW5nIGZhaWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIFwic2NyZWVuc2hvdFwiIGZyb20gYXBwd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Rm9jdXNlZE1pbmRvdyA9IFdpbmRvd0hhbmRsZXIuZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSAgLy9yZXR1cm5zIGV4YW0gd2luZG93IGlmIG5vdGhpbmcgaW4gZm9jdXMgb3IgbWFpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRGb2N1c2VkTWluZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY3VycmVudEZvY3VzZWRNaW5kb3cud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKSAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIHdvcmsgYmVjYXVzZSBpdCdzIG9uYm9hcmQgZWxlY3Ryb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IHJlc3VsdC50b1BORygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgLy8gYXR0ZW50aW9uIHByb2Nlc3NJbWFnZSAgY29udmVydHMgYnVmZmVyIHRvIHVpbnQ4YXJyYXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzICs9MTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IHByb2Nlc3NJbWFnZSBmYWlsZWQ6ICR7ZXJyfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNQUNPUyBXT1JLQVJPVU5EIC0gc3dpdGNoIHRvIHBhZ2VjYXB0dXJlIGlmIG5vIHBlcm1pc3NvbnMgYXJlIGdyYW50ZWRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgJiYgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCAmJiBpbWdCdWZmZXIgIT09IG51bGwpeyAgLy90aGlzIGlzIGZvciBtYWNPUyBiZWNhdXNlIGl0IGRlbGl2ZXJzIGEgYmxhbmsgYmFja2dyb3VuZCBzY3JlZW5zaG90IHdpdGhvdXQgcGVybWlzc2lvbnMuIHdlIGNhdGNoIHRoYXQgY2FzZSB3aXRoIGEgd29ya2Fyb3VuZFxuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSBmYWxzZSAgIC8vbmV2ZXIgZG8gdGhpcyBhZ2FpblxuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBhcHAuaXNQYWNrYWdlZCA/IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycpIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhOiB7IHRleHQgfSB9ICAgPSBhd2FpdCBUZXNzZXJhY3QucmVjb2duaXplKGltZ0J1ZmZlciAsICdlbmcnLHsgbGFuZ1BhdGg6IHB1YmxpY1BhdGggfSApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwV2luZG93VmlzaWJsZSA9IHRleHQuaW5jbHVkZXMoXCJFeGFtXCIpICAgLy9jaGVjayBpZiB0aGUgd29yZCBcIkV4YW1cIiBjYW4gYmUgZm91bmQgaW4gc2NyZWVuc2hvdCAtIG90aGVyd2lzZSBpdCBpcyBtb3N0IGxpa2VseSBhIGJsYW5rIGRlc2t0b3AgLSBtYWNvcyBxdWlya1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFwcFdpbmRvd1Zpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IFBsZWFzZSBjaGVjayB5b3VyIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgLSBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBNYWNPUyBzY3JlZW5zaG90cGVybWlzc2lvbnMgY2hlY2sgT0tcIik7fVxuICAgICAgICAgICAgICAgIH1jYXRjaChlcnIpeyAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gaWYgc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2UgZG8gbm90IGhhdmUgYSBzY3JlZW5zaG90IC0gc28gZG8gbm90IHVwZGF0ZSB0aGUgc2VydmVyXG4gICAgICAgICAgICBpZiAoIXNjcmVlbnNob3RCYXNlNjQpe1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU2NyZWVuc2hvdCBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVgKSB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFBhZ2VDYXB0dXJlIGVycm9yIC0+IFN3aXRjaGluZyB0byBOby1Qcm9jZXNzaW5nYCkgfSAgIFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBubyBzY3JlZW5zaG90IGF2YWlsYWJsZSAtIHBsZWFzZSBmaXggeW91ciBzZXR1cGApIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuXG5cblxuICAgICAgICAgICAgLy9kbyBub3QgcnVuIGNvbG9yY2hlY2sgaWYgYWxyZWFkeSBsb2NrZWRcbiAgICAgICAgICAgIGlmICggdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyl7XG4gICAgICAgICAgICAgICAgaWYgKGlzYmxhY2spe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgZml0IHJlcXVpcmVtZW50cyAoYWxsYmxhY2spXCIpO1xuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBsZXQgc2NyZWVuc2hvdGhhc2ggPSBudWxsXG4gICAgICAgICAgICB0cnkgeyBzY3JlZW5zaG90aGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICB9ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogY3JlYXRpbmcgaGFzaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3Q6IHNjcmVlbnNob3RCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGhhc2g6IHNjcmVlbnNob3RoYXNoLFxuICAgICAgICAgICAgICAgIGhlYWRlcjogaGVhZGVyQmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RmaWxlbmFtZTogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiArIFwiLmpwZ1wiLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHNlbmQgc2NyZWVuc2hvdCB0byBzZXJ2ZXIgdmlhIGVtYWlsIGZldGNoIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBhdHRlbXB0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAyO1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZXNjcmVlbnNob3RgO1xuICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCwgbWF4UmV0cmllcyk7IC8vIEVyc3RlIEFuZnJhZ2Ugc3RhcnRlblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cbiAgICBkb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCA9IDAsIG1heFJldHJpZXMpIHtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBTdGF0dXMgRXJyb3I6XCIsIGRhdGEubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heFJldHJpZXMgLSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCArIDEsIG1heFJldHJpZXMpOyAvLyBSZXRyeVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRlbXB0ID09PSBtYXhSZXRyaWVzIC0gMSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGUgKGZldGNoKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuICAgIGFzeW5jIGtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lja1N0dWRlbnQ6IFN0dWRlbnQgZ290IGtpY2tlZCBieSBUZWFjaGVyXCIpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge2RlbGZvbGRlcm9uZXhpdDogZmFsc2V9ICAvLyBkbyBub3QgZGVsZXRlIGZvbGRlciBvbiBleGl0IGJlY2F1c2Ugc3R1ZGVudCBnb3Qga2lja2VkXG4gICAgICAgIGlmIChzdHVkZW50c3RhdHVzICYmIHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyKXsgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9IHRydWV9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogcmVhY3QgdG8gc2VydmVyIHN0YXR1cyBcbiAgICAgKiB0aGlzIGN1cnJlbnRseSBvbmx5IGhhbmRsZSBzdGFydGV4YW0gJiBlbmRleGFtXG4gICAgICogY291bGQgYWxzbyBoYW5kbGUga2ljaywgZm9jdXNyZXN0b3JlLCBhbmQgZXZlbiB0cmlnZ2VyIGZpbGUgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJzdGF0dXMsIHN0dWRlbnRzdGF0dXMpe1xuICAgICAgIFxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGluZGl2aWR1YWwgc3RhdHVzIHVwZGF0ZXNcblxuICAgICAgICBpZiAoIHN0dWRlbnRzdGF0dXMgJiYgT2JqZWN0LmtleXMoc3R1ZGVudHN0YXR1cykubGVuZ3RoICE9PSAwKSB7ICAvLyB3ZSBoYXZlIHN0YXR1cyB1cGRhdGVzICh0YXNrcykgLSBkbyBpdCFcbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnByaW50ZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2RlbmllZCcpICAgLy90cmlnZ2VyLCB3aHlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMua2lja2VkKSB7ICAvLyBzdHVkZW50IGdvdCBraWNrZWQgYnkgdGVhY2hlclxuICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cylcbiAgICAgICAgICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyXCIpXG4gICAgICAgICAgICAgICAgbGV0IGRlbGZvbGRlciA9IHRydWVcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxuICAgICAgICAgICAgICAgICAgICBkZWxmb2xkZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyb3IpICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDYW4gbm90IGRlbGV0ZSBkaXJlY3RvcnkgLSAke2Vycm9yfSBgKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIgPT0gZmFsc2UpeyAgLy90cnkgZGVsZXRpbmcgZmlsZSBieSBmaWxlICh0aGUgb25lIHRoYXQgY2F1c2VzIHRoZSBwcm9ibGVtIHdpbGwgc3RheSBpbiB0aGUgZm9sZGVyKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7IGZzLnJtU3luYyhmaWxlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIFZlcnN1Y2hlLCBkYXMgVmVyemVpY2huaXMgcmVrdXJzaXYgenUgbFx1MDBGNnNjaGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBmcy51bmxpbmtTeW5jKGZpbGVQYXRoKTsgIH0vLyBWZXJzdWNoZSwgZGllIERhdGVpIHp1IGxcdTAwRjZzY2hlbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogKGRlbGZvbGRlcikgRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuIGRlciBEYXRlaS9WZXJ6ZWljaG5pczogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mb2N1cyA9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHJlc3RvcmluZyBmb2N1cyBzdGF0ZSBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSB0cnVlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IGZhbHNlICApe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IHRydWUgIC8vY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjayB3aWxsIGJlIHB1dCBvbiB0aGlzLnByaXZhdGVTcGVsbGNoZWNrIGluIGVkaXRvciB1cGRhdGVkIHZpYSBmZXRjaEluZm8oKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlwY01haW4uZW1pdChcInN0YXJ0TGFuZ3VhZ2VUb29sXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IGZhbHNlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBkZS1hY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IGZhbHNlIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLnN1Z2dlc3Rpb25zID0gc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5zZW5kZXhhbSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRXhhbVRvVGVhY2hlcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mZXRjaGZpbGVzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RGaWxlRnJvbVNlcnZlcihzdHVkZW50c3RhdHVzLmZpbGVzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGFuIG1pY3Jvc29mdDM2NSB0aGluZy4gY2hlY2sgaWYgZXhhbSBtb2RlIGlzIG9mZmljZSwgY2hlY2sgaWYgdGhpcyBpcyBzZXQgLSBvdGhlcndpc2UgZG8gbm90IGVudGVyIGV4YW1tb2RlIC0gaXQgd2lsbCBmYWlsXG4gICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgc2hhcmluZyBsaW5rIC0gaXQgd2lsbCBiZSB1c2VkIGluIFwibWljcm9zb2Z0MzY1XCIgZXhhbSBtb2RlXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBzdHVkZW50c3RhdHVzLm1zb2ZmaWNlc2hhcmUgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgZ3JvdXAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgIT09IHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gc3R1ZGVudHN0YXR1cy5ncm91cCAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgXG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gZ2xvYmFsIHN0YXR1cyB1cGRhdGVzXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBTVEFSVFxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBpZiBzdHVkZW50IGlzIGluIGxvY2tlZCBzdGF0ZSBpbiBleGFtIG1vZGVcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIGN1cnJlbnQgYWN0aXZlIHNlY3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgc2VydmVyc3RhdHVzIC0gaWYgbm90IGNoYW5nZSB0byB0aGUgbmV3IHNlY3Rpb25cbiAgICAgICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbiAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2hhbmdpbmcgc2VjdGlvbiB0byAke3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9ufSAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lfSAsIEV4YW10eXBlOiAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlfWAgKVxuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRMb2NrZWRTZWN0aW9uID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uOyAvLyBDdXJyZW50IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIHNhdmluZylcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb247IC8vIE5ldyBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBsb2FkaW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1EaXIgPSB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5O1xuXG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgYWxsIGZpbGVzIGZyb20gdGhlIG9sZCBzZWN0aW9uIChpZiBleGFtIG1vZGUgaXMgXCJlZGl0b3JcIikgYW5kIHNlbmQgdG8gdGVhY2hlciAtIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPT09IFwiZWRpdG9yXCIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHNlbmRpbmcgZXhhbSB0byB0ZWFjaGVyIChmaW5hbCBzdWJtaXQpXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCBjdXJyZW50IHdvcmsgYXMgYmFzZTY0IHRvIHRlYWNoZXIgKHN0b3JlcyBwZGYgaW4gQUJHQUJFIGZvbGRlciB3aXRoIHN1Ym1pc3Npb24gbnVtYmVyKVxuICAgICAgICAgICAgICAgICAgICBsZXQgcGRmID0gYXdhaXQgdGhpcy5nZXRCYXNlNjRQREYodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2N1cnJlbnRMb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZSkgIC8vIGxvY2FsIGZ1bmN0aW9uIHRvIGdldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChwZGYuc3RhdHVzID09PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRCYXNlNjRQREZ0b1RlYWNoZXIocGRmLmJhc2U2NHBkZiwgY3VycmVudExvY2tlZFNlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgLy9iYWNrdXAgbG9jYWwgZmlsZXMgYW5kIHNlbmQgdG8gdGVhY2hlciAoYXJjaGl2ZSB3aXRoIHRpbWVzdGFtcClcblxuXG4gICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAvL3dhaXQgMSBzZWNvbmQgYW5kIGNsZWFudXAgTkVYVC1FWEFNLVNUVURFTlQtV09SS0RJUlxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMClcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBleGFtdHlwZSBpbiBjbGllbnRpbmZvXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NrZWQgc2VjdGlvbiBBRlRFUiBzYXZpbmcgdGhlIG9sZCBzdGF0ZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IG5ld0xvY2tlZFNlY3Rpb247XG5cblxuXG4gICAgICAgICAgICAgICAgLy8gTU9WRSBTZWN0aW9uIEZpbGVzIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAxOiBTQVZFIENVUlJFTlQgRVhBTURJUiBGSUxFUyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGV4YW1EaXIpICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkgeyAvLyBDaGVjayBpZiBtYWluIGRpciBleGlzdHMgYW5kIGEgc2VjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2aW5nIGNvbnRlbnQgZnJvbSBleGFtRGlyIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVQYXRoID0gYCR7ZXhhbURpcn0vJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNhdmVQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhzYXZlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IC8vIENyZWF0ZSBzYXZlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGV4YW1EaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXMubGVuZ3RofSBpdGVtcyBpbiBleGFtRGlyIHRvIHNhdmVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzU2F2ZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhvbGRQYXRoKTsgLy8gR2V0IGZpbGUgc3RhdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgYWN0dWFsIEZJTEVTLCBub3QgZGlyZWN0b3JpZXMgKGxpa2UgdGhlIHNlY3Rpb24gZm9sZGVycyB0aGVtc2VsdmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtzYXZlUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhvbGRQYXRoLCBuZXdQYXRoKTsgLy8gQ29weSBmaWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkUGF0aCk7IC8vIERlbGV0ZSBvcmlnaW5hbCBmaWxlIGZyb20gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc1NhdmVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZlZCBmaWxlICR7ZmlsZX0gdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSAoZm9sZGVyKSBpdGVtICR7ZmlsZX0gaW4gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgc2F2ZWQgJHtmaWxlc1NhdmVkfSBmaWxlcyB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgc2F2ZSAtIGV4YW1EaXIgZXhpc3RzOiAke2ZzLmV4aXN0c1N5bmMoZXhhbURpcil9LCBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDI6IExPQUQgRklMRVMgZnJvbSB0aGUgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBORVcgbG9ja2VkIHNlY3Rpb24gdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIG5ld0xvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBMb2FkaW5nIGNvbnRlbnQgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9hZFBhdGggPSBgJHtleGFtRGlyfS8ke25ld0xvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvYWRQYXRoKSkgeyAvLyBDaGVjayBpZiB0aGUgbmV3IHNlY3Rpb24gZm9sZGVyIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0gZnMucmVhZGRpclN5bmMobG9hZFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzVG9Mb2FkLmxlbmd0aH0gaXRlbXMgaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc0NvcGllZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzVG9Mb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVBhdGggPSBgJHtsb2FkUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7IC8vIEVuc3VyZSBvbmx5IGZpbGVzIGFyZSBjb3BpZWQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNvdXJjZVBhdGgsIGRlc3RQYXRoKTsgLy8gQ29weSBmaWxlIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29waWVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ29waWVkIGZpbGUgJHtmaWxlfSBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgaXRlbSAke2ZpbGV9IGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IGNvcGllZCAke2ZpbGVzQ29waWVkfSBmaWxlcyBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTmV3IGxvY2tlZCBzZWN0aW9uIGRpcmVjdG9yeSAke25ld0xvY2tlZFNlY3Rpb259IGRvZXMgbm90IGV4aXN0LiBTdGFydGluZyB3aXRoIGEgY2xlYW4gc3RhdGUuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogbmV3TG9ja2VkU2VjdGlvbiBpcyBmYWxzeSAoJHtuZXdMb2NrZWRTZWN0aW9ufSksIHNraXBwaW5nIGZpbGUgbG9hZGApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBkdXJpbmcgZm9sZGVyIG9wZXJhdGlvbiAtICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3Igc3RhY2s6ICR7ZXJyb3Iuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259LCBuZXdMb2NrZWRTZWN0aW9uOiAke25ld0xvY2tlZFNlY3Rpb259LCBleGFtRGlyOiAke2V4YW1EaXJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICogIEFjdHVhbGx5IFNXSVRDSCBFWEFNIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IG9yIHJlbGVhZCB0aGUgbmV3IGV4YW0gc2VjdGlvbiBpbiB0aGUgc2FtZSB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3cgLSBpZiB5b3UgZG9uJ3QgbmV4dC1leGFtIHdpbGwgY3Jhc2ggc2lsZW50bHkgb24gcmVsb2FkIGFuZCBzZWN0aW9uIHN3aXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpLmZvckVhY2god2MgPT4geyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzd2l0Y2hFeGFtU2VjdGlvbjogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgYW5kIHJlb3BlbiBpdCB3aXRoIHRoZSBuZXcgZXhhbSBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cub25jZSgnY2xvc2VkJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBFTkRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgIFxuXG5cbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2spIHsgIHRoaXMuYWN0aXZhdGVTY3JlZW5sb2NrKCkgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgKSB7IHRoaXMua2lsbFNjcmVlbmxvY2soKSB9XG5cbiAgICAgICAgLy8gc2NyZWVuc2hvdCBzYWZldHkgKE9DUiBzZWFyY2hlcyBmb3IgbmV4dC1leGFtIHN0cmluZylcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyKSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IHRydWUgIH1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IGZhbHNlICAgfVxuXG4gICAgICAgIC8vIEdyb3VwcyBoYW5kbGluZ1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZ3JvdXBzKXsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSB0cnVlfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSBmYWxzZX1cblxuICAgICAgICAvL3VwZGF0ZSBzY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgfHwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PT0gMCkgeyAvLzAgaXMgdGhlIHNhbWUgYXMgZmFsc2Ugb3IgdW5kZWZpbmVkIGJ1dCBzaG91bGQgYmUgdHJlYXRlZCBhcyBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsICE9PSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDAgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgY2hhbmdlZCB0b1wiLCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDApXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDBcbiAgICAgICAgICAgICAgICAgIGlmICggc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGRpc2FibGVkIVwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBvbGQgaW50ZXJ2YWwgYW5kIHN0YXJ0IG5ldyBpbnRlcnZhbCBpZiBzZXQgdG8gc29tZXRoaW5nIGJpZ2dlciB0aGFuIHplcm9cbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID4gMCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5pbnRlcnZhbCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAvLyByZW1vdmUgbG9ja3NjcmVlbiBpbW1lZGlhdGVseSAtIGRvbid0IHdhaXQgZm9yIHNlcnZlciBpbmZvXG4gICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSBcbiAgICAgICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIHNlbmQgYmFzZTY0IHBkZiB0byB0ZWFjaGVyXG4gICAgc2VuZEJhc2U2NFBERnRvVGVhY2hlcihiYXNlNjRwZGYsIHNlY3Rpb249MSl7XG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wcmludHJlcXVlc3QvJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn1gO1xuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGJhc2U2NHBkZixcbiAgICAgICAgICAgIHByaW50cmVxdWVzdDogZmFsc2UsICAgIFxuICAgICAgICAgICAgc3VibWlzc2lvbm51bWJlcjogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLFxuICAgICAgICAgICAgbG9ja2Vkc2VjdGlvbjogc2VjdGlvblxuICAgICAgICB9XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHsgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTsgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZSA9PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyKysgICAvLyBzdWNjZXNzZnVsIHN1Ym1pc3Npb24gLT4gaW5jcmVtZW50IG51bWJlclxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4geyAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImVkaXRvciBAIHByaW50YmFzZTY0OlwiLGVycm9yLm1lc3NhZ2UpICAgIFxuICAgICAgICB9KTsgXG4gICAgfVxuICAgIFxuXG5cblxuICAgIC8vZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAvLyBBVFRFTlRJT046IHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gaXBjaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCBzdG9yZXMgaXQgYXMgZmlsZSBpbiB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICBhc3luYyBnZXRCYXNlNjRQREYoc3VibWlzc2lvbm51bWJlciwgc2VjdGlvbm5hbWUsIHByaW50QmFja2dyb3VuZD1mYWxzZSl7XG4gICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHByaW50QmFja2dyb3VuZCxcbiAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuXG4gIFxuICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3NlY3Rpb25uYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7QWJnYWJlOiAke3N1Ym1pc3Npb25udW1iZXJ9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uY2xpZW50bmFtZX0gLSAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0gLSBWZXJzaW9uICR7c3VibWlzc2lvbm51bWJlcn1cImApO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0cGRmID0gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2Jhc2U2NHBkZn1gO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwiUERGIGdlbmVyYXRlZFwiLCBkYXRhVXJsOmRhdGFVcmwsIGJhc2U2NHBkZjogYmFzZTY0cGRmLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJFcnJvciBnZW5lcmF0aW5nIFBERjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVycm9yIGdlbmVyYXRpbmcgUERGXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzaG93IHRlbXBvcmFyeSBzY3JlZW5sb2NrIHdpbmRvd1xuICAgIGFjdGl2YXRlU2NyZWVubG9jaygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG4gICAgICAgXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmxlbmd0aCA9PSAwKXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSB0cnVlXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkgIC8vIGFkZCBzY3JlZW5sb2NrIHdpbmRvd3MgZm9yIGFkZGl0aW9uYWwgZGlzcGxheXNcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgdGVtcG9yYXJ5IHNjcmVlbmxvY2t3aW5kb3dcbiAgICBraWxsU2NyZWVubG9jaygpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVubG9ja3dpbmRvdyAmJiAhc2NyZWVubG9ja3dpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuY2xvc2UoKTsgXG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpbGxTY3JlZW5sb2NrOiBubyBmdW5jdGlvbmFsIHNjcmVlbmxvY2t3aW5kb3cgdG8gaGFuZGxlXCIpXG4gICAgICAgIH0gXG4gICAgICAgIC8vIENsZWFyIGFycmF5IGNvbXBsZXRlbHkgYWZ0ZXIgYXR0ZW1wdGluZyB0byBkZXN0cm95IGFsbCB3aW5kb3dzXG4gICAgICAgIC8vIFRoZSBjbG9zZWQgZXZlbnQgaGFuZGxlciB3aWxsIGFsc28gY2xlYW4gdXAsIGJ1dCB0aGlzIGVuc3VyZXMgdGhlIGFycmF5IGlzIGVtcHR5XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSBmYWxzZVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIGV4YW0gbW9kZSBmb3Igc3R1ZGVudFxuICAgICAqIGRlbGV0ZXMgd29ya2ZvbGRlciBjb250ZW50cyAoaWYgc2V0KVxuICAgICAqIG9wZW5zIGEgbmV3IHdpbmRvdyBpbiBraW9zayBtb2RlIHdpdGggdGhlIGdpdmVuIGV4YW10eXBlXG4gICAgICogZW5hYmxlcyB0aGUgYmx1ciBsaXN0ZW5lciBhbmQgYWN0aXZhdGVzIHJlc3RyaWN0aW9ucyAoZGlzYWJsZSBrZXlib2Fyc2hvcnRjdXRzIGV0Yy4pXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyBjb250YWlucyBpbmZvcm1hdGlvbiBhYm91dCBleGFtbW9kZSwgZXhhbXR5cGUsIGFuZCBvdGhlciBzZXR0aW5ncyBmcm9tIHRoZSB0ZWFjaGVyIGluc3RhbmNlXG4gICAgICovXG4gICAgYXN5bmMgc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBkaWFsb2cgaXMgb3BlbiBhbmQgbG9nIHdhcm5pbmdcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhpdFdhcm5pbmdPcGVuIHx8IFdpbmRvd0hhbmRsZXIuZXhpdFF1ZXN0aW9uT3BlbiB8fCBXaW5kb3dIYW5kbGVyLm1pbmltaXplV2FybmluZ09wZW4pIHtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IERpYWxvZyBpcyBzdGlsbCBvcGVuIC0gZXhhbSB3aWxsIHN0YXJ0IGFueXdheVwiKVxuICAgICAgICB9XG4gIFxuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG5cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5jbWFyZ2luID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uY21hcmdpbiAgLy8gdGhpcyBpcyB1c2VkIHRvIGNvbmZpZ3VyZSBtYXJnaW4gc2V0dGluZ3MgZm9yIHRoZSBlZGl0b3JcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5saW5lc3BhY2luZyA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmxpbmVzcGFjaW5nIC8vIHdlIHRyeSB0byBkb3VibGUgbGluZXNwYWNpbmcgb24gZGVtYW5kIGluIHBkZiBjcmVhdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmF1ZGlvUmVwZWF0ID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uYXVkaW9SZXBlYXQgLy8gcmVzdHJpY3QgcmVwZXRpdGlvbiBvZiBhdWRpbyBmaWxlcyAoZm9yIGxpc3RlbmluZyBjb21wcmVoZW5zaW9uKVxuXG4gICAgICAgIGlmICghV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBjcmVhdGluZyBleGFtIHdpbmRvd1wiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZUV4YW1XaW5kb3coc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUsIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vcmVjb25uZWN0IGludG8gYWN0aXZlIGV4YW0gc2Vzc2lvbiB3aXRoIGV4YW0gd2luZG93IGFscmVhZHkgb3BlblxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGZvdW5kIGV4aXN0aW5nIEV4YW13aW5kb3cuLlwiKVxuICAgICAgICAgICAgdHJ5IHsgIC8vIHN3aXRjaCBleGlzdGluZyB3aW5kb3cgYmFjayB0byBleGFtIG1vZGVcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpIFxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRGdWxsU2NyZWVuKHRydWUpICAvL2dvIGZ1bGxzY3JlZW4gYWdhaW5cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpICAvL21ha2Ugc3VyZSB0aGUgd2luZG93IGlzIDEgbGV2ZWwgYWJvdmUgZXZlcnl0aGluZ1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVSZXN0cmljdGlvbnMoV2luZG93SGFuZGxlcilcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDAwKSAvLyB3YWl0IGFuIGFkZGl0aW9uYWwgMiBzZWMgZm9yIHdpbmRvd3MgcmVzdHJpY3Rpb25zIHRvIGtpY2sgaW4gKHRoZXkgc3RlYWwgZm9jdXMpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuYWRkQmx1ckxpc3RlbmVyKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZvciByZWNvbm5lY3Q6IGluaXRpYWxpemUgYmxvY2sgd2luZG93cyBhZnRlciB3aW5kb3cgaXMgcmVwb3NpdGlvbmVkXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHsgLy9leGFtd2luZG93IHZhcmlhYmxlIGlzIHN0aWxsIHNldCBidXQgdGhlIHdpbmRvdyBpcyBub3QgbWFuYWdhYmxlIGFueW1vcmUgKG1hbnVhbGx5IGNsb3NlZCBpbiBkZXYgbW9kZT8pXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IG5vIGZ1bmN0aW9uYWwgZXhhbXdpbmRvdyBmb3VuZC4uIHJlc2V0dGluZ1wiKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoV2luZG93SGFuZGxlci5leGFtd2luZG93KSAgLy9leGFtd2luZG93IGlzIGdpdmVuIGJ1dCBub3QgdXNlZCBpbiBkaXNhYmxlUmVzdHJpY3Rpb25zXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVybiAgLy8gaW4gdGhhdCBjYXNlLi4gd2UgYXJlIGZpbmlzaGVkIGhlcmUgIVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vdGU6IEZvciBuZXcgZXhhbSB3aW5kb3dzLCBpbml0QmxvY2tXaW5kb3dzKCkgaXMgY2FsbGVkIGluIGRpZC1maW5pc2gtbG9hZCBoYW5kbGVyXG4gICAgICAgIC8vIHRvIGVuc3VyZSB3aW5kb3cgaXMgZnVsbHkgcG9zaXRpb25lZCAoaW1wb3J0YW50IGZvciBXYXlsYW5kL0tXaW4pXG4gICAgfVxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyBFeGFtIG1vZGVcbiAgICAgKiBjbG9zZXMgZXhhbSB3aW5kb3dcbiAgICAgKiBkaXNhYmxlcyByZXN0cmljdGlvbnMgYW5kIGJsdXIgXG4gICAgICovXG4gICAgYXN5bmMgZW5kRXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICBcbiAgICAgICAgV2luZG93SGFuZGxlci5yZW1vdmVCbHVyTGlzdGVuZXIoKTtcbiAgICAgIFxuICAgICAgICAvL29ubHkgZGlzYWJsZSByZXN0cmljdGlvbnMgaWYgbm90IGluIGV4YW0gbW9kZSAoIHNlcmlvc3VseS4uIGhvdyBjb3VsZCB0aGlzIGV2ZXIgaGFwcGVuPyApXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucygpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxldGUgc3R1ZGVudHMgd29yayBvbiBzdHVkZW50cyBwYyAobWFrZXMgc2Vuc2UgaWYgZXhhbSBpcyB3cml0dGVuIG9uIHNjaG9vbCBwcm9wZXJ0eSlcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cyAmJiBzZXJ2ZXJzdGF0dXMuZGVsZm9sZGVyb25leGl0ID09PSB0cnVlKXtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBjbGVhbmluZyBleGFtIHdvcmtmb2xkZXIgb24gZXhpdFwiKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBcIixlcnJvcik7IH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7IC8vIGluIHNvbWUgZWRnZSBjYXNlcyBpbiBkZXZlbG9wbWVudCB0aGlzIGlzIHNldCBidXQgc3RpbGwgdW51c2FibGUgLSB1c2UgdHJ5L2NhdGNoICAgXG4gICAgICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGRldnRvb2xzIHdpbmRvd1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCB8fCB0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxXZWJDb250ZW50cyA9IHdlYkNvbnRlbnRzLmdldEFsbFdlYkNvbnRlbnRzKCkgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB3YyBvZiBhbGxXZWJDb250ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiB3Yy5ob3N0V2ViQ29udGVudHM/LmlkID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuaWQgJiYgd2MuaXNEZXZUb29sc09wZW5lZD8uKCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBkZXN0cm95aW5nIGRldnRvb2xzIHdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gV2FpdCBmb3IgYWxsIERldlRvb2xzIHRvIGJlIGNsb3NlZCBiZWZvcmUgY2xvc2luZyB0aGUgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgYWxsIGNsb3NlRGV2VG9vbHMoKSBjYWxscyBhcmUgY29tcGxldGVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGFsd2F5cyB0cnkgdG8gY2xvc2UgdGhlIGV4YW0gd2luZG93IHNhZmVseSBhZnRlciBkZXZ0b29scyBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogJyxlKX1cbiAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGJsb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuY2xvc2UoKTsgXG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IG5vIGZ1bmN0aW9uYWwgYmxvY2t3aW5kb3cgdG8gaGFuZGxlXCIpXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfVxuICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIFxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZTtcblxuICAgICAgICBpZiAobGFuZ3VhZ2VUb29sU2VydmVyLmxhbmd1YWdlVG9vbFByb2Nlc3Mpe1xuICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0b3BTZXJ2ZXIoKTsgLy8gS2lsbCBMYW5ndWFnZVRvb2wgc2VydmVyIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgIH1cbiAgICAgICAgLy8gYXNrIHN0dWRlbnQgdG8gcXVpdCBhcHAgYWZ0ZXIgZmluaXNoaW5nIGV4YW1cbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5zaG93RXhpdFF1ZXN0aW9uKClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgZXhhbXdpbmRvdyBvbmx5IHdoZW4gbm8gcHJpbnRUb1BERiBvcGVyYXRpb24gaXMgcnVubmluZ1xuICAgICAqL1xuICAgIGNsb3NlRXhhbVdpbmRvd1NhZmVseSgpe1xuICAgICAgICBjb25zdCBleGFtV2luID0gV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgIGlmICghZXhhbVdpbil7IHJldHVybiB9XG5cbiAgICAgICAgaWYgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZil7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBwcmludFRvUERGIGluIHByb2dyZXNzIC0gcmV0cnkgaW4gMXNcIilcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpIH0sIDEwMDApIC8vIHJldHJ5IHVudGlsIHByaW50aW5nIGlzIGZpbmlzaGVkXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWV4YW1XaW4uaXNEZXN0cm95ZWQ/LigpKXtcbiAgICAgICAgICAgICAgICBleGFtV2luLmNsb3NlKCkgLy8gbm9ybWFsIGNsb3NlLCBvbignY2xvc2UnKSBoYW5kbGVyIGRvZXMgdGhlIHJlc3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogZXJyb3Igd2hpbGUgY2xvc2luZyBleGFtd2luZG93XCIsIGUpXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vIHRoaXMgaXMgbWFudWFsbHkgdHJpZ2dlcmVkIGlmIGNvbm5lY3Rpb24gaXMgbG9zdCBkdXJpbmcgZXhhbSAtIHdlIGFsbG93IHRoZSBzdHVkZW50IHRvIGdldCBvdXQgb2YgdGhlIGtpb3NrIG1vZGUgXG4gICAgLy8gSU5GTzogdGhpcyBpcyBiYXNpY2FsbHkgcmVkdW5kYW50IFxuICAgIGFzeW5jIGdyYWNlZnVsbHlFbmRFeGFtKCl7XG4gICAgICAgIHRoaXMuZW5kRXhhbSgpXG4gICAgfVxuXG4gICAgLy8gcmVzZXQgYWxsIHZhcmlhYmxlcyB0aGF0IHNpZ25hbCBvciBuZWVkIGEgdmFsaWQgdGVhY2hlciBjb25uZWN0aW9uXG4gICAgcmVzZXRDb25uZWN0aW9uKCl7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlICAvLyB3ZSBhcmUgZm9jdXNlZCBcbiAgICAgICAgLy90aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2UgICAvLyBkbyBub3Qgc2V0IHRvIGZhbHNlIHVudGlsIGV4YW0gd2luZG93IGlzIGFjdHVhbGx5IGNsb3NlZCAgKHRoaXMgaXMgZG9uZSBpbiBlbmRFeGFtKCkpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udGltZXN0YW1wID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2VcbiAgICAgICAgLy90aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gZmFsc2UgIC8vIHRoaXMgY2hlY2sgaGFwcGVucyBvbmx5IGF0IHRoZSBhcHBsaWNhdGlvbiBzdGFydC4uIGRvIG5vdCByZXNldCBvbmNlIHNldFxuICAgIH1cbiBcblxuXG5cbiAgICAvKipcbiAgICAgKiBkaWVzZSBtZXRob2RlIGhvbHQgc2ljaCwgZGllIHZvbSB0ZWFjaGVyIHp1bSBkb3dubG9hZCBiZXJlaXRnZWxlZ3RlbiBkYXRlaWVuXG4gICAgICogXHUwMEZDYmVyIGRhcyB1cGRhdGUgaW50ZXJ2YWwgd2lyZCBkZXIgdHJpZ2dlciB6dW0gZG93bmxvYWQgdW5kIGRpZSBmaWxlbGlzdCBlcmhhbHRlblxuICAgICAqIEBwYXJhbSB7Kn0gZmlsZXMgXG4gICAgICovXG4gICAgcmVxdWVzdEZpbGVGcm9tU2VydmVyKGZpbGVzKXtcbiAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgbGV0IHNlcnZlcmlwID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuXG4gICAgICAgIGxldCBiYWNrdXBmaWxlID0gZmFsc2VcbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBpZiAoZmlsZS5uYW1lICYmIGZpbGUubmFtZS5pbmNsdWRlcygnYmFrJykpeyAgIC8vIHRoaXMgd2lsbCBhbHdheXMgc2V0IHRoZSBsYXN0IGJhayBmaWxlIGFzIGJhY2t1cCBmaWxlIGlmIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBiYWNrdXBmaWxlID0gZmlsZS5uYW1lXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG5cbiAgICAgICAgLy8gRGF0ZW4gZlx1MDBGQ3IgZGVuIFBPU1QtUmVxdWVzdCB2b3JiZXJlaXRlblxuICAgICAgICBsZXQgZGF0YSA9IEpTT04uc3RyaW5naWZ5KHsgJ2ZpbGVzJzogZmlsZXMsICd0eXBlJzogJ3N0dWRlbnRmaWxlcmVxdWVzdCcgfSk7XG5cbiAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgIGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZG93bmxvYWQvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBkYXRhLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmFycmF5QnVmZmVyKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgIC50aGVuKGJ1ZmZlciA9PiB7XG4gICAgICAgICAgICBsZXQgYWJzb2x1dGVGaWxlcGF0aCA9IGpvaW4odGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSwgdG9rZW4uY29uY2F0KCcuemlwJykpO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFic29sdXRlRmlsZXBhdGgsIEJ1ZmZlci5mcm9tKGJ1ZmZlciksIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7IGxvZy5lcnJvcihlcnIpOyAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFjdChhYnNvbHV0ZUZpbGVwYXRoLCB7IGRpcjogdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSB9KSBcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogZmlsZXMgcmVjZWl2ZWQgYW5kIGV4dHJhY3RlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmcy5wcm9taXNlcy51bmxpbmsoYWJzb2x1dGVGaWxlcGF0aCk7IC8vIFZlcndlbmR1bmcgZGVyIFByb21pc2UtYmFzaWVydGVuIEFQSSB2b24gZnNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJhY2t1cGZpbGUgJiYgV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JhY2t1cCcsIGJhY2t1cGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IFRyaWdnZXIgUmVwbGFjZSBFdmVudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyID0+IGxvZy5lcnJvcihgQ29tbXVuaWNhdGlvbkhhbmRsZXIgLSByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6ICR7ZXJyfWApKTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBzZW5kRXhhbVRvVGVhY2hlcigpe1xuICAgICAgICAvL3NlbmQgc2F2ZSB0cmlnZ2VyIHRvIGV4YW0gd2luZG93XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy90aGVyZSBpcyBhIHJ1bm5pbmcgZXhhbSAtIHNhdmUgY3VycmVudCB3b3JrIGZpcnN0IVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnc2F2ZScsJ3RlYWNoZXJyZXF1ZXN0JykgICAvL3RyaWdnZXIsIHdoeSAgKHRlYWNoZXJyZXF1ZXN0IHdpbGwgYWxzbyB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKSBidXQgb25seSBhZnRlciBzYXZpbmcgdGhlIHBkZiBpcyBjb21wbGV0ZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7IFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgQ29tbXVuaWNhdGlvbiBoYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IENvdWxkIG5vdCBzYXZlIHN0dWRlbnRzIHdvcmsuIElzIGV4YW1tb2RlIGFjdGl2ZT9gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAgLy8gbm90IHJ1bm5pbmcgZXhhbSAocHJvYmFibHkgdXNpbmcgbmV4dC1leGFtIGFzIGNsYXNzcm9vbW1hbmFnbWVudCB0b29sKVxuICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgICAvL3ppcCBkaXJlY3RvcnkgYW5kIHNlbmQgdG8gdGVhY2hlciBhcGlcbiAgICAgICAgfVxuXG4gICAgIH1cblxuXG4gICAgICAvL3ppcCBjb25maWcud29yayBkaXJlY3RvcnkgYW5kIHNlbmQgdG8gdGVhY2hlclxuICAgICBhc3luYyBzZW5kVG9UZWFjaGVyKCl7XG4gICAgICAgIHRyeSB7IGlmICghZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5KTsgfVxuICAgICAgICB9Y2F0Y2ggKGUpeyBsb2cuZXJyb3IoZSl9XG5cbiAgICAgICAgLy8gIHRoaXMgaXMgdGhlIGxvZ2ZpbGUgcGF0aCB0cnkgdG8gY29weSB0aGUgbG9nZmlsZSB0byB0aGUgZXhhbWRpcmVjdG9yeSBiZWZvcmUgbWFraW5nIHRoZSB6aXAgZmlsZVxuICAgICAgICBsZXQgbG9nZmlsZXBhdGggPSBwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9nZmlsZXBhdGgpKXtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKGxvZ2ZpbGVwYXRoLCBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksICduZXh0LWV4YW0tc3R1ZGVudC5sb2cnKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRUb1RlYWNoZXI6IGNvdWxkIG5vdCBjb3B5IGxvZ2ZpbGUgdG8gZXhhbWRpcmVjdG9yeScpOyB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgemlwZmlsZW5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUuY29uY2F0KCcuemlwJylcbiAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgbGV0IHNlcnZlcmlwID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuXG4gICAgICAgIGxldCB6aXBmaWxlcGF0aCA9IGpvaW4odGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSwgemlwZmlsZW5hbWUpO1xuICAgICBcblxuICAgICAgICBsZXQgYmFzZTY0RmlsZSA9IG51bGxcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuemlwRGlyZWN0b3J5KHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHppcGZpbGVwYXRoKVxuICAgICAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoemlwZmlsZXBhdGgpO1xuICAgICAgICAgICAgYmFzZTY0RmlsZSA9IGZpbGVDb250ZW50LnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgfWNhdGNoIChlKXsgIGxvZy5lcnJvcihlKSAgfVxuXG4gICAgICAgIC8vIHNlbmRpbmcgdGhlIHdob2xlIGRpcmVjdG9yeSBhcyB6aXAgZmlsZSBiYXNlNjRlbmNvZGVkIHZpYSBKU09OIGlzbid0IHByb2JhYmx5IHRoZSBiZXN0IG1ldGhvZCBidXQgaXQgd29ya3Mgd2hpbGUgYWxsIGZvcm1EYXRhIGFwcHJvYWNoZXMgZmFpbGVkIHdpdGhcbiAgICAgICAgLy8gZmV0Y2goKSB3aGlsZSB0aGV5IHdvcmtlZCB3aXRoIGF4IGlvcygpIC0gbm90IGV2ZW4gY2hhdGdwdCBvciBzdGFja292ZXJmbG93IGNvdWxkIGhlbHAgXl4gaSB0aGluayBpdCBpcyByZWxhdGVkIHRvIHRoZSBzcGVjaWZpYyBmb3JtRGF0YSBtb2R1bGUgdGhhdCBjYW50IGJlIGltcG9ydGVkIHdpdGhvdXQgXCJ3aW5kb3cgZXJyb3JcIlxuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL3JlY2VpdmUvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWA7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZmlsZTogYmFzZTY0RmlsZSwgZmlsZW5hbWU6IHppcGZpbGVuYW1lIH0pLFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gICAgICAgIC50aGVuKGRhdGEgPT4geyBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogdGVhY2hlciByZXNwb25zZTogJHtkYXRhLm1lc3NhZ2V9YCk7IH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7bG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiAke2Vycm9yfWApOyB9KTtcbiAgICAgfVxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VEaXI6IC9zb21lL2ZvbGRlci90by9jb21wcmVzc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBvdXRQYXRoOiAvcGF0aC90by9jcmVhdGVkLnppcFxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHppcERpcmVjdG9yeShzb3VyY2VEaXIsIG91dFBhdGgpIHtcbiAgICAgICAgY29uc3QgYXJjaGl2ZSA9IGFyY2hpdmVyKCd6aXAnLCB7IHpsaWI6IHsgbGV2ZWw6IDkgfX0pO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShvdXRQYXRoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXJjaGl2ZVxuICAgICAgICAgICAgLmRpcmVjdG9yeShzb3VyY2VEaXIsIGZhbHNlKVxuICAgICAgICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiByZWplY3QoZXJyKSlcbiAgICAgICAgICAgIC5waXBlKHN0cmVhbSlcbiAgICAgICAgO1xuICAgICAgICBzdHJlYW0ub24oJ2Nsb3NlJywgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgICAgYXJjaGl2ZS5maW5hbGl6ZSgpO1xuICAgICAgICB9KS5jYXRjaCggZXJyb3IgPT4geyBsb2cuZXJyb3IoZXJyb3IpfSk7XG4gICAgfVxuXG5cblxuXG5cblxuICAgIC8vIHRpbWVvdXQgXG4gICAgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgIFxuIH1cbiBcbiBleHBvcnQgZGVmYXVsdCBuZXcgQ29tbUhhbmRsZXIoKVxuICIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgbmV0IGZyb20gJ25ldCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7dH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0e2lwY01haW4sIGNsaXBib2FyZCxhcHAsIHdlYkNvbnRlbnRzfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IG1hbW1vdGggZnJvbSAnbWFtbW90aCc7XG5cbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXInO1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vdHJheW1lbnUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTmV0d29ya09yUmVzZXQgfSBmcm9tICcuL3Rlc3RwZXJtaXNzaW9uc01hYy5qcyc7XG5pbXBvcnQgeyBnZXRXbGFuSW5mbyB9IGZyb20gJy4vZ2V0d2xhbmluZm8uanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25zdCBjaGVja1BvcnRPcGVuID0gKHBvcnQsIGhvc3QgPSAnMTI3LjAuMC4xJywgdGltZW91dCA9IDE1MDApID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgY29uc3QgZmluaXNoID0gKHJ1bm5pbmcsIGVycm9yID0gbnVsbCkgPT4ge1xuICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHJlc29sdmUoeyBydW5uaW5nLCBwb3J0LCBob3N0LCBlcnJvciB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0LnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdjb25uZWN0JywgKCkgPT4gZmluaXNoKHRydWUpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ3RpbWVvdXQnLCAoKSA9PiBmaW5pc2goZmFsc2UsICd0aW1lb3V0JykpO1xuICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoZXJyKSA9PiBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb2NrZXQuY29ubmVjdChwb3J0LCBob3N0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIElQQyBoYW5kbGluZyAoQmFja2VuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlIC8vIGZsYWcgdG8gcHJldmVudCBjbG9zaW5nIHdpbmRvdyB3aGlsZSBwcmludGluZ1xuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuICAgICAgICBcblxuICAgICAgICBpcGNNYWluLm9uKCdzZXQtbmV3LWxvY2FsZScsIChldmVudCwgbG9jYWxlKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNldC1uZXctbG9jYWxlOiBzZXR0aW5nIG5ldyBsb2NhbGUgdG8gJHtsb2NhbGV9YClcbiAgICAgICAgICAgIGkxOG4ubG9jYWxlID0gbG9jYWxlXG4gICAgICAgICAgICB1cGRhdGVTeXN0ZW1UcmF5KGkxOG4ubG9jYWxlKTtcbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRFeGFtTWF0ZXJpYWxzJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgXG4gICAgICAgICAgICBsZXQgY2xpZW50aW5mbyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm9cbiAgICAgICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBsZXQgc2VydmVyaXAgPSBjbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7IFxuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhhbU1hdGVyaWFscyA9IGZhbHNlXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgICAgICAgICAgZXhhbU1hdGVyaWFscyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZ2V0ZXhhbW1hdGVyaWFscy8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6IHJlY2VpdmVkIGRhdGFcIiwgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogJHtlcnJ9YCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBleGFtTWF0ZXJpYWxzXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICBcbiAgICAgICAgfSkgXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgYWxsb3dlZFVybHMgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZ3Vlc3QgPSB3ZWJDb250ZW50cy5mcm9tSWQoTnVtYmVyKGd1ZXN0SWQpKTtcbiAgICAgICAgICAgIGlmICghZ3Vlc3QgfHwgZ3Vlc3QuaXNEZXN0cm95ZWQ/LigpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgICAvLyBFbnRmZXJuZSBhbHRlIExpc3RlbmVyLCB1bSBEb3BwZWwtUmVnaXN0cmllcnVuZ2VuIHp1IHZlcm1laWRlblxuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgXG4gICAgICAgICAgICBjb25zdCBhbGxvdyA9IGFsbG93ZWRVcmxzLm1hcChzID0+IFN0cmluZyhzKS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHVybCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBpZiAoYWxsb3cuc29tZSh1ID0+IHVybFN0ci5pbmNsdWRlcyh1KSkpIHsgZ3Vlc3QubG9hZFVSTCh1cmwpOyBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYWxsb3dlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxTdHIgPSBTdHJpbmcodXJsIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGlmICghYWxsb3cuc29tZSh1ID0+IHVybFN0ci5pbmNsdWRlcyh1KSkpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiBmb3IgY29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBleGFtIG1vZGVzKVxuICAgICAgICBjb25zdCBjaGVja0NvbW1vbkV4Y2VwdGlvbnMgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiTWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJHb29nbGVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFjY291bnRzXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZS5jb21cIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIm15c2lnbmluc1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFjY291bnRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwid2luZG93c2F6dXJlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRvbmxpbmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvb2t1cFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImJpbGR1bmcuZ3YuYXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNoaWJib2xldGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImlkLWF1c3RyaWEuZ3YuYXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aEhhbmRsZXJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZXUtbW9iaWxlLmV2ZW50cy5kYXRhXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ3N0YXRpYy5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFhZGNkblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRvbmxpbmVcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImxpdmUuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtc2Z0YXV0aC5uZXRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFhZGNkblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtc2Z0YXV0aC5uZXRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFVuaWZpZWQgSVBDIGhhbmRsZXIgZm9yIHdlYnZpZXcgYmxvY2tpbmcgLSBzdXBwb3J0cyB3ZWJzaXRlLCBlZHV2aWR1YWwsIGZvcm1zLCByZHAgbW9kZXNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZSwgYWxsb3dlZERvbWFpbiwgYmFzZVVybCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIHRvIHByZXZlbnQgZHVwbGljYXRlIHJlZ2lzdHJhdGlvbnNcbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVUkwgdmFsaWRhdGlvbiBmdW5jdGlvbiAtIGRpZmZlcmVudCBsb2dpYyBiYXNlZCBvbiBtb2RlXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdFQlNJVEUgbW9kZTogY2hlY2sgZG9tYWluIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsIHx8IHRhcmdldFVybC5pbmNsdWRlcyhiYXNlVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG9tYWluID0gdXJsT2JqLmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4uZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBkb21haW4uc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlZml4ICYmICFwcmVmaXguaW5jbHVkZXMoJy4nKSAmJiAvXlthLXpBLVowLTldKFthLXpBLVowLTktXSpbYS16QS1aMC05XSk/JC8udGVzdChwcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJlZHV2aWR1YWxcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBFRFVWSURVQUwvTU9PRExFIG1vZGU6IGNoZWNrIG1vb2RsZVRlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZVRlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBNb29kbGUtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwic3RhcnRhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJwcm9jZXNzYXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9nb3V0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZWR1dmlkdWFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb2xpY3lcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9ydGFsLnRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9ydGFsLnRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImZvcm1zXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRk9STVMgbW9kZTogY2hlY2sgZ2Zvcm1zVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoZ2Zvcm1zVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIEdvb2dsZSBGb3Jtcy1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZm9ybVJlc3BvbnNlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInZpZXdzY29yZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwicmRwXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUkRQIG1vZGU6IGFsbG93IGFsbCAob3IgaW1wbGVtZW50IHNwZWNpZmljIGxvZ2ljIGlmIG5lZWRlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgbW9kZXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoZWNrQ29tbW9uRXhjZXB0aW9ucyh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gSGFuZGxlIHRhcmdldD1cIl9ibGFua1wiIGxpbmtzIGFuZCB3aW5kb3cub3BlbiAtIGJsb2NrIEJFRk9SRSBuYXZpZ2F0aW9uXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIHdpbmRvdy5vcGVuIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyAvLyBPcGVuIGluIHNhbWUgd2Vidmlld1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAvLyBQcmV2ZW50IG5ldyB3aW5kb3dcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIHdpbmRvdy5vcGVuIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gSGFuZGxlIHdpbGwtbmF2aWdhdGUgb24gd2ViQ29udGVudHMgbGV2ZWwgLSB0aGlzIGZpcmVzIEJFRk9SRSBuYXZpZ2F0aW9uIGhhcHBlbnNcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBCbG9jayBuYXZpZ2F0aW9uIGNvbXBsZXRlbHkgLSB0aGlzIGhhcHBlbnMgQkVGT1JFIHBhZ2UgbG9hZHNcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3Quc3RvcCgpOyAvLyBTdG9wIGFueSBsb2FkaW5nIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxpYXMgZm9yIGVkdXZpZHVhbCBtb2RlIC0gcmVkaXJlY3RzIHRvIHVuaWZpZWQgaGFuZGxlclxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLWVkdXZpZHVhbC13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pID0+IHtcbiAgICAgICAgICAgIC8vIENhbGwgdGhlIHVuaWZpZWQgaGFuZGxlciB3aXRoIGVkdXZpZHVhbCBtb2RlXG4gICAgICAgICAgICBjb25zdCB1bmlmaWVkSGFuZGxlciA9IGlwY01haW4ubGlzdGVuZXJzKCdzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3JylbMF07XG4gICAgICAgICAgICBpZiAodW5pZmllZEhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5pZmllZEhhbmRsZXIoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZTogJ2VkdXZpZHVhbCcsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgICBcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVsb2FkIHRoZSBicm93c2VyIHZpZXdcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdyZWxvYWQtYnJvd3Nlci12aWV3JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybCk7XG4gICAgICAgIH0pO1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgbGFuZ3VhZ2VUb29sIEFQSSBTZXJ2ZXIgKHdpdGggSmF2YSBKUkUpXG4gICAgICAgICAqIFJ1bnMgYXQgbG9jYWxob3N0IDgwODhcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KSBcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhY3RpdmF0ZSBzcGVsbGNoZWNrIG9uIGRlbWFuZCBmb3Igc3BlY2lmaWMgc3R1ZGVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7ICBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVjayBpZiBMYW5ndWFnZVRvb2wgc2VydmVyIHJlc3BvbmRzIG9uIGNvbmZpZ3VyZWQgcG9ydFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdpc0xhbmd1YWdlVG9vbFJ1bm5pbmcnLCBhc3luYyAoKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgcG9ydCA9IGxhbmd1YWdlVG9vbFNlcnZlci5wb3J0IHx8IDgwODg7XG4gICAgICAgICAgICBjb25zdCBob3N0cyA9IFsnMTI3LjAuMC4xJywgJzo6MScsICdsb2NhbGhvc3QnXTtcbiAgICAgICAgICAgIC8vIFJ1biBhbGwgY2hlY2tzIGluIHBhcmFsbGVsIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UsIHVzZSBsb25nZXIgdGltZW91dCBmb3Igc2VydmVyIHN0YXJ0dXAgZGV0ZWN0aW9uXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoaG9zdHMubWFwKGhvc3QgPT4gY2hlY2tQb3J0T3Blbihwb3J0LCBob3N0LCAyNTAwKSkpO1xuICAgICAgICAgICAgLy8gUmV0dXJuIGZpcnN0IHN1Y2Nlc3NmdWwgcmVzdWx0LCBvciBsYXN0IHJlc3VsdCBpZiBub25lIHN1Y2NlZWRlZFxuICAgICAgICAgICAgY29uc3Qgc3VjY2Vzc1Jlc3VsdCA9IHJlc3VsdHMuZmluZChyZXN1bHQgPT4gcmVzdWx0LnJ1bm5pbmcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQgfHwgcmVzdWx0c1tyZXN1bHRzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgTE9DQUwgTG9ja2Rvd25cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ2xvY2FsbG9ja2Rvd24nLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvY2FsbG9ja2Rvd246IGxvY2tpbmcgZG93biBjbGllbnQgd2l0aG91dCB0ZWFjaGVyIGNvbm5lY3Rpb25cIilcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtcbiAgICAgICAgICAgICAgICBleGFtbW9kZTogdHJ1ZSxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGRlbGZvbGRlcm9uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogJ2RlLURFJyxcbiAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdFR5cGU6ICcnLFxuICAgICAgICAgICAgICAgIG1vb2RsZURvbWFpbjogJycsXG4gXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiAwLFxuICAgICAgICAgICAgICAgIG1zT2ZmaWNlRmlsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2xvY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGluOiAnMDAwMCcsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB1bmxvY2tvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZvbnRmYW1pbHk6ICdzYW5zLXNlcmlmJyxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0SWQ6ICcnLFxuICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGFzc3dvcmQ6IGFyZ3MucGFzc3dvcmQsXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICB1c2VFeGFtU2VjdGlvbnM6IGZhbHNlLCAvL2lmIGZhbHNlIGV4YW0gc2VjdGlvbiAxIGlzIHVzZWQgYW5kIG5vIHRhYnMgYXJlIGRpc3BsYXllZFxuICAgICAgICAgICAgICAgIGFjdGl2ZVNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgbG9ja2VkU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBleGFtU2VjdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgMToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhhbXR5cGU6IGFyZ3MuZXhhbW1vZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbWFyZ2luOiB7IHNpZGU6ICdyaWdodCcsIHNpemU6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzcGFjaW5nOiAnMicsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdWRpb1JlcGVhdDogMyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogYXJncy5sYW5ndWFnZXRvb2wgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogYXJncy5zcGVsbGNoZWNrbGFuZyB8fCAnZGUtREUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGFyZ3Muc3VnZ2VzdGlvbnMgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lID0gYXJncy5jbGllbnRuYW1lO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IFwiMTI3LjAuMC4xXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBcImxvY2FsaG9zdFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5waW4gPSBcIjAwMDBcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBcIjAwMDBcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgPSBcImFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IHRydWU7IC8vIHRoaXMgbXVzdCBiZSBzZXQgdG8gdHJ1ZSBpbiBvcmRlciB0byBzdG9wIHR5cGljYWwgbmV4dC1leGFtIGNsaWVudC90ZWFjaGVyIGFjdGlvbnNcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBsb2NhbGxvY2tkb3duXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBCSVAgTG9naW4gU2VxdWVuY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaXBjTWFpbi5vbignbG9naW5CaVAnLCAoZXZlbnQsIGJpcHRlc3QpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvZ2luQmlQOiBvcGVuaW5nIGJpcCB3aW5kb3cuIHRlc3RlbnZpcm9ubWVudDpcIiwgYmlwdGVzdClcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KVxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gYmlwIGxvZ29uXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZ2lzdGVycyB2aXJ0dWFsaXplZCBzdGF0dXNcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCd2aXJ0dWFsaXplZCcsICgpID0+IHsgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSB0cnVlOyB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgRk9DVVMgc3RhdGUgdG8gZmFsc2UgKG1vdXNlIGxlZnQgZXhhbSB3aW5kb3cpXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2ZvY3VzbG9zdCcsIChldmVudCwgY3RybGFsdD1mYWxzZSkgPT4geyBcbiAgICAgICAgICAgIGxldCBhbnN3ZXIgPSBmYWxzZSBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCB8fCAhdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbW1vZGUpIHsgXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmxlbmd0aCA+IDApIHsgXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5mb2N1c1RhcmdldEFsbG93ZWQgJiYgY3RybGFsdCA9PSBmYWxzZSl7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZm9jdXNsb3N0OiBtb3VzZWxlYXZlIGV2ZW50IHdhcyB0cmlnZ2VyZWQgYnV0IHRhcmdldCBpcyBhbGxvd2VkYClcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgIFxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gYmxvY2sgZXZlcnl0aGluZyBhbmQgaW5mb3JtIHRlYWNoZXIgIChwcm9iYWJseSBhbiBvdmVya2lsbCBvbiBtb3VzZWxlYXZlIC0gbmVlZHMgdGVzdGluZylcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IGZhbHNlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYW5zd2VyXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgbWFpbiBjb25maWcgb2JqZWN0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0Y29uZmlnJywgKGV2ZW50KSA9PiB7ICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmNvbmZpZyAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBVbmxvY2sgQ29tcHV0ZXJcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dyYWNlZnVsbHlleGl0JywgKCkgPT4geyAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdyYWNlZnVsbHlleGl0OiBncmFjZWZ1bGx5IGxlYXZpbmcgbG9ja2VkIGV4YW0gbW9kZWApXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ3JhY2VmdWxseUVuZEV4YW0oKSBcbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCkgXG4gICAgICAgIH0gKVxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIHN0b3AgcmVzdHJpY3Rpb25zXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdyZXN0cmljdGlvbnMnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIC8vdGhpcyBhbHNvIHN0b3BzIHRoZSBjbGVhckNsaXBib2FyZCBpbnRlcnZhbFxuICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgXG4gICAgICAgIH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogY29weSB0byBnbG9iYWwgY2xpcGJvYXJkXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjbGlwYm9hcmQnLCAoZXZlbnQsIHRleHQpID0+IHsgIFxuICAgICAgICAgICAgY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KVxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlLWNoZWNrIGhvc3RpcCBhbmQgZW5hYmxlIG11bHRpY2FzdCBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY2hlY2tob3N0aXAnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICBsZXQgYWRkcmVzcyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHsgICAgYWRkcmVzcyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudC5hZGRyZXNzKCk7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHsgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IG11bHRpY2FzdGNsaWVudCBub3QgcnVubmluZ1wiKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGJlcmVpdHMgZWluZSBBZHJlc3NlIHZvcmhhbmRlbiBpc3QsIGxpZWZlcm4gd2lyIHNpZSB6dXJcdTAwRkNjay5cbiAgICAgICAgICAgIGlmIChhZGRyZXNzKSB7ICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwOyAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJzdWNoZSwgYW4gZGllIGtvcnJla3RlIFNjaG5pdHRzdGVsbGUgenUgYmluZGVuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEZhbGxzIGdhdGV3YXk0c3luYygpIGJsb2NraWVyZW5kIGlzdCwga2FubnN0IGR1IGRpZXNlbiBBdWZydWYgaW4gZWluIFByb21pc2UgcGFja2VuOlxuICAgICAgICAgICAgICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZSB9ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzID0gZ2F0ZXdheTRzeW5jKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7ICByZWplY3QoZXJyKTsgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSk7IC8vIExpZWZlcnQgZGllIElQIGRlciBTY2huaXR0c3RlbGxlLCB3ZWxjaGUgZGFzIERlZmF1bHQgR2F0ZXdheSBoYXRcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBrZWluZSBJUCAobWl0IEdhdGV3YXkpIHZlcmZcdTAwRkNnYmFyIGlzdCwgaG9sZSBlaW5lIGFsdGVybmF0aXZlIEFkcmVzc2VcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuaG9zdGlwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpOyAvLyBMaWVmZXJ0IGF1Y2ggZWluZSBJUCwgd2VubiBrZWluIEdhdGV3YXkgdmVyZlx1MDBGQ2diYXIgaXN0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogVW5hYmxlIHRvIGRldGVybWluZSBpcCBhZGRyZXNzXCIsIGUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyZlx1MDBFNGxzY2h0ZSBBZHJlc3NlbiAoei4gQi4gbG9jYWxob3N0KSBpZ25vcmllcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwID09PSBcIjEyNy4wLjAuMVwiKSB7ICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlOyAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gV2VubiBkaWUgTXVsdGljYXN0LUNsaWVudCBuaWNodCBsXHUwMEU0dWZ0LCBpbml0aWFsaXNpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCAmJiAhYWRkcmVzcykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZhbGxzIGluaXQoKSBhc3luY2hyb24gdW1nZXNldHp0IHdlcmRlbiBrYW5uLCB3YXJ0ZW4gd2lyIGhpZXIgZGFyYXVmLlxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm11bHRpY2FzdENsaWVudC5pbml0KHRoaXMuY29uZmlnLmdhdGV3YXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogRXJyb3IgaW5pdGlhbGl6aW5nIG11bHRpY2FzdCBjbGllbnRcIiwgZXJyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7XG4gICAgICAgIH0pO1xuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBlZGl0b3IgYXMgaHRtbCBmaWxlIC0gYXMgYmFja3VwIC0gb25seSB0cmlnZ2VyZWQgYnkgdGhlIHRlYWNoZXIgZm9yIG5vdyAoYWxsb3cgbWFudWFsIGJhY2t1cCAhISlcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHtjbGllbnRuYW1lOnRoaXMuY2xpZW50bmFtZSwgZmlsZW5hbWU6YCR7ZmlsZW5hbWV9Lmh0bWxgLCBlZGl0b3Jjb250ZW50OiBlZGl0b3Jjb250ZW50IH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3N0b3JlSFRNTCcsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgaHRtbENvbnRlbnQgPSBhcmdzLmVkaXRvcmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgbGV0IGh0bWxmaWxlbmFtZSA9IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpe1xuICAgICAgICAgICAgICAgIGh0bWxmaWxlbmFtZSA9IGAke2ZpbGVuYW1lfS5iYWtgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXI6IHN0b3JlSFRNTDogY3JlYXRpbmcgbWFudWFsIGJhY2t1cCBhcyAke2h0bWxmaWxlbmFtZX1gKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBodG1sZmlsZSA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBodG1sZmlsZW5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaHRtbENvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoaHRtbGZpbGUsIGh0bWxDb250ZW50LCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogJHtlcnIubWVzc2FnZX1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWx0ZXJuYXRlcGF0aCA9IGAke2h0bWxmaWxlfS0ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59LmJha2BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHRyeWluZyB0byB3cml0ZSBmaWxlIGFzOlwiLCBhbHRlcm5hdGVwYXRoIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgaHRtbENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgYmFzZTY0IGVuY29kZWQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBERmJhc2U2NCcsIGFzeW5jIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0UERGYmFzZTY0OiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyID0gYXJncy5zdWJtaXNzaW9ubnVtYmVyKzEgLy8gY2xpZW50aW5mbyBrZWVwcyB0cmFjayBvZiBzdWJtaXNzaW9ucyBmb3IgYXV0b21hdGVkIHN1Ym1pc3Npb25udW1iZXJzIGF0IHNlY3Rpb24gY2hhbmdlIC0gYnV0IHRoaXMgb2J2aW91c2x5IGhhcHBlbnMgYWZ0ZXIgbWFudWFsIHN1Ym1pdFxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKGFyZ3Muc3VibWlzc2lvbm51bWJlciwgYXJncy5zZWN0aW9ubmFtZSwgYXJncy5wcmludEJhY2tncm91bmQpICAgLy8gd2h5IHRoZSBoZWxsIGlzIHRoaXMgZnVuY3Rpb24gbG9jYXRlZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBhbmQgbm90IGluIGlwY2hhbmRsZXIuanMgPyBGSVhNRSAhXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyB0aGUgRXhhbVdpbmRvdyBjb250ZW50IGFzIFBERlxuICAgICAgICAgKiBBVFRFTlRJT04gdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCByZXR1bnMgYSBiYXNlNjQgdmVyc2lvbiBvZiB0aGUgcGRmXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncHJpbnRwZGYnLCAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICAvLyBkbyBub3QgcHJpbnQgaWYgZXhhbSBtb2RlIGlzIG5vdCBhY3RpdmUgYW55bW9yZVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBleGFtbW9kZSBpcyBmYWxzZSAtIHNraXBwaW5nIHByaW50XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBwcmludCBhbHJlYWR5IGluIHByb2dyZXNzIC0gc2tpcHBpbmcgbmV3IHJlcXVlc3RcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyAvLyBkZWZpbmUgcHJpbnQgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGFyZ3MubGFuZHNjYXBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke2FyZ3Muc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7YXJncy5jbGllbnRuYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcGRmZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LnBkZmAgIC8vIGRlZmF1bHQgZmlsZW5hbWUgPSBjbGllbnRuYW1lLnBkZlxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmZpbGVuYW1lKXsgIC8vIGluIGNhc2Ugb2YgbWFudWFsIGJhY2t1cCB0aGUgdXNlciBjYW4gc2V0IGEgY3VzdG9tIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgICAgIHBkZmZpbGVuYW1lID0gYCR7YXJncy5maWxlbmFtZX0ucGRmYFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHByaW50cGRmOiBjcmVhdGluZyBtYW51YWwgYmFja3VwIGFzICR7cGRmZmlsZW5hbWV9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmZmlsZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgcGRmZmlsZW5hbWUpOyAgLy8gcGF0aCBwb2ludHMgdG8gdGhlIGN1cnJlbnQgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1hdXgucGRmYCAgICAvL3Rob21hcy5wZGYtYXV4LnBkZiBcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1vbGQucGRmYDsgICAvL3Rob21hcy5wZGYtb2xkLnBkZlxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlZmlsZW5hbWUpOyAgLy8gaWYgc29tZXRoaW5nIGdvZXMgd3Jvbmcgd2UgdHJ5IHRvIHdyaXRlIGEgZGlmZmVyZW50IGZpbGVcblxuXG4gICAgICAgICAgICAgICAgLy8gYXV4IGZpbGVzIGFyZSBmaWxlcyBjcmVhdGVkIGlmIHRoZSBtYWluIHBkZmZpbGVwYXRoIGlzIG5vdCB3cml0ZWFibGUgKG9wZW5lZCBvbiB3aW5kb3dzKSBcbiAgICAgICAgICAgICAgICB0cnkgeyAgLy8gYWx3YXlzIGNoZWNrIGZvciBvbGQgYXV4IGZpbGVzIGFuZCByZW5hbWUgdGhlbVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IGFsdGVybmF0ZWZpbGVuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhhbHRlcm5hdGVwYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGFtV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV4YW1XaW5kb3c/LndlYkNvbnRlbnRzXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdlYkNvbnRlbnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIm5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSB0cnVlXG5cbiAgICAgICAgICAgICAgICAvLyBwcmludCB0aGUgZXhhbSB3aW5kb3cgdG8gcGRmXG4gICAgICAgICAgICAgICAgd2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBwZGYgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMocGRmZmlsZXBhdGgpKSB7IGZzLnVubGlua1N5bmMocGRmZmlsZXBhdGgpOyB9fVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShwZGZmaWxlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfSAtIHdyaXRpbmcgZmlsZSBhczogJHthbHRlcm5hdGVwYXRofSBgKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgYXV4IGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRlcGF0aCkpIHsgZnMudW5saW5rU3luYyhhbHRlcm5hdGVwYXRoKTsgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZiAoYWx0ZXJuYXRpdmVyIFBmYWQpOiAke2Vyci5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgYWx0ZXJuYXRlIHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpICAgLy9tYWtlIHN1cmUgc3R1ZGVudHMgc2VlIHRoZSBuZXcgZmlsZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyb3IubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmVzIEFjdGl2ZSBTaGVldHMgZm9ybSBkYXRhIHRvIC5iYWsgZmlsZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc2F2ZUFjdGl2ZXNoZWV0c0JhaycsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWUgPyBgJHthcmdzLmZpbGVuYW1lfS5iYWtgIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGJha0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGZvcm1EYXRhIHRvIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShhcmdzLmZvcm1EYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byAuYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJha0ZpbGVQYXRoLCBqc29uRGF0YSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6IHNhdmVkIGZvcm0gZGF0YSB0byAke2Jha0ZpbGVuYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFsbCBmb3VuZCBTZXJ2ZXJzIGFuZCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0aW5mb2FzeW5jJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gZmFsc2UgICBcbiAgICAgICAgICAgIC8vIHNlcnZlcnN0YXR1cyBvYmpla3Qgd2lyZCBudXIgYmVpIGJlZ2lubiBkZXMgZXhhbXMgYW4gZGFzIGV4YW0gd2luZG93IGR1cmNoZ2VyZWljaHQgZlx1MDBGQ3IgYmFzaXMgZWluc3RlbGx1bmdlblxuICAgICAgICAgICAgLy8gYWxsZSB3ZWl0ZXJlbiB1cGRhdGVzIFx1MDBGQ2JlciBkYXMgc2VydmVyc3RhdHVzIG9iamVjdCB3ZXJkZW4gaW0gY29tbXVuaWNhdGlvbiBoYW5kbGVyIGdlbGVzZW4gdW5kIGdnZi4gYXVmIGRhcyBjbGllbnRpbmZvIG9iamVjdCBnZWxlZ3RcbiAgICAgICAgICAgIC8vIGRpZXNlciBrb21tdW5pa2F0aW9uc2ZsdXNzIG11c3MgaW4gMi4wIGdlc3RyZWFtbGluZWQgd2VyZGVuICNGSVhNRVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgc2VydmVyc3RhdHVzID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzIH1cblxuICAgICAgICAgICAgLy9jb3VudCBudW1iZXIgb2YgZmlsZXMgaW4gZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSkgIC8vIGVyc3RlbGx0IGZhbGxzIG5cdTAwRjZ0aWdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZWxpc3QgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcih3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICByZXR1cm4geyAgIFxuICAgICAgICAgICAgICAgIHNlcnZlcmxpc3Q6IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LFxuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiZWNhdXNlIG9mIG1pY3Jvc29mdCAzNjUgd2UgbmVlZCB0byB3b3JrIHdpdGggXCJCcm93c2VyVmlld1wiIFxuICAgICAgICAgKiBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGRpc2xheSBmdWxsc2NyZWVuIGluZm9ybWF0aW9uIGZyb20gdGhlIEV4YW0gaGVhZGVyIHdlIHRlbXBvcmFyaWx5IGNvbGxhcHNlIHRoZSBCcm93c2VyVmlldyBmb3IgT2ZmaWNlXG4gICAgICAgICAqIGFuZCByZXN0b3JlIGl0IGFmdGVyd2FyZHMgLSBub3QgcGVyZmVjdCBidXQgbG9va3Mgb2tcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjb2xsYXBzZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHsgeDogMCwgeTogMCwgd2lkdGg6IDAsIGhlaWdodDogMCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICB9KTtcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdG9yZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgbWVudUhlaWdodCA9IG1haW5XaW5kb3cubWVudUhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7IC8vIEdldCB0aGUgY3VycmVudCBib3VuZHMgb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIC8vIFNldCB0aGUgbmV3IGJvdW5kcyBvZiB0aGUgY29udGVudFZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiBtZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsIC8vIGZ1bGwgd2lkdGggb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBtZW51SGVpZ2h0IC8vIHJlbWFpbmluZyBoZWlnaHQgYWZ0ZXIgdGhlIG1lbnVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlIG1lbnUgaGVpZ2h0IGR5bmFtaWNhbGx5IHdoZW4gaGVhZGVyIGNvbnRlbnQgY2hhbmdlc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigndXBkYXRlLW1lbnUtaGVpZ2h0JywgKGV2ZW50LCBoZWlnaHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdztcbiAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmIGhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHN0b3JlZCBtZW51IGhlaWdodFxuICAgICAgICAgICAgICAgIG1haW5XaW5kb3cubWVudUhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZXBvc2l0aW9uIHRoZSBicm93c2VyIHZpZXcgd2l0aCBuZXcgaGVpZ2h0XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRWaWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgeTogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIGhlaWdodFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2VuZHMgYSByZWdpc3RlciByZXF1ZXN0IHRvIHRoZSBnaXZlbiBzZXJ2ZXIgaXBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIGNsaWVudG5hbWU6dGhpcy51c2VybmFtZSwgc2VydmVybmFtZTpzZXJ2ZXJuYW1lLCBzZXJ2ZXJpcCwgc2VydmVyaXAsIHBpbjp0aGlzLnBpbmNvZGUgXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdyZWdpc3RlcicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY2xpZW50bmFtZSA9IGFyZ3MuY2xpZW50bmFtZVxuICAgICAgICAgICAgY29uc3QgcGluID0gYXJncy5waW5cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmlwID0gYXJncy5zZXJ2ZXJpcFxuICAgICAgICAgICAgY29uc3Qgc2VydmVybmFtZSA9IGFyZ3Muc2VydmVybmFtZVxuICAgICAgICAgICAgY29uc3QgY2xpZW50aXAgPSBpcC5hZGRyZXNzKClcbiAgICAgICAgICAgIGNvbnN0IGhvc3RuYW1lID0gb3MuaG9zdG5hbWUoKVxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHRoaXMuY29uZmlnLnZlcnNpb25cbiAgICAgICAgICAgIGNvbnN0IGJpcHVzZXJJRCA9IGFyZ3MuYmlwdXNlcklEXG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXsgLy8jRklYTUUgZGFzIHNvbGx0ZSBlaWdlbnRsaWNoIHZvbSBzZXJ2ZXIga29tbWVuIFxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcmVnaXN0ZXJjbGllbnQvJHtzZXJ2ZXJuYW1lfS8ke3Bpbn0vJHtjbGllbnRuYW1lfS8ke2NsaWVudGlwfS8ke2hvc3RuYW1lfS8ke3ZlcnNpb259LyR7YmlwdXNlcklEfWA7XG4gICAgICAgICAgICBjb25zdCBzaWduYWwgPSBBYm9ydFNpZ25hbC50aW1lb3V0KDgwMDApOyAvLyA4MDAwIE1pbGxpc2VrdW5kZW4gPSA4IFNla3VuZGVuIEFib3J0U2lnbmFsIG1pdCBlaW5lbSBUaW1lb3V0XG5cblxuICAgICAgICAgICAgZmV0Y2godXJsLCB7IG1ldGhvZDogJ0dFVCcsIHNpZ25hbCB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSBcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09IFwic3VjY2Vzc1wiKSB7ICAvLyByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bGwgb3RoZXJ3aXNlIGRhdGEgd291bGQgYmUgXCJmYWxzZVwiXG4gICAgICAgICAgICAgICAgICAgIC8vIEVyZm9sZ3JlaWNoZSBSZWdpc3RyaWVydW5nXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGNsaWVudG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBzZXJ2ZXJpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gc2VydmVybmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGNsaWVudGlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBkYXRhLnRva2VuOyAvLyB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBjbGllbnQgdG9rZW4gaW4gb3JkZXIgdG8gY2hlY2sgYWdhaW5zdCBpdCBiZWZvcmUgcHJvY2Vzc2luZyBjcml0aWNhbCBhcGkgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gcGluO1xuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiBzdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBhdCAke3NlcnZlcm5hbWV9IEAgJHtzZXJ2ZXJpcH0gYXMgJHtjbGllbnRuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IGRhdGE7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9jcmVhdGUgZXhhbSBmb2xkZXIgaW4gd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgICAgICBsZXQgdW5pcXVlZXhhbU5hbWUgPSBgJHtzZXJ2ZXJuYW1lfS0ke3Bpbn1gXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5leGFtZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB1bmlxdWVleGFtTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbXBhcmUgdmVyc2lvbnMgYW5kIGRpc3BsYXkgbWVzc2FnZSAodGVhY2hlciBuZWVkcyB1cGdyYWRlLi4gY2xpZW50IG5lZWRzIHVwZ3JhZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wYXJpc29uUmVzdWx0ID0gdGhpcy5jb21wYXJlU29mdHdhcmUoY29uZmlnLnZlcnNpb24sIGNvbmZpZy5pbmZvICwgZGF0YS52ZXJzaW9uLCBkYXRhLnZlcnNpb25pbmZvICkgLy9zZXJ2ZXJWZXJzaW9uLCBzZXJ2ZXJTdGF0dXMsIGxvY2FsVmVyc2lvbiwgbG9jYWxTdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkgeyAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IG5ldWVyIGFscyBkaWUgZGVyIExlaHJwZXJzb24hXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHsgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgenUgYWx0LiBMYWRlbiBzaWUgc2ljaCBlaW5lIGFrdHVlbGxlIFZlcnNpb24gaGVydW50ZXIhXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbmJla2FubnRlciBGZWhsZXIgYmVpbSBWZXJiaW5kdW5nc2F1ZmJhdS5cIiB9OyAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGFzeW5jIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGZWhsZXJiZWhhbmRsdW5nXG4gICAgICAgICAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykgeyBlcnJvck1lc3NhZ2UgPSBcIlRoZSByZXF1ZXN0IHRpbWVkIG91dFwiOyAgIH0gLy8gVGltZW91dC1OYWNocmljaHQgYW5wYXNzZW4gXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIG9uIG1hY29zIHRoZSBwZXJtaXNzaW9uIHNldHRpbmdzIGluIHJhcmUgY2FzZXMgbWVzcyB1cCB0aGUgYWJpbGl0eSB0byBmZXRjaCB0aGUgdGVhY2hlciBhcGkgXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpeyAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHRoaXMuY29uZmlnLnNlcnZlckFwaVBvcnQpOyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlID09PSBcInJlc2V0XCIpIHsgICAvLyBxdWl0IHRoZSBhcHAgaWYgdGhlIHVzZXIgd2FudHMgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaWYgdGhlIHVzZXIgZG9lcyBub3Qgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVzIGdpYnQgZWluIFByb2JsZW0gbWl0IGRlbSBOZXR6d2VyaywgZGVuIEZpcmV3YWxscmVnZWxuIG9kZXIgZGVuIE5ldHp3ZXJrYmVyZWNodGlndW5nZW4hIEJpdHRlIGJlaGViZW4gc2llIGRpZXNlcyBQcm9ibGVtIHVuZCBzdGFydGVuIFNpZSBOZXh0LUV4YW0gbmV1IVwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICAgICAgICAgIHJldHVybjsgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIEdlb2dlYnJhIGFzIGdnYiBmaWxlIC0gYXMgYmFja3VwIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAsIGNvbnRlbnQ6IGJhc2U2NCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2F2ZUdHQicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGFyZ3MuY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBjb25zdCByZWFzb24gPSBhcmdzLnJlYXNvblxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzYXZlR0dCOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBCdWZmZXIuZnJvbShjb250ZW50LCAnYmFzZTY0Jyk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGdnYkZpbGVQYXRoLCBmaWxlRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXN0b3JlZFwiKSAsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycikgIFxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUdHQjogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGxvYWQgY29udGVudCBmcm9tIGdnYiBmaWxlIGFuZCBzZW5kIGl0IHRvIHRoZSBmcm9udGVuZCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgIH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdsb2FkR0dCJywgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBSZWFkIHRoZSBmaWxlIGFuZCBjb252ZXJ0IGl0IHRvIGJhc2U2NFxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKGdnYkZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlNjRHZ2JGaWxlID0gZmlsZURhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDpiYXNlNjRHZ2JGaWxlLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH0gICAgIFxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdFVCBQREYgb3IgSU1BR0UgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHBkZmFzeW5jJywgKGV2ZW50LCBmaWxlbmFtZSwgaW1hZ2UgPSBmYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGVcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlKXsgcmV0dXJuIGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpOyAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIGJhc2U2NCBzdHJpbmcgb2YgYXVkaW9maWxlIGZyb20gd29ya2RpcmVjdG9yeSBvciBwdWJsaWMgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0QXVkaW9GaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgcHVibGljZGlyPWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIik7XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmICFwdWJsaWNkaXIpIHsgLy8gUmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiBwdWJsaWNkaXIpIHtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uLy4uL3B1YmxpY1wiLGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBGSUxFLUxJU1QgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0ZmlsZXNhc3luYycsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIGF1ZGlvPWZhbHNlLCBkb2N4PWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJSZWNlaXZlZCBhcmd1bWVudHM6XCIsIGZpbGVuYW1lLCBhdWRpbywgZG9jeCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcblxuICAgICAgICAgICAgICAgIGlmIChhdWRpbyA9PSB0cnVlKXsgLy8gYXVkaW8gZmlsZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZG9jeCl7ICAvL29mZmljZSBvcGVuIHhtbCBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBtYW1tb3RoLmNvbnZlcnRUb0h0bWwoe3BhdGg6IGZpbGVwYXRofSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgIC8vYmFrIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAvLyByZXR1cm4gZmlsZSBsaXN0IG9mIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXsgZnMubWtkaXJTeW5jKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfSAvL2RvIG5vdCBjcmFzaCBpZiB0aGUgZGlyZWN0b3J5IGlzIGRlbGV0ZWQgYWZ0ZXIgdGhlIGFwcCBpcyBzdGFydGVkIF5eXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlbGlzdCA9ICBmcy5yZWFkZGlyU3luYyh3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgICAgICAgICAgICAgICBmaWxlbGlzdC5mb3JFYWNoKCBmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2RpZmllZCA9IGZzLnN0YXRTeW5jKCAgIHBhdGguam9pbih3b3JrZGlyLGZpbGUpICApLm10aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kID0gbW9kaWZpZWQuZ2V0VGltZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wZGZcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcInBkZlwiLCBtb2Q6IG1vZH0pICAgfSAgICAgICAgIC8vcGRmXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmJha1wiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYmFrXCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBiYWNrdXAgZmlsZSB0byByZXBsYWNlIGVkaXRvciBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmRvY3hcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImRvY3hcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGNvbnRlbnQgZmlsZSAoZnJvbSB0ZWFjaGVyKSB0byByZXBsYWNlIGNvbnRlbnQgYW5kIGNvbnRpbnVlIHdyaXRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2diXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJnZ2JcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGdlb2dlYnJhXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm1wM1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5vZ2dcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIud2F2XCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYXVkaW9cIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGF1ZGlvXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmpwZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wbmdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2lmXCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiaW1hZ2VcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgQkFDS1VQIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBmaWxlbmFtZSB3aXRob3V0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGJhY2t1cGZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFJlcXVlc3QgcmVjZWl2ZWQgZm9yIGZpbGVuYW1lOiAke2ZpbGVuYW1lfWApXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRnVsbCBmaWxlIHBhdGg6ICR7ZmlsZXBhdGh9YClcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZmlsZXBhdGgpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgbm90IGZvdW5kOiAke2ZpbGVwYXRofWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIGV4aXN0cywgcmVhZGluZyBjb250ZW50YClcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBTdWNjZXNzZnVsbHkgcmVhZCBiYWNrdXAgZmlsZSwgY29udGVudCBsZW5ndGg6ICR7ZGF0YS5sZW5ndGh9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciByZWFkaW5nIGJhY2t1cCBmaWxlOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHN0YWNrOiAke2Vyci5zdGFja31gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IG5vIGZpbGVuYW1lIHByb3ZpZGVkYCk7IFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpcGNNYWluLm9uKCdyZWxvYWQtdXJsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlRWFzdGVyV2luKClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBcHBlbmQgUHJpbnRSZXF1ZXN0IHRvIGNsaWVudGluZm8gIFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3NlbmRQcmludFJlcXVlc3QnLCAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gdHJ1ZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXQtY3B1LWluZm8nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5pc1ZpcnR1YWxNYWNoaW5lKClcbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXQtd2xhbi1pbmZvJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3bGFuSW5mbyA9IGF3YWl0IGdldFdsYW5JbmZvKCk7XG4gICAgICAgICAgICByZXR1cm4gd2xhbkluZm87XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgXG4gICAgICAgIC8vIE5ldyBoYW5kbGVyIHRvIGdldCBQREYgZnJvbSBwdWJsaWMgZGlyZWN0b3J5IGZvciBmcm9udGVuZCBwYXJzaW5nXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQZGZGcm9tUHVibGljJywgYXN5bmMgKGV2ZW50LCBwZGZGaWxlbmFtZSApID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IGRpcmVjdG9yeSBuYW1lIGluIEVTTVxuICAgICAgICAgICAgICAgIGNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHBkZlBhdGg7XG4gICAgICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgcGRmRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZyb20gc2NyaXB0cy8gZ28gdXAgMyBsZXZlbHMgdG8gcmVhY2ggc3R1ZGVudC8gdGhlbiBwdWJsaWMvXG4gICAgICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgcGRmRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGRmUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBQREYgbm90IGZvdW5kIGF0OiAke3BkZlBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGRmUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG4gICAgaXNWaXJ0dWFsTWFjaGluZSgpIHtcbiAgICAgICAgY29uc3QgVkVORE9SUyA9IC8ob3JhY2xlfHZpcnR1YWxib3h8dm13YXJlfGt2bXxxZW11fHhlbnxpbm5vdGVrfHBhcmFsbGVsc3xtaWNyb3NvZnR8aHlwZXItdnxiaHl2ZXxyZWQgaGF0fHJlZGhhdHxib2Noc3xiaHl2ZXxvcGVuc3RhY2t8Y2xvdWR8YW1hem9ufGdvb2dsZXxhenVyZSkvaSAvLyBjb21tb24gVk0gaWRzXG4gICAgICAgIGNvbnN0IHdhcm5BbmRSZXR1cm4gPSByZWFzb24gPT4ge1xuICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBpc1ZpcnR1YWxNYWNoaW5lOiBWZXJkYWNodCBhdWYgVk0gLSAke3JlYXNvbn1gKVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gTGludXggLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjcHVpbmZvID0gcmVhZEZpbGVTeW5jKCcvcHJvYy9jcHVpbmZvJywgJ3V0ZjgnKSAgICAgIC8vIENQVSBmbGFnc1xuICAgICAgICAgICAgaWYgKC9eZmxhZ3MuKlxcYmh5cGVydmlzb3JcXGIvbS50ZXN0KGNwdWluZm8pKSByZXR1cm4gd2FybkFuZFJldHVybignaHlwZXJ2aXNvciBmbGFnIGluIC9wcm9jL2NwdWluZm8nKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IFtcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3N5c192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF9uYW1lJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfdmVyc2lvbicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9ib2FyZF92ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYmlvc192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvY2hhc3Npc192ZW5kb3InXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBjb25zdCBkbWkgPSBmaWxlcy5tYXAocCA9PiB7IHRyeSB7IHJldHVybiByZWFkRmlsZVN5bmMocCwgJ3V0ZjgnKSB9IGNhdGNoIHsgcmV0dXJuICcnIH0gfSkuam9pbignICcpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGRtaSkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdETUktVmVuZG9yLU1hdGNoJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXhlY1N5bmMoJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgLXEnLCB7IHN0ZGlvOiAnaWdub3JlJyB9KSAgICAvLyBleGl0IDAgPT4gVk1cbiAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdzeXN0ZW1kLWRldGVjdC12aXJ0IG1lbGRldCBWaXJ0dWFsaXNpZXJ1bmcnKVxuICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgIC8vIFp1c1x1MDBFNHR6bGljaGUgUUVNVS1zcGV6aWZpc2NoZSBFcmtlbm51bmdcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZSBhdWYgUUVNVS1zcGV6aWZpc2NoZSBHZXJcdTAwRTR0ZVxuICAgICAgICAgICAgY29uc3QgcWVtdURldmljZXMgPSBbXG4gICAgICAgICAgICAgICcvZGV2L3Zob3N0LXZzb2NrJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgZm9yIChjb25zdCBkZXZpY2Ugb2YgcWVtdURldmljZXMpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAocmVxdWlyZSgnZnMnKS5leGlzdHNTeW5jKGRldmljZSkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKGBRRU1VLUdlclx1MDBFNHQgZ2VmdW5kZW46ICR7ZGV2aWNlfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgLy8gUHJcdTAwRkNmZSBhdWYgUUVNVS1Qcm96ZXNzZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9IGV4ZWNTeW5jKCdwcyBhdXggfCBncmVwIC1pIHFlbXUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChwcy5pbmNsdWRlcygncWVtdScpICYmICFwcy5pbmNsdWRlcygnZ3JlcCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgbFx1MDBFNHVmdCcpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBXaW5kb3dzIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIihHZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW0gfCBGb3JFYWNoLU9iamVjdCB7ICRfLk1hbnVmYWN0dXJlciwgJF8uTW9kZWwgfSkgLWpvaW4gXFwnIFxcJ1wiJ1xuICAgICAgICAgICAgY29uc3QgYmFzaWMgPSBleGVjU3luYyhwcywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKSAgICAvLyBtYW51ZmFjdHVyZXIgKyBtb2RlbFxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChiYXNpYykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvTW9kZWxsIHBhc3N0IHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzUm9idXN0ID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJG89QCgpOycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbTskbys9QCgkY3MuTWFudWZhY3R1cmVyLCRjcy5Nb2RlbCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiYj1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQmFzZUJvYXJkOyRvKz1AKCRiYi5NYW51ZmFjdHVyZXIsJGJiLlByb2R1Y3QpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmlvcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQklPUzskbys9QCgkYmlvcy5TTUJJT1NCSU9TVmVyc2lvbil9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjc3A9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtUHJvZHVjdDskbys9QCgkY3NwLk5hbWUpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ1dyaXRlLU91dHB1dCAoKCRvIC1qb2luIFxcJyBcXCcpLlRyaW0oKSlcIidcbiAgICAgICAgICAgIGNvbnN0IHJvYnVzdCA9IGV4ZWNTeW5jKHBzUm9idXN0LCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHJvYnVzdCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvQklPUy1JbmZvcyBwYXNzZW4genUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICAvLyBadXNcdTAwRTR0emxpY2hlIFFFTVUtRXJrZW5udW5nIGZcdTAwRkNyIFdpbmRvd3NcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcWVtdVByb2Nlc3NlcyA9IGV4ZWNTeW5jKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgcWVtdSpcIicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgICAgIGlmIChxZW11UHJvY2Vzc2VzLmluY2x1ZGVzKCdxZW11JykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgdW50ZXIgV2luZG93cycpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuXG4gICAgICAgICAvLyAtLS0tLS0tLS0tIG1hY09TIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaHdNb2RlbCA9IGV4ZWNTeW5jKCdzeXNjdGwgLW4gaHcubW9kZWwnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmICgvXnZpcnR1YWwvaS50ZXN0KGh3TW9kZWwpIHx8IFZFTkRPUlMudGVzdChod01vZGVsKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIEhhcmR3YXJlbW9kZWxsIGRldXRldCBhdWYgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3AgPSBleGVjU3luYygnc3lzdGVtX3Byb2ZpbGVyIFNQSGFyZHdhcmVEYXRhVHlwZScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChzcCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBzeXN0ZW1fcHJvZmlsZXIgbWVsZGV0IFZNLVZlbmRvcicpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2UgICAgICAgXG4gICAgfVxuXG4gICAgY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQikge1xuICAgICAgICBjb25zdCBwYXJ0c0EgPSB2ZXJzaW9uQS5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgICAgICBjb25zdCBwYXJ0c0IgPSB2ZXJzaW9uQi5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWF4KHBhcnRzQS5sZW5ndGgsIHBhcnRzQi5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG51bUEgPSBwYXJ0c0FbaV0gfHwgMDsgLy8gRmFsbGJhY2sgYXVmIDAsIGZhbGxzIGtlaW4gV2VydCB2b3JoYW5kZW5cbiAgICAgICAgICAgIGNvbnN0IG51bUIgPSBwYXJ0c0JbaV0gfHwgMDtcbiAgICBcbiAgICAgICAgICAgIGlmIChudW1BIDwgbnVtQikgcmV0dXJuIC0xO1xuICAgICAgICAgICAgaWYgKG51bUEgPiBudW1CKSByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgXG4gICAgY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyQSA9IHBhcnNlSW50KHN0YXR1c0EubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgICAgIGNvbnN0IG51bWJlckIgPSBwYXJzZUludChzdGF0dXNCLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgIFxuICAgICAgICBpZiAobnVtYmVyQSA8IG51bWJlckIpIHJldHVybiAtMTtcbiAgICAgICAgaWYgKG51bWJlckEgPiBudW1iZXJCKSByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgY29tcGFyZVNvZnR3YXJlKHZlcnNpb25BLCBzdGF0dXNBLCB2ZXJzaW9uQiwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCB2ZXJzaW9uQ29tcGFyaXNvbiA9IHRoaXMuY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQik7XG4gICAgICAgIGlmICh2ZXJzaW9uQ29tcGFyaXNvbiAhPT0gMCkgcmV0dXJuIHZlcnNpb25Db21wYXJpc29uO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcy5jb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQik7XG4gICAgfVxuXG5cbn1cbiBcbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiIsICJpbXBvcnQge2NyZWF0ZUkxOG59IGZyb20gJ3Z1ZS1pMThuJ1xuXG5pbXBvcnQgZW4gZnJvbSAnLi9lbi5qc29uJ1xuaW1wb3J0IGRlIGZyb20gJy4vZGUuanNvbidcblxuY29uc3QgaTE4biA9IGNyZWF0ZUkxOG4oe1xuICAgIGxvY2FsZTogJ2RlJyxcbiAgICBmYWxsYmFja0xvY2FsZTogJ2VuJyxcbiAgICBtZXNzYWdlczoge1xuICAgICAgICBlbixcbiAgICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4biIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJSZXN0b3JlXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJEaXNjb25uZWN0XCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJFeGl0XCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiRXhhbXNcIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIlVzZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXIgYWRkcmVzc1wiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJFeGFtIE5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcInJlZ2lzdGVyXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJyZWdpc3RlcmluZy4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJyZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiZGlzY29ubmVjdGVkXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXIhIFxcblxcblBsZWFzZSB3YWl0IGZvciB0aGUgYWN0aXZhdGlvbiBvZiB0aGUgZXhhbSBtb2RlIGJ5IHRoZSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJzZWFyY2ggc3RhcnRlZFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJ3cm9uZyB1c2VybmFtZSBvciBwaW5cIixcbiAgICAgICAgXCJub3VzZXJcIjpcIm5vIHVzZXJuYW1lIGdpdmVuXCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkZHJlc3NlIG9kZXIgRXhhbW5hbWUgbWlzc2luZ1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJObyBOZXR3b3JrIENvbm5lY3Rpb25cIixcbiAgICAgICAgXCJub3BpblwiOiBcIm5vIHBpbmNvZGUgZ2l2ZW5cIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOlwiU2VydmVyIEFQSSB1bnJlYWNoYWJsZVwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBpcyBiZWhpbmQgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJObyBUZWFjaGVyIEFQSSBmb3VuZCBvbiB0aGUgZ2l2ZW4gYWRkcmVzc1wiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxvY2FsIGxvY2tkb3duXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51YWwgc2VhcmNoXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiTm8gZXhhbXMgZm91bmRcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBsb2dvdXQ/XCIsXG4gICAgICAgIFwiZGVcIjogXCJHZXJtYW5cIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyZW5jaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWFuXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3ZlbmlhblwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFjdGl2YXRlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJQbGVhc2UgY2hvb3NlIGEgbGFuZ3VhZ2VcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiTGFuZ3VhZ2VzXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWNzXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJTZWxlY3QgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiUGxlYXNlIGluc3RhbGwgdGhlIHNhbWUgdmVyc2lvbiBhcyB0aGUgZXhhbSBzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwic2FmZSBleGFtIHN0YXR1cyBjaGFuZ2VkXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJzdGFydGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcInN0b3BwZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJzYWZlIGV4YW0gbW9kZSBub3QgYWN0aXZlXCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJzdHVkZW50IHJlbW92ZWQgZnJvbSBzZXJ2ZXJcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJmaWxlcyBzdG9yZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcImZpbGUgZXJyb3JcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwicGxlYXNlIGNoZWNrIGlmIHRoZSAnRVhBTS1TVFVERU5UJyBkaXJlY3RvcnkgaXMgd3JpdGVhYmxlIGFuZCBoYXMgZW5vdWdoIHNwYWNlXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJBIGxvY2FsIGJhY2t1cCBjb3VsZCBub3QgYmUgY3JlYXRlZC4gUGxlYXNlIHVzZSB0aGUgbWFudWFsIHN1Ym1pc3Npb24gb3B0aW9uLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiZG9uJ3Qgc2hvdyBhZ2FpblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZm91bmRcIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJHZXQgbWF0ZXJpYWxzXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIlNlbmQgZmluYWwgZXhhbVwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiRmluYWwgc3VibWl0XCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxzOlwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2NhbCBmaWxlczpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJVcGRhdGVcIixcbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGxpdHZpZXdcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJZb3UgaGF2ZSBsZWZ0IHRoZSBzYWZlIGV4YW0gbW9kZSFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIlBsZWFzZSBpbmZvcm0gYSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIkRvIHlvdSB3YW50IHRvIHJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhlIGVkaXRvciB3aXRoIHRoZSBjb250ZW50IG9mIFwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcIj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkNhbmNlbFwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlJlcGxhY2VcIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cCBmaWxlIGNvdWxkIG5vdCBiZSByZWFkXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIHN1Y2Nlc3NmdWxseSBsb2FkZWRcIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkVycm9yIGxvYWRpbmcgYmFja3VwIGZpbGVcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIlN1Y2Nlc3NcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcImNoYXJzXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJ3b3Jkc1wiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcInJlY29ubmVjdFwiLFxuICAgICAgICBcInVubG9ja1wiOiBcInVubG9ja1wiLFxuICAgICAgICBcImV4aXRcIjogXCJFeGl0IHNhZmUgZXhhbSBtb2RlP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkRvIG5vdCBsZWF2ZSBzYWZlIGV4YW0gbW9kZSB3aXRob3V0IHBlcm1pc3Npb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIklmIHRoaXMgcHJvY2VzcyBmYWlscyB1bmxvY2sgYW5kIHRyeSBhZ2FpbiFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIkNyZWF0aW5nIGJhY2t1cFwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkNyZWF0aW5nIGJhY2t1cCBhbmQgY2xpcGJvYXJkIGNvcHlcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiTGVhdmluZyBFeGFtIG1vZGVcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJiYWNrdXBcIixcbiAgICAgICAgXCJ1bmRvXCI6XCJ1bmRvXCIsXG4gICAgICAgIFwicmVkb1wiOlwicmVkb1wiLFxuICAgICAgICBcImNsZWFyXCI6XCJjbGVhclwiLFxuICAgICAgICBcImJvbGRcIjpcImJvbGRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcIml0YWxpY1wiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW5kZXJsaW5lXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcImhlYWRpbmcxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcImhlYWRpbmcyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcImhlYWRpbmczXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcImhlYWRpbmc0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcImhlYWRpbmc1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcImhlYWRpbmc2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJzdWJzY3JpcHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwic3VwZXJzY3JpcHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJidWxsZXRsaXN0XCIsXG4gICAgICAgIFwibGlzdFwiOlwibGlzdFwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiY29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiY29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcImJsb2NrcXVvdGVcIixcbiAgICAgICAgXCJsaW5lXCI6XCJwYWdlYnJlYWtcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJsZWZ0XCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJjZW50ZXJcIixcbiAgICAgICAgXCJyaWdodFwiOlwicmlnaHRcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcInRleHRjb2xvclwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwibGluZWJyZWFrXCIsXG4gICAgICAgIFwibW9yZVwiOlwibW9yZVwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJpbnNlcnR0YWJsZVwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJkZWxldGV0YWJsZVwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJjb2x1bW5hZnRlclwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJyb3dhZnRlclwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiZGVsY29sdW1uXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJkZWxyb3dcIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIm1lcmdlb3JzcGxpdFwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiaGVhZGVyY29sdW1uXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJoZWFkZXJyb3dcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwic2VsZWN0ZWQgd29yZHMvY2hhcnNcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwicHJpbnQgcmVxdWVzdCBzZW50XCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwicHJpbnQgcmVxdWVzdCBkZW5pZWRcIixcbiAgICAgICAgXCJwYXN0ZVwiOlwicGFzdGVcIixcbiAgICAgICAgXCJjb3B5XCI6XCJjb3B5XCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcInNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcImRlYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIlJlbG9hZFwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb3VsZCB5b3UgbGlrZSB0byByZWluaXRpYWxpemUgdGhlIEVkaXRvcj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwia2VlcCBjb250ZW50XCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIkluc2VydCBzcGVjaWFsY2hhcmFjdGVyXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiUGxheSBBdWRpb1wiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIkRvIHlvdSB3YW50IHRvIHBsYXkgdGhlIGF1ZGlvZmlsZT9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiUmVtYWluaW5nIHBsYXliYWNrczpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIllvdSBkb24ndCBoYXZlIHRoZSBwZXJtaXNzaW9uIHRvIHBsYXkgdGhpcyBmaWxlIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiSW5zZXJ0IEltYWdlXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJJbnNlcnQgTXVnc2hvdFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIlNlbmQgd29yayB0byB0ZWFjaGVyXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiQ2xvc2VcIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJFeGl0IHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJGaWxlbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIlBsZWFzZSBlbnRlciBvbmx5IGxldHRlcnMgYW5kIG51bWJlcnMgd2l0aG91dCBzcGVjaWFsIGNoYXJhY3RlcnNcIixcbiAgICAgICAgXCJjbGVhclwiOiBcImNsZWFyIGNvbnRlbnQ/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJObyB2YWxpZCBQREYgRmlsZVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJXcm9uZyBwYXNzd29yZFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJSZWxvYWQgd2Vidmlld1wiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJXaWVkZXJoZXJzdGVsbGVuXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJWZXJiaW5kdW5nIHRyZW5uZW5cIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkJlZW5kZW5cIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiQmVudXR6ZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXItQWRyZXNzZVwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiZm9ydGdlc2Nocml0dGVuXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwiZWluZmFjaFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwibWVsZGUgYW4uLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiYW5nZW1lbGRldFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcIlZlcmJpbmR1bmcgdW50ZXJicm9jaGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTaWUgaGFiZW4gc2ljaCBlcmZvbGdyZWljaCBhbSBTZXJ2ZXIgcmVnaXN0cmllcnQhIFxcblxcbkJpdHRlIHdhcnRlbiBTaWUgYXVmIGRpZSBBa3RpdmllcnVuZyBkZXMgUHJcdTAwRkNmdW5nc21vZHVzIGR1cmNoIGRpZSBMZWhycGVyc29uIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJTdWNoZSBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJub3B3XCI6IFwiRmFsc2NoZXIgQmVudXR6ZXJuYW1lIG9kZXIgUGluY29kZVwiLFxuICAgICAgICBcIm5vdXNlclwiOiBcIkJlbnV0emVybmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZHJlc3NlIG9kZXIgUHJcdTAwRkNmdW5nc25hbWUgZmVobHRcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiS2VpbmUgTmV0endlcmt2ZXJiaW5kdW5nXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJQaW5jb2RlIGZlaGx0XCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjogXCJTZXJ2ZXIgQVBJIG5pY2h0IGVycmVpY2hiYXIuXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGJlZmluZGV0IHNpY2ggbVx1MDBGNmdsaWNoZXJ3ZWlzZSBoaW50ZXIgZWluZXIgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJLZWluZSBQclx1MDBGQ2Z1bmdzc2VydmVyIGFuIGFuZ2VnZWJlbmVyIEFkcmVzc2VcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2thbCBhYnNwZXJyZW5cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVlbGwgc3VjaGVuXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiS2VpbmUgUHJcdTAwRkNmdW5nZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgc2ljaCBhYm1lbGRlbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJhbmRlcmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWliaGlsZmVcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJWb3JzY2hsXHUwMEU0Z2UgemVpZ2VuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFNwcmFjaGUgZlx1MDBGQ3IgZGllIFByXHUwMEZDZnVuZ1wiLFxuICAgICAgICBcImxhbmdcIjogXCJTcHJhY2hlblwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGlrXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJQclx1MDBGQ2Z1bmdzbW9kdXMgYXVzd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJCaXR0ZSBpbnN0YWxsaWVyZW4gc2llIGRpZSBzZWxiZSBWZXJzaW9uIHdpZSBhbSBQclx1MDBGQ2Z1bmdzc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCBnXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIGdlXHUwMEU0bmRlcnRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiB1bnRlciBkaWVzZW0gTmFtZW4gYmVyZWl0cyBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgbmljaHQgYWt0aXZcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBlbnRmZXJudFwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcIkRhdGVpZW4gZ2VzcGVpY2hlcnRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBTY2hyZWliZW4gZGVyIERhdGVpXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcIkJpdHRlIHN0ZWxsZW4gU2llIHNpY2hlciwgZGFzcyBkYXMgJ0VYQU0tU1RVREVOVCcgVmVyemVpY2huaXMgZlx1MDBGQ3IgTmV4dC1FeGFtIHNjaHJlaWJiYXIgaXN0IHVuZCBnZW5cdTAwRkNnZW5kIFNwZWljaGVycGxhdHogdm9yaGFuZGVuIGlzdC5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkVpbmUgbG9rYWxlIFNpY2hlcnVuZyBrb25udGUgbmljaHQgZXJzdGVsbHQgd2VyZGVuLiBOdXR6ZW4gU2llIGRpZSBtYW51ZWxsZSBBYmdhYmUgdW0gSWhyZSBBcmJlaXQgZGlyZWt0IGFuIGRpZSBMZWhycGVyc29uIHp1IHNlbmRlbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcIk5pY2h0IG1laHIgYW56ZWlnZW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGdlZnVuZGVuXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW4gaG9sZW5cIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiRmluYWxlIEFiZ2FiZSBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiQWJnYWJlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW46XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiQWt0dWFsaXNpZXJlblwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2thbGUgRGF0ZWllbjpcIixcblxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwYWx0ZW5hbnNpY2h0XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiU2llIGhhYmVuIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHZlcmxhc3NlbiFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIk1lbGRlbiBTaWUgc2ljaCB1bWdlaGVuZCBiZWkgZGVyIEF1ZnNpY2h0c3BlcnNvbiFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJXb2xsZW4gU2llIGRlbiBJbmhhbHQgZGVzIEVkaXRvcnMgZHVyY2ggZGVuIEluaGFsdCBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCJlcnNldHplbj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkFiYnJlY2hlblwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIkVyc2V0emVuXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAtRGF0ZWkga29ubnRlIG5pY2h0IGdlbGVzZW4gd2VyZGVuXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIGVyZm9sZ3JlaWNoIGdlbGFkZW5cIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkZlaGxlciBiZWltIExhZGVuIGRlciBCYWNrdXAtRGF0ZWlcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJFcmZvbGdcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcIlplaWNoZW5cIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIldcdTAwRjZydGVyXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwibmV1IHZlcmJpbmRlblwiLFxuICAgICAgICBcInVubG9ja1wiOiBcImVudHNwZXJyZW5cIixcbiAgICAgICAgXCJleGl0XCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIlZlcmxhc3NlbiBTaWUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgbmllIG9obmUgRnJlaWdhYmUgZWluZXIgTGVocnBlcnNvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiU29sbHRlIGRlciBWb3JnYW5nIGZlaGxzY2hsYWdlbiBiZWVuZGVuIFNpZSBiaXR0ZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB1bmQgdmVyc3VjaGVuIFNpZSBlcyBlcm5ldXQhXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJJaHJlIEFyYmVpdCB3dXJkZSBlcmZvbGdyZWljaCBnZXNpY2hlcnQhXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiRGllIGFrdHVlbGxlIEFyYmVpdCB3aXJkIGdlc2ljaGVydCB1bmQgaW4gZGllIFp3aXNjaGVuYWJsYWdlIGtvcGllcnQhXCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcInNpY2hlcm5cIixcbiAgICAgICAgXCJ1bmRvXCI6XCJyXHUwMEZDY2tnXHUwMEU0bmdpZ1wiLFxuICAgICAgICBcInJlZG9cIjpcIndpZWRlcmhvbGVuXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImJvbGRcIjpcImZldHRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcImt1cnNpdlwiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW50ZXJzdHJpY2hlblwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiXHUwMERDYmVyc2NocmlmdCAyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiXHUwMERDYmVyc2NocmlmdCA1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwidGllZmdlc3RlbGx0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcImhvY2hnZXN0ZWxsdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcInVuZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwibGlzdFwiOlwiZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJDb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJDb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiWml0YXRcIixcbiAgICAgICAgXCJsaW5lXCI6XCJTZWl0ZW51bWJydWNoXCIsXG4gICAgICAgIFwibGVmdFwiOlwiTGlua3NiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcImNlbnRlclwiOlwiWmVudHJpZXJ0XCIsXG4gICAgICAgIFwicmlnaHRcIjpcIlJlY2h0c2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJUZXh0ZmFyYmVcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcIlplaWxlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtZWhyXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcIlRhYmVsbGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJUYWJlbGxlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJTcGFsdGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJSZWloZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJTcGFsdGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJSZWloZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIlZlcmVpbmVuIG9kZXIgVGVpbGVuXCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJUaXRlbHNwYWx0ZVwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiVGl0ZWxyZWloZVwiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJXXHUwMEY2cnRlci9aZWljaGVuIGluIEF1c3dhaGxcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwiRHJ1Y2thbmZyYWdlIGdlc2VuZGV0IVwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcIkRydWNrYW5mcmFnZSBhYmdlbGVobnQuIEJpdHRlIHdhcnRlbiB1bmQgZXJuZXV0IHNlbmRlbi5cIixcbiAgICAgICAgXCJwYXN0ZVwiOlwiZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImNvcHlcIjpcImtvcGllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgZGVha3RpdmllcmVuXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiTmV1IGxhZGVuXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvbGxlbiBTaWUgZGVuIFRleHRlZGl0b3IgbmV1IGluaXRpYWxpc2llcmVuP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJJbmhhbHQgYmVpYmVoYWx0ZW5cIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiU29uZGVyemVpY2hlbiBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJkcnVja2VuXCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJBdWRpbyBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJXb2xsZW4gU2llIGRhcyBIXHUwMEY2cmJlaXNwaWVsIGpldHp0IGFic3BpZWxlbj9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiVmVyYmxlaWJlbmRlIER1cmNobFx1MDBFNHVmZTpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIlNpZSBoYWJlbiBrZWluZSBCZXJlY2h0aWd1bmcgZGllIEF1ZGlvZGF0ZWkgZXJuZXV0IGFienVzcGllbGVuIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiQmlsZCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJNdWdzaG90IGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJBcmJlaXQgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJTY2hsaWVcdTAwREZlblwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkRhdGVpbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBudXIgQnVjaHN0YWJlbiBvZGVyIFphaGxlbiBlaW4uXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJBbGxlIEJlcmVjaG51bmdlbiBsXHUwMEY2c2NoZW4/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgZ1x1MDBGQ2x0aWdlIFBERiBEYXRlaVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJGYWxzY2hlcyBQYXNzd29ydFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJXZWJ2aWV3IG5ldSBsYWRlblwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiTVx1MDBGNmdsaWNoZXJ3ZWlzZSBnZXNjYW5udGVzIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJBdWZcIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcInd1cmRlbiB3ZW5pZ2VyIGFscyAyIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGdlZnVuZGVuLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIkRpZXMgZGV1dGV0IGRhcmF1ZiBoaW4sIGRhc3MgZXMgc2ljaCB1bSBlaW4gZ2VzY2FubnRlcyBQREYgaGFuZGVsdCwgZGFzIGtlaW5lIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgb2RlciBUYWJlbGxlbiBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlZlcnN0YW5kZW5cIixcbiAgICAgICAgXCJwYWdlXCI6IFwiU2VpdGVcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlNlaXRlblwiXG4gICAgfVxufVxuIiwgIi8vIHNjcmlwdHMvU3lzdGVtVHJheU1hbmFnZXIuanNcbmltcG9ydCB7IGFwcCwgVHJheSwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJzsgXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJzsgLy8gUGF0aCBtb2R1bGUgaW1wb3J0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7IC8vIExvZ2dpbmcgbW9kdWxlXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnOyAvLyBXaW5kb3cgbWFuYWdlclxuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnOyAvLyBDb21tdW5pY2F0aW9uIGxvZ2ljXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJzsgLy8gSTE4biBpbnN0YW5jZVxuXG5cblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgLy8gR2V0IGN1cnJlbnQgZGlyZWN0b3J5XG5cbmxldCB0cmF5ID0gbnVsbDsgLy8gUHJpdmF0ZSB0cmF5IGluc3RhbmNlXG5cbi8vIFBhdGggdG8gdGhlIGFwcCBpY29uXG5jb25zdCBpY29uUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMnLCdpY29uMjR4MjQucG5nJyk7IFxuXG4vLyA9PT0gcmVwbGFjZSB0aGUgaGVscGVyIHNldExvY2FsZSAoZXhhY3QgYmxvY2spID09PVxuY29uc3Qgc2V0TG9jYWxlID0gKGxvYykgPT4ge1xuICAgIGNvbnN0IGdsID0gaTE4bi5nbG9iYWw7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZ2xvYmFsIGNvbXBvc2VyXG4gICAgaWYgKGdsICYmIHR5cGVvZiBnbC5sb2NhbGUgPT09ICdvYmplY3QnICYmIGdsLmxvY2FsZSkge1xuICAgICAgLy8gdnVlLWkxOG4gY29tcG9zaXRpb24gbW9kZVxuICAgICAgaWYgKCd2YWx1ZScgaW4gZ2wubG9jYWxlKSBnbC5sb2NhbGUudmFsdWUgPSBsb2M7ICAgICAvLyBzZXQgcmVhY3RpdmUgdmFsdWVcbiAgICAgIGVsc2UgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbGJhY2tcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbGVnYWN5IG1vZGUgb3IgcGxhaW4gc3RyaW5nXG4gICAgICBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbiBzdHJpbmcgbG9jYWxlXG4gICAgfVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gIFxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB0cmF5IGljb24gaWYgaXQgZG9lc24ndCBleGlzdCBhbmQgdXBkYXRlcyBpdHMgY29udGV4dCBtZW51LlxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBuZXcgbG9jYWxlIHRvIGFwcGx5LlxuICovXG5cblxuXG5leHBvcnQgY29uc3QgdXBkYXRlU3lzdGVtVHJheSA9IChsb2NhbGUpID0+IHtcbiAgICBzZXRMb2NhbGUobG9jYWxlKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IHQgPSAoaykgPT4gaTE4bi5nbG9iYWwudChrKTsgICAgICAgICAgICAgICAgICAgICAgLy8gYWx3YXlzIHJlc29sdmUgbGl2ZVxuICBcbiAgICBpZiAoIXRyYXkpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0cmF5IG9uY2VcbiAgICAgIHRyYXkgPSBuZXcgVHJheShpY29uUGF0aCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0cmF5IGljb25cbiAgICAgIHRyYXkub24oJ2NsaWNrJywgKCkgPT4geyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2dsZSB3aW5kb3dcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpIFxuICAgICAgICAgID8gV2luZG93SGFuZGxlci5tYWlud2luZG93LmhpZGUoKSBcbiAgICAgICAgICA6IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIFxuICAgIC8vIGJ1aWxkIGNvbnRleHQgbWVudSB3aXRoIGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgY29udGV4dE1lbnUgPSBNZW51LmJ1aWxkRnJvbVRlbXBsYXRlKFtcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5yZXN0b3JlJyksIGNsaWNrOiAoKSA9PiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpIH0sIC8vIHNob3cgd2luZG93XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZGlzY29ubmVjdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cuaW5mbyhcIm1haW4gQCBzeXN0ZW10cmF5OiByZW1vdmluZyByZWdpc3RyYXRpb25cIik7IFxuICAgICAgICAgIENvbW1IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpOyBcbiAgICAgICAgfSBcbiAgICAgIH0sIC8vIGRpc2Nvbm5lY3RcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5leGl0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IENsb3NpbmcgTmV4dC1FeGFtXCIpOyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXCIpOyBcbiAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgXG4gICAgICAgICAgYXBwLnF1aXQoKTsgXG4gICAgICAgIH0gXG4gICAgICB9IC8vIGV4aXRcbiAgICBdKTtcbiAgXG4gICAgdHJheS5zZXRUb29sVGlwKCdOZXh0LUV4YW0gU3R1ZGVudCcpOyAgICAgICAgICAgICAgICAgICAvLyBzZXQgdG9vbHRpcFxuICAgIHRyYXkuc2V0Q29udGV4dE1lbnUoY29udGV4dE1lbnUpOyAgICAgICAgICAgICAgICAgICAgICAgLy8gYXBwbHkgbWVudVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gICIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBzY3JpcHQgaXMgdXNlZCB0byB0ZXN0IHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICogSXQgdXNlcyB0aGUgdGNjdXRpbCBjb21tYW5kIHRvIHRlc3QgYW5kIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICogSXQgcmV0dXJucyB0cnVlIGlmIHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIGFyZSBhbGxvd2VkIGFuZCBmYWxzZSBpZiB0aGV5IGFyZSBub3RcbiAqIFxuICogVGhpcyBjb3VsZCBhbHNvIGJlIHVzZWQgdG8gdGVzdCBvdGhlciBwZXJtaXNzaW9ucyBsaWtlIGFjY2Vzc2liaWxpdHksIHNjcmVlbiBjYXB0dXJlLCBldGMuIFxuICogc2VlIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGZvciBtb3JlIGRldGFpbHMgb24gaG93IHRvIHRlc3QgZm9yIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgKGl0cyBub3QgcG9zc2libGUgdG8gdGVzdCBmb3Igc2NyZWVuIGNhcHR1cmUgcGVybWlzc2lvbnMgb24gbWFjb3MgYmVjYXVzZSB3aXRob3V0IHBlcm1pc3Npb25zIGl0IHdpbGwgYWx3YXlzIHJldHVybiBhIGJsYW5rIHNjcmVlbnNob3QgLSB3ZSB1c2UgYSB3b3JrYXJvdW5kIHRvIGRldGVjdCB0aGlzKVxuICogXG4gKi9cblxuXG5cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBydW4gdGNjdXRpbFxuaW1wb3J0IHsgZGlhbG9nLCBhcHAgfSBmcm9tICdlbGVjdHJvbicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2hvdyBkaWFsb2cgYW5kIHF1aXRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuXG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAgICAgICAgICAgICAgICAvLyByZXR1cm5zIHRydWUgaWYgZmV0Y2ggd29ya3NcbiAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHtzZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wb25nYCwgeyBtZXRob2Q6ICdHRVQnLCBjYWNoZTogJ25vLXN0b3JlJyB9KSAvLyB0ZXN0IHJlcXVlc3RcbiAgICAgICAgICAgIHJldHVybiByZXMub2tcbiAgICB9IGNhdGNoIHsgIHJldHVybiBmYWxzZSB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNldFRDQygpIHsgICAgICAvLyByZXNldCBUQ0MgcGVybWlzc2lvbnNcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvL2FwcElkXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS5zdHVkZW50YCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcbiAgICAgICAgLy9hcHBCdW5kbGVJZCAoc2V0IHZpYSBub3Rhcml6ZSlcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLXN0dWRlbnQuYXBwYCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcblxuXG4gICAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7IC8vIGNoZWNrIG9yIHJlc2V0XG4gICAgY29uc3Qgb2sgPSBhd2FpdCB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpXG4gICAgaWYgKG9rKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5ldHdvcmsgYWNjZXNzIGlzIGFsbG93ZWRgKTtcbiAgICAgICAgICAgIHJldHVybiBcIm9rXCI7XG4gICAgfVxuICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTm8gSFRUUCByZXF1ZXN0cyBhbGxvd2VkIWAgKVxuXG4gICAgdHJ5IHtcblxuICAgICAgICAvLyBhc2sgdGhlIHVzZXJzIGlmIHRoZXkgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnMgYW5kIGV4aXQgdGhlIGFwcCBpZiB0aGV5IGRvXG4gICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEZXIgU2VydmVyIGlzdCBuaWNodCBlcnJlaWNoYmFyLiBNXHUwMEY2Y2h0ZW4gU2llIGRpZSBCZXJlY2h0aWd1bmdlbiB6dXJcdTAwRkNja3NldHplbiB1bmQgTmV4dC1FeGFtIG1hbnVlbGwgbmV1IHN0YXJ0ZW4/JyxcbiAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snLCAnQWJicmVjaGVuJ10sXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChjaG9pY2UucmVzcG9uc2UgPT09IDApIHsgICAgLy8gcmVzZXQgcGVybWlzc2lvbnMgYW5kIHJldHVybiB0cnVlIHRvIHF1aXQgdGhlIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBSZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9ucyBhbmQgcXVpdHRpbmcgYXBwYCk7XG4gICAgICAgICAgICBhd2FpdCByZXNldFRDQygpOyBcbiAgICAgICAgICAgIHJldHVybiBcInJlc2V0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlIFxuICAgICAgICB9ICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gXG4gICAgfSBcbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBsb2cuZXJyb3IoYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBFcnJvciByZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9uczogJHtlfWApO1xuICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdGZWhsZXIgYmVpbSBadXJcdTAwRkNja3NldHplbiBkZXIgQmVyZWNodGlndW5nZW4nLFxuICAgICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZS5lcnIgfHwgZSksXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuICAgIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gQ291bnRlciBmb3IgZmFpbGVkIGF0dGVtcHRzIC0gc2tpcCBleGVjdXRpb24gYWZ0ZXIgNCBjb25zZWN1dGl2ZSBmYWlsdXJlc1xubGV0IGZhaWx1cmVDb3VudGVyID0gMDtcbmNvbnN0IE1BWF9GQUlMVVJFUyA9IDM7XG5cbi8vIENvbnZlcnQgUlNTSSBpbiBkQm0gdG8gYSBxdWFsaXR5IHBlcmNlbnRhZ2UgYmV0d2VlbiAwIGFuZCAxMDAuXG5mdW5jdGlvbiBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSkge1xuICAgIGlmIChkYm0gPT09IG51bGwgfHwgTnVtYmVyLmlzTmFOKGRibSkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IG1pbkRibSA9IC0xMDA7XG4gICAgY29uc3QgbWF4RGJtID0gLTMwO1xuICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heChtaW5EYm0sIE1hdGgubWluKG1heERibSwgZGJtKSk7XG4gICAgY29uc3QgcGVyY2VudCA9ICgoY2xhbXBlZCAtIG1pbkRibSkgLyAobWF4RGJtIC0gbWluRGJtKSkgKiAxMDA7XG4gICAgcmV0dXJuIE1hdGgucm91bmQocGVyY2VudCk7XG59XG5cbi8qKlxuICogR2V0IGN1cnJlbnQgV0xBTiBpbmZvcm1hdGlvbiAoU1NJRCwgQlNTSUQsIFF1YWxpdHkpXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7c3NpZDogc3RyaW5nfG51bGwsIGJzc2lkOiBzdHJpbmd8bnVsbCwgcXVhbGl0eTogbnVtYmVyfG51bGwsIG1lc3NhZ2U6IHN0cmluZ3xudWxsfT59XG4gKiBAZGVzY3JpcHRpb24gbWVzc2FnZSBjYW4gYmU6IFwiZXJyb3JcIiAob24gZXJyb3IpLCBcIm5vaW50ZXJmYWNlXCIgKG5vIGludGVyZmFjZSBhdmFpbGFibGUpLCBcIm5vcGVybWlzc2lvbnNcIiAobG9jYXRpb24gcGVybWlzc2lvbnMgbWlzc2luZyBvbiBXaW5kb3dzKSwgb3IgbnVsbCAoc3VjY2VzcylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvKCkge1xuICAgIC8vIFNraXAgZXhlY3V0aW9uIGlmIHdlJ3ZlIGhhZCB0b28gbWFueSBjb25zZWN1dGl2ZSBmYWlsdXJlc1xuICAgIGlmIChmYWlsdXJlQ291bnRlciA+PSBNQVhfRkFJTFVSRVMpIHtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICBcbiAgICAgICAgc3dpdGNoIChwbGF0Zm9ybSkge1xuICAgICAgICAgICAgY2FzZSAnbGludXgnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTGludXgoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9NYWNPUygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEVuc3VyZSByZXN1bHQgaXMgYWx3YXlzIGFuIG9iamVjdFxuICAgICAgICBpZiAoIXJlc3VsdCB8fCB0eXBlb2YgcmVzdWx0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlc2V0IGNvdW50ZXIgb24gc3VjY2Vzc2Z1bCByZXN1bHQgKGhhcyBkYXRhKVxuICAgICAgICBpZiAocmVzdWx0LnNzaWQgfHwgcmVzdWx0LmJzc2lkIHx8IHJlc3VsdC5xdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlciA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbmNyZW1lbnQgY291bnRlciBvbiBmYWlsdXJlXG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIFJldHVybiBlbXB0eSBvYmplY3QgaW5zdGVhZCBvZiB0aHJvd2luZyB0byBwcmV2ZW50IGFwcCBjcmFzaFxuICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIExpbnV4IHVzaW5nIG5tY2xpICh3aXRoIGZhbGxiYWNrIHRvIGl3L2l3Y29uZmlnKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb0xpbnV4KCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBubWNsaSBmaXJzdCAobW9zdCBjb21tb24gb24gbW9kZXJuIExpbnV4KVxuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZ2V0IGFjdGl2ZSBkZXZpY2UgZGlyZWN0bHkgKGZhc3RlciB0aGFuIGxpc3RpbmcgYWxsIG5ldHdvcmtzKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHN0ZG91dCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYygnbm1jbGkgLXQgLWYgYWN0aXZlLHNzaWQsYnNzaWQsc2lnbmFsIGRldmljZSB3aWZpIGxpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDQwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3Rkb3V0ID0gcmVzdWx0LnN0ZG91dDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBjYXRjaCAoZXhlY0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gRXZlbiBpZiBleGVjQXN5bmMgdGhyb3dzIGFuIGVycm9yLCBjaGVjayBpZiBzdGRvdXQgY29udGFpbnMgdmFsaWQgZGF0YVxuICAgICAgICAgICAgICAgIC8vIG5tY2xpIHNvbWV0aW1lcyByZXR1cm5zIG5vbi16ZXJvIGV4aXQgY29kZSBidXQgc3RpbGwgcHJvdmlkZXMgdmFsaWQgb3V0cHV0XG4gICAgICAgICAgICAgICAgaWYgKGV4ZWNFcnJvci5zdGRvdXQgJiYgZXhlY0Vycm9yLnN0ZG91dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzdGRvdXQgPSBleGVjRXJyb3Iuc3Rkb3V0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4ZWNFcnJvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvdXRwdXQgZnJvbSBubWNsaScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmluZCBhY3RpdmUgY29ubmVjdGlvblxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICAgICAgaWYgKChwYXJ0c1swXSA9PT0gJ3llcycgfHwgcGFydHNbMF0gPT09ICdqYScpICYmIHBhcnRzLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBwYXJ0c1sxXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgLy8gQlNTSUQgaXMgYSBNQUMgYWRkcmVzcyAoNiBoZXggYnl0ZXMgc2VwYXJhdGVkIGJ5IGNvbG9ucywgcG9zc2libHkgZXNjYXBlZClcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCB1c2luZyByZWdleCAtIGhhbmRsZSBlc2NhcGVkIGNvbG9ucyAoXFw6KSBhcyBzaG93biBpbiBubWNsaSBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gcmVnZXggc3RyaW5nLCBcXFxcOiBtYXRjaGVzIGEgbGl0ZXJhbCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgY29sb25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86XFxcXDpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZXNjYXBlIGJhY2tzbGFzaGVzIGFuZCBub3JtYWxpemUgdG8gdXBwZXJjYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2hbMF0ucmVwbGFjZSgvXFxcXDovZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBub3JtYWwgY29sb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbm9ybWFsTWF0Y2hbMF0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBwYXJ0c1syXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTaWduYWwgaXMgdGhlIGxhc3QgbnVtZXJpYyBwYXJ0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbFN0ciA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID8gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHJpbSgpIDogJyc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IHNpZ25hbFN0ciA/IChwYXJzZUludChzaWduYWxTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChubWNsaUVycm9yKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQsIGV0Yy4pLCBub3QgaWYganVzdCBubyBXTEFOIGFjdGl2ZVxuICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBubWNsaUVycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChubWNsaUVycm9yLm1lc3NhZ2UgJiYgIW5tY2xpRXJyb3IubWVzc2FnZS5pbmNsdWRlcygnTm8gb3V0cHV0JykpO1xuICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBubWNsaSBjb21tYW5kIGZhaWxlZDonLCBubWNsaUVycm9yLm1lc3NhZ2UgfHwgbm1jbGlFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGl3IChpd2NvbmZpZyBpcyBkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtRSBcIl5cXHMqc3NpZHxeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdsaW5rU3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUEgNSBcIl5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgU1NJRFxuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGl3U3Rkb3V0ID8gaXdTdGRvdXQubWF0Y2goL3NzaWRcXHMrKC4rKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gc3NpZE1hdGNoID8gc3NpZE1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCBhbmQgc2lnbmFsIGZyb20gbGluayBpbmZvXG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvYWRkcjpcXHMrKFthLWYwLTk6XXsxN30pL2kpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9zaWduYWw6XFxzKygtP1xcZCspLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbERibSA9IHNpZ25hbE1hdGNoID8gKHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1YWxpdHkgPSBzaWduYWxEYm0gIT09IG51bGwgPyBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbERibSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGl3RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IGl3IGNvbW1hbmQgZmFpbGVkOicsIGl3RXJyb3IubWVzc2FnZSB8fCBpd0Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gTGFzdCBmYWxsYmFjazogaXdjb25maWcgKGRlcHJlY2F0ZWQgYnV0IHdpZGVseSBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXdjb25maWcgMj4vZGV2L251bGwgfCBncmVwIC1FIFwiRVNTSUR8QWNjZXNzIFBvaW50fFNpZ25hbCBsZXZlbFwiJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9FU1NJRDpcIihbXlwiXSspXCIvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzc2lkTWF0Y2gpIHNzaWQgPSBzc2lkTWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9BY2Nlc3MgUG9pbnQ6XFxzKyhbYS1mMC05Ol17MTd9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSBic3NpZCA9IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9TaWduYWwgbGV2ZWw9KC0/XFxkKykvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaXdjb25maWdFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBhbGwgbWV0aG9kcyBmYWlsZWQgd2l0aCByZWFsIGVycm9ycyAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdjb25maWdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogQWxsIG1ldGhvZHMgKG5tY2xpLCBpdywgaXdjb25maWcpIGZhaWxlZC4gTGFzdCBlcnJvcjonLCBpd2NvbmZpZ0Vycm9yLm1lc3NhZ2UgfHwgaXdjb25maWdFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdlcnJvcidcbiAgICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgIG1lc3NhZ2U6ICdub2ludGVyZmFjZSdcbiAgICB9O1xufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBuZXRzaFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzaCB3bGFuIHNob3cgaW50ZXJmYWNlcycsIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIHN0ZGVyciBmb3Igc2VydmljZSBlcnJvcnNcbiAgICAgICAgY29uc3QgZXJyb3JPdXRwdXQgPSAoc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBvdXRwdXQgPSAoc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZE91dHB1dCA9IG91dHB1dCArICcgJyArIGVycm9yT3V0cHV0O1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgV0xBTiBzZXJ2aWNlIGlzIG5vdCBydW5uaW5nICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW5zdmMnKSB8fCBcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuIGF1dG9jb25maWcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2F1dG9tYXRpc2NoIHdsYW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4ta29uZmlndXJhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2lzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzZXJ2aWNlIGlzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkZXIgZGllbnN0JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlIGFyZSBubyBpbnRlcmZhY2VzIGF2YWlsYWJsZVxuICAgICAgICBpZiAoc3Rkb3V0LmluY2x1ZGVzKCdUaGVyZSBpcyBubyB3aXJlbGVzcyBpbnRlcmZhY2UnKSB8fCBcbiAgICAgICAgICAgIHN0ZG91dC5pbmNsdWRlcygnRXMgZ2lidCBrZWluZSBEcmFodGxvcy1TY2huaXR0c3RlbGxlJykgfHxcbiAgICAgICAgICAgIHN0ZG91dC5tYXRjaCgvTm8gd2lyZWxlc3MvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUsIGhhbmRsZXMgdmFyaW91cyBmb3JtYXRzXG4gICAgICAgICAgICAvLyBVc2UgbmVnYXRpdmUgbG9va2JlaGluZCB0byBlbnN1cmUgd2UgZG9uJ3QgbWF0Y2ggXCJCU1NJRFwiICh3aGljaCBjb250YWlucyBcIlNTSURcIilcbiAgICAgICAgICAgIGlmIChsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOlxccyooLispL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgc2V0IGlmIG5vdCBlbXB0eSBhbmQgbm90IFwiTi9BXCIgb3Igc2ltaWxhclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkICYmIGV4dHJhY3RlZC5sZW5ndGggPiAwICYmICFleHRyYWN0ZWQubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkID0gZXh0cmFjdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQlNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUgcGF0dGVybiBtYXRjaGluZ1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvQlNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiAoaGFuZGxlcyBib3RoIC0gYW5kIDogc2VwYXJhdG9ycywgd2l0aCBvciB3aXRob3V0IHNwYWNlcylcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEXFxzKjpcXHMqKFthLWYwLTldezJ9KD86Wy06XFxzXVthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbWF0Y2hbMV0ucmVwbGFjZSgvWy0gXS9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gU2lnbmFsIHBhcnNpbmcgLSBoYW5kbGUgdmFyaW91cyBsb2NhbGl6ZWQgZm9ybWF0cyBhbmQgcGF0dGVybnNcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL1NpZ25hbHxTaWduYWxzdFx1MDBFNHJrZXxJbnRlbnNpdFx1MDBFOXxTZVx1MDBGMWFsL2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHBlcmNlbnRhZ2UgcGF0dGVybiBmaXJzdCAobW9zdCBjb21tb24pXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooXFxkKylcXHMqJS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihwYXJzZWQpICYmIHBhcnNlZCA+PSAwICYmIHBhcnNlZCA8PSAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSBkQm0gcGF0dGVybiAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooLT9cXGQrKVxccypkQm0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGJtID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oZGJtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTm9ybWFsaXplIGVtcHR5IHN0cmluZ3MgdG8gbnVsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogKHNzaWQgJiYgc3NpZC5sZW5ndGggPiAwKSA/IHNzaWQgOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IChic3NpZCAmJiBic3NpZC5sZW5ndGggPiAwKSA/IGJzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyBkdWUgdG8gbG9jYXRpb24gcGVybWlzc2lvbnMgKG1pZ2h0IGJlIGluIHN0ZGVyciBvciBlcnJvciBtZXNzYWdlKVxuICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSAoZXJyb3IubWVzc2FnZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRvdXQgPSAoZXJyb3Iuc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZGVyciA9IChlcnJvci5zdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkRXJyb3JPdXRwdXQgPSBlcnJvck1lc3NhZ2UgKyAnICcgKyBlcnJvclN0ZG91dCArICcgJyArIGVycm9yU3RkZXJyO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTG9nIGVycm9yIHdoZW4gY29tbWFuZCBleGVjdXRpb24gZmFpbHMgKHRpbWVvdXQsIHBlcm1pc3Npb24sIGV0Yy4pXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzOiBFcnJvciBleGVjdXRpbmcgbmV0c2ggY29tbWFuZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGwgKGZhbGxiYWNrIHdoZW4gbmV0c2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIChkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24pXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgYWN0aXZlIFdpLUZpIGNvbm5lY3Rpb24gcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncG93ZXJzaGVsbCAtQ29tbWFuZCBcIiRwcm9maWxlID0gR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIHwgV2hlcmUtT2JqZWN0IHskXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2ktRmkqXFwnIC1vciAkXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2lyZWxlc3MqXFwnfSB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDE7IGlmICgkcHJvZmlsZSkgeyAkcHJvZmlsZS5OYW1lIH1cIicsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHNzaWRTdHIgPSBzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIGlmIChzc2lkU3RyICYmIHNzaWRTdHIubGVuZ3RoID4gMCAmJiAhc3NpZFN0ci5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZFN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEJTU0lEIGNhbm5vdCBiZSBlYXNpbHkgcmV0cmlldmVkIHdpdGhvdXQgbmV0c2ggKHdoaWNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICAgICAgICAvLyBTZXR0aW5nIHRvIG51bGwgYXMgZmFsbGJhY2sgLSBTU0lEIGlzIHRoZSBtb3N0IGltcG9ydGFudCBpbmZvcm1hdGlvbiBhbnl3YXlcbiAgICAgICAgY29uc3QgYnNzaWQgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIFBvd2VyU2hlbGwgZmFsbGJhY2sgKGNhbid0IGVhc2lseSBnZXQgc2lnbmFsIHN0cmVuZ3RoIHdpdGhvdXQgbmV0c2gpXG4gICAgICAgIC8vIFJldHVybiBub3Blcm1pc3Npb25zIG1lc3NhZ2Ugc28gZnJvbnRlbmQgY2FuIHNob3cgdGhlIHdhcm5pbmdcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdub3Blcm1pc3Npb25zJ1xuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyBlcnJvciBpZiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxzXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbDogUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsZWQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gbWFjT1MgdXNpbmcgYWlycG9ydCBvciBuZXR3b3Jrc2V0dXBcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9NYWNPUygpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgYWlycG9ydCBjb21tYW5kIGZpcnN0IChkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWlycG9ydCBpcyBhdmFpbGFibGUgKHVzdWFsbHkgYXQgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQpXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYWlycG9ydFBhdGggfSA9IGF3YWl0IGV4ZWNBc3luYygnd2hpY2ggYWlycG9ydCAyPi9kZXYvbnVsbCB8fCBlY2hvIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0Jywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDEwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgYWlycG9ydCA9IGFpcnBvcnRQYXRoLnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgJHthaXJwb3J0fSAtSWAsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcnNzaURibSA9IG51bGw7XG4gICAgICAgICAgICBsZXQgc2lnbmFsUGVyY2VudCA9IG51bGw7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ1NTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGxpbmUucmVwbGFjZSgnU1NJRDonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdCU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gdG8gZW5zdXJlIHdlIGdldCB0aGUgZnVsbCBCU1NJRFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQlNTSUQ6XFxzKihbYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdhZ3JDdGxSU1NJOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJTU0kgaW4gZEJtIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaVN0ciA9IGxpbmUucmVwbGFjZSgnYWdyQ3RsUlNTSTonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpID0gcnNzaVN0ciA/IChwYXJzZUludChyc3NpU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICByc3NpRGJtID0gcnNzaTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnbGluayBhdXRoOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFsdGVybmF0aXZlOiBzaWduYWwgc3RyZW5ndGggYXMgcGVyY2VudGFnZSAoaWYgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goLyhcXGQrKSUvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoICYmIHNpZ25hbFBlcmNlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxQZXJjZW50ID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBxdWFsaXR5ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChzaWduYWxQZXJjZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IHNpZ25hbFBlcmNlbnQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJzc2lEYm0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gZGJtVG9RdWFsaXR5UGVyY2VudChyc3NpRGJtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHNzaWQgfHwgYnNzaWQgfHwgcXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChhaXJwb3J0RXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIG5ldHdvcmtzZXR1cCAtIG9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChub3QganVzdCBubyBwZXJtaXNzaW9uKVxuICAgICAgICAgICAgaWYgKGFpcnBvcnRFcnJvci5jb2RlICE9PSAnRU5PRU5UJyAmJiBhaXJwb3J0RXJyb3IubWVzc2FnZSAmJiAhYWlycG9ydEVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ3Blcm1pc3Npb24nKSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogYWlycG9ydCBjb21tYW5kIGZhaWxlZDonLCBhaXJwb3J0RXJyb3IubWVzc2FnZSB8fCBhaXJwb3J0RXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjazogbmV0d29ya3NldHVwIGFuZCBpcGNvbmZpZyAoZm9yIG5ld2VyIG1hY09TIHdoZXJlIGFpcnBvcnQgaXMgbm90IGF2YWlsYWJsZSkgIC8vIHN5c3RlbV9wcm9maWxlciBpcyB3YXkgdG8gaGVhdnkgYW5kIG5lZWRzIGEgbG9vb29vdCBvZiB0aW1lIHRvIHByb2Nlc3NcbiAgICAgICAgLy8gdGhpcyBpcyBhIHNpbXBsZSBjYWxjdWxhdGlvbi4uIHdlIGNhbid0IHJlbHkgb24gYSBwcm9jZXNzIHRoYXQgdGFrZXMgMTBzIHRvIGNvbXBsZXRlIGFuZCBibG9ja3MgdGhlIHdob2xlIHN5c3RlbVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIFdMQU4gaW50ZXJmYWNlIHVzaW5nIG5ldHdvcmtzZXR1cFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGludGVyZmFjZU91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXR3b3Jrc2V0dXAgLWxpc3RhbGxoYXJkd2FyZXBvcnRzIHwgYXdrIFxcJy9XaS1GaXxBaXJQb3J0L3tnZXRsaW5lOyBwcmludCAkTkZ9XFwnJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IGludGVyZmFjZU91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghaW50ZXJmYWNlTmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIE5vIFdpLUZpIGludGVyZmFjZSBmb3VuZFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGF3ayAtRicgU1NJRCA6ICcgJy8gU1NJRCA6IC8ge3ByaW50ICQyfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRPdXRwdXQudHJpbSgpIHx8IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkLCBjb250aW51ZSB3aXRoIEJTU0lEXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBCU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYnNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGdyZXAgJ0JTU0lEIDonIHwgYXdrICd7cHJpbnQgJDN9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZFN0ciA9IGJzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBCU1NJRCBmb3JtYXQgKE1BQyBhZGRyZXNzKVxuICAgICAgICAgICAgICAgIGlmIChic3NpZFN0ciAmJiAvXlthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSQvaS50ZXN0KGJzc2lkU3RyKSkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkU3RyLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoYnNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEJTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBmYWxsYmFjayAoYWlycG9ydCBub3QgYXZhaWxhYmxlLCBjYW4ndCBnZXQgc2lnbmFsIHN0cmVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChuZXR3b3Jrc2V0dXBFcnJvcikge1xuICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIG5ldHdvcmtzZXR1cCBmYWlscyB3aXRoIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBuZXR3b3Jrc2V0dXAvaXBjb25maWcgZmFsbGJhY2sgZmFpbGVkOicsIG5ldHdvcmtzZXR1cEVycm9yLm1lc3NhZ2UgfHwgbmV0d29ya3NldHVwRXJyb3IpO1xuICAgICAgICAgICAgLy8gSWYgZmFsbGJhY2sgY29tcGxldGVseSBmYWlscywgcmV0dXJuIGVycm9yIG9iamVjdFxuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2V0V2xhbkluZm8gfTtcblxuXG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDUzLCAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ3Rhc2tsaXN0IC9mbyBjc3YnIChzdHJ1Y3R1cmVkIGZvcm1hdCwgZmFzdGVyIHRoYW4gL3YsIHN0aWxsIHNob3dzIHByb2Nlc3MgbmFtZXMpXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygndGFza2xpc3QgL2ZvIGNzdicsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAnbmV0c3RhdCAtYW5vJyAoc2hvd3MgYWxsIGNvbm5lY3Rpb24gc3RhdGVzIGluY2x1ZGluZyBFU1RBQkxJU0hFRCBmb3Igc2NyZWVuc2hhcmluZyBkZXRlY3Rpb24pXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c3RhdCAtYW5vJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIFJlZ2V4IHRvIGZpbmQgOlBPUlQgZm9sbG93ZWQgYnkgYSBzcGFjZSAoZW5zdXJlcyBleGFjdCBwb3J0IG1hdGNoLCBlLmcuLCA6NTkzOCApXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fVxcXFxzYCwgJ2cnKSBcbiAgICAgIGlmIChyZWdleC50ZXN0KHN0ZG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59IiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywnY29tLm1pY3Jvc29mdC50ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgNTMsIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufSIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNScsXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgNTMsIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNixcbl1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufSIsICJpbXBvcnQgKiBhcyB3aW4gZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVXaW4uanMnXG5pbXBvcnQgKiBhcyBtYWMgZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVNYWMuanMnXG5pbXBvcnQgKiBhcyBsaW51eCBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKHBsYXRmb3JtID0gJ3dpbjMyJykge1xuICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHJldHVybiBhd2FpdCB3aW4ucnVuUmVtb3RlQ2hlY2soKVxuICBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKSByZXR1cm4gYXdhaXQgbWFjLnJ1blJlbW90ZUNoZWNrKClcbiAgcmV0dXJuIGF3YWl0IGxpbnV4LnJ1blJlbW90ZUNoZWNrKClcbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIEV4cGFuZGVkIGJyb3dzZXIga2V5d29yZHMgdG8gY2F0Y2ggbW9yZSB2YXJpYW50c1xuY29uc3QgYnJvd3NlcktleXdvcmRzID0gW1xuICAgICdjaHJvbScsICdjaHJvbWUuZXhlJyxcbiAgICAnZWRnZScsICdtc2VkZ2UuZXhlJyxcbiAgICAnZmlyZScsICdmaXJlZm94LmV4ZScsXG4gICAgJ2JyYXZlJywgJ2JyYXZlLmV4ZScsXG4gICAgJ29wZXJhJywgJ29wZXJhLmV4ZScsXG4gICAgJ2Jyb3dzZXInLCAvLyBHZW5lcmljIGJyb3dzZXIgcHJvY2Vzc1xuICAgICdpZXhwbG9yZScsIC8vIEludGVybmV0IEV4cGxvcmVyXG4gICAgJ3NhZmFyaScsIC8vIEZvciBtYWNPU1xuXTtcblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsLmV4ZSAtTm9Mb2dvIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCImIHsgJHByb2MgPSBHZXQtQ2ltSW5zdGFuY2UgLUNsYXNzIFdpbjMyX1Byb2Nlc3MgLUZpbHRlciAnUHJvY2Vzc0lkPSR7cGlkfSc7IGlmICgkcHJvYykgeyAkcHJvYy5QYXJlbnRQcm9jZXNzSWQ7ICRwcm9jLk5hbWUgfSB9XCJgO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lKTtcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQobGluZXNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IGxpbmVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvV2luZG93czogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gVW5peCBzeXN0ZW1zIChMaW51eC9tYWNPUylcbiAqIFRyaWVzIC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0KSwgZmFsbHMgYmFjayB0byBwcyBjb21tYW5kXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvVW5peChwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QgbWV0aG9kIH40bXMsIG5vIHByb2Nlc3Mgc3Bhd24pXG4gICAgICAgIGNvbnN0IFtzdGF0Q29udGVudCwgY29tbUNvbnRlbnRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9zdGF0YCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKSxcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vY29tbWAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbClcbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhdENvbnRlbnQpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIC9wcm9jL3BpZC9zdGF0OiBwaWQgKGNvbW0pIHN0YXRlIHBwaWQgLi4uXG4gICAgICAgICAgICBjb25zdCBzdGF0TWF0Y2ggPSBzdGF0Q29udGVudC5tYXRjaCgvXlxcZCtcXHMrXFwoKFteKV0rKVxcKVxccytcXFMrXFxzKyhcXGQrKS8pO1xuICAgICAgICAgICAgaWYgKHN0YXRNYXRjaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSAoY29tbUNvbnRlbnQgfHwgc3RhdE1hdGNoWzFdKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQoc3RhdE1hdGNoWzJdLCAxMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBwcyBjb21tYW5kICh3b3JrcyBvbiBib3RoIExpbnV4IGFuZCBtYWNPUylcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwcyAtcCAke3BpZH0gLW8gcHBpZD0sY29tbT1gO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHN0ZG91dC50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1VuaXg6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIGJhc2VkIG9uIHBsYXRmb3JtXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvKHBpZCkge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICBcbiAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpO1xuICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcgfHwgcGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKTsgLy8gTGludXgvbWFjT1M6IHRyaWVzIC9wcm9jLCBmYWxscyBiYWNrIHRvIHBzXG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHBhcmVudCBwcm9jZXNzZXMgZm9yIGJyb3dzZXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmluZFBhcmVudFByb2Nlc3MocGlkLCBtYXhEZXB0aCwgdmlzaXRlZFBpZHMpIHtcbiAgICBpZiAocGlkID09PSAxIHx8IHBpZCA9PT0gMCkge1xuICAgICAgICBsb2cuaW5mbygnY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUm9vdCBQSUQgcmVhY2hlZC4gTm8gd2ViIGJyb3dzZXIgZm91bmQuJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKG1heERlcHRoIDw9IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIHdoZW4gbWF4IGRlcHRoIHJlYWNoZWRcbiAgICB9XG4gICAgXG4gICAgaWYgKHZpc2l0ZWRQaWRzLmhhcyhwaWQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlc1xuICAgIH1cbiAgICBcbiAgICB2aXNpdGVkUGlkcy5hZGQocGlkKTtcbiAgICBcbiAgICAvLyBHZXQgcHJvY2VzcyBpbmZvIChnZXRQcm9jZXNzSW5mbyBhbHJlYWR5IGhhcyBpdHMgb3duIHRpbWVvdXQgcHJvdGVjdGlvbilcbiAgICBjb25zdCBwcm9jZXNzSW5mbyA9IGF3YWl0IGdldFByb2Nlc3NJbmZvKHBpZCk7XG4gICAgXG4gICAgaWYgKCFwcm9jZXNzSW5mbykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHsgcHBpZCwgbmFtZSB9ID0gcHJvY2Vzc0luZm87XG4gICAgXG4gICAgLy8gTG9nIHRoZSBwcm9jZXNzIGluZm8gZm9yIGRlYnVnZ2luZ1xuICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBDaGVja2luZyBwcm9jZXNzOiAke25hbWV9IChQSUQ6ICR7cGlkfSwgUFBJRDogJHtwcGlkfSlgKTtcbiAgICBcbiAgICAvLyBNb3JlIHRob3JvdWdoIGJyb3dzZXIgZGV0ZWN0aW9uXG4gICAgaWYgKGJyb3dzZXJLZXl3b3Jkcy5zb21lKGJyb3dzZXIgPT4gbmFtZS5pbmNsdWRlcyhicm93c2VyKSkpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IEJyb3dzZXIgZm91bmQ6ICR7bmFtZX1gKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmIChuYW1lLmluY2x1ZGVzKCdleHBsb3JlcicpIHx8IHBwaWQgPD0gMSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUmVhY2hlZCBzeXN0ZW0gcHJvY2VzcyBvciBleHBsb3JlcmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHBwaWQsIG1heERlcHRoIC0gMSwgdmlzaXRlZFBpZHMpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBwYXJlbnQgcHJvY2VzcyBpcyBhIGJyb3dzZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrUGFyZW50UHJvY2VzcygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmb3VuZEJyb3dzZXIgPSBhd2FpdCBmaW5kUGFyZW50UHJvY2Vzcyhwcm9jZXNzLnBwaWQsIDYsIG5ldyBTZXQoKSk7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogQnJvd3NlciBkZXRlY3Rpb24gcmVzdWx0OiAke2ZvdW5kQnJvd3Nlcn1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZm91bmRCcm93c2VyIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogRXJyb3IgaW4gYnJvd3NlciBkZXRlY3Rpb246ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGZvdW5kQnJvd3NlcjogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgfVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQXVCQSxTQUFTLFlBQUFBLGlCQUFnQjtBQUN6QixTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXO0FBQ3BCLE9BQU8sU0FBUzs7O0FDckJoQixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQTtBQUFBLEVBQ2IsY0FBYztBQUFBLEVBQ2QsZUFBZTtBQUFBLEVBQ2YsZ0JBQWdCO0FBQUEsRUFDaEIsU0FBUztBQUFBLEVBRVQsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBLEVBRWpCLGVBQWU7QUFBQTtBQUFBLEVBQ2YscUJBQXFCO0FBQUE7QUFBQSxFQUVyQixxQkFBcUI7QUFBQSxFQUNyQixRQUFRO0FBQUE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULFVBQVU7QUFBQSxFQUNWLGFBQWE7QUFBQSxFQUNiLFNBQVM7QUFBQSxFQUVULFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLE1BQU07QUFDVjtBQUNBLElBQU8saUJBQVE7OztBRExmLFNBQVMscUJBQXFCO0FBQzlCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUNqQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxPQUFPLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM5QyxJQUFNLFlBQVksWUFBWTtBQUk5QixJQUFNLHFCQUFOLE1BQXlCO0FBQUEsRUFDdkIsY0FBYztBQUVaLFNBQUssWUFBWSxRQUFRO0FBQ3pCLFNBQUssUUFBUSxRQUFRO0FBQ3JCLFNBQUssT0FBTyxRQUFRO0FBR3BCLFNBQUssV0FBVyxDQUFDO0FBQ2pCLFNBQUssT0FBTyxLQUFLLGVBQWU7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QUdBLEVBQUFHLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxNQUFNLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEMsRUFBQUEsZ0JBQWUsU0FBUyw0QkFBNEIsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUM1RCxFQUFBQSxnQkFBZSxTQUFTLFVBQVUsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUMxQyxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxZQUFZLE1BQU07QUFBRyxXQUFPO0FBQUEsRUFBTSxDQUFDO0FBQy9ELENBQUM7IiwKICAibmFtZXMiOiBbImV4ZWNTeW5jIiwgImV4ZWNTeW5jIiwgImxvZyIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJnbG9iYWxTaG9ydGN1dCIsICJUcmF5IiwgIk1lbnUiLCAiZGlhbG9nIiwgImxvZyIsICJsb2ciLCAicGF0aCIsICJmcyIsICJpcCIsICJnYXRld2F5NHN5bmMiLCAiYXBwIiwgInBhdGgiLCAiam9pbiIsICJqb2luIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgImxvZyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAicGF0aCIsICJsb2ciLCAiYXBwIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJsb2ciLCAicHJvY2VzcyIsICJmcyIsICJwYXRoIiwgIm9zIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJqb2luIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJmcyIsICJqb2luIiwgInNjcmVlbiIsICJpcGNNYWluIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIndlYkNvbnRlbnRzIiwgInBhdGgiLCAiZnMiLCAiY2xpcGJvYXJkIiwgImFwcCIsICJvcyIsICJsb2ciLCAiYXBwIiwgInBhdGgiLCAibG9nIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgInQiLCAibG9nIiwgImFwcCIsICJleGVjIiwgImRpYWxvZyIsICJhcHAiLCAibG9nIiwgImV4ZWMiLCAib3MiLCAibG9nIiwgImlzUmVhbEVycm9yIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgImNsaXBib2FyZCIsICJwYXRoIiwgImZzIiwgImVyciIsICJ3ZWJDb250ZW50cyIsICJvcyIsICJhcHAiLCAibG9nIiwgInBhdGgiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJydW5SZW1vdGVDaGVjayIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJydW5SZW1vdGVDaGVjayIsICJhcHAiLCAicGF0aCIsICJhZ2VudCIsICJmcyIsICJqb2luIiwgImlwY01haW4iLCAid2ViQ29udGVudHMiLCAic2NyZWVuIiwgImVyciIsICJleGVjIiwgInByb21pc2lmeSIsICJsb2ciLCAiZXhlY0FzeW5jIiwgIm5hbWUiLCAicHBpZCIsICJhcHAiLCAibG9nIiwgIk1lbnUiLCAiX19kaXJuYW1lIiwgImZzIiwgInBhdGgiLCAiZ2F0ZXdheTRzeW5jIiwgImlwIiwgIndlYkNvbnRlbnRzIiwgIkJyb3dzZXJXaW5kb3ciLCAiZXZlbnQiLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
