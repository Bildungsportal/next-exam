// src-electron/main/scripts/platformDispatcher.js
import { execSync as execSync2 } from "child_process";
import fs from "fs";
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
  bipApiUrl: "http://localhost:80/moodle",
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
  virtualized: false,
  isPuavo: false,
  version: "2.0.0.1",
  buildDate: "20260205",
  buildNumber: "1",
  info: "Release"
};
var config_default = config;

// src-electron/main/scripts/platformDispatcher.js
import { pathToFileURL } from "url";
import os from "os";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
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
    this.publicBase = this._getPublicBase();
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
  _getPublicBase() {
    if (app.isPackaged) {
      const unpacked = join(process.resourcesPath, "app.asar.unpacked");
      const withPublic = join(unpacked, "public");
      return fs.existsSync(withPublic) ? withPublic : unpacked;
    }
    return join(__dirname, "../../public");
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
        this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(this.publicBase, this.jre));
        return join(this.publicBase, this.jre);
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
        return join(this.publicBase, this.jre);
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
    const workerPath = join(this.publicBase, this.workerFileName);
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
import { app as app8, BrowserWindow as BrowserWindow3, powerSaveBlocker, nativeTheme, globalShortcut as globalShortcut2, Tray as Tray2, Menu as Menu2, dialog as dialog3, session } from "electron";

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
import path7 from "path";
import fs6 from "fs";
import * as fsExtra from "fs-extra";
import ip2 from "ip";
import { gateway4sync as gateway4sync2 } from "default-gateway";

// src-electron/main/scripts/windowhandler.js
import fs2 from "fs";
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
    appsToClose2.forEach((app9) => {
      childProcess.exec(`pgrep -i "${app9}"`, (pgrepError, stdout) => {
        if (!pgrepError && stdout && stdout.trim()) {
          childProcess.exec(`pgrep -i "${app9}" | xargs -r kill -9`, (killError) => {
            if (!killError) log3.info(`platformrestrictions @ enableRestrictions: closed ${app9}`);
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
    const publicBase2 = platformDispatcher_default.publicBase;
    const executable1 = join2(publicBase2, "disable-shortcuts.exe");
    childProcess2.execFile(executable1, [], { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    log4.info("platformrestrictions @ enableRestrictions: windows shortcuts disabled");
  } catch (err) {
    log4.error(`platformrestrictions @ enableRestrictions (win shortcuts): ${err}`);
  }
  try {
    for (const app9 of appsToClose2) {
      const escapedApp = app9.replace(/'/g, "''");
      const command = `powershell -NoProfile -Command "$appName = '${escapedApp}'; try { $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ilike ('*' + $appName + '*') }; if ($procs -and $procs.Count -gt 0) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output 'killed' } } catch { }"`;
      await new Promise((resolveApp) => {
        childProcess2.exec(command, (error, stdout, stderr) => {
          if (!error && stdout && stdout.trim().includes("killed")) {
            log4.info(`platformrestrictions @ enableRestrictions: closed ${app9}`);
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
  appsToClose2.forEach((app9) => {
    childProcess3.exec(`pkill -9 -f "${app9}"`, (error, stderr, stdout) => {
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
function getRendererIndexPath() {
  if (app2.isPackaged) {
    const unpacked = join4(process.resourcesPath, "app.asar.unpacked", "public", "index.html");
    if (fs2.existsSync(unpacked)) return unpacked;
  }
  const publicPath = join4(__dirname3, "public", "index.html");
  if (fs2.existsSync(publicPath)) return publicPath;
  const distRendererPath = join4(__dirname3, "dist", "renderer", "index.html");
  if (fs2.existsSync(distRendererPath)) return distRendererPath;
  const quasarPath = join4(__dirname3, "index.html");
  if (fs2.existsSync(quasarPath)) return quasarPath;
  return join4(__dirname3, "../renderer/index.html");
}
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
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
    this.easterwin.loadFile(join4(platformDispatcher_default.publicBase, "cowsonice", "index.html"));
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
      webPreferences: {
        preload: join4(__dirname3, "./preload/electron-preload.cjs")
      }
    });
    let url = "notfound";
    if (app2.isPackaged) {
      blockwin.loadFile(getRendererIndexPath(), { hash: `#/${url}/` });
    } else {
      url = `${"http://localhost:9301"}/#/${url}/`;
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
      webPreferences: {
        preload: join4(__dirname3, "./preload/electron-preload.cjs")
      }
    });
    let url = "lock";
    if (app2.isPackaged) {
      screenlockWindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/` });
    } else {
      url = `${"http://localhost:9301"}/#/${url}/`;
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
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
        this.examwindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/${token}` });
      } else {
        let backgroundurl = `${"http://localhost:9301"}/#/${url}/${token}/`;
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
        this.examwindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/${token}` });
      } else {
        url = `${"http://localhost:9301"}/#/${url}/${token}/`;
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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
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
      const filePath = getRendererIndexPath();
      log7.info(`windowhandler @ createMainWindow: Loading file: ${filePath}`);
      this.mainwindow.loadFile(filePath);
    } else {
      const url = `${"http://localhost:9301"}`;
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
import fs5 from "fs";
import archiver from "archiver";
import extract from "extract-zip";
import { join as join5 } from "path";
import { screen as screen2, ipcMain as ipcMain2, app as app7, BrowserWindow as BrowserWindow2, webContents as webContents2 } from "electron";

// src-electron/main/scripts/ipchandler.js
import path6 from "path";
import fs4 from "fs";
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
import { ipcMain, clipboard as clipboard2, app as app6, webContents } from "electron";
import { gateway4sync } from "default-gateway";
import os4 from "os";
import log13 from "electron-log";
import mammoth from "mammoth";

// src-electron/main/scripts/lt-server.js
import path4 from "path";
import log9 from "electron-log";

// src-electron/main/scripts/jre-handler.js
import fs3 from "fs";
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
    let dirs = fs3.readdirSync(dirPath).filter(
      (file) => fs3.statSync(path3.join(dirPath, file)).isDirectory()
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
var publicBase = () => platformDispatcher_default.publicBase;
var languageToolJarPath = path4.join(publicBase(), "LanguageTool/languagetool-server.jar");
var languageToolConfigPath = path4.join(publicBase(), "LanguageTool/server.properties");
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
import { app as app4, Tray, Menu } from "electron";
import path5 from "path";
import log10 from "electron-log";
var __dirname6 = import.meta.dirname;
var tray = null;
function getTrayIconPath() {
  const publicBase2 = platformDispatcher_default.publicBase;
  return path5.join(publicBase2, "icons", "icon24x24.png");
}
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
    tray = new Tray(getTrayIconPath());
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
        app4.quit();
      }
    }
    // exit
  ]);
  tray.setToolTip("Next-Exam Student");
  tray.setContextMenu(contextMenu);
};

// src-electron/main/scripts/testpermissionsMac.js
import { exec as exec2 } from "child_process";
import { dialog as dialog2, app as app5 } from "electron";
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
          fs4.writeFile(htmlfile, htmlContent, (err) => {
            if (err) {
              log13.error(`ipchandler @ storeHTML: ${err.message}`);
              let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`;
              log13.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath);
              fs4.writeFile(alternatepath, htmlContent, function(err2) {
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
          const files = fs4.readdirSync(this.config.examdirectory);
          files.forEach((file) => {
            if (file === alternatefilename) {
              const newPath = path6.join(this.config.examdirectory, alternatebackupfilename);
              fs4.renameSync(alternatepath, newPath);
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
            if (fs4.existsSync(pdffilepath)) {
              fs4.unlinkSync(pdffilepath);
            }
          } catch (err) {
            log13.error(`ipchandler @ printpdf: ${err.message}`);
          }
          fs4.writeFile(pdffilepath, data, (err) => {
            if (err) {
              log13.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `);
              try {
                if (fs4.existsSync(alternatepath)) {
                  fs4.unlinkSync(alternatepath);
                }
              } catch (err2) {
                log13.error(`ipchandler @ printpdf (alternativer Pfad): ${err2.message}`);
              }
              fs4.writeFile(alternatepath, data, (err2) => {
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
        fs4.writeFileSync(bakFilePath, jsonData, "utf8");
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
          await fs4.promises.mkdir(workdir, { recursive: true });
          const filelist = (await fs4.promises.readdir(workdir, { withFileTypes: true })).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
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
          if (!fs4.existsSync(config2.examdirectory)) {
            fs4.mkdirSync(config2.examdirectory, { recursive: true });
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
            app6.quit();
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
          fs4.writeFileSync(ggbFilePath, fileData);
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
        const fileData = fs4.readFileSync(ggbFilePath);
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
          let data = fs4.readFileSync(filepath);
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
        const audioData = fs4.readFileSync(filepath);
        return audioData.toString("base64");
      }
      if (filename && publicdir) {
        const publicBase2 = platformDispatcher_default.publicBase;
        let filepath = path6.join(publicBase2, filename);
        const audioData = fs4.readFileSync(filepath);
        return audioData.toString("base64");
      }
      return false;
    });
    ipcMain.handle("getfilesasync", async (event, filename, audio = false, docx = false) => {
      const workdir = path6.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path6.join(workdir, filename);
        if (audio == true) {
          const audioData = fs4.readFileSync(filepath);
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
            let data = fs4.readFileSync(filepath, "utf8");
            return data;
          } catch (err) {
            log13.error(`ipchandler @ getfilesasync: ${err}`);
            return false;
          }
        }
      } else {
        try {
          if (!fs4.existsSync(workdir)) {
            fs4.mkdirSync(workdir, { recursive: true });
          }
          let filelist = fs4.readdirSync(workdir, { withFileTypes: true }).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
          let files = [];
          filelist.forEach((file) => {
            let modified = fs4.statSync(path6.join(workdir, file)).mtime;
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
          if (!fs4.existsSync(filepath)) {
            log13.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`);
            return false;
          }
          log13.info(`ipchandler @ getbackupfile: backup file exists, reading content`);
          let data = fs4.readFileSync(filepath, "utf8");
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
        pdfPath = path6.join(platformDispatcher_default.publicBase, pdfFilename);
        if (!fs4.existsSync(pdfPath)) {
          log13.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
          return null;
        }
        const buffer = fs4.readFileSync(pdfPath);
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
      if (process.platform !== "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = platformDispatcher_default.publicBase;
        try {
          const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng", { langPath: publicPath, cachePath: this.config.tempdirectory });
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
          if (fs5.existsSync(this.config.examdirectory)) {
            fs5.rmSync(this.config.examdirectory, { recursive: true });
            fs5.mkdirSync(this.config.examdirectory);
          }
        } catch (error) {
          delfolder = false;
          windowhandler_default.examwindow.webContents.send("fileerror", error);
          log14.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `);
        }
        if (delfolder == false) {
          if (fs5.existsSync(this.config.examdirectory)) {
            const files = fs5.readdirSync(this.config.examdirectory);
            files.forEach((file) => {
              const filePath = join5(this.config.examdirectory, file);
              try {
                const stats = fs5.statSync(filePath);
                if (stats.isDirectory()) {
                  fs5.rmSync(filePath, { recursive: true });
                } else {
                  fs5.unlinkSync(filePath);
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
          if (fs5.existsSync(examDir) && currentLockedSection != null && currentLockedSection !== void 0) {
            log14.debug(`communicationhandler @ processUpdatedServerstatus: Saving content from examDir to section ${currentLockedSection}`);
            const savePath = `${examDir}/${currentLockedSection}`;
            if (!fs5.existsSync(savePath)) {
              fs5.mkdirSync(savePath, { recursive: true });
            }
            const files = fs5.readdirSync(examDir);
            log14.info(`communicationhandler @ processUpdatedServerstatus: Found ${files.length} items in examDir to save`);
            let filesSaved = 0;
            for (const file of files) {
              const oldPath = `${examDir}/${file}`;
              const stat = fs5.statSync(oldPath);
              if (stat.isFile()) {
                const newPath = `${savePath}/${file}`;
                fs5.copyFileSync(oldPath, newPath);
                fs5.unlinkSync(oldPath);
                filesSaved++;
                log14.info(`communicationhandler @ processUpdatedServerstatus: Saved file ${file} to section ${currentLockedSection}`);
              } else {
                log14.info(`communicationhandler @ processUpdatedServerstatus: Skipping non-file (folder) item ${file} in examDir`);
              }
            }
            log14.info(`communicationhandler @ processUpdatedServerstatus: Successfully saved ${filesSaved} files to section ${currentLockedSection}`);
          } else {
            log14.warn(`communicationhandler @ processUpdatedServerstatus: Skipping save - examDir exists: ${fs5.existsSync(examDir)}, currentLockedSection: ${currentLockedSection}`);
          }
          if (newLockedSection != null && newLockedSection !== void 0) {
            log14.debug(`communicationhandler @ processUpdatedServerstatus: Loading content from section ${newLockedSection} to examDir`);
            const loadPath = `${examDir}/${newLockedSection}`;
            if (fs5.existsSync(loadPath)) {
              const filesToLoad = fs5.readdirSync(loadPath);
              log14.info(`communicationhandler @ processUpdatedServerstatus: Found ${filesToLoad.length} items in section ${newLockedSection} directory`);
              let filesCopied = 0;
              for (const file of filesToLoad) {
                const sourcePath = `${loadPath}/${file}`;
                const destPath = `${examDir}/${file}`;
                const stat = fs5.statSync(sourcePath);
                if (stat.isFile()) {
                  fs5.copyFileSync(sourcePath, destPath);
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
        if (fs5.existsSync(this.config.examdirectory)) {
          fs5.rmSync(this.config.examdirectory, { recursive: true });
          fs5.mkdirSync(this.config.examdirectory);
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
      fs5.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
        if (err) {
          log14.error(err);
        } else {
          extract(absoluteFilepath, { dir: this.config.examdirectory }).then(() => {
            log14.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
            return fs5.promises.unlink(absoluteFilepath);
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
      if (!fs5.existsSync(this.config.tempdirectory)) {
        fs5.mkdirSync(this.config.tempdirectory);
      }
    } catch (e) {
      log14.error(e);
    }
    let logfilepath = platformDispatcher_default.logfile;
    if (fs5.existsSync(logfilepath)) {
      try {
        fs5.copyFileSync(logfilepath, join5(this.config.examdirectory, "next-exam-student.log"));
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
      const fileContent = fs5.readFileSync(zipfilepath);
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
    const stream = fs5.createWriteStream(outPath);
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
app8.commandLine.appendSwitch("lang", "de");
app8.commandLine.appendSwitch("enable-unsafe-swiftshader");
app8.commandLine.appendSwitch("log-level", "3");
if (process.platform === "linux") {
  app8.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,OutOfProcessRasterization,CanvasOopRasterization");
  app8.commandLine.appendSwitch("disable-zero-copy");
} else if (process.platform === "darwin") {
  app8.commandLine.appendSwitch("enable-features", "Metal,CanvasOopRasterization");
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
if (!app8.requestSingleInstanceLock()) {
  log16.warn("main @ singleinstance: next-exam already running.");
  app8.quit();
  process.exit(0);
}
app8.on("second-instance", () => {
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
config_default.homedirectory = platformDispatcher_default.homedirectory;
config_default.workdirectory = platformDispatcher_default.workdirectory;
config_default.tempdirectory = platformDispatcher_default.tempdirectory;
config_default.examdirectory = config_default.workdirectory;
if (!fs6.existsSync(config_default.workdirectory)) {
  fs6.mkdirSync(config_default.workdirectory, { recursive: true });
}
if (!fs6.existsSync(config_default.tempdirectory)) {
  fs6.mkdirSync(config_default.tempdirectory, { recursive: true });
}
if (!fs6.existsSync(platformDispatcher_default.desktopPath)) {
  fs6.mkdirSync(platformDispatcher_default.desktopPath, { recursive: true });
}
var linkPath = path7.join(platformDispatcher_default.desktopPath, config_default.clientdirectory);
try {
  fs6.unlinkSync(linkPath);
} catch (e) {
}
try {
  if (!fs6.existsSync(linkPath)) {
    fs6.symlinkSync(config_default.workdirectory, linkPath, "junction");
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
app8.on("render-process-gone", (event, webContents3, details) => {
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
app8.on("child-process-gone", (event, details) => {
  log16.error("main @ child-process-gone: Child process crashed");
  log16.error("main @ child-process-gone: Type:", details.type);
  log16.error("main @ child-process-gone: Reason:", details.reason);
  log16.error("main @ child-process-gone: Exit code:", details.exitCode);
  event.preventDefault();
});
if (process.platform === "win32") {
  app8.setAppUserModelId(app8.getName());
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
app8.on("certificate-error", (event, webContents3, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
app8.on("web-contents-created", (event, webContents3) => {
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
app8.on("window-all-closed", async () => {
  clearInterval(communicationhandler_default.updateStudentIntervall);
  if (windowhandler_default.checkWindowInterval?.stop) windowhandler_default.checkWindowInterval.stop();
  if (communicationhandler_default.updateScheduler?.stop) communicationhandler_default.updateScheduler.stop();
  if (communicationhandler_default.screenshotScheduler?.stop) communicationhandler_default.screenshotScheduler.stop();
  if (multicastclient_default.refreshExamsScheduler?.stop) multicastclient_default.refreshExamsScheduler.stop();
  windowhandler_default.mainwindow = null;
  try {
    await session.defaultSession.clearStorageData({});
  } catch (err) {
    log16.error("main @ window-all-closed: Error clearing storage:", err);
  }
  app8.quit();
});
app8.on("will-quit", () => {
  toggleMacOSLockdown2(false);
});
app8.on("activate", () => {
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
      app8.quit();
    } else {
      log16.info("main @ checkparent: Parent Process Check OK");
    }
  } catch (error) {
    log16.error("main @ checkParent error:", error);
  }
}
app8.whenReady().then(async () => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuZG90ZW52LmNvbmZpZygpO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLnBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICB0aGlzLl9hcmNoID0gcHJvY2Vzcy5hcmNoO1xuICAgIHRoaXMuX2VudiA9IHByb2Nlc3MuZW52O1xuXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmlzS0RFID0gdGhpcy5faXNLREUoKTtcbiAgICB0aGlzLmlzR05PTUUgPSB0aGlzLl9pc0dOT01FKCk7XG4gICAgdGhpcy5mbGFtZXNob3QgPSB0aGlzLl9nZXRWZXJzaW9uKCdmbGFtZXNob3QnKTtcbiAgICB0aGlzLmltYWdlbWFnaWNrID0gdGhpcy5fZ2V0VmVyc2lvbignY29udmVydCcpO1xuICAgIHRoaXMuaW1WZXJzaW9uID0gdGhpcy5fZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCk7XG4gICAgdGhpcy53b3JrZXJGaWxlTmFtZSA9IHRoaXMuX2dldFdvcmtlckZpbGVOYW1lKCk7XG4gICAgdGhpcy51c2VXb3JrZXIgPSB0aGlzLl9nZXRVc2VXb3JrZXIoKTtcbiAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gdGhpcy5fZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKTtcbiAgICB0aGlzLmpyZSA9IHRoaXMuX2RldGVjdEpSRUlkKCk7XG4gICAgdGhpcy5wdWJsaWNCYXNlID0gdGhpcy5fZ2V0UHVibGljQmFzZSgpO1xuICAgIHRoaXMuanJlRGlyID0gdGhpcy5fcmVzb2x2ZUpSRURpcigpO1xuICAgIHRoaXMuamF2YUJpbiA9IHRoaXMuX3Jlc29sdmVKYXZhQmluKCk7XG4gICAgdGhpcy5qcmVJbmZvID0gdGhpcy5fZ2V0SlJFKCk7XG4gICAgXG4gICAgdGhpcy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpO1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICAgIHRoaXMud29ya2VyVVJMID0gdGhpcy5fZ2V0V29ya2VyVVJMKCk7XG4gICAgdGhpcy50ZW1wZGlyZWN0b3J5ID0gdGhpcy5fZ2V0VGVtcGRpcmVjdG9yeSgpO1xuICAgIHRoaXMud29ya2RpcmVjdG9yeSA9IHRoaXMuX2dldFdvcmtkaXJlY3RvcnkoKTtcbiAgICB0aGlzLmxvZ2ZpbGUgPSB0aGlzLl9nZXRMb2dmaWxlKCk7XG5cbiAgfVxuXG4gIF9nZXRQdWJsaWNCYXNlKCkge1xuICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgY29uc3QgdW5wYWNrZWQgPSBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJyk7XG4gICAgICBjb25zdCB3aXRoUHVibGljID0gam9pbih1bnBhY2tlZCwgJ3B1YmxpYycpO1xuICAgICAgcmV0dXJuIGZzLmV4aXN0c1N5bmMod2l0aFB1YmxpYykgPyB3aXRoUHVibGljIDogdW5wYWNrZWQ7XG4gICAgfVxuICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICB9XG5cbiAgX2dldFdvcmtkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5ob21lZGlyZWN0b3J5LCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTtcbiAgfVxuXG4gIF9nZXRUZW1wZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKTtcbiAgfVxuXG5cbiAgX2dldExvZ2ZpbGUoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy53b3JrZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJyk7XG4gIH1cblxuICBfbm9ybWFsaXplQXJjaCgpIHtcbiAgICBpZiAodGhpcy5fYXJjaCA9PT0gJ2lhMzInKSByZXR1cm4gJ2k1ODYnO1xuICAgIGlmIChbJ3g2NCcsICdhcm02NCddLmluY2x1ZGVzKHRoaXMuX2FyY2gpKSByZXR1cm4gdGhpcy5fYXJjaDtcbiAgICB0aGlzLl9mYWlsKGB1bnN1cHBvcnRlZCBhcmNoaXRlY3R1cmU6ICR7dGhpcy5fYXJjaH1gKTtcbiAgfVxuXG4gIF9kZXRlY3RKUkVJZCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gJ21pbmltYWwtanJlLTExLXdpbic7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXJjaCA9PT0gJ2FybTY0JyA/ICdtaW5pbWFsLWpyZS0xMS1tYWMtYXJtNjQnIDogJ21pbmltYWwtanJlLTExLW1hYyc7XG4gICAgfVxuICB9XG5cblxuXG5cblxuICAvKipcbiAgICogXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIEBkZXNjcmlwdGlvbiB0aGlzIGZ1bmN0aW9uIHJlc29sdmVzIHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIGl0IGZpcnN0IGNoZWNrcyBpZiB0aGUgdXNlQnVuZGxlZEpSRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZVxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgY2hlY2tzIGlmIHRoZSBzeXN0ZW0ganJlIGlzIGluc3RhbGxlZFxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3lzdGVtIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogdGhlIGJ1bmRsZWQganJlIGlzIGxvY2F0ZWQgaW4gdGhlIHB1YmxpYyBkaXJlY3Rvcnkgb2YgdGhlIGFwcFxuICAgKiBcbiAgICogRklYTUU6IGlmIHN5c3RlbSBqcmUgaXMgc2VsZWN0ZWQgYnkgRU5WIGRvIG5vdCBpbmNsdWRlIHRoZSBqcmUgZGlyZWN0b3J5IGluIHRoZSBmaW5hbCBidWlsZFxuICAgKi9cblxuICBfcmVzb2x2ZUpSRURpcigpIHtcbiAgICAvLyB1c2UgYnVuZGxlZCBqcmUgYmVjYXVzZSBpdHMgc21hbGxlciBhbmQgcHJvdmlkZXMgb25seSB0aGUgbmVlZGVkIGphdmEgbW9kdWxlc1xuICAgIGlmIChjb25maWcudXNlQnVuZGxlZEpSRSkge1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKHRoaXMucHVibGljQmFzZSwgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogIWFwcC5pc1BhY2thZ2VkOiBcIiArIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH0gXG4gICAgZWxzZSB7ICAvLyB1c2Ugc3lzdGVtIGpyZVxuICAgICAgLy8gVHJ5IHRvIGZpbmQgSmF2YSBpbnN0YWxsYXRpb24gdXNpbmcgd2hpY2gvd2hlcmUgY29tbWFuZFxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgamF2YUNvbW1hbmQgPSB0aGlzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ3doZXJlIGphdmEnIDogJ3doaWNoIGphdmEnO1xuICAgICAgICBjb25zdCBqYXZhUGF0aCA9IGV4ZWNTeW5jKGphdmFDb21tYW5kLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGphdmFQYXRoKSB7XG4gICAgICAgICAgLy8gR2V0IHRoZSBkaXJlY3RvcnkgY29udGFpbmluZyB0aGUgamF2YSBleGVjdXRhYmxlXG4gICAgICAgICAgY29uc3QgamF2YURpciA9IHBhdGguZGlybmFtZShqYXZhUGF0aCk7XG4gICAgICAgICAgLy8gR28gdXAgdG8gdGhlIEpSRS9KREsgcm9vdCAodXN1YWxseSAyIGxldmVscyB1cCBmcm9tIGJpbi8pXG4gICAgICAgICAgY29uc3QganJlUm9vdCA9IHBhdGguZGlybmFtZShwYXRoLmRpcm5hbWUoamF2YURpcikpO1xuICAgICAgICAgIHJldHVybiBqcmVSb290O1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gSmF2YSBub3QgZm91bmQgaW4gUEFUSFxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBJZiBubyBKYXZhIGZvdW5kLCBmYWxsIGJhY2sgdG8gYnVuZGxlZCBKUkVcbiAgICAgIGxvZy53YXJuKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX3Jlc29sdmVKUkVEaXI6IE5vIHN5c3RlbSBKYXZhIGZvdW5kLCBmYWxsaW5nIGJhY2sgdG8gYnVuZGxlZCBKUkVcIik7XG4gICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgcmV0dXJuIGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3Jlc29sdmVKYXZhQmluKCkge1xuICAgIHN3aXRjaCAodGhpcy5wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5wbGF0Zm9ybX1gKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0RGlzcGxheVNlcnZlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4JykgcmV0dXJuICduL2EnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnKSByZXR1cm4gJ3dheWxhbmQnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3gxMScgfHwgdGhpcy5fZW52LkRJU1BMQVkpIHJldHVybiAneDExJztcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG5cbiAgX2dldFZlcnNpb24oY21kKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke2NtZH0gLS12ZXJzaW9uYCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnNwbGl0KCdcXG4nKVswXTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL1tcXGRdKyhcXC5bXFxkXSspKy8pO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb246IHZlcnNpb24/LlswXSB8fCAndW5rbm93bicgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRKUkUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdqYXZhIC12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdpZ25vcmUnLCAncGlwZSddIH0pO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvdmVyc2lvbiBcIihbXFxkLl9dKylcIi8pPy5bMV0gfHwgJ3Vua25vd24nO1xuICAgICAgY29uc3QgamF2YUhvbWUgPSB0aGlzLl9lbnYuSkFWQV9IT01FIHx8ICcnO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb24sIHBhdGg6IGphdmFIb21lIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwsIHBhdGg6IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0V29ya2VyRmlsZU5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLndvcmtlckZpbGVOYW1lKTtcbiAgICByZXR1cm4gcGF0aFRvRmlsZVVSTCh3b3JrZXJQYXRoKTtcbiAgfVxuXG4gIGlzV2F5bGFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJztcbiAgfVxuXG4gIF9pc0tERSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICByZXR1cm4gb3V0ID09PSAnS0RFJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0tERTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNHTk9NRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ2dub21lJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNHTk9NRTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNVTklUWSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ3VuaXR5Jyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc1VOSVRZOiBubyBkYXRhXCIsIGVycik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZsYW1lc2hvdEF2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJ3aGljaCBmbGFtZXNob3RcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9mbGFtZXNob3RBdmFpbGFibGU6IEZsYW1lc2hvdCBub3QgZm91bmRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX3NldHVwRGVza3RvcFBhdGgoKSB7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gIH1cblxuICBfZ2V0RGVza3RvcFBhdGgoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4ocHJvY2Vzcy5lbnZbJ1VTRVJQUk9GSUxFJ10sICdEZXNrdG9wJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnRGVza3RvcCcpO1xuICAgIH1cbiAgfVxuXG4gIF9mYWlsKG1zZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBbcGxhdGZvcm1EaXNwYXRjaGVyXSAke21zZ31gKTtcbiAgfVxuXG4gIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwibWFnaWNrIC12ZXJzaW9uXCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogRm91bmQgSW1hZ2VNYWdpY2sgdjcgKG1hZ2ljaylcIik7XG4gICAgICByZXR1cm4gXCI3XCI7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiBcIjw3XCI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZ2V0VXNlV29ya2VyKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1hZ2VtYWdpY2tBdmFpbGFibGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgX2dldFNjcmVlbnNob3RBYmlsaXR5KCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBpZiAoKHRoaXMuX2lzR05PTUUoKSB8fCB0aGlzLl9pc1VOSVRZKCkpICYmIHRoaXMuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBHTk9NRS9Vbml0eSArIFdheWxhbmQgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc0tERSgpICYmIHRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy5fZmxhbWVzaG90QXZhaWxhYmxlKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBLREUvV2F5bGFuZCArIEZsYW1lc2hvdCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLnVzZVdvcmtlcikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFgxMSArIEltYWdlTWFnaWNrIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZSBcdTIwMTMgZmFsbGJhY2sgdG8gcGFnZWNhcHR1cmVcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgdXNlQnVuZGxlZEpSRTogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBEZW1vOiB0cnVlLFxuICAgIGJpcEFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAvbW9vZGxlJyxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIHZpcnR1YWxpemVkOiBmYWxzZSxcbiAgICBpc1B1YXZvOiBmYWxzZSxcbiAgICBcbiAgICB2ZXJzaW9uOiAnMi4wLjAuMScsXG4gICAgYnVpbGREYXRlOiAnMjAyNjAyMDUnLFxuICAgIGJ1aWxkTnVtYmVyOiAnMScsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgcG93ZXJTYXZlQmxvY2tlciwgbmF0aXZlVGhlbWUsIGdsb2JhbFNob3J0Y3V0LCBUcmF5LCBNZW51LCBkaWFsb2csIHNlc3Npb259IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCAqIGFzIGZzRXh0cmEgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3RyYXltZW51LmpzJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tQYXJlbnRQcm9jZXNzIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMnO1xuXG5pbXBvcnQgeyB0b2dnbGVNYWNPU0xvY2tkb3duIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnXG5KcmVIYW5kbGVyLmluaXQoKVxuXG5cblxuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnbGFuZycsICdkZScpO1xuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLXVuc2FmZS1zd2lmdHNoYWRlcicpO1xuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnbG9nLWxldmVsJywgJzMnKTsgLy8gMyA9IFdBUk4sIDIgPSBFUlJPUiwgMSA9IElORk9cblxuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpe1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2Rpc2FibGUtZmVhdHVyZXMnLCAnVmFhcGlWaWRlb0RlY29kZXIsT3V0T2ZQcm9jZXNzUmFzdGVyaXphdGlvbixDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7IC8vIGRpc2FibGUgZnJhZ2lsZSBHUFUgZmVhdHVyZXNcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLXplcm8tY29weScpOyBcbn1cbmVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdlbmFibGUtZmVhdHVyZXMnLCAnTWV0YWwsQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAgLy8gbWFjb3Mgb25seVxufVxuXG5cblxuXG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxvZy5ldmVudExvZ2dlci5zdGFydExvZ2dpbmcoKTtcbmxvZy5lcnJvckhhbmRsZXIuc3RhcnRDYXRjaGluZygpO1xubG9nLnRyYW5zcG9ydHMuZmlsZS5yZXNvbHZlUGF0aEZuID0gKCkgPT4geyByZXR1cm4gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGUgIH1cblxubG9nLnRyYW5zcG9ydHMuY29uc29sZS5mb3JtYXQgPSAobWVzc2FnZSkgPT4ge1xuICAgIC8vIEFsd2F5cyByZXR1cm4gYW4gYXJyYXksIG5vdCBzdHJpbmdzIVxuICAgIHN3aXRjaCAobWVzc2FnZS5sZXZlbCkge1xuICAgICAgY2FzZSAnaW5mbyc6IHJldHVybiBbY2hhbGsuZ3JlZW4obWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ3dhcm4nOiByZXR1cm4gW2NoYWxrLnllbGxvdyhtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnZXJyb3InOiByZXR1cm4gW2NoYWxrLnJlZChtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnZGVidWcnOiByZXR1cm4gW2NoYWxrLmJsdWUobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ3ZlcmJvc2UnOiByZXR1cm4gW2NoYWxrLm1hZ2VudGEobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGRlZmF1bHQ6ICAgICByZXR1cm4gW1N0cmluZyhtZXNzYWdlLmRhdGEpXTtcbiAgICB9XG59O1xuXG5sb2cudmVyYm9zZSgpXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbjogc3RhcnRpbmcgTmV4dC1FeGFtIFN0dWRlbnQgXCIke2NvbmZpZy52ZXJzaW9ufSAke2NvbmZpZy5pbmZvfVwiICgke3Byb2Nlc3MucGxhdGZvcm19KSR7Y29uZmlnLmRldmVsb3BtZW50ID8gJyAoZGV2bW9kZSBvbiknIDogJyd9YClcbmxvZy52ZXJib3NlKGBtYWluOiAtLS0tLS0tLS0tLS0tLS0tLS0tYClcbmxvZy5pbmZvKGBtYWluOiBMb2dmaWxlbG9jYXRpb24gYXQgJHtwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZX1gKVxucGxhdGZvcm1EaXNwYXRjaGVyLm1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7IGxvZy5kZWJ1ZyhtZXNzYWdlKSB9KTtcblxuLy8gbG9nIGVsZWN0cm9uIHZlcnNpb24gYW5kIG90aGVyIHBsYXRmb3JtIGluZm9ybWF0aW9uXG5sb2cuZGVidWcoYG1haW46IEVsZWN0cm9uIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5lbGVjdHJvbn1gKVxubG9nLmRlYnVnKGBtYWluOiBDaHJvbWl1bSB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuY2hyb21lfWApXG5sb2cuZGVidWcoYG1haW46IE5vZGUgdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLm5vZGV9YClcbmxvZy5kZWJ1ZyhgbWFpbjogVjggdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLnY4fWApXG5sb2cuZGVidWcoYG1haW46IE9TOiAke3Byb2Nlc3MucGxhdGZvcm19ICR7cHJvY2Vzcy5hcmNofWApXG5sb2cuZGVidWcoYG1haW46IEFyY2g6ICR7cHJvY2Vzcy5hcmNofWApXG5cblxuV2luZG93SGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgLy8gbWFpbndpbmRvdywgZXhhbXdpbmRvdywgYmxvY2t3aW5kb3dcbkNvbW1IYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAgIC8vIHN0YXJ0cyBcImJlYWNvblwiIGludGVydmFsbCBhbmQgZmV0Y2hlcyBpbmZvcm1hdGlvbiBmcm9tIHRoZSB0ZWFjaGVyIC0gYWN0cyBvbiBpdCAoc3RhcnRleGFtLCBzdG9wZXhhbSwgc2VuZGZpbGUsIGdldGZpbGUpXG5JcGNIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcsIFdpbmRvd0hhbmRsZXIsIENvbW1IYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cbi8vIFByZXZlbnRzIEVsZWN0cm9uIGZyb20gY3JlYXRpbmcgdGhlIGRlZmF1bHQgbWVudVxuTWVudS5zZXRBcHBsaWNhdGlvbk1lbnUobnVsbCk7XG5cblxuaWYgKCFhcHAucmVxdWVzdFNpbmdsZUluc3RhbmNlTG9jaygpKSB7ICAvLyBhbGxvdyBvbmx5IG9uZSBpbnN0YW5jZSBvZiB0aGUgYXBwIHBlciBjbGllbnRcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogbmV4dC1leGFtIGFscmVhZHkgcnVubmluZy5cIilcbiAgICBhcHAucXVpdCgpXG4gICAgcHJvY2Vzcy5leGl0KDApXG59XG5cbmFwcC5vbignc2Vjb25kLWluc3RhbmNlJywgKCkgPT4ge1xuICAgIGxvZy53YXJuKFwibWFpbiBAIHNpbmdsZWluc3RhbmNlOiBwcmV2ZW50ZWQgc2Vjb25kIHN0YXJ0IG9mIG5leHQtZXhhbS4gUmVzdG9yaW5nIGV4aXN0aW5nIE5leHQtRXhhbSB3aW5kb3cuXCIpXG4gICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdykge1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzTWluaW1pemVkKCkgfHwgIVdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICB9IFxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuXG4vKipcbiAqIGFkZGl0aW9uYWwgY29uZmlnIHNldHRpbmdzIGFuZCBwYXRoIGNoZWNrc1xuICovXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbmZpZy5ob21lZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnk7XG5jb25maWcud29ya2RpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZGlyZWN0b3J5O1xuY29uZmlnLnRlbXBkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeTtcbmNvbmZpZy5leGFtZGlyZWN0b3J5ID0gY29uZmlnLndvcmtkaXJlY3RvcnkgICAgLy8gd2UgbmVlZCB0aGlzIHZhcmlhYmxlIHNldHVwIGV2ZW4gaWYgd2UgZG8gbm90IGNvbm5lY3QgdG8gYSB0ZWFjaGVyIGluc3RhbmNlXG5cblxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIENoZWNrIGlmIHRoZSBkZXNrdG9wIGZvbGRlciBleGlzdHMgYW5kIGNyZWF0ZSBpZiBpdCBkb2Vzbid0XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGluayB0byB0aGUgd29ya2RpcmVjdG9yeSBvbiB0aGUgZGVza3RvcFxuY29uc3QgbGlua1BhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoLCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbiBAIGNyZWF0ZS1zeW1saW5rOiBjYW4ndCBjcmVhdGUgc3ltbGlua1wiKX1cblxuXG50cnkgeyAvL2JpbmQgdG8gdGhlIGNvcnJlY3QgaW50ZXJmYWNlXG4gICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlfSA9IGdhdGV3YXk0c3luYygpOyBcbiAgICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSkgICAgLy8gdGhpcyByZXR1cm5zIHRoZSBpcCBvZiB0aGUgaW50ZXJmYWNlIHRoYXQgaGFzIGEgZGVmYXVsdCBnYXRld2F5Li4gIHNob3VsZCB3b3JrIGluIE1PU1QgY2FzZXMuICBwcm9iYWJseSBwcm92aWRlIFwiaXAtb3B0aW9uc1wiIGluIFVJID9cbiAgICBjb25maWcuZ2F0ZXdheSA9IHRydWVcbn1cbiBjYXRjaCAoZSkge1xuICAgbG9nLmVycm9yKFwibWFpbiBAIGdhdGV3YXk0c3luYzogdW5hYmxlIHRvIGRldGVybWluZSBkZWZhdWx0IGdhdGV3YXlcIilcbiAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgXG4gICBsb2cuaW5mbyhgbWFpbjogSVAgJHtjb25maWcuaG9zdGlwfWApXG4gICBjb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gfVxuXG5cbmZzRXh0cmEuZW1wdHlEaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSAgLy8gY2xlYW4gdGVtcCBkaXJlY3RvcnlcblxuXG5cblxuXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbi8vIEZpbHRlciBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgYW5kIFdlYkNvbnRlbnRzIHN1YmZyYW1lIGVycm9ycyBmcm9tIHN0ZGVyci9zdGRvdXRcbmNvbnN0IG9yaWdpbmFsU3RkZXJyV3JpdGUgPSBwcm9jZXNzLnN0ZGVyci53cml0ZTtcbmNvbnN0IG9yaWdpbmFsU3Rkb3V0V3JpdGUgPSBwcm9jZXNzLnN0ZG91dC53cml0ZTtcblxucHJvY2Vzcy5zdGRlcnIud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRlcnJXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5zdGRvdXQud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRvdXRXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyKSA9PiB7XG4gICAgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG4gICAgICAgIGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZTtcbiAgICAgICAgbG9nLndhcm4oJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjogRVBJUEUgRXJyb3I6IFRoZSBzdGRvdXQgc3RyZWFtIG9mIHRoZSBFbGVjdHJvbkxvZ2dlciB3aWxsIGJlIGRpc2FibGVkLicpO1xuICAgIH0gXG4gICAgZWxzZSBpZiAoZXJyLm1lc3NhZ2U/LmluY2x1ZGVzKCdSZW5kZXIgZnJhbWUgd2FzIGRpc3Bvc2VkJykpIHJldHVybjtcbiAgICBlbHNlIHsgIGxvZy5lcnJvcignbWFpbiBAIHVuY2F1Z2h0RXhjZXB0aW9uOicsIGVyci5tZXNzYWdlKTsgfSAgLy8gTG9nIG9yIGRpc3BsYXkgb3RoZXIgZXJyb3JzXG59KTtcblxuLy8gSGFuZGxlIHVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbnMgdG8gcHJldmVudCBjcmFzaGVzXG5wcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAocmVhc29uLCBwcm9taXNlKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBVbmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb246JywgcmVhc29uKTtcbiAgICBpZiAocmVhc29uIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBTdGFjazonLCByZWFzb24uc3RhY2spO1xuICAgIH1cbn0pO1xuXG4vLyBIYW5kbGUgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG5hcHAub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkJyk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGlkZW50aWZ5IHdoaWNoIHdpbmRvdyBjcmFzaGVkXG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgIFxuICAgIGlmIChjcmFzaGVkV2luZG93KSB7XG4gICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBGb3IgZXhhbSB3aW5kb3cgY3Jhc2hlcywgdHJ5IHRvIGNsb3NlIGl0IGdyYWNlZnVsbHlcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzIC0gbGV0IGl0IGNvbnRpbnVlXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBIYW5kbGUgY2hpbGQgcHJvY2VzcyBjcmFzaGVzICh3b3JrZXJzLCBldGMuKVxuYXBwLm9uKCdjaGlsZC1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IENoaWxkIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogVHlwZTonLCBkZXRhaWxzLnR5cGUpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKX1cbi8vaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgIGFwcC5kb2NrLmhpZGUoKSB9ICAvLyB0aGlzIGJ1ZyBzdGF0ZXMgdGhhdCBpdCBraW5kYSBtZXNzZXMgdXAga2lvc2sgbW9kZSAtIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTgyMDdcblxuXG5cbi8vIGhpZGUgY2VydGlmaWNhdGUgd2FybmluZ3MgaW4gY29uc29sZS4uIHdlIGtub3cgd2UgdXNlIGEgc2VsZiBzaWduZWQgY2VydCBhbmQgZG8gbm90IHZhbGlkYXRlIGl0XG5wcm9jZXNzLmVudltcIk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRURcIl0gPSBcIjBcIjtcbnByb2Nlc3MuZW52Lk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQgPSBcIjBcIjtcbmNvbnN0IG9yaWdpbmFsRW1pdFdhcm5pbmcgPSBwcm9jZXNzLmVtaXRXYXJuaW5nXG5wcm9jZXNzLmVtaXRXYXJuaW5nID0gKHdhcm5pbmcsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAod2FybmluZyAmJiB3YXJuaW5nLmluY2x1ZGVzICYmIHdhcm5pbmcuaW5jbHVkZXMoJ05PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQnKSkgeyAgcmV0dXJuIH1cbiAgICByZXR1cm4gb3JpZ2luYWxFbWl0V2FybmluZy5jYWxsKHByb2Nlc3MsIHdhcm5pbmcsIG9wdGlvbnMpXG59XG5cbmFwcC5vbignY2VydGlmaWNhdGUtZXJyb3InLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCB1cmwsIGVycm9yLCBjZXJ0aWZpY2F0ZSwgY2FsbGJhY2spID0+IHsgLy8gU1NML1RMUzogdGhpcyBpcyB0aGUgc2VsZiBzaWduZWQgY2VydGlmaWNhdGUgc3VwcG9ydFxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIE9uIGNlcnRpZmljYXRlIGVycm9yIHdlIGRpc2FibGUgZGVmYXVsdCBiZWhhdmlvdXIgKHN0b3AgbG9hZGluZyB0aGUgcGFnZSlcbiAgICBjYWxsYmFjayh0cnVlKTsgIC8vIGFuZCB3ZSB0aGVuIHNheSBcIml0IGlzIGFsbCBmaW5lIC0gdHJ1ZVwiIHRvIHRoZSBjYWxsYmFja1xufSk7XG5cbi8vIEhhbmRsZSBXZWJDb250ZW50cyBsb2FkIGZhaWx1cmVzIHRvIHByZXZlbnQgYXBwIGNyYXNoZXNcbmFwcC5vbignd2ViLWNvbnRlbnRzLWNyZWF0ZWQnLCAoZXZlbnQsIHdlYkNvbnRlbnRzKSA9PiB7XG4gICAgY29uc3Qgc3VwcHJlc3NDb2RlcyA9IFstMywgLTEwMCwgLTEwMSwgLTEwNV07XG5cbiAgICAvLyBTdG9yZSBpZiB3ZSd2ZSBhbHJlYWR5IHNldCB1cCBsaXN0ZW5lcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGlmICh3ZWJDb250ZW50cy5fZXJyb3JTdXBwcmVzc2lvblNldHVwKSByZXR1cm47XG4gICAgd2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCA9IHRydWU7XG5cbiAgICAvLyBTZXQgdXAgbGlzdGVuZXJzIHRoYXQgcGVyc2lzdCBhY3Jvc3MgbmF2aWdhdGlvblxuICAgIGNvbnN0IHNldHVwRXJyb3JTdXBwcmVzc2lvbiA9ICgpID0+IHtcbiAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgZmlyc3QgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgICAgICB3ZWJDb250ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKTtcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1sb2FkJyk7XG4gICAgICAgIFxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcblxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU2V0IHVwIGltbWVkaWF0ZWx5XG4gICAgc2V0dXBFcnJvclN1cHByZXNzaW9uKCk7XG5cbiAgICAvLyBSZS1zZXR1cCBvbiBuYXZpZ2F0aW9uIHRvIGVuc3VyZSBsaXN0ZW5lcnMgcGVyc2lzdFxuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtc3RhcnQtbmF2aWdhdGlvbicsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgd2ViQ29udGVudHMub24oJ2RpZC1mcmFtZS1uYXZpZ2F0ZScsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgXG4gICAgLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyBmb3Igc3BlY2lmaWMgd2ViQ29udGVudHMgKFY4IGZhdGFsIGVycm9ycywgZXRjLilcbiAgICB3ZWJDb250ZW50cy5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChldmVudCwgZGV0YWlscykgPT4ge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZW5kZXJlciBwcm9jZXNzIGNyYXNoZWQgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzJyk7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgdGhpcyB3ZWJDb250ZW50cyBiZWxvbmdzIHRvXG4gICAgICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICAgICAgY29uc3QgY3Jhc2hlZFdpbmRvdyA9IGFsbFdpbmRvd3MuZmluZCh3aW4gPT4gd2luLndlYkNvbnRlbnRzLmlkID09PSB3ZWJDb250ZW50cy5pZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IHRpdGxlOiAke2NyYXNoZWRXaW5kb3cuZ2V0VGl0bGUoKX1gKTtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyBVUkw6ICR7Y3Jhc2hlZFdpbmRvdy53ZWJDb250ZW50cy5nZXRVUkwoKX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdyA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNyYXNoZWRXaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXJyb3IgY2xvc2luZyBleGFtIHdpbmRvdzonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xufSk7XG5cbmFwcC5vbignd2luZG93LWFsbC1jbG9zZWQnLCBhc3luYyAoKSA9PiB7ICAvLyBsYXN0IHdpbmRvdyBjbG9zZWQgXHUyMDEzIGNsZWFyIHN0b3JhZ2UgaGVyZSB0byBhdm9pZCBMaW51eCBzZWdmYXVsdCBpbiBiZWZvcmUtcXVpdFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLmNoZWNrV2luZG93SW50ZXJ2YWw/LnN0b3ApIFdpbmRvd0hhbmRsZXIuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICBpZiAoQ29tbUhhbmRsZXIudXBkYXRlU2NoZWR1bGVyPy5zdG9wKSBDb21tSGFuZGxlci51cGRhdGVTY2hlZHVsZXIuc3RvcCgpXG4gICAgaWYgKENvbW1IYW5kbGVyLnNjcmVlbnNob3RTY2hlZHVsZXI/LnN0b3ApIENvbW1IYW5kbGVyLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgaWYgKG11bHRpY2FzdENsaWVudC5yZWZyZXNoRXhhbXNTY2hlZHVsZXI/LnN0b3ApIG11bHRpY2FzdENsaWVudC5yZWZyZXNoRXhhbXNTY2hlZHVsZXIuc3RvcCgpXG4gICAgV2luZG93SGFuZGxlci5tYWlud2luZG93ID0gbnVsbFxuXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5jbGVhclN0b3JhZ2VEYXRhKHt9KTsgLy8gY2xlYXIgY29va2llcywgY2FjaGUsIGxvY2FsU3RvcmFnZSBldGMuIHdoaWxlIHNlc3Npb24gc3RpbGwgdmFsaWRcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2luZG93LWFsbC1jbG9zZWQ6IEVycm9yIGNsZWFyaW5nIHN0b3JhZ2U6JywgZXJyKTtcbiAgICB9XG4gICAgYXBwLnF1aXQoKTtcbn0pO1xuXG5hcHAub24oJ3dpbGwtcXVpdCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKGZhbHNlKVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpIH0gXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpIH1cbn0pXG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgYW5kIHF1aXQgaWYgZGV0ZWN0ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrUGFyZW50UHJvY2VzcygpO1xuICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudDonLCByZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdC5mb3VuZEJyb3dzZXIpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgY2hlY2tQYXJlbnQ6IFRoZSBhcHAgd2FzIHN0YXJ0ZWQgZGlyZWN0bHkgZnJvbSBhIGJyb3dzZXInKTtcbiAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveFN5bmMoV2luZG93SGFuZGxlci5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUZXJtaW5hdGUgUHJvZ3JhbScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VuZXJsYXVidGVyIFByb2dyYW1tc3RhcnQgYXVzIGVpbmVtIFdlYmJyb3dzZXIgZXJrYW5udC5cXG5OZXh0LUV4YW0gd2lyZCBiZWVuZGV0IScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlO1xuICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdtYWluIEAgY2hlY2twYXJlbnQ6IFBhcmVudCBQcm9jZXNzIENoZWNrIE9LJyk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudCBlcnJvcjonLCBlcnJvcik7XG4gICAgfVxufVxuXG5hcHAud2hlblJlYWR5KClcbi50aGVuKGFzeW5jICgpPT57XG5cbiAgICBuYXRpdmVUaGVtZS50aGVtZVNvdXJjZSA9ICdsaWdodCcgIC8vIHByZXZlbnQgdGhlbWUgc2V0dGluZ3MgZnJvbSBiZWluZyBhZG9wdGVkIGZyb20gd2luZG93c1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0VXNlckFnZW50KGBOZXh0LUV4YW0vJHtjb25maWcudmVyc2lvbn0gKCR7Y29uZmlnLmluZm99KSAke3Byb2Nlc3MucGxhdGZvcm19YCk7ICAvLyBzZXQgdXNlciBhZ2VudCBmb3IgYWxsIHNlc3Npb25zXG4gICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRDZXJ0aWZpY2F0ZVZlcmlmeVByb2MoKHJlcXVlc3QsIGNhbGxiYWNrKSA9PiB7IGNhbGxiYWNrKDApOyB9KTsgICAvLyBzZXQgY2VydGlmaWNhdGUgdmVyaWZpY2F0aW9uIGdsb2JhbGx5IGZvciBhbGwgc2Vzc2lvbnNcbiAgICBcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKHRydWUpO1xuICAgXG4gICAgLyoqKioqKiogQ3JlYXRlIG1haW4gd2luZG93ICoqKioqKiovXG4gICAgV2luZG93SGFuZGxlci5jcmVhdGVNYWluV2luZG93KClcblxuXG4gICAgaWYgKGNvbmZpZy5ob3N0aXAgPT0gXCIxMjcuMC4wLjFcIikgeyBjb25maWcuaG9zdGlwID0gZmFsc2UgfVxuICAgIGlmIChjb25maWcuaG9zdGlwKSB7IG11bHRpY2FzdENsaWVudC5pbml0KGNvbmZpZy5nYXRld2F5KSAgfSAvL211bHRpY2FzdCBjbGllbnQgb25seSB0cmFja3Mgb3RoZXIgZXhhbSBpbnN0YW5jZXMgb24gdGhlIG5ldHdvcmtcblxuICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGlkZXMgbGVnYWN5IHRyYXlcbiAgICBpZiAoIWNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgIHBvd2VyU2F2ZUJsb2NrZXIuc3RhcnQoJ3ByZXZlbnQtZGlzcGxheS1zbGVlcCcpICAgLy8gcHJldmVudCB0aGUgZGV2aWNlIGZyb20gZ29pbmcgdG8gc2xlZXBcbiAgICAgICAgaWYgKGFsbG93VHJheSkgeyB1cGRhdGVTeXN0ZW1UcmF5KCdkZScpOyB9ICAgICAgICAvLyBza2lwIHRyYXkgb24gR05PTUVcbiAgICAgICAgZWxzZSB7IGxvZy5pbmZvKCdtYWluIEAgdHJheTogR05PTUUgZGV0ZWN0ZWQsIHNraXBwaW5nIHN5c3RlbSB0cmF5Jyk7IH1cbiAgICAgICAgcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCk7ICAvLyB0aGlzIGNoZWNrcyBpZiB0aGUgYXBwIHdhcyBzdGFydGVkIGZyb20gd2l0aGluIGEgYnJvd3NlciAoZGlyZWN0bHkgYWZ0ZXIgZG93bmxvYWQpXG4gICAgfVxuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtHJywgKCkgPT4geyAgaWYgKGdsb2JhbCAmJiBnbG9iYWwuZ2MpeyBnbG9iYWwuZ2Moe3R5cGU6J21heW9yJyxleGVjdXRpb246ICdhc3luYyd9KTsgZ2xvYmFsLmdjKHt0eXBlOidtaW5vcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7ICB9fSk7XG4gICAgICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgfVxuXG4gICAgLy90aGVzZSBhcmUgc29tZSBzaG9ydGN1dHMgd2UgdHJ5IHRvIGNhcHR1cmVcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdGNScsICgpID0+IHt9KTsgIC8vcmVsb2FkIHBhZ2VcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrRjQnLCAoKSA9PiB7fSk7ICAvL2V4aXQgYXBwXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVycsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtRJywgKCkgPT4ge30pOyAgLy9xdWl0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrRCcsICgpID0+IHt9KTsgIC8vc2hvdyBkZXNrdG9wXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrTCcsICgpID0+IHt9KTsgIC8vbG9ja3NjcmVlblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1AnLCAoKSA9PiB7fSk7ICAvL2NoYW5nZSBzY3JlZW4gbGF5b3V0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcbn0pXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnOyAgLy8gbm9kZSBub3QgdnVlIChyZWxhdGl2ZSBwYXRoIG5lZWRlZClcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG4vKipcbiAqIFNUT1JFUyBBTEwgQ0xJRU5UL1NlcnZlciBJTkZPUk1BVElPTlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgbGlzdGVucyBmb3IgbXVsaXRjYXN0IG1lc3NhZ2VzXG4gKi9cblxuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSBjb25maWcubXVsdGljYXN0U2VydmVyQWRyclxuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMuY2xpZW50aW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IFwiRGVtb1VzZXJcIixcbiAgICAgICAgICAgIHRva2VuOiBmYWxzZSxcbiAgICAgICAgICAgIGlwOiBmYWxzZSwgIC8vIGlwIGFkZHJlc3Mgd2lyZCB2b20gbXVsdGljYXN0c2VydmVyIHRlYWNoZXIgbWl0IGdlc2NoaWNrdFxuICAgICAgICAgICAgaG9zdG5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2VydmVyaXA6IGZhbHNlLCAgIC8vIHdpcmQgbG9rYWwgZ2VzZXR6dCAoaXN0IGFiZXIgbG9naXNjaGVyd2Vpc2UgZ2xlaWNoIGRlciBpcCBkZXMgbXVsdGljYXN0c2VydmVycylcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IGZhbHNlLFxuICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgICAgICBleGFtdHlwZSA6IGZhbHNlLFxuICAgICAgICAgICAgcGluOiBmYWxzZSxcbiAgICAgICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICAgICAgbXNvZmZpY2VzaGFyZTogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDQwMDAsICAgLy9taWxsaXNlY29uZHNcbiAgICAgICAgICAgIHByaW50cmVxdWVzdCA6IGZhbHNlLFxuICAgICAgICAgICAgcHJpdmF0ZVNwZWxsY2hlY2s6IHthY3RpdmF0ZWQ6IGZhbHNlfSxcbiAgICAgICAgICAgIGxvY2FsTG9ja2Rvd246IGZhbHNlLFxuICAgICAgICAgICAgZ3JvdXA6ICdhJyxcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IDBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBhbmQgcmVhY3RzIG9uIGluZm9ybWF0aW9uIGdpdmVuIGJ5IHRoZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKSAgLy8gbW92aW5nIHRoaXMgaGVyZSB3aWxsIGFsbG93IHRvIHJlc3Bhd24gaXQgaWYgYmluZGluZyBmYWlsc1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5iaW5kKHRoaXMuUE9SVCwgJzAuMC4wLjAnLCAgKCkgPT4geyBcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRNdWx0aWNhc3RUVEwoMTI4KTsgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2F0ZXdheSkge3RoaXMuY2xpZW50LmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUil9IC8vIGVzIGlzdCBmXHUwMEZDciBlaW4gdmVybFx1MDBFNHNzbGljaGVzIG11bHRpY2FzdCBzaW5udm9sbCBkZXIgZ3J1cHBlIGJlaXp1dHJldGVuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm1jY2xpZW50OiBObyBHYXRld2F5ISBTdGFydGluZyBNdWx0aWNhc3RDbGllbnQgd2l0aG91dCBhZGRpbmcgZ3JvdXAgbWVtYmVyc2hpcFwiKX1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLmNsaWVudC5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7IFxuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWxpdGNhc3RjbGllbnQgQCBpbml0OiAke2V9YCkgXG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcbiBcbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgXG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnJlYWNoYWJsZSA9IHRydWVcbiAgICAgICAgc2VydmVySW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vcmVjb3JkIHRpbWVzdGFtcCBvZiBsYXN0IG1lc3NhZ2UgZnJvbSBzZXJ2ZXIgKGlnbm9yZSBzZXJ2ZXJ0aW1lc3RhbXAgYmVjYXVzZSBpdCBtYXkgaGF2ZSBhIGRpZmZlcmVudCBzeXN0ZW0gdGltZSlcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmlzTmV3RXhhbUluc3RhbmNlKHNlcnZlckluZm8pKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgbWVzc2FnZVJlY2VpdmVkOiBBZGRpbmcgbmV3IEV4YW0gSW5zdGFuY2UgXCIke3NlcnZlckluZm8uc2VydmVybmFtZX1cIiB0byBTZXJ2ZXJsaXN0YClcbiAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QucHVzaChzZXJ2ZXJJbmZvKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHRoZSBtZXNzYWdlIGNhbWUgZnJvbSBhIG5ldyBleGFtIGluc3RhbmNlIG9yIGFuIG9sZCBvbmUgdGhhdCBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBpc05ld0V4YW1JbnN0YW5jZSAob2JqKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbVNlcnZlckxpc3RbaV0uaWQgPT09IG9iai5pZCkge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oJ2V4aXN0aW5nIHNlcnZlciAtIHVwZGF0aW5nIHRpbWVzdGFtcCcpXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG5cbiAgICAgICAgICAgIGlmIChub3cgLSAxNjAwMCA+IHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYG11bHRpY2FzdGNsaWVudCBAIGlzRGVwcmVjYXRlZEluc3RhbmNlOiBSZW1vdmluZyBpbmFjdGl2ZSBzZXJ2ZXIgJyR7dGhpcy5leGFtU2VydmVyTGlzdFtpXS5zZXJ2ZXJuYW1lfScgZnJvbSBsaXN0YClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnNwbGljZShpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVsdGljYXN0Q2xpZW50KClcbiIsICJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuXG5leHBvcnQgY2xhc3MgU2NoZWR1bGVyU2VydmljZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICBhY3Rpb246ICgpID0+IHZvaWQ7XG4gICAgaGFuZGxlOiBOb2RlSlMuVGltZXI7XG4gICAgaW50ZXJ2YWw6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFjdGlvbjogKCkgPT4gdm9pZCwgbXM6IG51bWJlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBtcztcbiAgICAgICAgdGhpcy5hZGRMaXN0ZW5lcigndGltZW91dCcsIHRoaXMuYWN0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5lbWl0KCd0aW1lb3V0JyksIHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQnJvd3NlclZpZXcsIGRpYWxvZywgc2NyZWVufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCB7IGFjdGl2ZVdpbmRvdyB9IGZyb20gJ2dldC13aW5kb3dzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tIFwibm9kZTp1cmxcIjtcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vLyBSZW5kZXJlciBidWlsdCBpbnRvIHB1YmxpYy8gKG9uZSBjb3B5KTsgd2hlbiBwYWNrYWdlZCB1c2UgYXBwLmFzYXIudW5wYWNrZWQvcHVibGljXG5mdW5jdGlvbiBnZXRSZW5kZXJlckluZGV4UGF0aCgpIHtcbiAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgY29uc3QgdW5wYWNrZWQgPSBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmModW5wYWNrZWQpKSByZXR1cm4gdW5wYWNrZWQ7XG4gIH1cbiAgY29uc3QgcHVibGljUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAncHVibGljJywgJ2luZGV4Lmh0bWwnKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMocHVibGljUGF0aCkpIHJldHVybiBwdWJsaWNQYXRoO1xuICBjb25zdCBkaXN0UmVuZGVyZXJQYXRoID0gam9pbihfX2Rpcm5hbWUsICdkaXN0JywgJ3JlbmRlcmVyJywgJ2luZGV4Lmh0bWwnKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMoZGlzdFJlbmRlcmVyUGF0aCkpIHJldHVybiBkaXN0UmVuZGVyZXJQYXRoO1xuICBjb25zdCBxdWFzYXJQYXRoID0gam9pbihfX2Rpcm5hbWUsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHF1YXNhclBhdGgpKSByZXR1cm4gcXVhc2FyUGF0aDtcbiAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vcmVuZGVyZXIvaW5kZXguaHRtbCcpO1xufVxuXG5cblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIFdpbmRvdyBoYW5kbGluZyAoaXBjUmVuZGVyZXIgUHJvY2VzcyAtIEZyb250ZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2tXaW5kb3cgPSBudWxsXG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNlcnZlZCBkaXNwbGF5IElEIGZvciBleGFtIHdpbmRvdyAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gd2luZG93IGlzIGNyZWF0ZWQpXG4gICAgICB0aGlzLnNwbGFzaHdpbiA9IG51bGxcbiAgICAgIHRoaXMuYmlwd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICBcbiAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgcXVlc3Rpb24gZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBtaW5pbWl6ZSB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMud2luZG93VHJhY2tlci5iaW5kKHRoaXMpLCAxMDAwKVxuICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gZWxlY3Ryb24gd2luZG93IGluIGZvY3VzIG9yIGFuIG90aGVyIGVsZWN0cm9uIHdpbmRvdyBkZXBlbmRpbmcgb24gdGhlIGhpZXJhY2h5XG4gICAgZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgICAgICAgaWYgKGZvY3VzZWRXaW5kb3cpIHtcbiAgICAgICAgICByZXR1cm4gZm9jdXNlZFdpbmRvd1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVubG9ja1dpbmRvdyl7cmV0dXJuIHRoaXMuc2NyZWVubG9ja1dpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZXhhbXdpbmRvdyl7cmV0dXJuIHRoaXMuZXhhbXdpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubWFpbndpbmRvdyl7cmV0dXJuIHRoaXMubWFpbndpbmRvd31cbiAgICAgICAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiAxMDAwLFxuICAgICAgICAgICAgaGVpZ2h0OjgwMCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgLy8gcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAvLyB0cmFuc3BhcmVudDogdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaWYgKGJpcHRlc3QpeyAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vcS5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cbiAgICAgICAgZWxzZSB7ICAgICAgICAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vd3d3LmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5iaXB3aW5kb3cgJiYgIXRoaXMuYmlwd2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IGRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogd2lsbC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7ICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBuZXctd2luZG93XCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG4gICAgIFxuICAgICAgICAgXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogdGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IFJlZGlyZWN0aW5nIHRvOicsIHVybCk7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgZGllIFVSTCBkYXMgZ2V3XHUwMEZDbnNjaHRlIEZvcm1hdCBoYXRcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnYmlsZHVuZ3Nwb3J0YWw6Ly8nKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcnQgZGVuIFN0YW5kYXJkLVJlZGlyZWN0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gJ2JpbGR1bmdzcG9ydGFsOi8vdG9rZW49JztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdXJsLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBDYXB0dXJlZCBUb2tlbjonKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiAnICsgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiaXBUb2tlbicsIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiB0aGlzIGlzIGFuIGVhc3RlciBlZ2dcbiAgICAgKi9cbiAgICBjcmVhdGVFYXN0ZXJXaW4oKSB7XG4gICAgICAgIHRoaXMuZWFzdGVyd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiA3NjgsXG4gICAgICAgICAgICBoZWlnaHQ6NDgwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IHRydWUsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ubG9hZEZpbGUoam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2Nvd3NvbmljZScsICdpbmRleC5odG1sJykpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVhc3RlcndpbiAmJiAhdGhpcy5lYXN0ZXJ3aW4uaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3Rlcndpbi5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEJsb2NrV2luZG93ICh0byBjb3ZlciBhZGRpdGlvbmFsIHNjcmVlbnMpXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgbmV3QmxvY2tXaW4oZGlzcGxheSkge1xuICAgICAgICBsZXQgYmxvY2t3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgcGFyZW50OiB0aGlzLmV4YW13aW5kb3csXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIGZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgICAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgbGV0IHVybCA9IFwibm90Zm91bmRcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJsb2Nrd2luLnJlbW92ZU1lbnUoKSBcbiAgICAgICAgYmxvY2t3aW4uc2V0TWluaW1pemFibGUoZmFsc2UpXG5cbiAgICAgICAgLy8gUG9zaXRpb24gd2luZG93IG9uIHNwZWNpZmljIGRpc3BsYXkgQkVGT1JFIHNob3dpbmcgaXRcbiAgICAgICAgYmxvY2t3aW4uc2V0Qm91bmRzKHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLngsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55LFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYmxvY2t3aW4uc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgIGJsb2Nrd2luLnNob3coKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTtcbiAgICAgICAgICAgIGJsb2Nrd2luLm9uKCdsZWF2ZS1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpOyAvLyBzb2ZvcnQgd2llZGVyIHp1clx1MDBGQ2Nrc2V0emVuXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgIH0gIFxuICAgICAgICBlbHNlIHsgICBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEtpb3NrKHRydWUpOyAvLyBLaW9zayA9IFwidGFrZSBvdmVyIG1haW4gc2NyZWVuXCIuIG9uIG1hY29zIHRoYXQncyB3aHkgd2UgdXNlIGZ1bGxTY3JlZW4gd29ya2Fyb3VuZCB3aXRoIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIH1cbiAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICBibG9ja3dpbi5kaXNwbGF5ID0gZGlzcGxheVxuICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5wdXNoKGJsb2Nrd2luKVxuICAgIH1cblxuXG4gICAgLy8gYmxvY2sgYWxsIHNjcmVlbnMgd2l0aCBhIGJsb2Nrd2luZG93XG4gICAgYXN5bmMgaW5pdEJsb2NrV2luZG93cygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAvL2xvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZm91bmQgJHtkaXNwbGF5cy5sZW5ndGh9IGRpc3BsYXlzYClcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgIC8vIGxvY2sgYWxsIHNjcmVlbnNcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGV4YW0gd2luZG93IHRvIGJlIHZpc2libGUgYW5kIHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0cmllcyA9IDBcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTBcbiAgICAgICAgICAgICAgICB3aGlsZSAoIXRoaXMuZXhhbXdpbmRvdy5pc1Zpc2libGUoKSAmJiByZXRyaWVzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMClcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllcysrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFkZGl0aW9uYWwgd2FpdCB0byBlbnN1cmUgcG9zaXRpb25pbmcgaXMgY29tcGxldGUgb24gV2F5bGFuZFxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgYmxvY2sgd2luZG93cyBmcm9tIGFycmF5XG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IHRoaXMuYmxvY2t3aW5kb3dzLmZpbHRlcihibG9ja3dpbiA9PiBibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGFsbCBleGlzdGluZyB3aW5kb3dzIGFuZCBkZXRlcm1pbmUgdGhlaXIgZGlzcGxheXNcbiAgICAgICAgICAgIGNvbnN0IHVzZWREaXNwbGF5SWRzID0gbmV3IFNldCgpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpcnN0LCB1c2UgdGhlIHJlc2VydmVkIGV4YW0gZGlzcGxheSBJRCAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gZXhhbSB3aW5kb3cgd2FzIGNyZWF0ZWQpXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIHNjcmVlbiBpcyByZXNlcnZlZCBldmVuIGlmIHRoZSB3aW5kb3cgaXNuJ3QgZnVsbHkgaW5pdGlhbGl6ZWQgeWV0XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtRGlzcGxheUlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHRoaXMuZXhhbURpc3BsYXlJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWx3YXlzIGV4Y2x1ZGUgcHJpbWFyeSBkaXNwbGF5IChleGFtIHdpbmRvdyBsb2NhdGlvbilcbiAgICAgICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmIChwcmltYXJ5RGlzcGxheSAmJiBwcmltYXJ5RGlzcGxheS5pZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChwcmltYXJ5RGlzcGxheS5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgZXhhbSB3aW5kb3cgZGlzcGxheSAoYXMgZmFsbGJhY2svdmVyaWZpY2F0aW9uLCBidXQgcmVzZXJ2ZWQgSUQgdGFrZXMgcHJpb3JpdHkpXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGV4YW0gd2luZG93IGlzIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgZXhhbSB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGJsb2NrIHdpbmRvd3MgZGlzcGxheXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmxvY2t3aW4gb2YgdGhpcy5ibG9ja3dpbmRvd3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBibG9ja3dpbi5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGJsb2NrIHdpbmRvdyBmb3VuZCBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGJsb2NrIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIGJsb2NrIHdpbmRvd3MgZm9yIGRpc3BsYXlzIHRoYXQgZG9uJ3QgaGF2ZSBleGFtIG9yIGJsb2NrIHdpbmRvd3NcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIGlmICh1c2VkRGlzcGxheUlkcy5oYXMoZGlzcGxheS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBza2lwcGluZyBkaXNwbGF5ICR7ZGlzcGxheS5pZH0gLSBhbHJlYWR5IGhhcyBleGFtIG9yIGJsb2NrIHdpbmRvd2ApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGNyZWF0ZSBibG9ja3dpbiBvbjpcIixkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgIHRoaXMubmV3QmxvY2tXaW4oZGlzcGxheSkgIC8vIGFkZCBibG9ja3dpbmRvd3MgZm9yIGRpc3BsYXlzIHdpdGhvdXQgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MuZm9yRWFjaCggKGJsb2Nrd2luKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU2NyZWVubG9jayBXaW5kb3cgKHRvIGNvdmVyIHRoZSBtYWluc2NyZWVuKSAtIGJsb2NrIHN0dWRlbnRzIGZyb20gd29ya2luZ1xuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIGNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkge1xuICAgICAgICBsZXQgc2NyZWVubG9ja1dpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogdGhpcy5tYWlud2luZG93LCAgIC8vIGxlYWRzIHRvIHZpc2libGUgdGl0bGViYXIgaW4gZ25vbWUtZGVza3RvcFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnU2NyZWVubG9jaycsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgLy9mb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCB1cmwgPSBcImxvY2tcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZEZpbGUoZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgLy8gQWRkIHdpbmRvdyB0byBhcnJheSBmaXJzdCwgYmVmb3JlIGFkZGluZyBibHVyIGxpc3RlbmVyXG4gICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MucHVzaChzY3JlZW5sb2NrV2luZG93KVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICghc2NyZWVubG9ja1dpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnJlbW92ZU1lbnUoKSBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0TWluaW1pemFibGUoZmFsc2UpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwicG9wLXVwLW1lbnVcIiwgMSkgICAvL2Fib3ZlIGV4YW0gd2luZG93IChwb3AtdXAtbWVudSwgMClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2hvdygpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0Q2xvc2FibGUodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlKTsgLy8gcHV0IHRoZSB3aW5kb3cgb24gYWxsIHZpcnR1YWwgd29ya3NwYWNlc1xuICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoXCJzY3JlZW5sb2NrXCIpXG4gICAgICAgIH0pXG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0gIFxuICAgICAgICB9KTtcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZWQnLCAoKSA9PiB7ICAgLy8gcmVtb3ZlIHdpbmRvdyBmcm9tIGFycmF5IHdoZW4gYWN0dWFsbHkgY2xvc2VkXG4gICAgICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiB3aW4gIT09IHNjcmVlbmxvY2tXaW5kb3cgJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRXhhbXdpbmRvd1xuICAgICAqIEBwYXJhbSBleGFtdHlwZSBlZHV2aWR1YWwsIG1hdGgsIGxhbmd1YWdlXG4gICAgICogQHBhcmFtIHRva2VuIHN0dWRlbnQgdG9rZW5cbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIHRoZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0IGNvbnRhaW5pbmcgaW5mbyBhYm91dCBzcGVsbGNoZWNrIGxhbmd1YWdlIGV0Yy4gXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlRXhhbVdpbmRvdyhleGFtdHlwZSwgdG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeWRpc3BsYXkpIHtcbiAgICAgICAgLy8ganVzdCB0byBiZSBzdXJlIHdlIGNoZWNrIHNvbWUgaW1wb3J0YW50IHZhcnMgaGVyZVxuICAgICAgICBpZiAoZXhhbXR5cGUgIT09IFwicmRwXCIgJiYgZXhhbXR5cGUgIT09IFwid2Vic2l0ZVwiICYmICBleGFtdHlwZSAhPT0gXCJnZm9ybXNcIiAmJiBleGFtdHlwZSAhPT0gXCJlZHV2aWR1YWxcIiAmJiBleGFtdHlwZSAhPT0gXCJlZGl0b3JcIiAmJiBleGFtdHlwZSAhPT0gXCJtYXRoXCIgJiYgZXhhbXR5cGUgIT09IFwibWljcm9zb2Z0MzY1XCIgJiYgZXhhbXR5cGUgIT09IFwiYWN0aXZlc2hlZXRzXCIgfHwgIXRva2VuKXsgIC8vIGZvciBub3cuLiB3ZSBwcm9iYWJseSBzaG91bGQgc3RvcCBldmVyeXRoaW5nIGhlcmVcbiAgICAgICAgICAgIGxvZy53YXJuKFwibWlzc2luZyBwYXJhbWV0ZXJzIGZvciBleGFtLW1vZGUgb3IgbW9kZSBub3QgaW4gYWxsb3dlZCBsaXN0IVwiKVxuICAgICAgICAgICAgZXhhbXR5cGUgPSBcImVkaXRvclwiIFxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgLy8gQWx3YXlzIHVzZSBwcmltYXJ5IGRpc3BsYXkgZm9yIGV4YW0gd2luZG93XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcyB8fCAhcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IGRpc3BsYXlzWzBdIHx8IHByaW1hcnlkaXNwbGF5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEltbWVkaWF0ZWx5IHJlc2VydmUgdGhlIGRpc3BsYXkgSUQgZm9yIHRoZSBleGFtIHdpbmRvdyAoYmVmb3JlIHdpbmRvdyBpcyBmdWxseSBpbml0aWFsaXplZClcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBibG9jayB3aW5kb3dzIGZyb20gYmVpbmcgY3JlYXRlZCBvbiB0aGUgc2FtZSBzY3JlZW5cbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBwcmltYXJ5ZGlzcGxheS5pZFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiByZXNlcnZpbmcgZGlzcGxheSAke3RoaXMuZXhhbURpc3BsYXlJZH0gZm9yIGV4YW0gd2luZG93YClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHB4ID0gMFxuICAgICAgICBsZXQgcHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzLngpIHtcbiAgICAgICAgICAgIHB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnhcbiAgICAgICAgICAgIHB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IHB4ICsgMCxcbiAgICAgICAgICAgIHk6IHB5ICsgMCxcbiAgICAgICAgICAgIHRpdGxlOiAnRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogMTQ0MCxcbiAgICAgICAgICAgIGhlaWdodDogNzY4LFxuICAgICAgICAgICAgLy8gcGFyZW50OiB3aW4sICAvL3RoaXMgZG9lc250IHdvcmsgdG9nZXRoZXIgd2l0aCBraW9zayBvbiB1YnVudHUgZ25vbWUgPz8gd3RmXG4gICAgICAgICAgICAvLyBtb2RhbDogdHJ1ZSwgIC8vIHRoaXMgYmxvY2tzIHRoZSBtYWluIHdpbmRvdyBvbiB3aW5kb3dzIHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBvcGVuXG4gICAgICAgICAgICAvLyBjbG9zYWJsZTogZmFsc2UsICAvLyBpZiB3ZSBjYW4ndCBkZWZpbmUgJ3BhcmVudCcgdGhpcyB3aW5kb3cgaGFzIHRvIGJlIGNsb3NhYmxlIC0gd2h5P1xuICAgICAgICAgICAgLy9hbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIGtpb3NrOiB0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWUsXG4gICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5leGFtd2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlTWVudSgpICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBwcm9iYWJseSBub3QgbmVlZGVkIGJlY2F1c2Ugd2UgZGlzYWJsZSBtaXNzaW9uY29udHJvbCBhbnl3YXlzIC0gc2VlbXMgdG8gaW50ZXJmZXJlIHdpdGgga2lvc2sgbW9kZSBvbiBtYWNvcyAoYWdhaW4pXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMuZXhhbXdpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUsIHsgdmlzaWJsZU9uRnVsbFNjcmVlbjogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNXYXlsYW5kKXsgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0YXJ0KCkgfSAvLyBjb25zdGFudGx5IGNoZWNrIGlmIHRoZSBhY3RpdmUgd2luZG93IGlzIHRoZSBleGFtd2luZG93IC0gaWYgbm90LCBicmluZyBpdCB0byBmcm9udFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVSZXN0cmljdGlvbnModGhpcykgIC8vIGRpc2FibGUga2V5Ym9hcmQgc2hvcnRjdXRzIGV0Yy5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgIC8vIGRvIG5vdCBzZXQgYmx1ciBsaXN0ZW5lciB0b28gZWFybHlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoKSAgLy8gYWRkIGJsdXIgbGlzdGVuZXIgdG8gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBkaWQtZmluaXNoLWxvYWQ6IGVycm9yIGluIGV4YW13aW5kb3cgc2V0dXBcIiwgZSl9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzID0gc2VydmVyc3RhdHVzIC8vd2Uga2VlcCBpdCB0aGVyZSB0byBtYWtlIGl0IGFjY2Vzc2FibGUgdmlhIGV4YW13aW5kb3cgaW4gaXBjSGFuZGxlclxuICAgICAgICB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCA9IDk0ICAgLy8gc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBjb250ZW50IHZpZXdcbiAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1pY3Jvc29mdCAzNjUgZW1lYmVkcyBpdHMgZWRpdG9yIGluIGFuIGlmcmFtZSB3aXRoIGFjdGl2ZSBDb250ZW50IFNlY3VyaXR5IFBvbGljeSAoQ1NQKVxuICAgICAgICAgKiBUaGUgb25seSB3YXkgdG8gYmUgYWJsZSB0byBpbmplY3QgY29kZSBpcyB0byBsb2FkIGl0IGRpcmVjdGx5IGluIHRoZSBtYWluIHdpbmRvdyA8ZW1iZWQ+IDxpZnJhbWU+IG9yIGV2ZW4gPHdlYnZpZXc+IG9mZmVycyBubyB3b3JrYXJvdW5kXG4gICAgICAgICAqIHRoZXJlZm9yZSB3ZSB1c2UgXCJCcm93c2VyVmlld1wiIGluIG9yZGVyIHRvIGRpc3BsYXkgdHdvIHBhZ2VzIGluIG9uZSB3aW5kb3c6IG9uIHRvcCA+IGV4YW0gaGVhZGVyLCBvbiBib3R0b20gPiBvZmZpY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaWYgKGV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiICApIHsgLy9leHRlcm5hbCBwYWdlXG4gICAgICAgICAgICBsb2cuaW5mbyhcInN0YXJ0aW5nIG1pY3Jvc29mdDM2NSBleGFtLi4uXCIpXG4gICAgICAgICAgICBsZXQgdXJsdmlldyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSAgIFxuICAgICAgICAgICAgaWYgKCF1cmx2aWV3KSB7Ly8gd2Ugd2FpdCBmb3IgdGhlIG5leHQgdXBkYXRlIHRpY2sgLSBtc29mZmljZXNoYXJlIG5lZWRzIHRvIGJlIHNldCAhIChjb3VsZCBoYXBwZW4gd2hlbiBhIHN0dWRlbnQgY29ubmVjdHMgbGF0ZXIgdGhlbiBleGFtIG1vZGUgaXMgc2V0IGJ1dCBoaXMgc2hhcmUgdXJsIG5lZWRzIHNvbWUgdGltZSlcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiBubyB1cmwgZm9yIG1pY3Jvc29mdDM2NSB3YXMgc2V0IHlldCAtIHdhaXRpbmcgZm9yIG5leHQgdXBkYXRlIHRpY2tcIilcbiAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGRlc3Ryb3llZFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsb2FkIHRvcCBtZW51IGluIE1haW5QYWdlXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCBlZHV2aWR1YWwgfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgYmFja2dyb3VuZHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTChiYWNrZ3JvdW5kdXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlZmluZSB0aGUgTWFpbkNvbnRlbnRQYWdlIHZpZXdcbiAgICAgICAgICAgIGxldCBjb250ZW50VmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLCAgXG4gICAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEF1dG9SZXNpemUoeyB3aWR0aDogdHJ1ZSwgaGVpZ2h0OiB0cnVlLCBob3Jpem9udGFsOiB0cnVlLCB2ZXJ0aWNhbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsdmlldyk7XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7ICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpIH1cblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdlbnRlci1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdyZXNpemUnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSBub3JtYWwgZXhhbSBtb2RlIChlZGl0b3IsIG1hdGgsIGVkdXZpZHVhbCwgd2Vic2l0ZSwgZ2Zvcm1zKVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUoZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZSBzcGVjaWFsIE5BVklHQVRJT04gc2l0dWF0aW9uc1xuICAgICAgICAgKi9cblxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIEZvcm1zLCBXZWJzaXRlLCBFZHV2aWR1YWwsIEVkaXRvciwgUkRQLCBNaWNyb3NvZnQzNjVcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgLy8gQmxvY2sgbmF2aWdhdGlvbiBvbiBleGFtd2luZG93LndlYkNvbnRlbnRzIGxldmVsIGZvciBhbGwgbW9kZXMgdGhhdCBjYW4gZGlzcGxheSBQREZzIGluIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBuYXZpZ2F0aW9uIHdoZW4gY2xpY2tpbmcgbGlua3MgaW4gUERGcyBkaXNwbGF5ZWQgaW4gdGhlIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gV2Vidmlldy9Ccm93c2VyVmlldyBibG9ja2luZyBpcyBoYW5kbGVkIHNlcGFyYXRlbHkgdmlhIElQQyBpbiBpcGNoYW5kbGVyLmpzIG9yIG1vZGUtc3BlY2lmaWMgaGFuZGxlcnMgYmVsb3dcbiAgICAgICAgY29uc3QgZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyID0gW1wiZ2Zvcm1zXCIsIFwid2Vic2l0ZVwiLCBcImVkdXZpZHVhbFwiLCBcImVkaXRvclwiLCBcInJkcFwiLCBcIm1pY3Jvc29mdDM2NVwiLCBcImFjdGl2ZXNoZWV0c1wiLCBcIm1hdGhcIl07XG4gICAgICAgIGlmIChleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIuaW5jbHVkZXMoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIFZ1ZSBhcHAgKGUuZy4gZnJvbSBQREYgbGlua3MgaW4gZXhhbWhlYWRlcilcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IG5ldyB3aW5kb3dzIGZyb20gb3BlbmluZyBpbiB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBuZXctd2luZG93XCIsIHVybCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICBcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIHNldFdpbmRvd09wZW5IYW5kbGVyXCIsIHVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgTWljcm9zb2Z0IEV4Y2VsL1dvcmRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIil7ICAvLyBkbyBub3QgdW5kZXIgYW55IGNpcmN1bXN0YW5jZXMgYWxsb3cgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGN1cnJlbnQgZXhhbSB1cmxcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YW50cyB0byBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyBwYWdlXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImRvIG5vdCBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyB0ZXN0Li4gXCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICBcbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRlQ29kZSA9ICBgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGxvY2soKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICdXQUNEaWFsb2dPdXRlckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ0lubmVyQ29udGFpbmVyJywnV0FDRGlhbG9nUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGlkZXVzQnlJRCA9IFsnU2hvd0hpZGVFcXVhdGlvblRvb2xzUGFuZScsJ0xpbmtHcm91cCcsJ0dyYXBoaWNzRWRpdG9yJywnSW5zZXJ0VGFibGVPZkNvbnRlbnRzSW5JbnNlcnRUYWInLCdJbnNlcnRPbmxpbmV2aWRlbycsJ1BpY3R1cmUnLCdSaWJib24tUGljdHVyZU1lbnVNTFJEcm9wZG93bicsJ0luc2VydEFkZEluRmx5b3V0JywnRGVzaWduZXInLCdFZGl0b3InLCdGYXJQYW5lJywnSGVscCcsJ0luc2VydEFwcHNGb3JPZmZpY2UnLCdGaWxlTWVudUxhdW5jaGVyQ29udGFpbmVyJywnSGVscC13cmFwcGVyJywnUmV2aWV3LXdyYXBwZXInLCdIZWFkZXInLCdGYXJQZXJpcGhlcmFsQ29udHJvbHNDb250YWluZXInLCdCdXNpbmVzc0JhciddXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGVudHJ5IG9mIGhpZGV1c0J5SUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudHJ5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImRpc3BsYXlcIiwgXCJub25lXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJ1dHRvbkFwcHNPdmVyZmxvdyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdBZGQtSW5zJylbMF07ICAvLyB0aGlzIGJ1dHRvbiBpcyByZWRyYXduIG9uIHJlc2l6ZSAoZG9lc24ndCBoYXBwZW4gaW4gZXhhbSBtb2RlIGJ1dCBzdGlsbCB0aGVyZSBtdXN0IGJlIGEgY2xlYW5lciB3YXkgLSBpbnNlcnRpbmcgY3NzIGJlZm9yZSBpdCBhcHBlYXJzIGlzIG5vdCB3b3JraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1dHRvbkFwcHNPdmVyZmxvdyl7IGJ1dHRvbkFwcHNPdmVyZmxvdy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlN1Y2hlblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlx1MDBEQ2JlcnNldHplblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkNvcGlsb3RcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQWRkLUluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBDb250ZXh0TWVudVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwU3lub255bXNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUmliYm9uLVJlZmVyZW5jZXNTbWFydExvb2tVcFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkRpY3RhdGlvblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiR2V0QWRkaW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJQaWN0dXJlc19NTFJcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2NrKCkgIC8vZm9yIHNvbWUgcmVhc29uIGV4Y2VsIGRlbGF5cyB0aGF0IGNhbGwuLiBkb2VzbnQgaGFwcGVuIG9uIHBhZ2UgZmluaXNoIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgYFxuXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGVySW5zdGFuY2UgPSBudWxsXG4gICAgICAgICAgICB0aGlzLmxvY2tDYWxsYmFjayA9ICgpID0+IHRoaXMubG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKTsgXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZSA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMubG9ja0NhbGxiYWNrLCA0MDApXG4gICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBzY2hlZHVsZXJJbnN0YW5jZVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RhcnQoKVxuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgd2ViQ29udGVudHMgaXMgZnVsbHkgbG9hZGVkICAvLyB0aGlzIGlzIG5vdCB3b3JraW5nIHJlbGlhYmx5IGJlY2F1c2UgdGhlIHBhZ2UgaXMgbG9hZGVkIGluIG1hbnkgc3RlcHMgYW5kIHRoZSB1aSBlbGVtZW50cyBhcmUgbm90IGF2YWlsYWJsZSB5ZXRcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignYXBwLWNvbW1hbmQnLCAoZSwgY21kKSA9PiB7XG4gICAgICAgICAgICAvLyAnYnJvd3Nlci1iYWNrd2FyZCcgdW5kICdicm93c2VyLWZvcndhcmQnIHNpbmQgZGllIEJlZmVobGUsIGRpZSBiZWltIEtsaWNrIGF1ZiBkaWUgTWF1c3Rhc3RlbiBnZXNlbmRldCB3ZXJkZW5cbiAgICAgICAgICAgIGlmIChjbWQgPT09ICdicm93c2VyLWJhY2t3YXJkJyB8fCBjbWQgPT09ICdicm93c2VyLWZvcndhcmQnKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJubyBuYXZpZ2F0aW9uIGFsbG93ZWRcIilcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcm4gU2llIGRhcyBTdGFuZGFyZHZlcmhhbHRlblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIC8vZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpICAvL2RvIG5vdCBkaXNhYmxlIHR3aWNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBsb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2Upe1xuICAgICAgICBpZiAoYnJvd3NlclZpZXcud2ViQ29udGVudHMgJiYgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lKXtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiLCBmcmFtZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChmcmFtZSAmJiAoZnJhbWUubmFtZSA9PT0gJ1dlYkFwcGxpY2F0aW9uRnJhbWUnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9Xb3JkXzAnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9FeGNlbF8wJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogc3RvcHBpbmcgbG9ja1NjaGVkdWxlclwiKVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RvcCgpXG4gICAgICAgICAgICBpZiAodGhpcy5sb2NrU2NoZWR1bGVyID09PSBzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBubyBicm93c2VyVmlldyBvciBsb2NrU2NoZWR1bGVyIGZvdW5kXCIpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIFxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBNQUlOIFdJTkRPV1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgYXN5bmMgY3JlYXRlTWFpbldpbmRvdygpIHtcbiAgICAgICAgbGV0IHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpO1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClbMF1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdpbmRvdyBkaW1lbnNpb25zIC0gZGVmaW5lZCBvbmNlLCB1c2VkIGV2ZXJ5d2hlcmVcbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSAxMDI0XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IDY0MFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBjZW50ZXIgcG9zaXRpb24gb24gcHJpbWFyeSBkaXNwbGF5XG4gICAgICAgIGxldCB4ID0gMFxuICAgICAgICBsZXQgeSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgeCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLndpZHRoIC0gd2luZG93V2lkdGgpIC8gMilcbiAgICAgICAgICAgIHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueSArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy5oZWlnaHQgLSB3aW5kb3dIZWlnaHQpIC8gMilcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTWFpbiB3aW5kb3cnLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgIHdpZHRoOiB3aW5kb3dXaWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogd2luZG93SGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDg1MCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogNjAwLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkYXMgXHUwMEM0bmRlcm4gZGVyIEdyXHUwMEY2XHUwMERGZSAgXG4gICAgICAgICAgICBmdWxsc2NyZWVuYWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGVuIFZvbGxiaWxkbW9kdXMgLSB3aWNodGlnIGZcdTAwRkNyIG1hY29zIGRlbm4gd2VubiBhdWYgbWFjb3MgZGFzIG1haW53aW5kb3cgYXVmIGZ1bGxzY3JlZW4gaXN0IGdyZWlmdCBiZWltIGV4YW13aW5kb3cgZGVyIGtpb3NrIG1vZGUgbmljaHQgIC0gZWxlY3Ryb24gYnVnIChuZWVkcyBleGFtcGxlIGNvZGUpOiA+PiBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzQ0NzU1XG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgLy92aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnREaXIsXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTilcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRUaHJvdHRsaW5nOiB0cnVlICAvLyBhbGxvdyB0aHJvdHRsaW5nIHdoZW4gd2luZG93IGlzIGluIGJhY2tncm91bmRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBoYW5kbGVycyBiZWZvcmUgbG9hZGluZ1xuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmICF0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0KSB7ICAvLyBhbGxvd2V4aXQgaXN0IGVpbiBvdmVycmlkZSB2b20gY29udGV4dCBtZW51IG9kZXIgc2NyZWVuc2hvdCB0ZXN0LiBkaWVzZXIga2FubiBkaWUgYXBwIHNjaGxpZXNzZW5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGFzIG5vIGxlZ2FjeSB0cmF5XG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dUcmF5KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBHTk9NRSBkZXRlY3RlZCwgcXVpdHRpbmcgaW5zdGVhZCBvZiB0cmF5IG1pbmltaXplYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgIC8vIGFsbG93IGNsb3NlIGZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2hvd01pbmltaXplV2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTWluaW1pemluZyBOZXh0LUV4YW0gdG8gU3lzdGVtdHJheWApICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgd2luZG93IHByb3BlcnRpZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuZm9jdXMoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG4gICAgICAgIC8vdGhpcy5tYWlud2luZG93LnNldEhpZGRlbkluTWlzc2lvbkNvbnRyb2wodHJ1ZSlcblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudltcIkRFQlVHXCJdKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGdldFJlbmRlcmVySW5kZXhQYXRoKCk7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH1gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGFzeW5jIHNob3dFeGl0V2FybmluZyhtZXNzYWdlKXtcbiAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT2snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIEJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd0V4aXRRdWVzdGlvbigpe1xuICAgICAgICBpZiAodGhpcy5leGl0UXVlc3Rpb25PcGVuKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkaWFsb2cgYWxyZWFkeSBvcGVuLCBza2lwcGluZ1wiKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnSmEnLCAnTmVpbiddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gYmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1dvbGxlbiBzaWUgZGllIEFud2VuZHVuZyBOZXh0LUV4YW0gYmVlbmRlbj8nLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGNob2ljZS5yZXNwb25zZSA9PSAxKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkbyBub3QgY2xvc2UgTmV4dC1FeGFtIGFmdGVyIGZpbmlzaGVkIEV4YW1cIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dNaW5pbWl6ZVdhcm5pbmcoKXtcbiAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNaW5pbWl6ZSB0byBTeXN0ZW0gVHJheScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0RpZSBBbndlbmR1bmcgTmV4dC1FeGFtIHd1cmRlIG1pbmltaWVydCEnLFxuICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIEZ1bmN0aW9uc1xuICAgICAqL1xuXG4gICAgaXNXYXlsYW5kKCl7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7IFxuICAgIH1cblxuICAgIC8vIHRoaXMgZnVuY3Rpb24gdXNlcyBhY3RpdmUtd2luIHRvIHJlY2VpdmUgbmFtZSBhbmQgdXJsIGZyb20gYWN0aXZlIHdpbmRvdyAtIHlldCBhbm90aGVyIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoZSBmb2N1cyBpcyBzdGlsbCBvbiBuZXh0ZXhhbVxuICAgIC8vIHRoaXMgaXMgdXNlZCB0byBpbnRyb2R1Y2UgZXhlbXB0aW9ucyBmb3IgdGhlIGJsdXIgbGlzdGVuZXJcbiAgICAvLyAoZG93bmdyYWRlZCBmcm9tIGdldC13aW5kb3dzIGJlY2F1c2Ugb2YgbmFwaSB2OSBpc3N1ZSkgaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9nZXQtd2luZG93cy9pc3N1ZXMvMTg2XG4gICAgYXN5bmMgd2luZG93VHJhY2tlcigpe1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICAvLyBjb25zdCBnZXR3aW4gPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVdpbmRvdygpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlV2luID0gYXdhaXQgYWN0aXZlV2luZG93KClcbiAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGFjdGl2ZVdpbiAmJiBhY3RpdmVXaW4ub3duZXIgJiYgYWN0aXZlV2luLm93bmVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IGFjdGl2ZVdpbi5vd25lci5uYW1lXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoID0gYWN0aXZlV2luLm93bmVyLnBhdGhcbiAgICAgICAgICAgICAgICBsZXQgbmFtZUxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoTG93ZXIgPSB3cGF0aC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZUxvd2VyLmluY2x1ZGVzKFwiZXhhbVwiKSB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJuZXh0XCIpICB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJlbGVjdHJvblwiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImVhc2VvZmFjY2Vzc2RpYWxvZ1wiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImRpc2FibGUtc2hvcnRjdXRzXCIpICl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9rdXMgaXMgb24gYWxsb3dlZCB3aW5kb3cgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvL2ZvY3VzIGlzIG5vdCBvbiBuZXh0LWV4YW0gb3IgYW55IG90aGVyIGFsbG93ZWQgd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCl7ICAvL2xvZyBqdXN0IG9uY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogZm9jdXMgbG9zdCBldmVudCB3YXMgdHJpZ2dlcmVkLiBhcHA6ICR7d3BhdGh9IC0gJHtuYW1lfSBgKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vYWRkcyBibHVyIGxpc3RlbmVyIHdoZW4gZW50ZXJpbmcgZXhhbW1vZGUgICAvLyBibHVyIGV2ZW50IGlzbnQgZmlyZWQgb24gbWFjb3MgTUlTU0lPTkNPTlRST0wgKHdoaWNoIGNhbnQgYmUgZGVhY3RpdmF0ZWQgYW55bW9yZSkgLSBkYW1uIHlvdSBhcHBsZSFcbiAgICBhZGRCbHVyTGlzdGVuZXIod2luZG93ID0gXCJleGFtd2luZG93XCIpe1xuICAgICAgICBpZiAod2luZG93ID09PSBcImV4YW13aW5kb3dcIil7IFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9YClcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50KHRoaXMpKSBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3aW5kb3cgPT09IFwic2NyZWVubG9ja1wiKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd313aW5kb3dgKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnRTY3JlZW5sb2NrKHRoaXMpKSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vcmVtb3ZlcyBibHVyIGxpc3RlbmVyIHdoZW4gbGVhdmluZyBleGFtIG1vZGVcbiAgICByZW1vdmVCbHVyTGlzdGVuZXIoKXtcbiAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdibHVyJylcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIHJlbW92ZUJsdXJMaXN0ZW5lcjogcmVtb3ZpbmcgYmx1ciBsaXN0ZW5lclwiKVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGltcGxlbWVudGluZyBhIHNsZWVwICh3YWl0KSBmdW5jdGlvblxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy9zdHVkZW50IGZvZ3VzIHdlbnQgdG8gYW5vdGhlciB3aW5kb3dcbiAgICBhc3luYyBibHVyZXZlbnQod2luaGFuZGxlcikgeyBcblxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IHN0dWRlbnQgdHJpZWQgdG8gbGVhdmUgZXhhbSB3aW5kb3dcIilcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4Jyl7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndpbmRvd1RyYWNrZXIoKSAgLy9jaGVja3MgaWYgbmV3IGZvY3VzIHdpbmRvdyBpcyBhbGxvd2VkXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd3RyYWNrZXIgY2hlY2sgZG9uZS4uLlwiKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBzY3JlZW5sb2NrIHdpbmRvd3MgZnJvbSBhcnJheSBhbmQgY2hlY2sgaWYgYW55IHN0aWxsIGV4aXN0XG4gICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgY29uc3QgaGFzQWN0aXZlU2NyZWVubG9jayA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Muc29tZSh3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSAmJiB3aW4uaXNWaXNpYmxlKCkpXG4gICAgICAgIC8vIEFsc28gY2hlY2sgY2xpZW50aW5mby5zY3JlZW5sb2NrIGZsYWcgYXMgZmFsbGJhY2sgaW4gY2FzZSBhcnJheSB3YXMgY2xlYXJlZCBidXQgd2luZG93cyBzdGlsbCBleGlzdFxuICAgICAgICBpZiAoaGFzQWN0aXZlU2NyZWVubG9jayB8fCB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uc2NyZWVubG9jaykgeyByZXR1cm4gfS8vIGRvIG5vdGhpbmcgaWYgc2NyZWVubG9ja3dpbmRvdyBzdG9sZSBmb2N1cyAvLyBkbyBub3QgdHJpZ2dlciBhbiBpbmZpbml0ZSBsb29wIGJldHdlZW4gZXhhbSB3aW5kb3cgYW5kIHNjcmVlbmxvY2sgd2luZG93IChzdGVhbGluZyBlYWNoIG90aGVycyBmb2N1cyBiZWNhdXNlIHNjcmVlbmxvY2t3aW5kb3cgYXBwZWFycyBhYm92ZSBleGFtIHdpbmRvdyBhbmQgd2lsbCBjYXB0dXJlIGEga2xpY2sgYW5kIHRoZXJlZm9yZSBzdGVhbCBmb2N1cylcbiAgICAgICAgaWYgKHdpbmhhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkKXsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgLy90cm90emRlbSBmb2N1cyB6dXJcdTAwRkNjayBhdWYgZGllIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IGJsdXJldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZSAgIC8vaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG5cbiAgICAgICAgLy90dXJuIHZvbHVtZSB1cCBeXlxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyBzcGF3bigncG93ZXJzaGVsbCcsIFsnU2V0LVZvbHVtZUxldmVsIC1MZXZlbCAxMDA7IFNldC1Wb2x1bWVNdXRlIC1NdXRlICRmYWxzZSddKTsgfVxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBleGVjKCdvc2FzY3JpcHQgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCB2b2x1bWUgMTAwXCIgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCBtdXRlZCBmYWxzZVwiJyk7IH0gIFxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgeyBcbiAgICAgICAgLy8gICAgIGV4ZWMoJ2FtaXhlciBzZXQgTWFzdGVyIDEwMCUgJyk7XG4gICAgICAgIC8vICAgICBleGVjKCdwYWN0bCBzZXQtc2luay1tdXRlIGBwYWN0bCBnZXQtZGVmYXVsdC1zaW5rYCAwJyk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgXG4gICAgICAgIC8vd2UgY291bGQgcGxheSBhIHNvdW5kIGZpbGUgaGVyZS4uIHRiZC4gIFxuICAgIH1cbiAgICAvL3NwZWNpYWwgYmx1ciBldmVudCBmb3IgdGVtcG9yYXJ5IGxvdyBzZWN1cml0eSBzY3JlZW5sb2NrXG4gICAgYmx1cmV2ZW50U2NyZWVubG9jayh3aW5oYW5kbGVyKSB7IFxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiBibHVyLXNjcmVlbmxvY2sgdHJpZ2dlcmVkXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL2Rvbid0IGN5Y2xlIHRocm91Z2ggYWxsIG9mIHRoZW0gLi4gaXQgd2lsbCBjcmVhdGUgYW4gaW5maW5pdGUgZm9jdXMgcmFjZVxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5zaG93KCk7ICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgXG4gICAgfVxuICAgIFxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiBcblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogbW9zdCBvZiB0aGUga2V5Ym9hcmQgcmVzdHJpY3Rpb25zIGNvdWxkIGJlIGhhbmRsZWQgYnkgXCJpb2hvb2tcIiBmb3IgYWxsIHBsYXRmb3Jtc1xuICogdW5mb3J0dW5hbGV0eSBpdCdzIG5vdCB5ZXQgcmVsZWFzZWQgZm9yIG5vZGUgdjE2LnggYW5kIGVsZWN0cm9uIHYxNi54ICAoYWxzbyBpdCdzIFwiYmlnIHN1clwiIGludGVsIG9ubHkgb24gbWFjcylcbiAqIGh0dHBzOi8vd2lsaXgtdGVhbS5naXRodWIuaW8vaW9ob29rL2luc3RhbGxhdGlvbi5odG1sXG4gKlxuICogXCJub2RlLWdsb2JhbC1rZXktbGlzdGVuZXJcIiB3b3VsZCBiZSBhbm90aGVyIHNvbHV0aW9uIGZvciB3aW5kb3dzIGFuZCBtYWNvcyAoYWx0aG91Z2ggaXQgcmVxdWlyZXMgXCJhY2Nlc3NhYmlsaXR5XCIgcGVybWlzc2lvbnMgb24gbWFjKVxuICogYnV0IGZvciBub3cgaXQgc2VlbXMgdGhlIG1vZHVsZSBjYW4gbm90IHJ1biBpbiBhIGZpbmFsIGVsZWN0cm9uIGJ1aWxkXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTGF1bmNoTWVudS9ub2RlLWdsb2JhbC1rZXktbGlzdGVuZXIvaXNzdWVzLzE4XG4gKlxuICogaGFyZGNvZGluZyB0aGUga2V5Ym9hcmRzaG9ydGN1dHMgd2Ugd2FudCB0byBjYXB0dXJlIGludG8gaW9ob29rKG9yIG4tZy1rLWwpIGFuZCBtYW51YWxseSBjb21waWxpbmcgaXQgZm9yIG1hYyBhbmQgd2luZG93cyBjb3VsZCBiZSBkb25lIC0gKGJ1dCBub3QgdW50aWwgaSBnZXQgcGFpZCBmb3IgdGhpcyBhbW91bnQgb2Ygd29yayA7LSlcbiAqL1xuXG5cbi8qKlxuICogdGhlIG5leHQgYmVzdCBzb2x1dGlvbiBpIGNhbWUgdXAgd2l0aCBpcyB0byBraWxsIGFsbCBvZiB0aGUgc2hlbGxzIC0gc3RhcnRpbmcgd2l0aCBleHBsb3Jlci5leGUgYmVjYXVzZSBpdHMgYWJzb2x1dGVseSBpbXBvc3NpYmxlIHRvXG4gKiBkZWFjdGl2YXRlIHRoaXMgbmFzdHkgXCJ3aW5kb3dzXCIgYnV0dG9uIG9yIDNGaW5nZXJTbGlkZVVwIEdlc3R1cmUgaW4gd2luZG93cyAxMSAtIHlvdSBjb3VsZCBlZGl0IHRoZSByZWdpc3RyeSBhbmQgcmVib290IGJ1dCB0aGF0cyBvYnZpb3VzbHkgbm90IHdoYXQgd2Ugd2FudFxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBjbGlwYm9hcmQsIGdsb2JhbFNob3J0Y3V0IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgU2NoZWR1bGVyU2VydmljZSB9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zLCBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9saW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucywgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy93aW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlTWFjUmVzdHJpY3Rpb25zLCBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIGFzIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbWFjLmpzJztcblxubGV0IGNsaXBib2FyZEludGVydmFsO1xubGV0IGNvbmZpZ1N0b3JlID0ge1xuICAgIGxpbnV4OiB7fSxcbiAgICB3aW5kb3dzOiB7fSxcbiAgICBtYWNvczoge31cbn07XG5cbi8vIGxpc3Qgb2YgYXBwcyB3ZSBkbyBub3Qgd2FudCB0byBydW4gaW4gYmFja2dyb3VuZFxuY29uc3QgYXBwc1RvQ2xvc2UgPSBbJ0dvb2dsZSBDaHJvbWUnLCAnY2hyb21lJywgJ2dvb2dsZS1jaHJvbWUnLCAnTWljcm9zb2Z0IEVkZ2UnLCAnbXNlZGdlJywgJ2ZpcmVmb3gnLCAnc2FmYXJpJywgJ2JyYXZlJywgJ29wZXJhJywgJ2NoYXRncHQnLCAnQ2hhdEdQVCcsICdOb3J0b25TZWN1cml0eScsICdOQVYnLCAnVGVhbXMnLCAnbXMtdGVhbXMnLCAnem9vbS51cycsICdNaWNyb3NvZnQgVGVhbXMnLCAnZGlzY29yZCcsICd6b29tJywgJ3RlYW1zJywgJ3RlYW12aWV3ZXInLCAnc2t5cGVmb3JsaW51eCcsICdza3lwZScsICdhbnlkZXNrJ107XG5cbmFzeW5jIGZ1bmN0aW9uIGVuYWJsZVJlc3RyaWN0aW9ucyh3aW5oYW5kbGVyKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cblxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIHBsYXRmb3JtIHJlc3RyaWN0aW9uc1wiKTtcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBjbGlwYm9hcmQuY2xlYXIoKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKCgpID0+IHsgY2xpcGJvYXJkLmNsZWFyKCk7IH0sIDEwMDApO1xuICAgIGNsaXBib2FyZEludGVydmFsLnN0YXJ0KCk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzS0RFLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNHTk9NRSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBhd2FpdCBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlzYWJsZVJlc3RyaWN0aW9ucygpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiByZW1vdmluZyByZXN0cmljdGlvbnMuLi5cIik7XG5cbiAgICBpZiAoY2xpcGJvYXJkSW50ZXJ2YWwpIHtcbiAgICAgICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RvcCgpO1xuICAgIH1cblxuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbChlbmFibGUpO1xufVxuXG5leHBvcnQgeyBlbmFibGVSZXN0cmljdGlvbnMsIGRpc2FibGVSZXN0cmljdGlvbnMsIHRvZ2dsZU1hY09TTG9ja2Rvd24gfTtcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogTGludXgtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuLy8gdW5mb3J0dW5hdGVseSB0aGVyZSBpcyBubyBjb252ZW5pZW50IHdheSBmb3IgZ25vbWUtc2hlbGwgdG8gdW4tc2V0IEFMTCBzaG9ydGN1dHMgYXQgb25jZVxuY29uc3QgZ25vbWVLZXliaW5kaW5ncyA9IFtcbiAgICAnYWN0aXZhdGUtd2luZG93LW1lbnUnLCdtYXhpbWl6ZS1ob3Jpem9udGFsbHknLCdtb3ZlLXRvLXNpZGUtbicsJ21vdmUtdG8td29ya3NwYWNlLTgnLCdzd2l0Y2gtYXBwbGljYXRpb25zJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0zJywnc3dpdGNoLXdpbmRvd3MtYmFja3dhcmQnLFxuICAgICdhbHdheXMtb24tdG9wJywnbWF4aW1pemUtdmVydGljYWxseScsJ21vdmUtdG8tc2lkZS1zJywnbW92ZS10by13b3Jrc3BhY2UtOScsJ3N3aXRjaC1hcHBsaWNhdGlvbnMtYmFja3dhcmQnLCcgIHN3aXRjaC10by13b3Jrc3BhY2UtNCcsJ3RvZ2dsZS1hYm92ZScsXG4gICAgJ2JlZ2luLW1vdmUnLCdtaW5pbWl6ZScsJ21vdmUtdG8tc2lkZS13JywnbW92ZS10by13b3Jrc3BhY29lLWRvd24nLCdzd2l0Y2gtZ3JvdXAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTUnLCd0b2dnbGUtZnVsbHNjcmVlbicsXG4gICAgJ2JlZ2luLXJlc2l6ZScsJ21vdmUtdG8tY2VudGVyJywnbW92ZS10by13b3Jrc3BhY2UtMScsJ21vdmUtdG8td29ya3NwYWNlLWxhc3QnLCdzd2l0Y2gtZ3JvdXAtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTYnLCd0b2dnbGUtbWF4aW1pemVkJyxcbiAgICAnY2xvc2UnLCdtb3ZlLXRvLWNvcm5lci1uZScsJ21vdmUtdG8td29ya3NwYWNlLTEwJywnbW92ZS10by13b3Jrc3BhY2UtbGVmdCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTcnLCd0b2dnbGUtb24tYWxsLXdvcmtzcGFjZXMnLFxuICAgICdjeWNsZS1ncm91cCcsJ21vdmUtdG8tY29ybmVyLW53JywnbW92ZS10by13b3Jrc3BhY2UtMTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1yaWdodCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UtYmFja3dhcmQgIHN3aXRjaC10by13b3Jrc3BhY2UtOCcsJ3RvZ2dsZS1zaGFkZWQnLFxuICAgICdjeWNsZS1ncm91cC1iYWNrd2FyZCcsJ21vdmUtdG8tY29ybmVyLXNlJywnbW92ZS10by13b3Jrc3BhY2UtMTInLCdtb3ZlLXRvLXdvcmtzcGFjZS11cCcsJ3N3aXRjaC1wYW5lbHMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTknLCd1bm1heGltaXplJyxcbiAgICAnY3ljbGUtcGFuZWxzJywnbW92ZS10by1jb3JuZXItc3cnLCdtb3ZlLXRvLXdvcmtzcGFjZS0yJywncGFuZWwtbWFpbi1tZW51Jywnc3dpdGNoLXBhbmVscy1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtZG93bicsXG4gICAgJ2N5Y2xlLXBhbmVscy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1kb3duJywnbW92ZS10by13b3Jrc3BhY2UtMycsJ3BhbmVsLXJ1bi1kaWFsb2cnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxhc3QnLFxuICAgICdjeWNsZS13aW5kb3dzJywnbW92ZS10by1tb25pdG9yLWxlZnQnLCdtb3ZlLXRvLXdvcmtzcGFjZS00JywncmFpc2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sZWZ0JyxcbiAgICAnY3ljbGUtd2luZG93cy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1yaWdodCcsJ21vdmUtdG8td29ya3NwYWNlLTUnLCdyYWlzZS1vci1sb3dlcicsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLXJpZ2h0JyxcbiAgICAnbG93ZXInLCdtb3ZlLXRvLW1vbml0b3ItdXAnLCdtb3ZlLXRvLXdvcmtzcGFjZS02Jywnc2V0LXNwZXctbWFyaycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTInLCdzd2l0Y2gtdG8td29ya3NwYWNlLXVwJyxcbiAgICAnbWF4aW1pemUnLCdtb3ZlLXRvLXNpZGUtZScsJ21vdmUtdG8td29ya3NwYWNlLTcnLCdzaG93LWRlc2t0b3AnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTInLCdzd2l0Y2gtd2luZG93cydcbl07XG5jb25zdCBnbm9tZVNoZWxsS2V5YmluZGluZ3MgPSBbJ2ZvY3VzLWFjdGl2ZS1ub3RpZmljYXRpb24nLCdvcGVuLWFwcGxpY2F0aW9uLW1lbnUnLCdzY3JlZW5zaG90Jywnc2NyZWVuc2hvdC13aW5kb3cnLCdzaGlmdC1vdmVydmlldy1kb3duJyxcbiAgICAnc2hpZnQtb3ZlcnZpZXctdXAnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMScsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0yJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTMnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi01JyxcbiAgICAnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTYnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi04Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTknLCdzaG93LXNjcmVlbnNob3QtdWknLCdzaG93LXNjcmVlbi1yZWNvcmRpbmctdWknLFxuICAgICd0b2dnbGUtYXBwbGljYXRpb24tdmlldycsJ3RvZ2dsZS1tZXNzYWdlLXRyYXknLCd0b2dnbGUtb3ZlcnZpZXcnXTtcbmNvbnN0IGdub21lTXV0dGVyS2V5YmluZGluZ3MgPSBbJ3JvdGF0ZS1tb25pdG9yJywnc3dpdGNoLW1vbml0b3InLCd0YWItcG9wdXAtY2FuY2VsJywndGFiLXBvcHVwLXNlbGVjdCcsJ3RvZ2dsZS10aWxlZC1sZWZ0JywndG9nZ2xlLXRpbGVkLXJpZ2h0J107XG5jb25zdCBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyA9IFsnYXBwLWN0cmwtaG90a2V5LTEnLCdhcHAtY3RybC1ob3RrZXktMTAnLCdhcHAtY3RybC1ob3RrZXktMicsJ2FwcC1jdHJsLWhvdGtleS0zJywnYXBwLWN0cmwtaG90a2V5LTQnLCdhcHAtY3RybC1ob3RrZXktNScsXG4gICAgJ2FwcC1jdHJsLWhvdGtleS02JywnYXBwLWN0cmwtaG90a2V5LTcnLCdhcHAtY3RybC1ob3RrZXktOCcsJ2FwcC1jdHJsLWhvdGtleS05JyxcbiAgICAnYXBwLWhvdGtleS0xJywnYXBwLWhvdGtleS0xMCcsJ2FwcC1ob3RrZXktMicsJ2FwcC1ob3RrZXktMycsJ2FwcC1ob3RrZXktNCcsJ2FwcC1ob3RrZXktNScsJ2FwcC1ob3RrZXktNicsJ2FwcC1ob3RrZXktNycsJ2FwcC1ob3RrZXktOCcsJ2FwcC1ob3RrZXktOScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktMScsJ2FwcC1zaGlmdC1ob3RrZXktMTAnLCdhcHAtc2hpZnQtaG90a2V5LTInLCdhcHAtc2hpZnQtaG90a2V5LTMnLCdhcHAtc2hpZnQtaG90a2V5LTQnLCdhcHAtc2hpZnQtaG90a2V5LTUnLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTYnLCdhcHAtc2hpZnQtaG90a2V5LTcnLCdhcHAtc2hpZnQtaG90a2V5LTgnLCdhcHAtc2hpZnQtaG90a2V5LTknLCdzaG9ydGN1dCddO1xuY29uc3QgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MgPSBbJ3N3aXRjaC10by1zZXNzaW9uLTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0yJywnc3dpdGNoLXRvLXNlc3Npb24tMycsJ3N3aXRjaC10by1zZXNzaW9uLTQnLCdzd2l0Y2gtdG8tc2Vzc2lvbi01Jywnc3dpdGNoLXRvLXNlc3Npb24tNicsJ3N3aXRjaC10by1zZXNzaW9uLTcnLCdzd2l0Y2gtdG8tc2Vzc2lvbi04Jywnc3dpdGNoLXRvLXNlc3Npb24tOScsJ3N3aXRjaC10by1zZXNzaW9uLTEwJywnc3dpdGNoLXRvLXNlc3Npb24tMTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMiddO1xuXG4vKipcbiAqIEVuYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgKEtERS9HTk9NRSwgY2xvc2UgYXBwcywgY2xpcGJvYXJkKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNLREVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNHTk9NRVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBpc0tERSwgaXNHTk9NRSkge1xuICAgIHRyeSB7XG4gICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiYCwgKHBncmVwRXJyb3IsIHN0ZG91dCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcGdyZXBFcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cIiB8IHhhcmdzIC1yIGtpbGwgLTlgLCAoa2lsbEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtpbGxFcnJvcikgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmIChpc0tERSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBLREUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2tyZWFkY29uZmlnNScsIFsnLS1maWxlJywgJ2t3aW5yYycsICctLWdyb3VwJywgJ0Rlc2t0b3BzJywgJy0ta2V5JywgJ051bWJlciddLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChrcmVhZGNvbmZpZyk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gMTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHJlY29uZmlndXJpbmcga3dpblwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCBgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywgJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJ1wiXCInXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCcxJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3NldEN1cnJlbnREZXNrdG9wJywnMSddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGVmZmVjdHNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ2Rlc2t0b3BncmlkJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdzY3JlZW5lZGdlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdvdmVydmlldyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogYWRkaXRpb25hbCB0dHknc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnc3J2cmtleXM6bm9uZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbGVhcmluZyBjbGlwYm9hcmQgaGlzdG9yeVwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdvcmcua2RlLktHbG9iYWxBY2NlbC5ibG9ja0dsb2JhbFNob3J0Y3V0cycsICd0cnVlJ10pO1xuICAgICAgICB9LCAyMDAwKTtcbiAgICB9XG5cbiAgICBpZiAoaXNHTk9NRSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBHTk9NRSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdheWxhbmQ6IGRpc2FibGUgVlQvVFRZIHN3aXRjaCAoQ3RybCtBbHQrRjEuLkYxMikgdmlhIG11dHRlciBrZXliaW5kaW5nc1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnLCAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYmluZGluZywgYFsnJ11gXSk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkY29uZicsIFsnd3JpdGUnLCBgL29yZy9nbm9tZS9tdXR0ZXIvd2F5bGFuZC9rZXliaW5kaW5ncy8ke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5JywgYCcnYF0pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLm11dHRlciBkeW5hbWljLXdvcmtzcGFjZXMgZmFsc2UnKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5kZXNrdG9wLndtLnByZWZlcmVuY2VzIG51bS13b3Jrc3BhY2VzIDEnKTtcbiAgICAgICAgICAgIC8vIFgxMSBvbmx5OiBkaXNhYmxlIFRUWSBzd2l0Y2ggdmlhIHNldHhrYm1hcCAob24gV2F5bGFuZCB3ZSByZWx5IG9uIG11dHRlciBrZXliaW5kaW5ncyBhYm92ZSlcbiAgICAgICAgICAgIGlmICghcGxhdGZvcm1EaXNwYXRjaGVyLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnc2V0eGtibWFwIC1vcHRpb24gc3J2cmtleXM6bm9uZScsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChHTk9NRSk6IHNldHhrYm1hcCBzcnZya2V5czpub25lIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgYW5kIHJlc3RvcmUgS0RFL0dOT01FIHNldHRpbmdzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1N0b3JlIC0gc2hhcmVkIHN0b3JlIChjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKSB7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG5cbiAgICBjaGlsZFByb2Nlc3MuZXhlYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBleGVjIGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnS0RFJykge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogS0RFIGRldGVjdGVkXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAnZmFsc2UnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nICwnL0NvbXBvc2l0b3InLCAnb3JnLmtkZS5rd2luLkNvbXBvc2l0aW5nLnJlc3VtZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IGtnbG9iYWxhY2NlbDUmJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJy0tZGVsZXRlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCdrd2lucmMnLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHNdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IHBsYXNtYXNoZWxsICYnLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmddKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5J10pO1xuICAgIC8vIHJlc3RvcmUgVFRZIHN3aXRjaCBpZiB3ZSBoYWQgZGlzYWJsZWQgaXQgdmlhIHNldHhrYm1hcCAoR05PTUUgWDExKVxuICAgIGlmIChjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoXCJzZXR4a2JtYXAgLW9wdGlvbiAnJ1wiLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBsb2cud2FybigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBzZXR4a2JtYXAgcmVzdG9yZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQgPSBmYWxzZTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFdpbmRvd3Mtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLyoqXG4gKiBFbmFibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHNob3J0Y3V0cywgY2xvc2UgYXBwcywga2lsbCBleHBsb3JlcikuXG4gKiBAcGFyYW0ge29iamVjdH0gd2luaGFuZGxlciAtIG11c3QgaGF2ZSB3aW5oYW5kbGVyLmV4YW13aW5kb3dcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwdWJsaWNCYXNlID0gcGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2U7XG4gICAgICAgIGNvbnN0IGV4ZWN1dGFibGUxID0gam9pbihwdWJsaWNCYXNlLCAnZGlzYWJsZS1zaG9ydGN1dHMuZXhlJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMSwgW10sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJywgc2hlbGw6IGZhbHNlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luZG93cyBzaG9ydGN1dHMgZGlzYWJsZWRcIik7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBzaG9ydGN1dHMpOiAke2Vycn1gKTsgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHAgb2YgYXBwc1RvQ2xvc2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRBcHAgPSBhcHAucmVwbGFjZSgvJy9nLCBcIicnXCIpO1xuICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkYXBwTmFtZSA9ICcke2VzY2FwZWRBcHB9JzsgdHJ5IHsgJHByb2NzID0gR2V0LVByb2Nlc3MgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyAkXy5Qcm9jZXNzTmFtZSAtaWxpa2UgKCcqJyArICRhcHBOYW1lICsgJyonKSB9OyBpZiAoJHByb2NzIC1hbmQgJHByb2NzLkNvdW50IC1ndCAwKSB7ICRwcm9jcyB8IFN0b3AtUHJvY2VzcyAtRm9yY2UgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWU7IFdyaXRlLU91dHB1dCAna2lsbGVkJyB9IH0gY2F0Y2ggeyB9XCJgO1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmVBcHApID0+IHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkuaW5jbHVkZXMoJ2tpbGxlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlQXBwKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgaWYgKCF3aW5oYW5kbGVyKSB7XG4gICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luaGFuZGxlciBpcyBub3QgcHJvdmlkZWQgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCByZXRyeUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwMDtcbiAgICAgICAgY29uc3Qga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cyA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5oYW5kbGVyLmV4YW13aW5kb3cgJiYgIXdpbmhhbmRsZXIuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2tpbGwgL2YgL2ltIGV4cGxvcmVyLmV4ZScsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBleHBsb3Jlci5leGVgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJldHJ5Q291bnQgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgcmV0cnlDb3VudCsrO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoa2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cywgMTAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBleGFtd2luZG93IG5vdCBmb3VuZCBhZnRlciAke21heFJldHJpZXMgKiAxMDB9bXMgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzKCk7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHVuYmxvY2sgc2hvcnRjdXRzLCByZXN0YXJ0IGV4cGxvcmVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCkge1xuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiB1bmJsb2NraW5nIHNob3J0Y3V0cy4uLlwiKTtcbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgdGFza2tpbGwgIC9JTSBcImRpc2FibGUtc2hvcnRjdXRzLmV4ZVwiIC9UIC9GYCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBkaXNhYmxlLXNob3J0Y3V0cy5leGVgKTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBleHBsb3Jlci5leGVcIicsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgdGFza2xpc3QgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMoJ2V4cGxvcmVyLmV4ZScpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHJlc3RhcnRpbmcgZXhwbG9yZXIuLi5cIik7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygnc3RhcnQgZXhwbG9yZXIuZXhlJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVyZXN0cmljdGlvbnMgKHdpbiBleHBsb3Jlcik6ICR7ZS5tZXNzYWdlfWApOyB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIG1hY09TLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUsIHRvZ2dsZU1hY09TTG9ja2Rvd24pLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgVG91Y2hCYXIsIHN5c3RlbVByZWZlcmVuY2VzLCBwb3dlck1vbml0b3IgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHN0b3JlZCByZWZzIGZvciBjbGVhbnVwIHdoZW4gZGlzYWJsaW5nIG1hY09TIHJlc3RyaWN0aW9uc1xubGV0IHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbmxldCBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbmxldCBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG5cbi8qKiBTaW5nbGUgaGFuZGxlciBmb3IgYWxsIG1hY09TIHJlc3RyaWN0aW9uIHNpZ25hbHM6IGxvZyBhbmQgcmUtZm9jdXMgZXhhbSB3aW5kb3cgLyBpbmZvcm0gdGVhY2hlci4gKi9cbmZ1bmN0aW9uIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoc2lnbmFsTmFtZSkge1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogJHtzaWduYWxOYW1lfSBkZXRlY3RlZGApO1xuICAgIGlmICghY3VycmVudFdpbmhhbmRsZXI/LmV4YW13aW5kb3c/LmlzRGVzdHJveWVkPy4oKSkge1xuICAgICAgICBpZiAoY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvKSBjdXJyZW50V2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBpbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7XG4gICAgfVxufVxuXG5jb25zdCBsb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ2xvY2stc2NyZWVuJyk7XG5jb25zdCB1bmxvY2tTY3JlZW5IYW5kbGVyID0gKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgndW5sb2NrLXNjcmVlbicpO1xuXG4vKipcbiAqIEVuYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKFRvdWNoQmFyLCBjbGlwYm9hcmQsIGNsb3NlIGFwcHMsIHdvcmtzcGFjZS9sb2NrIG1vbml0b3JpbmcpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICBjb25zdCB7IFRvdWNoQmFyTGFiZWwsIFRvdWNoQmFyU3BhY2VyIH0gPSBUb3VjaEJhcjtcbiAgICBjb25zdCB0ZXh0bGFiZWwgPSBuZXcgVG91Y2hCYXJMYWJlbCh7IGxhYmVsOiBcIk5leHQtRXhhbVwiIH0pO1xuICAgIGNvbnN0IHRvdWNoQmFyID0gbmV3IFRvdWNoQmFyKHtcbiAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgICAgICB0ZXh0bGFiZWwsXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICBdXG4gICAgfSk7XG4gICAgd2luaGFuZGxlci5leGFtd2luZG93Py5zZXRUb3VjaEJhcih0b3VjaEJhcik7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSB3aW5oYW5kbGVyO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3BiY29weSA8IC9kZXYvbnVsbCcpO1xuXG4gICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGtpbGwgLTkgLWYgXCIke2FwcH1cImAsIChlcnJvciwgc3RkZXJyLCBzdGRvdXQpID0+IHt9KTtcbiAgICB9KTtcblxuICAgIC8vIHdvcmtzcGFjZS9zcGFjZSBzd2l0Y2ggYW5kIGxvY2svdW5sb2NrIG1vbml0b3JpbmcgKG1hY09TIG9ubHkpXG4gICAgdHJ5IHtcbiAgICAgICAgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBzeXN0ZW1QcmVmZXJlbmNlcy5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24oJ05TV29ya3NwYWNlQWN0aXZlU3BhY2VEaWRDaGFuZ2VOb3RpZmljYXRpb24nLCAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdkZXNrdG9wL3NwYWNlIHN3aXRjaCcpKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuXG4gICAgcG93ZXJNb25pdG9yLm9uKCdsb2NrLXNjcmVlbicsIGxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBwb3dlck1vbml0b3Iub24oJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcblxuICAgIGxvZ1N0cmVhbVByb2Nlc3MgPSBzcGF3bignbG9nJywgWydzdHJlYW0nLCAnLS1wcmVkaWNhdGUnLCAnc3Vic3lzdGVtID09IFwiY29tLmFwcGxlLmRvY2tcIiBBTkQgY2F0ZWdvcnkgPT0gXCJtaXNzaW9uY29udHJvbFwiJ10pO1xuICAgIGxvZ1N0cmVhbVByb2Nlc3Muc3Rkb3V0Py5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgIGlmIChkYXRhLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ21vZGUnKSkgb25NYWNSZXN0cmljdGlvblNpZ25hbCgnTWlzc2lvbiBDb250cm9sJyk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogRGlzYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHRvdWNoYmFyLCBtb25pdG9yaW5nIGxpc3RlbmVycyBhbmQgbG9nIHByb2Nlc3MpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpIHtcbiAgICBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG4gICAgaWYgKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHsgc3lzdGVtUHJlZmVyZW5jZXMudW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24od29ya3NwYWNlTm90aWZpY2F0aW9uSWQpOyB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogdW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24nLCBlcnIpOyB9XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbiAgICB9XG4gICAgcG93ZXJNb25pdG9yLm9mZignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9mZigndW5sb2NrLXNjcmVlbicsIHVubG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIGlmIChsb2dTdHJlYW1Qcm9jZXNzKSB7XG4gICAgICAgIGxvZ1N0cmVhbVByb2Nlc3Mua2lsbCgpO1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogRGlzYWJsZXMvZW5hYmxlcyBtaXNzaW9uIGNvbnRyb2wsIHNwYWNlcyBhbmQgdHJhY2twYWQgZ2VzdHVyZXMuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAtIHRydWUgcmVzdG9yZXMgZXZlcnl0aGluZywgZmFsc2UgbG9ja3MgZXZlcnl0aGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIHRvZ2dsZU1hY09TTG9ja2Rvd246ICR7ZW5hYmxlID8gJ2VuYWJsZScgOiAnZGlzYWJsZSd9IG1pc3Npb24gY29udHJvbCBsb2NrZG93bmApO1xuXG4gICAgY29uc3QgbWNJZHMgPSBbMzIsIDMzLCAzNCwgMzUsIDc5LCA4MCwgODEsIDgyLCAxMTgsIDExOSwgMTIwLCAxMjFdO1xuICAgIGNvbnN0IHBsaXN0UGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3RvcnksICdMaWJyYXJ5L1ByZWZlcmVuY2VzL2NvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMucGxpc3QnKTtcbiAgICBjb25zdCBiYWNrdXBQYXRoID0gam9pbihwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeSwgJ25leHRfZXhhbV9ob3RrZXlzX2JhY2t1cC5wbGlzdCcpO1xuXG4gICAgaWYgKGVuYWJsZSkge1xuICAgICAgICBjb25zdCBob3RrZXlDb21tYW5kcyA9IG1jSWRzLm1hcChpZCA9PlxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMgQXBwbGVTeW1ib2xpY0hvdEtleXMgLWRpY3QtYWRkICR7aWR9IFwiPGRpY3Q+PGtleT5lbmFibGVkPC9rZXk+PGZhbHNlLz48L2RpY3Q+XCJgXG4gICAgICAgICkuam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0Rlc2t0b3BHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbICEgLWYgXCIke2JhY2t1cFBhdGh9XCIgXTsgdGhlbiBjcCBcIiR7cGxpc3RQYXRofVwiIFwiJHtiYWNrdXBQYXRofVwiOyBmaTtcbiAgICAgICAgJHtob3RrZXlDb21tYW5kc307XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBFbmFibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0FwcEV4cG9zZUdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gXG4gICAgICAgICAgY3AgXCIke2JhY2t1cFBhdGh9XCIgXCIke3BsaXN0UGF0aH1cIjsgXG4gICAgICAgICAgcm0gXCIke2JhY2t1cFBhdGh9XCI7IFxuICAgICAgICBmaTtcbiAgICAgICAgJHtnZXN0dXJlQ29tbWFuZHN9O1xuICAgICAgICBraWxsYWxsIC05IGNmcHJlZnNkO1xuICAgICAgICBzbGVlcCAxO1xuICAgICAgICAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvU3lzdGVtQWRtaW5pc3RyYXRpb24uZnJhbWV3b3JrL1Jlc291cmNlcy9hY3RpdmF0ZVNldHRpbmdzIC11O1xuICAgICAgICBraWxsYWxsIERvY2tcbiAgICAgIGA7XG4gICAgICAgIGxvZy5pbmZvKCdtYWluIEAgdG9nZ2xlTWFjT1NMb2NrZG93bjogRW5hYmxlIE1pc3Npb25Db250b2wnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoZnVsbENvbW1hbmQsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0xvY2tkb3duIERpc2FibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbid1c2Ugc3RyaWN0J1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBhcmNoaXZlciBmcm9tICdhcmNoaXZlcicgICAvLyBkYXMgbWFjaHQga3Jhc3Nlc3RlIHJhY2Vjb2RpdGlvbnMgbWl0IGVsZWN0cm9uIGVpZ2VuZW4gdmVyc2lvbmVuIC0gdW5iZWRpbmd0IGRpZSBzZWxiZSB2ZXJzaW9uIGJlaGFsdGVuIHdpZSBlbGVjdHJvblxuaW1wb3J0IGV4dHJhY3QgZnJvbSAnZXh0cmFjdC16aXAnXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IHNjcmVlbiwgaXBjTWFpbiwgYXBwLCBCcm93c2VyV2luZG93LCB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0IHNjcmVlbnNob3QgZnJvbSAnc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQnO1xuaW1wb3J0IHsgV29ya2VyIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBydW5SZW1vdGVDaGVjayB9IGZyb20gJy4vcmVtb3RlQ2hlY2suanMnXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyLmpzJztcblxuY29uc3Qgc2hlbGwgPSAoY21kKSA9PiB7ICAgcmV0dXJuIGV4ZWNTeW5jKGNtZCwgeyBlbmNvZGluZzogJ3V0ZjgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSk7IH07ICAvLyBzdGRlcnIgdW50ZXJkclx1MDBGQ2NrdCBcbmNvbnN0IGFnZW50ID0gbmV3IGh0dHBzLkFnZW50KHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9KTtcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IFxuXG4gLyoqXG4gICogSGFuZGxlcyBpbmZvcm1hdGlvbiBmZXRjaGluZyBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGFjdHMgb24gc3RhdHVzIHVwZGF0ZXNcbiAgKi9cbiBcbiBjbGFzcyBDb21tSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMudXBkYXRlU3R1ZGVudEludGVydmFsbCA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gZmFsc2VcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwIC8vIHdlIGNvdW50IGZhaWxzIGFuZCBkZWFjdGl2YXRlIG9uIDQgY29uc2VxdWVudCBmYWlsc1xuICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gdHJ1ZVxuICAgICAgICB0aGlzLnRpbWVyID0gMFxuICAgICAgICB0aGlzLndvcmtlciA9IG51bGxcbiAgICAgICAgdGhpcy51c2VXb3JrZXIgPSB0cnVlXG4gICAgICAgIHRoaXMud29ya2VyRmFpbHMgPSAwXG4gICAgfVxuIFxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMucmVxdWVzdFVwZGF0ZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuc2VuZFNjcmVlbnNob3QuYmluZCh0aGlzKSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIGlmICghdGhpcy53b3JrZXIgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7ICB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKSAgfVxuICAgIH1cbiBcblxuICAgIC8qKlxuICAgICAqIFNldHVwIHRoZSBpbWFnZSB3b3JrZXJcbiAgICAgKiB1c2VzIGZvcmsgdG8gY3JlYXRlIGEgbmV3IGNoaWxkIHByb2Nlc3NcbiAgICAgKiB1c2VzIHRoZSBpbWFnZVdvcmtlckxpbnV4LmpzIG9yIGltYWdlV29ya2VyU2hhcnAuanMgZmlsZVxuICAgICAqIHRoZSB3b3JrZXIgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSBzY3JlZW5zaG90IGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHNldHVwSW1hZ2VXb3JrZXIoKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlclVSTCA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJVUkw7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyVVJMLCB7IHR5cGU6ICdtb2R1bGUnLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYgfSB9KTtcbiAgICAgICAgbG9nLmRlYnVnKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBJbWFnZVdvcmtlciBpbml0aWFsaXplZC4gVXNpbmcgXCIgKyBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyRmlsZU5hbWUpXG4gICAgICAgIFxuXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdlcnJvcicsIGVycm9yID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyRmFpbHMgKz0gMVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLndvcmtlckZhaWxzID4gNCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBmYWlsZWQgNSB0aW1lcyAtIHN3aXRjaGluZyB0byBubyBwcm9jZXNzaW5nJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBzY3JlZW5zaG90IFxuICAgICAqIGlmIHVzZVdvcmtlciBpcyB0cnVlLCB0aGUgc2NyZWVuc2hvdCBpcyBwcm9jZXNzZWQgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICogb3RoZXJ3aXNlIHRoZSBzY3JlZW5zaG90IGlzIG5vdCBwcm9jZXNzZWQgYW5kIHRoZSBvcmlnaW5hbCBzY3JlZW5zaG90IGlzIHJldHVybmVkXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikge1xuICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLndvcmtlcikgeyAvL3RyaXBsZSBjaGVjayBpZiB3b3JrZXIgaXMgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dvcmtlciBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHsgaW1nQnVmZmVyOiBBcnJheS5mcm9tKGltZ0J1ZmZlciksIGltVmVyc2lvbjogcGxhdGZvcm1EaXNwYXRjaGVyLmltVmVyc2lvbiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyLm9uY2UoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmYWxsYmFjayB0byBubyBwcm9jZXNzaW5nICAgXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gQnVmZmVyLmZyb20oaW1nQnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJCYXNlNjQgPSBzY3JlZW5zaG90QmFzZTY0XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBzY3JlZW5zaG90QmFzZTY0OiBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQ6IGhlYWRlckJhc2U2NCwgaXNibGFjazogZmFsc2UsIGltZ0J1ZmZlcjogaW1nQnVmZmVyIH07XG5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuICAgIC8qKiBcbiAgICAgKiBVcGRhdGUgY3VycmVudCBTZXJ2ZXJzdGF0dXMgKyBTdHVkZW50dHN0YXR1cyAoZXZlcnkgNSBzZWNvbmRzKVxuICAgICAqL1xuICAgIGFzeW5jIHJlcXVlc3RVcGRhdGUoKXtcblxuICAgICAgICB0aGlzLnRpbWVyKysgICAvLyB3ZSB1c2UgdGltZXIgdG8gdGltZSBsb29wcyB3aXRoIGRpZmZlcmVudCBpbnRlcnZhbHMgd2l0aG91dCBpbnRyb2R1Y2luZyBuZXcgdW5uZWNjZXNhcnkgc2NoZWR1bGVyc1xuICAgICAgICBpZiAodGhpcy50aW1lciAlIDIwID09PSAwICl7ICAvLyBydW4gZXZlcnkgMjAqNSAodXBkYXRlbG9vcCkgc2Vjb25kc1xuXG4gICAgICAgICAgICBjb25zdCB1c2VzUmVtb3RlQXNzaXN0YW50ID0gYXdhaXQgcnVuUmVtb3RlQ2hlY2socHJvY2Vzcy5wbGF0Zm9ybSlcblxuICAgICAgICAgICAgaWYgKHVzZXNSZW1vdGVBc3Npc3RhbnQpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlYWR5OiBQb3NzaWJsZSByZW1vdGUgYXNzaXN0YW5jZSBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LmtleXdvcmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IEtleXdvcmQgJHtrZXl3b3JkfSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvcnQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5wb3J0cykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBQb3J0ICR7cG9ydH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnQgPSB1c2VzUmVtb3RlQXNzaXN0YW50XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKSAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgc2NyZWVuIHRoYXQgbmVlZHMgdG8gYmUgYmxvY2tlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZCAgbm8gc2VydmVyc2lnbmFsIGZvciAyMCBzZWNvbmRzXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7ICBcbiAgICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IENvbm5lY3Rpb24gdG8gVGVhY2hlciBsb3N0ISBSZW1vdmluZyByZWdpc3RyYXRpb24uXCIpIC8vcmVtb3ZlIHNlcnZlciByZWdpc3RyYXRpb24gbG9jYWxseSAoc2FtZSBhcyAna2ljaycpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSAgIC8vIHRoaXMgYWxzbyByZXNldHMgc2VydmVyaXAgdGhlcmVmb3JlIG5vIGFwaSBjYWxscyBhcmUgbWFkZSBhZnRlcndhcmRzXG4gICAgICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpICAgICAgIC8vIGp1c3QgaW4gY2FzZSBzY3JlZW5zIGFyZSBibG9ja2VkLi4gbGV0IHN0dWRlbnRzIHdvcmtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgXG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7Y2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb31cblxuICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsgdGhyb3cgbmV3IEVycm9yKCdOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgICAgICAoZGF0YS5tZXNzYWdlID09PSBcIm5vdGF2YWlsYWJsZVwiKXsgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogRXhhbSBJbnN0YW5jZSBub3QgZm91bmQhJyk7ICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDU7IH0gICAgLy8gZXhhbSBpbnN0YW5jZSBub3QgYXZhaWxhYmxlIGJ1dCBzZXJ2ZXIgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdGEubWVzc2FnZSA9PT0gXCJyZW1vdmVkXCIpeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogU3R1ZGVudCByZWdpc3RyYXRpb24gbm90IGZvdW5kIScpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoKVxuICAgICAgICAgICAgICAgICAgICB9ICAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIC0gd2UgaGFuZGxlIHRoaXMgZGlmZmVyZW50bHkgbm93LiB0ZWFjaGVyIHN0b3JlcyBcImtpY2tlZFwiIGZvciBzdHVkZW50IHRvIGNvbGxlY3QuIHN0dWRlbnQgaXMgcmVtb3ZlZCBmcm9tIHNlcnZlciB3aGVuIGNvbGxlY3Rpbmcga2lja2VkIGluZm8uIHN0dWRlbnQgY2xvc2VzIGV4YW0gYW5kIGNsZWFucyB1cC5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9IEhlYXJ0YmVhdCBsb3N0Li5gKTsgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7fSAgIC8vIGhlYXJ0YmVhdCBsb3N0IHNlcnZlciBub3QgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwOyAvLyBEaWVzIHpcdTAwRTRobHQgZWJlbmZhbGxzIGFscyBlcmZvbGdyZWljaGVyIEhlYXJ0YmVhdCAtIFZlcmJpbmR1bmcgaGFsdGVuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc2VydmVyc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zdHVkZW50c3RhdHVzKSk7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlclN0YXR1c0RlZXBDb3B5LCBzdHVkZW50U3RhdHVzRGVlcENvcHkpOy8vIFZlcmFyYmVpdHVuZyBkZXIgZW1wZmFuZ2VuZW4gRGF0ZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAoJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0pICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgLy8gcHJldmVudCBmb2N1cyB3YXJuaW5nIGJsb2NrIGlmIG5vIGNvbm5lY3Rpb24gXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gaWYgbm90IGNvbm5lY3RlZCBidXQgc3RpbGwgaW4gZXhhbSBtb2RlIHlvdSBjb3VsZCB0cmlnZ2VyIGEgZm9jdXMgd2FybmluZyBhbmQgbm9ib2R5IGlzIGFibGUgdG8gdW5sb2NrIHlvdVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIGFzeW5jIHNlbmRTY3JlZW5zaG90KCl7XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXtyZXR1cm59ICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjazsgLy8gVmFyaWFibGVuIGF1XHUwMERGZXJoYWxiIGRlcyBpZi1CbG9ja3MgZGVmaW5pZXJlblxuICAgICAgICAgICAgbGV0IGltZ0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIHNjcmVlbnNob3QgZnJvbSBkZXNrdG9wIHZpYSBzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCAoZmxhbWVzaG90LCBpbWFnZW1hZ2ljLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3QoeyBmb3JtYXQ6ICdwbmcnIH0pO1xuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2ssIGltZ0J1ZmZlciB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7ICAvLyBrZWluIGltYWdlQnVmZmVyIG1pdGdlZ2ViZW4gYmVkZXV0ZXQgbnV0emUgc2NyZWVuc2hvdC1kZXNrdG9wIGltIHdvcmtlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcykgeyB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDA7fVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbWFnZSBwcm9jZXNzaW5nIGZhaWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIFwic2NyZWVuc2hvdFwiIGZyb20gYXBwd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Rm9jdXNlZE1pbmRvdyA9IFdpbmRvd0hhbmRsZXIuZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSAgLy9yZXR1cm5zIGV4YW0gd2luZG93IGlmIG5vdGhpbmcgaW4gZm9jdXMgb3IgbWFpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRGb2N1c2VkTWluZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY3VycmVudEZvY3VzZWRNaW5kb3cud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKSAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIHdvcmsgYmVjYXVzZSBpdCdzIG9uYm9hcmQgZWxlY3Ryb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IHJlc3VsdC50b1BORygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgLy8gYXR0ZW50aW9uIHByb2Nlc3NJbWFnZSAgY29udmVydHMgYnVmZmVyIHRvIHVpbnQ4YXJyYXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzICs9MTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IHByb2Nlc3NJbWFnZSBmYWlsZWQ6ICR7ZXJyfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNQUNPUyBXT1JLQVJPVU5EIC0gc3dpdGNoIHRvIHBhZ2VjYXB0dXJlIGlmIG5vIHBlcm1pc3NvbnMgYXJlIGdyYW50ZWRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09IFwiZGFyd2luXCIgJiYgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCAmJiBpbWdCdWZmZXIgIT09IG51bGwpeyAgLy90aGlzIGlzIGZvciBtYWNPUyBiZWNhdXNlIGl0IGRlbGl2ZXJzIGEgYmxhbmsgYmFja2dyb3VuZCBzY3JlZW5zaG90IHdpdGhvdXQgcGVybWlzc2lvbnMuIHdlIGNhdGNoIHRoYXQgY2FzZSB3aXRoIGEgd29ya2Fyb3VuZFxuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSBmYWxzZSAgIC8vbmV2ZXIgZG8gdGhpcyBhZ2FpblxuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgID0gYXdhaXQgVGVzc2VyYWN0LnJlY29nbml6ZShpbWdCdWZmZXIgLCAnZW5nJyx7IGxhbmdQYXRoOiBwdWJsaWNQYXRoLCBjYWNoZVBhdGg6IHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkgfSApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwV2luZG93VmlzaWJsZSA9IHRleHQuaW5jbHVkZXMoXCJFeGFtXCIpICAgLy9jaGVjayBpZiB0aGUgd29yZCBcIkV4YW1cIiBjYW4gYmUgZm91bmQgaW4gc2NyZWVuc2hvdCAtIG90aGVyd2lzZSBpdCBpcyBtb3N0IGxpa2VseSBhIGJsYW5rIGRlc2t0b3AgLSBtYWNvcyBxdWlya1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFwcFdpbmRvd1Zpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IFBsZWFzZSBjaGVjayB5b3VyIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgLSBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBNYWNPUyBzY3JlZW5zaG90cGVybWlzc2lvbnMgY2hlY2sgT0tcIik7fVxuICAgICAgICAgICAgICAgIH1jYXRjaChlcnIpeyAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gaWYgc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2UgZG8gbm90IGhhdmUgYSBzY3JlZW5zaG90IC0gc28gZG8gbm90IHVwZGF0ZSB0aGUgc2VydmVyXG4gICAgICAgICAgICBpZiAoIXNjcmVlbnNob3RCYXNlNjQpe1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU2NyZWVuc2hvdCBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVgKSB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFBhZ2VDYXB0dXJlIGVycm9yIC0+IFN3aXRjaGluZyB0byBOby1Qcm9jZXNzaW5nYCkgfSAgIFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBubyBzY3JlZW5zaG90IGF2YWlsYWJsZSAtIHBsZWFzZSBmaXggeW91ciBzZXR1cGApIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuXG5cblxuICAgICAgICAgICAgLy9kbyBub3QgcnVuIGNvbG9yY2hlY2sgaWYgYWxyZWFkeSBsb2NrZWRcbiAgICAgICAgICAgIGlmICggdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyl7XG4gICAgICAgICAgICAgICAgaWYgKGlzYmxhY2spe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgZml0IHJlcXVpcmVtZW50cyAoYWxsYmxhY2spXCIpO1xuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBsZXQgc2NyZWVuc2hvdGhhc2ggPSBudWxsXG4gICAgICAgICAgICB0cnkgeyBzY3JlZW5zaG90aGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICB9ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogY3JlYXRpbmcgaGFzaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3Q6IHNjcmVlbnNob3RCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGhhc2g6IHNjcmVlbnNob3RoYXNoLFxuICAgICAgICAgICAgICAgIGhlYWRlcjogaGVhZGVyQmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RmaWxlbmFtZTogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiArIFwiLmpwZ1wiLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHNlbmQgc2NyZWVuc2hvdCB0byBzZXJ2ZXIgdmlhIGVtYWlsIGZldGNoIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBhdHRlbXB0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAyO1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZXNjcmVlbnNob3RgO1xuICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCwgbWF4UmV0cmllcyk7IC8vIEVyc3RlIEFuZnJhZ2Ugc3RhcnRlblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cbiAgICBkb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCA9IDAsIG1heFJldHJpZXMpIHtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBTdGF0dXMgRXJyb3I6XCIsIGRhdGEubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heFJldHJpZXMgLSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCArIDEsIG1heFJldHJpZXMpOyAvLyBSZXRyeVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRlbXB0ID09PSBtYXhSZXRyaWVzIC0gMSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGUgKGZldGNoKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuICAgIGFzeW5jIGtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lja1N0dWRlbnQ6IFN0dWRlbnQgZ290IGtpY2tlZCBieSBUZWFjaGVyXCIpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge2RlbGZvbGRlcm9uZXhpdDogZmFsc2V9ICAvLyBkbyBub3QgZGVsZXRlIGZvbGRlciBvbiBleGl0IGJlY2F1c2Ugc3R1ZGVudCBnb3Qga2lja2VkXG4gICAgICAgIGlmIChzdHVkZW50c3RhdHVzICYmIHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyKXsgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9IHRydWV9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogcmVhY3QgdG8gc2VydmVyIHN0YXR1cyBcbiAgICAgKiB0aGlzIGN1cnJlbnRseSBvbmx5IGhhbmRsZSBzdGFydGV4YW0gJiBlbmRleGFtXG4gICAgICogY291bGQgYWxzbyBoYW5kbGUga2ljaywgZm9jdXNyZXN0b3JlLCBhbmQgZXZlbiB0cmlnZ2VyIGZpbGUgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJzdGF0dXMsIHN0dWRlbnRzdGF0dXMpe1xuICAgICAgIFxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGluZGl2aWR1YWwgc3RhdHVzIHVwZGF0ZXNcblxuICAgICAgICBpZiAoIHN0dWRlbnRzdGF0dXMgJiYgT2JqZWN0LmtleXMoc3R1ZGVudHN0YXR1cykubGVuZ3RoICE9PSAwKSB7ICAvLyB3ZSBoYXZlIHN0YXR1cyB1cGRhdGVzICh0YXNrcykgLSBkbyBpdCFcbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnByaW50ZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2RlbmllZCcpICAgLy90cmlnZ2VyLCB3aHlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMua2lja2VkKSB7ICAvLyBzdHVkZW50IGdvdCBraWNrZWQgYnkgdGVhY2hlclxuICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cylcbiAgICAgICAgICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyXCIpXG4gICAgICAgICAgICAgICAgbGV0IGRlbGZvbGRlciA9IHRydWVcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxuICAgICAgICAgICAgICAgICAgICBkZWxmb2xkZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyb3IpICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDYW4gbm90IGRlbGV0ZSBkaXJlY3RvcnkgLSAke2Vycm9yfSBgKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIgPT0gZmFsc2UpeyAgLy90cnkgZGVsZXRpbmcgZmlsZSBieSBmaWxlICh0aGUgb25lIHRoYXQgY2F1c2VzIHRoZSBwcm9ibGVtIHdpbGwgc3RheSBpbiB0aGUgZm9sZGVyKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7IGZzLnJtU3luYyhmaWxlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIFZlcnN1Y2hlLCBkYXMgVmVyemVpY2huaXMgcmVrdXJzaXYgenUgbFx1MDBGNnNjaGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBmcy51bmxpbmtTeW5jKGZpbGVQYXRoKTsgIH0vLyBWZXJzdWNoZSwgZGllIERhdGVpIHp1IGxcdTAwRjZzY2hlbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogKGRlbGZvbGRlcikgRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuIGRlciBEYXRlaS9WZXJ6ZWljaG5pczogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mb2N1cyA9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHJlc3RvcmluZyBmb2N1cyBzdGF0ZSBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSB0cnVlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IGZhbHNlICApe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IHRydWUgIC8vY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjayB3aWxsIGJlIHB1dCBvbiB0aGlzLnByaXZhdGVTcGVsbGNoZWNrIGluIGVkaXRvciB1cGRhdGVkIHZpYSBmZXRjaEluZm8oKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlwY01haW4uZW1pdChcInN0YXJ0TGFuZ3VhZ2VUb29sXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IGZhbHNlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBkZS1hY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IGZhbHNlIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLnN1Z2dlc3Rpb25zID0gc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5zZW5kZXhhbSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRXhhbVRvVGVhY2hlcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mZXRjaGZpbGVzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RGaWxlRnJvbVNlcnZlcihzdHVkZW50c3RhdHVzLmZpbGVzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ2V0bWF0ZXJpYWxzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGFuIG1pY3Jvc29mdDM2NSB0aGluZy4gY2hlY2sgaWYgZXhhbSBtb2RlIGlzIG9mZmljZSwgY2hlY2sgaWYgdGhpcyBpcyBzZXQgLSBvdGhlcndpc2UgZG8gbm90IGVudGVyIGV4YW1tb2RlIC0gaXQgd2lsbCBmYWlsXG4gICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgc2hhcmluZyBsaW5rIC0gaXQgd2lsbCBiZSB1c2VkIGluIFwibWljcm9zb2Z0MzY1XCIgZXhhbSBtb2RlXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBzdHVkZW50c3RhdHVzLm1zb2ZmaWNlc2hhcmUgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgZ3JvdXAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgIT09IHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gc3R1ZGVudHN0YXR1cy5ncm91cCAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgXG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gZ2xvYmFsIHN0YXR1cyB1cGRhdGVzXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBTVEFSVFxuICAgICAgICAgKiBBVFRFTlRJT046IG1vdmUgdGhpcyB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIC0gaXQgaXMgdG9vIGNvbXBsZXggYW5kIHNob3VsZCBiZSBzcGxpdCB1cFxuICAgICAgICAgKiBpbiB0aGUgZnV0dXJlIHdlIHdlbGwgZGV0ZXJtaW5lIGlmIHNlY3Rpb24gc3dpdGNoIGlzIGhhbmRsZWQgYnkgdGhlIHRlYWNoZXIgb3IgYnkgdGhlIHN0dWRlbnQgYW5kIGFjdCBhY2NvcmRpbmdseVxuICAgICAgICAgKiBpZiBoYW5kbGVkIGJ5IHN0dWRlbnQgdGhlIHRlYWNoZXIgc3R0dHVzIGlzIGlnbm9yZWQgYW5kIHRoZSBzd2ljaCBzZWN0aW9uIGZ1bmN0aW9uIGlzIGNhbGxlZCBkaXJlY3RseSAocHJvYmFibHkgbW92ZSB0byBpcGNoYW5kbGVyLmpzKVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBpZiBzdHVkZW50IGlzIGluIGxvY2tlZCBzdGF0ZSBpbiBleGFtIG1vZGVcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIGN1cnJlbnQgYWN0aXZlIHNlY3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgc2VydmVyc3RhdHVzIC0gaWYgbm90IGNoYW5nZSB0byB0aGUgbmV3IHNlY3Rpb25cbiAgICAgICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbiAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2hhbmdpbmcgc2VjdGlvbiB0byAke3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9ufSAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lfSAsIEV4YW10eXBlOiAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlfWAgKVxuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRMb2NrZWRTZWN0aW9uID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uOyAvLyBDdXJyZW50IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIHNhdmluZylcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb247IC8vIE5ldyBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBsb2FkaW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1EaXIgPSB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5O1xuXG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgYWxsIGZpbGVzIGZyb20gdGhlIG9sZCBzZWN0aW9uIChpZiBleGFtIG1vZGUgaXMgXCJlZGl0b3JcIikgYW5kIHNlbmQgdG8gdGVhY2hlciAtIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPT09IFwiZWRpdG9yXCIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHNlbmRpbmcgZXhhbSB0byB0ZWFjaGVyIChmaW5hbCBzdWJtaXQpXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCBjdXJyZW50IHdvcmsgYXMgYmFzZTY0IHRvIHRlYWNoZXIgKHN0b3JlcyBwZGYgaW4gQUJHQUJFIGZvbGRlciB3aXRoIHN1Ym1pc3Npb24gbnVtYmVyKVxuICAgICAgICAgICAgICAgICAgICBsZXQgcGRmID0gYXdhaXQgdGhpcy5nZXRCYXNlNjRQREYodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2N1cnJlbnRMb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZSkgIC8vIGxvY2FsIGZ1bmN0aW9uIHRvIGdldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChwZGYuc3RhdHVzID09PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRCYXNlNjRQREZ0b1RlYWNoZXIocGRmLmJhc2U2NHBkZiwgY3VycmVudExvY2tlZFNlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgLy9iYWNrdXAgbG9jYWwgZmlsZXMgYW5kIHNlbmQgdG8gdGVhY2hlciAoYXJjaGl2ZSB3aXRoIHRpbWVzdGFtcClcblxuXG4gICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAvL3dhaXQgMSBzZWNvbmQgYW5kIGNsZWFudXAgTkVYVC1FWEFNLVNUVURFTlQtV09SS0RJUlxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMClcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBleGFtdHlwZSBpbiBjbGllbnRpbmZvXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NrZWQgc2VjdGlvbiBBRlRFUiBzYXZpbmcgdGhlIG9sZCBzdGF0ZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IG5ld0xvY2tlZFNlY3Rpb247XG5cblxuXG4gICAgICAgICAgICAgICAgLy8gTU9WRSBTZWN0aW9uIEZpbGVzIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAxOiBTQVZFIENVUlJFTlQgRVhBTURJUiBGSUxFUyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGV4YW1EaXIpICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkgeyAvLyBDaGVjayBpZiBtYWluIGRpciBleGlzdHMgYW5kIGEgc2VjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2aW5nIGNvbnRlbnQgZnJvbSBleGFtRGlyIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVQYXRoID0gYCR7ZXhhbURpcn0vJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNhdmVQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhzYXZlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IC8vIENyZWF0ZSBzYXZlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGV4YW1EaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXMubGVuZ3RofSBpdGVtcyBpbiBleGFtRGlyIHRvIHNhdmVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzU2F2ZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhvbGRQYXRoKTsgLy8gR2V0IGZpbGUgc3RhdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgYWN0dWFsIEZJTEVTLCBub3QgZGlyZWN0b3JpZXMgKGxpa2UgdGhlIHNlY3Rpb24gZm9sZGVycyB0aGVtc2VsdmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtzYXZlUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhvbGRQYXRoLCBuZXdQYXRoKTsgLy8gQ29weSBmaWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkUGF0aCk7IC8vIERlbGV0ZSBvcmlnaW5hbCBmaWxlIGZyb20gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc1NhdmVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZlZCBmaWxlICR7ZmlsZX0gdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSAoZm9sZGVyKSBpdGVtICR7ZmlsZX0gaW4gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgc2F2ZWQgJHtmaWxlc1NhdmVkfSBmaWxlcyB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgc2F2ZSAtIGV4YW1EaXIgZXhpc3RzOiAke2ZzLmV4aXN0c1N5bmMoZXhhbURpcil9LCBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDI6IExPQUQgRklMRVMgZnJvbSB0aGUgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBORVcgbG9ja2VkIHNlY3Rpb24gdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIG5ld0xvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBMb2FkaW5nIGNvbnRlbnQgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9hZFBhdGggPSBgJHtleGFtRGlyfS8ke25ld0xvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvYWRQYXRoKSkgeyAvLyBDaGVjayBpZiB0aGUgbmV3IHNlY3Rpb24gZm9sZGVyIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0gZnMucmVhZGRpclN5bmMobG9hZFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzVG9Mb2FkLmxlbmd0aH0gaXRlbXMgaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc0NvcGllZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzVG9Mb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVBhdGggPSBgJHtsb2FkUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7IC8vIEVuc3VyZSBvbmx5IGZpbGVzIGFyZSBjb3BpZWQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNvdXJjZVBhdGgsIGRlc3RQYXRoKTsgLy8gQ29weSBmaWxlIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29waWVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ29waWVkIGZpbGUgJHtmaWxlfSBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgaXRlbSAke2ZpbGV9IGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IGNvcGllZCAke2ZpbGVzQ29waWVkfSBmaWxlcyBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTmV3IGxvY2tlZCBzZWN0aW9uIGRpcmVjdG9yeSAke25ld0xvY2tlZFNlY3Rpb259IGRvZXMgbm90IGV4aXN0LiBTdGFydGluZyB3aXRoIGEgY2xlYW4gc3RhdGUuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogbmV3TG9ja2VkU2VjdGlvbiBpcyBmYWxzeSAoJHtuZXdMb2NrZWRTZWN0aW9ufSksIHNraXBwaW5nIGZpbGUgbG9hZGApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBkdXJpbmcgZm9sZGVyIG9wZXJhdGlvbiAtICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3Igc3RhY2s6ICR7ZXJyb3Iuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259LCBuZXdMb2NrZWRTZWN0aW9uOiAke25ld0xvY2tlZFNlY3Rpb259LCBleGFtRGlyOiAke2V4YW1EaXJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICogIEFjdHVhbGx5IFNXSVRDSCBFWEFNIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IG9yIHJlbGVhZCB0aGUgbmV3IGV4YW0gc2VjdGlvbiBpbiB0aGUgc2FtZSB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3cgLSBpZiB5b3UgZG9uJ3QgbmV4dC1leGFtIHdpbGwgY3Jhc2ggc2lsZW50bHkgb24gcmVsb2FkIGFuZCBzZWN0aW9uIHN3aXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpLmZvckVhY2god2MgPT4geyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzd2l0Y2hFeGFtU2VjdGlvbjogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgYW5kIHJlb3BlbiBpdCB3aXRoIHRoZSBuZXcgZXhhbSBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cub25jZSgnY2xvc2VkJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBFTkRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgIFxuXG5cbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2spIHsgIHRoaXMuYWN0aXZhdGVTY3JlZW5sb2NrKCkgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgKSB7IHRoaXMua2lsbFNjcmVlbmxvY2soKSB9XG5cbiAgICAgICAgLy8gc2NyZWVuc2hvdCBzYWZldHkgKE9DUiBzZWFyY2hlcyBmb3IgbmV4dC1leGFtIHN0cmluZylcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyKSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IHRydWUgIH1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IGZhbHNlICAgfVxuXG4gICAgICAgIC8vIEdyb3VwcyBoYW5kbGluZ1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZ3JvdXBzKXsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSB0cnVlfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSBmYWxzZX1cblxuICAgICAgICAvL3VwZGF0ZSBzY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgfHwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PT0gMCkgeyAvLzAgaXMgdGhlIHNhbWUgYXMgZmFsc2Ugb3IgdW5kZWZpbmVkIGJ1dCBzaG91bGQgYmUgdHJlYXRlZCBhcyBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsICE9PSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDAgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgY2hhbmdlZCB0b1wiLCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDApXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDBcbiAgICAgICAgICAgICAgICAgIGlmICggc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGRpc2FibGVkIVwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBvbGQgaW50ZXJ2YWwgYW5kIHN0YXJ0IG5ldyBpbnRlcnZhbCBpZiBzZXQgdG8gc29tZXRoaW5nIGJpZ2dlciB0aGFuIHplcm9cbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID4gMCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5pbnRlcnZhbCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAvLyByZW1vdmUgbG9ja3NjcmVlbiBpbW1lZGlhdGVseSAtIGRvbid0IHdhaXQgZm9yIHNlcnZlciBpbmZvXG4gICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSBcbiAgICAgICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIHNlbmQgYmFzZTY0IHBkZiB0byB0ZWFjaGVyXG4gICAgc2VuZEJhc2U2NFBERnRvVGVhY2hlcihiYXNlNjRwZGYsIHNlY3Rpb249MSl7XG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wcmludHJlcXVlc3QvJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn1gO1xuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGJhc2U2NHBkZixcbiAgICAgICAgICAgIHByaW50cmVxdWVzdDogZmFsc2UsICAgIFxuICAgICAgICAgICAgc3VibWlzc2lvbm51bWJlcjogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLFxuICAgICAgICAgICAgbG9ja2Vkc2VjdGlvbjogc2VjdGlvblxuICAgICAgICB9XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHsgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTsgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZSA9PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyKysgICAvLyBzdWNjZXNzZnVsIHN1Ym1pc3Npb24gLT4gaW5jcmVtZW50IG51bWJlclxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4geyAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImVkaXRvciBAIHByaW50YmFzZTY0OlwiLGVycm9yLm1lc3NhZ2UpICAgIFxuICAgICAgICB9KTsgXG4gICAgfVxuICAgIFxuXG5cblxuICAgIC8vZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAvLyBBVFRFTlRJT046IHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gaXBjaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCBzdG9yZXMgaXQgYXMgZmlsZSBpbiB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICBhc3luYyBnZXRCYXNlNjRQREYoc3VibWlzc2lvbm51bWJlciwgc2VjdGlvbm5hbWUsIHByaW50QmFja2dyb3VuZD1mYWxzZSl7XG4gICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgIFxuICAgICAgICAvLyBXYWl0IGZvciBhbnkgb25nb2luZyBwcmludCBvcGVyYXRpb24gdG8gZmluaXNoIChtYXggMzAgc2Vjb25kcylcbiAgICAgICAgbGV0IHdhaXRDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFdhaXQgPSAzMDA7IC8vIDMwIHNlY29uZHMgd2l0aCAxMDBtcyBpbnRlcnZhbHNcbiAgICAgICAgd2hpbGUgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiAmJiB3YWl0Q291bnQgPCBtYXhXYWl0KSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMCk7XG4gICAgICAgICAgICB3YWl0Q291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IHByaW50VG9QREYgbG9jayB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgc3RpbGwgcnVubmluZ1wiKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJQREYgZ2VuZXJhdGlvbiB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgaW4gcHJvZ3Jlc3NcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogcHJpbnRCYWNrZ3JvdW5kLFxuICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG5cbiAgXG4gICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7c2VjdGlvbm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDtBYmdhYmU6ICR7c3VibWlzc2lvbm51bWJlcn08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0gLSBWZXJzaW9uICR7c3VibWlzc2lvbm51bWJlcn1cImApO1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0IGxvY2sgYmVmb3JlIHN0YXJ0aW5nIFBERiBnZW5lcmF0aW9uXG4gICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0cGRmID0gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2Jhc2U2NHBkZn1gO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwiUERGIGdlbmVyYXRlZFwiLCBkYXRhVXJsOmRhdGFVcmwsIGJhc2U2NHBkZjogYmFzZTY0cGRmLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogRXJyb3IgZ2VuZXJhdGluZyBQREY6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcnJvciBnZW5lcmF0aW5nIFBERlwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gQWx3YXlzIHJlbGVhc2UgdGhlIGxvY2ssIGV2ZW4gaWYgYW4gZXJyb3Igb2NjdXJyZWRcbiAgICAgICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2hvdyB0ZW1wb3Jhcnkgc2NyZWVubG9jayB3aW5kb3dcbiAgICBhY3RpdmF0ZVNjcmVlbmxvY2soKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuICAgICAgIFxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPT0gMCl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gdHJ1ZVxuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpICAvLyBhZGQgc2NyZWVubG9jayB3aW5kb3dzIGZvciBhZGRpdGlvbmFsIGRpc3BsYXlzXG4gICAgICAgICAgICB9IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIHRlbXBvcmFyeSBzY3JlZW5sb2Nrd2luZG93XG4gICAga2lsbFNjcmVlbmxvY2soKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbmxvY2t3aW5kb3cgJiYgIXNjcmVlbmxvY2t3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWxsU2NyZWVubG9jazogbm8gZnVuY3Rpb25hbCBzY3JlZW5sb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICB9IFxuICAgICAgICAvLyBDbGVhciBhcnJheSBjb21wbGV0ZWx5IGFmdGVyIGF0dGVtcHRpbmcgdG8gZGVzdHJveSBhbGwgd2luZG93c1xuICAgICAgICAvLyBUaGUgY2xvc2VkIGV2ZW50IGhhbmRsZXIgd2lsbCBhbHNvIGNsZWFuIHVwLCBidXQgdGhpcyBlbnN1cmVzIHRoZSBhcnJheSBpcyBlbXB0eVxuICAgICAgICBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gZmFsc2VcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0cyBleGFtIG1vZGUgZm9yIHN0dWRlbnRcbiAgICAgKiBkZWxldGVzIHdvcmtmb2xkZXIgY29udGVudHMgKGlmIHNldClcbiAgICAgKiBvcGVucyBhIG5ldyB3aW5kb3cgaW4ga2lvc2sgbW9kZSB3aXRoIHRoZSBnaXZlbiBleGFtdHlwZVxuICAgICAqIGVuYWJsZXMgdGhlIGJsdXIgbGlzdGVuZXIgYW5kIGFjdGl2YXRlcyByZXN0cmljdGlvbnMgKGRpc2FibGUga2V5Ym9hcnNob3J0Y3V0cyBldGMuKVxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgZXhhbW1vZGUsIGV4YW10eXBlLCBhbmQgb3RoZXIgc2V0dGluZ3MgZnJvbSB0aGUgdGVhY2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgZGlhbG9nIGlzIG9wZW4gYW5kIGxvZyB3YXJuaW5nXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4aXRXYXJuaW5nT3BlbiB8fCBXaW5kb3dIYW5kbGVyLmV4aXRRdWVzdGlvbk9wZW4gfHwgV2luZG93SGFuZGxlci5taW5pbWl6ZVdhcm5pbmdPcGVuKSB7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBEaWFsb2cgaXMgc3RpbGwgb3BlbiAtIGV4YW0gd2lsbCBzdGFydCBhbnl3YXlcIilcbiAgICAgICAgfVxuICBcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgIFxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uY21hcmdpbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmNtYXJnaW4gIC8vIHRoaXMgaXMgdXNlZCB0byBjb25maWd1cmUgbWFyZ2luIHNldHRpbmdzIGZvciB0aGUgZWRpdG9yXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubGluZXNwYWNpbmcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5saW5lc3BhY2luZyAvLyB3ZSB0cnkgdG8gZG91YmxlIGxpbmVzcGFjaW5nIG9uIGRlbWFuZCBpbiBwZGYgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5hdWRpb1JlcGVhdCA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmF1ZGlvUmVwZWF0IC8vIHJlc3RyaWN0IHJlcGV0aXRpb24gb2YgYXVkaW8gZmlsZXMgKGZvciBsaXN0ZW5pbmcgY29tcHJlaGVuc2lvbilcblxuICAgICAgICBpZiAoIVdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogY3JlYXRpbmcgZXhhbSB3aW5kb3dcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVFeGFtV2luZG93KHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3JlY29ubmVjdCBpbnRvIGFjdGl2ZSBleGFtIHNlc3Npb24gd2l0aCBleGFtIHdpbmRvdyBhbHJlYWR5IG9wZW5cbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBmb3VuZCBleGlzdGluZyBFeGFtd2luZG93Li5cIilcbiAgICAgICAgICAgIHRyeSB7ICAvLyBzd2l0Y2ggZXhpc3Rpbmcgd2luZG93IGJhY2sgdG8gZXhhbSBtb2RlXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKSBcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0RnVsbFNjcmVlbih0cnVlKSAgLy9nbyBmdWxsc2NyZWVuIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSAgLy9tYWtlIHN1cmUgdGhlIHdpbmRvdyBpcyAxIGxldmVsIGFib3ZlIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMCkgLy8gd2FpdCBhbiBhZGRpdGlvbmFsIDIgc2VjIGZvciB3aW5kb3dzIHJlc3RyaWN0aW9ucyB0byBraWNrIGluICh0aGV5IHN0ZWFsIGZvY3VzKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmFkZEJsdXJMaXN0ZW5lcigpO1xuICAgICAgICAgICAgICAgICAgICAvLyBGb3IgcmVjb25uZWN0OiBpbml0aWFsaXplIGJsb2NrIHdpbmRvd3MgYWZ0ZXIgd2luZG93IGlzIHJlcG9zaXRpb25lZFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IC8vZXhhbXdpbmRvdyB2YXJpYWJsZSBpcyBzdGlsbCBzZXQgYnV0IHRoZSB3aW5kb3cgaXMgbm90IG1hbmFnYWJsZSBhbnltb3JlIChtYW51YWxseSBjbG9zZWQgaW4gZGV2IG1vZGU/KVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBubyBmdW5jdGlvbmFsIGV4YW13aW5kb3cgZm91bmQuLiByZXNldHRpbmdcIilcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgIC8vZXhhbXdpbmRvdyBpcyBnaXZlbiBidXQgbm90IHVzZWQgaW4gZGlzYWJsZVJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gIC8vIGluIHRoYXQgY2FzZS4uIHdlIGFyZSBmaW5pc2hlZCBoZXJlICFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBOb3RlOiBGb3IgbmV3IGV4YW0gd2luZG93cywgaW5pdEJsb2NrV2luZG93cygpIGlzIGNhbGxlZCBpbiBkaWQtZmluaXNoLWxvYWQgaGFuZGxlclxuICAgICAgICAvLyB0byBlbnN1cmUgd2luZG93IGlzIGZ1bGx5IHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgRXhhbSBtb2RlXG4gICAgICogY2xvc2VzIGV4YW0gd2luZG93XG4gICAgICogZGlzYWJsZXMgcmVzdHJpY3Rpb25zIGFuZCBibHVyIFxuICAgICAqL1xuICAgIGFzeW5jIGVuZEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgXG4gICAgICAgIFdpbmRvd0hhbmRsZXIucmVtb3ZlQmx1ckxpc3RlbmVyKCk7XG4gICAgICBcbiAgICAgICAgLy9vbmx5IGRpc2FibGUgcmVzdHJpY3Rpb25zIGlmIG5vdCBpbiBleGFtIG1vZGUgKCBzZXJpb3N1bHkuLiBob3cgY291bGQgdGhpcyBldmVyIGhhcHBlbj8gKVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIHN0dWRlbnRzIHdvcmsgb24gc3R1ZGVudHMgcGMgKG1ha2VzIHNlbnNlIGlmIGV4YW0gaXMgd3JpdHRlbiBvbiBzY2hvb2wgcHJvcGVydHkpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMgJiYgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyIG9uIGV4aXRcIilcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogXCIsZXJyb3IpOyB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAvLyBpbiBzb21lIGVkZ2UgY2FzZXMgaW4gZGV2ZWxvcG1lbnQgdGhpcyBpcyBzZXQgYnV0IHN0aWxsIHVudXNhYmxlIC0gdXNlIHRyeS9jYXRjaCAgIFxuICAgICAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgdGhpcy5jb25maWcuc2hvd2RldnRvb2xzKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsV2ViQ29udGVudHMgPSB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgd2Mgb2YgYWxsV2ViQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgd2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFdhaXQgZm9yIGFsbCBEZXZUb29scyB0byBiZSBjbG9zZWQgYmVmb3JlIGNsb3NpbmcgdGhlIGV4YW0gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGFsbCBjbG9zZURldlRvb2xzKCkgY2FsbHMgYXJlIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhbHdheXMgdHJ5IHRvIGNsb3NlIHRoZSBleGFtIHdpbmRvdyBzYWZlbHkgYWZ0ZXIgZGV2dG9vbHMgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06ICcsZSl9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBibG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBubyBmdW5jdGlvbmFsIGJsb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH1cbiAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICBcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGxhbmd1YWdlVG9vbFNlcnZlci5sYW5ndWFnZVRvb2xQcm9jZXNzKXtcbiAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdG9wU2VydmVyKCk7IC8vIEtpbGwgTGFuZ3VhZ2VUb29sIHNlcnZlciB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICB9XG4gICAgICAgIC8vIGFzayBzdHVkZW50IHRvIHF1aXQgYXBwIGFmdGVyIGZpbmlzaGluZyBleGFtXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuc2hvd0V4aXRRdWVzdGlvbigpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIGV4YW13aW5kb3cgb25seSB3aGVuIG5vIHByaW50VG9QREYgb3BlcmF0aW9uIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBjbG9zZUV4YW1XaW5kb3dTYWZlbHkoKXtcbiAgICAgICAgY29uc3QgZXhhbVdpbiA9IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICBpZiAoIWV4YW1XaW4peyByZXR1cm4gfVxuXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogcHJpbnRUb1BERiBpbiBwcm9ncmVzcyAtIHJldHJ5IGluIDFzXCIpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKSB9LCAxMDAwKSAvLyByZXRyeSB1bnRpbCBwcmludGluZyBpcyBmaW5pc2hlZFxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFleGFtV2luLmlzRGVzdHJveWVkPy4oKSl7XG4gICAgICAgICAgICAgICAgZXhhbVdpbi5jbG9zZSgpIC8vIG5vcm1hbCBjbG9zZSwgb24oJ2Nsb3NlJykgaGFuZGxlciBkb2VzIHRoZSByZXN0XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IGVycm9yIHdoaWxlIGNsb3NpbmcgZXhhbXdpbmRvd1wiLCBlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIG1hbnVhbGx5IHRyaWdnZXJlZCBpZiBjb25uZWN0aW9uIGlzIGxvc3QgZHVyaW5nIGV4YW0gLSB3ZSBhbGxvdyB0aGUgc3R1ZGVudCB0byBnZXQgb3V0IG9mIHRoZSBraW9zayBtb2RlIFxuICAgIC8vIElORk86IHRoaXMgaXMgYmFzaWNhbGx5IHJlZHVuZGFudCBcbiAgICBhc3luYyBncmFjZWZ1bGx5RW5kRXhhbSgpe1xuICAgICAgICB0aGlzLmVuZEV4YW0oKVxuICAgIH1cblxuICAgIC8vIHJlc2V0IGFsbCB2YXJpYWJsZXMgdGhhdCBzaWduYWwgb3IgbmVlZCBhIHZhbGlkIHRlYWNoZXIgY29ubmVjdGlvblxuICAgIHJlc2V0Q29ubmVjdGlvbigpe1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gd2UgYXJlIGZvY3VzZWQgXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlICAgLy8gZG8gbm90IHNldCB0byBmYWxzZSB1bnRpbCBleGFtIHdpbmRvdyBpcyBhY3R1YWxseSBjbG9zZWQgICh0aGlzIGlzIGRvbmUgaW4gZW5kRXhhbSgpKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRpbWVzdGFtcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IGZhbHNlICAvLyB0aGlzIGNoZWNrIGhhcHBlbnMgb25seSBhdCB0aGUgYXBwbGljYXRpb24gc3RhcnQuLiBkbyBub3QgcmVzZXQgb25jZSBzZXRcbiAgICB9XG4gXG5cblxuXG4gICAgLyoqXG4gICAgICogZGllc2UgbWV0aG9kZSBob2x0IHNpY2gsIGRpZSB2b20gdGVhY2hlciB6dW0gZG93bmxvYWQgYmVyZWl0Z2VsZWd0ZW4gZGF0ZWllblxuICAgICAqIFx1MDBGQ2JlciBkYXMgdXBkYXRlIGludGVydmFsIHdpcmQgZGVyIHRyaWdnZXIgenVtIGRvd25sb2FkIHVuZCBkaWUgZmlsZWxpc3QgZXJoYWx0ZW5cbiAgICAgKiBAcGFyYW0geyp9IGZpbGVzIFxuICAgICAqL1xuICAgIHJlcXVlc3RGaWxlRnJvbVNlcnZlcihmaWxlcyl7XG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgYmFja3VwZmlsZSA9IGZhbHNlXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKGZpbGUubmFtZSAmJiBmaWxlLm5hbWUuaW5jbHVkZXMoJ2JhaycpKXsgICAvLyB0aGlzIHdpbGwgYWx3YXlzIHNldCB0aGUgbGFzdCBiYWsgZmlsZSBhcyBiYWNrdXAgZmlsZSBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGJhayBmaWxlXG4gICAgICAgICAgICAgICAgYmFja3VwZmlsZSA9IGZpbGUubmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuXG4gICAgICAgIC8vIERhdGVuIGZcdTAwRkNyIGRlbiBQT1NULVJlcXVlc3Qgdm9yYmVyZWl0ZW5cbiAgICAgICAgbGV0IGRhdGEgPSBKU09OLnN0cmluZ2lmeSh7ICdmaWxlcyc6IGZpbGVzLCAndHlwZSc6ICdzdHVkZW50ZmlsZXJlcXVlc3QnIH0pO1xuXG4gICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2Rvd25sb2FkLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogZGF0YSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHRva2VuLmNvbmNhdCgnLnppcCcpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVwYXRoLCBCdWZmZXIuZnJvbShidWZmZXIpLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoZXJyKTsgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3QoYWJzb2x1dGVGaWxlcGF0aCwgeyBkaXI6IHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkgfSkgXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IGZpbGVzIHJlY2VpdmVkIGFuZCBleHRyYWN0ZWRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyAvLyBWZXJ3ZW5kdW5nIGRlciBQcm9taXNlLWJhc2llcnRlbiBBUEkgdm9uIGZzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWNrdXBmaWxlICYmIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiYWNrdXAnLCBiYWNrdXBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBUcmlnZ2VyIFJlcGxhY2UgRXZlbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYENvbW11bmljYXRpb25IYW5kbGVyIC0gcmVxdWVzdEZpbGVGcm9tU2VydmVyOiAke2Vycn1gKSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgc2VuZEV4YW1Ub1RlYWNoZXIoKXtcbiAgICAgICAgLy9zZW5kIHNhdmUgdHJpZ2dlciB0byBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vdGhlcmUgaXMgYSBydW5uaW5nIGV4YW0gLSBzYXZlIGN1cnJlbnQgd29yayBmaXJzdCFcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ3NhdmUnLCd0ZWFjaGVycmVxdWVzdCcpICAgLy90cmlnZ2VyLCB3aHkgICh0ZWFjaGVycmVxdWVzdCB3aWxsIGFsc28gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKCkgYnV0IG9ubHkgYWZ0ZXIgc2F2aW5nIHRoZSBwZGYgaXMgY29tcGxldGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpeyBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYENvbW11bmljYXRpb24gaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiBDb3VsZCBub3Qgc2F2ZSBzdHVkZW50cyB3b3JrLiBJcyBleGFtbW9kZSBhY3RpdmU/YClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgIC8vIG5vdCBydW5uaW5nIGV4YW0gKHByb2JhYmx5IHVzaW5nIG5leHQtZXhhbSBhcyBjbGFzc3Jvb21tYW5hZ21lbnQgdG9vbClcbiAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpICAgLy96aXAgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXIgYXBpXG4gICAgICAgIH1cblxuICAgICB9XG5cblxuICAgICAgLy96aXAgY29uZmlnLndvcmsgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXJcbiAgICAgYXN5bmMgc2VuZFRvVGVhY2hlcigpe1xuICAgICAgICB0cnkgeyBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSk7IH1cbiAgICAgICAgfWNhdGNoIChlKXsgbG9nLmVycm9yKGUpfVxuXG4gICAgICAgIC8vICB0aGlzIGlzIHRoZSBsb2dmaWxlIHBhdGggdHJ5IHRvIGNvcHkgdGhlIGxvZ2ZpbGUgdG8gdGhlIGV4YW1kaXJlY3RvcnkgYmVmb3JlIG1ha2luZyB0aGUgemlwIGZpbGVcbiAgICAgICAgbGV0IGxvZ2ZpbGVwYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGU7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvZ2ZpbGVwYXRoKSl7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhsb2dmaWxlcGF0aCwgam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJykpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kVG9UZWFjaGVyOiBjb3VsZCBub3QgY29weSBsb2dmaWxlIHRvIGV4YW1kaXJlY3RvcnknKTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHppcGZpbGVuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lLmNvbmNhdCgnLnppcCcpXG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgXG5cbiAgICAgICAgbGV0IGJhc2U2NEZpbGUgPSBudWxsXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnppcERpcmVjdG9yeSh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB6aXBmaWxlcGF0aClcbiAgICAgICAgICAgIGNvbnN0IGZpbGVDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHppcGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGJhc2U2NEZpbGUgPSBmaWxlQ29udGVudC50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgIH1jYXRjaCAoZSl7ICBsb2cuZXJyb3IoZSkgIH1cblxuICAgICAgICAvLyBzZW5kaW5nIHRoZSB3aG9sZSBkaXJlY3RvcnkgYXMgemlwIGZpbGUgYmFzZTY0ZW5jb2RlZCB2aWEgSlNPTiBpc24ndCBwcm9iYWJseSB0aGUgYmVzdCBtZXRob2QgYnV0IGl0IHdvcmtzIHdoaWxlIGFsbCBmb3JtRGF0YSBhcHByb2FjaGVzIGZhaWxlZCB3aXRoXG4gICAgICAgIC8vIGZldGNoKCkgd2hpbGUgdGhleSB3b3JrZWQgd2l0aCBheCBpb3MoKSAtIG5vdCBldmVuIGNoYXRncHQgb3Igc3RhY2tvdmVyZmxvdyBjb3VsZCBoZWxwIF5eIGkgdGhpbmsgaXQgaXMgcmVsYXRlZCB0byB0aGUgc3BlY2lmaWMgZm9ybURhdGEgbW9kdWxlIHRoYXQgY2FudCBiZSBpbXBvcnRlZCB3aXRob3V0IFwid2luZG93IGVycm9yXCJcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9yZWNlaXZlLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gO1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGZpbGU6IGJhc2U2NEZpbGUsIGZpbGVuYW1lOiB6aXBmaWxlbmFtZSB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgICAgICAudGhlbihkYXRhID0+IHsgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IHRlYWNoZXIgcmVzcG9uc2U6ICR7ZGF0YS5tZXNzYWdlfWApOyB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge2xvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogJHtlcnJvcn1gKTsgfSk7XG4gICAgIH1cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gb3V0UGF0aDogL3BhdGgvdG8vY3JlYXRlZC56aXBcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB6aXBEaXJlY3Rvcnkoc291cmNlRGlyLCBvdXRQYXRoKSB7XG4gICAgICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcignemlwJywgeyB6bGliOiB7IGxldmVsOiA5IH19KTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGFyY2hpdmVcbiAgICAgICAgICAgIC5kaXJlY3Rvcnkoc291cmNlRGlyLCBmYWxzZSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXG4gICAgICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICAgIDtcbiAgICAgICAgc3RyZWFtLm9uKCdjbG9zZScsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICAgICAgfSkuY2F0Y2goIGVycm9yID0+IHsgbG9nLmVycm9yKGVycm9yKX0pO1xuICAgIH1cblxuXG5cblxuXG5cbiAgICAvLyB0aW1lb3V0IFxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICBcbiB9XG4gXG4gZXhwb3J0IGRlZmF1bHQgbmV3IENvbW1IYW5kbGVyKClcbiBcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgbmV0IGZyb20gJ25ldCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7dH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0e2lwY01haW4sIGNsaXBib2FyZCxhcHAsIHdlYkNvbnRlbnRzfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IG1hbW1vdGggZnJvbSAnbWFtbW90aCc7XG5cbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXInO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi90cmF5bWVudS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOZXR3b3JrT3JSZXNldCB9IGZyb20gJy4vdGVzdHBlcm1pc3Npb25zTWFjLmpzJztcbmltcG9ydCB7IGdldFdsYW5JbmZvIH0gZnJvbSAnLi9nZXR3bGFuaW5mby5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbnN0IGNoZWNrUG9ydE9wZW4gPSAocG9ydCwgaG9zdCA9ICcxMjcuMC4wLjEnLCB0aW1lb3V0ID0gMTUwMCkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgICAgICBjb25zdCBmaW5pc2ggPSAocnVubmluZywgZXJyb3IgPSBudWxsKSA9PiB7XG4gICAgICAgICAgICBzb2NrZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSh7IHJ1bm5pbmcsIHBvcnQsIGhvc3QsIGVycm9yIH0pO1xuICAgICAgICB9O1xuICAgICAgICBzb2NrZXQuc2V0VGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Nvbm5lY3QnLCAoKSA9PiBmaW5pc2godHJ1ZSkpO1xuICAgICAgICBzb2NrZXQub25jZSgndGltZW91dCcsICgpID0+IGZpbmlzaChmYWxzZSwgJ3RpbWVvdXQnKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdlcnJvcicsIChlcnIpID0+IGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KHBvcnQsIGhvc3QpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gSVBDIGhhbmRsaW5nIChCYWNrZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2UgLy8gZmxhZyB0byBwcmV2ZW50IGNsb3Npbmcgd2luZG93IHdoaWxlIHByaW50aW5nXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG4gICAgICAgIFxuXG4gICAgICAgIGlwY01haW4ub24oJ3NldC1uZXctbG9jYWxlJywgKGV2ZW50LCBsb2NhbGUpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2V0LW5ldy1sb2NhbGU6IHNldHRpbmcgbmV3IGxvY2FsZSB0byAke2xvY2FsZX1gKVxuICAgICAgICAgICAgaTE4bi5sb2NhbGUgPSBsb2NhbGVcbiAgICAgICAgICAgIHVwZGF0ZVN5c3RlbVRyYXkoaTE4bi5sb2NhbGUpO1xuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEV4YW1NYXRlcmlhbHMnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICBcbiAgICAgICAgICAgIGxldCBjbGllbnRpbmZvID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb1xuICAgICAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJpcCA9IGNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgICAgIGxldCB0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHsgXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGNsaWVudGluZm8uZ3JvdXAsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBleGFtTWF0ZXJpYWxzID0gZmFsc2VcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgICAgICAgICBleGFtTWF0ZXJpYWxzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9nZXRleGFtbWF0ZXJpYWxzLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogcmVjZWl2ZWQgZGF0YVwiLCBkYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiAke2Vycn1gKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4YW1NYXRlcmlhbHNcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgIFxuICAgICAgICB9KSBcblxuICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGNvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgZXhhbSBtb2RlcylcbiAgICAgICAgY29uc3QgY2hlY2tDb21tb25FeGNlcHRpb25zID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIk1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiR29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50c1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGUuY29tXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJteXNpZ25pbnNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIndpbmRvd3NhenVyZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb29rdXBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJiaWxkdW5nLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTaGliYm9sZXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJpZC1hdXN0cmlhLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhIYW5kbGVyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImV1LW1vYmlsZS5ldmVudHMuZGF0YVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImdzdGF0aWMuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJsaXZlLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGVzeW5kaWNhdGlvbi5jb21cIikpIHJldHVybiB0cnVlOyBcblxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIGFsbG93ZWRVcmxzIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRW50ZmVybmUgYWx0ZSBMaXN0ZW5lciwgdW0gRG9wcGVsLVJlZ2lzdHJpZXJ1bmdlbiB6dSB2ZXJtZWlkZW5cbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYWxsb3cgPSBhbGxvd2VkVXJscy5tYXAocyA9PiBTdHJpbmcocykudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBpZiBVUkwgbWF0Y2hlcyBhbGxvd2VkIGRvbWFpbiAoc3VwcG9ydHMgc3ViZG9tYWlucyBhbmQgcGF0aHMpXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxTdHIgPSBTdHJpbmcodGFyZ2V0VXJsKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGNvbW1vbiBleGNlcHRpb25zIGZpcnN0XG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrQ29tbW9uRXhjZXB0aW9ucyh1cmxTdHIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBlYWNoIGFsbG93ZWQgVVJMXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBhbGxvd2VkVXJsIG9mIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gcGFyc2UgYXMgVVJMIHRvIGV4dHJhY3QgaG9zdG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybE9iaiA9IG5ldyBVUkwodGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEhvc3RuYW1lID0gdXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnNlIGFsbG93ZWQgVVJMIHRvIGV4dHJhY3QgZG9tYWluXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmw7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dlZFVybE9iaiA9IG5ldyBVUkwoYWxsb3dlZFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmxPYmouaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsb3dlZFVybC5pbmNsdWRlcygnLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQncyBhIHBhdGggd2l0aG91dCBwcm90b2NvbCwgZXh0cmFjdCBkb21haW4gcGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gYWxsb3dlZFVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFeGFjdCBtYXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWxsb3dlZERvbWFpbiBpcyBhIHNwZWNpZmljIHN1YmRvbWFpbiAoY29udGFpbnMgZG90cylcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzU3BlY2lmaWNTdWJkb21haW4gPSBhbGxvd2VkRG9tYWluLmluY2x1ZGVzKCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1NwZWNpZmljU3ViZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBzcGVjaWZpYyBzdWJkb21haW4gaXMgc3BlY2lmaWVkLCBvbmx5IGFsbG93IHRoYXQgZXhhY3Qgc3ViZG9tYWluIGFuZCB3d3cuIHZhcmlhbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGFsbG93IG90aGVyIHN1YmRvbWFpbnMgd2hlbiBhIHNwZWNpZmljIG9uZSBpcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgb25seSBiYXNlIGRvbWFpbiBpcyBzcGVjaWZpZWQgKGUuZy4sIFwib3JmLmF0XCIpLCBhbGxvdyBhbGwgc3ViZG9tYWluc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IHd3dy4gc3ViZG9tYWluIGV4cGxpY2l0bHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IG90aGVyIHN1YmRvbWFpbnMgKGUuZy4sIHN1Yi5kdWRlbi5kZSBpZiBkdWRlbi5kZSBpcyBhbGxvd2VkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZS5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSB0YXJnZXRIb3N0bmFtZS5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBwcmVmaXg6IG11c3QgYmUgdmFsaWQgc3ViZG9tYWluIG5hbWUgKGFscGhhbnVtZXJpYyBhbmQgaHlwaGVucylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBVUkwgcGFyc2luZyBmYWlscywgZmFsbCBiYWNrIHRvIHNpbXBsZSBpbmNsdWRlcyBjaGVjayBmb3IgcGF0aHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cmxTdHIuaW5jbHVkZXMoYWxsb3dlZFVybCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzQWxsb3dlZCkgeyBcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGFsbG93ZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVW5pZmllZCBJUEMgaGFuZGxlciBmb3Igd2VidmlldyBibG9ja2luZyAtIHN1cHBvcnRzIHdlYnNpdGUsIGVkdXZpZHVhbCwgZm9ybXMsIHJkcCBtb2Rlc1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb2RlLCBhbGxvd2VkRG9tYWluLCBiYXNlVXJsLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiwgZ2Zvcm1zVGVzdElkIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgdG8gcHJldmVudCBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVSTCB2YWxpZGF0aW9uIGZ1bmN0aW9uIC0gZGlmZmVyZW50IGxvZ2ljIGJhc2VkIG9uIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IGlzVXJsQWxsb3dlZCA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZSA9PT0gXCJ3ZWJzaXRlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV0VCU0lURSBtb2RlOiBjaGVjayBkb21haW4gbWF0Y2hpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwgfHwgdGFyZ2V0VXJsLmluY2x1ZGVzKGJhc2VVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkb21haW4gPSB1cmxPYmouaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09IGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhwbGljaXRseSBhbGxvdyB3d3cuIHN1YmRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbiA9PT0gJ3d3dy4nICsgYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluLmVuZHNXaXRoKCcuJyArIGFsbG93ZWREb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZG9tYWluLnNsaWNlKDAsIC0oYWxsb3dlZERvbWFpbi5sZW5ndGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZWR1dmlkdWFsXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRURVVklEVUFML01PT0RMRSBtb2RlOiBjaGVjayBtb29kbGVUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9vZGxlLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInN0YXJ0YXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicHJvY2Vzc2F0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ291dFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImVkdXZpZHVhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9saWN5XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJmb3Jtc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZPUk1TIG1vZGU6IGNoZWNrIGdmb3Jtc1Rlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKGdmb3Jtc1Rlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBHb29nbGUgRm9ybXMtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImZvcm1SZXNwb25zZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ2aWV3c2NvcmVcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcInJkcFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJEUCBtb2RlOiBhbGxvdyBhbGwgKG9yIGltcGxlbWVudCBzcGVjaWZpYyBsb2dpYyBpZiBuZWVkZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIG1vZGVzKVxuICAgICAgICAgICAgICAgIHJldHVybiBjaGVja0NvbW1vbkV4Y2VwdGlvbnModGFyZ2V0VXJsKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB0YXJnZXQ9XCJfYmxhbmtcIiBsaW5rcyBhbmQgd2luZG93Lm9wZW4gLSBibG9jayBCRUZPUkUgbmF2aWdhdGlvblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgLy8gT3BlbiBpbiBzYW1lIHdlYnZpZXdcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgLy8gUHJldmVudCBuZXcgd2luZG93XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB3aWxsLW5hdmlnYXRlIG9uIHdlYkNvbnRlbnRzIGxldmVsIC0gdGhpcyBmaXJlcyBCRUZPUkUgbmF2aWdhdGlvbiBoYXBwZW5zXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gQmxvY2sgbmF2aWdhdGlvbiBjb21wbGV0ZWx5IC0gdGhpcyBoYXBwZW5zIEJFRk9SRSBwYWdlIGxvYWRzXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LnN0b3AoKTsgLy8gU3RvcCBhbnkgbG9hZGluZyBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsaWFzIGZvciBlZHV2aWR1YWwgbW9kZSAtIHJlZGlyZWN0cyB0byB1bmlmaWVkIGhhbmRsZXJcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci1lZHV2aWR1YWwtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KSA9PiB7XG4gICAgICAgICAgICAvLyBDYWxsIHRoZSB1bmlmaWVkIGhhbmRsZXIgd2l0aCBlZHV2aWR1YWwgbW9kZVxuICAgICAgICAgICAgY29uc3QgdW5pZmllZEhhbmRsZXIgPSBpcGNNYWluLmxpc3RlbmVycygnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycpWzBdO1xuICAgICAgICAgICAgaWYgKHVuaWZpZWRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuaWZpZWRIYW5kbGVyKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGU6ICdlZHV2aWR1YWwnLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbG9hZCB0aGUgYnJvd3NlciB2aWV3XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVsb2FkLWJyb3dzZXItdmlldycsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmwpO1xuICAgICAgICB9KTtcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGxhbmd1YWdlVG9vbCBBUEkgU2VydmVyICh3aXRoIEphdmEgSlJFKVxuICAgICAgICAgKiBSdW5zIGF0IGxvY2FsaG9zdCA4MDg4XG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWN0aXZhdGUgc3BlbGxjaGVjayBvbiBkZW1hbmQgZm9yIHNwZWNpZmljIHN0dWRlbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgTGFuZ3VhZ2VUb29sIHNlcnZlciByZXNwb25kcyBvbiBjb25maWd1cmVkIHBvcnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnaXNMYW5ndWFnZVRvb2xSdW5uaW5nJywgYXN5bmMgKCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHBvcnQgPSBsYW5ndWFnZVRvb2xTZXJ2ZXIucG9ydCB8fCA4MDg4O1xuICAgICAgICAgICAgY29uc3QgaG9zdHMgPSBbJzEyNy4wLjAuMScsICc6OjEnLCAnbG9jYWxob3N0J107XG4gICAgICAgICAgICAvLyBSdW4gYWxsIGNoZWNrcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlLCB1c2UgbG9uZ2VyIHRpbWVvdXQgZm9yIHNlcnZlciBzdGFydHVwIGRldGVjdGlvblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGhvc3RzLm1hcChob3N0ID0+IGNoZWNrUG9ydE9wZW4ocG9ydCwgaG9zdCwgMjUwMCkpKTtcbiAgICAgICAgICAgIC8vIFJldHVybiBmaXJzdCBzdWNjZXNzZnVsIHJlc3VsdCwgb3IgbGFzdCByZXN1bHQgaWYgbm9uZSBzdWNjZWVkZWRcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3NSZXN1bHQgPSByZXN1bHRzLmZpbmQocmVzdWx0ID0+IHJlc3VsdC5ydW5uaW5nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0IHx8IHJlc3VsdHNbcmVzdWx0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IExPQ0FMIExvY2tkb3duXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdsb2NhbGxvY2tkb3duJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2NhbGxvY2tkb3duOiBsb2NraW5nIGRvd24gY2xpZW50IHdpdGhvdXQgdGVhY2hlciBjb25uZWN0aW9uXCIpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7XG4gICAgICAgICAgICAgICAgZXhhbW1vZGU6IHRydWUsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RUeXBlOiAnJyxcbiAgICAgICAgICAgICAgICBtb29kbGVEb21haW46ICcnLFxuIFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RpbnRlcnZhbDogMCxcbiAgICAgICAgICAgICAgICBtc09mZmljZUZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNsb2NrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBpbjogJzAwMDAnLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdW5sb2Nrb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmb250ZmFtaWx5OiAnc2Fucy1zZXJpZicsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdElkOiAnJyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiBhcmdzLnBhc3N3b3JkLFxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgdXNlRXhhbVNlY3Rpb25zOiBmYWxzZSwgLy9pZiBmYWxzZSBleGFtIHNlY3Rpb24gMSBpcyB1c2VkIGFuZCBubyB0YWJzIGFyZSBkaXNwbGF5ZWRcbiAgICAgICAgICAgICAgICBhY3RpdmVTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgZXhhbVNlY3Rpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIDE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW10eXBlOiBhcmdzLmV4YW1tb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY21hcmdpbjogeyBzaWRlOiAncmlnaHQnLCBzaXplOiAzIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lc3BhY2luZzogJzInLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9SZXBlYXQ6IDMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGFyZ3MubGFuZ3VhZ2V0b29sIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6IGFyZ3Muc3BlbGxjaGVja2xhbmcgfHwgJ2RlLURFJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBhcmdzLnN1Z2dlc3Rpb25zIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGFyZ3MuY2xpZW50bmFtZTtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBcIjEyNy4wLjAuMVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gXCJhXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSB0cnVlOyAvLyB0aGlzIG11c3QgYmUgc2V0IHRvIHRydWUgaW4gb3JkZXIgdG8gc3RvcCB0eXBpY2FsIG5leHQtZXhhbSBjbGllbnQvdGVhY2hlciBhY3Rpb25zXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gbG9jYWxsb2NrZG93blwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdmlydHVhbGl6ZWQgc3RhdHVzXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigndmlydHVhbGl6ZWQnLCAoKSA9PiB7ICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gdHJ1ZTsgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IEZPQ1VTIHN0YXRlIHRvIGZhbHNlIChtb3VzZSBsZWZ0IGV4YW0gd2luZG93KVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdmb2N1c2xvc3QnLCAoZXZlbnQsIGN0cmxhbHQ9ZmFsc2UpID0+IHsgXG4gICAgICAgICAgICBsZXQgYW5zd2VyID0gZmFsc2UgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgIXRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1tb2RlKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZX1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPiAwKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkICYmIGN0cmxhbHQgPT0gZmFsc2UpeyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGZvY3VzbG9zdDogbW91c2VsZWF2ZSBldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICBcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGJsb2NrIGV2ZXJ5dGhpbmcgYW5kIGluZm9ybSB0ZWFjaGVyICAocHJvYmFibHkgYW4gb3ZlcmtpbGwgb24gbW91c2VsZWF2ZSAtIG5lZWRzIHRlc3RpbmcpXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGFuc3dlclxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIG1haW4gY29uZmlnIG9iamVjdFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb25maWcgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogVW5sb2NrIENvbXB1dGVyXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdncmFjZWZ1bGx5ZXhpdCcsICgpID0+IHsgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBncmFjZWZ1bGx5ZXhpdDogZ3JhY2VmdWxseSBsZWF2aW5nIGxvY2tlZCBleGFtIG1vZGVgKVxuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdyYWNlZnVsbHlFbmRFeGFtKCkgXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICB9IClcblxuICAgICAgICAvKipcbiAgICAgICAgKiBzdG9wIHJlc3RyaWN0aW9uc1xuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdHJpY3Rpb25zJywgKCkgPT4geyAgXG4gICAgICAgICAgICAvL3RoaXMgYWxzbyBzdG9wcyB0aGUgY2xlYXJDbGlwYm9hcmQgaW50ZXJ2YWxcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIFxuICAgICAgICB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIGNvcHkgdG8gZ2xvYmFsIGNsaXBib2FyZFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2xpcGJvYXJkJywgKGV2ZW50LCB0ZXh0KSA9PiB7ICBcbiAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7ICAgIGFkZHJlc3MgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7ICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBtdWx0aWNhc3RjbGllbnQgbm90IHJ1bm5pbmdcIik7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBiZXJlaXRzIGVpbmUgQWRyZXNzZSB2b3JoYW5kZW4gaXN0LCBsaWVmZXJuIHdpciBzaWUgenVyXHUwMEZDY2suXG4gICAgICAgICAgICBpZiAoYWRkcmVzcykgeyAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDsgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyc3VjaGUsIGFuIGRpZSBrb3JyZWt0ZSBTY2huaXR0c3RlbGxlIHp1IGJpbmRlblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBGYWxscyBnYXRld2F5NHN5bmMoKSBibG9ja2llcmVuZCBpc3QsIGthbm5zdCBkdSBkaWVzZW4gQXVmcnVmIGluIGVpbiBQcm9taXNlIHBhY2tlbjpcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2UgfSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdhdGV3YXk0c3luYygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikgeyAgcmVqZWN0KGVycik7ICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpOyAvLyBMaWVmZXJ0IGRpZSBJUCBkZXIgU2Nobml0dHN0ZWxsZSwgd2VsY2hlIGRhcyBEZWZhdWx0IEdhdGV3YXkgaGF0XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMga2VpbmUgSVAgKG1pdCBHYXRld2F5KSB2ZXJmXHUwMEZDZ2JhciBpc3QsIGhvbGUgZWluZSBhbHRlcm5hdGl2ZSBBZHJlc3NlXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKTsgLy8gTGllZmVydCBhdWNoIGVpbmUgSVAsIHdlbm4ga2VpbiBHYXRld2F5IHZlcmZcdTAwRkNnYmFyIGlzdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcmZcdTAwRTRsc2NodGUgQWRyZXNzZW4gKHouIEIuIGxvY2FsaG9zdCkgaWdub3JpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PT0gXCIxMjcuMC4wLjFcIikgeyAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTsgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFdlbm4gZGllIE11bHRpY2FzdC1DbGllbnQgbmljaHQgbFx1MDBFNHVmdCwgaW5pdGlhbGlzaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgIWFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGYWxscyBpbml0KCkgYXN5bmNocm9uIHVtZ2VzZXR6dCB3ZXJkZW4ga2Fubiwgd2FydGVuIHdpciBoaWVyIGRhcmF1Zi5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7ICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IEVycm9yIGluaXRpYWxpemluZyBtdWx0aWNhc3QgY2xpZW50XCIsIGVycik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwO1xuICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gZWRpdG9yIGFzIGh0bWwgZmlsZSAtIGFzIGJhY2t1cCAtIG9ubHkgdHJpZ2dlcmVkIGJ5IHRoZSB0ZWFjaGVyIGZvciBub3cgKGFsbG93IG1hbnVhbCBiYWNrdXAgISEpXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7Y2xpZW50bmFtZTp0aGlzLmNsaWVudG5hbWUsIGZpbGVuYW1lOmAke2ZpbGVuYW1lfS5odG1sYCwgZWRpdG9yY29udGVudDogZWRpdG9yY29udGVudCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZUhUTUwnLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGh0bWxDb250ZW50ID0gYXJncy5lZGl0b3Jjb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGxldCBodG1sZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2BcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKXtcbiAgICAgICAgICAgICAgICBodG1sZmlsZW5hbWUgPSBgJHtmaWxlbmFtZX0uYmFrYFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBodG1sZmlsZSA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBodG1sZmlsZW5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaHRtbENvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoaHRtbGZpbGUsIGh0bWxDb250ZW50LCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogJHtlcnIubWVzc2FnZX1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWx0ZXJuYXRlcGF0aCA9IGAke2h0bWxmaWxlfS0ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59LmJha2BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHRyeWluZyB0byB3cml0ZSBmaWxlIGFzOlwiLCBhbHRlcm5hdGVwYXRoIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgaHRtbENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgYmFzZTY0IGVuY29kZWQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBERmJhc2U2NCcsIGFzeW5jIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0UERGYmFzZTY0OiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyID0gYXJncy5zdWJtaXNzaW9ubnVtYmVyKzEgLy8gY2xpZW50aW5mbyBrZWVwcyB0cmFjayBvZiBzdWJtaXNzaW9ucyBmb3IgYXV0b21hdGVkIHN1Ym1pc3Npb25udW1iZXJzIGF0IHNlY3Rpb24gY2hhbmdlIC0gYnV0IHRoaXMgb2J2aW91c2x5IGhhcHBlbnMgYWZ0ZXIgbWFudWFsIHN1Ym1pdFxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKGFyZ3Muc3VibWlzc2lvbm51bWJlciwgYXJncy5zZWN0aW9ubmFtZSwgYXJncy5wcmludEJhY2tncm91bmQpICAgLy8gd2h5IHRoZSBoZWxsIGlzIHRoaXMgZnVuY3Rpb24gbG9jYXRlZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBhbmQgbm90IGluIGlwY2hhbmRsZXIuanMgPyBGSVhNRSAhXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyB0aGUgRXhhbVdpbmRvdyBjb250ZW50IGFzIFBERlxuICAgICAgICAgKiBBVFRFTlRJT04gdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCByZXR1bnMgYSBiYXNlNjQgdmVyc2lvbiBvZiB0aGUgcGRmXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncHJpbnRwZGYnLCAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICAvLyBkbyBub3QgcHJpbnQgaWYgZXhhbSBtb2RlIGlzIG5vdCBhY3RpdmUgYW55bW9yZVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBleGFtbW9kZSBpcyBmYWxzZSAtIHNraXBwaW5nIHByaW50XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBwcmludCBhbHJlYWR5IGluIHByb2dyZXNzIC0gc2tpcHBpbmcgbmV3IHJlcXVlc3RcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyAvLyBkZWZpbmUgcHJpbnQgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGFyZ3MubGFuZHNjYXBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke2FyZ3Muc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7YXJncy5jbGllbnRuYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcGRmZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LnBkZmAgIC8vIGRlZmF1bHQgZmlsZW5hbWUgPSBjbGllbnRuYW1lLnBkZlxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmZpbGVuYW1lKXsgIC8vIGluIGNhc2Ugb2YgbWFudWFsIGJhY2t1cCB0aGUgdXNlciBjYW4gc2V0IGEgY3VzdG9tIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgICAgIHBkZmZpbGVuYW1lID0gYCR7YXJncy5maWxlbmFtZX0ucGRmYFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmZmlsZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgcGRmZmlsZW5hbWUpOyAgLy8gcGF0aCBwb2ludHMgdG8gdGhlIGN1cnJlbnQgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1hdXgucGRmYCAgICAvL3Rob21hcy5wZGYtYXV4LnBkZiBcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1vbGQucGRmYDsgICAvL3Rob21hcy5wZGYtb2xkLnBkZlxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlZmlsZW5hbWUpOyAgLy8gaWYgc29tZXRoaW5nIGdvZXMgd3Jvbmcgd2UgdHJ5IHRvIHdyaXRlIGEgZGlmZmVyZW50IGZpbGVcblxuXG4gICAgICAgICAgICAgICAgLy8gYXV4IGZpbGVzIGFyZSBmaWxlcyBjcmVhdGVkIGlmIHRoZSBtYWluIHBkZmZpbGVwYXRoIGlzIG5vdCB3cml0ZWFibGUgKG9wZW5lZCBvbiB3aW5kb3dzKSBcbiAgICAgICAgICAgICAgICB0cnkgeyAgLy8gYWx3YXlzIGNoZWNrIGZvciBvbGQgYXV4IGZpbGVzIGFuZCByZW5hbWUgdGhlbVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IGFsdGVybmF0ZWZpbGVuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhhbHRlcm5hdGVwYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGFtV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV4YW1XaW5kb3c/LndlYkNvbnRlbnRzXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdlYkNvbnRlbnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIm5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSB0cnVlXG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZSBmb3IgUERGIG1ldGFkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgcGRmVGl0bGUgPSBhcmdzLmZpbGVuYW1lID8gYXJncy5maWxlbmFtZSA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke2FyZ3Muc2VydmVybmFtZSB8fCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgfHwgJyd9YFxuICAgICAgICAgICAgICAgIC8vIGVzY2FwZSBxdW90ZXMgYW5kIHNwZWNpYWwgY2hhcmFjdGVycyBmb3IgSmF2YVNjcmlwdCBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkVGl0bGUgPSBwZGZUaXRsZS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7ZXNjYXBlZFRpdGxlfVwiYCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByaW50IHRoZSBleGFtIHdpbmRvdyB0byBwZGZcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucylcbiAgICAgICAgICAgICAgICB9KS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBwZGYgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMocGRmZmlsZXBhdGgpKSB7IGZzLnVubGlua1N5bmMocGRmZmlsZXBhdGgpOyB9fVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShwZGZmaWxlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfSAtIHdyaXRpbmcgZmlsZSBhczogJHthbHRlcm5hdGVwYXRofSBgKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgYXV4IGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRlcGF0aCkpIHsgZnMudW5saW5rU3luYyhhbHRlcm5hdGVwYXRoKTsgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZiAoYWx0ZXJuYXRpdmVyIFBmYWQpOiAke2Vyci5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgYWx0ZXJuYXRlIHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpICAgLy9tYWtlIHN1cmUgc3R1ZGVudHMgc2VlIHRoZSBuZXcgZmlsZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyb3IubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmVzIEFjdGl2ZSBTaGVldHMgZm9ybSBkYXRhIHRvIC5iYWsgZmlsZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc2F2ZUFjdGl2ZXNoZWV0c0JhaycsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWUgPyBgJHthcmdzLmZpbGVuYW1lfS5iYWtgIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGJha0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGZvcm1EYXRhIHRvIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShhcmdzLmZvcm1EYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byAuYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJha0ZpbGVQYXRoLCBqc29uRGF0YSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6IHNhdmVkIGZvcm0gZGF0YSB0byAke2Jha0ZpbGVuYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFsbCBmb3VuZCBTZXJ2ZXJzIGFuZCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0aW5mb2FzeW5jJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gZmFsc2UgICBcbiAgICAgICAgICAgIC8vIHNlcnZlcnN0YXR1cyBvYmpla3Qgd2lyZCBudXIgYmVpIGJlZ2lubiBkZXMgZXhhbXMgYW4gZGFzIGV4YW0gd2luZG93IGR1cmNoZ2VyZWljaHQgZlx1MDBGQ3IgYmFzaXMgZWluc3RlbGx1bmdlblxuICAgICAgICAgICAgLy8gYWxsZSB3ZWl0ZXJlbiB1cGRhdGVzIFx1MDBGQ2JlciBkYXMgc2VydmVyc3RhdHVzIG9iamVjdCB3ZXJkZW4gaW0gY29tbXVuaWNhdGlvbiBoYW5kbGVyIGdlbGVzZW4gdW5kIGdnZi4gYXVmIGRhcyBjbGllbnRpbmZvIG9iamVjdCBnZWxlZ3RcbiAgICAgICAgICAgIC8vIGRpZXNlciBrb21tdW5pa2F0aW9uc2ZsdXNzIG11c3MgaW4gMi4wIGdlc3RyZWFtbGluZWQgd2VyZGVuICNGSVhNRVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgc2VydmVyc3RhdHVzID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzIH1cblxuICAgICAgICAgICAgLy9jb3VudCBudW1iZXIgb2YgZmlsZXMgaW4gZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSkgIC8vIGVyc3RlbGx0IGZhbGxzIG5cdTAwRjZ0aWdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZWxpc3QgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcih3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICByZXR1cm4geyAgIFxuICAgICAgICAgICAgICAgIHNlcnZlcmxpc3Q6IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LFxuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiZWNhdXNlIG9mIG1pY3Jvc29mdCAzNjUgd2UgbmVlZCB0byB3b3JrIHdpdGggXCJCcm93c2VyVmlld1wiIFxuICAgICAgICAgKiBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGRpc2xheSBmdWxsc2NyZWVuIGluZm9ybWF0aW9uIGZyb20gdGhlIEV4YW0gaGVhZGVyIHdlIHRlbXBvcmFyaWx5IGNvbGxhcHNlIHRoZSBCcm93c2VyVmlldyBmb3IgT2ZmaWNlXG4gICAgICAgICAqIGFuZCByZXN0b3JlIGl0IGFmdGVyd2FyZHMgLSBub3QgcGVyZmVjdCBidXQgbG9va3Mgb2tcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjb2xsYXBzZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHsgeDogMCwgeTogMCwgd2lkdGg6IDAsIGhlaWdodDogMCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICB9KTtcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdG9yZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgbWVudUhlaWdodCA9IG1haW5XaW5kb3cubWVudUhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7IC8vIEdldCB0aGUgY3VycmVudCBib3VuZHMgb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIC8vIFNldCB0aGUgbmV3IGJvdW5kcyBvZiB0aGUgY29udGVudFZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiBtZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsIC8vIGZ1bGwgd2lkdGggb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBtZW51SGVpZ2h0IC8vIHJlbWFpbmluZyBoZWlnaHQgYWZ0ZXIgdGhlIG1lbnVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlIG1lbnUgaGVpZ2h0IGR5bmFtaWNhbGx5IHdoZW4gaGVhZGVyIGNvbnRlbnQgY2hhbmdlc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigndXBkYXRlLW1lbnUtaGVpZ2h0JywgKGV2ZW50LCBoZWlnaHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdztcbiAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmIGhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHN0b3JlZCBtZW51IGhlaWdodFxuICAgICAgICAgICAgICAgIG1haW5XaW5kb3cubWVudUhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZXBvc2l0aW9uIHRoZSBicm93c2VyIHZpZXcgd2l0aCBuZXcgaGVpZ2h0XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRWaWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgeTogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIGhlaWdodFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2VuZHMgYSByZWdpc3RlciByZXF1ZXN0IHRvIHRoZSBnaXZlbiBzZXJ2ZXIgaXBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIGNsaWVudG5hbWU6dGhpcy51c2VybmFtZSwgc2VydmVybmFtZTpzZXJ2ZXJuYW1lLCBzZXJ2ZXJpcCwgc2VydmVyaXAsIHBpbjp0aGlzLnBpbmNvZGUgXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdyZWdpc3RlcicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY2xpZW50bmFtZSA9IGFyZ3MuY2xpZW50bmFtZVxuICAgICAgICAgICAgY29uc3QgcGluID0gYXJncy5waW5cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmlwID0gYXJncy5zZXJ2ZXJpcFxuICAgICAgICAgICAgY29uc3Qgc2VydmVybmFtZSA9IGFyZ3Muc2VydmVybmFtZVxuICAgICAgICAgICAgY29uc3QgY2xpZW50aXAgPSBpcC5hZGRyZXNzKClcbiAgICAgICAgICAgIGNvbnN0IGhvc3RuYW1lID0gb3MuaG9zdG5hbWUoKVxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHRoaXMuY29uZmlnLnZlcnNpb25cbiAgICAgICAgICAgIGNvbnN0IGJpcHVzZXJJRCA9IGFyZ3MuYmlwdXNlcklEXG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXsgLy8jRklYTUUgZGFzIHNvbGx0ZSBlaWdlbnRsaWNoIHZvbSBzZXJ2ZXIga29tbWVuIFxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcmVnaXN0ZXJjbGllbnQvJHtzZXJ2ZXJuYW1lfS8ke3Bpbn0vJHtjbGllbnRuYW1lfS8ke2NsaWVudGlwfS8ke2hvc3RuYW1lfS8ke3ZlcnNpb259LyR7YmlwdXNlcklEfWA7XG4gICAgICAgICAgICBjb25zdCBzaWduYWwgPSBBYm9ydFNpZ25hbC50aW1lb3V0KDgwMDApOyAvLyA4MDAwIE1pbGxpc2VrdW5kZW4gPSA4IFNla3VuZGVuIEFib3J0U2lnbmFsIG1pdCBlaW5lbSBUaW1lb3V0XG5cblxuICAgICAgICAgICAgZmV0Y2godXJsLCB7IG1ldGhvZDogJ0dFVCcsIHNpZ25hbCB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSBcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09IFwic3VjY2Vzc1wiKSB7ICAvLyByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bGwgb3RoZXJ3aXNlIGRhdGEgd291bGQgYmUgXCJmYWxzZVwiXG4gICAgICAgICAgICAgICAgICAgIC8vIEVyZm9sZ3JlaWNoZSBSZWdpc3RyaWVydW5nXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGNsaWVudG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBzZXJ2ZXJpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gc2VydmVybmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGNsaWVudGlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBkYXRhLnRva2VuOyAvLyB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBjbGllbnQgdG9rZW4gaW4gb3JkZXIgdG8gY2hlY2sgYWdhaW5zdCBpdCBiZWZvcmUgcHJvY2Vzc2luZyBjcml0aWNhbCBhcGkgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gcGluO1xuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiBzdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBhdCAke3NlcnZlcm5hbWV9IEAgJHtzZXJ2ZXJpcH0gYXMgJHtjbGllbnRuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IGRhdGE7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9jcmVhdGUgZXhhbSBmb2xkZXIgaW4gd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgICAgICBsZXQgdW5pcXVlZXhhbU5hbWUgPSBgJHtzZXJ2ZXJuYW1lfS0ke3Bpbn1gXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5leGFtZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB1bmlxdWVleGFtTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbXBhcmUgdmVyc2lvbnMgYW5kIGRpc3BsYXkgbWVzc2FnZSAodGVhY2hlciBuZWVkcyB1cGdyYWRlLi4gY2xpZW50IG5lZWRzIHVwZ3JhZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wYXJpc29uUmVzdWx0ID0gdGhpcy5jb21wYXJlU29mdHdhcmUoY29uZmlnLnZlcnNpb24sIGNvbmZpZy5pbmZvICwgZGF0YS52ZXJzaW9uLCBkYXRhLnZlcnNpb25pbmZvICkgLy9zZXJ2ZXJWZXJzaW9uLCBzZXJ2ZXJTdGF0dXMsIGxvY2FsVmVyc2lvbiwgbG9jYWxTdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkgeyAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IG5ldWVyIGFscyBkaWUgZGVyIExlaHJwZXJzb24hXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHsgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgenUgYWx0LiBMYWRlbiBzaWUgc2ljaCBlaW5lIGFrdHVlbGxlIFZlcnNpb24gaGVydW50ZXIhXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbmJla2FubnRlciBGZWhsZXIgYmVpbSBWZXJiaW5kdW5nc2F1ZmJhdS5cIiB9OyAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGFzeW5jIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGZWhsZXJiZWhhbmRsdW5nXG4gICAgICAgICAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykgeyBlcnJvck1lc3NhZ2UgPSBcIlRoZSByZXF1ZXN0IHRpbWVkIG91dFwiOyAgIH0gLy8gVGltZW91dC1OYWNocmljaHQgYW5wYXNzZW4gXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIG9uIG1hY29zIHRoZSBwZXJtaXNzaW9uIHNldHRpbmdzIGluIHJhcmUgY2FzZXMgbWVzcyB1cCB0aGUgYWJpbGl0eSB0byBmZXRjaCB0aGUgdGVhY2hlciBhcGkgXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpeyAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHRoaXMuY29uZmlnLnNlcnZlckFwaVBvcnQpOyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlID09PSBcInJlc2V0XCIpIHsgICAvLyBxdWl0IHRoZSBhcHAgaWYgdGhlIHVzZXIgd2FudHMgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaWYgdGhlIHVzZXIgZG9lcyBub3Qgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVzIGdpYnQgZWluIFByb2JsZW0gbWl0IGRlbSBOZXR6d2VyaywgZGVuIEZpcmV3YWxscmVnZWxuIG9kZXIgZGVuIE5ldHp3ZXJrYmVyZWNodGlndW5nZW4hIEJpdHRlIGJlaGViZW4gc2llIGRpZXNlcyBQcm9ibGVtIHVuZCBzdGFydGVuIFNpZSBOZXh0LUV4YW0gbmV1IVwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICAgICAgICAgIHJldHVybjsgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIEdlb2dlYnJhIGFzIGdnYiBmaWxlIC0gYXMgYmFja3VwIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAsIGNvbnRlbnQ6IGJhc2U2NCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2F2ZUdHQicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGFyZ3MuY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBjb25zdCByZWFzb24gPSBhcmdzLnJlYXNvblxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzYXZlR0dCOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBCdWZmZXIuZnJvbShjb250ZW50LCAnYmFzZTY0Jyk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGdnYkZpbGVQYXRoLCBmaWxlRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXN0b3JlZFwiKSAsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycikgIFxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUdHQjogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGxvYWQgY29udGVudCBmcm9tIGdnYiBmaWxlIGFuZCBzZW5kIGl0IHRvIHRoZSBmcm9udGVuZCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgIH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdsb2FkR0dCJywgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBSZWFkIHRoZSBmaWxlIGFuZCBjb252ZXJ0IGl0IHRvIGJhc2U2NFxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKGdnYkZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlNjRHZ2JGaWxlID0gZmlsZURhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDpiYXNlNjRHZ2JGaWxlLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH0gICAgIFxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdFVCBQREYgb3IgSU1BR0UgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHBkZmFzeW5jJywgKGV2ZW50LCBmaWxlbmFtZSwgaW1hZ2UgPSBmYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGVcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlKXsgcmV0dXJuIGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpOyAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIGJhc2U2NCBzdHJpbmcgb2YgYXVkaW9maWxlIGZyb20gd29ya2RpcmVjdG9yeSBvciBwdWJsaWMgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0QXVkaW9GaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgcHVibGljZGlyPWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIik7XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmICFwdWJsaWNkaXIpIHsgLy8gUmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiBwdWJsaWNkaXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNCYXNlID0gcGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2U7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHB1YmxpY0Jhc2UsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBGSUxFLUxJU1QgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0ZmlsZXNhc3luYycsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIGF1ZGlvPWZhbHNlLCBkb2N4PWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJSZWNlaXZlZCBhcmd1bWVudHM6XCIsIGZpbGVuYW1lLCBhdWRpbywgZG9jeCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcblxuICAgICAgICAgICAgICAgIGlmIChhdWRpbyA9PSB0cnVlKXsgLy8gYXVkaW8gZmlsZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZG9jeCl7ICAvL29mZmljZSBvcGVuIHhtbCBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBtYW1tb3RoLmNvbnZlcnRUb0h0bWwoe3BhdGg6IGZpbGVwYXRofSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgIC8vYmFrIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAvLyByZXR1cm4gZmlsZSBsaXN0IG9mIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXsgZnMubWtkaXJTeW5jKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfSAvL2RvIG5vdCBjcmFzaCBpZiB0aGUgZGlyZWN0b3J5IGlzIGRlbGV0ZWQgYWZ0ZXIgdGhlIGFwcCBpcyBzdGFydGVkIF5eXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlbGlzdCA9ICBmcy5yZWFkZGlyU3luYyh3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgICAgICAgICAgICAgICBmaWxlbGlzdC5mb3JFYWNoKCBmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2RpZmllZCA9IGZzLnN0YXRTeW5jKCAgIHBhdGguam9pbih3b3JrZGlyLGZpbGUpICApLm10aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kID0gbW9kaWZpZWQuZ2V0VGltZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wZGZcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcInBkZlwiLCBtb2Q6IG1vZH0pICAgfSAgICAgICAgIC8vcGRmXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmJha1wiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYmFrXCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBiYWNrdXAgZmlsZSB0byByZXBsYWNlIGVkaXRvciBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmRvY3hcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImRvY3hcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGNvbnRlbnQgZmlsZSAoZnJvbSB0ZWFjaGVyKSB0byByZXBsYWNlIGNvbnRlbnQgYW5kIGNvbnRpbnVlIHdyaXRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2diXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJnZ2JcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGdlb2dlYnJhXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm1wM1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5vZ2dcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIud2F2XCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYXVkaW9cIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGF1ZGlvXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmpwZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wbmdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2lmXCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiaW1hZ2VcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgQkFDS1VQIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBmaWxlbmFtZSB3aXRob3V0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGJhY2t1cGZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFJlcXVlc3QgcmVjZWl2ZWQgZm9yIGZpbGVuYW1lOiAke2ZpbGVuYW1lfWApXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRnVsbCBmaWxlIHBhdGg6ICR7ZmlsZXBhdGh9YClcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZmlsZXBhdGgpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgbm90IGZvdW5kOiAke2ZpbGVwYXRofWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIGV4aXN0cywgcmVhZGluZyBjb250ZW50YClcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBTdWNjZXNzZnVsbHkgcmVhZCBiYWNrdXAgZmlsZSwgY29udGVudCBsZW5ndGg6ICR7ZGF0YS5sZW5ndGh9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciByZWFkaW5nIGJhY2t1cCBmaWxlOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHN0YWNrOiAke2Vyci5zdGFja31gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IG5vIGZpbGVuYW1lIHByb3ZpZGVkYCk7IFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpcGNNYWluLm9uKCdyZWxvYWQtdXJsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlRWFzdGVyV2luKClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBcHBlbmQgUHJpbnRSZXF1ZXN0IHRvIGNsaWVudGluZm8gIFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3NlbmRQcmludFJlcXVlc3QnLCAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gdHJ1ZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXQtY3B1LWluZm8nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5pc1ZpcnR1YWxNYWNoaW5lKClcbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXQtd2xhbi1pbmZvJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3bGFuSW5mbyA9IGF3YWl0IGdldFdsYW5JbmZvKCk7XG4gICAgICAgICAgICByZXR1cm4gd2xhbkluZm87XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgXG4gICAgICAgIC8vIE5ldyBoYW5kbGVyIHRvIGdldCBQREYgZnJvbSBwdWJsaWMgZGlyZWN0b3J5IGZvciBmcm9udGVuZCBwYXJzaW5nXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQZGZGcm9tUHVibGljJywgYXN5bmMgKGV2ZW50LCBwZGZGaWxlbmFtZSApID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IGRpcmVjdG9yeSBuYW1lIGluIEVTTVxuICAgICAgICAgICAgICAgIGNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHBkZlBhdGg7XG4gICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgcGRmRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwZGZQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IFBERiBub3QgZm91bmQgYXQ6ICR7cGRmUGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYyhwZGZQYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cbiAgICB9XG5cbiAgICBpc1ZpcnR1YWxNYWNoaW5lKCkge1xuICAgICAgICBjb25zdCBWRU5ET1JTID0gLyhvcmFjbGV8dmlydHVhbGJveHx2bXdhcmV8a3ZtfHFlbXV8eGVufGlubm90ZWt8cGFyYWxsZWxzfG1pY3Jvc29mdHxoeXBlci12fGJoeXZlfHJlZCBoYXR8cmVkaGF0fGJvY2hzfGJoeXZlfG9wZW5zdGFja3xjbG91ZHxhbWF6b258Z29vZ2xlfGF6dXJlKS9pIC8vIGNvbW1vbiBWTSBpZHNcbiAgICAgICAgY29uc3Qgd2FybkFuZFJldHVybiA9IHJlYXNvbiA9PiB7XG4gICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGlzVmlydHVhbE1hY2hpbmU6IFZlcmRhY2h0IGF1ZiBWTSAtICR7cmVhc29ufWApXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBMaW51eCAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNwdWluZm8gPSByZWFkRmlsZVN5bmMoJy9wcm9jL2NwdWluZm8nLCAndXRmOCcpICAgICAgLy8gQ1BVIGZsYWdzXG4gICAgICAgICAgICBpZiAoL15mbGFncy4qXFxiaHlwZXJ2aXNvclxcYi9tLnRlc3QoY3B1aW5mbykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdoeXBlcnZpc29yIGZsYWcgaW4gL3Byb2MvY3B1aW5mbycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gW1xuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvc3lzX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X25hbWUnLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF92ZXJzaW9uJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2JvYXJkX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9iaW9zX3ZlbmRvcicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9jaGFzc2lzX3ZlbmRvcidcbiAgICAgICAgICAgIF1cbiAgICAgICAgICAgIGNvbnN0IGRtaSA9IGZpbGVzLm1hcChwID0+IHsgdHJ5IHsgcmV0dXJuIHJlYWRGaWxlU3luYyhwLCAndXRmOCcpIH0gY2F0Y2ggeyByZXR1cm4gJycgfSB9KS5qb2luKCcgJylcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoZG1pKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ0RNSS1WZW5kb3ItTWF0Y2gnKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBleGVjU3luYygnc3lzdGVtZC1kZXRlY3QtdmlydCAtcScsIHsgc3RkaW86ICdpZ25vcmUnIH0pICAgIC8vIGV4aXQgMCA9PiBWTVxuICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgbWVsZGV0IFZpcnR1YWxpc2llcnVuZycpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuXG5cbiAgICAgICAgICAvLyBQclx1MDBGQ2ZlIGF1ZiBRRU1VLVByb3plc3NlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID0gZXhlY1N5bmMoJ3BzIGF1eCB8IGdyZXAgLWkgcWVtdScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKHBzLmluY2x1ZGVzKCdxZW11JykgJiYgIXBzLmluY2x1ZGVzKCdncmVwJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyBsXHUwMEU0dWZ0JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIFdpbmRvd3MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiKEdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbSB8IEZvckVhY2gtT2JqZWN0IHsgJF8uTWFudWZhY3R1cmVyLCAkXy5Nb2RlbCB9KSAtam9pbiBcXCcgXFwnXCInXG4gICAgICAgICAgICBjb25zdCBiYXNpYyA9IGV4ZWNTeW5jKHBzLCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpICAgIC8vIG1hbnVmYWN0dXJlciArIG1vZGVsXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGJhc2ljKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9Nb2RlbGwgcGFzc3QgenUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHNSb2J1c3QgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkbz1AKCk7JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtOyRvKz1AKCRjcy5NYW51ZmFjdHVyZXIsJGNzLk1vZGVsKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJiPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CYXNlQm9hcmQ7JG8rPUAoJGJiLk1hbnVmYWN0dXJlciwkYmIuUHJvZHVjdCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiaW9zPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9CSU9TOyRvKz1AKCRiaW9zLlNNQklPU0JJT1NWZXJzaW9uKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzcD1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW1Qcm9kdWN0OyRvKz1AKCRjc3AuTmFtZSl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAnV3JpdGUtT3V0cHV0ICgoJG8gLWpvaW4gXFwnIFxcJykuVHJpbSgpKVwiJ1xuICAgICAgICAgICAgY29uc3Qgcm9idXN0ID0gZXhlY1N5bmMocHNSb2J1c3QsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKClcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qocm9idXN0KSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1dpbmRvd3MgSGVyc3RlbGxlci9CSU9TLUluZm9zIHBhc3NlbiB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIC8vIFp1c1x1MDBFNHR6bGljaGUgUUVNVS1Fcmtlbm51bmcgZlx1MDBGQ3IgV2luZG93c1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBxZW11UHJvY2Vzc2VzID0gZXhlY1N5bmMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBxZW11KlwiJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICAgICAgaWYgKHFlbXVQcm9jZXNzZXMuaW5jbHVkZXMoJ3FlbXUnKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ1FFTVUtUHJvemVzcyB1bnRlciBXaW5kb3dzJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG5cbiAgICAgICAgIC8vIC0tLS0tLS0tLS0gbWFjT1MgLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBod01vZGVsID0gZXhlY1N5bmMoJ3N5c2N0bCAtbiBody5tb2RlbCcsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKC9edmlydHVhbC9pLnRlc3QoaHdNb2RlbCkgfHwgVkVORE9SUy50ZXN0KGh3TW9kZWwpKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1MgSGFyZHdhcmVtb2RlbGwgZGV1dGV0IGF1ZiBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IGV4ZWNTeW5jKCdzeXN0ZW1fcHJvZmlsZXIgU1BIYXJkd2FyZURhdGFUeXBlJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHNwKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIHN5c3RlbV9wcm9maWxlciBtZWxkZXQgVk0tVmVuZG9yJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAgICBcbiAgICB9XG5cbiAgICBjb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKSB7XG4gICAgICAgIGNvbnN0IHBhcnRzQSA9IHZlcnNpb25BLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgICAgIGNvbnN0IHBhcnRzQiA9IHZlcnNpb25CLnNwbGl0KCcuJykubWFwKE51bWJlcik7XG4gICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5tYXgocGFydHNBLmxlbmd0aCwgcGFydHNCLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbnVtQSA9IHBhcnRzQVtpXSB8fCAwOyAvLyBGYWxsYmFjayBhdWYgMCwgZmFsbHMga2VpbiBXZXJ0IHZvcmhhbmRlblxuICAgICAgICAgICAgY29uc3QgbnVtQiA9IHBhcnRzQltpXSB8fCAwO1xuICAgIFxuICAgICAgICAgICAgaWYgKG51bUEgPCBudW1CKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAobnVtQSA+IG51bUIpIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBcbiAgICBjb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCBudW1iZXJBID0gcGFyc2VJbnQoc3RhdHVzQS5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICAgICAgY29uc3QgbnVtYmVyQiA9IHBhcnNlSW50KHN0YXR1c0IubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgXG4gICAgICAgIGlmIChudW1iZXJBIDwgbnVtYmVyQikgcmV0dXJuIC0xO1xuICAgICAgICBpZiAobnVtYmVyQSA+IG51bWJlckIpIHJldHVybiAxO1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBjb21wYXJlU29mdHdhcmUodmVyc2lvbkEsIHN0YXR1c0EsIHZlcnNpb25CLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IHZlcnNpb25Db21wYXJpc29uID0gdGhpcy5jb21wYXJlVmVyc2lvbnModmVyc2lvbkEsIHZlcnNpb25CKTtcbiAgICAgICAgaWYgKHZlcnNpb25Db21wYXJpc29uICE9PSAwKSByZXR1cm4gdmVyc2lvbkNvbXBhcmlzb247XG4gICAgXG4gICAgICAgIHJldHVybiB0aGlzLmNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKTtcbiAgICB9XG5cblxufVxuIFxuZXhwb3J0IGRlZmF1bHQgbmV3IElwY0hhbmRsZXIoKVxuIiwgImltcG9ydCB7Y3JlYXRlSTE4bn0gZnJvbSAndnVlLWkxOG4nXG5cbmltcG9ydCBlbiBmcm9tICcuL2VuLmpzb24nXG5pbXBvcnQgZGUgZnJvbSAnLi9kZS5qc29uJ1xuXG5jb25zdCBpMThuID0gY3JlYXRlSTE4bih7XG4gICAgbG9jYWxlOiAnZGUnLFxuICAgIGZhbGxiYWNrTG9jYWxlOiAnZW4nLFxuICAgIG1lc3NhZ2VzOiB7XG4gICAgICAgIGVuLFxuICAgICAgICBkZVxuICAgICAgfVxuICB9KVxuXG5leHBvcnQgZGVmYXVsdCBpMThuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIlJlc3RvcmVcIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIkRpc2Nvbm5lY3RcIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkV4aXRcIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3JkXCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJFeGFtc1wiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiVXNlcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlciBhZGRyZXNzXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIkV4YW0gTmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiYWR2YW5jZWRcIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJzaW1wbGVcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwicmVnaXN0ZXJcIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcInJlZ2lzdGVyaW5nLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcInJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJjb25uZWN0ZWRcIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJkaXNjb25uZWN0ZWRcIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIG9uIHNlcnZlciEgXFxuXFxuUGxlYXNlIHdhaXQgZm9yIHRoZSBhY3RpdmF0aW9uIG9mIHRoZSBleGFtIG1vZGUgYnkgdGhlIHRlYWNoZXIhXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcInNlYXJjaCBzdGFydGVkXCIsXG4gICAgICAgIFwibm9wd1wiOiBcIndyb25nIHVzZXJuYW1lIG9yIHBpblwiLFxuICAgICAgICBcIm5vdXNlclwiOlwibm8gdXNlcm5hbWUgZ2l2ZW5cIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRkcmVzc2Ugb2RlciBFeGFtbmFtZSBtaXNzaW5nXCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIk5vIE5ldHdvcmsgQ29ubmVjdGlvblwiLFxuICAgICAgICBcIm5vcGluXCI6IFwibm8gcGluY29kZSBnaXZlblwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6XCJTZXJ2ZXIgQVBJIHVucmVhY2hhYmxlXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGlzIGJlaGluZCBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIk5vIFRlYWNoZXIgQVBJIGZvdW5kIG9uIHRoZSBnaXZlbiBhZGRyZXNzXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9jYWwgbG9ja2Rvd25cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVhbCBzZWFyY2hcIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJObyBleGFtcyBmb3VuZFwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGxvZ291dD9cIixcbiAgICAgICAgXCJkZVwiOiBcIkdlcm1hblwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJlbmNoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpYW5cIixcbiAgICAgICAgXCJzbFwiOlwiU2xvdmVuaWFuXCIsXG4gICAgICAgIFwibm9uZVwiOiBcIm5vbmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiU3BlbGxjaGVja1wiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWN0aXZhdGVcIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJTaG93IHN1Z2dlc3Rpb25zXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIlBsZWFzZSBjaG9vc2UgYSBsYW5ndWFnZVwiLFxuICAgICAgICBcImxhbmdcIjogXCJMYW5ndWFnZXNcIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpY3NcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlNlbGVjdCBleGFtIG1vZGVcIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJQbGVhc2UgaW5zdGFsbCB0aGUgc2FtZSB2ZXJzaW9uIGFzIHRoZSBleGFtIHNlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJzYWZlIGV4YW0gc3RhdHVzIGNoYW5nZWRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgYWxyZWFkeSByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcInN0YXJ0ZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwic3RvcHBlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcInNhZmUgZXhhbSBtb2RlIG5vdCBhY3RpdmVcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcInN0dWRlbnQgcmVtb3ZlZCBmcm9tIHNlcnZlclwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcImZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcImZpbGVzIHN0b3JlZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiZmlsZSBlcnJvclwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJwbGVhc2UgY2hlY2sgaWYgdGhlICdFWEFNLVNUVURFTlQnIGRpcmVjdG9yeSBpcyB3cml0ZWFibGUgYW5kIGhhcyBlbm91Z2ggc3BhY2VcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkEgbG9jYWwgYmFja3VwIGNvdWxkIG5vdCBiZSBjcmVhdGVkLiBQbGVhc2UgdXNlIHRoZSBtYW51YWwgc3VibWlzc2lvbiBvcHRpb24uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJkb24ndCBzaG93IGFnYWluXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBmb3VuZFwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIkdldCBtYXRlcmlhbHNcIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiU2VuZCBmaW5hbCBleGFtXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJGaW5hbCBzdWJtaXRcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbHM6XCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxvY2FsIGZpbGVzOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIlVwZGF0ZVwiLFxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwbGl0dmlld1wiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIllvdSBoYXZlIGxlZnQgdGhlIHNhZmUgZXhhbSBtb2RlIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiUGxlYXNlIGluZm9ybSBhIHRlYWNoZXIhXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiRG8geW91IHdhbnQgdG8gcmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGUgZWRpdG9yIHdpdGggdGhlIGNvbnRlbnQgb2YgXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQ2FuY2VsXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiUmVwbGFjZVwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwIGZpbGUgY291bGQgbm90IGJlIHJlYWRcIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgc3VjY2Vzc2Z1bGx5IGxvYWRlZFwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRXJyb3IgbG9hZGluZyBiYWNrdXAgZmlsZVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiU3VjY2Vzc1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiY2hhcnNcIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIndvcmRzXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwicmVjb25uZWN0XCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwidW5sb2NrXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkV4aXQgc2FmZSBleGFtIG1vZGU/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiRG8gbm90IGxlYXZlIHNhZmUgZXhhbSBtb2RlIHdpdGhvdXQgcGVybWlzc2lvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiSWYgdGhpcyBwcm9jZXNzIGZhaWxzIHVubG9jayBhbmQgdHJ5IGFnYWluIVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiQ3JlYXRpbmcgYmFja3VwXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiQ3JlYXRpbmcgYmFja3VwIGFuZCBjbGlwYm9hcmQgY29weVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJMZWF2aW5nIEV4YW0gbW9kZVwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcImJhY2t1cFwiLFxuICAgICAgICBcInVuZG9cIjpcInVuZG9cIixcbiAgICAgICAgXCJyZWRvXCI6XCJyZWRvXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImNsZWFyXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiYm9sZFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwiaXRhbGljXCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bmRlcmxpbmVcIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiaGVhZGluZzFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiaGVhZGluZzJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiaGVhZGluZzNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiaGVhZGluZzRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiaGVhZGluZzVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiaGVhZGluZzZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInN1YnNjcmlwdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJzdXBlcnNjcmlwdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcImJ1bGxldGxpc3RcIixcbiAgICAgICAgXCJsaXN0XCI6XCJsaXN0XCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJjb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJjb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiYmxvY2txdW90ZVwiLFxuICAgICAgICBcImxpbmVcIjpcInBhZ2VicmVha1wiLFxuICAgICAgICBcImxlZnRcIjpcImxlZnRcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcImNlbnRlclwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJyaWdodFwiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwidGV4dGNvbG9yXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJsaW5lYnJlYWtcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtb3JlXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcImluc2VydHRhYmxlXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcImRlbGV0ZXRhYmxlXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcImNvbHVtbmFmdGVyXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcInJvd2FmdGVyXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJkZWxjb2x1bW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcImRlbHJvd1wiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwibWVyZ2VvcnNwbGl0XCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJoZWFkZXJjb2x1bW5cIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcImhlYWRlcnJvd1wiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJzZWxlY3RlZCB3b3Jkcy9jaGFyc1wiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJwcmludCByZXF1ZXN0IHNlbnRcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJwcmludCByZXF1ZXN0IGRlbmllZFwiLFxuICAgICAgICBcInBhc3RlXCI6XCJwYXN0ZVwiLFxuICAgICAgICBcImNvcHlcIjpcImNvcHlcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwic3BlbGxjaGVja1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiZGVhY3RpdmF0ZSBzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiUmVsb2FkXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvdWxkIHlvdSBsaWtlIHRvIHJlaW5pdGlhbGl6ZSB0aGUgRWRpdG9yP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJrZWVwIGNvbnRlbnRcIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiSW5zZXJ0IHNwZWNpYWxjaGFyYWN0ZXJcIixcbiAgICAgICAgXCJwcmludFwiOiBcInByaW50XCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJQbGF5IEF1ZGlvXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiRG8geW91IHdhbnQgdG8gcGxheSB0aGUgYXVkaW9maWxlP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJSZW1haW5pbmcgcGxheWJhY2tzOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiWW91IGRvbid0IGhhdmUgdGhlIHBlcm1pc3Npb24gdG8gcGxheSB0aGlzIGZpbGUhXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJJbnNlcnQgSW1hZ2VcIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIkluc2VydCBNdWdzaG90XCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiU2VuZCB3b3JrIHRvIHRlYWNoZXJcIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJDbG9zZVwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkV4aXQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkZpbGVuYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiUGxlYXNlIGVudGVyIG9ubHkgbGV0dGVycyBhbmQgbnVtYmVycyB3aXRob3V0IHNwZWNpYWwgY2hhcmFjdGVyc1wiLFxuICAgICAgICBcImNsZWFyXCI6IFwiY2xlYXIgY29udGVudD9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIk5vIHZhbGlkIFBERiBGaWxlXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIldyb25nIHBhc3N3b3JkXCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIlJlbG9hZCB3ZWJ2aWV3XCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJQb3NzaWJseSBzY2FubmVkIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJPblwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwibGVzcyB0aGFuIDIgaW50ZXJhY3RpdmUgZm9ybSBmaWVsZHMgd2VyZSBmb3VuZC5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJUaGlzIGluZGljYXRlcyB0aGF0IHRoaXMgaXMgYSBzY2FubmVkIFBERiB0aGF0IGRvZXMgbm90IGNvbnRhaW4gYWN0aXZlIGZvcm0gZmllbGRzIG9yIHRhYmxlcy5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVW5kZXJzdG9vZFwiLFxuICAgICAgICBcInBhZ2VcIjogXCJQYWdlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJQYWdlc1wiXG4gICAgfVxufVxuIiwgInsgXG4gICAgXCJtYWluXCI6IHtcbiAgICAgICAgXCJ0cmF5XCI6IHtcbiAgICAgICAgICAgIFwicmVzdG9yZVwiOiBcIldpZWRlcmhlcnN0ZWxsZW5cIixcbiAgICAgICAgICAgIFwiZGlzY29ubmVjdFwiOiBcIlZlcmJpbmR1bmcgdHJlbm5lblwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiQmVlbmRlblwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcnRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIlByXHUwMEZDZnVuZ2VuXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJCZW51dHplcm5hbWVcIixcbiAgICAgICAgXCJwaW5cIjogXCJQaW5jb2RlXCIsXG4gICAgICAgIFwiaXBcIjpcIlNlcnZlci1BZHJlc3NlXCIsXG4gICAgICAgIFwiZXhhbW5hbWVcIjpcIlByXHUwMEZDZnVuZ3NuYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJmb3J0Z2VzY2hyaXR0ZW5cIixcbiAgICAgICAgXCJzaW1wbGVcIjogXCJlaW5mYWNoXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcImFubWVsZGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJtZWxkZSBhbi4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwidmVyYnVuZGVuXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiVmVyYmluZHVuZyB1bnRlcmJyb2NoZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkaW5mb1wiOiBcIlNpZSBoYWJlbiBzaWNoIGVyZm9sZ3JlaWNoIGFtIFNlcnZlciByZWdpc3RyaWVydCEgXFxuXFxuQml0dGUgd2FydGVuIFNpZSBhdWYgZGllIEFrdGl2aWVydW5nIGRlcyBQclx1MDBGQ2Z1bmdzbW9kdXMgZHVyY2ggZGllIExlaHJwZXJzb24hXCIsXG4gICAgICAgIFwic3RhcnRlZFwiOiBcIlN1Y2hlIGdlc3RhcnRldFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJGYWxzY2hlciBCZW51dHplcm5hbWUgb2RlciBQaW5jb2RlXCIsXG4gICAgICAgIFwibm91c2VyXCI6IFwiQmVudXR6ZXJuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkcmVzc2Ugb2RlciBQclx1MDBGQ2Z1bmdzbmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJLZWluZSBOZXR6d2Vya3ZlcmJpbmR1bmdcIixcbiAgICAgICAgXCJub3BpblwiOiBcIlBpbmNvZGUgZmVobHRcIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOiBcIlNlcnZlciBBUEkgbmljaHQgZXJyZWljaGJhci5cIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgYmVmaW5kZXQgc2ljaCBtXHUwMEY2Z2xpY2hlcndlaXNlIGhpbnRlciBlaW5lciBGaXJld2FsbC5cIixcbiAgICAgICAgXCJub2FwaVwiOiBcIktlaW5lIFByXHUwMEZDZnVuZ3NzZXJ2ZXIgYW4gYW5nZWdlYmVuZXIgQWRyZXNzZVwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxva2FsIGFic3BlcnJlblwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWVsbCBzdWNoZW5cIixcbiAgICAgICAgXCJub2V4YW1zXCI6XCJLZWluZSBQclx1MDBGQ2Z1bmdlbiBnZWZ1bmRlblwiLFxuICAgICAgICBcImxvZ291dEJpUFwiOlwiU2luZCBTaWUgc2ljaGVyLCBkYXNzIFNpZSBzaWNoIGFibWVsZGVuIG1cdTAwRjZjaHRlbj9cIixcbiAgICAgICAgXCJkZVwiOiBcIkRldXRzY2hcIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzY2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzY2hcIixcbiAgICAgICAgXCJmclwiOlwiRnJhbnpcdTAwRjZzaXNjaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWVuaXNjaFwiLFxuICAgICAgICBcInNsXCI6XCJTbG93ZW5pc2NoXCIsXG4gICAgICAgIFwibm9uZVwiOiBcImFuZGVyZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJoaWxmZVwiLFxuICAgICAgICBcImFjdGl2YXRlXCI6IFwiYWt0aXZpZXJlblwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlZvcnNjaGxcdTAwRTRnZSB6ZWlnZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiQml0dGUgd1x1MDBFNGhsZW4gU2llIGVpbmUgU3ByYWNoZSBmXHUwMEZDciBkaWUgUHJcdTAwRkNmdW5nXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIlNwcmFjaGVuXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWtcIixcbiAgICAgICAgXCJzZWxlY3RleGFtbW9kZVwiOiBcIlByXHUwMEZDZnVuZ3Ntb2R1cyBhdXN3XHUwMEU0aGxlblwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIkJpdHRlIGluc3RhbGxpZXJlbiBzaWUgZGllIHNlbGJlIFZlcnNpb24gd2llIGFtIFByXHUwMEZDZnVuZ3NzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IGdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJWZXJ0cmF1ZW5zc3RlbGx1bmcgZ2VcdTAwRTRuZGVydFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwiU2NoXHUwMEZDbGVyOmluIHVudGVyIGRpZXNlbSBOYW1lbiBiZXJlaXRzIGFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBuaWNodCBha3RpdlwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwiU2NoXHUwMEZDbGVyOmluIGVudGZlcm50XCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgdW5nXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcIkRhdGVpZW4gZXJoYWx0ZW5cIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiRGF0ZWllbiBnZXNwZWljaGVydFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJFcyB3dXJkZW4ga2VpbmUgRGF0ZWllbiBob2NoZ2VsYWRlblwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcIkZlaGxlciBiZWltIFNjaHJlaWJlbiBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwiQml0dGUgc3RlbGxlbiBTaWUgc2ljaGVyLCBkYXNzIGRhcyAnRVhBTS1TVFVERU5UJyBWZXJ6ZWljaG5pcyBmXHUwMEZDciBOZXh0LUV4YW0gc2NocmVpYmJhciBpc3QgdW5kIGdlblx1MDBGQ2dlbmQgU3BlaWNoZXJwbGF0eiB2b3JoYW5kZW4gaXN0LlwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiRWluZSBsb2thbGUgU2ljaGVydW5nIGtvbm50ZSBuaWNodCBlcnN0ZWxsdCB3ZXJkZW4uIE51dHplbiBTaWUgZGllIG1hbnVlbGxlIEFiZ2FiZSB1bSBJaHJlIEFyYmVpdCBkaXJla3QgYW4gZGllIExlaHJwZXJzb24genUgc2VuZGVuLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiTmljaHQgbWVociBhbnplaWdlblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZ2VmdW5kZW5cIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbiBob2xlblwiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJGaW5hbGUgQWJnYWJlIGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJBYmdhYmVcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbGllbjpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJBa3R1YWxpc2llcmVuXCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxva2FsZSBEYXRlaWVuOlwiLFxuXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BhbHRlbmFuc2ljaHRcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJTaWUgaGFiZW4gZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdmVybGFzc2VuIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiTWVsZGVuIFNpZSBzaWNoIHVtZ2VoZW5kIGJlaSBkZXIgQXVmc2ljaHRzcGVyc29uIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIldvbGxlbiBTaWUgZGVuIEluaGFsdCBkZXMgRWRpdG9ycyBkdXJjaCBkZW4gSW5oYWx0IGRlciBEYXRlaVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcImVyc2V0emVuP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQWJicmVjaGVuXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiRXJzZXR6ZW5cIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cC1EYXRlaSBrb25udGUgbmljaHQgZ2VsZXNlbiB3ZXJkZW5cIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgZXJmb2xncmVpY2ggZ2VsYWRlblwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRmVobGVyIGJlaW0gTGFkZW4gZGVyIEJhY2t1cC1EYXRlaVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIkVyZm9sZ1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiWmVpY2hlblwiLFxuICAgICAgICBcIndvcmRzXCI6IFwiV1x1MDBGNnJ0ZXJcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJuZXUgdmVyYmluZGVuXCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwiZW50c3BlcnJlblwiLFxuICAgICAgICBcImV4aXRcIjogXCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiVmVybGFzc2VuIFNpZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyBuaWUgb2huZSBGcmVpZ2FiZSBlaW5lciBMZWhycGVyc29uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJTb2xsdGUgZGVyIFZvcmdhbmcgZmVobHNjaGxhZ2VuIGJlZW5kZW4gU2llIGJpdHRlIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHVuZCB2ZXJzdWNoZW4gU2llIGVzIGVybmV1dCFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIklocmUgQXJiZWl0IHd1cmRlIGVyZm9sZ3JlaWNoIGdlc2ljaGVydCFcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJEaWUgYWt0dWVsbGUgQXJiZWl0IHdpcmQgZ2VzaWNoZXJ0IHVuZCBpbiBkaWUgWndpc2NoZW5hYmxhZ2Uga29waWVydCFcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiQWJnZXNpY2hlcnRlciBNb2R1cyBiZWVuZGV0XCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwic2ljaGVyblwiLFxuICAgICAgICBcInVuZG9cIjpcInJcdTAwRkNja2dcdTAwRTRuZ2lnXCIsXG4gICAgICAgIFwicmVkb1wiOlwid2llZGVyaG9sZW5cIixcbiAgICAgICAgXCJjbGVhclwiOlwibFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiZmV0dFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwia3Vyc2l2XCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bnRlcnN0cmljaGVuXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiXHUwMERDYmVyc2NocmlmdCAzXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiXHUwMERDYmVyc2NocmlmdCA2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJ0aWVmZ2VzdGVsbHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwiaG9jaGdlc3RlbGx0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwidW5nZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJsaXN0XCI6XCJnZW9yZG5ldGUgTGlzdGVcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcIkNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcIkNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJaaXRhdFwiLFxuICAgICAgICBcImxpbmVcIjpcIlNlaXRlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJMaW5rc2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJaZW50cmllcnRcIixcbiAgICAgICAgXCJyaWdodFwiOlwiUmVjaHRzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcIlRleHRmYXJiZVwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwiWmVpbGVudW1icnVjaFwiLFxuICAgICAgICBcIm1vcmVcIjpcIm1laHJcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiVGFiZWxsZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsZXRldGFibGVcIjpcIlRhYmVsbGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiY29sdW1uYWZ0ZXJcIjpcIlNwYWx0ZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicm93YWZ0ZXJcIjpcIlJlaWhlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcIlNwYWx0ZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJkZWxyb3dcIjpcIlJlaWhlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcIm1lcmdlb3JzcGxpdFwiOlwiVmVyZWluZW4gb2RlciBUZWlsZW5cIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcIlRpdGVsc3BhbHRlXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJUaXRlbHJlaWhlXCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcIldcdTAwRjZydGVyL1plaWNoZW4gaW4gQXVzd2FobFwiLFxuICAgICAgICBcInJlcXVlc3RzZW50XCI6XCJEcnVja2FuZnJhZ2UgZ2VzZW5kZXQhXCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwiRHJ1Y2thbmZyYWdlIGFiZ2VsZWhudC4gQml0dGUgd2FydGVuIHVuZCBlcm5ldXQgc2VuZGVuLlwiLFxuICAgICAgICBcInBhc3RlXCI6XCJlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiY29weVwiOlwia29waWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBkZWFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJOZXUgbGFkZW5cIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV29sbGVuIFNpZSBkZW4gVGV4dGVkaXRvciBuZXUgaW5pdGlhbGlzaWVyZW4/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcIkluaGFsdCBiZWliZWhhbHRlblwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJTb25kZXJ6ZWljaGVuIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJwcmludFwiOiBcImRydWNrZW5cIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIkF1ZGlvIGFic3BpZWxlblwiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIldvbGxlbiBTaWUgZGFzIEhcdTAwRjZyYmVpc3BpZWwgamV0enQgYWJzcGllbGVuP1wiLFxuICAgICAgICBcImF1ZGlvcmVtYWluaW5nXCI6XCJWZXJibGVpYmVuZGUgRHVyY2hsXHUwMEU0dWZlOlwiLFxuICAgICAgICBcImF1ZGlvbm90YWxsb3dlZFwiOlwiU2llIGhhYmVuIGtlaW5lIEJlcmVjaHRpZ3VuZyBkaWUgQXVkaW9kYXRlaSBlcm5ldXQgYWJ6dXNwaWVsZW4hXCIsXG4gICAgICAgIFwiaW5zZXJ0XCI6XCJCaWxkIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJpbnNlcnRtdWdcIjpcIk11Z3Nob3QgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIkFyYmVpdCBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIlNjaGxpZVx1MDBERmVuXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRGF0ZWluYW1lXCIsXG4gICAgICAgIFwibm9zcGVjaWFsXCI6IFwiQml0dGUgZ2ViZW4gU2llIG51ciBCdWNoc3RhYmVuIG9kZXIgWmFobGVuIGVpbi5cIixcbiAgICAgICAgXCJjbGVhclwiOiBcIkFsbGUgQmVyZWNobnVuZ2VuIGxcdTAwRjZzY2hlbj9cIlxuICAgIH0sXG4gICAgXCJnZW5lcmFsXCI6e1xuICAgICAgICBcImVycm9yXCI6IFwiRmVobGVyXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJLZWluZSBnXHUwMEZDbHRpZ2UgUERGIERhdGVpXCIsXG4gICAgICAgIFwid3JvbmdwYXNzd29yZFwiOiBcIkZhbHNjaGVzIFBhc3N3b3J0XCJcbiAgICB9LFxuICAgIFwid2Vic2l0ZVwiOiB7XG4gICAgICAgIFwicmVsb2Fkd2Vidmlld1wiOiBcIldlYnZpZXcgbmV1IGxhZGVuXCJcbiAgICB9LFxuICAgIFwicGRmXCI6IHtcbiAgICAgICAgXCJ3YXJuaW5nVGl0bGVcIjogXCJNXHUwMEY2Z2xpY2hlcndlaXNlIGdlc2Nhbm50ZXMgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIkF1ZlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlXCI6IFwid3VyZGVuIHdlbmlnZXIgYWxzIDIgaW50ZXJha3RpdmUgRm9ybXVsYXJmZWxkZXIgZ2VmdW5kZW4uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiRGllcyBkZXV0ZXQgZGFyYXVmIGhpbiwgZGFzcyBlcyBzaWNoIHVtIGVpbiBnZXNjYW5udGVzIFBERiBoYW5kZWx0LCBkYXMga2VpbmUgYWt0aXZlbiBGb3JtdWxhcmZlbGRlciBvZGVyIFRhYmVsbGVuIGVudGhcdTAwRTRsdC5cIixcbiAgICAgICAgXCJ1bmRlcnN0b29kXCI6IFwiVmVyc3RhbmRlblwiLFxuICAgICAgICBcInBhZ2VcIjogXCJTZWl0ZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiU2VpdGVuXCJcbiAgICB9XG59XG4iLCAiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbmNvbnN0IHB1YmxpY0Jhc2UgPSAoKSA9PiBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcblxubGV0IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJyk7XG5sZXQgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihwdWJsaWNCYXNlKCksICdMYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKTtcblxuXG5cblxuXG5jbGFzcyBMYW5ndWFnZVRvb2xTZXJ2ZXIge1xuICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIEluaXRpYWxpc2llcnQgZGllIFByb3plc3N2YXJpYWJsZVxuICAgICAgICAgdGhpcy5wb3J0ID0gODA4OFxuICAgICB9XG4gXG4gICAgIHN0YXJ0U2VydmVyKCkge1xuICAgICAgICAgaWYgKHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyAmJiAhdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcuJyk7XG4gICAgICAgICAgICAgcmV0dXJuOyAvLyBWZXJoaW5kZXJ0IGRhcyBlcm5ldXRlIFN0YXJ0ZW4sIHdlbm4gZGVyIFNlcnZlciBiZXJlaXRzIGxcdTAwRTR1ZnRcbiAgICAgICAgIH1cbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBKcmVIYW5kbGVyLmpTcGF3bihcbiAgICAgICAgICAgICAgICBbbGFuZ3VhZ2VUb29sSmFyUGF0aF0sIC8vIEtsYXNzZW5wZmFkXG4gICAgICAgICAgICAgICAgJ29yZy5sYW5ndWFnZXRvb2wuc2VydmVyLkhUVFBTZXJ2ZXInLCAvLyBIYXVwdGtsYXNzZSBkZXIgTGFuZ3VhZ2VUb29sIEFQSVxuICAgICAgICAgICAgICAgIFsnLS1wb3J0JywgdGhpcy5wb3J0LCctLWNvbmZpZycsbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCwgJy0tYWxsb3ctb3JpZ2luJywgXCInKidcIiBdIC8vIFp1c1x1MDBFNHR6bGljaGUgQXJndW1lbnRlLCB6LkIuIFBvcnQgdW5kIENPUlMtRXJsYXVibmlzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKVxuICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgQVBJIHJ1bm5pbmcgYXQgbG9jYWxob3N0OjgwODgnKTtcblxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIGRhdGEgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGE6IFJlY2VpdmVkIGRhdGEgZnJvbSBMYW5ndWFnZVRvb2wgQVBJJywgZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdlcnJvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1lcnJvcjonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3N0YXJ0aW5nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjaGVjayBkb25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdoYW5kbGVkIHJlcXVlc3QnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gQWNjdW11bGF0ZSBzdGRlcnIgZGF0YSB0byBoYW5kbGUgY2h1bmtlZCBvdXRwdXRcbiAgICAgICAgICAgIGxldCBzdGRlcnJCdWZmZXIgPSAnJztcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydFN0ciA9IFN0cmluZyh0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGJvdGggY3VycmVudCBjaHVuayBhbmQgYWNjdW11bGF0ZWQgYnVmZmVyIGZvciBwb3J0LXJlbGF0ZWQgZXJyb3JzXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFJlc3BvbnNlID0gc3RkZXJyQnVmZmVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUG9ydEVycm9yID0gZnVsbFJlc3BvbnNlLmluY2x1ZGVzKHBvcnRTdHIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZHJlc3NlIHdpcmQgYmVyZWl0cyB2ZXJ3ZW5kZXRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIk1heWJlIHNvbWV0aGluZyBlbHNlIGlzIHJ1bm5pbmcgb24gdGhhdCBwb3J0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZGRyZXNzIGFscmVhZHkgaW4gdXNlXCIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpc1BvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IGFub3RoZXIgTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBwcm9iYWJseSBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydDonLCB0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuay5pbmNsdWRlcygnXFxuJykgfHwgZnVsbFJlc3BvbnNlLmxlbmd0aCA+IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgd2UgaGF2ZSBhIG5ld2xpbmUgKGxpa2VseSBjb21wbGV0ZSBtZXNzYWdlKSBvciBidWZmZXIgaXMgZ2V0dGluZyBsYXJnZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGEtZXJyb3I6JywgZnVsbFJlc3BvbnNlLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgbG9nZ2luZ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGx0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIFNldHp0IGRlbiBQcm96ZXNzIHp1clx1MDBGQ2NrLCB3ZW5uIGVyIGJlZW5kZXQgd2lyZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZ2VuZXJhbC1lcnJvcjonLCBlcnIpO1xuICAgICAgICB9XG5cblxuICAgICB9XG5cbiAgICAgc3RvcFNlcnZlcigpIHtcbiAgICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWRcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKSB7XG4gICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWQsIG5vdGhpbmcgdG8gc3RvcCcpO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGtpbGwgdGhlIHByb2Nlc3MgZGlyZWN0bHkgaWYgd2UgaGF2ZSBhIHJlZmVyZW5jZVxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBraWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZmFpbGVkIHRvIGtpbGwgcHJvY2VzcyBkaXJlY3RseSwgdHJ5aW5nIHBsYXRmb3JtLXNwZWNpZmljIG1ldGhvZDonLCBlcnIpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBwbGF0Zm9ybS1zcGVjaWZpYyBjb21tYW5kcyB0byBraWxsIHRoZSBwcm9jZXNzIChvbmx5IGlmIHdlIGhhZCBhIHByb2Nlc3MgcmVmZXJlbmNlKVxuICAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICAgbGV0IGNvbW1hbmQ7XG5cbiAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgIC8vIFdpbmRvd3M6IGZpbmQgYW5kIGtpbGwgamF2YSBwcm9jZXNzZXMgcnVubmluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB3bWljICh3b3JrcyBvbiBvbGRlciBXaW5kb3dzKSwgdGhlbiB0cnkgUG93ZXJTaGVsbCwgdGhlbiBmYWxsYmFjayB0byBwb3J0LWJhc2VkIGtpbGxcbiAgICAgICAgICAgICBjb21tYW5kID0gYHdtaWMgcHJvY2VzcyB3aGVyZSBcImNvbW1hbmRsaW5lIGxpa2UgJyVsYW5ndWFnZXRvb2wtc2VydmVyLmphciUnXCIgZGVsZXRlIDI+bnVsIHx8IHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyBqYXZhIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHskXy5Db21tYW5kTGluZSAtbGlrZSAnKmxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyKid9IHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZVwiIDI+bnVsIHx8IGZvciAvZiBcInRva2Vucz01XCIgJWEgaW4gKCduZXRzdGF0IC1hbm8gXnwgZmluZHN0ciA6ODA4OCcpIGRvIHRhc2traWxsIC9GIC9QSUQgJWEgMj5udWxgO1xuICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICAgICAvLyBtYWNPUyBhbmQgTGludXg6IHVzZSBwa2lsbCB0byBraWxsIHByb2Nlc3NlcyBtYXRjaGluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIGNvbW1hbmQgPSAncGtpbGwgLWYgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogdW5zdXBwb3J0ZWQgcGxhdGZvcm06JywgcGxhdGZvcm0pO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIC8vIEl0J3Mgb2theSBpZiB0aGUgcHJvY2VzcyBpcyBub3QgZm91bmQgKGFscmVhZHkga2lsbGVkKVxuICAgICAgICAgICAgICAgICAvLyBwa2lsbCByZXR1cm5zIGNvZGUgMSB3aGVuIG5vIHByb2Nlc3MgaXMgZm91bmQsIHdoaWNoIGlzIGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAxICYmICFlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSAmJiAhc3RkZXJyLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ05vIHN1Y2ggcHJvY2VzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZXJyb3Iga2lsbGluZyBMYW5ndWFnZVRvb2wgc2VydmVyOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBub3QgZm91bmQgKG1heSBhbHJlYWR5IGJlIHN0b3BwZWQpJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBzdG9wcGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgfSk7XG4gICAgIH1cbiB9XG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBMYW5ndWFnZVRvb2xTZXJ2ZXIoKVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbiAvLyBldmVyeSBwbGF0Zm9ybSBuZWVkcyBpdCdzIG93biBqcmUgKGxpbnV4LCB3aW4zMiwgZGFyd2luKSAvL2ZpeG1lOiB1c2UgR3JhYWxWTSB0byBwcmVjb21waWxlIGxhbmd1YWdldG9vbCBpbiBvcmRlciB0byBzYXZlIHNwYWNlIGFuZCBnZXQgcmlkIG9mIGpyZT9cbmNsYXNzIEpyZUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHsgfVxuXG4gICAgaW5pdCgpeyBcbiAgICAgICAgdGhpcy5qVGVzdCgpXG4gICAgfVxuXG5cbiAgICBqVGVzdCgpe1xuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpOyAvLyAnL3BmYWQvenVyL2phdmEnXG4gICAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihqYXZhcGF0aCwgWyctdmVyc2lvbiddKTtcbiAgICBcbiAgICAgICAgcHJvYy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTsgLy8gaW4gWmVpbGVuIHNwbGl0dGVuXG4gICAgICAgICAgICBsb2cuZGVidWcoYGpyZS1oYW5kbGVyIEAgalRlc3Q6ICR7bGluZXNbMF19YCk7IC8vIG51ciBkaWUgZXJzdGUgWmVpbGUgbG9nZ2VuXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmYWlsKHJlYXNvbikge1xuICAgICAgICBsb2cuZXJyb3IocmVhc29uKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cblxuICAgIGdldERpcmVjdG9yaWVzKGRpclBhdGgpIHtcbiAgICAgICAgbGV0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKS5maWx0ZXIoXG4gICAgICAgICAgICBmaWxlID0+IGZzLnN0YXRTeW5jKHBhdGguam9pbihkaXJQYXRoLCBmaWxlKSkuaXNEaXJlY3RvcnkoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZGlyc1xuICAgIH0gXG5cbiAgICBkcml2ZXIoKXtcbiAgICAgICAgdmFyIGQgPSBwbGF0Zm9ybURpc3BhdGNoZXIuamF2YUJpbi5zbGljZSgpO1xuICAgICAgICBkLnVuc2hpZnQocGxhdGZvcm1EaXNwYXRjaGVyLmpyZURpcik7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4uYXBwbHkocGF0aCwgZCk7XG4gICAgfVxuXG4gICAgZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBhcmdzID0gKGFyZ3MgfHwgW10pLnNsaWNlKCk7XG4gICAgICAgIGNsYXNzcGF0aCA9IGNsYXNzcGF0aCB8fCBbXTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzbmFtZSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc3BhdGguam9pbih0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JykpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoJy1jcCcpO1xuICAgICAgICByZXR1cm4gYXJncztcbiAgICB9XG5cbiAgICBqU3Bhd24oY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgXG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKClcbiAgICAgICAgbGV0IGphdmFhcmdzID0gdGhpcy5nZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKVxuICAgICAgICBsZXQgamF2YWNtZGxpbmUgPSAgYCR7amF2YXBhdGh9ICR7amF2YWFyZ3Muam9pbignICcpfSBgXG5cbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiAnJHtwbGF0Zm9ybURpc3BhdGNoZXIuanJlfScgc2VsZWN0ZWRgKVxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246IHNwYXduaW5nIGphdmEgcHJvY2VzczogJHtqYXZhY21kbGluZX1gKVxuICAgICAgICByZXR1cm4gc3Bhd24oamF2YXBhdGgsIGphdmFhcmdzLCB7c2hlbGw6ZmFsc2V9KTtcbiAgICAgICAvLyByZXR1cm4gc3Bhd24oamF2YWNtZGxpbmUpO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSnJlSGFuZGxlcigpXG4iLCAiLy8gc2NyaXB0cy9TeXN0ZW1UcmF5TWFuYWdlci5qc1xuaW1wb3J0IHsgYXBwLCBUcmF5LCBNZW51IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnO1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxubGV0IHRyYXkgPSBudWxsO1xuXG4vLyBSZXNvbHZlIGljb24gcGF0aDogcGFja2FnZWQgYXBwIHVzZXMgdW5wYWNrZWQgcHVibGljIGRpciwgZGV2IHVzZXMgcHJvamVjdCBwdWJsaWNcbmZ1bmN0aW9uIGdldFRyYXlJY29uUGF0aCgpIHtcbiAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlO1xuICByZXR1cm4gcGF0aC5qb2luKHB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uMjR4MjQucG5nJyk7XG59IFxuXG4vLyA9PT0gcmVwbGFjZSB0aGUgaGVscGVyIHNldExvY2FsZSAoZXhhY3QgYmxvY2spID09PVxuY29uc3Qgc2V0TG9jYWxlID0gKGxvYykgPT4ge1xuICAgIGNvbnN0IGdsID0gaTE4bi5nbG9iYWw7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZ2xvYmFsIGNvbXBvc2VyXG4gICAgaWYgKGdsICYmIHR5cGVvZiBnbC5sb2NhbGUgPT09ICdvYmplY3QnICYmIGdsLmxvY2FsZSkge1xuICAgICAgLy8gdnVlLWkxOG4gY29tcG9zaXRpb24gbW9kZVxuICAgICAgaWYgKCd2YWx1ZScgaW4gZ2wubG9jYWxlKSBnbC5sb2NhbGUudmFsdWUgPSBsb2M7ICAgICAvLyBzZXQgcmVhY3RpdmUgdmFsdWVcbiAgICAgIGVsc2UgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbGJhY2tcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbGVnYWN5IG1vZGUgb3IgcGxhaW4gc3RyaW5nXG4gICAgICBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbiBzdHJpbmcgbG9jYWxlXG4gICAgfVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gIFxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB0cmF5IGljb24gaWYgaXQgZG9lc24ndCBleGlzdCBhbmQgdXBkYXRlcyBpdHMgY29udGV4dCBtZW51LlxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBuZXcgbG9jYWxlIHRvIGFwcGx5LlxuICovXG5cblxuXG5leHBvcnQgY29uc3QgdXBkYXRlU3lzdGVtVHJheSA9IChsb2NhbGUpID0+IHtcbiAgICBzZXRMb2NhbGUobG9jYWxlKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IHQgPSAoaykgPT4gaTE4bi5nbG9iYWwudChrKTsgICAgICAgICAgICAgICAgICAgICAgLy8gYWx3YXlzIHJlc29sdmUgbGl2ZVxuICBcbiAgICBpZiAoIXRyYXkpIHtcbiAgICAgIHRyYXkgPSBuZXcgVHJheShnZXRUcmF5SWNvblBhdGgoKSk7XG4gICAgICB0cmF5Lm9uKCdjbGljaycsICgpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2dnbGUgd2luZG93XG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSBcbiAgICAgICAgICA/IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5oaWRlKCkgXG4gICAgICAgICAgOiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpO1xuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICAvLyBidWlsZCBjb250ZXh0IG1lbnUgd2l0aCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IGNvbnRleHRNZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZShbXG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkucmVzdG9yZScpLCBjbGljazogKCkgPT4gV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKSB9LCAvLyBzaG93IHdpbmRvd1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmRpc2Nvbm5lY3QnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLmluZm8oXCJtYWluIEAgc3lzdGVtdHJheTogcmVtb3ZpbmcgcmVnaXN0cmF0aW9uXCIpOyBcbiAgICAgICAgICBDb21tSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKTsgXG4gICAgICAgIH0gXG4gICAgICB9LCAvLyBkaXNjb25uZWN0XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZXhpdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiBDbG9zaW5nIE5leHQtRXhhbVwiKTsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiKTsgXG4gICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7IFxuICAgICAgICAgIGFwcC5xdWl0KCk7IFxuICAgICAgICB9IFxuICAgICAgfSAvLyBleGl0XG4gICAgXSk7XG4gIFxuICAgIHRyYXkuc2V0VG9vbFRpcCgnTmV4dC1FeGFtIFN0dWRlbnQnKTsgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRvb2x0aXBcbiAgICB0cmF5LnNldENvbnRleHRNZW51KGNvbnRleHRNZW51KTsgICAgICAgICAgICAgICAgICAgICAgIC8vIGFwcGx5IG1lbnVcbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICAiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgc2NyaXB0IGlzIHVzZWQgdG8gdGVzdCB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAqIEl0IHVzZXMgdGhlIHRjY3V0aWwgY29tbWFuZCB0byB0ZXN0IGFuZCByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAqIEl0IHJldHVybnMgdHJ1ZSBpZiB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBhcmUgYWxsb3dlZCBhbmQgZmFsc2UgaWYgdGhleSBhcmUgbm90XG4gKiBcbiAqIFRoaXMgY291bGQgYWxzbyBiZSB1c2VkIHRvIHRlc3Qgb3RoZXIgcGVybWlzc2lvbnMgbGlrZSBhY2Nlc3NpYmlsaXR5LCBzY3JlZW4gY2FwdHVyZSwgZXRjLiBcbiAqIHNlZSBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBmb3IgbW9yZSBkZXRhaWxzIG9uIGhvdyB0byB0ZXN0IGZvciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIChpdHMgbm90IHBvc3NpYmxlIHRvIHRlc3QgZm9yIHNjcmVlbiBjYXB0dXJlIHBlcm1pc3Npb25zIG9uIG1hY29zIGJlY2F1c2Ugd2l0aG91dCBwZXJtaXNzaW9ucyBpdCB3aWxsIGFsd2F5cyByZXR1cm4gYSBibGFuayBzY3JlZW5zaG90IC0gd2UgdXNlIGEgd29ya2Fyb3VuZCB0byBkZXRlY3QgdGhpcylcbiAqIFxuICovXG5cblxuXG5cbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcnVuIHRjY3V0aWxcbmltcG9ydCB7IGRpYWxvZywgYXBwIH0gZnJvbSAnZWxlY3Ryb24nICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNob3cgZGlhbG9nIGFuZCBxdWl0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgICAgICAgICAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGZldGNoIHdvcmtzXG4gICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7c2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcG9uZ2AsIHsgbWV0aG9kOiAnR0VUJywgY2FjaGU6ICduby1zdG9yZScgfSkgLy8gdGVzdCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gcmVzLm9rXG4gICAgfSBjYXRjaCB7ICByZXR1cm4gZmFsc2UgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzZXRUQ0MoKSB7ICAgICAgLy8gcmVzZXQgVENDIHBlcm1pc3Npb25zXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy9hcHBJZFxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0uc3R1ZGVudGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vYXBwQnVuZGxlSWQgKHNldCB2aWEgbm90YXJpemUpXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS1zdHVkZW50LmFwcGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG5cblxuICAgIH0pXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAvLyBjaGVjayBvciByZXNldFxuICAgIGNvbnN0IG9rID0gYXdhaXQgdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KVxuICAgIGlmIChvaykge1xuICAgICAgICAgICAgbG9nLmluZm8oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBOZXR3b3JrIGFjY2VzcyBpcyBhbGxvd2VkYCk7XG4gICAgICAgICAgICByZXR1cm4gXCJva1wiO1xuICAgIH1cbiAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5vIEhUVFAgcmVxdWVzdHMgYWxsb3dlZCFgIClcblxuICAgIHRyeSB7XG5cbiAgICAgICAgLy8gYXNrIHRoZSB1c2VycyBpZiB0aGV5IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zIGFuZCBleGl0IHRoZSBhcHAgaWYgdGhleSBkb1xuICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRGVyIFNlcnZlciBpc3QgbmljaHQgZXJyZWljaGJhci4gTVx1MDBGNmNodGVuIFNpZSBkaWUgQmVyZWNodGlndW5nZW4genVyXHUwMEZDY2tzZXR6ZW4gdW5kIE5leHQtRXhhbSBtYW51ZWxsIG5ldSBzdGFydGVuPycsXG4gICAgICAgICAgICBidXR0b25zOiBbJ09LJywgJ0FiYnJlY2hlbiddLFxuICAgICAgICB9KVxuICAgICAgICBpZiAoY2hvaWNlLnJlc3BvbnNlID09PSAwKSB7ICAgIC8vIHJlc2V0IHBlcm1pc3Npb25zIGFuZCByZXR1cm4gdHJ1ZSB0byBxdWl0IHRoZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogUmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnMgYW5kIHF1aXR0aW5nIGFwcGApO1xuICAgICAgICAgICAgYXdhaXQgcmVzZXRUQ0MoKTsgXG4gICAgICAgICAgICByZXR1cm4gXCJyZXNldFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZSBcbiAgICAgICAgfSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuIFxuICAgIH0gXG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nLmVycm9yKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogRXJyb3IgcmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnM6ICR7ZX1gKTtcbiAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRmVobGVyIGJlaW0gWnVyXHUwMEZDY2tzZXR6ZW4gZGVyIEJlcmVjaHRpZ3VuZ2VuJyxcbiAgICAgICAgICAgIGRldGFpbDogU3RyaW5nKGUuZXJyIHx8IGUpLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gZmFsc2UgICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIENvdW50ZXIgZm9yIGZhaWxlZCBhdHRlbXB0cyAtIHNraXAgZXhlY3V0aW9uIGFmdGVyIDQgY29uc2VjdXRpdmUgZmFpbHVyZXNcbmxldCBmYWlsdXJlQ291bnRlciA9IDA7XG5jb25zdCBNQVhfRkFJTFVSRVMgPSAzO1xuXG4vLyBDb252ZXJ0IFJTU0kgaW4gZEJtIHRvIGEgcXVhbGl0eSBwZXJjZW50YWdlIGJldHdlZW4gMCBhbmQgMTAwLlxuZnVuY3Rpb24gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pIHtcbiAgICBpZiAoZGJtID09PSBudWxsIHx8IE51bWJlci5pc05hTihkYm0pKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBtaW5EYm0gPSAtMTAwO1xuICAgIGNvbnN0IG1heERibSA9IC0zMDtcbiAgICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgobWluRGJtLCBNYXRoLm1pbihtYXhEYm0sIGRibSkpO1xuICAgIGNvbnN0IHBlcmNlbnQgPSAoKGNsYW1wZWQgLSBtaW5EYm0pIC8gKG1heERibSAtIG1pbkRibSkpICogMTAwO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHBlcmNlbnQpO1xufVxuXG4vKipcbiAqIEdldCBjdXJyZW50IFdMQU4gaW5mb3JtYXRpb24gKFNTSUQsIEJTU0lELCBRdWFsaXR5KVxuICogQHJldHVybnMge1Byb21pc2U8e3NzaWQ6IHN0cmluZ3xudWxsLCBic3NpZDogc3RyaW5nfG51bGwsIHF1YWxpdHk6IG51bWJlcnxudWxsLCBtZXNzYWdlOiBzdHJpbmd8bnVsbH0+fVxuICogQGRlc2NyaXB0aW9uIG1lc3NhZ2UgY2FuIGJlOiBcImVycm9yXCIgKG9uIGVycm9yKSwgXCJub2ludGVyZmFjZVwiIChubyBpbnRlcmZhY2UgYXZhaWxhYmxlKSwgXCJub3Blcm1pc3Npb25zXCIgKGxvY2F0aW9uIHBlcm1pc3Npb25zIG1pc3Npbmcgb24gV2luZG93cyksIG9yIG51bGwgKHN1Y2Nlc3MpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mbygpIHtcbiAgICAvLyBTa2lwIGV4ZWN1dGlvbiBpZiB3ZSd2ZSBoYWQgdG9vIG1hbnkgY29uc2VjdXRpdmUgZmFpbHVyZXNcbiAgICBpZiAoZmFpbHVyZUNvdW50ZXIgPj0gTUFYX0ZBSUxVUkVTKSB7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb0xpbnV4KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTWFjT1MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBFbnN1cmUgcmVzdWx0IGlzIGFsd2F5cyBhbiBvYmplY3RcbiAgICAgICAgaWYgKCFyZXN1bHQgfHwgdHlwZW9mIHJlc3VsdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZXNldCBjb3VudGVyIG9uIHN1Y2Nlc3NmdWwgcmVzdWx0IChoYXMgZGF0YSlcbiAgICAgICAgaWYgKHJlc3VsdC5zc2lkIHx8IHJlc3VsdC5ic3NpZCB8fCByZXN1bHQucXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSW5jcmVtZW50IGNvdW50ZXIgb24gZmFpbHVyZVxuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBSZXR1cm4gZW1wdHkgb2JqZWN0IGluc3RlYWQgb2YgdGhyb3dpbmcgdG8gcHJldmVudCBhcHAgY3Jhc2hcbiAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBMaW51eCB1c2luZyBubWNsaSAod2l0aCBmYWxsYmFjayB0byBpdy9pd2NvbmZpZylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9MaW51eCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgbm1jbGkgZmlyc3QgKG1vc3QgY29tbW9uIG9uIG1vZGVybiBMaW51eClcbiAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGdldCBhY3RpdmUgZGV2aWNlIGRpcmVjdGx5IChmYXN0ZXIgdGhhbiBsaXN0aW5nIGFsbCBuZXR3b3JrcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBzdGRvdXQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoJ25tY2xpIC10IC1mIGFjdGl2ZSxzc2lkLGJzc2lkLHNpZ25hbCBkZXZpY2Ugd2lmaSBsaXN0Jywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA0MDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0ZG91dCA9IHJlc3VsdC5zdGRvdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4ZWNFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEV2ZW4gaWYgZXhlY0FzeW5jIHRocm93cyBhbiBlcnJvciwgY2hlY2sgaWYgc3Rkb3V0IGNvbnRhaW5zIHZhbGlkIGRhdGFcbiAgICAgICAgICAgICAgICAvLyBubWNsaSBzb21ldGltZXMgcmV0dXJucyBub24temVybyBleGl0IGNvZGUgYnV0IHN0aWxsIHByb3ZpZGVzIHZhbGlkIG91dHB1dFxuICAgICAgICAgICAgICAgIGlmIChleGVjRXJyb3Iuc3Rkb3V0ICYmIGV4ZWNFcnJvci5zdGRvdXQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc3Rkb3V0ID0gZXhlY0Vycm9yLnN0ZG91dDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBleGVjRXJyb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3V0cHV0IGZyb20gbm1jbGknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpbmQgYWN0aXZlIGNvbm5lY3Rpb25cbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gbGluZS5zcGxpdCgnOicpO1xuICAgICAgICAgICAgICAgIGlmICgocGFydHNbMF0gPT09ICd5ZXMnIHx8IHBhcnRzWzBdID09PSAnamEnKSAmJiBwYXJ0cy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gcGFydHNbMV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIC8vIEJTU0lEIGlzIGEgTUFDIGFkZHJlc3MgKDYgaGV4IGJ5dGVzIHNlcGFyYXRlZCBieSBjb2xvbnMsIHBvc3NpYmx5IGVzY2FwZWQpXG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgdXNpbmcgcmVnZXggLSBoYW5kbGUgZXNjYXBlZCBjb2xvbnMgKFxcOikgYXMgc2hvd24gaW4gbm1jbGkgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHJlZ2V4IHN0cmluZywgXFxcXDogbWF0Y2hlcyBhIGxpdGVyYWwgYmFja3NsYXNoIGZvbGxvd2VkIGJ5IGNvbG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OlxcXFw6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGVzY2FwZSBiYWNrc2xhc2hlcyBhbmQgbm9ybWFsaXplIHRvIHVwcGVyY2FzZVxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoWzBdLnJlcGxhY2UoL1xcXFw6L2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB0cnkgbm9ybWFsIGNvbG9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG5vcm1hbE1hdGNoWzBdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gcGFydHNbMl0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gU2lnbmFsIGlzIHRoZSBsYXN0IG51bWVyaWMgcGFydFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxTdHIgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA/IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnRyaW0oKSA6ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWwgPSBzaWduYWxTdHIgPyAocGFyc2VJbnQoc2lnbmFsU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAobm1jbGlFcnJvcikge1xuICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0LCBldGMuKSwgbm90IGlmIGp1c3Qgbm8gV0xBTiBhY3RpdmVcbiAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gbm1jbGlFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBubWNsaUVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobm1jbGlFcnJvci5tZXNzYWdlICYmICFubWNsaUVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ05vIG91dHB1dCcpKTtcbiAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogbm1jbGkgY29tbWFuZCBmYWlsZWQ6Jywgbm1jbGlFcnJvci5tZXNzYWdlIHx8IG5tY2xpRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBpdyAoaXdjb25maWcgaXMgZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3U3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUUgXCJeXFxzKnNzaWR8XlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3bGlua1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1BIDUgXCJeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IFNTSURcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBpd1N0ZG91dCA/IGl3U3Rkb3V0Lm1hdGNoKC9zc2lkXFxzKyguKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHNzaWRNYXRjaCA/IHNzaWRNYXRjaFsxXS50cmltKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgYW5kIHNpZ25hbCBmcm9tIGxpbmsgaW5mb1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL2FkZHI6XFxzKyhbYS1mMC05Ol17MTd9KS9pKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvc2lnbmFsOlxccysoLT9cXGQrKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxEYm0gPSBzaWduYWxNYXRjaCA/IChwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWFsaXR5ID0gc2lnbmFsRGJtICE9PSBudWxsID8gZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWxEYm0pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGNhdGNoIChpd0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3RXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBpdyBjb21tYW5kIGZhaWxlZDonLCBpd0Vycm9yLm1lc3NhZ2UgfHwgaXdFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIExhc3QgZmFsbGJhY2s6IGl3Y29uZmlnIChkZXByZWNhdGVkIGJ1dCB3aWRlbHkgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3Y29uZmlnIDI+L2Rldi9udWxsIHwgZ3JlcCAtRSBcIkVTU0lEfEFjY2VzcyBQb2ludHxTaWduYWwgbGV2ZWxcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gbGluZS5tYXRjaCgvRVNTSUQ6XCIoW15cIl0rKVwiLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3NpZE1hdGNoKSBzc2lkID0gc3NpZE1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQWNjZXNzIFBvaW50OlxccysoW2EtZjAtOTpdezE3fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkgYnNzaWQgPSBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvU2lnbmFsIGxldmVsPSgtP1xcZCspLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGl3Y29uZmlnRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgYWxsIG1ldGhvZHMgZmFpbGVkIHdpdGggcmVhbCBlcnJvcnMgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdjb25maWdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IEFsbCBtZXRob2RzIChubWNsaSwgaXcsIGl3Y29uZmlnKSBmYWlsZWQuIExhc3QgZXJyb3I6JywgaXdjb25maWdFcnJvci5tZXNzYWdlIHx8IGl3Y29uZmlnRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnZXJyb3InXG4gICAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnXG4gICAgfTtcbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgbmV0c2hcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c2ggd2xhbiBzaG93IGludGVyZmFjZXMnLCB7XG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBzdGRlcnIgZm9yIHNlcnZpY2UgZXJyb3JzXG4gICAgICAgIGNvbnN0IGVycm9yT3V0cHV0ID0gKHN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gKHN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRPdXRwdXQgPSBvdXRwdXQgKyAnICcgKyBlcnJvck91dHB1dDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIFdMQU4gc2VydmljZSBpcyBub3QgcnVubmluZyAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuc3ZjJykgfHwgXG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbiBhdXRvY29uZmlnJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdhdXRvbWF0aXNjaCB3bGFuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuLWtvbmZpZ3VyYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc2VydmljZSBpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGVyIGRpZW5zdCcpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgbm8gaW50ZXJmYWNlcyBhdmFpbGFibGVcbiAgICAgICAgaWYgKHN0ZG91dC5pbmNsdWRlcygnVGhlcmUgaXMgbm8gd2lyZWxlc3MgaW50ZXJmYWNlJykgfHwgXG4gICAgICAgICAgICBzdGRvdXQuaW5jbHVkZXMoJ0VzIGdpYnQga2VpbmUgRHJhaHRsb3MtU2Nobml0dHN0ZWxsZScpIHx8XG4gICAgICAgICAgICBzdGRvdXQubWF0Y2goL05vIHdpcmVsZXNzL2kpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUubGVuZ3RoID4gMCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAvLyBTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlLCBoYW5kbGVzIHZhcmlvdXMgZm9ybWF0c1xuICAgICAgICAgICAgLy8gVXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmQgdG8gZW5zdXJlIHdlIGRvbid0IG1hdGNoIFwiQlNTSURcIiAod2hpY2ggY29udGFpbnMgXCJTU0lEXCIpXG4gICAgICAgICAgICBpZiAobGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjpcXHMqKC4rKS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHNldCBpZiBub3QgZW1wdHkgYW5kIG5vdCBcIk4vQVwiIG9yIHNpbWlsYXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZCAmJiBleHRyYWN0ZWQubGVuZ3RoID4gMCAmJiAhZXh0cmFjdGVkLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGV4dHJhY3RlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEJTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlIHBhdHRlcm4gbWF0Y2hpbmdcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL0JTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gKGhhbmRsZXMgYm90aCAtIGFuZCA6IHNlcGFyYXRvcnMsIHdpdGggb3Igd2l0aG91dCBzcGFjZXMpXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRFxccyo6XFxzKihbYS1mMC05XXsyfSg/OlstOlxcc11bYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG1hdGNoWzFdLnJlcGxhY2UoL1stIF0vZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNpZ25hbCBwYXJzaW5nIC0gaGFuZGxlIHZhcmlvdXMgbG9jYWxpemVkIGZvcm1hdHMgYW5kIHBhdHRlcm5zXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9TaWduYWx8U2lnbmFsc3RcdTAwRTRya2V8SW50ZW5zaXRcdTAwRTl8U2VcdTAwRjFhbC9pKSkge1xuICAgICAgICAgICAgICAgIC8vIFRyeSBwZXJjZW50YWdlIHBhdHRlcm4gZmlyc3QgKG1vc3QgY29tbW9uKVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKFxcZCspXFxzKiUvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPj0gMCAmJiBwYXJzZWQgPD0gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgZEJtIHBhdHRlcm4gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKC0/XFxkKylcXHMqZEJtL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRibSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGRibSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBlbXB0eSBzdHJpbmdzIHRvIG51bGxcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IChzc2lkICYmIHNzaWQubGVuZ3RoID4gMCkgPyBzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiAoYnNzaWQgJiYgYnNzaWQubGVuZ3RoID4gMCkgPyBic3NpZCA6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgZXJyb3IgaXMgZHVlIHRvIGxvY2F0aW9uIHBlcm1pc3Npb25zIChtaWdodCBiZSBpbiBzdGRlcnIgb3IgZXJyb3IgbWVzc2FnZSlcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gKGVycm9yLm1lc3NhZ2UgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3Rkb3V0ID0gKGVycm9yLnN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRlcnIgPSAoZXJyb3Iuc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZEVycm9yT3V0cHV0ID0gZXJyb3JNZXNzYWdlICsgJyAnICsgZXJyb3JTdGRvdXQgKyAnICcgKyBlcnJvclN0ZGVycjtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIExvZyBlcnJvciB3aGVuIGNvbW1hbmQgZXhlY3V0aW9uIGZhaWxzICh0aW1lb3V0LCBwZXJtaXNzaW9uLCBldGMuKVxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93czogRXJyb3IgZXhlY3V0aW5nIG5ldHNoIGNvbW1hbmQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsIChmYWxsYmFjayB3aGVuIG5ldHNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSAoZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uKVxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGFjdGl2ZSBXaS1GaSBjb25uZWN0aW9uIHByb2ZpbGVcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Bvd2Vyc2hlbGwgLUNvbW1hbmQgXCIkcHJvZmlsZSA9IEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSB8IFdoZXJlLU9iamVjdCB7JF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpLUZpKlxcJyAtb3IgJF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpcmVsZXNzKlxcJ30gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxOyBpZiAoJHByb2ZpbGUpIHsgJHByb2ZpbGUuTmFtZSB9XCInLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBzc2lkU3RyID0gc3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBpZiAoc3NpZFN0ciAmJiBzc2lkU3RyLmxlbmd0aCA+IDAgJiYgIXNzaWRTdHIubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRTdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBCU1NJRCBjYW5ub3QgYmUgZWFzaWx5IHJldHJpZXZlZCB3aXRob3V0IG5ldHNoICh3aGljaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAgICAgICAgLy8gU2V0dGluZyB0byBudWxsIGFzIGZhbGxiYWNrIC0gU1NJRCBpcyB0aGUgbW9zdCBpbXBvcnRhbnQgaW5mb3JtYXRpb24gYW55d2F5XG4gICAgICAgIGNvbnN0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBQb3dlclNoZWxsIGZhbGxiYWNrIChjYW4ndCBlYXNpbHkgZ2V0IHNpZ25hbCBzdHJlbmd0aCB3aXRob3V0IG5ldHNoKVxuICAgICAgICAvLyBSZXR1cm4gbm9wZXJtaXNzaW9ucyBtZXNzYWdlIHNvIGZyb250ZW5kIGNhbiBzaG93IHRoZSB3YXJuaW5nXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnbm9wZXJtaXNzaW9ucydcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgZXJyb3IgaWYgUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsc1xuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGw6IFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbGVkOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIG1hY09TIHVzaW5nIGFpcnBvcnQgb3IgbmV0d29ya3NldHVwXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTWFjT1MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IGFpcnBvcnQgY29tbWFuZCBmaXJzdCAoZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGFpcnBvcnQgaXMgYXZhaWxhYmxlICh1c3VhbGx5IGF0IC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0KVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGFpcnBvcnRQYXRoIH0gPSBhd2FpdCBleGVjQXN5bmMoJ3doaWNoIGFpcnBvcnQgMj4vZGV2L251bGwgfHwgZWNobyAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFpcnBvcnQgPSBhaXJwb3J0UGF0aC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYCR7YWlycG9ydH0gLUlgLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IHJzc2lEYm0gPSBudWxsO1xuICAgICAgICAgICAgbGV0IHNpZ25hbFBlcmNlbnQgPSBudWxsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQgPSBsaW5lLnJlcGxhY2UoJ1NTSUQ6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnQlNTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIHRvIGVuc3VyZSB3ZSBnZXQgdGhlIGZ1bGwgQlNTSURcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEOlxccyooW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnYWdyQ3RsUlNTSTonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBSU1NJIGluIGRCbSAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2lTdHIgPSBsaW5lLnJlcGxhY2UoJ2FnckN0bFJTU0k6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaSA9IHJzc2lTdHIgPyAocGFyc2VJbnQocnNzaVN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgcnNzaURibSA9IHJzc2k7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2xpbmsgYXV0aDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBbHRlcm5hdGl2ZTogc2lnbmFsIHN0cmVuZ3RoIGFzIHBlcmNlbnRhZ2UgKGlmIGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxkKyklLyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCAmJiBzaWduYWxQZXJjZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsUGVyY2VudCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcXVhbGl0eSA9IG51bGw7XG4gICAgICAgICAgICBpZiAoc2lnbmFsUGVyY2VudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBzaWduYWxQZXJjZW50O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyc3NpRGJtICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IGRibVRvUXVhbGl0eVBlcmNlbnQocnNzaURibSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzc2lkIHx8IGJzc2lkIHx8IHF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoYWlycG9ydEVycm9yKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBuZXR3b3Jrc2V0dXAgLSBvbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAobm90IGp1c3Qgbm8gcGVybWlzc2lvbilcbiAgICAgICAgICAgIGlmIChhaXJwb3J0RXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcgJiYgYWlycG9ydEVycm9yLm1lc3NhZ2UgJiYgIWFpcnBvcnRFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IGFpcnBvcnQgY29tbWFuZCBmYWlsZWQ6JywgYWlycG9ydEVycm9yLm1lc3NhZ2UgfHwgYWlycG9ydEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2s6IG5ldHdvcmtzZXR1cCBhbmQgaXBjb25maWcgKGZvciBuZXdlciBtYWNPUyB3aGVyZSBhaXJwb3J0IGlzIG5vdCBhdmFpbGFibGUpICAvLyBzeXN0ZW1fcHJvZmlsZXIgaXMgd2F5IHRvIGhlYXZ5IGFuZCBuZWVkcyBhIGxvb29vb3Qgb2YgdGltZSB0byBwcm9jZXNzXG4gICAgICAgIC8vIHRoaXMgaXMgYSBzaW1wbGUgY2FsY3VsYXRpb24uLiB3ZSBjYW4ndCByZWx5IG9uIGEgcHJvY2VzcyB0aGF0IHRha2VzIDEwcyB0byBjb21wbGV0ZSBhbmQgYmxvY2tzIHRoZSB3aG9sZSBzeXN0ZW1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSBXTEFOIGludGVyZmFjZSB1c2luZyBuZXR3b3Jrc2V0dXBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpbnRlcmZhY2VPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0d29ya3NldHVwIC1saXN0YWxsaGFyZHdhcmVwb3J0cyB8IGF3ayBcXCcvV2ktRml8QWlyUG9ydC97Z2V0bGluZTsgcHJpbnQgJE5GfVxcJycsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZU5hbWUgPSBpbnRlcmZhY2VPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWludGVyZmFjZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBXaS1GaSBpbnRlcmZhY2UgZm91bmRcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBhd2sgLUYnIFNTSUQgOiAnICcvIFNTSUQgOiAvIHtwcmludCAkMn0nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkT3V0cHV0LnRyaW0oKSB8fCBudWxsO1xuICAgICAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZCwgY29udGludWUgd2l0aCBCU1NJRFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgQlNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGJzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBncmVwICdCU1NJRCA6JyB8IGF3ayAne3ByaW50ICQzfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRTdHIgPSBic3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgQlNTSUQgZm9ybWF0IChNQUMgYWRkcmVzcylcbiAgICAgICAgICAgICAgICBpZiAoYnNzaWRTdHIgJiYgL15bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0kL2kudGVzdChic3NpZFN0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZFN0ci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGJzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBCU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgZmFsbGJhY2sgKGFpcnBvcnQgbm90IGF2YWlsYWJsZSwgY2FuJ3QgZ2V0IHNpZ25hbCBzdHJlbmd0aClcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAobmV0d29ya3NldHVwRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiBuZXR3b3Jrc2V0dXAgZmFpbHMgd2l0aCBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogbmV0d29ya3NldHVwL2lwY29uZmlnIGZhbGxiYWNrIGZhaWxlZDonLCBuZXR3b3Jrc2V0dXBFcnJvci5tZXNzYWdlIHx8IG5ldHdvcmtzZXR1cEVycm9yKTtcbiAgICAgICAgICAgIC8vIElmIGZhbGxiYWNrIGNvbXBsZXRlbHkgZmFpbHMsIHJldHVybiBlcnJvciBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IGdldFdsYW5JbmZvIH07XG5cblxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ3Rhc2tsaXN0IC9mbyBjc3YnIChzdHJ1Y3R1cmVkIGZvcm1hdCwgZmFzdGVyIHRoYW4gL3YsIHN0aWxsIHNob3dzIHByb2Nlc3MgbmFtZXMpXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygndGFza2xpc3QgL2ZvIGNzdicsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAnbmV0c3RhdCAtYW5vJyAoc2hvd3MgYWxsIGNvbm5lY3Rpb24gc3RhdGVzIGluY2x1ZGluZyBFU1RBQkxJU0hFRCBmb3Igc2NyZWVuc2hhcmluZyBkZXRlY3Rpb24pXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c3RhdCAtYW5vJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIFJlZ2V4IHRvIGZpbmQgOlBPUlQgZm9sbG93ZWQgYnkgYSBzcGFjZSAoZW5zdXJlcyBleGFjdCBwb3J0IG1hdGNoLCBlLmcuLCA6NTkzOCApXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fVxcXFxzYCwgJ2cnKSBcbiAgICAgIGlmIChyZWdleC50ZXN0KHN0ZG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCdjb20ubWljcm9zb2Z0LnRlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJywnY2hhdGdwdCcsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNSdcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTZcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsXG4gICdyZW1vdGV1dGlsaXRpZXMnLCAnZzJjb21tJywgJ3BjdmlzaXQnLCAncGN2aXNpdF9zdXBwb3J0JywgJ3BjdmlzaXRfY3VzdG9tZXInLCAnc3VwcG9ydCAxNScsXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2LFxuXVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0ICogYXMgd2luIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlV2luLmpzJ1xuaW1wb3J0ICogYXMgbWFjIGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTWFjLmpzJ1xuaW1wb3J0ICogYXMgbGludXggZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVMaW4uanMnXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjayhwbGF0Zm9ybSA9ICd3aW4zMicpIHtcbiAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gYXdhaXQgd2luLnJ1blJlbW90ZUNoZWNrKClcbiAgaWYgKHBsYXRmb3JtID09PSAnZGFyd2luJykgcmV0dXJuIGF3YWl0IG1hYy5ydW5SZW1vdGVDaGVjaygpXG4gIHJldHVybiBhd2FpdCBsaW51eC5ydW5SZW1vdGVDaGVjaygpXG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBFeHBhbmRlZCBicm93c2VyIGtleXdvcmRzIHRvIGNhdGNoIG1vcmUgdmFyaWFudHNcbmNvbnN0IGJyb3dzZXJLZXl3b3JkcyA9IFtcbiAgICAnY2hyb20nLCAnY2hyb21lLmV4ZScsXG4gICAgJ2VkZ2UnLCAnbXNlZGdlLmV4ZScsXG4gICAgJ2ZpcmUnLCAnZmlyZWZveC5leGUnLFxuICAgICdicmF2ZScsICdicmF2ZS5leGUnLFxuICAgICdvcGVyYScsICdvcGVyYS5leGUnLFxuICAgICdicm93c2VyJywgLy8gR2VuZXJpYyBicm93c2VyIHByb2Nlc3NcbiAgICAnaWV4cGxvcmUnLCAvLyBJbnRlcm5ldCBFeHBsb3JlclxuICAgICdzYWZhcmknLCAvLyBGb3IgbWFjT1Ncbl07XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJiB7ICRwcm9jID0gR2V0LUNpbUluc3RhbmNlIC1DbGFzcyBXaW4zMl9Qcm9jZXNzIC1GaWx0ZXIgJ1Byb2Nlc3NJZD0ke3BpZH0nOyBpZiAoJHByb2MpIHsgJHByb2MuUGFyZW50UHJvY2Vzc0lkOyAkcHJvYy5OYW1lIH0gfVwiYDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZSk7XG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KGxpbmVzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBsaW5lc1sxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1dpbmRvd3M6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFVuaXggc3lzdGVtcyAoTGludXgvbWFjT1MpXG4gKiBUcmllcyAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCksIGZhbGxzIGJhY2sgdG8gcHMgY29tbWFuZFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0IG1ldGhvZCB+NG1zLCBubyBwcm9jZXNzIHNwYXduKVxuICAgICAgICBjb25zdCBbc3RhdENvbnRlbnQsIGNvbW1Db250ZW50XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vc3RhdGAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbCksXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L2NvbW1gLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpXG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKHN0YXRDb250ZW50KSB7XG4gICAgICAgICAgICAvLyBQYXJzZSAvcHJvYy9waWQvc3RhdDogcGlkIChjb21tKSBzdGF0ZSBwcGlkIC4uLlxuICAgICAgICAgICAgY29uc3Qgc3RhdE1hdGNoID0gc3RhdENvbnRlbnQubWF0Y2goL15cXGQrXFxzK1xcKChbXildKylcXClcXHMrXFxTK1xccysoXFxkKykvKTtcbiAgICAgICAgICAgIGlmIChzdGF0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKGNvbW1Db250ZW50IHx8IHN0YXRNYXRjaFsxXSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHN0YXRNYXRjaFsyXSwgMTApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gcHMgY29tbWFuZCAod29ya3Mgb24gYm90aCBMaW51eCBhbmQgbWFjT1MpXG4gICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcHMgLXAgJHtwaWR9IC1vIHBwaWQ9LGNvbW09YDtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhjb21tYW5kLCB7XG4gICAgICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcGFydHMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcHBpZCA9IHBhcnNlSW50KHBhcnRzWzBdLCAxMCk7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKCcgJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9Vbml4OiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBiYXNlZCBvbiBwbGF0Zm9ybVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mbyhwaWQpIHtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgXG4gICAgaWYgKHBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKTtcbiAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnbGludXgnIHx8IHBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCk7IC8vIExpbnV4L21hY09TOiB0cmllcyAvcHJvYywgZmFsbHMgYmFjayB0byBwc1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBjaGVjayBwYXJlbnQgcHJvY2Vzc2VzIGZvciBicm93c2VyXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZpbmRQYXJlbnRQcm9jZXNzKHBpZCwgbWF4RGVwdGgsIHZpc2l0ZWRQaWRzKSB7XG4gICAgaWYgKHBpZCA9PT0gMSB8fCBwaWQgPT09IDApIHtcbiAgICAgICAgbG9nLmluZm8oJ2NoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJvb3QgUElEIHJlYWNoZWQuIE5vIHdlYiBicm93c2VyIGZvdW5kLicpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGlmIChtYXhEZXB0aCA8PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiB3aGVuIG1heCBkZXB0aCByZWFjaGVkXG4gICAgfVxuICAgIFxuICAgIGlmICh2aXNpdGVkUGlkcy5oYXMocGlkKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXNcbiAgICB9XG4gICAgXG4gICAgdmlzaXRlZFBpZHMuYWRkKHBpZCk7XG4gICAgXG4gICAgLy8gR2V0IHByb2Nlc3MgaW5mbyAoZ2V0UHJvY2Vzc0luZm8gYWxyZWFkeSBoYXMgaXRzIG93biB0aW1lb3V0IHByb3RlY3Rpb24pXG4gICAgY29uc3QgcHJvY2Vzc0luZm8gPSBhd2FpdCBnZXRQcm9jZXNzSW5mbyhwaWQpO1xuICAgIFxuICAgIGlmICghcHJvY2Vzc0luZm8pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB7IHBwaWQsIG5hbWUgfSA9IHByb2Nlc3NJbmZvO1xuICAgIFxuICAgIC8vIExvZyB0aGUgcHJvY2VzcyBpbmZvIGZvciBkZWJ1Z2dpbmdcbiAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQ2hlY2tpbmcgcHJvY2VzczogJHtuYW1lfSAoUElEOiAke3BpZH0sIFBQSUQ6ICR7cHBpZH0pYCk7XG4gICAgXG4gICAgLy8gTW9yZSB0aG9yb3VnaCBicm93c2VyIGRldGVjdGlvblxuICAgIGlmIChicm93c2VyS2V5d29yZHMuc29tZShicm93c2VyID0+IG5hbWUuaW5jbHVkZXMoYnJvd3NlcikpKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGZvdW5kOiAke25hbWV9YCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAobmFtZS5pbmNsdWRlcygnZXhwbG9yZXInKSB8fCBwcGlkIDw9IDEpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IFJlYWNoZWQgc3lzdGVtIHByb2Nlc3Mgb3IgZXhwbG9yZXJgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBmaW5kUGFyZW50UHJvY2VzcyhwcGlkLCBtYXhEZXB0aCAtIDEsIHZpc2l0ZWRQaWRzKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgcGFyZW50IHByb2Nlc3MgaXMgYSBicm93c2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja1BhcmVudFByb2Nlc3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZm91bmRCcm93c2VyID0gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHJvY2Vzcy5wcGlkLCA2LCBuZXcgU2V0KCkpO1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEJyb3dzZXIgZGV0ZWN0aW9uIHJlc3VsdDogJHtmb3VuZEJyb3dzZXJ9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGZvdW5kQnJvd3NlciB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBjaGVja1BhcmVudFByb2Nlc3M6IEVycm9yIGluIGJyb3dzZXIgZGV0ZWN0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBmb3VuZEJyb3dzZXI6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgIH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQXVCQSxTQUFTLFlBQUFBLGlCQUFnQjtBQUN6QixPQUFPLFFBQVE7QUFDZixTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXO0FBQ3BCLE9BQU8sU0FBUzs7O0FDdEJoQixJQUFNLFNBQVM7QUFBQSxFQUNYLGFBQWE7QUFBQTtBQUFBLEVBQ2IsY0FBYztBQUFBLEVBQ2QsZUFBZTtBQUFBLEVBQ2YsZ0JBQWdCO0FBQUEsRUFDaEIsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBRVgsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBLEVBRWpCLGVBQWU7QUFBQTtBQUFBLEVBQ2YscUJBQXFCO0FBQUE7QUFBQSxFQUVyQixxQkFBcUI7QUFBQSxFQUNyQixRQUFRO0FBQUE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULGFBQWE7QUFBQSxFQUNiLFNBQVM7QUFBQSxFQUVULFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLGFBQWE7QUFBQSxFQUNiLE1BQU07QUFDVjtBQUNBLElBQU8saUJBQVE7OztBREpmLFNBQVMscUJBQXFCO0FBQzlCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUNqQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxPQUFPO0FBQ2QsSUFBTSxZQUFZLFlBQVk7QUFFOUIsSUFBTSxxQkFBTixNQUF5QjtBQUFBLEVBQ3ZCLGNBQWM7QUFFWixTQUFLLFdBQVcsUUFBUTtBQUN4QixTQUFLLFFBQVEsUUFBUTtBQUNyQixTQUFLLE9BQU8sUUFBUTtBQUVwQixTQUFLLFdBQVcsQ0FBQztBQUNqQixTQUFLLE9BQU8sS0FBSyxlQUFlO0FBQ2hDLFNBQUssZ0JBQWdCLEtBQUssa0JBQWtCO0FBQzVDLFNBQUssUUFBUSxLQUFLLE9BQU87QUFDekIsU0FBSyxVQUFVLEtBQUssU0FBUztBQUM3QixTQUFLLFlBQVksS0FBSyxZQUFZLFdBQVc7QUFDN0MsU0FBSyxjQUFjLEtBQUssWUFBWSxTQUFTO0FBQzdDLFNBQUssWUFBWSxLQUFLLHVCQUF1QjtBQUM3QyxTQUFLLGlCQUFpQixLQUFLLG1CQUFtQjtBQUM5QyxTQUFLLFlBQVksS0FBSyxjQUFjO0FBQ3BDLFNBQUssb0JBQW9CLEtBQUssc0JBQXNCO0FBQ3BELFNBQUssTUFBTSxLQUFLLGFBQWE7QUFDN0IsU0FBSyxhQUFhLEtBQUssZUFBZTtBQUN0QyxTQUFLLFNBQVMsS0FBSyxlQUFlO0FBQ2xDLFNBQUssVUFBVSxLQUFLLGdCQUFnQjtBQUNwQyxTQUFLLFVBQVUsS0FBSyxRQUFRO0FBRTVCLFNBQUssZ0JBQWdCLEdBQUcsUUFBUTtBQUNoQyxTQUFLLGNBQWMsS0FBSyxnQkFBZ0I7QUFDeEMsU0FBSyxZQUFZLEtBQUssY0FBYztBQUNwQyxTQUFLLGdCQUFnQixLQUFLLGtCQUFrQjtBQUM1QyxTQUFLLGdCQUFnQixLQUFLLGtCQUFrQjtBQUM1QyxTQUFLLFVBQVUsS0FBSyxZQUFZO0FBQUEsRUFFbEM7QUFBQSxFQUVBLGlCQUFpQjtBQUNmLFFBQUksSUFBSSxZQUFZO0FBQ2xCLFlBQU0sV0FBVyxLQUFLLFFBQVEsZUFBZSxtQkFBbUI7QUFDaEUsWUFBTSxhQUFhLEtBQUssVUFBVSxRQUFRO0FBQzFDLGFBQU8sR0FBRyxXQUFXLFVBQVUsSUFBSSxhQUFhO0FBQUEsSUFDbEQ7QUFDQSxXQUFPLEtBQUssV0FBVyxjQUFjO0FBQUEsRUFDdkM7QUFBQSxFQUVBLG9CQUFvQjtBQUNsQixXQUFPLEtBQUssS0FBSyxlQUFlLGVBQU8sZUFBZTtBQUFBLEVBQ3hEO0FBQUEsRUFFQSxvQkFBb0I7QUFDbEIsV0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLFVBQVU7QUFBQSxFQUNyQztBQUFBLEVBR0EsY0FBYztBQUNaLFdBQU8sS0FBSyxLQUFLLGVBQWUsdUJBQXVCO0FBQUEsRUFDekQ7QUFBQSxFQUVBLGlCQUFpQjtBQUNmLFFBQUksS0FBSyxVQUFVLE9BQVEsUUFBTztBQUNsQyxRQUFJLENBQUMsT0FBTyxPQUFPLEVBQUUsU0FBUyxLQUFLLEtBQUssRUFBRyxRQUFPLEtBQUs7QUFDdkQsU0FBSyxNQUFNLDZCQUE2QixLQUFLLEtBQUssRUFBRTtBQUFBLEVBQ3REO0FBQUEsRUFFQSxlQUFlO0FBQ2IsUUFBSSxLQUFLLGFBQWEsUUFBUyxRQUFPO0FBQ3RDLFFBQUksS0FBSyxhQUFhLFFBQVMsUUFBTztBQUN0QyxRQUFJLEtBQUssYUFBYSxVQUFVO0FBQzlCLGFBQU8sS0FBSyxVQUFVLFVBQVUsNkJBQTZCO0FBQUEsSUFDL0Q7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQW9CQSxpQkFBaUI7QUFFZixRQUFJLGVBQU8sZUFBZTtBQUN4QixVQUFJLElBQUksWUFBWTtBQUNsQixhQUFLLFNBQVMsS0FBSywwREFBMEQsS0FBSyxLQUFLLFlBQVksS0FBSyxHQUFHLENBQUM7QUFDNUcsZUFBTyxLQUFLLEtBQUssWUFBWSxLQUFLLEdBQUc7QUFBQSxNQUN2QyxPQUFPO0FBQ0wsYUFBSyxTQUFTLEtBQUssMkRBQTJELEtBQUssV0FBVyxnQkFBZ0IsS0FBSyxHQUFHLENBQUM7QUFDdkgsZUFBTyxLQUFLLFdBQVcsZ0JBQWdCLEtBQUssR0FBRztBQUFBLE1BQ2pEO0FBQUEsSUFDRixPQUNLO0FBRUgsVUFBSTtBQUNGLGNBQU0sY0FBYyxLQUFLLGFBQWEsVUFBVSxlQUFlO0FBQy9ELGNBQU0sV0FBV0MsVUFBUyxhQUFhLEVBQUUsVUFBVSxTQUFTLE9BQU8sQ0FBQyxRQUFRLFFBQVEsUUFBUSxFQUFFLENBQUMsRUFBRSxLQUFLO0FBRXRHLFlBQUksVUFBVTtBQUVaLGdCQUFNLFVBQVUsS0FBSyxRQUFRLFFBQVE7QUFFckMsZ0JBQU0sVUFBVSxLQUFLLFFBQVEsS0FBSyxRQUFRLE9BQU8sQ0FBQztBQUNsRCxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGLFNBQVMsS0FBSztBQUFBLE1BRWQ7QUFHQSxVQUFJLEtBQUssd0ZBQXdGO0FBQ2pHLFVBQUksSUFBSSxZQUFZO0FBQ2xCLGVBQU8sS0FBSyxLQUFLLFlBQVksS0FBSyxHQUFHO0FBQUEsTUFDdkMsT0FBTztBQUNMLGVBQU8sS0FBSyxXQUFXLGdCQUFnQixLQUFLLEdBQUc7QUFBQSxNQUNqRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxrQkFBa0I7QUFDaEIsWUFBUSxLQUFLLFVBQVU7QUFBQSxNQUNyQixLQUFLO0FBQVUsZUFBTyxDQUFDLE9BQU8sTUFBTTtBQUFBLE1BQ3BDLEtBQUs7QUFBUyxlQUFPLENBQUMsT0FBTyxXQUFXO0FBQUEsTUFDeEMsS0FBSztBQUFTLGVBQU8sQ0FBQyxPQUFPLE1BQU07QUFBQSxNQUNuQztBQUFTLGFBQUssTUFBTSx5QkFBeUIsS0FBSyxRQUFRLEVBQUU7QUFBQSxJQUM5RDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLG9CQUFvQjtBQUNsQixRQUFJLEtBQUssYUFBYSxRQUFTLFFBQU87QUFDdEMsUUFBSSxLQUFLLEtBQUsscUJBQXFCLFVBQVcsUUFBTztBQUNyRCxRQUFJLEtBQUssS0FBSyxxQkFBcUIsU0FBUyxLQUFLLEtBQUssUUFBUyxRQUFPO0FBQ3RFLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxZQUFZLEtBQUs7QUFDZixRQUFJO0FBQ0YsWUFBTSxTQUFTQSxVQUFTLEdBQUcsR0FBRyxjQUFjLEVBQUUsVUFBVSxTQUFTLE9BQU8sQ0FBQyxRQUFRLFFBQVEsUUFBUSxFQUFFLENBQUMsRUFBRSxNQUFNLElBQUksRUFBRSxDQUFDO0FBQ25ILFlBQU0sVUFBVSxPQUFPLE1BQU0saUJBQWlCO0FBQzlDLGFBQU8sRUFBRSxPQUFPLE1BQU0sU0FBUyxVQUFVLENBQUMsS0FBSyxVQUFVO0FBQUEsSUFDM0QsUUFBUTtBQUNOLGFBQU8sRUFBRSxPQUFPLE9BQU8sU0FBUyxLQUFLO0FBQUEsSUFDdkM7QUFBQSxFQUNGO0FBQUEsRUFFQSxVQUFVO0FBQ1IsUUFBSTtBQUNGLFlBQU0sU0FBU0EsVUFBUyxpQkFBaUIsRUFBRSxVQUFVLFNBQVMsT0FBTyxDQUFDLFFBQVEsVUFBVSxNQUFNLEVBQUUsQ0FBQztBQUNqRyxZQUFNLFVBQVUsT0FBTyxNQUFNLHFCQUFxQixJQUFJLENBQUMsS0FBSztBQUM1RCxZQUFNLFdBQVcsS0FBSyxLQUFLLGFBQWE7QUFDeEMsYUFBTyxFQUFFLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUztBQUFBLElBQ2hELFFBQVE7QUFDTixhQUFPLEVBQUUsT0FBTyxPQUFPLFNBQVMsTUFBTSxNQUFNLEtBQUs7QUFBQSxJQUNuRDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLHFCQUFxQjtBQUNuQixXQUFPLEtBQUssYUFBYSxVQUFVLHlCQUF5QjtBQUFBLEVBQzlEO0FBQUEsRUFFQSxnQkFBZ0I7QUFDZCxVQUFNLGFBQWEsS0FBSyxLQUFLLFlBQVksS0FBSyxjQUFjO0FBQzVELFdBQU8sY0FBYyxVQUFVO0FBQUEsRUFDakM7QUFBQSxFQUVBLFlBQVk7QUFDVixXQUFPLEtBQUssS0FBSyxxQkFBcUI7QUFBQSxFQUN4QztBQUFBLEVBRUEsU0FBUztBQUNQLFFBQUk7QUFDRixZQUFNLE1BQU1BLFVBQVMsNkJBQTZCLEVBQUUsT0FBTyxhQUFhLFVBQVUsU0FBUyxPQUFPLENBQUMsUUFBUSxRQUFRLFFBQVEsRUFBRSxDQUFDLEVBQUUsS0FBSztBQUNySSxhQUFPLFFBQVE7QUFBQSxJQUNqQixRQUFRO0FBQ04sV0FBSyxTQUFTLEtBQUssc0NBQXNDO0FBQ3pELGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUFBLEVBRUEsV0FBVztBQUNULFFBQUk7QUFDRixZQUFNLE1BQU1BLFVBQVMsNkJBQTZCLEVBQUUsT0FBTyxhQUFhLFVBQVUsU0FBUyxPQUFPLENBQUMsUUFBUSxRQUFRLFFBQVEsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLFlBQVk7QUFDbkosYUFBTyxJQUFJLFNBQVMsT0FBTztBQUFBLElBQzdCLFNBQVMsS0FBSztBQUNaLFdBQUssU0FBUyxLQUFLLHdDQUF3QztBQUMzRCxhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFdBQVc7QUFDVCxRQUFJO0FBQ0YsWUFBTSxNQUFNQSxVQUFTLDZCQUE2QixFQUFFLE9BQU8sYUFBYSxVQUFVLFNBQVMsT0FBTyxDQUFDLFFBQVEsUUFBUSxRQUFRLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxZQUFZO0FBQ25KLGFBQU8sSUFBSSxTQUFTLE9BQU87QUFBQSxJQUM3QixTQUFTLEtBQUs7QUFDWixVQUFJLEtBQUssMENBQTBDLEdBQUc7QUFDdEQsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUEsRUFFQSx3QkFBd0I7QUFDdEIsUUFBSTtBQUNGLE1BQUFBLFVBQVMsbUJBQW1CLEVBQUUsT0FBTyxTQUFTLENBQUM7QUFFL0MsYUFBTztBQUFBLElBQ1QsUUFBUTtBQUNOLFVBQUk7QUFDRixRQUFBQSxVQUFTLGdCQUFnQixFQUFFLE9BQU8sU0FBUyxDQUFDO0FBRTVDLGVBQU87QUFBQSxNQUNULFNBQVMsS0FBSztBQUNaLGFBQUssU0FBUyxLQUFLLG1FQUFtRTtBQUN0RixlQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxzQkFBc0I7QUFDcEIsUUFBSTtBQUNGLE1BQUFBLFVBQVMsbUJBQW1CLEVBQUUsT0FBTyxTQUFTLENBQUM7QUFDL0MsYUFBTztBQUFBLElBQ1QsUUFBUTtBQUNOLFdBQUssU0FBUyxLQUFLLCtEQUErRDtBQUNsRixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUVBLG9CQUFvQjtBQUNsQixTQUFLLGNBQWMsS0FBSyxnQkFBZ0I7QUFBQSxFQUMxQztBQUFBLEVBRUEsa0JBQWtCO0FBQ2hCLFFBQUksS0FBSyxhQUFhLFNBQVM7QUFDN0IsYUFBTyxLQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsR0FBRyxTQUFTO0FBQUEsSUFDeEQsT0FBTztBQUNMLGFBQU8sS0FBSyxLQUFLLEdBQUcsUUFBUSxHQUFHLFNBQVM7QUFBQSxJQUMxQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sS0FBSztBQUNQLFVBQU0sSUFBSSxNQUFNLHdCQUF3QixHQUFHLEVBQUU7QUFBQSxFQUNqRDtBQUFBLEVBRUEseUJBQXlCO0FBQ3ZCLFFBQUk7QUFDRixNQUFBQSxVQUFTLG1CQUFtQixFQUFFLE9BQU8sU0FBUyxDQUFDO0FBQy9DLFdBQUssU0FBUyxLQUFLLDRFQUE0RTtBQUMvRixhQUFPO0FBQUEsSUFDVCxRQUFRO0FBQ04sVUFBSTtBQUNGLFFBQUFBLFVBQVMsZ0JBQWdCLEVBQUUsT0FBTyxTQUFTLENBQUM7QUFDNUMsYUFBSyxTQUFTLEtBQUssNEVBQTRFO0FBQy9GLGVBQU87QUFBQSxNQUNULFNBQVMsS0FBSztBQUNaLGFBQUssU0FBUyxLQUFLLG9FQUFvRTtBQUN2RixlQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxnQkFBZ0I7QUFDZCxRQUFJLEtBQUssYUFBYSxTQUFTO0FBQzdCLGFBQU8sS0FBSyxzQkFBc0I7QUFBQSxJQUNwQyxPQUFPO0FBQ0wsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUEsRUFFQSx3QkFBd0I7QUFDdEIsUUFBSSxLQUFLLGFBQWEsU0FBUztBQUM3QixXQUFLLEtBQUssU0FBUyxLQUFLLEtBQUssU0FBUyxNQUFNLEtBQUssVUFBVSxHQUFHO0FBQzVELGFBQUssU0FBUyxLQUFLLHlHQUFvRztBQUN2SCxlQUFPO0FBQUEsTUFDVCxXQUFXLEtBQUssT0FBTyxLQUFLLEtBQUssVUFBVSxLQUFLLEtBQUssb0JBQW9CLEdBQUc7QUFDMUUsYUFBSyxTQUFTLEtBQUssMEdBQXFHO0FBQ3hILGVBQU87QUFBQSxNQUNULFdBQVcsQ0FBQyxLQUFLLFVBQVUsS0FBSyxLQUFLLFdBQVc7QUFDOUMsYUFBSyxTQUFTLEtBQUssb0dBQStGO0FBQ2xILGVBQU87QUFBQSxNQUNULE9BQU87QUFDTCxhQUFLLFNBQVMsS0FBSywyR0FBc0c7QUFDekgsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGLE9BQU87QUFDTCxhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFFRjtBQUVBLElBQU0scUJBQXFCLElBQUksbUJBQW1CO0FBQ2xELElBQU8sNkJBQVE7OztBRXRUZixPQUFPLFdBQVc7QUFDbEIsT0FBT0MsV0FBUztBQUNoQixTQUFTLE9BQUFDLE1BQUssaUJBQUFDLGdCQUFlLGtCQUFrQixhQUFhLGtCQUFBQyxpQkFBZ0IsUUFBQUMsT0FBTSxRQUFBQyxPQUFNLFVBQUFDLFNBQVEsZUFBYzs7O0FDTjlHLE9BQU8sV0FBVztBQUVsQixPQUFPQyxVQUFTOzs7QUNwQmhCLFNBQVMsb0JBQW9CO0FBRXRCLElBQU0sbUJBQU4sY0FBK0IsYUFBYTtBQUFBLEVBRS9DO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUVBLFlBQVksUUFBb0IsSUFBWTtBQUN4QyxVQUFNO0FBQ04sU0FBSyxTQUFTO0FBQ2QsU0FBSyxTQUFTO0FBQ2QsU0FBSyxXQUFXO0FBQ2hCLFNBQUssWUFBWSxXQUFXLEtBQUssTUFBTTtBQUFBLEVBQzNDO0FBQUEsRUFFTyxRQUFRO0FBQ1gsUUFBSSxDQUFDLEtBQUssUUFBUTtBQUNkLFdBQUssU0FBUyxZQUFZLE1BQU0sS0FBSyxLQUFLLFNBQVMsR0FBRyxLQUFLLFFBQVE7QUFBQSxJQUN2RTtBQUFBLEVBQ0o7QUFBQSxFQUVPLE9BQU87QUFDVixRQUFJLEtBQUssUUFBUTtBQUNiLG9CQUFjLEtBQUssTUFBTTtBQUN6QixXQUFLLFNBQVM7QUFBQSxJQUNsQjtBQUFBLEVBQ0o7QUFDSjs7O0FEQUEsSUFBTSxrQkFBTixNQUFzQjtBQUFBLEVBQ2xCLGNBQWU7QUFDWCxTQUFLLE9BQU8sZUFBTztBQUNuQixTQUFLLGlCQUFpQixlQUFPO0FBQzdCLFNBQUssU0FBUztBQUNkLFNBQUssY0FBYztBQUNuQixTQUFLLGlCQUFpQixDQUFDO0FBQ3ZCLFNBQUssYUFBYTtBQUFBLE1BQ2QsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsSUFBSTtBQUFBO0FBQUEsTUFDSixVQUFVO0FBQUEsTUFDVixVQUFVO0FBQUE7QUFBQSxNQUNWLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLFdBQVc7QUFBQSxNQUNYLGFBQWE7QUFBQTtBQUFBLE1BQ2IsVUFBVztBQUFBLE1BQ1gsS0FBSztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osZUFBZTtBQUFBLE1BQ2Ysb0JBQW9CO0FBQUE7QUFBQSxNQUNwQixjQUFlO0FBQUEsTUFDZixtQkFBbUIsRUFBQyxXQUFXLE1BQUs7QUFBQSxNQUNwQyxlQUFlO0FBQUEsTUFDZixPQUFPO0FBQUEsTUFDUCxrQkFBa0I7QUFBQSxJQUN0QjtBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsS0FBTSxTQUFTO0FBQ1gsU0FBSyxVQUFVO0FBQ2YsU0FBSyxTQUFTLE1BQU0sYUFBYSxNQUFNO0FBRXZDLFNBQUssT0FBTyxHQUFHLFNBQVMsQ0FBQyxRQUFRO0FBQzdCLE1BQUFDLEtBQUksTUFBTTtBQUFBLEVBQWlELElBQUksS0FBSyxFQUFFO0FBQ3RFLFdBQUssT0FBTyxNQUFNO0FBQUEsSUFDdEIsQ0FBQztBQUVELFFBQUk7QUFDQSxXQUFLLE9BQU8sS0FBSyxLQUFLLE1BQU0sV0FBWSxNQUFNO0FBQzFDLGFBQUssT0FBTyxhQUFhLElBQUk7QUFDN0IsYUFBSyxPQUFPLGdCQUFnQixHQUFHO0FBQy9CLFlBQUksS0FBSyxTQUFTO0FBQUMsZUFBSyxPQUFPLGNBQWMsS0FBSyxjQUFjO0FBQUEsUUFBQztBQUNqRSxZQUFJLENBQUMsS0FBSyxTQUFTO0FBQUMsVUFBQUEsS0FBSSxLQUFLLGdGQUFnRjtBQUFBLFFBQUM7QUFDOUcsUUFBQUEsS0FBSSxLQUFLLDZEQUE2RCxlQUFPLE1BQU0sSUFBSSxLQUFLLE9BQU8sUUFBUSxFQUFFLElBQUksRUFBRTtBQUFBLE1BQ3ZILENBQUM7QUFBQSxJQUNMLFNBQ08sR0FBRTtBQUNMLE1BQUFBLEtBQUksTUFBTSwyQkFBMkIsQ0FBQyxFQUFFO0FBQUEsSUFDNUM7QUFFQSxTQUFLLE9BQU8sR0FBRyxXQUFXLENBQUMsU0FBUyxVQUFVO0FBQUUsV0FBSyxnQkFBZ0IsU0FBUyxLQUFLO0FBQUEsSUFBRSxDQUFDO0FBR3RGLFNBQUssd0JBQXdCLElBQUksaUJBQWlCLEtBQUsscUJBQXFCLEtBQUssSUFBSSxHQUFHLEdBQUk7QUFDNUYsU0FBSyxzQkFBc0IsTUFBTTtBQUFBLEVBQ3JDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQyxnQkFBaUIsU0FBUyxPQUFPO0FBRTlCLFVBQU0sYUFBYSxLQUFLLE1BQU0sT0FBTyxPQUFPLENBQUM7QUFDN0MsZUFBVyxXQUFXLE1BQU07QUFDNUIsZUFBVyxhQUFhLE1BQU07QUFDOUIsZUFBVyxZQUFZO0FBQ3ZCLGVBQVcsYUFBWSxvQkFBSSxLQUFLLEdBQUUsUUFBUTtBQUUxQyxRQUFJLEtBQUssa0JBQWtCLFVBQVUsR0FBRztBQUNwQyxNQUFBQSxLQUFJLEtBQUssZ0VBQWdFLFdBQVcsVUFBVSxpQkFBaUI7QUFDL0csV0FBSyxlQUFlLEtBQUssVUFBVTtBQUFBLElBQ3ZDO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0Esa0JBQW1CLEtBQUs7QUFDcEIsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLGVBQWUsUUFBUSxLQUFLO0FBQ2pELFVBQUksS0FBSyxlQUFlLENBQUMsRUFBRSxPQUFPLElBQUksSUFBSTtBQUV0QyxhQUFLLGVBQWUsQ0FBQyxFQUFFLFlBQVksSUFBSTtBQUN2QyxlQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0o7QUFDQSxXQUFPO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsdUJBQXdCO0FBQ3BCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxlQUFlLFFBQVEsS0FBSztBQUNqRCxZQUFNLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFFL0IsVUFBSSxNQUFNLE9BQVEsS0FBSyxlQUFlLENBQUMsRUFBRSxXQUFXO0FBQ2hELFFBQUFBLEtBQUksS0FBSyxxRUFBcUUsS0FBSyxlQUFlLENBQUMsRUFBRSxVQUFVLGFBQWE7QUFDNUgsYUFBSyxlQUFlLE9BQU8sR0FBRyxDQUFDO0FBQUEsTUFDbkM7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKO0FBRUEsSUFBTywwQkFBUSxJQUFJLGdCQUFnQjs7O0FEL0duQyxPQUFPQyxXQUFVO0FBQ2pCLE9BQU9DLFNBQVE7QUFDZixZQUFZLGFBQWE7QUFDekIsT0FBT0MsU0FBUTtBQUNmLFNBQVMsZ0JBQUFDLHFCQUFvQjs7O0FHZDdCLE9BQU9DLFNBQVE7QUFDZixTQUFTLE9BQUFDLE1BQUssZUFBZSxhQUFhLFFBQVEsY0FBYTtBQUMvRCxTQUFTLFFBQUFDLGFBQVk7OztBQ2tCckIsU0FBUyxXQUFXLHNCQUFzQjtBQUUxQyxPQUFPQyxVQUFTOzs7QUNqQ2hCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU9DLFVBQVM7QUFJaEIsSUFBTSxtQkFBbUI7QUFBQSxFQUNyQjtBQUFBLEVBQXVCO0FBQUEsRUFBd0I7QUFBQSxFQUFpQjtBQUFBLEVBQXNCO0FBQUEsRUFBc0I7QUFBQSxFQUF3QjtBQUFBLEVBQ3BJO0FBQUEsRUFBZ0I7QUFBQSxFQUFzQjtBQUFBLEVBQWlCO0FBQUEsRUFBc0I7QUFBQSxFQUErQjtBQUFBLEVBQTBCO0FBQUEsRUFDdEk7QUFBQSxFQUFhO0FBQUEsRUFBVztBQUFBLEVBQWlCO0FBQUEsRUFBMEI7QUFBQSxFQUFlO0FBQUEsRUFBd0I7QUFBQSxFQUMxRztBQUFBLEVBQWU7QUFBQSxFQUFpQjtBQUFBLEVBQXNCO0FBQUEsRUFBeUI7QUFBQSxFQUF3QjtBQUFBLEVBQXdCO0FBQUEsRUFDL0g7QUFBQSxFQUFRO0FBQUEsRUFBb0I7QUFBQSxFQUF1QjtBQUFBLEVBQXlCO0FBQUEsRUFBc0I7QUFBQSxFQUF3QjtBQUFBLEVBQzFIO0FBQUEsRUFBYztBQUFBLEVBQW9CO0FBQUEsRUFBdUI7QUFBQSxFQUEwQjtBQUFBLEVBQXNEO0FBQUEsRUFDekk7QUFBQSxFQUF1QjtBQUFBLEVBQW9CO0FBQUEsRUFBdUI7QUFBQSxFQUF1QjtBQUFBLEVBQWdCO0FBQUEsRUFBd0I7QUFBQSxFQUNqSTtBQUFBLEVBQWU7QUFBQSxFQUFvQjtBQUFBLEVBQXNCO0FBQUEsRUFBa0I7QUFBQSxFQUF5QjtBQUFBLEVBQ3BHO0FBQUEsRUFBd0I7QUFBQSxFQUF1QjtBQUFBLEVBQXNCO0FBQUEsRUFBbUI7QUFBQSxFQUF3QjtBQUFBLEVBQ2hIO0FBQUEsRUFBZ0I7QUFBQSxFQUF1QjtBQUFBLEVBQXNCO0FBQUEsRUFBUTtBQUFBLEVBQXlCO0FBQUEsRUFDOUY7QUFBQSxFQUF5QjtBQUFBLEVBQXdCO0FBQUEsRUFBc0I7QUFBQSxFQUFpQjtBQUFBLEVBQXlCO0FBQUEsRUFDakg7QUFBQSxFQUFRO0FBQUEsRUFBcUI7QUFBQSxFQUFzQjtBQUFBLEVBQWdCO0FBQUEsRUFBeUI7QUFBQSxFQUM1RjtBQUFBLEVBQVc7QUFBQSxFQUFpQjtBQUFBLEVBQXNCO0FBQUEsRUFBZTtBQUFBLEVBQXdCO0FBQzdGO0FBQ0EsSUFBTSx3QkFBd0I7QUFBQSxFQUFDO0FBQUEsRUFBNEI7QUFBQSxFQUF3QjtBQUFBLEVBQWE7QUFBQSxFQUFvQjtBQUFBLEVBQ2hIO0FBQUEsRUFBb0I7QUFBQSxFQUEwQjtBQUFBLEVBQTBCO0FBQUEsRUFBMEI7QUFBQSxFQUEwQjtBQUFBLEVBQzVIO0FBQUEsRUFBMEI7QUFBQSxFQUEwQjtBQUFBLEVBQTBCO0FBQUEsRUFBMEI7QUFBQSxFQUFxQjtBQUFBLEVBQzdIO0FBQUEsRUFBMEI7QUFBQSxFQUFzQjtBQUFpQjtBQUNyRSxJQUFNLHlCQUF5QixDQUFDLGtCQUFpQixrQkFBaUIsb0JBQW1CLG9CQUFtQixxQkFBb0Isb0JBQW9CO0FBQ2hKLElBQU0sNkJBQTZCO0FBQUEsRUFBQztBQUFBLEVBQW9CO0FBQUEsRUFBcUI7QUFBQSxFQUFvQjtBQUFBLEVBQW9CO0FBQUEsRUFBb0I7QUFBQSxFQUNySTtBQUFBLEVBQW9CO0FBQUEsRUFBb0I7QUFBQSxFQUFvQjtBQUFBLEVBQzVEO0FBQUEsRUFBZTtBQUFBLEVBQWdCO0FBQUEsRUFBZTtBQUFBLEVBQWU7QUFBQSxFQUFlO0FBQUEsRUFBZTtBQUFBLEVBQWU7QUFBQSxFQUFlO0FBQUEsRUFBZTtBQUFBLEVBQ3hJO0FBQUEsRUFBcUI7QUFBQSxFQUFzQjtBQUFBLEVBQXFCO0FBQUEsRUFBcUI7QUFBQSxFQUFxQjtBQUFBLEVBQzFHO0FBQUEsRUFBcUI7QUFBQSxFQUFxQjtBQUFBLEVBQXFCO0FBQUEsRUFBcUI7QUFBVTtBQUNsRyxJQUFNLDBCQUEwQixDQUFDLHVCQUFzQix1QkFBc0IsdUJBQXNCLHVCQUFzQix1QkFBc0IsdUJBQXNCLHVCQUFzQix1QkFBc0IsdUJBQXNCLHdCQUF1Qix3QkFBdUIsc0JBQXNCO0FBU3BTLFNBQVMsd0JBQXdCQyxjQUFhQyxjQUFhLE9BQU8sU0FBUztBQUM5RSxNQUFJO0FBQ0EsSUFBQUEsYUFBWSxRQUFRLENBQUFDLFNBQU87QUFDdkIsbUJBQWEsS0FBSyxhQUFhQSxJQUFHLEtBQUssQ0FBQyxZQUFZLFdBQVc7QUFDM0QsWUFBSSxDQUFDLGNBQWMsVUFBVSxPQUFPLEtBQUssR0FBRztBQUN4Qyx1QkFBYSxLQUFLLGFBQWFBLElBQUcsd0JBQXdCLENBQUMsY0FBYztBQUNyRSxnQkFBSSxDQUFDLFVBQVcsQ0FBQUMsS0FBSSxLQUFLLHFEQUFxREQsSUFBRyxFQUFFO0FBQUEsVUFDdkYsQ0FBQztBQUFBLFFBQ0w7QUFBQSxNQUNKLENBQUM7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNMLFNBQVMsS0FBSztBQUFBLEVBRWQ7QUFFQSxNQUFJLE9BQU87QUFDUCxJQUFBQyxLQUFJLEtBQUssc0VBQXNFO0FBQy9FLGlCQUFhLFNBQVMsZ0JBQWdCLENBQUMsVUFBVSxVQUFVLFdBQVcsWUFBWSxTQUFTLFFBQVEsR0FBRyxDQUFDLE9BQU8sUUFBUSxXQUFXO0FBQzdILFVBQUksT0FBTztBQUNQLFFBQUFBLEtBQUksTUFBTSw0REFBNEQsTUFBTSxPQUFPLEVBQUU7QUFDckYsUUFBQUgsYUFBWSxNQUFNLG1CQUFtQjtBQUNyQztBQUFBLE1BQ0o7QUFDQSxNQUFBQSxhQUFZLE1BQU0sbUJBQW1CLE9BQU8sS0FBSztBQUFBLElBQ3JELENBQUM7QUFDRCxJQUFBRyxLQUFJLEtBQUssK0RBQStEO0FBQ3hFLGlCQUFhLFNBQVMsaUJBQWlCLENBQUMsVUFBVSxHQUFHLDJCQUFtQixhQUFhLG1CQUFrQixXQUFXLHlCQUF3QixTQUFRLFFBQU8sSUFBSSxDQUFDO0FBQzlKLGlCQUFhLFNBQVMsaUJBQWlCLENBQUMsVUFBUyxVQUFTLFdBQVUsWUFBVyxTQUFRLFVBQVMsR0FBRyxDQUFDO0FBQ3BHLGlCQUFhLFNBQVMsU0FBUyxDQUFDLGdCQUFlLFNBQVEsYUFBYSxDQUFDO0FBQ3JFLGlCQUFhLFNBQVMsU0FBUyxDQUFDLGdCQUFlLFNBQVEscUJBQW9CLEdBQUcsQ0FBQztBQUMvRSxJQUFBQSxLQUFJLEtBQUssOERBQThEO0FBQ3ZFLGlCQUFhLFNBQVMsU0FBUyxDQUFDLGdCQUFlLFlBQVcscUNBQXFDLGFBQWEsQ0FBQztBQUM3RyxpQkFBYSxTQUFTLFNBQVMsQ0FBQyxnQkFBZSxZQUFXLHFDQUFxQyxZQUFZLENBQUM7QUFDNUcsaUJBQWEsU0FBUyxTQUFTLENBQUMsZ0JBQWUsWUFBVyxxQ0FBcUMsVUFBVSxDQUFDO0FBQzFHLElBQUFBLEtBQUksS0FBSyw2REFBNkQ7QUFDdEUsaUJBQWEsU0FBUyxpQkFBaUIsQ0FBQyxVQUFVLFVBQVUsV0FBVyxVQUFVLFNBQVMsV0FBVyxlQUFlLENBQUM7QUFDckgsaUJBQWEsU0FBUyxhQUFhLENBQUMsYUFBYSxpQkFBaUIsMkJBQTJCLFlBQVksK0JBQStCLENBQUM7QUFDekksSUFBQUEsS0FBSSxLQUFLLHVFQUF1RTtBQUNoRixpQkFBYSxTQUFTLFNBQVMsQ0FBQyxtQkFBbUIsWUFBWSwrQ0FBK0MsQ0FBQztBQUMvRyxlQUFXLE1BQU07QUFDYixNQUFBQSxLQUFJLEtBQUssK0VBQStFO0FBQ3hGLG1CQUFhLFNBQVMsU0FBUyxDQUFDLHdCQUF3QixpQkFBaUIsNkNBQTZDLE1BQU0sQ0FBQztBQUFBLElBQ2pJLEdBQUcsR0FBSTtBQUFBLEVBQ1g7QUFFQSxNQUFJLFNBQVM7QUFDVCxJQUFBQSxLQUFJLEtBQUssd0VBQXdFO0FBQ2pGLFFBQUk7QUFDQSxlQUFTLFdBQVcsa0JBQWtCO0FBQ2xDLHFCQUFhLFNBQVMsYUFBYSxDQUFDLE9BQU8sb0NBQW9DLEdBQUcsT0FBTyxJQUFJLE1BQU0sQ0FBQztBQUFBLE1BQ3hHO0FBRUEsZUFBUyxXQUFXLHlCQUF5QjtBQUN6QyxxQkFBYSxTQUFTLGFBQWEsQ0FBQyxPQUFPLHdDQUF3QyxTQUFTLE1BQU0sQ0FBQztBQUNuRyxxQkFBYSxTQUFTLFNBQVMsQ0FBQyxTQUFTLHlDQUF5QyxPQUFPLElBQUksTUFBTSxDQUFDO0FBQUEsTUFDeEc7QUFDQSxlQUFTLFdBQVcsdUJBQXVCO0FBQ3ZDLHFCQUFhLFNBQVMsYUFBYSxDQUFDLE9BQU8sK0JBQStCLEdBQUcsT0FBTyxJQUFJLE1BQU0sQ0FBQztBQUFBLE1BQ25HO0FBQ0EsZUFBUyxXQUFXLHdCQUF3QjtBQUN4QyxxQkFBYSxTQUFTLGFBQWEsQ0FBQyxPQUFPLGdDQUFnQyxHQUFHLE9BQU8sSUFBSSxNQUFNLENBQUM7QUFBQSxNQUNwRztBQUNBLGVBQVMsV0FBVyw0QkFBNEI7QUFDNUMscUJBQWEsU0FBUyxhQUFhLENBQUMsT0FBTywyQ0FBMkMsR0FBRyxPQUFPLElBQUksTUFBTSxDQUFDO0FBQUEsTUFDL0c7QUFDQSxtQkFBYSxTQUFTLGFBQWEsQ0FBQyxPQUFPLG9CQUFvQixlQUFlLElBQUksQ0FBQztBQUNuRixtQkFBYSxLQUFLLHlEQUF5RDtBQUMzRSxtQkFBYSxLQUFLLGlFQUFpRTtBQUVuRixVQUFJLENBQUMsMkJBQW1CLFVBQVUsR0FBRztBQUNqQyxRQUFBSCxhQUFZLE1BQU0sa0JBQWtCO0FBQ3BDLHFCQUFhLEtBQUssbUNBQW1DLENBQUMsUUFBUTtBQUMxRCxjQUFJLElBQUssQ0FBQUcsS0FBSSxLQUFLLHFGQUFxRixJQUFJLE9BQU87QUFBQSxRQUN0SCxDQUFDO0FBQUEsTUFDTDtBQUFBLElBQ0osU0FBUyxLQUFLO0FBQUUsTUFBQUEsS0FBSSxNQUFNLDBEQUEwRCxHQUFHLEVBQUU7QUFBQSxJQUFHO0FBQUEsRUFDaEc7QUFFQSxNQUFJO0FBQ0EsaUJBQWEsU0FBUyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ3ZDLGlCQUFhLEtBQUssb0JBQW9CO0FBQ3RDLGlCQUFhLEtBQUssNEJBQTRCO0FBQzlDLGlCQUFhLEtBQUssVUFBVTtBQUFBLEVBQ2hDLFNBQVMsS0FBSztBQUFFLElBQUFBLEtBQUksTUFBTSwwREFBMEQsR0FBRyxFQUFFO0FBQUEsRUFBRztBQUNoRztBQU1PLFNBQVMseUJBQXlCSCxjQUFhO0FBQ2xELGVBQWEsU0FBUyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ3ZDLGVBQWEsS0FBSyxvQkFBb0I7QUFDdEMsZUFBYSxLQUFLLDRCQUE0QjtBQUM5QyxlQUFhLEtBQUssVUFBVTtBQUU1QixlQUFhLEtBQUssNkJBQTZCLENBQUMsT0FBTyxRQUFRLFdBQVc7QUFDdEUsUUFBSSxPQUFPO0FBQ1AsTUFBQUcsS0FBSSxNQUFNLG1FQUFtRSxLQUFLLEVBQUU7QUFDcEY7QUFBQSxJQUNKO0FBQ0EsUUFBSSxPQUFPLEtBQUssTUFBTSxPQUFPO0FBQ3pCLE1BQUFBLEtBQUksS0FBSyxrRUFBa0U7QUFDM0UsbUJBQWEsU0FBUyxTQUFTLENBQUMsbUJBQW1CLFlBQVksK0NBQStDLENBQUM7QUFDL0csbUJBQWEsU0FBUyxTQUFTLENBQUMsd0JBQXdCLGlCQUFpQix3QkFBd0IsT0FBTyxDQUFDO0FBQ3pHLG1CQUFhLFNBQVMsU0FBUyxDQUFDLGdCQUFnQixlQUFlLGlDQUFpQyxDQUFDO0FBQ2pHLG1CQUFhLEtBQUssd0JBQXdCO0FBQzFDLG1CQUFhLFNBQVMsaUJBQWlCLENBQUMsVUFBUyxHQUFHLDJCQUFtQixhQUFhLG1CQUFrQixXQUFVLHlCQUF3QixTQUFRLFFBQU8sVUFBVSxDQUFDO0FBQ2xLLG1CQUFhLFNBQVMsaUJBQWlCLENBQUMsVUFBUyxVQUFTLFdBQVUsWUFBVyxTQUFRLFVBQVVILGFBQVksTUFBTSxnQkFBZ0IsQ0FBQztBQUNwSSxtQkFBYSxTQUFTLGlCQUFpQixDQUFDLFVBQVUsVUFBVSxXQUFXLFVBQVUsU0FBUyxXQUFXLEVBQUUsQ0FBQztBQUN4RyxtQkFBYSxTQUFTLGFBQWEsQ0FBQyxhQUFhLGlCQUFpQiwyQkFBMkIsWUFBWSwrQkFBK0IsQ0FBQztBQUN6SSxtQkFBYSxTQUFTLFNBQVMsQ0FBQyxnQkFBZSxTQUFRLGFBQWEsQ0FBQztBQUNyRSxZQUFNLFFBQVEsYUFBYSxLQUFLLHlCQUF5QixFQUFFLFVBQVUsTUFBTSxPQUFPLFNBQVMsQ0FBQztBQUM1RixZQUFNLE1BQU07QUFBQSxJQUNoQjtBQUFBLEVBQ0osQ0FBQztBQUVELFdBQVMsV0FBVyxrQkFBa0I7QUFDbEMsaUJBQWEsU0FBUyxhQUFhLENBQUMsU0FBUyxvQ0FBb0MsR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQ2xHO0FBQ0EsV0FBUyxXQUFXLHlCQUF5QjtBQUN6QyxpQkFBYSxTQUFTLGFBQWEsQ0FBQyxTQUFTLHdDQUF3QyxPQUFPLENBQUM7QUFBQSxFQUNqRztBQUNBLFdBQVMsV0FBVyx1QkFBdUI7QUFDdkMsaUJBQWEsU0FBUyxhQUFhLENBQUMsU0FBUywrQkFBK0IsR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzdGO0FBQ0EsV0FBUyxXQUFXLHdCQUF3QjtBQUN4QyxpQkFBYSxTQUFTLGFBQWEsQ0FBQyxTQUFTLGdDQUFnQyxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQUEsRUFDOUY7QUFDQSxXQUFTLFdBQVcsNEJBQTRCO0FBQzVDLGlCQUFhLFNBQVMsYUFBYSxDQUFDLFNBQVMsMkNBQTJDLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFBQSxFQUN6RztBQUNBLGVBQWEsU0FBUyxhQUFhLENBQUMsU0FBUyxvQkFBb0IsYUFBYSxDQUFDO0FBRS9FLE1BQUlBLGFBQVksTUFBTSxpQkFBaUI7QUFDbkMsaUJBQWEsS0FBSyx3QkFBd0IsQ0FBQyxRQUFRO0FBQy9DLFVBQUksSUFBSyxDQUFBRyxLQUFJLEtBQUssd0VBQXdFLElBQUksT0FBTztBQUFBLElBQ3pHLENBQUM7QUFDRCxJQUFBSCxhQUFZLE1BQU0sa0JBQWtCO0FBQUEsRUFDeEM7QUFDSjs7O0FDbkxBLFNBQVMsUUFBQUksYUFBWTtBQUNyQixPQUFPQyxtQkFBa0I7QUFDekIsT0FBT0MsVUFBUztBQUdoQixJQUFNQyxhQUFZLFlBQVk7QUFPOUIsZUFBc0IsMEJBQTBCLFlBQVlDLGNBQWE7QUFDckUsTUFBSTtBQUNBLFVBQU1DLGNBQWEsMkJBQW1CO0FBQ3RDLFVBQU0sY0FBY0MsTUFBS0QsYUFBWSx1QkFBdUI7QUFDNUQsSUFBQUUsY0FBYSxTQUFTLGFBQWEsQ0FBQyxHQUFHLEVBQUUsVUFBVSxNQUFNLE9BQU8sVUFBVSxPQUFPLE9BQU8sYUFBYSxLQUFLLENBQUM7QUFDM0csSUFBQUMsS0FBSSxLQUFLLHVFQUF1RTtBQUFBLEVBQ3BGLFNBQVMsS0FBSztBQUFFLElBQUFBLEtBQUksTUFBTSw4REFBOEQsR0FBRyxFQUFFO0FBQUEsRUFBRztBQUVoRyxNQUFJO0FBQ0EsZUFBV0MsUUFBT0wsY0FBYTtBQUMzQixZQUFNLGFBQWFLLEtBQUksUUFBUSxNQUFNLElBQUk7QUFDekMsWUFBTSxVQUFVLCtDQUErQyxVQUFVO0FBQ3pFLFlBQU0sSUFBSSxRQUFRLENBQUMsZUFBZTtBQUM5QixRQUFBRixjQUFhLEtBQUssU0FBUyxDQUFDLE9BQU8sUUFBUSxXQUFXO0FBQ2xELGNBQUksQ0FBQyxTQUFTLFVBQVUsT0FBTyxLQUFLLEVBQUUsU0FBUyxRQUFRLEdBQUc7QUFDdEQsWUFBQUMsS0FBSSxLQUFLLHFEQUFxREMsSUFBRyxFQUFFO0FBQUEsVUFDdkU7QUFDQSxxQkFBVztBQUFBLFFBQ2YsQ0FBQztBQUFBLE1BQ0wsQ0FBQztBQUFBLElBQ0w7QUFBQSxFQUNKLFNBQVMsS0FBSztBQUFBLEVBRWQ7QUFFQSxNQUFJLENBQUMsWUFBWTtBQUNiLElBQUFELEtBQUksS0FBSyxvR0FBb0c7QUFBQSxFQUNqSCxPQUFPO0FBQ0gsUUFBSSxhQUFhO0FBQ2pCLFVBQU0sYUFBYTtBQUNuQixVQUFNLCtCQUErQixNQUFNO0FBQ3ZDLFVBQUksV0FBVyxjQUFjLENBQUMsV0FBVyxXQUFXLGNBQWMsR0FBRztBQUNqRSxZQUFJO0FBQ0EsVUFBQUQsY0FBYSxLQUFLLGdDQUFnQyxDQUFDLE9BQU8sUUFBUSxXQUFXO0FBQ3pFLGdCQUFJLENBQUMsU0FBUyxPQUFRLENBQUFDLEtBQUksS0FBSyxnRUFBZ0U7QUFBQSxVQUNuRyxDQUFDO0FBQUEsUUFDTCxTQUFTLEtBQUs7QUFBQSxRQUVkO0FBQUEsTUFDSixXQUFXLGFBQWEsWUFBWTtBQUNoQztBQUNBLG1CQUFXLDhCQUE4QixHQUFHO0FBQUEsTUFDaEQsT0FBTztBQUNILFFBQUFBLEtBQUksS0FBSyx5RUFBeUUsYUFBYSxHQUFHLGlDQUFpQztBQUFBLE1BQ3ZJO0FBQUEsSUFDSjtBQUNBLGlDQUE2QjtBQUFBLEVBQ2pDO0FBQ0o7QUFLTyxTQUFTLDZCQUE2QjtBQUN6QyxFQUFBQSxLQUFJLEtBQUssMkVBQTJFO0FBQ3BGLE1BQUk7QUFDQSxJQUFBRCxjQUFhLEtBQUssK0NBQStDLENBQUMsT0FBTyxRQUFRLFdBQVc7QUFDeEYsVUFBSSxDQUFDLFNBQVMsT0FBUSxDQUFBQyxLQUFJLEtBQUssMEVBQTBFO0FBQUEsSUFDN0csQ0FBQztBQUFBLEVBQ0wsU0FBUyxHQUFHO0FBQUEsRUFFWjtBQUVBLE1BQUk7QUFDQSxJQUFBRCxjQUFhLEtBQUssNENBQTRDLENBQUMsT0FBTyxRQUFRLFdBQVc7QUFDckYsVUFBSSxPQUFPO0FBQ1AsUUFBQUMsS0FBSSxNQUFNLG1CQUFtQixLQUFLLEVBQUU7QUFDcEM7QUFBQSxNQUNKO0FBQ0EsVUFBSSxDQUFDLE9BQU8sU0FBUyxjQUFjLEdBQUc7QUFDbEMsUUFBQUEsS0FBSSxLQUFLLDBFQUEwRTtBQUNuRixjQUFNLFFBQVFELGNBQWEsS0FBSyxzQkFBc0IsRUFBRSxVQUFVLE1BQU0sT0FBTyxTQUFTLENBQUM7QUFDekYsY0FBTSxNQUFNO0FBQUEsTUFDaEI7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMLFNBQVMsR0FBRztBQUFFLElBQUFDLEtBQUksTUFBTSw4REFBOEQsRUFBRSxPQUFPLEVBQUU7QUFBQSxFQUFHO0FBQ3hHOzs7QUN4RkEsU0FBUyxRQUFBRSxhQUFZO0FBQ3JCLE9BQU9DLG1CQUFrQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxVQUFVLG1CQUFtQixvQkFBb0I7QUFDMUQsT0FBT0MsVUFBUztBQUloQixJQUFJLDBCQUEwQjtBQUM5QixJQUFJLG1CQUFtQjtBQUN2QixJQUFJLG9CQUFvQjtBQUd4QixTQUFTLHVCQUF1QixZQUFZO0FBQ3hDLEVBQUFDLEtBQUksS0FBSywrQkFBK0IsVUFBVSxXQUFXO0FBQzdELE1BQUksQ0FBQyxtQkFBbUIsWUFBWSxjQUFjLEdBQUc7QUFDakQsUUFBSSxrQkFBa0IsaUJBQWlCLFdBQVksbUJBQWtCLGdCQUFnQixXQUFXLFFBQVE7QUFDeEcsc0JBQWtCLFdBQVcsUUFBUTtBQUNyQyxzQkFBa0IsV0FBVyxTQUFTLElBQUk7QUFDMUMsc0JBQWtCLFdBQVcsS0FBSztBQUNsQyxzQkFBa0IsV0FBVyxNQUFNO0FBQUEsRUFDdkM7QUFDSjtBQUVBLElBQU0sb0JBQW9CLE1BQU0sdUJBQXVCLGFBQWE7QUFDcEUsSUFBTSxzQkFBc0IsTUFBTSx1QkFBdUIsZUFBZTtBQU9qRSxTQUFTLHNCQUFzQixZQUFZQyxjQUFhO0FBQzNELFFBQU0sRUFBRSxlQUFlLGVBQWUsSUFBSTtBQUMxQyxRQUFNLFlBQVksSUFBSSxjQUFjLEVBQUUsT0FBTyxZQUFZLENBQUM7QUFDMUQsUUFBTSxXQUFXLElBQUksU0FBUztBQUFBLElBQzFCLE9BQU87QUFBQSxNQUNILElBQUksZUFBZSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQUEsTUFDdkM7QUFBQSxNQUNBLElBQUksZUFBZSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQUEsSUFDM0M7QUFBQSxFQUNKLENBQUM7QUFDRCxhQUFXLFlBQVksWUFBWSxRQUFRO0FBQzNDLHNCQUFvQjtBQUVwQixFQUFBQyxjQUFhLEtBQUssb0JBQW9CO0FBRXRDLEVBQUFELGFBQVksUUFBUSxDQUFBRSxTQUFPO0FBQ3ZCLElBQUFELGNBQWEsS0FBSyxnQkFBZ0JDLElBQUcsS0FBSyxDQUFDLE9BQU8sUUFBUSxXQUFXO0FBQUEsSUFBQyxDQUFDO0FBQUEsRUFDM0UsQ0FBQztBQUdELE1BQUk7QUFDQSw4QkFBMEIsa0JBQWtCLCtCQUErQiwrQ0FBK0MsTUFBTSx1QkFBdUIsc0JBQXNCLENBQUM7QUFBQSxFQUNsTCxTQUFTLEtBQUs7QUFBRSxJQUFBSCxLQUFJLE1BQU0sOERBQThELEdBQUc7QUFBQSxFQUFHO0FBRTlGLGVBQWEsR0FBRyxlQUFlLGlCQUFpQjtBQUNoRCxlQUFhLEdBQUcsaUJBQWlCLG1CQUFtQjtBQUVwRCxxQkFBbUIsTUFBTSxPQUFPLENBQUMsVUFBVSxlQUFlLGdFQUFnRSxDQUFDO0FBQzNILG1CQUFpQixRQUFRLEdBQUcsUUFBUSxDQUFDLFNBQVM7QUFDMUMsUUFBSSxLQUFLLFNBQVMsRUFBRSxTQUFTLE1BQU0sRUFBRyx3QkFBdUIsaUJBQWlCO0FBQUEsRUFDbEYsQ0FBQztBQUNMO0FBS08sU0FBUyx5QkFBeUI7QUFDckMsc0JBQW9CO0FBQ3BCLE1BQUksMkJBQTJCLE1BQU07QUFDakMsUUFBSTtBQUFFLHdCQUFrQixpQ0FBaUMsdUJBQXVCO0FBQUEsSUFBRyxTQUFTLEtBQUs7QUFBRSxNQUFBQSxLQUFJLE1BQU0sZ0VBQWdFLEdBQUc7QUFBQSxJQUFHO0FBQ25MLDhCQUEwQjtBQUFBLEVBQzlCO0FBQ0EsZUFBYSxJQUFJLGVBQWUsaUJBQWlCO0FBQ2pELGVBQWEsSUFBSSxpQkFBaUIsbUJBQW1CO0FBQ3JELE1BQUksa0JBQWtCO0FBQ2xCLHFCQUFpQixLQUFLO0FBQ3RCLHVCQUFtQjtBQUFBLEVBQ3ZCO0FBQ0o7QUFNTyxTQUFTLG9CQUFvQixRQUFRO0FBQ3hDLE1BQUksMkJBQW1CLGFBQWEsU0FBVTtBQUM5QyxFQUFBQSxLQUFJLEtBQUssK0NBQStDLFNBQVMsV0FBVyxTQUFTLDJCQUEyQjtBQUVoSCxRQUFNLFFBQVEsQ0FBQyxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssR0FBRztBQUNqRSxRQUFNLFlBQVlJLE1BQUssMkJBQW1CLGVBQWUscURBQXFEO0FBQzlHLFFBQU0sYUFBYUEsTUFBSywyQkFBbUIsZUFBZSxnQ0FBZ0M7QUFFMUYsTUFBSSxRQUFRO0FBQ1IsVUFBTSxpQkFBaUIsTUFBTTtBQUFBLE1BQUksUUFDN0IsMkVBQTJFLEVBQUU7QUFBQSxJQUNqRixFQUFFLEtBQUssSUFBSTtBQUVYLFVBQU0sa0JBQWtCO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0osRUFBRSxLQUFLLElBQUk7QUFFWCxVQUFNLGNBQWM7QUFBQSxxQkFDUCxVQUFVLGlCQUFpQixTQUFTLE1BQU0sVUFBVTtBQUFBLFVBQy9ELGNBQWM7QUFBQSxVQUNkLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBT2pCLElBQUFGLGNBQWEsS0FBSyxhQUFhLENBQUMsUUFBUTtBQUNwQyxVQUFJLElBQUssU0FBUSxNQUFNLDBCQUEwQixHQUFHO0FBQUEsSUFDeEQsQ0FBQztBQUFBLEVBRUwsT0FBTztBQUNILFVBQU0sa0JBQWtCO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0osRUFBRSxLQUFLLElBQUk7QUFFWCxVQUFNLGNBQWM7QUFBQSxtQkFDVCxVQUFVO0FBQUEsZ0JBQ2IsVUFBVSxNQUFNLFNBQVM7QUFBQSxnQkFDekIsVUFBVTtBQUFBO0FBQUEsVUFFaEIsZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNakIsSUFBQUYsS0FBSSxLQUFLLGtEQUFrRDtBQUMzRCxJQUFBRSxjQUFhLEtBQUssYUFBYSxDQUFDLFFBQVE7QUFDcEMsVUFBSSxJQUFLLFNBQVEsTUFBTSwyQkFBMkIsR0FBRztBQUFBLElBQ3pELENBQUM7QUFBQSxFQUNMO0FBQ0o7OztBSHRHQSxJQUFJO0FBQ0osSUFBSSxjQUFjO0FBQUEsRUFDZCxPQUFPLENBQUM7QUFBQSxFQUNSLFNBQVMsQ0FBQztBQUFBLEVBQ1YsT0FBTyxDQUFDO0FBQ1o7QUFHQSxJQUFNLGNBQWMsQ0FBQyxpQkFBaUIsVUFBVSxpQkFBaUIsa0JBQWtCLFVBQVUsV0FBVyxVQUFVLFNBQVMsU0FBUyxXQUFXLFdBQVcsa0JBQWtCLE9BQU8sU0FBUyxZQUFZLFdBQVcsbUJBQW1CLFdBQVcsUUFBUSxTQUFTLGNBQWMsaUJBQWlCLFNBQVMsU0FBUztBQUVuVCxlQUFlLG1CQUFtQixZQUFZO0FBQzFDLE1BQUksZUFBTyxhQUFhO0FBQUU7QUFBQSxFQUFRO0FBRWxDLEVBQUFHLEtBQUksS0FBSywyRUFBMkU7QUFFcEYsaUJBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFFLFlBQVEsSUFBSSxjQUFjO0FBQUEsRUFBRyxDQUFDO0FBQ3BGLGlCQUFlLFNBQVMsNEJBQTRCLE1BQU07QUFBRSxZQUFRLElBQUksY0FBYztBQUFBLEVBQUcsQ0FBQztBQUMxRixpQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUUsWUFBUSxJQUFJLGNBQWM7QUFBQSxFQUFHLENBQUM7QUFDcEYsaUJBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFFLFlBQVEsSUFBSSxjQUFjO0FBQUEsRUFBRyxDQUFDO0FBRXBGLFlBQVUsTUFBTTtBQUNoQixzQkFBb0IsSUFBSSxpQkFBaUIsTUFBTTtBQUFFLGNBQVUsTUFBTTtBQUFBLEVBQUcsR0FBRyxHQUFJO0FBQzNFLG9CQUFrQixNQUFNO0FBRXhCLE1BQUksMkJBQW1CLGFBQWEsU0FBUztBQUN6Qyw0QkFBd0IsYUFBYSxhQUFhLDJCQUFtQixPQUFPLDJCQUFtQixPQUFPO0FBQUEsRUFDMUc7QUFFQSxNQUFJLDJCQUFtQixhQUFhLFNBQVM7QUFDekMsVUFBTSwwQkFBMEIsWUFBWSxXQUFXO0FBQUEsRUFDM0Q7QUFFQSxNQUFJLDJCQUFtQixhQUFhLFVBQVU7QUFDMUMsMEJBQXNCLFlBQVksV0FBVztBQUFBLEVBQ2pEO0FBQ0o7QUFFQSxTQUFTLHNCQUFzQjtBQUMzQixNQUFJLGVBQU8sYUFBYTtBQUFFO0FBQUEsRUFBUTtBQUNsQyxFQUFBQSxLQUFJLEtBQUssc0VBQXNFO0FBRS9FLE1BQUksbUJBQW1CO0FBQ25CLHNCQUFrQixLQUFLO0FBQUEsRUFDM0I7QUFFQSxpQkFBZSxXQUFXLHNCQUFzQixNQUFNO0FBQUUsWUFBUSxJQUFJLG9CQUFvQjtBQUFBLEVBQUcsQ0FBQztBQUM1RixpQkFBZSxXQUFXLDRCQUE0QixNQUFNO0FBQUUsWUFBUSxJQUFJLG9CQUFvQjtBQUFBLEVBQUcsQ0FBQztBQUNsRyxpQkFBZSxXQUFXLHNCQUFzQixNQUFNO0FBQUUsWUFBUSxJQUFJLG9CQUFvQjtBQUFBLEVBQUcsQ0FBQztBQUM1RixpQkFBZSxXQUFXLHNCQUFzQixNQUFNO0FBQUUsWUFBUSxJQUFJLG9CQUFvQjtBQUFBLEVBQUcsQ0FBQztBQUU1RixNQUFJLDJCQUFtQixhQUFhLFNBQVM7QUFDekMsNkJBQXlCLFdBQVc7QUFBQSxFQUN4QztBQUVBLE1BQUksMkJBQW1CLGFBQWEsU0FBUztBQUN6QywrQkFBMkI7QUFBQSxFQUMvQjtBQUVBLE1BQUksMkJBQW1CLGFBQWEsVUFBVTtBQUMxQywyQkFBdUI7QUFBQSxFQUMzQjtBQUNKO0FBRUEsU0FBU0MscUJBQW9CLFFBQVE7QUFDakMsc0JBQXdCLE1BQU07QUFDbEM7OztBRDFGQSxPQUFPQyxVQUFTO0FBRWhCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVEscUJBQW9CO0FBQzVCLE9BQU9DLFdBQVU7QUFFakIsSUFBTUMsYUFBWSxZQUFZO0FBRzlCLFNBQVMsdUJBQXVCO0FBQzlCLE1BQUlDLEtBQUksWUFBWTtBQUNsQixVQUFNLFdBQVdDLE1BQUssUUFBUSxlQUFlLHFCQUFxQixVQUFVLFlBQVk7QUFDeEYsUUFBSUMsSUFBRyxXQUFXLFFBQVEsRUFBRyxRQUFPO0FBQUEsRUFDdEM7QUFDQSxRQUFNLGFBQWFELE1BQUtGLFlBQVcsVUFBVSxZQUFZO0FBQ3pELE1BQUlHLElBQUcsV0FBVyxVQUFVLEVBQUcsUUFBTztBQUN0QyxRQUFNLG1CQUFtQkQsTUFBS0YsWUFBVyxRQUFRLFlBQVksWUFBWTtBQUN6RSxNQUFJRyxJQUFHLFdBQVcsZ0JBQWdCLEVBQUcsUUFBTztBQUM1QyxRQUFNLGFBQWFELE1BQUtGLFlBQVcsWUFBWTtBQUMvQyxNQUFJRyxJQUFHLFdBQVcsVUFBVSxFQUFHLFFBQU87QUFDdEMsU0FBT0QsTUFBS0YsWUFBVyx3QkFBd0I7QUFDakQ7QUFVQSxJQUFNLGdCQUFOLE1BQW9CO0FBQUEsRUFDaEIsY0FBZTtBQUNiLFNBQUssZUFBZSxDQUFDO0FBQ3JCLFNBQUssb0JBQW9CLENBQUM7QUFDMUIsU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssYUFBYTtBQUNsQixTQUFLLGdCQUFnQjtBQUNyQixTQUFLLFlBQVk7QUFDakIsU0FBSyxZQUFZO0FBQ2pCLFNBQUssU0FBUztBQUNkLFNBQUssa0JBQWtCO0FBRXZCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssbUJBQW1CO0FBQ3hCLFNBQUssc0JBQXNCO0FBQUEsRUFDN0I7QUFBQSxFQUVBLEtBQU0sSUFBSUksU0FBUTtBQUNkLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBU0E7QUFDZCxTQUFLLHNCQUFzQixJQUFJLGlCQUFpQixLQUFLLGNBQWMsS0FBSyxJQUFJLEdBQUcsR0FBSTtBQUNuRixTQUFLLHFCQUFxQjtBQUFBLEVBQzlCO0FBQUE7QUFBQSxFQUdBLDBCQUEwQjtBQUN0QixVQUFNLGdCQUFnQixjQUFjLGlCQUFpQjtBQUNyRCxRQUFJLGVBQWU7QUFDakIsYUFBTztBQUFBLElBQ1QsT0FBTztBQUNILFVBQUksS0FBSyxrQkFBaUI7QUFBQyxlQUFPLEtBQUs7QUFBQSxNQUFnQixXQUM5QyxLQUFLLFlBQVc7QUFBQyxlQUFPLEtBQUs7QUFBQSxNQUFVLFdBQ3ZDLEtBQUssWUFBVztBQUFDLGVBQU8sS0FBSztBQUFBLE1BQVUsT0FDM0M7QUFBRSxlQUFPO0FBQUEsTUFBTTtBQUFBLElBQ3hCO0FBQUEsRUFDSjtBQUFBLEVBR0Esa0JBQWtCLFNBQVM7QUFDdkIsU0FBSyxZQUFZLElBQUksY0FBYztBQUFBLE1BQy9CLE9BQU87QUFBQSxNQUNQLE1BQU1GLE1BQUssMkJBQW1CLFlBQVksU0FBUyxVQUFVO0FBQUEsTUFDN0QsUUFBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsYUFBWTtBQUFBLE1BQ1osaUJBQWlCO0FBQUE7QUFBQSxNQUVqQixhQUFhO0FBQUE7QUFBQTtBQUFBLE1BR2IsTUFBTTtBQUFBO0FBQUEsSUFFVixDQUFDO0FBRUQsUUFBSSxTQUFRO0FBQUksV0FBSyxVQUFVLFFBQVEsbUdBQW1HO0FBQUEsSUFBSSxPQUN6STtBQUFXLFdBQUssVUFBVSxRQUFRLHFHQUFxRztBQUFBLElBQUk7QUFHaEosU0FBSyxVQUFVLFlBQVksS0FBSyxtQkFBbUIsTUFBTTtBQUNyRCxVQUFJLEtBQUssYUFBYSxDQUFDLEtBQUssVUFBVSxVQUFVLEdBQUc7QUFDL0MsYUFBSyxVQUFVLEtBQUs7QUFBQSxNQUN4QjtBQUFBLElBQ0osQ0FBQztBQUVELFNBQUssVUFBVSxZQUFZLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxRQUFRO0FBQzFELE1BQUFHLEtBQUksS0FBSyxpREFBaUQ7QUFDMUQsTUFBQUEsS0FBSSxLQUFLLEdBQUc7QUFBQSxJQUNoQixDQUFDO0FBQ0QsU0FBSyxVQUFVLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDM0QsTUFBQUEsS0FBSSxLQUFLLGtEQUFrRDtBQUMzRCxNQUFBQSxLQUFJLEtBQUssR0FBRztBQUFBLElBQ2hCLENBQUM7QUFFQSxTQUFLLFVBQVUsWUFBWSxHQUFHLGNBQWMsQ0FBQyxPQUFPLFFBQVE7QUFDekQsTUFBQUEsS0FBSSxLQUFLLCtDQUErQztBQUN4RCxNQUFBQSxLQUFJLEtBQUssR0FBRztBQUNaLFlBQU0sZUFBZTtBQUFBLElBQ3pCLENBQUM7QUFHQSxTQUFLLFVBQVUsWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLElBQUksTUFBTTtBQUMxRCxNQUFBQSxLQUFJLEtBQUssbURBQW1EO0FBQzVELE1BQUFBLEtBQUksS0FBSyxHQUFHO0FBQ1osYUFBTyxFQUFFLFFBQVEsT0FBTztBQUFBLElBQzVCLENBQUM7QUFFRCxTQUFLLFVBQVUsWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sUUFBUTtBQUMzRCxNQUFBQSxLQUFJLEtBQUssc0RBQXNELEdBQUc7QUFFbEUsVUFBSSxJQUFJLFdBQVcsbUJBQW1CLEdBQUc7QUFDckMsY0FBTSxlQUFlO0FBQ3JCLGNBQU0sU0FBUztBQUVmLGNBQU0sUUFBUSxJQUFJLFVBQVUsT0FBTyxNQUFNO0FBR3pDLFFBQUFBLEtBQUksS0FBSyxvREFBb0Q7QUFDN0QsUUFBQUEsS0FBSSxLQUFLLHdDQUF3QyxLQUFLO0FBQ3RELGFBQUssV0FBVyxZQUFZLEtBQUssWUFBWSxLQUFLO0FBQ2xELGFBQUssVUFBVSxNQUFNO0FBQUEsTUFDekI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUVQO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNQSxrQkFBa0I7QUFDZCxTQUFLLFlBQVksSUFBSSxjQUFjO0FBQUEsTUFDL0IsT0FBTztBQUFBLE1BQ1AsTUFBTUgsTUFBSywyQkFBbUIsWUFBWSxTQUFTLFVBQVU7QUFBQSxNQUM3RCxRQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxRQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixhQUFZO0FBQUEsTUFDWixpQkFBaUI7QUFBQSxNQUNqQixXQUFXO0FBQUEsTUFDWCxhQUFhO0FBQUEsTUFDYixTQUFTO0FBQUEsTUFDVCxPQUFPO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQUEsSUFDakIsQ0FBQztBQUVELFNBQUssVUFBVSxTQUFTQSxNQUFLLDJCQUFtQixZQUFZLGFBQWEsWUFBWSxDQUFDO0FBR3RGLFNBQUssVUFBVSxZQUFZLEtBQUssbUJBQW1CLE1BQU07QUFDckQsVUFBSSxLQUFLLGFBQWEsQ0FBQyxLQUFLLFVBQVUsVUFBVSxHQUFHO0FBQy9DLGFBQUssVUFBVSxLQUFLO0FBQUEsTUFDeEI7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQXVCQSxZQUFZLFNBQVM7QUFDakIsUUFBSSxXQUFXLElBQUksY0FBYztBQUFBLE1BQzdCLEdBQUcsUUFBUSxPQUFPLElBQUk7QUFBQSxNQUN0QixHQUFHLFFBQVEsT0FBTyxJQUFJO0FBQUEsTUFDdEIsUUFBUSxLQUFLO0FBQUEsTUFDYixhQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxPQUFPLFFBQVEsT0FBTztBQUFBLE1BQ3RCLFFBQVEsUUFBUSxPQUFPO0FBQUEsTUFDdkIsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsV0FBVztBQUFBO0FBQUEsTUFDWCxhQUFhO0FBQUE7QUFBQSxNQUViLFNBQVM7QUFBQSxNQUNULE9BQU87QUFBQSxNQUNQLE1BQU1BLE1BQUssMkJBQW1CLFlBQVksU0FBUyxVQUFVO0FBQUEsTUFDN0QsZ0JBQWdCO0FBQUEsUUFDWixTQUFTQSxNQUFLRixZQUFXLGdDQUFnQztBQUFBLE1BQzdEO0FBQUEsSUFDSixDQUFDO0FBRUQsUUFBSSxNQUFNO0FBQ1YsUUFBSUMsS0FBSSxZQUFZO0FBQ2hCLGVBQVMsU0FBUyxxQkFBcUIsR0FBRyxFQUFDLE1BQU0sS0FBSyxHQUFHLElBQUcsQ0FBQztBQUFBLElBQ2pFLE9BQ0s7QUFDRCxZQUFNLEdBQUcsdUJBQW1CLE1BQU0sR0FBRztBQUNyQyxlQUFTLFFBQVEsR0FBRztBQUFBLElBQ3hCO0FBRUEsYUFBUyxXQUFXO0FBQ3BCLGFBQVMsZUFBZSxLQUFLO0FBRzdCLGFBQVMsVUFBVTtBQUFBLE1BQ2YsR0FBRyxRQUFRLE9BQU87QUFBQSxNQUNsQixHQUFHLFFBQVEsT0FBTztBQUFBLE1BQ2xCLE9BQU8sUUFBUSxPQUFPO0FBQUEsTUFDdEIsUUFBUSxRQUFRLE9BQU87QUFBQSxJQUMzQixDQUFDO0FBRUQsYUFBUyxlQUFlLE1BQU0sZ0JBQWdCLENBQUM7QUFDL0MsYUFBUyxLQUFLO0FBRWQsUUFBSSxRQUFRLGFBQVksVUFBVTtBQUM5QixlQUFTLGNBQWMsSUFBSTtBQUMzQixlQUFTLEdBQUcscUJBQXFCLE1BQU07QUFDbkMsaUJBQVMsY0FBYyxJQUFJO0FBQUEsTUFDL0IsQ0FBQztBQUFBLElBQ0wsT0FDSztBQUNELGVBQVMsU0FBUyxJQUFJO0FBQUEsSUFDMUI7QUFDQSxhQUFTLFFBQVE7QUFDakIsYUFBUyxVQUFVO0FBQ25CLFNBQUssYUFBYSxLQUFLLFFBQVE7QUFBQSxFQUNuQztBQUFBO0FBQUEsRUFJQSxNQUFNLG1CQUFrQjtBQUNwQixRQUFJLFdBQVcsT0FBTyxlQUFlO0FBR3JDLFFBQUksQ0FBQyxLQUFLLE9BQU8sYUFBYTtBQUUxQixVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxZQUFZLEdBQUc7QUFDbkQsWUFBSSxVQUFVO0FBQ2QsY0FBTSxhQUFhO0FBQ25CLGVBQU8sQ0FBQyxLQUFLLFdBQVcsVUFBVSxLQUFLLFVBQVUsWUFBWTtBQUN6RCxnQkFBTSxLQUFLLE1BQU0sR0FBRztBQUNwQjtBQUFBLFFBQ0o7QUFFQSxjQUFNLEtBQUssTUFBTSxHQUFHO0FBQUEsTUFDeEI7QUFHQSxXQUFLLGVBQWUsS0FBSyxhQUFhLE9BQU8sY0FBWSxZQUFZLENBQUMsU0FBUyxZQUFZLENBQUM7QUFHNUYsWUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUkvQixVQUFJLEtBQUssZUFBZTtBQUNwQix1QkFBZSxJQUFJLEtBQUssYUFBYTtBQUFBLE1BQ3pDO0FBR0EsWUFBTSxpQkFBaUIsT0FBTyxrQkFBa0I7QUFDaEQsVUFBSSxrQkFBa0IsZUFBZSxJQUFJO0FBQ3JDLHVCQUFlLElBQUksZUFBZSxFQUFFO0FBQUEsTUFDeEM7QUFHQSxVQUFJLEtBQUssY0FBYyxDQUFDLEtBQUssV0FBVyxZQUFZLEdBQUc7QUFDbkQsWUFBSTtBQUNBLGdCQUFNLFNBQVMsS0FBSyxXQUFXLFVBQVU7QUFDekMsZ0JBQU0sVUFBVSxPQUFPLG1CQUFtQixNQUFNO0FBQ2hELHlCQUFlLElBQUksUUFBUSxFQUFFO0FBQzdCLFVBQUFJLEtBQUksS0FBSywrREFBK0QsUUFBUSxFQUFFLEVBQUU7QUFBQSxRQUN4RixTQUFTLEtBQUs7QUFDVixVQUFBQSxLQUFJLE1BQU0sd0VBQXdFLEdBQUcsRUFBRTtBQUFBLFFBQzNGO0FBQUEsTUFDSjtBQUdBLGlCQUFXLFlBQVksS0FBSyxjQUFjO0FBQ3RDLFlBQUk7QUFDQSxnQkFBTSxTQUFTLFNBQVMsVUFBVTtBQUNsQyxnQkFBTSxVQUFVLE9BQU8sbUJBQW1CLE1BQU07QUFDaEQseUJBQWUsSUFBSSxRQUFRLEVBQUU7QUFDN0IsVUFBQUEsS0FBSSxLQUFLLG1FQUFtRSxRQUFRLEVBQUUsRUFBRTtBQUFBLFFBQzVGLFNBQVMsS0FBSztBQUNWLFVBQUFBLEtBQUksTUFBTSx5RUFBeUUsR0FBRyxFQUFFO0FBQUEsUUFDNUY7QUFBQSxNQUNKO0FBR0EsZUFBUyxXQUFXLFVBQVM7QUFDekIsWUFBSSxlQUFlLElBQUksUUFBUSxFQUFFLEdBQUc7QUFDaEMsVUFBQUEsS0FBSSxLQUFLLHNEQUFzRCxRQUFRLEVBQUUscUNBQXFDO0FBQzlHO0FBQUEsUUFDSjtBQUVBLFFBQUFBLEtBQUksS0FBSyx5REFBd0QsUUFBUSxFQUFFO0FBQzNFLGFBQUssWUFBWSxPQUFPO0FBQUEsTUFDNUI7QUFFQSxZQUFNLEtBQUssTUFBTSxHQUFJO0FBQ3JCLFdBQUssYUFBYSxRQUFTLENBQUMsYUFBYTtBQUNyQyxZQUFJLFlBQVksQ0FBQyxTQUFTLFlBQVksR0FBRztBQUNyQyxtQkFBUyxRQUFRO0FBQUEsUUFDckI7QUFBQSxNQUNKLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFxQkEsdUJBQXVCLFNBQVM7QUFDNUIsUUFBSSxtQkFBbUIsSUFBSSxjQUFjO0FBQUEsTUFDckMsTUFBTTtBQUFBLE1BQ04sR0FBRyxRQUFRLE9BQU8sSUFBSTtBQUFBLE1BQ3RCLEdBQUcsUUFBUSxPQUFPLElBQUk7QUFBQTtBQUFBLE1BRXRCLGFBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLE9BQU8sUUFBUSxPQUFPO0FBQUEsTUFDdEIsUUFBUSxRQUFRLE9BQU87QUFBQSxNQUN2QixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUE7QUFBQSxNQUViLGFBQWE7QUFBQTtBQUFBLE1BRWIsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLE1BQ1AsTUFBTUgsTUFBSywyQkFBbUIsWUFBWSxTQUFTLFVBQVU7QUFBQSxNQUM3RCxnQkFBZ0I7QUFBQSxRQUNaLFNBQVNBLE1BQUtGLFlBQVcsZ0NBQWdDO0FBQUEsTUFDN0Q7QUFBQSxJQUNKLENBQUM7QUFFRCxRQUFJLE1BQU07QUFDVixRQUFJQyxLQUFJLFlBQVk7QUFDaEIsdUJBQWlCLFNBQVMscUJBQXFCLEdBQUcsRUFBQyxNQUFNLEtBQUssR0FBRyxJQUFHLENBQUM7QUFBQSxJQUN6RSxPQUNLO0FBQ0QsWUFBTSxHQUFHLHVCQUFtQixNQUFNLEdBQUc7QUFDckMsdUJBQWlCLFFBQVEsR0FBRztBQUFBLElBQ2hDO0FBRUEsUUFBSSxLQUFLLE9BQU8sY0FBYztBQUFFLHVCQUFpQixZQUFZLGFBQWE7QUFBQSxJQUFHO0FBRzdFLFNBQUssa0JBQWtCLEtBQUssZ0JBQWdCO0FBRzVDLHFCQUFpQixZQUFZLEtBQUssbUJBQW1CLE1BQU07QUFDdkQsVUFBSSxDQUFDLGlCQUFrQjtBQUV2Qix1QkFBaUIsV0FBVztBQUM1Qix1QkFBaUIsZUFBZSxLQUFLO0FBQ3JDLHVCQUFpQixTQUFTLElBQUk7QUFDOUIsdUJBQWlCLGVBQWUsTUFBTSxlQUFlLENBQUM7QUFDdEQsdUJBQWlCLEtBQUs7QUFDdEIsdUJBQWlCLFFBQVE7QUFDekIsdUJBQWlCLFlBQVksSUFBSTtBQUNqQyx1QkFBaUIsMEJBQTBCLElBQUk7QUFDL0MsV0FBSyxnQkFBZ0IsWUFBWTtBQUFBLElBQ3JDLENBQUM7QUFFRCxxQkFBaUIsR0FBRyxTQUFTLE9BQVEsTUFBTTtBQUN2QyxVQUFJLENBQUMsS0FBSyxPQUFPLGFBQWE7QUFBRSxVQUFFLGVBQWU7QUFBQSxNQUFHO0FBQUEsSUFDeEQsQ0FBQztBQUVELHFCQUFpQixHQUFHLFVBQVUsTUFBTTtBQUNoQyxXQUFLLG9CQUFvQixLQUFLLGtCQUFrQixPQUFPLFNBQU8sT0FBTyxRQUFRLG9CQUFvQixDQUFDLElBQUksWUFBWSxDQUFDO0FBQUEsSUFDdkgsQ0FBQztBQUFBLEVBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQTRCQSxNQUFNLGlCQUFpQixVQUFVLE9BQU8sY0FBYyxnQkFBZ0I7QUFFbEUsUUFBSSxhQUFhLFNBQVMsYUFBYSxhQUFjLGFBQWEsWUFBWSxhQUFhLGVBQWUsYUFBYSxZQUFZLGFBQWEsVUFBVSxhQUFhLGtCQUFrQixhQUFhLGtCQUFrQixDQUFDLE9BQU07QUFDM04sTUFBQUksS0FBSSxLQUFLLCtEQUErRDtBQUN4RSxpQkFBVztBQUFBLElBQ2Y7QUFHQSxRQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxVQUFVLENBQUMsZUFBZSxJQUFJO0FBQ2pFLHVCQUFpQixPQUFPLGtCQUFrQjtBQUMxQyxVQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxRQUFRO0FBQzNDLGNBQU0sV0FBVyxPQUFPLGVBQWU7QUFDdkMseUJBQWlCLFNBQVMsQ0FBQyxLQUFLO0FBQUEsTUFDcEM7QUFBQSxJQUNKO0FBSUEsUUFBSSxrQkFBa0IsZUFBZSxJQUFJO0FBQ3JDLFdBQUssZ0JBQWdCLGVBQWU7QUFDcEMsTUFBQUEsS0FBSSxLQUFLLHVEQUF1RCxLQUFLLGFBQWEsa0JBQWtCO0FBQUEsSUFDeEc7QUFFQSxRQUFJLEtBQUs7QUFDVCxRQUFJLEtBQUs7QUFDVCxRQUFJLGtCQUFrQixlQUFlLFVBQVUsZUFBZSxPQUFPLEdBQUc7QUFDcEUsV0FBSyxlQUFlLE9BQU87QUFDM0IsV0FBSyxlQUFlLE9BQU87QUFBQSxJQUMvQjtBQUVBLFNBQUssYUFBYSxJQUFJLGNBQWM7QUFBQSxNQUNoQyxHQUFHLEtBQUs7QUFBQSxNQUNSLEdBQUcsS0FBSztBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLUixTQUFTO0FBQUEsTUFDVCxhQUFZO0FBQUEsTUFDWixpQkFBaUI7QUFBQSxNQUNqQixhQUFhO0FBQUEsTUFDYix3QkFBd0I7QUFBQSxNQUN4QixPQUFPLEtBQUssT0FBTyxjQUFjLFFBQVE7QUFBQSxNQUN6QyxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQUEsTUFDYixNQUFNSCxNQUFLLDJCQUFtQixZQUFZLFNBQVMsVUFBVTtBQUFBLE1BQzdELGdCQUFnQjtBQUFBLFFBQ1osU0FBU0EsTUFBS0YsWUFBVyxnQ0FBZ0M7QUFBQSxRQUN6RCxZQUFZO0FBQUEsUUFDWixrQkFBa0I7QUFBQSxRQUNsQixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsTUFBaUI7QUFBQSxJQUN0QyxDQUFDO0FBR0QsU0FBSyxXQUFXLFlBQVksS0FBSyxtQkFBbUIsWUFBWTtBQUM1RCxVQUFJLENBQUMsS0FBSyxXQUFZO0FBRXRCLFVBQUksS0FBSyxPQUFPLGNBQWM7QUFBRSxhQUFLLFdBQVcsWUFBWSxhQUFhO0FBQUEsTUFBRztBQUU1RSxVQUFJLENBQUMsS0FBSyxPQUFPLGFBQWE7QUFDMUIsWUFBSTtBQUNBLGVBQUssV0FBVyxXQUFXO0FBQzNCLGVBQUssV0FBVyxlQUFlLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsZUFBSyxXQUFXLFNBQVMsSUFBSTtBQUU3QixnQkFBTSxLQUFLLE1BQU0sR0FBRztBQUNwQixnQkFBTSxLQUFLLGlCQUFpQjtBQUM1QixlQUFLLFdBQVcsUUFBUTtBQUN4QixlQUFLLFdBQVcsTUFBTTtBQUt0QixjQUFJLENBQUMsS0FBSyxXQUFVO0FBQUUsaUJBQUssb0JBQW9CLE1BQU07QUFBQSxVQUFFO0FBQ3ZELGdCQUFNLG1CQUFtQixJQUFJO0FBRTdCLGdCQUFNLEtBQUssTUFBTSxHQUFJO0FBQ3JCLGVBQUssZ0JBQWdCO0FBQUEsUUFDekIsU0FDTSxHQUFFO0FBQUUsVUFBQUssS0FBSSxNQUFNLDhEQUE4RCxDQUFDO0FBQUEsUUFBQztBQUFBLE1BQ3hGO0FBQUEsSUFDSixDQUFDO0FBR0QsU0FBSyxXQUFXLGVBQWU7QUFDL0IsU0FBSyxXQUFXLGFBQWE7QUFTN0IsUUFBSSxhQUFhLGdCQUFrQjtBQUMvQixNQUFBQSxLQUFJLEtBQUssK0JBQStCO0FBQ3hDLFVBQUksVUFBVSxLQUFLLGdCQUFnQixXQUFXO0FBQzlDLFVBQUksQ0FBQyxTQUFTO0FBQ1YsUUFBQUEsS0FBSSxLQUFLLHNHQUFzRztBQUUvRyxhQUFLLFdBQVcsUUFBUTtBQUN4QixhQUFLLGFBQWE7QUFDbEIsYUFBSyxnQkFBZ0I7QUFDckIsNEJBQW9CLEtBQUssVUFBVTtBQUNuQyxhQUFLLGdCQUFnQixXQUFXLFdBQVc7QUFDM0MsYUFBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQ3hDO0FBQUEsTUFDSjtBQUVBLFVBQUksTUFBTTtBQUNWLFVBQUlKLEtBQUksWUFBWTtBQUNoQixhQUFLLFdBQVcsU0FBUyxxQkFBcUIsR0FBRyxFQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxHQUFFLENBQUM7QUFBQSxNQUNoRixPQUNLO0FBQ0QsWUFBSSxnQkFBZ0IsR0FBRyx1QkFBbUIsTUFBTSxHQUFHLElBQUksS0FBSztBQUM1RCxhQUFLLFdBQVcsUUFBUSxhQUFhO0FBQUEsTUFDekM7QUFFQSxVQUFJLGNBQWMsSUFBSSxZQUFZO0FBQUEsUUFDOUIsZ0JBQWdCO0FBQUEsVUFDZCxZQUFZO0FBQUEsVUFDWixrQkFBa0I7QUFBQSxRQUNwQjtBQUFBLE1BQ0osQ0FBQztBQUVELGtCQUFZLFVBQVU7QUFBQSxRQUNsQixHQUFHO0FBQUEsUUFDSCxHQUFHLEtBQUssV0FBVztBQUFBLFFBQ25CLE9BQU8sS0FBSyxXQUFXLFVBQVUsRUFBRTtBQUFBLFFBQ25DLFFBQVEsS0FBSyxXQUFXLFVBQVUsRUFBRSxTQUFTLEtBQUssV0FBVztBQUFBLE1BQ2pFLENBQUM7QUFDRCxrQkFBWSxjQUFjLEVBQUUsT0FBTyxNQUFNLFFBQVEsTUFBTSxZQUFZLE1BQU0sVUFBVSxLQUFLLENBQUM7QUFDekYsa0JBQVksWUFBWSxRQUFRLE9BQU87QUFDdkMsVUFBSSxLQUFLLE9BQU8sY0FBYztBQUFRLG9CQUFZLFlBQVksYUFBYTtBQUFBLE1BQUU7QUFFN0UsV0FBSyxXQUFXLGVBQWUsV0FBVztBQUUxQyxXQUFLLFdBQVcsR0FBRyxxQkFBcUIsTUFBTTtBQUMxQyxhQUFLLFdBQVcsZUFBZSxXQUFXO0FBRTFDLFlBQUksWUFBWSxLQUFLLFdBQVcsVUFBVTtBQUMxQyxvQkFBWSxVQUFVO0FBQUEsVUFDcEIsR0FBRztBQUFBLFVBQ0gsR0FBRyxLQUFLLFdBQVc7QUFBQSxVQUNuQixPQUFPLFVBQVU7QUFBQSxVQUNqQixRQUFRLFVBQVUsU0FBUyxLQUFLLFdBQVc7QUFBQSxRQUM3QyxDQUFDO0FBQUEsTUFDTCxDQUFDO0FBRUQsV0FBSyxXQUFXLEdBQUcsVUFBVSxNQUFNO0FBQy9CLFlBQUksWUFBWSxLQUFLLFdBQVcsVUFBVTtBQUMxQyxvQkFBWSxVQUFVO0FBQUEsVUFDcEIsR0FBRztBQUFBLFVBQ0gsR0FBRyxLQUFLLFdBQVc7QUFBQSxVQUNuQixPQUFPLFVBQVU7QUFBQSxVQUNqQixRQUFRLFVBQVUsU0FBUyxLQUFLLFdBQVc7QUFBQSxRQUM3QyxDQUFDO0FBQUEsTUFDTCxDQUFDO0FBQUEsSUFDTCxPQUVLO0FBQ0QsVUFBSSxNQUFNO0FBQ1YsVUFBSUEsS0FBSSxZQUFZO0FBQ2hCLGFBQUssV0FBVyxTQUFTLHFCQUFxQixHQUFHLEVBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLEdBQUUsQ0FBQztBQUFBLE1BQ2hGLE9BQ0s7QUFDRCxjQUFNLEdBQUcsdUJBQW1CLE1BQU0sR0FBRyxJQUFJLEtBQUs7QUFDOUMsYUFBSyxXQUFXLFFBQVEsR0FBRztBQUFBLE1BQy9CO0FBQUEsSUFDSjtBQWVBLFVBQU0sMkJBQTJCLENBQUMsVUFBVSxXQUFXLGFBQWEsVUFBVSxPQUFPLGdCQUFnQixnQkFBZ0IsTUFBTTtBQUMzSCxRQUFJLHlCQUF5QixTQUFTLGFBQWEsYUFBYSxhQUFhLGFBQWEsRUFBRSxRQUFRLEdBQUc7QUFDbkcsV0FBSyxXQUFXLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDNUQsY0FBTSxlQUFlO0FBQUEsTUFDekIsQ0FBQztBQUdELFdBQUssV0FBVyxZQUFZLEdBQUcsY0FBYyxDQUFDLE9BQU8sUUFBUTtBQUN6RCxRQUFBSSxLQUFJLEtBQUssa0RBQWtELEdBQUc7QUFDOUQsY0FBTSxlQUFlO0FBQUEsTUFDekIsQ0FBQztBQUVELFdBQUssV0FBVyxZQUFZLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQzFELFFBQUFBLEtBQUksS0FBSyw0REFBNEQsR0FBRztBQUN4RSxlQUFPLEVBQUUsUUFBUSxPQUFPO0FBQUEsTUFDNUIsQ0FBQztBQUFBLElBQ0w7QUFLQSxRQUFLLGFBQWEsYUFBYSxhQUFhLGFBQWEsRUFBRSxhQUFhLGdCQUFlO0FBQ25GLFlBQU0sY0FBYyxLQUFLLFdBQVcsZUFBZSxDQUFDO0FBR3BELGtCQUFZLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLFFBQVE7QUFDeEQsWUFBSSxRQUFRLEtBQUssZ0JBQWdCLFdBQVcsZUFBZ0I7QUFDeEQsVUFBQUEsS0FBSSxLQUFLLHdDQUF3QztBQUNqRCxnQkFBTSxlQUFlO0FBQUEsUUFDekI7QUFBQSxNQUNKLENBQUM7QUFHRCxrQkFBWSxZQUFZLEdBQUcsY0FBYyxDQUFDLE9BQU8sUUFBUTtBQUFFLGNBQU0sZUFBZTtBQUFBLE1BQUssQ0FBQztBQUd0RixrQkFBWSxZQUFZLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQUUsZUFBTyxFQUFFLFFBQVEsT0FBTztBQUFBLE1BQUssQ0FBQztBQUUxRixVQUFJLGNBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQXVDbkIsVUFBSSxvQkFBb0I7QUFDeEIsV0FBSyxlQUFlLE1BQU0sS0FBSyxRQUFRLGFBQWEsYUFBYSxpQkFBaUI7QUFDbEYsMEJBQW9CLElBQUksaUJBQWlCLEtBQUssY0FBYyxHQUFHO0FBQy9ELFdBQUssZ0JBQWdCO0FBQ3JCLHdCQUFrQixNQUFNO0FBRXhCLGtCQUFZLFlBQVksR0FBRyxtQkFBbUIsWUFBWTtBQUN0RCxvQkFBWSxZQUFZLFVBQVUsT0FBTyxPQUFPLENBQUMsVUFBVTtBQUN2RCxjQUFJLE9BQU87QUFDUCxrQkFBTSxrQkFBa0IsV0FBVztBQUFBLFVBQ3ZDO0FBQUEsUUFDSixDQUFDO0FBQUEsTUFDTCxDQUFDO0FBQUEsSUFDTDtBQUVBLFNBQUssV0FBVyxHQUFHLGVBQWUsQ0FBQyxHQUFHLFFBQVE7QUFFMUMsVUFBSSxRQUFRLHNCQUFzQixRQUFRLG1CQUFtQjtBQUN6RCxRQUFBQSxLQUFJLEtBQUssdUJBQXVCO0FBQ2hDLFVBQUUsZUFBZTtBQUFBLE1BQ3JCO0FBQUEsSUFDSixDQUFDO0FBRUQsU0FBSyxXQUFXLEdBQUcsU0FBUyxPQUFRLE1BQU07QUFDdEMsVUFBSSxLQUFLLGdCQUFnQixXQUFXLFVBQVU7QUFDMUMsWUFBSSxDQUFDLEtBQUssT0FBTyxhQUFhO0FBQUUsWUFBRSxlQUFlO0FBQUEsUUFBRztBQUFBLE1BQ3hELE9BQ0s7QUFDRCxhQUFLLFdBQVcsUUFBUTtBQUN4QixhQUFLLGFBQWE7QUFDbEIsYUFBSyxnQkFBZ0I7QUFDckIsYUFBSyxvQkFBb0IsS0FBSztBQUU5QixhQUFLLGdCQUFnQixXQUFXLFdBQVc7QUFDM0MsYUFBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQUEsTUFDNUM7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFLQSxNQUFNLFFBQVEsYUFBYSxhQUFhLG1CQUFrQjtBQUN0RCxRQUFJLFlBQVksZUFBZSxZQUFZLFlBQVksV0FBVTtBQUM3RCxrQkFBWSxZQUFZLFVBQVUsT0FBTyxPQUFPLENBQUMsVUFBVTtBQUV2RCxZQUFJLFVBQVUsTUFBTSxTQUFTLHlCQUF5QixNQUFNLFNBQVMscUJBQXFCLE1BQU0sU0FBUyxxQkFBcUI7QUFFMUgsZ0JBQU0sa0JBQWtCLFdBQVc7QUFBQSxRQUN2QztBQUFBLE1BQ0osQ0FBQztBQUFBLElBQ0wsV0FDUyxtQkFBbUI7QUFDeEIsTUFBQUEsS0FBSSxLQUFLLGlEQUFpRDtBQUMxRCx3QkFBa0IsS0FBSztBQUN2QixVQUFJLEtBQUssa0JBQWtCLG1CQUFtQjtBQUMxQyxhQUFLLGdCQUFnQjtBQUFBLE1BQ3pCO0FBQUEsSUFDSixPQUNLO0FBQ0QsTUFBQUEsS0FBSSxNQUFNLGdFQUFnRTtBQUFBLElBQzlFO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBb0JBLE1BQU0sbUJBQW1CO0FBQ3JCLFFBQUksaUJBQWlCLE9BQU8sa0JBQWtCO0FBQzlDLFVBQU0sYUFBYSxjQUFjLElBQUksSUFBSSxLQUFLLFlBQVksR0FBRyxDQUFDO0FBQzlELFFBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLFFBQVE7QUFDM0MsdUJBQWlCLE9BQU8sZUFBZSxFQUFFLENBQUM7QUFBQSxJQUM5QztBQUdBLFVBQU0sY0FBYztBQUNwQixVQUFNLGVBQWU7QUFHckIsUUFBSSxJQUFJO0FBQ1IsUUFBSSxJQUFJO0FBQ1IsUUFBSSxrQkFBa0IsZUFBZSxRQUFRO0FBQ3pDLFVBQUksZUFBZSxPQUFPLElBQUksS0FBSyxPQUFPLGVBQWUsT0FBTyxRQUFRLGVBQWUsQ0FBQztBQUN4RixVQUFJLGVBQWUsT0FBTyxJQUFJLEtBQUssT0FBTyxlQUFlLE9BQU8sU0FBUyxnQkFBZ0IsQ0FBQztBQUFBLElBQzlGO0FBRUEsU0FBSyxhQUFhLElBQUksY0FBYztBQUFBLE1BQ2hDLE9BQU87QUFBQSxNQUNQLE1BQU1ILE1BQUssMkJBQW1CLFlBQVksU0FBUyxVQUFVO0FBQUEsTUFDN0Q7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixXQUFXO0FBQUEsTUFDWCxXQUFXO0FBQUE7QUFBQSxNQUNYLGdCQUFnQjtBQUFBO0FBQUEsTUFDaEIsTUFBTTtBQUFBO0FBQUEsTUFJTixnQkFBZ0I7QUFBQSxRQUNaLFNBQVNILE1BQUs7QUFBQSxVQUNWO0FBQUEsVUFDQUEsTUFBSyxLQUFLLGlIQUE0QyxzQkFBa0U7QUFBQSxRQUM1SDtBQUFBLFFBQ0EsWUFBWTtBQUFBLFFBQ1osc0JBQXNCO0FBQUE7QUFBQSxNQUMxQjtBQUFBLElBQ0osQ0FBQztBQUdELFNBQUssV0FBVyxHQUFHLFNBQVMsT0FBUSxNQUFNO0FBQ3RDLFVBQUksQ0FBQyxLQUFLLE9BQU8sZUFBZSxDQUFDLEtBQUssV0FBVyxXQUFXO0FBQ3hELFlBQUksS0FBSyxnQkFBZ0IsV0FBVyxPQUFNO0FBQ3RDLGdCQUFNLFlBQVksQ0FBQywyQkFBbUIsU0FBUztBQUMvQyxjQUFJLENBQUMsV0FBVztBQUNaLFlBQUFNLEtBQUksS0FBSyxxRkFBcUY7QUFDOUYsaUJBQUssV0FBVyxZQUFZO0FBQzVCO0FBQUEsVUFDSjtBQUVBLFlBQUUsZUFBZTtBQUNqQixnQkFBTSxLQUFLLG9CQUFvQjtBQUMvQixVQUFBQSxLQUFJLEtBQUssc0VBQXNFO0FBQy9FLGVBQUssV0FBVyxLQUFLO0FBQ3JCO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKLENBQUM7QUFHRCxTQUFLLFdBQVcsV0FBVztBQUMzQixTQUFLLFdBQVcsTUFBTTtBQUN0QixTQUFLLFdBQVcsUUFBUTtBQUd4QixRQUFJLEtBQUssT0FBTyxjQUFjO0FBQUUsV0FBSyxXQUFXLFlBQVksYUFBYTtBQUFBLElBQUc7QUFFNUUsUUFBSUosS0FBSSxjQUFjLFFBQVEsSUFBSSxPQUFPLEdBQUc7QUFDeEMsWUFBTSxXQUFXLHFCQUFxQjtBQUN0QyxNQUFBSSxLQUFJLEtBQUssbURBQW1ELFFBQVEsRUFBRTtBQUN0RSxXQUFLLFdBQVcsU0FBUyxRQUFRO0FBQUEsSUFDckMsT0FDSztBQUNELFlBQU0sTUFBTSxHQUFHLHVCQUFtQjtBQUNsQyxNQUFBQSxLQUFJLEtBQUssa0RBQWtELEdBQUcsRUFBRTtBQUNoRSxXQUFLLFdBQVcsUUFBUSxHQUFHO0FBQUEsSUFDL0I7QUFBQSxFQUNKO0FBQUEsRUFhQSxNQUFNLGdCQUFnQixTQUFRO0FBQzFCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssV0FBVyxZQUFZO0FBQzVCLFFBQUk7QUFDQSxZQUFNLE9BQU8sZUFBZSxLQUFLLFlBQVk7QUFBQSxRQUN6QyxNQUFNO0FBQUEsUUFDTixTQUFTLENBQUMsSUFBSTtBQUFBLFFBQ2QsT0FBTztBQUFBLFFBQ1A7QUFBQSxRQUNBLFVBQVU7QUFBQSxNQUNkLENBQUM7QUFDRCxNQUFBSixLQUFJLEtBQUs7QUFBQSxJQUNiLFVBQUU7QUFDRSxXQUFLLGtCQUFrQjtBQUFBLElBQzNCO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxtQkFBa0I7QUFDcEIsUUFBSSxLQUFLLGtCQUFrQjtBQUN2QixNQUFBSSxLQUFJLEtBQUssaUVBQWlFO0FBQzFFO0FBQUEsSUFDSjtBQUNBLFNBQUssbUJBQW1CO0FBQ3hCLFFBQUk7QUFDQSxVQUFJLFNBQVMsTUFBTSxPQUFPLGVBQWUsS0FBSyxZQUFZO0FBQUEsUUFDdEQsTUFBTTtBQUFBLFFBQ04sU0FBUyxDQUFDLE1BQU0sTUFBTTtBQUFBLFFBQ3RCLE9BQU87QUFBQSxRQUNQLFNBQVM7QUFBQSxRQUNULFVBQVU7QUFBQSxNQUNkLENBQUM7QUFDRCxVQUFHLE9BQU8sWUFBWSxHQUFFO0FBQ3BCLFFBQUFBLEtBQUksS0FBSyw4RUFBOEU7QUFBQSxNQUMzRixPQUNLO0FBQ0QsYUFBSyxXQUFXLFlBQVk7QUFDNUIsUUFBQUosS0FBSSxLQUFLO0FBQUEsTUFDYjtBQUFBLElBQ0osVUFBRTtBQUNFLFdBQUssbUJBQW1CO0FBQUEsSUFDNUI7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLHNCQUFxQjtBQUN2QixTQUFLLHNCQUFzQjtBQUMzQixRQUFJO0FBQ0EsWUFBTSxPQUFPLGVBQWUsS0FBSyxZQUFZO0FBQUEsUUFDekMsTUFBTTtBQUFBLFFBQ04sU0FBUyxDQUFDLElBQUk7QUFBQSxRQUNkLE9BQU87QUFBQSxRQUNQLFNBQVM7QUFBQSxNQUViLENBQUM7QUFBQSxJQUNMLFVBQUU7QUFDRSxXQUFLLHNCQUFzQjtBQUFBLElBQy9CO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBUUEsWUFBVztBQUNQLFdBQU8sUUFBUSxJQUFJLHFCQUFxQjtBQUFBLEVBQzVDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFNLGdCQUFlO0FBQ2pCLFFBQUc7QUFFQyxZQUFNLFlBQVksTUFBTSxhQUFhO0FBRXJDLFVBQUksYUFBYSxVQUFVLFNBQVMsVUFBVSxNQUFNLE1BQU07QUFDdEQsWUFBSSxPQUFPLFVBQVUsTUFBTTtBQUMzQixZQUFJLFFBQVEsVUFBVSxNQUFNO0FBQzVCLFlBQUksWUFBWSxLQUFLLFlBQVk7QUFDakMsWUFBSSxhQUFhLE1BQU0sWUFBWTtBQUVuQyxZQUFJLFVBQVUsU0FBUyxNQUFNLEtBQUssVUFBVSxTQUFTLE1BQU0sS0FBTSxVQUFVLFNBQVMsVUFBVSxLQUFNLFdBQVcsU0FBUyxvQkFBb0IsS0FBTSxXQUFXLFNBQVMsbUJBQW1CLEdBQUc7QUFFeEwsZUFBSyxxQkFBcUI7QUFBQSxRQUM5QixPQUNLO0FBQ0QsY0FBSSxLQUFLLG9CQUFtQjtBQUN4QixZQUFBSSxLQUFJLEtBQUssdUVBQXVFLEtBQUssTUFBTSxJQUFJLEdBQUc7QUFBQSxVQUN0RztBQUNBLGVBQUssZ0JBQWdCLFdBQVcsUUFBUTtBQUN4QyxlQUFLLHFCQUFxQjtBQUFBLFFBQzlCO0FBQUEsTUFDSjtBQUFBLElBQ0osU0FDTSxLQUFJO0FBQ04sTUFBQUEsS0FBSSxNQUFNLGtDQUFrQyxHQUFHLEVBQUU7QUFBQSxJQUNyRDtBQUFBLEVBQ0o7QUFBQTtBQUFBLEVBR0EsZ0JBQWdCLFNBQVMsY0FBYTtBQUNsQyxRQUFJLFdBQVcsY0FBYTtBQUN4QixNQUFBQSxLQUFJLEtBQUssMkRBQTJELE1BQU0sRUFBRTtBQUM1RSxXQUFLLFdBQVcsWUFBWSxRQUFRLE1BQU0sS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLElBQ2xFLFdBQ1MsV0FBVyxjQUFjO0FBQzlCLE1BQUFBLEtBQUksS0FBSywyREFBMkQsTUFBTSxRQUFRO0FBQ2xGLGVBQVMsb0JBQW9CLEtBQUssbUJBQWtCO0FBQ2hELHlCQUFpQixZQUFZLFFBQVEsTUFBTSxLQUFLLG9CQUFvQixJQUFJLENBQUM7QUFBQSxNQUM3RTtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUE7QUFBQSxFQUVBLHFCQUFvQjtBQUNoQixRQUFJLEtBQUssWUFBVztBQUNoQixXQUFLLFdBQVcsbUJBQW1CLE1BQU07QUFDekMsTUFBQUEsS0FBSSxLQUFLLDREQUE0RDtBQUFBLElBQ3pFO0FBQUEsRUFDSjtBQUFBO0FBQUEsRUFFQSxNQUFNLElBQUk7QUFDTixXQUFPLElBQUksUUFBUSxhQUFXLFdBQVcsU0FBUyxFQUFFLENBQUM7QUFBQSxFQUN6RDtBQUFBO0FBQUEsRUFFQSxNQUFNLFVBQVUsWUFBWTtBQUV4QixJQUFBQSxLQUFJLEtBQUssK0RBQStEO0FBRXhFLFFBQUksUUFBUSxhQUFhLFNBQVE7QUFDN0IsWUFBTSxLQUFLLGNBQWM7QUFDekIsTUFBQUEsS0FBSSxLQUFLLDZCQUE2QjtBQUFBLElBQzFDO0FBRUEsZUFBVyxvQkFBb0IsV0FBVyxrQkFBa0IsT0FBTyxTQUFPLE9BQU8sQ0FBQyxJQUFJLFlBQVksQ0FBQztBQUNuRyxVQUFNLHNCQUFzQixXQUFXLGtCQUFrQixLQUFLLFNBQU8sT0FBTyxDQUFDLElBQUksWUFBWSxLQUFLLElBQUksVUFBVSxDQUFDO0FBRWpILFFBQUksdUJBQXVCLFdBQVcsaUJBQWlCLFlBQVksWUFBWTtBQUFFO0FBQUEsSUFBTztBQUN4RixRQUFJLFdBQVcsb0JBQW1CO0FBQzlCLGlCQUFXLFdBQVcsUUFBUTtBQUM5QixpQkFBVyxXQUFXLEtBQUs7QUFDM0IsaUJBQVcsV0FBVyxNQUFNO0FBQzVCLE1BQUFBLEtBQUksS0FBSywwRUFBMEU7QUFDbkY7QUFBQSxJQUNKO0FBRUEsZUFBVyxnQkFBZ0IsV0FBVyxRQUFRO0FBRTlDLGVBQVcsV0FBVyxRQUFRO0FBQzlCLGVBQVcsV0FBVyxTQUFTLElBQUk7QUFDbkMsZUFBVyxXQUFXLEtBQUs7QUFDM0IsZUFBVyxXQUFXLE1BQU07QUFBQSxFQVdoQztBQUFBO0FBQUEsRUFFQSxvQkFBb0IsWUFBWTtBQUM1QixJQUFBQSxLQUFJLEtBQUssZ0VBQWdFO0FBQ3pFLFFBQUk7QUFFQSxpQkFBVyxrQkFBa0IsQ0FBQyxFQUFFLEtBQUs7QUFDckMsaUJBQVcsa0JBQWtCLENBQUMsRUFBRSxRQUFRO0FBQ3hDLGlCQUFXLGtCQUFrQixDQUFDLEVBQUUsTUFBTTtBQUFBLElBQzFDLFNBQ08sS0FBSTtBQUNQLE1BQUFBLEtBQUksTUFBTSx3Q0FBd0MsR0FBRyxFQUFFO0FBQUEsSUFDM0Q7QUFBQSxFQUVKO0FBRUo7QUFHQSxJQUFPLHdCQUFRLElBQUksY0FBYzs7O0FLeGlDakMsT0FBT0MsU0FBUTtBQUNmLE9BQU8sY0FBYztBQUNyQixPQUFPLGFBQWE7QUFDcEIsU0FBUyxRQUFBQyxhQUFZO0FBQ3JCLFNBQVMsVUFBQUMsU0FBUSxXQUFBQyxVQUFTLE9BQUFDLE1BQUssaUJBQUFDLGdCQUFlLGVBQUFDLG9CQUFtQjs7O0FDTGpFLE9BQU9DLFdBQVU7QUFDakIsT0FBT0MsU0FBUTtBQUNmLE9BQU8sUUFBUTtBQUNmLE9BQU8sU0FBUzs7O0FDckJoQixTQUFRLGtCQUFpQjs7O0FDQXpCO0FBQUEsRUFDSSxNQUFRO0FBQUEsSUFDSixNQUFRO0FBQUEsTUFDSixTQUFXO0FBQUEsTUFDWCxZQUFjO0FBQUEsTUFDZCxNQUFRO0FBQUEsSUFDWjtBQUFBLEVBQ0o7QUFBQSxFQUNBLFNBQVk7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLE9BQVM7QUFBQSxJQUNULFVBQVk7QUFBQSxJQUNaLEtBQU87QUFBQSxJQUNQLElBQUs7QUFBQSxJQUNMLFVBQVc7QUFBQSxJQUNYLFVBQVk7QUFBQSxJQUNaLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLFVBQVk7QUFBQSxJQUNaLGFBQWU7QUFBQSxJQUNmLFlBQWM7QUFBQSxJQUNkLFdBQWE7QUFBQSxJQUNiLGNBQWdCO0FBQUEsSUFDaEIsZ0JBQWtCO0FBQUEsSUFDbEIsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsUUFBUztBQUFBLElBQ1QsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsT0FBUztBQUFBLElBQ1QsYUFBYztBQUFBLElBQ2QsU0FBVTtBQUFBLElBQ1YsT0FBUztBQUFBLElBQ1QsZ0JBQWlCO0FBQUEsSUFDakIsZUFBZ0I7QUFBQSxJQUNoQixjQUFlO0FBQUEsSUFDZixTQUFVO0FBQUEsSUFDVixXQUFZO0FBQUEsSUFDWixJQUFNO0FBQUEsSUFDTixJQUFLO0FBQUEsSUFDTCxJQUFLO0FBQUEsSUFDTCxJQUFLO0FBQUEsSUFDTCxJQUFLO0FBQUEsSUFDTCxJQUFLO0FBQUEsSUFDTCxNQUFRO0FBQUEsSUFDUixZQUFjO0FBQUEsSUFDZCxVQUFZO0FBQUEsSUFDWixTQUFVO0FBQUEsSUFDVixrQkFBb0I7QUFBQSxJQUNwQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsSUFDUixnQkFBa0I7QUFBQSxJQUNsQixVQUFZO0FBQUEsSUFDWixjQUFnQjtBQUFBLEVBQ3BCO0FBQUEsRUFDQSxTQUFXO0FBQUEsSUFDUCxlQUFpQjtBQUFBLElBQ2pCLFlBQWM7QUFBQSxJQUNkLGFBQWU7QUFBQSxJQUNmLG1CQUFxQjtBQUFBLElBQ3JCLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFFBQVU7QUFBQSxJQUNWLG1CQUFxQjtBQUFBLEVBRXpCO0FBQUEsRUFDQSxNQUFRO0FBQUEsSUFDSixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsSUFDaEIsWUFBYztBQUFBLElBQ2QsU0FBVztBQUFBLElBQ1gsV0FBYTtBQUFBLElBQ2IsZUFBaUI7QUFBQSxJQUNqQixnQkFBa0I7QUFBQSxJQUNsQixVQUFZO0FBQUEsRUFDaEI7QUFBQSxFQUNBLFFBQVU7QUFBQSxJQUNOLGFBQWU7QUFBQSxJQUNmLGNBQWdCO0FBQUEsSUFDaEIsZUFBaUI7QUFBQSxJQUNqQixhQUFlO0FBQUEsSUFDZixXQUFhO0FBQUEsSUFDYixZQUFjO0FBQUEsSUFDZCxRQUFVO0FBQUEsSUFDVixXQUFhO0FBQUEsSUFDYixXQUFhO0FBQUEsSUFDYixhQUFlO0FBQUEsSUFDZixpQkFBbUI7QUFBQSxJQUNuQixpQkFBbUI7QUFBQSxJQUNuQixRQUFTO0FBQUEsSUFDVCxTQUFVO0FBQUEsSUFDVixnQkFBa0I7QUFBQSxJQUNsQixjQUFnQjtBQUFBLElBQ2hCLGFBQWU7QUFBQSxJQUNmLE9BQVM7QUFBQSxJQUNULFNBQVc7QUFBQSxJQUNYLE9BQVM7QUFBQSxJQUNULE9BQVM7QUFBQSxJQUNULFdBQWE7QUFBQSxJQUNiLFFBQVU7QUFBQSxJQUNWLE1BQVE7QUFBQSxJQUNSLFdBQWE7QUFBQSxJQUNiLE1BQVE7QUFBQSxJQUNSLE9BQVM7QUFBQSxJQUNULFdBQWE7QUFBQSxJQUNiLFNBQVc7QUFBQSxJQUNYLFFBQVU7QUFBQSxJQUNWLE1BQU87QUFBQSxJQUNQLE1BQU87QUFBQSxJQUNQLE9BQVE7QUFBQSxJQUNSLE1BQU87QUFBQSxJQUNQLFFBQVM7QUFBQSxJQUNULFdBQVk7QUFBQSxJQUNaLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFVBQVc7QUFBQSxJQUNYLFdBQVk7QUFBQSxJQUNaLGFBQWM7QUFBQSxJQUNkLFlBQWE7QUFBQSxJQUNiLE1BQU87QUFBQSxJQUNQLFdBQVk7QUFBQSxJQUNaLE1BQU87QUFBQSxJQUNQLFlBQWE7QUFBQSxJQUNiLE1BQU87QUFBQSxJQUNQLE1BQU87QUFBQSxJQUNQLFFBQVM7QUFBQSxJQUNULE9BQVE7QUFBQSxJQUNSLFdBQVk7QUFBQSxJQUNaLFdBQVk7QUFBQSxJQUNaLE1BQU87QUFBQSxJQUNQLGFBQWM7QUFBQSxJQUNkLGFBQWM7QUFBQSxJQUNkLGFBQWM7QUFBQSxJQUNkLFVBQVc7QUFBQSxJQUNYLFdBQVk7QUFBQSxJQUNaLFFBQVM7QUFBQSxJQUNULGNBQWU7QUFBQSxJQUNmLGNBQWU7QUFBQSxJQUNmLFdBQVk7QUFBQSxJQUNaLFVBQVc7QUFBQSxJQUNYLGFBQWM7QUFBQSxJQUNkLGVBQWdCO0FBQUEsSUFDaEIsT0FBUTtBQUFBLElBQ1IsTUFBTztBQUFBLElBQ1AsWUFBYztBQUFBLElBQ2Qsc0JBQXdCO0FBQUEsSUFDeEIsUUFBVTtBQUFBLElBQ1YsWUFBYztBQUFBLElBQ2QsZUFBaUI7QUFBQSxJQUNqQixhQUFjO0FBQUEsSUFDZCxPQUFTO0FBQUEsSUFDVCxXQUFZO0FBQUEsSUFDWixZQUFhO0FBQUEsSUFDYixnQkFBaUI7QUFBQSxJQUNqQixpQkFBa0I7QUFBQSxJQUNsQixRQUFTO0FBQUEsSUFDVCxXQUFZO0FBQUEsSUFDWixnQkFBaUI7QUFBQSxJQUNqQixNQUFPO0FBQUEsSUFDUCxRQUFTO0FBQUEsSUFDVCxTQUFVO0FBQUEsSUFDVixPQUFRO0FBQUEsRUFDWjtBQUFBLEVBQ0EsTUFBUTtBQUFBLElBQ0osTUFBTztBQUFBLElBQ1AsVUFBWTtBQUFBLElBQ1osV0FBYTtBQUFBLElBQ2IsT0FBUztBQUFBLEVBQ2I7QUFBQSxFQUNBLFNBQVU7QUFBQSxJQUNOLE9BQVM7QUFBQSxJQUNULE9BQVM7QUFBQSxJQUNULGVBQWlCO0FBQUEsRUFDckI7QUFBQSxFQUNBLFNBQVc7QUFBQSxJQUNQLGVBQWlCO0FBQUEsRUFDckI7QUFBQSxFQUNBLEtBQU87QUFBQSxJQUNILGNBQWdCO0FBQUEsSUFDaEIsZUFBaUI7QUFBQSxJQUNqQixnQkFBa0I7QUFBQSxJQUNsQixpQkFBbUI7QUFBQSxJQUNuQixZQUFjO0FBQUEsSUFDZCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsRUFDYjtBQUNKOzs7QUM3TEE7QUFBQSxFQUNJLE1BQVE7QUFBQSxJQUNKLE1BQVE7QUFBQSxNQUNKLFNBQVc7QUFBQSxNQUNYLFlBQWM7QUFBQSxNQUNkLE1BQVE7QUFBQSxJQUNaO0FBQUEsRUFDSjtBQUFBLEVBQ0EsU0FBWTtBQUFBLElBQ1IsVUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsVUFBWTtBQUFBLElBQ1osS0FBTztBQUFBLElBQ1AsSUFBSztBQUFBLElBQ0wsVUFBVztBQUFBLElBQ1gsVUFBWTtBQUFBLElBQ1osUUFBVTtBQUFBLElBQ1YsTUFBUTtBQUFBLElBQ1IsVUFBWTtBQUFBLElBQ1osYUFBZTtBQUFBLElBQ2YsWUFBYztBQUFBLElBQ2QsV0FBYTtBQUFBLElBQ2IsY0FBZ0I7QUFBQSxJQUNoQixnQkFBa0I7QUFBQSxJQUNsQixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsSUFDUixRQUFVO0FBQUEsSUFDVixNQUFRO0FBQUEsSUFDUixTQUFXO0FBQUEsSUFDWCxPQUFTO0FBQUEsSUFDVCxhQUFlO0FBQUEsSUFDZixTQUFVO0FBQUEsSUFDVixPQUFTO0FBQUEsSUFDVCxnQkFBaUI7QUFBQSxJQUNqQixlQUFnQjtBQUFBLElBQ2hCLGNBQWU7QUFBQSxJQUNmLFNBQVU7QUFBQSxJQUNWLFdBQVk7QUFBQSxJQUNaLElBQU07QUFBQSxJQUNOLElBQUs7QUFBQSxJQUNMLElBQUs7QUFBQSxJQUNMLElBQUs7QUFBQSxJQUNMLElBQUs7QUFBQSxJQUNMLElBQUs7QUFBQSxJQUNMLE1BQVE7QUFBQSxJQUNSLFlBQWM7QUFBQSxJQUNkLFVBQVk7QUFBQSxJQUNaLFNBQVU7QUFBQSxJQUNWLGtCQUFvQjtBQUFBLElBQ3BCLE1BQVE7QUFBQSxJQUNSLE1BQVE7QUFBQSxJQUNSLGdCQUFrQjtBQUFBLElBQ2xCLFVBQVk7QUFBQSxJQUNaLGNBQWdCO0FBQUEsRUFDcEI7QUFBQSxFQUNBLFNBQVc7QUFBQSxJQUNQLGVBQWlCO0FBQUEsSUFDakIsWUFBYztBQUFBLElBQ2QsYUFBZTtBQUFBLElBQ2YsbUJBQXFCO0FBQUEsSUFDckIsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsUUFBVTtBQUFBLElBQ1YsbUJBQXFCO0FBQUEsRUFFekI7QUFBQSxFQUNBLE1BQVE7QUFBQSxJQUNKLGVBQWlCO0FBQUEsSUFDakIsY0FBZ0I7QUFBQSxJQUNoQixZQUFjO0FBQUEsSUFDZCxTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLFVBQVk7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsUUFBVTtBQUFBLElBQ04sYUFBZTtBQUFBLElBQ2YsY0FBZ0I7QUFBQSxJQUNoQixlQUFpQjtBQUFBLElBQ2pCLGFBQWU7QUFBQSxJQUNmLFdBQWE7QUFBQSxJQUNiLFFBQVU7QUFBQSxJQUNWLFlBQWM7QUFBQSxJQUVkLFdBQWE7QUFBQSxJQUNiLFdBQWE7QUFBQSxJQUNiLGFBQWU7QUFBQSxJQUNmLGlCQUFtQjtBQUFBLElBQ25CLGlCQUFtQjtBQUFBLElBQ25CLFFBQVM7QUFBQSxJQUNULFNBQVU7QUFBQSxJQUNWLGdCQUFrQjtBQUFBLElBQ2xCLGNBQWdCO0FBQUEsSUFDaEIsYUFBZTtBQUFBLElBQ2YsT0FBUztBQUFBLElBQ1QsU0FBVztBQUFBLElBQ1gsT0FBUztBQUFBLElBQ1QsT0FBUztBQUFBLElBQ1QsV0FBYTtBQUFBLElBQ2IsUUFBVTtBQUFBLElBQ1YsTUFBUTtBQUFBLElBQ1IsV0FBYTtBQUFBLElBQ2IsTUFBUTtBQUFBLElBQ1IsT0FBUztBQUFBLElBQ1QsV0FBYTtBQUFBLElBQ2IsU0FBVztBQUFBLElBQ1gsUUFBVTtBQUFBLElBQ1YsTUFBTztBQUFBLElBQ1AsTUFBTztBQUFBLElBQ1AsT0FBUTtBQUFBLElBQ1IsTUFBTztBQUFBLElBQ1AsUUFBUztBQUFBLElBQ1QsV0FBWTtBQUFBLElBQ1osVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osYUFBYztBQUFBLElBQ2QsWUFBYTtBQUFBLElBQ2IsTUFBTztBQUFBLElBQ1AsV0FBWTtBQUFBLElBQ1osTUFBTztBQUFBLElBQ1AsWUFBYTtBQUFBLElBQ2IsTUFBTztBQUFBLElBQ1AsTUFBTztBQUFBLElBQ1AsUUFBUztBQUFBLElBQ1QsT0FBUTtBQUFBLElBQ1IsV0FBWTtBQUFBLElBQ1osV0FBWTtBQUFBLElBQ1osTUFBTztBQUFBLElBQ1AsYUFBYztBQUFBLElBQ2QsYUFBYztBQUFBLElBQ2QsYUFBYztBQUFBLElBQ2QsVUFBVztBQUFBLElBQ1gsV0FBWTtBQUFBLElBQ1osUUFBUztBQUFBLElBQ1QsY0FBZTtBQUFBLElBQ2YsY0FBZTtBQUFBLElBQ2YsV0FBWTtBQUFBLElBQ1osVUFBVztBQUFBLElBQ1gsYUFBYztBQUFBLElBQ2QsZUFBZ0I7QUFBQSxJQUNoQixPQUFRO0FBQUEsSUFDUixNQUFPO0FBQUEsSUFDUCxZQUFjO0FBQUEsSUFDZCxzQkFBd0I7QUFBQSxJQUN4QixRQUFVO0FBQUEsSUFDVixZQUFjO0FBQUEsSUFDZCxlQUFpQjtBQUFBLElBQ2pCLGFBQWM7QUFBQSxJQUNkLE9BQVM7QUFBQSxJQUNULFdBQVk7QUFBQSxJQUNaLFlBQWE7QUFBQSxJQUNiLGdCQUFpQjtBQUFBLElBQ2pCLGlCQUFrQjtBQUFBLElBQ2xCLFFBQVM7QUFBQSxJQUNULFdBQVk7QUFBQSxJQUNaLGdCQUFpQjtBQUFBLElBQ2pCLE1BQU87QUFBQSxJQUNQLFFBQVM7QUFBQSxJQUNULFNBQVU7QUFBQSxJQUNWLE9BQVE7QUFBQSxFQUNaO0FBQUEsRUFDQSxNQUFRO0FBQUEsSUFDSixNQUFPO0FBQUEsSUFDUCxVQUFZO0FBQUEsSUFDWixXQUFhO0FBQUEsSUFDYixPQUFTO0FBQUEsRUFDYjtBQUFBLEVBQ0EsU0FBVTtBQUFBLElBQ04sT0FBUztBQUFBLElBQ1QsT0FBUztBQUFBLElBQ1QsZUFBaUI7QUFBQSxFQUNyQjtBQUFBLEVBQ0EsU0FBVztBQUFBLElBQ1AsZUFBaUI7QUFBQSxFQUNyQjtBQUFBLEVBQ0EsS0FBTztBQUFBLElBQ0gsY0FBZ0I7QUFBQSxJQUNoQixlQUFpQjtBQUFBLElBQ2pCLGdCQUFrQjtBQUFBLElBQ2xCLGlCQUFtQjtBQUFBLElBQ25CLFlBQWM7QUFBQSxJQUNkLE1BQVE7QUFBQSxJQUNSLE9BQVM7QUFBQSxFQUNiO0FBQ0o7OztBRnpMQSxJQUFNLE9BQU8sV0FBVztBQUFBLEVBQ3BCLFFBQVE7QUFBQSxFQUNSLGdCQUFnQjtBQUFBLEVBQ2hCLFVBQVU7QUFBQSxJQUNOO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDSixDQUFDO0FBRUgsSUFBTyxrQkFBUTs7O0FEVWYsU0FBTyxTQUFTLGFBQUFDLFlBQVUsT0FBQUMsTUFBSyxtQkFBa0I7QUFDakQsU0FBUyxvQkFBb0I7QUFDN0IsT0FBT0MsU0FBUTtBQUNmLE9BQU9DLFdBQVM7QUFFaEIsT0FBTyxhQUFhOzs7QUk3QnBCLE9BQU9DLFdBQVU7QUFDakIsT0FBT0MsVUFBUzs7O0FDaUJoQixPQUFPQyxTQUFRO0FBQ2YsT0FBT0MsV0FBVTtBQUNqQixPQUFPQyxjQUFhO0FBQ3BCLFNBQVMsU0FBQUMsY0FBYTtBQUN0QixTQUFTLE9BQUFDLFlBQVc7QUFDcEIsT0FBT0MsVUFBUztBQUdoQixJQUFNQyxhQUFZLFlBQVk7QUFHOUIsSUFBTSxhQUFOLE1BQWlCO0FBQUEsRUFDYixjQUFlO0FBQUEsRUFBRTtBQUFBLEVBRWpCLE9BQU07QUFDRixTQUFLLE1BQU07QUFBQSxFQUNmO0FBQUEsRUFHQSxRQUFPO0FBQ0gsUUFBSSxXQUFXLEtBQUssT0FBTztBQUMzQixVQUFNLE9BQU9DLE9BQU0sVUFBVSxDQUFDLFVBQVUsQ0FBQztBQUV6QyxTQUFLLE9BQU8sR0FBRyxRQUFRLFVBQVE7QUFDM0IsWUFBTSxRQUFRLEtBQUssU0FBUyxFQUFFLE1BQU0sSUFBSTtBQUN4QyxNQUFBQyxLQUFJLE1BQU0sd0JBQXdCLE1BQU0sQ0FBQyxDQUFDLEVBQUU7QUFBQSxJQUNoRCxDQUFDO0FBQUEsRUFDTDtBQUFBLEVBQ0EsS0FBSyxRQUFRO0FBQ1QsSUFBQUEsS0FBSSxNQUFNLE1BQU07QUFDaEIsSUFBQUMsU0FBUSxLQUFLLENBQUM7QUFBQSxFQUNsQjtBQUFBLEVBRUEsZUFBZSxTQUFTO0FBQ3BCLFFBQUksT0FBT0MsSUFBRyxZQUFZLE9BQU8sRUFBRTtBQUFBLE1BQy9CLFVBQVFBLElBQUcsU0FBU0MsTUFBSyxLQUFLLFNBQVMsSUFBSSxDQUFDLEVBQUUsWUFBWTtBQUFBLElBQzlEO0FBQ0EsV0FBTztBQUFBLEVBQ1g7QUFBQSxFQUVBLFNBQVE7QUFDSixRQUFJLElBQUksMkJBQW1CLFFBQVEsTUFBTTtBQUN6QyxNQUFFLFFBQVEsMkJBQW1CLE1BQU07QUFDbkMsV0FBT0EsTUFBSyxLQUFLLE1BQU1BLE9BQU0sQ0FBQztBQUFBLEVBQ2xDO0FBQUEsRUFFQSxRQUFRLFdBQVcsV0FBVyxNQUFNO0FBQ2hDLFlBQVEsUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUMxQixnQkFBWSxhQUFhLENBQUM7QUFDMUIsU0FBSyxRQUFRLFNBQVM7QUFDdEIsU0FBSyxRQUFRLFVBQVUsS0FBSyxLQUFLLGNBQWMsVUFBVSxNQUFNLEdBQUcsQ0FBQztBQUNuRSxTQUFLLFFBQVEsS0FBSztBQUNsQixXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsT0FBTyxXQUFXLFdBQVcsTUFBTTtBQUUvQixRQUFJLFdBQVcsS0FBSyxPQUFPO0FBQzNCLFFBQUksV0FBVyxLQUFLLFFBQVEsV0FBVyxXQUFXLElBQUk7QUFDdEQsUUFBSSxjQUFlLEdBQUcsUUFBUSxJQUFJLFNBQVMsS0FBSyxHQUFHLENBQUM7QUFFcEQsSUFBQUgsS0FBSSxLQUFLLDBCQUEwQiwyQkFBbUIsR0FBRyxZQUFZO0FBQ3JFLElBQUFBLEtBQUksS0FBSyxnREFBZ0QsV0FBVyxFQUFFO0FBQ3RFLFdBQU9ELE9BQU0sVUFBVSxVQUFVLEVBQUMsT0FBTSxNQUFLLENBQUM7QUFBQSxFQUVsRDtBQUNKO0FBR0EsSUFBTyxzQkFBUSxJQUFJLFdBQVc7OztBRG5GOUIsU0FBUyxZQUFZO0FBQ3JCLE9BQU9LLFNBQVE7QUFFZixJQUFNQyxhQUFZLFlBQVk7QUFDOUIsSUFBTSxhQUFhLE1BQU0sMkJBQW1CO0FBRTVDLElBQUksc0JBQXNCQyxNQUFLLEtBQUssV0FBVyxHQUFHLHNDQUFzQztBQUN4RixJQUFJLHlCQUF5QkEsTUFBSyxLQUFLLFdBQVcsR0FBRyxnQ0FBZ0M7QUFNckYsSUFBTSxxQkFBTixNQUF5QjtBQUFBLEVBQ3BCLGNBQWM7QUFDVixTQUFLLHNCQUFzQjtBQUMzQixTQUFLLE9BQU87QUFBQSxFQUNoQjtBQUFBLEVBRUEsY0FBYztBQUNWLFFBQUksS0FBSyx1QkFBdUIsQ0FBQyxLQUFLLG9CQUFvQixRQUFRO0FBQzlELE1BQUFDLEtBQUksS0FBSyxrRUFBa0U7QUFDM0U7QUFBQSxJQUNKO0FBQ0EsUUFBSTtBQUNELFdBQUssc0JBQXNCLG9CQUFXO0FBQUEsUUFDbEMsQ0FBQyxtQkFBbUI7QUFBQTtBQUFBLFFBQ3BCO0FBQUE7QUFBQSxRQUNBLENBQUMsVUFBVSxLQUFLLE1BQUssWUFBVyx3QkFBd0Isa0JBQWtCLEtBQU07QUFBQTtBQUFBLE1BQ3BGO0FBRUEsTUFBQUEsS0FBSSxLQUFLLHFFQUFxRTtBQUU5RSxXQUFLLG9CQUFvQixPQUFPLEdBQUcsUUFBUSxVQUFRO0FBSS9DLGNBQU0sU0FBUyxLQUFLLFNBQVM7QUFDN0IsWUFBSSxPQUFPLFlBQVksRUFBRSxTQUFTLE9BQU8sR0FBRztBQUN4QyxVQUFBQSxLQUFJLEtBQUssd0NBQXdDLE1BQU07QUFBQSxRQUMzRDtBQUNBLFlBQUksT0FBTyxZQUFZLEVBQUUsU0FBUyxVQUFVLEdBQUc7QUFDM0MsVUFBQUEsS0FBSSxLQUFLLHVDQUF1QyxNQUFNO0FBQUEsUUFDMUQ7QUFDQSxZQUFJLE9BQU8sWUFBWSxFQUFFLFNBQVMsWUFBWSxHQUFHO0FBQzdDLFVBQUFBLEtBQUksS0FBSyx1Q0FBdUMsTUFBTTtBQUFBLFFBQzFEO0FBQ0EsWUFBSSxPQUFPLFlBQVksRUFBRSxTQUFTLGlCQUFpQixHQUFHO0FBQ2xELFVBQUFBLEtBQUksS0FBSyx1Q0FBdUMsTUFBTTtBQUFBLFFBQzFEO0FBQUEsTUFDSixDQUFDO0FBR0QsVUFBSSxlQUFlO0FBQ25CLFdBQUssb0JBQW9CLE9BQU8sR0FBRyxRQUFRLFVBQVE7QUFDL0MsY0FBTSxRQUFRLEtBQUssU0FBUztBQUM1Qix3QkFBZ0I7QUFDaEIsY0FBTSxVQUFVLE9BQU8sS0FBSyxJQUFJO0FBRWhDLGNBQU0sZUFBZTtBQUNyQixjQUFNLGNBQWMsYUFBYSxTQUFTLE9BQU8sS0FDOUIsYUFBYSxTQUFTLGdDQUFnQyxLQUN0RCxhQUFhLFNBQVMsOENBQThDLEtBQ3BFLGFBQWEsU0FBUyx3QkFBd0I7QUFFakUsWUFBSSxhQUFhO0FBQ2IsVUFBQUEsS0FBSSxLQUFLLDZGQUE2RixLQUFLLElBQUk7QUFDL0cseUJBQWU7QUFBQSxRQUNuQixXQUFXLE1BQU0sU0FBUyxJQUFJLEtBQUssYUFBYSxTQUFTLEtBQUs7QUFFMUQsVUFBQUEsS0FBSSxNQUFNLHVDQUF1QyxhQUFhLEtBQUssQ0FBQztBQUNwRSx5QkFBZTtBQUFBLFFBQ25CO0FBQUEsTUFDSixDQUFDO0FBRUQsV0FBSyxvQkFBb0IsR0FBRyxRQUFRLFVBQVE7QUFDeEMsUUFBQUEsS0FBSSxLQUFLLGlFQUFpRSxJQUFJLEVBQUU7QUFDaEYsYUFBSyxzQkFBc0I7QUFBQSxNQUMvQixDQUFDO0FBQUEsSUFDTCxTQUNNLEtBQUk7QUFDTixNQUFBQSxLQUFJLE1BQU0sMENBQTBDLEdBQUc7QUFBQSxJQUMzRDtBQUFBLEVBR0g7QUFBQSxFQUVBLGFBQWE7QUFFVCxRQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDM0IsTUFBQUEsS0FBSSxLQUFLLGdGQUFnRjtBQUN6RjtBQUFBLElBQ0o7QUFHQSxRQUFJLENBQUMsS0FBSyxvQkFBb0IsUUFBUTtBQUNsQyxVQUFJO0FBQ0EsYUFBSyxvQkFBb0IsS0FBSztBQUM5QixRQUFBQSxLQUFJLEtBQUssNERBQTREO0FBQ3JFLGFBQUssc0JBQXNCO0FBQzNCO0FBQUEsTUFDSixTQUFTLEtBQUs7QUFDVixRQUFBQSxLQUFJLEtBQUssNkZBQTZGLEdBQUc7QUFBQSxNQUM3RztBQUFBLElBQ0o7QUFHQSxVQUFNLFdBQVdILElBQUcsU0FBUztBQUM3QixRQUFJO0FBRUosUUFBSSxhQUFhLFNBQVM7QUFHdEIsZ0JBQVU7QUFBQSxJQUNkLFdBQVcsYUFBYSxZQUFZLGFBQWEsU0FBUztBQUV0RCxnQkFBVTtBQUFBLElBQ2QsT0FBTztBQUNILE1BQUFHLEtBQUksS0FBSyxpREFBaUQsUUFBUTtBQUNsRTtBQUFBLElBQ0o7QUFFQSxTQUFLLFNBQVMsQ0FBQyxPQUFPLFFBQVEsV0FBVztBQUNyQyxVQUFJLE9BQU87QUFHUCxZQUFJLE1BQU0sU0FBUyxLQUFLLENBQUMsTUFBTSxRQUFRLFNBQVMsV0FBVyxLQUFLLENBQUMsT0FBTyxTQUFTLEVBQUUsU0FBUyxpQkFBaUIsR0FBRztBQUM1RyxVQUFBQSxLQUFJLEtBQUssOERBQThELE1BQU0sT0FBTztBQUFBLFFBQ3hGLE9BQU87QUFDSCxVQUFBQSxLQUFJLEtBQUssd0ZBQXdGO0FBQUEsUUFDckc7QUFBQSxNQUNKLE9BQU87QUFDSCxRQUFBQSxLQUFJLEtBQUssa0VBQWtFO0FBQUEsTUFDL0U7QUFDQSxXQUFLLHNCQUFzQjtBQUFBLElBQy9CLENBQUM7QUFBQSxFQUNMO0FBQ0o7QUFRRCxJQUFPLG9CQUFRLElBQUksbUJBQW1COzs7QUVwSnRDLFNBQVMsT0FBQUMsTUFBSyxNQUFNLFlBQVk7QUFDaEMsT0FBT0MsV0FBVTtBQUNqQixPQUFPQyxXQUFTO0FBTWhCLElBQU1DLGFBQVksWUFBWTtBQUU5QixJQUFJLE9BQU87QUFHWCxTQUFTLGtCQUFrQjtBQUN6QixRQUFNQyxjQUFhLDJCQUFtQjtBQUN0QyxTQUFPQyxNQUFLLEtBQUtELGFBQVksU0FBUyxlQUFlO0FBQ3ZEO0FBR0EsSUFBTSxZQUFZLENBQUMsUUFBUTtBQUN2QixRQUFNLEtBQUssZ0JBQUs7QUFDaEIsTUFBSSxNQUFNLE9BQU8sR0FBRyxXQUFXLFlBQVksR0FBRyxRQUFRO0FBRXBELFFBQUksV0FBVyxHQUFHLE9BQVEsSUFBRyxPQUFPLFFBQVE7QUFBQSxRQUN2QyxJQUFHLFNBQVM7QUFBQSxFQUNuQixPQUFPO0FBRUwsT0FBRyxTQUFTO0FBQUEsRUFDZDtBQUNGO0FBV0ssSUFBTSxtQkFBbUIsQ0FBQyxXQUFXO0FBQ3hDLFlBQVUsTUFBTTtBQUNoQixRQUFNRSxLQUFJLENBQUMsTUFBTSxnQkFBSyxPQUFPLEVBQUUsQ0FBQztBQUVoQyxNQUFJLENBQUMsTUFBTTtBQUNULFdBQU8sSUFBSSxLQUFLLGdCQUFnQixDQUFDO0FBQ2pDLFNBQUssR0FBRyxTQUFTLE1BQU07QUFDckIsNEJBQWMsV0FBVyxVQUFVLElBQy9CLHNCQUFjLFdBQVcsS0FBSyxJQUM5QixzQkFBYyxXQUFXLEtBQUs7QUFBQSxJQUNwQyxDQUFDO0FBQUEsRUFDSDtBQUdBLFFBQU0sY0FBYyxLQUFLLGtCQUFrQjtBQUFBLElBQ3pDLEVBQUUsT0FBT0EsR0FBRSxtQkFBbUIsR0FBRyxPQUFPLE1BQU0sc0JBQWMsV0FBVyxLQUFLLEVBQUU7QUFBQTtBQUFBLElBQzlFO0FBQUEsTUFBRSxPQUFPQSxHQUFFLHNCQUFzQjtBQUFBLE1BQUcsT0FBTyxNQUFNO0FBQzdDLFFBQUFDLE1BQUksS0FBSywwQ0FBMEM7QUFDbkQscUNBQVksZ0JBQWdCO0FBQUEsTUFDOUI7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUNBO0FBQUEsTUFBRSxPQUFPRCxHQUFFLGdCQUFnQjtBQUFBLE1BQUcsT0FBTyxNQUFNO0FBQ3ZDLFFBQUFDLE1BQUksS0FBSyxzQ0FBc0M7QUFDL0MsUUFBQUEsTUFBSSxLQUFLLDZEQUE2RDtBQUN0RSw4QkFBYyxXQUFXLFlBQVk7QUFDckMsUUFBQUMsS0FBSSxLQUFLO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQTtBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssV0FBVyxtQkFBbUI7QUFDbkMsT0FBSyxlQUFlLFdBQVc7QUFDakM7OztBQzFDRixTQUFTLFFBQUFDLGFBQVk7QUFDckIsU0FBUyxVQUFBQyxTQUFRLE9BQUFDLFlBQVc7QUFDNUIsT0FBT0MsV0FBUztBQUtoQixlQUFzQixzQkFBc0IsVUFBVSxlQUFlO0FBQ2pFLE1BQUk7QUFDSSxVQUFNLE1BQU0sTUFBTSxNQUFNLFdBQVcsUUFBUSxJQUFJLGFBQWEsd0JBQXdCLEVBQUUsUUFBUSxPQUFPLE9BQU8sV0FBVyxDQUFDO0FBQ3hILFdBQU8sSUFBSTtBQUFBLEVBQ25CLFFBQVE7QUFBRyxXQUFPO0FBQUEsRUFBTTtBQUM1QjtBQUVBLGVBQXNCLFdBQVc7QUFDN0IsU0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFFcEMsSUFBQUgsTUFBSywwQ0FBMEMsQ0FBQyxLQUFLLFFBQVEsV0FBVztBQUNwRSxVQUFJLElBQUssUUFBTyxPQUFPLEVBQUUsS0FBSyxRQUFRLE9BQU8sQ0FBQztBQUM5QyxjQUFRLEVBQUUsUUFBUSxPQUFPLENBQUM7QUFBQSxJQUM5QixDQUFDO0FBRUQsSUFBQUEsTUFBSyw4Q0FBOEMsQ0FBQyxLQUFLLFFBQVEsV0FBVztBQUN4RSxVQUFJLElBQUssUUFBTyxPQUFPLEVBQUUsS0FBSyxRQUFRLE9BQU8sQ0FBQztBQUM5QyxjQUFRLEVBQUUsUUFBUSxPQUFPLENBQUM7QUFBQSxJQUM5QixDQUFDO0FBQUEsRUFHTCxDQUFDO0FBQ0w7QUFFQSxlQUFzQixxQkFBcUIsVUFBVSxlQUFlO0FBQ2hFLFFBQU0sS0FBSyxNQUFNLHNCQUFzQixVQUFVLGFBQWE7QUFDOUQsTUFBSSxJQUFJO0FBQ0EsSUFBQUcsTUFBSSxLQUFLLHNFQUFzRTtBQUMvRSxXQUFPO0FBQUEsRUFDZjtBQUNBLEVBQUFBLE1BQUksS0FBSyxzRUFBdUU7QUFFaEYsTUFBSTtBQUdBLFFBQUksU0FBUyxNQUFNRixRQUFPLGVBQWU7QUFBQSxNQUNyQyxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxTQUFTLENBQUMsTUFBTSxXQUFXO0FBQUEsSUFDL0IsQ0FBQztBQUNELFFBQUksT0FBTyxhQUFhLEdBQUc7QUFDdkIsTUFBQUUsTUFBSSxLQUFLLDJGQUEyRjtBQUNwRyxZQUFNLFNBQVM7QUFDZixhQUFPO0FBQUEsSUFDWCxPQUNLO0FBQ0QsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUVKLFNBQ08sR0FBRztBQUNOLElBQUFBLE1BQUksTUFBTSxtRkFBbUYsQ0FBQyxFQUFFO0FBQ2hHLFVBQU1GLFFBQU8sZUFBZTtBQUFBLE1BQ3hCLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULFFBQVEsT0FBTyxFQUFFLE9BQU8sQ0FBQztBQUFBLElBQzdCLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDWDtBQUNKOzs7QUNqR0EsU0FBUyxRQUFBRyxhQUFZO0FBQ3JCLFNBQVMsaUJBQWlCO0FBQzFCLE9BQU9DLFNBQVE7QUFDZixPQUFPQyxXQUFTO0FBRWhCLElBQU0sWUFBWSxVQUFVRixLQUFJO0FBR2hDLElBQUksaUJBQWlCO0FBQ3JCLElBQU0sZUFBZTtBQUdyQixTQUFTLG9CQUFvQixLQUFLO0FBQzlCLE1BQUksUUFBUSxRQUFRLE9BQU8sTUFBTSxHQUFHLEVBQUcsUUFBTztBQUM5QyxRQUFNLFNBQVM7QUFDZixRQUFNLFNBQVM7QUFDZixRQUFNLFVBQVUsS0FBSyxJQUFJLFFBQVEsS0FBSyxJQUFJLFFBQVEsR0FBRyxDQUFDO0FBQ3RELFFBQU0sV0FBWSxVQUFVLFdBQVcsU0FBUyxVQUFXO0FBQzNELFNBQU8sS0FBSyxNQUFNLE9BQU87QUFDN0I7QUFPQSxlQUFzQixjQUFjO0FBRWhDLE1BQUksa0JBQWtCLGNBQWM7QUFDaEMsV0FBTyxFQUFFLE1BQU0sTUFBTSxPQUFPLE1BQU0sU0FBUyxNQUFNLFNBQVMsV0FBVztBQUFBLEVBQ3pFO0FBRUEsTUFBSTtBQUNBLFVBQU0sV0FBV0MsSUFBRyxTQUFTO0FBQzdCLFFBQUk7QUFFSixZQUFRLFVBQVU7QUFBQSxNQUNkLEtBQUs7QUFDRCxpQkFBUyxNQUFNLGlCQUFpQjtBQUNoQztBQUFBLE1BQ0osS0FBSztBQUNELGlCQUFTLE1BQU0sbUJBQW1CO0FBQ2xDO0FBQUEsTUFDSixLQUFLO0FBQ0QsaUJBQVMsTUFBTSxpQkFBaUI7QUFDaEM7QUFBQSxNQUNKO0FBQ0k7QUFDQSxlQUFPLEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUyxXQUFXO0FBQUEsSUFDN0U7QUFHQSxRQUFJLENBQUMsVUFBVSxPQUFPLFdBQVcsVUFBVTtBQUN2QztBQUNBLGFBQU8sRUFBRSxNQUFNLE1BQU0sT0FBTyxNQUFNLFNBQVMsTUFBTSxTQUFTLFFBQVE7QUFBQSxJQUN0RTtBQUdBLFFBQUksT0FBTyxRQUFRLE9BQU8sU0FBUyxPQUFPLFlBQVksTUFBTTtBQUN4RCx1QkFBaUI7QUFBQSxJQUNyQixPQUFPO0FBRUg7QUFBQSxJQUNKO0FBRUEsV0FBTztBQUFBLEVBQ1gsU0FBUyxPQUFPO0FBRVo7QUFDQSxXQUFPLEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUyxRQUFRO0FBQUEsRUFDdEU7QUFDSjtBQUtBLGVBQWUsbUJBQW1CO0FBQzlCLE1BQUk7QUFHQSxRQUFJO0FBQ0EsVUFBSSxTQUFTO0FBQ2IsVUFBSTtBQUNBLGNBQU0sU0FBUyxNQUFNLFVBQVUseURBQXlEO0FBQUEsVUFDcEYsU0FBUztBQUFBLFVBQ1QsV0FBVyxPQUFPO0FBQUEsUUFDdEIsQ0FBQztBQUNELGlCQUFTLE9BQU87QUFBQSxNQUVwQixTQUFTLFdBQVc7QUFHaEIsWUFBSSxVQUFVLFVBQVUsVUFBVSxPQUFPLEtBQUssRUFBRSxTQUFTLEdBQUc7QUFDeEQsbUJBQVMsVUFBVTtBQUFBLFFBQ3ZCLE9BQU87QUFDSCxnQkFBTTtBQUFBLFFBQ1Y7QUFBQSxNQUNKO0FBRUEsVUFBSSxDQUFDLFVBQVUsT0FBTyxLQUFLLEVBQUUsV0FBVyxHQUFHO0FBQ3ZDLGNBQU0sSUFBSSxNQUFNLHNCQUFzQjtBQUFBLE1BQzFDO0FBQ0EsWUFBTSxRQUFRLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSTtBQUd0QyxpQkFBVyxRQUFRLE9BQU87QUFDdEIsY0FBTSxRQUFRLEtBQUssTUFBTSxHQUFHO0FBQzVCLGFBQUssTUFBTSxDQUFDLE1BQU0sU0FBUyxNQUFNLENBQUMsTUFBTSxTQUFTLE1BQU0sVUFBVSxHQUFHO0FBQ2hFLGdCQUFNLE9BQU8sTUFBTSxDQUFDLEtBQUs7QUFJekIsZ0JBQU0sYUFBYSxLQUFLLE1BQU0sbUNBQW1DO0FBQ2pFLGNBQUksUUFBUTtBQUNaLGNBQUksWUFBWTtBQUVaLG9CQUFRLFdBQVcsQ0FBQyxFQUFFLFFBQVEsUUFBUSxHQUFHLEVBQUUsWUFBWTtBQUFBLFVBQzNELE9BQU87QUFFSCxrQkFBTSxjQUFjLEtBQUssTUFBTSxpQ0FBaUM7QUFDaEUsZ0JBQUksYUFBYTtBQUNiLHNCQUFRLFlBQVksQ0FBQyxFQUFFLFlBQVk7QUFBQSxZQUN2QyxPQUFPO0FBQ0gsc0JBQVEsTUFBTSxDQUFDLEtBQUs7QUFBQSxZQUN4QjtBQUFBLFVBQ0o7QUFFQSxnQkFBTSxZQUFZLE1BQU0sTUFBTSxTQUFTLENBQUMsSUFBSSxNQUFNLE1BQU0sU0FBUyxDQUFDLEVBQUUsS0FBSyxJQUFJO0FBQzdFLGdCQUFNLFNBQVMsWUFBYSxTQUFTLFdBQVcsRUFBRSxLQUFLLE9BQVE7QUFFL0QsaUJBQU87QUFBQSxZQUNILE1BQU0sUUFBUTtBQUFBLFlBQ2QsT0FBTyxTQUFTO0FBQUEsWUFDaEIsU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLFVBQ2I7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0osU0FBUyxZQUFZO0FBRWpCLFlBQU0sY0FBYyxXQUFXLFNBQVMsWUFBWSxXQUFXLFNBQVMsZUFDbkQsV0FBVyxXQUFXLENBQUMsV0FBVyxRQUFRLFNBQVMsV0FBVztBQUNuRixVQUFJLGFBQWE7QUFDYixRQUFBQyxNQUFJLE1BQU0sMkNBQTJDLFdBQVcsV0FBVyxVQUFVO0FBQUEsTUFDekY7QUFHQSxVQUFJO0FBQ0EsY0FBTSxFQUFFLFFBQVEsU0FBUyxJQUFJLE1BQU0sVUFBVSxzQ0FBd0M7QUFBQSxVQUNqRixTQUFTO0FBQUEsVUFDVCxXQUFXLE9BQU87QUFBQSxRQUN0QixDQUFDO0FBQ0QsY0FBTSxFQUFFLFFBQVEsYUFBYSxJQUFJLE1BQU0sVUFBVSxnQ0FBaUM7QUFBQSxVQUM5RSxTQUFTO0FBQUEsVUFDVCxXQUFXLE9BQU87QUFBQSxRQUN0QixDQUFDO0FBR0QsY0FBTSxZQUFZLFdBQVcsU0FBUyxNQUFNLGFBQWEsSUFBSTtBQUM3RCxjQUFNLE9BQU8sWUFBWSxVQUFVLENBQUMsRUFBRSxLQUFLLElBQUk7QUFHL0MsY0FBTSxhQUFhLGVBQWUsYUFBYSxNQUFNLDBCQUEwQixJQUFJO0FBQ25GLGNBQU0sUUFBUSxhQUFhLFdBQVcsQ0FBQyxFQUFFLFlBQVksSUFBSTtBQUV6RCxjQUFNLGNBQWMsZUFBZSxhQUFhLE1BQU0sbUJBQW1CLElBQUk7QUFDN0UsY0FBTSxZQUFZLGNBQWUsU0FBUyxZQUFZLENBQUMsR0FBRyxFQUFFLEtBQUssT0FBUTtBQUN6RSxjQUFNLFVBQVUsY0FBYyxPQUFPLG9CQUFvQixTQUFTLElBQUk7QUFFdEUsZUFBTztBQUFBLFVBQ0g7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsU0FBUztBQUFBLFFBQ2I7QUFBQSxNQUNKLFNBQVMsU0FBUztBQUVkLGNBQU1DLGVBQWMsUUFBUSxTQUFTLFlBQVksUUFBUSxTQUFTO0FBQ2xFLFlBQUlBLGNBQWE7QUFDYixVQUFBRCxNQUFJLE1BQU0sd0NBQXdDLFFBQVEsV0FBVyxPQUFPO0FBQUEsUUFDaEY7QUFHQSxZQUFJO0FBQ0EsZ0JBQU0sRUFBRSxPQUFPLElBQUksTUFBTSxVQUFVLG9FQUFvRTtBQUFBLFlBQ25HLFNBQVM7QUFBQSxZQUNULFdBQVcsT0FBTztBQUFBLFVBQ3RCLENBQUM7QUFDRCxnQkFBTSxRQUFRLE9BQU8sTUFBTSxJQUFJO0FBRS9CLGNBQUksT0FBTztBQUNYLGNBQUksUUFBUTtBQUNaLGNBQUksU0FBUztBQUViLHFCQUFXLFFBQVEsT0FBTztBQUN0QixrQkFBTSxZQUFZLEtBQUssTUFBTSxpQkFBaUI7QUFDOUMsZ0JBQUksVUFBVyxRQUFPLFVBQVUsQ0FBQztBQUVqQyxrQkFBTSxhQUFhLEtBQUssTUFBTSxrQ0FBa0M7QUFDaEUsZ0JBQUksV0FBWSxTQUFRLFdBQVcsQ0FBQyxFQUFFLFlBQVk7QUFFbEQsa0JBQU0sY0FBYyxLQUFLLE1BQU0sc0JBQXNCO0FBQ3JELGdCQUFJLGFBQWE7QUFDYixvQkFBTSxTQUFTLFNBQVMsWUFBWSxDQUFDLEdBQUcsRUFBRTtBQUMxQyx1QkFBUyxNQUFNLE1BQU0sSUFBSSxPQUFPO0FBQUEsWUFDcEM7QUFBQSxVQUNKO0FBRUEsaUJBQU87QUFBQSxZQUNIO0FBQUEsWUFDQTtBQUFBLFlBQ0EsU0FBUyxvQkFBb0IsTUFBTTtBQUFBLFlBQ25DLFNBQVM7QUFBQSxVQUNiO0FBQUEsUUFDSixTQUFTLGVBQWU7QUFFcEIsZ0JBQU1DLGVBQWMsY0FBYyxTQUFTLFlBQVksY0FBYyxTQUFTO0FBQzlFLGNBQUlBLGNBQWE7QUFDYixZQUFBRCxNQUFJLE1BQU0sMkVBQTJFLGNBQWMsV0FBVyxhQUFhO0FBQUEsVUFDL0g7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKLFNBQVMsT0FBTztBQUVaLElBQUFBLE1BQUksTUFBTSx1Q0FBdUMsTUFBTSxXQUFXLEtBQUs7QUFDdkUsV0FBTztBQUFBLE1BQ0gsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLElBQ2I7QUFBQSxFQUNKO0FBRUEsU0FBTztBQUFBLElBQ0gsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUztBQUFBLElBQ1QsU0FBUztBQUFBLEVBQ2I7QUFDSjtBQUtBLGVBQWUscUJBQXFCO0FBQ2hDLE1BQUk7QUFDQSxVQUFNLEVBQUUsUUFBUSxPQUFPLElBQUksTUFBTSxVQUFVLDhCQUE4QjtBQUFBLE1BQ3JFLFNBQVM7QUFBQSxNQUNULFdBQVcsT0FBTztBQUFBLElBQ3RCLENBQUM7QUFHRCxVQUFNLGVBQWUsVUFBVSxJQUFJLFlBQVk7QUFDL0MsVUFBTSxVQUFVLFVBQVUsSUFBSSxZQUFZO0FBQzFDLFVBQU0saUJBQWlCLFNBQVMsTUFBTTtBQUd0QyxRQUFJLGVBQWUsU0FBUyxTQUFTLEtBQ2pDLGVBQWUsU0FBUyxpQkFBaUIsS0FDekMsZUFBZSxTQUFTLGtCQUFrQixLQUMxQyxlQUFlLFNBQVMsb0JBQW9CLEtBQzVDLGVBQWUsU0FBUywwQkFBdUIsS0FDL0MsZUFBZSxTQUFTLGdCQUFnQixLQUN4QyxlQUFlLFNBQVMsd0JBQXdCLEtBQ2hELGVBQWUsU0FBUyxZQUFZLEtBQUssZUFBZSxTQUFTLDBCQUF1QixHQUFHO0FBQzNGLGFBQU8sRUFBRSxNQUFNLE1BQU0sT0FBTyxNQUFNLFNBQVMsTUFBTSxTQUFTLGNBQWM7QUFBQSxJQUM1RTtBQUdBLFFBQUksZUFBZSxTQUFTLHdCQUF3QixLQUNoRCxlQUFlLFNBQVMsVUFBVSxNQUFNLGVBQWUsU0FBUyxjQUFXLEtBQUssZUFBZSxTQUFTLGFBQVUsTUFDbEgsZUFBZSxTQUFTLHNCQUFzQixLQUM5QyxlQUFlLFNBQVMsVUFBVSxLQUFLLGVBQWUsU0FBUyxVQUFVLEtBQ3pFLGVBQWUsU0FBUyxrQkFBa0IsS0FDMUMsZUFBZSxTQUFTLGFBQWEsS0FBSyxlQUFlLFNBQVMsVUFBVSxLQUM1RSxlQUFlLFNBQVMsU0FBUyxLQUFLLGVBQWUsU0FBUyxVQUFVLEtBQ3hFLGVBQWUsU0FBUyxzQkFBc0IsS0FBSyxlQUFlLFNBQVMsVUFBVSxHQUFHO0FBRXhGLGFBQU8sTUFBTSw2QkFBNkI7QUFBQSxJQUM5QztBQUVBLFFBQUksQ0FBQyxVQUFVLE9BQU8sS0FBSyxFQUFFLFdBQVcsR0FBRztBQUN2QyxhQUFPLEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUyxjQUFjO0FBQUEsSUFDNUU7QUFHQSxRQUFJLE9BQU8sU0FBUyxnQ0FBZ0MsS0FDaEQsT0FBTyxTQUFTLHNDQUFzQyxLQUN0RCxPQUFPLE1BQU0sY0FBYyxHQUFHO0FBQzlCLGFBQU8sRUFBRSxNQUFNLE1BQU0sT0FBTyxNQUFNLFNBQVMsTUFBTSxTQUFTLGNBQWM7QUFBQSxJQUM1RTtBQUVBLFVBQU0sUUFBUSxPQUFPLE1BQU0sSUFBSSxFQUFFLElBQUksVUFBUSxLQUFLLEtBQUssQ0FBQyxFQUFFLE9BQU8sVUFBUSxLQUFLLFNBQVMsQ0FBQztBQUV4RixRQUFJLE9BQU87QUFDWCxRQUFJLFFBQVE7QUFDWixRQUFJLFNBQVM7QUFFYixlQUFXLFFBQVEsT0FBTztBQUd0QixVQUFJLEtBQUssTUFBTSxpQkFBaUIsR0FBRztBQUMvQixjQUFNLFFBQVEsS0FBSyxNQUFNLHdCQUF3QjtBQUNqRCxZQUFJLE9BQU87QUFDUCxnQkFBTSxZQUFZLE1BQU0sQ0FBQyxFQUFFLEtBQUs7QUFFaEMsY0FBSSxhQUFhLFVBQVUsU0FBUyxLQUFLLENBQUMsVUFBVSxNQUFNLDJCQUEyQixHQUFHO0FBQ3BGLG1CQUFPO0FBQUEsVUFDWDtBQUFBLFFBQ0o7QUFBQSxNQUNKLFdBRVMsS0FBSyxNQUFNLFlBQVksR0FBRztBQUUvQixjQUFNLFFBQVEsS0FBSyxNQUFNLG9EQUFvRDtBQUM3RSxZQUFJLE9BQU87QUFDUCxrQkFBUSxNQUFNLENBQUMsRUFBRSxRQUFRLFNBQVMsR0FBRyxFQUFFLFlBQVk7QUFBQSxRQUN2RDtBQUFBLE1BQ0osV0FFUyxLQUFLLE1BQU0sc0NBQXNDLEdBQUc7QUFFekQsWUFBSSxRQUFRLEtBQUssTUFBTSxnQkFBZ0I7QUFDdkMsWUFBSSxPQUFPO0FBQ1AsZ0JBQU0sU0FBUyxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDcEMsY0FBSSxDQUFDLE1BQU0sTUFBTSxLQUFLLFVBQVUsS0FBSyxVQUFVLEtBQUs7QUFDaEQscUJBQVM7QUFBQSxVQUNiO0FBQUEsUUFDSixPQUFPO0FBRUgsa0JBQVEsS0FBSyxNQUFNLG9CQUFvQjtBQUN2QyxjQUFJLE9BQU87QUFDUCxrQkFBTSxNQUFNLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUNqQyxnQkFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHO0FBQ2IsdUJBQVMsb0JBQW9CLEdBQUc7QUFBQSxZQUNwQztBQUFBLFVBQ0o7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFHQSxXQUFPO0FBQUEsTUFDSCxNQUFPLFFBQVEsS0FBSyxTQUFTLElBQUssT0FBTztBQUFBLE1BQ3pDLE9BQVEsU0FBUyxNQUFNLFNBQVMsSUFBSyxRQUFRO0FBQUEsTUFDN0MsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLElBQ2I7QUFBQSxFQUNKLFNBQVMsT0FBTztBQUVaLFVBQU0sZ0JBQWdCLE1BQU0sV0FBVyxJQUFJLFlBQVk7QUFDdkQsVUFBTSxlQUFlLE1BQU0sVUFBVSxJQUFJLFlBQVk7QUFDckQsVUFBTSxlQUFlLE1BQU0sVUFBVSxJQUFJLFlBQVk7QUFDckQsVUFBTSxzQkFBc0IsZUFBZSxNQUFNLGNBQWMsTUFBTTtBQUdyRSxRQUFJLG9CQUFvQixTQUFTLHdCQUF3QixLQUNyRCxvQkFBb0IsU0FBUyxVQUFVLE1BQU0sb0JBQW9CLFNBQVMsY0FBVyxLQUFLLG9CQUFvQixTQUFTLGFBQVUsTUFDakksb0JBQW9CLFNBQVMsc0JBQXNCLEtBQ25ELG9CQUFvQixTQUFTLFVBQVUsS0FBSyxvQkFBb0IsU0FBUyxVQUFVLEtBQ25GLG9CQUFvQixTQUFTLGtCQUFrQixLQUMvQyxvQkFBb0IsU0FBUyxhQUFhLEtBQUssb0JBQW9CLFNBQVMsVUFBVSxLQUN0RixvQkFBb0IsU0FBUyxTQUFTLEtBQUssb0JBQW9CLFNBQVMsVUFBVSxLQUNsRixvQkFBb0IsU0FBUyxzQkFBc0IsS0FBSyxvQkFBb0IsU0FBUyxVQUFVLEdBQUc7QUFFbEcsYUFBTyxNQUFNLDZCQUE2QjtBQUFBLElBQzlDO0FBR0EsSUFBQUEsTUFBSSxNQUFNLHNEQUFzRCxNQUFNLFdBQVcsS0FBSztBQUN0RixXQUFPLEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUyxRQUFRO0FBQUEsRUFDdEU7QUFDSjtBQUtBLGVBQWUsK0JBQStCO0FBQzFDLE1BQUk7QUFFQSxRQUFJLE9BQU87QUFDWCxRQUFJO0FBRUEsWUFBTSxFQUFFLFFBQVEsV0FBVyxJQUFJLE1BQU0sVUFBVSxtTkFBdU47QUFBQSxRQUNsUSxTQUFTO0FBQUEsUUFDVCxXQUFXLE9BQU87QUFBQSxNQUN0QixDQUFDO0FBQ0QsWUFBTSxVQUFVLFdBQVcsS0FBSztBQUNoQyxVQUFJLFdBQVcsUUFBUSxTQUFTLEtBQUssQ0FBQyxRQUFRLE1BQU0sMkJBQTJCLEdBQUc7QUFDOUUsZUFBTztBQUFBLE1BQ1g7QUFBQSxJQUNKLFNBQVMsV0FBVztBQUFBLElBRXBCO0FBSUEsVUFBTSxRQUFRO0FBSWQsV0FBTztBQUFBLE1BQ0gsTUFBTSxRQUFRO0FBQUEsTUFDZCxPQUFPLFNBQVM7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsSUFDYjtBQUFBLEVBQ0osU0FBUyxPQUFPO0FBRVosSUFBQUEsTUFBSSxNQUFNLDZEQUE2RCxNQUFNLFdBQVcsS0FBSztBQUM3RixXQUFPLEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sU0FBUyxRQUFRO0FBQUEsRUFDdEU7QUFDSjtBQUtBLGVBQWUsbUJBQW1CO0FBQzlCLE1BQUk7QUFFQSxRQUFJO0FBRUEsWUFBTSxFQUFFLFFBQVEsWUFBWSxJQUFJLE1BQU0sVUFBVSwrSEFBK0g7QUFBQSxRQUMzSyxTQUFTO0FBQUEsUUFDVCxXQUFXLE9BQU87QUFBQSxNQUN0QixDQUFDO0FBQ0QsWUFBTSxVQUFVLFlBQVksS0FBSztBQUVqQyxZQUFNLEVBQUUsT0FBTyxJQUFJLE1BQU0sVUFBVSxHQUFHLE9BQU8sT0FBTztBQUFBLFFBQ2hELFNBQVM7QUFBQSxRQUNULFdBQVcsT0FBTztBQUFBLE1BQ3RCLENBQUM7QUFDRCxZQUFNLFFBQVEsT0FBTyxNQUFNLElBQUksRUFBRSxJQUFJLFVBQVEsS0FBSyxLQUFLLENBQUM7QUFFeEQsVUFBSSxPQUFPO0FBQ1gsVUFBSSxRQUFRO0FBQ1osVUFBSSxVQUFVO0FBQ2QsVUFBSSxnQkFBZ0I7QUFFcEIsaUJBQVcsUUFBUSxPQUFPO0FBQ3RCLFlBQUksS0FBSyxXQUFXLE9BQU8sR0FBRztBQUMxQixpQkFBTyxLQUFLLFFBQVEsU0FBUyxFQUFFLEVBQUUsS0FBSztBQUFBLFFBQzFDLFdBQVcsS0FBSyxXQUFXLFFBQVEsR0FBRztBQUVsQyxnQkFBTSxhQUFhLEtBQUssTUFBTSw0Q0FBNEM7QUFDMUUsa0JBQVEsYUFBYSxXQUFXLENBQUMsRUFBRSxZQUFZLElBQUk7QUFBQSxRQUN2RCxXQUFXLEtBQUssV0FBVyxhQUFhLEdBQUc7QUFFdkMsZ0JBQU0sVUFBVSxLQUFLLFFBQVEsZUFBZSxFQUFFLEVBQUUsS0FBSztBQUNyRCxnQkFBTSxPQUFPLFVBQVcsU0FBUyxTQUFTLEVBQUUsS0FBSyxPQUFRO0FBQ3pELG9CQUFVO0FBQUEsUUFDZCxXQUFXLEtBQUssV0FBVyxZQUFZLEdBQUc7QUFFdEMsZ0JBQU0sY0FBYyxLQUFLLE1BQU0sUUFBUTtBQUN2QyxjQUFJLGVBQWUsa0JBQWtCLE1BQU07QUFDdkMsa0JBQU0sU0FBUyxTQUFTLFlBQVksQ0FBQyxHQUFHLEVBQUU7QUFDMUMsNEJBQWdCLE1BQU0sTUFBTSxJQUFJLE9BQU87QUFBQSxVQUMzQztBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBRUEsVUFBSSxVQUFVO0FBQ2QsVUFBSSxrQkFBa0IsTUFBTTtBQUN4QixrQkFBVTtBQUFBLE1BQ2QsV0FBVyxZQUFZLE1BQU07QUFDekIsa0JBQVUsb0JBQW9CLE9BQU87QUFBQSxNQUN6QztBQUVBLFVBQUksUUFBUSxTQUFTLFlBQVksTUFBTTtBQUNuQyxlQUFPO0FBQUEsVUFDSCxNQUFNLFFBQVE7QUFBQSxVQUNkLE9BQU8sU0FBUztBQUFBLFVBQ2hCO0FBQUEsVUFDQSxTQUFTO0FBQUEsUUFDYjtBQUFBLE1BQ0o7QUFBQSxJQUNKLFNBQVMsY0FBYztBQUVuQixVQUFJLGFBQWEsU0FBUyxZQUFZLGFBQWEsV0FBVyxDQUFDLGFBQWEsUUFBUSxTQUFTLFlBQVksR0FBRztBQUN4RyxRQUFBQSxNQUFJLE1BQU0sNkNBQTZDLGFBQWEsV0FBVyxZQUFZO0FBQUEsTUFDL0Y7QUFBQSxJQUNKO0FBSUEsUUFBSTtBQUVBLFlBQU0sRUFBRSxRQUFRLGdCQUFnQixJQUFJLE1BQU0sVUFBVSxrRkFBb0Y7QUFBQSxRQUNwSSxTQUFTO0FBQUEsUUFDVCxXQUFXLE9BQU87QUFBQSxNQUN0QixDQUFDO0FBQ0QsWUFBTSxnQkFBZ0IsZ0JBQWdCLEtBQUs7QUFFM0MsVUFBSSxDQUFDLGVBQWU7QUFFaEIsZUFBTyxFQUFFLE1BQU0sTUFBTSxPQUFPLE1BQU0sU0FBUyxNQUFNLFNBQVMsY0FBYztBQUFBLE1BQzVFO0FBR0EsVUFBSSxPQUFPO0FBQ1gsVUFBSTtBQUNBLGNBQU0sRUFBRSxRQUFRLFdBQVcsSUFBSSxNQUFNLFVBQVUsd0JBQXdCLGFBQWEsZ0RBQWdEO0FBQUEsVUFDaEksU0FBUztBQUFBLFVBQ1QsV0FBVyxPQUFPO0FBQUEsUUFDdEIsQ0FBQztBQUNELGVBQU8sV0FBVyxLQUFLLEtBQUs7QUFBQSxNQUNoQyxTQUFTLFdBQVc7QUFBQSxNQUVwQjtBQUdBLFVBQUksUUFBUTtBQUNaLFVBQUk7QUFDQSxjQUFNLEVBQUUsUUFBUSxZQUFZLElBQUksTUFBTSxVQUFVLHdCQUF3QixhQUFhLHlDQUF5QztBQUFBLFVBQzFILFNBQVM7QUFBQSxVQUNULFdBQVcsT0FBTztBQUFBLFFBQ3RCLENBQUM7QUFDRCxjQUFNLFdBQVcsWUFBWSxLQUFLO0FBRWxDLFlBQUksWUFBWSxvQ0FBb0MsS0FBSyxRQUFRLEdBQUc7QUFDaEUsa0JBQVEsU0FBUyxZQUFZO0FBQUEsUUFDakM7QUFBQSxNQUNKLFNBQVMsWUFBWTtBQUFBLE1BRXJCO0FBR0EsYUFBTztBQUFBLFFBQ0gsTUFBTSxRQUFRO0FBQUEsUUFDZCxPQUFPLFNBQVM7QUFBQSxRQUNoQixTQUFTO0FBQUEsUUFDVCxTQUFTO0FBQUEsTUFDYjtBQUFBLElBQ0osU0FBUyxtQkFBbUI7QUFFeEIsTUFBQUEsTUFBSSxNQUFNLDREQUE0RCxrQkFBa0IsV0FBVyxpQkFBaUI7QUFFcEgsYUFBTyxFQUFFLE1BQU0sTUFBTSxPQUFPLE1BQU0sU0FBUyxNQUFNLFNBQVMsUUFBUTtBQUFBLElBQ3RFO0FBQUEsRUFDSixTQUFTLE9BQU87QUFFWixJQUFBQSxNQUFJLE1BQU0sdUNBQXVDLE1BQU0sV0FBVyxLQUFLO0FBQ3ZFLFdBQU8sRUFBRSxNQUFNLE1BQU0sT0FBTyxNQUFNLFNBQVMsTUFBTSxTQUFTLFFBQVE7QUFBQSxFQUN0RTtBQUVBLFNBQU8sRUFBRSxNQUFNLE1BQU0sT0FBTyxNQUFNLFNBQVMsTUFBTSxTQUFTLGNBQWM7QUFDNUU7OztBUjVnQkEsSUFBTSxFQUFDLEVBQUMsSUFBSSxnQkFBSztBQWNqQixJQUFNRSxhQUFZLFlBQVk7QUFFOUIsSUFBTSxnQkFBZ0IsQ0FBQyxNQUFNLE9BQU8sYUFBYSxVQUFVLFNBQVM7QUFDaEUsU0FBTyxJQUFJLFFBQVEsQ0FBQyxZQUFZO0FBQzVCLFVBQU0sU0FBUyxJQUFJLElBQUksT0FBTztBQUM5QixVQUFNLFNBQVMsQ0FBQyxTQUFTLFFBQVEsU0FBUztBQUN0QyxhQUFPLFFBQVE7QUFDZixjQUFRLEVBQUUsU0FBUyxNQUFNLE1BQU0sTUFBTSxDQUFDO0FBQUEsSUFDMUM7QUFDQSxXQUFPLFdBQVcsT0FBTztBQUN6QixXQUFPLEtBQUssV0FBVyxNQUFNLE9BQU8sSUFBSSxDQUFDO0FBQ3pDLFdBQU8sS0FBSyxXQUFXLE1BQU0sT0FBTyxPQUFPLFNBQVMsQ0FBQztBQUNyRCxXQUFPLEtBQUssU0FBUyxDQUFDLFFBQVEsT0FBTyxPQUFPLElBQUksT0FBTyxDQUFDO0FBQ3hELFFBQUk7QUFDQSxhQUFPLFFBQVEsTUFBTSxJQUFJO0FBQUEsSUFDN0IsU0FBUyxLQUFLO0FBQ1YsYUFBTyxPQUFPLElBQUksT0FBTztBQUFBLElBQzdCO0FBQUEsRUFDSixDQUFDO0FBQ0w7QUFNQSxJQUFNLGFBQU4sTUFBaUI7QUFBQSxFQUNiLGNBQWU7QUFDWCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVM7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGdCQUFnQjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxLQUFNLElBQUlDLFNBQVEsSUFBSSxJQUFJO0FBQ3RCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBU0E7QUFDZCxTQUFLLGdCQUFnQjtBQUNyQixTQUFLLHVCQUF1QjtBQUc1QixZQUFRLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxXQUFXO0FBQzVDLE1BQUFDLE1BQUksS0FBSyxzREFBc0QsTUFBTSxFQUFFO0FBQ3ZFLHNCQUFLLFNBQVM7QUFDZCx1QkFBaUIsZ0JBQUssTUFBTTtBQUFBLElBQ2hDLENBQUM7QUFHRCxZQUFRLE9BQU8sb0JBQW9CLE9BQU8sVUFBVTtBQUVoRCxVQUFJLGFBQWEsS0FBSyxnQkFBZ0I7QUFDdEMsVUFBSSxhQUFhLFdBQVc7QUFDNUIsVUFBSSxXQUFXLFdBQVc7QUFDMUIsVUFBSSxRQUFRLFdBQVc7QUFFdkIsVUFBSSxVQUFVO0FBQUEsUUFDVixPQUFPLFdBQVc7QUFBQSxNQUN0QjtBQUVBLFVBQUksZ0JBQWdCO0FBQ3BCLFVBQUksS0FBSyxnQkFBZ0IsV0FBVyxlQUFjO0FBQzlDLGVBQU87QUFBQSxNQUNYLE9BQ0k7QUFFQSx3QkFBZ0IsTUFBTSxNQUFNLFdBQVcsUUFBUSxJQUFJLEtBQUssT0FBTyxhQUFhLGlDQUFpQyxVQUFVLElBQUksS0FBSyxJQUFJO0FBQUEsVUFDaEksUUFBUTtBQUFBLFVBQ1IsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLFVBQzVCLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsUUFDbEQsQ0FBQyxFQUNBLEtBQUssY0FBWSxTQUFTLEtBQUssQ0FBQyxFQUNoQyxLQUFLLFVBQVE7QUFFVixpQkFBTztBQUFBLFFBQ1gsQ0FBQyxFQUNBLE1BQU0sU0FBT0EsTUFBSSxNQUFNLGtDQUFrQyxHQUFHLEVBQUUsQ0FBQztBQUNoRSxlQUFPO0FBQUEsTUFDWDtBQUFBLElBSUosQ0FBQztBQUdELFVBQU0sd0JBQXdCLENBQUMsY0FBYztBQUN6QyxVQUFJLFVBQVUsU0FBUyxPQUFPLEtBQUssVUFBVSxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQzNFLFVBQUksVUFBVSxTQUFTLE9BQU8sS0FBSyxVQUFVLFNBQVMsUUFBUSxFQUFHLFFBQU87QUFDeEUsVUFBSSxVQUFVLFNBQVMsVUFBVSxLQUFLLFVBQVUsU0FBUyxZQUFZLEVBQUcsUUFBTztBQUMvRSxVQUFJLFVBQVUsU0FBUyxXQUFXLEtBQUssVUFBVSxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQy9FLFVBQUksVUFBVSxTQUFTLFNBQVMsS0FBSyxVQUFVLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFDaEYsVUFBSSxVQUFVLFNBQVMsT0FBTyxLQUFLLFVBQVUsU0FBUyxpQkFBaUIsRUFBRyxRQUFPO0FBQ2pGLFVBQUksVUFBVSxTQUFTLFFBQVEsS0FBSyxVQUFVLFNBQVMsUUFBUSxFQUFHLFFBQU87QUFDekUsVUFBSSxVQUFVLFNBQVMsZUFBZSxLQUFLLFVBQVUsU0FBUyxPQUFPLEVBQUcsUUFBTztBQUMvRSxVQUFJLFVBQVUsU0FBUyxZQUFZLEtBQUssVUFBVSxTQUFTLE9BQU8sRUFBRyxRQUFPO0FBQzVFLFVBQUksVUFBVSxTQUFTLGtCQUFrQixLQUFLLFVBQVUsU0FBUyxhQUFhLEVBQUcsUUFBTztBQUV4RixVQUFJLFVBQVUsU0FBUyx1QkFBdUIsS0FBSyxVQUFVLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDM0YsVUFBSSxVQUFVLFNBQVMsYUFBYSxFQUFHLFFBQU87QUFDOUMsVUFBSSxVQUFVLFNBQVMsUUFBUSxLQUFLLFVBQVUsU0FBUyxpQkFBaUIsRUFBRyxRQUFPO0FBQ2xGLFVBQUksVUFBVSxTQUFTLE9BQU8sS0FBSyxVQUFVLFNBQVMsVUFBVSxFQUFHLFFBQU87QUFDMUUsVUFBSSxVQUFVLFNBQVMsT0FBTyxLQUFLLFVBQVUsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUM5RSxVQUFJLFVBQVUsU0FBUyxRQUFRLEtBQUssVUFBVSxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBQy9FLFVBQUksVUFBVSxTQUFTLHVCQUF1QixFQUFHLFFBQU87QUFHeEQsYUFBTztBQUFBLElBQ1g7QUFFQSxZQUFRLE9BQU8sOEJBQThCLENBQUMsT0FBTyxFQUFFLFNBQVMsWUFBWSxNQUFNO0FBQzlFLFlBQU0sUUFBUSxZQUFZLE9BQU8sT0FBTyxPQUFPLENBQUM7QUFDaEQsVUFBSSxDQUFDLFNBQVMsTUFBTSxjQUFjLEVBQUcsUUFBTztBQUc1QyxZQUFNLG1CQUFtQixlQUFlO0FBRXhDLFlBQU0sUUFBUSxZQUFZLElBQUksT0FBSyxPQUFPLENBQUMsRUFBRSxZQUFZLENBQUM7QUFHMUQsWUFBTSxlQUFlLENBQUMsY0FBYztBQUNoQyxZQUFJLENBQUMsVUFBVyxRQUFPO0FBQ3ZCLGNBQU0sU0FBUyxPQUFPLFNBQVMsRUFBRSxZQUFZO0FBRzdDLFlBQUksc0JBQXNCLE1BQU0sRUFBRyxRQUFPO0FBRzFDLG1CQUFXLGNBQWMsT0FBTztBQUM1QixjQUFJO0FBRUEsa0JBQU0sU0FBUyxJQUFJLElBQUksU0FBUztBQUNoQyxrQkFBTSxpQkFBaUIsT0FBTyxTQUFTLFlBQVk7QUFHbkQsZ0JBQUksZ0JBQWdCO0FBQ3BCLGdCQUFJLFdBQVcsV0FBVyxTQUFTLEtBQUssV0FBVyxXQUFXLFVBQVUsR0FBRztBQUN2RSxvQkFBTSxnQkFBZ0IsSUFBSSxJQUFJLFVBQVU7QUFDeEMsOEJBQWdCLGNBQWMsU0FBUyxZQUFZO0FBQUEsWUFDdkQsV0FBVyxXQUFXLFNBQVMsR0FBRyxHQUFHO0FBRWpDLG9CQUFNLFFBQVEsV0FBVyxNQUFNLEdBQUc7QUFDbEMsOEJBQWdCLE1BQU0sQ0FBQyxFQUFFLFlBQVk7QUFBQSxZQUN6QztBQUdBLGdCQUFJLG1CQUFtQixjQUFlLFFBQU87QUFHN0Msa0JBQU0sc0JBQXNCLGNBQWMsU0FBUyxHQUFHO0FBRXRELGdCQUFJLHFCQUFxQjtBQUVyQixrQkFBSSxtQkFBbUIsU0FBUyxjQUFlLFFBQU87QUFBQSxZQUUxRCxPQUFPO0FBR0gsa0JBQUksbUJBQW1CLFNBQVMsY0FBZSxRQUFPO0FBR3RELGtCQUFJLGVBQWUsU0FBUyxNQUFNLGFBQWEsR0FBRztBQUM5QyxzQkFBTSxTQUFTLGVBQWUsTUFBTSxHQUFHLEVBQUUsY0FBYyxTQUFTLEVBQUU7QUFFbEUsb0JBQUksVUFBVSxDQUFDLE9BQU8sU0FBUyxHQUFHLEtBQUssMkNBQTJDLEtBQUssTUFBTSxHQUFHO0FBQzVGLHlCQUFPO0FBQUEsZ0JBQ1g7QUFBQSxjQUNKO0FBQUEsWUFDSjtBQUFBLFVBQ0osU0FBUyxPQUFPO0FBRVosZ0JBQUksT0FBTyxTQUFTLFVBQVUsRUFBRyxRQUFPO0FBQUEsVUFDNUM7QUFBQSxRQUNKO0FBRUEsZUFBTztBQUFBLE1BQ1g7QUFFQSxZQUFNLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQ3BDLGNBQU0sWUFBWSxhQUFhLEdBQUc7QUFDbEMsWUFBSSxXQUFXO0FBQ1gsZ0JBQU0sUUFBUSxHQUFHO0FBQ2pCLFVBQUFBLE1BQUksS0FBSyxrRUFBa0UsR0FBRztBQUFBLFFBQ2xGLE1BQ0ssUUFBTyxFQUFFLFFBQVEsT0FBTztBQUFBLE1BQ2pDLENBQUM7QUFFRCxZQUFNLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxRQUFRO0FBQ2xDLGNBQU0sWUFBWSxhQUFhLEdBQUc7QUFDbEMsWUFBSSxDQUFDLFdBQVc7QUFDWixZQUFFLGVBQWU7QUFDakIsVUFBQUEsTUFBSSxLQUFLLGtFQUFrRSxHQUFHO0FBQUEsUUFDbEY7QUFBQSxNQUNKLENBQUM7QUFFRCxhQUFPO0FBQUEsSUFDWCxDQUFDO0FBR0QsWUFBUSxPQUFPLHNDQUFzQyxDQUFDLE9BQU8sRUFBRSxTQUFTLE1BQU0sZUFBZSxTQUFTLGNBQWMsY0FBYyxhQUFhLE1BQU07QUFDakosWUFBTSxRQUFRLFlBQVksT0FBTyxPQUFPLE9BQU8sQ0FBQztBQUNoRCxVQUFJLENBQUMsU0FBUyxNQUFNLGNBQWMsRUFBRyxRQUFPO0FBRzVDLFlBQU0sbUJBQW1CLGVBQWU7QUFHeEMsWUFBTSxlQUFlLENBQUMsY0FBYztBQUNoQyxZQUFJLFNBQVMsV0FBVztBQUVwQixjQUFJLENBQUMsYUFBYSxVQUFVLFNBQVMsT0FBTyxFQUFHLFFBQU87QUFFdEQsY0FBSTtBQUNBLGtCQUFNLFNBQVMsSUFBSSxJQUFJLFNBQVM7QUFDaEMsa0JBQU0sU0FBUyxPQUFPO0FBRXRCLGdCQUFJLFdBQVcsY0FBZSxRQUFPO0FBRXJDLGdCQUFJLFdBQVcsU0FBUyxjQUFlLFFBQU87QUFDOUMsZ0JBQUksT0FBTyxTQUFTLE1BQU0sYUFBYSxHQUFHO0FBQ3RDLG9CQUFNLFNBQVMsT0FBTyxNQUFNLEdBQUcsRUFBRSxjQUFjLFNBQVMsRUFBRTtBQUMxRCxrQkFBSSxVQUFVLENBQUMsT0FBTyxTQUFTLEdBQUcsS0FBSywyQ0FBMkMsS0FBSyxNQUFNLEdBQUc7QUFDNUYsdUJBQU87QUFBQSxjQUNYO0FBQUEsWUFDSjtBQUFBLFVBQ0osU0FBUyxPQUFPO0FBQ1osbUJBQU87QUFBQSxVQUNYO0FBQUEsUUFDSixXQUFXLFNBQVMsYUFBYTtBQUU3QixjQUFJLFVBQVUsU0FBUyxZQUFZLEdBQUc7QUFDbEMsbUJBQU87QUFBQSxVQUNYO0FBR0EsY0FBSSxVQUFVLFNBQVMsa0JBQWtCLEtBQUssVUFBVSxTQUFTLFlBQVksR0FBRztBQUM1RSxtQkFBTztBQUFBLFVBQ1g7QUFDQSxjQUFJLFVBQVUsU0FBUyxvQkFBb0IsS0FBSyxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQzlFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLFFBQVEsS0FBSyxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQ2xFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLE9BQU8sS0FBSyxVQUFVLFNBQVMsV0FBVyxHQUFHO0FBQ2hFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLE9BQU8sS0FBSyxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQ2pFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLFFBQVEsS0FBSyxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQ2xFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLE1BQU0sS0FBSyxVQUFVLFNBQVMsWUFBWSxHQUFHO0FBQ2hFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLE9BQU8sS0FBSyxVQUFVLFNBQVMsb0JBQW9CLEdBQUc7QUFDekUsbUJBQU87QUFBQSxVQUNYO0FBQ0EsY0FBSSxVQUFVLFNBQVMsT0FBTyxLQUFLLFVBQVUsU0FBUyxvQkFBb0IsR0FBRztBQUN6RSxtQkFBTztBQUFBLFVBQ1g7QUFDQSxjQUFJLFVBQVUsU0FBUyxPQUFPLEtBQUssVUFBVSxTQUFTLGFBQWEsR0FBRztBQUNsRSxtQkFBTztBQUFBLFVBQ1g7QUFBQSxRQUNKLFdBQVcsU0FBUyxTQUFTO0FBRXpCLGNBQUksVUFBVSxTQUFTLFlBQVksR0FBRztBQUNsQyxtQkFBTztBQUFBLFVBQ1g7QUFHQSxjQUFJLFVBQVUsU0FBUyxpQkFBaUIsS0FBSyxVQUFVLFNBQVMsY0FBYyxHQUFHO0FBQzdFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGNBQUksVUFBVSxTQUFTLGlCQUFpQixLQUFLLFVBQVUsU0FBUyxXQUFXLEdBQUc7QUFDMUUsbUJBQU87QUFBQSxVQUNYO0FBQUEsUUFDSixXQUFXLFNBQVMsT0FBTztBQUV2QixpQkFBTztBQUFBLFFBQ1g7QUFHQSxlQUFPLHNCQUFzQixTQUFTO0FBQUEsTUFDMUM7QUFHQSxZQUFNLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxNQUFNO0FBQ3BDLFlBQUksYUFBYSxHQUFHLEdBQUc7QUFDbkIsVUFBQUEsTUFBSSxLQUFLLG9EQUFvRCxJQUFJLDZCQUE2QixHQUFHO0FBQ2pHLGdCQUFNLFFBQVEsR0FBRztBQUNqQixpQkFBTyxFQUFFLFFBQVEsT0FBTztBQUFBLFFBQzVCLE9BQU87QUFDSCxVQUFBQSxNQUFJLEtBQUssb0RBQW9ELElBQUksNkJBQTZCLEdBQUc7QUFDakcsaUJBQU8sRUFBRSxRQUFRLE9BQU87QUFBQSxRQUM1QjtBQUFBLE1BQ0osQ0FBQztBQUdELFlBQU0sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLFFBQVE7QUFDbEMsWUFBSSxDQUFDLGFBQWEsR0FBRyxHQUFHO0FBQ3BCLFVBQUFBLE1BQUksS0FBSyxvREFBb0QsSUFBSSw0QkFBNEIsR0FBRztBQUNoRyxZQUFFLGVBQWU7QUFDakIsZ0JBQU0sS0FBSztBQUFBLFFBQ2YsT0FBTztBQUNILFVBQUFBLE1BQUksS0FBSyxvREFBb0QsSUFBSSw0QkFBNEIsR0FBRztBQUFBLFFBQ3BHO0FBQUEsTUFDSixDQUFDO0FBRUQsYUFBTztBQUFBLElBQ1gsQ0FBQztBQUdELFlBQVEsT0FBTyx3Q0FBd0MsQ0FBQyxPQUFPLEVBQUUsU0FBUyxjQUFjLGFBQWEsTUFBTTtBQUV2RyxZQUFNLGlCQUFpQixRQUFRLFVBQVUsb0NBQW9DLEVBQUUsQ0FBQztBQUNoRixVQUFJLGdCQUFnQjtBQUNoQixlQUFPLGVBQWUsT0FBTyxFQUFFLFNBQVMsTUFBTSxhQUFhLGNBQWMsYUFBYSxDQUFDO0FBQUEsTUFDM0Y7QUFDQSxhQUFPO0FBQUEsSUFDWCxDQUFDO0FBTUQsWUFBUSxPQUFPLHVCQUF1QixDQUFDLE9BQU8sUUFBUTtBQUNsRCxZQUFNLGNBQWMsS0FBSyxjQUFjLFdBQVcsZUFBZSxDQUFDO0FBQ2xFLGtCQUFZLFlBQVksUUFBUSxHQUFHO0FBQUEsSUFDdkMsQ0FBQztBQTZCRCxZQUFRLE9BQU8scUJBQXFCLENBQUMsVUFBVTtBQUMzQyxVQUFHO0FBQ0MsMEJBQW1CLFlBQVk7QUFBQSxNQUNuQyxTQUNNLEtBQUk7QUFDTixlQUFPO0FBQUEsTUFDWDtBQUNBLGFBQU87QUFBQSxJQUNYLENBQUM7QUFNRCxZQUFRLEdBQUcscUJBQXFCLENBQUMsVUFBVTtBQUN2QyxVQUFHO0FBQ0MsMEJBQW1CLFlBQVk7QUFBQSxNQUNuQyxTQUNNLEtBQUk7QUFDTixlQUFPO0FBQUEsTUFDWDtBQUNBLGFBQU87QUFBQSxJQUNYLENBQUM7QUFLRCxZQUFRLE9BQU8seUJBQXlCLFlBQVk7QUFDaEQsWUFBTSxPQUFPLGtCQUFtQixRQUFRO0FBQ3hDLFlBQU0sUUFBUSxDQUFDLGFBQWEsT0FBTyxXQUFXO0FBRTlDLFlBQU0sVUFBVSxNQUFNLFFBQVEsSUFBSSxNQUFNLElBQUksVUFBUSxjQUFjLE1BQU0sTUFBTSxJQUFJLENBQUMsQ0FBQztBQUVwRixZQUFNLGdCQUFnQixRQUFRLEtBQUssWUFBVSxPQUFPLE9BQU87QUFDM0QsYUFBTyxpQkFBaUIsUUFBUSxRQUFRLFNBQVMsQ0FBQztBQUFBLElBQ3RELENBQUM7QUFRRCxZQUFRLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxTQUFTO0FBQ3pDLE1BQUFBLE1BQUksS0FBSyw0RUFBNEU7QUFFckYsVUFBSSxlQUFlO0FBQUEsUUFDZixVQUFVO0FBQUEsUUFFVixpQkFBaUI7QUFBQSxRQUNqQixZQUFZO0FBQUEsUUFDWixnQkFBZ0I7QUFBQSxRQUNoQixhQUFhO0FBQUEsUUFDYixnQkFBZ0I7QUFBQSxRQUNoQixjQUFjO0FBQUEsUUFFZCxvQkFBb0I7QUFBQSxRQUNwQixjQUFjO0FBQUEsUUFDZCxlQUFlO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFFTCxjQUFjO0FBQUEsUUFDZCxZQUFZO0FBQUEsUUFDWixjQUFjO0FBQUEsUUFDZCxjQUFjO0FBQUEsUUFDZCxVQUFVLEtBQUs7QUFBQSxRQUVmLGlCQUFpQjtBQUFBO0FBQUEsUUFDakIsZUFBZTtBQUFBLFFBQ2YsZUFBZTtBQUFBLFFBQ2YsY0FBYztBQUFBLFVBQ1YsR0FBRztBQUFBLFlBQ0MsVUFBVSxLQUFLO0FBQUEsWUFDZixTQUFTLEVBQUUsTUFBTSxTQUFTLE1BQU0sRUFBRTtBQUFBLFlBQ2xDLGFBQWE7QUFBQSxZQUNiLGFBQWE7QUFBQSxZQUNiLGNBQWMsS0FBSyxnQkFBZ0I7QUFBQSxZQUNuQyxnQkFBZ0IsS0FBSyxrQkFBa0I7QUFBQSxZQUN2QyxhQUFhLEtBQUssZUFBZTtBQUFBLFVBQ3JDO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFFQSxXQUFLLGdCQUFnQixXQUFXLE9BQU8sS0FBSztBQUM1QyxXQUFLLGdCQUFnQixXQUFXLFdBQVc7QUFDM0MsV0FBSyxnQkFBZ0IsV0FBVyxhQUFhO0FBQzdDLFdBQUssZ0JBQWdCLFdBQVcsTUFBTTtBQUN0QyxXQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFDeEMsV0FBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQ3hDLFdBQUssZ0JBQWdCLFdBQVcsZ0JBQWdCO0FBRWhELFdBQUsscUJBQXFCLFVBQVUsWUFBWTtBQUVoRCxZQUFNLGNBQWM7QUFBQSxJQUN4QixDQUFDO0FBUUQsWUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLFlBQVk7QUFDdkMsTUFBQUEsTUFBSSxLQUFLLCtEQUErRCxPQUFPO0FBQy9FLFdBQUssY0FBYyxrQkFBa0IsT0FBTztBQUM1QyxZQUFNLGNBQWM7QUFBQSxJQUN4QixDQUFDO0FBT0QsWUFBUSxHQUFHLGVBQWUsTUFBTTtBQUFHLFdBQUssZ0JBQWdCLFdBQVcsY0FBYztBQUFBLElBQU0sQ0FBRTtBQU16RixZQUFRLE9BQU8sYUFBYSxDQUFDLE9BQU8sVUFBUSxVQUFVO0FBQ2xELFVBQUksU0FBUztBQUNiLFVBQUksS0FBSyxPQUFPLGVBQWUsQ0FBQyxLQUFLLGdCQUFnQixVQUFVO0FBQzNELGlCQUFTLEVBQUUsUUFBUSxVQUFVLE9BQU8sS0FBSTtBQUFBLE1BRTVDLFdBQ1MsS0FBSyxjQUFjLGtCQUFrQixTQUFTLEdBQUc7QUFDdEQsaUJBQVMsRUFBRSxRQUFRLFVBQVUsT0FBTyxLQUFLO0FBQUEsTUFFN0MsV0FDUyxLQUFLLGNBQWMsc0JBQXNCLFdBQVcsT0FBTTtBQUMvRCxRQUFBQSxNQUFJLEtBQUssOEVBQThFO0FBQ3ZGLGlCQUFTLEVBQUUsUUFBUSxVQUFVLE9BQU8sS0FBSztBQUFBLE1BRTdDLE9BQ0s7QUFDRCxhQUFLLGNBQWMsV0FBVyxRQUFRO0FBQ3RDLGFBQUssY0FBYyxXQUFXLFNBQVMsSUFBSTtBQUMzQyxhQUFLLGNBQWMsV0FBVyxLQUFLO0FBQ25DLGFBQUssY0FBYyxXQUFXLE1BQU07QUFFcEMsYUFBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQ3hDLGlCQUFTLEVBQUUsUUFBUSxVQUFVLE9BQU8sTUFBTTtBQUFBLE1BQzlDO0FBRUEsYUFBTztBQUFBLElBQ1gsQ0FBRTtBQU9GLFlBQVEsR0FBRyxhQUFhLENBQUMsVUFBVTtBQUFJLFlBQU0sY0FBYyxLQUFLO0FBQUEsSUFBUyxDQUFDO0FBTTFFLFlBQVEsR0FBRyxrQkFBa0IsTUFBTTtBQUMvQixNQUFBQSxNQUFJLEtBQUssa0VBQWtFO0FBRTNFLFdBQUsscUJBQXFCLGtCQUFrQjtBQUM1QyxXQUFLLHFCQUFxQixnQkFBZ0I7QUFBQSxJQUM5QyxDQUFFO0FBS0YsWUFBUSxHQUFHLGdCQUFnQixNQUFNO0FBRTdCLDBCQUFvQixLQUFLLGNBQWMsVUFBVTtBQUFBLElBQ3JELENBQUU7QUFNRixZQUFRLEdBQUcsYUFBYSxDQUFDLE9BQU8sU0FBUztBQUNyQyxNQUFBQyxXQUFVLFVBQVUsSUFBSTtBQUFBLElBQzVCLENBQUU7QUFPRixZQUFRLE9BQU8sZUFBZSxPQUFPLFVBQVU7QUFDM0MsVUFBSSxVQUFVO0FBQ2QsVUFBSTtBQUFLLGtCQUFVLEtBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBLE1BQWMsU0FDOUQsR0FBRztBQUFJLFFBQUFELE1BQUksTUFBTSx1REFBdUQ7QUFBQSxNQUFjO0FBRzdGLFVBQUksU0FBUztBQUFHLGVBQU8sS0FBSyxPQUFPO0FBQUEsTUFBUztBQUc1QyxVQUFJO0FBRUEsY0FBTSxFQUFFLFNBQVMsV0FBVyxNQUFNLElBQUksTUFBTSxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDekUsY0FBSTtBQUNBLGtCQUFNLE1BQU0sYUFBYTtBQUN6QixvQkFBUSxHQUFHO0FBQUEsVUFDZixTQUFRLEtBQUs7QUFBRyxtQkFBTyxHQUFHO0FBQUEsVUFBSztBQUFBLFFBQ25DLENBQUM7QUFDRCxhQUFLLE9BQU8sU0FBUyxHQUFHLFFBQVEsS0FBSztBQUNyQyxhQUFLLE9BQU8sVUFBVTtBQUFBLE1BQzFCLFNBQ08sR0FBRztBQUNOLGFBQUssT0FBTyxTQUFTO0FBQ3JCLGFBQUssT0FBTyxVQUFVO0FBQUEsTUFDMUI7QUFHQSxVQUFJLENBQUMsS0FBSyxPQUFPLFFBQVE7QUFDckIsWUFBSTtBQUNBLGVBQUssT0FBTyxTQUFTLEdBQUcsUUFBUTtBQUFBLFFBQ3BDLFNBQ08sR0FBRztBQUNOLFVBQUFBLE1BQUksTUFBTSw0REFBNEQsQ0FBQztBQUN2RSxlQUFLLE9BQU8sU0FBUztBQUNyQixlQUFLLE9BQU8sVUFBVTtBQUFBLFFBQzFCO0FBQUEsTUFDSjtBQUdBLFVBQUksS0FBSyxPQUFPLFdBQVcsYUFBYTtBQUFLLGFBQUssT0FBTyxTQUFTO0FBQUEsTUFBUztBQUczRSxVQUFJLEtBQUssT0FBTyxVQUFVLENBQUMsU0FBUztBQUNoQyxZQUFJO0FBRUEsZ0JBQU0sS0FBSyxnQkFBZ0IsS0FBSyxLQUFLLE9BQU8sT0FBTztBQUFBLFFBQ3ZELFNBQ00sS0FBSztBQUFHLFVBQUFBLE1BQUksTUFBTSxpRUFBaUUsR0FBRztBQUFBLFFBQUc7QUFBQSxNQUNuRztBQUVBLGFBQU8sS0FBSyxPQUFPO0FBQUEsSUFDdkIsQ0FBQztBQVVELFlBQVEsR0FBRyxhQUFhLENBQUMsT0FBTyxTQUFTO0FBQ3JDLFlBQU0sY0FBYyxLQUFLO0FBQ3pCLFlBQU0sV0FBVyxLQUFLO0FBQ3RCLFVBQUksZUFBZSxHQUFHLEtBQUssZ0JBQWdCLFdBQVcsSUFBSTtBQUUxRCxVQUFJLFVBQVM7QUFDVCx1QkFBZSxHQUFHLFFBQVE7QUFBQSxNQUM5QjtBQUVBLFlBQU0sV0FBV0UsTUFBSyxLQUFLLEtBQUssT0FBTyxlQUFlLFlBQVk7QUFFbEUsVUFBSSxhQUFhO0FBRWIsWUFBSTtBQUNBLFVBQUFDLElBQUcsVUFBVSxVQUFVLGFBQWEsQ0FBQyxRQUFRO0FBQ3pDLGdCQUFJLEtBQUs7QUFDTCxjQUFBSCxNQUFJLE1BQU0sMkJBQTJCLElBQUksT0FBTyxFQUFFO0FBRWxELGtCQUFJLGdCQUFnQixHQUFHLFFBQVEsSUFBSSxLQUFLLGdCQUFnQixXQUFXLEtBQUs7QUFDeEUsY0FBQUEsTUFBSSxLQUFLLG9EQUFvRCxhQUFjO0FBQzNFLGNBQUFHLElBQUcsVUFBVSxlQUFlLGFBQWEsU0FBVUMsTUFBSztBQUNwRCxvQkFBSUEsTUFBSztBQUNMLGtCQUFBSixNQUFJLE1BQU1JLEtBQUksT0FBTztBQUNyQixrQkFBQUosTUFBSSxNQUFNLG1DQUFtQztBQUM3Qyx3QkFBTSxNQUFNLGFBQWEsRUFBRSxRQUFRLFVBQVUsU0FBUUksTUFBTSxRQUFPLFFBQVEsQ0FBRTtBQUFBLGdCQUNoRixPQUNLO0FBQ0Qsa0JBQUFKLE1BQUksS0FBSyxrQ0FBa0M7QUFDM0Msd0JBQU0sTUFBTSxjQUFjO0FBQUEsZ0JBQzlCO0FBQUEsY0FDSixDQUFDO0FBQUEsWUFDTDtBQUNBLGtCQUFNLE1BQU0sY0FBYztBQUFBLFVBQzlCLENBQUU7QUFBQSxRQUNOLFNBQ00sS0FBSTtBQUNOLFVBQUFBLE1BQUksTUFBTSxHQUFHO0FBQ2IsZ0JBQU0sY0FBYyxFQUFFLFFBQVEsVUFBVSxTQUFRLEtBQU0sUUFBTyxRQUFRO0FBQUEsUUFDekU7QUFBQSxNQUNKO0FBQUEsSUFDSixDQUFDO0FBT0QsWUFBUSxPQUFPLGdCQUFnQixPQUFPLE9BQU8sU0FBUztBQUNsRCxNQUFBQSxNQUFJLEtBQUssdURBQXVEO0FBQ2hFLFdBQUssZ0JBQWdCLFdBQVcsbUJBQW1CLEtBQUssbUJBQWlCO0FBQ3pFLFVBQUksU0FBUyxNQUFNLEtBQUsscUJBQXFCLGFBQWEsS0FBSyxrQkFBa0IsS0FBSyxhQUFhLEtBQUssZUFBZTtBQUN2SCxhQUFPO0FBQUEsSUFDWCxDQUFDO0FBU0QsWUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLFNBQVM7QUFFcEMsVUFBSSxDQUFDLEtBQUssaUJBQWlCLFlBQVksVUFBUztBQUM1QyxRQUFBQSxNQUFJLEtBQUssMkRBQTJEO0FBQ3BFO0FBQUEsTUFDSjtBQUVBLFVBQUksS0FBSyxlQUFjO0FBQ25CLFFBQUFBLE1BQUksS0FBSyx5RUFBeUU7QUFDbEY7QUFBQSxNQUNKO0FBRUEsVUFBSSxLQUFLLGNBQWMsWUFBVztBQUM5QixjQUFNLFVBQVU7QUFBQTtBQUFBLFVBQ1osU0FBUyxFQUFDLEtBQUksS0FBSyxPQUFNLEdBQUcsUUFBTyxLQUFLLE1BQUssRUFBRTtBQUFBLFVBQy9DLFVBQVU7QUFBQSxVQUNWLGlCQUFpQjtBQUFBLFVBQ2pCLG9CQUFvQjtBQUFBLFVBQ3BCLFdBQVcsS0FBSztBQUFBLFVBQ2hCLHFCQUFvQjtBQUFBLFVBQ3BCLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQixvTEFBb0wsS0FBSyxVQUFVLGdJQUFnSSxLQUFLLFVBQVU7QUFBQSxVQUNsVyxtQkFBbUI7QUFBQSxRQUN2QjtBQUVBLFlBQUksY0FBYyxHQUFHLEtBQUssZ0JBQWdCLFdBQVcsSUFBSTtBQUN6RCxZQUFJLEtBQUssVUFBUztBQUNkLHdCQUFjLEdBQUcsS0FBSyxRQUFRO0FBQUEsUUFFbEM7QUFDQSxjQUFNLGNBQWNFLE1BQUssS0FBSyxLQUFLLE9BQU8sZUFBZSxXQUFXO0FBQ3BFLGNBQU0sb0JBQW9CLEdBQUcsV0FBVztBQUN4QyxjQUFNLDBCQUEwQixHQUFHLFdBQVc7QUFDOUMsY0FBTSxnQkFBZ0JBLE1BQUssS0FBSyxLQUFLLE9BQU8sZUFBZSxpQkFBaUI7QUFJNUUsWUFBSTtBQUNBLGdCQUFNLFFBQVFDLElBQUcsWUFBWSxLQUFLLE9BQU8sYUFBYTtBQUN0RCxnQkFBTSxRQUFRLFVBQVE7QUFDbEIsZ0JBQUksU0FBUyxtQkFBbUI7QUFDNUIsb0JBQU0sVUFBVUQsTUFBSyxLQUFLLEtBQUssT0FBTyxlQUFlLHVCQUF1QjtBQUM1RSxjQUFBQyxJQUFHLFdBQVcsZUFBZSxPQUFPO0FBQUEsWUFDeEM7QUFBQSxVQUNKLENBQUM7QUFBQSxRQUNMLFNBQ00sS0FBSztBQUFFLFVBQUFILE1BQUksTUFBTSwwQkFBMEIsSUFBSSxPQUFPLEVBQUU7QUFBQSxRQUFJO0FBRWxFLGNBQU0sYUFBYSxLQUFLLGNBQWM7QUFDdEMsY0FBTUssZUFBYyxZQUFZO0FBRWhDLFlBQUksQ0FBQ0EsY0FBWTtBQUNiLFVBQUFMLE1BQUksTUFBTSw0REFBNEQ7QUFDdEUsZ0JBQU0sTUFBTSxhQUFhLEVBQUUsUUFBUSxVQUFVLFNBQVEsdUNBQXdDLFFBQU8sUUFBUSxDQUFFO0FBQzlHO0FBQUEsUUFDSjtBQUVBLGFBQUssZ0JBQWdCO0FBR3JCLGNBQU0sV0FBVyxLQUFLLFdBQVcsS0FBSyxXQUFXLEdBQUcsS0FBSyxnQkFBZ0IsV0FBVyxJQUFJLE1BQU0sS0FBSyxjQUFjLEtBQUssZ0JBQWdCLFdBQVcsY0FBYyxFQUFFO0FBRWpLLGNBQU0sZUFBZSxTQUFTLFFBQVEsT0FBTyxNQUFNLEVBQUUsUUFBUSxNQUFNLEtBQUssRUFBRSxRQUFRLE1BQU0sS0FBSztBQUM3RixRQUFBSyxhQUFZLGtCQUFrQixxQkFBcUIsWUFBWSxHQUFHLEVBQUUsS0FBSyxNQUFNO0FBRTNFLGlCQUFPQSxhQUFZLFdBQVcsT0FBTztBQUFBLFFBQ3pDLENBQUMsRUFBRSxLQUFLLFVBQVE7QUFFWixjQUFJO0FBQUUsZ0JBQUlGLElBQUcsV0FBVyxXQUFXLEdBQUc7QUFBRSxjQUFBQSxJQUFHLFdBQVcsV0FBVztBQUFBLFlBQUc7QUFBQSxVQUFDLFNBQy9ELEtBQUs7QUFBRSxZQUFBSCxNQUFJLE1BQU0sMEJBQTBCLElBQUksT0FBTyxFQUFFO0FBQUEsVUFBSTtBQUVsRSxVQUFBRyxJQUFHLFVBQVUsYUFBYSxNQUFNLENBQUMsUUFBUTtBQUNyQyxnQkFBSSxLQUFLO0FBQ0wsY0FBQUgsTUFBSSxLQUFLLDBCQUEwQixJQUFJLE9BQU8sdUJBQXVCLGFBQWEsR0FBRztBQUVyRixrQkFBSTtBQUFFLG9CQUFJRyxJQUFHLFdBQVcsYUFBYSxHQUFHO0FBQUUsa0JBQUFBLElBQUcsV0FBVyxhQUFhO0FBQUEsZ0JBQUc7QUFBQSxjQUFFLFNBQ25FQyxNQUFLO0FBQUUsZ0JBQUFKLE1BQUksTUFBTSw4Q0FBOENJLEtBQUksT0FBTyxFQUFFO0FBQUEsY0FBRztBQUV0RixjQUFBRCxJQUFHLFVBQVUsZUFBZSxNQUFNLENBQUNDLFNBQVE7QUFDdkMsb0JBQUlBLE1BQUs7QUFDTCxrQkFBQUosTUFBSSxNQUFNSSxLQUFJLE9BQU87QUFDckIsa0JBQUFKLE1BQUksTUFBTSxrQ0FBa0M7QUFDNUMsd0JBQU0sTUFBTSxhQUFhLEVBQUUsUUFBUSxVQUFVLFNBQVFJLEtBQUksU0FBVSxRQUFPLFFBQVEsQ0FBRTtBQUFBLGdCQUN4RixPQUNLO0FBQ0Qsc0JBQUksS0FBSyxXQUFXLGtCQUFrQjtBQUFFLHlCQUFLLHFCQUFxQixjQUFjO0FBQUEsa0JBQUU7QUFDbEYsd0JBQU0sTUFBTSxjQUFjO0FBQUEsZ0JBQzlCO0FBQUEsY0FDSixDQUFDO0FBQUEsWUFDTCxPQUNLO0FBQ0Qsa0JBQUksS0FBSyxXQUFXLGtCQUFrQjtBQUFFLHFCQUFLLHFCQUFxQixjQUFjO0FBQUEsY0FBRTtBQUNsRixvQkFBTSxNQUFNLGNBQWM7QUFBQSxZQUM5QjtBQUFBLFVBQ0osQ0FBRTtBQUFBLFFBQ04sQ0FBQyxFQUFFLE1BQU0sV0FBUztBQUNkLFVBQUFKLE1BQUksTUFBTSwwQkFBMEIsTUFBTSxPQUFPLEVBQUU7QUFDbkQsZ0JBQU0sTUFBTSxhQUFhLEVBQUUsUUFBUSxVQUFVLFNBQVEsTUFBTSxTQUFVLFFBQU8sUUFBUSxDQUFFO0FBQUEsUUFDMUYsQ0FBQyxFQUFFLFFBQVEsTUFBTTtBQUNiLGVBQUssZ0JBQWdCO0FBQUEsUUFDekIsQ0FBQztBQUFBLE1BQ0w7QUFBQSxJQUNKLENBQUM7QUFLRCxZQUFRLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxTQUFTO0FBQy9DLFVBQUk7QUFDQSxjQUFNLGNBQWMsS0FBSyxXQUFXLEdBQUcsS0FBSyxRQUFRLFNBQVMsR0FBRyxLQUFLLGdCQUFnQixXQUFXLElBQUk7QUFDcEcsY0FBTSxjQUFjRSxNQUFLLEtBQUssS0FBSyxPQUFPLGVBQWUsV0FBVztBQUdwRSxjQUFNLFdBQVcsS0FBSyxVQUFVLEtBQUssVUFBVSxNQUFNLENBQUM7QUFHdEQsUUFBQUMsSUFBRyxjQUFjLGFBQWEsVUFBVSxNQUFNO0FBQzlDLFFBQUFILE1BQUksS0FBSyx3REFBd0QsV0FBVyxFQUFFO0FBQUEsTUFDbEYsU0FBUyxPQUFPO0FBQ1osUUFBQUEsTUFBSSxNQUFNLHFDQUFxQyxNQUFNLE9BQU8sRUFBRTtBQUM5RCxjQUFNLE1BQU0sYUFBYSxFQUFFLFFBQVEsVUFBVSxTQUFTLE1BQU0sU0FBUyxRQUFRLFFBQVEsQ0FBQztBQUFBLE1BQzFGO0FBQUEsSUFDSixDQUFDO0FBUUQsWUFBUSxPQUFPLGdCQUFnQixPQUFPLFVBQVU7QUFDNUMsVUFBSSxlQUFlO0FBS25CLFVBQUksS0FBSyxjQUFjLFlBQVk7QUFBRSx1QkFBZSxLQUFLLGNBQWMsV0FBVztBQUFBLE1BQWE7QUFHL0YsVUFBSSxDQUFDLEtBQUssZ0JBQWdCLFdBQVcsVUFBUztBQUMxQyxjQUFNLFVBQVVFLE1BQUssS0FBS0gsUUFBTyxlQUFlLEdBQUc7QUFDbkQsWUFBSTtBQUNBLGdCQUFNSSxJQUFHLFNBQVMsTUFBTSxTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDcEQsZ0JBQU0sWUFBWSxNQUFNQSxJQUFHLFNBQVMsUUFBUSxTQUFTLEVBQUUsZUFBZSxLQUFLLENBQUMsR0FDdkUsT0FBTyxZQUFVLE9BQU8sT0FBTyxDQUFDLEVBQ2hDLElBQUksWUFBVSxPQUFPLElBQUk7QUFDOUIsZUFBSyxnQkFBZ0IsV0FBVyxnQkFBZ0IsU0FBUztBQUFBLFFBQzdELFNBQVMsS0FBSztBQUNWLGVBQUssZ0JBQWdCLFdBQVcsZ0JBQWdCO0FBQUEsUUFDcEQ7QUFBQSxNQUNKO0FBSUEsYUFBTztBQUFBLFFBQ0gsWUFBWSxLQUFLLGdCQUFnQjtBQUFBLFFBQ2pDLFlBQVksS0FBSyxnQkFBZ0I7QUFBQSxRQUNqQztBQUFBLE1BQ0o7QUFBQSxJQUNKLENBQUM7QUFRRCxZQUFRLEdBQUcsd0JBQXdCLENBQUMsVUFBVTtBQUMxQyxZQUFNLGFBQWEsS0FBSyxjQUFjO0FBQ3RDLFVBQUksQ0FBQyxZQUFXO0FBQUU7QUFBQSxNQUFPO0FBQ3pCLFlBQU0sY0FBYyxXQUFXLGVBQWUsQ0FBQztBQUMvQyxrQkFBWSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsUUFBUSxFQUFFLENBQUM7QUFBQSxJQUU3RCxDQUFDO0FBQ0QsWUFBUSxHQUFHLHVCQUF1QixDQUFDLFVBQVU7QUFDekMsWUFBTSxhQUFhLEtBQUssY0FBYztBQUN0QyxVQUFJLENBQUMsWUFBVztBQUFFO0FBQUEsTUFBTztBQUN6QixZQUFNLGFBQWEsV0FBVztBQUM5QixZQUFNLFlBQVksV0FBVyxVQUFVO0FBQ3ZDLFlBQU0sY0FBYyxXQUFXLGVBQWUsQ0FBQztBQUUvQyxrQkFBWSxVQUFVO0FBQUEsUUFDbEIsR0FBRztBQUFBLFFBQ0gsR0FBRztBQUFBLFFBQ0gsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUNqQixRQUFRLFVBQVUsU0FBUztBQUFBO0FBQUEsTUFDL0IsQ0FBQztBQUFBLElBQ0wsQ0FBQztBQUtELFlBQVEsR0FBRyxzQkFBc0IsQ0FBQyxPQUFPLFdBQVc7QUFDaEQsWUFBTSxhQUFhLEtBQUssY0FBYztBQUN0QyxVQUFJLGNBQWMsU0FBUyxHQUFHO0FBRTFCLG1CQUFXLGFBQWE7QUFHeEIsY0FBTSxZQUFZLFdBQVcsVUFBVTtBQUN2QyxjQUFNLGNBQWMsV0FBVyxlQUFlLENBQUM7QUFDL0MsWUFBSSxhQUFhO0FBQ2Isc0JBQVksVUFBVTtBQUFBLFlBQ2xCLEdBQUc7QUFBQSxZQUNILEdBQUc7QUFBQSxZQUNILE9BQU8sVUFBVTtBQUFBLFlBQ2pCLFFBQVEsVUFBVSxTQUFTO0FBQUEsVUFDL0IsQ0FBQztBQUFBLFFBQ0w7QUFBQSxNQUNKO0FBQUEsSUFDSixDQUFDO0FBUUQsWUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLFNBQVM7QUFDcEMsWUFBTSxhQUFhLEtBQUs7QUFDeEIsWUFBTSxNQUFNLEtBQUs7QUFDakIsWUFBTSxXQUFXLEtBQUs7QUFDdEIsWUFBTSxhQUFhLEtBQUs7QUFDeEIsWUFBTSxXQUFXLEdBQUcsUUFBUTtBQUM1QixZQUFNLFdBQVdHLElBQUcsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxPQUFPO0FBQzVCLFlBQU0sWUFBWSxLQUFLO0FBRXZCLFVBQUksS0FBSyxnQkFBZ0IsV0FBVyxPQUFNO0FBQ3RDLGNBQU0sY0FBYyxFQUFFLFFBQVEsVUFBVSxTQUFTLEVBQUUsMkJBQTJCLEdBQUcsUUFBTyxRQUFRO0FBQUEsTUFDcEc7QUFJQSxZQUFNLE1BQU0sV0FBVyxRQUFRLElBQUksS0FBSyxPQUFPLGFBQWEsa0NBQWtDLFVBQVUsSUFBSSxHQUFHLElBQUksVUFBVSxJQUFJLFFBQVEsSUFBSSxRQUFRLElBQUksT0FBTyxJQUFJLFNBQVM7QUFDN0ssWUFBTSxTQUFTLFlBQVksUUFBUSxHQUFJO0FBR3ZDLFlBQU0sS0FBSyxFQUFFLFFBQVEsT0FBTyxPQUFPLENBQUMsRUFDbkMsS0FBSyxjQUFZLFNBQVMsS0FBSyxDQUFDLEVBQ2hDLEtBQUssVUFBUTtBQUNWLFlBQUksUUFBUSxLQUFLLFVBQVUsV0FBVztBQUVsQyxlQUFLLGdCQUFnQixXQUFXLE9BQU87QUFDdkMsZUFBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLGVBQUssZ0JBQWdCLFdBQVcsYUFBYTtBQUM3QyxlQUFLLGdCQUFnQixXQUFXLEtBQUs7QUFDckMsZUFBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLGVBQUssZ0JBQWdCLFdBQVcsUUFBUSxLQUFLO0FBQzdDLGVBQUssZ0JBQWdCLFdBQVcsUUFBUTtBQUN4QyxlQUFLLGdCQUFnQixXQUFXLE1BQU07QUFFdEMsVUFBQU4sTUFBSSxLQUFLLHFEQUFxRCxVQUFVLE1BQU0sUUFBUSxPQUFPLFVBQVUsRUFBRTtBQUN6RyxnQkFBTSxjQUFjO0FBR3BCLGNBQUksaUJBQWlCLEdBQUcsVUFBVSxJQUFJLEdBQUc7QUFDekMsVUFBQUQsUUFBTyxnQkFBZ0JHLE1BQUssS0FBS0gsUUFBTyxlQUFlLGNBQWM7QUFDckUsY0FBSSxDQUFDSSxJQUFHLFdBQVdKLFFBQU8sYUFBYSxHQUFFO0FBQUUsWUFBQUksSUFBRyxVQUFVSixRQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFVBQUc7QUFBQSxRQUN4RyxPQUNLO0FBQ0QsY0FBSSxLQUFLLFNBQVE7QUFFYixrQkFBTSxtQkFBbUIsS0FBSyxnQkFBZ0JBLFFBQU8sU0FBU0EsUUFBTyxNQUFPLEtBQUssU0FBUyxLQUFLLFdBQVk7QUFDM0csZ0JBQUksbUJBQW1CLEdBQUc7QUFBUSxvQkFBTSxjQUFjLEVBQUUsUUFBUSxTQUFTLFNBQVMsK0RBQStEO0FBQUEsWUFBSyxXQUM3SSxtQkFBbUIsR0FBRztBQUFHLG9CQUFNLGNBQWMsRUFBRSxRQUFRLFNBQVMsU0FBUyx3RkFBd0Y7QUFBQSxZQUFLLE9BQzFLO0FBQTZCLG9CQUFNLGNBQWMsRUFBRSxRQUFRLFNBQVMsU0FBUyw2Q0FBNkM7QUFBQSxZQUFNO0FBQUEsVUFDekk7QUFDQSxnQkFBTSxjQUFjLEVBQUUsUUFBUSxTQUFTLFNBQVMsS0FBSyxRQUFRO0FBQUEsUUFDakU7QUFBQSxNQUNKLENBQUMsRUFDQSxNQUFNLE9BQU0sVUFBUztBQUVsQixZQUFJLGVBQWUsTUFBTTtBQUN6QixZQUFJLE1BQU0sU0FBUyxjQUFjO0FBQUUseUJBQWU7QUFBQSxRQUEyQjtBQUM3RSxRQUFBQyxNQUFJLE1BQU0sMEJBQTBCLFlBQVksRUFBRTtBQUlsRCxZQUFJLFFBQVEsYUFBYSxVQUFTO0FBQzlCLGNBQUksV0FBVyxNQUFNLHFCQUFxQixVQUFVLEtBQUssT0FBTyxhQUFhO0FBQzdFLGNBQUksWUFBWSxhQUFhLFNBQVM7QUFDbEMsWUFBQU8sS0FBSSxLQUFLO0FBQ1Q7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUdBLGNBQU0sY0FBYyxFQUFFLFFBQVEsVUFBVSxTQUFTLDZKQUE2SixRQUFRLFFBQVE7QUFDOU47QUFBQSxNQUdKLENBQUM7QUFBQSxJQUNMLENBQUM7QUFXRCxZQUFRLE9BQU8sV0FBVyxDQUFDLE9BQU8sU0FBUztBQUN2QyxZQUFNLFVBQVUsS0FBSztBQUNyQixZQUFNLFdBQVcsS0FBSztBQUN0QixZQUFNLFNBQVMsS0FBSztBQUNwQixZQUFNLGNBQWNMLE1BQUssS0FBSyxLQUFLLE9BQU8sZUFBZSxRQUFRO0FBQ2pFLFVBQUksU0FBUztBQUVULGNBQU0sV0FBVyxPQUFPLEtBQUssU0FBUyxRQUFRO0FBRTlDLFlBQUk7QUFDQSxVQUFBQyxJQUFHLGNBQWMsYUFBYSxRQUFRO0FBQ3RDLGNBQUksV0FBVyxrQkFBa0I7QUFBRSxpQkFBSyxxQkFBcUIsY0FBYztBQUFBLFVBQUU7QUFDN0UsaUJBQVEsRUFBRSxRQUFRLFVBQVUsU0FBUSxFQUFFLGlCQUFpQixHQUFJLFFBQU8sVUFBVTtBQUFBLFFBQ2hGLFNBQ00sS0FBSTtBQUNOLGVBQUssY0FBYyxXQUFXLFlBQVksS0FBSyxhQUFhLEdBQUc7QUFFL0QsVUFBQUgsTUFBSSxNQUFNLHlCQUF5QixHQUFHLEVBQUU7QUFDeEMsaUJBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxLQUFNLFFBQU8sUUFBUTtBQUFBLFFBQzVEO0FBQUEsTUFDSjtBQUFBLElBQ0osQ0FBQztBQVFELFlBQVEsT0FBTyxXQUFXLENBQUMsT0FBTyxhQUFhO0FBQzNDLFlBQU0sY0FBY0UsTUFBSyxLQUFLLEtBQUssT0FBTyxlQUFlLFFBQVE7QUFDakUsVUFBSTtBQUVBLGNBQU0sV0FBV0MsSUFBRyxhQUFhLFdBQVc7QUFDNUMsY0FBTSxnQkFBZ0IsU0FBUyxTQUFTLFFBQVE7QUFDaEQsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFRLGVBQWUsUUFBTyxVQUFVO0FBQUEsTUFDdkUsU0FDTyxPQUFPO0FBQ1YsZUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFTLE9BQVEsUUFBTyxRQUFRO0FBQUEsTUFDL0Q7QUFBQSxJQUNKLENBQUM7QUFVRCxZQUFRLE9BQU8sZUFBZSxDQUFDLE9BQU8sVUFBVSxRQUFRLFVBQVU7QUFDOUQsWUFBTSxVQUFVRCxNQUFLLEtBQUtILFFBQU8sZUFBYyxHQUFHO0FBQ2xELFVBQUksVUFBVTtBQUNWLFlBQUksV0FBV0csTUFBSyxLQUFLLFNBQVEsUUFBUTtBQUN6QyxZQUFJO0FBQ0EsY0FBSSxPQUFPQyxJQUFHLGFBQWEsUUFBUTtBQUVuQyxjQUFJLE9BQU07QUFBRSxtQkFBTyxLQUFLLFNBQVMsUUFBUTtBQUFBLFVBQUk7QUFDN0MsaUJBQU87QUFBQSxRQUNYLFNBQ08sT0FBTztBQUNWLGlCQUFPLEVBQUUsUUFBUSxVQUFVLFNBQVMsT0FBUSxRQUFPLFFBQVE7QUFBQSxRQUMvRDtBQUFBLE1BQ0o7QUFBQSxJQUNKLENBQUM7QUFLRCxZQUFRLE9BQU8sZ0JBQWdCLE9BQU8sT0FBTyxVQUFVLFlBQVUsVUFBVTtBQUN2RSxZQUFNLFVBQVVELE1BQUssS0FBS0gsUUFBTyxlQUFlLEdBQUc7QUFFbkQsVUFBSSxZQUFZLENBQUMsV0FBVztBQUN4QixZQUFJLFdBQVdHLE1BQUssS0FBSyxTQUFTLFFBQVE7QUFDMUMsY0FBTSxZQUFZQyxJQUFHLGFBQWEsUUFBUTtBQUMxQyxlQUFPLFVBQVUsU0FBUyxRQUFRO0FBQUEsTUFDdEM7QUFFQSxVQUFJLFlBQVksV0FBVztBQUN2QixjQUFNSyxjQUFhLDJCQUFtQjtBQUN0QyxZQUFJLFdBQVdOLE1BQUssS0FBS00sYUFBWSxRQUFRO0FBQzdDLGNBQU0sWUFBWUwsSUFBRyxhQUFhLFFBQVE7QUFDMUMsZUFBTyxVQUFVLFNBQVMsUUFBUTtBQUFBLE1BQ3RDO0FBRUEsYUFBTztBQUFBLElBQ1gsQ0FBQztBQU9ELFlBQVEsT0FBTyxpQkFBaUIsT0FBTyxPQUFPLFVBQVUsUUFBTSxPQUFPLE9BQUssVUFBVTtBQUNoRixZQUFNLFVBQVVELE1BQUssS0FBS0gsUUFBTyxlQUFjLEdBQUc7QUFFbEQsVUFBSSxVQUFVO0FBR1YsWUFBSSxXQUFXRyxNQUFLLEtBQUssU0FBUSxRQUFRO0FBRXpDLFlBQUksU0FBUyxNQUFLO0FBQ2QsZ0JBQU0sWUFBWUMsSUFBRyxhQUFhLFFBQVE7QUFDMUMsaUJBQU8sVUFBVSxTQUFTLFFBQVE7QUFBQSxRQUN0QyxXQUNTLE1BQUs7QUFDVixjQUFJLFNBQVMsTUFBTSxRQUFRLGNBQWMsRUFBQyxNQUFNLFNBQVEsQ0FBQyxFQUN4RCxLQUFLLENBQUMsU0FBUztBQUNaLG1CQUFPO0FBQUEsVUFDWCxDQUFDLEVBQ0EsTUFBTSxTQUFTLE9BQU87QUFDbkIsb0JBQVEsTUFBTSxLQUFLO0FBQUEsVUFDdkIsQ0FBQztBQUNELGlCQUFPO0FBQUEsUUFDWCxPQUNLO0FBQ0QsY0FBSTtBQUNBLGdCQUFJLE9BQU9BLElBQUcsYUFBYSxVQUFVLE1BQU07QUFDM0MsbUJBQU87QUFBQSxVQUNYLFNBQ08sS0FBSztBQUNSLFlBQUFILE1BQUksTUFBTSwrQkFBK0IsR0FBRyxFQUFFO0FBQzlDLG1CQUFPO0FBQUEsVUFDWDtBQUFBLFFBQ0o7QUFBQSxNQUNKLE9BQ0s7QUFDRCxZQUFJO0FBQ0EsY0FBSSxDQUFDRyxJQUFHLFdBQVcsT0FBTyxHQUFFO0FBQUUsWUFBQUEsSUFBRyxVQUFVLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFVBQUk7QUFDM0UsY0FBSSxXQUFZQSxJQUFHLFlBQVksU0FBUyxFQUFFLGVBQWUsS0FBSyxDQUFDLEVBQzFELE9BQU8sWUFBVSxPQUFPLE9BQU8sQ0FBQyxFQUNoQyxJQUFJLFlBQVUsT0FBTyxJQUFJO0FBRzlCLGNBQUksUUFBUSxDQUFDO0FBQ2IsbUJBQVMsUUFBUyxVQUFRO0FBQ3RCLGdCQUFJLFdBQVdBLElBQUcsU0FBWUQsTUFBSyxLQUFLLFNBQVEsSUFBSSxDQUFHLEVBQUU7QUFDekQsZ0JBQUksTUFBTSxTQUFTLFFBQVE7QUFDM0IsZ0JBQUtBLE1BQUssUUFBUSxJQUFJLEVBQUUsWUFBWSxNQUFNLFFBQU87QUFBRSxvQkFBTSxLQUFNLEVBQUMsTUFBTSxNQUFNLE1BQU0sT0FBTyxJQUFRLENBQUM7QUFBQSxZQUFJLFdBQzVGQSxNQUFLLFFBQVEsSUFBSSxFQUFFLFlBQVksTUFBTSxRQUFPO0FBQUUsb0JBQU0sS0FBTSxFQUFDLE1BQU0sTUFBTSxNQUFNLE9BQU8sSUFBUSxDQUFDO0FBQUEsWUFBSSxXQUNqR0EsTUFBSyxRQUFRLElBQUksRUFBRSxZQUFZLE1BQU0sU0FBUTtBQUFFLG9CQUFNLEtBQU0sRUFBQyxNQUFNLE1BQU0sTUFBTSxRQUFRLElBQVEsQ0FBQztBQUFBLFlBQUksV0FDbkdBLE1BQUssUUFBUSxJQUFJLEVBQUUsWUFBWSxNQUFNLFFBQU87QUFBRSxvQkFBTSxLQUFNLEVBQUMsTUFBTSxNQUFNLE1BQU0sT0FBTyxJQUFRLENBQUM7QUFBQSxZQUFJLFdBQ2pHQSxNQUFLLFFBQVEsSUFBSSxFQUFFLFlBQVksTUFBTSxVQUFVQSxNQUFLLFFBQVEsSUFBSSxFQUFFLFlBQVksTUFBTSxVQUFVQSxNQUFLLFFBQVEsSUFBSSxFQUFFLFlBQVksTUFBTSxRQUFRO0FBQUUsb0JBQU0sS0FBTSxFQUFDLE1BQU0sTUFBTSxNQUFNLFNBQVMsSUFBUSxDQUFDO0FBQUEsWUFBSSxXQUNsTUEsTUFBSyxRQUFRLElBQUksRUFBRSxZQUFZLE1BQU0sVUFBVUEsTUFBSyxRQUFRLElBQUksRUFBRSxZQUFZLE1BQU0sVUFBVUEsTUFBSyxRQUFRLElBQUksRUFBRSxZQUFZLE1BQU0sUUFBUTtBQUFFLG9CQUFNLEtBQU0sRUFBQyxNQUFNLE1BQU0sTUFBTSxTQUFTLElBQVEsQ0FBQztBQUFBLFlBQUk7QUFBQSxVQUNoTixDQUFDO0FBQ0QsZUFBSyxnQkFBZ0IsV0FBVyxnQkFBZ0IsU0FBUztBQUN6RCxpQkFBTztBQUFBLFFBQ1gsU0FDTyxLQUFLO0FBQ1IsVUFBQUYsTUFBSSxNQUFNLCtCQUErQixHQUFHLEVBQUU7QUFDOUMsaUJBQU87QUFBQSxRQUNYO0FBQUEsTUFDSjtBQUFBLElBQ0osQ0FBQztBQVFELFlBQVEsT0FBTyxpQkFBaUIsT0FBTyxPQUFPLGFBQWE7QUFDdkQsTUFBQUEsTUFBSSxLQUFLLDhEQUE4RCxRQUFRLEVBQUU7QUFDakYsWUFBTSxVQUFVRSxNQUFLLEtBQUtILFFBQU8sZUFBYyxHQUFHO0FBQ2xELFVBQUksVUFBVTtBQUNWLFlBQUksV0FBV0csTUFBSyxLQUFLLFNBQVEsUUFBUTtBQUN6QyxRQUFBRixNQUFJLEtBQUssK0NBQStDLFFBQVEsRUFBRTtBQUNsRSxZQUFJO0FBQ0EsY0FBSSxDQUFDRyxJQUFHLFdBQVcsUUFBUSxHQUFFO0FBQ3pCLFlBQUFILE1BQUksS0FBSyxzREFBc0QsUUFBUSxFQUFFO0FBQ3pFLG1CQUFPO0FBQUEsVUFDWDtBQUNBLFVBQUFBLE1BQUksS0FBSyxpRUFBaUU7QUFDMUUsY0FBSSxPQUFPRyxJQUFHLGFBQWEsVUFBVSxNQUFNO0FBQzNDLFVBQUFILE1BQUksS0FBSyw4RUFBOEUsS0FBSyxNQUFNLEVBQUU7QUFDcEcsaUJBQU87QUFBQSxRQUNYLFNBQ08sS0FBSztBQUNSLFVBQUFBLE1BQUksTUFBTSwwREFBMEQsR0FBRyxFQUFFO0FBQ3pFLFVBQUFBLE1BQUksTUFBTSw0Q0FBNEMsSUFBSSxLQUFLLEVBQUU7QUFDakUsaUJBQU87QUFBQSxRQUNYO0FBQUEsTUFDSixPQUNLO0FBQ0QsUUFBQUEsTUFBSSxLQUFLLGtEQUFrRDtBQUMzRCxlQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0osQ0FBQztBQUVELFlBQVEsR0FBRyxjQUFjLENBQUMsVUFBVTtBQUNoQyxXQUFLLGNBQWMsZ0JBQWdCO0FBQUEsSUFDdkMsQ0FBQztBQUtELFlBQVEsR0FBRyxvQkFBb0IsQ0FBQyxVQUFVO0FBQ3RDLFdBQUssZ0JBQWdCLFdBQVcsZUFBZTtBQUMvQyxZQUFNLGNBQWM7QUFBQSxJQUN4QixDQUFDO0FBRUQsWUFBUSxHQUFHLGdCQUFnQixDQUFDLFVBQVU7QUFDbEMsWUFBTSxjQUFjLEtBQUssaUJBQWlCO0FBQUEsSUFDOUMsQ0FBQztBQUlELFlBQVEsT0FBTyxpQkFBaUIsT0FBTyxVQUFVO0FBQzdDLFlBQU0sV0FBVyxNQUFNLFlBQVk7QUFDbkMsYUFBTztBQUFBLElBQ1gsQ0FBQztBQUtELFlBQVEsT0FBTyxvQkFBb0IsT0FBTyxPQUFPLGdCQUFpQjtBQUM5RCxVQUFJO0FBRUEsY0FBTUYsY0FBWSxZQUFZO0FBRTlCLFlBQUk7QUFDSixrQkFBVUksTUFBSyxLQUFLLDJCQUFtQixZQUFZLFdBQVc7QUFFOUQsWUFBSSxDQUFDQyxJQUFHLFdBQVcsT0FBTyxHQUFHO0FBQ3pCLFVBQUFILE1BQUksS0FBSyxvREFBb0QsT0FBTyxFQUFFO0FBQ3RFLGlCQUFPO0FBQUEsUUFDWDtBQUVBLGNBQU0sU0FBU0csSUFBRyxhQUFhLE9BQU87QUFDdEMsZUFBTyxPQUFPLFNBQVMsUUFBUTtBQUFBLE1BQ25DLFNBQVMsT0FBTztBQUNaLFFBQUFILE1BQUksTUFBTSx5Q0FBeUMsTUFBTSxPQUFPLElBQUksS0FBSztBQUN6RSxlQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0osQ0FBQztBQUFBLEVBR0w7QUFBQSxFQUVBLG1CQUFtQjtBQUNmLFVBQU0sVUFBVTtBQUNoQixVQUFNLGdCQUFnQixZQUFVO0FBQzVCLE1BQUFBLE1BQUksS0FBSyxvREFBb0QsTUFBTSxFQUFFO0FBQ3JFLGFBQU87QUFBQSxJQUNYO0FBR0EsUUFBSSxRQUFRLGFBQWEsU0FBUztBQUNoQyxVQUFJO0FBQ0YsY0FBTSxVQUFVLGFBQWEsaUJBQWlCLE1BQU07QUFDcEQsWUFBSSwwQkFBMEIsS0FBSyxPQUFPLEVBQUcsUUFBTyxjQUFjLGtDQUFrQztBQUFBLE1BQ3RHLFFBQVE7QUFBQSxNQUFDO0FBRVQsVUFBSTtBQUNGLGNBQU0sUUFBUTtBQUFBLFVBQ1o7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFDQSxjQUFNLE1BQU0sTUFBTSxJQUFJLE9BQUs7QUFBRSxjQUFJO0FBQUUsbUJBQU8sYUFBYSxHQUFHLE1BQU07QUFBQSxVQUFFLFFBQVE7QUFBRSxtQkFBTztBQUFBLFVBQUc7QUFBQSxRQUFFLENBQUMsRUFBRSxLQUFLLEdBQUc7QUFDbkcsWUFBSSxRQUFRLEtBQUssR0FBRyxFQUFHLFFBQU8sY0FBYyxrQkFBa0I7QUFBQSxNQUNoRSxRQUFRO0FBQUEsTUFBQztBQUVULFVBQUk7QUFDRixpQkFBUywwQkFBMEIsRUFBRSxPQUFPLFNBQVMsQ0FBQztBQUN0RCxlQUFPLGNBQWMsNENBQTRDO0FBQUEsTUFDbkUsUUFBUTtBQUFBLE1BQUM7QUFJVCxVQUFJO0FBQ0YsY0FBTSxLQUFLLFNBQVMseUJBQXlCLEVBQUUsVUFBVSxPQUFPLENBQUM7QUFDakUsWUFBSSxHQUFHLFNBQVMsTUFBTSxLQUFLLENBQUMsR0FBRyxTQUFTLE1BQU0sR0FBRztBQUMvQyxpQkFBTyxjQUFjLHVCQUFvQjtBQUFBLFFBQzNDO0FBQUEsTUFDRixRQUFRO0FBQUEsTUFBQztBQUFBLElBQ1g7QUFHQSxRQUFJLFFBQVEsYUFBYSxTQUFTO0FBQzlCLFVBQUk7QUFDSixjQUFNLEtBQ0Y7QUFDSixjQUFNLFFBQVEsU0FBUyxJQUFJLEVBQUUsVUFBVSxPQUFPLENBQUMsRUFBRSxLQUFLO0FBQ3RELFlBQUksUUFBUSxLQUFLLEtBQUssRUFBRyxRQUFPLGNBQWMsdUNBQXVDO0FBQUEsTUFDckYsUUFBUTtBQUFBLE1BQUM7QUFFVCxVQUFJO0FBQ0osY0FBTSxXQUNGO0FBTUosY0FBTSxTQUFTLFNBQVMsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDLEVBQUUsS0FBSztBQUM3RCxZQUFJLFFBQVEsS0FBSyxNQUFNLEVBQUcsUUFBTyxjQUFjLDRDQUE0QztBQUFBLE1BQzNGLFFBQVE7QUFBQSxNQUFDO0FBR1QsVUFBSTtBQUNBLGNBQU0sZ0JBQWdCLFNBQVMscUNBQXFDLEVBQUUsVUFBVSxPQUFPLENBQUM7QUFDeEYsWUFBSSxjQUFjLFNBQVMsTUFBTSxFQUFHLFFBQU8sY0FBYyw0QkFBNEI7QUFBQSxNQUN6RixRQUFRO0FBQUEsTUFBQztBQUFBLElBQ2I7QUFJQSxRQUFJLFFBQVEsYUFBYSxVQUFVO0FBQy9CLFVBQUk7QUFDSixjQUFNLFVBQVUsU0FBUyxzQkFBc0IsRUFBRSxVQUFVLE9BQU8sQ0FBQztBQUNuRSxZQUFJLFlBQVksS0FBSyxPQUFPLEtBQUssUUFBUSxLQUFLLE9BQU8sRUFBRyxRQUFPLGNBQWMsb0NBQW9DO0FBQUEsTUFDakgsUUFBUTtBQUFBLE1BQUM7QUFFVCxVQUFJO0FBQ0osY0FBTSxLQUFLLFNBQVMsc0NBQXNDLEVBQUUsVUFBVSxPQUFPLENBQUM7QUFDOUUsWUFBSSxRQUFRLEtBQUssRUFBRSxFQUFHLFFBQU8sY0FBYyx3Q0FBd0M7QUFBQSxNQUNuRixRQUFRO0FBQUEsTUFBQztBQUFBLElBQ2I7QUFFQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsZ0JBQWdCLFVBQVUsVUFBVTtBQUNoQyxVQUFNLFNBQVMsU0FBUyxNQUFNLEdBQUcsRUFBRSxJQUFJLE1BQU07QUFDN0MsVUFBTSxTQUFTLFNBQVMsTUFBTSxHQUFHLEVBQUUsSUFBSSxNQUFNO0FBRTdDLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxJQUFJLE9BQU8sUUFBUSxPQUFPLE1BQU0sR0FBRyxLQUFLO0FBQzdELFlBQU0sT0FBTyxPQUFPLENBQUMsS0FBSztBQUMxQixZQUFNLE9BQU8sT0FBTyxDQUFDLEtBQUs7QUFFMUIsVUFBSSxPQUFPLEtBQU0sUUFBTztBQUN4QixVQUFJLE9BQU8sS0FBTSxRQUFPO0FBQUEsSUFDNUI7QUFDQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsc0JBQXNCLFNBQVMsU0FBUztBQUNwQyxVQUFNLFVBQVUsU0FBUyxRQUFRLE1BQU0sS0FBSyxHQUFHLEVBQUUsS0FBSztBQUN0RCxVQUFNLFVBQVUsU0FBUyxRQUFRLE1BQU0sS0FBSyxHQUFHLEVBQUUsS0FBSztBQUV0RCxRQUFJLFVBQVUsUUFBUyxRQUFPO0FBQzlCLFFBQUksVUFBVSxRQUFTLFFBQU87QUFDOUIsV0FBTztBQUFBLEVBQ1g7QUFBQSxFQUVBLGdCQUFnQixVQUFVLFNBQVMsVUFBVSxTQUFTO0FBQ2xELFVBQU0sb0JBQW9CLEtBQUssZ0JBQWdCLFVBQVUsUUFBUTtBQUNqRSxRQUFJLHNCQUFzQixFQUFHLFFBQU87QUFFcEMsV0FBTyxLQUFLLHNCQUFzQixTQUFTLE9BQU87QUFBQSxFQUN0RDtBQUdKO0FBRUEsSUFBTyxxQkFBUSxJQUFJLFdBQVc7OztBRHZ6QzlCLE9BQU9TLFdBQVM7QUFFaEIsT0FBTyxlQUFlO0FBQ3RCLE9BQU8sWUFBWTtBQUVuQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxnQkFBZ0I7QUFDdkIsU0FBUyxjQUFjOzs7QVVsQ3ZCLFNBQVMsUUFBQUMsYUFBWTtBQUNyQixTQUFTLGFBQUFDLGtCQUFpQjtBQUUxQixJQUFNQyxhQUFZRCxXQUFVRCxLQUFJO0FBRWhDLElBQU0scUJBQXFCO0FBQUEsRUFDekI7QUFBQSxFQUFjO0FBQUEsRUFBVztBQUFBLEVBQVk7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVc7QUFBQSxFQUFTO0FBQUEsRUFDeEU7QUFBQSxFQUF1QjtBQUFBLEVBQWE7QUFBQSxFQUNwQztBQUFBLEVBQVc7QUFBQSxFQUFpQjtBQUFBLEVBQVE7QUFBQSxFQUFZO0FBQUEsRUFDaEQ7QUFBQSxFQUFtQjtBQUFBLEVBQVU7QUFBQSxFQUFXO0FBQUEsRUFBbUI7QUFBQSxFQUFvQjtBQUNqRjtBQUVBLElBQU0sa0JBQWtCO0FBQUEsRUFDdEI7QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUNwQztBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFPO0FBQ25EO0FBRUEsZUFBZSxpQkFBaUI7QUFDOUIsUUFBTSxnQkFBZ0IsQ0FBQztBQUV2QixNQUFJO0FBRUYsVUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNRSxXQUFVLG9CQUFvQjtBQUFBLE1BQ3JELFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQTtBQUFBLE1BQ1QsV0FBVyxPQUFPLE9BQU87QUFBQTtBQUFBLElBQzNCLENBQUM7QUFFRCxVQUFNLE1BQU0sT0FBTyxZQUFZO0FBRS9CLGVBQVcsV0FBVyxvQkFBb0I7QUFDeEMsVUFBSSxJQUFJLFNBQVMsT0FBTyxHQUFHO0FBQ3pCLHNCQUFjLEtBQUssT0FBTztBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNULFNBQVMsT0FBTztBQUNkLFdBQU8sQ0FBQztBQUFBLEVBQ1Y7QUFDRjtBQUVBLGVBQWUsYUFBYTtBQUMxQixRQUFNLGFBQWEsQ0FBQztBQUVwQixNQUFJO0FBRUYsVUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNQSxXQUFVLGdCQUFnQjtBQUFBLE1BQ2pELFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQTtBQUFBLE1BQ1QsV0FBVyxPQUFPLE9BQU87QUFBQTtBQUFBLElBQzNCLENBQUM7QUFFRCxlQUFXLFFBQVEsaUJBQWlCO0FBR2xDLFlBQU0sUUFBUSxJQUFJLE9BQU8sSUFBSSxJQUFJLE9BQU8sR0FBRztBQUMzQyxVQUFJLE1BQU0sS0FBSyxNQUFNLEdBQUc7QUFDdEIsbUJBQVcsS0FBSyxJQUFJO0FBQUEsTUFDdEI7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1QsU0FBUyxPQUFPO0FBQ2QsV0FBTyxDQUFDO0FBQUEsRUFDVjtBQUNGO0FBRUEsZUFBc0IsaUJBQWlCO0FBQ3JDLE1BQUk7QUFFRixVQUFNLENBQUMsZUFBZSxVQUFVLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxNQUNwRCxlQUFlO0FBQUEsTUFDZixXQUFXO0FBQUEsSUFDYixDQUFDO0FBRUQsUUFBSSxjQUFjLFdBQVcsS0FBSyxXQUFXLFdBQVcsR0FBRztBQUN6RCxhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQTtBQUFBLE1BQ0wsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGLFNBQVMsT0FBTztBQUNkLFdBQU87QUFBQSxFQUNUO0FBQ0Y7OztBQ3ZGQSxTQUFTLFFBQUFDLGFBQVk7QUFDckIsU0FBUyxhQUFBQyxrQkFBaUI7QUFFMUIsSUFBTUMsYUFBWUQsV0FBVUQsS0FBSTtBQUVoQyxJQUFNRyxzQkFBcUI7QUFBQSxFQUN6QjtBQUFBLEVBQWM7QUFBQSxFQUFXO0FBQUEsRUFBWTtBQUFBLEVBQU87QUFBQSxFQUFRO0FBQUEsRUFBVztBQUFBLEVBQVE7QUFBQSxFQUN2RTtBQUFBLEVBQXVCO0FBQUEsRUFBYTtBQUFBLEVBQ3BDO0FBQUEsRUFBVztBQUFBLEVBQWlCO0FBQUEsRUFBUTtBQUFBLEVBQVk7QUFBQSxFQUNoRDtBQUFBLEVBQW1CO0FBQUEsRUFBVTtBQUFBLEVBQVc7QUFBQSxFQUFtQjtBQUFBLEVBQW9CO0FBQ2pGO0FBRUEsSUFBTUMsbUJBQWtCO0FBQUEsRUFDdEI7QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUNwQztBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFPO0FBQ25EO0FBRUEsZUFBZUMsa0JBQWlCO0FBQzlCLFFBQU0sZ0JBQWdCLENBQUM7QUFFdkIsTUFBSTtBQUNGLFVBQU0sRUFBRSxPQUFPLElBQUksTUFBTUgsV0FBVSxVQUFVO0FBQUEsTUFDM0MsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBO0FBQUEsTUFDVCxXQUFXLE9BQU8sT0FBTztBQUFBO0FBQUEsSUFDM0IsQ0FBQztBQUVELFVBQU0sTUFBTSxPQUFPLFlBQVk7QUFFL0IsZUFBVyxXQUFXQyxxQkFBb0I7QUFDeEMsVUFBSSxJQUFJLFNBQVMsT0FBTyxHQUFHO0FBQ3pCLHNCQUFjLEtBQUssT0FBTztBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNULFNBQVMsT0FBTztBQUNkLFdBQU8sQ0FBQztBQUFBLEVBQ1Y7QUFDRjtBQUVBLGVBQWVHLGNBQWE7QUFDMUIsUUFBTSxhQUFhLENBQUM7QUFFcEIsTUFBSTtBQUNGLFVBQU0sRUFBRSxPQUFPLElBQUksTUFBTUosV0FBVSxpQkFBaUI7QUFBQSxNQUNsRCxVQUFVO0FBQUEsTUFDVixTQUFTO0FBQUE7QUFBQSxNQUNULFdBQVcsT0FBTyxPQUFPO0FBQUE7QUFBQSxJQUMzQixDQUFDO0FBRUQsVUFBTSxNQUFNLE9BQU8sWUFBWTtBQUUvQixlQUFXLFFBQVFFLGtCQUFpQjtBQUdsQyxZQUFNLFlBQVksSUFBSSxPQUFPLElBQUksSUFBSSxvQkFBb0IsR0FBRztBQUM1RCxVQUFJLFVBQVUsS0FBSyxHQUFHLEdBQUc7QUFDdkIsbUJBQVcsS0FBSyxJQUFJO0FBQUEsTUFDdEI7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1QsU0FBUyxPQUFPO0FBQ2QsV0FBTyxDQUFDO0FBQUEsRUFDVjtBQUNGO0FBRUEsZUFBc0JHLGtCQUFpQjtBQUNyQyxNQUFJO0FBRUYsVUFBTSxDQUFDLGVBQWUsVUFBVSxJQUFJLE1BQU0sUUFBUSxJQUFJO0FBQUEsTUFDcERGLGdCQUFlO0FBQUEsTUFDZkMsWUFBVztBQUFBLElBQ2IsQ0FBQztBQUVELFFBQUksY0FBYyxXQUFXLEtBQUssV0FBVyxXQUFXLEdBQUc7QUFDekQsYUFBTztBQUFBLElBQ1Q7QUFFQSxXQUFPO0FBQUE7QUFBQSxNQUNMLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNUO0FBQUEsRUFDRixTQUFTLE9BQU87QUFDZCxXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUN2RkEsU0FBUyxRQUFBRSxhQUFZO0FBQ3JCLFNBQVMsYUFBQUMsa0JBQWlCO0FBRTFCLElBQU1DLGFBQVlELFdBQVVELEtBQUk7QUFFaEMsSUFBTUcsc0JBQXFCO0FBQUEsRUFDekI7QUFBQSxFQUFjO0FBQUEsRUFBVztBQUFBLEVBQVk7QUFBQSxFQUFPO0FBQUEsRUFBUTtBQUFBLEVBQVc7QUFBQSxFQUFTO0FBQUEsRUFDeEU7QUFBQSxFQUF1QjtBQUFBLEVBQWE7QUFBQSxFQUNwQztBQUFBLEVBQVc7QUFBQSxFQUFpQjtBQUFBLEVBQVE7QUFBQSxFQUNwQztBQUFBLEVBQW1CO0FBQUEsRUFBVTtBQUFBLEVBQVc7QUFBQSxFQUFtQjtBQUFBLEVBQW9CO0FBQ2pGO0FBRUEsSUFBTUMsbUJBQWtCO0FBQUEsRUFDdEI7QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUNwQztBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFNO0FBQUEsRUFBTTtBQUFBLEVBQU07QUFBQSxFQUFPO0FBQ25EO0FBRUEsZUFBZUMsa0JBQWlCO0FBQzlCLFFBQU0sZ0JBQWdCLENBQUM7QUFFdkIsTUFBSTtBQUNGLFVBQU0sRUFBRSxPQUFPLElBQUksTUFBTUgsV0FBVSxVQUFVO0FBQUEsTUFDM0MsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBO0FBQUEsTUFDVCxXQUFXLE9BQU8sT0FBTztBQUFBO0FBQUEsSUFDM0IsQ0FBQztBQUVELFVBQU0sTUFBTSxPQUFPLFlBQVk7QUFFL0IsZUFBVyxXQUFXQyxxQkFBb0I7QUFDeEMsVUFBSSxJQUFJLFNBQVMsT0FBTyxHQUFHO0FBQ3pCLHNCQUFjLEtBQUssT0FBTztBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNULFNBQVMsT0FBTztBQUNkLFdBQU8sQ0FBQztBQUFBLEVBQ1Y7QUFDRjtBQUVBLGVBQWVHLGNBQWE7QUFDMUIsUUFBTSxhQUFhLENBQUM7QUFFcEIsTUFBSTtBQUNGLFVBQU0sRUFBRSxPQUFPLElBQUksTUFBTUosV0FBVSxpQkFBaUI7QUFBQSxNQUNsRCxVQUFVO0FBQUEsTUFDVixTQUFTO0FBQUE7QUFBQSxNQUNULFdBQVcsT0FBTyxPQUFPO0FBQUE7QUFBQSxJQUMzQixDQUFDO0FBRUQsVUFBTSxNQUFNLE9BQU8sWUFBWTtBQUUvQixlQUFXLFFBQVFFLGtCQUFpQjtBQUdsQyxZQUFNLFlBQVksSUFBSSxPQUFPLElBQUksSUFBSSxvQkFBb0IsR0FBRztBQUM1RCxVQUFJLFVBQVUsS0FBSyxHQUFHLEdBQUc7QUFDdkIsbUJBQVcsS0FBSyxJQUFJO0FBQUEsTUFDdEI7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1QsU0FBUyxPQUFPO0FBQ2QsV0FBTyxDQUFDO0FBQUEsRUFDVjtBQUNGO0FBRUEsZUFBc0JHLGtCQUFpQjtBQUNyQyxNQUFJO0FBRUYsVUFBTSxDQUFDLGVBQWUsVUFBVSxJQUFJLE1BQU0sUUFBUSxJQUFJO0FBQUEsTUFDcERGLGdCQUFlO0FBQUEsTUFDZkMsWUFBVztBQUFBLElBQ2IsQ0FBQztBQUVELFFBQUksY0FBYyxXQUFXLEtBQUssV0FBVyxXQUFXLEdBQUc7QUFDekQsYUFBTztBQUFBLElBQ1Q7QUFFQSxXQUFPO0FBQUE7QUFBQSxNQUNMLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNUO0FBQUEsRUFDRixTQUFTLE9BQU87QUFDZCxXQUFPO0FBQUEsRUFDVDtBQUNGOzs7QUNuRkEsZUFBc0JFLGdCQUFlLFdBQVcsU0FBUztBQUN2RCxNQUFJLGFBQWEsUUFBUyxRQUFPLE1BQVUsZUFBZTtBQUMxRCxNQUFJLGFBQWEsU0FBVSxRQUFPLE1BQVVBLGdCQUFlO0FBQzNELFNBQU8sTUFBWUEsZ0JBQWU7QUFDcEM7OztBYmdDQSxJQUFNLFFBQVEsSUFBSSxNQUFNLE1BQU0sRUFBRSxvQkFBb0IsTUFBTSxDQUFDO0FBQzNELElBQU1DLGFBQVksWUFBWTtBQU03QixJQUFNLGNBQU4sTUFBa0I7QUFBQSxFQUNmLGNBQWU7QUFDWCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLFNBQVM7QUFDZCxTQUFLLHlCQUF5QjtBQUM5QixTQUFLLGdCQUFnQjtBQUNyQixTQUFLLG9CQUFvQjtBQUN6QixTQUFLLGtCQUFrQjtBQUN2QixTQUFLLHVCQUF1QjtBQUM1QixTQUFLLFFBQVE7QUFDYixTQUFLLFNBQVM7QUFDZCxTQUFLLFlBQVk7QUFDakIsU0FBSyxjQUFjO0FBQUEsRUFDdkI7QUFBQSxFQUVBLEtBQU0sSUFBSUMsU0FBUTtBQUNkLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssU0FBU0E7QUFDZCxTQUFLLGtCQUFrQixJQUFJLGlCQUFpQixLQUFLLGNBQWMsS0FBSyxJQUFJLEdBQUcsR0FBSTtBQUMvRSxTQUFLLGdCQUFnQixNQUFNO0FBQzNCLFNBQUssc0JBQXNCLElBQUksaUJBQWlCLEtBQUssZUFBZSxLQUFLLElBQUksR0FBRyxLQUFLLGdCQUFnQixXQUFXLGtCQUFrQjtBQUNsSSxTQUFLLG9CQUFvQixNQUFNO0FBQy9CLFFBQUksQ0FBQyxLQUFLLFVBQVUsMkJBQW1CLFdBQVU7QUFBRyxXQUFLLGlCQUFpQjtBQUFBLElBQUc7QUFBQSxFQUNqRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBU0EsTUFBTSxtQkFBbUI7QUFDckIsVUFBTSxZQUFZLDJCQUFtQjtBQUVyQyxTQUFLLFNBQVMsSUFBSSxPQUFPLFdBQVcsRUFBRSxNQUFNLFVBQVUsS0FBSyxFQUFFLEdBQUcsUUFBUSxJQUFJLEVBQUUsQ0FBQztBQUMvRSxJQUFBQyxNQUFJLE1BQU0sNkVBQTZFLDJCQUFtQixjQUFjO0FBR3hILFNBQUssT0FBTyxHQUFHLFNBQVMsV0FBUztBQUM3QixNQUFBQSxNQUFJLE1BQU0sMERBQTBELEtBQUs7QUFBQSxJQUM3RSxDQUFDO0FBRUQsU0FBSyxPQUFPLEdBQUcsUUFBUSxVQUFRO0FBQzNCLFVBQUksU0FBUyxHQUFHO0FBQ1osYUFBSyxlQUFlO0FBQ3BCLFlBQUksS0FBSyxjQUFjLEdBQUU7QUFDckIsZUFBSyxZQUFZO0FBQ2pCLFVBQUFBLE1BQUksTUFBTSw2RkFBNkY7QUFBQSxRQUMzRyxPQUNLO0FBQUUsZUFBSyxpQkFBaUI7QUFBQSxRQUFHO0FBQUEsTUFDcEM7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBU0EsTUFBTSxhQUFhLFdBQVc7QUFDMUIsUUFBSSwyQkFBbUIsV0FBVztBQUM5QixVQUFJLENBQUMsS0FBSyxRQUFRO0FBQ2QsbUNBQW1CLFlBQVk7QUFDL0IsY0FBTSxJQUFJLE1BQU0sd0JBQXdCO0FBQUEsTUFDNUM7QUFDQSxXQUFLLE9BQU8sWUFBWSxFQUFFLFdBQVcsTUFBTSxLQUFLLFNBQVMsR0FBRyxXQUFXLDJCQUFtQixVQUFVLENBQUM7QUFDckcsWUFBTSxTQUFTLE1BQU0sSUFBSSxRQUFRLGFBQVc7QUFDeEMsYUFBSyxPQUFPLEtBQUssV0FBVyxDQUFDLFlBQVk7QUFDckMsa0JBQVEsT0FBTztBQUFBLFFBQ25CLENBQUM7QUFBQSxNQUNMLENBQUM7QUFFRCxVQUFJLENBQUMsT0FBTyxRQUFTLE9BQU0sSUFBSSxNQUFNLE9BQU8sS0FBSztBQUNqRCxhQUFPO0FBQUEsSUFDWCxPQUFPO0FBRUgsWUFBTSxtQkFBbUIsT0FBTyxLQUFLLFNBQVMsRUFBRSxTQUFTLFFBQVE7QUFDakUsWUFBTSxlQUFlO0FBQ3JCLGFBQU8sRUFBRSxTQUFTLE1BQU0sa0JBQW9DLGNBQTRCLFNBQVMsT0FBTyxVQUFxQjtBQUFBLElBRWpJO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBV0EsTUFBTSxnQkFBZTtBQUVqQixTQUFLO0FBQ0wsUUFBSSxLQUFLLFFBQVEsT0FBTyxHQUFHO0FBRXZCLFlBQU0sc0JBQXNCLE1BQU1DLGdCQUFlLFFBQVEsUUFBUTtBQUVqRSxVQUFJLHFCQUFxQjtBQUNyQixRQUFBRCxNQUFJLEtBQUssbURBQW1EO0FBQzVELG1CQUFXLFdBQVcsb0JBQW9CLFVBQVU7QUFDaEQsVUFBQUEsTUFBSSxLQUFLLHlCQUF5QixPQUFPLFdBQVc7QUFBQSxRQUN4RDtBQUNBLG1CQUFXLFFBQVEsb0JBQW9CLE9BQU87QUFDMUMsVUFBQUEsTUFBSSxLQUFLLHNCQUFzQixJQUFJLFdBQVc7QUFBQSxRQUNsRDtBQUNBLGFBQUssZ0JBQWdCLFdBQVcsa0JBQWtCO0FBQUEsTUFDdEQ7QUFFQSxVQUFJLEtBQUssZ0JBQWdCLFdBQVcsVUFBUztBQUN6Qyw4QkFBYyxpQkFBaUI7QUFBQSxNQUNuQztBQUFBLElBRUo7QUFFQSxRQUFJLEtBQUssZ0JBQWdCLFdBQVcsZUFBYztBQUFDO0FBQUEsSUFBTTtBQUd6RCxRQUFJLEtBQUssZ0JBQWdCLGVBQWUsR0FBRztBQUN0QyxVQUFJLENBQUMsS0FBSyxnQkFBZ0IsUUFBTztBQUM5QixRQUFBQSxNQUFJLEtBQUssMEZBQTBGO0FBQ25HLGFBQUssZ0JBQWdCLGNBQWM7QUFDbkMsYUFBSyxnQkFBZ0I7QUFDckIsYUFBSyxlQUFlO0FBQUEsTUFDeEI7QUFBQSxJQUNKO0FBRUEsUUFBSSxLQUFLLGdCQUFnQixXQUFXLFVBQVU7QUFDMUMsVUFBSSxVQUFVLEVBQUMsWUFBWSxLQUFLLGdCQUFnQixXQUFVO0FBRTFELFlBQU0sV0FBVyxLQUFLLGdCQUFnQixXQUFXLFFBQVEsSUFBSSxLQUFLLE9BQU8sYUFBYSwwQkFBMEI7QUFBQSxRQUM1RyxRQUFRO0FBQUEsUUFDUixPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsVUFDTCxnQkFBZ0I7QUFBQSxRQUNwQjtBQUFBLFFBQ0EsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLE1BQ2hDLENBQUMsRUFDQSxLQUFLLGNBQVk7QUFDZCxZQUFJLENBQUMsU0FBUyxJQUFJO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLDZCQUE2QjtBQUFBLFFBQUc7QUFDcEUsZUFBTyxTQUFTLEtBQUs7QUFBQSxNQUN6QixDQUFDLEVBQ0EsS0FBSyxVQUFRO0FBQ1YsWUFBSSxLQUFLLFdBQVcsU0FBUztBQUN6QixjQUFTLEtBQUssWUFBWSxnQkFBZTtBQUFFLFlBQUFBLE1BQUksS0FBSyxnRUFBZ0U7QUFBVSxpQkFBSyxnQkFBZ0IsY0FBYztBQUFBLFVBQUcsV0FDM0osS0FBSyxZQUFZLFdBQVU7QUFDaEMsWUFBQUEsTUFBSSxLQUFLLHVFQUF1RTtBQUNoRixpQkFBSyxZQUFZO0FBQUEsVUFDckIsT0FDSztBQUFzQyxZQUFBQSxNQUFJLEtBQUsseUNBQXlDLEtBQUssZ0JBQWdCLFdBQVcsbUJBQW1CO0FBQWdCLGlCQUFLLGdCQUFnQixlQUFlO0FBQUEsVUFBRTtBQUFBLFFBQzFNLFdBQVcsS0FBSyxXQUFXLFdBQVc7QUFDbEMsZUFBSyxnQkFBZ0IsY0FBYztBQUNuQyxlQUFLLGdCQUFnQixXQUFXLGVBQWU7QUFDL0MsZ0JBQU0sdUJBQXVCLEtBQUssTUFBTSxLQUFLLFVBQVUsS0FBSyxZQUFZLENBQUM7QUFDekUsZ0JBQU0sd0JBQXdCLEtBQUssTUFBTSxLQUFLLFVBQVUsS0FBSyxhQUFhLENBQUM7QUFDM0UsZUFBSywyQkFBMkIsc0JBQXNCLHFCQUFxQjtBQUFBLFFBQy9FO0FBQUEsTUFDSixDQUFDLEVBQ0EsTUFBTSxXQUFTO0FBQ1osYUFBSyxnQkFBZ0IsZUFBZTtBQUNwQyxRQUFBQSxNQUFJLE1BQU0sMENBQTBDLEtBQUssZ0JBQWdCLFdBQVcsS0FBSyxLQUFLLEVBQUU7QUFBQSxNQUNwRyxDQUFDO0FBQUEsSUFDTCxPQUNLO0FBQ0QsV0FBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQUEsSUFDNUM7QUFBQSxFQUNKO0FBQUEsRUFJQSxNQUFNLGlCQUFnQjtBQUNsQixRQUFJLEtBQUssZ0JBQWdCLFdBQVcsZUFBYztBQUFDO0FBQUEsSUFBTTtBQUN6RCxRQUFJLEtBQUssZ0JBQWdCLGVBQWUsR0FBRztBQUFDO0FBQUEsSUFBTTtBQUNsRCxRQUFJLEtBQUssZ0JBQWdCLFdBQVcsVUFBVTtBQUUxQyxVQUFJLFNBQVMsa0JBQWtCLGNBQWM7QUFDN0MsVUFBSSxZQUFZO0FBRWhCLFVBQUk7QUFDQSxZQUFJLDJCQUFtQixtQkFBa0I7QUFFckMsc0JBQVksTUFBTSxXQUFXLEVBQUUsUUFBUSxNQUFNLENBQUM7QUFDOUMsV0FBQyxFQUFFLFNBQVMsa0JBQWtCLGNBQWMsU0FBUyxVQUFVLElBQUksTUFBTSxLQUFLLGFBQWEsU0FBUztBQUNwRyxjQUFJLFNBQVM7QUFBRSxpQkFBSyxrQkFBa0I7QUFBQSxVQUFFLE9BQ25DO0FBQ0Qsa0JBQU0sSUFBSSxNQUFNLHlCQUF5QjtBQUFBLFVBQzdDO0FBQUEsUUFDSixPQUNLO0FBRUQsY0FBSSx1QkFBdUIsc0JBQWMsd0JBQXdCO0FBQ2pFLGNBQUksc0JBQXNCO0FBQ3RCLGdCQUFJLFNBQVMsTUFBTSxxQkFBcUIsWUFBWSxZQUFZO0FBQ2hFLHdCQUFZLE9BQU8sTUFBTTtBQUFBLFVBQzdCO0FBQ0EsV0FBQyxFQUFFLFNBQVMsa0JBQWtCLGNBQWMsUUFBUSxJQUFJLE1BQU0sS0FBSyxhQUFhLFNBQVM7QUFBQSxRQUM3RjtBQUFBLE1BQ0osU0FDTSxLQUFJO0FBQ04sYUFBSyxtQkFBa0I7QUFDdkIsUUFBQUEsTUFBSSxNQUFNLCtEQUErRCxHQUFHLEVBQUU7QUFBQSxNQUNsRjtBQU9BLFVBQUksUUFBUSxhQUFhLFlBQVksS0FBSyx3QkFBd0IsY0FBYyxNQUFLO0FBQ2pGLGFBQUssdUJBQXVCO0FBQzVCLGNBQU0sYUFBYSwyQkFBbUI7QUFDdEMsWUFBRztBQUNDLGdCQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFNLE1BQU0sVUFBVSxVQUFVLFdBQVksT0FBTSxFQUFFLFVBQVUsWUFBWSxXQUFXLEtBQUssT0FBTyxjQUFjLENBQUU7QUFDeEksY0FBSSxtQkFBbUIsS0FBSyxTQUFTLE1BQU07QUFDM0MsY0FBSSxDQUFDLGtCQUFpQjtBQUNsQix1Q0FBbUIsb0JBQWtCO0FBQ3JDLFlBQUFBLE1BQUksS0FBSyxvSEFBb0g7QUFBQSxVQUNqSSxPQUNLO0FBQUUsWUFBQUEsTUFBSSxLQUFLLHFGQUFxRjtBQUFBLFVBQUU7QUFBQSxRQUMzRyxTQUFPLEtBQUk7QUFBRyxVQUFBQSxNQUFJLE1BQU0sa0RBQWtELEdBQUcsRUFBRTtBQUFBLFFBQUc7QUFBQSxNQUN0RjtBQUlBLFVBQUksQ0FBQyxrQkFBaUI7QUFDbEIsWUFBRyxLQUFLLGtCQUFrQixLQUFLLDJCQUFtQixtQkFBa0I7QUFBRSxxQ0FBbUIsb0JBQWtCO0FBQU8sVUFBQUEsTUFBSSxNQUFNLHFGQUFxRjtBQUFBLFFBQUUsV0FDMU0sS0FBSyxrQkFBa0IsS0FBSyxDQUFDLDJCQUFtQixtQkFBa0I7QUFBRSxxQ0FBbUIsWUFBWTtBQUFPLFVBQUFBLE1BQUksTUFBTSx3RkFBd0Y7QUFBQSxRQUFFLFdBQzlNLEtBQUssa0JBQWtCLEtBQUssQ0FBQywyQkFBbUIscUJBQXFCLENBQUMsMkJBQW1CLFdBQVU7QUFBRSxVQUFBQSxNQUFJLE1BQU0sd0ZBQXdGO0FBQUEsUUFBRTtBQUNsTjtBQUFBLE1BQ0o7QUFNQSxVQUFLLEtBQUssZ0JBQWdCLFdBQVcsWUFBWSxDQUFDLEtBQUssT0FBTyxlQUFlLEtBQUssZ0JBQWdCLFdBQVcsT0FBTTtBQUMvRyxZQUFJLFNBQVE7QUFDUixlQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFDeEMsVUFBQUEsTUFBSSxLQUFLLGdHQUFnRztBQUFBLFFBQzdHO0FBQUEsTUFDSjtBQUdBLFVBQUksaUJBQWlCO0FBQ3JCLFVBQUk7QUFBRSx5QkFBaUIsT0FBTyxXQUFXLEtBQUssRUFBRSxPQUFPLE9BQU8sS0FBSyxrQkFBa0IsUUFBUSxDQUFDLEVBQUUsT0FBTyxLQUFLO0FBQUEsTUFBSSxTQUMxRyxLQUFJO0FBQUUsUUFBQUEsTUFBSSxNQUFNLGdFQUFnRSxJQUFJLE9BQU8sRUFBRTtBQUFBLE1BQUc7QUFFdEcsWUFBTSxVQUFVO0FBQUEsUUFDWixZQUFZLEtBQUssZ0JBQWdCO0FBQUEsUUFDakMsWUFBWTtBQUFBLFFBQ1o7QUFBQSxRQUNBLFFBQVE7QUFBQSxRQUNSLG9CQUFvQixLQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFBQSxNQUNoRTtBQUdBLFVBQUksVUFBVTtBQUNkLFlBQU0sYUFBYTtBQUNuQixZQUFNLE1BQU0sV0FBVyxLQUFLLGdCQUFnQixXQUFXLFFBQVEsSUFBSSxLQUFLLE9BQU8sYUFBYTtBQUM1RixXQUFLLG1CQUFtQixLQUFLLFNBQVMsT0FBTyxTQUFTLFVBQVU7QUFBQSxJQUNwRTtBQUFBLEVBQ0o7QUFBQSxFQU1BLG1CQUFtQixLQUFLLFNBQVNFLFFBQU8sVUFBVSxHQUFHLFlBQVk7QUFDN0QsVUFBTSxLQUFLO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixPQUFPO0FBQUEsTUFDUCxTQUFTO0FBQUEsUUFDTCxnQkFBZ0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0EsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLE1BQzVCLE9BQUFBO0FBQUEsSUFDSixDQUFDLEVBQ0EsS0FBSyxjQUFZO0FBQ2QsVUFBSSxDQUFDLFNBQVMsSUFBSTtBQUNkLGNBQU0sSUFBSSxNQUFNLHdFQUF3RTtBQUFBLE1BQzVGO0FBQ0EsYUFBTyxTQUFTLEtBQUs7QUFBQSxJQUN6QixDQUFDLEVBQ0EsS0FBSyxVQUFRO0FBQ1YsVUFBSSxRQUFRLEtBQUssV0FBVyxTQUFTO0FBQ2pDLFFBQUFGLE1BQUksTUFBTSw0REFBNEQsS0FBSyxPQUFPO0FBQUEsTUFDdEY7QUFBQSxJQUNKLENBQUMsRUFDQSxNQUFNLFdBQVM7QUFDWixVQUFJLFVBQVUsYUFBYSxHQUFHO0FBQzFCLGFBQUssbUJBQW1CLEtBQUssU0FBU0UsUUFBTyxVQUFVLEdBQUcsVUFBVTtBQUFBLE1BQ3hFLFdBQVcsWUFBWSxhQUFhLEtBQUssS0FBSyxnQkFBZ0IsZ0JBQWdCLEdBQUc7QUFDN0UsUUFBQUYsTUFBSSxNQUFNLHNEQUFzRCxNQUFNLE9BQU8sRUFBRTtBQUFBLE1BQ25GO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTDtBQUFBLEVBTUEsTUFBTSxZQUFZLGVBQWM7QUFDNUIsSUFBQUEsTUFBSSxLQUFLLG1FQUFtRTtBQUM1RSxTQUFLLGdCQUFnQixTQUFTO0FBQzlCLFNBQUssZ0JBQWdCLGNBQWM7QUFDbkMsUUFBSSxlQUFlLEVBQUMsaUJBQWlCLE1BQUs7QUFDMUMsUUFBSSxpQkFBaUIsY0FBYyxXQUFVO0FBQUUsbUJBQWEsa0JBQWtCO0FBQUEsSUFBSTtBQUVsRixTQUFLLFFBQVEsWUFBWTtBQUN6QixTQUFLLGdCQUFnQjtBQUNyQjtBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFXQSxNQUFNLDJCQUEyQixjQUFjLGVBQWM7QUFLekQsUUFBSyxpQkFBaUIsT0FBTyxLQUFLLGFBQWEsRUFBRSxXQUFXLEdBQUc7QUFDM0QsVUFBSSxjQUFjLGFBQWE7QUFDM0IsOEJBQWMsV0FBVyxZQUFZLEtBQUssUUFBUTtBQUFBLE1BQ3REO0FBRUEsVUFBSSxjQUFjLFFBQVE7QUFDdEIsYUFBSyxZQUFZLGFBQWE7QUFDOUI7QUFBQSxNQUNKO0FBRUEsVUFBSSxjQUFjLGNBQWMsTUFBSztBQUNqQyxRQUFBQSxNQUFJLEtBQUssNkVBQTZFO0FBQ3RGLFlBQUksWUFBWTtBQUNoQixZQUFJO0FBQ0EsY0FBSUcsSUFBRyxXQUFXLEtBQUssT0FBTyxhQUFhLEdBQUU7QUFDekMsWUFBQUEsSUFBRyxPQUFPLEtBQUssT0FBTyxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDeEQsWUFBQUEsSUFBRyxVQUFVLEtBQUssT0FBTyxhQUFhO0FBQUEsVUFDMUM7QUFBQSxRQUNKLFNBQVMsT0FBTztBQUNaLHNCQUFZO0FBQ1osZ0NBQWMsV0FBVyxZQUFZLEtBQUssYUFBYSxLQUFLO0FBQzVELFVBQUFILE1BQUksTUFBTSxpRkFBaUYsS0FBSyxHQUFHO0FBQUEsUUFDdkc7QUFFQSxZQUFJLGFBQWEsT0FBTTtBQUNuQixjQUFJRyxJQUFHLFdBQVcsS0FBSyxPQUFPLGFBQWEsR0FBRztBQUMxQyxrQkFBTSxRQUFRQSxJQUFHLFlBQVksS0FBSyxPQUFPLGFBQWE7QUFFdEQsa0JBQU0sUUFBUSxVQUFRO0FBQ2xCLG9CQUFNLFdBQVdDLE1BQUssS0FBSyxPQUFPLGVBQWUsSUFBSTtBQUNyRCxrQkFBSTtBQUNBLHNCQUFNLFFBQVFELElBQUcsU0FBUyxRQUFRO0FBQ2xDLG9CQUFJLE1BQU0sWUFBWSxHQUFHO0FBQUUsa0JBQUFBLElBQUcsT0FBTyxVQUFVLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxnQkFBRyxPQUNoRTtBQUFFLGtCQUFBQSxJQUFHLFdBQVcsUUFBUTtBQUFBLGdCQUFJO0FBQUEsY0FDckMsU0FDTyxPQUFPO0FBQ1YsZ0JBQUFILE1BQUksTUFBTSxnSEFBNkcsUUFBUSxJQUFJLEtBQUs7QUFBQSxjQUM1STtBQUFBLFlBQ0osQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKO0FBQ0EsWUFBSSxzQkFBYyxZQUFZO0FBQUcsZ0NBQWMsV0FBVyxZQUFZLEtBQUssY0FBYztBQUFBLFFBQUs7QUFBQSxNQUNsRztBQUdBLFVBQUksY0FBYyxTQUFTLE9BQU07QUFDN0IsYUFBSyxnQkFBZ0IsV0FBVyxRQUFRO0FBQUEsTUFDNUM7QUFFQSxVQUFJLGNBQWMsc0JBQXNCLE1BQUs7QUFDekMsUUFBQUEsTUFBSSxLQUFLLHNGQUFzRjtBQUMvRixhQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFDeEMsWUFBSSxzQkFBYyxjQUFjLENBQUMsS0FBSyxPQUFPLGFBQVk7QUFDckQsZ0NBQWMsV0FBVyxTQUFTLElBQUk7QUFDdEMsZ0NBQWMsV0FBVyxNQUFNO0FBQUEsUUFDbkM7QUFBQSxNQUNKO0FBQ0EsVUFBSSxjQUFjLDZCQUE2QixRQUFRLEtBQUssZ0JBQWdCLFdBQVcsa0JBQWtCLGFBQWEsT0FBUTtBQUMxSCxRQUFBQSxNQUFJLEtBQUssc0ZBQXNGO0FBQy9GLGFBQUssZ0JBQWdCLFdBQVcsa0JBQWtCLFdBQVc7QUFDN0QsYUFBSyxnQkFBZ0IsV0FBVyxrQkFBa0IsWUFBWTtBQUM5RCxRQUFBSyxTQUFRLEtBQUssbUJBQW1CO0FBQUEsTUFDcEM7QUFDQSxVQUFJLGNBQWMsNkJBQTZCLFNBQVMsS0FBSyxnQkFBZ0IsV0FBVyxrQkFBa0IsYUFBYSxNQUFPO0FBQzFILFFBQUFMLE1BQUksS0FBSyx5RkFBeUY7QUFDbEcsYUFBSyxnQkFBZ0IsV0FBVyxrQkFBa0IsV0FBVztBQUM3RCxhQUFLLGdCQUFnQixXQUFXLGtCQUFrQixZQUFZO0FBQUEsTUFDbEU7QUFFQSxXQUFLLGdCQUFnQixXQUFXLGtCQUFrQixjQUFjLGNBQWM7QUFFOUUsVUFBSSxjQUFjLGFBQWEsTUFBSztBQUNoQyxhQUFLLGtCQUFrQjtBQUFBLE1BQzNCO0FBQ0EsVUFBSSxjQUFjLGVBQWUsTUFBSztBQUNsQyxhQUFLLHNCQUFzQixjQUFjLEtBQUs7QUFBQSxNQUNsRDtBQUNBLFVBQUksY0FBYyxpQkFBaUIsTUFBSztBQUNwQyxZQUFJLHNCQUFjLFlBQVc7QUFDekIsZ0NBQWMsV0FBVyxZQUFZLEtBQUssY0FBYztBQUFBLFFBQzVEO0FBQUEsTUFDSjtBQUlBLFdBQUssZ0JBQWdCLFdBQVcsZ0JBQWdCLGNBQWM7QUFHOUQsVUFBSSxjQUFjLE9BQU07QUFFcEIsWUFBSSxLQUFLLGdCQUFnQixXQUFXLFVBQVUsY0FBYyxPQUFNO0FBQzlELGVBQUssZ0JBQWdCLFdBQVcsUUFBUSxjQUFjO0FBQ3RELGNBQUksc0JBQWMsWUFBVztBQUN6QixrQ0FBYyxXQUFXLFlBQVksS0FBSyxjQUFjO0FBQUEsVUFDNUQ7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBSUo7QUFnQkEsUUFBSSxhQUFhLFlBQVksS0FBSyxnQkFBZ0IsV0FBVyxVQUFTO0FBSWxFLFVBQUksYUFBYSxrQkFBa0IsS0FBSyxnQkFBZ0IsV0FBVyxlQUFjO0FBQzdFLFFBQUFBLE1BQUksS0FBSywwRUFBMEUsYUFBYSxhQUFhLElBQUksYUFBYSxhQUFhLGFBQWEsYUFBYSxFQUFFLFdBQVcsZ0JBQWdCLGFBQWEsYUFBYSxhQUFhLGFBQWEsRUFBRSxRQUFRLEVBQUc7QUFHblEsY0FBTSx1QkFBdUIsS0FBSyxnQkFBZ0IsV0FBVztBQUM3RCxjQUFNLG1CQUFtQixhQUFhO0FBQ3RDLGNBQU0sVUFBVSxLQUFLLE9BQU87QUFJNUIsWUFBSSxLQUFLLGdCQUFnQixXQUFXLGFBQWEsVUFBUztBQUN0RCxVQUFBQSxNQUFJLEtBQUssMkZBQTJGO0FBR3BHLGNBQUksTUFBTSxNQUFNLEtBQUssYUFBYSxLQUFLLGdCQUFnQixXQUFXLGtCQUFrQixhQUFhLGFBQWEsb0JBQW9CLEVBQUUsV0FBVztBQUMvSSxjQUFJLElBQUksV0FBVyxXQUFVO0FBQ3pCLGlCQUFLLHVCQUF1QixJQUFJLFdBQVcsb0JBQW9CO0FBQUEsVUFDbkU7QUFBQSxRQUNKO0FBQ0EsYUFBSyxjQUFjO0FBTW5CLGNBQU0sS0FBSyxNQUFNLEdBQUk7QUFJckIsYUFBSyxnQkFBZ0IsV0FBVyxXQUFXLGFBQWEsYUFBYSxhQUFhLGFBQWEsRUFBRTtBQUVqRyxhQUFLLGdCQUFnQixXQUFXLGdCQUFnQjtBQUtoRCxZQUFJO0FBR0EsY0FBSUcsSUFBRyxXQUFXLE9BQU8sS0FBSyx3QkFBd0IsUUFBUSx5QkFBeUIsUUFBVztBQUU5RixZQUFBSCxNQUFJLE1BQU0sNkZBQTZGLG9CQUFvQixFQUFFO0FBRTdILGtCQUFNLFdBQVcsR0FBRyxPQUFPLElBQUksb0JBQW9CO0FBQ25ELGdCQUFJLENBQUNHLElBQUcsV0FBVyxRQUFRLEdBQUc7QUFDMUIsY0FBQUEsSUFBRyxVQUFVLFVBQVUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFlBQzlDO0FBRUEsa0JBQU0sUUFBUUEsSUFBRyxZQUFZLE9BQU87QUFDcEMsWUFBQUgsTUFBSSxLQUFLLDREQUE0RCxNQUFNLE1BQU0sMkJBQTJCO0FBRTVHLGdCQUFJLGFBQWE7QUFDakIsdUJBQVcsUUFBUSxPQUFPO0FBQ3RCLG9CQUFNLFVBQVUsR0FBRyxPQUFPLElBQUksSUFBSTtBQUNsQyxvQkFBTSxPQUFPRyxJQUFHLFNBQVMsT0FBTztBQUdoQyxrQkFBSSxLQUFLLE9BQU8sR0FBRztBQUNmLHNCQUFNLFVBQVUsR0FBRyxRQUFRLElBQUksSUFBSTtBQUNuQyxnQkFBQUEsSUFBRyxhQUFhLFNBQVMsT0FBTztBQUNoQyxnQkFBQUEsSUFBRyxXQUFXLE9BQU87QUFDckI7QUFDQSxnQkFBQUgsTUFBSSxLQUFLLGlFQUFpRSxJQUFJLGVBQWUsb0JBQW9CLEVBQUU7QUFBQSxjQUN2SCxPQUFPO0FBQ0gsZ0JBQUFBLE1BQUksS0FBSyxzRkFBc0YsSUFBSSxhQUFhO0FBQUEsY0FDcEg7QUFBQSxZQUNKO0FBQ0EsWUFBQUEsTUFBSSxLQUFLLHlFQUF5RSxVQUFVLHFCQUFxQixvQkFBb0IsRUFBRTtBQUFBLFVBQzNJLE9BQU87QUFDSCxZQUFBQSxNQUFJLEtBQUssc0ZBQXNGRyxJQUFHLFdBQVcsT0FBTyxDQUFDLDJCQUEyQixvQkFBb0IsRUFBRTtBQUFBLFVBQzFLO0FBR0EsY0FBSSxvQkFBb0IsUUFBUSxxQkFBcUIsUUFBVztBQUM1RCxZQUFBSCxNQUFJLE1BQU0sbUZBQW1GLGdCQUFnQixhQUFhO0FBRTFILGtCQUFNLFdBQVcsR0FBRyxPQUFPLElBQUksZ0JBQWdCO0FBQy9DLGdCQUFJRyxJQUFHLFdBQVcsUUFBUSxHQUFHO0FBQ3pCLG9CQUFNLGNBQWNBLElBQUcsWUFBWSxRQUFRO0FBQzNDLGNBQUFILE1BQUksS0FBSyw0REFBNEQsWUFBWSxNQUFNLHFCQUFxQixnQkFBZ0IsWUFBWTtBQUV4SSxrQkFBSSxjQUFjO0FBQ2xCLHlCQUFXLFFBQVEsYUFBYTtBQUM1QixzQkFBTSxhQUFhLEdBQUcsUUFBUSxJQUFJLElBQUk7QUFDdEMsc0JBQU0sV0FBVyxHQUFHLE9BQU8sSUFBSSxJQUFJO0FBQ25DLHNCQUFNLE9BQU9HLElBQUcsU0FBUyxVQUFVO0FBRW5DLG9CQUFJLEtBQUssT0FBTyxHQUFHO0FBQ2Ysa0JBQUFBLElBQUcsYUFBYSxZQUFZLFFBQVE7QUFDcEM7QUFDQSxrQkFBQUgsTUFBSSxLQUFLLGtFQUFrRSxJQUFJLGlCQUFpQixnQkFBZ0IsYUFBYTtBQUFBLGdCQUNqSSxPQUFPO0FBQ0gsa0JBQUFBLE1BQUksS0FBSyw2RUFBNkUsSUFBSSxlQUFlLGdCQUFnQixZQUFZO0FBQUEsZ0JBQ3pJO0FBQUEsY0FDSjtBQUNBLGNBQUFBLE1BQUksS0FBSywwRUFBMEUsV0FBVyx1QkFBdUIsZ0JBQWdCLGFBQWE7QUFBQSxZQUN0SixPQUFPO0FBQ0YsY0FBQUEsTUFBSSxLQUFLLG1GQUFtRixnQkFBZ0IsK0NBQStDO0FBQUEsWUFDaEs7QUFBQSxVQUNKLE9BQU87QUFDSCxZQUFBQSxNQUFJLEtBQUssaUZBQWlGLGdCQUFnQix1QkFBdUI7QUFBQSxVQUNySTtBQUFBLFFBQ0osU0FBUyxPQUFPO0FBQ1osVUFBQUEsTUFBSSxNQUFNLHNGQUFzRixLQUFLLEVBQUU7QUFDdkcsVUFBQUEsTUFBSSxNQUFNLG1FQUFtRSxNQUFNLEtBQUssRUFBRTtBQUMxRixVQUFBQSxNQUFJLE1BQU0sNEVBQTRFLG9CQUFvQix1QkFBdUIsZ0JBQWdCLGNBQWMsT0FBTyxFQUFFO0FBQUEsUUFDNUs7QUFNQSxZQUFJLHNCQUFjLFlBQVc7QUFJckIsY0FBSSxLQUFLLE9BQU8sYUFBWTtBQUN4QixZQUFBTSxhQUFZLGtCQUFrQixFQUFFLFFBQVEsUUFBTTtBQUMxQyxrQkFBSSxHQUFHLGlCQUFpQixPQUFPLHNCQUFjLFdBQVcsWUFBWSxNQUFNLEdBQUcsbUJBQW1CLEdBQUU7QUFDOUYsZ0JBQUFOLE1BQUksS0FBSyxzRUFBc0U7QUFDL0UsbUJBQUcsY0FBYztBQUFBLGNBQ3JCO0FBQUEsWUFDSixDQUFDO0FBQUEsVUFDTDtBQUVBLGdDQUFjLFdBQVcsS0FBSyxVQUFVLE1BQU07QUFDMUMsa0NBQWMsYUFBYTtBQUMzQixpQkFBSyxVQUFVLFlBQVk7QUFBQSxVQUMvQixDQUFDO0FBQ0QsZ0NBQWMsV0FBVyxNQUFNO0FBQy9CLGdDQUFjLFdBQVcsUUFBUTtBQUFBLFFBRXpDO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFPQSxRQUFJLGFBQWEsaUJBQWlCLENBQUMsS0FBSyxnQkFBZ0IsV0FBVyxZQUFZO0FBQUcsV0FBSyxtQkFBbUI7QUFBQSxJQUFFLFdBQ25HLENBQUMsYUFBYSxlQUFnQjtBQUFFLFdBQUssZUFBZTtBQUFBLElBQUU7QUFHL0QsUUFBSSxhQUFhLGVBQWU7QUFBRSxXQUFLLGdCQUFnQixXQUFXLGdCQUFnQjtBQUFBLElBQU0sT0FDbkY7QUFBRSxXQUFLLGdCQUFnQixXQUFXLGdCQUFnQjtBQUFBLElBQVE7QUFHL0QsUUFBSSxhQUFhLGFBQWEsYUFBYSxhQUFhLEVBQUUsUUFBTztBQUFFLFdBQUssZ0JBQWdCLFdBQVcsU0FBUztBQUFBLElBQUksT0FDM0c7QUFBRSxXQUFLLGdCQUFnQixXQUFXLFNBQVM7QUFBQSxJQUFLO0FBR3JELFFBQUksYUFBYSxzQkFBc0IsYUFBYSx1QkFBdUIsR0FBRztBQUUxRSxVQUFJLEtBQUssZ0JBQWdCLFdBQVcsdUJBQXVCLGFBQWEscUJBQW1CLEtBQU87QUFDOUYsUUFBQUEsTUFBSSxLQUFLLG9GQUFvRixhQUFhLHFCQUFtQixHQUFJO0FBQ2pJLGFBQUssZ0JBQWdCLFdBQVcscUJBQXFCLGFBQWEscUJBQW1CO0FBQ25GLFlBQUssYUFBYSxzQkFBc0IsR0FBRztBQUN6QyxVQUFBQSxNQUFJLEtBQUssaUZBQWlGO0FBQUEsUUFDOUY7QUFFQSxhQUFLLG9CQUFvQixLQUFLO0FBRTlCLFlBQUksS0FBSyxnQkFBZ0IsV0FBVyxxQkFBcUIsR0FBRTtBQUN2RCxlQUFLLG9CQUFvQixXQUFXLEtBQUssZ0JBQWdCLFdBQVc7QUFDcEUsZUFBSyxvQkFBb0IsTUFBTTtBQUFBLFFBRW5DO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFFQSxRQUFJLGFBQWEsWUFBWSxDQUFDLEtBQUssZ0JBQWdCLFdBQVcsVUFBUztBQUNuRSxXQUFLLGVBQWU7QUFDcEIsV0FBSyxVQUFVLFlBQVk7QUFBQSxJQUMvQixXQUNTLENBQUMsYUFBYSxZQUFZLEtBQUssZ0JBQWdCLFdBQVcsVUFBUztBQUN4RSxXQUFLLGVBQWU7QUFDcEIsV0FBSyxRQUFRLFlBQVk7QUFBQSxJQUM3QjtBQUFBLEVBRUo7QUFBQTtBQUFBLEVBR0EsdUJBQXVCLFdBQVcsVUFBUSxHQUFFO0FBQ3hDLFVBQU0sTUFBTSxXQUFXLEtBQUssZ0JBQWdCLFdBQVcsUUFBUSxJQUFJLEtBQUssT0FBTyxhQUFhLGdDQUFnQyxLQUFLLGdCQUFnQixXQUFXLFVBQVUsSUFBSSxLQUFLLGdCQUFnQixXQUFXLEtBQUs7QUFDL00sVUFBTSxVQUFVO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixjQUFjO0FBQUEsTUFDZCxrQkFBa0IsS0FBSyxnQkFBZ0IsV0FBVztBQUFBLE1BQ2xELGVBQWU7QUFBQSxJQUNuQjtBQUNBLFVBQU0sS0FBSztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsTUFBTSxLQUFLLFVBQVUsT0FBTztBQUFBLE1BQzVCLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsSUFDbEQsQ0FBQyxFQUNBLEtBQUssY0FBWTtBQUFFLGFBQU8sU0FBUyxLQUFLO0FBQUEsSUFBSSxDQUFDLEVBQzdDLEtBQUssVUFBUTtBQUNWLFVBQUksS0FBSyxXQUFXLFdBQVU7QUFDMUIsYUFBSyxnQkFBZ0IsV0FBVztBQUFBLE1BQ3BDO0FBQUEsSUFDSixDQUFDLEVBQ0EsTUFBTSxXQUFTO0FBQ1osY0FBUSxJQUFJLHlCQUF3QixNQUFNLE9BQU87QUFBQSxJQUNyRCxDQUFDO0FBQUEsRUFDTDtBQUFBO0FBQUE7QUFBQSxFQU9BLE1BQU0sYUFBYSxrQkFBa0IsYUFBYSxrQkFBZ0IsT0FBTTtBQUNwRSxJQUFBQSxNQUFJLEtBQUssaUVBQWlFO0FBRzFFLFFBQUksWUFBWTtBQUNoQixVQUFNLFVBQVU7QUFDaEIsV0FBTyxtQkFBVyxpQkFBaUIsWUFBWSxTQUFTO0FBQ3BELFlBQU0sS0FBSyxNQUFNLEdBQUc7QUFDcEI7QUFBQSxJQUNKO0FBRUEsUUFBSSxtQkFBVyxlQUFlO0FBQzFCLE1BQUFBLE1BQUksTUFBTSx5R0FBeUc7QUFDbkgsYUFBTyxFQUFFLFFBQVEsVUFBVSxTQUFTLG1FQUFtRSxRQUFRLFFBQVE7QUFBQSxJQUMzSDtBQUVBLFFBQUksVUFBVTtBQUFBLE1BQ1YsU0FBUyxFQUFDLEtBQUksS0FBSyxPQUFNLEdBQUcsUUFBTyxLQUFLLE1BQUssRUFBRTtBQUFBLE1BQy9DLFVBQVU7QUFBQSxNQUNWO0FBQUEsTUFDQSxvQkFBb0I7QUFBQSxNQUNwQixXQUFXO0FBQUEsTUFDWCxxQkFBb0I7QUFBQSxNQUdwQixnQkFBZ0I7QUFBQSxNQUNoQixnQkFBZ0Isb0xBQW9MLEtBQUssZ0JBQWdCLFdBQVcsVUFBVSxtRkFBbUYsV0FBVyxvSkFBb0osZ0JBQWdCLHFDQUFxQyxLQUFLLGdCQUFnQixXQUFXLElBQUk7QUFBQSxNQUN6akIsbUJBQW1CO0FBQUEsSUFDdkI7QUFHQSxVQUFNLHNCQUFjLFdBQVcsWUFBWSxrQkFBa0IscUJBQXFCLEtBQUssZ0JBQWdCLFdBQVcsSUFBSSxNQUFNLEtBQUssZ0JBQWdCLFdBQVcsVUFBVSxjQUFjLGdCQUFnQixHQUFHO0FBR3ZNLHVCQUFXLGdCQUFnQjtBQUUzQixRQUFJO0FBQ0EsWUFBTSxPQUFPLE1BQU0sc0JBQWMsV0FBVyxZQUFZLFdBQVcsT0FBTztBQUMxRSxZQUFNLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDeEMsWUFBTSxVQUFVLCtCQUErQixTQUFTO0FBQ3hELGFBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUSxpQkFBaUIsU0FBaUIsV0FBc0IsUUFBUSxVQUFVO0FBQUEsSUFDakgsU0FBUyxPQUFPO0FBQ1osTUFBQUEsTUFBSSxNQUFNLDhEQUE4RCxLQUFLO0FBQzdFLGFBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUyx3QkFBd0IsUUFBUSxRQUFRO0FBQUEsSUFDaEYsVUFBRTtBQUVFLHlCQUFXLGdCQUFnQjtBQUFBLElBQy9CO0FBQUEsRUFDSjtBQUFBO0FBQUEsRUFHQSxxQkFBb0I7QUFDaEIsUUFBSSxXQUFXTyxRQUFPLGVBQWU7QUFDckMsUUFBSSxVQUFVQSxRQUFPLGtCQUFrQjtBQUN2QyxRQUFJLENBQUMsV0FBVyxZQUFZLE1BQU0sQ0FBQyxRQUFRLElBQUc7QUFBRSxnQkFBVSxTQUFTLENBQUM7QUFBQSxJQUFFO0FBRXRFLFFBQUksc0JBQWMsa0JBQWtCLFVBQVUsR0FBRTtBQUM1QyxXQUFLLGdCQUFnQixXQUFXLGFBQWE7QUFDN0MsZUFBUyxXQUFXLFVBQVM7QUFDekIsOEJBQWMsdUJBQXVCLE9BQU87QUFBQSxNQUNoRDtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUE7QUFBQSxFQUdBLGlCQUFnQjtBQUNaLFFBQUk7QUFDQSxlQUFTLG9CQUFvQixzQkFBYyxtQkFBa0I7QUFDekQsWUFBSSxvQkFBb0IsQ0FBQyxpQkFBaUIsWUFBWSxHQUFHO0FBQ3JELDJCQUFpQixNQUFNO0FBQ3ZCLDJCQUFpQixRQUFRO0FBQUEsUUFDN0I7QUFBQSxNQUNKO0FBQUEsSUFDSixTQUFTLEdBQUc7QUFDUixNQUFBUCxNQUFJLE1BQU0saUZBQWlGO0FBQUEsSUFDL0Y7QUFHQSwwQkFBYyxvQkFBb0IsQ0FBQztBQUNuQyxTQUFLLGdCQUFnQixXQUFXLGFBQWE7QUFBQSxFQUNqRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFzQkEsTUFBTSxVQUFVLGNBQWE7QUFFekIsUUFBSSxzQkFBYyxtQkFBbUIsc0JBQWMsb0JBQW9CLHNCQUFjLHFCQUFxQjtBQUN0RyxNQUFBQSxNQUFJLEtBQUssaUZBQWlGO0FBQUEsSUFDOUY7QUFFQSxRQUFJLFdBQVdPLFFBQU8sZUFBZTtBQUNyQyxRQUFJLFVBQVVBLFFBQU8sa0JBQWtCO0FBRXZDLFFBQUksQ0FBQyxXQUFXLFlBQVksTUFBTSxDQUFDLFFBQVEsSUFBRztBQUFFLGdCQUFVLFNBQVMsQ0FBQztBQUFBLElBQUU7QUFFdEUsU0FBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLFNBQUssZ0JBQWdCLFdBQVcsZ0JBQWdCLGFBQWE7QUFDN0QsU0FBSyxnQkFBZ0IsV0FBVyxVQUFVLGFBQWEsYUFBYSxhQUFhLGFBQWEsRUFBRTtBQUNoRyxTQUFLLGdCQUFnQixXQUFXLGNBQWMsYUFBYSxhQUFhLGFBQWEsYUFBYSxFQUFFO0FBQ3BHLFNBQUssZ0JBQWdCLFdBQVcsY0FBYyxhQUFhLGFBQWEsYUFBYSxhQUFhLEVBQUU7QUFFcEcsUUFBSSxDQUFDLHNCQUFjLFlBQVc7QUFDMUIsTUFBQVAsTUFBSSxLQUFLLHdEQUF3RDtBQUNqRSxXQUFLLGdCQUFnQixXQUFXLFdBQVcsYUFBYSxhQUFhLGFBQWEsYUFBYSxFQUFFO0FBQ2pHLDRCQUFjLGlCQUFpQixhQUFhLGFBQWEsYUFBYSxhQUFhLEVBQUUsVUFBVSxLQUFLLGdCQUFnQixXQUFXLE9BQU8sY0FBYyxPQUFPO0FBQUEsSUFDL0osV0FDUyxzQkFBYyxZQUFXO0FBQzlCLE1BQUFBLE1BQUksTUFBTSwrREFBK0Q7QUFDekUsVUFBSTtBQUNBLDhCQUFjLFdBQVcsS0FBSztBQUM5QixZQUFJLENBQUMsS0FBSyxPQUFPLGFBQWE7QUFDMUIsZ0NBQWMsV0FBVyxjQUFjLElBQUk7QUFDM0MsZ0NBQWMsV0FBVyxlQUFlLE1BQU0sZ0JBQWdCLENBQUM7QUFDL0QsZ0JBQU0sbUJBQW1CLHFCQUFhO0FBQ3RDLGdCQUFNLEtBQUssTUFBTSxHQUFJO0FBQ3JCLGdDQUFjLGdCQUFnQjtBQUU5QixnQkFBTSxLQUFLLE1BQU0sR0FBRztBQUNwQixnQkFBTSxzQkFBYyxpQkFBaUI7QUFDckMsZ0NBQWMsV0FBVyxRQUFRO0FBQ2pDLGdDQUFjLFdBQVcsTUFBTTtBQUFBLFFBQ25DO0FBQUEsTUFDSixTQUNPLEdBQUc7QUFDTixRQUFBQSxNQUFJLE1BQU0sOEVBQThFO0FBRXhGLDRCQUFvQixzQkFBYyxVQUFVO0FBQzVDLDhCQUFjLGFBQWE7QUFDM0IsYUFBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLGFBQUssZ0JBQWdCLFdBQVcsUUFBUTtBQUN4QyxhQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFDeEM7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBR0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFXQSxNQUFNLFFBQVEsY0FBYTtBQUV2QiwwQkFBYyxtQkFBbUI7QUFHakMsUUFBSSxLQUFLLGdCQUFnQixXQUFXLFVBQVM7QUFDekMsV0FBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLDBCQUFvQjtBQUFBLElBQ3hCO0FBR0EsUUFBSSxnQkFBZ0IsYUFBYSxvQkFBb0IsTUFBSztBQUN0RCxNQUFBQSxNQUFJLEtBQUssa0VBQWtFO0FBQzNFLFVBQUk7QUFDQSxZQUFJRyxJQUFHLFdBQVcsS0FBSyxPQUFPLGFBQWEsR0FBRTtBQUN6QyxVQUFBQSxJQUFHLE9BQU8sS0FBSyxPQUFPLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUN4RCxVQUFBQSxJQUFHLFVBQVUsS0FBSyxPQUFPLGFBQWE7QUFBQSxRQUMxQztBQUFBLE1BQ0osU0FBUyxPQUFPO0FBQUUsUUFBQUgsTUFBSSxNQUFNLG9DQUFtQyxLQUFLO0FBQUEsTUFBRztBQUFBLElBQzNFO0FBR0EsUUFBSSxzQkFBYyxZQUFXO0FBQ3pCLFVBQUk7QUFFQSxZQUFJLEtBQUssT0FBTyxlQUFlLEtBQUssT0FBTyxjQUFhO0FBQ3BELGdCQUFNLGlCQUFpQk0sYUFBWSxrQkFBa0I7QUFDckQscUJBQVcsTUFBTSxnQkFBZ0I7QUFDN0IsZ0JBQUksc0JBQWMsY0FBYyxHQUFHLGlCQUFpQixPQUFPLHNCQUFjLFdBQVcsWUFBWSxNQUFNLEdBQUcsbUJBQW1CLEdBQUU7QUFDMUgsY0FBQU4sTUFBSSxLQUFLLDREQUE0RDtBQUNyRSxpQkFBRyxjQUFjO0FBQUEsWUFDckI7QUFBQSxVQUNKO0FBRUEsZ0JBQU0sS0FBSyxNQUFNLEdBQUk7QUFBQSxRQUN6QjtBQUVBLGFBQUssc0JBQXNCO0FBQUEsTUFDL0IsU0FDTSxHQUFFO0FBQUUsUUFBQUEsTUFBSSxNQUFNLG9DQUFtQyxDQUFDO0FBQUEsTUFBQztBQUV6RCxVQUFJO0FBQ0EsaUJBQVMsZUFBZSxzQkFBYyxjQUFhO0FBQy9DLHNCQUFZLE1BQU07QUFDbEIsc0JBQVksUUFBUTtBQUNwQix3QkFBYztBQUFBLFFBQ2xCO0FBQUEsTUFDSixTQUFTLEdBQUc7QUFDUiw4QkFBYyxlQUFlLENBQUM7QUFDOUIsUUFBQUEsTUFBSSxNQUFNLHFFQUFxRTtBQUFBLE1BQ25GO0FBQUEsSUFDSjtBQUNBLDBCQUFjLGVBQWUsQ0FBQztBQUU5QixTQUFLLGdCQUFnQixXQUFXLGdCQUFnQjtBQUNoRCxTQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFDeEMsU0FBSyxnQkFBZ0IsV0FBVyxnQkFBZ0I7QUFFaEQsUUFBSSxrQkFBbUIscUJBQW9CO0FBQ3ZDLHdCQUFtQixXQUFXO0FBQUEsSUFDbEM7QUFFQSxVQUFNLHNCQUFjLGlCQUFpQjtBQUFBLEVBQ3pDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSx3QkFBdUI7QUFDbkIsVUFBTSxVQUFVLHNCQUFjO0FBQzlCLFFBQUksQ0FBQyxTQUFRO0FBQUU7QUFBQSxJQUFPO0FBRXRCLFFBQUksbUJBQVcsZUFBYztBQUN6QixNQUFBQSxNQUFJLEtBQUssb0ZBQW9GO0FBQzdGLGlCQUFXLE1BQU07QUFBRSxhQUFLLHNCQUFzQjtBQUFBLE1BQUUsR0FBRyxHQUFJO0FBQ3ZEO0FBQUEsSUFDSjtBQUVBLFFBQUk7QUFDQSxVQUFJLENBQUMsUUFBUSxjQUFjLEdBQUU7QUFDekIsZ0JBQVEsTUFBTTtBQUFBLE1BQ2xCO0FBQUEsSUFDSixTQUFTLEdBQUU7QUFDUCxNQUFBQSxNQUFJLE1BQU0sZ0ZBQWdGLENBQUM7QUFBQSxJQUMvRixVQUFFO0FBQ0UsNEJBQWMsYUFBYTtBQUFBLElBQy9CO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQSxFQUtBLE1BQU0sb0JBQW1CO0FBQ3JCLFNBQUssUUFBUTtBQUFBLEVBQ2pCO0FBQUE7QUFBQSxFQUdBLGtCQUFpQjtBQUNiLFNBQUssZ0JBQWdCLFdBQVcsUUFBUTtBQUN4QyxTQUFLLGdCQUFnQixXQUFXLEtBQUs7QUFDckMsU0FBSyxnQkFBZ0IsV0FBVyxXQUFXO0FBQzNDLFNBQUssZ0JBQWdCLFdBQVcsYUFBYTtBQUM3QyxTQUFLLGdCQUFnQixXQUFXLFFBQVE7QUFFeEMsU0FBSyxnQkFBZ0IsV0FBVyxZQUFZO0FBQzVDLFNBQUssZ0JBQWdCLFdBQVcsZ0JBQWdCO0FBQUEsRUFFcEQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFVQSxzQkFBc0IsT0FBTTtBQUN4QixRQUFJLGFBQWEsS0FBSyxnQkFBZ0IsV0FBVztBQUNqRCxRQUFJLFdBQVcsS0FBSyxnQkFBZ0IsV0FBVztBQUMvQyxRQUFJLFFBQVEsS0FBSyxnQkFBZ0IsV0FBVztBQUM1QyxRQUFJLGFBQWE7QUFDakIsZUFBVyxRQUFRLE9BQU87QUFDdEIsVUFBSSxLQUFLLFFBQVEsS0FBSyxLQUFLLFNBQVMsS0FBSyxHQUFFO0FBQ3ZDLHFCQUFhLEtBQUs7QUFBQSxNQUN0QjtBQUFBLElBQ0o7QUFJQSxRQUFJLE9BQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFFBQVEscUJBQXFCLENBQUM7QUFHMUUsVUFBTSxXQUFXLFFBQVEsSUFBSSxLQUFLLE9BQU8sYUFBYSx5QkFBeUIsVUFBVSxJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ2xHLFFBQVE7QUFBQSxNQUNSLE1BQU07QUFBQSxNQUNOLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsSUFDbEQsQ0FBQyxFQUNBLEtBQUssY0FBWSxTQUFTLFlBQVksQ0FBQyxFQUN2QyxLQUFLLFlBQVU7QUFDWixVQUFJLG1CQUFtQkksTUFBSyxLQUFLLE9BQU8sZUFBZSxNQUFNLE9BQU8sTUFBTSxDQUFDO0FBQzNFLE1BQUFELElBQUcsVUFBVSxrQkFBa0IsT0FBTyxLQUFLLE1BQU0sR0FBRyxDQUFDLFFBQVE7QUFDekQsWUFBSSxLQUFLO0FBQUUsVUFBQUgsTUFBSSxNQUFNLEdBQUc7QUFBQSxRQUFJLE9BQ3ZCO0FBQ0Qsa0JBQVEsa0JBQWtCLEVBQUUsS0FBSyxLQUFLLE9BQU8sY0FBYyxDQUFDLEVBQzNELEtBQUssTUFBTTtBQUNSLFlBQUFBLE1BQUksS0FBSyw0RUFBNEU7QUFDckYsbUJBQU9HLElBQUcsU0FBUyxPQUFPLGdCQUFnQjtBQUFBLFVBQzlDLENBQUMsRUFDQSxLQUFLLE1BQU07QUFDUixnQkFBSSxjQUFjLHNCQUFjLFlBQVk7QUFDeEMsb0NBQWMsV0FBVyxZQUFZLEtBQUssVUFBVSxVQUFVO0FBQzlELGNBQUFILE1BQUksS0FBSyxxRUFBcUU7QUFBQSxZQUNsRjtBQUNBLGdCQUFJLHNCQUFjLFlBQVk7QUFBRyxvQ0FBYyxXQUFXLFlBQVksS0FBSyxjQUFjO0FBQUEsWUFBSztBQUFBLFVBQ2xHLENBQUMsRUFDQSxNQUFNLENBQUFRLFNBQU87QUFDVixZQUFBUixNQUFJLE1BQU1RLElBQUc7QUFBQSxVQUNqQixDQUFDO0FBQUEsUUFDTDtBQUFBLE1BQ0osQ0FBQztBQUFBLElBQ0wsQ0FBQyxFQUNBLE1BQU0sU0FBT1IsTUFBSSxNQUFNLGlEQUFpRCxHQUFHLEVBQUUsQ0FBQztBQUFBLEVBQ25GO0FBQUEsRUFLQSxNQUFNLG9CQUFtQjtBQUVyQixRQUFJLHNCQUFjLFlBQVc7QUFDekIsVUFBSTtBQUNBLDhCQUFjLFdBQVcsWUFBWSxLQUFLLFFBQU8sZ0JBQWdCO0FBQUEsTUFDckUsU0FDTSxLQUFJO0FBQ04sUUFBQUEsTUFBSSxNQUFNLDhGQUE4RjtBQUFBLE1BQzVHO0FBQUEsSUFDSixPQUNLO0FBQ0QsV0FBSyxjQUFjO0FBQUEsSUFDdkI7QUFBQSxFQUVIO0FBQUE7QUFBQSxFQUlBLE1BQU0sZ0JBQWU7QUFDbEIsUUFBSTtBQUFFLFVBQUksQ0FBQ0csSUFBRyxXQUFXLEtBQUssT0FBTyxhQUFhLEdBQUU7QUFBRSxRQUFBQSxJQUFHLFVBQVUsS0FBSyxPQUFPLGFBQWE7QUFBQSxNQUFHO0FBQUEsSUFDL0YsU0FBUSxHQUFFO0FBQUUsTUFBQUgsTUFBSSxNQUFNLENBQUM7QUFBQSxJQUFDO0FBR3hCLFFBQUksY0FBYywyQkFBbUI7QUFDckMsUUFBSUcsSUFBRyxXQUFXLFdBQVcsR0FBRTtBQUMzQixVQUFJO0FBQ0EsUUFBQUEsSUFBRyxhQUFhLGFBQWFDLE1BQUssS0FBSyxPQUFPLGVBQWUsdUJBQXVCLENBQUM7QUFBQSxNQUN6RixTQUFTLEdBQUU7QUFBRSxRQUFBSixNQUFJLE1BQU0sK0VBQStFO0FBQUEsTUFBRztBQUFBLElBQzdHO0FBRUEsUUFBSSxjQUFjLEtBQUssZ0JBQWdCLFdBQVcsS0FBSyxPQUFPLE1BQU07QUFDcEUsUUFBSSxhQUFhLEtBQUssZ0JBQWdCLFdBQVc7QUFDakQsUUFBSSxXQUFXLEtBQUssZ0JBQWdCLFdBQVc7QUFDL0MsUUFBSSxRQUFRLEtBQUssZ0JBQWdCLFdBQVc7QUFDNUMsUUFBSSxjQUFjSSxNQUFLLEtBQUssT0FBTyxlQUFlLFdBQVc7QUFHN0QsUUFBSSxhQUFhO0FBQ2pCLFFBQUk7QUFDQSxZQUFNLEtBQUssYUFBYSxLQUFLLE9BQU8sZUFBZSxXQUFXO0FBQzlELFlBQU0sY0FBY0QsSUFBRyxhQUFhLFdBQVc7QUFDL0MsbUJBQWEsWUFBWSxTQUFTLFFBQVE7QUFBQSxJQUM5QyxTQUFRLEdBQUU7QUFBRyxNQUFBSCxNQUFJLE1BQU0sQ0FBQztBQUFBLElBQUc7QUFJM0IsVUFBTSxNQUFNLFdBQVcsUUFBUSxJQUFJLEtBQUssT0FBTyxhQUFhLHdCQUF3QixVQUFVLElBQUksS0FBSztBQUN2RyxVQUFNLEtBQUs7QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsTUFDOUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxNQUFNLFlBQVksVUFBVSxZQUFZLENBQUM7QUFBQSxJQUNwRSxDQUFDLEVBQ0EsS0FBSyxjQUFZLFNBQVMsS0FBSyxDQUFDLEVBQ2hDLEtBQUssVUFBUTtBQUFFLE1BQUFBLE1BQUksS0FBSywrREFBK0QsS0FBSyxPQUFPLEVBQUU7QUFBQSxJQUFHLENBQUMsRUFDekcsTUFBTSxXQUFTO0FBQUMsTUFBQUEsTUFBSSxNQUFNLDZDQUE2QyxLQUFLLEVBQUU7QUFBQSxJQUFHLENBQUM7QUFBQSxFQUN0RjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVlELGFBQWEsV0FBVyxTQUFTO0FBQzdCLFVBQU0sVUFBVSxTQUFTLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEVBQUMsQ0FBQztBQUNyRCxVQUFNLFNBQVNHLElBQUcsa0JBQWtCLE9BQU87QUFDM0MsV0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDeEMsY0FDSyxVQUFVLFdBQVcsS0FBSyxFQUMxQixHQUFHLFNBQVMsU0FBTyxPQUFPLEdBQUcsQ0FBQyxFQUM5QixLQUFLLE1BQU07QUFFaEIsYUFBTyxHQUFHLFNBQVMsTUFBTSxRQUFRLENBQUM7QUFDbEMsY0FBUSxTQUFTO0FBQUEsSUFDakIsQ0FBQyxFQUFFLE1BQU8sV0FBUztBQUFFLE1BQUFILE1BQUksTUFBTSxLQUFLO0FBQUEsSUFBQyxDQUFDO0FBQUEsRUFDMUM7QUFBQTtBQUFBLEVBUUEsTUFBTSxJQUFJO0FBQ04sV0FBTyxJQUFJLFFBQVEsYUFBVyxXQUFXLFNBQVMsRUFBRSxDQUFDO0FBQUEsRUFDekQ7QUFFSDtBQUVBLElBQU8sK0JBQVEsSUFBSSxZQUFZOzs7QWNqbkNoQyxTQUFTLFFBQUFTLGFBQVk7QUFDckIsU0FBUyxhQUFBQyxrQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsT0FBT0MsV0FBUztBQUVoQixJQUFNQyxhQUFZRixXQUFVRCxLQUFJO0FBR2hDLElBQU0sa0JBQWtCO0FBQUEsRUFDcEI7QUFBQSxFQUFTO0FBQUEsRUFDVDtBQUFBLEVBQVE7QUFBQSxFQUNSO0FBQUEsRUFBUTtBQUFBLEVBQ1I7QUFBQSxFQUFTO0FBQUEsRUFDVDtBQUFBLEVBQVM7QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUNBO0FBQUE7QUFBQSxFQUNBO0FBQUE7QUFDSjtBQUtBLGVBQWUsc0JBQXNCLEtBQUs7QUFDdEMsTUFBSTtBQUNBLFVBQU0sVUFBVSxtSEFBbUgsR0FBRztBQUN0SSxVQUFNLEVBQUUsT0FBTyxJQUFJLE1BQU1HLFdBQVUsU0FBUztBQUFBLE1BQ3hDLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxNQUNULFdBQVcsT0FBTztBQUFBLElBQ3RCLENBQUM7QUFFRCxVQUFNLFFBQVEsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLEVBQUUsSUFBSSxVQUFRLEtBQUssS0FBSyxDQUFDLEVBQUUsT0FBTyxVQUFRLElBQUk7QUFDcEYsUUFBSSxNQUFNLFNBQVMsR0FBRztBQUNsQixhQUFPO0FBQUEsSUFDWDtBQUVBLFVBQU0sT0FBTyxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDbEMsVUFBTSxPQUFPLE1BQU0sQ0FBQyxFQUFFLFlBQVk7QUFFbEMsUUFBSSxNQUFNLElBQUksR0FBRztBQUNiLGFBQU87QUFBQSxJQUNYO0FBRUEsV0FBTyxFQUFFLE1BQU0sS0FBSztBQUFBLEVBQ3hCLFNBQVMsT0FBTztBQUNaLElBQUFELE1BQUksTUFBTSxzREFBc0QsR0FBRyxLQUFLLE1BQU0sT0FBTyxFQUFFO0FBQ3ZGLFdBQU87QUFBQSxFQUNYO0FBQ0o7QUFNQSxlQUFlLG1CQUFtQixLQUFLO0FBQ25DLE1BQUk7QUFFQSxVQUFNLENBQUMsYUFBYSxXQUFXLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxNQUNqRCxTQUFTLFNBQVMsR0FBRyxTQUFTLE1BQU0sRUFBRSxNQUFNLE1BQU0sSUFBSTtBQUFBLE1BQ3RELFNBQVMsU0FBUyxHQUFHLFNBQVMsTUFBTSxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQUEsSUFDMUQsQ0FBQztBQUVELFFBQUksYUFBYTtBQUViLFlBQU0sWUFBWSxZQUFZLE1BQU0sa0NBQWtDO0FBQ3RFLFVBQUksV0FBVztBQUNYLGNBQU1FLFNBQVEsZUFBZSxVQUFVLENBQUMsR0FBRyxLQUFLLEVBQUUsWUFBWTtBQUM5RCxjQUFNQyxRQUFPLFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRTtBQUN0QyxlQUFPLEVBQUUsTUFBQUEsT0FBTSxNQUFBRCxNQUFLO0FBQUEsTUFDeEI7QUFBQSxJQUNKO0FBR0EsVUFBTSxVQUFVLFNBQVMsR0FBRztBQUM1QixVQUFNLEVBQUUsT0FBTyxJQUFJLE1BQU1ELFdBQVUsU0FBUztBQUFBLE1BQ3hDLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxNQUNULFdBQVcsT0FBTztBQUFBLElBQ3RCLENBQUM7QUFFRCxVQUFNLFFBQVEsT0FBTyxLQUFLLEVBQUUsTUFBTSxLQUFLO0FBQ3ZDLFFBQUksTUFBTSxTQUFTLEdBQUc7QUFDbEIsYUFBTztBQUFBLElBQ1g7QUFFQSxVQUFNLE9BQU8sU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQ2xDLFVBQU0sT0FBTyxNQUFNLE1BQU0sQ0FBQyxFQUFFLEtBQUssR0FBRyxFQUFFLFlBQVk7QUFFbEQsUUFBSSxNQUFNLElBQUksR0FBRztBQUNiLGFBQU87QUFBQSxJQUNYO0FBRUEsV0FBTyxFQUFFLE1BQU0sS0FBSztBQUFBLEVBQ3hCLFNBQVMsT0FBTztBQUNaLElBQUFELE1BQUksTUFBTSxtREFBbUQsR0FBRyxLQUFLLE1BQU0sT0FBTyxFQUFFO0FBQ3BGLFdBQU87QUFBQSxFQUNYO0FBQ0o7QUFLQSxlQUFlLGVBQWUsS0FBSztBQUMvQixRQUFNLFdBQVcsUUFBUTtBQUV6QixNQUFJLGFBQWEsU0FBUztBQUN0QixXQUFPLE1BQU0sc0JBQXNCLEdBQUc7QUFBQSxFQUMxQyxXQUFXLGFBQWEsV0FBVyxhQUFhLFVBQVU7QUFDdEQsV0FBTyxNQUFNLG1CQUFtQixHQUFHO0FBQUEsRUFDdkM7QUFFQSxTQUFPO0FBQ1g7QUFLQSxlQUFlLGtCQUFrQixLQUFLLFVBQVUsYUFBYTtBQUN6RCxNQUFJLFFBQVEsS0FBSyxRQUFRLEdBQUc7QUFDeEIsSUFBQUEsTUFBSSxLQUFLLDBFQUEwRTtBQUNuRixXQUFPO0FBQUEsRUFDWDtBQUVBLE1BQUksWUFBWSxHQUFHO0FBQ2YsV0FBTztBQUFBLEVBQ1g7QUFFQSxNQUFJLFlBQVksSUFBSSxHQUFHLEdBQUc7QUFDdEIsV0FBTztBQUFBLEVBQ1g7QUFFQSxjQUFZLElBQUksR0FBRztBQUduQixRQUFNLGNBQWMsTUFBTSxlQUFlLEdBQUc7QUFFNUMsTUFBSSxDQUFDLGFBQWE7QUFDZCxXQUFPO0FBQUEsRUFDWDtBQUVBLFFBQU0sRUFBRSxNQUFNLEtBQUssSUFBSTtBQUd2QixFQUFBQSxNQUFJLEtBQUssc0RBQXNELElBQUksVUFBVSxHQUFHLFdBQVcsSUFBSSxHQUFHO0FBR2xHLE1BQUksZ0JBQWdCLEtBQUssYUFBVyxLQUFLLFNBQVMsT0FBTyxDQUFDLEdBQUc7QUFDekQsSUFBQUEsTUFBSSxLQUFLLG1EQUFtRCxJQUFJLEVBQUU7QUFDbEUsV0FBTztBQUFBLEVBQ1gsV0FBVyxLQUFLLFNBQVMsVUFBVSxLQUFLLFFBQVEsR0FBRztBQUMvQyxJQUFBQSxNQUFJLEtBQUsscUVBQXFFO0FBQzlFLFdBQU87QUFBQSxFQUNYLE9BQU87QUFDSCxXQUFPLE1BQU0sa0JBQWtCLE1BQU0sV0FBVyxHQUFHLFdBQVc7QUFBQSxFQUNsRTtBQUNKO0FBS0EsZUFBc0IscUJBQXFCO0FBQ3ZDLE1BQUk7QUFDQSxVQUFNLGVBQWUsTUFBTSxrQkFBa0IsUUFBUSxNQUFNLEdBQUcsb0JBQUksSUFBSSxDQUFDO0FBQ3ZFLElBQUFBLE1BQUksS0FBSywrREFBK0QsWUFBWSxFQUFFO0FBQ3RGLFdBQU8sRUFBRSxTQUFTLE1BQU0sYUFBYTtBQUFBLEVBQ3pDLFNBQVMsT0FBTztBQUNaLElBQUFBLE1BQUksTUFBTSxpRUFBaUUsTUFBTSxPQUFPLEVBQUU7QUFDMUYsV0FBTyxFQUFFLFNBQVMsT0FBTyxjQUFjLE9BQU8sT0FBTyxNQUFNLFFBQVE7QUFBQSxFQUN2RTtBQUNKOzs7QXRCaklBLG9CQUFXLEtBQUs7QUFJaEJJLEtBQUksWUFBWSxhQUFhLFFBQVEsSUFBSTtBQUN6Q0EsS0FBSSxZQUFZLGFBQWEsMkJBQTJCO0FBQ3hEQSxLQUFJLFlBQVksYUFBYSxhQUFhLEdBQUc7QUFFN0MsSUFBSSxRQUFRLGFBQWEsU0FBUTtBQUM3QixFQUFBQSxLQUFJLFlBQVksYUFBYSxvQkFBb0Isb0VBQW9FO0FBQ3JILEVBQUFBLEtBQUksWUFBWSxhQUFhLG1CQUFtQjtBQUNwRCxXQUNTLFFBQVEsYUFBYSxVQUFTO0FBQ25DLEVBQUFBLEtBQUksWUFBWSxhQUFhLG1CQUFtQiw4QkFBOEI7QUFDbEY7QUFNQUMsTUFBSSxXQUFXO0FBQ2ZBLE1BQUksWUFBWSxhQUFhO0FBQzdCQSxNQUFJLGFBQWEsY0FBYztBQUMvQkEsTUFBSSxXQUFXLEtBQUssZ0JBQWdCLE1BQU07QUFBRSxTQUFPLDJCQUFtQjtBQUFTO0FBRS9FQSxNQUFJLFdBQVcsUUFBUSxTQUFTLENBQUMsWUFBWTtBQUV6QyxVQUFRLFFBQVEsT0FBTztBQUFBLElBQ3JCLEtBQUs7QUFBUSxhQUFPLENBQUMsTUFBTSxNQUFNLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNuRyxLQUFLO0FBQVEsYUFBTyxDQUFDLE1BQU0sT0FBTyxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDcEcsS0FBSztBQUFTLGFBQU8sQ0FBQyxNQUFNLElBQUksUUFBUSxLQUFLLE9BQU8sUUFBUSxLQUFLLEtBQUssR0FBRyxJQUFJLE9BQU8sUUFBUSxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ2xHLEtBQUs7QUFBUyxhQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsS0FBSyxPQUFPLFFBQVEsS0FBSyxLQUFLLEdBQUcsSUFBSSxPQUFPLFFBQVEsSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNuRyxLQUFLO0FBQVcsYUFBTyxDQUFDLE1BQU0sUUFBUSxRQUFRLEtBQUssT0FBTyxRQUFRLEtBQUssS0FBSyxHQUFHLElBQUksT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQUEsSUFDeEc7QUFBYSxhQUFPLENBQUMsT0FBTyxRQUFRLElBQUksQ0FBQztBQUFBLEVBQzNDO0FBQ0o7QUFFQUEsTUFBSSxRQUFRO0FBQ1pBLE1BQUksUUFBUSwyQkFBMkI7QUFDdkNBLE1BQUksUUFBUSxxQ0FBcUMsZUFBTyxPQUFPLElBQUksZUFBTyxJQUFJLE1BQU0sUUFBUSxRQUFRLElBQUksZUFBTyxjQUFjLGtCQUFrQixFQUFFLEVBQUU7QUFDbkpBLE1BQUksUUFBUSwyQkFBMkI7QUFDdkNBLE1BQUksS0FBSyw0QkFBNEIsMkJBQW1CLE9BQU8sRUFBRTtBQUNqRSwyQkFBbUIsU0FBUyxRQUFRLGFBQVc7QUFBRSxFQUFBQSxNQUFJLE1BQU0sT0FBTztBQUFFLENBQUM7QUFHckVBLE1BQUksTUFBTSwyQkFBMkIsUUFBUSxTQUFTLFFBQVEsRUFBRTtBQUNoRUEsTUFBSSxNQUFNLDJCQUEyQixRQUFRLFNBQVMsTUFBTSxFQUFFO0FBQzlEQSxNQUFJLE1BQU0sdUJBQXVCLFFBQVEsU0FBUyxJQUFJLEVBQUU7QUFDeERBLE1BQUksTUFBTSxxQkFBcUIsUUFBUSxTQUFTLEVBQUUsRUFBRTtBQUNwREEsTUFBSSxNQUFNLGFBQWEsUUFBUSxRQUFRLElBQUksUUFBUSxJQUFJLEVBQUU7QUFDekRBLE1BQUksTUFBTSxlQUFlLFFBQVEsSUFBSSxFQUFFO0FBR3ZDLHNCQUFjLEtBQUsseUJBQWlCLGNBQU07QUFDMUMsNkJBQVksS0FBSyx5QkFBaUIsY0FBTTtBQUN4QyxtQkFBVyxLQUFLLHlCQUFpQixnQkFBUSx1QkFBZSw0QkFBVztBQUduRUMsTUFBSyxtQkFBbUIsSUFBSTtBQUc1QixJQUFJLENBQUNGLEtBQUksMEJBQTBCLEdBQUc7QUFDbEMsRUFBQUMsTUFBSSxLQUFLLG1EQUFtRDtBQUM1RCxFQUFBRCxLQUFJLEtBQUs7QUFDVCxVQUFRLEtBQUssQ0FBQztBQUNsQjtBQUVBQSxLQUFJLEdBQUcsbUJBQW1CLE1BQU07QUFDNUIsRUFBQUMsTUFBSSxLQUFLLGtHQUFrRztBQUMzRyxNQUFJLHNCQUFjLFlBQVk7QUFDMUIsUUFBSSxzQkFBYyxXQUFXLFlBQVksS0FBSyxDQUFDLHNCQUFjLFdBQVcsVUFBVSxHQUFHO0FBQ2pGLDRCQUFjLFdBQVcsS0FBSztBQUM5Qiw0QkFBYyxXQUFXLFFBQVE7QUFBQSxJQUNyQztBQUNBLDBCQUFjLFdBQVcsTUFBTTtBQUFBLEVBQ25DO0FBQ0osQ0FBQztBQU9ELElBQU1FLGFBQVksWUFBWTtBQUU5QixlQUFPLGdCQUFnQiwyQkFBbUI7QUFDMUMsZUFBTyxnQkFBZ0IsMkJBQW1CO0FBQzFDLGVBQU8sZ0JBQWdCLDJCQUFtQjtBQUMxQyxlQUFPLGdCQUFnQixlQUFPO0FBRzlCLElBQUksQ0FBQ0MsSUFBRyxXQUFXLGVBQU8sYUFBYSxHQUFFO0FBQUUsRUFBQUEsSUFBRyxVQUFVLGVBQU8sZUFBZSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUc7QUFDcEcsSUFBSSxDQUFDQSxJQUFHLFdBQVcsZUFBTyxhQUFhLEdBQUU7QUFBRSxFQUFBQSxJQUFHLFVBQVUsZUFBTyxlQUFlLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBRztBQUNwRyxJQUFJLENBQUNBLElBQUcsV0FBVywyQkFBbUIsV0FBVyxHQUFHO0FBQUcsRUFBQUEsSUFBRyxVQUFVLDJCQUFtQixhQUFhLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBRztBQUcxSCxJQUFNLFdBQVdDLE1BQUssS0FBSywyQkFBbUIsYUFBYSxlQUFPLGVBQWU7QUFDakYsSUFBSTtBQUFDLEVBQUFELElBQUcsV0FBVyxRQUFRO0FBQUUsU0FBTyxHQUFFO0FBQUM7QUFDdkMsSUFBSTtBQUFJLE1BQUksQ0FBQ0EsSUFBRyxXQUFXLFFBQVEsR0FBRztBQUFFLElBQUFBLElBQUcsWUFBWSxlQUFPLGVBQWUsVUFBVSxVQUFVO0FBQUEsRUFBRztBQUFDLFNBQy9GLEdBQUU7QUFBQyxFQUFBSCxNQUFJLE1BQU0sNkNBQTZDO0FBQUM7QUFHakUsSUFBSTtBQUNBLFFBQU0sRUFBRSxTQUFTLFdBQVcsTUFBSyxJQUFJSyxjQUFhO0FBQ2xELGlCQUFPLFNBQVNDLElBQUcsUUFBUSxLQUFLO0FBQ2hDLGlCQUFPLFVBQVU7QUFDckIsU0FDUSxHQUFHO0FBQ1IsRUFBQU4sTUFBSSxNQUFNLDBEQUEwRDtBQUNwRSxpQkFBTyxTQUFTTSxJQUFHLFFBQVE7QUFDM0IsRUFBQU4sTUFBSSxLQUFLLFlBQVksZUFBTyxNQUFNLEVBQUU7QUFDcEMsaUJBQU8sVUFBVTtBQUNuQjtBQUdPLHFCQUFhLGVBQU8sYUFBYTtBQVl6QyxRQUFRLE9BQU8sR0FBRyxTQUFTLENBQUMsUUFBUTtBQUFFLE1BQUksSUFBSSxTQUFTLFNBQVM7QUFBRSxJQUFBQSxNQUFJLFdBQVcsUUFBUSxRQUFRO0FBQUEsRUFBTTtBQUFFLENBQUM7QUFHMUcsSUFBTSxzQkFBc0IsUUFBUSxPQUFPO0FBQzNDLElBQU0sc0JBQXNCLFFBQVEsT0FBTztBQUUzQyxRQUFRLE9BQU8sUUFBUSxTQUFTLE9BQU8sVUFBVSxJQUFJO0FBQ2pELFFBQU0sV0FBVyxPQUFPLFNBQVMsS0FBSztBQUV0QyxNQUFJLFNBQVMsU0FBUyx5QkFBeUIsTUFBTSxTQUFTLFNBQVMsYUFBYSxLQUFLLFNBQVMsU0FBUyxNQUFNLElBQUk7QUFDakgsV0FBTztBQUFBLEVBQ1g7QUFFQSxNQUFJLFNBQVMsU0FBUywyQkFBMkIsS0FBSyxTQUFTLFNBQVMsdUNBQXVDLEdBQUc7QUFDOUcsVUFBTSxnQkFBZ0IsQ0FBQyxJQUFJLE1BQU0sTUFBTSxJQUFJO0FBQzNDLFFBQUksU0FBUyxTQUFTLG9CQUFvQixLQUFLLGNBQWMsS0FBSyxVQUFRLFNBQVMsU0FBUyxjQUFjLElBQUksRUFBRSxDQUFDLEdBQUc7QUFDaEgsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQ0EsU0FBTyxvQkFBb0IsTUFBTSxNQUFNLFNBQVM7QUFDcEQ7QUFFQSxRQUFRLE9BQU8sUUFBUSxTQUFTLE9BQU8sVUFBVSxJQUFJO0FBQ2pELFFBQU0sV0FBVyxPQUFPLFNBQVMsS0FBSztBQUV0QyxNQUFJLFNBQVMsU0FBUyx5QkFBeUIsTUFBTSxTQUFTLFNBQVMsYUFBYSxLQUFLLFNBQVMsU0FBUyxNQUFNLElBQUk7QUFDakgsV0FBTztBQUFBLEVBQ1g7QUFFQSxNQUFJLFNBQVMsU0FBUywyQkFBMkIsS0FBSyxTQUFTLFNBQVMsdUNBQXVDLEdBQUc7QUFDOUcsVUFBTSxnQkFBZ0IsQ0FBQyxJQUFJLE1BQU0sTUFBTSxJQUFJO0FBQzNDLFFBQUksU0FBUyxTQUFTLG9CQUFvQixLQUFLLGNBQWMsS0FBSyxVQUFRLFNBQVMsU0FBUyxjQUFjLElBQUksRUFBRSxDQUFDLEdBQUc7QUFDaEgsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQ0EsU0FBTyxvQkFBb0IsTUFBTSxNQUFNLFNBQVM7QUFDcEQ7QUFFQSxRQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBUTtBQUNyQyxNQUFJLElBQUksU0FBUyxTQUFTO0FBQ3RCLElBQUFBLE1BQUksV0FBVyxRQUFRLFFBQVE7QUFDL0IsSUFBQUEsTUFBSSxLQUFLLGtHQUFrRztBQUFBLEVBQy9HLFdBQ1MsSUFBSSxTQUFTLFNBQVMsMkJBQTJCLEVBQUc7QUFBQSxPQUN4RDtBQUFHLElBQUFBLE1BQUksTUFBTSw2QkFBNkIsSUFBSSxPQUFPO0FBQUEsRUFBRztBQUNqRSxDQUFDO0FBR0QsUUFBUSxHQUFHLHNCQUFzQixDQUFDLFFBQVEsWUFBWTtBQUNsRCxFQUFBQSxNQUFJLE1BQU0sMkRBQTJELE1BQU07QUFDM0UsTUFBSSxrQkFBa0IsT0FBTztBQUN6QixJQUFBQSxNQUFJLE1BQU0scUNBQXFDLE9BQU8sS0FBSztBQUFBLEVBQy9EO0FBQ0osQ0FBQztBQUdERCxLQUFJLEdBQUcsdUJBQXVCLENBQUMsT0FBT1EsY0FBYSxZQUFZO0FBQzNELEVBQUFQLE1BQUksTUFBTSxzREFBc0Q7QUFDaEUsRUFBQUEsTUFBSSxNQUFNLHVDQUF1QyxRQUFRLE1BQU07QUFDL0QsRUFBQUEsTUFBSSxNQUFNLDBDQUEwQyxRQUFRLFFBQVE7QUFHcEUsUUFBTSxhQUFhUSxlQUFjLGNBQWM7QUFDL0MsUUFBTSxnQkFBZ0IsV0FBVyxLQUFLLFNBQU8sSUFBSSxZQUFZLE9BQU9ELGFBQVksRUFBRTtBQUVsRixNQUFJLGVBQWU7QUFDZixJQUFBUCxNQUFJLE1BQU0sNkNBQTZDLGNBQWMsU0FBUyxDQUFDLEVBQUU7QUFHakYsUUFBSSxrQkFBa0Isc0JBQWMsWUFBWTtBQUM1QyxNQUFBQSxNQUFJLEtBQUssaUZBQWlGO0FBQzFGLFVBQUk7QUFDQSxZQUFJLENBQUMsY0FBYyxZQUFZLEdBQUc7QUFDOUIsd0JBQWMsUUFBUTtBQUFBLFFBQzFCO0FBQ0EsOEJBQWMsYUFBYTtBQUMzQiw4QkFBYyxnQkFBZ0I7QUFBQSxNQUNsQyxTQUFTLEtBQUs7QUFDVixRQUFBQSxNQUFJLE1BQU0sMERBQTBELEdBQUc7QUFBQSxNQUMzRTtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBR0EsUUFBTSxlQUFlO0FBQ3pCLENBQUM7QUFHREQsS0FBSSxHQUFHLHNCQUFzQixDQUFDLE9BQU8sWUFBWTtBQUM3QyxFQUFBQyxNQUFJLE1BQU0sa0RBQWtEO0FBQzVELEVBQUFBLE1BQUksTUFBTSxvQ0FBb0MsUUFBUSxJQUFJO0FBQzFELEVBQUFBLE1BQUksTUFBTSxzQ0FBc0MsUUFBUSxNQUFNO0FBQzlELEVBQUFBLE1BQUksTUFBTSx5Q0FBeUMsUUFBUSxRQUFRO0FBR25FLFFBQU0sZUFBZTtBQUN6QixDQUFDO0FBR0QsSUFBSSxRQUFRLGFBQWEsU0FBUztBQUFHLEVBQUFELEtBQUksa0JBQWtCQSxLQUFJLFFBQVEsQ0FBQztBQUFDO0FBTXpFLFFBQVEsSUFBSSw4QkFBOEIsSUFBSTtBQUM5QyxRQUFRLElBQUksK0JBQStCO0FBQzNDLElBQU0sc0JBQXNCLFFBQVE7QUFDcEMsUUFBUSxjQUFjLENBQUMsU0FBUyxZQUFZO0FBQ3hDLE1BQUksV0FBVyxRQUFRLFlBQVksUUFBUSxTQUFTLDhCQUE4QixHQUFHO0FBQUc7QUFBQSxFQUFPO0FBQy9GLFNBQU8sb0JBQW9CLEtBQUssU0FBUyxTQUFTLE9BQU87QUFDN0Q7QUFFQUEsS0FBSSxHQUFHLHFCQUFxQixDQUFDLE9BQU9RLGNBQWEsS0FBSyxPQUFPLGFBQWEsYUFBYTtBQUNuRixRQUFNLGVBQWU7QUFDckIsV0FBUyxJQUFJO0FBQ2pCLENBQUM7QUFHRFIsS0FBSSxHQUFHLHdCQUF3QixDQUFDLE9BQU9RLGlCQUFnQjtBQUNuRCxRQUFNLGdCQUFnQixDQUFDLElBQUksTUFBTSxNQUFNLElBQUk7QUFHM0MsTUFBSUEsYUFBWSx1QkFBd0I7QUFDeEMsRUFBQUEsYUFBWSx5QkFBeUI7QUFHckMsUUFBTSx3QkFBd0IsTUFBTTtBQUVoQyxJQUFBQSxhQUFZLG1CQUFtQiwyQkFBMkI7QUFDMUQsSUFBQUEsYUFBWSxtQkFBbUIsZUFBZTtBQUU5QyxJQUFBQSxhQUFZLEdBQUcsNkJBQTZCLENBQUNFLFFBQU8sV0FBVyxrQkFBa0IsY0FBYyxhQUFhLGdCQUFnQixtQkFBbUI7QUFFM0ksVUFBSSxDQUFDLGVBQWUsY0FBYyxTQUFTLFNBQVMsR0FBRztBQUNuRCxRQUFBQSxPQUFNLGVBQWU7QUFDckI7QUFBQSxNQUNKO0FBQ0EsTUFBQVQsTUFBSSxLQUFLLDJDQUEyQyxTQUFTLE1BQU0sZ0JBQWdCLGFBQWEsWUFBWSxFQUFFO0FBQUEsSUFDbEgsQ0FBQztBQUVELElBQUFPLGFBQVksR0FBRyxpQkFBaUIsQ0FBQ0UsUUFBTyxXQUFXLGtCQUFrQixjQUFjLGFBQWEsZ0JBQWdCLG1CQUFtQjtBQUUvSCxVQUFJLENBQUMsZUFBZSxjQUFjLFNBQVMsU0FBUyxHQUFHO0FBQ25ELFFBQUFBLE9BQU0sZUFBZTtBQUNyQjtBQUFBLE1BQ0o7QUFDQSxNQUFBVCxNQUFJLEtBQUssK0JBQStCLFNBQVMsTUFBTSxnQkFBZ0IsYUFBYSxZQUFZLEVBQUU7QUFBQSxJQUN0RyxDQUFDO0FBQUEsRUFDTDtBQUdBLHdCQUFzQjtBQUd0QixFQUFBTyxhQUFZLEdBQUcsd0JBQXdCLHFCQUFxQjtBQUM1RCxFQUFBQSxhQUFZLEdBQUcsc0JBQXNCLHFCQUFxQjtBQUcxRCxFQUFBQSxhQUFZLEdBQUcsdUJBQXVCLENBQUNFLFFBQU8sWUFBWTtBQUN0RCxJQUFBVCxNQUFJLE1BQU0sMkZBQTJGO0FBQ3JHLElBQUFBLE1BQUksTUFBTSxtREFBbUQsUUFBUSxNQUFNO0FBQzNFLElBQUFBLE1BQUksTUFBTSxzREFBc0QsUUFBUSxRQUFRO0FBR2hGLFVBQU0sYUFBYVEsZUFBYyxjQUFjO0FBQy9DLFVBQU0sZ0JBQWdCLFdBQVcsS0FBSyxTQUFPLElBQUksWUFBWSxPQUFPRCxhQUFZLEVBQUU7QUFFbEYsUUFBSSxlQUFlO0FBQ2YsTUFBQVAsTUFBSSxNQUFNLHlEQUF5RCxjQUFjLFNBQVMsQ0FBQyxFQUFFO0FBQzdGLE1BQUFBLE1BQUksTUFBTSx1REFBdUQsY0FBYyxZQUFZLE9BQU8sQ0FBQyxFQUFFO0FBR3JHLFVBQUksa0JBQWtCLHNCQUFjLFlBQVk7QUFDNUMsUUFBQUEsTUFBSSxLQUFLLDZGQUE2RjtBQUN0RyxZQUFJO0FBQ0EsY0FBSSxDQUFDLGNBQWMsWUFBWSxHQUFHO0FBQzlCLDBCQUFjLFFBQVE7QUFBQSxVQUMxQjtBQUNBLGdDQUFjLGFBQWE7QUFDM0IsZ0NBQWMsZ0JBQWdCO0FBQUEsUUFDbEMsU0FBUyxLQUFLO0FBQ1YsVUFBQUEsTUFBSSxNQUFNLHNFQUFzRSxHQUFHO0FBQUEsUUFDdkY7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUdBLElBQUFTLE9BQU0sZUFBZTtBQUFBLEVBQ3pCLENBQUM7QUFDTCxDQUFDO0FBRURWLEtBQUksR0FBRyxxQkFBcUIsWUFBWTtBQUNwQyxnQkFBZSw2QkFBWSxzQkFBdUI7QUFDbEQsTUFBSSxzQkFBYyxxQkFBcUIsS0FBTSx1QkFBYyxvQkFBb0IsS0FBSztBQUNwRixNQUFJLDZCQUFZLGlCQUFpQixLQUFNLDhCQUFZLGdCQUFnQixLQUFLO0FBQ3hFLE1BQUksNkJBQVkscUJBQXFCLEtBQU0sOEJBQVksb0JBQW9CLEtBQUs7QUFDaEYsTUFBSSx3QkFBZ0IsdUJBQXVCLEtBQU0seUJBQWdCLHNCQUFzQixLQUFLO0FBQzVGLHdCQUFjLGFBQWE7QUFFM0IsTUFBSTtBQUNBLFVBQU0sUUFBUSxlQUFlLGlCQUFpQixDQUFDLENBQUM7QUFBQSxFQUNwRCxTQUFTLEtBQUs7QUFDVixJQUFBQyxNQUFJLE1BQU0scURBQXFELEdBQUc7QUFBQSxFQUN0RTtBQUNBLEVBQUFELEtBQUksS0FBSztBQUNiLENBQUM7QUFFREEsS0FBSSxHQUFHLGFBQWEsTUFBTTtBQUN0QixFQUFBVyxxQkFBb0IsS0FBSztBQUM3QixDQUFDO0FBRURYLEtBQUksR0FBRyxZQUFZLE1BQU07QUFDckIsUUFBTSxhQUFhUyxlQUFjLGNBQWM7QUFDL0MsTUFBSSxXQUFXLFFBQVE7QUFBRSxlQUFXLENBQUMsRUFBRSxNQUFNO0FBQUEsRUFBRSxPQUMxQztBQUFFLDBCQUFjLGlCQUFpQjtBQUFBLEVBQUU7QUFDNUMsQ0FBQztBQUtELGVBQWUsd0JBQXdCO0FBQ25DLE1BQUk7QUFDQSxVQUFNLFNBQVMsTUFBTSxtQkFBbUI7QUFDeEMsUUFBSSxDQUFDLE9BQU8sU0FBUztBQUNqQixNQUFBUixNQUFJLE1BQU0sdUJBQXVCLE9BQU8sS0FBSztBQUM3QztBQUFBLElBQ0o7QUFFQSxRQUFJLE9BQU8sY0FBYztBQUNyQixNQUFBQSxNQUFJLEtBQUssaUVBQWlFO0FBQzFFLE1BQUFXLFFBQU8sbUJBQW1CLHNCQUFjLFlBQVk7QUFBQSxRQUNoRCxNQUFNO0FBQUEsUUFDTixTQUFTLENBQUMsSUFBSTtBQUFBLFFBQ2QsT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLE1BQ2IsQ0FBQztBQUNELDRCQUFjLFdBQVcsWUFBWTtBQUNyQyxNQUFBWixLQUFJLEtBQUs7QUFBQSxJQUNiLE9BQU87QUFDSCxNQUFBQyxNQUFJLEtBQUssNkNBQTZDO0FBQUEsSUFDMUQ7QUFBQSxFQUNKLFNBQVMsT0FBTztBQUNaLElBQUFBLE1BQUksTUFBTSw2QkFBNkIsS0FBSztBQUFBLEVBQ2hEO0FBQ0o7QUFFQUQsS0FBSSxVQUFVLEVBQ2IsS0FBSyxZQUFVO0FBRVosY0FBWSxjQUFjO0FBQzFCLFVBQVEsZUFBZSxhQUFhLGFBQWEsZUFBTyxPQUFPLEtBQUssZUFBTyxJQUFJLEtBQUssUUFBUSxRQUFRLEVBQUU7QUFDdEcsVUFBUSxlQUFlLHlCQUF5QixDQUFDLFNBQVMsYUFBYTtBQUFFLGFBQVMsQ0FBQztBQUFBLEVBQUcsQ0FBQztBQUV2RixFQUFBVyxxQkFBb0IsSUFBSTtBQUd4Qix3QkFBYyxpQkFBaUI7QUFHL0IsTUFBSSxlQUFPLFVBQVUsYUFBYTtBQUFFLG1CQUFPLFNBQVM7QUFBQSxFQUFNO0FBQzFELE1BQUksZUFBTyxRQUFRO0FBQUUsNEJBQWdCLEtBQUssZUFBTyxPQUFPO0FBQUEsRUFBRztBQUUzRCxRQUFNLFlBQVksQ0FBQywyQkFBbUIsU0FBUztBQUMvQyxNQUFJLENBQUMsZUFBTyxhQUFZO0FBQ3BCLHFCQUFpQixNQUFNLHVCQUF1QjtBQUM5QyxRQUFJLFdBQVc7QUFBRSx1QkFBaUIsSUFBSTtBQUFBLElBQUcsT0FDcEM7QUFBRSxNQUFBVixNQUFJLEtBQUssbURBQW1EO0FBQUEsSUFBRztBQUN0RSwwQkFBc0I7QUFBQSxFQUMxQjtBQUNBLE1BQUksZUFBTyxhQUFZO0FBQ25CLElBQUFZLGdCQUFlLFNBQVMsNEJBQTRCLE1BQU07QUFBRyxVQUFJLFVBQVUsT0FBTyxJQUFHO0FBQUUsZUFBTyxHQUFHLEVBQUMsTUFBSyxTQUFRLFdBQVcsUUFBTyxDQUFDO0FBQUcsZUFBTyxHQUFHLEVBQUMsTUFBSyxTQUFRLFdBQVcsUUFBTyxDQUFDO0FBQUEsTUFBSTtBQUFBLElBQUMsQ0FBQztBQUN0TCxJQUFBQSxnQkFBZSxTQUFTLDRCQUE0QixNQUFNO0FBQUcsWUFBTSxNQUFNSixlQUFjLGlCQUFpQjtBQUFHLFVBQUksS0FBSztBQUFFLFlBQUksWUFBWSxlQUFlO0FBQUEsTUFBRTtBQUFBLElBQUMsQ0FBQztBQUFBLEVBQzdKO0FBR0EsRUFBQUksZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLE1BQU0sTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0QyxFQUFBQSxnQkFBZSxTQUFTLDRCQUE0QixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQzVELEVBQUFBLGdCQUFlLFNBQVMsVUFBVSxNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQzFDLEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLFlBQVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFDL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZXhlY1N5bmMiLCAiZXhlY1N5bmMiLCAibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgImdsb2JhbFNob3J0Y3V0IiwgIlRyYXkiLCAiTWVudSIsICJkaWFsb2ciLCAibG9nIiwgImxvZyIsICJwYXRoIiwgImZzIiwgImlwIiwgImdhdGV3YXk0c3luYyIsICJmcyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAibG9nIiwgImNvbmZpZ1N0b3JlIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJsb2ciLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgIl9fZGlybmFtZSIsICJhcHBzVG9DbG9zZSIsICJwdWJsaWNCYXNlIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJhcHAiLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgImxvZyIsICJhcHBzVG9DbG9zZSIsICJjaGlsZFByb2Nlc3MiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAibG9nIiwgInBhdGgiLCAiX19kaXJuYW1lIiwgImFwcCIsICJqb2luIiwgImZzIiwgImNvbmZpZyIsICJsb2ciLCAiZnMiLCAiam9pbiIsICJzY3JlZW4iLCAiaXBjTWFpbiIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJ3ZWJDb250ZW50cyIsICJwYXRoIiwgImZzIiwgImNsaXBib2FyZCIsICJhcHAiLCAib3MiLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJzcGF3biIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJzcGF3biIsICJsb2ciLCAicHJvY2VzcyIsICJmcyIsICJwYXRoIiwgIm9zIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInB1YmxpY0Jhc2UiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgInB1YmxpY0Jhc2UiLCAibG9nIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgIndlYkNvbnRlbnRzIiwgInNjcmVlbiIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
