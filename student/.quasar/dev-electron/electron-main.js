// src-electron/main/scripts/platformDispatcher.js
import { execSync as execSync2 } from "child_process";
import fs from "fs";
import { join } from "path";
import { app } from "electron";
import log from "electron-log";

// src-electron/main/config.js
var config = {
  development: false,
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
dotenv.config();
var __dirname = import.meta.dirname;
function getPackagedPublicBase() {
  const unpacked = join(process.resourcesPath, "app.asar.unpacked");
  const withPublic = join(unpacked, "public");
  return fs.existsSync(withPublic) ? withPublic : unpacked;
}
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
        const base = getPackagedPublicBase();
        this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(base, this.jre));
        return join(base, this.jre);
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
        return join(getPackagedPublicBase(), this.jre);
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
    const baseDir = app.isPackaged ? getPackagedPublicBase() : join(import.meta.dirname, "../../public");
    const workerPath = join(baseDir, this.workerFileName);
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
  /** Resolved base path for public assets when packaged (Quasar: app root; old build: app.asar.unpacked/public). In dev returns project public dir. */
  getPackagedPublicBase() {
    return app.isPackaged ? getPackagedPublicBase() : join(__dirname, "../../public");
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
function getRendererIndexPath() {
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
      blockwin.loadFile(getRendererIndexPath(), { hash: `#/${url}/` });
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
      screenlockWindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/` });
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
        this.examwindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/${token}` });
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
        this.examwindow.loadFile(getRendererIndexPath(), { hash: `#/${url}/${token}` });
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
      const filePath = getRendererIndexPath();
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
import fs5 from "fs";
import archiver from "archiver";
import extract from "extract-zip";
import { join as join5 } from "path";
import { screen as screen2, ipcMain as ipcMain2, app as app8, BrowserWindow as BrowserWindow2, webContents as webContents2 } from "electron";

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
var publicBase = () => app4.isPackaged ? platformDispatcher_default.getPackagedPublicBase() : path4.join(__dirname5, "../../public");
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
import { app as app5, Tray, Menu } from "electron";
import path5 from "path";
import log10 from "electron-log";
var __dirname6 = import.meta.dirname;
var tray = null;
function getTrayIconPath() {
  const publicBase2 = platformDispatcher_default.getPackagedPublicBase();
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
        let filepath = path6.join(__dirname7, "../../public", filename);
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
        pdfPath = path6.join(platformDispatcher_default.getPackagedPublicBase(), pdfFilename);
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
      if (process.platform === "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = platformDispatcher_default.getPackagedPublicBase();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuZG90ZW52LmNvbmZpZygpO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gV2hlbiBwYWNrYWdlZDogUXVhc2FyIHB1dHMgcHVibGljIGNvbnRlbnRzIGF0IGFwcCByb290OyBvbGQgYnVpbGQgaGFkIHB1YmxpYy8gc3ViZGlyLiBSZXNvbHZlIGF0IHJ1bnRpbWUuXG5mdW5jdGlvbiBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSB7XG4gIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcpO1xuICBjb25zdCB3aXRoUHVibGljID0gam9pbih1bnBhY2tlZCwgJ3B1YmxpYycpO1xuICByZXR1cm4gZnMuZXhpc3RzU3luYyh3aXRoUHVibGljKSA/IHdpdGhQdWJsaWMgOiB1bnBhY2tlZDtcbn1cblxuXG5cbmNsYXNzIFBsYXRmb3JtRGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcblxuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMuYXJjaCA9IHRoaXMuX25vcm1hbGl6ZUFyY2goKTtcbiAgICB0aGlzLmRpc3BsYXlTZXJ2ZXIgPSB0aGlzLl9nZXREaXNwbGF5U2VydmVyKCk7XG4gICAgdGhpcy5pc0tERSA9IHRoaXMuX2lzS0RFKCk7XG4gICAgdGhpcy5pc0dOT01FID0gdGhpcy5faXNHTk9NRSgpO1xuICAgIHRoaXMuZmxhbWVzaG90ID0gdGhpcy5fZ2V0VmVyc2lvbignZmxhbWVzaG90Jyk7XG4gICAgdGhpcy5pbWFnZW1hZ2ljayA9IHRoaXMuX2dldFZlcnNpb24oJ2NvbnZlcnQnKTtcbiAgICB0aGlzLmltVmVyc2lvbiA9IHRoaXMuX2dldEltYWdlTWFnaWNrVmVyc2lvbigpO1xuICAgIHRoaXMud29ya2VyRmlsZU5hbWUgPSB0aGlzLl9nZXRXb3JrZXJGaWxlTmFtZSgpO1xuICAgIHRoaXMudXNlV29ya2VyID0gdGhpcy5fZ2V0VXNlV29ya2VyKCk7XG4gICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IHRoaXMuX2dldFNjcmVlbnNob3RBYmlsaXR5KCk7XG4gICAgdGhpcy5qcmUgPSB0aGlzLl9kZXRlY3RKUkVJZCgpO1xuICAgIHRoaXMuanJlRGlyID0gdGhpcy5fcmVzb2x2ZUpSRURpcigpO1xuICAgIHRoaXMuamF2YUJpbiA9IHRoaXMuX3Jlc29sdmVKYXZhQmluKCk7XG4gICAgdGhpcy5qcmVJbmZvID0gdGhpcy5fZ2V0SlJFKCk7XG4gICAgXG4gICAgdGhpcy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpO1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICAgIHRoaXMud29ya2VyVVJMID0gdGhpcy5fZ2V0V29ya2VyVVJMKCk7XG4gICAgdGhpcy50ZW1wZGlyZWN0b3J5ID0gdGhpcy5fZ2V0VGVtcGRpcmVjdG9yeSgpO1xuICAgIHRoaXMud29ya2RpcmVjdG9yeSA9IHRoaXMuX2dldFdvcmtkaXJlY3RvcnkoKTtcbiAgICB0aGlzLmxvZ2ZpbGUgPSB0aGlzLl9nZXRMb2dmaWxlKCk7XG5cbiAgfVxuXG4gIF9nZXRXb3JrZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKHRoaXMuaG9tZWRpcmVjdG9yeSwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7XG4gIH1cblxuICBfZ2V0VGVtcGRpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbihvcy50bXBkaXIoKSwgJ2V4YW0tdG1wJyk7XG4gIH1cblxuXG4gIF9nZXRMb2dmaWxlKCkge1xuICAgIHJldHVybiBqb2luKHRoaXMud29ya2RpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpO1xuICB9XG5cbiAgX25vcm1hbGl6ZUFyY2goKSB7XG4gICAgaWYgKHRoaXMuX2FyY2ggPT09ICdpYTMyJykgcmV0dXJuICdpNTg2JztcbiAgICBpZiAoWyd4NjQnLCAnYXJtNjQnXS5pbmNsdWRlcyh0aGlzLl9hcmNoKSkgcmV0dXJuIHRoaXMuX2FyY2g7XG4gICAgdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlOiAke3RoaXMuX2FyY2h9YCk7XG4gIH1cblxuICBfZGV0ZWN0SlJFSWQoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHJldHVybiAnbWluaW1hbC1qcmUtMTEtbGluJztcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgcmV0dXJuIHRoaXMuX2FyY2ggPT09ICdhcm02NCcgPyAnbWluaW1hbC1qcmUtMTEtbWFjLWFybTY0JyA6ICdtaW5pbWFsLWpyZS0xMS1tYWMnO1xuICAgIH1cbiAgfVxuXG5cblxuXG5cbiAgLyoqXG4gICAqIFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBAZGVzY3JpcHRpb24gdGhpcyBmdW5jdGlvbiByZXNvbHZlcyB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBpdCBmaXJzdCBjaGVja3MgaWYgdGhlIHVzZUJ1bmRsZWRKUkUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0IHRvIHRydWVcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IGNoZWNrcyBpZiB0aGUgc3lzdGVtIGpyZSBpcyBpbnN0YWxsZWRcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIHN5c3RlbSBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIHRoZSBidW5kbGVkIGpyZSBpcyBsb2NhdGVkIGluIHRoZSBwdWJsaWMgZGlyZWN0b3J5IG9mIHRoZSBhcHBcbiAgICogXG4gICAqIEZJWE1FOiBpZiBzeXN0ZW0ganJlIGlzIHNlbGVjdGVkIGJ5IEVOViBkbyBub3QgaW5jbHVkZSB0aGUganJlIGRpcmVjdG9yeSBpbiB0aGUgZmluYWwgYnVpbGRcbiAgICovXG5cbiAgX3Jlc29sdmVKUkVEaXIoKSB7XG4gICAgLy8gdXNlIGJ1bmRsZWQganJlIGJlY2F1c2UgaXRzIHNtYWxsZXIgYW5kIHByb3ZpZGVzIG9ubHkgdGhlIG5lZWRlZCBqYXZhIG1vZHVsZXNcbiAgICBpZiAoY29uZmlnLnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICBjb25zdCBiYXNlID0gZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKGJhc2UsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKGJhc2UsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgdGhpcy5qcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9yZXNvbHZlSmF2YUJpbigpIHtcbiAgICBzd2l0Y2ggKHRoaXMucGxhdGZvcm0pIHtcbiAgICAgIGNhc2UgJ2Rhcndpbic6IHJldHVybiBbJ2JpbicsICdqYXZhJ107XG4gICAgICBjYXNlICd3aW4zMic6IHJldHVybiBbJ2JpbicsICdqYXZhdy5leGUnXTtcbiAgICAgIGNhc2UgJ2xpbnV4JzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGRlZmF1bHQ6IHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3RoaXMucGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gIT09ICdsaW51eCcpIHJldHVybiAnbi9hJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJykgcmV0dXJuICd3YXlsYW5kJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd4MTEnIHx8IHRoaXMuX2Vudi5ESVNQTEFZKSByZXR1cm4gJ3gxMSc7XG4gICAgcmV0dXJuICd1bmtub3duJztcbiAgfVxuXG4gIF9nZXRWZXJzaW9uKGNtZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYyhgJHtjbWR9IC0tdmVyc2lvbmAsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS5zcGxpdCgnXFxuJylbMF07XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC9bXFxkXSsoXFwuW1xcZF0rKSsvKTtcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uOiB2ZXJzaW9uPy5bMF0gfHwgJ3Vua25vd24nIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0SlJFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYygnamF2YSAtdmVyc2lvbicsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAnaWdub3JlJywgJ3BpcGUnXSB9KTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL3ZlcnNpb24gXCIoW1xcZC5fXSspXCIvKT8uWzFdIHx8ICd1bmtub3duJztcbiAgICAgIGNvbnN0IGphdmFIb21lID0gdGhpcy5fZW52LkpBVkFfSE9NRSB8fCAnJztcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uLCBwYXRoOiBqYXZhSG9tZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsLCBwYXRoOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldFdvcmtlckZpbGVOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLnBsYXRmb3JtID09PSAnbGludXgnID8gJ2ltYWdlV29ya2VyTGludXgubWpzJyA6ICdpbWFnZVdvcmtlclNoYXJwLm1qcyc7XG4gIH1cblxuICBfZ2V0V29ya2VyVVJMKCkge1xuICAgIGNvbnN0IGJhc2VEaXIgPSBhcHAuaXNQYWNrYWdlZCA/IGdldFBhY2thZ2VkUHVibGljQmFzZSgpIDogam9pbihpbXBvcnQubWV0YS5kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4oYmFzZURpciwgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwod29ya2VyUGF0aCk7XG4gIH1cblxuICBpc1dheWxhbmQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7XG4gIH1cblxuICBfaXNLREUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgcmV0dXJuIG91dCA9PT0gJ0tERSc7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNLREU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzR05PTUUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCdnbm9tZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzR05PTUU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzVU5JVFkoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCd1bml0eScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNVTklUWTogbm8gZGF0YVwiLCBlcnIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mbGFtZXNob3RBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwid2hpY2ggZmxhbWVzaG90XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZmxhbWVzaG90QXZhaWxhYmxlOiBGbGFtZXNob3Qgbm90IGZvdW5kXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9zZXR1cERlc2t0b3BQYXRoKCkge1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICB9XG5cbiAgX2dldERlc2t0b3BQYXRoKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTY3JlZW5zaG90QWJpbGl0eSgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgaWYgKCh0aGlzLl9pc0dOT01FKCkgfHwgdGhpcy5faXNVTklUWSgpKSAmJiB0aGlzLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogR05PTUUvVW5pdHkgKyBXYXlsYW5kIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2VcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNLREUoKSAmJiB0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMuX2ZsYW1lc2hvdEF2YWlsYWJsZSgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogS0RFL1dheWxhbmQgKyBGbGFtZXNob3QgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy51c2VXb3JrZXIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBYMTEgKyBJbWFnZU1hZ2ljayBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2UgXHUyMDEzIGZhbGxiYWNrIHRvIHBhZ2VjYXB0dXJlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXNvbHZlZCBiYXNlIHBhdGggZm9yIHB1YmxpYyBhc3NldHMgd2hlbiBwYWNrYWdlZCAoUXVhc2FyOiBhcHAgcm9vdDsgb2xkIGJ1aWxkOiBhcHAuYXNhci51bnBhY2tlZC9wdWJsaWMpLiBJbiBkZXYgcmV0dXJucyBwcm9qZWN0IHB1YmxpYyBkaXIuICovXG4gIGdldFBhY2thZ2VkUHVibGljQmFzZSgpIHtcbiAgICByZXR1cm4gYXBwLmlzUGFja2FnZWQgPyBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSA6IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiBmYWxzZSwgIC8vIGRpc2FibGUga2lvc2sgbW9kZSBvbiBleGFtIG1vZGUgYW5kIG90aGVyIHN0dWZmIChhdXRvZmlsbCBpbnB1dCBmaWVsZHMpXG4gICAgc2hvd2RldnRvb2xzOiB0cnVlLFxuICAgIHVzZUJ1bmRsZWRKUkU6IHRydWUsXG4gICAgYmlwSW50ZWdyYXRpb246IHRydWUsXG4gICAgYmlwRGVtbzogZmFsc2UsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMjA0JyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBFTEVDVFJPTiBtYWluIGZpbGUgdGhhdCBhY3R1YWxseSBvcGVucyB0aGUgZWxlY3Ryb24gd2luZG93XG4gKi9cbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgVHJheSwgTWVudSwgZGlhbG9nLCBzZXNzaW9ufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBmc0V4dHJhIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL21haW4vc2NyaXB0cy90cmF5bWVudS5qcydcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGNoZWNrUGFyZW50UHJvY2VzcyB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzJztcblxuaW1wb3J0IHsgdG9nZ2xlTWFjT1NMb2NrZG93biB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJ1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgKCkgPT4geyAgLy8gaWYgd2luZG93IGlzIGNsb3NlZFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcbiAgICBhcHAucXVpdCgpICAgXG59KVxuXG5hcHAub24oJ3dpbGwtcXVpdCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKGZhbHNlKVxufSlcblxuYXBwLm9uKCdiZWZvcmUtcXVpdCcsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLmNsZWFyU3RvcmFnZURhdGEoe30pOyAvLyBjbGVhciBjb29raWVzLCBjYWNoZSwgbG9jYWxTdG9yYWdlIGV0Yy5cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgYmVmb3JlLXF1aXQ6IEVycm9yIGNsZWFyaW5nIGNhY2hlOicsIGVycik7XG4gICAgfVxufSk7XG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIEJyb3dzZXJWaWV3LCBkaWFsb2csIHNjcmVlbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgeyBhY3RpdmVXaW5kb3cgfSBmcm9tICdnZXQtd2luZG93cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gT2xkIGxheW91dDogZGlzdC9yZW5kZXJlciAoVml0ZSBvdXREaXIpLCBwdWJsaWMvIHNlcGFyYXRlOyBmYWxsYmFjayBmb3IgUXVhc2FyIGRlZmF1bHQgbGF5b3V0XG5mdW5jdGlvbiBnZXRSZW5kZXJlckluZGV4UGF0aCgpIHtcbiAgY29uc3QgZGlzdFJlbmRlcmVyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnZGlzdCcsICdyZW5kZXJlcicsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKGRpc3RSZW5kZXJlclBhdGgpKSByZXR1cm4gZGlzdFJlbmRlcmVyUGF0aDtcbiAgY29uc3QgcXVhc2FyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpO1xuICBpZiAoZnMuZXhpc3RzU3luYyhxdWFzYXJQYXRoKSkgcmV0dXJuIHF1YXNhclBhdGg7XG4gIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbn1cblxuXG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBXaW5kb3cgaGFuZGxpbmcgKGlwY1JlbmRlcmVyIFByb2Nlc3MgLSBGcm9udGVuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2NrV2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXJ2ZWQgZGlzcGxheSBJRCBmb3IgZXhhbSB3aW5kb3cgKHNldCBpbW1lZGlhdGVseSB3aGVuIHdpbmRvdyBpcyBjcmVhdGVkKVxuICAgICAgdGhpcy5zcGxhc2h3aW4gPSBudWxsXG4gICAgICB0aGlzLmJpcHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgXG4gICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHF1ZXN0aW9uIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgbWluaW1pemUgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLndpbmRvd1RyYWNrZXIuYmluZCh0aGlzKSwgMTAwMClcbiAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGVsZWN0cm9uIHdpbmRvdyBpbiBmb2N1cyBvciBhbiBvdGhlciBlbGVjdHJvbiB3aW5kb3cgZGVwZW5kaW5nIG9uIHRoZSBoaWVyYWNoeVxuICAgIGdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkge1xuICAgICAgICBjb25zdCBmb2N1c2VkV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICAgIGlmIChmb2N1c2VkV2luZG93KSB7XG4gICAgICAgICAgcmV0dXJuIGZvY3VzZWRXaW5kb3dcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbmxvY2tXaW5kb3cpe3JldHVybiB0aGlzLnNjcmVlbmxvY2tXaW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmV4YW13aW5kb3cpe3JldHVybiB0aGlzLmV4YW13aW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1haW53aW5kb3cpe3JldHVybiB0aGlzLm1haW53aW5kb3d9XG4gICAgICAgICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiAxMDAwLFxuICAgICAgICAgICAgaGVpZ2h0OjgwMCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgLy8gcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAvLyB0cmFuc3BhcmVudDogdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaWYgKGJpcHRlc3QpeyAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vcS5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cbiAgICAgICAgZWxzZSB7ICAgICAgICAgIHRoaXMuYmlwd2luZG93LmxvYWRVUkwoYGh0dHBzOi8vd3d3LmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5iaXB3aW5kb3cgJiYgIXRoaXMuYmlwd2luZG93LmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IGRpZC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogd2lsbC1uYXZpZ2F0ZVwiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICB9KVxuXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7ICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBuZXctd2luZG93XCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG4gICAgIFxuICAgICAgICAgXG4gICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogdGFyZ2V0OiBfYmxhbmtcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLXJlZGlyZWN0JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IFJlZGlyZWN0aW5nIHRvOicsIHVybCk7XG4gICAgICAgICAgICAvLyBQclx1MDBGQ2Zlbiwgb2IgZGllIFVSTCBkYXMgZ2V3XHUwMEZDbnNjaHRlIEZvcm1hdCBoYXRcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnYmlsZHVuZ3Nwb3J0YWw6Ly8nKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcnQgZGVuIFN0YW5kYXJkLVJlZGlyZWN0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gJ2JpbGR1bmdzcG9ydGFsOi8vdG9rZW49JztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdXJsLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBDYXB0dXJlZCBUb2tlbjonKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiAnICsgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiaXBUb2tlbicsIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiB0aGlzIGlzIGFuIGVhc3RlciBlZ2dcbiAgICAgKi9cbiAgICBjcmVhdGVFYXN0ZXJXaW4oKSB7XG4gICAgICAgIHRoaXMuZWFzdGVyd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMvaWNvbnMvaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDc2OCxcbiAgICAgICAgICAgIGhlaWdodDo0ODAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi5sb2FkRmlsZShqb2luKF9fZGlybmFtZSwgYC4uLy4uL3B1YmxpYy9jb3dzb25pY2UvaW5kZXguaHRtbGApKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgbGV0IHVybCA9IFwibm90Zm91bmRcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGJsb2Nrd2luLnJlbW92ZU1lbnUoKSBcbiAgICAgICAgYmxvY2t3aW4uc2V0TWluaW1pemFibGUoZmFsc2UpXG5cbiAgICAgICAgLy8gUG9zaXRpb24gd2luZG93IG9uIHNwZWNpZmljIGRpc3BsYXkgQkVGT1JFIHNob3dpbmcgaXRcbiAgICAgICAgYmxvY2t3aW4uc2V0Qm91bmRzKHtcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLngsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55LFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYmxvY2t3aW4uc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgXG4gICAgICAgIGJsb2Nrd2luLnNob3coKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTtcbiAgICAgICAgICAgIGJsb2Nrd2luLm9uKCdsZWF2ZS1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpOyAvLyBzb2ZvcnQgd2llZGVyIHp1clx1MDBGQ2Nrc2V0emVuXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgIH0gIFxuICAgICAgICBlbHNlIHsgICBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEtpb3NrKHRydWUpOyAvLyBLaW9zayA9IFwidGFrZSBvdmVyIG1haW4gc2NyZWVuXCIuIG9uIG1hY29zIHRoYXQncyB3aHkgd2UgdXNlIGZ1bGxTY3JlZW4gd29ya2Fyb3VuZCB3aXRoIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIH1cbiAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICBibG9ja3dpbi5kaXNwbGF5ID0gZGlzcGxheVxuICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5wdXNoKGJsb2Nrd2luKVxuICAgIH1cblxuXG4gICAgLy8gYmxvY2sgYWxsIHNjcmVlbnMgd2l0aCBhIGJsb2Nrd2luZG93XG4gICAgYXN5bmMgaW5pdEJsb2NrV2luZG93cygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAvL2xvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZm91bmQgJHtkaXNwbGF5cy5sZW5ndGh9IGRpc3BsYXlzYClcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgIC8vIGxvY2sgYWxsIHNjcmVlbnNcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGV4YW0gd2luZG93IHRvIGJlIHZpc2libGUgYW5kIHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0cmllcyA9IDBcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTBcbiAgICAgICAgICAgICAgICB3aGlsZSAoIXRoaXMuZXhhbXdpbmRvdy5pc1Zpc2libGUoKSAmJiByZXRyaWVzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMClcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllcysrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFkZGl0aW9uYWwgd2FpdCB0byBlbnN1cmUgcG9zaXRpb25pbmcgaXMgY29tcGxldGUgb24gV2F5bGFuZFxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgYmxvY2sgd2luZG93cyBmcm9tIGFycmF5XG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cyA9IHRoaXMuYmxvY2t3aW5kb3dzLmZpbHRlcihibG9ja3dpbiA9PiBibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGFsbCBleGlzdGluZyB3aW5kb3dzIGFuZCBkZXRlcm1pbmUgdGhlaXIgZGlzcGxheXNcbiAgICAgICAgICAgIGNvbnN0IHVzZWREaXNwbGF5SWRzID0gbmV3IFNldCgpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpcnN0LCB1c2UgdGhlIHJlc2VydmVkIGV4YW0gZGlzcGxheSBJRCAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gZXhhbSB3aW5kb3cgd2FzIGNyZWF0ZWQpXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIHNjcmVlbiBpcyByZXNlcnZlZCBldmVuIGlmIHRoZSB3aW5kb3cgaXNuJ3QgZnVsbHkgaW5pdGlhbGl6ZWQgeWV0XG4gICAgICAgICAgICBpZiAodGhpcy5leGFtRGlzcGxheUlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHRoaXMuZXhhbURpc3BsYXlJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWx3YXlzIGV4Y2x1ZGUgcHJpbWFyeSBkaXNwbGF5IChleGFtIHdpbmRvdyBsb2NhdGlvbilcbiAgICAgICAgICAgIGNvbnN0IHByaW1hcnlEaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmIChwcmltYXJ5RGlzcGxheSAmJiBwcmltYXJ5RGlzcGxheS5pZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChwcmltYXJ5RGlzcGxheS5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgZXhhbSB3aW5kb3cgZGlzcGxheSAoYXMgZmFsbGJhY2svdmVyaWZpY2F0aW9uLCBidXQgcmVzZXJ2ZWQgSUQgdGFrZXMgcHJpb3JpdHkpXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGV4YW0gd2luZG93IGlzIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgZXhhbSB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGJsb2NrIHdpbmRvd3MgZGlzcGxheXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmxvY2t3aW4gb2YgdGhpcy5ibG9ja3dpbmRvd3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBibG9ja3dpbi5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGJsb2NrIHdpbmRvdyBmb3VuZCBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGJsb2NrIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIGJsb2NrIHdpbmRvd3MgZm9yIGRpc3BsYXlzIHRoYXQgZG9uJ3QgaGF2ZSBleGFtIG9yIGJsb2NrIHdpbmRvd3NcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIGlmICh1c2VkRGlzcGxheUlkcy5oYXMoZGlzcGxheS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBza2lwcGluZyBkaXNwbGF5ICR7ZGlzcGxheS5pZH0gLSBhbHJlYWR5IGhhcyBleGFtIG9yIGJsb2NrIHdpbmRvd2ApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGNyZWF0ZSBibG9ja3dpbiBvbjpcIixkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgIHRoaXMubmV3QmxvY2tXaW4oZGlzcGxheSkgIC8vIGFkZCBibG9ja3dpbmRvd3MgZm9yIGRpc3BsYXlzIHdpdGhvdXQgZXhhbSB3aW5kb3dcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDAwKVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MuZm9yRWFjaCggKGJsb2Nrd2luKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU2NyZWVubG9jayBXaW5kb3cgKHRvIGNvdmVyIHRoZSBtYWluc2NyZWVuKSAtIGJsb2NrIHN0dWRlbnRzIGZyb20gd29ya2luZ1xuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIGNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkge1xuICAgICAgICBsZXQgc2NyZWVubG9ja1dpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogdGhpcy5tYWlud2luZG93LCAgIC8vIGxlYWRzIHRvIHZpc2libGUgdGl0bGViYXIgaW4gZ25vbWUtZGVza3RvcFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnU2NyZWVubG9jaycsXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgIGNsb3NhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgLy9mb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsIC8vIGxlYWRzIHRvIHdlaXJkIDIwcHggYm90dG9tc3BhY2Ugb24gd2luZG93c1xuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYy9pY29ucy9pY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHVybCA9IFwibG9ja1wiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICAvLyBBZGQgd2luZG93IHRvIGFycmF5IGZpcnN0LCBiZWZvcmUgYWRkaW5nIGJsdXIgbGlzdGVuZXJcbiAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5wdXNoKHNjcmVlbmxvY2tXaW5kb3cpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzY3JlZW5sb2NrV2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJwb3AtdXAtbWVudVwiLCAxKSAgIC8vYWJvdmUgZXhhbSB3aW5kb3cgKHBvcC11cC1tZW51LCAwKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRDbG9zYWJsZSh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUpOyAvLyBwdXQgdGhlIHdpbmRvdyBvbiBhbGwgdmlydHVhbCB3b3Jrc3BhY2VzXG4gICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcihcInNjcmVlbmxvY2tcIilcbiAgICAgICAgfSlcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfSAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHsgICAvLyByZW1vdmUgd2luZG93IGZyb20gYXJyYXkgd2hlbiBhY3R1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmIHdpbiAhPT0gc2NyZWVubG9ja1dpbmRvdyAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBFeGFtd2luZG93XG4gICAgICogQHBhcmFtIGV4YW10eXBlIGVkdXZpZHVhbCwgbWF0aCwgbGFuZ3VhZ2VcbiAgICAgKiBAcGFyYW0gdG9rZW4gc3R1ZGVudCB0b2tlblxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgY29udGFpbmluZyBpbmZvIGFib3V0IHNwZWxsY2hlY2sgbGFuZ3VhZ2UgZXRjLiBcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVFeGFtV2luZG93KGV4YW10eXBlLCB0b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5ZGlzcGxheSkge1xuICAgICAgICAvLyBqdXN0IHRvIGJlIHN1cmUgd2UgY2hlY2sgc29tZSBpbXBvcnRhbnQgdmFycyBoZXJlXG4gICAgICAgIGlmIChleGFtdHlwZSAhPT0gXCJyZHBcIiAmJiBleGFtdHlwZSAhPT0gXCJ3ZWJzaXRlXCIgJiYgIGV4YW10eXBlICE9PSBcImdmb3Jtc1wiICYmIGV4YW10eXBlICE9PSBcImVkdXZpZHVhbFwiICYmIGV4YW10eXBlICE9PSBcImVkaXRvclwiICYmIGV4YW10eXBlICE9PSBcIm1hdGhcIiAmJiBleGFtdHlwZSAhPT0gXCJtaWNyb3NvZnQzNjVcIiAmJiBleGFtdHlwZSAhPT0gXCJhY3RpdmVzaGVldHNcIiB8fCAhdG9rZW4peyAgLy8gZm9yIG5vdy4uIHdlIHByb2JhYmx5IHNob3VsZCBzdG9wIGV2ZXJ5dGhpbmcgaGVyZVxuICAgICAgICAgICAgbG9nLndhcm4oXCJtaXNzaW5nIHBhcmFtZXRlcnMgZm9yIGV4YW0tbW9kZSBvciBtb2RlIG5vdCBpbiBhbGxvd2VkIGxpc3QhXCIpXG4gICAgICAgICAgICBleGFtdHlwZSA9IFwiZWRpdG9yXCIgXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICAvLyBBbHdheXMgdXNlIHByaW1hcnkgZGlzcGxheSBmb3IgZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzIHx8ICFwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gZGlzcGxheXNbMF0gfHwgcHJpbWFyeWRpc3BsYXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gSW1tZWRpYXRlbHkgcmVzZXJ2ZSB0aGUgZGlzcGxheSBJRCBmb3IgdGhlIGV4YW0gd2luZG93IChiZWZvcmUgd2luZG93IGlzIGZ1bGx5IGluaXRpYWxpemVkKVxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIGJsb2NrIHdpbmRvd3MgZnJvbSBiZWluZyBjcmVhdGVkIG9uIHRoZSBzYW1lIHNjcmVlblxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IHByaW1hcnlkaXNwbGF5LmlkXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IHJlc2VydmluZyBkaXNwbGF5ICR7dGhpcy5leGFtRGlzcGxheUlkfSBmb3IgZXhhbSB3aW5kb3dgKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgcHggPSAwXG4gICAgICAgIGxldCBweSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcyAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCkge1xuICAgICAgICAgICAgcHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueFxuICAgICAgICAgICAgcHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogcHggKyAwLFxuICAgICAgICAgICAgeTogcHkgKyAwLFxuICAgICAgICAgICAgdGl0bGU6ICdFeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiAxNDQwLFxuICAgICAgICAgICAgaGVpZ2h0OiA3NjgsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHdpbiwgIC8vdGhpcyBkb2VzbnQgd29yayB0b2dldGhlciB3aXRoIGtpb3NrIG9uIHVidW50dSBnbm9tZSA/PyB3dGZcbiAgICAgICAgICAgIC8vIG1vZGFsOiB0cnVlLCAgLy8gdGhpcyBibG9ja3MgdGhlIG1haW4gd2luZG93IG9uIHdpbmRvd3Mgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIG9wZW5cbiAgICAgICAgICAgIC8vIGNsb3NhYmxlOiBmYWxzZSwgIC8vIGlmIHdlIGNhbid0IGRlZmluZSAncGFyZW50JyB0aGlzIHdpbmRvdyBoYXMgdG8gYmUgY2xvc2FibGUgLSB3aHk/XG4gICAgICAgICAgICAvL2Fsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgb3BhY2l0eTogMSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICB2aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAga2lvc2s6IHRoaXMuY29uZmlnLmRldmVsb3BtZW50ID8gZmFsc2UgOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZXhhbXdpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZU1lbnUoKSAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvYmFibHkgbm90IG5lZWRlZCBiZWNhdXNlIHdlIGRpc2FibGUgbWlzc2lvbmNvbnRyb2wgYW55d2F5cyAtIHNlZW1zIHRvIGludGVyZmVyZSB3aXRoIGtpb3NrIG1vZGUgb24gbWFjb3MgKGFnYWluKVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLmV4YW13aW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlLCB7IHZpc2libGVPbkZ1bGxTY3JlZW46IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzV2F5bGFuZCl7IHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdGFydCgpIH0gLy8gY29uc3RhbnRseSBjaGVjayBpZiB0aGUgYWN0aXZlIHdpbmRvdyBpcyB0aGUgZXhhbXdpbmRvdyAtIGlmIG5vdCwgYnJpbmcgaXQgdG8gZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKHRoaXMpICAvLyBkaXNhYmxlIGtleWJvYXJkIHNob3J0Y3V0cyBldGMuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAvLyBkbyBub3Qgc2V0IGJsdXIgbGlzdGVuZXIgdG9vIGVhcmx5XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKCkgIC8vIGFkZCBibHVyIGxpc3RlbmVyIHRvIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgZGlkLWZpbmlzaC1sb2FkOiBlcnJvciBpbiBleGFtd2luZG93IHNldHVwXCIsIGUpfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cyAvL3dlIGtlZXAgaXQgdGhlcmUgdG8gbWFrZSBpdCBhY2Nlc3NhYmxlIHZpYSBleGFtd2luZG93IGluIGlwY0hhbmRsZXJcbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQgPSA5NCAgIC8vIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgY29udGVudCB2aWV3XG4gICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNaWNyb3NvZnQgMzY1IGVtZWJlZHMgaXRzIGVkaXRvciBpbiBhbiBpZnJhbWUgd2l0aCBhY3RpdmUgQ29udGVudCBTZWN1cml0eSBQb2xpY3kgKENTUClcbiAgICAgICAgICogVGhlIG9ubHkgd2F5IHRvIGJlIGFibGUgdG8gaW5qZWN0IGNvZGUgaXMgdG8gbG9hZCBpdCBkaXJlY3RseSBpbiB0aGUgbWFpbiB3aW5kb3cgPGVtYmVkPiA8aWZyYW1lPiBvciBldmVuIDx3ZWJ2aWV3PiBvZmZlcnMgbm8gd29ya2Fyb3VuZFxuICAgICAgICAgKiB0aGVyZWZvcmUgd2UgdXNlIFwiQnJvd3NlclZpZXdcIiBpbiBvcmRlciB0byBkaXNwbGF5IHR3byBwYWdlcyBpbiBvbmUgd2luZG93OiBvbiB0b3AgPiBleGFtIGhlYWRlciwgb24gYm90dG9tID4gb2ZmaWNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlmIChleGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIiAgKSB7IC8vZXh0ZXJuYWwgcGFnZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJzdGFydGluZyBtaWNyb3NvZnQzNjUgZXhhbS4uLlwiKVxuICAgICAgICAgICAgbGV0IHVybHZpZXcgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgICBcbiAgICAgICAgICAgIGlmICghdXJsdmlldykgey8vIHdlIHdhaXQgZm9yIHRoZSBuZXh0IHVwZGF0ZSB0aWNrIC0gbXNvZmZpY2VzaGFyZSBuZWVkcyB0byBiZSBzZXQgISAoY291bGQgaGFwcGVuIHdoZW4gYSBzdHVkZW50IGNvbm5lY3RzIGxhdGVyIHRoZW4gZXhhbSBtb2RlIGlzIHNldCBidXQgaGlzIHNoYXJlIHVybCBuZWVkcyBzb21lIHRpbWUpXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogbm8gdXJsIGZvciBtaWNyb3NvZnQzNjUgd2FzIHNldCB5ZXQgLSB3YWl0aW5nIGZvciBuZXh0IHVwZGF0ZSB0aWNrXCIpXG4gICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBkZXN0cm95ZWRcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbG9hZCB0b3AgbWVudSBpbiBNYWluUGFnZVxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgZWR1dmlkdWFsIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGJhY2tncm91bmR1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwoYmFja2dyb3VuZHVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBEZWZpbmUgdGhlIE1haW5Db250ZW50UGFnZSB2aWV3XG4gICAgICAgICAgICBsZXQgY29udGVudFZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSwgIFxuICAgICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRBdXRvUmVzaXplKHsgd2lkdGg6IHRydWUsIGhlaWdodDogdHJ1ZSwgaG9yaXpvbnRhbDogdHJ1ZSwgdmVydGljYWw6IHRydWUgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybHZpZXcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSB9XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignZW50ZXItZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbigncmVzaXplJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgbm9ybWFsIGV4YW0gbW9kZSAoZWRpdG9yLCBtYXRoLCBlZHV2aWR1YWwsIHdlYnNpdGUsIGdmb3JtcylcbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGUgc3BlY2lhbCBOQVZJR0FUSU9OIHNpdHVhdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBGb3JtcywgV2Vic2l0ZSwgRWR1dmlkdWFsLCBFZGl0b3IsIFJEUCwgTWljcm9zb2Z0MzY1XG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gZXhhbXdpbmRvdy53ZWJDb250ZW50cyBsZXZlbCBmb3IgYWxsIG1vZGVzIHRoYXQgY2FuIGRpc3BsYXkgUERGcyBpbiBleGFtaGVhZGVyXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgbmF2aWdhdGlvbiB3aGVuIGNsaWNraW5nIGxpbmtzIGluIFBERnMgZGlzcGxheWVkIGluIHRoZSBleGFtaGVhZGVyXG4gICAgICAgIC8vIFdlYnZpZXcvQnJvd3NlclZpZXcgYmxvY2tpbmcgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5IHZpYSBJUEMgaW4gaXBjaGFuZGxlci5qcyBvciBtb2RlLXNwZWNpZmljIGhhbmRsZXJzIGJlbG93XG4gICAgICAgIGNvbnN0IGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlciA9IFtcImdmb3Jtc1wiLCBcIndlYnNpdGVcIiwgXCJlZHV2aWR1YWxcIiwgXCJlZGl0b3JcIiwgXCJyZHBcIiwgXCJtaWNyb3NvZnQzNjVcIiwgXCJhY3RpdmVzaGVldHNcIiwgXCJtYXRoXCJdO1xuICAgICAgICBpZiAoZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyLmluY2x1ZGVzKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBWdWUgYXBwIChlLmcuIGZyb20gUERGIGxpbmtzIGluIGV4YW1oZWFkZXIpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gUHJldmVudCBuZXcgd2luZG93cyBmcm9tIG9wZW5pbmcgaW4gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgbmV3LXdpbmRvd1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBzZXRXaW5kb3dPcGVuSGFuZGxlclwiLCB1cmwpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIE1pY3Jvc29mdCBFeGNlbC9Xb3JkXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIpeyAgLy8gZG8gbm90IHVuZGVyIGFueSBjaXJjdW1zdGFuY2VzIGFsbG93IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBjdXJyZW50IGV4YW0gdXJsXG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHVzZXIgd2FudHMgdG8gbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgcGFnZVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJkbyBub3QgbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgdGVzdC4uIFwiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0ZUNvZGUgPSAgYFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBsb2NrKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAnV0FDRGlhbG9nT3V0ZXJDb250YWluZXInLCdXQUNEaWFsb2dJbm5lckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ1BhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZGV1c0J5SUQgPSBbJ1Nob3dIaWRlRXF1YXRpb25Ub29sc1BhbmUnLCdMaW5rR3JvdXAnLCdHcmFwaGljc0VkaXRvcicsJ0luc2VydFRhYmxlT2ZDb250ZW50c0luSW5zZXJ0VGFiJywnSW5zZXJ0T25saW5ldmlkZW8nLCdQaWN0dXJlJywnUmliYm9uLVBpY3R1cmVNZW51TUxSRHJvcGRvd24nLCdJbnNlcnRBZGRJbkZseW91dCcsJ0Rlc2lnbmVyJywnRWRpdG9yJywnRmFyUGFuZScsJ0hlbHAnLCdJbnNlcnRBcHBzRm9yT2ZmaWNlJywnRmlsZU1lbnVMYXVuY2hlckNvbnRhaW5lcicsJ0hlbHAtd3JhcHBlcicsJ1Jldmlldy13cmFwcGVyJywnSGVhZGVyJywnRmFyUGVyaXBoZXJhbENvbnRyb2xzQ29udGFpbmVyJywnQnVzaW5lc3NCYXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChlbnRyeSBvZiBoaWRldXNCeUlEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJkaXNwbGF5XCIsIFwibm9uZVwiLCBcImltcG9ydGFudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBidXR0b25BcHBzT3ZlcmZsb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnQWRkLUlucycpWzBdOyAgLy8gdGhpcyBidXR0b24gaXMgcmVkcmF3biBvbiByZXNpemUgKGRvZXNuJ3QgaGFwcGVuIGluIGV4YW0gbW9kZSBidXQgc3RpbGwgdGhlcmUgbXVzdCBiZSBhIGNsZWFuZXIgd2F5IC0gaW5zZXJ0aW5nIGNzcyBiZWZvcmUgaXQgYXBwZWFycyBpcyBub3Qgd29ya2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidXR0b25BcHBzT3ZlcmZsb3cpeyBidXR0b25BcHBzT3ZlcmZsb3cuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJTdWNoZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJcdTAwRENiZXJzZXR6ZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJDb3BpbG90XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkFkZC1JbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwQ29udGV4dE1lbnVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cFN5bm9ueW1zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlJpYmJvbi1SZWZlcmVuY2VzU21hcnRMb29rVXBcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJEaWN0YXRpb25cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkdldEFkZGluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUGljdHVyZXNfTUxSXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pOyAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9jaygpICAvL2ZvciBzb21lIHJlYXNvbiBleGNlbCBkZWxheXMgdGhhdCBjYWxsLi4gZG9lc250IGhhcHBlbiBvbiBwYWdlIGZpbmlzaCBsb2FkXG4gICAgICAgICAgICAgICAgICAgIGBcblxuICAgICAgICAgICAgbGV0IHNjaGVkdWxlckluc3RhbmNlID0gbnVsbFxuICAgICAgICAgICAgdGhpcy5sb2NrQ2FsbGJhY2sgPSAoKSA9PiB0aGlzLmxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSk7IFxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmxvY2tDYWxsYmFjaywgNDAwKVxuICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gc2NoZWR1bGVySW5zdGFuY2VcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0YXJ0KClcbiAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgdGhlIHdlYkNvbnRlbnRzIGlzIGZ1bGx5IGxvYWRlZCAgLy8gdGhpcyBpcyBub3Qgd29ya2luZyByZWxpYWJseSBiZWNhdXNlIHRoZSBwYWdlIGlzIGxvYWRlZCBpbiBtYW55IHN0ZXBzIGFuZCB0aGUgdWkgZWxlbWVudHMgYXJlIG5vdCBhdmFpbGFibGUgeWV0XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2FwcC1jb21tYW5kJywgKGUsIGNtZCkgPT4ge1xuICAgICAgICAgICAgLy8gJ2Jyb3dzZXItYmFja3dhcmQnIHVuZCAnYnJvd3Nlci1mb3J3YXJkJyBzaW5kIGRpZSBCZWZlaGxlLCBkaWUgYmVpbSBLbGljayBhdWYgZGllIE1hdXN0YXN0ZW4gZ2VzZW5kZXQgd2VyZGVuXG4gICAgICAgICAgICBpZiAoY21kID09PSAnYnJvd3Nlci1iYWNrd2FyZCcgfHwgY21kID09PSAnYnJvd3Nlci1mb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwibm8gbmF2aWdhdGlvbiBhbGxvd2VkXCIpXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJuIFNpZSBkYXMgU3RhbmRhcmR2ZXJoYWx0ZW5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICAvL2Rpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KSAgLy9kbyBub3QgZGlzYWJsZSB0d2ljZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgbG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKXtcbiAgICAgICAgaWYgKGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzICYmIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZSl7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIiwgZnJhbWUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUgJiYgKGZyYW1lLm5hbWUgPT09ICdXZWJBcHBsaWNhdGlvbkZyYW1lJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfV29yZF8wJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfRXhjZWxfMCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiKVxuICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IHN0b3BwaW5nIGxvY2tTY2hlZHVsZXJcIilcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0b3AoKVxuICAgICAgICAgICAgaWYgKHRoaXMubG9ja1NjaGVkdWxlciA9PT0gc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogbm8gYnJvd3NlclZpZXcgb3IgbG9ja1NjaGVkdWxlciBmb3VuZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTUFJTiBXSU5ET1dcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGFzeW5jIGNyZWF0ZU1haW5XaW5kb3coKSB7XG4gICAgICAgIGxldCBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpWzBdXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaW5kb3cgZGltZW5zaW9ucyAtIGRlZmluZWQgb25jZSwgdXNlZCBldmVyeXdoZXJlXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gMTAyNFxuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSA2NDBcblxuICAgICAgICAvLyBDYWxjdWxhdGUgY2VudGVyIHBvc2l0aW9uIG9uIHByaW1hcnkgZGlzcGxheVxuICAgICAgICBsZXQgeCA9IDBcbiAgICAgICAgbGV0IHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy53aWR0aCAtIHdpbmRvd1dpZHRoKSAvIDIpXG4gICAgICAgICAgICB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnkgKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMuaGVpZ2h0IC0gd2luZG93SGVpZ2h0KSAvIDIpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ01haW4gd2luZG93JyxcbiAgICAgICAgICAgIGljb246IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljL2ljb25zL2ljb24ucG5nJyksXG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgIHdpZHRoOiB3aW5kb3dXaWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogd2luZG93SGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDg1MCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogNjAwLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkYXMgXHUwMEM0bmRlcm4gZGVyIEdyXHUwMEY2XHUwMERGZSAgXG4gICAgICAgICAgICBmdWxsc2NyZWVuYWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGVuIFZvbGxiaWxkbW9kdXMgLSB3aWNodGlnIGZcdTAwRkNyIG1hY29zIGRlbm4gd2VubiBhdWYgbWFjb3MgZGFzIG1haW53aW5kb3cgYXVmIGZ1bGxzY3JlZW4gaXN0IGdyZWlmdCBiZWltIGV4YW13aW5kb3cgZGVyIGtpb3NrIG1vZGUgbmljaHQgIC0gZWxlY3Ryb24gYnVnIChuZWVkcyBleGFtcGxlIGNvZGUpOiA+PiBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzQ0NzU1XG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgLy92aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnREaXIsXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTilcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRUaHJvdHRsaW5nOiB0cnVlICAvLyBhbGxvdyB0aHJvdHRsaW5nIHdoZW4gd2luZG93IGlzIGluIGJhY2tncm91bmRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBoYW5kbGVycyBiZWZvcmUgbG9hZGluZ1xuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmICF0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0KSB7ICAvLyBhbGxvd2V4aXQgaXN0IGVpbiBvdmVycmlkZSB2b20gY29udGV4dCBtZW51IG9kZXIgc2NyZWVuc2hvdCB0ZXN0LiBkaWVzZXIga2FubiBkaWUgYXBwIHNjaGxpZXNzZW5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGFzIG5vIGxlZ2FjeSB0cmF5XG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dUcmF5KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBHTk9NRSBkZXRlY3RlZCwgcXVpdHRpbmcgaW5zdGVhZCBvZiB0cmF5IG1pbmltaXplYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgIC8vIGFsbG93IGNsb3NlIGZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2hvd01pbmltaXplV2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTWluaW1pemluZyBOZXh0LUV4YW0gdG8gU3lzdGVtdHJheWApICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgd2luZG93IHByb3BlcnRpZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuZm9jdXMoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG4gICAgICAgIC8vdGhpcy5tYWlud2luZG93LnNldEhpZGRlbkluTWlzc2lvbkNvbnRyb2wodHJ1ZSlcblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudltcIkRFQlVHXCJdKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGdldFJlbmRlcmVySW5kZXhQYXRoKCk7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH1gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGFzeW5jIHNob3dFeGl0V2FybmluZyhtZXNzYWdlKXtcbiAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT2snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIEJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd0V4aXRRdWVzdGlvbigpe1xuICAgICAgICBpZiAodGhpcy5leGl0UXVlc3Rpb25PcGVuKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkaWFsb2cgYWxyZWFkeSBvcGVuLCBza2lwcGluZ1wiKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnSmEnLCAnTmVpbiddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gYmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1dvbGxlbiBzaWUgZGllIEFud2VuZHVuZyBOZXh0LUV4YW0gYmVlbmRlbj8nLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGNob2ljZS5yZXNwb25zZSA9PSAxKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkbyBub3QgY2xvc2UgTmV4dC1FeGFtIGFmdGVyIGZpbmlzaGVkIEV4YW1cIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dNaW5pbWl6ZVdhcm5pbmcoKXtcbiAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNaW5pbWl6ZSB0byBTeXN0ZW0gVHJheScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0RpZSBBbndlbmR1bmcgTmV4dC1FeGFtIHd1cmRlIG1pbmltaWVydCEnLFxuICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIEZ1bmN0aW9uc1xuICAgICAqL1xuXG4gICAgaXNXYXlsYW5kKCl7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7IFxuICAgIH1cblxuICAgIC8vIHRoaXMgZnVuY3Rpb24gdXNlcyBhY3RpdmUtd2luIHRvIHJlY2VpdmUgbmFtZSBhbmQgdXJsIGZyb20gYWN0aXZlIHdpbmRvdyAtIHlldCBhbm90aGVyIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoZSBmb2N1cyBpcyBzdGlsbCBvbiBuZXh0ZXhhbVxuICAgIC8vIHRoaXMgaXMgdXNlZCB0byBpbnRyb2R1Y2UgZXhlbXB0aW9ucyBmb3IgdGhlIGJsdXIgbGlzdGVuZXJcbiAgICAvLyAoZG93bmdyYWRlZCBmcm9tIGdldC13aW5kb3dzIGJlY2F1c2Ugb2YgbmFwaSB2OSBpc3N1ZSkgaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9nZXQtd2luZG93cy9pc3N1ZXMvMTg2XG4gICAgYXN5bmMgd2luZG93VHJhY2tlcigpe1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICAvLyBjb25zdCBnZXR3aW4gPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVdpbmRvdygpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlV2luID0gYXdhaXQgYWN0aXZlV2luZG93KClcbiAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGFjdGl2ZVdpbiAmJiBhY3RpdmVXaW4ub3duZXIgJiYgYWN0aXZlV2luLm93bmVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IGFjdGl2ZVdpbi5vd25lci5uYW1lXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoID0gYWN0aXZlV2luLm93bmVyLnBhdGhcbiAgICAgICAgICAgICAgICBsZXQgbmFtZUxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoTG93ZXIgPSB3cGF0aC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZUxvd2VyLmluY2x1ZGVzKFwiZXhhbVwiKSB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJuZXh0XCIpICB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJlbGVjdHJvblwiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImVhc2VvZmFjY2Vzc2RpYWxvZ1wiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImRpc2FibGUtc2hvcnRjdXRzXCIpICl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9rdXMgaXMgb24gYWxsb3dlZCB3aW5kb3cgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvL2ZvY3VzIGlzIG5vdCBvbiBuZXh0LWV4YW0gb3IgYW55IG90aGVyIGFsbG93ZWQgd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCl7ICAvL2xvZyBqdXN0IG9uY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogZm9jdXMgbG9zdCBldmVudCB3YXMgdHJpZ2dlcmVkLiBhcHA6ICR7d3BhdGh9IC0gJHtuYW1lfSBgKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vYWRkcyBibHVyIGxpc3RlbmVyIHdoZW4gZW50ZXJpbmcgZXhhbW1vZGUgICAvLyBibHVyIGV2ZW50IGlzbnQgZmlyZWQgb24gbWFjb3MgTUlTU0lPTkNPTlRST0wgKHdoaWNoIGNhbnQgYmUgZGVhY3RpdmF0ZWQgYW55bW9yZSkgLSBkYW1uIHlvdSBhcHBsZSFcbiAgICBhZGRCbHVyTGlzdGVuZXIod2luZG93ID0gXCJleGFtd2luZG93XCIpe1xuICAgICAgICBpZiAod2luZG93ID09PSBcImV4YW13aW5kb3dcIil7IFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9YClcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50KHRoaXMpKSBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3aW5kb3cgPT09IFwic2NyZWVubG9ja1wiKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd313aW5kb3dgKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnRTY3JlZW5sb2NrKHRoaXMpKSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vcmVtb3ZlcyBibHVyIGxpc3RlbmVyIHdoZW4gbGVhdmluZyBleGFtIG1vZGVcbiAgICByZW1vdmVCbHVyTGlzdGVuZXIoKXtcbiAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdibHVyJylcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIHJlbW92ZUJsdXJMaXN0ZW5lcjogcmVtb3ZpbmcgYmx1ciBsaXN0ZW5lclwiKVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGltcGxlbWVudGluZyBhIHNsZWVwICh3YWl0KSBmdW5jdGlvblxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy9zdHVkZW50IGZvZ3VzIHdlbnQgdG8gYW5vdGhlciB3aW5kb3dcbiAgICBhc3luYyBibHVyZXZlbnQod2luaGFuZGxlcikgeyBcblxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IHN0dWRlbnQgdHJpZWQgdG8gbGVhdmUgZXhhbSB3aW5kb3dcIilcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4Jyl7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndpbmRvd1RyYWNrZXIoKSAgLy9jaGVja3MgaWYgbmV3IGZvY3VzIHdpbmRvdyBpcyBhbGxvd2VkXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd3RyYWNrZXIgY2hlY2sgZG9uZS4uLlwiKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBzY3JlZW5sb2NrIHdpbmRvd3MgZnJvbSBhcnJheSBhbmQgY2hlY2sgaWYgYW55IHN0aWxsIGV4aXN0XG4gICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgY29uc3QgaGFzQWN0aXZlU2NyZWVubG9jayA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Muc29tZSh3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSAmJiB3aW4uaXNWaXNpYmxlKCkpXG4gICAgICAgIC8vIEFsc28gY2hlY2sgY2xpZW50aW5mby5zY3JlZW5sb2NrIGZsYWcgYXMgZmFsbGJhY2sgaW4gY2FzZSBhcnJheSB3YXMgY2xlYXJlZCBidXQgd2luZG93cyBzdGlsbCBleGlzdFxuICAgICAgICBpZiAoaGFzQWN0aXZlU2NyZWVubG9jayB8fCB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uc2NyZWVubG9jaykgeyByZXR1cm4gfS8vIGRvIG5vdGhpbmcgaWYgc2NyZWVubG9ja3dpbmRvdyBzdG9sZSBmb2N1cyAvLyBkbyBub3QgdHJpZ2dlciBhbiBpbmZpbml0ZSBsb29wIGJldHdlZW4gZXhhbSB3aW5kb3cgYW5kIHNjcmVlbmxvY2sgd2luZG93IChzdGVhbGluZyBlYWNoIG90aGVycyBmb2N1cyBiZWNhdXNlIHNjcmVlbmxvY2t3aW5kb3cgYXBwZWFycyBhYm92ZSBleGFtIHdpbmRvdyBhbmQgd2lsbCBjYXB0dXJlIGEga2xpY2sgYW5kIHRoZXJlZm9yZSBzdGVhbCBmb2N1cylcbiAgICAgICAgaWYgKHdpbmhhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkKXsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgLy90cm90emRlbSBmb2N1cyB6dXJcdTAwRkNjayBhdWYgZGllIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IGJsdXJldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZSAgIC8vaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG5cbiAgICAgICAgLy90dXJuIHZvbHVtZSB1cCBeXlxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyBzcGF3bigncG93ZXJzaGVsbCcsIFsnU2V0LVZvbHVtZUxldmVsIC1MZXZlbCAxMDA7IFNldC1Wb2x1bWVNdXRlIC1NdXRlICRmYWxzZSddKTsgfVxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBleGVjKCdvc2FzY3JpcHQgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCB2b2x1bWUgMTAwXCIgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCBtdXRlZCBmYWxzZVwiJyk7IH0gIFxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgeyBcbiAgICAgICAgLy8gICAgIGV4ZWMoJ2FtaXhlciBzZXQgTWFzdGVyIDEwMCUgJyk7XG4gICAgICAgIC8vICAgICBleGVjKCdwYWN0bCBzZXQtc2luay1tdXRlIGBwYWN0bCBnZXQtZGVmYXVsdC1zaW5rYCAwJyk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgXG4gICAgICAgIC8vd2UgY291bGQgcGxheSBhIHNvdW5kIGZpbGUgaGVyZS4uIHRiZC4gIFxuICAgIH1cbiAgICAvL3NwZWNpYWwgYmx1ciBldmVudCBmb3IgdGVtcG9yYXJ5IGxvdyBzZWN1cml0eSBzY3JlZW5sb2NrXG4gICAgYmx1cmV2ZW50U2NyZWVubG9jayh3aW5oYW5kbGVyKSB7IFxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiBibHVyLXNjcmVlbmxvY2sgdHJpZ2dlcmVkXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL2Rvbid0IGN5Y2xlIHRocm91Z2ggYWxsIG9mIHRoZW0gLi4gaXQgd2lsbCBjcmVhdGUgYW4gaW5maW5pdGUgZm9jdXMgcmFjZVxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5zaG93KCk7ICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgXG4gICAgfVxuICAgIFxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiBcblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogbW9zdCBvZiB0aGUga2V5Ym9hcmQgcmVzdHJpY3Rpb25zIGNvdWxkIGJlIGhhbmRsZWQgYnkgXCJpb2hvb2tcIiBmb3IgYWxsIHBsYXRmb3Jtc1xuICogdW5mb3J0dW5hbGV0eSBpdCdzIG5vdCB5ZXQgcmVsZWFzZWQgZm9yIG5vZGUgdjE2LnggYW5kIGVsZWN0cm9uIHYxNi54ICAoYWxzbyBpdCdzIFwiYmlnIHN1clwiIGludGVsIG9ubHkgb24gbWFjcylcbiAqIGh0dHBzOi8vd2lsaXgtdGVhbS5naXRodWIuaW8vaW9ob29rL2luc3RhbGxhdGlvbi5odG1sXG4gKlxuICogXCJub2RlLWdsb2JhbC1rZXktbGlzdGVuZXJcIiB3b3VsZCBiZSBhbm90aGVyIHNvbHV0aW9uIGZvciB3aW5kb3dzIGFuZCBtYWNvcyAoYWx0aG91Z2ggaXQgcmVxdWlyZXMgXCJhY2Nlc3NhYmlsaXR5XCIgcGVybWlzc2lvbnMgb24gbWFjKVxuICogYnV0IGZvciBub3cgaXQgc2VlbXMgdGhlIG1vZHVsZSBjYW4gbm90IHJ1biBpbiBhIGZpbmFsIGVsZWN0cm9uIGJ1aWxkXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTGF1bmNoTWVudS9ub2RlLWdsb2JhbC1rZXktbGlzdGVuZXIvaXNzdWVzLzE4XG4gKlxuICogaGFyZGNvZGluZyB0aGUga2V5Ym9hcmRzaG9ydGN1dHMgd2Ugd2FudCB0byBjYXB0dXJlIGludG8gaW9ob29rKG9yIG4tZy1rLWwpIGFuZCBtYW51YWxseSBjb21waWxpbmcgaXQgZm9yIG1hYyBhbmQgd2luZG93cyBjb3VsZCBiZSBkb25lIC0gKGJ1dCBub3QgdW50aWwgaSBnZXQgcGFpZCBmb3IgdGhpcyBhbW91bnQgb2Ygd29yayA7LSlcbiAqL1xuXG5cbi8qKlxuICogdGhlIG5leHQgYmVzdCBzb2x1dGlvbiBpIGNhbWUgdXAgd2l0aCBpcyB0byBraWxsIGFsbCBvZiB0aGUgc2hlbGxzIC0gc3RhcnRpbmcgd2l0aCBleHBsb3Jlci5leGUgYmVjYXVzZSBpdHMgYWJzb2x1dGVseSBpbXBvc3NpYmxlIHRvXG4gKiBkZWFjdGl2YXRlIHRoaXMgbmFzdHkgXCJ3aW5kb3dzXCIgYnV0dG9uIG9yIDNGaW5nZXJTbGlkZVVwIEdlc3R1cmUgaW4gd2luZG93cyAxMSAtIHlvdSBjb3VsZCBlZGl0IHRoZSByZWdpc3RyeSBhbmQgcmVib290IGJ1dCB0aGF0cyBvYnZpb3VzbHkgbm90IHdoYXQgd2Ugd2FudFxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBjbGlwYm9hcmQsIGdsb2JhbFNob3J0Y3V0IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgU2NoZWR1bGVyU2VydmljZSB9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zLCBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9saW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucywgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy93aW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlTWFjUmVzdHJpY3Rpb25zLCBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIGFzIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbWFjLmpzJztcblxubGV0IGNsaXBib2FyZEludGVydmFsO1xubGV0IGNvbmZpZ1N0b3JlID0ge1xuICAgIGxpbnV4OiB7fSxcbiAgICB3aW5kb3dzOiB7fSxcbiAgICBtYWNvczoge31cbn07XG5cbi8vIGxpc3Qgb2YgYXBwcyB3ZSBkbyBub3Qgd2FudCB0byBydW4gaW4gYmFja2dyb3VuZFxuY29uc3QgYXBwc1RvQ2xvc2UgPSBbJ0dvb2dsZSBDaHJvbWUnLCAnY2hyb21lJywgJ2dvb2dsZS1jaHJvbWUnLCAnTWljcm9zb2Z0IEVkZ2UnLCAnbXNlZGdlJywgJ2ZpcmVmb3gnLCAnc2FmYXJpJywgJ2JyYXZlJywgJ29wZXJhJywgJ2NoYXRncHQnLCAnQ2hhdEdQVCcsICdOb3J0b25TZWN1cml0eScsICdOQVYnLCAnVGVhbXMnLCAnbXMtdGVhbXMnLCAnem9vbS51cycsICdNaWNyb3NvZnQgVGVhbXMnLCAnZGlzY29yZCcsICd6b29tJywgJ3RlYW1zJywgJ3RlYW12aWV3ZXInLCAnc2t5cGVmb3JsaW51eCcsICdza3lwZScsICdhbnlkZXNrJ107XG5cbmFzeW5jIGZ1bmN0aW9uIGVuYWJsZVJlc3RyaWN0aW9ucyh3aW5oYW5kbGVyKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cblxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIHBsYXRmb3JtIHJlc3RyaWN0aW9uc1wiKTtcblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBjbGlwYm9hcmQuY2xlYXIoKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKCgpID0+IHsgY2xpcGJvYXJkLmNsZWFyKCk7IH0sIDEwMDApO1xuICAgIGNsaXBib2FyZEludGVydmFsLnN0YXJ0KCk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzS0RFLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNHTk9NRSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBhd2FpdCBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlzYWJsZVJlc3RyaWN0aW9ucygpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiByZW1vdmluZyByZXN0cmljdGlvbnMuLi5cIik7XG5cbiAgICBpZiAoY2xpcGJvYXJkSW50ZXJ2YWwpIHtcbiAgICAgICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RvcCgpO1xuICAgIH1cblxuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbChlbmFibGUpO1xufVxuXG5leHBvcnQgeyBlbmFibGVSZXN0cmljdGlvbnMsIGRpc2FibGVSZXN0cmljdGlvbnMsIHRvZ2dsZU1hY09TTG9ja2Rvd24gfTtcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogTGludXgtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuLy8gdW5mb3J0dW5hdGVseSB0aGVyZSBpcyBubyBjb252ZW5pZW50IHdheSBmb3IgZ25vbWUtc2hlbGwgdG8gdW4tc2V0IEFMTCBzaG9ydGN1dHMgYXQgb25jZVxuY29uc3QgZ25vbWVLZXliaW5kaW5ncyA9IFtcbiAgICAnYWN0aXZhdGUtd2luZG93LW1lbnUnLCdtYXhpbWl6ZS1ob3Jpem9udGFsbHknLCdtb3ZlLXRvLXNpZGUtbicsJ21vdmUtdG8td29ya3NwYWNlLTgnLCdzd2l0Y2gtYXBwbGljYXRpb25zJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0zJywnc3dpdGNoLXdpbmRvd3MtYmFja3dhcmQnLFxuICAgICdhbHdheXMtb24tdG9wJywnbWF4aW1pemUtdmVydGljYWxseScsJ21vdmUtdG8tc2lkZS1zJywnbW92ZS10by13b3Jrc3BhY2UtOScsJ3N3aXRjaC1hcHBsaWNhdGlvbnMtYmFja3dhcmQnLCcgIHN3aXRjaC10by13b3Jrc3BhY2UtNCcsJ3RvZ2dsZS1hYm92ZScsXG4gICAgJ2JlZ2luLW1vdmUnLCdtaW5pbWl6ZScsJ21vdmUtdG8tc2lkZS13JywnbW92ZS10by13b3Jrc3BhY29lLWRvd24nLCdzd2l0Y2gtZ3JvdXAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTUnLCd0b2dnbGUtZnVsbHNjcmVlbicsXG4gICAgJ2JlZ2luLXJlc2l6ZScsJ21vdmUtdG8tY2VudGVyJywnbW92ZS10by13b3Jrc3BhY2UtMScsJ21vdmUtdG8td29ya3NwYWNlLWxhc3QnLCdzd2l0Y2gtZ3JvdXAtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTYnLCd0b2dnbGUtbWF4aW1pemVkJyxcbiAgICAnY2xvc2UnLCdtb3ZlLXRvLWNvcm5lci1uZScsJ21vdmUtdG8td29ya3NwYWNlLTEwJywnbW92ZS10by13b3Jrc3BhY2UtbGVmdCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTcnLCd0b2dnbGUtb24tYWxsLXdvcmtzcGFjZXMnLFxuICAgICdjeWNsZS1ncm91cCcsJ21vdmUtdG8tY29ybmVyLW53JywnbW92ZS10by13b3Jrc3BhY2UtMTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1yaWdodCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UtYmFja3dhcmQgIHN3aXRjaC10by13b3Jrc3BhY2UtOCcsJ3RvZ2dsZS1zaGFkZWQnLFxuICAgICdjeWNsZS1ncm91cC1iYWNrd2FyZCcsJ21vdmUtdG8tY29ybmVyLXNlJywnbW92ZS10by13b3Jrc3BhY2UtMTInLCdtb3ZlLXRvLXdvcmtzcGFjZS11cCcsJ3N3aXRjaC1wYW5lbHMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTknLCd1bm1heGltaXplJyxcbiAgICAnY3ljbGUtcGFuZWxzJywnbW92ZS10by1jb3JuZXItc3cnLCdtb3ZlLXRvLXdvcmtzcGFjZS0yJywncGFuZWwtbWFpbi1tZW51Jywnc3dpdGNoLXBhbmVscy1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtZG93bicsXG4gICAgJ2N5Y2xlLXBhbmVscy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1kb3duJywnbW92ZS10by13b3Jrc3BhY2UtMycsJ3BhbmVsLXJ1bi1kaWFsb2cnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxhc3QnLFxuICAgICdjeWNsZS13aW5kb3dzJywnbW92ZS10by1tb25pdG9yLWxlZnQnLCdtb3ZlLXRvLXdvcmtzcGFjZS00JywncmFpc2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sZWZ0JyxcbiAgICAnY3ljbGUtd2luZG93cy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1yaWdodCcsJ21vdmUtdG8td29ya3NwYWNlLTUnLCdyYWlzZS1vci1sb3dlcicsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLXJpZ2h0JyxcbiAgICAnbG93ZXInLCdtb3ZlLXRvLW1vbml0b3ItdXAnLCdtb3ZlLXRvLXdvcmtzcGFjZS02Jywnc2V0LXNwZXctbWFyaycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTInLCdzd2l0Y2gtdG8td29ya3NwYWNlLXVwJyxcbiAgICAnbWF4aW1pemUnLCdtb3ZlLXRvLXNpZGUtZScsJ21vdmUtdG8td29ya3NwYWNlLTcnLCdzaG93LWRlc2t0b3AnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTInLCdzd2l0Y2gtd2luZG93cydcbl07XG5jb25zdCBnbm9tZVNoZWxsS2V5YmluZGluZ3MgPSBbJ2ZvY3VzLWFjdGl2ZS1ub3RpZmljYXRpb24nLCdvcGVuLWFwcGxpY2F0aW9uLW1lbnUnLCdzY3JlZW5zaG90Jywnc2NyZWVuc2hvdC13aW5kb3cnLCdzaGlmdC1vdmVydmlldy1kb3duJyxcbiAgICAnc2hpZnQtb3ZlcnZpZXctdXAnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMScsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0yJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTMnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi01JyxcbiAgICAnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTYnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi04Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTknLCdzaG93LXNjcmVlbnNob3QtdWknLCdzaG93LXNjcmVlbi1yZWNvcmRpbmctdWknLFxuICAgICd0b2dnbGUtYXBwbGljYXRpb24tdmlldycsJ3RvZ2dsZS1tZXNzYWdlLXRyYXknLCd0b2dnbGUtb3ZlcnZpZXcnXTtcbmNvbnN0IGdub21lTXV0dGVyS2V5YmluZGluZ3MgPSBbJ3JvdGF0ZS1tb25pdG9yJywnc3dpdGNoLW1vbml0b3InLCd0YWItcG9wdXAtY2FuY2VsJywndGFiLXBvcHVwLXNlbGVjdCcsJ3RvZ2dsZS10aWxlZC1sZWZ0JywndG9nZ2xlLXRpbGVkLXJpZ2h0J107XG5jb25zdCBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncyA9IFsnYXBwLWN0cmwtaG90a2V5LTEnLCdhcHAtY3RybC1ob3RrZXktMTAnLCdhcHAtY3RybC1ob3RrZXktMicsJ2FwcC1jdHJsLWhvdGtleS0zJywnYXBwLWN0cmwtaG90a2V5LTQnLCdhcHAtY3RybC1ob3RrZXktNScsXG4gICAgJ2FwcC1jdHJsLWhvdGtleS02JywnYXBwLWN0cmwtaG90a2V5LTcnLCdhcHAtY3RybC1ob3RrZXktOCcsJ2FwcC1jdHJsLWhvdGtleS05JyxcbiAgICAnYXBwLWhvdGtleS0xJywnYXBwLWhvdGtleS0xMCcsJ2FwcC1ob3RrZXktMicsJ2FwcC1ob3RrZXktMycsJ2FwcC1ob3RrZXktNCcsJ2FwcC1ob3RrZXktNScsJ2FwcC1ob3RrZXktNicsJ2FwcC1ob3RrZXktNycsJ2FwcC1ob3RrZXktOCcsJ2FwcC1ob3RrZXktOScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktMScsJ2FwcC1zaGlmdC1ob3RrZXktMTAnLCdhcHAtc2hpZnQtaG90a2V5LTInLCdhcHAtc2hpZnQtaG90a2V5LTMnLCdhcHAtc2hpZnQtaG90a2V5LTQnLCdhcHAtc2hpZnQtaG90a2V5LTUnLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTYnLCdhcHAtc2hpZnQtaG90a2V5LTcnLCdhcHAtc2hpZnQtaG90a2V5LTgnLCdhcHAtc2hpZnQtaG90a2V5LTknLCdzaG9ydGN1dCddO1xuY29uc3QgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MgPSBbJ3N3aXRjaC10by1zZXNzaW9uLTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0yJywnc3dpdGNoLXRvLXNlc3Npb24tMycsJ3N3aXRjaC10by1zZXNzaW9uLTQnLCdzd2l0Y2gtdG8tc2Vzc2lvbi01Jywnc3dpdGNoLXRvLXNlc3Npb24tNicsJ3N3aXRjaC10by1zZXNzaW9uLTcnLCdzd2l0Y2gtdG8tc2Vzc2lvbi04Jywnc3dpdGNoLXRvLXNlc3Npb24tOScsJ3N3aXRjaC10by1zZXNzaW9uLTEwJywnc3dpdGNoLXRvLXNlc3Npb24tMTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMiddO1xuXG4vKipcbiAqIEVuYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgKEtERS9HTk9NRSwgY2xvc2UgYXBwcywgY2xpcGJvYXJkKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNLREVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNHTk9NRVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBpc0tERSwgaXNHTk9NRSkge1xuICAgIHRyeSB7XG4gICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiYCwgKHBncmVwRXJyb3IsIHN0ZG91dCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcGdyZXBFcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cIiB8IHhhcmdzIC1yIGtpbGwgLTlgLCAoa2lsbEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtpbGxFcnJvcikgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmIChpc0tERSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBLREUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2tyZWFkY29uZmlnNScsIFsnLS1maWxlJywgJ2t3aW5yYycsICctLWdyb3VwJywgJ0Rlc2t0b3BzJywgJy0ta2V5JywgJ051bWJlciddLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChrcmVhZGNvbmZpZyk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gMTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHJlY29uZmlndXJpbmcga3dpblwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCBgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywgJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJ1wiXCInXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCcxJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3NldEN1cnJlbnREZXNrdG9wJywnMSddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGVmZmVjdHNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ2Rlc2t0b3BncmlkJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdzY3JlZW5lZGdlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdvdmVydmlldyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogYWRkaXRpb25hbCB0dHknc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnc3J2cmtleXM6bm9uZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbGVhcmluZyBjbGlwYm9hcmQgaGlzdG9yeVwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdvcmcua2RlLktHbG9iYWxBY2NlbC5ibG9ja0dsb2JhbFNob3J0Y3V0cycsICd0cnVlJ10pO1xuICAgICAgICB9LCAyMDAwKTtcbiAgICB9XG5cbiAgICBpZiAoaXNHTk9NRSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBHTk9NRSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdheWxhbmQ6IGRpc2FibGUgVlQvVFRZIHN3aXRjaCAoQ3RybCtBbHQrRjEuLkYxMikgdmlhIG11dHRlciBrZXliaW5kaW5nc1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnLCAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYmluZGluZywgYFsnJ11gXSk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkY29uZicsIFsnd3JpdGUnLCBgL29yZy9nbm9tZS9tdXR0ZXIvd2F5bGFuZC9rZXliaW5kaW5ncy8ke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5JywgYCcnYF0pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLm11dHRlciBkeW5hbWljLXdvcmtzcGFjZXMgZmFsc2UnKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5kZXNrdG9wLndtLnByZWZlcmVuY2VzIG51bS13b3Jrc3BhY2VzIDEnKTtcbiAgICAgICAgICAgIC8vIFgxMSBvbmx5OiBkaXNhYmxlIFRUWSBzd2l0Y2ggdmlhIHNldHhrYm1hcCAob24gV2F5bGFuZCB3ZSByZWx5IG9uIG11dHRlciBrZXliaW5kaW5ncyBhYm92ZSlcbiAgICAgICAgICAgIGlmICghcGxhdGZvcm1EaXNwYXRjaGVyLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnc2V0eGtibWFwIC1vcHRpb24gc3J2cmtleXM6bm9uZScsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChHTk9NRSk6IHNldHhrYm1hcCBzcnZya2V5czpub25lIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGdzZXR0aW5ncyk6ICR7ZXJyfWApOyB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgYW5kIHJlc3RvcmUgS0RFL0dOT01FIHNldHRpbmdzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1N0b3JlIC0gc2hhcmVkIHN0b3JlIChjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlKSB7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCd3bC1jb3B5JywgWyctYyddKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hzZWwgLWJjJyk7XG5cbiAgICBjaGlsZFByb2Nlc3MuZXhlYygnZWNobyAkWERHX0NVUlJFTlRfREVTS1RPUCcsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBleGVjIGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGRvdXQudHJpbSgpID09PSAnS0RFJykge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogS0RFIGRldGVjdGVkXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAnZmFsc2UnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nICwnL0NvbXBvc2l0b3InLCAnb3JnLmtkZS5rd2luLkNvbXBvc2l0aW5nLnJlc3VtZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IGtnbG9iYWxhY2NlbDUmJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJy0tZGVsZXRlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCdrd2lucmMnLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHNdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdrc3RhcnQ1IHBsYXNtYXNoZWxsICYnLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5kZXNrdG9wLndtLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmddKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyJywgJ292ZXJsYXkta2V5J10pO1xuICAgIC8vIHJlc3RvcmUgVFRZIHN3aXRjaCBpZiB3ZSBoYWQgZGlzYWJsZWQgaXQgdmlhIHNldHhrYm1hcCAoR05PTUUgWDExKVxuICAgIGlmIChjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoXCJzZXR4a2JtYXAgLW9wdGlvbiAnJ1wiLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBsb2cud2FybigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBzZXR4a2JtYXAgcmVzdG9yZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQgPSBmYWxzZTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFdpbmRvd3Mtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSkuXG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLyoqXG4gKiBFbmFibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHNob3J0Y3V0cywgY2xvc2UgYXBwcywga2lsbCBleHBsb3JlcikuXG4gKiBAcGFyYW0ge29iamVjdH0gd2luaGFuZGxlciAtIG11c3QgaGF2ZSB3aW5oYW5kbGVyLmV4YW13aW5kb3dcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBvbmUgbW9yZSBsZXZlbCB1cDogcmVzdHJpY3Rpb25zLyAtPiBzY3JpcHRzLyAtPiBtYWluLyAtPiBwYWNrYWdlcy8gKHNhbWUgdGFyZ2V0IGFzIG9yaWdpbmFsIHBsYXRmb3JtcmVzdHJpY3Rpb25zLmpzIGluIHNjcmlwdHMvKVxuICAgICAgICBjb25zdCBleGVjdXRhYmxlMSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vcHVibGljL2Rpc2FibGUtc2hvcnRjdXRzLmV4ZScpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTEsIFtdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScsIHNoZWxsOiBmYWxzZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmRvd3Mgc2hvcnRjdXRzIGRpc2FibGVkXCIpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gc2hvcnRjdXRzKTogJHtlcnJ9YCk7IH1cblxuICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgYXBwIG9mIGFwcHNUb0Nsb3NlKSB7XG4gICAgICAgICAgICBjb25zdCBlc2NhcGVkQXBwID0gYXBwLnJlcGxhY2UoLycvZywgXCInJ1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJGFwcE5hbWUgPSAnJHtlc2NhcGVkQXBwfSc7IHRyeSB7ICRwcm9jcyA9IEdldC1Qcm9jZXNzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHsgJF8uUHJvY2Vzc05hbWUgLWlsaWtlICgnKicgKyAkYXBwTmFtZSArICcqJykgfTsgaWYgKCRwcm9jcyAtYW5kICRwcm9jcy5Db3VudCAtZ3QgMCkgeyAkcHJvY3MgfCBTdG9wLVByb2Nlc3MgLUZvcmNlIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlOyBXcml0ZS1PdXRwdXQgJ2tpbGxlZCcgfSB9IGNhdGNoIHsgfVwiYDtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlQXBwKSA9PiB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpLmluY2x1ZGVzKCdraWxsZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZUFwcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmICghd2luaGFuZGxlcikge1xuICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmhhbmRsZXIgaXMgbm90IHByb3ZpZGVkIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcmV0cnlDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMDA7XG4gICAgICAgIGNvbnN0IGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAod2luaGFuZGxlci5leGFtd2luZG93ICYmICF3aW5oYW5kbGVyLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2traWxsIC9mIC9pbSBleHBsb3Jlci5leGUnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZXhwbG9yZXIuZXhlYCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXRyeUNvdW50IDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgIHJldHJ5Q291bnQrKztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMsIDEwMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZXhhbXdpbmRvdyBub3QgZm91bmQgYWZ0ZXIgJHttYXhSZXRyaWVzICogMTAwfW1zIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cygpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh1bmJsb2NrIHNob3J0Y3V0cywgcmVzdGFydCBleHBsb3JlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpIHtcbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogdW5ibG9ja2luZyBzaG9ydGN1dHMuLi5cIik7XG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHRhc2traWxsICAvSU0gXCJkaXNhYmxlLXNob3J0Y3V0cy5leGVcIiAvVCAvRmAsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZGlzYWJsZS1zaG9ydGN1dHMuZXhlYCk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgZXhwbG9yZXIuZXhlXCInLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHRhc2tsaXN0IGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKCdleHBsb3Jlci5leGUnKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiByZXN0YXJ0aW5nIGV4cGxvcmVyLi4uXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ3N0YXJ0IGV4cGxvcmVyLmV4ZScsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gZXhwbG9yZXIpOiAke2UubWVzc2FnZX1gKTsgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBtYWNPUy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlLCB0b2dnbGVNYWNPU0xvY2tkb3duKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IFRvdWNoQmFyLCBzeXN0ZW1QcmVmZXJlbmNlcywgcG93ZXJNb25pdG9yIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyBzdG9yZWQgcmVmcyBmb3IgY2xlYW51cCB3aGVuIGRpc2FibGluZyBtYWNPUyByZXN0cmljdGlvbnNcbmxldCB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG5sZXQgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG5sZXQgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuXG4vKiogU2luZ2xlIGhhbmRsZXIgZm9yIGFsbCBtYWNPUyByZXN0cmljdGlvbiBzaWduYWxzOiBsb2cgYW5kIHJlLWZvY3VzIGV4YW0gd2luZG93IC8gaW5mb3JtIHRlYWNoZXIuICovXG5mdW5jdGlvbiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKHNpZ25hbE5hbWUpIHtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6ICR7c2lnbmFsTmFtZX0gZGV0ZWN0ZWRgKTtcbiAgICBpZiAoIWN1cnJlbnRXaW5oYW5kbGVyPy5leGFtd2luZG93Py5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbykgY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpO1xuICAgIH1cbn1cblxuY29uc3QgbG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdsb2NrLXNjcmVlbicpO1xuY29uc3QgdW5sb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ3VubG9jay1zY3JlZW4nKTtcblxuLyoqXG4gKiBFbmFibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChUb3VjaEJhciwgY2xpcGJvYXJkLCBjbG9zZSBhcHBzLCB3b3Jrc3BhY2UvbG9jayBtb25pdG9yaW5nKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgY29uc3QgeyBUb3VjaEJhckxhYmVsLCBUb3VjaEJhclNwYWNlciB9ID0gVG91Y2hCYXI7XG4gICAgY29uc3QgdGV4dGxhYmVsID0gbmV3IFRvdWNoQmFyTGFiZWwoeyBsYWJlbDogXCJOZXh0LUV4YW1cIiB9KTtcbiAgICBjb25zdCB0b3VjaEJhciA9IG5ldyBUb3VjaEJhcih7XG4gICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgdGV4dGxhYmVsLFxuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgXVxuICAgIH0pO1xuICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdz8uc2V0VG91Y2hCYXIodG91Y2hCYXIpO1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gd2luaGFuZGxlcjtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdwYmNvcHkgPCAvZGV2L251bGwnKTtcblxuICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBraWxsIC05IC1mIFwiJHthcHB9XCJgLCAoZXJyb3IsIHN0ZGVyciwgc3Rkb3V0KSA9PiB7fSk7XG4gICAgfSk7XG5cbiAgICAvLyB3b3Jrc3BhY2Uvc3BhY2Ugc3dpdGNoIGFuZCBsb2NrL3VubG9jayBtb25pdG9yaW5nIChtYWNPUyBvbmx5KVxuICAgIHRyeSB7XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gc3lzdGVtUHJlZmVyZW5jZXMuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKCdOU1dvcmtzcGFjZUFjdGl2ZVNwYWNlRGlkQ2hhbmdlTm90aWZpY2F0aW9uJywgKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnZGVza3RvcC9zcGFjZSBzd2l0Y2gnKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cblxuICAgIHBvd2VyTW9uaXRvci5vbignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9uKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG5cbiAgICBsb2dTdHJlYW1Qcm9jZXNzID0gc3Bhd24oJ2xvZycsIFsnc3RyZWFtJywgJy0tcHJlZGljYXRlJywgJ3N1YnN5c3RlbSA9PSBcImNvbS5hcHBsZS5kb2NrXCIgQU5EIGNhdGVnb3J5ID09IFwibWlzc2lvbmNvbnRyb2xcIiddKTtcbiAgICBsb2dTdHJlYW1Qcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuICAgICAgICBpZiAoZGF0YS50b1N0cmluZygpLmluY2x1ZGVzKCdtb2RlJykpIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ01pc3Npb24gQ29udHJvbCcpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIERpc2FibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh0b3VjaGJhciwgbW9uaXRvcmluZyBsaXN0ZW5lcnMgYW5kIGxvZyBwcm9jZXNzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKSB7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuICAgIGlmICh3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7IHN5c3RlbVByZWZlcmVuY2VzLnVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkKTsgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG4gICAgfVxuICAgIHBvd2VyTW9uaXRvci5vZmYoJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vZmYoJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBpZiAobG9nU3RyZWFtUHJvY2Vzcykge1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGVzL2VuYWJsZXMgbWlzc2lvbiBjb250cm9sLCBzcGFjZXMgYW5kIHRyYWNrcGFkIGdlc3R1cmVzLlxuICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSB0cnVlIHJlc3RvcmVzIGV2ZXJ5dGhpbmcsIGZhbHNlIGxvY2tzIGV2ZXJ5dGhpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIHJldHVybjtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCB0b2dnbGVNYWNPU0xvY2tkb3duOiAke2VuYWJsZSA/ICdlbmFibGUnIDogJ2Rpc2FibGUnfSBtaXNzaW9uIGNvbnRyb2wgbG9ja2Rvd25gKTtcblxuICAgIGNvbnN0IG1jSWRzID0gWzMyLCAzMywgMzQsIDM1LCA3OSwgODAsIDgxLCA4MiwgMTE4LCAxMTksIDEyMCwgMTIxXTtcbiAgICBjb25zdCBwbGlzdFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5LCAnTGlicmFyeS9QcmVmZXJlbmNlcy9jb20uYXBwbGUuc3ltYm9saWNob3RrZXlzLnBsaXN0Jyk7XG4gICAgY29uc3QgYmFja3VwUGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3RvcnksICduZXh0X2V4YW1faG90a2V5c19iYWNrdXAucGxpc3QnKTtcblxuICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgY29uc3QgaG90a2V5Q29tbWFuZHMgPSBtY0lkcy5tYXAoaWQgPT5cbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuc3ltYm9saWNob3RrZXlzIEFwcGxlU3ltYm9saWNIb3RLZXlzIC1kaWN0LWFkZCAke2lkfSBcIjxkaWN0PjxrZXk+ZW5hYmxlZDwva2V5PjxmYWxzZS8+PC9kaWN0PlwiYFxuICAgICAgICApLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAhIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gY3AgXCIke3BsaXN0UGF0aH1cIiBcIiR7YmFja3VwUGF0aH1cIjsgZmk7XG4gICAgICAgICR7aG90a2V5Q29tbWFuZHN9O1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcblxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRW5hYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIFxuICAgICAgICAgIGNwIFwiJHtiYWNrdXBQYXRofVwiIFwiJHtwbGlzdFBhdGh9XCI7IFxuICAgICAgICAgIHJtIFwiJHtiYWNrdXBQYXRofVwiOyBcbiAgICAgICAgZmk7XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuICAgICAgICBsb2cuaW5mbygnbWFpbiBAIHRvZ2dsZU1hY09TTG9ja2Rvd246IEVuYWJsZSBNaXNzaW9uQ29udG9sJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBEaXNhYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4ndXNlIHN0cmljdCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInICAgLy8gZGFzIG1hY2h0IGtyYXNzZXN0ZSByYWNlY29kaXRpb25zIG1pdCBlbGVjdHJvbiBlaWdlbmVuIHZlcnNpb25lbiAtIHVuYmVkaW5ndCBkaWUgc2VsYmUgdmVyc2lvbiBiZWhhbHRlbiB3aWUgZWxlY3Ryb25cbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBzY3JlZW4sIGlwY01haW4sIGFwcCwgQnJvd3NlcldpbmRvdywgd2ViQ29udGVudHMgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBzY3JlZW5zaG90IGZyb20gJ3NjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kJztcbmltcG9ydCB7IFdvcmtlciB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgcnVuUmVtb3RlQ2hlY2sgfSBmcm9tICcuL3JlbW90ZUNoZWNrLmpzJ1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5cbmNvbnN0IHNoZWxsID0gKGNtZCkgPT4geyAgIHJldHVybiBleGVjU3luYyhjbWQsIHsgZW5jb2Rpbmc6ICd1dGY4Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pOyB9OyAgLy8gc3RkZXJyIHVudGVyZHJcdTAwRkNja3QgXG5jb25zdCBhZ2VudCA9IG5ldyBodHRwcy5BZ2VudCh7IHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyBcblxuIC8qKlxuICAqIEhhbmRsZXMgaW5mb3JtYXRpb24gZmV0Y2hpbmcgZnJvbSB0aGUgc2VydmVyIGFuZCBhY3RzIG9uIHN0YXR1cyB1cGRhdGVzXG4gICovXG4gXG4gY2xhc3MgQ29tbUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IGZhbHNlXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMCAvLyB3ZSBjb3VudCBmYWlscyBhbmQgZGVhY3RpdmF0ZSBvbiA0IGNvbnNlcXVlbnQgZmFpbHNcbiAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IHRydWVcbiAgICAgICAgdGhpcy50aW1lciA9IDBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBudWxsXG4gICAgICAgIHRoaXMudXNlV29ya2VyID0gdHJ1ZVxuICAgICAgICB0aGlzLndvcmtlckZhaWxzID0gMFxuICAgIH1cbiBcbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnJlcXVlc3RVcGRhdGUuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRTY3JlZW5zaG90LmJpbmQodGhpcyksIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICBpZiAoIXRoaXMud29ya2VyICYmIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyAgdGhpcy5zZXR1cEltYWdlV29ya2VyKCkgIH1cbiAgICB9XG4gXG5cbiAgICAvKipcbiAgICAgKiBTZXR1cCB0aGUgaW1hZ2Ugd29ya2VyXG4gICAgICogdXNlcyBmb3JrIHRvIGNyZWF0ZSBhIG5ldyBjaGlsZCBwcm9jZXNzXG4gICAgICogdXNlcyB0aGUgaW1hZ2VXb3JrZXJMaW51eC5qcyBvciBpbWFnZVdvcmtlclNoYXJwLmpzIGZpbGVcbiAgICAgKiB0aGUgd29ya2VyIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzZXR1cEltYWdlV29ya2VyKCkge1xuICAgICAgICBjb25zdCB3b3JrZXJVUkwgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyVVJMO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlclVSTCwgeyB0eXBlOiAnbW9kdWxlJywgZW52OiB7IC4uLnByb2Nlc3MuZW52IH0gfSk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogSW1hZ2VXb3JrZXIgaW5pdGlhbGl6ZWQuIFVzaW5nIFwiICsgcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlckZpbGVOYW1lKVxuICAgICAgICBcblxuICAgICAgICB0aGlzLndvcmtlci5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlci5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlckZhaWxzICs9IDFcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53b3JrZXJGYWlscyA+IDQpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZmFpbGVkIDUgdGltZXMgLSBzd2l0Y2hpbmcgdG8gbm8gcHJvY2Vzc2luZycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBcbiAgICAgKiBpZiB1c2VXb3JrZXIgaXMgdHJ1ZSwgdGhlIHNjcmVlbnNob3QgaXMgcHJvY2Vzc2VkIGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqIG90aGVyd2lzZSB0aGUgc2NyZWVuc2hvdCBpcyBub3QgcHJvY2Vzc2VkIGFuZCB0aGUgb3JpZ2luYWwgc2NyZWVuc2hvdCBpcyByZXR1cm5lZFxuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NJbWFnZShpbWdCdWZmZXIpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy53b3JrZXIpIHsgLy90cmlwbGUgY2hlY2sgaWYgd29ya2VyIGlzIGluaXRpYWxpemVkXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXb3JrZXIgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7IGltZ0J1ZmZlcjogQXJyYXkuZnJvbShpbWdCdWZmZXIpLCBpbVZlcnNpb246IHBsYXRmb3JtRGlzcGF0Y2hlci5pbVZlcnNpb24gfSk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlci5vbmNlKCdtZXNzYWdlJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7IFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmFsbGJhY2sgdG8gbm8gcHJvY2Vzc2luZyAgIFxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltZ0J1ZmZlcikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyQmFzZTY0ID0gc2NyZWVuc2hvdEJhc2U2NFxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgc2NyZWVuc2hvdEJhc2U2NDogc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0OiBoZWFkZXJCYXNlNjQsIGlzYmxhY2s6IGZhbHNlLCBpbWdCdWZmZXI6IGltZ0J1ZmZlciB9O1xuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cbiAgICAvKiogXG4gICAgICogVXBkYXRlIGN1cnJlbnQgU2VydmVyc3RhdHVzICsgU3R1ZGVudHRzdGF0dXMgKGV2ZXJ5IDUgc2Vjb25kcylcbiAgICAgKi9cbiAgICBhc3luYyByZXF1ZXN0VXBkYXRlKCl7XG5cbiAgICAgICAgdGhpcy50aW1lcisrICAgLy8gd2UgdXNlIHRpbWVyIHRvIHRpbWUgbG9vcHMgd2l0aCBkaWZmZXJlbnQgaW50ZXJ2YWxzIHdpdGhvdXQgaW50cm9kdWNpbmcgbmV3IHVubmVjY2VzYXJ5IHNjaGVkdWxlcnNcbiAgICAgICAgaWYgKHRoaXMudGltZXIgJSAyMCA9PT0gMCApeyAgLy8gcnVuIGV2ZXJ5IDIwKjUgKHVwZGF0ZWxvb3ApIHNlY29uZHNcblxuICAgICAgICAgICAgY29uc3QgdXNlc1JlbW90ZUFzc2lzdGFudCA9IGF3YWl0IHJ1blJlbW90ZUNoZWNrKHByb2Nlc3MucGxhdGZvcm0pXG5cbiAgICAgICAgICAgIGlmICh1c2VzUmVtb3RlQXNzaXN0YW50KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZWFkeTogUG9zc2libGUgcmVtb3RlIGFzc2lzdGFuY2UgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5rZXl3b3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBLZXl3b3JkICR7a2V5d29yZH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb3J0IG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQucG9ydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogUG9ydCAke3BvcnR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50ID0gdXNlc1JlbW90ZUFzc2lzdGFudFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKCkgIC8vIGNoZWNrIGlmIHRoZXJlIGlzIGEgbmV3IHNjcmVlbiB0aGF0IG5lZWRzIHRvIGJlIGJsb2NrZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWQgIG5vIHNlcnZlcnNpZ25hbCBmb3IgMjAgc2Vjb25kc1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApeyAgXG4gICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBDb25uZWN0aW9uIHRvIFRlYWNoZXIgbG9zdCEgUmVtb3ZpbmcgcmVnaXN0cmF0aW9uLlwiKSAvL3JlbW92ZSBzZXJ2ZXIgcmVnaXN0cmF0aW9uIGxvY2FsbHkgKHNhbWUgYXMgJ2tpY2snKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICAgICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgICAvLyB0aGlzIGFsc28gcmVzZXRzIHNlcnZlcmlwIHRoZXJlZm9yZSBubyBhcGkgY2FsbHMgYXJlIG1hZGUgYWZ0ZXJ3YXJkc1xuICAgICAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAgICAgICAvLyBqdXN0IGluIGNhc2Ugc2NyZWVucyBhcmUgYmxvY2tlZC4uIGxldCBzdHVkZW50cyB3b3JrXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gIFxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0ge2NsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm99XG5cbiAgICAgICAgICAgIGZldGNoKGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVgLCB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7IH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICAgICAgKGRhdGEubWVzc2FnZSA9PT0gXCJub3RhdmFpbGFibGVcIil7IGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IEV4YW0gSW5zdGFuY2Ugbm90IGZvdW5kIScpOyAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSA1OyB9ICAgIC8vIGV4YW0gaW5zdGFuY2Ugbm90IGF2YWlsYWJsZSBidXQgc2VydmVyIHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChkYXRhLm1lc3NhZ2UgPT09IFwicmVtb3ZlZFwiKXsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IFN0dWRlbnQgcmVnaXN0cmF0aW9uIG5vdCBmb3VuZCEnKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KClcbiAgICAgICAgICAgICAgICAgICAgfSAgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCAtIHdlIGhhbmRsZSB0aGlzIGRpZmZlcmVudGx5IG5vdy4gdGVhY2hlciBzdG9yZXMgXCJraWNrZWRcIiBmb3Igc3R1ZGVudCB0byBjb2xsZWN0LiBzdHVkZW50IGlzIHJlbW92ZWQgZnJvbSBzZXJ2ZXIgd2hlbiBjb2xsZWN0aW5nIGtpY2tlZCBpbmZvLiBzdHVkZW50IGNsb3NlcyBleGFtIGFuZCBjbGVhbnMgdXAuXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSBIZWFydGJlYXQgbG9zdC4uYCk7ICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO30gICAvLyBoZWFydGJlYXQgbG9zdCBzZXJ2ZXIgbm90IHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMDsgLy8gRGllcyB6XHUwMEU0aGx0IGViZW5mYWxscyBhbHMgZXJmb2xncmVpY2hlciBIZWFydGJlYXQgLSBWZXJiaW5kdW5nIGhhbHRlblxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IGZhbHNlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlclN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnNlcnZlcnN0YXR1cykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHVkZW50U3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc3R1ZGVudHN0YXR1cykpOyBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJTdGF0dXNEZWVwQ29weSwgc3R1ZGVudFN0YXR1c0RlZXBDb3B5KTsvLyBWZXJhcmJlaXR1bmcgZGVyIGVtcGZhbmdlbmVuIERhdGVuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogKCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9KSAke2Vycm9yfWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IC8vIHByZXZlbnQgZm9jdXMgd2FybmluZyBibG9jayBpZiBubyBjb25uZWN0aW9uIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIGlmIG5vdCBjb25uZWN0ZWQgYnV0IHN0aWxsIGluIGV4YW0gbW9kZSB5b3UgY291bGQgdHJpZ2dlciBhIGZvY3VzIHdhcm5pbmcgYW5kIG5vYm9keSBpcyBhYmxlIHRvIHVubG9jayB5b3VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICBhc3luYyBzZW5kU2NyZWVuc2hvdCgpe1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7cmV0dXJufSAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZFxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2s7IC8vIFZhcmlhYmxlbiBhdVx1MDBERmVyaGFsYiBkZXMgaWYtQmxvY2tzIGRlZmluaWVyZW5cbiAgICAgICAgICAgIGxldCBpbWdCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBzY3JlZW5zaG90IGZyb20gZGVza3RvcCB2aWEgc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQgKGZsYW1lc2hvdCwgaW1hZ2VtYWdpYywgZXRjKVxuICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90KHsgZm9ybWF0OiAncG5nJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrLCBpbWdCdWZmZXIgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAgLy8ga2VpbiBpbWFnZUJ1ZmZlciBtaXRnZWdlYmVuIGJlZGV1dGV0IG51dHplIHNjcmVlbnNob3QtZGVza3RvcCBpbSB3b3JrZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHsgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwO31cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW1hZ2UgcHJvY2Vzc2luZyBmYWlsZWRcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBcInNjcmVlbnNob3RcIiBmcm9tIGFwcHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEZvY3VzZWRNaW5kb3cgPSBXaW5kb3dIYW5kbGVyLmdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkgIC8vcmV0dXJucyBleGFtIHdpbmRvdyBpZiBub3RoaW5nIGluIGZvY3VzIG9yIG1haW4gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Rm9jdXNlZE1pbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGN1cnJlbnRGb2N1c2VkTWluZG93LndlYkNvbnRlbnRzLmNhcHR1cmVQYWdlKCkgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyB3b3JrIGJlY2F1c2UgaXQncyBvbmJvYXJkIGVsZWN0cm9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSByZXN1bHQudG9QTkcoKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjayB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7IC8vIGF0dGVudGlvbiBwcm9jZXNzSW1hZ2UgIGNvbnZlcnRzIGJ1ZmZlciB0byB1aW50OGFycmF5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyArPTE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBwcm9jZXNzSW1hZ2UgZmFpbGVkOiAke2Vycn1gKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTUFDT1MgV09SS0FST1VORCAtIHN3aXRjaCB0byBwYWdlY2FwdHVyZSBpZiBubyBwZXJtaXNzb25zIGFyZSBncmFudGVkXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiICYmIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgJiYgaW1nQnVmZmVyICE9PSBudWxsKXsgIC8vdGhpcyBpcyBmb3IgbWFjT1MgYmVjYXVzZSBpdCBkZWxpdmVycyBhIGJsYW5rIGJhY2tncm91bmQgc2NyZWVuc2hvdCB3aXRob3V0IHBlcm1pc3Npb25zLiB3ZSBjYXRjaCB0aGF0IGNhc2Ugd2l0aCBhIHdvcmthcm91bmRcbiAgICAgICAgICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gZmFsc2UgICAvL25ldmVyIGRvIHRoaXMgYWdhaW5cbiAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpO1xuICAgICAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhOiB7IHRleHQgfSB9ICAgPSBhd2FpdCBUZXNzZXJhY3QucmVjb2duaXplKGltZ0J1ZmZlciAsICdlbmcnLHsgbGFuZ1BhdGg6IHB1YmxpY1BhdGggfSApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwV2luZG93VmlzaWJsZSA9IHRleHQuaW5jbHVkZXMoXCJFeGFtXCIpICAgLy9jaGVjayBpZiB0aGUgd29yZCBcIkV4YW1cIiBjYW4gYmUgZm91bmQgaW4gc2NyZWVuc2hvdCAtIG90aGVyd2lzZSBpdCBpcyBtb3N0IGxpa2VseSBhIGJsYW5rIGRlc2t0b3AgLSBtYWNvcyBxdWlya1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFwcFdpbmRvd1Zpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IFBsZWFzZSBjaGVjayB5b3VyIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgLSBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBNYWNPUyBzY3JlZW5zaG90cGVybWlzc2lvbnMgY2hlY2sgT0tcIik7fVxuICAgICAgICAgICAgICAgIH1jYXRjaChlcnIpeyAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gaWYgc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2UgZG8gbm90IGhhdmUgYSBzY3JlZW5zaG90IC0gc28gZG8gbm90IHVwZGF0ZSB0aGUgc2VydmVyXG4gICAgICAgICAgICBpZiAoIXNjcmVlbnNob3RCYXNlNjQpe1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU2NyZWVuc2hvdCBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVgKSB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFBhZ2VDYXB0dXJlIGVycm9yIC0+IFN3aXRjaGluZyB0byBOby1Qcm9jZXNzaW5nYCkgfSAgIFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBubyBzY3JlZW5zaG90IGF2YWlsYWJsZSAtIHBsZWFzZSBmaXggeW91ciBzZXR1cGApIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuXG5cblxuICAgICAgICAgICAgLy9kbyBub3QgcnVuIGNvbG9yY2hlY2sgaWYgYWxyZWFkeSBsb2NrZWRcbiAgICAgICAgICAgIGlmICggdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyl7XG4gICAgICAgICAgICAgICAgaWYgKGlzYmxhY2spe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgZml0IHJlcXVpcmVtZW50cyAoYWxsYmxhY2spXCIpO1xuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBsZXQgc2NyZWVuc2hvdGhhc2ggPSBudWxsXG4gICAgICAgICAgICB0cnkgeyBzY3JlZW5zaG90aGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICB9ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogY3JlYXRpbmcgaGFzaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3Q6IHNjcmVlbnNob3RCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGhhc2g6IHNjcmVlbnNob3RoYXNoLFxuICAgICAgICAgICAgICAgIGhlYWRlcjogaGVhZGVyQmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RmaWxlbmFtZTogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiArIFwiLmpwZ1wiLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHNlbmQgc2NyZWVuc2hvdCB0byBzZXJ2ZXIgdmlhIGVtYWlsIGZldGNoIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBhdHRlbXB0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAyO1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZXNjcmVlbnNob3RgO1xuICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCwgbWF4UmV0cmllcyk7IC8vIEVyc3RlIEFuZnJhZ2Ugc3RhcnRlblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cbiAgICBkb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCA9IDAsIG1heFJldHJpZXMpIHtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBTdGF0dXMgRXJyb3I6XCIsIGRhdGEubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heFJldHJpZXMgLSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCArIDEsIG1heFJldHJpZXMpOyAvLyBSZXRyeVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRlbXB0ID09PSBtYXhSZXRyaWVzIC0gMSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGUgKGZldGNoKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuICAgIGFzeW5jIGtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lja1N0dWRlbnQ6IFN0dWRlbnQgZ290IGtpY2tlZCBieSBUZWFjaGVyXCIpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge2RlbGZvbGRlcm9uZXhpdDogZmFsc2V9ICAvLyBkbyBub3QgZGVsZXRlIGZvbGRlciBvbiBleGl0IGJlY2F1c2Ugc3R1ZGVudCBnb3Qga2lja2VkXG4gICAgICAgIGlmIChzdHVkZW50c3RhdHVzICYmIHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyKXsgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9IHRydWV9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogcmVhY3QgdG8gc2VydmVyIHN0YXR1cyBcbiAgICAgKiB0aGlzIGN1cnJlbnRseSBvbmx5IGhhbmRsZSBzdGFydGV4YW0gJiBlbmRleGFtXG4gICAgICogY291bGQgYWxzbyBoYW5kbGUga2ljaywgZm9jdXNyZXN0b3JlLCBhbmQgZXZlbiB0cmlnZ2VyIGZpbGUgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJzdGF0dXMsIHN0dWRlbnRzdGF0dXMpe1xuICAgICAgIFxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGluZGl2aWR1YWwgc3RhdHVzIHVwZGF0ZXNcblxuICAgICAgICBpZiAoIHN0dWRlbnRzdGF0dXMgJiYgT2JqZWN0LmtleXMoc3R1ZGVudHN0YXR1cykubGVuZ3RoICE9PSAwKSB7ICAvLyB3ZSBoYXZlIHN0YXR1cyB1cGRhdGVzICh0YXNrcykgLSBkbyBpdCFcbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnByaW50ZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2RlbmllZCcpICAgLy90cmlnZ2VyLCB3aHlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMua2lja2VkKSB7ICAvLyBzdHVkZW50IGdvdCBraWNrZWQgYnkgdGVhY2hlclxuICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cylcbiAgICAgICAgICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyXCIpXG4gICAgICAgICAgICAgICAgbGV0IGRlbGZvbGRlciA9IHRydWVcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxuICAgICAgICAgICAgICAgICAgICBkZWxmb2xkZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyb3IpICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDYW4gbm90IGRlbGV0ZSBkaXJlY3RvcnkgLSAke2Vycm9yfSBgKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIgPT0gZmFsc2UpeyAgLy90cnkgZGVsZXRpbmcgZmlsZSBieSBmaWxlICh0aGUgb25lIHRoYXQgY2F1c2VzIHRoZSBwcm9ibGVtIHdpbGwgc3RheSBpbiB0aGUgZm9sZGVyKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7IGZzLnJtU3luYyhmaWxlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIFZlcnN1Y2hlLCBkYXMgVmVyemVpY2huaXMgcmVrdXJzaXYgenUgbFx1MDBGNnNjaGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBmcy51bmxpbmtTeW5jKGZpbGVQYXRoKTsgIH0vLyBWZXJzdWNoZSwgZGllIERhdGVpIHp1IGxcdTAwRjZzY2hlbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogKGRlbGZvbGRlcikgRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuIGRlciBEYXRlaS9WZXJ6ZWljaG5pczogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mb2N1cyA9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHJlc3RvcmluZyBmb2N1cyBzdGF0ZSBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSB0cnVlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IGZhbHNlICApe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IHRydWUgIC8vY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjayB3aWxsIGJlIHB1dCBvbiB0aGlzLnByaXZhdGVTcGVsbGNoZWNrIGluIGVkaXRvciB1cGRhdGVkIHZpYSBmZXRjaEluZm8oKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlwY01haW4uZW1pdChcInN0YXJ0TGFuZ3VhZ2VUb29sXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IGZhbHNlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBkZS1hY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IGZhbHNlIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLnN1Z2dlc3Rpb25zID0gc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5zZW5kZXhhbSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRXhhbVRvVGVhY2hlcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mZXRjaGZpbGVzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RGaWxlRnJvbVNlcnZlcihzdHVkZW50c3RhdHVzLmZpbGVzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ2V0bWF0ZXJpYWxzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGFuIG1pY3Jvc29mdDM2NSB0aGluZy4gY2hlY2sgaWYgZXhhbSBtb2RlIGlzIG9mZmljZSwgY2hlY2sgaWYgdGhpcyBpcyBzZXQgLSBvdGhlcndpc2UgZG8gbm90IGVudGVyIGV4YW1tb2RlIC0gaXQgd2lsbCBmYWlsXG4gICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgc2hhcmluZyBsaW5rIC0gaXQgd2lsbCBiZSB1c2VkIGluIFwibWljcm9zb2Z0MzY1XCIgZXhhbSBtb2RlXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBzdHVkZW50c3RhdHVzLm1zb2ZmaWNlc2hhcmUgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgZ3JvdXAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgIT09IHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gc3R1ZGVudHN0YXR1cy5ncm91cCAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgXG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gZ2xvYmFsIHN0YXR1cyB1cGRhdGVzXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBTVEFSVFxuICAgICAgICAgKiBBVFRFTlRJT046IG1vdmUgdGhpcyB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIC0gaXQgaXMgdG9vIGNvbXBsZXggYW5kIHNob3VsZCBiZSBzcGxpdCB1cFxuICAgICAgICAgKiBpbiB0aGUgZnV0dXJlIHdlIHdlbGwgZGV0ZXJtaW5lIGlmIHNlY3Rpb24gc3dpdGNoIGlzIGhhbmRsZWQgYnkgdGhlIHRlYWNoZXIgb3IgYnkgdGhlIHN0dWRlbnQgYW5kIGFjdCBhY2NvcmRpbmdseVxuICAgICAgICAgKiBpZiBoYW5kbGVkIGJ5IHN0dWRlbnQgdGhlIHRlYWNoZXIgc3R0dHVzIGlzIGlnbm9yZWQgYW5kIHRoZSBzd2ljaCBzZWN0aW9uIGZ1bmN0aW9uIGlzIGNhbGxlZCBkaXJlY3RseSAocHJvYmFibHkgbW92ZSB0byBpcGNoYW5kbGVyLmpzKVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBpZiBzdHVkZW50IGlzIGluIGxvY2tlZCBzdGF0ZSBpbiBleGFtIG1vZGVcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgXG5cbiAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIGN1cnJlbnQgYWN0aXZlIHNlY3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgc2VydmVyc3RhdHVzIC0gaWYgbm90IGNoYW5nZSB0byB0aGUgbmV3IHNlY3Rpb25cbiAgICAgICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbiAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2hhbmdpbmcgc2VjdGlvbiB0byAke3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9ufSAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lfSAsIEV4YW10eXBlOiAke3NlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlfWAgKVxuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRMb2NrZWRTZWN0aW9uID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uOyAvLyBDdXJyZW50IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIHNhdmluZylcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMb2NrZWRTZWN0aW9uID0gc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb247IC8vIE5ldyBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBsb2FkaW5nKVxuICAgICAgICAgICAgICAgIGNvbnN0IGV4YW1EaXIgPSB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5O1xuXG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgYWxsIGZpbGVzIGZyb20gdGhlIG9sZCBzZWN0aW9uIChpZiBleGFtIG1vZGUgaXMgXCJlZGl0b3JcIikgYW5kIHNlbmQgdG8gdGVhY2hlciAtIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPT09IFwiZWRpdG9yXCIpe1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHNlbmRpbmcgZXhhbSB0byB0ZWFjaGVyIChmaW5hbCBzdWJtaXQpXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCBjdXJyZW50IHdvcmsgYXMgYmFzZTY0IHRvIHRlYWNoZXIgKHN0b3JlcyBwZGYgaW4gQUJHQUJFIGZvbGRlciB3aXRoIHN1Ym1pc3Npb24gbnVtYmVyKVxuICAgICAgICAgICAgICAgICAgICBsZXQgcGRmID0gYXdhaXQgdGhpcy5nZXRCYXNlNjRQREYodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2N1cnJlbnRMb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZSkgIC8vIGxvY2FsIGZ1bmN0aW9uIHRvIGdldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChwZGYuc3RhdHVzID09PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRCYXNlNjRQREZ0b1RlYWNoZXIocGRmLmJhc2U2NHBkZiwgY3VycmVudExvY2tlZFNlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kVG9UZWFjaGVyKCkgLy9iYWNrdXAgbG9jYWwgZmlsZXMgYW5kIHNlbmQgdG8gdGVhY2hlciAoYXJjaGl2ZSB3aXRoIHRpbWVzdGFtcClcblxuXG4gICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAvL3dhaXQgMSBzZWNvbmQgYW5kIGNsZWFudXAgTkVYVC1FWEFNLVNUVURFTlQtV09SS0RJUlxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMClcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBleGFtdHlwZSBpbiBjbGllbnRpbmZvXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NrZWQgc2VjdGlvbiBBRlRFUiBzYXZpbmcgdGhlIG9sZCBzdGF0ZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IG5ld0xvY2tlZFNlY3Rpb247XG5cblxuXG4gICAgICAgICAgICAgICAgLy8gTU9WRSBTZWN0aW9uIEZpbGVzIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAxOiBTQVZFIENVUlJFTlQgRVhBTURJUiBGSUxFUyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGV4YW1EaXIpICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkgeyAvLyBDaGVjayBpZiBtYWluIGRpciBleGlzdHMgYW5kIGEgc2VjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2aW5nIGNvbnRlbnQgZnJvbSBleGFtRGlyIHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVQYXRoID0gYCR7ZXhhbURpcn0vJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNhdmVQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhzYXZlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IC8vIENyZWF0ZSBzYXZlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGV4YW1EaXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEZvdW5kICR7ZmlsZXMubGVuZ3RofSBpdGVtcyBpbiBleGFtRGlyIHRvIHNhdmVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzU2F2ZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhvbGRQYXRoKTsgLy8gR2V0IGZpbGUgc3RhdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgYWN0dWFsIEZJTEVTLCBub3QgZGlyZWN0b3JpZXMgKGxpa2UgdGhlIHNlY3Rpb24gZm9sZGVycyB0aGVtc2VsdmVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtzYXZlUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhvbGRQYXRoLCBuZXdQYXRoKTsgLy8gQ29weSBmaWxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkUGF0aCk7IC8vIERlbGV0ZSBvcmlnaW5hbCBmaWxlIGZyb20gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc1NhdmVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTYXZlZCBmaWxlICR7ZmlsZX0gdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTa2lwcGluZyBub24tZmlsZSAoZm9sZGVyKSBpdGVtICR7ZmlsZX0gaW4gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTdWNjZXNzZnVsbHkgc2F2ZWQgJHtmaWxlc1NhdmVkfSBmaWxlcyB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgc2F2ZSAtIGV4YW1EaXIgZXhpc3RzOiAke2ZzLmV4aXN0c1N5bmMoZXhhbURpcil9LCBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBQQVJUIDI6IExPQUQgRklMRVMgZnJvbSB0aGUgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBORVcgbG9ja2VkIHNlY3Rpb24gdG8gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIG5ld0xvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBMb2FkaW5nIGNvbnRlbnQgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9hZFBhdGggPSBgJHtleGFtRGlyfS8ke25ld0xvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvYWRQYXRoKSkgeyAvLyBDaGVjayBpZiB0aGUgbmV3IHNlY3Rpb24gZm9sZGVyIGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0gZnMucmVhZGRpclN5bmMobG9hZFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzVG9Mb2FkLmxlbmd0aH0gaXRlbXMgaW4gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IGRpcmVjdG9yeWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc0NvcGllZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzVG9Mb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZVBhdGggPSBgJHtsb2FkUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gYCR7ZXhhbURpcn0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7IC8vIEVuc3VyZSBvbmx5IGZpbGVzIGFyZSBjb3BpZWQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuY29weUZpbGVTeW5jKHNvdXJjZVBhdGgsIGRlc3RQYXRoKTsgLy8gQ29weSBmaWxlIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29waWVkKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ29waWVkIGZpbGUgJHtmaWxlfSBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgaXRlbSAke2ZpbGV9IGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IGNvcGllZCAke2ZpbGVzQ29waWVkfSBmaWxlcyBmcm9tIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSB0byBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTmV3IGxvY2tlZCBzZWN0aW9uIGRpcmVjdG9yeSAke25ld0xvY2tlZFNlY3Rpb259IGRvZXMgbm90IGV4aXN0LiBTdGFydGluZyB3aXRoIGEgY2xlYW4gc3RhdGUuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogbmV3TG9ja2VkU2VjdGlvbiBpcyBmYWxzeSAoJHtuZXdMb2NrZWRTZWN0aW9ufSksIHNraXBwaW5nIGZpbGUgbG9hZGApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBFcnJvciBkdXJpbmcgZm9sZGVyIG9wZXJhdGlvbiAtICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3Igc3RhY2s6ICR7ZXJyb3Iuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259LCBuZXdMb2NrZWRTZWN0aW9uOiAke25ld0xvY2tlZFNlY3Rpb259LCBleGFtRGlyOiAke2V4YW1EaXJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgICAgICogIEFjdHVhbGx5IFNXSVRDSCBFWEFNIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IG9yIHJlbGVhZCB0aGUgbmV3IGV4YW0gc2VjdGlvbiBpbiB0aGUgc2FtZSB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3cgLSBpZiB5b3UgZG9uJ3QgbmV4dC1leGFtIHdpbGwgY3Jhc2ggc2lsZW50bHkgb24gcmVsb2FkIGFuZCBzZWN0aW9uIHN3aXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpLmZvckVhY2god2MgPT4geyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzd2l0Y2hFeGFtU2VjdGlvbjogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdjLmNsb3NlRGV2VG9vbHMoKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEVCBkZXMgV2ViVmlld3Mgc2NobGllXHUwMERGZW4gKGF1Y2ggZGV0YWNoZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgYW5kIHJlb3BlbiBpdCB3aXRoIHRoZSBuZXcgZXhhbSBzZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cub25jZSgnY2xvc2VkJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBFTkRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgIFxuXG5cbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2spIHsgIHRoaXMuYWN0aXZhdGVTY3JlZW5sb2NrKCkgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgKSB7IHRoaXMua2lsbFNjcmVlbmxvY2soKSB9XG5cbiAgICAgICAgLy8gc2NyZWVuc2hvdCBzYWZldHkgKE9DUiBzZWFyY2hlcyBmb3IgbmV4dC1leGFtIHN0cmluZylcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyKSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IHRydWUgIH1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IGZhbHNlICAgfVxuXG4gICAgICAgIC8vIEdyb3VwcyBoYW5kbGluZ1xuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZ3JvdXBzKXsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSB0cnVlfVxuICAgICAgICBlbHNlIHsgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSBmYWxzZX1cblxuICAgICAgICAvL3VwZGF0ZSBzY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgfHwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PT0gMCkgeyAvLzAgaXMgdGhlIHNhbWUgYXMgZmFsc2Ugb3IgdW5kZWZpbmVkIGJ1dCBzaG91bGQgYmUgdHJlYXRlZCBhcyBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsICE9PSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDAgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgY2hhbmdlZCB0b1wiLCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDApXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPSBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsKjEwMDBcbiAgICAgICAgICAgICAgICAgIGlmICggc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGRpc2FibGVkIVwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBvbGQgaW50ZXJ2YWwgYW5kIHN0YXJ0IG5ldyBpbnRlcnZhbCBpZiBzZXQgdG8gc29tZXRoaW5nIGJpZ2dlciB0aGFuIHplcm9cbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID4gMCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5pbnRlcnZhbCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAvLyByZW1vdmUgbG9ja3NjcmVlbiBpbW1lZGlhdGVseSAtIGRvbid0IHdhaXQgZm9yIHNlcnZlciBpbmZvXG4gICAgICAgICAgICB0aGlzLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSBcbiAgICAgICAgICAgIHRoaXMuZW5kRXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIHNlbmQgYmFzZTY0IHBkZiB0byB0ZWFjaGVyXG4gICAgc2VuZEJhc2U2NFBERnRvVGVhY2hlcihiYXNlNjRwZGYsIHNlY3Rpb249MSl7XG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wcmludHJlcXVlc3QvJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbn1gO1xuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGJhc2U2NHBkZixcbiAgICAgICAgICAgIHByaW50cmVxdWVzdDogZmFsc2UsICAgIFxuICAgICAgICAgICAgc3VibWlzc2lvbm51bWJlcjogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyLFxuICAgICAgICAgICAgbG9ja2Vkc2VjdGlvbjogc2VjdGlvblxuICAgICAgICB9XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHsgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTsgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZSA9PSBcInN1Y2Nlc3NcIil7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyKysgICAvLyBzdWNjZXNzZnVsIHN1Ym1pc3Npb24gLT4gaW5jcmVtZW50IG51bWJlclxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4geyAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImVkaXRvciBAIHByaW50YmFzZTY0OlwiLGVycm9yLm1lc3NhZ2UpICAgIFxuICAgICAgICB9KTsgXG4gICAgfVxuICAgIFxuXG5cblxuICAgIC8vZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAvLyBBVFRFTlRJT046IHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gaXBjaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCBzdG9yZXMgaXQgYXMgZmlsZSBpbiB0aGUgZXhhbSBkaXJlY3RvcnlcbiAgICBhc3luYyBnZXRCYXNlNjRQREYoc3VibWlzc2lvbm51bWJlciwgc2VjdGlvbm5hbWUsIHByaW50QmFja2dyb3VuZD1mYWxzZSl7XG4gICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IGdldHRpbmcgYmFzZTY0IGVuY29kZWQgcGRmXCIpXG4gICAgICAgIFxuICAgICAgICAvLyBXYWl0IGZvciBhbnkgb25nb2luZyBwcmludCBvcGVyYXRpb24gdG8gZmluaXNoIChtYXggMzAgc2Vjb25kcylcbiAgICAgICAgbGV0IHdhaXRDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFdhaXQgPSAzMDA7IC8vIDMwIHNlY29uZHMgd2l0aCAxMDBtcyBpbnRlcnZhbHNcbiAgICAgICAgd2hpbGUgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiAmJiB3YWl0Q291bnQgPCBtYXhXYWl0KSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMCk7XG4gICAgICAgICAgICB3YWl0Q291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKElwY0hhbmRsZXIuaXNQcmludGluZ1BkZikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IHByaW50VG9QREYgbG9jayB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgc3RpbGwgcnVubmluZ1wiKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJQREYgZ2VuZXJhdGlvbiB0aW1lb3V0IC0gYW5vdGhlciBwcmludCBvcGVyYXRpb24gaXMgaW4gcHJvZ3Jlc3NcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgIHByaW50QmFja2dyb3VuZDogcHJpbnRCYWNrZ3JvdW5kLFxuICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgIGxhbmRzY2FwZTogZmFsc2UsXG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG5cbiAgXG4gICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgaGVhZGVyVGVtcGxhdGU6IGA8ZGl2IHN0eWxlPSdkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGhlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tbGVmdDogMzBweDsgbWFyZ2luLXRvcDoxMHB4Oyc+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiR7c2VjdGlvbm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDtBYmdhYmU6ICR7c3VibWlzc2lvbm51bWJlcn08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgIHByZWZlckNTU1BhZ2VTaXplOiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0gLSBWZXJzaW9uICR7c3VibWlzc2lvbm51bWJlcn1cImApO1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0IGxvY2sgYmVmb3JlIHN0YXJ0aW5nIFBERiBnZW5lcmF0aW9uXG4gICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgYmFzZTY0cGRmID0gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6YXBwbGljYXRpb24vcGRmO2Jhc2U2NCwke2Jhc2U2NHBkZn1gO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOlwiUERGIGdlbmVyYXRlZFwiLCBkYXRhVXJsOmRhdGFVcmwsIGJhc2U2NHBkZjogYmFzZTY0cGRmLCBzdGF0dXM6IFwic3VjY2Vzc1wiIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogRXJyb3IgZ2VuZXJhdGluZyBQREY6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcnJvciBnZW5lcmF0aW5nIFBERlwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gQWx3YXlzIHJlbGVhc2UgdGhlIGxvY2ssIGV2ZW4gaWYgYW4gZXJyb3Igb2NjdXJyZWRcbiAgICAgICAgICAgIElwY0hhbmRsZXIuaXNQcmludGluZ1BkZiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2hvdyB0ZW1wb3Jhcnkgc2NyZWVubG9jayB3aW5kb3dcbiAgICBhY3RpdmF0ZVNjcmVlbmxvY2soKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuICAgICAgIFxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPT0gMCl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gdHJ1ZVxuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpICAvLyBhZGQgc2NyZWVubG9jayB3aW5kb3dzIGZvciBhZGRpdGlvbmFsIGRpc3BsYXlzXG4gICAgICAgICAgICB9IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIHRlbXBvcmFyeSBzY3JlZW5sb2Nrd2luZG93XG4gICAga2lsbFNjcmVlbmxvY2soKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbmxvY2t3aW5kb3cgJiYgIXNjcmVlbmxvY2t3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7IFxuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBraWxsU2NyZWVubG9jazogbm8gZnVuY3Rpb25hbCBzY3JlZW5sb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICB9IFxuICAgICAgICAvLyBDbGVhciBhcnJheSBjb21wbGV0ZWx5IGFmdGVyIGF0dGVtcHRpbmcgdG8gZGVzdHJveSBhbGwgd2luZG93c1xuICAgICAgICAvLyBUaGUgY2xvc2VkIGV2ZW50IGhhbmRsZXIgd2lsbCBhbHNvIGNsZWFuIHVwLCBidXQgdGhpcyBlbnN1cmVzIHRoZSBhcnJheSBpcyBlbXB0eVxuICAgICAgICBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrID0gZmFsc2VcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0cyBleGFtIG1vZGUgZm9yIHN0dWRlbnRcbiAgICAgKiBkZWxldGVzIHdvcmtmb2xkZXIgY29udGVudHMgKGlmIHNldClcbiAgICAgKiBvcGVucyBhIG5ldyB3aW5kb3cgaW4ga2lvc2sgbW9kZSB3aXRoIHRoZSBnaXZlbiBleGFtdHlwZVxuICAgICAqIGVuYWJsZXMgdGhlIGJsdXIgbGlzdGVuZXIgYW5kIGFjdGl2YXRlcyByZXN0cmljdGlvbnMgKGRpc2FibGUga2V5Ym9hcnNob3J0Y3V0cyBldGMuKVxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgZXhhbW1vZGUsIGV4YW10eXBlLCBhbmQgb3RoZXIgc2V0dGluZ3MgZnJvbSB0aGUgdGVhY2hlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpe1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgZGlhbG9nIGlzIG9wZW4gYW5kIGxvZyB3YXJuaW5nXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4aXRXYXJuaW5nT3BlbiB8fCBXaW5kb3dIYW5kbGVyLmV4aXRRdWVzdGlvbk9wZW4gfHwgV2luZG93SGFuZGxlci5taW5pbWl6ZVdhcm5pbmdPcGVuKSB7XG4gICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBEaWFsb2cgaXMgc3RpbGwgb3BlbiAtIGV4YW0gd2lsbCBzdGFydCBhbnl3YXlcIilcbiAgICAgICAgfVxuICBcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgbGV0IHByaW1hcnkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgIFxuICAgICAgICBpZiAoIXByaW1hcnkgfHwgcHJpbWFyeSA9PT0gXCJcIiB8fCAhcHJpbWFyeS5pZCl7IHByaW1hcnkgPSBkaXNwbGF5c1swXSB9ICAgICAgIFxuXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uY21hcmdpbiA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmNtYXJnaW4gIC8vIHRoaXMgaXMgdXNlZCB0byBjb25maWd1cmUgbWFyZ2luIHNldHRpbmdzIGZvciB0aGUgZWRpdG9yXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubGluZXNwYWNpbmcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5saW5lc3BhY2luZyAvLyB3ZSB0cnkgdG8gZG91YmxlIGxpbmVzcGFjaW5nIG9uIGRlbWFuZCBpbiBwZGYgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5hdWRpb1JlcGVhdCA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmF1ZGlvUmVwZWF0IC8vIHJlc3RyaWN0IHJlcGV0aXRpb24gb2YgYXVkaW8gZmlsZXMgKGZvciBsaXN0ZW5pbmcgY29tcHJlaGVuc2lvbilcblxuICAgICAgICBpZiAoIVdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvLyB3aHkgZG8gd2UgY2hlY2s/IGJlY2F1c2UgZXhhbW1vZGUgaXMgbGVmdCBpZiB0aGUgc2VydmVyIGNvbm5lY3Rpb24gZ2V0cyBsb3N0IGJ1dCBzdHVkZW50cyBjb3VsZCByZWNvbm5lY3Qgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIHN0aWxsIG9wZW4gYW5kIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgc2Vjb25kIG9uZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogY3JlYXRpbmcgZXhhbSB3aW5kb3dcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5jcmVhdGVFeGFtV2luZG93KHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3JlY29ubmVjdCBpbnRvIGFjdGl2ZSBleGFtIHNlc3Npb24gd2l0aCBleGFtIHdpbmRvdyBhbHJlYWR5IG9wZW5cbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBmb3VuZCBleGlzdGluZyBFeGFtd2luZG93Li5cIilcbiAgICAgICAgICAgIHRyeSB7ICAvLyBzd2l0Y2ggZXhpc3Rpbmcgd2luZG93IGJhY2sgdG8gZXhhbSBtb2RlXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKSBcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0RnVsbFNjcmVlbih0cnVlKSAgLy9nbyBmdWxsc2NyZWVuIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSAgLy9tYWtlIHN1cmUgdGhlIHdpbmRvdyBpcyAxIGxldmVsIGFib3ZlIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMjAwMCkgLy8gd2FpdCBhbiBhZGRpdGlvbmFsIDIgc2VjIGZvciB3aW5kb3dzIHJlc3RyaWN0aW9ucyB0byBraWNrIGluICh0aGV5IHN0ZWFsIGZvY3VzKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmFkZEJsdXJMaXN0ZW5lcigpO1xuICAgICAgICAgICAgICAgICAgICAvLyBGb3IgcmVjb25uZWN0OiBpbml0aWFsaXplIGJsb2NrIHdpbmRvd3MgYWZ0ZXIgd2luZG93IGlzIHJlcG9zaXRpb25lZFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IC8vZXhhbXdpbmRvdyB2YXJpYWJsZSBpcyBzdGlsbCBzZXQgYnV0IHRoZSB3aW5kb3cgaXMgbm90IG1hbmFnYWJsZSBhbnltb3JlIChtYW51YWxseSBjbG9zZWQgaW4gZGV2IG1vZGU/KVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBubyBmdW5jdGlvbmFsIGV4YW13aW5kb3cgZm91bmQuLiByZXNldHRpbmdcIilcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgIC8vZXhhbXdpbmRvdyBpcyBnaXZlbiBidXQgbm90IHVzZWQgaW4gZGlzYWJsZVJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gIC8vIGluIHRoYXQgY2FzZS4uIHdlIGFyZSBmaW5pc2hlZCBoZXJlICFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBOb3RlOiBGb3IgbmV3IGV4YW0gd2luZG93cywgaW5pdEJsb2NrV2luZG93cygpIGlzIGNhbGxlZCBpbiBkaWQtZmluaXNoLWxvYWQgaGFuZGxlclxuICAgICAgICAvLyB0byBlbnN1cmUgd2luZG93IGlzIGZ1bGx5IHBvc2l0aW9uZWQgKGltcG9ydGFudCBmb3IgV2F5bGFuZC9LV2luKVxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgRXhhbSBtb2RlXG4gICAgICogY2xvc2VzIGV4YW0gd2luZG93XG4gICAgICogZGlzYWJsZXMgcmVzdHJpY3Rpb25zIGFuZCBibHVyIFxuICAgICAqL1xuICAgIGFzeW5jIGVuZEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgXG4gICAgICAgIFdpbmRvd0hhbmRsZXIucmVtb3ZlQmx1ckxpc3RlbmVyKCk7XG4gICAgICBcbiAgICAgICAgLy9vbmx5IGRpc2FibGUgcmVzdHJpY3Rpb25zIGlmIG5vdCBpbiBleGFtIG1vZGUgKCBzZXJpb3N1bHkuLiBob3cgY291bGQgdGhpcyBldmVyIGhhcHBlbj8gKVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnMoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIHN0dWRlbnRzIHdvcmsgb24gc3R1ZGVudHMgcGMgKG1ha2VzIHNlbnNlIGlmIGV4YW0gaXMgd3JpdHRlbiBvbiBzY2hvb2wgcHJvcGVydHkpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMgJiYgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyIG9uIGV4aXRcIilcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogXCIsZXJyb3IpOyB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAvLyBpbiBzb21lIGVkZ2UgY2FzZXMgaW4gZGV2ZWxvcG1lbnQgdGhpcyBpcyBzZXQgYnV0IHN0aWxsIHVudXNhYmxlIC0gdXNlIHRyeS9jYXRjaCAgIFxuICAgICAgICAgICAgdHJ5IHsgXG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBkZXZ0b29scyB3aW5kb3dcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgdGhpcy5jb25maWcuc2hvd2RldnRvb2xzKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsV2ViQ29udGVudHMgPSB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxsZSBXZWJWaWV3cyBkZXMgQ2hpbGRzXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgd2Mgb2YgYWxsV2ViQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgd2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogZGVzdHJveWluZyBkZXZ0b29scyB3aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFdhaXQgZm9yIGFsbCBEZXZUb29scyB0byBiZSBjbG9zZWQgYmVmb3JlIGNsb3NpbmcgdGhlIGV4YW0gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIGFsbCBjbG9zZURldlRvb2xzKCkgY2FsbHMgYXJlIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhbHdheXMgdHJ5IHRvIGNsb3NlIHRoZSBleGFtIHdpbmRvdyBzYWZlbHkgYWZ0ZXIgZGV2dG9vbHMgaGFuZGxpbmdcbiAgICAgICAgICAgICAgICB0aGlzLmNsb3NlRXhhbVdpbmRvd1NhZmVseSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlKXsgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06ICcsZSl9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBibG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgICAgIGJsb2Nrd2luZG93LmNsb3NlKCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmJsb2Nrd2luZG93cyA9IFtdXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiBubyBmdW5jdGlvbmFsIGJsb2Nrd2luZG93IHRvIGhhbmRsZVwiKVxuICAgICAgICAgICAgfSAgXG4gICAgICAgIH1cbiAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICBcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGxhbmd1YWdlVG9vbFNlcnZlci5sYW5ndWFnZVRvb2xQcm9jZXNzKXtcbiAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdG9wU2VydmVyKCk7IC8vIEtpbGwgTGFuZ3VhZ2VUb29sIHNlcnZlciB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICB9XG4gICAgICAgIC8vIGFzayBzdHVkZW50IHRvIHF1aXQgYXBwIGFmdGVyIGZpbmlzaGluZyBleGFtXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuc2hvd0V4aXRRdWVzdGlvbigpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvc2VzIGV4YW13aW5kb3cgb25seSB3aGVuIG5vIHByaW50VG9QREYgb3BlcmF0aW9uIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBjbG9zZUV4YW1XaW5kb3dTYWZlbHkoKXtcbiAgICAgICAgY29uc3QgZXhhbVdpbiA9IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICBpZiAoIWV4YW1XaW4peyByZXR1cm4gfVxuXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGNsb3NlRXhhbVdpbmRvd1NhZmVseTogcHJpbnRUb1BERiBpbiBwcm9ncmVzcyAtIHJldHJ5IGluIDFzXCIpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKSB9LCAxMDAwKSAvLyByZXRyeSB1bnRpbCBwcmludGluZyBpcyBmaW5pc2hlZFxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFleGFtV2luLmlzRGVzdHJveWVkPy4oKSl7XG4gICAgICAgICAgICAgICAgZXhhbVdpbi5jbG9zZSgpIC8vIG5vcm1hbCBjbG9zZSwgb24oJ2Nsb3NlJykgaGFuZGxlciBkb2VzIHRoZSByZXN0XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IGVycm9yIHdoaWxlIGNsb3NpbmcgZXhhbXdpbmRvd1wiLCBlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIG1hbnVhbGx5IHRyaWdnZXJlZCBpZiBjb25uZWN0aW9uIGlzIGxvc3QgZHVyaW5nIGV4YW0gLSB3ZSBhbGxvdyB0aGUgc3R1ZGVudCB0byBnZXQgb3V0IG9mIHRoZSBraW9zayBtb2RlIFxuICAgIC8vIElORk86IHRoaXMgaXMgYmFzaWNhbGx5IHJlZHVuZGFudCBcbiAgICBhc3luYyBncmFjZWZ1bGx5RW5kRXhhbSgpe1xuICAgICAgICB0aGlzLmVuZEV4YW0oKVxuICAgIH1cblxuICAgIC8vIHJlc2V0IGFsbCB2YXJpYWJsZXMgdGhhdCBzaWduYWwgb3IgbmVlZCBhIHZhbGlkIHRlYWNoZXIgY29ubmVjdGlvblxuICAgIHJlc2V0Q29ubmVjdGlvbigpe1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gd2UgYXJlIGZvY3VzZWQgXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlICAgLy8gZG8gbm90IHNldCB0byBmYWxzZSB1bnRpbCBleGFtIHdpbmRvdyBpcyBhY3R1YWxseSBjbG9zZWQgICh0aGlzIGlzIGRvbmUgaW4gZW5kRXhhbSgpKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRpbWVzdGFtcCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlXG4gICAgICAgIC8vdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IGZhbHNlICAvLyB0aGlzIGNoZWNrIGhhcHBlbnMgb25seSBhdCB0aGUgYXBwbGljYXRpb24gc3RhcnQuLiBkbyBub3QgcmVzZXQgb25jZSBzZXRcbiAgICB9XG4gXG5cblxuXG4gICAgLyoqXG4gICAgICogZGllc2UgbWV0aG9kZSBob2x0IHNpY2gsIGRpZSB2b20gdGVhY2hlciB6dW0gZG93bmxvYWQgYmVyZWl0Z2VsZWd0ZW4gZGF0ZWllblxuICAgICAqIFx1MDBGQ2JlciBkYXMgdXBkYXRlIGludGVydmFsIHdpcmQgZGVyIHRyaWdnZXIgenVtIGRvd25sb2FkIHVuZCBkaWUgZmlsZWxpc3QgZXJoYWx0ZW5cbiAgICAgKiBAcGFyYW0geyp9IGZpbGVzIFxuICAgICAqL1xuICAgIHJlcXVlc3RGaWxlRnJvbVNlcnZlcihmaWxlcyl7XG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgYmFja3VwZmlsZSA9IGZhbHNlXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKGZpbGUubmFtZSAmJiBmaWxlLm5hbWUuaW5jbHVkZXMoJ2JhaycpKXsgICAvLyB0aGlzIHdpbGwgYWx3YXlzIHNldCB0aGUgbGFzdCBiYWsgZmlsZSBhcyBiYWNrdXAgZmlsZSBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGJhayBmaWxlXG4gICAgICAgICAgICAgICAgYmFja3VwZmlsZSA9IGZpbGUubmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuXG4gICAgICAgIC8vIERhdGVuIGZcdTAwRkNyIGRlbiBQT1NULVJlcXVlc3Qgdm9yYmVyZWl0ZW5cbiAgICAgICAgbGV0IGRhdGEgPSBKU09OLnN0cmluZ2lmeSh7ICdmaWxlcyc6IGZpbGVzLCAndHlwZSc6ICdzdHVkZW50ZmlsZXJlcXVlc3QnIH0pO1xuXG4gICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2Rvd25sb2FkLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogZGF0YSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgbGV0IGFic29sdXRlRmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHRva2VuLmNvbmNhdCgnLnppcCcpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZShhYnNvbHV0ZUZpbGVwYXRoLCBCdWZmZXIuZnJvbShidWZmZXIpLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgeyBsb2cuZXJyb3IoZXJyKTsgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3QoYWJzb2x1dGVGaWxlcGF0aCwgeyBkaXI6IHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkgfSkgXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiQ29tbXVuaWNhdGlvbkhhbmRsZXIgQCByZXF1ZXN0RmlsZUZyb21TZXJ2ZXI6IGZpbGVzIHJlY2VpdmVkIGFuZCBleHRyYWN0ZWRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnMucHJvbWlzZXMudW5saW5rKGFic29sdXRlRmlsZXBhdGgpOyAvLyBWZXJ3ZW5kdW5nIGRlciBQcm9taXNlLWJhc2llcnRlbiBBUEkgdm9uIGZzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWNrdXBmaWxlICYmIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdiYWNrdXAnLCBiYWNrdXBmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBUcmlnZ2VyIFJlcGxhY2UgRXZlbnRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7ICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbG9hZGZpbGVsaXN0Jyk7ICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYENvbW11bmljYXRpb25IYW5kbGVyIC0gcmVxdWVzdEZpbGVGcm9tU2VydmVyOiAke2Vycn1gKSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgc2VuZEV4YW1Ub1RlYWNoZXIoKXtcbiAgICAgICAgLy9zZW5kIHNhdmUgdHJpZ2dlciB0byBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vdGhlcmUgaXMgYSBydW5uaW5nIGV4YW0gLSBzYXZlIGN1cnJlbnQgd29yayBmaXJzdCFcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ3NhdmUnLCd0ZWFjaGVycmVxdWVzdCcpICAgLy90cmlnZ2VyLCB3aHkgICh0ZWFjaGVycmVxdWVzdCB3aWxsIGFsc28gdHJpZ2dlciBzZW5kVG9UZWFjaGVyKCkgYnV0IG9ubHkgYWZ0ZXIgc2F2aW5nIHRoZSBwZGYgaXMgY29tcGxldGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpeyBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYENvbW11bmljYXRpb24gaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiBDb3VsZCBub3Qgc2F2ZSBzdHVkZW50cyB3b3JrLiBJcyBleGFtbW9kZSBhY3RpdmU/YClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgIC8vIG5vdCBydW5uaW5nIGV4YW0gKHByb2JhYmx5IHVzaW5nIG5leHQtZXhhbSBhcyBjbGFzc3Jvb21tYW5hZ21lbnQgdG9vbClcbiAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpICAgLy96aXAgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXIgYXBpXG4gICAgICAgIH1cblxuICAgICB9XG5cblxuICAgICAgLy96aXAgY29uZmlnLndvcmsgZGlyZWN0b3J5IGFuZCBzZW5kIHRvIHRlYWNoZXJcbiAgICAgYXN5bmMgc2VuZFRvVGVhY2hlcigpe1xuICAgICAgICB0cnkgeyBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmModGhpcy5jb25maWcudGVtcGRpcmVjdG9yeSk7IH1cbiAgICAgICAgfWNhdGNoIChlKXsgbG9nLmVycm9yKGUpfVxuXG4gICAgICAgIC8vICB0aGlzIGlzIHRoZSBsb2dmaWxlIHBhdGggdHJ5IHRvIGNvcHkgdGhlIGxvZ2ZpbGUgdG8gdGhlIGV4YW1kaXJlY3RvcnkgYmVmb3JlIG1ha2luZyB0aGUgemlwIGZpbGVcbiAgICAgICAgbGV0IGxvZ2ZpbGVwYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGU7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvZ2ZpbGVwYXRoKSl7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhsb2dmaWxlcGF0aCwgam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJykpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kVG9UZWFjaGVyOiBjb3VsZCBub3QgY29weSBsb2dmaWxlIHRvIGV4YW1kaXJlY3RvcnknKTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHppcGZpbGVuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lLmNvbmNhdCgnLnppcCcpXG4gICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgIGxldCBzZXJ2ZXJpcCA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlblxuICAgICAgICBsZXQgemlwZmlsZXBhdGggPSBqb2luKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnksIHppcGZpbGVuYW1lKTtcbiAgICAgXG5cbiAgICAgICAgbGV0IGJhc2U2NEZpbGUgPSBudWxsXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnppcERpcmVjdG9yeSh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB6aXBmaWxlcGF0aClcbiAgICAgICAgICAgIGNvbnN0IGZpbGVDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHppcGZpbGVwYXRoKTtcbiAgICAgICAgICAgIGJhc2U2NEZpbGUgPSBmaWxlQ29udGVudC50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgIH1jYXRjaCAoZSl7ICBsb2cuZXJyb3IoZSkgIH1cblxuICAgICAgICAvLyBzZW5kaW5nIHRoZSB3aG9sZSBkaXJlY3RvcnkgYXMgemlwIGZpbGUgYmFzZTY0ZW5jb2RlZCB2aWEgSlNPTiBpc24ndCBwcm9iYWJseSB0aGUgYmVzdCBtZXRob2QgYnV0IGl0IHdvcmtzIHdoaWxlIGFsbCBmb3JtRGF0YSBhcHByb2FjaGVzIGZhaWxlZCB3aXRoXG4gICAgICAgIC8vIGZldGNoKCkgd2hpbGUgdGhleSB3b3JrZWQgd2l0aCBheCBpb3MoKSAtIG5vdCBldmVuIGNoYXRncHQgb3Igc3RhY2tvdmVyZmxvdyBjb3VsZCBoZWxwIF5eIGkgdGhpbmsgaXQgaXMgcmVsYXRlZCB0byB0aGUgc3BlY2lmaWMgZm9ybURhdGEgbW9kdWxlIHRoYXQgY2FudCBiZSBpbXBvcnRlZCB3aXRob3V0IFwid2luZG93IGVycm9yXCJcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9yZWNlaXZlLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gO1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGZpbGU6IGJhc2U2NEZpbGUsIGZpbGVuYW1lOiB6aXBmaWxlbmFtZSB9KSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKVxuICAgICAgICAudGhlbihkYXRhID0+IHsgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6IHRlYWNoZXIgcmVzcG9uc2U6ICR7ZGF0YS5tZXNzYWdlfWApOyB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge2xvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogJHtlcnJvcn1gKTsgfSk7XG4gICAgIH1cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc291cmNlRGlyOiAvc29tZS9mb2xkZXIvdG8vY29tcHJlc3NcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gb3V0UGF0aDogL3BhdGgvdG8vY3JlYXRlZC56aXBcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB6aXBEaXJlY3Rvcnkoc291cmNlRGlyLCBvdXRQYXRoKSB7XG4gICAgICAgIGNvbnN0IGFyY2hpdmUgPSBhcmNoaXZlcignemlwJywgeyB6bGliOiB7IGxldmVsOiA5IH19KTtcbiAgICAgICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0UGF0aCk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGFyY2hpdmVcbiAgICAgICAgICAgIC5kaXJlY3Rvcnkoc291cmNlRGlyLCBmYWxzZSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXG4gICAgICAgICAgICAucGlwZShzdHJlYW0pXG4gICAgICAgIDtcbiAgICAgICAgc3RyZWFtLm9uKCdjbG9zZScsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICAgIGFyY2hpdmUuZmluYWxpemUoKTtcbiAgICAgICAgfSkuY2F0Y2goIGVycm9yID0+IHsgbG9nLmVycm9yKGVycm9yKX0pO1xuICAgIH1cblxuXG5cblxuXG5cbiAgICAvLyB0aW1lb3V0IFxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICBcbiB9XG4gXG4gZXhwb3J0IGRlZmF1bHQgbmV3IENvbW1IYW5kbGVyKClcbiBcbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgaXAgZnJvbSAnaXAnXG5pbXBvcnQgbmV0IGZyb20gJ25ldCdcbmltcG9ydCBpMThuIGZyb20gJy4uLy4uLy4uL3NyYy9sb2NhbGVzL2xvY2FsZXMuanMnXG5jb25zdCB7dH0gPSBpMThuLmdsb2JhbFxuaW1wb3J0e2lwY01haW4sIGNsaXBib2FyZCxhcHAsIHdlYkNvbnRlbnRzfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IG1hbW1vdGggZnJvbSAnbWFtbW90aCc7XG5cbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXInO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyB1cGRhdGVTeXN0ZW1UcmF5IH0gZnJvbSAnLi90cmF5bWVudS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOZXR3b3JrT3JSZXNldCB9IGZyb20gJy4vdGVzdHBlcm1pc3Npb25zTWFjLmpzJztcbmltcG9ydCB7IGdldFdsYW5JbmZvIH0gZnJvbSAnLi9nZXR3bGFuaW5mby5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbnN0IGNoZWNrUG9ydE9wZW4gPSAocG9ydCwgaG9zdCA9ICcxMjcuMC4wLjEnLCB0aW1lb3V0ID0gMTUwMCkgPT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgbmV0LlNvY2tldCgpO1xuICAgICAgICBjb25zdCBmaW5pc2ggPSAocnVubmluZywgZXJyb3IgPSBudWxsKSA9PiB7XG4gICAgICAgICAgICBzb2NrZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSh7IHJ1bm5pbmcsIHBvcnQsIGhvc3QsIGVycm9yIH0pO1xuICAgICAgICB9O1xuICAgICAgICBzb2NrZXQuc2V0VGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Nvbm5lY3QnLCAoKSA9PiBmaW5pc2godHJ1ZSkpO1xuICAgICAgICBzb2NrZXQub25jZSgndGltZW91dCcsICgpID0+IGZpbmlzaChmYWxzZSwgJ3RpbWVvdXQnKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdlcnJvcicsIChlcnIpID0+IGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KHBvcnQsIGhvc3QpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZpbmlzaChmYWxzZSwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gLy8gSVBDIGhhbmRsaW5nIChCYWNrZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuY2xhc3MgSXBjSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gZmFsc2UgLy8gZmxhZyB0byBwcmV2ZW50IGNsb3Npbmcgd2luZG93IHdoaWxlIHByaW50aW5nXG4gICAgfVxuICAgIGluaXQgKG1jLCBjb25maWcsIHdoLCBjaCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IHdoICBcbiAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlciA9IGNoXG4gICAgICAgIFxuXG4gICAgICAgIGlwY01haW4ub24oJ3NldC1uZXctbG9jYWxlJywgKGV2ZW50LCBsb2NhbGUpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc2V0LW5ldy1sb2NhbGU6IHNldHRpbmcgbmV3IGxvY2FsZSB0byAke2xvY2FsZX1gKVxuICAgICAgICAgICAgaTE4bi5sb2NhbGUgPSBsb2NhbGVcbiAgICAgICAgICAgIHVwZGF0ZVN5c3RlbVRyYXkoaTE4bi5sb2NhbGUpO1xuICAgICAgICB9KVxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEV4YW1NYXRlcmlhbHMnLCBhc3luYyAoZXZlbnQpID0+IHsgXG4gICAgICBcbiAgICAgICAgICAgIGxldCBjbGllbnRpbmZvID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb1xuICAgICAgICAgICAgbGV0IHNlcnZlcm5hbWUgPSBjbGllbnRpbmZvLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJpcCA9IGNsaWVudGluZm8uc2VydmVyaXBcbiAgICAgICAgICAgIGxldCB0b2tlbiA9IGNsaWVudGluZm8udG9rZW5cbiAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHsgXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGNsaWVudGluZm8uZ3JvdXAsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBleGFtTWF0ZXJpYWxzID0gZmFsc2VcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgICAgICAgICBleGFtTWF0ZXJpYWxzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9nZXRleGFtbWF0ZXJpYWxzLyR7c2VydmVybmFtZX0vJHt0b2tlbn1gLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogcmVjZWl2ZWQgZGF0YVwiLCBkYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiAke2Vycn1gKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4YW1NYXRlcmlhbHNcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgIFxuICAgICAgICB9KSBcblxuICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGNvbW1vbiBleGNlcHRpb24gVVJMcyAodXNlZCBieSBhbGwgZXhhbSBtb2RlcylcbiAgICAgICAgY29uc3QgY2hlY2tDb21tb25FeGNlcHRpb25zID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIk1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiR29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50c1wiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGUuY29tXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJteXNpZ25pbnNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhY2NvdW50XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIndpbmRvd3NhenVyZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb29rdXBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJiaWxkdW5nLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTaGliYm9sZXRoXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJpZC1hdXN0cmlhLmd2LmF0XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhIYW5kbGVyXCIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImV1LW1vYmlsZS5ldmVudHMuZGF0YVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJtaWNyb3NvZnRcIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImdzdGF0aWMuY29tXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0b25saW5lXCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJsaXZlLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJhYWRjZG5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibXNmdGF1dGgubmV0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnb29nbGVzeW5kaWNhdGlvbi5jb21cIikpIHJldHVybiB0cnVlOyBcblxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIGFsbG93ZWRVcmxzIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRW50ZmVybmUgYWx0ZSBMaXN0ZW5lciwgdW0gRG9wcGVsLVJlZ2lzdHJpZXJ1bmdlbiB6dSB2ZXJtZWlkZW5cbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYWxsb3cgPSBhbGxvd2VkVXJscy5tYXAocyA9PiBTdHJpbmcocykudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBpZiBVUkwgbWF0Y2hlcyBhbGxvd2VkIGRvbWFpbiAoc3VwcG9ydHMgc3ViZG9tYWlucyBhbmQgcGF0aHMpXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxTdHIgPSBTdHJpbmcodGFyZ2V0VXJsKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGNvbW1vbiBleGNlcHRpb25zIGZpcnN0XG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrQ29tbW9uRXhjZXB0aW9ucyh1cmxTdHIpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBlYWNoIGFsbG93ZWQgVVJMXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBhbGxvd2VkVXJsIG9mIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gcGFyc2UgYXMgVVJMIHRvIGV4dHJhY3QgaG9zdG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybE9iaiA9IG5ldyBVUkwodGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldEhvc3RuYW1lID0gdXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnNlIGFsbG93ZWQgVVJMIHRvIGV4dHJhY3QgZG9tYWluXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmw7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgYWxsb3dlZFVybC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dlZFVybE9iaiA9IG5ldyBVUkwoYWxsb3dlZFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dlZERvbWFpbiA9IGFsbG93ZWRVcmxPYmouaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsb3dlZFVybC5pbmNsdWRlcygnLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQncyBhIHBhdGggd2l0aG91dCBwcm90b2NvbCwgZXh0cmFjdCBkb21haW4gcGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gYWxsb3dlZFVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFeGFjdCBtYXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWxsb3dlZERvbWFpbiBpcyBhIHNwZWNpZmljIHN1YmRvbWFpbiAoY29udGFpbnMgZG90cylcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzU3BlY2lmaWNTdWJkb21haW4gPSBhbGxvd2VkRG9tYWluLmluY2x1ZGVzKCcuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1NwZWNpZmljU3ViZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBzcGVjaWZpYyBzdWJkb21haW4gaXMgc3BlY2lmaWVkLCBvbmx5IGFsbG93IHRoYXQgZXhhY3Qgc3ViZG9tYWluIGFuZCB3d3cuIHZhcmlhbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGFsbG93IG90aGVyIHN1YmRvbWFpbnMgd2hlbiBhIHNwZWNpZmljIG9uZSBpcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgb25seSBiYXNlIGRvbWFpbiBpcyBzcGVjaWZpZWQgKGUuZy4sIFwib3JmLmF0XCIpLCBhbGxvdyBhbGwgc3ViZG9tYWluc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IHd3dy4gc3ViZG9tYWluIGV4cGxpY2l0bHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUgPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsbG93IG90aGVyIHN1YmRvbWFpbnMgKGUuZy4sIHN1Yi5kdWRlbi5kZSBpZiBkdWRlbi5kZSBpcyBhbGxvd2VkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZS5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSB0YXJnZXRIb3N0bmFtZS5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBwcmVmaXg6IG11c3QgYmUgdmFsaWQgc3ViZG9tYWluIG5hbWUgKGFscGhhbnVtZXJpYyBhbmQgaHlwaGVucylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBVUkwgcGFyc2luZyBmYWlscywgZmFsbCBiYWNrIHRvIHNpbXBsZSBpbmNsdWRlcyBjaGVjayBmb3IgcGF0aHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cmxTdHIuaW5jbHVkZXMoYWxsb3dlZFVybCkpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzQWxsb3dlZCkgeyBcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGFsbG93ZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNBbGxvd2VkID0gaXNVcmxBbGxvd2VkKHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVW5pZmllZCBJUEMgaGFuZGxlciBmb3Igd2VidmlldyBibG9ja2luZyAtIHN1cHBvcnRzIHdlYnNpdGUsIGVkdXZpZHVhbCwgZm9ybXMsIHJkcCBtb2Rlc1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb2RlLCBhbGxvd2VkRG9tYWluLCBiYXNlVXJsLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiwgZ2Zvcm1zVGVzdElkIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1ZXN0ID0gd2ViQ29udGVudHMuZnJvbUlkKE51bWJlcihndWVzdElkKSk7XG4gICAgICAgICAgICBpZiAoIWd1ZXN0IHx8IGd1ZXN0LmlzRGVzdHJveWVkPy4oKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgdG8gcHJldmVudCBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFVSTCB2YWxpZGF0aW9uIGZ1bmN0aW9uIC0gZGlmZmVyZW50IGxvZ2ljIGJhc2VkIG9uIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IGlzVXJsQWxsb3dlZCA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZSA9PT0gXCJ3ZWJzaXRlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV0VCU0lURSBtb2RlOiBjaGVjayBkb21haW4gbWF0Y2hpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVcmwgfHwgdGFyZ2V0VXJsLmluY2x1ZGVzKGJhc2VVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkb21haW4gPSB1cmxPYmouaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09IGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhwbGljaXRseSBhbGxvdyB3d3cuIHN1YmRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbiA9PT0gJ3d3dy4nICsgYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluLmVuZHNXaXRoKCcuJyArIGFsbG93ZWREb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gZG9tYWluLnNsaWNlKDAsIC0oYWxsb3dlZERvbWFpbi5sZW5ndGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZWZpeCAmJiAhcHJlZml4LmluY2x1ZGVzKCcuJykgJiYgL15bYS16QS1aMC05XShbYS16QS1aMC05LV0qW2EtekEtWjAtOV0pPyQvLnRlc3QocHJlZml4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZWR1dmlkdWFsXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRURVVklEVUFML01PT0RMRSBtb2RlOiBjaGVjayBtb29kbGVUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9vZGxlLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInN0YXJ0YXR0ZW1wdC5waHBcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtb29kbGVkb21haW4gb2huZSB0ZXN0aWRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicHJvY2Vzc2F0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ291dFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImVkdXZpZHVhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9saWN5XCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcIlNBTUwyXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInBvcnRhbC50aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInRpcm9sLmd2LmF0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJmb3Jtc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZPUk1TIG1vZGU6IGNoZWNrIGdmb3Jtc1Rlc3RJZFxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKGdmb3Jtc1Rlc3RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBHb29nbGUgRm9ybXMtc3BlY2lmaWMgZXhjZXB0aW9uc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZG9jcy5nb29nbGUuY29tXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImZvcm1SZXNwb25zZVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ2aWV3c2NvcmVcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcInJkcFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJEUCBtb2RlOiBhbGxvdyBhbGwgKG9yIGltcGxlbWVudCBzcGVjaWZpYyBsb2dpYyBpZiBuZWVkZWQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIG1vZGVzKVxuICAgICAgICAgICAgICAgIHJldHVybiBjaGVja0NvbW1vbkV4Y2VwdGlvbnModGFyZ2V0VXJsKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB0YXJnZXQ9XCJfYmxhbmtcIiBsaW5rcyBhbmQgd2luZG93Lm9wZW4gLSBibG9jayBCRUZPUkUgbmF2aWdhdGlvblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaXNVcmxBbGxvd2VkKHVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgLy8gT3BlbiBpbiBzYW1lIHdlYnZpZXdcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgLy8gUHJldmVudCBuZXcgd2luZG93XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCB3aW5kb3cub3BlbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEhhbmRsZSB3aWxsLW5hdmlnYXRlIG9uIHdlYkNvbnRlbnRzIGxldmVsIC0gdGhpcyBmaXJlcyBCRUZPUkUgbmF2aWdhdGlvbiBoYXBwZW5zXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gQmxvY2sgbmF2aWdhdGlvbiBjb21wbGV0ZWx5IC0gdGhpcyBoYXBwZW5zIEJFRk9SRSBwYWdlIGxvYWRzXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LnN0b3AoKTsgLy8gU3RvcCBhbnkgbG9hZGluZyBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgbmF2aWdhdGlvbiB0b2AsIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsaWFzIGZvciBlZHV2aWR1YWwgbW9kZSAtIHJlZGlyZWN0cyB0byB1bmlmaWVkIGhhbmRsZXJcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci1lZHV2aWR1YWwtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KSA9PiB7XG4gICAgICAgICAgICAvLyBDYWxsIHRoZSB1bmlmaWVkIGhhbmRsZXIgd2l0aCBlZHV2aWR1YWwgbW9kZVxuICAgICAgICAgICAgY29uc3QgdW5pZmllZEhhbmRsZXIgPSBpcGNNYWluLmxpc3RlbmVycygnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycpWzBdO1xuICAgICAgICAgICAgaWYgKHVuaWZpZWRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuaWZpZWRIYW5kbGVyKGV2ZW50LCB7IGd1ZXN0SWQsIG1vZGU6ICdlZHV2aWR1YWwnLCBtb29kbGVUZXN0SWQsIG1vb2RsZURvbWFpbiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbG9hZCB0aGUgYnJvd3NlciB2aWV3XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgncmVsb2FkLWJyb3dzZXItdmlldycsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubG9hZFVSTCh1cmwpO1xuICAgICAgICB9KTtcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGxhbmd1YWdlVG9vbCBBUEkgU2VydmVyICh3aXRoIEphdmEgSlJFKVxuICAgICAgICAgKiBSdW5zIGF0IGxvY2FsaG9zdCA4MDg4XG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSkgXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWN0aXZhdGUgc3BlbGxjaGVjayBvbiBkZW1hbmQgZm9yIHNwZWNpZmljIHN0dWRlbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyAgXG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2VUb29sU2VydmVyLnN0YXJ0U2VydmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgTGFuZ3VhZ2VUb29sIHNlcnZlciByZXNwb25kcyBvbiBjb25maWd1cmVkIHBvcnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnaXNMYW5ndWFnZVRvb2xSdW5uaW5nJywgYXN5bmMgKCkgPT4geyBcbiAgICAgICAgICAgIGNvbnN0IHBvcnQgPSBsYW5ndWFnZVRvb2xTZXJ2ZXIucG9ydCB8fCA4MDg4O1xuICAgICAgICAgICAgY29uc3QgaG9zdHMgPSBbJzEyNy4wLjAuMScsICc6OjEnLCAnbG9jYWxob3N0J107XG4gICAgICAgICAgICAvLyBSdW4gYWxsIGNoZWNrcyBpbiBwYXJhbGxlbCBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlLCB1c2UgbG9uZ2VyIHRpbWVvdXQgZm9yIHNlcnZlciBzdGFydHVwIGRldGVjdGlvblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGhvc3RzLm1hcChob3N0ID0+IGNoZWNrUG9ydE9wZW4ocG9ydCwgaG9zdCwgMjUwMCkpKTtcbiAgICAgICAgICAgIC8vIFJldHVybiBmaXJzdCBzdWNjZXNzZnVsIHJlc3VsdCwgb3IgbGFzdCByZXN1bHQgaWYgbm9uZSBzdWNjZWVkZWRcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3NSZXN1bHQgPSByZXN1bHRzLmZpbmQocmVzdWx0ID0+IHJlc3VsdC5ydW5uaW5nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0IHx8IHJlc3VsdHNbcmVzdWx0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IExPQ0FMIExvY2tkb3duXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdsb2NhbGxvY2tkb3duJywgKGV2ZW50LCBhcmdzKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2NhbGxvY2tkb3duOiBsb2NraW5nIGRvd24gY2xpZW50IHdpdGhvdXQgdGVhY2hlciBjb25uZWN0aW9uXCIpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzZXJ2ZXJzdGF0dXMgPSB7XG4gICAgICAgICAgICAgICAgZXhhbW1vZGU6IHRydWUsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RUeXBlOiAnJyxcbiAgICAgICAgICAgICAgICBtb29kbGVEb21haW46ICcnLFxuIFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RpbnRlcnZhbDogMCxcbiAgICAgICAgICAgICAgICBtc09mZmljZUZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNsb2NrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBpbjogJzAwMDAnLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdW5sb2Nrb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmb250ZmFtaWx5OiAnc2Fucy1zZXJpZicsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdElkOiAnJyxcbiAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiBhcmdzLnBhc3N3b3JkLFxuICAgICAgICAgXG4gICAgICAgICAgICAgICAgdXNlRXhhbVNlY3Rpb25zOiBmYWxzZSwgLy9pZiBmYWxzZSBleGFtIHNlY3Rpb24gMSBpcyB1c2VkIGFuZCBubyB0YWJzIGFyZSBkaXNwbGF5ZWRcbiAgICAgICAgICAgICAgICBhY3RpdmVTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgZXhhbVNlY3Rpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIDE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YW10eXBlOiBhcmdzLmV4YW1tb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY21hcmdpbjogeyBzaWRlOiAncmlnaHQnLCBzaXplOiAzIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lc3BhY2luZzogJzInLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9SZXBlYXQ6IDMsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZXRvb2w6IGFyZ3MubGFuZ3VhZ2V0b29sIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlbGxjaGVja2xhbmc6IGFyZ3Muc3BlbGxjaGVja2xhbmcgfHwgJ2RlLURFJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBhcmdzLnN1Z2dlc3Rpb25zIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGFyZ3MuY2xpZW50bmFtZTtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBcIjEyNy4wLjAuMVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gXCJhXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSB0cnVlOyAvLyB0aGlzIG11c3QgYmUgc2V0IHRvIHRydWUgaW4gb3JkZXIgdG8gc3RvcCB0eXBpY2FsIG5leHQtZXhhbSBjbGllbnQvdGVhY2hlciBhY3Rpb25zXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gbG9jYWxsb2NrZG93blwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdmlydHVhbGl6ZWQgc3RhdHVzXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigndmlydHVhbGl6ZWQnLCAoKSA9PiB7ICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gdHJ1ZTsgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IEZPQ1VTIHN0YXRlIHRvIGZhbHNlIChtb3VzZSBsZWZ0IGV4YW0gd2luZG93KVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdmb2N1c2xvc3QnLCAoZXZlbnQsIGN0cmxhbHQ9ZmFsc2UpID0+IHsgXG4gICAgICAgICAgICBsZXQgYW5zd2VyID0gZmFsc2UgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgIXRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1tb2RlKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZX1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPiAwKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkICYmIGN0cmxhbHQgPT0gZmFsc2UpeyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGZvY3VzbG9zdDogbW91c2VsZWF2ZSBldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICBcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGJsb2NrIGV2ZXJ5dGhpbmcgYW5kIGluZm9ybSB0ZWFjaGVyICAocHJvYmFibHkgYW4gb3ZlcmtpbGwgb24gbW91c2VsZWF2ZSAtIG5lZWRzIHRlc3RpbmcpXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGFuc3dlclxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIG1haW4gY29uZmlnIG9iamVjdFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb25maWcgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogVW5sb2NrIENvbXB1dGVyXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdncmFjZWZ1bGx5ZXhpdCcsICgpID0+IHsgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBncmFjZWZ1bGx5ZXhpdDogZ3JhY2VmdWxseSBsZWF2aW5nIGxvY2tlZCBleGFtIG1vZGVgKVxuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdyYWNlZnVsbHlFbmRFeGFtKCkgXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICB9IClcblxuICAgICAgICAvKipcbiAgICAgICAgKiBzdG9wIHJlc3RyaWN0aW9uc1xuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdHJpY3Rpb25zJywgKCkgPT4geyAgXG4gICAgICAgICAgICAvL3RoaXMgYWxzbyBzdG9wcyB0aGUgY2xlYXJDbGlwYm9hcmQgaW50ZXJ2YWxcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIFxuICAgICAgICB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIGNvcHkgdG8gZ2xvYmFsIGNsaXBib2FyZFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2xpcGJvYXJkJywgKGV2ZW50LCB0ZXh0KSA9PiB7ICBcbiAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7ICAgIGFkZHJlc3MgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7ICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBtdWx0aWNhc3RjbGllbnQgbm90IHJ1bm5pbmdcIik7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBiZXJlaXRzIGVpbmUgQWRyZXNzZSB2b3JoYW5kZW4gaXN0LCBsaWVmZXJuIHdpciBzaWUgenVyXHUwMEZDY2suXG4gICAgICAgICAgICBpZiAoYWRkcmVzcykgeyAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDsgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyc3VjaGUsIGFuIGRpZSBrb3JyZWt0ZSBTY2huaXR0c3RlbGxlIHp1IGJpbmRlblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBGYWxscyBnYXRld2F5NHN5bmMoKSBibG9ja2llcmVuZCBpc3QsIGthbm5zdCBkdSBkaWVzZW4gQXVmcnVmIGluIGVpbiBQcm9taXNlIHBhY2tlbjpcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2UgfSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdhdGV3YXk0c3luYygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikgeyAgcmVqZWN0KGVycik7ICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpOyAvLyBMaWVmZXJ0IGRpZSBJUCBkZXIgU2Nobml0dHN0ZWxsZSwgd2VsY2hlIGRhcyBEZWZhdWx0IEdhdGV3YXkgaGF0XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMga2VpbmUgSVAgKG1pdCBHYXRld2F5KSB2ZXJmXHUwMEZDZ2JhciBpc3QsIGhvbGUgZWluZSBhbHRlcm5hdGl2ZSBBZHJlc3NlXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKTsgLy8gTGllZmVydCBhdWNoIGVpbmUgSVAsIHdlbm4ga2VpbiBHYXRld2F5IHZlcmZcdTAwRkNnYmFyIGlzdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcmZcdTAwRTRsc2NodGUgQWRyZXNzZW4gKHouIEIuIGxvY2FsaG9zdCkgaWdub3JpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PT0gXCIxMjcuMC4wLjFcIikgeyAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTsgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFdlbm4gZGllIE11bHRpY2FzdC1DbGllbnQgbmljaHQgbFx1MDBFNHVmdCwgaW5pdGlhbGlzaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgIWFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGYWxscyBpbml0KCkgYXN5bmNocm9uIHVtZ2VzZXR6dCB3ZXJkZW4ga2Fubiwgd2FydGVuIHdpciBoaWVyIGRhcmF1Zi5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7ICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IEVycm9yIGluaXRpYWxpemluZyBtdWx0aWNhc3QgY2xpZW50XCIsIGVycik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwO1xuICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gZWRpdG9yIGFzIGh0bWwgZmlsZSAtIGFzIGJhY2t1cCAtIG9ubHkgdHJpZ2dlcmVkIGJ5IHRoZSB0ZWFjaGVyIGZvciBub3cgKGFsbG93IG1hbnVhbCBiYWNrdXAgISEpXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7Y2xpZW50bmFtZTp0aGlzLmNsaWVudG5hbWUsIGZpbGVuYW1lOmAke2ZpbGVuYW1lfS5odG1sYCwgZWRpdG9yY29udGVudDogZWRpdG9yY29udGVudCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZUhUTUwnLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGh0bWxDb250ZW50ID0gYXJncy5lZGl0b3Jjb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGxldCBodG1sZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2BcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKXtcbiAgICAgICAgICAgICAgICBodG1sZmlsZW5hbWUgPSBgJHtmaWxlbmFtZX0uYmFrYFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBodG1sZmlsZSA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBodG1sZmlsZW5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaHRtbENvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoaHRtbGZpbGUsIGh0bWxDb250ZW50LCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogJHtlcnIubWVzc2FnZX1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWx0ZXJuYXRlcGF0aCA9IGAke2h0bWxmaWxlfS0ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59LmJha2BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHRyeWluZyB0byB3cml0ZSBmaWxlIGFzOlwiLCBhbHRlcm5hdGVwYXRoIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgaHRtbENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgYmFzZTY0IGVuY29kZWQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBERmJhc2U2NCcsIGFzeW5jIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0UERGYmFzZTY0OiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyID0gYXJncy5zdWJtaXNzaW9ubnVtYmVyKzEgLy8gY2xpZW50aW5mbyBrZWVwcyB0cmFjayBvZiBzdWJtaXNzaW9ucyBmb3IgYXV0b21hdGVkIHN1Ym1pc3Npb25udW1iZXJzIGF0IHNlY3Rpb24gY2hhbmdlIC0gYnV0IHRoaXMgb2J2aW91c2x5IGhhcHBlbnMgYWZ0ZXIgbWFudWFsIHN1Ym1pdFxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKGFyZ3Muc3VibWlzc2lvbm51bWJlciwgYXJncy5zZWN0aW9ubmFtZSwgYXJncy5wcmludEJhY2tncm91bmQpICAgLy8gd2h5IHRoZSBoZWxsIGlzIHRoaXMgZnVuY3Rpb24gbG9jYXRlZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBhbmQgbm90IGluIGlwY2hhbmRsZXIuanMgPyBGSVhNRSAhXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyB0aGUgRXhhbVdpbmRvdyBjb250ZW50IGFzIFBERlxuICAgICAgICAgKiBBVFRFTlRJT04gdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCByZXR1bnMgYSBiYXNlNjQgdmVyc2lvbiBvZiB0aGUgcGRmXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncHJpbnRwZGYnLCAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICAvLyBkbyBub3QgcHJpbnQgaWYgZXhhbSBtb2RlIGlzIG5vdCBhY3RpdmUgYW55bW9yZVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBleGFtbW9kZSBpcyBmYWxzZSAtIHNraXBwaW5nIHByaW50XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBwcmludCBhbHJlYWR5IGluIHByb2dyZXNzIC0gc2tpcHBpbmcgbmV3IHJlcXVlc3RcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyAvLyBkZWZpbmUgcHJpbnQgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGFyZ3MubGFuZHNjYXBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke2FyZ3Muc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7YXJncy5jbGllbnRuYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcGRmZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LnBkZmAgIC8vIGRlZmF1bHQgZmlsZW5hbWUgPSBjbGllbnRuYW1lLnBkZlxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmZpbGVuYW1lKXsgIC8vIGluIGNhc2Ugb2YgbWFudWFsIGJhY2t1cCB0aGUgdXNlciBjYW4gc2V0IGEgY3VzdG9tIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgICAgIHBkZmZpbGVuYW1lID0gYCR7YXJncy5maWxlbmFtZX0ucGRmYFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmZmlsZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgcGRmZmlsZW5hbWUpOyAgLy8gcGF0aCBwb2ludHMgdG8gdGhlIGN1cnJlbnQgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1hdXgucGRmYCAgICAvL3Rob21hcy5wZGYtYXV4LnBkZiBcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1vbGQucGRmYDsgICAvL3Rob21hcy5wZGYtb2xkLnBkZlxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlZmlsZW5hbWUpOyAgLy8gaWYgc29tZXRoaW5nIGdvZXMgd3Jvbmcgd2UgdHJ5IHRvIHdyaXRlIGEgZGlmZmVyZW50IGZpbGVcblxuXG4gICAgICAgICAgICAgICAgLy8gYXV4IGZpbGVzIGFyZSBmaWxlcyBjcmVhdGVkIGlmIHRoZSBtYWluIHBkZmZpbGVwYXRoIGlzIG5vdCB3cml0ZWFibGUgKG9wZW5lZCBvbiB3aW5kb3dzKSBcbiAgICAgICAgICAgICAgICB0cnkgeyAgLy8gYWx3YXlzIGNoZWNrIGZvciBvbGQgYXV4IGZpbGVzIGFuZCByZW5hbWUgdGhlbVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IGFsdGVybmF0ZWZpbGVuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhhbHRlcm5hdGVwYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGFtV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV4YW1XaW5kb3c/LndlYkNvbnRlbnRzXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdlYkNvbnRlbnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIm5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSB0cnVlXG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZSBmb3IgUERGIG1ldGFkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgcGRmVGl0bGUgPSBhcmdzLmZpbGVuYW1lID8gYXJncy5maWxlbmFtZSA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke2FyZ3Muc2VydmVybmFtZSB8fCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgfHwgJyd9YFxuICAgICAgICAgICAgICAgIC8vIGVzY2FwZSBxdW90ZXMgYW5kIHNwZWNpYWwgY2hhcmFjdGVycyBmb3IgSmF2YVNjcmlwdCBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkVGl0bGUgPSBwZGZUaXRsZS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7ZXNjYXBlZFRpdGxlfVwiYCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByaW50IHRoZSBleGFtIHdpbmRvdyB0byBwZGZcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucylcbiAgICAgICAgICAgICAgICB9KS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBwZGYgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMocGRmZmlsZXBhdGgpKSB7IGZzLnVubGlua1N5bmMocGRmZmlsZXBhdGgpOyB9fVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShwZGZmaWxlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfSAtIHdyaXRpbmcgZmlsZSBhczogJHthbHRlcm5hdGVwYXRofSBgKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgYXV4IGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRlcGF0aCkpIHsgZnMudW5saW5rU3luYyhhbHRlcm5hdGVwYXRoKTsgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZiAoYWx0ZXJuYXRpdmVyIFBmYWQpOiAke2Vyci5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgYWx0ZXJuYXRlIHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpICAgLy9tYWtlIHN1cmUgc3R1ZGVudHMgc2VlIHRoZSBuZXcgZmlsZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyb3IubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmVzIEFjdGl2ZSBTaGVldHMgZm9ybSBkYXRhIHRvIC5iYWsgZmlsZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc2F2ZUFjdGl2ZXNoZWV0c0JhaycsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWUgPyBgJHthcmdzLmZpbGVuYW1lfS5iYWtgIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGJha0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGZvcm1EYXRhIHRvIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShhcmdzLmZvcm1EYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byAuYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJha0ZpbGVQYXRoLCBqc29uRGF0YSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6IHNhdmVkIGZvcm0gZGF0YSB0byAke2Jha0ZpbGVuYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFsbCBmb3VuZCBTZXJ2ZXJzIGFuZCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0aW5mb2FzeW5jJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gZmFsc2UgICBcbiAgICAgICAgICAgIC8vIHNlcnZlcnN0YXR1cyBvYmpla3Qgd2lyZCBudXIgYmVpIGJlZ2lubiBkZXMgZXhhbXMgYW4gZGFzIGV4YW0gd2luZG93IGR1cmNoZ2VyZWljaHQgZlx1MDBGQ3IgYmFzaXMgZWluc3RlbGx1bmdlblxuICAgICAgICAgICAgLy8gYWxsZSB3ZWl0ZXJlbiB1cGRhdGVzIFx1MDBGQ2JlciBkYXMgc2VydmVyc3RhdHVzIG9iamVjdCB3ZXJkZW4gaW0gY29tbXVuaWNhdGlvbiBoYW5kbGVyIGdlbGVzZW4gdW5kIGdnZi4gYXVmIGRhcyBjbGllbnRpbmZvIG9iamVjdCBnZWxlZ3RcbiAgICAgICAgICAgIC8vIGRpZXNlciBrb21tdW5pa2F0aW9uc2ZsdXNzIG11c3MgaW4gMi4wIGdlc3RyZWFtbGluZWQgd2VyZGVuICNGSVhNRVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgc2VydmVyc3RhdHVzID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzIH1cblxuICAgICAgICAgICAgLy9jb3VudCBudW1iZXIgb2YgZmlsZXMgaW4gZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSkgIC8vIGVyc3RlbGx0IGZhbGxzIG5cdTAwRjZ0aWdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZWxpc3QgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcih3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICByZXR1cm4geyAgIFxuICAgICAgICAgICAgICAgIHNlcnZlcmxpc3Q6IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LFxuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiZWNhdXNlIG9mIG1pY3Jvc29mdCAzNjUgd2UgbmVlZCB0byB3b3JrIHdpdGggXCJCcm93c2VyVmlld1wiIFxuICAgICAgICAgKiBpbiBvcmRlciB0byBiZSBhYmxlIHRvIGRpc2xheSBmdWxsc2NyZWVuIGluZm9ybWF0aW9uIGZyb20gdGhlIEV4YW0gaGVhZGVyIHdlIHRlbXBvcmFyaWx5IGNvbGxhcHNlIHRoZSBCcm93c2VyVmlldyBmb3IgT2ZmaWNlXG4gICAgICAgICAqIGFuZCByZXN0b3JlIGl0IGFmdGVyd2FyZHMgLSBub3QgcGVyZmVjdCBidXQgbG9va3Mgb2tcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdjb2xsYXBzZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHsgeDogMCwgeTogMCwgd2lkdGg6IDAsIGhlaWdodDogMCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICB9KTtcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdG9yZS1icm93c2VydmlldycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICBpZiAoIW1haW5XaW5kb3cpeyByZXR1cm4gfVxuICAgICAgICAgICAgY29uc3QgbWVudUhlaWdodCA9IG1haW5XaW5kb3cubWVudUhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7IC8vIEdldCB0aGUgY3VycmVudCBib3VuZHMgb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIC8vIFNldCB0aGUgbmV3IGJvdW5kcyBvZiB0aGUgY29udGVudFZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiBtZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsIC8vIGZ1bGwgd2lkdGggb2YgdGhlIG1haW5XaW5kb3dcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBtZW51SGVpZ2h0IC8vIHJlbWFpbmluZyBoZWlnaHQgYWZ0ZXIgdGhlIG1lbnVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlIG1lbnUgaGVpZ2h0IGR5bmFtaWNhbGx5IHdoZW4gaGVhZGVyIGNvbnRlbnQgY2hhbmdlc1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigndXBkYXRlLW1lbnUtaGVpZ2h0JywgKGV2ZW50LCBoZWlnaHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdztcbiAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmIGhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHN0b3JlZCBtZW51IGhlaWdodFxuICAgICAgICAgICAgICAgIG1haW5XaW5kb3cubWVudUhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZXBvc2l0aW9uIHRoZSBicm93c2VyIHZpZXcgd2l0aCBuZXcgaGVpZ2h0XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRWaWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgeTogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIGhlaWdodFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2VuZHMgYSByZWdpc3RlciByZXF1ZXN0IHRvIHRoZSBnaXZlbiBzZXJ2ZXIgaXBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIGNsaWVudG5hbWU6dGhpcy51c2VybmFtZSwgc2VydmVybmFtZTpzZXJ2ZXJuYW1lLCBzZXJ2ZXJpcCwgc2VydmVyaXAsIHBpbjp0aGlzLnBpbmNvZGUgXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdyZWdpc3RlcicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY2xpZW50bmFtZSA9IGFyZ3MuY2xpZW50bmFtZVxuICAgICAgICAgICAgY29uc3QgcGluID0gYXJncy5waW5cbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmlwID0gYXJncy5zZXJ2ZXJpcFxuICAgICAgICAgICAgY29uc3Qgc2VydmVybmFtZSA9IGFyZ3Muc2VydmVybmFtZVxuICAgICAgICAgICAgY29uc3QgY2xpZW50aXAgPSBpcC5hZGRyZXNzKClcbiAgICAgICAgICAgIGNvbnN0IGhvc3RuYW1lID0gb3MuaG9zdG5hbWUoKVxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHRoaXMuY29uZmlnLnZlcnNpb25cbiAgICAgICAgICAgIGNvbnN0IGJpcHVzZXJJRCA9IGFyZ3MuYmlwdXNlcklEXG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXsgLy8jRklYTUUgZGFzIHNvbGx0ZSBlaWdlbnRsaWNoIHZvbSBzZXJ2ZXIga29tbWVuIFxuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IHQoXCJjb250cm9sLmFscmVhZHlyZWdpc3RlcmVkXCIpLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcmVnaXN0ZXJjbGllbnQvJHtzZXJ2ZXJuYW1lfS8ke3Bpbn0vJHtjbGllbnRuYW1lfS8ke2NsaWVudGlwfS8ke2hvc3RuYW1lfS8ke3ZlcnNpb259LyR7YmlwdXNlcklEfWA7XG4gICAgICAgICAgICBjb25zdCBzaWduYWwgPSBBYm9ydFNpZ25hbC50aW1lb3V0KDgwMDApOyAvLyA4MDAwIE1pbGxpc2VrdW5kZW4gPSA4IFNla3VuZGVuIEFib3J0U2lnbmFsIG1pdCBlaW5lbSBUaW1lb3V0XG5cblxuICAgICAgICAgICAgZmV0Y2godXJsLCB7IG1ldGhvZDogJ0dFVCcsIHNpZ25hbCB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSBcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09IFwic3VjY2Vzc1wiKSB7ICAvLyByZWdpc3RyYXRpb24gc3VjY2Vzc2Z1bGwgb3RoZXJ3aXNlIGRhdGEgd291bGQgYmUgXCJmYWxzZVwiXG4gICAgICAgICAgICAgICAgICAgIC8vIEVyZm9sZ3JlaWNoZSBSZWdpc3RyaWVydW5nXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGNsaWVudG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBzZXJ2ZXJpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gc2VydmVybmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5pcCA9IGNsaWVudGlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gPSBkYXRhLnRva2VuOyAvLyB3ZSBuZWVkIHRvIHN0b3JlIHRoZSBjbGllbnQgdG9rZW4gaW4gb3JkZXIgdG8gY2hlY2sgYWdhaW5zdCBpdCBiZWZvcmUgcHJvY2Vzc2luZyBjcml0aWNhbCBhcGkgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gcGluO1xuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiBzdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBhdCAke3NlcnZlcm5hbWV9IEAgJHtzZXJ2ZXJpcH0gYXMgJHtjbGllbnRuYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IGRhdGE7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9jcmVhdGUgZXhhbSBmb2xkZXIgaW4gd29ya2ZvbGRlclxuICAgICAgICAgICAgICAgICAgICBsZXQgdW5pcXVlZXhhbU5hbWUgPSBgJHtzZXJ2ZXJuYW1lfS0ke3Bpbn1gXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5leGFtZGlyZWN0b3J5ID0gcGF0aC5qb2luKGNvbmZpZy53b3JrZGlyZWN0b3J5LCB1bmlxdWVleGFtTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbXBhcmUgdmVyc2lvbnMgYW5kIGRpc3BsYXkgbWVzc2FnZSAodGVhY2hlciBuZWVkcyB1cGdyYWRlLi4gY2xpZW50IG5lZWRzIHVwZ3JhZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wYXJpc29uUmVzdWx0ID0gdGhpcy5jb21wYXJlU29mdHdhcmUoY29uZmlnLnZlcnNpb24sIGNvbmZpZy5pbmZvICwgZGF0YS52ZXJzaW9uLCBkYXRhLnZlcnNpb25pbmZvICkgLy9zZXJ2ZXJWZXJzaW9uLCBzZXJ2ZXJTdGF0dXMsIGxvY2FsVmVyc2lvbiwgbG9jYWxTdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkgeyAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IG5ldWVyIGFscyBkaWUgZGVyIExlaHJwZXJzb24hXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHsgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgenUgYWx0LiBMYWRlbiBzaWUgc2ljaCBlaW5lIGFrdHVlbGxlIFZlcnNpb24gaGVydW50ZXIhXCIgfTsgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbmJla2FubnRlciBGZWhsZXIgYmVpbSBWZXJiaW5kdW5nc2F1ZmJhdS5cIiB9OyAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGFzeW5jIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGZWhsZXJiZWhhbmRsdW5nXG4gICAgICAgICAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykgeyBlcnJvck1lc3NhZ2UgPSBcIlRoZSByZXF1ZXN0IHRpbWVkIG91dFwiOyAgIH0gLy8gVGltZW91dC1OYWNocmljaHQgYW5wYXNzZW4gXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIG9uIG1hY29zIHRoZSBwZXJtaXNzaW9uIHNldHRpbmdzIGluIHJhcmUgY2FzZXMgbWVzcyB1cCB0aGUgYWJpbGl0eSB0byBmZXRjaCB0aGUgdGVhY2hlciBhcGkgXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpeyAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHRoaXMuY29uZmlnLnNlcnZlckFwaVBvcnQpOyBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlID09PSBcInJlc2V0XCIpIHsgICAvLyBxdWl0IHRoZSBhcHAgaWYgdGhlIHVzZXIgd2FudHMgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaWYgdGhlIHVzZXIgZG9lcyBub3Qgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVzIGdpYnQgZWluIFByb2JsZW0gbWl0IGRlbSBOZXR6d2VyaywgZGVuIEZpcmV3YWxscmVnZWxuIG9kZXIgZGVuIE5ldHp3ZXJrYmVyZWNodGlndW5nZW4hIEJpdHRlIGJlaGViZW4gc2llIGRpZXNlcyBQcm9ibGVtIHVuZCBzdGFydGVuIFNpZSBOZXh0LUV4YW0gbmV1IVwiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICAgICAgICAgIHJldHVybjsgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIEdlb2dlYnJhIGFzIGdnYiBmaWxlIC0gYXMgYmFja3VwIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAsIGNvbnRlbnQ6IGJhc2U2NCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc2F2ZUdHQicsIChldmVudCwgYXJncykgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGFyZ3MuY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBjb25zdCByZWFzb24gPSBhcmdzLnJlYXNvblxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzYXZlR0dCOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBCdWZmZXIuZnJvbShjb250ZW50LCAnYmFzZTY0Jyk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGdnYkZpbGVQYXRoLCBmaWxlRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09IFwidGVhY2hlcnJlcXVlc3RcIikgeyB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnNlbmRUb1RlYWNoZXIoKSB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6dChcImRhdGEuZmlsZXN0b3JlZFwiKSAsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycikgIFxuICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUdHQjogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGxvYWQgY29udGVudCBmcm9tIGdnYiBmaWxlIGFuZCBzZW5kIGl0IHRvIHRoZSBmcm9udGVuZCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgIH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdsb2FkR0dCJywgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3QgZ2diRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBSZWFkIHRoZSBmaWxlIGFuZCBjb252ZXJ0IGl0IHRvIGJhc2U2NFxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKGdnYkZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlNjRHZ2JGaWxlID0gZmlsZURhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDpiYXNlNjRHZ2JGaWxlLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgIH0gICAgIFxuICAgICAgICB9KVxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdFVCBQREYgb3IgSU1BR0UgZnJvbSBFWEFNIGRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldHBkZmFzeW5jJywgKGV2ZW50LCBmaWxlbmFtZSwgaW1hZ2UgPSBmYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGVcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlKXsgcmV0dXJuIGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpOyAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgY29udGVudDogZmFsc2UgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIGJhc2U2NCBzdHJpbmcgb2YgYXVkaW9maWxlIGZyb20gd29ya2RpcmVjdG9yeSBvciBwdWJsaWMgZGlyZWN0b3J5XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0QXVkaW9GaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgcHVibGljZGlyPWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LCBcIi9cIik7XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmICFwdWJsaWNkaXIpIHsgLy8gUmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiBwdWJsaWNkaXIpIHtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uLy4uL3B1YmxpY1wiLGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG4gXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBGSUxFLUxJU1QgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0ZmlsZXNhc3luYycsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIGF1ZGlvPWZhbHNlLCBkb2N4PWZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJSZWNlaXZlZCBhcmd1bWVudHM6XCIsIGZpbGVuYW1lLCBhdWRpbywgZG9jeCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcblxuICAgICAgICAgICAgICAgIGlmIChhdWRpbyA9PSB0cnVlKXsgLy8gYXVkaW8gZmlsZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdWRpb0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZG9jeCl7ICAvL29mZmljZSBvcGVuIHhtbCBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBtYW1tb3RoLmNvbnZlcnRUb0h0bWwoe3BhdGg6IGZpbGVwYXRofSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAgIC8vYmFrIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7ICAvLyByZXR1cm4gZmlsZSBsaXN0IG9mIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtkaXIpKXsgZnMubWtkaXJTeW5jKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAgfSAvL2RvIG5vdCBjcmFzaCBpZiB0aGUgZGlyZWN0b3J5IGlzIGRlbGV0ZWQgYWZ0ZXIgdGhlIGFwcCBpcyBzdGFydGVkIF5eXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlbGlzdCA9ICBmcy5yZWFkZGlyU3luYyh3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZGlyZW50ID0+IGRpcmVudC5pc0ZpbGUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZGlyZW50ID0+IGRpcmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXMgPSBbXVxuICAgICAgICAgICAgICAgICAgICBmaWxlbGlzdC5mb3JFYWNoKCBmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2RpZmllZCA9IGZzLnN0YXRTeW5jKCAgIHBhdGguam9pbih3b3JrZGlyLGZpbGUpICApLm10aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kID0gbW9kaWZpZWQuZ2V0VGltZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wZGZcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcInBkZlwiLCBtb2Q6IG1vZH0pICAgfSAgICAgICAgIC8vcGRmXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmJha1wiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYmFrXCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBiYWNrdXAgZmlsZSB0byByZXBsYWNlIGVkaXRvciBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmRvY3hcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImRvY3hcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGNvbnRlbnQgZmlsZSAoZnJvbSB0ZWFjaGVyKSB0byByZXBsYWNlIGNvbnRlbnQgYW5kIGNvbnRpbnVlIHdyaXRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2diXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJnZ2JcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGdlb2dlYnJhXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm1wM1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5vZ2dcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIud2F2XCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiYXVkaW9cIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGF1ZGlvXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmpwZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5wbmdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZ2lmXCIgKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiaW1hZ2VcIiwgbW9kOiBtb2R9KSAgIH0gIC8vIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSBmaWxlbGlzdC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGZpbGVzYXN5bmM6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgQkFDS1VQIEZJTEUgZnJvbSBleGFtZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBmaWxlbmFtZSB3aXRob3V0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGJhY2t1cGZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFJlcXVlc3QgcmVjZWl2ZWQgZm9yIGZpbGVuYW1lOiAke2ZpbGVuYW1lfWApXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRnVsbCBmaWxlIHBhdGg6ICR7ZmlsZXBhdGh9YClcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZmlsZXBhdGgpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgbm90IGZvdW5kOiAke2ZpbGVwYXRofWApOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIGV4aXN0cywgcmVhZGluZyBjb250ZW50YClcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBTdWNjZXNzZnVsbHkgcmVhZCBiYWNrdXAgZmlsZSwgY29udGVudCBsZW5ndGg6ICR7ZGF0YS5sZW5ndGh9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciByZWFkaW5nIGJhY2t1cCBmaWxlOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHN0YWNrOiAke2Vyci5zdGFja31gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IG5vIGZpbGVuYW1lIHByb3ZpZGVkYCk7IFxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpcGNNYWluLm9uKCdyZWxvYWQtdXJsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlRWFzdGVyV2luKClcbiAgICAgICAgfSk7XG5cbiAgICAgICAgIC8qKlxuICAgICAgICAgKiBBcHBlbmQgUHJpbnRSZXF1ZXN0IHRvIGNsaWVudGluZm8gIFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3NlbmRQcmludFJlcXVlc3QnLCAoZXZlbnQpID0+IHsgICBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gdHJ1ZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXQtY3B1LWluZm8nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5pc1ZpcnR1YWxNYWNoaW5lKClcbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXQtd2xhbi1pbmZvJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3bGFuSW5mbyA9IGF3YWl0IGdldFdsYW5JbmZvKCk7XG4gICAgICAgICAgICByZXR1cm4gd2xhbkluZm87XG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgXG4gICAgICAgIC8vIE5ldyBoYW5kbGVyIHRvIGdldCBQREYgZnJvbSBwdWJsaWMgZGlyZWN0b3J5IGZvciBmcm9udGVuZCBwYXJzaW5nXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQZGZGcm9tUHVibGljJywgYXN5bmMgKGV2ZW50LCBwZGZGaWxlbmFtZSApID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gR2V0IGRpcmVjdG9yeSBuYW1lIGluIEVTTVxuICAgICAgICAgICAgICAgIGNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbGV0IHBkZlBhdGg7XG4gICAgICAgICAgICAgICAgcGRmUGF0aCA9IHBhdGguam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGRmUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBQREYgbm90IGZvdW5kIGF0OiAke3BkZlBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGRmUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG4gICAgaXNWaXJ0dWFsTWFjaGluZSgpIHtcbiAgICAgICAgY29uc3QgVkVORE9SUyA9IC8ob3JhY2xlfHZpcnR1YWxib3h8dm13YXJlfGt2bXxxZW11fHhlbnxpbm5vdGVrfHBhcmFsbGVsc3xtaWNyb3NvZnR8aHlwZXItdnxiaHl2ZXxyZWQgaGF0fHJlZGhhdHxib2Noc3xiaHl2ZXxvcGVuc3RhY2t8Y2xvdWR8YW1hem9ufGdvb2dsZXxhenVyZSkvaSAvLyBjb21tb24gVk0gaWRzXG4gICAgICAgIGNvbnN0IHdhcm5BbmRSZXR1cm4gPSByZWFzb24gPT4ge1xuICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBpc1ZpcnR1YWxNYWNoaW5lOiBWZXJkYWNodCBhdWYgVk0gLSAke3JlYXNvbn1gKVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gTGludXggLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjcHVpbmZvID0gcmVhZEZpbGVTeW5jKCcvcHJvYy9jcHVpbmZvJywgJ3V0ZjgnKSAgICAgIC8vIENQVSBmbGFnc1xuICAgICAgICAgICAgaWYgKC9eZmxhZ3MuKlxcYmh5cGVydmlzb3JcXGIvbS50ZXN0KGNwdWluZm8pKSByZXR1cm4gd2FybkFuZFJldHVybignaHlwZXJ2aXNvciBmbGFnIGluIC9wcm9jL2NwdWluZm8nKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IFtcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3N5c192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF9uYW1lJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfdmVyc2lvbicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9ib2FyZF92ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYmlvc192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvY2hhc3Npc192ZW5kb3InXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBjb25zdCBkbWkgPSBmaWxlcy5tYXAocCA9PiB7IHRyeSB7IHJldHVybiByZWFkRmlsZVN5bmMocCwgJ3V0ZjgnKSB9IGNhdGNoIHsgcmV0dXJuICcnIH0gfSkuam9pbignICcpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGRtaSkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdETUktVmVuZG9yLU1hdGNoJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXhlY1N5bmMoJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgLXEnLCB7IHN0ZGlvOiAnaWdub3JlJyB9KSAgICAvLyBleGl0IDAgPT4gVk1cbiAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdzeXN0ZW1kLWRldGVjdC12aXJ0IG1lbGRldCBWaXJ0dWFsaXNpZXJ1bmcnKVxuICAgICAgICAgIH0gY2F0Y2gge31cblxuXG4gICAgICAgICAgLy8gUHJcdTAwRkNmZSBhdWYgUUVNVS1Qcm96ZXNzZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9IGV4ZWNTeW5jKCdwcyBhdXggfCBncmVwIC1pIHFlbXUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChwcy5pbmNsdWRlcygncWVtdScpICYmICFwcy5pbmNsdWRlcygnZ3JlcCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgbFx1MDBFNHVmdCcpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBXaW5kb3dzIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIihHZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW0gfCBGb3JFYWNoLU9iamVjdCB7ICRfLk1hbnVmYWN0dXJlciwgJF8uTW9kZWwgfSkgLWpvaW4gXFwnIFxcJ1wiJ1xuICAgICAgICAgICAgY29uc3QgYmFzaWMgPSBleGVjU3luYyhwcywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKSAgICAvLyBtYW51ZmFjdHVyZXIgKyBtb2RlbFxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChiYXNpYykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvTW9kZWxsIHBhc3N0IHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzUm9idXN0ID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJG89QCgpOycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbTskbys9QCgkY3MuTWFudWZhY3R1cmVyLCRjcy5Nb2RlbCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiYj1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQmFzZUJvYXJkOyRvKz1AKCRiYi5NYW51ZmFjdHVyZXIsJGJiLlByb2R1Y3QpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmlvcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQklPUzskbys9QCgkYmlvcy5TTUJJT1NCSU9TVmVyc2lvbil9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjc3A9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtUHJvZHVjdDskbys9QCgkY3NwLk5hbWUpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ1dyaXRlLU91dHB1dCAoKCRvIC1qb2luIFxcJyBcXCcpLlRyaW0oKSlcIidcbiAgICAgICAgICAgIGNvbnN0IHJvYnVzdCA9IGV4ZWNTeW5jKHBzUm9idXN0LCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHJvYnVzdCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvQklPUy1JbmZvcyBwYXNzZW4genUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICAvLyBadXNcdTAwRTR0emxpY2hlIFFFTVUtRXJrZW5udW5nIGZcdTAwRkNyIFdpbmRvd3NcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcWVtdVByb2Nlc3NlcyA9IGV4ZWNTeW5jKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgcWVtdSpcIicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgICAgIGlmIChxZW11UHJvY2Vzc2VzLmluY2x1ZGVzKCdxZW11JykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgdW50ZXIgV2luZG93cycpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuXG4gICAgICAgICAvLyAtLS0tLS0tLS0tIG1hY09TIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaHdNb2RlbCA9IGV4ZWNTeW5jKCdzeXNjdGwgLW4gaHcubW9kZWwnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmICgvXnZpcnR1YWwvaS50ZXN0KGh3TW9kZWwpIHx8IFZFTkRPUlMudGVzdChod01vZGVsKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIEhhcmR3YXJlbW9kZWxsIGRldXRldCBhdWYgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3AgPSBleGVjU3luYygnc3lzdGVtX3Byb2ZpbGVyIFNQSGFyZHdhcmVEYXRhVHlwZScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChzcCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBzeXN0ZW1fcHJvZmlsZXIgbWVsZGV0IFZNLVZlbmRvcicpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2UgICAgICAgXG4gICAgfVxuXG4gICAgY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQikge1xuICAgICAgICBjb25zdCBwYXJ0c0EgPSB2ZXJzaW9uQS5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgICAgICBjb25zdCBwYXJ0c0IgPSB2ZXJzaW9uQi5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWF4KHBhcnRzQS5sZW5ndGgsIHBhcnRzQi5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG51bUEgPSBwYXJ0c0FbaV0gfHwgMDsgLy8gRmFsbGJhY2sgYXVmIDAsIGZhbGxzIGtlaW4gV2VydCB2b3JoYW5kZW5cbiAgICAgICAgICAgIGNvbnN0IG51bUIgPSBwYXJ0c0JbaV0gfHwgMDtcbiAgICBcbiAgICAgICAgICAgIGlmIChudW1BIDwgbnVtQikgcmV0dXJuIC0xO1xuICAgICAgICAgICAgaWYgKG51bUEgPiBudW1CKSByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgXG4gICAgY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyQSA9IHBhcnNlSW50KHN0YXR1c0EubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgICAgIGNvbnN0IG51bWJlckIgPSBwYXJzZUludChzdGF0dXNCLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgIFxuICAgICAgICBpZiAobnVtYmVyQSA8IG51bWJlckIpIHJldHVybiAtMTtcbiAgICAgICAgaWYgKG51bWJlckEgPiBudW1iZXJCKSByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgY29tcGFyZVNvZnR3YXJlKHZlcnNpb25BLCBzdGF0dXNBLCB2ZXJzaW9uQiwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCB2ZXJzaW9uQ29tcGFyaXNvbiA9IHRoaXMuY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQik7XG4gICAgICAgIGlmICh2ZXJzaW9uQ29tcGFyaXNvbiAhPT0gMCkgcmV0dXJuIHZlcnNpb25Db21wYXJpc29uO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcy5jb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQik7XG4gICAgfVxuXG5cbn1cbiBcbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiIsICJpbXBvcnQge2NyZWF0ZUkxOG59IGZyb20gJ3Z1ZS1pMThuJ1xuXG5pbXBvcnQgZW4gZnJvbSAnLi9lbi5qc29uJ1xuaW1wb3J0IGRlIGZyb20gJy4vZGUuanNvbidcblxuY29uc3QgaTE4biA9IGNyZWF0ZUkxOG4oe1xuICAgIGxvY2FsZTogJ2RlJyxcbiAgICBmYWxsYmFja0xvY2FsZTogJ2VuJyxcbiAgICBtZXNzYWdlczoge1xuICAgICAgICBlbixcbiAgICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4biIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJSZXN0b3JlXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJEaXNjb25uZWN0XCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJFeGl0XCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiRXhhbXNcIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIlVzZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXIgYWRkcmVzc1wiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJFeGFtIE5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcInJlZ2lzdGVyXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJyZWdpc3RlcmluZy4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJyZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiZGlzY29ubmVjdGVkXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXIhIFxcblxcblBsZWFzZSB3YWl0IGZvciB0aGUgYWN0aXZhdGlvbiBvZiB0aGUgZXhhbSBtb2RlIGJ5IHRoZSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJzZWFyY2ggc3RhcnRlZFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJ3cm9uZyB1c2VybmFtZSBvciBwaW5cIixcbiAgICAgICAgXCJub3VzZXJcIjpcIm5vIHVzZXJuYW1lIGdpdmVuXCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkZHJlc3NlIG9kZXIgRXhhbW5hbWUgbWlzc2luZ1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJObyBOZXR3b3JrIENvbm5lY3Rpb25cIixcbiAgICAgICAgXCJub3BpblwiOiBcIm5vIHBpbmNvZGUgZ2l2ZW5cIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOlwiU2VydmVyIEFQSSB1bnJlYWNoYWJsZVwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBpcyBiZWhpbmQgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJObyBUZWFjaGVyIEFQSSBmb3VuZCBvbiB0aGUgZ2l2ZW4gYWRkcmVzc1wiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxvY2FsIGxvY2tkb3duXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51YWwgc2VhcmNoXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiTm8gZXhhbXMgZm91bmRcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBsb2dvdXQ/XCIsXG4gICAgICAgIFwiZGVcIjogXCJHZXJtYW5cIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyZW5jaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWFuXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3ZlbmlhblwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFjdGl2YXRlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJQbGVhc2UgY2hvb3NlIGEgbGFuZ3VhZ2VcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiTGFuZ3VhZ2VzXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWNzXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJTZWxlY3QgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiUGxlYXNlIGluc3RhbGwgdGhlIHNhbWUgdmVyc2lvbiBhcyB0aGUgZXhhbSBzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwic2FmZSBleGFtIHN0YXR1cyBjaGFuZ2VkXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJzdGFydGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcInN0b3BwZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJzYWZlIGV4YW0gbW9kZSBub3QgYWN0aXZlXCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJzdHVkZW50IHJlbW92ZWQgZnJvbSBzZXJ2ZXJcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJmaWxlcyBzdG9yZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcImZpbGUgZXJyb3JcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwicGxlYXNlIGNoZWNrIGlmIHRoZSAnRVhBTS1TVFVERU5UJyBkaXJlY3RvcnkgaXMgd3JpdGVhYmxlIGFuZCBoYXMgZW5vdWdoIHNwYWNlXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJBIGxvY2FsIGJhY2t1cCBjb3VsZCBub3QgYmUgY3JlYXRlZC4gUGxlYXNlIHVzZSB0aGUgbWFudWFsIHN1Ym1pc3Npb24gb3B0aW9uLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiZG9uJ3Qgc2hvdyBhZ2FpblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZm91bmRcIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJHZXQgbWF0ZXJpYWxzXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIlNlbmQgZmluYWwgZXhhbVwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiRmluYWwgc3VibWl0XCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxzOlwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2NhbCBmaWxlczpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJVcGRhdGVcIixcbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGxpdHZpZXdcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJZb3UgaGF2ZSBsZWZ0IHRoZSBzYWZlIGV4YW0gbW9kZSFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIlBsZWFzZSBpbmZvcm0gYSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIkRvIHlvdSB3YW50IHRvIHJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhlIGVkaXRvciB3aXRoIHRoZSBjb250ZW50IG9mIFwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcIj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkNhbmNlbFwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlJlcGxhY2VcIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cCBmaWxlIGNvdWxkIG5vdCBiZSByZWFkXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIHN1Y2Nlc3NmdWxseSBsb2FkZWRcIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkVycm9yIGxvYWRpbmcgYmFja3VwIGZpbGVcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIlN1Y2Nlc3NcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcImNoYXJzXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJ3b3Jkc1wiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcInJlY29ubmVjdFwiLFxuICAgICAgICBcInVubG9ja1wiOiBcInVubG9ja1wiLFxuICAgICAgICBcImV4aXRcIjogXCJFeGl0IHNhZmUgZXhhbSBtb2RlP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkRvIG5vdCBsZWF2ZSBzYWZlIGV4YW0gbW9kZSB3aXRob3V0IHBlcm1pc3Npb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIklmIHRoaXMgcHJvY2VzcyBmYWlscyB1bmxvY2sgYW5kIHRyeSBhZ2FpbiFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIkNyZWF0aW5nIGJhY2t1cFwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkNyZWF0aW5nIGJhY2t1cCBhbmQgY2xpcGJvYXJkIGNvcHlcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiTGVhdmluZyBFeGFtIG1vZGVcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJiYWNrdXBcIixcbiAgICAgICAgXCJ1bmRvXCI6XCJ1bmRvXCIsXG4gICAgICAgIFwicmVkb1wiOlwicmVkb1wiLFxuICAgICAgICBcImNsZWFyXCI6XCJjbGVhclwiLFxuICAgICAgICBcImJvbGRcIjpcImJvbGRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcIml0YWxpY1wiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW5kZXJsaW5lXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcImhlYWRpbmcxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcImhlYWRpbmcyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcImhlYWRpbmczXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcImhlYWRpbmc0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcImhlYWRpbmc1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcImhlYWRpbmc2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJzdWJzY3JpcHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwic3VwZXJzY3JpcHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJidWxsZXRsaXN0XCIsXG4gICAgICAgIFwibGlzdFwiOlwibGlzdFwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiY29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiY29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcImJsb2NrcXVvdGVcIixcbiAgICAgICAgXCJsaW5lXCI6XCJwYWdlYnJlYWtcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJsZWZ0XCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJjZW50ZXJcIixcbiAgICAgICAgXCJyaWdodFwiOlwicmlnaHRcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcInRleHRjb2xvclwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwibGluZWJyZWFrXCIsXG4gICAgICAgIFwibW9yZVwiOlwibW9yZVwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJpbnNlcnR0YWJsZVwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJkZWxldGV0YWJsZVwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJjb2x1bW5hZnRlclwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJyb3dhZnRlclwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiZGVsY29sdW1uXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJkZWxyb3dcIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIm1lcmdlb3JzcGxpdFwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiaGVhZGVyY29sdW1uXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJoZWFkZXJyb3dcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwic2VsZWN0ZWQgd29yZHMvY2hhcnNcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwicHJpbnQgcmVxdWVzdCBzZW50XCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwicHJpbnQgcmVxdWVzdCBkZW5pZWRcIixcbiAgICAgICAgXCJwYXN0ZVwiOlwicGFzdGVcIixcbiAgICAgICAgXCJjb3B5XCI6XCJjb3B5XCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcInNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcImRlYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIlJlbG9hZFwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb3VsZCB5b3UgbGlrZSB0byByZWluaXRpYWxpemUgdGhlIEVkaXRvcj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwia2VlcCBjb250ZW50XCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIkluc2VydCBzcGVjaWFsY2hhcmFjdGVyXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiUGxheSBBdWRpb1wiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIkRvIHlvdSB3YW50IHRvIHBsYXkgdGhlIGF1ZGlvZmlsZT9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiUmVtYWluaW5nIHBsYXliYWNrczpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIllvdSBkb24ndCBoYXZlIHRoZSBwZXJtaXNzaW9uIHRvIHBsYXkgdGhpcyBmaWxlIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiSW5zZXJ0IEltYWdlXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJJbnNlcnQgTXVnc2hvdFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIlNlbmQgd29yayB0byB0ZWFjaGVyXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiQ2xvc2VcIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJFeGl0IHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJGaWxlbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIlBsZWFzZSBlbnRlciBvbmx5IGxldHRlcnMgYW5kIG51bWJlcnMgd2l0aG91dCBzcGVjaWFsIGNoYXJhY3RlcnNcIixcbiAgICAgICAgXCJjbGVhclwiOiBcImNsZWFyIGNvbnRlbnQ/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJObyB2YWxpZCBQREYgRmlsZVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJXcm9uZyBwYXNzd29yZFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJSZWxvYWQgd2Vidmlld1wiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJXaWVkZXJoZXJzdGVsbGVuXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJWZXJiaW5kdW5nIHRyZW5uZW5cIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkJlZW5kZW5cIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiQmVudXR6ZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXItQWRyZXNzZVwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiZm9ydGdlc2Nocml0dGVuXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwiZWluZmFjaFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwibWVsZGUgYW4uLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiYW5nZW1lbGRldFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcIlZlcmJpbmR1bmcgdW50ZXJicm9jaGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTaWUgaGFiZW4gc2ljaCBlcmZvbGdyZWljaCBhbSBTZXJ2ZXIgcmVnaXN0cmllcnQhIFxcblxcbkJpdHRlIHdhcnRlbiBTaWUgYXVmIGRpZSBBa3RpdmllcnVuZyBkZXMgUHJcdTAwRkNmdW5nc21vZHVzIGR1cmNoIGRpZSBMZWhycGVyc29uIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJTdWNoZSBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJub3B3XCI6IFwiRmFsc2NoZXIgQmVudXR6ZXJuYW1lIG9kZXIgUGluY29kZVwiLFxuICAgICAgICBcIm5vdXNlclwiOiBcIkJlbnV0emVybmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZHJlc3NlIG9kZXIgUHJcdTAwRkNmdW5nc25hbWUgZmVobHRcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiS2VpbmUgTmV0endlcmt2ZXJiaW5kdW5nXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJQaW5jb2RlIGZlaGx0XCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjogXCJTZXJ2ZXIgQVBJIG5pY2h0IGVycmVpY2hiYXIuXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGJlZmluZGV0IHNpY2ggbVx1MDBGNmdsaWNoZXJ3ZWlzZSBoaW50ZXIgZWluZXIgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJLZWluZSBQclx1MDBGQ2Z1bmdzc2VydmVyIGFuIGFuZ2VnZWJlbmVyIEFkcmVzc2VcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2thbCBhYnNwZXJyZW5cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVlbGwgc3VjaGVuXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiS2VpbmUgUHJcdTAwRkNmdW5nZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgc2ljaCBhYm1lbGRlbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJhbmRlcmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWliaGlsZmVcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJWb3JzY2hsXHUwMEU0Z2UgemVpZ2VuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFNwcmFjaGUgZlx1MDBGQ3IgZGllIFByXHUwMEZDZnVuZ1wiLFxuICAgICAgICBcImxhbmdcIjogXCJTcHJhY2hlblwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGlrXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJQclx1MDBGQ2Z1bmdzbW9kdXMgYXVzd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJCaXR0ZSBpbnN0YWxsaWVyZW4gc2llIGRpZSBzZWxiZSBWZXJzaW9uIHdpZSBhbSBQclx1MDBGQ2Z1bmdzc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCBnXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIGdlXHUwMEU0bmRlcnRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiB1bnRlciBkaWVzZW0gTmFtZW4gYmVyZWl0cyBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgbmljaHQgYWt0aXZcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBlbnRmZXJudFwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcIkRhdGVpZW4gZ2VzcGVpY2hlcnRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBTY2hyZWliZW4gZGVyIERhdGVpXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcIkJpdHRlIHN0ZWxsZW4gU2llIHNpY2hlciwgZGFzcyBkYXMgJ0VYQU0tU1RVREVOVCcgVmVyemVpY2huaXMgZlx1MDBGQ3IgTmV4dC1FeGFtIHNjaHJlaWJiYXIgaXN0IHVuZCBnZW5cdTAwRkNnZW5kIFNwZWljaGVycGxhdHogdm9yaGFuZGVuIGlzdC5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkVpbmUgbG9rYWxlIFNpY2hlcnVuZyBrb25udGUgbmljaHQgZXJzdGVsbHQgd2VyZGVuLiBOdXR6ZW4gU2llIGRpZSBtYW51ZWxsZSBBYmdhYmUgdW0gSWhyZSBBcmJlaXQgZGlyZWt0IGFuIGRpZSBMZWhycGVyc29uIHp1IHNlbmRlbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcIk5pY2h0IG1laHIgYW56ZWlnZW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGdlZnVuZGVuXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW4gaG9sZW5cIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiRmluYWxlIEFiZ2FiZSBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiQWJnYWJlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW46XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiQWt0dWFsaXNpZXJlblwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2thbGUgRGF0ZWllbjpcIixcblxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwYWx0ZW5hbnNpY2h0XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiU2llIGhhYmVuIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHZlcmxhc3NlbiFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIk1lbGRlbiBTaWUgc2ljaCB1bWdlaGVuZCBiZWkgZGVyIEF1ZnNpY2h0c3BlcnNvbiFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJXb2xsZW4gU2llIGRlbiBJbmhhbHQgZGVzIEVkaXRvcnMgZHVyY2ggZGVuIEluaGFsdCBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCJlcnNldHplbj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkFiYnJlY2hlblwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIkVyc2V0emVuXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAtRGF0ZWkga29ubnRlIG5pY2h0IGdlbGVzZW4gd2VyZGVuXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIGVyZm9sZ3JlaWNoIGdlbGFkZW5cIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkZlaGxlciBiZWltIExhZGVuIGRlciBCYWNrdXAtRGF0ZWlcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJFcmZvbGdcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcIlplaWNoZW5cIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIldcdTAwRjZydGVyXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwibmV1IHZlcmJpbmRlblwiLFxuICAgICAgICBcInVubG9ja1wiOiBcImVudHNwZXJyZW5cIixcbiAgICAgICAgXCJleGl0XCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIlZlcmxhc3NlbiBTaWUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgbmllIG9obmUgRnJlaWdhYmUgZWluZXIgTGVocnBlcnNvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiU29sbHRlIGRlciBWb3JnYW5nIGZlaGxzY2hsYWdlbiBiZWVuZGVuIFNpZSBiaXR0ZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB1bmQgdmVyc3VjaGVuIFNpZSBlcyBlcm5ldXQhXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJJaHJlIEFyYmVpdCB3dXJkZSBlcmZvbGdyZWljaCBnZXNpY2hlcnQhXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiRGllIGFrdHVlbGxlIEFyYmVpdCB3aXJkIGdlc2ljaGVydCB1bmQgaW4gZGllIFp3aXNjaGVuYWJsYWdlIGtvcGllcnQhXCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcInNpY2hlcm5cIixcbiAgICAgICAgXCJ1bmRvXCI6XCJyXHUwMEZDY2tnXHUwMEU0bmdpZ1wiLFxuICAgICAgICBcInJlZG9cIjpcIndpZWRlcmhvbGVuXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImJvbGRcIjpcImZldHRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcImt1cnNpdlwiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW50ZXJzdHJpY2hlblwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiXHUwMERDYmVyc2NocmlmdCAyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiXHUwMERDYmVyc2NocmlmdCA1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwidGllZmdlc3RlbGx0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcImhvY2hnZXN0ZWxsdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcInVuZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwibGlzdFwiOlwiZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJDb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJDb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiWml0YXRcIixcbiAgICAgICAgXCJsaW5lXCI6XCJTZWl0ZW51bWJydWNoXCIsXG4gICAgICAgIFwibGVmdFwiOlwiTGlua3NiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcImNlbnRlclwiOlwiWmVudHJpZXJ0XCIsXG4gICAgICAgIFwicmlnaHRcIjpcIlJlY2h0c2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJUZXh0ZmFyYmVcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcIlplaWxlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtZWhyXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcIlRhYmVsbGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJUYWJlbGxlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJTcGFsdGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJSZWloZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJTcGFsdGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJSZWloZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIlZlcmVpbmVuIG9kZXIgVGVpbGVuXCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJUaXRlbHNwYWx0ZVwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiVGl0ZWxyZWloZVwiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJXXHUwMEY2cnRlci9aZWljaGVuIGluIEF1c3dhaGxcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwiRHJ1Y2thbmZyYWdlIGdlc2VuZGV0IVwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcIkRydWNrYW5mcmFnZSBhYmdlbGVobnQuIEJpdHRlIHdhcnRlbiB1bmQgZXJuZXV0IHNlbmRlbi5cIixcbiAgICAgICAgXCJwYXN0ZVwiOlwiZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImNvcHlcIjpcImtvcGllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgZGVha3RpdmllcmVuXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiTmV1IGxhZGVuXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvbGxlbiBTaWUgZGVuIFRleHRlZGl0b3IgbmV1IGluaXRpYWxpc2llcmVuP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJJbmhhbHQgYmVpYmVoYWx0ZW5cIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiU29uZGVyemVpY2hlbiBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJkcnVja2VuXCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJBdWRpbyBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJXb2xsZW4gU2llIGRhcyBIXHUwMEY2cmJlaXNwaWVsIGpldHp0IGFic3BpZWxlbj9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiVmVyYmxlaWJlbmRlIER1cmNobFx1MDBFNHVmZTpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIlNpZSBoYWJlbiBrZWluZSBCZXJlY2h0aWd1bmcgZGllIEF1ZGlvZGF0ZWkgZXJuZXV0IGFienVzcGllbGVuIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiQmlsZCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJNdWdzaG90IGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJBcmJlaXQgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJTY2hsaWVcdTAwREZlblwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkRhdGVpbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBudXIgQnVjaHN0YWJlbiBvZGVyIFphaGxlbiBlaW4uXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJBbGxlIEJlcmVjaG51bmdlbiBsXHUwMEY2c2NoZW4/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgZ1x1MDBGQ2x0aWdlIFBERiBEYXRlaVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJGYWxzY2hlcyBQYXNzd29ydFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJXZWJ2aWV3IG5ldSBsYWRlblwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiTVx1MDBGNmdsaWNoZXJ3ZWlzZSBnZXNjYW5udGVzIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJBdWZcIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcInd1cmRlbiB3ZW5pZ2VyIGFscyAyIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGdlZnVuZGVuLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIkRpZXMgZGV1dGV0IGRhcmF1ZiBoaW4sIGRhc3MgZXMgc2ljaCB1bSBlaW4gZ2VzY2FubnRlcyBQREYgaGFuZGVsdCwgZGFzIGtlaW5lIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgb2RlciBUYWJlbGxlbiBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlZlcnN0YW5kZW5cIixcbiAgICAgICAgXCJwYWdlXCI6IFwiU2VpdGVcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlNlaXRlblwiXG4gICAgfVxufVxuIiwgImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5jb25zdCBwdWJsaWNCYXNlID0gKCkgPT4gKGFwcC5pc1BhY2thZ2VkID8gcGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpIDogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpKTtcblxubGV0IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJyk7XG5sZXQgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihwdWJsaWNCYXNlKCksICdMYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKTtcblxuXG5cblxuXG5jbGFzcyBMYW5ndWFnZVRvb2xTZXJ2ZXIge1xuICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIEluaXRpYWxpc2llcnQgZGllIFByb3plc3N2YXJpYWJsZVxuICAgICAgICAgdGhpcy5wb3J0ID0gODA4OFxuICAgICB9XG4gXG4gICAgIHN0YXJ0U2VydmVyKCkge1xuICAgICAgICAgaWYgKHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyAmJiAhdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcuJyk7XG4gICAgICAgICAgICAgcmV0dXJuOyAvLyBWZXJoaW5kZXJ0IGRhcyBlcm5ldXRlIFN0YXJ0ZW4sIHdlbm4gZGVyIFNlcnZlciBiZXJlaXRzIGxcdTAwRTR1ZnRcbiAgICAgICAgIH1cbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBKcmVIYW5kbGVyLmpTcGF3bihcbiAgICAgICAgICAgICAgICBbbGFuZ3VhZ2VUb29sSmFyUGF0aF0sIC8vIEtsYXNzZW5wZmFkXG4gICAgICAgICAgICAgICAgJ29yZy5sYW5ndWFnZXRvb2wuc2VydmVyLkhUVFBTZXJ2ZXInLCAvLyBIYXVwdGtsYXNzZSBkZXIgTGFuZ3VhZ2VUb29sIEFQSVxuICAgICAgICAgICAgICAgIFsnLS1wb3J0JywgdGhpcy5wb3J0LCctLWNvbmZpZycsbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCwgJy0tYWxsb3ctb3JpZ2luJywgXCInKidcIiBdIC8vIFp1c1x1MDBFNHR6bGljaGUgQXJndW1lbnRlLCB6LkIuIFBvcnQgdW5kIENPUlMtRXJsYXVibmlzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKVxuICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgQVBJIHJ1bm5pbmcgYXQgbG9jYWxob3N0OjgwODgnKTtcblxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIGRhdGEgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGE6IFJlY2VpdmVkIGRhdGEgZnJvbSBMYW5ndWFnZVRvb2wgQVBJJywgZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdlcnJvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1lcnJvcjonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3N0YXJ0aW5nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjaGVjayBkb25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdoYW5kbGVkIHJlcXVlc3QnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gQWNjdW11bGF0ZSBzdGRlcnIgZGF0YSB0byBoYW5kbGUgY2h1bmtlZCBvdXRwdXRcbiAgICAgICAgICAgIGxldCBzdGRlcnJCdWZmZXIgPSAnJztcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydFN0ciA9IFN0cmluZyh0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGJvdGggY3VycmVudCBjaHVuayBhbmQgYWNjdW11bGF0ZWQgYnVmZmVyIGZvciBwb3J0LXJlbGF0ZWQgZXJyb3JzXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFJlc3BvbnNlID0gc3RkZXJyQnVmZmVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUG9ydEVycm9yID0gZnVsbFJlc3BvbnNlLmluY2x1ZGVzKHBvcnRTdHIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZHJlc3NlIHdpcmQgYmVyZWl0cyB2ZXJ3ZW5kZXRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIk1heWJlIHNvbWV0aGluZyBlbHNlIGlzIHJ1bm5pbmcgb24gdGhhdCBwb3J0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZGRyZXNzIGFscmVhZHkgaW4gdXNlXCIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpc1BvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IGFub3RoZXIgTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBwcm9iYWJseSBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydDonLCB0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuay5pbmNsdWRlcygnXFxuJykgfHwgZnVsbFJlc3BvbnNlLmxlbmd0aCA+IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgd2UgaGF2ZSBhIG5ld2xpbmUgKGxpa2VseSBjb21wbGV0ZSBtZXNzYWdlKSBvciBidWZmZXIgaXMgZ2V0dGluZyBsYXJnZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGEtZXJyb3I6JywgZnVsbFJlc3BvbnNlLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgbG9nZ2luZ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGx0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIFNldHp0IGRlbiBQcm96ZXNzIHp1clx1MDBGQ2NrLCB3ZW5uIGVyIGJlZW5kZXQgd2lyZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZ2VuZXJhbC1lcnJvcjonLCBlcnIpO1xuICAgICAgICB9XG5cblxuICAgICB9XG5cbiAgICAgc3RvcFNlcnZlcigpIHtcbiAgICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWRcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKSB7XG4gICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWQsIG5vdGhpbmcgdG8gc3RvcCcpO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGtpbGwgdGhlIHByb2Nlc3MgZGlyZWN0bHkgaWYgd2UgaGF2ZSBhIHJlZmVyZW5jZVxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBraWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZmFpbGVkIHRvIGtpbGwgcHJvY2VzcyBkaXJlY3RseSwgdHJ5aW5nIHBsYXRmb3JtLXNwZWNpZmljIG1ldGhvZDonLCBlcnIpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBwbGF0Zm9ybS1zcGVjaWZpYyBjb21tYW5kcyB0byBraWxsIHRoZSBwcm9jZXNzIChvbmx5IGlmIHdlIGhhZCBhIHByb2Nlc3MgcmVmZXJlbmNlKVxuICAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICAgbGV0IGNvbW1hbmQ7XG5cbiAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgIC8vIFdpbmRvd3M6IGZpbmQgYW5kIGtpbGwgamF2YSBwcm9jZXNzZXMgcnVubmluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB3bWljICh3b3JrcyBvbiBvbGRlciBXaW5kb3dzKSwgdGhlbiB0cnkgUG93ZXJTaGVsbCwgdGhlbiBmYWxsYmFjayB0byBwb3J0LWJhc2VkIGtpbGxcbiAgICAgICAgICAgICBjb21tYW5kID0gYHdtaWMgcHJvY2VzcyB3aGVyZSBcImNvbW1hbmRsaW5lIGxpa2UgJyVsYW5ndWFnZXRvb2wtc2VydmVyLmphciUnXCIgZGVsZXRlIDI+bnVsIHx8IHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyBqYXZhIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHskXy5Db21tYW5kTGluZSAtbGlrZSAnKmxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyKid9IHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZVwiIDI+bnVsIHx8IGZvciAvZiBcInRva2Vucz01XCIgJWEgaW4gKCduZXRzdGF0IC1hbm8gXnwgZmluZHN0ciA6ODA4OCcpIGRvIHRhc2traWxsIC9GIC9QSUQgJWEgMj5udWxgO1xuICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICAgICAvLyBtYWNPUyBhbmQgTGludXg6IHVzZSBwa2lsbCB0byBraWxsIHByb2Nlc3NlcyBtYXRjaGluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIGNvbW1hbmQgPSAncGtpbGwgLWYgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogdW5zdXBwb3J0ZWQgcGxhdGZvcm06JywgcGxhdGZvcm0pO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIC8vIEl0J3Mgb2theSBpZiB0aGUgcHJvY2VzcyBpcyBub3QgZm91bmQgKGFscmVhZHkga2lsbGVkKVxuICAgICAgICAgICAgICAgICAvLyBwa2lsbCByZXR1cm5zIGNvZGUgMSB3aGVuIG5vIHByb2Nlc3MgaXMgZm91bmQsIHdoaWNoIGlzIGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAxICYmICFlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSAmJiAhc3RkZXJyLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ05vIHN1Y2ggcHJvY2VzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZXJyb3Iga2lsbGluZyBMYW5ndWFnZVRvb2wgc2VydmVyOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBub3QgZm91bmQgKG1heSBhbHJlYWR5IGJlIHN0b3BwZWQpJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBzdG9wcGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgfSk7XG4gICAgIH1cbiB9XG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBMYW5ndWFnZVRvb2xTZXJ2ZXIoKVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbiAvLyBldmVyeSBwbGF0Zm9ybSBuZWVkcyBpdCdzIG93biBqcmUgKGxpbnV4LCB3aW4zMiwgZGFyd2luKSAvL2ZpeG1lOiB1c2UgR3JhYWxWTSB0byBwcmVjb21waWxlIGxhbmd1YWdldG9vbCBpbiBvcmRlciB0byBzYXZlIHNwYWNlIGFuZCBnZXQgcmlkIG9mIGpyZT9cbmNsYXNzIEpyZUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHsgfVxuXG4gICAgaW5pdCgpeyBcbiAgICAgICAgdGhpcy5qVGVzdCgpXG4gICAgfVxuXG5cbiAgICBqVGVzdCgpe1xuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpOyAvLyAnL3BmYWQvenVyL2phdmEnXG4gICAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihqYXZhcGF0aCwgWyctdmVyc2lvbiddKTtcbiAgICBcbiAgICAgICAgcHJvYy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTsgLy8gaW4gWmVpbGVuIHNwbGl0dGVuXG4gICAgICAgICAgICBsb2cuZGVidWcoYGpyZS1oYW5kbGVyIEAgalRlc3Q6ICR7bGluZXNbMF19YCk7IC8vIG51ciBkaWUgZXJzdGUgWmVpbGUgbG9nZ2VuXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmYWlsKHJlYXNvbikge1xuICAgICAgICBsb2cuZXJyb3IocmVhc29uKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cblxuICAgIGdldERpcmVjdG9yaWVzKGRpclBhdGgpIHtcbiAgICAgICAgbGV0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKS5maWx0ZXIoXG4gICAgICAgICAgICBmaWxlID0+IGZzLnN0YXRTeW5jKHBhdGguam9pbihkaXJQYXRoLCBmaWxlKSkuaXNEaXJlY3RvcnkoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZGlyc1xuICAgIH0gXG5cbiAgICBkcml2ZXIoKXtcbiAgICAgICAgdmFyIGQgPSBwbGF0Zm9ybURpc3BhdGNoZXIuamF2YUJpbi5zbGljZSgpO1xuICAgICAgICBkLnVuc2hpZnQocGxhdGZvcm1EaXNwYXRjaGVyLmpyZURpcik7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4uYXBwbHkocGF0aCwgZCk7XG4gICAgfVxuXG4gICAgZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBhcmdzID0gKGFyZ3MgfHwgW10pLnNsaWNlKCk7XG4gICAgICAgIGNsYXNzcGF0aCA9IGNsYXNzcGF0aCB8fCBbXTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzbmFtZSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc3BhdGguam9pbih0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JykpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoJy1jcCcpO1xuICAgICAgICByZXR1cm4gYXJncztcbiAgICB9XG5cbiAgICBqU3Bhd24oY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgXG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKClcbiAgICAgICAgbGV0IGphdmFhcmdzID0gdGhpcy5nZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKVxuICAgICAgICBsZXQgamF2YWNtZGxpbmUgPSAgYCR7amF2YXBhdGh9ICR7amF2YWFyZ3Muam9pbignICcpfSBgXG5cbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiAnJHtwbGF0Zm9ybURpc3BhdGNoZXIuanJlfScgc2VsZWN0ZWRgKVxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246IHNwYXduaW5nIGphdmEgcHJvY2VzczogJHtqYXZhY21kbGluZX1gKVxuICAgICAgICByZXR1cm4gc3Bhd24oamF2YXBhdGgsIGphdmFhcmdzLCB7c2hlbGw6ZmFsc2V9KTtcbiAgICAgICAvLyByZXR1cm4gc3Bhd24oamF2YWNtZGxpbmUpO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSnJlSGFuZGxlcigpXG4iLCAiLy8gc2NyaXB0cy9TeXN0ZW1UcmF5TWFuYWdlci5qc1xuaW1wb3J0IHsgYXBwLCBUcmF5LCBNZW51IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnO1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxubGV0IHRyYXkgPSBudWxsO1xuXG4vLyBSZXNvbHZlIGljb24gcGF0aDogcGFja2FnZWQgYXBwIHVzZXMgdW5wYWNrZWQgcHVibGljIGRpciwgZGV2IHVzZXMgcHJvamVjdCBwdWJsaWNcbmZ1bmN0aW9uIGdldFRyYXlJY29uUGF0aCgpIHtcbiAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKTtcbiAgcmV0dXJuIHBhdGguam9pbihwdWJsaWNCYXNlLCAnaWNvbnMnLCAnaWNvbjI0eDI0LnBuZycpO1xufSBcblxuLy8gPT09IHJlcGxhY2UgdGhlIGhlbHBlciBzZXRMb2NhbGUgKGV4YWN0IGJsb2NrKSA9PT1cbmNvbnN0IHNldExvY2FsZSA9IChsb2MpID0+IHtcbiAgICBjb25zdCBnbCA9IGkxOG4uZ2xvYmFsOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IGdsb2JhbCBjb21wb3NlclxuICAgIGlmIChnbCAmJiB0eXBlb2YgZ2wubG9jYWxlID09PSAnb2JqZWN0JyAmJiBnbC5sb2NhbGUpIHtcbiAgICAgIC8vIHZ1ZS1pMThuIGNvbXBvc2l0aW9uIG1vZGVcbiAgICAgIGlmICgndmFsdWUnIGluIGdsLmxvY2FsZSkgZ2wubG9jYWxlLnZhbHVlID0gbG9jOyAgICAgLy8gc2V0IHJlYWN0aXZlIHZhbHVlXG4gICAgICBlbHNlIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGxiYWNrXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGxlZ2FjeSBtb2RlIG9yIHBsYWluIHN0cmluZ1xuICAgICAgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gc3RyaW5nIGxvY2FsZVxuICAgIH1cbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICBcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgdHJheSBpY29uIGlmIGl0IGRvZXNuJ3QgZXhpc3QgYW5kIHVwZGF0ZXMgaXRzIGNvbnRleHQgbWVudS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbmV3IGxvY2FsZSB0byBhcHBseS5cbiAqL1xuXG5cblxuZXhwb3J0IGNvbnN0IHVwZGF0ZVN5c3RlbVRyYXkgPSAobG9jYWxlKSA9PiB7XG4gICAgc2V0TG9jYWxlKGxvY2FsZSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCB0ID0gKGspID0+IGkxOG4uZ2xvYmFsLnQoayk7ICAgICAgICAgICAgICAgICAgICAgIC8vIGFsd2F5cyByZXNvbHZlIGxpdmVcbiAgXG4gICAgaWYgKCF0cmF5KSB7XG4gICAgICB0cmF5ID0gbmV3IFRyYXkoZ2V0VHJheUljb25QYXRoKCkpO1xuICAgICAgdHJheS5vbignY2xpY2snLCAoKSA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9nZ2xlIHdpbmRvd1xuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkgXG4gICAgICAgICAgPyBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaGlkZSgpIFxuICAgICAgICAgIDogV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgXG4gICAgLy8gYnVpbGQgY29udGV4dCBtZW51IHdpdGggY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCBjb250ZXh0TWVudSA9IE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUoW1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LnJlc3RvcmUnKSwgY2xpY2s6ICgpID0+IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCkgfSwgLy8gc2hvdyB3aW5kb3dcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5kaXNjb25uZWN0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy5pbmZvKFwibWFpbiBAIHN5c3RlbXRyYXk6IHJlbW92aW5nIHJlZ2lzdHJhdGlvblwiKTsgXG4gICAgICAgICAgQ29tbUhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCk7IFxuICAgICAgICB9IFxuICAgICAgfSwgLy8gZGlzY29ubmVjdFxuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmV4aXQnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogQ2xvc2luZyBOZXh0LUV4YW1cIik7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIik7IFxuICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyBcbiAgICAgICAgICBhcHAucXVpdCgpOyBcbiAgICAgICAgfSBcbiAgICAgIH0gLy8gZXhpdFxuICAgIF0pO1xuICBcbiAgICB0cmF5LnNldFRvb2xUaXAoJ05leHQtRXhhbSBTdHVkZW50Jyk7ICAgICAgICAgICAgICAgICAgIC8vIHNldCB0b29sdGlwXG4gICAgdHJheS5zZXRDb250ZXh0TWVudShjb250ZXh0TWVudSk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBhcHBseSBtZW51XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIHNjcmlwdCBpcyB1c2VkIHRvIHRlc3QgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gKiBJdCB1c2VzIHRoZSB0Y2N1dGlsIGNvbW1hbmQgdG8gdGVzdCBhbmQgcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gKiBJdCByZXR1cm5zIHRydWUgaWYgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgYXJlIGFsbG93ZWQgYW5kIGZhbHNlIGlmIHRoZXkgYXJlIG5vdFxuICogXG4gKiBUaGlzIGNvdWxkIGFsc28gYmUgdXNlZCB0byB0ZXN0IG90aGVyIHBlcm1pc3Npb25zIGxpa2UgYWNjZXNzaWJpbGl0eSwgc2NyZWVuIGNhcHR1cmUsIGV0Yy4gXG4gKiBzZWUgY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgZm9yIG1vcmUgZGV0YWlscyBvbiBob3cgdG8gdGVzdCBmb3Igc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAoaXRzIG5vdCBwb3NzaWJsZSB0byB0ZXN0IGZvciBzY3JlZW4gY2FwdHVyZSBwZXJtaXNzaW9ucyBvbiBtYWNvcyBiZWNhdXNlIHdpdGhvdXQgcGVybWlzc2lvbnMgaXQgd2lsbCBhbHdheXMgcmV0dXJuIGEgYmxhbmsgc2NyZWVuc2hvdCAtIHdlIHVzZSBhIHdvcmthcm91bmQgdG8gZGV0ZWN0IHRoaXMpXG4gKiBcbiAqL1xuXG5cblxuXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcycgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJ1biB0Y2N1dGlsXG5pbXBvcnQgeyBkaWFsb2csIGFwcCB9IGZyb20gJ2VsZWN0cm9uJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG93IGRpYWxvZyBhbmQgcXVpdFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7ICAgICAgICAgICAgICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBmZXRjaCB3b3Jrc1xuICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3NlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3BvbmdgLCB7IG1ldGhvZDogJ0dFVCcsIGNhY2hlOiAnbm8tc3RvcmUnIH0pIC8vIHRlc3QgcmVxdWVzdFxuICAgICAgICAgICAgcmV0dXJuIHJlcy5va1xuICAgIH0gY2F0Y2ggeyAgcmV0dXJuIGZhbHNlIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc2V0VENDKCkgeyAgICAgIC8vIHJlc2V0IFRDQyBwZXJtaXNzaW9uc1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vYXBwSWRcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLnN0dWRlbnRgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuICAgICAgICAvL2FwcEJ1bmRsZUlkIChzZXQgdmlhIG5vdGFyaXplKVxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0tc3R1ZGVudC5hcHBgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuXG5cbiAgICB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgLy8gY2hlY2sgb3IgcmVzZXRcbiAgICBjb25zdCBvayA9IGF3YWl0IHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydClcbiAgICBpZiAob2spIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTmV0d29yayBhY2Nlc3MgaXMgYWxsb3dlZGApO1xuICAgICAgICAgICAgcmV0dXJuIFwib2tcIjtcbiAgICB9XG4gICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBObyBIVFRQIHJlcXVlc3RzIGFsbG93ZWQhYCApXG5cbiAgICB0cnkge1xuXG4gICAgICAgIC8vIGFzayB0aGUgdXNlcnMgaWYgdGhleSB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9ucyBhbmQgZXhpdCB0aGUgYXBwIGlmIHRoZXkgZG9cbiAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0RlciBTZXJ2ZXIgaXN0IG5pY2h0IGVycmVpY2hiYXIuIE1cdTAwRjZjaHRlbiBTaWUgZGllIEJlcmVjaHRpZ3VuZ2VuIHp1clx1MDBGQ2Nrc2V0emVuIHVuZCBOZXh0LUV4YW0gbWFudWVsbCBuZXUgc3RhcnRlbj8nLFxuICAgICAgICAgICAgYnV0dG9uczogWydPSycsICdBYmJyZWNoZW4nXSxcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGNob2ljZS5yZXNwb25zZSA9PT0gMCkgeyAgICAvLyByZXNldCBwZXJtaXNzaW9ucyBhbmQgcmV0dXJuIHRydWUgdG8gcXVpdCB0aGUgYXBwXG4gICAgICAgICAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IFJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zIGFuZCBxdWl0dGluZyBhcHBgKTtcbiAgICAgICAgICAgIGF3YWl0IHJlc2V0VENDKCk7IFxuICAgICAgICAgICAgcmV0dXJuIFwicmVzZXRcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2UgXG4gICAgICAgIH0gICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiBcbiAgICB9IFxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGxvZy5lcnJvcihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IEVycm9yIHJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zOiAke2V9YCk7XG4gICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ZlaGxlciBiZWltIFp1clx1MDBGQ2Nrc2V0emVuIGRlciBCZXJlY2h0aWd1bmdlbicsXG4gICAgICAgICAgICBkZXRhaWw6IFN0cmluZyhlLmVyciB8fCBlKSxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGZhbHNlICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gICAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBDb3VudGVyIGZvciBmYWlsZWQgYXR0ZW1wdHMgLSBza2lwIGV4ZWN1dGlvbiBhZnRlciA0IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG5sZXQgZmFpbHVyZUNvdW50ZXIgPSAwO1xuY29uc3QgTUFYX0ZBSUxVUkVTID0gMztcblxuLy8gQ29udmVydCBSU1NJIGluIGRCbSB0byBhIHF1YWxpdHkgcGVyY2VudGFnZSBiZXR3ZWVuIDAgYW5kIDEwMC5cbmZ1bmN0aW9uIGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKSB7XG4gICAgaWYgKGRibSA9PT0gbnVsbCB8fCBOdW1iZXIuaXNOYU4oZGJtKSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbWluRGJtID0gLTEwMDtcbiAgICBjb25zdCBtYXhEYm0gPSAtMzA7XG4gICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KG1pbkRibSwgTWF0aC5taW4obWF4RGJtLCBkYm0pKTtcbiAgICBjb25zdCBwZXJjZW50ID0gKChjbGFtcGVkIC0gbWluRGJtKSAvIChtYXhEYm0gLSBtaW5EYm0pKSAqIDEwMDtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChwZXJjZW50KTtcbn1cblxuLyoqXG4gKiBHZXQgY3VycmVudCBXTEFOIGluZm9ybWF0aW9uIChTU0lELCBCU1NJRCwgUXVhbGl0eSlcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtzc2lkOiBzdHJpbmd8bnVsbCwgYnNzaWQ6IHN0cmluZ3xudWxsLCBxdWFsaXR5OiBudW1iZXJ8bnVsbCwgbWVzc2FnZTogc3RyaW5nfG51bGx9Pn1cbiAqIEBkZXNjcmlwdGlvbiBtZXNzYWdlIGNhbiBiZTogXCJlcnJvclwiIChvbiBlcnJvciksIFwibm9pbnRlcmZhY2VcIiAobm8gaW50ZXJmYWNlIGF2YWlsYWJsZSksIFwibm9wZXJtaXNzaW9uc1wiIChsb2NhdGlvbiBwZXJtaXNzaW9ucyBtaXNzaW5nIG9uIFdpbmRvd3MpLCBvciBudWxsIChzdWNjZXNzKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm8oKSB7XG4gICAgLy8gU2tpcCBleGVjdXRpb24gaWYgd2UndmUgaGFkIHRvbyBtYW55IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG4gICAgaWYgKGZhaWx1cmVDb3VudGVyID49IE1BWF9GQUlMVVJFUykge1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHBsYXRmb3JtKSB7XG4gICAgICAgICAgICBjYXNlICdsaW51eCc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9MaW51eCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvV2luZG93cygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb01hY09TKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRW5zdXJlIHJlc3VsdCBpcyBhbHdheXMgYW4gb2JqZWN0XG4gICAgICAgIGlmICghcmVzdWx0IHx8IHR5cGVvZiByZXN1bHQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gUmVzZXQgY291bnRlciBvbiBzdWNjZXNzZnVsIHJlc3VsdCAoaGFzIGRhdGEpXG4gICAgICAgIGlmIChyZXN1bHQuc3NpZCB8fCByZXN1bHQuYnNzaWQgfHwgcmVzdWx0LnF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluY3JlbWVudCBjb3VudGVyIG9uIGZhaWx1cmVcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gUmV0dXJuIGVtcHR5IG9iamVjdCBpbnN0ZWFkIG9mIHRocm93aW5nIHRvIHByZXZlbnQgYXBwIGNyYXNoXG4gICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gTGludXggdXNpbmcgbm1jbGkgKHdpdGggZmFsbGJhY2sgdG8gaXcvaXdjb25maWcpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTGludXgoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IG5tY2xpIGZpcnN0IChtb3N0IGNvbW1vbiBvbiBtb2Rlcm4gTGludXgpXG4gICAgICAgIC8vIEZpcnN0IHRyeSB0byBnZXQgYWN0aXZlIGRldmljZSBkaXJlY3RseSAoZmFzdGVyIHRoYW4gbGlzdGluZyBhbGwgbmV0d29ya3MpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgc3Rkb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKCdubWNsaSAtdCAtZiBhY3RpdmUsc3NpZCxic3NpZCxzaWduYWwgZGV2aWNlIHdpZmkgbGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNDAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGNhdGNoIChleGVjRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBFdmVuIGlmIGV4ZWNBc3luYyB0aHJvd3MgYW4gZXJyb3IsIGNoZWNrIGlmIHN0ZG91dCBjb250YWlucyB2YWxpZCBkYXRhXG4gICAgICAgICAgICAgICAgLy8gbm1jbGkgc29tZXRpbWVzIHJldHVybnMgbm9uLXplcm8gZXhpdCBjb2RlIGJ1dCBzdGlsbCBwcm92aWRlcyB2YWxpZCBvdXRwdXRcbiAgICAgICAgICAgICAgICBpZiAoZXhlY0Vycm9yLnN0ZG91dCAmJiBleGVjRXJyb3Iuc3Rkb3V0LnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ZG91dCA9IGV4ZWNFcnJvci5zdGRvdXQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhlY0Vycm9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG91dHB1dCBmcm9tIG5tY2xpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaW5kIGFjdGl2ZSBjb25uZWN0aW9uXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKTtcbiAgICAgICAgICAgICAgICBpZiAoKHBhcnRzWzBdID09PSAneWVzJyB8fCBwYXJ0c1swXSA9PT0gJ2phJykgJiYgcGFydHMubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHBhcnRzWzFdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAvLyBCU1NJRCBpcyBhIE1BQyBhZGRyZXNzICg2IGhleCBieXRlcyBzZXBhcmF0ZWQgYnkgY29sb25zLCBwb3NzaWJseSBlc2NhcGVkKVxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIHVzaW5nIHJlZ2V4IC0gaGFuZGxlIGVzY2FwZWQgY29sb25zIChcXDopIGFzIHNob3duIGluIG5tY2xpIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAvLyBJbiByZWdleCBzdHJpbmcsIFxcXFw6IG1hdGNoZXMgYSBsaXRlcmFsIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBjb2xvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzpcXFxcOlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlc2NhcGUgYmFja3NsYXNoZXMgYW5kIG5vcm1hbGl6ZSB0byB1cHBlcmNhc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaFswXS5yZXBsYWNlKC9cXFxcOi9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjazogdHJ5IG5vcm1hbCBjb2xvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vcm1hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBub3JtYWxNYXRjaFswXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IHBhcnRzWzJdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpZ25hbCBpcyB0aGUgbGFzdCBudW1lcmljIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsU3RyID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0gPyBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXS50cmltKCkgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gc2lnbmFsU3RyID8gKHBhcnNlSW50KHNpZ25hbFN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKG5tY2xpRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dCwgZXRjLiksIG5vdCBpZiBqdXN0IG5vIFdMQU4gYWN0aXZlXG4gICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgbm1jbGlFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG5tY2xpRXJyb3IubWVzc2FnZSAmJiAhbm1jbGlFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdObyBvdXRwdXQnKSk7XG4gICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IG5tY2xpIGNvbW1hbmQgZmFpbGVkOicsIG5tY2xpRXJyb3IubWVzc2FnZSB8fCBubWNsaUVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gaXcgKGl3Y29uZmlnIGlzIGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1FIFwiXlxccypzc2lkfF5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd2xpbmtTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtQSA1IFwiXlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBTU0lEXG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gaXdTdGRvdXQgPyBpd1N0ZG91dC5tYXRjaCgvc3NpZFxccysoLispLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBzc2lkTWF0Y2ggPyBzc2lkTWF0Y2hbMV0udHJpbSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIGFuZCBzaWduYWwgZnJvbSBsaW5rIGluZm9cbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9hZGRyOlxccysoW2EtZjAtOTpdezE3fSkvaSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL3NpZ25hbDpcXHMrKC0/XFxkKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsRGJtID0gc2lnbmFsTWF0Y2ggPyAocGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgcXVhbGl0eSA9IHNpZ25hbERibSAhPT0gbnVsbCA/IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsRGJtKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoaXdFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yXG4gICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3RXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogaXcgY29tbWFuZCBmYWlsZWQ6JywgaXdFcnJvci5tZXNzYWdlIHx8IGl3RXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGZhbGxiYWNrOiBpd2NvbmZpZyAoZGVwcmVjYXRlZCBidXQgd2lkZWx5IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpd2NvbmZpZyAyPi9kZXYvbnVsbCB8IGdyZXAgLUUgXCJFU1NJRHxBY2Nlc3MgUG9pbnR8U2lnbmFsIGxldmVsXCInLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0VTU0lEOlwiKFteXCJdKylcIi8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNzaWRNYXRjaCkgc3NpZCA9IHNzaWRNYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0FjY2VzcyBQb2ludDpcXHMrKFthLWYwLTk6XXsxN30pL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIGJzc2lkID0gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goL1NpZ25hbCBsZXZlbD0oLT9cXGQrKS8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChpd2NvbmZpZ0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGFsbCBtZXRob2RzIGZhaWxlZCB3aXRoIHJlYWwgZXJyb3JzIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBBbGwgbWV0aG9kcyAobm1jbGksIGl3LCBpd2NvbmZpZykgZmFpbGVkLiBMYXN0IGVycm9yOicsIGl3Y29uZmlnRXJyb3IubWVzc2FnZSB8fCBpd2NvbmZpZ0Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ2Vycm9yJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgbWVzc2FnZTogJ25vaW50ZXJmYWNlJ1xuICAgIH07XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIG5ldHNoXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93cygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHNoIHdsYW4gc2hvdyBpbnRlcmZhY2VzJywge1xuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgc3RkZXJyIGZvciBzZXJ2aWNlIGVycm9yc1xuICAgICAgICBjb25zdCBlcnJvck91dHB1dCA9IChzdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IChzdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkT3V0cHV0ID0gb3V0cHV0ICsgJyAnICsgZXJyb3JPdXRwdXQ7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiBXTEFOIHNlcnZpY2UgaXMgbm90IHJ1bm5pbmcgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbnN2YycpIHx8IFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4gYXV0b2NvbmZpZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYXV0b21hdGlzY2ggd2xhbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbi1rb25maWd1cmF0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3NlcnZpY2UgaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RlciBkaWVuc3QnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIG5vIGludGVyZmFjZXMgYXZhaWxhYmxlXG4gICAgICAgIGlmIChzdGRvdXQuaW5jbHVkZXMoJ1RoZXJlIGlzIG5vIHdpcmVsZXNzIGludGVyZmFjZScpIHx8IFxuICAgICAgICAgICAgc3Rkb3V0LmluY2x1ZGVzKCdFcyBnaWJ0IGtlaW5lIERyYWh0bG9zLVNjaG5pdHRzdGVsbGUnKSB8fFxuICAgICAgICAgICAgc3Rkb3V0Lm1hdGNoKC9ObyB3aXJlbGVzcy9pKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lLmxlbmd0aCA+IDApO1xuICAgICAgICBcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgLy8gU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSwgaGFuZGxlcyB2YXJpb3VzIGZvcm1hdHNcbiAgICAgICAgICAgIC8vIFVzZSBuZWdhdGl2ZSBsb29rYmVoaW5kIHRvIGVuc3VyZSB3ZSBkb24ndCBtYXRjaCBcIkJTU0lEXCIgKHdoaWNoIGNvbnRhaW5zIFwiU1NJRFwiKVxuICAgICAgICAgICAgaWYgKGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6XFxzKiguKykvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBzZXQgaWYgbm90IGVtcHR5IGFuZCBub3QgXCJOL0FcIiBvciBzaW1pbGFyXG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWQgJiYgZXh0cmFjdGVkLmxlbmd0aCA+IDAgJiYgIWV4dHJhY3RlZC5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQgPSBleHRyYWN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBCU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSBwYXR0ZXJuIG1hdGNoaW5nXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9CU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIChoYW5kbGVzIGJvdGggLSBhbmQgOiBzZXBhcmF0b3JzLCB3aXRoIG9yIHdpdGhvdXQgc3BhY2VzKVxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvQlNTSURcXHMqOlxccyooW2EtZjAtOV17Mn0oPzpbLTpcXHNdW2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBtYXRjaFsxXS5yZXBsYWNlKC9bLSBdL2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTaWduYWwgcGFyc2luZyAtIGhhbmRsZSB2YXJpb3VzIGxvY2FsaXplZCBmb3JtYXRzIGFuZCBwYXR0ZXJuc1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvU2lnbmFsfFNpZ25hbHN0XHUwMEU0cmtlfEludGVuc2l0XHUwMEU5fFNlXHUwMEYxYWwvaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgcGVyY2VudGFnZSBwYXR0ZXJuIGZpcnN0IChtb3N0IGNvbW1vbilcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKihcXGQrKVxccyolL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKHBhcnNlZCkgJiYgcGFyc2VkID49IDAgJiYgcGFyc2VkIDw9IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IGRCbSBwYXR0ZXJuIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKigtP1xcZCspXFxzKmRCbS9pKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYm0gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihkYm0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBOb3JtYWxpemUgZW1wdHkgc3RyaW5ncyB0byBudWxsXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiAoc3NpZCAmJiBzc2lkLmxlbmd0aCA+IDApID8gc3NpZCA6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogKGJzc2lkICYmIGJzc2lkLmxlbmd0aCA+IDApID8gYnNzaWQgOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIGVycm9yIGlzIGR1ZSB0byBsb2NhdGlvbiBwZXJtaXNzaW9ucyAobWlnaHQgYmUgaW4gc3RkZXJyIG9yIGVycm9yIG1lc3NhZ2UpXG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IChlcnJvci5tZXNzYWdlIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZG91dCA9IChlcnJvci5zdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3RkZXJyID0gKGVycm9yLnN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRFcnJvck91dHB1dCA9IGVycm9yTWVzc2FnZSArICcgJyArIGVycm9yU3Rkb3V0ICsgJyAnICsgZXJyb3JTdGRlcnI7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgZXJyb3Igd2hlbiBjb21tYW5kIGV4ZWN1dGlvbiBmYWlscyAodGltZW91dCwgcGVybWlzc2lvbiwgZXRjLilcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3M6IEVycm9yIGV4ZWN1dGluZyBuZXRzaCBjb21tYW5kOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbCAoZmFsbGJhY2sgd2hlbiBuZXRzaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgKGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbilcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBhY3RpdmUgV2ktRmkgY29ubmVjdGlvbiBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwb3dlcnNoZWxsIC1Db21tYW5kIFwiJHByb2ZpbGUgPSBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgfCBXaGVyZS1PYmplY3QgeyRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaS1GaSpcXCcgLW9yICRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaXJlbGVzcypcXCd9IHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMTsgaWYgKCRwcm9maWxlKSB7ICRwcm9maWxlLk5hbWUgfVwiJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3NpZFN0ciA9IHNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHNzaWRTdHIgJiYgc3NpZFN0ci5sZW5ndGggPiAwICYmICFzc2lkU3RyLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkU3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQlNTSUQgY2Fubm90IGJlIGVhc2lseSByZXRyaWV2ZWQgd2l0aG91dCBuZXRzaCAod2hpY2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gICAgICAgIC8vIFNldHRpbmcgdG8gbnVsbCBhcyBmYWxsYmFjayAtIFNTSUQgaXMgdGhlIG1vc3QgaW1wb3J0YW50IGluZm9ybWF0aW9uIGFueXdheVxuICAgICAgICBjb25zdCBic3NpZCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgUG93ZXJTaGVsbCBmYWxsYmFjayAoY2FuJ3QgZWFzaWx5IGdldCBzaWduYWwgc3RyZW5ndGggd2l0aG91dCBuZXRzaClcbiAgICAgICAgLy8gUmV0dXJuIG5vcGVybWlzc2lvbnMgbWVzc2FnZSBzbyBmcm9udGVuZCBjYW4gc2hvdyB0aGUgd2FybmluZ1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ25vcGVybWlzc2lvbnMnXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIGVycm9yIGlmIFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbHNcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsOiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxlZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBtYWNPUyB1c2luZyBhaXJwb3J0IG9yIG5ldHdvcmtzZXR1cFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb01hY09TKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBhaXJwb3J0IGNvbW1hbmQgZmlyc3QgKGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBhaXJwb3J0IGlzIGF2YWlsYWJsZSAodXN1YWxseSBhdCAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydClcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBhaXJwb3J0UGF0aCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd3aGljaCBhaXJwb3J0IDI+L2Rldi9udWxsIHx8IGVjaG8gL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMTAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhaXJwb3J0ID0gYWlycG9ydFBhdGgudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGAke2FpcnBvcnR9IC1JYCwge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCByc3NpRGJtID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBzaWduYWxQZXJjZW50ID0gbnVsbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICBzc2lkID0gbGluZS5yZXBsYWNlKCdTU0lEOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ0JTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiB0byBlbnN1cmUgd2UgZ2V0IHRoZSBmdWxsIEJTU0lEXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRDpcXHMqKFthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2FnckN0bFJTU0k6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUlNTSSBpbiBkQm0gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpU3RyID0gbGluZS5yZXBsYWNlKCdhZ3JDdGxSU1NJOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2kgPSByc3NpU3RyID8gKHBhcnNlSW50KHJzc2lTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHJzc2lEYm0gPSByc3NpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdsaW5rIGF1dGg6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWx0ZXJuYXRpdmU6IHNpZ25hbCBzdHJlbmd0aCBhcyBwZXJjZW50YWdlIChpZiBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvKFxcZCspJS8pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2ggJiYgc2lnbmFsUGVyY2VudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbFBlcmNlbnQgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHF1YWxpdHkgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHNpZ25hbFBlcmNlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gc2lnbmFsUGVyY2VudDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocnNzaURibSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KHJzc2lEYm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc3NpZCB8fCBic3NpZCB8fCBxdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGFpcnBvcnRFcnJvcikge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbmV0d29ya3NldHVwIC0gb25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKG5vdCBqdXN0IG5vIHBlcm1pc3Npb24pXG4gICAgICAgICAgICBpZiAoYWlycG9ydEVycm9yLmNvZGUgIT09ICdFTk9FTlQnICYmIGFpcnBvcnRFcnJvci5tZXNzYWdlICYmICFhaXJwb3J0RXJyb3IubWVzc2FnZS5pbmNsdWRlcygncGVybWlzc2lvbicpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBhaXJwb3J0IGNvbW1hbmQgZmFpbGVkOicsIGFpcnBvcnRFcnJvci5tZXNzYWdlIHx8IGFpcnBvcnRFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrOiBuZXR3b3Jrc2V0dXAgYW5kIGlwY29uZmlnIChmb3IgbmV3ZXIgbWFjT1Mgd2hlcmUgYWlycG9ydCBpcyBub3QgYXZhaWxhYmxlKSAgLy8gc3lzdGVtX3Byb2ZpbGVyIGlzIHdheSB0byBoZWF2eSBhbmQgbmVlZHMgYSBsb29vb290IG9mIHRpbWUgdG8gcHJvY2Vzc1xuICAgICAgICAvLyB0aGlzIGlzIGEgc2ltcGxlIGNhbGN1bGF0aW9uLi4gd2UgY2FuJ3QgcmVseSBvbiBhIHByb2Nlc3MgdGhhdCB0YWtlcyAxMHMgdG8gY29tcGxldGUgYW5kIGJsb2NrcyB0aGUgd2hvbGUgc3lzdGVtXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgV0xBTiBpbnRlcmZhY2UgdXNpbmcgbmV0d29ya3NldHVwXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaW50ZXJmYWNlT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHdvcmtzZXR1cCAtbGlzdGFsbGhhcmR3YXJlcG9ydHMgfCBhd2sgXFwnL1dpLUZpfEFpclBvcnQve2dldGxpbmU7IHByaW50ICRORn1cXCcnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gaW50ZXJmYWNlT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFpbnRlcmZhY2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gV2ktRmkgaW50ZXJmYWNlIGZvdW5kXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgYXdrIC1GJyBTU0lEIDogJyAnLyBTU0lEIDogLyB7cHJpbnQgJDJ9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZE91dHB1dC50cmltKCkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWQsIGNvbnRpbnVlIHdpdGggQlNTSURcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IEJTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBic3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgZ3JlcCAnQlNTSUQgOicgfCBhd2sgJ3twcmludCAkM30nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkU3RyID0gYnNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIEJTU0lEIGZvcm1hdCAoTUFDIGFkZHJlc3MpXG4gICAgICAgICAgICAgICAgaWYgKGJzc2lkU3RyICYmIC9eW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9JC9pLnRlc3QoYnNzaWRTdHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRTdHIudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChic3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gQlNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIGZhbGxiYWNrIChhaXJwb3J0IG5vdCBhdmFpbGFibGUsIGNhbid0IGdldCBzaWduYWwgc3RyZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKG5ldHdvcmtzZXR1cEVycm9yKSB7XG4gICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgbmV0d29ya3NldHVwIGZhaWxzIHdpdGggYSByZWFsIGVycm9yXG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IG5ldHdvcmtzZXR1cC9pcGNvbmZpZyBmYWxsYmFjayBmYWlsZWQ6JywgbmV0d29ya3NldHVwRXJyb3IubWVzc2FnZSB8fCBuZXR3b3Jrc2V0dXBFcnJvcik7XG4gICAgICAgICAgICAvLyBJZiBmYWxsYmFjayBjb21wbGV0ZWx5IGZhaWxzLCByZXR1cm4gZXJyb3Igb2JqZWN0XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBnZXRXbGFuSW5mbyB9O1xuXG5cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICd0YXNrbGlzdCAvZm8gY3N2JyAoc3RydWN0dXJlZCBmb3JtYXQsIGZhc3RlciB0aGFuIC92LCBzdGlsbCBzaG93cyBwcm9jZXNzIG5hbWVzKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Rhc2tsaXN0IC9mbyBjc3YnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ25ldHN0YXQgLWFubycgKHNob3dzIGFsbCBjb25uZWN0aW9uIHN0YXRlcyBpbmNsdWRpbmcgRVNUQUJMSVNIRUQgZm9yIHNjcmVlbnNoYXJpbmcgZGV0ZWN0aW9uKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHN0YXQgLWFubycsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBSZWdleCB0byBmaW5kIDpQT1JUIGZvbGxvd2VkIGJ5IGEgc3BhY2UgKGVuc3VyZXMgZXhhY3QgcG9ydCBtYXRjaCwgZS5nLiwgOjU5MzggKVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH1cXFxcc2AsICdnJykgXG4gICAgICBpZiAocmVnZXgudGVzdChzdGRvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywnY29tLm1pY3Jvc29mdC50ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnLFxuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNixcbl1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHdpbiBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcydcbmltcG9ydCAqIGFzIG1hYyBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcydcbmltcG9ydCAqIGFzIGxpbnV4IGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTGluLmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2socGxhdGZvcm0gPSAnd2luMzInKSB7XG4gIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuIGF3YWl0IHdpbi5ydW5SZW1vdGVDaGVjaygpXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHJldHVybiBhd2FpdCBtYWMucnVuUmVtb3RlQ2hlY2soKVxuICByZXR1cm4gYXdhaXQgbGludXgucnVuUmVtb3RlQ2hlY2soKVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gRXhwYW5kZWQgYnJvd3NlciBrZXl3b3JkcyB0byBjYXRjaCBtb3JlIHZhcmlhbnRzXG5jb25zdCBicm93c2VyS2V5d29yZHMgPSBbXG4gICAgJ2Nocm9tJywgJ2Nocm9tZS5leGUnLFxuICAgICdlZGdlJywgJ21zZWRnZS5leGUnLFxuICAgICdmaXJlJywgJ2ZpcmVmb3guZXhlJyxcbiAgICAnYnJhdmUnLCAnYnJhdmUuZXhlJyxcbiAgICAnb3BlcmEnLCAnb3BlcmEuZXhlJyxcbiAgICAnYnJvd3NlcicsIC8vIEdlbmVyaWMgYnJvd3NlciBwcm9jZXNzXG4gICAgJ2lleHBsb3JlJywgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAnc2FmYXJpJywgLy8gRm9yIG1hY09TXG5dO1xuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwuZXhlIC1Ob0xvZ28gLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiYgeyAkcHJvYyA9IEdldC1DaW1JbnN0YW5jZSAtQ2xhc3MgV2luMzJfUHJvY2VzcyAtRmlsdGVyICdQcm9jZXNzSWQ9JHtwaWR9JzsgaWYgKCRwcm9jKSB7ICRwcm9jLlBhcmVudFByb2Nlc3NJZDsgJHByb2MuTmFtZSB9IH1cImA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChsaW5lc1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gbGluZXNbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzOiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBVbml4IHN5c3RlbXMgKExpbnV4L21hY09TKVxuICogVHJpZXMgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QpLCBmYWxscyBiYWNrIHRvIHBzIGNvbW1hbmRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCBtZXRob2QgfjRtcywgbm8gcHJvY2VzcyBzcGF3bilcbiAgICAgICAgY29uc3QgW3N0YXRDb250ZW50LCBjb21tQ29udGVudF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L3N0YXRgLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9jb21tYCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzdGF0Q29udGVudCkge1xuICAgICAgICAgICAgLy8gUGFyc2UgL3Byb2MvcGlkL3N0YXQ6IHBpZCAoY29tbSkgc3RhdGUgcHBpZCAuLi5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRNYXRjaCA9IHN0YXRDb250ZW50Lm1hdGNoKC9eXFxkK1xccytcXCgoW14pXSspXFwpXFxzK1xcUytcXHMrKFxcZCspLyk7XG4gICAgICAgICAgICBpZiAoc3RhdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChjb21tQ29udGVudCB8fCBzdGF0TWF0Y2hbMV0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChzdGF0TWF0Y2hbMl0sIDEwKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIHBzIGNvbW1hbmQgKHdvcmtzIG9uIGJvdGggTGludXggYW5kIG1hY09TKVxuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBzIC1wICR7cGlkfSAtbyBwcGlkPSxjb21tPWA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvVW5peDogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gYmFzZWQgb24gcGxhdGZvcm1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm8ocGlkKSB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuICAgIFxuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCk7XG4gICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fCBwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvVW5peChwaWQpOyAvLyBMaW51eC9tYWNPUzogdHJpZXMgL3Byb2MsIGZhbGxzIGJhY2sgdG8gcHNcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY2hlY2sgcGFyZW50IHByb2Nlc3NlcyBmb3IgYnJvd3NlclxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kUGFyZW50UHJvY2VzcyhwaWQsIG1heERlcHRoLCB2aXNpdGVkUGlkcykge1xuICAgIGlmIChwaWQgPT09IDEgfHwgcGlkID09PSAwKSB7XG4gICAgICAgIGxvZy5pbmZvKCdjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSb290IFBJRCByZWFjaGVkLiBObyB3ZWIgYnJvd3NlciBmb3VuZC4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWF4RGVwdGggPD0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gd2hlbiBtYXggZGVwdGggcmVhY2hlZFxuICAgIH1cbiAgICBcbiAgICBpZiAodmlzaXRlZFBpZHMuaGFzKHBpZCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG4gICAgfVxuICAgIFxuICAgIHZpc2l0ZWRQaWRzLmFkZChwaWQpO1xuICAgIFxuICAgIC8vIEdldCBwcm9jZXNzIGluZm8gKGdldFByb2Nlc3NJbmZvIGFscmVhZHkgaGFzIGl0cyBvd24gdGltZW91dCBwcm90ZWN0aW9uKVxuICAgIGNvbnN0IHByb2Nlc3NJbmZvID0gYXdhaXQgZ2V0UHJvY2Vzc0luZm8ocGlkKTtcbiAgICBcbiAgICBpZiAoIXByb2Nlc3NJbmZvKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgeyBwcGlkLCBuYW1lIH0gPSBwcm9jZXNzSW5mbztcbiAgICBcbiAgICAvLyBMb2cgdGhlIHByb2Nlc3MgaW5mbyBmb3IgZGVidWdnaW5nXG4gICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IENoZWNraW5nIHByb2Nlc3M6ICR7bmFtZX0gKFBJRDogJHtwaWR9LCBQUElEOiAke3BwaWR9KWApO1xuICAgIFxuICAgIC8vIE1vcmUgdGhvcm91Z2ggYnJvd3NlciBkZXRlY3Rpb25cbiAgICBpZiAoYnJvd3NlcktleXdvcmRzLnNvbWUoYnJvd3NlciA9PiBuYW1lLmluY2x1ZGVzKGJyb3dzZXIpKSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQnJvd3NlciBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuaW5jbHVkZXMoJ2V4cGxvcmVyJykgfHwgcHBpZCA8PSAxKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSZWFjaGVkIHN5c3RlbSBwcm9jZXNzIG9yIGV4cGxvcmVyYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHBpZCwgbWF4RGVwdGggLSAxLCB2aXNpdGVkUGlkcyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIHBhcmVudCBwcm9jZXNzIGlzIGEgYnJvd3NlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQYXJlbnRQcm9jZXNzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZvdW5kQnJvd3NlciA9IGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHByb2Nlc3MucHBpZCwgNiwgbmV3IFNldCgpKTtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGRldGVjdGlvbiByZXN1bHQ6ICR7Zm91bmRCcm93c2VyfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBmb3VuZEJyb3dzZXIgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBFcnJvciBpbiBicm93c2VyIGRldGVjdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZm91bmRCcm93c2VyOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICB9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7QUF1QkEsU0FBUyxZQUFBQSxpQkFBZ0I7QUFDekIsT0FBTyxRQUFRO0FBQ2YsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixPQUFPLFNBQVM7OztBQ3RCaEIsSUFBTSxTQUFTO0FBQUEsRUFDWCxhQUFhO0FBQUE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGVBQWU7QUFBQSxFQUNmLGdCQUFnQjtBQUFBLEVBQ2hCLFNBQVM7QUFBQSxFQUVULGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUE7QUFBQSxFQUNmLHFCQUFxQjtBQUFBO0FBQUEs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RUFBQUEsZ0JBQWUsU0FBUyw0QkFBNEIsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUM1RCxFQUFBQSxnQkFBZSxTQUFTLFVBQVUsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUMxQyxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxzQkFBc0IsTUFBTTtBQUFBLEVBQUMsQ0FBQztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxZQUFZLE1BQU07QUFBRyxXQUFPO0FBQUEsRUFBTSxDQUFDO0FBQy9ELENBQUM7IiwKICAibmFtZXMiOiBbImV4ZWNTeW5jIiwgImV4ZWNTeW5jIiwgImxvZyIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJnbG9iYWxTaG9ydGN1dCIsICJUcmF5IiwgIk1lbnUiLCAiZGlhbG9nIiwgImxvZyIsICJsb2ciLCAicGF0aCIsICJmcyIsICJpcCIsICJnYXRld2F5NHN5bmMiLCAiZnMiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgImxvZyIsICJjb25maWdTdG9yZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAibG9nIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAiYXBwc1RvQ2xvc2UiLCAiYXBwIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJsb2ciLCAiYXBwc1RvQ2xvc2UiLCAiY2hpbGRQcm9jZXNzIiwgImFwcCIsICJqb2luIiwgImxvZyIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImxvZyIsICJwYXRoIiwgIl9fZGlybmFtZSIsICJqb2luIiwgImZzIiwgImNvbmZpZyIsICJsb2ciLCAiYXBwIiwgImZzIiwgImpvaW4iLCAic2NyZWVuIiwgImlwY01haW4iLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAid2ViQ29udGVudHMiLCAicGF0aCIsICJmcyIsICJjbGlwYm9hcmQiLCAiYXBwIiwgIm9zIiwgImxvZyIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAiZnMiLCAicGF0aCIsICJwcm9jZXNzIiwgInNwYXduIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInNwYXduIiwgImxvZyIsICJwcm9jZXNzIiwgImZzIiwgInBhdGgiLCAib3MiLCAiX19kaXJuYW1lIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInB1YmxpY0Jhc2UiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgImxvZyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgInJ1blJlbW90ZUNoZWNrIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgInJ1blJlbW90ZUNoZWNrIiwgImFnZW50IiwgImZzIiwgImpvaW4iLCAiaXBjTWFpbiIsICJ3ZWJDb250ZW50cyIsICJzY3JlZW4iLCAiZXJyIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImxvZyIsICJleGVjQXN5bmMiLCAibmFtZSIsICJwcGlkIiwgImFwcCIsICJsb2ciLCAiTWVudSIsICJfX2Rpcm5hbWUiLCAiZnMiLCAicGF0aCIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAid2ViQ29udGVudHMiLCAiQnJvd3NlcldpbmRvdyIsICJldmVudCIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImRpYWxvZyIsICJnbG9iYWxTaG9ydGN1dCJdCn0K
