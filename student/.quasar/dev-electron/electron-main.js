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
  bipIntegration: true,
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
  version: "2.0.0.1",
  buildDate: "20260203",
  buildNumber: "1",
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
    this.platform = process.platform;
    this._arch = process.arch;
    this._env = process.env;
    this.messages = [];
    this.arch = this._normalizeArch();
    this.displayServer = this._getDisplayServer();
    this.isKDE = this._isKDE();
    this.isGNOME = this._isGNOME();
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
    if (this.platform === "linux") return "minimal-jre-11-lin";
    if (this.platform === "win32") return "minimal-jre-11-win";
    if (this.platform === "darwin") {
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
    if (config_default.useBundledJRE) {
      if (app.isPackaged) {
        this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(process.resourcesPath, "app.asar.unpacked", "public", this.jre));
        return join(process.resourcesPath, "app.asar.unpacked", "public", this.jre);
      } else {
        this.messages.push("platformDispatcher @ _resolveJREDir: !app.isPackaged: " + join(__dirname, "../../public", this.jre));
        return join(__dirname, "../../public", this.jre);
      }
    } else {
      try {
        const javaCommand = this.platform === "win32" ? "where java" : "which java";
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
    switch (this.platform) {
      case "darwin":
        return ["bin", "java"];
      case "win32":
        return ["bin", "javaw.exe"];
      case "linux":
        return ["bin", "java"];
      default:
        this._fail(`unsupported platform: ${this.platform}`);
    }
  }
  _getDisplayServer() {
    if (this.platform !== "linux") return "n/a";
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
    return this.platform === "linux" ? "imageWorkerLinux.mjs" : "imageWorkerSharp.mjs";
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
    if (this.platform === "win32") {
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
    if (this.platform === "linux") {
      return this._imagemagickAvailable();
    } else {
      return true;
    }
  }
  _getScreenshotAbility() {
    if (this.platform === "linux") {
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
import log16 from "electron-log";
import { app as app9, BrowserWindow as BrowserWindow3, powerSaveBlocker, nativeTheme, globalShortcut as globalShortcut2, Tray as Tray2, Menu as Menu2, dialog as dialog3, session } from "electron";

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
import { app as app2, BrowserWindow, BrowserView, dialog, screen } from "electron";
import { join as join4 } from "path";

// src-electron/main/scripts/platformrestrictions.js
import { clipboard, globalShortcut } from "electron";
import log6 from "electron-log";

// src-electron/main/scripts/restrictions/lin.js
import childProcess from "child_process";
import log3 from "electron-log";
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
  "move-to-workspacoe-down",
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
function enableLinuxRestrictions(configStore2, appsToClose2, isKDE, isGNOME) {
  try {
    appsToClose2.forEach((app10) => {
      childProcess.exec(`pgrep -i "${app10}"`, (pgrepError, stdout) => {
        if (!pgrepError && stdout && stdout.trim()) {
          childProcess.exec(`pgrep -i "${app10}" | xargs -r kill -9`, (killError) => {
            if (!killError) log3.info(`platformrestrictions @ enableRestrictions: closed ${app10}`);
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
        configStore2.linux.numberOfDesktops = 1;
        return;
      }
      configStore2.linux.numberOfDesktops = stdout.trim();
    });
    log3.info("platformrestrictions @ enableRestrictions: reconfiguring kwin");
    childProcess.execFile("kwriteconfig5", ["--file", `${platformDispatcher_default.homedirectory}/.config/kwinrc`, "--group", "ModifierOnlyShortcuts", "--key", "Meta", '""']);
    childProcess.execFile("kwriteconfig5", ["--file", "kwinrc", "--group", "Desktops", "--key", "Number", "1"]);
    childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "reconfigure"]);
    childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "setCurrentDesktop", "1"]);
    log3.info("platformrestrictions @ enableRestrictions: disabling effects");
    childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "desktopgrid"]);
    childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "screenedge"]);
    childProcess.execFile("qdbus", ["org.kde.KWin", "/Effects", "org.kde.kwin.Effects.unloadEffect", "overview"]);
    log3.info("platformrestrictions @ enableRestrictions: additional tty's");
    childProcess.execFile("kwriteconfig5", ["--file", "kxkbrc", "--group", "Layout", "--key", "Options", "srvrkeys:none"]);
    childProcess.execFile("dbus-send", ["--session", "--type=signal", "--dest=org.kde.keyboard", "/Layouts", "org.kde.keyboard.reloadConfig"]);
    log3.info("platformrestrictions @ enableRestrictions: clearing clipboard history");
    childProcess.execFile("qdbus", ["org.kde.klipper", "/klipper", "org.kde.klipper.klipper.clearClipboardHistory"]);
    setTimeout(() => {
      log3.info("platformrestrictions @ enableRestrictions: disabling global keyboardshortcuts");
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
        childProcess.execFile("gsettings", ["set", "org.gnome.mutter.wayland.keybindings", binding, `['']`]);
        childProcess.execFile("dconf", ["write", `/org/gnome/mutter/wayland/keybindings/${binding}`, `['']`]);
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
      childProcess.execFile("gsettings", ["set", "org.gnome.mutter", "overlay-key", `''`]);
      childProcess.exec("gsettings set org.gnome.mutter dynamic-workspaces false");
      childProcess.exec("gsettings set org.gnome.desktop.wm.preferences num-workspaces 1");
      if (!platformDispatcher_default.isWayland()) {
        configStore2.linux.srvrkeysNoneSet = true;
        childProcess.exec("setxkbmap -option srvrkeys:none", (err) => {
          if (err) log3.warn("platformrestrictions @ enableRestrictions (GNOME): setxkbmap srvrkeys:none failed", err.message);
        });
      }
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
function disableLinuxRestrictions(configStore2) {
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
      childProcess.execFile("kwriteconfig5", ["--file", `${platformDispatcher_default.homedirectory}/.config/kwinrc`, "--group", "ModifierOnlyShortcuts", "--key", "Meta", "--delete"]);
      childProcess.execFile("kwriteconfig5", ["--file", "kwinrc", "--group", "Desktops", "--key", "Number", configStore2.linux.numberOfDesktops]);
      childProcess.execFile("kwriteconfig5", ["--file", "kxkbrc", "--group", "Layout", "--key", "Options", ""]);
      childProcess.execFile("dbus-send", ["--session", "--type=signal", "--dest=org.kde.keyboard", "/Layouts", "org.kde.keyboard.reloadConfig"]);
      childProcess.execFile("qdbus", ["org.kde.KWin", "/KWin", "reconfigure"]);
      const child = childProcess.exec("kstart5 plasmashell &", { detached: true, stdio: "ignore" });
      child.unref();
    }
  });
  for (let binding of gnomeKeybindings) {
    childProcess.execFile("gsettings", ["reset", "org.gnome.desktop.wm.keybindings", `${binding}`]);
  }
  for (let binding of gnomeWaylandKeybindings) {
    childProcess.execFile("gsettings", ["reset", "org.gnome.mutter.wayland.keybindings", binding]);
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
  childProcess.execFile("gsettings", ["reset", "org.gnome.mutter", "overlay-key"]);
  if (configStore2.linux.srvrkeysNoneSet) {
    childProcess.exec("setxkbmap -option ''", (err) => {
      if (err) log3.warn("platformrestrictions @ disableRestrictions: setxkbmap restore failed", err.message);
    });
    configStore2.linux.srvrkeysNoneSet = false;
  }
}

// src-electron/main/scripts/restrictions/win.js
import { join as join2 } from "path";
import childProcess2 from "child_process";
import log4 from "electron-log";
var __dirname2 = import.meta.dirname;
async function enableWindowsRestrictions(winhandler, appsToClose2) {
  try {
    const executable1 = join2(__dirname2, "../../../public/disable-shortcuts.exe");
    childProcess2.execFile(executable1, [], { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    log4.info("platformrestrictions @ enableRestrictions: windows shortcuts disabled");
  } catch (err) {
    log4.error(`platformrestrictions @ enableRestrictions (win shortcuts): ${err}`);
  }
  try {
    for (const app10 of appsToClose2) {
      const escapedApp = app10.replace(/'/g, "''");
      const command = `powershell -NoProfile -Command "$appName = '${escapedApp}'; try { $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ilike ('*' + $appName + '*') }; if ($procs -and $procs.Count -gt 0) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output 'killed' } } catch { }"`;
      await new Promise((resolveApp) => {
        childProcess2.exec(command, (error, stdout, stderr) => {
          if (!error && stdout && stdout.trim().includes("killed")) {
            log4.info(`platformrestrictions @ enableRestrictions: closed ${app10}`);
          }
          resolveApp();
        });
      });
    }
  } catch (err) {
  }
  if (!winhandler) {
    log4.warn(`platformrestrictions @ enableRestrictions: winhandler is not provided - skipping explorer.exe kill`);
  } else {
    let retryCount = 0;
    const maxRetries = 100;
    const killExplorerWhenWindowExists = () => {
      if (winhandler.examwindow && !winhandler.examwindow.isDestroyed?.()) {
        try {
          childProcess2.exec("taskkill /f /im explorer.exe", (error, stdout, stderr) => {
            if (!error && stdout) log4.info(`platformrestrictions @ enableRestrictions: closed explorer.exe`);
          });
        } catch (err) {
        }
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(killExplorerWhenWindowExists, 100);
      } else {
        log4.warn(`platformrestrictions @ enableRestrictions: examwindow not found after ${maxRetries * 100}ms - skipping explorer.exe kill`);
      }
    };
    killExplorerWhenWindowExists();
  }
}
function disableWindowsRestrictions() {
  log4.info("platformrestrictions @ disableRestrictions (win): unblocking shortcuts...");
  try {
    childProcess2.exec(`taskkill  /IM "disable-shortcuts.exe" /T /F`, (error, stdout, stderr) => {
      if (!error && stdout) log4.info(`platformrestrictions @ disableRestrictions: closed disable-shortcuts.exe`);
    });
  } catch (e) {
  }
  try {
    childProcess2.exec('tasklist /FI "IMAGENAME eq explorer.exe"', (error, stdout, stderr) => {
      if (error) {
        log4.error(`tasklist error: ${error}`);
        return;
      }
      if (!stdout.includes("explorer.exe")) {
        log4.info("platformrestrictions @ disableRestrictions (win): restarting explorer...");
        const child = childProcess2.exec("start explorer.exe", { detached: true, stdio: "ignore" });
        child.unref();
      }
    });
  } catch (e) {
    log4.error(`platformrestrictions @ disablerestrictions (win explorer): ${e.message}`);
  }
}

// src-electron/main/scripts/restrictions/mac.js
import { join as join3 } from "path";
import childProcess3 from "child_process";
import { spawn } from "child_process";
import { TouchBar, systemPreferences, powerMonitor } from "electron";
import log5 from "electron-log";
var workspaceNotificationId = null;
var logStreamProcess = null;
var currentWinhandler = null;
function onMacRestrictionSignal(signalName) {
  log5.info(`platformrestrictions @ mac: ${signalName} detected`);
  if (!currentWinhandler?.examwindow?.isDestroyed?.()) {
    if (currentWinhandler.multicastClient?.clientinfo) currentWinhandler.multicastClient.clientinfo.focus = false;
    currentWinhandler.examwindow.moveTop();
    currentWinhandler.examwindow.setKiosk(true);
    currentWinhandler.examwindow.show();
    currentWinhandler.examwindow.focus();
  }
}
var lockScreenHandler = () => onMacRestrictionSignal("lock-screen");
var unlockScreenHandler = () => onMacRestrictionSignal("unlock-screen");
function enableMacRestrictions(winhandler, appsToClose2) {
  const { TouchBarLabel, TouchBarSpacer } = TouchBar;
  const textlabel = new TouchBarLabel({ label: "Next-Exam" });
  const touchBar = new TouchBar({
    items: [
      new TouchBarSpacer({ size: "flexible" }),
      textlabel,
      new TouchBarSpacer({ size: "flexible" })
    ]
  });
  winhandler.examwindow?.setTouchBar(touchBar);
  currentWinhandler = winhandler;
  childProcess3.exec("pbcopy < /dev/null");
  appsToClose2.forEach((app10) => {
    childProcess3.exec(`pkill -9 -f "${app10}"`, (error, stderr, stdout) => {
    });
  });
  try {
    workspaceNotificationId = systemPreferences.subscribeWorkspaceNotification("NSWorkspaceActiveSpaceDidChangeNotification", () => onMacRestrictionSignal("desktop/space switch"));
  } catch (err) {
    log5.error("platformrestrictions @ mac: subscribeWorkspaceNotification", err);
  }
  powerMonitor.on("lock-screen", lockScreenHandler);
  powerMonitor.on("unlock-screen", unlockScreenHandler);
  logStreamProcess = spawn("log", ["stream", "--predicate", 'subsystem == "com.apple.dock" AND category == "missioncontrol"']);
  logStreamProcess.stdout?.on("data", (data) => {
    if (data.toString().includes("mode")) onMacRestrictionSignal("Mission Control");
  });
}
function disableMacRestrictions() {
  currentWinhandler = null;
  if (workspaceNotificationId != null) {
    try {
      systemPreferences.unsubscribeWorkspaceNotification(workspaceNotificationId);
    } catch (err) {
      log5.error("platformrestrictions @ mac: unsubscribeWorkspaceNotification", err);
    }
    workspaceNotificationId = null;
  }
  powerMonitor.off("lock-screen", lockScreenHandler);
  powerMonitor.off("unlock-screen", unlockScreenHandler);
  if (logStreamProcess) {
    logStreamProcess.kill();
    logStreamProcess = null;
  }
}
function toggleMacOSLockdown(enable) {
  if (platformDispatcher_default.platform !== "darwin") return;
  log5.info(`platformrestrictions @ toggleMacOSLockdown: ${enable ? "enable" : "disable"} mission control lockdown`);
  const mcIds = [32, 33, 34, 35, 79, 80, 81, 82, 118, 119, 120, 121];
  const plistPath = join3(platformDispatcher_default.homedirectory, "Library/Preferences/com.apple.symbolichotkeys.plist");
  const backupPath = join3(platformDispatcher_default.tempdirectory, "next_exam_hotkeys_backup.plist");
  if (enable) {
    const hotkeyCommands = mcIds.map(
      (id) => `defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add ${id} "<dict><key>enabled</key><false/></dict>"`
    ).join("; ");
    const gestureCommands = [
      `defaults write com.apple.dock showMissionControlGestureEnabled -bool false`,
      `defaults write com.apple.dock showAppExposeGestureEnabled -bool false`,
      `defaults write com.apple.dock showDesktopGestureEnabled -bool false`
    ].join("; ");
    const fullCommand = `
        if [ ! -f "${backupPath}" ]; then cp "${plistPath}" "${backupPath}"; fi;
        ${hotkeyCommands};
        ${gestureCommands};
        killall -9 cfprefsd;
        sleep 1;
        /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u;
        killall Dock
      `;
    childProcess3.exec(fullCommand, (err) => {
      if (err) console.error("Lockdown Enable Error:", err);
    });
  } else {
    const gestureCommands = [
      `defaults write com.apple.dock showMissionControlGestureEnabled -bool true`,
      `defaults write com.apple.dock showAppExposeGestureEnabled -bool true`,
      `defaults write com.apple.dock showDesktopGestureEnabled -bool true`
    ].join("; ");
    const fullCommand = `
        if [ -f "${backupPath}" ]; then 
          cp "${backupPath}" "${plistPath}"; 
          rm "${backupPath}"; 
        fi;
        ${gestureCommands};
        killall -9 cfprefsd;
        sleep 1;
        /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u;
        killall Dock
      `;
    log5.info("main @ toggleMacOSLockdown: Enable MissionContol");
    childProcess3.exec(fullCommand, (err) => {
      if (err) console.error("Lockdown Disable Error:", err);
    });
  }
}

// src-electron/main/scripts/platformrestrictions.js
var clipboardInterval;
var configStore = {
  linux: {},
  windows: {},
  macos: {}
};
var appsToClose = ["Google Chrome", "chrome", "google-chrome", "Microsoft Edge", "msedge", "firefox", "safari", "brave", "opera", "chatgpt", "ChatGPT", "NortonSecurity", "NAV", "Teams", "ms-teams", "zoom.us", "Microsoft Teams", "discord", "zoom", "teams", "teamviewer", "skypeforlinux", "skype", "anydesk"];
async function enableRestrictions(winhandler) {
  if (config_default.development) {
    return;
  }
  log6.info("platformrestrictions @ enableRestrictions: enabling platform restrictions");
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
  if (platformDispatcher_default.platform === "linux") {
    enableLinuxRestrictions(configStore, appsToClose, platformDispatcher_default.isKDE, platformDispatcher_default.isGNOME);
  }
  if (platformDispatcher_default.platform === "win32") {
    await enableWindowsRestrictions(winhandler, appsToClose);
  }
  if (platformDispatcher_default.platform === "darwin") {
    enableMacRestrictions(winhandler, appsToClose);
  }
}
function disableRestrictions() {
  if (config_default.development) {
    return;
  }
  log6.info("platformrestrictions @ disableRestrictions: removing restrictions...");
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
  if (platformDispatcher_default.platform === "linux") {
    disableLinuxRestrictions(configStore);
  }
  if (platformDispatcher_default.platform === "win32") {
    disableWindowsRestrictions();
  }
  if (platformDispatcher_default.platform === "darwin") {
    disableMacRestrictions();
  }
}
function toggleMacOSLockdown2(enable) {
  toggleMacOSLockdown(enable);
}

// src-electron/main/scripts/windowhandler.js
import log7 from "electron-log";
import { activeWindow } from "get-windows";
import { fileURLToPath } from "node:url";
import path2 from "path";
var __dirname3 = import.meta.dirname;
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
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
      log7.info("windowhandler @ createBiPLoginWin: did-navigate");
      log7.info(url);
    });
    this.bipwindow.webContents.on("will-navigate", (event, url) => {
      log7.info("windowhandler @ createBiPLoginWin: will-navigate");
      log7.info(url);
    });
    this.bipwindow.webContents.on("new-window", (event, url) => {
      log7.info("windowhandler @ createBiPLoginWin: new-window");
      log7.info(url);
      event.preventDefault();
    });
    this.bipwindow.webContents.setWindowOpenHandler(({ url }) => {
      log7.info("windowhandler @ createBiPLoginWin: target: _blank");
      log7.info(url);
      return { action: "deny" };
    });
    this.bipwindow.webContents.on("will-redirect", (event, url) => {
      log7.info("windowhandler @ createBiPLoginWin: Redirecting to:", url);
      if (url.startsWith("bildungsportal://")) {
        event.preventDefault();
        const prefix = "bildungsportal://token=";
        const token = url.substring(prefix.length);
        log7.info("windowhandler @ createBiPLoginWin: Captured Token:");
        log7.info("windowhandler @ createBiPLoginWin: " + token);
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
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
    this.easterwin.loadFile(join4(__dirname3, `../../public/cowsonice/index.html`));
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join4(__dirname3, "./preload/electron-preload.cjs")
      }
    });
    let url = "notfound";
    if (app2.isPackaged) {
      let path9 = join4(__dirname3, `../renderer/index.html`);
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
          log7.info(`windowhandler @ initBlockWindows: exam window is on display ${display.id}`);
        } catch (err) {
          log7.error(`windowhandler @ initBlockWindows: error getting exam window display: ${err}`);
        }
      }
      for (const blockwin of this.blockwindows) {
        try {
          const bounds = blockwin.getBounds();
          const display = screen.getDisplayMatching(bounds);
          usedDisplayIds.add(display.id);
          log7.info(`windowhandler @ initBlockWindows: block window found on display ${display.id}`);
        } catch (err) {
          log7.error(`windowhandler @ initBlockWindows: error getting block window display: ${err}`);
        }
      }
      for (let display of displays) {
        if (usedDisplayIds.has(display.id)) {
          log7.info(`windowhandler @ initBlockWindows: skipping display ${display.id} - already has exam or block window`);
          continue;
        }
        log7.info("windowhandler @ initBlockWindows: create blockwin on:", display.id);
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join4(__dirname3, "./preload/electron-preload.cjs")
      }
    });
    let url = "lock";
    if (app2.isPackaged) {
      let path9 = join4(__dirname3, `../renderer/index.html`);
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
      log7.warn("missing parameters for exam-mode or mode not in allowed list!");
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
      log7.info(`windowhandler @ createExamWindow: reserving display ${this.examDisplayId} for exam window`);
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
      webPreferences: {
        preload: join4(__dirname3, "./preload/electron-preload.cjs"),
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
          await enableRestrictions(this);
          await this.sleep(1e3);
          this.addBlurListener();
        } catch (e) {
          log7.error("windowhandler @ did-finish-load: error in examwindow setup", e);
        }
      }
    });
    this.examwindow.serverstatus = serverstatus;
    this.examwindow.menuHeight = 94;
    if (examtype === "microsoft365") {
      log7.info("starting microsoft365 exam...");
      let urlview = this.multicastClient.clientinfo.msofficeshare;
      if (!urlview) {
        log7.warn("windowhandler @ createExamWindow: no url for microsoft365 was set yet - waiting for next update tick");
        this.examwindow.destroy();
        this.examwindow = null;
        this.examDisplayId = null;
        disableRestrictions(this.examwindow);
        this.multicastClient.clientinfo.exammode = false;
        this.multicastClient.clientinfo.focus = true;
        return;
      }
      let url = examtype;
      if (app2.isPackaged) {
        let path9 = join4(__dirname3, `../renderer/index.html`);
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
      if (app2.isPackaged) {
        let path9 = join4(__dirname3, `../renderer/index.html`);
        this.examwindow.loadFile(path9, { hash: `#/${url}/${token}` });
      } else {
        url = `${"http://localhost:9300"}/#/${url}/${token}/`;
        this.examwindow.loadURL(url);
      }
    }
    const examTypesWithPdfInHeader = ["gforms", "website", "eduvidual", "editor", "rdp", "microsoft365", "activesheets", "math"];
    if (examTypesWithPdfInHeader.includes(serverstatus.examSections[serverstatus.lockedSection].examtype)) {
      this.examwindow.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
      });
      this.examwindow.webContents.on("new-window", (event, url) => {
        log7.warn("windowhandler @ examwindow: blocked new-window", url);
        event.preventDefault();
      });
      this.examwindow.webContents.setWindowOpenHandler(({ url }) => {
        log7.warn("windowhandler @ examwindow: blocked setWindowOpenHandler", url);
        return { action: "deny" };
      });
    }
    if (serverstatus.examSections[serverstatus.lockedSection].examtype === "microsoft365") {
      const browserView = this.examwindow.getBrowserView(0);
      browserView.webContents.on("will-navigate", (event, url) => {
        if (url !== this.multicastClient.clientinfo.msofficeshare) {
          log7.warn("do not navigate away from this test.. ");
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
        log7.warn("no navigation allowed");
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
      log7.info("windowhandler @ lock365: stopping lockScheduler");
      schedulerInstance.stop();
      if (this.lockScheduler === schedulerInstance) {
        this.lockScheduler = null;
      }
    } else {
      log7.error("windowhandler @ lock365: no browserView or lockScheduler found");
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
      icon: join4(__dirname3, "../../public/icons/icon.png"),
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
      //visibleOnAllWorkspaces: true,
      webPreferences: {
        preload: path2.resolve(
          currentDir,
          path2.join("/home/student/Webroot/GIT/next-exam/student/.quasar/dev-electron/preload", "electron-preload.cjs")
        ),
        spellcheck: false,
        backgroundThrottling: true
        // allow throttling when window is in background
      }
    });
    this.mainwindow.on("close", async (e) => {
      if (!this.config.development && !this.mainwindow.allowexit) {
        if (this.multicastClient.clientinfo.token) {
          const allowTray = !platformDispatcher_default._isGNOME();
          if (!allowTray) {
            log7.warn(`windowhandler @ createMainWindow: GNOME detected, quitting instead of tray minimize`);
            this.mainwindow.allowexit = true;
            return;
          }
          e.preventDefault();
          await this.showMinimizeWarning();
          log7.warn(`windowhandler @ createMainWindow: Minimizing Next-Exam to Systemtray`);
          this.mainwindow.hide();
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
    if (app2.isPackaged || process.env["DEBUG"]) {
      const filePath = join4(__dirname3, "../renderer/index.html");
      log7.info(`windowhandler @ createMainWindow: Loading file: ${filePath}`);
      this.mainwindow.loadFile(filePath);
    } else {
      const url = `${"http://localhost:9300"}`;
      log7.info(`windowhandler @ createMainWindow: Loading URL: ${url}`);
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
      app2.quit();
    } finally {
      this.exitWarningOpen = false;
    }
  }
  async showExitQuestion() {
    if (this.exitQuestionOpen) {
      log7.info("Windowhandler @ showExitQuestion: dialog already open, skipping");
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
        log7.info("Windowhandler @ showExitQuestion: do not close Next-Exam after finished Exam");
      } else {
        this.mainwindow.allowexit = true;
        app2.quit();
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
            log7.warn(`windowhandler @ windowTracker: focus lost event was triggered. app: ${wpath} - ${name} `);
          }
          this.multicastClient.clientinfo.focus = false;
          this.focusTargetAllowed = false;
        }
      }
    } catch (err) {
      log7.error(`windowhandler @ windowTracker: ${err}`);
    }
  }
  //adds blur listener when entering exammode   // blur event isnt fired on macos MISSIONCONTROL (which cant be deactivated anymore) - damn you apple!
  addBlurListener(window = "examwindow") {
    if (window === "examwindow") {
      log7.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}`);
      this.examwindow.addListener("blur", () => this.blurevent(this));
    } else if (window === "screenlock") {
      log7.info(`windowhandler @ addBlurListener: Setting Blur Event for ${window}window`);
      for (let screenlockwindow of this.screenlockwindows) {
        screenlockwindow.addListener("blur", () => this.blureventScreenlock(this));
      }
    }
  }
  //removes blur listener when leaving exam mode
  removeBlurListener() {
    if (this.examwindow) {
      this.examwindow.removeAllListeners("blur");
      log7.info("windowhandler @ removeBlurListener: removing blur listener");
    }
  }
  // implementing a sleep (wait) function
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  //student fogus went to another window
  async blurevent(winhandler) {
    log7.info("windowhandler @ blurevent: student tried to leave exam window");
    if (process.platform !== "linux") {
      await this.windowTracker();
      log7.info("windowtracker check done...");
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
      log7.warn(`windowhandler @ blurevent: blurevent was triggered but target is allowed`);
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
    log7.info("windowhandler @ blureventScreenlock: blur-screenlock triggered");
    try {
      winhandler.screenlockwindows[0].show();
      winhandler.screenlockwindows[0].moveTop();
      winhandler.screenlockwindows[0].focus();
    } catch (err) {
      log7.error(`windowhandler @ blureventScreenlock: ${err}`);
    }
  }
};
var windowhandler_default = new WindowHandler();

// src-electron/main/scripts/communicationhandler.js
import fs4 from "fs";
import archiver from "archiver";
import extract from "extract-zip";
import { join as join5 } from "path";
import { screen as screen2, ipcMain as ipcMain2, app as app8, BrowserWindow as BrowserWindow2, webContents as webContents2 } from "electron";

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
import { ipcMain, clipboard as clipboard2, app as app7, webContents } from "electron";
import { gateway4sync } from "default-gateway";
import os4 from "os";
import log13 from "electron-log";
import mammoth from "mammoth";

// src-electron/main/scripts/lt-server.js
import path4 from "path";
import log9 from "electron-log";
import { app as app4 } from "electron";

// src-electron/main/scripts/jre-handler.js
import fs2 from "fs";
import path3 from "path";
import process2 from "process";
import { spawn as spawn2 } from "child_process";
import { app as app3 } from "electron";
import log8 from "electron-log";
var __dirname4 = import.meta.dirname;
var JreHandler = class {
  constructor() {
  }
  init() {
    this.jTest();
  }
  jTest() {
    let javapath = this.driver();
    const proc = spawn2(javapath, ["-version"]);
    proc.stderr.on("data", (data) => {
      const lines = data.toString().split("\n");
      log8.debug(`jre-handler @ jTest: ${lines[0]}`);
    });
  }
  fail(reason) {
    log8.error(reason);
    process2.exit(1);
  }
  getDirectories(dirPath) {
    let dirs = fs2.readdirSync(dirPath).filter(
      (file) => fs2.statSync(path3.join(dirPath, file)).isDirectory()
    );
    return dirs;
  }
  driver() {
    var d = platformDispatcher_default.javaBin.slice();
    d.unshift(platformDispatcher_default.jreDir);
    return path3.join.apply(path3, d);
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
    log8.info(`jre-handler @ jSpawn: '${platformDispatcher_default.jre}' selected`);
    log8.info(`jre-handler @ jSpawn: spawning java process: ${javacmdline}`);
    return spawn2(javapath, javaargs, { shell: false });
  }
};
var jre_handler_default = new JreHandler();

// src-electron/main/scripts/lt-server.js
import { exec } from "child_process";
import os2 from "os";
var __dirname5 = import.meta.dirname;
var languageToolJarPath = path4.join(__dirname5, "../../public/LanguageTool/languagetool-server.jar");
if (app4.isPackaged) {
  languageToolJarPath = path4.join(process.resourcesPath, "app.asar.unpacked", "public/LanguageTool/languagetool-server.jar");
}
var languageToolConfigPath = path4.join(__dirname5, "../../public/LanguageTool/server.properties");
if (app4.isPackaged) {
  languageToolConfigPath = path4.join(process.resourcesPath, "app.asar.unpacked", "public/LanguageTool/server.properties");
}
var LanguageToolServer = class {
  constructor() {
    this.languageToolProcess = null;
    this.port = 8088;
  }
  startServer() {
    if (this.languageToolProcess && !this.languageToolProcess.killed) {
      log9.warn("lt-server @ startserver: LanguageTool server is already running.");
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
      log9.info("lt-server @ startserver: LanguageTool API running at localhost:8088");
      this.languageToolProcess.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.toLowerCase().includes("error")) {
          log9.info("lt-server @ startserver  data-error:", output);
        }
        if (output.toLowerCase().includes("starting")) {
          log9.info("lt-server @ startserver  data-info:", output);
        }
        if (output.toLowerCase().includes("check done")) {
          log9.info("lt-server @ startserver  data-info:", output);
        }
        if (output.toLowerCase().includes("handled request")) {
          log9.info("lt-server @ startserver  data-info:", output);
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
          log9.warn("lt-server @ startserver: another LanguageTool server is probably already running on port:", this.port);
          stderrBuffer = "";
        } else if (chunk.includes("\n") || fullResponse.length > 200) {
          log9.error("lt-server @ startserver data-error:", fullResponse.trim());
          stderrBuffer = "";
        }
      });
      this.languageToolProcess.on("exit", (code) => {
        log9.warn(`lt-server @ startserver: LanguageTool server exited with code ${code}`);
        this.languageToolProcess = null;
      });
    } catch (err) {
      log9.error("lt-server @ startserver general-error:", err);
    }
  }
  stopServer() {
    if (!this.languageToolProcess) {
      log9.info("lt-server @ stopServer: LanguageTool server was never started, nothing to stop");
      return;
    }
    if (!this.languageToolProcess.killed) {
      try {
        this.languageToolProcess.kill();
        log9.info("lt-server @ stopServer: LanguageTool server process killed");
        this.languageToolProcess = null;
        return;
      } catch (err) {
        log9.warn("lt-server @ stopServer: failed to kill process directly, trying platform-specific method:", err);
      }
    }
    const platform = os2.platform();
    let command;
    if (platform === "win32") {
      command = `wmic process where "commandline like '%languagetool-server.jar%'" delete 2>nul || powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*languagetool-server.jar*'} | Stop-Process -Force" 2>nul || for /f "tokens=5" %a in ('netstat -ano ^| findstr :8088') do taskkill /F /PID %a 2>nul`;
    } else if (platform === "darwin" || platform === "linux") {
      command = "pkill -f languagetool-server.jar";
    } else {
      log9.warn("lt-server @ stopServer: unsupported platform:", platform);
      return;
    }
    exec(command, (error, stdout, stderr) => {
      if (error) {
        if (error.code !== 1 && !error.message.includes("not found") && !stderr.toString().includes("No such process")) {
          log9.warn("lt-server @ stopServer: error killing LanguageTool server:", error.message);
        } else {
          log9.info("lt-server @ stopServer: LanguageTool server process not found (may already be stopped)");
        }
      } else {
        log9.info("lt-server @ stopServer: LanguageTool server stopped successfully");
      }
      this.languageToolProcess = null;
    });
  }
};
var lt_server_default = new LanguageToolServer();

// src-electron/main/scripts/traymenu.js
import { app as app5, Tray, Menu } from "electron";
import path5 from "path";
import log10 from "electron-log";
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
        log10.info("main @ systemtray: removing registration");
        communicationhandler_default.resetConnection();
      }
    },
    // disconnect
    {
      label: t2("main.tray.exit"),
      click: () => {
        log10.warn("main @ systemtray: Closing Next-Exam");
        log10.warn("main @ systemtray: ----------------------------------------");
        windowhandler_default.mainwindow.allowexit = true;
        app5.quit();
      }
    }
    // exit
  ]);
  tray.setToolTip("Next-Exam Student");
  tray.setContextMenu(contextMenu);
};

// src-electron/main/scripts/testpermissionsMac.js
import { exec as exec2 } from "child_process";
import { dialog as dialog2, app as app6 } from "electron";
import log11 from "electron-log";
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
    log11.info(`testpermissionsMac @ ensureNetworkOrReset: Network access is allowed`);
    return "ok";
  }
  log11.warn(`testpermissionsMac @ ensureNetworkOrReset: No HTTP requests allowed!`);
  try {
    let choice = await dialog2.showMessageBox({
      type: "question",
      message: "Der Server ist nicht erreichbar. M\xF6chten Sie die Berechtigungen zur\xFCcksetzen und Next-Exam manuell neu starten?",
      buttons: ["OK", "Abbrechen"]
    });
    if (choice.response === 0) {
      log11.warn(`testpermissionsMac @ ensureNetworkOrReset: Resetting network permissions and quitting app`);
      await resetTCC();
      return "reset";
    } else {
      return false;
    }
  } catch (e) {
    log11.error(`testpermissionsMac @ ensureNetworkOrReset: Error resetting network permissions: ${e}`);
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
import log12 from "electron-log";
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
        log12.error("getWlanInfoLinux: nmcli command failed:", nmcliError.message || nmcliError);
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
          log12.error("getWlanInfoLinux: iw command failed:", iwError.message || iwError);
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
            log12.error("getWlanInfoLinux: All methods (nmcli, iw, iwconfig) failed. Last error:", iwconfigError.message || iwconfigError);
          }
        }
      }
    }
  } catch (error) {
    log12.error("getWlanInfoLinux: Unexpected error:", error.message || error);
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
    log12.error("getWlanInfoWindows: Error executing netsh command:", error.message || error);
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
    log12.error("getWlanInfoWindowsPowerShell: PowerShell fallback failed:", error.message || error);
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
        log12.error("getWlanInfoMacOS: airport command failed:", airportError.message || airportError);
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
      log12.error("getWlanInfoMacOS: networksetup/ipconfig fallback failed:", networksetupError.message || networksetupError);
      return { ssid: null, bssid: null, quality: null, message: "error" };
    }
  } catch (error) {
    log12.error("getWlanInfoMacOS: Unexpected error:", error.message || error);
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
      log13.info(`ipchandler @ set-new-locale: setting new locale to ${locale}`);
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
        }).catch((err) => log13.error(`ipchandler @ getExamMaterials: ${err}`));
        return examMaterials;
      }
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
      if (targetUrl.includes("googlesyndication.com")) return true;
      return false;
    };
    ipcMain.handle("start-blocking-for-webview", (event, { guestId, allowedUrls }) => {
      const guest = webContents.fromId(Number(guestId));
      if (!guest || guest.isDestroyed?.()) return false;
      guest.removeAllListeners("will-navigate");
      const allow = allowedUrls.map((s) => String(s).toLowerCase());
      const isUrlAllowed = (targetUrl) => {
        if (!targetUrl) return false;
        const urlStr = String(targetUrl).toLowerCase();
        if (checkCommonExceptions(urlStr)) return true;
        for (const allowedUrl of allow) {
          try {
            const urlObj = new URL(targetUrl);
            const targetHostname = urlObj.hostname.toLowerCase();
            let allowedDomain = allowedUrl;
            if (allowedUrl.startsWith("http://") || allowedUrl.startsWith("https://")) {
              const allowedUrlObj = new URL(allowedUrl);
              allowedDomain = allowedUrlObj.hostname.toLowerCase();
            } else if (allowedUrl.includes("/")) {
              const parts = allowedUrl.split("/");
              allowedDomain = parts[0].toLowerCase();
            }
            if (targetHostname === allowedDomain) return true;
            const isSpecificSubdomain = allowedDomain.includes(".");
            if (isSpecificSubdomain) {
              if (targetHostname === "www." + allowedDomain) return true;
            } else {
              if (targetHostname === "www." + allowedDomain) return true;
              if (targetHostname.endsWith("." + allowedDomain)) {
                const prefix = targetHostname.slice(0, -(allowedDomain.length + 1));
                if (prefix && !prefix.includes(".") && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(prefix)) {
                  return true;
                }
              }
            }
          } catch (error) {
            if (urlStr.includes(allowedUrl)) return true;
          }
        }
        return false;
      };
      guest.setWindowOpenHandler(({ url }) => {
        const isAllowed = isUrlAllowed(url);
        if (isAllowed) {
          guest.loadURL(url);
          log13.warn("ipchandler @ start-blocking-for-webview: allowed navigation to", url);
        } else return { action: "deny" };
      });
      guest.on("will-navigate", (e, url) => {
        const isAllowed = isUrlAllowed(url);
        if (!isAllowed) {
          e.preventDefault();
          log13.warn("ipchandler @ start-blocking-for-webview: blocked navigation to", url);
        }
      });
      return true;
    });
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
            if (domain === "www." + allowedDomain) return true;
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
          log13.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed window.open to`, url);
          guest.loadURL(url);
          return { action: "deny" };
        } else {
          log13.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked window.open to`, url);
          return { action: "deny" };
        }
      });
      guest.on("will-navigate", (e, url) => {
        if (!isUrlAllowed(url)) {
          log13.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked navigation to`, url);
          e.preventDefault();
          guest.stop();
        } else {
          log13.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed navigation to`, url);
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
      log13.info("ipchandler @ locallockdown: locking down client without teacher connection");
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
      log13.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest);
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
        log13.warn(`ipchandler @ focuslost: mouseleave event was triggered but target is allowed`);
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
      log13.info(`ipchandler @ gracefullyexit: gracefully leaving locked exam mode`);
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
        log13.error("ipcHandler @ checkhostip: multicastclient not running");
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
          log13.error("ipcHandler @ checkhostip: Unable to determine ip address", e);
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
          log13.error("ipcHandler @ checkhostip: Error initializing multicast client", err);
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
      }
      const htmlfile = path6.join(this.config.examdirectory, htmlfilename);
      if (htmlContent) {
        try {
          fs3.writeFile(htmlfile, htmlContent, (err) => {
            if (err) {
              log13.error(`ipchandler @ storeHTML: ${err.message}`);
              let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`;
              log13.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath);
              fs3.writeFile(alternatepath, htmlContent, function(err2) {
                if (err2) {
                  log13.error(err2.message);
                  log13.error("ipchandler @ storeHTML: giving up");
                  event.reply("fileerror", { sender: "client", message: err2, status: "error" });
                } else {
                  log13.info("ipchandler @ storeHTML: success!");
                  event.reply("loadfilelist");
                }
              });
            }
            event.reply("loadfilelist");
          });
        } catch (err) {
          log13.error(err);
          event.returnValue = { sender: "client", message: err, status: "error" };
        }
      }
    });
    ipcMain.handle("getPDFbase64", async (event, args) => {
      log13.info("ipchandler @ getPDFbase64: getting base64 encoded pdf");
      this.multicastClient.clientinfo.submissionnumber = args.submissionnumber + 1;
      let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground);
      return result;
    });
    ipcMain.on("printpdf", (event, args) => {
      if (!this.multicastClient?.clientinfo?.exammode) {
        log13.warn("ipchandler @ printpdf: exammode is false - skipping print");
        return;
      }
      if (this.isPrintingPdf) {
        log13.warn("ipchandler @ printpdf: print already in progress - skipping new request");
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
          log13.error(`ipchandler @ printpdf: ${err.message}`);
        }
        const examWindow = this.WindowHandler.examwindow;
        const webContents3 = examWindow?.webContents;
        if (!webContents3) {
          log13.error("ipchandler @ printpdf: no webContents found for examwindow");
          event.reply("fileerror", { sender: "client", message: "no webContents found for examwindow", status: "error" });
          return;
        }
        this.isPrintingPdf = true;
        const pdfTitle = args.filename ? args.filename : `${this.multicastClient.clientinfo.name} - ${args.servername || this.multicastClient.clientinfo.servername || ""}`;
        const escapedTitle = pdfTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'");
        webContents3.executeJavaScript(`document.title = "${escapedTitle}"`).then(() => {
          return webContents3.printToPDF(options);
        }).then((data) => {
          try {
            if (fs3.existsSync(pdffilepath)) {
              fs3.unlinkSync(pdffilepath);
            }
          } catch (err) {
            log13.error(`ipchandler @ printpdf: ${err.message}`);
          }
          fs3.writeFile(pdffilepath, data, (err) => {
            if (err) {
              log13.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `);
              try {
                if (fs3.existsSync(alternatepath)) {
                  fs3.unlinkSync(alternatepath);
                }
              } catch (err2) {
                log13.error(`ipchandler @ printpdf (alternativer Pfad): ${err2.message}`);
              }
              fs3.writeFile(alternatepath, data, (err2) => {
                if (err2) {
                  log13.error(err2.message);
                  log13.error("ipchandler @ printpdf: giving up");
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
          log13.error(`ipchandler @ printpdf: ${error.message}`);
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
        log13.info(`ipchandler @ saveActivesheetsBak: saved form data to ${bakFilename}`);
      } catch (error) {
        log13.error(`ipchandler @ saveActivesheetsBak: ${error.message}`);
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
          log13.info(`ipchandler @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
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
        log13.error(`ipchandler @ register: ${errorMessage}`);
        if (process.platform === "darwin") {
          let response = await ensureNetworkOrReset(serverip, this.config.serverApiPort);
          if (response && response === "reset") {
            app7.quit();
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
          log13.error(`ipchandler @ saveGGB: ${err}`);
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
            log13.error(`ipchandler @ getfilesasync: ${err}`);
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
          log13.error(`ipchandler @ getfilesasync: ${err}`);
          return false;
        }
      }
    });
    ipcMain.handle("getbackupfile", async (event, filename) => {
      log13.info(`ipchandler @ getbackupfile: Request received for filename: ${filename}`);
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path6.join(workdir, filename);
        log13.info(`ipchandler @ getbackupfile: Full file path: ${filepath}`);
        try {
          if (!fs3.existsSync(filepath)) {
            log13.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`);
            return false;
          }
          log13.info(`ipchandler @ getbackupfile: backup file exists, reading content`);
          let data = fs3.readFileSync(filepath, "utf8");
          log13.info(`ipchandler @ getbackupfile: Successfully read backup file, content length: ${data.length}`);
          return data;
        } catch (err) {
          log13.error(`ipchandler @ getbackupfile: Error reading backup file: ${err}`);
          log13.error(`ipchandler @ getbackupfile: Error stack: ${err.stack}`);
          return false;
        }
      } else {
        log13.warn(`ipchandler @ getbackupfile: no filename provided`);
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
        if (app7.isPackaged) {
          pdfPath = path6.join(process.resourcesPath, "app.asar.unpacked", "public", pdfFilename);
        } else {
          pdfPath = path6.join(__dirname10, "../../public", pdfFilename);
        }
        if (!fs3.existsSync(pdfPath)) {
          log13.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
          return null;
        }
        const buffer = fs3.readFileSync(pdfPath);
        return buffer.toString("base64");
      } catch (error) {
        log13.error(`ipchandler @ getPdfFromPublic: Error: ${error.message}`, error);
        return null;
      }
    });
  }
  isVirtualMachine() {
    const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|microsoft|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|google|azure)/i;
    const warnAndReturn = (reason) => {
      log13.warn(`ipchandler @ isVirtualMachine: Verdacht auf VM - ${reason}`);
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
import log14 from "electron-log";
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
    log14.debug("communicationhandler @ setupImageWorker: ImageWorker initialized. Using " + platformDispatcher_default.workerFileName);
    this.worker.on("error", (error) => {
      log14.error("communicationhandler @ setupImageWorker: Worker error:", error);
    });
    this.worker.on("exit", (code) => {
      if (code !== 0) {
        this.workerFails += 1;
        if (this.workerFails > 4) {
          this.useWorker = false;
          log14.error("communicationhandler @ setupImageWorker: Worker failed 5 times - switching to no processing");
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
        log14.warn("main @ ready: Possible remote assistance detected");
        for (const keyword of usesRemoteAssistant.keywords) {
          log14.warn(`main @ ready: Keyword ${keyword} detected`);
        }
        for (const port of usesRemoteAssistant.ports) {
          log14.warn(`main @ ready: Port ${port} detected`);
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
        log14.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.");
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
            log14.warn("communicationhandler @ requestUpdate: Exam Instance not found!");
            this.multicastClient.beaconsLost = 5;
          } else if (data.message === "removed") {
            log14.warn("communicationhandler @ requestUpdate: Student registration not found!");
            this.kickStudent();
          } else {
            log14.warn(`communicationhandler @ requestUpdate: ${this.multicastClient.beaconsLost} Heartbeat lost..`);
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
        log14.error(`communicationhandler @ requestUpdate: (${this.multicastClient.beaconsLost}) ${error}`);
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
        log14.error(`communicationhandler @ sendScreenshot: processImage failed: ${err}`);
      }
      if (process.platform === "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = app8.isPackaged ? path7.join(process.resourcesPath, "app.asar.unpacked", "public") : path7.resolve(__dirname8, "../../public");
        try {
          const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng", { langPath: publicPath });
          let appWindowVisible = text.includes("Exam");
          if (!appWindowVisible) {
            platformDispatcher_default.screenshotAbility = false;
            log14.warn("communicationhandler @ sendScreenshot (macos): Please check your screenshot permissions - Switching to PageCapture");
          } else {
            log14.info("communicationhandler @ sendScreenshot (macos): MacOS screenshotpermissions check OK");
          }
        } catch (err) {
          log14.error(`communicationhandler @ sendScreenshot (macos): ${err}`);
        }
      }
      if (!screenshotBase64) {
        if (this.screenshotFails > 4 && platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.screenshotAbility = false;
          log14.error(`communicationhandler @ sendScreenshot: Screenshot error -> Switching to PageCapture`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.useWorker = false;
          log14.error(`communicationhandler @ sendScreenshot: PageCapture error -> Switching to No-Processing`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility && !platformDispatcher_default.useWorker) {
          log14.error(`communicationhandler @ sendScreenshot: no screenshot available - please fix your setup`);
        }
        return;
      }
      if (this.multicastClient.clientinfo.exammode && !this.config.development && this.multicastClient.clientinfo.focus) {
        if (isblack) {
          this.multicastClient.clientinfo.focus = false;
          log14.info("communicationhandler @ sendScreenshot: Student Screenshot does not fit requirements (allblack)");
        }
      }
      let screenshothash = null;
      try {
        screenshothash = crypto.createHash("md5").update(Buffer.from(screenshotBase64, "base64")).digest("hex");
      } catch (err) {
        log14.error(`communicationhandler @ sendScreenshot: creating hash failed: ${err.message}`);
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
        log14.error("communicationhandler @ doScreenshotUpdate: Status Error:", data.message);
      }
    }).catch((error) => {
      if (attempt < maxRetries - 1) {
        this.doScreenshotUpdate(url, payload, agent2, attempt + 1, maxRetries);
      } else if (attempt === maxRetries - 1 && this.multicastClient.beaconsLost === 0) {
        log14.error(`communicationhandler @ doScreenshotUpdate (fetch): ${error.message}`);
      }
    });
  }
  async kickStudent(studentstatus) {
    log14.warn("communicationhandler @ kickStudent: Student got kicked by Teacher");
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
        log14.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder");
        let delfolder = true;
        try {
          if (fs4.existsSync(this.config.examdirectory)) {
            fs4.rmSync(this.config.examdirectory, { recursive: true });
            fs4.mkdirSync(this.config.examdirectory);
          }
        } catch (error) {
          delfolder = false;
          windowhandler_default.examwindow.webContents.send("fileerror", error);
          log14.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `);
        }
        if (delfolder == false) {
          if (fs4.existsSync(this.config.examdirectory)) {
            const files = fs4.readdirSync(this.config.examdirectory);
            files.forEach((file) => {
              const filePath = join5(this.config.examdirectory, file);
              try {
                const stats = fs4.statSync(filePath);
                if (stats.isDirectory()) {
                  fs4.rmSync(filePath, { recursive: true });
                } else {
                  fs4.unlinkSync(filePath);
                }
              } catch (error) {
                log14.error(`communicationhandler @ processUpdatedServerstatus: (delfolder) Fehler beim L\xF6schen der Datei/Verzeichnis: ${filePath}`, error);
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
        log14.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student");
        this.multicastClient.clientinfo.focus = true;
        if (windowhandler_default.examwindow && !this.config.development) {
          windowhandler_default.examwindow.setKiosk(true);
          windowhandler_default.examwindow.focus();
        }
      }
      if (studentstatus.activatePrivateSpellcheck == true && this.multicastClient.clientinfo.privateSpellcheck.activated == false) {
        log14.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student");
        this.multicastClient.clientinfo.privateSpellcheck.activate = true;
        this.multicastClient.clientinfo.privateSpellcheck.activated = true;
        ipcMain2.emit("startLanguageTool");
      }
      if (studentstatus.activatePrivateSpellcheck == false && this.multicastClient.clientinfo.privateSpellcheck.activated == true) {
        log14.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student");
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
      if (studentstatus.getmaterials === true) {
        if (windowhandler_default.examwindow) {
          windowhandler_default.examwindow.webContents.send("getmaterials");
        }
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
        log14.warn(`communicationhandler @ processUpdatedServerstatus: changing section to ${serverstatus.lockedSection} ${serverstatus.examSections[serverstatus.lockedSection].sectionname} , Examtype: ${serverstatus.examSections[serverstatus.lockedSection].examtype}`);
        const currentLockedSection = this.multicastClient.clientinfo.lockedSection;
        const newLockedSection = serverstatus.lockedSection;
        const examDir = this.config.examdirectory;
        if (this.multicastClient.clientinfo.examtype === "editor") {
          log14.info("communicationhandler @ processUpdatedServerstatus: sending exam to teacher (final submit)");
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
            log14.debug(`communicationhandler @ processUpdatedServerstatus: Saving content from examDir to section ${currentLockedSection}`);
            const savePath = `${examDir}/${currentLockedSection}`;
            if (!fs4.existsSync(savePath)) {
              fs4.mkdirSync(savePath, { recursive: true });
            }
            const files = fs4.readdirSync(examDir);
            log14.info(`communicationhandler @ processUpdatedServerstatus: Found ${files.length} items in examDir to save`);
            let filesSaved = 0;
            for (const file of files) {
              const oldPath = `${examDir}/${file}`;
              const stat = fs4.statSync(oldPath);
              if (stat.isFile()) {
                const newPath = `${savePath}/${file}`;
                fs4.copyFileSync(oldPath, newPath);
                fs4.unlinkSync(oldPath);
                filesSaved++;
                log14.info(`communicationhandler @ processUpdatedServerstatus: Saved file ${file} to section ${currentLockedSection}`);
              } else {
                log14.info(`communicationhandler @ processUpdatedServerstatus: Skipping non-file (folder) item ${file} in examDir`);
              }
            }
            log14.info(`communicationhandler @ processUpdatedServerstatus: Successfully saved ${filesSaved} files to section ${currentLockedSection}`);
          } else {
            log14.warn(`communicationhandler @ processUpdatedServerstatus: Skipping save - examDir exists: ${fs4.existsSync(examDir)}, currentLockedSection: ${currentLockedSection}`);
          }
          if (newLockedSection != null && newLockedSection !== void 0) {
            log14.debug(`communicationhandler @ processUpdatedServerstatus: Loading content from section ${newLockedSection} to examDir`);
            const loadPath = `${examDir}/${newLockedSection}`;
            if (fs4.existsSync(loadPath)) {
              const filesToLoad = fs4.readdirSync(loadPath);
              log14.info(`communicationhandler @ processUpdatedServerstatus: Found ${filesToLoad.length} items in section ${newLockedSection} directory`);
              let filesCopied = 0;
              for (const file of filesToLoad) {
                const sourcePath = `${loadPath}/${file}`;
                const destPath = `${examDir}/${file}`;
                const stat = fs4.statSync(sourcePath);
                if (stat.isFile()) {
                  fs4.copyFileSync(sourcePath, destPath);
                  filesCopied++;
                  log14.info(`communicationhandler @ processUpdatedServerstatus: Copied file ${file} from section ${newLockedSection} to examDir`);
                } else {
                  log14.warn(`communicationhandler @ processUpdatedServerstatus: Skipping non-file item ${file} in section ${newLockedSection} directory`);
                }
              }
              log14.info(`communicationhandler @ processUpdatedServerstatus: Successfully copied ${filesCopied} files from section ${newLockedSection} to examDir`);
            } else {
              log14.info(`communicationhandler @ processUpdatedServerstatus: New locked section directory ${newLockedSection} does not exist. Starting with a clean state.`);
            }
          } else {
            log14.warn(`communicationhandler @ processUpdatedServerstatus: newLockedSection is falsy (${newLockedSection}), skipping file load`);
          }
        } catch (error) {
          log14.error(`communicationhandler @ processUpdatedServerstatus: Error during folder operation - ${error}`);
          log14.error(`communicationhandler @ processUpdatedServerstatus: Error stack: ${error.stack}`);
          log14.error(`communicationhandler @ processUpdatedServerstatus: currentLockedSection: ${currentLockedSection}, newLockedSection: ${newLockedSection}, examDir: ${examDir}`);
        }
        if (windowhandler_default.examwindow) {
          if (this.config.development) {
            webContents2.getAllWebContents().forEach((wc) => {
              if (wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
                log14.info("communicationhandler @ switchExamSection: destroying devtools window");
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
        log14.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to", serverstatus.screenshotinterval * 1e3);
        this.multicastClient.clientinfo.screenshotinterval = serverstatus.screenshotinterval * 1e3;
        if (serverstatus.screenshotinterval == 0) {
          log14.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!");
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
    log14.info("communicationhandler @ getBase64PDF: getting base64 encoded pdf");
    let waitCount = 0;
    const maxWait = 300;
    while (ipchandler_default.isPrintingPdf && waitCount < maxWait) {
      await this.sleep(100);
      waitCount++;
    }
    if (ipchandler_default.isPrintingPdf) {
      log14.error("communicationhandler @ getBase64PDF: printToPDF lock timeout - another print operation is still running");
      return { sender: "client", message: "PDF generation timeout - another print operation is in progress", status: "error" };
    }
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
    await windowhandler_default.examwindow.webContents.executeJavaScript(`document.title = "${this.multicastClient.clientinfo.name} - ${this.multicastClient.clientinfo.servername} - Version ${submissionnumber}"`);
    ipchandler_default.isPrintingPdf = true;
    try {
      const data = await windowhandler_default.examwindow.webContents.printToPDF(options);
      const base64pdf = data.toString("base64");
      const dataUrl = `data:application/pdf;base64,${base64pdf}`;
      return { sender: "client", message: "PDF generated", dataUrl, base64pdf, status: "success" };
    } catch (error) {
      log14.error("communicationhandler @ getBase64PDF: Error generating PDF:", error);
      return { sender: "client", message: "Error generating PDF", status: "error" };
    } finally {
      ipchandler_default.isPrintingPdf = false;
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
      log14.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle");
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
      log14.warn("communicationhandler @ startExam: Dialog is still open - exam will start anyway");
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
      log14.info("communicationhandler @ startExam: creating exam window");
      this.multicastClient.clientinfo.examtype = serverstatus.examSections[serverstatus.lockedSection].examtype;
      windowhandler_default.createExamWindow(serverstatus.examSections[serverstatus.lockedSection].examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
    } else if (windowhandler_default.examwindow) {
      log14.error("communicationhandler @ startExam: found existing Examwindow..");
      try {
        windowhandler_default.examwindow.show();
        if (!this.config.development) {
          windowhandler_default.examwindow.setFullScreen(true);
          windowhandler_default.examwindow.setAlwaysOnTop(true, "screen-saver", 1);
          await enableRestrictions(windowhandler_default);
          await this.sleep(2e3);
          windowhandler_default.addBlurListener();
          await this.sleep(500);
          await windowhandler_default.initBlockWindows();
          windowhandler_default.examwindow.moveTop();
          windowhandler_default.examwindow.focus();
        }
      } catch (e) {
        log14.error("communicationhandler @ startExam: no functional examwindow found.. resetting");
        disableRestrictions(windowhandler_default.examwindow);
        windowhandler_default.examwindow = null;
        this.multicastClient.clientinfo.exammode = false;
        this.multicastClient.clientinfo.focus = true;
        this.multicastClient.clientinfo.token = false;
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
      log14.info("communicationhandler @ endExam: cleaning exam workfolder on exit");
      try {
        if (fs4.existsSync(this.config.examdirectory)) {
          fs4.rmSync(this.config.examdirectory, { recursive: true });
          fs4.mkdirSync(this.config.examdirectory);
        }
      } catch (error) {
        log14.error("communicationhandler @ endExam: ", error);
      }
    }
    if (windowhandler_default.examwindow) {
      try {
        if (this.config.development || this.config.showdevtools) {
          const allWebContents = webContents2.getAllWebContents();
          for (const wc of allWebContents) {
            if (windowhandler_default.examwindow && wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
              log14.info("communicationhandler @ endExam: destroying devtools window");
              wc.closeDevTools();
            }
          }
          await this.sleep(1e3);
        }
        this.closeExamWindowSafely();
      } catch (e) {
        log14.error("communicationhandler @ endExam: ", e);
      }
      try {
        for (let blockwindow of windowhandler_default.blockwindows) {
          blockwindow.close();
          blockwindow.destroy();
          blockwindow = null;
        }
      } catch (e) {
        windowhandler_default.blockwindows = [];
        log14.error("communicationhandler @ endExam: no functional blockwindow to handle");
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
      log14.warn("communicationhandler @ closeExamWindowSafely: printToPDF in progress - retry in 1s");
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
      log14.error("communicationhandler @ closeExamWindowSafely: error while closing examwindow", e);
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
      let absoluteFilepath = join5(this.config.tempdirectory, token.concat(".zip"));
      fs4.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
        if (err) {
          log14.error(err);
        } else {
          extract(absoluteFilepath, { dir: this.config.examdirectory }).then(() => {
            log14.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
            return fs4.promises.unlink(absoluteFilepath);
          }).then(() => {
            if (backupfile && windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("backup", backupfile);
              log14.warn("CommunicationHandler @ requestFileFromServer: Trigger Replace Event");
            }
            if (windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("loadfilelist");
            }
          }).catch((err2) => {
            log14.error(err2);
          });
        }
      });
    }).catch((err) => log14.error(`CommunicationHandler - requestFileFromServer: ${err}`));
  }
  async sendExamToTeacher() {
    if (windowhandler_default.examwindow) {
      try {
        windowhandler_default.examwindow.webContents.send("save", "teacherrequest");
      } catch (err) {
        log14.error(`Communication handler @ sendExamToTeacher: Could not save students work. Is exammode active?`);
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
      log14.error(e);
    }
    let logfilepath = platformDispatcher_default.logfile;
    if (fs4.existsSync(logfilepath)) {
      try {
        fs4.copyFileSync(logfilepath, join5(this.config.examdirectory, "next-exam-student.log"));
      } catch (e) {
        log14.error("communicationhandler @ sendToTeacher: could not copy logfile to examdirectory");
      }
    }
    let zipfilename = this.multicastClient.clientinfo.name.concat(".zip");
    let servername = this.multicastClient.clientinfo.servername;
    let serverip = this.multicastClient.clientinfo.serverip;
    let token = this.multicastClient.clientinfo.token;
    let zipfilepath = join5(this.config.tempdirectory, zipfilename);
    let base64File = null;
    try {
      await this.zipDirectory(this.config.examdirectory, zipfilepath);
      const fileContent = fs4.readFileSync(zipfilepath);
      base64File = fileContent.toString("base64");
    } catch (e) {
      log14.error(e);
    }
    const url = `https://${serverip}:${this.config.serverApiPort}/server/data/receive/${servername}/${token}`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: base64File, filename: zipfilename })
    }).then((response) => response.json()).then((data) => {
      log14.info(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`);
    }).catch((error) => {
      log14.error(`communicationhandler @ sendExamToTeacher: ${error}`);
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
      log14.error(error);
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
import log15 from "electron-log";
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
    log15.error(`checkparent @ getProcessInfoWindows: Error for PID ${pid}: ${error.message}`);
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
    log15.error(`checkparent @ getProcessInfoUnix: Error for PID ${pid}: ${error.message}`);
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
    log15.info("checkparent @ findParentProcess: Root PID reached. No web browser found.");
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
  log15.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
  if (browserKeywords.some((browser) => name.includes(browser))) {
    log15.info(`checkparent @ findParentProcess: Browser found: ${name}`);
    return true;
  } else if (name.includes("explorer") || ppid <= 1) {
    log15.info(`checkparent @ findParentProcess: Reached system process or explorer`);
    return false;
  } else {
    return await findParentProcess(ppid, maxDepth - 1, visitedPids);
  }
}
async function checkParentProcess() {
  try {
    const foundBrowser = await findParentProcess(process.ppid, 6, /* @__PURE__ */ new Set());
    log15.info(`checkparent @ checkParentProcess: Browser detection result: ${foundBrowser}`);
    return { success: true, foundBrowser };
  } catch (error) {
    log15.error(`checkparent @ checkParentProcess: Error in browser detection: ${error.message}`);
    return { success: false, foundBrowser: false, error: error.message };
  }
}

// src-electron/electron-main.js
jre_handler_default.init();
app9.commandLine.appendSwitch("lang", "de");
app9.commandLine.appendSwitch("enable-unsafe-swiftshader");
app9.commandLine.appendSwitch("log-level", "3");
if (process.platform === "linux") {
  app9.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,OutOfProcessRasterization,CanvasOopRasterization");
  app9.commandLine.appendSwitch("disable-zero-copy");
} else if (process.platform === "darwin") {
  app9.commandLine.appendSwitch("enable-features", "Metal,CanvasOopRasterization");
}
log16.initialize();
log16.eventLogger.startLogging();
log16.errorHandler.startCatching();
log16.transports.file.resolvePathFn = () => {
  return platformDispatcher_default.logfile;
};
log16.transports.console.format = (message) => {
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
log16.verbose();
log16.verbose(`main: -------------------`);
log16.verbose(`main: starting Next-Exam Student "${config_default.version} ${config_default.info}" (${process.platform})${config_default.development ? " (devmode on)" : ""}`);
log16.verbose(`main: -------------------`);
log16.info(`main: Logfilelocation at ${platformDispatcher_default.logfile}`);
platformDispatcher_default.messages.forEach((message) => {
  log16.debug(message);
});
log16.debug(`main: Electron version: ${process.versions.electron}`);
log16.debug(`main: Chromium version: ${process.versions.chrome}`);
log16.debug(`main: Node version: ${process.versions.node}`);
log16.debug(`main: V8 version: ${process.versions.v8}`);
log16.debug(`main: OS: ${process.platform} ${process.arch}`);
log16.debug(`main: Arch: ${process.arch}`);
windowhandler_default.init(multicastclient_default, config_default);
communicationhandler_default.init(multicastclient_default, config_default);
ipchandler_default.init(multicastclient_default, config_default, windowhandler_default, communicationhandler_default);
Menu2.setApplicationMenu(null);
if (!app9.requestSingleInstanceLock()) {
  log16.warn("main @ singleinstance: next-exam already running.");
  app9.quit();
  process.exit(0);
}
app9.on("second-instance", () => {
  log16.warn("main @ singleinstance: prevented second start of next-exam. Restoring existing Next-Exam window.");
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
  log16.error("main @ create-symlink: can't create symlink");
}
try {
  const { gateway, interface: iface } = gateway4sync2();
  config_default.hostip = ip2.address(iface);
  config_default.gateway = true;
} catch (e) {
  log16.error("main @ gateway4sync: unable to determine default gateway");
  config_default.hostip = ip2.address();
  log16.info(`main: IP ${config_default.hostip}`);
  config_default.gateway = false;
}
fsExtra.emptyDirSync(config_default.tempdirectory);
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") {
    log16.transports.console.level = false;
  }
});
var originalStderrWrite = process.stderr.write;
var originalStdoutWrite = process.stdout.write;
process.stderr.write = function(chunk, encoding, fd) {
  const chunkStr = chunk?.toString() || "";
  if (chunkStr.includes("GUEST_VIEW_MANAGER_CALL") && (chunkStr.includes("ERR_ABORTED") || chunkStr.includes("(-3)"))) {
    return true;
  }
  if (chunkStr.includes("WebContents#did-fail-load") || chunkStr.includes("WebContents#did-fail-provisional-load")) {
    const suppressCodes = [-3, -100, -101, -105];
    if (chunkStr.includes("isMainFrame: false") || suppressCodes.some((code) => chunkStr.includes(`errorCode: ${code}`))) {
      return true;
    }
  }
  return originalStderrWrite.apply(this, arguments);
};
process.stdout.write = function(chunk, encoding, fd) {
  const chunkStr = chunk?.toString() || "";
  if (chunkStr.includes("GUEST_VIEW_MANAGER_CALL") && (chunkStr.includes("ERR_ABORTED") || chunkStr.includes("(-3)"))) {
    return true;
  }
  if (chunkStr.includes("WebContents#did-fail-load") || chunkStr.includes("WebContents#did-fail-provisional-load")) {
    const suppressCodes = [-3, -100, -101, -105];
    if (chunkStr.includes("isMainFrame: false") || suppressCodes.some((code) => chunkStr.includes(`errorCode: ${code}`))) {
      return true;
    }
  }
  return originalStdoutWrite.apply(this, arguments);
};
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE") {
    log16.transports.console.level = false;
    log16.warn("main @ uncaughtException: EPIPE Error: The stdout stream of the ElectronLogger will be disabled.");
  } else if (err.message?.includes("Render frame was disposed")) return;
  else {
    log16.error("main @ uncaughtException:", err.message);
  }
});
process.on("unhandledRejection", (reason, promise) => {
  log16.error("main @ unhandledRejection: Unhandled promise rejection:", reason);
  if (reason instanceof Error) {
    log16.error("main @ unhandledRejection: Stack:", reason.stack);
  }
});
app9.on("render-process-gone", (event, webContents3, details) => {
  log16.error("main @ render-process-gone: Renderer process crashed");
  log16.error("main @ render-process-gone: Reason:", details.reason);
  log16.error("main @ render-process-gone: Exit code:", details.exitCode);
  const allWindows = BrowserWindow3.getAllWindows();
  const crashedWindow = allWindows.find((win) => win.webContents.id === webContents3.id);
  if (crashedWindow) {
    log16.error(`main @ render-process-gone: Window title: ${crashedWindow.getTitle()}`);
    if (crashedWindow === windowhandler_default.examwindow) {
      log16.warn("main @ render-process-gone: Exam window crashed, attempting to close gracefully");
      try {
        if (!crashedWindow.isDestroyed()) {
          crashedWindow.destroy();
        }
        windowhandler_default.examwindow = null;
        windowhandler_default.examDisplayId = null;
      } catch (err) {
        log16.error("main @ render-process-gone: Error closing exam window:", err);
      }
    }
  }
  event.preventDefault();
});
app9.on("child-process-gone", (event, details) => {
  log16.error("main @ child-process-gone: Child process crashed");
  log16.error("main @ child-process-gone: Type:", details.type);
  log16.error("main @ child-process-gone: Reason:", details.reason);
  log16.error("main @ child-process-gone: Exit code:", details.exitCode);
  event.preventDefault();
});
if (process.platform === "win32") {
  app9.setAppUserModelId(app9.getName());
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
app9.on("certificate-error", (event, webContents3, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
app9.on("web-contents-created", (event, webContents3) => {
  const suppressCodes = [-3, -100, -101, -105];
  if (webContents3._errorSuppressionSetup) return;
  webContents3._errorSuppressionSetup = true;
  const setupErrorSuppression = () => {
    webContents3.removeAllListeners("did-fail-provisional-load");
    webContents3.removeAllListeners("did-fail-load");
    webContents3.on("did-fail-provisional-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
      if (!isMainFrame || suppressCodes.includes(errorCode)) {
        event2.preventDefault();
        return;
      }
      log16.warn(`main @ did-fail-provisional-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
    });
    webContents3.on("did-fail-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
      if (!isMainFrame || suppressCodes.includes(errorCode)) {
        event2.preventDefault();
        return;
      }
      log16.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
    });
  };
  setupErrorSuppression();
  webContents3.on("did-start-navigation", setupErrorSuppression);
  webContents3.on("did-frame-navigate", setupErrorSuppression);
  webContents3.on("render-process-gone", (event2, details) => {
    log16.error("main @ webContents render-process-gone: Renderer process crashed for specific webContents");
    log16.error("main @ webContents render-process-gone: Reason:", details.reason);
    log16.error("main @ webContents render-process-gone: Exit code:", details.exitCode);
    const allWindows = BrowserWindow3.getAllWindows();
    const crashedWindow = allWindows.find((win) => win.webContents.id === webContents3.id);
    if (crashedWindow) {
      log16.error(`main @ webContents render-process-gone: Window title: ${crashedWindow.getTitle()}`);
      log16.error(`main @ webContents render-process-gone: Window URL: ${crashedWindow.webContents.getURL()}`);
      if (crashedWindow === windowhandler_default.examwindow) {
        log16.warn("main @ webContents render-process-gone: Exam window crashed, attempting to close gracefully");
        try {
          if (!crashedWindow.isDestroyed()) {
            crashedWindow.destroy();
          }
          windowhandler_default.examwindow = null;
          windowhandler_default.examDisplayId = null;
        } catch (err) {
          log16.error("main @ webContents render-process-gone: Error closing exam window:", err);
        }
      }
    }
    event2.preventDefault();
  });
});
app9.on("window-all-closed", () => {
  clearInterval(communicationhandler_default.updateStudentIntervall);
  windowhandler_default.mainwindow = null;
  app9.quit();
});
app9.on("will-quit", () => {
  toggleMacOSLockdown2(false);
});
app9.on("before-quit", async () => {
  try {
    await session.defaultSession.clearStorageData({});
  } catch (err) {
    log16.error("main @ before-quit: Error clearing cache:", err);
  }
});
app9.on("activate", () => {
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
      log16.error("main @ checkParent:", result.error);
      return;
    }
    if (result.foundBrowser) {
      log16.warn("main @ checkParent: The app was started directly from a browser");
      dialog3.showMessageBoxSync(windowhandler_default.mainwindow, {
        type: "question",
        buttons: ["OK"],
        title: "Terminate Program",
        message: "Unerlaubter Programmstart aus einem Webbrowser erkannt.\nNext-Exam wird beendet!"
      });
      windowhandler_default.mainwindow.allowexit = true;
      app9.quit();
    } else {
      log16.info("main @ checkparent: Parent Process Check OK");
    }
  } catch (error) {
    log16.error("main @ checkParent error:", error);
  }
}
app9.whenReady().then(async () => {
  nativeTheme.themeSource = "light";
  session.defaultSession.setUserAgent(`Next-Exam/${config_default.version} (${config_default.info}) ${process.platform}`);
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0);
  });
  toggleMacOSLockdown2(true);
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
      log16.info("main @ tray: GNOME detected, skipping system tray");
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
/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Linux-specific platform restrictions (enable/disable).
 */
/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * Windows-specific platform restrictions (enable/disable).
 */
/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * macOS-specific platform restrictions (enable/disable, toggleMacOSLockdown).
 */
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLnBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICB0aGlzLl9hcmNoID0gcHJvY2Vzcy5hcmNoO1xuICAgIHRoaXMuX2VudiA9IHByb2Nlc3MuZW52O1xuXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmlzS0RFID0gdGhpcy5faXNLREUoKTtcbiAgICB0aGlzLmlzR05PTUUgPSB0aGlzLl9pc0dOT01FKCk7XG4gICAgdGhpcy5mbGFtZXNob3QgPSB0aGlzLl9nZXRWZXJzaW9uKCdmbGFtZXNob3QnKTtcbiAgICB0aGlzLmltYWdlbWFnaWNrID0gdGhpcy5fZ2V0VmVyc2lvbignY29udmVydCcpO1xuICAgIHRoaXMuaW1WZXJzaW9uID0gdGhpcy5fZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCk7XG4gICAgdGhpcy53b3JrZXJGaWxlTmFtZSA9IHRoaXMuX2dldFdvcmtlckZpbGVOYW1lKCk7XG4gICAgdGhpcy51c2VXb3JrZXIgPSB0aGlzLl9nZXRVc2VXb3JrZXIoKTtcbiAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gdGhpcy5fZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKTtcbiAgICB0aGlzLmpyZSA9IHRoaXMuX2RldGVjdEpSRUlkKCk7XG4gICAgdGhpcy5qcmVEaXIgPSB0aGlzLl9yZXNvbHZlSlJFRGlyKCk7XG4gICAgdGhpcy5qYXZhQmluID0gdGhpcy5fcmVzb2x2ZUphdmFCaW4oKTtcbiAgICB0aGlzLmpyZUluZm8gPSB0aGlzLl9nZXRKUkUoKTtcbiAgICBcbiAgICB0aGlzLmhvbWVkaXJlY3RvcnkgPSBvcy5ob21lZGlyKCk7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gICAgdGhpcy53b3JrZXJVUkwgPSB0aGlzLl9nZXRXb3JrZXJVUkwoKTtcbiAgICB0aGlzLnRlbXBkaXJlY3RvcnkgPSB0aGlzLl9nZXRUZW1wZGlyZWN0b3J5KCk7XG4gICAgdGhpcy53b3JrZGlyZWN0b3J5ID0gdGhpcy5fZ2V0V29ya2RpcmVjdG9yeSgpO1xuICAgIHRoaXMubG9nZmlsZSA9IHRoaXMuX2dldExvZ2ZpbGUoKTtcblxuICB9XG5cbiAgX2dldFdvcmtkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5ob21lZGlyZWN0b3J5LCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTtcbiAgfVxuXG4gIF9nZXRUZW1wZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKTtcbiAgfVxuXG5cbiAgX2dldExvZ2ZpbGUoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy53b3JrZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJyk7XG4gIH1cblxuICBfbm9ybWFsaXplQXJjaCgpIHtcbiAgICBpZiAodGhpcy5fYXJjaCA9PT0gJ2lhMzInKSByZXR1cm4gJ2k1ODYnO1xuICAgIGlmIChbJ3g2NCcsICdhcm02NCddLmluY2x1ZGVzKHRoaXMuX2FyY2gpKSByZXR1cm4gdGhpcy5fYXJjaDtcbiAgICB0aGlzLl9mYWlsKGB1bnN1cHBvcnRlZCBhcmNoaXRlY3R1cmU6ICR7dGhpcy5fYXJjaH1gKTtcbiAgfVxuXG4gIF9kZXRlY3RKUkVJZCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gJ21pbmltYWwtanJlLTExLXdpbic7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXJjaCA9PT0gJ2FybTY0JyA/ICdtaW5pbWFsLWpyZS0xMS1tYWMtYXJtNjQnIDogJ21pbmltYWwtanJlLTExLW1hYyc7XG4gICAgfVxuICB9XG5cblxuXG5cblxuICAvKipcbiAgICogXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIEBkZXNjcmlwdGlvbiB0aGlzIGZ1bmN0aW9uIHJlc29sdmVzIHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIGl0IGZpcnN0IGNoZWNrcyBpZiB0aGUgdXNlQnVuZGxlZEpSRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZVxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgY2hlY2tzIGlmIHRoZSBzeXN0ZW0ganJlIGlzIGluc3RhbGxlZFxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3lzdGVtIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogdGhlIGJ1bmRsZWQganJlIGlzIGxvY2F0ZWQgaW4gdGhlIHB1YmxpYyBkaXJlY3Rvcnkgb2YgdGhlIGFwcFxuICAgKiBcbiAgICogRklYTUU6IGlmIHN5c3RlbSBqcmUgaXMgc2VsZWN0ZWQgYnkgRU5WIGRvIG5vdCBpbmNsdWRlIHRoZSBqcmUgZGlyZWN0b3J5IGluIHRoZSBmaW5hbCBidWlsZFxuICAgKi9cblxuICBfcmVzb2x2ZUpSRURpcigpIHtcbiAgICAvLyB1c2UgYnVuZGxlZCBqcmUgYmVjYXVzZSBpdHMgc21hbGxlciBhbmQgcHJvdmlkZXMgb25seSB0aGUgbmVlZGVkIGphdmEgbW9kdWxlc1xuICAgIGlmIChjb25maWcudXNlQnVuZGxlZEpSRSkge1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3Jlc29sdmVKYXZhQmluKCkge1xuICAgIHN3aXRjaCAodGhpcy5wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5wbGF0Zm9ybX1gKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0RGlzcGxheVNlcnZlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4JykgcmV0dXJuICduL2EnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnKSByZXR1cm4gJ3dheWxhbmQnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3gxMScgfHwgdGhpcy5fZW52LkRJU1BMQVkpIHJldHVybiAneDExJztcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG5cbiAgX2dldFZlcnNpb24oY21kKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke2NtZH0gLS12ZXJzaW9uYCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnNwbGl0KCdcXG4nKVswXTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL1tcXGRdKyhcXC5bXFxkXSspKy8pO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb246IHZlcnNpb24/LlswXSB8fCAndW5rbm93bicgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRKUkUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdqYXZhIC12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdpZ25vcmUnLCAncGlwZSddIH0pO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvdmVyc2lvbiBcIihbXFxkLl9dKylcIi8pPy5bMV0gfHwgJ3Vua25vd24nO1xuICAgICAgY29uc3QgamF2YUhvbWUgPSB0aGlzLl9lbnYuSkFWQV9IT01FIHx8ICcnO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb24sIHBhdGg6IGphdmFIb21lIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwsIHBhdGg6IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0V29ya2VyRmlsZU5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gIFxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHdvcmtlclBhdGgpO1xuICB9XG5cbiAgaXNXYXlsYW5kKCkge1xuICAgIHJldHVybiB0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnO1xuICB9XG5cbiAgX2lzS0RFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKTtcbiAgICAgIHJldHVybiBvdXQgPT09ICdLREUnO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzS0RFOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc0dOT01FKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygnZ25vbWUnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0dOT01FOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc1VOSVRZKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygndW5pdHknKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZy53YXJuKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzVU5JVFk6IG5vIGRhdGFcIiwgZXJyKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaW1hZ2VtYWdpY2tBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwibWFnaWNrIC12ZXJzaW9uXCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgdjcgKG1hZ2ljaylcIik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZmxhbWVzaG90QXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIndoaWNoIGZsYW1lc2hvdFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ZsYW1lc2hvdEF2YWlsYWJsZTogRmxhbWVzaG90IG5vdCBmb3VuZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfc2V0dXBEZXNrdG9wUGF0aCgpIHtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgfVxuXG4gIF9nZXREZXNrdG9wUGF0aCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudlsnVVNFUlBST0ZJTEUnXSwgJ0Rlc2t0b3AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksICdEZXNrdG9wJyk7XG4gICAgfVxuICB9XG5cbiAgX2ZhaWwobXNnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFtwbGF0Zm9ybURpc3BhdGNoZXJdICR7bXNnfWApO1xuICB9XG5cbiAgX2dldEltYWdlTWFnaWNrVmVyc2lvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiBcIjdcIjtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIFwiPDdcIjtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9nZXRVc2VXb3JrZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIGlmICgodGhpcy5faXNHTk9NRSgpIHx8IHRoaXMuX2lzVU5JVFkoKSkgJiYgdGhpcy5pc1dheWxhbmQoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEdOT01FL1VuaXR5ICsgV2F5bGFuZCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzS0RFKCkgJiYgdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLl9mbGFtZXNob3RBdmFpbGFibGUoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEtERS9XYXlsYW5kICsgRmxhbWVzaG90IFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMudXNlV29ya2VyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogWDExICsgSW1hZ2VNYWdpY2sgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlIFx1MjAxMyBmYWxsYmFjayB0byBwYWdlY2FwdHVyZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIHZpYSBlbGVjdHJvbi1idWlsZGVyLmVudiAtIGVkaXQgdmFycyBpbiBlbGVjdHJvbi1idWlsZGVyLmVudiBmaWxlIVxuICovXG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgICBkZXZlbG9wbWVudDogdHJ1ZSwgIC8vIGRpc2FibGUga2lvc2sgbW9kZSBvbiBleGFtIG1vZGUgYW5kIG90aGVyIHN0dWZmIChhdXRvZmlsbCBpbnB1dCBmaWVsZHMpXG4gICAgc2hvd2RldnRvb2xzOiB0cnVlLFxuICAgIHVzZUJ1bmRsZWRKUkU6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwRGVtbzogZmFsc2UsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICBlbGVjdHJvbjogZmFsc2UsXG4gICAgdmlydHVhbGl6ZWQ6IGZhbHNlLFxuICAgIGlzUHVhdm86IGZhbHNlLFxuICAgIFxuICAgIHZlcnNpb246ICcyLjAuMC4xJyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDIwMycsXG4gICAgYnVpbGROdW1iZXI6ICcxJyxcbiAgICBpbmZvOiAnUmVsZWFzZSdcbn1cbmV4cG9ydCBkZWZhdWx0IGNvbmZpZztcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBpcyB0aGUgRUxFQ1RST04gbWFpbiBmaWxlIHRoYXQgYWN0dWFsbHkgb3BlbnMgdGhlIGVsZWN0cm9uIHdpbmRvd1xuICovXG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgY2hhbGsgZnJvbSAnY2hhbGsnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBwb3dlclNhdmVCbG9ja2VyLCBuYXRpdmVUaGVtZSwgZ2xvYmFsU2hvcnRjdXQsIFRyYXksIE1lbnUsIGRpYWxvZywgc2Vzc2lvbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgY29uZmlnIGZyb20gJy4vbWFpbi9jb25maWcuanMnO1xuaW1wb3J0IG11bHRpY2FzdENsaWVudCBmcm9tICcuL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0ICogYXMgZnNFeHRyYSBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9jb21tdW5pY2F0aW9uaGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnXG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMnXG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBjaGVja1BhcmVudFByb2Nlc3MgfSBmcm9tICcuL21haW4vc2NyaXB0cy9jaGVja3BhcmVudC5qcyc7XG5cbmltcG9ydCB7IHRvZ2dsZU1hY09TTG9ja2Rvd24gfSBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcydcbkpyZUhhbmRsZXIuaW5pdCgpXG5cblxuXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsYW5nJywgJ2RlJyk7XG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdlbmFibGUtdW5zYWZlLXN3aWZ0c2hhZGVyJyk7XG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS1mZWF0dXJlcycsICdWYWFwaVZpZGVvRGVjb2RlcixPdXRPZlByb2Nlc3NSYXN0ZXJpemF0aW9uLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgLy8gZGlzYWJsZSBmcmFnaWxlIEdQVSBmZWF0dXJlc1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2Rpc2FibGUtemVyby1jb3B5Jyk7IFxufVxuZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2Rhcndpbicpe1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7ICAvLyBtYWNvcyBvbmx5XG59XG5cblxuXG5cblxubG9nLmluaXRpYWxpemUoKTsgLy8gaW5pdGlhbGl6ZSB0aGUgbG9nZ2VyIGZvciBhbnkgcmVuZGVyZXIgcHJvY2Vzc1xubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5sb2cudHJhbnNwb3J0cy5maWxlLnJlc29sdmVQYXRoRm4gPSAoKSA9PiB7IHJldHVybiBwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZSAgfVxuXG5sb2cudHJhbnNwb3J0cy5jb25zb2xlLmZvcm1hdCA9IChtZXNzYWdlKSA9PiB7XG4gICAgLy8gQWx3YXlzIHJldHVybiBhbiBhcnJheSwgbm90IHN0cmluZ3MhXG4gICAgc3dpdGNoIChtZXNzYWdlLmxldmVsKSB7XG4gICAgICBjYXNlICdpbmZvJzogcmV0dXJuIFtjaGFsay5ncmVlbihtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnd2Fybic6IHJldHVybiBbY2hhbGsueWVsbG93KG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICdlcnJvcic6IHJldHVybiBbY2hhbGsucmVkKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICdkZWJ1Zyc6IHJldHVybiBbY2hhbGsuYmx1ZShtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAndmVyYm9zZSc6IHJldHVybiBbY2hhbGsubWFnZW50YShtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgZGVmYXVsdDogICAgIHJldHVybiBbU3RyaW5nKG1lc3NhZ2UuZGF0YSldO1xuICAgIH1cbn07XG5cbmxvZy52ZXJib3NlKClcbmxvZy52ZXJib3NlKGBtYWluOiAtLS0tLS0tLS0tLS0tLS0tLS0tYClcbmxvZy52ZXJib3NlKGBtYWluOiBzdGFydGluZyBOZXh0LUV4YW0gU3R1ZGVudCBcIiR7Y29uZmlnLnZlcnNpb259ICR7Y29uZmlnLmluZm99XCIgKCR7cHJvY2Vzcy5wbGF0Zm9ybX0pJHtjb25maWcuZGV2ZWxvcG1lbnQgPyAnIChkZXZtb2RlIG9uKScgOiAnJ31gKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW46IExvZ2ZpbGVsb2NhdGlvbiBhdCAke3BsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlfWApXG5wbGF0Zm9ybURpc3BhdGNoZXIubWVzc2FnZXMuZm9yRWFjaChtZXNzYWdlID0+IHsgbG9nLmRlYnVnKG1lc3NhZ2UpIH0pO1xuXG4vLyBsb2cgZWxlY3Ryb24gdmVyc2lvbiBhbmQgb3RoZXIgcGxhdGZvcm0gaW5mb3JtYXRpb25cbmxvZy5kZWJ1ZyhgbWFpbjogRWxlY3Ryb24gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmVsZWN0cm9ufWApXG5sb2cuZGVidWcoYG1haW46IENocm9taXVtIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5jaHJvbWV9YClcbmxvZy5kZWJ1ZyhgbWFpbjogTm9kZSB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMubm9kZX1gKVxubG9nLmRlYnVnKGBtYWluOiBWOCB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMudjh9YClcbmxvZy5kZWJ1ZyhgbWFpbjogT1M6ICR7cHJvY2Vzcy5wbGF0Zm9ybX0gJHtwcm9jZXNzLmFyY2h9YClcbmxvZy5kZWJ1ZyhgbWFpbjogQXJjaDogJHtwcm9jZXNzLmFyY2h9YClcblxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuQ29tbUhhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgICAgLy8gc3RhcnRzIFwiYmVhY29uXCIgaW50ZXJ2YWxsIGFuZCBmZXRjaGVzIGluZm9ybWF0aW9uIGZyb20gdGhlIHRlYWNoZXIgLSBhY3RzIG9uIGl0IChzdGFydGV4YW0sIHN0b3BleGFtLCBzZW5kZmlsZSwgZ2V0ZmlsZSlcbklwY0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZywgV2luZG93SGFuZGxlciwgQ29tbUhhbmRsZXIpICAvL2NvbnRyb2xsIGFsbCBJbnRlciBQcm9jZXNzIENvbW11bmljYXRpb25cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcblxuXG5pZiAoIWFwcC5yZXF1ZXN0U2luZ2xlSW5zdGFuY2VMb2NrKCkpIHsgIC8vIGFsbG93IG9ubHkgb25lIGluc3RhbmNlIG9mIHRoZSBhcHAgcGVyIGNsaWVudFxuICAgIGxvZy53YXJuKFwibWFpbiBAIHNpbmdsZWluc3RhbmNlOiBuZXh0LWV4YW0gYWxyZWFkeSBydW5uaW5nLlwiKVxuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuYXBwLm9uKCdzZWNvbmQtaW5zdGFuY2UnLCAoKSA9PiB7XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IHByZXZlbnRlZCBzZWNvbmQgc3RhcnQgb2YgbmV4dC1leGFtLiBSZXN0b3JpbmcgZXhpc3RpbmcgTmV4dC1FeGFtIHdpbmRvdy5cIilcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSB8fCAhV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpXG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cucmVzdG9yZSgpXG4gICAgICAgIH0gXG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5mb2N1cygpIC8vIEZvY3VzIG9uIHRoZSBtYWluIHdpbmRvdyBpZiB0aGUgdXNlciB0cmllZCB0byBvcGVuIGFub3RoZXJcbiAgICB9XG59KVxuXG5cbi8qKlxuICogYWRkaXRpb25hbCBjb25maWcgc2V0dGluZ3MgYW5kIHBhdGggY2hlY2tzXG4gKi9cblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY29uZmlnLmVsZWN0cm9uID0gdHJ1ZVxuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgKCkgPT4geyAgLy8gaWYgd2luZG93IGlzIGNsb3NlZFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcbiAgICBhcHAucXVpdCgpICAgXG59KVxuXG5hcHAub24oJ3dpbGwtcXVpdCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKGZhbHNlKVxufSlcblxuYXBwLm9uKCdiZWZvcmUtcXVpdCcsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLmNsZWFyU3RvcmFnZURhdGEoe30pOyAvLyBjbGVhciBjb29raWVzLCBjYWNoZSwgbG9jYWxTdG9yYWdlIGV0Yy5cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgYmVmb3JlLXF1aXQ6IEVycm9yIGNsZWFyaW5nIGNhY2hlOicsIGVycik7XG4gICAgfVxufSk7XG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQnJvd3NlclZpZXcsIGRpYWxvZywgc2NyZWVufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCB7IGFjdGl2ZVdpbmRvdyB9IGZyb20gJ2dldC13aW5kb3dzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tIFwibm9kZTp1cmxcIjtcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIFdpbmRvdyBoYW5kbGluZyAoaXBjUmVuZGVyZXIgUHJvY2VzcyAtIEZyb250ZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2tXaW5kb3cgPSBudWxsXG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNlcnZlZCBkaXNwbGF5IElEIGZvciBleGFtIHdpbmRvdyAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gd2luZG93IGlzIGNyZWF0ZWQpXG4gICAgICB0aGlzLnNwbGFzaHdpbiA9IG51bGxcbiAgICAgIHRoaXMuYmlwd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICBcbiAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgcXVlc3Rpb24gZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBtaW5pbWl6ZSB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMud2luZG93VHJhY2tlci5iaW5kKHRoaXMpLCAxMDAwKVxuICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gZWxlY3Ryb24gd2luZG93IGluIGZvY3VzIG9yIGFuIG90aGVyIGVsZWN0cm9uIHdpbmRvdyBkZXBlbmRpbmcgb24gdGhlIGhpZXJhY2h5XG4gICAgZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgICAgICAgaWYgKGZvY3VzZWRXaW5kb3cpIHtcbiAgICAgICAgICByZXR1cm4gZm9jdXNlZFdpbmRvd1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVubG9ja1dpbmRvdyl7cmV0dXJuIHRoaXMuc2NyZWVubG9ja1dpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZXhhbXdpbmRvdyl7cmV0dXJuIHRoaXMuZXhhbXdpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubWFpbndpbmRvdyl7cmV0dXJuIHRoaXMubWFpbndpbmRvd31cbiAgICAgICAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEwMDAsXG4gICAgICAgICAgICBoZWlnaHQ6ODAwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogZGlkLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiB3aWxsLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG5cbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IG5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiB0YXJnZXQ6IF9ibGFua1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtcmVkaXJlY3QnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogUmVkaXJlY3RpbmcgdG86JywgdXJsKTtcbiAgICAgICAgICAgIC8vIFByXHUwMEZDZmVuLCBvYiBkaWUgVVJMIGRhcyBnZXdcdTAwRkNuc2NodGUgRm9ybWF0IGhhdFxuICAgICAgICAgICAgaWYgKHVybC5zdGFydHNXaXRoKCdiaWxkdW5nc3BvcnRhbDovLycpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVydCBkZW4gU3RhbmRhcmQtUmVkaXJlY3RcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSAnYmlsZHVuZ3Nwb3J0YWw6Ly90b2tlbj0nO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9rZW4gPSB1cmwuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IENhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46ICcgKyB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JpcFRva2VuJywgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHRoaXMgaXMgYW4gZWFzdGVyIGVnZ1xuICAgICAqL1xuICAgIGNyZWF0ZUVhc3RlcldpbigpIHtcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogNzY4LFxuICAgICAgICAgICAgaGVpZ2h0OjQ4MCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLmxvYWRGaWxlKGpvaW4oX19kaXJuYW1lLCBgLi4vLi4vcHVibGljL2Nvd3NvbmljZS9pbmRleC5odG1sYCkpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVhc3RlcndpbiAmJiAhdGhpcy5lYXN0ZXJ3aW4uaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3Rlcndpbi5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEJsb2NrV2luZG93ICh0byBjb3ZlciBhZGRpdGlvbmFsIHNjcmVlbnMpXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgbmV3QmxvY2tXaW4oZGlzcGxheSkge1xuICAgICAgICBsZXQgYmxvY2t3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgcGFyZW50OiB0aGlzLmV4YW13aW5kb3csXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIGZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgICAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICBsZXQgdXJsID0gXCJub3Rmb3VuZFwiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYmxvY2t3aW4ucmVtb3ZlTWVudSgpIFxuICAgICAgICBibG9ja3dpbi5zZXRNaW5pbWl6YWJsZShmYWxzZSlcblxuICAgICAgICAvLyBQb3NpdGlvbiB3aW5kb3cgb24gc3BlY2lmaWMgZGlzcGxheSBCRUZPUkUgc2hvd2luZyBpdFxuICAgICAgICBibG9ja3dpbi5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnksXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodFxuICAgICAgICB9KTtcblxuICAgICAgICBibG9ja3dpbi5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgYmxvY2t3aW4uc2hvdygpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpO1xuICAgICAgICAgICAgYmxvY2t3aW4ub24oJ2xlYXZlLWZ1bGwtc2NyZWVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7IC8vIHNvZm9ydCB3aWVkZXIgenVyXHUwMEZDY2tzZXR6ZW5cbiAgICAgICAgICAgIH0pOyBcbiAgICAgICAgfSAgXG4gICAgICAgIGVsc2UgeyAgIFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0S2lvc2sodHJ1ZSk7IC8vIEtpb3NrID0gXCJ0YWtlIG92ZXIgbWFpbiBzY3JlZW5cIi4gb24gbWFjb3MgdGhhdCdzIHdoeSB3ZSB1c2UgZnVsbFNjcmVlbiB3b3JrYXJvdW5kIHdpdGggZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgfVxuICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgIGJsb2Nrd2luLmRpc3BsYXkgPSBkaXNwbGF5XG4gICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLnB1c2goYmxvY2t3aW4pXG4gICAgfVxuXG5cbiAgICAvLyBibG9jayBhbGwgc2NyZWVucyB3aXRoIGEgYmxvY2t3aW5kb3dcbiAgICBhc3luYyBpbml0QmxvY2tXaW5kb3dzKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIC8vbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBmb3VuZCAke2Rpc3BsYXlzLmxlbmd0aH0gZGlzcGxheXNgKVxuICAgICAgICBcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyAgLy8gbG9jayBhbGwgc2NyZWVuc1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZXhhbSB3aW5kb3cgdG8gYmUgdmlzaWJsZSBhbmQgcG9zaXRpb25lZCAoaW1wb3J0YW50IGZvciBXYXlsYW5kL0tXaW4pXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGxldCByZXRyaWVzID0gMFxuICAgICAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMFxuICAgICAgICAgICAgICAgIHdoaWxlICghdGhpcy5leGFtd2luZG93LmlzVmlzaWJsZSgpICYmIHJldHJpZXMgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKVxuICAgICAgICAgICAgICAgICAgICByZXRyaWVzKytcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQWRkaXRpb25hbCB3YWl0IHRvIGVuc3VyZSBwb3NpdGlvbmluZyBpcyBjb21wbGV0ZSBvbiBXYXlsYW5kXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBibG9jayB3aW5kb3dzIGZyb20gYXJyYXlcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gdGhpcy5ibG9ja3dpbmRvd3MuZmlsdGVyKGJsb2Nrd2luID0+IGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgYWxsIGV4aXN0aW5nIHdpbmRvd3MgYW5kIGRldGVybWluZSB0aGVpciBkaXNwbGF5c1xuICAgICAgICAgICAgY29uc3QgdXNlZERpc3BsYXlJZHMgPSBuZXcgU2V0KClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmlyc3QsIHVzZSB0aGUgcmVzZXJ2ZWQgZXhhbSBkaXNwbGF5IElEIChzZXQgaW1tZWRpYXRlbHkgd2hlbiBleGFtIHdpbmRvdyB3YXMgY3JlYXRlZClcbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgc2NyZWVuIGlzIHJlc2VydmVkIGV2ZW4gaWYgdGhlIHdpbmRvdyBpc24ndCBmdWxseSBpbml0aWFsaXplZCB5ZXRcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1EaXNwbGF5SWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQodGhpcy5leGFtRGlzcGxheUlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBbHdheXMgZXhjbHVkZSBwcmltYXJ5IGRpc3BsYXkgKGV4YW0gd2luZG93IGxvY2F0aW9uKVxuICAgICAgICAgICAgY29uc3QgcHJpbWFyeURpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKHByaW1hcnlEaXNwbGF5ICYmIHByaW1hcnlEaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHByaW1hcnlEaXNwbGF5LmlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBleGFtIHdpbmRvdyBkaXNwbGF5IChhcyBmYWxsYmFjay92ZXJpZmljYXRpb24sIGJ1dCByZXNlcnZlZCBJRCB0YWtlcyBwcmlvcml0eSlcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXhhbSB3aW5kb3cgaXMgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBleGFtIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgYmxvY2sgd2luZG93cyBkaXNwbGF5c1xuICAgICAgICAgICAgZm9yIChjb25zdCBibG9ja3dpbiBvZiB0aGlzLmJsb2Nrd2luZG93cykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IGJsb2Nrd2luLmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogYmxvY2sgd2luZG93IGZvdW5kIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgYmxvY2sgd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgYmxvY2sgd2luZG93cyBmb3IgZGlzcGxheXMgdGhhdCBkb24ndCBoYXZlIGV4YW0gb3IgYmxvY2sgd2luZG93c1xuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgaWYgKHVzZWREaXNwbGF5SWRzLmhhcyhkaXNwbGF5LmlkKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IHNraXBwaW5nIGRpc3BsYXkgJHtkaXNwbGF5LmlkfSAtIGFscmVhZHkgaGFzIGV4YW0gb3IgYmxvY2sgd2luZG93YClcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogY3JlYXRlIGJsb2Nrd2luIG9uOlwiLGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgdGhpcy5uZXdCbG9ja1dpbihkaXNwbGF5KSAgLy8gYWRkIGJsb2Nrd2luZG93cyBmb3IgZGlzcGxheXMgd2l0aG91dCBleGFtIHdpbmRvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApXG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5mb3JFYWNoKCAoYmxvY2t3aW4pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTY3JlZW5sb2NrIFdpbmRvdyAodG8gY292ZXIgdGhlIG1haW5zY3JlZW4pIC0gYmxvY2sgc3R1ZGVudHMgZnJvbSB3b3JraW5nXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSB7XG4gICAgICAgIGxldCBzY3JlZW5sb2NrV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgLy8gcGFyZW50OiB0aGlzLm1haW53aW5kb3csICAgLy8gbGVhZHMgdG8gdmlzaWJsZSB0aXRsZWJhciBpbiBnbm9tZS1kZXNrdG9wXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdTY3JlZW5sb2NrJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICAvL2ZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgdXJsID0gXCJsb2NrXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIC8vIEFkZCB3aW5kb3cgdG8gYXJyYXkgZmlyc3QsIGJlZm9yZSBhZGRpbmcgYmx1ciBsaXN0ZW5lclxuICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLnB1c2goc2NyZWVubG9ja1dpbmRvdylcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXNjcmVlbmxvY2tXaW5kb3cpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5yZW1vdmVNZW51KCkgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldE1pbmltaXphYmxlKGZhbHNlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInBvcC11cC1tZW51XCIsIDEpICAgLy9hYm92ZSBleGFtIHdpbmRvdyAocG9wLXVwLW1lbnUsIDApXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNob3coKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldENsb3NhYmxlKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldFZpc2libGVPbkFsbFdvcmtzcGFjZXModHJ1ZSk7IC8vIHB1dCB0aGUgd2luZG93IG9uIGFsbCB2aXJ0dWFsIHdvcmtzcGFjZXNcbiAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKFwic2NyZWVubG9ja1wiKVxuICAgICAgICB9KVxuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9ICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2VkJywgKCkgPT4geyAgIC8vIHJlbW92ZSB3aW5kb3cgZnJvbSBhcnJheSB3aGVuIGFjdHVhbGx5IGNsb3NlZFxuICAgICAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IHRoaXMuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgd2luICE9PSBzY3JlZW5sb2NrV2luZG93ICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEV4YW13aW5kb3dcbiAgICAgKiBAcGFyYW0gZXhhbXR5cGUgZWR1dmlkdWFsLCBtYXRoLCBsYW5ndWFnZVxuICAgICAqIEBwYXJhbSB0b2tlbiBzdHVkZW50IHRva2VuXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyB0aGUgc2VydmVyc3RhdHVzIG9iamVjdCBjb250YWluaW5nIGluZm8gYWJvdXQgc3BlbGxjaGVjayBsYW5ndWFnZSBldGMuIFxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUV4YW1XaW5kb3coZXhhbXR5cGUsIHRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnlkaXNwbGF5KSB7XG4gICAgICAgIC8vIGp1c3QgdG8gYmUgc3VyZSB3ZSBjaGVjayBzb21lIGltcG9ydGFudCB2YXJzIGhlcmVcbiAgICAgICAgaWYgKGV4YW10eXBlICE9PSBcInJkcFwiICYmIGV4YW10eXBlICE9PSBcIndlYnNpdGVcIiAmJiAgZXhhbXR5cGUgIT09IFwiZ2Zvcm1zXCIgJiYgZXhhbXR5cGUgIT09IFwiZWR1dmlkdWFsXCIgJiYgZXhhbXR5cGUgIT09IFwiZWRpdG9yXCIgJiYgZXhhbXR5cGUgIT09IFwibWF0aFwiICYmIGV4YW10eXBlICE9PSBcIm1pY3Jvc29mdDM2NVwiICYmIGV4YW10eXBlICE9PSBcImFjdGl2ZXNoZWV0c1wiIHx8ICF0b2tlbil7ICAvLyBmb3Igbm93Li4gd2UgcHJvYmFibHkgc2hvdWxkIHN0b3AgZXZlcnl0aGluZyBoZXJlXG4gICAgICAgICAgICBsb2cud2FybihcIm1pc3NpbmcgcGFyYW1ldGVycyBmb3IgZXhhbS1tb2RlIG9yIG1vZGUgbm90IGluIGFsbG93ZWQgbGlzdCFcIilcbiAgICAgICAgICAgIGV4YW10eXBlID0gXCJlZGl0b3JcIiBcbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIC8vIEFsd2F5cyB1c2UgcHJpbWFyeSBkaXNwbGF5IGZvciBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMgfHwgIXByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBkaXNwbGF5c1swXSB8fCBwcmltYXJ5ZGlzcGxheVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBJbW1lZGlhdGVseSByZXNlcnZlIHRoZSBkaXNwbGF5IElEIGZvciB0aGUgZXhhbSB3aW5kb3cgKGJlZm9yZSB3aW5kb3cgaXMgZnVsbHkgaW5pdGlhbGl6ZWQpXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYmxvY2sgd2luZG93cyBmcm9tIGJlaW5nIGNyZWF0ZWQgb24gdGhlIHNhbWUgc2NyZWVuXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gcHJpbWFyeWRpc3BsYXkuaWRcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogcmVzZXJ2aW5nIGRpc3BsYXkgJHt0aGlzLmV4YW1EaXNwbGF5SWR9IGZvciBleGFtIHdpbmRvd2ApXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBweCA9IDBcbiAgICAgICAgbGV0IHB5ID0gMFxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcy54KSB7XG4gICAgICAgICAgICBweCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54XG4gICAgICAgICAgICBweSA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy55XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBweCArIDAsXG4gICAgICAgICAgICB5OiBweSArIDAsXG4gICAgICAgICAgICB0aXRsZTogJ0V4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IDE0NDAsXG4gICAgICAgICAgICBoZWlnaHQ6IDc2OCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogd2luLCAgLy90aGlzIGRvZXNudCB3b3JrIHRvZ2V0aGVyIHdpdGgga2lvc2sgb24gdWJ1bnR1IGdub21lID8/IHd0ZlxuICAgICAgICAgICAgLy8gbW9kYWw6IHRydWUsICAvLyB0aGlzIGJsb2NrcyB0aGUgbWFpbiB3aW5kb3cgb24gd2luZG93cyB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgb3BlblxuICAgICAgICAgICAgLy8gY2xvc2FibGU6IGZhbHNlLCAgLy8gaWYgd2UgY2FuJ3QgZGVmaW5lICdwYXJlbnQnIHRoaXMgd2luZG93IGhhcyB0byBiZSBjbG9zYWJsZSAtIHdoeT9cbiAgICAgICAgICAgIC8vYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBvcGFjaXR5OiAxLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHZpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICBraW9zazogdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgPyBmYWxzZSA6IHRydWUsXG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWUsXG4gICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5leGFtd2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlTWVudSgpICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBwcm9iYWJseSBub3QgbmVlZGVkIGJlY2F1c2Ugd2UgZGlzYWJsZSBtaXNzaW9uY29udHJvbCBhbnl3YXlzIC0gc2VlbXMgdG8gaW50ZXJmZXJlIHdpdGgga2lvc2sgbW9kZSBvbiBtYWNvcyAoYWdhaW4pXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMuZXhhbXdpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUsIHsgdmlzaWJsZU9uRnVsbFNjcmVlbjogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNXYXlsYW5kKXsgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0YXJ0KCkgfSAvLyBjb25zdGFudGx5IGNoZWNrIGlmIHRoZSBhY3RpdmUgd2luZG93IGlzIHRoZSBleGFtd2luZG93IC0gaWYgbm90LCBicmluZyBpdCB0byBmcm9udFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVSZXN0cmljdGlvbnModGhpcykgIC8vIGRpc2FibGUga2V5Ym9hcmQgc2hvcnRjdXRzIGV0Yy5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgIC8vIGRvIG5vdCBzZXQgYmx1ciBsaXN0ZW5lciB0b28gZWFybHlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoKSAgLy8gYWRkIGJsdXIgbGlzdGVuZXIgdG8gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBkaWQtZmluaXNoLWxvYWQ6IGVycm9yIGluIGV4YW13aW5kb3cgc2V0dXBcIiwgZSl9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzID0gc2VydmVyc3RhdHVzIC8vd2Uga2VlcCBpdCB0aGVyZSB0byBtYWtlIGl0IGFjY2Vzc2FibGUgdmlhIGV4YW13aW5kb3cgaW4gaXBjSGFuZGxlclxuICAgICAgICB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCA9IDk0ICAgLy8gc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBjb250ZW50IHZpZXdcbiAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1pY3Jvc29mdCAzNjUgZW1lYmVkcyBpdHMgZWRpdG9yIGluIGFuIGlmcmFtZSB3aXRoIGFjdGl2ZSBDb250ZW50IFNlY3VyaXR5IFBvbGljeSAoQ1NQKVxuICAgICAgICAgKiBUaGUgb25seSB3YXkgdG8gYmUgYWJsZSB0byBpbmplY3QgY29kZSBpcyB0byBsb2FkIGl0IGRpcmVjdGx5IGluIHRoZSBtYWluIHdpbmRvdyA8ZW1iZWQ+IDxpZnJhbWU+IG9yIGV2ZW4gPHdlYnZpZXc+IG9mZmVycyBubyB3b3JrYXJvdW5kXG4gICAgICAgICAqIHRoZXJlZm9yZSB3ZSB1c2UgXCJCcm93c2VyVmlld1wiIGluIG9yZGVyIHRvIGRpc3BsYXkgdHdvIHBhZ2VzIGluIG9uZSB3aW5kb3c6IG9uIHRvcCA+IGV4YW0gaGVhZGVyLCBvbiBib3R0b20gPiBvZmZpY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaWYgKGV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiICApIHsgLy9leHRlcm5hbCBwYWdlXG4gICAgICAgICAgICBsb2cuaW5mbyhcInN0YXJ0aW5nIG1pY3Jvc29mdDM2NSBleGFtLi4uXCIpXG4gICAgICAgICAgICBsZXQgdXJsdmlldyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSAgIFxuICAgICAgICAgICAgaWYgKCF1cmx2aWV3KSB7Ly8gd2Ugd2FpdCBmb3IgdGhlIG5leHQgdXBkYXRlIHRpY2sgLSBtc29mZmljZXNoYXJlIG5lZWRzIHRvIGJlIHNldCAhIChjb3VsZCBoYXBwZW4gd2hlbiBhIHN0dWRlbnQgY29ubmVjdHMgbGF0ZXIgdGhlbiBleGFtIG1vZGUgaXMgc2V0IGJ1dCBoaXMgc2hhcmUgdXJsIG5lZWRzIHNvbWUgdGltZSlcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiBubyB1cmwgZm9yIG1pY3Jvc29mdDM2NSB3YXMgc2V0IHlldCAtIHdhaXRpbmcgZm9yIG5leHQgdXBkYXRlIHRpY2tcIilcbiAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGRlc3Ryb3llZFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsb2FkIHRvcCBtZW51IGluIE1haW5QYWdlXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCBlZHV2aWR1YWwgfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGJhY2tncm91bmR1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwoYmFja2dyb3VuZHVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBEZWZpbmUgdGhlIE1haW5Db250ZW50UGFnZSB2aWV3XG4gICAgICAgICAgICBsZXQgY29udGVudFZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSwgIFxuICAgICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRBdXRvUmVzaXplKHsgd2lkdGg6IHRydWUsIGhlaWdodDogdHJ1ZSwgaG9yaXpvbnRhbDogdHJ1ZSwgdmVydGljYWw6IHRydWUgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybHZpZXcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSB9XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignZW50ZXItZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbigncmVzaXplJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgbm9ybWFsIGV4YW0gbW9kZSAoZWRpdG9yLCBtYXRoLCBlZHV2aWR1YWwsIHdlYnNpdGUsIGdmb3JtcylcbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vJHt0b2tlbn0vYFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogSGFuZGxlIHNwZWNpYWwgTkFWSUdBVElPTiBzaXR1YXRpb25zXG4gICAgICAgICAqL1xuXG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgRm9ybXMsIFdlYnNpdGUsIEVkdXZpZHVhbCwgRWRpdG9yLCBSRFAsIE1pY3Jvc29mdDM2NVxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgICAvLyBCbG9jayBuYXZpZ2F0aW9uIG9uIGV4YW13aW5kb3cud2ViQ29udGVudHMgbGV2ZWwgZm9yIGFsbCBtb2RlcyB0aGF0IGNhbiBkaXNwbGF5IFBERnMgaW4gZXhhbWhlYWRlclxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIG5hdmlnYXRpb24gd2hlbiBjbGlja2luZyBsaW5rcyBpbiBQREZzIGRpc3BsYXllZCBpbiB0aGUgZXhhbWhlYWRlclxuICAgICAgICAvLyBXZWJ2aWV3L0Jyb3dzZXJWaWV3IGJsb2NraW5nIGlzIGhhbmRsZWQgc2VwYXJhdGVseSB2aWEgSVBDIGluIGlwY2hhbmRsZXIuanMgb3IgbW9kZS1zcGVjaWZpYyBoYW5kbGVycyBiZWxvd1xuICAgICAgICBjb25zdCBleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIgPSBbXCJnZm9ybXNcIiwgXCJ3ZWJzaXRlXCIsIFwiZWR1dmlkdWFsXCIsIFwiZWRpdG9yXCIsIFwicmRwXCIsIFwibWljcm9zb2Z0MzY1XCIsIFwiYWN0aXZlc2hlZXRzXCIsIFwibWF0aFwiXTtcbiAgICAgICAgaWYgKGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlci5pbmNsdWRlcyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gUHJldmVudCBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgVnVlIGFwcCAoZS5nLiBmcm9tIFBERiBsaW5rcyBpbiBleGFtaGVhZGVyKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFByZXZlbnQgbmV3IHdpbmRvd3MgZnJvbSBvcGVuaW5nIGluIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIG5ldy13aW5kb3dcIiwgdXJsKTtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIFxuICAgICAgICAgICAgfSk7XG4gICAgIFxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgc2V0V2luZG93T3BlbkhhbmRsZXJcIiwgdXJsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBNaWNyb3NvZnQgRXhjZWwvV29yZFxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiKXsgIC8vIGRvIG5vdCB1bmRlciBhbnkgY2lyY3Vtc3RhbmNlcyBhbGxvdyBuYXZpZ2F0aW9uIGF3YXkgZnJvbSB0aGUgY3VycmVudCBleGFtIHVybFxuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLmV4YW13aW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSB1c2VyIHdhbnRzIHRvIG5hdmlnYXRlIGF3YXkgZnJvbSB0aGlzIHBhZ2VcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodXJsICE9PSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiZG8gbm90IG5hdmlnYXRlIGF3YXkgZnJvbSB0aGlzIHRlc3QuLiBcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgICAgIH0gIFxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgIFxuICAgICAgICAgICAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGV4ZWN1dGVDb2RlID0gIGBcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gbG9jaygpe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gJ1dBQ0RpYWxvZ091dGVyQ29udGFpbmVyJywnV0FDRGlhbG9nSW5uZXJDb250YWluZXInLCdXQUNEaWFsb2dQYW5lbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoaWRldXNCeUlEID0gWydTaG93SGlkZUVxdWF0aW9uVG9vbHNQYW5lJywnTGlua0dyb3VwJywnR3JhcGhpY3NFZGl0b3InLCdJbnNlcnRUYWJsZU9mQ29udGVudHNJbkluc2VydFRhYicsJ0luc2VydE9ubGluZXZpZGVvJywnUGljdHVyZScsJ1JpYmJvbi1QaWN0dXJlTWVudU1MUkRyb3Bkb3duJywnSW5zZXJ0QWRkSW5GbHlvdXQnLCdEZXNpZ25lcicsJ0VkaXRvcicsJ0ZhclBhbmUnLCdIZWxwJywnSW5zZXJ0QXBwc0Zvck9mZmljZScsJ0ZpbGVNZW51TGF1bmNoZXJDb250YWluZXInLCdIZWxwLXdyYXBwZXInLCdSZXZpZXctd3JhcHBlcicsJ0hlYWRlcicsJ0ZhclBlcmlwaGVyYWxDb250cm9sc0NvbnRhaW5lcicsJ0J1c2luZXNzQmFyJ11cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoZW50cnkgb2YgaGlkZXVzQnlJRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZW50cnkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiZGlzcGxheVwiLCBcIm5vbmVcIiwgXCJpbXBvcnRhbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYnV0dG9uQXBwc092ZXJmbG93ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoJ0FkZC1JbnMnKVswXTsgIC8vIHRoaXMgYnV0dG9uIGlzIHJlZHJhd24gb24gcmVzaXplIChkb2Vzbid0IGhhcHBlbiBpbiBleGFtIG1vZGUgYnV0IHN0aWxsIHRoZXJlIG11c3QgYmUgYSBjbGVhbmVyIHdheSAtIGluc2VydGluZyBjc3MgYmVmb3JlIGl0IGFwcGVhcnMgaXMgbm90IHdvcmtpbmcpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnV0dG9uQXBwc092ZXJmbG93KXsgYnV0dG9uQXBwc092ZXJmbG93LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiU3VjaGVuXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiXHUwMERDYmVyc2V0emVuXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQ29waWxvdFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJBZGQtSW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cENvbnRleHRNZW51XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBTeW5vbnltc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJSaWJib24tUmVmZXJlbmNlc1NtYXJ0TG9va1VwXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiRGljdGF0aW9uXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJHZXRBZGRpbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlBpY3R1cmVzX01MUlwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTsgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvY2soKSAgLy9mb3Igc29tZSByZWFzb24gZXhjZWwgZGVsYXlzIHRoYXQgY2FsbC4uIGRvZXNudCBoYXBwZW4gb24gcGFnZSBmaW5pc2ggbG9hZFxuICAgICAgICAgICAgICAgICAgICBgXG5cbiAgICAgICAgICAgIGxldCBzY2hlZHVsZXJJbnN0YW5jZSA9IG51bGxcbiAgICAgICAgICAgIHRoaXMubG9ja0NhbGxiYWNrID0gKCkgPT4gdGhpcy5sb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2UpOyBcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5sb2NrQ2FsbGJhY2ssIDQwMClcbiAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IHNjaGVkdWxlckluc3RhbmNlXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZS5zdGFydCgpXG4gICAgICAgICAgICAvLyBXYWl0IHVudGlsIHRoZSB3ZWJDb250ZW50cyBpcyBmdWxseSBsb2FkZWQgIC8vIHRoaXMgaXMgbm90IHdvcmtpbmcgcmVsaWFibHkgYmVjYXVzZSB0aGUgcGFnZSBpcyBsb2FkZWQgaW4gbWFueSBzdGVwcyBhbmQgdGhlIHVpIGVsZW1lbnRzIGFyZSBub3QgYXZhaWxhYmxlIHlldFxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdhcHAtY29tbWFuZCcsIChlLCBjbWQpID0+IHtcbiAgICAgICAgICAgIC8vICdicm93c2VyLWJhY2t3YXJkJyB1bmQgJ2Jyb3dzZXItZm9yd2FyZCcgc2luZCBkaWUgQmVmZWhsZSwgZGllIGJlaW0gS2xpY2sgYXVmIGRpZSBNYXVzdGFzdGVuIGdlc2VuZGV0IHdlcmRlblxuICAgICAgICAgICAgaWYgKGNtZCA9PT0gJ2Jyb3dzZXItYmFja3dhcmQnIHx8IGNtZCA9PT0gJ2Jyb3dzZXItZm9yd2FyZCcpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIm5vIG5hdmlnYXRpb24gYWxsb3dlZFwiKVxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVybiBTaWUgZGFzIFN0YW5kYXJkdmVyaGFsdGVuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RvcCgpXG4gICAgICAgICAgICAgICAgLy9kaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdykgIC8vZG8gbm90IGRpc2FibGUgdHdpY2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIGxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSl7XG4gICAgICAgIGlmIChicm93c2VyVmlldy53ZWJDb250ZW50cyAmJiBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUpe1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIsIGZyYW1lLm5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lICYmIChmcmFtZS5uYW1lID09PSAnV2ViQXBwbGljYXRpb25GcmFtZScgfHwgZnJhbWUubmFtZSA9PT0gJ1dhY0ZyYW1lX1dvcmRfMCcgfHwgZnJhbWUubmFtZSA9PT0gJ1dhY0ZyYW1lX0V4Y2VsXzAnKSkge1xuICAgICAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIilcbiAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNjaGVkdWxlckluc3RhbmNlKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBzdG9wcGluZyBsb2NrU2NoZWR1bGVyXCIpXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZS5zdG9wKClcbiAgICAgICAgICAgIGlmICh0aGlzLmxvY2tTY2hlZHVsZXIgPT09IHNjaGVkdWxlckluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IG5vIGJyb3dzZXJWaWV3IG9yIGxvY2tTY2hlZHVsZXIgZm91bmRcIilcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgXG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIE1BSU4gV0lORE9XXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBhc3luYyBjcmVhdGVNYWluV2luZG93KCkge1xuICAgICAgICBsZXQgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBjb25zdCBjdXJyZW50RGlyID0gZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuJywgaW1wb3J0Lm1ldGEudXJsKSk7XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVswXVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2luZG93IGRpbWVuc2lvbnMgLSBkZWZpbmVkIG9uY2UsIHVzZWQgZXZlcnl3aGVyZVxuICAgICAgICBjb25zdCB3aW5kb3dXaWR0aCA9IDEwMjRcbiAgICAgICAgY29uc3Qgd2luZG93SGVpZ2h0ID0gNjQwXG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGNlbnRlciBwb3NpdGlvbiBvbiBwcmltYXJ5IGRpc3BsYXlcbiAgICAgICAgbGV0IHggPSAwXG4gICAgICAgIGxldCB5ID0gMFxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnggKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMud2lkdGggLSB3aW5kb3dXaWR0aCkgLyAyKVxuICAgICAgICAgICAgeSA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy55ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLmhlaWdodCAtIHdpbmRvd0hlaWdodCkgLyAyKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYWlud2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdNYWluIHdpbmRvdycsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHksXG4gICAgICAgICAgICB3aWR0aDogd2luZG93V2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHdpbmRvd0hlaWdodCxcbiAgICAgICAgICAgIG1pbldpZHRoOiA4NTAsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IDYwMCxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGFzIFx1MDBDNG5kZXJuIGRlciBHclx1MDBGNlx1MDBERmUgIFxuICAgICAgICAgICAgZnVsbHNjcmVlbmFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRlbiBWb2xsYmlsZG1vZHVzIC0gd2ljaHRpZyBmXHUwMEZDciBtYWNvcyBkZW5uIHdlbm4gYXVmIG1hY29zIGRhcyBtYWlud2luZG93IGF1ZiBmdWxsc2NyZWVuIGlzdCBncmVpZnQgYmVpbSBleGFtd2luZG93IGRlciBraW9zayBtb2RlIG5pY2h0ICAtIGVsZWN0cm9uIGJ1ZyAobmVlZHMgZXhhbXBsZSBjb2RlKTogPj4gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy80NDc1NVxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIC8vdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIFxuICAgICAgICAgICBcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcGF0aC5yZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50RGlyLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04pXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kVGhyb3R0bGluZzogdHJ1ZSAgLy8gYWxsb3cgdGhyb3R0bGluZyB3aGVuIHdpbmRvdyBpcyBpbiBiYWNrZ3JvdW5kXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnMgYmVmb3JlIGxvYWRpbmdcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIGFzayBiZWZvcmUgY2xvc2luZ1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiAhdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCkgeyAgLy8gYWxsb3dleGl0IGlzdCBlaW4gb3ZlcnJpZGUgdm9tIGNvbnRleHQgbWVudSBvZGVyIHNjcmVlbnNob3QgdGVzdC4gZGllc2VyIGthbm4gZGllIGFwcCBzY2hsaWVzc2VuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4pe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhhcyBubyBsZWdhY3kgdHJheVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsbG93VHJheSkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogR05PTUUgZGV0ZWN0ZWQsIHF1aXR0aW5nIGluc3RlYWQgb2YgdHJheSBtaW5pbWl6ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7ICAvLyBhbGxvdyBjbG9zZSBmbG93XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNob3dNaW5pbWl6ZVdhcm5pbmcoKVxuICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IE1pbmltaXppbmcgTmV4dC1FeGFtIHRvIFN5c3RlbXRyYXlgKSAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2V0IHdpbmRvdyBwcm9wZXJ0aWVzIGltbWVkaWF0ZWx5IGFmdGVyIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmZvY3VzKClcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAvL3RoaXMubWFpbndpbmRvdy5zZXRIaWRkZW5Jbk1pc3Npb25Db250cm9sKHRydWUpXG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbXCJERUJVR1wiXSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKVxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9YFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIFVSTDogJHt1cmx9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBhc3luYyBzaG93RXhpdFdhcm5pbmcobWVzc2FnZSl7XG4gICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09rJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBCZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dFeGl0UXVlc3Rpb24oKXtcbiAgICAgICAgaWYgKHRoaXMuZXhpdFF1ZXN0aW9uT3Blbikge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZGlhbG9nIGFscmVhZHkgb3Blbiwgc2tpcHBpbmdcIilcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ0phJywgJ05laW4nXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIGJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdXb2xsZW4gc2llIGRpZSBBbndlbmR1bmcgTmV4dC1FeGFtIGJlZW5kZW4/JyxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZihjaG9pY2UucmVzcG9uc2UgPT0gMSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZG8gbm90IGNsb3NlIE5leHQtRXhhbSBhZnRlciBmaW5pc2hlZCBFeGFtXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93TWluaW1pemVXYXJuaW5nKCl7XG4gICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW5mbycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWluaW1pemUgdG8gU3lzdGVtIFRyYXknLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdEaWUgQW53ZW5kdW5nIE5leHQtRXhhbSB3dXJkZSBtaW5pbWllcnQhJyxcbiAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogQWRkaXRpb25hbCBGdW5jdGlvbnNcbiAgICAgKi9cblxuICAgIGlzV2F5bGFuZCgpe1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnOyBcbiAgICB9XG5cbiAgICAvLyB0aGlzIGZ1bmN0aW9uIHVzZXMgYWN0aXZlLXdpbiB0byByZWNlaXZlIG5hbWUgYW5kIHVybCBmcm9tIGFjdGl2ZSB3aW5kb3cgLSB5ZXQgYW5vdGhlciB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGUgZm9jdXMgaXMgc3RpbGwgb24gbmV4dGV4YW1cbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gaW50cm9kdWNlIGV4ZW1wdGlvbnMgZm9yIHRoZSBibHVyIGxpc3RlbmVyXG4gICAgLy8gKGRvd25ncmFkZWQgZnJvbSBnZXQtd2luZG93cyBiZWNhdXNlIG9mIG5hcGkgdjkgaXNzdWUpIGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvZ2V0LXdpbmRvd3MvaXNzdWVzLzE4NlxuICAgIGFzeW5jIHdpbmRvd1RyYWNrZXIoKXtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgLy8gY29uc3QgZ2V0d2luID0gYXdhaXQgdGhpcy5nZXRBY3RpdmVXaW5kb3coKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZVdpbiA9IGF3YWl0IGFjdGl2ZVdpbmRvdygpXG4gICAgICAgICBcbiAgICAgICAgICAgIGlmIChhY3RpdmVXaW4gJiYgYWN0aXZlV2luLm93bmVyICYmIGFjdGl2ZVdpbi5vd25lci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgbGV0IG5hbWUgPSBhY3RpdmVXaW4ub3duZXIubmFtZVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aCA9IGFjdGl2ZVdpbi5vd25lci5wYXRoXG4gICAgICAgICAgICAgICAgbGV0IG5hbWVMb3dlciA9IG5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aExvd2VyID0gd3BhdGgudG9Mb3dlckNhc2UoKVxuXG4gICAgICAgICAgICAgICAgaWYgKG5hbWVMb3dlci5pbmNsdWRlcyhcImV4YW1cIikgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwibmV4dFwiKSAgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwiZWxlY3Ryb25cIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJlYXNlb2ZhY2Nlc3NkaWFsb2dcIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJkaXNhYmxlLXNob3J0Y3V0c1wiKSApeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGZva3VzIGlzIG9uIGFsbG93ZWQgd2luZG93IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgLy9mb2N1cyBpcyBub3Qgb24gbmV4dC1leGFtIG9yIGFueSBvdGhlciBhbGxvd2VkIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5mb2N1c1RhcmdldEFsbG93ZWQpeyAgLy9sb2cganVzdCBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6IGZvY3VzIGxvc3QgZXZlbnQgd2FzIHRyaWdnZXJlZC4gYXBwOiAke3dwYXRofSAtICR7bmFtZX0gYClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogJHtlcnJ9YCkgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2FkZHMgYmx1ciBsaXN0ZW5lciB3aGVuIGVudGVyaW5nIGV4YW1tb2RlICAgLy8gYmx1ciBldmVudCBpc250IGZpcmVkIG9uIG1hY29zIE1JU1NJT05DT05UUk9MICh3aGljaCBjYW50IGJlIGRlYWN0aXZhdGVkIGFueW1vcmUpIC0gZGFtbiB5b3UgYXBwbGUhXG4gICAgYWRkQmx1ckxpc3RlbmVyKHdpbmRvdyA9IFwiZXhhbXdpbmRvd1wiKXtcbiAgICAgICAgaWYgKHdpbmRvdyA9PT0gXCJleGFtd2luZG93XCIpeyBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fWApXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudCh0aGlzKSkgXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2luZG93ID09PSBcInNjcmVlbmxvY2tcIikge1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9d2luZG93YClcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50U2NyZWVubG9jayh0aGlzKSkgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvL3JlbW92ZXMgYmx1ciBsaXN0ZW5lciB3aGVuIGxlYXZpbmcgZXhhbSBtb2RlXG4gICAgcmVtb3ZlQmx1ckxpc3RlbmVyKCl7XG4gICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZUFsbExpc3RlbmVycygnYmx1cicpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCByZW1vdmVCbHVyTGlzdGVuZXI6IHJlbW92aW5nIGJsdXIgbGlzdGVuZXJcIilcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBpbXBsZW1lbnRpbmcgYSBzbGVlcCAod2FpdCkgZnVuY3Rpb25cbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgIC8vc3R1ZGVudCBmb2d1cyB3ZW50IHRvIGFub3RoZXIgd2luZG93XG4gICAgYXN5bmMgYmx1cmV2ZW50KHdpbmhhbmRsZXIpIHsgXG5cbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBzdHVkZW50IHRyaWVkIHRvIGxlYXZlIGV4YW0gd2luZG93XCIpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcpe1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53aW5kb3dUcmFja2VyKCkgIC8vY2hlY2tzIGlmIG5ldyBmb2N1cyB3aW5kb3cgaXMgYWxsb3dlZFxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3d0cmFja2VyIGNoZWNrIGRvbmUuLi5cIilcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgc2NyZWVubG9jayB3aW5kb3dzIGZyb20gYXJyYXkgYW5kIGNoZWNrIGlmIGFueSBzdGlsbCBleGlzdFxuICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIGNvbnN0IGhhc0FjdGl2ZVNjcmVlbmxvY2sgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLnNvbWUod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkgJiYgd2luLmlzVmlzaWJsZSgpKVxuICAgICAgICAvLyBBbHNvIGNoZWNrIGNsaWVudGluZm8uc2NyZWVubG9jayBmbGFnIGFzIGZhbGxiYWNrIGluIGNhc2UgYXJyYXkgd2FzIGNsZWFyZWQgYnV0IHdpbmRvd3Mgc3RpbGwgZXhpc3RcbiAgICAgICAgaWYgKGhhc0FjdGl2ZVNjcmVlbmxvY2sgfHwgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LnNjcmVlbmxvY2spIHsgcmV0dXJuIH0vLyBkbyBub3RoaW5nIGlmIHNjcmVlbmxvY2t3aW5kb3cgc3RvbGUgZm9jdXMgLy8gZG8gbm90IHRyaWdnZXIgYW4gaW5maW5pdGUgbG9vcCBiZXR3ZWVuIGV4YW0gd2luZG93IGFuZCBzY3JlZW5sb2NrIHdpbmRvdyAoc3RlYWxpbmcgZWFjaCBvdGhlcnMgZm9jdXMgYmVjYXVzZSBzY3JlZW5sb2Nrd2luZG93IGFwcGVhcnMgYWJvdmUgZXhhbSB3aW5kb3cgYW5kIHdpbGwgY2FwdHVyZSBhIGtsaWNrIGFuZCB0aGVyZWZvcmUgc3RlYWwgZm9jdXMpXG4gICAgICAgIGlmICh3aW5oYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCl7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7IC8vdHJvdHpkZW0gZm9jdXMgenVyXHUwMEZDY2sgYXVmIGRpZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBibHVyZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2UgICAvL2luZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuXG4gICAgICAgIC8vdHVybiB2b2x1bWUgdXAgXl5cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgc3Bhd24oJ3Bvd2Vyc2hlbGwnLCBbJ1NldC1Wb2x1bWVMZXZlbCAtTGV2ZWwgMTAwOyBTZXQtVm9sdW1lTXV0ZSAtTXV0ZSAkZmFsc2UnXSk7IH1cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgZXhlYygnb3Nhc2NyaXB0IC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgdm9sdW1lIDEwMFwiIC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgbXV0ZWQgZmFsc2VcIicpOyB9ICBcbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHsgXG4gICAgICAgIC8vICAgICBleGVjKCdhbWl4ZXIgc2V0IE1hc3RlciAxMDAlICcpO1xuICAgICAgICAvLyAgICAgZXhlYygncGFjdGwgc2V0LXNpbmstbXV0ZSBgcGFjdGwgZ2V0LWRlZmF1bHQtc2lua2AgMCcpO1xuICAgICAgICAvLyB9XG4gICAgICAgIFxuICAgICAgICAvL3dlIGNvdWxkIHBsYXkgYSBzb3VuZCBmaWxlIGhlcmUuLiB0YmQuICBcbiAgICB9XG4gICAgLy9zcGVjaWFsIGJsdXIgZXZlbnQgZm9yIHRlbXBvcmFyeSBsb3cgc2VjdXJpdHkgc2NyZWVubG9ja1xuICAgIGJsdXJldmVudFNjcmVlbmxvY2sod2luaGFuZGxlcikgeyBcbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogYmx1ci1zY3JlZW5sb2NrIHRyaWdnZXJlZFwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9kb24ndCBjeWNsZSB0aHJvdWdoIGFsbCBvZiB0aGVtIC4uIGl0IHdpbGwgY3JlYXRlIGFuIGluZmluaXRlIGZvY3VzIHJhY2VcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uc2hvdygpOyAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0ubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogJHtlcnJ9YClcbiAgICAgICAgfVxuICAgIFxuICAgIH1cbiAgICBcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgV2luZG93SGFuZGxlcigpXG4gXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXRcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIG1vc3Qgb2YgdGhlIGtleWJvYXJkIHJlc3RyaWN0aW9ucyBjb3VsZCBiZSBoYW5kbGVkIGJ5IFwiaW9ob29rXCIgZm9yIGFsbCBwbGF0Zm9ybXNcbiAqIHVuZm9ydHVuYWxldHkgaXQncyBub3QgeWV0IHJlbGVhc2VkIGZvciBub2RlIHYxNi54IGFuZCBlbGVjdHJvbiB2MTYueCAgKGFsc28gaXQncyBcImJpZyBzdXJcIiBpbnRlbCBvbmx5IG9uIG1hY3MpXG4gKiBodHRwczovL3dpbGl4LXRlYW0uZ2l0aHViLmlvL2lvaG9vay9pbnN0YWxsYXRpb24uaHRtbFxuICpcbiAqIFwibm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyXCIgd291bGQgYmUgYW5vdGhlciBzb2x1dGlvbiBmb3Igd2luZG93cyBhbmQgbWFjb3MgKGFsdGhvdWdoIGl0IHJlcXVpcmVzIFwiYWNjZXNzYWJpbGl0eVwiIHBlcm1pc3Npb25zIG9uIG1hYylcbiAqIGJ1dCBmb3Igbm93IGl0IHNlZW1zIHRoZSBtb2R1bGUgY2FuIG5vdCBydW4gaW4gYSBmaW5hbCBlbGVjdHJvbiBidWlsZFxuICogaHR0cHM6Ly9naXRodWIuY29tL0xhdW5jaE1lbnUvbm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyL2lzc3Vlcy8xOFxuICpcbiAqIGhhcmRjb2RpbmcgdGhlIGtleWJvYXJkc2hvcnRjdXRzIHdlIHdhbnQgdG8gY2FwdHVyZSBpbnRvIGlvaG9vayhvciBuLWctay1sKSBhbmQgbWFudWFsbHkgY29tcGlsaW5nIGl0IGZvciBtYWMgYW5kIHdpbmRvd3MgY291bGQgYmUgZG9uZSAtIChidXQgbm90IHVudGlsIGkgZ2V0IHBhaWQgZm9yIHRoaXMgYW1vdW50IG9mIHdvcmsgOy0pXG4gKi9cblxuXG4vKipcbiAqIHRoZSBuZXh0IGJlc3Qgc29sdXRpb24gaSBjYW1lIHVwIHdpdGggaXMgdG8ga2lsbCBhbGwgb2YgdGhlIHNoZWxscyAtIHN0YXJ0aW5nIHdpdGggZXhwbG9yZXIuZXhlIGJlY2F1c2UgaXRzIGFic29sdXRlbHkgaW1wb3NzaWJsZSB0b1xuICogZGVhY3RpdmF0ZSB0aGlzIG5hc3R5IFwid2luZG93c1wiIGJ1dHRvbiBvciAzRmluZ2VyU2xpZGVVcCBHZXN0dXJlIGluIHdpbmRvd3MgMTEgLSB5b3UgY291bGQgZWRpdCB0aGUgcmVnaXN0cnkgYW5kIHJlYm9vdCBidXQgdGhhdHMgb2J2aW91c2x5IG5vdCB3aGF0IHdlIHdhbnRcbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgY2xpcGJvYXJkLCBnbG9iYWxTaG9ydGN1dCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IFNjaGVkdWxlclNlcnZpY2UgfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBlbmFibGVMaW51eFJlc3RyaWN0aW9ucywgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbGluLmpzJztcbmltcG9ydCB7IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMsIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvd2luLmpzJztcbmltcG9ydCB7IGVuYWJsZU1hY1Jlc3RyaWN0aW9ucywgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biBhcyB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbCB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL21hYy5qcyc7XG5cbmxldCBjbGlwYm9hcmRJbnRlcnZhbDtcbmxldCBjb25maWdTdG9yZSA9IHtcbiAgICBsaW51eDoge30sXG4gICAgd2luZG93czoge30sXG4gICAgbWFjb3M6IHt9XG59O1xuXG4vLyBsaXN0IG9mIGFwcHMgd2UgZG8gbm90IHdhbnQgdG8gcnVuIGluIGJhY2tncm91bmRcbmNvbnN0IGFwcHNUb0Nsb3NlID0gWydHb29nbGUgQ2hyb21lJywgJ2Nocm9tZScsICdnb29nbGUtY2hyb21lJywgJ01pY3Jvc29mdCBFZGdlJywgJ21zZWRnZScsICdmaXJlZm94JywgJ3NhZmFyaScsICdicmF2ZScsICdvcGVyYScsICdjaGF0Z3B0JywgJ0NoYXRHUFQnLCAnTm9ydG9uU2VjdXJpdHknLCAnTkFWJywgJ1RlYW1zJywgJ21zLXRlYW1zJywgJ3pvb20udXMnLCAnTWljcm9zb2Z0IFRlYW1zJywgJ2Rpc2NvcmQnLCAnem9vbScsICd0ZWFtcycsICd0ZWFtdmlld2VyJywgJ3NreXBlZm9ybGludXgnLCAnc2t5cGUnLCAnYW55ZGVzayddO1xuXG5hc3luYyBmdW5jdGlvbiBlbmFibGVSZXN0cmljdGlvbnMod2luaGFuZGxlcikge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG5cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBwbGF0Zm9ybSByZXN0cmljdGlvbnNcIik7XG5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgY2xpcGJvYXJkLmNsZWFyKCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSgoKSA9PiB7IGNsaXBib2FyZC5jbGVhcigpOyB9LCAxMDAwKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdGFydCgpO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBlbmFibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSwgYXBwc1RvQ2xvc2UsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0tERSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzR05PTUUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgYXdhaXQgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpc2FibGVSZXN0cmljdGlvbnMoKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogcmVtb3ZpbmcgcmVzdHJpY3Rpb25zLi4uXCIpO1xuXG4gICAgaWYgKGNsaXBib2FyZEludGVydmFsKSB7XG4gICAgICAgIGNsaXBib2FyZEludGVydmFsLnN0b3AoKTtcbiAgICB9XG5cbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bkltcGwoZW5hYmxlKTtcbn1cblxuZXhwb3J0IHsgZW5hYmxlUmVzdHJpY3Rpb25zLCBkaXNhYmxlUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIH07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIExpbnV4LXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHVuZm9ydHVuYXRlbHkgdGhlcmUgaXMgbm8gY29udmVuaWVudCB3YXkgZm9yIGdub21lLXNoZWxsIHRvIHVuLXNldCBBTEwgc2hvcnRjdXRzIGF0IG9uY2VcbmNvbnN0IGdub21lS2V5YmluZGluZ3MgPSBbXG4gICAgJ2FjdGl2YXRlLXdpbmRvdy1tZW51JywnbWF4aW1pemUtaG9yaXpvbnRhbGx5JywnbW92ZS10by1zaWRlLW4nLCdtb3ZlLXRvLXdvcmtzcGFjZS04Jywnc3dpdGNoLWFwcGxpY2F0aW9ucycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMycsJ3N3aXRjaC13aW5kb3dzLWJhY2t3YXJkJyxcbiAgICAnYWx3YXlzLW9uLXRvcCcsJ21heGltaXplLXZlcnRpY2FsbHknLCdtb3ZlLXRvLXNpZGUtcycsJ21vdmUtdG8td29ya3NwYWNlLTknLCdzd2l0Y2gtYXBwbGljYXRpb25zLWJhY2t3YXJkJywnICBzd2l0Y2gtdG8td29ya3NwYWNlLTQnLCd0b2dnbGUtYWJvdmUnLFxuICAgICdiZWdpbi1tb3ZlJywnbWluaW1pemUnLCdtb3ZlLXRvLXNpZGUtdycsJ21vdmUtdG8td29ya3NwYWNvZS1kb3duJywnc3dpdGNoLWdyb3VwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS01JywndG9nZ2xlLWZ1bGxzY3JlZW4nLFxuICAgICdiZWdpbi1yZXNpemUnLCdtb3ZlLXRvLWNlbnRlcicsJ21vdmUtdG8td29ya3NwYWNlLTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sYXN0Jywnc3dpdGNoLWdyb3VwLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS02JywndG9nZ2xlLW1heGltaXplZCcsXG4gICAgJ2Nsb3NlJywnbW92ZS10by1jb3JuZXItbmUnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMCcsJ21vdmUtdG8td29ya3NwYWNlLWxlZnQnLCdzd2l0Y2gtaW5wdXQtc291cmNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS03JywndG9nZ2xlLW9uLWFsbC13b3Jrc3BhY2VzJyxcbiAgICAnY3ljbGUtZ3JvdXAnLCdtb3ZlLXRvLWNvcm5lci1udycsJ21vdmUtdG8td29ya3NwYWNlLTExJywnbW92ZS10by13b3Jrc3BhY2UtcmlnaHQnLCdzd2l0Y2gtaW5wdXQtc291cmNlLWJhY2t3YXJkICBzd2l0Y2gtdG8td29ya3NwYWNlLTgnLCd0b2dnbGUtc2hhZGVkJyxcbiAgICAnY3ljbGUtZ3JvdXAtYmFja3dhcmQnLCdtb3ZlLXRvLWNvcm5lci1zZScsJ21vdmUtdG8td29ya3NwYWNlLTEyJywnbW92ZS10by13b3Jrc3BhY2UtdXAnLCdzd2l0Y2gtcGFuZWxzJywnc3dpdGNoLXRvLXdvcmtzcGFjZS05JywndW5tYXhpbWl6ZScsXG4gICAgJ2N5Y2xlLXBhbmVscycsJ21vdmUtdG8tY29ybmVyLXN3JywnbW92ZS10by13b3Jrc3BhY2UtMicsJ3BhbmVsLW1haW4tbWVudScsJ3N3aXRjaC1wYW5lbHMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWRvd24nLFxuICAgICdjeWNsZS1wYW5lbHMtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItZG93bicsJ21vdmUtdG8td29ya3NwYWNlLTMnLCdwYW5lbC1ydW4tZGlhbG9nJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sYXN0JyxcbiAgICAnY3ljbGUtd2luZG93cycsJ21vdmUtdG8tbW9uaXRvci1sZWZ0JywnbW92ZS10by13b3Jrc3BhY2UtNCcsJ3JhaXNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGVmdCcsXG4gICAgJ2N5Y2xlLXdpbmRvd3MtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItcmlnaHQnLCdtb3ZlLXRvLXdvcmtzcGFjZS01JywncmFpc2Utb3ItbG93ZXInLCdzd2l0Y2gtdG8td29ya3NwYWNlLTExJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1yaWdodCcsXG4gICAgJ2xvd2VyJywnbW92ZS10by1tb25pdG9yLXVwJywnbW92ZS10by13b3Jrc3BhY2UtNicsJ3NldC1zcGV3LW1hcmsnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS11cCcsXG4gICAgJ21heGltaXplJywnbW92ZS10by1zaWRlLWUnLCdtb3ZlLXRvLXdvcmtzcGFjZS03Jywnc2hvdy1kZXNrdG9wJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0yJywnc3dpdGNoLXdpbmRvd3MnXG5dO1xuY29uc3QgZ25vbWVTaGVsbEtleWJpbmRpbmdzID0gWydmb2N1cy1hY3RpdmUtbm90aWZpY2F0aW9uJywnb3Blbi1hcHBsaWNhdGlvbi1tZW51Jywnc2NyZWVuc2hvdCcsJ3NjcmVlbnNob3Qtd2luZG93Jywnc2hpZnQtb3ZlcnZpZXctZG93bicsXG4gICAgJ3NoaWZ0LW92ZXJ2aWV3LXVwJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTEnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0zJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTQnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNScsXG4gICAgJ3N3aXRjaC10by1hcHBsaWNhdGlvbi02Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTcnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi05Jywnc2hvdy1zY3JlZW5zaG90LXVpJywnc2hvdy1zY3JlZW4tcmVjb3JkaW5nLXVpJyxcbiAgICAndG9nZ2xlLWFwcGxpY2F0aW9uLXZpZXcnLCd0b2dnbGUtbWVzc2FnZS10cmF5JywndG9nZ2xlLW92ZXJ2aWV3J107XG5jb25zdCBnbm9tZU11dHRlcktleWJpbmRpbmdzID0gWydyb3RhdGUtbW9uaXRvcicsJ3N3aXRjaC1tb25pdG9yJywndGFiLXBvcHVwLWNhbmNlbCcsJ3RhYi1wb3B1cC1zZWxlY3QnLCd0b2dnbGUtdGlsZWQtbGVmdCcsJ3RvZ2dsZS10aWxlZC1yaWdodCddO1xuY29uc3QgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MgPSBbJ2FwcC1jdHJsLWhvdGtleS0xJywnYXBwLWN0cmwtaG90a2V5LTEwJywnYXBwLWN0cmwtaG90a2V5LTInLCdhcHAtY3RybC1ob3RrZXktMycsJ2FwcC1jdHJsLWhvdGtleS00JywnYXBwLWN0cmwtaG90a2V5LTUnLFxuICAgICdhcHAtY3RybC1ob3RrZXktNicsJ2FwcC1jdHJsLWhvdGtleS03JywnYXBwLWN0cmwtaG90a2V5LTgnLCdhcHAtY3RybC1ob3RrZXktOScsXG4gICAgJ2FwcC1ob3RrZXktMScsJ2FwcC1ob3RrZXktMTAnLCdhcHAtaG90a2V5LTInLCdhcHAtaG90a2V5LTMnLCdhcHAtaG90a2V5LTQnLCdhcHAtaG90a2V5LTUnLCdhcHAtaG90a2V5LTYnLCdhcHAtaG90a2V5LTcnLCdhcHAtaG90a2V5LTgnLCdhcHAtaG90a2V5LTknLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTEnLCdhcHAtc2hpZnQtaG90a2V5LTEwJywnYXBwLXNoaWZ0LWhvdGtleS0yJywnYXBwLXNoaWZ0LWhvdGtleS0zJywnYXBwLXNoaWZ0LWhvdGtleS00JywnYXBwLXNoaWZ0LWhvdGtleS01JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS02JywnYXBwLXNoaWZ0LWhvdGtleS03JywnYXBwLXNoaWZ0LWhvdGtleS04JywnYXBwLXNoaWZ0LWhvdGtleS05Jywnc2hvcnRjdXQnXTtcbmNvbnN0IGdub21lV2F5bGFuZEtleWJpbmRpbmdzID0gWydzd2l0Y2gtdG8tc2Vzc2lvbi0xJywnc3dpdGNoLXRvLXNlc3Npb24tMicsJ3N3aXRjaC10by1zZXNzaW9uLTMnLCdzd2l0Y2gtdG8tc2Vzc2lvbi00Jywnc3dpdGNoLXRvLXNlc3Npb24tNScsJ3N3aXRjaC10by1zZXNzaW9uLTYnLCdzd2l0Y2gtdG8tc2Vzc2lvbi03Jywnc3dpdGNoLXRvLXNlc3Npb24tOCcsJ3N3aXRjaC10by1zZXNzaW9uLTknLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMCcsJ3N3aXRjaC10by1zZXNzaW9uLTExJywnc3dpdGNoLXRvLXNlc3Npb24tMTInXTtcblxuLyoqXG4gKiBFbmFibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChLREUvR05PTUUsIGNsb3NlIGFwcHMsIGNsaXBib2FyZCkuXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnU3RvcmUgLSBzaGFyZWQgc3RvcmUgKGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMpXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzS0RFXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzR05PTUVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgaXNLREUsIGlzR05PTUUpIHtcbiAgICB0cnkge1xuICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cImAsIChwZ3JlcEVycm9yLCBzdGRvdXQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBncmVwRXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCIgfCB4YXJncyAtciBraWxsIC05YCwgKGtpbGxFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFraWxsRXJyb3IpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICBpZiAoaXNLREUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgS0RFIHJlc3RyaWN0aW9uc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrcmVhZGNvbmZpZzUnLCBbJy0tZmlsZScsICdrd2lucmMnLCAnLS1ncm91cCcsICdEZXNrdG9wcycsICctLWtleScsICdOdW1iZXInXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoa3JlYWRjb25maWcpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IDE7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IHN0ZG91dC50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiByZWNvbmZpZ3VyaW5nIGt3aW5cIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsICdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCdcIlwiJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsJ2t3aW5yYycsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywnMSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdzZXRDdXJyZW50RGVza3RvcCcsJzEnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBlZmZlY3RzXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdkZXNrdG9wZ3JpZCddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnc2NyZWVuZWRnZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnb3ZlcnZpZXcnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGFkZGl0aW9uYWwgdHR5J3NcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJ3NydnJrZXlzOm5vbmUnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xlYXJpbmcgY2xpcGJvYXJkIGhpc3RvcnlcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGdsb2JhbCBrZXlib2FyZHNob3J0Y3V0c1wiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnb3JnLmtkZS5LR2xvYmFsQWNjZWwuYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAndHJ1ZSddKTtcbiAgICAgICAgfSwgMjAwMCk7XG4gICAgfVxuXG4gICAgaWYgKGlzR05PTUUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgR05PTUUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXYXlsYW5kOiBkaXNhYmxlIFZUL1RUWSBzd2l0Y2ggKEN0cmwrQWx0K0YxLi5GMTIpIHZpYSBtdXR0ZXIga2V5YmluZGluZ3NcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmcsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGNvbmYnLCBbJ3dyaXRlJywgYC9vcmcvZ25vbWUvbXV0dGVyL3dheWxhbmQva2V5YmluZGluZ3MvJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleScsIGAnJ2BdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5tdXR0ZXIgZHluYW1pYy13b3Jrc3BhY2VzIGZhbHNlJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUuZGVza3RvcC53bS5wcmVmZXJlbmNlcyBudW0td29ya3NwYWNlcyAxJyk7XG4gICAgICAgICAgICAvLyBYMTEgb25seTogZGlzYWJsZSBUVFkgc3dpdGNoIHZpYSBzZXR4a2JtYXAgKG9uIFdheWxhbmQgd2UgcmVseSBvbiBtdXR0ZXIga2V5YmluZGluZ3MgYWJvdmUpXG4gICAgICAgICAgICBpZiAoIXBsYXRmb3JtRGlzcGF0Y2hlci5pc1dheWxhbmQoKSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3NldHhrYm1hcCAtb3B0aW9uIHNydnJrZXlzOm5vbmUnLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZy53YXJuKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoR05PTUUpOiBzZXR4a2JtYXAgc3J2cmtleXM6bm9uZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxufVxuXG4vKipcbiAqIERpc2FibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIGFuZCByZXN0b3JlIEtERS9HTk9NRSBzZXR0aW5ncy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSkge1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IEtERSBkZXRlY3RlZFwiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ2Jsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ2ZhbHNlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJyAsJy9Db21wb3NpdG9yJywgJ29yZy5rZGUua3dpbi5Db21wb3NpdGluZy5yZXN1bWUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBrZ2xvYmFsYWNjZWw1JicpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCctLWRlbGV0ZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBwbGFzbWFzaGVsbCAmJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcsICdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBiaW5kaW5nXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleSddKTtcbiAgICAvLyByZXN0b3JlIFRUWSBzd2l0Y2ggaWYgd2UgaGFkIGRpc2FibGVkIGl0IHZpYSBzZXR4a2JtYXAgKEdOT01FIFgxMSlcbiAgICBpZiAoY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0KSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKFwic2V0eGtibWFwIC1vcHRpb24gJydcIiwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogc2V0eGtibWFwIHJlc3RvcmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gZmFsc2U7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBXaW5kb3dzLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbi8qKlxuICogRW5hYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChzaG9ydGN1dHMsIGNsb3NlIGFwcHMsIGtpbGwgZXhwbG9yZXIpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gb25lIG1vcmUgbGV2ZWwgdXA6IHJlc3RyaWN0aW9ucy8gLT4gc2NyaXB0cy8gLT4gbWFpbi8gLT4gcGFja2FnZXMvIChzYW1lIHRhcmdldCBhcyBvcmlnaW5hbCBwbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyBpbiBzY3JpcHRzLylcbiAgICAgICAgY29uc3QgZXhlY3V0YWJsZTEgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3B1YmxpYy9kaXNhYmxlLXNob3J0Y3V0cy5leGUnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKGV4ZWN1dGFibGUxLCBbXSwgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnLCBzaGVsbDogZmFsc2UsIHdpbmRvd3NIaWRlOiB0cnVlIH0pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiB3aW5kb3dzIHNob3J0Y3V0cyBkaXNhYmxlZFwiKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAod2luIHNob3J0Y3V0cyk6ICR7ZXJyfWApOyB9XG5cbiAgICB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IGFwcCBvZiBhcHBzVG9DbG9zZSkge1xuICAgICAgICAgICAgY29uc3QgZXNjYXBlZEFwcCA9IGFwcC5yZXBsYWNlKC8nL2csIFwiJydcIik7XG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRhcHBOYW1lID0gJyR7ZXNjYXBlZEFwcH0nOyB0cnkgeyAkcHJvY3MgPSBHZXQtUHJvY2VzcyAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7ICRfLlByb2Nlc3NOYW1lIC1pbGlrZSAoJyonICsgJGFwcE5hbWUgKyAnKicpIH07IGlmICgkcHJvY3MgLWFuZCAkcHJvY3MuQ291bnQgLWd0IDApIHsgJHByb2NzIHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZTsgV3JpdGUtT3V0cHV0ICdraWxsZWQnIH0gfSBjYXRjaCB7IH1cImA7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZUFwcCkgPT4ge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKS5pbmNsdWRlcygna2lsbGVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVBcHAoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICBpZiAoIXdpbmhhbmRsZXIpIHtcbiAgICAgICAgbG9nLndhcm4oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiB3aW5oYW5kbGVyIGlzIG5vdCBwcm92aWRlZCAtIHNraXBwaW5nIGV4cGxvcmVyLmV4ZSBraWxsYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHJldHJ5Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTAwO1xuICAgICAgICBjb25zdCBraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHdpbmhhbmRsZXIuZXhhbXdpbmRvdyAmJiAhd2luaGFuZGxlci5leGFtd2luZG93LmlzRGVzdHJveWVkPy4oKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNra2lsbCAvZiAvaW0gZXhwbG9yZXIuZXhlJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGV4cGxvcmVyLmV4ZWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0cnlDb3VudCA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICByZXRyeUNvdW50Kys7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzLCAxMDApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGV4YW13aW5kb3cgbm90IGZvdW5kIGFmdGVyICR7bWF4UmV0cmllcyAqIDEwMH1tcyAtIHNraXBwaW5nIGV4cGxvcmVyLmV4ZSBraWxsYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMoKTtcbiAgICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBXaW5kb3dzLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAodW5ibG9jayBzaG9ydGN1dHMsIHJlc3RhcnQgZXhwbG9yZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMoKSB7XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHVuYmxvY2tpbmcgc2hvcnRjdXRzLi4uXCIpO1xuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGB0YXNra2lsbCAgL0lNIFwiZGlzYWJsZS1zaG9ydGN1dHMuZXhlXCIgL1QgL0ZgLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGRpc2FibGUtc2hvcnRjdXRzLmV4ZWApO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIGV4cGxvcmVyLmV4ZVwiJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGB0YXNrbGlzdCBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXN0ZG91dC5pbmNsdWRlcygnZXhwbG9yZXIuZXhlJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogcmVzdGFydGluZyBleHBsb3Jlci4uLlwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdzdGFydCBleHBsb3Jlci5leGUnLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZXJlc3RyaWN0aW9ucyAod2luIGV4cGxvcmVyKTogJHtlLm1lc3NhZ2V9YCk7IH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogbWFjT1Mtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSwgdG9nZ2xlTWFjT1NMb2NrZG93bikuXG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBUb3VjaEJhciwgc3lzdGVtUHJlZmVyZW5jZXMsIHBvd2VyTW9uaXRvciB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuLy8gc3RvcmVkIHJlZnMgZm9yIGNsZWFudXAgd2hlbiBkaXNhYmxpbmcgbWFjT1MgcmVzdHJpY3Rpb25zXG5sZXQgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBudWxsO1xubGV0IGxvZ1N0cmVhbVByb2Nlc3MgPSBudWxsO1xubGV0IGN1cnJlbnRXaW5oYW5kbGVyID0gbnVsbDtcblxuLyoqIFNpbmdsZSBoYW5kbGVyIGZvciBhbGwgbWFjT1MgcmVzdHJpY3Rpb24gc2lnbmFsczogbG9nIGFuZCByZS1mb2N1cyBleGFtIHdpbmRvdyAvIGluZm9ybSB0ZWFjaGVyLiAqL1xuZnVuY3Rpb24gb25NYWNSZXN0cmljdGlvblNpZ25hbChzaWduYWxOYW1lKSB7XG4gICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiAke3NpZ25hbE5hbWV9IGRldGVjdGVkYCk7XG4gICAgaWYgKCFjdXJyZW50V2luaGFuZGxlcj8uZXhhbXdpbmRvdz8uaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgIGlmIChjdXJyZW50V2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8pIGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGluZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTtcbiAgICB9XG59XG5cbmNvbnN0IGxvY2tTY3JlZW5IYW5kbGVyID0gKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnbG9jay1zY3JlZW4nKTtcbmNvbnN0IHVubG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCd1bmxvY2stc2NyZWVuJyk7XG5cbi8qKlxuICogRW5hYmxlIG1hY09TLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoVG91Y2hCYXIsIGNsaXBib2FyZCwgY2xvc2UgYXBwcywgd29ya3NwYWNlL2xvY2sgbW9uaXRvcmluZykuXG4gKiBAcGFyYW0ge29iamVjdH0gd2luaGFuZGxlciAtIG11c3QgaGF2ZSB3aW5oYW5kbGVyLmV4YW13aW5kb3dcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZU1hY1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSkge1xuICAgIGNvbnN0IHsgVG91Y2hCYXJMYWJlbCwgVG91Y2hCYXJTcGFjZXIgfSA9IFRvdWNoQmFyO1xuICAgIGNvbnN0IHRleHRsYWJlbCA9IG5ldyBUb3VjaEJhckxhYmVsKHsgbGFiZWw6IFwiTmV4dC1FeGFtXCIgfSk7XG4gICAgY29uc3QgdG91Y2hCYXIgPSBuZXcgVG91Y2hCYXIoe1xuICAgICAgICBpdGVtczogW1xuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgICAgIHRleHRsYWJlbCxcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgIF1cbiAgICB9KTtcbiAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3c/LnNldFRvdWNoQmFyKHRvdWNoQmFyKTtcbiAgICBjdXJyZW50V2luaGFuZGxlciA9IHdpbmhhbmRsZXI7XG5cbiAgICBjaGlsZFByb2Nlc3MuZXhlYygncGJjb3B5IDwgL2Rldi9udWxsJyk7XG5cbiAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwa2lsbCAtOSAtZiBcIiR7YXBwfVwiYCwgKGVycm9yLCBzdGRlcnIsIHN0ZG91dCkgPT4ge30pO1xuICAgIH0pO1xuXG4gICAgLy8gd29ya3NwYWNlL3NwYWNlIHN3aXRjaCBhbmQgbG9jay91bmxvY2sgbW9uaXRvcmluZyAobWFjT1Mgb25seSlcbiAgICB0cnkge1xuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IHN5c3RlbVByZWZlcmVuY2VzLnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbignTlNXb3Jrc3BhY2VBY3RpdmVTcGFjZURpZENoYW5nZU5vdGlmaWNhdGlvbicsICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ2Rlc2t0b3Avc3BhY2Ugc3dpdGNoJykpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiBzdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24nLCBlcnIpOyB9XG5cbiAgICBwb3dlck1vbml0b3Iub24oJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vbigndW5sb2NrLXNjcmVlbicsIHVubG9ja1NjcmVlbkhhbmRsZXIpO1xuXG4gICAgbG9nU3RyZWFtUHJvY2VzcyA9IHNwYXduKCdsb2cnLCBbJ3N0cmVhbScsICctLXByZWRpY2F0ZScsICdzdWJzeXN0ZW0gPT0gXCJjb20uYXBwbGUuZG9ja1wiIEFORCBjYXRlZ29yeSA9PSBcIm1pc3Npb25jb250cm9sXCInXSk7XG4gICAgbG9nU3RyZWFtUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICAgICAgaWYgKGRhdGEudG9TdHJpbmcoKS5pbmNsdWRlcygnbW9kZScpKSBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdNaXNzaW9uIENvbnRyb2wnKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBEaXNhYmxlIG1hY09TLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAodG91Y2hiYXIsIG1vbml0b3JpbmcgbGlzdGVuZXJzIGFuZCBsb2cgcHJvY2VzcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zKCkge1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gbnVsbDtcbiAgICBpZiAod29ya3NwYWNlTm90aWZpY2F0aW9uSWQgIT0gbnVsbCkge1xuICAgICAgICB0cnkgeyBzeXN0ZW1QcmVmZXJlbmNlcy51bnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbih3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCk7IH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiB1bnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cbiAgICAgICAgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBudWxsO1xuICAgIH1cbiAgICBwb3dlck1vbml0b3Iub2ZmKCdsb2NrLXNjcmVlbicsIGxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBwb3dlck1vbml0b3Iub2ZmKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgaWYgKGxvZ1N0cmVhbVByb2Nlc3MpIHtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgIGxvZ1N0cmVhbVByb2Nlc3MgPSBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlcy9lbmFibGVzIG1pc3Npb24gY29udHJvbCwgc3BhY2VzIGFuZCB0cmFja3BhZCBnZXN0dXJlcy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlIC0gdHJ1ZSByZXN0b3JlcyBldmVyeXRoaW5nLCBmYWxzZSBsb2NrcyBldmVyeXRoaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVNYWNPU0xvY2tkb3duKGVuYWJsZSkge1xuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gIT09ICdkYXJ3aW4nKSByZXR1cm47XG4gICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgdG9nZ2xlTWFjT1NMb2NrZG93bjogJHtlbmFibGUgPyAnZW5hYmxlJyA6ICdkaXNhYmxlJ30gbWlzc2lvbiBjb250cm9sIGxvY2tkb3duYCk7XG5cbiAgICBjb25zdCBtY0lkcyA9IFszMiwgMzMsIDM0LCAzNSwgNzksIDgwLCA4MSwgODIsIDExOCwgMTE5LCAxMjAsIDEyMV07XG4gICAgY29uc3QgcGxpc3RQYXRoID0gam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeSwgJ0xpYnJhcnkvUHJlZmVyZW5jZXMvY29tLmFwcGxlLnN5bWJvbGljaG90a2V5cy5wbGlzdCcpO1xuICAgIGNvbnN0IGJhY2t1cFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci50ZW1wZGlyZWN0b3J5LCAnbmV4dF9leGFtX2hvdGtleXNfYmFja3VwLnBsaXN0Jyk7XG5cbiAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgIGNvbnN0IGhvdGtleUNvbW1hbmRzID0gbWNJZHMubWFwKGlkID0+XG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLnN5bWJvbGljaG90a2V5cyBBcHBsZVN5bWJvbGljSG90S2V5cyAtZGljdC1hZGQgJHtpZH0gXCI8ZGljdD48a2V5PmVuYWJsZWQ8L2tleT48ZmFsc2UvPjwvZGljdD5cImBcbiAgICAgICAgKS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGdlc3R1cmVDb21tYW5kcyA9IFtcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93TWlzc2lvbkNvbnRyb2xHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0FwcEV4cG9zZUdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYFxuICAgICAgICBdLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZnVsbENvbW1hbmQgPSBgXG4gICAgICAgIGlmIFsgISAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIGNwIFwiJHtwbGlzdFBhdGh9XCIgXCIke2JhY2t1cFBhdGh9XCI7IGZpO1xuICAgICAgICAke2hvdGtleUNvbW1hbmRzfTtcbiAgICAgICAgJHtnZXN0dXJlQ29tbWFuZHN9O1xuICAgICAgICBraWxsYWxsIC05IGNmcHJlZnNkO1xuICAgICAgICBzbGVlcCAxO1xuICAgICAgICAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvU3lzdGVtQWRtaW5pc3RyYXRpb24uZnJhbWV3b3JrL1Jlc291cmNlcy9hY3RpdmF0ZVNldHRpbmdzIC11O1xuICAgICAgICBraWxsYWxsIERvY2tcbiAgICAgIGA7XG5cbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoZnVsbENvbW1hbmQsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0xvY2tkb3duIEVuYWJsZSBFcnJvcjonLCBlcnIpO1xuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGdlc3R1cmVDb21tYW5kcyA9IFtcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93TWlzc2lvbkNvbnRyb2xHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0Rlc2t0b3BHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYFxuICAgICAgICBdLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZnVsbENvbW1hbmQgPSBgXG4gICAgICAgIGlmIFsgLWYgXCIke2JhY2t1cFBhdGh9XCIgXTsgdGhlbiBcbiAgICAgICAgICBjcCBcIiR7YmFja3VwUGF0aH1cIiBcIiR7cGxpc3RQYXRofVwiOyBcbiAgICAgICAgICBybSBcIiR7YmFja3VwUGF0aH1cIjsgXG4gICAgICAgIGZpO1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcbiAgICAgICAgbG9nLmluZm8oJ21haW4gQCB0b2dnbGVNYWNPU0xvY2tkb3duOiBFbmFibGUgTWlzc2lvbkNvbnRvbCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRGlzYWJsZSBFcnJvcjonLCBlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuJ3VzZSBzdHJpY3QnXG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnMsIGVuYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnIFxuaW1wb3J0IGFyY2hpdmVyIGZyb20gJ2FyY2hpdmVyJyAgIC8vIGRhcyBtYWNodCBrcmFzc2VzdGUgcmFjZWNvZGl0aW9ucyBtaXQgZWxlY3Ryb24gZWlnZW5lbiB2ZXJzaW9uZW4gLSB1bmJlZGluZ3QgZGllIHNlbGJlIHZlcnNpb24gYmVoYWx0ZW4gd2llIGVsZWN0cm9uXG5pbXBvcnQgZXh0cmFjdCBmcm9tICdleHRyYWN0LXppcCdcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgc2NyZWVuLCBpcGNNYWluLCBhcHAsIEJyb3dzZXJXaW5kb3csIHdlYkNvbnRlbnRzIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL2lwY2hhbmRsZXIuanMnXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgVGVzc2VyYWN0IGZyb20gJ3Rlc3NlcmFjdC5qcyc7XG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgc2NyZWVuc2hvdCBmcm9tICdzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCc7XG5pbXBvcnQgeyBXb3JrZXIgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IHJ1blJlbW90ZUNoZWNrIH0gZnJvbSAnLi9yZW1vdGVDaGVjay5qcydcbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXIuanMnO1xuXG5jb25zdCBzaGVsbCA9IChjbWQpID0+IHsgICByZXR1cm4gZXhlY1N5bmMoY21kLCB7IGVuY29kaW5nOiAndXRmOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KTsgfTsgIC8vIHN0ZGVyciB1bnRlcmRyXHUwMEZDY2t0IFxuY29uc3QgYWdlbnQgPSBuZXcgaHR0cHMuQWdlbnQoeyByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlIH0pO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgXG5cbiAvKipcbiAgKiBIYW5kbGVzIGluZm9ybWF0aW9uIGZldGNoaW5nIGZyb20gdGhlIHNlcnZlciBhbmQgYWN0cyBvbiBzdGF0dXMgdXBkYXRlc1xuICAqL1xuIFxuIGNsYXNzIENvbW1IYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy51cGRhdGVTdHVkZW50SW50ZXJ2YWxsID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSBmYWxzZVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDAgLy8gd2UgY291bnQgZmFpbHMgYW5kIGRlYWN0aXZhdGUgb24gNCBjb25zZXF1ZW50IGZhaWxzXG4gICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSB0cnVlXG4gICAgICAgIHRoaXMudGltZXIgPSAwXG4gICAgICAgIHRoaXMud29ya2VyID0gbnVsbFxuICAgICAgICB0aGlzLnVzZVdvcmtlciA9IHRydWVcbiAgICAgICAgdGhpcy53b3JrZXJGYWlscyA9IDBcbiAgICB9XG4gXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5yZXF1ZXN0VXBkYXRlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5zZW5kU2NyZWVuc2hvdC5iaW5kKHRoaXMpLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgaWYgKCF0aGlzLndvcmtlciAmJiBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgIHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpICB9XG4gICAgfVxuIFxuXG4gICAgLyoqXG4gICAgICogU2V0dXAgdGhlIGltYWdlIHdvcmtlclxuICAgICAqIHVzZXMgZm9yayB0byBjcmVhdGUgYSBuZXcgY2hpbGQgcHJvY2Vzc1xuICAgICAqIHVzZXMgdGhlIGltYWdlV29ya2VyTGludXguanMgb3IgaW1hZ2VXb3JrZXJTaGFycC5qcyBmaWxlXG4gICAgICogdGhlIHdvcmtlciBpcyB1c2VkIHRvIHByb2Nlc3MgdGhlIHNjcmVlbnNob3QgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICovXG4gICAgYXN5bmMgc2V0dXBJbWFnZVdvcmtlcigpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyVVJMID0gcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlclVSTDtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyID0gbmV3IFdvcmtlcih3b3JrZXJVUkwsIHsgdHlwZTogJ21vZHVsZScsIGVudjogeyAuLi5wcm9jZXNzLmVudiB9IH0pO1xuICAgICAgICBsb2cuZGVidWcoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IEltYWdlV29ya2VyIGluaXRpYWxpemVkLiBVc2luZyBcIiArIHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJGaWxlTmFtZSlcbiAgICAgICAgXG5cbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgICAgICAgIGlmIChjb2RlICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXJGYWlscyArPSAxXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMud29ya2VyRmFpbHMgPiA0KXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGZhaWxlZCA1IHRpbWVzIC0gc3dpdGNoaW5nIHRvIG5vIHByb2Nlc3NpbmcnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgdGhpcy5zZXR1cEltYWdlV29ya2VyKCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNjcmVlbnNob3QgXG4gICAgICogaWYgdXNlV29ya2VyIGlzIHRydWUsIHRoZSBzY3JlZW5zaG90IGlzIHByb2Nlc3NlZCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKiBvdGhlcndpc2UgdGhlIHNjcmVlbnNob3QgaXMgbm90IHByb2Nlc3NlZCBhbmQgdGhlIG9yaWdpbmFsIHNjcmVlbnNob3QgaXMgcmV0dXJuZWRcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSB7XG4gICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMud29ya2VyKSB7IC8vdHJpcGxlIGNoZWNrIGlmIHdvcmtlciBpcyBpbml0aWFsaXplZFxuICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV29ya2VyIG5vdCBpbml0aWFsaXplZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2UoeyBpbWdCdWZmZXI6IEFycmF5LmZyb20oaW1nQnVmZmVyKSwgaW1WZXJzaW9uOiBwbGF0Zm9ybURpc3BhdGNoZXIuaW1WZXJzaW9uIH0pO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXIub25jZSgnbWVzc2FnZScsIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcykgdGhyb3cgbmV3IEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGZhbGxiYWNrIHRvIG5vIHByb2Nlc3NpbmcgICBcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbnNob3RCYXNlNjQgPSBCdWZmZXIuZnJvbShpbWdCdWZmZXIpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckJhc2U2NCA9IHNjcmVlbnNob3RCYXNlNjRcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHNjcmVlbnNob3RCYXNlNjQ6IHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NDogaGVhZGVyQmFzZTY0LCBpc2JsYWNrOiBmYWxzZSwgaW1nQnVmZmVyOiBpbWdCdWZmZXIgfTtcblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG4gICAgLyoqIFxuICAgICAqIFVwZGF0ZSBjdXJyZW50IFNlcnZlcnN0YXR1cyArIFN0dWRlbnR0c3RhdHVzIChldmVyeSA1IHNlY29uZHMpXG4gICAgICovXG4gICAgYXN5bmMgcmVxdWVzdFVwZGF0ZSgpe1xuXG4gICAgICAgIHRoaXMudGltZXIrKyAgIC8vIHdlIHVzZSB0aW1lciB0byB0aW1lIGxvb3BzIHdpdGggZGlmZmVyZW50IGludGVydmFscyB3aXRob3V0IGludHJvZHVjaW5nIG5ldyB1bm5lY2Nlc2FyeSBzY2hlZHVsZXJzXG4gICAgICAgIGlmICh0aGlzLnRpbWVyICUgMjAgPT09IDAgKXsgIC8vIHJ1biBldmVyeSAyMCo1ICh1cGRhdGVsb29wKSBzZWNvbmRzXG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXNSZW1vdGVBc3Npc3RhbnQgPSBhd2FpdCBydW5SZW1vdGVDaGVjayhwcm9jZXNzLnBsYXRmb3JtKVxuXG4gICAgICAgICAgICBpZiAodXNlc1JlbW90ZUFzc2lzdGFudCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVhZHk6IFBvc3NpYmxlIHJlbW90ZSBhc3Npc3RhbmNlIGRldGVjdGVkJyk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQua2V5d29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogS2V5d29yZCAke2tleXdvcmR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcG9ydCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LnBvcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IFBvcnQgJHtwb3J0fSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnJlbW90ZWFzc2lzdGFudCA9IHVzZXNSZW1vdGVBc3Npc3RhbnRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhIG5ldyBzY3JlZW4gdGhhdCBuZWVkcyB0byBiZSBibG9ja2VkXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cblxuICAgICAgICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkICBubyBzZXJ2ZXJzaWduYWwgZm9yIDIwIHNlY29uZHNcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXsgIFxuICAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQua2lja2VkKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogQ29ubmVjdGlvbiB0byBUZWFjaGVyIGxvc3QhIFJlbW92aW5nIHJlZ2lzdHJhdGlvbi5cIikgLy9yZW1vdmUgc2VydmVyIHJlZ2lzdHJhdGlvbiBsb2NhbGx5IChzYW1lIGFzICdraWNrJylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpICAgLy8gdGhpcyBhbHNvIHJlc2V0cyBzZXJ2ZXJpcCB0aGVyZWZvcmUgbm8gYXBpIGNhbGxzIGFyZSBtYWRlIGFmdGVyd2FyZHNcbiAgICAgICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgICAgICAgLy8ganVzdCBpbiBjYXNlIHNjcmVlbnMgYXJlIGJsb2NrZWQuLiBsZXQgc3R1ZGVudHMgd29ya1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICBcblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHtjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvfVxuXG4gICAgICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvdXBkYXRlYCwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykgeyB0aHJvdyBuZXcgRXJyb3IoJ05ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgICAgICBpZiAgICAgIChkYXRhLm1lc3NhZ2UgPT09IFwibm90YXZhaWxhYmxlXCIpeyBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBFeGFtIEluc3RhbmNlIG5vdCBmb3VuZCEnKTsgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gNTsgfSAgICAvLyBleGFtIGluc3RhbmNlIG5vdCBhdmFpbGFibGUgYnV0IHNlcnZlciByZWFjaGFibGVcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZGF0YS5tZXNzYWdlID09PSBcInJlbW92ZWRcIil7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBTdHVkZW50IHJlZ2lzdHJhdGlvbiBub3QgZm91bmQhJyk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5raWNrU3R1ZGVudCgpXG4gICAgICAgICAgICAgICAgICAgIH0gICAvLyBzdHVkZW50IGdvdCBraWNrZWQgLSB3ZSBoYW5kbGUgdGhpcyBkaWZmZXJlbnRseSBub3cuIHRlYWNoZXIgc3RvcmVzIFwia2lja2VkXCIgZm9yIHN0dWRlbnQgdG8gY29sbGVjdC4gc3R1ZGVudCBpcyByZW1vdmVkIGZyb20gc2VydmVyIHdoZW4gY29sbGVjdGluZyBraWNrZWQgaW5mby4gc3R1ZGVudCBjbG9zZXMgZXhhbSBhbmQgY2xlYW5zIHVwLlxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0gSGVhcnRiZWF0IGxvc3QuLmApOyAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTt9ICAgLy8gaGVhcnRiZWF0IGxvc3Qgc2VydmVyIG5vdCByZWFjaGFibGVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEuc3RhdHVzID09PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDA7IC8vIERpZXMgelx1MDBFNGhsdCBlYmVuZmFsbHMgYWxzIGVyZm9sZ3JlaWNoZXIgSGVhcnRiZWF0IC0gVmVyYmluZHVuZyBoYWx0ZW5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSBmYWxzZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zZXJ2ZXJzdGF0dXMpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3R1ZGVudFN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnN0dWRlbnRzdGF0dXMpKTsgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyU3RhdHVzRGVlcENvcHksIHN0dWRlbnRTdGF0dXNEZWVwQ29weSk7Ly8gVmVyYXJiZWl0dW5nIGRlciBlbXBmYW5nZW5lbiBEYXRlblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICgke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSkgJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAvLyBwcmV2ZW50IGZvY3VzIHdhcm5pbmcgYmxvY2sgaWYgbm8gY29ubmVjdGlvbiBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlICAvLyBpZiBub3QgY29ubmVjdGVkIGJ1dCBzdGlsbCBpbiBleGFtIG1vZGUgeW91IGNvdWxkIHRyaWdnZXIgYSBmb2N1cyB3YXJuaW5nIGFuZCBub2JvZHkgaXMgYWJsZSB0byB1bmxvY2sgeW91XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgYXN5bmMgc2VuZFNjcmVlbnNob3QoKXtcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApe3JldHVybn0gIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWRcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrOyAvLyBWYXJpYWJsZW4gYXVcdTAwREZlcmhhbGIgZGVzIGlmLUJsb2NrcyBkZWZpbmllcmVuXG4gICAgICAgICAgICBsZXQgaW1nQnVmZmVyID0gbnVsbDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgIFxuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgc2NyZWVuc2hvdCBmcm9tIGRlc2t0b3AgdmlhIHNjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kIChmbGFtZXNob3QsIGltYWdlbWFnaWMsIGV0YylcbiAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdCh7IGZvcm1hdDogJ3BuZycgfSk7XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjaywgaW1nQnVmZmVyIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgIC8vIGtlaW4gaW1hZ2VCdWZmZXIgbWl0Z2VnZWJlbiBiZWRldXRldCBudXR6ZSBzY3JlZW5zaG90LWRlc2t0b3AgaW0gd29ya2VyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWNjZXNzKSB7IHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMDt9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkltYWdlIHByb2Nlc3NpbmcgZmFpbGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgXCJzY3JlZW5zaG90XCIgZnJvbSBhcHB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRGb2N1c2VkTWluZG93ID0gV2luZG93SGFuZGxlci5nZXRDdXJyZW50Rm9jdXNlZFdpbmRvdygpICAvL3JldHVybnMgZXhhbSB3aW5kb3cgaWYgbm90aGluZyBpbiBmb2N1cyBvciBtYWluIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudEZvY3VzZWRNaW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjdXJyZW50Rm9jdXNlZE1pbmRvdy53ZWJDb250ZW50cy5jYXB0dXJlUGFnZSgpICAvLyB0aGlzIHNob3VsZCBhbHdheXMgd29yayBiZWNhdXNlIGl0J3Mgb25ib2FyZCBlbGVjdHJvblxuICAgICAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gcmVzdWx0LnRvUE5HKClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2sgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAvLyBhdHRlbnRpb24gcHJvY2Vzc0ltYWdlICBjb252ZXJ0cyBidWZmZXIgdG8gdWludDhhcnJheVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgKz0xO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogcHJvY2Vzc0ltYWdlIGZhaWxlZDogJHtlcnJ9YClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1BQ09TIFdPUktBUk9VTkQgLSBzd2l0Y2ggdG8gcGFnZWNhcHR1cmUgaWYgbm8gcGVybWlzc29ucyBhcmUgZ3JhbnRlZFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiAmJiB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ICYmIGltZ0J1ZmZlciAhPT0gbnVsbCl7ICAvL3RoaXMgaXMgZm9yIG1hY09TIGJlY2F1c2UgaXQgZGVsaXZlcnMgYSBibGFuayBiYWNrZ3JvdW5kIHNjcmVlbnNob3Qgd2l0aG91dCBwZXJtaXNzaW9ucy4gd2UgY2F0Y2ggdGhhdCBjYXNlIHdpdGggYSB3b3JrYXJvdW5kXG4gICAgICAgICAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IGZhbHNlICAgLy9uZXZlciBkbyB0aGlzIGFnYWluXG4gICAgICAgICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IGFwcC5pc1BhY2thZ2VkID8gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJykgOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGRhdGE6IHsgdGV4dCB9IH0gICA9IGF3YWl0IFRlc3NlcmFjdC5yZWNvZ25pemUoaW1nQnVmZmVyICwgJ2VuZycseyBsYW5nUGF0aDogcHVibGljUGF0aCB9ICk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBhcHBXaW5kb3dWaXNpYmxlID0gdGV4dC5pbmNsdWRlcyhcIkV4YW1cIikgICAvL2NoZWNrIGlmIHRoZSB3b3JkIFwiRXhhbVwiIGNhbiBiZSBmb3VuZCBpbiBzY3JlZW5zaG90IC0gb3RoZXJ3aXNlIGl0IGlzIG1vc3QgbGlrZWx5IGEgYmxhbmsgZGVza3RvcCAtIG1hY29zIHF1aXJrXG4gICAgICAgICAgICAgICAgICAgIGlmICghYXBwV2luZG93VmlzaWJsZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogUGxlYXNlIGNoZWNrIHlvdXIgc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAtIFN3aXRjaGluZyB0byBQYWdlQ2FwdHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IE1hY09TIHNjcmVlbnNob3RwZXJtaXNzaW9ucyBjaGVjayBPS1wiKTt9XG4gICAgICAgICAgICAgICAgfWNhdGNoKGVycil7ICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogJHtlcnJ9YCk7IH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvLyBpZiBzb21ldGhpbmcgd2VudCB3cm9uZyB3ZSBkbyBub3QgaGF2ZSBhIHNjcmVlbnNob3QgLSBzbyBkbyBub3QgdXBkYXRlIHRoZSBzZXJ2ZXJcbiAgICAgICAgICAgIGlmICghc2NyZWVuc2hvdEJhc2U2NCl7XG4gICAgICAgICAgICAgICAgaWYodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTY3JlZW5zaG90IGVycm9yIC0+IFN3aXRjaGluZyB0byBQYWdlQ2FwdHVyZWApIH0gXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogUGFnZUNhcHR1cmUgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIE5vLVByb2Nlc3NpbmdgKSB9ICAgXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5zY3JlZW5zaG90RmFpbHMgPiA0ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IG5vIHNjcmVlbnNob3QgYXZhaWxhYmxlIC0gcGxlYXNlIGZpeCB5b3VyIHNldHVwYCkgfVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG5cblxuXG4gICAgICAgICAgICAvL2RvIG5vdCBydW4gY29sb3JjaGVjayBpZiBhbHJlYWR5IGxvY2tlZFxuICAgICAgICAgICAgaWYgKCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlICYmICF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzKXtcbiAgICAgICAgICAgICAgICBpZiAoaXNibGFjayl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFN0dWRlbnQgU2NyZWVuc2hvdCBkb2VzIG5vdCBmaXQgcmVxdWlyZW1lbnRzIChhbGxibGFjaylcIik7XG4gICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGxldCBzY3JlZW5zaG90aGFzaCA9IG51bGxcbiAgICAgICAgICAgIHRyeSB7IHNjcmVlbnNob3RoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShCdWZmZXIuZnJvbShzY3JlZW5zaG90QmFzZTY0LCAnYmFzZTY0JykpLmRpZ2VzdChcImhleFwiKTsgIH0gIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgY2F0Y2goZXJyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBjcmVhdGluZyBoYXNoIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdDogc2NyZWVuc2hvdEJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aGFzaDogc2NyZWVuc2hvdGhhc2gsXG4gICAgICAgICAgICAgICAgaGVhZGVyOiBoZWFkZXJCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGZpbGVuYW1lOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuICsgXCIuanBnXCIsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gc2VuZCBzY3JlZW5zaG90IHRvIHNlcnZlciB2aWEgZW1haWwgZmV0Y2ggcmVxdWVzdFxuICAgICAgICAgICAgbGV0IGF0dGVtcHQgPSAwO1xuICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDI7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvdXBkYXRlc2NyZWVuc2hvdGA7XG4gICAgICAgICAgICB0aGlzLmRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0LCBtYXhSZXRyaWVzKTsgLy8gRXJzdGUgQW5mcmFnZSBzdGFydGVuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuICAgIGRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0ID0gMCwgbWF4UmV0cmllcykge1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICBhZ2VudCxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGU6IE5ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGU6IFN0YXR1cyBFcnJvcjpcIiwgZGF0YS5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgIGlmIChhdHRlbXB0IDwgbWF4UmV0cmllcyAtIDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRvU2NyZWVuc2hvdFVwZGF0ZSh1cmwsIHBheWxvYWQsIGFnZW50LCBhdHRlbXB0ICsgMSwgbWF4UmV0cmllcyk7IC8vIFJldHJ5XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGF0dGVtcHQgPT09IG1heFJldHJpZXMgLSAxICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZSAoZmV0Y2gpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG4gICAgYXN5bmMga2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cyl7XG4gICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWNrU3R1ZGVudDogU3R1ZGVudCBnb3Qga2lja2VkIGJ5IFRlYWNoZXJcIilcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQua2lja2VkID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7ZGVsZm9sZGVyb25leGl0OiBmYWxzZX0gIC8vIGRvIG5vdCBkZWxldGUgZm9sZGVyIG9uIGV4aXQgYmVjYXVzZSBzdHVkZW50IGdvdCBraWNrZWRcbiAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMgJiYgc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIpeyBzZXJ2ZXJzdGF0dXMuZGVsZm9sZGVyb25leGl0ID0gdHJ1ZX1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgXG4gICAgICAgIHJldHVybiAgIC8vdGhpcyBlbmRzIGhlcmUgYmVjYXVzZSB3ZSBnb3Qga2lja2VkIGJ5IHRoZSB0ZWFjaGVyXG4gICAgfVxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiByZWFjdCB0byBzZXJ2ZXIgc3RhdHVzIFxuICAgICAqIHRoaXMgY3VycmVudGx5IG9ubHkgaGFuZGxlIHN0YXJ0ZXhhbSAmIGVuZGV4YW1cbiAgICAgKiBjb3VsZCBhbHNvIGhhbmRsZSBraWNrLCBmb2N1c3Jlc3RvcmUsIGFuZCBldmVuIHRyaWdnZXIgZmlsZSByZXF1ZXN0c1xuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlcnN0YXR1cywgc3R1ZGVudHN0YXR1cyl7XG4gICAgICAgXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gaW5kaXZpZHVhbCBzdGF0dXMgdXBkYXRlc1xuXG4gICAgICAgIGlmICggc3R1ZGVudHN0YXR1cyAmJiBPYmplY3Qua2V5cyhzdHVkZW50c3RhdHVzKS5sZW5ndGggIT09IDApIHsgIC8vIHdlIGhhdmUgc3RhdHVzIHVwZGF0ZXMgKHRhc2tzKSAtIGRvIGl0IVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMucHJpbnRkZW5pZWQpIHtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZGVuaWVkJykgICAvL3RyaWdnZXIsIHdoeVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5raWNrZWQpIHsgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCBieSB0ZWFjaGVyXG4gICAgICAgICAgICAgICAgdGhpcy5raWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKVxuICAgICAgICAgICAgICAgIHJldHVybiAgIC8vdGhpcyBlbmRzIGhlcmUgYmVjYXVzZSB3ZSBnb3Qga2lja2VkIGJ5IHRoZSB0ZWFjaGVyXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmRlbGZvbGRlciA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjbGVhbmluZyBleGFtIHdvcmtmb2xkZXJcIilcbiAgICAgICAgICAgICAgICBsZXQgZGVsZm9sZGVyID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgXG4gICAgICAgICAgICAgICAgICAgIGRlbGZvbGRlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnJvcikgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENhbiBub3QgZGVsZXRlIGRpcmVjdG9yeSAtICR7ZXJyb3J9IGApXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGRlbGZvbGRlciA9PSBmYWxzZSl7ICAvL3RyeSBkZWxldGluZyBmaWxlIGJ5IGZpbGUgKHRoZSBvbmUgdGhhdCBjYXVzZXMgdGhlIHByb2JsZW0gd2lsbCBzdGF5IGluIHRoZSBmb2xkZXIpXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHsgZnMucm1TeW5jKGZpbGVQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfSAgLy8gVmVyc3VjaGUsIGRhcyBWZXJ6ZWljaG5pcyByZWt1cnNpdiB6dSBsXHUwMEY2c2NoZW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGZzLnVubGlua1N5bmMoZmlsZVBhdGgpOyAgfS8vIFZlcnN1Y2hlLCBkaWUgRGF0ZWkgenUgbFx1MDBGNnNjaGVuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiAoZGVsZm9sZGVyKSBGZWhsZXIgYmVpbSBMXHUwMEY2c2NoZW4gZGVyIERhdGVpL1ZlcnplaWNobmlzOiAke2ZpbGVQYXRofWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmZvY3VzID09IGZhbHNlKXtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMucmVzdG9yZWZvY3Vzc3RhdGUgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogcmVzdG9yaW5nIGZvY3VzIHN0YXRlIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmICF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IHRydWUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPT0gZmFsc2UgICl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBhY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gdHJ1ZSAgLy9jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrIHdpbGwgYmUgcHV0IG9uIHRoaXMucHJpdmF0ZVNwZWxsY2hlY2sgaW4gZWRpdG9yIHVwZGF0ZWQgdmlhIGZldGNoSW5mbygpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgaXBjTWFpbi5lbWl0KFwic3RhcnRMYW5ndWFnZVRvb2xcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gZmFsc2UgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPT0gdHJ1ZSApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGRlLWFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gZmFsc2UgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suc3VnZ2VzdGlvbnMgPSBzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVN1Z2dlc3Rpb25zXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnNlbmRleGFtID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbmRFeGFtVG9UZWFjaGVyKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmZldGNoZmlsZXMgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEZpbGVGcm9tU2VydmVyKHN0dWRlbnRzdGF0dXMuZmlsZXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5nZXRtYXRlcmlhbHMgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdnZXRtYXRlcmlhbHMnKSAgLy8gaWYgd2UgY2hhbmdlIGdyb3VwIHdlIG5lZWQgdG8gZ2V0IHRoZSBtYXRlcmlhbHMgYWdhaW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgYW4gbWljcm9zb2Z0MzY1IHRoaW5nLiBjaGVjayBpZiBleGFtIG1vZGUgaXMgb2ZmaWNlLCBjaGVjayBpZiB0aGlzIGlzIHNldCAtIG90aGVyd2lzZSBkbyBub3QgZW50ZXIgZXhhbW1vZGUgLSBpdCB3aWxsIGZhaWxcbiAgICAgICAgICAgIC8vc2V0IG9yIHVwZGF0ZSBzaGFyaW5nIGxpbmsgLSBpdCB3aWxsIGJlIHVzZWQgaW4gXCJtaWNyb3NvZnQzNjVcIiBleGFtIG1vZGVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IHN0dWRlbnRzdGF0dXMubXNvZmZpY2VzaGFyZSAgXG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgIC8vc2V0IG9yIHVwZGF0ZSBncm91cCBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCAhPT0gc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgPSBzdHVkZW50c3RhdHVzLmdyb3VwICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdnZXRtYXRlcmlhbHMnKSAgLy8gaWYgd2UgY2hhbmdlIGdyb3VwIHdlIG5lZWQgdG8gZ2V0IHRoZSBtYXRlcmlhbHMgYWdhaW5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICBcblxuICAgICAgICB9XG5cblxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBnbG9iYWwgc3RhdHVzIHVwZGF0ZXNcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAgICAgICBcbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqIFNXSVRDSCBFWEFNIFNFQ1RJT04gIFNUQVJUXG4gICAgICAgICAqIEFUVEVOVElPTjogbW92ZSB0aGlzIHRvIGEgc2VwYXJhdGUgZnVuY3Rpb24gLSBpdCBpcyB0b28gY29tcGxleCBhbmQgc2hvdWxkIGJlIHNwbGl0IHVwXG4gICAgICAgICAqIGluIHRoZSBmdXR1cmUgd2Ugd2VsbCBkZXRlcm1pbmUgaWYgc2VjdGlvbiBzd2l0Y2ggaXMgaGFuZGxlZCBieSB0aGUgdGVhY2hlciBvciBieSB0aGUgc3R1ZGVudCBhbmQgYWN0IGFjY29yZGluZ2x5XG4gICAgICAgICAqIGlmIGhhbmRsZWQgYnkgc3R1ZGVudCB0aGUgdGVhY2hlciBzdHR0dXMgaXMgaWdub3JlZCBhbmQgdGhlIHN3aWNoIHNlY3Rpb24gZnVuY3Rpb24gaXMgY2FsbGVkIGRpcmVjdGx5IChwcm9iYWJseSBtb3ZlIHRvIGlwY2hhbmRsZXIuanMpXG4gICAgICAgICAqL1xuXG4gICAgICAgIC8vIGlmIHN0dWRlbnQgaXMgaW4gbG9ja2VkIHN0YXRlIGluIGV4YW0gbW9kZVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICBcblxuICAgICAgICAgICAgLy9jaGVjayBpZiB0aGUgY3VycmVudCBhY3RpdmUgc2VjdGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgb25lIGluIHRoZSBzZXJ2ZXJzdGF0dXMgLSBpZiBub3QgY2hhbmdlIHRvIHRoZSBuZXcgc2VjdGlvblxuICAgICAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uICE9PSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24pe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjaGFuZ2luZyBzZWN0aW9uIHRvICR7c2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb259ICR7c2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWV9ICwgRXhhbXR5cGU6ICR7c2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGV9YCApXG5cbiAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudExvY2tlZFNlY3Rpb24gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb247IC8vIEN1cnJlbnQgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3Igc2F2aW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0xvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbjsgLy8gTmV3IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIGxvYWRpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbURpciA9IHRoaXMuY29uZmlnLmV4YW1kaXJlY3Rvcnk7XG5cblxuICAgICAgICAgICAgICAgIC8vc2F2ZSBhbGwgZmlsZXMgZnJvbSB0aGUgb2xkIHNlY3Rpb24gKGlmIGV4YW0gbW9kZSBpcyBcImVkaXRvclwiKSBhbmQgc2VuZCB0byB0ZWFjaGVyIC0gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKClcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9PT0gXCJlZGl0b3JcIil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogc2VuZGluZyBleGFtIHRvIHRlYWNoZXIgKGZpbmFsIHN1Ym1pdClcIilcblxuICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIGN1cnJlbnQgd29yayBhcyBiYXNlNjQgdG8gdGVhY2hlciAoc3RvcmVzIHBkZiBpbiBBQkdBQkUgZm9sZGVyIHdpdGggc3VibWlzc2lvbiBudW1iZXIpXG4gICAgICAgICAgICAgICAgICAgIGxldCBwZGYgPSBhd2FpdCB0aGlzLmdldEJhc2U2NFBERih0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsIHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbY3VycmVudExvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lKSAgLy8gbG9jYWwgZnVuY3Rpb24gdG8gZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBkZi5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VuZEJhc2U2NFBERnRvVGVhY2hlcihwZGYuYmFzZTY0cGRmLCBjdXJyZW50TG9ja2VkU2VjdGlvbilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAvL2JhY2t1cCBsb2NhbCBmaWxlcyBhbmQgc2VuZCB0byB0ZWFjaGVyIChhcmNoaXZlIHdpdGggdGltZXN0YW1wKVxuXG5cbiAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIC8vd2FpdCAxIHNlY29uZCBhbmQgY2xlYW51cCBORVhULUVYQU0tU1RVREVOVC1XT1JLRElSXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDAwKVxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGV4YW10eXBlIGluIGNsaWVudGluZm9cbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIGxvY2tlZCBzZWN0aW9uIEFGVEVSIHNhdmluZyB0aGUgb2xkIHN0YXRlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uID0gbmV3TG9ja2VkU2VjdGlvbjtcblxuXG5cbiAgICAgICAgICAgICAgICAvLyBNT1ZFIFNlY3Rpb24gRmlsZXMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDE6IFNBVkUgQ1VSUkVOVCBFWEFNRElSIEZJTEVTIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZXhhbURpcikgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPT0gdW5kZWZpbmVkKSB7IC8vIENoZWNrIGlmIG1haW4gZGlyIGV4aXN0cyBhbmQgYSBzZWN0aW9uIGlzIGN1cnJlbnRseSBhY3RpdmVcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZpbmcgY29udGVudCBmcm9tIGV4YW1EaXIgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2F2ZVBhdGggPSBgJHtleGFtRGlyfS8ke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2F2ZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHNhdmVQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgLy8gQ3JlYXRlIHNhdmUgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmMoZXhhbURpcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlcy5sZW5ndGh9IGl0ZW1zIGluIGV4YW1EaXIgdG8gc2F2ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNTYXZlZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKG9sZFBhdGgpOyAvLyBHZXQgZmlsZSBzdGF0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBhY3R1YWwgRklMRVMsIG5vdCBkaXJlY3RvcmllcyAobGlrZSB0aGUgc2VjdGlvbiBmb2xkZXJzIHRoZW1zZWx2ZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IGAke3NhdmVQYXRofS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpOyAvLyBDb3B5IGZpbGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMudW5saW5rU3luYyhvbGRQYXRoKTsgLy8gRGVsZXRlIG9yaWdpbmFsIGZpbGUgZnJvbSBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzU2F2ZWQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmVkIGZpbGUgJHtmaWxlfSB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIChmb2xkZXIpIGl0ZW0gJHtmaWxlfSBpbiBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBzYXZlZCAke2ZpbGVzU2F2ZWR9IGZpbGVzIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBzYXZlIC0gZXhhbURpciBleGlzdHM6ICR7ZnMuZXhpc3RzU3luYyhleGFtRGlyKX0sIGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMjogTE9BRCBGSUxFUyBmcm9tIHRoZSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIE5FVyBsb2NrZWQgc2VjdGlvbiB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgbmV3TG9ja2VkU2VjdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IExvYWRpbmcgY29udGVudCBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2FkUGF0aCA9IGAke2V4YW1EaXJ9LyR7bmV3TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9hZFBhdGgpKSB7IC8vIENoZWNrIGlmIHRoZSBuZXcgc2VjdGlvbiBmb2xkZXIgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXNUb0xvYWQgPSBmcy5yZWFkZGlyU3luYyhsb2FkUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXNUb0xvYWQubGVuZ3RofSBpdGVtcyBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzQ29waWVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXNUb0xvYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc291cmNlUGF0aCA9IGAke2xvYWRQYXRofS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVzdFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQuaXNGaWxlKCkpIHsgLy8gRW5zdXJlIG9ubHkgZmlsZXMgYXJlIGNvcGllZCBiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMoc291cmNlUGF0aCwgZGVzdFBhdGgpOyAvLyBDb3B5IGZpbGUgdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNDb3BpZWQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDb3BpZWQgZmlsZSAke2ZpbGV9IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSBpdGVtICR7ZmlsZX0gaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgY29waWVkICR7ZmlsZXNDb3BpZWR9IGZpbGVzIGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBOZXcgbG9ja2VkIHNlY3Rpb24gZGlyZWN0b3J5ICR7bmV3TG9ja2VkU2VjdGlvbn0gZG9lcyBub3QgZXhpc3QuIFN0YXJ0aW5nIHdpdGggYSBjbGVhbiBzdGF0ZS5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBuZXdMb2NrZWRTZWN0aW9uIGlzIGZhbHN5ICgke25ld0xvY2tlZFNlY3Rpb259KSwgc2tpcHBpbmcgZmlsZSBsb2FkYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIGR1cmluZyBmb2xkZXIgb3BlcmF0aW9uIC0gJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBzdGFjazogJHtlcnJvci5zdGFja31gKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn0sIG5ld0xvY2tlZFNlY3Rpb246ICR7bmV3TG9ja2VkU2VjdGlvbn0sIGV4YW1EaXI6ICR7ZXhhbURpcn1gKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgKiAgQWN0dWFsbHkgU1dJVENIIEVYQU0gU0VDVElPTlxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgb3IgcmVsZWFkIHRoZSBuZXcgZXhhbSBzZWN0aW9uIGluIHRoZSBzYW1lIHdpbmRvd1xuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpe1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGRldnRvb2xzIHdpbmRvdyAtIGlmIHlvdSBkb24ndCBuZXh0LWV4YW0gd2lsbCBjcmFzaCBzaWxlbnRseSBvbiByZWxvYWQgYW5kIHNlY3Rpb24gc3dpdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdlYkNvbnRlbnRzLmdldEFsbFdlYkNvbnRlbnRzKCkuZm9yRWFjaCh3YyA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh3Yy5ob3N0V2ViQ29udGVudHM/LmlkID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuaWQgJiYgd2MuaXNEZXZUb29sc09wZW5lZD8uKCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN3aXRjaEV4YW1TZWN0aW9uOiBkZXN0cm95aW5nIGRldnRvb2xzIHdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBhbmQgcmVvcGVuIGl0IHdpdGggdGhlIG5ldyBleGFtIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5vbmNlKCdjbG9zZWQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5kZXN0cm95KCk7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNXSVRDSCBFWEFNIFNFQ1RJT04gIEVORFxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgXG5cblxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jaykgeyAgdGhpcy5hY3RpdmF0ZVNjcmVlbmxvY2soKSB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCApIHsgdGhpcy5raWxsU2NyZWVubG9jaygpIH1cblxuICAgICAgICAvLyBzY3JlZW5zaG90IHNhZmV0eSAoT0NSIHNlYXJjaGVzIGZvciBuZXh0LWV4YW0gc3RyaW5nKVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNob3RvY3IpIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90b2NyID0gdHJ1ZSAgfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90b2NyID0gZmFsc2UgICB9XG5cbiAgICAgICAgLy8gR3JvdXBzIGhhbmRsaW5nXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5ncm91cHMpeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwcyA9IHRydWV9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwcyA9IGZhbHNlfVxuXG4gICAgICAgIC8vdXBkYXRlIHNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCB8fCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09PSAwKSB7IC8vMCBpcyB0aGUgc2FtZSBhcyBmYWxzZSBvciB1bmRlZmluZWQgYnV0IHNob3VsZCBiZSB0cmVhdGVkIGFzIG51bWJlclxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgIT09IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMCApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBjaGFuZ2VkIHRvXCIsIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA9IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMFxuICAgICAgICAgICAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgZGlzYWJsZWQhXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNsZWFyIG9sZCBpbnRlcnZhbCBhbmQgc3RhcnQgbmV3IGludGVydmFsIGlmIHNldCB0byBzb21ldGhpbmcgYmlnZ2VyIHRoYW4gemVyb1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdG9wKClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPiAwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLmludGVydmFsID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIC8vIHJlbW92ZSBsb2Nrc2NyZWVuIGltbWVkaWF0ZWx5IC0gZG9uJ3Qgd2FpdCBmb3Igc2VydmVyIGluZm9cbiAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIFxuICAgICAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gc2VuZCBiYXNlNjQgcGRmIHRvIHRlYWNoZXJcbiAgICBzZW5kQmFzZTY0UERGdG9UZWFjaGVyKGJhc2U2NHBkZiwgc2VjdGlvbj0xKXtcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3ByaW50cmVxdWVzdC8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufWA7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICBkb2N1bWVudDogYmFzZTY0cGRmLFxuICAgICAgICAgICAgcHJpbnRyZXF1ZXN0OiBmYWxzZSwgICAgXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsXG4gICAgICAgICAgICBsb2NrZWRzZWN0aW9uOiBzZWN0aW9uXG4gICAgICAgIH1cbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4geyByZXR1cm4gcmVzcG9uc2UuanNvbigpOyAgfSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tZXNzYWdlID09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIrKyAgIC8vIHN1Y2Nlc3NmdWwgc3VibWlzc2lvbiAtPiBpbmNyZW1lbnQgbnVtYmVyXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7ICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZWRpdG9yIEAgcHJpbnRiYXNlNjQ6XCIsZXJyb3IubWVzc2FnZSkgICAgXG4gICAgICAgIH0pOyBcbiAgICB9XG4gICAgXG5cblxuXG4gICAgLy9nZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgIC8vIEFUVEVOVElPTjogdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBpcGNoYW5kbGVyLmpzIHRoYXQgYWxzbyBnZW5lcmF0ZXMgYSBwZGYgYnV0IHN0b3JlcyBpdCBhcyBmaWxlIGluIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgIGFzeW5jIGdldEJhc2U2NFBERihzdWJtaXNzaW9ubnVtYmVyLCBzZWN0aW9ubmFtZSwgcHJpbnRCYWNrZ3JvdW5kPWZhbHNlKXtcbiAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgZm9yIGFueSBvbmdvaW5nIHByaW50IG9wZXJhdGlvbiB0byBmaW5pc2ggKG1heCAzMCBzZWNvbmRzKVxuICAgICAgICBsZXQgd2FpdENvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbWF4V2FpdCA9IDMwMDsgLy8gMzAgc2Vjb25kcyB3aXRoIDEwMG1zIGludGVydmFsc1xuICAgICAgICB3aGlsZSAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmICYmIHdhaXRDb3VudCA8IG1heFdhaXQpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKTtcbiAgICAgICAgICAgIHdhaXRDb3VudCsrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogcHJpbnRUb1BERiBsb2NrIHRpbWVvdXQgLSBhbm90aGVyIHByaW50IG9wZXJhdGlvbiBpcyBzdGlsbCBydW5uaW5nXCIpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIlBERiBnZW5lcmF0aW9uIHRpbWVvdXQgLSBhbm90aGVyIHByaW50IG9wZXJhdGlvbiBpcyBpbiBwcm9ncmVzc1wiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIG1hcmdpbnM6IHt0b3A6MC41LCByaWdodDowLCBib3R0b206MC41LCBsZWZ0OjAgfSxcbiAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBwcmludEJhY2tncm91bmQsXG4gICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgbGFuZHNjYXBlOiBmYWxzZSxcbiAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJGb290ZXI6dHJ1ZSxcblxuICBcbiAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHtzZWN0aW9ubmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwO0FiZ2FiZTogJHtzdWJtaXNzaW9ubnVtYmVyfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIHNldCB0aGUgdGl0bGUgb2YgdGhlIGV4YW0gd2luZG93IGFuZCB0aGVyZWZvcmUgdGhlIGRvY3VtZW50IHRpdGxlXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfSAtICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfSAtIFZlcnNpb24gJHtzdWJtaXNzaW9ubnVtYmVyfVwiYCk7XG4gICAgICAgIFxuICAgICAgICAvLyBTZXQgbG9jayBiZWZvcmUgc3RhcnRpbmcgUERGIGdlbmVyYXRpb25cbiAgICAgICAgSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBiYXNlNjRwZGYgPSBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFVcmwgPSBgZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LCR7YmFzZTY0cGRmfWA7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJQREYgZ2VuZXJhdGVkXCIsIGRhdGFVcmw6ZGF0YVVybCwgYmFzZTY0cGRmOiBiYXNlNjRwZGYsIHN0YXR1czogXCJzdWNjZXNzXCIgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBFcnJvciBnZW5lcmF0aW5nIFBERjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVycm9yIGdlbmVyYXRpbmcgUERGXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAvLyBBbHdheXMgcmVsZWFzZSB0aGUgbG9jaywgZXZlbiBpZiBhbiBlcnJvciBvY2N1cnJlZFxuICAgICAgICAgICAgSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzaG93IHRlbXBvcmFyeSBzY3JlZW5sb2NrIHdpbmRvd1xuICAgIGFjdGl2YXRlU2NyZWVubG9jaygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG4gICAgICAgXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmxlbmd0aCA9PSAwKXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSB0cnVlXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkgIC8vIGFkZCBzY3JlZW5sb2NrIHdpbmRvd3MgZm9yIGFkZGl0aW9uYWwgZGlzcGxheXNcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgdGVtcG9yYXJ5IHNjcmVlbmxvY2t3aW5kb3dcbiAgICBraWxsU2NyZWVubG9jaygpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVubG9ja3dpbmRvdyAmJiAhc2NyZWVubG9ja3dpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuY2xvc2UoKTsgXG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpbGxTY3JlZW5sb2NrOiBubyBmdW5jdGlvbmFsIHNjcmVlbmxvY2t3aW5kb3cgdG8gaGFuZGxlXCIpXG4gICAgICAgIH0gXG4gICAgICAgIC8vIENsZWFyIGFycmF5IGNvbXBsZXRlbHkgYWZ0ZXIgYXR0ZW1wdGluZyB0byBkZXN0cm95IGFsbCB3aW5kb3dzXG4gICAgICAgIC8vIFRoZSBjbG9zZWQgZXZlbnQgaGFuZGxlciB3aWxsIGFsc28gY2xlYW4gdXAsIGJ1dCB0aGlzIGVuc3VyZXMgdGhlIGFycmF5IGlzIGVtcHR5XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSBmYWxzZVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIGV4YW0gbW9kZSBmb3Igc3R1ZGVudFxuICAgICAqIGRlbGV0ZXMgd29ya2ZvbGRlciBjb250ZW50cyAoaWYgc2V0KVxuICAgICAqIG9wZW5zIGEgbmV3IHdpbmRvdyBpbiBraW9zayBtb2RlIHdpdGggdGhlIGdpdmVuIGV4YW10eXBlXG4gICAgICogZW5hYmxlcyB0aGUgYmx1ciBsaXN0ZW5lciBhbmQgYWN0aXZhdGVzIHJlc3RyaWN0aW9ucyAoZGlzYWJsZSBrZXlib2Fyc2hvcnRjdXRzIGV0Yy4pXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyBjb250YWlucyBpbmZvcm1hdGlvbiBhYm91dCBleGFtbW9kZSwgZXhhbXR5cGUsIGFuZCBvdGhlciBzZXR0aW5ncyBmcm9tIHRoZSB0ZWFjaGVyIGluc3RhbmNlXG4gICAgICovXG4gICAgYXN5bmMgc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBkaWFsb2cgaXMgb3BlbiBhbmQgbG9nIHdhcm5pbmdcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhpdFdhcm5pbmdPcGVuIHx8IFdpbmRvd0hhbmRsZXIuZXhpdFF1ZXN0aW9uT3BlbiB8fCBXaW5kb3dIYW5kbGVyLm1pbmltaXplV2FybmluZ09wZW4pIHtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IERpYWxvZyBpcyBzdGlsbCBvcGVuIC0gZXhhbSB3aWxsIHN0YXJ0IGFueXdheVwiKVxuICAgICAgICB9XG4gIFxuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG5cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5jbWFyZ2luID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uY21hcmdpbiAgLy8gdGhpcyBpcyB1c2VkIHRvIGNvbmZpZ3VyZSBtYXJnaW4gc2V0dGluZ3MgZm9yIHRoZSBlZGl0b3JcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5saW5lc3BhY2luZyA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmxpbmVzcGFjaW5nIC8vIHdlIHRyeSB0byBkb3VibGUgbGluZXNwYWNpbmcgb24gZGVtYW5kIGluIHBkZiBjcmVhdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmF1ZGlvUmVwZWF0ID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uYXVkaW9SZXBlYXQgLy8gcmVzdHJpY3QgcmVwZXRpdGlvbiBvZiBhdWRpbyBmaWxlcyAoZm9yIGxpc3RlbmluZyBjb21wcmVoZW5zaW9uKVxuXG4gICAgICAgIGlmICghV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBjcmVhdGluZyBleGFtIHdpbmRvd1wiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZUV4YW1XaW5kb3coc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUsIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vcmVjb25uZWN0IGludG8gYWN0aXZlIGV4YW0gc2Vzc2lvbiB3aXRoIGV4YW0gd2luZG93IGFscmVhZHkgb3BlblxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGZvdW5kIGV4aXN0aW5nIEV4YW13aW5kb3cuLlwiKVxuICAgICAgICAgICAgdHJ5IHsgIC8vIHN3aXRjaCBleGlzdGluZyB3aW5kb3cgYmFjayB0byBleGFtIG1vZGVcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpIFxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRGdWxsU2NyZWVuKHRydWUpICAvL2dvIGZ1bGxzY3JlZW4gYWdhaW5cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpICAvL21ha2Ugc3VyZSB0aGUgd2luZG93IGlzIDEgbGV2ZWwgYWJvdmUgZXZlcnl0aGluZ1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVSZXN0cmljdGlvbnMoV2luZG93SGFuZGxlcilcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDAwKSAvLyB3YWl0IGFuIGFkZGl0aW9uYWwgMiBzZWMgZm9yIHdpbmRvd3MgcmVzdHJpY3Rpb25zIHRvIGtpY2sgaW4gKHRoZXkgc3RlYWwgZm9jdXMpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuYWRkQmx1ckxpc3RlbmVyKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZvciByZWNvbm5lY3Q6IGluaXRpYWxpemUgYmxvY2sgd2luZG93cyBhZnRlciB3aW5kb3cgaXMgcmVwb3NpdGlvbmVkXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHsgLy9leGFtd2luZG93IHZhcmlhYmxlIGlzIHN0aWxsIHNldCBidXQgdGhlIHdpbmRvdyBpcyBub3QgbWFuYWdhYmxlIGFueW1vcmUgKG1hbnVhbGx5IGNsb3NlZCBpbiBkZXYgbW9kZT8pXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IG5vIGZ1bmN0aW9uYWwgZXhhbXdpbmRvdyBmb3VuZC4uIHJlc2V0dGluZ1wiKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoV2luZG93SGFuZGxlci5leGFtd2luZG93KSAgLy9leGFtd2luZG93IGlzIGdpdmVuIGJ1dCBub3QgdXNlZCBpbiBkaXNhYmxlUmVzdHJpY3Rpb25zXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiAgLy8gaW4gdGhhdCBjYXNlLi4gd2UgYXJlIGZpbmlzaGVkIGhlcmUgIVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vdGU6IEZvciBuZXcgZXhhbSB3aW5kb3dzLCBpbml0QmxvY2tXaW5kb3dzKCkgaXMgY2FsbGVkIGluIGRpZC1maW5pc2gtbG9hZCBoYW5kbGVyXG4gICAgICAgIC8vIHRvIGVuc3VyZSB3aW5kb3cgaXMgZnVsbHkgcG9zaXRpb25lZCAoaW1wb3J0YW50IGZvciBXYXlsYW5kL0tXaW4pXG4gICAgfVxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyBFeGFtIG1vZGVcbiAgICAgKiBjbG9zZXMgZXhhbSB3aW5kb3dcbiAgICAgKiBkaXNhYmxlcyByZXN0cmljdGlvbnMgYW5kIGJsdXIgXG4gICAgICovXG4gICAgYXN5bmMgZW5kRXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICBcbiAgICAgICAgV2luZG93SGFuZGxlci5yZW1vdmVCbHVyTGlzdGVuZXIoKTtcbiAgICAgIFxuICAgICAgICAvL29ubHkgZGlzYWJsZSByZXN0cmljdGlvbnMgaWYgbm90IGluIGV4YW0gbW9kZSAoIHNlcmlvc3VseS4uIGhvdyBjb3VsZCB0aGlzIGV2ZXIgaGFwcGVuPyApXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucygpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxldGUgc3R1ZGVudHMgd29yayBvbiBzdHVkZW50cyBwYyAobWFrZXMgc2Vuc2UgaWYgZXhhbSBpcyB3cml0dGVuIG9uIHNjaG9vbCBwcm9wZXJ0eSlcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cyAmJiBzZXJ2ZXJzdGF0dXMuZGVsZm9sZGVyb25leGl0ID09PSB0cnVlKXtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBjbGVhbmluZyBleGFtIHdvcmtmb2xkZXIgb24gZXhpdFwiKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgZnMucm1TeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBcIixlcnJvcik7IH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7IC8vIGluIHNvbWUgZWRnZSBjYXNlcyBpbiBkZXZlbG9wbWVudCB0aGlzIGlzIHNldCBidXQgc3RpbGwgdW51c2FibGUgLSB1c2UgdHJ5L2NhdGNoICAgXG4gICAgICAgICAgICB0cnkgeyBcbiAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGRldnRvb2xzIHdpbmRvd1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCB8fCB0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxXZWJDb250ZW50cyA9IHdlYkNvbnRlbnRzLmdldEFsbFdlYkNvbnRlbnRzKCkgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB3YyBvZiBhbGxXZWJDb250ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiB3Yy5ob3N0V2ViQ29udGVudHM/LmlkID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuaWQgJiYgd2MuaXNEZXZUb29sc09wZW5lZD8uKCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBkZXN0cm95aW5nIGRldnRvb2xzIHdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gV2FpdCBmb3IgYWxsIERldlRvb2xzIHRvIGJlIGNsb3NlZCBiZWZvcmUgY2xvc2luZyB0aGUgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgYWxsIGNsb3NlRGV2VG9vbHMoKSBjYWxscyBhcmUgY29tcGxldGVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGFsd2F5cyB0cnkgdG8gY2xvc2UgdGhlIGV4YW0gd2luZG93IHNhZmVseSBhZnRlciBkZXZ0b29scyBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogJyxlKX1cbiAgICAgICAgICAgXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGJsb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuY2xvc2UoKTsgXG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IG5vIGZ1bmN0aW9uYWwgYmxvY2t3aW5kb3cgdG8gaGFuZGxlXCIpXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfVxuICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIFxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZTtcblxuICAgICAgICBpZiAobGFuZ3VhZ2VUb29sU2VydmVyLmxhbmd1YWdlVG9vbFByb2Nlc3Mpe1xuICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0b3BTZXJ2ZXIoKTsgLy8gS2lsbCBMYW5ndWFnZVRvb2wgc2VydmVyIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgIH1cbiAgICAgICAgLy8gYXNrIHN0dWRlbnQgdG8gcXVpdCBhcHAgYWZ0ZXIgZmluaXNoaW5nIGV4YW1cbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5zaG93RXhpdFF1ZXN0aW9uKClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgZXhhbXdpbmRvdyBvbmx5IHdoZW4gbm8gcHJpbnRUb1BERiBvcGVyYXRpb24gaXMgcnVubmluZ1xuICAgICAqL1xuICAgIGNsb3NlRXhhbVdpbmRvd1NhZmVseSgpe1xuICAgICAgICBjb25zdCBleGFtV2luID0gV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgIGlmICghZXhhbVdpbil7IHJldHVybiB9XG5cbiAgICAgICAgaWYgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZil7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBwcmludFRvUERGIGluIHByb2dyZXNzIC0gcmV0cnkgaW4gMXNcIilcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpIH0sIDEwMDApIC8vIHJldHJ5IHVudGlsIHByaW50aW5nIGlzIGZpbmlzaGVkXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWV4YW1XaW4uaXNEZXN0cm95ZWQ/LigpKXtcbiAgICAgICAgICAgICAgICBleGFtV2luLmNsb3NlKCkgLy8gbm9ybWFsIGNsb3NlLCBvbignY2xvc2UnKSBoYW5kbGVyIGRvZXMgdGhlIHJlc3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogZXJyb3Igd2hpbGUgY2xvc2luZyBleGFtd2luZG93XCIsIGUpXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vIHRoaXMgaXMgbWFudWFsbHkgdHJpZ2dlcmVkIGlmIGNvbm5lY3Rpb24gaXMgbG9zdCBkdXJpbmcgZXhhbSAtIHdlIGFsbG93IHRoZSBzdHVkZW50IHRvIGdldCBvdXQgb2YgdGhlIGtpb3NrIG1vZGUgXG4gICAgLy8gSU5GTzogdGhpcyBpcyBiYXNpY2FsbHkgcmVkdW5kYW50IFxuICAgIGFzeW5jIGdyYWNlZnVsbHlFbmRFeGFtKCl7XG4gICAgICAgIHRoaXMuZW5kRXhhbSgpXG4gICAgfVxuXG4gICAgLy8gcmVzZXQgYWxsIHZhcmlhYmxlcyB0aGF0IHNpZ25hbCBvciBuZWVkIGEgdmFsaWQgdGVhY2hlciBjb25uZWN0aW9uXG4gICAgcmVzZXRDb25uZWN0aW9uKCl7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlICAvLyB3ZSBhcmUgZm9jdXNlZCBcbiAgICAgICAgLy90aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2UgICAvLyBkbyBub3Qgc2V0IHRvIGZhbHNlIHVudGlsIGV4YW0gd2luZG93IGlzIGFjdHVhbGx5IGNsb3NlZCAgKHRoaXMgaXMgZG9uZSBpbiBlbmRFeGFtKCkpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udGltZXN0YW1wID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2VcbiAgICAgICAgLy90aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gZmFsc2UgIC8vIHRoaXMgY2hlY2sgaGFwcGVucyBvbmx5IGF0IHRoZSBhcHBsaWNhdGlvbiBzdGFydC4uIGRvIG5vdCByZXNldCBvbmNlIHNldFxuICAgIH1cbiBcblxuXG5cbiAgICAvKipcbiAgICAgKiBkaWVzZSBtZXRob2RlIGhvbHQgc2ljaCwgZGllIHZvbSB0ZWFjaGVyIHp1bSBkb3dubG9hZCBiZXJlaXRnZWxlZ3RlbiBkYXRlaWVuXG4gICAgICogXHUwMEZDYmVyIGRhcyB1cGRhdGUgaW50ZXJ2YWwgd2lyZCBkZXIgdHJpZ2dlciB6dW0gZG93bmxvYWQgdW5kIGRpZSBmaWxlbGlzdCBlcmhhbHRlblxuICAgICAqIEBwYXJhbSB7Kn0gZmlsZXMgXG4gICAgICovXG4gICAgcmVxdWVzdEZpbGVGcm9tU2VydmVyKGZpbGVzKXtcbiAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgbGV0IHNlcnZlcmlwID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuXG4gICAgICAgIGxldCBiYWNrdXBmaWxlID0gZmFsc2VcbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICBpZiAoZmlsZS5uYW1lICYmIGZpbGUubmFtZS5pbmNsdWRlcygnYmFrJykpeyAgIC8vIHRoaXMgd2lsbCBhbHdheXMgc2V0IHRoZSBsYXN0IGJhayBmaWxlIGFzIGJhY2t1cCBmaWxlIGlmIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBiYWNrdXBmaWxlID0gZmlsZS5uYW1lXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG5cbiAgICAgICAgLy8gRGF0ZW4gZlx1MDBGQ3IgZGVuIFBPU1QtUmVxdWVzdCB2b3JiZXJlaXRlblxuICAgICAgICBsZXQgZGF0YSA9IEpTT04uc3RyaW5naWZ5KHsgJ2ZpbGVzJzogZmlsZXMsICd0eXBlJzogJ3N0dWRlbnRmaWxlcmVxdWVzdCcgfSk7XG5cbiAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgIGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZG93bmxvYWQvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBkYXRhLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmFycmF5QnVmZmVyKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgIC50aGVuKGJ1ZmZlciA9PiB7XG4gICAgICAgICAgICBsZXQgYWJzb2x1dGVGaWxlcGF0aCA9IGpvaW4odGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSwgdG9rZW4uY29uY2F0KCcuemlwJykpO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFic29sdXRlRmlsZXBhdGgsIEJ1ZmZlci5mcm9tKGJ1ZmZlciksIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7IGxvZy5lcnJvcihlcnIpOyAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFjdChhYnNvbHV0ZUZpbGVwYXRoLCB7IGRpcjogdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSB9KSBcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogZmlsZXMgcmVjZWl2ZWQgYW5kIGV4dHJhY3RlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmcy5wcm9taXNlcy51bmxpbmsoYWJzb2x1dGVGaWxlcGF0aCk7IC8vIFZlcndlbmR1bmcgZGVyIFByb21pc2UtYmFzaWVydGVuIEFQSSB2b24gZnNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJhY2t1cGZpbGUgJiYgV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JhY2t1cCcsIGJhY2t1cGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IFRyaWdnZXIgUmVwbGFjZSBFdmVudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyID0+IGxvZy5lcnJvcihgQ29tbXVuaWNhdGlvbkhhbmRsZXIgLSByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6ICR7ZXJyfWApKTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBzZW5kRXhhbVRvVGVhY2hlcigpe1xuICAgICAgICAvL3NlbmQgc2F2ZSB0cmlnZ2VyIHRvIGV4YW0gd2luZG93XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy90aGVyZSBpcyBhIHJ1bm5pbmcgZXhhbSAtIHNhdmUgY3VycmVudCB3b3JrIGZpcnN0IVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnc2F2ZScsJ3RlYWNoZXJyZXF1ZXN0JykgICAvL3RyaWdnZXIsIHdoeSAgKHRlYWNoZXJyZXF1ZXN0IHdpbGwgYWxzbyB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKSBidXQgb25seSBhZnRlciBzYXZpbmcgdGhlIHBkZiBpcyBjb21wbGV0ZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7IFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgQ29tbXVuaWNhdGlvbiBoYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IENvdWxkIG5vdCBzYXZlIHN0dWRlbnRzIHdvcmsuIElzIGV4YW1tb2RlIGFjdGl2ZT9gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAgLy8gbm90IHJ1bm5pbmcgZXhhbSAocHJvYmFibHkgdXNpbmcgbmV4dC1leGFtIGFzIGNsYXNzcm9vbW1hbmFnbWVudCB0b29sKVxuICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgICAvL3ppcCBkaXJlY3RvcnkgYW5kIHNlbmQgdG8gdGVhY2hlciBhcGlcbiAgICAgICAgfVxuXG4gICAgIH1cblxuXG4gICAgICAvL3ppcCBjb25maWcud29yayBkaXJlY3RvcnkgYW5kIHNlbmQgdG8gdGVhY2hlclxuICAgICBhc3luYyBzZW5kVG9UZWFjaGVyKCl7XG4gICAgICAgIHRyeSB7IGlmICghZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5KTsgfVxuICAgICAgICB9Y2F0Y2ggKGUpeyBsb2cuZXJyb3IoZSl9XG5cbiAgICAgICAgLy8gIHRoaXMgaXMgdGhlIGxvZ2ZpbGUgcGF0aCB0cnkgdG8gY29weSB0aGUgbG9nZmlsZSB0byB0aGUgZXhhbWRpcmVjdG9yeSBiZWZvcmUgbWFraW5nIHRoZSB6aXAgZmlsZVxuICAgICAgICBsZXQgbG9nZmlsZXBhdGggPSBwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9nZmlsZXBhdGgpKXtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKGxvZ2ZpbGVwYXRoLCBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksICduZXh0LWV4YW0tc3R1ZGVudC5sb2cnKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRUb1RlYWNoZXI6IGNvdWxkIG5vdCBjb3B5IGxvZ2ZpbGUgdG8gZXhhbWRpcmVjdG9yeScpOyB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgemlwZmlsZW5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUuY29uY2F0KCcuemlwJylcbiAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgbGV0IHNlcnZlcmlwID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuXG4gICAgICAgIGxldCB6aXBmaWxlcGF0aCA9IGpvaW4odGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSwgemlwZmlsZW5hbWUpO1xuICAgICBcblxuICAgICAgICBsZXQgYmFzZTY0RmlsZSA9IG51bGxcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuemlwRGlyZWN0b3J5KHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHppcGZpbGVwYXRoKVxuICAgICAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoemlwZmlsZXBhdGgpO1xuICAgICAgICAgICAgYmFzZTY0RmlsZSA9IGZpbGVDb250ZW50LnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgfWNhdGNoIChlKXsgIGxvZy5lcnJvcihlKSAgfVxuXG4gICAgICAgIC8vIHNlbmRpbmcgdGhlIHdob2xlIGRpcmVjdG9yeSBhcyB6aXAgZmlsZSBiYXNlNjRlbmNvZGVkIHZpYSBKU09OIGlzbid0IHByb2JhYmx5IHRoZSBiZXN0IG1ldGhvZCBidXQgaXQgd29ya3Mgd2hpbGUgYWxsIGZvcm1EYXRhIGFwcHJvYWNoZXMgZmFpbGVkIHdpdGhcbiAgICAgICAgLy8gZmV0Y2goKSB3aGlsZSB0aGV5IHdvcmtlZCB3aXRoIGF4IGlvcygpIC0gbm90IGV2ZW4gY2hhdGdwdCBvciBzdGFja292ZXJmbG93IGNvdWxkIGhlbHAgXl4gaSB0aGluayBpdCBpcyByZWxhdGVkIHRvIHRoZSBzcGVjaWZpYyBmb3JtRGF0YSBtb2R1bGUgdGhhdCBjYW50IGJlIGltcG9ydGVkIHdpdGhvdXQgXCJ3aW5kb3cgZXJyb3JcIlxuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL3JlY2VpdmUvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWA7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZmlsZTogYmFzZTY0RmlsZSwgZmlsZW5hbWU6IHppcGZpbGVuYW1lIH0pLFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXG4gICAgICAgIC50aGVuKGRhdGEgPT4geyBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogdGVhY2hlciByZXNwb25zZTogJHtkYXRhLm1lc3NhZ2V9YCk7IH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7bG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiAke2Vycm9yfWApOyB9KTtcbiAgICAgfVxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzb3VyY2VEaXI6IC9zb21lL2ZvbGRlci90by9jb21wcmVzc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBvdXRQYXRoOiAvcGF0aC90by9jcmVhdGVkLnppcFxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHppcERpcmVjdG9yeShzb3VyY2VEaXIsIG91dFBhdGgpIHtcbiAgICAgICAgY29uc3QgYXJjaGl2ZSA9IGFyY2hpdmVyKCd6aXAnLCB7IHpsaWI6IHsgbGV2ZWw6IDkgfX0pO1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShvdXRQYXRoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXJjaGl2ZVxuICAgICAgICAgICAgLmRpcmVjdG9yeShzb3VyY2VEaXIsIGZhbHNlKVxuICAgICAgICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiByZWplY3QoZXJyKSlcbiAgICAgICAgICAgIC5waXBlKHN0cmVhbSlcbiAgICAgICAgO1xuICAgICAgICBzdHJlYW0ub24oJ2Nsb3NlJywgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgICAgYXJjaGl2ZS5maW5hbGl6ZSgpO1xuICAgICAgICB9KS5jYXRjaCggZXJyb3IgPT4geyBsb2cuZXJyb3IoZXJyb3IpfSk7XG4gICAgfVxuXG5cblxuXG5cblxuICAgIC8vIHRpbWVvdXQgXG4gICAgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgIFxuIH1cbiBcbiBleHBvcnQgZGVmYXVsdCBuZXcgQ29tbUhhbmRsZXIoKVxuIFxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCBuZXQgZnJvbSAnbmV0J1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcydcbmNvbnN0IHt0fSA9IGkxOG4uZ2xvYmFsXG5pbXBvcnR7aXBjTWFpbiwgY2xpcGJvYXJkLGFwcCwgd2ViQ29udGVudHN9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBvcyBmcm9tICdvcydcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgbWFtbW90aCBmcm9tICdtYW1tb3RoJztcblxuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlcic7XG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi90cmF5bWVudS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOZXR3b3JrT3JSZXNldCB9IGZyb20gJy4vdGVzdHBlcm1pc3Npb25zTWFjLmpzJztcbmltcG9ydCB7IGdldFdsYW5JbmZvIH0gZnJvbSAnLi9nZXR3bGFuaW5mby5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbnN0IGNoZWNrUG9ydE9wZW4gPSAocG9ydCwgaG9zdCA9ICcxMjcuMC4wLjEnLCB0aW1lb3V0ID0gMTUwMCkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgICAgICBjb25zdCBmaW5pc2ggPSAocnVubmluZywgZXJyb3IgPSBudWxsKSA9PiB7XG4gICAgICAgICAgICBzb2NrZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSh7IHJ1bm5pbmcsIHBvcnQsIGhvc3QsIGVycm9yIH0pO1xuICAgICAgICB9O1xuICAgICAgICBzb2NrZXQuc2V0VGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Nvbm5lY3QnLCAoKSA9PiBmaW5pc2godHJ1ZSkpO1xuICAgICAgICBzb2NrZXQub25jZSgndGltZW91dCcsICgpID0+IGZpbmlzaChmYWxzZSwgJ3RpbWVvdXQnKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdlcnJvcicsIChlcnIpID0+IGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KHBvcnQsIGhvc3QpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gSVBDIGhhbmRsaW5nIChCYWNrZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2UgLy8gZmxhZyB0byBwcmV2ZW50IGNsb3Npbmcgd2luZG93IHdoaWxlIHByaW50aW5nXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG4gICAgICAgIFxuXG4gICAgICAgIGlwY01haW4ub24oJ3NldC1uZXctbG9jYWxlJywgKGV2ZW50LCBsb2NhbGUpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2V0LW5ldy1sb2NhbGU6IHNldHRpbmcgbmV3IGxvY2FsZSB0byAke2xvY2FsZX1gKVxuICAgICAgICAgICAgaTE4bi5sb2NhbGUgPSBsb2NhbGVcbiAgICAgICAgICAgIHVwZGF0ZVN5c3RlbVRyYXkoaTE4bi5sb2NhbGUpO1xuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEV4YW1NYXRlcmlhbHMnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICBcbiAgICAgICAgICAgIGxldCBjbGllbnRpbmZvID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb1xuICAgICAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJpcCA9IGNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgICAgIGxldCB0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHsgXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGNsaWVudGluZm8uZ3JvdXAsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBleGFtTWF0ZXJpYWxzID0gZmFsc2VcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgICAgICAgICBleGFtTWF0ZXJpYWxzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9nZXRleGFtbWF0ZXJpYWxzLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogcmVjZWl2ZWQgZGF0YVwiLCBkYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiAke2Vycn1gKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4YW1NYXRlcmlhbHNcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgIFxuICAgICAgICB9KSBcblxuICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGNvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgZXhhbSBtb2RlcylcbiAgICAgICAgY29uc3QgY2hlY2tDb21tb25FeGNlcHRpb25zID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIk1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiR29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50c1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGUuY29tXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJteXNpZ25pbnNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIndpbmRvd3NhenVyZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb29rdXBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJiaWxkdW5nLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTaGliYm9sZXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJpZC1hdXN0cmlhLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhIYW5kbGVyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImV1LW1vYmlsZS5ldmVudHMuZGF0YVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImdzdGF0aWMuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJsaXZlLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGVzeW5kaWNhdGlvbi5jb21cIikpIHJldHVybiB0cnVlOyBcblxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIGFsbG93ZWRVcmxzIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRW50ZmVybmUgYWx0ZSBMaXN0ZW5lciwgdW0gRG9wcGVsLVJlZ2lzdHJpZXJ1bmdlbiB6dSB2ZXJtZWlkZW5cbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYWxsb3cgPSBhbGxvd2VkVXJscy5tYXAocyA9PiBTdHJpbmcocykudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBpZiBVUkwgbWF0Y2hlcyBhbGxvd2VkIGRvbWFpbiAoc3VwcG9ydHMgc3ViZG9tYWlucyBhbmQgcGF0aHMpXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxTdHIgPSBTdHJpbmcodGFyZ2V0VXJsKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGNvbW1vbiBleGNlcHRpb25zIGZpcnN0XG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrQ29tbW9uRXhjZXB0aW9ucyh1cmxTdHIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBlYWNoIGFsbG93ZWQgVVJMXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBhbGxvd2VkVXJsIG9mIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gcGFyc2UgYXMgVVJMIHRvIGV4dHJhY3QgaG9zdG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybE9iaiA9IG5ldyBVUkwodGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEhvc3RuYW1lID0gdXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnNlIGFsbG93ZWQgVVJMIHRvIGV4dHJhY3QgZG9tYWluXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmw7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dlZFVybE9iaiA9IG5ldyBVUkwoYWxsb3dlZFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmxPYmouaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsb3dlZFVybC5pbmNsdWRlcygnLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQncyBhIHBhdGggd2l0aG91dCBwcm90b2NvbCwgZXh0cmFjdCBkb21haW4gcGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gYWxsb3dlZFVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFeGFjdCBtYXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWxsb3dlZERvbWFpbiBpcyBhIHNwZWNpZmljIHN1YmRvbWFpbiAoY29udGFpbnMgZG90cylcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzU3BlY2lmaWNTdWJkb21haW4gPSBhbGxvd2VkRG9tYWluLmluY2x1ZGVzKCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1NwZWNpZmljU3ViZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBzcGVjaWZpYyBzdWJkb21haW4gaXMgc3BlY2lmaWVkLCBvbmx5IGFsbG93IHRoYXQgZXhhY3Qgc3ViZG9tYWluIGFuZCB3d3cuIHZhcmlhbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGFsbG93IG90aGVyIHN1YmRvbWFpbnMgd2hlbiBhIHNwZWNpZmljIG9uZSBpcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgb25seSBiYXNlIGRvbWFpbiBpcyBzcGVjaWZpZWQgKGUuZy4sIFwib3JmLmF0XCIpLCBhbGxvdyBhbGwgc3ViZG9tYWluc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IHd3dy4gc3ViZG9tYWluIGV4cGxpY2l0bHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IG90aGVyIHN1YmRvbWFpbnMgKGUuZy4sIHN1Yi5kdWRlbi5kZSBpZiBkdWRlbi5kZSBpcyBhbGxvd2VkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZS5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSB0YXJnZXRIb3N0bmFtZS5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBwcmVmaXg6IG11c3QgYmUgdmFsaWQgc3ViZG9tYWluIG5hbWUgKGFscGhhbnVtZXJpYyBhbmQgaHlwaGVucylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBVUkwgcGFyc2luZyBmYWlscywgZmFsbCBiYWNrIHRvIHNpbXBsZSBpbmNsdWRlcyBjaGVjayBmb3IgcGF0aHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cmxTdHIuaW5jbHVkZXMoYWxsb3dlZFVybCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzQWxsb3dlZCkgeyBcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGFsbG93ZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVW5pZmllZCBJUEMgaGFuZGxlciBmb3Igd2VidmlldyBibG9ja2luZyAtIHN1cHBvcnRzIHdlYnNpdGUsIGVkdXZpZHVhbCwgZm9ybXMsIHJkcCBtb2Rlc1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb2RlLCBhbGxvd2VkRG9tYWluLCBiYXNlVXJsLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiwgZ2Zvcm1zVGVzdElkIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgdG8gcHJldmVudCBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVSTCB2YWxpZGF0aW9uIGZ1bmN0aW9uIC0gZGlmZmVyZW50IGxvZ2ljIGJhc2VkIG9uIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IGlzVXJsQWxsb3dlZCA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZSA9PT0gXCJ3ZWJzaXRlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV0VCU0lURSBtb2RlOiBjaGVjayBkb21haW4gbWF0Y2hpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwgfHwgdGFyZ2V0VXJsLmluY2x1ZGVzKGJhc2VVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkb21haW4gPSB1cmxPYmouaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09IGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhwbGljaXRseSBhbGxvdyB3d3cuIHN1YmRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbiA9PT0gJ3d3dy4nICsgYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluLmVuZHNXaXRoKCcuJyArIGFsbG93ZWREb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZG9tYWluLnNsaWNlKDAsIC0oYWxsb3dlZERvbWFpbi5sZW5ndGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZWR1dmlkdWFsXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRURVVklEVUFML01PT0RMRSBtb2RlOiBjaGVjayBtb29kbGVUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9vZGxlLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInN0YXJ0YXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicHJvY2Vzc2F0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ291dFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImVkdXZpZHVhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9saWN5XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJmb3Jtc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZPUk1TIG1vZGU6IGNoZWNrIGdmb3Jtc1Rlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKGdmb3Jtc1Rlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBHb29nbGUgRm9ybXMtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImZvcm1SZXNwb25zZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ2aWV3c2NvcmVcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcInJkcFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJEUCBtb2RlOiBhbGxvdyBhbGwgKG9yIGltcGxlbWVudCBzcGVjaWZpYyBsb2dpYyBpZiBuZWVkZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIG1vZGVzKVxuICAgICAgICAgICAgICAgIHJldHVybiBjaGVja0NvbW1vbkV4Y2VwdGlvbnModGFyZ2V0VXJsKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB0YXJnZXQ9XCJfYmxhbmtcIiBsaW5rcyBhbmQgd2luZG93Lm9wZW4gLSBibG9jayBCRUZPUkUgbmF2aWdhdGlvblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgLy8gT3BlbiBpbiBzYW1lIHdlYnZpZXdcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgLy8gUHJldmVudCBuZXcgd2luZG93XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB3aWxsLW5hdmlnYXRlIG9uIHdlYkNvbnRlbnRzIGxldmVsIC0gdGhpcyBmaXJlcyBCRUZPUkUgbmF2aWdhdGlvbiBoYXBwZW5zXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gQmxvY2sgbmF2aWdhdGlvbiBjb21wbGV0ZWx5IC0gdGhpcyBoYXBwZW5zIEJFRk9SRSBwYWdlIGxvYWRzXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LnN0b3AoKTsgLy8gU3RvcCBhbnkgbG9hZGluZyBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsaWFzIGZvciBlZHV2aWR1YWwgbW9kZSAtIHJlZGlyZWN0cyB0byB1bmlmaWVkIGhhbmRsZXJcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci1lZHV2aWR1YWwtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KSA9PiB7XG4gICAgICAgICAgICAvLyBDYWxsIHRoZSB1bmlmaWVkIGhhbmRsZXIgd2l0aCBlZHV2aWR1YWwgbW9kZVxuICAgICAgICAgICAgY29uc3QgdW5pZmllZEhhbmRsZXIgPSBpcGNNYWluLmxpc3RlbmVycygnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycpWzBdO1xuICAgICAgICAgICAgaWYgKHVuaWZpZWRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuaWZpZWRIYW5kbGVyKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGU6ICdlZHV2aWR1YWwnLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbG9hZCB0aGUgYnJvd3NlciB2aWV3XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVsb2FkLWJyb3dzZXItdmlldycsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmwpO1xuICAgICAgICB9KTtcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGxhbmd1YWdlVG9vbCBBUEkgU2VydmVyICh3aXRoIEphdmEgSlJFKVxuICAgICAgICAgKiBSdW5zIGF0IGxvY2FsaG9zdCA4MDg4XG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWN0aXZhdGUgc3BlbGxjaGVjayBvbiBkZW1hbmQgZm9yIHNwZWNpZmljIHN0dWRlbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgTGFuZ3VhZ2VUb29sIHNlcnZlciByZXNwb25kcyBvbiBjb25maWd1cmVkIHBvcnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnaXNMYW5ndWFnZVRvb2xSdW5uaW5nJywgYXN5bmMgKCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHBvcnQgPSBsYW5ndWFnZVRvb2xTZXJ2ZXIucG9ydCB8fCA4MDg4O1xuICAgICAgICAgICAgY29uc3QgaG9zdHMgPSBbJzEyNy4wLjAuMScsICc6OjEnLCAnbG9jYWxob3N0J107XG4gICAgICAgICAgICAvLyBSdW4gYWxsIGNoZWNrcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlLCB1c2UgbG9uZ2VyIHRpbWVvdXQgZm9yIHNlcnZlciBzdGFydHVwIGRldGVjdGlvblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGhvc3RzLm1hcChob3N0ID0+IGNoZWNrUG9ydE9wZW4ocG9ydCwgaG9zdCwgMjUwMCkpKTtcbiAgICAgICAgICAgIC8vIFJldHVybiBmaXJzdCBzdWNjZXNzZnVsIHJlc3VsdCwgb3IgbGFzdCByZXN1bHQgaWYgbm9uZSBzdWNjZWVkZWRcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3NSZXN1bHQgPSByZXN1bHRzLmZpbmQocmVzdWx0ID0+IHJlc3VsdC5ydW5uaW5nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0IHx8IHJlc3VsdHNbcmVzdWx0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IExPQ0FMIExvY2tkb3duXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdsb2NhbGxvY2tkb3duJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2NhbGxvY2tkb3duOiBsb2NraW5nIGRvd24gY2xpZW50IHdpdGhvdXQgdGVhY2hlciBjb25uZWN0aW9uXCIpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7XG4gICAgICAgICAgICAgICAgZXhhbW1vZGU6IHRydWUsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RUeXBlOiAnJyxcbiAgICAgICAgICAgICAgICBtb29kbGVEb21haW46ICcnLFxuIFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RpbnRlcnZhbDogMCxcbiAgICAgICAgICAgICAgICBtc09mZmljZUZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNsb2NrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBpbjogJzAwMDAnLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdW5sb2Nrb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmb250ZmFtaWx5OiAnc2Fucy1zZXJpZicsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdElkOiAnJyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiBhcmdzLnBhc3N3b3JkLFxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgdXNlRXhhbVNlY3Rpb25zOiBmYWxzZSwgLy9pZiBmYWxzZSBleGFtIHNlY3Rpb24gMSBpcyB1c2VkIGFuZCBubyB0YWJzIGFyZSBkaXNwbGF5ZWRcbiAgICAgICAgICAgICAgICBhY3RpdmVTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgZXhhbVNlY3Rpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIDE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW10eXBlOiBhcmdzLmV4YW1tb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY21hcmdpbjogeyBzaWRlOiAncmlnaHQnLCBzaXplOiAzIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lc3BhY2luZzogJzInLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9SZXBlYXQ6IDMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGFyZ3MubGFuZ3VhZ2V0b29sIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6IGFyZ3Muc3BlbGxjaGVja2xhbmcgfHwgJ2RlLURFJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBhcmdzLnN1Z2dlc3Rpb25zIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGFyZ3MuY2xpZW50bmFtZTtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBcIjEyNy4wLjAuMVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gXCJhXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSB0cnVlOyAvLyB0aGlzIG11c3QgYmUgc2V0IHRvIHRydWUgaW4gb3JkZXIgdG8gc3RvcCB0eXBpY2FsIG5leHQtZXhhbSBjbGllbnQvdGVhY2hlciBhY3Rpb25zXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gbG9jYWxsb2NrZG93blwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdmlydHVhbGl6ZWQgc3RhdHVzXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigndmlydHVhbGl6ZWQnLCAoKSA9PiB7ICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gdHJ1ZTsgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IEZPQ1VTIHN0YXRlIHRvIGZhbHNlIChtb3VzZSBsZWZ0IGV4YW0gd2luZG93KVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdmb2N1c2xvc3QnLCAoZXZlbnQsIGN0cmxhbHQ9ZmFsc2UpID0+IHsgXG4gICAgICAgICAgICBsZXQgYW5zd2VyID0gZmFsc2UgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgIXRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1tb2RlKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZX1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPiAwKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkICYmIGN0cmxhbHQgPT0gZmFsc2UpeyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGZvY3VzbG9zdDogbW91c2VsZWF2ZSBldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICBcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGJsb2NrIGV2ZXJ5dGhpbmcgYW5kIGluZm9ybSB0ZWFjaGVyICAocHJvYmFibHkgYW4gb3ZlcmtpbGwgb24gbW91c2VsZWF2ZSAtIG5lZWRzIHRlc3RpbmcpXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGFuc3dlclxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIG1haW4gY29uZmlnIG9iamVjdFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb25maWcgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogVW5sb2NrIENvbXB1dGVyXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdncmFjZWZ1bGx5ZXhpdCcsICgpID0+IHsgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBncmFjZWZ1bGx5ZXhpdDogZ3JhY2VmdWxseSBsZWF2aW5nIGxvY2tlZCBleGFtIG1vZGVgKVxuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdyYWNlZnVsbHlFbmRFeGFtKCkgXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICB9IClcblxuICAgICAgICAvKipcbiAgICAgICAgKiBzdG9wIHJlc3RyaWN0aW9uc1xuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdHJpY3Rpb25zJywgKCkgPT4geyAgXG4gICAgICAgICAgICAvL3RoaXMgYWxzbyBzdG9wcyB0aGUgY2xlYXJDbGlwYm9hcmQgaW50ZXJ2YWxcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIFxuICAgICAgICB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIGNvcHkgdG8gZ2xvYmFsIGNsaXBib2FyZFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2xpcGJvYXJkJywgKGV2ZW50LCB0ZXh0KSA9PiB7ICBcbiAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7ICAgIGFkZHJlc3MgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7ICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBtdWx0aWNhc3RjbGllbnQgbm90IHJ1bm5pbmdcIik7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBiZXJlaXRzIGVpbmUgQWRyZXNzZSB2b3JoYW5kZW4gaXN0LCBsaWVmZXJuIHdpciBzaWUgenVyXHUwMEZDY2suXG4gICAgICAgICAgICBpZiAoYWRkcmVzcykgeyAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDsgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyc3VjaGUsIGFuIGRpZSBrb3JyZWt0ZSBTY2huaXR0c3RlbGxlIHp1IGJpbmRlblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBGYWxscyBnYXRld2F5NHN5bmMoKSBibG9ja2llcmVuZCBpc3QsIGthbm5zdCBkdSBkaWVzZW4gQXVmcnVmIGluIGVpbiBQcm9taXNlIHBhY2tlbjpcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2UgfSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdhdGV3YXk0c3luYygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikgeyAgcmVqZWN0KGVycik7ICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpOyAvLyBMaWVmZXJ0IGRpZSBJUCBkZXIgU2Nobml0dHN0ZWxsZSwgd2VsY2hlIGRhcyBEZWZhdWx0IEdhdGV3YXkgaGF0XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMga2VpbmUgSVAgKG1pdCBHYXRld2F5KSB2ZXJmXHUwMEZDZ2JhciBpc3QsIGhvbGUgZWluZSBhbHRlcm5hdGl2ZSBBZHJlc3NlXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKTsgLy8gTGllZmVydCBhdWNoIGVpbmUgSVAsIHdlbm4ga2VpbiBHYXRld2F5IHZlcmZcdTAwRkNnYmFyIGlzdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcmZcdTAwRTRsc2NodGUgQWRyZXNzZW4gKHouIEIuIGxvY2FsaG9zdCkgaWdub3JpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PT0gXCIxMjcuMC4wLjFcIikgeyAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTsgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFdlbm4gZGllIE11bHRpY2FzdC1DbGllbnQgbmljaHQgbFx1MDBFNHVmdCwgaW5pdGlhbGlzaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgIWFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGYWxscyBpbml0KCkgYXN5bmNocm9uIHVtZ2VzZXR6dCB3ZXJkZW4ga2Fubiwgd2FydGVuIHdpciBoaWVyIGRhcmF1Zi5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7ICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IEVycm9yIGluaXRpYWxpemluZyBtdWx0aWNhc3QgY2xpZW50XCIsIGVycik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwO1xuICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gZWRpdG9yIGFzIGh0bWwgZmlsZSAtIGFzIGJhY2t1cCAtIG9ubHkgdHJpZ2dlcmVkIGJ5IHRoZSB0ZWFjaGVyIGZvciBub3cgKGFsbG93IG1hbnVhbCBiYWNrdXAgISEpXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7Y2xpZW50bmFtZTp0aGlzLmNsaWVudG5hbWUsIGZpbGVuYW1lOmAke2ZpbGVuYW1lfS5odG1sYCwgZWRpdG9yY29udGVudDogZWRpdG9yY29udGVudCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZUhUTUwnLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGh0bWxDb250ZW50ID0gYXJncy5lZGl0b3Jjb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGxldCBodG1sZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2BcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKXtcbiAgICAgICAgICAgICAgICBodG1sZmlsZW5hbWUgPSBgJHtmaWxlbmFtZX0uYmFrYFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBodG1sZmlsZSA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBodG1sZmlsZW5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaHRtbENvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoaHRtbGZpbGUsIGh0bWxDb250ZW50LCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogJHtlcnIubWVzc2FnZX1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWx0ZXJuYXRlcGF0aCA9IGAke2h0bWxmaWxlfS0ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59LmJha2BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHRyeWluZyB0byB3cml0ZSBmaWxlIGFzOlwiLCBhbHRlcm5hdGVwYXRoIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgaHRtbENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgYmFzZTY0IGVuY29kZWQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBERmJhc2U2NCcsIGFzeW5jIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0UERGYmFzZTY0OiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyID0gYXJncy5zdWJtaXNzaW9ubnVtYmVyKzEgLy8gY2xpZW50aW5mbyBrZWVwcyB0cmFjayBvZiBzdWJtaXNzaW9ucyBmb3IgYXV0b21hdGVkIHN1Ym1pc3Npb25udW1iZXJzIGF0IHNlY3Rpb24gY2hhbmdlIC0gYnV0IHRoaXMgb2J2aW91c2x5IGhhcHBlbnMgYWZ0ZXIgbWFudWFsIHN1Ym1pdFxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKGFyZ3Muc3VibWlzc2lvbm51bWJlciwgYXJncy5zZWN0aW9ubmFtZSwgYXJncy5wcmludEJhY2tncm91bmQpICAgLy8gd2h5IHRoZSBoZWxsIGlzIHRoaXMgZnVuY3Rpb24gbG9jYXRlZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBhbmQgbm90IGluIGlwY2hhbmRsZXIuanMgPyBGSVhNRSAhXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyB0aGUgRXhhbVdpbmRvdyBjb250ZW50IGFzIFBERlxuICAgICAgICAgKiBBVFRFTlRJT04gdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCByZXR1bnMgYSBiYXNlNjQgdmVyc2lvbiBvZiB0aGUgcGRmXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncHJpbnRwZGYnLCAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICAvLyBkbyBub3QgcHJpbnQgaWYgZXhhbSBtb2RlIGlzIG5vdCBhY3RpdmUgYW55bW9yZVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBleGFtbW9kZSBpcyBmYWxzZSAtIHNraXBwaW5nIHByaW50XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBwcmludCBhbHJlYWR5IGluIHByb2dyZXNzIC0gc2tpcHBpbmcgbmV3IHJlcXVlc3RcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyAvLyBkZWZpbmUgcHJpbnQgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGFyZ3MubGFuZHNjYXBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke2FyZ3Muc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7YXJncy5jbGllbnRuYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcGRmZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LnBkZmAgIC8vIGRlZmF1bHQgZmlsZW5hbWUgPSBjbGllbnRuYW1lLnBkZlxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmZpbGVuYW1lKXsgIC8vIGluIGNhc2Ugb2YgbWFudWFsIGJhY2t1cCB0aGUgdXNlciBjYW4gc2V0IGEgY3VzdG9tIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgICAgIHBkZmZpbGVuYW1lID0gYCR7YXJncy5maWxlbmFtZX0ucGRmYFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmZmlsZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgcGRmZmlsZW5hbWUpOyAgLy8gcGF0aCBwb2ludHMgdG8gdGhlIGN1cnJlbnQgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1hdXgucGRmYCAgICAvL3Rob21hcy5wZGYtYXV4LnBkZiBcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1vbGQucGRmYDsgICAvL3Rob21hcy5wZGYtb2xkLnBkZlxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlZmlsZW5hbWUpOyAgLy8gaWYgc29tZXRoaW5nIGdvZXMgd3Jvbmcgd2UgdHJ5IHRvIHdyaXRlIGEgZGlmZmVyZW50IGZpbGVcblxuXG4gICAgICAgICAgICAgICAgLy8gYXV4IGZpbGVzIGFyZSBmaWxlcyBjcmVhdGVkIGlmIHRoZSBtYWluIHBkZmZpbGVwYXRoIGlzIG5vdCB3cml0ZWFibGUgKG9wZW5lZCBvbiB3aW5kb3dzKSBcbiAgICAgICAgICAgICAgICB0cnkgeyAgLy8gYWx3YXlzIGNoZWNrIGZvciBvbGQgYXV4IGZpbGVzIGFuZCByZW5hbWUgdGhlbVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IGFsdGVybmF0ZWZpbGVuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhhbHRlcm5hdGVwYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGFtV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV4YW1XaW5kb3c/LndlYkNvbnRlbnRzXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdlYkNvbnRlbnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIm5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSB0cnVlXG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZSBmb3IgUERGIG1ldGFkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgcGRmVGl0bGUgPSBhcmdzLmZpbGVuYW1lID8gYXJncy5maWxlbmFtZSA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke2FyZ3Muc2VydmVybmFtZSB8fCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgfHwgJyd9YFxuICAgICAgICAgICAgICAgIC8vIGVzY2FwZSBxdW90ZXMgYW5kIHNwZWNpYWwgY2hhcmFjdGVycyBmb3IgSmF2YVNjcmlwdCBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkVGl0bGUgPSBwZGZUaXRsZS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7ZXNjYXBlZFRpdGxlfVwiYCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByaW50IHRoZSBleGFtIHdpbmRvdyB0byBwZGZcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucylcbiAgICAgICAgICAgICAgICB9KS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBwZGYgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMocGRmZmlsZXBhdGgpKSB7IGZzLnVubGlua1N5bmMocGRmZmlsZXBhdGgpOyB9fVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShwZGZmaWxlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfSAtIHdyaXRpbmcgZmlsZSBhczogJHthbHRlcm5hdGVwYXRofSBgKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgYXV4IGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRlcGF0aCkpIHsgZnMudW5saW5rU3luYyhhbHRlcm5hdGVwYXRoKTsgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZiAoYWx0ZXJuYXRpdmVyIFBmYWQpOiAke2Vyci5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgYWx0ZXJuYXRlIHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpICAgLy9tYWtlIHN1cmUgc3R1ZGVudHMgc2VlIHRoZSBuZXcgZmlsZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyb3IubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmVzIEFjdGl2ZSBTaGVldHMgZm9ybSBkYXRhIHRvIC5iYWsgZmlsZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc2F2ZUFjdGl2ZXNoZWV0c0JhaycsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWUgPyBgJHthcmdzLmZpbGVuYW1lfS5iYWtgIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGJha0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGZvcm1EYXRhIHRvIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShhcmdzLmZvcm1EYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byAuYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJha0ZpbGVQYXRoLCBqc29uRGF0YSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6IHNhdmVkIGZvcm0gZGF0YSB0byAke2Jha0ZpbGVuYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFsbCBmb3VuZCBTZXJ2ZXJzIGFuZCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0aW5mb2FzeW5jJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gZmFsc2UgICBcbiAgICAgICAgICAgIC8vIHNlcnZlcnN0YXR1cyBvYmpla3Qgd2lyZCBudXIgYmVpIGJlZ2lubiBkZXMgZXhhbXMgYW4gZGFzIGV4YW0gd2luZG93IGR1cmNoZ2VyZWljaHQgZlx1MDBGQ3IgYmFzaXMgZWluc3RlbGx1bmdlblxuICAgICAgICAgICAgLy8gYWxsZSB3ZWl0ZXJlbiB1cGRhdGVzIFx1MDBGQ2JlciBkYXMgc2VydmVyc3RhdHVzIG9iamVjdCB3ZXJkZW4gaW0gY29tbXVuaWNhdGlvbiBoYW5kbGVyIGdlbGVzZW4gdW5kIGdnZi4gYXVmIGRhcyBjbGllbnRpbmZvIG9iamVjdCBnZWxlZ3RcbiAgICAgICAgICAgIC8vIGRpZXNlciBrb21tdW5pa2F0aW9uc2ZsdXNzIG11c3MgaW4gMi4wIGdlc3RyZWFtbGluZWQgd2VyZGVuICNGSVhNRVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgc2VydmVyc3RhdHVzID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzIH1cblxuICAgICAgICAgICAgLy9jb3VudCBudW1iZXIgb2YgZmlsZXMgaW4gZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSkgIC8vIGVyc3RlbGx0IGZhbGxzIG5cdTAwRjZ0aWdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZWxpc3QgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcih3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICByZXR1cm4geyAgIFxuICAgICAgICAgICAgICAgIHNlcnZlcmxpc3Q6IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LFxuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiZWNhdXNlIG9mIG1pY3Jvc29mdCAzNjUgd2UgbmVlZCB0byB3b3JrIHdpdGggXCJCcm93c2VyVmlld1wiIFxuICAgICAgICAgKiBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGRpc2xheSBmdWxsc2NyZWVuIGluZm9ybWF0aW9uIGZyb20gdGhlIEV4YW0gaGVhZGVyIHdlIHRlbXBvcmFyaWx5IGNvbGxhcHNlIHRoZSBCcm93c2VyVmlldyBmb3IgT2ZmaWNlXG4gICAgICAgICAqIGFuZCByZXN0b3JlIGl0IGFmdGVyd2FyZHMgLSBub3QgcGVyZmVjdCBidXQgbG9va3Mgb2tcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjb2xsYXBzZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHsgeDogMCwgeTogMCwgd2lkdGg6IDAsIGhlaWdodDogMCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICB9KTtcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdG9yZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgbWVudUhlaWdodCA9IG1haW5XaW5kb3cubWVudUhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7IC8vIEdldCB0aGUgY3VycmVudCBib3VuZHMgb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIC8vIFNldCB0aGUgbmV3IGJvdW5kcyBvZiB0aGUgY29udGVudFZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiBtZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsIC8vIGZ1bGwgd2lkdGggb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBtZW51SGVpZ2h0IC8vIHJlbWFpbmluZyBoZWlnaHQgYWZ0ZXIgdGhlIG1lbnVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlIG1lbnUgaGVpZ2h0IGR5bmFtaWNhbGx5IHdoZW4gaGVhZGVyIGNvbnRlbnQgY2hhbmdlc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigndXBkYXRlLW1lbnUtaGVpZ2h0JywgKGV2ZW50LCBoZWlnaHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdztcbiAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmIGhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHN0b3JlZCBtZW51IGhlaWdodFxuICAgICAgICAgICAgICAgIG1haW5XaW5kb3cubWVudUhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZXBvc2l0aW9uIHRoZSBicm93c2VyIHZpZXcgd2l0aCBuZXcgaGVpZ2h0XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRWaWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgeTogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIGhlaWdodFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2VuZHMgYSByZWdpc3RlciByZXF1ZXN0IHRvIHRoZSBnaXZlbiBzZXJ2ZXIgaXBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIGNsaWVudG5hbWU6dGhpcy51c2VybmFtZSwgc2VydmVybmFtZTpzZXJ2ZXJuYW1lLCBzZXJ2ZXJpcCwgc2VydmVyaXAsIHBpbjp0aGlzLnBpbmNvZGUgXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdyZWdpc3RlcicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY2xpZW50bmFtZSA9IGFyZ3MuY2xpZW50bmFtZVxuICAgICAgICAgICAgY29uc3QgcGluID0gYXJncy5waW5cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmlwID0gYXJncy5zZXJ2ZXJpcFxuICAgICAgICAgICAgY29uc3Qgc2VydmVybmFtZSA9IGFyZ3Muc2VydmVybmFtZVxuICAgICAgICAgICAgY29uc3QgY2xpZW50aXAgPSBpcC5hZGRyZXNzKClcbiAgICAgICAgICAgIGNvbnN0IGhvc3RuYW1lID0gb3MuaG9zdG5hbWUoKVxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHRoaXMuY29uZmlnLnZlcnNpb25cbiAgICAgICAgICAgIGNvbnN0IGJpcHVzZXJJRCA9IGFyZ3MuYmlwdXNlcklEXG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXsgLy8jRklYTUUgZGFzIHNvbGx0ZSBlaWdlbnRsaWNoIHZvbSBzZXJ2ZXIga29tbWVuIFxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcmVnaXN0ZXJjbGllbnQvJHtzZXJ2ZXJuYW1lfS8ke3Bpbn0vJHtjbGllbnRuYW1lfS8ke2NsaWVudGlwfS8ke2hvc3RuYW1lfS8ke3ZlcnNpb259LyR7YmlwdXNlcklEfWA7XG4gICAgICAgICAgICBjb25zdCBzaWduYWwgPSBBYm9ydFNpZ25hbC50aW1lb3V0KDgwMDApOyAvLyA4MDAwIE1pbGxpc2VrdW5kZW4gPSA4IFNla3VuZGVuIEFib3J0U2lnbmFsIG1pdCBlaW5lbSBUaW1lb3V0XG5cblxuICAgICAgICAgICAgZmV0Y2godXJsLCB7IG1ldGhvZDogJ0dFVCcsIHNpZ25hbCB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSBcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09IFwic3VjY2Vzc1wiKSB7ICAvLyByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bGwgb3RoZXJ3aXNlIGRhdGEgd291bGQgYmUgXCJmYWxzZVwiXG4gICAgICAgICAgICAgICAgICAgIC8vIEVyZm9sZ3JlaWNoZSBSZWdpc3RyaWVydW5nXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGNsaWVudG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBzZXJ2ZXJpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gc2VydmVybmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGNsaWVudGlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBkYXRhLnRva2VuOyAvLyB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBjbGllbnQgdG9rZW4gaW4gb3JkZXIgdG8gY2hlY2sgYWdhaW5zdCBpdCBiZWZvcmUgcHJvY2Vzc2luZyBjcml0aWNhbCBhcGkgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gcGluO1xuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiBzdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBhdCAke3NlcnZlcm5hbWV9IEAgJHtzZXJ2ZXJpcH0gYXMgJHtjbGllbnRuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IGRhdGE7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9jcmVhdGUgZXhhbSBmb2xkZXIgaW4gd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgICAgICBsZXQgdW5pcXVlZXhhbU5hbWUgPSBgJHtzZXJ2ZXJuYW1lfS0ke3Bpbn1gXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5leGFtZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB1bmlxdWVleGFtTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbXBhcmUgdmVyc2lvbnMgYW5kIGRpc3BsYXkgbWVzc2FnZSAodGVhY2hlciBuZWVkcyB1cGdyYWRlLi4gY2xpZW50IG5lZWRzIHVwZ3JhZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wYXJpc29uUmVzdWx0ID0gdGhpcy5jb21wYXJlU29mdHdhcmUoY29uZmlnLnZlcnNpb24sIGNvbmZpZy5pbmZvICwgZGF0YS52ZXJzaW9uLCBkYXRhLnZlcnNpb25pbmZvICkgLy9zZXJ2ZXJWZXJzaW9uLCBzZXJ2ZXJTdGF0dXMsIGxvY2FsVmVyc2lvbiwgbG9jYWxTdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkgeyAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IG5ldWVyIGFscyBkaWUgZGVyIExlaHJwZXJzb24hXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHsgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgenUgYWx0LiBMYWRlbiBzaWUgc2ljaCBlaW5lIGFrdHVlbGxlIFZlcnNpb24gaGVydW50ZXIhXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbmJla2FubnRlciBGZWhsZXIgYmVpbSBWZXJiaW5kdW5nc2F1ZmJhdS5cIiB9OyAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGFzeW5jIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGZWhsZXJiZWhhbmRsdW5nXG4gICAgICAgICAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykgeyBlcnJvck1lc3NhZ2UgPSBcIlRoZSByZXF1ZXN0IHRpbWVkIG91dFwiOyAgIH0gLy8gVGltZW91dC1OYWNocmljaHQgYW5wYXNzZW4gXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIG9uIG1hY29zIHRoZSBwZXJtaXNzaW9uIHNldHRpbmdzIGluIHJhcmUgY2FzZXMgbWVzcyB1cCB0aGUgYWJpbGl0eSB0byBmZXRjaCB0aGUgdGVhY2hlciBhcGkgXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpeyAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHRoaXMuY29uZmlnLnNlcnZlckFwaVBvcnQpOyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlID09PSBcInJlc2V0XCIpIHsgICAvLyBxdWl0IHRoZSBhcHAgaWYgdGhlIHVzZXIgd2FudHMgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaWYgdGhlIHVzZXIgZG9lcyBub3Qgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVzIGdpYnQgZWluIFByb2JsZW0gbWl0IGRlbSBOZXR6d2VyaywgZGVuIEZpcmV3YWxscmVnZWxuIG9kZXIgZGVuIE5ldHp3ZXJrYmVyZWNodGlndW5nZW4hIEJpdHRlIGJlaGViZW4gc2llIGRpZXNlcyBQcm9ibGVtIHVuZCBzdGFydGVuIFNpZSBOZXh0LUV4YW0gbmV1IVwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICAgICAgICAgIHJldHVybjsgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIEdlb2dlYnJhIGFzIGdnYiBmaWxlIC0gYXMgYmFja3VwIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAsIGNvbnRlbnQ6IGJhc2U2NCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2F2ZUdHQicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGFyZ3MuY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBjb25zdCByZWFzb24gPSBhcmdzLnJlYXNvblxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzYXZlR0dCOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBCdWZmZXIuZnJvbShjb250ZW50LCAnYmFzZTY0Jyk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGdnYkZpbGVQYXRoLCBmaWxlRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXN0b3JlZFwiKSAsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycikgIFxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUdHQjogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGxvYWQgY29udGVudCBmcm9tIGdnYiBmaWxlIGFuZCBzZW5kIGl0IHRvIHRoZSBmcm9udGVuZCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgIH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdsb2FkR0dCJywgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBSZWFkIHRoZSBmaWxlIGFuZCBjb252ZXJ0IGl0IHRvIGJhc2U2NFxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKGdnYkZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlNjRHZ2JGaWxlID0gZmlsZURhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDpiYXNlNjRHZ2JGaWxlLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH0gICAgIFxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdFVCBQREYgb3IgSU1BR0UgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHBkZmFzeW5jJywgKGV2ZW50LCBmaWxlbmFtZSwgaW1hZ2UgPSBmYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGVcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlKXsgcmV0dXJuIGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpOyAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIGJhc2U2NCBzdHJpbmcgb2YgYXVkaW9maWxlIGZyb20gd29ya2RpcmVjdG9yeSBvciBwdWJsaWMgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0QXVkaW9GaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgcHVibGljZGlyPWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIik7XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmICFwdWJsaWNkaXIpIHsgLy8gUmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiBwdWJsaWNkaXIpIHtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uLy4uL3B1YmxpY1wiLGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBGSUxFLUxJU1QgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0ZmlsZXNhc3luYycsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIGF1ZGlvPWZhbHNlLCBkb2N4PWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJSZWNlaXZlZCBhcmd1bWVudHM6XCIsIGZpbGVuYW1lLCBhdWRpbywgZG9jeCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcblxuICAgICAgICAgICAgICAgIGlmIChhdWRpbyA9PSB0cnVlKXsgLy8gYXVkaW8gZmlsZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZG9jeCl7ICAvL29mZmljZSBvcGVuIHhtbCBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBtYW1tb3RoLmNvbnZlcnRUb0h0bWwoe3BhdGg6IGZpbGVwYXRofSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgIC8vYmFrIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAvLyByZXR1cm4gZmlsZSBsaXN0IG9mIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXsgZnMubWtkaXJTeW5jKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfSAvL2RvIG5vdCBjcmFzaCBpZiB0aGUgZGlyZWN0b3J5IGlzIGRlbGV0ZWQgYWZ0ZXIgdGhlIGFwcCBpcyBzdGFydGVkIF5eXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlbGlzdCA9ICBmcy5yZWFkZGlyU3luYyh3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgICAgICAgICAgICAgICBmaWxlbGlzdC5mb3JFYWNoKCBmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2RpZmllZCA9IGZzLnN0YXRTeW5jKCAgIHBhdGguam9pbih3b3JrZGlyLGZpbGUpICApLm10aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kID0gbW9kaWZpZWQuZ2V0VGltZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wZGZcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcInBkZlwiLCBtb2Q6IG1vZH0pICAgfSAgICAgICAgIC8vcGRmXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmJha1wiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYmFrXCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBiYWNrdXAgZmlsZSB0byByZXBsYWNlIGVkaXRvciBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmRvY3hcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImRvY3hcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGNvbnRlbnQgZmlsZSAoZnJvbSB0ZWFjaGVyKSB0byByZXBsYWNlIGNvbnRlbnQgYW5kIGNvbnRpbnVlIHdyaXRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2diXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJnZ2JcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGdlb2dlYnJhXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm1wM1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5vZ2dcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIud2F2XCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYXVkaW9cIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGF1ZGlvXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmpwZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wbmdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2lmXCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiaW1hZ2VcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgQkFDS1VQIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBmaWxlbmFtZSB3aXRob3V0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGJhY2t1cGZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFJlcXVlc3QgcmVjZWl2ZWQgZm9yIGZpbGVuYW1lOiAke2ZpbGVuYW1lfWApXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRnVsbCBmaWxlIHBhdGg6ICR7ZmlsZXBhdGh9YClcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZmlsZXBhdGgpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgbm90IGZvdW5kOiAke2ZpbGVwYXRofWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIGV4aXN0cywgcmVhZGluZyBjb250ZW50YClcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBTdWNjZXNzZnVsbHkgcmVhZCBiYWNrdXAgZmlsZSwgY29udGVudCBsZW5ndGg6ICR7ZGF0YS5sZW5ndGh9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciByZWFkaW5nIGJhY2t1cCBmaWxlOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHN0YWNrOiAke2Vyci5zdGFja31gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IG5vIGZpbGVuYW1lIHByb3ZpZGVkYCk7IFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpcGNNYWluLm9uKCdyZWxvYWQtdXJsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlRWFzdGVyV2luKClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBcHBlbmQgUHJpbnRSZXF1ZXN0IHRvIGNsaWVudGluZm8gIFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3NlbmRQcmludFJlcXVlc3QnLCAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gdHJ1ZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXQtY3B1LWluZm8nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5pc1ZpcnR1YWxNYWNoaW5lKClcbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXQtd2xhbi1pbmZvJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3bGFuSW5mbyA9IGF3YWl0IGdldFdsYW5JbmZvKCk7XG4gICAgICAgICAgICByZXR1cm4gd2xhbkluZm87XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgXG4gICAgICAgIC8vIE5ldyBoYW5kbGVyIHRvIGdldCBQREYgZnJvbSBwdWJsaWMgZGlyZWN0b3J5IGZvciBmcm9udGVuZCBwYXJzaW5nXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQZGZGcm9tUHVibGljJywgYXN5bmMgKGV2ZW50LCBwZGZGaWxlbmFtZSApID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IGRpcmVjdG9yeSBuYW1lIGluIEVTTVxuICAgICAgICAgICAgICAgIGNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHBkZlBhdGg7XG4gICAgICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgcGRmRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZyb20gc2NyaXB0cy8gZ28gdXAgMyBsZXZlbHMgdG8gcmVhY2ggc3R1ZGVudC8gdGhlbiBwdWJsaWMvXG4gICAgICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgcGRmRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGRmUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBQREYgbm90IGZvdW5kIGF0OiAke3BkZlBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGRmUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG4gICAgaXNWaXJ0dWFsTWFjaGluZSgpIHtcbiAgICAgICAgY29uc3QgVkVORE9SUyA9IC8ob3JhY2xlfHZpcnR1YWxib3h8dm13YXJlfGt2bXxxZW11fHhlbnxpbm5vdGVrfHBhcmFsbGVsc3xtaWNyb3NvZnR8aHlwZXItdnxiaHl2ZXxyZWQgaGF0fHJlZGhhdHxib2Noc3xiaHl2ZXxvcGVuc3RhY2t8Y2xvdWR8YW1hem9ufGdvb2dsZXxhenVyZSkvaSAvLyBjb21tb24gVk0gaWRzXG4gICAgICAgIGNvbnN0IHdhcm5BbmRSZXR1cm4gPSByZWFzb24gPT4ge1xuICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBpc1ZpcnR1YWxNYWNoaW5lOiBWZXJkYWNodCBhdWYgVk0gLSAke3JlYXNvbn1gKVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gTGludXggLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjcHVpbmZvID0gcmVhZEZpbGVTeW5jKCcvcHJvYy9jcHVpbmZvJywgJ3V0ZjgnKSAgICAgIC8vIENQVSBmbGFnc1xuICAgICAgICAgICAgaWYgKC9eZmxhZ3MuKlxcYmh5cGVydmlzb3JcXGIvbS50ZXN0KGNwdWluZm8pKSByZXR1cm4gd2FybkFuZFJldHVybignaHlwZXJ2aXNvciBmbGFnIGluIC9wcm9jL2NwdWluZm8nKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IFtcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3N5c192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF9uYW1lJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfdmVyc2lvbicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9ib2FyZF92ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYmlvc192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvY2hhc3Npc192ZW5kb3InXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBjb25zdCBkbWkgPSBmaWxlcy5tYXAocCA9PiB7IHRyeSB7IHJldHVybiByZWFkRmlsZVN5bmMocCwgJ3V0ZjgnKSB9IGNhdGNoIHsgcmV0dXJuICcnIH0gfSkuam9pbignICcpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGRtaSkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdETUktVmVuZG9yLU1hdGNoJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXhlY1N5bmMoJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgLXEnLCB7IHN0ZGlvOiAnaWdub3JlJyB9KSAgICAvLyBleGl0IDAgPT4gVk1cbiAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdzeXN0ZW1kLWRldGVjdC12aXJ0IG1lbGRldCBWaXJ0dWFsaXNpZXJ1bmcnKVxuICAgICAgICAgIH0gY2F0Y2gge31cblxuXG4gICAgICAgICAgLy8gUHJcdTAwRkNmZSBhdWYgUUVNVS1Qcm96ZXNzZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9IGV4ZWNTeW5jKCdwcyBhdXggfCBncmVwIC1pIHFlbXUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChwcy5pbmNsdWRlcygncWVtdScpICYmICFwcy5pbmNsdWRlcygnZ3JlcCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgbFx1MDBFNHVmdCcpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBXaW5kb3dzIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIihHZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW0gfCBGb3JFYWNoLU9iamVjdCB7ICRfLk1hbnVmYWN0dXJlciwgJF8uTW9kZWwgfSkgLWpvaW4gXFwnIFxcJ1wiJ1xuICAgICAgICAgICAgY29uc3QgYmFzaWMgPSBleGVjU3luYyhwcywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKSAgICAvLyBtYW51ZmFjdHVyZXIgKyBtb2RlbFxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChiYXNpYykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvTW9kZWxsIHBhc3N0IHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzUm9idXN0ID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJG89QCgpOycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbTskbys9QCgkY3MuTWFudWZhY3R1cmVyLCRjcy5Nb2RlbCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiYj1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQmFzZUJvYXJkOyRvKz1AKCRiYi5NYW51ZmFjdHVyZXIsJGJiLlByb2R1Y3QpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmlvcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQklPUzskbys9QCgkYmlvcy5TTUJJT1NCSU9TVmVyc2lvbil9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjc3A9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtUHJvZHVjdDskbys9QCgkY3NwLk5hbWUpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ1dyaXRlLU91dHB1dCAoKCRvIC1qb2luIFxcJyBcXCcpLlRyaW0oKSlcIidcbiAgICAgICAgICAgIGNvbnN0IHJvYnVzdCA9IGV4ZWNTeW5jKHBzUm9idXN0LCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHJvYnVzdCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvQklPUy1JbmZvcyBwYXNzZW4genUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICAvLyBadXNcdTAwRTR0emxpY2hlIFFFTVUtRXJrZW5udW5nIGZcdTAwRkNyIFdpbmRvd3NcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcWVtdVByb2Nlc3NlcyA9IGV4ZWNTeW5jKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgcWVtdSpcIicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgICAgIGlmIChxZW11UHJvY2Vzc2VzLmluY2x1ZGVzKCdxZW11JykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgdW50ZXIgV2luZG93cycpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuXG4gICAgICAgICAvLyAtLS0tLS0tLS0tIG1hY09TIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaHdNb2RlbCA9IGV4ZWNTeW5jKCdzeXNjdGwgLW4gaHcubW9kZWwnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmICgvXnZpcnR1YWwvaS50ZXN0KGh3TW9kZWwpIHx8IFZFTkRPUlMudGVzdChod01vZGVsKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIEhhcmR3YXJlbW9kZWxsIGRldXRldCBhdWYgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3AgPSBleGVjU3luYygnc3lzdGVtX3Byb2ZpbGVyIFNQSGFyZHdhcmVEYXRhVHlwZScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChzcCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBzeXN0ZW1fcHJvZmlsZXIgbWVsZGV0IFZNLVZlbmRvcicpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2UgICAgICAgXG4gICAgfVxuXG4gICAgY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQikge1xuICAgICAgICBjb25zdCBwYXJ0c0EgPSB2ZXJzaW9uQS5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgICAgICBjb25zdCBwYXJ0c0IgPSB2ZXJzaW9uQi5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWF4KHBhcnRzQS5sZW5ndGgsIHBhcnRzQi5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG51bUEgPSBwYXJ0c0FbaV0gfHwgMDsgLy8gRmFsbGJhY2sgYXVmIDAsIGZhbGxzIGtlaW4gV2VydCB2b3JoYW5kZW5cbiAgICAgICAgICAgIGNvbnN0IG51bUIgPSBwYXJ0c0JbaV0gfHwgMDtcbiAgICBcbiAgICAgICAgICAgIGlmIChudW1BIDwgbnVtQikgcmV0dXJuIC0xO1xuICAgICAgICAgICAgaWYgKG51bUEgPiBudW1CKSByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgXG4gICAgY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyQSA9IHBhcnNlSW50KHN0YXR1c0EubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgICAgIGNvbnN0IG51bWJlckIgPSBwYXJzZUludChzdGF0dXNCLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgIFxuICAgICAgICBpZiAobnVtYmVyQSA8IG51bWJlckIpIHJldHVybiAtMTtcbiAgICAgICAgaWYgKG51bWJlckEgPiBudW1iZXJCKSByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgY29tcGFyZVNvZnR3YXJlKHZlcnNpb25BLCBzdGF0dXNBLCB2ZXJzaW9uQiwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCB2ZXJzaW9uQ29tcGFyaXNvbiA9IHRoaXMuY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQik7XG4gICAgICAgIGlmICh2ZXJzaW9uQ29tcGFyaXNvbiAhPT0gMCkgcmV0dXJuIHZlcnNpb25Db21wYXJpc29uO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcy5jb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQik7XG4gICAgfVxuXG5cbn1cbiBcbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiIsICJpbXBvcnQge2NyZWF0ZUkxOG59IGZyb20gJ3Z1ZS1pMThuJ1xuXG5pbXBvcnQgZW4gZnJvbSAnLi9lbi5qc29uJ1xuaW1wb3J0IGRlIGZyb20gJy4vZGUuanNvbidcblxuY29uc3QgaTE4biA9IGNyZWF0ZUkxOG4oe1xuICAgIGxvY2FsZTogJ2RlJyxcbiAgICBmYWxsYmFja0xvY2FsZTogJ2VuJyxcbiAgICBtZXNzYWdlczoge1xuICAgICAgICBlbixcbiAgICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4biIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJSZXN0b3JlXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJEaXNjb25uZWN0XCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJFeGl0XCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiRXhhbXNcIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIlVzZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXIgYWRkcmVzc1wiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJFeGFtIE5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcInJlZ2lzdGVyXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJyZWdpc3RlcmluZy4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJyZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiZGlzY29ubmVjdGVkXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXIhIFxcblxcblBsZWFzZSB3YWl0IGZvciB0aGUgYWN0aXZhdGlvbiBvZiB0aGUgZXhhbSBtb2RlIGJ5IHRoZSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJzZWFyY2ggc3RhcnRlZFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJ3cm9uZyB1c2VybmFtZSBvciBwaW5cIixcbiAgICAgICAgXCJub3VzZXJcIjpcIm5vIHVzZXJuYW1lIGdpdmVuXCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkZHJlc3NlIG9kZXIgRXhhbW5hbWUgbWlzc2luZ1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJObyBOZXR3b3JrIENvbm5lY3Rpb25cIixcbiAgICAgICAgXCJub3BpblwiOiBcIm5vIHBpbmNvZGUgZ2l2ZW5cIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOlwiU2VydmVyIEFQSSB1bnJlYWNoYWJsZVwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBpcyBiZWhpbmQgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJObyBUZWFjaGVyIEFQSSBmb3VuZCBvbiB0aGUgZ2l2ZW4gYWRkcmVzc1wiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxvY2FsIGxvY2tkb3duXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51YWwgc2VhcmNoXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiTm8gZXhhbXMgZm91bmRcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBsb2dvdXQ/XCIsXG4gICAgICAgIFwiZGVcIjogXCJHZXJtYW5cIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyZW5jaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWFuXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3ZlbmlhblwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFjdGl2YXRlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJQbGVhc2UgY2hvb3NlIGEgbGFuZ3VhZ2VcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiTGFuZ3VhZ2VzXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWNzXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJTZWxlY3QgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiUGxlYXNlIGluc3RhbGwgdGhlIHNhbWUgdmVyc2lvbiBhcyB0aGUgZXhhbSBzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwic2FmZSBleGFtIHN0YXR1cyBjaGFuZ2VkXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJzdGFydGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcInN0b3BwZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJzYWZlIGV4YW0gbW9kZSBub3QgYWN0aXZlXCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJzdHVkZW50IHJlbW92ZWQgZnJvbSBzZXJ2ZXJcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJmaWxlcyBzdG9yZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcImZpbGUgZXJyb3JcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwicGxlYXNlIGNoZWNrIGlmIHRoZSAnRVhBTS1TVFVERU5UJyBkaXJlY3RvcnkgaXMgd3JpdGVhYmxlIGFuZCBoYXMgZW5vdWdoIHNwYWNlXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJBIGxvY2FsIGJhY2t1cCBjb3VsZCBub3QgYmUgY3JlYXRlZC4gUGxlYXNlIHVzZSB0aGUgbWFudWFsIHN1Ym1pc3Npb24gb3B0aW9uLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiZG9uJ3Qgc2hvdyBhZ2FpblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZm91bmRcIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJHZXQgbWF0ZXJpYWxzXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIlNlbmQgZmluYWwgZXhhbVwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiRmluYWwgc3VibWl0XCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxzOlwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2NhbCBmaWxlczpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJVcGRhdGVcIixcbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGxpdHZpZXdcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJZb3UgaGF2ZSBsZWZ0IHRoZSBzYWZlIGV4YW0gbW9kZSFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIlBsZWFzZSBpbmZvcm0gYSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIkRvIHlvdSB3YW50IHRvIHJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhlIGVkaXRvciB3aXRoIHRoZSBjb250ZW50IG9mIFwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcIj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkNhbmNlbFwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlJlcGxhY2VcIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cCBmaWxlIGNvdWxkIG5vdCBiZSByZWFkXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIHN1Y2Nlc3NmdWxseSBsb2FkZWRcIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkVycm9yIGxvYWRpbmcgYmFja3VwIGZpbGVcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIlN1Y2Nlc3NcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcImNoYXJzXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJ3b3Jkc1wiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcInJlY29ubmVjdFwiLFxuICAgICAgICBcInVubG9ja1wiOiBcInVubG9ja1wiLFxuICAgICAgICBcImV4aXRcIjogXCJFeGl0IHNhZmUgZXhhbSBtb2RlP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkRvIG5vdCBsZWF2ZSBzYWZlIGV4YW0gbW9kZSB3aXRob3V0IHBlcm1pc3Npb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIklmIHRoaXMgcHJvY2VzcyBmYWlscyB1bmxvY2sgYW5kIHRyeSBhZ2FpbiFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIkNyZWF0aW5nIGJhY2t1cFwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkNyZWF0aW5nIGJhY2t1cCBhbmQgY2xpcGJvYXJkIGNvcHlcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiTGVhdmluZyBFeGFtIG1vZGVcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJiYWNrdXBcIixcbiAgICAgICAgXCJ1bmRvXCI6XCJ1bmRvXCIsXG4gICAgICAgIFwicmVkb1wiOlwicmVkb1wiLFxuICAgICAgICBcImNsZWFyXCI6XCJjbGVhclwiLFxuICAgICAgICBcImJvbGRcIjpcImJvbGRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcIml0YWxpY1wiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW5kZXJsaW5lXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcImhlYWRpbmcxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcImhlYWRpbmcyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcImhlYWRpbmczXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcImhlYWRpbmc0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcImhlYWRpbmc1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcImhlYWRpbmc2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJzdWJzY3JpcHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwic3VwZXJzY3JpcHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJidWxsZXRsaXN0XCIsXG4gICAgICAgIFwibGlzdFwiOlwibGlzdFwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiY29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiY29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcImJsb2NrcXVvdGVcIixcbiAgICAgICAgXCJsaW5lXCI6XCJwYWdlYnJlYWtcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJsZWZ0XCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJjZW50ZXJcIixcbiAgICAgICAgXCJyaWdodFwiOlwicmlnaHRcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcInRleHRjb2xvclwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwibGluZWJyZWFrXCIsXG4gICAgICAgIFwibW9yZVwiOlwibW9yZVwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJpbnNlcnR0YWJsZVwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJkZWxldGV0YWJsZVwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJjb2x1bW5hZnRlclwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJyb3dhZnRlclwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiZGVsY29sdW1uXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJkZWxyb3dcIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIm1lcmdlb3JzcGxpdFwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiaGVhZGVyY29sdW1uXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJoZWFkZXJyb3dcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwic2VsZWN0ZWQgd29yZHMvY2hhcnNcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwicHJpbnQgcmVxdWVzdCBzZW50XCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwicHJpbnQgcmVxdWVzdCBkZW5pZWRcIixcbiAgICAgICAgXCJwYXN0ZVwiOlwicGFzdGVcIixcbiAgICAgICAgXCJjb3B5XCI6XCJjb3B5XCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcInNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcImRlYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIlJlbG9hZFwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb3VsZCB5b3UgbGlrZSB0byByZWluaXRpYWxpemUgdGhlIEVkaXRvcj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwia2VlcCBjb250ZW50XCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIkluc2VydCBzcGVjaWFsY2hhcmFjdGVyXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiUGxheSBBdWRpb1wiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIkRvIHlvdSB3YW50IHRvIHBsYXkgdGhlIGF1ZGlvZmlsZT9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiUmVtYWluaW5nIHBsYXliYWNrczpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIllvdSBkb24ndCBoYXZlIHRoZSBwZXJtaXNzaW9uIHRvIHBsYXkgdGhpcyBmaWxlIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiSW5zZXJ0IEltYWdlXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJJbnNlcnQgTXVnc2hvdFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIlNlbmQgd29yayB0byB0ZWFjaGVyXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiQ2xvc2VcIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJFeGl0IHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJGaWxlbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIlBsZWFzZSBlbnRlciBvbmx5IGxldHRlcnMgYW5kIG51bWJlcnMgd2l0aG91dCBzcGVjaWFsIGNoYXJhY3RlcnNcIixcbiAgICAgICAgXCJjbGVhclwiOiBcImNsZWFyIGNvbnRlbnQ/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJObyB2YWxpZCBQREYgRmlsZVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJXcm9uZyBwYXNzd29yZFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJSZWxvYWQgd2Vidmlld1wiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJXaWVkZXJoZXJzdGVsbGVuXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJWZXJiaW5kdW5nIHRyZW5uZW5cIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkJlZW5kZW5cIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiQmVudXR6ZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXItQWRyZXNzZVwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiZm9ydGdlc2Nocml0dGVuXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwiZWluZmFjaFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwibWVsZGUgYW4uLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiYW5nZW1lbGRldFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcIlZlcmJpbmR1bmcgdW50ZXJicm9jaGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTaWUgaGFiZW4gc2ljaCBlcmZvbGdyZWljaCBhbSBTZXJ2ZXIgcmVnaXN0cmllcnQhIFxcblxcbkJpdHRlIHdhcnRlbiBTaWUgYXVmIGRpZSBBa3RpdmllcnVuZyBkZXMgUHJcdTAwRkNmdW5nc21vZHVzIGR1cmNoIGRpZSBMZWhycGVyc29uIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJTdWNoZSBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJub3B3XCI6IFwiRmFsc2NoZXIgQmVudXR6ZXJuYW1lIG9kZXIgUGluY29kZVwiLFxuICAgICAgICBcIm5vdXNlclwiOiBcIkJlbnV0emVybmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZHJlc3NlIG9kZXIgUHJcdTAwRkNmdW5nc25hbWUgZmVobHRcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiS2VpbmUgTmV0endlcmt2ZXJiaW5kdW5nXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJQaW5jb2RlIGZlaGx0XCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjogXCJTZXJ2ZXIgQVBJIG5pY2h0IGVycmVpY2hiYXIuXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGJlZmluZGV0IHNpY2ggbVx1MDBGNmdsaWNoZXJ3ZWlzZSBoaW50ZXIgZWluZXIgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJLZWluZSBQclx1MDBGQ2Z1bmdzc2VydmVyIGFuIGFuZ2VnZWJlbmVyIEFkcmVzc2VcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2thbCBhYnNwZXJyZW5cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVlbGwgc3VjaGVuXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiS2VpbmUgUHJcdTAwRkNmdW5nZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgc2ljaCBhYm1lbGRlbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJhbmRlcmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWliaGlsZmVcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJWb3JzY2hsXHUwMEU0Z2UgemVpZ2VuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFNwcmFjaGUgZlx1MDBGQ3IgZGllIFByXHUwMEZDZnVuZ1wiLFxuICAgICAgICBcImxhbmdcIjogXCJTcHJhY2hlblwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGlrXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJQclx1MDBGQ2Z1bmdzbW9kdXMgYXVzd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJCaXR0ZSBpbnN0YWxsaWVyZW4gc2llIGRpZSBzZWxiZSBWZXJzaW9uIHdpZSBhbSBQclx1MDBGQ2Z1bmdzc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCBnXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIGdlXHUwMEU0bmRlcnRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiB1bnRlciBkaWVzZW0gTmFtZW4gYmVyZWl0cyBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgbmljaHQgYWt0aXZcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBlbnRmZXJudFwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcIkRhdGVpZW4gZ2VzcGVpY2hlcnRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBTY2hyZWliZW4gZGVyIERhdGVpXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcIkJpdHRlIHN0ZWxsZW4gU2llIHNpY2hlciwgZGFzcyBkYXMgJ0VYQU0tU1RVREVOVCcgVmVyemVpY2huaXMgZlx1MDBGQ3IgTmV4dC1FeGFtIHNjaHJlaWJiYXIgaXN0IHVuZCBnZW5cdTAwRkNnZW5kIFNwZWljaGVycGxhdHogdm9yaGFuZGVuIGlzdC5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkVpbmUgbG9rYWxlIFNpY2hlcnVuZyBrb25udGUgbmljaHQgZXJzdGVsbHQgd2VyZGVuLiBOdXR6ZW4gU2llIGRpZSBtYW51ZWxsZSBBYmdhYmUgdW0gSWhyZSBBcmJlaXQgZGlyZWt0IGFuIGRpZSBMZWhycGVyc29uIHp1IHNlbmRlbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcIk5pY2h0IG1laHIgYW56ZWlnZW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGdlZnVuZGVuXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW4gaG9sZW5cIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiRmluYWxlIEFiZ2FiZSBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiQWJnYWJlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW46XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiQWt0dWFsaXNpZXJlblwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2thbGUgRGF0ZWllbjpcIixcblxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwYWx0ZW5hbnNpY2h0XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiU2llIGhhYmVuIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHZlcmxhc3NlbiFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIk1lbGRlbiBTaWUgc2ljaCB1bWdlaGVuZCBiZWkgZGVyIEF1ZnNpY2h0c3BlcnNvbiFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJXb2xsZW4gU2llIGRlbiBJbmhhbHQgZGVzIEVkaXRvcnMgZHVyY2ggZGVuIEluaGFsdCBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCJlcnNldHplbj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkFiYnJlY2hlblwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIkVyc2V0emVuXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAtRGF0ZWkga29ubnRlIG5pY2h0IGdlbGVzZW4gd2VyZGVuXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIGVyZm9sZ3JlaWNoIGdlbGFkZW5cIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkZlaGxlciBiZWltIExhZGVuIGRlciBCYWNrdXAtRGF0ZWlcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJFcmZvbGdcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcIlplaWNoZW5cIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIldcdTAwRjZydGVyXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwibmV1IHZlcmJpbmRlblwiLFxuICAgICAgICBcInVubG9ja1wiOiBcImVudHNwZXJyZW5cIixcbiAgICAgICAgXCJleGl0XCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIlZlcmxhc3NlbiBTaWUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgbmllIG9obmUgRnJlaWdhYmUgZWluZXIgTGVocnBlcnNvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiU29sbHRlIGRlciBWb3JnYW5nIGZlaGxzY2hsYWdlbiBiZWVuZGVuIFNpZSBiaXR0ZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB1bmQgdmVyc3VjaGVuIFNpZSBlcyBlcm5ldXQhXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJJaHJlIEFyYmVpdCB3dXJkZSBlcmZvbGdyZWljaCBnZXNpY2hlcnQhXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiRGllIGFrdHVlbGxlIEFyYmVpdCB3aXJkIGdlc2ljaGVydCB1bmQgaW4gZGllIFp3aXNjaGVuYWJsYWdlIGtvcGllcnQhXCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcInNpY2hlcm5cIixcbiAgICAgICAgXCJ1bmRvXCI6XCJyXHUwMEZDY2tnXHUwMEU0bmdpZ1wiLFxuICAgICAgICBcInJlZG9cIjpcIndpZWRlcmhvbGVuXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImJvbGRcIjpcImZldHRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcImt1cnNpdlwiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW50ZXJzdHJpY2hlblwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiXHUwMERDYmVyc2NocmlmdCAyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiXHUwMERDYmVyc2NocmlmdCA1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwidGllZmdlc3RlbGx0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcImhvY2hnZXN0ZWxsdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcInVuZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwibGlzdFwiOlwiZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJDb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJDb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiWml0YXRcIixcbiAgICAgICAgXCJsaW5lXCI6XCJTZWl0ZW51bWJydWNoXCIsXG4gICAgICAgIFwibGVmdFwiOlwiTGlua3NiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcImNlbnRlclwiOlwiWmVudHJpZXJ0XCIsXG4gICAgICAgIFwicmlnaHRcIjpcIlJlY2h0c2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJUZXh0ZmFyYmVcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcIlplaWxlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtZWhyXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcIlRhYmVsbGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJUYWJlbGxlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJTcGFsdGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJSZWloZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJTcGFsdGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJSZWloZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIlZlcmVpbmVuIG9kZXIgVGVpbGVuXCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJUaXRlbHNwYWx0ZVwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiVGl0ZWxyZWloZVwiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJXXHUwMEY2cnRlci9aZWljaGVuIGluIEF1c3dhaGxcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwiRHJ1Y2thbmZyYWdlIGdlc2VuZGV0IVwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcIkRydWNrYW5mcmFnZSBhYmdlbGVobnQuIEJpdHRlIHdhcnRlbiB1bmQgZXJuZXV0IHNlbmRlbi5cIixcbiAgICAgICAgXCJwYXN0ZVwiOlwiZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImNvcHlcIjpcImtvcGllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgZGVha3RpdmllcmVuXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiTmV1IGxhZGVuXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvbGxlbiBTaWUgZGVuIFRleHRlZGl0b3IgbmV1IGluaXRpYWxpc2llcmVuP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJJbmhhbHQgYmVpYmVoYWx0ZW5cIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiU29uZGVyemVpY2hlbiBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJkcnVja2VuXCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJBdWRpbyBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJXb2xsZW4gU2llIGRhcyBIXHUwMEY2cmJlaXNwaWVsIGpldHp0IGFic3BpZWxlbj9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiVmVyYmxlaWJlbmRlIER1cmNobFx1MDBFNHVmZTpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIlNpZSBoYWJlbiBrZWluZSBCZXJlY2h0aWd1bmcgZGllIEF1ZGlvZGF0ZWkgZXJuZXV0IGFienVzcGllbGVuIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiQmlsZCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJNdWdzaG90IGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJBcmJlaXQgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJTY2hsaWVcdTAwREZlblwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkRhdGVpbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBudXIgQnVjaHN0YWJlbiBvZGVyIFphaGxlbiBlaW4uXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJBbGxlIEJlcmVjaG51bmdlbiBsXHUwMEY2c2NoZW4/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgZ1x1MDBGQ2x0aWdlIFBERiBEYXRlaVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJGYWxzY2hlcyBQYXNzd29ydFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJXZWJ2aWV3IG5ldSBsYWRlblwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiTVx1MDBGNmdsaWNoZXJ3ZWlzZSBnZXNjYW5udGVzIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJBdWZcIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcInd1cmRlbiB3ZW5pZ2VyIGFscyAyIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGdlZnVuZGVuLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIkRpZXMgZGV1dGV0IGRhcmF1ZiBoaW4sIGRhc3MgZXMgc2ljaCB1bSBlaW4gZ2VzY2FubnRlcyBQREYgaGFuZGVsdCwgZGFzIGtlaW5lIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgb2RlciBUYWJlbGxlbiBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlZlcnN0YW5kZW5cIixcbiAgICAgICAgXCJwYWdlXCI6IFwiU2VpdGVcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlNlaXRlblwiXG4gICAgfVxufVxuIiwgImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cbmxldCBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9MYW5ndWFnZVRvb2wvbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInKVxuaWYgKGFwcC5pc1BhY2thZ2VkKSB7IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljL0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpIH1cblxubGV0IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL0xhbmd1YWdlVG9vbC9zZXJ2ZXIucHJvcGVydGllcycpXG5pZiAoYXBwLmlzUGFja2FnZWQpIHsgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMvTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJykgfVxuXG5cblxuXG5cbmNsYXNzIExhbmd1YWdlVG9vbFNlcnZlciB7XG4gICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDsgLy8gSW5pdGlhbGlzaWVydCBkaWUgUHJvemVzc3ZhcmlhYmxlXG4gICAgICAgICB0aGlzLnBvcnQgPSA4MDg4XG4gICAgIH1cbiBcbiAgICAgc3RhcnRTZXJ2ZXIoKSB7XG4gICAgICAgICBpZiAodGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzICYmICF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGlzIGFscmVhZHkgcnVubmluZy4nKTtcbiAgICAgICAgICAgICByZXR1cm47IC8vIFZlcmhpbmRlcnQgZGFzIGVybmV1dGUgU3RhcnRlbiwgd2VubiBkZXIgU2VydmVyIGJlcmVpdHMgbFx1MDBFNHVmdFxuICAgICAgICAgfVxuICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IEpyZUhhbmRsZXIualNwYXduKFxuICAgICAgICAgICAgICAgIFtsYW5ndWFnZVRvb2xKYXJQYXRoXSwgLy8gS2xhc3NlbnBmYWRcbiAgICAgICAgICAgICAgICAnb3JnLmxhbmd1YWdldG9vbC5zZXJ2ZXIuSFRUUFNlcnZlcicsIC8vIEhhdXB0a2xhc3NlIGRlciBMYW5ndWFnZVRvb2wgQVBJXG4gICAgICAgICAgICAgICAgWyctLXBvcnQnLCB0aGlzLnBvcnQsJy0tY29uZmlnJyxsYW5ndWFnZVRvb2xDb25maWdQYXRoLCAnLS1hbGxvdy1vcmlnaW4nLCBcIicqJ1wiIF0gLy8gWnVzXHUwMEU0dHpsaWNoZSBBcmd1bWVudGUsIHouQi4gUG9ydCB1bmQgQ09SUy1FcmxhdWJuaXNcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKCB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MpXG4gICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBBUEkgcnVubmluZyBhdCBsb2NhbGhvc3Q6ODA4OCcpO1xuXG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZGF0YTogUmVjZWl2ZWQgZGF0YSBmcm9tIExhbmd1YWdlVG9vbCBBUEknLCBkYXRhLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2Vycm9yJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWVycm9yOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc3RhcnRpbmcnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NoZWNrIGRvbmUnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2hhbmRsZWQgcmVxdWVzdCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICAvLyBBY2N1bXVsYXRlIHN0ZGVyciBkYXRhIHRvIGhhbmRsZSBjaHVua2VkIG91dHB1dFxuICAgICAgICAgICAgbGV0IHN0ZGVyckJ1ZmZlciA9ICcnO1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZGVyci5vbignZGF0YScsIGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciArPSBjaHVuaztcbiAgICAgICAgICAgICAgICBjb25zdCBwb3J0U3RyID0gU3RyaW5nKHRoaXMucG9ydCk7XG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgYm90aCBjdXJyZW50IGNodW5rIGFuZCBhY2N1bXVsYXRlZCBidWZmZXIgZm9yIHBvcnQtcmVsYXRlZCBlcnJvcnNcbiAgICAgICAgICAgICAgICBjb25zdCBmdWxsUmVzcG9uc2UgPSBzdGRlcnJCdWZmZXI7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNQb3J0RXJyb3IgPSBmdWxsUmVzcG9uc2UuaW5jbHVkZXMocG9ydFN0cikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIkFkcmVzc2Ugd2lyZCBiZXJlaXRzIHZlcndlbmRldFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiTWF5YmUgc29tZXRoaW5nIGVsc2UgaXMgcnVubmluZyBvbiB0aGF0IHBvcnRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIkFkZHJlc3MgYWxyZWFkeSBpbiB1c2VcIik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGlzUG9ydEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogYW5vdGhlciBMYW5ndWFnZVRvb2wgc2VydmVyIGlzIHByb2JhYmx5IGFscmVhZHkgcnVubmluZyBvbiBwb3J0OicsIHRoaXMucG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNodW5rLmluY2x1ZGVzKCdcXG4nKSB8fCBmdWxsUmVzcG9uc2UubGVuZ3RoID4gMjAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiB3ZSBoYXZlIGEgbmV3bGluZSAobGlrZWx5IGNvbXBsZXRlIG1lc3NhZ2UpIG9yIGJ1ZmZlciBpcyBnZXR0aW5nIGxhcmdlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZGF0YS1lcnJvcjonLCBmdWxsUmVzcG9uc2UudHJpbSgpKTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBsb2dnaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mub24oJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDsgLy8gU2V0enQgZGVuIFByb3plc3MgenVyXHUwMEZDY2ssIHdlbm4gZXIgYmVlbmRldCB3aXJkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBnZW5lcmFsLWVycm9yOicsIGVycik7XG4gICAgICAgIH1cblxuXG4gICAgIH1cblxuICAgICBzdG9wU2VydmVyKCkge1xuICAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHNlcnZlciB3YXMgbmV2ZXIgc3RhcnRlZFxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MpIHtcbiAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciB3YXMgbmV2ZXIgc3RhcnRlZCwgbm90aGluZyB0byBzdG9wJyk7XG4gICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgfVxuXG4gICAgICAgICAvLyBGaXJzdCB0cnkgdG8ga2lsbCB0aGUgcHJvY2VzcyBkaXJlY3RseSBpZiB3ZSBoYXZlIGEgcmVmZXJlbmNlXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbCgpO1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBwcm9jZXNzIGtpbGxlZCcpO1xuICAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBmYWlsZWQgdG8ga2lsbCBwcm9jZXNzIGRpcmVjdGx5LCB0cnlpbmcgcGxhdGZvcm0tc3BlY2lmaWMgbWV0aG9kOicsIGVycik7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICAvLyBGYWxsYmFjazogdXNlIHBsYXRmb3JtLXNwZWNpZmljIGNvbW1hbmRzIHRvIGtpbGwgdGhlIHByb2Nlc3MgKG9ubHkgaWYgd2UgaGFkIGEgcHJvY2VzcyByZWZlcmVuY2UpXG4gICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgICBsZXQgY29tbWFuZDtcblxuICAgICAgICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICAgLy8gV2luZG93czogZmluZCBhbmQga2lsbCBqYXZhIHByb2Nlc3NlcyBydW5uaW5nIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyXG4gICAgICAgICAgICAgLy8gRmlyc3QgdHJ5IHdtaWMgKHdvcmtzIG9uIG9sZGVyIFdpbmRvd3MpLCB0aGVuIHRyeSBQb3dlclNoZWxsLCB0aGVuIGZhbGxiYWNrIHRvIHBvcnQtYmFzZWQga2lsbFxuICAgICAgICAgICAgIGNvbW1hbmQgPSBgd21pYyBwcm9jZXNzIHdoZXJlIFwiY29tbWFuZGxpbmUgbGlrZSAnJWxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJSdcIiBkZWxldGUgMj5udWwgfHwgcG93ZXJzaGVsbCAtQ29tbWFuZCBcIkdldC1Qcm9jZXNzIGphdmEgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyRfLkNvbW1hbmRMaW5lIC1saWtlICcqbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIqJ30gfCBTdG9wLVByb2Nlc3MgLUZvcmNlXCIgMj5udWwgfHwgZm9yIC9mIFwidG9rZW5zPTVcIiAlYSBpbiAoJ25ldHN0YXQgLWFubyBefCBmaW5kc3RyIDo4MDg4JykgZG8gdGFza2tpbGwgL0YgL1BJRCAlYSAyPm51bGA7XG4gICAgICAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJyB8fCBwbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgICAgIC8vIG1hY09TIGFuZCBMaW51eDogdXNlIHBraWxsIHRvIGtpbGwgcHJvY2Vzc2VzIG1hdGNoaW5nIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyXG4gICAgICAgICAgICAgY29tbWFuZCA9ICdwa2lsbCAtZiBsYW5ndWFnZXRvb2wtc2VydmVyLmphcic7XG4gICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiB1bnN1cHBvcnRlZCBwbGF0Zm9ybTonLCBwbGF0Zm9ybSk7XG4gICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgfVxuXG4gICAgICAgICBleGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgLy8gSXQncyBva2F5IGlmIHRoZSBwcm9jZXNzIGlzIG5vdCBmb3VuZCAoYWxyZWFkeSBraWxsZWQpXG4gICAgICAgICAgICAgICAgIC8vIHBraWxsIHJldHVybnMgY29kZSAxIHdoZW4gbm8gcHJvY2VzcyBpcyBmb3VuZCwgd2hpY2ggaXMgZXhwZWN0ZWRcbiAgICAgICAgICAgICAgICAgaWYgKGVycm9yLmNvZGUgIT09IDEgJiYgIWVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ25vdCBmb3VuZCcpICYmICFzdGRlcnIudG9TdHJpbmcoKS5pbmNsdWRlcygnTm8gc3VjaCBwcm9jZXNzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBlcnJvciBraWxsaW5nIExhbmd1YWdlVG9vbCBzZXJ2ZXI6JywgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBwcm9jZXNzIG5vdCBmb3VuZCAobWF5IGFscmVhZHkgYmUgc3RvcHBlZCknKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHN0b3BwZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICB9KTtcbiAgICAgfVxuIH1cblxuXG5cblxuXG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IExhbmd1YWdlVG9vbFNlcnZlcigpXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgcHJvY2VzcyBmcm9tICdwcm9jZXNzJztcbmltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuIC8vIGV2ZXJ5IHBsYXRmb3JtIG5lZWRzIGl0J3Mgb3duIGpyZSAobGludXgsIHdpbjMyLCBkYXJ3aW4pIC8vZml4bWU6IHVzZSBHcmFhbFZNIHRvIHByZWNvbXBpbGUgbGFuZ3VhZ2V0b29sIGluIG9yZGVyIHRvIHNhdmUgc3BhY2UgYW5kIGdldCByaWQgb2YganJlP1xuY2xhc3MgSnJlSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkgeyB9XG5cbiAgICBpbml0KCl7IFxuICAgICAgICB0aGlzLmpUZXN0KClcbiAgICB9XG5cblxuICAgIGpUZXN0KCl7XG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKCk7IC8vICcvcGZhZC96dXIvamF2YSdcbiAgICAgICAgY29uc3QgcHJvYyA9IHNwYXduKGphdmFwYXRoLCBbJy12ZXJzaW9uJ10pO1xuICAgIFxuICAgICAgICBwcm9jLnN0ZGVyci5vbignZGF0YScsIGRhdGEgPT4ge1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBkYXRhLnRvU3RyaW5nKCkuc3BsaXQoJ1xcbicpOyAvLyBpbiBaZWlsZW4gc3BsaXR0ZW5cbiAgICAgICAgICAgIGxvZy5kZWJ1ZyhganJlLWhhbmRsZXIgQCBqVGVzdDogJHtsaW5lc1swXX1gKTsgLy8gbnVyIGRpZSBlcnN0ZSBaZWlsZSBsb2dnZW5cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGZhaWwocmVhc29uKSB7XG4gICAgICAgIGxvZy5lcnJvcihyZWFzb24pO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuXG4gICAgZ2V0RGlyZWN0b3JpZXMoZGlyUGF0aCkge1xuICAgICAgICBsZXQgZGlycyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpLmZpbHRlcihcbiAgICAgICAgICAgIGZpbGUgPT4gZnMuc3RhdFN5bmMocGF0aC5qb2luKGRpclBhdGgsIGZpbGUpKS5pc0RpcmVjdG9yeSgpXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBkaXJzXG4gICAgfSBcblxuICAgIGRyaXZlcigpe1xuICAgICAgICB2YXIgZCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5qYXZhQmluLnNsaWNlKCk7XG4gICAgICAgIGQudW5zaGlmdChwbGF0Zm9ybURpc3BhdGNoZXIuanJlRGlyKTtcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbi5hcHBseShwYXRoLCBkKTtcbiAgICB9XG5cbiAgICBnZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIGFyZ3MgPSAoYXJncyB8fCBbXSkuc2xpY2UoKTtcbiAgICAgICAgY2xhc3NwYXRoID0gY2xhc3NwYXRoIHx8IFtdO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NuYW1lKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzcGF0aC5qb2luKHRoaXMuX3BsYXRmb3JtID09PSAnd2luMzInID8gJzsnIDogJzonKSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdCgnLWNwJyk7XG4gICAgICAgIHJldHVybiBhcmdzO1xuICAgIH1cblxuICAgIGpTcGF3bihjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKVxuICAgICAgICBsZXQgamF2YWFyZ3MgPSB0aGlzLmdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpXG4gICAgICAgIGxldCBqYXZhY21kbGluZSA9ICBgJHtqYXZhcGF0aH0gJHtqYXZhYXJncy5qb2luKCcgJyl9IGBcblxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246ICcke3BsYXRmb3JtRGlzcGF0Y2hlci5qcmV9JyBzZWxlY3RlZGApXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogc3Bhd25pbmcgamF2YSBwcm9jZXNzOiAke2phdmFjbWRsaW5lfWApXG4gICAgICAgIHJldHVybiBzcGF3bihqYXZhcGF0aCwgamF2YWFyZ3MsIHtzaGVsbDpmYWxzZX0pO1xuICAgICAgIC8vIHJldHVybiBzcGF3bihqYXZhY21kbGluZSk7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBKcmVIYW5kbGVyKClcbiIsICIvLyBzY3JpcHRzL1N5c3RlbVRyYXlNYW5hZ2VyLmpzXG5pbXBvcnQgeyBhcHAsIFRyYXksIE1lbnUgfSBmcm9tICdlbGVjdHJvbic7IFxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7IC8vIFBhdGggbW9kdWxlIGltcG9ydFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnOyAvLyBMb2dnaW5nIG1vZHVsZVxuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJzsgLy8gV2luZG93IG1hbmFnZXJcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJzsgLy8gQ29tbXVuaWNhdGlvbiBsb2dpY1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyc7IC8vIEkxOG4gaW5zdGFuY2VcblxuXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IC8vIEdldCBjdXJyZW50IGRpcmVjdG9yeVxuXG5sZXQgdHJheSA9IG51bGw7IC8vIFByaXZhdGUgdHJheSBpbnN0YW5jZVxuXG4vLyBQYXRoIHRvIHRoZSBhcHAgaWNvblxuY29uc3QgaWNvblBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zJywnaWNvbjI0eDI0LnBuZycpOyBcblxuLy8gPT09IHJlcGxhY2UgdGhlIGhlbHBlciBzZXRMb2NhbGUgKGV4YWN0IGJsb2NrKSA9PT1cbmNvbnN0IHNldExvY2FsZSA9IChsb2MpID0+IHtcbiAgICBjb25zdCBnbCA9IGkxOG4uZ2xvYmFsOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IGdsb2JhbCBjb21wb3NlclxuICAgIGlmIChnbCAmJiB0eXBlb2YgZ2wubG9jYWxlID09PSAnb2JqZWN0JyAmJiBnbC5sb2NhbGUpIHtcbiAgICAgIC8vIHZ1ZS1pMThuIGNvbXBvc2l0aW9uIG1vZGVcbiAgICAgIGlmICgndmFsdWUnIGluIGdsLmxvY2FsZSkgZ2wubG9jYWxlLnZhbHVlID0gbG9jOyAgICAgLy8gc2V0IHJlYWN0aXZlIHZhbHVlXG4gICAgICBlbHNlIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGxiYWNrXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGxlZ2FjeSBtb2RlIG9yIHBsYWluIHN0cmluZ1xuICAgICAgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gc3RyaW5nIGxvY2FsZVxuICAgIH1cbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICBcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgdHJheSBpY29uIGlmIGl0IGRvZXNuJ3QgZXhpc3QgYW5kIHVwZGF0ZXMgaXRzIGNvbnRleHQgbWVudS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbmV3IGxvY2FsZSB0byBhcHBseS5cbiAqL1xuXG5cblxuZXhwb3J0IGNvbnN0IHVwZGF0ZVN5c3RlbVRyYXkgPSAobG9jYWxlKSA9PiB7XG4gICAgc2V0TG9jYWxlKGxvY2FsZSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCB0ID0gKGspID0+IGkxOG4uZ2xvYmFsLnQoayk7ICAgICAgICAgICAgICAgICAgICAgIC8vIGFsd2F5cyByZXNvbHZlIGxpdmVcbiAgXG4gICAgaWYgKCF0cmF5KSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJheSBvbmNlXG4gICAgICB0cmF5ID0gbmV3IFRyYXkoaWNvblBhdGgpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJheSBpY29uXG4gICAgICB0cmF5Lm9uKCdjbGljaycsICgpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2dnbGUgd2luZG93XG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSBcbiAgICAgICAgICA/IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5oaWRlKCkgXG4gICAgICAgICAgOiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpO1xuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICAvLyBidWlsZCBjb250ZXh0IG1lbnUgd2l0aCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IGNvbnRleHRNZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZShbXG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkucmVzdG9yZScpLCBjbGljazogKCkgPT4gV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKSB9LCAvLyBzaG93IHdpbmRvd1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmRpc2Nvbm5lY3QnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLmluZm8oXCJtYWluIEAgc3lzdGVtdHJheTogcmVtb3ZpbmcgcmVnaXN0cmF0aW9uXCIpOyBcbiAgICAgICAgICBDb21tSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKTsgXG4gICAgICAgIH0gXG4gICAgICB9LCAvLyBkaXNjb25uZWN0XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZXhpdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiBDbG9zaW5nIE5leHQtRXhhbVwiKTsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiKTsgXG4gICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7IFxuICAgICAgICAgIGFwcC5xdWl0KCk7IFxuICAgICAgICB9IFxuICAgICAgfSAvLyBleGl0XG4gICAgXSk7XG4gIFxuICAgIHRyYXkuc2V0VG9vbFRpcCgnTmV4dC1FeGFtIFN0dWRlbnQnKTsgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRvb2x0aXBcbiAgICB0cmF5LnNldENvbnRleHRNZW51KGNvbnRleHRNZW51KTsgICAgICAgICAgICAgICAgICAgICAgIC8vIGFwcGx5IG1lbnVcbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICAiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgc2NyaXB0IGlzIHVzZWQgdG8gdGVzdCB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAqIEl0IHVzZXMgdGhlIHRjY3V0aWwgY29tbWFuZCB0byB0ZXN0IGFuZCByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAqIEl0IHJldHVybnMgdHJ1ZSBpZiB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBhcmUgYWxsb3dlZCBhbmQgZmFsc2UgaWYgdGhleSBhcmUgbm90XG4gKiBcbiAqIFRoaXMgY291bGQgYWxzbyBiZSB1c2VkIHRvIHRlc3Qgb3RoZXIgcGVybWlzc2lvbnMgbGlrZSBhY2Nlc3NpYmlsaXR5LCBzY3JlZW4gY2FwdHVyZSwgZXRjLiBcbiAqIHNlZSBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBmb3IgbW9yZSBkZXRhaWxzIG9uIGhvdyB0byB0ZXN0IGZvciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIChpdHMgbm90IHBvc3NpYmxlIHRvIHRlc3QgZm9yIHNjcmVlbiBjYXB0dXJlIHBlcm1pc3Npb25zIG9uIG1hY29zIGJlY2F1c2Ugd2l0aG91dCBwZXJtaXNzaW9ucyBpdCB3aWxsIGFsd2F5cyByZXR1cm4gYSBibGFuayBzY3JlZW5zaG90IC0gd2UgdXNlIGEgd29ya2Fyb3VuZCB0byBkZXRlY3QgdGhpcylcbiAqIFxuICovXG5cblxuXG5cbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcnVuIHRjY3V0aWxcbmltcG9ydCB7IGRpYWxvZywgYXBwIH0gZnJvbSAnZWxlY3Ryb24nICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNob3cgZGlhbG9nIGFuZCBxdWl0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgICAgICAgICAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGZldGNoIHdvcmtzXG4gICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7c2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcG9uZ2AsIHsgbWV0aG9kOiAnR0VUJywgY2FjaGU6ICduby1zdG9yZScgfSkgLy8gdGVzdCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gcmVzLm9rXG4gICAgfSBjYXRjaCB7ICByZXR1cm4gZmFsc2UgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzZXRUQ0MoKSB7ICAgICAgLy8gcmVzZXQgVENDIHBlcm1pc3Npb25zXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy9hcHBJZFxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0uc3R1ZGVudGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vYXBwQnVuZGxlSWQgKHNldCB2aWEgbm90YXJpemUpXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS1zdHVkZW50LmFwcGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG5cblxuICAgIH0pXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAvLyBjaGVjayBvciByZXNldFxuICAgIGNvbnN0IG9rID0gYXdhaXQgdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KVxuICAgIGlmIChvaykge1xuICAgICAgICAgICAgbG9nLmluZm8oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBOZXR3b3JrIGFjY2VzcyBpcyBhbGxvd2VkYCk7XG4gICAgICAgICAgICByZXR1cm4gXCJva1wiO1xuICAgIH1cbiAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5vIEhUVFAgcmVxdWVzdHMgYWxsb3dlZCFgIClcblxuICAgIHRyeSB7XG5cbiAgICAgICAgLy8gYXNrIHRoZSB1c2VycyBpZiB0aGV5IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zIGFuZCBleGl0IHRoZSBhcHAgaWYgdGhleSBkb1xuICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRGVyIFNlcnZlciBpc3QgbmljaHQgZXJyZWljaGJhci4gTVx1MDBGNmNodGVuIFNpZSBkaWUgQmVyZWNodGlndW5nZW4genVyXHUwMEZDY2tzZXR6ZW4gdW5kIE5leHQtRXhhbSBtYW51ZWxsIG5ldSBzdGFydGVuPycsXG4gICAgICAgICAgICBidXR0b25zOiBbJ09LJywgJ0FiYnJlY2hlbiddLFxuICAgICAgICB9KVxuICAgICAgICBpZiAoY2hvaWNlLnJlc3BvbnNlID09PSAwKSB7ICAgIC8vIHJlc2V0IHBlcm1pc3Npb25zIGFuZCByZXR1cm4gdHJ1ZSB0byBxdWl0IHRoZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogUmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnMgYW5kIHF1aXR0aW5nIGFwcGApO1xuICAgICAgICAgICAgYXdhaXQgcmVzZXRUQ0MoKTsgXG4gICAgICAgICAgICByZXR1cm4gXCJyZXNldFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZSBcbiAgICAgICAgfSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuIFxuICAgIH0gXG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nLmVycm9yKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogRXJyb3IgcmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnM6ICR7ZX1gKTtcbiAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRmVobGVyIGJlaW0gWnVyXHUwMEZDY2tzZXR6ZW4gZGVyIEJlcmVjaHRpZ3VuZ2VuJyxcbiAgICAgICAgICAgIGRldGFpbDogU3RyaW5nKGUuZXJyIHx8IGUpLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gZmFsc2UgICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIENvdW50ZXIgZm9yIGZhaWxlZCBhdHRlbXB0cyAtIHNraXAgZXhlY3V0aW9uIGFmdGVyIDQgY29uc2VjdXRpdmUgZmFpbHVyZXNcbmxldCBmYWlsdXJlQ291bnRlciA9IDA7XG5jb25zdCBNQVhfRkFJTFVSRVMgPSAzO1xuXG4vLyBDb252ZXJ0IFJTU0kgaW4gZEJtIHRvIGEgcXVhbGl0eSBwZXJjZW50YWdlIGJldHdlZW4gMCBhbmQgMTAwLlxuZnVuY3Rpb24gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pIHtcbiAgICBpZiAoZGJtID09PSBudWxsIHx8IE51bWJlci5pc05hTihkYm0pKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBtaW5EYm0gPSAtMTAwO1xuICAgIGNvbnN0IG1heERibSA9IC0zMDtcbiAgICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgobWluRGJtLCBNYXRoLm1pbihtYXhEYm0sIGRibSkpO1xuICAgIGNvbnN0IHBlcmNlbnQgPSAoKGNsYW1wZWQgLSBtaW5EYm0pIC8gKG1heERibSAtIG1pbkRibSkpICogMTAwO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHBlcmNlbnQpO1xufVxuXG4vKipcbiAqIEdldCBjdXJyZW50IFdMQU4gaW5mb3JtYXRpb24gKFNTSUQsIEJTU0lELCBRdWFsaXR5KVxuICogQHJldHVybnMge1Byb21pc2U8e3NzaWQ6IHN0cmluZ3xudWxsLCBic3NpZDogc3RyaW5nfG51bGwsIHF1YWxpdHk6IG51bWJlcnxudWxsLCBtZXNzYWdlOiBzdHJpbmd8bnVsbH0+fVxuICogQGRlc2NyaXB0aW9uIG1lc3NhZ2UgY2FuIGJlOiBcImVycm9yXCIgKG9uIGVycm9yKSwgXCJub2ludGVyZmFjZVwiIChubyBpbnRlcmZhY2UgYXZhaWxhYmxlKSwgXCJub3Blcm1pc3Npb25zXCIgKGxvY2F0aW9uIHBlcm1pc3Npb25zIG1pc3Npbmcgb24gV2luZG93cyksIG9yIG51bGwgKHN1Y2Nlc3MpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mbygpIHtcbiAgICAvLyBTa2lwIGV4ZWN1dGlvbiBpZiB3ZSd2ZSBoYWQgdG9vIG1hbnkgY29uc2VjdXRpdmUgZmFpbHVyZXNcbiAgICBpZiAoZmFpbHVyZUNvdW50ZXIgPj0gTUFYX0ZBSUxVUkVTKSB7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb0xpbnV4KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTWFjT1MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBFbnN1cmUgcmVzdWx0IGlzIGFsd2F5cyBhbiBvYmplY3RcbiAgICAgICAgaWYgKCFyZXN1bHQgfHwgdHlwZW9mIHJlc3VsdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZXNldCBjb3VudGVyIG9uIHN1Y2Nlc3NmdWwgcmVzdWx0IChoYXMgZGF0YSlcbiAgICAgICAgaWYgKHJlc3VsdC5zc2lkIHx8IHJlc3VsdC5ic3NpZCB8fCByZXN1bHQucXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSW5jcmVtZW50IGNvdW50ZXIgb24gZmFpbHVyZVxuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBSZXR1cm4gZW1wdHkgb2JqZWN0IGluc3RlYWQgb2YgdGhyb3dpbmcgdG8gcHJldmVudCBhcHAgY3Jhc2hcbiAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBMaW51eCB1c2luZyBubWNsaSAod2l0aCBmYWxsYmFjayB0byBpdy9pd2NvbmZpZylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9MaW51eCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgbm1jbGkgZmlyc3QgKG1vc3QgY29tbW9uIG9uIG1vZGVybiBMaW51eClcbiAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGdldCBhY3RpdmUgZGV2aWNlIGRpcmVjdGx5IChmYXN0ZXIgdGhhbiBsaXN0aW5nIGFsbCBuZXR3b3JrcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBzdGRvdXQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoJ25tY2xpIC10IC1mIGFjdGl2ZSxzc2lkLGJzc2lkLHNpZ25hbCBkZXZpY2Ugd2lmaSBsaXN0Jywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA0MDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0ZG91dCA9IHJlc3VsdC5zdGRvdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4ZWNFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEV2ZW4gaWYgZXhlY0FzeW5jIHRocm93cyBhbiBlcnJvciwgY2hlY2sgaWYgc3Rkb3V0IGNvbnRhaW5zIHZhbGlkIGRhdGFcbiAgICAgICAgICAgICAgICAvLyBubWNsaSBzb21ldGltZXMgcmV0dXJucyBub24temVybyBleGl0IGNvZGUgYnV0IHN0aWxsIHByb3ZpZGVzIHZhbGlkIG91dHB1dFxuICAgICAgICAgICAgICAgIGlmIChleGVjRXJyb3Iuc3Rkb3V0ICYmIGV4ZWNFcnJvci5zdGRvdXQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc3Rkb3V0ID0gZXhlY0Vycm9yLnN0ZG91dDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBleGVjRXJyb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3V0cHV0IGZyb20gbm1jbGknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpbmQgYWN0aXZlIGNvbm5lY3Rpb25cbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gbGluZS5zcGxpdCgnOicpO1xuICAgICAgICAgICAgICAgIGlmICgocGFydHNbMF0gPT09ICd5ZXMnIHx8IHBhcnRzWzBdID09PSAnamEnKSAmJiBwYXJ0cy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gcGFydHNbMV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIC8vIEJTU0lEIGlzIGEgTUFDIGFkZHJlc3MgKDYgaGV4IGJ5dGVzIHNlcGFyYXRlZCBieSBjb2xvbnMsIHBvc3NpYmx5IGVzY2FwZWQpXG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgdXNpbmcgcmVnZXggLSBoYW5kbGUgZXNjYXBlZCBjb2xvbnMgKFxcOikgYXMgc2hvd24gaW4gbm1jbGkgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHJlZ2V4IHN0cmluZywgXFxcXDogbWF0Y2hlcyBhIGxpdGVyYWwgYmFja3NsYXNoIGZvbGxvd2VkIGJ5IGNvbG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OlxcXFw6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGVzY2FwZSBiYWNrc2xhc2hlcyBhbmQgbm9ybWFsaXplIHRvIHVwcGVyY2FzZVxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoWzBdLnJlcGxhY2UoL1xcXFw6L2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB0cnkgbm9ybWFsIGNvbG9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG5vcm1hbE1hdGNoWzBdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gcGFydHNbMl0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gU2lnbmFsIGlzIHRoZSBsYXN0IG51bWVyaWMgcGFydFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxTdHIgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA/IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnRyaW0oKSA6ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWwgPSBzaWduYWxTdHIgPyAocGFyc2VJbnQoc2lnbmFsU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAobm1jbGlFcnJvcikge1xuICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0LCBldGMuKSwgbm90IGlmIGp1c3Qgbm8gV0xBTiBhY3RpdmVcbiAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gbm1jbGlFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBubWNsaUVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobm1jbGlFcnJvci5tZXNzYWdlICYmICFubWNsaUVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ05vIG91dHB1dCcpKTtcbiAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogbm1jbGkgY29tbWFuZCBmYWlsZWQ6Jywgbm1jbGlFcnJvci5tZXNzYWdlIHx8IG5tY2xpRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBpdyAoaXdjb25maWcgaXMgZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3U3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUUgXCJeXFxzKnNzaWR8XlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3bGlua1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1BIDUgXCJeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IFNTSURcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBpd1N0ZG91dCA/IGl3U3Rkb3V0Lm1hdGNoKC9zc2lkXFxzKyguKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHNzaWRNYXRjaCA/IHNzaWRNYXRjaFsxXS50cmltKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgYW5kIHNpZ25hbCBmcm9tIGxpbmsgaW5mb1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL2FkZHI6XFxzKyhbYS1mMC05Ol17MTd9KS9pKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvc2lnbmFsOlxccysoLT9cXGQrKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxEYm0gPSBzaWduYWxNYXRjaCA/IChwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWFsaXR5ID0gc2lnbmFsRGJtICE9PSBudWxsID8gZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWxEYm0pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGNhdGNoIChpd0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3RXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBpdyBjb21tYW5kIGZhaWxlZDonLCBpd0Vycm9yLm1lc3NhZ2UgfHwgaXdFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIExhc3QgZmFsbGJhY2s6IGl3Y29uZmlnIChkZXByZWNhdGVkIGJ1dCB3aWRlbHkgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3Y29uZmlnIDI+L2Rldi9udWxsIHwgZ3JlcCAtRSBcIkVTU0lEfEFjY2VzcyBQb2ludHxTaWduYWwgbGV2ZWxcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gbGluZS5tYXRjaCgvRVNTSUQ6XCIoW15cIl0rKVwiLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3NpZE1hdGNoKSBzc2lkID0gc3NpZE1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQWNjZXNzIFBvaW50OlxccysoW2EtZjAtOTpdezE3fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkgYnNzaWQgPSBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvU2lnbmFsIGxldmVsPSgtP1xcZCspLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGl3Y29uZmlnRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgYWxsIG1ldGhvZHMgZmFpbGVkIHdpdGggcmVhbCBlcnJvcnMgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdjb25maWdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IEFsbCBtZXRob2RzIChubWNsaSwgaXcsIGl3Y29uZmlnKSBmYWlsZWQuIExhc3QgZXJyb3I6JywgaXdjb25maWdFcnJvci5tZXNzYWdlIHx8IGl3Y29uZmlnRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnZXJyb3InXG4gICAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnXG4gICAgfTtcbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgbmV0c2hcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c2ggd2xhbiBzaG93IGludGVyZmFjZXMnLCB7XG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBzdGRlcnIgZm9yIHNlcnZpY2UgZXJyb3JzXG4gICAgICAgIGNvbnN0IGVycm9yT3V0cHV0ID0gKHN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gKHN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRPdXRwdXQgPSBvdXRwdXQgKyAnICcgKyBlcnJvck91dHB1dDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIFdMQU4gc2VydmljZSBpcyBub3QgcnVubmluZyAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuc3ZjJykgfHwgXG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbiBhdXRvY29uZmlnJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdhdXRvbWF0aXNjaCB3bGFuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuLWtvbmZpZ3VyYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc2VydmljZSBpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGVyIGRpZW5zdCcpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgbm8gaW50ZXJmYWNlcyBhdmFpbGFibGVcbiAgICAgICAgaWYgKHN0ZG91dC5pbmNsdWRlcygnVGhlcmUgaXMgbm8gd2lyZWxlc3MgaW50ZXJmYWNlJykgfHwgXG4gICAgICAgICAgICBzdGRvdXQuaW5jbHVkZXMoJ0VzIGdpYnQga2VpbmUgRHJhaHRsb3MtU2Nobml0dHN0ZWxsZScpIHx8XG4gICAgICAgICAgICBzdGRvdXQubWF0Y2goL05vIHdpcmVsZXNzL2kpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUubGVuZ3RoID4gMCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAvLyBTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlLCBoYW5kbGVzIHZhcmlvdXMgZm9ybWF0c1xuICAgICAgICAgICAgLy8gVXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmQgdG8gZW5zdXJlIHdlIGRvbid0IG1hdGNoIFwiQlNTSURcIiAod2hpY2ggY29udGFpbnMgXCJTU0lEXCIpXG4gICAgICAgICAgICBpZiAobGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjpcXHMqKC4rKS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHNldCBpZiBub3QgZW1wdHkgYW5kIG5vdCBcIk4vQVwiIG9yIHNpbWlsYXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZCAmJiBleHRyYWN0ZWQubGVuZ3RoID4gMCAmJiAhZXh0cmFjdGVkLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGV4dHJhY3RlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEJTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlIHBhdHRlcm4gbWF0Y2hpbmdcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL0JTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gKGhhbmRsZXMgYm90aCAtIGFuZCA6IHNlcGFyYXRvcnMsIHdpdGggb3Igd2l0aG91dCBzcGFjZXMpXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRFxccyo6XFxzKihbYS1mMC05XXsyfSg/OlstOlxcc11bYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG1hdGNoWzFdLnJlcGxhY2UoL1stIF0vZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNpZ25hbCBwYXJzaW5nIC0gaGFuZGxlIHZhcmlvdXMgbG9jYWxpemVkIGZvcm1hdHMgYW5kIHBhdHRlcm5zXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9TaWduYWx8U2lnbmFsc3RcdTAwRTRya2V8SW50ZW5zaXRcdTAwRTl8U2VcdTAwRjFhbC9pKSkge1xuICAgICAgICAgICAgICAgIC8vIFRyeSBwZXJjZW50YWdlIHBhdHRlcm4gZmlyc3QgKG1vc3QgY29tbW9uKVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKFxcZCspXFxzKiUvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPj0gMCAmJiBwYXJzZWQgPD0gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgZEJtIHBhdHRlcm4gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKC0/XFxkKylcXHMqZEJtL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRibSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGRibSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBlbXB0eSBzdHJpbmdzIHRvIG51bGxcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IChzc2lkICYmIHNzaWQubGVuZ3RoID4gMCkgPyBzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiAoYnNzaWQgJiYgYnNzaWQubGVuZ3RoID4gMCkgPyBic3NpZCA6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgZXJyb3IgaXMgZHVlIHRvIGxvY2F0aW9uIHBlcm1pc3Npb25zIChtaWdodCBiZSBpbiBzdGRlcnIgb3IgZXJyb3IgbWVzc2FnZSlcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gKGVycm9yLm1lc3NhZ2UgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3Rkb3V0ID0gKGVycm9yLnN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRlcnIgPSAoZXJyb3Iuc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZEVycm9yT3V0cHV0ID0gZXJyb3JNZXNzYWdlICsgJyAnICsgZXJyb3JTdGRvdXQgKyAnICcgKyBlcnJvclN0ZGVycjtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIExvZyBlcnJvciB3aGVuIGNvbW1hbmQgZXhlY3V0aW9uIGZhaWxzICh0aW1lb3V0LCBwZXJtaXNzaW9uLCBldGMuKVxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93czogRXJyb3IgZXhlY3V0aW5nIG5ldHNoIGNvbW1hbmQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsIChmYWxsYmFjayB3aGVuIG5ldHNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSAoZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uKVxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGFjdGl2ZSBXaS1GaSBjb25uZWN0aW9uIHByb2ZpbGVcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Bvd2Vyc2hlbGwgLUNvbW1hbmQgXCIkcHJvZmlsZSA9IEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSB8IFdoZXJlLU9iamVjdCB7JF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpLUZpKlxcJyAtb3IgJF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpcmVsZXNzKlxcJ30gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxOyBpZiAoJHByb2ZpbGUpIHsgJHByb2ZpbGUuTmFtZSB9XCInLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBzc2lkU3RyID0gc3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBpZiAoc3NpZFN0ciAmJiBzc2lkU3RyLmxlbmd0aCA+IDAgJiYgIXNzaWRTdHIubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRTdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBCU1NJRCBjYW5ub3QgYmUgZWFzaWx5IHJldHJpZXZlZCB3aXRob3V0IG5ldHNoICh3aGljaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAgICAgICAgLy8gU2V0dGluZyB0byBudWxsIGFzIGZhbGxiYWNrIC0gU1NJRCBpcyB0aGUgbW9zdCBpbXBvcnRhbnQgaW5mb3JtYXRpb24gYW55d2F5XG4gICAgICAgIGNvbnN0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBQb3dlclNoZWxsIGZhbGxiYWNrIChjYW4ndCBlYXNpbHkgZ2V0IHNpZ25hbCBzdHJlbmd0aCB3aXRob3V0IG5ldHNoKVxuICAgICAgICAvLyBSZXR1cm4gbm9wZXJtaXNzaW9ucyBtZXNzYWdlIHNvIGZyb250ZW5kIGNhbiBzaG93IHRoZSB3YXJuaW5nXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnbm9wZXJtaXNzaW9ucydcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgZXJyb3IgaWYgUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsc1xuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGw6IFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbGVkOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIG1hY09TIHVzaW5nIGFpcnBvcnQgb3IgbmV0d29ya3NldHVwXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTWFjT1MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IGFpcnBvcnQgY29tbWFuZCBmaXJzdCAoZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGFpcnBvcnQgaXMgYXZhaWxhYmxlICh1c3VhbGx5IGF0IC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0KVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGFpcnBvcnRQYXRoIH0gPSBhd2FpdCBleGVjQXN5bmMoJ3doaWNoIGFpcnBvcnQgMj4vZGV2L251bGwgfHwgZWNobyAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFpcnBvcnQgPSBhaXJwb3J0UGF0aC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYCR7YWlycG9ydH0gLUlgLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IHJzc2lEYm0gPSBudWxsO1xuICAgICAgICAgICAgbGV0IHNpZ25hbFBlcmNlbnQgPSBudWxsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQgPSBsaW5lLnJlcGxhY2UoJ1NTSUQ6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnQlNTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIHRvIGVuc3VyZSB3ZSBnZXQgdGhlIGZ1bGwgQlNTSURcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEOlxccyooW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnYWdyQ3RsUlNTSTonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBSU1NJIGluIGRCbSAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2lTdHIgPSBsaW5lLnJlcGxhY2UoJ2FnckN0bFJTU0k6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaSA9IHJzc2lTdHIgPyAocGFyc2VJbnQocnNzaVN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgcnNzaURibSA9IHJzc2k7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2xpbmsgYXV0aDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBbHRlcm5hdGl2ZTogc2lnbmFsIHN0cmVuZ3RoIGFzIHBlcmNlbnRhZ2UgKGlmIGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxkKyklLyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCAmJiBzaWduYWxQZXJjZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsUGVyY2VudCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcXVhbGl0eSA9IG51bGw7XG4gICAgICAgICAgICBpZiAoc2lnbmFsUGVyY2VudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBzaWduYWxQZXJjZW50O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyc3NpRGJtICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IGRibVRvUXVhbGl0eVBlcmNlbnQocnNzaURibSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzc2lkIHx8IGJzc2lkIHx8IHF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoYWlycG9ydEVycm9yKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBuZXR3b3Jrc2V0dXAgLSBvbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAobm90IGp1c3Qgbm8gcGVybWlzc2lvbilcbiAgICAgICAgICAgIGlmIChhaXJwb3J0RXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcgJiYgYWlycG9ydEVycm9yLm1lc3NhZ2UgJiYgIWFpcnBvcnRFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IGFpcnBvcnQgY29tbWFuZCBmYWlsZWQ6JywgYWlycG9ydEVycm9yLm1lc3NhZ2UgfHwgYWlycG9ydEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2s6IG5ldHdvcmtzZXR1cCBhbmQgaXBjb25maWcgKGZvciBuZXdlciBtYWNPUyB3aGVyZSBhaXJwb3J0IGlzIG5vdCBhdmFpbGFibGUpICAvLyBzeXN0ZW1fcHJvZmlsZXIgaXMgd2F5IHRvIGhlYXZ5IGFuZCBuZWVkcyBhIGxvb29vb3Qgb2YgdGltZSB0byBwcm9jZXNzXG4gICAgICAgIC8vIHRoaXMgaXMgYSBzaW1wbGUgY2FsY3VsYXRpb24uLiB3ZSBjYW4ndCByZWx5IG9uIGEgcHJvY2VzcyB0aGF0IHRha2VzIDEwcyB0byBjb21wbGV0ZSBhbmQgYmxvY2tzIHRoZSB3aG9sZSBzeXN0ZW1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSBXTEFOIGludGVyZmFjZSB1c2luZyBuZXR3b3Jrc2V0dXBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpbnRlcmZhY2VPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0d29ya3NldHVwIC1saXN0YWxsaGFyZHdhcmVwb3J0cyB8IGF3ayBcXCcvV2ktRml8QWlyUG9ydC97Z2V0bGluZTsgcHJpbnQgJE5GfVxcJycsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZU5hbWUgPSBpbnRlcmZhY2VPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWludGVyZmFjZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBXaS1GaSBpbnRlcmZhY2UgZm91bmRcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBhd2sgLUYnIFNTSUQgOiAnICcvIFNTSUQgOiAvIHtwcmludCAkMn0nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkT3V0cHV0LnRyaW0oKSB8fCBudWxsO1xuICAgICAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZCwgY29udGludWUgd2l0aCBCU1NJRFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgQlNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGJzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBncmVwICdCU1NJRCA6JyB8IGF3ayAne3ByaW50ICQzfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRTdHIgPSBic3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgQlNTSUQgZm9ybWF0IChNQUMgYWRkcmVzcylcbiAgICAgICAgICAgICAgICBpZiAoYnNzaWRTdHIgJiYgL15bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0kL2kudGVzdChic3NpZFN0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZFN0ci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGJzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBCU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgZmFsbGJhY2sgKGFpcnBvcnQgbm90IGF2YWlsYWJsZSwgY2FuJ3QgZ2V0IHNpZ25hbCBzdHJlbmd0aClcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAobmV0d29ya3NldHVwRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiBuZXR3b3Jrc2V0dXAgZmFpbHMgd2l0aCBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogbmV0d29ya3NldHVwL2lwY29uZmlnIGZhbGxiYWNrIGZhaWxlZDonLCBuZXR3b3Jrc2V0dXBFcnJvci5tZXNzYWdlIHx8IG5ldHdvcmtzZXR1cEVycm9yKTtcbiAgICAgICAgICAgIC8vIElmIGZhbGxiYWNrIGNvbXBsZXRlbHkgZmFpbHMsIHJldHVybiBlcnJvciBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IGdldFdsYW5JbmZvIH07XG5cblxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ3Rhc2tsaXN0IC9mbyBjc3YnIChzdHJ1Y3R1cmVkIGZvcm1hdCwgZmFzdGVyIHRoYW4gL3YsIHN0aWxsIHNob3dzIHByb2Nlc3MgbmFtZXMpXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygndGFza2xpc3QgL2ZvIGNzdicsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAnbmV0c3RhdCAtYW5vJyAoc2hvd3MgYWxsIGNvbm5lY3Rpb24gc3RhdGVzIGluY2x1ZGluZyBFU1RBQkxJU0hFRCBmb3Igc2NyZWVuc2hhcmluZyBkZXRlY3Rpb24pXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c3RhdCAtYW5vJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIFJlZ2V4IHRvIGZpbmQgOlBPUlQgZm9sbG93ZWQgYnkgYSBzcGFjZSAoZW5zdXJlcyBleGFjdCBwb3J0IG1hdGNoLCBlLmcuLCA6NTkzOCApXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fVxcXFxzYCwgJ2cnKSBcbiAgICAgIGlmIChyZWdleC50ZXN0KHN0ZG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCdjb20ubWljcm9zb2Z0LnRlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNScsXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2LFxuXVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0ICogYXMgd2luIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlV2luLmpzJ1xuaW1wb3J0ICogYXMgbWFjIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTWFjLmpzJ1xuaW1wb3J0ICogYXMgbGludXggZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVMaW4uanMnXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjayhwbGF0Zm9ybSA9ICd3aW4zMicpIHtcbiAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gYXdhaXQgd2luLnJ1blJlbW90ZUNoZWNrKClcbiAgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJykgcmV0dXJuIGF3YWl0IG1hYy5ydW5SZW1vdGVDaGVjaygpXG4gIHJldHVybiBhd2FpdCBsaW51eC5ydW5SZW1vdGVDaGVjaygpXG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBFeHBhbmRlZCBicm93c2VyIGtleXdvcmRzIHRvIGNhdGNoIG1vcmUgdmFyaWFudHNcbmNvbnN0IGJyb3dzZXJLZXl3b3JkcyA9IFtcbiAgICAnY2hyb20nLCAnY2hyb21lLmV4ZScsXG4gICAgJ2VkZ2UnLCAnbXNlZGdlLmV4ZScsXG4gICAgJ2ZpcmUnLCAnZmlyZWZveC5leGUnLFxuICAgICdicmF2ZScsICdicmF2ZS5leGUnLFxuICAgICdvcGVyYScsICdvcGVyYS5leGUnLFxuICAgICdicm93c2VyJywgLy8gR2VuZXJpYyBicm93c2VyIHByb2Nlc3NcbiAgICAnaWV4cGxvcmUnLCAvLyBJbnRlcm5ldCBFeHBsb3JlclxuICAgICdzYWZhcmknLCAvLyBGb3IgbWFjT1Ncbl07XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJiB7ICRwcm9jID0gR2V0LUNpbUluc3RhbmNlIC1DbGFzcyBXaW4zMl9Qcm9jZXNzIC1GaWx0ZXIgJ1Byb2Nlc3NJZD0ke3BpZH0nOyBpZiAoJHByb2MpIHsgJHByb2MuUGFyZW50UHJvY2Vzc0lkOyAkcHJvYy5OYW1lIH0gfVwiYDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZSk7XG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KGxpbmVzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBsaW5lc1sxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1dpbmRvd3M6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFVuaXggc3lzdGVtcyAoTGludXgvbWFjT1MpXG4gKiBUcmllcyAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCksIGZhbGxzIGJhY2sgdG8gcHMgY29tbWFuZFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0IG1ldGhvZCB+NG1zLCBubyBwcm9jZXNzIHNwYXduKVxuICAgICAgICBjb25zdCBbc3RhdENvbnRlbnQsIGNvbW1Db250ZW50XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vc3RhdGAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbCksXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L2NvbW1gLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpXG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKHN0YXRDb250ZW50KSB7XG4gICAgICAgICAgICAvLyBQYXJzZSAvcHJvYy9waWQvc3RhdDogcGlkIChjb21tKSBzdGF0ZSBwcGlkIC4uLlxuICAgICAgICAgICAgY29uc3Qgc3RhdE1hdGNoID0gc3RhdENvbnRlbnQubWF0Y2goL15cXGQrXFxzK1xcKChbXildKylcXClcXHMrXFxTK1xccysoXFxkKykvKTtcbiAgICAgICAgICAgIGlmIChzdGF0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKGNvbW1Db250ZW50IHx8IHN0YXRNYXRjaFsxXSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHN0YXRNYXRjaFsyXSwgMTApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gcHMgY29tbWFuZCAod29ya3Mgb24gYm90aCBMaW51eCBhbmQgbWFjT1MpXG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcHMgLXAgJHtwaWR9IC1vIHBwaWQ9LGNvbW09YDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcGFydHMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHBhcnRzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKCcgJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9Vbml4OiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBiYXNlZCBvbiBwbGF0Zm9ybVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mbyhwaWQpIHtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgXG4gICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKTtcbiAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnbGludXgnIHx8IHBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCk7IC8vIExpbnV4L21hY09TOiB0cmllcyAvcHJvYywgZmFsbHMgYmFjayB0byBwc1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBjaGVjayBwYXJlbnQgcHJvY2Vzc2VzIGZvciBicm93c2VyXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZpbmRQYXJlbnRQcm9jZXNzKHBpZCwgbWF4RGVwdGgsIHZpc2l0ZWRQaWRzKSB7XG4gICAgaWYgKHBpZCA9PT0gMSB8fCBwaWQgPT09IDApIHtcbiAgICAgICAgbG9nLmluZm8oJ2NoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJvb3QgUElEIHJlYWNoZWQuIE5vIHdlYiBicm93c2VyIGZvdW5kLicpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGlmIChtYXhEZXB0aCA8PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiB3aGVuIG1heCBkZXB0aCByZWFjaGVkXG4gICAgfVxuICAgIFxuICAgIGlmICh2aXNpdGVkUGlkcy5oYXMocGlkKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXNcbiAgICB9XG4gICAgXG4gICAgdmlzaXRlZFBpZHMuYWRkKHBpZCk7XG4gICAgXG4gICAgLy8gR2V0IHByb2Nlc3MgaW5mbyAoZ2V0UHJvY2Vzc0luZm8gYWxyZWFkeSBoYXMgaXRzIG93biB0aW1lb3V0IHByb3RlY3Rpb24pXG4gICAgY29uc3QgcHJvY2Vzc0luZm8gPSBhd2FpdCBnZXRQcm9jZXNzSW5mbyhwaWQpO1xuICAgIFxuICAgIGlmICghcHJvY2Vzc0luZm8pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB7IHBwaWQsIG5hbWUgfSA9IHByb2Nlc3NJbmZvO1xuICAgIFxuICAgIC8vIExvZyB0aGUgcHJvY2VzcyBpbmZvIGZvciBkZWJ1Z2dpbmdcbiAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQ2hlY2tpbmcgcHJvY2VzczogJHtuYW1lfSAoUElEOiAke3BpZH0sIFBQSUQ6ICR7cHBpZH0pYCk7XG4gICAgXG4gICAgLy8gTW9yZSB0aG9yb3VnaCBicm93c2VyIGRldGVjdGlvblxuICAgIGlmIChicm93c2VyS2V5d29yZHMuc29tZShicm93c2VyID0+IG5hbWUuaW5jbHVkZXMoYnJvd3NlcikpKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGZvdW5kOiAke25hbWV9YCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAobmFtZS5pbmNsdWRlcygnZXhwbG9yZXInKSB8fCBwcGlkIDw9IDEpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJlYWNoZWQgc3lzdGVtIHByb2Nlc3Mgb3IgZXhwbG9yZXJgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBmaW5kUGFyZW50UHJvY2VzcyhwcGlkLCBtYXhEZXB0aCAtIDEsIHZpc2l0ZWRQaWRzKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgcGFyZW50IHByb2Nlc3MgaXMgYSBicm93c2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja1BhcmVudFByb2Nlc3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZm91bmRCcm93c2VyID0gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHJvY2Vzcy5wcGlkLCA2LCBuZXcgU2V0KCkpO1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEJyb3dzZXIgZGV0ZWN0aW9uIHJlc3VsdDogJHtmb3VuZEJyb3dzZXJ9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGZvdW5kQnJvd3NlciB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEVycm9yIGluIGJyb3dzZXIgZGV0ZWN0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBmb3VuZEJyb3dzZXI6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgIH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQXVCQSxTQUFTLFlBQUFBLGlCQUFnQjtBQUN6QixTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXO0FBQ3BCLE9BQU8sU0FBUzs7O0FDckJoQixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQTtBQUFBLEVBQ2IsY0FBYztBQUFBLEVBQ2QsZUFBZTtBQUFBLEVBQ2YsZ0JBQWdCO0FBQUEsRUFDaEIsU0FBUztBQUFBLEVBRVQsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBLEVBRWpCLGVBQWU7QUFBQTtBQUFBLEVBQ2YscUJBQXFCO0FBQUE7QUFBQSxFQUVyQixxQkFBcUI7QUFBQSxFQUNyQixRQUFRO0FBQUE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULFVBQVU7QUFBQSxFQUNWLGFB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QUFBLElBQ2IsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBRWQsV0FBYTtBQUFBLElBQ2IsV0FBYTtBQUFBLElBQ2IsYUFBZTtBQUFBLElBQ2YsaUJBQW1CO0FBQUEsSUFDbkIsaUJBQW1CO0FBQUEsSUFDbkIsUUFBUztBQUFBLElBQ1QsU0FBVTtBQUFBLElBQ1YsZ0JBQWtCO0FBQUEsSUFDbEIsY0FBZ0I7QUFBQSxJQUNoQixhQUFlO0FBQUEsSUFDZixPQUFTO0FBQUEsSUFDVCxTQUFXO0FBQUEsSUFDWCxPQUFTO0FBQUEsSUFDVCxPQUFTO0FBQUEsSUFDVCxXQUFhO0FBQUEsSUFDYixRQUFVO0FBQUEsSUFDVixNQUFRO0FBQUEsSUFDUixXQUFhO0FBQUEsSUFDYixNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxXQUFhO0FBQUEsSUFDYixTQUFXO0FBQUEsSUFDWCxRQUFVO0FBQUEsSUFDVixNQUFPO0FBQUEsSUFDUCxNQUFPO0FBQUEsSUFDUCxPQUFRO0FBQUEsSUFDUixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxXQUFZO0FBQUEsSUFDWixVQUFXO0FBQUEsSUFDWCxVQUFXO0FBQUEsSUFDWCxVQUFXO0FBQUEsSUFDWCxVQUFXO0FBQUEsSUFDWCxVQUFXO0FBQUEsSUFDWCxVQUFXO0FBQUEsSUFDWCxXQUFZO0FBQUEsSUFDWixhQUFjO0FBQUEsSUFDZCxZQUFhO0FBQUEsSUFDYixNQUFPO0FBQUEsSUFDUCxXQUFZO0FBQUEsSUFDWixNQUFPO0FBQUEsSUFDUCxZQUFhO0FBQUEsSUFDYixNQUFPO0FBQUEsSUFDUCxNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxPQUFRO0FBQUEsSUFDUixXQUFZO0FBQUEsSUFDWixXQUFZO0FBQUEsSUFDWixNQUFPO0FBQUEsSUFDUCxhQUFjO0FBQUEsSUFDZCxhQUFjO0FBQUEsSUFDZCxhQUFjO0FBQUEsSUFDZCxVQUFXO0FBQUEsSUFDWCxXQUFZO0FBQUEsSUFDWixRQUFTO0FBQUEsSUFDVCxjQUFlO0FBQUEsSUFDZixjQUFlO0FBQUEs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VUFBVSxNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQzFDLEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLFlBQVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFDL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZXhlY1N5bmMiLCAiZXhlY1N5bmMiLCAibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgImdsb2JhbFNob3J0Y3V0IiwgIlRyYXkiLCAiTWVudSIsICJkaWFsb2ciLCAibG9nIiwgImxvZyIsICJwYXRoIiwgImZzIiwgImlwIiwgImdhdGV3YXk0c3luYyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAibG9nIiwgImNvbmZpZ1N0b3JlIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJsb2ciLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgIl9fZGlybmFtZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgImxvZyIsICJhcHBzVG9DbG9zZSIsICJjaGlsZFByb2Nlc3MiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAibG9nIiwgInBhdGgiLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJqb2luIiwgImxvZyIsICJhcHAiLCAiZnMiLCAiam9pbiIsICJzY3JlZW4iLCAiaXBjTWFpbiIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJ3ZWJDb250ZW50cyIsICJwYXRoIiwgImZzIiwgImNsaXBib2FyZCIsICJhcHAiLCAib3MiLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImFwcCIsICJmcyIsICJwYXRoIiwgInByb2Nlc3MiLCAic3Bhd24iLCAiYXBwIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAic3Bhd24iLCAibG9nIiwgInByb2Nlc3MiLCAiZnMiLCAicGF0aCIsICJvcyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJhcHAiLCAibG9nIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgImxvZyIsICJwYXRoIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYXBwIiwgInBhdGgiLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgIndlYkNvbnRlbnRzIiwgInNjcmVlbiIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
