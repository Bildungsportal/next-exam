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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
    this.easterwin.loadFile(join4(platformDispatcher_default.getPackagedPublicBase(), "cowsonice", "index.html"));
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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
      icon: join4(platformDispatcher_default.getPackagedPublicBase(), "icons", "icon.png"),
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
app9.on("window-all-closed", async () => {
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
  app9.quit();
});
app9.on("will-quit", () => {
  toggleMacOSLockdown2(false);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuZG90ZW52LmNvbmZpZygpO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gV2hlbiBwYWNrYWdlZDogUXVhc2FyIHB1dHMgcHVibGljIGNvbnRlbnRzIGF0IGFwcCByb290OyBvbGQgYnVpbGQgaGFkIHB1YmxpYy8gc3ViZGlyLiBSZXNvbHZlIGF0IHJ1bnRpbWUuXG5mdW5jdGlvbiBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSB7XG4gIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcpO1xuICBjb25zdCB3aXRoUHVibGljID0gam9pbih1bnBhY2tlZCwgJ3B1YmxpYycpO1xuICByZXR1cm4gZnMuZXhpc3RzU3luYyh3aXRoUHVibGljKSA/IHdpdGhQdWJsaWMgOiB1bnBhY2tlZDtcbn1cblxuXG5cbmNsYXNzIFBsYXRmb3JtRGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcblxuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMuYXJjaCA9IHRoaXMuX25vcm1hbGl6ZUFyY2goKTtcbiAgICB0aGlzLmRpc3BsYXlTZXJ2ZXIgPSB0aGlzLl9nZXREaXNwbGF5U2VydmVyKCk7XG4gICAgdGhpcy5pc0tERSA9IHRoaXMuX2lzS0RFKCk7XG4gICAgdGhpcy5pc0dOT01FID0gdGhpcy5faXNHTk9NRSgpO1xuICAgIHRoaXMuZmxhbWVzaG90ID0gdGhpcy5fZ2V0VmVyc2lvbignZmxhbWVzaG90Jyk7XG4gICAgdGhpcy5pbWFnZW1hZ2ljayA9IHRoaXMuX2dldFZlcnNpb24oJ2NvbnZlcnQnKTtcbiAgICB0aGlzLmltVmVyc2lvbiA9IHRoaXMuX2dldEltYWdlTWFnaWNrVmVyc2lvbigpO1xuICAgIHRoaXMud29ya2VyRmlsZU5hbWUgPSB0aGlzLl9nZXRXb3JrZXJGaWxlTmFtZSgpO1xuICAgIHRoaXMudXNlV29ya2VyID0gdGhpcy5fZ2V0VXNlV29ya2VyKCk7XG4gICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IHRoaXMuX2dldFNjcmVlbnNob3RBYmlsaXR5KCk7XG4gICAgdGhpcy5qcmUgPSB0aGlzLl9kZXRlY3RKUkVJZCgpO1xuICAgIHRoaXMuanJlRGlyID0gdGhpcy5fcmVzb2x2ZUpSRURpcigpO1xuICAgIHRoaXMuamF2YUJpbiA9IHRoaXMuX3Jlc29sdmVKYXZhQmluKCk7XG4gICAgdGhpcy5qcmVJbmZvID0gdGhpcy5fZ2V0SlJFKCk7XG4gICAgXG4gICAgdGhpcy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpO1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICAgIHRoaXMud29ya2VyVVJMID0gdGhpcy5fZ2V0V29ya2VyVVJMKCk7XG4gICAgdGhpcy50ZW1wZGlyZWN0b3J5ID0gdGhpcy5fZ2V0VGVtcGRpcmVjdG9yeSgpO1xuICAgIHRoaXMud29ya2RpcmVjdG9yeSA9IHRoaXMuX2dldFdvcmtkaXJlY3RvcnkoKTtcbiAgICB0aGlzLmxvZ2ZpbGUgPSB0aGlzLl9nZXRMb2dmaWxlKCk7XG5cbiAgfVxuXG4gIF9nZXRXb3JrZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKHRoaXMuaG9tZWRpcmVjdG9yeSwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7XG4gIH1cblxuICBfZ2V0VGVtcGRpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbihvcy50bXBkaXIoKSwgJ2V4YW0tdG1wJyk7XG4gIH1cblxuXG4gIF9nZXRMb2dmaWxlKCkge1xuICAgIHJldHVybiBqb2luKHRoaXMud29ya2RpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpO1xuICB9XG5cbiAgX25vcm1hbGl6ZUFyY2goKSB7XG4gICAgaWYgKHRoaXMuX2FyY2ggPT09ICdpYTMyJykgcmV0dXJuICdpNTg2JztcbiAgICBpZiAoWyd4NjQnLCAnYXJtNjQnXS5pbmNsdWRlcyh0aGlzLl9hcmNoKSkgcmV0dXJuIHRoaXMuX2FyY2g7XG4gICAgdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlOiAke3RoaXMuX2FyY2h9YCk7XG4gIH1cblxuICBfZGV0ZWN0SlJFSWQoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHJldHVybiAnbWluaW1hbC1qcmUtMTEtbGluJztcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgcmV0dXJuIHRoaXMuX2FyY2ggPT09ICdhcm02NCcgPyAnbWluaW1hbC1qcmUtMTEtbWFjLWFybTY0JyA6ICdtaW5pbWFsLWpyZS0xMS1tYWMnO1xuICAgIH1cbiAgfVxuXG5cblxuXG5cbiAgLyoqXG4gICAqIFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBAZGVzY3JpcHRpb24gdGhpcyBmdW5jdGlvbiByZXNvbHZlcyB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBpdCBmaXJzdCBjaGVja3MgaWYgdGhlIHVzZUJ1bmRsZWRKUkUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0IHRvIHRydWVcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IGNoZWNrcyBpZiB0aGUgc3lzdGVtIGpyZSBpcyBpbnN0YWxsZWRcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIHN5c3RlbSBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIHRoZSBidW5kbGVkIGpyZSBpcyBsb2NhdGVkIGluIHRoZSBwdWJsaWMgZGlyZWN0b3J5IG9mIHRoZSBhcHBcbiAgICogXG4gICAqIEZJWE1FOiBpZiBzeXN0ZW0ganJlIGlzIHNlbGVjdGVkIGJ5IEVOViBkbyBub3QgaW5jbHVkZSB0aGUganJlIGRpcmVjdG9yeSBpbiB0aGUgZmluYWwgYnVpbGRcbiAgICovXG5cbiAgX3Jlc29sdmVKUkVEaXIoKSB7XG4gICAgLy8gdXNlIGJ1bmRsZWQganJlIGJlY2F1c2UgaXRzIHNtYWxsZXIgYW5kIHByb3ZpZGVzIG9ubHkgdGhlIG5lZWRlZCBqYXZhIG1vZHVsZXNcbiAgICBpZiAoY29uZmlnLnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICBjb25zdCBiYXNlID0gZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKGJhc2UsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKGJhc2UsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgdGhpcy5qcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9yZXNvbHZlSmF2YUJpbigpIHtcbiAgICBzd2l0Y2ggKHRoaXMucGxhdGZvcm0pIHtcbiAgICAgIGNhc2UgJ2Rhcndpbic6IHJldHVybiBbJ2JpbicsICdqYXZhJ107XG4gICAgICBjYXNlICd3aW4zMic6IHJldHVybiBbJ2JpbicsICdqYXZhdy5leGUnXTtcbiAgICAgIGNhc2UgJ2xpbnV4JzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGRlZmF1bHQ6IHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3RoaXMucGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gIT09ICdsaW51eCcpIHJldHVybiAnbi9hJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJykgcmV0dXJuICd3YXlsYW5kJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd4MTEnIHx8IHRoaXMuX2Vudi5ESVNQTEFZKSByZXR1cm4gJ3gxMSc7XG4gICAgcmV0dXJuICd1bmtub3duJztcbiAgfVxuXG4gIF9nZXRWZXJzaW9uKGNtZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYyhgJHtjbWR9IC0tdmVyc2lvbmAsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS5zcGxpdCgnXFxuJylbMF07XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC9bXFxkXSsoXFwuW1xcZF0rKSsvKTtcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uOiB2ZXJzaW9uPy5bMF0gfHwgJ3Vua25vd24nIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0SlJFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYygnamF2YSAtdmVyc2lvbicsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAnaWdub3JlJywgJ3BpcGUnXSB9KTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL3ZlcnNpb24gXCIoW1xcZC5fXSspXCIvKT8uWzFdIHx8ICd1bmtub3duJztcbiAgICAgIGNvbnN0IGphdmFIb21lID0gdGhpcy5fZW52LkpBVkFfSE9NRSB8fCAnJztcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uLCBwYXRoOiBqYXZhSG9tZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsLCBwYXRoOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldFdvcmtlckZpbGVOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLnBsYXRmb3JtID09PSAnbGludXgnID8gJ2ltYWdlV29ya2VyTGludXgubWpzJyA6ICdpbWFnZVdvcmtlclNoYXJwLm1qcyc7XG4gIH1cblxuICBfZ2V0V29ya2VyVVJMKCkge1xuICAgIGNvbnN0IGJhc2VEaXIgPSBhcHAuaXNQYWNrYWdlZCA/IGdldFBhY2thZ2VkUHVibGljQmFzZSgpIDogam9pbihpbXBvcnQubWV0YS5kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4oYmFzZURpciwgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwod29ya2VyUGF0aCk7XG4gIH1cblxuICBpc1dheWxhbmQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7XG4gIH1cblxuICBfaXNLREUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgcmV0dXJuIG91dCA9PT0gJ0tERSc7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNLREU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzR05PTUUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCdnbm9tZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzR05PTUU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzVU5JVFkoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCd1bml0eScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNVTklUWTogbm8gZGF0YVwiLCBlcnIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mbGFtZXNob3RBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwid2hpY2ggZmxhbWVzaG90XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZmxhbWVzaG90QXZhaWxhYmxlOiBGbGFtZXNob3Qgbm90IGZvdW5kXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9zZXR1cERlc2t0b3BQYXRoKCkge1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICB9XG5cbiAgX2dldERlc2t0b3BQYXRoKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTY3JlZW5zaG90QWJpbGl0eSgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgaWYgKCh0aGlzLl9pc0dOT01FKCkgfHwgdGhpcy5faXNVTklUWSgpKSAmJiB0aGlzLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogR05PTUUvVW5pdHkgKyBXYXlsYW5kIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2VcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNLREUoKSAmJiB0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMuX2ZsYW1lc2hvdEF2YWlsYWJsZSgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogS0RFL1dheWxhbmQgKyBGbGFtZXNob3QgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy51c2VXb3JrZXIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBYMTEgKyBJbWFnZU1hZ2ljayBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2UgXHUyMDEzIGZhbGxiYWNrIHRvIHBhZ2VjYXB0dXJlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXNvbHZlZCBiYXNlIHBhdGggZm9yIHB1YmxpYyBhc3NldHMgd2hlbiBwYWNrYWdlZCAoUXVhc2FyOiBhcHAgcm9vdDsgb2xkIGJ1aWxkOiBhcHAuYXNhci51bnBhY2tlZC9wdWJsaWMpLiBJbiBkZXYgcmV0dXJucyBwcm9qZWN0IHB1YmxpYyBkaXIuICovXG4gIGdldFBhY2thZ2VkUHVibGljQmFzZSgpIHtcbiAgICByZXR1cm4gYXBwLmlzUGFja2FnZWQgPyBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSA6IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgdXNlQnVuZGxlZEpSRTogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBEZW1vOiBmYWxzZSxcblxuICAgIHdvcmtkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgIHRlbXBkaXJlY3RvcnkgOiBcIlwiLCAgIC8vIChkZXNrdG9wIHBhdGggKyAndG1wJylcbiAgICBob21lZGlyZWN0b3J5IDogXCJcIiwgICAvLyBzZXQgaW4gbWFpbi50c1xuICAgIGV4YW1kaXJlY3RvcnkgOiBcIlwiLCAgICAvLyBzZXQgYWZ0ZXIgcmVnaXN0ZXJpbmcgaW4gaXBjSGFuZGxlclxuICAgIGNsaWVudGRpcmVjdG9yeTogJ0VYQU0tU1RVREVOVCcsXG5cbiAgICBzZXJ2ZXJBcGlQb3J0OiAyMjQyMiwgIC8vIHRoaXMgaXMgbmVlZGVkIHRvIGJlIHJlYWNoYWJsZSBvbiB0aGUgdGVhY2hlcnMgcGMgZm9yIGJhc2ljIGZ1bmN0aW9uYWxpdHlcbiAgICBtdWx0aWNhc3RDbGllbnRQb3J0OiA2MDI0LCAgLy8gb25seSBuZWVkZWQgZm9yIGV4YW0gYXV0b2Rpc2NvdmVyeVxuXG4gICAgbXVsdGljYXN0U2VydmVyQWRycjogJzIzOS4yNTUuMjU1LjI1MCcsXG4gICAgaG9zdGlwOiBcIlwiLCAgICAgICAvLyBzZXJ2ZXIuanNcbiAgICBnYXRld2F5OiB0cnVlLFxuICAgIHZpcnR1YWxpemVkOiBmYWxzZSxcbiAgICBpc1B1YXZvOiBmYWxzZSxcbiAgICBcbiAgICB2ZXJzaW9uOiAnMi4wLjAuMScsXG4gICAgYnVpbGREYXRlOiAnMjAyNjAyMDQnLFxuICAgIGJ1aWxkTnVtYmVyOiAnMScsXG4gICAgaW5mbzogJ1JlbGVhc2UnXG59XG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgaXMgdGhlIEVMRUNUUk9OIG1haW4gZmlsZSB0aGF0IGFjdHVhbGx5IG9wZW5zIHRoZSBlbGVjdHJvbiB3aW5kb3dcbiAqL1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgcG93ZXJTYXZlQmxvY2tlciwgbmF0aXZlVGhlbWUsIGdsb2JhbFNob3J0Y3V0LCBUcmF5LCBNZW51LCBkaWFsb2csIHNlc3Npb259IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuL21haW4vY29uZmlnLmpzJztcbmltcG9ydCBtdWx0aWNhc3RDbGllbnQgZnJvbSAnLi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCAqIGFzIGZzRXh0cmEgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IHsgZ2F0ZXdheTRzeW5jIH0gZnJvbSAnZGVmYXVsdC1nYXRld2F5JztcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgQ29tbUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3RyYXltZW51LmpzJ1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgY2hlY2tQYXJlbnRQcm9jZXNzIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMnO1xuXG5pbXBvcnQgeyB0b2dnbGVNYWNPU0xvY2tkb3duIH0gZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnXG5KcmVIYW5kbGVyLmluaXQoKVxuXG5cblxuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnbGFuZycsICdkZScpO1xuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLXVuc2FmZS1zd2lmdHNoYWRlcicpO1xuYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnbG9nLWxldmVsJywgJzMnKTsgLy8gMyA9IFdBUk4sIDIgPSBFUlJPUiwgMSA9IElORk9cblxuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpe1xuICAgIGFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2Rpc2FibGUtZmVhdHVyZXMnLCAnVmFhcGlWaWRlb0RlY29kZXIsT3V0T2ZQcm9jZXNzUmFzdGVyaXphdGlvbixDYW52YXNPb3BSYXN0ZXJpemF0aW9uJyk7IC8vIGRpc2FibGUgZnJhZ2lsZSBHUFUgZmVhdHVyZXNcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLXplcm8tY29weScpOyBcbn1cbmVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdlbmFibGUtZmVhdHVyZXMnLCAnTWV0YWwsQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAgLy8gbWFjb3Mgb25seVxufVxuXG5cblxuXG5cbmxvZy5pbml0aWFsaXplKCk7IC8vIGluaXRpYWxpemUgdGhlIGxvZ2dlciBmb3IgYW55IHJlbmRlcmVyIHByb2Nlc3NcbmxvZy5ldmVudExvZ2dlci5zdGFydExvZ2dpbmcoKTtcbmxvZy5lcnJvckhhbmRsZXIuc3RhcnRDYXRjaGluZygpO1xubG9nLnRyYW5zcG9ydHMuZmlsZS5yZXNvbHZlUGF0aEZuID0gKCkgPT4geyByZXR1cm4gcGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGUgIH1cblxubG9nLnRyYW5zcG9ydHMuY29uc29sZS5mb3JtYXQgPSAobWVzc2FnZSkgPT4ge1xuICAgIC8vIEFsd2F5cyByZXR1cm4gYW4gYXJyYXksIG5vdCBzdHJpbmdzIVxuICAgIHN3aXRjaCAobWVzc2FnZS5sZXZlbCkge1xuICAgICAgY2FzZSAnaW5mbyc6IHJldHVybiBbY2hhbGsuZ3JlZW4obWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ3dhcm4nOiByZXR1cm4gW2NoYWxrLnllbGxvdyhtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnZXJyb3InOiByZXR1cm4gW2NoYWxrLnJlZChtZXNzYWdlLmRhdGEuam9pbiA/IG1lc3NhZ2UuZGF0YS5qb2luKCcgJykgOiBTdHJpbmcobWVzc2FnZS5kYXRhKSldO1xuICAgICAgY2FzZSAnZGVidWcnOiByZXR1cm4gW2NoYWxrLmJsdWUobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ3ZlcmJvc2UnOiByZXR1cm4gW2NoYWxrLm1hZ2VudGEobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGRlZmF1bHQ6ICAgICByZXR1cm4gW1N0cmluZyhtZXNzYWdlLmRhdGEpXTtcbiAgICB9XG59O1xuXG5sb2cudmVyYm9zZSgpXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cudmVyYm9zZShgbWFpbjogc3RhcnRpbmcgTmV4dC1FeGFtIFN0dWRlbnQgXCIke2NvbmZpZy52ZXJzaW9ufSAke2NvbmZpZy5pbmZvfVwiICgke3Byb2Nlc3MucGxhdGZvcm19KSR7Y29uZmlnLmRldmVsb3BtZW50ID8gJyAoZGV2bW9kZSBvbiknIDogJyd9YClcbmxvZy52ZXJib3NlKGBtYWluOiAtLS0tLS0tLS0tLS0tLS0tLS0tYClcbmxvZy5pbmZvKGBtYWluOiBMb2dmaWxlbG9jYXRpb24gYXQgJHtwbGF0Zm9ybURpc3BhdGNoZXIubG9nZmlsZX1gKVxucGxhdGZvcm1EaXNwYXRjaGVyLm1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7IGxvZy5kZWJ1ZyhtZXNzYWdlKSB9KTtcblxuLy8gbG9nIGVsZWN0cm9uIHZlcnNpb24gYW5kIG90aGVyIHBsYXRmb3JtIGluZm9ybWF0aW9uXG5sb2cuZGVidWcoYG1haW46IEVsZWN0cm9uIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5lbGVjdHJvbn1gKVxubG9nLmRlYnVnKGBtYWluOiBDaHJvbWl1bSB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuY2hyb21lfWApXG5sb2cuZGVidWcoYG1haW46IE5vZGUgdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLm5vZGV9YClcbmxvZy5kZWJ1ZyhgbWFpbjogVjggdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLnY4fWApXG5sb2cuZGVidWcoYG1haW46IE9TOiAke3Byb2Nlc3MucGxhdGZvcm19ICR7cHJvY2Vzcy5hcmNofWApXG5sb2cuZGVidWcoYG1haW46IEFyY2g6ICR7cHJvY2Vzcy5hcmNofWApXG5cblxuV2luZG93SGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgLy8gbWFpbndpbmRvdywgZXhhbXdpbmRvdywgYmxvY2t3aW5kb3dcbkNvbW1IYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcpICAgIC8vIHN0YXJ0cyBcImJlYWNvblwiIGludGVydmFsbCBhbmQgZmV0Y2hlcyBpbmZvcm1hdGlvbiBmcm9tIHRoZSB0ZWFjaGVyIC0gYWN0cyBvbiBpdCAoc3RhcnRleGFtLCBzdG9wZXhhbSwgc2VuZGZpbGUsIGdldGZpbGUpXG5JcGNIYW5kbGVyLmluaXQobXVsdGljYXN0Q2xpZW50LCBjb25maWcsIFdpbmRvd0hhbmRsZXIsIENvbW1IYW5kbGVyKSAgLy9jb250cm9sbCBhbGwgSW50ZXIgUHJvY2VzcyBDb21tdW5pY2F0aW9uXG5cbi8vIFByZXZlbnRzIEVsZWN0cm9uIGZyb20gY3JlYXRpbmcgdGhlIGRlZmF1bHQgbWVudVxuTWVudS5zZXRBcHBsaWNhdGlvbk1lbnUobnVsbCk7XG5cblxuaWYgKCFhcHAucmVxdWVzdFNpbmdsZUluc3RhbmNlTG9jaygpKSB7ICAvLyBhbGxvdyBvbmx5IG9uZSBpbnN0YW5jZSBvZiB0aGUgYXBwIHBlciBjbGllbnRcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogbmV4dC1leGFtIGFscmVhZHkgcnVubmluZy5cIilcbiAgICBhcHAucXVpdCgpXG4gICAgcHJvY2Vzcy5leGl0KDApXG59XG5cbmFwcC5vbignc2Vjb25kLWluc3RhbmNlJywgKCkgPT4ge1xuICAgIGxvZy53YXJuKFwibWFpbiBAIHNpbmdsZWluc3RhbmNlOiBwcmV2ZW50ZWQgc2Vjb25kIHN0YXJ0IG9mIG5leHQtZXhhbS4gUmVzdG9yaW5nIGV4aXN0aW5nIE5leHQtRXhhbSB3aW5kb3cuXCIpXG4gICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdykge1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzTWluaW1pemVkKCkgfHwgIVdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKVxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LnJlc3RvcmUoKVxuICAgICAgICB9IFxuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuZm9jdXMoKSAvLyBGb2N1cyBvbiB0aGUgbWFpbiB3aW5kb3cgaWYgdGhlIHVzZXIgdHJpZWQgdG8gb3BlbiBhbm90aGVyXG4gICAgfVxufSlcblxuXG4vKipcbiAqIGFkZGl0aW9uYWwgY29uZmlnIHNldHRpbmdzIGFuZCBwYXRoIGNoZWNrc1xuICovXG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNvbmZpZy5ob21lZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnk7XG5jb25maWcud29ya2RpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZGlyZWN0b3J5O1xuY29uZmlnLnRlbXBkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeTtcbmNvbmZpZy5leGFtZGlyZWN0b3J5ID0gY29uZmlnLndvcmtkaXJlY3RvcnkgICAgLy8gd2UgbmVlZCB0aGlzIHZhcmlhYmxlIHNldHVwIGV2ZW4gaWYgd2UgZG8gbm90IGNvbm5lY3QgdG8gYSB0ZWFjaGVyIGluc3RhbmNlXG5cblxuaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZy53b3JrZGlyZWN0b3J5KSl7IGZzLm1rZGlyU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH1cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoKSkgeyAgZnMubWtkaXJTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIENoZWNrIGlmIHRoZSBkZXNrdG9wIGZvbGRlciBleGlzdHMgYW5kIGNyZWF0ZSBpZiBpdCBkb2Vzbid0XG5cbi8vIENyZWF0ZSB0aGUgc3ltYm9saWMgbGluayB0byB0aGUgd29ya2RpcmVjdG9yeSBvbiB0aGUgZGVza3RvcFxuY29uc3QgbGlua1BhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmRlc2t0b3BQYXRoLCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTsgIC8vIERlZmluZSB0aGUgcGF0aCBmb3IgdGhlIHN5bWJvbGljIGxpbmtcbnRyeSB7ZnMudW5saW5rU3luYyhsaW5rUGF0aCkgfWNhdGNoKGUpe31cbnRyeSB7ICAgaWYgKCFmcy5leGlzdHNTeW5jKGxpbmtQYXRoKSkgeyBmcy5zeW1saW5rU3luYyhjb25maWcud29ya2RpcmVjdG9yeSwgbGlua1BhdGgsICdqdW5jdGlvbicpOyB9fVxuY2F0Y2goZSl7bG9nLmVycm9yKFwibWFpbiBAIGNyZWF0ZS1zeW1saW5rOiBjYW4ndCBjcmVhdGUgc3ltbGlua1wiKX1cblxuXG50cnkgeyAvL2JpbmQgdG8gdGhlIGNvcnJlY3QgaW50ZXJmYWNlXG4gICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlfSA9IGdhdGV3YXk0c3luYygpOyBcbiAgICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcyhpZmFjZSkgICAgLy8gdGhpcyByZXR1cm5zIHRoZSBpcCBvZiB0aGUgaW50ZXJmYWNlIHRoYXQgaGFzIGEgZGVmYXVsdCBnYXRld2F5Li4gIHNob3VsZCB3b3JrIGluIE1PU1QgY2FzZXMuICBwcm9iYWJseSBwcm92aWRlIFwiaXAtb3B0aW9uc1wiIGluIFVJID9cbiAgICBjb25maWcuZ2F0ZXdheSA9IHRydWVcbn1cbiBjYXRjaCAoZSkge1xuICAgbG9nLmVycm9yKFwibWFpbiBAIGdhdGV3YXk0c3luYzogdW5hYmxlIHRvIGRldGVybWluZSBkZWZhdWx0IGdhdGV3YXlcIilcbiAgIGNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCkgXG4gICBsb2cuaW5mbyhgbWFpbjogSVAgJHtjb25maWcuaG9zdGlwfWApXG4gICBjb25maWcuZ2F0ZXdheSA9IGZhbHNlXG4gfVxuXG5cbmZzRXh0cmEuZW1wdHlEaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5KSAgLy8gY2xlYW4gdGVtcCBkaXJlY3RvcnlcblxuXG5cblxuXG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHNwZWNpZmljYWxseSBjaGVja3MgZm9yIEVQSVBFIGVycm9ycyBhbmQgZGlzYWJsZXMgdGhlIGNvbnNvbGUgdHJhbnNwb3J0IGZvciB0aGUgRWxlY3Ryb25Mb2dnZXIgaWYgc3VjaCBhbiBlcnJvciBvY2N1cnMuXG4gKiBFUElQRSBlcnJvcnMgdHlwaWNhbGx5IGhhcHBlbiB3aGVuIHRyeWluZyB0byB3cml0ZSB0byBhIGNsb3NlZCBwaXBlLCB3aGljaCBjYW4gb2NjdXIgaWYgdGhlIHN0ZG91dCBzdHJlYW0gaXMgdW5leHBlY3RlZGx5IGNsb3NlZC5cbiAqL1xucHJvY2Vzcy5zdGRvdXQub24oJ2Vycm9yJywgKGVycikgPT4geyBpZiAoZXJyLmNvZGUgPT09ICdFUElQRScpIHsgbG9nLnRyYW5zcG9ydHMuY29uc29sZS5sZXZlbCA9IGZhbHNlIH0gfSk7XG5cbi8vIEZpbHRlciBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgYW5kIFdlYkNvbnRlbnRzIHN1YmZyYW1lIGVycm9ycyBmcm9tIHN0ZGVyci9zdGRvdXRcbmNvbnN0IG9yaWdpbmFsU3RkZXJyV3JpdGUgPSBwcm9jZXNzLnN0ZGVyci53cml0ZTtcbmNvbnN0IG9yaWdpbmFsU3Rkb3V0V3JpdGUgPSBwcm9jZXNzLnN0ZG91dC53cml0ZTtcblxucHJvY2Vzcy5zdGRlcnIud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRlcnJXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5zdGRvdXQud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGZkKSB7XG4gICAgY29uc3QgY2h1bmtTdHIgPSBjaHVuaz8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAvLyBTdXBwcmVzcyBHVUVTVF9WSUVXX01BTkFHRVJfQ0FMTCBlcnJvcnMgKEVSUl9BQk9SVEVEIGZyb20gd2VidmlldyBuYXZpZ2F0aW9uIGJsb2NraW5nKVxuICAgIGlmIChjaHVua1N0ci5pbmNsdWRlcygnR1VFU1RfVklFV19NQU5BR0VSX0NBTEwnKSAmJiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0VSUl9BQk9SVEVEJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJygtMyknKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIERyb3AgdGhpcyBlcnJvclxuICAgIH1cbiAgICAvLyBTdXBwcmVzcyBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnNcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLWxvYWQnKSB8fCBjaHVua1N0ci5pbmNsdWRlcygnV2ViQ29udGVudHMjZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcpKSB7XG4gICAgICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuICAgICAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ2lzTWFpbkZyYW1lOiBmYWxzZScpIHx8IHN1cHByZXNzQ29kZXMuc29tZShjb2RlID0+IGNodW5rU3RyLmluY2x1ZGVzKGBlcnJvckNvZGU6ICR7Y29kZX1gKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxTdGRvdXRXcml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxucHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyKSA9PiB7XG4gICAgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7XG4gICAgICAgIGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZTtcbiAgICAgICAgbG9nLndhcm4oJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjogRVBJUEUgRXJyb3I6IFRoZSBzdGRvdXQgc3RyZWFtIG9mIHRoZSBFbGVjdHJvbkxvZ2dlciB3aWxsIGJlIGRpc2FibGVkLicpO1xuICAgIH0gXG4gICAgZWxzZSBpZiAoZXJyLm1lc3NhZ2U/LmluY2x1ZGVzKCdSZW5kZXIgZnJhbWUgd2FzIGRpc3Bvc2VkJykpIHJldHVybjtcbiAgICBlbHNlIHsgIGxvZy5lcnJvcignbWFpbiBAIHVuY2F1Z2h0RXhjZXB0aW9uOicsIGVyci5tZXNzYWdlKTsgfSAgLy8gTG9nIG9yIGRpc3BsYXkgb3RoZXIgZXJyb3JzXG59KTtcblxuLy8gSGFuZGxlIHVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbnMgdG8gcHJldmVudCBjcmFzaGVzXG5wcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAocmVhc29uLCBwcm9taXNlKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBVbmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb246JywgcmVhc29uKTtcbiAgICBpZiAocmVhc29uIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgdW5oYW5kbGVkUmVqZWN0aW9uOiBTdGFjazonLCByZWFzb24uc3RhY2spO1xuICAgIH1cbn0pO1xuXG4vLyBIYW5kbGUgcmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG5hcHAub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkJyk7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGlkZW50aWZ5IHdoaWNoIHdpbmRvdyBjcmFzaGVkXG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgIFxuICAgIGlmIChjcmFzaGVkV2luZG93KSB7XG4gICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBGb3IgZXhhbSB3aW5kb3cgY3Jhc2hlcywgdHJ5IHRvIGNsb3NlIGl0IGdyYWNlZnVsbHlcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzIC0gbGV0IGl0IGNvbnRpbnVlXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBIYW5kbGUgY2hpbGQgcHJvY2VzcyBjcmFzaGVzICh3b3JrZXJzLCBldGMuKVxuYXBwLm9uKCdjaGlsZC1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IENoaWxkIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogVHlwZTonLCBkZXRhaWxzLnR5cGUpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIGNoaWxkLXByb2Nlc3MtZ29uZTogUmVhc29uOicsIGRldGFpbHMucmVhc29uKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICBcbiAgICAvLyBEb24ndCBjcmFzaCB0aGUgbWFpbiBwcm9jZXNzXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn0pO1xuXG4vLyBTZXQgYXBwbGljYXRpb24gbmFtZSBmb3IgV2luZG93cyAxMCsgbm90aWZpY2F0aW9uc1xuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgIGFwcC5zZXRBcHBVc2VyTW9kZWxJZChhcHAuZ2V0TmFtZSgpKX1cbi8vaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgIGFwcC5kb2NrLmhpZGUoKSB9ICAvLyB0aGlzIGJ1ZyBzdGF0ZXMgdGhhdCBpdCBraW5kYSBtZXNzZXMgdXAga2lvc2sgbW9kZSAtIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTgyMDdcblxuXG5cbi8vIGhpZGUgY2VydGlmaWNhdGUgd2FybmluZ3MgaW4gY29uc29sZS4uIHdlIGtub3cgd2UgdXNlIGEgc2VsZiBzaWduZWQgY2VydCBhbmQgZG8gbm90IHZhbGlkYXRlIGl0XG5wcm9jZXNzLmVudltcIk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRURcIl0gPSBcIjBcIjtcbnByb2Nlc3MuZW52Lk5PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQgPSBcIjBcIjtcbmNvbnN0IG9yaWdpbmFsRW1pdFdhcm5pbmcgPSBwcm9jZXNzLmVtaXRXYXJuaW5nXG5wcm9jZXNzLmVtaXRXYXJuaW5nID0gKHdhcm5pbmcsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAod2FybmluZyAmJiB3YXJuaW5nLmluY2x1ZGVzICYmIHdhcm5pbmcuaW5jbHVkZXMoJ05PREVfVExTX1JFSkVDVF9VTkFVVEhPUklaRUQnKSkgeyAgcmV0dXJuIH1cbiAgICByZXR1cm4gb3JpZ2luYWxFbWl0V2FybmluZy5jYWxsKHByb2Nlc3MsIHdhcm5pbmcsIG9wdGlvbnMpXG59XG5cbmFwcC5vbignY2VydGlmaWNhdGUtZXJyb3InLCAoZXZlbnQsIHdlYkNvbnRlbnRzLCB1cmwsIGVycm9yLCBjZXJ0aWZpY2F0ZSwgY2FsbGJhY2spID0+IHsgLy8gU1NML1RMUzogdGhpcyBpcyB0aGUgc2VsZiBzaWduZWQgY2VydGlmaWNhdGUgc3VwcG9ydFxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIE9uIGNlcnRpZmljYXRlIGVycm9yIHdlIGRpc2FibGUgZGVmYXVsdCBiZWhhdmlvdXIgKHN0b3AgbG9hZGluZyB0aGUgcGFnZSlcbiAgICBjYWxsYmFjayh0cnVlKTsgIC8vIGFuZCB3ZSB0aGVuIHNheSBcIml0IGlzIGFsbCBmaW5lIC0gdHJ1ZVwiIHRvIHRoZSBjYWxsYmFja1xufSk7XG5cbi8vIEhhbmRsZSBXZWJDb250ZW50cyBsb2FkIGZhaWx1cmVzIHRvIHByZXZlbnQgYXBwIGNyYXNoZXNcbmFwcC5vbignd2ViLWNvbnRlbnRzLWNyZWF0ZWQnLCAoZXZlbnQsIHdlYkNvbnRlbnRzKSA9PiB7XG4gICAgY29uc3Qgc3VwcHJlc3NDb2RlcyA9IFstMywgLTEwMCwgLTEwMSwgLTEwNV07XG5cbiAgICAvLyBTdG9yZSBpZiB3ZSd2ZSBhbHJlYWR5IHNldCB1cCBsaXN0ZW5lcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGlmICh3ZWJDb250ZW50cy5fZXJyb3JTdXBwcmVzc2lvblNldHVwKSByZXR1cm47XG4gICAgd2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCA9IHRydWU7XG5cbiAgICAvLyBTZXQgdXAgbGlzdGVuZXJzIHRoYXQgcGVyc2lzdCBhY3Jvc3MgbmF2aWdhdGlvblxuICAgIGNvbnN0IHNldHVwRXJyb3JTdXBwcmVzc2lvbiA9ICgpID0+IHtcbiAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgZmlyc3QgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgICAgICB3ZWJDb250ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKTtcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1sb2FkJyk7XG4gICAgICAgIFxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcblxuICAgICAgICB3ZWJDb250ZW50cy5vbignZGlkLWZhaWwtbG9hZCcsIChldmVudCwgZXJyb3JDb2RlLCBlcnJvckRlc2NyaXB0aW9uLCB2YWxpZGF0ZWRVUkwsIGlzTWFpbkZyYW1lLCBmcmFtZVByb2Nlc3NJZCwgZnJhbWVSb3V0aW5nSWQpID0+IHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IHN1cHByZXNzIHN1YmZyYW1lIGVycm9ycyBhbmQgY29tbW9uIGVycm9yIGNvZGVzXG4gICAgICAgICAgICBpZiAoIWlzTWFpbkZyYW1lIHx8IHN1cHByZXNzQ29kZXMuaW5jbHVkZXMoZXJyb3JDb2RlKSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCBkaWQtZmFpbC1sb2FkOiBFcnJvciAke2Vycm9yQ29kZX0gLSAke2Vycm9yRGVzY3JpcHRpb259IGZvciBVUkw6ICR7dmFsaWRhdGVkVVJMfWApO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU2V0IHVwIGltbWVkaWF0ZWx5XG4gICAgc2V0dXBFcnJvclN1cHByZXNzaW9uKCk7XG5cbiAgICAvLyBSZS1zZXR1cCBvbiBuYXZpZ2F0aW9uIHRvIGVuc3VyZSBsaXN0ZW5lcnMgcGVyc2lzdFxuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtc3RhcnQtbmF2aWdhdGlvbicsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgd2ViQ29udGVudHMub24oJ2RpZC1mcmFtZS1uYXZpZ2F0ZScsIHNldHVwRXJyb3JTdXBwcmVzc2lvbik7XG4gICAgXG4gICAgLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyBmb3Igc3BlY2lmaWMgd2ViQ29udGVudHMgKFY4IGZhdGFsIGVycm9ycywgZXRjLilcbiAgICB3ZWJDb250ZW50cy5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChldmVudCwgZGV0YWlscykgPT4ge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZW5kZXJlciBwcm9jZXNzIGNyYXNoZWQgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzJyk7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEV4aXQgY29kZTonLCBkZXRhaWxzLmV4aXRDb2RlKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgdGhpcyB3ZWJDb250ZW50cyBiZWxvbmdzIHRvXG4gICAgICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICAgICAgY29uc3QgY3Jhc2hlZFdpbmRvdyA9IGFsbFdpbmRvd3MuZmluZCh3aW4gPT4gd2luLndlYkNvbnRlbnRzLmlkID09PSB3ZWJDb250ZW50cy5pZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogV2luZG93IHRpdGxlOiAke2NyYXNoZWRXaW5kb3cuZ2V0VGl0bGUoKX1gKTtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyBVUkw6ICR7Y3Jhc2hlZFdpbmRvdy53ZWJDb250ZW50cy5nZXRVUkwoKX1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgICAgICBpZiAoY3Jhc2hlZFdpbmRvdyA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGFtIHdpbmRvdyBjcmFzaGVkLCBhdHRlbXB0aW5nIHRvIGNsb3NlIGdyYWNlZnVsbHknKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNyYXNoZWRXaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3Jhc2hlZFdpbmRvdy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtRGlzcGxheUlkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXJyb3IgY2xvc2luZyBleGFtIHdpbmRvdzonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xufSk7XG5cbmFwcC5vbignd2luZG93LWFsbC1jbG9zZWQnLCBhc3luYyAoKSA9PiB7ICAvLyBsYXN0IHdpbmRvdyBjbG9zZWQgXHUyMDEzIGNsZWFyIHN0b3JhZ2UgaGVyZSB0byBhdm9pZCBMaW51eCBzZWdmYXVsdCBpbiBiZWZvcmUtcXVpdFxuICAgIGNsZWFySW50ZXJ2YWwoIENvbW1IYW5kbGVyLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLmNoZWNrV2luZG93SW50ZXJ2YWw/LnN0b3ApIFdpbmRvd0hhbmRsZXIuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICBpZiAoQ29tbUhhbmRsZXIudXBkYXRlU2NoZWR1bGVyPy5zdG9wKSBDb21tSGFuZGxlci51cGRhdGVTY2hlZHVsZXIuc3RvcCgpXG4gICAgaWYgKENvbW1IYW5kbGVyLnNjcmVlbnNob3RTY2hlZHVsZXI/LnN0b3ApIENvbW1IYW5kbGVyLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RvcCgpXG4gICAgaWYgKG11bHRpY2FzdENsaWVudC5yZWZyZXNoRXhhbXNTY2hlZHVsZXI/LnN0b3ApIG11bHRpY2FzdENsaWVudC5yZWZyZXNoRXhhbXNTY2hlZHVsZXIuc3RvcCgpXG4gICAgV2luZG93SGFuZGxlci5tYWlud2luZG93ID0gbnVsbFxuXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5jbGVhclN0b3JhZ2VEYXRhKHt9KTsgLy8gY2xlYXIgY29va2llcywgY2FjaGUsIGxvY2FsU3RvcmFnZSBldGMuIHdoaWxlIHNlc3Npb24gc3RpbGwgdmFsaWRcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2luZG93LWFsbC1jbG9zZWQ6IEVycm9yIGNsZWFyaW5nIHN0b3JhZ2U6JywgZXJyKTtcbiAgICB9XG4gICAgYXBwLnF1aXQoKTtcbn0pO1xuXG5hcHAub24oJ3dpbGwtcXVpdCcsICgpID0+IHsgIC8vIGlmIHdpbmRvdyBpcyBjbG9zZWRcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKGZhbHNlKVxufSlcblxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKClcbiAgICBpZiAoYWxsV2luZG93cy5sZW5ndGgpIHsgYWxsV2luZG93c1swXS5mb2N1cygpIH0gXG4gICAgZWxzZSB7IFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpIH1cbn0pXG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgYW5kIHF1aXQgaWYgZGV0ZWN0ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoZWNrUGFyZW50UHJvY2VzcygpO1xuICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudDonLCByZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdC5mb3VuZEJyb3dzZXIpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgY2hlY2tQYXJlbnQ6IFRoZSBhcHAgd2FzIHN0YXJ0ZWQgZGlyZWN0bHkgZnJvbSBhIGJyb3dzZXInKTtcbiAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveFN5bmMoV2luZG93SGFuZGxlci5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUZXJtaW5hdGUgUHJvZ3JhbScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1VuZXJsYXVidGVyIFByb2dyYW1tc3RhcnQgYXVzIGVpbmVtIFdlYmJyb3dzZXIgZXJrYW5udC5cXG5OZXh0LUV4YW0gd2lyZCBiZWVuZGV0IScsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlO1xuICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKCdtYWluIEAgY2hlY2twYXJlbnQ6IFBhcmVudCBQcm9jZXNzIENoZWNrIE9LJyk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGVja1BhcmVudCBlcnJvcjonLCBlcnJvcik7XG4gICAgfVxufVxuXG5hcHAud2hlblJlYWR5KClcbi50aGVuKGFzeW5jICgpPT57XG5cbiAgICBuYXRpdmVUaGVtZS50aGVtZVNvdXJjZSA9ICdsaWdodCcgIC8vIHByZXZlbnQgdGhlbWUgc2V0dGluZ3MgZnJvbSBiZWluZyBhZG9wdGVkIGZyb20gd2luZG93c1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0VXNlckFnZW50KGBOZXh0LUV4YW0vJHtjb25maWcudmVyc2lvbn0gKCR7Y29uZmlnLmluZm99KSAke3Byb2Nlc3MucGxhdGZvcm19YCk7ICAvLyBzZXQgdXNlciBhZ2VudCBmb3IgYWxsIHNlc3Npb25zXG4gICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRDZXJ0aWZpY2F0ZVZlcmlmeVByb2MoKHJlcXVlc3QsIGNhbGxiYWNrKSA9PiB7IGNhbGxiYWNrKDApOyB9KTsgICAvLyBzZXQgY2VydGlmaWNhdGUgdmVyaWZpY2F0aW9uIGdsb2JhbGx5IGZvciBhbGwgc2Vzc2lvbnNcbiAgICBcbiAgICB0b2dnbGVNYWNPU0xvY2tkb3duKHRydWUpO1xuICAgXG4gICAgLyoqKioqKiogQ3JlYXRlIG1haW4gd2luZG93ICoqKioqKiovXG4gICAgV2luZG93SGFuZGxlci5jcmVhdGVNYWluV2luZG93KClcblxuXG4gICAgaWYgKGNvbmZpZy5ob3N0aXAgPT0gXCIxMjcuMC4wLjFcIikgeyBjb25maWcuaG9zdGlwID0gZmFsc2UgfVxuICAgIGlmIChjb25maWcuaG9zdGlwKSB7IG11bHRpY2FzdENsaWVudC5pbml0KGNvbmZpZy5nYXRld2F5KSAgfSAvL211bHRpY2FzdCBjbGllbnQgb25seSB0cmFja3Mgb3RoZXIgZXhhbSBpbnN0YW5jZXMgb24gdGhlIG5ldHdvcmtcblxuICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGlkZXMgbGVnYWN5IHRyYXlcbiAgICBpZiAoIWNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgIHBvd2VyU2F2ZUJsb2NrZXIuc3RhcnQoJ3ByZXZlbnQtZGlzcGxheS1zbGVlcCcpICAgLy8gcHJldmVudCB0aGUgZGV2aWNlIGZyb20gZ29pbmcgdG8gc2xlZXBcbiAgICAgICAgaWYgKGFsbG93VHJheSkgeyB1cGRhdGVTeXN0ZW1UcmF5KCdkZScpOyB9ICAgICAgICAvLyBza2lwIHRyYXkgb24gR05PTUVcbiAgICAgICAgZWxzZSB7IGxvZy5pbmZvKCdtYWluIEAgdHJheTogR05PTUUgZGV0ZWN0ZWQsIHNraXBwaW5nIHN5c3RlbSB0cmF5Jyk7IH1cbiAgICAgICAgcnVuUGFyZW50UHJvY2Vzc0NoZWNrKCk7ICAvLyB0aGlzIGNoZWNrcyBpZiB0aGUgYXBwIHdhcyBzdGFydGVkIGZyb20gd2l0aGluIGEgYnJvd3NlciAoZGlyZWN0bHkgYWZ0ZXIgZG93bmxvYWQpXG4gICAgfVxuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtHJywgKCkgPT4geyAgaWYgKGdsb2JhbCAmJiBnbG9iYWwuZ2MpeyBnbG9iYWwuZ2Moe3R5cGU6J21heW9yJyxleGVjdXRpb246ICdhc3luYyd9KTsgZ2xvYmFsLmdjKHt0eXBlOidtaW5vcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7ICB9fSk7XG4gICAgICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1QnLCAoKSA9PiB7ICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTsgaWYgKHdpbikgeyB3aW4ud2ViQ29udGVudHMudG9nZ2xlRGV2VG9vbHMoKSB9fSk7XG4gICAgfVxuXG4gICAgLy90aGVzZSBhcmUgc29tZSBzaG9ydGN1dHMgd2UgdHJ5IHRvIGNhcHR1cmVcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdGNScsICgpID0+IHt9KTsgIC8vcmVsb2FkIHBhZ2VcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtSJywgKCkgPT4ge30pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrRjQnLCAoKSA9PiB7fSk7ICAvL2V4aXQgYXBwXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVycsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtRJywgKCkgPT4ge30pOyAgLy9xdWl0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrRCcsICgpID0+IHt9KTsgIC8vc2hvdyBkZXNrdG9wXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrTCcsICgpID0+IHt9KTsgIC8vbG9ja3NjcmVlblxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1AnLCAoKSA9PiB7fSk7ICAvL2NoYW5nZSBzY3JlZW4gbGF5b3V0XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0FsdCtMZWZ0JywgKCkgPT4geyAgcmV0dXJuIGZhbHNlIH0pOyAgLy8gTmF2aWdhdGlvbiBhdHRlbXB0IGJsb2NrZWRcbn0pXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgZGdyYW0gZnJvbSAnZGdyYW0nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnOyAgLy8gbm9kZSBub3QgdnVlIChyZWxhdGl2ZSBwYXRoIG5lZWRlZClcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuXG4vKipcbiAqIFNUT1JFUyBBTEwgQ0xJRU5UL1NlcnZlciBJTkZPUk1BVElPTlxuICogU3RhcnRzIGEgZGdyYW0gKHVkcCkgc29ja2V0IHRoYXQgbGlzdGVucyBmb3IgbXVsaXRjYXN0IG1lc3NhZ2VzXG4gKi9cblxuY2xhc3MgTXVsdGljYXN0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuUE9SVCA9IGNvbmZpZy5tdWx0aWNhc3RDbGllbnRQb3J0XG4gICAgICAgIHRoaXMuTVVMVElDQVNUX0FERFIgPSBjb25maWcubXVsdGljYXN0U2VydmVyQWRyclxuICAgICAgICB0aGlzLmNsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdCA9IFtdXG4gICAgICAgIHRoaXMuY2xpZW50aW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IFwiRGVtb1VzZXJcIixcbiAgICAgICAgICAgIHRva2VuOiBmYWxzZSxcbiAgICAgICAgICAgIGlwOiBmYWxzZSwgIC8vIGlwIGFkZHJlc3Mgd2lyZCB2b20gbXVsdGljYXN0c2VydmVyIHRlYWNoZXIgbWl0IGdlc2NoaWNrdFxuICAgICAgICAgICAgaG9zdG5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2VydmVyaXA6IGZhbHNlLCAgIC8vIHdpcmQgbG9rYWwgZ2VzZXR6dCAoaXN0IGFiZXIgbG9naXNjaGVyd2Vpc2UgZ2xlaWNoIGRlciBpcCBkZXMgbXVsdGljYXN0c2VydmVycylcbiAgICAgICAgICAgIHNlcnZlcm5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgZm9jdXM6IHRydWUsXG4gICAgICAgICAgICBleGFtbW9kZTogZmFsc2UsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IGZhbHNlLFxuICAgICAgICAgICAgdmlydHVhbGl6ZWQ6IGZhbHNlLCAgLy8gdGhpcyBjb25maWcgc2V0dGluZyBpcyBzZXQgYnkgc2ltcGxldm1kZXRlY3QuanMgKGVsZWN0cm9uIHByZWxvYWQpXG4gICAgICAgICAgICBleGFtdHlwZSA6IGZhbHNlLFxuICAgICAgICAgICAgcGluOiBmYWxzZSxcbiAgICAgICAgICAgIHNjcmVlbmxvY2s6IGZhbHNlLFxuICAgICAgICAgICAgbXNvZmZpY2VzaGFyZTogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDQwMDAsICAgLy9taWxsaXNlY29uZHNcbiAgICAgICAgICAgIHByaW50cmVxdWVzdCA6IGZhbHNlLFxuICAgICAgICAgICAgcHJpdmF0ZVNwZWxsY2hlY2s6IHthY3RpdmF0ZWQ6IGZhbHNlfSxcbiAgICAgICAgICAgIGxvY2FsTG9ja2Rvd246IGZhbHNlLFxuICAgICAgICAgICAgZ3JvdXA6ICdhJyxcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IDBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBhbmQgcmVhY3RzIG9uIGluZm9ybWF0aW9uIGdpdmVuIGJ5IHRoZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKSAgLy8gbW92aW5nIHRoaXMgaGVyZSB3aWxsIGFsbG93IHRvIHJlc3Bhd24gaXQgaWYgYmluZGluZyBmYWlsc1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5iaW5kKHRoaXMuUE9SVCwgJzAuMC4wLjAnLCAgKCkgPT4geyBcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRCcm9hZGNhc3QodHJ1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5zZXRNdWx0aWNhc3RUVEwoMTI4KTsgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2F0ZXdheSkge3RoaXMuY2xpZW50LmFkZE1lbWJlcnNoaXAodGhpcy5NVUxUSUNBU1RfQUREUil9IC8vIGVzIGlzdCBmXHUwMEZDciBlaW4gdmVybFx1MDBFNHNzbGljaGVzIG11bHRpY2FzdCBzaW5udm9sbCBkZXIgZ3J1cHBlIGJlaXp1dHJldGVuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdhdGV3YXkpIHtsb2cud2FybihcIm1jY2xpZW50OiBObyBHYXRld2F5ISBTdGFydGluZyBNdWx0aWNhc3RDbGllbnQgd2l0aG91dCBhZGRpbmcgZ3JvdXAgbWVtYmVyc2hpcFwiKX1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBsaXN0ZW5pbmcgb24gaHR0cDovLyR7Y29uZmlnLmhvc3RpcH06JHt0aGlzLmNsaWVudC5hZGRyZXNzKCkucG9ydH1gKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7IFxuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWxpdGNhc3RjbGllbnQgQCBpbml0OiAke2V9YCkgXG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcbiBcbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgXG4gICAgICAgIGNvbnN0IHNlcnZlckluZm8gPSBKU09OLnBhcnNlKFN0cmluZyhtZXNzYWdlKSlcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJpcCA9IHJpbmZvLmFkZHJlc3NcbiAgICAgICAgc2VydmVySW5mby5zZXJ2ZXJwb3J0ID0gcmluZm8ucG9ydFxuICAgICAgICBzZXJ2ZXJJbmZvLnJlYWNoYWJsZSA9IHRydWVcbiAgICAgICAgc2VydmVySW5mby50aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAgIC8vcmVjb3JkIHRpbWVzdGFtcCBvZiBsYXN0IG1lc3NhZ2UgZnJvbSBzZXJ2ZXIgKGlnbm9yZSBzZXJ2ZXJ0aW1lc3RhbXAgYmVjYXVzZSBpdCBtYXkgaGF2ZSBhIGRpZmZlcmVudCBzeXN0ZW0gdGltZSlcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmlzTmV3RXhhbUluc3RhbmNlKHNlcnZlckluZm8pKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgbXVsdGljYXN0Y2xpZW50IEAgbWVzc2FnZVJlY2VpdmVkOiBBZGRpbmcgbmV3IEV4YW0gSW5zdGFuY2UgXCIke3NlcnZlckluZm8uc2VydmVybmFtZX1cIiB0byBTZXJ2ZXJsaXN0YClcbiAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QucHVzaChzZXJ2ZXJJbmZvKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHRoZSBtZXNzYWdlIGNhbWUgZnJvbSBhIG5ldyBleGFtIGluc3RhbmNlIG9yIGFuIG9sZCBvbmUgdGhhdCBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBpc05ld0V4YW1JbnN0YW5jZSAob2JqKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leGFtU2VydmVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbVNlcnZlckxpc3RbaV0uaWQgPT09IG9iai5pZCkge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oJ2V4aXN0aW5nIHNlcnZlciAtIHVwZGF0aW5nIHRpbWVzdGFtcCcpXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdFtpXS50aW1lc3RhbXAgPSBvYmoudGltZXN0YW1wIC8vIGV4aXN0aW5nIHNlcnZlciAtIHVwZGF0ZSB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBzZXJ2ZXJ0aW1lc3RhbXAgYW5kIHJlbW92ZXMgc2VydmVyIGZyb20gbGlzdCBpZiBvbGRlciB0aGFuIDEgbWludXRlXG4gICAgICovXG4gICAgaXNEZXByZWNhdGVkSW5zdGFuY2UgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG5cbiAgICAgICAgICAgIGlmIChub3cgLSAxNjAwMCA+IHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYG11bHRpY2FzdGNsaWVudCBAIGlzRGVwcmVjYXRlZEluc3RhbmNlOiBSZW1vdmluZyBpbmFjdGl2ZSBzZXJ2ZXIgJyR7dGhpcy5leGFtU2VydmVyTGlzdFtpXS5zZXJ2ZXJuYW1lfScgZnJvbSBsaXN0YClcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnNwbGljZShpLCAxKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVsdGljYXN0Q2xpZW50KClcbiIsICJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuXG5leHBvcnQgY2xhc3MgU2NoZWR1bGVyU2VydmljZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICBhY3Rpb246ICgpID0+IHZvaWQ7XG4gICAgaGFuZGxlOiBOb2RlSlMuVGltZXI7XG4gICAgaW50ZXJ2YWw6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFjdGlvbjogKCkgPT4gdm9pZCwgbXM6IG51bWJlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBtcztcbiAgICAgICAgdGhpcy5hZGRMaXN0ZW5lcigndGltZW91dCcsIHRoaXMuYWN0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy5lbWl0KCd0aW1lb3V0JyksIHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmhhbmRsZSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn0iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQnJvd3NlclZpZXcsIGRpYWxvZywgc2NyZWVufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnXG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCB7IGFjdGl2ZVdpbmRvdyB9IGZyb20gJ2dldC13aW5kb3dzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tIFwibm9kZTp1cmxcIjtcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vLyBSZW5kZXJlciBidWlsdCBpbnRvIHB1YmxpYy8gKG9uZSBjb3B5KTsgd2hlbiBwYWNrYWdlZCB1c2UgYXBwLmFzYXIudW5wYWNrZWQvcHVibGljXG5mdW5jdGlvbiBnZXRSZW5kZXJlckluZGV4UGF0aCgpIHtcbiAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgY29uc3QgdW5wYWNrZWQgPSBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJywgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmModW5wYWNrZWQpKSByZXR1cm4gdW5wYWNrZWQ7XG4gIH1cbiAgY29uc3QgcHVibGljUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAncHVibGljJywgJ2luZGV4Lmh0bWwnKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMocHVibGljUGF0aCkpIHJldHVybiBwdWJsaWNQYXRoO1xuICBjb25zdCBkaXN0UmVuZGVyZXJQYXRoID0gam9pbihfX2Rpcm5hbWUsICdkaXN0JywgJ3JlbmRlcmVyJywgJ2luZGV4Lmh0bWwnKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMoZGlzdFJlbmRlcmVyUGF0aCkpIHJldHVybiBkaXN0UmVuZGVyZXJQYXRoO1xuICBjb25zdCBxdWFzYXJQYXRoID0gam9pbihfX2Rpcm5hbWUsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHF1YXNhclBhdGgpKSByZXR1cm4gcXVhc2FyUGF0aDtcbiAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vcmVuZGVyZXIvaW5kZXguaHRtbCcpO1xufVxuXG5cblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIFdpbmRvdyBoYW5kbGluZyAoaXBjUmVuZGVyZXIgUHJvY2VzcyAtIEZyb250ZW5kKSBTVEFSVFxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxuY2xhc3MgV2luZG93SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICB0aGlzLnNjcmVlbmxvY2tXaW5kb3cgPSBudWxsXG4gICAgICB0aGlzLm1haW53aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsXG4gICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNlcnZlZCBkaXNwbGF5IElEIGZvciBleGFtIHdpbmRvdyAoc2V0IGltbWVkaWF0ZWx5IHdoZW4gd2luZG93IGlzIGNyZWF0ZWQpXG4gICAgICB0aGlzLnNwbGFzaHdpbiA9IG51bGxcbiAgICAgIHRoaXMuYmlwd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICBcbiAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2UgIC8vIHRyYWNrIGlmIGV4aXQgcXVlc3Rpb24gZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBtaW5pbWl6ZSB3YXJuaW5nIGRpYWxvZyBpcyBvcGVuXG4gICAgfVxuXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbCA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMud2luZG93VHJhY2tlci5iaW5kKHRoaXMpLCAxMDAwKVxuICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gZWxlY3Ryb24gd2luZG93IGluIGZvY3VzIG9yIGFuIG90aGVyIGVsZWN0cm9uIHdpbmRvdyBkZXBlbmRpbmcgb24gdGhlIGhpZXJhY2h5XG4gICAgZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcbiAgICAgICAgaWYgKGZvY3VzZWRXaW5kb3cpIHtcbiAgICAgICAgICByZXR1cm4gZm9jdXNlZFdpbmRvd1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVubG9ja1dpbmRvdyl7cmV0dXJuIHRoaXMuc2NyZWVubG9ja1dpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuZXhhbXdpbmRvdyl7cmV0dXJuIHRoaXMuZXhhbXdpbmRvd31cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubWFpbndpbmRvdyl7cmV0dXJuIHRoaXMubWFpbndpbmRvd31cbiAgICAgICAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBjcmVhdGVCaVBMb2dpbldpbihiaXB0ZXN0KSB7XG4gICAgICAgIHRoaXMuYmlwd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTAwMCxcbiAgICAgICAgICAgIGhlaWdodDo4MDAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBkaWQtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHdpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogbmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHRhcmdldDogX2JsYW5rXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1yZWRpcmVjdCcsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogJyArIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhbiBlYXN0ZXIgZWdnXG4gICAgICovXG4gICAgY3JlYXRlRWFzdGVyV2luKCkge1xuICAgICAgICB0aGlzLmVhc3RlcndpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDc2OCxcbiAgICAgICAgICAgIGhlaWdodDo0ODAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbW92YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBmcmFtZTogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IGZhbHNlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi5sb2FkRmlsZShqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgJ2Nvd3NvbmljZScsICdpbmRleC5odG1sJykpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVhc3RlcndpbiAmJiAhdGhpcy5lYXN0ZXJ3aW4uaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3Rlcndpbi5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEJsb2NrV2luZG93ICh0byBjb3ZlciBhZGRpdGlvbmFsIHNjcmVlbnMpXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgbmV3QmxvY2tXaW4oZGlzcGxheSkge1xuICAgICAgICBsZXQgYmxvY2t3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgcGFyZW50OiB0aGlzLmV4YW13aW5kb3csXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdOZXh0LUV4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIGZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgICAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBcIm5vdGZvdW5kXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBibG9ja3dpbi5yZW1vdmVNZW51KCkgXG4gICAgICAgIGJsb2Nrd2luLnNldE1pbmltaXphYmxlKGZhbHNlKVxuXG4gICAgICAgIC8vIFBvc2l0aW9uIHdpbmRvdyBvbiBzcGVjaWZpYyBkaXNwbGF5IEJFRk9SRSBzaG93aW5nIGl0XG4gICAgICAgIGJsb2Nrd2luLnNldEJvdW5kcyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54LFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJsb2Nrd2luLnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICBibG9ja3dpbi5zaG93KClcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7XG4gICAgICAgICAgICBibG9ja3dpbi5vbignbGVhdmUtZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTsgLy8gc29mb3J0IHdpZWRlciB6dXJcdTAwRkNja3NldHplblxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9ICBcbiAgICAgICAgZWxzZSB7ICAgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRLaW9zayh0cnVlKTsgLy8gS2lvc2sgPSBcInRha2Ugb3ZlciBtYWluIHNjcmVlblwiLiBvbiBtYWNvcyB0aGF0J3Mgd2h5IHdlIHVzZSBmdWxsU2NyZWVuIHdvcmthcm91bmQgd2l0aCBldmVudCBsaXN0ZW5lclxuICAgICAgICB9XG4gICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgYmxvY2t3aW4uZGlzcGxheSA9IGRpc3BsYXlcbiAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MucHVzaChibG9ja3dpbilcbiAgICB9XG5cblxuICAgIC8vIGJsb2NrIGFsbCBzY3JlZW5zIHdpdGggYSBibG9ja3dpbmRvd1xuICAgIGFzeW5jIGluaXRCbG9ja1dpbmRvd3MoKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgLy9sb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGZvdW5kICR7ZGlzcGxheXMubGVuZ3RofSBkaXNwbGF5c2ApXG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7ICAvLyBsb2NrIGFsbCBzY3JlZW5zXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBleGFtIHdpbmRvdyB0byBiZSB2aXNpYmxlIGFuZCBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldHJpZXMgPSAwXG4gICAgICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwXG4gICAgICAgICAgICAgICAgd2hpbGUgKCF0aGlzLmV4YW13aW5kb3cuaXNWaXNpYmxlKCkgJiYgcmV0cmllcyA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApXG4gICAgICAgICAgICAgICAgICAgIHJldHJpZXMrK1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHdhaXQgdG8gZW5zdXJlIHBvc2l0aW9uaW5nIGlzIGNvbXBsZXRlIG9uIFdheWxhbmRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIGJsb2NrIHdpbmRvd3MgZnJvbSBhcnJheVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSB0aGlzLmJsb2Nrd2luZG93cy5maWx0ZXIoYmxvY2t3aW4gPT4gYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBhbGwgZXhpc3Rpbmcgd2luZG93cyBhbmQgZGV0ZXJtaW5lIHRoZWlyIGRpc3BsYXlzXG4gICAgICAgICAgICBjb25zdCB1c2VkRGlzcGxheUlkcyA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaXJzdCwgdXNlIHRoZSByZXNlcnZlZCBleGFtIGRpc3BsYXkgSUQgKHNldCBpbW1lZGlhdGVseSB3aGVuIGV4YW0gd2luZG93IHdhcyBjcmVhdGVkKVxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBzY3JlZW4gaXMgcmVzZXJ2ZWQgZXZlbiBpZiB0aGUgd2luZG93IGlzbid0IGZ1bGx5IGluaXRpYWxpemVkIHlldFxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbURpc3BsYXlJZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZCh0aGlzLmV4YW1EaXNwbGF5SWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFsd2F5cyBleGNsdWRlIHByaW1hcnkgZGlzcGxheSAoZXhhbSB3aW5kb3cgbG9jYXRpb24pXG4gICAgICAgICAgICBjb25zdCBwcmltYXJ5RGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAocHJpbWFyeURpc3BsYXkgJiYgcHJpbWFyeURpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQocHJpbWFyeURpc3BsYXkuaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGV4YW0gd2luZG93IGRpc3BsYXkgKGFzIGZhbGxiYWNrL3ZlcmlmaWNhdGlvbiwgYnV0IHJlc2VydmVkIElEIHRha2VzIHByaW9yaXR5KVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBleGFtIHdpbmRvdyBpcyBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGV4YW0gd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBibG9jayB3aW5kb3dzIGRpc3BsYXlzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGJsb2Nrd2luIG9mIHRoaXMuYmxvY2t3aW5kb3dzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gYmxvY2t3aW4uZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBibG9jayB3aW5kb3cgZm91bmQgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBibG9jayB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBibG9jayB3aW5kb3dzIGZvciBkaXNwbGF5cyB0aGF0IGRvbid0IGhhdmUgZXhhbSBvciBibG9jayB3aW5kb3dzXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBpZiAodXNlZERpc3BsYXlJZHMuaGFzKGRpc3BsYXkuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogc2tpcHBpbmcgZGlzcGxheSAke2Rpc3BsYXkuaWR9IC0gYWxyZWFkeSBoYXMgZXhhbSBvciBibG9jayB3aW5kb3dgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBjcmVhdGUgYmxvY2t3aW4gb246XCIsZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0Jsb2NrV2luKGRpc3BsYXkpICAvLyBhZGQgYmxvY2t3aW5kb3dzIGZvciBkaXNwbGF5cyB3aXRob3V0IGV4YW0gd2luZG93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMClcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLmZvckVhY2goIChibG9ja3dpbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFNjcmVlbmxvY2sgV2luZG93ICh0byBjb3ZlciB0aGUgbWFpbnNjcmVlbikgLSBibG9jayBzdHVkZW50cyBmcm9tIHdvcmtpbmdcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBjcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IHNjcmVlbmxvY2tXaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHRoaXMubWFpbndpbmRvdywgICAvLyBsZWFkcyB0byB2aXNpYmxlIHRpdGxlYmFyIGluIGdub21lLWRlc2t0b3BcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ1NjcmVlbmxvY2snLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIC8vZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHVybCA9IFwibG9ja1wiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICAvLyBBZGQgd2luZG93IHRvIGFycmF5IGZpcnN0LCBiZWZvcmUgYWRkaW5nIGJsdXIgbGlzdGVuZXJcbiAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5wdXNoKHNjcmVlbmxvY2tXaW5kb3cpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzY3JlZW5sb2NrV2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJwb3AtdXAtbWVudVwiLCAxKSAgIC8vYWJvdmUgZXhhbSB3aW5kb3cgKHBvcC11cC1tZW51LCAwKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRDbG9zYWJsZSh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUpOyAvLyBwdXQgdGhlIHdpbmRvdyBvbiBhbGwgdmlydHVhbCB3b3Jrc3BhY2VzXG4gICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcihcInNjcmVlbmxvY2tcIilcbiAgICAgICAgfSlcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfSAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHsgICAvLyByZW1vdmUgd2luZG93IGZyb20gYXJyYXkgd2hlbiBhY3R1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmIHdpbiAhPT0gc2NyZWVubG9ja1dpbmRvdyAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBFeGFtd2luZG93XG4gICAgICogQHBhcmFtIGV4YW10eXBlIGVkdXZpZHVhbCwgbWF0aCwgbGFuZ3VhZ2VcbiAgICAgKiBAcGFyYW0gdG9rZW4gc3R1ZGVudCB0b2tlblxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgY29udGFpbmluZyBpbmZvIGFib3V0IHNwZWxsY2hlY2sgbGFuZ3VhZ2UgZXRjLiBcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVFeGFtV2luZG93KGV4YW10eXBlLCB0b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5ZGlzcGxheSkge1xuICAgICAgICAvLyBqdXN0IHRvIGJlIHN1cmUgd2UgY2hlY2sgc29tZSBpbXBvcnRhbnQgdmFycyBoZXJlXG4gICAgICAgIGlmIChleGFtdHlwZSAhPT0gXCJyZHBcIiAmJiBleGFtdHlwZSAhPT0gXCJ3ZWJzaXRlXCIgJiYgIGV4YW10eXBlICE9PSBcImdmb3Jtc1wiICYmIGV4YW10eXBlICE9PSBcImVkdXZpZHVhbFwiICYmIGV4YW10eXBlICE9PSBcImVkaXRvclwiICYmIGV4YW10eXBlICE9PSBcIm1hdGhcIiAmJiBleGFtdHlwZSAhPT0gXCJtaWNyb3NvZnQzNjVcIiAmJiBleGFtdHlwZSAhPT0gXCJhY3RpdmVzaGVldHNcIiB8fCAhdG9rZW4peyAgLy8gZm9yIG5vdy4uIHdlIHByb2JhYmx5IHNob3VsZCBzdG9wIGV2ZXJ5dGhpbmcgaGVyZVxuICAgICAgICAgICAgbG9nLndhcm4oXCJtaXNzaW5nIHBhcmFtZXRlcnMgZm9yIGV4YW0tbW9kZSBvciBtb2RlIG5vdCBpbiBhbGxvd2VkIGxpc3QhXCIpXG4gICAgICAgICAgICBleGFtdHlwZSA9IFwiZWRpdG9yXCIgXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICAvLyBBbHdheXMgdXNlIHByaW1hcnkgZGlzcGxheSBmb3IgZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzIHx8ICFwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gZGlzcGxheXNbMF0gfHwgcHJpbWFyeWRpc3BsYXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gSW1tZWRpYXRlbHkgcmVzZXJ2ZSB0aGUgZGlzcGxheSBJRCBmb3IgdGhlIGV4YW0gd2luZG93IChiZWZvcmUgd2luZG93IGlzIGZ1bGx5IGluaXRpYWxpemVkKVxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIGJsb2NrIHdpbmRvd3MgZnJvbSBiZWluZyBjcmVhdGVkIG9uIHRoZSBzYW1lIHNjcmVlblxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IHByaW1hcnlkaXNwbGF5LmlkXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZUV4YW1XaW5kb3c6IHJlc2VydmluZyBkaXNwbGF5ICR7dGhpcy5leGFtRGlzcGxheUlkfSBmb3IgZXhhbSB3aW5kb3dgKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgcHggPSAwXG4gICAgICAgIGxldCBweSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcyAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCkge1xuICAgICAgICAgICAgcHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueFxuICAgICAgICAgICAgcHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogcHggKyAwLFxuICAgICAgICAgICAgeTogcHkgKyAwLFxuICAgICAgICAgICAgdGl0bGU6ICdFeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiAxNDQwLFxuICAgICAgICAgICAgaGVpZ2h0OiA3NjgsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHdpbiwgIC8vdGhpcyBkb2VzbnQgd29yayB0b2dldGhlciB3aXRoIGtpb3NrIG9uIHVidW50dSBnbm9tZSA/PyB3dGZcbiAgICAgICAgICAgIC8vIG1vZGFsOiB0cnVlLCAgLy8gdGhpcyBibG9ja3MgdGhlIG1haW4gd2luZG93IG9uIHdpbmRvd3Mgd2hpbGUgdGhlIGV4YW0gd2luZG93IGlzIG9wZW5cbiAgICAgICAgICAgIC8vIGNsb3NhYmxlOiBmYWxzZSwgIC8vIGlmIHdlIGNhbid0IGRlZmluZSAncGFyZW50JyB0aGlzIHdpbmRvdyBoYXMgdG8gYmUgY2xvc2FibGUgLSB3aHk/XG4gICAgICAgICAgICAvL2Fsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgb3BhY2l0eTogMSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICB2aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAga2lvc2s6IHRoaXMuY29uZmlnLmRldmVsb3BtZW50ID8gZmFsc2UgOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWUsXG4gICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5leGFtd2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlTWVudSgpICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBwcm9iYWJseSBub3QgbmVlZGVkIGJlY2F1c2Ugd2UgZGlzYWJsZSBtaXNzaW9uY29udHJvbCBhbnl3YXlzIC0gc2VlbXMgdG8gaW50ZXJmZXJlIHdpdGgga2lvc2sgbW9kZSBvbiBtYWNvcyAoYWdhaW4pXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMuZXhhbXdpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUsIHsgdmlzaWJsZU9uRnVsbFNjcmVlbjogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNXYXlsYW5kKXsgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0YXJ0KCkgfSAvLyBjb25zdGFudGx5IGNoZWNrIGlmIHRoZSBhY3RpdmUgd2luZG93IGlzIHRoZSBleGFtd2luZG93IC0gaWYgbm90LCBicmluZyBpdCB0byBmcm9udFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVSZXN0cmljdGlvbnModGhpcykgIC8vIGRpc2FibGUga2V5Ym9hcmQgc2hvcnRjdXRzIGV0Yy5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgIC8vIGRvIG5vdCBzZXQgYmx1ciBsaXN0ZW5lciB0b28gZWFybHlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoKSAgLy8gYWRkIGJsdXIgbGlzdGVuZXIgdG8gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBkaWQtZmluaXNoLWxvYWQ6IGVycm9yIGluIGV4YW13aW5kb3cgc2V0dXBcIiwgZSl9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzID0gc2VydmVyc3RhdHVzIC8vd2Uga2VlcCBpdCB0aGVyZSB0byBtYWtlIGl0IGFjY2Vzc2FibGUgdmlhIGV4YW13aW5kb3cgaW4gaXBjSGFuZGxlclxuICAgICAgICB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCA9IDk0ICAgLy8gc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBjb250ZW50IHZpZXdcbiAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1pY3Jvc29mdCAzNjUgZW1lYmVkcyBpdHMgZWRpdG9yIGluIGFuIGlmcmFtZSB3aXRoIGFjdGl2ZSBDb250ZW50IFNlY3VyaXR5IFBvbGljeSAoQ1NQKVxuICAgICAgICAgKiBUaGUgb25seSB3YXkgdG8gYmUgYWJsZSB0byBpbmplY3QgY29kZSBpcyB0byBsb2FkIGl0IGRpcmVjdGx5IGluIHRoZSBtYWluIHdpbmRvdyA8ZW1iZWQ+IDxpZnJhbWU+IG9yIGV2ZW4gPHdlYnZpZXc+IG9mZmVycyBubyB3b3JrYXJvdW5kXG4gICAgICAgICAqIHRoZXJlZm9yZSB3ZSB1c2UgXCJCcm93c2VyVmlld1wiIGluIG9yZGVyIHRvIGRpc3BsYXkgdHdvIHBhZ2VzIGluIG9uZSB3aW5kb3c6IG9uIHRvcCA+IGV4YW0gaGVhZGVyLCBvbiBib3R0b20gPiBvZmZpY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaWYgKGV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiICApIHsgLy9leHRlcm5hbCBwYWdlXG4gICAgICAgICAgICBsb2cuaW5mbyhcInN0YXJ0aW5nIG1pY3Jvc29mdDM2NSBleGFtLi4uXCIpXG4gICAgICAgICAgICBsZXQgdXJsdmlldyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSAgIFxuICAgICAgICAgICAgaWYgKCF1cmx2aWV3KSB7Ly8gd2Ugd2FpdCBmb3IgdGhlIG5leHQgdXBkYXRlIHRpY2sgLSBtc29mZmljZXNoYXJlIG5lZWRzIHRvIGJlIHNldCAhIChjb3VsZCBoYXBwZW4gd2hlbiBhIHN0dWRlbnQgY29ubmVjdHMgbGF0ZXIgdGhlbiBleGFtIG1vZGUgaXMgc2V0IGJ1dCBoaXMgc2hhcmUgdXJsIG5lZWRzIHNvbWUgdGltZSlcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiBubyB1cmwgZm9yIG1pY3Jvc29mdDM2NSB3YXMgc2V0IHlldCAtIHdhaXRpbmcgZm9yIG5leHQgdXBkYXRlIHRpY2tcIilcbiAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGRlc3Ryb3llZFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsb2FkIHRvcCBtZW51IGluIE1haW5QYWdlXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCBlZHV2aWR1YWwgfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgYmFja2dyb3VuZHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTChiYWNrZ3JvdW5kdXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlZmluZSB0aGUgTWFpbkNvbnRlbnRQYWdlIHZpZXdcbiAgICAgICAgICAgIGxldCBjb250ZW50VmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLCAgXG4gICAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEF1dG9SZXNpemUoeyB3aWR0aDogdHJ1ZSwgaGVpZ2h0OiB0cnVlLCBob3Jpem9udGFsOiB0cnVlLCB2ZXJ0aWNhbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsdmlldyk7XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7ICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpIH1cblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdlbnRlci1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdyZXNpemUnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSBub3JtYWwgZXhhbSBtb2RlIChlZGl0b3IsIG1hdGgsIGVkdXZpZHVhbCwgd2Vic2l0ZSwgZ2Zvcm1zKVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCB0YmQuXG4gICAgICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZEZpbGUoZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSwge2hhc2g6IGAjLyR7dXJsfS8ke3Rva2VufWB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZSBzcGVjaWFsIE5BVklHQVRJT04gc2l0dWF0aW9uc1xuICAgICAgICAgKi9cblxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIEZvcm1zLCBXZWJzaXRlLCBFZHV2aWR1YWwsIEVkaXRvciwgUkRQLCBNaWNyb3NvZnQzNjVcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgLy8gQmxvY2sgbmF2aWdhdGlvbiBvbiBleGFtd2luZG93LndlYkNvbnRlbnRzIGxldmVsIGZvciBhbGwgbW9kZXMgdGhhdCBjYW4gZGlzcGxheSBQREZzIGluIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBuYXZpZ2F0aW9uIHdoZW4gY2xpY2tpbmcgbGlua3MgaW4gUERGcyBkaXNwbGF5ZWQgaW4gdGhlIGV4YW1oZWFkZXJcbiAgICAgICAgLy8gV2Vidmlldy9Ccm93c2VyVmlldyBibG9ja2luZyBpcyBoYW5kbGVkIHNlcGFyYXRlbHkgdmlhIElQQyBpbiBpcGNoYW5kbGVyLmpzIG9yIG1vZGUtc3BlY2lmaWMgaGFuZGxlcnMgYmVsb3dcbiAgICAgICAgY29uc3QgZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyID0gW1wiZ2Zvcm1zXCIsIFwid2Vic2l0ZVwiLCBcImVkdXZpZHVhbFwiLCBcImVkaXRvclwiLCBcInJkcFwiLCBcIm1pY3Jvc29mdDM2NVwiLCBcImFjdGl2ZXNoZWV0c1wiLCBcIm1hdGhcIl07XG4gICAgICAgIGlmIChleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIuaW5jbHVkZXMoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIFZ1ZSBhcHAgKGUuZy4gZnJvbSBQREYgbGlua3MgaW4gZXhhbWhlYWRlcilcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IG5ldyB3aW5kb3dzIGZyb20gb3BlbmluZyBpbiB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBuZXctd2luZG93XCIsIHVybCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICBcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIHNldFdpbmRvd09wZW5IYW5kbGVyXCIsIHVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgTWljcm9zb2Z0IEV4Y2VsL1dvcmRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIil7ICAvLyBkbyBub3QgdW5kZXIgYW55IGNpcmN1bXN0YW5jZXMgYWxsb3cgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGN1cnJlbnQgZXhhbSB1cmxcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YW50cyB0byBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyBwYWdlXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImRvIG5vdCBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyB0ZXN0Li4gXCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICBcbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRlQ29kZSA9ICBgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGxvY2soKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICdXQUNEaWFsb2dPdXRlckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ0lubmVyQ29udGFpbmVyJywnV0FDRGlhbG9nUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGlkZXVzQnlJRCA9IFsnU2hvd0hpZGVFcXVhdGlvblRvb2xzUGFuZScsJ0xpbmtHcm91cCcsJ0dyYXBoaWNzRWRpdG9yJywnSW5zZXJ0VGFibGVPZkNvbnRlbnRzSW5JbnNlcnRUYWInLCdJbnNlcnRPbmxpbmV2aWRlbycsJ1BpY3R1cmUnLCdSaWJib24tUGljdHVyZU1lbnVNTFJEcm9wZG93bicsJ0luc2VydEFkZEluRmx5b3V0JywnRGVzaWduZXInLCdFZGl0b3InLCdGYXJQYW5lJywnSGVscCcsJ0luc2VydEFwcHNGb3JPZmZpY2UnLCdGaWxlTWVudUxhdW5jaGVyQ29udGFpbmVyJywnSGVscC13cmFwcGVyJywnUmV2aWV3LXdyYXBwZXInLCdIZWFkZXInLCdGYXJQZXJpcGhlcmFsQ29udHJvbHNDb250YWluZXInLCdCdXNpbmVzc0JhciddXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGVudHJ5IG9mIGhpZGV1c0J5SUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudHJ5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImRpc3BsYXlcIiwgXCJub25lXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJ1dHRvbkFwcHNPdmVyZmxvdyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdBZGQtSW5zJylbMF07ICAvLyB0aGlzIGJ1dHRvbiBpcyByZWRyYXduIG9uIHJlc2l6ZSAoZG9lc24ndCBoYXBwZW4gaW4gZXhhbSBtb2RlIGJ1dCBzdGlsbCB0aGVyZSBtdXN0IGJlIGEgY2xlYW5lciB3YXkgLSBpbnNlcnRpbmcgY3NzIGJlZm9yZSBpdCBhcHBlYXJzIGlzIG5vdCB3b3JraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1dHRvbkFwcHNPdmVyZmxvdyl7IGJ1dHRvbkFwcHNPdmVyZmxvdy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlN1Y2hlblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlx1MDBEQ2JlcnNldHplblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkNvcGlsb3RcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQWRkLUluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBDb250ZXh0TWVudVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwU3lub255bXNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUmliYm9uLVJlZmVyZW5jZXNTbWFydExvb2tVcFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkRpY3RhdGlvblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiR2V0QWRkaW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJQaWN0dXJlc19NTFJcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2NrKCkgIC8vZm9yIHNvbWUgcmVhc29uIGV4Y2VsIGRlbGF5cyB0aGF0IGNhbGwuLiBkb2VzbnQgaGFwcGVuIG9uIHBhZ2UgZmluaXNoIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgYFxuXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGVySW5zdGFuY2UgPSBudWxsXG4gICAgICAgICAgICB0aGlzLmxvY2tDYWxsYmFjayA9ICgpID0+IHRoaXMubG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKTsgXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZSA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMubG9ja0NhbGxiYWNrLCA0MDApXG4gICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBzY2hlZHVsZXJJbnN0YW5jZVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RhcnQoKVxuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgd2ViQ29udGVudHMgaXMgZnVsbHkgbG9hZGVkICAvLyB0aGlzIGlzIG5vdCB3b3JraW5nIHJlbGlhYmx5IGJlY2F1c2UgdGhlIHBhZ2UgaXMgbG9hZGVkIGluIG1hbnkgc3RlcHMgYW5kIHRoZSB1aSBlbGVtZW50cyBhcmUgbm90IGF2YWlsYWJsZSB5ZXRcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignYXBwLWNvbW1hbmQnLCAoZSwgY21kKSA9PiB7XG4gICAgICAgICAgICAvLyAnYnJvd3Nlci1iYWNrd2FyZCcgdW5kICdicm93c2VyLWZvcndhcmQnIHNpbmQgZGllIEJlZmVobGUsIGRpZSBiZWltIEtsaWNrIGF1ZiBkaWUgTWF1c3Rhc3RlbiBnZXNlbmRldCB3ZXJkZW5cbiAgICAgICAgICAgIGlmIChjbWQgPT09ICdicm93c2VyLWJhY2t3YXJkJyB8fCBjbWQgPT09ICdicm93c2VyLWZvcndhcmQnKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJubyBuYXZpZ2F0aW9uIGFsbG93ZWRcIilcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcm4gU2llIGRhcyBTdGFuZGFyZHZlcmhhbHRlblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIC8vZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpICAvL2RvIG5vdCBkaXNhYmxlIHR3aWNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBsb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2Upe1xuICAgICAgICBpZiAoYnJvd3NlclZpZXcud2ViQ29udGVudHMgJiYgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lKXtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiLCBmcmFtZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChmcmFtZSAmJiAoZnJhbWUubmFtZSA9PT0gJ1dlYkFwcGxpY2F0aW9uRnJhbWUnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9Xb3JkXzAnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9FeGNlbF8wJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogc3RvcHBpbmcgbG9ja1NjaGVkdWxlclwiKVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RvcCgpXG4gICAgICAgICAgICBpZiAodGhpcy5sb2NrU2NoZWR1bGVyID09PSBzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBubyBicm93c2VyVmlldyBvciBsb2NrU2NoZWR1bGVyIGZvdW5kXCIpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIFxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBNQUlOIFdJTkRPV1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgYXN5bmMgY3JlYXRlTWFpbldpbmRvdygpIHtcbiAgICAgICAgbGV0IHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpO1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClbMF1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdpbmRvdyBkaW1lbnNpb25zIC0gZGVmaW5lZCBvbmNlLCB1c2VkIGV2ZXJ5d2hlcmVcbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSAxMDI0XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IDY0MFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBjZW50ZXIgcG9zaXRpb24gb24gcHJpbWFyeSBkaXNwbGF5XG4gICAgICAgIGxldCB4ID0gMFxuICAgICAgICBsZXQgeSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgeCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLndpZHRoIC0gd2luZG93V2lkdGgpIC8gMilcbiAgICAgICAgICAgIHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueSArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy5oZWlnaHQgLSB3aW5kb3dIZWlnaHQpIC8gMilcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTWFpbiB3aW5kb3cnLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHksXG4gICAgICAgICAgICB3aWR0aDogd2luZG93V2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHdpbmRvd0hlaWdodCxcbiAgICAgICAgICAgIG1pbldpZHRoOiA4NTAsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IDYwMCxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGFzIFx1MDBDNG5kZXJuIGRlciBHclx1MDBGNlx1MDBERmUgIFxuICAgICAgICAgICAgZnVsbHNjcmVlbmFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRlbiBWb2xsYmlsZG1vZHVzIC0gd2ljaHRpZyBmXHUwMEZDciBtYWNvcyBkZW5uIHdlbm4gYXVmIG1hY29zIGRhcyBtYWlud2luZG93IGF1ZiBmdWxsc2NyZWVuIGlzdCBncmVpZnQgYmVpbSBleGFtd2luZG93IGRlciBraW9zayBtb2RlIG5pY2h0ICAtIGVsZWN0cm9uIGJ1ZyAobmVlZHMgZXhhbXBsZSBjb2RlKTogPj4gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy80NDc1NVxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIC8vdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIFxuICAgICAgICAgICBcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcGF0aC5yZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50RGlyLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04pXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kVGhyb3R0bGluZzogdHJ1ZSAgLy8gYWxsb3cgdGhyb3R0bGluZyB3aGVuIHdpbmRvdyBpcyBpbiBiYWNrZ3JvdW5kXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnMgYmVmb3JlIGxvYWRpbmdcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIGFzayBiZWZvcmUgY2xvc2luZ1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiAhdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCkgeyAgLy8gYWxsb3dleGl0IGlzdCBlaW4gb3ZlcnJpZGUgdm9tIGNvbnRleHQgbWVudSBvZGVyIHNjcmVlbnNob3QgdGVzdC4gZGllc2VyIGthbm4gZGllIGFwcCBzY2hsaWVzc2VuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4pe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhhcyBubyBsZWdhY3kgdHJheVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsbG93VHJheSkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogR05PTUUgZGV0ZWN0ZWQsIHF1aXR0aW5nIGluc3RlYWQgb2YgdHJheSBtaW5pbWl6ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7ICAvLyBhbGxvdyBjbG9zZSBmbG93XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNob3dNaW5pbWl6ZVdhcm5pbmcoKVxuICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IE1pbmltaXppbmcgTmV4dC1FeGFtIHRvIFN5c3RlbXRyYXlgKSAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2V0IHdpbmRvdyBwcm9wZXJ0aWVzIGltbWVkaWF0ZWx5IGFmdGVyIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmZvY3VzKClcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAvL3RoaXMubWFpbndpbmRvdy5zZXRIaWRkZW5Jbk1pc3Npb25Db250cm9sKHRydWUpXG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbXCJERUJVR1wiXSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBnZXRSZW5kZXJlckluZGV4UGF0aCgpO1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9YFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIFVSTDogJHt1cmx9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBhc3luYyBzaG93RXhpdFdhcm5pbmcobWVzc2FnZSl7XG4gICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09rJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBCZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dFeGl0UXVlc3Rpb24oKXtcbiAgICAgICAgaWYgKHRoaXMuZXhpdFF1ZXN0aW9uT3Blbikge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZGlhbG9nIGFscmVhZHkgb3Blbiwgc2tpcHBpbmdcIilcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ0phJywgJ05laW4nXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIGJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdXb2xsZW4gc2llIGRpZSBBbndlbmR1bmcgTmV4dC1FeGFtIGJlZW5kZW4/JyxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZihjaG9pY2UucmVzcG9uc2UgPT0gMSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZG8gbm90IGNsb3NlIE5leHQtRXhhbSBhZnRlciBmaW5pc2hlZCBFeGFtXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93TWluaW1pemVXYXJuaW5nKCl7XG4gICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW5mbycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWluaW1pemUgdG8gU3lzdGVtIFRyYXknLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdEaWUgQW53ZW5kdW5nIE5leHQtRXhhbSB3dXJkZSBtaW5pbWllcnQhJyxcbiAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogQWRkaXRpb25hbCBGdW5jdGlvbnNcbiAgICAgKi9cblxuICAgIGlzV2F5bGFuZCgpe1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnOyBcbiAgICB9XG5cbiAgICAvLyB0aGlzIGZ1bmN0aW9uIHVzZXMgYWN0aXZlLXdpbiB0byByZWNlaXZlIG5hbWUgYW5kIHVybCBmcm9tIGFjdGl2ZSB3aW5kb3cgLSB5ZXQgYW5vdGhlciB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGUgZm9jdXMgaXMgc3RpbGwgb24gbmV4dGV4YW1cbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gaW50cm9kdWNlIGV4ZW1wdGlvbnMgZm9yIHRoZSBibHVyIGxpc3RlbmVyXG4gICAgLy8gKGRvd25ncmFkZWQgZnJvbSBnZXQtd2luZG93cyBiZWNhdXNlIG9mIG5hcGkgdjkgaXNzdWUpIGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvZ2V0LXdpbmRvd3MvaXNzdWVzLzE4NlxuICAgIGFzeW5jIHdpbmRvd1RyYWNrZXIoKXtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgLy8gY29uc3QgZ2V0d2luID0gYXdhaXQgdGhpcy5nZXRBY3RpdmVXaW5kb3coKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZVdpbiA9IGF3YWl0IGFjdGl2ZVdpbmRvdygpXG4gICAgICAgICBcbiAgICAgICAgICAgIGlmIChhY3RpdmVXaW4gJiYgYWN0aXZlV2luLm93bmVyICYmIGFjdGl2ZVdpbi5vd25lci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgbGV0IG5hbWUgPSBhY3RpdmVXaW4ub3duZXIubmFtZVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aCA9IGFjdGl2ZVdpbi5vd25lci5wYXRoXG4gICAgICAgICAgICAgICAgbGV0IG5hbWVMb3dlciA9IG5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aExvd2VyID0gd3BhdGgudG9Mb3dlckNhc2UoKVxuXG4gICAgICAgICAgICAgICAgaWYgKG5hbWVMb3dlci5pbmNsdWRlcyhcImV4YW1cIikgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwibmV4dFwiKSAgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwiZWxlY3Ryb25cIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJlYXNlb2ZhY2Nlc3NkaWFsb2dcIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJkaXNhYmxlLXNob3J0Y3V0c1wiKSApeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGZva3VzIGlzIG9uIGFsbG93ZWQgd2luZG93IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgLy9mb2N1cyBpcyBub3Qgb24gbmV4dC1leGFtIG9yIGFueSBvdGhlciBhbGxvd2VkIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5mb2N1c1RhcmdldEFsbG93ZWQpeyAgLy9sb2cganVzdCBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6IGZvY3VzIGxvc3QgZXZlbnQgd2FzIHRyaWdnZXJlZC4gYXBwOiAke3dwYXRofSAtICR7bmFtZX0gYClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogJHtlcnJ9YCkgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2FkZHMgYmx1ciBsaXN0ZW5lciB3aGVuIGVudGVyaW5nIGV4YW1tb2RlICAgLy8gYmx1ciBldmVudCBpc250IGZpcmVkIG9uIG1hY29zIE1JU1NJT05DT05UUk9MICh3aGljaCBjYW50IGJlIGRlYWN0aXZhdGVkIGFueW1vcmUpIC0gZGFtbiB5b3UgYXBwbGUhXG4gICAgYWRkQmx1ckxpc3RlbmVyKHdpbmRvdyA9IFwiZXhhbXdpbmRvd1wiKXtcbiAgICAgICAgaWYgKHdpbmRvdyA9PT0gXCJleGFtd2luZG93XCIpeyBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fWApXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudCh0aGlzKSkgXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2luZG93ID09PSBcInNjcmVlbmxvY2tcIikge1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9d2luZG93YClcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50U2NyZWVubG9jayh0aGlzKSkgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvL3JlbW92ZXMgYmx1ciBsaXN0ZW5lciB3aGVuIGxlYXZpbmcgZXhhbSBtb2RlXG4gICAgcmVtb3ZlQmx1ckxpc3RlbmVyKCl7XG4gICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZUFsbExpc3RlbmVycygnYmx1cicpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCByZW1vdmVCbHVyTGlzdGVuZXI6IHJlbW92aW5nIGJsdXIgbGlzdGVuZXJcIilcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBpbXBsZW1lbnRpbmcgYSBzbGVlcCAod2FpdCkgZnVuY3Rpb25cbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgIC8vc3R1ZGVudCBmb2d1cyB3ZW50IHRvIGFub3RoZXIgd2luZG93XG4gICAgYXN5bmMgYmx1cmV2ZW50KHdpbmhhbmRsZXIpIHsgXG5cbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBzdHVkZW50IHRyaWVkIHRvIGxlYXZlIGV4YW0gd2luZG93XCIpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcpe1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53aW5kb3dUcmFja2VyKCkgIC8vY2hlY2tzIGlmIG5ldyBmb2N1cyB3aW5kb3cgaXMgYWxsb3dlZFxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3d0cmFja2VyIGNoZWNrIGRvbmUuLi5cIilcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgc2NyZWVubG9jayB3aW5kb3dzIGZyb20gYXJyYXkgYW5kIGNoZWNrIGlmIGFueSBzdGlsbCBleGlzdFxuICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIGNvbnN0IGhhc0FjdGl2ZVNjcmVlbmxvY2sgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLnNvbWUod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkgJiYgd2luLmlzVmlzaWJsZSgpKVxuICAgICAgICAvLyBBbHNvIGNoZWNrIGNsaWVudGluZm8uc2NyZWVubG9jayBmbGFnIGFzIGZhbGxiYWNrIGluIGNhc2UgYXJyYXkgd2FzIGNsZWFyZWQgYnV0IHdpbmRvd3Mgc3RpbGwgZXhpc3RcbiAgICAgICAgaWYgKGhhc0FjdGl2ZVNjcmVlbmxvY2sgfHwgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LnNjcmVlbmxvY2spIHsgcmV0dXJuIH0vLyBkbyBub3RoaW5nIGlmIHNjcmVlbmxvY2t3aW5kb3cgc3RvbGUgZm9jdXMgLy8gZG8gbm90IHRyaWdnZXIgYW4gaW5maW5pdGUgbG9vcCBiZXR3ZWVuIGV4YW0gd2luZG93IGFuZCBzY3JlZW5sb2NrIHdpbmRvdyAoc3RlYWxpbmcgZWFjaCBvdGhlcnMgZm9jdXMgYmVjYXVzZSBzY3JlZW5sb2Nrd2luZG93IGFwcGVhcnMgYWJvdmUgZXhhbSB3aW5kb3cgYW5kIHdpbGwgY2FwdHVyZSBhIGtsaWNrIGFuZCB0aGVyZWZvcmUgc3RlYWwgZm9jdXMpXG4gICAgICAgIGlmICh3aW5oYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCl7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7IC8vdHJvdHpkZW0gZm9jdXMgenVyXHUwMEZDY2sgYXVmIGRpZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBibHVyZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2UgICAvL2luZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuXG4gICAgICAgIC8vdHVybiB2b2x1bWUgdXAgXl5cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgc3Bhd24oJ3Bvd2Vyc2hlbGwnLCBbJ1NldC1Wb2x1bWVMZXZlbCAtTGV2ZWwgMTAwOyBTZXQtVm9sdW1lTXV0ZSAtTXV0ZSAkZmFsc2UnXSk7IH1cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgZXhlYygnb3Nhc2NyaXB0IC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgdm9sdW1lIDEwMFwiIC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgbXV0ZWQgZmFsc2VcIicpOyB9ICBcbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHsgXG4gICAgICAgIC8vICAgICBleGVjKCdhbWl4ZXIgc2V0IE1hc3RlciAxMDAlICcpO1xuICAgICAgICAvLyAgICAgZXhlYygncGFjdGwgc2V0LXNpbmstbXV0ZSBgcGFjdGwgZ2V0LWRlZmF1bHQtc2lua2AgMCcpO1xuICAgICAgICAvLyB9XG4gICAgICAgIFxuICAgICAgICAvL3dlIGNvdWxkIHBsYXkgYSBzb3VuZCBmaWxlIGhlcmUuLiB0YmQuICBcbiAgICB9XG4gICAgLy9zcGVjaWFsIGJsdXIgZXZlbnQgZm9yIHRlbXBvcmFyeSBsb3cgc2VjdXJpdHkgc2NyZWVubG9ja1xuICAgIGJsdXJldmVudFNjcmVlbmxvY2sod2luaGFuZGxlcikgeyBcbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogYmx1ci1zY3JlZW5sb2NrIHRyaWdnZXJlZFwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9kb24ndCBjeWNsZSB0aHJvdWdoIGFsbCBvZiB0aGVtIC4uIGl0IHdpbGwgY3JlYXRlIGFuIGluZmluaXRlIGZvY3VzIHJhY2VcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uc2hvdygpOyAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0ubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogJHtlcnJ9YClcbiAgICAgICAgfVxuICAgIFxuICAgIH1cbiAgICBcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgV2luZG93SGFuZGxlcigpXG4gXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXRcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIG1vc3Qgb2YgdGhlIGtleWJvYXJkIHJlc3RyaWN0aW9ucyBjb3VsZCBiZSBoYW5kbGVkIGJ5IFwiaW9ob29rXCIgZm9yIGFsbCBwbGF0Zm9ybXNcbiAqIHVuZm9ydHVuYWxldHkgaXQncyBub3QgeWV0IHJlbGVhc2VkIGZvciBub2RlIHYxNi54IGFuZCBlbGVjdHJvbiB2MTYueCAgKGFsc28gaXQncyBcImJpZyBzdXJcIiBpbnRlbCBvbmx5IG9uIG1hY3MpXG4gKiBodHRwczovL3dpbGl4LXRlYW0uZ2l0aHViLmlvL2lvaG9vay9pbnN0YWxsYXRpb24uaHRtbFxuICpcbiAqIFwibm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyXCIgd291bGQgYmUgYW5vdGhlciBzb2x1dGlvbiBmb3Igd2luZG93cyBhbmQgbWFjb3MgKGFsdGhvdWdoIGl0IHJlcXVpcmVzIFwiYWNjZXNzYWJpbGl0eVwiIHBlcm1pc3Npb25zIG9uIG1hYylcbiAqIGJ1dCBmb3Igbm93IGl0IHNlZW1zIHRoZSBtb2R1bGUgY2FuIG5vdCBydW4gaW4gYSBmaW5hbCBlbGVjdHJvbiBidWlsZFxuICogaHR0cHM6Ly9naXRodWIuY29tL0xhdW5jaE1lbnUvbm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyL2lzc3Vlcy8xOFxuICpcbiAqIGhhcmRjb2RpbmcgdGhlIGtleWJvYXJkc2hvcnRjdXRzIHdlIHdhbnQgdG8gY2FwdHVyZSBpbnRvIGlvaG9vayhvciBuLWctay1sKSBhbmQgbWFudWFsbHkgY29tcGlsaW5nIGl0IGZvciBtYWMgYW5kIHdpbmRvd3MgY291bGQgYmUgZG9uZSAtIChidXQgbm90IHVudGlsIGkgZ2V0IHBhaWQgZm9yIHRoaXMgYW1vdW50IG9mIHdvcmsgOy0pXG4gKi9cblxuXG4vKipcbiAqIHRoZSBuZXh0IGJlc3Qgc29sdXRpb24gaSBjYW1lIHVwIHdpdGggaXMgdG8ga2lsbCBhbGwgb2YgdGhlIHNoZWxscyAtIHN0YXJ0aW5nIHdpdGggZXhwbG9yZXIuZXhlIGJlY2F1c2UgaXRzIGFic29sdXRlbHkgaW1wb3NzaWJsZSB0b1xuICogZGVhY3RpdmF0ZSB0aGlzIG5hc3R5IFwid2luZG93c1wiIGJ1dHRvbiBvciAzRmluZ2VyU2xpZGVVcCBHZXN0dXJlIGluIHdpbmRvd3MgMTEgLSB5b3UgY291bGQgZWRpdCB0aGUgcmVnaXN0cnkgYW5kIHJlYm9vdCBidXQgdGhhdHMgb2J2aW91c2x5IG5vdCB3aGF0IHdlIHdhbnRcbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgY2xpcGJvYXJkLCBnbG9iYWxTaG9ydGN1dCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IFNjaGVkdWxlclNlcnZpY2UgfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBlbmFibGVMaW51eFJlc3RyaWN0aW9ucywgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbGluLmpzJztcbmltcG9ydCB7IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMsIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvd2luLmpzJztcbmltcG9ydCB7IGVuYWJsZU1hY1Jlc3RyaWN0aW9ucywgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biBhcyB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbCB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL21hYy5qcyc7XG5cbmxldCBjbGlwYm9hcmRJbnRlcnZhbDtcbmxldCBjb25maWdTdG9yZSA9IHtcbiAgICBsaW51eDoge30sXG4gICAgd2luZG93czoge30sXG4gICAgbWFjb3M6IHt9XG59O1xuXG4vLyBsaXN0IG9mIGFwcHMgd2UgZG8gbm90IHdhbnQgdG8gcnVuIGluIGJhY2tncm91bmRcbmNvbnN0IGFwcHNUb0Nsb3NlID0gWydHb29nbGUgQ2hyb21lJywgJ2Nocm9tZScsICdnb29nbGUtY2hyb21lJywgJ01pY3Jvc29mdCBFZGdlJywgJ21zZWRnZScsICdmaXJlZm94JywgJ3NhZmFyaScsICdicmF2ZScsICdvcGVyYScsICdjaGF0Z3B0JywgJ0NoYXRHUFQnLCAnTm9ydG9uU2VjdXJpdHknLCAnTkFWJywgJ1RlYW1zJywgJ21zLXRlYW1zJywgJ3pvb20udXMnLCAnTWljcm9zb2Z0IFRlYW1zJywgJ2Rpc2NvcmQnLCAnem9vbScsICd0ZWFtcycsICd0ZWFtdmlld2VyJywgJ3NreXBlZm9ybGludXgnLCAnc2t5cGUnLCAnYW55ZGVzayddO1xuXG5hc3luYyBmdW5jdGlvbiBlbmFibGVSZXN0cmljdGlvbnMod2luaGFuZGxlcikge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG5cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBwbGF0Zm9ybSByZXN0cmljdGlvbnNcIik7XG5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgY2xpcGJvYXJkLmNsZWFyKCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSgoKSA9PiB7IGNsaXBib2FyZC5jbGVhcigpOyB9LCAxMDAwKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdGFydCgpO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBlbmFibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSwgYXBwc1RvQ2xvc2UsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0tERSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzR05PTUUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgYXdhaXQgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpc2FibGVSZXN0cmljdGlvbnMoKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogcmVtb3ZpbmcgcmVzdHJpY3Rpb25zLi4uXCIpO1xuXG4gICAgaWYgKGNsaXBib2FyZEludGVydmFsKSB7XG4gICAgICAgIGNsaXBib2FyZEludGVydmFsLnN0b3AoKTtcbiAgICB9XG5cbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bkltcGwoZW5hYmxlKTtcbn1cblxuZXhwb3J0IHsgZW5hYmxlUmVzdHJpY3Rpb25zLCBkaXNhYmxlUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIH07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIExpbnV4LXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHVuZm9ydHVuYXRlbHkgdGhlcmUgaXMgbm8gY29udmVuaWVudCB3YXkgZm9yIGdub21lLXNoZWxsIHRvIHVuLXNldCBBTEwgc2hvcnRjdXRzIGF0IG9uY2VcbmNvbnN0IGdub21lS2V5YmluZGluZ3MgPSBbXG4gICAgJ2FjdGl2YXRlLXdpbmRvdy1tZW51JywnbWF4aW1pemUtaG9yaXpvbnRhbGx5JywnbW92ZS10by1zaWRlLW4nLCdtb3ZlLXRvLXdvcmtzcGFjZS04Jywnc3dpdGNoLWFwcGxpY2F0aW9ucycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMycsJ3N3aXRjaC13aW5kb3dzLWJhY2t3YXJkJyxcbiAgICAnYWx3YXlzLW9uLXRvcCcsJ21heGltaXplLXZlcnRpY2FsbHknLCdtb3ZlLXRvLXNpZGUtcycsJ21vdmUtdG8td29ya3NwYWNlLTknLCdzd2l0Y2gtYXBwbGljYXRpb25zLWJhY2t3YXJkJywnICBzd2l0Y2gtdG8td29ya3NwYWNlLTQnLCd0b2dnbGUtYWJvdmUnLFxuICAgICdiZWdpbi1tb3ZlJywnbWluaW1pemUnLCdtb3ZlLXRvLXNpZGUtdycsJ21vdmUtdG8td29ya3NwYWNvZS1kb3duJywnc3dpdGNoLWdyb3VwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS01JywndG9nZ2xlLWZ1bGxzY3JlZW4nLFxuICAgICdiZWdpbi1yZXNpemUnLCdtb3ZlLXRvLWNlbnRlcicsJ21vdmUtdG8td29ya3NwYWNlLTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sYXN0Jywnc3dpdGNoLWdyb3VwLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS02JywndG9nZ2xlLW1heGltaXplZCcsXG4gICAgJ2Nsb3NlJywnbW92ZS10by1jb3JuZXItbmUnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMCcsJ21vdmUtdG8td29ya3NwYWNlLWxlZnQnLCdzd2l0Y2gtaW5wdXQtc291cmNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS03JywndG9nZ2xlLW9uLWFsbC13b3Jrc3BhY2VzJyxcbiAgICAnY3ljbGUtZ3JvdXAnLCdtb3ZlLXRvLWNvcm5lci1udycsJ21vdmUtdG8td29ya3NwYWNlLTExJywnbW92ZS10by13b3Jrc3BhY2UtcmlnaHQnLCdzd2l0Y2gtaW5wdXQtc291cmNlLWJhY2t3YXJkICBzd2l0Y2gtdG8td29ya3NwYWNlLTgnLCd0b2dnbGUtc2hhZGVkJyxcbiAgICAnY3ljbGUtZ3JvdXAtYmFja3dhcmQnLCdtb3ZlLXRvLWNvcm5lci1zZScsJ21vdmUtdG8td29ya3NwYWNlLTEyJywnbW92ZS10by13b3Jrc3BhY2UtdXAnLCdzd2l0Y2gtcGFuZWxzJywnc3dpdGNoLXRvLXdvcmtzcGFjZS05JywndW5tYXhpbWl6ZScsXG4gICAgJ2N5Y2xlLXBhbmVscycsJ21vdmUtdG8tY29ybmVyLXN3JywnbW92ZS10by13b3Jrc3BhY2UtMicsJ3BhbmVsLW1haW4tbWVudScsJ3N3aXRjaC1wYW5lbHMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWRvd24nLFxuICAgICdjeWNsZS1wYW5lbHMtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItZG93bicsJ21vdmUtdG8td29ya3NwYWNlLTMnLCdwYW5lbC1ydW4tZGlhbG9nJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sYXN0JyxcbiAgICAnY3ljbGUtd2luZG93cycsJ21vdmUtdG8tbW9uaXRvci1sZWZ0JywnbW92ZS10by13b3Jrc3BhY2UtNCcsJ3JhaXNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGVmdCcsXG4gICAgJ2N5Y2xlLXdpbmRvd3MtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItcmlnaHQnLCdtb3ZlLXRvLXdvcmtzcGFjZS01JywncmFpc2Utb3ItbG93ZXInLCdzd2l0Y2gtdG8td29ya3NwYWNlLTExJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1yaWdodCcsXG4gICAgJ2xvd2VyJywnbW92ZS10by1tb25pdG9yLXVwJywnbW92ZS10by13b3Jrc3BhY2UtNicsJ3NldC1zcGV3LW1hcmsnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS11cCcsXG4gICAgJ21heGltaXplJywnbW92ZS10by1zaWRlLWUnLCdtb3ZlLXRvLXdvcmtzcGFjZS03Jywnc2hvdy1kZXNrdG9wJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0yJywnc3dpdGNoLXdpbmRvd3MnXG5dO1xuY29uc3QgZ25vbWVTaGVsbEtleWJpbmRpbmdzID0gWydmb2N1cy1hY3RpdmUtbm90aWZpY2F0aW9uJywnb3Blbi1hcHBsaWNhdGlvbi1tZW51Jywnc2NyZWVuc2hvdCcsJ3NjcmVlbnNob3Qtd2luZG93Jywnc2hpZnQtb3ZlcnZpZXctZG93bicsXG4gICAgJ3NoaWZ0LW92ZXJ2aWV3LXVwJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTEnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0zJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTQnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNScsXG4gICAgJ3N3aXRjaC10by1hcHBsaWNhdGlvbi02Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTcnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi05Jywnc2hvdy1zY3JlZW5zaG90LXVpJywnc2hvdy1zY3JlZW4tcmVjb3JkaW5nLXVpJyxcbiAgICAndG9nZ2xlLWFwcGxpY2F0aW9uLXZpZXcnLCd0b2dnbGUtbWVzc2FnZS10cmF5JywndG9nZ2xlLW92ZXJ2aWV3J107XG5jb25zdCBnbm9tZU11dHRlcktleWJpbmRpbmdzID0gWydyb3RhdGUtbW9uaXRvcicsJ3N3aXRjaC1tb25pdG9yJywndGFiLXBvcHVwLWNhbmNlbCcsJ3RhYi1wb3B1cC1zZWxlY3QnLCd0b2dnbGUtdGlsZWQtbGVmdCcsJ3RvZ2dsZS10aWxlZC1yaWdodCddO1xuY29uc3QgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MgPSBbJ2FwcC1jdHJsLWhvdGtleS0xJywnYXBwLWN0cmwtaG90a2V5LTEwJywnYXBwLWN0cmwtaG90a2V5LTInLCdhcHAtY3RybC1ob3RrZXktMycsJ2FwcC1jdHJsLWhvdGtleS00JywnYXBwLWN0cmwtaG90a2V5LTUnLFxuICAgICdhcHAtY3RybC1ob3RrZXktNicsJ2FwcC1jdHJsLWhvdGtleS03JywnYXBwLWN0cmwtaG90a2V5LTgnLCdhcHAtY3RybC1ob3RrZXktOScsXG4gICAgJ2FwcC1ob3RrZXktMScsJ2FwcC1ob3RrZXktMTAnLCdhcHAtaG90a2V5LTInLCdhcHAtaG90a2V5LTMnLCdhcHAtaG90a2V5LTQnLCdhcHAtaG90a2V5LTUnLCdhcHAtaG90a2V5LTYnLCdhcHAtaG90a2V5LTcnLCdhcHAtaG90a2V5LTgnLCdhcHAtaG90a2V5LTknLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTEnLCdhcHAtc2hpZnQtaG90a2V5LTEwJywnYXBwLXNoaWZ0LWhvdGtleS0yJywnYXBwLXNoaWZ0LWhvdGtleS0zJywnYXBwLXNoaWZ0LWhvdGtleS00JywnYXBwLXNoaWZ0LWhvdGtleS01JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS02JywnYXBwLXNoaWZ0LWhvdGtleS03JywnYXBwLXNoaWZ0LWhvdGtleS04JywnYXBwLXNoaWZ0LWhvdGtleS05Jywnc2hvcnRjdXQnXTtcbmNvbnN0IGdub21lV2F5bGFuZEtleWJpbmRpbmdzID0gWydzd2l0Y2gtdG8tc2Vzc2lvbi0xJywnc3dpdGNoLXRvLXNlc3Npb24tMicsJ3N3aXRjaC10by1zZXNzaW9uLTMnLCdzd2l0Y2gtdG8tc2Vzc2lvbi00Jywnc3dpdGNoLXRvLXNlc3Npb24tNScsJ3N3aXRjaC10by1zZXNzaW9uLTYnLCdzd2l0Y2gtdG8tc2Vzc2lvbi03Jywnc3dpdGNoLXRvLXNlc3Npb24tOCcsJ3N3aXRjaC10by1zZXNzaW9uLTknLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMCcsJ3N3aXRjaC10by1zZXNzaW9uLTExJywnc3dpdGNoLXRvLXNlc3Npb24tMTInXTtcblxuLyoqXG4gKiBFbmFibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChLREUvR05PTUUsIGNsb3NlIGFwcHMsIGNsaXBib2FyZCkuXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnU3RvcmUgLSBzaGFyZWQgc3RvcmUgKGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMpXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzS0RFXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzR05PTUVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgaXNLREUsIGlzR05PTUUpIHtcbiAgICB0cnkge1xuICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cImAsIChwZ3JlcEVycm9yLCBzdGRvdXQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBncmVwRXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCIgfCB4YXJncyAtciBraWxsIC05YCwgKGtpbGxFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFraWxsRXJyb3IpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICBpZiAoaXNLREUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgS0RFIHJlc3RyaWN0aW9uc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrcmVhZGNvbmZpZzUnLCBbJy0tZmlsZScsICdrd2lucmMnLCAnLS1ncm91cCcsICdEZXNrdG9wcycsICctLWtleScsICdOdW1iZXInXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoa3JlYWRjb25maWcpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IDE7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IHN0ZG91dC50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiByZWNvbmZpZ3VyaW5nIGt3aW5cIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsICdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCdcIlwiJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsJ2t3aW5yYycsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywnMSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdzZXRDdXJyZW50RGVza3RvcCcsJzEnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBlZmZlY3RzXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdkZXNrdG9wZ3JpZCddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnc2NyZWVuZWRnZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnb3ZlcnZpZXcnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGFkZGl0aW9uYWwgdHR5J3NcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJ3NydnJrZXlzOm5vbmUnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xlYXJpbmcgY2xpcGJvYXJkIGhpc3RvcnlcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGdsb2JhbCBrZXlib2FyZHNob3J0Y3V0c1wiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnb3JnLmtkZS5LR2xvYmFsQWNjZWwuYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAndHJ1ZSddKTtcbiAgICAgICAgfSwgMjAwMCk7XG4gICAgfVxuXG4gICAgaWYgKGlzR05PTUUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgR05PTUUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXYXlsYW5kOiBkaXNhYmxlIFZUL1RUWSBzd2l0Y2ggKEN0cmwrQWx0K0YxLi5GMTIpIHZpYSBtdXR0ZXIga2V5YmluZGluZ3NcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmcsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGNvbmYnLCBbJ3dyaXRlJywgYC9vcmcvZ25vbWUvbXV0dGVyL3dheWxhbmQva2V5YmluZGluZ3MvJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleScsIGAnJ2BdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5tdXR0ZXIgZHluYW1pYy13b3Jrc3BhY2VzIGZhbHNlJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUuZGVza3RvcC53bS5wcmVmZXJlbmNlcyBudW0td29ya3NwYWNlcyAxJyk7XG4gICAgICAgICAgICAvLyBYMTEgb25seTogZGlzYWJsZSBUVFkgc3dpdGNoIHZpYSBzZXR4a2JtYXAgKG9uIFdheWxhbmQgd2UgcmVseSBvbiBtdXR0ZXIga2V5YmluZGluZ3MgYWJvdmUpXG4gICAgICAgICAgICBpZiAoIXBsYXRmb3JtRGlzcGF0Y2hlci5pc1dheWxhbmQoKSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3NldHhrYm1hcCAtb3B0aW9uIHNydnJrZXlzOm5vbmUnLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZy53YXJuKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoR05PTUUpOiBzZXR4a2JtYXAgc3J2cmtleXM6bm9uZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxufVxuXG4vKipcbiAqIERpc2FibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIGFuZCByZXN0b3JlIEtERS9HTk9NRSBzZXR0aW5ncy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSkge1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IEtERSBkZXRlY3RlZFwiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ2Jsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ2ZhbHNlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJyAsJy9Db21wb3NpdG9yJywgJ29yZy5rZGUua3dpbi5Db21wb3NpdGluZy5yZXN1bWUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBrZ2xvYmFsYWNjZWw1JicpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCctLWRlbGV0ZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBwbGFzbWFzaGVsbCAmJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcsICdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBiaW5kaW5nXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleSddKTtcbiAgICAvLyByZXN0b3JlIFRUWSBzd2l0Y2ggaWYgd2UgaGFkIGRpc2FibGVkIGl0IHZpYSBzZXR4a2JtYXAgKEdOT01FIFgxMSlcbiAgICBpZiAoY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0KSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKFwic2V0eGtibWFwIC1vcHRpb24gJydcIiwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogc2V0eGtibWFwIHJlc3RvcmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gZmFsc2U7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBXaW5kb3dzLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbi8qKlxuICogRW5hYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChzaG9ydGN1dHMsIGNsb3NlIGFwcHMsIGtpbGwgZXhwbG9yZXIpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gb25lIG1vcmUgbGV2ZWwgdXA6IHJlc3RyaWN0aW9ucy8gLT4gc2NyaXB0cy8gLT4gbWFpbi8gLT4gcGFja2FnZXMvIChzYW1lIHRhcmdldCBhcyBvcmlnaW5hbCBwbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyBpbiBzY3JpcHRzLylcbiAgICAgICAgY29uc3QgZXhlY3V0YWJsZTEgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3B1YmxpYy9kaXNhYmxlLXNob3J0Y3V0cy5leGUnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKGV4ZWN1dGFibGUxLCBbXSwgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnLCBzaGVsbDogZmFsc2UsIHdpbmRvd3NIaWRlOiB0cnVlIH0pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiB3aW5kb3dzIHNob3J0Y3V0cyBkaXNhYmxlZFwiKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAod2luIHNob3J0Y3V0cyk6ICR7ZXJyfWApOyB9XG5cbiAgICB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IGFwcCBvZiBhcHBzVG9DbG9zZSkge1xuICAgICAgICAgICAgY29uc3QgZXNjYXBlZEFwcCA9IGFwcC5yZXBsYWNlKC8nL2csIFwiJydcIik7XG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRhcHBOYW1lID0gJyR7ZXNjYXBlZEFwcH0nOyB0cnkgeyAkcHJvY3MgPSBHZXQtUHJvY2VzcyAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7ICRfLlByb2Nlc3NOYW1lIC1pbGlrZSAoJyonICsgJGFwcE5hbWUgKyAnKicpIH07IGlmICgkcHJvY3MgLWFuZCAkcHJvY3MuQ291bnQgLWd0IDApIHsgJHByb2NzIHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZTsgV3JpdGUtT3V0cHV0ICdraWxsZWQnIH0gfSBjYXRjaCB7IH1cImA7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZUFwcCkgPT4ge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGNvbW1hbmQsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKS5pbmNsdWRlcygna2lsbGVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVBcHAoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICBpZiAoIXdpbmhhbmRsZXIpIHtcbiAgICAgICAgbG9nLndhcm4oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiB3aW5oYW5kbGVyIGlzIG5vdCBwcm92aWRlZCAtIHNraXBwaW5nIGV4cGxvcmVyLmV4ZSBraWxsYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHJldHJ5Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTAwO1xuICAgICAgICBjb25zdCBraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHdpbmhhbmRsZXIuZXhhbXdpbmRvdyAmJiAhd2luaGFuZGxlci5leGFtd2luZG93LmlzRGVzdHJveWVkPy4oKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNra2lsbCAvZiAvaW0gZXhwbG9yZXIuZXhlJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGV4cGxvcmVyLmV4ZWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0cnlDb3VudCA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICByZXRyeUNvdW50Kys7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzLCAxMDApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGV4YW13aW5kb3cgbm90IGZvdW5kIGFmdGVyICR7bWF4UmV0cmllcyAqIDEwMH1tcyAtIHNraXBwaW5nIGV4cGxvcmVyLmV4ZSBraWxsYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMoKTtcbiAgICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBXaW5kb3dzLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAodW5ibG9jayBzaG9ydGN1dHMsIHJlc3RhcnQgZXhwbG9yZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMoKSB7XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHVuYmxvY2tpbmcgc2hvcnRjdXRzLi4uXCIpO1xuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGB0YXNra2lsbCAgL0lNIFwiZGlzYWJsZS1zaG9ydGN1dHMuZXhlXCIgL1QgL0ZgLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkIGRpc2FibGUtc2hvcnRjdXRzLmV4ZWApO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIGV4cGxvcmVyLmV4ZVwiJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGB0YXNrbGlzdCBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXN0ZG91dC5pbmNsdWRlcygnZXhwbG9yZXIuZXhlJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogcmVzdGFydGluZyBleHBsb3Jlci4uLlwiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkUHJvY2Vzcy5leGVjKCdzdGFydCBleHBsb3Jlci5leGUnLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZXJlc3RyaWN0aW9ucyAod2luIGV4cGxvcmVyKTogJHtlLm1lc3NhZ2V9YCk7IH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogbWFjT1Mtc3BlY2lmaWMgcGxhdGZvcm0gcmVzdHJpY3Rpb25zIChlbmFibGUvZGlzYWJsZSwgdG9nZ2xlTWFjT1NMb2NrZG93bikuXG4gKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBUb3VjaEJhciwgc3lzdGVtUHJlZmVyZW5jZXMsIHBvd2VyTW9uaXRvciB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcblxuLy8gc3RvcmVkIHJlZnMgZm9yIGNsZWFudXAgd2hlbiBkaXNhYmxpbmcgbWFjT1MgcmVzdHJpY3Rpb25zXG5sZXQgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBudWxsO1xubGV0IGxvZ1N0cmVhbVByb2Nlc3MgPSBudWxsO1xubGV0IGN1cnJlbnRXaW5oYW5kbGVyID0gbnVsbDtcblxuLyoqIFNpbmdsZSBoYW5kbGVyIGZvciBhbGwgbWFjT1MgcmVzdHJpY3Rpb24gc2lnbmFsczogbG9nIGFuZCByZS1mb2N1cyBleGFtIHdpbmRvdyAvIGluZm9ybSB0ZWFjaGVyLiAqL1xuZnVuY3Rpb24gb25NYWNSZXN0cmljdGlvblNpZ25hbChzaWduYWxOYW1lKSB7XG4gICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiAke3NpZ25hbE5hbWV9IGRldGVjdGVkYCk7XG4gICAgaWYgKCFjdXJyZW50V2luaGFuZGxlcj8uZXhhbXdpbmRvdz8uaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgIGlmIChjdXJyZW50V2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8pIGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGluZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTtcbiAgICB9XG59XG5cbmNvbnN0IGxvY2tTY3JlZW5IYW5kbGVyID0gKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnbG9jay1zY3JlZW4nKTtcbmNvbnN0IHVubG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCd1bmxvY2stc2NyZWVuJyk7XG5cbi8qKlxuICogRW5hYmxlIG1hY09TLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoVG91Y2hCYXIsIGNsaXBib2FyZCwgY2xvc2UgYXBwcywgd29ya3NwYWNlL2xvY2sgbW9uaXRvcmluZykuXG4gKiBAcGFyYW0ge29iamVjdH0gd2luaGFuZGxlciAtIG11c3QgaGF2ZSB3aW5oYW5kbGVyLmV4YW13aW5kb3dcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZU1hY1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSkge1xuICAgIGNvbnN0IHsgVG91Y2hCYXJMYWJlbCwgVG91Y2hCYXJTcGFjZXIgfSA9IFRvdWNoQmFyO1xuICAgIGNvbnN0IHRleHRsYWJlbCA9IG5ldyBUb3VjaEJhckxhYmVsKHsgbGFiZWw6IFwiTmV4dC1FeGFtXCIgfSk7XG4gICAgY29uc3QgdG91Y2hCYXIgPSBuZXcgVG91Y2hCYXIoe1xuICAgICAgICBpdGVtczogW1xuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgICAgIHRleHRsYWJlbCxcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgIF1cbiAgICB9KTtcbiAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3c/LnNldFRvdWNoQmFyKHRvdWNoQmFyKTtcbiAgICBjdXJyZW50V2luaGFuZGxlciA9IHdpbmhhbmRsZXI7XG5cbiAgICBjaGlsZFByb2Nlc3MuZXhlYygncGJjb3B5IDwgL2Rldi9udWxsJyk7XG5cbiAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwa2lsbCAtOSAtZiBcIiR7YXBwfVwiYCwgKGVycm9yLCBzdGRlcnIsIHN0ZG91dCkgPT4ge30pO1xuICAgIH0pO1xuXG4gICAgLy8gd29ya3NwYWNlL3NwYWNlIHN3aXRjaCBhbmQgbG9jay91bmxvY2sgbW9uaXRvcmluZyAobWFjT1Mgb25seSlcbiAgICB0cnkge1xuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IHN5c3RlbVByZWZlcmVuY2VzLnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbignTlNXb3Jrc3BhY2VBY3RpdmVTcGFjZURpZENoYW5nZU5vdGlmaWNhdGlvbicsICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ2Rlc2t0b3Avc3BhY2Ugc3dpdGNoJykpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiBzdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24nLCBlcnIpOyB9XG5cbiAgICBwb3dlck1vbml0b3Iub24oJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vbigndW5sb2NrLXNjcmVlbicsIHVubG9ja1NjcmVlbkhhbmRsZXIpO1xuXG4gICAgbG9nU3RyZWFtUHJvY2VzcyA9IHNwYXduKCdsb2cnLCBbJ3N0cmVhbScsICctLXByZWRpY2F0ZScsICdzdWJzeXN0ZW0gPT0gXCJjb20uYXBwbGUuZG9ja1wiIEFORCBjYXRlZ29yeSA9PSBcIm1pc3Npb25jb250cm9sXCInXSk7XG4gICAgbG9nU3RyZWFtUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICAgICAgaWYgKGRhdGEudG9TdHJpbmcoKS5pbmNsdWRlcygnbW9kZScpKSBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdNaXNzaW9uIENvbnRyb2wnKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBEaXNhYmxlIG1hY09TLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAodG91Y2hiYXIsIG1vbml0b3JpbmcgbGlzdGVuZXJzIGFuZCBsb2cgcHJvY2VzcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zKCkge1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gbnVsbDtcbiAgICBpZiAod29ya3NwYWNlTm90aWZpY2F0aW9uSWQgIT0gbnVsbCkge1xuICAgICAgICB0cnkgeyBzeXN0ZW1QcmVmZXJlbmNlcy51bnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbih3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCk7IH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgbWFjOiB1bnN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cbiAgICAgICAgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBudWxsO1xuICAgIH1cbiAgICBwb3dlck1vbml0b3Iub2ZmKCdsb2NrLXNjcmVlbicsIGxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBwb3dlck1vbml0b3Iub2ZmKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgaWYgKGxvZ1N0cmVhbVByb2Nlc3MpIHtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgIGxvZ1N0cmVhbVByb2Nlc3MgPSBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlcy9lbmFibGVzIG1pc3Npb24gY29udHJvbCwgc3BhY2VzIGFuZCB0cmFja3BhZCBnZXN0dXJlcy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlIC0gdHJ1ZSByZXN0b3JlcyBldmVyeXRoaW5nLCBmYWxzZSBsb2NrcyBldmVyeXRoaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVNYWNPU0xvY2tkb3duKGVuYWJsZSkge1xuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gIT09ICdkYXJ3aW4nKSByZXR1cm47XG4gICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgdG9nZ2xlTWFjT1NMb2NrZG93bjogJHtlbmFibGUgPyAnZW5hYmxlJyA6ICdkaXNhYmxlJ30gbWlzc2lvbiBjb250cm9sIGxvY2tkb3duYCk7XG5cbiAgICBjb25zdCBtY0lkcyA9IFszMiwgMzMsIDM0LCAzNSwgNzksIDgwLCA4MSwgODIsIDExOCwgMTE5LCAxMjAsIDEyMV07XG4gICAgY29uc3QgcGxpc3RQYXRoID0gam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeSwgJ0xpYnJhcnkvUHJlZmVyZW5jZXMvY29tLmFwcGxlLnN5bWJvbGljaG90a2V5cy5wbGlzdCcpO1xuICAgIGNvbnN0IGJhY2t1cFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci50ZW1wZGlyZWN0b3J5LCAnbmV4dF9leGFtX2hvdGtleXNfYmFja3VwLnBsaXN0Jyk7XG5cbiAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgIGNvbnN0IGhvdGtleUNvbW1hbmRzID0gbWNJZHMubWFwKGlkID0+XG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLnN5bWJvbGljaG90a2V5cyBBcHBsZVN5bWJvbGljSG90S2V5cyAtZGljdC1hZGQgJHtpZH0gXCI8ZGljdD48a2V5PmVuYWJsZWQ8L2tleT48ZmFsc2UvPjwvZGljdD5cImBcbiAgICAgICAgKS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGdlc3R1cmVDb21tYW5kcyA9IFtcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93TWlzc2lvbkNvbnRyb2xHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0FwcEV4cG9zZUdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYFxuICAgICAgICBdLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZnVsbENvbW1hbmQgPSBgXG4gICAgICAgIGlmIFsgISAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIGNwIFwiJHtwbGlzdFBhdGh9XCIgXCIke2JhY2t1cFBhdGh9XCI7IGZpO1xuICAgICAgICAke2hvdGtleUNvbW1hbmRzfTtcbiAgICAgICAgJHtnZXN0dXJlQ29tbWFuZHN9O1xuICAgICAgICBraWxsYWxsIC05IGNmcHJlZnNkO1xuICAgICAgICBzbGVlcCAxO1xuICAgICAgICAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvU3lzdGVtQWRtaW5pc3RyYXRpb24uZnJhbWV3b3JrL1Jlc291cmNlcy9hY3RpdmF0ZVNldHRpbmdzIC11O1xuICAgICAgICBraWxsYWxsIERvY2tcbiAgICAgIGA7XG5cbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoZnVsbENvbW1hbmQsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0xvY2tkb3duIEVuYWJsZSBFcnJvcjonLCBlcnIpO1xuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGdlc3R1cmVDb21tYW5kcyA9IFtcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93TWlzc2lvbkNvbnRyb2xHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0Rlc2t0b3BHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYFxuICAgICAgICBdLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZnVsbENvbW1hbmQgPSBgXG4gICAgICAgIGlmIFsgLWYgXCIke2JhY2t1cFBhdGh9XCIgXTsgdGhlbiBcbiAgICAgICAgICBjcCBcIiR7YmFja3VwUGF0aH1cIiBcIiR7cGxpc3RQYXRofVwiOyBcbiAgICAgICAgICBybSBcIiR7YmFja3VwUGF0aH1cIjsgXG4gICAgICAgIGZpO1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcbiAgICAgICAgbG9nLmluZm8oJ21haW4gQCB0b2dnbGVNYWNPU0xvY2tkb3duOiBFbmFibGUgTWlzc2lvbkNvbnRvbCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRGlzYWJsZSBFcnJvcjonLCBlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuJ3VzZSBzdHJpY3QnXG5pbXBvcnQge2Rpc2FibGVSZXN0cmljdGlvbnMsIGVuYWJsZVJlc3RyaWN0aW9uc30gZnJvbSAnLi9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnIFxuaW1wb3J0IGFyY2hpdmVyIGZyb20gJ2FyY2hpdmVyJyAgIC8vIGRhcyBtYWNodCBrcmFzc2VzdGUgcmFjZWNvZGl0aW9ucyBtaXQgZWxlY3Ryb24gZWlnZW5lbiB2ZXJzaW9uZW4gLSB1bmJlZGluZ3QgZGllIHNlbGJlIHZlcnNpb24gYmVoYWx0ZW4gd2llIGVsZWN0cm9uXG5pbXBvcnQgZXh0cmFjdCBmcm9tICdleHRyYWN0LXppcCdcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgc2NyZWVuLCBpcGNNYWluLCBhcHAsIEJyb3dzZXJXaW5kb3csIHdlYkNvbnRlbnRzIH0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnXG5pbXBvcnQgSXBjSGFuZGxlciBmcm9tICcuL2lwY2hhbmRsZXIuanMnXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgVGVzc2VyYWN0IGZyb20gJ3Rlc3NlcmFjdC5qcyc7XG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgc2NyZWVuc2hvdCBmcm9tICdzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCc7XG5pbXBvcnQgeyBXb3JrZXIgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IHJ1blJlbW90ZUNoZWNrIH0gZnJvbSAnLi9yZW1vdGVDaGVjay5qcydcbmltcG9ydCBsYW5ndWFnZVRvb2xTZXJ2ZXIgZnJvbSAnLi9sdC1zZXJ2ZXIuanMnO1xuXG5jb25zdCBzaGVsbCA9IChjbWQpID0+IHsgICByZXR1cm4gZXhlY1N5bmMoY21kLCB7IGVuY29kaW5nOiAndXRmOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KTsgfTsgIC8vIHN0ZGVyciB1bnRlcmRyXHUwMEZDY2t0IFxuY29uc3QgYWdlbnQgPSBuZXcgaHR0cHMuQWdlbnQoeyByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlIH0pO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgXG5cbiAvKipcbiAgKiBIYW5kbGVzIGluZm9ybWF0aW9uIGZldGNoaW5nIGZyb20gdGhlIHNlcnZlciBhbmQgYWN0cyBvbiBzdGF0dXMgdXBkYXRlc1xuICAqL1xuIFxuIGNsYXNzIENvbW1IYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy51cGRhdGVTdHVkZW50SW50ZXJ2YWxsID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEFiaWxpdHkgPSBmYWxzZVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDAgLy8gd2UgY291bnQgZmFpbHMgYW5kIGRlYWN0aXZhdGUgb24gNCBjb25zZXF1ZW50IGZhaWxzXG4gICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSB0cnVlXG4gICAgICAgIHRoaXMudGltZXIgPSAwXG4gICAgICAgIHRoaXMud29ya2VyID0gbnVsbFxuICAgICAgICB0aGlzLnVzZVdvcmtlciA9IHRydWVcbiAgICAgICAgdGhpcy53b3JrZXJGYWlscyA9IDBcbiAgICB9XG4gXG4gICAgaW5pdCAobWMsIGNvbmZpZykge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG1jXG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5yZXF1ZXN0VXBkYXRlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMudXBkYXRlU2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5zZW5kU2NyZWVuc2hvdC5iaW5kKHRoaXMpLCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbClcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgaWYgKCF0aGlzLndvcmtlciAmJiBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgIHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpICB9XG4gICAgfVxuIFxuXG4gICAgLyoqXG4gICAgICogU2V0dXAgdGhlIGltYWdlIHdvcmtlclxuICAgICAqIHVzZXMgZm9yayB0byBjcmVhdGUgYSBuZXcgY2hpbGQgcHJvY2Vzc1xuICAgICAqIHVzZXMgdGhlIGltYWdlV29ya2VyTGludXguanMgb3IgaW1hZ2VXb3JrZXJTaGFycC5qcyBmaWxlXG4gICAgICogdGhlIHdvcmtlciBpcyB1c2VkIHRvIHByb2Nlc3MgdGhlIHNjcmVlbnNob3QgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICovXG4gICAgYXN5bmMgc2V0dXBJbWFnZVdvcmtlcigpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyVVJMID0gcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlclVSTDtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyID0gbmV3IFdvcmtlcih3b3JrZXJVUkwsIHsgdHlwZTogJ21vZHVsZScsIGVudjogeyAuLi5wcm9jZXNzLmVudiB9IH0pO1xuICAgICAgICBsb2cuZGVidWcoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IEltYWdlV29ya2VyIGluaXRpYWxpemVkLiBVc2luZyBcIiArIHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJGaWxlTmFtZSlcbiAgICAgICAgXG5cbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIub24oJ2V4aXQnLCBjb2RlID0+IHtcbiAgICAgICAgICAgIGlmIChjb2RlICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXJGYWlscyArPSAxXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMud29ya2VyRmFpbHMgPiA0KXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGZhaWxlZCA1IHRpbWVzIC0gc3dpdGNoaW5nIHRvIG5vIHByb2Nlc3NpbmcnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgdGhpcy5zZXR1cEltYWdlV29ya2VyKCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNjcmVlbnNob3QgXG4gICAgICogaWYgdXNlV29ya2VyIGlzIHRydWUsIHRoZSBzY3JlZW5zaG90IGlzIHByb2Nlc3NlZCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKiBvdGhlcndpc2UgdGhlIHNjcmVlbnNob3QgaXMgbm90IHByb2Nlc3NlZCBhbmQgdGhlIG9yaWdpbmFsIHNjcmVlbnNob3QgaXMgcmV0dXJuZWRcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSB7XG4gICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMud29ya2VyKSB7IC8vdHJpcGxlIGNoZWNrIGlmIHdvcmtlciBpcyBpbml0aWFsaXplZFxuICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV29ya2VyIG5vdCBpbml0aWFsaXplZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2UoeyBpbWdCdWZmZXI6IEFycmF5LmZyb20oaW1nQnVmZmVyKSwgaW1WZXJzaW9uOiBwbGF0Zm9ybURpc3BhdGNoZXIuaW1WZXJzaW9uIH0pO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JrZXIub25jZSgnbWVzc2FnZScsIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcykgdGhyb3cgbmV3IEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGZhbGxiYWNrIHRvIG5vIHByb2Nlc3NpbmcgICBcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlbnNob3RCYXNlNjQgPSBCdWZmZXIuZnJvbShpbWdCdWZmZXIpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckJhc2U2NCA9IHNjcmVlbnNob3RCYXNlNjRcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHNjcmVlbnNob3RCYXNlNjQ6IHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NDogaGVhZGVyQmFzZTY0LCBpc2JsYWNrOiBmYWxzZSwgaW1nQnVmZmVyOiBpbWdCdWZmZXIgfTtcblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG4gICAgLyoqIFxuICAgICAqIFVwZGF0ZSBjdXJyZW50IFNlcnZlcnN0YXR1cyArIFN0dWRlbnR0c3RhdHVzIChldmVyeSA1IHNlY29uZHMpXG4gICAgICovXG4gICAgYXN5bmMgcmVxdWVzdFVwZGF0ZSgpe1xuXG4gICAgICAgIHRoaXMudGltZXIrKyAgIC8vIHdlIHVzZSB0aW1lciB0byB0aW1lIGxvb3BzIHdpdGggZGlmZmVyZW50IGludGVydmFscyB3aXRob3V0IGludHJvZHVjaW5nIG5ldyB1bm5lY2Nlc2FyeSBzY2hlZHVsZXJzXG4gICAgICAgIGlmICh0aGlzLnRpbWVyICUgMjAgPT09IDAgKXsgIC8vIHJ1biBldmVyeSAyMCo1ICh1cGRhdGVsb29wKSBzZWNvbmRzXG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXNSZW1vdGVBc3Npc3RhbnQgPSBhd2FpdCBydW5SZW1vdGVDaGVjayhwcm9jZXNzLnBsYXRmb3JtKVxuXG4gICAgICAgICAgICBpZiAodXNlc1JlbW90ZUFzc2lzdGFudCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVhZHk6IFBvc3NpYmxlIHJlbW90ZSBhc3Npc3RhbmNlIGRldGVjdGVkJyk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQua2V5d29yZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogS2V5d29yZCAke2tleXdvcmR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcG9ydCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LnBvcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IFBvcnQgJHtwb3J0fSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnJlbW90ZWFzc2lzdGFudCA9IHVzZXNSZW1vdGVBc3Npc3RhbnRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpICAvLyBjaGVjayBpZiB0aGVyZSBpcyBhIG5ldyBzY3JlZW4gdGhhdCBuZWVkcyB0byBiZSBibG9ja2VkXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cblxuICAgICAgICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkICBubyBzZXJ2ZXJzaWduYWwgZm9yIDIwIHNlY29uZHNcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXsgIFxuICAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQua2lja2VkKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogQ29ubmVjdGlvbiB0byBUZWFjaGVyIGxvc3QhIFJlbW92aW5nIHJlZ2lzdHJhdGlvbi5cIikgLy9yZW1vdmUgc2VydmVyIHJlZ2lzdHJhdGlvbiBsb2NhbGx5IChzYW1lIGFzICdraWNrJylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpICAgLy8gdGhpcyBhbHNvIHJlc2V0cyBzZXJ2ZXJpcCB0aGVyZWZvcmUgbm8gYXBpIGNhbGxzIGFyZSBtYWRlIGFmdGVyd2FyZHNcbiAgICAgICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgICAgICAgLy8ganVzdCBpbiBjYXNlIHNjcmVlbnMgYXJlIGJsb2NrZWQuLiBsZXQgc3R1ZGVudHMgd29ya1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICBcblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBsZXQgcGF5bG9hZCA9IHtjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvfVxuXG4gICAgICAgICAgICBmZXRjaChgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvdXBkYXRlYCwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykgeyB0aHJvdyBuZXcgRXJyb3IoJ05ldHdvcmsgcmVzcG9uc2Ugd2FzIG5vdCBvaycpOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgICAgICBpZiAgICAgIChkYXRhLm1lc3NhZ2UgPT09IFwibm90YXZhaWxhYmxlXCIpeyBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBFeGFtIEluc3RhbmNlIG5vdCBmb3VuZCEnKTsgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gNTsgfSAgICAvLyBleGFtIGluc3RhbmNlIG5vdCBhdmFpbGFibGUgYnV0IHNlcnZlciByZWFjaGFibGVcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZGF0YS5tZXNzYWdlID09PSBcInJlbW92ZWRcIil7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBTdHVkZW50IHJlZ2lzdHJhdGlvbiBub3QgZm91bmQhJyk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5raWNrU3R1ZGVudCgpXG4gICAgICAgICAgICAgICAgICAgIH0gICAvLyBzdHVkZW50IGdvdCBraWNrZWQgLSB3ZSBoYW5kbGUgdGhpcyBkaWZmZXJlbnRseSBub3cuIHRlYWNoZXIgc3RvcmVzIFwia2lja2VkXCIgZm9yIHN0dWRlbnQgdG8gY29sbGVjdC4gc3R1ZGVudCBpcyByZW1vdmVkIGZyb20gc2VydmVyIHdoZW4gY29sbGVjdGluZyBraWNrZWQgaW5mby4gc3R1ZGVudCBjbG9zZXMgZXhhbSBhbmQgY2xlYW5zIHVwLlxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0gSGVhcnRiZWF0IGxvc3QuLmApOyAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTt9ICAgLy8gaGVhcnRiZWF0IGxvc3Qgc2VydmVyIG5vdCByZWFjaGFibGVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEuc3RhdHVzID09PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDA7IC8vIERpZXMgelx1MDBFNGhsdCBlYmVuZmFsbHMgYWxzIGVyZm9sZ3JlaWNoZXIgSGVhcnRiZWF0IC0gVmVyYmluZHVuZyBoYWx0ZW5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSBmYWxzZSAgLy9zZXQgdGhpcyB0byBmYWxzZSBhZnRlciB0aGUgcmVxdWVzdCBsZWZ0IHRoZSBjbGllbnQgdG8gcHJldmVudCBkb3VibGUgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zZXJ2ZXJzdGF0dXMpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3R1ZGVudFN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnN0dWRlbnRzdGF0dXMpKTsgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyU3RhdHVzRGVlcENvcHksIHN0dWRlbnRTdGF0dXNEZWVwQ29weSk7Ly8gVmVyYXJiZWl0dW5nIGRlciBlbXBmYW5nZW5lbiBEYXRlblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICgke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSkgJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAvLyBwcmV2ZW50IGZvY3VzIHdhcm5pbmcgYmxvY2sgaWYgbm8gY29ubmVjdGlvbiBcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlICAvLyBpZiBub3QgY29ubmVjdGVkIGJ1dCBzdGlsbCBpbiBleGFtIG1vZGUgeW91IGNvdWxkIHRyaWdnZXIgYSBmb2N1cyB3YXJuaW5nIGFuZCBub2JvZHkgaXMgYWJsZSB0byB1bmxvY2sgeW91XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgYXN5bmMgc2VuZFNjcmVlbnNob3QoKXtcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApe3JldHVybn0gIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWRcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrOyAvLyBWYXJpYWJsZW4gYXVcdTAwREZlcmhhbGIgZGVzIGlmLUJsb2NrcyBkZWZpbmllcmVuXG4gICAgICAgICAgICBsZXQgaW1nQnVmZmVyID0gbnVsbDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgIFxuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgc2NyZWVuc2hvdCBmcm9tIGRlc2t0b3AgdmlhIHNjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kIChmbGFtZXNob3QsIGltYWdlbWFnaWMsIGV0YylcbiAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdCh7IGZvcm1hdDogJ3BuZycgfSk7XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjaywgaW1nQnVmZmVyIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgIC8vIGtlaW4gaW1hZ2VCdWZmZXIgbWl0Z2VnZWJlbiBiZWRldXRldCBudXR6ZSBzY3JlZW5zaG90LWRlc2t0b3AgaW0gd29ya2VyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWNjZXNzKSB7IHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMDt9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkltYWdlIHByb2Nlc3NpbmcgZmFpbGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvL2dyYWIgXCJzY3JlZW5zaG90XCIgZnJvbSBhcHB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRGb2N1c2VkTWluZG93ID0gV2luZG93SGFuZGxlci5nZXRDdXJyZW50Rm9jdXNlZFdpbmRvdygpICAvL3JldHVybnMgZXhhbSB3aW5kb3cgaWYgbm90aGluZyBpbiBmb2N1cyBvciBtYWluIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudEZvY3VzZWRNaW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjdXJyZW50Rm9jdXNlZE1pbmRvdy53ZWJDb250ZW50cy5jYXB0dXJlUGFnZSgpICAvLyB0aGlzIHNob3VsZCBhbHdheXMgd29yayBiZWNhdXNlIGl0J3Mgb25ib2FyZCBlbGVjdHJvblxuICAgICAgICAgICAgICAgICAgICAgICAgaW1nQnVmZmVyID0gcmVzdWx0LnRvUE5HKClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2sgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAvLyBhdHRlbnRpb24gcHJvY2Vzc0ltYWdlICBjb252ZXJ0cyBidWZmZXIgdG8gdWludDhhcnJheVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgKz0xO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogcHJvY2Vzc0ltYWdlIGZhaWxlZDogJHtlcnJ9YClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1BQ09TIFdPUktBUk9VTkQgLSBzd2l0Y2ggdG8gcGFnZWNhcHR1cmUgaWYgbm8gcGVybWlzc29ucyBhcmUgZ3JhbnRlZFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiAmJiB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ICYmIGltZ0J1ZmZlciAhPT0gbnVsbCl7ICAvL3RoaXMgaXMgZm9yIG1hY09TIGJlY2F1c2UgaXQgZGVsaXZlcnMgYSBibGFuayBiYWNrZ3JvdW5kIHNjcmVlbnNob3Qgd2l0aG91dCBwZXJtaXNzaW9ucy4gd2UgY2F0Y2ggdGhhdCBjYXNlIHdpdGggYSB3b3JrYXJvdW5kXG4gICAgICAgICAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IGZhbHNlICAgLy9uZXZlciBkbyB0aGlzIGFnYWluXG4gICAgICAgICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKTtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgID0gYXdhaXQgVGVzc2VyYWN0LnJlY29nbml6ZShpbWdCdWZmZXIgLCAnZW5nJyx7IGxhbmdQYXRoOiBwdWJsaWNQYXRoIH0gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFwcFdpbmRvd1Zpc2libGUgPSB0ZXh0LmluY2x1ZGVzKFwiRXhhbVwiKSAgIC8vY2hlY2sgaWYgdGhlIHdvcmQgXCJFeGFtXCIgY2FuIGJlIGZvdW5kIGluIHNjcmVlbnNob3QgLSBvdGhlcndpc2UgaXQgaXMgbW9zdCBsaWtlbHkgYSBibGFuayBkZXNrdG9wIC0gbWFjb3MgcXVpcmtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBXaW5kb3dWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBQbGVhc2UgY2hlY2sgeW91ciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIC0gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogTWFjT1Mgc2NyZWVuc2hvdHBlcm1pc3Npb25zIGNoZWNrIE9LXCIpO31cbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXJyKXsgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nIHdlIGRvIG5vdCBoYXZlIGEgc2NyZWVuc2hvdCAtIHNvIGRvIG5vdCB1cGRhdGUgdGhlIHNlcnZlclxuICAgICAgICAgICAgaWYgKCFzY3JlZW5zaG90QmFzZTY0KXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFNjcmVlbnNob3QgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlYCkgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBQYWdlQ2FwdHVyZSBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gTm8tUHJvY2Vzc2luZ2ApIH0gICBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogbm8gc2NyZWVuc2hvdCBhdmFpbGFibGUgLSBwbGVhc2UgZml4IHlvdXIgc2V0dXBgKSB9XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIC8vZG8gbm90IHJ1biBjb2xvcmNoZWNrIGlmIGFscmVhZHkgbG9ja2VkXG4gICAgICAgICAgICBpZiAoIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMpe1xuICAgICAgICAgICAgICAgIGlmIChpc2JsYWNrKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGZpdCByZXF1aXJlbWVudHMgKGFsbGJsYWNrKVwiKTtcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RoYXNoID0gbnVsbFxuICAgICAgICAgICAgdHJ5IHsgc2NyZWVuc2hvdGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgfSAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IGNyZWF0aW5nIGhhc2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90OiBzY3JlZW5zaG90QmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RoYXNoOiBzY3JlZW5zaG90aGFzaCxcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGhlYWRlckJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90ZmlsZW5hbWU6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gKyBcIi5qcGdcIixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzZW5kIHNjcmVlbnNob3QgdG8gc2VydmVyIHZpYSBlbWFpbCBmZXRjaCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMjtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVzY3JlZW5zaG90YDtcbiAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQsIG1heFJldHJpZXMpOyAvLyBFcnN0ZSBBbmZyYWdlIHN0YXJ0ZW5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG4gICAgZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgPSAwLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogU3RhdHVzIEVycm9yOlwiLCBkYXRhLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgaWYgKGF0dGVtcHQgPCBtYXhSZXRyaWVzIC0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgKyAxLCBtYXhSZXRyaWVzKTsgLy8gUmV0cnlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcyAtIDEgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlIChmZXRjaCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cbiAgICBhc3luYyBraWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKXtcbiAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpY2tTdHVkZW50OiBTdHVkZW50IGdvdCBraWNrZWQgYnkgVGVhY2hlclwiKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlfSAgLy8gZG8gbm90IGRlbGV0ZSBmb2xkZXIgb24gZXhpdCBiZWNhdXNlIHN0dWRlbnQgZ290IGtpY2tlZFxuICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cyAmJiBzdHVkZW50c3RhdHVzLmRlbGZvbGRlcil7IHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPSB0cnVlfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIHJlYWN0IHRvIHNlcnZlciBzdGF0dXMgXG4gICAgICogdGhpcyBjdXJyZW50bHkgb25seSBoYW5kbGUgc3RhcnRleGFtICYgZW5kZXhhbVxuICAgICAqIGNvdWxkIGFsc28gaGFuZGxlIGtpY2ssIGZvY3VzcmVzdG9yZSwgYW5kIGV2ZW4gdHJpZ2dlciBmaWxlIHJlcXVlc3RzXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyc3RhdHVzLCBzdHVkZW50c3RhdHVzKXtcbiAgICAgICBcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBpbmRpdmlkdWFsIHN0YXR1cyB1cGRhdGVzXG5cbiAgICAgICAgaWYgKCBzdHVkZW50c3RhdHVzICYmIE9iamVjdC5rZXlzKHN0dWRlbnRzdGF0dXMpLmxlbmd0aCAhPT0gMCkgeyAgLy8gd2UgaGF2ZSBzdGF0dXMgdXBkYXRlcyAodGFza3MpIC0gZG8gaXQhXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5wcmludGRlbmllZCkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdkZW5pZWQnKSAgIC8vdHJpZ2dlciwgd2h5XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmtpY2tlZCkgeyAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIGJ5IHRlYWNoZXJcbiAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlclwiKVxuICAgICAgICAgICAgICAgIGxldCBkZWxmb2xkZXIgPSB0cnVlXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBcbiAgICAgICAgICAgICAgICAgICAgZGVsZm9sZGVyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycm9yKSAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ2FuIG5vdCBkZWxldGUgZGlyZWN0b3J5IC0gJHtlcnJvcn0gYClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyID09IGZhbHNlKXsgIC8vdHJ5IGRlbGV0aW5nIGZpbGUgYnkgZmlsZSAodGhlIG9uZSB0aGF0IGNhdXNlcyB0aGUgcHJvYmxlbSB3aWxsIHN0YXkgaW4gdGhlIGZvbGRlcilcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkgeyBmcy5ybVN5bmMoZmlsZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBWZXJzdWNoZSwgZGFzIFZlcnplaWNobmlzIHJla3Vyc2l2IHp1IGxcdTAwRjZzY2hlblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZnMudW5saW5rU3luYyhmaWxlUGF0aCk7ICB9Ly8gVmVyc3VjaGUsIGRpZSBEYXRlaSB6dSBsXHUwMEY2c2NoZW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IChkZWxmb2xkZXIpIEZlaGxlciBiZWltIExcdTAwRjZzY2hlbiBkZXIgRGF0ZWkvVmVyemVpY2huaXM6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZm9jdXMgPT0gZmFsc2Upe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiByZXN0b3JpbmcgZm9jdXMgc3RhdGUgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KXsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gdHJ1ZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSBmYWxzZSAgKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSB0cnVlICAvL2NsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2sgd2lsbCBiZSBwdXQgb24gdGhpcy5wcml2YXRlU3BlbGxjaGVjayBpbiBlZGl0b3IgdXBkYXRlZCB2aWEgZmV0Y2hJbmZvKClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBpcGNNYWluLmVtaXQoXCJzdGFydExhbmd1YWdlVG9vbFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSBmYWxzZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSB0cnVlICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogZGUtYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSBmYWxzZSBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5zdWdnZXN0aW9ucyA9IHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuc2VuZGV4YW0gPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEV4YW1Ub1RlYWNoZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZmV0Y2hmaWxlcyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoc3R1ZGVudHN0YXR1cy5maWxlcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdldG1hdGVyaWFscyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdGhpcyBpcyBhbiBtaWNyb3NvZnQzNjUgdGhpbmcuIGNoZWNrIGlmIGV4YW0gbW9kZSBpcyBvZmZpY2UsIGNoZWNrIGlmIHRoaXMgaXMgc2V0IC0gb3RoZXJ3aXNlIGRvIG5vdCBlbnRlciBleGFtbW9kZSAtIGl0IHdpbGwgZmFpbFxuICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIHNoYXJpbmcgbGluayAtIGl0IHdpbGwgYmUgdXNlZCBpbiBcIm1pY3Jvc29mdDM2NVwiIGV4YW0gbW9kZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gc3R1ZGVudHN0YXR1cy5tc29mZmljZXNoYXJlICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIGdyb3VwIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IHN0dWRlbnRzdGF0dXMuZ3JvdXAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIFxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGdsb2JhbCBzdGF0dXMgdXBkYXRlc1xuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIFxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgU1RBUlRcbiAgICAgICAgICogQVRURU5USU9OOiBtb3ZlIHRoaXMgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiAtIGl0IGlzIHRvbyBjb21wbGV4IGFuZCBzaG91bGQgYmUgc3BsaXQgdXBcbiAgICAgICAgICogaW4gdGhlIGZ1dHVyZSB3ZSB3ZWxsIGRldGVybWluZSBpZiBzZWN0aW9uIHN3aXRjaCBpcyBoYW5kbGVkIGJ5IHRoZSB0ZWFjaGVyIG9yIGJ5IHRoZSBzdHVkZW50IGFuZCBhY3QgYWNjb3JkaW5nbHlcbiAgICAgICAgICogaWYgaGFuZGxlZCBieSBzdHVkZW50IHRoZSB0ZWFjaGVyIHN0dHR1cyBpcyBpZ25vcmVkIGFuZCB0aGUgc3dpY2ggc2VjdGlvbiBmdW5jdGlvbiBpcyBjYWxsZWQgZGlyZWN0bHkgKHByb2JhYmx5IG1vdmUgdG8gaXBjaGFuZGxlci5qcylcbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBjdXJyZW50IGFjdGl2ZSBzZWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBvbmUgaW4gdGhlIHNlcnZlcnN0YXR1cyAtIGlmIG5vdCBjaGFuZ2UgdG8gdGhlIG5ldyBzZWN0aW9uXG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNoYW5naW5nIHNlY3Rpb24gdG8gJHtzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbn0gJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZX1gIClcblxuICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TG9ja2VkU2VjdGlvbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbjsgLy8gQ3VycmVudCBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBzYXZpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uOyAvLyBOZXcgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3IgbG9hZGluZylcbiAgICAgICAgICAgICAgICBjb25zdCBleGFtRGlyID0gdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeTtcblxuXG4gICAgICAgICAgICAgICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID09PSBcImVkaXRvclwiKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBzZW5kaW5nIGV4YW0gdG8gdGVhY2hlciAoZmluYWwgc3VibWl0KVwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgY3VycmVudCB3b3JrIGFzIGJhc2U2NCB0byB0ZWFjaGVyIChzdG9yZXMgcGRmIGluIEFCR0FCRSBmb2xkZXIgd2l0aCBzdWJtaXNzaW9uIG51bWJlcilcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBkZiA9IGF3YWl0IHRoaXMuZ2V0QmFzZTY0UERGKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciwgc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tjdXJyZW50TG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWUpICAvLyBsb2NhbCBmdW5jdGlvbiB0byBnZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAocGRmLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQmFzZTY0UERGdG9UZWFjaGVyKHBkZi5iYXNlNjRwZGYsIGN1cnJlbnRMb2NrZWRTZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpIC8vYmFja3VwIGxvY2FsIGZpbGVzIGFuZCBzZW5kIHRvIHRlYWNoZXIgKGFyY2hpdmUgd2l0aCB0aW1lc3RhbXApXG5cblxuICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhhbXR5cGUgaW4gY2xpZW50aW5mb1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbG9ja2VkIHNlY3Rpb24gQUZURVIgc2F2aW5nIHRoZSBvbGQgc3RhdGVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBuZXdMb2NrZWRTZWN0aW9uO1xuXG5cblxuICAgICAgICAgICAgICAgIC8vIE1PVkUgU2VjdGlvbiBGaWxlcyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMTogU0FWRSBDVVJSRU5UIEVYQU1ESVIgRklMRVMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhleGFtRGlyKSAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHsgLy8gQ2hlY2sgaWYgbWFpbiBkaXIgZXhpc3RzIGFuZCBhIHNlY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlUGF0aCA9IGAke2V4YW1EaXJ9LyR7Y3VycmVudExvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzYXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoc2F2ZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAvLyBDcmVhdGUgc2F2ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhleGFtRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gaXRlbXMgaW4gZXhhbURpciB0byBzYXZlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc1NhdmVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob2xkUGF0aCk7IC8vIEdldCBmaWxlIHN0YXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBwcm9jZXNzIGFjdHVhbCBGSUxFUywgbm90IGRpcmVjdG9yaWVzIChsaWtlIHRoZSBzZWN0aW9uIGZvbGRlcnMgdGhlbXNlbHZlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7c2F2ZVBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7IC8vIENvcHkgZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZFBhdGgpOyAvLyBEZWxldGUgb3JpZ2luYWwgZmlsZSBmcm9tIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNTYXZlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgKGZvbGRlcikgaXRlbSAke2ZpbGV9IGluIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IHNhdmVkICR7ZmlsZXNTYXZlZH0gZmlsZXMgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAyOiBMT0FEIEZJTEVTIGZyb20gdGhlIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgTkVXIGxvY2tlZCBzZWN0aW9uIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBuZXdMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRQYXRoID0gYCR7ZXhhbURpcn0vJHtuZXdMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2FkUGF0aCkpIHsgLy8gQ2hlY2sgaWYgdGhlIG5ldyBzZWN0aW9uIGZvbGRlciBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc1RvTG9hZCA9IGZzLnJlYWRkaXJTeW5jKGxvYWRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENvcGllZCBmaWxlICR7ZmlsZX0gZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIGl0ZW0gJHtmaWxlfSBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IG5ld0xvY2tlZFNlY3Rpb24gaXMgZmFsc3kgKCR7bmV3TG9ja2VkU2VjdGlvbn0pLCBza2lwcGluZyBmaWxlIGxvYWRgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3IgZHVyaW5nIGZvbGRlciBvcGVyYXRpb24gLSAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufSwgbmV3TG9ja2VkU2VjdGlvbjogJHtuZXdMb2NrZWRTZWN0aW9ufSwgZXhhbURpcjogJHtleGFtRGlyfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBBY3R1YWxseSBTV0lUQ0ggRVhBTSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBvciByZWxlYWQgdGhlIG5ldyBleGFtIHNlY3Rpb24gaW4gdGhlIHNhbWUgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93IC0gaWYgeW91IGRvbid0IG5leHQtZXhhbSB3aWxsIGNyYXNoIHNpbGVudGx5IG9uIHJlbG9hZCBhbmQgc2VjdGlvbiBzd2l0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKS5mb3JFYWNoKHdjID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgRU5EXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICBcblxuXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrKSB7ICB0aGlzLmFjdGl2YXRlU2NyZWVubG9jaygpIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICkgeyB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgfVxuXG4gICAgICAgIC8vIHNjcmVlbnNob3Qgc2FmZXR5IChPQ1Igc2VhcmNoZXMgZm9yIG5leHQtZXhhbSBzdHJpbmcpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jcikgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSB0cnVlICB9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSBmYWxzZSAgIH1cblxuICAgICAgICAvLyBHcm91cHMgaGFuZGxpbmdcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmdyb3Vwcyl7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZX1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gZmFsc2V9XG5cbiAgICAgICAgLy91cGRhdGUgc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsIHx8IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT09IDApIHsgLy8wIGlzIHRoZSBzYW1lIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCBidXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCAhPT0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGNoYW5nZWQgdG9cIiwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwXG4gICAgICAgICAgICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBkaXNhYmxlZCFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgb2xkIGludGVydmFsIGFuZCBzdGFydCBuZXcgaW50ZXJ2YWwgaWYgc2V0IHRvIHNvbWV0aGluZyBiaWdnZXIgdGhhbiB6ZXJvXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuaW50ZXJ2YWwgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgLy8gcmVtb3ZlIGxvY2tzY3JlZW4gaW1tZWRpYXRlbHkgLSBkb24ndCB3YWl0IGZvciBzZXJ2ZXIgaW5mb1xuICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgXG4gICAgICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBzZW5kIGJhc2U2NCBwZGYgdG8gdGVhY2hlclxuICAgIHNlbmRCYXNlNjRQREZ0b1RlYWNoZXIoYmFzZTY0cGRmLCBzZWN0aW9uPTEpe1xuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcHJpbnRyZXF1ZXN0LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfS8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59YDtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBiYXNlNjRwZGYsXG4gICAgICAgICAgICBwcmludHJlcXVlc3Q6IGZhbHNlLCAgICBcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcixcbiAgICAgICAgICAgIGxvY2tlZHNlY3Rpb246IHNlY3Rpb25cbiAgICAgICAgfVxuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7IHJldHVybiByZXNwb25zZS5qc29uKCk7ICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1lc3NhZ2UgPT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcisrICAgLy8gc3VjY2Vzc2Z1bCBzdWJtaXNzaW9uIC0+IGluY3JlbWVudCBudW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHsgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlZGl0b3IgQCBwcmludGJhc2U2NDpcIixlcnJvci5tZXNzYWdlKSAgICBcbiAgICAgICAgfSk7IFxuICAgIH1cbiAgICBcblxuXG5cbiAgICAvL2dldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgLy8gQVRURU5USU9OOiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGlwY2hhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgc3RvcmVzIGl0IGFzIGZpbGUgaW4gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgYXN5bmMgZ2V0QmFzZTY0UERGKHN1Ym1pc3Npb25udW1iZXIsIHNlY3Rpb25uYW1lLCBwcmludEJhY2tncm91bmQ9ZmFsc2Upe1xuICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBmb3IgYW55IG9uZ29pbmcgcHJpbnQgb3BlcmF0aW9uIHRvIGZpbmlzaCAobWF4IDMwIHNlY29uZHMpXG4gICAgICAgIGxldCB3YWl0Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhXYWl0ID0gMzAwOyAvLyAzMCBzZWNvbmRzIHdpdGggMTAwbXMgaW50ZXJ2YWxzXG4gICAgICAgIHdoaWxlIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgJiYgd2FpdENvdW50IDwgbWF4V2FpdCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApO1xuICAgICAgICAgICAgd2FpdENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBwcmludFRvUERGIGxvY2sgdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIHN0aWxsIHJ1bm5pbmdcIik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiUERGIGdlbmVyYXRpb24gdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIGluIHByb2dyZXNzXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHByaW50QmFja2dyb3VuZCxcbiAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuXG4gIFxuICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3NlY3Rpb25uYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7QWJnYWJlOiAke3N1Ym1pc3Npb25udW1iZXJ9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGVcbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9IC0gVmVyc2lvbiAke3N1Ym1pc3Npb25udW1iZXJ9XCJgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNldCBsb2NrIGJlZm9yZSBzdGFydGluZyBQREYgZ2VuZXJhdGlvblxuICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NHBkZiA9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtiYXNlNjRwZGZ9YDtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIlBERiBnZW5lcmF0ZWRcIiwgZGF0YVVybDpkYXRhVXJsLCBiYXNlNjRwZGY6IGJhc2U2NHBkZiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IEVycm9yIGdlbmVyYXRpbmcgUERGOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXJyb3IgZ2VuZXJhdGluZyBQREZcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIEFsd2F5cyByZWxlYXNlIHRoZSBsb2NrLCBldmVuIGlmIGFuIGVycm9yIG9jY3VycmVkXG4gICAgICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNob3cgdGVtcG9yYXJ5IHNjcmVlbmxvY2sgd2luZG93XG4gICAgYWN0aXZhdGVTY3JlZW5sb2NrKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcbiAgICAgICBcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID09IDApeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IHRydWVcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSAgLy8gYWRkIHNjcmVlbmxvY2sgd2luZG93cyBmb3IgYWRkaXRpb25hbCBkaXNwbGF5c1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSB0ZW1wb3Jhcnkgc2NyZWVubG9ja3dpbmRvd1xuICAgIGtpbGxTY3JlZW5sb2NrKCl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5sb2Nrd2luZG93ICYmICFzY3JlZW5sb2Nrd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lsbFNjcmVlbmxvY2s6IG5vIGZ1bmN0aW9uYWwgc2NyZWVubG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgfSBcbiAgICAgICAgLy8gQ2xlYXIgYXJyYXkgY29tcGxldGVseSBhZnRlciBhdHRlbXB0aW5nIHRvIGRlc3Ryb3kgYWxsIHdpbmRvd3NcbiAgICAgICAgLy8gVGhlIGNsb3NlZCBldmVudCBoYW5kbGVyIHdpbGwgYWxzbyBjbGVhbiB1cCwgYnV0IHRoaXMgZW5zdXJlcyB0aGUgYXJyYXkgaXMgZW1wdHlcbiAgICAgICAgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IGZhbHNlXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTdGFydHMgZXhhbSBtb2RlIGZvciBzdHVkZW50XG4gICAgICogZGVsZXRlcyB3b3JrZm9sZGVyIGNvbnRlbnRzIChpZiBzZXQpXG4gICAgICogb3BlbnMgYSBuZXcgd2luZG93IGluIGtpb3NrIG1vZGUgd2l0aCB0aGUgZ2l2ZW4gZXhhbXR5cGVcbiAgICAgKiBlbmFibGVzIHRoZSBibHVyIGxpc3RlbmVyIGFuZCBhY3RpdmF0ZXMgcmVzdHJpY3Rpb25zIChkaXNhYmxlIGtleWJvYXJzaG9ydGN1dHMgZXRjLilcbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGV4YW1tb2RlLCBleGFtdHlwZSwgYW5kIG90aGVyIHNldHRpbmdzIGZyb20gdGhlIHRlYWNoZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IGRpYWxvZyBpcyBvcGVuIGFuZCBsb2cgd2FybmluZ1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGl0V2FybmluZ09wZW4gfHwgV2luZG93SGFuZGxlci5leGl0UXVlc3Rpb25PcGVuIHx8IFdpbmRvd0hhbmRsZXIubWluaW1pemVXYXJuaW5nT3Blbikge1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogRGlhbG9nIGlzIHN0aWxsIG9wZW4gLSBleGFtIHdpbGwgc3RhcnQgYW55d2F5XCIpXG4gICAgICAgIH1cbiAgXG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICBcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5jbWFyZ2luICAvLyB0aGlzIGlzIHVzZWQgdG8gY29uZmlndXJlIG1hcmdpbiBzZXR0aW5ncyBmb3IgdGhlIGVkaXRvclxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxpbmVzcGFjaW5nID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0ubGluZXNwYWNpbmcgLy8gd2UgdHJ5IHRvIGRvdWJsZSBsaW5lc3BhY2luZyBvbiBkZW1hbmQgaW4gcGRmIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uYXVkaW9SZXBlYXQgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgaWYgKCFXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGNyZWF0aW5nIGV4YW0gd2luZG93XCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBtYW1tb3RoIGZyb20gJ21hbW1vdGgnO1xuXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vdHJheW1lbnUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTmV0d29ya09yUmVzZXQgfSBmcm9tICcuL3Rlc3RwZXJtaXNzaW9uc01hYy5qcyc7XG5pbXBvcnQgeyBnZXRXbGFuSW5mbyB9IGZyb20gJy4vZ2V0d2xhbmluZm8uanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25zdCBjaGVja1BvcnRPcGVuID0gKHBvcnQsIGhvc3QgPSAnMTI3LjAuMC4xJywgdGltZW91dCA9IDE1MDApID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgY29uc3QgZmluaXNoID0gKHJ1bm5pbmcsIGVycm9yID0gbnVsbCkgPT4ge1xuICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHJlc29sdmUoeyBydW5uaW5nLCBwb3J0LCBob3N0LCBlcnJvciB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0LnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdjb25uZWN0JywgKCkgPT4gZmluaXNoKHRydWUpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ3RpbWVvdXQnLCAoKSA9PiBmaW5pc2goZmFsc2UsICd0aW1lb3V0JykpO1xuICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoZXJyKSA9PiBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb2NrZXQuY29ubmVjdChwb3J0LCBob3N0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIElQQyBoYW5kbGluZyAoQmFja2VuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlIC8vIGZsYWcgdG8gcHJldmVudCBjbG9zaW5nIHdpbmRvdyB3aGlsZSBwcmludGluZ1xuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuICAgICAgICBcblxuICAgICAgICBpcGNNYWluLm9uKCdzZXQtbmV3LWxvY2FsZScsIChldmVudCwgbG9jYWxlKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNldC1uZXctbG9jYWxlOiBzZXR0aW5nIG5ldyBsb2NhbGUgdG8gJHtsb2NhbGV9YClcbiAgICAgICAgICAgIGkxOG4ubG9jYWxlID0gbG9jYWxlXG4gICAgICAgICAgICB1cGRhdGVTeXN0ZW1UcmF5KGkxOG4ubG9jYWxlKTtcbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRFeGFtTWF0ZXJpYWxzJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgXG4gICAgICAgICAgICBsZXQgY2xpZW50aW5mbyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm9cbiAgICAgICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBsZXQgc2VydmVyaXAgPSBjbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7IFxuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhhbU1hdGVyaWFscyA9IGZhbHNlXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgICAgICAgICAgZXhhbU1hdGVyaWFscyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZ2V0ZXhhbW1hdGVyaWFscy8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6IHJlY2VpdmVkIGRhdGFcIiwgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogJHtlcnJ9YCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBleGFtTWF0ZXJpYWxzXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICBcbiAgICAgICAgfSkgXG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlc3luZGljYXRpb24uY29tXCIpKSByZXR1cm4gdHJ1ZTsgXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVudGZlcm5lIGFsdGUgTGlzdGVuZXIsIHVtIERvcHBlbC1SZWdpc3RyaWVydW5nZW4genUgdmVybWVpZGVuXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ID0gYWxsb3dlZFVybHMubWFwKHMgPT4gU3RyaW5nKHMpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY2hlY2sgaWYgVVJMIG1hdGNoZXMgYWxsb3dlZCBkb21haW4gKHN1cHBvcnRzIHN1YmRvbWFpbnMgYW5kIHBhdGhzKVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHRhcmdldFVybCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBjb21tb24gZXhjZXB0aW9ucyBmaXJzdFxuICAgICAgICAgICAgICAgIGlmIChjaGVja0NvbW1vbkV4Y2VwdGlvbnModXJsU3RyKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZWFjaCBhbGxvd2VkIFVSTFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWxsb3dlZFVybCBvZiBhbGxvdykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHBhcnNlIGFzIFVSTCB0byBleHRyYWN0IGhvc3RuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRIb3N0bmFtZSA9IHVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBhbGxvd2VkIFVSTCB0byBleHRyYWN0IGRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRVcmxPYmogPSBuZXcgVVJMKGFsbG93ZWRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbG93ZWRVcmwuaW5jbHVkZXMoJy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3MgYSBwYXRoIHdpdGhvdXQgcHJvdG9jb2wsIGV4dHJhY3QgZG9tYWluIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGFsbG93ZWRVcmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkRG9tYWluID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhhY3QgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGFsbG93ZWREb21haW4gaXMgYSBzcGVjaWZpYyBzdWJkb21haW4gKGNvbnRhaW5zIGRvdHMpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NwZWNpZmljU3ViZG9tYWluID0gYWxsb3dlZERvbWFpbi5pbmNsdWRlcygnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGVjaWZpY1N1YmRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgc3BlY2lmaWMgc3ViZG9tYWluIGlzIHNwZWNpZmllZCwgb25seSBhbGxvdyB0aGF0IGV4YWN0IHN1YmRvbWFpbiBhbmQgd3d3LiB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBhbGxvdyBvdGhlciBzdWJkb21haW5zIHdoZW4gYSBzcGVjaWZpYyBvbmUgaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIG9ubHkgYmFzZSBkb21haW4gaXMgc3BlY2lmaWVkIChlLmcuLCBcIm9yZi5hdFwiKSwgYWxsb3cgYWxsIHN1YmRvbWFpbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyB3d3cuIHN1YmRvbWFpbiBleHBsaWNpdGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBvdGhlciBzdWJkb21haW5zIChlLmcuLCBzdWIuZHVkZW4uZGUgaWYgZHVkZW4uZGUgaXMgYWxsb3dlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUuZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gdGFyZ2V0SG9zdG5hbWUuc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgcHJlZml4OiBtdXN0IGJlIHZhbGlkIHN1YmRvbWFpbiBuYW1lIChhbHBoYW51bWVyaWMgYW5kIGh5cGhlbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgVVJMIHBhcnNpbmcgZmFpbHMsIGZhbGwgYmFjayB0byBzaW1wbGUgaW5jbHVkZXMgY2hlY2sgZm9yIHBhdGhzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsU3RyLmluY2x1ZGVzKGFsbG93ZWRVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmIChpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBhbGxvd2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmICghaXNBbGxvd2VkKSB7IFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFVuaWZpZWQgSVBDIGhhbmRsZXIgZm9yIHdlYnZpZXcgYmxvY2tpbmcgLSBzdXBwb3J0cyB3ZWJzaXRlLCBlZHV2aWR1YWwsIGZvcm1zLCByZHAgbW9kZXNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZSwgYWxsb3dlZERvbWFpbiwgYmFzZVVybCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIHRvIHByZXZlbnQgZHVwbGljYXRlIHJlZ2lzdHJhdGlvbnNcbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVUkwgdmFsaWRhdGlvbiBmdW5jdGlvbiAtIGRpZmZlcmVudCBsb2dpYyBiYXNlZCBvbiBtb2RlXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdFQlNJVEUgbW9kZTogY2hlY2sgZG9tYWluIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsIHx8IHRhcmdldFVybC5pbmNsdWRlcyhiYXNlVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG9tYWluID0gdXJsT2JqLmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4cGxpY2l0bHkgYWxsb3cgd3d3LiBzdWJkb21haW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbi5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGRvbWFpbi5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVEVVZJRFVBTC9NT09ETEUgbW9kZTogY2hlY2sgbW9vZGxlVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vb2RsZS1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJzdGFydGF0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInByb2Nlc3NhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJlZHV2aWR1YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ0aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZm9ybXNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBGT1JNUyBtb2RlOiBjaGVjayBnZm9ybXNUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEZvcm1zLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJmb3JtUmVzcG9uc2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJyZHBcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSRFAgbW9kZTogYWxsb3cgYWxsIChvciBpbXBsZW1lbnQgc3BlY2lmaWMgbG9naWMgaWYgbmVlZGVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBtb2RlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hlY2tDb21tb25FeGNlcHRpb25zKHRhcmdldFVybCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0PVwiX2JsYW5rXCIgbGlua3MgYW5kIHdpbmRvdy5vcGVuIC0gYmxvY2sgQkVGT1JFIG5hdmlnYXRpb25cbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgd2lsbC1uYXZpZ2F0ZSBvbiB3ZWJDb250ZW50cyBsZXZlbCAtIHRoaXMgZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEJsb2NrIG5hdmlnYXRpb24gY29tcGxldGVseSAtIHRoaXMgaGFwcGVucyBCRUZPUkUgcGFnZSBsb2Fkc1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7IC8vIFN0b3AgYW55IGxvYWRpbmcgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbGlhcyBmb3IgZWR1dmlkdWFsIG1vZGUgLSByZWRpcmVjdHMgdG8gdW5pZmllZCBoYW5kbGVyXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3ItZWR1dmlkdWFsLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSkgPT4ge1xuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgdW5pZmllZCBoYW5kbGVyIHdpdGggZWR1dmlkdWFsIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IHVuaWZpZWRIYW5kbGVyID0gaXBjTWFpbi5saXN0ZW5lcnMoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnKVswXTtcbiAgICAgICAgICAgIGlmICh1bmlmaWVkSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmlmaWVkSGFuZGxlcihldmVudCwgeyBndWVzdElkLCBtb2RlOiAnZWR1dmlkdWFsJywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWxvYWQgdGhlIGJyb3dzZXIgdmlld1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3JlbG9hZC1icm93c2VyLXZpZXcnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsKTtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBsYW5ndWFnZVRvb2wgQVBJIFNlcnZlciAod2l0aCBKYXZhIEpSRSlcbiAgICAgICAgICogUnVucyBhdCBsb2NhbGhvc3QgODA4OFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdGl2YXRlIHNwZWxsY2hlY2sgb24gZGVtYW5kIGZvciBzcGVjaWZpYyBzdHVkZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIExhbmd1YWdlVG9vbCBzZXJ2ZXIgcmVzcG9uZHMgb24gY29uZmlndXJlZCBwb3J0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2lzTGFuZ3VhZ2VUb29sUnVubmluZycsIGFzeW5jICgpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gbGFuZ3VhZ2VUb29sU2VydmVyLnBvcnQgfHwgODA4ODtcbiAgICAgICAgICAgIGNvbnN0IGhvc3RzID0gWycxMjcuMC4wLjEnLCAnOjoxJywgJ2xvY2FsaG9zdCddO1xuICAgICAgICAgICAgLy8gUnVuIGFsbCBjaGVja3MgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZSwgdXNlIGxvbmdlciB0aW1lb3V0IGZvciBzZXJ2ZXIgc3RhcnR1cCBkZXRlY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChob3N0cy5tYXAoaG9zdCA9PiBjaGVja1BvcnRPcGVuKHBvcnQsIGhvc3QsIDI1MDApKSk7XG4gICAgICAgICAgICAvLyBSZXR1cm4gZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHQsIG9yIGxhc3QgcmVzdWx0IGlmIG5vbmUgc3VjY2VlZGVkXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzUmVzdWx0ID0gcmVzdWx0cy5maW5kKHJlc3VsdCA9PiByZXN1bHQucnVubmluZyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCB8fCByZXN1bHRzW3Jlc3VsdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBMT0NBTCBMb2NrZG93blxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9jYWxsb2NrZG93bicsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9jYWxsb2NrZG93bjogbG9ja2luZyBkb3duIGNsaWVudCB3aXRob3V0IHRlYWNoZXIgY29ubmVjdGlvblwiKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge1xuICAgICAgICAgICAgICAgIGV4YW1tb2RlOiB0cnVlLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGVsZm9sZGVyb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiAnZGUtREUnLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0VHlwZTogJycsXG4gICAgICAgICAgICAgICAgbW9vZGxlRG9tYWluOiAnJyxcbiBcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDAsXG4gICAgICAgICAgICAgICAgbXNPZmZpY2VGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zbG9ja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwaW46ICcwMDAwJyxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVubG9ja29uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZm9udGZhbWlseTogJ3NhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RJZDogJycsXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXJncy5wYXNzd29yZCxcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVzZUV4YW1TZWN0aW9uczogZmFsc2UsIC8vaWYgZmFsc2UgZXhhbSBzZWN0aW9uIDEgaXMgdXNlZCBhbmQgbm8gdGFicyBhcmUgZGlzcGxheWVkXG4gICAgICAgICAgICAgICAgYWN0aXZlU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBsb2NrZWRTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGV4YW1TZWN0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAxOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtdHlwZTogYXJncy5leGFtbW9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNtYXJnaW46IHsgc2lkZTogJ3JpZ2h0Jywgc2l6ZTogMyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXNwYWNpbmc6ICcyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvUmVwZWF0OiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBhcmdzLmxhbmd1YWdldG9vbCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiBhcmdzLnNwZWxsY2hlY2tsYW5nIHx8ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogYXJncy5zdWdnZXN0aW9ucyB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBhcmdzLmNsaWVudG5hbWU7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gXCIxMjcuMC4wLjFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IFwibG9jYWxob3N0XCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IFwiYVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gdHJ1ZTsgLy8gdGhpcyBtdXN0IGJlIHNldCB0byB0cnVlIGluIG9yZGVyIHRvIHN0b3AgdHlwaWNhbCBuZXh0LWV4YW0gY2xpZW50L3RlYWNoZXIgYWN0aW9uc1xuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGxvY2FsbG9ja2Rvd25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHZpcnR1YWxpemVkIHN0YXR1c1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ZpcnR1YWxpemVkJywgKCkgPT4geyAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IHRydWU7IH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBGT0NVUyBzdGF0ZSB0byBmYWxzZSAobW91c2UgbGVmdCBleGFtIHdpbmRvdylcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZm9jdXNsb3N0JywgKGV2ZW50LCBjdHJsYWx0PWZhbHNlKSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFuc3dlciA9IGZhbHNlIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8ICF0aGlzLm11bHRpY2FzdENsaWVudC5leGFtbW9kZSkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWV9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID4gMCkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCAmJiBjdHJsYWx0ID09IGZhbHNlKXsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBmb2N1c2xvc3Q6IG1vdXNlbGVhdmUgZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBibG9jayBldmVyeXRoaW5nIGFuZCBpbmZvcm0gdGVhY2hlciAgKHByb2JhYmx5IGFuIG92ZXJraWxsIG9uIG1vdXNlbGVhdmUgLSBuZWVkcyB0ZXN0aW5nKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBhbnN3ZXJcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBtYWluIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29uZmlnICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIFVubG9jayBDb21wdXRlclxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ3JhY2VmdWxseWV4aXQnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ3JhY2VmdWxseWV4aXQ6IGdyYWNlZnVsbHkgbGVhdmluZyBsb2NrZWQgZXhhbSBtb2RlYClcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5ncmFjZWZ1bGx5RW5kRXhhbSgpIFxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgfSApXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogc3RvcCByZXN0cmljdGlvbnNcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RyaWN0aW9ucycsICgpID0+IHsgIFxuICAgICAgICAgICAgLy90aGlzIGFsc28gc3RvcHMgdGhlIGNsZWFyQ2xpcGJvYXJkIGludGVydmFsXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSBcbiAgICAgICAgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBjb3B5IHRvIGdsb2JhbCBjbGlwYm9hcmRcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NsaXBib2FyZCcsIChldmVudCwgdGV4dCkgPT4geyAgXG4gICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGxldCBhZGRyZXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkgeyAgICBhZGRyZXNzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogbXVsdGljYXN0Y2xpZW50IG5vdCBydW5uaW5nXCIpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMgYmVyZWl0cyBlaW5lIEFkcmVzc2Ugdm9yaGFuZGVuIGlzdCwgbGllZmVybiB3aXIgc2llIHp1clx1MDBGQ2NrLlxuICAgICAgICAgICAgaWYgKGFkZHJlc3MpIHsgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7ICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcnN1Y2hlLCBhbiBkaWUga29ycmVrdGUgU2Nobml0dHN0ZWxsZSB6dSBiaW5kZW5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRmFsbHMgZ2F0ZXdheTRzeW5jKCkgYmxvY2tpZXJlbmQgaXN0LCBrYW5uc3QgZHUgZGllc2VuIEF1ZnJ1ZiBpbiBlaW4gUHJvbWlzZSBwYWNrZW46XG4gICAgICAgICAgICAgICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlIH0gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnYXRld2F5NHN5bmMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHsgIHJlamVjdChlcnIpOyAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKTsgLy8gTGllZmVydCBkaWUgSVAgZGVyIFNjaG5pdHRzdGVsbGUsIHdlbGNoZSBkYXMgRGVmYXVsdCBHYXRld2F5IGhhdFxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGtlaW5lIElQIChtaXQgR2F0ZXdheSkgdmVyZlx1MDBGQ2diYXIgaXN0LCBob2xlIGVpbmUgYWx0ZXJuYXRpdmUgQWRyZXNzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCk7IC8vIExpZWZlcnQgYXVjaCBlaW5lIElQLCB3ZW5uIGtlaW4gR2F0ZXdheSB2ZXJmXHUwMEZDZ2JhciBpc3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJmXHUwMEU0bHNjaHRlIEFkcmVzc2VuICh6LiBCLiBsb2NhbGhvc3QpIGlnbm9yaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT09IFwiMTI3LjAuMC4xXCIpIHsgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7ICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBXZW5uIGRpZSBNdWx0aWNhc3QtQ2xpZW50IG5pY2h0IGxcdTAwRTR1ZnQsIGluaXRpYWxpc2llcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmICFhZGRyZXNzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmFsbHMgaW5pdCgpIGFzeW5jaHJvbiB1bWdlc2V0enQgd2VyZGVuIGthbm4sIHdhcnRlbiB3aXIgaGllciBkYXJhdWYuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBFcnJvciBpbml0aWFsaXppbmcgbXVsdGljYXN0IGNsaWVudFwiLCBlcnIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIGVkaXRvciBhcyBodG1sIGZpbGUgLSBhcyBiYWNrdXAgLSBvbmx5IHRyaWdnZXJlZCBieSB0aGUgdGVhY2hlciBmb3Igbm93IChhbGxvdyBtYW51YWwgYmFja3VwICEhKVxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAge2NsaWVudG5hbWU6dGhpcy5jbGllbnRuYW1lLCBmaWxlbmFtZTpgJHtmaWxlbmFtZX0uaHRtbGAsIGVkaXRvcmNvbnRlbnQ6IGVkaXRvcmNvbnRlbnQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVIVE1MJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBodG1sQ29udGVudCA9IGFyZ3MuZWRpdG9yY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBsZXQgaHRtbGZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSl7XG4gICAgICAgICAgICAgICAgaHRtbGZpbGVuYW1lID0gYCR7ZmlsZW5hbWV9LmJha2BcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaHRtbGZpbGUgPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgaHRtbGZpbGVuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGh0bWxDb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGh0bWxmaWxlLCBodG1sQ29udGVudCwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6ICR7ZXJyLm1lc3NhZ2V9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsdGVybmF0ZXBhdGggPSBgJHtodG1sZmlsZX0tJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufS5iYWtgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiB0cnlpbmcgdG8gd3JpdGUgZmlsZSBhczpcIiwgYWx0ZXJuYXRlcGF0aCApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGh0bWxDb250ZW50LCBmdW5jdGlvbiAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGJhc2U2NCBlbmNvZGVkIHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQREZiYXNlNjQnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldFBERmJhc2U2NDogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciA9IGFyZ3Muc3VibWlzc2lvbm51bWJlcisxIC8vIGNsaWVudGluZm8ga2VlcHMgdHJhY2sgb2Ygc3VibWlzc2lvbnMgZm9yIGF1dG9tYXRlZCBzdWJtaXNzaW9ubnVtYmVycyBhdCBzZWN0aW9uIGNoYW5nZSAtIGJ1dCB0aGlzIG9idmlvdXNseSBoYXBwZW5zIGFmdGVyIG1hbnVhbCBzdWJtaXRcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdldEJhc2U2NFBERihhcmdzLnN1Ym1pc3Npb25udW1iZXIsIGFyZ3Muc2VjdGlvbm5hbWUsIGFyZ3MucHJpbnRCYWNrZ3JvdW5kKSAgIC8vIHdoeSB0aGUgaGVsbCBpcyB0aGlzIGZ1bmN0aW9uIGxvY2F0ZWQgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgYW5kIG5vdCBpbiBpcGNoYW5kbGVyLmpzID8gRklYTUUgIVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgdGhlIEV4YW1XaW5kb3cgY29udGVudCBhcyBQREZcbiAgICAgICAgICogQVRURU5USU9OIHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgcmV0dW5zIGEgYmFzZTY0IHZlcnNpb24gb2YgdGhlIHBkZlxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ByaW50cGRmJywgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgLy8gZG8gbm90IHByaW50IGlmIGV4YW0gbW9kZSBpcyBub3QgYWN0aXZlIGFueW1vcmVcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZXhhbW1vZGUgaXMgZmFsc2UgLSBza2lwcGluZyBwcmludFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogcHJpbnQgYWxyZWFkeSBpbiBwcm9ncmVzcyAtIHNraXBwaW5nIG5ldyByZXF1ZXN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgLy8gZGVmaW5lIHByaW50IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBhcmdzLmxhbmRzY2FwZSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuICAgICAgICAgICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHthcmdzLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke2FyZ3MuY2xpZW50bmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHBkZmZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5wZGZgICAvLyBkZWZhdWx0IGZpbGVuYW1lID0gY2xpZW50bmFtZS5wZGZcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5maWxlbmFtZSl7ICAvLyBpbiBjYXNlIG9mIG1hbnVhbCBiYWNrdXAgdGhlIHVzZXIgY2FuIHNldCBhIGN1c3RvbSBmaWxlbmFtZVxuICAgICAgICAgICAgICAgICAgICBwZGZmaWxlbmFtZSA9IGAke2FyZ3MuZmlsZW5hbWV9LnBkZmBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZmZpbGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHBkZmZpbGVuYW1lKTsgIC8vIHBhdGggcG9pbnRzIHRvIHRoZSBjdXJyZW50IGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tYXV4LnBkZmAgICAgLy90aG9tYXMucGRmLWF1eC5wZGYgXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tb2xkLnBkZmA7ICAgLy90aG9tYXMucGRmLW9sZC5wZGZcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWZpbGVuYW1lKTsgIC8vIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nIHdlIHRyeSB0byB3cml0ZSBhIGRpZmZlcmVudCBmaWxlXG5cblxuICAgICAgICAgICAgICAgIC8vIGF1eCBmaWxlcyBhcmUgZmlsZXMgY3JlYXRlZCBpZiB0aGUgbWFpbiBwZGZmaWxlcGF0aCBpcyBub3Qgd3JpdGVhYmxlIChvcGVuZWQgb24gd2luZG93cykgXG4gICAgICAgICAgICAgICAgdHJ5IHsgIC8vIGFsd2F5cyBjaGVjayBmb3Igb2xkIGF1eCBmaWxlcyBhbmQgcmVuYW1lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBhbHRlcm5hdGVmaWxlbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoYWx0ZXJuYXRlcGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbVdpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICAgICAgY29uc3Qgd2ViQ29udGVudHMgPSBleGFtV2luZG93Py53ZWJDb250ZW50c1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3ZWJDb250ZW50cyl7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogbm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGUgZm9yIFBERiBtZXRhZGF0YVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZlRpdGxlID0gYXJncy5maWxlbmFtZSA/IGFyZ3MuZmlsZW5hbWUgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHthcmdzLnNlcnZlcm5hbWUgfHwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lIHx8ICcnfWBcbiAgICAgICAgICAgICAgICAvLyBlc2NhcGUgcXVvdGVzIGFuZCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIEphdmFTY3JpcHQgc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZFRpdGxlID0gcGRmVGl0bGUucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke2VzY2FwZWRUaXRsZX1cImApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcmludCB0aGUgZXhhbSB3aW5kb3cgdG8gcGRmXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgfSkudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgcGRmIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKHBkZmZpbGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKHBkZmZpbGVwYXRoKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUocGRmZmlsZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX0gLSB3cml0aW5nIGZpbGUgYXM6ICR7YWx0ZXJuYXRlcGF0aH0gYCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIGF1eCBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0ZXBhdGgpKSB7IGZzLnVubGlua1N5bmMoYWx0ZXJuYXRlcGF0aCk7IH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGYgKGFsdGVybmF0aXZlciBQZmFkKTogJHtlcnIubWVzc2FnZX1gKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGFsdGVybmF0ZSBwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKSAgIC8vbWFrZSBzdXJlIHN0dWRlbnRzIHNlZSB0aGUgbmV3IGZpbGUgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVycm9yLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlcyBBY3RpdmUgU2hlZXRzIGZvcm0gZGF0YSB0byAuYmFrIGZpbGVcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3NhdmVBY3RpdmVzaGVldHNCYWsnLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lID8gYCR7YXJncy5maWxlbmFtZX0uYmFrYCA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBiYWtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBmb3JtRGF0YSB0byBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25EYXRhID0gSlNPTi5zdHJpbmdpZnkoYXJncy5mb3JtRGF0YSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gLmJhayBmaWxlXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYWtGaWxlUGF0aCwganNvbkRhdGEsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiBzYXZlZCBmb3JtIGRhdGEgdG8gJHtiYWtGaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0JhazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgZm91bmQgU2VydmVycyBhbmQgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGluZm9hc3luYycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IGZhbHNlICAgXG4gICAgICAgICAgICAvLyBzZXJ2ZXJzdGF0dXMgb2JqZWt0IHdpcmQgbnVyIGJlaSBiZWdpbm4gZGVzIGV4YW1zIGFuIGRhcyBleGFtIHdpbmRvdyBkdXJjaGdlcmVpY2h0IGZcdTAwRkNyIGJhc2lzIGVpbnN0ZWxsdW5nZW5cbiAgICAgICAgICAgIC8vIGFsbGUgd2VpdGVyZW4gdXBkYXRlcyBcdTAwRkNiZXIgZGFzIHNlcnZlcnN0YXR1cyBvYmplY3Qgd2VyZGVuIGltIGNvbW11bmljYXRpb24gaGFuZGxlciBnZWxlc2VuIHVuZCBnZ2YuIGF1ZiBkYXMgY2xpZW50aW5mbyBvYmplY3QgZ2VsZWd0XG4gICAgICAgICAgICAvLyBkaWVzZXIga29tbXVuaWthdGlvbnNmbHVzcyBtdXNzIGluIDIuMCBnZXN0cmVhbWxpbmVkIHdlcmRlbiAjRklYTUVcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNlcnZlcnN0YXR1cyB9XG5cbiAgICAgICAgICAgIC8vY291bnQgbnVtYmVyIG9mIGZpbGVzIGluIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAvLyBlcnN0ZWxsdCBmYWxscyBuXHUwMEY2dGlnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVsaXN0ID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgcmV0dXJuIHsgICBcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsaXN0OiB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCxcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYmVjYXVzZSBvZiBtaWNyb3NvZnQgMzY1IHdlIG5lZWQgdG8gd29yayB3aXRoIFwiQnJvd3NlclZpZXdcIiBcbiAgICAgICAgICogaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBkaXNsYXkgZnVsbHNjcmVlbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBFeGFtIGhlYWRlciB3ZSB0ZW1wb3JhcmlseSBjb2xsYXBzZSB0aGUgQnJvd3NlclZpZXcgZm9yIE9mZmljZVxuICAgICAgICAgKiBhbmQgcmVzdG9yZSBpdCBhZnRlcndhcmRzIC0gbm90IHBlcmZlY3QgYnV0IGxvb2tzIG9rXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY29sbGFwc2UtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7IHg6IDAsIHk6IDAsIHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RvcmUtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IG1lbnVIZWlnaHQgPSBtYWluV2luZG93Lm1lbnVIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpOyAvLyBHZXQgdGhlIGN1cnJlbnQgYm91bmRzIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5ldyBib3VuZHMgb2YgdGhlIGNvbnRlbnRWaWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogbWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLCAvLyBmdWxsIHdpZHRoIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gbWVudUhlaWdodCAvLyByZW1haW5pbmcgaGVpZ2h0IGFmdGVyIHRoZSBtZW51XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZSBtZW51IGhlaWdodCBkeW5hbWljYWxseSB3aGVuIGhlYWRlciBjb250ZW50IGNoYW5nZXNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3VwZGF0ZS1tZW51LWhlaWdodCcsIChldmVudCwgaGVpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3c7XG4gICAgICAgICAgICBpZiAobWFpbldpbmRvdyAmJiBoZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBzdG9yZWQgbWVudSBoZWlnaHRcbiAgICAgICAgICAgICAgICBtYWluV2luZG93Lm1lbnVIZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVwb3NpdGlvbiB0aGUgYnJvd3NlciB2aWV3IHdpdGggbmV3IGhlaWdodFxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50Vmlldykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlbmRzIGEgcmVnaXN0ZXIgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gc2VydmVyIGlwXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICBjbGllbnRuYW1lOnRoaXMudXNlcm5hbWUsIHNlcnZlcm5hbWU6c2VydmVybmFtZSwgc2VydmVyaXAsIHNlcnZlcmlwLCBwaW46dGhpcy5waW5jb2RlIFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigncmVnaXN0ZXInLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSBhcmdzLmNsaWVudG5hbWVcbiAgICAgICAgICAgIGNvbnN0IHBpbiA9IGFyZ3MucGluXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJpcCA9IGFyZ3Muc2VydmVyaXBcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudGlwID0gaXAuYWRkcmVzcygpXG4gICAgICAgICAgICBjb25zdCBob3N0bmFtZSA9IG9zLmhvc3RuYW1lKClcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmNvbmZpZy52ZXJzaW9uXG4gICAgICAgICAgICBjb25zdCBiaXB1c2VySUQgPSBhcmdzLmJpcHVzZXJJRFxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7IC8vI0ZJWE1FIGRhcyBzb2xsdGUgZWlnZW50bGljaCB2b20gc2VydmVyIGtvbW1lbiBcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3JlZ2lzdGVyY2xpZW50LyR7c2VydmVybmFtZX0vJHtwaW59LyR7Y2xpZW50bmFtZX0vJHtjbGllbnRpcH0vJHtob3N0bmFtZX0vJHt2ZXJzaW9ufS8ke2JpcHVzZXJJRH1gO1xuICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gQWJvcnRTaWduYWwudGltZW91dCg4MDAwKTsgLy8gODAwMCBNaWxsaXNla3VuZGVuID0gOCBTZWt1bmRlbiBBYm9ydFNpZ25hbCBtaXQgZWluZW0gVGltZW91dFxuXG5cbiAgICAgICAgICAgIGZldGNoKHVybCwgeyBtZXRob2Q6ICdHRVQnLCBzaWduYWwgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PSBcInN1Y2Nlc3NcIikgeyAgLy8gcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWxsIG90aGVyd2lzZSBkYXRhIHdvdWxkIGJlIFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAvLyBFcmZvbGdyZWljaGUgUmVnaXN0cmllcnVuZ1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBjbGllbnRuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gc2VydmVyaXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IHNlcnZlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBjbGllbnRpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZGF0YS50b2tlbjsgLy8gd2UgbmVlZCB0byBzdG9yZSB0aGUgY2xpZW50IHRva2VuIGluIG9yZGVyIHRvIGNoZWNrIGFnYWluc3QgaXQgYmVmb3JlIHByb2Nlc3NpbmcgY3JpdGljYWwgYXBpIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IHBpbjtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCByZWdpc3Rlcjogc3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgYXQgJHtzZXJ2ZXJuYW1lfSBAICR7c2VydmVyaXB9IGFzICR7Y2xpZW50bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBkYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGV4YW0gZm9sZGVyIGluIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHVuaXF1ZWV4YW1OYW1lID0gYCR7c2VydmVybmFtZX0tJHtwaW59YFxuICAgICAgICAgICAgICAgICAgICBjb25maWcuZXhhbWRpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgdW5pcXVlZXhhbU5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudmVyc2lvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHZlcnNpb25zIGFuZCBkaXNwbGF5IG1lc3NhZ2UgKHRlYWNoZXIgbmVlZHMgdXBncmFkZS4uIGNsaWVudCBuZWVkcyB1cGdyYWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcGFyaXNvblJlc3VsdCA9IHRoaXMuY29tcGFyZVNvZnR3YXJlKGNvbmZpZy52ZXJzaW9uLCBjb25maWcuaW5mbyAsIGRhdGEudmVyc2lvbiwgZGF0YS52ZXJzaW9uaW5mbyApIC8vc2VydmVyVmVyc2lvbiwgc2VydmVyU3RhdHVzLCBsb2NhbFZlcnNpb24sIGxvY2FsU3RhdHVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHsgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCBuZXVlciBhbHMgZGllIGRlciBMZWhycGVyc29uIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IHp1IGFsdC4gTGFkZW4gc2llIHNpY2ggZWluZSBha3R1ZWxsZSBWZXJzaW9uIGhlcnVudGVyIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW5iZWthbm50ZXIgRmVobGVyIGJlaW0gVmVyYmluZHVuZ3NhdWZiYXUuXCIgfTsgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChhc3luYyBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmVobGVyYmVoYW5kbHVuZ1xuICAgICAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHsgZXJyb3JNZXNzYWdlID0gXCJUaGUgcmVxdWVzdCB0aW1lZCBvdXRcIjsgICB9IC8vIFRpbWVvdXQtTmFjaHJpY2h0IGFucGFzc2VuIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBvbiBtYWNvcyB0aGUgcGVybWlzc2lvbiBzZXR0aW5ncyBpbiByYXJlIGNhc2VzIG1lc3MgdXAgdGhlIGFiaWxpdHkgdG8gZmV0Y2ggdGhlIHRlYWNoZXIgYXBpIFxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKXsgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCB0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0KTsgXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZSA9PT0gXCJyZXNldFwiKSB7ICAgLy8gcXVpdCB0aGUgYXBwIGlmIHRoZSB1c2VyIHdhbnRzIHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNob3cgd2FybmluZyBtZXNzYWdlIGlmIHRoZSB1c2VyIGRvZXMgbm90IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcyBnaWJ0IGVpbiBQcm9ibGVtIG1pdCBkZW0gTmV0endlcmssIGRlbiBGaXJld2FsbHJlZ2VsbiBvZGVyIGRlbiBOZXR6d2Vya2JlcmVjaHRpZ3VuZ2VuISBCaXR0ZSBiZWhlYmVuIHNpZSBkaWVzZXMgUHJvYmxlbSB1bmQgc3RhcnRlbiBTaWUgTmV4dC1FeGFtIG5ldSFcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgICAgICAgICByZXR1cm47ICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBHZW9nZWJyYSBhcyBnZ2IgZmlsZSAtIGFzIGJhY2t1cCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgLCBjb250ZW50OiBiYXNlNjQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NhdmVHR0InLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhcmdzLmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgY29uc3QgcmVhc29uID0gYXJncy5yZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2F2ZUdHQjogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gQnVmZmVyLmZyb20oY29udGVudCwgJ2Jhc2U2NCcpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhnZ2JGaWxlUGF0aCwgZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVzdG9yZWRcIikgLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnIpICBcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVHR0I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBsb2FkIGNvbnRlbnQgZnJvbSBnZ2IgZmlsZSBhbmQgc2VuZCBpdCB0byB0aGUgZnJvbnRlbmQgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnbG9hZEdHQicsIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhZCB0aGUgZmlsZSBhbmQgY29udmVydCBpdCB0byBiYXNlNjRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhnZ2JGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZTY0R2diRmlsZSA9IGZpbGVEYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6YmFzZTY0R2diRmlsZSwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9ICAgICBcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHRVQgUERGIG9yIElNQUdFIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwZGZhc3luYycsIChldmVudCwgZmlsZW5hbWUsIGltYWdlID0gZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbWFnZSl7IHJldHVybiBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBiYXNlNjQgc3RyaW5nIG9mIGF1ZGlvZmlsZSBmcm9tIHdvcmtkaXJlY3Rvcnkgb3IgcHVibGljIGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEF1ZGlvRmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIHB1YmxpY2Rpcj1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpO1xuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiAhcHVibGljZGlyKSB7IC8vIFJldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvclxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgcHVibGljZGlyKSB7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi8uLi9wdWJsaWNcIixmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgRklMRS1MSVNUIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGZpbGVzYXN5bmMnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBhdWRpbz1mYWxzZSwgZG9jeD1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXJndW1lbnRzOlwiLCBmaWxlbmFtZSwgYXVkaW8sIGRvY3gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG5cbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gPT0gdHJ1ZSl7IC8vIGF1ZGlvIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRvY3gpeyAgLy9vZmZpY2Ugb3BlbiB4bWwgZmlsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbWFtbW90aC5jb252ZXJ0VG9IdG1sKHtwYXRoOiBmaWxlcGF0aH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgICAvL2JhayBmaWxlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgLy8gcmV0dXJuIGZpbGUgbGlzdCBvZiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7IGZzLm1rZGlyU3luYyh3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH0gLy9kbyBub3QgY3Jhc2ggaWYgdGhlIGRpcmVjdG9yeSBpcyBkZWxldGVkIGFmdGVyIHRoZSBhcHAgaXMgc3RhcnRlZCBeXlxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZWxpc3QgPSAgZnMucmVhZGRpclN5bmMod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgICAgICAgICAgICAgZmlsZWxpc3QuZm9yRWFjaCggZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kaWZpZWQgPSBmcy5zdGF0U3luYyggICBwYXRoLmpvaW4od29ya2RpcixmaWxlKSAgKS5tdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZCA9IG1vZGlmaWVkLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucGRmXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJwZGZcIiwgbW9kOiBtb2R9KSAgIH0gICAgICAgICAvL3BkZlxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5iYWtcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImJha1wiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgYmFja3VwIGZpbGUgdG8gcmVwbGFjZSBlZGl0b3IgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5kb2N4XCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJkb2N4XCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBjb250ZW50IGZpbGUgKGZyb20gdGVhY2hlcikgdG8gcmVwbGFjZSBjb250ZW50IGFuZCBjb250aW51ZSB3cml0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdnYlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZ2diXCIsIG1vZDogbW9kfSkgICB9ICAvLyBnZW9nZWJyYVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5tcDNcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIub2dnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLndhdlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImF1ZGlvXCIsIG1vZDogbW9kfSkgICB9ICAvLyBhdWRpb1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5qcGdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucG5nXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdpZlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImltYWdlXCIsIG1vZDogbW9kfSkgICB9ICAvLyBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEJBQ0tVUCBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZmlsZW5hbWUgd2l0aG91dFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRiYWNrdXBmaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBSZXF1ZXN0IHJlY2VpdmVkIGZvciBmaWxlbmFtZTogJHtmaWxlbmFtZX1gKVxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEZ1bGwgZmlsZSBwYXRoOiAke2ZpbGVwYXRofWApXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVwYXRoKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIG5vdCBmb3VuZDogJHtmaWxlcGF0aH1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBleGlzdHMsIHJlYWRpbmcgY29udGVudGApXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogU3VjY2Vzc2Z1bGx5IHJlYWQgYmFja3VwIGZpbGUsIGNvbnRlbnQgbGVuZ3RoOiAke2RhdGEubGVuZ3RofWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3IgcmVhZGluZyBiYWNrdXAgZmlsZTogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciBzdGFjazogJHtlcnIuc3RhY2t9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBubyBmaWxlbmFtZSBwcm92aWRlZGApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigncmVsb2FkLXVybCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUVhc3RlcldpbigpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQXBwZW5kIFByaW50UmVxdWVzdCB0byBjbGllbnRpbmZvICBcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzZW5kUHJpbnRSZXF1ZXN0JywgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IHRydWUgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0LWNwdS1pbmZvJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuaXNWaXJ0dWFsTWFjaGluZSgpXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdsYW4taW5mbycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2xhbkluZm8gPSBhd2FpdCBnZXRXbGFuSW5mbygpO1xuICAgICAgICAgICAgcmV0dXJuIHdsYW5JbmZvO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFxuICAgICAgICAvLyBOZXcgaGFuZGxlciB0byBnZXQgUERGIGZyb20gcHVibGljIGRpcmVjdG9yeSBmb3IgZnJvbnRlbmQgcGFyc2luZ1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UGRmRnJvbVB1YmxpYycsIGFzeW5jIChldmVudCwgcGRmRmlsZW5hbWUgKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEdldCBkaXJlY3RvcnkgbmFtZSBpbiBFU01cbiAgICAgICAgICAgICAgICBjb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBwZGZQYXRoO1xuICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBkZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogUERGIG5vdCBmb3VuZCBhdDogJHtwZGZQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBkZlBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuICAgIGlzVmlydHVhbE1hY2hpbmUoKSB7XG4gICAgICAgIGNvbnN0IFZFTkRPUlMgPSAvKG9yYWNsZXx2aXJ0dWFsYm94fHZtd2FyZXxrdm18cWVtdXx4ZW58aW5ub3Rla3xwYXJhbGxlbHN8bWljcm9zb2Z0fGh5cGVyLXZ8Ymh5dmV8cmVkIGhhdHxyZWRoYXR8Ym9jaHN8Ymh5dmV8b3BlbnN0YWNrfGNsb3VkfGFtYXpvbnxnb29nbGV8YXp1cmUpL2kgLy8gY29tbW9uIFZNIGlkc1xuICAgICAgICBjb25zdCB3YXJuQW5kUmV0dXJuID0gcmVhc29uID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgaXNWaXJ0dWFsTWFjaGluZTogVmVyZGFjaHQgYXVmIFZNIC0gJHtyZWFzb259YClcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIExpbnV4IC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3B1aW5mbyA9IHJlYWRGaWxlU3luYygnL3Byb2MvY3B1aW5mbycsICd1dGY4JykgICAgICAvLyBDUFUgZmxhZ3NcbiAgICAgICAgICAgIGlmICgvXmZsYWdzLipcXGJoeXBlcnZpc29yXFxiL20udGVzdChjcHVpbmZvKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ2h5cGVydmlzb3IgZmxhZyBpbiAvcHJvYy9jcHVpbmZvJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBbXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9zeXNfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfbmFtZScsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X3ZlcnNpb24nLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYm9hcmRfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2Jpb3NfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2NoYXNzaXNfdmVuZG9yJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgZG1pID0gZmlsZXMubWFwKHAgPT4geyB0cnkgeyByZXR1cm4gcmVhZEZpbGVTeW5jKHAsICd1dGY4JykgfSBjYXRjaCB7IHJldHVybiAnJyB9IH0pLmpvaW4oJyAnKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChkbWkpKSByZXR1cm4gd2FybkFuZFJldHVybignRE1JLVZlbmRvci1NYXRjaCcpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdzeXN0ZW1kLWRldGVjdC12aXJ0IC1xJywgeyBzdGRpbzogJ2lnbm9yZScgfSkgICAgLy8gZXhpdCAwID0+IFZNXG4gICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignc3lzdGVtZC1kZXRlY3QtdmlydCBtZWxkZXQgVmlydHVhbGlzaWVydW5nJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cblxuICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtUHJvemVzc2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPSBleGVjU3luYygncHMgYXV4IHwgZ3JlcCAtaSBxZW11JywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAocHMuaW5jbHVkZXMoJ3FlbXUnKSAmJiAhcHMuaW5jbHVkZXMoJ2dyZXAnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIGxcdTAwRTR1ZnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gV2luZG93cyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIoR2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtIHwgRm9yRWFjaC1PYmplY3QgeyAkXy5NYW51ZmFjdHVyZXIsICRfLk1vZGVsIH0pIC1qb2luIFxcJyBcXCdcIidcbiAgICAgICAgICAgIGNvbnN0IGJhc2ljID0gZXhlY1N5bmMocHMsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKCkgICAgLy8gbWFudWZhY3R1cmVyICsgbW9kZWxcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoYmFzaWMpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL01vZGVsbCBwYXNzdCB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwc1JvYnVzdCA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRvPUAoKTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW07JG8rPUAoJGNzLk1hbnVmYWN0dXJlciwkY3MuTW9kZWwpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmI9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0Jhc2VCb2FyZDskbys9QCgkYmIuTWFudWZhY3R1cmVyLCRiYi5Qcm9kdWN0KX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJpb3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0JJT1M7JG8rPUAoJGJpb3MuU01CSU9TQklPU1ZlcnNpb24pfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3NwPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3Q7JG8rPUAoJGNzcC5OYW1lKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICdXcml0ZS1PdXRwdXQgKCgkbyAtam9pbiBcXCcgXFwnKS5UcmltKCkpXCInXG4gICAgICAgICAgICBjb25zdCByb2J1c3QgPSBleGVjU3luYyhwc1JvYnVzdCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChyb2J1c3QpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL0JJT1MtSW5mb3MgcGFzc2VuIHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLUVya2VubnVuZyBmXHUwMEZDciBXaW5kb3dzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHFlbXVQcm9jZXNzZXMgPSBleGVjU3luYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIHFlbXUqXCInLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgICAgICBpZiAocWVtdVByb2Nlc3Nlcy5pbmNsdWRlcygncWVtdScpKSByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIHVudGVyIFdpbmRvd3MnKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cblxuICAgICAgICAgLy8gLS0tLS0tLS0tLSBtYWNPUyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGh3TW9kZWwgPSBleGVjU3luYygnc3lzY3RsIC1uIGh3Lm1vZGVsJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoL152aXJ0dWFsL2kudGVzdChod01vZGVsKSB8fCBWRU5ET1JTLnRlc3QoaHdNb2RlbCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBIYXJkd2FyZW1vZGVsbCBkZXV0ZXQgYXVmIFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gZXhlY1N5bmMoJ3N5c3RlbV9wcm9maWxlciBTUEhhcmR3YXJlRGF0YVR5cGUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qoc3ApKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1Mgc3lzdGVtX3Byb2ZpbGVyIG1lbGRldCBWTS1WZW5kb3InKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlICAgICAgIFxuICAgIH1cblxuICAgIGNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpIHtcbiAgICAgICAgY29uc3QgcGFydHNBID0gdmVyc2lvbkEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgY29uc3QgcGFydHNCID0gdmVyc2lvbkIuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBudW1BID0gcGFydHNBW2ldIHx8IDA7IC8vIEZhbGxiYWNrIGF1ZiAwLCBmYWxscyBrZWluIFdlcnQgdm9yaGFuZGVuXG4gICAgICAgICAgICBjb25zdCBudW1CID0gcGFydHNCW2ldIHx8IDA7XG4gICAgXG4gICAgICAgICAgICBpZiAobnVtQSA8IG51bUIpIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmIChudW1BID4gbnVtQikgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IG51bWJlckEgPSBwYXJzZUludChzdGF0dXNBLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgICAgICBjb25zdCBudW1iZXJCID0gcGFyc2VJbnQoc3RhdHVzQi5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICBcbiAgICAgICAgaWYgKG51bWJlckEgPCBudW1iZXJCKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChudW1iZXJBID4gbnVtYmVyQikgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGNvbXBhcmVTb2Z0d2FyZSh2ZXJzaW9uQSwgc3RhdHVzQSwgdmVyc2lvbkIsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkNvbXBhcmlzb24gPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpO1xuICAgICAgICBpZiAodmVyc2lvbkNvbXBhcmlzb24gIT09IDApIHJldHVybiB2ZXJzaW9uQ29tcGFyaXNvbjtcbiAgICBcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpO1xuICAgIH1cblxuXG59XG4gXG5leHBvcnQgZGVmYXVsdCBuZXcgSXBjSGFuZGxlcigpXG4iLCAiaW1wb3J0IHtjcmVhdGVJMThufSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbWVzc2FnZXM6IHtcbiAgICAgICAgZW4sXG4gICAgICAgIGRlXG4gICAgICB9XG4gIH0pXG5cbmV4cG9ydCBkZWZhdWx0IGkxOG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiUmVzdG9yZVwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiRGlzY29ubmVjdFwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiRXhpdFwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIkV4YW1zXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJVc2VybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyIGFkZHJlc3NcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiRXhhbSBOYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJyZWdpc3RlclwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwicmVnaXN0ZXJpbmcuLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwicmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcImRpc2Nvbm5lY3RlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgb24gc2VydmVyISBcXG5cXG5QbGVhc2Ugd2FpdCBmb3IgdGhlIGFjdGl2YXRpb24gb2YgdGhlIGV4YW0gbW9kZSBieSB0aGUgdGVhY2hlciFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwic2VhcmNoIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJub3B3XCI6IFwid3JvbmcgdXNlcm5hbWUgb3IgcGluXCIsXG4gICAgICAgIFwibm91c2VyXCI6XCJubyB1c2VybmFtZSBnaXZlblwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZGRyZXNzZSBvZGVyIEV4YW1uYW1lIG1pc3NpbmdcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJubyBwaW5jb2RlIGdpdmVuXCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjpcIlNlcnZlciBBUEkgdW5yZWFjaGFibGVcIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgaXMgYmVoaW5kIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiTm8gVGVhY2hlciBBUEkgZm91bmQgb24gdGhlIGdpdmVuIGFkZHJlc3NcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2NhbCBsb2NrZG93blwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWFsIHNlYXJjaFwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIk5vIGV4YW1zIGZvdW5kXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nb3V0P1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJhY3RpdmF0ZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlc1wiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGljc1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiU2VsZWN0IGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIlBsZWFzZSBpbnN0YWxsIHRoZSBzYW1lIHZlcnNpb24gYXMgdGhlIGV4YW0gc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInNhZmUgZXhhbSBzdGF0dXMgY2hhbmdlZFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCBhbHJlYWR5IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwic3RhcnRlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJzdG9wcGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwic2FmZSBleGFtIG1vZGUgbm90IGFjdGl2ZVwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwic3R1ZGVudCByZW1vdmVkIGZyb20gc2VydmVyXCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiZmlsZXMgc3RvcmVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJmaWxlIGVycm9yXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcInBsZWFzZSBjaGVjayBpZiB0aGUgJ0VYQU0tU1RVREVOVCcgZGlyZWN0b3J5IGlzIHdyaXRlYWJsZSBhbmQgaGFzIGVub3VnaCBzcGFjZVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiQSBsb2NhbCBiYWNrdXAgY291bGQgbm90IGJlIGNyZWF0ZWQuIFBsZWFzZSB1c2UgdGhlIG1hbnVhbCBzdWJtaXNzaW9uIG9wdGlvbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcImRvbid0IHNob3cgYWdhaW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGZvdW5kXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiR2V0IG1hdGVyaWFsc1wiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJTZW5kIGZpbmFsIGV4YW1cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkZpbmFsIHN1Ym1pdFwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsczpcIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9jYWwgZmlsZXM6XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiVXBkYXRlXCIsXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BsaXR2aWV3XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiWW91IGhhdmUgbGVmdCB0aGUgc2FmZSBleGFtIG1vZGUhXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJQbGVhc2UgaW5mb3JtIGEgdGVhY2hlciFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJEbyB5b3Ugd2FudCB0byByZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoZSBlZGl0b3Igd2l0aCB0aGUgY29udGVudCBvZiBcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCI/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJDYW5jZWxcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAgZmlsZSBjb3VsZCBub3QgYmUgcmVhZFwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBzdWNjZXNzZnVsbHkgbG9hZGVkXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJFcnJvciBsb2FkaW5nIGJhY2t1cCBmaWxlXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJTdWNjZXNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJjaGFyc1wiLFxuICAgICAgICBcIndvcmRzXCI6IFwid29yZHNcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJyZWNvbm5lY3RcIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJ1bmxvY2tcIixcbiAgICAgICAgXCJleGl0XCI6IFwiRXhpdCBzYWZlIGV4YW0gbW9kZT9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJEbyBub3QgbGVhdmUgc2FmZSBleGFtIG1vZGUgd2l0aG91dCBwZXJtaXNzaW9uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJJZiB0aGlzIHByb2Nlc3MgZmFpbHMgdW5sb2NrIGFuZCB0cnkgYWdhaW4hXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJDcmVhdGluZyBiYWNrdXBcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJDcmVhdGluZyBiYWNrdXAgYW5kIGNsaXBib2FyZCBjb3B5XCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkxlYXZpbmcgRXhhbSBtb2RlXCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwiYmFja3VwXCIsXG4gICAgICAgIFwidW5kb1wiOlwidW5kb1wiLFxuICAgICAgICBcInJlZG9cIjpcInJlZG9cIixcbiAgICAgICAgXCJjbGVhclwiOlwiY2xlYXJcIixcbiAgICAgICAgXCJib2xkXCI6XCJib2xkXCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJpdGFsaWNcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVuZGVybGluZVwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJoZWFkaW5nMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJoZWFkaW5nMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJoZWFkaW5nM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJoZWFkaW5nNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJoZWFkaW5nNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJoZWFkaW5nNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwic3Vic2NyaXB0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcInN1cGVyc2NyaXB0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwiYnVsbGV0bGlzdFwiLFxuICAgICAgICBcImxpc3RcIjpcImxpc3RcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcImNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcImNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJibG9ja3F1b3RlXCIsXG4gICAgICAgIFwibGluZVwiOlwicGFnZWJyZWFrXCIsXG4gICAgICAgIFwibGVmdFwiOlwibGVmdFwiLFxuICAgICAgICBcImNlbnRlclwiOlwiY2VudGVyXCIsXG4gICAgICAgIFwicmlnaHRcIjpcInJpZ2h0XCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJ0ZXh0Y29sb3JcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcImxpbmVicmVha1wiLFxuICAgICAgICBcIm1vcmVcIjpcIm1vcmVcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiaW5zZXJ0dGFibGVcIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiZGVsZXRldGFibGVcIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiY29sdW1uYWZ0ZXJcIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwicm93YWZ0ZXJcIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcImRlbGNvbHVtblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiZGVscm93XCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJtZXJnZW9yc3BsaXRcIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcImhlYWRlcmNvbHVtblwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiaGVhZGVycm93XCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcInNlbGVjdGVkIHdvcmRzL2NoYXJzXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcInByaW50IHJlcXVlc3Qgc2VudFwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcInByaW50IHJlcXVlc3QgZGVuaWVkXCIsXG4gICAgICAgIFwicGFzdGVcIjpcInBhc3RlXCIsXG4gICAgICAgIFwiY29weVwiOlwiY29weVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJkZWFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJSZWxvYWRcIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV291bGQgeW91IGxpa2UgdG8gcmVpbml0aWFsaXplIHRoZSBFZGl0b3I/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcImtlZXAgY29udGVudFwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJJbnNlcnQgc3BlY2lhbGNoYXJhY3RlclwiLFxuICAgICAgICBcInByaW50XCI6IFwicHJpbnRcIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIlBsYXkgQXVkaW9cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJEbyB5b3Ugd2FudCB0byBwbGF5IHRoZSBhdWRpb2ZpbGU/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlJlbWFpbmluZyBwbGF5YmFja3M6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJZb3UgZG9uJ3QgaGF2ZSB0aGUgcGVybWlzc2lvbiB0byBwbGF5IHRoaXMgZmlsZSFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkluc2VydCBJbWFnZVwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiSW5zZXJ0IE11Z3Nob3RcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJTZW5kIHdvcmsgdG8gdGVhY2hlclwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIkNsb3NlXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiRXhpdCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRmlsZW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJQbGVhc2UgZW50ZXIgb25seSBsZXR0ZXJzIGFuZCBudW1iZXJzIHdpdGhvdXQgc3BlY2lhbCBjaGFyYWN0ZXJzXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJjbGVhciBjb250ZW50P1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiTm8gdmFsaWQgUERGIEZpbGVcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiV3JvbmcgcGFzc3dvcmRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiUmVsb2FkIHdlYnZpZXdcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiV2llZGVyaGVyc3RlbGxlblwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJCZWVuZGVuXCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIkJlbnV0emVybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcIm1lbGRlIGFuLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcImFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJWZXJiaW5kdW5nIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU2llIGhhYmVuIHNpY2ggZXJmb2xncmVpY2ggYW0gU2VydmVyIHJlZ2lzdHJpZXJ0ISBcXG5cXG5CaXR0ZSB3YXJ0ZW4gU2llIGF1ZiBkaWUgQWt0aXZpZXJ1bmcgZGVzIFByXHUwMEZDZnVuZ3Ntb2R1cyBkdXJjaCBkaWUgTGVocnBlcnNvbiFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwiU3VjaGUgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkZhbHNjaGVyIEJlbnV0emVybmFtZSBvZGVyIFBpbmNvZGVcIixcbiAgICAgICAgXCJub3VzZXJcIjogXCJCZW51dHplcm5hbWUgZmVobHRcIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRyZXNzZSBvZGVyIFByXHUwMEZDZnVuZ3NuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiLFxuICAgICAgICBcIm5vcGluXCI6IFwiUGluY29kZSBmZWhsdFwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6IFwiU2VydmVyIEFQSSBuaWNodCBlcnJlaWNoYmFyLlwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBiZWZpbmRldCBzaWNoIG1cdTAwRjZnbGljaGVyd2Vpc2UgaGludGVyIGVpbmVyIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiS2VpbmUgUHJcdTAwRkNmdW5nc3NlcnZlciBhbiBhbmdlZ2ViZW5lciBBZHJlc3NlXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9rYWwgYWJzcGVycmVuXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51ZWxsIHN1Y2hlblwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIktlaW5lIFByXHUwMEZDZnVuZ2VuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiUHJcdTAwRkNmdW5nc21vZHVzIGF1c3dcdTAwRTRobGVuXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiQml0dGUgaW5zdGFsbGllcmVuIHNpZSBkaWUgc2VsYmUgVmVyc2lvbiB3aWUgYW0gUHJcdTAwRkNmdW5nc3NlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGdlc3RhcnRldFwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIG5pY2h0IGFrdGl2XCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gZW50ZmVybnRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJEYXRlaWVuIGdlc3BlaWNoZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiRmVobGVyIGJlaW0gU2NocmVpYmVuIGRlciBEYXRlaVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJCaXR0ZSBzdGVsbGVuIFNpZSBzaWNoZXIsIGRhc3MgZGFzICdFWEFNLVNUVURFTlQnIFZlcnplaWNobmlzIGZcdTAwRkNyIE5leHQtRXhhbSBzY2hyZWliYmFyIGlzdCB1bmQgZ2VuXHUwMEZDZ2VuZCBTcGVpY2hlcnBsYXR6IHZvcmhhbmRlbiBpc3QuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJFaW5lIGxva2FsZSBTaWNoZXJ1bmcga29ubnRlIG5pY2h0IGVyc3RlbGx0IHdlcmRlbi4gTnV0emVuIFNpZSBkaWUgbWFudWVsbGUgQWJnYWJlIHVtIElocmUgQXJiZWl0IGRpcmVrdCBhbiBkaWUgTGVocnBlcnNvbiB6dSBzZW5kZW4uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJOaWNodCBtZWhyIGFuemVpZ2VuXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBnZWZ1bmRlblwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuIGhvbGVuXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIkZpbmFsZSBBYmdhYmUgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkFiZ2FiZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIkFrdHVhbGlzaWVyZW5cIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9rYWxlIERhdGVpZW46XCIsXG5cbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGFsdGVuYW5zaWNodFwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIlNpZSBoYWJlbiBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJNZWxkZW4gU2llIHNpY2ggdW1nZWhlbmQgYmVpIGRlciBBdWZzaWNodHNwZXJzb24hXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiV29sbGVuIFNpZSBkZW4gSW5oYWx0IGRlcyBFZGl0b3JzIGR1cmNoIGRlbiBJbmhhbHQgZGVyIERhdGVpXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJFcnNldHplblwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwLURhdGVpIGtvbm50ZSBuaWNodCBnZWxlc2VuIHdlcmRlblwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBlcmZvbGdyZWljaCBnZWxhZGVuXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBMYWRlbiBkZXIgQmFja3VwLURhdGVpXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiRXJmb2xnXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJaZWljaGVuXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJXXHUwMEY2cnRlclwiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcIm5ldSB2ZXJiaW5kZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJlbnRzcGVycmVuXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJWZXJsYXNzZW4gU2llIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIG5pZSBvaG5lIEZyZWlnYWJlIGVpbmVyIExlaHJwZXJzb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIlNvbGx0ZSBkZXIgVm9yZ2FuZyBmZWhsc2NobGFnZW4gYmVlbmRlbiBTaWUgYml0dGUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdW5kIHZlcnN1Y2hlbiBTaWUgZXMgZXJuZXV0IVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiSWhyZSBBcmJlaXQgd3VyZGUgZXJmb2xncmVpY2ggZ2VzaWNoZXJ0IVwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkRpZSBha3R1ZWxsZSBBcmJlaXQgd2lyZCBnZXNpY2hlcnQgdW5kIGluIGRpZSBad2lzY2hlbmFibGFnZSBrb3BpZXJ0IVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJzaWNoZXJuXCIsXG4gICAgICAgIFwidW5kb1wiOlwiclx1MDBGQ2NrZ1x1MDBFNG5naWdcIixcbiAgICAgICAgXCJyZWRvXCI6XCJ3aWVkZXJob2xlblwiLFxuICAgICAgICBcImNsZWFyXCI6XCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJib2xkXCI6XCJmZXR0XCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJrdXJzaXZcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVudGVyc3RyaWNoZW5cIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiXHUwMERDYmVyc2NocmlmdCAxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiXHUwMERDYmVyc2NocmlmdCA0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInRpZWZnZXN0ZWxsdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJob2NoZ2VzdGVsbHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJ1bmdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImxpc3RcIjpcImdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiQ29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiQ29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcIlppdGF0XCIsXG4gICAgICAgIFwibGluZVwiOlwiU2VpdGVudW1icnVjaFwiLFxuICAgICAgICBcImxlZnRcIjpcIkxpbmtzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcIlplbnRyaWVydFwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJSZWNodHNiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwiVGV4dGZhcmJlXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJaZWlsZW51bWJydWNoXCIsXG4gICAgICAgIFwibW9yZVwiOlwibWVoclwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJUYWJlbGxlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiVGFiZWxsZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiU3BhbHRlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwiUmVpaGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiU3BhbHRlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiUmVpaGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJWZXJlaW5lbiBvZGVyIFRlaWxlblwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiVGl0ZWxzcGFsdGVcIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcIlRpdGVscmVpaGVcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwiV1x1MDBGNnJ0ZXIvWmVpY2hlbiBpbiBBdXN3YWhsXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcIkRydWNrYW5mcmFnZSBnZXNlbmRldCFcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJEcnVja2FuZnJhZ2UgYWJnZWxlaG50LiBCaXR0ZSB3YXJ0ZW4gdW5kIGVybmV1dCBzZW5kZW4uXCIsXG4gICAgICAgIFwicGFzdGVcIjpcImVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJjb3B5XCI6XCJrb3BpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGRlYWt0aXZpZXJlblwiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIk5ldSBsYWRlblwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb2xsZW4gU2llIGRlbiBUZXh0ZWRpdG9yIG5ldSBpbml0aWFsaXNpZXJlbj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwiSW5oYWx0IGJlaWJlaGFsdGVuXCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIlNvbmRlcnplaWNoZW4gZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiQXVkaW8gYWJzcGllbGVuXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiV29sbGVuIFNpZSBkYXMgSFx1MDBGNnJiZWlzcGllbCBqZXR6dCBhYnNwaWVsZW4/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlZlcmJsZWliZW5kZSBEdXJjaGxcdTAwRTR1ZmU6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJTaWUgaGFiZW4ga2VpbmUgQmVyZWNodGlndW5nIGRpZSBBdWRpb2RhdGVpIGVybmV1dCBhYnp1c3BpZWxlbiFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkJpbGQgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiTXVnc2hvdCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiQXJiZWl0IGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiU2NobGllXHUwMERGZW5cIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJEYXRlaW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJCaXR0ZSBnZWJlbiBTaWUgbnVyIEJ1Y2hzdGFiZW4gb2RlciBaYWhsZW4gZWluLlwiLFxuICAgICAgICBcImNsZWFyXCI6IFwiQWxsZSBCZXJlY2hudW5nZW4gbFx1MDBGNnNjaGVuP1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIGdcdTAwRkNsdGlnZSBQREYgRGF0ZWlcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiRmFsc2NoZXMgUGFzc3dvcnRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiV2VidmlldyBuZXUgbGFkZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIlxuICAgIH1cbn1cbiIsICJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuY29uc3QgcHVibGljQmFzZSA9ICgpID0+IChhcHAuaXNQYWNrYWdlZCA/IHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSA6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKSk7XG5cbmxldCBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKHB1YmxpY0Jhc2UoKSwgJ0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpO1xubGV0IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJyk7XG5cblxuXG5cblxuY2xhc3MgTGFuZ3VhZ2VUb29sU2VydmVyIHtcbiAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBJbml0aWFsaXNpZXJ0IGRpZSBQcm96ZXNzdmFyaWFibGVcbiAgICAgICAgIHRoaXMucG9ydCA9IDgwODhcbiAgICAgfVxuIFxuICAgICBzdGFydFNlcnZlcigpIHtcbiAgICAgICAgIGlmICh0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgJiYgIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nLicpO1xuICAgICAgICAgICAgIHJldHVybjsgLy8gVmVyaGluZGVydCBkYXMgZXJuZXV0ZSBTdGFydGVuLCB3ZW5uIGRlciBTZXJ2ZXIgYmVyZWl0cyBsXHUwMEU0dWZ0XG4gICAgICAgICB9XG4gICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gSnJlSGFuZGxlci5qU3Bhd24oXG4gICAgICAgICAgICAgICAgW2xhbmd1YWdlVG9vbEphclBhdGhdLCAvLyBLbGFzc2VucGZhZFxuICAgICAgICAgICAgICAgICdvcmcubGFuZ3VhZ2V0b29sLnNlcnZlci5IVFRQU2VydmVyJywgLy8gSGF1cHRrbGFzc2UgZGVyIExhbmd1YWdlVG9vbCBBUElcbiAgICAgICAgICAgICAgICBbJy0tcG9ydCcsIHRoaXMucG9ydCwnLS1jb25maWcnLGxhbmd1YWdlVG9vbENvbmZpZ1BhdGgsICctLWFsbG93LW9yaWdpbicsIFwiJyonXCIgXSAvLyBadXNcdTAwRTR0emxpY2hlIEFyZ3VtZW50ZSwgei5CLiBQb3J0IHVuZCBDT1JTLUVybGF1Ym5pc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcylcbiAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIEFQSSBydW5uaW5nIGF0IGxvY2FsaG9zdDo4MDg4Jyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCBkYXRhID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhOiBSZWNlaXZlZCBkYXRhIGZyb20gTGFuZ3VhZ2VUb29sIEFQSScsIGRhdGEudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXJyb3InKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtZXJyb3I6Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdGFydGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY2hlY2sgZG9uZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFuZGxlZCByZXF1ZXN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIEFjY3VtdWxhdGUgc3RkZXJyIGRhdGEgdG8gaGFuZGxlIGNodW5rZWQgb3V0cHV0XG4gICAgICAgICAgICBsZXQgc3RkZXJyQnVmZmVyID0gJyc7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyICs9IGNodW5rO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcodGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBib3RoIGN1cnJlbnQgY2h1bmsgYW5kIGFjY3VtdWxhdGVkIGJ1ZmZlciBmb3IgcG9ydC1yZWxhdGVkIGVycm9yc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXNwb25zZSA9IHN0ZGVyckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcnRFcnJvciA9IGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhwb3J0U3RyKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRyZXNzZSB3aXJkIGJlcmVpdHMgdmVyd2VuZGV0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJNYXliZSBzb21ldGhpbmcgZWxzZSBpcyBydW5uaW5nIG9uIHRoYXQgcG9ydFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoaXNQb3J0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBhbm90aGVyIExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgcHJvYmFibHkgYWxyZWFkeSBydW5uaW5nIG9uIHBvcnQ6JywgdGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsuaW5jbHVkZXMoJ1xcbicpIHx8IGZ1bGxSZXNwb25zZS5sZW5ndGggPiAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIHdlIGhhdmUgYSBuZXdsaW5lIChsaWtlbHkgY29tcGxldGUgbWVzc2FnZSkgb3IgYnVmZmVyIGlzIGdldHRpbmcgbGFyZ2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhLWVycm9yOicsIGZ1bGxSZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBTZXR6dCBkZW4gUHJvemVzcyB6dXJcdTAwRkNjaywgd2VubiBlciBiZWVuZGV0IHdpcmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGdlbmVyYWwtZXJyb3I6JywgZXJyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgfVxuXG4gICAgIHN0b3BTZXJ2ZXIoKSB7XG4gICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcykge1xuICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkLCBub3RoaW5nIHRvIHN0b3AnKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZpcnN0IHRyeSB0byBraWxsIHRoZSBwcm9jZXNzIGRpcmVjdGx5IGlmIHdlIGhhdmUgYSByZWZlcmVuY2VcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mga2lsbGVkJyk7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGZhaWxlZCB0byBraWxsIHByb2Nlc3MgZGlyZWN0bHksIHRyeWluZyBwbGF0Zm9ybS1zcGVjaWZpYyBtZXRob2Q6JywgZXJyKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgcGxhdGZvcm0tc3BlY2lmaWMgY29tbWFuZHMgdG8ga2lsbCB0aGUgcHJvY2VzcyAob25seSBpZiB3ZSBoYWQgYSBwcm9jZXNzIHJlZmVyZW5jZSlcbiAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgIGxldCBjb21tYW5kO1xuXG4gICAgICAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAvLyBXaW5kb3dzOiBmaW5kIGFuZCBraWxsIGphdmEgcHJvY2Vzc2VzIHJ1bm5pbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgd21pYyAod29ya3Mgb24gb2xkZXIgV2luZG93cyksIHRoZW4gdHJ5IFBvd2VyU2hlbGwsIHRoZW4gZmFsbGJhY2sgdG8gcG9ydC1iYXNlZCBraWxsXG4gICAgICAgICAgICAgY29tbWFuZCA9IGB3bWljIHByb2Nlc3Mgd2hlcmUgXCJjb21tYW5kbGluZSBsaWtlICclbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIlJ1wiIGRlbGV0ZSAyPm51bCB8fCBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgamF2YSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7JF8uQ29tbWFuZExpbmUgLWxpa2UgJypsYW5ndWFnZXRvb2wtc2VydmVyLmphcionfSB8IFN0b3AtUHJvY2VzcyAtRm9yY2VcIiAyPm51bCB8fCBmb3IgL2YgXCJ0b2tlbnM9NVwiICVhIGluICgnbmV0c3RhdCAtYW5vIF58IGZpbmRzdHIgOjgwODgnKSBkbyB0YXNra2lsbCAvRiAvUElEICVhIDI+bnVsYDtcbiAgICAgICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8IHBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgICAgLy8gbWFjT1MgYW5kIExpbnV4OiB1c2UgcGtpbGwgdG8ga2lsbCBwcm9jZXNzZXMgbWF0Y2hpbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICBjb21tYW5kID0gJ3BraWxsIC1mIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJztcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IHVuc3VwcG9ydGVkIHBsYXRmb3JtOicsIHBsYXRmb3JtKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIGV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAvLyBJdCdzIG9rYXkgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGZvdW5kIChhbHJlYWR5IGtpbGxlZClcbiAgICAgICAgICAgICAgICAgLy8gcGtpbGwgcmV0dXJucyBjb2RlIDEgd2hlbiBubyBwcm9jZXNzIGlzIGZvdW5kLCB3aGljaCBpcyBleHBlY3RlZFxuICAgICAgICAgICAgICAgICBpZiAoZXJyb3IuY29kZSAhPT0gMSAmJiAhZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnbm90IGZvdW5kJykgJiYgIXN0ZGVyci50b1N0cmluZygpLmluY2x1ZGVzKCdObyBzdWNoIHByb2Nlc3MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGVycm9yIGtpbGxpbmcgTGFuZ3VhZ2VUb29sIHNlcnZlcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mgbm90IGZvdW5kIChtYXkgYWxyZWFkeSBiZSBzdG9wcGVkKScpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgc3RvcHBlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgIH0pO1xuICAgICB9XG4gfVxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTGFuZ3VhZ2VUb29sU2VydmVyKClcblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBwcm9jZXNzIGZyb20gJ3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4gLy8gZXZlcnkgcGxhdGZvcm0gbmVlZHMgaXQncyBvd24ganJlIChsaW51eCwgd2luMzIsIGRhcndpbikgLy9maXhtZTogdXNlIEdyYWFsVk0gdG8gcHJlY29tcGlsZSBsYW5ndWFnZXRvb2wgaW4gb3JkZXIgdG8gc2F2ZSBzcGFjZSBhbmQgZ2V0IHJpZCBvZiBqcmU/XG5jbGFzcyBKcmVIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7IH1cblxuICAgIGluaXQoKXsgXG4gICAgICAgIHRoaXMualRlc3QoKVxuICAgIH1cblxuXG4gICAgalRlc3QoKXtcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKTsgLy8gJy9wZmFkL3p1ci9qYXZhJ1xuICAgICAgICBjb25zdCBwcm9jID0gc3Bhd24oamF2YXBhdGgsIFsnLXZlcnNpb24nXSk7XG4gICAgXG4gICAgICAgIHByb2Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGRhdGEudG9TdHJpbmcoKS5zcGxpdCgnXFxuJyk7IC8vIGluIFplaWxlbiBzcGxpdHRlblxuICAgICAgICAgICAgbG9nLmRlYnVnKGBqcmUtaGFuZGxlciBAIGpUZXN0OiAke2xpbmVzWzBdfWApOyAvLyBudXIgZGllIGVyc3RlIFplaWxlIGxvZ2dlblxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZmFpbChyZWFzb24pIHtcbiAgICAgICAgbG9nLmVycm9yKHJlYXNvbik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBnZXREaXJlY3RvcmllcyhkaXJQYXRoKSB7XG4gICAgICAgIGxldCBkaXJzID0gZnMucmVhZGRpclN5bmMoZGlyUGF0aCkuZmlsdGVyKFxuICAgICAgICAgICAgZmlsZSA9PiBmcy5zdGF0U3luYyhwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZSkpLmlzRGlyZWN0b3J5KClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGRpcnNcbiAgICB9IFxuXG4gICAgZHJpdmVyKCl7XG4gICAgICAgIHZhciBkID0gcGxhdGZvcm1EaXNwYXRjaGVyLmphdmFCaW4uc2xpY2UoKTtcbiAgICAgICAgZC51bnNoaWZ0KHBsYXRmb3JtRGlzcGF0Y2hlci5qcmVEaXIpO1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luLmFwcGx5KHBhdGgsIGQpO1xuICAgIH1cblxuICAgIGdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKS5zbGljZSgpO1xuICAgICAgICBjbGFzc3BhdGggPSBjbGFzc3BhdGggfHwgW107XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc25hbWUpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NwYXRoLmpvaW4odGhpcy5fcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOicpKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KCctY3AnKTtcbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgalNwYXduKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIFxuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpXG4gICAgICAgIGxldCBqYXZhYXJncyA9IHRoaXMuZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncylcbiAgICAgICAgbGV0IGphdmFjbWRsaW5lID0gIGAke2phdmFwYXRofSAke2phdmFhcmdzLmpvaW4oJyAnKX0gYFxuXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogJyR7cGxhdGZvcm1EaXNwYXRjaGVyLmpyZX0nIHNlbGVjdGVkYClcbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiBzcGF3bmluZyBqYXZhIHByb2Nlc3M6ICR7amF2YWNtZGxpbmV9YClcbiAgICAgICAgcmV0dXJuIHNwYXduKGphdmFwYXRoLCBqYXZhYXJncywge3NoZWxsOmZhbHNlfSk7XG4gICAgICAgLy8gcmV0dXJuIHNwYXduKGphdmFjbWRsaW5lKTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IEpyZUhhbmRsZXIoKVxuIiwgIi8vIHNjcmlwdHMvU3lzdGVtVHJheU1hbmFnZXIuanNcbmltcG9ydCB7IGFwcCwgVHJheSwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmxldCB0cmF5ID0gbnVsbDtcblxuLy8gUmVzb2x2ZSBpY29uIHBhdGg6IHBhY2thZ2VkIGFwcCB1c2VzIHVucGFja2VkIHB1YmxpYyBkaXIsIGRldiB1c2VzIHByb2plY3QgcHVibGljXG5mdW5jdGlvbiBnZXRUcmF5SWNvblBhdGgoKSB7XG4gIGNvbnN0IHB1YmxpY0Jhc2UgPSBwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gIHJldHVybiBwYXRoLmpvaW4ocHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24yNHgyNC5wbmcnKTtcbn0gXG5cbi8vID09PSByZXBsYWNlIHRoZSBoZWxwZXIgc2V0TG9jYWxlIChleGFjdCBibG9jaykgPT09XG5jb25zdCBzZXRMb2NhbGUgPSAobG9jKSA9PiB7XG4gICAgY29uc3QgZ2wgPSBpMThuLmdsb2JhbDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCBnbG9iYWwgY29tcG9zZXJcbiAgICBpZiAoZ2wgJiYgdHlwZW9mIGdsLmxvY2FsZSA9PT0gJ29iamVjdCcgJiYgZ2wubG9jYWxlKSB7XG4gICAgICAvLyB2dWUtaTE4biBjb21wb3NpdGlvbiBtb2RlXG4gICAgICBpZiAoJ3ZhbHVlJyBpbiBnbC5sb2NhbGUpIGdsLmxvY2FsZS52YWx1ZSA9IGxvYzsgICAgIC8vIHNldCByZWFjdGl2ZSB2YWx1ZVxuICAgICAgZWxzZSBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsYmFja1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBsZWdhY3kgbW9kZSBvciBwbGFpbiBzdHJpbmdcbiAgICAgIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHN0cmluZyBsb2NhbGVcbiAgICB9XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgXG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHRyYXkgaWNvbiBpZiBpdCBkb2Vzbid0IGV4aXN0IGFuZCB1cGRhdGVzIGl0cyBjb250ZXh0IG1lbnUuXG4gKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIG5ldyBsb2NhbGUgdG8gYXBwbHkuXG4gKi9cblxuXG5cbmV4cG9ydCBjb25zdCB1cGRhdGVTeXN0ZW1UcmF5ID0gKGxvY2FsZSkgPT4ge1xuICAgIHNldExvY2FsZShsb2NhbGUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgdCA9IChrKSA9PiBpMThuLmdsb2JhbC50KGspOyAgICAgICAgICAgICAgICAgICAgICAvLyBhbHdheXMgcmVzb2x2ZSBsaXZlXG4gIFxuICAgIGlmICghdHJheSkge1xuICAgICAgdHJheSA9IG5ldyBUcmF5KGdldFRyYXlJY29uUGF0aCgpKTtcbiAgICAgIHRyYXkub24oJ2NsaWNrJywgKCkgPT4geyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2dsZSB3aW5kb3dcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpIFxuICAgICAgICAgID8gV2luZG93SGFuZGxlci5tYWlud2luZG93LmhpZGUoKSBcbiAgICAgICAgICA6IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIFxuICAgIC8vIGJ1aWxkIGNvbnRleHQgbWVudSB3aXRoIGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgY29udGV4dE1lbnUgPSBNZW51LmJ1aWxkRnJvbVRlbXBsYXRlKFtcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5yZXN0b3JlJyksIGNsaWNrOiAoKSA9PiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpIH0sIC8vIHNob3cgd2luZG93XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZGlzY29ubmVjdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cuaW5mbyhcIm1haW4gQCBzeXN0ZW10cmF5OiByZW1vdmluZyByZWdpc3RyYXRpb25cIik7IFxuICAgICAgICAgIENvbW1IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpOyBcbiAgICAgICAgfSBcbiAgICAgIH0sIC8vIGRpc2Nvbm5lY3RcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5leGl0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IENsb3NpbmcgTmV4dC1FeGFtXCIpOyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXCIpOyBcbiAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgXG4gICAgICAgICAgYXBwLnF1aXQoKTsgXG4gICAgICAgIH0gXG4gICAgICB9IC8vIGV4aXRcbiAgICBdKTtcbiAgXG4gICAgdHJheS5zZXRUb29sVGlwKCdOZXh0LUV4YW0gU3R1ZGVudCcpOyAgICAgICAgICAgICAgICAgICAvLyBzZXQgdG9vbHRpcFxuICAgIHRyYXkuc2V0Q29udGV4dE1lbnUoY29udGV4dE1lbnUpOyAgICAgICAgICAgICAgICAgICAgICAgLy8gYXBwbHkgbWVudVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gICIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBzY3JpcHQgaXMgdXNlZCB0byB0ZXN0IHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICogSXQgdXNlcyB0aGUgdGNjdXRpbCBjb21tYW5kIHRvIHRlc3QgYW5kIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICogSXQgcmV0dXJucyB0cnVlIGlmIHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIGFyZSBhbGxvd2VkIGFuZCBmYWxzZSBpZiB0aGV5IGFyZSBub3RcbiAqIFxuICogVGhpcyBjb3VsZCBhbHNvIGJlIHVzZWQgdG8gdGVzdCBvdGhlciBwZXJtaXNzaW9ucyBsaWtlIGFjY2Vzc2liaWxpdHksIHNjcmVlbiBjYXB0dXJlLCBldGMuIFxuICogc2VlIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGZvciBtb3JlIGRldGFpbHMgb24gaG93IHRvIHRlc3QgZm9yIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgKGl0cyBub3QgcG9zc2libGUgdG8gdGVzdCBmb3Igc2NyZWVuIGNhcHR1cmUgcGVybWlzc2lvbnMgb24gbWFjb3MgYmVjYXVzZSB3aXRob3V0IHBlcm1pc3Npb25zIGl0IHdpbGwgYWx3YXlzIHJldHVybiBhIGJsYW5rIHNjcmVlbnNob3QgLSB3ZSB1c2UgYSB3b3JrYXJvdW5kIHRvIGRldGVjdCB0aGlzKVxuICogXG4gKi9cblxuXG5cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBydW4gdGNjdXRpbFxuaW1wb3J0IHsgZGlhbG9nLCBhcHAgfSBmcm9tICdlbGVjdHJvbicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2hvdyBkaWFsb2cgYW5kIHF1aXRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuXG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAgICAgICAgICAgICAgICAvLyByZXR1cm5zIHRydWUgaWYgZmV0Y2ggd29ya3NcbiAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHtzZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wb25nYCwgeyBtZXRob2Q6ICdHRVQnLCBjYWNoZTogJ25vLXN0b3JlJyB9KSAvLyB0ZXN0IHJlcXVlc3RcbiAgICAgICAgICAgIHJldHVybiByZXMub2tcbiAgICB9IGNhdGNoIHsgIHJldHVybiBmYWxzZSB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNldFRDQygpIHsgICAgICAvLyByZXNldCBUQ0MgcGVybWlzc2lvbnNcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvL2FwcElkXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS5zdHVkZW50YCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcbiAgICAgICAgLy9hcHBCdW5kbGVJZCAoc2V0IHZpYSBub3Rhcml6ZSlcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLXN0dWRlbnQuYXBwYCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcblxuXG4gICAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7IC8vIGNoZWNrIG9yIHJlc2V0XG4gICAgY29uc3Qgb2sgPSBhd2FpdCB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpXG4gICAgaWYgKG9rKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5ldHdvcmsgYWNjZXNzIGlzIGFsbG93ZWRgKTtcbiAgICAgICAgICAgIHJldHVybiBcIm9rXCI7XG4gICAgfVxuICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTm8gSFRUUCByZXF1ZXN0cyBhbGxvd2VkIWAgKVxuXG4gICAgdHJ5IHtcblxuICAgICAgICAvLyBhc2sgdGhlIHVzZXJzIGlmIHRoZXkgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnMgYW5kIGV4aXQgdGhlIGFwcCBpZiB0aGV5IGRvXG4gICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEZXIgU2VydmVyIGlzdCBuaWNodCBlcnJlaWNoYmFyLiBNXHUwMEY2Y2h0ZW4gU2llIGRpZSBCZXJlY2h0aWd1bmdlbiB6dXJcdTAwRkNja3NldHplbiB1bmQgTmV4dC1FeGFtIG1hbnVlbGwgbmV1IHN0YXJ0ZW4/JyxcbiAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snLCAnQWJicmVjaGVuJ10sXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChjaG9pY2UucmVzcG9uc2UgPT09IDApIHsgICAgLy8gcmVzZXQgcGVybWlzc2lvbnMgYW5kIHJldHVybiB0cnVlIHRvIHF1aXQgdGhlIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBSZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9ucyBhbmQgcXVpdHRpbmcgYXBwYCk7XG4gICAgICAgICAgICBhd2FpdCByZXNldFRDQygpOyBcbiAgICAgICAgICAgIHJldHVybiBcInJlc2V0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlIFxuICAgICAgICB9ICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gXG4gICAgfSBcbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBsb2cuZXJyb3IoYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBFcnJvciByZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9uczogJHtlfWApO1xuICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdGZWhsZXIgYmVpbSBadXJcdTAwRkNja3NldHplbiBkZXIgQmVyZWNodGlndW5nZW4nLFxuICAgICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZS5lcnIgfHwgZSksXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuICAgIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gQ291bnRlciBmb3IgZmFpbGVkIGF0dGVtcHRzIC0gc2tpcCBleGVjdXRpb24gYWZ0ZXIgNCBjb25zZWN1dGl2ZSBmYWlsdXJlc1xubGV0IGZhaWx1cmVDb3VudGVyID0gMDtcbmNvbnN0IE1BWF9GQUlMVVJFUyA9IDM7XG5cbi8vIENvbnZlcnQgUlNTSSBpbiBkQm0gdG8gYSBxdWFsaXR5IHBlcmNlbnRhZ2UgYmV0d2VlbiAwIGFuZCAxMDAuXG5mdW5jdGlvbiBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSkge1xuICAgIGlmIChkYm0gPT09IG51bGwgfHwgTnVtYmVyLmlzTmFOKGRibSkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IG1pbkRibSA9IC0xMDA7XG4gICAgY29uc3QgbWF4RGJtID0gLTMwO1xuICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heChtaW5EYm0sIE1hdGgubWluKG1heERibSwgZGJtKSk7XG4gICAgY29uc3QgcGVyY2VudCA9ICgoY2xhbXBlZCAtIG1pbkRibSkgLyAobWF4RGJtIC0gbWluRGJtKSkgKiAxMDA7XG4gICAgcmV0dXJuIE1hdGgucm91bmQocGVyY2VudCk7XG59XG5cbi8qKlxuICogR2V0IGN1cnJlbnQgV0xBTiBpbmZvcm1hdGlvbiAoU1NJRCwgQlNTSUQsIFF1YWxpdHkpXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7c3NpZDogc3RyaW5nfG51bGwsIGJzc2lkOiBzdHJpbmd8bnVsbCwgcXVhbGl0eTogbnVtYmVyfG51bGwsIG1lc3NhZ2U6IHN0cmluZ3xudWxsfT59XG4gKiBAZGVzY3JpcHRpb24gbWVzc2FnZSBjYW4gYmU6IFwiZXJyb3JcIiAob24gZXJyb3IpLCBcIm5vaW50ZXJmYWNlXCIgKG5vIGludGVyZmFjZSBhdmFpbGFibGUpLCBcIm5vcGVybWlzc2lvbnNcIiAobG9jYXRpb24gcGVybWlzc2lvbnMgbWlzc2luZyBvbiBXaW5kb3dzKSwgb3IgbnVsbCAoc3VjY2VzcylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvKCkge1xuICAgIC8vIFNraXAgZXhlY3V0aW9uIGlmIHdlJ3ZlIGhhZCB0b28gbWFueSBjb25zZWN1dGl2ZSBmYWlsdXJlc1xuICAgIGlmIChmYWlsdXJlQ291bnRlciA+PSBNQVhfRkFJTFVSRVMpIHtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICBcbiAgICAgICAgc3dpdGNoIChwbGF0Zm9ybSkge1xuICAgICAgICAgICAgY2FzZSAnbGludXgnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTGludXgoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9NYWNPUygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEVuc3VyZSByZXN1bHQgaXMgYWx3YXlzIGFuIG9iamVjdFxuICAgICAgICBpZiAoIXJlc3VsdCB8fCB0eXBlb2YgcmVzdWx0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlc2V0IGNvdW50ZXIgb24gc3VjY2Vzc2Z1bCByZXN1bHQgKGhhcyBkYXRhKVxuICAgICAgICBpZiAocmVzdWx0LnNzaWQgfHwgcmVzdWx0LmJzc2lkIHx8IHJlc3VsdC5xdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlciA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbmNyZW1lbnQgY291bnRlciBvbiBmYWlsdXJlXG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIFJldHVybiBlbXB0eSBvYmplY3QgaW5zdGVhZCBvZiB0aHJvd2luZyB0byBwcmV2ZW50IGFwcCBjcmFzaFxuICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIExpbnV4IHVzaW5nIG5tY2xpICh3aXRoIGZhbGxiYWNrIHRvIGl3L2l3Y29uZmlnKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb0xpbnV4KCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBubWNsaSBmaXJzdCAobW9zdCBjb21tb24gb24gbW9kZXJuIExpbnV4KVxuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZ2V0IGFjdGl2ZSBkZXZpY2UgZGlyZWN0bHkgKGZhc3RlciB0aGFuIGxpc3RpbmcgYWxsIG5ldHdvcmtzKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHN0ZG91dCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYygnbm1jbGkgLXQgLWYgYWN0aXZlLHNzaWQsYnNzaWQsc2lnbmFsIGRldmljZSB3aWZpIGxpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDQwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3Rkb3V0ID0gcmVzdWx0LnN0ZG91dDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBjYXRjaCAoZXhlY0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gRXZlbiBpZiBleGVjQXN5bmMgdGhyb3dzIGFuIGVycm9yLCBjaGVjayBpZiBzdGRvdXQgY29udGFpbnMgdmFsaWQgZGF0YVxuICAgICAgICAgICAgICAgIC8vIG5tY2xpIHNvbWV0aW1lcyByZXR1cm5zIG5vbi16ZXJvIGV4aXQgY29kZSBidXQgc3RpbGwgcHJvdmlkZXMgdmFsaWQgb3V0cHV0XG4gICAgICAgICAgICAgICAgaWYgKGV4ZWNFcnJvci5zdGRvdXQgJiYgZXhlY0Vycm9yLnN0ZG91dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzdGRvdXQgPSBleGVjRXJyb3Iuc3Rkb3V0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4ZWNFcnJvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvdXRwdXQgZnJvbSBubWNsaScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmluZCBhY3RpdmUgY29ubmVjdGlvblxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICAgICAgaWYgKChwYXJ0c1swXSA9PT0gJ3llcycgfHwgcGFydHNbMF0gPT09ICdqYScpICYmIHBhcnRzLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBwYXJ0c1sxXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgLy8gQlNTSUQgaXMgYSBNQUMgYWRkcmVzcyAoNiBoZXggYnl0ZXMgc2VwYXJhdGVkIGJ5IGNvbG9ucywgcG9zc2libHkgZXNjYXBlZClcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCB1c2luZyByZWdleCAtIGhhbmRsZSBlc2NhcGVkIGNvbG9ucyAoXFw6KSBhcyBzaG93biBpbiBubWNsaSBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gcmVnZXggc3RyaW5nLCBcXFxcOiBtYXRjaGVzIGEgbGl0ZXJhbCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgY29sb25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86XFxcXDpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZXNjYXBlIGJhY2tzbGFzaGVzIGFuZCBub3JtYWxpemUgdG8gdXBwZXJjYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2hbMF0ucmVwbGFjZSgvXFxcXDovZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBub3JtYWwgY29sb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbm9ybWFsTWF0Y2hbMF0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBwYXJ0c1syXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTaWduYWwgaXMgdGhlIGxhc3QgbnVtZXJpYyBwYXJ0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbFN0ciA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID8gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHJpbSgpIDogJyc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IHNpZ25hbFN0ciA/IChwYXJzZUludChzaWduYWxTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChubWNsaUVycm9yKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQsIGV0Yy4pLCBub3QgaWYganVzdCBubyBXTEFOIGFjdGl2ZVxuICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBubWNsaUVycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChubWNsaUVycm9yLm1lc3NhZ2UgJiYgIW5tY2xpRXJyb3IubWVzc2FnZS5pbmNsdWRlcygnTm8gb3V0cHV0JykpO1xuICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBubWNsaSBjb21tYW5kIGZhaWxlZDonLCBubWNsaUVycm9yLm1lc3NhZ2UgfHwgbm1jbGlFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGl3IChpd2NvbmZpZyBpcyBkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtRSBcIl5cXHMqc3NpZHxeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdsaW5rU3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUEgNSBcIl5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgU1NJRFxuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGl3U3Rkb3V0ID8gaXdTdGRvdXQubWF0Y2goL3NzaWRcXHMrKC4rKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gc3NpZE1hdGNoID8gc3NpZE1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCBhbmQgc2lnbmFsIGZyb20gbGluayBpbmZvXG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvYWRkcjpcXHMrKFthLWYwLTk6XXsxN30pL2kpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9zaWduYWw6XFxzKygtP1xcZCspLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbERibSA9IHNpZ25hbE1hdGNoID8gKHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1YWxpdHkgPSBzaWduYWxEYm0gIT09IG51bGwgPyBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbERibSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGl3RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IGl3IGNvbW1hbmQgZmFpbGVkOicsIGl3RXJyb3IubWVzc2FnZSB8fCBpd0Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gTGFzdCBmYWxsYmFjazogaXdjb25maWcgKGRlcHJlY2F0ZWQgYnV0IHdpZGVseSBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXdjb25maWcgMj4vZGV2L251bGwgfCBncmVwIC1FIFwiRVNTSUR8QWNjZXNzIFBvaW50fFNpZ25hbCBsZXZlbFwiJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9FU1NJRDpcIihbXlwiXSspXCIvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzc2lkTWF0Y2gpIHNzaWQgPSBzc2lkTWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9BY2Nlc3MgUG9pbnQ6XFxzKyhbYS1mMC05Ol17MTd9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSBic3NpZCA9IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9TaWduYWwgbGV2ZWw9KC0/XFxkKykvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaXdjb25maWdFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBhbGwgbWV0aG9kcyBmYWlsZWQgd2l0aCByZWFsIGVycm9ycyAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdjb25maWdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogQWxsIG1ldGhvZHMgKG5tY2xpLCBpdywgaXdjb25maWcpIGZhaWxlZC4gTGFzdCBlcnJvcjonLCBpd2NvbmZpZ0Vycm9yLm1lc3NhZ2UgfHwgaXdjb25maWdFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdlcnJvcidcbiAgICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgIG1lc3NhZ2U6ICdub2ludGVyZmFjZSdcbiAgICB9O1xufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBuZXRzaFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzaCB3bGFuIHNob3cgaW50ZXJmYWNlcycsIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIHN0ZGVyciBmb3Igc2VydmljZSBlcnJvcnNcbiAgICAgICAgY29uc3QgZXJyb3JPdXRwdXQgPSAoc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBvdXRwdXQgPSAoc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZE91dHB1dCA9IG91dHB1dCArICcgJyArIGVycm9yT3V0cHV0O1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgV0xBTiBzZXJ2aWNlIGlzIG5vdCBydW5uaW5nICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW5zdmMnKSB8fCBcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuIGF1dG9jb25maWcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2F1dG9tYXRpc2NoIHdsYW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4ta29uZmlndXJhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2lzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzZXJ2aWNlIGlzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkZXIgZGllbnN0JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlIGFyZSBubyBpbnRlcmZhY2VzIGF2YWlsYWJsZVxuICAgICAgICBpZiAoc3Rkb3V0LmluY2x1ZGVzKCdUaGVyZSBpcyBubyB3aXJlbGVzcyBpbnRlcmZhY2UnKSB8fCBcbiAgICAgICAgICAgIHN0ZG91dC5pbmNsdWRlcygnRXMgZ2lidCBrZWluZSBEcmFodGxvcy1TY2huaXR0c3RlbGxlJykgfHxcbiAgICAgICAgICAgIHN0ZG91dC5tYXRjaCgvTm8gd2lyZWxlc3MvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUsIGhhbmRsZXMgdmFyaW91cyBmb3JtYXRzXG4gICAgICAgICAgICAvLyBVc2UgbmVnYXRpdmUgbG9va2JlaGluZCB0byBlbnN1cmUgd2UgZG9uJ3QgbWF0Y2ggXCJCU1NJRFwiICh3aGljaCBjb250YWlucyBcIlNTSURcIilcbiAgICAgICAgICAgIGlmIChsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOlxccyooLispL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgc2V0IGlmIG5vdCBlbXB0eSBhbmQgbm90IFwiTi9BXCIgb3Igc2ltaWxhclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkICYmIGV4dHJhY3RlZC5sZW5ndGggPiAwICYmICFleHRyYWN0ZWQubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkID0gZXh0cmFjdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQlNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUgcGF0dGVybiBtYXRjaGluZ1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvQlNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiAoaGFuZGxlcyBib3RoIC0gYW5kIDogc2VwYXJhdG9ycywgd2l0aCBvciB3aXRob3V0IHNwYWNlcylcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEXFxzKjpcXHMqKFthLWYwLTldezJ9KD86Wy06XFxzXVthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbWF0Y2hbMV0ucmVwbGFjZSgvWy0gXS9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gU2lnbmFsIHBhcnNpbmcgLSBoYW5kbGUgdmFyaW91cyBsb2NhbGl6ZWQgZm9ybWF0cyBhbmQgcGF0dGVybnNcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL1NpZ25hbHxTaWduYWxzdFx1MDBFNHJrZXxJbnRlbnNpdFx1MDBFOXxTZVx1MDBGMWFsL2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHBlcmNlbnRhZ2UgcGF0dGVybiBmaXJzdCAobW9zdCBjb21tb24pXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooXFxkKylcXHMqJS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihwYXJzZWQpICYmIHBhcnNlZCA+PSAwICYmIHBhcnNlZCA8PSAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSBkQm0gcGF0dGVybiAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooLT9cXGQrKVxccypkQm0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGJtID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oZGJtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTm9ybWFsaXplIGVtcHR5IHN0cmluZ3MgdG8gbnVsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogKHNzaWQgJiYgc3NpZC5sZW5ndGggPiAwKSA/IHNzaWQgOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IChic3NpZCAmJiBic3NpZC5sZW5ndGggPiAwKSA/IGJzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyBkdWUgdG8gbG9jYXRpb24gcGVybWlzc2lvbnMgKG1pZ2h0IGJlIGluIHN0ZGVyciBvciBlcnJvciBtZXNzYWdlKVxuICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSAoZXJyb3IubWVzc2FnZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRvdXQgPSAoZXJyb3Iuc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZGVyciA9IChlcnJvci5zdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkRXJyb3JPdXRwdXQgPSBlcnJvck1lc3NhZ2UgKyAnICcgKyBlcnJvclN0ZG91dCArICcgJyArIGVycm9yU3RkZXJyO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTG9nIGVycm9yIHdoZW4gY29tbWFuZCBleGVjdXRpb24gZmFpbHMgKHRpbWVvdXQsIHBlcm1pc3Npb24sIGV0Yy4pXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzOiBFcnJvciBleGVjdXRpbmcgbmV0c2ggY29tbWFuZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGwgKGZhbGxiYWNrIHdoZW4gbmV0c2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIChkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24pXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgYWN0aXZlIFdpLUZpIGNvbm5lY3Rpb24gcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncG93ZXJzaGVsbCAtQ29tbWFuZCBcIiRwcm9maWxlID0gR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIHwgV2hlcmUtT2JqZWN0IHskXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2ktRmkqXFwnIC1vciAkXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2lyZWxlc3MqXFwnfSB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDE7IGlmICgkcHJvZmlsZSkgeyAkcHJvZmlsZS5OYW1lIH1cIicsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHNzaWRTdHIgPSBzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIGlmIChzc2lkU3RyICYmIHNzaWRTdHIubGVuZ3RoID4gMCAmJiAhc3NpZFN0ci5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZFN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEJTU0lEIGNhbm5vdCBiZSBlYXNpbHkgcmV0cmlldmVkIHdpdGhvdXQgbmV0c2ggKHdoaWNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICAgICAgICAvLyBTZXR0aW5nIHRvIG51bGwgYXMgZmFsbGJhY2sgLSBTU0lEIGlzIHRoZSBtb3N0IGltcG9ydGFudCBpbmZvcm1hdGlvbiBhbnl3YXlcbiAgICAgICAgY29uc3QgYnNzaWQgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIFBvd2VyU2hlbGwgZmFsbGJhY2sgKGNhbid0IGVhc2lseSBnZXQgc2lnbmFsIHN0cmVuZ3RoIHdpdGhvdXQgbmV0c2gpXG4gICAgICAgIC8vIFJldHVybiBub3Blcm1pc3Npb25zIG1lc3NhZ2Ugc28gZnJvbnRlbmQgY2FuIHNob3cgdGhlIHdhcm5pbmdcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdub3Blcm1pc3Npb25zJ1xuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyBlcnJvciBpZiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxzXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbDogUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsZWQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gbWFjT1MgdXNpbmcgYWlycG9ydCBvciBuZXR3b3Jrc2V0dXBcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9NYWNPUygpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgYWlycG9ydCBjb21tYW5kIGZpcnN0IChkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWlycG9ydCBpcyBhdmFpbGFibGUgKHVzdWFsbHkgYXQgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQpXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYWlycG9ydFBhdGggfSA9IGF3YWl0IGV4ZWNBc3luYygnd2hpY2ggYWlycG9ydCAyPi9kZXYvbnVsbCB8fCBlY2hvIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0Jywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDEwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgYWlycG9ydCA9IGFpcnBvcnRQYXRoLnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgJHthaXJwb3J0fSAtSWAsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcnNzaURibSA9IG51bGw7XG4gICAgICAgICAgICBsZXQgc2lnbmFsUGVyY2VudCA9IG51bGw7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ1NTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGxpbmUucmVwbGFjZSgnU1NJRDonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdCU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gdG8gZW5zdXJlIHdlIGdldCB0aGUgZnVsbCBCU1NJRFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQlNTSUQ6XFxzKihbYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdhZ3JDdGxSU1NJOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJTU0kgaW4gZEJtIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaVN0ciA9IGxpbmUucmVwbGFjZSgnYWdyQ3RsUlNTSTonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpID0gcnNzaVN0ciA/IChwYXJzZUludChyc3NpU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICByc3NpRGJtID0gcnNzaTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnbGluayBhdXRoOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFsdGVybmF0aXZlOiBzaWduYWwgc3RyZW5ndGggYXMgcGVyY2VudGFnZSAoaWYgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goLyhcXGQrKSUvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoICYmIHNpZ25hbFBlcmNlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxQZXJjZW50ID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBxdWFsaXR5ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChzaWduYWxQZXJjZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IHNpZ25hbFBlcmNlbnQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJzc2lEYm0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gZGJtVG9RdWFsaXR5UGVyY2VudChyc3NpRGJtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHNzaWQgfHwgYnNzaWQgfHwgcXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChhaXJwb3J0RXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIG5ldHdvcmtzZXR1cCAtIG9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChub3QganVzdCBubyBwZXJtaXNzaW9uKVxuICAgICAgICAgICAgaWYgKGFpcnBvcnRFcnJvci5jb2RlICE9PSAnRU5PRU5UJyAmJiBhaXJwb3J0RXJyb3IubWVzc2FnZSAmJiAhYWlycG9ydEVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ3Blcm1pc3Npb24nKSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogYWlycG9ydCBjb21tYW5kIGZhaWxlZDonLCBhaXJwb3J0RXJyb3IubWVzc2FnZSB8fCBhaXJwb3J0RXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjazogbmV0d29ya3NldHVwIGFuZCBpcGNvbmZpZyAoZm9yIG5ld2VyIG1hY09TIHdoZXJlIGFpcnBvcnQgaXMgbm90IGF2YWlsYWJsZSkgIC8vIHN5c3RlbV9wcm9maWxlciBpcyB3YXkgdG8gaGVhdnkgYW5kIG5lZWRzIGEgbG9vb29vdCBvZiB0aW1lIHRvIHByb2Nlc3NcbiAgICAgICAgLy8gdGhpcyBpcyBhIHNpbXBsZSBjYWxjdWxhdGlvbi4uIHdlIGNhbid0IHJlbHkgb24gYSBwcm9jZXNzIHRoYXQgdGFrZXMgMTBzIHRvIGNvbXBsZXRlIGFuZCBibG9ja3MgdGhlIHdob2xlIHN5c3RlbVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIFdMQU4gaW50ZXJmYWNlIHVzaW5nIG5ldHdvcmtzZXR1cFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGludGVyZmFjZU91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXR3b3Jrc2V0dXAgLWxpc3RhbGxoYXJkd2FyZXBvcnRzIHwgYXdrIFxcJy9XaS1GaXxBaXJQb3J0L3tnZXRsaW5lOyBwcmludCAkTkZ9XFwnJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IGludGVyZmFjZU91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghaW50ZXJmYWNlTmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIE5vIFdpLUZpIGludGVyZmFjZSBmb3VuZFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGF3ayAtRicgU1NJRCA6ICcgJy8gU1NJRCA6IC8ge3ByaW50ICQyfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRPdXRwdXQudHJpbSgpIHx8IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkLCBjb250aW51ZSB3aXRoIEJTU0lEXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBCU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYnNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGdyZXAgJ0JTU0lEIDonIHwgYXdrICd7cHJpbnQgJDN9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZFN0ciA9IGJzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBCU1NJRCBmb3JtYXQgKE1BQyBhZGRyZXNzKVxuICAgICAgICAgICAgICAgIGlmIChic3NpZFN0ciAmJiAvXlthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSQvaS50ZXN0KGJzc2lkU3RyKSkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkU3RyLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoYnNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEJTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBmYWxsYmFjayAoYWlycG9ydCBub3QgYXZhaWxhYmxlLCBjYW4ndCBnZXQgc2lnbmFsIHN0cmVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChuZXR3b3Jrc2V0dXBFcnJvcikge1xuICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIG5ldHdvcmtzZXR1cCBmYWlscyB3aXRoIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBuZXR3b3Jrc2V0dXAvaXBjb25maWcgZmFsbGJhY2sgZmFpbGVkOicsIG5ldHdvcmtzZXR1cEVycm9yLm1lc3NhZ2UgfHwgbmV0d29ya3NldHVwRXJyb3IpO1xuICAgICAgICAgICAgLy8gSWYgZmFsbGJhY2sgY29tcGxldGVseSBmYWlscywgcmV0dXJuIGVycm9yIG9iamVjdFxuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2V0V2xhbkluZm8gfTtcblxuXG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAndGFza2xpc3QgL2ZvIGNzdicgKHN0cnVjdHVyZWQgZm9ybWF0LCBmYXN0ZXIgdGhhbiAvdiwgc3RpbGwgc2hvd3MgcHJvY2VzcyBuYW1lcylcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd0YXNrbGlzdCAvZm8gY3N2JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICduZXRzdGF0IC1hbm8nIChzaG93cyBhbGwgY29ubmVjdGlvbiBzdGF0ZXMgaW5jbHVkaW5nIEVTVEFCTElTSEVEIGZvciBzY3JlZW5zaGFyaW5nIGRldGVjdGlvbilcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzdGF0IC1hbm8nLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gUmVnZXggdG8gZmluZCA6UE9SVCBmb2xsb3dlZCBieSBhIHNwYWNlIChlbnN1cmVzIGV4YWN0IHBvcnQgbWF0Y2gsIGUuZy4sIDo1OTM4IClcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9XFxcXHNgLCAnZycpIFxuICAgICAgaWYgKHJlZ2V4LnRlc3Qoc3Rkb3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsJ2NvbS5taWNyb3NvZnQudGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1Jyxcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTYsXG5dXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgKiBhcyB3aW4gZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVXaW4uanMnXG5pbXBvcnQgKiBhcyBtYWMgZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVNYWMuanMnXG5pbXBvcnQgKiBhcyBsaW51eCBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKHBsYXRmb3JtID0gJ3dpbjMyJykge1xuICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHJldHVybiBhd2FpdCB3aW4ucnVuUmVtb3RlQ2hlY2soKVxuICBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKSByZXR1cm4gYXdhaXQgbWFjLnJ1blJlbW90ZUNoZWNrKClcbiAgcmV0dXJuIGF3YWl0IGxpbnV4LnJ1blJlbW90ZUNoZWNrKClcbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIEV4cGFuZGVkIGJyb3dzZXIga2V5d29yZHMgdG8gY2F0Y2ggbW9yZSB2YXJpYW50c1xuY29uc3QgYnJvd3NlcktleXdvcmRzID0gW1xuICAgICdjaHJvbScsICdjaHJvbWUuZXhlJyxcbiAgICAnZWRnZScsICdtc2VkZ2UuZXhlJyxcbiAgICAnZmlyZScsICdmaXJlZm94LmV4ZScsXG4gICAgJ2JyYXZlJywgJ2JyYXZlLmV4ZScsXG4gICAgJ29wZXJhJywgJ29wZXJhLmV4ZScsXG4gICAgJ2Jyb3dzZXInLCAvLyBHZW5lcmljIGJyb3dzZXIgcHJvY2Vzc1xuICAgICdpZXhwbG9yZScsIC8vIEludGVybmV0IEV4cGxvcmVyXG4gICAgJ3NhZmFyaScsIC8vIEZvciBtYWNPU1xuXTtcblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsLmV4ZSAtTm9Mb2dvIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCImIHsgJHByb2MgPSBHZXQtQ2ltSW5zdGFuY2UgLUNsYXNzIFdpbjMyX1Byb2Nlc3MgLUZpbHRlciAnUHJvY2Vzc0lkPSR7cGlkfSc7IGlmICgkcHJvYykgeyAkcHJvYy5QYXJlbnRQcm9jZXNzSWQ7ICRwcm9jLk5hbWUgfSB9XCJgO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lKTtcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQobGluZXNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IGxpbmVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvV2luZG93czogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gVW5peCBzeXN0ZW1zIChMaW51eC9tYWNPUylcbiAqIFRyaWVzIC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0KSwgZmFsbHMgYmFjayB0byBwcyBjb21tYW5kXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvVW5peChwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QgbWV0aG9kIH40bXMsIG5vIHByb2Nlc3Mgc3Bhd24pXG4gICAgICAgIGNvbnN0IFtzdGF0Q29udGVudCwgY29tbUNvbnRlbnRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9zdGF0YCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKSxcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vY29tbWAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbClcbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhdENvbnRlbnQpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIC9wcm9jL3BpZC9zdGF0OiBwaWQgKGNvbW0pIHN0YXRlIHBwaWQgLi4uXG4gICAgICAgICAgICBjb25zdCBzdGF0TWF0Y2ggPSBzdGF0Q29udGVudC5tYXRjaCgvXlxcZCtcXHMrXFwoKFteKV0rKVxcKVxccytcXFMrXFxzKyhcXGQrKS8pO1xuICAgICAgICAgICAgaWYgKHN0YXRNYXRjaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSAoY29tbUNvbnRlbnQgfHwgc3RhdE1hdGNoWzFdKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQoc3RhdE1hdGNoWzJdLCAxMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBwcyBjb21tYW5kICh3b3JrcyBvbiBib3RoIExpbnV4IGFuZCBtYWNPUylcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwcyAtcCAke3BpZH0gLW8gcHBpZD0sY29tbT1gO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHN0ZG91dC50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1VuaXg6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIGJhc2VkIG9uIHBsYXRmb3JtXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvKHBpZCkge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICBcbiAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpO1xuICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcgfHwgcGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKTsgLy8gTGludXgvbWFjT1M6IHRyaWVzIC9wcm9jLCBmYWxscyBiYWNrIHRvIHBzXG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHBhcmVudCBwcm9jZXNzZXMgZm9yIGJyb3dzZXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmluZFBhcmVudFByb2Nlc3MocGlkLCBtYXhEZXB0aCwgdmlzaXRlZFBpZHMpIHtcbiAgICBpZiAocGlkID09PSAxIHx8IHBpZCA9PT0gMCkge1xuICAgICAgICBsb2cuaW5mbygnY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUm9vdCBQSUQgcmVhY2hlZC4gTm8gd2ViIGJyb3dzZXIgZm91bmQuJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKG1heERlcHRoIDw9IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIHdoZW4gbWF4IGRlcHRoIHJlYWNoZWRcbiAgICB9XG4gICAgXG4gICAgaWYgKHZpc2l0ZWRQaWRzLmhhcyhwaWQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlc1xuICAgIH1cbiAgICBcbiAgICB2aXNpdGVkUGlkcy5hZGQocGlkKTtcbiAgICBcbiAgICAvLyBHZXQgcHJvY2VzcyBpbmZvIChnZXRQcm9jZXNzSW5mbyBhbHJlYWR5IGhhcyBpdHMgb3duIHRpbWVvdXQgcHJvdGVjdGlvbilcbiAgICBjb25zdCBwcm9jZXNzSW5mbyA9IGF3YWl0IGdldFByb2Nlc3NJbmZvKHBpZCk7XG4gICAgXG4gICAgaWYgKCFwcm9jZXNzSW5mbykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHsgcHBpZCwgbmFtZSB9ID0gcHJvY2Vzc0luZm87XG4gICAgXG4gICAgLy8gTG9nIHRoZSBwcm9jZXNzIGluZm8gZm9yIGRlYnVnZ2luZ1xuICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBDaGVja2luZyBwcm9jZXNzOiAke25hbWV9IChQSUQ6ICR7cGlkfSwgUFBJRDogJHtwcGlkfSlgKTtcbiAgICBcbiAgICAvLyBNb3JlIHRob3JvdWdoIGJyb3dzZXIgZGV0ZWN0aW9uXG4gICAgaWYgKGJyb3dzZXJLZXl3b3Jkcy5zb21lKGJyb3dzZXIgPT4gbmFtZS5pbmNsdWRlcyhicm93c2VyKSkpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IEJyb3dzZXIgZm91bmQ6ICR7bmFtZX1gKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmIChuYW1lLmluY2x1ZGVzKCdleHBsb3JlcicpIHx8IHBwaWQgPD0gMSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUmVhY2hlZCBzeXN0ZW0gcHJvY2VzcyBvciBleHBsb3JlcmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHBwaWQsIG1heERlcHRoIC0gMSwgdmlzaXRlZFBpZHMpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBwYXJlbnQgcHJvY2VzcyBpcyBhIGJyb3dzZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrUGFyZW50UHJvY2VzcygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmb3VuZEJyb3dzZXIgPSBhd2FpdCBmaW5kUGFyZW50UHJvY2Vzcyhwcm9jZXNzLnBwaWQsIDYsIG5ldyBTZXQoKSk7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogQnJvd3NlciBkZXRlY3Rpb24gcmVzdWx0OiAke2ZvdW5kQnJvd3Nlcn1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZm91bmRCcm93c2VyIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogRXJyb3IgaW4gYnJvd3NlciBkZXRlY3Rpb246ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGZvdW5kQnJvd3NlcjogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgfVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBdUJBLFNBQVMsWUFBQUEsaUJBQWdCO0FBQ3pCLE9BQU8sUUFBUTtBQUNmLFNBQVMsWUFBWTtBQUNyQixTQUFTLFdBQVc7QUFDcEIsT0FBTyxTQUFTOzs7QUN0QmhCLElBQU0sU0FBUztBQUFBLEVBQ1gsYUFBYTtBQUFBO0FBQUEsRUFDYixjQUFjO0FBQUEsRUFDZCxlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixTQUFTO0FBQUEsRUFFVCxlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsaUJBQWlCO0FBQUEsRUFFakIsZUFBZTtBQUFBO0FBQUEsRUFDZixxQkFBcUI7QUFBQTtBQUFBLEVBRXJCLHFCQUFxQjtBQUFBLEVBQ3JCLFFBQVE7QUFBQTtBQUFBLEVB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bG9iYWxTaG9ydGN1dCIsICJUcmF5IiwgIk1lbnUiLCAiZGlhbG9nIiwgImxvZyIsICJsb2ciLCAicGF0aCIsICJmcyIsICJpcCIsICJnYXRld2F5NHN5bmMiLCAiZnMiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgImxvZyIsICJjb25maWdTdG9yZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAibG9nIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAiYXBwc1RvQ2xvc2UiLCAiYXBwIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJsb2ciLCAiYXBwc1RvQ2xvc2UiLCAiY2hpbGRQcm9jZXNzIiwgImFwcCIsICJqb2luIiwgImxvZyIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImxvZyIsICJwYXRoIiwgIl9fZGlybmFtZSIsICJhcHAiLCAiam9pbiIsICJmcyIsICJjb25maWciLCAibG9nIiwgImZzIiwgImpvaW4iLCAic2NyZWVuIiwgImlwY01haW4iLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAid2ViQ29udGVudHMiLCAicGF0aCIsICJmcyIsICJjbGlwYm9hcmQiLCAiYXBwIiwgIm9zIiwgImxvZyIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAiZnMiLCAicGF0aCIsICJwcm9jZXNzIiwgInNwYXduIiwgImFwcCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInNwYXduIiwgImxvZyIsICJwcm9jZXNzIiwgImZzIiwgInBhdGgiLCAib3MiLCAiX19kaXJuYW1lIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInB1YmxpY0Jhc2UiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJfX2Rpcm5hbWUiLCAiY29uZmlnIiwgImxvZyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAid2ViQ29udGVudHMiLCAib3MiLCAiYXBwIiwgImxvZyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgInJ1blJlbW90ZUNoZWNrIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgInJ1blJlbW90ZUNoZWNrIiwgImFnZW50IiwgImZzIiwgImpvaW4iLCAiaXBjTWFpbiIsICJ3ZWJDb250ZW50cyIsICJzY3JlZW4iLCAiZXJyIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImxvZyIsICJleGVjQXN5bmMiLCAibmFtZSIsICJwcGlkIiwgImFwcCIsICJsb2ciLCAiTWVudSIsICJfX2Rpcm5hbWUiLCAiZnMiLCAicGF0aCIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAid2ViQ29udGVudHMiLCAiQnJvd3NlcldpbmRvdyIsICJldmVudCIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImRpYWxvZyIsICJnbG9iYWxTaG9ydGN1dCJdCn0K
