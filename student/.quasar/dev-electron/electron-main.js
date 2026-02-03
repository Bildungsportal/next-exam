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
      log7.info("did-navigate");
      log7.info(url);
    });
    this.bipwindow.webContents.on("will-navigate", (event, url) => {
      log7.info("will-navigate");
      log7.info(url);
    });
    this.bipwindow.webContents.on("new-window", (event, url) => {
      log7.info("new-window");
      log7.info(url);
      event.preventDefault();
    });
    this.bipwindow.webContents.setWindowOpenHandler(({ url }) => {
      log7.info("target: _blank");
      log7.info(url);
      return { action: "deny" };
    });
    this.bipwindow.webContents.on("will-redirect", (event, url) => {
      log7.info("Redirecting to:", url);
      if (url.startsWith("bildungsportal://")) {
        event.preventDefault();
        const prefix = "bildungsportal://token=";
        const token = url.substring(prefix.length);
        log7.info("Captured Token:");
        log7.info(token);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLnBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICB0aGlzLl9hcmNoID0gcHJvY2Vzcy5hcmNoO1xuICAgIHRoaXMuX2VudiA9IHByb2Nlc3MuZW52O1xuXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmlzS0RFID0gdGhpcy5faXNLREUoKTtcbiAgICB0aGlzLmlzR05PTUUgPSB0aGlzLl9pc0dOT01FKCk7XG4gICAgdGhpcy5mbGFtZXNob3QgPSB0aGlzLl9nZXRWZXJzaW9uKCdmbGFtZXNob3QnKTtcbiAgICB0aGlzLmltYWdlbWFnaWNrID0gdGhpcy5fZ2V0VmVyc2lvbignY29udmVydCcpO1xuICAgIHRoaXMuaW1WZXJzaW9uID0gdGhpcy5fZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCk7XG4gICAgdGhpcy53b3JrZXJGaWxlTmFtZSA9IHRoaXMuX2dldFdvcmtlckZpbGVOYW1lKCk7XG4gICAgdGhpcy51c2VXb3JrZXIgPSB0aGlzLl9nZXRVc2VXb3JrZXIoKTtcbiAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gdGhpcy5fZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKTtcbiAgICB0aGlzLmpyZSA9IHRoaXMuX2RldGVjdEpSRUlkKCk7XG4gICAgdGhpcy5qcmVEaXIgPSB0aGlzLl9yZXNvbHZlSlJFRGlyKCk7XG4gICAgdGhpcy5qYXZhQmluID0gdGhpcy5fcmVzb2x2ZUphdmFCaW4oKTtcbiAgICB0aGlzLmpyZUluZm8gPSB0aGlzLl9nZXRKUkUoKTtcbiAgICBcbiAgICB0aGlzLmhvbWVkaXJlY3RvcnkgPSBvcy5ob21lZGlyKCk7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gICAgdGhpcy53b3JrZXJVUkwgPSB0aGlzLl9nZXRXb3JrZXJVUkwoKTtcbiAgICB0aGlzLnRlbXBkaXJlY3RvcnkgPSB0aGlzLl9nZXRUZW1wZGlyZWN0b3J5KCk7XG4gICAgdGhpcy53b3JrZGlyZWN0b3J5ID0gdGhpcy5fZ2V0V29ya2RpcmVjdG9yeSgpO1xuICAgIHRoaXMubG9nZmlsZSA9IHRoaXMuX2dldExvZ2ZpbGUoKTtcblxuICB9XG5cbiAgX2dldFdvcmtkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5ob21lZGlyZWN0b3J5LCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTtcbiAgfVxuXG4gIF9nZXRUZW1wZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKTtcbiAgfVxuXG5cbiAgX2dldExvZ2ZpbGUoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy53b3JrZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJyk7XG4gIH1cblxuICBfbm9ybWFsaXplQXJjaCgpIHtcbiAgICBpZiAodGhpcy5fYXJjaCA9PT0gJ2lhMzInKSByZXR1cm4gJ2k1ODYnO1xuICAgIGlmIChbJ3g2NCcsICdhcm02NCddLmluY2x1ZGVzKHRoaXMuX2FyY2gpKSByZXR1cm4gdGhpcy5fYXJjaDtcbiAgICB0aGlzLl9mYWlsKGB1bnN1cHBvcnRlZCBhcmNoaXRlY3R1cmU6ICR7dGhpcy5fYXJjaH1gKTtcbiAgfVxuXG4gIF9kZXRlY3RKUkVJZCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gJ21pbmltYWwtanJlLTExLXdpbic7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXJjaCA9PT0gJ2FybTY0JyA/ICdtaW5pbWFsLWpyZS0xMS1tYWMtYXJtNjQnIDogJ21pbmltYWwtanJlLTExLW1hYyc7XG4gICAgfVxuICB9XG5cblxuXG5cblxuICAvKipcbiAgICogXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIEBkZXNjcmlwdGlvbiB0aGlzIGZ1bmN0aW9uIHJlc29sdmVzIHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIGl0IGZpcnN0IGNoZWNrcyBpZiB0aGUgdXNlQnVuZGxlZEpSRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZVxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgY2hlY2tzIGlmIHRoZSBzeXN0ZW0ganJlIGlzIGluc3RhbGxlZFxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3lzdGVtIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogdGhlIGJ1bmRsZWQganJlIGlzIGxvY2F0ZWQgaW4gdGhlIHB1YmxpYyBkaXJlY3Rvcnkgb2YgdGhlIGFwcFxuICAgKiBcbiAgICogRklYTUU6IGlmIHN5c3RlbSBqcmUgaXMgc2VsZWN0ZWQgYnkgRU5WIGRvIG5vdCBpbmNsdWRlIHRoZSBqcmUgZGlyZWN0b3J5IGluIHRoZSBmaW5hbCBidWlsZFxuICAgKi9cblxuICBfcmVzb2x2ZUpSRURpcigpIHtcbiAgICAvLyB1c2UgYnVuZGxlZCBqcmUgYmVjYXVzZSBpdHMgc21hbGxlciBhbmQgcHJvdmlkZXMgb25seSB0aGUgbmVlZGVkIGphdmEgbW9kdWxlc1xuICAgIGlmIChjb25maWcudXNlQnVuZGxlZEpSRSkge1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3Jlc29sdmVKYXZhQmluKCkge1xuICAgIHN3aXRjaCAodGhpcy5wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5wbGF0Zm9ybX1gKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0RGlzcGxheVNlcnZlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4JykgcmV0dXJuICduL2EnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnKSByZXR1cm4gJ3dheWxhbmQnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3gxMScgfHwgdGhpcy5fZW52LkRJU1BMQVkpIHJldHVybiAneDExJztcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG5cbiAgX2dldFZlcnNpb24oY21kKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke2NtZH0gLS12ZXJzaW9uYCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnNwbGl0KCdcXG4nKVswXTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL1tcXGRdKyhcXC5bXFxkXSspKy8pO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb246IHZlcnNpb24/LlswXSB8fCAndW5rbm93bicgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRKUkUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdqYXZhIC12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdpZ25vcmUnLCAncGlwZSddIH0pO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvdmVyc2lvbiBcIihbXFxkLl9dKylcIi8pPy5bMV0gfHwgJ3Vua25vd24nO1xuICAgICAgY29uc3QgamF2YUhvbWUgPSB0aGlzLl9lbnYuSkFWQV9IT01FIHx8ICcnO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb24sIHBhdGg6IGphdmFIb21lIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwsIHBhdGg6IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0V29ya2VyRmlsZU5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gIFxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHdvcmtlclBhdGgpO1xuICB9XG5cbiAgaXNXYXlsYW5kKCkge1xuICAgIHJldHVybiB0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnO1xuICB9XG5cbiAgX2lzS0RFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKTtcbiAgICAgIHJldHVybiBvdXQgPT09ICdLREUnO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzS0RFOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc0dOT01FKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygnZ25vbWUnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0dOT01FOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc1VOSVRZKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygndW5pdHknKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZy53YXJuKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzVU5JVFk6IG5vIGRhdGFcIiwgZXJyKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaW1hZ2VtYWdpY2tBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwibWFnaWNrIC12ZXJzaW9uXCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgdjcgKG1hZ2ljaylcIik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZmxhbWVzaG90QXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIndoaWNoIGZsYW1lc2hvdFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ZsYW1lc2hvdEF2YWlsYWJsZTogRmxhbWVzaG90IG5vdCBmb3VuZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfc2V0dXBEZXNrdG9wUGF0aCgpIHtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgfVxuXG4gIF9nZXREZXNrdG9wUGF0aCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudlsnVVNFUlBST0ZJTEUnXSwgJ0Rlc2t0b3AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksICdEZXNrdG9wJyk7XG4gICAgfVxuICB9XG5cbiAgX2ZhaWwobXNnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFtwbGF0Zm9ybURpc3BhdGNoZXJdICR7bXNnfWApO1xuICB9XG5cbiAgX2dldEltYWdlTWFnaWNrVmVyc2lvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiBcIjdcIjtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIFwiPDdcIjtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9nZXRVc2VXb3JrZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIGlmICgodGhpcy5faXNHTk9NRSgpIHx8IHRoaXMuX2lzVU5JVFkoKSkgJiYgdGhpcy5pc1dheWxhbmQoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEdOT01FL1VuaXR5ICsgV2F5bGFuZCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzS0RFKCkgJiYgdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLl9mbGFtZXNob3RBdmFpbGFibGUoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEtERS9XYXlsYW5kICsgRmxhbWVzaG90IFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMudXNlV29ya2VyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogWDExICsgSW1hZ2VNYWdpY2sgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlIFx1MjAxMyBmYWxsYmFjayB0byBwYWdlY2FwdHVyZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIHZpYSBlbGVjdHJvbi1idWlsZGVyLmVudiAtIGVkaXQgdmFycyBpbiBlbGVjdHJvbi1idWlsZGVyLmVudiBmaWxlIVxuICovXG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgICBkZXZlbG9wbWVudDogdHJ1ZSwgIC8vIGRpc2FibGUga2lvc2sgbW9kZSBvbiBleGFtIG1vZGUgYW5kIG90aGVyIHN0dWZmIChhdXRvZmlsbCBpbnB1dCBmaWVsZHMpXG4gICAgc2hvd2RldnRvb2xzOiB0cnVlLFxuICAgIHVzZUJ1bmRsZWRKUkU6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwRGVtbzogZmFsc2UsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICBlbGVjdHJvbjogZmFsc2UsXG4gICAgdmlydHVhbGl6ZWQ6IGZhbHNlLFxuICAgIGlzUHVhdm86IGZhbHNlLFxuICAgIFxuICAgIHZlcnNpb246ICcyLjAuMC4xJyxcbiAgICBidWlsZERhdGU6ICcyMDI2MDIwMycsXG4gICAgYnVpbGROdW1iZXI6ICcxJyxcbiAgICBpbmZvOiAnUmVsZWFzZSdcbn1cbmV4cG9ydCBkZWZhdWx0IGNvbmZpZztcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBpcyB0aGUgRUxFQ1RST04gbWFpbiBmaWxlIHRoYXQgYWN0dWFsbHkgb3BlbnMgdGhlIGVsZWN0cm9uIHdpbmRvd1xuICovXG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgY2hhbGsgZnJvbSAnY2hhbGsnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBwb3dlclNhdmVCbG9ja2VyLCBuYXRpdmVUaGVtZSwgZ2xvYmFsU2hvcnRjdXQsIFRyYXksIE1lbnUsIGRpYWxvZywgc2Vzc2lvbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgY29uZmlnIGZyb20gJy4vbWFpbi9jb25maWcuanMnO1xuaW1wb3J0IG11bHRpY2FzdENsaWVudCBmcm9tICcuL21haW4vc2NyaXB0cy9tdWx0aWNhc3RjbGllbnQuanMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0ICogYXMgZnNFeHRyYSBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9jb21tdW5pY2F0aW9uaGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2lwY2hhbmRsZXIuanMnXG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMnXG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBjaGVja1BhcmVudFByb2Nlc3MgfSBmcm9tICcuL21haW4vc2NyaXB0cy9jaGVja3BhcmVudC5qcyc7XG5cbmltcG9ydCB7IHRvZ2dsZU1hY09TTG9ja2Rvd24gfSBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcydcbkpyZUhhbmRsZXIuaW5pdCgpXG5cblxuXG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsYW5nJywgJ2RlJyk7XG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdlbmFibGUtdW5zYWZlLXN3aWZ0c2hhZGVyJyk7XG5hcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdsb2ctbGV2ZWwnLCAnMycpOyAvLyAzID0gV0FSTiwgMiA9IEVSUk9SLCAxID0gSU5GT1xuXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS1mZWF0dXJlcycsICdWYWFwaVZpZGVvRGVjb2RlcixPdXRPZlByb2Nlc3NSYXN0ZXJpemF0aW9uLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgLy8gZGlzYWJsZSBmcmFnaWxlIEdQVSBmZWF0dXJlc1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2Rpc2FibGUtemVyby1jb3B5Jyk7IFxufVxuZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2Rhcndpbicpe1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS1mZWF0dXJlcycsICdNZXRhbCxDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7ICAvLyBtYWNvcyBvbmx5XG59XG5cblxuXG5cblxubG9nLmluaXRpYWxpemUoKTsgLy8gaW5pdGlhbGl6ZSB0aGUgbG9nZ2VyIGZvciBhbnkgcmVuZGVyZXIgcHJvY2Vzc1xubG9nLmV2ZW50TG9nZ2VyLnN0YXJ0TG9nZ2luZygpO1xubG9nLmVycm9ySGFuZGxlci5zdGFydENhdGNoaW5nKCk7XG5sb2cudHJhbnNwb3J0cy5maWxlLnJlc29sdmVQYXRoRm4gPSAoKSA9PiB7IHJldHVybiBwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZSAgfVxuXG5sb2cudHJhbnNwb3J0cy5jb25zb2xlLmZvcm1hdCA9IChtZXNzYWdlKSA9PiB7XG4gICAgLy8gQWx3YXlzIHJldHVybiBhbiBhcnJheSwgbm90IHN0cmluZ3MhXG4gICAgc3dpdGNoIChtZXNzYWdlLmxldmVsKSB7XG4gICAgICBjYXNlICdpbmZvJzogcmV0dXJuIFtjaGFsay5ncmVlbihtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnd2Fybic6IHJldHVybiBbY2hhbGsueWVsbG93KG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICdlcnJvcic6IHJldHVybiBbY2hhbGsucmVkKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICdkZWJ1Zyc6IHJldHVybiBbY2hhbGsuYmx1ZShtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAndmVyYm9zZSc6IHJldHVybiBbY2hhbGsubWFnZW50YShtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgZGVmYXVsdDogICAgIHJldHVybiBbU3RyaW5nKG1lc3NhZ2UuZGF0YSldO1xuICAgIH1cbn07XG5cbmxvZy52ZXJib3NlKClcbmxvZy52ZXJib3NlKGBtYWluOiAtLS0tLS0tLS0tLS0tLS0tLS0tYClcbmxvZy52ZXJib3NlKGBtYWluOiBzdGFydGluZyBOZXh0LUV4YW0gU3R1ZGVudCBcIiR7Y29uZmlnLnZlcnNpb259ICR7Y29uZmlnLmluZm99XCIgKCR7cHJvY2Vzcy5wbGF0Zm9ybX0pJHtjb25maWcuZGV2ZWxvcG1lbnQgPyAnIChkZXZtb2RlIG9uKScgOiAnJ31gKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLmluZm8oYG1haW46IExvZ2ZpbGVsb2NhdGlvbiBhdCAke3BsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlfWApXG5wbGF0Zm9ybURpc3BhdGNoZXIubWVzc2FnZXMuZm9yRWFjaChtZXNzYWdlID0+IHsgbG9nLmRlYnVnKG1lc3NhZ2UpIH0pO1xuXG4vLyBsb2cgZWxlY3Ryb24gdmVyc2lvbiBhbmQgb3RoZXIgcGxhdGZvcm0gaW5mb3JtYXRpb25cbmxvZy5kZWJ1ZyhgbWFpbjogRWxlY3Ryb24gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmVsZWN0cm9ufWApXG5sb2cuZGVidWcoYG1haW46IENocm9taXVtIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5jaHJvbWV9YClcbmxvZy5kZWJ1ZyhgbWFpbjogTm9kZSB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMubm9kZX1gKVxubG9nLmRlYnVnKGBtYWluOiBWOCB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMudjh9YClcbmxvZy5kZWJ1ZyhgbWFpbjogT1M6ICR7cHJvY2Vzcy5wbGF0Zm9ybX0gJHtwcm9jZXNzLmFyY2h9YClcbmxvZy5kZWJ1ZyhgbWFpbjogQXJjaDogJHtwcm9jZXNzLmFyY2h9YClcblxuXG5XaW5kb3dIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAvLyBtYWlud2luZG93LCBleGFtd2luZG93LCBibG9ja3dpbmRvd1xuQ29tbUhhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgICAgLy8gc3RhcnRzIFwiYmVhY29uXCIgaW50ZXJ2YWxsIGFuZCBmZXRjaGVzIGluZm9ybWF0aW9uIGZyb20gdGhlIHRlYWNoZXIgLSBhY3RzIG9uIGl0IChzdGFydGV4YW0sIHN0b3BleGFtLCBzZW5kZmlsZSwgZ2V0ZmlsZSlcbklwY0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZywgV2luZG93SGFuZGxlciwgQ29tbUhhbmRsZXIpICAvL2NvbnRyb2xsIGFsbCBJbnRlciBQcm9jZXNzIENvbW11bmljYXRpb25cblxuLy8gUHJldmVudHMgRWxlY3Ryb24gZnJvbSBjcmVhdGluZyB0aGUgZGVmYXVsdCBtZW51XG5NZW51LnNldEFwcGxpY2F0aW9uTWVudShudWxsKTtcblxuXG5pZiAoIWFwcC5yZXF1ZXN0U2luZ2xlSW5zdGFuY2VMb2NrKCkpIHsgIC8vIGFsbG93IG9ubHkgb25lIGluc3RhbmNlIG9mIHRoZSBhcHAgcGVyIGNsaWVudFxuICAgIGxvZy53YXJuKFwibWFpbiBAIHNpbmdsZWluc3RhbmNlOiBuZXh0LWV4YW0gYWxyZWFkeSBydW5uaW5nLlwiKVxuICAgIGFwcC5xdWl0KClcbiAgICBwcm9jZXNzLmV4aXQoMClcbn1cblxuYXBwLm9uKCdzZWNvbmQtaW5zdGFuY2UnLCAoKSA9PiB7XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IHByZXZlbnRlZCBzZWNvbmQgc3RhcnQgb2YgbmV4dC1leGFtLiBSZXN0b3JpbmcgZXhpc3RpbmcgTmV4dC1FeGFtIHdpbmRvdy5cIilcbiAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93KSB7XG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNNaW5pbWl6ZWQoKSB8fCAhV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpXG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cucmVzdG9yZSgpXG4gICAgICAgIH0gXG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5mb2N1cygpIC8vIEZvY3VzIG9uIHRoZSBtYWluIHdpbmRvdyBpZiB0aGUgdXNlciB0cmllZCB0byBvcGVuIGFub3RoZXJcbiAgICB9XG59KVxuXG5cbi8qKlxuICogYWRkaXRpb25hbCBjb25maWcgc2V0dGluZ3MgYW5kIHBhdGggY2hlY2tzXG4gKi9cblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY29uZmlnLmVsZWN0cm9uID0gdHJ1ZVxuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgKCkgPT4geyAgLy8gaWYgd2luZG93IGlzIGNsb3NlZFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcbiAgICBhcHAucXVpdCgpICAgXG59KVxuXG5hcHAub24oJ3dpbGwtcXVpdCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKGZhbHNlKVxufSlcblxuYXBwLm9uKCdiZWZvcmUtcXVpdCcsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLmNsZWFyU3RvcmFnZURhdGEoe30pOyAvLyBjbGVhciBjb29raWVzLCBjYWNoZSwgbG9jYWxTdG9yYWdlIGV0Yy5cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgYmVmb3JlLXF1aXQ6IEVycm9yIGNsZWFyaW5nIGNhY2hlOicsIGVycik7XG4gICAgfVxufSk7XG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQnJvd3NlclZpZXcsIGRpYWxvZywgc2NyZWVufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCB7IGFjdGl2ZVdpbmRvdyB9IGZyb20gJ2dldC13aW5kb3dzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tIFwibm9kZTp1cmxcIjtcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIFdpbmRvdyBoYW5kbGluZyAoaXBjUmVuZGVyZXIgUHJvY2VzcyAtIEZyb250ZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2tXaW5kb3cgPSBudWxsXG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNlcnZlZCBkaXNwbGF5IElEIGZvciBleGFtIHdpbmRvdyAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gd2luZG93IGlzIGNyZWF0ZWQpXG4gICAgICB0aGlzLnNwbGFzaHdpbiA9IG51bGxcbiAgICAgIHRoaXMuYmlwd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICBcbiAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgcXVlc3Rpb24gZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBtaW5pbWl6ZSB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMud2luZG93VHJhY2tlci5iaW5kKHRoaXMpLCAxMDAwKVxuICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gZWxlY3Ryb24gd2luZG93IGluIGZvY3VzIG9yIGFuIG90aGVyIGVsZWN0cm9uIHdpbmRvdyBkZXBlbmRpbmcgb24gdGhlIGhpZXJhY2h5XG4gICAgZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgICAgICAgaWYgKGZvY3VzZWRXaW5kb3cpIHtcbiAgICAgICAgICByZXR1cm4gZm9jdXNlZFdpbmRvd1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVubG9ja1dpbmRvdyl7cmV0dXJuIHRoaXMuc2NyZWVubG9ja1dpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZXhhbXdpbmRvdyl7cmV0dXJuIHRoaXMuZXhhbXdpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubWFpbndpbmRvdyl7cmV0dXJuIHRoaXMubWFpbndpbmRvd31cbiAgICAgICAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEwMDAsXG4gICAgICAgICAgICBoZWlnaHQ6ODAwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcImRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIm5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwidGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ0NhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhbiBlYXN0ZXIgZWdnXG4gICAgICovXG4gICAgY3JlYXRlRWFzdGVyV2luKCkge1xuICAgICAgICB0aGlzLmVhc3RlcndpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiA3NjgsXG4gICAgICAgICAgICBoZWlnaHQ6NDgwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IHRydWUsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ubG9hZEZpbGUoam9pbihfX2Rpcm5hbWUsIGAuLi8uLi9wdWJsaWMvY293c29uaWNlL2luZGV4Lmh0bWxgKSlcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuZWFzdGVyd2luICYmICF0aGlzLmVhc3Rlcndpbi5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZWFzdGVyd2luLnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQmxvY2tXaW5kb3cgKHRvIGNvdmVyIGFkZGl0aW9uYWwgc2NyZWVucylcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBuZXdCbG9ja1dpbihkaXNwbGF5KSB7XG4gICAgICAgIGxldCBibG9ja3dpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICBwYXJlbnQ6IHRoaXMuZXhhbXdpbmRvdyxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAgIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBcIm5vdGZvdW5kXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBibG9ja3dpbi5yZW1vdmVNZW51KCkgXG4gICAgICAgIGJsb2Nrd2luLnNldE1pbmltaXphYmxlKGZhbHNlKVxuXG4gICAgICAgIC8vIFBvc2l0aW9uIHdpbmRvdyBvbiBzcGVjaWZpYyBkaXNwbGF5IEJFRk9SRSBzaG93aW5nIGl0XG4gICAgICAgIGJsb2Nrd2luLnNldEJvdW5kcyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54LFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJsb2Nrd2luLnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICBibG9ja3dpbi5zaG93KClcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7XG4gICAgICAgICAgICBibG9ja3dpbi5vbignbGVhdmUtZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTsgLy8gc29mb3J0IHdpZWRlciB6dXJcdTAwRkNja3NldHplblxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9ICBcbiAgICAgICAgZWxzZSB7ICAgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRLaW9zayh0cnVlKTsgLy8gS2lvc2sgPSBcInRha2Ugb3ZlciBtYWluIHNjcmVlblwiLiBvbiBtYWNvcyB0aGF0J3Mgd2h5IHdlIHVzZSBmdWxsU2NyZWVuIHdvcmthcm91bmQgd2l0aCBldmVudCBsaXN0ZW5lclxuICAgICAgICB9XG4gICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgYmxvY2t3aW4uZGlzcGxheSA9IGRpc3BsYXlcbiAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MucHVzaChibG9ja3dpbilcbiAgICB9XG5cblxuICAgIC8vIGJsb2NrIGFsbCBzY3JlZW5zIHdpdGggYSBibG9ja3dpbmRvd1xuICAgIGFzeW5jIGluaXRCbG9ja1dpbmRvd3MoKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgLy9sb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGZvdW5kICR7ZGlzcGxheXMubGVuZ3RofSBkaXNwbGF5c2ApXG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7ICAvLyBsb2NrIGFsbCBzY3JlZW5zXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBleGFtIHdpbmRvdyB0byBiZSB2aXNpYmxlIGFuZCBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldHJpZXMgPSAwXG4gICAgICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwXG4gICAgICAgICAgICAgICAgd2hpbGUgKCF0aGlzLmV4YW13aW5kb3cuaXNWaXNpYmxlKCkgJiYgcmV0cmllcyA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApXG4gICAgICAgICAgICAgICAgICAgIHJldHJpZXMrK1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHdhaXQgdG8gZW5zdXJlIHBvc2l0aW9uaW5nIGlzIGNvbXBsZXRlIG9uIFdheWxhbmRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIGJsb2NrIHdpbmRvd3MgZnJvbSBhcnJheVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSB0aGlzLmJsb2Nrd2luZG93cy5maWx0ZXIoYmxvY2t3aW4gPT4gYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBhbGwgZXhpc3Rpbmcgd2luZG93cyBhbmQgZGV0ZXJtaW5lIHRoZWlyIGRpc3BsYXlzXG4gICAgICAgICAgICBjb25zdCB1c2VkRGlzcGxheUlkcyA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaXJzdCwgdXNlIHRoZSByZXNlcnZlZCBleGFtIGRpc3BsYXkgSUQgKHNldCBpbW1lZGlhdGVseSB3aGVuIGV4YW0gd2luZG93IHdhcyBjcmVhdGVkKVxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBzY3JlZW4gaXMgcmVzZXJ2ZWQgZXZlbiBpZiB0aGUgd2luZG93IGlzbid0IGZ1bGx5IGluaXRpYWxpemVkIHlldFxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbURpc3BsYXlJZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZCh0aGlzLmV4YW1EaXNwbGF5SWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFsd2F5cyBleGNsdWRlIHByaW1hcnkgZGlzcGxheSAoZXhhbSB3aW5kb3cgbG9jYXRpb24pXG4gICAgICAgICAgICBjb25zdCBwcmltYXJ5RGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAocHJpbWFyeURpc3BsYXkgJiYgcHJpbWFyeURpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQocHJpbWFyeURpc3BsYXkuaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGV4YW0gd2luZG93IGRpc3BsYXkgKGFzIGZhbGxiYWNrL3ZlcmlmaWNhdGlvbiwgYnV0IHJlc2VydmVkIElEIHRha2VzIHByaW9yaXR5KVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBleGFtIHdpbmRvdyBpcyBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGV4YW0gd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBibG9jayB3aW5kb3dzIGRpc3BsYXlzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGJsb2Nrd2luIG9mIHRoaXMuYmxvY2t3aW5kb3dzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gYmxvY2t3aW4uZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBibG9jayB3aW5kb3cgZm91bmQgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBibG9jayB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBibG9jayB3aW5kb3dzIGZvciBkaXNwbGF5cyB0aGF0IGRvbid0IGhhdmUgZXhhbSBvciBibG9jayB3aW5kb3dzXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBpZiAodXNlZERpc3BsYXlJZHMuaGFzKGRpc3BsYXkuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogc2tpcHBpbmcgZGlzcGxheSAke2Rpc3BsYXkuaWR9IC0gYWxyZWFkeSBoYXMgZXhhbSBvciBibG9jayB3aW5kb3dgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBjcmVhdGUgYmxvY2t3aW4gb246XCIsZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0Jsb2NrV2luKGRpc3BsYXkpICAvLyBhZGQgYmxvY2t3aW5kb3dzIGZvciBkaXNwbGF5cyB3aXRob3V0IGV4YW0gd2luZG93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMClcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLmZvckVhY2goIChibG9ja3dpbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFNjcmVlbmxvY2sgV2luZG93ICh0byBjb3ZlciB0aGUgbWFpbnNjcmVlbikgLSBibG9jayBzdHVkZW50cyBmcm9tIHdvcmtpbmdcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBjcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IHNjcmVlbmxvY2tXaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHRoaXMubWFpbndpbmRvdywgICAvLyBsZWFkcyB0byB2aXNpYmxlIHRpdGxlYmFyIGluIGdub21lLWRlc2t0b3BcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ1NjcmVlbmxvY2snLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIC8vZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCB1cmwgPSBcImxvY2tcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgLy8gQWRkIHdpbmRvdyB0byBhcnJheSBmaXJzdCwgYmVmb3JlIGFkZGluZyBibHVyIGxpc3RlbmVyXG4gICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MucHVzaChzY3JlZW5sb2NrV2luZG93KVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICghc2NyZWVubG9ja1dpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnJlbW92ZU1lbnUoKSBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0TWluaW1pemFibGUoZmFsc2UpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwicG9wLXVwLW1lbnVcIiwgMSkgICAvL2Fib3ZlIGV4YW0gd2luZG93IChwb3AtdXAtbWVudSwgMClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2hvdygpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0Q2xvc2FibGUodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlKTsgLy8gcHV0IHRoZSB3aW5kb3cgb24gYWxsIHZpcnR1YWwgd29ya3NwYWNlc1xuICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoXCJzY3JlZW5sb2NrXCIpXG4gICAgICAgIH0pXG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0gIFxuICAgICAgICB9KTtcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZWQnLCAoKSA9PiB7ICAgLy8gcmVtb3ZlIHdpbmRvdyBmcm9tIGFycmF5IHdoZW4gYWN0dWFsbHkgY2xvc2VkXG4gICAgICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiB3aW4gIT09IHNjcmVlbmxvY2tXaW5kb3cgJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRXhhbXdpbmRvd1xuICAgICAqIEBwYXJhbSBleGFtdHlwZSBlZHV2aWR1YWwsIG1hdGgsIGxhbmd1YWdlXG4gICAgICogQHBhcmFtIHRva2VuIHN0dWRlbnQgdG9rZW5cbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIHRoZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0IGNvbnRhaW5pbmcgaW5mbyBhYm91dCBzcGVsbGNoZWNrIGxhbmd1YWdlIGV0Yy4gXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlRXhhbVdpbmRvdyhleGFtdHlwZSwgdG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeWRpc3BsYXkpIHtcbiAgICAgICAgLy8ganVzdCB0byBiZSBzdXJlIHdlIGNoZWNrIHNvbWUgaW1wb3J0YW50IHZhcnMgaGVyZVxuICAgICAgICBpZiAoZXhhbXR5cGUgIT09IFwicmRwXCIgJiYgZXhhbXR5cGUgIT09IFwid2Vic2l0ZVwiICYmICBleGFtdHlwZSAhPT0gXCJnZm9ybXNcIiAmJiBleGFtdHlwZSAhPT0gXCJlZHV2aWR1YWxcIiAmJiBleGFtdHlwZSAhPT0gXCJlZGl0b3JcIiAmJiBleGFtdHlwZSAhPT0gXCJtYXRoXCIgJiYgZXhhbXR5cGUgIT09IFwibWljcm9zb2Z0MzY1XCIgJiYgZXhhbXR5cGUgIT09IFwiYWN0aXZlc2hlZXRzXCIgfHwgIXRva2VuKXsgIC8vIGZvciBub3cuLiB3ZSBwcm9iYWJseSBzaG91bGQgc3RvcCBldmVyeXRoaW5nIGhlcmVcbiAgICAgICAgICAgIGxvZy53YXJuKFwibWlzc2luZyBwYXJhbWV0ZXJzIGZvciBleGFtLW1vZGUgb3IgbW9kZSBub3QgaW4gYWxsb3dlZCBsaXN0IVwiKVxuICAgICAgICAgICAgZXhhbXR5cGUgPSBcImVkaXRvclwiIFxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgLy8gQWx3YXlzIHVzZSBwcmltYXJ5IGRpc3BsYXkgZm9yIGV4YW0gd2luZG93XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcyB8fCAhcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IGRpc3BsYXlzWzBdIHx8IHByaW1hcnlkaXNwbGF5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEltbWVkaWF0ZWx5IHJlc2VydmUgdGhlIGRpc3BsYXkgSUQgZm9yIHRoZSBleGFtIHdpbmRvdyAoYmVmb3JlIHdpbmRvdyBpcyBmdWxseSBpbml0aWFsaXplZClcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBibG9jayB3aW5kb3dzIGZyb20gYmVpbmcgY3JlYXRlZCBvbiB0aGUgc2FtZSBzY3JlZW5cbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBwcmltYXJ5ZGlzcGxheS5pZFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiByZXNlcnZpbmcgZGlzcGxheSAke3RoaXMuZXhhbURpc3BsYXlJZH0gZm9yIGV4YW0gd2luZG93YClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHB4ID0gMFxuICAgICAgICBsZXQgcHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzLngpIHtcbiAgICAgICAgICAgIHB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnhcbiAgICAgICAgICAgIHB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IHB4ICsgMCxcbiAgICAgICAgICAgIHk6IHB5ICsgMCxcbiAgICAgICAgICAgIHRpdGxlOiAnRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogMTQ0MCxcbiAgICAgICAgICAgIGhlaWdodDogNzY4LFxuICAgICAgICAgICAgLy8gcGFyZW50OiB3aW4sICAvL3RoaXMgZG9lc250IHdvcmsgdG9nZXRoZXIgd2l0aCBraW9zayBvbiB1YnVudHUgZ25vbWUgPz8gd3RmXG4gICAgICAgICAgICAvLyBtb2RhbDogdHJ1ZSwgIC8vIHRoaXMgYmxvY2tzIHRoZSBtYWluIHdpbmRvdyBvbiB3aW5kb3dzIHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBvcGVuXG4gICAgICAgICAgICAvLyBjbG9zYWJsZTogZmFsc2UsICAvLyBpZiB3ZSBjYW4ndCBkZWZpbmUgJ3BhcmVudCcgdGhpcyB3aW5kb3cgaGFzIHRvIGJlIGNsb3NhYmxlIC0gd2h5P1xuICAgICAgICAgICAgLy9hbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIGtpb3NrOiB0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNvbnRleHRJc29sYXRpb246IHRydWUsXG4gICAgICAgICAgICAgICAgd2Vidmlld1RhZzogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJTZWN1cml0eTogZmFsc2UgICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmV4YW13aW5kb3cpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5yZW1vdmVNZW51KCkgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIHByb2JhYmx5IG5vdCBuZWVkZWQgYmVjYXVzZSB3ZSBkaXNhYmxlIG1pc3Npb25jb250cm9sIGFueXdheXMgLSBzZWVtcyB0byBpbnRlcmZlcmUgd2l0aCBraW9zayBtb2RlIG9uIG1hY29zIChhZ2FpbilcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhpcy5leGFtd2luZG93LnNldFZpc2libGVPbkFsbFdvcmtzcGFjZXModHJ1ZSwgeyB2aXNpYmxlT25GdWxsU2NyZWVuOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1dheWxhbmQpeyB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RhcnQoKSB9IC8vIGNvbnN0YW50bHkgY2hlY2sgaWYgdGhlIGFjdGl2ZSB3aW5kb3cgaXMgdGhlIGV4YW13aW5kb3cgLSBpZiBub3QsIGJyaW5nIGl0IHRvIGZyb250XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyh0aGlzKSAgLy8gZGlzYWJsZSBrZXlib2FyZCBzaG9ydGN1dHMgZXRjLlxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKSAgLy8gZG8gbm90IHNldCBibHVyIGxpc3RlbmVyIHRvbyBlYXJseVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcigpICAvLyBhZGQgYmx1ciBsaXN0ZW5lciB0byB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKFwid2luZG93aGFuZGxlciBAIGRpZC1maW5pc2gtbG9hZDogZXJyb3IgaW4gZXhhbXdpbmRvdyBzZXR1cFwiLCBlKX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXJ2ZXJzdGF0dXMgPSBzZXJ2ZXJzdGF0dXMgLy93ZSBrZWVwIGl0IHRoZXJlIHRvIG1ha2UgaXQgYWNjZXNzYWJsZSB2aWEgZXhhbXdpbmRvdyBpbiBpcGNIYW5kbGVyXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0ID0gOTQgICAvLyBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIGNvbnRlbnQgdmlld1xuICAgICAgICBcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWljcm9zb2Z0IDM2NSBlbWViZWRzIGl0cyBlZGl0b3IgaW4gYW4gaWZyYW1lIHdpdGggYWN0aXZlIENvbnRlbnQgU2VjdXJpdHkgUG9saWN5IChDU1ApXG4gICAgICAgICAqIFRoZSBvbmx5IHdheSB0byBiZSBhYmxlIHRvIGluamVjdCBjb2RlIGlzIHRvIGxvYWQgaXQgZGlyZWN0bHkgaW4gdGhlIG1haW4gd2luZG93IDxlbWJlZD4gPGlmcmFtZT4gb3IgZXZlbiA8d2Vidmlldz4gb2ZmZXJzIG5vIHdvcmthcm91bmRcbiAgICAgICAgICogdGhlcmVmb3JlIHdlIHVzZSBcIkJyb3dzZXJWaWV3XCIgaW4gb3JkZXIgdG8gZGlzcGxheSB0d28gcGFnZXMgaW4gb25lIHdpbmRvdzogb24gdG9wID4gZXhhbSBoZWFkZXIsIG9uIGJvdHRvbSA+IG9mZmljZVxuICAgICAgICAgKi9cblxuICAgICAgICBpZiAoZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIgICkgeyAvL2V4dGVybmFsIHBhZ2VcbiAgICAgICAgICAgIGxvZy5pbmZvKFwic3RhcnRpbmcgbWljcm9zb2Z0MzY1IGV4YW0uLi5cIilcbiAgICAgICAgICAgIGxldCB1cmx2aWV3ID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICAgXG4gICAgICAgICAgICBpZiAoIXVybHZpZXcpIHsvLyB3ZSB3YWl0IGZvciB0aGUgbmV4dCB1cGRhdGUgdGljayAtIG1zb2ZmaWNlc2hhcmUgbmVlZHMgdG8gYmUgc2V0ICEgKGNvdWxkIGhhcHBlbiB3aGVuIGEgc3R1ZGVudCBjb25uZWN0cyBsYXRlciB0aGVuIGV4YW0gbW9kZSBpcyBzZXQgYnV0IGhpcyBzaGFyZSB1cmwgbmVlZHMgc29tZSB0aW1lKVxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IG5vIHVybCBmb3IgbWljcm9zb2Z0MzY1IHdhcyBzZXQgeWV0IC0gd2FpdGluZyBmb3IgbmV4dCB1cGRhdGUgdGlja1wiKVxuICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgZGVzdHJveWVkXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxvYWQgdG9wIG1lbnUgaW4gTWFpblBhZ2VcbiAgICAgICAgICAgIGxldCB1cmwgPSBleGFtdHlwZSAgIC8vIGVkaXRvciB8fCBtYXRoIHx8IGVkdXZpZHVhbCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgYmFja2dyb3VuZHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTChiYWNrZ3JvdW5kdXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlZmluZSB0aGUgTWFpbkNvbnRlbnRQYWdlIHZpZXdcbiAgICAgICAgICAgIGxldCBjb250ZW50VmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLCAgXG4gICAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEF1dG9SZXNpemUoeyB3aWR0aDogdHJ1ZSwgaGVpZ2h0OiB0cnVlLCBob3Jpem9udGFsOiB0cnVlLCB2ZXJ0aWNhbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsdmlldyk7XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7ICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpIH1cblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdlbnRlci1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdyZXNpemUnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSBub3JtYWwgZXhhbSBtb2RlIChlZGl0b3IsIG1hdGgsIGVkdXZpZHVhbCwgd2Vic2l0ZSwgZ2Zvcm1zKVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aCA9IGpvaW4oX19kaXJuYW1lLCBgLi4vcmVuZGVyZXIvaW5kZXguaHRtbGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGUgc3BlY2lhbCBOQVZJR0FUSU9OIHNpdHVhdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBGb3JtcywgV2Vic2l0ZSwgRWR1dmlkdWFsLCBFZGl0b3IsIFJEUCwgTWljcm9zb2Z0MzY1XG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gZXhhbXdpbmRvdy53ZWJDb250ZW50cyBsZXZlbCBmb3IgYWxsIG1vZGVzIHRoYXQgY2FuIGRpc3BsYXkgUERGcyBpbiBleGFtaGVhZGVyXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgbmF2aWdhdGlvbiB3aGVuIGNsaWNraW5nIGxpbmtzIGluIFBERnMgZGlzcGxheWVkIGluIHRoZSBleGFtaGVhZGVyXG4gICAgICAgIC8vIFdlYnZpZXcvQnJvd3NlclZpZXcgYmxvY2tpbmcgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5IHZpYSBJUEMgaW4gaXBjaGFuZGxlci5qcyBvciBtb2RlLXNwZWNpZmljIGhhbmRsZXJzIGJlbG93XG4gICAgICAgIGNvbnN0IGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlciA9IFtcImdmb3Jtc1wiLCBcIndlYnNpdGVcIiwgXCJlZHV2aWR1YWxcIiwgXCJlZGl0b3JcIiwgXCJyZHBcIiwgXCJtaWNyb3NvZnQzNjVcIiwgXCJhY3RpdmVzaGVldHNcIiwgXCJtYXRoXCJdO1xuICAgICAgICBpZiAoZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyLmluY2x1ZGVzKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBWdWUgYXBwIChlLmcuIGZyb20gUERGIGxpbmtzIGluIGV4YW1oZWFkZXIpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gUHJldmVudCBuZXcgd2luZG93cyBmcm9tIG9wZW5pbmcgaW4gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgbmV3LXdpbmRvd1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBzZXRXaW5kb3dPcGVuSGFuZGxlclwiLCB1cmwpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIE1pY3Jvc29mdCBFeGNlbC9Xb3JkXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIpeyAgLy8gZG8gbm90IHVuZGVyIGFueSBjaXJjdW1zdGFuY2VzIGFsbG93IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBjdXJyZW50IGV4YW0gdXJsXG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHVzZXIgd2FudHMgdG8gbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgcGFnZVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJkbyBub3QgbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgdGVzdC4uIFwiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0ZUNvZGUgPSAgYFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBsb2NrKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAnV0FDRGlhbG9nT3V0ZXJDb250YWluZXInLCdXQUNEaWFsb2dJbm5lckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ1BhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZGV1c0J5SUQgPSBbJ1Nob3dIaWRlRXF1YXRpb25Ub29sc1BhbmUnLCdMaW5rR3JvdXAnLCdHcmFwaGljc0VkaXRvcicsJ0luc2VydFRhYmxlT2ZDb250ZW50c0luSW5zZXJ0VGFiJywnSW5zZXJ0T25saW5ldmlkZW8nLCdQaWN0dXJlJywnUmliYm9uLVBpY3R1cmVNZW51TUxSRHJvcGRvd24nLCdJbnNlcnRBZGRJbkZseW91dCcsJ0Rlc2lnbmVyJywnRWRpdG9yJywnRmFyUGFuZScsJ0hlbHAnLCdJbnNlcnRBcHBzRm9yT2ZmaWNlJywnRmlsZU1lbnVMYXVuY2hlckNvbnRhaW5lcicsJ0hlbHAtd3JhcHBlcicsJ1Jldmlldy13cmFwcGVyJywnSGVhZGVyJywnRmFyUGVyaXBoZXJhbENvbnRyb2xzQ29udGFpbmVyJywnQnVzaW5lc3NCYXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChlbnRyeSBvZiBoaWRldXNCeUlEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJkaXNwbGF5XCIsIFwibm9uZVwiLCBcImltcG9ydGFudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBidXR0b25BcHBzT3ZlcmZsb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnQWRkLUlucycpWzBdOyAgLy8gdGhpcyBidXR0b24gaXMgcmVkcmF3biBvbiByZXNpemUgKGRvZXNuJ3QgaGFwcGVuIGluIGV4YW0gbW9kZSBidXQgc3RpbGwgdGhlcmUgbXVzdCBiZSBhIGNsZWFuZXIgd2F5IC0gaW5zZXJ0aW5nIGNzcyBiZWZvcmUgaXQgYXBwZWFycyBpcyBub3Qgd29ya2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidXR0b25BcHBzT3ZlcmZsb3cpeyBidXR0b25BcHBzT3ZlcmZsb3cuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJTdWNoZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJcdTAwRENiZXJzZXR6ZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJDb3BpbG90XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkFkZC1JbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwQ29udGV4dE1lbnVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cFN5bm9ueW1zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlJpYmJvbi1SZWZlcmVuY2VzU21hcnRMb29rVXBcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJEaWN0YXRpb25cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkdldEFkZGluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUGljdHVyZXNfTUxSXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pOyAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9jaygpICAvL2ZvciBzb21lIHJlYXNvbiBleGNlbCBkZWxheXMgdGhhdCBjYWxsLi4gZG9lc250IGhhcHBlbiBvbiBwYWdlIGZpbmlzaCBsb2FkXG4gICAgICAgICAgICAgICAgICAgIGBcblxuICAgICAgICAgICAgbGV0IHNjaGVkdWxlckluc3RhbmNlID0gbnVsbFxuICAgICAgICAgICAgdGhpcy5sb2NrQ2FsbGJhY2sgPSAoKSA9PiB0aGlzLmxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSk7IFxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmxvY2tDYWxsYmFjaywgNDAwKVxuICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gc2NoZWR1bGVySW5zdGFuY2VcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0YXJ0KClcbiAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgdGhlIHdlYkNvbnRlbnRzIGlzIGZ1bGx5IGxvYWRlZCAgLy8gdGhpcyBpcyBub3Qgd29ya2luZyByZWxpYWJseSBiZWNhdXNlIHRoZSBwYWdlIGlzIGxvYWRlZCBpbiBtYW55IHN0ZXBzIGFuZCB0aGUgdWkgZWxlbWVudHMgYXJlIG5vdCBhdmFpbGFibGUgeWV0XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2FwcC1jb21tYW5kJywgKGUsIGNtZCkgPT4ge1xuICAgICAgICAgICAgLy8gJ2Jyb3dzZXItYmFja3dhcmQnIHVuZCAnYnJvd3Nlci1mb3J3YXJkJyBzaW5kIGRpZSBCZWZlaGxlLCBkaWUgYmVpbSBLbGljayBhdWYgZGllIE1hdXN0YXN0ZW4gZ2VzZW5kZXQgd2VyZGVuXG4gICAgICAgICAgICBpZiAoY21kID09PSAnYnJvd3Nlci1iYWNrd2FyZCcgfHwgY21kID09PSAnYnJvd3Nlci1mb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwibm8gbmF2aWdhdGlvbiBhbGxvd2VkXCIpXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJuIFNpZSBkYXMgU3RhbmRhcmR2ZXJoYWx0ZW5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICAvL2Rpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KSAgLy9kbyBub3QgZGlzYWJsZSB0d2ljZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgbG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKXtcbiAgICAgICAgaWYgKGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzICYmIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZSl7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIiwgZnJhbWUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUgJiYgKGZyYW1lLm5hbWUgPT09ICdXZWJBcHBsaWNhdGlvbkZyYW1lJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfV29yZF8wJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfRXhjZWxfMCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiKVxuICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IHN0b3BwaW5nIGxvY2tTY2hlZHVsZXJcIilcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0b3AoKVxuICAgICAgICAgICAgaWYgKHRoaXMubG9ja1NjaGVkdWxlciA9PT0gc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogbm8gYnJvd3NlclZpZXcgb3IgbG9ja1NjaGVkdWxlciBmb3VuZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTUFJTiBXSU5ET1dcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGFzeW5jIGNyZWF0ZU1haW5XaW5kb3coKSB7XG4gICAgICAgIGxldCBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpWzBdXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaW5kb3cgZGltZW5zaW9ucyAtIGRlZmluZWQgb25jZSwgdXNlZCBldmVyeXdoZXJlXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gMTAyNFxuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSA2NDBcblxuICAgICAgICAvLyBDYWxjdWxhdGUgY2VudGVyIHBvc2l0aW9uIG9uIHByaW1hcnkgZGlzcGxheVxuICAgICAgICBsZXQgeCA9IDBcbiAgICAgICAgbGV0IHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy53aWR0aCAtIHdpbmRvd1dpZHRoKSAvIDIpXG4gICAgICAgICAgICB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnkgKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMuaGVpZ2h0IC0gd2luZG93SGVpZ2h0KSAvIDIpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ01haW4gd2luZG93JyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgIHdpZHRoOiB3aW5kb3dXaWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogd2luZG93SGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDg1MCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogNjAwLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkYXMgXHUwMEM0bmRlcm4gZGVyIEdyXHUwMEY2XHUwMERGZSAgXG4gICAgICAgICAgICBmdWxsc2NyZWVuYWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGVuIFZvbGxiaWxkbW9kdXMgLSB3aWNodGlnIGZcdTAwRkNyIG1hY29zIGRlbm4gd2VubiBhdWYgbWFjb3MgZGFzIG1haW53aW5kb3cgYXVmIGZ1bGxzY3JlZW4gaXN0IGdyZWlmdCBiZWltIGV4YW13aW5kb3cgZGVyIGtpb3NrIG1vZGUgbmljaHQgIC0gZWxlY3Ryb24gYnVnIChuZWVkcyBleGFtcGxlIGNvZGUpOiA+PiBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzQ0NzU1XG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgLy92aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnREaXIsXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTilcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRUaHJvdHRsaW5nOiB0cnVlICAvLyBhbGxvdyB0aHJvdHRsaW5nIHdoZW4gd2luZG93IGlzIGluIGJhY2tncm91bmRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBoYW5kbGVycyBiZWZvcmUgbG9hZGluZ1xuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmICF0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0KSB7ICAvLyBhbGxvd2V4aXQgaXN0IGVpbiBvdmVycmlkZSB2b20gY29udGV4dCBtZW51IG9kZXIgc2NyZWVuc2hvdCB0ZXN0LiBkaWVzZXIga2FubiBkaWUgYXBwIHNjaGxpZXNzZW5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGFzIG5vIGxlZ2FjeSB0cmF5XG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dUcmF5KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBHTk9NRSBkZXRlY3RlZCwgcXVpdHRpbmcgaW5zdGVhZCBvZiB0cmF5IG1pbmltaXplYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgIC8vIGFsbG93IGNsb3NlIGZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2hvd01pbmltaXplV2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTWluaW1pemluZyBOZXh0LUV4YW0gdG8gU3lzdGVtdHJheWApICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgd2luZG93IHByb3BlcnRpZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuZm9jdXMoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG4gICAgICAgIC8vdGhpcy5tYWlud2luZG93LnNldEhpZGRlbkluTWlzc2lvbkNvbnRyb2wodHJ1ZSlcblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudltcIkRFQlVHXCJdKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vcmVuZGVyZXIvaW5kZXguaHRtbCcpXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH1gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGFzeW5jIHNob3dFeGl0V2FybmluZyhtZXNzYWdlKXtcbiAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT2snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIEJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd0V4aXRRdWVzdGlvbigpe1xuICAgICAgICBpZiAodGhpcy5leGl0UXVlc3Rpb25PcGVuKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkaWFsb2cgYWxyZWFkeSBvcGVuLCBza2lwcGluZ1wiKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnSmEnLCAnTmVpbiddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gYmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1dvbGxlbiBzaWUgZGllIEFud2VuZHVuZyBOZXh0LUV4YW0gYmVlbmRlbj8nLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGNob2ljZS5yZXNwb25zZSA9PSAxKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkbyBub3QgY2xvc2UgTmV4dC1FeGFtIGFmdGVyIGZpbmlzaGVkIEV4YW1cIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dNaW5pbWl6ZVdhcm5pbmcoKXtcbiAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNaW5pbWl6ZSB0byBTeXN0ZW0gVHJheScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0RpZSBBbndlbmR1bmcgTmV4dC1FeGFtIHd1cmRlIG1pbmltaWVydCEnLFxuICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIEZ1bmN0aW9uc1xuICAgICAqL1xuXG4gICAgaXNXYXlsYW5kKCl7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7IFxuICAgIH1cblxuICAgIC8vIHRoaXMgZnVuY3Rpb24gdXNlcyBhY3RpdmUtd2luIHRvIHJlY2VpdmUgbmFtZSBhbmQgdXJsIGZyb20gYWN0aXZlIHdpbmRvdyAtIHlldCBhbm90aGVyIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoZSBmb2N1cyBpcyBzdGlsbCBvbiBuZXh0ZXhhbVxuICAgIC8vIHRoaXMgaXMgdXNlZCB0byBpbnRyb2R1Y2UgZXhlbXB0aW9ucyBmb3IgdGhlIGJsdXIgbGlzdGVuZXJcbiAgICAvLyAoZG93bmdyYWRlZCBmcm9tIGdldC13aW5kb3dzIGJlY2F1c2Ugb2YgbmFwaSB2OSBpc3N1ZSkgaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9nZXQtd2luZG93cy9pc3N1ZXMvMTg2XG4gICAgYXN5bmMgd2luZG93VHJhY2tlcigpe1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICAvLyBjb25zdCBnZXR3aW4gPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVdpbmRvdygpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlV2luID0gYXdhaXQgYWN0aXZlV2luZG93KClcbiAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGFjdGl2ZVdpbiAmJiBhY3RpdmVXaW4ub3duZXIgJiYgYWN0aXZlV2luLm93bmVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IGFjdGl2ZVdpbi5vd25lci5uYW1lXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoID0gYWN0aXZlV2luLm93bmVyLnBhdGhcbiAgICAgICAgICAgICAgICBsZXQgbmFtZUxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoTG93ZXIgPSB3cGF0aC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZUxvd2VyLmluY2x1ZGVzKFwiZXhhbVwiKSB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJuZXh0XCIpICB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJlbGVjdHJvblwiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImVhc2VvZmFjY2Vzc2RpYWxvZ1wiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImRpc2FibGUtc2hvcnRjdXRzXCIpICl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9rdXMgaXMgb24gYWxsb3dlZCB3aW5kb3cgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvL2ZvY3VzIGlzIG5vdCBvbiBuZXh0LWV4YW0gb3IgYW55IG90aGVyIGFsbG93ZWQgd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCl7ICAvL2xvZyBqdXN0IG9uY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogZm9jdXMgbG9zdCBldmVudCB3YXMgdHJpZ2dlcmVkLiBhcHA6ICR7d3BhdGh9IC0gJHtuYW1lfSBgKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vYWRkcyBibHVyIGxpc3RlbmVyIHdoZW4gZW50ZXJpbmcgZXhhbW1vZGUgICAvLyBibHVyIGV2ZW50IGlzbnQgZmlyZWQgb24gbWFjb3MgTUlTU0lPTkNPTlRST0wgKHdoaWNoIGNhbnQgYmUgZGVhY3RpdmF0ZWQgYW55bW9yZSkgLSBkYW1uIHlvdSBhcHBsZSFcbiAgICBhZGRCbHVyTGlzdGVuZXIod2luZG93ID0gXCJleGFtd2luZG93XCIpe1xuICAgICAgICBpZiAod2luZG93ID09PSBcImV4YW13aW5kb3dcIil7IFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9YClcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50KHRoaXMpKSBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3aW5kb3cgPT09IFwic2NyZWVubG9ja1wiKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd313aW5kb3dgKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnRTY3JlZW5sb2NrKHRoaXMpKSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vcmVtb3ZlcyBibHVyIGxpc3RlbmVyIHdoZW4gbGVhdmluZyBleGFtIG1vZGVcbiAgICByZW1vdmVCbHVyTGlzdGVuZXIoKXtcbiAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdibHVyJylcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIHJlbW92ZUJsdXJMaXN0ZW5lcjogcmVtb3ZpbmcgYmx1ciBsaXN0ZW5lclwiKVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGltcGxlbWVudGluZyBhIHNsZWVwICh3YWl0KSBmdW5jdGlvblxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy9zdHVkZW50IGZvZ3VzIHdlbnQgdG8gYW5vdGhlciB3aW5kb3dcbiAgICBhc3luYyBibHVyZXZlbnQod2luaGFuZGxlcikgeyBcblxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IHN0dWRlbnQgdHJpZWQgdG8gbGVhdmUgZXhhbSB3aW5kb3dcIilcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4Jyl7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndpbmRvd1RyYWNrZXIoKSAgLy9jaGVja3MgaWYgbmV3IGZvY3VzIHdpbmRvdyBpcyBhbGxvd2VkXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd3RyYWNrZXIgY2hlY2sgZG9uZS4uLlwiKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBzY3JlZW5sb2NrIHdpbmRvd3MgZnJvbSBhcnJheSBhbmQgY2hlY2sgaWYgYW55IHN0aWxsIGV4aXN0XG4gICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgY29uc3QgaGFzQWN0aXZlU2NyZWVubG9jayA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Muc29tZSh3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSAmJiB3aW4uaXNWaXNpYmxlKCkpXG4gICAgICAgIC8vIEFsc28gY2hlY2sgY2xpZW50aW5mby5zY3JlZW5sb2NrIGZsYWcgYXMgZmFsbGJhY2sgaW4gY2FzZSBhcnJheSB3YXMgY2xlYXJlZCBidXQgd2luZG93cyBzdGlsbCBleGlzdFxuICAgICAgICBpZiAoaGFzQWN0aXZlU2NyZWVubG9jayB8fCB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uc2NyZWVubG9jaykgeyByZXR1cm4gfS8vIGRvIG5vdGhpbmcgaWYgc2NyZWVubG9ja3dpbmRvdyBzdG9sZSBmb2N1cyAvLyBkbyBub3QgdHJpZ2dlciBhbiBpbmZpbml0ZSBsb29wIGJldHdlZW4gZXhhbSB3aW5kb3cgYW5kIHNjcmVlbmxvY2sgd2luZG93IChzdGVhbGluZyBlYWNoIG90aGVycyBmb2N1cyBiZWNhdXNlIHNjcmVlbmxvY2t3aW5kb3cgYXBwZWFycyBhYm92ZSBleGFtIHdpbmRvdyBhbmQgd2lsbCBjYXB0dXJlIGEga2xpY2sgYW5kIHRoZXJlZm9yZSBzdGVhbCBmb2N1cylcbiAgICAgICAgaWYgKHdpbmhhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkKXsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgLy90cm90emRlbSBmb2N1cyB6dXJcdTAwRkNjayBhdWYgZGllIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IGJsdXJldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZSAgIC8vaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG5cbiAgICAgICAgLy90dXJuIHZvbHVtZSB1cCBeXlxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyBzcGF3bigncG93ZXJzaGVsbCcsIFsnU2V0LVZvbHVtZUxldmVsIC1MZXZlbCAxMDA7IFNldC1Wb2x1bWVNdXRlIC1NdXRlICRmYWxzZSddKTsgfVxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBleGVjKCdvc2FzY3JpcHQgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCB2b2x1bWUgMTAwXCIgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCBtdXRlZCBmYWxzZVwiJyk7IH0gIFxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgeyBcbiAgICAgICAgLy8gICAgIGV4ZWMoJ2FtaXhlciBzZXQgTWFzdGVyIDEwMCUgJyk7XG4gICAgICAgIC8vICAgICBleGVjKCdwYWN0bCBzZXQtc2luay1tdXRlIGBwYWN0bCBnZXQtZGVmYXVsdC1zaW5rYCAwJyk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgXG4gICAgICAgIC8vd2UgY291bGQgcGxheSBhIHNvdW5kIGZpbGUgaGVyZS4uIHRiZC4gIFxuICAgIH1cbiAgICAvL3NwZWNpYWwgYmx1ciBldmVudCBmb3IgdGVtcG9yYXJ5IGxvdyBzZWN1cml0eSBzY3JlZW5sb2NrXG4gICAgYmx1cmV2ZW50U2NyZWVubG9jayh3aW5oYW5kbGVyKSB7IFxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiBibHVyLXNjcmVlbmxvY2sgdHJpZ2dlcmVkXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL2Rvbid0IGN5Y2xlIHRocm91Z2ggYWxsIG9mIHRoZW0gLi4gaXQgd2lsbCBjcmVhdGUgYW4gaW5maW5pdGUgZm9jdXMgcmFjZVxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5zaG93KCk7ICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgXG4gICAgfVxuICAgIFxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiBcblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogbW9zdCBvZiB0aGUga2V5Ym9hcmQgcmVzdHJpY3Rpb25zIGNvdWxkIGJlIGhhbmRsZWQgYnkgXCJpb2hvb2tcIiBmb3IgYWxsIHBsYXRmb3Jtc1xuICogdW5mb3J0dW5hbGV0eSBpdCdzIG5vdCB5ZXQgcmVsZWFzZWQgZm9yIG5vZGUgdjE2LnggYW5kIGVsZWN0cm9uIHYxNi54ICAoYWxzbyBpdCdzIFwiYmlnIHN1clwiIGludGVsIG9ubHkgb24gbWFjcylcbiAqIGh0dHBzOi8vd2lsaXgtdGVhbS5naXRodWIuaW8vaW9ob29rL2luc3RhbGxhdGlvbi5odG1sXG4gKlxuICogXCJub2RlLWdsb2JhbC1rZXktbGlzdGVuZXJcIiB3b3VsZCBiZSBhbm90aGVyIHNvbHV0aW9uIGZvciB3aW5kb3dzIGFuZCBtYWNvcyAoYWx0aG91Z2ggaXQgcmVxdWlyZXMgXCJhY2Nlc3NhYmlsaXR5XCIgcGVybWlzc2lvbnMgb24gbWFjKVxuICogYnV0IGZvciBub3cgaXQgc2VlbXMgdGhlIG1vZHVsZSBjYW4gbm90IHJ1biBpbiBhIGZpbmFsIGVsZWN0cm9uIGJ1aWxkXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTGF1bmNoTWVudS9ub2RlLWdsb2JhbC1rZXktbGlzdGVuZXIvaXNzdWVzLzE4XG4gKlxuICogaGFyZGNvZGluZyB0aGUga2V5Ym9hcmRzaG9ydGN1dHMgd2Ugd2FudCB0byBjYXB0dXJlIGludG8gaW9ob29rKG9yIG4tZy1rLWwpIGFuZCBtYW51YWxseSBjb21waWxpbmcgaXQgZm9yIG1hYyBhbmQgd2luZG93cyBjb3VsZCBiZSBkb25lIC0gKGJ1dCBub3QgdW50aWwgaSBnZXQgcGFpZCBmb3IgdGhpcyBhbW91bnQgb2Ygd29yayA7LSlcbiAqL1xuXG5cbi8qKlxuICogdGhlIG5leHQgYmVzdCBzb2x1dGlvbiBpIGNhbWUgdXAgd2l0aCBpcyB0byBraWxsIGFsbCBvZiB0aGUgc2hlbGxzIC0gc3RhcnRpbmcgd2l0aCBleHBsb3Jlci5leGUgYmVjYXVzZSBpdHMgYWJzb2x1dGVseSBpbXBvc3NpYmxlIHRvXG4gKiBkZWFjdGl2YXRlIHRoaXMgbmFzdHkgXCJ3aW5kb3dzXCIgYnV0dG9uIG9yIDNGaW5nZXJTbGlkZVVwIEdlc3R1cmUgaW4gd2luZG93cyAxMSAtIHlvdSBjb3VsZCBlZGl0IHRoZSByZWdpc3RyeSBhbmQgcmVib290IGJ1dCB0aGF0cyBvYnZpb3VzbHkgbm90IHdoYXQgd2Ugd2FudFxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBjbGlwYm9hcmQsIGdsb2JhbFNob3J0Y3V0IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgU2NoZWR1bGVyU2VydmljZSB9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zLCBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9saW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucywgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy93aW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlTWFjUmVzdHJpY3Rpb25zLCBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIGFzIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbWFjLmpzJztcblxubGV0IGNsaXBib2FyZEludGVydmFsO1xubGV0IGNvbmZpZ1N0b3JlID0ge1xuICAgIGxpbnV4OiB7fSxcbiAgICB3aW5kb3dzOiB7fSxcbiAgICBtYWNvczoge31cbn07XG5cbi8vIGxpc3Qgb2YgYXBwcyB3ZSBkbyBub3Qgd2FudCB0byBydW4gaW4gYmFja2dyb3VuZFxuY29uc3QgYXBwc1RvQ2xvc2UgPSBbJ0dvb2dsZSBDaHJvbWUnLCAnY2hyb21lJywgJ2dvb2dsZS1jaHJvbWUnLCAnTWljcm9zb2Z0IEVkZ2UnLCAnbXNlZGdlJywgJ2ZpcmVmb3gnLCAnc2FmYXJpJywgJ2JyYXZlJywgJ29wZXJhJywgJ2NoYXRncHQnLCAnQ2hhdEdQVCcsICdOb3J0b25TZWN1cml0eScsICdOQVYnLCAnVGVhbXMnLCAnbXMtdGVhbXMnLCAnem9vbS51cycsICdNaWNyb3NvZnQgVGVhbXMnLCAnZGlzY29yZCcsICd6b29tJywgJ3RlYW1zJywgJ3RlYW12aWV3ZXInLCAnc2t5cGVmb3JsaW51eCcsICdza3lwZScsICdhbnlkZXNrJ107XG5cbmFzeW5jIGZ1bmN0aW9uIGVuYWJsZVJlc3RyaWN0aW9ucyh3aW5oYW5kbGVyKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cblxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIHBsYXRmb3JtIHJlc3RyaWN0aW9uc1wiKTtcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBjbGlwYm9hcmQuY2xlYXIoKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKCgpID0+IHsgY2xpcGJvYXJkLmNsZWFyKCk7IH0sIDEwMDApO1xuICAgIGNsaXBib2FyZEludGVydmFsLnN0YXJ0KCk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzS0RFLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNHTk9NRSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBhd2FpdCBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlzYWJsZVJlc3RyaWN0aW9ucygpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiByZW1vdmluZyByZXN0cmljdGlvbnMuLi5cIik7XG5cbiAgICBpZiAoY2xpcGJvYXJkSW50ZXJ2YWwpIHtcbiAgICAgICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RvcCgpO1xuICAgIH1cblxuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbChlbmFibGUpO1xufVxuXG5leHBvcnQgeyBlbmFibGVSZXN0cmljdGlvbnMsIGRpc2FibGVSZXN0cmljdGlvbnMsIHRvZ2dsZU1hY09TTG9ja2Rvd24gfTtcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogTGludXgtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuLy8gdW5mb3J0dW5hdGVseSB0aGVyZSBpcyBubyBjb252ZW5pZW50IHdheSBmb3IgZ25vbWUtc2hlbGwgdG8gdW4tc2V0IEFMTCBzaG9ydGN1dHMgYXQgb25jZVxuY29uc3QgZ25vbWVLZXliaW5kaW5ncyA9IFtcbiAgICAnYWN0aXZhdGUtd2luZG93LW1lbnUnLCdtYXhpbWl6ZS1ob3Jpem9udGFsbHknLCdtb3ZlLXRvLXNpZGUtbicsJ21vdmUtdG8td29ya3NwYWNlLTgnLCdzd2l0Y2gtYXBwbGljYXRpb25zJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0zJywnc3dpdGNoLXdpbmRvd3MtYmFja3dhcmQnLFxuICAgICdhbHdheXMtb24tdG9wJywnbWF4aW1pemUtdmVydGljYWxseScsJ21vdmUtdG8tc2lkZS1zJywnbW92ZS10by13b3Jrc3BhY2UtOScsJ3N3aXRjaC1hcHBsaWNhdGlvbnMtYmFja3dhcmQnLCcgIHN3aXRjaC10by13b3Jrc3BhY2UtNCcsJ3RvZ2dsZS1hYm92ZScsXG4gICAgJ2JlZ2luLW1vdmUnLCdtaW5pbWl6ZScsJ21vdmUtdG8tc2lkZS13JywnbW92ZS10by13b3Jrc3BhY29lLWRvd24nLCdzd2l0Y2gtZ3JvdXAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTUnLCd0b2dnbGUtZnVsbHNjcmVlbicsXG4gICAgJ2JlZ2luLXJlc2l6ZScsJ21vdmUtdG8tY2VudGVyJywnbW92ZS10by13b3Jrc3BhY2UtMScsJ21vdmUtdG8td29ya3NwYWNlLWxhc3QnLCdzd2l0Y2gtZ3JvdXAtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTYnLCd0b2dnbGUtbWF4aW1pemVkJyxcbiAgICAnY2xvc2UnLCdtb3ZlLXRvLWNvcm5lci1uZScsJ21vdmUtdG8td29ya3NwYWNlLTEwJywnbW92ZS10by13b3Jrc3BhY2UtbGVmdCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTcnLCd0b2dnbGUtb24tYWxsLXdvcmtzcGFjZXMnLFxuICAgICdjeWNsZS1ncm91cCcsJ21vdmUtdG8tY29ybmVyLW53JywnbW92ZS10by13b3Jrc3BhY2UtMTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1yaWdodCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UtYmFja3dhcmQgIHN3aXRjaC10by13b3Jrc3BhY2UtOCcsJ3RvZ2dsZS1zaGFkZWQnLFxuICAgICdjeWNsZS1ncm91cC1iYWNrd2FyZCcsJ21vdmUtdG8tY29ybmVyLXNlJywnbW92ZS10by13b3Jrc3BhY2UtMTInLCdtb3ZlLXRvLXdvcmtzcGFjZS11cCcsJ3N3aXRjaC1wYW5lbHMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTknLCd1bm1heGltaXplJyxcbiAgICAnY3ljbGUtcGFuZWxzJywnbW92ZS10by1jb3JuZXItc3cnLCdtb3ZlLXRvLXdvcmtzcGFjZS0yJywncGFuZWwtbWFpbi1tZW51Jywnc3dpdGNoLXBhbmVscy1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtZG93bicsXG4gICAgJ2N5Y2xlLXBhbmVscy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1kb3duJywnbW92ZS10by13b3Jrc3BhY2UtMycsJ3BhbmVsLXJ1bi1kaWFsb2cnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxhc3QnLFxuICAgICdjeWNsZS13aW5kb3dzJywnbW92ZS10by1tb25pdG9yLWxlZnQnLCdtb3ZlLXRvLXdvcmtzcGFjZS00JywncmFpc2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sZWZ0JyxcbiAgICAnY3ljbGUtd2luZG93cy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1yaWdodCcsJ21vdmUtdG8td29ya3NwYWNlLTUnLCdyYWlzZS1vci1sb3dlcicsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLXJpZ2h0JyxcbiAgICAnbG93ZXInLCdtb3ZlLXRvLW1vbml0b3ItdXAnLCdtb3ZlLXRvLXdvcmtzcGFjZS02Jywnc2V0LXNwZXctbWFyaycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTInLCdzd2l0Y2gtdG8td29ya3NwYWNlLXVwJyxcbiAgICAnbWF4aW1pemUnLCdtb3ZlLXRvLXNpZGUtZScsJ21vdmUtdG8td29ya3NwYWNlLTcnLCdzaG93LWRlc2t0b3AnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTInLCdzd2l0Y2gtd2luZG93cydcbl07XG5jb25zdCBnbm9tZVNoZWxsS2V5YmluZGluZ3MgPSBbJ2ZvY3VzLWFjdGl2ZS1ub3RpZmljYXRpb24nLCdvcGVuLWFwcGxpY2F0aW9uLW1lbnUnLCdzY3JlZW5zaG90Jywnc2NyZWVuc2hvdC13aW5kb3cnLCdzaGlmdC1vdmVydmlldy1kb3duJyxcbiAgICAnc2hpZnQtb3ZlcnZpZXctdXAnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMScsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0yJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTMnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi01JyxcbiAgICAnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTYnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi04Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTknLCdzaG93LXNjcmVlbnNob3QtdWknLCdzaG93LXNjcmVlbi1yZWNvcmRpbmctdWknLFxuICAgICd0b2dnbGUtYXBwbGljYXRpb24tdmlldycsJ3RvZ2dsZS1tZXNzYWdlLXRyYXknLCd0b2dnbGUtb3ZlcnZpZXcnXTtcbmNvbnN0IGdub21lTXV0dGVyS2V5YmluZGluZ3MgPSBbJ3JvdGF0ZS1tb25pdG9yJywnc3dpdGNoLW1vbml0b3InLCd0YWItcG9wdXAtY2FuY2VsJywndGFiLXBvcHVwLXNlbGVjdCcsJ3RvZ2dsZS10aWxlZC1sZWZ0JywndG9nZ2xlLXRpbGVkLXJpZ2h0J107XG5jb25zdCBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyA9IFsnYXBwLWN0cmwtaG90a2V5LTEnLCdhcHAtY3RybC1ob3RrZXktMTAnLCdhcHAtY3RybC1ob3RrZXktMicsJ2FwcC1jdHJsLWhvdGtleS0zJywnYXBwLWN0cmwtaG90a2V5LTQnLCdhcHAtY3RybC1ob3RrZXktNScsXG4gICAgJ2FwcC1jdHJsLWhvdGtleS02JywnYXBwLWN0cmwtaG90a2V5LTcnLCdhcHAtY3RybC1ob3RrZXktOCcsJ2FwcC1jdHJsLWhvdGtleS05JyxcbiAgICAnYXBwLWhvdGtleS0xJywnYXBwLWhvdGtleS0xMCcsJ2FwcC1ob3RrZXktMicsJ2FwcC1ob3RrZXktMycsJ2FwcC1ob3RrZXktNCcsJ2FwcC1ob3RrZXktNScsJ2FwcC1ob3RrZXktNicsJ2FwcC1ob3RrZXktNycsJ2FwcC1ob3RrZXktOCcsJ2FwcC1ob3RrZXktOScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktMScsJ2FwcC1zaGlmdC1ob3RrZXktMTAnLCdhcHAtc2hpZnQtaG90a2V5LTInLCdhcHAtc2hpZnQtaG90a2V5LTMnLCdhcHAtc2hpZnQtaG90a2V5LTQnLCdhcHAtc2hpZnQtaG90a2V5LTUnLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTYnLCdhcHAtc2hpZnQtaG90a2V5LTcnLCdhcHAtc2hpZnQtaG90a2V5LTgnLCdhcHAtc2hpZnQtaG90a2V5LTknLCdzaG9ydGN1dCddO1xuY29uc3QgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MgPSBbJ3N3aXRjaC10by1zZXNzaW9uLTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0yJywnc3dpdGNoLXRvLXNlc3Npb24tMycsJ3N3aXRjaC10by1zZXNzaW9uLTQnLCdzd2l0Y2gtdG8tc2Vzc2lvbi01Jywnc3dpdGNoLXRvLXNlc3Npb24tNicsJ3N3aXRjaC10by1zZXNzaW9uLTcnLCdzd2l0Y2gtdG8tc2Vzc2lvbi04Jywnc3dpdGNoLXRvLXNlc3Npb24tOScsJ3N3aXRjaC10by1zZXNzaW9uLTEwJywnc3dpdGNoLXRvLXNlc3Npb24tMTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMiddO1xuXG4vKipcbiAqIEVuYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgKEtERS9HTk9NRSwgY2xvc2UgYXBwcywgY2xpcGJvYXJkKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNLREVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNHTk9NRVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBpc0tERSwgaXNHTk9NRSkge1xuICAgIHRyeSB7XG4gICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiYCwgKHBncmVwRXJyb3IsIHN0ZG91dCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcGdyZXBFcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cIiB8IHhhcmdzIC1yIGtpbGwgLTlgLCAoa2lsbEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtpbGxFcnJvcikgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmIChpc0tERSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBLREUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2tyZWFkY29uZmlnNScsIFsnLS1maWxlJywgJ2t3aW5yYycsICctLWdyb3VwJywgJ0Rlc2t0b3BzJywgJy0ta2V5JywgJ051bWJlciddLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChrcmVhZGNvbmZpZyk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gMTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHJlY29uZmlndXJpbmcga3dpblwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCBgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywgJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJ1wiXCInXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCcxJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3NldEN1cnJlbnREZXNrdG9wJywnMSddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGVmZmVjdHNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ2Rlc2t0b3BncmlkJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdzY3JlZW5lZGdlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdvdmVydmlldyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogYWRkaXRpb25hbCB0dHknc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnc3J2cmtleXM6bm9uZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbGVhcmluZyBjbGlwYm9hcmQgaGlzdG9yeVwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdvcmcua2RlLktHbG9iYWxBY2NlbC5ibG9ja0dsb2JhbFNob3J0Y3V0cycsICd0cnVlJ10pO1xuICAgICAgICB9LCAyMDAwKTtcbiAgICB9XG5cbiAgICBpZiAoaXNHTk9NRSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBHTk9NRSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdheWxhbmQ6IGRpc2FibGUgVlQvVFRZIHN3aXRjaCAoQ3RybCtBbHQrRjEuLkYxMikgdmlhIG11dHRlciBrZXliaW5kaW5nc1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnLCAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYmluZGluZywgYFsnJ11gXSk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkY29uZicsIFsnd3JpdGUnLCBgL29yZy9nbm9tZS9tdXR0ZXIvd2F5bGFuZC9rZXliaW5kaW5ncy8ke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5JywgYCcnYF0pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLm11dHRlciBkeW5hbWljLXdvcmtzcGFjZXMgZmFsc2UnKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5kZXNrdG9wLndtLnByZWZlcmVuY2VzIG51bS13b3Jrc3BhY2VzIDEnKTtcbiAgICAgICAgICAgIC8vIFgxMSBvbmx5OiBkaXNhYmxlIFRUWSBzd2l0Y2ggdmlhIHNldHhrYm1hcCAob24gV2F5bGFuZCB3ZSByZWx5IG9uIG11dHRlciBrZXliaW5kaW5ncyBhYm92ZSlcbiAgICAgICAgICAgIGlmICghcGxhdGZvcm1EaXNwYXRjaGVyLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnc2V0eGtibWFwIC1vcHRpb24gc3J2cmtleXM6bm9uZScsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChHTk9NRSk6IHNldHhrYm1hcCBzcnZya2V5czpub25lIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgYW5kIHJlc3RvcmUgS0RFL0dOT01FIHNldHRpbmdzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1N0b3JlIC0gc2hhcmVkIHN0b3JlIChjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKSB7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG5cbiAgICBjaGlsZFByb2Nlc3MuZXhlYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBleGVjIGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnS0RFJykge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogS0RFIGRldGVjdGVkXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAnZmFsc2UnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nICwnL0NvbXBvc2l0b3InLCAnb3JnLmtkZS5rd2luLkNvbXBvc2l0aW5nLnJlc3VtZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IGtnbG9iYWxhY2NlbDUmJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJy0tZGVsZXRlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCdrd2lucmMnLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHNdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IHBsYXNtYXNoZWxsICYnLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmddKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5J10pO1xuICAgIC8vIHJlc3RvcmUgVFRZIHN3aXRjaCBpZiB3ZSBoYWQgZGlzYWJsZWQgaXQgdmlhIHNldHhrYm1hcCAoR05PTUUgWDExKVxuICAgIGlmIChjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoXCJzZXR4a2JtYXAgLW9wdGlvbiAnJ1wiLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBsb2cud2FybigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBzZXR4a2JtYXAgcmVzdG9yZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQgPSBmYWxzZTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFdpbmRvd3Mtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLyoqXG4gKiBFbmFibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHNob3J0Y3V0cywgY2xvc2UgYXBwcywga2lsbCBleHBsb3JlcikuXG4gKiBAcGFyYW0ge29iamVjdH0gd2luaGFuZGxlciAtIG11c3QgaGF2ZSB3aW5oYW5kbGVyLmV4YW13aW5kb3dcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBvbmUgbW9yZSBsZXZlbCB1cDogcmVzdHJpY3Rpb25zLyAtPiBzY3JpcHRzLyAtPiBtYWluLyAtPiBwYWNrYWdlcy8gKHNhbWUgdGFyZ2V0IGFzIG9yaWdpbmFsIHBsYXRmb3JtcmVzdHJpY3Rpb25zLmpzIGluIHNjcmlwdHMvKVxuICAgICAgICBjb25zdCBleGVjdXRhYmxlMSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vcHVibGljL2Rpc2FibGUtc2hvcnRjdXRzLmV4ZScpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTEsIFtdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScsIHNoZWxsOiBmYWxzZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmRvd3Mgc2hvcnRjdXRzIGRpc2FibGVkXCIpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gc2hvcnRjdXRzKTogJHtlcnJ9YCk7IH1cblxuICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgYXBwIG9mIGFwcHNUb0Nsb3NlKSB7XG4gICAgICAgICAgICBjb25zdCBlc2NhcGVkQXBwID0gYXBwLnJlcGxhY2UoLycvZywgXCInJ1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJGFwcE5hbWUgPSAnJHtlc2NhcGVkQXBwfSc7IHRyeSB7ICRwcm9jcyA9IEdldC1Qcm9jZXNzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHsgJF8uUHJvY2Vzc05hbWUgLWlsaWtlICgnKicgKyAkYXBwTmFtZSArICcqJykgfTsgaWYgKCRwcm9jcyAtYW5kICRwcm9jcy5Db3VudCAtZ3QgMCkgeyAkcHJvY3MgfCBTdG9wLVByb2Nlc3MgLUZvcmNlIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlOyBXcml0ZS1PdXRwdXQgJ2tpbGxlZCcgfSB9IGNhdGNoIHsgfVwiYDtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlQXBwKSA9PiB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpLmluY2x1ZGVzKCdraWxsZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZUFwcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmICghd2luaGFuZGxlcikge1xuICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmhhbmRsZXIgaXMgbm90IHByb3ZpZGVkIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcmV0cnlDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMDA7XG4gICAgICAgIGNvbnN0IGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAod2luaGFuZGxlci5leGFtd2luZG93ICYmICF3aW5oYW5kbGVyLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2traWxsIC9mIC9pbSBleHBsb3Jlci5leGUnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZXhwbG9yZXIuZXhlYCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXRyeUNvdW50IDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgIHJldHJ5Q291bnQrKztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMsIDEwMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZXhhbXdpbmRvdyBub3QgZm91bmQgYWZ0ZXIgJHttYXhSZXRyaWVzICogMTAwfW1zIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cygpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh1bmJsb2NrIHNob3J0Y3V0cywgcmVzdGFydCBleHBsb3JlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpIHtcbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogdW5ibG9ja2luZyBzaG9ydGN1dHMuLi5cIik7XG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHRhc2traWxsICAvSU0gXCJkaXNhYmxlLXNob3J0Y3V0cy5leGVcIiAvVCAvRmAsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZGlzYWJsZS1zaG9ydGN1dHMuZXhlYCk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgZXhwbG9yZXIuZXhlXCInLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHRhc2tsaXN0IGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKCdleHBsb3Jlci5leGUnKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiByZXN0YXJ0aW5nIGV4cGxvcmVyLi4uXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ3N0YXJ0IGV4cGxvcmVyLmV4ZScsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gZXhwbG9yZXIpOiAke2UubWVzc2FnZX1gKTsgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBtYWNPUy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlLCB0b2dnbGVNYWNPU0xvY2tkb3duKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IFRvdWNoQmFyLCBzeXN0ZW1QcmVmZXJlbmNlcywgcG93ZXJNb25pdG9yIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyBzdG9yZWQgcmVmcyBmb3IgY2xlYW51cCB3aGVuIGRpc2FibGluZyBtYWNPUyByZXN0cmljdGlvbnNcbmxldCB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG5sZXQgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG5sZXQgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuXG4vKiogU2luZ2xlIGhhbmRsZXIgZm9yIGFsbCBtYWNPUyByZXN0cmljdGlvbiBzaWduYWxzOiBsb2cgYW5kIHJlLWZvY3VzIGV4YW0gd2luZG93IC8gaW5mb3JtIHRlYWNoZXIuICovXG5mdW5jdGlvbiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKHNpZ25hbE5hbWUpIHtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6ICR7c2lnbmFsTmFtZX0gZGV0ZWN0ZWRgKTtcbiAgICBpZiAoIWN1cnJlbnRXaW5oYW5kbGVyPy5leGFtd2luZG93Py5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbykgY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpO1xuICAgIH1cbn1cblxuY29uc3QgbG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdsb2NrLXNjcmVlbicpO1xuY29uc3QgdW5sb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ3VubG9jay1zY3JlZW4nKTtcblxuLyoqXG4gKiBFbmFibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChUb3VjaEJhciwgY2xpcGJvYXJkLCBjbG9zZSBhcHBzLCB3b3Jrc3BhY2UvbG9jayBtb25pdG9yaW5nKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgY29uc3QgeyBUb3VjaEJhckxhYmVsLCBUb3VjaEJhclNwYWNlciB9ID0gVG91Y2hCYXI7XG4gICAgY29uc3QgdGV4dGxhYmVsID0gbmV3IFRvdWNoQmFyTGFiZWwoeyBsYWJlbDogXCJOZXh0LUV4YW1cIiB9KTtcbiAgICBjb25zdCB0b3VjaEJhciA9IG5ldyBUb3VjaEJhcih7XG4gICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgdGV4dGxhYmVsLFxuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgXVxuICAgIH0pO1xuICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdz8uc2V0VG91Y2hCYXIodG91Y2hCYXIpO1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gd2luaGFuZGxlcjtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdwYmNvcHkgPCAvZGV2L251bGwnKTtcblxuICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBraWxsIC05IC1mIFwiJHthcHB9XCJgLCAoZXJyb3IsIHN0ZGVyciwgc3Rkb3V0KSA9PiB7fSk7XG4gICAgfSk7XG5cbiAgICAvLyB3b3Jrc3BhY2Uvc3BhY2Ugc3dpdGNoIGFuZCBsb2NrL3VubG9jayBtb25pdG9yaW5nIChtYWNPUyBvbmx5KVxuICAgIHRyeSB7XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gc3lzdGVtUHJlZmVyZW5jZXMuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKCdOU1dvcmtzcGFjZUFjdGl2ZVNwYWNlRGlkQ2hhbmdlTm90aWZpY2F0aW9uJywgKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnZGVza3RvcC9zcGFjZSBzd2l0Y2gnKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cblxuICAgIHBvd2VyTW9uaXRvci5vbignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9uKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG5cbiAgICBsb2dTdHJlYW1Qcm9jZXNzID0gc3Bhd24oJ2xvZycsIFsnc3RyZWFtJywgJy0tcHJlZGljYXRlJywgJ3N1YnN5c3RlbSA9PSBcImNvbS5hcHBsZS5kb2NrXCIgQU5EIGNhdGVnb3J5ID09IFwibWlzc2lvbmNvbnRyb2xcIiddKTtcbiAgICBsb2dTdHJlYW1Qcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuICAgICAgICBpZiAoZGF0YS50b1N0cmluZygpLmluY2x1ZGVzKCdtb2RlJykpIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ01pc3Npb24gQ29udHJvbCcpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIERpc2FibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh0b3VjaGJhciwgbW9uaXRvcmluZyBsaXN0ZW5lcnMgYW5kIGxvZyBwcm9jZXNzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKSB7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuICAgIGlmICh3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7IHN5c3RlbVByZWZlcmVuY2VzLnVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkKTsgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG4gICAgfVxuICAgIHBvd2VyTW9uaXRvci5vZmYoJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vZmYoJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBpZiAobG9nU3RyZWFtUHJvY2Vzcykge1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGVzL2VuYWJsZXMgbWlzc2lvbiBjb250cm9sLCBzcGFjZXMgYW5kIHRyYWNrcGFkIGdlc3R1cmVzLlxuICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSB0cnVlIHJlc3RvcmVzIGV2ZXJ5dGhpbmcsIGZhbHNlIGxvY2tzIGV2ZXJ5dGhpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIHJldHVybjtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCB0b2dnbGVNYWNPU0xvY2tkb3duOiAke2VuYWJsZSA/ICdlbmFibGUnIDogJ2Rpc2FibGUnfSBtaXNzaW9uIGNvbnRyb2wgbG9ja2Rvd25gKTtcblxuICAgIGNvbnN0IG1jSWRzID0gWzMyLCAzMywgMzQsIDM1LCA3OSwgODAsIDgxLCA4MiwgMTE4LCAxMTksIDEyMCwgMTIxXTtcbiAgICBjb25zdCBwbGlzdFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5LCAnTGlicmFyeS9QcmVmZXJlbmNlcy9jb20uYXBwbGUuc3ltYm9saWNob3RrZXlzLnBsaXN0Jyk7XG4gICAgY29uc3QgYmFja3VwUGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3RvcnksICduZXh0X2V4YW1faG90a2V5c19iYWNrdXAucGxpc3QnKTtcblxuICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgY29uc3QgaG90a2V5Q29tbWFuZHMgPSBtY0lkcy5tYXAoaWQgPT5cbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuc3ltYm9saWNob3RrZXlzIEFwcGxlU3ltYm9saWNIb3RLZXlzIC1kaWN0LWFkZCAke2lkfSBcIjxkaWN0PjxrZXk+ZW5hYmxlZDwva2V5PjxmYWxzZS8+PC9kaWN0PlwiYFxuICAgICAgICApLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAhIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gY3AgXCIke3BsaXN0UGF0aH1cIiBcIiR7YmFja3VwUGF0aH1cIjsgZmk7XG4gICAgICAgICR7aG90a2V5Q29tbWFuZHN9O1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcblxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRW5hYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIFxuICAgICAgICAgIGNwIFwiJHtiYWNrdXBQYXRofVwiIFwiJHtwbGlzdFBhdGh9XCI7IFxuICAgICAgICAgIHJtIFwiJHtiYWNrdXBQYXRofVwiOyBcbiAgICAgICAgZmk7XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuICAgICAgICBsb2cuaW5mbygnbWFpbiBAIHRvZ2dsZU1hY09TTG9ja2Rvd246IEVuYWJsZSBNaXNzaW9uQ29udG9sJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBEaXNhYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4ndXNlIHN0cmljdCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInICAgLy8gZGFzIG1hY2h0IGtyYXNzZXN0ZSByYWNlY29kaXRpb25zIG1pdCBlbGVjdHJvbiBlaWdlbmVuIHZlcnNpb25lbiAtIHVuYmVkaW5ndCBkaWUgc2VsYmUgdmVyc2lvbiBiZWhhbHRlbiB3aWUgZWxlY3Ryb25cbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBzY3JlZW4sIGlwY01haW4sIGFwcCwgQnJvd3NlcldpbmRvdywgd2ViQ29udGVudHMgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBzY3JlZW5zaG90IGZyb20gJ3NjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kJztcbmltcG9ydCB7IFdvcmtlciB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgcnVuUmVtb3RlQ2hlY2sgfSBmcm9tICcuL3JlbW90ZUNoZWNrLmpzJ1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5cbmNvbnN0IHNoZWxsID0gKGNtZCkgPT4geyAgIHJldHVybiBleGVjU3luYyhjbWQsIHsgZW5jb2Rpbmc6ICd1dGY4Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pOyB9OyAgLy8gc3RkZXJyIHVudGVyZHJcdTAwRkNja3QgXG5jb25zdCBhZ2VudCA9IG5ldyBodHRwcy5BZ2VudCh7IHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyBcblxuIC8qKlxuICAqIEhhbmRsZXMgaW5mb3JtYXRpb24gZmV0Y2hpbmcgZnJvbSB0aGUgc2VydmVyIGFuZCBhY3RzIG9uIHN0YXR1cyB1cGRhdGVzXG4gICovXG4gXG4gY2xhc3MgQ29tbUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IGZhbHNlXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMCAvLyB3ZSBjb3VudCBmYWlscyBhbmQgZGVhY3RpdmF0ZSBvbiA0IGNvbnNlcXVlbnQgZmFpbHNcbiAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IHRydWVcbiAgICAgICAgdGhpcy50aW1lciA9IDBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBudWxsXG4gICAgICAgIHRoaXMudXNlV29ya2VyID0gdHJ1ZVxuICAgICAgICB0aGlzLndvcmtlckZhaWxzID0gMFxuICAgIH1cbiBcbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnJlcXVlc3RVcGRhdGUuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRTY3JlZW5zaG90LmJpbmQodGhpcyksIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICBpZiAoIXRoaXMud29ya2VyICYmIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyAgdGhpcy5zZXR1cEltYWdlV29ya2VyKCkgIH1cbiAgICB9XG4gXG5cbiAgICAvKipcbiAgICAgKiBTZXR1cCB0aGUgaW1hZ2Ugd29ya2VyXG4gICAgICogdXNlcyBmb3JrIHRvIGNyZWF0ZSBhIG5ldyBjaGlsZCBwcm9jZXNzXG4gICAgICogdXNlcyB0aGUgaW1hZ2VXb3JrZXJMaW51eC5qcyBvciBpbWFnZVdvcmtlclNoYXJwLmpzIGZpbGVcbiAgICAgKiB0aGUgd29ya2VyIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzZXR1cEltYWdlV29ya2VyKCkge1xuICAgICAgICBjb25zdCB3b3JrZXJVUkwgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyVVJMO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlclVSTCwgeyB0eXBlOiAnbW9kdWxlJywgZW52OiB7IC4uLnByb2Nlc3MuZW52IH0gfSk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogSW1hZ2VXb3JrZXIgaW5pdGlhbGl6ZWQuIFVzaW5nIFwiICsgcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlckZpbGVOYW1lKVxuICAgICAgICBcblxuICAgICAgICB0aGlzLndvcmtlci5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlci5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlckZhaWxzICs9IDFcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53b3JrZXJGYWlscyA+IDQpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZmFpbGVkIDUgdGltZXMgLSBzd2l0Y2hpbmcgdG8gbm8gcHJvY2Vzc2luZycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBcbiAgICAgKiBpZiB1c2VXb3JrZXIgaXMgdHJ1ZSwgdGhlIHNjcmVlbnNob3QgaXMgcHJvY2Vzc2VkIGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqIG90aGVyd2lzZSB0aGUgc2NyZWVuc2hvdCBpcyBub3QgcHJvY2Vzc2VkIGFuZCB0aGUgb3JpZ2luYWwgc2NyZWVuc2hvdCBpcyByZXR1cm5lZFxuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NJbWFnZShpbWdCdWZmZXIpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy53b3JrZXIpIHsgLy90cmlwbGUgY2hlY2sgaWYgd29ya2VyIGlzIGluaXRpYWxpemVkXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXb3JrZXIgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7IGltZ0J1ZmZlcjogQXJyYXkuZnJvbShpbWdCdWZmZXIpLCBpbVZlcnNpb246IHBsYXRmb3JtRGlzcGF0Y2hlci5pbVZlcnNpb24gfSk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlci5vbmNlKCdtZXNzYWdlJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7IFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmFsbGJhY2sgdG8gbm8gcHJvY2Vzc2luZyAgIFxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltZ0J1ZmZlcikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyQmFzZTY0ID0gc2NyZWVuc2hvdEJhc2U2NFxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgc2NyZWVuc2hvdEJhc2U2NDogc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0OiBoZWFkZXJCYXNlNjQsIGlzYmxhY2s6IGZhbHNlLCBpbWdCdWZmZXI6IGltZ0J1ZmZlciB9O1xuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cbiAgICAvKiogXG4gICAgICogVXBkYXRlIGN1cnJlbnQgU2VydmVyc3RhdHVzICsgU3R1ZGVudHRzdGF0dXMgKGV2ZXJ5IDUgc2Vjb25kcylcbiAgICAgKi9cbiAgICBhc3luYyByZXF1ZXN0VXBkYXRlKCl7XG5cbiAgICAgICAgdGhpcy50aW1lcisrICAgLy8gd2UgdXNlIHRpbWVyIHRvIHRpbWUgbG9vcHMgd2l0aCBkaWZmZXJlbnQgaW50ZXJ2YWxzIHdpdGhvdXQgaW50cm9kdWNpbmcgbmV3IHVubmVjY2VzYXJ5IHNjaGVkdWxlcnNcbiAgICAgICAgaWYgKHRoaXMudGltZXIgJSAyMCA9PT0gMCApeyAgLy8gcnVuIGV2ZXJ5IDIwKjUgKHVwZGF0ZWxvb3ApIHNlY29uZHNcblxuICAgICAgICAgICAgY29uc3QgdXNlc1JlbW90ZUFzc2lzdGFudCA9IGF3YWl0IHJ1blJlbW90ZUNoZWNrKHByb2Nlc3MucGxhdGZvcm0pXG5cbiAgICAgICAgICAgIGlmICh1c2VzUmVtb3RlQXNzaXN0YW50KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZWFkeTogUG9zc2libGUgcmVtb3RlIGFzc2lzdGFuY2UgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5rZXl3b3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBLZXl3b3JkICR7a2V5d29yZH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb3J0IG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQucG9ydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogUG9ydCAke3BvcnR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50ID0gdXNlc1JlbW90ZUFzc2lzdGFudFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKCkgIC8vIGNoZWNrIGlmIHRoZXJlIGlzIGEgbmV3IHNjcmVlbiB0aGF0IG5lZWRzIHRvIGJlIGJsb2NrZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWQgIG5vIHNlcnZlcnNpZ25hbCBmb3IgMjAgc2Vjb25kc1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApeyAgXG4gICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBDb25uZWN0aW9uIHRvIFRlYWNoZXIgbG9zdCEgUmVtb3ZpbmcgcmVnaXN0cmF0aW9uLlwiKSAvL3JlbW92ZSBzZXJ2ZXIgcmVnaXN0cmF0aW9uIGxvY2FsbHkgKHNhbWUgYXMgJ2tpY2snKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICAgICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgICAvLyB0aGlzIGFsc28gcmVzZXRzIHNlcnZlcmlwIHRoZXJlZm9yZSBubyBhcGkgY2FsbHMgYXJlIG1hZGUgYWZ0ZXJ3YXJkc1xuICAgICAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAgICAgICAvLyBqdXN0IGluIGNhc2Ugc2NyZWVucyBhcmUgYmxvY2tlZC4uIGxldCBzdHVkZW50cyB3b3JrXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gIFxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0ge2NsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm99XG5cbiAgICAgICAgICAgIGZldGNoKGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVgLCB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7IH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICAgICAgKGRhdGEubWVzc2FnZSA9PT0gXCJub3RhdmFpbGFibGVcIil7IGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IEV4YW0gSW5zdGFuY2Ugbm90IGZvdW5kIScpOyAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSA1OyB9ICAgIC8vIGV4YW0gaW5zdGFuY2Ugbm90IGF2YWlsYWJsZSBidXQgc2VydmVyIHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChkYXRhLm1lc3NhZ2UgPT09IFwicmVtb3ZlZFwiKXsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IFN0dWRlbnQgcmVnaXN0cmF0aW9uIG5vdCBmb3VuZCEnKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KClcbiAgICAgICAgICAgICAgICAgICAgfSAgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCAtIHdlIGhhbmRsZSB0aGlzIGRpZmZlcmVudGx5IG5vdy4gdGVhY2hlciBzdG9yZXMgXCJraWNrZWRcIiBmb3Igc3R1ZGVudCB0byBjb2xsZWN0LiBzdHVkZW50IGlzIHJlbW92ZWQgZnJvbSBzZXJ2ZXIgd2hlbiBjb2xsZWN0aW5nIGtpY2tlZCBpbmZvLiBzdHVkZW50IGNsb3NlcyBleGFtIGFuZCBjbGVhbnMgdXAuXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSBIZWFydGJlYXQgbG9zdC4uYCk7ICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO30gICAvLyBoZWFydGJlYXQgbG9zdCBzZXJ2ZXIgbm90IHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMDsgLy8gRGllcyB6XHUwMEU0aGx0IGViZW5mYWxscyBhbHMgZXJmb2xncmVpY2hlciBIZWFydGJlYXQgLSBWZXJiaW5kdW5nIGhhbHRlblxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IGZhbHNlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlclN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnNlcnZlcnN0YXR1cykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHVkZW50U3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc3R1ZGVudHN0YXR1cykpOyBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJTdGF0dXNEZWVwQ29weSwgc3R1ZGVudFN0YXR1c0RlZXBDb3B5KTsvLyBWZXJhcmJlaXR1bmcgZGVyIGVtcGZhbmdlbmVuIERhdGVuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogKCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9KSAke2Vycm9yfWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IC8vIHByZXZlbnQgZm9jdXMgd2FybmluZyBibG9jayBpZiBubyBjb25uZWN0aW9uIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIGlmIG5vdCBjb25uZWN0ZWQgYnV0IHN0aWxsIGluIGV4YW0gbW9kZSB5b3UgY291bGQgdHJpZ2dlciBhIGZvY3VzIHdhcm5pbmcgYW5kIG5vYm9keSBpcyBhYmxlIHRvIHVubG9jayB5b3VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICBhc3luYyBzZW5kU2NyZWVuc2hvdCgpe1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7cmV0dXJufSAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZFxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2s7IC8vIFZhcmlhYmxlbiBhdVx1MDBERmVyaGFsYiBkZXMgaWYtQmxvY2tzIGRlZmluaWVyZW5cbiAgICAgICAgICAgIGxldCBpbWdCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBzY3JlZW5zaG90IGZyb20gZGVza3RvcCB2aWEgc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQgKGZsYW1lc2hvdCwgaW1hZ2VtYWdpYywgZXRjKVxuICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90KHsgZm9ybWF0OiAncG5nJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrLCBpbWdCdWZmZXIgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAgLy8ga2VpbiBpbWFnZUJ1ZmZlciBtaXRnZWdlYmVuIGJlZGV1dGV0IG51dHplIHNjcmVlbnNob3QtZGVza3RvcCBpbSB3b3JrZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHsgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwO31cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW1hZ2UgcHJvY2Vzc2luZyBmYWlsZWRcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBcInNjcmVlbnNob3RcIiBmcm9tIGFwcHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEZvY3VzZWRNaW5kb3cgPSBXaW5kb3dIYW5kbGVyLmdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkgIC8vcmV0dXJucyBleGFtIHdpbmRvdyBpZiBub3RoaW5nIGluIGZvY3VzIG9yIG1haW4gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Rm9jdXNlZE1pbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGN1cnJlbnRGb2N1c2VkTWluZG93LndlYkNvbnRlbnRzLmNhcHR1cmVQYWdlKCkgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyB3b3JrIGJlY2F1c2UgaXQncyBvbmJvYXJkIGVsZWN0cm9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSByZXN1bHQudG9QTkcoKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjayB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7IC8vIGF0dGVudGlvbiBwcm9jZXNzSW1hZ2UgIGNvbnZlcnRzIGJ1ZmZlciB0byB1aW50OGFycmF5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyArPTE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBwcm9jZXNzSW1hZ2UgZmFpbGVkOiAke2Vycn1gKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTUFDT1MgV09SS0FST1VORCAtIHN3aXRjaCB0byBwYWdlY2FwdHVyZSBpZiBubyBwZXJtaXNzb25zIGFyZSBncmFudGVkXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiICYmIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgJiYgaW1nQnVmZmVyICE9PSBudWxsKXsgIC8vdGhpcyBpcyBmb3IgbWFjT1MgYmVjYXVzZSBpdCBkZWxpdmVycyBhIGJsYW5rIGJhY2tncm91bmQgc2NyZWVuc2hvdCB3aXRob3V0IHBlcm1pc3Npb25zLiB3ZSBjYXRjaCB0aGF0IGNhc2Ugd2l0aCBhIHdvcmthcm91bmRcbiAgICAgICAgICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gZmFsc2UgICAvL25ldmVyIGRvIHRoaXMgYWdhaW5cbiAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gYXBwLmlzUGFja2FnZWQgPyBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnKSA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKTtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgID0gYXdhaXQgVGVzc2VyYWN0LnJlY29nbml6ZShpbWdCdWZmZXIgLCAnZW5nJyx7IGxhbmdQYXRoOiBwdWJsaWNQYXRoIH0gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFwcFdpbmRvd1Zpc2libGUgPSB0ZXh0LmluY2x1ZGVzKFwiRXhhbVwiKSAgIC8vY2hlY2sgaWYgdGhlIHdvcmQgXCJFeGFtXCIgY2FuIGJlIGZvdW5kIGluIHNjcmVlbnNob3QgLSBvdGhlcndpc2UgaXQgaXMgbW9zdCBsaWtlbHkgYSBibGFuayBkZXNrdG9wIC0gbWFjb3MgcXVpcmtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBXaW5kb3dWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBQbGVhc2UgY2hlY2sgeW91ciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIC0gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogTWFjT1Mgc2NyZWVuc2hvdHBlcm1pc3Npb25zIGNoZWNrIE9LXCIpO31cbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXJyKXsgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nIHdlIGRvIG5vdCBoYXZlIGEgc2NyZWVuc2hvdCAtIHNvIGRvIG5vdCB1cGRhdGUgdGhlIHNlcnZlclxuICAgICAgICAgICAgaWYgKCFzY3JlZW5zaG90QmFzZTY0KXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFNjcmVlbnNob3QgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlYCkgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBQYWdlQ2FwdHVyZSBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gTm8tUHJvY2Vzc2luZ2ApIH0gICBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogbm8gc2NyZWVuc2hvdCBhdmFpbGFibGUgLSBwbGVhc2UgZml4IHlvdXIgc2V0dXBgKSB9XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIC8vZG8gbm90IHJ1biBjb2xvcmNoZWNrIGlmIGFscmVhZHkgbG9ja2VkXG4gICAgICAgICAgICBpZiAoIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMpe1xuICAgICAgICAgICAgICAgIGlmIChpc2JsYWNrKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGZpdCByZXF1aXJlbWVudHMgKGFsbGJsYWNrKVwiKTtcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RoYXNoID0gbnVsbFxuICAgICAgICAgICAgdHJ5IHsgc2NyZWVuc2hvdGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgfSAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IGNyZWF0aW5nIGhhc2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90OiBzY3JlZW5zaG90QmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RoYXNoOiBzY3JlZW5zaG90aGFzaCxcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGhlYWRlckJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90ZmlsZW5hbWU6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gKyBcIi5qcGdcIixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzZW5kIHNjcmVlbnNob3QgdG8gc2VydmVyIHZpYSBlbWFpbCBmZXRjaCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMjtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVzY3JlZW5zaG90YDtcbiAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQsIG1heFJldHJpZXMpOyAvLyBFcnN0ZSBBbmZyYWdlIHN0YXJ0ZW5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG4gICAgZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgPSAwLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogU3RhdHVzIEVycm9yOlwiLCBkYXRhLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgaWYgKGF0dGVtcHQgPCBtYXhSZXRyaWVzIC0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgKyAxLCBtYXhSZXRyaWVzKTsgLy8gUmV0cnlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcyAtIDEgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlIChmZXRjaCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cbiAgICBhc3luYyBraWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKXtcbiAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpY2tTdHVkZW50OiBTdHVkZW50IGdvdCBraWNrZWQgYnkgVGVhY2hlclwiKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlfSAgLy8gZG8gbm90IGRlbGV0ZSBmb2xkZXIgb24gZXhpdCBiZWNhdXNlIHN0dWRlbnQgZ290IGtpY2tlZFxuICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cyAmJiBzdHVkZW50c3RhdHVzLmRlbGZvbGRlcil7IHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPSB0cnVlfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIHJlYWN0IHRvIHNlcnZlciBzdGF0dXMgXG4gICAgICogdGhpcyBjdXJyZW50bHkgb25seSBoYW5kbGUgc3RhcnRleGFtICYgZW5kZXhhbVxuICAgICAqIGNvdWxkIGFsc28gaGFuZGxlIGtpY2ssIGZvY3VzcmVzdG9yZSwgYW5kIGV2ZW4gdHJpZ2dlciBmaWxlIHJlcXVlc3RzXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyc3RhdHVzLCBzdHVkZW50c3RhdHVzKXtcbiAgICAgICBcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBpbmRpdmlkdWFsIHN0YXR1cyB1cGRhdGVzXG5cbiAgICAgICAgaWYgKCBzdHVkZW50c3RhdHVzICYmIE9iamVjdC5rZXlzKHN0dWRlbnRzdGF0dXMpLmxlbmd0aCAhPT0gMCkgeyAgLy8gd2UgaGF2ZSBzdGF0dXMgdXBkYXRlcyAodGFza3MpIC0gZG8gaXQhXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5wcmludGRlbmllZCkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdkZW5pZWQnKSAgIC8vdHJpZ2dlciwgd2h5XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmtpY2tlZCkgeyAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIGJ5IHRlYWNoZXJcbiAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlclwiKVxuICAgICAgICAgICAgICAgIGxldCBkZWxmb2xkZXIgPSB0cnVlXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBcbiAgICAgICAgICAgICAgICAgICAgZGVsZm9sZGVyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycm9yKSAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ2FuIG5vdCBkZWxldGUgZGlyZWN0b3J5IC0gJHtlcnJvcn0gYClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyID09IGZhbHNlKXsgIC8vdHJ5IGRlbGV0aW5nIGZpbGUgYnkgZmlsZSAodGhlIG9uZSB0aGF0IGNhdXNlcyB0aGUgcHJvYmxlbSB3aWxsIHN0YXkgaW4gdGhlIGZvbGRlcilcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkgeyBmcy5ybVN5bmMoZmlsZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBWZXJzdWNoZSwgZGFzIFZlcnplaWNobmlzIHJla3Vyc2l2IHp1IGxcdTAwRjZzY2hlblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZnMudW5saW5rU3luYyhmaWxlUGF0aCk7ICB9Ly8gVmVyc3VjaGUsIGRpZSBEYXRlaSB6dSBsXHUwMEY2c2NoZW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IChkZWxmb2xkZXIpIEZlaGxlciBiZWltIExcdTAwRjZzY2hlbiBkZXIgRGF0ZWkvVmVyemVpY2huaXM6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZm9jdXMgPT0gZmFsc2Upe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiByZXN0b3JpbmcgZm9jdXMgc3RhdGUgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KXsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gdHJ1ZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSBmYWxzZSAgKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSB0cnVlICAvL2NsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2sgd2lsbCBiZSBwdXQgb24gdGhpcy5wcml2YXRlU3BlbGxjaGVjayBpbiBlZGl0b3IgdXBkYXRlZCB2aWEgZmV0Y2hJbmZvKClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBpcGNNYWluLmVtaXQoXCJzdGFydExhbmd1YWdlVG9vbFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSBmYWxzZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSB0cnVlICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogZGUtYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSBmYWxzZSBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5zdWdnZXN0aW9ucyA9IHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuc2VuZGV4YW0gPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEV4YW1Ub1RlYWNoZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZmV0Y2hmaWxlcyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoc3R1ZGVudHN0YXR1cy5maWxlcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdldG1hdGVyaWFscyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdGhpcyBpcyBhbiBtaWNyb3NvZnQzNjUgdGhpbmcuIGNoZWNrIGlmIGV4YW0gbW9kZSBpcyBvZmZpY2UsIGNoZWNrIGlmIHRoaXMgaXMgc2V0IC0gb3RoZXJ3aXNlIGRvIG5vdCBlbnRlciBleGFtbW9kZSAtIGl0IHdpbGwgZmFpbFxuICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIHNoYXJpbmcgbGluayAtIGl0IHdpbGwgYmUgdXNlZCBpbiBcIm1pY3Jvc29mdDM2NVwiIGV4YW0gbW9kZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gc3R1ZGVudHN0YXR1cy5tc29mZmljZXNoYXJlICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIGdyb3VwIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IHN0dWRlbnRzdGF0dXMuZ3JvdXAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIFxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGdsb2JhbCBzdGF0dXMgdXBkYXRlc1xuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIFxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgU1RBUlRcbiAgICAgICAgICogQVRURU5USU9OOiBtb3ZlIHRoaXMgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiAtIGl0IGlzIHRvbyBjb21wbGV4IGFuZCBzaG91bGQgYmUgc3BsaXQgdXBcbiAgICAgICAgICogaW4gdGhlIGZ1dHVyZSB3ZSB3ZWxsIGRldGVybWluZSBpZiBzZWN0aW9uIHN3aXRjaCBpcyBoYW5kbGVkIGJ5IHRoZSB0ZWFjaGVyIG9yIGJ5IHRoZSBzdHVkZW50IGFuZCBhY3QgYWNjb3JkaW5nbHlcbiAgICAgICAgICogaWYgaGFuZGxlZCBieSBzdHVkZW50IHRoZSB0ZWFjaGVyIHN0dHR1cyBpcyBpZ25vcmVkIGFuZCB0aGUgc3dpY2ggc2VjdGlvbiBmdW5jdGlvbiBpcyBjYWxsZWQgZGlyZWN0bHkgKHByb2JhYmx5IG1vdmUgdG8gaXBjaGFuZGxlci5qcylcbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBjdXJyZW50IGFjdGl2ZSBzZWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBvbmUgaW4gdGhlIHNlcnZlcnN0YXR1cyAtIGlmIG5vdCBjaGFuZ2UgdG8gdGhlIG5ldyBzZWN0aW9uXG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNoYW5naW5nIHNlY3Rpb24gdG8gJHtzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbn0gJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZX1gIClcblxuICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TG9ja2VkU2VjdGlvbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbjsgLy8gQ3VycmVudCBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBzYXZpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uOyAvLyBOZXcgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3IgbG9hZGluZylcbiAgICAgICAgICAgICAgICBjb25zdCBleGFtRGlyID0gdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeTtcblxuXG4gICAgICAgICAgICAgICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID09PSBcImVkaXRvclwiKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBzZW5kaW5nIGV4YW0gdG8gdGVhY2hlciAoZmluYWwgc3VibWl0KVwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgY3VycmVudCB3b3JrIGFzIGJhc2U2NCB0byB0ZWFjaGVyIChzdG9yZXMgcGRmIGluIEFCR0FCRSBmb2xkZXIgd2l0aCBzdWJtaXNzaW9uIG51bWJlcilcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBkZiA9IGF3YWl0IHRoaXMuZ2V0QmFzZTY0UERGKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciwgc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tjdXJyZW50TG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWUpICAvLyBsb2NhbCBmdW5jdGlvbiB0byBnZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAocGRmLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQmFzZTY0UERGdG9UZWFjaGVyKHBkZi5iYXNlNjRwZGYsIGN1cnJlbnRMb2NrZWRTZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpIC8vYmFja3VwIGxvY2FsIGZpbGVzIGFuZCBzZW5kIHRvIHRlYWNoZXIgKGFyY2hpdmUgd2l0aCB0aW1lc3RhbXApXG5cblxuICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhhbXR5cGUgaW4gY2xpZW50aW5mb1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbG9ja2VkIHNlY3Rpb24gQUZURVIgc2F2aW5nIHRoZSBvbGQgc3RhdGVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBuZXdMb2NrZWRTZWN0aW9uO1xuXG5cblxuICAgICAgICAgICAgICAgIC8vIE1PVkUgU2VjdGlvbiBGaWxlcyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMTogU0FWRSBDVVJSRU5UIEVYQU1ESVIgRklMRVMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhleGFtRGlyKSAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHsgLy8gQ2hlY2sgaWYgbWFpbiBkaXIgZXhpc3RzIGFuZCBhIHNlY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlUGF0aCA9IGAke2V4YW1EaXJ9LyR7Y3VycmVudExvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzYXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoc2F2ZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAvLyBDcmVhdGUgc2F2ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhleGFtRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gaXRlbXMgaW4gZXhhbURpciB0byBzYXZlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc1NhdmVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob2xkUGF0aCk7IC8vIEdldCBmaWxlIHN0YXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBwcm9jZXNzIGFjdHVhbCBGSUxFUywgbm90IGRpcmVjdG9yaWVzIChsaWtlIHRoZSBzZWN0aW9uIGZvbGRlcnMgdGhlbXNlbHZlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7c2F2ZVBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7IC8vIENvcHkgZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZFBhdGgpOyAvLyBEZWxldGUgb3JpZ2luYWwgZmlsZSBmcm9tIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNTYXZlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgKGZvbGRlcikgaXRlbSAke2ZpbGV9IGluIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IHNhdmVkICR7ZmlsZXNTYXZlZH0gZmlsZXMgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAyOiBMT0FEIEZJTEVTIGZyb20gdGhlIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgTkVXIGxvY2tlZCBzZWN0aW9uIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBuZXdMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRQYXRoID0gYCR7ZXhhbURpcn0vJHtuZXdMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2FkUGF0aCkpIHsgLy8gQ2hlY2sgaWYgdGhlIG5ldyBzZWN0aW9uIGZvbGRlciBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc1RvTG9hZCA9IGZzLnJlYWRkaXJTeW5jKGxvYWRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENvcGllZCBmaWxlICR7ZmlsZX0gZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIGl0ZW0gJHtmaWxlfSBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IG5ld0xvY2tlZFNlY3Rpb24gaXMgZmFsc3kgKCR7bmV3TG9ja2VkU2VjdGlvbn0pLCBza2lwcGluZyBmaWxlIGxvYWRgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3IgZHVyaW5nIGZvbGRlciBvcGVyYXRpb24gLSAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufSwgbmV3TG9ja2VkU2VjdGlvbjogJHtuZXdMb2NrZWRTZWN0aW9ufSwgZXhhbURpcjogJHtleGFtRGlyfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBBY3R1YWxseSBTV0lUQ0ggRVhBTSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBvciByZWxlYWQgdGhlIG5ldyBleGFtIHNlY3Rpb24gaW4gdGhlIHNhbWUgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93IC0gaWYgeW91IGRvbid0IG5leHQtZXhhbSB3aWxsIGNyYXNoIHNpbGVudGx5IG9uIHJlbG9hZCBhbmQgc2VjdGlvbiBzd2l0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKS5mb3JFYWNoKHdjID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgRU5EXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICBcblxuXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrKSB7ICB0aGlzLmFjdGl2YXRlU2NyZWVubG9jaygpIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICkgeyB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgfVxuXG4gICAgICAgIC8vIHNjcmVlbnNob3Qgc2FmZXR5IChPQ1Igc2VhcmNoZXMgZm9yIG5leHQtZXhhbSBzdHJpbmcpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jcikgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSB0cnVlICB9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSBmYWxzZSAgIH1cblxuICAgICAgICAvLyBHcm91cHMgaGFuZGxpbmdcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmdyb3Vwcyl7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZX1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gZmFsc2V9XG5cbiAgICAgICAgLy91cGRhdGUgc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsIHx8IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT09IDApIHsgLy8wIGlzIHRoZSBzYW1lIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCBidXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCAhPT0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGNoYW5nZWQgdG9cIiwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwXG4gICAgICAgICAgICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBkaXNhYmxlZCFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgb2xkIGludGVydmFsIGFuZCBzdGFydCBuZXcgaW50ZXJ2YWwgaWYgc2V0IHRvIHNvbWV0aGluZyBiaWdnZXIgdGhhbiB6ZXJvXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuaW50ZXJ2YWwgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgLy8gcmVtb3ZlIGxvY2tzY3JlZW4gaW1tZWRpYXRlbHkgLSBkb24ndCB3YWl0IGZvciBzZXJ2ZXIgaW5mb1xuICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgXG4gICAgICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBzZW5kIGJhc2U2NCBwZGYgdG8gdGVhY2hlclxuICAgIHNlbmRCYXNlNjRQREZ0b1RlYWNoZXIoYmFzZTY0cGRmLCBzZWN0aW9uPTEpe1xuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcHJpbnRyZXF1ZXN0LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfS8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59YDtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBiYXNlNjRwZGYsXG4gICAgICAgICAgICBwcmludHJlcXVlc3Q6IGZhbHNlLCAgICBcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcixcbiAgICAgICAgICAgIGxvY2tlZHNlY3Rpb246IHNlY3Rpb25cbiAgICAgICAgfVxuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7IHJldHVybiByZXNwb25zZS5qc29uKCk7ICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1lc3NhZ2UgPT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcisrICAgLy8gc3VjY2Vzc2Z1bCBzdWJtaXNzaW9uIC0+IGluY3JlbWVudCBudW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHsgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlZGl0b3IgQCBwcmludGJhc2U2NDpcIixlcnJvci5tZXNzYWdlKSAgICBcbiAgICAgICAgfSk7IFxuICAgIH1cbiAgICBcblxuXG5cbiAgICAvL2dldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgLy8gQVRURU5USU9OOiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGlwY2hhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgc3RvcmVzIGl0IGFzIGZpbGUgaW4gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgYXN5bmMgZ2V0QmFzZTY0UERGKHN1Ym1pc3Npb25udW1iZXIsIHNlY3Rpb25uYW1lLCBwcmludEJhY2tncm91bmQ9ZmFsc2Upe1xuICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBmb3IgYW55IG9uZ29pbmcgcHJpbnQgb3BlcmF0aW9uIHRvIGZpbmlzaCAobWF4IDMwIHNlY29uZHMpXG4gICAgICAgIGxldCB3YWl0Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhXYWl0ID0gMzAwOyAvLyAzMCBzZWNvbmRzIHdpdGggMTAwbXMgaW50ZXJ2YWxzXG4gICAgICAgIHdoaWxlIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgJiYgd2FpdENvdW50IDwgbWF4V2FpdCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApO1xuICAgICAgICAgICAgd2FpdENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBwcmludFRvUERGIGxvY2sgdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIHN0aWxsIHJ1bm5pbmdcIik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiUERGIGdlbmVyYXRpb24gdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIGluIHByb2dyZXNzXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHByaW50QmFja2dyb3VuZCxcbiAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuXG4gIFxuICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3NlY3Rpb25uYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7QWJnYWJlOiAke3N1Ym1pc3Npb25udW1iZXJ9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGVcbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9IC0gVmVyc2lvbiAke3N1Ym1pc3Npb25udW1iZXJ9XCJgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNldCBsb2NrIGJlZm9yZSBzdGFydGluZyBQREYgZ2VuZXJhdGlvblxuICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NHBkZiA9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtiYXNlNjRwZGZ9YDtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIlBERiBnZW5lcmF0ZWRcIiwgZGF0YVVybDpkYXRhVXJsLCBiYXNlNjRwZGY6IGJhc2U2NHBkZiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IEVycm9yIGdlbmVyYXRpbmcgUERGOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXJyb3IgZ2VuZXJhdGluZyBQREZcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIEFsd2F5cyByZWxlYXNlIHRoZSBsb2NrLCBldmVuIGlmIGFuIGVycm9yIG9jY3VycmVkXG4gICAgICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNob3cgdGVtcG9yYXJ5IHNjcmVlbmxvY2sgd2luZG93XG4gICAgYWN0aXZhdGVTY3JlZW5sb2NrKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcbiAgICAgICBcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID09IDApeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IHRydWVcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSAgLy8gYWRkIHNjcmVlbmxvY2sgd2luZG93cyBmb3IgYWRkaXRpb25hbCBkaXNwbGF5c1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSB0ZW1wb3Jhcnkgc2NyZWVubG9ja3dpbmRvd1xuICAgIGtpbGxTY3JlZW5sb2NrKCl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5sb2Nrd2luZG93ICYmICFzY3JlZW5sb2Nrd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lsbFNjcmVlbmxvY2s6IG5vIGZ1bmN0aW9uYWwgc2NyZWVubG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgfSBcbiAgICAgICAgLy8gQ2xlYXIgYXJyYXkgY29tcGxldGVseSBhZnRlciBhdHRlbXB0aW5nIHRvIGRlc3Ryb3kgYWxsIHdpbmRvd3NcbiAgICAgICAgLy8gVGhlIGNsb3NlZCBldmVudCBoYW5kbGVyIHdpbGwgYWxzbyBjbGVhbiB1cCwgYnV0IHRoaXMgZW5zdXJlcyB0aGUgYXJyYXkgaXMgZW1wdHlcbiAgICAgICAgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IGZhbHNlXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTdGFydHMgZXhhbSBtb2RlIGZvciBzdHVkZW50XG4gICAgICogZGVsZXRlcyB3b3JrZm9sZGVyIGNvbnRlbnRzIChpZiBzZXQpXG4gICAgICogb3BlbnMgYSBuZXcgd2luZG93IGluIGtpb3NrIG1vZGUgd2l0aCB0aGUgZ2l2ZW4gZXhhbXR5cGVcbiAgICAgKiBlbmFibGVzIHRoZSBibHVyIGxpc3RlbmVyIGFuZCBhY3RpdmF0ZXMgcmVzdHJpY3Rpb25zIChkaXNhYmxlIGtleWJvYXJzaG9ydGN1dHMgZXRjLilcbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGV4YW1tb2RlLCBleGFtdHlwZSwgYW5kIG90aGVyIHNldHRpbmdzIGZyb20gdGhlIHRlYWNoZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IGRpYWxvZyBpcyBvcGVuIGFuZCBsb2cgd2FybmluZ1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGl0V2FybmluZ09wZW4gfHwgV2luZG93SGFuZGxlci5leGl0UXVlc3Rpb25PcGVuIHx8IFdpbmRvd0hhbmRsZXIubWluaW1pemVXYXJuaW5nT3Blbikge1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogRGlhbG9nIGlzIHN0aWxsIG9wZW4gLSBleGFtIHdpbGwgc3RhcnQgYW55d2F5XCIpXG4gICAgICAgIH1cbiAgXG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICBcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5jbWFyZ2luICAvLyB0aGlzIGlzIHVzZWQgdG8gY29uZmlndXJlIG1hcmdpbiBzZXR0aW5ncyBmb3IgdGhlIGVkaXRvclxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxpbmVzcGFjaW5nID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0ubGluZXNwYWNpbmcgLy8gd2UgdHJ5IHRvIGRvdWJsZSBsaW5lc3BhY2luZyBvbiBkZW1hbmQgaW4gcGRmIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uYXVkaW9SZXBlYXQgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgaWYgKCFXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGNyZWF0aW5nIGV4YW0gd2luZG93XCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBtYW1tb3RoIGZyb20gJ21hbW1vdGgnO1xuXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyJztcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL3RyYXltZW51LmpzJztcbmltcG9ydCB7IGVuc3VyZU5ldHdvcmtPclJlc2V0IH0gZnJvbSAnLi90ZXN0cGVybWlzc2lvbnNNYWMuanMnO1xuaW1wb3J0IHsgZ2V0V2xhbkluZm8gfSBmcm9tICcuL2dldHdsYW5pbmZvLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY29uc3QgY2hlY2tQb3J0T3BlbiA9IChwb3J0LCBob3N0ID0gJzEyNy4wLjAuMScsIHRpbWVvdXQgPSAxNTAwKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBuZXQuU29ja2V0KCk7XG4gICAgICAgIGNvbnN0IGZpbmlzaCA9IChydW5uaW5nLCBlcnJvciA9IG51bGwpID0+IHtcbiAgICAgICAgICAgIHNvY2tldC5kZXN0cm95KCk7XG4gICAgICAgICAgICByZXNvbHZlKHsgcnVubmluZywgcG9ydCwgaG9zdCwgZXJyb3IgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHNvY2tldC5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBzb2NrZXQub25jZSgnY29ubmVjdCcsICgpID0+IGZpbmlzaCh0cnVlKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCd0aW1lb3V0JywgKCkgPT4gZmluaXNoKGZhbHNlLCAndGltZW91dCcpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4gZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSkpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc29ja2V0LmNvbm5lY3QocG9ydCwgaG9zdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBJUEMgaGFuZGxpbmcgKEJhY2tlbmQpIFNUQVJUXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5jbGFzcyBJcGNIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZSAvLyBmbGFnIHRvIHByZXZlbnQgY2xvc2luZyB3aW5kb3cgd2hpbGUgcHJpbnRpbmdcbiAgICB9XG4gICAgaW5pdCAobWMsIGNvbmZpZywgd2gsIGNoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gd2ggIFxuICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyID0gY2hcbiAgICAgICAgXG5cbiAgICAgICAgaXBjTWFpbi5vbignc2V0LW5ldy1sb2NhbGUnLCAoZXZlbnQsIGxvY2FsZSkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzZXQtbmV3LWxvY2FsZTogc2V0dGluZyBuZXcgbG9jYWxlIHRvICR7bG9jYWxlfWApXG4gICAgICAgICAgICBpMThuLmxvY2FsZSA9IGxvY2FsZVxuICAgICAgICAgICAgdXBkYXRlU3lzdGVtVHJheShpMThuLmxvY2FsZSk7XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0RXhhbU1hdGVyaWFscycsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgIFxuICAgICAgICAgICAgbGV0IGNsaWVudGluZm8gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvXG4gICAgICAgICAgICBsZXQgc2VydmVybmFtZSA9IGNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICAgICAgbGV0IHNlcnZlcmlwID0gY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICAgICAgbGV0IHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0geyBcbiAgICAgICAgICAgICAgICBncm91cDogY2xpZW50aW5mby5ncm91cCxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGV4YW1NYXRlcmlhbHMgPSBmYWxzZVxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICAgICAgICAgIGV4YW1NYXRlcmlhbHMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2dldGV4YW1tYXRlcmlhbHMvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWAsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiByZWNlaXZlZCBkYXRhXCIsIGRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6ICR7ZXJyfWApKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhhbU1hdGVyaWFsc1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgXG4gICAgICAgIH0pIFxuXG4gICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiBmb3IgY29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBleGFtIG1vZGVzKVxuICAgICAgICBjb25zdCBjaGVja0NvbW1vbkV4Y2VwdGlvbnMgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiTWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJHb29nbGVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFjY291bnRzXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZS5jb21cIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIm15c2lnbmluc1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFjY291bnRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwid2luZG93c2F6dXJlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRvbmxpbmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvb2t1cFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImJpbGR1bmcuZ3YuYXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNoaWJib2xldGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImlkLWF1c3RyaWEuZ3YuYXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aEhhbmRsZXJcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZXUtbW9iaWxlLmV2ZW50cy5kYXRhXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ3N0YXRpYy5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFhZGNkblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRvbmxpbmVcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImxpdmUuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtc2Z0YXV0aC5uZXRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImFhZGNkblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtc2Z0YXV0aC5uZXRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZXN5bmRpY2F0aW9uLmNvbVwiKSkgcmV0dXJuIHRydWU7IFxuXG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgYWxsb3dlZFVybHMgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZ3Vlc3QgPSB3ZWJDb250ZW50cy5mcm9tSWQoTnVtYmVyKGd1ZXN0SWQpKTtcbiAgICAgICAgICAgIGlmICghZ3Vlc3QgfHwgZ3Vlc3QuaXNEZXN0cm95ZWQ/LigpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgICAvLyBFbnRmZXJuZSBhbHRlIExpc3RlbmVyLCB1bSBEb3BwZWwtUmVnaXN0cmllcnVuZ2VuIHp1IHZlcm1laWRlblxuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgXG4gICAgICAgICAgICBjb25zdCBhbGxvdyA9IGFsbG93ZWRVcmxzLm1hcChzID0+IFN0cmluZyhzKS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIFVSTCBtYXRjaGVzIGFsbG93ZWQgZG9tYWluIChzdXBwb3J0cyBzdWJkb21haW5zIGFuZCBwYXRocylcbiAgICAgICAgICAgIGNvbnN0IGlzVXJsQWxsb3dlZCA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVybCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybFN0ciA9IFN0cmluZyh0YXJnZXRVcmwpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgY29tbW9uIGV4Y2VwdGlvbnMgZmlyc3RcbiAgICAgICAgICAgICAgICBpZiAoY2hlY2tDb21tb25FeGNlcHRpb25zKHVybFN0cikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGVhY2ggYWxsb3dlZCBVUkxcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGFsbG93ZWRVcmwgb2YgYWxsb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRyeSB0byBwYXJzZSBhcyBVUkwgdG8gZXh0cmFjdCBob3N0bmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0SG9zdG5hbWUgPSB1cmxPYmouaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGFyc2UgYWxsb3dlZCBVUkwgdG8gZXh0cmFjdCBkb21haW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhbGxvd2VkRG9tYWluID0gYWxsb3dlZFVybDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbGxvd2VkVXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCBhbGxvd2VkVXJsLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd2VkVXJsT2JqID0gbmV3IFVSTChhbGxvd2VkVXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkRG9tYWluID0gYWxsb3dlZFVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxvd2VkVXJsLmluY2x1ZGVzKCcvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBpdCdzIGEgcGF0aCB3aXRob3V0IHByb3RvY29sLCBleHRyYWN0IGRvbWFpbiBwYXJ0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBhbGxvd2VkVXJsLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dlZERvbWFpbiA9IHBhcnRzWzBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4YWN0IG1hdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09IGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBhbGxvd2VkRG9tYWluIGlzIGEgc3BlY2lmaWMgc3ViZG9tYWluIChjb250YWlucyBkb3RzKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNTcGVjaWZpY1N1YmRvbWFpbiA9IGFsbG93ZWREb21haW4uaW5jbHVkZXMoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzU3BlY2lmaWNTdWJkb21haW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIHNwZWNpZmljIHN1YmRvbWFpbiBpcyBzcGVjaWZpZWQsIG9ubHkgYWxsb3cgdGhhdCBleGFjdCBzdWJkb21haW4gYW5kIHd3dy4gdmFyaWFudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gJ3d3dy4nICsgYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYWxsb3cgb3RoZXIgc3ViZG9tYWlucyB3aGVuIGEgc3BlY2lmaWMgb25lIGlzIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBvbmx5IGJhc2UgZG9tYWluIGlzIHNwZWNpZmllZCAoZS5nLiwgXCJvcmYuYXRcIiksIGFsbG93IGFsbCBzdWJkb21haW5zXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxsb3cgd3d3LiBzdWJkb21haW4gZXhwbGljaXRseVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gJ3d3dy4nICsgYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxsb3cgb3RoZXIgc3ViZG9tYWlucyAoZS5nLiwgc3ViLmR1ZGVuLmRlIGlmIGR1ZGVuLmRlIGlzIGFsbG93ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lLmVuZHNXaXRoKCcuJyArIGFsbG93ZWREb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IHRhcmdldEhvc3RuYW1lLnNsaWNlKDAsIC0oYWxsb3dlZERvbWFpbi5sZW5ndGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIHByZWZpeDogbXVzdCBiZSB2YWxpZCBzdWJkb21haW4gbmFtZSAoYWxwaGFudW1lcmljIGFuZCBoeXBoZW5zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlZml4ICYmICFwcmVmaXguaW5jbHVkZXMoJy4nKSAmJiAvXlthLXpBLVowLTldKFthLXpBLVowLTktXSpbYS16QS1aMC05XSk/JC8udGVzdChwcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIFVSTCBwYXJzaW5nIGZhaWxzLCBmYWxsIGJhY2sgdG8gc2ltcGxlIGluY2x1ZGVzIGNoZWNrIGZvciBwYXRoc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVybFN0ci5pbmNsdWRlcyhhbGxvd2VkVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0FsbG93ZWQgPSBpc1VybEFsbG93ZWQodXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNBbGxvd2VkKSB7IFxuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYWxsb3dlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0FsbG93ZWQgPSBpc1VybEFsbG93ZWQodXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzQWxsb3dlZCkgeyBcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGJsb2NrZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBVbmlmaWVkIElQQyBoYW5kbGVyIGZvciB3ZWJ2aWV3IGJsb2NraW5nIC0gc3VwcG9ydHMgd2Vic2l0ZSwgZWR1dmlkdWFsLCBmb3JtcywgcmRwIG1vZGVzXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGUsIGFsbG93ZWREb21haW4sIGJhc2VVcmwsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluLCBnZm9ybXNUZXN0SWQgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZ3Vlc3QgPSB3ZWJDb250ZW50cy5mcm9tSWQoTnVtYmVyKGd1ZXN0SWQpKTtcbiAgICAgICAgICAgIGlmICghZ3Vlc3QgfHwgZ3Vlc3QuaXNEZXN0cm95ZWQ/LigpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGxpc3RlbmVycyB0byBwcmV2ZW50IGR1cGxpY2F0ZSByZWdpc3RyYXRpb25zXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVVJMIHZhbGlkYXRpb24gZnVuY3Rpb24gLSBkaWZmZXJlbnQgbG9naWMgYmFzZWQgb24gbW9kZVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChtb2RlID09PSBcIndlYnNpdGVcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBXRUJTSVRFIG1vZGU6IGNoZWNrIGRvbWFpbiBtYXRjaGluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVybCB8fCB0YXJnZXRVcmwuaW5jbHVkZXMoYmFzZVVybCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybE9iaiA9IG5ldyBVUkwodGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRvbWFpbiA9IHVybE9iai5ob3N0bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbiA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFeHBsaWNpdGx5IGFsbG93IHd3dy4gc3ViZG9tYWluXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4uZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBkb21haW4uc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlZml4ICYmICFwcmVmaXguaW5jbHVkZXMoJy4nKSAmJiAvXlthLXpBLVowLTldKFthLXpBLVowLTktXSpbYS16QS1aMC05XSk/JC8udGVzdChwcmVmaXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJlZHV2aWR1YWxcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBFRFVWSURVQUwvTU9PRExFIG1vZGU6IGNoZWNrIG1vb2RsZVRlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZVRlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBNb29kbGUtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwic3RhcnRhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJwcm9jZXNzYXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9nb3V0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZWR1dmlkdWFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb2xpY3lcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9ydGFsLnRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9ydGFsLnRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImZvcm1zXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRk9STVMgbW9kZTogY2hlY2sgZ2Zvcm1zVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoZ2Zvcm1zVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIEdvb2dsZSBGb3Jtcy1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZm9ybVJlc3BvbnNlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInZpZXdzY29yZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwicmRwXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUkRQIG1vZGU6IGFsbG93IGFsbCAob3IgaW1wbGVtZW50IHNwZWNpZmljIGxvZ2ljIGlmIG5lZWRlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgbW9kZXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoZWNrQ29tbW9uRXhjZXB0aW9ucyh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gSGFuZGxlIHRhcmdldD1cIl9ibGFua1wiIGxpbmtzIGFuZCB3aW5kb3cub3BlbiAtIGJsb2NrIEJFRk9SRSBuYXZpZ2F0aW9uXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIHdpbmRvdy5vcGVuIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyAvLyBPcGVuIGluIHNhbWUgd2Vidmlld1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAvLyBQcmV2ZW50IG5ldyB3aW5kb3dcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIHdpbmRvdy5vcGVuIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gSGFuZGxlIHdpbGwtbmF2aWdhdGUgb24gd2ViQ29udGVudHMgbGV2ZWwgLSB0aGlzIGZpcmVzIEJFRk9SRSBuYXZpZ2F0aW9uIGhhcHBlbnNcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBCbG9jayBuYXZpZ2F0aW9uIGNvbXBsZXRlbHkgLSB0aGlzIGhhcHBlbnMgQkVGT1JFIHBhZ2UgbG9hZHNcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3Quc3RvcCgpOyAvLyBTdG9wIGFueSBsb2FkaW5nIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxpYXMgZm9yIGVkdXZpZHVhbCBtb2RlIC0gcmVkaXJlY3RzIHRvIHVuaWZpZWQgaGFuZGxlclxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLWVkdXZpZHVhbC13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pID0+IHtcbiAgICAgICAgICAgIC8vIENhbGwgdGhlIHVuaWZpZWQgaGFuZGxlciB3aXRoIGVkdXZpZHVhbCBtb2RlXG4gICAgICAgICAgICBjb25zdCB1bmlmaWVkSGFuZGxlciA9IGlwY01haW4ubGlzdGVuZXJzKCdzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3JylbMF07XG4gICAgICAgICAgICBpZiAodW5pZmllZEhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5pZmllZEhhbmRsZXIoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZTogJ2VkdXZpZHVhbCcsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgICBcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVsb2FkIHRoZSBicm93c2VyIHZpZXdcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdyZWxvYWQtYnJvd3Nlci12aWV3JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybCk7XG4gICAgICAgIH0pO1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgbGFuZ3VhZ2VUb29sIEFQSSBTZXJ2ZXIgKHdpdGggSmF2YSBKUkUpXG4gICAgICAgICAqIFJ1bnMgYXQgbG9jYWxob3N0IDgwODhcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KSBcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhY3RpdmF0ZSBzcGVsbGNoZWNrIG9uIGRlbWFuZCBmb3Igc3BlY2lmaWMgc3R1ZGVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7ICBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVjayBpZiBMYW5ndWFnZVRvb2wgc2VydmVyIHJlc3BvbmRzIG9uIGNvbmZpZ3VyZWQgcG9ydFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdpc0xhbmd1YWdlVG9vbFJ1bm5pbmcnLCBhc3luYyAoKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgcG9ydCA9IGxhbmd1YWdlVG9vbFNlcnZlci5wb3J0IHx8IDgwODg7XG4gICAgICAgICAgICBjb25zdCBob3N0cyA9IFsnMTI3LjAuMC4xJywgJzo6MScsICdsb2NhbGhvc3QnXTtcbiAgICAgICAgICAgIC8vIFJ1biBhbGwgY2hlY2tzIGluIHBhcmFsbGVsIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UsIHVzZSBsb25nZXIgdGltZW91dCBmb3Igc2VydmVyIHN0YXJ0dXAgZGV0ZWN0aW9uXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoaG9zdHMubWFwKGhvc3QgPT4gY2hlY2tQb3J0T3Blbihwb3J0LCBob3N0LCAyNTAwKSkpO1xuICAgICAgICAgICAgLy8gUmV0dXJuIGZpcnN0IHN1Y2Nlc3NmdWwgcmVzdWx0LCBvciBsYXN0IHJlc3VsdCBpZiBub25lIHN1Y2NlZWRlZFxuICAgICAgICAgICAgY29uc3Qgc3VjY2Vzc1Jlc3VsdCA9IHJlc3VsdHMuZmluZChyZXN1bHQgPT4gcmVzdWx0LnJ1bm5pbmcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQgfHwgcmVzdWx0c1tyZXN1bHRzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgTE9DQUwgTG9ja2Rvd25cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ2xvY2FsbG9ja2Rvd24nLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvY2FsbG9ja2Rvd246IGxvY2tpbmcgZG93biBjbGllbnQgd2l0aG91dCB0ZWFjaGVyIGNvbm5lY3Rpb25cIilcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtcbiAgICAgICAgICAgICAgICBleGFtbW9kZTogdHJ1ZSxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGRlbGZvbGRlcm9uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogJ2RlLURFJyxcbiAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdFR5cGU6ICcnLFxuICAgICAgICAgICAgICAgIG1vb2RsZURvbWFpbjogJycsXG4gXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiAwLFxuICAgICAgICAgICAgICAgIG1zT2ZmaWNlRmlsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2xvY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGluOiAnMDAwMCcsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB1bmxvY2tvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZvbnRmYW1pbHk6ICdzYW5zLXNlcmlmJyxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0SWQ6ICcnLFxuICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGFzc3dvcmQ6IGFyZ3MucGFzc3dvcmQsXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICB1c2VFeGFtU2VjdGlvbnM6IGZhbHNlLCAvL2lmIGZhbHNlIGV4YW0gc2VjdGlvbiAxIGlzIHVzZWQgYW5kIG5vIHRhYnMgYXJlIGRpc3BsYXllZFxuICAgICAgICAgICAgICAgIGFjdGl2ZVNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgbG9ja2VkU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBleGFtU2VjdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgMToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhhbXR5cGU6IGFyZ3MuZXhhbW1vZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbWFyZ2luOiB7IHNpZGU6ICdyaWdodCcsIHNpemU6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzcGFjaW5nOiAnMicsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdWRpb1JlcGVhdDogMyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogYXJncy5sYW5ndWFnZXRvb2wgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogYXJncy5zcGVsbGNoZWNrbGFuZyB8fCAnZGUtREUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGFyZ3Muc3VnZ2VzdGlvbnMgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lID0gYXJncy5jbGllbnRuYW1lO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IFwiMTI3LjAuMC4xXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBcImxvY2FsaG9zdFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5waW4gPSBcIjAwMDBcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBcIjAwMDBcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgPSBcImFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IHRydWU7IC8vIHRoaXMgbXVzdCBiZSBzZXQgdG8gdHJ1ZSBpbiBvcmRlciB0byBzdG9wIHR5cGljYWwgbmV4dC1leGFtIGNsaWVudC90ZWFjaGVyIGFjdGlvbnNcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBsb2NhbGxvY2tkb3duXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBCSVAgTG9naW4gU2VxdWVuY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaXBjTWFpbi5vbignbG9naW5CaVAnLCAoZXZlbnQsIGJpcHRlc3QpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvZ2luQmlQOiBvcGVuaW5nIGJpcCB3aW5kb3cuIHRlc3RlbnZpcm9ubWVudDpcIiwgYmlwdGVzdClcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KVxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gYmlwIGxvZ29uXCJcbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZ2lzdGVycyB2aXJ0dWFsaXplZCBzdGF0dXNcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCd2aXJ0dWFsaXplZCcsICgpID0+IHsgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSB0cnVlOyB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgRk9DVVMgc3RhdGUgdG8gZmFsc2UgKG1vdXNlIGxlZnQgZXhhbSB3aW5kb3cpXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2ZvY3VzbG9zdCcsIChldmVudCwgY3RybGFsdD1mYWxzZSkgPT4geyBcbiAgICAgICAgICAgIGxldCBhbnN3ZXIgPSBmYWxzZSBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCB8fCAhdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbW1vZGUpIHsgXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmxlbmd0aCA+IDApIHsgXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5mb2N1c1RhcmdldEFsbG93ZWQgJiYgY3RybGFsdCA9PSBmYWxzZSl7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZm9jdXNsb3N0OiBtb3VzZWxlYXZlIGV2ZW50IHdhcyB0cmlnZ2VyZWQgYnV0IHRhcmdldCBpcyBhbGxvd2VkYClcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgIFxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gYmxvY2sgZXZlcnl0aGluZyBhbmQgaW5mb3JtIHRlYWNoZXIgIChwcm9iYWJseSBhbiBvdmVya2lsbCBvbiBtb3VzZWxlYXZlIC0gbmVlZHMgdGVzdGluZylcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IGZhbHNlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYW5zd2VyXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgbWFpbiBjb25maWcgb2JqZWN0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0Y29uZmlnJywgKGV2ZW50KSA9PiB7ICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmNvbmZpZyAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBVbmxvY2sgQ29tcHV0ZXJcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dyYWNlZnVsbHlleGl0JywgKCkgPT4geyAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdyYWNlZnVsbHlleGl0OiBncmFjZWZ1bGx5IGxlYXZpbmcgbG9ja2VkIGV4YW0gbW9kZWApXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ3JhY2VmdWxseUVuZEV4YW0oKSBcbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCkgXG4gICAgICAgIH0gKVxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIHN0b3AgcmVzdHJpY3Rpb25zXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdyZXN0cmljdGlvbnMnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIC8vdGhpcyBhbHNvIHN0b3BzIHRoZSBjbGVhckNsaXBib2FyZCBpbnRlcnZhbFxuICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgXG4gICAgICAgIH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogY29weSB0byBnbG9iYWwgY2xpcGJvYXJkXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjbGlwYm9hcmQnLCAoZXZlbnQsIHRleHQpID0+IHsgIFxuICAgICAgICAgICAgY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KVxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlLWNoZWNrIGhvc3RpcCBhbmQgZW5hYmxlIG11bHRpY2FzdCBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnY2hlY2tob3N0aXAnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICBsZXQgYWRkcmVzcyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHsgICAgYWRkcmVzcyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudC5hZGRyZXNzKCk7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHsgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IG11bHRpY2FzdGNsaWVudCBub3QgcnVubmluZ1wiKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGJlcmVpdHMgZWluZSBBZHJlc3NlIHZvcmhhbmRlbiBpc3QsIGxpZWZlcm4gd2lyIHNpZSB6dXJcdTAwRkNjay5cbiAgICAgICAgICAgIGlmIChhZGRyZXNzKSB7ICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwOyAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJzdWNoZSwgYW4gZGllIGtvcnJla3RlIFNjaG5pdHRzdGVsbGUgenUgYmluZGVuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEZhbGxzIGdhdGV3YXk0c3luYygpIGJsb2NraWVyZW5kIGlzdCwga2FubnN0IGR1IGRpZXNlbiBBdWZydWYgaW4gZWluIFByb21pc2UgcGFja2VuOlxuICAgICAgICAgICAgICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZSB9ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzID0gZ2F0ZXdheTRzeW5jKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7ICByZWplY3QoZXJyKTsgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSk7IC8vIExpZWZlcnQgZGllIElQIGRlciBTY2huaXR0c3RlbGxlLCB3ZWxjaGUgZGFzIERlZmF1bHQgR2F0ZXdheSBoYXRcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBrZWluZSBJUCAobWl0IEdhdGV3YXkpIHZlcmZcdTAwRkNnYmFyIGlzdCwgaG9sZSBlaW5lIGFsdGVybmF0aXZlIEFkcmVzc2VcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuaG9zdGlwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpOyAvLyBMaWVmZXJ0IGF1Y2ggZWluZSBJUCwgd2VubiBrZWluIEdhdGV3YXkgdmVyZlx1MDBGQ2diYXIgaXN0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogVW5hYmxlIHRvIGRldGVybWluZSBpcCBhZGRyZXNzXCIsIGUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyZlx1MDBFNGxzY2h0ZSBBZHJlc3NlbiAoei4gQi4gbG9jYWxob3N0KSBpZ25vcmllcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwID09PSBcIjEyNy4wLjAuMVwiKSB7ICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlOyAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gV2VubiBkaWUgTXVsdGljYXN0LUNsaWVudCBuaWNodCBsXHUwMEU0dWZ0LCBpbml0aWFsaXNpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCAmJiAhYWRkcmVzcykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZhbGxzIGluaXQoKSBhc3luY2hyb24gdW1nZXNldHp0IHdlcmRlbiBrYW5uLCB3YXJ0ZW4gd2lyIGhpZXIgZGFyYXVmLlxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm11bHRpY2FzdENsaWVudC5pbml0KHRoaXMuY29uZmlnLmdhdGV3YXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogRXJyb3IgaW5pdGlhbGl6aW5nIG11bHRpY2FzdCBjbGllbnRcIiwgZXJyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7XG4gICAgICAgIH0pO1xuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBlZGl0b3IgYXMgaHRtbCBmaWxlIC0gYXMgYmFja3VwIC0gb25seSB0cmlnZ2VyZWQgYnkgdGhlIHRlYWNoZXIgZm9yIG5vdyAoYWxsb3cgbWFudWFsIGJhY2t1cCAhISlcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHtjbGllbnRuYW1lOnRoaXMuY2xpZW50bmFtZSwgZmlsZW5hbWU6YCR7ZmlsZW5hbWV9Lmh0bWxgLCBlZGl0b3Jjb250ZW50OiBlZGl0b3Jjb250ZW50IH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3N0b3JlSFRNTCcsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgaHRtbENvbnRlbnQgPSBhcmdzLmVkaXRvcmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgbGV0IGh0bWxmaWxlbmFtZSA9IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpe1xuICAgICAgICAgICAgICAgIGh0bWxmaWxlbmFtZSA9IGAke2ZpbGVuYW1lfS5iYWtgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGh0bWxmaWxlID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGh0bWxmaWxlbmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChodG1sQ29udGVudCkgeyBcbiAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXI6IHN0b3JlSFRNTDogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShodG1sZmlsZSwgaHRtbENvbnRlbnQsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiAke2Vyci5tZXNzYWdlfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhbHRlcm5hdGVwYXRoID0gYCR7aHRtbGZpbGV9LSR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn0uYmFrYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogdHJ5aW5nIHRvIHdyaXRlIGZpbGUgYXM6XCIsIGFsdGVybmF0ZXBhdGggKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShhbHRlcm5hdGVwYXRoLCBodG1sQ29udGVudCwgZnVuY3Rpb24gKGVycikgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGdldCBiYXNlNjQgZW5jb2RlZCBwZGYgZnJvbSBlZGl0b3JcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UERGYmFzZTY0JywgYXN5bmMgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRQREZiYXNlNjQ6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIgPSBhcmdzLnN1Ym1pc3Npb25udW1iZXIrMSAvLyBjbGllbnRpbmZvIGtlZXBzIHRyYWNrIG9mIHN1Ym1pc3Npb25zIGZvciBhdXRvbWF0ZWQgc3VibWlzc2lvbm51bWJlcnMgYXQgc2VjdGlvbiBjaGFuZ2UgLSBidXQgdGhpcyBvYnZpb3VzbHkgaGFwcGVucyBhZnRlciBtYW51YWwgc3VibWl0XG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5nZXRCYXNlNjRQREYoYXJncy5zdWJtaXNzaW9ubnVtYmVyLCBhcmdzLnNlY3Rpb25uYW1lLCBhcmdzLnByaW50QmFja2dyb3VuZCkgICAvLyB3aHkgdGhlIGhlbGwgaXMgdGhpcyBmdW5jdGlvbiBsb2NhdGVkIGluIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGFuZCBub3QgaW4gaXBjaGFuZGxlci5qcyA/IEZJWE1FICFcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIHRoZSBFeGFtV2luZG93IGNvbnRlbnQgYXMgUERGXG4gICAgICAgICAqIEFUVEVOVElPTiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIHRoYXQgYWxzbyBnZW5lcmF0ZXMgYSBwZGYgYnV0IHJldHVucyBhIGJhc2U2NCB2ZXJzaW9uIG9mIHRoZSBwZGZcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdwcmludHBkZicsIChldmVudCwgYXJncykgPT4geyBcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcmludCBpZiBleGFtIG1vZGUgaXMgbm90IGFjdGl2ZSBhbnltb3JlXG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvPy5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGV4YW1tb2RlIGlzIGZhbHNlIC0gc2tpcHBpbmcgcHJpbnRcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcmludGluZ1BkZil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHByaW50IGFscmVhZHkgaW4gcHJvZ3Jlc3MgLSBza2lwcGluZyBuZXcgcmVxdWVzdFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IC8vIGRlZmluZSBwcmludCBvcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbnM6IHt0b3A6MC41LCByaWdodDowLCBib3R0b206MC41LCBsZWZ0OjAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGxhbmRzY2FwZTogYXJncy5sYW5kc2NhcGUsXG4gICAgICAgICAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJGb290ZXI6dHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7YXJncy5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHthcmdzLmNsaWVudG5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCBwZGZmaWxlbmFtZSA9IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0ucGRmYCAgLy8gZGVmYXVsdCBmaWxlbmFtZSA9IGNsaWVudG5hbWUucGRmXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MuZmlsZW5hbWUpeyAgLy8gaW4gY2FzZSBvZiBtYW51YWwgYmFja3VwIHRoZSB1c2VyIGNhbiBzZXQgYSBjdXN0b20gZmlsZW5hbWVcbiAgICAgICAgICAgICAgICAgICAgcGRmZmlsZW5hbWUgPSBgJHthcmdzLmZpbGVuYW1lfS5wZGZgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwZGZmaWxlcGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBwZGZmaWxlbmFtZSk7ICAvLyBwYXRoIHBvaW50cyB0byB0aGUgY3VycmVudCBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZWZpbGVuYW1lID0gYCR7cGRmZmlsZW5hbWV9LWF1eC5wZGZgICAgIC8vdGhvbWFzLnBkZi1hdXgucGRmIFxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZWJhY2t1cGZpbGVuYW1lID0gYCR7cGRmZmlsZW5hbWV9LW9sZC5wZGZgOyAgIC8vdGhvbWFzLnBkZi1vbGQucGRmXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlcGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGVmaWxlbmFtZSk7ICAvLyBpZiBzb21ldGhpbmcgZ29lcyB3cm9uZyB3ZSB0cnkgdG8gd3JpdGUgYSBkaWZmZXJlbnQgZmlsZVxuXG5cbiAgICAgICAgICAgICAgICAvLyBhdXggZmlsZXMgYXJlIGZpbGVzIGNyZWF0ZWQgaWYgdGhlIG1haW4gcGRmZmlsZXBhdGggaXMgbm90IHdyaXRlYWJsZSAob3BlbmVkIG9uIHdpbmRvd3MpIFxuICAgICAgICAgICAgICAgIHRyeSB7ICAvLyBhbHdheXMgY2hlY2sgZm9yIG9sZCBhdXggZmlsZXMgYW5kIHJlbmFtZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gYWx0ZXJuYXRlZmlsZW5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWJhY2t1cGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5yZW5hbWVTeW5jKGFsdGVybmF0ZXBhdGgsIG5ld1BhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX1gKTsgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgICAgIGNvbnN0IHdlYkNvbnRlbnRzID0gZXhhbVdpbmRvdz8ud2ViQ29udGVudHNcblxuICAgICAgICAgICAgICAgIGlmICghd2ViQ29udGVudHMpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IG5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwibm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIiAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IHRydWVcblxuICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgdGl0bGUgb2YgdGhlIGV4YW0gd2luZG93IGFuZCB0aGVyZWZvcmUgdGhlIGRvY3VtZW50IHRpdGxlIGZvciBQREYgbWV0YWRhdGFcbiAgICAgICAgICAgICAgICBjb25zdCBwZGZUaXRsZSA9IGFyZ3MuZmlsZW5hbWUgPyBhcmdzLmZpbGVuYW1lIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfSAtICR7YXJncy5zZXJ2ZXJuYW1lIHx8IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSB8fCAnJ31gXG4gICAgICAgICAgICAgICAgLy8gZXNjYXBlIHF1b3RlcyBhbmQgc3BlY2lhbCBjaGFyYWN0ZXJzIGZvciBKYXZhU2NyaXB0IHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRUaXRsZSA9IHBkZlRpdGxlLnJlcGxhY2UoL1xcXFwvZywgJ1xcXFxcXFxcJykucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgIHdlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHtlc2NhcGVkVGl0bGV9XCJgKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJpbnQgdGhlIGV4YW0gd2luZG93IHRvIHBkZlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gd2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKVxuICAgICAgICAgICAgICAgIH0pLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIHBkZiBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICB0cnkgeyBpZiAoZnMuZXhpc3RzU3luYyhwZGZmaWxlcGF0aCkpIHsgZnMudW5saW5rU3luYyhwZGZmaWxlcGF0aCk7IH19XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX1gKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKHBkZmZpbGVwYXRoLCBkYXRhLCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9IC0gd3JpdGluZyBmaWxlIGFzOiAke2FsdGVybmF0ZXBhdGh9IGApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBhdXggZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkgeyBpZiAoZnMuZXhpc3RzU3luYyhhbHRlcm5hdGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKGFsdGVybmF0ZXBhdGgpOyB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmIChhbHRlcm5hdGl2ZXIgUGZhZCk6ICR7ZXJyLm1lc3NhZ2V9YCk7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBhbHRlcm5hdGUgcGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShhbHRlcm5hdGVwYXRoLCBkYXRhLCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5yZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5yZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIikgICAvL21ha2Ugc3VyZSBzdHVkZW50cyBzZWUgdGhlIG5ldyBmaWxlIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyb3IubWVzc2FnZX1gKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnJvci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICB9KS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2F2ZXMgQWN0aXZlIFNoZWV0cyBmb3JtIGRhdGEgdG8gLmJhayBmaWxlXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzYXZlQWN0aXZlc2hlZXRzQmFrJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVuYW1lID0gYXJncy5maWxlbmFtZSA/IGAke2FyZ3MuZmlsZW5hbWV9LmJha2AgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2A7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYmFrRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENvbnZlcnQgZm9ybURhdGEgdG8gSlNPTiBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBqc29uRGF0YSA9IEpTT04uc3RyaW5naWZ5KGFyZ3MuZm9ybURhdGEsIG51bGwsIDIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFdyaXRlIHRvIC5iYWsgZmlsZVxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmFrRmlsZVBhdGgsIGpzb25EYXRhLCAndXRmOCcpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0Jhazogc2F2ZWQgZm9ybSBkYXRhIHRvICR7YmFrRmlsZW5hbWV9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogZXJyb3IubWVzc2FnZSwgc3RhdHVzOiBcImVycm9yXCIgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYWxsIGZvdW5kIFNlcnZlcnMgYW5kIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGlzIGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRpbmZvYXN5bmMnLCBhc3luYyAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSBmYWxzZSAgIFxuICAgICAgICAgICAgLy8gc2VydmVyc3RhdHVzIG9iamVrdCB3aXJkIG51ciBiZWkgYmVnaW5uIGRlcyBleGFtcyBhbiBkYXMgZXhhbSB3aW5kb3cgZHVyY2hnZXJlaWNodCBmXHUwMEZDciBiYXNpcyBlaW5zdGVsbHVuZ2VuXG4gICAgICAgICAgICAvLyBhbGxlIHdlaXRlcmVuIHVwZGF0ZXMgXHUwMEZDYmVyIGRhcyBzZXJ2ZXJzdGF0dXMgb2JqZWN0IHdlcmRlbiBpbSBjb21tdW5pY2F0aW9uIGhhbmRsZXIgZ2VsZXNlbiB1bmQgZ2dmLiBhdWYgZGFzIGNsaWVudGluZm8gb2JqZWN0IGdlbGVndFxuICAgICAgICAgICAgLy8gZGllc2VyIGtvbW11bmlrYXRpb25zZmx1c3MgbXVzcyBpbiAyLjAgZ2VzdHJlYW1saW5lZCB3ZXJkZW4gI0ZJWE1FXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyBzZXJ2ZXJzdGF0dXMgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXJ2ZXJzdGF0dXMgfVxuXG4gICAgICAgICAgICAvL2NvdW50IG51bWJlciBvZiBmaWxlcyBpbiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcih3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSAgLy8gZXJzdGVsbHQgZmFsbHMgblx1MDBGNnRpZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlbGlzdCA9IChhd2FpdCBmcy5wcm9taXNlcy5yZWFkZGlyKHdvcmtkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuXG5cbiAgICAgICAgICAgIHJldHVybiB7ICAgXG4gICAgICAgICAgICAgICAgc2VydmVybGlzdDogdGhpcy5tdWx0aWNhc3RDbGllbnQuZXhhbVNlcnZlckxpc3QsXG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJzdGF0dXM6IHNlcnZlcnN0YXR1c1xuICAgICAgICAgICAgfSAgIFxuICAgICAgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGJlY2F1c2Ugb2YgbWljcm9zb2Z0IDM2NSB3ZSBuZWVkIHRvIHdvcmsgd2l0aCBcIkJyb3dzZXJWaWV3XCIgXG4gICAgICAgICAqIGluIG9yZGVyIHRvIGJlIGFibGUgdG8gZGlzbGF5IGZ1bGxzY3JlZW4gaW5mb3JtYXRpb24gZnJvbSB0aGUgRXhhbSBoZWFkZXIgd2UgdGVtcG9yYXJpbHkgY29sbGFwc2UgdGhlIEJyb3dzZXJWaWV3IGZvciBPZmZpY2VcbiAgICAgICAgICogYW5kIHJlc3RvcmUgaXQgYWZ0ZXJ3YXJkcyAtIG5vdCBwZXJmZWN0IGJ1dCBsb29rcyBva1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NvbGxhcHNlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoeyB4OiAwLCB5OiAwLCB3aWR0aDogMCwgaGVpZ2h0OiAwIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgICAgICBpcGNNYWluLm9uKCdyZXN0b3JlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBtZW51SGVpZ2h0ID0gbWFpbldpbmRvdy5tZW51SGVpZ2h0O1xuICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTsgLy8gR2V0IHRoZSBjdXJyZW50IGJvdW5kcyBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBuZXcgYm91bmRzIG9mIHRoZSBjb250ZW50Vmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IG1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCwgLy8gZnVsbCB3aWR0aCBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIG1lbnVIZWlnaHQgLy8gcmVtYWluaW5nIGhlaWdodCBhZnRlciB0aGUgbWVudVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGUgbWVudSBoZWlnaHQgZHluYW1pY2FsbHkgd2hlbiBoZWFkZXIgY29udGVudCBjaGFuZ2VzXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCd1cGRhdGUtbWVudS1oZWlnaHQnLCAoZXZlbnQsIGhlaWdodCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93O1xuICAgICAgICAgICAgaWYgKG1haW5XaW5kb3cgJiYgaGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc3RvcmVkIG1lbnUgaGVpZ2h0XG4gICAgICAgICAgICAgICAgbWFpbldpbmRvdy5tZW51SGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFJlcG9zaXRpb24gdGhlIGJyb3dzZXIgdmlldyB3aXRoIG5ldyBoZWlnaHRcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudFZpZXcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB5OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZW5kcyBhIHJlZ2lzdGVyIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHNlcnZlciBpcFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgY2xpZW50bmFtZTp0aGlzLnVzZXJuYW1lLCBzZXJ2ZXJuYW1lOnNlcnZlcm5hbWUsIHNlcnZlcmlwLCBzZXJ2ZXJpcCwgcGluOnRoaXMucGluY29kZSBcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3JlZ2lzdGVyJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjbGllbnRuYW1lID0gYXJncy5jbGllbnRuYW1lXG4gICAgICAgICAgICBjb25zdCBwaW4gPSBhcmdzLnBpblxuICAgICAgICAgICAgY29uc3Qgc2VydmVyaXAgPSBhcmdzLnNlcnZlcmlwXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJuYW1lID0gYXJncy5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBjb25zdCBjbGllbnRpcCA9IGlwLmFkZHJlc3MoKVxuICAgICAgICAgICAgY29uc3QgaG9zdG5hbWUgPSBvcy5ob3N0bmFtZSgpXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gdGhpcy5jb25maWcudmVyc2lvblxuICAgICAgICAgICAgY29uc3QgYmlwdXNlcklEID0gYXJncy5iaXB1c2VySURcblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4peyAvLyNGSVhNRSBkYXMgc29sbHRlIGVpZ2VudGxpY2ggdm9tIHNlcnZlciBrb21tZW4gXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWxyZWFkeXJlZ2lzdGVyZWRcIiksIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9yZWdpc3RlcmNsaWVudC8ke3NlcnZlcm5hbWV9LyR7cGlufS8ke2NsaWVudG5hbWV9LyR7Y2xpZW50aXB9LyR7aG9zdG5hbWV9LyR7dmVyc2lvbn0vJHtiaXB1c2VySUR9YDtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IEFib3J0U2lnbmFsLnRpbWVvdXQoODAwMCk7IC8vIDgwMDAgTWlsbGlzZWt1bmRlbiA9IDggU2VrdW5kZW4gQWJvcnRTaWduYWwgbWl0IGVpbmVtIFRpbWVvdXRcblxuXG4gICAgICAgICAgICBmZXRjaCh1cmwsIHsgbWV0aG9kOiAnR0VUJywgc2lnbmFsIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIFxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT0gXCJzdWNjZXNzXCIpIHsgIC8vIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsbCBvdGhlcndpc2UgZGF0YSB3b3VsZCBiZSBcImZhbHNlXCJcbiAgICAgICAgICAgICAgICAgICAgLy8gRXJmb2xncmVpY2hlIFJlZ2lzdHJpZXJ1bmdcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lID0gY2xpZW50bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IHNlcnZlcmlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBzZXJ2ZXJuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmlwID0gY2xpZW50aXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaG9zdG5hbWUgPSBob3N0bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGRhdGEudG9rZW47IC8vIHdlIG5lZWQgdG8gc3RvcmUgdGhlIGNsaWVudCB0b2tlbiBpbiBvcmRlciB0byBjaGVjayBhZ2FpbnN0IGl0IGJlZm9yZSBwcm9jZXNzaW5nIGNyaXRpY2FsIGFwaSBjYWxsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5waW4gPSBwaW47XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6IHN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIGF0ICR7c2VydmVybmFtZX0gQCAke3NlcnZlcmlwfSBhcyAke2NsaWVudG5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gZGF0YTtcblxuICAgICAgICAgICAgICAgICAgICAvL2NyZWF0ZSBleGFtIGZvbGRlciBpbiB3b3JrZm9sZGVyXG4gICAgICAgICAgICAgICAgICAgIGxldCB1bmlxdWVleGFtTmFtZSA9IGAke3NlcnZlcm5hbWV9LSR7cGlufWBcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLmV4YW1kaXJlY3RvcnkgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHVuaXF1ZWV4YW1OYW1lKVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLnZlcnNpb24pe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29tcGFyZSB2ZXJzaW9ucyBhbmQgZGlzcGxheSBtZXNzYWdlICh0ZWFjaGVyIG5lZWRzIHVwZ3JhZGUuLiBjbGllbnQgbmVlZHMgdXBncmFkZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhcmlzb25SZXN1bHQgPSB0aGlzLmNvbXBhcmVTb2Z0d2FyZShjb25maWcudmVyc2lvbiwgY29uZmlnLmluZm8gLCBkYXRhLnZlcnNpb24sIGRhdGEudmVyc2lvbmluZm8gKSAvL3NlcnZlclZlcnNpb24sIHNlcnZlclN0YXR1cywgbG9jYWxWZXJzaW9uLCBsb2NhbFN0YXR1c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7ICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgbmV1ZXIgYWxzIGRpZSBkZXIgTGVocnBlcnNvbiFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkgeyAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCB6dSBhbHQuIExhZGVuIHNpZSBzaWNoIGVpbmUgYWt0dWVsbGUgVmVyc2lvbiBoZXJ1bnRlciFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVuYmVrYW5udGVyIEZlaGxlciBiZWltIFZlcmJpbmR1bmdzYXVmYmF1LlwiIH07ICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goYXN5bmMgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEZlaGxlcmJlaGFuZGx1bmdcbiAgICAgICAgICAgICAgICBsZXQgZXJyb3JNZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7IGVycm9yTWVzc2FnZSA9IFwiVGhlIHJlcXVlc3QgdGltZWQgb3V0XCI7ICAgfSAvLyBUaW1lb3V0LU5hY2hyaWNodCBhbnBhc3NlbiBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCByZWdpc3RlcjogJHtlcnJvck1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gb24gbWFjb3MgdGhlIHBlcm1pc3Npb24gc2V0dGluZ3MgaW4gcmFyZSBjYXNlcyBtZXNzIHVwIHRoZSBhYmlsaXR5IHRvIGZldGNoIHRoZSB0ZWFjaGVyIGFwaSBcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBmb3IgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIil7ICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgdGhpcy5jb25maWcuc2VydmVyQXBpUG9ydCk7IFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UgPT09IFwicmVzZXRcIikgeyAgIC8vIHF1aXQgdGhlIGFwcCBpZiB0aGUgdXNlciB3YW50cyB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzaG93IHdhcm5pbmcgbWVzc2FnZSBpZiB0aGUgdXNlciBkb2VzIG5vdCB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXMgZ2lidCBlaW4gUHJvYmxlbSBtaXQgZGVtIE5ldHp3ZXJrLCBkZW4gRmlyZXdhbGxyZWdlbG4gb2RlciBkZW4gTmV0endlcmtiZXJlY2h0aWd1bmdlbiEgQml0dGUgYmVoZWJlbiBzaWUgZGllc2VzIFByb2JsZW0gdW5kIHN0YXJ0ZW4gU2llIE5leHQtRXhhbSBuZXUhXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gR2VvZ2VicmEgYXMgZ2diIGZpbGUgLSBhcyBiYWNrdXAgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCwgY29udGVudDogYmFzZTY0IH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzYXZlR0dCJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXJncy5jb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IGFyZ3MucmVhc29uXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICBpZiAoY29udGVudCkgeyBcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHNhdmVHR0I6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IEJ1ZmZlci5mcm9tKGNvbnRlbnQsICdiYXNlNjQnKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZ2diRmlsZVBhdGgsIGZpbGVEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlc3RvcmVkXCIpICwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyKSAgXG4gICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlR0dCOiAke2Vycn1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogbG9hZCBjb250ZW50IGZyb20gZ2diIGZpbGUgYW5kIHNlbmQgaXQgdG8gdGhlIGZyb250ZW5kIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3QgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2xvYWRHR0InLCAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFJlYWQgdGhlIGZpbGUgYW5kIGNvbnZlcnQgaXQgdG8gYmFzZTY0XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZ2diRmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2U2NEdnYkZpbGUgPSBmaWxlRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OmJhc2U2NEdnYkZpbGUsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfSAgICAgXG4gICAgICAgIH0pXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogR0VUIFBERiBvciBJTUFHRSBmcm9tIEVYQU0gZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0cGRmYXN5bmMnLCAoZXZlbnQsIGZpbGVuYW1lLCBpbWFnZSA9IGZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoaW1hZ2UpeyByZXR1cm4gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7ICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH0gICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJldHVybnMgYmFzZTY0IHN0cmluZyBvZiBhdWRpb2ZpbGUgZnJvbSB3b3JrZGlyZWN0b3J5IG9yIHB1YmxpYyBkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRBdWRpb0ZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBwdWJsaWNkaXI9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKTtcbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgIXB1YmxpY2RpcikgeyAvLyBSZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3JcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpciwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmIHB1YmxpY2Rpcikge1xuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vLi4vcHVibGljXCIsZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiBcblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEZJTEUtTElTVCBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRmaWxlc2FzeW5jJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgYXVkaW89ZmFsc2UsIGRvY3g9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG5cbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlJlY2VpdmVkIGFyZ3VtZW50czpcIiwgZmlsZW5hbWUsIGF1ZGlvLCBkb2N4KTtcblxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuXG4gICAgICAgICAgICAgICAgaWYgKGF1ZGlvID09IHRydWUpeyAvLyBhdWRpbyBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkb2N4KXsgIC8vb2ZmaWNlIG9wZW4geG1sIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IG1hbW1vdGguY29udmVydFRvSHRtbCh7cGF0aDogZmlsZXBhdGh9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7ICAgLy9iYWsgZmlsZVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIC8vIHJldHVybiBmaWxlIGxpc3Qgb2YgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2RpcikpeyBmcy5ta2RpclN5bmMod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7ICB9IC8vZG8gbm90IGNyYXNoIGlmIHRoZSBkaXJlY3RvcnkgaXMgZGVsZXRlZCBhZnRlciB0aGUgYXBwIGlzIHN0YXJ0ZWQgXl5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVsaXN0ID0gIGZzLnJlYWRkaXJTeW5jKHdvcmtkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgIGZpbGVsaXN0LmZvckVhY2goIGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZGlmaWVkID0gZnMuc3RhdFN5bmMoICAgcGF0aC5qb2luKHdvcmtkaXIsZmlsZSkgICkubXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2QgPSBtb2RpZmllZC5nZXRUaW1lKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBkZlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwicGRmXCIsIG1vZDogbW9kfSkgICB9ICAgICAgICAgLy9wZGZcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuYmFrXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJiYWtcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGJhY2t1cCBmaWxlIHRvIHJlcGxhY2UgZWRpdG9yIGNvbnRlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZG9jeFwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZG9jeFwiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgY29udGVudCBmaWxlIChmcm9tIHRlYWNoZXIpIHRvIHJlcGxhY2UgY29udGVudCBhbmQgY29udGludWUgd3JpdGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5nZ2JcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImdnYlwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gZ2VvZ2VicmFcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIubXAzXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm9nZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi53YXZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJhdWRpb1wiLCBtb2Q6IG1vZH0pICAgfSAgLy8gYXVkaW9cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuanBnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBuZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5naWZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJpbWFnZVwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBCQUNLVVAgRklMRSBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGZpbGVuYW1lIHdpdGhvdXRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0YmFja3VwZmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogUmVxdWVzdCByZWNlaXZlZCBmb3IgZmlsZW5hbWU6ICR7ZmlsZW5hbWV9YClcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBGdWxsIGZpbGUgcGF0aDogJHtmaWxlcGF0aH1gKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlcGF0aCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBub3QgZm91bmQ6ICR7ZmlsZXBhdGh9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgZXhpc3RzLCByZWFkaW5nIGNvbnRlbnRgKVxuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFN1Y2Nlc3NmdWxseSByZWFkIGJhY2t1cCBmaWxlLCBjb250ZW50IGxlbmd0aDogJHtkYXRhLmxlbmd0aH1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHJlYWRpbmcgYmFja3VwIGZpbGU6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3Igc3RhY2s6ICR7ZXJyLnN0YWNrfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogbm8gZmlsZW5hbWUgcHJvdmlkZWRgKTsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGlwY01haW4ub24oJ3JlbG9hZC11cmwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVFYXN0ZXJXaW4oKVxuICAgICAgICB9KTtcblxuICAgICAgICAgLyoqXG4gICAgICAgICAqIEFwcGVuZCBQcmludFJlcXVlc3QgdG8gY2xpZW50aW5mbyAgXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc2VuZFByaW50UmVxdWVzdCcsIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSB0cnVlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlwY01haW4ub24oJ2dldC1jcHUtaW5mbycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmlzVmlydHVhbE1hY2hpbmUoKVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldC13bGFuLWluZm8nLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdsYW5JbmZvID0gYXdhaXQgZ2V0V2xhbkluZm8oKTtcbiAgICAgICAgICAgIHJldHVybiB3bGFuSW5mbztcbiAgICAgICAgfSk7XG5cblxuICAgICAgICBcbiAgICAgICAgLy8gTmV3IGhhbmRsZXIgdG8gZ2V0IFBERiBmcm9tIHB1YmxpYyBkaXJlY3RvcnkgZm9yIGZyb250ZW5kIHBhcnNpbmdcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBkZkZyb21QdWJsaWMnLCBhc3luYyAoZXZlbnQsIHBkZkZpbGVuYW1lICkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgZGlyZWN0b3J5IG5hbWUgaW4gRVNNXG4gICAgICAgICAgICAgICAgY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgcGRmUGF0aDtcbiAgICAgICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRnJvbSBzY3JpcHRzLyBnbyB1cCAzIGxldmVscyB0byByZWFjaCBzdHVkZW50LyB0aGVuIHB1YmxpYy9cbiAgICAgICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwZGZQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IFBERiBub3QgZm91bmQgYXQ6ICR7cGRmUGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYyhwZGZQYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cbiAgICB9XG5cbiAgICBpc1ZpcnR1YWxNYWNoaW5lKCkge1xuICAgICAgICBjb25zdCBWRU5ET1JTID0gLyhvcmFjbGV8dmlydHVhbGJveHx2bXdhcmV8a3ZtfHFlbXV8eGVufGlubm90ZWt8cGFyYWxsZWxzfG1pY3Jvc29mdHxoeXBlci12fGJoeXZlfHJlZCBoYXR8cmVkaGF0fGJvY2hzfGJoeXZlfG9wZW5zdGFja3xjbG91ZHxhbWF6b258Z29vZ2xlfGF6dXJlKS9pIC8vIGNvbW1vbiBWTSBpZHNcbiAgICAgICAgY29uc3Qgd2FybkFuZFJldHVybiA9IHJlYXNvbiA9PiB7XG4gICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGlzVmlydHVhbE1hY2hpbmU6IFZlcmRhY2h0IGF1ZiBWTSAtICR7cmVhc29ufWApXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBMaW51eCAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNwdWluZm8gPSByZWFkRmlsZVN5bmMoJy9wcm9jL2NwdWluZm8nLCAndXRmOCcpICAgICAgLy8gQ1BVIGZsYWdzXG4gICAgICAgICAgICBpZiAoL15mbGFncy4qXFxiaHlwZXJ2aXNvclxcYi9tLnRlc3QoY3B1aW5mbykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdoeXBlcnZpc29yIGZsYWcgaW4gL3Byb2MvY3B1aW5mbycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gW1xuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvc3lzX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X25hbWUnLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF92ZXJzaW9uJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2JvYXJkX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9iaW9zX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9jaGFzc2lzX3ZlbmRvcidcbiAgICAgICAgICAgIF1cbiAgICAgICAgICAgIGNvbnN0IGRtaSA9IGZpbGVzLm1hcChwID0+IHsgdHJ5IHsgcmV0dXJuIHJlYWRGaWxlU3luYyhwLCAndXRmOCcpIH0gY2F0Y2ggeyByZXR1cm4gJycgfSB9KS5qb2luKCcgJylcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoZG1pKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ0RNSS1WZW5kb3ItTWF0Y2gnKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBleGVjU3luYygnc3lzdGVtZC1kZXRlY3QtdmlydCAtcScsIHsgc3RkaW86ICdpZ25vcmUnIH0pICAgIC8vIGV4aXQgMCA9PiBWTVxuICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgbWVsZGV0IFZpcnR1YWxpc2llcnVuZycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuXG5cbiAgICAgICAgICAvLyBQclx1MDBGQ2ZlIGF1ZiBRRU1VLVByb3plc3NlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID0gZXhlY1N5bmMoJ3BzIGF1eCB8IGdyZXAgLWkgcWVtdScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKHBzLmluY2x1ZGVzKCdxZW11JykgJiYgIXBzLmluY2x1ZGVzKCdncmVwJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyBsXHUwMEU0dWZ0JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIFdpbmRvd3MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiKEdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbSB8IEZvckVhY2gtT2JqZWN0IHsgJF8uTWFudWZhY3R1cmVyLCAkXy5Nb2RlbCB9KSAtam9pbiBcXCcgXFwnXCInXG4gICAgICAgICAgICBjb25zdCBiYXNpYyA9IGV4ZWNTeW5jKHBzLCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpICAgIC8vIG1hbnVmYWN0dXJlciArIG1vZGVsXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGJhc2ljKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9Nb2RlbGwgcGFzc3QgenUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHNSb2J1c3QgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkbz1AKCk7JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtOyRvKz1AKCRjcy5NYW51ZmFjdHVyZXIsJGNzLk1vZGVsKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJiPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CYXNlQm9hcmQ7JG8rPUAoJGJiLk1hbnVmYWN0dXJlciwkYmIuUHJvZHVjdCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiaW9zPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CSU9TOyRvKz1AKCRiaW9zLlNNQklPU0JJT1NWZXJzaW9uKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzcD1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW1Qcm9kdWN0OyRvKz1AKCRjc3AuTmFtZSl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAnV3JpdGUtT3V0cHV0ICgoJG8gLWpvaW4gXFwnIFxcJykuVHJpbSgpKVwiJ1xuICAgICAgICAgICAgY29uc3Qgcm9idXN0ID0gZXhlY1N5bmMocHNSb2J1c3QsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKClcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qocm9idXN0KSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9CSU9TLUluZm9zIHBhc3NlbiB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIC8vIFp1c1x1MDBFNHR6bGljaGUgUUVNVS1Fcmtlbm51bmcgZlx1MDBGQ3IgV2luZG93c1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBxZW11UHJvY2Vzc2VzID0gZXhlY1N5bmMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBxZW11KlwiJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICAgICAgaWYgKHFlbXVQcm9jZXNzZXMuaW5jbHVkZXMoJ3FlbXUnKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyB1bnRlciBXaW5kb3dzJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG5cbiAgICAgICAgIC8vIC0tLS0tLS0tLS0gbWFjT1MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBod01vZGVsID0gZXhlY1N5bmMoJ3N5c2N0bCAtbiBody5tb2RlbCcsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKC9edmlydHVhbC9pLnRlc3QoaHdNb2RlbCkgfHwgVkVORE9SUy50ZXN0KGh3TW9kZWwpKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1MgSGFyZHdhcmVtb2RlbGwgZGV1dGV0IGF1ZiBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IGV4ZWNTeW5jKCdzeXN0ZW1fcHJvZmlsZXIgU1BIYXJkd2FyZURhdGFUeXBlJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHNwKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIHN5c3RlbV9wcm9maWxlciBtZWxkZXQgVk0tVmVuZG9yJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAgICBcbiAgICB9XG5cbiAgICBjb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKSB7XG4gICAgICAgIGNvbnN0IHBhcnRzQSA9IHZlcnNpb25BLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgICAgIGNvbnN0IHBhcnRzQiA9IHZlcnNpb25CLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5tYXgocGFydHNBLmxlbmd0aCwgcGFydHNCLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbnVtQSA9IHBhcnRzQVtpXSB8fCAwOyAvLyBGYWxsYmFjayBhdWYgMCwgZmFsbHMga2VpbiBXZXJ0IHZvcmhhbmRlblxuICAgICAgICAgICAgY29uc3QgbnVtQiA9IHBhcnRzQltpXSB8fCAwO1xuICAgIFxuICAgICAgICAgICAgaWYgKG51bUEgPCBudW1CKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAobnVtQSA+IG51bUIpIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBcbiAgICBjb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCBudW1iZXJBID0gcGFyc2VJbnQoc3RhdHVzQS5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICAgICAgY29uc3QgbnVtYmVyQiA9IHBhcnNlSW50KHN0YXR1c0IubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgXG4gICAgICAgIGlmIChudW1iZXJBIDwgbnVtYmVyQikgcmV0dXJuIC0xO1xuICAgICAgICBpZiAobnVtYmVyQSA+IG51bWJlckIpIHJldHVybiAxO1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBjb21wYXJlU29mdHdhcmUodmVyc2lvbkEsIHN0YXR1c0EsIHZlcnNpb25CLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IHZlcnNpb25Db21wYXJpc29uID0gdGhpcy5jb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKTtcbiAgICAgICAgaWYgKHZlcnNpb25Db21wYXJpc29uICE9PSAwKSByZXR1cm4gdmVyc2lvbkNvbXBhcmlzb247XG4gICAgXG4gICAgICAgIHJldHVybiB0aGlzLmNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKTtcbiAgICB9XG5cblxufVxuIFxuZXhwb3J0IGRlZmF1bHQgbmV3IElwY0hhbmRsZXIoKVxuIiwgImltcG9ydCB7Y3JlYXRlSTE4bn0gZnJvbSAndnVlLWkxOG4nXG5cbmltcG9ydCBlbiBmcm9tICcuL2VuLmpzb24nXG5pbXBvcnQgZGUgZnJvbSAnLi9kZS5qc29uJ1xuXG5jb25zdCBpMThuID0gY3JlYXRlSTE4bih7XG4gICAgbG9jYWxlOiAnZGUnLFxuICAgIGZhbGxiYWNrTG9jYWxlOiAnZW4nLFxuICAgIG1lc3NhZ2VzOiB7XG4gICAgICAgIGVuLFxuICAgICAgICBkZVxuICAgICAgfVxuICB9KVxuXG5leHBvcnQgZGVmYXVsdCBpMThuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIlJlc3RvcmVcIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIkRpc2Nvbm5lY3RcIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkV4aXRcIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJFeGFtc1wiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiVXNlcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlciBhZGRyZXNzXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIkV4YW0gTmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiYWR2YW5jZWRcIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJzaW1wbGVcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwicmVnaXN0ZXJcIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcInJlZ2lzdGVyaW5nLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcInJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJjb25uZWN0ZWRcIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJkaXNjb25uZWN0ZWRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIG9uIHNlcnZlciEgXFxuXFxuUGxlYXNlIHdhaXQgZm9yIHRoZSBhY3RpdmF0aW9uIG9mIHRoZSBleGFtIG1vZGUgYnkgdGhlIHRlYWNoZXIhXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcInNlYXJjaCBzdGFydGVkXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIndyb25nIHVzZXJuYW1lIG9yIHBpblwiLFxuICAgICAgICBcIm5vdXNlclwiOlwibm8gdXNlcm5hbWUgZ2l2ZW5cIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRkcmVzc2Ugb2RlciBFeGFtbmFtZSBtaXNzaW5nXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIk5vIE5ldHdvcmsgQ29ubmVjdGlvblwiLFxuICAgICAgICBcIm5vcGluXCI6IFwibm8gcGluY29kZSBnaXZlblwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6XCJTZXJ2ZXIgQVBJIHVucmVhY2hhYmxlXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGlzIGJlaGluZCBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIk5vIFRlYWNoZXIgQVBJIGZvdW5kIG9uIHRoZSBnaXZlbiBhZGRyZXNzXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9jYWwgbG9ja2Rvd25cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVhbCBzZWFyY2hcIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJObyBleGFtcyBmb3VuZFwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGxvZ291dD9cIixcbiAgICAgICAgXCJkZVwiOiBcIkdlcm1hblwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJlbmNoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpYW5cIixcbiAgICAgICAgXCJzbFwiOlwiU2xvdmVuaWFuXCIsXG4gICAgICAgIFwibm9uZVwiOiBcIm5vbmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiU3BlbGxjaGVja1wiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWN0aXZhdGVcIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJTaG93IHN1Z2dlc3Rpb25zXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIlBsZWFzZSBjaG9vc2UgYSBsYW5ndWFnZVwiLFxuICAgICAgICBcImxhbmdcIjogXCJMYW5ndWFnZXNcIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpY3NcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlNlbGVjdCBleGFtIG1vZGVcIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJQbGVhc2UgaW5zdGFsbCB0aGUgc2FtZSB2ZXJzaW9uIGFzIHRoZSBleGFtIHNlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJzYWZlIGV4YW0gc3RhdHVzIGNoYW5nZWRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgYWxyZWFkeSByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcInN0YXJ0ZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwic3RvcHBlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcInNhZmUgZXhhbSBtb2RlIG5vdCBhY3RpdmVcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcInN0dWRlbnQgcmVtb3ZlZCBmcm9tIHNlcnZlclwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcImZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcImZpbGVzIHN0b3JlZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiZmlsZSBlcnJvclwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJwbGVhc2UgY2hlY2sgaWYgdGhlICdFWEFNLVNUVURFTlQnIGRpcmVjdG9yeSBpcyB3cml0ZWFibGUgYW5kIGhhcyBlbm91Z2ggc3BhY2VcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkEgbG9jYWwgYmFja3VwIGNvdWxkIG5vdCBiZSBjcmVhdGVkLiBQbGVhc2UgdXNlIHRoZSBtYW51YWwgc3VibWlzc2lvbiBvcHRpb24uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJkb24ndCBzaG93IGFnYWluXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBmb3VuZFwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIkdldCBtYXRlcmlhbHNcIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiU2VuZCBmaW5hbCBleGFtXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJGaW5hbCBzdWJtaXRcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbHM6XCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxvY2FsIGZpbGVzOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIlVwZGF0ZVwiLFxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwbGl0dmlld1wiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIllvdSBoYXZlIGxlZnQgdGhlIHNhZmUgZXhhbSBtb2RlIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiUGxlYXNlIGluZm9ybSBhIHRlYWNoZXIhXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiRG8geW91IHdhbnQgdG8gcmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGUgZWRpdG9yIHdpdGggdGhlIGNvbnRlbnQgb2YgXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQ2FuY2VsXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiUmVwbGFjZVwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwIGZpbGUgY291bGQgbm90IGJlIHJlYWRcIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgc3VjY2Vzc2Z1bGx5IGxvYWRlZFwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRXJyb3IgbG9hZGluZyBiYWNrdXAgZmlsZVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiU3VjY2Vzc1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiY2hhcnNcIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIndvcmRzXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwicmVjb25uZWN0XCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwidW5sb2NrXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkV4aXQgc2FmZSBleGFtIG1vZGU/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiRG8gbm90IGxlYXZlIHNhZmUgZXhhbSBtb2RlIHdpdGhvdXQgcGVybWlzc2lvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiSWYgdGhpcyBwcm9jZXNzIGZhaWxzIHVubG9jayBhbmQgdHJ5IGFnYWluIVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiQ3JlYXRpbmcgYmFja3VwXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiQ3JlYXRpbmcgYmFja3VwIGFuZCBjbGlwYm9hcmQgY29weVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJMZWF2aW5nIEV4YW0gbW9kZVwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcImJhY2t1cFwiLFxuICAgICAgICBcInVuZG9cIjpcInVuZG9cIixcbiAgICAgICAgXCJyZWRvXCI6XCJyZWRvXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImNsZWFyXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiYm9sZFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwiaXRhbGljXCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bmRlcmxpbmVcIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiaGVhZGluZzFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiaGVhZGluZzJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiaGVhZGluZzNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiaGVhZGluZzRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiaGVhZGluZzVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiaGVhZGluZzZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInN1YnNjcmlwdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJzdXBlcnNjcmlwdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcImJ1bGxldGxpc3RcIixcbiAgICAgICAgXCJsaXN0XCI6XCJsaXN0XCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJjb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJjb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiYmxvY2txdW90ZVwiLFxuICAgICAgICBcImxpbmVcIjpcInBhZ2VicmVha1wiLFxuICAgICAgICBcImxlZnRcIjpcImxlZnRcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcImNlbnRlclwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJyaWdodFwiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwidGV4dGNvbG9yXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJsaW5lYnJlYWtcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtb3JlXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcImluc2VydHRhYmxlXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcImRlbGV0ZXRhYmxlXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcImNvbHVtbmFmdGVyXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcInJvd2FmdGVyXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJkZWxjb2x1bW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcImRlbHJvd1wiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwibWVyZ2VvcnNwbGl0XCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJoZWFkZXJjb2x1bW5cIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcImhlYWRlcnJvd1wiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJzZWxlY3RlZCB3b3Jkcy9jaGFyc1wiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJwcmludCByZXF1ZXN0IHNlbnRcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJwcmludCByZXF1ZXN0IGRlbmllZFwiLFxuICAgICAgICBcInBhc3RlXCI6XCJwYXN0ZVwiLFxuICAgICAgICBcImNvcHlcIjpcImNvcHlcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwic3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiZGVhY3RpdmF0ZSBzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiUmVsb2FkXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvdWxkIHlvdSBsaWtlIHRvIHJlaW5pdGlhbGl6ZSB0aGUgRWRpdG9yP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJrZWVwIGNvbnRlbnRcIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiSW5zZXJ0IHNwZWNpYWxjaGFyYWN0ZXJcIixcbiAgICAgICAgXCJwcmludFwiOiBcInByaW50XCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJQbGF5IEF1ZGlvXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiRG8geW91IHdhbnQgdG8gcGxheSB0aGUgYXVkaW9maWxlP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJSZW1haW5pbmcgcGxheWJhY2tzOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiWW91IGRvbid0IGhhdmUgdGhlIHBlcm1pc3Npb24gdG8gcGxheSB0aGlzIGZpbGUhXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJJbnNlcnQgSW1hZ2VcIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIkluc2VydCBNdWdzaG90XCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiU2VuZCB3b3JrIHRvIHRlYWNoZXJcIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJDbG9zZVwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkV4aXQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkZpbGVuYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiUGxlYXNlIGVudGVyIG9ubHkgbGV0dGVycyBhbmQgbnVtYmVycyB3aXRob3V0IHNwZWNpYWwgY2hhcmFjdGVyc1wiLFxuICAgICAgICBcImNsZWFyXCI6IFwiY2xlYXIgY29udGVudD9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIk5vIHZhbGlkIFBERiBGaWxlXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIldyb25nIHBhc3N3b3JkXCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIlJlbG9hZCB3ZWJ2aWV3XCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJQb3NzaWJseSBzY2FubmVkIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJPblwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwibGVzcyB0aGFuIDIgaW50ZXJhY3RpdmUgZm9ybSBmaWVsZHMgd2VyZSBmb3VuZC5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJUaGlzIGluZGljYXRlcyB0aGF0IHRoaXMgaXMgYSBzY2FubmVkIFBERiB0aGF0IGRvZXMgbm90IGNvbnRhaW4gYWN0aXZlIGZvcm0gZmllbGRzIG9yIHRhYmxlcy5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVW5kZXJzdG9vZFwiLFxuICAgICAgICBcInBhZ2VcIjogXCJQYWdlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJQYWdlc1wiXG4gICAgfVxufVxuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIldpZWRlcmhlcnN0ZWxsZW5cIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIlZlcmJpbmR1bmcgdHJlbm5lblwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiQmVlbmRlblwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcnRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIlByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJCZW51dHplcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlci1BZHJlc3NlXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIlByXHUwMEZDZnVuZ3NuYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJmb3J0Z2VzY2hyaXR0ZW5cIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJlaW5mYWNoXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcImFubWVsZGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJtZWxkZSBhbi4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiVmVyYmluZHVuZyB1bnRlcmJyb2NoZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlNpZSBoYWJlbiBzaWNoIGVyZm9sZ3JlaWNoIGFtIFNlcnZlciByZWdpc3RyaWVydCEgXFxuXFxuQml0dGUgd2FydGVuIFNpZSBhdWYgZGllIEFrdGl2aWVydW5nIGRlcyBQclx1MDBGQ2Z1bmdzbW9kdXMgZHVyY2ggZGllIExlaHJwZXJzb24hXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcIlN1Y2hlIGdlc3RhcnRldFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJGYWxzY2hlciBCZW51dHplcm5hbWUgb2RlciBQaW5jb2RlXCIsXG4gICAgICAgIFwibm91c2VyXCI6IFwiQmVudXR6ZXJuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkcmVzc2Ugb2RlciBQclx1MDBGQ2Z1bmdzbmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJLZWluZSBOZXR6d2Vya3ZlcmJpbmR1bmdcIixcbiAgICAgICAgXCJub3BpblwiOiBcIlBpbmNvZGUgZmVobHRcIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOiBcIlNlcnZlciBBUEkgbmljaHQgZXJyZWljaGJhci5cIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgYmVmaW5kZXQgc2ljaCBtXHUwMEY2Z2xpY2hlcndlaXNlIGhpbnRlciBlaW5lciBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIktlaW5lIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgYW4gYW5nZWdlYmVuZXIgQWRyZXNzZVwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxva2FsIGFic3BlcnJlblwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWVsbCBzdWNoZW5cIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJLZWluZSBQclx1MDBGQ2Z1bmdlbiBnZWZ1bmRlblwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBzaWNoIGFibWVsZGVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJkZVwiOiBcIkRldXRzY2hcIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzY2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzY2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJhbnpcdTAwRjZzaXNjaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWVuaXNjaFwiLFxuICAgICAgICBcInNsXCI6XCJTbG93ZW5pc2NoXCIsXG4gICAgICAgIFwibm9uZVwiOiBcImFuZGVyZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJoaWxmZVwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWt0aXZpZXJlblwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlZvcnNjaGxcdTAwRTRnZSB6ZWlnZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgU3ByYWNoZSBmXHUwMEZDciBkaWUgUHJcdTAwRkNmdW5nXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIlNwcmFjaGVuXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWtcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlByXHUwMEZDZnVuZ3Ntb2R1cyBhdXN3XHUwMEU0aGxlblwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIkJpdHRlIGluc3RhbGxpZXJlbiBzaWUgZGllIHNlbGJlIFZlcnNpb24gd2llIGFtIFByXHUwMEZDZnVuZ3NzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IGdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgZ2VcdTAwRTRuZGVydFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIHVudGVyIGRpZXNlbSBOYW1lbiBiZXJlaXRzIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBuaWNodCBha3RpdlwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGVudGZlcm50XCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcIkRhdGVpZW4gZXJoYWx0ZW5cIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiRGF0ZWllbiBnZXNwZWljaGVydFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcIkZlaGxlciBiZWltIFNjaHJlaWJlbiBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwiQml0dGUgc3RlbGxlbiBTaWUgc2ljaGVyLCBkYXNzIGRhcyAnRVhBTS1TVFVERU5UJyBWZXJ6ZWljaG5pcyBmXHUwMEZDciBOZXh0LUV4YW0gc2NocmVpYmJhciBpc3QgdW5kIGdlblx1MDBGQ2dlbmQgU3BlaWNoZXJwbGF0eiB2b3JoYW5kZW4gaXN0LlwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiRWluZSBsb2thbGUgU2ljaGVydW5nIGtvbm50ZSBuaWNodCBlcnN0ZWxsdCB3ZXJkZW4uIE51dHplbiBTaWUgZGllIG1hbnVlbGxlIEFiZ2FiZSB1bSBJaHJlIEFyYmVpdCBkaXJla3QgYW4gZGllIExlaHJwZXJzb24genUgc2VuZGVuLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiTmljaHQgbWVociBhbnplaWdlblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZ2VmdW5kZW5cIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbiBob2xlblwiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJGaW5hbGUgQWJnYWJlIGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJBYmdhYmVcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbjpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJBa3R1YWxpc2llcmVuXCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxva2FsZSBEYXRlaWVuOlwiLFxuXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BhbHRlbmFuc2ljaHRcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJTaWUgaGFiZW4gZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdmVybGFzc2VuIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiTWVsZGVuIFNpZSBzaWNoIHVtZ2VoZW5kIGJlaSBkZXIgQXVmc2ljaHRzcGVyc29uIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIldvbGxlbiBTaWUgZGVuIEluaGFsdCBkZXMgRWRpdG9ycyBkdXJjaCBkZW4gSW5oYWx0IGRlciBEYXRlaVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcImVyc2V0emVuP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQWJicmVjaGVuXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiRXJzZXR6ZW5cIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cC1EYXRlaSBrb25udGUgbmljaHQgZ2VsZXNlbiB3ZXJkZW5cIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgZXJmb2xncmVpY2ggZ2VsYWRlblwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRmVobGVyIGJlaW0gTGFkZW4gZGVyIEJhY2t1cC1EYXRlaVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIkVyZm9sZ1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiWmVpY2hlblwiLFxuICAgICAgICBcIndvcmRzXCI6IFwiV1x1MDBGNnJ0ZXJcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJuZXUgdmVyYmluZGVuXCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwiZW50c3BlcnJlblwiLFxuICAgICAgICBcImV4aXRcIjogXCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiVmVybGFzc2VuIFNpZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyBuaWUgb2huZSBGcmVpZ2FiZSBlaW5lciBMZWhycGVyc29uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJTb2xsdGUgZGVyIFZvcmdhbmcgZmVobHNjaGxhZ2VuIGJlZW5kZW4gU2llIGJpdHRlIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHVuZCB2ZXJzdWNoZW4gU2llIGVzIGVybmV1dCFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIklocmUgQXJiZWl0IHd1cmRlIGVyZm9sZ3JlaWNoIGdlc2ljaGVydCFcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJEaWUgYWt0dWVsbGUgQXJiZWl0IHdpcmQgZ2VzaWNoZXJ0IHVuZCBpbiBkaWUgWndpc2NoZW5hYmxhZ2Uga29waWVydCFcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwic2ljaGVyblwiLFxuICAgICAgICBcInVuZG9cIjpcInJcdTAwRkNja2dcdTAwRTRuZ2lnXCIsXG4gICAgICAgIFwicmVkb1wiOlwid2llZGVyaG9sZW5cIixcbiAgICAgICAgXCJjbGVhclwiOlwibFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiZmV0dFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwia3Vyc2l2XCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bnRlcnN0cmljaGVuXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiXHUwMERDYmVyc2NocmlmdCAzXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiXHUwMERDYmVyc2NocmlmdCA2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJ0aWVmZ2VzdGVsbHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwiaG9jaGdlc3RlbGx0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwidW5nZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJsaXN0XCI6XCJnZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcIkNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcIkNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJaaXRhdFwiLFxuICAgICAgICBcImxpbmVcIjpcIlNlaXRlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJMaW5rc2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJaZW50cmllcnRcIixcbiAgICAgICAgXCJyaWdodFwiOlwiUmVjaHRzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcIlRleHRmYXJiZVwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwiWmVpbGVudW1icnVjaFwiLFxuICAgICAgICBcIm1vcmVcIjpcIm1laHJcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiVGFiZWxsZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcIlRhYmVsbGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcIlNwYWx0ZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcIlJlaWhlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcIlNwYWx0ZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcIlJlaWhlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwiVmVyZWluZW4gb2RlciBUZWlsZW5cIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcIlRpdGVsc3BhbHRlXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJUaXRlbHJlaWhlXCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcIldcdTAwRjZydGVyL1plaWNoZW4gaW4gQXVzd2FobFwiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJEcnVja2FuZnJhZ2UgZ2VzZW5kZXQhXCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwiRHJ1Y2thbmZyYWdlIGFiZ2VsZWhudC4gQml0dGUgd2FydGVuIHVuZCBlcm5ldXQgc2VuZGVuLlwiLFxuICAgICAgICBcInBhc3RlXCI6XCJlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiY29weVwiOlwia29waWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBkZWFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJOZXUgbGFkZW5cIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV29sbGVuIFNpZSBkZW4gVGV4dGVkaXRvciBuZXUgaW5pdGlhbGlzaWVyZW4/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcIkluaGFsdCBiZWliZWhhbHRlblwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJTb25kZXJ6ZWljaGVuIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJwcmludFwiOiBcImRydWNrZW5cIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIkF1ZGlvIGFic3BpZWxlblwiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIldvbGxlbiBTaWUgZGFzIEhcdTAwRjZyYmVpc3BpZWwgamV0enQgYWJzcGllbGVuP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJWZXJibGVpYmVuZGUgRHVyY2hsXHUwMEU0dWZlOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiU2llIGhhYmVuIGtlaW5lIEJlcmVjaHRpZ3VuZyBkaWUgQXVkaW9kYXRlaSBlcm5ldXQgYWJ6dXNwaWVsZW4hXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJCaWxkIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIk11Z3Nob3QgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIkFyYmVpdCBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIlNjaGxpZVx1MDBERmVuXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRGF0ZWluYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiQml0dGUgZ2ViZW4gU2llIG51ciBCdWNoc3RhYmVuIG9kZXIgWmFobGVuIGVpbi5cIixcbiAgICAgICAgXCJjbGVhclwiOiBcIkFsbGUgQmVyZWNobnVuZ2VuIGxcdTAwRjZzY2hlbj9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJLZWluZSBnXHUwMEZDbHRpZ2UgUERGIERhdGVpXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIkZhbHNjaGVzIFBhc3N3b3J0XCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIldlYnZpZXcgbmV1IGxhZGVuXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJNXHUwMEY2Z2xpY2hlcndlaXNlIGdlc2Nhbm50ZXMgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIkF1ZlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwid3VyZGVuIHdlbmlnZXIgYWxzIDIgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZ2VmdW5kZW4uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiRGllcyBkZXV0ZXQgZGFyYXVmIGhpbiwgZGFzcyBlcyBzaWNoIHVtIGVpbiBnZXNjYW5udGVzIFBERiBoYW5kZWx0LCBkYXMga2VpbmUgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciBvZGVyIFRhYmVsbGVuIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVmVyc3RhbmRlblwiLFxuICAgICAgICBcInBhZ2VcIjogXCJTZWl0ZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiU2VpdGVuXCJcbiAgICB9XG59XG4iLCAiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cblxubGV0IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpXG5pZiAoYXBwLmlzUGFja2FnZWQpIHsgbGFuZ3VhZ2VUb29sSmFyUGF0aCA9IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMvTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJykgfVxuXG5sZXQgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJylcbmlmIChhcHAuaXNQYWNrYWdlZCkgeyBsYW5ndWFnZVRvb2xDb25maWdQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYy9MYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKSB9XG5cblxuXG5cblxuY2xhc3MgTGFuZ3VhZ2VUb29sU2VydmVyIHtcbiAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBJbml0aWFsaXNpZXJ0IGRpZSBQcm96ZXNzdmFyaWFibGVcbiAgICAgICAgIHRoaXMucG9ydCA9IDgwODhcbiAgICAgfVxuIFxuICAgICBzdGFydFNlcnZlcigpIHtcbiAgICAgICAgIGlmICh0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgJiYgIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nLicpO1xuICAgICAgICAgICAgIHJldHVybjsgLy8gVmVyaGluZGVydCBkYXMgZXJuZXV0ZSBTdGFydGVuLCB3ZW5uIGRlciBTZXJ2ZXIgYmVyZWl0cyBsXHUwMEU0dWZ0XG4gICAgICAgICB9XG4gICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gSnJlSGFuZGxlci5qU3Bhd24oXG4gICAgICAgICAgICAgICAgW2xhbmd1YWdlVG9vbEphclBhdGhdLCAvLyBLbGFzc2VucGZhZFxuICAgICAgICAgICAgICAgICdvcmcubGFuZ3VhZ2V0b29sLnNlcnZlci5IVFRQU2VydmVyJywgLy8gSGF1cHRrbGFzc2UgZGVyIExhbmd1YWdlVG9vbCBBUElcbiAgICAgICAgICAgICAgICBbJy0tcG9ydCcsIHRoaXMucG9ydCwnLS1jb25maWcnLGxhbmd1YWdlVG9vbENvbmZpZ1BhdGgsICctLWFsbG93LW9yaWdpbicsIFwiJyonXCIgXSAvLyBadXNcdTAwRTR0emxpY2hlIEFyZ3VtZW50ZSwgei5CLiBQb3J0IHVuZCBDT1JTLUVybGF1Ym5pc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcylcbiAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIEFQSSBydW5uaW5nIGF0IGxvY2FsaG9zdDo4MDg4Jyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCBkYXRhID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhOiBSZWNlaXZlZCBkYXRhIGZyb20gTGFuZ3VhZ2VUb29sIEFQSScsIGRhdGEudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXJyb3InKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtZXJyb3I6Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdGFydGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY2hlY2sgZG9uZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFuZGxlZCByZXF1ZXN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIEFjY3VtdWxhdGUgc3RkZXJyIGRhdGEgdG8gaGFuZGxlIGNodW5rZWQgb3V0cHV0XG4gICAgICAgICAgICBsZXQgc3RkZXJyQnVmZmVyID0gJyc7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyICs9IGNodW5rO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcodGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBib3RoIGN1cnJlbnQgY2h1bmsgYW5kIGFjY3VtdWxhdGVkIGJ1ZmZlciBmb3IgcG9ydC1yZWxhdGVkIGVycm9yc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXNwb25zZSA9IHN0ZGVyckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcnRFcnJvciA9IGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhwb3J0U3RyKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRyZXNzZSB3aXJkIGJlcmVpdHMgdmVyd2VuZGV0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJNYXliZSBzb21ldGhpbmcgZWxzZSBpcyBydW5uaW5nIG9uIHRoYXQgcG9ydFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoaXNQb3J0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBhbm90aGVyIExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgcHJvYmFibHkgYWxyZWFkeSBydW5uaW5nIG9uIHBvcnQ6JywgdGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsuaW5jbHVkZXMoJ1xcbicpIHx8IGZ1bGxSZXNwb25zZS5sZW5ndGggPiAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIHdlIGhhdmUgYSBuZXdsaW5lIChsaWtlbHkgY29tcGxldGUgbWVzc2FnZSkgb3IgYnVmZmVyIGlzIGdldHRpbmcgbGFyZ2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhLWVycm9yOicsIGZ1bGxSZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBTZXR6dCBkZW4gUHJvemVzcyB6dXJcdTAwRkNjaywgd2VubiBlciBiZWVuZGV0IHdpcmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGdlbmVyYWwtZXJyb3I6JywgZXJyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgfVxuXG4gICAgIHN0b3BTZXJ2ZXIoKSB7XG4gICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcykge1xuICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkLCBub3RoaW5nIHRvIHN0b3AnKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZpcnN0IHRyeSB0byBraWxsIHRoZSBwcm9jZXNzIGRpcmVjdGx5IGlmIHdlIGhhdmUgYSByZWZlcmVuY2VcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mga2lsbGVkJyk7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGZhaWxlZCB0byBraWxsIHByb2Nlc3MgZGlyZWN0bHksIHRyeWluZyBwbGF0Zm9ybS1zcGVjaWZpYyBtZXRob2Q6JywgZXJyKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgcGxhdGZvcm0tc3BlY2lmaWMgY29tbWFuZHMgdG8ga2lsbCB0aGUgcHJvY2VzcyAob25seSBpZiB3ZSBoYWQgYSBwcm9jZXNzIHJlZmVyZW5jZSlcbiAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgIGxldCBjb21tYW5kO1xuXG4gICAgICAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAvLyBXaW5kb3dzOiBmaW5kIGFuZCBraWxsIGphdmEgcHJvY2Vzc2VzIHJ1bm5pbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgd21pYyAod29ya3Mgb24gb2xkZXIgV2luZG93cyksIHRoZW4gdHJ5IFBvd2VyU2hlbGwsIHRoZW4gZmFsbGJhY2sgdG8gcG9ydC1iYXNlZCBraWxsXG4gICAgICAgICAgICAgY29tbWFuZCA9IGB3bWljIHByb2Nlc3Mgd2hlcmUgXCJjb21tYW5kbGluZSBsaWtlICclbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIlJ1wiIGRlbGV0ZSAyPm51bCB8fCBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgamF2YSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7JF8uQ29tbWFuZExpbmUgLWxpa2UgJypsYW5ndWFnZXRvb2wtc2VydmVyLmphcionfSB8IFN0b3AtUHJvY2VzcyAtRm9yY2VcIiAyPm51bCB8fCBmb3IgL2YgXCJ0b2tlbnM9NVwiICVhIGluICgnbmV0c3RhdCAtYW5vIF58IGZpbmRzdHIgOjgwODgnKSBkbyB0YXNra2lsbCAvRiAvUElEICVhIDI+bnVsYDtcbiAgICAgICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8IHBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgICAgLy8gbWFjT1MgYW5kIExpbnV4OiB1c2UgcGtpbGwgdG8ga2lsbCBwcm9jZXNzZXMgbWF0Y2hpbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICBjb21tYW5kID0gJ3BraWxsIC1mIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJztcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IHVuc3VwcG9ydGVkIHBsYXRmb3JtOicsIHBsYXRmb3JtKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIGV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAvLyBJdCdzIG9rYXkgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGZvdW5kIChhbHJlYWR5IGtpbGxlZClcbiAgICAgICAgICAgICAgICAgLy8gcGtpbGwgcmV0dXJucyBjb2RlIDEgd2hlbiBubyBwcm9jZXNzIGlzIGZvdW5kLCB3aGljaCBpcyBleHBlY3RlZFxuICAgICAgICAgICAgICAgICBpZiAoZXJyb3IuY29kZSAhPT0gMSAmJiAhZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnbm90IGZvdW5kJykgJiYgIXN0ZGVyci50b1N0cmluZygpLmluY2x1ZGVzKCdObyBzdWNoIHByb2Nlc3MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGVycm9yIGtpbGxpbmcgTGFuZ3VhZ2VUb29sIHNlcnZlcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mgbm90IGZvdW5kIChtYXkgYWxyZWFkeSBiZSBzdG9wcGVkKScpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgc3RvcHBlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgIH0pO1xuICAgICB9XG4gfVxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTGFuZ3VhZ2VUb29sU2VydmVyKClcblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBwcm9jZXNzIGZyb20gJ3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4gLy8gZXZlcnkgcGxhdGZvcm0gbmVlZHMgaXQncyBvd24ganJlIChsaW51eCwgd2luMzIsIGRhcndpbikgLy9maXhtZTogdXNlIEdyYWFsVk0gdG8gcHJlY29tcGlsZSBsYW5ndWFnZXRvb2wgaW4gb3JkZXIgdG8gc2F2ZSBzcGFjZSBhbmQgZ2V0IHJpZCBvZiBqcmU/XG5jbGFzcyBKcmVIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7IH1cblxuICAgIGluaXQoKXsgXG4gICAgICAgIHRoaXMualRlc3QoKVxuICAgIH1cblxuXG4gICAgalRlc3QoKXtcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKTsgLy8gJy9wZmFkL3p1ci9qYXZhJ1xuICAgICAgICBjb25zdCBwcm9jID0gc3Bhd24oamF2YXBhdGgsIFsnLXZlcnNpb24nXSk7XG4gICAgXG4gICAgICAgIHByb2Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGRhdGEudG9TdHJpbmcoKS5zcGxpdCgnXFxuJyk7IC8vIGluIFplaWxlbiBzcGxpdHRlblxuICAgICAgICAgICAgbG9nLmRlYnVnKGBqcmUtaGFuZGxlciBAIGpUZXN0OiAke2xpbmVzWzBdfWApOyAvLyBudXIgZGllIGVyc3RlIFplaWxlIGxvZ2dlblxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZmFpbChyZWFzb24pIHtcbiAgICAgICAgbG9nLmVycm9yKHJlYXNvbik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBnZXREaXJlY3RvcmllcyhkaXJQYXRoKSB7XG4gICAgICAgIGxldCBkaXJzID0gZnMucmVhZGRpclN5bmMoZGlyUGF0aCkuZmlsdGVyKFxuICAgICAgICAgICAgZmlsZSA9PiBmcy5zdGF0U3luYyhwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZSkpLmlzRGlyZWN0b3J5KClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGRpcnNcbiAgICB9IFxuXG4gICAgZHJpdmVyKCl7XG4gICAgICAgIHZhciBkID0gcGxhdGZvcm1EaXNwYXRjaGVyLmphdmFCaW4uc2xpY2UoKTtcbiAgICAgICAgZC51bnNoaWZ0KHBsYXRmb3JtRGlzcGF0Y2hlci5qcmVEaXIpO1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luLmFwcGx5KHBhdGgsIGQpO1xuICAgIH1cblxuICAgIGdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKS5zbGljZSgpO1xuICAgICAgICBjbGFzc3BhdGggPSBjbGFzc3BhdGggfHwgW107XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc25hbWUpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NwYXRoLmpvaW4odGhpcy5fcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOicpKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KCctY3AnKTtcbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgalNwYXduKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIFxuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpXG4gICAgICAgIGxldCBqYXZhYXJncyA9IHRoaXMuZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncylcbiAgICAgICAgbGV0IGphdmFjbWRsaW5lID0gIGAke2phdmFwYXRofSAke2phdmFhcmdzLmpvaW4oJyAnKX0gYFxuXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogJyR7cGxhdGZvcm1EaXNwYXRjaGVyLmpyZX0nIHNlbGVjdGVkYClcbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiBzcGF3bmluZyBqYXZhIHByb2Nlc3M6ICR7amF2YWNtZGxpbmV9YClcbiAgICAgICAgcmV0dXJuIHNwYXduKGphdmFwYXRoLCBqYXZhYXJncywge3NoZWxsOmZhbHNlfSk7XG4gICAgICAgLy8gcmV0dXJuIHNwYXduKGphdmFjbWRsaW5lKTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IEpyZUhhbmRsZXIoKVxuIiwgIi8vIHNjcmlwdHMvU3lzdGVtVHJheU1hbmFnZXIuanNcbmltcG9ydCB7IGFwcCwgVHJheSwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJzsgXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJzsgLy8gUGF0aCBtb2R1bGUgaW1wb3J0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7IC8vIExvZ2dpbmcgbW9kdWxlXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnOyAvLyBXaW5kb3cgbWFuYWdlclxuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnOyAvLyBDb21tdW5pY2F0aW9uIGxvZ2ljXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJzsgLy8gSTE4biBpbnN0YW5jZVxuXG5cblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgLy8gR2V0IGN1cnJlbnQgZGlyZWN0b3J5XG5cbmxldCB0cmF5ID0gbnVsbDsgLy8gUHJpdmF0ZSB0cmF5IGluc3RhbmNlXG5cbi8vIFBhdGggdG8gdGhlIGFwcCBpY29uXG5jb25zdCBpY29uUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMnLCdpY29uMjR4MjQucG5nJyk7IFxuXG4vLyA9PT0gcmVwbGFjZSB0aGUgaGVscGVyIHNldExvY2FsZSAoZXhhY3QgYmxvY2spID09PVxuY29uc3Qgc2V0TG9jYWxlID0gKGxvYykgPT4ge1xuICAgIGNvbnN0IGdsID0gaTE4bi5nbG9iYWw7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZ2xvYmFsIGNvbXBvc2VyXG4gICAgaWYgKGdsICYmIHR5cGVvZiBnbC5sb2NhbGUgPT09ICdvYmplY3QnICYmIGdsLmxvY2FsZSkge1xuICAgICAgLy8gdnVlLWkxOG4gY29tcG9zaXRpb24gbW9kZVxuICAgICAgaWYgKCd2YWx1ZScgaW4gZ2wubG9jYWxlKSBnbC5sb2NhbGUudmFsdWUgPSBsb2M7ICAgICAvLyBzZXQgcmVhY3RpdmUgdmFsdWVcbiAgICAgIGVsc2UgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbGJhY2tcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbGVnYWN5IG1vZGUgb3IgcGxhaW4gc3RyaW5nXG4gICAgICBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbiBzdHJpbmcgbG9jYWxlXG4gICAgfVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gIFxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB0cmF5IGljb24gaWYgaXQgZG9lc24ndCBleGlzdCBhbmQgdXBkYXRlcyBpdHMgY29udGV4dCBtZW51LlxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBuZXcgbG9jYWxlIHRvIGFwcGx5LlxuICovXG5cblxuXG5leHBvcnQgY29uc3QgdXBkYXRlU3lzdGVtVHJheSA9IChsb2NhbGUpID0+IHtcbiAgICBzZXRMb2NhbGUobG9jYWxlKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IHQgPSAoaykgPT4gaTE4bi5nbG9iYWwudChrKTsgICAgICAgICAgICAgICAgICAgICAgLy8gYWx3YXlzIHJlc29sdmUgbGl2ZVxuICBcbiAgICBpZiAoIXRyYXkpIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0cmF5IG9uY2VcbiAgICAgIHRyYXkgPSBuZXcgVHJheShpY29uUGF0aCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0cmF5IGljb25cbiAgICAgIHRyYXkub24oJ2NsaWNrJywgKCkgPT4geyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2dsZSB3aW5kb3dcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpIFxuICAgICAgICAgID8gV2luZG93SGFuZGxlci5tYWlud2luZG93LmhpZGUoKSBcbiAgICAgICAgICA6IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIFxuICAgIC8vIGJ1aWxkIGNvbnRleHQgbWVudSB3aXRoIGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgY29udGV4dE1lbnUgPSBNZW51LmJ1aWxkRnJvbVRlbXBsYXRlKFtcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5yZXN0b3JlJyksIGNsaWNrOiAoKSA9PiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpIH0sIC8vIHNob3cgd2luZG93XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZGlzY29ubmVjdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cuaW5mbyhcIm1haW4gQCBzeXN0ZW10cmF5OiByZW1vdmluZyByZWdpc3RyYXRpb25cIik7IFxuICAgICAgICAgIENvbW1IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpOyBcbiAgICAgICAgfSBcbiAgICAgIH0sIC8vIGRpc2Nvbm5lY3RcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5leGl0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IENsb3NpbmcgTmV4dC1FeGFtXCIpOyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXCIpOyBcbiAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgXG4gICAgICAgICAgYXBwLnF1aXQoKTsgXG4gICAgICAgIH0gXG4gICAgICB9IC8vIGV4aXRcbiAgICBdKTtcbiAgXG4gICAgdHJheS5zZXRUb29sVGlwKCdOZXh0LUV4YW0gU3R1ZGVudCcpOyAgICAgICAgICAgICAgICAgICAvLyBzZXQgdG9vbHRpcFxuICAgIHRyYXkuc2V0Q29udGV4dE1lbnUoY29udGV4dE1lbnUpOyAgICAgICAgICAgICAgICAgICAgICAgLy8gYXBwbHkgbWVudVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gICIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBzY3JpcHQgaXMgdXNlZCB0byB0ZXN0IHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICogSXQgdXNlcyB0aGUgdGNjdXRpbCBjb21tYW5kIHRvIHRlc3QgYW5kIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICogSXQgcmV0dXJucyB0cnVlIGlmIHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIGFyZSBhbGxvd2VkIGFuZCBmYWxzZSBpZiB0aGV5IGFyZSBub3RcbiAqIFxuICogVGhpcyBjb3VsZCBhbHNvIGJlIHVzZWQgdG8gdGVzdCBvdGhlciBwZXJtaXNzaW9ucyBsaWtlIGFjY2Vzc2liaWxpdHksIHNjcmVlbiBjYXB0dXJlLCBldGMuIFxuICogc2VlIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGZvciBtb3JlIGRldGFpbHMgb24gaG93IHRvIHRlc3QgZm9yIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgKGl0cyBub3QgcG9zc2libGUgdG8gdGVzdCBmb3Igc2NyZWVuIGNhcHR1cmUgcGVybWlzc2lvbnMgb24gbWFjb3MgYmVjYXVzZSB3aXRob3V0IHBlcm1pc3Npb25zIGl0IHdpbGwgYWx3YXlzIHJldHVybiBhIGJsYW5rIHNjcmVlbnNob3QgLSB3ZSB1c2UgYSB3b3JrYXJvdW5kIHRvIGRldGVjdCB0aGlzKVxuICogXG4gKi9cblxuXG5cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBydW4gdGNjdXRpbFxuaW1wb3J0IHsgZGlhbG9nLCBhcHAgfSBmcm9tICdlbGVjdHJvbicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2hvdyBkaWFsb2cgYW5kIHF1aXRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuXG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAgICAgICAgICAgICAgICAvLyByZXR1cm5zIHRydWUgaWYgZmV0Y2ggd29ya3NcbiAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHtzZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wb25nYCwgeyBtZXRob2Q6ICdHRVQnLCBjYWNoZTogJ25vLXN0b3JlJyB9KSAvLyB0ZXN0IHJlcXVlc3RcbiAgICAgICAgICAgIHJldHVybiByZXMub2tcbiAgICB9IGNhdGNoIHsgIHJldHVybiBmYWxzZSB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNldFRDQygpIHsgICAgICAvLyByZXNldCBUQ0MgcGVybWlzc2lvbnNcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvL2FwcElkXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS5zdHVkZW50YCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcbiAgICAgICAgLy9hcHBCdW5kbGVJZCAoc2V0IHZpYSBub3Rhcml6ZSlcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLXN0dWRlbnQuYXBwYCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcblxuXG4gICAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7IC8vIGNoZWNrIG9yIHJlc2V0XG4gICAgY29uc3Qgb2sgPSBhd2FpdCB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpXG4gICAgaWYgKG9rKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5ldHdvcmsgYWNjZXNzIGlzIGFsbG93ZWRgKTtcbiAgICAgICAgICAgIHJldHVybiBcIm9rXCI7XG4gICAgfVxuICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTm8gSFRUUCByZXF1ZXN0cyBhbGxvd2VkIWAgKVxuXG4gICAgdHJ5IHtcblxuICAgICAgICAvLyBhc2sgdGhlIHVzZXJzIGlmIHRoZXkgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnMgYW5kIGV4aXQgdGhlIGFwcCBpZiB0aGV5IGRvXG4gICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEZXIgU2VydmVyIGlzdCBuaWNodCBlcnJlaWNoYmFyLiBNXHUwMEY2Y2h0ZW4gU2llIGRpZSBCZXJlY2h0aWd1bmdlbiB6dXJcdTAwRkNja3NldHplbiB1bmQgTmV4dC1FeGFtIG1hbnVlbGwgbmV1IHN0YXJ0ZW4/JyxcbiAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snLCAnQWJicmVjaGVuJ10sXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChjaG9pY2UucmVzcG9uc2UgPT09IDApIHsgICAgLy8gcmVzZXQgcGVybWlzc2lvbnMgYW5kIHJldHVybiB0cnVlIHRvIHF1aXQgdGhlIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBSZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9ucyBhbmQgcXVpdHRpbmcgYXBwYCk7XG4gICAgICAgICAgICBhd2FpdCByZXNldFRDQygpOyBcbiAgICAgICAgICAgIHJldHVybiBcInJlc2V0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlIFxuICAgICAgICB9ICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gXG4gICAgfSBcbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBsb2cuZXJyb3IoYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBFcnJvciByZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9uczogJHtlfWApO1xuICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdGZWhsZXIgYmVpbSBadXJcdTAwRkNja3NldHplbiBkZXIgQmVyZWNodGlndW5nZW4nLFxuICAgICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZS5lcnIgfHwgZSksXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuICAgIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gQ291bnRlciBmb3IgZmFpbGVkIGF0dGVtcHRzIC0gc2tpcCBleGVjdXRpb24gYWZ0ZXIgNCBjb25zZWN1dGl2ZSBmYWlsdXJlc1xubGV0IGZhaWx1cmVDb3VudGVyID0gMDtcbmNvbnN0IE1BWF9GQUlMVVJFUyA9IDM7XG5cbi8vIENvbnZlcnQgUlNTSSBpbiBkQm0gdG8gYSBxdWFsaXR5IHBlcmNlbnRhZ2UgYmV0d2VlbiAwIGFuZCAxMDAuXG5mdW5jdGlvbiBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSkge1xuICAgIGlmIChkYm0gPT09IG51bGwgfHwgTnVtYmVyLmlzTmFOKGRibSkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IG1pbkRibSA9IC0xMDA7XG4gICAgY29uc3QgbWF4RGJtID0gLTMwO1xuICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heChtaW5EYm0sIE1hdGgubWluKG1heERibSwgZGJtKSk7XG4gICAgY29uc3QgcGVyY2VudCA9ICgoY2xhbXBlZCAtIG1pbkRibSkgLyAobWF4RGJtIC0gbWluRGJtKSkgKiAxMDA7XG4gICAgcmV0dXJuIE1hdGgucm91bmQocGVyY2VudCk7XG59XG5cbi8qKlxuICogR2V0IGN1cnJlbnQgV0xBTiBpbmZvcm1hdGlvbiAoU1NJRCwgQlNTSUQsIFF1YWxpdHkpXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7c3NpZDogc3RyaW5nfG51bGwsIGJzc2lkOiBzdHJpbmd8bnVsbCwgcXVhbGl0eTogbnVtYmVyfG51bGwsIG1lc3NhZ2U6IHN0cmluZ3xudWxsfT59XG4gKiBAZGVzY3JpcHRpb24gbWVzc2FnZSBjYW4gYmU6IFwiZXJyb3JcIiAob24gZXJyb3IpLCBcIm5vaW50ZXJmYWNlXCIgKG5vIGludGVyZmFjZSBhdmFpbGFibGUpLCBcIm5vcGVybWlzc2lvbnNcIiAobG9jYXRpb24gcGVybWlzc2lvbnMgbWlzc2luZyBvbiBXaW5kb3dzKSwgb3IgbnVsbCAoc3VjY2VzcylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvKCkge1xuICAgIC8vIFNraXAgZXhlY3V0aW9uIGlmIHdlJ3ZlIGhhZCB0b28gbWFueSBjb25zZWN1dGl2ZSBmYWlsdXJlc1xuICAgIGlmIChmYWlsdXJlQ291bnRlciA+PSBNQVhfRkFJTFVSRVMpIHtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICBcbiAgICAgICAgc3dpdGNoIChwbGF0Zm9ybSkge1xuICAgICAgICAgICAgY2FzZSAnbGludXgnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTGludXgoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9NYWNPUygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEVuc3VyZSByZXN1bHQgaXMgYWx3YXlzIGFuIG9iamVjdFxuICAgICAgICBpZiAoIXJlc3VsdCB8fCB0eXBlb2YgcmVzdWx0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlc2V0IGNvdW50ZXIgb24gc3VjY2Vzc2Z1bCByZXN1bHQgKGhhcyBkYXRhKVxuICAgICAgICBpZiAocmVzdWx0LnNzaWQgfHwgcmVzdWx0LmJzc2lkIHx8IHJlc3VsdC5xdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlciA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbmNyZW1lbnQgY291bnRlciBvbiBmYWlsdXJlXG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIFJldHVybiBlbXB0eSBvYmplY3QgaW5zdGVhZCBvZiB0aHJvd2luZyB0byBwcmV2ZW50IGFwcCBjcmFzaFxuICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIExpbnV4IHVzaW5nIG5tY2xpICh3aXRoIGZhbGxiYWNrIHRvIGl3L2l3Y29uZmlnKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb0xpbnV4KCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBubWNsaSBmaXJzdCAobW9zdCBjb21tb24gb24gbW9kZXJuIExpbnV4KVxuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZ2V0IGFjdGl2ZSBkZXZpY2UgZGlyZWN0bHkgKGZhc3RlciB0aGFuIGxpc3RpbmcgYWxsIG5ldHdvcmtzKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHN0ZG91dCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYygnbm1jbGkgLXQgLWYgYWN0aXZlLHNzaWQsYnNzaWQsc2lnbmFsIGRldmljZSB3aWZpIGxpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDQwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3Rkb3V0ID0gcmVzdWx0LnN0ZG91dDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBjYXRjaCAoZXhlY0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gRXZlbiBpZiBleGVjQXN5bmMgdGhyb3dzIGFuIGVycm9yLCBjaGVjayBpZiBzdGRvdXQgY29udGFpbnMgdmFsaWQgZGF0YVxuICAgICAgICAgICAgICAgIC8vIG5tY2xpIHNvbWV0aW1lcyByZXR1cm5zIG5vbi16ZXJvIGV4aXQgY29kZSBidXQgc3RpbGwgcHJvdmlkZXMgdmFsaWQgb3V0cHV0XG4gICAgICAgICAgICAgICAgaWYgKGV4ZWNFcnJvci5zdGRvdXQgJiYgZXhlY0Vycm9yLnN0ZG91dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzdGRvdXQgPSBleGVjRXJyb3Iuc3Rkb3V0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4ZWNFcnJvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvdXRwdXQgZnJvbSBubWNsaScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmluZCBhY3RpdmUgY29ubmVjdGlvblxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICAgICAgaWYgKChwYXJ0c1swXSA9PT0gJ3llcycgfHwgcGFydHNbMF0gPT09ICdqYScpICYmIHBhcnRzLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBwYXJ0c1sxXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgLy8gQlNTSUQgaXMgYSBNQUMgYWRkcmVzcyAoNiBoZXggYnl0ZXMgc2VwYXJhdGVkIGJ5IGNvbG9ucywgcG9zc2libHkgZXNjYXBlZClcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCB1c2luZyByZWdleCAtIGhhbmRsZSBlc2NhcGVkIGNvbG9ucyAoXFw6KSBhcyBzaG93biBpbiBubWNsaSBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gcmVnZXggc3RyaW5nLCBcXFxcOiBtYXRjaGVzIGEgbGl0ZXJhbCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgY29sb25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86XFxcXDpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZXNjYXBlIGJhY2tzbGFzaGVzIGFuZCBub3JtYWxpemUgdG8gdXBwZXJjYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2hbMF0ucmVwbGFjZSgvXFxcXDovZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBub3JtYWwgY29sb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbm9ybWFsTWF0Y2hbMF0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBwYXJ0c1syXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTaWduYWwgaXMgdGhlIGxhc3QgbnVtZXJpYyBwYXJ0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbFN0ciA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID8gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHJpbSgpIDogJyc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IHNpZ25hbFN0ciA/IChwYXJzZUludChzaWduYWxTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChubWNsaUVycm9yKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQsIGV0Yy4pLCBub3QgaWYganVzdCBubyBXTEFOIGFjdGl2ZVxuICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBubWNsaUVycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChubWNsaUVycm9yLm1lc3NhZ2UgJiYgIW5tY2xpRXJyb3IubWVzc2FnZS5pbmNsdWRlcygnTm8gb3V0cHV0JykpO1xuICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBubWNsaSBjb21tYW5kIGZhaWxlZDonLCBubWNsaUVycm9yLm1lc3NhZ2UgfHwgbm1jbGlFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGl3IChpd2NvbmZpZyBpcyBkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtRSBcIl5cXHMqc3NpZHxeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdsaW5rU3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUEgNSBcIl5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgU1NJRFxuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGl3U3Rkb3V0ID8gaXdTdGRvdXQubWF0Y2goL3NzaWRcXHMrKC4rKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gc3NpZE1hdGNoID8gc3NpZE1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCBhbmQgc2lnbmFsIGZyb20gbGluayBpbmZvXG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvYWRkcjpcXHMrKFthLWYwLTk6XXsxN30pL2kpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9zaWduYWw6XFxzKygtP1xcZCspLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbERibSA9IHNpZ25hbE1hdGNoID8gKHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1YWxpdHkgPSBzaWduYWxEYm0gIT09IG51bGwgPyBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbERibSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGl3RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IGl3IGNvbW1hbmQgZmFpbGVkOicsIGl3RXJyb3IubWVzc2FnZSB8fCBpd0Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gTGFzdCBmYWxsYmFjazogaXdjb25maWcgKGRlcHJlY2F0ZWQgYnV0IHdpZGVseSBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXdjb25maWcgMj4vZGV2L251bGwgfCBncmVwIC1FIFwiRVNTSUR8QWNjZXNzIFBvaW50fFNpZ25hbCBsZXZlbFwiJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9FU1NJRDpcIihbXlwiXSspXCIvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzc2lkTWF0Y2gpIHNzaWQgPSBzc2lkTWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9BY2Nlc3MgUG9pbnQ6XFxzKyhbYS1mMC05Ol17MTd9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSBic3NpZCA9IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9TaWduYWwgbGV2ZWw9KC0/XFxkKykvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaXdjb25maWdFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBhbGwgbWV0aG9kcyBmYWlsZWQgd2l0aCByZWFsIGVycm9ycyAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdjb25maWdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogQWxsIG1ldGhvZHMgKG5tY2xpLCBpdywgaXdjb25maWcpIGZhaWxlZC4gTGFzdCBlcnJvcjonLCBpd2NvbmZpZ0Vycm9yLm1lc3NhZ2UgfHwgaXdjb25maWdFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdlcnJvcidcbiAgICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgIG1lc3NhZ2U6ICdub2ludGVyZmFjZSdcbiAgICB9O1xufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBuZXRzaFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzaCB3bGFuIHNob3cgaW50ZXJmYWNlcycsIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIHN0ZGVyciBmb3Igc2VydmljZSBlcnJvcnNcbiAgICAgICAgY29uc3QgZXJyb3JPdXRwdXQgPSAoc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBvdXRwdXQgPSAoc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZE91dHB1dCA9IG91dHB1dCArICcgJyArIGVycm9yT3V0cHV0O1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgV0xBTiBzZXJ2aWNlIGlzIG5vdCBydW5uaW5nICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW5zdmMnKSB8fCBcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuIGF1dG9jb25maWcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2F1dG9tYXRpc2NoIHdsYW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4ta29uZmlndXJhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2lzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzZXJ2aWNlIGlzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkZXIgZGllbnN0JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlIGFyZSBubyBpbnRlcmZhY2VzIGF2YWlsYWJsZVxuICAgICAgICBpZiAoc3Rkb3V0LmluY2x1ZGVzKCdUaGVyZSBpcyBubyB3aXJlbGVzcyBpbnRlcmZhY2UnKSB8fCBcbiAgICAgICAgICAgIHN0ZG91dC5pbmNsdWRlcygnRXMgZ2lidCBrZWluZSBEcmFodGxvcy1TY2huaXR0c3RlbGxlJykgfHxcbiAgICAgICAgICAgIHN0ZG91dC5tYXRjaCgvTm8gd2lyZWxlc3MvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUsIGhhbmRsZXMgdmFyaW91cyBmb3JtYXRzXG4gICAgICAgICAgICAvLyBVc2UgbmVnYXRpdmUgbG9va2JlaGluZCB0byBlbnN1cmUgd2UgZG9uJ3QgbWF0Y2ggXCJCU1NJRFwiICh3aGljaCBjb250YWlucyBcIlNTSURcIilcbiAgICAgICAgICAgIGlmIChsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOlxccyooLispL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgc2V0IGlmIG5vdCBlbXB0eSBhbmQgbm90IFwiTi9BXCIgb3Igc2ltaWxhclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkICYmIGV4dHJhY3RlZC5sZW5ndGggPiAwICYmICFleHRyYWN0ZWQubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkID0gZXh0cmFjdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQlNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUgcGF0dGVybiBtYXRjaGluZ1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvQlNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiAoaGFuZGxlcyBib3RoIC0gYW5kIDogc2VwYXJhdG9ycywgd2l0aCBvciB3aXRob3V0IHNwYWNlcylcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEXFxzKjpcXHMqKFthLWYwLTldezJ9KD86Wy06XFxzXVthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbWF0Y2hbMV0ucmVwbGFjZSgvWy0gXS9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gU2lnbmFsIHBhcnNpbmcgLSBoYW5kbGUgdmFyaW91cyBsb2NhbGl6ZWQgZm9ybWF0cyBhbmQgcGF0dGVybnNcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL1NpZ25hbHxTaWduYWxzdFx1MDBFNHJrZXxJbnRlbnNpdFx1MDBFOXxTZVx1MDBGMWFsL2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHBlcmNlbnRhZ2UgcGF0dGVybiBmaXJzdCAobW9zdCBjb21tb24pXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooXFxkKylcXHMqJS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihwYXJzZWQpICYmIHBhcnNlZCA+PSAwICYmIHBhcnNlZCA8PSAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSBkQm0gcGF0dGVybiAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooLT9cXGQrKVxccypkQm0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGJtID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oZGJtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTm9ybWFsaXplIGVtcHR5IHN0cmluZ3MgdG8gbnVsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogKHNzaWQgJiYgc3NpZC5sZW5ndGggPiAwKSA/IHNzaWQgOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IChic3NpZCAmJiBic3NpZC5sZW5ndGggPiAwKSA/IGJzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyBkdWUgdG8gbG9jYXRpb24gcGVybWlzc2lvbnMgKG1pZ2h0IGJlIGluIHN0ZGVyciBvciBlcnJvciBtZXNzYWdlKVxuICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSAoZXJyb3IubWVzc2FnZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRvdXQgPSAoZXJyb3Iuc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZGVyciA9IChlcnJvci5zdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkRXJyb3JPdXRwdXQgPSBlcnJvck1lc3NhZ2UgKyAnICcgKyBlcnJvclN0ZG91dCArICcgJyArIGVycm9yU3RkZXJyO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTG9nIGVycm9yIHdoZW4gY29tbWFuZCBleGVjdXRpb24gZmFpbHMgKHRpbWVvdXQsIHBlcm1pc3Npb24sIGV0Yy4pXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzOiBFcnJvciBleGVjdXRpbmcgbmV0c2ggY29tbWFuZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGwgKGZhbGxiYWNrIHdoZW4gbmV0c2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIChkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24pXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgYWN0aXZlIFdpLUZpIGNvbm5lY3Rpb24gcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncG93ZXJzaGVsbCAtQ29tbWFuZCBcIiRwcm9maWxlID0gR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIHwgV2hlcmUtT2JqZWN0IHskXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2ktRmkqXFwnIC1vciAkXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2lyZWxlc3MqXFwnfSB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDE7IGlmICgkcHJvZmlsZSkgeyAkcHJvZmlsZS5OYW1lIH1cIicsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHNzaWRTdHIgPSBzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIGlmIChzc2lkU3RyICYmIHNzaWRTdHIubGVuZ3RoID4gMCAmJiAhc3NpZFN0ci5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZFN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEJTU0lEIGNhbm5vdCBiZSBlYXNpbHkgcmV0cmlldmVkIHdpdGhvdXQgbmV0c2ggKHdoaWNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICAgICAgICAvLyBTZXR0aW5nIHRvIG51bGwgYXMgZmFsbGJhY2sgLSBTU0lEIGlzIHRoZSBtb3N0IGltcG9ydGFudCBpbmZvcm1hdGlvbiBhbnl3YXlcbiAgICAgICAgY29uc3QgYnNzaWQgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIFBvd2VyU2hlbGwgZmFsbGJhY2sgKGNhbid0IGVhc2lseSBnZXQgc2lnbmFsIHN0cmVuZ3RoIHdpdGhvdXQgbmV0c2gpXG4gICAgICAgIC8vIFJldHVybiBub3Blcm1pc3Npb25zIG1lc3NhZ2Ugc28gZnJvbnRlbmQgY2FuIHNob3cgdGhlIHdhcm5pbmdcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdub3Blcm1pc3Npb25zJ1xuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyBlcnJvciBpZiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxzXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbDogUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsZWQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gbWFjT1MgdXNpbmcgYWlycG9ydCBvciBuZXR3b3Jrc2V0dXBcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9NYWNPUygpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgYWlycG9ydCBjb21tYW5kIGZpcnN0IChkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWlycG9ydCBpcyBhdmFpbGFibGUgKHVzdWFsbHkgYXQgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQpXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYWlycG9ydFBhdGggfSA9IGF3YWl0IGV4ZWNBc3luYygnd2hpY2ggYWlycG9ydCAyPi9kZXYvbnVsbCB8fCBlY2hvIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0Jywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDEwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgYWlycG9ydCA9IGFpcnBvcnRQYXRoLnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgJHthaXJwb3J0fSAtSWAsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcnNzaURibSA9IG51bGw7XG4gICAgICAgICAgICBsZXQgc2lnbmFsUGVyY2VudCA9IG51bGw7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ1NTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGxpbmUucmVwbGFjZSgnU1NJRDonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdCU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gdG8gZW5zdXJlIHdlIGdldCB0aGUgZnVsbCBCU1NJRFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQlNTSUQ6XFxzKihbYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdhZ3JDdGxSU1NJOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJTU0kgaW4gZEJtIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaVN0ciA9IGxpbmUucmVwbGFjZSgnYWdyQ3RsUlNTSTonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpID0gcnNzaVN0ciA/IChwYXJzZUludChyc3NpU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICByc3NpRGJtID0gcnNzaTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnbGluayBhdXRoOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFsdGVybmF0aXZlOiBzaWduYWwgc3RyZW5ndGggYXMgcGVyY2VudGFnZSAoaWYgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goLyhcXGQrKSUvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoICYmIHNpZ25hbFBlcmNlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxQZXJjZW50ID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBxdWFsaXR5ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChzaWduYWxQZXJjZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IHNpZ25hbFBlcmNlbnQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJzc2lEYm0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gZGJtVG9RdWFsaXR5UGVyY2VudChyc3NpRGJtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHNzaWQgfHwgYnNzaWQgfHwgcXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChhaXJwb3J0RXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIG5ldHdvcmtzZXR1cCAtIG9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChub3QganVzdCBubyBwZXJtaXNzaW9uKVxuICAgICAgICAgICAgaWYgKGFpcnBvcnRFcnJvci5jb2RlICE9PSAnRU5PRU5UJyAmJiBhaXJwb3J0RXJyb3IubWVzc2FnZSAmJiAhYWlycG9ydEVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ3Blcm1pc3Npb24nKSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogYWlycG9ydCBjb21tYW5kIGZhaWxlZDonLCBhaXJwb3J0RXJyb3IubWVzc2FnZSB8fCBhaXJwb3J0RXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjazogbmV0d29ya3NldHVwIGFuZCBpcGNvbmZpZyAoZm9yIG5ld2VyIG1hY09TIHdoZXJlIGFpcnBvcnQgaXMgbm90IGF2YWlsYWJsZSkgIC8vIHN5c3RlbV9wcm9maWxlciBpcyB3YXkgdG8gaGVhdnkgYW5kIG5lZWRzIGEgbG9vb29vdCBvZiB0aW1lIHRvIHByb2Nlc3NcbiAgICAgICAgLy8gdGhpcyBpcyBhIHNpbXBsZSBjYWxjdWxhdGlvbi4uIHdlIGNhbid0IHJlbHkgb24gYSBwcm9jZXNzIHRoYXQgdGFrZXMgMTBzIHRvIGNvbXBsZXRlIGFuZCBibG9ja3MgdGhlIHdob2xlIHN5c3RlbVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIFdMQU4gaW50ZXJmYWNlIHVzaW5nIG5ldHdvcmtzZXR1cFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGludGVyZmFjZU91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXR3b3Jrc2V0dXAgLWxpc3RhbGxoYXJkd2FyZXBvcnRzIHwgYXdrIFxcJy9XaS1GaXxBaXJQb3J0L3tnZXRsaW5lOyBwcmludCAkTkZ9XFwnJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IGludGVyZmFjZU91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghaW50ZXJmYWNlTmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIE5vIFdpLUZpIGludGVyZmFjZSBmb3VuZFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGF3ayAtRicgU1NJRCA6ICcgJy8gU1NJRCA6IC8ge3ByaW50ICQyfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRPdXRwdXQudHJpbSgpIHx8IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkLCBjb250aW51ZSB3aXRoIEJTU0lEXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBCU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYnNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGdyZXAgJ0JTU0lEIDonIHwgYXdrICd7cHJpbnQgJDN9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZFN0ciA9IGJzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBCU1NJRCBmb3JtYXQgKE1BQyBhZGRyZXNzKVxuICAgICAgICAgICAgICAgIGlmIChic3NpZFN0ciAmJiAvXlthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSQvaS50ZXN0KGJzc2lkU3RyKSkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkU3RyLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoYnNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEJTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBmYWxsYmFjayAoYWlycG9ydCBub3QgYXZhaWxhYmxlLCBjYW4ndCBnZXQgc2lnbmFsIHN0cmVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChuZXR3b3Jrc2V0dXBFcnJvcikge1xuICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIG5ldHdvcmtzZXR1cCBmYWlscyB3aXRoIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBuZXR3b3Jrc2V0dXAvaXBjb25maWcgZmFsbGJhY2sgZmFpbGVkOicsIG5ldHdvcmtzZXR1cEVycm9yLm1lc3NhZ2UgfHwgbmV0d29ya3NldHVwRXJyb3IpO1xuICAgICAgICAgICAgLy8gSWYgZmFsbGJhY2sgY29tcGxldGVseSBmYWlscywgcmV0dXJuIGVycm9yIG9iamVjdFxuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2V0V2xhbkluZm8gfTtcblxuXG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAndGFza2xpc3QgL2ZvIGNzdicgKHN0cnVjdHVyZWQgZm9ybWF0LCBmYXN0ZXIgdGhhbiAvdiwgc3RpbGwgc2hvd3MgcHJvY2VzcyBuYW1lcylcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd0YXNrbGlzdCAvZm8gY3N2JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICduZXRzdGF0IC1hbm8nIChzaG93cyBhbGwgY29ubmVjdGlvbiBzdGF0ZXMgaW5jbHVkaW5nIEVTVEFCTElTSEVEIGZvciBzY3JlZW5zaGFyaW5nIGRldGVjdGlvbilcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzdGF0IC1hbm8nLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gUmVnZXggdG8gZmluZCA6UE9SVCBmb2xsb3dlZCBieSBhIHNwYWNlIChlbnN1cmVzIGV4YWN0IHBvcnQgbWF0Y2gsIGUuZy4sIDo1OTM4IClcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9XFxcXHNgLCAnZycpIFxuICAgICAgaWYgKHJlZ2V4LnRlc3Qoc3Rkb3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsJ2NvbS5taWNyb3NvZnQudGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1Jyxcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTYsXG5dXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgKiBhcyB3aW4gZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVXaW4uanMnXG5pbXBvcnQgKiBhcyBtYWMgZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVNYWMuanMnXG5pbXBvcnQgKiBhcyBsaW51eCBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKHBsYXRmb3JtID0gJ3dpbjMyJykge1xuICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHJldHVybiBhd2FpdCB3aW4ucnVuUmVtb3RlQ2hlY2soKVxuICBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKSByZXR1cm4gYXdhaXQgbWFjLnJ1blJlbW90ZUNoZWNrKClcbiAgcmV0dXJuIGF3YWl0IGxpbnV4LnJ1blJlbW90ZUNoZWNrKClcbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIEV4cGFuZGVkIGJyb3dzZXIga2V5d29yZHMgdG8gY2F0Y2ggbW9yZSB2YXJpYW50c1xuY29uc3QgYnJvd3NlcktleXdvcmRzID0gW1xuICAgICdjaHJvbScsICdjaHJvbWUuZXhlJyxcbiAgICAnZWRnZScsICdtc2VkZ2UuZXhlJyxcbiAgICAnZmlyZScsICdmaXJlZm94LmV4ZScsXG4gICAgJ2JyYXZlJywgJ2JyYXZlLmV4ZScsXG4gICAgJ29wZXJhJywgJ29wZXJhLmV4ZScsXG4gICAgJ2Jyb3dzZXInLCAvLyBHZW5lcmljIGJyb3dzZXIgcHJvY2Vzc1xuICAgICdpZXhwbG9yZScsIC8vIEludGVybmV0IEV4cGxvcmVyXG4gICAgJ3NhZmFyaScsIC8vIEZvciBtYWNPU1xuXTtcblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsLmV4ZSAtTm9Mb2dvIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCImIHsgJHByb2MgPSBHZXQtQ2ltSW5zdGFuY2UgLUNsYXNzIFdpbjMyX1Byb2Nlc3MgLUZpbHRlciAnUHJvY2Vzc0lkPSR7cGlkfSc7IGlmICgkcHJvYykgeyAkcHJvYy5QYXJlbnRQcm9jZXNzSWQ7ICRwcm9jLk5hbWUgfSB9XCJgO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lKTtcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQobGluZXNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IGxpbmVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvV2luZG93czogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gVW5peCBzeXN0ZW1zIChMaW51eC9tYWNPUylcbiAqIFRyaWVzIC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0KSwgZmFsbHMgYmFjayB0byBwcyBjb21tYW5kXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvVW5peChwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QgbWV0aG9kIH40bXMsIG5vIHByb2Nlc3Mgc3Bhd24pXG4gICAgICAgIGNvbnN0IFtzdGF0Q29udGVudCwgY29tbUNvbnRlbnRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9zdGF0YCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKSxcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vY29tbWAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbClcbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhdENvbnRlbnQpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIC9wcm9jL3BpZC9zdGF0OiBwaWQgKGNvbW0pIHN0YXRlIHBwaWQgLi4uXG4gICAgICAgICAgICBjb25zdCBzdGF0TWF0Y2ggPSBzdGF0Q29udGVudC5tYXRjaCgvXlxcZCtcXHMrXFwoKFteKV0rKVxcKVxccytcXFMrXFxzKyhcXGQrKS8pO1xuICAgICAgICAgICAgaWYgKHN0YXRNYXRjaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSAoY29tbUNvbnRlbnQgfHwgc3RhdE1hdGNoWzFdKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQoc3RhdE1hdGNoWzJdLCAxMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBwcyBjb21tYW5kICh3b3JrcyBvbiBib3RoIExpbnV4IGFuZCBtYWNPUylcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwcyAtcCAke3BpZH0gLW8gcHBpZD0sY29tbT1gO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHN0ZG91dC50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1VuaXg6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIGJhc2VkIG9uIHBsYXRmb3JtXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvKHBpZCkge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICBcbiAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpO1xuICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcgfHwgcGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKTsgLy8gTGludXgvbWFjT1M6IHRyaWVzIC9wcm9jLCBmYWxscyBiYWNrIHRvIHBzXG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHBhcmVudCBwcm9jZXNzZXMgZm9yIGJyb3dzZXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmluZFBhcmVudFByb2Nlc3MocGlkLCBtYXhEZXB0aCwgdmlzaXRlZFBpZHMpIHtcbiAgICBpZiAocGlkID09PSAxIHx8IHBpZCA9PT0gMCkge1xuICAgICAgICBsb2cuaW5mbygnY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUm9vdCBQSUQgcmVhY2hlZC4gTm8gd2ViIGJyb3dzZXIgZm91bmQuJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKG1heERlcHRoIDw9IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIHdoZW4gbWF4IGRlcHRoIHJlYWNoZWRcbiAgICB9XG4gICAgXG4gICAgaWYgKHZpc2l0ZWRQaWRzLmhhcyhwaWQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlc1xuICAgIH1cbiAgICBcbiAgICB2aXNpdGVkUGlkcy5hZGQocGlkKTtcbiAgICBcbiAgICAvLyBHZXQgcHJvY2VzcyBpbmZvIChnZXRQcm9jZXNzSW5mbyBhbHJlYWR5IGhhcyBpdHMgb3duIHRpbWVvdXQgcHJvdGVjdGlvbilcbiAgICBjb25zdCBwcm9jZXNzSW5mbyA9IGF3YWl0IGdldFByb2Nlc3NJbmZvKHBpZCk7XG4gICAgXG4gICAgaWYgKCFwcm9jZXNzSW5mbykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHsgcHBpZCwgbmFtZSB9ID0gcHJvY2Vzc0luZm87XG4gICAgXG4gICAgLy8gTG9nIHRoZSBwcm9jZXNzIGluZm8gZm9yIGRlYnVnZ2luZ1xuICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBDaGVja2luZyBwcm9jZXNzOiAke25hbWV9IChQSUQ6ICR7cGlkfSwgUFBJRDogJHtwcGlkfSlgKTtcbiAgICBcbiAgICAvLyBNb3JlIHRob3JvdWdoIGJyb3dzZXIgZGV0ZWN0aW9uXG4gICAgaWYgKGJyb3dzZXJLZXl3b3Jkcy5zb21lKGJyb3dzZXIgPT4gbmFtZS5pbmNsdWRlcyhicm93c2VyKSkpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IEJyb3dzZXIgZm91bmQ6ICR7bmFtZX1gKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmIChuYW1lLmluY2x1ZGVzKCdleHBsb3JlcicpIHx8IHBwaWQgPD0gMSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUmVhY2hlZCBzeXN0ZW0gcHJvY2VzcyBvciBleHBsb3JlcmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHBwaWQsIG1heERlcHRoIC0gMSwgdmlzaXRlZFBpZHMpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBwYXJlbnQgcHJvY2VzcyBpcyBhIGJyb3dzZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrUGFyZW50UHJvY2VzcygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmb3VuZEJyb3dzZXIgPSBhd2FpdCBmaW5kUGFyZW50UHJvY2Vzcyhwcm9jZXNzLnBwaWQsIDYsIG5ldyBTZXQoKSk7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogQnJvd3NlciBkZXRlY3Rpb24gcmVzdWx0OiAke2ZvdW5kQnJvd3Nlcn1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZm91bmRCcm93c2VyIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogRXJyb3IgaW4gYnJvd3NlciBkZXRlY3Rpb246ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGZvdW5kQnJvd3NlcjogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgfVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBdUJBLFNBQVMsWUFBQUEsaUJBQWdCO0FBQ3pCLFNBQVMsWUFBWTtBQUNyQixTQUFTLFdBQVc7QUFDcEIsT0FBTyxTQUFTOzs7QUNyQmhCLElBQU0sU0FBUztBQUFBLEVBQ1gsYUFBYTtBQUFBO0FBQUEsRUFDYixjQUFjO0FBQUEsRUFDZCxlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixTQUFTO0FBQUEsRUFFVCxlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsaUJBQWlCO0FBQUEsRUFFakIsZUFBZTtBQUFBO0FBQUEsRUFDZixxQkFBcUI7QUFBQTtBQUFBLEVBRXJCLHFCQUFxQjtBQUFBLEVBQ3JCLFFBQVE7QUFBQTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsVUFBVTtBQUFBLEVBQ1YsYUFBYTtBQUFBLEVBQ2IsU0FBUztBQUFBLEVBRVQsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsYUFBYTtBQUFBLEVBQ2IsTUFBTTtBQUNWO0FBQ0EsSUFBTyxpQkFBUTs7O0FETGYsU0FBUyxxQkFBcUI7QUFDOUIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFFBQVE7QUFDZixPQUFPLE9BQU8sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzlDLElBQU0sWUFBWSxZQUFZO0FBSTlCLElBQU0s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LEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLFlBQVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFDL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZXhlY1N5bmMiLCAiZXhlY1N5bmMiLCAibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgImdsb2JhbFNob3J0Y3V0IiwgIlRyYXkiLCAiTWVudSIsICJkaWFsb2ciLCAibG9nIiwgImxvZyIsICJwYXRoIiwgImZzIiwgImlwIiwgImdhdGV3YXk0c3luYyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAibG9nIiwgImNvbmZpZ1N0b3JlIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJsb2ciLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgIl9fZGlybmFtZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgImxvZyIsICJhcHBzVG9DbG9zZSIsICJjaGlsZFByb2Nlc3MiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAibG9nIiwgInBhdGgiLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJqb2luIiwgImxvZyIsICJhcHAiLCAiZnMiLCAiam9pbiIsICJzY3JlZW4iLCAiaXBjTWFpbiIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJ3ZWJDb250ZW50cyIsICJwYXRoIiwgImZzIiwgImNsaXBib2FyZCIsICJhcHAiLCAib3MiLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImFwcCIsICJmcyIsICJwYXRoIiwgInByb2Nlc3MiLCAic3Bhd24iLCAiYXBwIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAic3Bhd24iLCAibG9nIiwgInByb2Nlc3MiLCAiZnMiLCAicGF0aCIsICJvcyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJhcHAiLCAibG9nIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgImxvZyIsICJwYXRoIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYXBwIiwgInBhdGgiLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgIndlYkNvbnRlbnRzIiwgInNjcmVlbiIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
