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
  bipDemo: true,
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
  buildDate: "20260204",
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
          path2.join("C:\\Users\\mpointner\\Documents\\Next-Exam\\bip-org-next-exam-quasar\\student\\.quasar\\dev-electron\\preload", "electron-preload.cjs")
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuZG90ZW52LmNvbmZpZyh7IHBhdGg6ICdlbGVjdHJvbi1idWlsZGVyLmVudicgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5cblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLnBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICB0aGlzLl9hcmNoID0gcHJvY2Vzcy5hcmNoO1xuICAgIHRoaXMuX2VudiA9IHByb2Nlc3MuZW52O1xuXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmlzS0RFID0gdGhpcy5faXNLREUoKTtcbiAgICB0aGlzLmlzR05PTUUgPSB0aGlzLl9pc0dOT01FKCk7XG4gICAgdGhpcy5mbGFtZXNob3QgPSB0aGlzLl9nZXRWZXJzaW9uKCdmbGFtZXNob3QnKTtcbiAgICB0aGlzLmltYWdlbWFnaWNrID0gdGhpcy5fZ2V0VmVyc2lvbignY29udmVydCcpO1xuICAgIHRoaXMuaW1WZXJzaW9uID0gdGhpcy5fZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCk7XG4gICAgdGhpcy53b3JrZXJGaWxlTmFtZSA9IHRoaXMuX2dldFdvcmtlckZpbGVOYW1lKCk7XG4gICAgdGhpcy51c2VXb3JrZXIgPSB0aGlzLl9nZXRVc2VXb3JrZXIoKTtcbiAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gdGhpcy5fZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKTtcbiAgICB0aGlzLmpyZSA9IHRoaXMuX2RldGVjdEpSRUlkKCk7XG4gICAgdGhpcy5qcmVEaXIgPSB0aGlzLl9yZXNvbHZlSlJFRGlyKCk7XG4gICAgdGhpcy5qYXZhQmluID0gdGhpcy5fcmVzb2x2ZUphdmFCaW4oKTtcbiAgICB0aGlzLmpyZUluZm8gPSB0aGlzLl9nZXRKUkUoKTtcbiAgICBcbiAgICB0aGlzLmhvbWVkaXJlY3RvcnkgPSBvcy5ob21lZGlyKCk7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gICAgdGhpcy53b3JrZXJVUkwgPSB0aGlzLl9nZXRXb3JrZXJVUkwoKTtcbiAgICB0aGlzLnRlbXBkaXJlY3RvcnkgPSB0aGlzLl9nZXRUZW1wZGlyZWN0b3J5KCk7XG4gICAgdGhpcy53b3JrZGlyZWN0b3J5ID0gdGhpcy5fZ2V0V29ya2RpcmVjdG9yeSgpO1xuICAgIHRoaXMubG9nZmlsZSA9IHRoaXMuX2dldExvZ2ZpbGUoKTtcblxuICB9XG5cbiAgX2dldFdvcmtkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5ob21lZGlyZWN0b3J5LCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTtcbiAgfVxuXG4gIF9nZXRUZW1wZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKTtcbiAgfVxuXG5cbiAgX2dldExvZ2ZpbGUoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy53b3JrZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJyk7XG4gIH1cblxuICBfbm9ybWFsaXplQXJjaCgpIHtcbiAgICBpZiAodGhpcy5fYXJjaCA9PT0gJ2lhMzInKSByZXR1cm4gJ2k1ODYnO1xuICAgIGlmIChbJ3g2NCcsICdhcm02NCddLmluY2x1ZGVzKHRoaXMuX2FyY2gpKSByZXR1cm4gdGhpcy5fYXJjaDtcbiAgICB0aGlzLl9mYWlsKGB1bnN1cHBvcnRlZCBhcmNoaXRlY3R1cmU6ICR7dGhpcy5fYXJjaH1gKTtcbiAgfVxuXG4gIF9kZXRlY3RKUkVJZCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gJ21pbmltYWwtanJlLTExLXdpbic7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXJjaCA9PT0gJ2FybTY0JyA/ICdtaW5pbWFsLWpyZS0xMS1tYWMtYXJtNjQnIDogJ21pbmltYWwtanJlLTExLW1hYyc7XG4gICAgfVxuICB9XG5cblxuXG5cblxuICAvKipcbiAgICogXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIEBkZXNjcmlwdGlvbiB0aGlzIGZ1bmN0aW9uIHJlc29sdmVzIHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIGl0IGZpcnN0IGNoZWNrcyBpZiB0aGUgdXNlQnVuZGxlZEpSRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZVxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgY2hlY2tzIGlmIHRoZSBzeXN0ZW0ganJlIGlzIGluc3RhbGxlZFxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3lzdGVtIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogdGhlIGJ1bmRsZWQganJlIGlzIGxvY2F0ZWQgaW4gdGhlIHB1YmxpYyBkaXJlY3Rvcnkgb2YgdGhlIGFwcFxuICAgKiBcbiAgICogRklYTUU6IGlmIHN5c3RlbSBqcmUgaXMgc2VsZWN0ZWQgYnkgRU5WIGRvIG5vdCBpbmNsdWRlIHRoZSBqcmUgZGlyZWN0b3J5IGluIHRoZSBmaW5hbCBidWlsZFxuICAgKi9cblxuICBfcmVzb2x2ZUpSRURpcigpIHtcbiAgICAvLyB1c2UgYnVuZGxlZCBqcmUgYmVjYXVzZSBpdHMgc21hbGxlciBhbmQgcHJvdmlkZXMgb25seSB0aGUgbmVlZGVkIGphdmEgbW9kdWxlc1xuICAgIGlmIChjb25maWcudXNlQnVuZGxlZEpSRSkge1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3Jlc29sdmVKYXZhQmluKCkge1xuICAgIHN3aXRjaCAodGhpcy5wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5wbGF0Zm9ybX1gKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0RGlzcGxheVNlcnZlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4JykgcmV0dXJuICduL2EnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnKSByZXR1cm4gJ3dheWxhbmQnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3gxMScgfHwgdGhpcy5fZW52LkRJU1BMQVkpIHJldHVybiAneDExJztcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG5cbiAgX2dldFZlcnNpb24oY21kKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke2NtZH0gLS12ZXJzaW9uYCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnNwbGl0KCdcXG4nKVswXTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL1tcXGRdKyhcXC5bXFxkXSspKy8pO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb246IHZlcnNpb24/LlswXSB8fCAndW5rbm93bicgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRKUkUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdqYXZhIC12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdpZ25vcmUnLCAncGlwZSddIH0pO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvdmVyc2lvbiBcIihbXFxkLl9dKylcIi8pPy5bMV0gfHwgJ3Vua25vd24nO1xuICAgICAgY29uc3QgamF2YUhvbWUgPSB0aGlzLl9lbnYuSkFWQV9IT01FIHx8ICcnO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb24sIHBhdGg6IGphdmFIb21lIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwsIHBhdGg6IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0V29ya2VyRmlsZU5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgLy8gV29ya2VyLUxvZ2lrIGRpcmVrdCBhbnNjaGxpZVx1MDBERmVuXG4gICAgY29uc3QgYmFzZURpciA9IGFwcC5pc1BhY2thZ2VkID8gcHJvY2Vzcy5yZXNvdXJjZXNQYXRoIDogaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICBjb25zdCB3b3JrZXJQYXRoID0gYXBwLmlzUGFja2FnZWRcbiAgICAgID8gam9pbihiYXNlRGlyLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSlcbiAgICAgIDogam9pbihiYXNlRGlyLCAnLi4vLi4vcHVibGljJywgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gIFxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHdvcmtlclBhdGgpO1xuICB9XG5cbiAgaXNXYXlsYW5kKCkge1xuICAgIHJldHVybiB0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnO1xuICB9XG5cbiAgX2lzS0RFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKTtcbiAgICAgIHJldHVybiBvdXQgPT09ICdLREUnO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzS0RFOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc0dOT01FKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygnZ25vbWUnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0dOT01FOiBubyBkYXRhXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pc1VOSVRZKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXQgPSBleGVjU3luYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIHsgc2hlbGw6ICcvYmluL2Jhc2gnLCBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgcmV0dXJuIG91dC5pbmNsdWRlcygndW5pdHknKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZy53YXJuKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzVU5JVFk6IG5vIGRhdGFcIiwgZXJyKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaW1hZ2VtYWdpY2tBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwibWFnaWNrIC12ZXJzaW9uXCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgdjcgKG1hZ2ljaylcIik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZmxhbWVzaG90QXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIndoaWNoIGZsYW1lc2hvdFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ZsYW1lc2hvdEF2YWlsYWJsZTogRmxhbWVzaG90IG5vdCBmb3VuZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfc2V0dXBEZXNrdG9wUGF0aCgpIHtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgfVxuXG4gIF9nZXREZXNrdG9wUGF0aCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudlsnVVNFUlBST0ZJTEUnXSwgJ0Rlc2t0b3AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksICdEZXNrdG9wJyk7XG4gICAgfVxuICB9XG5cbiAgX2ZhaWwobXNnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFtwbGF0Zm9ybURpc3BhdGNoZXJdICR7bXNnfWApO1xuICB9XG5cbiAgX2dldEltYWdlTWFnaWNrVmVyc2lvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiBcIjdcIjtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4ZWNTeW5jKFwid2hpY2ggaW1wb3J0XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBGb3VuZCBJbWFnZU1hZ2ljayA8NyAoaW1wb3J0KVwiKTtcbiAgICAgICAgcmV0dXJuIFwiPDdcIjtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uOiBJbWFnZU1hZ2ljayBub3QgZm91bmRcIik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9nZXRVc2VXb3JrZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIHJldHVybiB0aGlzLl9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBfZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgIGlmICgodGhpcy5faXNHTk9NRSgpIHx8IHRoaXMuX2lzVU5JVFkoKSkgJiYgdGhpcy5pc1dheWxhbmQoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEdOT01FL1VuaXR5ICsgV2F5bGFuZCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzS0RFKCkgJiYgdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLl9mbGFtZXNob3RBdmFpbGFibGUoKSkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IEtERS9XYXlsYW5kICsgRmxhbWVzaG90IFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMudXNlV29ya2VyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogWDExICsgSW1hZ2VNYWdpY2sgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIGZhbHNlIFx1MjAxMyBmYWxsYmFjayB0byBwYWdlY2FwdHVyZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIHZpYSBlbGVjdHJvbi1idWlsZGVyLmVudiAtIGVkaXQgdmFycyBpbiBlbGVjdHJvbi1idWlsZGVyLmVudiBmaWxlIVxuICovXG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgICBkZXZlbG9wbWVudDogdHJ1ZSwgIC8vIGRpc2FibGUga2lvc2sgbW9kZSBvbiBleGFtIG1vZGUgYW5kIG90aGVyIHN0dWZmIChhdXRvZmlsbCBpbnB1dCBmaWVsZHMpXG4gICAgc2hvd2RldnRvb2xzOiB0cnVlLFxuICAgIHVzZUJ1bmRsZWRKUkU6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwRGVtbzogdHJ1ZSxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIGVsZWN0cm9uOiBmYWxzZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMjA0JyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBFTEVDVFJPTiBtYWluIGZpbGUgdGhhdCBhY3R1YWxseSBvcGVucyB0aGUgZWxlY3Ryb24gd2luZG93XG4gKi9cbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgVHJheSwgTWVudSwgZGlhbG9nLCBzZXNzaW9ufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBmc0V4dHJhIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL21haW4vc2NyaXB0cy90cmF5bWVudS5qcydcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGNoZWNrUGFyZW50UHJvY2VzcyB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzJztcblxuaW1wb3J0IHsgdG9nZ2xlTWFjT1NMb2NrZG93biB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJ1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuZWxlY3Ryb24gPSB0cnVlXG5cbmNvbmZpZy5ob21lZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnk7XG5jb25maWcud29ya2RpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZGlyZWN0b3J5O1xuY29uZmlnLnRlbXBkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeTtcbmNvbmZpZy5leGFtZGlyZWN0b3J5ID0gY29uZmlnLndvcmtkaXJlY3RvcnkgICAgLy8gd2UgbmVlZCB0aGlzIHZhcmlhYmxlIHNldHVwIGV2ZW4gaWYgd2UgZG8gbm90IGNvbm5lY3QgdG8gYSB0ZWFjaGVyIGluc3RhbmNlXG5cblxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIENoZWNrIGlmIHRoZSBkZXNrdG9wIGZvbGRlciBleGlzdHMgYW5kIGNyZWF0ZSBpZiBpdCBkb2Vzbid0XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGluayB0byB0aGUgd29ya2RpcmVjdG9yeSBvbiB0aGUgZGVza3RvcFxuY29uc3QgbGlua1BhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoLCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbiBAIGNyZWF0ZS1zeW1saW5rOiBjYW4ndCBjcmVhdGUgc3ltbGlua1wiKX1cblxuXG50cnkgeyAvL2JpbmQgdG8gdGhlIGNvcnJlY3QgaW50ZXJmYWNlXG4gICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlfSA9IGdhdGV3YXk0c3luYygpOyBcbiAgICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSkgICAgLy8gdGhpcyByZXR1cm5zIHRoZSBpcCBvZiB0aGUgaW50ZXJmYWNlIHRoYXQgaGFzIGEgZGVmYXVsdCBnYXRld2F5Li4gIHNob3VsZCB3b3JrIGluIE1PU1QgY2FzZXMuICBwcm9iYWJseSBwcm92aWRlIFwiaXAtb3B0aW9uc1wiIGluIFVJID9cbiAgICBjb25maWcuZ2F0ZXdheSA9IHRydWVcbn1cbiBjYXRjaCAoZSkge1xuICAgbG9nLmVycm9yKFwibWFpbiBAIGdhdGV3YXk0c3luYzogdW5hYmxlIHRvIGRldGVybWluZSBkZWZhdWx0IGdhdGV3YXlcIilcbiAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgXG4gICBsb2cuaW5mbyhgbWFpbjogSVAgJHtjb25maWcuaG9zdGlwfWApXG4gICBjb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gfVxuXG5cbmZzRXh0cmEuZW1wdHlEaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSAgLy8gY2xlYW4gdGVtcCBkaXJlY3RvcnlcblxuXG5cblxuXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbi8vIEZpbHRlciBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgYW5kIFdlYkNvbnRlbnRzIHN1YmZyYW1lIGVycm9ycyBmcm9tIHN0ZGVyci9zdGRvdXRcbmNvbnN0IG9yaWdpbmFsU3RkZXJyV3JpdGUgPSBwcm9jZXNzLnN0ZGVyci53cml0ZTtcbmNvbnN0IG9yaWdpbmFsU3Rkb3V0V3JpdGUgPSBwcm9jZXNzLnN0ZG91dC53cml0ZTtcblxucHJvY2Vzcy5zdGRlcnIud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRlcnJXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5zdGRvdXQud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRvdXRXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyKSA9PiB7XG4gICAgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG4gICAgICAgIGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZTtcbiAgICAgICAgbG9nLndhcm4oJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjogRVBJUEUgRXJyb3I6IFRoZSBzdGRvdXQgc3RyZWFtIG9mIHRoZSBFbGVjdHJvbkxvZ2dlciB3aWxsIGJlIGRpc2FibGVkLicpO1xuICAgIH0gXG4gICAgZWxzZSBpZiAoZXJyLm1lc3NhZ2U/LmluY2x1ZGVzKCdSZW5kZXIgZnJhbWUgd2FzIGRpc3Bvc2VkJykpIHJldHVybjtcbiAgICBlbHNlIHsgIGxvZy5lcnJvcignbWFpbiBAIHVuY2F1Z2h0RXhjZXB0aW9uOicsIGVyci5tZXNzYWdlKTsgfSAgLy8gTG9nIG9yIGRpc3BsYXkgb3RoZXIgZXJyb3JzXG59KTtcblxuLy8gSGFuZGxlIHVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbnMgdG8gcHJldmVudCBjcmFzaGVzXG5wcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAocmVhc29uLCBwcm9taXNlKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBVbmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb246JywgcmVhc29uKTtcbiAgICBpZiAocmVhc29uIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBTdGFjazonLCByZWFzb24uc3RhY2spO1xuICAgIH1cbn0pO1xuXG4vLyBIYW5kbGUgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG5hcHAub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkJyk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGlkZW50aWZ5IHdoaWNoIHdpbmRvdyBjcmFzaGVkXG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgIFxuICAgIGlmIChjcmFzaGVkV2luZG93KSB7XG4gICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBGb3IgZXhhbSB3aW5kb3cgY3Jhc2hlcywgdHJ5IHRvIGNsb3NlIGl0IGdyYWNlZnVsbHlcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzIC0gbGV0IGl0IGNvbnRpbnVlXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBIYW5kbGUgY2hpbGQgcHJvY2VzcyBjcmFzaGVzICh3b3JrZXJzLCBldGMuKVxuYXBwLm9uKCdjaGlsZC1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IENoaWxkIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogVHlwZTonLCBkZXRhaWxzLnR5cGUpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKX1cbi8vaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgIGFwcC5kb2NrLmhpZGUoKSB9ICAvLyB0aGlzIGJ1ZyBzdGF0ZXMgdGhhdCBpdCBraW5kYSBtZXNzZXMgdXAga2lvc2sgbW9kZSAtIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTgyMDdcblxuXG5cbi8vIGhpZGUgY2VydGlmaWNhdGUgd2FybmluZ3MgaW4gY29uc29sZS4uIHdlIGtub3cgd2UgdXNlIGEgc2VsZiBzaWduZWQgY2VydCBhbmQgZG8gbm90IHZhbGlkYXRlIGl0XG5wcm9jZXNzLmVudltcIk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRURcIl0gPSBcIjBcIjtcbnByb2Nlc3MuZW52Lk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQgPSBcIjBcIjtcbmNvbnN0IG9yaWdpbmFsRW1pdFdhcm5pbmcgPSBwcm9jZXNzLmVtaXRXYXJuaW5nXG5wcm9jZXNzLmVtaXRXYXJuaW5nID0gKHdhcm5pbmcsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAod2FybmluZyAmJiB3YXJuaW5nLmluY2x1ZGVzICYmIHdhcm5pbmcuaW5jbHVkZXMoJ05PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQnKSkgeyAgcmV0dXJuIH1cbiAgICByZXR1cm4gb3JpZ2luYWxFbWl0V2FybmluZy5jYWxsKHByb2Nlc3MsIHdhcm5pbmcsIG9wdGlvbnMpXG59XG5cbmFwcC5vbignY2VydGlmaWNhdGUtZXJyb3InLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCB1cmwsIGVycm9yLCBjZXJ0aWZpY2F0ZSwgY2FsbGJhY2spID0+IHsgLy8gU1NML1RMUzogdGhpcyBpcyB0aGUgc2VsZiBzaWduZWQgY2VydGlmaWNhdGUgc3VwcG9ydFxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIE9uIGNlcnRpZmljYXRlIGVycm9yIHdlIGRpc2FibGUgZGVmYXVsdCBiZWhhdmlvdXIgKHN0b3AgbG9hZGluZyB0aGUgcGFnZSlcbiAgICBjYWxsYmFjayh0cnVlKTsgIC8vIGFuZCB3ZSB0aGVuIHNheSBcIml0IGlzIGFsbCBmaW5lIC0gdHJ1ZVwiIHRvIHRoZSBjYWxsYmFja1xufSk7XG5cbi8vIEhhbmRsZSBXZWJDb250ZW50cyBsb2FkIGZhaWx1cmVzIHRvIHByZXZlbnQgYXBwIGNyYXNoZXNcbmFwcC5vbignd2ViLWNvbnRlbnRzLWNyZWF0ZWQnLCAoZXZlbnQsIHdlYkNvbnRlbnRzKSA9PiB7XG4gICAgY29uc3Qgc3VwcHJlc3NDb2RlcyA9IFstMywgLTEwMCwgLTEwMSwgLTEwNV07XG5cbiAgICAvLyBTdG9yZSBpZiB3ZSd2ZSBhbHJlYWR5IHNldCB1cCBsaXN0ZW5lcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGlmICh3ZWJDb250ZW50cy5fZXJyb3JTdXBwcmVzc2lvblNldHVwKSByZXR1cm47XG4gICAgd2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCA9IHRydWU7XG5cbiAgICAvLyBTZXQgdXAgbGlzdGVuZXJzIHRoYXQgcGVyc2lzdCBhY3Jvc3MgbmF2aWdhdGlvblxuICAgIGNvbnN0IHNldHVwRXJyb3JTdXBwcmVzc2lvbiA9ICgpID0+IHtcbiAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgZmlyc3QgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgICAgICB3ZWJDb250ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKTtcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1sb2FkJyk7XG4gICAgICAgIFxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcblxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU2V0IHVwIGltbWVkaWF0ZWx5XG4gICAgc2V0dXBFcnJvclN1cHByZXNzaW9uKCk7XG5cbiAgICAvLyBSZS1zZXR1cCBvbiBuYXZpZ2F0aW9uIHRvIGVuc3VyZSBsaXN0ZW5lcnMgcGVyc2lzdFxuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtc3RhcnQtbmF2aWdhdGlvbicsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgd2ViQ29udGVudHMub24oJ2RpZC1mcmFtZS1uYXZpZ2F0ZScsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgXG4gICAgLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyBmb3Igc3BlY2lmaWMgd2ViQ29udGVudHMgKFY4IGZhdGFsIGVycm9ycywgZXRjLilcbiAgICB3ZWJDb250ZW50cy5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChldmVudCwgZGV0YWlscykgPT4ge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZW5kZXJlciBwcm9jZXNzIGNyYXNoZWQgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzJyk7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgdGhpcyB3ZWJDb250ZW50cyBiZWxvbmdzIHRvXG4gICAgICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICAgICAgY29uc3QgY3Jhc2hlZFdpbmRvdyA9IGFsbFdpbmRvd3MuZmluZCh3aW4gPT4gd2luLndlYkNvbnRlbnRzLmlkID09PSB3ZWJDb250ZW50cy5pZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IHRpdGxlOiAke2NyYXNoZWRXaW5kb3cuZ2V0VGl0bGUoKX1gKTtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyBVUkw6ICR7Y3Jhc2hlZFdpbmRvdy53ZWJDb250ZW50cy5nZXRVUkwoKX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdyA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNyYXNoZWRXaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXJyb3IgY2xvc2luZyBleGFtIHdpbmRvdzonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xufSk7XG5cbmFwcC5vbignd2luZG93LWFsbC1jbG9zZWQnLCAoKSA9PiB7ICAvLyBpZiB3aW5kb3cgaXMgY2xvc2VkXG4gICAgY2xlYXJJbnRlcnZhbCggQ29tbUhhbmRsZXIudXBkYXRlU3R1ZGVudEludGVydmFsbCApXG4gICAgV2luZG93SGFuZGxlci5tYWlud2luZG93ID0gbnVsbFxuICAgIGFwcC5xdWl0KCkgICBcbn0pXG5cbmFwcC5vbignd2lsbC1xdWl0JywgKCkgPT4geyAgLy8gaWYgd2luZG93IGlzIGNsb3NlZFxuICAgIHRvZ2dsZU1hY09TTG9ja2Rvd24oZmFsc2UpXG59KVxuXG5hcHAub24oJ2JlZm9yZS1xdWl0JywgYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7fSk7IC8vIGNsZWFyIGNvb2tpZXMsIGNhY2hlLCBsb2NhbFN0b3JhZ2UgZXRjLlxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBiZWZvcmUtcXVpdDogRXJyb3IgY2xlYXJpbmcgY2FjaGU6JywgZXJyKTtcbiAgICB9XG59KTtcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpIH0gXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpIH1cbn0pXG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgYW5kIHF1aXQgaWYgZGV0ZWN0ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrUGFyZW50UHJvY2VzcygpO1xuICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudDonLCByZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdC5mb3VuZEJyb3dzZXIpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgY2hlY2tQYXJlbnQ6IFRoZSBhcHAgd2FzIHN0YXJ0ZWQgZGlyZWN0bHkgZnJvbSBhIGJyb3dzZXInKTtcbiAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveFN5bmMoV2luZG93SGFuZGxlci5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUZXJtaW5hdGUgUHJvZ3JhbScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VuZXJsYXVidGVyIFByb2dyYW1tc3RhcnQgYXVzIGVpbmVtIFdlYmJyb3dzZXIgZXJrYW5udC5cXG5OZXh0LUV4YW0gd2lyZCBiZWVuZGV0IScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlO1xuICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdtYWluIEAgY2hlY2twYXJlbnQ6IFBhcmVudCBQcm9jZXNzIENoZWNrIE9LJyk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudCBlcnJvcjonLCBlcnJvcik7XG4gICAgfVxufVxuXG5hcHAud2hlblJlYWR5KClcbi50aGVuKGFzeW5jICgpPT57XG5cbiAgICBuYXRpdmVUaGVtZS50aGVtZVNvdXJjZSA9ICdsaWdodCcgIC8vIHByZXZlbnQgdGhlbWUgc2V0dGluZ3MgZnJvbSBiZWluZyBhZG9wdGVkIGZyb20gd2luZG93c1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0VXNlckFnZW50KGBOZXh0LUV4YW0vJHtjb25maWcudmVyc2lvbn0gKCR7Y29uZmlnLmluZm99KSAke3Byb2Nlc3MucGxhdGZvcm19YCk7ICAvLyBzZXQgdXNlciBhZ2VudCBmb3IgYWxsIHNlc3Npb25zXG4gICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRDZXJ0aWZpY2F0ZVZlcmlmeVByb2MoKHJlcXVlc3QsIGNhbGxiYWNrKSA9PiB7IGNhbGxiYWNrKDApOyB9KTsgICAvLyBzZXQgY2VydGlmaWNhdGUgdmVyaWZpY2F0aW9uIGdsb2JhbGx5IGZvciBhbGwgc2Vzc2lvbnNcbiAgICBcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKHRydWUpO1xuICAgXG4gICAgLyoqKioqKiogQ3JlYXRlIG1haW4gd2luZG93ICoqKioqKiovXG4gICAgV2luZG93SGFuZGxlci5jcmVhdGVNYWluV2luZG93KClcblxuXG4gICAgaWYgKGNvbmZpZy5ob3N0aXAgPT0gXCIxMjcuMC4wLjFcIikgeyBjb25maWcuaG9zdGlwID0gZmFsc2UgfVxuICAgIGlmIChjb25maWcuaG9zdGlwKSB7IG11bHRpY2FzdENsaWVudC5pbml0KGNvbmZpZy5nYXRld2F5KSAgfSAvL211bHRpY2FzdCBjbGllbnQgb25seSB0cmFja3Mgb3RoZXIgZXhhbSBpbnN0YW5jZXMgb24gdGhlIG5ldHdvcmtcblxuICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGlkZXMgbGVnYWN5IHRyYXlcbiAgICBpZiAoIWNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgIHBvd2VyU2F2ZUJsb2NrZXIuc3RhcnQoJ3ByZXZlbnQtZGlzcGxheS1zbGVlcCcpICAgLy8gcHJldmVudCB0aGUgZGV2aWNlIGZyb20gZ29pbmcgdG8gc2xlZXBcbiAgICAgICAgaWYgKGFsbG93VHJheSkgeyB1cGRhdGVTeXN0ZW1UcmF5KCdkZScpOyB9ICAgICAgICAvLyBza2lwIHRyYXkgb24gR05PTUVcbiAgICAgICAgZWxzZSB7IGxvZy5pbmZvKCdtYWluIEAgdHJheTogR05PTUUgZGV0ZWN0ZWQsIHNraXBwaW5nIHN5c3RlbSB0cmF5Jyk7IH1cbiAgICAgICAgcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCk7ICAvLyB0aGlzIGNoZWNrcyBpZiB0aGUgYXBwIHdhcyBzdGFydGVkIGZyb20gd2l0aGluIGEgYnJvd3NlciAoZGlyZWN0bHkgYWZ0ZXIgZG93bmxvYWQpXG4gICAgfVxuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtHJywgKCkgPT4geyAgaWYgKGdsb2JhbCAmJiBnbG9iYWwuZ2MpeyBnbG9iYWwuZ2Moe3R5cGU6J21heW9yJyxleGVjdXRpb246ICdhc3luYyd9KTsgZ2xvYmFsLmdjKHt0eXBlOidtaW5vcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7ICB9fSk7XG4gICAgICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgfVxuXG4gICAgLy90aGVzZSBhcmUgc29tZSBzaG9ydGN1dHMgd2UgdHJ5IHRvIGNhcHR1cmVcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdGNScsICgpID0+IHt9KTsgIC8vcmVsb2FkIHBhZ2VcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrRjQnLCAoKSA9PiB7fSk7ICAvL2V4aXQgYXBwXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVycsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtRJywgKCkgPT4ge30pOyAgLy9xdWl0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrRCcsICgpID0+IHt9KTsgIC8vc2hvdyBkZXNrdG9wXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrTCcsICgpID0+IHt9KTsgIC8vbG9ja3NjcmVlblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1AnLCAoKSA9PiB7fSk7ICAvL2NoYW5nZSBzY3JlZW4gbGF5b3V0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcbn0pXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnOyAgLy8gbm9kZSBub3QgdnVlIChyZWxhdGl2ZSBwYXRoIG5lZWRlZClcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG4vKipcbiAqIFNUT1JFUyBBTEwgQ0xJRU5UL1NlcnZlciBJTkZPUk1BVElPTlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgbGlzdGVucyBmb3IgbXVsaXRjYXN0IG1lc3NhZ2VzXG4gKi9cblxuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSBjb25maWcubXVsdGljYXN0U2VydmVyQWRyclxuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMuY2xpZW50aW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IFwiRGVtb1VzZXJcIixcbiAgICAgICAgICAgIHRva2VuOiBmYWxzZSxcbiAgICAgICAgICAgIGlwOiBmYWxzZSwgIC8vIGlwIGFkZHJlc3Mgd2lyZCB2b20gbXVsdGljYXN0c2VydmVyIHRlYWNoZXIgbWl0IGdlc2NoaWNrdFxuICAgICAgICAgICAgaG9zdG5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2VydmVyaXA6IGZhbHNlLCAgIC8vIHdpcmQgbG9rYWwgZ2VzZXR6dCAoaXN0IGFiZXIgbG9naXNjaGVyd2Vpc2UgZ2xlaWNoIGRlciBpcCBkZXMgbXVsdGljYXN0c2VydmVycylcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IGZhbHNlLFxuICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgICAgICBleGFtdHlwZSA6IGZhbHNlLFxuICAgICAgICAgICAgcGluOiBmYWxzZSxcbiAgICAgICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICAgICAgbXNvZmZpY2VzaGFyZTogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDQwMDAsICAgLy9taWxsaXNlY29uZHNcbiAgICAgICAgICAgIHByaW50cmVxdWVzdCA6IGZhbHNlLFxuICAgICAgICAgICAgcHJpdmF0ZVNwZWxsY2hlY2s6IHthY3RpdmF0ZWQ6IGZhbHNlfSxcbiAgICAgICAgICAgIGxvY2FsTG9ja2Rvd246IGZhbHNlLFxuICAgICAgICAgICAgZ3JvdXA6ICdhJyxcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IDBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBhbmQgcmVhY3RzIG9uIGluZm9ybWF0aW9uIGdpdmVuIGJ5IHRoZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKSAgLy8gbW92aW5nIHRoaXMgaGVyZSB3aWxsIGFsbG93IHRvIHJlc3Bhd24gaXQgaWYgYmluZGluZyBmYWlsc1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5iaW5kKHRoaXMuUE9SVCwgJzAuMC4wLjAnLCAgKCkgPT4geyBcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRNdWx0aWNhc3RUVEwoMTI4KTsgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2F0ZXdheSkge3RoaXMuY2xpZW50LmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUil9IC8vIGVzIGlzdCBmXHUwMEZDciBlaW4gdmVybFx1MDBFNHNzbGljaGVzIG11bHRpY2FzdCBzaW5udm9sbCBkZXIgZ3J1cHBlIGJlaXp1dHJldGVuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm1jY2xpZW50OiBObyBHYXRld2F5ISBTdGFydGluZyBNdWx0aWNhc3RDbGllbnQgd2l0aG91dCBhZGRpbmcgZ3JvdXAgbWVtYmVyc2hpcFwiKX1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLmNsaWVudC5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7IFxuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWxpdGNhc3RjbGllbnQgQCBpbml0OiAke2V9YCkgXG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcbiBcbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgXG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnJlYWNoYWJsZSA9IHRydWVcbiAgICAgICAgc2VydmVySW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vcmVjb3JkIHRpbWVzdGFtcCBvZiBsYXN0IG1lc3NhZ2UgZnJvbSBzZXJ2ZXIgKGlnbm9yZSBzZXJ2ZXJ0aW1lc3RhbXAgYmVjYXVzZSBpdCBtYXkgaGF2ZSBhIGRpZmZlcmVudCBzeXN0ZW0gdGltZSlcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmlzTmV3RXhhbUluc3RhbmNlKHNlcnZlckluZm8pKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgbWVzc2FnZVJlY2VpdmVkOiBBZGRpbmcgbmV3IEV4YW0gSW5zdGFuY2UgXCIke3NlcnZlckluZm8uc2VydmVybmFtZX1cIiB0byBTZXJ2ZXJsaXN0YClcbiAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QucHVzaChzZXJ2ZXJJbmZvKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHRoZSBtZXNzYWdlIGNhbWUgZnJvbSBhIG5ldyBleGFtIGluc3RhbmNlIG9yIGFuIG9sZCBvbmUgdGhhdCBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBpc05ld0V4YW1JbnN0YW5jZSAob2JqKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbVNlcnZlckxpc3RbaV0uaWQgPT09IG9iai5pZCkge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oJ2V4aXN0aW5nIHNlcnZlciAtIHVwZGF0aW5nIHRpbWVzdGFtcCcpXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG5cbiAgICAgICAgICAgIGlmIChub3cgLSAxNjAwMCA+IHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYG11bHRpY2FzdGNsaWVudCBAIGlzRGVwcmVjYXRlZEluc3RhbmNlOiBSZW1vdmluZyBpbmFjdGl2ZSBzZXJ2ZXIgJyR7dGhpcy5leGFtU2VydmVyTGlzdFtpXS5zZXJ2ZXJuYW1lfScgZnJvbSBsaXN0YClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnNwbGljZShpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVsdGljYXN0Q2xpZW50KClcbiIsICJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuXG5leHBvcnQgY2xhc3MgU2NoZWR1bGVyU2VydmljZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICBhY3Rpb246ICgpID0+IHZvaWQ7XG4gICAgaGFuZGxlOiBOb2RlSlMuVGltZXI7XG4gICAgaW50ZXJ2YWw6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFjdGlvbjogKCkgPT4gdm9pZCwgbXM6IG51bWJlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBtcztcbiAgICAgICAgdGhpcy5hZGRMaXN0ZW5lcigndGltZW91dCcsIHRoaXMuYWN0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5lbWl0KCd0aW1lb3V0JyksIHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBCcm93c2VyVmlldywgZGlhbG9nLCBzY3JlZW59IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnMsIGVuYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZydcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IHsgYWN0aXZlV2luZG93IH0gZnJvbSAnZ2V0LXdpbmRvd3MnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQge2ZpbGVVUkxUb1BhdGh9IGZyb20gXCJub2RlOnVybFwiO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cblxuXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gV2luZG93IGhhbmRsaW5nIChpcGNSZW5kZXJlciBQcm9jZXNzIC0gRnJvbnRlbmQpIFNUQVJUXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuXG5jbGFzcyBXaW5kb3dIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja1dpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMubWFpbndpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2VydmVkIGRpc3BsYXkgSUQgZm9yIGV4YW0gd2luZG93IChzZXQgaW1tZWRpYXRlbHkgd2hlbiB3aW5kb3cgaXMgY3JlYXRlZClcbiAgICAgIHRoaXMuc3BsYXNod2luID0gbnVsbFxuICAgICAgdGhpcy5iaXB3aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgIFxuICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgZXhpdCB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgZXhpdCBxdWVzdGlvbiBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIG1pbmltaXplIHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICB9XG5cbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy53aW5kb3dUcmFja2VyLmJpbmQodGhpcyksIDEwMDApXG4gICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgIH1cblxuICAgIC8vIHJldHVybiBlbGVjdHJvbiB3aW5kb3cgaW4gZm9jdXMgb3IgYW4gb3RoZXIgZWxlY3Ryb24gd2luZG93IGRlcGVuZGluZyBvbiB0aGUgaGllcmFjaHlcbiAgICBnZXRDdXJyZW50Rm9jdXNlZFdpbmRvdygpIHtcbiAgICAgICAgY29uc3QgZm9jdXNlZFdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICAgICAgICBpZiAoZm9jdXNlZFdpbmRvdykge1xuICAgICAgICAgIHJldHVybiBmb2N1c2VkV2luZG93XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zY3JlZW5sb2NrV2luZG93KXtyZXR1cm4gdGhpcy5zY3JlZW5sb2NrV2luZG93fVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5leGFtd2luZG93KXtyZXR1cm4gdGhpcy5leGFtd2luZG93fVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5tYWlud2luZG93KXtyZXR1cm4gdGhpcy5tYWlud2luZG93fVxuICAgICAgICAgICAgZWxzZSB7IHJldHVybiBmYWxzZSB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpIHtcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTAwMCxcbiAgICAgICAgICAgIGhlaWdodDo4MDAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwiZGlkLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2lsbC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7ICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGxvZy5pbmZvKFwibmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ0YXJnZXQ6IF9ibGFua1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtcmVkaXJlY3QnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ1JlZGlyZWN0aW5nIHRvOicsIHVybCk7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgZGllIFVSTCBkYXMgZ2V3XHUwMEZDbnNjaHRlIEZvcm1hdCBoYXRcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnYmlsZHVuZ3Nwb3J0YWw6Ly8nKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcnQgZGVuIFN0YW5kYXJkLVJlZGlyZWN0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gJ2JpbGR1bmdzcG9ydGFsOi8vdG9rZW49JztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdXJsLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8odG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiaXBUb2tlbicsIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiB0aGlzIGlzIGFuIGVhc3RlciBlZ2dcbiAgICAgKi9cbiAgICBjcmVhdGVFYXN0ZXJXaW4oKSB7XG4gICAgICAgIHRoaXMuZWFzdGVyd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDc2OCxcbiAgICAgICAgICAgIGhlaWdodDo0ODAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi5sb2FkRmlsZShqb2luKF9fZGlybmFtZSwgYC4uLy4uL3B1YmxpYy9jb3dzb25pY2UvaW5kZXguaHRtbGApKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgbGV0IHVybCA9IFwibm90Zm91bmRcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRGaWxlKHBhdGgsIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJsb2Nrd2luLnJlbW92ZU1lbnUoKSBcbiAgICAgICAgYmxvY2t3aW4uc2V0TWluaW1pemFibGUoZmFsc2UpXG5cbiAgICAgICAgLy8gUG9zaXRpb24gd2luZG93IG9uIHNwZWNpZmljIGRpc3BsYXkgQkVGT1JFIHNob3dpbmcgaXRcbiAgICAgICAgYmxvY2t3aW4uc2V0Qm91bmRzKHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLngsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55LFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYmxvY2t3aW4uc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgIGJsb2Nrd2luLnNob3coKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTtcbiAgICAgICAgICAgIGJsb2Nrd2luLm9uKCdsZWF2ZS1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpOyAvLyBzb2ZvcnQgd2llZGVyIHp1clx1MDBGQ2Nrc2V0emVuXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgIH0gIFxuICAgICAgICBlbHNlIHsgICBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEtpb3NrKHRydWUpOyAvLyBLaW9zayA9IFwidGFrZSBvdmVyIG1haW4gc2NyZWVuXCIuIG9uIG1hY29zIHRoYXQncyB3aHkgd2UgdXNlIGZ1bGxTY3JlZW4gd29ya2Fyb3VuZCB3aXRoIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIH1cbiAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICBibG9ja3dpbi5kaXNwbGF5ID0gZGlzcGxheVxuICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5wdXNoKGJsb2Nrd2luKVxuICAgIH1cblxuXG4gICAgLy8gYmxvY2sgYWxsIHNjcmVlbnMgd2l0aCBhIGJsb2Nrd2luZG93XG4gICAgYXN5bmMgaW5pdEJsb2NrV2luZG93cygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAvL2xvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZm91bmQgJHtkaXNwbGF5cy5sZW5ndGh9IGRpc3BsYXlzYClcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgIC8vIGxvY2sgYWxsIHNjcmVlbnNcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGV4YW0gd2luZG93IHRvIGJlIHZpc2libGUgYW5kIHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0cmllcyA9IDBcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTBcbiAgICAgICAgICAgICAgICB3aGlsZSAoIXRoaXMuZXhhbXdpbmRvdy5pc1Zpc2libGUoKSAmJiByZXRyaWVzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMClcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllcysrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFkZGl0aW9uYWwgd2FpdCB0byBlbnN1cmUgcG9zaXRpb25pbmcgaXMgY29tcGxldGUgb24gV2F5bGFuZFxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgYmxvY2sgd2luZG93cyBmcm9tIGFycmF5XG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IHRoaXMuYmxvY2t3aW5kb3dzLmZpbHRlcihibG9ja3dpbiA9PiBibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGFsbCBleGlzdGluZyB3aW5kb3dzIGFuZCBkZXRlcm1pbmUgdGhlaXIgZGlzcGxheXNcbiAgICAgICAgICAgIGNvbnN0IHVzZWREaXNwbGF5SWRzID0gbmV3IFNldCgpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpcnN0LCB1c2UgdGhlIHJlc2VydmVkIGV4YW0gZGlzcGxheSBJRCAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gZXhhbSB3aW5kb3cgd2FzIGNyZWF0ZWQpXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIHNjcmVlbiBpcyByZXNlcnZlZCBldmVuIGlmIHRoZSB3aW5kb3cgaXNuJ3QgZnVsbHkgaW5pdGlhbGl6ZWQgeWV0XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtRGlzcGxheUlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHRoaXMuZXhhbURpc3BsYXlJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWx3YXlzIGV4Y2x1ZGUgcHJpbWFyeSBkaXNwbGF5IChleGFtIHdpbmRvdyBsb2NhdGlvbilcbiAgICAgICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmIChwcmltYXJ5RGlzcGxheSAmJiBwcmltYXJ5RGlzcGxheS5pZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChwcmltYXJ5RGlzcGxheS5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgZXhhbSB3aW5kb3cgZGlzcGxheSAoYXMgZmFsbGJhY2svdmVyaWZpY2F0aW9uLCBidXQgcmVzZXJ2ZWQgSUQgdGFrZXMgcHJpb3JpdHkpXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGV4YW0gd2luZG93IGlzIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgZXhhbSB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGJsb2NrIHdpbmRvd3MgZGlzcGxheXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmxvY2t3aW4gb2YgdGhpcy5ibG9ja3dpbmRvd3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBibG9ja3dpbi5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGJsb2NrIHdpbmRvdyBmb3VuZCBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGJsb2NrIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIGJsb2NrIHdpbmRvd3MgZm9yIGRpc3BsYXlzIHRoYXQgZG9uJ3QgaGF2ZSBleGFtIG9yIGJsb2NrIHdpbmRvd3NcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIGlmICh1c2VkRGlzcGxheUlkcy5oYXMoZGlzcGxheS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBza2lwcGluZyBkaXNwbGF5ICR7ZGlzcGxheS5pZH0gLSBhbHJlYWR5IGhhcyBleGFtIG9yIGJsb2NrIHdpbmRvd2ApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGNyZWF0ZSBibG9ja3dpbiBvbjpcIixkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgIHRoaXMubmV3QmxvY2tXaW4oZGlzcGxheSkgIC8vIGFkZCBibG9ja3dpbmRvd3MgZm9yIGRpc3BsYXlzIHdpdGhvdXQgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MuZm9yRWFjaCggKGJsb2Nrd2luKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU2NyZWVubG9jayBXaW5kb3cgKHRvIGNvdmVyIHRoZSBtYWluc2NyZWVuKSAtIGJsb2NrIHN0dWRlbnRzIGZyb20gd29ya2luZ1xuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIGNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkge1xuICAgICAgICBsZXQgc2NyZWVubG9ja1dpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogdGhpcy5tYWlud2luZG93LCAgIC8vIGxlYWRzIHRvIHZpc2libGUgdGl0bGViYXIgaW4gZ25vbWUtZGVza3RvcFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnU2NyZWVubG9jaycsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgLy9mb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHVybCA9IFwibG9ja1wiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgbGV0IHBhdGggPSBqb2luKF9fZGlybmFtZSwgYC4uL3JlbmRlcmVyL2luZGV4Lmh0bWxgKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkRmlsZShwYXRoLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICAvLyBBZGQgd2luZG93IHRvIGFycmF5IGZpcnN0LCBiZWZvcmUgYWRkaW5nIGJsdXIgbGlzdGVuZXJcbiAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5wdXNoKHNjcmVlbmxvY2tXaW5kb3cpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzY3JlZW5sb2NrV2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJwb3AtdXAtbWVudVwiLCAxKSAgIC8vYWJvdmUgZXhhbSB3aW5kb3cgKHBvcC11cC1tZW51LCAwKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRDbG9zYWJsZSh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUpOyAvLyBwdXQgdGhlIHdpbmRvdyBvbiBhbGwgdmlydHVhbCB3b3Jrc3BhY2VzXG4gICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcihcInNjcmVlbmxvY2tcIilcbiAgICAgICAgfSlcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfSAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHsgICAvLyByZW1vdmUgd2luZG93IGZyb20gYXJyYXkgd2hlbiBhY3R1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmIHdpbiAhPT0gc2NyZWVubG9ja1dpbmRvdyAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBFeGFtd2luZG93XG4gICAgICogQHBhcmFtIGV4YW10eXBlIGVkdXZpZHVhbCwgbWF0aCwgbGFuZ3VhZ2VcbiAgICAgKiBAcGFyYW0gdG9rZW4gc3R1ZGVudCB0b2tlblxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgY29udGFpbmluZyBpbmZvIGFib3V0IHNwZWxsY2hlY2sgbGFuZ3VhZ2UgZXRjLiBcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVFeGFtV2luZG93KGV4YW10eXBlLCB0b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5ZGlzcGxheSkge1xuICAgICAgICAvLyBqdXN0IHRvIGJlIHN1cmUgd2UgY2hlY2sgc29tZSBpbXBvcnRhbnQgdmFycyBoZXJlXG4gICAgICAgIGlmIChleGFtdHlwZSAhPT0gXCJyZHBcIiAmJiBleGFtdHlwZSAhPT0gXCJ3ZWJzaXRlXCIgJiYgIGV4YW10eXBlICE9PSBcImdmb3Jtc1wiICYmIGV4YW10eXBlICE9PSBcImVkdXZpZHVhbFwiICYmIGV4YW10eXBlICE9PSBcImVkaXRvclwiICYmIGV4YW10eXBlICE9PSBcIm1hdGhcIiAmJiBleGFtdHlwZSAhPT0gXCJtaWNyb3NvZnQzNjVcIiAmJiBleGFtdHlwZSAhPT0gXCJhY3RpdmVzaGVldHNcIiB8fCAhdG9rZW4peyAgLy8gZm9yIG5vdy4uIHdlIHByb2JhYmx5IHNob3VsZCBzdG9wIGV2ZXJ5dGhpbmcgaGVyZVxuICAgICAgICAgICAgbG9nLndhcm4oXCJtaXNzaW5nIHBhcmFtZXRlcnMgZm9yIGV4YW0tbW9kZSBvciBtb2RlIG5vdCBpbiBhbGxvd2VkIGxpc3QhXCIpXG4gICAgICAgICAgICBleGFtdHlwZSA9IFwiZWRpdG9yXCIgXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICAvLyBBbHdheXMgdXNlIHByaW1hcnkgZGlzcGxheSBmb3IgZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzIHx8ICFwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gZGlzcGxheXNbMF0gfHwgcHJpbWFyeWRpc3BsYXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gSW1tZWRpYXRlbHkgcmVzZXJ2ZSB0aGUgZGlzcGxheSBJRCBmb3IgdGhlIGV4YW0gd2luZG93IChiZWZvcmUgd2luZG93IGlzIGZ1bGx5IGluaXRpYWxpemVkKVxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIGJsb2NrIHdpbmRvd3MgZnJvbSBiZWluZyBjcmVhdGVkIG9uIHRoZSBzYW1lIHNjcmVlblxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IHByaW1hcnlkaXNwbGF5LmlkXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IHJlc2VydmluZyBkaXNwbGF5ICR7dGhpcy5leGFtRGlzcGxheUlkfSBmb3IgZXhhbSB3aW5kb3dgKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgcHggPSAwXG4gICAgICAgIGxldCBweSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcyAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCkge1xuICAgICAgICAgICAgcHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueFxuICAgICAgICAgICAgcHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogcHggKyAwLFxuICAgICAgICAgICAgeTogcHkgKyAwLFxuICAgICAgICAgICAgdGl0bGU6ICdFeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiAxNDQwLFxuICAgICAgICAgICAgaGVpZ2h0OiA3NjgsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHdpbiwgIC8vdGhpcyBkb2VzbnQgd29yayB0b2dldGhlciB3aXRoIGtpb3NrIG9uIHVidW50dSBnbm9tZSA/PyB3dGZcbiAgICAgICAgICAgIC8vIG1vZGFsOiB0cnVlLCAgLy8gdGhpcyBibG9ja3MgdGhlIG1haW4gd2luZG93IG9uIHdpbmRvd3Mgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIG9wZW5cbiAgICAgICAgICAgIC8vIGNsb3NhYmxlOiBmYWxzZSwgIC8vIGlmIHdlIGNhbid0IGRlZmluZSAncGFyZW50JyB0aGlzIHdpbmRvdyBoYXMgdG8gYmUgY2xvc2FibGUgLSB3aHk/XG4gICAgICAgICAgICAvL2Fsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgb3BhY2l0eTogMSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICB2aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAga2lvc2s6IHRoaXMuY29uZmlnLmRldmVsb3BtZW50ID8gZmFsc2UgOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZXhhbXdpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZU1lbnUoKSAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvYmFibHkgbm90IG5lZWRlZCBiZWNhdXNlIHdlIGRpc2FibGUgbWlzc2lvbmNvbnRyb2wgYW55d2F5cyAtIHNlZW1zIHRvIGludGVyZmVyZSB3aXRoIGtpb3NrIG1vZGUgb24gbWFjb3MgKGFnYWluKVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLmV4YW13aW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlLCB7IHZpc2libGVPbkZ1bGxTY3JlZW46IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzV2F5bGFuZCl7IHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdGFydCgpIH0gLy8gY29uc3RhbnRseSBjaGVjayBpZiB0aGUgYWN0aXZlIHdpbmRvdyBpcyB0aGUgZXhhbXdpbmRvdyAtIGlmIG5vdCwgYnJpbmcgaXQgdG8gZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKHRoaXMpICAvLyBkaXNhYmxlIGtleWJvYXJkIHNob3J0Y3V0cyBldGMuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAvLyBkbyBub3Qgc2V0IGJsdXIgbGlzdGVuZXIgdG9vIGVhcmx5XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKCkgIC8vIGFkZCBibHVyIGxpc3RlbmVyIHRvIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgZGlkLWZpbmlzaC1sb2FkOiBlcnJvciBpbiBleGFtd2luZG93IHNldHVwXCIsIGUpfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cyAvL3dlIGtlZXAgaXQgdGhlcmUgdG8gbWFrZSBpdCBhY2Nlc3NhYmxlIHZpYSBleGFtd2luZG93IGluIGlwY0hhbmRsZXJcbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQgPSA5NCAgIC8vIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgY29udGVudCB2aWV3XG4gICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNaWNyb3NvZnQgMzY1IGVtZWJlZHMgaXRzIGVkaXRvciBpbiBhbiBpZnJhbWUgd2l0aCBhY3RpdmUgQ29udGVudCBTZWN1cml0eSBQb2xpY3kgKENTUClcbiAgICAgICAgICogVGhlIG9ubHkgd2F5IHRvIGJlIGFibGUgdG8gaW5qZWN0IGNvZGUgaXMgdG8gbG9hZCBpdCBkaXJlY3RseSBpbiB0aGUgbWFpbiB3aW5kb3cgPGVtYmVkPiA8aWZyYW1lPiBvciBldmVuIDx3ZWJ2aWV3PiBvZmZlcnMgbm8gd29ya2Fyb3VuZFxuICAgICAgICAgKiB0aGVyZWZvcmUgd2UgdXNlIFwiQnJvd3NlclZpZXdcIiBpbiBvcmRlciB0byBkaXNwbGF5IHR3byBwYWdlcyBpbiBvbmUgd2luZG93OiBvbiB0b3AgPiBleGFtIGhlYWRlciwgb24gYm90dG9tID4gb2ZmaWNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlmIChleGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIiAgKSB7IC8vZXh0ZXJuYWwgcGFnZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJzdGFydGluZyBtaWNyb3NvZnQzNjUgZXhhbS4uLlwiKVxuICAgICAgICAgICAgbGV0IHVybHZpZXcgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgICBcbiAgICAgICAgICAgIGlmICghdXJsdmlldykgey8vIHdlIHdhaXQgZm9yIHRoZSBuZXh0IHVwZGF0ZSB0aWNrIC0gbXNvZmZpY2VzaGFyZSBuZWVkcyB0byBiZSBzZXQgISAoY291bGQgaGFwcGVuIHdoZW4gYSBzdHVkZW50IGNvbm5lY3RzIGxhdGVyIHRoZW4gZXhhbSBtb2RlIGlzIHNldCBidXQgaGlzIHNoYXJlIHVybCBuZWVkcyBzb21lIHRpbWUpXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogbm8gdXJsIGZvciBtaWNyb3NvZnQzNjUgd2FzIHNldCB5ZXQgLSB3YWl0aW5nIGZvciBuZXh0IHVwZGF0ZSB0aWNrXCIpXG4gICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBkZXN0cm95ZWRcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbG9hZCB0b3AgbWVudSBpbiBNYWluUGFnZVxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgZWR1dmlkdWFsIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBiYWNrZ3JvdW5kdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vJHt0b2tlbn0vYFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkVVJMKGJhY2tncm91bmR1cmwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRGVmaW5lIHRoZSBNYWluQ29udGVudFBhZ2Ugdmlld1xuICAgICAgICAgICAgbGV0IGNvbnRlbnRWaWV3ID0gbmV3IEJyb3dzZXJWaWV3KHtcbiAgICAgICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsICBcbiAgICAgICAgICAgICAgICAgIGNvbnRleHRJc29sYXRpb246IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCkud2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCkuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0QXV0b1Jlc2l6ZSh7IHdpZHRoOiB0cnVlLCBoZWlnaHQ6IHRydWUsIGhvcml6b250YWw6IHRydWUsIHZlcnRpY2FsOiB0cnVlIH0pO1xuICAgICAgICAgICAgY29udGVudFZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmx2aWV3KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgICAgICAgY29udGVudFZpZXcud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgfVxuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkQnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2VudGVyLWZ1bGwtc2NyZWVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgICAgICBsZXQgbmV3Qm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ3Jlc2l6ZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgbmV3Qm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIG5vcm1hbCBleGFtIG1vZGUgKGVkaXRvciwgbWF0aCwgZWR1dmlkdWFsLCB3ZWJzaXRlLCBnZm9ybXMpXG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIGxldCB1cmwgPSBleGFtdHlwZSAgIC8vIGVkaXRvciB8fCBtYXRoIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoID0gam9pbihfX2Rpcm5hbWUsIGAuLi9yZW5kZXJlci9pbmRleC5odG1sYClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUocGF0aCwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZSBzcGVjaWFsIE5BVklHQVRJT04gc2l0dWF0aW9uc1xuICAgICAgICAgKi9cblxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIEZvcm1zLCBXZWJzaXRlLCBFZHV2aWR1YWwsIEVkaXRvciwgUkRQLCBNaWNyb3NvZnQzNjVcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgLy8gQmxvY2sgbmF2aWdhdGlvbiBvbiBleGFtd2luZG93LndlYkNvbnRlbnRzIGxldmVsIGZvciBhbGwgbW9kZXMgdGhhdCBjYW4gZGlzcGxheSBQREZzIGluIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBuYXZpZ2F0aW9uIHdoZW4gY2xpY2tpbmcgbGlua3MgaW4gUERGcyBkaXNwbGF5ZWQgaW4gdGhlIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gV2Vidmlldy9Ccm93c2VyVmlldyBibG9ja2luZyBpcyBoYW5kbGVkIHNlcGFyYXRlbHkgdmlhIElQQyBpbiBpcGNoYW5kbGVyLmpzIG9yIG1vZGUtc3BlY2lmaWMgaGFuZGxlcnMgYmVsb3dcbiAgICAgICAgY29uc3QgZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyID0gW1wiZ2Zvcm1zXCIsIFwid2Vic2l0ZVwiLCBcImVkdXZpZHVhbFwiLCBcImVkaXRvclwiLCBcInJkcFwiLCBcIm1pY3Jvc29mdDM2NVwiLCBcImFjdGl2ZXNoZWV0c1wiLCBcIm1hdGhcIl07XG4gICAgICAgIGlmIChleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIuaW5jbHVkZXMoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIFZ1ZSBhcHAgKGUuZy4gZnJvbSBQREYgbGlua3MgaW4gZXhhbWhlYWRlcilcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IG5ldyB3aW5kb3dzIGZyb20gb3BlbmluZyBpbiB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBuZXctd2luZG93XCIsIHVybCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICBcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIHNldFdpbmRvd09wZW5IYW5kbGVyXCIsIHVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgTWljcm9zb2Z0IEV4Y2VsL1dvcmRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIil7ICAvLyBkbyBub3QgdW5kZXIgYW55IGNpcmN1bXN0YW5jZXMgYWxsb3cgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGN1cnJlbnQgZXhhbSB1cmxcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YW50cyB0byBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyBwYWdlXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImRvIG5vdCBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyB0ZXN0Li4gXCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICBcbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRlQ29kZSA9ICBgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGxvY2soKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICdXQUNEaWFsb2dPdXRlckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ0lubmVyQ29udGFpbmVyJywnV0FDRGlhbG9nUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGlkZXVzQnlJRCA9IFsnU2hvd0hpZGVFcXVhdGlvblRvb2xzUGFuZScsJ0xpbmtHcm91cCcsJ0dyYXBoaWNzRWRpdG9yJywnSW5zZXJ0VGFibGVPZkNvbnRlbnRzSW5JbnNlcnRUYWInLCdJbnNlcnRPbmxpbmV2aWRlbycsJ1BpY3R1cmUnLCdSaWJib24tUGljdHVyZU1lbnVNTFJEcm9wZG93bicsJ0luc2VydEFkZEluRmx5b3V0JywnRGVzaWduZXInLCdFZGl0b3InLCdGYXJQYW5lJywnSGVscCcsJ0luc2VydEFwcHNGb3JPZmZpY2UnLCdGaWxlTWVudUxhdW5jaGVyQ29udGFpbmVyJywnSGVscC13cmFwcGVyJywnUmV2aWV3LXdyYXBwZXInLCdIZWFkZXInLCdGYXJQZXJpcGhlcmFsQ29udHJvbHNDb250YWluZXInLCdCdXNpbmVzc0JhciddXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGVudHJ5IG9mIGhpZGV1c0J5SUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudHJ5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImRpc3BsYXlcIiwgXCJub25lXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJ1dHRvbkFwcHNPdmVyZmxvdyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdBZGQtSW5zJylbMF07ICAvLyB0aGlzIGJ1dHRvbiBpcyByZWRyYXduIG9uIHJlc2l6ZSAoZG9lc24ndCBoYXBwZW4gaW4gZXhhbSBtb2RlIGJ1dCBzdGlsbCB0aGVyZSBtdXN0IGJlIGEgY2xlYW5lciB3YXkgLSBpbnNlcnRpbmcgY3NzIGJlZm9yZSBpdCBhcHBlYXJzIGlzIG5vdCB3b3JraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1dHRvbkFwcHNPdmVyZmxvdyl7IGJ1dHRvbkFwcHNPdmVyZmxvdy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlN1Y2hlblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlx1MDBEQ2JlcnNldHplblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkNvcGlsb3RcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQWRkLUluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBDb250ZXh0TWVudVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwU3lub255bXNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUmliYm9uLVJlZmVyZW5jZXNTbWFydExvb2tVcFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkRpY3RhdGlvblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiR2V0QWRkaW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJQaWN0dXJlc19NTFJcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2NrKCkgIC8vZm9yIHNvbWUgcmVhc29uIGV4Y2VsIGRlbGF5cyB0aGF0IGNhbGwuLiBkb2VzbnQgaGFwcGVuIG9uIHBhZ2UgZmluaXNoIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgYFxuXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGVySW5zdGFuY2UgPSBudWxsXG4gICAgICAgICAgICB0aGlzLmxvY2tDYWxsYmFjayA9ICgpID0+IHRoaXMubG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKTsgXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZSA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMubG9ja0NhbGxiYWNrLCA0MDApXG4gICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBzY2hlZHVsZXJJbnN0YW5jZVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RhcnQoKVxuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgd2ViQ29udGVudHMgaXMgZnVsbHkgbG9hZGVkICAvLyB0aGlzIGlzIG5vdCB3b3JraW5nIHJlbGlhYmx5IGJlY2F1c2UgdGhlIHBhZ2UgaXMgbG9hZGVkIGluIG1hbnkgc3RlcHMgYW5kIHRoZSB1aSBlbGVtZW50cyBhcmUgbm90IGF2YWlsYWJsZSB5ZXRcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignYXBwLWNvbW1hbmQnLCAoZSwgY21kKSA9PiB7XG4gICAgICAgICAgICAvLyAnYnJvd3Nlci1iYWNrd2FyZCcgdW5kICdicm93c2VyLWZvcndhcmQnIHNpbmQgZGllIEJlZmVobGUsIGRpZSBiZWltIEtsaWNrIGF1ZiBkaWUgTWF1c3Rhc3RlbiBnZXNlbmRldCB3ZXJkZW5cbiAgICAgICAgICAgIGlmIChjbWQgPT09ICdicm93c2VyLWJhY2t3YXJkJyB8fCBjbWQgPT09ICdicm93c2VyLWZvcndhcmQnKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJubyBuYXZpZ2F0aW9uIGFsbG93ZWRcIilcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcm4gU2llIGRhcyBTdGFuZGFyZHZlcmhhbHRlblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIC8vZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpICAvL2RvIG5vdCBkaXNhYmxlIHR3aWNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBsb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2Upe1xuICAgICAgICBpZiAoYnJvd3NlclZpZXcud2ViQ29udGVudHMgJiYgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lKXtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiLCBmcmFtZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChmcmFtZSAmJiAoZnJhbWUubmFtZSA9PT0gJ1dlYkFwcGxpY2F0aW9uRnJhbWUnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9Xb3JkXzAnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9FeGNlbF8wJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogc3RvcHBpbmcgbG9ja1NjaGVkdWxlclwiKVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RvcCgpXG4gICAgICAgICAgICBpZiAodGhpcy5sb2NrU2NoZWR1bGVyID09PSBzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBubyBicm93c2VyVmlldyBvciBsb2NrU2NoZWR1bGVyIGZvdW5kXCIpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIFxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBNQUlOIFdJTkRPV1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgYXN5bmMgY3JlYXRlTWFpbldpbmRvdygpIHtcbiAgICAgICAgbGV0IHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpO1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClbMF1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdpbmRvdyBkaW1lbnNpb25zIC0gZGVmaW5lZCBvbmNlLCB1c2VkIGV2ZXJ5d2hlcmVcbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSAxMDI0XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IDY0MFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBjZW50ZXIgcG9zaXRpb24gb24gcHJpbWFyeSBkaXNwbGF5XG4gICAgICAgIGxldCB4ID0gMFxuICAgICAgICBsZXQgeSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgeCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLndpZHRoIC0gd2luZG93V2lkdGgpIC8gMilcbiAgICAgICAgICAgIHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueSArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy5oZWlnaHQgLSB3aW5kb3dIZWlnaHQpIC8gMilcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTWFpbiB3aW5kb3cnLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICB5OiB5LFxuICAgICAgICAgICAgd2lkdGg6IHdpbmRvd1dpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB3aW5kb3dIZWlnaHQsXG4gICAgICAgICAgICBtaW5XaWR0aDogODUwLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiA2MDAsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRhcyBcdTAwQzRuZGVybiBkZXIgR3JcdTAwRjZcdTAwREZlICBcbiAgICAgICAgICAgIGZ1bGxzY3JlZW5hYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkZW4gVm9sbGJpbGRtb2R1cyAtIHdpY2h0aWcgZlx1MDBGQ3IgbWFjb3MgZGVubiB3ZW5uIGF1ZiBtYWNvcyBkYXMgbWFpbndpbmRvdyBhdWYgZnVsbHNjcmVlbiBpc3QgZ3JlaWZ0IGJlaW0gZXhhbXdpbmRvdyBkZXIga2lvc2sgbW9kZSBuaWNodCAgLSBlbGVjdHJvbiBidWcgKG5lZWRzIGV4YW1wbGUgY29kZSk6ID4+IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvNDQ3NTVcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICAvL3Zpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudERpcixcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgcHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OKVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZFRocm90dGxpbmc6IHRydWUgIC8vIGFsbG93IHRocm90dGxpbmcgd2hlbiB3aW5kb3cgaXMgaW4gYmFja2dyb3VuZFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzIGJlZm9yZSBsb2FkaW5nXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyBhc2sgYmVmb3JlIGNsb3NpbmdcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgIXRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQpIHsgIC8vIGFsbG93ZXhpdCBpc3QgZWluIG92ZXJyaWRlIHZvbSBjb250ZXh0IG1lbnUgb2RlciBzY3JlZW5zaG90IHRlc3QuIGRpZXNlciBrYW5uIGRpZSBhcHAgc2NobGllc3NlblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dUcmF5ID0gIXBsYXRmb3JtRGlzcGF0Y2hlci5faXNHTk9NRSgpOyAvLyBHTk9NRSBoYXMgbm8gbGVnYWN5IHRyYXlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhbGxvd1RyYXkpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IEdOT01FIGRldGVjdGVkLCBxdWl0dGluZyBpbnN0ZWFkIG9mIHRyYXkgbWluaW1pemVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyAgLy8gYWxsb3cgY2xvc2UgZmxvd1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zaG93TWluaW1pemVXYXJuaW5nKClcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBNaW5pbWl6aW5nIE5leHQtRXhhbSB0byBTeXN0ZW10cmF5YCkgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuaGlkZSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFNldCB3aW5kb3cgcHJvcGVydGllcyBpbW1lZGlhdGVseSBhZnRlciBjcmVhdGlvblxuICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5mb2N1cygpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgLy90aGlzLm1haW53aW5kb3cuc2V0SGlkZGVuSW5NaXNzaW9uQ29udHJvbCh0cnVlKVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkIHx8IHByb2Nlc3MuZW52W1wiREVCVUdcIl0pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi9yZW5kZXJlci9pbmRleC5odG1sJylcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBmaWxlOiAke2ZpbGVQYXRofWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZEZpbGUoZmlsZVBhdGgpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfWBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBVUkw6ICR7dXJsfWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgYXN5bmMgc2hvd0V4aXRXYXJuaW5nKG1lc3NhZ2Upe1xuICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnd2FybmluZycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPayddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gQmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93RXhpdFF1ZXN0aW9uKCl7XG4gICAgICAgIGlmICh0aGlzLmV4aXRRdWVzdGlvbk9wZW4pIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRpYWxvZyBhbHJlYWR5IG9wZW4sIHNraXBwaW5nXCIpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydKYScsICdOZWluJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBiZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnV29sbGVuIHNpZSBkaWUgQW53ZW5kdW5nIE5leHQtRXhhbSBiZWVuZGVuPycsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYoY2hvaWNlLnJlc3BvbnNlID09IDEpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRvIG5vdCBjbG9zZSBOZXh0LUV4YW0gYWZ0ZXIgZmluaXNoZWQgRXhhbVwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd01pbmltaXplV2FybmluZygpe1xuICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2luZm8nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ01pbmltaXplIHRvIFN5c3RlbSBUcmF5JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRGllIEFud2VuZHVuZyBOZXh0LUV4YW0gd3VyZGUgbWluaW1pZXJ0IScsXG4gICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIEFkZGl0aW9uYWwgRnVuY3Rpb25zXG4gICAgICovXG5cbiAgICBpc1dheWxhbmQoKXtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJzsgXG4gICAgfVxuXG4gICAgLy8gdGhpcyBmdW5jdGlvbiB1c2VzIGFjdGl2ZS13aW4gdG8gcmVjZWl2ZSBuYW1lIGFuZCB1cmwgZnJvbSBhY3RpdmUgd2luZG93IC0geWV0IGFub3RoZXIgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhlIGZvY3VzIGlzIHN0aWxsIG9uIG5leHRleGFtXG4gICAgLy8gdGhpcyBpcyB1c2VkIHRvIGludHJvZHVjZSBleGVtcHRpb25zIGZvciB0aGUgYmx1ciBsaXN0ZW5lclxuICAgIC8vIChkb3duZ3JhZGVkIGZyb20gZ2V0LXdpbmRvd3MgYmVjYXVzZSBvZiBuYXBpIHY5IGlzc3VlKSBodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL2dldC13aW5kb3dzL2lzc3Vlcy8xODZcbiAgICBhc3luYyB3aW5kb3dUcmFja2VyKCl7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgIC8vIGNvbnN0IGdldHdpbiA9IGF3YWl0IHRoaXMuZ2V0QWN0aXZlV2luZG93KCk7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVXaW4gPSBhd2FpdCBhY3RpdmVXaW5kb3coKVxuICAgICAgICAgXG4gICAgICAgICAgICBpZiAoYWN0aXZlV2luICYmIGFjdGl2ZVdpbi5vd25lciAmJiBhY3RpdmVXaW4ub3duZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIGxldCBuYW1lID0gYWN0aXZlV2luLm93bmVyLm5hbWVcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGggPSBhY3RpdmVXaW4ub3duZXIucGF0aFxuICAgICAgICAgICAgICAgIGxldCBuYW1lTG93ZXIgPSBuYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGhMb3dlciA9IHdwYXRoLnRvTG93ZXJDYXNlKClcblxuICAgICAgICAgICAgICAgIGlmIChuYW1lTG93ZXIuaW5jbHVkZXMoXCJleGFtXCIpIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcIm5leHRcIikgIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcImVsZWN0cm9uXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZWFzZW9mYWNjZXNzZGlhbG9nXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZGlzYWJsZS1zaG9ydGN1dHNcIikgKXsgIFxuICAgICAgICAgICAgICAgICAgICAvLyBmb2t1cyBpcyBvbiBhbGxvd2VkIHdpbmRvdyBpbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IC8vZm9jdXMgaXMgbm90IG9uIG5leHQtZXhhbSBvciBhbnkgb3RoZXIgYWxsb3dlZCB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkKXsgIC8vbG9nIGp1c3Qgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiBmb2N1cyBsb3N0IGV2ZW50IHdhcyB0cmlnZ2VyZWQuIGFwcDogJHt3cGF0aH0gLSAke25hbWV9IGApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6ICR7ZXJyfWApIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9hZGRzIGJsdXIgbGlzdGVuZXIgd2hlbiBlbnRlcmluZyBleGFtbW9kZSAgIC8vIGJsdXIgZXZlbnQgaXNudCBmaXJlZCBvbiBtYWNvcyBNSVNTSU9OQ09OVFJPTCAod2hpY2ggY2FudCBiZSBkZWFjdGl2YXRlZCBhbnltb3JlKSAtIGRhbW4geW91IGFwcGxlIVxuICAgIGFkZEJsdXJMaXN0ZW5lcih3aW5kb3cgPSBcImV4YW13aW5kb3dcIil7XG4gICAgICAgIGlmICh3aW5kb3cgPT09IFwiZXhhbXdpbmRvd1wiKXsgXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd31gKVxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnQodGhpcykpIFxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHdpbmRvdyA9PT0gXCJzY3JlZW5sb2NrXCIpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fXdpbmRvd2ApXG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIHRoaXMuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudFNjcmVlbmxvY2sodGhpcykpICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy9yZW1vdmVzIGJsdXIgbGlzdGVuZXIgd2hlbiBsZWF2aW5nIGV4YW0gbW9kZVxuICAgIHJlbW92ZUJsdXJMaXN0ZW5lcigpe1xuICAgICAgICBpZiAodGhpcy5leGFtd2luZG93KXtcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2JsdXInKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgcmVtb3ZlQmx1ckxpc3RlbmVyOiByZW1vdmluZyBibHVyIGxpc3RlbmVyXCIpXG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gaW1wbGVtZW50aW5nIGEgc2xlZXAgKHdhaXQpIGZ1bmN0aW9uXG4gICAgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgICAvL3N0dWRlbnQgZm9ndXMgd2VudCB0byBhbm90aGVyIHdpbmRvd1xuICAgIGFzeW5jIGJsdXJldmVudCh3aW5oYW5kbGVyKSB7IFxuXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudDogc3R1ZGVudCB0cmllZCB0byBsZWF2ZSBleGFtIHdpbmRvd1wiKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnbGludXgnKXtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMud2luZG93VHJhY2tlcigpICAvL2NoZWNrcyBpZiBuZXcgZm9jdXMgd2luZG93IGlzIGFsbG93ZWRcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93dHJhY2tlciBjaGVjayBkb25lLi4uXCIpXG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIHNjcmVlbmxvY2sgd2luZG93cyBmcm9tIGFycmF5IGFuZCBjaGVjayBpZiBhbnkgc3RpbGwgZXhpc3RcbiAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICBjb25zdCBoYXNBY3RpdmVTY3JlZW5sb2NrID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5zb21lKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpICYmIHdpbi5pc1Zpc2libGUoKSlcbiAgICAgICAgLy8gQWxzbyBjaGVjayBjbGllbnRpbmZvLnNjcmVlbmxvY2sgZmxhZyBhcyBmYWxsYmFjayBpbiBjYXNlIGFycmF5IHdhcyBjbGVhcmVkIGJ1dCB3aW5kb3dzIHN0aWxsIGV4aXN0XG4gICAgICAgIGlmIChoYXNBY3RpdmVTY3JlZW5sb2NrIHx8IHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvPy5zY3JlZW5sb2NrKSB7IHJldHVybiB9Ly8gZG8gbm90aGluZyBpZiBzY3JlZW5sb2Nrd2luZG93IHN0b2xlIGZvY3VzIC8vIGRvIG5vdCB0cmlnZ2VyIGFuIGluZmluaXRlIGxvb3AgYmV0d2VlbiBleGFtIHdpbmRvdyBhbmQgc2NyZWVubG9jayB3aW5kb3cgKHN0ZWFsaW5nIGVhY2ggb3RoZXJzIGZvY3VzIGJlY2F1c2Ugc2NyZWVubG9ja3dpbmRvdyBhcHBlYXJzIGFib3ZlIGV4YW0gd2luZG93IGFuZCB3aWxsIGNhcHR1cmUgYSBrbGljayBhbmQgdGhlcmVmb3JlIHN0ZWFsIGZvY3VzKVxuICAgICAgICBpZiAod2luaGFuZGxlci5mb2N1c1RhcmdldEFsbG93ZWQpeyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAvL3Ryb3R6ZGVtIGZvY3VzIHp1clx1MDBGQ2NrIGF1ZiBkaWUgYXBwXG4gICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudDogYmx1cmV2ZW50IHdhcyB0cmlnZ2VyZWQgYnV0IHRhcmdldCBpcyBhbGxvd2VkYClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlICAgLy9pbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcblxuICAgICAgICAvL3R1cm4gdm9sdW1lIHVwIF5eXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7IHNwYXduKCdwb3dlcnNoZWxsJywgWydTZXQtVm9sdW1lTGV2ZWwgLUxldmVsIDEwMDsgU2V0LVZvbHVtZU11dGUgLU11dGUgJGZhbHNlJ10pOyB9XG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IGV4ZWMoJ29zYXNjcmlwdCAtZSBcInNldCB2b2x1bWUgb3V0cHV0IHZvbHVtZSAxMDBcIiAtZSBcInNldCB2b2x1bWUgb3V0cHV0IG11dGVkIGZhbHNlXCInKTsgfSAgXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7IFxuICAgICAgICAvLyAgICAgZXhlYygnYW1peGVyIHNldCBNYXN0ZXIgMTAwJSAnKTtcbiAgICAgICAgLy8gICAgIGV4ZWMoJ3BhY3RsIHNldC1zaW5rLW11dGUgYHBhY3RsIGdldC1kZWZhdWx0LXNpbmtgIDAnKTtcbiAgICAgICAgLy8gfVxuICAgICAgICBcbiAgICAgICAgLy93ZSBjb3VsZCBwbGF5IGEgc291bmQgZmlsZSBoZXJlLi4gdGJkLiAgXG4gICAgfVxuICAgIC8vc3BlY2lhbCBibHVyIGV2ZW50IGZvciB0ZW1wb3JhcnkgbG93IHNlY3VyaXR5IHNjcmVlbmxvY2tcbiAgICBibHVyZXZlbnRTY3JlZW5sb2NrKHdpbmhhbmRsZXIpIHsgXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6IGJsdXItc2NyZWVubG9jayB0cmlnZ2VyZWRcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vZG9uJ3QgY3ljbGUgdGhyb3VnaCBhbGwgb2YgdGhlbSAuLiBpdCB3aWxsIGNyZWF0ZSBhbiBpbmZpbml0ZSBmb2N1cyByYWNlXG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLnNob3coKTsgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6ICR7ZXJyfWApXG4gICAgICAgIH1cbiAgICBcbiAgICB9XG4gICAgXG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IFdpbmRvd0hhbmRsZXIoKVxuIFxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0XG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBtb3N0IG9mIHRoZSBrZXlib2FyZCByZXN0cmljdGlvbnMgY291bGQgYmUgaGFuZGxlZCBieSBcImlvaG9va1wiIGZvciBhbGwgcGxhdGZvcm1zXG4gKiB1bmZvcnR1bmFsZXR5IGl0J3Mgbm90IHlldCByZWxlYXNlZCBmb3Igbm9kZSB2MTYueCBhbmQgZWxlY3Ryb24gdjE2LnggIChhbHNvIGl0J3MgXCJiaWcgc3VyXCIgaW50ZWwgb25seSBvbiBtYWNzKVxuICogaHR0cHM6Ly93aWxpeC10ZWFtLmdpdGh1Yi5pby9pb2hvb2svaW5zdGFsbGF0aW9uLmh0bWxcbiAqXG4gKiBcIm5vZGUtZ2xvYmFsLWtleS1saXN0ZW5lclwiIHdvdWxkIGJlIGFub3RoZXIgc29sdXRpb24gZm9yIHdpbmRvd3MgYW5kIG1hY29zIChhbHRob3VnaCBpdCByZXF1aXJlcyBcImFjY2Vzc2FiaWxpdHlcIiBwZXJtaXNzaW9ucyBvbiBtYWMpXG4gKiBidXQgZm9yIG5vdyBpdCBzZWVtcyB0aGUgbW9kdWxlIGNhbiBub3QgcnVuIGluIGEgZmluYWwgZWxlY3Ryb24gYnVpbGRcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9MYXVuY2hNZW51L25vZGUtZ2xvYmFsLWtleS1saXN0ZW5lci9pc3N1ZXMvMThcbiAqXG4gKiBoYXJkY29kaW5nIHRoZSBrZXlib2FyZHNob3J0Y3V0cyB3ZSB3YW50IHRvIGNhcHR1cmUgaW50byBpb2hvb2sob3Igbi1nLWstbCkgYW5kIG1hbnVhbGx5IGNvbXBpbGluZyBpdCBmb3IgbWFjIGFuZCB3aW5kb3dzIGNvdWxkIGJlIGRvbmUgLSAoYnV0IG5vdCB1bnRpbCBpIGdldCBwYWlkIGZvciB0aGlzIGFtb3VudCBvZiB3b3JrIDstKVxuICovXG5cblxuLyoqXG4gKiB0aGUgbmV4dCBiZXN0IHNvbHV0aW9uIGkgY2FtZSB1cCB3aXRoIGlzIHRvIGtpbGwgYWxsIG9mIHRoZSBzaGVsbHMgLSBzdGFydGluZyB3aXRoIGV4cGxvcmVyLmV4ZSBiZWNhdXNlIGl0cyBhYnNvbHV0ZWx5IGltcG9zc2libGUgdG9cbiAqIGRlYWN0aXZhdGUgdGhpcyBuYXN0eSBcIndpbmRvd3NcIiBidXR0b24gb3IgM0ZpbmdlclNsaWRlVXAgR2VzdHVyZSBpbiB3aW5kb3dzIDExIC0geW91IGNvdWxkIGVkaXQgdGhlIHJlZ2lzdHJ5IGFuZCByZWJvb3QgYnV0IHRoYXRzIG9idmlvdXNseSBub3Qgd2hhdCB3ZSB3YW50XG4gKi9cblxuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGNsaXBib2FyZCwgZ2xvYmFsU2hvcnRjdXQgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBTY2hlZHVsZXJTZXJ2aWNlIH0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgZW5hYmxlTGludXhSZXN0cmljdGlvbnMsIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL2xpbi5qcyc7XG5pbXBvcnQgeyBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zLCBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucyB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL3dpbi5qcyc7XG5pbXBvcnQgeyBlbmFibGVNYWNSZXN0cmljdGlvbnMsIGRpc2FibGVNYWNSZXN0cmljdGlvbnMsIHRvZ2dsZU1hY09TTG9ja2Rvd24gYXMgdG9nZ2xlTWFjT1NMb2NrZG93bkltcGwgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9tYWMuanMnO1xuXG5sZXQgY2xpcGJvYXJkSW50ZXJ2YWw7XG5sZXQgY29uZmlnU3RvcmUgPSB7XG4gICAgbGludXg6IHt9LFxuICAgIHdpbmRvd3M6IHt9LFxuICAgIG1hY29zOiB7fVxufTtcblxuLy8gbGlzdCBvZiBhcHBzIHdlIGRvIG5vdCB3YW50IHRvIHJ1biBpbiBiYWNrZ3JvdW5kXG5jb25zdCBhcHBzVG9DbG9zZSA9IFsnR29vZ2xlIENocm9tZScsICdjaHJvbWUnLCAnZ29vZ2xlLWNocm9tZScsICdNaWNyb3NvZnQgRWRnZScsICdtc2VkZ2UnLCAnZmlyZWZveCcsICdzYWZhcmknLCAnYnJhdmUnLCAnb3BlcmEnLCAnY2hhdGdwdCcsICdDaGF0R1BUJywgJ05vcnRvblNlY3VyaXR5JywgJ05BVicsICdUZWFtcycsICdtcy10ZWFtcycsICd6b29tLnVzJywgJ01pY3Jvc29mdCBUZWFtcycsICdkaXNjb3JkJywgJ3pvb20nLCAndGVhbXMnLCAndGVhbXZpZXdlcicsICdza3lwZWZvcmxpbnV4JywgJ3NreXBlJywgJ2FueWRlc2snXTtcblxuYXN5bmMgZnVuY3Rpb24gZW5hYmxlUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuXG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgcGxhdGZvcm0gcmVzdHJpY3Rpb25zXCIpO1xuXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGNsaXBib2FyZC5jbGVhcigpO1xuICAgIGNsaXBib2FyZEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UoKCkgPT4geyBjbGlwYm9hcmQuY2xlYXIoKTsgfSwgMTAwMCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RhcnQoKTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNLREUsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0dOT01FKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGF3YWl0IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGVuYWJsZU1hY1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXNhYmxlUmVzdHJpY3Rpb25zKCkge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHJlbW92aW5nIHJlc3RyaWN0aW9ucy4uLlwiKTtcblxuICAgIGlmIChjbGlwYm9hcmRJbnRlcnZhbCkge1xuICAgICAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdG9wKCk7XG4gICAgfVxuXG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMoKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVNYWNPU0xvY2tkb3duKGVuYWJsZSkge1xuICAgIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsKGVuYWJsZSk7XG59XG5cbmV4cG9ydCB7IGVuYWJsZVJlc3RyaWN0aW9ucywgZGlzYWJsZVJlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biB9O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBMaW51eC1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlKS5cbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyB1bmZvcnR1bmF0ZWx5IHRoZXJlIGlzIG5vIGNvbnZlbmllbnQgd2F5IGZvciBnbm9tZS1zaGVsbCB0byB1bi1zZXQgQUxMIHNob3J0Y3V0cyBhdCBvbmNlXG5jb25zdCBnbm9tZUtleWJpbmRpbmdzID0gW1xuICAgICdhY3RpdmF0ZS13aW5kb3ctbWVudScsJ21heGltaXplLWhvcml6b250YWxseScsJ21vdmUtdG8tc2lkZS1uJywnbW92ZS10by13b3Jrc3BhY2UtOCcsJ3N3aXRjaC1hcHBsaWNhdGlvbnMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTMnLCdzd2l0Y2gtd2luZG93cy1iYWNrd2FyZCcsXG4gICAgJ2Fsd2F5cy1vbi10b3AnLCdtYXhpbWl6ZS12ZXJ0aWNhbGx5JywnbW92ZS10by1zaWRlLXMnLCdtb3ZlLXRvLXdvcmtzcGFjZS05Jywnc3dpdGNoLWFwcGxpY2F0aW9ucy1iYWNrd2FyZCcsJyAgc3dpdGNoLXRvLXdvcmtzcGFjZS00JywndG9nZ2xlLWFib3ZlJyxcbiAgICAnYmVnaW4tbW92ZScsJ21pbmltaXplJywnbW92ZS10by1zaWRlLXcnLCdtb3ZlLXRvLXdvcmtzcGFjb2UtZG93bicsJ3N3aXRjaC1ncm91cCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNScsJ3RvZ2dsZS1mdWxsc2NyZWVuJyxcbiAgICAnYmVnaW4tcmVzaXplJywnbW92ZS10by1jZW50ZXInLCdtb3ZlLXRvLXdvcmtzcGFjZS0xJywnbW92ZS10by13b3Jrc3BhY2UtbGFzdCcsJ3N3aXRjaC1ncm91cC1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNicsJ3RvZ2dsZS1tYXhpbWl6ZWQnLFxuICAgICdjbG9zZScsJ21vdmUtdG8tY29ybmVyLW5lJywnbW92ZS10by13b3Jrc3BhY2UtMTAnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sZWZ0Jywnc3dpdGNoLWlucHV0LXNvdXJjZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtNycsJ3RvZ2dsZS1vbi1hbGwtd29ya3NwYWNlcycsXG4gICAgJ2N5Y2xlLWdyb3VwJywnbW92ZS10by1jb3JuZXItbncnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMScsJ21vdmUtdG8td29ya3NwYWNlLXJpZ2h0Jywnc3dpdGNoLWlucHV0LXNvdXJjZS1iYWNrd2FyZCAgc3dpdGNoLXRvLXdvcmtzcGFjZS04JywndG9nZ2xlLXNoYWRlZCcsXG4gICAgJ2N5Y2xlLWdyb3VwLWJhY2t3YXJkJywnbW92ZS10by1jb3JuZXItc2UnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMicsJ21vdmUtdG8td29ya3NwYWNlLXVwJywnc3dpdGNoLXBhbmVscycsJ3N3aXRjaC10by13b3Jrc3BhY2UtOScsJ3VubWF4aW1pemUnLFxuICAgICdjeWNsZS1wYW5lbHMnLCdtb3ZlLXRvLWNvcm5lci1zdycsJ21vdmUtdG8td29ya3NwYWNlLTInLCdwYW5lbC1tYWluLW1lbnUnLCdzd2l0Y2gtcGFuZWxzLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1kb3duJyxcbiAgICAnY3ljbGUtcGFuZWxzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLWRvd24nLCdtb3ZlLXRvLXdvcmtzcGFjZS0zJywncGFuZWwtcnVuLWRpYWxvZycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGFzdCcsXG4gICAgJ2N5Y2xlLXdpbmRvd3MnLCdtb3ZlLXRvLW1vbml0b3ItbGVmdCcsJ21vdmUtdG8td29ya3NwYWNlLTQnLCdyYWlzZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxlZnQnLFxuICAgICdjeWNsZS13aW5kb3dzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLXJpZ2h0JywnbW92ZS10by13b3Jrc3BhY2UtNScsJ3JhaXNlLW9yLWxvd2VyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtcmlnaHQnLFxuICAgICdsb3dlcicsJ21vdmUtdG8tbW9uaXRvci11cCcsJ21vdmUtdG8td29ya3NwYWNlLTYnLCdzZXQtc3Bldy1tYXJrJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMicsJ3N3aXRjaC10by13b3Jrc3BhY2UtdXAnLFxuICAgICdtYXhpbWl6ZScsJ21vdmUtdG8tc2lkZS1lJywnbW92ZS10by13b3Jrc3BhY2UtNycsJ3Nob3ctZGVza3RvcCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtMicsJ3N3aXRjaC13aW5kb3dzJ1xuXTtcbmNvbnN0IGdub21lU2hlbGxLZXliaW5kaW5ncyA9IFsnZm9jdXMtYWN0aXZlLW5vdGlmaWNhdGlvbicsJ29wZW4tYXBwbGljYXRpb24tbWVudScsJ3NjcmVlbnNob3QnLCdzY3JlZW5zaG90LXdpbmRvdycsJ3NoaWZ0LW92ZXJ2aWV3LWRvd24nLFxuICAgICdzaGlmdC1vdmVydmlldy11cCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0xJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTInLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi00Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTUnLFxuICAgICdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi03Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTgnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOScsJ3Nob3ctc2NyZWVuc2hvdC11aScsJ3Nob3ctc2NyZWVuLXJlY29yZGluZy11aScsXG4gICAgJ3RvZ2dsZS1hcHBsaWNhdGlvbi12aWV3JywndG9nZ2xlLW1lc3NhZ2UtdHJheScsJ3RvZ2dsZS1vdmVydmlldyddO1xuY29uc3QgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncyA9IFsncm90YXRlLW1vbml0b3InLCdzd2l0Y2gtbW9uaXRvcicsJ3RhYi1wb3B1cC1jYW5jZWwnLCd0YWItcG9wdXAtc2VsZWN0JywndG9nZ2xlLXRpbGVkLWxlZnQnLCd0b2dnbGUtdGlsZWQtcmlnaHQnXTtcbmNvbnN0IGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzID0gWydhcHAtY3RybC1ob3RrZXktMScsJ2FwcC1jdHJsLWhvdGtleS0xMCcsJ2FwcC1jdHJsLWhvdGtleS0yJywnYXBwLWN0cmwtaG90a2V5LTMnLCdhcHAtY3RybC1ob3RrZXktNCcsJ2FwcC1jdHJsLWhvdGtleS01JyxcbiAgICAnYXBwLWN0cmwtaG90a2V5LTYnLCdhcHAtY3RybC1ob3RrZXktNycsJ2FwcC1jdHJsLWhvdGtleS04JywnYXBwLWN0cmwtaG90a2V5LTknLFxuICAgICdhcHAtaG90a2V5LTEnLCdhcHAtaG90a2V5LTEwJywnYXBwLWhvdGtleS0yJywnYXBwLWhvdGtleS0zJywnYXBwLWhvdGtleS00JywnYXBwLWhvdGtleS01JywnYXBwLWhvdGtleS02JywnYXBwLWhvdGtleS03JywnYXBwLWhvdGtleS04JywnYXBwLWhvdGtleS05JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS0xJywnYXBwLXNoaWZ0LWhvdGtleS0xMCcsJ2FwcC1zaGlmdC1ob3RrZXktMicsJ2FwcC1zaGlmdC1ob3RrZXktMycsJ2FwcC1zaGlmdC1ob3RrZXktNCcsJ2FwcC1zaGlmdC1ob3RrZXktNScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktNicsJ2FwcC1zaGlmdC1ob3RrZXktNycsJ2FwcC1zaGlmdC1ob3RrZXktOCcsJ2FwcC1zaGlmdC1ob3RrZXktOScsJ3Nob3J0Y3V0J107XG5jb25zdCBnbm9tZVdheWxhbmRLZXliaW5kaW5ncyA9IFsnc3dpdGNoLXRvLXNlc3Npb24tMScsJ3N3aXRjaC10by1zZXNzaW9uLTInLCdzd2l0Y2gtdG8tc2Vzc2lvbi0zJywnc3dpdGNoLXRvLXNlc3Npb24tNCcsJ3N3aXRjaC10by1zZXNzaW9uLTUnLCdzd2l0Y2gtdG8tc2Vzc2lvbi02Jywnc3dpdGNoLXRvLXNlc3Npb24tNycsJ3N3aXRjaC10by1zZXNzaW9uLTgnLCdzd2l0Y2gtdG8tc2Vzc2lvbi05Jywnc3dpdGNoLXRvLXNlc3Npb24tMTAnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMScsJ3N3aXRjaC10by1zZXNzaW9uLTEyJ107XG5cbi8qKlxuICogRW5hYmxlIExpbnV4LXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoS0RFL0dOT01FLCBjbG9zZSBhcHBzLCBjbGlwYm9hcmQpLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1N0b3JlIC0gc2hhcmVkIHN0b3JlIChjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzKVxuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICogQHBhcmFtIHtib29sZWFufSBpc0tERVxuICogQHBhcmFtIHtib29sZWFufSBpc0dOT01FXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSwgYXBwc1RvQ2xvc2UsIGlzS0RFLCBpc0dOT01FKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCJgLCAocGdyZXBFcnJvciwgc3Rkb3V0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwZ3JlcEVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiIHwgeGFyZ3MgLXIga2lsbCAtOWAsIChraWxsRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgha2lsbEVycm9yKSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgaWYgKGlzS0RFKSB7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEtERSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3JlYWRjb25maWc1JywgWyctLWZpbGUnLCAna3dpbnJjJywgJy0tZ3JvdXAnLCAnRGVza3RvcHMnLCAnLS1rZXknLCAnTnVtYmVyJ10sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGtyZWFkY29uZmlnKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSAxO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSBzdGRvdXQudHJpbSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogcmVjb25maWd1cmluZyBrd2luXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsIGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCAnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnXCJcIiddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCdrd2lucmMnLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsJzEnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywnc2V0Q3VycmVudERlc2t0b3AnLCcxJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZWZmZWN0c1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnZGVza3RvcGdyaWQnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ3NjcmVlbmVkZ2UnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ292ZXJ2aWV3J10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBhZGRpdGlvbmFsIHR0eSdzXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICdzcnZya2V5czpub25lJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsZWFyaW5nIGNsaXBib2FyZCBoaXN0b3J5XCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBnbG9iYWwga2V5Ym9hcmRzaG9ydGN1dHNcIik7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ29yZy5rZGUuS0dsb2JhbEFjY2VsLmJsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ3RydWUnXSk7XG4gICAgICAgIH0sIDIwMDApO1xuICAgIH1cblxuICAgIGlmIChpc0dOT01FKSB7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEdOT01FIHJlc3RyaWN0aW9uc1wiKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2F5bGFuZDogZGlzYWJsZSBWVC9UVFkgc3dpdGNoIChDdHJsK0FsdCtGMS4uRjEyKSB2aWEgbXV0dGVyIGtleWJpbmRpbmdzXG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsICdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBiaW5kaW5nLCBgWycnXWBdKTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2Rjb25mJywgWyd3cml0ZScsIGAvb3JnL2dub21lL211dHRlci93YXlsYW5kL2tleWJpbmRpbmdzLyR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCAnb3ZlcmxheS1rZXknLCBgJydgXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUubXV0dGVyIGR5bmFtaWMtd29ya3NwYWNlcyBmYWxzZScpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLmRlc2t0b3Aud20ucHJlZmVyZW5jZXMgbnVtLXdvcmtzcGFjZXMgMScpO1xuICAgICAgICAgICAgLy8gWDExIG9ubHk6IGRpc2FibGUgVFRZIHN3aXRjaCB2aWEgc2V0eGtibWFwIChvbiBXYXlsYW5kIHdlIHJlbHkgb24gbXV0dGVyIGtleWJpbmRpbmdzIGFib3ZlKVxuICAgICAgICAgICAgaWYgKCFwbGF0Zm9ybURpc3BhdGNoZXIuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdzZXR4a2JtYXAgLW9wdGlvbiBzcnZya2V5czpub25lJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBsb2cud2FybigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKEdOT01FKTogc2V0eGtibWFwIHNydnJrZXlzOm5vbmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCk7IH1cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCk7IH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIExpbnV4LXNwZWNpZmljIHJlc3RyaWN0aW9ucyBhbmQgcmVzdG9yZSBLREUvR05PTUUgc2V0dGluZ3MuXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnU3RvcmUgLSBzaGFyZWQgc3RvcmUgKGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUpIHtcbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKTtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IGV4ZWMgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdLREUnKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBLREUgZGV0ZWN0ZWRcIik7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdibG9ja0dsb2JhbFNob3J0Y3V0cycsICdmYWxzZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicgLCcvQ29tcG9zaXRvcicsICdvcmcua2RlLmt3aW4uQ29tcG9zaXRpbmcucmVzdW1lJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUga2dsb2JhbGFjY2VsNSYnKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJyxgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnLS1kZWxldGUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsJ2t3aW5yYycsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wc10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKTtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUgcGxhc21hc2hlbGwgJicsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnLCAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYmluZGluZ10pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCAnb3ZlcmxheS1rZXknXSk7XG4gICAgLy8gcmVzdG9yZSBUVFkgc3dpdGNoIGlmIHdlIGhhZCBkaXNhYmxlZCBpdCB2aWEgc2V0eGtibWFwIChHTk9NRSBYMTEpXG4gICAgaWYgKGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhcInNldHhrYm1hcCAtb3B0aW9uICcnXCIsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGxvZy53YXJuKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHNldHhrYm1hcCByZXN0b3JlIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCA9IGZhbHNlO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogV2luZG93cy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vKipcbiAqIEVuYWJsZSBXaW5kb3dzLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoc2hvcnRjdXRzLCBjbG9zZSBhcHBzLCBraWxsIGV4cGxvcmVyKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIG9uZSBtb3JlIGxldmVsIHVwOiByZXN0cmljdGlvbnMvIC0+IHNjcmlwdHMvIC0+IG1haW4vIC0+IHBhY2thZ2VzLyAoc2FtZSB0YXJnZXQgYXMgb3JpZ2luYWwgcGxhdGZvcm1yZXN0cmljdGlvbnMuanMgaW4gc2NyaXB0cy8pXG4gICAgICAgIGNvbnN0IGV4ZWN1dGFibGUxID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9wdWJsaWMvZGlzYWJsZS1zaG9ydGN1dHMuZXhlJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMSwgW10sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJywgc2hlbGw6IGZhbHNlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luZG93cyBzaG9ydGN1dHMgZGlzYWJsZWRcIik7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBzaG9ydGN1dHMpOiAke2Vycn1gKTsgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHAgb2YgYXBwc1RvQ2xvc2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRBcHAgPSBhcHAucmVwbGFjZSgvJy9nLCBcIicnXCIpO1xuICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkYXBwTmFtZSA9ICcke2VzY2FwZWRBcHB9JzsgdHJ5IHsgJHByb2NzID0gR2V0LVByb2Nlc3MgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyAkXy5Qcm9jZXNzTmFtZSAtaWxpa2UgKCcqJyArICRhcHBOYW1lICsgJyonKSB9OyBpZiAoJHByb2NzIC1hbmQgJHByb2NzLkNvdW50IC1ndCAwKSB7ICRwcm9jcyB8IFN0b3AtUHJvY2VzcyAtRm9yY2UgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWU7IFdyaXRlLU91dHB1dCAna2lsbGVkJyB9IH0gY2F0Y2ggeyB9XCJgO1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmVBcHApID0+IHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkuaW5jbHVkZXMoJ2tpbGxlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlQXBwKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgaWYgKCF3aW5oYW5kbGVyKSB7XG4gICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luaGFuZGxlciBpcyBub3QgcHJvdmlkZWQgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCByZXRyeUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwMDtcbiAgICAgICAgY29uc3Qga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cyA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5oYW5kbGVyLmV4YW13aW5kb3cgJiYgIXdpbmhhbmRsZXIuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2tpbGwgL2YgL2ltIGV4cGxvcmVyLmV4ZScsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBleHBsb3Jlci5leGVgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJldHJ5Q291bnQgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgcmV0cnlDb3VudCsrO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoa2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cywgMTAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBleGFtd2luZG93IG5vdCBmb3VuZCBhZnRlciAke21heFJldHJpZXMgKiAxMDB9bXMgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzKCk7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHVuYmxvY2sgc2hvcnRjdXRzLCByZXN0YXJ0IGV4cGxvcmVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCkge1xuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiB1bmJsb2NraW5nIHNob3J0Y3V0cy4uLlwiKTtcbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgdGFza2tpbGwgIC9JTSBcImRpc2FibGUtc2hvcnRjdXRzLmV4ZVwiIC9UIC9GYCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBkaXNhYmxlLXNob3J0Y3V0cy5leGVgKTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBleHBsb3Jlci5leGVcIicsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgdGFza2xpc3QgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMoJ2V4cGxvcmVyLmV4ZScpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHJlc3RhcnRpbmcgZXhwbG9yZXIuLi5cIik7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygnc3RhcnQgZXhwbG9yZXIuZXhlJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVyZXN0cmljdGlvbnMgKHdpbiBleHBsb3Jlcik6ICR7ZS5tZXNzYWdlfWApOyB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIG1hY09TLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUsIHRvZ2dsZU1hY09TTG9ja2Rvd24pLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgVG91Y2hCYXIsIHN5c3RlbVByZWZlcmVuY2VzLCBwb3dlck1vbml0b3IgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHN0b3JlZCByZWZzIGZvciBjbGVhbnVwIHdoZW4gZGlzYWJsaW5nIG1hY09TIHJlc3RyaWN0aW9uc1xubGV0IHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbmxldCBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbmxldCBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG5cbi8qKiBTaW5nbGUgaGFuZGxlciBmb3IgYWxsIG1hY09TIHJlc3RyaWN0aW9uIHNpZ25hbHM6IGxvZyBhbmQgcmUtZm9jdXMgZXhhbSB3aW5kb3cgLyBpbmZvcm0gdGVhY2hlci4gKi9cbmZ1bmN0aW9uIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoc2lnbmFsTmFtZSkge1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogJHtzaWduYWxOYW1lfSBkZXRlY3RlZGApO1xuICAgIGlmICghY3VycmVudFdpbmhhbmRsZXI/LmV4YW13aW5kb3c/LmlzRGVzdHJveWVkPy4oKSkge1xuICAgICAgICBpZiAoY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvKSBjdXJyZW50V2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBpbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7XG4gICAgfVxufVxuXG5jb25zdCBsb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ2xvY2stc2NyZWVuJyk7XG5jb25zdCB1bmxvY2tTY3JlZW5IYW5kbGVyID0gKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgndW5sb2NrLXNjcmVlbicpO1xuXG4vKipcbiAqIEVuYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKFRvdWNoQmFyLCBjbGlwYm9hcmQsIGNsb3NlIGFwcHMsIHdvcmtzcGFjZS9sb2NrIG1vbml0b3JpbmcpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICBjb25zdCB7IFRvdWNoQmFyTGFiZWwsIFRvdWNoQmFyU3BhY2VyIH0gPSBUb3VjaEJhcjtcbiAgICBjb25zdCB0ZXh0bGFiZWwgPSBuZXcgVG91Y2hCYXJMYWJlbCh7IGxhYmVsOiBcIk5leHQtRXhhbVwiIH0pO1xuICAgIGNvbnN0IHRvdWNoQmFyID0gbmV3IFRvdWNoQmFyKHtcbiAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgICAgICB0ZXh0bGFiZWwsXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICBdXG4gICAgfSk7XG4gICAgd2luaGFuZGxlci5leGFtd2luZG93Py5zZXRUb3VjaEJhcih0b3VjaEJhcik7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSB3aW5oYW5kbGVyO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3BiY29weSA8IC9kZXYvbnVsbCcpO1xuXG4gICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGtpbGwgLTkgLWYgXCIke2FwcH1cImAsIChlcnJvciwgc3RkZXJyLCBzdGRvdXQpID0+IHt9KTtcbiAgICB9KTtcblxuICAgIC8vIHdvcmtzcGFjZS9zcGFjZSBzd2l0Y2ggYW5kIGxvY2svdW5sb2NrIG1vbml0b3JpbmcgKG1hY09TIG9ubHkpXG4gICAgdHJ5IHtcbiAgICAgICAgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBzeXN0ZW1QcmVmZXJlbmNlcy5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24oJ05TV29ya3NwYWNlQWN0aXZlU3BhY2VEaWRDaGFuZ2VOb3RpZmljYXRpb24nLCAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdkZXNrdG9wL3NwYWNlIHN3aXRjaCcpKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuXG4gICAgcG93ZXJNb25pdG9yLm9uKCdsb2NrLXNjcmVlbicsIGxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBwb3dlck1vbml0b3Iub24oJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcblxuICAgIGxvZ1N0cmVhbVByb2Nlc3MgPSBzcGF3bignbG9nJywgWydzdHJlYW0nLCAnLS1wcmVkaWNhdGUnLCAnc3Vic3lzdGVtID09IFwiY29tLmFwcGxlLmRvY2tcIiBBTkQgY2F0ZWdvcnkgPT0gXCJtaXNzaW9uY29udHJvbFwiJ10pO1xuICAgIGxvZ1N0cmVhbVByb2Nlc3Muc3Rkb3V0Py5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgIGlmIChkYXRhLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ21vZGUnKSkgb25NYWNSZXN0cmljdGlvblNpZ25hbCgnTWlzc2lvbiBDb250cm9sJyk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogRGlzYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHRvdWNoYmFyLCBtb25pdG9yaW5nIGxpc3RlbmVycyBhbmQgbG9nIHByb2Nlc3MpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpIHtcbiAgICBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG4gICAgaWYgKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHsgc3lzdGVtUHJlZmVyZW5jZXMudW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24od29ya3NwYWNlTm90aWZpY2F0aW9uSWQpOyB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogdW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24nLCBlcnIpOyB9XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbiAgICB9XG4gICAgcG93ZXJNb25pdG9yLm9mZignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9mZigndW5sb2NrLXNjcmVlbicsIHVubG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIGlmIChsb2dTdHJlYW1Qcm9jZXNzKSB7XG4gICAgICAgIGxvZ1N0cmVhbVByb2Nlc3Mua2lsbCgpO1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogRGlzYWJsZXMvZW5hYmxlcyBtaXNzaW9uIGNvbnRyb2wsIHNwYWNlcyBhbmQgdHJhY2twYWQgZ2VzdHVyZXMuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAtIHRydWUgcmVzdG9yZXMgZXZlcnl0aGluZywgZmFsc2UgbG9ja3MgZXZlcnl0aGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIHRvZ2dsZU1hY09TTG9ja2Rvd246ICR7ZW5hYmxlID8gJ2VuYWJsZScgOiAnZGlzYWJsZSd9IG1pc3Npb24gY29udHJvbCBsb2NrZG93bmApO1xuXG4gICAgY29uc3QgbWNJZHMgPSBbMzIsIDMzLCAzNCwgMzUsIDc5LCA4MCwgODEsIDgyLCAxMTgsIDExOSwgMTIwLCAxMjFdO1xuICAgIGNvbnN0IHBsaXN0UGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3RvcnksICdMaWJyYXJ5L1ByZWZlcmVuY2VzL2NvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMucGxpc3QnKTtcbiAgICBjb25zdCBiYWNrdXBQYXRoID0gam9pbihwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeSwgJ25leHRfZXhhbV9ob3RrZXlzX2JhY2t1cC5wbGlzdCcpO1xuXG4gICAgaWYgKGVuYWJsZSkge1xuICAgICAgICBjb25zdCBob3RrZXlDb21tYW5kcyA9IG1jSWRzLm1hcChpZCA9PlxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMgQXBwbGVTeW1ib2xpY0hvdEtleXMgLWRpY3QtYWRkICR7aWR9IFwiPGRpY3Q+PGtleT5lbmFibGVkPC9rZXk+PGZhbHNlLz48L2RpY3Q+XCJgXG4gICAgICAgICkuam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0Rlc2t0b3BHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbICEgLWYgXCIke2JhY2t1cFBhdGh9XCIgXTsgdGhlbiBjcCBcIiR7cGxpc3RQYXRofVwiIFwiJHtiYWNrdXBQYXRofVwiOyBmaTtcbiAgICAgICAgJHtob3RrZXlDb21tYW5kc307XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBFbmFibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0FwcEV4cG9zZUdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gXG4gICAgICAgICAgY3AgXCIke2JhY2t1cFBhdGh9XCIgXCIke3BsaXN0UGF0aH1cIjsgXG4gICAgICAgICAgcm0gXCIke2JhY2t1cFBhdGh9XCI7IFxuICAgICAgICBmaTtcbiAgICAgICAgJHtnZXN0dXJlQ29tbWFuZHN9O1xuICAgICAgICBraWxsYWxsIC05IGNmcHJlZnNkO1xuICAgICAgICBzbGVlcCAxO1xuICAgICAgICAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvU3lzdGVtQWRtaW5pc3RyYXRpb24uZnJhbWV3b3JrL1Jlc291cmNlcy9hY3RpdmF0ZVNldHRpbmdzIC11O1xuICAgICAgICBraWxsYWxsIERvY2tcbiAgICAgIGA7XG4gICAgICAgIGxvZy5pbmZvKCdtYWluIEAgdG9nZ2xlTWFjT1NMb2NrZG93bjogRW5hYmxlIE1pc3Npb25Db250b2wnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoZnVsbENvbW1hbmQsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0xvY2tkb3duIERpc2FibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbid1c2Ugc3RyaWN0J1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBhcmNoaXZlciBmcm9tICdhcmNoaXZlcicgICAvLyBkYXMgbWFjaHQga3Jhc3Nlc3RlIHJhY2Vjb2RpdGlvbnMgbWl0IGVsZWN0cm9uIGVpZ2VuZW4gdmVyc2lvbmVuIC0gdW5iZWRpbmd0IGRpZSBzZWxiZSB2ZXJzaW9uIGJlaGFsdGVuIHdpZSBlbGVjdHJvblxuaW1wb3J0IGV4dHJhY3QgZnJvbSAnZXh0cmFjdC16aXAnXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IHNjcmVlbiwgaXBjTWFpbiwgYXBwLCBCcm93c2VyV2luZG93LCB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0IHNjcmVlbnNob3QgZnJvbSAnc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQnO1xuaW1wb3J0IHsgV29ya2VyIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBydW5SZW1vdGVDaGVjayB9IGZyb20gJy4vcmVtb3RlQ2hlY2suanMnXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyLmpzJztcblxuY29uc3Qgc2hlbGwgPSAoY21kKSA9PiB7ICAgcmV0dXJuIGV4ZWNTeW5jKGNtZCwgeyBlbmNvZGluZzogJ3V0ZjgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSk7IH07ICAvLyBzdGRlcnIgdW50ZXJkclx1MDBGQ2NrdCBcbmNvbnN0IGFnZW50ID0gbmV3IGh0dHBzLkFnZW50KHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9KTtcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IFxuXG4gLyoqXG4gICogSGFuZGxlcyBpbmZvcm1hdGlvbiBmZXRjaGluZyBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGFjdHMgb24gc3RhdHVzIHVwZGF0ZXNcbiAgKi9cbiBcbiBjbGFzcyBDb21tSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMudXBkYXRlU3R1ZGVudEludGVydmFsbCA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gZmFsc2VcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwIC8vIHdlIGNvdW50IGZhaWxzIGFuZCBkZWFjdGl2YXRlIG9uIDQgY29uc2VxdWVudCBmYWlsc1xuICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gdHJ1ZVxuICAgICAgICB0aGlzLnRpbWVyID0gMFxuICAgICAgICB0aGlzLndvcmtlciA9IG51bGxcbiAgICAgICAgdGhpcy51c2VXb3JrZXIgPSB0cnVlXG4gICAgICAgIHRoaXMud29ya2VyRmFpbHMgPSAwXG4gICAgfVxuIFxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMucmVxdWVzdFVwZGF0ZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuc2VuZFNjcmVlbnNob3QuYmluZCh0aGlzKSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIGlmICghdGhpcy53b3JrZXIgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7ICB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKSAgfVxuICAgIH1cbiBcblxuICAgIC8qKlxuICAgICAqIFNldHVwIHRoZSBpbWFnZSB3b3JrZXJcbiAgICAgKiB1c2VzIGZvcmsgdG8gY3JlYXRlIGEgbmV3IGNoaWxkIHByb2Nlc3NcbiAgICAgKiB1c2VzIHRoZSBpbWFnZVdvcmtlckxpbnV4LmpzIG9yIGltYWdlV29ya2VyU2hhcnAuanMgZmlsZVxuICAgICAqIHRoZSB3b3JrZXIgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSBzY3JlZW5zaG90IGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHNldHVwSW1hZ2VXb3JrZXIoKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlclVSTCA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJVUkw7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyVVJMLCB7IHR5cGU6ICdtb2R1bGUnLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYgfSB9KTtcbiAgICAgICAgbG9nLmRlYnVnKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBJbWFnZVdvcmtlciBpbml0aWFsaXplZC4gVXNpbmcgXCIgKyBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyRmlsZU5hbWUpXG4gICAgICAgIFxuXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdlcnJvcicsIGVycm9yID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyRmFpbHMgKz0gMVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLndvcmtlckZhaWxzID4gNCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBmYWlsZWQgNSB0aW1lcyAtIHN3aXRjaGluZyB0byBubyBwcm9jZXNzaW5nJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBzY3JlZW5zaG90IFxuICAgICAqIGlmIHVzZVdvcmtlciBpcyB0cnVlLCB0aGUgc2NyZWVuc2hvdCBpcyBwcm9jZXNzZWQgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICogb3RoZXJ3aXNlIHRoZSBzY3JlZW5zaG90IGlzIG5vdCBwcm9jZXNzZWQgYW5kIHRoZSBvcmlnaW5hbCBzY3JlZW5zaG90IGlzIHJldHVybmVkXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikge1xuICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLndvcmtlcikgeyAvL3RyaXBsZSBjaGVjayBpZiB3b3JrZXIgaXMgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dvcmtlciBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHsgaW1nQnVmZmVyOiBBcnJheS5mcm9tKGltZ0J1ZmZlciksIGltVmVyc2lvbjogcGxhdGZvcm1EaXNwYXRjaGVyLmltVmVyc2lvbiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyLm9uY2UoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmYWxsYmFjayB0byBubyBwcm9jZXNzaW5nICAgXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gQnVmZmVyLmZyb20oaW1nQnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJCYXNlNjQgPSBzY3JlZW5zaG90QmFzZTY0XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBzY3JlZW5zaG90QmFzZTY0OiBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQ6IGhlYWRlckJhc2U2NCwgaXNibGFjazogZmFsc2UsIGltZ0J1ZmZlcjogaW1nQnVmZmVyIH07XG5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuICAgIC8qKiBcbiAgICAgKiBVcGRhdGUgY3VycmVudCBTZXJ2ZXJzdGF0dXMgKyBTdHVkZW50dHN0YXR1cyAoZXZlcnkgNSBzZWNvbmRzKVxuICAgICAqL1xuICAgIGFzeW5jIHJlcXVlc3RVcGRhdGUoKXtcblxuICAgICAgICB0aGlzLnRpbWVyKysgICAvLyB3ZSB1c2UgdGltZXIgdG8gdGltZSBsb29wcyB3aXRoIGRpZmZlcmVudCBpbnRlcnZhbHMgd2l0aG91dCBpbnRyb2R1Y2luZyBuZXcgdW5uZWNjZXNhcnkgc2NoZWR1bGVyc1xuICAgICAgICBpZiAodGhpcy50aW1lciAlIDIwID09PSAwICl7ICAvLyBydW4gZXZlcnkgMjAqNSAodXBkYXRlbG9vcCkgc2Vjb25kc1xuXG4gICAgICAgICAgICBjb25zdCB1c2VzUmVtb3RlQXNzaXN0YW50ID0gYXdhaXQgcnVuUmVtb3RlQ2hlY2socHJvY2Vzcy5wbGF0Zm9ybSlcblxuICAgICAgICAgICAgaWYgKHVzZXNSZW1vdGVBc3Npc3RhbnQpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlYWR5OiBQb3NzaWJsZSByZW1vdGUgYXNzaXN0YW5jZSBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LmtleXdvcmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IEtleXdvcmQgJHtrZXl3b3JkfSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvcnQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5wb3J0cykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBQb3J0ICR7cG9ydH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnQgPSB1c2VzUmVtb3RlQXNzaXN0YW50XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKSAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgc2NyZWVuIHRoYXQgbmVlZHMgdG8gYmUgYmxvY2tlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZCAgbm8gc2VydmVyc2lnbmFsIGZvciAyMCBzZWNvbmRzXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7ICBcbiAgICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IENvbm5lY3Rpb24gdG8gVGVhY2hlciBsb3N0ISBSZW1vdmluZyByZWdpc3RyYXRpb24uXCIpIC8vcmVtb3ZlIHNlcnZlciByZWdpc3RyYXRpb24gbG9jYWxseSAoc2FtZSBhcyAna2ljaycpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSAgIC8vIHRoaXMgYWxzbyByZXNldHMgc2VydmVyaXAgdGhlcmVmb3JlIG5vIGFwaSBjYWxscyBhcmUgbWFkZSBhZnRlcndhcmRzXG4gICAgICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpICAgICAgIC8vIGp1c3QgaW4gY2FzZSBzY3JlZW5zIGFyZSBibG9ja2VkLi4gbGV0IHN0dWRlbnRzIHdvcmtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgXG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7Y2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb31cblxuICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsgdGhyb3cgbmV3IEVycm9yKCdOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgICAgICAoZGF0YS5tZXNzYWdlID09PSBcIm5vdGF2YWlsYWJsZVwiKXsgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogRXhhbSBJbnN0YW5jZSBub3QgZm91bmQhJyk7ICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDU7IH0gICAgLy8gZXhhbSBpbnN0YW5jZSBub3QgYXZhaWxhYmxlIGJ1dCBzZXJ2ZXIgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdGEubWVzc2FnZSA9PT0gXCJyZW1vdmVkXCIpeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogU3R1ZGVudCByZWdpc3RyYXRpb24gbm90IGZvdW5kIScpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoKVxuICAgICAgICAgICAgICAgICAgICB9ICAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIC0gd2UgaGFuZGxlIHRoaXMgZGlmZmVyZW50bHkgbm93LiB0ZWFjaGVyIHN0b3JlcyBcImtpY2tlZFwiIGZvciBzdHVkZW50IHRvIGNvbGxlY3QuIHN0dWRlbnQgaXMgcmVtb3ZlZCBmcm9tIHNlcnZlciB3aGVuIGNvbGxlY3Rpbmcga2lja2VkIGluZm8uIHN0dWRlbnQgY2xvc2VzIGV4YW0gYW5kIGNsZWFucyB1cC5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9IEhlYXJ0YmVhdCBsb3N0Li5gKTsgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7fSAgIC8vIGhlYXJ0YmVhdCBsb3N0IHNlcnZlciBub3QgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwOyAvLyBEaWVzIHpcdTAwRTRobHQgZWJlbmZhbGxzIGFscyBlcmZvbGdyZWljaGVyIEhlYXJ0YmVhdCAtIFZlcmJpbmR1bmcgaGFsdGVuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc2VydmVyc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zdHVkZW50c3RhdHVzKSk7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlclN0YXR1c0RlZXBDb3B5LCBzdHVkZW50U3RhdHVzRGVlcENvcHkpOy8vIFZlcmFyYmVpdHVuZyBkZXIgZW1wZmFuZ2VuZW4gRGF0ZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAoJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0pICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgLy8gcHJldmVudCBmb2N1cyB3YXJuaW5nIGJsb2NrIGlmIG5vIGNvbm5lY3Rpb24gXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gaWYgbm90IGNvbm5lY3RlZCBidXQgc3RpbGwgaW4gZXhhbSBtb2RlIHlvdSBjb3VsZCB0cmlnZ2VyIGEgZm9jdXMgd2FybmluZyBhbmQgbm9ib2R5IGlzIGFibGUgdG8gdW5sb2NrIHlvdVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIGFzeW5jIHNlbmRTY3JlZW5zaG90KCl7XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXtyZXR1cm59ICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjazsgLy8gVmFyaWFibGVuIGF1XHUwMERGZXJoYWxiIGRlcyBpZi1CbG9ja3MgZGVmaW5pZXJlblxuICAgICAgICAgICAgbGV0IGltZ0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIHNjcmVlbnNob3QgZnJvbSBkZXNrdG9wIHZpYSBzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCAoZmxhbWVzaG90LCBpbWFnZW1hZ2ljLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3QoeyBmb3JtYXQ6ICdwbmcnIH0pO1xuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2ssIGltZ0J1ZmZlciB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7ICAvLyBrZWluIGltYWdlQnVmZmVyIG1pdGdlZ2ViZW4gYmVkZXV0ZXQgbnV0emUgc2NyZWVuc2hvdC1kZXNrdG9wIGltIHdvcmtlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcykgeyB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDA7fVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbWFnZSBwcm9jZXNzaW5nIGZhaWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIFwic2NyZWVuc2hvdFwiIGZyb20gYXBwd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Rm9jdXNlZE1pbmRvdyA9IFdpbmRvd0hhbmRsZXIuZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSAgLy9yZXR1cm5zIGV4YW0gd2luZG93IGlmIG5vdGhpbmcgaW4gZm9jdXMgb3IgbWFpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRGb2N1c2VkTWluZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY3VycmVudEZvY3VzZWRNaW5kb3cud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKSAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIHdvcmsgYmVjYXVzZSBpdCdzIG9uYm9hcmQgZWxlY3Ryb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IHJlc3VsdC50b1BORygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgLy8gYXR0ZW50aW9uIHByb2Nlc3NJbWFnZSAgY29udmVydHMgYnVmZmVyIHRvIHVpbnQ4YXJyYXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzICs9MTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IHByb2Nlc3NJbWFnZSBmYWlsZWQ6ICR7ZXJyfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNQUNPUyBXT1JLQVJPVU5EIC0gc3dpdGNoIHRvIHBhZ2VjYXB0dXJlIGlmIG5vIHBlcm1pc3NvbnMgYXJlIGdyYW50ZWRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgJiYgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCAmJiBpbWdCdWZmZXIgIT09IG51bGwpeyAgLy90aGlzIGlzIGZvciBtYWNPUyBiZWNhdXNlIGl0IGRlbGl2ZXJzIGEgYmxhbmsgYmFja2dyb3VuZCBzY3JlZW5zaG90IHdpdGhvdXQgcGVybWlzc2lvbnMuIHdlIGNhdGNoIHRoYXQgY2FzZSB3aXRoIGEgd29ya2Fyb3VuZFxuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSBmYWxzZSAgIC8vbmV2ZXIgZG8gdGhpcyBhZ2FpblxuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBhcHAuaXNQYWNrYWdlZCA/IHBhdGguam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycpIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhOiB7IHRleHQgfSB9ICAgPSBhd2FpdCBUZXNzZXJhY3QucmVjb2duaXplKGltZ0J1ZmZlciAsICdlbmcnLHsgbGFuZ1BhdGg6IHB1YmxpY1BhdGggfSApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwV2luZG93VmlzaWJsZSA9IHRleHQuaW5jbHVkZXMoXCJFeGFtXCIpICAgLy9jaGVjayBpZiB0aGUgd29yZCBcIkV4YW1cIiBjYW4gYmUgZm91bmQgaW4gc2NyZWVuc2hvdCAtIG90aGVyd2lzZSBpdCBpcyBtb3N0IGxpa2VseSBhIGJsYW5rIGRlc2t0b3AgLSBtYWNvcyBxdWlya1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFwcFdpbmRvd1Zpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IFBsZWFzZSBjaGVjayB5b3VyIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgLSBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBNYWNPUyBzY3JlZW5zaG90cGVybWlzc2lvbnMgY2hlY2sgT0tcIik7fVxuICAgICAgICAgICAgICAgIH1jYXRjaChlcnIpeyAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gaWYgc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2UgZG8gbm90IGhhdmUgYSBzY3JlZW5zaG90IC0gc28gZG8gbm90IHVwZGF0ZSB0aGUgc2VydmVyXG4gICAgICAgICAgICBpZiAoIXNjcmVlbnNob3RCYXNlNjQpe1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU2NyZWVuc2hvdCBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVgKSB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFBhZ2VDYXB0dXJlIGVycm9yIC0+IFN3aXRjaGluZyB0byBOby1Qcm9jZXNzaW5nYCkgfSAgIFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBubyBzY3JlZW5zaG90IGF2YWlsYWJsZSAtIHBsZWFzZSBmaXggeW91ciBzZXR1cGApIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuXG5cblxuICAgICAgICAgICAgLy9kbyBub3QgcnVuIGNvbG9yY2hlY2sgaWYgYWxyZWFkeSBsb2NrZWRcbiAgICAgICAgICAgIGlmICggdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyl7XG4gICAgICAgICAgICAgICAgaWYgKGlzYmxhY2spe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgZml0IHJlcXVpcmVtZW50cyAoYWxsYmxhY2spXCIpO1xuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBsZXQgc2NyZWVuc2hvdGhhc2ggPSBudWxsXG4gICAgICAgICAgICB0cnkgeyBzY3JlZW5zaG90aGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICB9ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogY3JlYXRpbmcgaGFzaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3Q6IHNjcmVlbnNob3RCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGhhc2g6IHNjcmVlbnNob3RoYXNoLFxuICAgICAgICAgICAgICAgIGhlYWRlcjogaGVhZGVyQmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RmaWxlbmFtZTogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiArIFwiLmpwZ1wiLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHNlbmQgc2NyZWVuc2hvdCB0byBzZXJ2ZXIgdmlhIGVtYWlsIGZldGNoIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBhdHRlbXB0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAyO1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZXNjcmVlbnNob3RgO1xuICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCwgbWF4UmV0cmllcyk7IC8vIEVyc3RlIEFuZnJhZ2Ugc3RhcnRlblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cbiAgICBkb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCA9IDAsIG1heFJldHJpZXMpIHtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBTdGF0dXMgRXJyb3I6XCIsIGRhdGEubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heFJldHJpZXMgLSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCArIDEsIG1heFJldHJpZXMpOyAvLyBSZXRyeVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRlbXB0ID09PSBtYXhSZXRyaWVzIC0gMSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGUgKGZldGNoKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuICAgIGFzeW5jIGtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lja1N0dWRlbnQ6IFN0dWRlbnQgZ290IGtpY2tlZCBieSBUZWFjaGVyXCIpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge2RlbGZvbGRlcm9uZXhpdDogZmFsc2V9ICAvLyBkbyBub3QgZGVsZXRlIGZvbGRlciBvbiBleGl0IGJlY2F1c2Ugc3R1ZGVudCBnb3Qga2lja2VkXG4gICAgICAgIGlmIChzdHVkZW50c3RhdHVzICYmIHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyKXsgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9IHRydWV9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogcmVhY3QgdG8gc2VydmVyIHN0YXR1cyBcbiAgICAgKiB0aGlzIGN1cnJlbnRseSBvbmx5IGhhbmRsZSBzdGFydGV4YW0gJiBlbmRleGFtXG4gICAgICogY291bGQgYWxzbyBoYW5kbGUga2ljaywgZm9jdXNyZXN0b3JlLCBhbmQgZXZlbiB0cmlnZ2VyIGZpbGUgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJzdGF0dXMsIHN0dWRlbnRzdGF0dXMpe1xuICAgICAgIFxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGluZGl2aWR1YWwgc3RhdHVzIHVwZGF0ZXNcblxuICAgICAgICBpZiAoIHN0dWRlbnRzdGF0dXMgJiYgT2JqZWN0LmtleXMoc3R1ZGVudHN0YXR1cykubGVuZ3RoICE9PSAwKSB7ICAvLyB3ZSBoYXZlIHN0YXR1cyB1cGRhdGVzICh0YXNrcykgLSBkbyBpdCFcbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnByaW50ZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2RlbmllZCcpICAgLy90cmlnZ2VyLCB3aHlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMua2lja2VkKSB7ICAvLyBzdHVkZW50IGdvdCBraWNrZWQgYnkgdGVhY2hlclxuICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cylcbiAgICAgICAgICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyXCIpXG4gICAgICAgICAgICAgICAgbGV0IGRlbGZvbGRlciA9IHRydWVcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxuICAgICAgICAgICAgICAgICAgICBkZWxmb2xkZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyb3IpICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDYW4gbm90IGRlbGV0ZSBkaXJlY3RvcnkgLSAke2Vycm9yfSBgKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIgPT0gZmFsc2UpeyAgLy90cnkgZGVsZXRpbmcgZmlsZSBieSBmaWxlICh0aGUgb25lIHRoYXQgY2F1c2VzIHRoZSBwcm9ibGVtIHdpbGwgc3RheSBpbiB0aGUgZm9sZGVyKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7IGZzLnJtU3luYyhmaWxlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIFZlcnN1Y2hlLCBkYXMgVmVyemVpY2huaXMgcmVrdXJzaXYgenUgbFx1MDBGNnNjaGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBmcy51bmxpbmtTeW5jKGZpbGVQYXRoKTsgIH0vLyBWZXJzdWNoZSwgZGllIERhdGVpIHp1IGxcdTAwRjZzY2hlbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogKGRlbGZvbGRlcikgRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuIGRlciBEYXRlaS9WZXJ6ZWljaG5pczogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mb2N1cyA9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHJlc3RvcmluZyBmb2N1cyBzdGF0ZSBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSB0cnVlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IGZhbHNlICApe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IHRydWUgIC8vY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjayB3aWxsIGJlIHB1dCBvbiB0aGlzLnByaXZhdGVTcGVsbGNoZWNrIGluIGVkaXRvciB1cGRhdGVkIHZpYSBmZXRjaEluZm8oKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlwY01haW4uZW1pdChcInN0YXJ0TGFuZ3VhZ2VUb29sXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IGZhbHNlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBkZS1hY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IGZhbHNlIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLnN1Z2dlc3Rpb25zID0gc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5zZW5kZXhhbSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRXhhbVRvVGVhY2hlcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mZXRjaGZpbGVzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RGaWxlRnJvbVNlcnZlcihzdHVkZW50c3RhdHVzLmZpbGVzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ2V0bWF0ZXJpYWxzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGFuIG1pY3Jvc29mdDM2NSB0aGluZy4gY2hlY2sgaWYgZXhhbSBtb2RlIGlzIG9mZmljZSwgY2hlY2sgaWYgdGhpcyBpcyBzZXQgLSBvdGhlcndpc2UgZG8gbm90IGVudGVyIGV4YW1tb2RlIC0gaXQgd2lsbCBmYWlsXG4gICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgc2hhcmluZyBsaW5rIC0gaXQgd2lsbCBiZSB1c2VkIGluIFwibWljcm9zb2Z0MzY1XCIgZXhhbSBtb2RlXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBzdHVkZW50c3RhdHVzLm1zb2ZmaWNlc2hhcmUgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgZ3JvdXAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgIT09IHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gc3R1ZGVudHN0YXR1cy5ncm91cCAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgXG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gZ2xvYmFsIHN0YXR1cyB1cGRhdGVzXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBTVEFSVFxuICAgICAgICAgKiBBVFRFTlRJT046IG1vdmUgdGhpcyB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIC0gaXQgaXMgdG9vIGNvbXBsZXggYW5kIHNob3VsZCBiZSBzcGxpdCB1cFxuICAgICAgICAgKiBpbiB0aGUgZnV0dXJlIHdlIHdlbGwgZGV0ZXJtaW5lIGlmIHNlY3Rpb24gc3dpdGNoIGlzIGhhbmRsZWQgYnkgdGhlIHRlYWNoZXIgb3IgYnkgdGhlIHN0dWRlbnQgYW5kIGFjdCBhY2NvcmRpbmdseVxuICAgICAgICAgKiBpZiBoYW5kbGVkIGJ5IHN0dWRlbnQgdGhlIHRlYWNoZXIgc3R0dHVzIGlzIGlnbm9yZWQgYW5kIHRoZSBzd2ljaCBzZWN0aW9uIGZ1bmN0aW9uIGlzIGNhbGxlZCBkaXJlY3RseSAocHJvYmFibHkgbW92ZSB0byBpcGNoYW5kbGVyLmpzKVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBpZiBzdHVkZW50IGlzIGluIGxvY2tlZCBzdGF0ZSBpbiBleGFtIG1vZGVcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIGN1cnJlbnQgYWN0aXZlIHNlY3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgc2VydmVyc3RhdHVzIC0gaWYgbm90IGNoYW5nZSB0byB0aGUgbmV3IHNlY3Rpb25cbiAgICAgICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbiAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2hhbmdpbmcgc2VjdGlvbiB0byAke3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9ufSAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lfSAsIEV4YW10eXBlOiAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlfWAgKVxuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRMb2NrZWRTZWN0aW9uID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uOyAvLyBDdXJyZW50IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIHNhdmluZylcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb247IC8vIE5ldyBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBsb2FkaW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1EaXIgPSB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5O1xuXG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgYWxsIGZpbGVzIGZyb20gdGhlIG9sZCBzZWN0aW9uIChpZiBleGFtIG1vZGUgaXMgXCJlZGl0b3JcIikgYW5kIHNlbmQgdG8gdGVhY2hlciAtIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPT09IFwiZWRpdG9yXCIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHNlbmRpbmcgZXhhbSB0byB0ZWFjaGVyIChmaW5hbCBzdWJtaXQpXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCBjdXJyZW50IHdvcmsgYXMgYmFzZTY0IHRvIHRlYWNoZXIgKHN0b3JlcyBwZGYgaW4gQUJHQUJFIGZvbGRlciB3aXRoIHN1Ym1pc3Npb24gbnVtYmVyKVxuICAgICAgICAgICAgICAgICAgICBsZXQgcGRmID0gYXdhaXQgdGhpcy5nZXRCYXNlNjRQREYodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2N1cnJlbnRMb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZSkgIC8vIGxvY2FsIGZ1bmN0aW9uIHRvIGdldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChwZGYuc3RhdHVzID09PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRCYXNlNjRQREZ0b1RlYWNoZXIocGRmLmJhc2U2NHBkZiwgY3VycmVudExvY2tlZFNlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgLy9iYWNrdXAgbG9jYWwgZmlsZXMgYW5kIHNlbmQgdG8gdGVhY2hlciAoYXJjaGl2ZSB3aXRoIHRpbWVzdGFtcClcblxuXG4gICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAvL3dhaXQgMSBzZWNvbmQgYW5kIGNsZWFudXAgTkVYVC1FWEFNLVNUVURFTlQtV09SS0RJUlxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMClcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBleGFtdHlwZSBpbiBjbGllbnRpbmZvXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NrZWQgc2VjdGlvbiBBRlRFUiBzYXZpbmcgdGhlIG9sZCBzdGF0ZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IG5ld0xvY2tlZFNlY3Rpb247XG5cblxuXG4gICAgICAgICAgICAgICAgLy8gTU9WRSBTZWN0aW9uIEZpbGVzIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAxOiBTQVZFIENVUlJFTlQgRVhBTURJUiBGSUxFUyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGV4YW1EaXIpICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkgeyAvLyBDaGVjayBpZiBtYWluIGRpciBleGlzdHMgYW5kIGEgc2VjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2aW5nIGNvbnRlbnQgZnJvbSBleGFtRGlyIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVQYXRoID0gYCR7ZXhhbURpcn0vJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNhdmVQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhzYXZlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IC8vIENyZWF0ZSBzYXZlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGV4YW1EaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXMubGVuZ3RofSBpdGVtcyBpbiBleGFtRGlyIHRvIHNhdmVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzU2F2ZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhvbGRQYXRoKTsgLy8gR2V0IGZpbGUgc3RhdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgYWN0dWFsIEZJTEVTLCBub3QgZGlyZWN0b3JpZXMgKGxpa2UgdGhlIHNlY3Rpb24gZm9sZGVycyB0aGVtc2VsdmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtzYXZlUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhvbGRQYXRoLCBuZXdQYXRoKTsgLy8gQ29weSBmaWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkUGF0aCk7IC8vIERlbGV0ZSBvcmlnaW5hbCBmaWxlIGZyb20gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc1NhdmVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZlZCBmaWxlICR7ZmlsZX0gdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSAoZm9sZGVyKSBpdGVtICR7ZmlsZX0gaW4gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgc2F2ZWQgJHtmaWxlc1NhdmVkfSBmaWxlcyB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgc2F2ZSAtIGV4YW1EaXIgZXhpc3RzOiAke2ZzLmV4aXN0c1N5bmMoZXhhbURpcil9LCBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDI6IExPQUQgRklMRVMgZnJvbSB0aGUgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBORVcgbG9ja2VkIHNlY3Rpb24gdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIG5ld0xvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBMb2FkaW5nIGNvbnRlbnQgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9hZFBhdGggPSBgJHtleGFtRGlyfS8ke25ld0xvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvYWRQYXRoKSkgeyAvLyBDaGVjayBpZiB0aGUgbmV3IHNlY3Rpb24gZm9sZGVyIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0gZnMucmVhZGRpclN5bmMobG9hZFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzVG9Mb2FkLmxlbmd0aH0gaXRlbXMgaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc0NvcGllZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzVG9Mb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVBhdGggPSBgJHtsb2FkUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7IC8vIEVuc3VyZSBvbmx5IGZpbGVzIGFyZSBjb3BpZWQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNvdXJjZVBhdGgsIGRlc3RQYXRoKTsgLy8gQ29weSBmaWxlIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29waWVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ29waWVkIGZpbGUgJHtmaWxlfSBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgaXRlbSAke2ZpbGV9IGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IGNvcGllZCAke2ZpbGVzQ29waWVkfSBmaWxlcyBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTmV3IGxvY2tlZCBzZWN0aW9uIGRpcmVjdG9yeSAke25ld0xvY2tlZFNlY3Rpb259IGRvZXMgbm90IGV4aXN0LiBTdGFydGluZyB3aXRoIGEgY2xlYW4gc3RhdGUuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogbmV3TG9ja2VkU2VjdGlvbiBpcyBmYWxzeSAoJHtuZXdMb2NrZWRTZWN0aW9ufSksIHNraXBwaW5nIGZpbGUgbG9hZGApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBkdXJpbmcgZm9sZGVyIG9wZXJhdGlvbiAtICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3Igc3RhY2s6ICR7ZXJyb3Iuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259LCBuZXdMb2NrZWRTZWN0aW9uOiAke25ld0xvY2tlZFNlY3Rpb259LCBleGFtRGlyOiAke2V4YW1EaXJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICogIEFjdHVhbGx5IFNXSVRDSCBFWEFNIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IG9yIHJlbGVhZCB0aGUgbmV3IGV4YW0gc2VjdGlvbiBpbiB0aGUgc2FtZSB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3cgLSBpZiB5b3UgZG9uJ3QgbmV4dC1leGFtIHdpbGwgY3Jhc2ggc2lsZW50bHkgb24gcmVsb2FkIGFuZCBzZWN0aW9uIHN3aXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpLmZvckVhY2god2MgPT4geyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzd2l0Y2hFeGFtU2VjdGlvbjogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgYW5kIHJlb3BlbiBpdCB3aXRoIHRoZSBuZXcgZXhhbSBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cub25jZSgnY2xvc2VkJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBFTkRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgIFxuXG5cbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2spIHsgIHRoaXMuYWN0aXZhdGVTY3JlZW5sb2NrKCkgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgKSB7IHRoaXMua2lsbFNjcmVlbmxvY2soKSB9XG5cbiAgICAgICAgLy8gc2NyZWVuc2hvdCBzYWZldHkgKE9DUiBzZWFyY2hlcyBmb3IgbmV4dC1leGFtIHN0cmluZylcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyKSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IHRydWUgIH1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IGZhbHNlICAgfVxuXG4gICAgICAgIC8vIEdyb3VwcyBoYW5kbGluZ1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZ3JvdXBzKXsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSB0cnVlfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSBmYWxzZX1cblxuICAgICAgICAvL3VwZGF0ZSBzY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgfHwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PT0gMCkgeyAvLzAgaXMgdGhlIHNhbWUgYXMgZmFsc2Ugb3IgdW5kZWZpbmVkIGJ1dCBzaG91bGQgYmUgdHJlYXRlZCBhcyBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsICE9PSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDAgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgY2hhbmdlZCB0b1wiLCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDApXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDBcbiAgICAgICAgICAgICAgICAgIGlmICggc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGRpc2FibGVkIVwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBvbGQgaW50ZXJ2YWwgYW5kIHN0YXJ0IG5ldyBpbnRlcnZhbCBpZiBzZXQgdG8gc29tZXRoaW5nIGJpZ2dlciB0aGFuIHplcm9cbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID4gMCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5pbnRlcnZhbCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAvLyByZW1vdmUgbG9ja3NjcmVlbiBpbW1lZGlhdGVseSAtIGRvbid0IHdhaXQgZm9yIHNlcnZlciBpbmZvXG4gICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSBcbiAgICAgICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIHNlbmQgYmFzZTY0IHBkZiB0byB0ZWFjaGVyXG4gICAgc2VuZEJhc2U2NFBERnRvVGVhY2hlcihiYXNlNjRwZGYsIHNlY3Rpb249MSl7XG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wcmludHJlcXVlc3QvJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn1gO1xuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGJhc2U2NHBkZixcbiAgICAgICAgICAgIHByaW50cmVxdWVzdDogZmFsc2UsICAgIFxuICAgICAgICAgICAgc3VibWlzc2lvbm51bWJlcjogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLFxuICAgICAgICAgICAgbG9ja2Vkc2VjdGlvbjogc2VjdGlvblxuICAgICAgICB9XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHsgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTsgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZSA9PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyKysgICAvLyBzdWNjZXNzZnVsIHN1Ym1pc3Npb24gLT4gaW5jcmVtZW50IG51bWJlclxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4geyAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImVkaXRvciBAIHByaW50YmFzZTY0OlwiLGVycm9yLm1lc3NhZ2UpICAgIFxuICAgICAgICB9KTsgXG4gICAgfVxuICAgIFxuXG5cblxuICAgIC8vZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAvLyBBVFRFTlRJT046IHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gaXBjaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCBzdG9yZXMgaXQgYXMgZmlsZSBpbiB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICBhc3luYyBnZXRCYXNlNjRQREYoc3VibWlzc2lvbm51bWJlciwgc2VjdGlvbm5hbWUsIHByaW50QmFja2dyb3VuZD1mYWxzZSl7XG4gICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgIFxuICAgICAgICAvLyBXYWl0IGZvciBhbnkgb25nb2luZyBwcmludCBvcGVyYXRpb24gdG8gZmluaXNoIChtYXggMzAgc2Vjb25kcylcbiAgICAgICAgbGV0IHdhaXRDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFdhaXQgPSAzMDA7IC8vIDMwIHNlY29uZHMgd2l0aCAxMDBtcyBpbnRlcnZhbHNcbiAgICAgICAgd2hpbGUgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiAmJiB3YWl0Q291bnQgPCBtYXhXYWl0KSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMCk7XG4gICAgICAgICAgICB3YWl0Q291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IHByaW50VG9QREYgbG9jayB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgc3RpbGwgcnVubmluZ1wiKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJQREYgZ2VuZXJhdGlvbiB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgaW4gcHJvZ3Jlc3NcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogcHJpbnRCYWNrZ3JvdW5kLFxuICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG5cbiAgXG4gICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7c2VjdGlvbm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDtBYmdhYmU6ICR7c3VibWlzc2lvbm51bWJlcn08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0gLSBWZXJzaW9uICR7c3VibWlzc2lvbm51bWJlcn1cImApO1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0IGxvY2sgYmVmb3JlIHN0YXJ0aW5nIFBERiBnZW5lcmF0aW9uXG4gICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0cGRmID0gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2Jhc2U2NHBkZn1gO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwiUERGIGdlbmVyYXRlZFwiLCBkYXRhVXJsOmRhdGFVcmwsIGJhc2U2NHBkZjogYmFzZTY0cGRmLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogRXJyb3IgZ2VuZXJhdGluZyBQREY6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcnJvciBnZW5lcmF0aW5nIFBERlwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gQWx3YXlzIHJlbGVhc2UgdGhlIGxvY2ssIGV2ZW4gaWYgYW4gZXJyb3Igb2NjdXJyZWRcbiAgICAgICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2hvdyB0ZW1wb3Jhcnkgc2NyZWVubG9jayB3aW5kb3dcbiAgICBhY3RpdmF0ZVNjcmVlbmxvY2soKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuICAgICAgIFxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPT0gMCl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gdHJ1ZVxuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpICAvLyBhZGQgc2NyZWVubG9jayB3aW5kb3dzIGZvciBhZGRpdGlvbmFsIGRpc3BsYXlzXG4gICAgICAgICAgICB9IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIHRlbXBvcmFyeSBzY3JlZW5sb2Nrd2luZG93XG4gICAga2lsbFNjcmVlbmxvY2soKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbmxvY2t3aW5kb3cgJiYgIXNjcmVlbmxvY2t3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWxsU2NyZWVubG9jazogbm8gZnVuY3Rpb25hbCBzY3JlZW5sb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICB9IFxuICAgICAgICAvLyBDbGVhciBhcnJheSBjb21wbGV0ZWx5IGFmdGVyIGF0dGVtcHRpbmcgdG8gZGVzdHJveSBhbGwgd2luZG93c1xuICAgICAgICAvLyBUaGUgY2xvc2VkIGV2ZW50IGhhbmRsZXIgd2lsbCBhbHNvIGNsZWFuIHVwLCBidXQgdGhpcyBlbnN1cmVzIHRoZSBhcnJheSBpcyBlbXB0eVxuICAgICAgICBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gZmFsc2VcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0cyBleGFtIG1vZGUgZm9yIHN0dWRlbnRcbiAgICAgKiBkZWxldGVzIHdvcmtmb2xkZXIgY29udGVudHMgKGlmIHNldClcbiAgICAgKiBvcGVucyBhIG5ldyB3aW5kb3cgaW4ga2lvc2sgbW9kZSB3aXRoIHRoZSBnaXZlbiBleGFtdHlwZVxuICAgICAqIGVuYWJsZXMgdGhlIGJsdXIgbGlzdGVuZXIgYW5kIGFjdGl2YXRlcyByZXN0cmljdGlvbnMgKGRpc2FibGUga2V5Ym9hcnNob3J0Y3V0cyBldGMuKVxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgZXhhbW1vZGUsIGV4YW10eXBlLCBhbmQgb3RoZXIgc2V0dGluZ3MgZnJvbSB0aGUgdGVhY2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgZGlhbG9nIGlzIG9wZW4gYW5kIGxvZyB3YXJuaW5nXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4aXRXYXJuaW5nT3BlbiB8fCBXaW5kb3dIYW5kbGVyLmV4aXRRdWVzdGlvbk9wZW4gfHwgV2luZG93SGFuZGxlci5taW5pbWl6ZVdhcm5pbmdPcGVuKSB7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBEaWFsb2cgaXMgc3RpbGwgb3BlbiAtIGV4YW0gd2lsbCBzdGFydCBhbnl3YXlcIilcbiAgICAgICAgfVxuICBcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgIFxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uY21hcmdpbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmNtYXJnaW4gIC8vIHRoaXMgaXMgdXNlZCB0byBjb25maWd1cmUgbWFyZ2luIHNldHRpbmdzIGZvciB0aGUgZWRpdG9yXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubGluZXNwYWNpbmcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5saW5lc3BhY2luZyAvLyB3ZSB0cnkgdG8gZG91YmxlIGxpbmVzcGFjaW5nIG9uIGRlbWFuZCBpbiBwZGYgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5hdWRpb1JlcGVhdCA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmF1ZGlvUmVwZWF0IC8vIHJlc3RyaWN0IHJlcGV0aXRpb24gb2YgYXVkaW8gZmlsZXMgKGZvciBsaXN0ZW5pbmcgY29tcHJlaGVuc2lvbilcblxuICAgICAgICBpZiAoIVdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogY3JlYXRpbmcgZXhhbSB3aW5kb3dcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVFeGFtV2luZG93KHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3JlY29ubmVjdCBpbnRvIGFjdGl2ZSBleGFtIHNlc3Npb24gd2l0aCBleGFtIHdpbmRvdyBhbHJlYWR5IG9wZW5cbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBmb3VuZCBleGlzdGluZyBFeGFtd2luZG93Li5cIilcbiAgICAgICAgICAgIHRyeSB7ICAvLyBzd2l0Y2ggZXhpc3Rpbmcgd2luZG93IGJhY2sgdG8gZXhhbSBtb2RlXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKSBcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0RnVsbFNjcmVlbih0cnVlKSAgLy9nbyBmdWxsc2NyZWVuIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSAgLy9tYWtlIHN1cmUgdGhlIHdpbmRvdyBpcyAxIGxldmVsIGFib3ZlIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMCkgLy8gd2FpdCBhbiBhZGRpdGlvbmFsIDIgc2VjIGZvciB3aW5kb3dzIHJlc3RyaWN0aW9ucyB0byBraWNrIGluICh0aGV5IHN0ZWFsIGZvY3VzKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmFkZEJsdXJMaXN0ZW5lcigpO1xuICAgICAgICAgICAgICAgICAgICAvLyBGb3IgcmVjb25uZWN0OiBpbml0aWFsaXplIGJsb2NrIHdpbmRvd3MgYWZ0ZXIgd2luZG93IGlzIHJlcG9zaXRpb25lZFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IC8vZXhhbXdpbmRvdyB2YXJpYWJsZSBpcyBzdGlsbCBzZXQgYnV0IHRoZSB3aW5kb3cgaXMgbm90IG1hbmFnYWJsZSBhbnltb3JlIChtYW51YWxseSBjbG9zZWQgaW4gZGV2IG1vZGU/KVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBubyBmdW5jdGlvbmFsIGV4YW13aW5kb3cgZm91bmQuLiByZXNldHRpbmdcIilcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgIC8vZXhhbXdpbmRvdyBpcyBnaXZlbiBidXQgbm90IHVzZWQgaW4gZGlzYWJsZVJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gIC8vIGluIHRoYXQgY2FzZS4uIHdlIGFyZSBmaW5pc2hlZCBoZXJlICFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBOb3RlOiBGb3IgbmV3IGV4YW0gd2luZG93cywgaW5pdEJsb2NrV2luZG93cygpIGlzIGNhbGxlZCBpbiBkaWQtZmluaXNoLWxvYWQgaGFuZGxlclxuICAgICAgICAvLyB0byBlbnN1cmUgd2luZG93IGlzIGZ1bGx5IHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgRXhhbSBtb2RlXG4gICAgICogY2xvc2VzIGV4YW0gd2luZG93XG4gICAgICogZGlzYWJsZXMgcmVzdHJpY3Rpb25zIGFuZCBibHVyIFxuICAgICAqL1xuICAgIGFzeW5jIGVuZEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgXG4gICAgICAgIFdpbmRvd0hhbmRsZXIucmVtb3ZlQmx1ckxpc3RlbmVyKCk7XG4gICAgICBcbiAgICAgICAgLy9vbmx5IGRpc2FibGUgcmVzdHJpY3Rpb25zIGlmIG5vdCBpbiBleGFtIG1vZGUgKCBzZXJpb3N1bHkuLiBob3cgY291bGQgdGhpcyBldmVyIGhhcHBlbj8gKVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIHN0dWRlbnRzIHdvcmsgb24gc3R1ZGVudHMgcGMgKG1ha2VzIHNlbnNlIGlmIGV4YW0gaXMgd3JpdHRlbiBvbiBzY2hvb2wgcHJvcGVydHkpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMgJiYgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyIG9uIGV4aXRcIilcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogXCIsZXJyb3IpOyB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAvLyBpbiBzb21lIGVkZ2UgY2FzZXMgaW4gZGV2ZWxvcG1lbnQgdGhpcyBpcyBzZXQgYnV0IHN0aWxsIHVudXNhYmxlIC0gdXNlIHRyeS9jYXRjaCAgIFxuICAgICAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgdGhpcy5jb25maWcuc2hvd2RldnRvb2xzKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsV2ViQ29udGVudHMgPSB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgd2Mgb2YgYWxsV2ViQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgd2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFdhaXQgZm9yIGFsbCBEZXZUb29scyB0byBiZSBjbG9zZWQgYmVmb3JlIGNsb3NpbmcgdGhlIGV4YW0gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGFsbCBjbG9zZURldlRvb2xzKCkgY2FsbHMgYXJlIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhbHdheXMgdHJ5IHRvIGNsb3NlIHRoZSBleGFtIHdpbmRvdyBzYWZlbHkgYWZ0ZXIgZGV2dG9vbHMgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06ICcsZSl9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBibG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBubyBmdW5jdGlvbmFsIGJsb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH1cbiAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICBcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGxhbmd1YWdlVG9vbFNlcnZlci5sYW5ndWFnZVRvb2xQcm9jZXNzKXtcbiAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdG9wU2VydmVyKCk7IC8vIEtpbGwgTGFuZ3VhZ2VUb29sIHNlcnZlciB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICB9XG4gICAgICAgIC8vIGFzayBzdHVkZW50IHRvIHF1aXQgYXBwIGFmdGVyIGZpbmlzaGluZyBleGFtXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuc2hvd0V4aXRRdWVzdGlvbigpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIGV4YW13aW5kb3cgb25seSB3aGVuIG5vIHByaW50VG9QREYgb3BlcmF0aW9uIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBjbG9zZUV4YW1XaW5kb3dTYWZlbHkoKXtcbiAgICAgICAgY29uc3QgZXhhbVdpbiA9IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICBpZiAoIWV4YW1XaW4peyByZXR1cm4gfVxuXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogcHJpbnRUb1BERiBpbiBwcm9ncmVzcyAtIHJldHJ5IGluIDFzXCIpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKSB9LCAxMDAwKSAvLyByZXRyeSB1bnRpbCBwcmludGluZyBpcyBmaW5pc2hlZFxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFleGFtV2luLmlzRGVzdHJveWVkPy4oKSl7XG4gICAgICAgICAgICAgICAgZXhhbVdpbi5jbG9zZSgpIC8vIG5vcm1hbCBjbG9zZSwgb24oJ2Nsb3NlJykgaGFuZGxlciBkb2VzIHRoZSByZXN0XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IGVycm9yIHdoaWxlIGNsb3NpbmcgZXhhbXdpbmRvd1wiLCBlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIG1hbnVhbGx5IHRyaWdnZXJlZCBpZiBjb25uZWN0aW9uIGlzIGxvc3QgZHVyaW5nIGV4YW0gLSB3ZSBhbGxvdyB0aGUgc3R1ZGVudCB0byBnZXQgb3V0IG9mIHRoZSBraW9zayBtb2RlIFxuICAgIC8vIElORk86IHRoaXMgaXMgYmFzaWNhbGx5IHJlZHVuZGFudCBcbiAgICBhc3luYyBncmFjZWZ1bGx5RW5kRXhhbSgpe1xuICAgICAgICB0aGlzLmVuZEV4YW0oKVxuICAgIH1cblxuICAgIC8vIHJlc2V0IGFsbCB2YXJpYWJsZXMgdGhhdCBzaWduYWwgb3IgbmVlZCBhIHZhbGlkIHRlYWNoZXIgY29ubmVjdGlvblxuICAgIHJlc2V0Q29ubmVjdGlvbigpe1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gd2UgYXJlIGZvY3VzZWQgXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlICAgLy8gZG8gbm90IHNldCB0byBmYWxzZSB1bnRpbCBleGFtIHdpbmRvdyBpcyBhY3R1YWxseSBjbG9zZWQgICh0aGlzIGlzIGRvbmUgaW4gZW5kRXhhbSgpKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRpbWVzdGFtcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IGZhbHNlICAvLyB0aGlzIGNoZWNrIGhhcHBlbnMgb25seSBhdCB0aGUgYXBwbGljYXRpb24gc3RhcnQuLiBkbyBub3QgcmVzZXQgb25jZSBzZXRcbiAgICB9XG4gXG5cblxuXG4gICAgLyoqXG4gICAgICogZGllc2UgbWV0aG9kZSBob2x0IHNpY2gsIGRpZSB2b20gdGVhY2hlciB6dW0gZG93bmxvYWQgYmVyZWl0Z2VsZWd0ZW4gZGF0ZWllblxuICAgICAqIFx1MDBGQ2JlciBkYXMgdXBkYXRlIGludGVydmFsIHdpcmQgZGVyIHRyaWdnZXIgenVtIGRvd25sb2FkIHVuZCBkaWUgZmlsZWxpc3QgZXJoYWx0ZW5cbiAgICAgKiBAcGFyYW0geyp9IGZpbGVzIFxuICAgICAqL1xuICAgIHJlcXVlc3RGaWxlRnJvbVNlcnZlcihmaWxlcyl7XG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgYmFja3VwZmlsZSA9IGZhbHNlXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKGZpbGUubmFtZSAmJiBmaWxlLm5hbWUuaW5jbHVkZXMoJ2JhaycpKXsgICAvLyB0aGlzIHdpbGwgYWx3YXlzIHNldCB0aGUgbGFzdCBiYWsgZmlsZSBhcyBiYWNrdXAgZmlsZSBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGJhayBmaWxlXG4gICAgICAgICAgICAgICAgYmFja3VwZmlsZSA9IGZpbGUubmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuXG4gICAgICAgIC8vIERhdGVuIGZcdTAwRkNyIGRlbiBQT1NULVJlcXVlc3Qgdm9yYmVyZWl0ZW5cbiAgICAgICAgbGV0IGRhdGEgPSBKU09OLnN0cmluZ2lmeSh7ICdmaWxlcyc6IGZpbGVzLCAndHlwZSc6ICdzdHVkZW50ZmlsZXJlcXVlc3QnIH0pO1xuXG4gICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2Rvd25sb2FkLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogZGF0YSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHRva2VuLmNvbmNhdCgnLnppcCcpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVwYXRoLCBCdWZmZXIuZnJvbShidWZmZXIpLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoZXJyKTsgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3QoYWJzb2x1dGVGaWxlcGF0aCwgeyBkaXI6IHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkgfSkgXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IGZpbGVzIHJlY2VpdmVkIGFuZCBleHRyYWN0ZWRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyAvLyBWZXJ3ZW5kdW5nIGRlciBQcm9taXNlLWJhc2llcnRlbiBBUEkgdm9uIGZzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWNrdXBmaWxlICYmIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiYWNrdXAnLCBiYWNrdXBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBUcmlnZ2VyIFJlcGxhY2UgRXZlbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYENvbW11bmljYXRpb25IYW5kbGVyIC0gcmVxdWVzdEZpbGVGcm9tU2VydmVyOiAke2Vycn1gKSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgc2VuZEV4YW1Ub1RlYWNoZXIoKXtcbiAgICAgICAgLy9zZW5kIHNhdmUgdHJpZ2dlciB0byBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vdGhlcmUgaXMgYSBydW5uaW5nIGV4YW0gLSBzYXZlIGN1cnJlbnQgd29yayBmaXJzdCFcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ3NhdmUnLCd0ZWFjaGVycmVxdWVzdCcpICAgLy90cmlnZ2VyLCB3aHkgICh0ZWFjaGVycmVxdWVzdCB3aWxsIGFsc28gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKCkgYnV0IG9ubHkgYWZ0ZXIgc2F2aW5nIHRoZSBwZGYgaXMgY29tcGxldGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpeyBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYENvbW11bmljYXRpb24gaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiBDb3VsZCBub3Qgc2F2ZSBzdHVkZW50cyB3b3JrLiBJcyBleGFtbW9kZSBhY3RpdmU/YClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgIC8vIG5vdCBydW5uaW5nIGV4YW0gKHByb2JhYmx5IHVzaW5nIG5leHQtZXhhbSBhcyBjbGFzc3Jvb21tYW5hZ21lbnQgdG9vbClcbiAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpICAgLy96aXAgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXIgYXBpXG4gICAgICAgIH1cblxuICAgICB9XG5cblxuICAgICAgLy96aXAgY29uZmlnLndvcmsgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXJcbiAgICAgYXN5bmMgc2VuZFRvVGVhY2hlcigpe1xuICAgICAgICB0cnkgeyBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSk7IH1cbiAgICAgICAgfWNhdGNoIChlKXsgbG9nLmVycm9yKGUpfVxuXG4gICAgICAgIC8vICB0aGlzIGlzIHRoZSBsb2dmaWxlIHBhdGggdHJ5IHRvIGNvcHkgdGhlIGxvZ2ZpbGUgdG8gdGhlIGV4YW1kaXJlY3RvcnkgYmVmb3JlIG1ha2luZyB0aGUgemlwIGZpbGVcbiAgICAgICAgbGV0IGxvZ2ZpbGVwYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGU7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvZ2ZpbGVwYXRoKSl7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhsb2dmaWxlcGF0aCwgam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJykpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kVG9UZWFjaGVyOiBjb3VsZCBub3QgY29weSBsb2dmaWxlIHRvIGV4YW1kaXJlY3RvcnknKTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHppcGZpbGVuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lLmNvbmNhdCgnLnppcCcpXG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgXG5cbiAgICAgICAgbGV0IGJhc2U2NEZpbGUgPSBudWxsXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnppcERpcmVjdG9yeSh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB6aXBmaWxlcGF0aClcbiAgICAgICAgICAgIGNvbnN0IGZpbGVDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHppcGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGJhc2U2NEZpbGUgPSBmaWxlQ29udGVudC50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgIH1jYXRjaCAoZSl7ICBsb2cuZXJyb3IoZSkgIH1cblxuICAgICAgICAvLyBzZW5kaW5nIHRoZSB3aG9sZSBkaXJlY3RvcnkgYXMgemlwIGZpbGUgYmFzZTY0ZW5jb2RlZCB2aWEgSlNPTiBpc24ndCBwcm9iYWJseSB0aGUgYmVzdCBtZXRob2QgYnV0IGl0IHdvcmtzIHdoaWxlIGFsbCBmb3JtRGF0YSBhcHByb2FjaGVzIGZhaWxlZCB3aXRoXG4gICAgICAgIC8vIGZldGNoKCkgd2hpbGUgdGhleSB3b3JrZWQgd2l0aCBheCBpb3MoKSAtIG5vdCBldmVuIGNoYXRncHQgb3Igc3RhY2tvdmVyZmxvdyBjb3VsZCBoZWxwIF5eIGkgdGhpbmsgaXQgaXMgcmVsYXRlZCB0byB0aGUgc3BlY2lmaWMgZm9ybURhdGEgbW9kdWxlIHRoYXQgY2FudCBiZSBpbXBvcnRlZCB3aXRob3V0IFwid2luZG93IGVycm9yXCJcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9yZWNlaXZlLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gO1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGZpbGU6IGJhc2U2NEZpbGUsIGZpbGVuYW1lOiB6aXBmaWxlbmFtZSB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgICAgICAudGhlbihkYXRhID0+IHsgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IHRlYWNoZXIgcmVzcG9uc2U6ICR7ZGF0YS5tZXNzYWdlfWApOyB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge2xvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogJHtlcnJvcn1gKTsgfSk7XG4gICAgIH1cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gb3V0UGF0aDogL3BhdGgvdG8vY3JlYXRlZC56aXBcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB6aXBEaXJlY3Rvcnkoc291cmNlRGlyLCBvdXRQYXRoKSB7XG4gICAgICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcignemlwJywgeyB6bGliOiB7IGxldmVsOiA5IH19KTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGFyY2hpdmVcbiAgICAgICAgICAgIC5kaXJlY3Rvcnkoc291cmNlRGlyLCBmYWxzZSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXG4gICAgICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICAgIDtcbiAgICAgICAgc3RyZWFtLm9uKCdjbG9zZScsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICAgICAgfSkuY2F0Y2goIGVycm9yID0+IHsgbG9nLmVycm9yKGVycm9yKX0pO1xuICAgIH1cblxuXG5cblxuXG5cbiAgICAvLyB0aW1lb3V0IFxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICBcbiB9XG4gXG4gZXhwb3J0IGRlZmF1bHQgbmV3IENvbW1IYW5kbGVyKClcbiBcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgbmV0IGZyb20gJ25ldCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7dH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0e2lwY01haW4sIGNsaXBib2FyZCxhcHAsIHdlYkNvbnRlbnRzfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IG1hbW1vdGggZnJvbSAnbWFtbW90aCc7XG5cbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXInO1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vdHJheW1lbnUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTmV0d29ya09yUmVzZXQgfSBmcm9tICcuL3Rlc3RwZXJtaXNzaW9uc01hYy5qcyc7XG5pbXBvcnQgeyBnZXRXbGFuSW5mbyB9IGZyb20gJy4vZ2V0d2xhbmluZm8uanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25zdCBjaGVja1BvcnRPcGVuID0gKHBvcnQsIGhvc3QgPSAnMTI3LjAuMC4xJywgdGltZW91dCA9IDE1MDApID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgY29uc3QgZmluaXNoID0gKHJ1bm5pbmcsIGVycm9yID0gbnVsbCkgPT4ge1xuICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHJlc29sdmUoeyBydW5uaW5nLCBwb3J0LCBob3N0LCBlcnJvciB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0LnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdjb25uZWN0JywgKCkgPT4gZmluaXNoKHRydWUpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ3RpbWVvdXQnLCAoKSA9PiBmaW5pc2goZmFsc2UsICd0aW1lb3V0JykpO1xuICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoZXJyKSA9PiBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb2NrZXQuY29ubmVjdChwb3J0LCBob3N0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIElQQyBoYW5kbGluZyAoQmFja2VuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlIC8vIGZsYWcgdG8gcHJldmVudCBjbG9zaW5nIHdpbmRvdyB3aGlsZSBwcmludGluZ1xuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuICAgICAgICBcblxuICAgICAgICBpcGNNYWluLm9uKCdzZXQtbmV3LWxvY2FsZScsIChldmVudCwgbG9jYWxlKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNldC1uZXctbG9jYWxlOiBzZXR0aW5nIG5ldyBsb2NhbGUgdG8gJHtsb2NhbGV9YClcbiAgICAgICAgICAgIGkxOG4ubG9jYWxlID0gbG9jYWxlXG4gICAgICAgICAgICB1cGRhdGVTeXN0ZW1UcmF5KGkxOG4ubG9jYWxlKTtcbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRFeGFtTWF0ZXJpYWxzJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgXG4gICAgICAgICAgICBsZXQgY2xpZW50aW5mbyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm9cbiAgICAgICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBsZXQgc2VydmVyaXAgPSBjbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7IFxuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhhbU1hdGVyaWFscyA9IGZhbHNlXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgICAgICAgICAgZXhhbU1hdGVyaWFscyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZ2V0ZXhhbW1hdGVyaWFscy8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6IHJlY2VpdmVkIGRhdGFcIiwgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogJHtlcnJ9YCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBleGFtTWF0ZXJpYWxzXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICBcbiAgICAgICAgfSkgXG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlc3luZGljYXRpb24uY29tXCIpKSByZXR1cm4gdHJ1ZTsgXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVudGZlcm5lIGFsdGUgTGlzdGVuZXIsIHVtIERvcHBlbC1SZWdpc3RyaWVydW5nZW4genUgdmVybWVpZGVuXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ID0gYWxsb3dlZFVybHMubWFwKHMgPT4gU3RyaW5nKHMpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY2hlY2sgaWYgVVJMIG1hdGNoZXMgYWxsb3dlZCBkb21haW4gKHN1cHBvcnRzIHN1YmRvbWFpbnMgYW5kIHBhdGhzKVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHRhcmdldFVybCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBjb21tb24gZXhjZXB0aW9ucyBmaXJzdFxuICAgICAgICAgICAgICAgIGlmIChjaGVja0NvbW1vbkV4Y2VwdGlvbnModXJsU3RyKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZWFjaCBhbGxvd2VkIFVSTFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWxsb3dlZFVybCBvZiBhbGxvdykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHBhcnNlIGFzIFVSTCB0byBleHRyYWN0IGhvc3RuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRIb3N0bmFtZSA9IHVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBhbGxvd2VkIFVSTCB0byBleHRyYWN0IGRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRVcmxPYmogPSBuZXcgVVJMKGFsbG93ZWRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbG93ZWRVcmwuaW5jbHVkZXMoJy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3MgYSBwYXRoIHdpdGhvdXQgcHJvdG9jb2wsIGV4dHJhY3QgZG9tYWluIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGFsbG93ZWRVcmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkRG9tYWluID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhhY3QgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGFsbG93ZWREb21haW4gaXMgYSBzcGVjaWZpYyBzdWJkb21haW4gKGNvbnRhaW5zIGRvdHMpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NwZWNpZmljU3ViZG9tYWluID0gYWxsb3dlZERvbWFpbi5pbmNsdWRlcygnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGVjaWZpY1N1YmRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgc3BlY2lmaWMgc3ViZG9tYWluIGlzIHNwZWNpZmllZCwgb25seSBhbGxvdyB0aGF0IGV4YWN0IHN1YmRvbWFpbiBhbmQgd3d3LiB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBhbGxvdyBvdGhlciBzdWJkb21haW5zIHdoZW4gYSBzcGVjaWZpYyBvbmUgaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIG9ubHkgYmFzZSBkb21haW4gaXMgc3BlY2lmaWVkIChlLmcuLCBcIm9yZi5hdFwiKSwgYWxsb3cgYWxsIHN1YmRvbWFpbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyB3d3cuIHN1YmRvbWFpbiBleHBsaWNpdGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBvdGhlciBzdWJkb21haW5zIChlLmcuLCBzdWIuZHVkZW4uZGUgaWYgZHVkZW4uZGUgaXMgYWxsb3dlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUuZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gdGFyZ2V0SG9zdG5hbWUuc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgcHJlZml4OiBtdXN0IGJlIHZhbGlkIHN1YmRvbWFpbiBuYW1lIChhbHBoYW51bWVyaWMgYW5kIGh5cGhlbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgVVJMIHBhcnNpbmcgZmFpbHMsIGZhbGwgYmFjayB0byBzaW1wbGUgaW5jbHVkZXMgY2hlY2sgZm9yIHBhdGhzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsU3RyLmluY2x1ZGVzKGFsbG93ZWRVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmIChpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBhbGxvd2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmICghaXNBbGxvd2VkKSB7IFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFVuaWZpZWQgSVBDIGhhbmRsZXIgZm9yIHdlYnZpZXcgYmxvY2tpbmcgLSBzdXBwb3J0cyB3ZWJzaXRlLCBlZHV2aWR1YWwsIGZvcm1zLCByZHAgbW9kZXNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZSwgYWxsb3dlZERvbWFpbiwgYmFzZVVybCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIHRvIHByZXZlbnQgZHVwbGljYXRlIHJlZ2lzdHJhdGlvbnNcbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVUkwgdmFsaWRhdGlvbiBmdW5jdGlvbiAtIGRpZmZlcmVudCBsb2dpYyBiYXNlZCBvbiBtb2RlXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdFQlNJVEUgbW9kZTogY2hlY2sgZG9tYWluIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsIHx8IHRhcmdldFVybC5pbmNsdWRlcyhiYXNlVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG9tYWluID0gdXJsT2JqLmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4cGxpY2l0bHkgYWxsb3cgd3d3LiBzdWJkb21haW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbi5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGRvbWFpbi5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVEVVZJRFVBTC9NT09ETEUgbW9kZTogY2hlY2sgbW9vZGxlVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vb2RsZS1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJzdGFydGF0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInByb2Nlc3NhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJlZHV2aWR1YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ0aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZm9ybXNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBGT1JNUyBtb2RlOiBjaGVjayBnZm9ybXNUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEZvcm1zLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJmb3JtUmVzcG9uc2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJyZHBcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSRFAgbW9kZTogYWxsb3cgYWxsIChvciBpbXBsZW1lbnQgc3BlY2lmaWMgbG9naWMgaWYgbmVlZGVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBtb2RlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hlY2tDb21tb25FeGNlcHRpb25zKHRhcmdldFVybCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0PVwiX2JsYW5rXCIgbGlua3MgYW5kIHdpbmRvdy5vcGVuIC0gYmxvY2sgQkVGT1JFIG5hdmlnYXRpb25cbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgd2lsbC1uYXZpZ2F0ZSBvbiB3ZWJDb250ZW50cyBsZXZlbCAtIHRoaXMgZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEJsb2NrIG5hdmlnYXRpb24gY29tcGxldGVseSAtIHRoaXMgaGFwcGVucyBCRUZPUkUgcGFnZSBsb2Fkc1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7IC8vIFN0b3AgYW55IGxvYWRpbmcgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbGlhcyBmb3IgZWR1dmlkdWFsIG1vZGUgLSByZWRpcmVjdHMgdG8gdW5pZmllZCBoYW5kbGVyXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3ItZWR1dmlkdWFsLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSkgPT4ge1xuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgdW5pZmllZCBoYW5kbGVyIHdpdGggZWR1dmlkdWFsIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IHVuaWZpZWRIYW5kbGVyID0gaXBjTWFpbi5saXN0ZW5lcnMoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnKVswXTtcbiAgICAgICAgICAgIGlmICh1bmlmaWVkSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmlmaWVkSGFuZGxlcihldmVudCwgeyBndWVzdElkLCBtb2RlOiAnZWR1dmlkdWFsJywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWxvYWQgdGhlIGJyb3dzZXIgdmlld1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3JlbG9hZC1icm93c2VyLXZpZXcnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsKTtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBsYW5ndWFnZVRvb2wgQVBJIFNlcnZlciAod2l0aCBKYXZhIEpSRSlcbiAgICAgICAgICogUnVucyBhdCBsb2NhbGhvc3QgODA4OFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdGl2YXRlIHNwZWxsY2hlY2sgb24gZGVtYW5kIGZvciBzcGVjaWZpYyBzdHVkZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIExhbmd1YWdlVG9vbCBzZXJ2ZXIgcmVzcG9uZHMgb24gY29uZmlndXJlZCBwb3J0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2lzTGFuZ3VhZ2VUb29sUnVubmluZycsIGFzeW5jICgpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gbGFuZ3VhZ2VUb29sU2VydmVyLnBvcnQgfHwgODA4ODtcbiAgICAgICAgICAgIGNvbnN0IGhvc3RzID0gWycxMjcuMC4wLjEnLCAnOjoxJywgJ2xvY2FsaG9zdCddO1xuICAgICAgICAgICAgLy8gUnVuIGFsbCBjaGVja3MgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZSwgdXNlIGxvbmdlciB0aW1lb3V0IGZvciBzZXJ2ZXIgc3RhcnR1cCBkZXRlY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChob3N0cy5tYXAoaG9zdCA9PiBjaGVja1BvcnRPcGVuKHBvcnQsIGhvc3QsIDI1MDApKSk7XG4gICAgICAgICAgICAvLyBSZXR1cm4gZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHQsIG9yIGxhc3QgcmVzdWx0IGlmIG5vbmUgc3VjY2VlZGVkXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzUmVzdWx0ID0gcmVzdWx0cy5maW5kKHJlc3VsdCA9PiByZXN1bHQucnVubmluZyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCB8fCByZXN1bHRzW3Jlc3VsdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBMT0NBTCBMb2NrZG93blxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9jYWxsb2NrZG93bicsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9jYWxsb2NrZG93bjogbG9ja2luZyBkb3duIGNsaWVudCB3aXRob3V0IHRlYWNoZXIgY29ubmVjdGlvblwiKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge1xuICAgICAgICAgICAgICAgIGV4YW1tb2RlOiB0cnVlLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGVsZm9sZGVyb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiAnZGUtREUnLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0VHlwZTogJycsXG4gICAgICAgICAgICAgICAgbW9vZGxlRG9tYWluOiAnJyxcbiBcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDAsXG4gICAgICAgICAgICAgICAgbXNPZmZpY2VGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zbG9ja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwaW46ICcwMDAwJyxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVubG9ja29uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZm9udGZhbWlseTogJ3NhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RJZDogJycsXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXJncy5wYXNzd29yZCxcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVzZUV4YW1TZWN0aW9uczogZmFsc2UsIC8vaWYgZmFsc2UgZXhhbSBzZWN0aW9uIDEgaXMgdXNlZCBhbmQgbm8gdGFicyBhcmUgZGlzcGxheWVkXG4gICAgICAgICAgICAgICAgYWN0aXZlU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBsb2NrZWRTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGV4YW1TZWN0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAxOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtdHlwZTogYXJncy5leGFtbW9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNtYXJnaW46IHsgc2lkZTogJ3JpZ2h0Jywgc2l6ZTogMyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXNwYWNpbmc6ICcyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvUmVwZWF0OiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBhcmdzLmxhbmd1YWdldG9vbCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiBhcmdzLnNwZWxsY2hlY2tsYW5nIHx8ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogYXJncy5zdWdnZXN0aW9ucyB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBhcmdzLmNsaWVudG5hbWU7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gXCIxMjcuMC4wLjFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IFwibG9jYWxob3N0XCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IFwiYVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gdHJ1ZTsgLy8gdGhpcyBtdXN0IGJlIHNldCB0byB0cnVlIGluIG9yZGVyIHRvIHN0b3AgdHlwaWNhbCBuZXh0LWV4YW0gY2xpZW50L3RlYWNoZXIgYWN0aW9uc1xuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGxvY2FsbG9ja2Rvd25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHZpcnR1YWxpemVkIHN0YXR1c1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ZpcnR1YWxpemVkJywgKCkgPT4geyAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IHRydWU7IH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBGT0NVUyBzdGF0ZSB0byBmYWxzZSAobW91c2UgbGVmdCBleGFtIHdpbmRvdylcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZm9jdXNsb3N0JywgKGV2ZW50LCBjdHJsYWx0PWZhbHNlKSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFuc3dlciA9IGZhbHNlIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8ICF0aGlzLm11bHRpY2FzdENsaWVudC5leGFtbW9kZSkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWV9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID4gMCkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCAmJiBjdHJsYWx0ID09IGZhbHNlKXsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBmb2N1c2xvc3Q6IG1vdXNlbGVhdmUgZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBibG9jayBldmVyeXRoaW5nIGFuZCBpbmZvcm0gdGVhY2hlciAgKHByb2JhYmx5IGFuIG92ZXJraWxsIG9uIG1vdXNlbGVhdmUgLSBuZWVkcyB0ZXN0aW5nKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBhbnN3ZXJcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBtYWluIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29uZmlnICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIFVubG9jayBDb21wdXRlclxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ3JhY2VmdWxseWV4aXQnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ3JhY2VmdWxseWV4aXQ6IGdyYWNlZnVsbHkgbGVhdmluZyBsb2NrZWQgZXhhbSBtb2RlYClcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5ncmFjZWZ1bGx5RW5kRXhhbSgpIFxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgfSApXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogc3RvcCByZXN0cmljdGlvbnNcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RyaWN0aW9ucycsICgpID0+IHsgIFxuICAgICAgICAgICAgLy90aGlzIGFsc28gc3RvcHMgdGhlIGNsZWFyQ2xpcGJvYXJkIGludGVydmFsXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSBcbiAgICAgICAgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBjb3B5IHRvIGdsb2JhbCBjbGlwYm9hcmRcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NsaXBib2FyZCcsIChldmVudCwgdGV4dCkgPT4geyAgXG4gICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGxldCBhZGRyZXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkgeyAgICBhZGRyZXNzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogbXVsdGljYXN0Y2xpZW50IG5vdCBydW5uaW5nXCIpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMgYmVyZWl0cyBlaW5lIEFkcmVzc2Ugdm9yaGFuZGVuIGlzdCwgbGllZmVybiB3aXIgc2llIHp1clx1MDBGQ2NrLlxuICAgICAgICAgICAgaWYgKGFkZHJlc3MpIHsgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7ICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcnN1Y2hlLCBhbiBkaWUga29ycmVrdGUgU2Nobml0dHN0ZWxsZSB6dSBiaW5kZW5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRmFsbHMgZ2F0ZXdheTRzeW5jKCkgYmxvY2tpZXJlbmQgaXN0LCBrYW5uc3QgZHUgZGllc2VuIEF1ZnJ1ZiBpbiBlaW4gUHJvbWlzZSBwYWNrZW46XG4gICAgICAgICAgICAgICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlIH0gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnYXRld2F5NHN5bmMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHsgIHJlamVjdChlcnIpOyAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKTsgLy8gTGllZmVydCBkaWUgSVAgZGVyIFNjaG5pdHRzdGVsbGUsIHdlbGNoZSBkYXMgRGVmYXVsdCBHYXRld2F5IGhhdFxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGtlaW5lIElQIChtaXQgR2F0ZXdheSkgdmVyZlx1MDBGQ2diYXIgaXN0LCBob2xlIGVpbmUgYWx0ZXJuYXRpdmUgQWRyZXNzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCk7IC8vIExpZWZlcnQgYXVjaCBlaW5lIElQLCB3ZW5uIGtlaW4gR2F0ZXdheSB2ZXJmXHUwMEZDZ2JhciBpc3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJmXHUwMEU0bHNjaHRlIEFkcmVzc2VuICh6LiBCLiBsb2NhbGhvc3QpIGlnbm9yaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT09IFwiMTI3LjAuMC4xXCIpIHsgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7ICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBXZW5uIGRpZSBNdWx0aWNhc3QtQ2xpZW50IG5pY2h0IGxcdTAwRTR1ZnQsIGluaXRpYWxpc2llcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmICFhZGRyZXNzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmFsbHMgaW5pdCgpIGFzeW5jaHJvbiB1bWdlc2V0enQgd2VyZGVuIGthbm4sIHdhcnRlbiB3aXIgaGllciBkYXJhdWYuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBFcnJvciBpbml0aWFsaXppbmcgbXVsdGljYXN0IGNsaWVudFwiLCBlcnIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIGVkaXRvciBhcyBodG1sIGZpbGUgLSBhcyBiYWNrdXAgLSBvbmx5IHRyaWdnZXJlZCBieSB0aGUgdGVhY2hlciBmb3Igbm93IChhbGxvdyBtYW51YWwgYmFja3VwICEhKVxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAge2NsaWVudG5hbWU6dGhpcy5jbGllbnRuYW1lLCBmaWxlbmFtZTpgJHtmaWxlbmFtZX0uaHRtbGAsIGVkaXRvcmNvbnRlbnQ6IGVkaXRvcmNvbnRlbnQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVIVE1MJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBodG1sQ29udGVudCA9IGFyZ3MuZWRpdG9yY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBsZXQgaHRtbGZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSl7XG4gICAgICAgICAgICAgICAgaHRtbGZpbGVuYW1lID0gYCR7ZmlsZW5hbWV9LmJha2BcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaHRtbGZpbGUgPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgaHRtbGZpbGVuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGh0bWxDb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGh0bWxmaWxlLCBodG1sQ29udGVudCwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6ICR7ZXJyLm1lc3NhZ2V9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsdGVybmF0ZXBhdGggPSBgJHtodG1sZmlsZX0tJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufS5iYWtgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiB0cnlpbmcgdG8gd3JpdGUgZmlsZSBhczpcIiwgYWx0ZXJuYXRlcGF0aCApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGh0bWxDb250ZW50LCBmdW5jdGlvbiAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGJhc2U2NCBlbmNvZGVkIHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQREZiYXNlNjQnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldFBERmJhc2U2NDogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciA9IGFyZ3Muc3VibWlzc2lvbm51bWJlcisxIC8vIGNsaWVudGluZm8ga2VlcHMgdHJhY2sgb2Ygc3VibWlzc2lvbnMgZm9yIGF1dG9tYXRlZCBzdWJtaXNzaW9ubnVtYmVycyBhdCBzZWN0aW9uIGNoYW5nZSAtIGJ1dCB0aGlzIG9idmlvdXNseSBoYXBwZW5zIGFmdGVyIG1hbnVhbCBzdWJtaXRcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdldEJhc2U2NFBERihhcmdzLnN1Ym1pc3Npb25udW1iZXIsIGFyZ3Muc2VjdGlvbm5hbWUsIGFyZ3MucHJpbnRCYWNrZ3JvdW5kKSAgIC8vIHdoeSB0aGUgaGVsbCBpcyB0aGlzIGZ1bmN0aW9uIGxvY2F0ZWQgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgYW5kIG5vdCBpbiBpcGNoYW5kbGVyLmpzID8gRklYTUUgIVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgdGhlIEV4YW1XaW5kb3cgY29udGVudCBhcyBQREZcbiAgICAgICAgICogQVRURU5USU9OIHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgcmV0dW5zIGEgYmFzZTY0IHZlcnNpb24gb2YgdGhlIHBkZlxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ByaW50cGRmJywgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgLy8gZG8gbm90IHByaW50IGlmIGV4YW0gbW9kZSBpcyBub3QgYWN0aXZlIGFueW1vcmVcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZXhhbW1vZGUgaXMgZmFsc2UgLSBza2lwcGluZyBwcmludFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogcHJpbnQgYWxyZWFkeSBpbiBwcm9ncmVzcyAtIHNraXBwaW5nIG5ldyByZXF1ZXN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgLy8gZGVmaW5lIHByaW50IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBhcmdzLmxhbmRzY2FwZSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuICAgICAgICAgICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHthcmdzLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke2FyZ3MuY2xpZW50bmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHBkZmZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5wZGZgICAvLyBkZWZhdWx0IGZpbGVuYW1lID0gY2xpZW50bmFtZS5wZGZcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5maWxlbmFtZSl7ICAvLyBpbiBjYXNlIG9mIG1hbnVhbCBiYWNrdXAgdGhlIHVzZXIgY2FuIHNldCBhIGN1c3RvbSBmaWxlbmFtZVxuICAgICAgICAgICAgICAgICAgICBwZGZmaWxlbmFtZSA9IGAke2FyZ3MuZmlsZW5hbWV9LnBkZmBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZmZpbGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHBkZmZpbGVuYW1lKTsgIC8vIHBhdGggcG9pbnRzIHRvIHRoZSBjdXJyZW50IGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tYXV4LnBkZmAgICAgLy90aG9tYXMucGRmLWF1eC5wZGYgXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tb2xkLnBkZmA7ICAgLy90aG9tYXMucGRmLW9sZC5wZGZcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWZpbGVuYW1lKTsgIC8vIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nIHdlIHRyeSB0byB3cml0ZSBhIGRpZmZlcmVudCBmaWxlXG5cblxuICAgICAgICAgICAgICAgIC8vIGF1eCBmaWxlcyBhcmUgZmlsZXMgY3JlYXRlZCBpZiB0aGUgbWFpbiBwZGZmaWxlcGF0aCBpcyBub3Qgd3JpdGVhYmxlIChvcGVuZWQgb24gd2luZG93cykgXG4gICAgICAgICAgICAgICAgdHJ5IHsgIC8vIGFsd2F5cyBjaGVjayBmb3Igb2xkIGF1eCBmaWxlcyBhbmQgcmVuYW1lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBhbHRlcm5hdGVmaWxlbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoYWx0ZXJuYXRlcGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbVdpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICAgICAgY29uc3Qgd2ViQ29udGVudHMgPSBleGFtV2luZG93Py53ZWJDb250ZW50c1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3ZWJDb250ZW50cyl7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogbm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGUgZm9yIFBERiBtZXRhZGF0YVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZlRpdGxlID0gYXJncy5maWxlbmFtZSA/IGFyZ3MuZmlsZW5hbWUgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHthcmdzLnNlcnZlcm5hbWUgfHwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lIHx8ICcnfWBcbiAgICAgICAgICAgICAgICAvLyBlc2NhcGUgcXVvdGVzIGFuZCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIEphdmFTY3JpcHQgc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZFRpdGxlID0gcGRmVGl0bGUucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke2VzY2FwZWRUaXRsZX1cImApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcmludCB0aGUgZXhhbSB3aW5kb3cgdG8gcGRmXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgfSkudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgcGRmIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKHBkZmZpbGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKHBkZmZpbGVwYXRoKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUocGRmZmlsZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX0gLSB3cml0aW5nIGZpbGUgYXM6ICR7YWx0ZXJuYXRlcGF0aH0gYCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIGF1eCBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0ZXBhdGgpKSB7IGZzLnVubGlua1N5bmMoYWx0ZXJuYXRlcGF0aCk7IH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGYgKGFsdGVybmF0aXZlciBQZmFkKTogJHtlcnIubWVzc2FnZX1gKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGFsdGVybmF0ZSBwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKSAgIC8vbWFrZSBzdXJlIHN0dWRlbnRzIHNlZSB0aGUgbmV3IGZpbGUgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVycm9yLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlcyBBY3RpdmUgU2hlZXRzIGZvcm0gZGF0YSB0byAuYmFrIGZpbGVcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3NhdmVBY3RpdmVzaGVldHNCYWsnLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lID8gYCR7YXJncy5maWxlbmFtZX0uYmFrYCA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBiYWtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBmb3JtRGF0YSB0byBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25EYXRhID0gSlNPTi5zdHJpbmdpZnkoYXJncy5mb3JtRGF0YSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gLmJhayBmaWxlXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYWtGaWxlUGF0aCwganNvbkRhdGEsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiBzYXZlZCBmb3JtIGRhdGEgdG8gJHtiYWtGaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0JhazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgZm91bmQgU2VydmVycyBhbmQgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGluZm9hc3luYycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IGZhbHNlICAgXG4gICAgICAgICAgICAvLyBzZXJ2ZXJzdGF0dXMgb2JqZWt0IHdpcmQgbnVyIGJlaSBiZWdpbm4gZGVzIGV4YW1zIGFuIGRhcyBleGFtIHdpbmRvdyBkdXJjaGdlcmVpY2h0IGZcdTAwRkNyIGJhc2lzIGVpbnN0ZWxsdW5nZW5cbiAgICAgICAgICAgIC8vIGFsbGUgd2VpdGVyZW4gdXBkYXRlcyBcdTAwRkNiZXIgZGFzIHNlcnZlcnN0YXR1cyBvYmplY3Qgd2VyZGVuIGltIGNvbW11bmljYXRpb24gaGFuZGxlciBnZWxlc2VuIHVuZCBnZ2YuIGF1ZiBkYXMgY2xpZW50aW5mbyBvYmplY3QgZ2VsZWd0XG4gICAgICAgICAgICAvLyBkaWVzZXIga29tbXVuaWthdGlvbnNmbHVzcyBtdXNzIGluIDIuMCBnZXN0cmVhbWxpbmVkIHdlcmRlbiAjRklYTUVcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNlcnZlcnN0YXR1cyB9XG5cbiAgICAgICAgICAgIC8vY291bnQgbnVtYmVyIG9mIGZpbGVzIGluIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAvLyBlcnN0ZWxsdCBmYWxscyBuXHUwMEY2dGlnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVsaXN0ID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgcmV0dXJuIHsgICBcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsaXN0OiB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCxcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYmVjYXVzZSBvZiBtaWNyb3NvZnQgMzY1IHdlIG5lZWQgdG8gd29yayB3aXRoIFwiQnJvd3NlclZpZXdcIiBcbiAgICAgICAgICogaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBkaXNsYXkgZnVsbHNjcmVlbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBFeGFtIGhlYWRlciB3ZSB0ZW1wb3JhcmlseSBjb2xsYXBzZSB0aGUgQnJvd3NlclZpZXcgZm9yIE9mZmljZVxuICAgICAgICAgKiBhbmQgcmVzdG9yZSBpdCBhZnRlcndhcmRzIC0gbm90IHBlcmZlY3QgYnV0IGxvb2tzIG9rXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY29sbGFwc2UtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7IHg6IDAsIHk6IDAsIHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RvcmUtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IG1lbnVIZWlnaHQgPSBtYWluV2luZG93Lm1lbnVIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpOyAvLyBHZXQgdGhlIGN1cnJlbnQgYm91bmRzIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5ldyBib3VuZHMgb2YgdGhlIGNvbnRlbnRWaWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogbWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLCAvLyBmdWxsIHdpZHRoIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gbWVudUhlaWdodCAvLyByZW1haW5pbmcgaGVpZ2h0IGFmdGVyIHRoZSBtZW51XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZSBtZW51IGhlaWdodCBkeW5hbWljYWxseSB3aGVuIGhlYWRlciBjb250ZW50IGNoYW5nZXNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3VwZGF0ZS1tZW51LWhlaWdodCcsIChldmVudCwgaGVpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3c7XG4gICAgICAgICAgICBpZiAobWFpbldpbmRvdyAmJiBoZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBzdG9yZWQgbWVudSBoZWlnaHRcbiAgICAgICAgICAgICAgICBtYWluV2luZG93Lm1lbnVIZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVwb3NpdGlvbiB0aGUgYnJvd3NlciB2aWV3IHdpdGggbmV3IGhlaWdodFxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50Vmlldykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlbmRzIGEgcmVnaXN0ZXIgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gc2VydmVyIGlwXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICBjbGllbnRuYW1lOnRoaXMudXNlcm5hbWUsIHNlcnZlcm5hbWU6c2VydmVybmFtZSwgc2VydmVyaXAsIHNlcnZlcmlwLCBwaW46dGhpcy5waW5jb2RlIFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigncmVnaXN0ZXInLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSBhcmdzLmNsaWVudG5hbWVcbiAgICAgICAgICAgIGNvbnN0IHBpbiA9IGFyZ3MucGluXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJpcCA9IGFyZ3Muc2VydmVyaXBcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudGlwID0gaXAuYWRkcmVzcygpXG4gICAgICAgICAgICBjb25zdCBob3N0bmFtZSA9IG9zLmhvc3RuYW1lKClcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmNvbmZpZy52ZXJzaW9uXG4gICAgICAgICAgICBjb25zdCBiaXB1c2VySUQgPSBhcmdzLmJpcHVzZXJJRFxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7IC8vI0ZJWE1FIGRhcyBzb2xsdGUgZWlnZW50bGljaCB2b20gc2VydmVyIGtvbW1lbiBcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3JlZ2lzdGVyY2xpZW50LyR7c2VydmVybmFtZX0vJHtwaW59LyR7Y2xpZW50bmFtZX0vJHtjbGllbnRpcH0vJHtob3N0bmFtZX0vJHt2ZXJzaW9ufS8ke2JpcHVzZXJJRH1gO1xuICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gQWJvcnRTaWduYWwudGltZW91dCg4MDAwKTsgLy8gODAwMCBNaWxsaXNla3VuZGVuID0gOCBTZWt1bmRlbiBBYm9ydFNpZ25hbCBtaXQgZWluZW0gVGltZW91dFxuXG5cbiAgICAgICAgICAgIGZldGNoKHVybCwgeyBtZXRob2Q6ICdHRVQnLCBzaWduYWwgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PSBcInN1Y2Nlc3NcIikgeyAgLy8gcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWxsIG90aGVyd2lzZSBkYXRhIHdvdWxkIGJlIFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAvLyBFcmZvbGdyZWljaGUgUmVnaXN0cmllcnVuZ1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBjbGllbnRuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gc2VydmVyaXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IHNlcnZlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBjbGllbnRpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZGF0YS50b2tlbjsgLy8gd2UgbmVlZCB0byBzdG9yZSB0aGUgY2xpZW50IHRva2VuIGluIG9yZGVyIHRvIGNoZWNrIGFnYWluc3QgaXQgYmVmb3JlIHByb2Nlc3NpbmcgY3JpdGljYWwgYXBpIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IHBpbjtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCByZWdpc3Rlcjogc3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgYXQgJHtzZXJ2ZXJuYW1lfSBAICR7c2VydmVyaXB9IGFzICR7Y2xpZW50bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBkYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGV4YW0gZm9sZGVyIGluIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHVuaXF1ZWV4YW1OYW1lID0gYCR7c2VydmVybmFtZX0tJHtwaW59YFxuICAgICAgICAgICAgICAgICAgICBjb25maWcuZXhhbWRpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgdW5pcXVlZXhhbU5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudmVyc2lvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHZlcnNpb25zIGFuZCBkaXNwbGF5IG1lc3NhZ2UgKHRlYWNoZXIgbmVlZHMgdXBncmFkZS4uIGNsaWVudCBuZWVkcyB1cGdyYWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcGFyaXNvblJlc3VsdCA9IHRoaXMuY29tcGFyZVNvZnR3YXJlKGNvbmZpZy52ZXJzaW9uLCBjb25maWcuaW5mbyAsIGRhdGEudmVyc2lvbiwgZGF0YS52ZXJzaW9uaW5mbyApIC8vc2VydmVyVmVyc2lvbiwgc2VydmVyU3RhdHVzLCBsb2NhbFZlcnNpb24sIGxvY2FsU3RhdHVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHsgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCBuZXVlciBhbHMgZGllIGRlciBMZWhycGVyc29uIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IHp1IGFsdC4gTGFkZW4gc2llIHNpY2ggZWluZSBha3R1ZWxsZSBWZXJzaW9uIGhlcnVudGVyIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW5iZWthbm50ZXIgRmVobGVyIGJlaW0gVmVyYmluZHVuZ3NhdWZiYXUuXCIgfTsgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChhc3luYyBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmVobGVyYmVoYW5kbHVuZ1xuICAgICAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHsgZXJyb3JNZXNzYWdlID0gXCJUaGUgcmVxdWVzdCB0aW1lZCBvdXRcIjsgICB9IC8vIFRpbWVvdXQtTmFjaHJpY2h0IGFucGFzc2VuIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBvbiBtYWNvcyB0aGUgcGVybWlzc2lvbiBzZXR0aW5ncyBpbiByYXJlIGNhc2VzIG1lc3MgdXAgdGhlIGFiaWxpdHkgdG8gZmV0Y2ggdGhlIHRlYWNoZXIgYXBpIFxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKXsgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCB0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0KTsgXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZSA9PT0gXCJyZXNldFwiKSB7ICAgLy8gcXVpdCB0aGUgYXBwIGlmIHRoZSB1c2VyIHdhbnRzIHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNob3cgd2FybmluZyBtZXNzYWdlIGlmIHRoZSB1c2VyIGRvZXMgbm90IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcyBnaWJ0IGVpbiBQcm9ibGVtIG1pdCBkZW0gTmV0endlcmssIGRlbiBGaXJld2FsbHJlZ2VsbiBvZGVyIGRlbiBOZXR6d2Vya2JlcmVjaHRpZ3VuZ2VuISBCaXR0ZSBiZWhlYmVuIHNpZSBkaWVzZXMgUHJvYmxlbSB1bmQgc3RhcnRlbiBTaWUgTmV4dC1FeGFtIG5ldSFcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgICAgICAgICByZXR1cm47ICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBHZW9nZWJyYSBhcyBnZ2IgZmlsZSAtIGFzIGJhY2t1cCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgLCBjb250ZW50OiBiYXNlNjQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NhdmVHR0InLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhcmdzLmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgY29uc3QgcmVhc29uID0gYXJncy5yZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2F2ZUdHQjogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gQnVmZmVyLmZyb20oY29udGVudCwgJ2Jhc2U2NCcpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhnZ2JGaWxlUGF0aCwgZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVzdG9yZWRcIikgLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnIpICBcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVHR0I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBsb2FkIGNvbnRlbnQgZnJvbSBnZ2IgZmlsZSBhbmQgc2VuZCBpdCB0byB0aGUgZnJvbnRlbmQgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnbG9hZEdHQicsIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhZCB0aGUgZmlsZSBhbmQgY29udmVydCBpdCB0byBiYXNlNjRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhnZ2JGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZTY0R2diRmlsZSA9IGZpbGVEYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6YmFzZTY0R2diRmlsZSwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9ICAgICBcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHRVQgUERGIG9yIElNQUdFIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwZGZhc3luYycsIChldmVudCwgZmlsZW5hbWUsIGltYWdlID0gZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbWFnZSl7IHJldHVybiBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBiYXNlNjQgc3RyaW5nIG9mIGF1ZGlvZmlsZSBmcm9tIHdvcmtkaXJlY3Rvcnkgb3IgcHVibGljIGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEF1ZGlvRmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIHB1YmxpY2Rpcj1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpO1xuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiAhcHVibGljZGlyKSB7IC8vIFJldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvclxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgcHVibGljZGlyKSB7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi8uLi9wdWJsaWNcIixmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgRklMRS1MSVNUIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGZpbGVzYXN5bmMnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBhdWRpbz1mYWxzZSwgZG9jeD1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXJndW1lbnRzOlwiLCBmaWxlbmFtZSwgYXVkaW8sIGRvY3gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG5cbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gPT0gdHJ1ZSl7IC8vIGF1ZGlvIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRvY3gpeyAgLy9vZmZpY2Ugb3BlbiB4bWwgZmlsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbWFtbW90aC5jb252ZXJ0VG9IdG1sKHtwYXRoOiBmaWxlcGF0aH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgICAvL2JhayBmaWxlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgLy8gcmV0dXJuIGZpbGUgbGlzdCBvZiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7IGZzLm1rZGlyU3luYyh3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH0gLy9kbyBub3QgY3Jhc2ggaWYgdGhlIGRpcmVjdG9yeSBpcyBkZWxldGVkIGFmdGVyIHRoZSBhcHAgaXMgc3RhcnRlZCBeXlxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZWxpc3QgPSAgZnMucmVhZGRpclN5bmMod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgICAgICAgICAgICAgZmlsZWxpc3QuZm9yRWFjaCggZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kaWZpZWQgPSBmcy5zdGF0U3luYyggICBwYXRoLmpvaW4od29ya2RpcixmaWxlKSAgKS5tdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZCA9IG1vZGlmaWVkLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucGRmXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJwZGZcIiwgbW9kOiBtb2R9KSAgIH0gICAgICAgICAvL3BkZlxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5iYWtcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImJha1wiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgYmFja3VwIGZpbGUgdG8gcmVwbGFjZSBlZGl0b3IgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5kb2N4XCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJkb2N4XCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBjb250ZW50IGZpbGUgKGZyb20gdGVhY2hlcikgdG8gcmVwbGFjZSBjb250ZW50IGFuZCBjb250aW51ZSB3cml0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdnYlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZ2diXCIsIG1vZDogbW9kfSkgICB9ICAvLyBnZW9nZWJyYVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5tcDNcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIub2dnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLndhdlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImF1ZGlvXCIsIG1vZDogbW9kfSkgICB9ICAvLyBhdWRpb1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5qcGdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucG5nXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdpZlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImltYWdlXCIsIG1vZDogbW9kfSkgICB9ICAvLyBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEJBQ0tVUCBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZmlsZW5hbWUgd2l0aG91dFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRiYWNrdXBmaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBSZXF1ZXN0IHJlY2VpdmVkIGZvciBmaWxlbmFtZTogJHtmaWxlbmFtZX1gKVxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEZ1bGwgZmlsZSBwYXRoOiAke2ZpbGVwYXRofWApXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVwYXRoKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIG5vdCBmb3VuZDogJHtmaWxlcGF0aH1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBleGlzdHMsIHJlYWRpbmcgY29udGVudGApXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogU3VjY2Vzc2Z1bGx5IHJlYWQgYmFja3VwIGZpbGUsIGNvbnRlbnQgbGVuZ3RoOiAke2RhdGEubGVuZ3RofWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3IgcmVhZGluZyBiYWNrdXAgZmlsZTogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciBzdGFjazogJHtlcnIuc3RhY2t9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBubyBmaWxlbmFtZSBwcm92aWRlZGApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigncmVsb2FkLXVybCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUVhc3RlcldpbigpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQXBwZW5kIFByaW50UmVxdWVzdCB0byBjbGllbnRpbmZvICBcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzZW5kUHJpbnRSZXF1ZXN0JywgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IHRydWUgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0LWNwdS1pbmZvJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuaXNWaXJ0dWFsTWFjaGluZSgpXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdsYW4taW5mbycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2xhbkluZm8gPSBhd2FpdCBnZXRXbGFuSW5mbygpO1xuICAgICAgICAgICAgcmV0dXJuIHdsYW5JbmZvO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFxuICAgICAgICAvLyBOZXcgaGFuZGxlciB0byBnZXQgUERGIGZyb20gcHVibGljIGRpcmVjdG9yeSBmb3IgZnJvbnRlbmQgcGFyc2luZ1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UGRmRnJvbVB1YmxpYycsIGFzeW5jIChldmVudCwgcGRmRmlsZW5hbWUgKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEdldCBkaXJlY3RvcnkgbmFtZSBpbiBFU01cbiAgICAgICAgICAgICAgICBjb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBwZGZQYXRoO1xuICAgICAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgICAgICBwZGZQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBGcm9tIHNjcmlwdHMvIGdvIHVwIDMgbGV2ZWxzIHRvIHJlYWNoIHN0dWRlbnQvIHRoZW4gcHVibGljL1xuICAgICAgICAgICAgICAgICAgICBwZGZQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBkZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogUERGIG5vdCBmb3VuZCBhdDogJHtwZGZQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBkZlBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuICAgIGlzVmlydHVhbE1hY2hpbmUoKSB7XG4gICAgICAgIGNvbnN0IFZFTkRPUlMgPSAvKG9yYWNsZXx2aXJ0dWFsYm94fHZtd2FyZXxrdm18cWVtdXx4ZW58aW5ub3Rla3xwYXJhbGxlbHN8bWljcm9zb2Z0fGh5cGVyLXZ8Ymh5dmV8cmVkIGhhdHxyZWRoYXR8Ym9jaHN8Ymh5dmV8b3BlbnN0YWNrfGNsb3VkfGFtYXpvbnxnb29nbGV8YXp1cmUpL2kgLy8gY29tbW9uIFZNIGlkc1xuICAgICAgICBjb25zdCB3YXJuQW5kUmV0dXJuID0gcmVhc29uID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgaXNWaXJ0dWFsTWFjaGluZTogVmVyZGFjaHQgYXVmIFZNIC0gJHtyZWFzb259YClcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIExpbnV4IC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3B1aW5mbyA9IHJlYWRGaWxlU3luYygnL3Byb2MvY3B1aW5mbycsICd1dGY4JykgICAgICAvLyBDUFUgZmxhZ3NcbiAgICAgICAgICAgIGlmICgvXmZsYWdzLipcXGJoeXBlcnZpc29yXFxiL20udGVzdChjcHVpbmZvKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ2h5cGVydmlzb3IgZmxhZyBpbiAvcHJvYy9jcHVpbmZvJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBbXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9zeXNfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfbmFtZScsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X3ZlcnNpb24nLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYm9hcmRfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2Jpb3NfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2NoYXNzaXNfdmVuZG9yJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgZG1pID0gZmlsZXMubWFwKHAgPT4geyB0cnkgeyByZXR1cm4gcmVhZEZpbGVTeW5jKHAsICd1dGY4JykgfSBjYXRjaCB7IHJldHVybiAnJyB9IH0pLmpvaW4oJyAnKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChkbWkpKSByZXR1cm4gd2FybkFuZFJldHVybignRE1JLVZlbmRvci1NYXRjaCcpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdzeXN0ZW1kLWRldGVjdC12aXJ0IC1xJywgeyBzdGRpbzogJ2lnbm9yZScgfSkgICAgLy8gZXhpdCAwID0+IFZNXG4gICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignc3lzdGVtZC1kZXRlY3QtdmlydCBtZWxkZXQgVmlydHVhbGlzaWVydW5nJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cblxuICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtUHJvemVzc2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPSBleGVjU3luYygncHMgYXV4IHwgZ3JlcCAtaSBxZW11JywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAocHMuaW5jbHVkZXMoJ3FlbXUnKSAmJiAhcHMuaW5jbHVkZXMoJ2dyZXAnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIGxcdTAwRTR1ZnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gV2luZG93cyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIoR2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtIHwgRm9yRWFjaC1PYmplY3QgeyAkXy5NYW51ZmFjdHVyZXIsICRfLk1vZGVsIH0pIC1qb2luIFxcJyBcXCdcIidcbiAgICAgICAgICAgIGNvbnN0IGJhc2ljID0gZXhlY1N5bmMocHMsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKCkgICAgLy8gbWFudWZhY3R1cmVyICsgbW9kZWxcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoYmFzaWMpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL01vZGVsbCBwYXNzdCB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwc1JvYnVzdCA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRvPUAoKTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW07JG8rPUAoJGNzLk1hbnVmYWN0dXJlciwkY3MuTW9kZWwpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmI9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0Jhc2VCb2FyZDskbys9QCgkYmIuTWFudWZhY3R1cmVyLCRiYi5Qcm9kdWN0KX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJpb3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0JJT1M7JG8rPUAoJGJpb3MuU01CSU9TQklPU1ZlcnNpb24pfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3NwPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3Q7JG8rPUAoJGNzcC5OYW1lKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICdXcml0ZS1PdXRwdXQgKCgkbyAtam9pbiBcXCcgXFwnKS5UcmltKCkpXCInXG4gICAgICAgICAgICBjb25zdCByb2J1c3QgPSBleGVjU3luYyhwc1JvYnVzdCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChyb2J1c3QpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL0JJT1MtSW5mb3MgcGFzc2VuIHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLUVya2VubnVuZyBmXHUwMEZDciBXaW5kb3dzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHFlbXVQcm9jZXNzZXMgPSBleGVjU3luYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIHFlbXUqXCInLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgICAgICBpZiAocWVtdVByb2Nlc3Nlcy5pbmNsdWRlcygncWVtdScpKSByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIHVudGVyIFdpbmRvd3MnKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cblxuICAgICAgICAgLy8gLS0tLS0tLS0tLSBtYWNPUyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGh3TW9kZWwgPSBleGVjU3luYygnc3lzY3RsIC1uIGh3Lm1vZGVsJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoL152aXJ0dWFsL2kudGVzdChod01vZGVsKSB8fCBWRU5ET1JTLnRlc3QoaHdNb2RlbCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBIYXJkd2FyZW1vZGVsbCBkZXV0ZXQgYXVmIFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gZXhlY1N5bmMoJ3N5c3RlbV9wcm9maWxlciBTUEhhcmR3YXJlRGF0YVR5cGUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qoc3ApKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1Mgc3lzdGVtX3Byb2ZpbGVyIG1lbGRldCBWTS1WZW5kb3InKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlICAgICAgIFxuICAgIH1cblxuICAgIGNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpIHtcbiAgICAgICAgY29uc3QgcGFydHNBID0gdmVyc2lvbkEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgY29uc3QgcGFydHNCID0gdmVyc2lvbkIuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBudW1BID0gcGFydHNBW2ldIHx8IDA7IC8vIEZhbGxiYWNrIGF1ZiAwLCBmYWxscyBrZWluIFdlcnQgdm9yaGFuZGVuXG4gICAgICAgICAgICBjb25zdCBudW1CID0gcGFydHNCW2ldIHx8IDA7XG4gICAgXG4gICAgICAgICAgICBpZiAobnVtQSA8IG51bUIpIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmIChudW1BID4gbnVtQikgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IG51bWJlckEgPSBwYXJzZUludChzdGF0dXNBLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgICAgICBjb25zdCBudW1iZXJCID0gcGFyc2VJbnQoc3RhdHVzQi5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICBcbiAgICAgICAgaWYgKG51bWJlckEgPCBudW1iZXJCKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChudW1iZXJBID4gbnVtYmVyQikgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGNvbXBhcmVTb2Z0d2FyZSh2ZXJzaW9uQSwgc3RhdHVzQSwgdmVyc2lvbkIsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkNvbXBhcmlzb24gPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpO1xuICAgICAgICBpZiAodmVyc2lvbkNvbXBhcmlzb24gIT09IDApIHJldHVybiB2ZXJzaW9uQ29tcGFyaXNvbjtcbiAgICBcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpO1xuICAgIH1cblxuXG59XG4gXG5leHBvcnQgZGVmYXVsdCBuZXcgSXBjSGFuZGxlcigpXG4iLCAiaW1wb3J0IHtjcmVhdGVJMThufSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbWVzc2FnZXM6IHtcbiAgICAgICAgZW4sXG4gICAgICAgIGRlXG4gICAgICB9XG4gIH0pXG5cbmV4cG9ydCBkZWZhdWx0IGkxOG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiUmVzdG9yZVwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiRGlzY29ubmVjdFwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiRXhpdFwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIkV4YW1zXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJVc2VybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyIGFkZHJlc3NcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiRXhhbSBOYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJyZWdpc3RlclwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwicmVnaXN0ZXJpbmcuLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwicmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcImRpc2Nvbm5lY3RlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgb24gc2VydmVyISBcXG5cXG5QbGVhc2Ugd2FpdCBmb3IgdGhlIGFjdGl2YXRpb24gb2YgdGhlIGV4YW0gbW9kZSBieSB0aGUgdGVhY2hlciFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwic2VhcmNoIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJub3B3XCI6IFwid3JvbmcgdXNlcm5hbWUgb3IgcGluXCIsXG4gICAgICAgIFwibm91c2VyXCI6XCJubyB1c2VybmFtZSBnaXZlblwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZGRyZXNzZSBvZGVyIEV4YW1uYW1lIG1pc3NpbmdcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJubyBwaW5jb2RlIGdpdmVuXCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjpcIlNlcnZlciBBUEkgdW5yZWFjaGFibGVcIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgaXMgYmVoaW5kIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiTm8gVGVhY2hlciBBUEkgZm91bmQgb24gdGhlIGdpdmVuIGFkZHJlc3NcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2NhbCBsb2NrZG93blwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWFsIHNlYXJjaFwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIk5vIGV4YW1zIGZvdW5kXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nb3V0P1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJhY3RpdmF0ZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlc1wiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGljc1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiU2VsZWN0IGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIlBsZWFzZSBpbnN0YWxsIHRoZSBzYW1lIHZlcnNpb24gYXMgdGhlIGV4YW0gc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInNhZmUgZXhhbSBzdGF0dXMgY2hhbmdlZFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCBhbHJlYWR5IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwic3RhcnRlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJzdG9wcGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwic2FmZSBleGFtIG1vZGUgbm90IGFjdGl2ZVwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwic3R1ZGVudCByZW1vdmVkIGZyb20gc2VydmVyXCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiZmlsZXMgc3RvcmVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJmaWxlIGVycm9yXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcInBsZWFzZSBjaGVjayBpZiB0aGUgJ0VYQU0tU1RVREVOVCcgZGlyZWN0b3J5IGlzIHdyaXRlYWJsZSBhbmQgaGFzIGVub3VnaCBzcGFjZVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiQSBsb2NhbCBiYWNrdXAgY291bGQgbm90IGJlIGNyZWF0ZWQuIFBsZWFzZSB1c2UgdGhlIG1hbnVhbCBzdWJtaXNzaW9uIG9wdGlvbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcImRvbid0IHNob3cgYWdhaW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGZvdW5kXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiR2V0IG1hdGVyaWFsc1wiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJTZW5kIGZpbmFsIGV4YW1cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkZpbmFsIHN1Ym1pdFwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsczpcIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9jYWwgZmlsZXM6XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiVXBkYXRlXCIsXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BsaXR2aWV3XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiWW91IGhhdmUgbGVmdCB0aGUgc2FmZSBleGFtIG1vZGUhXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJQbGVhc2UgaW5mb3JtIGEgdGVhY2hlciFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJEbyB5b3Ugd2FudCB0byByZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoZSBlZGl0b3Igd2l0aCB0aGUgY29udGVudCBvZiBcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCI/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJDYW5jZWxcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAgZmlsZSBjb3VsZCBub3QgYmUgcmVhZFwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBzdWNjZXNzZnVsbHkgbG9hZGVkXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJFcnJvciBsb2FkaW5nIGJhY2t1cCBmaWxlXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJTdWNjZXNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJjaGFyc1wiLFxuICAgICAgICBcIndvcmRzXCI6IFwid29yZHNcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJyZWNvbm5lY3RcIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJ1bmxvY2tcIixcbiAgICAgICAgXCJleGl0XCI6IFwiRXhpdCBzYWZlIGV4YW0gbW9kZT9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJEbyBub3QgbGVhdmUgc2FmZSBleGFtIG1vZGUgd2l0aG91dCBwZXJtaXNzaW9uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJJZiB0aGlzIHByb2Nlc3MgZmFpbHMgdW5sb2NrIGFuZCB0cnkgYWdhaW4hXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJDcmVhdGluZyBiYWNrdXBcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJDcmVhdGluZyBiYWNrdXAgYW5kIGNsaXBib2FyZCBjb3B5XCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkxlYXZpbmcgRXhhbSBtb2RlXCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwiYmFja3VwXCIsXG4gICAgICAgIFwidW5kb1wiOlwidW5kb1wiLFxuICAgICAgICBcInJlZG9cIjpcInJlZG9cIixcbiAgICAgICAgXCJjbGVhclwiOlwiY2xlYXJcIixcbiAgICAgICAgXCJib2xkXCI6XCJib2xkXCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJpdGFsaWNcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVuZGVybGluZVwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJoZWFkaW5nMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJoZWFkaW5nMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJoZWFkaW5nM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJoZWFkaW5nNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJoZWFkaW5nNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJoZWFkaW5nNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwic3Vic2NyaXB0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcInN1cGVyc2NyaXB0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwiYnVsbGV0bGlzdFwiLFxuICAgICAgICBcImxpc3RcIjpcImxpc3RcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcImNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcImNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJibG9ja3F1b3RlXCIsXG4gICAgICAgIFwibGluZVwiOlwicGFnZWJyZWFrXCIsXG4gICAgICAgIFwibGVmdFwiOlwibGVmdFwiLFxuICAgICAgICBcImNlbnRlclwiOlwiY2VudGVyXCIsXG4gICAgICAgIFwicmlnaHRcIjpcInJpZ2h0XCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJ0ZXh0Y29sb3JcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcImxpbmVicmVha1wiLFxuICAgICAgICBcIm1vcmVcIjpcIm1vcmVcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiaW5zZXJ0dGFibGVcIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiZGVsZXRldGFibGVcIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiY29sdW1uYWZ0ZXJcIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwicm93YWZ0ZXJcIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcImRlbGNvbHVtblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiZGVscm93XCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJtZXJnZW9yc3BsaXRcIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcImhlYWRlcmNvbHVtblwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiaGVhZGVycm93XCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcInNlbGVjdGVkIHdvcmRzL2NoYXJzXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcInByaW50IHJlcXVlc3Qgc2VudFwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcInByaW50IHJlcXVlc3QgZGVuaWVkXCIsXG4gICAgICAgIFwicGFzdGVcIjpcInBhc3RlXCIsXG4gICAgICAgIFwiY29weVwiOlwiY29weVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJkZWFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJSZWxvYWRcIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV291bGQgeW91IGxpa2UgdG8gcmVpbml0aWFsaXplIHRoZSBFZGl0b3I/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcImtlZXAgY29udGVudFwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJJbnNlcnQgc3BlY2lhbGNoYXJhY3RlclwiLFxuICAgICAgICBcInByaW50XCI6IFwicHJpbnRcIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIlBsYXkgQXVkaW9cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJEbyB5b3Ugd2FudCB0byBwbGF5IHRoZSBhdWRpb2ZpbGU/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlJlbWFpbmluZyBwbGF5YmFja3M6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJZb3UgZG9uJ3QgaGF2ZSB0aGUgcGVybWlzc2lvbiB0byBwbGF5IHRoaXMgZmlsZSFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkluc2VydCBJbWFnZVwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiSW5zZXJ0IE11Z3Nob3RcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJTZW5kIHdvcmsgdG8gdGVhY2hlclwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIkNsb3NlXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiRXhpdCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRmlsZW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJQbGVhc2UgZW50ZXIgb25seSBsZXR0ZXJzIGFuZCBudW1iZXJzIHdpdGhvdXQgc3BlY2lhbCBjaGFyYWN0ZXJzXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJjbGVhciBjb250ZW50P1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiTm8gdmFsaWQgUERGIEZpbGVcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiV3JvbmcgcGFzc3dvcmRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiUmVsb2FkIHdlYnZpZXdcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiV2llZGVyaGVyc3RlbGxlblwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJCZWVuZGVuXCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIkJlbnV0emVybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcIm1lbGRlIGFuLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcImFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJWZXJiaW5kdW5nIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU2llIGhhYmVuIHNpY2ggZXJmb2xncmVpY2ggYW0gU2VydmVyIHJlZ2lzdHJpZXJ0ISBcXG5cXG5CaXR0ZSB3YXJ0ZW4gU2llIGF1ZiBkaWUgQWt0aXZpZXJ1bmcgZGVzIFByXHUwMEZDZnVuZ3Ntb2R1cyBkdXJjaCBkaWUgTGVocnBlcnNvbiFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwiU3VjaGUgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkZhbHNjaGVyIEJlbnV0emVybmFtZSBvZGVyIFBpbmNvZGVcIixcbiAgICAgICAgXCJub3VzZXJcIjogXCJCZW51dHplcm5hbWUgZmVobHRcIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRyZXNzZSBvZGVyIFByXHUwMEZDZnVuZ3NuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiLFxuICAgICAgICBcIm5vcGluXCI6IFwiUGluY29kZSBmZWhsdFwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6IFwiU2VydmVyIEFQSSBuaWNodCBlcnJlaWNoYmFyLlwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBiZWZpbmRldCBzaWNoIG1cdTAwRjZnbGljaGVyd2Vpc2UgaGludGVyIGVpbmVyIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiS2VpbmUgUHJcdTAwRkNmdW5nc3NlcnZlciBhbiBhbmdlZ2ViZW5lciBBZHJlc3NlXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9rYWwgYWJzcGVycmVuXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51ZWxsIHN1Y2hlblwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIktlaW5lIFByXHUwMEZDZnVuZ2VuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiUHJcdTAwRkNmdW5nc21vZHVzIGF1c3dcdTAwRTRobGVuXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiQml0dGUgaW5zdGFsbGllcmVuIHNpZSBkaWUgc2VsYmUgVmVyc2lvbiB3aWUgYW0gUHJcdTAwRkNmdW5nc3NlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGdlc3RhcnRldFwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIG5pY2h0IGFrdGl2XCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gZW50ZmVybnRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJEYXRlaWVuIGdlc3BlaWNoZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiRmVobGVyIGJlaW0gU2NocmVpYmVuIGRlciBEYXRlaVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJCaXR0ZSBzdGVsbGVuIFNpZSBzaWNoZXIsIGRhc3MgZGFzICdFWEFNLVNUVURFTlQnIFZlcnplaWNobmlzIGZcdTAwRkNyIE5leHQtRXhhbSBzY2hyZWliYmFyIGlzdCB1bmQgZ2VuXHUwMEZDZ2VuZCBTcGVpY2hlcnBsYXR6IHZvcmhhbmRlbiBpc3QuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJFaW5lIGxva2FsZSBTaWNoZXJ1bmcga29ubnRlIG5pY2h0IGVyc3RlbGx0IHdlcmRlbi4gTnV0emVuIFNpZSBkaWUgbWFudWVsbGUgQWJnYWJlIHVtIElocmUgQXJiZWl0IGRpcmVrdCBhbiBkaWUgTGVocnBlcnNvbiB6dSBzZW5kZW4uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJOaWNodCBtZWhyIGFuemVpZ2VuXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBnZWZ1bmRlblwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuIGhvbGVuXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIkZpbmFsZSBBYmdhYmUgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkFiZ2FiZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIkFrdHVhbGlzaWVyZW5cIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9rYWxlIERhdGVpZW46XCIsXG5cbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGFsdGVuYW5zaWNodFwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIlNpZSBoYWJlbiBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJNZWxkZW4gU2llIHNpY2ggdW1nZWhlbmQgYmVpIGRlciBBdWZzaWNodHNwZXJzb24hXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiV29sbGVuIFNpZSBkZW4gSW5oYWx0IGRlcyBFZGl0b3JzIGR1cmNoIGRlbiBJbmhhbHQgZGVyIERhdGVpXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJFcnNldHplblwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwLURhdGVpIGtvbm50ZSBuaWNodCBnZWxlc2VuIHdlcmRlblwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBlcmZvbGdyZWljaCBnZWxhZGVuXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBMYWRlbiBkZXIgQmFja3VwLURhdGVpXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiRXJmb2xnXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJaZWljaGVuXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJXXHUwMEY2cnRlclwiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcIm5ldSB2ZXJiaW5kZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJlbnRzcGVycmVuXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJWZXJsYXNzZW4gU2llIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIG5pZSBvaG5lIEZyZWlnYWJlIGVpbmVyIExlaHJwZXJzb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIlNvbGx0ZSBkZXIgVm9yZ2FuZyBmZWhsc2NobGFnZW4gYmVlbmRlbiBTaWUgYml0dGUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdW5kIHZlcnN1Y2hlbiBTaWUgZXMgZXJuZXV0IVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiSWhyZSBBcmJlaXQgd3VyZGUgZXJmb2xncmVpY2ggZ2VzaWNoZXJ0IVwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkRpZSBha3R1ZWxsZSBBcmJlaXQgd2lyZCBnZXNpY2hlcnQgdW5kIGluIGRpZSBad2lzY2hlbmFibGFnZSBrb3BpZXJ0IVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJzaWNoZXJuXCIsXG4gICAgICAgIFwidW5kb1wiOlwiclx1MDBGQ2NrZ1x1MDBFNG5naWdcIixcbiAgICAgICAgXCJyZWRvXCI6XCJ3aWVkZXJob2xlblwiLFxuICAgICAgICBcImNsZWFyXCI6XCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJib2xkXCI6XCJmZXR0XCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJrdXJzaXZcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVudGVyc3RyaWNoZW5cIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiXHUwMERDYmVyc2NocmlmdCAxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiXHUwMERDYmVyc2NocmlmdCA0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInRpZWZnZXN0ZWxsdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJob2NoZ2VzdGVsbHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJ1bmdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImxpc3RcIjpcImdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiQ29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiQ29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcIlppdGF0XCIsXG4gICAgICAgIFwibGluZVwiOlwiU2VpdGVudW1icnVjaFwiLFxuICAgICAgICBcImxlZnRcIjpcIkxpbmtzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcIlplbnRyaWVydFwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJSZWNodHNiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwiVGV4dGZhcmJlXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJaZWlsZW51bWJydWNoXCIsXG4gICAgICAgIFwibW9yZVwiOlwibWVoclwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJUYWJlbGxlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiVGFiZWxsZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiU3BhbHRlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwiUmVpaGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiU3BhbHRlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiUmVpaGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJWZXJlaW5lbiBvZGVyIFRlaWxlblwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiVGl0ZWxzcGFsdGVcIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcIlRpdGVscmVpaGVcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwiV1x1MDBGNnJ0ZXIvWmVpY2hlbiBpbiBBdXN3YWhsXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcIkRydWNrYW5mcmFnZSBnZXNlbmRldCFcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJEcnVja2FuZnJhZ2UgYWJnZWxlaG50LiBCaXR0ZSB3YXJ0ZW4gdW5kIGVybmV1dCBzZW5kZW4uXCIsXG4gICAgICAgIFwicGFzdGVcIjpcImVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJjb3B5XCI6XCJrb3BpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGRlYWt0aXZpZXJlblwiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIk5ldSBsYWRlblwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb2xsZW4gU2llIGRlbiBUZXh0ZWRpdG9yIG5ldSBpbml0aWFsaXNpZXJlbj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwiSW5oYWx0IGJlaWJlaGFsdGVuXCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIlNvbmRlcnplaWNoZW4gZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiQXVkaW8gYWJzcGllbGVuXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiV29sbGVuIFNpZSBkYXMgSFx1MDBGNnJiZWlzcGllbCBqZXR6dCBhYnNwaWVsZW4/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlZlcmJsZWliZW5kZSBEdXJjaGxcdTAwRTR1ZmU6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJTaWUgaGFiZW4ga2VpbmUgQmVyZWNodGlndW5nIGRpZSBBdWRpb2RhdGVpIGVybmV1dCBhYnp1c3BpZWxlbiFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkJpbGQgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiTXVnc2hvdCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiQXJiZWl0IGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiU2NobGllXHUwMERGZW5cIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJEYXRlaW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJCaXR0ZSBnZWJlbiBTaWUgbnVyIEJ1Y2hzdGFiZW4gb2RlciBaYWhsZW4gZWluLlwiLFxuICAgICAgICBcImNsZWFyXCI6IFwiQWxsZSBCZXJlY2hudW5nZW4gbFx1MDBGNnNjaGVuP1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIGdcdTAwRkNsdGlnZSBQREYgRGF0ZWlcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiRmFsc2NoZXMgUGFzc3dvcnRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiV2VidmlldyBuZXUgbGFkZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIlxuICAgIH1cbn1cbiIsICJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuXG5sZXQgbGFuZ3VhZ2VUb29sSmFyUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJylcbmlmIChhcHAuaXNQYWNrYWdlZCkgeyBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYy9MYW5ndWFnZVRvb2wvbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInKSB9XG5cbmxldCBsYW5ndWFnZVRvb2xDb25maWdQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9MYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKVxuaWYgKGFwcC5pc1BhY2thZ2VkKSB7IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5yZXNvdXJjZXNQYXRoLCAnYXBwLmFzYXIudW5wYWNrZWQnLCAncHVibGljL0xhbmd1YWdlVG9vbC9zZXJ2ZXIucHJvcGVydGllcycpIH1cblxuXG5cblxuXG5jbGFzcyBMYW5ndWFnZVRvb2xTZXJ2ZXIge1xuICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIEluaXRpYWxpc2llcnQgZGllIFByb3plc3N2YXJpYWJsZVxuICAgICAgICAgdGhpcy5wb3J0ID0gODA4OFxuICAgICB9XG4gXG4gICAgIHN0YXJ0U2VydmVyKCkge1xuICAgICAgICAgaWYgKHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyAmJiAhdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcuJyk7XG4gICAgICAgICAgICAgcmV0dXJuOyAvLyBWZXJoaW5kZXJ0IGRhcyBlcm5ldXRlIFN0YXJ0ZW4sIHdlbm4gZGVyIFNlcnZlciBiZXJlaXRzIGxcdTAwRTR1ZnRcbiAgICAgICAgIH1cbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBKcmVIYW5kbGVyLmpTcGF3bihcbiAgICAgICAgICAgICAgICBbbGFuZ3VhZ2VUb29sSmFyUGF0aF0sIC8vIEtsYXNzZW5wZmFkXG4gICAgICAgICAgICAgICAgJ29yZy5sYW5ndWFnZXRvb2wuc2VydmVyLkhUVFBTZXJ2ZXInLCAvLyBIYXVwdGtsYXNzZSBkZXIgTGFuZ3VhZ2VUb29sIEFQSVxuICAgICAgICAgICAgICAgIFsnLS1wb3J0JywgdGhpcy5wb3J0LCctLWNvbmZpZycsbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCwgJy0tYWxsb3ctb3JpZ2luJywgXCInKidcIiBdIC8vIFp1c1x1MDBFNHR6bGljaGUgQXJndW1lbnRlLCB6LkIuIFBvcnQgdW5kIENPUlMtRXJsYXVibmlzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKVxuICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgQVBJIHJ1bm5pbmcgYXQgbG9jYWxob3N0OjgwODgnKTtcblxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIGRhdGEgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGE6IFJlY2VpdmVkIGRhdGEgZnJvbSBMYW5ndWFnZVRvb2wgQVBJJywgZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdlcnJvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1lcnJvcjonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3N0YXJ0aW5nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjaGVjayBkb25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdoYW5kbGVkIHJlcXVlc3QnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gQWNjdW11bGF0ZSBzdGRlcnIgZGF0YSB0byBoYW5kbGUgY2h1bmtlZCBvdXRwdXRcbiAgICAgICAgICAgIGxldCBzdGRlcnJCdWZmZXIgPSAnJztcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydFN0ciA9IFN0cmluZyh0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGJvdGggY3VycmVudCBjaHVuayBhbmQgYWNjdW11bGF0ZWQgYnVmZmVyIGZvciBwb3J0LXJlbGF0ZWQgZXJyb3JzXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFJlc3BvbnNlID0gc3RkZXJyQnVmZmVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUG9ydEVycm9yID0gZnVsbFJlc3BvbnNlLmluY2x1ZGVzKHBvcnRTdHIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZHJlc3NlIHdpcmQgYmVyZWl0cyB2ZXJ3ZW5kZXRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIk1heWJlIHNvbWV0aGluZyBlbHNlIGlzIHJ1bm5pbmcgb24gdGhhdCBwb3J0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZGRyZXNzIGFscmVhZHkgaW4gdXNlXCIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpc1BvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IGFub3RoZXIgTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBwcm9iYWJseSBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydDonLCB0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuay5pbmNsdWRlcygnXFxuJykgfHwgZnVsbFJlc3BvbnNlLmxlbmd0aCA+IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgd2UgaGF2ZSBhIG5ld2xpbmUgKGxpa2VseSBjb21wbGV0ZSBtZXNzYWdlKSBvciBidWZmZXIgaXMgZ2V0dGluZyBsYXJnZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGEtZXJyb3I6JywgZnVsbFJlc3BvbnNlLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgbG9nZ2luZ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGx0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIFNldHp0IGRlbiBQcm96ZXNzIHp1clx1MDBGQ2NrLCB3ZW5uIGVyIGJlZW5kZXQgd2lyZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZ2VuZXJhbC1lcnJvcjonLCBlcnIpO1xuICAgICAgICB9XG5cblxuICAgICB9XG5cbiAgICAgc3RvcFNlcnZlcigpIHtcbiAgICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWRcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKSB7XG4gICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWQsIG5vdGhpbmcgdG8gc3RvcCcpO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGtpbGwgdGhlIHByb2Nlc3MgZGlyZWN0bHkgaWYgd2UgaGF2ZSBhIHJlZmVyZW5jZVxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBraWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZmFpbGVkIHRvIGtpbGwgcHJvY2VzcyBkaXJlY3RseSwgdHJ5aW5nIHBsYXRmb3JtLXNwZWNpZmljIG1ldGhvZDonLCBlcnIpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBwbGF0Zm9ybS1zcGVjaWZpYyBjb21tYW5kcyB0byBraWxsIHRoZSBwcm9jZXNzIChvbmx5IGlmIHdlIGhhZCBhIHByb2Nlc3MgcmVmZXJlbmNlKVxuICAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICAgbGV0IGNvbW1hbmQ7XG5cbiAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgIC8vIFdpbmRvd3M6IGZpbmQgYW5kIGtpbGwgamF2YSBwcm9jZXNzZXMgcnVubmluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB3bWljICh3b3JrcyBvbiBvbGRlciBXaW5kb3dzKSwgdGhlbiB0cnkgUG93ZXJTaGVsbCwgdGhlbiBmYWxsYmFjayB0byBwb3J0LWJhc2VkIGtpbGxcbiAgICAgICAgICAgICBjb21tYW5kID0gYHdtaWMgcHJvY2VzcyB3aGVyZSBcImNvbW1hbmRsaW5lIGxpa2UgJyVsYW5ndWFnZXRvb2wtc2VydmVyLmphciUnXCIgZGVsZXRlIDI+bnVsIHx8IHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyBqYXZhIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHskXy5Db21tYW5kTGluZSAtbGlrZSAnKmxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyKid9IHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZVwiIDI+bnVsIHx8IGZvciAvZiBcInRva2Vucz01XCIgJWEgaW4gKCduZXRzdGF0IC1hbm8gXnwgZmluZHN0ciA6ODA4OCcpIGRvIHRhc2traWxsIC9GIC9QSUQgJWEgMj5udWxgO1xuICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICAgICAvLyBtYWNPUyBhbmQgTGludXg6IHVzZSBwa2lsbCB0byBraWxsIHByb2Nlc3NlcyBtYXRjaGluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIGNvbW1hbmQgPSAncGtpbGwgLWYgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogdW5zdXBwb3J0ZWQgcGxhdGZvcm06JywgcGxhdGZvcm0pO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIC8vIEl0J3Mgb2theSBpZiB0aGUgcHJvY2VzcyBpcyBub3QgZm91bmQgKGFscmVhZHkga2lsbGVkKVxuICAgICAgICAgICAgICAgICAvLyBwa2lsbCByZXR1cm5zIGNvZGUgMSB3aGVuIG5vIHByb2Nlc3MgaXMgZm91bmQsIHdoaWNoIGlzIGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAxICYmICFlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSAmJiAhc3RkZXJyLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ05vIHN1Y2ggcHJvY2VzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZXJyb3Iga2lsbGluZyBMYW5ndWFnZVRvb2wgc2VydmVyOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBub3QgZm91bmQgKG1heSBhbHJlYWR5IGJlIHN0b3BwZWQpJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBzdG9wcGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgfSk7XG4gICAgIH1cbiB9XG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBMYW5ndWFnZVRvb2xTZXJ2ZXIoKVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbiAvLyBldmVyeSBwbGF0Zm9ybSBuZWVkcyBpdCdzIG93biBqcmUgKGxpbnV4LCB3aW4zMiwgZGFyd2luKSAvL2ZpeG1lOiB1c2UgR3JhYWxWTSB0byBwcmVjb21waWxlIGxhbmd1YWdldG9vbCBpbiBvcmRlciB0byBzYXZlIHNwYWNlIGFuZCBnZXQgcmlkIG9mIGpyZT9cbmNsYXNzIEpyZUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHsgfVxuXG4gICAgaW5pdCgpeyBcbiAgICAgICAgdGhpcy5qVGVzdCgpXG4gICAgfVxuXG5cbiAgICBqVGVzdCgpe1xuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpOyAvLyAnL3BmYWQvenVyL2phdmEnXG4gICAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihqYXZhcGF0aCwgWyctdmVyc2lvbiddKTtcbiAgICBcbiAgICAgICAgcHJvYy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTsgLy8gaW4gWmVpbGVuIHNwbGl0dGVuXG4gICAgICAgICAgICBsb2cuZGVidWcoYGpyZS1oYW5kbGVyIEAgalRlc3Q6ICR7bGluZXNbMF19YCk7IC8vIG51ciBkaWUgZXJzdGUgWmVpbGUgbG9nZ2VuXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmYWlsKHJlYXNvbikge1xuICAgICAgICBsb2cuZXJyb3IocmVhc29uKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cblxuICAgIGdldERpcmVjdG9yaWVzKGRpclBhdGgpIHtcbiAgICAgICAgbGV0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKS5maWx0ZXIoXG4gICAgICAgICAgICBmaWxlID0+IGZzLnN0YXRTeW5jKHBhdGguam9pbihkaXJQYXRoLCBmaWxlKSkuaXNEaXJlY3RvcnkoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZGlyc1xuICAgIH0gXG5cbiAgICBkcml2ZXIoKXtcbiAgICAgICAgdmFyIGQgPSBwbGF0Zm9ybURpc3BhdGNoZXIuamF2YUJpbi5zbGljZSgpO1xuICAgICAgICBkLnVuc2hpZnQocGxhdGZvcm1EaXNwYXRjaGVyLmpyZURpcik7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4uYXBwbHkocGF0aCwgZCk7XG4gICAgfVxuXG4gICAgZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBhcmdzID0gKGFyZ3MgfHwgW10pLnNsaWNlKCk7XG4gICAgICAgIGNsYXNzcGF0aCA9IGNsYXNzcGF0aCB8fCBbXTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzbmFtZSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc3BhdGguam9pbih0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JykpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoJy1jcCcpO1xuICAgICAgICByZXR1cm4gYXJncztcbiAgICB9XG5cbiAgICBqU3Bhd24oY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgXG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKClcbiAgICAgICAgbGV0IGphdmFhcmdzID0gdGhpcy5nZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKVxuICAgICAgICBsZXQgamF2YWNtZGxpbmUgPSAgYCR7amF2YXBhdGh9ICR7amF2YWFyZ3Muam9pbignICcpfSBgXG5cbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiAnJHtwbGF0Zm9ybURpc3BhdGNoZXIuanJlfScgc2VsZWN0ZWRgKVxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246IHNwYXduaW5nIGphdmEgcHJvY2VzczogJHtqYXZhY21kbGluZX1gKVxuICAgICAgICByZXR1cm4gc3Bhd24oamF2YXBhdGgsIGphdmFhcmdzLCB7c2hlbGw6ZmFsc2V9KTtcbiAgICAgICAvLyByZXR1cm4gc3Bhd24oamF2YWNtZGxpbmUpO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSnJlSGFuZGxlcigpXG4iLCAiLy8gc2NyaXB0cy9TeXN0ZW1UcmF5TWFuYWdlci5qc1xuaW1wb3J0IHsgYXBwLCBUcmF5LCBNZW51IH0gZnJvbSAnZWxlY3Ryb24nOyBcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnOyAvLyBQYXRoIG1vZHVsZSBpbXBvcnRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJzsgLy8gTG9nZ2luZyBtb2R1bGVcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcyc7IC8vIFdpbmRvdyBtYW5hZ2VyXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9jb21tdW5pY2F0aW9uaGFuZGxlci5qcyc7IC8vIENvbW11bmljYXRpb24gbG9naWNcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnOyAvLyBJMThuIGluc3RhbmNlXG5cblxuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyAvLyBHZXQgY3VycmVudCBkaXJlY3RvcnlcblxubGV0IHRyYXkgPSBudWxsOyAvLyBQcml2YXRlIHRyYXkgaW5zdGFuY2VcblxuLy8gUGF0aCB0byB0aGUgYXBwIGljb25cbmNvbnN0IGljb25QYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucycsJ2ljb24yNHgyNC5wbmcnKTsgXG5cbi8vID09PSByZXBsYWNlIHRoZSBoZWxwZXIgc2V0TG9jYWxlIChleGFjdCBibG9jaykgPT09XG5jb25zdCBzZXRMb2NhbGUgPSAobG9jKSA9PiB7XG4gICAgY29uc3QgZ2wgPSBpMThuLmdsb2JhbDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCBnbG9iYWwgY29tcG9zZXJcbiAgICBpZiAoZ2wgJiYgdHlwZW9mIGdsLmxvY2FsZSA9PT0gJ29iamVjdCcgJiYgZ2wubG9jYWxlKSB7XG4gICAgICAvLyB2dWUtaTE4biBjb21wb3NpdGlvbiBtb2RlXG4gICAgICBpZiAoJ3ZhbHVlJyBpbiBnbC5sb2NhbGUpIGdsLmxvY2FsZS52YWx1ZSA9IGxvYzsgICAgIC8vIHNldCByZWFjdGl2ZSB2YWx1ZVxuICAgICAgZWxzZSBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsYmFja1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBsZWdhY3kgbW9kZSBvciBwbGFpbiBzdHJpbmdcbiAgICAgIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHN0cmluZyBsb2NhbGVcbiAgICB9XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgXG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHRyYXkgaWNvbiBpZiBpdCBkb2Vzbid0IGV4aXN0IGFuZCB1cGRhdGVzIGl0cyBjb250ZXh0IG1lbnUuXG4gKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIG5ldyBsb2NhbGUgdG8gYXBwbHkuXG4gKi9cblxuXG5cbmV4cG9ydCBjb25zdCB1cGRhdGVTeXN0ZW1UcmF5ID0gKGxvY2FsZSkgPT4ge1xuICAgIHNldExvY2FsZShsb2NhbGUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgdCA9IChrKSA9PiBpMThuLmdsb2JhbC50KGspOyAgICAgICAgICAgICAgICAgICAgICAvLyBhbHdheXMgcmVzb2x2ZSBsaXZlXG4gIFxuICAgIGlmICghdHJheSkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRyYXkgb25jZVxuICAgICAgdHJheSA9IG5ldyBUcmF5KGljb25QYXRoKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRyYXkgaWNvblxuICAgICAgdHJheS5vbignY2xpY2snLCAoKSA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9nZ2xlIHdpbmRvd1xuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkgXG4gICAgICAgICAgPyBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaGlkZSgpIFxuICAgICAgICAgIDogV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgXG4gICAgLy8gYnVpbGQgY29udGV4dCBtZW51IHdpdGggY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCBjb250ZXh0TWVudSA9IE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUoW1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LnJlc3RvcmUnKSwgY2xpY2s6ICgpID0+IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCkgfSwgLy8gc2hvdyB3aW5kb3dcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5kaXNjb25uZWN0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy5pbmZvKFwibWFpbiBAIHN5c3RlbXRyYXk6IHJlbW92aW5nIHJlZ2lzdHJhdGlvblwiKTsgXG4gICAgICAgICAgQ29tbUhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCk7IFxuICAgICAgICB9IFxuICAgICAgfSwgLy8gZGlzY29ubmVjdFxuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmV4aXQnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogQ2xvc2luZyBOZXh0LUV4YW1cIik7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIik7IFxuICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyBcbiAgICAgICAgICBhcHAucXVpdCgpOyBcbiAgICAgICAgfSBcbiAgICAgIH0gLy8gZXhpdFxuICAgIF0pO1xuICBcbiAgICB0cmF5LnNldFRvb2xUaXAoJ05leHQtRXhhbSBTdHVkZW50Jyk7ICAgICAgICAgICAgICAgICAgIC8vIHNldCB0b29sdGlwXG4gICAgdHJheS5zZXRDb250ZXh0TWVudShjb250ZXh0TWVudSk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBhcHBseSBtZW51XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIHNjcmlwdCBpcyB1c2VkIHRvIHRlc3QgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gKiBJdCB1c2VzIHRoZSB0Y2N1dGlsIGNvbW1hbmQgdG8gdGVzdCBhbmQgcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gKiBJdCByZXR1cm5zIHRydWUgaWYgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgYXJlIGFsbG93ZWQgYW5kIGZhbHNlIGlmIHRoZXkgYXJlIG5vdFxuICogXG4gKiBUaGlzIGNvdWxkIGFsc28gYmUgdXNlZCB0byB0ZXN0IG90aGVyIHBlcm1pc3Npb25zIGxpa2UgYWNjZXNzaWJpbGl0eSwgc2NyZWVuIGNhcHR1cmUsIGV0Yy4gXG4gKiBzZWUgY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgZm9yIG1vcmUgZGV0YWlscyBvbiBob3cgdG8gdGVzdCBmb3Igc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAoaXRzIG5vdCBwb3NzaWJsZSB0byB0ZXN0IGZvciBzY3JlZW4gY2FwdHVyZSBwZXJtaXNzaW9ucyBvbiBtYWNvcyBiZWNhdXNlIHdpdGhvdXQgcGVybWlzc2lvbnMgaXQgd2lsbCBhbHdheXMgcmV0dXJuIGEgYmxhbmsgc2NyZWVuc2hvdCAtIHdlIHVzZSBhIHdvcmthcm91bmQgdG8gZGV0ZWN0IHRoaXMpXG4gKiBcbiAqL1xuXG5cblxuXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcycgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJ1biB0Y2N1dGlsXG5pbXBvcnQgeyBkaWFsb2csIGFwcCB9IGZyb20gJ2VsZWN0cm9uJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG93IGRpYWxvZyBhbmQgcXVpdFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7ICAgICAgICAgICAgICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBmZXRjaCB3b3Jrc1xuICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3NlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3BvbmdgLCB7IG1ldGhvZDogJ0dFVCcsIGNhY2hlOiAnbm8tc3RvcmUnIH0pIC8vIHRlc3QgcmVxdWVzdFxuICAgICAgICAgICAgcmV0dXJuIHJlcy5va1xuICAgIH0gY2F0Y2ggeyAgcmV0dXJuIGZhbHNlIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc2V0VENDKCkgeyAgICAgIC8vIHJlc2V0IFRDQyBwZXJtaXNzaW9uc1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vYXBwSWRcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLnN0dWRlbnRgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuICAgICAgICAvL2FwcEJ1bmRsZUlkIChzZXQgdmlhIG5vdGFyaXplKVxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0tc3R1ZGVudC5hcHBgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuXG5cbiAgICB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgLy8gY2hlY2sgb3IgcmVzZXRcbiAgICBjb25zdCBvayA9IGF3YWl0IHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydClcbiAgICBpZiAob2spIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTmV0d29yayBhY2Nlc3MgaXMgYWxsb3dlZGApO1xuICAgICAgICAgICAgcmV0dXJuIFwib2tcIjtcbiAgICB9XG4gICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBObyBIVFRQIHJlcXVlc3RzIGFsbG93ZWQhYCApXG5cbiAgICB0cnkge1xuXG4gICAgICAgIC8vIGFzayB0aGUgdXNlcnMgaWYgdGhleSB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9ucyBhbmQgZXhpdCB0aGUgYXBwIGlmIHRoZXkgZG9cbiAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0RlciBTZXJ2ZXIgaXN0IG5pY2h0IGVycmVpY2hiYXIuIE1cdTAwRjZjaHRlbiBTaWUgZGllIEJlcmVjaHRpZ3VuZ2VuIHp1clx1MDBGQ2Nrc2V0emVuIHVuZCBOZXh0LUV4YW0gbWFudWVsbCBuZXUgc3RhcnRlbj8nLFxuICAgICAgICAgICAgYnV0dG9uczogWydPSycsICdBYmJyZWNoZW4nXSxcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGNob2ljZS5yZXNwb25zZSA9PT0gMCkgeyAgICAvLyByZXNldCBwZXJtaXNzaW9ucyBhbmQgcmV0dXJuIHRydWUgdG8gcXVpdCB0aGUgYXBwXG4gICAgICAgICAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IFJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zIGFuZCBxdWl0dGluZyBhcHBgKTtcbiAgICAgICAgICAgIGF3YWl0IHJlc2V0VENDKCk7IFxuICAgICAgICAgICAgcmV0dXJuIFwicmVzZXRcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2UgXG4gICAgICAgIH0gICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiBcbiAgICB9IFxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGxvZy5lcnJvcihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IEVycm9yIHJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zOiAke2V9YCk7XG4gICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ZlaGxlciBiZWltIFp1clx1MDBGQ2Nrc2V0emVuIGRlciBCZXJlY2h0aWd1bmdlbicsXG4gICAgICAgICAgICBkZXRhaWw6IFN0cmluZyhlLmVyciB8fCBlKSxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGZhbHNlICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gICAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBDb3VudGVyIGZvciBmYWlsZWQgYXR0ZW1wdHMgLSBza2lwIGV4ZWN1dGlvbiBhZnRlciA0IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG5sZXQgZmFpbHVyZUNvdW50ZXIgPSAwO1xuY29uc3QgTUFYX0ZBSUxVUkVTID0gMztcblxuLy8gQ29udmVydCBSU1NJIGluIGRCbSB0byBhIHF1YWxpdHkgcGVyY2VudGFnZSBiZXR3ZWVuIDAgYW5kIDEwMC5cbmZ1bmN0aW9uIGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKSB7XG4gICAgaWYgKGRibSA9PT0gbnVsbCB8fCBOdW1iZXIuaXNOYU4oZGJtKSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbWluRGJtID0gLTEwMDtcbiAgICBjb25zdCBtYXhEYm0gPSAtMzA7XG4gICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KG1pbkRibSwgTWF0aC5taW4obWF4RGJtLCBkYm0pKTtcbiAgICBjb25zdCBwZXJjZW50ID0gKChjbGFtcGVkIC0gbWluRGJtKSAvIChtYXhEYm0gLSBtaW5EYm0pKSAqIDEwMDtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChwZXJjZW50KTtcbn1cblxuLyoqXG4gKiBHZXQgY3VycmVudCBXTEFOIGluZm9ybWF0aW9uIChTU0lELCBCU1NJRCwgUXVhbGl0eSlcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtzc2lkOiBzdHJpbmd8bnVsbCwgYnNzaWQ6IHN0cmluZ3xudWxsLCBxdWFsaXR5OiBudW1iZXJ8bnVsbCwgbWVzc2FnZTogc3RyaW5nfG51bGx9Pn1cbiAqIEBkZXNjcmlwdGlvbiBtZXNzYWdlIGNhbiBiZTogXCJlcnJvclwiIChvbiBlcnJvciksIFwibm9pbnRlcmZhY2VcIiAobm8gaW50ZXJmYWNlIGF2YWlsYWJsZSksIFwibm9wZXJtaXNzaW9uc1wiIChsb2NhdGlvbiBwZXJtaXNzaW9ucyBtaXNzaW5nIG9uIFdpbmRvd3MpLCBvciBudWxsIChzdWNjZXNzKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm8oKSB7XG4gICAgLy8gU2tpcCBleGVjdXRpb24gaWYgd2UndmUgaGFkIHRvbyBtYW55IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG4gICAgaWYgKGZhaWx1cmVDb3VudGVyID49IE1BWF9GQUlMVVJFUykge1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHBsYXRmb3JtKSB7XG4gICAgICAgICAgICBjYXNlICdsaW51eCc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9MaW51eCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvV2luZG93cygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb01hY09TKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRW5zdXJlIHJlc3VsdCBpcyBhbHdheXMgYW4gb2JqZWN0XG4gICAgICAgIGlmICghcmVzdWx0IHx8IHR5cGVvZiByZXN1bHQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gUmVzZXQgY291bnRlciBvbiBzdWNjZXNzZnVsIHJlc3VsdCAoaGFzIGRhdGEpXG4gICAgICAgIGlmIChyZXN1bHQuc3NpZCB8fCByZXN1bHQuYnNzaWQgfHwgcmVzdWx0LnF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluY3JlbWVudCBjb3VudGVyIG9uIGZhaWx1cmVcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gUmV0dXJuIGVtcHR5IG9iamVjdCBpbnN0ZWFkIG9mIHRocm93aW5nIHRvIHByZXZlbnQgYXBwIGNyYXNoXG4gICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gTGludXggdXNpbmcgbm1jbGkgKHdpdGggZmFsbGJhY2sgdG8gaXcvaXdjb25maWcpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTGludXgoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IG5tY2xpIGZpcnN0IChtb3N0IGNvbW1vbiBvbiBtb2Rlcm4gTGludXgpXG4gICAgICAgIC8vIEZpcnN0IHRyeSB0byBnZXQgYWN0aXZlIGRldmljZSBkaXJlY3RseSAoZmFzdGVyIHRoYW4gbGlzdGluZyBhbGwgbmV0d29ya3MpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgc3Rkb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKCdubWNsaSAtdCAtZiBhY3RpdmUsc3NpZCxic3NpZCxzaWduYWwgZGV2aWNlIHdpZmkgbGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNDAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGNhdGNoIChleGVjRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBFdmVuIGlmIGV4ZWNBc3luYyB0aHJvd3MgYW4gZXJyb3IsIGNoZWNrIGlmIHN0ZG91dCBjb250YWlucyB2YWxpZCBkYXRhXG4gICAgICAgICAgICAgICAgLy8gbm1jbGkgc29tZXRpbWVzIHJldHVybnMgbm9uLXplcm8gZXhpdCBjb2RlIGJ1dCBzdGlsbCBwcm92aWRlcyB2YWxpZCBvdXRwdXRcbiAgICAgICAgICAgICAgICBpZiAoZXhlY0Vycm9yLnN0ZG91dCAmJiBleGVjRXJyb3Iuc3Rkb3V0LnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ZG91dCA9IGV4ZWNFcnJvci5zdGRvdXQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhlY0Vycm9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG91dHB1dCBmcm9tIG5tY2xpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaW5kIGFjdGl2ZSBjb25uZWN0aW9uXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKTtcbiAgICAgICAgICAgICAgICBpZiAoKHBhcnRzWzBdID09PSAneWVzJyB8fCBwYXJ0c1swXSA9PT0gJ2phJykgJiYgcGFydHMubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHBhcnRzWzFdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAvLyBCU1NJRCBpcyBhIE1BQyBhZGRyZXNzICg2IGhleCBieXRlcyBzZXBhcmF0ZWQgYnkgY29sb25zLCBwb3NzaWJseSBlc2NhcGVkKVxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIHVzaW5nIHJlZ2V4IC0gaGFuZGxlIGVzY2FwZWQgY29sb25zIChcXDopIGFzIHNob3duIGluIG5tY2xpIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAvLyBJbiByZWdleCBzdHJpbmcsIFxcXFw6IG1hdGNoZXMgYSBsaXRlcmFsIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBjb2xvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzpcXFxcOlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlc2NhcGUgYmFja3NsYXNoZXMgYW5kIG5vcm1hbGl6ZSB0byB1cHBlcmNhc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaFswXS5yZXBsYWNlKC9cXFxcOi9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjazogdHJ5IG5vcm1hbCBjb2xvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vcm1hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBub3JtYWxNYXRjaFswXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IHBhcnRzWzJdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpZ25hbCBpcyB0aGUgbGFzdCBudW1lcmljIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsU3RyID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0gPyBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXS50cmltKCkgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gc2lnbmFsU3RyID8gKHBhcnNlSW50KHNpZ25hbFN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKG5tY2xpRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dCwgZXRjLiksIG5vdCBpZiBqdXN0IG5vIFdMQU4gYWN0aXZlXG4gICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgbm1jbGlFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG5tY2xpRXJyb3IubWVzc2FnZSAmJiAhbm1jbGlFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdObyBvdXRwdXQnKSk7XG4gICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IG5tY2xpIGNvbW1hbmQgZmFpbGVkOicsIG5tY2xpRXJyb3IubWVzc2FnZSB8fCBubWNsaUVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gaXcgKGl3Y29uZmlnIGlzIGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1FIFwiXlxccypzc2lkfF5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd2xpbmtTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtQSA1IFwiXlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBTU0lEXG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gaXdTdGRvdXQgPyBpd1N0ZG91dC5tYXRjaCgvc3NpZFxccysoLispLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBzc2lkTWF0Y2ggPyBzc2lkTWF0Y2hbMV0udHJpbSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIGFuZCBzaWduYWwgZnJvbSBsaW5rIGluZm9cbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9hZGRyOlxccysoW2EtZjAtOTpdezE3fSkvaSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL3NpZ25hbDpcXHMrKC0/XFxkKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsRGJtID0gc2lnbmFsTWF0Y2ggPyAocGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgcXVhbGl0eSA9IHNpZ25hbERibSAhPT0gbnVsbCA/IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsRGJtKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoaXdFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yXG4gICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3RXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogaXcgY29tbWFuZCBmYWlsZWQ6JywgaXdFcnJvci5tZXNzYWdlIHx8IGl3RXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGZhbGxiYWNrOiBpd2NvbmZpZyAoZGVwcmVjYXRlZCBidXQgd2lkZWx5IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpd2NvbmZpZyAyPi9kZXYvbnVsbCB8IGdyZXAgLUUgXCJFU1NJRHxBY2Nlc3MgUG9pbnR8U2lnbmFsIGxldmVsXCInLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0VTU0lEOlwiKFteXCJdKylcIi8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNzaWRNYXRjaCkgc3NpZCA9IHNzaWRNYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0FjY2VzcyBQb2ludDpcXHMrKFthLWYwLTk6XXsxN30pL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIGJzc2lkID0gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goL1NpZ25hbCBsZXZlbD0oLT9cXGQrKS8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChpd2NvbmZpZ0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGFsbCBtZXRob2RzIGZhaWxlZCB3aXRoIHJlYWwgZXJyb3JzIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBBbGwgbWV0aG9kcyAobm1jbGksIGl3LCBpd2NvbmZpZykgZmFpbGVkLiBMYXN0IGVycm9yOicsIGl3Y29uZmlnRXJyb3IubWVzc2FnZSB8fCBpd2NvbmZpZ0Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ2Vycm9yJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgbWVzc2FnZTogJ25vaW50ZXJmYWNlJ1xuICAgIH07XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIG5ldHNoXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93cygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHNoIHdsYW4gc2hvdyBpbnRlcmZhY2VzJywge1xuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgc3RkZXJyIGZvciBzZXJ2aWNlIGVycm9yc1xuICAgICAgICBjb25zdCBlcnJvck91dHB1dCA9IChzdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IChzdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkT3V0cHV0ID0gb3V0cHV0ICsgJyAnICsgZXJyb3JPdXRwdXQ7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiBXTEFOIHNlcnZpY2UgaXMgbm90IHJ1bm5pbmcgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbnN2YycpIHx8IFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4gYXV0b2NvbmZpZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYXV0b21hdGlzY2ggd2xhbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbi1rb25maWd1cmF0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3NlcnZpY2UgaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RlciBkaWVuc3QnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIG5vIGludGVyZmFjZXMgYXZhaWxhYmxlXG4gICAgICAgIGlmIChzdGRvdXQuaW5jbHVkZXMoJ1RoZXJlIGlzIG5vIHdpcmVsZXNzIGludGVyZmFjZScpIHx8IFxuICAgICAgICAgICAgc3Rkb3V0LmluY2x1ZGVzKCdFcyBnaWJ0IGtlaW5lIERyYWh0bG9zLVNjaG5pdHRzdGVsbGUnKSB8fFxuICAgICAgICAgICAgc3Rkb3V0Lm1hdGNoKC9ObyB3aXJlbGVzcy9pKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lLmxlbmd0aCA+IDApO1xuICAgICAgICBcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgLy8gU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSwgaGFuZGxlcyB2YXJpb3VzIGZvcm1hdHNcbiAgICAgICAgICAgIC8vIFVzZSBuZWdhdGl2ZSBsb29rYmVoaW5kIHRvIGVuc3VyZSB3ZSBkb24ndCBtYXRjaCBcIkJTU0lEXCIgKHdoaWNoIGNvbnRhaW5zIFwiU1NJRFwiKVxuICAgICAgICAgICAgaWYgKGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6XFxzKiguKykvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBzZXQgaWYgbm90IGVtcHR5IGFuZCBub3QgXCJOL0FcIiBvciBzaW1pbGFyXG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWQgJiYgZXh0cmFjdGVkLmxlbmd0aCA+IDAgJiYgIWV4dHJhY3RlZC5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQgPSBleHRyYWN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBCU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSBwYXR0ZXJuIG1hdGNoaW5nXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9CU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIChoYW5kbGVzIGJvdGggLSBhbmQgOiBzZXBhcmF0b3JzLCB3aXRoIG9yIHdpdGhvdXQgc3BhY2VzKVxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvQlNTSURcXHMqOlxccyooW2EtZjAtOV17Mn0oPzpbLTpcXHNdW2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBtYXRjaFsxXS5yZXBsYWNlKC9bLSBdL2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTaWduYWwgcGFyc2luZyAtIGhhbmRsZSB2YXJpb3VzIGxvY2FsaXplZCBmb3JtYXRzIGFuZCBwYXR0ZXJuc1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvU2lnbmFsfFNpZ25hbHN0XHUwMEU0cmtlfEludGVuc2l0XHUwMEU5fFNlXHUwMEYxYWwvaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgcGVyY2VudGFnZSBwYXR0ZXJuIGZpcnN0IChtb3N0IGNvbW1vbilcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKihcXGQrKVxccyolL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKHBhcnNlZCkgJiYgcGFyc2VkID49IDAgJiYgcGFyc2VkIDw9IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IGRCbSBwYXR0ZXJuIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKigtP1xcZCspXFxzKmRCbS9pKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYm0gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihkYm0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBOb3JtYWxpemUgZW1wdHkgc3RyaW5ncyB0byBudWxsXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiAoc3NpZCAmJiBzc2lkLmxlbmd0aCA+IDApID8gc3NpZCA6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogKGJzc2lkICYmIGJzc2lkLmxlbmd0aCA+IDApID8gYnNzaWQgOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIGVycm9yIGlzIGR1ZSB0byBsb2NhdGlvbiBwZXJtaXNzaW9ucyAobWlnaHQgYmUgaW4gc3RkZXJyIG9yIGVycm9yIG1lc3NhZ2UpXG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IChlcnJvci5tZXNzYWdlIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZG91dCA9IChlcnJvci5zdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3RkZXJyID0gKGVycm9yLnN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRFcnJvck91dHB1dCA9IGVycm9yTWVzc2FnZSArICcgJyArIGVycm9yU3Rkb3V0ICsgJyAnICsgZXJyb3JTdGRlcnI7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgZXJyb3Igd2hlbiBjb21tYW5kIGV4ZWN1dGlvbiBmYWlscyAodGltZW91dCwgcGVybWlzc2lvbiwgZXRjLilcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3M6IEVycm9yIGV4ZWN1dGluZyBuZXRzaCBjb21tYW5kOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbCAoZmFsbGJhY2sgd2hlbiBuZXRzaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgKGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbilcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBhY3RpdmUgV2ktRmkgY29ubmVjdGlvbiBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwb3dlcnNoZWxsIC1Db21tYW5kIFwiJHByb2ZpbGUgPSBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgfCBXaGVyZS1PYmplY3QgeyRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaS1GaSpcXCcgLW9yICRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaXJlbGVzcypcXCd9IHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMTsgaWYgKCRwcm9maWxlKSB7ICRwcm9maWxlLk5hbWUgfVwiJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3NpZFN0ciA9IHNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHNzaWRTdHIgJiYgc3NpZFN0ci5sZW5ndGggPiAwICYmICFzc2lkU3RyLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkU3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQlNTSUQgY2Fubm90IGJlIGVhc2lseSByZXRyaWV2ZWQgd2l0aG91dCBuZXRzaCAod2hpY2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gICAgICAgIC8vIFNldHRpbmcgdG8gbnVsbCBhcyBmYWxsYmFjayAtIFNTSUQgaXMgdGhlIG1vc3QgaW1wb3J0YW50IGluZm9ybWF0aW9uIGFueXdheVxuICAgICAgICBjb25zdCBic3NpZCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgUG93ZXJTaGVsbCBmYWxsYmFjayAoY2FuJ3QgZWFzaWx5IGdldCBzaWduYWwgc3RyZW5ndGggd2l0aG91dCBuZXRzaClcbiAgICAgICAgLy8gUmV0dXJuIG5vcGVybWlzc2lvbnMgbWVzc2FnZSBzbyBmcm9udGVuZCBjYW4gc2hvdyB0aGUgd2FybmluZ1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ25vcGVybWlzc2lvbnMnXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIGVycm9yIGlmIFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbHNcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsOiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxlZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBtYWNPUyB1c2luZyBhaXJwb3J0IG9yIG5ldHdvcmtzZXR1cFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb01hY09TKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBhaXJwb3J0IGNvbW1hbmQgZmlyc3QgKGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBhaXJwb3J0IGlzIGF2YWlsYWJsZSAodXN1YWxseSBhdCAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydClcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBhaXJwb3J0UGF0aCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd3aGljaCBhaXJwb3J0IDI+L2Rldi9udWxsIHx8IGVjaG8gL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMTAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhaXJwb3J0ID0gYWlycG9ydFBhdGgudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGAke2FpcnBvcnR9IC1JYCwge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCByc3NpRGJtID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBzaWduYWxQZXJjZW50ID0gbnVsbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICBzc2lkID0gbGluZS5yZXBsYWNlKCdTU0lEOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ0JTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiB0byBlbnN1cmUgd2UgZ2V0IHRoZSBmdWxsIEJTU0lEXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRDpcXHMqKFthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2FnckN0bFJTU0k6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUlNTSSBpbiBkQm0gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpU3RyID0gbGluZS5yZXBsYWNlKCdhZ3JDdGxSU1NJOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2kgPSByc3NpU3RyID8gKHBhcnNlSW50KHJzc2lTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHJzc2lEYm0gPSByc3NpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdsaW5rIGF1dGg6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWx0ZXJuYXRpdmU6IHNpZ25hbCBzdHJlbmd0aCBhcyBwZXJjZW50YWdlIChpZiBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvKFxcZCspJS8pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2ggJiYgc2lnbmFsUGVyY2VudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbFBlcmNlbnQgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHF1YWxpdHkgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHNpZ25hbFBlcmNlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gc2lnbmFsUGVyY2VudDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocnNzaURibSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KHJzc2lEYm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc3NpZCB8fCBic3NpZCB8fCBxdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGFpcnBvcnRFcnJvcikge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbmV0d29ya3NldHVwIC0gb25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKG5vdCBqdXN0IG5vIHBlcm1pc3Npb24pXG4gICAgICAgICAgICBpZiAoYWlycG9ydEVycm9yLmNvZGUgIT09ICdFTk9FTlQnICYmIGFpcnBvcnRFcnJvci5tZXNzYWdlICYmICFhaXJwb3J0RXJyb3IubWVzc2FnZS5pbmNsdWRlcygncGVybWlzc2lvbicpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBhaXJwb3J0IGNvbW1hbmQgZmFpbGVkOicsIGFpcnBvcnRFcnJvci5tZXNzYWdlIHx8IGFpcnBvcnRFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrOiBuZXR3b3Jrc2V0dXAgYW5kIGlwY29uZmlnIChmb3IgbmV3ZXIgbWFjT1Mgd2hlcmUgYWlycG9ydCBpcyBub3QgYXZhaWxhYmxlKSAgLy8gc3lzdGVtX3Byb2ZpbGVyIGlzIHdheSB0byBoZWF2eSBhbmQgbmVlZHMgYSBsb29vb290IG9mIHRpbWUgdG8gcHJvY2Vzc1xuICAgICAgICAvLyB0aGlzIGlzIGEgc2ltcGxlIGNhbGN1bGF0aW9uLi4gd2UgY2FuJ3QgcmVseSBvbiBhIHByb2Nlc3MgdGhhdCB0YWtlcyAxMHMgdG8gY29tcGxldGUgYW5kIGJsb2NrcyB0aGUgd2hvbGUgc3lzdGVtXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgV0xBTiBpbnRlcmZhY2UgdXNpbmcgbmV0d29ya3NldHVwXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaW50ZXJmYWNlT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHdvcmtzZXR1cCAtbGlzdGFsbGhhcmR3YXJlcG9ydHMgfCBhd2sgXFwnL1dpLUZpfEFpclBvcnQve2dldGxpbmU7IHByaW50ICRORn1cXCcnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gaW50ZXJmYWNlT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFpbnRlcmZhY2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gV2ktRmkgaW50ZXJmYWNlIGZvdW5kXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgYXdrIC1GJyBTU0lEIDogJyAnLyBTU0lEIDogLyB7cHJpbnQgJDJ9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZE91dHB1dC50cmltKCkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWQsIGNvbnRpbnVlIHdpdGggQlNTSURcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IEJTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBic3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgZ3JlcCAnQlNTSUQgOicgfCBhd2sgJ3twcmludCAkM30nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkU3RyID0gYnNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIEJTU0lEIGZvcm1hdCAoTUFDIGFkZHJlc3MpXG4gICAgICAgICAgICAgICAgaWYgKGJzc2lkU3RyICYmIC9eW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9JC9pLnRlc3QoYnNzaWRTdHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRTdHIudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChic3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gQlNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIGZhbGxiYWNrIChhaXJwb3J0IG5vdCBhdmFpbGFibGUsIGNhbid0IGdldCBzaWduYWwgc3RyZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKG5ldHdvcmtzZXR1cEVycm9yKSB7XG4gICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgbmV0d29ya3NldHVwIGZhaWxzIHdpdGggYSByZWFsIGVycm9yXG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IG5ldHdvcmtzZXR1cC9pcGNvbmZpZyBmYWxsYmFjayBmYWlsZWQ6JywgbmV0d29ya3NldHVwRXJyb3IubWVzc2FnZSB8fCBuZXR3b3Jrc2V0dXBFcnJvcik7XG4gICAgICAgICAgICAvLyBJZiBmYWxsYmFjayBjb21wbGV0ZWx5IGZhaWxzLCByZXR1cm4gZXJyb3Igb2JqZWN0XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBnZXRXbGFuSW5mbyB9O1xuXG5cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICd0YXNrbGlzdCAvZm8gY3N2JyAoc3RydWN0dXJlZCBmb3JtYXQsIGZhc3RlciB0aGFuIC92LCBzdGlsbCBzaG93cyBwcm9jZXNzIG5hbWVzKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Rhc2tsaXN0IC9mbyBjc3YnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ25ldHN0YXQgLWFubycgKHNob3dzIGFsbCBjb25uZWN0aW9uIHN0YXRlcyBpbmNsdWRpbmcgRVNUQUJMSVNIRUQgZm9yIHNjcmVlbnNoYXJpbmcgZGV0ZWN0aW9uKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHN0YXQgLWFubycsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBSZWdleCB0byBmaW5kIDpQT1JUIGZvbGxvd2VkIGJ5IGEgc3BhY2UgKGVuc3VyZXMgZXhhY3QgcG9ydCBtYXRjaCwgZS5nLiwgOjU5MzggKVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH1cXFxcc2AsICdnJykgXG4gICAgICBpZiAocmVnZXgudGVzdChzdGRvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywnY29tLm1pY3Jvc29mdC50ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnLFxuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNixcbl1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHdpbiBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcydcbmltcG9ydCAqIGFzIG1hYyBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcydcbmltcG9ydCAqIGFzIGxpbnV4IGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTGluLmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2socGxhdGZvcm0gPSAnd2luMzInKSB7XG4gIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuIGF3YWl0IHdpbi5ydW5SZW1vdGVDaGVjaygpXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHJldHVybiBhd2FpdCBtYWMucnVuUmVtb3RlQ2hlY2soKVxuICByZXR1cm4gYXdhaXQgbGludXgucnVuUmVtb3RlQ2hlY2soKVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gRXhwYW5kZWQgYnJvd3NlciBrZXl3b3JkcyB0byBjYXRjaCBtb3JlIHZhcmlhbnRzXG5jb25zdCBicm93c2VyS2V5d29yZHMgPSBbXG4gICAgJ2Nocm9tJywgJ2Nocm9tZS5leGUnLFxuICAgICdlZGdlJywgJ21zZWRnZS5leGUnLFxuICAgICdmaXJlJywgJ2ZpcmVmb3guZXhlJyxcbiAgICAnYnJhdmUnLCAnYnJhdmUuZXhlJyxcbiAgICAnb3BlcmEnLCAnb3BlcmEuZXhlJyxcbiAgICAnYnJvd3NlcicsIC8vIEdlbmVyaWMgYnJvd3NlciBwcm9jZXNzXG4gICAgJ2lleHBsb3JlJywgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAnc2FmYXJpJywgLy8gRm9yIG1hY09TXG5dO1xuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwuZXhlIC1Ob0xvZ28gLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiYgeyAkcHJvYyA9IEdldC1DaW1JbnN0YW5jZSAtQ2xhc3MgV2luMzJfUHJvY2VzcyAtRmlsdGVyICdQcm9jZXNzSWQ9JHtwaWR9JzsgaWYgKCRwcm9jKSB7ICRwcm9jLlBhcmVudFByb2Nlc3NJZDsgJHByb2MuTmFtZSB9IH1cImA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChsaW5lc1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gbGluZXNbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzOiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBVbml4IHN5c3RlbXMgKExpbnV4L21hY09TKVxuICogVHJpZXMgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QpLCBmYWxscyBiYWNrIHRvIHBzIGNvbW1hbmRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCBtZXRob2QgfjRtcywgbm8gcHJvY2VzcyBzcGF3bilcbiAgICAgICAgY29uc3QgW3N0YXRDb250ZW50LCBjb21tQ29udGVudF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L3N0YXRgLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9jb21tYCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzdGF0Q29udGVudCkge1xuICAgICAgICAgICAgLy8gUGFyc2UgL3Byb2MvcGlkL3N0YXQ6IHBpZCAoY29tbSkgc3RhdGUgcHBpZCAuLi5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRNYXRjaCA9IHN0YXRDb250ZW50Lm1hdGNoKC9eXFxkK1xccytcXCgoW14pXSspXFwpXFxzK1xcUytcXHMrKFxcZCspLyk7XG4gICAgICAgICAgICBpZiAoc3RhdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChjb21tQ29udGVudCB8fCBzdGF0TWF0Y2hbMV0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChzdGF0TWF0Y2hbMl0sIDEwKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIHBzIGNvbW1hbmQgKHdvcmtzIG9uIGJvdGggTGludXggYW5kIG1hY09TKVxuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBzIC1wICR7cGlkfSAtbyBwcGlkPSxjb21tPWA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvVW5peDogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gYmFzZWQgb24gcGxhdGZvcm1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm8ocGlkKSB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuICAgIFxuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCk7XG4gICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fCBwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvVW5peChwaWQpOyAvLyBMaW51eC9tYWNPUzogdHJpZXMgL3Byb2MsIGZhbGxzIGJhY2sgdG8gcHNcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY2hlY2sgcGFyZW50IHByb2Nlc3NlcyBmb3IgYnJvd3NlclxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kUGFyZW50UHJvY2VzcyhwaWQsIG1heERlcHRoLCB2aXNpdGVkUGlkcykge1xuICAgIGlmIChwaWQgPT09IDEgfHwgcGlkID09PSAwKSB7XG4gICAgICAgIGxvZy5pbmZvKCdjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSb290IFBJRCByZWFjaGVkLiBObyB3ZWIgYnJvd3NlciBmb3VuZC4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWF4RGVwdGggPD0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gd2hlbiBtYXggZGVwdGggcmVhY2hlZFxuICAgIH1cbiAgICBcbiAgICBpZiAodmlzaXRlZFBpZHMuaGFzKHBpZCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG4gICAgfVxuICAgIFxuICAgIHZpc2l0ZWRQaWRzLmFkZChwaWQpO1xuICAgIFxuICAgIC8vIEdldCBwcm9jZXNzIGluZm8gKGdldFByb2Nlc3NJbmZvIGFscmVhZHkgaGFzIGl0cyBvd24gdGltZW91dCBwcm90ZWN0aW9uKVxuICAgIGNvbnN0IHByb2Nlc3NJbmZvID0gYXdhaXQgZ2V0UHJvY2Vzc0luZm8ocGlkKTtcbiAgICBcbiAgICBpZiAoIXByb2Nlc3NJbmZvKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgeyBwcGlkLCBuYW1lIH0gPSBwcm9jZXNzSW5mbztcbiAgICBcbiAgICAvLyBMb2cgdGhlIHByb2Nlc3MgaW5mbyBmb3IgZGVidWdnaW5nXG4gICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IENoZWNraW5nIHByb2Nlc3M6ICR7bmFtZX0gKFBJRDogJHtwaWR9LCBQUElEOiAke3BwaWR9KWApO1xuICAgIFxuICAgIC8vIE1vcmUgdGhvcm91Z2ggYnJvd3NlciBkZXRlY3Rpb25cbiAgICBpZiAoYnJvd3NlcktleXdvcmRzLnNvbWUoYnJvd3NlciA9PiBuYW1lLmluY2x1ZGVzKGJyb3dzZXIpKSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQnJvd3NlciBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuaW5jbHVkZXMoJ2V4cGxvcmVyJykgfHwgcHBpZCA8PSAxKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSZWFjaGVkIHN5c3RlbSBwcm9jZXNzIG9yIGV4cGxvcmVyYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHBpZCwgbWF4RGVwdGggLSAxLCB2aXNpdGVkUGlkcyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIHBhcmVudCBwcm9jZXNzIGlzIGEgYnJvd3NlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQYXJlbnRQcm9jZXNzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZvdW5kQnJvd3NlciA9IGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHByb2Nlc3MucHBpZCwgNiwgbmV3IFNldCgpKTtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGRldGVjdGlvbiByZXN1bHQ6ICR7Zm91bmRCcm93c2VyfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBmb3VuZEJyb3dzZXIgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBFcnJvciBpbiBicm93c2VyIGRldGVjdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZm91bmRCcm93c2VyOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICB9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7QUF1QkEsU0FBUyxZQUFBQSxpQkFBZ0I7QUFDekIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixPQUFPLFNBQVM7OztBQ3JCaEIsSUFBTSxTQUFTO0FBQUEsRUFDWCxhQUFhO0FBQUE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGVBQWU7QUFBQSxFQUNmLGdCQUFnQjtBQUFBLEVBQ2hCLFNBQVM7QUFBQSxFQUVULGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUE7QUFBQSxFQUNmLHFCQUFxQjtBQUFBO0FBQUEsRUFFckIscUJBQXFCO0FBQUEsRUFDckIsUUFBUTtBQUFBO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxVQUFVO0FBQUEsRUFDVixhQUFhO0FBQUEsRUFDYixTQUFTO0FBQUEsRUFFVCxTQUFTO0FBQUEsRUFDVCxXQUFXO0FBQUEsRUFDWCxhQUFhO0FBQUEsRUFDYixNQUFNO0FBQ1Y7QUFDQSxJQUFPLGlCQUFROzs7QURMZixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFDakIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sUUFBUTtBQUNmLE9BQU8sT0FBTyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDOUMsSUFBTSxZQUFZLFlBQVk7QUFJOUIsSUFBTSxx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RUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsWUFBWSxNQUFNO0FBQUcsV0FBTztBQUFBLEVBQU0sQ0FBQztBQUMvRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJleGVjU3luYyIsICJleGVjU3luYyIsICJsb2ciLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAiZ2xvYmFsU2hvcnRjdXQiLCAiVHJheSIsICJNZW51IiwgImRpYWxvZyIsICJsb2ciLCAibG9nIiwgInBhdGgiLCAiZnMiLCAiaXAiLCAiZ2F0ZXdheTRzeW5jIiwgImFwcCIsICJqb2luIiwgImxvZyIsICJsb2ciLCAiY29uZmlnU3RvcmUiLCAiYXBwc1RvQ2xvc2UiLCAiYXBwIiwgImxvZyIsICJqb2luIiwgImNoaWxkUHJvY2VzcyIsICJsb2ciLCAiX19kaXJuYW1lIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJqb2luIiwgImNoaWxkUHJvY2VzcyIsICJsb2ciLCAibG9nIiwgImFwcHNUb0Nsb3NlIiwgImNoaWxkUHJvY2VzcyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAidG9nZ2xlTWFjT1NMb2NrZG93biIsICJsb2ciLCAicGF0aCIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImpvaW4iLCAibG9nIiwgImFwcCIsICJmcyIsICJqb2luIiwgInNjcmVlbiIsICJpcGNNYWluIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIndlYkNvbnRlbnRzIiwgInBhdGgiLCAiZnMiLCAiY2xpcGJvYXJkIiwgImFwcCIsICJvcyIsICJsb2ciLCAicGF0aCIsICJsb2ciLCAiYXBwIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJzcGF3biIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJzcGF3biIsICJsb2ciLCAicHJvY2VzcyIsICJmcyIsICJwYXRoIiwgIm9zIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImFwcCIsICJsb2ciLCAiYXBwIiwgInBhdGgiLCAibG9nIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgInQiLCAibG9nIiwgImFwcCIsICJleGVjIiwgImRpYWxvZyIsICJhcHAiLCAibG9nIiwgImV4ZWMiLCAib3MiLCAibG9nIiwgImlzUmVhbEVycm9yIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgImNsaXBib2FyZCIsICJwYXRoIiwgImZzIiwgImVyciIsICJ3ZWJDb250ZW50cyIsICJvcyIsICJhcHAiLCAibG9nIiwgInBhdGgiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJydW5SZW1vdGVDaGVjayIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJydW5SZW1vdGVDaGVjayIsICJhcHAiLCAicGF0aCIsICJhZ2VudCIsICJmcyIsICJqb2luIiwgImlwY01haW4iLCAid2ViQ29udGVudHMiLCAic2NyZWVuIiwgImVyciIsICJleGVjIiwgInByb21pc2lmeSIsICJsb2ciLCAiZXhlY0FzeW5jIiwgIm5hbWUiLCAicHBpZCIsICJhcHAiLCAibG9nIiwgIk1lbnUiLCAiX19kaXJuYW1lIiwgImZzIiwgInBhdGgiLCAiZ2F0ZXdheTRzeW5jIiwgImlwIiwgIndlYkNvbnRlbnRzIiwgIkJyb3dzZXJXaW5kb3ciLCAiZXZlbnQiLCAidG9nZ2xlTWFjT1NMb2NrZG93biIsICJkaWFsb2ciLCAiZ2xvYmFsU2hvcnRjdXQiXQp9Cg==
