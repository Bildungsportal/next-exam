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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMudHMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvZW4uanNvbiIsICIuLi8uLi9zcmMvbG9jYWxlcy9kZS5qc29uIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLl9wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcbiAgICBcbiAgXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmZsYW1lc2hvdCA9IHRoaXMuX2dldFZlcnNpb24oJ2ZsYW1lc2hvdCcpO1xuICAgIHRoaXMuaW1hZ2VtYWdpY2sgPSB0aGlzLl9nZXRWZXJzaW9uKCdjb252ZXJ0Jyk7XG4gICAgdGhpcy5pbVZlcnNpb24gPSB0aGlzLl9nZXRJbWFnZU1hZ2lja1ZlcnNpb24oKTtcbiAgICB0aGlzLndvcmtlckZpbGVOYW1lID0gdGhpcy5fZ2V0V29ya2VyRmlsZU5hbWUoKTtcbiAgICB0aGlzLnVzZVdvcmtlciA9IHRoaXMuX2dldFVzZVdvcmtlcigpO1xuICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSB0aGlzLl9nZXRTY3JlZW5zaG90QWJpbGl0eSgpO1xuICAgIHRoaXMuanJlID0gdGhpcy5fZGV0ZWN0SlJFSWQoKTtcbiAgICB0aGlzLmpyZURpciA9IHRoaXMuX3Jlc29sdmVKUkVEaXIoKTtcbiAgICB0aGlzLmphdmFCaW4gPSB0aGlzLl9yZXNvbHZlSmF2YUJpbigpO1xuICAgIHRoaXMuanJlSW5mbyA9IHRoaXMuX2dldEpSRSgpO1xuICAgIFxuICAgIHRoaXMuaG9tZWRpcmVjdG9yeSA9IG9zLmhvbWVkaXIoKTtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgICB0aGlzLndvcmtlclVSTCA9IHRoaXMuX2dldFdvcmtlclVSTCgpO1xuICAgIHRoaXMudGVtcGRpcmVjdG9yeSA9IHRoaXMuX2dldFRlbXBkaXJlY3RvcnkoKTtcbiAgICB0aGlzLndvcmtkaXJlY3RvcnkgPSB0aGlzLl9nZXRXb3JrZGlyZWN0b3J5KCk7XG4gICAgdGhpcy5sb2dmaWxlID0gdGhpcy5fZ2V0TG9nZmlsZSgpO1xuXG4gIH1cblxuICBfZ2V0V29ya2RpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLmhvbWVkaXJlY3RvcnksIGNvbmZpZy5jbGllbnRkaXJlY3RvcnkpO1xuICB9XG5cbiAgX2dldFRlbXBkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4ob3MudG1wZGlyKCksICdleGFtLXRtcCcpO1xuICB9XG5cblxuICBfZ2V0TG9nZmlsZSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLndvcmtkaXJlY3RvcnksICduZXh0LWV4YW0tc3R1ZGVudC5sb2cnKTtcbiAgfVxuXG4gIF9ub3JtYWxpemVBcmNoKCkge1xuICAgIGlmICh0aGlzLl9hcmNoID09PSAnaWEzMicpIHJldHVybiAnaTU4Nic7XG4gICAgaWYgKFsneDY0JywgJ2FybTY0J10uaW5jbHVkZXModGhpcy5fYXJjaCkpIHJldHVybiB0aGlzLl9hcmNoO1xuICAgIHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZTogJHt0aGlzLl9hcmNofWApO1xuICB9XG5cbiAgX2RldGVjdEpSRUlkKCkge1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hcmNoID09PSAnYXJtNjQnID8gJ21pbmltYWwtanJlLTExLW1hYy1hcm02NCcgOiAnbWluaW1hbC1qcmUtMTEtbWFjJztcbiAgICB9XG4gIH1cblxuXG5cblxuXG4gIC8qKlxuICAgKiBcbiAgICogQHJldHVybnMge3N0cmluZ30gdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogQGRlc2NyaXB0aW9uIHRoaXMgZnVuY3Rpb24gcmVzb2x2ZXMgdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogaXQgZmlyc3QgY2hlY2tzIGlmIHRoZSB1c2VCdW5kbGVkSlJFIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHNldCB0byB0cnVlXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCBjaGVja3MgaWYgdGhlIHN5c3RlbSBqcmUgaXMgaW5zdGFsbGVkXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBzeXN0ZW0ganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiB0aGUgYnVuZGxlZCBqcmUgaXMgbG9jYXRlZCBpbiB0aGUgcHVibGljIGRpcmVjdG9yeSBvZiB0aGUgYXBwXG4gICAqIFxuICAgKiBGSVhNRTogaWYgc3lzdGVtIGpyZSBpcyBzZWxlY3RlZCBieSBFTlYgZG8gbm90IGluY2x1ZGUgdGhlIGpyZSBkaXJlY3RvcnkgaW4gdGhlIGZpbmFsIGJ1aWxkXG4gICAqL1xuXG4gIF9yZXNvbHZlSlJFRGlyKCkge1xuICAgIC8vIHVzZSBidW5kbGVkIGpyZSBiZWNhdXNlIGl0cyBzbWFsbGVyIGFuZCBwcm92aWRlcyBvbmx5IHRoZSBuZWVkZWQgamF2YSBtb2R1bGVzXG4gICAgaWYgKHByb2Nlc3MuZW52LnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogIWFwcC5pc1BhY2thZ2VkOiBcIiArIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInID8gJ3doZXJlIGphdmEnIDogJ3doaWNoIGphdmEnO1xuICAgICAgICBjb25zdCBqYXZhUGF0aCA9IGV4ZWNTeW5jKGphdmFDb21tYW5kLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuXG4gICAgICAgIGlmIChqYXZhUGF0aCkge1xuICAgICAgICAgIC8vIEdldCB0aGUgZGlyZWN0b3J5IGNvbnRhaW5pbmcgdGhlIGphdmEgZXhlY3V0YWJsZVxuICAgICAgICAgIGNvbnN0IGphdmFEaXIgPSBwYXRoLmRpcm5hbWUoamF2YVBhdGgpO1xuICAgICAgICAgIC8vIEdvIHVwIHRvIHRoZSBKUkUvSkRLIHJvb3QgKHVzdWFsbHkgMiBsZXZlbHMgdXAgZnJvbSBiaW4vKVxuICAgICAgICAgIGNvbnN0IGpyZVJvb3QgPSBwYXRoLmRpcm5hbWUocGF0aC5kaXJuYW1lKGphdmFEaXIpKTtcbiAgICAgICAgICByZXR1cm4ganJlUm9vdDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIEphdmEgbm90IGZvdW5kIGluIFBBVEhcbiAgICAgIH1cblxuICAgICAgLy8gSWYgbm8gSmF2YSBmb3VuZCwgZmFsbCBiYWNrIHRvIGJ1bmRsZWQgSlJFXG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBObyBzeXN0ZW0gSmF2YSBmb3VuZCwgZmFsbGluZyBiYWNrIHRvIGJ1bmRsZWQgSlJFXCIpO1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfcmVzb2x2ZUphdmFCaW4oKSB7XG4gICAgc3dpdGNoICh0aGlzLl9wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5fcGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtICE9PSAnbGludXgnKSByZXR1cm4gJ24vYSc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCcpIHJldHVybiAnd2F5bGFuZCc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAneDExJyB8fCB0aGlzLl9lbnYuRElTUExBWSkgcmV0dXJuICd4MTEnO1xuICAgIHJldHVybiAndW5rbm93bic7XG4gIH1cblxuICBfZ2V0VmVyc2lvbihjbWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoYCR7Y21kfSAtLXZlcnNpb25gLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkuc3BsaXQoJ1xcbicpWzBdO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvW1xcZF0rKFxcLltcXGRdKykrLyk7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbjogdmVyc2lvbj8uWzBdIHx8ICd1bmtub3duJyB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldEpSRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoJ2phdmEgLXZlcnNpb24nLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ2lnbm9yZScsICdwaXBlJ10gfSk7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC92ZXJzaW9uIFwiKFtcXGQuX10rKVwiLyk/LlsxXSB8fCAndW5rbm93bic7XG4gICAgICBjb25zdCBqYXZhSG9tZSA9IHRoaXMuX2Vudi5KQVZBX0hPTUUgfHwgJyc7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbiwgcGF0aDogamF2YUhvbWUgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCwgcGF0aDogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRXb3JrZXJGaWxlTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG5cbiAgICByZXR1cm4gcGF0aFRvRmlsZVVSTCh3b3JrZXJQYXRoKTtcbiAgfVxuXG4gIGlzV2F5bGFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJztcbiAgfVxuXG4gIF9pc0tERSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICByZXR1cm4gb3V0ID09PSAnS0RFJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0tERTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNHTk9NRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ2dub21lJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNHTk9NRTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNVTklUWSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ3VuaXR5Jyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc1VOSVRZOiBubyBkYXRhXCIsIGVycik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZsYW1lc2hvdEF2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJ3aGljaCBmbGFtZXNob3RcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9mbGFtZXNob3RBdmFpbGFibGU6IEZsYW1lc2hvdCBub3QgZm91bmRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX3NldHVwRGVza3RvcFBhdGgoKSB7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gIH1cblxuICBfZ2V0RGVza3RvcFBhdGgoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBpZiAoKHRoaXMuX2lzR05PTUUoKSB8fCB0aGlzLl9pc1VOSVRZKCkpICYmIHRoaXMuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBHTk9NRS9Vbml0eSArIFdheWxhbmQgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc0tERSgpICYmIHRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy5fZmxhbWVzaG90QXZhaWxhYmxlKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBLREUvV2F5bGFuZCArIEZsYW1lc2hvdCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLnVzZVdvcmtlcikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFgxMSArIEltYWdlTWFnaWNrIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZSBcdTIwMTMgZmFsbGJhY2sgdG8gcGFnZWNhcHR1cmVcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IHBsYXRmb3JtRGlzcGF0Y2hlciA9IG5ldyBQbGF0Zm9ybURpc3BhdGNoZXIoKTtcbmV4cG9ydCBkZWZhdWx0IHBsYXRmb3JtRGlzcGF0Y2hlcjtcbiIsICJcbi8qKlxuICogRE8gTk9UIEVESVQgLSB0aGlzIGZpbGUgaXMgd3JpdHRlbiBieSBwcmVidWlsZC5qcyB2aWEgZWxlY3Ryb24tYnVpbGRlci5lbnYgLSBlZGl0IHZhcnMgaW4gZWxlY3Ryb24tYnVpbGRlci5lbnYgZmlsZSFcbiAqL1xuXG5jb25zdCBjb25maWcgPSB7XG4gICAgZGV2ZWxvcG1lbnQ6IHRydWUsICAvLyBkaXNhYmxlIGtpb3NrIG1vZGUgb24gZXhhbSBtb2RlIGFuZCBvdGhlciBzdHVmZiAoYXV0b2ZpbGwgaW5wdXQgZmllbGRzKVxuICAgIHNob3dkZXZ0b29sczogdHJ1ZSxcbiAgICB1c2VCdW5kbGVkSlJFOiB0cnVlLFxuICAgIGJpcEludGVncmF0aW9uOiBmYWxzZSxcbiAgICBiaXBEZW1vOiBmYWxzZSxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIGVsZWN0cm9uOiBmYWxzZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzEuMS4wLjE4JyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDExOScsXG4gICAgYnVpbGROdW1iZXI6ICcxOCcsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgcG93ZXJTYXZlQmxvY2tlciwgbmF0aXZlVGhlbWUsIGdsb2JhbFNob3J0Y3V0LCBUcmF5LCBNZW51LCBkaWFsb2csIHNlc3Npb259IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCAqIGFzIGZzRXh0cmEgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3RyYXltZW51LmpzJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tQYXJlbnRQcm9jZXNzIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMnO1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuY29uZmlnLmVsZWN0cm9uID0gdHJ1ZVxuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG5wcm9jZXNzLm9uKCd1bmNhdWdodEV4Y2VwdGlvbicsIChlcnIpID0+IHtcbiAgICBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHtcbiAgICAgICAgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlO1xuICAgICAgICBsb2cud2FybignbWFpbiBAIHVuY2F1Z2h0RXhjZXB0aW9uOiBFUElQRSBFcnJvcjogVGhlIHN0ZG91dCBzdHJlYW0gb2YgdGhlIEVsZWN0cm9uTG9nZ2VyIHdpbGwgYmUgZGlzYWJsZWQuJyk7XG4gICAgfSBcbiAgICBlbHNlIGlmIChlcnIubWVzc2FnZT8uaW5jbHVkZXMoJ1JlbmRlciBmcmFtZSB3YXMgZGlzcG9zZWQnKSkgcmV0dXJuO1xuICAgIGVsc2UgeyAgbG9nLmVycm9yKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246JywgZXJyLm1lc3NhZ2UpOyB9ICAvLyBMb2cgb3IgZGlzcGxheSBvdGhlciBlcnJvcnNcbn0pO1xuXG4vLyBIYW5kbGUgdW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9ucyB0byBwcmV2ZW50IGNyYXNoZXNcbnByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIChyZWFzb24sIHByb21pc2UpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCB1bmhhbmRsZWRSZWplY3Rpb246IFVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbjonLCByZWFzb24pO1xuICAgIGlmIChyZWFzb24gaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB1bmhhbmRsZWRSZWplY3Rpb246IFN0YWNrOicsIHJlYXNvbi5zdGFjayk7XG4gICAgfVxufSk7XG5cbi8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgKFY4IGZhdGFsIGVycm9ycywgZXRjLilcbmFwcC5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChldmVudCwgd2ViQ29udGVudHMsIGRldGFpbHMpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBSZW5kZXJlciBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICBcbiAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IGNyYXNoZWRcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgY29uc3QgY3Jhc2hlZFdpbmRvdyA9IGFsbFdpbmRvd3MuZmluZCh3aW4gPT4gd2luLndlYkNvbnRlbnRzLmlkID09PSB3ZWJDb250ZW50cy5pZCk7XG4gICAgXG4gICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IHRpdGxlOiAke2NyYXNoZWRXaW5kb3cuZ2V0VGl0bGUoKX1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdyA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4YW0gd2luZG93IGNyYXNoZWQsIGF0dGVtcHRpbmcgdG8gY2xvc2UgZ3JhY2VmdWxseScpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoIWNyYXNoZWRXaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBjcmFzaGVkV2luZG93LmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW1EaXNwbGF5SWQgPSBudWxsO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXJyb3IgY2xvc2luZyBleGFtIHdpbmRvdzonLCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xufSk7XG5cbi8vIEhhbmRsZSBjaGlsZCBwcm9jZXNzIGNyYXNoZXMgKHdvcmtlcnMsIGV0Yy4pXG5hcHAub24oJ2NoaWxkLXByb2Nlc3MtZ29uZScsIChldmVudCwgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogQ2hpbGQgcHJvY2VzcyBjcmFzaGVkJyk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBUeXBlOicsIGRldGFpbHMudHlwZSk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3NcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xufSk7XG5cbi8vIFNldCBhcHBsaWNhdGlvbiBuYW1lIGZvciBXaW5kb3dzIDEwKyBub3RpZmljYXRpb25zXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyAgYXBwLnNldEFwcFVzZXJNb2RlbElkKGFwcC5nZXROYW1lKCkpfVxuLy9pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyAgYXBwLmRvY2suaGlkZSgpIH0gIC8vIHRoaXMgYnVnIHN0YXRlcyB0aGF0IGl0IGtpbmRhIG1lc3NlcyB1cCBraW9zayBtb2RlIC0gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy8xODIwN1xuXG5cblxuLy8gaGlkZSBjZXJ0aWZpY2F0ZSB3YXJuaW5ncyBpbiBjb25zb2xlLi4gd2Uga25vdyB3ZSB1c2UgYSBzZWxmIHNpZ25lZCBjZXJ0IGFuZCBkbyBub3QgdmFsaWRhdGUgaXRcbnByb2Nlc3MuZW52W1wiTk9ERV9UTFNfUkVKRUNUX1VOQVVUSE9SSVpFRFwiXSA9IFwiMFwiO1xucHJvY2Vzcy5lbnYuTk9ERV9UTFNfUkVKRUNUX1VOQVVUSE9SSVpFRCA9IFwiMFwiO1xuY29uc3Qgb3JpZ2luYWxFbWl0V2FybmluZyA9IHByb2Nlc3MuZW1pdFdhcm5pbmdcbnByb2Nlc3MuZW1pdFdhcm5pbmcgPSAod2FybmluZywgb3B0aW9ucykgPT4ge1xuICAgIGlmICh3YXJuaW5nICYmIHdhcm5pbmcuaW5jbHVkZXMgJiYgd2FybmluZy5pbmNsdWRlcygnTk9ERV9UTFNfUkVKRUNUX1VOQVVUSE9SSVpFRCcpKSB7ICByZXR1cm4gfVxuICAgIHJldHVybiBvcmlnaW5hbEVtaXRXYXJuaW5nLmNhbGwocHJvY2Vzcywgd2FybmluZywgb3B0aW9ucylcbn1cblxuYXBwLm9uKCdjZXJ0aWZpY2F0ZS1lcnJvcicsIChldmVudCwgd2ViQ29udGVudHMsIHVybCwgZXJyb3IsIGNlcnRpZmljYXRlLCBjYWxsYmFjaykgPT4geyAvLyBTU0wvVExTOiB0aGlzIGlzIHRoZSBzZWxmIHNpZ25lZCBjZXJ0aWZpY2F0ZSBzdXBwb3J0XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gT24gY2VydGlmaWNhdGUgZXJyb3Igd2UgZGlzYWJsZSBkZWZhdWx0IGJlaGF2aW91ciAoc3RvcCBsb2FkaW5nIHRoZSBwYWdlKVxuICAgIGNhbGxiYWNrKHRydWUpOyAgLy8gYW5kIHdlIHRoZW4gc2F5IFwiaXQgaXMgYWxsIGZpbmUgLSB0cnVlXCIgdG8gdGhlIGNhbGxiYWNrXG59KTtcblxuLy8gSGFuZGxlIFdlYkNvbnRlbnRzIGxvYWQgZmFpbHVyZXMgdG8gcHJldmVudCBhcHAgY3Jhc2hlc1xuYXBwLm9uKCd3ZWItY29udGVudHMtY3JlYXRlZCcsIChldmVudCwgd2ViQ29udGVudHMpID0+IHtcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgLy8gTG9nIHRoZSBlcnJvciBidXQgZG9uJ3QgY3Jhc2ggdGhlIGFwcFxuICAgICAgICBsb2cud2FybihgbWFpbiBAIGRpZC1mYWlsLWxvYWQ6IEVycm9yICR7ZXJyb3JDb2RlfSAtICR7ZXJyb3JEZXNjcmlwdGlvbn0gZm9yIFVSTDogJHt2YWxpZGF0ZWRVUkx9YCk7XG5cbiAgICB9KTtcbiAgICBcbiAgICAvLyBIYW5kbGUgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVzIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuICAgIHdlYkNvbnRlbnRzLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCBmb3Igc3BlY2lmaWMgd2ViQ29udGVudHMnKTtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgICAgICBcbiAgICAgICAgLy8gVHJ5IHRvIGlkZW50aWZ5IHdoaWNoIHdpbmRvdyB0aGlzIHdlYkNvbnRlbnRzIGJlbG9uZ3MgdG9cbiAgICAgICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgICAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93KSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IFVSTDogJHtjcmFzaGVkV2luZG93LndlYkNvbnRlbnRzLmdldFVSTCgpfWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGb3IgZXhhbSB3aW5kb3cgY3Jhc2hlcywgdHJ5IHRvIGNsb3NlIGl0IGdyYWNlZnVsbHlcbiAgICAgICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4YW0gd2luZG93IGNyYXNoZWQsIGF0dGVtcHRpbmcgdG8gY2xvc2UgZ3JhY2VmdWxseScpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjcmFzaGVkV2luZG93LmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW1EaXNwbGF5SWQgPSBudWxsO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzIC0gbGV0IGl0IGNvbnRpbnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSk7XG59KTtcblxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICBjbGVhckludGVydmFsKCBDb21tSGFuZGxlci51cGRhdGVTdHVkZW50SW50ZXJ2YWxsIClcbiAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cgPSBudWxsXG4gICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nKXsgYXBwLnF1aXQoKSB9XG4gICAgYXBwLnF1aXQoKSAgIFxufSlcblxuYXBwLm9uKCdiZWZvcmUtcXVpdCcsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLmNsZWFyU3RvcmFnZURhdGEoe30pOyAvLyBjbGVhciBjb29raWVzLCBjYWNoZSwgbG9jYWxTdG9yYWdlIGV0Yy5cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgYmVmb3JlLXF1aXQ6IEVycm9yIGNsZWFyaW5nIGNhY2hlOicsIGVycik7XG4gICAgfVxuICB9KTtcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpIH0gXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpIH1cbn0pXG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgYW5kIHF1aXQgaWYgZGV0ZWN0ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrUGFyZW50UHJvY2VzcygpO1xuICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudDonLCByZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdC5mb3VuZEJyb3dzZXIpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgY2hlY2tQYXJlbnQ6IFRoZSBhcHAgd2FzIHN0YXJ0ZWQgZGlyZWN0bHkgZnJvbSBhIGJyb3dzZXInKTtcbiAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveFN5bmMoV2luZG93SGFuZGxlci5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUZXJtaW5hdGUgUHJvZ3JhbScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VuZXJsYXVidGVyIFByb2dyYW1tc3RhcnQgYXVzIGVpbmVtIFdlYmJyb3dzZXIgZXJrYW5udC5cXG5OZXh0LUV4YW0gd2lyZCBiZWVuZGV0IScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlO1xuICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdtYWluIEAgY2hlY2twYXJlbnQ6IFBhcmVudCBQcm9jZXNzIENoZWNrIE9LJyk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudCBlcnJvcjonLCBlcnJvcik7XG4gICAgfVxufVxuXG5hcHAud2hlblJlYWR5KClcbi50aGVuKGFzeW5jICgpPT57XG5cbiAgICBuYXRpdmVUaGVtZS50aGVtZVNvdXJjZSA9ICdsaWdodCcgIC8vIHByZXZlbnQgdGhlbWUgc2V0dGluZ3MgZnJvbSBiZWluZyBhZG9wdGVkIGZyb20gd2luZG93c1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0VXNlckFnZW50KGBOZXh0LUV4YW0vJHtjb25maWcudmVyc2lvbn0gKCR7Y29uZmlnLmluZm99KSAke3Byb2Nlc3MucGxhdGZvcm19YCk7ICAvLyBzZXQgdXNlciBhZ2VudCBmb3IgYWxsIHNlc3Npb25zXG4gICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRDZXJ0aWZpY2F0ZVZlcmlmeVByb2MoKHJlcXVlc3QsIGNhbGxiYWNrKSA9PiB7IGNhbGxiYWNrKDApOyB9KTsgICAvLyBzZXQgY2VydGlmaWNhdGUgdmVyaWZpY2F0aW9uIGdsb2JhbGx5IGZvciBhbGwgc2Vzc2lvbnNcblxuICAgXG4gICAgLyoqKioqKiogQ3JlYXRlIG1haW4gd2luZG93ICoqKioqKiovXG4gICAgV2luZG93SGFuZGxlci5jcmVhdGVNYWluV2luZG93KClcblxuXG4gICAgaWYgKGNvbmZpZy5ob3N0aXAgPT0gXCIxMjcuMC4wLjFcIikgeyBjb25maWcuaG9zdGlwID0gZmFsc2UgfVxuICAgIGlmIChjb25maWcuaG9zdGlwKSB7IG11bHRpY2FzdENsaWVudC5pbml0KGNvbmZpZy5nYXRld2F5KSAgfSAvL211bHRpY2FzdCBjbGllbnQgb25seSB0cmFja3Mgb3RoZXIgZXhhbSBpbnN0YW5jZXMgb24gdGhlIG5ldHdvcmtcblxuICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGlkZXMgbGVnYWN5IHRyYXlcbiAgICBpZiAoIWNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgIHBvd2VyU2F2ZUJsb2NrZXIuc3RhcnQoJ3ByZXZlbnQtZGlzcGxheS1zbGVlcCcpICAgLy8gcHJldmVudCB0aGUgZGV2aWNlIGZyb20gZ29pbmcgdG8gc2xlZXBcbiAgICAgICAgaWYgKGFsbG93VHJheSkgeyB1cGRhdGVTeXN0ZW1UcmF5KCdkZScpOyB9ICAgICAgICAvLyBza2lwIHRyYXkgb24gR05PTUVcbiAgICAgICAgZWxzZSB7IGxvZy5pbmZvKCdtYWluIEAgdHJheTogR05PTUUgZGV0ZWN0ZWQsIHNraXBwaW5nIHN5c3RlbSB0cmF5Jyk7IH1cbiAgICAgICAgcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCk7ICAvLyB0aGlzIGNoZWNrcyBpZiB0aGUgYXBwIHdhcyBzdGFydGVkIGZyb20gd2l0aGluIGEgYnJvd3NlciAoZGlyZWN0bHkgYWZ0ZXIgZG93bmxvYWQpXG4gICAgfVxuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtHJywgKCkgPT4geyAgaWYgKGdsb2JhbCAmJiBnbG9iYWwuZ2MpeyBnbG9iYWwuZ2Moe3R5cGU6J21heW9yJyxleGVjdXRpb246ICdhc3luYyd9KTsgZ2xvYmFsLmdjKHt0eXBlOidtaW5vcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7ICB9fSk7XG4gICAgICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgfVxuXG4gICAgLy90aGVzZSBhcmUgc29tZSBzaG9ydGN1dHMgd2UgdHJ5IHRvIGNhcHR1cmVcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdGNScsICgpID0+IHt9KTsgIC8vcmVsb2FkIHBhZ2VcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrRjQnLCAoKSA9PiB7fSk7ICAvL2V4aXQgYXBwXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVycsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtRJywgKCkgPT4ge30pOyAgLy9xdWl0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrRCcsICgpID0+IHt9KTsgIC8vc2hvdyBkZXNrdG9wXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrTCcsICgpID0+IHt9KTsgIC8vbG9ja3NjcmVlblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1AnLCAoKSA9PiB7fSk7ICAvL2NoYW5nZSBzY3JlZW4gbGF5b3V0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcbn0pIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuXG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIEJyb3dzZXJWaWV3LCBkaWFsb2csIHNjcmVlbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgcGF0aCwgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2VzcycgXG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnMsIGVuYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5cbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgeyBhY3RpdmVXaW5kb3cgfSBmcm9tICdnZXQtd2luZG93cyc7XG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tIFwibm9kZTp1cmxcIjtcblxuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIFdpbmRvdyBoYW5kbGluZyAoaXBjUmVuZGVyZXIgUHJvY2VzcyAtIEZyb250ZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2tXaW5kb3cgPSBudWxsXG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNlcnZlZCBkaXNwbGF5IElEIGZvciBleGFtIHdpbmRvdyAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gd2luZG93IGlzIGNyZWF0ZWQpXG4gICAgICB0aGlzLnNwbGFzaHdpbiA9IG51bGxcbiAgICAgIHRoaXMuYmlwd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICBcbiAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgcXVlc3Rpb24gZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBtaW5pbWl6ZSB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMud2luZG93VHJhY2tlci5iaW5kKHRoaXMpLCAxMDAwKVxuICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gZWxlY3Ryb24gd2luZG93IGluIGZvY3VzIG9yIGFuIG90aGVyIGVsZWN0cm9uIHdpbmRvdyBkZXBlbmRpbmcgb24gdGhlIGhpZXJhY2h5XG4gICAgZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgICAgICAgaWYgKGZvY3VzZWRXaW5kb3cpIHtcbiAgICAgICAgICByZXR1cm4gZm9jdXNlZFdpbmRvd1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVubG9ja1dpbmRvdyl7cmV0dXJuIHRoaXMuc2NyZWVubG9ja1dpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZXhhbXdpbmRvdyl7cmV0dXJuIHRoaXMuZXhhbXdpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubWFpbndpbmRvdyl7cmV0dXJuIHRoaXMubWFpbndpbmRvd31cbiAgICAgICAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEwMDAsXG4gICAgICAgICAgICBoZWlnaHQ6ODAwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcImRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIm5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwidGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ0NhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhbiBlYXN0ZXIgZWdnXG4gICAgICovXG4gICAgY3JlYXRlRWFzdGVyV2luKCkge1xuICAgICAgICB0aGlzLmVhc3RlcndpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiA3NjgsXG4gICAgICAgICAgICBoZWlnaHQ6NDgwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IHRydWUsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ubG9hZEZpbGUoam9pbihfX2Rpcm5hbWUsIGAuLi8uLi9wdWJsaWMvY293c29uaWNlL2luZGV4Lmh0bWxgKSlcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuZWFzdGVyd2luICYmICF0aGlzLmVhc3Rlcndpbi5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZWFzdGVyd2luLnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQmxvY2tXaW5kb3cgKHRvIGNvdmVyIGFkZGl0aW9uYWwgc2NyZWVucylcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBuZXdCbG9ja1dpbihkaXNwbGF5KSB7XG4gICAgICAgIGxldCBibG9ja3dpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICBwYXJlbnQ6IHRoaXMuZXhhbXdpbmRvdyxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAgIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBcIm5vdGZvdW5kXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBibG9ja3dpbi5yZW1vdmVNZW51KCkgXG4gICAgICAgIGJsb2Nrd2luLnNldE1pbmltaXphYmxlKGZhbHNlKVxuXG4gICAgICAgIC8vIFBvc2l0aW9uIHdpbmRvdyBvbiBzcGVjaWZpYyBkaXNwbGF5IEJFRk9SRSBzaG93aW5nIGl0XG4gICAgICAgIGJsb2Nrd2luLnNldEJvdW5kcyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54LFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJsb2Nrd2luLnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICBibG9ja3dpbi5zaG93KClcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7XG4gICAgICAgICAgICBibG9ja3dpbi5vbignbGVhdmUtZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTsgLy8gc29mb3J0IHdpZWRlciB6dXJcdTAwRkNja3NldHplblxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9ICBcbiAgICAgICAgZWxzZSB7ICAgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRLaW9zayh0cnVlKTsgLy8gS2lvc2sgPSBcInRha2Ugb3ZlciBtYWluIHNjcmVlblwiLiBvbiBtYWNvcyB0aGF0J3Mgd2h5IHdlIHVzZSBmdWxsU2NyZWVuIHdvcmthcm91bmQgd2l0aCBldmVudCBsaXN0ZW5lclxuICAgICAgICB9XG4gICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgYmxvY2t3aW4uZGlzcGxheSA9IGRpc3BsYXlcbiAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MucHVzaChibG9ja3dpbilcbiAgICB9XG5cblxuICAgIC8vIGJsb2NrIGFsbCBzY3JlZW5zIHdpdGggYSBibG9ja3dpbmRvd1xuICAgIGFzeW5jIGluaXRCbG9ja1dpbmRvd3MoKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgLy9sb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGZvdW5kICR7ZGlzcGxheXMubGVuZ3RofSBkaXNwbGF5c2ApXG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7ICAvLyBsb2NrIGFsbCBzY3JlZW5zXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBleGFtIHdpbmRvdyB0byBiZSB2aXNpYmxlIGFuZCBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldHJpZXMgPSAwXG4gICAgICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwXG4gICAgICAgICAgICAgICAgd2hpbGUgKCF0aGlzLmV4YW13aW5kb3cuaXNWaXNpYmxlKCkgJiYgcmV0cmllcyA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApXG4gICAgICAgICAgICAgICAgICAgIHJldHJpZXMrK1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHdhaXQgdG8gZW5zdXJlIHBvc2l0aW9uaW5nIGlzIGNvbXBsZXRlIG9uIFdheWxhbmRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIGJsb2NrIHdpbmRvd3MgZnJvbSBhcnJheVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSB0aGlzLmJsb2Nrd2luZG93cy5maWx0ZXIoYmxvY2t3aW4gPT4gYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBhbGwgZXhpc3Rpbmcgd2luZG93cyBhbmQgZGV0ZXJtaW5lIHRoZWlyIGRpc3BsYXlzXG4gICAgICAgICAgICBjb25zdCB1c2VkRGlzcGxheUlkcyA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaXJzdCwgdXNlIHRoZSByZXNlcnZlZCBleGFtIGRpc3BsYXkgSUQgKHNldCBpbW1lZGlhdGVseSB3aGVuIGV4YW0gd2luZG93IHdhcyBjcmVhdGVkKVxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBzY3JlZW4gaXMgcmVzZXJ2ZWQgZXZlbiBpZiB0aGUgd2luZG93IGlzbid0IGZ1bGx5IGluaXRpYWxpemVkIHlldFxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbURpc3BsYXlJZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZCh0aGlzLmV4YW1EaXNwbGF5SWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFsd2F5cyBleGNsdWRlIHByaW1hcnkgZGlzcGxheSAoZXhhbSB3aW5kb3cgbG9jYXRpb24pXG4gICAgICAgICAgICBjb25zdCBwcmltYXJ5RGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAocHJpbWFyeURpc3BsYXkgJiYgcHJpbWFyeURpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQocHJpbWFyeURpc3BsYXkuaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGV4YW0gd2luZG93IGRpc3BsYXkgKGFzIGZhbGxiYWNrL3ZlcmlmaWNhdGlvbiwgYnV0IHJlc2VydmVkIElEIHRha2VzIHByaW9yaXR5KVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBleGFtIHdpbmRvdyBpcyBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGV4YW0gd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBibG9jayB3aW5kb3dzIGRpc3BsYXlzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGJsb2Nrd2luIG9mIHRoaXMuYmxvY2t3aW5kb3dzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gYmxvY2t3aW4uZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBibG9jayB3aW5kb3cgZm91bmQgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBibG9jayB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBibG9jayB3aW5kb3dzIGZvciBkaXNwbGF5cyB0aGF0IGRvbid0IGhhdmUgZXhhbSBvciBibG9jayB3aW5kb3dzXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBpZiAodXNlZERpc3BsYXlJZHMuaGFzKGRpc3BsYXkuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogc2tpcHBpbmcgZGlzcGxheSAke2Rpc3BsYXkuaWR9IC0gYWxyZWFkeSBoYXMgZXhhbSBvciBibG9jayB3aW5kb3dgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBjcmVhdGUgYmxvY2t3aW4gb246XCIsZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0Jsb2NrV2luKGRpc3BsYXkpICAvLyBhZGQgYmxvY2t3aW5kb3dzIGZvciBkaXNwbGF5cyB3aXRob3V0IGV4YW0gd2luZG93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMClcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLmZvckVhY2goIChibG9ja3dpbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFNjcmVlbmxvY2sgV2luZG93ICh0byBjb3ZlciB0aGUgbWFpbnNjcmVlbikgLSBibG9jayBzdHVkZW50cyBmcm9tIHdvcmtpbmdcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBjcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IHNjcmVlbmxvY2tXaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHRoaXMubWFpbndpbmRvdywgICAvLyBsZWFkcyB0byB2aXNpYmxlIHRpdGxlYmFyIGluIGdub21lLWRlc2t0b3BcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ1NjcmVlbmxvY2snLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIC8vZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCB1cmwgPSBcImxvY2tcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgLy8gQWRkIHdpbmRvdyB0byBhcnJheSBmaXJzdCwgYmVmb3JlIGFkZGluZyBibHVyIGxpc3RlbmVyXG4gICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MucHVzaChzY3JlZW5sb2NrV2luZG93KVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICghc2NyZWVubG9ja1dpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnJlbW92ZU1lbnUoKSBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0TWluaW1pemFibGUoZmFsc2UpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwicG9wLXVwLW1lbnVcIiwgMSkgICAvL2Fib3ZlIGV4YW0gd2luZG93IChwb3AtdXAtbWVudSwgMClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2hvdygpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0Q2xvc2FibGUodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlKTsgLy8gcHV0IHRoZSB3aW5kb3cgb24gYWxsIHZpcnR1YWwgd29ya3NwYWNlc1xuICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoXCJzY3JlZW5sb2NrXCIpXG4gICAgICAgIH0pXG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0gIFxuICAgICAgICB9KTtcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZWQnLCAoKSA9PiB7ICAgLy8gcmVtb3ZlIHdpbmRvdyBmcm9tIGFycmF5IHdoZW4gYWN0dWFsbHkgY2xvc2VkXG4gICAgICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiB3aW4gIT09IHNjcmVlbmxvY2tXaW5kb3cgJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRXhhbXdpbmRvd1xuICAgICAqIEBwYXJhbSBleGFtdHlwZSBlZHV2aWR1YWwsIG1hdGgsIGxhbmd1YWdlXG4gICAgICogQHBhcmFtIHRva2VuIHN0dWRlbnQgdG9rZW5cbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIHRoZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0IGNvbnRhaW5pbmcgaW5mbyBhYm91dCBzcGVsbGNoZWNrIGxhbmd1YWdlIGV0Yy4gXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlRXhhbVdpbmRvdyhleGFtdHlwZSwgdG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeWRpc3BsYXkpIHtcbiAgICAgICAgLy8ganVzdCB0byBiZSBzdXJlIHdlIGNoZWNrIHNvbWUgaW1wb3J0YW50IHZhcnMgaGVyZVxuICAgICAgICBpZiAoZXhhbXR5cGUgIT09IFwicmRwXCIgJiYgZXhhbXR5cGUgIT09IFwid2Vic2l0ZVwiICYmICBleGFtdHlwZSAhPT0gXCJnZm9ybXNcIiAmJiBleGFtdHlwZSAhPT0gXCJlZHV2aWR1YWxcIiAmJiBleGFtdHlwZSAhPT0gXCJlZGl0b3JcIiAmJiBleGFtdHlwZSAhPT0gXCJtYXRoXCIgJiYgZXhhbXR5cGUgIT09IFwibWljcm9zb2Z0MzY1XCIgJiYgZXhhbXR5cGUgIT09IFwiYWN0aXZlc2hlZXRzXCIgfHwgIXRva2VuKXsgIC8vIGZvciBub3cuLiB3ZSBwcm9iYWJseSBzaG91bGQgc3RvcCBldmVyeXRoaW5nIGhlcmVcbiAgICAgICAgICAgIGxvZy53YXJuKFwibWlzc2luZyBwYXJhbWV0ZXJzIGZvciBleGFtLW1vZGUgb3IgbW9kZSBub3QgaW4gYWxsb3dlZCBsaXN0IVwiKVxuICAgICAgICAgICAgZXhhbXR5cGUgPSBcImVkaXRvclwiIFxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgLy8gQWx3YXlzIHVzZSBwcmltYXJ5IGRpc3BsYXkgZm9yIGV4YW0gd2luZG93XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcyB8fCAhcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IGRpc3BsYXlzWzBdIHx8IHByaW1hcnlkaXNwbGF5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEltbWVkaWF0ZWx5IHJlc2VydmUgdGhlIGRpc3BsYXkgSUQgZm9yIHRoZSBleGFtIHdpbmRvdyAoYmVmb3JlIHdpbmRvdyBpcyBmdWxseSBpbml0aWFsaXplZClcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBibG9jayB3aW5kb3dzIGZyb20gYmVpbmcgY3JlYXRlZCBvbiB0aGUgc2FtZSBzY3JlZW5cbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBwcmltYXJ5ZGlzcGxheS5pZFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiByZXNlcnZpbmcgZGlzcGxheSAke3RoaXMuZXhhbURpc3BsYXlJZH0gZm9yIGV4YW0gd2luZG93YClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHB4ID0gMFxuICAgICAgICBsZXQgcHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzLngpIHtcbiAgICAgICAgICAgIHB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnhcbiAgICAgICAgICAgIHB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IHB4ICsgMCxcbiAgICAgICAgICAgIHk6IHB5ICsgMCxcbiAgICAgICAgICAgIHRpdGxlOiAnRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogMTQ0MCxcbiAgICAgICAgICAgIGhlaWdodDogNzY4LFxuICAgICAgICAgICAgLy8gcGFyZW50OiB3aW4sICAvL3RoaXMgZG9lc250IHdvcmsgdG9nZXRoZXIgd2l0aCBraW9zayBvbiB1YnVudHUgZ25vbWUgPz8gd3RmXG4gICAgICAgICAgICAvLyBtb2RhbDogdHJ1ZSwgIC8vIHRoaXMgYmxvY2tzIHRoZSBtYWluIHdpbmRvdyBvbiB3aW5kb3dzIHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBvcGVuXG4gICAgICAgICAgICAvLyBjbG9zYWJsZTogZmFsc2UsICAvLyBpZiB3ZSBjYW4ndCBkZWZpbmUgJ3BhcmVudCcgdGhpcyB3aW5kb3cgaGFzIHRvIGJlIGNsb3NhYmxlIC0gd2h5P1xuICAgICAgICAgICAgLy9hbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIGtpb3NrOiB0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNvbnRleHRJc29sYXRpb246IHRydWUsXG4gICAgICAgICAgICAgICAgd2Vidmlld1RhZzogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJTZWN1cml0eTogZmFsc2UgICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmV4YW13aW5kb3cpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5yZW1vdmVNZW51KCkgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmZvY3VzKClcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNXYXlsYW5kKXsgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0YXJ0KCkgfSAvLyBjb25zdGFudGx5IGNoZWNrIGlmIHRoZSBhY3RpdmUgd2luZG93IGlzIHRoZSBleGFtd2luZG93IC0gaWYgbm90LCBicmluZyBpdCB0byBmcm9udFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVSZXN0cmljdGlvbnModGhpcykgIC8vIGRpc2FibGUga2V5Ym9hcmQgc2hvcnRjdXRzIGV0Yy5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgIC8vIGRvIG5vdCBzZXQgYmx1ciBsaXN0ZW5lciB0b28gZWFybHlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoKSAgLy8gYWRkIGJsdXIgbGlzdGVuZXIgdG8gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBkaWQtZmluaXNoLWxvYWQ6IGVycm9yIGluIGV4YW13aW5kb3cgc2V0dXBcIiwgZSl9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzID0gc2VydmVyc3RhdHVzIC8vd2Uga2VlcCBpdCB0aGVyZSB0byBtYWtlIGl0IGFjY2Vzc2FibGUgdmlhIGV4YW13aW5kb3cgaW4gaXBjSGFuZGxlclxuICAgICAgICB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCA9IDk0ICAgLy8gc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBjb250ZW50IHZpZXdcbiAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1pY3Jvc29mdCAzNjUgZW1lYmVkcyBpdHMgZWRpdG9yIGluIGFuIGlmcmFtZSB3aXRoIGFjdGl2ZSBDb250ZW50IFNlY3VyaXR5IFBvbGljeSAoQ1NQKVxuICAgICAgICAgKiBUaGUgb25seSB3YXkgdG8gYmUgYWJsZSB0byBpbmplY3QgY29kZSBpcyB0byBsb2FkIGl0IGRpcmVjdGx5IGluIHRoZSBtYWluIHdpbmRvdyA8ZW1iZWQ+IDxpZnJhbWU+IG9yIGV2ZW4gPHdlYnZpZXc+IG9mZmVycyBubyB3b3JrYXJvdW5kXG4gICAgICAgICAqIHRoZXJlZm9yZSB3ZSB1c2UgXCJCcm93c2VyVmlld1wiIGluIG9yZGVyIHRvIGRpc3BsYXkgdHdvIHBhZ2VzIGluIG9uZSB3aW5kb3c6IG9uIHRvcCA+IGV4YW0gaGVhZGVyLCBvbiBib3R0b20gPiBvZmZpY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaWYgKGV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiICApIHsgLy9leHRlcm5hbCBwYWdlXG4gICAgICAgICAgICBsb2cuaW5mbyhcInN0YXJ0aW5nIG1pY3Jvc29mdDM2NSBleGFtLi4uXCIpXG4gICAgICAgICAgICBsZXQgdXJsdmlldyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSAgIFxuICAgICAgICAgICAgaWYgKCF1cmx2aWV3KSB7Ly8gd2Ugd2FpdCBmb3IgdGhlIG5leHQgdXBkYXRlIHRpY2sgLSBtc29mZmljZXNoYXJlIG5lZWRzIHRvIGJlIHNldCAhIChjb3VsZCBoYXBwZW4gd2hlbiBhIHN0dWRlbnQgY29ubmVjdHMgbGF0ZXIgdGhlbiBleGFtIG1vZGUgaXMgc2V0IGJ1dCBoaXMgc2hhcmUgdXJsIG5lZWRzIHNvbWUgdGltZSlcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiBubyB1cmwgZm9yIG1pY3Jvc29mdDM2NSB3YXMgc2V0IHlldCAtIHdhaXRpbmcgZm9yIG5leHQgdXBkYXRlIHRpY2tcIilcbiAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGRlc3Ryb3llZFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsb2FkIHRvcCBtZW51IGluIE1haW5QYWdlXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCBlZHV2aWR1YWwgfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGJhY2tncm91bmR1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwoYmFja2dyb3VuZHVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBEZWZpbmUgdGhlIE1haW5Db250ZW50UGFnZSB2aWV3XG4gICAgICAgICAgICBsZXQgY29udGVudFZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSwgIFxuICAgICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRBdXRvUmVzaXplKHsgd2lkdGg6IHRydWUsIGhlaWdodDogdHJ1ZSwgaG9yaXpvbnRhbDogdHJ1ZSwgdmVydGljYWw6IHRydWUgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybHZpZXcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSB9XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignZW50ZXItZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbigncmVzaXplJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgbm9ybWFsIGV4YW0gbW9kZSAoZWRpdG9yLCBtYXRoLCBlZHV2aWR1YWwsIHdlYnNpdGUsIGdmb3JtcylcbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vJHt0b2tlbn0vYFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogSGFuZGxlIHNwZWNpYWwgTkFWSUdBVElPTiBzaXR1YXRpb25zXG4gICAgICAgICAqL1xuXG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgRm9ybXMsIFdlYnNpdGUsIEVkdXZpZHVhbCwgRWRpdG9yLCBSRFAsIE1pY3Jvc29mdDM2NVxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgICAvLyBCbG9jayBuYXZpZ2F0aW9uIG9uIGV4YW13aW5kb3cud2ViQ29udGVudHMgbGV2ZWwgZm9yIGFsbCBtb2RlcyB0aGF0IGNhbiBkaXNwbGF5IFBERnMgaW4gZXhhbWhlYWRlclxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIG5hdmlnYXRpb24gd2hlbiBjbGlja2luZyBsaW5rcyBpbiBQREZzIGRpc3BsYXllZCBpbiB0aGUgZXhhbWhlYWRlclxuICAgICAgICAvLyBXZWJ2aWV3L0Jyb3dzZXJWaWV3IGJsb2NraW5nIGlzIGhhbmRsZWQgc2VwYXJhdGVseSB2aWEgSVBDIGluIGlwY2hhbmRsZXIuanMgb3IgbW9kZS1zcGVjaWZpYyBoYW5kbGVycyBiZWxvd1xuICAgICAgICBjb25zdCBleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIgPSBbXCJnZm9ybXNcIiwgXCJ3ZWJzaXRlXCIsIFwiZWR1dmlkdWFsXCIsIFwiZWRpdG9yXCIsIFwicmRwXCIsIFwibWljcm9zb2Z0MzY1XCIsIFwiYWN0aXZlc2hlZXRzXCJdO1xuICAgICAgICBpZiAoZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyLmluY2x1ZGVzKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBWdWUgYXBwIChlLmcuIGZyb20gUERGIGxpbmtzIGluIGV4YW1oZWFkZXIpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gUHJldmVudCBuZXcgd2luZG93cyBmcm9tIG9wZW5pbmcgaW4gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgbmV3LXdpbmRvd1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBzZXRXaW5kb3dPcGVuSGFuZGxlclwiLCB1cmwpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIE1pY3Jvc29mdCBFeGNlbC9Xb3JkXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIpeyAgLy8gZG8gbm90IHVuZGVyIGFueSBjaXJjdW1zdGFuY2VzIGFsbG93IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBjdXJyZW50IGV4YW0gdXJsXG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHVzZXIgd2FudHMgdG8gbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgcGFnZVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJkbyBub3QgbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgdGVzdC4uIFwiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0ZUNvZGUgPSAgYFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBsb2NrKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAnV0FDRGlhbG9nT3V0ZXJDb250YWluZXInLCdXQUNEaWFsb2dJbm5lckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ1BhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZGV1c0J5SUQgPSBbJ1Nob3dIaWRlRXF1YXRpb25Ub29sc1BhbmUnLCdMaW5rR3JvdXAnLCdHcmFwaGljc0VkaXRvcicsJ0luc2VydFRhYmxlT2ZDb250ZW50c0luSW5zZXJ0VGFiJywnSW5zZXJ0T25saW5ldmlkZW8nLCdQaWN0dXJlJywnUmliYm9uLVBpY3R1cmVNZW51TUxSRHJvcGRvd24nLCdJbnNlcnRBZGRJbkZseW91dCcsJ0Rlc2lnbmVyJywnRWRpdG9yJywnRmFyUGFuZScsJ0hlbHAnLCdJbnNlcnRBcHBzRm9yT2ZmaWNlJywnRmlsZU1lbnVMYXVuY2hlckNvbnRhaW5lcicsJ0hlbHAtd3JhcHBlcicsJ1Jldmlldy13cmFwcGVyJywnSGVhZGVyJywnRmFyUGVyaXBoZXJhbENvbnRyb2xzQ29udGFpbmVyJywnQnVzaW5lc3NCYXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChlbnRyeSBvZiBoaWRldXNCeUlEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJkaXNwbGF5XCIsIFwibm9uZVwiLCBcImltcG9ydGFudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBidXR0b25BcHBzT3ZlcmZsb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnQWRkLUlucycpWzBdOyAgLy8gdGhpcyBidXR0b24gaXMgcmVkcmF3biBvbiByZXNpemUgKGRvZXNuJ3QgaGFwcGVuIGluIGV4YW0gbW9kZSBidXQgc3RpbGwgdGhlcmUgbXVzdCBiZSBhIGNsZWFuZXIgd2F5IC0gaW5zZXJ0aW5nIGNzcyBiZWZvcmUgaXQgYXBwZWFycyBpcyBub3Qgd29ya2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidXR0b25BcHBzT3ZlcmZsb3cpeyBidXR0b25BcHBzT3ZlcmZsb3cuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJTdWNoZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJcdTAwRENiZXJzZXR6ZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJDb3BpbG90XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkFkZC1JbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwQ29udGV4dE1lbnVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cFN5bm9ueW1zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlJpYmJvbi1SZWZlcmVuY2VzU21hcnRMb29rVXBcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJEaWN0YXRpb25cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkdldEFkZGluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUGljdHVyZXNfTUxSXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pOyAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9jaygpICAvL2ZvciBzb21lIHJlYXNvbiBleGNlbCBkZWxheXMgdGhhdCBjYWxsLi4gZG9lc250IGhhcHBlbiBvbiBwYWdlIGZpbmlzaCBsb2FkXG4gICAgICAgICAgICAgICAgICAgIGBcblxuICAgICAgICAgICAgbGV0IHNjaGVkdWxlckluc3RhbmNlID0gbnVsbFxuICAgICAgICAgICAgdGhpcy5sb2NrQ2FsbGJhY2sgPSAoKSA9PiB0aGlzLmxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSk7IFxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmxvY2tDYWxsYmFjaywgNDAwKVxuICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gc2NoZWR1bGVySW5zdGFuY2VcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0YXJ0KClcbiAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgdGhlIHdlYkNvbnRlbnRzIGlzIGZ1bGx5IGxvYWRlZCAgLy8gdGhpcyBpcyBub3Qgd29ya2luZyByZWxpYWJseSBiZWNhdXNlIHRoZSBwYWdlIGlzIGxvYWRlZCBpbiBtYW55IHN0ZXBzIGFuZCB0aGUgdWkgZWxlbWVudHMgYXJlIG5vdCBhdmFpbGFibGUgeWV0XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2FwcC1jb21tYW5kJywgKGUsIGNtZCkgPT4ge1xuICAgICAgICAgICAgLy8gJ2Jyb3dzZXItYmFja3dhcmQnIHVuZCAnYnJvd3Nlci1mb3J3YXJkJyBzaW5kIGRpZSBCZWZlaGxlLCBkaWUgYmVpbSBLbGljayBhdWYgZGllIE1hdXN0YXN0ZW4gZ2VzZW5kZXQgd2VyZGVuXG4gICAgICAgICAgICBpZiAoY21kID09PSAnYnJvd3Nlci1iYWNrd2FyZCcgfHwgY21kID09PSAnYnJvd3Nlci1mb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwibm8gbmF2aWdhdGlvbiBhbGxvd2VkXCIpXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJuIFNpZSBkYXMgU3RhbmRhcmR2ZXJoYWx0ZW5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICAvL2Rpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KSAgLy9kbyBub3QgZGlzYWJsZSB0d2ljZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgbG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKXtcbiAgICAgICAgaWYgKGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzICYmIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZSl7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIiwgZnJhbWUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUgJiYgKGZyYW1lLm5hbWUgPT09ICdXZWJBcHBsaWNhdGlvbkZyYW1lJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfV29yZF8wJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfRXhjZWxfMCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiKVxuICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IHN0b3BwaW5nIGxvY2tTY2hlZHVsZXJcIilcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0b3AoKVxuICAgICAgICAgICAgaWYgKHRoaXMubG9ja1NjaGVkdWxlciA9PT0gc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogbm8gYnJvd3NlclZpZXcgb3IgbG9ja1NjaGVkdWxlciBmb3VuZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTUFJTiBXSU5ET1dcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGFzeW5jIGNyZWF0ZU1haW5XaW5kb3coKSB7XG4gICAgICAgIGxldCBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpWzBdXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaW5kb3cgZGltZW5zaW9ucyAtIGRlZmluZWQgb25jZSwgdXNlZCBldmVyeXdoZXJlXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gMTAyNFxuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSA2NDBcblxuICAgICAgICAvLyBDYWxjdWxhdGUgY2VudGVyIHBvc2l0aW9uIG9uIHByaW1hcnkgZGlzcGxheVxuICAgICAgICBsZXQgeCA9IDBcbiAgICAgICAgbGV0IHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy53aWR0aCAtIHdpbmRvd1dpZHRoKSAvIDIpXG4gICAgICAgICAgICB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnkgKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMuaGVpZ2h0IC0gd2luZG93SGVpZ2h0KSAvIDIpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ01haW4gd2luZG93JyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgIHdpZHRoOiB3aW5kb3dXaWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogd2luZG93SGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDg1MCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogNjAwLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkYXMgXHUwMEM0bmRlcm4gZGVyIEdyXHUwMEY2XHUwMERGZSAgXG4gICAgICAgICAgICBmdWxsc2NyZWVuYWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGVuIFZvbGxiaWxkbW9kdXMgLSB3aWNodGlnIGZcdTAwRkNyIG1hY29zIGRlbm4gd2VubiBhdWYgbWFjb3MgZGFzIG1haW53aW5kb3cgYXVmIGZ1bGxzY3JlZW4gaXN0IGdyZWlmdCBiZWltIGV4YW13aW5kb3cgZGVyIGtpb3NrIG1vZGUgbmljaHQgIC0gZWxlY3Ryb24gYnVnIChuZWVkcyBleGFtcGxlIGNvZGUpOiA+PiBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzQ0NzU1XG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcGF0aC5yZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50RGlyLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04pXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzIGJlZm9yZSBsb2FkaW5nXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyBhc2sgYmVmb3JlIGNsb3NpbmdcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgIXRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQpIHsgIC8vIGFsbG93ZXhpdCBpc3QgZWluIG92ZXJyaWRlIHZvbSBjb250ZXh0IG1lbnUgb2RlciBzY3JlZW5zaG90IHRlc3QuIGRpZXNlciBrYW5uIGRpZSBhcHAgc2NobGllc3NlblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dUcmF5ID0gIXBsYXRmb3JtRGlzcGF0Y2hlci5faXNHTk9NRSgpOyAvLyBHTk9NRSBoYXMgbm8gbGVnYWN5IHRyYXlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhbGxvd1RyYXkpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IEdOT01FIGRldGVjdGVkLCBxdWl0dGluZyBpbnN0ZWFkIG9mIHRyYXkgbWluaW1pemVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyAgLy8gYWxsb3cgY2xvc2UgZmxvd1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zaG93TWluaW1pemVXYXJuaW5nKClcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBNaW5pbWl6aW5nIE5leHQtRXhhbSB0byBTeXN0ZW10cmF5YCkgXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2V0IHdpbmRvdyBwcm9wZXJ0aWVzIGltbWVkaWF0ZWx5IGFmdGVyIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmZvY3VzKClcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkIHx8IHByb2Nlc3MuZW52W1wiREVCVUdcIl0pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi9yZW5kZXJlci9pbmRleC5odG1sJylcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBmaWxlOiAke2ZpbGVQYXRofWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZEZpbGUoZmlsZVBhdGgpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfWBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBVUkw6ICR7dXJsfWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgYXN5bmMgc2hvd0V4aXRXYXJuaW5nKG1lc3NhZ2Upe1xuICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnd2FybmluZycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPayddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gQmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93RXhpdFF1ZXN0aW9uKCl7XG4gICAgICAgIGlmICh0aGlzLmV4aXRRdWVzdGlvbk9wZW4pIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRpYWxvZyBhbHJlYWR5IG9wZW4sIHNraXBwaW5nXCIpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydKYScsICdOZWluJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBiZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnV29sbGVuIHNpZSBkaWUgQW53ZW5kdW5nIE5leHQtRXhhbSBiZWVuZGVuPycsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYoY2hvaWNlLnJlc3BvbnNlID09IDEpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRvIG5vdCBjbG9zZSBOZXh0LUV4YW0gYWZ0ZXIgZmluaXNoZWQgRXhhbVwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd01pbmltaXplV2FybmluZygpe1xuICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2luZm8nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ01pbmltaXplIHRvIFN5c3RlbSBUcmF5JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRGllIEFud2VuZHVuZyBOZXh0LUV4YW0gd3VyZGUgbWluaW1pZXJ0IScsXG4gICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIEFkZGl0aW9uYWwgRnVuY3Rpb25zXG4gICAgICovXG5cbiAgICBpc1dheWxhbmQoKXtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJzsgXG4gICAgfVxuXG4gICAgLy8gdGhpcyBmdW5jdGlvbiB1c2VzIGFjdGl2ZS13aW4gdG8gcmVjZWl2ZSBuYW1lIGFuZCB1cmwgZnJvbSBhY3RpdmUgd2luZG93IC0geWV0IGFub3RoZXIgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhlIGZvY3VzIGlzIHN0aWxsIG9uIG5leHRleGFtXG4gICAgLy8gdGhpcyBpcyB1c2VkIHRvIGludHJvZHVjZSBleGVtcHRpb25zIGZvciB0aGUgYmx1ciBsaXN0ZW5lclxuICAgIC8vIChkb3duZ3JhZGVkIGZyb20gZ2V0LXdpbmRvd3MgYmVjYXVzZSBvZiBuYXBpIHY5IGlzc3VlKSBodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL2dldC13aW5kb3dzL2lzc3Vlcy8xODZcbiAgICBhc3luYyB3aW5kb3dUcmFja2VyKCl7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgIC8vIGNvbnN0IGdldHdpbiA9IGF3YWl0IHRoaXMuZ2V0QWN0aXZlV2luZG93KCk7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVXaW4gPSBhd2FpdCBhY3RpdmVXaW5kb3coKVxuICAgICAgICAgXG4gICAgICAgICAgICBpZiAoYWN0aXZlV2luICYmIGFjdGl2ZVdpbi5vd25lciAmJiBhY3RpdmVXaW4ub3duZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIGxldCBuYW1lID0gYWN0aXZlV2luLm93bmVyLm5hbWVcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGggPSBhY3RpdmVXaW4ub3duZXIucGF0aFxuICAgICAgICAgICAgICAgIGxldCBuYW1lTG93ZXIgPSBuYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGhMb3dlciA9IHdwYXRoLnRvTG93ZXJDYXNlKClcblxuICAgICAgICAgICAgICAgIGlmIChuYW1lTG93ZXIuaW5jbHVkZXMoXCJleGFtXCIpIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcIm5leHRcIikgIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcImVsZWN0cm9uXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZWFzZW9mYWNjZXNzZGlhbG9nXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZGlzYWJsZS1zaG9ydGN1dHNcIikgKXsgIFxuICAgICAgICAgICAgICAgICAgICAvLyBmb2t1cyBpcyBvbiBhbGxvd2VkIHdpbmRvdyBpbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IC8vZm9jdXMgaXMgbm90IG9uIG5leHQtZXhhbSBvciBhbnkgb3RoZXIgYWxsb3dlZCB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkKXsgIC8vbG9nIGp1c3Qgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiBmb2N1cyBsb3N0IGV2ZW50IHdhcyB0cmlnZ2VyZWQuIGFwcDogJHt3cGF0aH0gLSAke25hbWV9IGApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6ICR7ZXJyfWApIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9hZGRzIGJsdXIgbGlzdGVuZXIgd2hlbiBlbnRlcmluZyBleGFtbW9kZSAgIC8vIGJsdXIgZXZlbnQgaXNudCBmaXJlZCBvbiBtYWNvcyBNSVNTSU9OQ09OVFJPTCAod2hpY2ggY2FudCBiZSBkZWFjdGl2YXRlZCBhbnltb3JlKSAtIGRhbW4geW91IGFwcGxlIVxuICAgIGFkZEJsdXJMaXN0ZW5lcih3aW5kb3cgPSBcImV4YW13aW5kb3dcIil7XG4gICAgICAgIGlmICh3aW5kb3cgPT09IFwiZXhhbXdpbmRvd1wiKXsgXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd31gKVxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnQodGhpcykpIFxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHdpbmRvdyA9PT0gXCJzY3JlZW5sb2NrXCIpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fXdpbmRvd2ApXG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIHRoaXMuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudFNjcmVlbmxvY2sodGhpcykpICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy9yZW1vdmVzIGJsdXIgbGlzdGVuZXIgd2hlbiBsZWF2aW5nIGV4YW0gbW9kZVxuICAgIHJlbW92ZUJsdXJMaXN0ZW5lcigpe1xuICAgICAgICBpZiAodGhpcy5leGFtd2luZG93KXtcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2JsdXInKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgcmVtb3ZlQmx1ckxpc3RlbmVyOiByZW1vdmluZyBibHVyIGxpc3RlbmVyXCIpXG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gaW1wbGVtZW50aW5nIGEgc2xlZXAgKHdhaXQpIGZ1bmN0aW9uXG4gICAgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgICAvL3N0dWRlbnQgZm9ndXMgd2VudCB0byBhbm90aGVyIHdpbmRvd1xuICAgIGFzeW5jIGJsdXJldmVudCh3aW5oYW5kbGVyKSB7IFxuXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudDogc3R1ZGVudCB0cmllZCB0byBsZWF2ZSBleGFtIHdpbmRvd1wiKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnbGludXgnKXtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMud2luZG93VHJhY2tlcigpICAvL2NoZWNrcyBpZiBuZXcgZm9jdXMgd2luZG93IGlzIGFsbG93ZWRcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93dHJhY2tlciBjaGVjayBkb25lLi4uXCIpXG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIHNjcmVlbmxvY2sgd2luZG93cyBmcm9tIGFycmF5IGFuZCBjaGVjayBpZiBhbnkgc3RpbGwgZXhpc3RcbiAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICBjb25zdCBoYXNBY3RpdmVTY3JlZW5sb2NrID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5zb21lKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpICYmIHdpbi5pc1Zpc2libGUoKSlcbiAgICAgICAgLy8gQWxzbyBjaGVjayBjbGllbnRpbmZvLnNjcmVlbmxvY2sgZmxhZyBhcyBmYWxsYmFjayBpbiBjYXNlIGFycmF5IHdhcyBjbGVhcmVkIGJ1dCB3aW5kb3dzIHN0aWxsIGV4aXN0XG4gICAgICAgIGlmIChoYXNBY3RpdmVTY3JlZW5sb2NrIHx8IHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvPy5zY3JlZW5sb2NrKSB7IHJldHVybiB9Ly8gZG8gbm90aGluZyBpZiBzY3JlZW5sb2Nrd2luZG93IHN0b2xlIGZvY3VzIC8vIGRvIG5vdCB0cmlnZ2VyIGFuIGluZmluaXRlIGxvb3AgYmV0d2VlbiBleGFtIHdpbmRvdyBhbmQgc2NyZWVubG9jayB3aW5kb3cgKHN0ZWFsaW5nIGVhY2ggb3RoZXJzIGZvY3VzIGJlY2F1c2Ugc2NyZWVubG9ja3dpbmRvdyBhcHBlYXJzIGFib3ZlIGV4YW0gd2luZG93IGFuZCB3aWxsIGNhcHR1cmUgYSBrbGljayBhbmQgdGhlcmVmb3JlIHN0ZWFsIGZvY3VzKVxuICAgICAgICBpZiAod2luaGFuZGxlci5mb2N1c1RhcmdldEFsbG93ZWQpeyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAvL3Ryb3R6ZGVtIGZvY3VzIHp1clx1MDBGQ2NrIGF1ZiBkaWUgYXBwXG4gICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudDogYmx1cmV2ZW50IHdhcyB0cmlnZ2VyZWQgYnV0IHRhcmdldCBpcyBhbGxvd2VkYClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlICAgLy9pbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcblxuICAgICAgICAvL3R1cm4gdm9sdW1lIHVwIF5eXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7IHNwYXduKCdwb3dlcnNoZWxsJywgWydTZXQtVm9sdW1lTGV2ZWwgLUxldmVsIDEwMDsgU2V0LVZvbHVtZU11dGUgLU11dGUgJGZhbHNlJ10pOyB9XG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IGV4ZWMoJ29zYXNjcmlwdCAtZSBcInNldCB2b2x1bWUgb3V0cHV0IHZvbHVtZSAxMDBcIiAtZSBcInNldCB2b2x1bWUgb3V0cHV0IG11dGVkIGZhbHNlXCInKTsgfSAgXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7IFxuICAgICAgICAvLyAgICAgZXhlYygnYW1peGVyIHNldCBNYXN0ZXIgMTAwJSAnKTtcbiAgICAgICAgLy8gICAgIGV4ZWMoJ3BhY3RsIHNldC1zaW5rLW11dGUgYHBhY3RsIGdldC1kZWZhdWx0LXNpbmtgIDAnKTtcbiAgICAgICAgLy8gfVxuICAgICAgICBcbiAgICAgICAgLy93ZSBjb3VsZCBwbGF5IGEgc291bmQgZmlsZSBoZXJlLi4gdGJkLiAgXG4gICAgfVxuICAgIC8vc3BlY2lhbCBibHVyIGV2ZW50IGZvciB0ZW1wb3JhcnkgbG93IHNlY3VyaXR5IHNjcmVlbmxvY2tcbiAgICBibHVyZXZlbnRTY3JlZW5sb2NrKHdpbmhhbmRsZXIpIHsgXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6IGJsdXItc2NyZWVubG9jayB0cmlnZ2VyZWRcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vZG9uJ3QgY3ljbGUgdGhyb3VnaCBhbGwgb2YgdGhlbSAuLiBpdCB3aWxsIGNyZWF0ZSBhbiBpbmZpbml0ZSBmb2N1cyByYWNlXG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLnNob3coKTsgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6ICR7ZXJyfWApXG4gICAgICAgIH1cbiAgICBcbiAgICB9XG4gICAgXG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IFdpbmRvd0hhbmRsZXIoKVxuIFxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogbW9zdCBvZiB0aGUga2V5Ym9hcmQgcmVzdHJpY3Rpb25zIGNvdWxkIGJlIGhhbmRsZWQgYnkgXCJpb2hvb2tcIiBmb3IgYWxsIHBsYXRmb3Jtc1xuICogdW5mb3J0dW5hbGV0eSBpdCdzIG5vdCB5ZXQgcmVsZWFzZWQgZm9yIG5vZGUgdjE2LnggYW5kIGVsZWN0cm9uIHYxNi54ICAoYWxzbyBpdCdzIFwiYmlnIHN1clwiIGludGVsIG9ubHkgb24gbWFjcylcbiAqIGh0dHBzOi8vd2lsaXgtdGVhbS5naXRodWIuaW8vaW9ob29rL2luc3RhbGxhdGlvbi5odG1sXG4gKiBcbiAqIFwibm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyXCIgd291bGQgYmUgYW5vdGhlciBzb2x1dGlvbiBmb3Igd2luZG93cyBhbmQgbWFjb3MgKGFsdGhvdWdoIGl0IHJlcXVpcmVzIFwiYWNjZXNzYWJpbGl0eVwiIHBlcm1pc3Npb25zIG9uIG1hYylcbiAqIGJ1dCBmb3Igbm93IGl0IHNlZW1zIHRoZSBtb2R1bGUgY2FuIG5vdCBydW4gaW4gYSBmaW5hbCBlbGVjdHJvbiBidWlsZFxuICogaHR0cHM6Ly9naXRodWIuY29tL0xhdW5jaE1lbnUvbm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyL2lzc3Vlcy8xOFxuICogXG4gKiBoYXJkY29kaW5nIHRoZSBrZXlib2FyZHNob3J0Y3V0cyB3ZSB3YW50IHRvIGNhcHR1cmUgaW50byBpb2hvb2sob3Igbi1nLWstbCkgYW5kIG1hbnVhbGx5IGNvbXBpbGluZyBpdCBmb3IgbWFjIGFuZCB3aW5kb3dzIGNvdWxkIGJlIGRvbmUgLSAoYnV0IG5vdCB1bnRpbCBpIGdldCBwYWlkIGZvciB0aGlzIGFtb3VudCBvZiB3b3JrIDstKSBcbiAqL1xuXG5cbi8qKlxuICogdGhlIG5leHQgYmVzdCBzb2x1dGlvbiBpIGNhbWUgdXAgd2l0aCBpcyB0byBraWxsIGFsbCBvZiB0aGUgc2hlbGxzIC0gc3RhcnRpbmcgd2l0aCBleHBsb3Jlci5leGUgYmVjYXVzZSBpdHMgYWJzb2x1dGVseSBpbXBvc3NpYmxlIHRvIFxuICogZGVhY3RpdmF0ZSB0aGlzIG5hc3R5IFwid2luZG93c1wiIGJ1dHRvbiBvciAzRmluZ2VyU2xpZGVVcCBHZXN0dXJlIGluIHdpbmRvd3MgMTEgLSB5b3UgY291bGQgZWRpdCB0aGUgcmVnaXN0cnkgYW5kIHJlYm9vdCBidXQgdGhhdHMgb2J2aW91c2x5IG5vdCB3aGF0IHdlIHdhbnRcbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2VzcycgICAvL25lZWRlZCB0byBydW4gYmFzaCBjb21tYW5kcyBvbiBsaW51eCBcbmltcG9ydCB7IGFwcCwgVG91Y2hCYXIsIGNsaXBib2FyZCwgZ2xvYmFsU2hvcnRjdXR9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbi8vIHVuZm9ydHVuYXRlbHkgdGhlcmUgaXMgbm8gY29udmVuaWVudCB3YXkgZm9yIGdub21lLXNoZWxsIHRvIHVuLXNldCBBTEwgc2hvcnRjdXRzIGF0IG9uY2VcbmNvbnN0IGdub21lS2V5YmluZGluZ3MgPSBbICBcbiAgICAnYWN0aXZhdGUtd2luZG93LW1lbnUnLCdtYXhpbWl6ZS1ob3Jpem9udGFsbHknLCdtb3ZlLXRvLXNpZGUtbicsJ21vdmUtdG8td29ya3NwYWNlLTgnLCdzd2l0Y2gtYXBwbGljYXRpb25zJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0zJywnc3dpdGNoLXdpbmRvd3MtYmFja3dhcmQnLFxuICAgICdhbHdheXMtb24tdG9wJywnbWF4aW1pemUtdmVydGljYWxseScsJ21vdmUtdG8tc2lkZS1zJywnbW92ZS10by13b3Jrc3BhY2UtOScsJ3N3aXRjaC1hcHBsaWNhdGlvbnMtYmFja3dhcmQnLCcgIHN3aXRjaC10by13b3Jrc3BhY2UtNCcsJ3RvZ2dsZS1hYm92ZScsXG4gICAgJ2JlZ2luLW1vdmUnLCdtaW5pbWl6ZScsJ21vdmUtdG8tc2lkZS13JywnbW92ZS10by13b3Jrc3BhY2UtZG93bicsJ3N3aXRjaC1ncm91cCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNScsJ3RvZ2dsZS1mdWxsc2NyZWVuJyxcbiAgICAnYmVnaW4tcmVzaXplJywnbW92ZS10by1jZW50ZXInLCdtb3ZlLXRvLXdvcmtzcGFjZS0xJywnbW92ZS10by13b3Jrc3BhY2UtbGFzdCcsJ3N3aXRjaC1ncm91cC1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNicsJ3RvZ2dsZS1tYXhpbWl6ZWQnLFxuICAgICdjbG9zZScsJ21vdmUtdG8tY29ybmVyLW5lJywnbW92ZS10by13b3Jrc3BhY2UtMTAnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sZWZ0Jywnc3dpdGNoLWlucHV0LXNvdXJjZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtNycsJ3RvZ2dsZS1vbi1hbGwtd29ya3NwYWNlcycsXG4gICAgJ2N5Y2xlLWdyb3VwJywnbW92ZS10by1jb3JuZXItbncnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMScsJ21vdmUtdG8td29ya3NwYWNlLXJpZ2h0Jywnc3dpdGNoLWlucHV0LXNvdXJjZS1iYWNrd2FyZCAgc3dpdGNoLXRvLXdvcmtzcGFjZS04JywndG9nZ2xlLXNoYWRlZCcsXG4gICAgJ2N5Y2xlLWdyb3VwLWJhY2t3YXJkJywnbW92ZS10by1jb3JuZXItc2UnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMicsJ21vdmUtdG8td29ya3NwYWNlLXVwJywnc3dpdGNoLXBhbmVscycsJ3N3aXRjaC10by13b3Jrc3BhY2UtOScsJ3VubWF4aW1pemUnLFxuICAgICdjeWNsZS1wYW5lbHMnLCdtb3ZlLXRvLWNvcm5lci1zdycsJ21vdmUtdG8td29ya3NwYWNlLTInLCdwYW5lbC1tYWluLW1lbnUnLCdzd2l0Y2gtcGFuZWxzLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1kb3duJywgICAgICBcbiAgICAnY3ljbGUtcGFuZWxzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLWRvd24nLCdtb3ZlLXRvLXdvcmtzcGFjZS0zJywncGFuZWwtcnVuLWRpYWxvZycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGFzdCcsICAgICAgICAgICAgICBcbiAgICAnY3ljbGUtd2luZG93cycsJ21vdmUtdG8tbW9uaXRvci1sZWZ0JywnbW92ZS10by13b3Jrc3BhY2UtNCcsJ3JhaXNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGVmdCcsICAgIFxuICAgICdjeWNsZS13aW5kb3dzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLXJpZ2h0JywnbW92ZS10by13b3Jrc3BhY2UtNScsJ3JhaXNlLW9yLWxvd2VyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtcmlnaHQnLCAgIFxuICAgICdsb3dlcicsJ21vdmUtdG8tbW9uaXRvci11cCcsJ21vdmUtdG8td29ya3NwYWNlLTYnLCdzZXQtc3Bldy1tYXJrJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMicsJ3N3aXRjaC10by13b3Jrc3BhY2UtdXAnLCAgICAgXG4gICAgJ21heGltaXplJywnbW92ZS10by1zaWRlLWUnLCdtb3ZlLXRvLXdvcmtzcGFjZS03Jywnc2hvdy1kZXNrdG9wJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0yJywnc3dpdGNoLXdpbmRvd3MnICBcbl1cbmNvbnN0IGdub21lU2hlbGxLZXliaW5kaW5ncyA9IFsnZm9jdXMtYWN0aXZlLW5vdGlmaWNhdGlvbicsJ29wZW4tYXBwbGljYXRpb24tbWVudScsJ3NjcmVlbnNob3QnLCdzY3JlZW5zaG90LXdpbmRvdycsJ3NoaWZ0LW92ZXJ2aWV3LWRvd24nLFxuICAgICdzaGlmdC1vdmVydmlldy11cCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0xJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTInLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi00Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTUnLFxuICAgICdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi03Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTgnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOScsJ3Nob3ctc2NyZWVuc2hvdC11aScsJ3Nob3ctc2NyZWVuLXJlY29yZGluZy11aScsXG4gICAgJ3RvZ2dsZS1hcHBsaWNhdGlvbi12aWV3JywndG9nZ2xlLW1lc3NhZ2UtdHJheScsJ3RvZ2dsZS1vdmVydmlldycgIF1cblxuY29uc3QgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncyA9IFsncm90YXRlLW1vbml0b3InLCdzd2l0Y2gtbW9uaXRvcicsJ3RhYi1wb3B1cC1jYW5jZWwnLCd0YWItcG9wdXAtc2VsZWN0JywndG9nZ2xlLXRpbGVkLWxlZnQnLCd0b2dnbGUtdGlsZWQtcmlnaHQnXVxuXG5jb25zdCBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyA9IFsnYXBwLWN0cmwtaG90a2V5LTEnLCdhcHAtY3RybC1ob3RrZXktMTAnLCdhcHAtY3RybC1ob3RrZXktMicsJ2FwcC1jdHJsLWhvdGtleS0zJywnYXBwLWN0cmwtaG90a2V5LTQnLCdhcHAtY3RybC1ob3RrZXktNScsXG4gICAgJ2FwcC1jdHJsLWhvdGtleS02JywnYXBwLWN0cmwtaG90a2V5LTcnLCdhcHAtY3RybC1ob3RrZXktOCcsJ2FwcC1jdHJsLWhvdGtleS05JyxcbiAgICAnYXBwLWhvdGtleS0xJywnYXBwLWhvdGtleS0xMCcsJ2FwcC1ob3RrZXktMicsJ2FwcC1ob3RrZXktMycsJ2FwcC1ob3RrZXktNCcsJ2FwcC1ob3RrZXktNScsJ2FwcC1ob3RrZXktNicsJ2FwcC1ob3RrZXktNycsJ2FwcC1ob3RrZXktOCcsJ2FwcC1ob3RrZXktOScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktMScsJ2FwcC1zaGlmdC1ob3RrZXktMTAnLCdhcHAtc2hpZnQtaG90a2V5LTInLCdhcHAtc2hpZnQtaG90a2V5LTMnLCdhcHAtc2hpZnQtaG90a2V5LTQnLCdhcHAtc2hpZnQtaG90a2V5LTUnLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTYnLCdhcHAtc2hpZnQtaG90a2V5LTcnLCdhcHAtc2hpZnQtaG90a2V5LTgnLCdhcHAtc2hpZnQtaG90a2V5LTknLCdzaG9ydGN1dCddXG5cbmNvbnN0IGdub21lV2F5bGFuZEtleWJpbmRpbmdzID0gWydzd2l0Y2gtdG8tc2Vzc2lvbi0xJywnc3dpdGNoLXRvLXNlc3Npb24tMicsJ3N3aXRjaC10by1zZXNzaW9uLTMnLCdzd2l0Y2gtdG8tc2Vzc2lvbi00Jywnc3dpdGNoLXRvLXNlc3Npb24tNScsJ3N3aXRjaC10by1zZXNzaW9uLTYnLCdzd2l0Y2gtdG8tc2Vzc2lvbi03Jywnc3dpdGNoLXRvLXNlc3Npb24tOCcsJ3N3aXRjaC10by1zZXNzaW9uLTknLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMCcsJ3N3aXRjaC10by1zZXNzaW9uLTExJywnc3dpdGNoLXRvLXNlc3Npb24tMTInIF1cblxubGV0IGNsaXBib2FyZEludGVydmFsXG5sZXQgY29uZmlnU3RvcmUgPSB7XG4gICAgbGludXg6IHt9LFxuICAgIHdpbmRvd3M6IHt9LFxuICAgIG1hY29zOiB7fVxufVxuXG4vLyBsaXN0IG9mIGFwcHMgd2UgZG8gbm90IHdhbnQgdG8gcnVuIGluIGJhY2tncm91bmRcbmNvbnN0IGFwcHNUb0Nsb3NlID0gWydjaGF0Z3B0JywnQ2hhdEdQVCcsJ05vcnRvblNlY3VyaXR5JywnTkFWJywnVGVhbXMnLCdtcy10ZWFtcycsICd6b29tLnVzJywgJ0dvb2dsZSBDaHJvbWUnLCAnTWljcm9zb2Z0IEVkZ2UnLCAnTWljcm9zb2Z0IFRlYW1zJywnZmlyZWZveCcsICdkaXNjb3JkJywgJ3pvb20nLCAnY2hyb21lJywgJ21zZWRnZScsICd0ZWFtcycsICd0ZWFtdmlld2VyJywgJ2dvb2dsZS1jaHJvbWUnLCdza3lwZWZvcmxpbnV4Jywnc2t5cGUnLCdicmF2ZScsJ29wZXJhJywnYW55ZGVzaycsJ3NhZmFyaSddO1xuXG5sZXQgaXNLREUgPSBmYWxzZVxubGV0IGlzR05PTUUgPSBmYWxzZVxuXG5jaGlsZFByb2Nlc3MuZXhlYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGV4ZWMgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICByZXR1cm47XG4gICAgfSBcbiAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHsgaXNLREUgPSB0cnVlIH0gXG4gICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdHTk9NRScpIHsgaXNHTk9NRSA9IHRydWUgfVxufSk7XG5cblxuXG5cbmZ1bmN0aW9uIGVuYWJsZVJlc3RyaWN0aW9ucyh3aW5oYW5kbGVyKXtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7cmV0dXJufVxuICAgIFxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIHBsYXRmb3JtIHJlc3RyaWN0aW9uc1wiKVxuXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHtjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4ge2NvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7Y29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHtjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyl9KTtcbiAgICBcbiAgICBjbGlwYm9hcmQuY2xlYXIoKSAgLy90aGlzIHNob3VsZCBjbGVhbiB0aGUgY2xpcGJvYXJkIGZvciB0aGUgZWxlY3Ryb24gYXBwXG4gIFxuICAgIGNsaXBib2FyZEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UoICgpPT4geyAgY2xpcGJvYXJkLmNsZWFyKCk7fSAgLCAxMDAwKVxuICAgIGNsaXBib2FyZEludGVydmFsLnN0YXJ0KClcblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqXG4gICAgICogTCBJIE4gVSBYXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmlyc3QgY2hlY2sgaWYgcHJvY2VzcyBleGlzdHMsIHRoZW4ga2lsbCBpdFxuICAgICAgICAgICAgICAgIC8vIFVzZSBwZ3JlcCB0byBmaW5kIHByb2Nlc3NlcyBieSBuYW1lIChjYXNlLWluc2Vuc2l0aXZlLCBwcm9jZXNzIG5hbWUgb25seSwgbm90IGZ1bGwgY29tbWFuZCBsaW5lKVxuICAgICAgICAgICAgICAgIC8vIFdpdGhvdXQgLWYgZmxhZywgcGdyZXAgb25seSBzZWFyY2hlcyBwcm9jZXNzIG5hbWVzLCBub3QgY29tbWFuZCBsaW5lc1xuICAgICAgICAgICAgICAgIC8vIFRoaXMgYXZvaWRzIGtpbGxpbmcgcHJvY2Vzc2VzIHRoYXQgb25seSBjb250YWluIHRoZSBhcHAgbmFtZSBpbiB0aGVpciBjb21tYW5kIGxpbmUgKGUuZy4gQ3Vyc29yIGNvbnRhaW5pbmcgXCJjaHJvbWVcIilcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cImAsIChwZ3JlcEVycm9yLCBzdGRvdXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwZ3JlcEVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQcm9jZXNzIGZvdW5kLCBub3cga2lsbCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCIgfCB4YXJncyAtciBraWxsIC05YCwgKGtpbGxFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgha2lsbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHBncmVwIHJldHVybnMgZXJyb3Igb3Igbm8gb3V0cHV0LCBwcm9jZXNzIGRvZXNuJ3QgZXhpc3QgLSBubyBsb2dnaW5nIG5lZWRlZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICB9XG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gUExBU01BU0hFTExcbiAgICAgICAgLy8vLy8vLy8vLy8vLy9cblxuICAgICAgICBpZiAoaXNLREUpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEtERSByZXN0cmljdGlvbnNcIilcbiAgICAgICAgICAgIC8vIHJlYWQgYW5kIHNhdmUgY3VycmVudCBjb25maWdcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3JlYWRjb25maWc1JywgWyctLWZpbGUnLCAna3dpbnJjJywgJy0tZ3JvdXAnLCAnRGVza3RvcHMnLCAnLS1rZXknLCAnTnVtYmVyJ10sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoa3JlYWRjb25maWcpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSAxXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IHN0ZG91dC50cmltKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vZGlzYWJsZSBNRVRBIEtleSBmb3IgTGF1bmNoZXJtZW51IFxuXG4gICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHJlY29uZmlndXJpbmcga3dpbmApOyBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCBgJHtjb25maWcuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywgJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJ1wiXCInXSkgICAgICAgICAgICAgIFxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGBrd2lucmNgLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsJzEnXSkgIC8vcmVtb3ZlIHZpcnR1YWwgZGVza3RvcHNcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSkgICAvLyBkYXMgcmVsb2FkZWQgYWxsZSBjb25maWdzIHVuZCB3XHUwMEZDcmRlIGF1Y2ggYW5kZXJlIHNldHRpbmdzIG5ldSBsYWRlbiBzbyB3aWUga2dsb2FsYWNjZWwgdW5kIGtsaXBlclxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdzZXRDdXJyZW50RGVza3RvcCcsJzEnXSkgIC8vIHNldHp0IGRpZSBha3R1ZWxsZSBkZXNrdG9wIGF1ZiAxXG4gICAgICAgICAgIFxuICAgICAgICAgICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGVmZmVjdHNgICApXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdkZXNrdG9wZ3JpZCddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ3NjcmVlbmVkZ2UnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdvdmVydmlldyddKTtcblxuICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBhZGRpdGlvbmFsIHR0eSdzYCAgKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnc3J2cmtleXM6bm9uZSddKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKVxuXG5cbiAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xlYXJpbmcgY2xpcGJvYXJkIGhpc3RvcnlgICApXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pIC8vIENsZWFyIENsaXBib2FyZCBoaXN0b3J5IFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCAoKSA9PiB7ICAvL25lZWRzIHRpbWVvdXQgb3RoZXJ3aXNlIGt3aW4gL3JlY29uZmlndXJlIHdpbGwgcmVzZXQgaXRcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBnbG9iYWwga2V5Ym9hcmRzaG9ydGN1dHNgICApXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdvcmcua2RlLktHbG9iYWxBY2NlbC5ibG9ja0dsb2JhbFNob3J0Y3V0cycsICd0cnVlJ10pIC8vIFRlbXBvcmFyaWx5IGRlYWN0aXZhdGUgQUxMIGdsb2JhbCBrZXlib2FyZHNob3J0Y3V0cyBcbiAgICAgICAgICAgIH0sIDIwMDApXG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICBcbiAgICAgICAgXG5cbiAgIFxuICAgICAgIFxuXG5cbiAgICAgICAgLy8vLy8vLy8vL1xuICAgICAgICAvLyBHTk9NRVxuICAgICAgICAvLy8vLy8vLy8vL1xuXG4gICAgICAgIC8vd2UgcHJvYmFibHkgc2hvdWxkIGRvIGl0IHRoZSBcIndpbmRvd3MgLSB3YXlcIiBhbmQganVzdCBraWxsIGdub21lc2hlbGwgZm9yIGFzIGxvbmcgYXMgdGhlIGV4YW0tbW9kZSBpcyBhY3RpdmVcbiAgICAgICAgLy9idXQgaXQgc2VlbXMgdGhlcmUgaXMgbm8gY29udmVuaWVudCB3YXkgdG8ga2lsbCBnbm9tZS1zaGVsbCB3aXRob3V0IGFsbCBhcHBsaWNhdGlvbnMgc3RhcnRlZCBvbiB0b3Agb2YgaXQgXG4gICAgICAgICAvLyBmb3IgZ25vbWUzIHdlIG5lZWQgdG8gc2V0IGV2ZXJ5IGtleSBpbmRpdmlkdWFsbHkgPT4gcmVzZXQgd2lsbCBvYnZpb3VzbHkgc2V0IGRlZmF1bHRzIChzbyB3ZSBtYXkgbWVzcyB1cCBjdXN0b21pemVkIHNob3J0Y3V0cyBoZXJlKVxuICAgICAgICAvLyBwb3NzaWJsZSBmaXg6IGluc3RlYWQgb2Ygc2V0ID4gcmVzZXQgd2UgY291bGQgdXNlIGdldCAtIHNldCAtIHNldC4uIGZpcnN0IGdldCB0aGUgY3VycmVudCBiaW5kaW5ncyBhbmQgc3RvcmUgdGhlbSAtIHRoZW4gc2V0IHRvIG5vdGhpbmcgLSB0aGVuIHNldCB0byBwcmV2aW91cyBzZXR0aW5nXG4gICAgICAgICAgICBcbiAgICAgICAgaWYgKGlzR05PTUUpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEdOT01FIHJlc3RyaWN0aW9uc1wiKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKXtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKXtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyl7ICAvLyB3ZSBjb3VsZCB1c2UgZ3NldHRpbmdzIHJlc2V0LXJlY3Vyc2l2ZWx5IG9yZy5nbm9tZS5zaGVsbCB0byByZXNldCBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gLCBgWycnXWBdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCBgb3ZlcmxheS1rZXlgLCBgJydgXSkgIC8vIGtpbmQgb2YgdGhlIG1lbnUga2V5XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLm11dHRlciBkeW5hbWljLXdvcmtzcGFjZXMgZmFsc2UnKSAgLy8gZGVhY3RpdmF0ZSBtdWx0aXBsZSBkZXNrdG9wc1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5kZXNrdG9wLndtLnByZWZlcmVuY2VzIG51bS13b3Jrc3BhY2VzIDEnKSAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHsgLy8gY2xlYXIgY2xpcGJvYXJkICAodGhpcyB3aWxsIGZhaWwgdW5sZXNzIHhjbGlwIG9yIHhzZWxsIGFyZSBpbnN0YWxsZWQpXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pICAgLy8gd2F5bGFuZFxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJylcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKSB9XG4gICAgICAgIFxuICAgICAgICBcbiAgICB9XG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqICBXIEkgTiBEIE8gVyBTXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAvL2Jsb2NrIGltcG9ydGFudCBrZXlib2FyZCBzaG9ydGN1dHMgKGRpc2FibGUtc2hvcnRjdXRzLmV4ZSBpcyBhIHNlbGZtYWRlIEMgYXBwbGljYXRpb24gLSBzaG9ydGN1dHMgYXJlIGhhcmRjb2RlZCB0aGVyZSAtIG5lZWQgdG8gcmVidWlsZCBpZiBhZGRpbmcgc2hvcnRjdXRzKVxuICAgICAgICB0cnkgeyAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRhYmxlMSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2Rpc2FibGUtc2hvcnRjdXRzLmV4ZScpXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTEsIFtdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScsIHNoZWxsOiBmYWxzZSwgd2luZG93c0hpZGU6IHRydWV9KVxuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luZG93cyBzaG9ydGN1dHMgZGlzYWJsZWRcIilcbiAgICAgICAgICAgIC8vc3VicHJvY2Vzcy51bnJlZigpOyAgLy9jb21wbGV0ZWx5IGRldGFjaFxuICAgICAgICB9IGNhdGNoIChlcnIpe2xvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBzaG9ydGN1dHMpOiAke2Vycn1gKTt9XG4gICAgICAgIFxuXG4gICAgICAgIC8vY2xlYXIgY2xpcGJvYXJkIC0gc3RvcCBjb3B5IGJlZm9yZSBhbmQgcGFzdGUgYWZ0ZXIgZXhhbXN0YXJ0XG4gICAgICAgIC8vIHRyeSB7XG4gICAgICAgIC8vICAgICBsZXQgZXhlY3V0YWJsZTAgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9jbGVhci1jbGlwYm9hcmQuYmF0JylcbiAgICAgICAgLy8gICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMCwgW10sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgLy8gICAgICAgICBpZiAoZXJyb3IpICB7ICBcbiAgICAgICAgLy8gICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAod2luIGNsaXBib2FyZCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgLy8gICAgICAgICB9XG4gICAgICAgIC8vICAgICB9KVxuICAgICAgICAvLyB9IGNhdGNoIChlcnIpe2xvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBjbGlwYm9hcmQpOiAke2Vycn1gKTt9XG4gICAgICAgXG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgICAgICAvLyBFc2NhcGUgYXBwIG5hbWUgZm9yIFBvd2VyU2hlbGwgLSByZXBsYWNlIHNpbmdsZSBxdW90ZXMgd2l0aCBkb3VibGUgc2luZ2xlIHF1b3Rlc1xuICAgICAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRBcHAgPSBhcHAucmVwbGFjZSgvJy9nLCBcIicnXCIpO1xuICAgICAgICAgICAgICAgIC8vIFBvd2VyU2hlbGwgY29tbWFuZDogc2V0IGFwcCBuYW1lIGFzIHZhcmlhYmxlIGZpcnN0IHRvIGF2b2lkIHN0cmluZyBpbnRlcnBvbGF0aW9uIGlzc3Vlc1xuICAgICAgICAgICAgICAgIC8vIFVzZXMgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgdG8gaGFuZGxlIGFjY2VzcyBkZW5pZWQgYW5kIG90aGVyIGVycm9ycyBncmFjZWZ1bGx5XG4gICAgICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkYXBwTmFtZSA9ICcke2VzY2FwZWRBcHB9JzsgdHJ5IHsgJHByb2NzID0gR2V0LVByb2Nlc3MgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyAkXy5Qcm9jZXNzTmFtZSAtaWxpa2UgKCcqJyArICRhcHBOYW1lICsgJyonKSB9OyBpZiAoJHByb2NzIC1hbmQgJHByb2NzLkNvdW50IC1ndCAwKSB7ICRwcm9jcyB8IFN0b3AtUHJvY2VzcyAtRm9yY2UgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWU7IFdyaXRlLU91dHB1dCAna2lsbGVkJyB9IH0gY2F0Y2ggeyB9XCJgO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKS5pbmNsdWRlcygna2lsbGVkJykpIHsgLy8gc3VjY2VzcyAtIHByb2Nlc3Mgd2FzIGZvdW5kIGFuZCBraWxsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIHByb2Nlc3MgZm91bmQgb3Igb3RoZXIgZXJyb3JzIGFyZSBzaWxlbnRseSBpZ25vcmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgIH1cbiAgICAgICAgICBcblxuXG4gICAgICAgIC8vbXVzdCBiZSB0ZXN0ZWQgYmVjYXVzZSBpdHMgZGFuZ2Vyb3VzIC0gaSBwb3RlbnRpYWxseSBraWxscyB1bndhbnRlZCBwcm9jZXNzZXMgYmVjYXVzZSBpdCBzZWFyY2hlcyBmb3Igc3Vic3RyaW5ncyBpbiBwcm9jZXNzIG5hbWVzXG4gICAgICAgIC8vIHRyeSB7XG4gICAgICAgIC8vICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgIC8vICAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgfCBXaGVyZS1PYmplY3QgeyAkXy5OYW1lIC1saWtlICcqJHthcHB9KicgfSB8IEZvckVhY2gtT2JqZWN0IHsgJF8uS2lsbCgpIH1cImA7XG4gICAgICAgIC8vICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAvLyAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgRXJyb3IgY2xvc2luZyBhcHA6ICR7YXBwfWAsIGVycm9yKTtcbiAgICAgICAgLy8gICAgICAgICAgICAgfVxuICAgICAgICAvLyAgICAgICAgICAgICBpZiAoc3RkZXJyKSB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHN0ZGVycjogJHtzdGRlcnJ9YCk7XG4gICAgICAgIC8vICAgICAgICAgICAgIH1cbiAgICAgICAgLy8gICAgICAgICAgICAgaWYgKHN0ZG91dCkge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHN0ZG91dDogJHtzdGRvdXR9YCk7XG4gICAgICAgIC8vICAgICAgICAgICAgIH1cbiAgICAgICAgLy8gICAgICAgICB9KTtcbiAgICAgICAgLy8gICAgIH0pO1xuICAgICAgICAvLyB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKFBvd2VyU2hlbGwpOiAke2Vycn1gKTtcbiAgICAgICAgLy8gfVxuXG5cblxuXG4gICAgICAgIC8vIGtpbGwgRVhQTE9SRVIgd2luZG93c2J1dHRvbiBhbmQgc3dpcGUgZ2VzdHVyZXMgLSBraWxsIGV2ZXJ5dGhpbmcgZWxzZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2traWxsIC9mIC9pbSBleHBsb3Jlci5leGUnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgdGFza2tpbGwgd2FzIHN1Y2Nlc3NmdWwgKHByb2Nlc3MgZm91bmQgYW5kIGtpbGxlZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZXhwbG9yZXIuZXhlYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIElmIGVycm9yIChlLmcuIHByb2Nlc3Mgbm90IGZvdW5kKSwgc2lsZW50bHkgaWdub3JlIC0gbm8gbG9nZ2luZyBuZWVkZWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpe1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG4gICAgLyoqXG4gICAgICogTSBBIEMgTyBTICBcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgY29uc3QgeyBUb3VjaEJhckxhYmVsLCBUb3VjaEJhckJ1dHRvbiwgVG91Y2hCYXJTcGFjZXIgfSA9IFRvdWNoQmFyXG4gICAgICAgIGNvbnN0IHRleHRsYWJlbCA9IG5ldyBUb3VjaEJhckxhYmVsKHtsYWJlbDogXCJOZXh0LUV4YW1cIn0pXG4gICAgICAgIGNvbnN0IHRvdWNoQmFyID0gbmV3IFRvdWNoQmFyKHtcbiAgICAgICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgdGV4dGxhYmVsLFxuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Py5zZXRUb3VjaEJhcih0b3VjaEJhcilcblxuICAgICAgICAvLyBjbGVhciBjbGlwYm9hcmRcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3BiY29weSA8IC9kZXYvbnVsbCcpXG5cbiAgICAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAgICAgLy8gcGtpbGwtQmVmZWhsIGZcdTAwRkNyIG1hY09TXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGtpbGwgLTkgLWYgXCIke2FwcH1cImAsIChlcnJvciwgc3RkZXJyLCBzdGRvdXQpID0+IHtcbiAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vbWlzc2lvbiBjb250cm9sXG4gICAgICAgIC8vbGV0IHNjcmlwdGZpbGUgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9tYy5hcHBlbHNjcmlwdCcpICAgLy9zcGFjZXMsIHNob3J0Y3V0c1xuICAgICAgICBsZXQgbWNzY3JpcHRmaWxlID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvc3BhY2VzLmFwcGxlc2NyaXB0JylcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7IG1jc2NyaXB0ZmlsZSA9IGpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljL3NwYWNlcy5hcHBsZXNjcmlwdCcpIH1cbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdvc2FzY3JpcHQnLCBbbWNzY3JpcHRmaWxlXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge2lmIChzdGRlcnIpIHsgbG9nLmluZm8oc3RkZXJyKSAgfSB9KVxuICAgIH1cbn1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbmZ1bmN0aW9uIGRpc2FibGVSZXN0cmljdGlvbnMoKXtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7cmV0dXJufVxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiByZW1vdmluZyByZXN0cmljdGlvbnMuLi5cIilcblxuICAgIGlmIChjbGlwYm9hcmRJbnRlcnZhbCkgeyAgICBcbiAgICAgICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RvcCgpXG4gICAgfVxuXG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4ge2NvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHtjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7Y29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4ge2NvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKX0pO1xuXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEwgSSBOIFUgWFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIC8vIG9uIHdheWxhbmRcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKVxuICAgICAgICAvLyBjbGVhciBjbGlwYm9hcmQgZ25vbWUgYW5kIHgxMSAgKHRoaXMgd2lsbCBmYWlsIHVubGVzcyB4Y2xpcCBvciB4c2VsbCBhcmUgaW5zdGFsbGVkKVxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJylcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJylcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJylcblxuICAgICAgICAvL2VuYWJsZSBNRVRBIEtleSBmb3IgTGF1bmNoZXJtZW51XG4gICAgICAgIC8vY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdzZWQnLCBbJy1pJywgJy1lJywgJ3MvZ2xvYmFsPS4qL2dsb2JhbD1BbHQrRjEvZycsIGAke2NvbmZpZy5ob21lZGlyZWN0b3J5fS8uY29uZmlnL3BsYXNtYS1vcmcua2RlLnBsYXNtYS5kZXNrdG9wLWFwcGxldHNyY2AgXSlcbiAgICAgICAgLy9jaGlsZFByb2Nlc3MuZXhlYygna3dpbiAtLXJlcGxhY2UgJicpXG5cbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdLREUnKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogS0RFIGRldGVjdGVkXCIpXG4gICAgICAgICAgICAgICAgLy8gQ2xlYXIgQ2xpcGJvYXJkIGhpc3RvcnkgXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKVxuICAgICAgICAgICAgICAgIC8vIHJlc2V0IGFsbCBzaG9ydGN1dHMgS0RFXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdibG9ja0dsb2JhbFNob3J0Y3V0cycsICdmYWxzZSddKVxuICAgICAgICAgICAgICAgIC8vIGFjdGl2YXRlIEFMTCAzZCBFZmZlY3RzIChwcmVzZW50IHdpbmRvdywgY2hhbmdlIGRlc2t0b3AsIGV0Yy4pIFxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicgLCcvQ29tcG9zaXRvcicsICdvcmcua2RlLmt3aW4uQ29tcG9zaXRpbmcucmVzdW1lJ10pXG4gICAgICAgICAgICAgICAgLy8gcmVhY3RpdmF0ZSBzaG9ydGN1dHNzeXN0ZW1cbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBrZ2xvYmFsYWNjZWw1JicpXG4gICAgICAgICAgICAgICAgLy8gZW5hYmxlIG1ldGEga2V5LCBrd2luIGFuZCByZXN0YXJ0IHBsYXNtYXNoZWxsXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGAke2NvbmZpZy5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCctLWRlbGV0ZSddKSBcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYGt3aW5yY2AsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJyxjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzXSkgIC8vYWRkIHByZXZpb3VzIHZpcnR1YWwgZGVza3RvcHNcblxuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnJ10pXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKVxuICAgIFxuXG5cblxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSlcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IHBsYXNtYXNoZWxsICYnLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFjaGVkOiB0cnVlLCAgICAgICAgICAgICAgIC8vIHJ1biBpbmRlcGVuZGVudGx5XG4gICAgICAgICAgICAgICAgICAgIHN0ZGlvOiAnaWdub3JlJyAgICAgICAgICAgICAgIC8vIGRpc2Nvbm5lY3Qgc3RkaW9cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpOyAgICAgICAgICAgICAgICAgIC8vIGZ1bGx5IGRldGFjaCBwcm9jZXNzXG4gICAgICAgICAgICB9IFxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8vIHJlc2V0IHNwZWNpZmljIHNob3J0Y3V0cyBHTk9NRVxuICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSlcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSlcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YF0pXG4gICAgICAgIH1cbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCBgb3ZlcmxheS1rZXlgXSlcblxuICAgIH1cblxuXG4gICAgLyoqKioqKioqKioqKioqKipcbiAgICAgKiAgVyBJIE4gRCBPIFcgU1xuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgLy8gdW5ibG9jayBpbXBvcnRhbnQga2V5Ym9hcmQgc2hvcnRjdXRzIChkaXNhYmxlLXNob3J0Y3V0cy5leGUpXG4gICAgICAgIC8vIGhpZXIgZ2lidCBlcyBpcmdlbmRlaW5lIHJhY2UgY29uZGl0aW9uIG9kZXIgYWJoXHUwMEU0bmdpZ2tlaXQgdm9uIGV4cGxvcmVyLmV4ZS4gIGVpbmZhY2ggcmVpaGVuZm9sZ2UgdW1rZWhyZW4gdW5kIGVpbiB0aW1lb3V0IHNldHplblxuXG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiB1bmJsb2NraW5nIHNob3J0Y3V0cy4uLlwiKVxuICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGB0YXNra2lsbCAgL0lNIFwiZGlzYWJsZS1zaG9ydGN1dHMuZXhlXCIgL1QgL0ZgLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIHRhc2traWxsIHdhcyBzdWNjZXNzZnVsIChwcm9jZXNzIGZvdW5kIGFuZCBraWxsZWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBkaXNhYmxlLXNob3J0Y3V0cy5leGVgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gSWYgZXJyb3IgKGUuZy4gcHJvY2VzcyBub3QgZm91bmQpLCBzaWxlbnRseSBpZ25vcmUgLSBubyBsb2dnaW5nIG5lZWRlZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1jYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IGV4cGxvcmVyLmV4ZSB3aW5kb3dzc2hlbGwgYWdhaW5cbiAgICAgICAgLy8gXHUwMERDYmVycHJcdTAwRkNmZSwgb2IgZXhwbG9yZXIuZXhlIGxcdTAwRTR1ZnRcbiAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIGV4cGxvcmVyLmV4ZVwiJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHRhc2tsaXN0IGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUHJcdTAwRkNmZSwgb2IgXCJleHBsb3Jlci5leGVcIiBpbiBkZXIgQXVzZ2FiZSB2b3JoYW5kZW4gaXN0XG4gICAgICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMoJ2V4cGxvcmVyLmV4ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN0YXJ0ZSBleHBsb3Jlci5leGUsIHdlbm4gZXMgbmljaHQgbFx1MDBFNHVmdFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogcmVzdGFydGluZyBleHBsb3Jlci4uLlwiKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdzdGFydCBleHBsb3Jlci5leGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZSwgICAgICAgICAgICAgICAvLyBydW4gaW5kZXBlbmRlbnRseVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RkaW86ICdpZ25vcmUnICAgICAgICAgICAgICAgLy8gZGlzY29ubmVjdCBzdGRpb1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpOyAgICAgICAgICAgICAgICAgIC8vIGZ1bGx5IGRldGFjaCBwcm9jZXNzXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfWNhdGNoKGUpe2xvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gZXhwbG9yZXIpOiAke2UubWVzc2FnZX1gKX1cblxuXG4gICAgICAgIC8vIHRyeXtcbiAgICAgICAgLy8gICAgIC8vY2xlYXIgY2xpcGJvYXJkIC0gc3RvcCBrZWVwaW5nIHNjcmVlbnNob3RzIG9mIGV4YW0gaW4gY2xpcGJvYXJkXG4gICAgICAgIC8vICAgICBsZXQgZXhlY3V0YWJsZTAgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9jbGVhci1jbGlwYm9hcmQuYmF0JylcbiAgICAgICAgLy8gICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMCwgW10sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgLy8gICAgICAgICBpZiAoc3RkZXJyKSB7IGxvZy5pbmZvKHN0ZGVycikgfVxuICAgICAgICAvLyAgICAgICAgIGlmIChlcnJvcikgeyBsb2cuaW5mbyhlcnJvcikgfVxuICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgLy8gfWNhdGNoKGUpe2xvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gY2xpcGJvYXJkKTogJHtlLm1lc3NhZ2V9YCl9XG5cbiAgICB9XG5cbiAgICAvLyBUT0RPOiB1bmRvIHJlc3RyaWN0aW9ucyBtYWMgKGN1cnJlbnRseSBvbmx5IHRvdWNoYmFyIHdoaWNoIHNob3VsZCBiZSByZXNldCBvbmNlIHdlIGNsb3NlIG5leHQtZXhhbSlcbn1cblxuZXhwb3J0IHtlbmFibGVSZXN0cmljdGlvbnMsIGRpc2FibGVSZXN0cmljdGlvbnN9XG4iLCAiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cblxubGV0IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpXG5pZiAoYXBwLmlzUGFja2FnZWQpIHsgbGFuZ3VhZ2VUb29sSmFyUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMvTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJykgfVxuXG5sZXQgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJylcbmlmIChhcHAuaXNQYWNrYWdlZCkgeyBsYW5ndWFnZVRvb2xDb25maWdQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYy9MYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKSB9XG5cblxuXG5cblxuY2xhc3MgTGFuZ3VhZ2VUb29sU2VydmVyIHtcbiAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBJbml0aWFsaXNpZXJ0IGRpZSBQcm96ZXNzdmFyaWFibGVcbiAgICAgICAgIHRoaXMucG9ydCA9IDgwODhcbiAgICAgfVxuIFxuICAgICBzdGFydFNlcnZlcigpIHtcbiAgICAgICAgIGlmICh0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgJiYgIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nLicpO1xuICAgICAgICAgICAgIHJldHVybjsgLy8gVmVyaGluZGVydCBkYXMgZXJuZXV0ZSBTdGFydGVuLCB3ZW5uIGRlciBTZXJ2ZXIgYmVyZWl0cyBsXHUwMEU0dWZ0XG4gICAgICAgICB9XG4gICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gSnJlSGFuZGxlci5qU3Bhd24oXG4gICAgICAgICAgICAgICAgW2xhbmd1YWdlVG9vbEphclBhdGhdLCAvLyBLbGFzc2VucGZhZFxuICAgICAgICAgICAgICAgICdvcmcubGFuZ3VhZ2V0b29sLnNlcnZlci5IVFRQU2VydmVyJywgLy8gSGF1cHRrbGFzc2UgZGVyIExhbmd1YWdlVG9vbCBBUElcbiAgICAgICAgICAgICAgICBbJy0tcG9ydCcsIHRoaXMucG9ydCwnLS1jb25maWcnLGxhbmd1YWdlVG9vbENvbmZpZ1BhdGgsICctLWFsbG93LW9yaWdpbicsIFwiJyonXCIgXSAvLyBadXNcdTAwRTR0emxpY2hlIEFyZ3VtZW50ZSwgei5CLiBQb3J0IHVuZCBDT1JTLUVybGF1Ym5pc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcylcbiAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIEFQSSBydW5uaW5nIGF0IGxvY2FsaG9zdDo4MDg4Jyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCBkYXRhID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhOiBSZWNlaXZlZCBkYXRhIGZyb20gTGFuZ3VhZ2VUb29sIEFQSScsIGRhdGEudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXJyb3InKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtZXJyb3I6Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdGFydGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY2hlY2sgZG9uZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFuZGxlZCByZXF1ZXN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIEFjY3VtdWxhdGUgc3RkZXJyIGRhdGEgdG8gaGFuZGxlIGNodW5rZWQgb3V0cHV0XG4gICAgICAgICAgICBsZXQgc3RkZXJyQnVmZmVyID0gJyc7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyICs9IGNodW5rO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcodGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBib3RoIGN1cnJlbnQgY2h1bmsgYW5kIGFjY3VtdWxhdGVkIGJ1ZmZlciBmb3IgcG9ydC1yZWxhdGVkIGVycm9yc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXNwb25zZSA9IHN0ZGVyckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcnRFcnJvciA9IGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhwb3J0U3RyKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRyZXNzZSB3aXJkIGJlcmVpdHMgdmVyd2VuZGV0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJNYXliZSBzb21ldGhpbmcgZWxzZSBpcyBydW5uaW5nIG9uIHRoYXQgcG9ydFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoaXNQb3J0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBhbm90aGVyIExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgcHJvYmFibHkgYWxyZWFkeSBydW5uaW5nIG9uIHBvcnQ6JywgdGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsuaW5jbHVkZXMoJ1xcbicpIHx8IGZ1bGxSZXNwb25zZS5sZW5ndGggPiAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIHdlIGhhdmUgYSBuZXdsaW5lIChsaWtlbHkgY29tcGxldGUgbWVzc2FnZSkgb3IgYnVmZmVyIGlzIGdldHRpbmcgbGFyZ2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhLWVycm9yOicsIGZ1bGxSZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBTZXR6dCBkZW4gUHJvemVzcyB6dXJcdTAwRkNjaywgd2VubiBlciBiZWVuZGV0IHdpcmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGdlbmVyYWwtZXJyb3I6JywgZXJyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgfVxuXG4gICAgIHN0b3BTZXJ2ZXIoKSB7XG4gICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcykge1xuICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkLCBub3RoaW5nIHRvIHN0b3AnKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZpcnN0IHRyeSB0byBraWxsIHRoZSBwcm9jZXNzIGRpcmVjdGx5IGlmIHdlIGhhdmUgYSByZWZlcmVuY2VcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mga2lsbGVkJyk7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGZhaWxlZCB0byBraWxsIHByb2Nlc3MgZGlyZWN0bHksIHRyeWluZyBwbGF0Zm9ybS1zcGVjaWZpYyBtZXRob2Q6JywgZXJyKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgcGxhdGZvcm0tc3BlY2lmaWMgY29tbWFuZHMgdG8ga2lsbCB0aGUgcHJvY2VzcyAob25seSBpZiB3ZSBoYWQgYSBwcm9jZXNzIHJlZmVyZW5jZSlcbiAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgIGxldCBjb21tYW5kO1xuXG4gICAgICAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAvLyBXaW5kb3dzOiBmaW5kIGFuZCBraWxsIGphdmEgcHJvY2Vzc2VzIHJ1bm5pbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgd21pYyAod29ya3Mgb24gb2xkZXIgV2luZG93cyksIHRoZW4gdHJ5IFBvd2VyU2hlbGwsIHRoZW4gZmFsbGJhY2sgdG8gcG9ydC1iYXNlZCBraWxsXG4gICAgICAgICAgICAgY29tbWFuZCA9IGB3bWljIHByb2Nlc3Mgd2hlcmUgXCJjb21tYW5kbGluZSBsaWtlICclbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIlJ1wiIGRlbGV0ZSAyPm51bCB8fCBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgamF2YSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7JF8uQ29tbWFuZExpbmUgLWxpa2UgJypsYW5ndWFnZXRvb2wtc2VydmVyLmphcionfSB8IFN0b3AtUHJvY2VzcyAtRm9yY2VcIiAyPm51bCB8fCBmb3IgL2YgXCJ0b2tlbnM9NVwiICVhIGluICgnbmV0c3RhdCAtYW5vIF58IGZpbmRzdHIgOjgwODgnKSBkbyB0YXNra2lsbCAvRiAvUElEICVhIDI+bnVsYDtcbiAgICAgICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8IHBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgICAgLy8gbWFjT1MgYW5kIExpbnV4OiB1c2UgcGtpbGwgdG8ga2lsbCBwcm9jZXNzZXMgbWF0Y2hpbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICBjb21tYW5kID0gJ3BraWxsIC1mIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJztcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IHVuc3VwcG9ydGVkIHBsYXRmb3JtOicsIHBsYXRmb3JtKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIGV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAvLyBJdCdzIG9rYXkgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGZvdW5kIChhbHJlYWR5IGtpbGxlZClcbiAgICAgICAgICAgICAgICAgLy8gcGtpbGwgcmV0dXJucyBjb2RlIDEgd2hlbiBubyBwcm9jZXNzIGlzIGZvdW5kLCB3aGljaCBpcyBleHBlY3RlZFxuICAgICAgICAgICAgICAgICBpZiAoZXJyb3IuY29kZSAhPT0gMSAmJiAhZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnbm90IGZvdW5kJykgJiYgIXN0ZGVyci50b1N0cmluZygpLmluY2x1ZGVzKCdObyBzdWNoIHByb2Nlc3MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGVycm9yIGtpbGxpbmcgTGFuZ3VhZ2VUb29sIHNlcnZlcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mgbm90IGZvdW5kIChtYXkgYWxyZWFkeSBiZSBzdG9wcGVkKScpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgc3RvcHBlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgIH0pO1xuICAgICB9XG4gfVxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTGFuZ3VhZ2VUb29sU2VydmVyKClcblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBwcm9jZXNzIGZyb20gJ3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4gLy8gZXZlcnkgcGxhdGZvcm0gbmVlZHMgaXQncyBvd24ganJlIChsaW51eCwgd2luMzIsIGRhcndpbikgLy9maXhtZTogdXNlIEdyYWFsVk0gdG8gcHJlY29tcGlsZSBsYW5ndWFnZXRvb2wgaW4gb3JkZXIgdG8gc2F2ZSBzcGFjZSBhbmQgZ2V0IHJpZCBvZiBqcmU/XG5jbGFzcyBKcmVIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7IH1cblxuICAgIGluaXQoKXsgXG4gICAgICAgIHRoaXMualRlc3QoKVxuICAgIH1cblxuICAgIGZhaWwocmVhc29uKSB7XG4gICAgICAgIGxvZy5lcnJvcihyZWFzb24pO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuXG4gICAgZ2V0RGlyZWN0b3JpZXMoZGlyUGF0aCkge1xuICAgICAgICBsZXQgZGlycyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpLmZpbHRlcihcbiAgICAgICAgICAgIGZpbGUgPT4gZnMuc3RhdFN5bmMocGF0aC5qb2luKGRpclBhdGgsIGZpbGUpKS5pc0RpcmVjdG9yeSgpXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBkaXJzXG4gICAgfSBcblxuICAgIGRyaXZlcigpe1xuICAgICAgICB2YXIgZCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5qYXZhQmluLnNsaWNlKCk7XG4gICAgICAgIGQudW5zaGlmdChwbGF0Zm9ybURpc3BhdGNoZXIuanJlRGlyKTtcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbi5hcHBseShwYXRoLCBkKTtcbiAgICB9XG5cbiAgICBnZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIGFyZ3MgPSAoYXJncyB8fCBbXSkuc2xpY2UoKTtcbiAgICAgICAgY2xhc3NwYXRoID0gY2xhc3NwYXRoIHx8IFtdO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NuYW1lKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzcGF0aC5qb2luKHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInID8gJzsnIDogJzonKSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCgnLWNwJyk7XG4gICAgICAgIHJldHVybiBhcmdzO1xuICAgIH1cblxuICAgIGpTcGF3bihjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKVxuICAgICAgICBsZXQgamF2YWFyZ3MgPSB0aGlzLmdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpXG4gICAgICAgIGxldCBqYXZhY21kbGluZSA9ICBgJHtqYXZhcGF0aH0gJHtqYXZhYXJncy5qb2luKCcgJyl9IGBcblxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246ICcke3BsYXRmb3JtRGlzcGF0Y2hlci5qcmV9JyBzZWxlY3RlZGApXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogc3Bhd25pbmcgamF2YSBwcm9jZXNzOiAke2phdmFjbWRsaW5lfWApXG4gICAgICAgIHJldHVybiBzcGF3bihqYXZhcGF0aCwgamF2YWFyZ3MsIHtzaGVsbDpmYWxzZX0pO1xuICAgICAgIC8vIHJldHVybiBzcGF3bihqYXZhY21kbGluZSk7XG4gICAgfVxuICAgIGpUZXN0KCl7XG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKCk7IC8vICcvcGZhZC96dXIvamF2YSdcbiAgICAgICAgY29uc3QgcHJvYyA9IHNwYXduKGphdmFwYXRoLCBbJy12ZXJzaW9uJ10pO1xuICAgIFxuICAgICAgICBwcm9jLnN0ZGVyci5vbignZGF0YScsIGRhdGEgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBkYXRhLnRvU3RyaW5nKCkuc3BsaXQoJ1xcbicpOyAvLyBpbiBaZWlsZW4gc3BsaXR0ZW5cbiAgICAgICAgICAgIGxvZy5kZWJ1ZyhganJlLWhhbmRsZXIgQCBqVGVzdDogJHtsaW5lc1swXX1gKTsgLy8gbnVyIGRpZSBlcnN0ZSBaZWlsZSBsb2dnZW5cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBKcmVIYW5kbGVyKClcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4ndXNlIHN0cmljdCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInICAgLy8gZGFzIG1hY2h0IGtyYXNzZXN0ZSByYWNlY29kaXRpb25zIG1pdCBlbGVjdHJvbiBlaWdlbmVuIHZlcnNpb25lbiAtIHVuYmVkaW5ndCBkaWUgc2VsYmUgdmVyc2lvbiBiZWhhbHRlbiB3aWUgZWxlY3Ryb25cbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBzY3JlZW4sIGlwY01haW4sIGFwcCwgQnJvd3NlcldpbmRvdywgd2ViQ29udGVudHMgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBzY3JlZW5zaG90IGZyb20gJ3NjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kJztcbmltcG9ydCB7IFdvcmtlciB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgcnVuUmVtb3RlQ2hlY2sgfSBmcm9tICcuL3JlbW90ZUNoZWNrLmpzJ1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5cbmNvbnN0IHNoZWxsID0gKGNtZCkgPT4geyAgIHJldHVybiBleGVjU3luYyhjbWQsIHsgZW5jb2Rpbmc6ICd1dGY4Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pOyB9OyAgLy8gc3RkZXJyIHVudGVyZHJcdTAwRkNja3QgXG5jb25zdCBhZ2VudCA9IG5ldyBodHRwcy5BZ2VudCh7IHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyBcblxuIC8qKlxuICAqIEhhbmRsZXMgaW5mb3JtYXRpb24gZmV0Y2hpbmcgZnJvbSB0aGUgc2VydmVyIGFuZCBhY3RzIG9uIHN0YXR1cyB1cGRhdGVzXG4gICovXG4gXG4gY2xhc3MgQ29tbUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IGZhbHNlXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMCAvLyB3ZSBjb3VudCBmYWlscyBhbmQgZGVhY3RpdmF0ZSBvbiA0IGNvbnNlcXVlbnQgZmFpbHNcbiAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IHRydWVcbiAgICAgICAgdGhpcy50aW1lciA9IDBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBudWxsXG4gICAgICAgIHRoaXMudXNlV29ya2VyID0gdHJ1ZVxuICAgICAgICB0aGlzLndvcmtlckZhaWxzID0gMFxuICAgIH1cbiBcbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnJlcXVlc3RVcGRhdGUuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRTY3JlZW5zaG90LmJpbmQodGhpcyksIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICBpZiAoIXRoaXMud29ya2VyICYmIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyAgdGhpcy5zZXR1cEltYWdlV29ya2VyKCkgIH1cbiAgICB9XG4gXG5cbiAgICAvKipcbiAgICAgKiBTZXR1cCB0aGUgaW1hZ2Ugd29ya2VyXG4gICAgICogdXNlcyBmb3JrIHRvIGNyZWF0ZSBhIG5ldyBjaGlsZCBwcm9jZXNzXG4gICAgICogdXNlcyB0aGUgaW1hZ2VXb3JrZXJMaW51eC5qcyBvciBpbWFnZVdvcmtlclNoYXJwLmpzIGZpbGVcbiAgICAgKiB0aGUgd29ya2VyIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzZXR1cEltYWdlV29ya2VyKCkge1xuICAgICAgICBjb25zdCB3b3JrZXJVUkwgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyVVJMO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlclVSTCwgeyB0eXBlOiAnbW9kdWxlJywgZW52OiB7IC4uLnByb2Nlc3MuZW52IH0gfSk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogSW1hZ2VXb3JrZXIgaW5pdGlhbGl6ZWQuIFVzaW5nIFwiICsgcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlckZpbGVOYW1lKVxuICAgICAgICBcblxuICAgICAgICB0aGlzLndvcmtlci5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlci5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlckZhaWxzICs9IDFcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53b3JrZXJGYWlscyA+IDQpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZmFpbGVkIDUgdGltZXMgLSBzd2l0Y2hpbmcgdG8gbm8gcHJvY2Vzc2luZycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBcbiAgICAgKiBpZiB1c2VXb3JrZXIgaXMgdHJ1ZSwgdGhlIHNjcmVlbnNob3QgaXMgcHJvY2Vzc2VkIGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqIG90aGVyd2lzZSB0aGUgc2NyZWVuc2hvdCBpcyBub3QgcHJvY2Vzc2VkIGFuZCB0aGUgb3JpZ2luYWwgc2NyZWVuc2hvdCBpcyByZXR1cm5lZFxuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NJbWFnZShpbWdCdWZmZXIpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy53b3JrZXIpIHsgLy90cmlwbGUgY2hlY2sgaWYgd29ya2VyIGlzIGluaXRpYWxpemVkXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXb3JrZXIgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7IGltZ0J1ZmZlcjogQXJyYXkuZnJvbShpbWdCdWZmZXIpLCBpbVZlcnNpb246IHBsYXRmb3JtRGlzcGF0Y2hlci5pbVZlcnNpb24gfSk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlci5vbmNlKCdtZXNzYWdlJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7IFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmFsbGJhY2sgdG8gbm8gcHJvY2Vzc2luZyAgIFxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltZ0J1ZmZlcikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyQmFzZTY0ID0gc2NyZWVuc2hvdEJhc2U2NFxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgc2NyZWVuc2hvdEJhc2U2NDogc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0OiBoZWFkZXJCYXNlNjQsIGlzYmxhY2s6IGZhbHNlLCBpbWdCdWZmZXI6IGltZ0J1ZmZlciB9O1xuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cbiAgICAvKiogXG4gICAgICogVXBkYXRlIGN1cnJlbnQgU2VydmVyc3RhdHVzICsgU3R1ZGVudHRzdGF0dXMgKGV2ZXJ5IDUgc2Vjb25kcylcbiAgICAgKi9cbiAgICBhc3luYyByZXF1ZXN0VXBkYXRlKCl7XG5cbiAgICAgICAgdGhpcy50aW1lcisrICAgLy8gd2UgdXNlIHRpbWVyIHRvIHRpbWUgbG9vcHMgd2l0aCBkaWZmZXJlbnQgaW50ZXJ2YWxzIHdpdGhvdXQgaW50cm9kdWNpbmcgbmV3IHVubmVjY2VzYXJ5IHNjaGVkdWxlcnNcbiAgICAgICAgaWYgKHRoaXMudGltZXIgJSAyMCA9PT0gMCApeyAgLy8gcnVuIGV2ZXJ5IDIwKjUgKHVwZGF0ZWxvb3ApIHNlY29uZHNcblxuICAgICAgICAgICAgY29uc3QgdXNlc1JlbW90ZUFzc2lzdGFudCA9IGF3YWl0IHJ1blJlbW90ZUNoZWNrKHByb2Nlc3MucGxhdGZvcm0pXG5cbiAgICAgICAgICAgIGlmICh1c2VzUmVtb3RlQXNzaXN0YW50KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZWFkeTogUG9zc2libGUgcmVtb3RlIGFzc2lzdGFuY2UgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5rZXl3b3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBLZXl3b3JkICR7a2V5d29yZH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb3J0IG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQucG9ydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogUG9ydCAke3BvcnR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50ID0gdXNlc1JlbW90ZUFzc2lzdGFudFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKCkgIC8vIGNoZWNrIGlmIHRoZXJlIGlzIGEgbmV3IHNjcmVlbiB0aGF0IG5lZWRzIHRvIGJlIGJsb2NrZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWQgIG5vIHNlcnZlcnNpZ25hbCBmb3IgMjAgc2Vjb25kc1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApeyAgXG4gICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBDb25uZWN0aW9uIHRvIFRlYWNoZXIgbG9zdCEgUmVtb3ZpbmcgcmVnaXN0cmF0aW9uLlwiKSAvL3JlbW92ZSBzZXJ2ZXIgcmVnaXN0cmF0aW9uIGxvY2FsbHkgKHNhbWUgYXMgJ2tpY2snKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICAgICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgICAvLyB0aGlzIGFsc28gcmVzZXRzIHNlcnZlcmlwIHRoZXJlZm9yZSBubyBhcGkgY2FsbHMgYXJlIG1hZGUgYWZ0ZXJ3YXJkc1xuICAgICAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAgICAgICAvLyBqdXN0IGluIGNhc2Ugc2NyZWVucyBhcmUgYmxvY2tlZC4uIGxldCBzdHVkZW50cyB3b3JrXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gIFxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0ge2NsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm99XG5cbiAgICAgICAgICAgIGZldGNoKGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVgLCB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7IH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICAgICAgKGRhdGEubWVzc2FnZSA9PT0gXCJub3RhdmFpbGFibGVcIil7IGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IEV4YW0gSW5zdGFuY2Ugbm90IGZvdW5kIScpOyAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSA1OyB9ICAgIC8vIGV4YW0gaW5zdGFuY2Ugbm90IGF2YWlsYWJsZSBidXQgc2VydmVyIHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChkYXRhLm1lc3NhZ2UgPT09IFwicmVtb3ZlZFwiKXsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IFN0dWRlbnQgcmVnaXN0cmF0aW9uIG5vdCBmb3VuZCEnKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KClcbiAgICAgICAgICAgICAgICAgICAgfSAgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCAtIHdlIGhhbmRsZSB0aGlzIGRpZmZlcmVudGx5IG5vdy4gdGVhY2hlciBzdG9yZXMgXCJraWNrZWRcIiBmb3Igc3R1ZGVudCB0byBjb2xsZWN0LiBzdHVkZW50IGlzIHJlbW92ZWQgZnJvbSBzZXJ2ZXIgd2hlbiBjb2xsZWN0aW5nIGtpY2tlZCBpbmZvLiBzdHVkZW50IGNsb3NlcyBleGFtIGFuZCBjbGVhbnMgdXAuXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSBIZWFydGJlYXQgbG9zdC4uYCk7ICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO30gICAvLyBoZWFydGJlYXQgbG9zdCBzZXJ2ZXIgbm90IHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMDsgLy8gRGllcyB6XHUwMEU0aGx0IGViZW5mYWxscyBhbHMgZXJmb2xncmVpY2hlciBIZWFydGJlYXQgLSBWZXJiaW5kdW5nIGhhbHRlblxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IGZhbHNlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlclN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnNlcnZlcnN0YXR1cykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHVkZW50U3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc3R1ZGVudHN0YXR1cykpOyBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJTdGF0dXNEZWVwQ29weSwgc3R1ZGVudFN0YXR1c0RlZXBDb3B5KTsvLyBWZXJhcmJlaXR1bmcgZGVyIGVtcGZhbmdlbmVuIERhdGVuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogKCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9KSAke2Vycm9yfWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IC8vIHByZXZlbnQgZm9jdXMgd2FybmluZyBibG9jayBpZiBubyBjb25uZWN0aW9uIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIGlmIG5vdCBjb25uZWN0ZWQgYnV0IHN0aWxsIGluIGV4YW0gbW9kZSB5b3UgY291bGQgdHJpZ2dlciBhIGZvY3VzIHdhcm5pbmcgYW5kIG5vYm9keSBpcyBhYmxlIHRvIHVubG9jayB5b3VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICBhc3luYyBzZW5kU2NyZWVuc2hvdCgpe1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7cmV0dXJufSAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZFxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2s7IC8vIFZhcmlhYmxlbiBhdVx1MDBERmVyaGFsYiBkZXMgaWYtQmxvY2tzIGRlZmluaWVyZW5cbiAgICAgICAgICAgIGxldCBpbWdCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBzY3JlZW5zaG90IGZyb20gZGVza3RvcCB2aWEgc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQgKGZsYW1lc2hvdCwgaW1hZ2VtYWdpYywgZXRjKVxuICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90KHsgZm9ybWF0OiAncG5nJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrLCBpbWdCdWZmZXIgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAgLy8ga2VpbiBpbWFnZUJ1ZmZlciBtaXRnZWdlYmVuIGJlZGV1dGV0IG51dHplIHNjcmVlbnNob3QtZGVza3RvcCBpbSB3b3JrZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHsgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwO31cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW1hZ2UgcHJvY2Vzc2luZyBmYWlsZWRcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBcInNjcmVlbnNob3RcIiBmcm9tIGFwcHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEZvY3VzZWRNaW5kb3cgPSBXaW5kb3dIYW5kbGVyLmdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkgIC8vcmV0dXJucyBleGFtIHdpbmRvdyBpZiBub3RoaW5nIGluIGZvY3VzIG9yIG1haW4gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Rm9jdXNlZE1pbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGN1cnJlbnRGb2N1c2VkTWluZG93LndlYkNvbnRlbnRzLmNhcHR1cmVQYWdlKCkgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyB3b3JrIGJlY2F1c2UgaXQncyBvbmJvYXJkIGVsZWN0cm9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSByZXN1bHQudG9QTkcoKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjayB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7IC8vIGF0dGVudGlvbiBwcm9jZXNzSW1hZ2UgIGNvbnZlcnRzIGJ1ZmZlciB0byB1aW50OGFycmF5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyArPTE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBwcm9jZXNzSW1hZ2UgZmFpbGVkOiAke2Vycn1gKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTUFDT1MgV09SS0FST1VORCAtIHN3aXRjaCB0byBwYWdlY2FwdHVyZSBpZiBubyBwZXJtaXNzb25zIGFyZSBncmFudGVkXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiICYmIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgJiYgaW1nQnVmZmVyICE9PSBudWxsKXsgIC8vdGhpcyBpcyBmb3IgbWFjT1MgYmVjYXVzZSBpdCBkZWxpdmVycyBhIGJsYW5rIGJhY2tncm91bmQgc2NyZWVuc2hvdCB3aXRob3V0IHBlcm1pc3Npb25zLiB3ZSBjYXRjaCB0aGF0IGNhc2Ugd2l0aCBhIHdvcmthcm91bmRcbiAgICAgICAgICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gZmFsc2UgICAvL25ldmVyIGRvIHRoaXMgYWdhaW5cbiAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gYXBwLmlzUGFja2FnZWQgPyBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnKSA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKTtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgID0gYXdhaXQgVGVzc2VyYWN0LnJlY29nbml6ZShpbWdCdWZmZXIgLCAnZW5nJyx7IGxhbmdQYXRoOiBwdWJsaWNQYXRoIH0gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFwcFdpbmRvd1Zpc2libGUgPSB0ZXh0LmluY2x1ZGVzKFwiRXhhbVwiKSAgIC8vY2hlY2sgaWYgdGhlIHdvcmQgXCJFeGFtXCIgY2FuIGJlIGZvdW5kIGluIHNjcmVlbnNob3QgLSBvdGhlcndpc2UgaXQgaXMgbW9zdCBsaWtlbHkgYSBibGFuayBkZXNrdG9wIC0gbWFjb3MgcXVpcmtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBXaW5kb3dWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBQbGVhc2UgY2hlY2sgeW91ciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIC0gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogTWFjT1Mgc2NyZWVuc2hvdHBlcm1pc3Npb25zIGNoZWNrIE9LXCIpO31cbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXJyKXsgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nIHdlIGRvIG5vdCBoYXZlIGEgc2NyZWVuc2hvdCAtIHNvIGRvIG5vdCB1cGRhdGUgdGhlIHNlcnZlclxuICAgICAgICAgICAgaWYgKCFzY3JlZW5zaG90QmFzZTY0KXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFNjcmVlbnNob3QgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlYCkgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBQYWdlQ2FwdHVyZSBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gTm8tUHJvY2Vzc2luZ2ApIH0gICBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogbm8gc2NyZWVuc2hvdCBhdmFpbGFibGUgLSBwbGVhc2UgZml4IHlvdXIgc2V0dXBgKSB9XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIC8vZG8gbm90IHJ1biBjb2xvcmNoZWNrIGlmIGFscmVhZHkgbG9ja2VkXG4gICAgICAgICAgICBpZiAoIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMpe1xuICAgICAgICAgICAgICAgIGlmIChpc2JsYWNrKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGZpdCByZXF1aXJlbWVudHMgKGFsbGJsYWNrKVwiKTtcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RoYXNoID0gbnVsbFxuICAgICAgICAgICAgdHJ5IHsgc2NyZWVuc2hvdGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgfSAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IGNyZWF0aW5nIGhhc2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90OiBzY3JlZW5zaG90QmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RoYXNoOiBzY3JlZW5zaG90aGFzaCxcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGhlYWRlckJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90ZmlsZW5hbWU6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gKyBcIi5qcGdcIixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzZW5kIHNjcmVlbnNob3QgdG8gc2VydmVyIHZpYSBlbWFpbCBmZXRjaCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMjtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVzY3JlZW5zaG90YDtcbiAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQsIG1heFJldHJpZXMpOyAvLyBFcnN0ZSBBbmZyYWdlIHN0YXJ0ZW5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG4gICAgZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgPSAwLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogU3RhdHVzIEVycm9yOlwiLCBkYXRhLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgaWYgKGF0dGVtcHQgPCBtYXhSZXRyaWVzIC0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgKyAxLCBtYXhSZXRyaWVzKTsgLy8gUmV0cnlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcyAtIDEgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlIChmZXRjaCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cbiAgICBhc3luYyBraWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKXtcbiAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpY2tTdHVkZW50OiBTdHVkZW50IGdvdCBraWNrZWQgYnkgVGVhY2hlclwiKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlfSAgLy8gZG8gbm90IGRlbGV0ZSBmb2xkZXIgb24gZXhpdCBiZWNhdXNlIHN0dWRlbnQgZ290IGtpY2tlZFxuICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cyAmJiBzdHVkZW50c3RhdHVzLmRlbGZvbGRlcil7IHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPSB0cnVlfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIHJlYWN0IHRvIHNlcnZlciBzdGF0dXMgXG4gICAgICogdGhpcyBjdXJyZW50bHkgb25seSBoYW5kbGUgc3RhcnRleGFtICYgZW5kZXhhbVxuICAgICAqIGNvdWxkIGFsc28gaGFuZGxlIGtpY2ssIGZvY3VzcmVzdG9yZSwgYW5kIGV2ZW4gdHJpZ2dlciBmaWxlIHJlcXVlc3RzXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyc3RhdHVzLCBzdHVkZW50c3RhdHVzKXtcbiAgICAgICBcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBpbmRpdmlkdWFsIHN0YXR1cyB1cGRhdGVzXG5cbiAgICAgICAgaWYgKCBzdHVkZW50c3RhdHVzICYmIE9iamVjdC5rZXlzKHN0dWRlbnRzdGF0dXMpLmxlbmd0aCAhPT0gMCkgeyAgLy8gd2UgaGF2ZSBzdGF0dXMgdXBkYXRlcyAodGFza3MpIC0gZG8gaXQhXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5wcmludGRlbmllZCkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdkZW5pZWQnKSAgIC8vdHJpZ2dlciwgd2h5XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmtpY2tlZCkgeyAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIGJ5IHRlYWNoZXJcbiAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlclwiKVxuICAgICAgICAgICAgICAgIGxldCBkZWxmb2xkZXIgPSB0cnVlXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBcbiAgICAgICAgICAgICAgICAgICAgZGVsZm9sZGVyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycm9yKSAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ2FuIG5vdCBkZWxldGUgZGlyZWN0b3J5IC0gJHtlcnJvcn0gYClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyID09IGZhbHNlKXsgIC8vdHJ5IGRlbGV0aW5nIGZpbGUgYnkgZmlsZSAodGhlIG9uZSB0aGF0IGNhdXNlcyB0aGUgcHJvYmxlbSB3aWxsIHN0YXkgaW4gdGhlIGZvbGRlcilcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkgeyBmcy5ybVN5bmMoZmlsZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBWZXJzdWNoZSwgZGFzIFZlcnplaWNobmlzIHJla3Vyc2l2IHp1IGxcdTAwRjZzY2hlblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZnMudW5saW5rU3luYyhmaWxlUGF0aCk7ICB9Ly8gVmVyc3VjaGUsIGRpZSBEYXRlaSB6dSBsXHUwMEY2c2NoZW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IChkZWxmb2xkZXIpIEZlaGxlciBiZWltIExcdTAwRjZzY2hlbiBkZXIgRGF0ZWkvVmVyemVpY2huaXM6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZm9jdXMgPT0gZmFsc2Upe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiByZXN0b3JpbmcgZm9jdXMgc3RhdGUgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KXsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gdHJ1ZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSBmYWxzZSAgKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSB0cnVlICAvL2NsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2sgd2lsbCBiZSBwdXQgb24gdGhpcy5wcml2YXRlU3BlbGxjaGVjayBpbiBlZGl0b3IgdXBkYXRlZCB2aWEgZmV0Y2hJbmZvKClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBpcGNNYWluLmVtaXQoXCJzdGFydExhbmd1YWdlVG9vbFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSBmYWxzZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSB0cnVlICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogZGUtYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSBmYWxzZSBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5zdWdnZXN0aW9ucyA9IHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuc2VuZGV4YW0gPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEV4YW1Ub1RlYWNoZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZmV0Y2hmaWxlcyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoc3R1ZGVudHN0YXR1cy5maWxlcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdGhpcyBpcyBhbiBtaWNyb3NvZnQzNjUgdGhpbmcuIGNoZWNrIGlmIGV4YW0gbW9kZSBpcyBvZmZpY2UsIGNoZWNrIGlmIHRoaXMgaXMgc2V0IC0gb3RoZXJ3aXNlIGRvIG5vdCBlbnRlciBleGFtbW9kZSAtIGl0IHdpbGwgZmFpbFxuICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIHNoYXJpbmcgbGluayAtIGl0IHdpbGwgYmUgdXNlZCBpbiBcIm1pY3Jvc29mdDM2NVwiIGV4YW0gbW9kZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gc3R1ZGVudHN0YXR1cy5tc29mZmljZXNoYXJlICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIGdyb3VwIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IHN0dWRlbnRzdGF0dXMuZ3JvdXAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIFxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGdsb2JhbCBzdGF0dXMgdXBkYXRlc1xuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIFxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgU1RBUlRcbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBjdXJyZW50IGFjdGl2ZSBzZWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBvbmUgaW4gdGhlIHNlcnZlcnN0YXR1cyAtIGlmIG5vdCBjaGFuZ2UgdG8gdGhlIG5ldyBzZWN0aW9uXG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNoYW5naW5nIHNlY3Rpb24gdG8gJHtzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbn0gJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZX1gIClcblxuICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TG9ja2VkU2VjdGlvbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbjsgLy8gQ3VycmVudCBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBzYXZpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uOyAvLyBOZXcgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3IgbG9hZGluZylcbiAgICAgICAgICAgICAgICBjb25zdCBleGFtRGlyID0gdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeTtcblxuXG4gICAgICAgICAgICAgICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID09PSBcImVkaXRvclwiKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBzZW5kaW5nIGV4YW0gdG8gdGVhY2hlciAoZmluYWwgc3VibWl0KVwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgY3VycmVudCB3b3JrIGFzIGJhc2U2NCB0byB0ZWFjaGVyIChzdG9yZXMgcGRmIGluIEFCR0FCRSBmb2xkZXIgd2l0aCBzdWJtaXNzaW9uIG51bWJlcilcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBkZiA9IGF3YWl0IHRoaXMuZ2V0QmFzZTY0UERGKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciwgc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tjdXJyZW50TG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWUpICAvLyBsb2NhbCBmdW5jdGlvbiB0byBnZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAocGRmLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQmFzZTY0UERGdG9UZWFjaGVyKHBkZi5iYXNlNjRwZGYsIGN1cnJlbnRMb2NrZWRTZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpIC8vYmFja3VwIGxvY2FsIGZpbGVzIGFuZCBzZW5kIHRvIHRlYWNoZXIgKGFyY2hpdmUgd2l0aCB0aW1lc3RhbXApXG5cblxuICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhhbXR5cGUgaW4gY2xpZW50aW5mb1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbG9ja2VkIHNlY3Rpb24gQUZURVIgc2F2aW5nIHRoZSBvbGQgc3RhdGVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBuZXdMb2NrZWRTZWN0aW9uO1xuXG5cblxuICAgICAgICAgICAgICAgIC8vIE1PVkUgU2VjdGlvbiBGaWxlcyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMTogU0FWRSBDVVJSRU5UIEVYQU1ESVIgRklMRVMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhleGFtRGlyKSAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHsgLy8gQ2hlY2sgaWYgbWFpbiBkaXIgZXhpc3RzIGFuZCBhIHNlY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlUGF0aCA9IGAke2V4YW1EaXJ9LyR7Y3VycmVudExvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzYXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoc2F2ZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAvLyBDcmVhdGUgc2F2ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhleGFtRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gaXRlbXMgaW4gZXhhbURpciB0byBzYXZlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc1NhdmVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob2xkUGF0aCk7IC8vIEdldCBmaWxlIHN0YXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBwcm9jZXNzIGFjdHVhbCBGSUxFUywgbm90IGRpcmVjdG9yaWVzIChsaWtlIHRoZSBzZWN0aW9uIGZvbGRlcnMgdGhlbXNlbHZlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7c2F2ZVBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7IC8vIENvcHkgZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZFBhdGgpOyAvLyBEZWxldGUgb3JpZ2luYWwgZmlsZSBmcm9tIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNTYXZlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgKGZvbGRlcikgaXRlbSAke2ZpbGV9IGluIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IHNhdmVkICR7ZmlsZXNTYXZlZH0gZmlsZXMgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAyOiBMT0FEIEZJTEVTIGZyb20gdGhlIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgTkVXIGxvY2tlZCBzZWN0aW9uIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBuZXdMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRQYXRoID0gYCR7ZXhhbURpcn0vJHtuZXdMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2FkUGF0aCkpIHsgLy8gQ2hlY2sgaWYgdGhlIG5ldyBzZWN0aW9uIGZvbGRlciBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc1RvTG9hZCA9IGZzLnJlYWRkaXJTeW5jKGxvYWRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENvcGllZCBmaWxlICR7ZmlsZX0gZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIGl0ZW0gJHtmaWxlfSBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IG5ld0xvY2tlZFNlY3Rpb24gaXMgZmFsc3kgKCR7bmV3TG9ja2VkU2VjdGlvbn0pLCBza2lwcGluZyBmaWxlIGxvYWRgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3IgZHVyaW5nIGZvbGRlciBvcGVyYXRpb24gLSAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufSwgbmV3TG9ja2VkU2VjdGlvbjogJHtuZXdMb2NrZWRTZWN0aW9ufSwgZXhhbURpcjogJHtleGFtRGlyfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBBY3R1YWxseSBTV0lUQ0ggRVhBTSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBvciByZWxlYWQgdGhlIG5ldyBleGFtIHNlY3Rpb24gaW4gdGhlIHNhbWUgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93IC0gaWYgeW91IGRvbid0IG5leHQtZXhhbSB3aWxsIGNyYXNoIHNpbGVudGx5IG9uIHJlbG9hZCBhbmQgc2VjdGlvbiBzd2l0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKS5mb3JFYWNoKHdjID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgRU5EXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICBcblxuXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrKSB7ICB0aGlzLmFjdGl2YXRlU2NyZWVubG9jaygpIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICkgeyB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgfVxuXG4gICAgICAgIC8vIHNjcmVlbnNob3Qgc2FmZXR5IChPQ1Igc2VhcmNoZXMgZm9yIG5leHQtZXhhbSBzdHJpbmcpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jcikgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSB0cnVlICB9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSBmYWxzZSAgIH1cblxuICAgICAgICAvLyBHcm91cHMgaGFuZGxpbmdcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmdyb3Vwcyl7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZX1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gZmFsc2V9XG5cbiAgICAgICAgLy91cGRhdGUgc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsIHx8IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT09IDApIHsgLy8wIGlzIHRoZSBzYW1lIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCBidXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCAhPT0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGNoYW5nZWQgdG9cIiwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwXG4gICAgICAgICAgICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBkaXNhYmxlZCFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgb2xkIGludGVydmFsIGFuZCBzdGFydCBuZXcgaW50ZXJ2YWwgaWYgc2V0IHRvIHNvbWV0aGluZyBiaWdnZXIgdGhhbiB6ZXJvXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuaW50ZXJ2YWwgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgLy8gcmVtb3ZlIGxvY2tzY3JlZW4gaW1tZWRpYXRlbHkgLSBkb24ndCB3YWl0IGZvciBzZXJ2ZXIgaW5mb1xuICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgXG4gICAgICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBzZW5kIGJhc2U2NCBwZGYgdG8gdGVhY2hlclxuICAgIHNlbmRCYXNlNjRQREZ0b1RlYWNoZXIoYmFzZTY0cGRmLCBzZWN0aW9uPTEpe1xuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcHJpbnRyZXF1ZXN0LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfS8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59YDtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBiYXNlNjRwZGYsXG4gICAgICAgICAgICBwcmludHJlcXVlc3Q6IGZhbHNlLCAgICBcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcixcbiAgICAgICAgICAgIGxvY2tlZHNlY3Rpb246IHNlY3Rpb25cbiAgICAgICAgfVxuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7IHJldHVybiByZXNwb25zZS5qc29uKCk7ICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1lc3NhZ2UgPT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcisrICAgLy8gc3VjY2Vzc2Z1bCBzdWJtaXNzaW9uIC0+IGluY3JlbWVudCBudW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHsgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlZGl0b3IgQCBwcmludGJhc2U2NDpcIixlcnJvci5tZXNzYWdlKSAgICBcbiAgICAgICAgfSk7IFxuICAgIH1cbiAgICBcblxuXG5cbiAgICAvL2dldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgLy8gQVRURU5USU9OOiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGlwY2hhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgc3RvcmVzIGl0IGFzIGZpbGUgaW4gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgYXN5bmMgZ2V0QmFzZTY0UERGKHN1Ym1pc3Npb25udW1iZXIsIHNlY3Rpb25uYW1lLCBwcmludEJhY2tncm91bmQ9ZmFsc2Upe1xuICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIG1hcmdpbnM6IHt0b3A6MC41LCByaWdodDowLCBib3R0b206MC41LCBsZWZ0OjAgfSxcbiAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBwcmludEJhY2tncm91bmQsXG4gICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgbGFuZHNjYXBlOiBmYWxzZSxcbiAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJGb290ZXI6dHJ1ZSxcblxuICBcbiAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHtzZWN0aW9ubmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwO0FiZ2FiZTogJHtzdWJtaXNzaW9ubnVtYmVyfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGVcbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNsaWVudG5hbWV9IC0gJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9IC0gVmVyc2lvbiAke3N1Ym1pc3Npb25udW1iZXJ9XCJgKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NHBkZiA9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtiYXNlNjRwZGZ9YDtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIlBERiBnZW5lcmF0ZWRcIiwgZGF0YVVybDpkYXRhVXJsLCBiYXNlNjRwZGY6IGJhc2U2NHBkZiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiRXJyb3IgZ2VuZXJhdGluZyBQREY6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcnJvciBnZW5lcmF0aW5nIFBERlwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2hvdyB0ZW1wb3Jhcnkgc2NyZWVubG9jayB3aW5kb3dcbiAgICBhY3RpdmF0ZVNjcmVlbmxvY2soKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuICAgICAgIFxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPT0gMCl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gdHJ1ZVxuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpICAvLyBhZGQgc2NyZWVubG9jayB3aW5kb3dzIGZvciBhZGRpdGlvbmFsIGRpc3BsYXlzXG4gICAgICAgICAgICB9IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIHRlbXBvcmFyeSBzY3JlZW5sb2Nrd2luZG93XG4gICAga2lsbFNjcmVlbmxvY2soKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbmxvY2t3aW5kb3cgJiYgIXNjcmVlbmxvY2t3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWxsU2NyZWVubG9jazogbm8gZnVuY3Rpb25hbCBzY3JlZW5sb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICB9IFxuICAgICAgICAvLyBDbGVhciBhcnJheSBjb21wbGV0ZWx5IGFmdGVyIGF0dGVtcHRpbmcgdG8gZGVzdHJveSBhbGwgd2luZG93c1xuICAgICAgICAvLyBUaGUgY2xvc2VkIGV2ZW50IGhhbmRsZXIgd2lsbCBhbHNvIGNsZWFuIHVwLCBidXQgdGhpcyBlbnN1cmVzIHRoZSBhcnJheSBpcyBlbXB0eVxuICAgICAgICBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gZmFsc2VcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0cyBleGFtIG1vZGUgZm9yIHN0dWRlbnRcbiAgICAgKiBkZWxldGVzIHdvcmtmb2xkZXIgY29udGVudHMgKGlmIHNldClcbiAgICAgKiBvcGVucyBhIG5ldyB3aW5kb3cgaW4ga2lvc2sgbW9kZSB3aXRoIHRoZSBnaXZlbiBleGFtdHlwZVxuICAgICAqIGVuYWJsZXMgdGhlIGJsdXIgbGlzdGVuZXIgYW5kIGFjdGl2YXRlcyByZXN0cmljdGlvbnMgKGRpc2FibGUga2V5Ym9hcnNob3J0Y3V0cyBldGMuKVxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgZXhhbW1vZGUsIGV4YW10eXBlLCBhbmQgb3RoZXIgc2V0dGluZ3MgZnJvbSB0aGUgdGVhY2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgZGlhbG9nIGlzIG9wZW4gYW5kIGxvZyB3YXJuaW5nXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4aXRXYXJuaW5nT3BlbiB8fCBXaW5kb3dIYW5kbGVyLmV4aXRRdWVzdGlvbk9wZW4gfHwgV2luZG93SGFuZGxlci5taW5pbWl6ZVdhcm5pbmdPcGVuKSB7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBEaWFsb2cgaXMgc3RpbGwgb3BlbiAtIGV4YW0gd2lsbCBzdGFydCBhbnl3YXlcIilcbiAgICAgICAgfVxuICBcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgIFxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uY21hcmdpbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmNtYXJnaW4gIC8vIHRoaXMgaXMgdXNlZCB0byBjb25maWd1cmUgbWFyZ2luIHNldHRpbmdzIGZvciB0aGUgZWRpdG9yXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubGluZXNwYWNpbmcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5saW5lc3BhY2luZyAvLyB3ZSB0cnkgdG8gZG91YmxlIGxpbmVzcGFjaW5nIG9uIGRlbWFuZCBpbiBwZGYgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5hdWRpb1JlcGVhdCA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmF1ZGlvUmVwZWF0IC8vIHJlc3RyaWN0IHJlcGV0aXRpb24gb2YgYXVkaW8gZmlsZXMgKGZvciBsaXN0ZW5pbmcgY29tcHJlaGVuc2lvbilcblxuICAgICAgICBpZiAoIVdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogY3JlYXRpbmcgZXhhbSB3aW5kb3dcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVFeGFtV2luZG93KHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3JlY29ubmVjdCBpbnRvIGFjdGl2ZSBleGFtIHNlc3Npb24gd2l0aCBleGFtIHdpbmRvdyBhbHJlYWR5IG9wZW5cbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBmb3VuZCBleGlzdGluZyBFeGFtd2luZG93Li5cIilcbiAgICAgICAgICAgIHRyeSB7ICAvLyBzd2l0Y2ggZXhpc3Rpbmcgd2luZG93IGJhY2sgdG8gZXhhbSBtb2RlXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKSBcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0RnVsbFNjcmVlbih0cnVlKSAgLy9nbyBmdWxsc2NyZWVuIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSAgLy9tYWtlIHN1cmUgdGhlIHdpbmRvdyBpcyAxIGxldmVsIGFib3ZlIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMCkgLy8gd2FpdCBhbiBhZGRpdGlvbmFsIDIgc2VjIGZvciB3aW5kb3dzIHJlc3RyaWN0aW9ucyB0byBraWNrIGluICh0aGV5IHN0ZWFsIGZvY3VzKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmFkZEJsdXJMaXN0ZW5lcigpO1xuICAgICAgICAgICAgICAgICAgICAvLyBGb3IgcmVjb25uZWN0OiBpbml0aWFsaXplIGJsb2NrIHdpbmRvd3MgYWZ0ZXIgd2luZG93IGlzIHJlcG9zaXRpb25lZFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IC8vZXhhbXdpbmRvdyB2YXJpYWJsZSBpcyBzdGlsbCBzZXQgYnV0IHRoZSB3aW5kb3cgaXMgbm90IG1hbmFnYWJsZSBhbnltb3JlIChtYW51YWxseSBjbG9zZWQgaW4gZGV2IG1vZGU/KVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBubyBmdW5jdGlvbmFsIGV4YW13aW5kb3cgZm91bmQuLiByZXNldHRpbmdcIilcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgIC8vZXhhbXdpbmRvdyBpcyBnaXZlbiBidXQgbm90IHVzZWQgaW4gZGlzYWJsZVJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICByZXR1cm4gIC8vIGluIHRoYXQgY2FzZS4uIHdlIGFyZSBmaW5pc2hlZCBoZXJlICFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBOb3RlOiBGb3IgbmV3IGV4YW0gd2luZG93cywgaW5pdEJsb2NrV2luZG93cygpIGlzIGNhbGxlZCBpbiBkaWQtZmluaXNoLWxvYWQgaGFuZGxlclxuICAgICAgICAvLyB0byBlbnN1cmUgd2luZG93IGlzIGZ1bGx5IHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgRXhhbSBtb2RlXG4gICAgICogY2xvc2VzIGV4YW0gd2luZG93XG4gICAgICogZGlzYWJsZXMgcmVzdHJpY3Rpb25zIGFuZCBibHVyIFxuICAgICAqL1xuICAgIGFzeW5jIGVuZEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgXG4gICAgICAgIFdpbmRvd0hhbmRsZXIucmVtb3ZlQmx1ckxpc3RlbmVyKCk7XG4gICAgICBcbiAgICAgICAgLy9vbmx5IGRpc2FibGUgcmVzdHJpY3Rpb25zIGlmIG5vdCBpbiBleGFtIG1vZGUgKCBzZXJpb3N1bHkuLiBob3cgY291bGQgdGhpcyBldmVyIGhhcHBlbj8gKVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIHN0dWRlbnRzIHdvcmsgb24gc3R1ZGVudHMgcGMgKG1ha2VzIHNlbnNlIGlmIGV4YW0gaXMgd3JpdHRlbiBvbiBzY2hvb2wgcHJvcGVydHkpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMgJiYgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyIG9uIGV4aXRcIilcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogXCIsZXJyb3IpOyB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAvLyBpbiBzb21lIGVkZ2UgY2FzZXMgaW4gZGV2ZWxvcG1lbnQgdGhpcyBpcyBzZXQgYnV0IHN0aWxsIHVudXNhYmxlIC0gdXNlIHRyeS9jYXRjaCAgIFxuICAgICAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgdGhpcy5jb25maWcuc2hvd2RldnRvb2xzKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsV2ViQ29udGVudHMgPSB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgd2Mgb2YgYWxsV2ViQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgd2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFdhaXQgZm9yIGFsbCBEZXZUb29scyB0byBiZSBjbG9zZWQgYmVmb3JlIGNsb3NpbmcgdGhlIGV4YW0gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGFsbCBjbG9zZURldlRvb2xzKCkgY2FsbHMgYXJlIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhbHdheXMgdHJ5IHRvIGNsb3NlIHRoZSBleGFtIHdpbmRvdyBzYWZlbHkgYWZ0ZXIgZGV2dG9vbHMgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06ICcsZSl9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBibG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBubyBmdW5jdGlvbmFsIGJsb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH1cbiAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICBcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGxhbmd1YWdlVG9vbFNlcnZlci5sYW5ndWFnZVRvb2xQcm9jZXNzKXtcbiAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdG9wU2VydmVyKCk7IC8vIEtpbGwgTGFuZ3VhZ2VUb29sIHNlcnZlciB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICB9XG4gICAgICAgIC8vIGFzayBzdHVkZW50IHRvIHF1aXQgYXBwIGFmdGVyIGZpbmlzaGluZyBleGFtXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuc2hvd0V4aXRRdWVzdGlvbigpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIGV4YW13aW5kb3cgb25seSB3aGVuIG5vIHByaW50VG9QREYgb3BlcmF0aW9uIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBjbG9zZUV4YW1XaW5kb3dTYWZlbHkoKXtcbiAgICAgICAgY29uc3QgZXhhbVdpbiA9IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICBpZiAoIWV4YW1XaW4peyByZXR1cm4gfVxuXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogcHJpbnRUb1BERiBpbiBwcm9ncmVzcyAtIHJldHJ5IGluIDFzXCIpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKSB9LCAxMDAwKSAvLyByZXRyeSB1bnRpbCBwcmludGluZyBpcyBmaW5pc2hlZFxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFleGFtV2luLmlzRGVzdHJveWVkPy4oKSl7XG4gICAgICAgICAgICAgICAgZXhhbVdpbi5jbG9zZSgpIC8vIG5vcm1hbCBjbG9zZSwgb24oJ2Nsb3NlJykgaGFuZGxlciBkb2VzIHRoZSByZXN0XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IGVycm9yIHdoaWxlIGNsb3NpbmcgZXhhbXdpbmRvd1wiLCBlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIG1hbnVhbGx5IHRyaWdnZXJlZCBpZiBjb25uZWN0aW9uIGlzIGxvc3QgZHVyaW5nIGV4YW0gLSB3ZSBhbGxvdyB0aGUgc3R1ZGVudCB0byBnZXQgb3V0IG9mIHRoZSBraW9zayBtb2RlIFxuICAgIC8vIElORk86IHRoaXMgaXMgYmFzaWNhbGx5IHJlZHVuZGFudCBcbiAgICBhc3luYyBncmFjZWZ1bGx5RW5kRXhhbSgpe1xuICAgICAgICB0aGlzLmVuZEV4YW0oKVxuICAgIH1cblxuICAgIC8vIHJlc2V0IGFsbCB2YXJpYWJsZXMgdGhhdCBzaWduYWwgb3IgbmVlZCBhIHZhbGlkIHRlYWNoZXIgY29ubmVjdGlvblxuICAgIHJlc2V0Q29ubmVjdGlvbigpe1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gd2UgYXJlIGZvY3VzZWQgXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlICAgLy8gZG8gbm90IHNldCB0byBmYWxzZSB1bnRpbCBleGFtIHdpbmRvdyBpcyBhY3R1YWxseSBjbG9zZWQgICh0aGlzIGlzIGRvbmUgaW4gZW5kRXhhbSgpKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRpbWVzdGFtcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IGZhbHNlICAvLyB0aGlzIGNoZWNrIGhhcHBlbnMgb25seSBhdCB0aGUgYXBwbGljYXRpb24gc3RhcnQuLiBkbyBub3QgcmVzZXQgb25jZSBzZXRcbiAgICB9XG4gXG5cblxuXG4gICAgLyoqXG4gICAgICogZGllc2UgbWV0aG9kZSBob2x0IHNpY2gsIGRpZSB2b20gdGVhY2hlciB6dW0gZG93bmxvYWQgYmVyZWl0Z2VsZWd0ZW4gZGF0ZWllblxuICAgICAqIFx1MDBGQ2JlciBkYXMgdXBkYXRlIGludGVydmFsIHdpcmQgZGVyIHRyaWdnZXIgenVtIGRvd25sb2FkIHVuZCBkaWUgZmlsZWxpc3QgZXJoYWx0ZW5cbiAgICAgKiBAcGFyYW0geyp9IGZpbGVzIFxuICAgICAqL1xuICAgIHJlcXVlc3RGaWxlRnJvbVNlcnZlcihmaWxlcyl7XG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgYmFja3VwZmlsZSA9IGZhbHNlXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKGZpbGUubmFtZSAmJiBmaWxlLm5hbWUuaW5jbHVkZXMoJ2JhaycpKXsgICAvLyB0aGlzIHdpbGwgYWx3YXlzIHNldCB0aGUgbGFzdCBiYWsgZmlsZSBhcyBiYWNrdXAgZmlsZSBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGJhayBmaWxlXG4gICAgICAgICAgICAgICAgYmFja3VwZmlsZSA9IGZpbGUubmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuXG4gICAgICAgIC8vIERhdGVuIGZcdTAwRkNyIGRlbiBQT1NULVJlcXVlc3Qgdm9yYmVyZWl0ZW5cbiAgICAgICAgbGV0IGRhdGEgPSBKU09OLnN0cmluZ2lmeSh7ICdmaWxlcyc6IGZpbGVzLCAndHlwZSc6ICdzdHVkZW50ZmlsZXJlcXVlc3QnIH0pO1xuXG4gICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2Rvd25sb2FkLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogZGF0YSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHRva2VuLmNvbmNhdCgnLnppcCcpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVwYXRoLCBCdWZmZXIuZnJvbShidWZmZXIpLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoZXJyKTsgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3QoYWJzb2x1dGVGaWxlcGF0aCwgeyBkaXI6IHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkgfSkgXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IGZpbGVzIHJlY2VpdmVkIGFuZCBleHRyYWN0ZWRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyAvLyBWZXJ3ZW5kdW5nIGRlciBQcm9taXNlLWJhc2llcnRlbiBBUEkgdm9uIGZzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWNrdXBmaWxlICYmIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiYWNrdXAnLCBiYWNrdXBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBUcmlnZ2VyIFJlcGxhY2UgRXZlbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYENvbW11bmljYXRpb25IYW5kbGVyIC0gcmVxdWVzdEZpbGVGcm9tU2VydmVyOiAke2Vycn1gKSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgc2VuZEV4YW1Ub1RlYWNoZXIoKXtcbiAgICAgICAgLy9zZW5kIHNhdmUgdHJpZ2dlciB0byBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vdGhlcmUgaXMgYSBydW5uaW5nIGV4YW0gLSBzYXZlIGN1cnJlbnQgd29yayBmaXJzdCFcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ3NhdmUnLCd0ZWFjaGVycmVxdWVzdCcpICAgLy90cmlnZ2VyLCB3aHkgICh0ZWFjaGVycmVxdWVzdCB3aWxsIGFsc28gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKCkgYnV0IG9ubHkgYWZ0ZXIgc2F2aW5nIHRoZSBwZGYgaXMgY29tcGxldGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpeyBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYENvbW11bmljYXRpb24gaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiBDb3VsZCBub3Qgc2F2ZSBzdHVkZW50cyB3b3JrLiBJcyBleGFtbW9kZSBhY3RpdmU/YClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgIC8vIG5vdCBydW5uaW5nIGV4YW0gKHByb2JhYmx5IHVzaW5nIG5leHQtZXhhbSBhcyBjbGFzc3Jvb21tYW5hZ21lbnQgdG9vbClcbiAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpICAgLy96aXAgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXIgYXBpXG4gICAgICAgIH1cblxuICAgICB9XG5cblxuICAgICAgLy96aXAgY29uZmlnLndvcmsgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXJcbiAgICAgYXN5bmMgc2VuZFRvVGVhY2hlcigpe1xuICAgICAgICB0cnkgeyBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSk7IH1cbiAgICAgICAgfWNhdGNoIChlKXsgbG9nLmVycm9yKGUpfVxuXG4gICAgICAgIC8vICB0aGlzIGlzIHRoZSBsb2dmaWxlIHBhdGggdHJ5IHRvIGNvcHkgdGhlIGxvZ2ZpbGUgdG8gdGhlIGV4YW1kaXJlY3RvcnkgYmVmb3JlIG1ha2luZyB0aGUgemlwIGZpbGVcbiAgICAgICAgbGV0IGxvZ2ZpbGVwYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGU7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvZ2ZpbGVwYXRoKSl7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhsb2dmaWxlcGF0aCwgam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJykpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kVG9UZWFjaGVyOiBjb3VsZCBub3QgY29weSBsb2dmaWxlIHRvIGV4YW1kaXJlY3RvcnknKTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHppcGZpbGVuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lLmNvbmNhdCgnLnppcCcpXG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgXG5cbiAgICAgICAgbGV0IGJhc2U2NEZpbGUgPSBudWxsXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnppcERpcmVjdG9yeSh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB6aXBmaWxlcGF0aClcbiAgICAgICAgICAgIGNvbnN0IGZpbGVDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHppcGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGJhc2U2NEZpbGUgPSBmaWxlQ29udGVudC50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgIH1jYXRjaCAoZSl7ICBsb2cuZXJyb3IoZSkgIH1cblxuICAgICAgICAvLyBzZW5kaW5nIHRoZSB3aG9sZSBkaXJlY3RvcnkgYXMgemlwIGZpbGUgYmFzZTY0ZW5jb2RlZCB2aWEgSlNPTiBpc24ndCBwcm9iYWJseSB0aGUgYmVzdCBtZXRob2QgYnV0IGl0IHdvcmtzIHdoaWxlIGFsbCBmb3JtRGF0YSBhcHByb2FjaGVzIGZhaWxlZCB3aXRoXG4gICAgICAgIC8vIGZldGNoKCkgd2hpbGUgdGhleSB3b3JrZWQgd2l0aCBheCBpb3MoKSAtIG5vdCBldmVuIGNoYXRncHQgb3Igc3RhY2tvdmVyZmxvdyBjb3VsZCBoZWxwIF5eIGkgdGhpbmsgaXQgaXMgcmVsYXRlZCB0byB0aGUgc3BlY2lmaWMgZm9ybURhdGEgbW9kdWxlIHRoYXQgY2FudCBiZSBpbXBvcnRlZCB3aXRob3V0IFwid2luZG93IGVycm9yXCJcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9yZWNlaXZlLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gO1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGZpbGU6IGJhc2U2NEZpbGUsIGZpbGVuYW1lOiB6aXBmaWxlbmFtZSB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgICAgICAudGhlbihkYXRhID0+IHsgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IHRlYWNoZXIgcmVzcG9uc2U6ICR7ZGF0YS5tZXNzYWdlfWApOyB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge2xvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogJHtlcnJvcn1gKTsgfSk7XG4gICAgIH1cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gb3V0UGF0aDogL3BhdGgvdG8vY3JlYXRlZC56aXBcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB6aXBEaXJlY3Rvcnkoc291cmNlRGlyLCBvdXRQYXRoKSB7XG4gICAgICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcignemlwJywgeyB6bGliOiB7IGxldmVsOiA5IH19KTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGFyY2hpdmVcbiAgICAgICAgICAgIC5kaXJlY3Rvcnkoc291cmNlRGlyLCBmYWxzZSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXG4gICAgICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICAgIDtcbiAgICAgICAgc3RyZWFtLm9uKCdjbG9zZScsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICAgICAgfSkuY2F0Y2goIGVycm9yID0+IHsgbG9nLmVycm9yKGVycm9yKX0pO1xuICAgIH1cblxuXG5cblxuXG5cbiAgICAvLyB0aW1lb3V0IFxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICBcbiB9XG4gXG4gZXhwb3J0IGRlZmF1bHQgbmV3IENvbW1IYW5kbGVyKClcbiAiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBtYW1tb3RoIGZyb20gJ21hbW1vdGgnO1xuXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyJztcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL3RyYXltZW51LmpzJztcbmltcG9ydCB7IGVuc3VyZU5ldHdvcmtPclJlc2V0IH0gZnJvbSAnLi90ZXN0cGVybWlzc2lvbnNNYWMuanMnO1xuaW1wb3J0IHsgZ2V0V2xhbkluZm8gfSBmcm9tICcuL2dldHdsYW5pbmZvLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY29uc3QgY2hlY2tQb3J0T3BlbiA9IChwb3J0LCBob3N0ID0gJzEyNy4wLjAuMScsIHRpbWVvdXQgPSAxNTAwKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBuZXQuU29ja2V0KCk7XG4gICAgICAgIGNvbnN0IGZpbmlzaCA9IChydW5uaW5nLCBlcnJvciA9IG51bGwpID0+IHtcbiAgICAgICAgICAgIHNvY2tldC5kZXN0cm95KCk7XG4gICAgICAgICAgICByZXNvbHZlKHsgcnVubmluZywgcG9ydCwgaG9zdCwgZXJyb3IgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHNvY2tldC5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBzb2NrZXQub25jZSgnY29ubmVjdCcsICgpID0+IGZpbmlzaCh0cnVlKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCd0aW1lb3V0JywgKCkgPT4gZmluaXNoKGZhbHNlLCAndGltZW91dCcpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4gZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSkpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc29ja2V0LmNvbm5lY3QocG9ydCwgaG9zdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBJUEMgaGFuZGxpbmcgKEJhY2tlbmQpIFNUQVJUXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5jbGFzcyBJcGNIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZSAvLyBmbGFnIHRvIHByZXZlbnQgY2xvc2luZyB3aW5kb3cgd2hpbGUgcHJpbnRpbmdcbiAgICB9XG4gICAgaW5pdCAobWMsIGNvbmZpZywgd2gsIGNoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gd2ggIFxuICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyID0gY2hcbiAgICAgICAgXG5cbiAgICAgICAgaXBjTWFpbi5vbignc2V0LW5ldy1sb2NhbGUnLCAoZXZlbnQsIGxvY2FsZSkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzZXQtbmV3LWxvY2FsZTogc2V0dGluZyBuZXcgbG9jYWxlIHRvICR7bG9jYWxlfWApXG4gICAgICAgICAgICBpMThuLmxvY2FsZSA9IGxvY2FsZVxuICAgICAgICAgICAgdXBkYXRlU3lzdGVtVHJheShpMThuLmxvY2FsZSk7XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0RXhhbU1hdGVyaWFscycsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgIFxuICAgICAgICAgICAgbGV0IGNsaWVudGluZm8gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvXG4gICAgICAgICAgICBsZXQgc2VydmVybmFtZSA9IGNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICAgICAgbGV0IHNlcnZlcmlwID0gY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICAgICAgbGV0IHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0geyBcbiAgICAgICAgICAgICAgICBncm91cDogY2xpZW50aW5mby5ncm91cCxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGV4YW1NYXRlcmlhbHMgPSBmYWxzZVxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICAgICAgICAgIGV4YW1NYXRlcmlhbHMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2dldGV4YW1tYXRlcmlhbHMvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWAsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiByZWNlaXZlZCBkYXRhXCIsIGRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6ICR7ZXJyfWApKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhhbU1hdGVyaWFsc1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIGFsbG93ZWRVcmxzIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRW50ZmVybmUgYWx0ZSBMaXN0ZW5lciwgdW0gRG9wcGVsLVJlZ2lzdHJpZXJ1bmdlbiB6dSB2ZXJtZWlkZW5cbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYWxsb3cgPSBhbGxvd2VkVXJscy5tYXAocyA9PiBTdHJpbmcocykudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybFN0ciA9IFN0cmluZyh1cmwgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGFsbG93LnNvbWUodSA9PiB1cmxTdHIuaW5jbHVkZXModSkpKSB7IGd1ZXN0LmxvYWRVUkwodXJsKTsgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGFsbG93ZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHVybCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFsbG93LnNvbWUodSA9PiB1cmxTdHIuaW5jbHVkZXModSkpKSB7IGUucHJldmVudERlZmF1bHQoKTsgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGJsb2NrZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGNvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgZXhhbSBtb2RlcylcbiAgICAgICAgY29uc3QgY2hlY2tDb21tb25FeGNlcHRpb25zID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIk1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiR29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50c1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGUuY29tXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJteXNpZ25pbnNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIndpbmRvd3NhenVyZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb29rdXBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJiaWxkdW5nLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTaGliYm9sZXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJpZC1hdXN0cmlhLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhIYW5kbGVyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImV1LW1vYmlsZS5ldmVudHMuZGF0YVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImdzdGF0aWMuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJsaXZlLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcblxuXG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBVbmlmaWVkIElQQyBoYW5kbGVyIGZvciB3ZWJ2aWV3IGJsb2NraW5nIC0gc3VwcG9ydHMgd2Vic2l0ZSwgZWR1dmlkdWFsLCBmb3JtcywgcmRwIG1vZGVzXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGUsIGFsbG93ZWREb21haW4sIGJhc2VVcmwsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluLCBnZm9ybXNUZXN0SWQgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZ3Vlc3QgPSB3ZWJDb250ZW50cy5mcm9tSWQoTnVtYmVyKGd1ZXN0SWQpKTtcbiAgICAgICAgICAgIGlmICghZ3Vlc3QgfHwgZ3Vlc3QuaXNEZXN0cm95ZWQ/LigpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGxpc3RlbmVycyB0byBwcmV2ZW50IGR1cGxpY2F0ZSByZWdpc3RyYXRpb25zXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVVJMIHZhbGlkYXRpb24gZnVuY3Rpb24gLSBkaWZmZXJlbnQgbG9naWMgYmFzZWQgb24gbW9kZVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChtb2RlID09PSBcIndlYnNpdGVcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBXRUJTSVRFIG1vZGU6IGNoZWNrIGRvbWFpbiBtYXRjaGluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVybCB8fCB0YXJnZXRVcmwuaW5jbHVkZXMoYmFzZVVybCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybE9iaiA9IG5ldyBVUkwodGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRvbWFpbiA9IHVybE9iai5ob3N0bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbiA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluLmVuZHNXaXRoKCcuJyArIGFsbG93ZWREb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZG9tYWluLnNsaWNlKDAsIC0oYWxsb3dlZERvbWFpbi5sZW5ndGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZWR1dmlkdWFsXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRURVVklEVUFML01PT0RMRSBtb2RlOiBjaGVjayBtb29kbGVUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9vZGxlLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInN0YXJ0YXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicHJvY2Vzc2F0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ291dFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImVkdXZpZHVhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9saWN5XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJmb3Jtc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZPUk1TIG1vZGU6IGNoZWNrIGdmb3Jtc1Rlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKGdmb3Jtc1Rlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBHb29nbGUgRm9ybXMtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImZvcm1SZXNwb25zZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ2aWV3c2NvcmVcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcInJkcFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJEUCBtb2RlOiBhbGxvdyBhbGwgKG9yIGltcGxlbWVudCBzcGVjaWZpYyBsb2dpYyBpZiBuZWVkZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIG1vZGVzKVxuICAgICAgICAgICAgICAgIHJldHVybiBjaGVja0NvbW1vbkV4Y2VwdGlvbnModGFyZ2V0VXJsKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB0YXJnZXQ9XCJfYmxhbmtcIiBsaW5rcyBhbmQgd2luZG93Lm9wZW4gLSBibG9jayBCRUZPUkUgbmF2aWdhdGlvblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgLy8gT3BlbiBpbiBzYW1lIHdlYnZpZXdcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgLy8gUHJldmVudCBuZXcgd2luZG93XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB3aWxsLW5hdmlnYXRlIG9uIHdlYkNvbnRlbnRzIGxldmVsIC0gdGhpcyBmaXJlcyBCRUZPUkUgbmF2aWdhdGlvbiBoYXBwZW5zXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gQmxvY2sgbmF2aWdhdGlvbiBjb21wbGV0ZWx5IC0gdGhpcyBoYXBwZW5zIEJFRk9SRSBwYWdlIGxvYWRzXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LnN0b3AoKTsgLy8gU3RvcCBhbnkgbG9hZGluZyBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsaWFzIGZvciBlZHV2aWR1YWwgbW9kZSAtIHJlZGlyZWN0cyB0byB1bmlmaWVkIGhhbmRsZXJcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci1lZHV2aWR1YWwtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KSA9PiB7XG4gICAgICAgICAgICAvLyBDYWxsIHRoZSB1bmlmaWVkIGhhbmRsZXIgd2l0aCBlZHV2aWR1YWwgbW9kZVxuICAgICAgICAgICAgY29uc3QgdW5pZmllZEhhbmRsZXIgPSBpcGNNYWluLmxpc3RlbmVycygnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycpWzBdO1xuICAgICAgICAgICAgaWYgKHVuaWZpZWRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuaWZpZWRIYW5kbGVyKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGU6ICdlZHV2aWR1YWwnLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbG9hZCB0aGUgYnJvd3NlciB2aWV3XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVsb2FkLWJyb3dzZXItdmlldycsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmwpO1xuICAgICAgICB9KTtcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGxhbmd1YWdlVG9vbCBBUEkgU2VydmVyICh3aXRoIEphdmEgSlJFKVxuICAgICAgICAgKiBSdW5zIGF0IGxvY2FsaG9zdCA4MDg4XG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWN0aXZhdGUgc3BlbGxjaGVjayBvbiBkZW1hbmQgZm9yIHNwZWNpZmljIHN0dWRlbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgTGFuZ3VhZ2VUb29sIHNlcnZlciByZXNwb25kcyBvbiBjb25maWd1cmVkIHBvcnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnaXNMYW5ndWFnZVRvb2xSdW5uaW5nJywgYXN5bmMgKCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHBvcnQgPSBsYW5ndWFnZVRvb2xTZXJ2ZXIucG9ydCB8fCA4MDg4O1xuICAgICAgICAgICAgY29uc3QgaG9zdHMgPSBbJzEyNy4wLjAuMScsICc6OjEnLCAnbG9jYWxob3N0J107XG4gICAgICAgICAgICAvLyBSdW4gYWxsIGNoZWNrcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlLCB1c2UgbG9uZ2VyIHRpbWVvdXQgZm9yIHNlcnZlciBzdGFydHVwIGRldGVjdGlvblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGhvc3RzLm1hcChob3N0ID0+IGNoZWNrUG9ydE9wZW4ocG9ydCwgaG9zdCwgMjUwMCkpKTtcbiAgICAgICAgICAgIC8vIFJldHVybiBmaXJzdCBzdWNjZXNzZnVsIHJlc3VsdCwgb3IgbGFzdCByZXN1bHQgaWYgbm9uZSBzdWNjZWVkZWRcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3NSZXN1bHQgPSByZXN1bHRzLmZpbmQocmVzdWx0ID0+IHJlc3VsdC5ydW5uaW5nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0IHx8IHJlc3VsdHNbcmVzdWx0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IExPQ0FMIExvY2tkb3duXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdsb2NhbGxvY2tkb3duJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2NhbGxvY2tkb3duOiBsb2NraW5nIGRvd24gY2xpZW50IHdpdGhvdXQgdGVhY2hlciBjb25uZWN0aW9uXCIpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7XG4gICAgICAgICAgICAgICAgZXhhbW1vZGU6IHRydWUsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RUeXBlOiAnJyxcbiAgICAgICAgICAgICAgICBtb29kbGVEb21haW46ICcnLFxuIFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RpbnRlcnZhbDogMCxcbiAgICAgICAgICAgICAgICBtc09mZmljZUZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNsb2NrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBpbjogJzAwMDAnLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdW5sb2Nrb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmb250ZmFtaWx5OiAnc2Fucy1zZXJpZicsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdElkOiAnJyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiBhcmdzLnBhc3N3b3JkLFxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgdXNlRXhhbVNlY3Rpb25zOiBmYWxzZSwgLy9pZiBmYWxzZSBleGFtIHNlY3Rpb24gMSBpcyB1c2VkIGFuZCBubyB0YWJzIGFyZSBkaXNwbGF5ZWRcbiAgICAgICAgICAgICAgICBhY3RpdmVTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgZXhhbVNlY3Rpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIDE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW10eXBlOiBhcmdzLmV4YW1tb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY21hcmdpbjogeyBzaWRlOiAncmlnaHQnLCBzaXplOiAzIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lc3BhY2luZzogJzInLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9SZXBlYXQ6IDMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGFyZ3MubGFuZ3VhZ2V0b29sIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6IGFyZ3Muc3BlbGxjaGVja2xhbmcgfHwgJ2RlLURFJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBhcmdzLnN1Z2dlc3Rpb25zIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGFyZ3MuY2xpZW50bmFtZTtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBcIjEyNy4wLjAuMVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gXCJhXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSB0cnVlOyAvLyB0aGlzIG11c3QgYmUgc2V0IHRvIHRydWUgaW4gb3JkZXIgdG8gc3RvcCB0eXBpY2FsIG5leHQtZXhhbSBjbGllbnQvdGVhY2hlciBhY3Rpb25zXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gbG9jYWxsb2NrZG93blwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdmlydHVhbGl6ZWQgc3RhdHVzXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigndmlydHVhbGl6ZWQnLCAoKSA9PiB7ICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gdHJ1ZTsgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IEZPQ1VTIHN0YXRlIHRvIGZhbHNlIChtb3VzZSBsZWZ0IGV4YW0gd2luZG93KVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdmb2N1c2xvc3QnLCAoZXZlbnQsIGN0cmxhbHQ9ZmFsc2UpID0+IHsgXG4gICAgICAgICAgICBsZXQgYW5zd2VyID0gZmFsc2UgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgIXRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1tb2RlKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZX1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPiAwKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkICYmIGN0cmxhbHQgPT0gZmFsc2UpeyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGZvY3VzbG9zdDogbW91c2VsZWF2ZSBldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICBcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGJsb2NrIGV2ZXJ5dGhpbmcgYW5kIGluZm9ybSB0ZWFjaGVyICAocHJvYmFibHkgYW4gb3ZlcmtpbGwgb24gbW91c2VsZWF2ZSAtIG5lZWRzIHRlc3RpbmcpXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGFuc3dlclxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIG1haW4gY29uZmlnIG9iamVjdFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb25maWcgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogVW5sb2NrIENvbXB1dGVyXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdncmFjZWZ1bGx5ZXhpdCcsICgpID0+IHsgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBncmFjZWZ1bGx5ZXhpdDogZ3JhY2VmdWxseSBsZWF2aW5nIGxvY2tlZCBleGFtIG1vZGVgKVxuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdyYWNlZnVsbHlFbmRFeGFtKCkgXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICB9IClcblxuICAgICAgICAvKipcbiAgICAgICAgKiBzdG9wIHJlc3RyaWN0aW9uc1xuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdHJpY3Rpb25zJywgKCkgPT4geyAgXG4gICAgICAgICAgICAvL3RoaXMgYWxzbyBzdG9wcyB0aGUgY2xlYXJDbGlwYm9hcmQgaW50ZXJ2YWxcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIFxuICAgICAgICB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIGNvcHkgdG8gZ2xvYmFsIGNsaXBib2FyZFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2xpcGJvYXJkJywgKGV2ZW50LCB0ZXh0KSA9PiB7ICBcbiAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7ICAgIGFkZHJlc3MgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7ICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBtdWx0aWNhc3RjbGllbnQgbm90IHJ1bm5pbmdcIik7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBiZXJlaXRzIGVpbmUgQWRyZXNzZSB2b3JoYW5kZW4gaXN0LCBsaWVmZXJuIHdpciBzaWUgenVyXHUwMEZDY2suXG4gICAgICAgICAgICBpZiAoYWRkcmVzcykgeyAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDsgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyc3VjaGUsIGFuIGRpZSBrb3JyZWt0ZSBTY2huaXR0c3RlbGxlIHp1IGJpbmRlblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBGYWxscyBnYXRld2F5NHN5bmMoKSBibG9ja2llcmVuZCBpc3QsIGthbm5zdCBkdSBkaWVzZW4gQXVmcnVmIGluIGVpbiBQcm9taXNlIHBhY2tlbjpcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2UgfSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdhdGV3YXk0c3luYygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikgeyAgcmVqZWN0KGVycik7ICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpOyAvLyBMaWVmZXJ0IGRpZSBJUCBkZXIgU2Nobml0dHN0ZWxsZSwgd2VsY2hlIGRhcyBEZWZhdWx0IEdhdGV3YXkgaGF0XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMga2VpbmUgSVAgKG1pdCBHYXRld2F5KSB2ZXJmXHUwMEZDZ2JhciBpc3QsIGhvbGUgZWluZSBhbHRlcm5hdGl2ZSBBZHJlc3NlXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKTsgLy8gTGllZmVydCBhdWNoIGVpbmUgSVAsIHdlbm4ga2VpbiBHYXRld2F5IHZlcmZcdTAwRkNnYmFyIGlzdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcmZcdTAwRTRsc2NodGUgQWRyZXNzZW4gKHouIEIuIGxvY2FsaG9zdCkgaWdub3JpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PT0gXCIxMjcuMC4wLjFcIikgeyAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTsgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFdlbm4gZGllIE11bHRpY2FzdC1DbGllbnQgbmljaHQgbFx1MDBFNHVmdCwgaW5pdGlhbGlzaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgIWFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGYWxscyBpbml0KCkgYXN5bmNocm9uIHVtZ2VzZXR6dCB3ZXJkZW4ga2Fubiwgd2FydGVuIHdpciBoaWVyIGRhcmF1Zi5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7ICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IEVycm9yIGluaXRpYWxpemluZyBtdWx0aWNhc3QgY2xpZW50XCIsIGVycik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwO1xuICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gZWRpdG9yIGFzIGh0bWwgZmlsZSAtIGFzIGJhY2t1cCAtIG9ubHkgdHJpZ2dlcmVkIGJ5IHRoZSB0ZWFjaGVyIGZvciBub3cgKGFsbG93IG1hbnVhbCBiYWNrdXAgISEpXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7Y2xpZW50bmFtZTp0aGlzLmNsaWVudG5hbWUsIGZpbGVuYW1lOmAke2ZpbGVuYW1lfS5odG1sYCwgZWRpdG9yY29udGVudDogZWRpdG9yY29udGVudCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZUhUTUwnLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGh0bWxDb250ZW50ID0gYXJncy5lZGl0b3Jjb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGxldCBodG1sZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2BcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKXtcbiAgICAgICAgICAgICAgICBodG1sZmlsZW5hbWUgPSBgJHtmaWxlbmFtZX0uYmFrYFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IGNyZWF0aW5nIG1hbnVhbCBiYWNrdXAgYXMgJHtodG1sZmlsZW5hbWV9YClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaHRtbGZpbGUgPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgaHRtbGZpbGVuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGh0bWxDb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGh0bWxmaWxlLCBodG1sQ29udGVudCwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6ICR7ZXJyLm1lc3NhZ2V9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsdGVybmF0ZXBhdGggPSBgJHtodG1sZmlsZX0tJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufS5iYWtgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiB0cnlpbmcgdG8gd3JpdGUgZmlsZSBhczpcIiwgYWx0ZXJuYXRlcGF0aCApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGh0bWxDb250ZW50LCBmdW5jdGlvbiAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGJhc2U2NCBlbmNvZGVkIHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQREZiYXNlNjQnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldFBERmJhc2U2NDogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciA9IGFyZ3Muc3VibWlzc2lvbm51bWJlcisxIC8vIGNsaWVudGluZm8ga2VlcHMgdHJhY2sgb2Ygc3VibWlzc2lvbnMgZm9yIGF1dG9tYXRlZCBzdWJtaXNzaW9ubnVtYmVycyBhdCBzZWN0aW9uIGNoYW5nZSAtIGJ1dCB0aGlzIG9idmlvdXNseSBoYXBwZW5zIGFmdGVyIG1hbnVhbCBzdWJtaXRcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdldEJhc2U2NFBERihhcmdzLnN1Ym1pc3Npb25udW1iZXIsIGFyZ3Muc2VjdGlvbm5hbWUsIGFyZ3MucHJpbnRCYWNrZ3JvdW5kKSAgIC8vIHdoeSB0aGUgaGVsbCBpcyB0aGlzIGZ1bmN0aW9uIGxvY2F0ZWQgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgYW5kIG5vdCBpbiBpcGNoYW5kbGVyLmpzID8gRklYTUUgIVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgdGhlIEV4YW1XaW5kb3cgY29udGVudCBhcyBQREZcbiAgICAgICAgICogQVRURU5USU9OIHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgcmV0dW5zIGEgYmFzZTY0IHZlcnNpb24gb2YgdGhlIHBkZlxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ByaW50cGRmJywgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgLy8gZG8gbm90IHByaW50IGlmIGV4YW0gbW9kZSBpcyBub3QgYWN0aXZlIGFueW1vcmVcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZXhhbW1vZGUgaXMgZmFsc2UgLSBza2lwcGluZyBwcmludFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogcHJpbnQgYWxyZWFkeSBpbiBwcm9ncmVzcyAtIHNraXBwaW5nIG5ldyByZXF1ZXN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgLy8gZGVmaW5lIHByaW50IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBhcmdzLmxhbmRzY2FwZSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuICAgICAgICAgICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHthcmdzLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke2FyZ3MuY2xpZW50bmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHBkZmZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5wZGZgICAvLyBkZWZhdWx0IGZpbGVuYW1lID0gY2xpZW50bmFtZS5wZGZcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5maWxlbmFtZSl7ICAvLyBpbiBjYXNlIG9mIG1hbnVhbCBiYWNrdXAgdGhlIHVzZXIgY2FuIHNldCBhIGN1c3RvbSBmaWxlbmFtZVxuICAgICAgICAgICAgICAgICAgICBwZGZmaWxlbmFtZSA9IGAke2FyZ3MuZmlsZW5hbWV9LnBkZmBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogY3JlYXRpbmcgbWFudWFsIGJhY2t1cCBhcyAke3BkZmZpbGVuYW1lfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZmZpbGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHBkZmZpbGVuYW1lKTsgIC8vIHBhdGggcG9pbnRzIHRvIHRoZSBjdXJyZW50IGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tYXV4LnBkZmAgICAgLy90aG9tYXMucGRmLWF1eC5wZGYgXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tb2xkLnBkZmA7ICAgLy90aG9tYXMucGRmLW9sZC5wZGZcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWZpbGVuYW1lKTsgIC8vIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nIHdlIHRyeSB0byB3cml0ZSBhIGRpZmZlcmVudCBmaWxlXG5cblxuICAgICAgICAgICAgICAgIC8vIGF1eCBmaWxlcyBhcmUgZmlsZXMgY3JlYXRlZCBpZiB0aGUgbWFpbiBwZGZmaWxlcGF0aCBpcyBub3Qgd3JpdGVhYmxlIChvcGVuZWQgb24gd2luZG93cykgXG4gICAgICAgICAgICAgICAgdHJ5IHsgIC8vIGFsd2F5cyBjaGVjayBmb3Igb2xkIGF1eCBmaWxlcyBhbmQgcmVuYW1lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBhbHRlcm5hdGVmaWxlbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoYWx0ZXJuYXRlcGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbVdpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICAgICAgY29uc3Qgd2ViQ29udGVudHMgPSBleGFtV2luZG93Py53ZWJDb250ZW50c1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3ZWJDb250ZW50cyl7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogbm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgLy8gcHJpbnQgdGhlIGV4YW0gd2luZG93IHRvIHBkZlxuICAgICAgICAgICAgICAgIHdlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucykudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgcGRmIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKHBkZmZpbGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKHBkZmZpbGVwYXRoKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUocGRmZmlsZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX0gLSB3cml0aW5nIGZpbGUgYXM6ICR7YWx0ZXJuYXRlcGF0aH0gYCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIGF1eCBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0ZXBhdGgpKSB7IGZzLnVubGlua1N5bmMoYWx0ZXJuYXRlcGF0aCk7IH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGYgKGFsdGVybmF0aXZlciBQZmFkKTogJHtlcnIubWVzc2FnZX1gKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGFsdGVybmF0ZSBwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKSAgIC8vbWFrZSBzdXJlIHN0dWRlbnRzIHNlZSB0aGUgbmV3IGZpbGUgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVycm9yLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlcyBBY3RpdmUgU2hlZXRzIGZvcm0gZGF0YSB0byAuYmFrIGZpbGVcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3NhdmVBY3RpdmVzaGVldHNCYWsnLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lID8gYCR7YXJncy5maWxlbmFtZX0uYmFrYCA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBiYWtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBmb3JtRGF0YSB0byBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25EYXRhID0gSlNPTi5zdHJpbmdpZnkoYXJncy5mb3JtRGF0YSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gLmJhayBmaWxlXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYWtGaWxlUGF0aCwganNvbkRhdGEsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiBzYXZlZCBmb3JtIGRhdGEgdG8gJHtiYWtGaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0JhazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgZm91bmQgU2VydmVycyBhbmQgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGluZm9hc3luYycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IGZhbHNlICAgXG4gICAgICAgICAgICAvLyBzZXJ2ZXJzdGF0dXMgb2JqZWt0IHdpcmQgbnVyIGJlaSBiZWdpbm4gZGVzIGV4YW1zIGFuIGRhcyBleGFtIHdpbmRvdyBkdXJjaGdlcmVpY2h0IGZcdTAwRkNyIGJhc2lzIGVpbnN0ZWxsdW5nZW5cbiAgICAgICAgICAgIC8vIGFsbGUgd2VpdGVyZW4gdXBkYXRlcyBcdTAwRkNiZXIgZGFzIHNlcnZlcnN0YXR1cyBvYmplY3Qgd2VyZGVuIGltIGNvbW11bmljYXRpb24gaGFuZGxlciBnZWxlc2VuIHVuZCBnZ2YuIGF1ZiBkYXMgY2xpZW50aW5mbyBvYmplY3QgZ2VsZWd0XG4gICAgICAgICAgICAvLyBkaWVzZXIga29tbXVuaWthdGlvbnNmbHVzcyBtdXNzIGluIDIuMCBnZXN0cmVhbWxpbmVkIHdlcmRlbiAjRklYTUVcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNlcnZlcnN0YXR1cyB9XG5cbiAgICAgICAgICAgIC8vY291bnQgbnVtYmVyIG9mIGZpbGVzIGluIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAvLyBlcnN0ZWxsdCBmYWxscyBuXHUwMEY2dGlnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVsaXN0ID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgcmV0dXJuIHsgICBcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsaXN0OiB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCxcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYmVjYXVzZSBvZiBtaWNyb3NvZnQgMzY1IHdlIG5lZWQgdG8gd29yayB3aXRoIFwiQnJvd3NlclZpZXdcIiBcbiAgICAgICAgICogaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBkaXNsYXkgZnVsbHNjcmVlbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBFeGFtIGhlYWRlciB3ZSB0ZW1wb3JhcmlseSBjb2xsYXBzZSB0aGUgQnJvd3NlclZpZXcgZm9yIE9mZmljZVxuICAgICAgICAgKiBhbmQgcmVzdG9yZSBpdCBhZnRlcndhcmRzIC0gbm90IHBlcmZlY3QgYnV0IGxvb2tzIG9rXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY29sbGFwc2UtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7IHg6IDAsIHk6IDAsIHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RvcmUtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IG1lbnVIZWlnaHQgPSBtYWluV2luZG93Lm1lbnVIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpOyAvLyBHZXQgdGhlIGN1cnJlbnQgYm91bmRzIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5ldyBib3VuZHMgb2YgdGhlIGNvbnRlbnRWaWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogbWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLCAvLyBmdWxsIHdpZHRoIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gbWVudUhlaWdodCAvLyByZW1haW5pbmcgaGVpZ2h0IGFmdGVyIHRoZSBtZW51XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZSBtZW51IGhlaWdodCBkeW5hbWljYWxseSB3aGVuIGhlYWRlciBjb250ZW50IGNoYW5nZXNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3VwZGF0ZS1tZW51LWhlaWdodCcsIChldmVudCwgaGVpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3c7XG4gICAgICAgICAgICBpZiAobWFpbldpbmRvdyAmJiBoZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBzdG9yZWQgbWVudSBoZWlnaHRcbiAgICAgICAgICAgICAgICBtYWluV2luZG93Lm1lbnVIZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVwb3NpdGlvbiB0aGUgYnJvd3NlciB2aWV3IHdpdGggbmV3IGhlaWdodFxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50Vmlldykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlbmRzIGEgcmVnaXN0ZXIgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gc2VydmVyIGlwXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICBjbGllbnRuYW1lOnRoaXMudXNlcm5hbWUsIHNlcnZlcm5hbWU6c2VydmVybmFtZSwgc2VydmVyaXAsIHNlcnZlcmlwLCBwaW46dGhpcy5waW5jb2RlIFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigncmVnaXN0ZXInLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSBhcmdzLmNsaWVudG5hbWVcbiAgICAgICAgICAgIGNvbnN0IHBpbiA9IGFyZ3MucGluXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJpcCA9IGFyZ3Muc2VydmVyaXBcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudGlwID0gaXAuYWRkcmVzcygpXG4gICAgICAgICAgICBjb25zdCBob3N0bmFtZSA9IG9zLmhvc3RuYW1lKClcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmNvbmZpZy52ZXJzaW9uXG4gICAgICAgICAgICBjb25zdCBiaXB1c2VySUQgPSBhcmdzLmJpcHVzZXJJRFxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7IC8vI0ZJWE1FIGRhcyBzb2xsdGUgZWlnZW50bGljaCB2b20gc2VydmVyIGtvbW1lbiBcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3JlZ2lzdGVyY2xpZW50LyR7c2VydmVybmFtZX0vJHtwaW59LyR7Y2xpZW50bmFtZX0vJHtjbGllbnRpcH0vJHtob3N0bmFtZX0vJHt2ZXJzaW9ufS8ke2JpcHVzZXJJRH1gO1xuICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gQWJvcnRTaWduYWwudGltZW91dCg4MDAwKTsgLy8gODAwMCBNaWxsaXNla3VuZGVuID0gOCBTZWt1bmRlbiBBYm9ydFNpZ25hbCBtaXQgZWluZW0gVGltZW91dFxuXG5cbiAgICAgICAgICAgIGZldGNoKHVybCwgeyBtZXRob2Q6ICdHRVQnLCBzaWduYWwgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PSBcInN1Y2Nlc3NcIikgeyAgLy8gcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWxsIG90aGVyd2lzZSBkYXRhIHdvdWxkIGJlIFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAvLyBFcmZvbGdyZWljaGUgUmVnaXN0cmllcnVuZ1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBjbGllbnRuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gc2VydmVyaXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IHNlcnZlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBjbGllbnRpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZGF0YS50b2tlbjsgLy8gd2UgbmVlZCB0byBzdG9yZSB0aGUgY2xpZW50IHRva2VuIGluIG9yZGVyIHRvIGNoZWNrIGFnYWluc3QgaXQgYmVmb3JlIHByb2Nlc3NpbmcgY3JpdGljYWwgYXBpIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IHBpbjtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCByZWdpc3Rlcjogc3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgYXQgJHtzZXJ2ZXJuYW1lfSBAICR7c2VydmVyaXB9IGFzICR7Y2xpZW50bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBkYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGV4YW0gZm9sZGVyIGluIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHVuaXF1ZWV4YW1OYW1lID0gYCR7c2VydmVybmFtZX0tJHtwaW59YFxuICAgICAgICAgICAgICAgICAgICBjb25maWcuZXhhbWRpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgdW5pcXVlZXhhbU5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudmVyc2lvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHZlcnNpb25zIGFuZCBkaXNwbGF5IG1lc3NhZ2UgKHRlYWNoZXIgbmVlZHMgdXBncmFkZS4uIGNsaWVudCBuZWVkcyB1cGdyYWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcGFyaXNvblJlc3VsdCA9IHRoaXMuY29tcGFyZVNvZnR3YXJlKGNvbmZpZy52ZXJzaW9uLCBjb25maWcuaW5mbyAsIGRhdGEudmVyc2lvbiwgZGF0YS52ZXJzaW9uaW5mbyApIC8vc2VydmVyVmVyc2lvbiwgc2VydmVyU3RhdHVzLCBsb2NhbFZlcnNpb24sIGxvY2FsU3RhdHVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHsgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCBuZXVlciBhbHMgZGllIGRlciBMZWhycGVyc29uIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IHp1IGFsdC4gTGFkZW4gc2llIHNpY2ggZWluZSBha3R1ZWxsZSBWZXJzaW9uIGhlcnVudGVyIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW5iZWthbm50ZXIgRmVobGVyIGJlaW0gVmVyYmluZHVuZ3NhdWZiYXUuXCIgfTsgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChhc3luYyBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmVobGVyYmVoYW5kbHVuZ1xuICAgICAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHsgZXJyb3JNZXNzYWdlID0gXCJUaGUgcmVxdWVzdCB0aW1lZCBvdXRcIjsgICB9IC8vIFRpbWVvdXQtTmFjaHJpY2h0IGFucGFzc2VuIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBvbiBtYWNvcyB0aGUgcGVybWlzc2lvbiBzZXR0aW5ncyBpbiByYXJlIGNhc2VzIG1lc3MgdXAgdGhlIGFiaWxpdHkgdG8gZmV0Y2ggdGhlIHRlYWNoZXIgYXBpIFxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKXsgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCB0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0KTsgXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZSA9PT0gXCJyZXNldFwiKSB7ICAgLy8gcXVpdCB0aGUgYXBwIGlmIHRoZSB1c2VyIHdhbnRzIHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNob3cgd2FybmluZyBtZXNzYWdlIGlmIHRoZSB1c2VyIGRvZXMgbm90IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcyBnaWJ0IGVpbiBQcm9ibGVtIG1pdCBkZW0gTmV0endlcmssIGRlbiBGaXJld2FsbHJlZ2VsbiBvZGVyIGRlbiBOZXR6d2Vya2JlcmVjaHRpZ3VuZ2VuISBCaXR0ZSBiZWhlYmVuIHNpZSBkaWVzZXMgUHJvYmxlbSB1bmQgc3RhcnRlbiBTaWUgTmV4dC1FeGFtIG5ldSFcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgICAgICAgICByZXR1cm47ICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBHZW9nZWJyYSBhcyBnZ2IgZmlsZSAtIGFzIGJhY2t1cCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgLCBjb250ZW50OiBiYXNlNjQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NhdmVHR0InLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhcmdzLmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgY29uc3QgcmVhc29uID0gYXJncy5yZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2F2ZUdHQjogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gQnVmZmVyLmZyb20oY29udGVudCwgJ2Jhc2U2NCcpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhnZ2JGaWxlUGF0aCwgZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVzdG9yZWRcIikgLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnIpICBcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVHR0I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBsb2FkIGNvbnRlbnQgZnJvbSBnZ2IgZmlsZSBhbmQgc2VuZCBpdCB0byB0aGUgZnJvbnRlbmQgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnbG9hZEdHQicsIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhZCB0aGUgZmlsZSBhbmQgY29udmVydCBpdCB0byBiYXNlNjRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhnZ2JGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZTY0R2diRmlsZSA9IGZpbGVEYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6YmFzZTY0R2diRmlsZSwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9ICAgICBcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHRVQgUERGIG9yIElNQUdFIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwZGZhc3luYycsIChldmVudCwgZmlsZW5hbWUsIGltYWdlID0gZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbWFnZSl7IHJldHVybiBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBiYXNlNjQgc3RyaW5nIG9mIGF1ZGlvZmlsZSBmcm9tIHdvcmtkaXJlY3Rvcnkgb3IgcHVibGljIGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEF1ZGlvRmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIHB1YmxpY2Rpcj1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpO1xuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiAhcHVibGljZGlyKSB7IC8vIFJldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvclxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgcHVibGljZGlyKSB7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi8uLi9wdWJsaWNcIixmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgRklMRS1MSVNUIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGZpbGVzYXN5bmMnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBhdWRpbz1mYWxzZSwgZG9jeD1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXJndW1lbnRzOlwiLCBmaWxlbmFtZSwgYXVkaW8sIGRvY3gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG5cbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gPT0gdHJ1ZSl7IC8vIGF1ZGlvIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRvY3gpeyAgLy9vZmZpY2Ugb3BlbiB4bWwgZmlsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbWFtbW90aC5jb252ZXJ0VG9IdG1sKHtwYXRoOiBmaWxlcGF0aH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgICAvL2JhayBmaWxlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgLy8gcmV0dXJuIGZpbGUgbGlzdCBvZiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7IGZzLm1rZGlyU3luYyh3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH0gLy9kbyBub3QgY3Jhc2ggaWYgdGhlIGRpcmVjdG9yeSBpcyBkZWxldGVkIGFmdGVyIHRoZSBhcHAgaXMgc3RhcnRlZCBeXlxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZWxpc3QgPSAgZnMucmVhZGRpclN5bmMod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgICAgICAgICAgICAgZmlsZWxpc3QuZm9yRWFjaCggZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kaWZpZWQgPSBmcy5zdGF0U3luYyggICBwYXRoLmpvaW4od29ya2RpcixmaWxlKSAgKS5tdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZCA9IG1vZGlmaWVkLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucGRmXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJwZGZcIiwgbW9kOiBtb2R9KSAgIH0gICAgICAgICAvL3BkZlxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5iYWtcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImJha1wiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgYmFja3VwIGZpbGUgdG8gcmVwbGFjZSBlZGl0b3IgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5kb2N4XCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJkb2N4XCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBjb250ZW50IGZpbGUgKGZyb20gdGVhY2hlcikgdG8gcmVwbGFjZSBjb250ZW50IGFuZCBjb250aW51ZSB3cml0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdnYlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZ2diXCIsIG1vZDogbW9kfSkgICB9ICAvLyBnZW9nZWJyYVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5tcDNcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIub2dnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLndhdlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImF1ZGlvXCIsIG1vZDogbW9kfSkgICB9ICAvLyBhdWRpb1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5qcGdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucG5nXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdpZlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImltYWdlXCIsIG1vZDogbW9kfSkgICB9ICAvLyBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEJBQ0tVUCBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZmlsZW5hbWUgd2l0aG91dFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRiYWNrdXBmaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBSZXF1ZXN0IHJlY2VpdmVkIGZvciBmaWxlbmFtZTogJHtmaWxlbmFtZX1gKVxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEZ1bGwgZmlsZSBwYXRoOiAke2ZpbGVwYXRofWApXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVwYXRoKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIG5vdCBmb3VuZDogJHtmaWxlcGF0aH1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBleGlzdHMsIHJlYWRpbmcgY29udGVudGApXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogU3VjY2Vzc2Z1bGx5IHJlYWQgYmFja3VwIGZpbGUsIGNvbnRlbnQgbGVuZ3RoOiAke2RhdGEubGVuZ3RofWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3IgcmVhZGluZyBiYWNrdXAgZmlsZTogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciBzdGFjazogJHtlcnIuc3RhY2t9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBubyBmaWxlbmFtZSBwcm92aWRlZGApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigncmVsb2FkLXVybCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUVhc3RlcldpbigpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQXBwZW5kIFByaW50UmVxdWVzdCB0byBjbGllbnRpbmZvICBcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzZW5kUHJpbnRSZXF1ZXN0JywgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IHRydWUgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0LWNwdS1pbmZvJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuaXNWaXJ0dWFsTWFjaGluZSgpXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdsYW4taW5mbycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2xhbkluZm8gPSBhd2FpdCBnZXRXbGFuSW5mbygpO1xuICAgICAgICAgICAgcmV0dXJuIHdsYW5JbmZvO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFxuICAgICAgICAvLyBOZXcgaGFuZGxlciB0byBnZXQgUERGIGZyb20gcHVibGljIGRpcmVjdG9yeSBmb3IgZnJvbnRlbmQgcGFyc2luZ1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UGRmRnJvbVB1YmxpYycsIGFzeW5jIChldmVudCwgcGRmRmlsZW5hbWUgKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEdldCBkaXJlY3RvcnkgbmFtZSBpbiBFU01cbiAgICAgICAgICAgICAgICBjb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBwZGZQYXRoO1xuICAgICAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgICAgICBwZGZQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBGcm9tIHNjcmlwdHMvIGdvIHVwIDMgbGV2ZWxzIHRvIHJlYWNoIHN0dWRlbnQvIHRoZW4gcHVibGljL1xuICAgICAgICAgICAgICAgICAgICBwZGZQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBkZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogUERGIG5vdCBmb3VuZCBhdDogJHtwZGZQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBkZlBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuICAgIGlzVmlydHVhbE1hY2hpbmUoKSB7XG4gICAgICAgIGNvbnN0IFZFTkRPUlMgPSAvKG9yYWNsZXx2aXJ0dWFsYm94fHZtd2FyZXxrdm18cWVtdXx4ZW58aW5ub3Rla3xwYXJhbGxlbHN8bWljcm9zb2Z0fGh5cGVyLXZ8Ymh5dmV8cmVkIGhhdHxyZWRoYXR8Ym9jaHN8Ymh5dmV8b3BlbnN0YWNrfGNsb3VkfGFtYXpvbnxnb29nbGV8YXp1cmUpL2kgLy8gY29tbW9uIFZNIGlkc1xuICAgICAgICBjb25zdCB3YXJuQW5kUmV0dXJuID0gcmVhc29uID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgaXNWaXJ0dWFsTWFjaGluZTogVmVyZGFjaHQgYXVmIFZNIC0gJHtyZWFzb259YClcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIExpbnV4IC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3B1aW5mbyA9IHJlYWRGaWxlU3luYygnL3Byb2MvY3B1aW5mbycsICd1dGY4JykgICAgICAvLyBDUFUgZmxhZ3NcbiAgICAgICAgICAgIGlmICgvXmZsYWdzLipcXGJoeXBlcnZpc29yXFxiL20udGVzdChjcHVpbmZvKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ2h5cGVydmlzb3IgZmxhZyBpbiAvcHJvYy9jcHVpbmZvJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBbXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9zeXNfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfbmFtZScsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X3ZlcnNpb24nLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYm9hcmRfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2Jpb3NfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2NoYXNzaXNfdmVuZG9yJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgZG1pID0gZmlsZXMubWFwKHAgPT4geyB0cnkgeyByZXR1cm4gcmVhZEZpbGVTeW5jKHAsICd1dGY4JykgfSBjYXRjaCB7IHJldHVybiAnJyB9IH0pLmpvaW4oJyAnKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChkbWkpKSByZXR1cm4gd2FybkFuZFJldHVybignRE1JLVZlbmRvci1NYXRjaCcpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdzeXN0ZW1kLWRldGVjdC12aXJ0IC1xJywgeyBzdGRpbzogJ2lnbm9yZScgfSkgICAgLy8gZXhpdCAwID0+IFZNXG4gICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignc3lzdGVtZC1kZXRlY3QtdmlydCBtZWxkZXQgVmlydHVhbGlzaWVydW5nJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAvLyBadXNcdTAwRTR0emxpY2hlIFFFTVUtc3BlemlmaXNjaGUgRXJrZW5udW5nXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtc3BlemlmaXNjaGUgR2VyXHUwMEU0dGVcbiAgICAgICAgICAgIGNvbnN0IHFlbXVEZXZpY2VzID0gW1xuICAgICAgICAgICAgICAnL2Rldi92aG9zdC12c29jaydcbiAgICAgICAgICAgIF1cbiAgICAgICAgICAgIGZvciAoY29uc3QgZGV2aWNlIG9mIHFlbXVEZXZpY2VzKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcXVpcmUoJ2ZzJykuZXhpc3RzU3luYyhkZXZpY2UpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybihgUUVNVS1HZXJcdTAwRTR0IGdlZnVuZGVuOiAke2RldmljZX1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtUHJvemVzc2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPSBleGVjU3luYygncHMgYXV4IHwgZ3JlcCAtaSBxZW11JywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAocHMuaW5jbHVkZXMoJ3FlbXUnKSAmJiAhcHMuaW5jbHVkZXMoJ2dyZXAnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIGxcdTAwRTR1ZnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gV2luZG93cyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIoR2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtIHwgRm9yRWFjaC1PYmplY3QgeyAkXy5NYW51ZmFjdHVyZXIsICRfLk1vZGVsIH0pIC1qb2luIFxcJyBcXCdcIidcbiAgICAgICAgICAgIGNvbnN0IGJhc2ljID0gZXhlY1N5bmMocHMsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKCkgICAgLy8gbWFudWZhY3R1cmVyICsgbW9kZWxcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoYmFzaWMpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL01vZGVsbCBwYXNzdCB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwc1JvYnVzdCA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRvPUAoKTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW07JG8rPUAoJGNzLk1hbnVmYWN0dXJlciwkY3MuTW9kZWwpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmI9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0Jhc2VCb2FyZDskbys9QCgkYmIuTWFudWZhY3R1cmVyLCRiYi5Qcm9kdWN0KX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJpb3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0JJT1M7JG8rPUAoJGJpb3MuU01CSU9TQklPU1ZlcnNpb24pfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3NwPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3Q7JG8rPUAoJGNzcC5OYW1lKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICdXcml0ZS1PdXRwdXQgKCgkbyAtam9pbiBcXCcgXFwnKS5UcmltKCkpXCInXG4gICAgICAgICAgICBjb25zdCByb2J1c3QgPSBleGVjU3luYyhwc1JvYnVzdCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChyb2J1c3QpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL0JJT1MtSW5mb3MgcGFzc2VuIHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLUVya2VubnVuZyBmXHUwMEZDciBXaW5kb3dzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHFlbXVQcm9jZXNzZXMgPSBleGVjU3luYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIHFlbXUqXCInLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgICAgICBpZiAocWVtdVByb2Nlc3Nlcy5pbmNsdWRlcygncWVtdScpKSByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIHVudGVyIFdpbmRvd3MnKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cblxuICAgICAgICAgLy8gLS0tLS0tLS0tLSBtYWNPUyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGh3TW9kZWwgPSBleGVjU3luYygnc3lzY3RsIC1uIGh3Lm1vZGVsJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoL152aXJ0dWFsL2kudGVzdChod01vZGVsKSB8fCBWRU5ET1JTLnRlc3QoaHdNb2RlbCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBIYXJkd2FyZW1vZGVsbCBkZXV0ZXQgYXVmIFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gZXhlY1N5bmMoJ3N5c3RlbV9wcm9maWxlciBTUEhhcmR3YXJlRGF0YVR5cGUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qoc3ApKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1Mgc3lzdGVtX3Byb2ZpbGVyIG1lbGRldCBWTS1WZW5kb3InKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlICAgICAgIFxuICAgIH1cblxuICAgIGNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpIHtcbiAgICAgICAgY29uc3QgcGFydHNBID0gdmVyc2lvbkEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgY29uc3QgcGFydHNCID0gdmVyc2lvbkIuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBudW1BID0gcGFydHNBW2ldIHx8IDA7IC8vIEZhbGxiYWNrIGF1ZiAwLCBmYWxscyBrZWluIFdlcnQgdm9yaGFuZGVuXG4gICAgICAgICAgICBjb25zdCBudW1CID0gcGFydHNCW2ldIHx8IDA7XG4gICAgXG4gICAgICAgICAgICBpZiAobnVtQSA8IG51bUIpIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmIChudW1BID4gbnVtQikgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IG51bWJlckEgPSBwYXJzZUludChzdGF0dXNBLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgICAgICBjb25zdCBudW1iZXJCID0gcGFyc2VJbnQoc3RhdHVzQi5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICBcbiAgICAgICAgaWYgKG51bWJlckEgPCBudW1iZXJCKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChudW1iZXJBID4gbnVtYmVyQikgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGNvbXBhcmVTb2Z0d2FyZSh2ZXJzaW9uQSwgc3RhdHVzQSwgdmVyc2lvbkIsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkNvbXBhcmlzb24gPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpO1xuICAgICAgICBpZiAodmVyc2lvbkNvbXBhcmlzb24gIT09IDApIHJldHVybiB2ZXJzaW9uQ29tcGFyaXNvbjtcbiAgICBcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpO1xuICAgIH1cblxuXG59XG4gXG5leHBvcnQgZGVmYXVsdCBuZXcgSXBjSGFuZGxlcigpXG4iLCAiaW1wb3J0IHtjcmVhdGVJMThufSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbWVzc2FnZXM6IHtcbiAgICAgICAgZW4sXG4gICAgICAgIGRlXG4gICAgICB9XG4gIH0pXG5cbmV4cG9ydCBkZWZhdWx0IGkxOG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiUmVzdG9yZVwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiRGlzY29ubmVjdFwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiRXhpdFwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIkV4YW1zXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJVc2VybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyIGFkZHJlc3NcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiRXhhbSBOYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJyZWdpc3RlclwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwicmVnaXN0ZXJpbmcuLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwicmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcImRpc2Nvbm5lY3RlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgb24gc2VydmVyISBcXG5cXG5QbGVhc2Ugd2FpdCBmb3IgdGhlIGFjdGl2YXRpb24gb2YgdGhlIGV4YW0gbW9kZSBieSB0aGUgdGVhY2hlciFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwic2VhcmNoIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJub3B3XCI6IFwid3JvbmcgdXNlcm5hbWUgb3IgcGluXCIsXG4gICAgICAgIFwibm91c2VyXCI6XCJubyB1c2VybmFtZSBnaXZlblwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZGRyZXNzZSBvZGVyIEV4YW1uYW1lIG1pc3NpbmdcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJubyBwaW5jb2RlIGdpdmVuXCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjpcIlNlcnZlciBBUEkgdW5yZWFjaGFibGVcIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgaXMgYmVoaW5kIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiTm8gVGVhY2hlciBBUEkgZm91bmQgb24gdGhlIGdpdmVuIGFkZHJlc3NcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2NhbCBsb2NrZG93blwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWFsIHNlYXJjaFwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIk5vIGV4YW1zIGZvdW5kXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nb3V0P1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJhY3RpdmF0ZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlc1wiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGljc1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiU2VsZWN0IGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIlBsZWFzZSBpbnN0YWxsIHRoZSBzYW1lIHZlcnNpb24gYXMgdGhlIGV4YW0gc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInNhZmUgZXhhbSBzdGF0dXMgY2hhbmdlZFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCBhbHJlYWR5IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwic3RhcnRlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJzdG9wcGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwic2FmZSBleGFtIG1vZGUgbm90IGFjdGl2ZVwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwic3R1ZGVudCByZW1vdmVkIGZyb20gc2VydmVyXCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiZmlsZXMgc3RvcmVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJmaWxlIGVycm9yXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcInBsZWFzZSBjaGVjayBpZiB0aGUgJ0VYQU0tU1RVREVOVCcgZGlyZWN0b3J5IGlzIHdyaXRlYWJsZSBhbmQgaGFzIGVub3VnaCBzcGFjZVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiQSBsb2NhbCBiYWNrdXAgY291bGQgbm90IGJlIGNyZWF0ZWQuIFBsZWFzZSB1c2UgdGhlIG1hbnVhbCBzdWJtaXNzaW9uIG9wdGlvbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcImRvbid0IHNob3cgYWdhaW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGZvdW5kXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiR2V0IG1hdGVyaWFsc1wiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJTZW5kIGZpbmFsIGV4YW1cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkZpbmFsIHN1Ym1pdFwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsczpcIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9jYWwgZmlsZXM6XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiVXBkYXRlXCIsXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BsaXR2aWV3XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiWW91IGhhdmUgbGVmdCB0aGUgc2FmZSBleGFtIG1vZGUhXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJQbGVhc2UgaW5mb3JtIGEgdGVhY2hlciFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJEbyB5b3Ugd2FudCB0byByZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoZSBlZGl0b3Igd2l0aCB0aGUgY29udGVudCBvZiBcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCI/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJDYW5jZWxcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAgZmlsZSBjb3VsZCBub3QgYmUgcmVhZFwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBzdWNjZXNzZnVsbHkgbG9hZGVkXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJFcnJvciBsb2FkaW5nIGJhY2t1cCBmaWxlXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJTdWNjZXNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJjaGFyc1wiLFxuICAgICAgICBcIndvcmRzXCI6IFwid29yZHNcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJyZWNvbm5lY3RcIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJ1bmxvY2tcIixcbiAgICAgICAgXCJleGl0XCI6IFwiRXhpdCBzYWZlIGV4YW0gbW9kZT9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJEbyBub3QgbGVhdmUgc2FmZSBleGFtIG1vZGUgd2l0aG91dCBwZXJtaXNzaW9uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJJZiB0aGlzIHByb2Nlc3MgZmFpbHMgdW5sb2NrIGFuZCB0cnkgYWdhaW4hXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJDcmVhdGluZyBiYWNrdXBcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJDcmVhdGluZyBiYWNrdXAgYW5kIGNsaXBib2FyZCBjb3B5XCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkxlYXZpbmcgRXhhbSBtb2RlXCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwiYmFja3VwXCIsXG4gICAgICAgIFwidW5kb1wiOlwidW5kb1wiLFxuICAgICAgICBcInJlZG9cIjpcInJlZG9cIixcbiAgICAgICAgXCJjbGVhclwiOlwiY2xlYXJcIixcbiAgICAgICAgXCJib2xkXCI6XCJib2xkXCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJpdGFsaWNcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVuZGVybGluZVwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJoZWFkaW5nMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJoZWFkaW5nMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJoZWFkaW5nM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJoZWFkaW5nNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJoZWFkaW5nNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJoZWFkaW5nNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwic3Vic2NyaXB0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcInN1cGVyc2NyaXB0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwiYnVsbGV0bGlzdFwiLFxuICAgICAgICBcImxpc3RcIjpcImxpc3RcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcImNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcImNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJibG9ja3F1b3RlXCIsXG4gICAgICAgIFwibGluZVwiOlwicGFnZWJyZWFrXCIsXG4gICAgICAgIFwibGVmdFwiOlwibGVmdFwiLFxuICAgICAgICBcImNlbnRlclwiOlwiY2VudGVyXCIsXG4gICAgICAgIFwicmlnaHRcIjpcInJpZ2h0XCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJ0ZXh0Y29sb3JcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcImxpbmVicmVha1wiLFxuICAgICAgICBcIm1vcmVcIjpcIm1vcmVcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiaW5zZXJ0dGFibGVcIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiZGVsZXRldGFibGVcIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiY29sdW1uYWZ0ZXJcIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwicm93YWZ0ZXJcIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcImRlbGNvbHVtblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiZGVscm93XCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJtZXJnZW9yc3BsaXRcIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcImhlYWRlcmNvbHVtblwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiaGVhZGVycm93XCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcInNlbGVjdGVkIHdvcmRzL2NoYXJzXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcInByaW50IHJlcXVlc3Qgc2VudFwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcInByaW50IHJlcXVlc3QgZGVuaWVkXCIsXG4gICAgICAgIFwicGFzdGVcIjpcInBhc3RlXCIsXG4gICAgICAgIFwiY29weVwiOlwiY29weVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJkZWFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJSZWxvYWRcIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV291bGQgeW91IGxpa2UgdG8gcmVpbml0aWFsaXplIHRoZSBFZGl0b3I/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcImtlZXAgY29udGVudFwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJJbnNlcnQgc3BlY2lhbGNoYXJhY3RlclwiLFxuICAgICAgICBcInByaW50XCI6IFwicHJpbnRcIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIlBsYXkgQXVkaW9cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJEbyB5b3Ugd2FudCB0byBwbGF5IHRoZSBhdWRpb2ZpbGU/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlJlbWFpbmluZyBwbGF5YmFja3M6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJZb3UgZG9uJ3QgaGF2ZSB0aGUgcGVybWlzc2lvbiB0byBwbGF5IHRoaXMgZmlsZSFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkluc2VydCBJbWFnZVwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiSW5zZXJ0IE11Z3Nob3RcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJTZW5kIHdvcmsgdG8gdGVhY2hlclwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIkNsb3NlXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiRXhpdCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRmlsZW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJQbGVhc2UgZW50ZXIgb25seSBsZXR0ZXJzIGFuZCBudW1iZXJzIHdpdGhvdXQgc3BlY2lhbCBjaGFyYWN0ZXJzXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJjbGVhciBjb250ZW50P1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiTm8gdmFsaWQgUERGIEZpbGVcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiV3JvbmcgcGFzc3dvcmRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiUmVsb2FkIHdlYnZpZXdcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiV2llZGVyaGVyc3RlbGxlblwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJCZWVuZGVuXCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIkJlbnV0emVybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcIm1lbGRlIGFuLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcImFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJWZXJiaW5kdW5nIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU2llIGhhYmVuIHNpY2ggZXJmb2xncmVpY2ggYW0gU2VydmVyIHJlZ2lzdHJpZXJ0ISBcXG5cXG5CaXR0ZSB3YXJ0ZW4gU2llIGF1ZiBkaWUgQWt0aXZpZXJ1bmcgZGVzIFByXHUwMEZDZnVuZ3Ntb2R1cyBkdXJjaCBkaWUgTGVocnBlcnNvbiFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwiU3VjaGUgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkZhbHNjaGVyIEJlbnV0emVybmFtZSBvZGVyIFBpbmNvZGVcIixcbiAgICAgICAgXCJub3VzZXJcIjogXCJCZW51dHplcm5hbWUgZmVobHRcIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRyZXNzZSBvZGVyIFByXHUwMEZDZnVuZ3NuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiLFxuICAgICAgICBcIm5vcGluXCI6IFwiUGluY29kZSBmZWhsdFwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6IFwiU2VydmVyIEFQSSBuaWNodCBlcnJlaWNoYmFyLlwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBiZWZpbmRldCBzaWNoIG1cdTAwRjZnbGljaGVyd2Vpc2UgaGludGVyIGVpbmVyIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiS2VpbmUgUHJcdTAwRkNmdW5nc3NlcnZlciBhbiBhbmdlZ2ViZW5lciBBZHJlc3NlXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9rYWwgYWJzcGVycmVuXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51ZWxsIHN1Y2hlblwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIktlaW5lIFByXHUwMEZDZnVuZ2VuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiUHJcdTAwRkNmdW5nc21vZHVzIGF1c3dcdTAwRTRobGVuXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiQml0dGUgaW5zdGFsbGllcmVuIHNpZSBkaWUgc2VsYmUgVmVyc2lvbiB3aWUgYW0gUHJcdTAwRkNmdW5nc3NlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGdlc3RhcnRldFwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIG5pY2h0IGFrdGl2XCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gZW50ZmVybnRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJEYXRlaWVuIGdlc3BlaWNoZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiRmVobGVyIGJlaW0gU2NocmVpYmVuIGRlciBEYXRlaVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJCaXR0ZSBzdGVsbGVuIFNpZSBzaWNoZXIsIGRhc3MgZGFzICdFWEFNLVNUVURFTlQnIFZlcnplaWNobmlzIGZcdTAwRkNyIE5leHQtRXhhbSBzY2hyZWliYmFyIGlzdCB1bmQgZ2VuXHUwMEZDZ2VuZCBTcGVpY2hlcnBsYXR6IHZvcmhhbmRlbiBpc3QuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJFaW5lIGxva2FsZSBTaWNoZXJ1bmcga29ubnRlIG5pY2h0IGVyc3RlbGx0IHdlcmRlbi4gTnV0emVuIFNpZSBkaWUgbWFudWVsbGUgQWJnYWJlIHVtIElocmUgQXJiZWl0IGRpcmVrdCBhbiBkaWUgTGVocnBlcnNvbiB6dSBzZW5kZW4uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJOaWNodCBtZWhyIGFuemVpZ2VuXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBnZWZ1bmRlblwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuIGhvbGVuXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIkZpbmFsZSBBYmdhYmUgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkFiZ2FiZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIkFrdHVhbGlzaWVyZW5cIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9rYWxlIERhdGVpZW46XCIsXG5cbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGFsdGVuYW5zaWNodFwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIlNpZSBoYWJlbiBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJNZWxkZW4gU2llIHNpY2ggdW1nZWhlbmQgYmVpIGRlciBBdWZzaWNodHNwZXJzb24hXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiV29sbGVuIFNpZSBkZW4gSW5oYWx0IGRlcyBFZGl0b3JzIGR1cmNoIGRlbiBJbmhhbHQgZGVyIERhdGVpXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJFcnNldHplblwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwLURhdGVpIGtvbm50ZSBuaWNodCBnZWxlc2VuIHdlcmRlblwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBlcmZvbGdyZWljaCBnZWxhZGVuXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBMYWRlbiBkZXIgQmFja3VwLURhdGVpXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiRXJmb2xnXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJaZWljaGVuXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJXXHUwMEY2cnRlclwiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcIm5ldSB2ZXJiaW5kZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJlbnRzcGVycmVuXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJWZXJsYXNzZW4gU2llIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIG5pZSBvaG5lIEZyZWlnYWJlIGVpbmVyIExlaHJwZXJzb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIlNvbGx0ZSBkZXIgVm9yZ2FuZyBmZWhsc2NobGFnZW4gYmVlbmRlbiBTaWUgYml0dGUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdW5kIHZlcnN1Y2hlbiBTaWUgZXMgZXJuZXV0IVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiSWhyZSBBcmJlaXQgd3VyZGUgZXJmb2xncmVpY2ggZ2VzaWNoZXJ0IVwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkRpZSBha3R1ZWxsZSBBcmJlaXQgd2lyZCBnZXNpY2hlcnQgdW5kIGluIGRpZSBad2lzY2hlbmFibGFnZSBrb3BpZXJ0IVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJzaWNoZXJuXCIsXG4gICAgICAgIFwidW5kb1wiOlwiclx1MDBGQ2NrZ1x1MDBFNG5naWdcIixcbiAgICAgICAgXCJyZWRvXCI6XCJ3aWVkZXJob2xlblwiLFxuICAgICAgICBcImNsZWFyXCI6XCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJib2xkXCI6XCJmZXR0XCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJrdXJzaXZcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVudGVyc3RyaWNoZW5cIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiXHUwMERDYmVyc2NocmlmdCAxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiXHUwMERDYmVyc2NocmlmdCA0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInRpZWZnZXN0ZWxsdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJob2NoZ2VzdGVsbHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJ1bmdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImxpc3RcIjpcImdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiQ29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiQ29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcIlppdGF0XCIsXG4gICAgICAgIFwibGluZVwiOlwiU2VpdGVudW1icnVjaFwiLFxuICAgICAgICBcImxlZnRcIjpcIkxpbmtzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcIlplbnRyaWVydFwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJSZWNodHNiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwiVGV4dGZhcmJlXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJaZWlsZW51bWJydWNoXCIsXG4gICAgICAgIFwibW9yZVwiOlwibWVoclwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJUYWJlbGxlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiVGFiZWxsZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiU3BhbHRlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwiUmVpaGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiU3BhbHRlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiUmVpaGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJWZXJlaW5lbiBvZGVyIFRlaWxlblwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiVGl0ZWxzcGFsdGVcIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcIlRpdGVscmVpaGVcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwiV1x1MDBGNnJ0ZXIvWmVpY2hlbiBpbiBBdXN3YWhsXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcIkRydWNrYW5mcmFnZSBnZXNlbmRldCFcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJEcnVja2FuZnJhZ2UgYWJnZWxlaG50LiBCaXR0ZSB3YXJ0ZW4gdW5kIGVybmV1dCBzZW5kZW4uXCIsXG4gICAgICAgIFwicGFzdGVcIjpcImVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJjb3B5XCI6XCJrb3BpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGRlYWt0aXZpZXJlblwiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIk5ldSBsYWRlblwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb2xsZW4gU2llIGRlbiBUZXh0ZWRpdG9yIG5ldSBpbml0aWFsaXNpZXJlbj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwiSW5oYWx0IGJlaWJlaGFsdGVuXCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIlNvbmRlcnplaWNoZW4gZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiQXVkaW8gYWJzcGllbGVuXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiV29sbGVuIFNpZSBkYXMgSFx1MDBGNnJiZWlzcGllbCBqZXR6dCBhYnNwaWVsZW4/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlZlcmJsZWliZW5kZSBEdXJjaGxcdTAwRTR1ZmU6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJTaWUgaGFiZW4ga2VpbmUgQmVyZWNodGlndW5nIGRpZSBBdWRpb2RhdGVpIGVybmV1dCBhYnp1c3BpZWxlbiFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkJpbGQgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiTXVnc2hvdCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiQXJiZWl0IGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiU2NobGllXHUwMERGZW5cIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJEYXRlaW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJCaXR0ZSBnZWJlbiBTaWUgbnVyIEJ1Y2hzdGFiZW4gb2RlciBaYWhsZW4gZWluLlwiLFxuICAgICAgICBcImNsZWFyXCI6IFwiQWxsZSBCZXJlY2hudW5nZW4gbFx1MDBGNnNjaGVuP1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIGdcdTAwRkNsdGlnZSBQREYgRGF0ZWlcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiRmFsc2NoZXMgUGFzc3dvcnRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiV2VidmlldyBuZXUgbGFkZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIlxuICAgIH1cbn1cbiIsICIvLyBzY3JpcHRzL1N5c3RlbVRyYXlNYW5hZ2VyLmpzXG5pbXBvcnQgeyBhcHAsIFRyYXksIE1lbnUgfSBmcm9tICdlbGVjdHJvbic7IFxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7IC8vIFBhdGggbW9kdWxlIGltcG9ydFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnOyAvLyBMb2dnaW5nIG1vZHVsZVxuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJzsgLy8gV2luZG93IG1hbmFnZXJcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJzsgLy8gQ29tbXVuaWNhdGlvbiBsb2dpY1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyc7IC8vIEkxOG4gaW5zdGFuY2VcblxuXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IC8vIEdldCBjdXJyZW50IGRpcmVjdG9yeVxuXG5sZXQgdHJheSA9IG51bGw7IC8vIFByaXZhdGUgdHJheSBpbnN0YW5jZVxuXG4vLyBQYXRoIHRvIHRoZSBhcHAgaWNvblxuY29uc3QgaWNvblBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zJywnaWNvbjI0eDI0LnBuZycpOyBcblxuLy8gPT09IHJlcGxhY2UgdGhlIGhlbHBlciBzZXRMb2NhbGUgKGV4YWN0IGJsb2NrKSA9PT1cbmNvbnN0IHNldExvY2FsZSA9IChsb2MpID0+IHtcbiAgICBjb25zdCBnbCA9IGkxOG4uZ2xvYmFsOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IGdsb2JhbCBjb21wb3NlclxuICAgIGlmIChnbCAmJiB0eXBlb2YgZ2wubG9jYWxlID09PSAnb2JqZWN0JyAmJiBnbC5sb2NhbGUpIHtcbiAgICAgIC8vIHZ1ZS1pMThuIGNvbXBvc2l0aW9uIG1vZGVcbiAgICAgIGlmICgndmFsdWUnIGluIGdsLmxvY2FsZSkgZ2wubG9jYWxlLnZhbHVlID0gbG9jOyAgICAgLy8gc2V0IHJlYWN0aXZlIHZhbHVlXG4gICAgICBlbHNlIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGxiYWNrXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGxlZ2FjeSBtb2RlIG9yIHBsYWluIHN0cmluZ1xuICAgICAgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gc3RyaW5nIGxvY2FsZVxuICAgIH1cbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICBcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgdHJheSBpY29uIGlmIGl0IGRvZXNuJ3QgZXhpc3QgYW5kIHVwZGF0ZXMgaXRzIGNvbnRleHQgbWVudS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbmV3IGxvY2FsZSB0byBhcHBseS5cbiAqL1xuXG5cblxuZXhwb3J0IGNvbnN0IHVwZGF0ZVN5c3RlbVRyYXkgPSAobG9jYWxlKSA9PiB7XG4gICAgc2V0TG9jYWxlKGxvY2FsZSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCB0ID0gKGspID0+IGkxOG4uZ2xvYmFsLnQoayk7ICAgICAgICAgICAgICAgICAgICAgIC8vIGFsd2F5cyByZXNvbHZlIGxpdmVcbiAgXG4gICAgaWYgKCF0cmF5KSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJheSBvbmNlXG4gICAgICB0cmF5ID0gbmV3IFRyYXkoaWNvblBhdGgpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJheSBpY29uXG4gICAgICB0cmF5Lm9uKCdjbGljaycsICgpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2dnbGUgd2luZG93XG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSBcbiAgICAgICAgICA/IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5oaWRlKCkgXG4gICAgICAgICAgOiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpO1xuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICAvLyBidWlsZCBjb250ZXh0IG1lbnUgd2l0aCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IGNvbnRleHRNZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZShbXG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkucmVzdG9yZScpLCBjbGljazogKCkgPT4gV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKSB9LCAvLyBzaG93IHdpbmRvd1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmRpc2Nvbm5lY3QnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLmluZm8oXCJtYWluIEAgc3lzdGVtdHJheTogcmVtb3ZpbmcgcmVnaXN0cmF0aW9uXCIpOyBcbiAgICAgICAgICBDb21tSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKTsgXG4gICAgICAgIH0gXG4gICAgICB9LCAvLyBkaXNjb25uZWN0XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZXhpdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiBDbG9zaW5nIE5leHQtRXhhbVwiKTsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiKTsgXG4gICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7IFxuICAgICAgICAgIGFwcC5xdWl0KCk7IFxuICAgICAgICB9IFxuICAgICAgfSAvLyBleGl0XG4gICAgXSk7XG4gIFxuICAgIHRyYXkuc2V0VG9vbFRpcCgnTmV4dC1FeGFtIFN0dWRlbnQnKTsgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRvb2x0aXBcbiAgICB0cmF5LnNldENvbnRleHRNZW51KGNvbnRleHRNZW51KTsgICAgICAgICAgICAgICAgICAgICAgIC8vIGFwcGx5IG1lbnVcbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICAiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgc2NyaXB0IGlzIHVzZWQgdG8gdGVzdCB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAqIEl0IHVzZXMgdGhlIHRjY3V0aWwgY29tbWFuZCB0byB0ZXN0IGFuZCByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAqIEl0IHJldHVybnMgdHJ1ZSBpZiB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBhcmUgYWxsb3dlZCBhbmQgZmFsc2UgaWYgdGhleSBhcmUgbm90XG4gKiBcbiAqIFRoaXMgY291bGQgYWxzbyBiZSB1c2VkIHRvIHRlc3Qgb3RoZXIgcGVybWlzc2lvbnMgbGlrZSBhY2Nlc3NpYmlsaXR5LCBzY3JlZW4gY2FwdHVyZSwgZXRjLiBcbiAqIHNlZSBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBmb3IgbW9yZSBkZXRhaWxzIG9uIGhvdyB0byB0ZXN0IGZvciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIChpdHMgbm90IHBvc3NpYmxlIHRvIHRlc3QgZm9yIHNjcmVlbiBjYXB0dXJlIHBlcm1pc3Npb25zIG9uIG1hY29zIGJlY2F1c2Ugd2l0aG91dCBwZXJtaXNzaW9ucyBpdCB3aWxsIGFsd2F5cyByZXR1cm4gYSBibGFuayBzY3JlZW5zaG90IC0gd2UgdXNlIGEgd29ya2Fyb3VuZCB0byBkZXRlY3QgdGhpcylcbiAqIFxuICovXG5cblxuXG5cbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcnVuIHRjY3V0aWxcbmltcG9ydCB7IGRpYWxvZywgYXBwIH0gZnJvbSAnZWxlY3Ryb24nICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNob3cgZGlhbG9nIGFuZCBxdWl0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgICAgICAgICAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGZldGNoIHdvcmtzXG4gICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7c2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcG9uZ2AsIHsgbWV0aG9kOiAnR0VUJywgY2FjaGU6ICduby1zdG9yZScgfSkgLy8gdGVzdCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gcmVzLm9rXG4gICAgfSBjYXRjaCB7ICByZXR1cm4gZmFsc2UgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzZXRUQ0MoKSB7ICAgICAgLy8gcmVzZXQgVENDIHBlcm1pc3Npb25zXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy9hcHBJZFxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0uc3R1ZGVudGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vYXBwQnVuZGxlSWQgKHNldCB2aWEgbm90YXJpemUpXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS1zdHVkZW50LmFwcGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG5cblxuICAgIH0pXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAvLyBjaGVjayBvciByZXNldFxuICAgIGNvbnN0IG9rID0gYXdhaXQgdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KVxuICAgIGlmIChvaykge1xuICAgICAgICAgICAgbG9nLmluZm8oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBOZXR3b3JrIGFjY2VzcyBpcyBhbGxvd2VkYCk7XG4gICAgICAgICAgICByZXR1cm4gXCJva1wiO1xuICAgIH1cbiAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5vIEhUVFAgcmVxdWVzdHMgYWxsb3dlZCFgIClcblxuICAgIHRyeSB7XG5cbiAgICAgICAgLy8gYXNrIHRoZSB1c2VycyBpZiB0aGV5IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zIGFuZCBleGl0IHRoZSBhcHAgaWYgdGhleSBkb1xuICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRGVyIFNlcnZlciBpc3QgbmljaHQgZXJyZWljaGJhci4gTVx1MDBGNmNodGVuIFNpZSBkaWUgQmVyZWNodGlndW5nZW4genVyXHUwMEZDY2tzZXR6ZW4gdW5kIE5leHQtRXhhbSBtYW51ZWxsIG5ldSBzdGFydGVuPycsXG4gICAgICAgICAgICBidXR0b25zOiBbJ09LJywgJ0FiYnJlY2hlbiddLFxuICAgICAgICB9KVxuICAgICAgICBpZiAoY2hvaWNlLnJlc3BvbnNlID09PSAwKSB7ICAgIC8vIHJlc2V0IHBlcm1pc3Npb25zIGFuZCByZXR1cm4gdHJ1ZSB0byBxdWl0IHRoZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogUmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnMgYW5kIHF1aXR0aW5nIGFwcGApO1xuICAgICAgICAgICAgYXdhaXQgcmVzZXRUQ0MoKTsgXG4gICAgICAgICAgICByZXR1cm4gXCJyZXNldFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZSBcbiAgICAgICAgfSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuIFxuICAgIH0gXG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nLmVycm9yKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogRXJyb3IgcmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnM6ICR7ZX1gKTtcbiAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRmVobGVyIGJlaW0gWnVyXHUwMEZDY2tzZXR6ZW4gZGVyIEJlcmVjaHRpZ3VuZ2VuJyxcbiAgICAgICAgICAgIGRldGFpbDogU3RyaW5nKGUuZXJyIHx8IGUpLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gZmFsc2UgICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIENvdW50ZXIgZm9yIGZhaWxlZCBhdHRlbXB0cyAtIHNraXAgZXhlY3V0aW9uIGFmdGVyIDQgY29uc2VjdXRpdmUgZmFpbHVyZXNcbmxldCBmYWlsdXJlQ291bnRlciA9IDA7XG5jb25zdCBNQVhfRkFJTFVSRVMgPSAzO1xuXG4vLyBDb252ZXJ0IFJTU0kgaW4gZEJtIHRvIGEgcXVhbGl0eSBwZXJjZW50YWdlIGJldHdlZW4gMCBhbmQgMTAwLlxuZnVuY3Rpb24gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pIHtcbiAgICBpZiAoZGJtID09PSBudWxsIHx8IE51bWJlci5pc05hTihkYm0pKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBtaW5EYm0gPSAtMTAwO1xuICAgIGNvbnN0IG1heERibSA9IC0zMDtcbiAgICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgobWluRGJtLCBNYXRoLm1pbihtYXhEYm0sIGRibSkpO1xuICAgIGNvbnN0IHBlcmNlbnQgPSAoKGNsYW1wZWQgLSBtaW5EYm0pIC8gKG1heERibSAtIG1pbkRibSkpICogMTAwO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHBlcmNlbnQpO1xufVxuXG4vKipcbiAqIEdldCBjdXJyZW50IFdMQU4gaW5mb3JtYXRpb24gKFNTSUQsIEJTU0lELCBRdWFsaXR5KVxuICogQHJldHVybnMge1Byb21pc2U8e3NzaWQ6IHN0cmluZ3xudWxsLCBic3NpZDogc3RyaW5nfG51bGwsIHF1YWxpdHk6IG51bWJlcnxudWxsLCBtZXNzYWdlOiBzdHJpbmd8bnVsbH0+fVxuICogQGRlc2NyaXB0aW9uIG1lc3NhZ2UgY2FuIGJlOiBcImVycm9yXCIgKG9uIGVycm9yKSwgXCJub2ludGVyZmFjZVwiIChubyBpbnRlcmZhY2UgYXZhaWxhYmxlKSwgXCJub3Blcm1pc3Npb25zXCIgKGxvY2F0aW9uIHBlcm1pc3Npb25zIG1pc3Npbmcgb24gV2luZG93cyksIG9yIG51bGwgKHN1Y2Nlc3MpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mbygpIHtcbiAgICAvLyBTa2lwIGV4ZWN1dGlvbiBpZiB3ZSd2ZSBoYWQgdG9vIG1hbnkgY29uc2VjdXRpdmUgZmFpbHVyZXNcbiAgICBpZiAoZmFpbHVyZUNvdW50ZXIgPj0gTUFYX0ZBSUxVUkVTKSB7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb0xpbnV4KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTWFjT1MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBFbnN1cmUgcmVzdWx0IGlzIGFsd2F5cyBhbiBvYmplY3RcbiAgICAgICAgaWYgKCFyZXN1bHQgfHwgdHlwZW9mIHJlc3VsdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZXNldCBjb3VudGVyIG9uIHN1Y2Nlc3NmdWwgcmVzdWx0IChoYXMgZGF0YSlcbiAgICAgICAgaWYgKHJlc3VsdC5zc2lkIHx8IHJlc3VsdC5ic3NpZCB8fCByZXN1bHQucXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSW5jcmVtZW50IGNvdW50ZXIgb24gZmFpbHVyZVxuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBSZXR1cm4gZW1wdHkgb2JqZWN0IGluc3RlYWQgb2YgdGhyb3dpbmcgdG8gcHJldmVudCBhcHAgY3Jhc2hcbiAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBMaW51eCB1c2luZyBubWNsaSAod2l0aCBmYWxsYmFjayB0byBpdy9pd2NvbmZpZylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9MaW51eCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgbm1jbGkgZmlyc3QgKG1vc3QgY29tbW9uIG9uIG1vZGVybiBMaW51eClcbiAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGdldCBhY3RpdmUgZGV2aWNlIGRpcmVjdGx5IChmYXN0ZXIgdGhhbiBsaXN0aW5nIGFsbCBuZXR3b3JrcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBzdGRvdXQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoJ25tY2xpIC10IC1mIGFjdGl2ZSxzc2lkLGJzc2lkLHNpZ25hbCBkZXZpY2Ugd2lmaSBsaXN0Jywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA0MDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0ZG91dCA9IHJlc3VsdC5zdGRvdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4ZWNFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEV2ZW4gaWYgZXhlY0FzeW5jIHRocm93cyBhbiBlcnJvciwgY2hlY2sgaWYgc3Rkb3V0IGNvbnRhaW5zIHZhbGlkIGRhdGFcbiAgICAgICAgICAgICAgICAvLyBubWNsaSBzb21ldGltZXMgcmV0dXJucyBub24temVybyBleGl0IGNvZGUgYnV0IHN0aWxsIHByb3ZpZGVzIHZhbGlkIG91dHB1dFxuICAgICAgICAgICAgICAgIGlmIChleGVjRXJyb3Iuc3Rkb3V0ICYmIGV4ZWNFcnJvci5zdGRvdXQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc3Rkb3V0ID0gZXhlY0Vycm9yLnN0ZG91dDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBleGVjRXJyb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3V0cHV0IGZyb20gbm1jbGknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpbmQgYWN0aXZlIGNvbm5lY3Rpb25cbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gbGluZS5zcGxpdCgnOicpO1xuICAgICAgICAgICAgICAgIGlmICgocGFydHNbMF0gPT09ICd5ZXMnIHx8IHBhcnRzWzBdID09PSAnamEnKSAmJiBwYXJ0cy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gcGFydHNbMV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIC8vIEJTU0lEIGlzIGEgTUFDIGFkZHJlc3MgKDYgaGV4IGJ5dGVzIHNlcGFyYXRlZCBieSBjb2xvbnMsIHBvc3NpYmx5IGVzY2FwZWQpXG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgdXNpbmcgcmVnZXggLSBoYW5kbGUgZXNjYXBlZCBjb2xvbnMgKFxcOikgYXMgc2hvd24gaW4gbm1jbGkgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHJlZ2V4IHN0cmluZywgXFxcXDogbWF0Y2hlcyBhIGxpdGVyYWwgYmFja3NsYXNoIGZvbGxvd2VkIGJ5IGNvbG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OlxcXFw6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGVzY2FwZSBiYWNrc2xhc2hlcyBhbmQgbm9ybWFsaXplIHRvIHVwcGVyY2FzZVxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoWzBdLnJlcGxhY2UoL1xcXFw6L2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB0cnkgbm9ybWFsIGNvbG9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG5vcm1hbE1hdGNoWzBdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gcGFydHNbMl0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gU2lnbmFsIGlzIHRoZSBsYXN0IG51bWVyaWMgcGFydFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxTdHIgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA/IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnRyaW0oKSA6ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWwgPSBzaWduYWxTdHIgPyAocGFyc2VJbnQoc2lnbmFsU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAobm1jbGlFcnJvcikge1xuICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0LCBldGMuKSwgbm90IGlmIGp1c3Qgbm8gV0xBTiBhY3RpdmVcbiAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gbm1jbGlFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBubWNsaUVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobm1jbGlFcnJvci5tZXNzYWdlICYmICFubWNsaUVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ05vIG91dHB1dCcpKTtcbiAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogbm1jbGkgY29tbWFuZCBmYWlsZWQ6Jywgbm1jbGlFcnJvci5tZXNzYWdlIHx8IG5tY2xpRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBpdyAoaXdjb25maWcgaXMgZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3U3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUUgXCJeXFxzKnNzaWR8XlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3bGlua1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1BIDUgXCJeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IFNTSURcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBpd1N0ZG91dCA/IGl3U3Rkb3V0Lm1hdGNoKC9zc2lkXFxzKyguKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHNzaWRNYXRjaCA/IHNzaWRNYXRjaFsxXS50cmltKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgYW5kIHNpZ25hbCBmcm9tIGxpbmsgaW5mb1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL2FkZHI6XFxzKyhbYS1mMC05Ol17MTd9KS9pKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvc2lnbmFsOlxccysoLT9cXGQrKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxEYm0gPSBzaWduYWxNYXRjaCA/IChwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWFsaXR5ID0gc2lnbmFsRGJtICE9PSBudWxsID8gZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWxEYm0pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGNhdGNoIChpd0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3RXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBpdyBjb21tYW5kIGZhaWxlZDonLCBpd0Vycm9yLm1lc3NhZ2UgfHwgaXdFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIExhc3QgZmFsbGJhY2s6IGl3Y29uZmlnIChkZXByZWNhdGVkIGJ1dCB3aWRlbHkgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3Y29uZmlnIDI+L2Rldi9udWxsIHwgZ3JlcCAtRSBcIkVTU0lEfEFjY2VzcyBQb2ludHxTaWduYWwgbGV2ZWxcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gbGluZS5tYXRjaCgvRVNTSUQ6XCIoW15cIl0rKVwiLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3NpZE1hdGNoKSBzc2lkID0gc3NpZE1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQWNjZXNzIFBvaW50OlxccysoW2EtZjAtOTpdezE3fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkgYnNzaWQgPSBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvU2lnbmFsIGxldmVsPSgtP1xcZCspLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGl3Y29uZmlnRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgYWxsIG1ldGhvZHMgZmFpbGVkIHdpdGggcmVhbCBlcnJvcnMgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdjb25maWdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IEFsbCBtZXRob2RzIChubWNsaSwgaXcsIGl3Y29uZmlnKSBmYWlsZWQuIExhc3QgZXJyb3I6JywgaXdjb25maWdFcnJvci5tZXNzYWdlIHx8IGl3Y29uZmlnRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnZXJyb3InXG4gICAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnXG4gICAgfTtcbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgbmV0c2hcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c2ggd2xhbiBzaG93IGludGVyZmFjZXMnLCB7XG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBzdGRlcnIgZm9yIHNlcnZpY2UgZXJyb3JzXG4gICAgICAgIGNvbnN0IGVycm9yT3V0cHV0ID0gKHN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gKHN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRPdXRwdXQgPSBvdXRwdXQgKyAnICcgKyBlcnJvck91dHB1dDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIFdMQU4gc2VydmljZSBpcyBub3QgcnVubmluZyAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuc3ZjJykgfHwgXG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbiBhdXRvY29uZmlnJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdhdXRvbWF0aXNjaCB3bGFuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuLWtvbmZpZ3VyYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc2VydmljZSBpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGVyIGRpZW5zdCcpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgbm8gaW50ZXJmYWNlcyBhdmFpbGFibGVcbiAgICAgICAgaWYgKHN0ZG91dC5pbmNsdWRlcygnVGhlcmUgaXMgbm8gd2lyZWxlc3MgaW50ZXJmYWNlJykgfHwgXG4gICAgICAgICAgICBzdGRvdXQuaW5jbHVkZXMoJ0VzIGdpYnQga2VpbmUgRHJhaHRsb3MtU2Nobml0dHN0ZWxsZScpIHx8XG4gICAgICAgICAgICBzdGRvdXQubWF0Y2goL05vIHdpcmVsZXNzL2kpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUubGVuZ3RoID4gMCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAvLyBTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlLCBoYW5kbGVzIHZhcmlvdXMgZm9ybWF0c1xuICAgICAgICAgICAgLy8gVXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmQgdG8gZW5zdXJlIHdlIGRvbid0IG1hdGNoIFwiQlNTSURcIiAod2hpY2ggY29udGFpbnMgXCJTU0lEXCIpXG4gICAgICAgICAgICBpZiAobGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjpcXHMqKC4rKS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHNldCBpZiBub3QgZW1wdHkgYW5kIG5vdCBcIk4vQVwiIG9yIHNpbWlsYXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZCAmJiBleHRyYWN0ZWQubGVuZ3RoID4gMCAmJiAhZXh0cmFjdGVkLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGV4dHJhY3RlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEJTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlIHBhdHRlcm4gbWF0Y2hpbmdcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL0JTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gKGhhbmRsZXMgYm90aCAtIGFuZCA6IHNlcGFyYXRvcnMsIHdpdGggb3Igd2l0aG91dCBzcGFjZXMpXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRFxccyo6XFxzKihbYS1mMC05XXsyfSg/OlstOlxcc11bYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG1hdGNoWzFdLnJlcGxhY2UoL1stIF0vZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNpZ25hbCBwYXJzaW5nIC0gaGFuZGxlIHZhcmlvdXMgbG9jYWxpemVkIGZvcm1hdHMgYW5kIHBhdHRlcm5zXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9TaWduYWx8U2lnbmFsc3RcdTAwRTRya2V8SW50ZW5zaXRcdTAwRTl8U2VcdTAwRjFhbC9pKSkge1xuICAgICAgICAgICAgICAgIC8vIFRyeSBwZXJjZW50YWdlIHBhdHRlcm4gZmlyc3QgKG1vc3QgY29tbW9uKVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKFxcZCspXFxzKiUvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPj0gMCAmJiBwYXJzZWQgPD0gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgZEJtIHBhdHRlcm4gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKC0/XFxkKylcXHMqZEJtL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRibSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGRibSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBlbXB0eSBzdHJpbmdzIHRvIG51bGxcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IChzc2lkICYmIHNzaWQubGVuZ3RoID4gMCkgPyBzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiAoYnNzaWQgJiYgYnNzaWQubGVuZ3RoID4gMCkgPyBic3NpZCA6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgZXJyb3IgaXMgZHVlIHRvIGxvY2F0aW9uIHBlcm1pc3Npb25zIChtaWdodCBiZSBpbiBzdGRlcnIgb3IgZXJyb3IgbWVzc2FnZSlcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gKGVycm9yLm1lc3NhZ2UgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3Rkb3V0ID0gKGVycm9yLnN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRlcnIgPSAoZXJyb3Iuc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZEVycm9yT3V0cHV0ID0gZXJyb3JNZXNzYWdlICsgJyAnICsgZXJyb3JTdGRvdXQgKyAnICcgKyBlcnJvclN0ZGVycjtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIExvZyBlcnJvciB3aGVuIGNvbW1hbmQgZXhlY3V0aW9uIGZhaWxzICh0aW1lb3V0LCBwZXJtaXNzaW9uLCBldGMuKVxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93czogRXJyb3IgZXhlY3V0aW5nIG5ldHNoIGNvbW1hbmQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsIChmYWxsYmFjayB3aGVuIG5ldHNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSAoZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uKVxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGFjdGl2ZSBXaS1GaSBjb25uZWN0aW9uIHByb2ZpbGVcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Bvd2Vyc2hlbGwgLUNvbW1hbmQgXCIkcHJvZmlsZSA9IEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSB8IFdoZXJlLU9iamVjdCB7JF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpLUZpKlxcJyAtb3IgJF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpcmVsZXNzKlxcJ30gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxOyBpZiAoJHByb2ZpbGUpIHsgJHByb2ZpbGUuTmFtZSB9XCInLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBzc2lkU3RyID0gc3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBpZiAoc3NpZFN0ciAmJiBzc2lkU3RyLmxlbmd0aCA+IDAgJiYgIXNzaWRTdHIubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRTdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBCU1NJRCBjYW5ub3QgYmUgZWFzaWx5IHJldHJpZXZlZCB3aXRob3V0IG5ldHNoICh3aGljaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAgICAgICAgLy8gU2V0dGluZyB0byBudWxsIGFzIGZhbGxiYWNrIC0gU1NJRCBpcyB0aGUgbW9zdCBpbXBvcnRhbnQgaW5mb3JtYXRpb24gYW55d2F5XG4gICAgICAgIGNvbnN0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBQb3dlclNoZWxsIGZhbGxiYWNrIChjYW4ndCBlYXNpbHkgZ2V0IHNpZ25hbCBzdHJlbmd0aCB3aXRob3V0IG5ldHNoKVxuICAgICAgICAvLyBSZXR1cm4gbm9wZXJtaXNzaW9ucyBtZXNzYWdlIHNvIGZyb250ZW5kIGNhbiBzaG93IHRoZSB3YXJuaW5nXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnbm9wZXJtaXNzaW9ucydcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgZXJyb3IgaWYgUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsc1xuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGw6IFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbGVkOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIG1hY09TIHVzaW5nIGFpcnBvcnQgb3IgbmV0d29ya3NldHVwXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTWFjT1MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IGFpcnBvcnQgY29tbWFuZCBmaXJzdCAoZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGFpcnBvcnQgaXMgYXZhaWxhYmxlICh1c3VhbGx5IGF0IC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0KVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGFpcnBvcnRQYXRoIH0gPSBhd2FpdCBleGVjQXN5bmMoJ3doaWNoIGFpcnBvcnQgMj4vZGV2L251bGwgfHwgZWNobyAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFpcnBvcnQgPSBhaXJwb3J0UGF0aC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYCR7YWlycG9ydH0gLUlgLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IHJzc2lEYm0gPSBudWxsO1xuICAgICAgICAgICAgbGV0IHNpZ25hbFBlcmNlbnQgPSBudWxsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQgPSBsaW5lLnJlcGxhY2UoJ1NTSUQ6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnQlNTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIHRvIGVuc3VyZSB3ZSBnZXQgdGhlIGZ1bGwgQlNTSURcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEOlxccyooW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnYWdyQ3RsUlNTSTonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBSU1NJIGluIGRCbSAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2lTdHIgPSBsaW5lLnJlcGxhY2UoJ2FnckN0bFJTU0k6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaSA9IHJzc2lTdHIgPyAocGFyc2VJbnQocnNzaVN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgcnNzaURibSA9IHJzc2k7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2xpbmsgYXV0aDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBbHRlcm5hdGl2ZTogc2lnbmFsIHN0cmVuZ3RoIGFzIHBlcmNlbnRhZ2UgKGlmIGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxkKyklLyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCAmJiBzaWduYWxQZXJjZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsUGVyY2VudCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcXVhbGl0eSA9IG51bGw7XG4gICAgICAgICAgICBpZiAoc2lnbmFsUGVyY2VudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBzaWduYWxQZXJjZW50O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyc3NpRGJtICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IGRibVRvUXVhbGl0eVBlcmNlbnQocnNzaURibSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzc2lkIHx8IGJzc2lkIHx8IHF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoYWlycG9ydEVycm9yKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBuZXR3b3Jrc2V0dXAgLSBvbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAobm90IGp1c3Qgbm8gcGVybWlzc2lvbilcbiAgICAgICAgICAgIGlmIChhaXJwb3J0RXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcgJiYgYWlycG9ydEVycm9yLm1lc3NhZ2UgJiYgIWFpcnBvcnRFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IGFpcnBvcnQgY29tbWFuZCBmYWlsZWQ6JywgYWlycG9ydEVycm9yLm1lc3NhZ2UgfHwgYWlycG9ydEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2s6IG5ldHdvcmtzZXR1cCBhbmQgaXBjb25maWcgKGZvciBuZXdlciBtYWNPUyB3aGVyZSBhaXJwb3J0IGlzIG5vdCBhdmFpbGFibGUpICAvLyBzeXN0ZW1fcHJvZmlsZXIgaXMgd2F5IHRvIGhlYXZ5IGFuZCBuZWVkcyBhIGxvb29vb3Qgb2YgdGltZSB0byBwcm9jZXNzXG4gICAgICAgIC8vIHRoaXMgaXMgYSBzaW1wbGUgY2FsY3VsYXRpb24uLiB3ZSBjYW4ndCByZWx5IG9uIGEgcHJvY2VzcyB0aGF0IHRha2VzIDEwcyB0byBjb21wbGV0ZSBhbmQgYmxvY2tzIHRoZSB3aG9sZSBzeXN0ZW1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSBXTEFOIGludGVyZmFjZSB1c2luZyBuZXR3b3Jrc2V0dXBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpbnRlcmZhY2VPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0d29ya3NldHVwIC1saXN0YWxsaGFyZHdhcmVwb3J0cyB8IGF3ayBcXCcvV2ktRml8QWlyUG9ydC97Z2V0bGluZTsgcHJpbnQgJE5GfVxcJycsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZU5hbWUgPSBpbnRlcmZhY2VPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWludGVyZmFjZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBXaS1GaSBpbnRlcmZhY2UgZm91bmRcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBhd2sgLUYnIFNTSUQgOiAnICcvIFNTSUQgOiAvIHtwcmludCAkMn0nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkT3V0cHV0LnRyaW0oKSB8fCBudWxsO1xuICAgICAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZCwgY29udGludWUgd2l0aCBCU1NJRFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgQlNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGJzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBncmVwICdCU1NJRCA6JyB8IGF3ayAne3ByaW50ICQzfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRTdHIgPSBic3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgQlNTSUQgZm9ybWF0IChNQUMgYWRkcmVzcylcbiAgICAgICAgICAgICAgICBpZiAoYnNzaWRTdHIgJiYgL15bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0kL2kudGVzdChic3NpZFN0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZFN0ci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGJzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBCU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgZmFsbGJhY2sgKGFpcnBvcnQgbm90IGF2YWlsYWJsZSwgY2FuJ3QgZ2V0IHNpZ25hbCBzdHJlbmd0aClcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAobmV0d29ya3NldHVwRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiBuZXR3b3Jrc2V0dXAgZmFpbHMgd2l0aCBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogbmV0d29ya3NldHVwL2lwY29uZmlnIGZhbGxiYWNrIGZhaWxlZDonLCBuZXR3b3Jrc2V0dXBFcnJvci5tZXNzYWdlIHx8IG5ldHdvcmtzZXR1cEVycm9yKTtcbiAgICAgICAgICAgIC8vIElmIGZhbGxiYWNrIGNvbXBsZXRlbHkgZmFpbHMsIHJldHVybiBlcnJvciBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IGdldFdsYW5JbmZvIH07XG5cblxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICA1MywgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICd0YXNrbGlzdCAvZm8gY3N2JyAoc3RydWN0dXJlZCBmb3JtYXQsIGZhc3RlciB0aGFuIC92LCBzdGlsbCBzaG93cyBwcm9jZXNzIG5hbWVzKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Rhc2tsaXN0IC9mbyBjc3YnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ25ldHN0YXQgLWFubycgKHNob3dzIGFsbCBjb25uZWN0aW9uIHN0YXRlcyBpbmNsdWRpbmcgRVNUQUJMSVNIRUQgZm9yIHNjcmVlbnNoYXJpbmcgZGV0ZWN0aW9uKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHN0YXQgLWFubycsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBSZWdleCB0byBmaW5kIDpQT1JUIGZvbGxvd2VkIGJ5IGEgc3BhY2UgKGVuc3VyZXMgZXhhY3QgcG9ydCBtYXRjaCwgZS5nLiwgOjU5MzggKVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH1cXFxcc2AsICdnJykgXG4gICAgICBpZiAocmVnZXgudGVzdChzdGRvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufSIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsJ2NvbS5taWNyb3NvZnQudGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDUzLCAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn0iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnLFxuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDUzLCAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTYsXG5dXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn0iLCAiaW1wb3J0ICogYXMgd2luIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlV2luLmpzJ1xuaW1wb3J0ICogYXMgbWFjIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTWFjLmpzJ1xuaW1wb3J0ICogYXMgbGludXggZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVMaW4uanMnXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjayhwbGF0Zm9ybSA9ICd3aW4zMicpIHtcbiAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gYXdhaXQgd2luLnJ1blJlbW90ZUNoZWNrKClcbiAgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJykgcmV0dXJuIGF3YWl0IG1hYy5ydW5SZW1vdGVDaGVjaygpXG4gIHJldHVybiBhd2FpdCBsaW51eC5ydW5SZW1vdGVDaGVjaygpXG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBFeHBhbmRlZCBicm93c2VyIGtleXdvcmRzIHRvIGNhdGNoIG1vcmUgdmFyaWFudHNcbmNvbnN0IGJyb3dzZXJLZXl3b3JkcyA9IFtcbiAgICAnY2hyb20nLCAnY2hyb21lLmV4ZScsXG4gICAgJ2VkZ2UnLCAnbXNlZGdlLmV4ZScsXG4gICAgJ2ZpcmUnLCAnZmlyZWZveC5leGUnLFxuICAgICdicmF2ZScsICdicmF2ZS5leGUnLFxuICAgICdvcGVyYScsICdvcGVyYS5leGUnLFxuICAgICdicm93c2VyJywgLy8gR2VuZXJpYyBicm93c2VyIHByb2Nlc3NcbiAgICAnaWV4cGxvcmUnLCAvLyBJbnRlcm5ldCBFeHBsb3JlclxuICAgICdzYWZhcmknLCAvLyBGb3IgbWFjT1Ncbl07XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJiB7ICRwcm9jID0gR2V0LUNpbUluc3RhbmNlIC1DbGFzcyBXaW4zMl9Qcm9jZXNzIC1GaWx0ZXIgJ1Byb2Nlc3NJZD0ke3BpZH0nOyBpZiAoJHByb2MpIHsgJHByb2MuUGFyZW50UHJvY2Vzc0lkOyAkcHJvYy5OYW1lIH0gfVwiYDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZSk7XG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KGxpbmVzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBsaW5lc1sxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1dpbmRvd3M6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFVuaXggc3lzdGVtcyAoTGludXgvbWFjT1MpXG4gKiBUcmllcyAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCksIGZhbGxzIGJhY2sgdG8gcHMgY29tbWFuZFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0IG1ldGhvZCB+NG1zLCBubyBwcm9jZXNzIHNwYXduKVxuICAgICAgICBjb25zdCBbc3RhdENvbnRlbnQsIGNvbW1Db250ZW50XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vc3RhdGAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbCksXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L2NvbW1gLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpXG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKHN0YXRDb250ZW50KSB7XG4gICAgICAgICAgICAvLyBQYXJzZSAvcHJvYy9waWQvc3RhdDogcGlkIChjb21tKSBzdGF0ZSBwcGlkIC4uLlxuICAgICAgICAgICAgY29uc3Qgc3RhdE1hdGNoID0gc3RhdENvbnRlbnQubWF0Y2goL15cXGQrXFxzK1xcKChbXildKylcXClcXHMrXFxTK1xccysoXFxkKykvKTtcbiAgICAgICAgICAgIGlmIChzdGF0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKGNvbW1Db250ZW50IHx8IHN0YXRNYXRjaFsxXSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHN0YXRNYXRjaFsyXSwgMTApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gcHMgY29tbWFuZCAod29ya3Mgb24gYm90aCBMaW51eCBhbmQgbWFjT1MpXG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcHMgLXAgJHtwaWR9IC1vIHBwaWQ9LGNvbW09YDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcGFydHMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHBhcnRzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKCcgJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9Vbml4OiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBiYXNlZCBvbiBwbGF0Zm9ybVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mbyhwaWQpIHtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgXG4gICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKTtcbiAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnbGludXgnIHx8IHBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCk7IC8vIExpbnV4L21hY09TOiB0cmllcyAvcHJvYywgZmFsbHMgYmFjayB0byBwc1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBjaGVjayBwYXJlbnQgcHJvY2Vzc2VzIGZvciBicm93c2VyXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZpbmRQYXJlbnRQcm9jZXNzKHBpZCwgbWF4RGVwdGgsIHZpc2l0ZWRQaWRzKSB7XG4gICAgaWYgKHBpZCA9PT0gMSB8fCBwaWQgPT09IDApIHtcbiAgICAgICAgbG9nLmluZm8oJ2NoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJvb3QgUElEIHJlYWNoZWQuIE5vIHdlYiBicm93c2VyIGZvdW5kLicpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGlmIChtYXhEZXB0aCA8PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiB3aGVuIG1heCBkZXB0aCByZWFjaGVkXG4gICAgfVxuICAgIFxuICAgIGlmICh2aXNpdGVkUGlkcy5oYXMocGlkKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXNcbiAgICB9XG4gICAgXG4gICAgdmlzaXRlZFBpZHMuYWRkKHBpZCk7XG4gICAgXG4gICAgLy8gR2V0IHByb2Nlc3MgaW5mbyAoZ2V0UHJvY2Vzc0luZm8gYWxyZWFkeSBoYXMgaXRzIG93biB0aW1lb3V0IHByb3RlY3Rpb24pXG4gICAgY29uc3QgcHJvY2Vzc0luZm8gPSBhd2FpdCBnZXRQcm9jZXNzSW5mbyhwaWQpO1xuICAgIFxuICAgIGlmICghcHJvY2Vzc0luZm8pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB7IHBwaWQsIG5hbWUgfSA9IHByb2Nlc3NJbmZvO1xuICAgIFxuICAgIC8vIExvZyB0aGUgcHJvY2VzcyBpbmZvIGZvciBkZWJ1Z2dpbmdcbiAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQ2hlY2tpbmcgcHJvY2VzczogJHtuYW1lfSAoUElEOiAke3BpZH0sIFBQSUQ6ICR7cHBpZH0pYCk7XG4gICAgXG4gICAgLy8gTW9yZSB0aG9yb3VnaCBicm93c2VyIGRldGVjdGlvblxuICAgIGlmIChicm93c2VyS2V5d29yZHMuc29tZShicm93c2VyID0+IG5hbWUuaW5jbHVkZXMoYnJvd3NlcikpKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGZvdW5kOiAke25hbWV9YCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAobmFtZS5pbmNsdWRlcygnZXhwbG9yZXInKSB8fCBwcGlkIDw9IDEpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJlYWNoZWQgc3lzdGVtIHByb2Nlc3Mgb3IgZXhwbG9yZXJgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBmaW5kUGFyZW50UHJvY2VzcyhwcGlkLCBtYXhEZXB0aCAtIDEsIHZpc2l0ZWRQaWRzKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgcGFyZW50IHByb2Nlc3MgaXMgYSBicm93c2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja1BhcmVudFByb2Nlc3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZm91bmRCcm93c2VyID0gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHJvY2Vzcy5wcGlkLCA2LCBuZXcgU2V0KCkpO1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEJyb3dzZXIgZGV0ZWN0aW9uIHJlc3VsdDogJHtmb3VuZEJyb3dzZXJ9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGZvdW5kQnJvd3NlciB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEVycm9yIGluIGJyb3dzZXIgZGV0ZWN0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBmb3VuZEJyb3dzZXI6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgIH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7QUF1QkEsU0FBUyxZQUFBQSxpQkFBZ0I7QUFDekIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixPQUFPLFNBQVM7OztBQ3JCaEIsSUFBTSxTQUFTO0FBQUEsRUFDWCxhQUFhO0FBQUE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGVBQWU7QUFBQSxFQUNmLGdCQUFnQjtBQUFBLEVBQ2hCLFNBQVM7QUFBQSxFQUVULGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUE7QUFBQSxFQUNmLHFCQUFxQjtBQUFBO0FBQUEsRUFFckIscUJBQXFCO0FBQUEsRUFDckIsUUFBUTtBQUFBO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxVQUFVO0FBQUEsRUFDVixhQUFhO0FBQUEsRUFDYixTQUFTO0FBQUEsRUFFVCxTQUFTO0FBQUEsRUFDVCxXQUFXO0FBQUEsRUFDWCxhQUFhO0FBQUEsRUFDYixNQUFNO0FBQ1Y7QUFDQSxJQUFPLGlCQUFROzs7QURMZixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFDakIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sUUFBUTtBQUNmLE9BQU8sT0FBTyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDOUMsSUFBTSxZQUFZLFlBQVk7QUFJOUIsSUFBTSxxQkFBTixNQUF5QjtBQUFBLEVBQ3ZCLGNBQWM7QUFFWixTQUFLLFlBQVksUUFBUTtBQUN6QixTQUFLLFFBQVEsUUFBUTtBQUNyQixTQUFLLE9BQU8sUUFBUTtBQUdwQixTQUFLLFdBQVcsQ0FBQztBQUNqQixTQUFLLE9BQU8sS0FBSyxlQUFlO0FB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QSxFQUFBRyxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsTUFBTSxNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RDLEVBQUFBLGdCQUFlLFNBQVMsNEJBQTRCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDNUQsRUFBQUEsZ0JBQWUsU0FBUyxVQUFVLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDMUMsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsWUFBWSxNQUFNO0FBQUcsV0FBTztBQUFBLEVBQU0sQ0FBQztBQUMvRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJleGVjU3luYyIsICJleGVjU3luYyIsICJsb2ciLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAiZ2xvYmFsU2hvcnRjdXQiLCAiVHJheSIsICJNZW51IiwgImRpYWxvZyIsICJsb2ciLCAibG9nIiwgInBhdGgiLCAiZnMiLCAiaXAiLCAiZ2F0ZXdheTRzeW5jIiwgImFwcCIsICJwYXRoIiwgImpvaW4iLCAiam9pbiIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJsb2ciLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImFwcCIsICJmcyIsICJwYXRoIiwgInByb2Nlc3MiLCAiYXBwIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAibG9nIiwgInByb2Nlc3MiLCAiZnMiLCAicGF0aCIsICJvcyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAiam9pbiIsICJsb2ciLCAiYXBwIiwgInBhdGgiLCAiZnMiLCAiam9pbiIsICJzY3JlZW4iLCAiaXBjTWFpbiIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJ3ZWJDb250ZW50cyIsICJwYXRoIiwgImZzIiwgImNsaXBib2FyZCIsICJhcHAiLCAib3MiLCAibG9nIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgImxvZyIsICJwYXRoIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYXBwIiwgInBhdGgiLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgIndlYkNvbnRlbnRzIiwgInNjcmVlbiIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgImRpYWxvZyIsICJnbG9iYWxTaG9ydGN1dCJdCn0K
