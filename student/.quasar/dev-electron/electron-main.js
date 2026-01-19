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
import os5 from "os";
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
app10.commandLine.appendSwitch("disk-cache-size", "0");
app10.commandLine.appendSwitch("disable-http-cache");
app10.commandLine.appendSwitch("aggressive-cache-discard");
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
async function clearCacheDirectory() {
  try {
    let userDataPath;
    try {
      userDataPath = app10.getPath("userData");
    } catch (e) {
      const homeDir = os5.homedir();
      if (process.platform === "linux") {
        userDataPath = path8.join(homeDir, ".config", app10.getName());
      } else if (process.platform === "darwin") {
        userDataPath = path8.join(homeDir, "Library", "Application Support", app10.getName());
      } else {
        userDataPath = path8.join(homeDir, "AppData", "Roaming", app10.getName());
      }
    }
    const cachePath = path8.join(userDataPath, "Cache");
    if (fs5.existsSync(cachePath)) {
      await fsExtra.remove(cachePath);
      log13.info("main @ clearCacheDirectory: Cleared cache directory");
    }
  } catch (err) {
    log13.warn("main @ clearCacheDirectory: Error clearing cache directory:", err);
  }
}
clearCacheDirectory();
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
  try {
    await session.defaultSession.clearCache();
  } catch (err) {
    log13.warn("main @ whenReady: Error clearing cache on startup:", err);
  }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMudHMiLCAiLi4vLi4vc3JjL2xvY2FsZXMvZW4uanNvbiIsICIuLi8uLi9zcmMvbG9jYWxlcy9kZS5qc29uIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLl9wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcbiAgICBcbiAgXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmZsYW1lc2hvdCA9IHRoaXMuX2dldFZlcnNpb24oJ2ZsYW1lc2hvdCcpO1xuICAgIHRoaXMuaW1hZ2VtYWdpY2sgPSB0aGlzLl9nZXRWZXJzaW9uKCdjb252ZXJ0Jyk7XG4gICAgdGhpcy5pbVZlcnNpb24gPSB0aGlzLl9nZXRJbWFnZU1hZ2lja1ZlcnNpb24oKTtcbiAgICB0aGlzLndvcmtlckZpbGVOYW1lID0gdGhpcy5fZ2V0V29ya2VyRmlsZU5hbWUoKTtcbiAgICB0aGlzLnVzZVdvcmtlciA9IHRoaXMuX2dldFVzZVdvcmtlcigpO1xuICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSB0aGlzLl9nZXRTY3JlZW5zaG90QWJpbGl0eSgpO1xuICAgIHRoaXMuanJlID0gdGhpcy5fZGV0ZWN0SlJFSWQoKTtcbiAgICB0aGlzLmpyZURpciA9IHRoaXMuX3Jlc29sdmVKUkVEaXIoKTtcbiAgICB0aGlzLmphdmFCaW4gPSB0aGlzLl9yZXNvbHZlSmF2YUJpbigpO1xuICAgIHRoaXMuanJlSW5mbyA9IHRoaXMuX2dldEpSRSgpO1xuICAgIFxuICAgIHRoaXMuaG9tZWRpcmVjdG9yeSA9IG9zLmhvbWVkaXIoKTtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgICB0aGlzLndvcmtlclVSTCA9IHRoaXMuX2dldFdvcmtlclVSTCgpO1xuICAgIHRoaXMudGVtcGRpcmVjdG9yeSA9IHRoaXMuX2dldFRlbXBkaXJlY3RvcnkoKTtcbiAgICB0aGlzLndvcmtkaXJlY3RvcnkgPSB0aGlzLl9nZXRXb3JrZGlyZWN0b3J5KCk7XG4gICAgdGhpcy5sb2dmaWxlID0gdGhpcy5fZ2V0TG9nZmlsZSgpO1xuXG4gIH1cblxuICBfZ2V0V29ya2RpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLmhvbWVkaXJlY3RvcnksIGNvbmZpZy5jbGllbnRkaXJlY3RvcnkpO1xuICB9XG5cbiAgX2dldFRlbXBkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4ob3MudG1wZGlyKCksICdleGFtLXRtcCcpO1xuICB9XG5cblxuICBfZ2V0TG9nZmlsZSgpIHtcbiAgICByZXR1cm4gam9pbih0aGlzLndvcmtkaXJlY3RvcnksICduZXh0LWV4YW0tc3R1ZGVudC5sb2cnKTtcbiAgfVxuXG4gIF9ub3JtYWxpemVBcmNoKCkge1xuICAgIGlmICh0aGlzLl9hcmNoID09PSAnaWEzMicpIHJldHVybiAnaTU4Nic7XG4gICAgaWYgKFsneDY0JywgJ2FybTY0J10uaW5jbHVkZXModGhpcy5fYXJjaCkpIHJldHVybiB0aGlzLl9hcmNoO1xuICAgIHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZTogJHt0aGlzLl9hcmNofWApO1xuICB9XG5cbiAgX2RldGVjdEpSRUlkKCkge1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLl9wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hcmNoID09PSAnYXJtNjQnID8gJ21pbmltYWwtanJlLTExLW1hYy1hcm02NCcgOiAnbWluaW1hbC1qcmUtMTEtbWFjJztcbiAgICB9XG4gIH1cblxuXG5cblxuXG4gIC8qKlxuICAgKiBcbiAgICogQHJldHVybnMge3N0cmluZ30gdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogQGRlc2NyaXB0aW9uIHRoaXMgZnVuY3Rpb24gcmVzb2x2ZXMgdGhlIGpyZSBkaXJlY3RvcnlcbiAgICogaXQgZmlyc3QgY2hlY2tzIGlmIHRoZSB1c2VCdW5kbGVkSlJFIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHNldCB0byB0cnVlXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCBjaGVja3MgaWYgdGhlIHN5c3RlbSBqcmUgaXMgaW5zdGFsbGVkXG4gICAqIGlmIGl0IGlzLCBpdCByZXR1cm5zIHRoZSBzeXN0ZW0ganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiB0aGUgYnVuZGxlZCBqcmUgaXMgbG9jYXRlZCBpbiB0aGUgcHVibGljIGRpcmVjdG9yeSBvZiB0aGUgYXBwXG4gICAqIFxuICAgKiBGSVhNRTogaWYgc3lzdGVtIGpyZSBpcyBzZWxlY3RlZCBieSBFTlYgZG8gbm90IGluY2x1ZGUgdGhlIGpyZSBkaXJlY3RvcnkgaW4gdGhlIGZpbmFsIGJ1aWxkXG4gICAqL1xuXG4gIF9yZXNvbHZlSlJFRGlyKCkge1xuICAgIC8vIHVzZSBidW5kbGVkIGpyZSBiZWNhdXNlIGl0cyBzbWFsbGVyIGFuZCBwcm92aWRlcyBvbmx5IHRoZSBuZWVkZWQgamF2YSBtb2R1bGVzXG4gICAgaWYgKHByb2Nlc3MuZW52LnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogIWFwcC5pc1BhY2thZ2VkOiBcIiArIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInID8gJ3doZXJlIGphdmEnIDogJ3doaWNoIGphdmEnO1xuICAgICAgICBjb25zdCBqYXZhUGF0aCA9IGV4ZWNTeW5jKGphdmFDb21tYW5kLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuXG4gICAgICAgIGlmIChqYXZhUGF0aCkge1xuICAgICAgICAgIC8vIEdldCB0aGUgZGlyZWN0b3J5IGNvbnRhaW5pbmcgdGhlIGphdmEgZXhlY3V0YWJsZVxuICAgICAgICAgIGNvbnN0IGphdmFEaXIgPSBwYXRoLmRpcm5hbWUoamF2YVBhdGgpO1xuICAgICAgICAgIC8vIEdvIHVwIHRvIHRoZSBKUkUvSkRLIHJvb3QgKHVzdWFsbHkgMiBsZXZlbHMgdXAgZnJvbSBiaW4vKVxuICAgICAgICAgIGNvbnN0IGpyZVJvb3QgPSBwYXRoLmRpcm5hbWUocGF0aC5kaXJuYW1lKGphdmFEaXIpKTtcbiAgICAgICAgICByZXR1cm4ganJlUm9vdDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIEphdmEgbm90IGZvdW5kIGluIFBBVEhcbiAgICAgIH1cblxuICAgICAgLy8gSWYgbm8gSmF2YSBmb3VuZCwgZmFsbCBiYWNrIHRvIGJ1bmRsZWQgSlJFXG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBObyBzeXN0ZW0gSmF2YSBmb3VuZCwgZmFsbGluZyBiYWNrIHRvIGJ1bmRsZWQgSlJFXCIpO1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfcmVzb2x2ZUphdmFCaW4oKSB7XG4gICAgc3dpdGNoICh0aGlzLl9wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5fcGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtICE9PSAnbGludXgnKSByZXR1cm4gJ24vYSc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCcpIHJldHVybiAnd2F5bGFuZCc7XG4gICAgaWYgKHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAneDExJyB8fCB0aGlzLl9lbnYuRElTUExBWSkgcmV0dXJuICd4MTEnO1xuICAgIHJldHVybiAndW5rbm93bic7XG4gIH1cblxuICBfZ2V0VmVyc2lvbihjbWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoYCR7Y21kfSAtLXZlcnNpb25gLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkuc3BsaXQoJ1xcbicpWzBdO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvW1xcZF0rKFxcLltcXGRdKykrLyk7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbjogdmVyc2lvbj8uWzBdIHx8ICd1bmtub3duJyB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldEpSRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoJ2phdmEgLXZlcnNpb24nLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ2lnbm9yZScsICdwaXBlJ10gfSk7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC92ZXJzaW9uIFwiKFtcXGQuX10rKVwiLyk/LlsxXSB8fCAndW5rbm93bic7XG4gICAgICBjb25zdCBqYXZhSG9tZSA9IHRoaXMuX2Vudi5KQVZBX0hPTUUgfHwgJyc7XG4gICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmVyc2lvbiwgcGF0aDogamF2YUhvbWUgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCwgcGF0aDogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRXb3JrZXJGaWxlTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG5cbiAgICByZXR1cm4gcGF0aFRvRmlsZVVSTCh3b3JrZXJQYXRoKTtcbiAgfVxuXG4gIGlzV2F5bGFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJztcbiAgfVxuXG4gIF9pc0tERSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICByZXR1cm4gb3V0ID09PSAnS0RFJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0tERTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNHTk9NRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ2dub21lJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNHTk9NRTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNVTklUWSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ3VuaXR5Jyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc1VOSVRZOiBubyBkYXRhXCIsIGVycik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZsYW1lc2hvdEF2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJ3aGljaCBmbGFtZXNob3RcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9mbGFtZXNob3RBdmFpbGFibGU6IEZsYW1lc2hvdCBub3QgZm91bmRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX3NldHVwRGVza3RvcFBhdGgoKSB7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gIH1cblxuICBfZ2V0RGVza3RvcFBhdGgoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5fcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMuX3BsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBpZiAoKHRoaXMuX2lzR05PTUUoKSB8fCB0aGlzLl9pc1VOSVRZKCkpICYmIHRoaXMuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBHTk9NRS9Vbml0eSArIFdheWxhbmQgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc0tERSgpICYmIHRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy5fZmxhbWVzaG90QXZhaWxhYmxlKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBLREUvV2F5bGFuZCArIEZsYW1lc2hvdCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLnVzZVdvcmtlcikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFgxMSArIEltYWdlTWFnaWNrIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZSBcdTIwMTMgZmFsbGJhY2sgdG8gcGFnZWNhcHR1cmVcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IHBsYXRmb3JtRGlzcGF0Y2hlciA9IG5ldyBQbGF0Zm9ybURpc3BhdGNoZXIoKTtcbmV4cG9ydCBkZWZhdWx0IHBsYXRmb3JtRGlzcGF0Y2hlcjtcbiIsICJcbi8qKlxuICogRE8gTk9UIEVESVQgLSB0aGlzIGZpbGUgaXMgd3JpdHRlbiBieSBwcmVidWlsZC5qcyB2aWEgZWxlY3Ryb24tYnVpbGRlci5lbnYgLSBlZGl0IHZhcnMgaW4gZWxlY3Ryb24tYnVpbGRlci5lbnYgZmlsZSFcbiAqL1xuXG5jb25zdCBjb25maWcgPSB7XG4gICAgZGV2ZWxvcG1lbnQ6IHRydWUsICAvLyBkaXNhYmxlIGtpb3NrIG1vZGUgb24gZXhhbSBtb2RlIGFuZCBvdGhlciBzdHVmZiAoYXV0b2ZpbGwgaW5wdXQgZmllbGRzKVxuICAgIHNob3dkZXZ0b29sczogdHJ1ZSxcbiAgICB1c2VCdW5kbGVkSlJFOiB0cnVlLFxuICAgIGJpcEludGVncmF0aW9uOiBmYWxzZSxcbiAgICBiaXBEZW1vOiBmYWxzZSxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIGVsZWN0cm9uOiBmYWxzZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzEuMS4wLjE4JyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDExOScsXG4gICAgYnVpbGROdW1iZXI6ICcxOCcsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgcG93ZXJTYXZlQmxvY2tlciwgbmF0aXZlVGhlbWUsIGdsb2JhbFNob3J0Y3V0LCBUcmF5LCBNZW51LCBkaWFsb2csIHNlc3Npb259IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCBvcyBmcm9tICdvcydcbmltcG9ydCAqIGFzIGZzRXh0cmEgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3RyYXltZW51LmpzJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tQYXJlbnRQcm9jZXNzIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMnO1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNrLWNhY2hlLXNpemUnLCAnMCcpOyAvLyBkaXNhYmxlIGRpc2sgY2FjaGUgdG8gcHJldmVudCBjYWNoZSBjb3JydXB0aW9uIGVycm9yc1xuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS1odHRwLWNhY2hlJyk7IC8vIGRpc2FibGUgSFRUUCBjYWNoZVxuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnYWdncmVzc2l2ZS1jYWNoZS1kaXNjYXJkJyk7IC8vIGFnZ3Jlc3NpdmVseSBkaXNjYXJkIGNhY2hlXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vLyBjbGVhciBjYWNoZSBkaXJlY3Rvcnkgb24gc3RhcnR1cCB0byBwcmV2ZW50IGRpc2sgY2FjaGUgY29ycnVwdGlvbiBlcnJvcnNcbmFzeW5jIGZ1bmN0aW9uIGNsZWFyQ2FjaGVEaXJlY3RvcnkoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IHVzZXJEYXRhUGF0aDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHVzZXJEYXRhUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBpZiBhcHAuZ2V0UGF0aCBpcyBub3QgYXZhaWxhYmxlIHlldCwgY29uc3RydWN0IHBhdGggbWFudWFsbHlcbiAgICAgICAgICAgIGNvbnN0IGhvbWVEaXIgPSBvcy5ob21lZGlyKCk7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgICAgICAgIHVzZXJEYXRhUGF0aCA9IHBhdGguam9pbihob21lRGlyLCAnLmNvbmZpZycsIGFwcC5nZXROYW1lKCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgICAgIHVzZXJEYXRhUGF0aCA9IHBhdGguam9pbihob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgYXBwLmdldE5hbWUoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVzZXJEYXRhUGF0aCA9IHBhdGguam9pbihob21lRGlyLCAnQXBwRGF0YScsICdSb2FtaW5nJywgYXBwLmdldE5hbWUoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FjaGVQYXRoID0gcGF0aC5qb2luKHVzZXJEYXRhUGF0aCwgJ0NhY2hlJyk7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNhY2hlUGF0aCkpIHtcbiAgICAgICAgICAgIGF3YWl0IGZzRXh0cmEucmVtb3ZlKGNhY2hlUGF0aCk7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNsZWFyQ2FjaGVEaXJlY3Rvcnk6IENsZWFyZWQgY2FjaGUgZGlyZWN0b3J5Jyk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLndhcm4oJ21haW4gQCBjbGVhckNhY2hlRGlyZWN0b3J5OiBFcnJvciBjbGVhcmluZyBjYWNoZSBkaXJlY3Rvcnk6JywgZXJyKTtcbiAgICB9XG59XG5cbi8vIGNsZWFyIGNhY2hlIGJlZm9yZSBhcHAgaXMgcmVhZHlcbmNsZWFyQ2FjaGVEaXJlY3RvcnkoKTtcbmNvbmZpZy5lbGVjdHJvbiA9IHRydWVcblxuY29uZmlnLmhvbWVkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeTtcbmNvbmZpZy53b3JrZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtkaXJlY3Rvcnk7XG5jb25maWcudGVtcGRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci50ZW1wZGlyZWN0b3J5O1xuY29uZmlnLmV4YW1kaXJlY3RvcnkgPSBjb25maWcud29ya2RpcmVjdG9yeSAgICAvLyB3ZSBuZWVkIHRoaXMgdmFyaWFibGUgc2V0dXAgZXZlbiBpZiB3ZSBkbyBub3QgY29ubmVjdCB0byBhIHRlYWNoZXIgaW5zdGFuY2VcblxuXG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgpKSB7ICBmcy5ta2RpclN5bmMocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSAgLy8gQ2hlY2sgaWYgdGhlIGRlc2t0b3AgZm9sZGVyIGV4aXN0cyBhbmQgY3JlYXRlIGlmIGl0IGRvZXNuJ3RcblxuLy8gQ3JlYXRlIHRoZSBzeW1ib2xpYyBsaW5rIHRvIHRoZSB3b3JrZGlyZWN0b3J5IG9uIHRoZSBkZXNrdG9wXG5jb25zdCBsaW5rUGF0aCA9IHBhdGguam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIGNvbmZpZy5jbGllbnRkaXJlY3RvcnkpOyAgLy8gRGVmaW5lIHRoZSBwYXRoIGZvciB0aGUgc3ltYm9saWMgbGlua1xudHJ5IHtmcy51bmxpbmtTeW5jKGxpbmtQYXRoKSB9Y2F0Y2goZSl7fVxudHJ5IHsgICBpZiAoIWZzLmV4aXN0c1N5bmMobGlua1BhdGgpKSB7IGZzLnN5bWxpbmtTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5LCBsaW5rUGF0aCwgJ2p1bmN0aW9uJyk7IH19XG5jYXRjaChlKXtsb2cuZXJyb3IoXCJtYWluIEAgY3JlYXRlLXN5bWxpbms6IGNhbid0IGNyZWF0ZSBzeW1saW5rXCIpfVxuXG5cbnRyeSB7IC8vYmluZCB0byB0aGUgY29ycmVjdCBpbnRlcmZhY2VcbiAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2V9ID0gZ2F0ZXdheTRzeW5jKCk7IFxuICAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKSAgICAvLyB0aGlzIHJldHVybnMgdGhlIGlwIG9mIHRoZSBpbnRlcmZhY2UgdGhhdCBoYXMgYSBkZWZhdWx0IGdhdGV3YXkuLiAgc2hvdWxkIHdvcmsgaW4gTU9TVCBjYXNlcy4gIHByb2JhYmx5IHByb3ZpZGUgXCJpcC1vcHRpb25zXCIgaW4gVUkgP1xuICAgIGNvbmZpZy5nYXRld2F5ID0gdHJ1ZVxufVxuIGNhdGNoIChlKSB7XG4gICBsb2cuZXJyb3IoXCJtYWluIEAgZ2F0ZXdheTRzeW5jOiB1bmFibGUgdG8gZGV0ZXJtaW5lIGRlZmF1bHQgZ2F0ZXdheVwiKVxuICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKSBcbiAgIGxvZy5pbmZvKGBtYWluOiBJUCAke2NvbmZpZy5ob3N0aXB9YClcbiAgIGNvbmZpZy5nYXRld2F5ID0gZmFsc2VcbiB9XG5cblxuZnNFeHRyYS5lbXB0eURpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpICAvLyBjbGVhbiB0ZW1wIGRpcmVjdG9yeVxuXG5cblxuXG5cblxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gc3BlY2lmaWNhbGx5IGNoZWNrcyBmb3IgRVBJUEUgZXJyb3JzIGFuZCBkaXNhYmxlcyB0aGUgY29uc29sZSB0cmFuc3BvcnQgZm9yIHRoZSBFbGVjdHJvbkxvZ2dlciBpZiBzdWNoIGFuIGVycm9yIG9jY3Vycy5cbiAqIEVQSVBFIGVycm9ycyB0eXBpY2FsbHkgaGFwcGVuIHdoZW4gdHJ5aW5nIHRvIHdyaXRlIHRvIGEgY2xvc2VkIHBpcGUsIHdoaWNoIGNhbiBvY2N1ciBpZiB0aGUgc3Rkb3V0IHN0cmVhbSBpcyB1bmV4cGVjdGVkbHkgY2xvc2VkLlxuICovXG5wcm9jZXNzLnN0ZG91dC5vbignZXJyb3InLCAoZXJyKSA9PiB7IGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykgeyBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2UgfSB9KTtcblxucHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyKSA9PiB7XG4gICAgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG4gICAgICAgIGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZTtcbiAgICAgICAgbG9nLndhcm4oJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjogRVBJUEUgRXJyb3I6IFRoZSBzdGRvdXQgc3RyZWFtIG9mIHRoZSBFbGVjdHJvbkxvZ2dlciB3aWxsIGJlIGRpc2FibGVkLicpO1xuICAgIH0gXG4gICAgZWxzZSBpZiAoZXJyLm1lc3NhZ2U/LmluY2x1ZGVzKCdSZW5kZXIgZnJhbWUgd2FzIGRpc3Bvc2VkJykpIHJldHVybjtcbiAgICBlbHNlIHsgIGxvZy5lcnJvcignbWFpbiBAIHVuY2F1Z2h0RXhjZXB0aW9uOicsIGVyci5tZXNzYWdlKTsgfSAgLy8gTG9nIG9yIGRpc3BsYXkgb3RoZXIgZXJyb3JzXG59KTtcblxuLy8gSGFuZGxlIHVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbnMgdG8gcHJldmVudCBjcmFzaGVzXG5wcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAocmVhc29uLCBwcm9taXNlKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBVbmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb246JywgcmVhc29uKTtcbiAgICBpZiAocmVhc29uIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBTdGFjazonLCByZWFzb24uc3RhY2spO1xuICAgIH1cbn0pO1xuXG4vLyBIYW5kbGUgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG5hcHAub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkJyk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGlkZW50aWZ5IHdoaWNoIHdpbmRvdyBjcmFzaGVkXG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgIFxuICAgIGlmIChjcmFzaGVkV2luZG93KSB7XG4gICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBGb3IgZXhhbSB3aW5kb3cgY3Jhc2hlcywgdHJ5IHRvIGNsb3NlIGl0IGdyYWNlZnVsbHlcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzIC0gbGV0IGl0IGNvbnRpbnVlXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBIYW5kbGUgY2hpbGQgcHJvY2VzcyBjcmFzaGVzICh3b3JrZXJzLCBldGMuKVxuYXBwLm9uKCdjaGlsZC1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IENoaWxkIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogVHlwZTonLCBkZXRhaWxzLnR5cGUpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKX1cbi8vaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgIGFwcC5kb2NrLmhpZGUoKSB9ICAvLyB0aGlzIGJ1ZyBzdGF0ZXMgdGhhdCBpdCBraW5kYSBtZXNzZXMgdXAga2lvc2sgbW9kZSAtIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTgyMDdcblxuXG5cbi8vIGhpZGUgY2VydGlmaWNhdGUgd2FybmluZ3MgaW4gY29uc29sZS4uIHdlIGtub3cgd2UgdXNlIGEgc2VsZiBzaWduZWQgY2VydCBhbmQgZG8gbm90IHZhbGlkYXRlIGl0XG5wcm9jZXNzLmVudltcIk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRURcIl0gPSBcIjBcIjtcbnByb2Nlc3MuZW52Lk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQgPSBcIjBcIjtcbmNvbnN0IG9yaWdpbmFsRW1pdFdhcm5pbmcgPSBwcm9jZXNzLmVtaXRXYXJuaW5nXG5wcm9jZXNzLmVtaXRXYXJuaW5nID0gKHdhcm5pbmcsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAod2FybmluZyAmJiB3YXJuaW5nLmluY2x1ZGVzICYmIHdhcm5pbmcuaW5jbHVkZXMoJ05PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQnKSkgeyAgcmV0dXJuIH1cbiAgICByZXR1cm4gb3JpZ2luYWxFbWl0V2FybmluZy5jYWxsKHByb2Nlc3MsIHdhcm5pbmcsIG9wdGlvbnMpXG59XG5cbmFwcC5vbignY2VydGlmaWNhdGUtZXJyb3InLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCB1cmwsIGVycm9yLCBjZXJ0aWZpY2F0ZSwgY2FsbGJhY2spID0+IHsgLy8gU1NML1RMUzogdGhpcyBpcyB0aGUgc2VsZiBzaWduZWQgY2VydGlmaWNhdGUgc3VwcG9ydFxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIE9uIGNlcnRpZmljYXRlIGVycm9yIHdlIGRpc2FibGUgZGVmYXVsdCBiZWhhdmlvdXIgKHN0b3AgbG9hZGluZyB0aGUgcGFnZSlcbiAgICBjYWxsYmFjayh0cnVlKTsgIC8vIGFuZCB3ZSB0aGVuIHNheSBcIml0IGlzIGFsbCBmaW5lIC0gdHJ1ZVwiIHRvIHRoZSBjYWxsYmFja1xufSk7XG5cbi8vIEhhbmRsZSBXZWJDb250ZW50cyBsb2FkIGZhaWx1cmVzIHRvIHByZXZlbnQgYXBwIGNyYXNoZXNcbmFwcC5vbignd2ViLWNvbnRlbnRzLWNyZWF0ZWQnLCAoZXZlbnQsIHdlYkNvbnRlbnRzKSA9PiB7XG4gICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgIC8vIExvZyB0aGUgZXJyb3IgYnV0IGRvbid0IGNyYXNoIHRoZSBhcHBcbiAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuXG4gICAgfSk7XG4gICAgXG4gICAgLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyBmb3Igc3BlY2lmaWMgd2ViQ29udGVudHMgKFY4IGZhdGFsIGVycm9ycywgZXRjLilcbiAgICB3ZWJDb250ZW50cy5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChldmVudCwgZGV0YWlscykgPT4ge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZW5kZXJlciBwcm9jZXNzIGNyYXNoZWQgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzJyk7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgdGhpcyB3ZWJDb250ZW50cyBiZWxvbmdzIHRvXG4gICAgICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICAgICAgY29uc3QgY3Jhc2hlZFdpbmRvdyA9IGFsbFdpbmRvd3MuZmluZCh3aW4gPT4gd2luLndlYkNvbnRlbnRzLmlkID09PSB3ZWJDb250ZW50cy5pZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IHRpdGxlOiAke2NyYXNoZWRXaW5kb3cuZ2V0VGl0bGUoKX1gKTtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyBVUkw6ICR7Y3Jhc2hlZFdpbmRvdy53ZWJDb250ZW50cy5nZXRVUkwoKX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdyA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNyYXNoZWRXaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXJyb3IgY2xvc2luZyBleGFtIHdpbmRvdzonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xufSk7XG5cbmFwcC5vbignd2luZG93LWFsbC1jbG9zZWQnLCAoKSA9PiB7ICAvLyBpZiB3aW5kb3cgaXMgY2xvc2VkXG4gICAgY2xlYXJJbnRlcnZhbCggQ29tbUhhbmRsZXIudXBkYXRlU3R1ZGVudEludGVydmFsbCApXG4gICAgV2luZG93SGFuZGxlci5tYWlud2luZG93ID0gbnVsbFxuICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJyl7IGFwcC5xdWl0KCkgfVxuICAgIGFwcC5xdWl0KCkgICBcbn0pXG5cbmFwcC5vbignYmVmb3JlLXF1aXQnLCBhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5jbGVhclN0b3JhZ2VEYXRhKHt9KTsgLy8gY2xlYXIgY29va2llcywgY2FjaGUsIGxvY2FsU3RvcmFnZSBldGMuXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIGJlZm9yZS1xdWl0OiBFcnJvciBjbGVhcmluZyBjYWNoZTonLCBlcnIpO1xuICAgIH1cbiAgfSk7XG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICAvLyBjbGVhciBjYWNoZSBvbiBzdGFydHVwIHRvIHByZXZlbnQgZGlzayBjYWNoZSBjb3JydXB0aW9uIGVycm9yc1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJDYWNoZSgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cud2FybignbWFpbiBAIHdoZW5SZWFkeTogRXJyb3IgY2xlYXJpbmcgY2FjaGUgb24gc3RhcnR1cDonLCBlcnIpO1xuICAgIH1cbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG5cbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KSIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCBkZ3JhbSBmcm9tICdkZ3JhbSc7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7ICAvLyBub2RlIG5vdCB2dWUgKHJlbGF0aXZlIHBhdGggbmVlZGVkKVxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5cbi8qKlxuICogU1RPUkVTIEFMTCBDTElFTlQvU2VydmVyIElORk9STUFUSU9OXG4gKiBTdGFydHMgYSBkZ3JhbSAodWRwKSBzb2NrZXQgdGhhdCBsaXN0ZW5zIGZvciBtdWxpdGNhc3QgbWVzc2FnZXNcbiAqL1xuXG5jbGFzcyBNdWx0aWNhc3RDbGllbnQge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5QT1JUID0gY29uZmlnLm11bHRpY2FzdENsaWVudFBvcnRcbiAgICAgICAgdGhpcy5NVUxUSUNBU1RfQUREUiA9IGNvbmZpZy5tdWx0aWNhc3RTZXJ2ZXJBZHJyXG4gICAgICAgIHRoaXMuY2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0ID0gW11cbiAgICAgICAgdGhpcy5jbGllbnRpbmZvID0ge1xuICAgICAgICAgICAgbmFtZTogXCJEZW1vVXNlclwiLFxuICAgICAgICAgICAgdG9rZW46IGZhbHNlLFxuICAgICAgICAgICAgaXA6IGZhbHNlLCAgLy8gaXAgYWRkcmVzcyB3aXJkIHZvbSBtdWx0aWNhc3RzZXJ2ZXIgdGVhY2hlciBtaXQgZ2VzY2hpY2t0XG4gICAgICAgICAgICBob3N0bmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzZXJ2ZXJpcDogZmFsc2UsICAgLy8gd2lyZCBsb2thbCBnZXNldHp0IChpc3QgYWJlciBsb2dpc2NoZXJ3ZWlzZSBnbGVpY2ggZGVyIGlwIGRlcyBtdWx0aWNhc3RzZXJ2ZXJzKVxuICAgICAgICAgICAgc2VydmVybmFtZTogZmFsc2UsXG4gICAgICAgICAgICBmb2N1czogdHJ1ZSxcbiAgICAgICAgICAgIGV4YW1tb2RlOiBmYWxzZSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogZmFsc2UsXG4gICAgICAgICAgICB2aXJ0dWFsaXplZDogZmFsc2UsICAvLyB0aGlzIGNvbmZpZyBzZXR0aW5nIGlzIHNldCBieSBzaW1wbGV2bWRldGVjdC5qcyAoZWxlY3Ryb24gcHJlbG9hZClcbiAgICAgICAgICAgIGV4YW10eXBlIDogZmFsc2UsXG4gICAgICAgICAgICBwaW46IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVubG9jazogZmFsc2UsXG4gICAgICAgICAgICBtc29mZmljZXNoYXJlOiBmYWxzZSxcbiAgICAgICAgICAgIHNjcmVlbnNob3RpbnRlcnZhbDogNDAwMCwgICAvL21pbGxpc2Vjb25kc1xuICAgICAgICAgICAgcHJpbnRyZXF1ZXN0IDogZmFsc2UsXG4gICAgICAgICAgICBwcml2YXRlU3BlbGxjaGVjazoge2FjdGl2YXRlZDogZmFsc2V9LFxuICAgICAgICAgICAgbG9jYWxMb2NrZG93bjogZmFsc2UsXG4gICAgICAgICAgICBncm91cDogJ2EnLFxuICAgICAgICAgICAgc3VibWlzc2lvbm51bWJlcjogMFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICogc3RhcnRzIGFuIGludGVydmFsbCB0byBjaGVjayBzZXJ2ZXIgc3RhdHVzIGFuZCByZWFjdHMgb24gaW5mb3JtYXRpb24gZ2l2ZW4gYnkgdGhlIHNlcnZlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIGluaXQgKGdhdGV3YXkpIHtcbiAgICAgICAgdGhpcy5nYXRld2F5ID0gZ2F0ZXdheVxuICAgICAgICB0aGlzLmNsaWVudCA9IGRncmFtLmNyZWF0ZVNvY2tldCgndWRwNCcpICAvLyBtb3ZpbmcgdGhpcyBoZXJlIHdpbGwgYWxsb3cgdG8gcmVzcGF3biBpdCBpZiBiaW5kaW5nIGZhaWxzXG5cbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBVRFAgTUMgQ2xpZW50IGVycm9yOlxcbiR7ZXJyLnN0YWNrfWApO1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuY2xvc2UoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmJpbmQodGhpcy5QT1JULCAnMC4wLjAuMCcsICAoKSA9PiB7IFxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50LnNldEJyb2FkY2FzdCh0cnVlKVxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50LnNldE11bHRpY2FzdFRUTCgxMjgpOyBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5nYXRld2F5KSB7dGhpcy5jbGllbnQuYWRkTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSKX0gLy8gZXMgaXN0IGZcdTAwRkNyIGVpbiB2ZXJsXHUwMEU0c3NsaWNoZXMgbXVsdGljYXN0IHNpbm52b2xsIGRlciBncnVwcGUgYmVpenV0cmV0ZW5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ2F0ZXdheSkge2xvZy53YXJuKFwibWNjbGllbnQ6IE5vIEdhdGV3YXkhIFN0YXJ0aW5nIE11bHRpY2FzdENsaWVudCB3aXRob3V0IGFkZGluZyBncm91cCBtZW1iZXJzaGlwXCIpfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBVRFAgTUMgQ2xpZW50IGxpc3RlbmluZyBvbiBodHRwOi8vJHtjb25maWcuaG9zdGlwfToke3RoaXMuY2xpZW50LmFkZHJlc3MoKS5wb3J0fWApXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKXsgXG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bGl0Y2FzdGNsaWVudCBAIGluaXQ6ICR7ZX1gKSBcbiAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlJywgKG1lc3NhZ2UsIHJpbmZvKSA9PiB7IHRoaXMubWVzc2FnZVJlY2VpdmVkKG1lc3NhZ2UsIHJpbmZvKSB9KVxuIFxuICAgICAgICAvL2NoZWNrIGZvciBkZXByZWNhdGVkIGluc3RhbmNlIGluIGEgbG9vcFxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuaXNEZXByZWNhdGVkSW5zdGFuY2UuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIuc3RhcnQoKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqL1xuICAgICBtZXNzYWdlUmVjZWl2ZWQgKG1lc3NhZ2UsIHJpbmZvKSB7XG4gICAgICBcbiAgICAgICAgY29uc3Qgc2VydmVySW5mbyA9IEpTT04ucGFyc2UoU3RyaW5nKG1lc3NhZ2UpKVxuICAgICAgICBzZXJ2ZXJJbmZvLnNlcnZlcmlwID0gcmluZm8uYWRkcmVzc1xuICAgICAgICBzZXJ2ZXJJbmZvLnNlcnZlcnBvcnQgPSByaW5mby5wb3J0XG4gICAgICAgIHNlcnZlckluZm8ucmVhY2hhYmxlID0gdHJ1ZVxuICAgICAgICBzZXJ2ZXJJbmZvLnRpbWVzdGFtcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICAgLy9yZWNvcmQgdGltZXN0YW1wIG9mIGxhc3QgbWVzc2FnZSBmcm9tIHNlcnZlciAoaWdub3JlIHNlcnZlcnRpbWVzdGFtcCBiZWNhdXNlIGl0IG1heSBoYXZlIGEgZGlmZmVyZW50IHN5c3RlbSB0aW1lKVxuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMuaXNOZXdFeGFtSW5zdGFuY2Uoc2VydmVySW5mbykpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBtZXNzYWdlUmVjZWl2ZWQ6IEFkZGluZyBuZXcgRXhhbSBJbnN0YW5jZSBcIiR7c2VydmVySW5mby5zZXJ2ZXJuYW1lfVwiIHRvIFNlcnZlcmxpc3RgKVxuICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5wdXNoKHNlcnZlckluZm8pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3MgaWYgdGhlIG1lc3NhZ2UgY2FtZSBmcm9tIGEgbmV3IGV4YW0gaW5zdGFuY2Ugb3IgYW4gb2xkIG9uZSB0aGF0IGlzIGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAqL1xuICAgIGlzTmV3RXhhbUluc3RhbmNlIChvYmopIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtU2VydmVyTGlzdFtpXS5pZCA9PT0gb2JqLmlkKSB7XG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbygnZXhpc3Rpbmcgc2VydmVyIC0gdXBkYXRpbmcgdGltZXN0YW1wJylcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCA9IG9iai50aW1lc3RhbXAgLy8gZXhpc3Rpbmcgc2VydmVyIC0gdXBkYXRlIHRpbWVzdGFtcFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIHNlcnZlcnRpbWVzdGFtcCBhbmQgcmVtb3ZlcyBzZXJ2ZXIgZnJvbSBsaXN0IGlmIG9sZGVyIHRoYW4gMSBtaW51dGVcbiAgICAgKi9cbiAgICBpc0RlcHJlY2F0ZWRJbnN0YW5jZSAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKClcblxuICAgICAgICAgICAgaWYgKG5vdyAtIDE2MDAwID4gdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXApIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgbXVsdGljYXN0Y2xpZW50IEAgaXNEZXByZWNhdGVkSW5zdGFuY2U6IFJlbW92aW5nIGluYWN0aXZlIHNlcnZlciAnJHt0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnNlcnZlcm5hbWV9JyBmcm9tIGxpc3RgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3Quc3BsaWNlKGksIDEpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBNdWx0aWNhc3RDbGllbnQoKVxuIiwgImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5cbmV4cG9ydCBjbGFzcyBTY2hlZHVsZXJTZXJ2aWNlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgIGFjdGlvbjogKCkgPT4gdm9pZDtcbiAgICBoYW5kbGU6IE5vZGVKUy5UaW1lcjtcbiAgICBpbnRlcnZhbDogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYWN0aW9uOiAoKSA9PiB2b2lkLCBtczogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuYWN0aW9uID0gYWN0aW9uO1xuICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5pbnRlcnZhbCA9IG1zO1xuICAgICAgICB0aGlzLmFkZExpc3RlbmVyKCd0aW1lb3V0JywgdGhpcy5hY3Rpb24pO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGFydCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLmVtaXQoJ3RpbWVvdXQnKSwgdGhpcy5pbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaGFuZGxlKTtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufSIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cblxuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBCcm93c2VyVmlldywgZGlhbG9nLCBzY3JlZW59IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHBhdGgsIHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnIFxuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZydcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IHsgYWN0aXZlV2luZG93IH0gZnJvbSAnZ2V0LXdpbmRvd3MnO1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5cblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuXG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBXaW5kb3cgaGFuZGxpbmcgKGlwY1JlbmRlcmVyIFByb2Nlc3MgLSBGcm9udGVuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2NrV2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXJ2ZWQgZGlzcGxheSBJRCBmb3IgZXhhbSB3aW5kb3cgKHNldCBpbW1lZGlhdGVseSB3aGVuIHdpbmRvdyBpcyBjcmVhdGVkKVxuICAgICAgdGhpcy5zcGxhc2h3aW4gPSBudWxsXG4gICAgICB0aGlzLmJpcHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgXG4gICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHF1ZXN0aW9uIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgbWluaW1pemUgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLndpbmRvd1RyYWNrZXIuYmluZCh0aGlzKSwgMTAwMClcbiAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGVsZWN0cm9uIHdpbmRvdyBpbiBmb2N1cyBvciBhbiBvdGhlciBlbGVjdHJvbiB3aW5kb3cgZGVwZW5kaW5nIG9uIHRoZSBoaWVyYWNoeVxuICAgIGdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkge1xuICAgICAgICBjb25zdCBmb2N1c2VkV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICAgIGlmIChmb2N1c2VkV2luZG93KSB7XG4gICAgICAgICAgcmV0dXJuIGZvY3VzZWRXaW5kb3dcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbmxvY2tXaW5kb3cpe3JldHVybiB0aGlzLnNjcmVlbmxvY2tXaW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmV4YW13aW5kb3cpe3JldHVybiB0aGlzLmV4YW13aW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1haW53aW5kb3cpe3JldHVybiB0aGlzLm1haW53aW5kb3d9XG4gICAgICAgICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiAxMDAwLFxuICAgICAgICAgICAgaGVpZ2h0OjgwMCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgLy8gcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAvLyB0cmFuc3BhcmVudDogdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaWYgKGJpcHRlc3QpeyAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vcS5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cbiAgICAgICAgZWxzZSB7ICAgICAgICAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vd3d3LmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5iaXB3aW5kb3cgJiYgIXRoaXMuYmlwd2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJkaWQtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aWxsLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG5cbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJuZXctd2luZG93XCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG4gICAgIFxuICAgICAgICAgXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBsb2cuaW5mbyhcInRhcmdldDogX2JsYW5rXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1yZWRpcmVjdCcsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnUmVkaXJlY3RpbmcgdG86JywgdXJsKTtcbiAgICAgICAgICAgIC8vIFByXHUwMEZDZmVuLCBvYiBkaWUgVVJMIGRhcyBnZXdcdTAwRkNuc2NodGUgRm9ybWF0IGhhdFxuICAgICAgICAgICAgaWYgKHVybC5zdGFydHNXaXRoKCdiaWxkdW5nc3BvcnRhbDovLycpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVydCBkZW4gU3RhbmRhcmQtUmVkaXJlY3RcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSAnYmlsZHVuZ3Nwb3J0YWw6Ly90b2tlbj0nO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9rZW4gPSB1cmwuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdDYXB0dXJlZCBUb2tlbjonKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyh0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JpcFRva2VuJywgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHRoaXMgaXMgYW4gZWFzdGVyIGVnZ1xuICAgICAqL1xuICAgIGNyZWF0ZUVhc3RlcldpbigpIHtcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogNzY4LFxuICAgICAgICAgICAgaGVpZ2h0OjQ4MCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLmxvYWRGaWxlKGpvaW4oX19kaXJuYW1lLCBgLi4vLi4vcHVibGljL2Nvd3NvbmljZS9pbmRleC5odG1sYCkpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVhc3RlcndpbiAmJiAhdGhpcy5lYXN0ZXJ3aW4uaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3Rlcndpbi5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEJsb2NrV2luZG93ICh0byBjb3ZlciBhZGRpdGlvbmFsIHNjcmVlbnMpXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgbmV3QmxvY2tXaW4oZGlzcGxheSkge1xuICAgICAgICBsZXQgYmxvY2t3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgcGFyZW50OiB0aGlzLmV4YW13aW5kb3csXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIGZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgICAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICBsZXQgdXJsID0gXCJub3Rmb3VuZFwiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYmxvY2t3aW4ucmVtb3ZlTWVudSgpIFxuICAgICAgICBibG9ja3dpbi5zZXRNaW5pbWl6YWJsZShmYWxzZSlcblxuICAgICAgICAvLyBQb3NpdGlvbiB3aW5kb3cgb24gc3BlY2lmaWMgZGlzcGxheSBCRUZPUkUgc2hvd2luZyBpdFxuICAgICAgICBibG9ja3dpbi5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnksXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodFxuICAgICAgICB9KTtcblxuICAgICAgICBibG9ja3dpbi5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgYmxvY2t3aW4uc2hvdygpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpO1xuICAgICAgICAgICAgYmxvY2t3aW4ub24oJ2xlYXZlLWZ1bGwtc2NyZWVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7IC8vIHNvZm9ydCB3aWVkZXIgenVyXHUwMEZDY2tzZXR6ZW5cbiAgICAgICAgICAgIH0pOyBcbiAgICAgICAgfSAgXG4gICAgICAgIGVsc2UgeyAgIFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0S2lvc2sodHJ1ZSk7IC8vIEtpb3NrID0gXCJ0YWtlIG92ZXIgbWFpbiBzY3JlZW5cIi4gb24gbWFjb3MgdGhhdCdzIHdoeSB3ZSB1c2UgZnVsbFNjcmVlbiB3b3JrYXJvdW5kIHdpdGggZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgfVxuICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgIGJsb2Nrd2luLmRpc3BsYXkgPSBkaXNwbGF5XG4gICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLnB1c2goYmxvY2t3aW4pXG4gICAgfVxuXG5cbiAgICAvLyBibG9jayBhbGwgc2NyZWVucyB3aXRoIGEgYmxvY2t3aW5kb3dcbiAgICBhc3luYyBpbml0QmxvY2tXaW5kb3dzKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIC8vbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBmb3VuZCAke2Rpc3BsYXlzLmxlbmd0aH0gZGlzcGxheXNgKVxuICAgICAgICBcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyAgLy8gbG9jayBhbGwgc2NyZWVuc1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZXhhbSB3aW5kb3cgdG8gYmUgdmlzaWJsZSBhbmQgcG9zaXRpb25lZCAoaW1wb3J0YW50IGZvciBXYXlsYW5kL0tXaW4pXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGxldCByZXRyaWVzID0gMFxuICAgICAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMFxuICAgICAgICAgICAgICAgIHdoaWxlICghdGhpcy5leGFtd2luZG93LmlzVmlzaWJsZSgpICYmIHJldHJpZXMgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKVxuICAgICAgICAgICAgICAgICAgICByZXRyaWVzKytcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQWRkaXRpb25hbCB3YWl0IHRvIGVuc3VyZSBwb3NpdGlvbmluZyBpcyBjb21wbGV0ZSBvbiBXYXlsYW5kXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBibG9jayB3aW5kb3dzIGZyb20gYXJyYXlcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gdGhpcy5ibG9ja3dpbmRvd3MuZmlsdGVyKGJsb2Nrd2luID0+IGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgYWxsIGV4aXN0aW5nIHdpbmRvd3MgYW5kIGRldGVybWluZSB0aGVpciBkaXNwbGF5c1xuICAgICAgICAgICAgY29uc3QgdXNlZERpc3BsYXlJZHMgPSBuZXcgU2V0KClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmlyc3QsIHVzZSB0aGUgcmVzZXJ2ZWQgZXhhbSBkaXNwbGF5IElEIChzZXQgaW1tZWRpYXRlbHkgd2hlbiBleGFtIHdpbmRvdyB3YXMgY3JlYXRlZClcbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgc2NyZWVuIGlzIHJlc2VydmVkIGV2ZW4gaWYgdGhlIHdpbmRvdyBpc24ndCBmdWxseSBpbml0aWFsaXplZCB5ZXRcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1EaXNwbGF5SWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQodGhpcy5leGFtRGlzcGxheUlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBbHdheXMgZXhjbHVkZSBwcmltYXJ5IGRpc3BsYXkgKGV4YW0gd2luZG93IGxvY2F0aW9uKVxuICAgICAgICAgICAgY29uc3QgcHJpbWFyeURpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKHByaW1hcnlEaXNwbGF5ICYmIHByaW1hcnlEaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHByaW1hcnlEaXNwbGF5LmlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBleGFtIHdpbmRvdyBkaXNwbGF5IChhcyBmYWxsYmFjay92ZXJpZmljYXRpb24sIGJ1dCByZXNlcnZlZCBJRCB0YWtlcyBwcmlvcml0eSlcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXhhbSB3aW5kb3cgaXMgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBleGFtIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgYmxvY2sgd2luZG93cyBkaXNwbGF5c1xuICAgICAgICAgICAgZm9yIChjb25zdCBibG9ja3dpbiBvZiB0aGlzLmJsb2Nrd2luZG93cykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IGJsb2Nrd2luLmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogYmxvY2sgd2luZG93IGZvdW5kIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgYmxvY2sgd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgYmxvY2sgd2luZG93cyBmb3IgZGlzcGxheXMgdGhhdCBkb24ndCBoYXZlIGV4YW0gb3IgYmxvY2sgd2luZG93c1xuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgaWYgKHVzZWREaXNwbGF5SWRzLmhhcyhkaXNwbGF5LmlkKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IHNraXBwaW5nIGRpc3BsYXkgJHtkaXNwbGF5LmlkfSAtIGFscmVhZHkgaGFzIGV4YW0gb3IgYmxvY2sgd2luZG93YClcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogY3JlYXRlIGJsb2Nrd2luIG9uOlwiLGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgdGhpcy5uZXdCbG9ja1dpbihkaXNwbGF5KSAgLy8gYWRkIGJsb2Nrd2luZG93cyBmb3IgZGlzcGxheXMgd2l0aG91dCBleGFtIHdpbmRvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApXG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5mb3JFYWNoKCAoYmxvY2t3aW4pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTY3JlZW5sb2NrIFdpbmRvdyAodG8gY292ZXIgdGhlIG1haW5zY3JlZW4pIC0gYmxvY2sgc3R1ZGVudHMgZnJvbSB3b3JraW5nXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSB7XG4gICAgICAgIGxldCBzY3JlZW5sb2NrV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgLy8gcGFyZW50OiB0aGlzLm1haW53aW5kb3csICAgLy8gbGVhZHMgdG8gdmlzaWJsZSB0aXRsZWJhciBpbiBnbm9tZS1kZXNrdG9wXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdTY3JlZW5sb2NrJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICAvL2ZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgdXJsID0gXCJsb2NrXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIC8vIEFkZCB3aW5kb3cgdG8gYXJyYXkgZmlyc3QsIGJlZm9yZSBhZGRpbmcgYmx1ciBsaXN0ZW5lclxuICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLnB1c2goc2NyZWVubG9ja1dpbmRvdylcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXNjcmVlbmxvY2tXaW5kb3cpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5yZW1vdmVNZW51KCkgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldE1pbmltaXphYmxlKGZhbHNlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInBvcC11cC1tZW51XCIsIDEpICAgLy9hYm92ZSBleGFtIHdpbmRvdyAocG9wLXVwLW1lbnUsIDApXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNob3coKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldENsb3NhYmxlKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldFZpc2libGVPbkFsbFdvcmtzcGFjZXModHJ1ZSk7IC8vIHB1dCB0aGUgd2luZG93IG9uIGFsbCB2aXJ0dWFsIHdvcmtzcGFjZXNcbiAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKFwic2NyZWVubG9ja1wiKVxuICAgICAgICB9KVxuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9ICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2VkJywgKCkgPT4geyAgIC8vIHJlbW92ZSB3aW5kb3cgZnJvbSBhcnJheSB3aGVuIGFjdHVhbGx5IGNsb3NlZFxuICAgICAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IHRoaXMuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgd2luICE9PSBzY3JlZW5sb2NrV2luZG93ICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEV4YW13aW5kb3dcbiAgICAgKiBAcGFyYW0gZXhhbXR5cGUgZWR1dmlkdWFsLCBtYXRoLCBsYW5ndWFnZVxuICAgICAqIEBwYXJhbSB0b2tlbiBzdHVkZW50IHRva2VuXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyB0aGUgc2VydmVyc3RhdHVzIG9iamVjdCBjb250YWluaW5nIGluZm8gYWJvdXQgc3BlbGxjaGVjayBsYW5ndWFnZSBldGMuIFxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUV4YW1XaW5kb3coZXhhbXR5cGUsIHRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnlkaXNwbGF5KSB7XG4gICAgICAgIC8vIGp1c3QgdG8gYmUgc3VyZSB3ZSBjaGVjayBzb21lIGltcG9ydGFudCB2YXJzIGhlcmVcbiAgICAgICAgaWYgKGV4YW10eXBlICE9PSBcInJkcFwiICYmIGV4YW10eXBlICE9PSBcIndlYnNpdGVcIiAmJiAgZXhhbXR5cGUgIT09IFwiZ2Zvcm1zXCIgJiYgZXhhbXR5cGUgIT09IFwiZWR1dmlkdWFsXCIgJiYgZXhhbXR5cGUgIT09IFwiZWRpdG9yXCIgJiYgZXhhbXR5cGUgIT09IFwibWF0aFwiICYmIGV4YW10eXBlICE9PSBcIm1pY3Jvc29mdDM2NVwiICYmIGV4YW10eXBlICE9PSBcImFjdGl2ZXNoZWV0c1wiIHx8ICF0b2tlbil7ICAvLyBmb3Igbm93Li4gd2UgcHJvYmFibHkgc2hvdWxkIHN0b3AgZXZlcnl0aGluZyBoZXJlXG4gICAgICAgICAgICBsb2cud2FybihcIm1pc3NpbmcgcGFyYW1ldGVycyBmb3IgZXhhbS1tb2RlIG9yIG1vZGUgbm90IGluIGFsbG93ZWQgbGlzdCFcIilcbiAgICAgICAgICAgIGV4YW10eXBlID0gXCJlZGl0b3JcIiBcbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIC8vIEFsd2F5cyB1c2UgcHJpbWFyeSBkaXNwbGF5IGZvciBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMgfHwgIXByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBkaXNwbGF5c1swXSB8fCBwcmltYXJ5ZGlzcGxheVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBJbW1lZGlhdGVseSByZXNlcnZlIHRoZSBkaXNwbGF5IElEIGZvciB0aGUgZXhhbSB3aW5kb3cgKGJlZm9yZSB3aW5kb3cgaXMgZnVsbHkgaW5pdGlhbGl6ZWQpXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYmxvY2sgd2luZG93cyBmcm9tIGJlaW5nIGNyZWF0ZWQgb24gdGhlIHNhbWUgc2NyZWVuXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gcHJpbWFyeWRpc3BsYXkuaWRcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogcmVzZXJ2aW5nIGRpc3BsYXkgJHt0aGlzLmV4YW1EaXNwbGF5SWR9IGZvciBleGFtIHdpbmRvd2ApXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBweCA9IDBcbiAgICAgICAgbGV0IHB5ID0gMFxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcy54KSB7XG4gICAgICAgICAgICBweCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54XG4gICAgICAgICAgICBweSA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy55XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBweCArIDAsXG4gICAgICAgICAgICB5OiBweSArIDAsXG4gICAgICAgICAgICB0aXRsZTogJ0V4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IDE0NDAsXG4gICAgICAgICAgICBoZWlnaHQ6IDc2OCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogd2luLCAgLy90aGlzIGRvZXNudCB3b3JrIHRvZ2V0aGVyIHdpdGgga2lvc2sgb24gdWJ1bnR1IGdub21lID8/IHd0ZlxuICAgICAgICAgICAgLy8gbW9kYWw6IHRydWUsICAvLyB0aGlzIGJsb2NrcyB0aGUgbWFpbiB3aW5kb3cgb24gd2luZG93cyB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgb3BlblxuICAgICAgICAgICAgLy8gY2xvc2FibGU6IGZhbHNlLCAgLy8gaWYgd2UgY2FuJ3QgZGVmaW5lICdwYXJlbnQnIHRoaXMgd2luZG93IGhhcyB0byBiZSBjbG9zYWJsZSAtIHdoeT9cbiAgICAgICAgICAgIC8vYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBvcGFjaXR5OiAxLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHZpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICBraW9zazogdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgPyBmYWxzZSA6IHRydWUsXG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWUsXG4gICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5leGFtd2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlTWVudSgpICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5mb2N1cygpXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzV2F5bGFuZCl7IHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdGFydCgpIH0gLy8gY29uc3RhbnRseSBjaGVjayBpZiB0aGUgYWN0aXZlIHdpbmRvdyBpcyB0aGUgZXhhbXdpbmRvdyAtIGlmIG5vdCwgYnJpbmcgaXQgdG8gZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlUmVzdHJpY3Rpb25zKHRoaXMpICAvLyBkaXNhYmxlIGtleWJvYXJkIHNob3J0Y3V0cyBldGMuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAvLyBkbyBub3Qgc2V0IGJsdXIgbGlzdGVuZXIgdG9vIGVhcmx5XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKCkgIC8vIGFkZCBibHVyIGxpc3RlbmVyIHRvIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgZGlkLWZpbmlzaC1sb2FkOiBlcnJvciBpbiBleGFtd2luZG93IHNldHVwXCIsIGUpfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cyAvL3dlIGtlZXAgaXQgdGhlcmUgdG8gbWFrZSBpdCBhY2Nlc3NhYmxlIHZpYSBleGFtd2luZG93IGluIGlwY0hhbmRsZXJcbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQgPSA5NCAgIC8vIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgY29udGVudCB2aWV3XG4gICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNaWNyb3NvZnQgMzY1IGVtZWJlZHMgaXRzIGVkaXRvciBpbiBhbiBpZnJhbWUgd2l0aCBhY3RpdmUgQ29udGVudCBTZWN1cml0eSBQb2xpY3kgKENTUClcbiAgICAgICAgICogVGhlIG9ubHkgd2F5IHRvIGJlIGFibGUgdG8gaW5qZWN0IGNvZGUgaXMgdG8gbG9hZCBpdCBkaXJlY3RseSBpbiB0aGUgbWFpbiB3aW5kb3cgPGVtYmVkPiA8aWZyYW1lPiBvciBldmVuIDx3ZWJ2aWV3PiBvZmZlcnMgbm8gd29ya2Fyb3VuZFxuICAgICAgICAgKiB0aGVyZWZvcmUgd2UgdXNlIFwiQnJvd3NlclZpZXdcIiBpbiBvcmRlciB0byBkaXNwbGF5IHR3byBwYWdlcyBpbiBvbmUgd2luZG93OiBvbiB0b3AgPiBleGFtIGhlYWRlciwgb24gYm90dG9tID4gb2ZmaWNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlmIChleGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIiAgKSB7IC8vZXh0ZXJuYWwgcGFnZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJzdGFydGluZyBtaWNyb3NvZnQzNjUgZXhhbS4uLlwiKVxuICAgICAgICAgICAgbGV0IHVybHZpZXcgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgICBcbiAgICAgICAgICAgIGlmICghdXJsdmlldykgey8vIHdlIHdhaXQgZm9yIHRoZSBuZXh0IHVwZGF0ZSB0aWNrIC0gbXNvZmZpY2VzaGFyZSBuZWVkcyB0byBiZSBzZXQgISAoY291bGQgaGFwcGVuIHdoZW4gYSBzdHVkZW50IGNvbm5lY3RzIGxhdGVyIHRoZW4gZXhhbSBtb2RlIGlzIHNldCBidXQgaGlzIHNoYXJlIHVybCBuZWVkcyBzb21lIHRpbWUpXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogbm8gdXJsIGZvciBtaWNyb3NvZnQzNjUgd2FzIHNldCB5ZXQgLSB3YWl0aW5nIGZvciBuZXh0IHVwZGF0ZSB0aWNrXCIpXG4gICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBkZXN0cm95ZWRcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbG9hZCB0b3AgbWVudSBpbiBNYWluUGFnZVxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgZWR1dmlkdWFsIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBiYWNrZ3JvdW5kdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vJHt0b2tlbn0vYFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkVVJMKGJhY2tncm91bmR1cmwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRGVmaW5lIHRoZSBNYWluQ29udGVudFBhZ2Ugdmlld1xuICAgICAgICAgICAgbGV0IGNvbnRlbnRWaWV3ID0gbmV3IEJyb3dzZXJWaWV3KHtcbiAgICAgICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsICBcbiAgICAgICAgICAgICAgICAgIGNvbnRleHRJc29sYXRpb246IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCkud2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCkuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0QXV0b1Jlc2l6ZSh7IHdpZHRoOiB0cnVlLCBoZWlnaHQ6IHRydWUsIGhvcml6b250YWw6IHRydWUsIHZlcnRpY2FsOiB0cnVlIH0pO1xuICAgICAgICAgICAgY29udGVudFZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmx2aWV3KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgICAgICAgY29udGVudFZpZXcud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgfVxuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkQnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2VudGVyLWZ1bGwtc2NyZWVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgICAgICBsZXQgbmV3Qm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ3Jlc2l6ZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgbmV3Qm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIG5vcm1hbCBleGFtIG1vZGUgKGVkaXRvciwgbWF0aCwgZWR1dmlkdWFsLCB3ZWJzaXRlLCBnZm9ybXMpXG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIGxldCB1cmwgPSBleGFtdHlwZSAgIC8vIGVkaXRvciB8fCBtYXRoIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZSBzcGVjaWFsIE5BVklHQVRJT04gc2l0dWF0aW9uc1xuICAgICAgICAgKi9cblxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIEZvcm1zLCBXZWJzaXRlLCBFZHV2aWR1YWwsIEVkaXRvciwgUkRQLCBNaWNyb3NvZnQzNjVcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgLy8gQmxvY2sgbmF2aWdhdGlvbiBvbiBleGFtd2luZG93LndlYkNvbnRlbnRzIGxldmVsIGZvciBhbGwgbW9kZXMgdGhhdCBjYW4gZGlzcGxheSBQREZzIGluIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBuYXZpZ2F0aW9uIHdoZW4gY2xpY2tpbmcgbGlua3MgaW4gUERGcyBkaXNwbGF5ZWQgaW4gdGhlIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gV2Vidmlldy9Ccm93c2VyVmlldyBibG9ja2luZyBpcyBoYW5kbGVkIHNlcGFyYXRlbHkgdmlhIElQQyBpbiBpcGNoYW5kbGVyLmpzIG9yIG1vZGUtc3BlY2lmaWMgaGFuZGxlcnMgYmVsb3dcbiAgICAgICAgY29uc3QgZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyID0gW1wiZ2Zvcm1zXCIsIFwid2Vic2l0ZVwiLCBcImVkdXZpZHVhbFwiLCBcImVkaXRvclwiLCBcInJkcFwiLCBcIm1pY3Jvc29mdDM2NVwiLCBcImFjdGl2ZXNoZWV0c1wiXTtcbiAgICAgICAgaWYgKGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlci5pbmNsdWRlcyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gUHJldmVudCBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgVnVlIGFwcCAoZS5nLiBmcm9tIFBERiBsaW5rcyBpbiBleGFtaGVhZGVyKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFByZXZlbnQgbmV3IHdpbmRvd3MgZnJvbSBvcGVuaW5nIGluIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIG5ldy13aW5kb3dcIiwgdXJsKTtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIFxuICAgICAgICAgICAgfSk7XG4gICAgIFxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgc2V0V2luZG93T3BlbkhhbmRsZXJcIiwgdXJsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBNaWNyb3NvZnQgRXhjZWwvV29yZFxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiKXsgIC8vIGRvIG5vdCB1bmRlciBhbnkgY2lyY3Vtc3RhbmNlcyBhbGxvdyBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgY3VycmVudCBleGFtIHVybFxuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLmV4YW13aW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSB1c2VyIHdhbnRzIHRvIG5hdmlnYXRlIGF3YXkgZnJvbSB0aGlzIHBhZ2VcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodXJsICE9PSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiZG8gbm90IG5hdmlnYXRlIGF3YXkgZnJvbSB0aGlzIHRlc3QuLiBcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgICAgIH0gIFxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgIFxuICAgICAgICAgICAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGV4ZWN1dGVDb2RlID0gIGBcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gbG9jaygpe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gJ1dBQ0RpYWxvZ091dGVyQ29udGFpbmVyJywnV0FDRGlhbG9nSW5uZXJDb250YWluZXInLCdXQUNEaWFsb2dQYW5lbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoaWRldXNCeUlEID0gWydTaG93SGlkZUVxdWF0aW9uVG9vbHNQYW5lJywnTGlua0dyb3VwJywnR3JhcGhpY3NFZGl0b3InLCdJbnNlcnRUYWJsZU9mQ29udGVudHNJbkluc2VydFRhYicsJ0luc2VydE9ubGluZXZpZGVvJywnUGljdHVyZScsJ1JpYmJvbi1QaWN0dXJlTWVudU1MUkRyb3Bkb3duJywnSW5zZXJ0QWRkSW5GbHlvdXQnLCdEZXNpZ25lcicsJ0VkaXRvcicsJ0ZhclBhbmUnLCdIZWxwJywnSW5zZXJ0QXBwc0Zvck9mZmljZScsJ0ZpbGVNZW51TGF1bmNoZXJDb250YWluZXInLCdIZWxwLXdyYXBwZXInLCdSZXZpZXctd3JhcHBlcicsJ0hlYWRlcicsJ0ZhclBlcmlwaGVyYWxDb250cm9sc0NvbnRhaW5lcicsJ0J1c2luZXNzQmFyJ11cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoZW50cnkgb2YgaGlkZXVzQnlJRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZW50cnkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiZGlzcGxheVwiLCBcIm5vbmVcIiwgXCJpbXBvcnRhbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYnV0dG9uQXBwc092ZXJmbG93ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ0FkZC1JbnMnKVswXTsgIC8vIHRoaXMgYnV0dG9uIGlzIHJlZHJhd24gb24gcmVzaXplIChkb2Vzbid0IGhhcHBlbiBpbiBleGFtIG1vZGUgYnV0IHN0aWxsIHRoZXJlIG11c3QgYmUgYSBjbGVhbmVyIHdheSAtIGluc2VydGluZyBjc3MgYmVmb3JlIGl0IGFwcGVhcnMgaXMgbm90IHdvcmtpbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnV0dG9uQXBwc092ZXJmbG93KXsgYnV0dG9uQXBwc092ZXJmbG93LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiU3VjaGVuXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiXHUwMERDYmVyc2V0emVuXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQ29waWxvdFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJBZGQtSW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cENvbnRleHRNZW51XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBTeW5vbnltc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJSaWJib24tUmVmZXJlbmNlc1NtYXJ0TG9va1VwXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiRGljdGF0aW9uXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJHZXRBZGRpbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlBpY3R1cmVzX01MUlwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTsgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvY2soKSAgLy9mb3Igc29tZSByZWFzb24gZXhjZWwgZGVsYXlzIHRoYXQgY2FsbC4uIGRvZXNudCBoYXBwZW4gb24gcGFnZSBmaW5pc2ggbG9hZFxuICAgICAgICAgICAgICAgICAgICBgXG5cbiAgICAgICAgICAgIGxldCBzY2hlZHVsZXJJbnN0YW5jZSA9IG51bGxcbiAgICAgICAgICAgIHRoaXMubG9ja0NhbGxiYWNrID0gKCkgPT4gdGhpcy5sb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2UpOyBcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5sb2NrQ2FsbGJhY2ssIDQwMClcbiAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IHNjaGVkdWxlckluc3RhbmNlXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZS5zdGFydCgpXG4gICAgICAgICAgICAvLyBXYWl0IHVudGlsIHRoZSB3ZWJDb250ZW50cyBpcyBmdWxseSBsb2FkZWQgIC8vIHRoaXMgaXMgbm90IHdvcmtpbmcgcmVsaWFibHkgYmVjYXVzZSB0aGUgcGFnZSBpcyBsb2FkZWQgaW4gbWFueSBzdGVwcyBhbmQgdGhlIHVpIGVsZW1lbnRzIGFyZSBub3QgYXZhaWxhYmxlIHlldFxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdhcHAtY29tbWFuZCcsIChlLCBjbWQpID0+IHtcbiAgICAgICAgICAgIC8vICdicm93c2VyLWJhY2t3YXJkJyB1bmQgJ2Jyb3dzZXItZm9yd2FyZCcgc2luZCBkaWUgQmVmZWhsZSwgZGllIGJlaW0gS2xpY2sgYXVmIGRpZSBNYXVzdGFzdGVuIGdlc2VuZGV0IHdlcmRlblxuICAgICAgICAgICAgaWYgKGNtZCA9PT0gJ2Jyb3dzZXItYmFja3dhcmQnIHx8IGNtZCA9PT0gJ2Jyb3dzZXItZm9yd2FyZCcpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIm5vIG5hdmlnYXRpb24gYWxsb3dlZFwiKVxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVybiBTaWUgZGFzIFN0YW5kYXJkdmVyaGFsdGVuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RvcCgpXG4gICAgICAgICAgICAgICAgLy9kaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdykgIC8vZG8gbm90IGRpc2FibGUgdHdpY2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIGxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSl7XG4gICAgICAgIGlmIChicm93c2VyVmlldy53ZWJDb250ZW50cyAmJiBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUpe1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIsIGZyYW1lLm5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lICYmIChmcmFtZS5uYW1lID09PSAnV2ViQXBwbGljYXRpb25GcmFtZScgfHwgZnJhbWUubmFtZSA9PT0gJ1dhY0ZyYW1lX1dvcmRfMCcgfHwgZnJhbWUubmFtZSA9PT0gJ1dhY0ZyYW1lX0V4Y2VsXzAnKSkge1xuICAgICAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIilcbiAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNjaGVkdWxlckluc3RhbmNlKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBzdG9wcGluZyBsb2NrU2NoZWR1bGVyXCIpXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZS5zdG9wKClcbiAgICAgICAgICAgIGlmICh0aGlzLmxvY2tTY2hlZHVsZXIgPT09IHNjaGVkdWxlckluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IG5vIGJyb3dzZXJWaWV3IG9yIGxvY2tTY2hlZHVsZXIgZm91bmRcIilcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgXG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIE1BSU4gV0lORE9XXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBhc3luYyBjcmVhdGVNYWluV2luZG93KCkge1xuICAgICAgICBsZXQgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBjb25zdCBjdXJyZW50RGlyID0gZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuJywgaW1wb3J0Lm1ldGEudXJsKSk7XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVswXVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2luZG93IGRpbWVuc2lvbnMgLSBkZWZpbmVkIG9uY2UsIHVzZWQgZXZlcnl3aGVyZVxuICAgICAgICBjb25zdCB3aW5kb3dXaWR0aCA9IDEwMjRcbiAgICAgICAgY29uc3Qgd2luZG93SGVpZ2h0ID0gNjQwXG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGNlbnRlciBwb3NpdGlvbiBvbiBwcmltYXJ5IGRpc3BsYXlcbiAgICAgICAgbGV0IHggPSAwXG4gICAgICAgIGxldCB5ID0gMFxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnggKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMud2lkdGggLSB3aW5kb3dXaWR0aCkgLyAyKVxuICAgICAgICAgICAgeSA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy55ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLmhlaWdodCAtIHdpbmRvd0hlaWdodCkgLyAyKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdNYWluIHdpbmRvdycsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHksXG4gICAgICAgICAgICB3aWR0aDogd2luZG93V2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHdpbmRvd0hlaWdodCxcbiAgICAgICAgICAgIG1pbldpZHRoOiA4NTAsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IDYwMCxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGFzIFx1MDBDNG5kZXJuIGRlciBHclx1MDBGNlx1MDBERmUgIFxuICAgICAgICAgICAgZnVsbHNjcmVlbmFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRlbiBWb2xsYmlsZG1vZHVzIC0gd2ljaHRpZyBmXHUwMEZDciBtYWNvcyBkZW5uIHdlbm4gYXVmIG1hY29zIGRhcyBtYWlud2luZG93IGF1ZiBmdWxsc2NyZWVuIGlzdCBncmVpZnQgYmVpbSBleGFtd2luZG93IGRlciBraW9zayBtb2RlIG5pY2h0ICAtIGVsZWN0cm9uIGJ1ZyAobmVlZHMgZXhhbXBsZSBjb2RlKTogPj4gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy80NDc1NVxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIHZpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudERpcixcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgcHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OKVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBoYW5kbGVycyBiZWZvcmUgbG9hZGluZ1xuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmICF0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0KSB7ICAvLyBhbGxvd2V4aXQgaXN0IGVpbiBvdmVycmlkZSB2b20gY29udGV4dCBtZW51IG9kZXIgc2NyZWVuc2hvdCB0ZXN0LiBkaWVzZXIga2FubiBkaWUgYXBwIHNjaGxpZXNzZW5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGFzIG5vIGxlZ2FjeSB0cmF5XG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dUcmF5KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBHTk9NRSBkZXRlY3RlZCwgcXVpdHRpbmcgaW5zdGVhZCBvZiB0cmF5IG1pbmltaXplYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgIC8vIGFsbG93IGNsb3NlIGZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuaGlkZSgpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2hvd01pbmltaXplV2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTWluaW1pemluZyBOZXh0LUV4YW0gdG8gU3lzdGVtdHJheWApIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFNldCB3aW5kb3cgcHJvcGVydGllcyBpbW1lZGlhdGVseSBhZnRlciBjcmVhdGlvblxuICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5mb2N1cygpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKClcblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudltcIkRFQlVHXCJdKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vcmVuZGVyZXIvaW5kZXguaHRtbCcpXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH1gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGFzeW5jIHNob3dFeGl0V2FybmluZyhtZXNzYWdlKXtcbiAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT2snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIEJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd0V4aXRRdWVzdGlvbigpe1xuICAgICAgICBpZiAodGhpcy5leGl0UXVlc3Rpb25PcGVuKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkaWFsb2cgYWxyZWFkeSBvcGVuLCBza2lwcGluZ1wiKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnSmEnLCAnTmVpbiddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gYmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1dvbGxlbiBzaWUgZGllIEFud2VuZHVuZyBOZXh0LUV4YW0gYmVlbmRlbj8nLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGNob2ljZS5yZXNwb25zZSA9PSAxKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkbyBub3QgY2xvc2UgTmV4dC1FeGFtIGFmdGVyIGZpbmlzaGVkIEV4YW1cIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dNaW5pbWl6ZVdhcm5pbmcoKXtcbiAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNaW5pbWl6ZSB0byBTeXN0ZW0gVHJheScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0RpZSBBbndlbmR1bmcgTmV4dC1FeGFtIHd1cmRlIG1pbmltaWVydCEnLFxuICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIEZ1bmN0aW9uc1xuICAgICAqL1xuXG4gICAgaXNXYXlsYW5kKCl7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7IFxuICAgIH1cblxuICAgIC8vIHRoaXMgZnVuY3Rpb24gdXNlcyBhY3RpdmUtd2luIHRvIHJlY2VpdmUgbmFtZSBhbmQgdXJsIGZyb20gYWN0aXZlIHdpbmRvdyAtIHlldCBhbm90aGVyIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoZSBmb2N1cyBpcyBzdGlsbCBvbiBuZXh0ZXhhbVxuICAgIC8vIHRoaXMgaXMgdXNlZCB0byBpbnRyb2R1Y2UgZXhlbXB0aW9ucyBmb3IgdGhlIGJsdXIgbGlzdGVuZXJcbiAgICAvLyAoZG93bmdyYWRlZCBmcm9tIGdldC13aW5kb3dzIGJlY2F1c2Ugb2YgbmFwaSB2OSBpc3N1ZSkgaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9nZXQtd2luZG93cy9pc3N1ZXMvMTg2XG4gICAgYXN5bmMgd2luZG93VHJhY2tlcigpe1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICAvLyBjb25zdCBnZXR3aW4gPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVdpbmRvdygpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlV2luID0gYXdhaXQgYWN0aXZlV2luZG93KClcbiAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGFjdGl2ZVdpbiAmJiBhY3RpdmVXaW4ub3duZXIgJiYgYWN0aXZlV2luLm93bmVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IGFjdGl2ZVdpbi5vd25lci5uYW1lXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoID0gYWN0aXZlV2luLm93bmVyLnBhdGhcbiAgICAgICAgICAgICAgICBsZXQgbmFtZUxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoTG93ZXIgPSB3cGF0aC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZUxvd2VyLmluY2x1ZGVzKFwiZXhhbVwiKSB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJuZXh0XCIpICB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJlbGVjdHJvblwiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImVhc2VvZmFjY2Vzc2RpYWxvZ1wiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImRpc2FibGUtc2hvcnRjdXRzXCIpICl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9rdXMgaXMgb24gYWxsb3dlZCB3aW5kb3cgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvL2ZvY3VzIGlzIG5vdCBvbiBuZXh0LWV4YW0gb3IgYW55IG90aGVyIGFsbG93ZWQgd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCl7ICAvL2xvZyBqdXN0IG9uY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogZm9jdXMgbG9zdCBldmVudCB3YXMgdHJpZ2dlcmVkLiBhcHA6ICR7d3BhdGh9IC0gJHtuYW1lfSBgKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vYWRkcyBibHVyIGxpc3RlbmVyIHdoZW4gZW50ZXJpbmcgZXhhbW1vZGUgICAvLyBibHVyIGV2ZW50IGlzbnQgZmlyZWQgb24gbWFjb3MgTUlTU0lPTkNPTlRST0wgKHdoaWNoIGNhbnQgYmUgZGVhY3RpdmF0ZWQgYW55bW9yZSkgLSBkYW1uIHlvdSBhcHBsZSFcbiAgICBhZGRCbHVyTGlzdGVuZXIod2luZG93ID0gXCJleGFtd2luZG93XCIpe1xuICAgICAgICBpZiAod2luZG93ID09PSBcImV4YW13aW5kb3dcIil7IFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9YClcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50KHRoaXMpKSBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3aW5kb3cgPT09IFwic2NyZWVubG9ja1wiKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd313aW5kb3dgKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnRTY3JlZW5sb2NrKHRoaXMpKSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vcmVtb3ZlcyBibHVyIGxpc3RlbmVyIHdoZW4gbGVhdmluZyBleGFtIG1vZGVcbiAgICByZW1vdmVCbHVyTGlzdGVuZXIoKXtcbiAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdibHVyJylcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIHJlbW92ZUJsdXJMaXN0ZW5lcjogcmVtb3ZpbmcgYmx1ciBsaXN0ZW5lclwiKVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGltcGxlbWVudGluZyBhIHNsZWVwICh3YWl0KSBmdW5jdGlvblxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy9zdHVkZW50IGZvZ3VzIHdlbnQgdG8gYW5vdGhlciB3aW5kb3dcbiAgICBhc3luYyBibHVyZXZlbnQod2luaGFuZGxlcikgeyBcblxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IHN0dWRlbnQgdHJpZWQgdG8gbGVhdmUgZXhhbSB3aW5kb3dcIilcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4Jyl7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndpbmRvd1RyYWNrZXIoKSAgLy9jaGVja3MgaWYgbmV3IGZvY3VzIHdpbmRvdyBpcyBhbGxvd2VkXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd3RyYWNrZXIgY2hlY2sgZG9uZS4uLlwiKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBzY3JlZW5sb2NrIHdpbmRvd3MgZnJvbSBhcnJheSBhbmQgY2hlY2sgaWYgYW55IHN0aWxsIGV4aXN0XG4gICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgY29uc3QgaGFzQWN0aXZlU2NyZWVubG9jayA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Muc29tZSh3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSAmJiB3aW4uaXNWaXNpYmxlKCkpXG4gICAgICAgIC8vIEFsc28gY2hlY2sgY2xpZW50aW5mby5zY3JlZW5sb2NrIGZsYWcgYXMgZmFsbGJhY2sgaW4gY2FzZSBhcnJheSB3YXMgY2xlYXJlZCBidXQgd2luZG93cyBzdGlsbCBleGlzdFxuICAgICAgICBpZiAoaGFzQWN0aXZlU2NyZWVubG9jayB8fCB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uc2NyZWVubG9jaykgeyByZXR1cm4gfS8vIGRvIG5vdGhpbmcgaWYgc2NyZWVubG9ja3dpbmRvdyBzdG9sZSBmb2N1cyAvLyBkbyBub3QgdHJpZ2dlciBhbiBpbmZpbml0ZSBsb29wIGJldHdlZW4gZXhhbSB3aW5kb3cgYW5kIHNjcmVlbmxvY2sgd2luZG93IChzdGVhbGluZyBlYWNoIG90aGVycyBmb2N1cyBiZWNhdXNlIHNjcmVlbmxvY2t3aW5kb3cgYXBwZWFycyBhYm92ZSBleGFtIHdpbmRvdyBhbmQgd2lsbCBjYXB0dXJlIGEga2xpY2sgYW5kIHRoZXJlZm9yZSBzdGVhbCBmb2N1cylcbiAgICAgICAgaWYgKHdpbmhhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkKXsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgLy90cm90emRlbSBmb2N1cyB6dXJcdTAwRkNjayBhdWYgZGllIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IGJsdXJldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZSAgIC8vaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG5cbiAgICAgICAgLy90dXJuIHZvbHVtZSB1cCBeXlxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyBzcGF3bigncG93ZXJzaGVsbCcsIFsnU2V0LVZvbHVtZUxldmVsIC1MZXZlbCAxMDA7IFNldC1Wb2x1bWVNdXRlIC1NdXRlICRmYWxzZSddKTsgfVxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBleGVjKCdvc2FzY3JpcHQgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCB2b2x1bWUgMTAwXCIgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCBtdXRlZCBmYWxzZVwiJyk7IH0gIFxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgeyBcbiAgICAgICAgLy8gICAgIGV4ZWMoJ2FtaXhlciBzZXQgTWFzdGVyIDEwMCUgJyk7XG4gICAgICAgIC8vICAgICBleGVjKCdwYWN0bCBzZXQtc2luay1tdXRlIGBwYWN0bCBnZXQtZGVmYXVsdC1zaW5rYCAwJyk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgXG4gICAgICAgIC8vd2UgY291bGQgcGxheSBhIHNvdW5kIGZpbGUgaGVyZS4uIHRiZC4gIFxuICAgIH1cbiAgICAvL3NwZWNpYWwgYmx1ciBldmVudCBmb3IgdGVtcG9yYXJ5IGxvdyBzZWN1cml0eSBzY3JlZW5sb2NrXG4gICAgYmx1cmV2ZW50U2NyZWVubG9jayh3aW5oYW5kbGVyKSB7IFxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiBibHVyLXNjcmVlbmxvY2sgdHJpZ2dlcmVkXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL2Rvbid0IGN5Y2xlIHRocm91Z2ggYWxsIG9mIHRoZW0gLi4gaXQgd2lsbCBjcmVhdGUgYW4gaW5maW5pdGUgZm9jdXMgcmFjZVxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5zaG93KCk7ICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgXG4gICAgfVxuICAgIFxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiBcblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIG1vc3Qgb2YgdGhlIGtleWJvYXJkIHJlc3RyaWN0aW9ucyBjb3VsZCBiZSBoYW5kbGVkIGJ5IFwiaW9ob29rXCIgZm9yIGFsbCBwbGF0Zm9ybXNcbiAqIHVuZm9ydHVuYWxldHkgaXQncyBub3QgeWV0IHJlbGVhc2VkIGZvciBub2RlIHYxNi54IGFuZCBlbGVjdHJvbiB2MTYueCAgKGFsc28gaXQncyBcImJpZyBzdXJcIiBpbnRlbCBvbmx5IG9uIG1hY3MpXG4gKiBodHRwczovL3dpbGl4LXRlYW0uZ2l0aHViLmlvL2lvaG9vay9pbnN0YWxsYXRpb24uaHRtbFxuICogXG4gKiBcIm5vZGUtZ2xvYmFsLWtleS1saXN0ZW5lclwiIHdvdWxkIGJlIGFub3RoZXIgc29sdXRpb24gZm9yIHdpbmRvd3MgYW5kIG1hY29zIChhbHRob3VnaCBpdCByZXF1aXJlcyBcImFjY2Vzc2FiaWxpdHlcIiBwZXJtaXNzaW9ucyBvbiBtYWMpXG4gKiBidXQgZm9yIG5vdyBpdCBzZWVtcyB0aGUgbW9kdWxlIGNhbiBub3QgcnVuIGluIGEgZmluYWwgZWxlY3Ryb24gYnVpbGRcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9MYXVuY2hNZW51L25vZGUtZ2xvYmFsLWtleS1saXN0ZW5lci9pc3N1ZXMvMThcbiAqIFxuICogaGFyZGNvZGluZyB0aGUga2V5Ym9hcmRzaG9ydGN1dHMgd2Ugd2FudCB0byBjYXB0dXJlIGludG8gaW9ob29rKG9yIG4tZy1rLWwpIGFuZCBtYW51YWxseSBjb21waWxpbmcgaXQgZm9yIG1hYyBhbmQgd2luZG93cyBjb3VsZCBiZSBkb25lIC0gKGJ1dCBub3QgdW50aWwgaSBnZXQgcGFpZCBmb3IgdGhpcyBhbW91bnQgb2Ygd29yayA7LSkgXG4gKi9cblxuXG4vKipcbiAqIHRoZSBuZXh0IGJlc3Qgc29sdXRpb24gaSBjYW1lIHVwIHdpdGggaXMgdG8ga2lsbCBhbGwgb2YgdGhlIHNoZWxscyAtIHN0YXJ0aW5nIHdpdGggZXhwbG9yZXIuZXhlIGJlY2F1c2UgaXRzIGFic29sdXRlbHkgaW1wb3NzaWJsZSB0byBcbiAqIGRlYWN0aXZhdGUgdGhpcyBuYXN0eSBcIndpbmRvd3NcIiBidXR0b24gb3IgM0ZpbmdlclNsaWRlVXAgR2VzdHVyZSBpbiB3aW5kb3dzIDExIC0geW91IGNvdWxkIGVkaXQgdGhlIHJlZ2lzdHJ5IGFuZCByZWJvb3QgYnV0IHRoYXRzIG9idmlvdXNseSBub3Qgd2hhdCB3ZSB3YW50XG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnICAgLy9uZWVkZWQgdG8gcnVuIGJhc2ggY29tbWFuZHMgb24gbGludXggXG5pbXBvcnQgeyBhcHAsIFRvdWNoQmFyLCBjbGlwYm9hcmQsIGdsb2JhbFNob3J0Y3V0fSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vLyB1bmZvcnR1bmF0ZWx5IHRoZXJlIGlzIG5vIGNvbnZlbmllbnQgd2F5IGZvciBnbm9tZS1zaGVsbCB0byB1bi1zZXQgQUxMIHNob3J0Y3V0cyBhdCBvbmNlXG5jb25zdCBnbm9tZUtleWJpbmRpbmdzID0gWyAgXG4gICAgJ2FjdGl2YXRlLXdpbmRvdy1tZW51JywnbWF4aW1pemUtaG9yaXpvbnRhbGx5JywnbW92ZS10by1zaWRlLW4nLCdtb3ZlLXRvLXdvcmtzcGFjZS04Jywnc3dpdGNoLWFwcGxpY2F0aW9ucycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMycsJ3N3aXRjaC13aW5kb3dzLWJhY2t3YXJkJyxcbiAgICAnYWx3YXlzLW9uLXRvcCcsJ21heGltaXplLXZlcnRpY2FsbHknLCdtb3ZlLXRvLXNpZGUtcycsJ21vdmUtdG8td29ya3NwYWNlLTknLCdzd2l0Y2gtYXBwbGljYXRpb25zLWJhY2t3YXJkJywnICBzd2l0Y2gtdG8td29ya3NwYWNlLTQnLCd0b2dnbGUtYWJvdmUnLFxuICAgICdiZWdpbi1tb3ZlJywnbWluaW1pemUnLCdtb3ZlLXRvLXNpZGUtdycsJ21vdmUtdG8td29ya3NwYWNlLWRvd24nLCdzd2l0Y2gtZ3JvdXAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTUnLCd0b2dnbGUtZnVsbHNjcmVlbicsXG4gICAgJ2JlZ2luLXJlc2l6ZScsJ21vdmUtdG8tY2VudGVyJywnbW92ZS10by13b3Jrc3BhY2UtMScsJ21vdmUtdG8td29ya3NwYWNlLWxhc3QnLCdzd2l0Y2gtZ3JvdXAtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTYnLCd0b2dnbGUtbWF4aW1pemVkJyxcbiAgICAnY2xvc2UnLCdtb3ZlLXRvLWNvcm5lci1uZScsJ21vdmUtdG8td29ya3NwYWNlLTEwJywnbW92ZS10by13b3Jrc3BhY2UtbGVmdCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTcnLCd0b2dnbGUtb24tYWxsLXdvcmtzcGFjZXMnLFxuICAgICdjeWNsZS1ncm91cCcsJ21vdmUtdG8tY29ybmVyLW53JywnbW92ZS10by13b3Jrc3BhY2UtMTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1yaWdodCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UtYmFja3dhcmQgIHN3aXRjaC10by13b3Jrc3BhY2UtOCcsJ3RvZ2dsZS1zaGFkZWQnLFxuICAgICdjeWNsZS1ncm91cC1iYWNrd2FyZCcsJ21vdmUtdG8tY29ybmVyLXNlJywnbW92ZS10by13b3Jrc3BhY2UtMTInLCdtb3ZlLXRvLXdvcmtzcGFjZS11cCcsJ3N3aXRjaC1wYW5lbHMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTknLCd1bm1heGltaXplJyxcbiAgICAnY3ljbGUtcGFuZWxzJywnbW92ZS10by1jb3JuZXItc3cnLCdtb3ZlLXRvLXdvcmtzcGFjZS0yJywncGFuZWwtbWFpbi1tZW51Jywnc3dpdGNoLXBhbmVscy1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtZG93bicsICAgICAgXG4gICAgJ2N5Y2xlLXBhbmVscy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1kb3duJywnbW92ZS10by13b3Jrc3BhY2UtMycsJ3BhbmVsLXJ1bi1kaWFsb2cnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxhc3QnLCAgICAgICAgICAgICAgXG4gICAgJ2N5Y2xlLXdpbmRvd3MnLCdtb3ZlLXRvLW1vbml0b3ItbGVmdCcsJ21vdmUtdG8td29ya3NwYWNlLTQnLCdyYWlzZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxlZnQnLCAgICBcbiAgICAnY3ljbGUtd2luZG93cy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1yaWdodCcsJ21vdmUtdG8td29ya3NwYWNlLTUnLCdyYWlzZS1vci1sb3dlcicsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLXJpZ2h0JywgICBcbiAgICAnbG93ZXInLCdtb3ZlLXRvLW1vbml0b3ItdXAnLCdtb3ZlLXRvLXdvcmtzcGFjZS02Jywnc2V0LXNwZXctbWFyaycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTInLCdzd2l0Y2gtdG8td29ya3NwYWNlLXVwJywgICAgIFxuICAgICdtYXhpbWl6ZScsJ21vdmUtdG8tc2lkZS1lJywnbW92ZS10by13b3Jrc3BhY2UtNycsJ3Nob3ctZGVza3RvcCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtMicsJ3N3aXRjaC13aW5kb3dzJyAgXG5dXG5jb25zdCBnbm9tZVNoZWxsS2V5YmluZGluZ3MgPSBbJ2ZvY3VzLWFjdGl2ZS1ub3RpZmljYXRpb24nLCdvcGVuLWFwcGxpY2F0aW9uLW1lbnUnLCdzY3JlZW5zaG90Jywnc2NyZWVuc2hvdC13aW5kb3cnLCdzaGlmdC1vdmVydmlldy1kb3duJyxcbiAgICAnc2hpZnQtb3ZlcnZpZXctdXAnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMScsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0yJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTMnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi01JyxcbiAgICAnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTYnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi04Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTknLCdzaG93LXNjcmVlbnNob3QtdWknLCdzaG93LXNjcmVlbi1yZWNvcmRpbmctdWknLFxuICAgICd0b2dnbGUtYXBwbGljYXRpb24tdmlldycsJ3RvZ2dsZS1tZXNzYWdlLXRyYXknLCd0b2dnbGUtb3ZlcnZpZXcnICBdXG5cbmNvbnN0IGdub21lTXV0dGVyS2V5YmluZGluZ3MgPSBbJ3JvdGF0ZS1tb25pdG9yJywnc3dpdGNoLW1vbml0b3InLCd0YWItcG9wdXAtY2FuY2VsJywndGFiLXBvcHVwLXNlbGVjdCcsJ3RvZ2dsZS10aWxlZC1sZWZ0JywndG9nZ2xlLXRpbGVkLXJpZ2h0J11cblxuY29uc3QgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MgPSBbJ2FwcC1jdHJsLWhvdGtleS0xJywnYXBwLWN0cmwtaG90a2V5LTEwJywnYXBwLWN0cmwtaG90a2V5LTInLCdhcHAtY3RybC1ob3RrZXktMycsJ2FwcC1jdHJsLWhvdGtleS00JywnYXBwLWN0cmwtaG90a2V5LTUnLFxuICAgICdhcHAtY3RybC1ob3RrZXktNicsJ2FwcC1jdHJsLWhvdGtleS03JywnYXBwLWN0cmwtaG90a2V5LTgnLCdhcHAtY3RybC1ob3RrZXktOScsXG4gICAgJ2FwcC1ob3RrZXktMScsJ2FwcC1ob3RrZXktMTAnLCdhcHAtaG90a2V5LTInLCdhcHAtaG90a2V5LTMnLCdhcHAtaG90a2V5LTQnLCdhcHAtaG90a2V5LTUnLCdhcHAtaG90a2V5LTYnLCdhcHAtaG90a2V5LTcnLCdhcHAtaG90a2V5LTgnLCdhcHAtaG90a2V5LTknLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTEnLCdhcHAtc2hpZnQtaG90a2V5LTEwJywnYXBwLXNoaWZ0LWhvdGtleS0yJywnYXBwLXNoaWZ0LWhvdGtleS0zJywnYXBwLXNoaWZ0LWhvdGtleS00JywnYXBwLXNoaWZ0LWhvdGtleS01JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS02JywnYXBwLXNoaWZ0LWhvdGtleS03JywnYXBwLXNoaWZ0LWhvdGtleS04JywnYXBwLXNoaWZ0LWhvdGtleS05Jywnc2hvcnRjdXQnXVxuXG5jb25zdCBnbm9tZVdheWxhbmRLZXliaW5kaW5ncyA9IFsnc3dpdGNoLXRvLXNlc3Npb24tMScsJ3N3aXRjaC10by1zZXNzaW9uLTInLCdzd2l0Y2gtdG8tc2Vzc2lvbi0zJywnc3dpdGNoLXRvLXNlc3Npb24tNCcsJ3N3aXRjaC10by1zZXNzaW9uLTUnLCdzd2l0Y2gtdG8tc2Vzc2lvbi02Jywnc3dpdGNoLXRvLXNlc3Npb24tNycsJ3N3aXRjaC10by1zZXNzaW9uLTgnLCdzd2l0Y2gtdG8tc2Vzc2lvbi05Jywnc3dpdGNoLXRvLXNlc3Npb24tMTAnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMScsJ3N3aXRjaC10by1zZXNzaW9uLTEyJyBdXG5cbmxldCBjbGlwYm9hcmRJbnRlcnZhbFxubGV0IGNvbmZpZ1N0b3JlID0ge1xuICAgIGxpbnV4OiB7fSxcbiAgICB3aW5kb3dzOiB7fSxcbiAgICBtYWNvczoge31cbn1cblxuLy8gbGlzdCBvZiBhcHBzIHdlIGRvIG5vdCB3YW50IHRvIHJ1biBpbiBiYWNrZ3JvdW5kXG5jb25zdCBhcHBzVG9DbG9zZSA9IFsnY2hhdGdwdCcsJ0NoYXRHUFQnLCdOb3J0b25TZWN1cml0eScsJ05BVicsJ1RlYW1zJywnbXMtdGVhbXMnLCAnem9vbS51cycsICdHb29nbGUgQ2hyb21lJywgJ01pY3Jvc29mdCBFZGdlJywgJ01pY3Jvc29mdCBUZWFtcycsJ2ZpcmVmb3gnLCAnZGlzY29yZCcsICd6b29tJywgJ2Nocm9tZScsICdtc2VkZ2UnLCAndGVhbXMnLCAndGVhbXZpZXdlcicsICdnb29nbGUtY2hyb21lJywnc2t5cGVmb3JsaW51eCcsJ3NreXBlJywnYnJhdmUnLCdvcGVyYScsJ2FueWRlc2snLCdzYWZhcmknXTtcblxubGV0IGlzS0RFID0gZmFsc2VcbmxldCBpc0dOT01FID0gZmFsc2VcblxuY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBleGVjIGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH0gXG4gICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdLREUnKSB7IGlzS0RFID0gdHJ1ZSB9IFxuICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnR05PTUUnKSB7IGlzR05PTUUgPSB0cnVlIH1cbn0pO1xuXG5cblxuXG5mdW5jdGlvbiBlbmFibGVSZXN0cmljdGlvbnMod2luaGFuZGxlcil7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkge3JldHVybn1cbiAgICBcbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBwbGF0Zm9ybSByZXN0cmljdGlvbnNcIilcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7Y29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHtjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4ge2NvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7Y29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpfSk7XG4gICAgXG4gICAgY2xpcGJvYXJkLmNsZWFyKCkgIC8vdGhpcyBzaG91bGQgY2xlYW4gdGhlIGNsaXBib2FyZCBmb3IgdGhlIGVsZWN0cm9uIGFwcFxuICBcbiAgICBjbGlwYm9hcmRJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKCAoKT0+IHsgIGNsaXBib2FyZC5jbGVhcigpO30gICwgMTAwMClcbiAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdGFydCgpXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEwgSSBOIFUgWFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEZpcnN0IGNoZWNrIGlmIHByb2Nlc3MgZXhpc3RzLCB0aGVuIGtpbGwgaXRcbiAgICAgICAgICAgICAgICAvLyBVc2UgcGdyZXAgdG8gZmluZCBwcm9jZXNzZXMgYnkgbmFtZSAoY2FzZS1pbnNlbnNpdGl2ZSwgcHJvY2VzcyBuYW1lIG9ubHksIG5vdCBmdWxsIGNvbW1hbmQgbGluZSlcbiAgICAgICAgICAgICAgICAvLyBXaXRob3V0IC1mIGZsYWcsIHBncmVwIG9ubHkgc2VhcmNoZXMgcHJvY2VzcyBuYW1lcywgbm90IGNvbW1hbmQgbGluZXNcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGF2b2lkcyBraWxsaW5nIHByb2Nlc3NlcyB0aGF0IG9ubHkgY29udGFpbiB0aGUgYXBwIG5hbWUgaW4gdGhlaXIgY29tbWFuZCBsaW5lIChlLmcuIEN1cnNvciBjb250YWluaW5nIFwiY2hyb21lXCIpXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCJgLCAocGdyZXBFcnJvciwgc3Rkb3V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcGdyZXBFcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBmb3VuZCwgbm93IGtpbGwgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiIHwgeGFyZ3MgLXIga2lsbCAtOWAsIChraWxsRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtpbGxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBwZ3JlcCByZXR1cm5zIGVycm9yIG9yIG5vIG91dHB1dCwgcHJvY2VzcyBkb2Vzbid0IGV4aXN0IC0gbm8gbG9nZ2luZyBuZWVkZWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIFBMQVNNQVNIRUxMXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgaWYgKGlzS0RFKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBLREUgcmVzdHJpY3Rpb25zXCIpXG4gICAgICAgICAgICAvLyByZWFkIGFuZCBzYXZlIGN1cnJlbnQgY29uZmlnXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2tyZWFkY29uZmlnNScsIFsnLS1maWxlJywgJ2t3aW5yYycsICctLWdyb3VwJywgJ0Rlc2t0b3BzJywgJy0ta2V5JywgJ051bWJlciddLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGtyZWFkY29uZmlnKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gMVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSBzdGRvdXQudHJpbSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvL2Rpc2FibGUgTUVUQSBLZXkgZm9yIExhdW5jaGVybWVudSBcblxuICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiByZWNvbmZpZ3VyaW5nIGt3aW5gKTsgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgYCR7Y29uZmlnLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsICdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCdcIlwiJ10pICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJyxga3dpbnJjYCwnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCcxJ10pICAvL3JlbW92ZSB2aXJ0dWFsIGRlc2t0b3BzXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pICAgLy8gZGFzIHJlbG9hZGVkIGFsbGUgY29uZmlncyB1bmQgd1x1MDBGQ3JkZSBhdWNoIGFuZGVyZSBzZXR0aW5ncyBuZXUgbGFkZW4gc28gd2llIGtnbG9hbGFjY2VsIHVuZCBrbGlwZXJcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywnc2V0Q3VycmVudERlc2t0b3AnLCcxJ10pICAvLyBzZXR6dCBkaWUgYWt0dWVsbGUgZGVza3RvcCBhdWYgMVxuICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBlZmZlY3RzYCAgKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnZGVza3RvcGdyaWQnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdzY3JlZW5lZGdlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnb3ZlcnZpZXcnXSk7XG5cbiAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogYWRkaXRpb25hbCB0dHknc2AgIClcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJ3NydnJrZXlzOm5vbmUnXSlcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSlcblxuXG4gICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsZWFyaW5nIGNsaXBib2FyZCBoaXN0b3J5YCAgKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKSAvLyBDbGVhciBDbGlwYm9hcmQgaGlzdG9yeSBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2V0VGltZW91dCggKCkgPT4geyAgLy9uZWVkcyB0aW1lb3V0IG90aGVyd2lzZSBrd2luIC9yZWNvbmZpZ3VyZSB3aWxsIHJlc2V0IGl0XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzYCAgKVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnb3JnLmtkZS5LR2xvYmFsQWNjZWwuYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAndHJ1ZSddKSAvLyBUZW1wb3JhcmlseSBkZWFjdGl2YXRlIEFMTCBnbG9iYWwga2V5Ym9hcmRzaG9ydGN1dHMgXG4gICAgICAgICAgICB9LCAyMDAwKVxuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgXG4gICAgICAgIFxuXG4gICBcbiAgICAgICBcblxuXG4gICAgICAgIC8vLy8vLy8vLy9cbiAgICAgICAgLy8gR05PTUVcbiAgICAgICAgLy8vLy8vLy8vLy9cblxuICAgICAgICAvL3dlIHByb2JhYmx5IHNob3VsZCBkbyBpdCB0aGUgXCJ3aW5kb3dzIC0gd2F5XCIgYW5kIGp1c3Qga2lsbCBnbm9tZXNoZWxsIGZvciBhcyBsb25nIGFzIHRoZSBleGFtLW1vZGUgaXMgYWN0aXZlXG4gICAgICAgIC8vYnV0IGl0IHNlZW1zIHRoZXJlIGlzIG5vIGNvbnZlbmllbnQgd2F5IHRvIGtpbGwgZ25vbWUtc2hlbGwgd2l0aG91dCBhbGwgYXBwbGljYXRpb25zIHN0YXJ0ZWQgb24gdG9wIG9mIGl0IFxuICAgICAgICAgLy8gZm9yIGdub21lMyB3ZSBuZWVkIHRvIHNldCBldmVyeSBrZXkgaW5kaXZpZHVhbGx5ID0+IHJlc2V0IHdpbGwgb2J2aW91c2x5IHNldCBkZWZhdWx0cyAoc28gd2UgbWF5IG1lc3MgdXAgY3VzdG9taXplZCBzaG9ydGN1dHMgaGVyZSlcbiAgICAgICAgLy8gcG9zc2libGUgZml4OiBpbnN0ZWFkIG9mIHNldCA+IHJlc2V0IHdlIGNvdWxkIHVzZSBnZXQgLSBzZXQgLSBzZXQuLiBmaXJzdCBnZXQgdGhlIGN1cnJlbnQgYmluZGluZ3MgYW5kIHN0b3JlIHRoZW0gLSB0aGVuIHNldCB0byBub3RoaW5nIC0gdGhlbiBzZXQgdG8gcHJldmlvdXMgc2V0dGluZ1xuICAgICAgICAgICAgXG4gICAgICAgIGlmIChpc0dOT01FKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBHTk9NRSByZXN0cmljdGlvbnNcIilcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKXtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpeyAgLy8gd2UgY291bGQgdXNlIGdzZXR0aW5ncyByZXNldC1yZWN1cnNpdmVseSBvcmcuZ25vbWUuc2hlbGwgdG8gcmVzZXQgZXZlcnl0aGluZ1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgYG92ZXJsYXkta2V5YCwgYCcnYF0pICAvLyBraW5kIG9mIHRoZSBtZW51IGtleVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5tdXR0ZXIgZHluYW1pYy13b3Jrc3BhY2VzIGZhbHNlJykgIC8vIGRlYWN0aXZhdGUgbXVsdGlwbGUgZGVza3RvcHNcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUuZGVza3RvcC53bS5wcmVmZXJlbmNlcyBudW0td29ya3NwYWNlcyAxJykgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7IC8vIGNsZWFyIGNsaXBib2FyZCAgKHRoaXMgd2lsbCBmYWlsIHVubGVzcyB4Y2xpcCBvciB4c2VsbCBhcmUgaW5zdGFsbGVkKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKSAgIC8vIHdheWxhbmRcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJylcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCkgfVxuICAgICAgICBcbiAgICAgICAgXG4gICAgfVxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiAgVyBJIE4gRCBPIFcgU1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgLy9ibG9jayBpbXBvcnRhbnQga2V5Ym9hcmQgc2hvcnRjdXRzIChkaXNhYmxlLXNob3J0Y3V0cy5leGUgaXMgYSBzZWxmbWFkZSBDIGFwcGxpY2F0aW9uIC0gc2hvcnRjdXRzIGFyZSBoYXJkY29kZWQgdGhlcmUgLSBuZWVkIHRvIHJlYnVpbGQgaWYgYWRkaW5nIHNob3J0Y3V0cylcbiAgICAgICAgdHJ5IHsgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0YWJsZTEgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9kaXNhYmxlLXNob3J0Y3V0cy5leGUnKVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKGV4ZWN1dGFibGUxLCBbXSwgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnLCBzaGVsbDogZmFsc2UsIHdpbmRvd3NIaWRlOiB0cnVlfSlcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmRvd3Mgc2hvcnRjdXRzIGRpc2FibGVkXCIpXG4gICAgICAgICAgICAvL3N1YnByb2Nlc3MudW5yZWYoKTsgIC8vY29tcGxldGVseSBkZXRhY2hcbiAgICAgICAgfSBjYXRjaCAoZXJyKXtsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gc2hvcnRjdXRzKTogJHtlcnJ9YCk7fVxuICAgICAgICBcblxuICAgICAgICAvL2NsZWFyIGNsaXBib2FyZCAtIHN0b3AgY29weSBiZWZvcmUgYW5kIHBhc3RlIGFmdGVyIGV4YW1zdGFydFxuICAgICAgICAvLyB0cnkge1xuICAgICAgICAvLyAgICAgbGV0IGV4ZWN1dGFibGUwID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvY2xlYXItY2xpcGJvYXJkLmJhdCcpXG4gICAgICAgIC8vICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTAsIFtdLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIC8vICAgICAgICAgaWYgKGVycm9yKSAgeyAgXG4gICAgICAgIC8vICAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBjbGlwYm9hcmQpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIC8vICAgICAgICAgfVxuICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgLy8gfSBjYXRjaCAoZXJyKXtsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gY2xpcGJvYXJkKTogJHtlcnJ9YCk7fVxuICAgICAgIFxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRXNjYXBlIGFwcCBuYW1lIGZvciBQb3dlclNoZWxsIC0gcmVwbGFjZSBzaW5nbGUgcXVvdGVzIHdpdGggZG91YmxlIHNpbmdsZSBxdW90ZXNcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkQXBwID0gYXBwLnJlcGxhY2UoLycvZywgXCInJ1wiKTtcbiAgICAgICAgICAgICAgICAvLyBQb3dlclNoZWxsIGNvbW1hbmQ6IHNldCBhcHAgbmFtZSBhcyB2YXJpYWJsZSBmaXJzdCB0byBhdm9pZCBzdHJpbmcgaW50ZXJwb2xhdGlvbiBpc3N1ZXNcbiAgICAgICAgICAgICAgICAvLyBVc2VzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHRvIGhhbmRsZSBhY2Nlc3MgZGVuaWVkIGFuZCBvdGhlciBlcnJvcnMgZ3JhY2VmdWxseVxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJGFwcE5hbWUgPSAnJHtlc2NhcGVkQXBwfSc7IHRyeSB7ICRwcm9jcyA9IEdldC1Qcm9jZXNzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHsgJF8uUHJvY2Vzc05hbWUgLWlsaWtlICgnKicgKyAkYXBwTmFtZSArICcqJykgfTsgaWYgKCRwcm9jcyAtYW5kICRwcm9jcy5Db3VudCAtZ3QgMCkgeyAkcHJvY3MgfCBTdG9wLVByb2Nlc3MgLUZvcmNlIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlOyBXcml0ZS1PdXRwdXQgJ2tpbGxlZCcgfSB9IGNhdGNoIHsgfVwiYDtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkuaW5jbHVkZXMoJ2tpbGxlZCcpKSB7IC8vIHN1Y2Nlc3MgLSBwcm9jZXNzIHdhcyBmb3VuZCBhbmQga2lsbGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBubyBwcm9jZXNzIGZvdW5kIG9yIG90aGVyIGVycm9ycyBhcmUgc2lsZW50bHkgaWdub3JlZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICB9XG4gICAgICAgICAgXG5cblxuICAgICAgICAvL211c3QgYmUgdGVzdGVkIGJlY2F1c2UgaXRzIGRhbmdlcm91cyAtIGkgcG90ZW50aWFsbHkga2lsbHMgdW53YW50ZWQgcHJvY2Vzc2VzIGJlY2F1c2UgaXQgc2VhcmNoZXMgZm9yIHN1YnN0cmluZ3MgaW4gcHJvY2VzcyBuYW1lc1xuICAgICAgICAvLyB0cnkge1xuICAgICAgICAvLyAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAvLyAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtQ29tbWFuZCBcIkdldC1Qcm9jZXNzIHwgV2hlcmUtT2JqZWN0IHsgJF8uTmFtZSAtbGlrZSAnKiR7YXBwfSonIH0gfCBGb3JFYWNoLU9iamVjdCB7ICRfLktpbGwoKSB9XCJgO1xuICAgICAgICAvLyAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgLy8gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYEVycm9yIGNsb3NpbmcgYXBwOiAke2FwcH1gLCBlcnJvcik7XG4gICAgICAgIC8vICAgICAgICAgICAgIH1cbiAgICAgICAgLy8gICAgICAgICAgICAgaWYgKHN0ZGVycikge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBzdGRlcnI6ICR7c3RkZXJyfWApO1xuICAgICAgICAvLyAgICAgICAgICAgICB9XG4gICAgICAgIC8vICAgICAgICAgICAgIGlmIChzdGRvdXQpIHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBzdGRvdXQ6ICR7c3Rkb3V0fWApO1xuICAgICAgICAvLyAgICAgICAgICAgICB9XG4gICAgICAgIC8vICAgICAgICAgfSk7XG4gICAgICAgIC8vICAgICB9KTtcbiAgICAgICAgLy8gfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChQb3dlclNoZWxsKTogJHtlcnJ9YCk7XG4gICAgICAgIC8vIH1cblxuXG5cblxuICAgICAgICAvLyBraWxsIEVYUExPUkVSIHdpbmRvd3NidXR0b24gYW5kIHN3aXBlIGdlc3R1cmVzIC0ga2lsbCBldmVyeXRoaW5nIGVsc2VcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNra2lsbCAvZiAvaW0gZXhwbG9yZXIuZXhlJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIHRhc2traWxsIHdhcyBzdWNjZXNzZnVsIChwcm9jZXNzIGZvdW5kIGFuZCBraWxsZWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGV4cGxvcmVyLmV4ZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBJZiBlcnJvciAoZS5nLiBwcm9jZXNzIG5vdCBmb3VuZCksIHNpbGVudGx5IGlnbm9yZSAtIG5vIGxvZ2dpbmcgbmVlZGVkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKXtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuICAgIC8qKlxuICAgICAqIE0gQSBDIE8gUyAgXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGNvbnN0IHsgVG91Y2hCYXJMYWJlbCwgVG91Y2hCYXJCdXR0b24sIFRvdWNoQmFyU3BhY2VyIH0gPSBUb3VjaEJhclxuICAgICAgICBjb25zdCB0ZXh0bGFiZWwgPSBuZXcgVG91Y2hCYXJMYWJlbCh7bGFiZWw6IFwiTmV4dC1FeGFtXCJ9KVxuICAgICAgICBjb25zdCB0b3VjaEJhciA9IG5ldyBUb3VjaEJhcih7XG4gICAgICAgICAgICBpdGVtczogW1xuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgICAgIHRleHRsYWJlbCxcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdz8uc2V0VG91Y2hCYXIodG91Y2hCYXIpXG5cbiAgICAgICAgLy8gY2xlYXIgY2xpcGJvYXJkXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdwYmNvcHkgPCAvZGV2L251bGwnKVxuXG4gICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgIC8vIHBraWxsLUJlZmVobCBmXHUwMEZDciBtYWNPU1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBraWxsIC05IC1mIFwiJHthcHB9XCJgLCAoZXJyb3IsIHN0ZGVyciwgc3Rkb3V0KSA9PiB7XG4gICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvL21pc3Npb24gY29udHJvbFxuICAgICAgICAvL2xldCBzY3JpcHRmaWxlID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvbWMuYXBwZWxzY3JpcHQnKSAgIC8vc3BhY2VzLCBzaG9ydGN1dHNcbiAgICAgICAgbGV0IG1jc2NyaXB0ZmlsZSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL3NwYWNlcy5hcHBsZXNjcmlwdCcpXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkgeyBtY3NjcmlwdGZpbGUgPSBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYy9zcGFjZXMuYXBwbGVzY3JpcHQnKSB9XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnb3Nhc2NyaXB0JywgW21jc2NyaXB0ZmlsZV0sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtpZiAoc3RkZXJyKSB7IGxvZy5pbmZvKHN0ZGVycikgIH0gfSlcbiAgICB9XG59XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5mdW5jdGlvbiBkaXNhYmxlUmVzdHJpY3Rpb25zKCl7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkge3JldHVybn1cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogcmVtb3ZpbmcgcmVzdHJpY3Rpb25zLi4uXCIpXG5cbiAgICBpZiAoY2xpcGJvYXJkSW50ZXJ2YWwpIHsgICAgXG4gICAgICAgIGNsaXBib2FyZEludGVydmFsLnN0b3AoKVxuICAgIH1cblxuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHtjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyl9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7Y29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4ge2NvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKX0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHtjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyl9KTtcblxuXG5cbiAgICAvKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBMIEkgTiBVIFhcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAvLyBvbiB3YXlsYW5kXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSlcbiAgICAgICAgLy8gY2xlYXIgY2xpcGJvYXJkIGdub21lIGFuZCB4MTEgICh0aGlzIHdpbGwgZmFpbCB1bmxlc3MgeGNsaXAgb3IgeHNlbGwgYXJlIGluc3RhbGxlZClcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpXG5cbiAgICAgICAgLy9lbmFibGUgTUVUQSBLZXkgZm9yIExhdW5jaGVybWVudVxuICAgICAgICAvL2NoaWxkUHJvY2Vzcy5leGVjRmlsZSgnc2VkJywgWyctaScsICctZScsICdzL2dsb2JhbD0uKi9nbG9iYWw9QWx0K0YxL2cnLCBgJHtjb25maWcuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9wbGFzbWEtb3JnLmtkZS5wbGFzbWEuZGVza3RvcC1hcHBsZXRzcmNgIF0pXG4gICAgICAgIC8vY2hpbGRQcm9jZXNzLmV4ZWMoJ2t3aW4gLS1yZXBsYWNlICYnKVxuXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IGV4ZWMgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnS0RFJykge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IEtERSBkZXRlY3RlZFwiKVxuICAgICAgICAgICAgICAgIC8vIENsZWFyIENsaXBib2FyZCBoaXN0b3J5IFxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSlcbiAgICAgICAgICAgICAgICAvLyByZXNldCBhbGwgc2hvcnRjdXRzIEtERVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAnZmFsc2UnXSlcbiAgICAgICAgICAgICAgICAvLyBhY3RpdmF0ZSBBTEwgM2QgRWZmZWN0cyAocHJlc2VudCB3aW5kb3csIGNoYW5nZSBkZXNrdG9wLCBldGMuKSBcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nICwnL0NvbXBvc2l0b3InLCAnb3JnLmtkZS5rd2luLkNvbXBvc2l0aW5nLnJlc3VtZSddKVxuICAgICAgICAgICAgICAgIC8vIHJlYWN0aXZhdGUgc2hvcnRjdXRzc3lzdGVtXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUga2dsb2JhbGFjY2VsNSYnKVxuICAgICAgICAgICAgICAgIC8vIGVuYWJsZSBtZXRhIGtleSwga3dpbiBhbmQgcmVzdGFydCBwbGFzbWFzaGVsbFxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJyxgJHtjb25maWcuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnLS1kZWxldGUnXSkgXG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGBrd2lucmNgLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wc10pICAvL2FkZCBwcmV2aW91cyB2aXJ0dWFsIGRlc2t0b3BzXG5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJyddKVxuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSlcbiAgICBcblxuXG5cbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pXG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBwbGFzbWFzaGVsbCAmJywge1xuICAgICAgICAgICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZSwgICAgICAgICAgICAgICAvLyBydW4gaW5kZXBlbmRlbnRseVxuICAgICAgICAgICAgICAgICAgICBzdGRpbzogJ2lnbm9yZScgICAgICAgICAgICAgICAvLyBkaXNjb25uZWN0IHN0ZGlvXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTsgICAgICAgICAgICAgICAgICAvLyBmdWxseSBkZXRhY2ggcHJvY2Vzc1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyByZXNldCBzcGVjaWZpYyBzaG9ydGN1dHMgR05PTUVcbiAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKXtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pXG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3Mpe1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pXG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKXtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSlcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKXtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWBdKVxuICAgICAgICB9XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgYG92ZXJsYXkta2V5YF0pXG5cbiAgICB9XG5cblxuICAgIC8qKioqKioqKioqKioqKioqXG4gICAgICogIFcgSSBOIEQgTyBXIFNcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIC8vIHVuYmxvY2sgaW1wb3J0YW50IGtleWJvYXJkIHNob3J0Y3V0cyAoZGlzYWJsZS1zaG9ydGN1dHMuZXhlKVxuICAgICAgICAvLyBoaWVyIGdpYnQgZXMgaXJnZW5kZWluZSByYWNlIGNvbmRpdGlvbiBvZGVyIGFiaFx1MDBFNG5naWdrZWl0IHZvbiBleHBsb3Jlci5leGUuICBlaW5mYWNoIHJlaWhlbmZvbGdlIHVta2VocmVuIHVuZCBlaW4gdGltZW91dCBzZXR6ZW5cblxuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogdW5ibG9ja2luZyBzaG9ydGN1dHMuLi5cIilcbiAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgdGFza2tpbGwgIC9JTSBcImRpc2FibGUtc2hvcnRjdXRzLmV4ZVwiIC9UIC9GYCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4geyBcbiAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiB0YXNra2lsbCB3YXMgc3VjY2Vzc2Z1bCAocHJvY2VzcyBmb3VuZCBhbmQga2lsbGVkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZGlzYWJsZS1zaG9ydGN1dHMuZXhlYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIElmIGVycm9yIChlLmcuIHByb2Nlc3Mgbm90IGZvdW5kKSwgc2lsZW50bHkgaWdub3JlIC0gbm8gbG9nZ2luZyBuZWVkZWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9Y2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdGFydCBleHBsb3Jlci5leGUgd2luZG93c3NoZWxsIGFnYWluXG4gICAgICAgIC8vIFx1MDBEQ2JlcnByXHUwMEZDZmUsIG9iIGV4cGxvcmVyLmV4ZSBsXHUwMEU0dWZ0XG4gICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBleHBsb3Jlci5leGVcIicsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB0YXNrbGlzdCBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFByXHUwMEZDZmUsIG9iIFwiZXhwbG9yZXIuZXhlXCIgaW4gZGVyIEF1c2dhYmUgdm9yaGFuZGVuIGlzdFxuICAgICAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKCdleHBsb3Jlci5leGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTdGFydGUgZXhwbG9yZXIuZXhlLCB3ZW5uIGVzIG5pY2h0IGxcdTAwRTR1ZnRcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHJlc3RhcnRpbmcgZXhwbG9yZXIuLi5cIilcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygnc3RhcnQgZXhwbG9yZXIuZXhlJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWNoZWQ6IHRydWUsICAgICAgICAgICAgICAgLy8gcnVuIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZGlvOiAnaWdub3JlJyAgICAgICAgICAgICAgIC8vIGRpc2Nvbm5lY3Qgc3RkaW9cbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTsgICAgICAgICAgICAgICAgICAvLyBmdWxseSBkZXRhY2ggcHJvY2Vzc1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1jYXRjaChlKXtsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZXJlc3RyaWN0aW9ucyAod2luIGV4cGxvcmVyKTogJHtlLm1lc3NhZ2V9YCl9XG5cblxuICAgICAgICAvLyB0cnl7XG4gICAgICAgIC8vICAgICAvL2NsZWFyIGNsaXBib2FyZCAtIHN0b3Aga2VlcGluZyBzY3JlZW5zaG90cyBvZiBleGFtIGluIGNsaXBib2FyZFxuICAgICAgICAvLyAgICAgbGV0IGV4ZWN1dGFibGUwID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvY2xlYXItY2xpcGJvYXJkLmJhdCcpXG4gICAgICAgIC8vICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTAsIFtdLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIC8vICAgICAgICAgaWYgKHN0ZGVycikgeyBsb2cuaW5mbyhzdGRlcnIpIH1cbiAgICAgICAgLy8gICAgICAgICBpZiAoZXJyb3IpIHsgbG9nLmluZm8oZXJyb3IpIH1cbiAgICAgICAgLy8gICAgIH0pXG4gICAgICAgIC8vIH1jYXRjaChlKXtsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZXJlc3RyaWN0aW9ucyAod2luIGNsaXBib2FyZCk6ICR7ZS5tZXNzYWdlfWApfVxuXG4gICAgfVxuXG4gICAgLy8gVE9ETzogdW5kbyByZXN0cmljdGlvbnMgbWFjIChjdXJyZW50bHkgb25seSB0b3VjaGJhciB3aGljaCBzaG91bGQgYmUgcmVzZXQgb25jZSB3ZSBjbG9zZSBuZXh0LWV4YW0pXG59XG5cbmV4cG9ydCB7ZW5hYmxlUmVzdHJpY3Rpb25zLCBkaXNhYmxlUmVzdHJpY3Rpb25zfVxuIiwgImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cbmxldCBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9MYW5ndWFnZVRvb2wvbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInKVxuaWYgKGFwcC5pc1BhY2thZ2VkKSB7IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljL0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpIH1cblxubGV0IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL0xhbmd1YWdlVG9vbC9zZXJ2ZXIucHJvcGVydGllcycpXG5pZiAoYXBwLmlzUGFja2FnZWQpIHsgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMvTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJykgfVxuXG5cblxuXG5cbmNsYXNzIExhbmd1YWdlVG9vbFNlcnZlciB7XG4gICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDsgLy8gSW5pdGlhbGlzaWVydCBkaWUgUHJvemVzc3ZhcmlhYmxlXG4gICAgICAgICB0aGlzLnBvcnQgPSA4MDg4XG4gICAgIH1cbiBcbiAgICAgc3RhcnRTZXJ2ZXIoKSB7XG4gICAgICAgICBpZiAodGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzICYmICF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGlzIGFscmVhZHkgcnVubmluZy4nKTtcbiAgICAgICAgICAgICByZXR1cm47IC8vIFZlcmhpbmRlcnQgZGFzIGVybmV1dGUgU3RhcnRlbiwgd2VubiBkZXIgU2VydmVyIGJlcmVpdHMgbFx1MDBFNHVmdFxuICAgICAgICAgfVxuICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IEpyZUhhbmRsZXIualNwYXduKFxuICAgICAgICAgICAgICAgIFtsYW5ndWFnZVRvb2xKYXJQYXRoXSwgLy8gS2xhc3NlbnBmYWRcbiAgICAgICAgICAgICAgICAnb3JnLmxhbmd1YWdldG9vbC5zZXJ2ZXIuSFRUUFNlcnZlcicsIC8vIEhhdXB0a2xhc3NlIGRlciBMYW5ndWFnZVRvb2wgQVBJXG4gICAgICAgICAgICAgICAgWyctLXBvcnQnLCB0aGlzLnBvcnQsJy0tY29uZmlnJyxsYW5ndWFnZVRvb2xDb25maWdQYXRoLCAnLS1hbGxvdy1vcmlnaW4nLCBcIicqJ1wiIF0gLy8gWnVzXHUwMEU0dHpsaWNoZSBBcmd1bWVudGUsIHouQi4gUG9ydCB1bmQgQ09SUy1FcmxhdWJuaXNcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MpXG4gICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBBUEkgcnVubmluZyBhdCBsb2NhbGhvc3Q6ODA4OCcpO1xuXG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZGF0YTogUmVjZWl2ZWQgZGF0YSBmcm9tIExhbmd1YWdlVG9vbCBBUEknLCBkYXRhLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2Vycm9yJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWVycm9yOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc3RhcnRpbmcnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NoZWNrIGRvbmUnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2hhbmRsZWQgcmVxdWVzdCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICAvLyBBY2N1bXVsYXRlIHN0ZGVyciBkYXRhIHRvIGhhbmRsZSBjaHVua2VkIG91dHB1dFxuICAgICAgICAgICAgbGV0IHN0ZGVyckJ1ZmZlciA9ICcnO1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZGVyci5vbignZGF0YScsIGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciArPSBjaHVuaztcbiAgICAgICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKHRoaXMucG9ydCk7XG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgYm90aCBjdXJyZW50IGNodW5rIGFuZCBhY2N1bXVsYXRlZCBidWZmZXIgZm9yIHBvcnQtcmVsYXRlZCBlcnJvcnNcbiAgICAgICAgICAgICAgICBjb25zdCBmdWxsUmVzcG9uc2UgPSBzdGRlcnJCdWZmZXI7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNQb3J0RXJyb3IgPSBmdWxsUmVzcG9uc2UuaW5jbHVkZXMocG9ydFN0cikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIkFkcmVzc2Ugd2lyZCBiZXJlaXRzIHZlcndlbmRldFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiTWF5YmUgc29tZXRoaW5nIGVsc2UgaXMgcnVubmluZyBvbiB0aGF0IHBvcnRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIkFkZHJlc3MgYWxyZWFkeSBpbiB1c2VcIik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGlzUG9ydEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogYW5vdGhlciBMYW5ndWFnZVRvb2wgc2VydmVyIGlzIHByb2JhYmx5IGFscmVhZHkgcnVubmluZyBvbiBwb3J0OicsIHRoaXMucG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNodW5rLmluY2x1ZGVzKCdcXG4nKSB8fCBmdWxsUmVzcG9uc2UubGVuZ3RoID4gMjAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiB3ZSBoYXZlIGEgbmV3bGluZSAobGlrZWx5IGNvbXBsZXRlIG1lc3NhZ2UpIG9yIGJ1ZmZlciBpcyBnZXR0aW5nIGxhcmdlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZGF0YS1lcnJvcjonLCBmdWxsUmVzcG9uc2UudHJpbSgpKTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBsb2dnaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mub24oJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDsgLy8gU2V0enQgZGVuIFByb3plc3MgenVyXHUwMEZDY2ssIHdlbm4gZXIgYmVlbmRldCB3aXJkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBnZW5lcmFsLWVycm9yOicsIGVycik7XG4gICAgICAgIH1cblxuXG4gICAgIH1cblxuICAgICBzdG9wU2VydmVyKCkge1xuICAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHNlcnZlciB3YXMgbmV2ZXIgc3RhcnRlZFxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MpIHtcbiAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciB3YXMgbmV2ZXIgc3RhcnRlZCwgbm90aGluZyB0byBzdG9wJyk7XG4gICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgfVxuXG4gICAgICAgICAvLyBGaXJzdCB0cnkgdG8ga2lsbCB0aGUgcHJvY2VzcyBkaXJlY3RseSBpZiB3ZSBoYXZlIGEgcmVmZXJlbmNlXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbCgpO1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBwcm9jZXNzIGtpbGxlZCcpO1xuICAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBmYWlsZWQgdG8ga2lsbCBwcm9jZXNzIGRpcmVjdGx5LCB0cnlpbmcgcGxhdGZvcm0tc3BlY2lmaWMgbWV0aG9kOicsIGVycik7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICAvLyBGYWxsYmFjazogdXNlIHBsYXRmb3JtLXNwZWNpZmljIGNvbW1hbmRzIHRvIGtpbGwgdGhlIHByb2Nlc3MgKG9ubHkgaWYgd2UgaGFkIGEgcHJvY2VzcyByZWZlcmVuY2UpXG4gICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgICBsZXQgY29tbWFuZDtcblxuICAgICAgICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICAgLy8gV2luZG93czogZmluZCBhbmQga2lsbCBqYXZhIHByb2Nlc3NlcyBydW5uaW5nIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyXG4gICAgICAgICAgICAgLy8gRmlyc3QgdHJ5IHdtaWMgKHdvcmtzIG9uIG9sZGVyIFdpbmRvd3MpLCB0aGVuIHRyeSBQb3dlclNoZWxsLCB0aGVuIGZhbGxiYWNrIHRvIHBvcnQtYmFzZWQga2lsbFxuICAgICAgICAgICAgIGNvbW1hbmQgPSBgd21pYyBwcm9jZXNzIHdoZXJlIFwiY29tbWFuZGxpbmUgbGlrZSAnJWxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJSdcIiBkZWxldGUgMj5udWwgfHwgcG93ZXJzaGVsbCAtQ29tbWFuZCBcIkdldC1Qcm9jZXNzIGphdmEgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyRfLkNvbW1hbmRMaW5lIC1saWtlICcqbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIqJ30gfCBTdG9wLVByb2Nlc3MgLUZvcmNlXCIgMj5udWwgfHwgZm9yIC9mIFwidG9rZW5zPTVcIiAlYSBpbiAoJ25ldHN0YXQgLWFubyBefCBmaW5kc3RyIDo4MDg4JykgZG8gdGFza2tpbGwgL0YgL1BJRCAlYSAyPm51bGA7XG4gICAgICAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJyB8fCBwbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgICAgIC8vIG1hY09TIGFuZCBMaW51eDogdXNlIHBraWxsIHRvIGtpbGwgcHJvY2Vzc2VzIG1hdGNoaW5nIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyXG4gICAgICAgICAgICAgY29tbWFuZCA9ICdwa2lsbCAtZiBsYW5ndWFnZXRvb2wtc2VydmVyLmphcic7XG4gICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiB1bnN1cHBvcnRlZCBwbGF0Zm9ybTonLCBwbGF0Zm9ybSk7XG4gICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgfVxuXG4gICAgICAgICBleGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgLy8gSXQncyBva2F5IGlmIHRoZSBwcm9jZXNzIGlzIG5vdCBmb3VuZCAoYWxyZWFkeSBraWxsZWQpXG4gICAgICAgICAgICAgICAgIC8vIHBraWxsIHJldHVybnMgY29kZSAxIHdoZW4gbm8gcHJvY2VzcyBpcyBmb3VuZCwgd2hpY2ggaXMgZXhwZWN0ZWRcbiAgICAgICAgICAgICAgICAgaWYgKGVycm9yLmNvZGUgIT09IDEgJiYgIWVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ25vdCBmb3VuZCcpICYmICFzdGRlcnIudG9TdHJpbmcoKS5pbmNsdWRlcygnTm8gc3VjaCBwcm9jZXNzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBlcnJvciBraWxsaW5nIExhbmd1YWdlVG9vbCBzZXJ2ZXI6JywgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBwcm9jZXNzIG5vdCBmb3VuZCAobWF5IGFscmVhZHkgYmUgc3RvcHBlZCknKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHN0b3BwZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICB9KTtcbiAgICAgfVxuIH1cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IExhbmd1YWdlVG9vbFNlcnZlcigpXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgcHJvY2VzcyBmcm9tICdwcm9jZXNzJztcbmltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuIC8vIGV2ZXJ5IHBsYXRmb3JtIG5lZWRzIGl0J3Mgb3duIGpyZSAobGludXgsIHdpbjMyLCBkYXJ3aW4pIC8vZml4bWU6IHVzZSBHcmFhbFZNIHRvIHByZWNvbXBpbGUgbGFuZ3VhZ2V0b29sIGluIG9yZGVyIHRvIHNhdmUgc3BhY2UgYW5kIGdldCByaWQgb2YganJlP1xuY2xhc3MgSnJlSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkgeyB9XG5cbiAgICBpbml0KCl7IFxuICAgICAgICB0aGlzLmpUZXN0KClcbiAgICB9XG5cbiAgICBmYWlsKHJlYXNvbikge1xuICAgICAgICBsb2cuZXJyb3IocmVhc29uKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cblxuICAgIGdldERpcmVjdG9yaWVzKGRpclBhdGgpIHtcbiAgICAgICAgbGV0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKS5maWx0ZXIoXG4gICAgICAgICAgICBmaWxlID0+IGZzLnN0YXRTeW5jKHBhdGguam9pbihkaXJQYXRoLCBmaWxlKSkuaXNEaXJlY3RvcnkoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZGlyc1xuICAgIH0gXG5cbiAgICBkcml2ZXIoKXtcbiAgICAgICAgdmFyIGQgPSBwbGF0Zm9ybURpc3BhdGNoZXIuamF2YUJpbi5zbGljZSgpO1xuICAgICAgICBkLnVuc2hpZnQocGxhdGZvcm1EaXNwYXRjaGVyLmpyZURpcik7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4uYXBwbHkocGF0aCwgZCk7XG4gICAgfVxuXG4gICAgZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBhcmdzID0gKGFyZ3MgfHwgW10pLnNsaWNlKCk7XG4gICAgICAgIGNsYXNzcGF0aCA9IGNsYXNzcGF0aCB8fCBbXTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzbmFtZSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc3BhdGguam9pbih0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JykpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoJy1jcCcpO1xuICAgICAgICByZXR1cm4gYXJncztcbiAgICB9XG5cbiAgICBqU3Bhd24oY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgXG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKClcbiAgICAgICAgbGV0IGphdmFhcmdzID0gdGhpcy5nZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKVxuICAgICAgICBsZXQgamF2YWNtZGxpbmUgPSAgYCR7amF2YXBhdGh9ICR7amF2YWFyZ3Muam9pbignICcpfSBgXG5cbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiAnJHtwbGF0Zm9ybURpc3BhdGNoZXIuanJlfScgc2VsZWN0ZWRgKVxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246IHNwYXduaW5nIGphdmEgcHJvY2VzczogJHtqYXZhY21kbGluZX1gKVxuICAgICAgICByZXR1cm4gc3Bhd24oamF2YXBhdGgsIGphdmFhcmdzLCB7c2hlbGw6ZmFsc2V9KTtcbiAgICAgICAvLyByZXR1cm4gc3Bhd24oamF2YWNtZGxpbmUpO1xuICAgIH1cbiAgICBqVGVzdCgpe1xuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpOyAvLyAnL3BmYWQvenVyL2phdmEnXG4gICAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihqYXZhcGF0aCwgWyctdmVyc2lvbiddKTtcbiAgICBcbiAgICAgICAgcHJvYy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTsgLy8gaW4gWmVpbGVuIHNwbGl0dGVuXG4gICAgICAgICAgICBsb2cuZGVidWcoYGpyZS1oYW5kbGVyIEAgalRlc3Q6ICR7bGluZXNbMF19YCk7IC8vIG51ciBkaWUgZXJzdGUgWmVpbGUgbG9nZ2VuXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSnJlSGFuZGxlcigpXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuJ3VzZSBzdHJpY3QnXG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnMsIGVuYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnIFxuaW1wb3J0IGFyY2hpdmVyIGZyb20gJ2FyY2hpdmVyJyAgIC8vIGRhcyBtYWNodCBrcmFzc2VzdGUgcmFjZWNvZGl0aW9ucyBtaXQgZWxlY3Ryb24gZWlnZW5lbiB2ZXJzaW9uZW4gLSB1bmJlZGluZ3QgZGllIHNlbGJlIHZlcnNpb24gYmVoYWx0ZW4gd2llIGVsZWN0cm9uXG5pbXBvcnQgZXh0cmFjdCBmcm9tICdleHRyYWN0LXppcCdcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgc2NyZWVuLCBpcGNNYWluLCBhcHAsIEJyb3dzZXJXaW5kb3csIHdlYkNvbnRlbnRzIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL2lwY2hhbmRsZXIuanMnXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgVGVzc2VyYWN0IGZyb20gJ3Rlc3NlcmFjdC5qcyc7XG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgc2NyZWVuc2hvdCBmcm9tICdzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCc7XG5pbXBvcnQgeyBXb3JrZXIgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IHJ1blJlbW90ZUNoZWNrIH0gZnJvbSAnLi9yZW1vdGVDaGVjay5qcydcbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXIuanMnO1xuXG5jb25zdCBzaGVsbCA9IChjbWQpID0+IHsgICByZXR1cm4gZXhlY1N5bmMoY21kLCB7IGVuY29kaW5nOiAndXRmOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KTsgfTsgIC8vIHN0ZGVyciB1bnRlcmRyXHUwMEZDY2t0IFxuY29uc3QgYWdlbnQgPSBuZXcgaHR0cHMuQWdlbnQoeyByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlIH0pO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgXG5cbiAvKipcbiAgKiBIYW5kbGVzIGluZm9ybWF0aW9uIGZldGNoaW5nIGZyb20gdGhlIHNlcnZlciBhbmQgYWN0cyBvbiBzdGF0dXMgdXBkYXRlc1xuICAqL1xuIFxuIGNsYXNzIENvbW1IYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy51cGRhdGVTdHVkZW50SW50ZXJ2YWxsID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSBmYWxzZVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDAgLy8gd2UgY291bnQgZmFpbHMgYW5kIGRlYWN0aXZhdGUgb24gNCBjb25zZXF1ZW50IGZhaWxzXG4gICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSB0cnVlXG4gICAgICAgIHRoaXMudGltZXIgPSAwXG4gICAgICAgIHRoaXMud29ya2VyID0gbnVsbFxuICAgICAgICB0aGlzLnVzZVdvcmtlciA9IHRydWVcbiAgICAgICAgdGhpcy53b3JrZXJGYWlscyA9IDBcbiAgICB9XG4gXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5yZXF1ZXN0VXBkYXRlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5zZW5kU2NyZWVuc2hvdC5iaW5kKHRoaXMpLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgaWYgKCF0aGlzLndvcmtlciAmJiBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgIHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpICB9XG4gICAgfVxuIFxuXG4gICAgLyoqXG4gICAgICogU2V0dXAgdGhlIGltYWdlIHdvcmtlclxuICAgICAqIHVzZXMgZm9yayB0byBjcmVhdGUgYSBuZXcgY2hpbGQgcHJvY2Vzc1xuICAgICAqIHVzZXMgdGhlIGltYWdlV29ya2VyTGludXguanMgb3IgaW1hZ2VXb3JrZXJTaGFycC5qcyBmaWxlXG4gICAgICogdGhlIHdvcmtlciBpcyB1c2VkIHRvIHByb2Nlc3MgdGhlIHNjcmVlbnNob3QgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICovXG4gICAgYXN5bmMgc2V0dXBJbWFnZVdvcmtlcigpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyVVJMID0gcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlclVSTDtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyID0gbmV3IFdvcmtlcih3b3JrZXJVUkwsIHsgdHlwZTogJ21vZHVsZScsIGVudjogeyAuLi5wcm9jZXNzLmVudiB9IH0pO1xuICAgICAgICBsb2cuZGVidWcoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IEltYWdlV29ya2VyIGluaXRpYWxpemVkLiBVc2luZyBcIiArIHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJGaWxlTmFtZSlcbiAgICAgICAgXG5cbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgICAgICAgIGlmIChjb2RlICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXJGYWlscyArPSAxXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMud29ya2VyRmFpbHMgPiA0KXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGZhaWxlZCA1IHRpbWVzIC0gc3dpdGNoaW5nIHRvIG5vIHByb2Nlc3NpbmcnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgdGhpcy5zZXR1cEltYWdlV29ya2VyKCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNjcmVlbnNob3QgXG4gICAgICogaWYgdXNlV29ya2VyIGlzIHRydWUsIHRoZSBzY3JlZW5zaG90IGlzIHByb2Nlc3NlZCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKiBvdGhlcndpc2UgdGhlIHNjcmVlbnNob3QgaXMgbm90IHByb2Nlc3NlZCBhbmQgdGhlIG9yaWdpbmFsIHNjcmVlbnNob3QgaXMgcmV0dXJuZWRcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSB7XG4gICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMud29ya2VyKSB7IC8vdHJpcGxlIGNoZWNrIGlmIHdvcmtlciBpcyBpbml0aWFsaXplZFxuICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV29ya2VyIG5vdCBpbml0aWFsaXplZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2UoeyBpbWdCdWZmZXI6IEFycmF5LmZyb20oaW1nQnVmZmVyKSwgaW1WZXJzaW9uOiBwbGF0Zm9ybURpc3BhdGNoZXIuaW1WZXJzaW9uIH0pO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXIub25jZSgnbWVzc2FnZScsIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcykgdGhyb3cgbmV3IEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGZhbGxiYWNrIHRvIG5vIHByb2Nlc3NpbmcgICBcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbnNob3RCYXNlNjQgPSBCdWZmZXIuZnJvbShpbWdCdWZmZXIpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckJhc2U2NCA9IHNjcmVlbnNob3RCYXNlNjRcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHNjcmVlbnNob3RCYXNlNjQ6IHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NDogaGVhZGVyQmFzZTY0LCBpc2JsYWNrOiBmYWxzZSwgaW1nQnVmZmVyOiBpbWdCdWZmZXIgfTtcblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG4gICAgLyoqIFxuICAgICAqIFVwZGF0ZSBjdXJyZW50IFNlcnZlcnN0YXR1cyArIFN0dWRlbnR0c3RhdHVzIChldmVyeSA1IHNlY29uZHMpXG4gICAgICovXG4gICAgYXN5bmMgcmVxdWVzdFVwZGF0ZSgpe1xuXG4gICAgICAgIHRoaXMudGltZXIrKyAgIC8vIHdlIHVzZSB0aW1lciB0byB0aW1lIGxvb3BzIHdpdGggZGlmZmVyZW50IGludGVydmFscyB3aXRob3V0IGludHJvZHVjaW5nIG5ldyB1bm5lY2Nlc2FyeSBzY2hlZHVsZXJzXG4gICAgICAgIGlmICh0aGlzLnRpbWVyICUgMjAgPT09IDAgKXsgIC8vIHJ1biBldmVyeSAyMCo1ICh1cGRhdGVsb29wKSBzZWNvbmRzXG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXNSZW1vdGVBc3Npc3RhbnQgPSBhd2FpdCBydW5SZW1vdGVDaGVjayhwcm9jZXNzLnBsYXRmb3JtKVxuXG4gICAgICAgICAgICBpZiAodXNlc1JlbW90ZUFzc2lzdGFudCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVhZHk6IFBvc3NpYmxlIHJlbW90ZSBhc3Npc3RhbmNlIGRldGVjdGVkJyk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQua2V5d29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogS2V5d29yZCAke2tleXdvcmR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcG9ydCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LnBvcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IFBvcnQgJHtwb3J0fSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnJlbW90ZWFzc2lzdGFudCA9IHVzZXNSZW1vdGVBc3Npc3RhbnRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhIG5ldyBzY3JlZW4gdGhhdCBuZWVkcyB0byBiZSBibG9ja2VkXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cblxuICAgICAgICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkICBubyBzZXJ2ZXJzaWduYWwgZm9yIDIwIHNlY29uZHNcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXsgIFxuICAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQua2lja2VkKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogQ29ubmVjdGlvbiB0byBUZWFjaGVyIGxvc3QhIFJlbW92aW5nIHJlZ2lzdHJhdGlvbi5cIikgLy9yZW1vdmUgc2VydmVyIHJlZ2lzdHJhdGlvbiBsb2NhbGx5IChzYW1lIGFzICdraWNrJylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpICAgLy8gdGhpcyBhbHNvIHJlc2V0cyBzZXJ2ZXJpcCB0aGVyZWZvcmUgbm8gYXBpIGNhbGxzIGFyZSBtYWRlIGFmdGVyd2FyZHNcbiAgICAgICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgICAgICAgLy8ganVzdCBpbiBjYXNlIHNjcmVlbnMgYXJlIGJsb2NrZWQuLiBsZXQgc3R1ZGVudHMgd29ya1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICBcblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHtjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvfVxuXG4gICAgICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvdXBkYXRlYCwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykgeyB0aHJvdyBuZXcgRXJyb3IoJ05ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgICAgICBpZiAgICAgIChkYXRhLm1lc3NhZ2UgPT09IFwibm90YXZhaWxhYmxlXCIpeyBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBFeGFtIEluc3RhbmNlIG5vdCBmb3VuZCEnKTsgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gNTsgfSAgICAvLyBleGFtIGluc3RhbmNlIG5vdCBhdmFpbGFibGUgYnV0IHNlcnZlciByZWFjaGFibGVcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZGF0YS5tZXNzYWdlID09PSBcInJlbW92ZWRcIil7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBTdHVkZW50IHJlZ2lzdHJhdGlvbiBub3QgZm91bmQhJyk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5raWNrU3R1ZGVudCgpXG4gICAgICAgICAgICAgICAgICAgIH0gICAvLyBzdHVkZW50IGdvdCBraWNrZWQgLSB3ZSBoYW5kbGUgdGhpcyBkaWZmZXJlbnRseSBub3cuIHRlYWNoZXIgc3RvcmVzIFwia2lja2VkXCIgZm9yIHN0dWRlbnQgdG8gY29sbGVjdC4gc3R1ZGVudCBpcyByZW1vdmVkIGZyb20gc2VydmVyIHdoZW4gY29sbGVjdGluZyBraWNrZWQgaW5mby4gc3R1ZGVudCBjbG9zZXMgZXhhbSBhbmQgY2xlYW5zIHVwLlxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0gSGVhcnRiZWF0IGxvc3QuLmApOyAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTt9ICAgLy8gaGVhcnRiZWF0IGxvc3Qgc2VydmVyIG5vdCByZWFjaGFibGVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEuc3RhdHVzID09PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDA7IC8vIERpZXMgelx1MDBFNGhsdCBlYmVuZmFsbHMgYWxzIGVyZm9sZ3JlaWNoZXIgSGVhcnRiZWF0IC0gVmVyYmluZHVuZyBoYWx0ZW5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSBmYWxzZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zZXJ2ZXJzdGF0dXMpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3R1ZGVudFN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnN0dWRlbnRzdGF0dXMpKTsgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyU3RhdHVzRGVlcENvcHksIHN0dWRlbnRTdGF0dXNEZWVwQ29weSk7Ly8gVmVyYXJiZWl0dW5nIGRlciBlbXBmYW5nZW5lbiBEYXRlblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICgke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSkgJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAvLyBwcmV2ZW50IGZvY3VzIHdhcm5pbmcgYmxvY2sgaWYgbm8gY29ubmVjdGlvbiBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlICAvLyBpZiBub3QgY29ubmVjdGVkIGJ1dCBzdGlsbCBpbiBleGFtIG1vZGUgeW91IGNvdWxkIHRyaWdnZXIgYSBmb2N1cyB3YXJuaW5nIGFuZCBub2JvZHkgaXMgYWJsZSB0byB1bmxvY2sgeW91XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgYXN5bmMgc2VuZFNjcmVlbnNob3QoKXtcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApe3JldHVybn0gIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWRcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrOyAvLyBWYXJpYWJsZW4gYXVcdTAwREZlcmhhbGIgZGVzIGlmLUJsb2NrcyBkZWZpbmllcmVuXG4gICAgICAgICAgICBsZXQgaW1nQnVmZmVyID0gbnVsbDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgIFxuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgc2NyZWVuc2hvdCBmcm9tIGRlc2t0b3AgdmlhIHNjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kIChmbGFtZXNob3QsIGltYWdlbWFnaWMsIGV0YylcbiAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdCh7IGZvcm1hdDogJ3BuZycgfSk7XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjaywgaW1nQnVmZmVyIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgIC8vIGtlaW4gaW1hZ2VCdWZmZXIgbWl0Z2VnZWJlbiBiZWRldXRldCBudXR6ZSBzY3JlZW5zaG90LWRlc2t0b3AgaW0gd29ya2VyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWNjZXNzKSB7IHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMDt9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkltYWdlIHByb2Nlc3NpbmcgZmFpbGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgXCJzY3JlZW5zaG90XCIgZnJvbSBhcHB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRGb2N1c2VkTWluZG93ID0gV2luZG93SGFuZGxlci5nZXRDdXJyZW50Rm9jdXNlZFdpbmRvdygpICAvL3JldHVybnMgZXhhbSB3aW5kb3cgaWYgbm90aGluZyBpbiBmb2N1cyBvciBtYWluIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudEZvY3VzZWRNaW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjdXJyZW50Rm9jdXNlZE1pbmRvdy53ZWJDb250ZW50cy5jYXB0dXJlUGFnZSgpICAvLyB0aGlzIHNob3VsZCBhbHdheXMgd29yayBiZWNhdXNlIGl0J3Mgb25ib2FyZCBlbGVjdHJvblxuICAgICAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gcmVzdWx0LnRvUE5HKClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2sgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAvLyBhdHRlbnRpb24gcHJvY2Vzc0ltYWdlICBjb252ZXJ0cyBidWZmZXIgdG8gdWludDhhcnJheVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgKz0xO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogcHJvY2Vzc0ltYWdlIGZhaWxlZDogJHtlcnJ9YClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1BQ09TIFdPUktBUk9VTkQgLSBzd2l0Y2ggdG8gcGFnZWNhcHR1cmUgaWYgbm8gcGVybWlzc29ucyBhcmUgZ3JhbnRlZFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiAmJiB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ICYmIGltZ0J1ZmZlciAhPT0gbnVsbCl7ICAvL3RoaXMgaXMgZm9yIG1hY09TIGJlY2F1c2UgaXQgZGVsaXZlcnMgYSBibGFuayBiYWNrZ3JvdW5kIHNjcmVlbnNob3Qgd2l0aG91dCBwZXJtaXNzaW9ucy4gd2UgY2F0Y2ggdGhhdCBjYXNlIHdpdGggYSB3b3JrYXJvdW5kXG4gICAgICAgICAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IGZhbHNlICAgLy9uZXZlciBkbyB0aGlzIGFnYWluXG4gICAgICAgICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IGFwcC5pc1BhY2thZ2VkID8gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJykgOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGRhdGE6IHsgdGV4dCB9IH0gICA9IGF3YWl0IFRlc3NlcmFjdC5yZWNvZ25pemUoaW1nQnVmZmVyICwgJ2VuZycseyBsYW5nUGF0aDogcHVibGljUGF0aCB9ICk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBhcHBXaW5kb3dWaXNpYmxlID0gdGV4dC5pbmNsdWRlcyhcIkV4YW1cIikgICAvL2NoZWNrIGlmIHRoZSB3b3JkIFwiRXhhbVwiIGNhbiBiZSBmb3VuZCBpbiBzY3JlZW5zaG90IC0gb3RoZXJ3aXNlIGl0IGlzIG1vc3QgbGlrZWx5IGEgYmxhbmsgZGVza3RvcCAtIG1hY29zIHF1aXJrXG4gICAgICAgICAgICAgICAgICAgIGlmICghYXBwV2luZG93VmlzaWJsZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogUGxlYXNlIGNoZWNrIHlvdXIgc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAtIFN3aXRjaGluZyB0byBQYWdlQ2FwdHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IE1hY09TIHNjcmVlbnNob3RwZXJtaXNzaW9ucyBjaGVjayBPS1wiKTt9XG4gICAgICAgICAgICAgICAgfWNhdGNoKGVycil7ICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogJHtlcnJ9YCk7IH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvLyBpZiBzb21ldGhpbmcgd2VudCB3cm9uZyB3ZSBkbyBub3QgaGF2ZSBhIHNjcmVlbnNob3QgLSBzbyBkbyBub3QgdXBkYXRlIHRoZSBzZXJ2ZXJcbiAgICAgICAgICAgIGlmICghc2NyZWVuc2hvdEJhc2U2NCl7XG4gICAgICAgICAgICAgICAgaWYodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTY3JlZW5zaG90IGVycm9yIC0+IFN3aXRjaGluZyB0byBQYWdlQ2FwdHVyZWApIH0gXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogUGFnZUNhcHR1cmUgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIE5vLVByb2Nlc3NpbmdgKSB9ICAgXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IG5vIHNjcmVlbnNob3QgYXZhaWxhYmxlIC0gcGxlYXNlIGZpeCB5b3VyIHNldHVwYCkgfVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG5cblxuXG4gICAgICAgICAgICAvL2RvIG5vdCBydW4gY29sb3JjaGVjayBpZiBhbHJlYWR5IGxvY2tlZFxuICAgICAgICAgICAgaWYgKCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlICYmICF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzKXtcbiAgICAgICAgICAgICAgICBpZiAoaXNibGFjayl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFN0dWRlbnQgU2NyZWVuc2hvdCBkb2VzIG5vdCBmaXQgcmVxdWlyZW1lbnRzIChhbGxibGFjaylcIik7XG4gICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGxldCBzY3JlZW5zaG90aGFzaCA9IG51bGxcbiAgICAgICAgICAgIHRyeSB7IHNjcmVlbnNob3RoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShCdWZmZXIuZnJvbShzY3JlZW5zaG90QmFzZTY0LCAnYmFzZTY0JykpLmRpZ2VzdChcImhleFwiKTsgIH0gIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgY2F0Y2goZXJyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBjcmVhdGluZyBoYXNoIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdDogc2NyZWVuc2hvdEJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aGFzaDogc2NyZWVuc2hvdGhhc2gsXG4gICAgICAgICAgICAgICAgaGVhZGVyOiBoZWFkZXJCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGZpbGVuYW1lOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuICsgXCIuanBnXCIsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gc2VuZCBzY3JlZW5zaG90IHRvIHNlcnZlciB2aWEgZW1haWwgZmV0Y2ggcmVxdWVzdFxuICAgICAgICAgICAgbGV0IGF0dGVtcHQgPSAwO1xuICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDI7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvdXBkYXRlc2NyZWVuc2hvdGA7XG4gICAgICAgICAgICB0aGlzLmRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0LCBtYXhSZXRyaWVzKTsgLy8gRXJzdGUgQW5mcmFnZSBzdGFydGVuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuICAgIGRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0ID0gMCwgbWF4UmV0cmllcykge1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICBhZ2VudCxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGU6IE5ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGU6IFN0YXR1cyBFcnJvcjpcIiwgZGF0YS5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgIGlmIChhdHRlbXB0IDwgbWF4UmV0cmllcyAtIDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0ICsgMSwgbWF4UmV0cmllcyk7IC8vIFJldHJ5XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGF0dGVtcHQgPT09IG1heFJldHJpZXMgLSAxICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZSAoZmV0Y2gpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG4gICAgYXN5bmMga2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cyl7XG4gICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWNrU3R1ZGVudDogU3R1ZGVudCBnb3Qga2lja2VkIGJ5IFRlYWNoZXJcIilcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQua2lja2VkID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7ZGVsZm9sZGVyb25leGl0OiBmYWxzZX0gIC8vIGRvIG5vdCBkZWxldGUgZm9sZGVyIG9uIGV4aXQgYmVjYXVzZSBzdHVkZW50IGdvdCBraWNrZWRcbiAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMgJiYgc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIpeyBzZXJ2ZXJzdGF0dXMuZGVsZm9sZGVyb25leGl0ID0gdHJ1ZX1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgXG4gICAgICAgIHJldHVybiAgIC8vdGhpcyBlbmRzIGhlcmUgYmVjYXVzZSB3ZSBnb3Qga2lja2VkIGJ5IHRoZSB0ZWFjaGVyXG4gICAgfVxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiByZWFjdCB0byBzZXJ2ZXIgc3RhdHVzIFxuICAgICAqIHRoaXMgY3VycmVudGx5IG9ubHkgaGFuZGxlIHN0YXJ0ZXhhbSAmIGVuZGV4YW1cbiAgICAgKiBjb3VsZCBhbHNvIGhhbmRsZSBraWNrLCBmb2N1c3Jlc3RvcmUsIGFuZCBldmVuIHRyaWdnZXIgZmlsZSByZXF1ZXN0c1xuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlcnN0YXR1cywgc3R1ZGVudHN0YXR1cyl7XG4gICAgICAgXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gaW5kaXZpZHVhbCBzdGF0dXMgdXBkYXRlc1xuXG4gICAgICAgIGlmICggc3R1ZGVudHN0YXR1cyAmJiBPYmplY3Qua2V5cyhzdHVkZW50c3RhdHVzKS5sZW5ndGggIT09IDApIHsgIC8vIHdlIGhhdmUgc3RhdHVzIHVwZGF0ZXMgKHRhc2tzKSAtIGRvIGl0IVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMucHJpbnRkZW5pZWQpIHtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZGVuaWVkJykgICAvL3RyaWdnZXIsIHdoeVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5raWNrZWQpIHsgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCBieSB0ZWFjaGVyXG4gICAgICAgICAgICAgICAgdGhpcy5raWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKVxuICAgICAgICAgICAgICAgIHJldHVybiAgIC8vdGhpcyBlbmRzIGhlcmUgYmVjYXVzZSB3ZSBnb3Qga2lja2VkIGJ5IHRoZSB0ZWFjaGVyXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmRlbGZvbGRlciA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjbGVhbmluZyBleGFtIHdvcmtmb2xkZXJcIilcbiAgICAgICAgICAgICAgICBsZXQgZGVsZm9sZGVyID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgXG4gICAgICAgICAgICAgICAgICAgIGRlbGZvbGRlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnJvcikgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENhbiBub3QgZGVsZXRlIGRpcmVjdG9yeSAtICR7ZXJyb3J9IGApXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGRlbGZvbGRlciA9PSBmYWxzZSl7ICAvL3RyeSBkZWxldGluZyBmaWxlIGJ5IGZpbGUgKHRoZSBvbmUgdGhhdCBjYXVzZXMgdGhlIHByb2JsZW0gd2lsbCBzdGF5IGluIHRoZSBmb2xkZXIpXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHsgZnMucm1TeW5jKGZpbGVQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSAgLy8gVmVyc3VjaGUsIGRhcyBWZXJ6ZWljaG5pcyByZWt1cnNpdiB6dSBsXHUwMEY2c2NoZW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGZzLnVubGlua1N5bmMoZmlsZVBhdGgpOyAgfS8vIFZlcnN1Y2hlLCBkaWUgRGF0ZWkgenUgbFx1MDBGNnNjaGVuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiAoZGVsZm9sZGVyKSBGZWhsZXIgYmVpbSBMXHUwMEY2c2NoZW4gZGVyIERhdGVpL1ZlcnplaWNobmlzOiAke2ZpbGVQYXRofWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmZvY3VzID09IGZhbHNlKXtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMucmVzdG9yZWZvY3Vzc3RhdGUgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogcmVzdG9yaW5nIGZvY3VzIHN0YXRlIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmICF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IHRydWUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPT0gZmFsc2UgICl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBhY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gdHJ1ZSAgLy9jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrIHdpbGwgYmUgcHV0IG9uIHRoaXMucHJpdmF0ZVNwZWxsY2hlY2sgaW4gZWRpdG9yIHVwZGF0ZWQgdmlhIGZldGNoSW5mbygpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgaXBjTWFpbi5lbWl0KFwic3RhcnRMYW5ndWFnZVRvb2xcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gZmFsc2UgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPT0gdHJ1ZSApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGRlLWFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gZmFsc2UgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suc3VnZ2VzdGlvbnMgPSBzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnNlbmRleGFtID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbmRFeGFtVG9UZWFjaGVyKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmZldGNoZmlsZXMgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEZpbGVGcm9tU2VydmVyKHN0dWRlbnRzdGF0dXMuZmlsZXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgYW4gbWljcm9zb2Z0MzY1IHRoaW5nLiBjaGVjayBpZiBleGFtIG1vZGUgaXMgb2ZmaWNlLCBjaGVjayBpZiB0aGlzIGlzIHNldCAtIG90aGVyd2lzZSBkbyBub3QgZW50ZXIgZXhhbW1vZGUgLSBpdCB3aWxsIGZhaWxcbiAgICAgICAgICAgIC8vc2V0IG9yIHVwZGF0ZSBzaGFyaW5nIGxpbmsgLSBpdCB3aWxsIGJlIHVzZWQgaW4gXCJtaWNyb3NvZnQzNjVcIiBleGFtIG1vZGVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IHN0dWRlbnRzdGF0dXMubXNvZmZpY2VzaGFyZSAgXG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgIC8vc2V0IG9yIHVwZGF0ZSBncm91cCBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCAhPT0gc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgPSBzdHVkZW50c3RhdHVzLmdyb3VwICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdnZXRtYXRlcmlhbHMnKSAgLy8gaWYgd2UgY2hhbmdlIGdyb3VwIHdlIG5lZWQgdG8gZ2V0IHRoZSBtYXRlcmlhbHMgYWdhaW5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICBcblxuICAgICAgICB9XG5cblxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBnbG9iYWwgc3RhdHVzIHVwZGF0ZXNcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAgICAgICBcbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqIFNXSVRDSCBFWEFNIFNFQ1RJT04gIFNUQVJUXG4gICAgICAgICAqL1xuXG4gICAgICAgIC8vIGlmIHN0dWRlbnQgaXMgaW4gbG9ja2VkIHN0YXRlIGluIGV4YW0gbW9kZVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICBcblxuICAgICAgICAgICAgLy9jaGVjayBpZiB0aGUgY3VycmVudCBhY3RpdmUgc2VjdGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgb25lIGluIHRoZSBzZXJ2ZXJzdGF0dXMgLSBpZiBub3QgY2hhbmdlIHRvIHRoZSBuZXcgc2VjdGlvblxuICAgICAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uICE9PSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24pe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjaGFuZ2luZyBzZWN0aW9uIHRvICR7c2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb259ICR7c2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWV9ICwgRXhhbXR5cGU6ICR7c2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGV9YCApXG5cbiAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudExvY2tlZFNlY3Rpb24gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb247IC8vIEN1cnJlbnQgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3Igc2F2aW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0xvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbjsgLy8gTmV3IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIGxvYWRpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbURpciA9IHRoaXMuY29uZmlnLmV4YW1kaXJlY3Rvcnk7XG5cblxuICAgICAgICAgICAgICAgIC8vc2F2ZSBhbGwgZmlsZXMgZnJvbSB0aGUgb2xkIHNlY3Rpb24gKGlmIGV4YW0gbW9kZSBpcyBcImVkaXRvclwiKSBhbmQgc2VuZCB0byB0ZWFjaGVyIC0gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKClcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9PT0gXCJlZGl0b3JcIil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogc2VuZGluZyBleGFtIHRvIHRlYWNoZXIgKGZpbmFsIHN1Ym1pdClcIilcblxuICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIGN1cnJlbnQgd29yayBhcyBiYXNlNjQgdG8gdGVhY2hlciAoc3RvcmVzIHBkZiBpbiBBQkdBQkUgZm9sZGVyIHdpdGggc3VibWlzc2lvbiBudW1iZXIpXG4gICAgICAgICAgICAgICAgICAgIGxldCBwZGYgPSBhd2FpdCB0aGlzLmdldEJhc2U2NFBERih0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsIHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbY3VycmVudExvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lKSAgLy8gbG9jYWwgZnVuY3Rpb24gdG8gZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBkZi5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VuZEJhc2U2NFBERnRvVGVhY2hlcihwZGYuYmFzZTY0cGRmLCBjdXJyZW50TG9ja2VkU2VjdGlvbilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAvL2JhY2t1cCBsb2NhbCBmaWxlcyBhbmQgc2VuZCB0byB0ZWFjaGVyIChhcmNoaXZlIHdpdGggdGltZXN0YW1wKVxuXG5cbiAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIC8vd2FpdCAxIHNlY29uZCBhbmQgY2xlYW51cCBORVhULUVYQU0tU1RVREVOVC1XT1JLRElSXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDAwKVxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGV4YW10eXBlIGluIGNsaWVudGluZm9cbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIGxvY2tlZCBzZWN0aW9uIEFGVEVSIHNhdmluZyB0aGUgb2xkIHN0YXRlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uID0gbmV3TG9ja2VkU2VjdGlvbjtcblxuXG5cbiAgICAgICAgICAgICAgICAvLyBNT1ZFIFNlY3Rpb24gRmlsZXMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDE6IFNBVkUgQ1VSUkVOVCBFWEFNRElSIEZJTEVTIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZXhhbURpcikgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPT0gdW5kZWZpbmVkKSB7IC8vIENoZWNrIGlmIG1haW4gZGlyIGV4aXN0cyBhbmQgYSBzZWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmVcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZpbmcgY29udGVudCBmcm9tIGV4YW1EaXIgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2F2ZVBhdGggPSBgJHtleGFtRGlyfS8ke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2F2ZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHNhdmVQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgLy8gQ3JlYXRlIHNhdmUgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmMoZXhhbURpcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlcy5sZW5ndGh9IGl0ZW1zIGluIGV4YW1EaXIgdG8gc2F2ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNTYXZlZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKG9sZFBhdGgpOyAvLyBHZXQgZmlsZSBzdGF0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBhY3R1YWwgRklMRVMsIG5vdCBkaXJlY3RvcmllcyAobGlrZSB0aGUgc2VjdGlvbiBmb2xkZXJzIHRoZW1zZWx2ZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IGAke3NhdmVQYXRofS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpOyAvLyBDb3B5IGZpbGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMudW5saW5rU3luYyhvbGRQYXRoKTsgLy8gRGVsZXRlIG9yaWdpbmFsIGZpbGUgZnJvbSBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzU2F2ZWQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmVkIGZpbGUgJHtmaWxlfSB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIChmb2xkZXIpIGl0ZW0gJHtmaWxlfSBpbiBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBzYXZlZCAke2ZpbGVzU2F2ZWR9IGZpbGVzIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBzYXZlIC0gZXhhbURpciBleGlzdHM6ICR7ZnMuZXhpc3RzU3luYyhleGFtRGlyKX0sIGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMjogTE9BRCBGSUxFUyBmcm9tIHRoZSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIE5FVyBsb2NrZWQgc2VjdGlvbiB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgbmV3TG9ja2VkU2VjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IExvYWRpbmcgY29udGVudCBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2FkUGF0aCA9IGAke2V4YW1EaXJ9LyR7bmV3TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9hZFBhdGgpKSB7IC8vIENoZWNrIGlmIHRoZSBuZXcgc2VjdGlvbiBmb2xkZXIgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXNUb0xvYWQgPSBmcy5yZWFkZGlyU3luYyhsb2FkUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXNUb0xvYWQubGVuZ3RofSBpdGVtcyBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzQ29waWVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXNUb0xvYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc291cmNlUGF0aCA9IGAke2xvYWRQYXRofS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVzdFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNGaWxlKCkpIHsgLy8gRW5zdXJlIG9ubHkgZmlsZXMgYXJlIGNvcGllZCBiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMoc291cmNlUGF0aCwgZGVzdFBhdGgpOyAvLyBDb3B5IGZpbGUgdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNDb3BpZWQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDb3BpZWQgZmlsZSAke2ZpbGV9IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSBpdGVtICR7ZmlsZX0gaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgY29waWVkICR7ZmlsZXNDb3BpZWR9IGZpbGVzIGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBOZXcgbG9ja2VkIHNlY3Rpb24gZGlyZWN0b3J5ICR7bmV3TG9ja2VkU2VjdGlvbn0gZG9lcyBub3QgZXhpc3QuIFN0YXJ0aW5nIHdpdGggYSBjbGVhbiBzdGF0ZS5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBuZXdMb2NrZWRTZWN0aW9uIGlzIGZhbHN5ICgke25ld0xvY2tlZFNlY3Rpb259KSwgc2tpcHBpbmcgZmlsZSBsb2FkYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIGR1cmluZyBmb2xkZXIgb3BlcmF0aW9uIC0gJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBzdGFjazogJHtlcnJvci5zdGFja31gKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn0sIG5ld0xvY2tlZFNlY3Rpb246ICR7bmV3TG9ja2VkU2VjdGlvbn0sIGV4YW1EaXI6ICR7ZXhhbURpcn1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgKiAgQWN0dWFsbHkgU1dJVENIIEVYQU0gU0VDVElPTlxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgb3IgcmVsZWFkIHRoZSBuZXcgZXhhbSBzZWN0aW9uIGluIHRoZSBzYW1lIHdpbmRvd1xuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpe1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGRldnRvb2xzIHdpbmRvdyAtIGlmIHlvdSBkb24ndCBuZXh0LWV4YW0gd2lsbCBjcmFzaCBzaWxlbnRseSBvbiByZWxvYWQgYW5kIHNlY3Rpb24gc3dpdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdlYkNvbnRlbnRzLmdldEFsbFdlYkNvbnRlbnRzKCkuZm9yRWFjaCh3YyA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh3Yy5ob3N0V2ViQ29udGVudHM/LmlkID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuaWQgJiYgd2MuaXNEZXZUb29sc09wZW5lZD8uKCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN3aXRjaEV4YW1TZWN0aW9uOiBkZXN0cm95aW5nIGRldnRvb2xzIHdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBhbmQgcmVvcGVuIGl0IHdpdGggdGhlIG5ldyBleGFtIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5vbmNlKCdjbG9zZWQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5kZXN0cm95KCk7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNXSVRDSCBFWEFNIFNFQ1RJT04gIEVORFxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgXG5cblxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jaykgeyAgdGhpcy5hY3RpdmF0ZVNjcmVlbmxvY2soKSB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCApIHsgdGhpcy5raWxsU2NyZWVubG9jaygpIH1cblxuICAgICAgICAvLyBzY3JlZW5zaG90IHNhZmV0eSAoT0NSIHNlYXJjaGVzIGZvciBuZXh0LWV4YW0gc3RyaW5nKVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNob3RvY3IpIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90b2NyID0gdHJ1ZSAgfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90b2NyID0gZmFsc2UgICB9XG5cbiAgICAgICAgLy8gR3JvdXBzIGhhbmRsaW5nXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5ncm91cHMpeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwcyA9IHRydWV9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwcyA9IGZhbHNlfVxuXG4gICAgICAgIC8vdXBkYXRlIHNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCB8fCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09PSAwKSB7IC8vMCBpcyB0aGUgc2FtZSBhcyBmYWxzZSBvciB1bmRlZmluZWQgYnV0IHNob3VsZCBiZSB0cmVhdGVkIGFzIG51bWJlclxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgIT09IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMCApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBjaGFuZ2VkIHRvXCIsIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA9IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMFxuICAgICAgICAgICAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgZGlzYWJsZWQhXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNsZWFyIG9sZCBpbnRlcnZhbCBhbmQgc3RhcnQgbmV3IGludGVydmFsIGlmIHNldCB0byBzb21ldGhpbmcgYmlnZ2VyIHRoYW4gemVyb1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdG9wKClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPiAwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLmludGVydmFsID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIC8vIHJlbW92ZSBsb2Nrc2NyZWVuIGltbWVkaWF0ZWx5IC0gZG9uJ3Qgd2FpdCBmb3Igc2VydmVyIGluZm9cbiAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIFxuICAgICAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gc2VuZCBiYXNlNjQgcGRmIHRvIHRlYWNoZXJcbiAgICBzZW5kQmFzZTY0UERGdG9UZWFjaGVyKGJhc2U2NHBkZiwgc2VjdGlvbj0xKXtcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3ByaW50cmVxdWVzdC8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufWA7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICBkb2N1bWVudDogYmFzZTY0cGRmLFxuICAgICAgICAgICAgcHJpbnRyZXF1ZXN0OiBmYWxzZSwgICAgXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsXG4gICAgICAgICAgICBsb2NrZWRzZWN0aW9uOiBzZWN0aW9uXG4gICAgICAgIH1cbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4geyByZXR1cm4gcmVzcG9uc2UuanNvbigpOyAgfSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tZXNzYWdlID09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIrKyAgIC8vIHN1Y2Nlc3NmdWwgc3VibWlzc2lvbiAtPiBpbmNyZW1lbnQgbnVtYmVyXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7ICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZWRpdG9yIEAgcHJpbnRiYXNlNjQ6XCIsZXJyb3IubWVzc2FnZSkgICAgXG4gICAgICAgIH0pOyBcbiAgICB9XG4gICAgXG5cblxuXG4gICAgLy9nZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgIC8vIEFUVEVOVElPTjogdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBpcGNoYW5kbGVyLmpzIHRoYXQgYWxzbyBnZW5lcmF0ZXMgYSBwZGYgYnV0IHN0b3JlcyBpdCBhcyBmaWxlIGluIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgIGFzeW5jIGdldEJhc2U2NFBERihzdWJtaXNzaW9ubnVtYmVyLCBzZWN0aW9ubmFtZSwgcHJpbnRCYWNrZ3JvdW5kPWZhbHNlKXtcbiAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogcHJpbnRCYWNrZ3JvdW5kLFxuICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG5cbiAgXG4gICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7c2VjdGlvbm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDtBYmdhYmU6ICR7c3VibWlzc2lvbm51bWJlcn08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIC8vIHNldCB0aGUgdGl0bGUgb2YgdGhlIGV4YW0gd2luZG93IGFuZCB0aGVyZWZvcmUgdGhlIGRvY3VtZW50IHRpdGxlXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5jbGllbnRuYW1lfSAtICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfSAtIFZlcnNpb24gJHtzdWJtaXNzaW9ubnVtYmVyfVwiYCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBiYXNlNjRwZGYgPSBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFVcmwgPSBgZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LCR7YmFzZTY0cGRmfWA7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJQREYgZ2VuZXJhdGVkXCIsIGRhdGFVcmw6ZGF0YVVybCwgYmFzZTY0cGRmOiBiYXNlNjRwZGYsIHN0YXR1czogXCJzdWNjZXNzXCIgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIkVycm9yIGdlbmVyYXRpbmcgUERGOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXJyb3IgZ2VuZXJhdGluZyBQREZcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNob3cgdGVtcG9yYXJ5IHNjcmVlbmxvY2sgd2luZG93XG4gICAgYWN0aXZhdGVTY3JlZW5sb2NrKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcbiAgICAgICBcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID09IDApeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IHRydWVcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSAgLy8gYWRkIHNjcmVlbmxvY2sgd2luZG93cyBmb3IgYWRkaXRpb25hbCBkaXNwbGF5c1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSB0ZW1wb3Jhcnkgc2NyZWVubG9ja3dpbmRvd1xuICAgIGtpbGxTY3JlZW5sb2NrKCl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5sb2Nrd2luZG93ICYmICFzY3JlZW5sb2Nrd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lsbFNjcmVlbmxvY2s6IG5vIGZ1bmN0aW9uYWwgc2NyZWVubG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgfSBcbiAgICAgICAgLy8gQ2xlYXIgYXJyYXkgY29tcGxldGVseSBhZnRlciBhdHRlbXB0aW5nIHRvIGRlc3Ryb3kgYWxsIHdpbmRvd3NcbiAgICAgICAgLy8gVGhlIGNsb3NlZCBldmVudCBoYW5kbGVyIHdpbGwgYWxzbyBjbGVhbiB1cCwgYnV0IHRoaXMgZW5zdXJlcyB0aGUgYXJyYXkgaXMgZW1wdHlcbiAgICAgICAgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IGZhbHNlXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTdGFydHMgZXhhbSBtb2RlIGZvciBzdHVkZW50XG4gICAgICogZGVsZXRlcyB3b3JrZm9sZGVyIGNvbnRlbnRzIChpZiBzZXQpXG4gICAgICogb3BlbnMgYSBuZXcgd2luZG93IGluIGtpb3NrIG1vZGUgd2l0aCB0aGUgZ2l2ZW4gZXhhbXR5cGVcbiAgICAgKiBlbmFibGVzIHRoZSBibHVyIGxpc3RlbmVyIGFuZCBhY3RpdmF0ZXMgcmVzdHJpY3Rpb25zIChkaXNhYmxlIGtleWJvYXJzaG9ydGN1dHMgZXRjLilcbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGV4YW1tb2RlLCBleGFtdHlwZSwgYW5kIG90aGVyIHNldHRpbmdzIGZyb20gdGhlIHRlYWNoZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IGRpYWxvZyBpcyBvcGVuIGFuZCBsb2cgd2FybmluZ1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGl0V2FybmluZ09wZW4gfHwgV2luZG93SGFuZGxlci5leGl0UXVlc3Rpb25PcGVuIHx8IFdpbmRvd0hhbmRsZXIubWluaW1pemVXYXJuaW5nT3Blbikge1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogRGlhbG9nIGlzIHN0aWxsIG9wZW4gLSBleGFtIHdpbGwgc3RhcnQgYW55d2F5XCIpXG4gICAgICAgIH1cbiAgXG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICBcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5jbWFyZ2luICAvLyB0aGlzIGlzIHVzZWQgdG8gY29uZmlndXJlIG1hcmdpbiBzZXR0aW5ncyBmb3IgdGhlIGVkaXRvclxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxpbmVzcGFjaW5nID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0ubGluZXNwYWNpbmcgLy8gd2UgdHJ5IHRvIGRvdWJsZSBsaW5lc3BhY2luZyBvbiBkZW1hbmQgaW4gcGRmIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uYXVkaW9SZXBlYXQgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgaWYgKCFXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGNyZWF0aW5nIGV4YW0gd2luZG93XCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCBuZXQgZnJvbSAnbmV0J1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbmNvbnN0IHt0fSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnR7aXBjTWFpbiwgY2xpcGJvYXJkLGFwcCwgd2ViQ29udGVudHN9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBvcyBmcm9tICdvcydcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgbWFtbW90aCBmcm9tICdtYW1tb3RoJztcblxuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlcic7XG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi90cmF5bWVudS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOZXR3b3JrT3JSZXNldCB9IGZyb20gJy4vdGVzdHBlcm1pc3Npb25zTWFjLmpzJztcbmltcG9ydCB7IGdldFdsYW5JbmZvIH0gZnJvbSAnLi9nZXR3bGFuaW5mby5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbnN0IGNoZWNrUG9ydE9wZW4gPSAocG9ydCwgaG9zdCA9ICcxMjcuMC4wLjEnLCB0aW1lb3V0ID0gMTUwMCkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgICAgICBjb25zdCBmaW5pc2ggPSAocnVubmluZywgZXJyb3IgPSBudWxsKSA9PiB7XG4gICAgICAgICAgICBzb2NrZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSh7IHJ1bm5pbmcsIHBvcnQsIGhvc3QsIGVycm9yIH0pO1xuICAgICAgICB9O1xuICAgICAgICBzb2NrZXQuc2V0VGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Nvbm5lY3QnLCAoKSA9PiBmaW5pc2godHJ1ZSkpO1xuICAgICAgICBzb2NrZXQub25jZSgndGltZW91dCcsICgpID0+IGZpbmlzaChmYWxzZSwgJ3RpbWVvdXQnKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdlcnJvcicsIChlcnIpID0+IGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KHBvcnQsIGhvc3QpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gSVBDIGhhbmRsaW5nIChCYWNrZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2UgLy8gZmxhZyB0byBwcmV2ZW50IGNsb3Npbmcgd2luZG93IHdoaWxlIHByaW50aW5nXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG4gICAgICAgIFxuXG4gICAgICAgIGlwY01haW4ub24oJ3NldC1uZXctbG9jYWxlJywgKGV2ZW50LCBsb2NhbGUpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2V0LW5ldy1sb2NhbGU6IHNldHRpbmcgbmV3IGxvY2FsZSB0byAke2xvY2FsZX1gKVxuICAgICAgICAgICAgaTE4bi5sb2NhbGUgPSBsb2NhbGVcbiAgICAgICAgICAgIHVwZGF0ZVN5c3RlbVRyYXkoaTE4bi5sb2NhbGUpO1xuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEV4YW1NYXRlcmlhbHMnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICBcbiAgICAgICAgICAgIGxldCBjbGllbnRpbmZvID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb1xuICAgICAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJpcCA9IGNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgICAgIGxldCB0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHsgXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGNsaWVudGluZm8uZ3JvdXAsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBleGFtTWF0ZXJpYWxzID0gZmFsc2VcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgICAgICAgICBleGFtTWF0ZXJpYWxzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9nZXRleGFtbWF0ZXJpYWxzLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogcmVjZWl2ZWQgZGF0YVwiLCBkYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiAke2Vycn1gKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4YW1NYXRlcmlhbHNcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgIFxuICAgICAgICB9KSBcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVudGZlcm5lIGFsdGUgTGlzdGVuZXIsIHVtIERvcHBlbC1SZWdpc3RyaWVydW5nZW4genUgdmVybWVpZGVuXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ID0gYWxsb3dlZFVybHMubWFwKHMgPT4gU3RyaW5nKHMpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxTdHIgPSBTdHJpbmcodXJsIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGlmIChhbGxvdy5zb21lKHUgPT4gdXJsU3RyLmluY2x1ZGVzKHUpKSkgeyBndWVzdC5sb2FkVVJMKHVybCk7IGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBhbGxvd2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybFN0ciA9IFN0cmluZyh1cmwgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhbGxvdy5zb21lKHUgPT4gdXJsU3RyLmluY2x1ZGVzKHUpKSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG5cblxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVW5pZmllZCBJUEMgaGFuZGxlciBmb3Igd2VidmlldyBibG9ja2luZyAtIHN1cHBvcnRzIHdlYnNpdGUsIGVkdXZpZHVhbCwgZm9ybXMsIHJkcCBtb2Rlc1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb2RlLCBhbGxvd2VkRG9tYWluLCBiYXNlVXJsLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiwgZ2Zvcm1zVGVzdElkIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgdG8gcHJldmVudCBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVSTCB2YWxpZGF0aW9uIGZ1bmN0aW9uIC0gZGlmZmVyZW50IGxvZ2ljIGJhc2VkIG9uIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IGlzVXJsQWxsb3dlZCA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZSA9PT0gXCJ3ZWJzaXRlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV0VCU0lURSBtb2RlOiBjaGVjayBkb21haW4gbWF0Y2hpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwgfHwgdGFyZ2V0VXJsLmluY2x1ZGVzKGJhc2VVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkb21haW4gPSB1cmxPYmouaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09IGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbi5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGRvbWFpbi5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVEVVZJRFVBTC9NT09ETEUgbW9kZTogY2hlY2sgbW9vZGxlVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vb2RsZS1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJzdGFydGF0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInByb2Nlc3NhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJlZHV2aWR1YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ0aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZm9ybXNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBGT1JNUyBtb2RlOiBjaGVjayBnZm9ybXNUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEZvcm1zLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJmb3JtUmVzcG9uc2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJyZHBcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSRFAgbW9kZTogYWxsb3cgYWxsIChvciBpbXBsZW1lbnQgc3BlY2lmaWMgbG9naWMgaWYgbmVlZGVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBtb2RlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hlY2tDb21tb25FeGNlcHRpb25zKHRhcmdldFVybCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0PVwiX2JsYW5rXCIgbGlua3MgYW5kIHdpbmRvdy5vcGVuIC0gYmxvY2sgQkVGT1JFIG5hdmlnYXRpb25cbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgd2lsbC1uYXZpZ2F0ZSBvbiB3ZWJDb250ZW50cyBsZXZlbCAtIHRoaXMgZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEJsb2NrIG5hdmlnYXRpb24gY29tcGxldGVseSAtIHRoaXMgaGFwcGVucyBCRUZPUkUgcGFnZSBsb2Fkc1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7IC8vIFN0b3AgYW55IGxvYWRpbmcgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbGlhcyBmb3IgZWR1dmlkdWFsIG1vZGUgLSByZWRpcmVjdHMgdG8gdW5pZmllZCBoYW5kbGVyXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3ItZWR1dmlkdWFsLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSkgPT4ge1xuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgdW5pZmllZCBoYW5kbGVyIHdpdGggZWR1dmlkdWFsIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IHVuaWZpZWRIYW5kbGVyID0gaXBjTWFpbi5saXN0ZW5lcnMoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnKVswXTtcbiAgICAgICAgICAgIGlmICh1bmlmaWVkSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmlmaWVkSGFuZGxlcihldmVudCwgeyBndWVzdElkLCBtb2RlOiAnZWR1dmlkdWFsJywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWxvYWQgdGhlIGJyb3dzZXIgdmlld1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3JlbG9hZC1icm93c2VyLXZpZXcnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsKTtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBsYW5ndWFnZVRvb2wgQVBJIFNlcnZlciAod2l0aCBKYXZhIEpSRSlcbiAgICAgICAgICogUnVucyBhdCBsb2NhbGhvc3QgODA4OFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdGl2YXRlIHNwZWxsY2hlY2sgb24gZGVtYW5kIGZvciBzcGVjaWZpYyBzdHVkZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIExhbmd1YWdlVG9vbCBzZXJ2ZXIgcmVzcG9uZHMgb24gY29uZmlndXJlZCBwb3J0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2lzTGFuZ3VhZ2VUb29sUnVubmluZycsIGFzeW5jICgpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gbGFuZ3VhZ2VUb29sU2VydmVyLnBvcnQgfHwgODA4ODtcbiAgICAgICAgICAgIGNvbnN0IGhvc3RzID0gWycxMjcuMC4wLjEnLCAnOjoxJywgJ2xvY2FsaG9zdCddO1xuICAgICAgICAgICAgLy8gUnVuIGFsbCBjaGVja3MgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZSwgdXNlIGxvbmdlciB0aW1lb3V0IGZvciBzZXJ2ZXIgc3RhcnR1cCBkZXRlY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChob3N0cy5tYXAoaG9zdCA9PiBjaGVja1BvcnRPcGVuKHBvcnQsIGhvc3QsIDI1MDApKSk7XG4gICAgICAgICAgICAvLyBSZXR1cm4gZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHQsIG9yIGxhc3QgcmVzdWx0IGlmIG5vbmUgc3VjY2VlZGVkXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzUmVzdWx0ID0gcmVzdWx0cy5maW5kKHJlc3VsdCA9PiByZXN1bHQucnVubmluZyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCB8fCByZXN1bHRzW3Jlc3VsdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBMT0NBTCBMb2NrZG93blxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9jYWxsb2NrZG93bicsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9jYWxsb2NrZG93bjogbG9ja2luZyBkb3duIGNsaWVudCB3aXRob3V0IHRlYWNoZXIgY29ubmVjdGlvblwiKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge1xuICAgICAgICAgICAgICAgIGV4YW1tb2RlOiB0cnVlLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGVsZm9sZGVyb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiAnZGUtREUnLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0VHlwZTogJycsXG4gICAgICAgICAgICAgICAgbW9vZGxlRG9tYWluOiAnJyxcbiBcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDAsXG4gICAgICAgICAgICAgICAgbXNPZmZpY2VGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zbG9ja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwaW46ICcwMDAwJyxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVubG9ja29uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZm9udGZhbWlseTogJ3NhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RJZDogJycsXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXJncy5wYXNzd29yZCxcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVzZUV4YW1TZWN0aW9uczogZmFsc2UsIC8vaWYgZmFsc2UgZXhhbSBzZWN0aW9uIDEgaXMgdXNlZCBhbmQgbm8gdGFicyBhcmUgZGlzcGxheWVkXG4gICAgICAgICAgICAgICAgYWN0aXZlU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBsb2NrZWRTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGV4YW1TZWN0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAxOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtdHlwZTogYXJncy5leGFtbW9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNtYXJnaW46IHsgc2lkZTogJ3JpZ2h0Jywgc2l6ZTogMyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXNwYWNpbmc6ICcyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvUmVwZWF0OiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBhcmdzLmxhbmd1YWdldG9vbCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiBhcmdzLnNwZWxsY2hlY2tsYW5nIHx8ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogYXJncy5zdWdnZXN0aW9ucyB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBhcmdzLmNsaWVudG5hbWU7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gXCIxMjcuMC4wLjFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IFwibG9jYWxob3N0XCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IFwiYVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gdHJ1ZTsgLy8gdGhpcyBtdXN0IGJlIHNldCB0byB0cnVlIGluIG9yZGVyIHRvIHN0b3AgdHlwaWNhbCBuZXh0LWV4YW0gY2xpZW50L3RlYWNoZXIgYWN0aW9uc1xuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGxvY2FsbG9ja2Rvd25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHZpcnR1YWxpemVkIHN0YXR1c1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ZpcnR1YWxpemVkJywgKCkgPT4geyAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IHRydWU7IH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBGT0NVUyBzdGF0ZSB0byBmYWxzZSAobW91c2UgbGVmdCBleGFtIHdpbmRvdylcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZm9jdXNsb3N0JywgKGV2ZW50LCBjdHJsYWx0PWZhbHNlKSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFuc3dlciA9IGZhbHNlIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8ICF0aGlzLm11bHRpY2FzdENsaWVudC5leGFtbW9kZSkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWV9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID4gMCkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCAmJiBjdHJsYWx0ID09IGZhbHNlKXsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBmb2N1c2xvc3Q6IG1vdXNlbGVhdmUgZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBibG9jayBldmVyeXRoaW5nIGFuZCBpbmZvcm0gdGVhY2hlciAgKHByb2JhYmx5IGFuIG92ZXJraWxsIG9uIG1vdXNlbGVhdmUgLSBuZWVkcyB0ZXN0aW5nKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBhbnN3ZXJcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBtYWluIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29uZmlnICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIFVubG9jayBDb21wdXRlclxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ3JhY2VmdWxseWV4aXQnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ3JhY2VmdWxseWV4aXQ6IGdyYWNlZnVsbHkgbGVhdmluZyBsb2NrZWQgZXhhbSBtb2RlYClcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5ncmFjZWZ1bGx5RW5kRXhhbSgpIFxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgfSApXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogc3RvcCByZXN0cmljdGlvbnNcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RyaWN0aW9ucycsICgpID0+IHsgIFxuICAgICAgICAgICAgLy90aGlzIGFsc28gc3RvcHMgdGhlIGNsZWFyQ2xpcGJvYXJkIGludGVydmFsXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSBcbiAgICAgICAgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBjb3B5IHRvIGdsb2JhbCBjbGlwYm9hcmRcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NsaXBib2FyZCcsIChldmVudCwgdGV4dCkgPT4geyAgXG4gICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGxldCBhZGRyZXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkgeyAgICBhZGRyZXNzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogbXVsdGljYXN0Y2xpZW50IG5vdCBydW5uaW5nXCIpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMgYmVyZWl0cyBlaW5lIEFkcmVzc2Ugdm9yaGFuZGVuIGlzdCwgbGllZmVybiB3aXIgc2llIHp1clx1MDBGQ2NrLlxuICAgICAgICAgICAgaWYgKGFkZHJlc3MpIHsgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7ICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcnN1Y2hlLCBhbiBkaWUga29ycmVrdGUgU2Nobml0dHN0ZWxsZSB6dSBiaW5kZW5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRmFsbHMgZ2F0ZXdheTRzeW5jKCkgYmxvY2tpZXJlbmQgaXN0LCBrYW5uc3QgZHUgZGllc2VuIEF1ZnJ1ZiBpbiBlaW4gUHJvbWlzZSBwYWNrZW46XG4gICAgICAgICAgICAgICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlIH0gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnYXRld2F5NHN5bmMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHsgIHJlamVjdChlcnIpOyAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKTsgLy8gTGllZmVydCBkaWUgSVAgZGVyIFNjaG5pdHRzdGVsbGUsIHdlbGNoZSBkYXMgRGVmYXVsdCBHYXRld2F5IGhhdFxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGtlaW5lIElQIChtaXQgR2F0ZXdheSkgdmVyZlx1MDBGQ2diYXIgaXN0LCBob2xlIGVpbmUgYWx0ZXJuYXRpdmUgQWRyZXNzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCk7IC8vIExpZWZlcnQgYXVjaCBlaW5lIElQLCB3ZW5uIGtlaW4gR2F0ZXdheSB2ZXJmXHUwMEZDZ2JhciBpc3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJmXHUwMEU0bHNjaHRlIEFkcmVzc2VuICh6LiBCLiBsb2NhbGhvc3QpIGlnbm9yaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT09IFwiMTI3LjAuMC4xXCIpIHsgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7ICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBXZW5uIGRpZSBNdWx0aWNhc3QtQ2xpZW50IG5pY2h0IGxcdTAwRTR1ZnQsIGluaXRpYWxpc2llcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmICFhZGRyZXNzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmFsbHMgaW5pdCgpIGFzeW5jaHJvbiB1bWdlc2V0enQgd2VyZGVuIGthbm4sIHdhcnRlbiB3aXIgaGllciBkYXJhdWYuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBFcnJvciBpbml0aWFsaXppbmcgbXVsdGljYXN0IGNsaWVudFwiLCBlcnIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIGVkaXRvciBhcyBodG1sIGZpbGUgLSBhcyBiYWNrdXAgLSBvbmx5IHRyaWdnZXJlZCBieSB0aGUgdGVhY2hlciBmb3Igbm93IChhbGxvdyBtYW51YWwgYmFja3VwICEhKVxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAge2NsaWVudG5hbWU6dGhpcy5jbGllbnRuYW1lLCBmaWxlbmFtZTpgJHtmaWxlbmFtZX0uaHRtbGAsIGVkaXRvcmNvbnRlbnQ6IGVkaXRvcmNvbnRlbnQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVIVE1MJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBodG1sQ29udGVudCA9IGFyZ3MuZWRpdG9yY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBsZXQgaHRtbGZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSl7XG4gICAgICAgICAgICAgICAgaHRtbGZpbGVuYW1lID0gYCR7ZmlsZW5hbWV9LmJha2BcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBjcmVhdGluZyBtYW51YWwgYmFja3VwIGFzICR7aHRtbGZpbGVuYW1lfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGh0bWxmaWxlID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGh0bWxmaWxlbmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChodG1sQ29udGVudCkgeyBcbiAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXI6IHN0b3JlSFRNTDogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShodG1sZmlsZSwgaHRtbENvbnRlbnQsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiAke2Vyci5tZXNzYWdlfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhbHRlcm5hdGVwYXRoID0gYCR7aHRtbGZpbGV9LSR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn0uYmFrYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogdHJ5aW5nIHRvIHdyaXRlIGZpbGUgYXM6XCIsIGFsdGVybmF0ZXBhdGggKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShhbHRlcm5hdGVwYXRoLCBodG1sQ29udGVudCwgZnVuY3Rpb24gKGVycikgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBiYXNlNjQgZW5jb2RlZCBwZGYgZnJvbSBlZGl0b3JcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UERGYmFzZTY0JywgYXN5bmMgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRQREZiYXNlNjQ6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIgPSBhcmdzLnN1Ym1pc3Npb25udW1iZXIrMSAvLyBjbGllbnRpbmZvIGtlZXBzIHRyYWNrIG9mIHN1Ym1pc3Npb25zIGZvciBhdXRvbWF0ZWQgc3VibWlzc2lvbm51bWJlcnMgYXQgc2VjdGlvbiBjaGFuZ2UgLSBidXQgdGhpcyBvYnZpb3VzbHkgaGFwcGVucyBhZnRlciBtYW51YWwgc3VibWl0XG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5nZXRCYXNlNjRQREYoYXJncy5zdWJtaXNzaW9ubnVtYmVyLCBhcmdzLnNlY3Rpb25uYW1lLCBhcmdzLnByaW50QmFja2dyb3VuZCkgICAvLyB3aHkgdGhlIGhlbGwgaXMgdGhpcyBmdW5jdGlvbiBsb2NhdGVkIGluIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGFuZCBub3QgaW4gaXBjaGFuZGxlci5qcyA/IEZJWE1FICFcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIHRoZSBFeGFtV2luZG93IGNvbnRlbnQgYXMgUERGXG4gICAgICAgICAqIEFUVEVOVElPTiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIHRoYXQgYWxzbyBnZW5lcmF0ZXMgYSBwZGYgYnV0IHJldHVucyBhIGJhc2U2NCB2ZXJzaW9uIG9mIHRoZSBwZGZcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdwcmludHBkZicsIChldmVudCwgYXJncykgPT4geyBcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcmludCBpZiBleGFtIG1vZGUgaXMgbm90IGFjdGl2ZSBhbnltb3JlXG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvPy5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGV4YW1tb2RlIGlzIGZhbHNlIC0gc2tpcHBpbmcgcHJpbnRcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcmludGluZ1BkZil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHByaW50IGFscmVhZHkgaW4gcHJvZ3Jlc3MgLSBza2lwcGluZyBuZXcgcmVxdWVzdFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IC8vIGRlZmluZSBwcmludCBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbnM6IHt0b3A6MC41LCByaWdodDowLCBib3R0b206MC41LCBsZWZ0OjAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGxhbmRzY2FwZTogYXJncy5sYW5kc2NhcGUsXG4gICAgICAgICAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJGb290ZXI6dHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7YXJncy5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHthcmdzLmNsaWVudG5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCBwZGZmaWxlbmFtZSA9IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0ucGRmYCAgLy8gZGVmYXVsdCBmaWxlbmFtZSA9IGNsaWVudG5hbWUucGRmXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MuZmlsZW5hbWUpeyAgLy8gaW4gY2FzZSBvZiBtYW51YWwgYmFja3VwIHRoZSB1c2VyIGNhbiBzZXQgYSBjdXN0b20gZmlsZW5hbWVcbiAgICAgICAgICAgICAgICAgICAgcGRmZmlsZW5hbWUgPSBgJHthcmdzLmZpbGVuYW1lfS5wZGZgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGNyZWF0aW5nIG1hbnVhbCBiYWNrdXAgYXMgJHtwZGZmaWxlbmFtZX1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwZGZmaWxlcGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBwZGZmaWxlbmFtZSk7ICAvLyBwYXRoIHBvaW50cyB0byB0aGUgY3VycmVudCBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZWZpbGVuYW1lID0gYCR7cGRmZmlsZW5hbWV9LWF1eC5wZGZgICAgIC8vdGhvbWFzLnBkZi1hdXgucGRmIFxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZWJhY2t1cGZpbGVuYW1lID0gYCR7cGRmZmlsZW5hbWV9LW9sZC5wZGZgOyAgIC8vdGhvbWFzLnBkZi1vbGQucGRmXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlcGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGVmaWxlbmFtZSk7ICAvLyBpZiBzb21ldGhpbmcgZ29lcyB3cm9uZyB3ZSB0cnkgdG8gd3JpdGUgYSBkaWZmZXJlbnQgZmlsZVxuXG5cbiAgICAgICAgICAgICAgICAvLyBhdXggZmlsZXMgYXJlIGZpbGVzIGNyZWF0ZWQgaWYgdGhlIG1haW4gcGRmZmlsZXBhdGggaXMgbm90IHdyaXRlYWJsZSAob3BlbmVkIG9uIHdpbmRvd3MpIFxuICAgICAgICAgICAgICAgIHRyeSB7ICAvLyBhbHdheXMgY2hlY2sgZm9yIG9sZCBhdXggZmlsZXMgYW5kIHJlbmFtZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gYWx0ZXJuYXRlZmlsZW5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWJhY2t1cGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5yZW5hbWVTeW5jKGFsdGVybmF0ZXBhdGgsIG5ld1BhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX1gKTsgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgICAgIGNvbnN0IHdlYkNvbnRlbnRzID0gZXhhbVdpbmRvdz8ud2ViQ29udGVudHNcblxuICAgICAgICAgICAgICAgIGlmICghd2ViQ29udGVudHMpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IG5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwibm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIiAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IHRydWVcblxuICAgICAgICAgICAgICAgIC8vIHByaW50IHRoZSBleGFtIHdpbmRvdyB0byBwZGZcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIHBkZiBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICB0cnkgeyBpZiAoZnMuZXhpc3RzU3luYyhwZGZmaWxlcGF0aCkpIHsgZnMudW5saW5rU3luYyhwZGZmaWxlcGF0aCk7IH19XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX1gKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKHBkZmZpbGVwYXRoLCBkYXRhLCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9IC0gd3JpdGluZyBmaWxlIGFzOiAke2FsdGVybmF0ZXBhdGh9IGApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBhdXggZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBpZiAoZnMuZXhpc3RzU3luYyhhbHRlcm5hdGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKGFsdGVybmF0ZXBhdGgpOyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmIChhbHRlcm5hdGl2ZXIgUGZhZCk6ICR7ZXJyLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBhbHRlcm5hdGUgcGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShhbHRlcm5hdGVwYXRoLCBkYXRhLCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5yZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5yZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIikgICAvL21ha2Ugc3VyZSBzdHVkZW50cyBzZWUgdGhlIG5ldyBmaWxlIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyb3IubWVzc2FnZX1gKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnJvci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICB9KS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2F2ZXMgQWN0aXZlIFNoZWV0cyBmb3JtIGRhdGEgdG8gLmJhayBmaWxlXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzYXZlQWN0aXZlc2hlZXRzQmFrJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVuYW1lID0gYXJncy5maWxlbmFtZSA/IGAke2FyZ3MuZmlsZW5hbWV9LmJha2AgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2A7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYmFrRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENvbnZlcnQgZm9ybURhdGEgdG8gSlNPTiBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBqc29uRGF0YSA9IEpTT04uc3RyaW5naWZ5KGFyZ3MuZm9ybURhdGEsIG51bGwsIDIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFdyaXRlIHRvIC5iYWsgZmlsZVxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmFrRmlsZVBhdGgsIGpzb25EYXRhLCAndXRmOCcpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0Jhazogc2F2ZWQgZm9ybSBkYXRhIHRvICR7YmFrRmlsZW5hbWV9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogZXJyb3IubWVzc2FnZSwgc3RhdHVzOiBcImVycm9yXCIgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYWxsIGZvdW5kIFNlcnZlcnMgYW5kIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGlzIGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRpbmZvYXN5bmMnLCBhc3luYyAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSBmYWxzZSAgIFxuICAgICAgICAgICAgLy8gc2VydmVyc3RhdHVzIG9iamVrdCB3aXJkIG51ciBiZWkgYmVnaW5uIGRlcyBleGFtcyBhbiBkYXMgZXhhbSB3aW5kb3cgZHVyY2hnZXJlaWNodCBmXHUwMEZDciBiYXNpcyBlaW5zdGVsbHVuZ2VuXG4gICAgICAgICAgICAvLyBhbGxlIHdlaXRlcmVuIHVwZGF0ZXMgXHUwMEZDYmVyIGRhcyBzZXJ2ZXJzdGF0dXMgb2JqZWN0IHdlcmRlbiBpbSBjb21tdW5pY2F0aW9uIGhhbmRsZXIgZ2VsZXNlbiB1bmQgZ2dmLiBhdWYgZGFzIGNsaWVudGluZm8gb2JqZWN0IGdlbGVndFxuICAgICAgICAgICAgLy8gZGllc2VyIGtvbW11bmlrYXRpb25zZmx1c3MgbXVzcyBpbiAyLjAgZ2VzdHJlYW1saW5lZCB3ZXJkZW4gI0ZJWE1FXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyBzZXJ2ZXJzdGF0dXMgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXJ2ZXJzdGF0dXMgfVxuXG4gICAgICAgICAgICAvL2NvdW50IG51bWJlciBvZiBmaWxlcyBpbiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcih3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgLy8gZXJzdGVsbHQgZmFsbHMgblx1MDBGNnRpZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlbGlzdCA9IChhd2FpdCBmcy5wcm9taXNlcy5yZWFkZGlyKHdvcmtkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuXG5cbiAgICAgICAgICAgIHJldHVybiB7ICAgXG4gICAgICAgICAgICAgICAgc2VydmVybGlzdDogdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbVNlcnZlckxpc3QsXG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJzdGF0dXM6IHNlcnZlcnN0YXR1c1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGJlY2F1c2Ugb2YgbWljcm9zb2Z0IDM2NSB3ZSBuZWVkIHRvIHdvcmsgd2l0aCBcIkJyb3dzZXJWaWV3XCIgXG4gICAgICAgICAqIGluIG9yZGVyIHRvIGJlIGFibGUgdG8gZGlzbGF5IGZ1bGxzY3JlZW4gaW5mb3JtYXRpb24gZnJvbSB0aGUgRXhhbSBoZWFkZXIgd2UgdGVtcG9yYXJpbHkgY29sbGFwc2UgdGhlIEJyb3dzZXJWaWV3IGZvciBPZmZpY2VcbiAgICAgICAgICogYW5kIHJlc3RvcmUgaXQgYWZ0ZXJ3YXJkcyAtIG5vdCBwZXJmZWN0IGJ1dCBsb29rcyBva1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NvbGxhcHNlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoeyB4OiAwLCB5OiAwLCB3aWR0aDogMCwgaGVpZ2h0OiAwIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgICAgICBpcGNNYWluLm9uKCdyZXN0b3JlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBtZW51SGVpZ2h0ID0gbWFpbldpbmRvdy5tZW51SGVpZ2h0O1xuICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTsgLy8gR2V0IHRoZSBjdXJyZW50IGJvdW5kcyBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBuZXcgYm91bmRzIG9mIHRoZSBjb250ZW50Vmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IG1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCwgLy8gZnVsbCB3aWR0aCBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIG1lbnVIZWlnaHQgLy8gcmVtYWluaW5nIGhlaWdodCBhZnRlciB0aGUgbWVudVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGUgbWVudSBoZWlnaHQgZHluYW1pY2FsbHkgd2hlbiBoZWFkZXIgY29udGVudCBjaGFuZ2VzXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCd1cGRhdGUtbWVudS1oZWlnaHQnLCAoZXZlbnQsIGhlaWdodCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93O1xuICAgICAgICAgICAgaWYgKG1haW5XaW5kb3cgJiYgaGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc3RvcmVkIG1lbnUgaGVpZ2h0XG4gICAgICAgICAgICAgICAgbWFpbldpbmRvdy5tZW51SGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFJlcG9zaXRpb24gdGhlIGJyb3dzZXIgdmlldyB3aXRoIG5ldyBoZWlnaHRcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudFZpZXcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB5OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZW5kcyBhIHJlZ2lzdGVyIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHNlcnZlciBpcFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgY2xpZW50bmFtZTp0aGlzLnVzZXJuYW1lLCBzZXJ2ZXJuYW1lOnNlcnZlcm5hbWUsIHNlcnZlcmlwLCBzZXJ2ZXJpcCwgcGluOnRoaXMucGluY29kZSBcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3JlZ2lzdGVyJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjbGllbnRuYW1lID0gYXJncy5jbGllbnRuYW1lXG4gICAgICAgICAgICBjb25zdCBwaW4gPSBhcmdzLnBpblxuICAgICAgICAgICAgY29uc3Qgc2VydmVyaXAgPSBhcmdzLnNlcnZlcmlwXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJuYW1lID0gYXJncy5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBjb25zdCBjbGllbnRpcCA9IGlwLmFkZHJlc3MoKVxuICAgICAgICAgICAgY29uc3QgaG9zdG5hbWUgPSBvcy5ob3N0bmFtZSgpXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gdGhpcy5jb25maWcudmVyc2lvblxuICAgICAgICAgICAgY29uc3QgYmlwdXNlcklEID0gYXJncy5iaXB1c2VySURcblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4peyAvLyNGSVhNRSBkYXMgc29sbHRlIGVpZ2VudGxpY2ggdm9tIHNlcnZlciBrb21tZW4gXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWxyZWFkeXJlZ2lzdGVyZWRcIiksIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9yZWdpc3RlcmNsaWVudC8ke3NlcnZlcm5hbWV9LyR7cGlufS8ke2NsaWVudG5hbWV9LyR7Y2xpZW50aXB9LyR7aG9zdG5hbWV9LyR7dmVyc2lvbn0vJHtiaXB1c2VySUR9YDtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IEFib3J0U2lnbmFsLnRpbWVvdXQoODAwMCk7IC8vIDgwMDAgTWlsbGlzZWt1bmRlbiA9IDggU2VrdW5kZW4gQWJvcnRTaWduYWwgbWl0IGVpbmVtIFRpbWVvdXRcblxuXG4gICAgICAgICAgICBmZXRjaCh1cmwsIHsgbWV0aG9kOiAnR0VUJywgc2lnbmFsIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIFxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT0gXCJzdWNjZXNzXCIpIHsgIC8vIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsbCBvdGhlcndpc2UgZGF0YSB3b3VsZCBiZSBcImZhbHNlXCJcbiAgICAgICAgICAgICAgICAgICAgLy8gRXJmb2xncmVpY2hlIFJlZ2lzdHJpZXJ1bmdcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lID0gY2xpZW50bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IHNlcnZlcmlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBzZXJ2ZXJuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmlwID0gY2xpZW50aXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaG9zdG5hbWUgPSBob3N0bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGRhdGEudG9rZW47IC8vIHdlIG5lZWQgdG8gc3RvcmUgdGhlIGNsaWVudCB0b2tlbiBpbiBvcmRlciB0byBjaGVjayBhZ2FpbnN0IGl0IGJlZm9yZSBwcm9jZXNzaW5nIGNyaXRpY2FsIGFwaSBjYWxsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5waW4gPSBwaW47XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6IHN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIGF0ICR7c2VydmVybmFtZX0gQCAke3NlcnZlcmlwfSBhcyAke2NsaWVudG5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gZGF0YTtcblxuICAgICAgICAgICAgICAgICAgICAvL2NyZWF0ZSBleGFtIGZvbGRlciBpbiB3b3JrZm9sZGVyXG4gICAgICAgICAgICAgICAgICAgIGxldCB1bmlxdWVleGFtTmFtZSA9IGAke3NlcnZlcm5hbWV9LSR7cGlufWBcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLmV4YW1kaXJlY3RvcnkgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHVuaXF1ZWV4YW1OYW1lKVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLnZlcnNpb24pe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29tcGFyZSB2ZXJzaW9ucyBhbmQgZGlzcGxheSBtZXNzYWdlICh0ZWFjaGVyIG5lZWRzIHVwZ3JhZGUuLiBjbGllbnQgbmVlZHMgdXBncmFkZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhcmlzb25SZXN1bHQgPSB0aGlzLmNvbXBhcmVTb2Z0d2FyZShjb25maWcudmVyc2lvbiwgY29uZmlnLmluZm8gLCBkYXRhLnZlcnNpb24sIGRhdGEudmVyc2lvbmluZm8gKSAvL3NlcnZlclZlcnNpb24sIHNlcnZlclN0YXR1cywgbG9jYWxWZXJzaW9uLCBsb2NhbFN0YXR1c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7ICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgbmV1ZXIgYWxzIGRpZSBkZXIgTGVocnBlcnNvbiFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkgeyAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCB6dSBhbHQuIExhZGVuIHNpZSBzaWNoIGVpbmUgYWt0dWVsbGUgVmVyc2lvbiBoZXJ1bnRlciFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVuYmVrYW5udGVyIEZlaGxlciBiZWltIFZlcmJpbmR1bmdzYXVmYmF1LlwiIH07ICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goYXN5bmMgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEZlaGxlcmJlaGFuZGx1bmdcbiAgICAgICAgICAgICAgICBsZXQgZXJyb3JNZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7IGVycm9yTWVzc2FnZSA9IFwiVGhlIHJlcXVlc3QgdGltZWQgb3V0XCI7ICAgfSAvLyBUaW1lb3V0LU5hY2hyaWNodCBhbnBhc3NlbiBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCByZWdpc3RlcjogJHtlcnJvck1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gb24gbWFjb3MgdGhlIHBlcm1pc3Npb24gc2V0dGluZ3MgaW4gcmFyZSBjYXNlcyBtZXNzIHVwIHRoZSBhYmlsaXR5IHRvIGZldGNoIHRoZSB0ZWFjaGVyIGFwaSBcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBmb3IgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIil7ICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgdGhpcy5jb25maWcuc2VydmVyQXBpUG9ydCk7IFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UgPT09IFwicmVzZXRcIikgeyAgIC8vIHF1aXQgdGhlIGFwcCBpZiB0aGUgdXNlciB3YW50cyB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzaG93IHdhcm5pbmcgbWVzc2FnZSBpZiB0aGUgdXNlciBkb2VzIG5vdCB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXMgZ2lidCBlaW4gUHJvYmxlbSBtaXQgZGVtIE5ldHp3ZXJrLCBkZW4gRmlyZXdhbGxyZWdlbG4gb2RlciBkZW4gTmV0endlcmtiZXJlY2h0aWd1bmdlbiEgQml0dGUgYmVoZWJlbiBzaWUgZGllc2VzIFByb2JsZW0gdW5kIHN0YXJ0ZW4gU2llIE5leHQtRXhhbSBuZXUhXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gR2VvZ2VicmEgYXMgZ2diIGZpbGUgLSBhcyBiYWNrdXAgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCwgY29udGVudDogYmFzZTY0IH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzYXZlR0dCJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXJncy5jb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IGFyZ3MucmVhc29uXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICBpZiAoY29udGVudCkgeyBcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHNhdmVHR0I6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IEJ1ZmZlci5mcm9tKGNvbnRlbnQsICdiYXNlNjQnKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZ2diRmlsZVBhdGgsIGZpbGVEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlc3RvcmVkXCIpICwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyKSAgXG4gICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlR0dCOiAke2Vycn1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogbG9hZCBjb250ZW50IGZyb20gZ2diIGZpbGUgYW5kIHNlbmQgaXQgdG8gdGhlIGZyb250ZW5kIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3QgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2xvYWRHR0InLCAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFJlYWQgdGhlIGZpbGUgYW5kIGNvbnZlcnQgaXQgdG8gYmFzZTY0XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZ2diRmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2U2NEdnYkZpbGUgPSBmaWxlRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OmJhc2U2NEdnYkZpbGUsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfSAgICAgXG4gICAgICAgIH0pXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogR0VUIFBERiBvciBJTUFHRSBmcm9tIEVYQU0gZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0cGRmYXN5bmMnLCAoZXZlbnQsIGZpbGVuYW1lLCBpbWFnZSA9IGZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoaW1hZ2UpeyByZXR1cm4gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7ICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH0gICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJldHVybnMgYmFzZTY0IHN0cmluZyBvZiBhdWRpb2ZpbGUgZnJvbSB3b3JrZGlyZWN0b3J5IG9yIHB1YmxpYyBkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRBdWRpb0ZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBwdWJsaWNkaXI9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKTtcbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgIXB1YmxpY2RpcikgeyAvLyBSZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3JcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpciwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmIHB1YmxpY2Rpcikge1xuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vLi4vcHVibGljXCIsZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiBcblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEZJTEUtTElTVCBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRmaWxlc2FzeW5jJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgYXVkaW89ZmFsc2UsIGRvY3g9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG5cbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlJlY2VpdmVkIGFyZ3VtZW50czpcIiwgZmlsZW5hbWUsIGF1ZGlvLCBkb2N4KTtcblxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuXG4gICAgICAgICAgICAgICAgaWYgKGF1ZGlvID09IHRydWUpeyAvLyBhdWRpbyBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkb2N4KXsgIC8vb2ZmaWNlIG9wZW4geG1sIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IG1hbW1vdGguY29udmVydFRvSHRtbCh7cGF0aDogZmlsZXBhdGh9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7ICAgLy9iYWsgZmlsZVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIC8vIHJldHVybiBmaWxlIGxpc3Qgb2YgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2RpcikpeyBmcy5ta2RpclN5bmMod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7ICB9IC8vZG8gbm90IGNyYXNoIGlmIHRoZSBkaXJlY3RvcnkgaXMgZGVsZXRlZCBhZnRlciB0aGUgYXBwIGlzIHN0YXJ0ZWQgXl5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVsaXN0ID0gIGZzLnJlYWRkaXJTeW5jKHdvcmtkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgIGZpbGVsaXN0LmZvckVhY2goIGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZGlmaWVkID0gZnMuc3RhdFN5bmMoICAgcGF0aC5qb2luKHdvcmtkaXIsZmlsZSkgICkubXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2QgPSBtb2RpZmllZC5nZXRUaW1lKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBkZlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwicGRmXCIsIG1vZDogbW9kfSkgICB9ICAgICAgICAgLy9wZGZcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuYmFrXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJiYWtcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGJhY2t1cCBmaWxlIHRvIHJlcGxhY2UgZWRpdG9yIGNvbnRlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZG9jeFwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZG9jeFwiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgY29udGVudCBmaWxlIChmcm9tIHRlYWNoZXIpIHRvIHJlcGxhY2UgY29udGVudCBhbmQgY29udGludWUgd3JpdGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5nZ2JcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImdnYlwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gZ2VvZ2VicmFcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIubXAzXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm9nZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi53YXZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJhdWRpb1wiLCBtb2Q6IG1vZH0pICAgfSAgLy8gYXVkaW9cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuanBnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBuZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5naWZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJpbWFnZVwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBCQUNLVVAgRklMRSBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGZpbGVuYW1lIHdpdGhvdXRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0YmFja3VwZmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogUmVxdWVzdCByZWNlaXZlZCBmb3IgZmlsZW5hbWU6ICR7ZmlsZW5hbWV9YClcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBGdWxsIGZpbGUgcGF0aDogJHtmaWxlcGF0aH1gKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlcGF0aCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBub3QgZm91bmQ6ICR7ZmlsZXBhdGh9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgZXhpc3RzLCByZWFkaW5nIGNvbnRlbnRgKVxuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFN1Y2Nlc3NmdWxseSByZWFkIGJhY2t1cCBmaWxlLCBjb250ZW50IGxlbmd0aDogJHtkYXRhLmxlbmd0aH1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHJlYWRpbmcgYmFja3VwIGZpbGU6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3Igc3RhY2s6ICR7ZXJyLnN0YWNrfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogbm8gZmlsZW5hbWUgcHJvdmlkZWRgKTsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGlwY01haW4ub24oJ3JlbG9hZC11cmwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVFYXN0ZXJXaW4oKVxuICAgICAgICB9KTtcblxuICAgICAgICAgLyoqXG4gICAgICAgICAqIEFwcGVuZCBQcmludFJlcXVlc3QgdG8gY2xpZW50aW5mbyAgXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc2VuZFByaW50UmVxdWVzdCcsIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSB0cnVlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlwY01haW4ub24oJ2dldC1jcHUtaW5mbycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmlzVmlydHVhbE1hY2hpbmUoKVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldC13bGFuLWluZm8nLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdsYW5JbmZvID0gYXdhaXQgZ2V0V2xhbkluZm8oKTtcbiAgICAgICAgICAgIHJldHVybiB3bGFuSW5mbztcbiAgICAgICAgfSk7XG5cblxuICAgICAgICBcbiAgICAgICAgLy8gTmV3IGhhbmRsZXIgdG8gZ2V0IFBERiBmcm9tIHB1YmxpYyBkaXJlY3RvcnkgZm9yIGZyb250ZW5kIHBhcnNpbmdcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBkZkZyb21QdWJsaWMnLCBhc3luYyAoZXZlbnQsIHBkZkZpbGVuYW1lICkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgZGlyZWN0b3J5IG5hbWUgaW4gRVNNXG4gICAgICAgICAgICAgICAgY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgcGRmUGF0aDtcbiAgICAgICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRnJvbSBzY3JpcHRzLyBnbyB1cCAzIGxldmVscyB0byByZWFjaCBzdHVkZW50LyB0aGVuIHB1YmxpYy9cbiAgICAgICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwZGZQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IFBERiBub3QgZm91bmQgYXQ6ICR7cGRmUGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYyhwZGZQYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cbiAgICB9XG5cbiAgICBpc1ZpcnR1YWxNYWNoaW5lKCkge1xuICAgICAgICBjb25zdCBWRU5ET1JTID0gLyhvcmFjbGV8dmlydHVhbGJveHx2bXdhcmV8a3ZtfHFlbXV8eGVufGlubm90ZWt8cGFyYWxsZWxzfG1pY3Jvc29mdHxoeXBlci12fGJoeXZlfHJlZCBoYXR8cmVkaGF0fGJvY2hzfGJoeXZlfG9wZW5zdGFja3xjbG91ZHxhbWF6b258Z29vZ2xlfGF6dXJlKS9pIC8vIGNvbW1vbiBWTSBpZHNcbiAgICAgICAgY29uc3Qgd2FybkFuZFJldHVybiA9IHJlYXNvbiA9PiB7XG4gICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGlzVmlydHVhbE1hY2hpbmU6IFZlcmRhY2h0IGF1ZiBWTSAtICR7cmVhc29ufWApXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBMaW51eCAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNwdWluZm8gPSByZWFkRmlsZVN5bmMoJy9wcm9jL2NwdWluZm8nLCAndXRmOCcpICAgICAgLy8gQ1BVIGZsYWdzXG4gICAgICAgICAgICBpZiAoL15mbGFncy4qXFxiaHlwZXJ2aXNvclxcYi9tLnRlc3QoY3B1aW5mbykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdoeXBlcnZpc29yIGZsYWcgaW4gL3Byb2MvY3B1aW5mbycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gW1xuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvc3lzX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X25hbWUnLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF92ZXJzaW9uJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2JvYXJkX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9iaW9zX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9jaGFzc2lzX3ZlbmRvcidcbiAgICAgICAgICAgIF1cbiAgICAgICAgICAgIGNvbnN0IGRtaSA9IGZpbGVzLm1hcChwID0+IHsgdHJ5IHsgcmV0dXJuIHJlYWRGaWxlU3luYyhwLCAndXRmOCcpIH0gY2F0Y2ggeyByZXR1cm4gJycgfSB9KS5qb2luKCcgJylcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoZG1pKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ0RNSS1WZW5kb3ItTWF0Y2gnKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBleGVjU3luYygnc3lzdGVtZC1kZXRlY3QtdmlydCAtcScsIHsgc3RkaW86ICdpZ25vcmUnIH0pICAgIC8vIGV4aXQgMCA9PiBWTVxuICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgbWVsZGV0IFZpcnR1YWxpc2llcnVuZycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLXNwZXppZmlzY2hlIEVya2VubnVuZ1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2ZlIGF1ZiBRRU1VLXNwZXppZmlzY2hlIEdlclx1MDBFNHRlXG4gICAgICAgICAgICBjb25zdCBxZW11RGV2aWNlcyA9IFtcbiAgICAgICAgICAgICAgJy9kZXYvdmhvc3QtdnNvY2snXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGRldmljZSBvZiBxZW11RGV2aWNlcykge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChyZXF1aXJlKCdmcycpLmV4aXN0c1N5bmMoZGV2aWNlKSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oYFFFTVUtR2VyXHUwMEU0dCBnZWZ1bmRlbjogJHtkZXZpY2V9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAvLyBQclx1MDBGQ2ZlIGF1ZiBRRU1VLVByb3plc3NlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID0gZXhlY1N5bmMoJ3BzIGF1eCB8IGdyZXAgLWkgcWVtdScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKHBzLmluY2x1ZGVzKCdxZW11JykgJiYgIXBzLmluY2x1ZGVzKCdncmVwJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyBsXHUwMEU0dWZ0JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIFdpbmRvd3MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiKEdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbSB8IEZvckVhY2gtT2JqZWN0IHsgJF8uTWFudWZhY3R1cmVyLCAkXy5Nb2RlbCB9KSAtam9pbiBcXCcgXFwnXCInXG4gICAgICAgICAgICBjb25zdCBiYXNpYyA9IGV4ZWNTeW5jKHBzLCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpICAgIC8vIG1hbnVmYWN0dXJlciArIG1vZGVsXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGJhc2ljKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9Nb2RlbGwgcGFzc3QgenUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHNSb2J1c3QgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkbz1AKCk7JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtOyRvKz1AKCRjcy5NYW51ZmFjdHVyZXIsJGNzLk1vZGVsKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJiPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CYXNlQm9hcmQ7JG8rPUAoJGJiLk1hbnVmYWN0dXJlciwkYmIuUHJvZHVjdCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiaW9zPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CSU9TOyRvKz1AKCRiaW9zLlNNQklPU0JJT1NWZXJzaW9uKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzcD1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW1Qcm9kdWN0OyRvKz1AKCRjc3AuTmFtZSl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAnV3JpdGUtT3V0cHV0ICgoJG8gLWpvaW4gXFwnIFxcJykuVHJpbSgpKVwiJ1xuICAgICAgICAgICAgY29uc3Qgcm9idXN0ID0gZXhlY1N5bmMocHNSb2J1c3QsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKClcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qocm9idXN0KSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9CSU9TLUluZm9zIHBhc3NlbiB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIC8vIFp1c1x1MDBFNHR6bGljaGUgUUVNVS1Fcmtlbm51bmcgZlx1MDBGQ3IgV2luZG93c1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBxZW11UHJvY2Vzc2VzID0gZXhlY1N5bmMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBxZW11KlwiJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICAgICAgaWYgKHFlbXVQcm9jZXNzZXMuaW5jbHVkZXMoJ3FlbXUnKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyB1bnRlciBXaW5kb3dzJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG5cbiAgICAgICAgIC8vIC0tLS0tLS0tLS0gbWFjT1MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBod01vZGVsID0gZXhlY1N5bmMoJ3N5c2N0bCAtbiBody5tb2RlbCcsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKC9edmlydHVhbC9pLnRlc3QoaHdNb2RlbCkgfHwgVkVORE9SUy50ZXN0KGh3TW9kZWwpKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1MgSGFyZHdhcmVtb2RlbGwgZGV1dGV0IGF1ZiBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IGV4ZWNTeW5jKCdzeXN0ZW1fcHJvZmlsZXIgU1BIYXJkd2FyZURhdGFUeXBlJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHNwKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIHN5c3RlbV9wcm9maWxlciBtZWxkZXQgVk0tVmVuZG9yJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAgICBcbiAgICB9XG5cbiAgICBjb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKSB7XG4gICAgICAgIGNvbnN0IHBhcnRzQSA9IHZlcnNpb25BLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgICAgIGNvbnN0IHBhcnRzQiA9IHZlcnNpb25CLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5tYXgocGFydHNBLmxlbmd0aCwgcGFydHNCLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbnVtQSA9IHBhcnRzQVtpXSB8fCAwOyAvLyBGYWxsYmFjayBhdWYgMCwgZmFsbHMga2VpbiBXZXJ0IHZvcmhhbmRlblxuICAgICAgICAgICAgY29uc3QgbnVtQiA9IHBhcnRzQltpXSB8fCAwO1xuICAgIFxuICAgICAgICAgICAgaWYgKG51bUEgPCBudW1CKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAobnVtQSA+IG51bUIpIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBcbiAgICBjb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCBudW1iZXJBID0gcGFyc2VJbnQoc3RhdHVzQS5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICAgICAgY29uc3QgbnVtYmVyQiA9IHBhcnNlSW50KHN0YXR1c0IubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgXG4gICAgICAgIGlmIChudW1iZXJBIDwgbnVtYmVyQikgcmV0dXJuIC0xO1xuICAgICAgICBpZiAobnVtYmVyQSA+IG51bWJlckIpIHJldHVybiAxO1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBjb21wYXJlU29mdHdhcmUodmVyc2lvbkEsIHN0YXR1c0EsIHZlcnNpb25CLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IHZlcnNpb25Db21wYXJpc29uID0gdGhpcy5jb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKTtcbiAgICAgICAgaWYgKHZlcnNpb25Db21wYXJpc29uICE9PSAwKSByZXR1cm4gdmVyc2lvbkNvbXBhcmlzb247XG4gICAgXG4gICAgICAgIHJldHVybiB0aGlzLmNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKTtcbiAgICB9XG5cblxufVxuIFxuZXhwb3J0IGRlZmF1bHQgbmV3IElwY0hhbmRsZXIoKVxuIiwgImltcG9ydCB7Y3JlYXRlSTE4bn0gZnJvbSAndnVlLWkxOG4nXG5cbmltcG9ydCBlbiBmcm9tICcuL2VuLmpzb24nXG5pbXBvcnQgZGUgZnJvbSAnLi9kZS5qc29uJ1xuXG5jb25zdCBpMThuID0gY3JlYXRlSTE4bih7XG4gICAgbG9jYWxlOiAnZGUnLFxuICAgIGZhbGxiYWNrTG9jYWxlOiAnZW4nLFxuICAgIG1lc3NhZ2VzOiB7XG4gICAgICAgIGVuLFxuICAgICAgICBkZVxuICAgICAgfVxuICB9KVxuXG5leHBvcnQgZGVmYXVsdCBpMThuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIlJlc3RvcmVcIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIkRpc2Nvbm5lY3RcIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkV4aXRcIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJFeGFtc1wiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiVXNlcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlciBhZGRyZXNzXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIkV4YW0gTmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiYWR2YW5jZWRcIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJzaW1wbGVcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwicmVnaXN0ZXJcIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcInJlZ2lzdGVyaW5nLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcInJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJjb25uZWN0ZWRcIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJkaXNjb25uZWN0ZWRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIG9uIHNlcnZlciEgXFxuXFxuUGxlYXNlIHdhaXQgZm9yIHRoZSBhY3RpdmF0aW9uIG9mIHRoZSBleGFtIG1vZGUgYnkgdGhlIHRlYWNoZXIhXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcInNlYXJjaCBzdGFydGVkXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIndyb25nIHVzZXJuYW1lIG9yIHBpblwiLFxuICAgICAgICBcIm5vdXNlclwiOlwibm8gdXNlcm5hbWUgZ2l2ZW5cIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRkcmVzc2Ugb2RlciBFeGFtbmFtZSBtaXNzaW5nXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIk5vIE5ldHdvcmsgQ29ubmVjdGlvblwiLFxuICAgICAgICBcIm5vcGluXCI6IFwibm8gcGluY29kZSBnaXZlblwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6XCJTZXJ2ZXIgQVBJIHVucmVhY2hhYmxlXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGlzIGJlaGluZCBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIk5vIFRlYWNoZXIgQVBJIGZvdW5kIG9uIHRoZSBnaXZlbiBhZGRyZXNzXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9jYWwgbG9ja2Rvd25cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVhbCBzZWFyY2hcIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJObyBleGFtcyBmb3VuZFwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGxvZ291dD9cIixcbiAgICAgICAgXCJkZVwiOiBcIkdlcm1hblwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJlbmNoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpYW5cIixcbiAgICAgICAgXCJzbFwiOlwiU2xvdmVuaWFuXCIsXG4gICAgICAgIFwibm9uZVwiOiBcIm5vbmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiU3BlbGxjaGVja1wiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWN0aXZhdGVcIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJTaG93IHN1Z2dlc3Rpb25zXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIlBsZWFzZSBjaG9vc2UgYSBsYW5ndWFnZVwiLFxuICAgICAgICBcImxhbmdcIjogXCJMYW5ndWFnZXNcIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpY3NcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlNlbGVjdCBleGFtIG1vZGVcIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJQbGVhc2UgaW5zdGFsbCB0aGUgc2FtZSB2ZXJzaW9uIGFzIHRoZSBleGFtIHNlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJzYWZlIGV4YW0gc3RhdHVzIGNoYW5nZWRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgYWxyZWFkeSByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcInN0YXJ0ZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwic3RvcHBlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcInNhZmUgZXhhbSBtb2RlIG5vdCBhY3RpdmVcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcInN0dWRlbnQgcmVtb3ZlZCBmcm9tIHNlcnZlclwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcImZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcImZpbGVzIHN0b3JlZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiZmlsZSBlcnJvclwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJwbGVhc2UgY2hlY2sgaWYgdGhlICdFWEFNLVNUVURFTlQnIGRpcmVjdG9yeSBpcyB3cml0ZWFibGUgYW5kIGhhcyBlbm91Z2ggc3BhY2VcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkEgbG9jYWwgYmFja3VwIGNvdWxkIG5vdCBiZSBjcmVhdGVkLiBQbGVhc2UgdXNlIHRoZSBtYW51YWwgc3VibWlzc2lvbiBvcHRpb24uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJkb24ndCBzaG93IGFnYWluXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBmb3VuZFwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIkdldCBtYXRlcmlhbHNcIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiU2VuZCBmaW5hbCBleGFtXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJGaW5hbCBzdWJtaXRcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbHM6XCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxvY2FsIGZpbGVzOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIlVwZGF0ZVwiLFxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwbGl0dmlld1wiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIllvdSBoYXZlIGxlZnQgdGhlIHNhZmUgZXhhbSBtb2RlIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiUGxlYXNlIGluZm9ybSBhIHRlYWNoZXIhXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiRG8geW91IHdhbnQgdG8gcmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGUgZWRpdG9yIHdpdGggdGhlIGNvbnRlbnQgb2YgXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQ2FuY2VsXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiUmVwbGFjZVwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwIGZpbGUgY291bGQgbm90IGJlIHJlYWRcIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgc3VjY2Vzc2Z1bGx5IGxvYWRlZFwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRXJyb3IgbG9hZGluZyBiYWNrdXAgZmlsZVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiU3VjY2Vzc1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiY2hhcnNcIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIndvcmRzXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwicmVjb25uZWN0XCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwidW5sb2NrXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkV4aXQgc2FmZSBleGFtIG1vZGU/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiRG8gbm90IGxlYXZlIHNhZmUgZXhhbSBtb2RlIHdpdGhvdXQgcGVybWlzc2lvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiSWYgdGhpcyBwcm9jZXNzIGZhaWxzIHVubG9jayBhbmQgdHJ5IGFnYWluIVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiQ3JlYXRpbmcgYmFja3VwXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiQ3JlYXRpbmcgYmFja3VwIGFuZCBjbGlwYm9hcmQgY29weVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJMZWF2aW5nIEV4YW0gbW9kZVwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcImJhY2t1cFwiLFxuICAgICAgICBcInVuZG9cIjpcInVuZG9cIixcbiAgICAgICAgXCJyZWRvXCI6XCJyZWRvXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImNsZWFyXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiYm9sZFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwiaXRhbGljXCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bmRlcmxpbmVcIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiaGVhZGluZzFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiaGVhZGluZzJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiaGVhZGluZzNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiaGVhZGluZzRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiaGVhZGluZzVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiaGVhZGluZzZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInN1YnNjcmlwdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJzdXBlcnNjcmlwdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcImJ1bGxldGxpc3RcIixcbiAgICAgICAgXCJsaXN0XCI6XCJsaXN0XCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJjb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJjb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiYmxvY2txdW90ZVwiLFxuICAgICAgICBcImxpbmVcIjpcInBhZ2VicmVha1wiLFxuICAgICAgICBcImxlZnRcIjpcImxlZnRcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcImNlbnRlclwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJyaWdodFwiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwidGV4dGNvbG9yXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJsaW5lYnJlYWtcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtb3JlXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcImluc2VydHRhYmxlXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcImRlbGV0ZXRhYmxlXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcImNvbHVtbmFmdGVyXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcInJvd2FmdGVyXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJkZWxjb2x1bW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcImRlbHJvd1wiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwibWVyZ2VvcnNwbGl0XCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJoZWFkZXJjb2x1bW5cIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcImhlYWRlcnJvd1wiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJzZWxlY3RlZCB3b3Jkcy9jaGFyc1wiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJwcmludCByZXF1ZXN0IHNlbnRcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJwcmludCByZXF1ZXN0IGRlbmllZFwiLFxuICAgICAgICBcInBhc3RlXCI6XCJwYXN0ZVwiLFxuICAgICAgICBcImNvcHlcIjpcImNvcHlcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwic3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiZGVhY3RpdmF0ZSBzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiUmVsb2FkXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvdWxkIHlvdSBsaWtlIHRvIHJlaW5pdGlhbGl6ZSB0aGUgRWRpdG9yP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJrZWVwIGNvbnRlbnRcIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiSW5zZXJ0IHNwZWNpYWxjaGFyYWN0ZXJcIixcbiAgICAgICAgXCJwcmludFwiOiBcInByaW50XCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJQbGF5IEF1ZGlvXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiRG8geW91IHdhbnQgdG8gcGxheSB0aGUgYXVkaW9maWxlP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJSZW1haW5pbmcgcGxheWJhY2tzOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiWW91IGRvbid0IGhhdmUgdGhlIHBlcm1pc3Npb24gdG8gcGxheSB0aGlzIGZpbGUhXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJJbnNlcnQgSW1hZ2VcIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIkluc2VydCBNdWdzaG90XCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiU2VuZCB3b3JrIHRvIHRlYWNoZXJcIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJDbG9zZVwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkV4aXQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkZpbGVuYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiUGxlYXNlIGVudGVyIG9ubHkgbGV0dGVycyBhbmQgbnVtYmVycyB3aXRob3V0IHNwZWNpYWwgY2hhcmFjdGVyc1wiLFxuICAgICAgICBcImNsZWFyXCI6IFwiY2xlYXIgY29udGVudD9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIk5vIHZhbGlkIFBERiBGaWxlXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIldyb25nIHBhc3N3b3JkXCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIlJlbG9hZCB3ZWJ2aWV3XCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJQb3NzaWJseSBzY2FubmVkIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJPblwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwibGVzcyB0aGFuIDIgaW50ZXJhY3RpdmUgZm9ybSBmaWVsZHMgd2VyZSBmb3VuZC5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJUaGlzIGluZGljYXRlcyB0aGF0IHRoaXMgaXMgYSBzY2FubmVkIFBERiB0aGF0IGRvZXMgbm90IGNvbnRhaW4gYWN0aXZlIGZvcm0gZmllbGRzIG9yIHRhYmxlcy5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVW5kZXJzdG9vZFwiLFxuICAgICAgICBcInBhZ2VcIjogXCJQYWdlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJQYWdlc1wiXG4gICAgfVxufVxuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIldpZWRlcmhlcnN0ZWxsZW5cIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIlZlcmJpbmR1bmcgdHJlbm5lblwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiQmVlbmRlblwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcnRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIlByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJCZW51dHplcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlci1BZHJlc3NlXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIlByXHUwMEZDZnVuZ3NuYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJmb3J0Z2VzY2hyaXR0ZW5cIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJlaW5mYWNoXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcImFubWVsZGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJtZWxkZSBhbi4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiVmVyYmluZHVuZyB1bnRlcmJyb2NoZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlNpZSBoYWJlbiBzaWNoIGVyZm9sZ3JlaWNoIGFtIFNlcnZlciByZWdpc3RyaWVydCEgXFxuXFxuQml0dGUgd2FydGVuIFNpZSBhdWYgZGllIEFrdGl2aWVydW5nIGRlcyBQclx1MDBGQ2Z1bmdzbW9kdXMgZHVyY2ggZGllIExlaHJwZXJzb24hXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcIlN1Y2hlIGdlc3RhcnRldFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJGYWxzY2hlciBCZW51dHplcm5hbWUgb2RlciBQaW5jb2RlXCIsXG4gICAgICAgIFwibm91c2VyXCI6IFwiQmVudXR6ZXJuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkcmVzc2Ugb2RlciBQclx1MDBGQ2Z1bmdzbmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJLZWluZSBOZXR6d2Vya3ZlcmJpbmR1bmdcIixcbiAgICAgICAgXCJub3BpblwiOiBcIlBpbmNvZGUgZmVobHRcIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOiBcIlNlcnZlciBBUEkgbmljaHQgZXJyZWljaGJhci5cIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgYmVmaW5kZXQgc2ljaCBtXHUwMEY2Z2xpY2hlcndlaXNlIGhpbnRlciBlaW5lciBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIktlaW5lIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgYW4gYW5nZWdlYmVuZXIgQWRyZXNzZVwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxva2FsIGFic3BlcnJlblwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWVsbCBzdWNoZW5cIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJLZWluZSBQclx1MDBGQ2Z1bmdlbiBnZWZ1bmRlblwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBzaWNoIGFibWVsZGVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJkZVwiOiBcIkRldXRzY2hcIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzY2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzY2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJhbnpcdTAwRjZzaXNjaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWVuaXNjaFwiLFxuICAgICAgICBcInNsXCI6XCJTbG93ZW5pc2NoXCIsXG4gICAgICAgIFwibm9uZVwiOiBcImFuZGVyZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJoaWxmZVwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWt0aXZpZXJlblwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlZvcnNjaGxcdTAwRTRnZSB6ZWlnZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgU3ByYWNoZSBmXHUwMEZDciBkaWUgUHJcdTAwRkNmdW5nXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIlNwcmFjaGVuXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWtcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlByXHUwMEZDZnVuZ3Ntb2R1cyBhdXN3XHUwMEU0aGxlblwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIkJpdHRlIGluc3RhbGxpZXJlbiBzaWUgZGllIHNlbGJlIFZlcnNpb24gd2llIGFtIFByXHUwMEZDZnVuZ3NzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IGdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgZ2VcdTAwRTRuZGVydFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIHVudGVyIGRpZXNlbSBOYW1lbiBiZXJlaXRzIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBuaWNodCBha3RpdlwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGVudGZlcm50XCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcIkRhdGVpZW4gZXJoYWx0ZW5cIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiRGF0ZWllbiBnZXNwZWljaGVydFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcIkZlaGxlciBiZWltIFNjaHJlaWJlbiBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwiQml0dGUgc3RlbGxlbiBTaWUgc2ljaGVyLCBkYXNzIGRhcyAnRVhBTS1TVFVERU5UJyBWZXJ6ZWljaG5pcyBmXHUwMEZDciBOZXh0LUV4YW0gc2NocmVpYmJhciBpc3QgdW5kIGdlblx1MDBGQ2dlbmQgU3BlaWNoZXJwbGF0eiB2b3JoYW5kZW4gaXN0LlwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiRWluZSBsb2thbGUgU2ljaGVydW5nIGtvbm50ZSBuaWNodCBlcnN0ZWxsdCB3ZXJkZW4uIE51dHplbiBTaWUgZGllIG1hbnVlbGxlIEFiZ2FiZSB1bSBJaHJlIEFyYmVpdCBkaXJla3QgYW4gZGllIExlaHJwZXJzb24genUgc2VuZGVuLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiTmljaHQgbWVociBhbnplaWdlblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZ2VmdW5kZW5cIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbiBob2xlblwiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJGaW5hbGUgQWJnYWJlIGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJBYmdhYmVcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbjpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJBa3R1YWxpc2llcmVuXCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxva2FsZSBEYXRlaWVuOlwiLFxuXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BhbHRlbmFuc2ljaHRcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJTaWUgaGFiZW4gZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdmVybGFzc2VuIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiTWVsZGVuIFNpZSBzaWNoIHVtZ2VoZW5kIGJlaSBkZXIgQXVmc2ljaHRzcGVyc29uIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIldvbGxlbiBTaWUgZGVuIEluaGFsdCBkZXMgRWRpdG9ycyBkdXJjaCBkZW4gSW5oYWx0IGRlciBEYXRlaVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcImVyc2V0emVuP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQWJicmVjaGVuXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiRXJzZXR6ZW5cIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cC1EYXRlaSBrb25udGUgbmljaHQgZ2VsZXNlbiB3ZXJkZW5cIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgZXJmb2xncmVpY2ggZ2VsYWRlblwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRmVobGVyIGJlaW0gTGFkZW4gZGVyIEJhY2t1cC1EYXRlaVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIkVyZm9sZ1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiWmVpY2hlblwiLFxuICAgICAgICBcIndvcmRzXCI6IFwiV1x1MDBGNnJ0ZXJcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJuZXUgdmVyYmluZGVuXCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwiZW50c3BlcnJlblwiLFxuICAgICAgICBcImV4aXRcIjogXCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiVmVybGFzc2VuIFNpZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyBuaWUgb2huZSBGcmVpZ2FiZSBlaW5lciBMZWhycGVyc29uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJTb2xsdGUgZGVyIFZvcmdhbmcgZmVobHNjaGxhZ2VuIGJlZW5kZW4gU2llIGJpdHRlIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHVuZCB2ZXJzdWNoZW4gU2llIGVzIGVybmV1dCFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIklocmUgQXJiZWl0IHd1cmRlIGVyZm9sZ3JlaWNoIGdlc2ljaGVydCFcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJEaWUgYWt0dWVsbGUgQXJiZWl0IHdpcmQgZ2VzaWNoZXJ0IHVuZCBpbiBkaWUgWndpc2NoZW5hYmxhZ2Uga29waWVydCFcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwic2ljaGVyblwiLFxuICAgICAgICBcInVuZG9cIjpcInJcdTAwRkNja2dcdTAwRTRuZ2lnXCIsXG4gICAgICAgIFwicmVkb1wiOlwid2llZGVyaG9sZW5cIixcbiAgICAgICAgXCJjbGVhclwiOlwibFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiZmV0dFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwia3Vyc2l2XCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bnRlcnN0cmljaGVuXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiXHUwMERDYmVyc2NocmlmdCAzXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiXHUwMERDYmVyc2NocmlmdCA2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJ0aWVmZ2VzdGVsbHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwiaG9jaGdlc3RlbGx0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwidW5nZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJsaXN0XCI6XCJnZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcIkNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcIkNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJaaXRhdFwiLFxuICAgICAgICBcImxpbmVcIjpcIlNlaXRlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJMaW5rc2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJaZW50cmllcnRcIixcbiAgICAgICAgXCJyaWdodFwiOlwiUmVjaHRzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcIlRleHRmYXJiZVwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwiWmVpbGVudW1icnVjaFwiLFxuICAgICAgICBcIm1vcmVcIjpcIm1laHJcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiVGFiZWxsZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcIlRhYmVsbGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcIlNwYWx0ZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcIlJlaWhlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcIlNwYWx0ZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcIlJlaWhlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwiVmVyZWluZW4gb2RlciBUZWlsZW5cIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcIlRpdGVsc3BhbHRlXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJUaXRlbHJlaWhlXCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcIldcdTAwRjZydGVyL1plaWNoZW4gaW4gQXVzd2FobFwiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJEcnVja2FuZnJhZ2UgZ2VzZW5kZXQhXCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwiRHJ1Y2thbmZyYWdlIGFiZ2VsZWhudC4gQml0dGUgd2FydGVuIHVuZCBlcm5ldXQgc2VuZGVuLlwiLFxuICAgICAgICBcInBhc3RlXCI6XCJlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiY29weVwiOlwia29waWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBkZWFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJOZXUgbGFkZW5cIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV29sbGVuIFNpZSBkZW4gVGV4dGVkaXRvciBuZXUgaW5pdGlhbGlzaWVyZW4/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcIkluaGFsdCBiZWliZWhhbHRlblwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJTb25kZXJ6ZWljaGVuIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJwcmludFwiOiBcImRydWNrZW5cIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIkF1ZGlvIGFic3BpZWxlblwiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIldvbGxlbiBTaWUgZGFzIEhcdTAwRjZyYmVpc3BpZWwgamV0enQgYWJzcGllbGVuP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJWZXJibGVpYmVuZGUgRHVyY2hsXHUwMEU0dWZlOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiU2llIGhhYmVuIGtlaW5lIEJlcmVjaHRpZ3VuZyBkaWUgQXVkaW9kYXRlaSBlcm5ldXQgYWJ6dXNwaWVsZW4hXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJCaWxkIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIk11Z3Nob3QgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIkFyYmVpdCBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIlNjaGxpZVx1MDBERmVuXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRGF0ZWluYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiQml0dGUgZ2ViZW4gU2llIG51ciBCdWNoc3RhYmVuIG9kZXIgWmFobGVuIGVpbi5cIixcbiAgICAgICAgXCJjbGVhclwiOiBcIkFsbGUgQmVyZWNobnVuZ2VuIGxcdTAwRjZzY2hlbj9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJLZWluZSBnXHUwMEZDbHRpZ2UgUERGIERhdGVpXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIkZhbHNjaGVzIFBhc3N3b3J0XCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIldlYnZpZXcgbmV1IGxhZGVuXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJNXHUwMEY2Z2xpY2hlcndlaXNlIGdlc2Nhbm50ZXMgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIkF1ZlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwid3VyZGVuIHdlbmlnZXIgYWxzIDIgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZ2VmdW5kZW4uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiRGllcyBkZXV0ZXQgZGFyYXVmIGhpbiwgZGFzcyBlcyBzaWNoIHVtIGVpbiBnZXNjYW5udGVzIFBERiBoYW5kZWx0LCBkYXMga2VpbmUgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciBvZGVyIFRhYmVsbGVuIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVmVyc3RhbmRlblwiLFxuICAgICAgICBcInBhZ2VcIjogXCJTZWl0ZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiU2VpdGVuXCJcbiAgICB9XG59XG4iLCAiLy8gc2NyaXB0cy9TeXN0ZW1UcmF5TWFuYWdlci5qc1xuaW1wb3J0IHsgYXBwLCBUcmF5LCBNZW51IH0gZnJvbSAnZWxlY3Ryb24nOyBcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnOyAvLyBQYXRoIG1vZHVsZSBpbXBvcnRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJzsgLy8gTG9nZ2luZyBtb2R1bGVcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcyc7IC8vIFdpbmRvdyBtYW5hZ2VyXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9jb21tdW5pY2F0aW9uaGFuZGxlci5qcyc7IC8vIENvbW11bmljYXRpb24gbG9naWNcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnOyAvLyBJMThuIGluc3RhbmNlXG5cblxuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyAvLyBHZXQgY3VycmVudCBkaXJlY3RvcnlcblxubGV0IHRyYXkgPSBudWxsOyAvLyBQcml2YXRlIHRyYXkgaW5zdGFuY2VcblxuLy8gUGF0aCB0byB0aGUgYXBwIGljb25cbmNvbnN0IGljb25QYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucycsJ2ljb24yNHgyNC5wbmcnKTsgXG5cbi8vID09PSByZXBsYWNlIHRoZSBoZWxwZXIgc2V0TG9jYWxlIChleGFjdCBibG9jaykgPT09XG5jb25zdCBzZXRMb2NhbGUgPSAobG9jKSA9PiB7XG4gICAgY29uc3QgZ2wgPSBpMThuLmdsb2JhbDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCBnbG9iYWwgY29tcG9zZXJcbiAgICBpZiAoZ2wgJiYgdHlwZW9mIGdsLmxvY2FsZSA9PT0gJ29iamVjdCcgJiYgZ2wubG9jYWxlKSB7XG4gICAgICAvLyB2dWUtaTE4biBjb21wb3NpdGlvbiBtb2RlXG4gICAgICBpZiAoJ3ZhbHVlJyBpbiBnbC5sb2NhbGUpIGdsLmxvY2FsZS52YWx1ZSA9IGxvYzsgICAgIC8vIHNldCByZWFjdGl2ZSB2YWx1ZVxuICAgICAgZWxzZSBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsYmFja1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBsZWdhY3kgbW9kZSBvciBwbGFpbiBzdHJpbmdcbiAgICAgIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHN0cmluZyBsb2NhbGVcbiAgICB9XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgXG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHRyYXkgaWNvbiBpZiBpdCBkb2Vzbid0IGV4aXN0IGFuZCB1cGRhdGVzIGl0cyBjb250ZXh0IG1lbnUuXG4gKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIG5ldyBsb2NhbGUgdG8gYXBwbHkuXG4gKi9cblxuXG5cbmV4cG9ydCBjb25zdCB1cGRhdGVTeXN0ZW1UcmF5ID0gKGxvY2FsZSkgPT4ge1xuICAgIHNldExvY2FsZShsb2NhbGUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgdCA9IChrKSA9PiBpMThuLmdsb2JhbC50KGspOyAgICAgICAgICAgICAgICAgICAgICAvLyBhbHdheXMgcmVzb2x2ZSBsaXZlXG4gIFxuICAgIGlmICghdHJheSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRyYXkgb25jZVxuICAgICAgdHJheSA9IG5ldyBUcmF5KGljb25QYXRoKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRyYXkgaWNvblxuICAgICAgdHJheS5vbignY2xpY2snLCAoKSA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9nZ2xlIHdpbmRvd1xuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkgXG4gICAgICAgICAgPyBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaGlkZSgpIFxuICAgICAgICAgIDogV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgXG4gICAgLy8gYnVpbGQgY29udGV4dCBtZW51IHdpdGggY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCBjb250ZXh0TWVudSA9IE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUoW1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LnJlc3RvcmUnKSwgY2xpY2s6ICgpID0+IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCkgfSwgLy8gc2hvdyB3aW5kb3dcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5kaXNjb25uZWN0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy5pbmZvKFwibWFpbiBAIHN5c3RlbXRyYXk6IHJlbW92aW5nIHJlZ2lzdHJhdGlvblwiKTsgXG4gICAgICAgICAgQ29tbUhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCk7IFxuICAgICAgICB9IFxuICAgICAgfSwgLy8gZGlzY29ubmVjdFxuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmV4aXQnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogQ2xvc2luZyBOZXh0LUV4YW1cIik7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIik7IFxuICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyBcbiAgICAgICAgICBhcHAucXVpdCgpOyBcbiAgICAgICAgfSBcbiAgICAgIH0gLy8gZXhpdFxuICAgIF0pO1xuICBcbiAgICB0cmF5LnNldFRvb2xUaXAoJ05leHQtRXhhbSBTdHVkZW50Jyk7ICAgICAgICAgICAgICAgICAgIC8vIHNldCB0b29sdGlwXG4gICAgdHJheS5zZXRDb250ZXh0TWVudShjb250ZXh0TWVudSk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBhcHBseSBtZW51XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIHNjcmlwdCBpcyB1c2VkIHRvIHRlc3QgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gKiBJdCB1c2VzIHRoZSB0Y2N1dGlsIGNvbW1hbmQgdG8gdGVzdCBhbmQgcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gKiBJdCByZXR1cm5zIHRydWUgaWYgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgYXJlIGFsbG93ZWQgYW5kIGZhbHNlIGlmIHRoZXkgYXJlIG5vdFxuICogXG4gKiBUaGlzIGNvdWxkIGFsc28gYmUgdXNlZCB0byB0ZXN0IG90aGVyIHBlcm1pc3Npb25zIGxpa2UgYWNjZXNzaWJpbGl0eSwgc2NyZWVuIGNhcHR1cmUsIGV0Yy4gXG4gKiBzZWUgY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgZm9yIG1vcmUgZGV0YWlscyBvbiBob3cgdG8gdGVzdCBmb3Igc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAoaXRzIG5vdCBwb3NzaWJsZSB0byB0ZXN0IGZvciBzY3JlZW4gY2FwdHVyZSBwZXJtaXNzaW9ucyBvbiBtYWNvcyBiZWNhdXNlIHdpdGhvdXQgcGVybWlzc2lvbnMgaXQgd2lsbCBhbHdheXMgcmV0dXJuIGEgYmxhbmsgc2NyZWVuc2hvdCAtIHdlIHVzZSBhIHdvcmthcm91bmQgdG8gZGV0ZWN0IHRoaXMpXG4gKiBcbiAqL1xuXG5cblxuXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcycgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJ1biB0Y2N1dGlsXG5pbXBvcnQgeyBkaWFsb2csIGFwcCB9IGZyb20gJ2VsZWN0cm9uJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG93IGRpYWxvZyBhbmQgcXVpdFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7ICAgICAgICAgICAgICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBmZXRjaCB3b3Jrc1xuICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3NlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3BvbmdgLCB7IG1ldGhvZDogJ0dFVCcsIGNhY2hlOiAnbm8tc3RvcmUnIH0pIC8vIHRlc3QgcmVxdWVzdFxuICAgICAgICAgICAgcmV0dXJuIHJlcy5va1xuICAgIH0gY2F0Y2ggeyAgcmV0dXJuIGZhbHNlIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc2V0VENDKCkgeyAgICAgIC8vIHJlc2V0IFRDQyBwZXJtaXNzaW9uc1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vYXBwSWRcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLnN0dWRlbnRgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuICAgICAgICAvL2FwcEJ1bmRsZUlkIChzZXQgdmlhIG5vdGFyaXplKVxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0tc3R1ZGVudC5hcHBgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuXG5cbiAgICB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgLy8gY2hlY2sgb3IgcmVzZXRcbiAgICBjb25zdCBvayA9IGF3YWl0IHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydClcbiAgICBpZiAob2spIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTmV0d29yayBhY2Nlc3MgaXMgYWxsb3dlZGApO1xuICAgICAgICAgICAgcmV0dXJuIFwib2tcIjtcbiAgICB9XG4gICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBObyBIVFRQIHJlcXVlc3RzIGFsbG93ZWQhYCApXG5cbiAgICB0cnkge1xuXG4gICAgICAgIC8vIGFzayB0aGUgdXNlcnMgaWYgdGhleSB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9ucyBhbmQgZXhpdCB0aGUgYXBwIGlmIHRoZXkgZG9cbiAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0RlciBTZXJ2ZXIgaXN0IG5pY2h0IGVycmVpY2hiYXIuIE1cdTAwRjZjaHRlbiBTaWUgZGllIEJlcmVjaHRpZ3VuZ2VuIHp1clx1MDBGQ2Nrc2V0emVuIHVuZCBOZXh0LUV4YW0gbWFudWVsbCBuZXUgc3RhcnRlbj8nLFxuICAgICAgICAgICAgYnV0dG9uczogWydPSycsICdBYmJyZWNoZW4nXSxcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGNob2ljZS5yZXNwb25zZSA9PT0gMCkgeyAgICAvLyByZXNldCBwZXJtaXNzaW9ucyBhbmQgcmV0dXJuIHRydWUgdG8gcXVpdCB0aGUgYXBwXG4gICAgICAgICAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IFJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zIGFuZCBxdWl0dGluZyBhcHBgKTtcbiAgICAgICAgICAgIGF3YWl0IHJlc2V0VENDKCk7IFxuICAgICAgICAgICAgcmV0dXJuIFwicmVzZXRcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2UgXG4gICAgICAgIH0gICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiBcbiAgICB9IFxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGxvZy5lcnJvcihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IEVycm9yIHJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zOiAke2V9YCk7XG4gICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ZlaGxlciBiZWltIFp1clx1MDBGQ2Nrc2V0emVuIGRlciBCZXJlY2h0aWd1bmdlbicsXG4gICAgICAgICAgICBkZXRhaWw6IFN0cmluZyhlLmVyciB8fCBlKSxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGZhbHNlICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gICAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBDb3VudGVyIGZvciBmYWlsZWQgYXR0ZW1wdHMgLSBza2lwIGV4ZWN1dGlvbiBhZnRlciA0IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG5sZXQgZmFpbHVyZUNvdW50ZXIgPSAwO1xuY29uc3QgTUFYX0ZBSUxVUkVTID0gMztcblxuLy8gQ29udmVydCBSU1NJIGluIGRCbSB0byBhIHF1YWxpdHkgcGVyY2VudGFnZSBiZXR3ZWVuIDAgYW5kIDEwMC5cbmZ1bmN0aW9uIGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKSB7XG4gICAgaWYgKGRibSA9PT0gbnVsbCB8fCBOdW1iZXIuaXNOYU4oZGJtKSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbWluRGJtID0gLTEwMDtcbiAgICBjb25zdCBtYXhEYm0gPSAtMzA7XG4gICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KG1pbkRibSwgTWF0aC5taW4obWF4RGJtLCBkYm0pKTtcbiAgICBjb25zdCBwZXJjZW50ID0gKChjbGFtcGVkIC0gbWluRGJtKSAvIChtYXhEYm0gLSBtaW5EYm0pKSAqIDEwMDtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChwZXJjZW50KTtcbn1cblxuLyoqXG4gKiBHZXQgY3VycmVudCBXTEFOIGluZm9ybWF0aW9uIChTU0lELCBCU1NJRCwgUXVhbGl0eSlcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtzc2lkOiBzdHJpbmd8bnVsbCwgYnNzaWQ6IHN0cmluZ3xudWxsLCBxdWFsaXR5OiBudW1iZXJ8bnVsbCwgbWVzc2FnZTogc3RyaW5nfG51bGx9Pn1cbiAqIEBkZXNjcmlwdGlvbiBtZXNzYWdlIGNhbiBiZTogXCJlcnJvclwiIChvbiBlcnJvciksIFwibm9pbnRlcmZhY2VcIiAobm8gaW50ZXJmYWNlIGF2YWlsYWJsZSksIFwibm9wZXJtaXNzaW9uc1wiIChsb2NhdGlvbiBwZXJtaXNzaW9ucyBtaXNzaW5nIG9uIFdpbmRvd3MpLCBvciBudWxsIChzdWNjZXNzKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm8oKSB7XG4gICAgLy8gU2tpcCBleGVjdXRpb24gaWYgd2UndmUgaGFkIHRvbyBtYW55IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG4gICAgaWYgKGZhaWx1cmVDb3VudGVyID49IE1BWF9GQUlMVVJFUykge1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHBsYXRmb3JtKSB7XG4gICAgICAgICAgICBjYXNlICdsaW51eCc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9MaW51eCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvV2luZG93cygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb01hY09TKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRW5zdXJlIHJlc3VsdCBpcyBhbHdheXMgYW4gb2JqZWN0XG4gICAgICAgIGlmICghcmVzdWx0IHx8IHR5cGVvZiByZXN1bHQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gUmVzZXQgY291bnRlciBvbiBzdWNjZXNzZnVsIHJlc3VsdCAoaGFzIGRhdGEpXG4gICAgICAgIGlmIChyZXN1bHQuc3NpZCB8fCByZXN1bHQuYnNzaWQgfHwgcmVzdWx0LnF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluY3JlbWVudCBjb3VudGVyIG9uIGZhaWx1cmVcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gUmV0dXJuIGVtcHR5IG9iamVjdCBpbnN0ZWFkIG9mIHRocm93aW5nIHRvIHByZXZlbnQgYXBwIGNyYXNoXG4gICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gTGludXggdXNpbmcgbm1jbGkgKHdpdGggZmFsbGJhY2sgdG8gaXcvaXdjb25maWcpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTGludXgoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IG5tY2xpIGZpcnN0IChtb3N0IGNvbW1vbiBvbiBtb2Rlcm4gTGludXgpXG4gICAgICAgIC8vIEZpcnN0IHRyeSB0byBnZXQgYWN0aXZlIGRldmljZSBkaXJlY3RseSAoZmFzdGVyIHRoYW4gbGlzdGluZyBhbGwgbmV0d29ya3MpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgc3Rkb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKCdubWNsaSAtdCAtZiBhY3RpdmUsc3NpZCxic3NpZCxzaWduYWwgZGV2aWNlIHdpZmkgbGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNDAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGNhdGNoIChleGVjRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBFdmVuIGlmIGV4ZWNBc3luYyB0aHJvd3MgYW4gZXJyb3IsIGNoZWNrIGlmIHN0ZG91dCBjb250YWlucyB2YWxpZCBkYXRhXG4gICAgICAgICAgICAgICAgLy8gbm1jbGkgc29tZXRpbWVzIHJldHVybnMgbm9uLXplcm8gZXhpdCBjb2RlIGJ1dCBzdGlsbCBwcm92aWRlcyB2YWxpZCBvdXRwdXRcbiAgICAgICAgICAgICAgICBpZiAoZXhlY0Vycm9yLnN0ZG91dCAmJiBleGVjRXJyb3Iuc3Rkb3V0LnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ZG91dCA9IGV4ZWNFcnJvci5zdGRvdXQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhlY0Vycm9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG91dHB1dCBmcm9tIG5tY2xpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaW5kIGFjdGl2ZSBjb25uZWN0aW9uXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKTtcbiAgICAgICAgICAgICAgICBpZiAoKHBhcnRzWzBdID09PSAneWVzJyB8fCBwYXJ0c1swXSA9PT0gJ2phJykgJiYgcGFydHMubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHBhcnRzWzFdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAvLyBCU1NJRCBpcyBhIE1BQyBhZGRyZXNzICg2IGhleCBieXRlcyBzZXBhcmF0ZWQgYnkgY29sb25zLCBwb3NzaWJseSBlc2NhcGVkKVxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIHVzaW5nIHJlZ2V4IC0gaGFuZGxlIGVzY2FwZWQgY29sb25zIChcXDopIGFzIHNob3duIGluIG5tY2xpIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAvLyBJbiByZWdleCBzdHJpbmcsIFxcXFw6IG1hdGNoZXMgYSBsaXRlcmFsIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBjb2xvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzpcXFxcOlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlc2NhcGUgYmFja3NsYXNoZXMgYW5kIG5vcm1hbGl6ZSB0byB1cHBlcmNhc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaFswXS5yZXBsYWNlKC9cXFxcOi9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjazogdHJ5IG5vcm1hbCBjb2xvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vcm1hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBub3JtYWxNYXRjaFswXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IHBhcnRzWzJdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpZ25hbCBpcyB0aGUgbGFzdCBudW1lcmljIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsU3RyID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0gPyBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXS50cmltKCkgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gc2lnbmFsU3RyID8gKHBhcnNlSW50KHNpZ25hbFN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKG5tY2xpRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dCwgZXRjLiksIG5vdCBpZiBqdXN0IG5vIFdMQU4gYWN0aXZlXG4gICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgbm1jbGlFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG5tY2xpRXJyb3IubWVzc2FnZSAmJiAhbm1jbGlFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdObyBvdXRwdXQnKSk7XG4gICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IG5tY2xpIGNvbW1hbmQgZmFpbGVkOicsIG5tY2xpRXJyb3IubWVzc2FnZSB8fCBubWNsaUVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gaXcgKGl3Y29uZmlnIGlzIGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1FIFwiXlxccypzc2lkfF5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd2xpbmtTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtQSA1IFwiXlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBTU0lEXG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gaXdTdGRvdXQgPyBpd1N0ZG91dC5tYXRjaCgvc3NpZFxccysoLispLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBzc2lkTWF0Y2ggPyBzc2lkTWF0Y2hbMV0udHJpbSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIGFuZCBzaWduYWwgZnJvbSBsaW5rIGluZm9cbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9hZGRyOlxccysoW2EtZjAtOTpdezE3fSkvaSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL3NpZ25hbDpcXHMrKC0/XFxkKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsRGJtID0gc2lnbmFsTWF0Y2ggPyAocGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgcXVhbGl0eSA9IHNpZ25hbERibSAhPT0gbnVsbCA/IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsRGJtKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoaXdFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yXG4gICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3RXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogaXcgY29tbWFuZCBmYWlsZWQ6JywgaXdFcnJvci5tZXNzYWdlIHx8IGl3RXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGZhbGxiYWNrOiBpd2NvbmZpZyAoZGVwcmVjYXRlZCBidXQgd2lkZWx5IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpd2NvbmZpZyAyPi9kZXYvbnVsbCB8IGdyZXAgLUUgXCJFU1NJRHxBY2Nlc3MgUG9pbnR8U2lnbmFsIGxldmVsXCInLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0VTU0lEOlwiKFteXCJdKylcIi8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNzaWRNYXRjaCkgc3NpZCA9IHNzaWRNYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0FjY2VzcyBQb2ludDpcXHMrKFthLWYwLTk6XXsxN30pL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIGJzc2lkID0gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goL1NpZ25hbCBsZXZlbD0oLT9cXGQrKS8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChpd2NvbmZpZ0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGFsbCBtZXRob2RzIGZhaWxlZCB3aXRoIHJlYWwgZXJyb3JzIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBBbGwgbWV0aG9kcyAobm1jbGksIGl3LCBpd2NvbmZpZykgZmFpbGVkLiBMYXN0IGVycm9yOicsIGl3Y29uZmlnRXJyb3IubWVzc2FnZSB8fCBpd2NvbmZpZ0Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ2Vycm9yJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgbWVzc2FnZTogJ25vaW50ZXJmYWNlJ1xuICAgIH07XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIG5ldHNoXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93cygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHNoIHdsYW4gc2hvdyBpbnRlcmZhY2VzJywge1xuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgc3RkZXJyIGZvciBzZXJ2aWNlIGVycm9yc1xuICAgICAgICBjb25zdCBlcnJvck91dHB1dCA9IChzdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IChzdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkT3V0cHV0ID0gb3V0cHV0ICsgJyAnICsgZXJyb3JPdXRwdXQ7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiBXTEFOIHNlcnZpY2UgaXMgbm90IHJ1bm5pbmcgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbnN2YycpIHx8IFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4gYXV0b2NvbmZpZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYXV0b21hdGlzY2ggd2xhbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbi1rb25maWd1cmF0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3NlcnZpY2UgaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RlciBkaWVuc3QnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIG5vIGludGVyZmFjZXMgYXZhaWxhYmxlXG4gICAgICAgIGlmIChzdGRvdXQuaW5jbHVkZXMoJ1RoZXJlIGlzIG5vIHdpcmVsZXNzIGludGVyZmFjZScpIHx8IFxuICAgICAgICAgICAgc3Rkb3V0LmluY2x1ZGVzKCdFcyBnaWJ0IGtlaW5lIERyYWh0bG9zLVNjaG5pdHRzdGVsbGUnKSB8fFxuICAgICAgICAgICAgc3Rkb3V0Lm1hdGNoKC9ObyB3aXJlbGVzcy9pKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lLmxlbmd0aCA+IDApO1xuICAgICAgICBcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgLy8gU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSwgaGFuZGxlcyB2YXJpb3VzIGZvcm1hdHNcbiAgICAgICAgICAgIC8vIFVzZSBuZWdhdGl2ZSBsb29rYmVoaW5kIHRvIGVuc3VyZSB3ZSBkb24ndCBtYXRjaCBcIkJTU0lEXCIgKHdoaWNoIGNvbnRhaW5zIFwiU1NJRFwiKVxuICAgICAgICAgICAgaWYgKGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6XFxzKiguKykvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBzZXQgaWYgbm90IGVtcHR5IGFuZCBub3QgXCJOL0FcIiBvciBzaW1pbGFyXG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWQgJiYgZXh0cmFjdGVkLmxlbmd0aCA+IDAgJiYgIWV4dHJhY3RlZC5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQgPSBleHRyYWN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBCU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSBwYXR0ZXJuIG1hdGNoaW5nXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9CU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIChoYW5kbGVzIGJvdGggLSBhbmQgOiBzZXBhcmF0b3JzLCB3aXRoIG9yIHdpdGhvdXQgc3BhY2VzKVxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvQlNTSURcXHMqOlxccyooW2EtZjAtOV17Mn0oPzpbLTpcXHNdW2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBtYXRjaFsxXS5yZXBsYWNlKC9bLSBdL2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTaWduYWwgcGFyc2luZyAtIGhhbmRsZSB2YXJpb3VzIGxvY2FsaXplZCBmb3JtYXRzIGFuZCBwYXR0ZXJuc1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvU2lnbmFsfFNpZ25hbHN0XHUwMEU0cmtlfEludGVuc2l0XHUwMEU5fFNlXHUwMEYxYWwvaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgcGVyY2VudGFnZSBwYXR0ZXJuIGZpcnN0IChtb3N0IGNvbW1vbilcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKihcXGQrKVxccyolL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKHBhcnNlZCkgJiYgcGFyc2VkID49IDAgJiYgcGFyc2VkIDw9IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IGRCbSBwYXR0ZXJuIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKigtP1xcZCspXFxzKmRCbS9pKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYm0gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihkYm0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBOb3JtYWxpemUgZW1wdHkgc3RyaW5ncyB0byBudWxsXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiAoc3NpZCAmJiBzc2lkLmxlbmd0aCA+IDApID8gc3NpZCA6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogKGJzc2lkICYmIGJzc2lkLmxlbmd0aCA+IDApID8gYnNzaWQgOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIGVycm9yIGlzIGR1ZSB0byBsb2NhdGlvbiBwZXJtaXNzaW9ucyAobWlnaHQgYmUgaW4gc3RkZXJyIG9yIGVycm9yIG1lc3NhZ2UpXG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IChlcnJvci5tZXNzYWdlIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZG91dCA9IChlcnJvci5zdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3RkZXJyID0gKGVycm9yLnN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRFcnJvck91dHB1dCA9IGVycm9yTWVzc2FnZSArICcgJyArIGVycm9yU3Rkb3V0ICsgJyAnICsgZXJyb3JTdGRlcnI7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgZXJyb3Igd2hlbiBjb21tYW5kIGV4ZWN1dGlvbiBmYWlscyAodGltZW91dCwgcGVybWlzc2lvbiwgZXRjLilcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3M6IEVycm9yIGV4ZWN1dGluZyBuZXRzaCBjb21tYW5kOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbCAoZmFsbGJhY2sgd2hlbiBuZXRzaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgKGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbilcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBhY3RpdmUgV2ktRmkgY29ubmVjdGlvbiBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwb3dlcnNoZWxsIC1Db21tYW5kIFwiJHByb2ZpbGUgPSBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgfCBXaGVyZS1PYmplY3QgeyRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaS1GaSpcXCcgLW9yICRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaXJlbGVzcypcXCd9IHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMTsgaWYgKCRwcm9maWxlKSB7ICRwcm9maWxlLk5hbWUgfVwiJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3NpZFN0ciA9IHNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHNzaWRTdHIgJiYgc3NpZFN0ci5sZW5ndGggPiAwICYmICFzc2lkU3RyLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkU3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQlNTSUQgY2Fubm90IGJlIGVhc2lseSByZXRyaWV2ZWQgd2l0aG91dCBuZXRzaCAod2hpY2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gICAgICAgIC8vIFNldHRpbmcgdG8gbnVsbCBhcyBmYWxsYmFjayAtIFNTSUQgaXMgdGhlIG1vc3QgaW1wb3J0YW50IGluZm9ybWF0aW9uIGFueXdheVxuICAgICAgICBjb25zdCBic3NpZCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgUG93ZXJTaGVsbCBmYWxsYmFjayAoY2FuJ3QgZWFzaWx5IGdldCBzaWduYWwgc3RyZW5ndGggd2l0aG91dCBuZXRzaClcbiAgICAgICAgLy8gUmV0dXJuIG5vcGVybWlzc2lvbnMgbWVzc2FnZSBzbyBmcm9udGVuZCBjYW4gc2hvdyB0aGUgd2FybmluZ1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ25vcGVybWlzc2lvbnMnXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIGVycm9yIGlmIFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbHNcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsOiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxlZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBtYWNPUyB1c2luZyBhaXJwb3J0IG9yIG5ldHdvcmtzZXR1cFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb01hY09TKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBhaXJwb3J0IGNvbW1hbmQgZmlyc3QgKGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBhaXJwb3J0IGlzIGF2YWlsYWJsZSAodXN1YWxseSBhdCAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydClcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBhaXJwb3J0UGF0aCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd3aGljaCBhaXJwb3J0IDI+L2Rldi9udWxsIHx8IGVjaG8gL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMTAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhaXJwb3J0ID0gYWlycG9ydFBhdGgudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGAke2FpcnBvcnR9IC1JYCwge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCByc3NpRGJtID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBzaWduYWxQZXJjZW50ID0gbnVsbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICBzc2lkID0gbGluZS5yZXBsYWNlKCdTU0lEOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ0JTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiB0byBlbnN1cmUgd2UgZ2V0IHRoZSBmdWxsIEJTU0lEXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRDpcXHMqKFthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2FnckN0bFJTU0k6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUlNTSSBpbiBkQm0gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpU3RyID0gbGluZS5yZXBsYWNlKCdhZ3JDdGxSU1NJOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2kgPSByc3NpU3RyID8gKHBhcnNlSW50KHJzc2lTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHJzc2lEYm0gPSByc3NpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdsaW5rIGF1dGg6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWx0ZXJuYXRpdmU6IHNpZ25hbCBzdHJlbmd0aCBhcyBwZXJjZW50YWdlIChpZiBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvKFxcZCspJS8pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2ggJiYgc2lnbmFsUGVyY2VudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbFBlcmNlbnQgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHF1YWxpdHkgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHNpZ25hbFBlcmNlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gc2lnbmFsUGVyY2VudDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocnNzaURibSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KHJzc2lEYm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc3NpZCB8fCBic3NpZCB8fCBxdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGFpcnBvcnRFcnJvcikge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbmV0d29ya3NldHVwIC0gb25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKG5vdCBqdXN0IG5vIHBlcm1pc3Npb24pXG4gICAgICAgICAgICBpZiAoYWlycG9ydEVycm9yLmNvZGUgIT09ICdFTk9FTlQnICYmIGFpcnBvcnRFcnJvci5tZXNzYWdlICYmICFhaXJwb3J0RXJyb3IubWVzc2FnZS5pbmNsdWRlcygncGVybWlzc2lvbicpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBhaXJwb3J0IGNvbW1hbmQgZmFpbGVkOicsIGFpcnBvcnRFcnJvci5tZXNzYWdlIHx8IGFpcnBvcnRFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrOiBuZXR3b3Jrc2V0dXAgYW5kIGlwY29uZmlnIChmb3IgbmV3ZXIgbWFjT1Mgd2hlcmUgYWlycG9ydCBpcyBub3QgYXZhaWxhYmxlKSAgLy8gc3lzdGVtX3Byb2ZpbGVyIGlzIHdheSB0byBoZWF2eSBhbmQgbmVlZHMgYSBsb29vb290IG9mIHRpbWUgdG8gcHJvY2Vzc1xuICAgICAgICAvLyB0aGlzIGlzIGEgc2ltcGxlIGNhbGN1bGF0aW9uLi4gd2UgY2FuJ3QgcmVseSBvbiBhIHByb2Nlc3MgdGhhdCB0YWtlcyAxMHMgdG8gY29tcGxldGUgYW5kIGJsb2NrcyB0aGUgd2hvbGUgc3lzdGVtXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgV0xBTiBpbnRlcmZhY2UgdXNpbmcgbmV0d29ya3NldHVwXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaW50ZXJmYWNlT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHdvcmtzZXR1cCAtbGlzdGFsbGhhcmR3YXJlcG9ydHMgfCBhd2sgXFwnL1dpLUZpfEFpclBvcnQve2dldGxpbmU7IHByaW50ICRORn1cXCcnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gaW50ZXJmYWNlT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFpbnRlcmZhY2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gV2ktRmkgaW50ZXJmYWNlIGZvdW5kXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgYXdrIC1GJyBTU0lEIDogJyAnLyBTU0lEIDogLyB7cHJpbnQgJDJ9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZE91dHB1dC50cmltKCkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWQsIGNvbnRpbnVlIHdpdGggQlNTSURcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IEJTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBic3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgZ3JlcCAnQlNTSUQgOicgfCBhd2sgJ3twcmludCAkM30nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkU3RyID0gYnNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIEJTU0lEIGZvcm1hdCAoTUFDIGFkZHJlc3MpXG4gICAgICAgICAgICAgICAgaWYgKGJzc2lkU3RyICYmIC9eW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9JC9pLnRlc3QoYnNzaWRTdHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRTdHIudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChic3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gQlNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIGZhbGxiYWNrIChhaXJwb3J0IG5vdCBhdmFpbGFibGUsIGNhbid0IGdldCBzaWduYWwgc3RyZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKG5ldHdvcmtzZXR1cEVycm9yKSB7XG4gICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgbmV0d29ya3NldHVwIGZhaWxzIHdpdGggYSByZWFsIGVycm9yXG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IG5ldHdvcmtzZXR1cC9pcGNvbmZpZyBmYWxsYmFjayBmYWlsZWQ6JywgbmV0d29ya3NldHVwRXJyb3IubWVzc2FnZSB8fCBuZXR3b3Jrc2V0dXBFcnJvcik7XG4gICAgICAgICAgICAvLyBJZiBmYWxsYmFjayBjb21wbGV0ZWx5IGZhaWxzLCByZXR1cm4gZXJyb3Igb2JqZWN0XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBnZXRXbGFuSW5mbyB9O1xuXG5cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgNTMsIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAndGFza2xpc3QgL2ZvIGNzdicgKHN0cnVjdHVyZWQgZm9ybWF0LCBmYXN0ZXIgdGhhbiAvdiwgc3RpbGwgc2hvd3MgcHJvY2VzcyBuYW1lcylcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd0YXNrbGlzdCAvZm8gY3N2JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICduZXRzdGF0IC1hbm8nIChzaG93cyBhbGwgY29ubmVjdGlvbiBzdGF0ZXMgaW5jbHVkaW5nIEVTVEFCTElTSEVEIGZvciBzY3JlZW5zaGFyaW5nIGRldGVjdGlvbilcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzdGF0IC1hbm8nLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gUmVnZXggdG8gZmluZCA6UE9SVCBmb2xsb3dlZCBieSBhIHNwYWNlIChlbnN1cmVzIGV4YWN0IHBvcnQgbWF0Y2gsIGUuZy4sIDo1OTM4IClcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9XFxcXHNgLCAnZycpIFxuICAgICAgaWYgKHJlZ2V4LnRlc3Qoc3Rkb3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn0iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCdjb20ubWljcm9zb2Z0LnRlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICA1MywgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59IiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1Jyxcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICA1MywgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2LFxuXVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59IiwgImltcG9ydCAqIGFzIHdpbiBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcydcbmltcG9ydCAqIGFzIG1hYyBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcydcbmltcG9ydCAqIGFzIGxpbnV4IGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTGluLmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2socGxhdGZvcm0gPSAnd2luMzInKSB7XG4gIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuIGF3YWl0IHdpbi5ydW5SZW1vdGVDaGVjaygpXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHJldHVybiBhd2FpdCBtYWMucnVuUmVtb3RlQ2hlY2soKVxuICByZXR1cm4gYXdhaXQgbGludXgucnVuUmVtb3RlQ2hlY2soKVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gRXhwYW5kZWQgYnJvd3NlciBrZXl3b3JkcyB0byBjYXRjaCBtb3JlIHZhcmlhbnRzXG5jb25zdCBicm93c2VyS2V5d29yZHMgPSBbXG4gICAgJ2Nocm9tJywgJ2Nocm9tZS5leGUnLFxuICAgICdlZGdlJywgJ21zZWRnZS5leGUnLFxuICAgICdmaXJlJywgJ2ZpcmVmb3guZXhlJyxcbiAgICAnYnJhdmUnLCAnYnJhdmUuZXhlJyxcbiAgICAnb3BlcmEnLCAnb3BlcmEuZXhlJyxcbiAgICAnYnJvd3NlcicsIC8vIEdlbmVyaWMgYnJvd3NlciBwcm9jZXNzXG4gICAgJ2lleHBsb3JlJywgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAnc2FmYXJpJywgLy8gRm9yIG1hY09TXG5dO1xuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwuZXhlIC1Ob0xvZ28gLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiYgeyAkcHJvYyA9IEdldC1DaW1JbnN0YW5jZSAtQ2xhc3MgV2luMzJfUHJvY2VzcyAtRmlsdGVyICdQcm9jZXNzSWQ9JHtwaWR9JzsgaWYgKCRwcm9jKSB7ICRwcm9jLlBhcmVudFByb2Nlc3NJZDsgJHByb2MuTmFtZSB9IH1cImA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChsaW5lc1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gbGluZXNbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzOiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBVbml4IHN5c3RlbXMgKExpbnV4L21hY09TKVxuICogVHJpZXMgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QpLCBmYWxscyBiYWNrIHRvIHBzIGNvbW1hbmRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCBtZXRob2QgfjRtcywgbm8gcHJvY2VzcyBzcGF3bilcbiAgICAgICAgY29uc3QgW3N0YXRDb250ZW50LCBjb21tQ29udGVudF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L3N0YXRgLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9jb21tYCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzdGF0Q29udGVudCkge1xuICAgICAgICAgICAgLy8gUGFyc2UgL3Byb2MvcGlkL3N0YXQ6IHBpZCAoY29tbSkgc3RhdGUgcHBpZCAuLi5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRNYXRjaCA9IHN0YXRDb250ZW50Lm1hdGNoKC9eXFxkK1xccytcXCgoW14pXSspXFwpXFxzK1xcUytcXHMrKFxcZCspLyk7XG4gICAgICAgICAgICBpZiAoc3RhdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChjb21tQ29udGVudCB8fCBzdGF0TWF0Y2hbMV0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChzdGF0TWF0Y2hbMl0sIDEwKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIHBzIGNvbW1hbmQgKHdvcmtzIG9uIGJvdGggTGludXggYW5kIG1hY09TKVxuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBzIC1wICR7cGlkfSAtbyBwcGlkPSxjb21tPWA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvVW5peDogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gYmFzZWQgb24gcGxhdGZvcm1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm8ocGlkKSB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuICAgIFxuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCk7XG4gICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fCBwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvVW5peChwaWQpOyAvLyBMaW51eC9tYWNPUzogdHJpZXMgL3Byb2MsIGZhbGxzIGJhY2sgdG8gcHNcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY2hlY2sgcGFyZW50IHByb2Nlc3NlcyBmb3IgYnJvd3NlclxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kUGFyZW50UHJvY2VzcyhwaWQsIG1heERlcHRoLCB2aXNpdGVkUGlkcykge1xuICAgIGlmIChwaWQgPT09IDEgfHwgcGlkID09PSAwKSB7XG4gICAgICAgIGxvZy5pbmZvKCdjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSb290IFBJRCByZWFjaGVkLiBObyB3ZWIgYnJvd3NlciBmb3VuZC4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWF4RGVwdGggPD0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gd2hlbiBtYXggZGVwdGggcmVhY2hlZFxuICAgIH1cbiAgICBcbiAgICBpZiAodmlzaXRlZFBpZHMuaGFzKHBpZCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG4gICAgfVxuICAgIFxuICAgIHZpc2l0ZWRQaWRzLmFkZChwaWQpO1xuICAgIFxuICAgIC8vIEdldCBwcm9jZXNzIGluZm8gKGdldFByb2Nlc3NJbmZvIGFscmVhZHkgaGFzIGl0cyBvd24gdGltZW91dCBwcm90ZWN0aW9uKVxuICAgIGNvbnN0IHByb2Nlc3NJbmZvID0gYXdhaXQgZ2V0UHJvY2Vzc0luZm8ocGlkKTtcbiAgICBcbiAgICBpZiAoIXByb2Nlc3NJbmZvKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgeyBwcGlkLCBuYW1lIH0gPSBwcm9jZXNzSW5mbztcbiAgICBcbiAgICAvLyBMb2cgdGhlIHByb2Nlc3MgaW5mbyBmb3IgZGVidWdnaW5nXG4gICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IENoZWNraW5nIHByb2Nlc3M6ICR7bmFtZX0gKFBJRDogJHtwaWR9LCBQUElEOiAke3BwaWR9KWApO1xuICAgIFxuICAgIC8vIE1vcmUgdGhvcm91Z2ggYnJvd3NlciBkZXRlY3Rpb25cbiAgICBpZiAoYnJvd3NlcktleXdvcmRzLnNvbWUoYnJvd3NlciA9PiBuYW1lLmluY2x1ZGVzKGJyb3dzZXIpKSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQnJvd3NlciBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuaW5jbHVkZXMoJ2V4cGxvcmVyJykgfHwgcHBpZCA8PSAxKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSZWFjaGVkIHN5c3RlbSBwcm9jZXNzIG9yIGV4cGxvcmVyYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHBpZCwgbWF4RGVwdGggLSAxLCB2aXNpdGVkUGlkcyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIHBhcmVudCBwcm9jZXNzIGlzIGEgYnJvd3NlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQYXJlbnRQcm9jZXNzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZvdW5kQnJvd3NlciA9IGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHByb2Nlc3MucHBpZCwgNiwgbmV3IFNldCgpKTtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGRldGVjdGlvbiByZXN1bHQ6ICR7Zm91bmRCcm93c2VyfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBmb3VuZEJyb3dzZXIgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBFcnJvciBpbiBicm93c2VyIGRldGVjdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZm91bmRCcm93c2VyOiBmYWxzZSwgZXJyb3I6IGVycm9y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QUFTLFVBQVUsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUMxQyxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxZQUFZLE1BQU07QUFBRyxXQUFPO0FBQUEsRUFBTSxDQUFDO0FBQy9ELENBQUM7IiwKICAibmFtZXMiOiBbImV4ZWNTeW5jIiwgImV4ZWNTeW5jIiwgImxvZyIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJnbG9iYWxTaG9ydGN1dCIsICJUcmF5IiwgIk1lbnUiLCAiZGlhbG9nIiwgImxvZyIsICJsb2ciLCAicGF0aCIsICJmcyIsICJvcyIsICJpcCIsICJnYXRld2F5NHN5bmMiLCAiYXBwIiwgInBhdGgiLCAiam9pbiIsICJqb2luIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgImxvZyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAicGF0aCIsICJsb2ciLCAiYXBwIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJsb2ciLCAicHJvY2VzcyIsICJmcyIsICJwYXRoIiwgIm9zIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJqb2luIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJmcyIsICJqb2luIiwgInNjcmVlbiIsICJpcGNNYWluIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIndlYkNvbnRlbnRzIiwgInBhdGgiLCAiZnMiLCAiY2xpcGJvYXJkIiwgImFwcCIsICJvcyIsICJsb2ciLCAiYXBwIiwgInBhdGgiLCAibG9nIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgInQiLCAibG9nIiwgImFwcCIsICJleGVjIiwgImRpYWxvZyIsICJhcHAiLCAibG9nIiwgImV4ZWMiLCAib3MiLCAibG9nIiwgImlzUmVhbEVycm9yIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgImNsaXBib2FyZCIsICJwYXRoIiwgImZzIiwgImVyciIsICJ3ZWJDb250ZW50cyIsICJvcyIsICJhcHAiLCAibG9nIiwgInBhdGgiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJydW5SZW1vdGVDaGVjayIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJydW5SZW1vdGVDaGVjayIsICJhcHAiLCAicGF0aCIsICJhZ2VudCIsICJmcyIsICJqb2luIiwgImlwY01haW4iLCAid2ViQ29udGVudHMiLCAic2NyZWVuIiwgImVyciIsICJleGVjIiwgInByb21pc2lmeSIsICJsb2ciLCAiZXhlY0FzeW5jIiwgIm5hbWUiLCAicHBpZCIsICJhcHAiLCAibG9nIiwgIk1lbnUiLCAiX19kaXJuYW1lIiwgIm9zIiwgInBhdGgiLCAiZnMiLCAiZ2F0ZXdheTRzeW5jIiwgImlwIiwgIndlYkNvbnRlbnRzIiwgIkJyb3dzZXJXaW5kb3ciLCAiZXZlbnQiLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
