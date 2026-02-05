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
  bipApiUrl: "https://www.bildung.gv.at/webservice/rest/next-exam/student",
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
      if (process.platform !== "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = platformDispatcher_default.getPackagedPublicBase();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuZG90ZW52LmNvbmZpZygpO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gV2hlbiBwYWNrYWdlZDogUXVhc2FyIHB1dHMgcHVibGljIGNvbnRlbnRzIGF0IGFwcCByb290OyBvbGQgYnVpbGQgaGFkIHB1YmxpYy8gc3ViZGlyLiBSZXNvbHZlIGF0IHJ1bnRpbWUuXG5mdW5jdGlvbiBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSB7XG4gIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcpO1xuICBjb25zdCB3aXRoUHVibGljID0gam9pbih1bnBhY2tlZCwgJ3B1YmxpYycpO1xuICByZXR1cm4gZnMuZXhpc3RzU3luYyh3aXRoUHVibGljKSA/IHdpdGhQdWJsaWMgOiB1bnBhY2tlZDtcbn1cblxuXG5cbmNsYXNzIFBsYXRmb3JtRGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcblxuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMuYXJjaCA9IHRoaXMuX25vcm1hbGl6ZUFyY2goKTtcbiAgICB0aGlzLmRpc3BsYXlTZXJ2ZXIgPSB0aGlzLl9nZXREaXNwbGF5U2VydmVyKCk7XG4gICAgdGhpcy5pc0tERSA9IHRoaXMuX2lzS0RFKCk7XG4gICAgdGhpcy5pc0dOT01FID0gdGhpcy5faXNHTk9NRSgpO1xuICAgIHRoaXMuZmxhbWVzaG90ID0gdGhpcy5fZ2V0VmVyc2lvbignZmxhbWVzaG90Jyk7XG4gICAgdGhpcy5pbWFnZW1hZ2ljayA9IHRoaXMuX2dldFZlcnNpb24oJ2NvbnZlcnQnKTtcbiAgICB0aGlzLmltVmVyc2lvbiA9IHRoaXMuX2dldEltYWdlTWFnaWNrVmVyc2lvbigpO1xuICAgIHRoaXMud29ya2VyRmlsZU5hbWUgPSB0aGlzLl9nZXRXb3JrZXJGaWxlTmFtZSgpO1xuICAgIHRoaXMudXNlV29ya2VyID0gdGhpcy5fZ2V0VXNlV29ya2VyKCk7XG4gICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IHRoaXMuX2dldFNjcmVlbnNob3RBYmlsaXR5KCk7XG4gICAgdGhpcy5qcmUgPSB0aGlzLl9kZXRlY3RKUkVJZCgpO1xuICAgIHRoaXMuanJlRGlyID0gdGhpcy5fcmVzb2x2ZUpSRURpcigpO1xuICAgIHRoaXMuamF2YUJpbiA9IHRoaXMuX3Jlc29sdmVKYXZhQmluKCk7XG4gICAgdGhpcy5qcmVJbmZvID0gdGhpcy5fZ2V0SlJFKCk7XG4gICAgXG4gICAgdGhpcy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpO1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICAgIHRoaXMud29ya2VyVVJMID0gdGhpcy5fZ2V0V29ya2VyVVJMKCk7XG4gICAgdGhpcy50ZW1wZGlyZWN0b3J5ID0gdGhpcy5fZ2V0VGVtcGRpcmVjdG9yeSgpO1xuICAgIHRoaXMud29ya2RpcmVjdG9yeSA9IHRoaXMuX2dldFdvcmtkaXJlY3RvcnkoKTtcbiAgICB0aGlzLmxvZ2ZpbGUgPSB0aGlzLl9nZXRMb2dmaWxlKCk7XG5cbiAgfVxuXG4gIF9nZXRXb3JrZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKHRoaXMuaG9tZWRpcmVjdG9yeSwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7XG4gIH1cblxuICBfZ2V0VGVtcGRpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbihvcy50bXBkaXIoKSwgJ2V4YW0tdG1wJyk7XG4gIH1cblxuXG4gIF9nZXRMb2dmaWxlKCkge1xuICAgIHJldHVybiBqb2luKHRoaXMud29ya2RpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpO1xuICB9XG5cbiAgX25vcm1hbGl6ZUFyY2goKSB7XG4gICAgaWYgKHRoaXMuX2FyY2ggPT09ICdpYTMyJykgcmV0dXJuICdpNTg2JztcbiAgICBpZiAoWyd4NjQnLCAnYXJtNjQnXS5pbmNsdWRlcyh0aGlzLl9hcmNoKSkgcmV0dXJuIHRoaXMuX2FyY2g7XG4gICAgdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlOiAke3RoaXMuX2FyY2h9YCk7XG4gIH1cblxuICBfZGV0ZWN0SlJFSWQoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHJldHVybiAnbWluaW1hbC1qcmUtMTEtbGluJztcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgcmV0dXJuIHRoaXMuX2FyY2ggPT09ICdhcm02NCcgPyAnbWluaW1hbC1qcmUtMTEtbWFjLWFybTY0JyA6ICdtaW5pbWFsLWpyZS0xMS1tYWMnO1xuICAgIH1cbiAgfVxuXG5cblxuXG5cbiAgLyoqXG4gICAqIFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBAZGVzY3JpcHRpb24gdGhpcyBmdW5jdGlvbiByZXNvbHZlcyB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBpdCBmaXJzdCBjaGVja3MgaWYgdGhlIHVzZUJ1bmRsZWRKUkUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0IHRvIHRydWVcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IGNoZWNrcyBpZiB0aGUgc3lzdGVtIGpyZSBpcyBpbnN0YWxsZWRcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIHN5c3RlbSBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIHRoZSBidW5kbGVkIGpyZSBpcyBsb2NhdGVkIGluIHRoZSBwdWJsaWMgZGlyZWN0b3J5IG9mIHRoZSBhcHBcbiAgICogXG4gICAqIEZJWE1FOiBpZiBzeXN0ZW0ganJlIGlzIHNlbGVjdGVkIGJ5IEVOViBkbyBub3QgaW5jbHVkZSB0aGUganJlIGRpcmVjdG9yeSBpbiB0aGUgZmluYWwgYnVpbGRcbiAgICovXG5cbiAgX3Jlc29sdmVKUkVEaXIoKSB7XG4gICAgLy8gdXNlIGJ1bmRsZWQganJlIGJlY2F1c2UgaXRzIHNtYWxsZXIgYW5kIHByb3ZpZGVzIG9ubHkgdGhlIG5lZWRlZCBqYXZhIG1vZHVsZXNcbiAgICBpZiAoY29uZmlnLnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICBjb25zdCBiYXNlID0gZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKGJhc2UsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKGJhc2UsIHRoaXMuanJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiAhYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSkpO1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfSBcbiAgICBlbHNlIHsgIC8vIHVzZSBzeXN0ZW0ganJlXG4gICAgICAvLyBUcnkgdG8gZmluZCBKYXZhIGluc3RhbGxhdGlvbiB1c2luZyB3aGljaC93aGVyZSBjb21tYW5kXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBqYXZhQ29tbWFuZCA9IHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnd2hlcmUgamF2YScgOiAnd2hpY2ggamF2YSc7XG4gICAgICAgIGNvbnN0IGphdmFQYXRoID0gZXhlY1N5bmMoamF2YUNvbW1hbmQsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoamF2YVBhdGgpIHtcbiAgICAgICAgICAvLyBHZXQgdGhlIGRpcmVjdG9yeSBjb250YWluaW5nIHRoZSBqYXZhIGV4ZWN1dGFibGVcbiAgICAgICAgICBjb25zdCBqYXZhRGlyID0gcGF0aC5kaXJuYW1lKGphdmFQYXRoKTtcbiAgICAgICAgICAvLyBHbyB1cCB0byB0aGUgSlJFL0pESyByb290ICh1c3VhbGx5IDIgbGV2ZWxzIHVwIGZyb20gYmluLylcbiAgICAgICAgICBjb25zdCBqcmVSb290ID0gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZShqYXZhRGlyKSk7XG4gICAgICAgICAgcmV0dXJuIGpyZVJvb3Q7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBKYXZhIG5vdCBmb3VuZCBpbiBQQVRIXG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIG5vIEphdmEgZm91bmQsIGZhbGwgYmFjayB0byBidW5kbGVkIEpSRVxuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogTm8gc3lzdGVtIEphdmEgZm91bmQsIGZhbGxpbmcgYmFjayB0byBidW5kbGVkIEpSRVwiKTtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICByZXR1cm4gam9pbihnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgdGhpcy5qcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9yZXNvbHZlSmF2YUJpbigpIHtcbiAgICBzd2l0Y2ggKHRoaXMucGxhdGZvcm0pIHtcbiAgICAgIGNhc2UgJ2Rhcndpbic6IHJldHVybiBbJ2JpbicsICdqYXZhJ107XG4gICAgICBjYXNlICd3aW4zMic6IHJldHVybiBbJ2JpbicsICdqYXZhdy5leGUnXTtcbiAgICAgIGNhc2UgJ2xpbnV4JzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGRlZmF1bHQ6IHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3RoaXMucGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gIT09ICdsaW51eCcpIHJldHVybiAnbi9hJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJykgcmV0dXJuICd3YXlsYW5kJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd4MTEnIHx8IHRoaXMuX2Vudi5ESVNQTEFZKSByZXR1cm4gJ3gxMSc7XG4gICAgcmV0dXJuICd1bmtub3duJztcbiAgfVxuXG4gIF9nZXRWZXJzaW9uKGNtZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYyhgJHtjbWR9IC0tdmVyc2lvbmAsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS5zcGxpdCgnXFxuJylbMF07XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC9bXFxkXSsoXFwuW1xcZF0rKSsvKTtcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uOiB2ZXJzaW9uPy5bMF0gfHwgJ3Vua25vd24nIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0SlJFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYygnamF2YSAtdmVyc2lvbicsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAnaWdub3JlJywgJ3BpcGUnXSB9KTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL3ZlcnNpb24gXCIoW1xcZC5fXSspXCIvKT8uWzFdIHx8ICd1bmtub3duJztcbiAgICAgIGNvbnN0IGphdmFIb21lID0gdGhpcy5fZW52LkpBVkFfSE9NRSB8fCAnJztcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uLCBwYXRoOiBqYXZhSG9tZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsLCBwYXRoOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldFdvcmtlckZpbGVOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLnBsYXRmb3JtID09PSAnbGludXgnID8gJ2ltYWdlV29ya2VyTGludXgubWpzJyA6ICdpbWFnZVdvcmtlclNoYXJwLm1qcyc7XG4gIH1cblxuICBfZ2V0V29ya2VyVVJMKCkge1xuICAgIGNvbnN0IGJhc2VEaXIgPSBhcHAuaXNQYWNrYWdlZCA/IGdldFBhY2thZ2VkUHVibGljQmFzZSgpIDogam9pbihpbXBvcnQubWV0YS5kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4oYmFzZURpciwgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwod29ya2VyUGF0aCk7XG4gIH1cblxuICBpc1dheWxhbmQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7XG4gIH1cblxuICBfaXNLREUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgcmV0dXJuIG91dCA9PT0gJ0tERSc7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNLREU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzR05PTUUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCdnbm9tZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzR05PTUU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzVU5JVFkoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCd1bml0eScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNVTklUWTogbm8gZGF0YVwiLCBlcnIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mbGFtZXNob3RBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwid2hpY2ggZmxhbWVzaG90XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZmxhbWVzaG90QXZhaWxhYmxlOiBGbGFtZXNob3Qgbm90IGZvdW5kXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9zZXR1cERlc2t0b3BQYXRoKCkge1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICB9XG5cbiAgX2dldERlc2t0b3BQYXRoKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTY3JlZW5zaG90QWJpbGl0eSgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgaWYgKCh0aGlzLl9pc0dOT01FKCkgfHwgdGhpcy5faXNVTklUWSgpKSAmJiB0aGlzLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogR05PTUUvVW5pdHkgKyBXYXlsYW5kIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2VcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNLREUoKSAmJiB0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMuX2ZsYW1lc2hvdEF2YWlsYWJsZSgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogS0RFL1dheWxhbmQgKyBGbGFtZXNob3QgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy51c2VXb3JrZXIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBYMTEgKyBJbWFnZU1hZ2ljayBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2UgXHUyMDEzIGZhbGxiYWNrIHRvIHBhZ2VjYXB0dXJlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXNvbHZlZCBiYXNlIHBhdGggZm9yIHB1YmxpYyBhc3NldHMgd2hlbiBwYWNrYWdlZCAoUXVhc2FyOiBhcHAgcm9vdDsgb2xkIGJ1aWxkOiBhcHAuYXNhci51bnBhY2tlZC9wdWJsaWMpLiBJbiBkZXYgcmV0dXJucyBwcm9qZWN0IHB1YmxpYyBkaXIuICovXG4gIGdldFBhY2thZ2VkUHVibGljQmFzZSgpIHtcbiAgICByZXR1cm4gYXBwLmlzUGFja2FnZWQgPyBnZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSA6IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJyk7XG4gIH1cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgdXNlQnVuZGxlZEpSRTogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBBcGlVcmw6ICdodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L3dlYnNlcnZpY2UvcmVzdC9uZXh0LWV4YW0vc3R1ZGVudCcsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMjA1JyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBFTEVDVFJPTiBtYWluIGZpbGUgdGhhdCBhY3R1YWxseSBvcGVucyB0aGUgZWxlY3Ryb24gd2luZG93XG4gKi9cbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgVHJheSwgTWVudSwgZGlhbG9nLCBzZXNzaW9ufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBmc0V4dHJhIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL21haW4vc2NyaXB0cy90cmF5bWVudS5qcydcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGNoZWNrUGFyZW50UHJvY2VzcyB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzJztcblxuaW1wb3J0IHsgdG9nZ2xlTWFjT1NMb2NrZG93biB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJ1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgYXN5bmMgKCkgPT4geyAgLy8gbGFzdCB3aW5kb3cgY2xvc2VkIFx1MjAxMyBjbGVhciBzdG9yYWdlIGhlcmUgdG8gYXZvaWQgTGludXggc2VnZmF1bHQgaW4gYmVmb3JlLXF1aXRcbiAgICBjbGVhckludGVydmFsKCBDb21tSGFuZGxlci51cGRhdGVTdHVkZW50SW50ZXJ2YWxsIClcbiAgICBpZiAoV2luZG93SGFuZGxlci5jaGVja1dpbmRvd0ludGVydmFsPy5zdG9wKSBXaW5kb3dIYW5kbGVyLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RvcCgpXG4gICAgaWYgKENvbW1IYW5kbGVyLnVwZGF0ZVNjaGVkdWxlcj8uc3RvcCkgQ29tbUhhbmRsZXIudXBkYXRlU2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyPy5zdG9wKSBDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyPy5zdG9wKSBtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0b3AoKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcblxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7fSk7IC8vIGNsZWFyIGNvb2tpZXMsIGNhY2hlLCBsb2NhbFN0b3JhZ2UgZXRjLiB3aGlsZSBzZXNzaW9uIHN0aWxsIHZhbGlkXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdpbmRvdy1hbGwtY2xvc2VkOiBFcnJvciBjbGVhcmluZyBzdG9yYWdlOicsIGVycik7XG4gICAgfVxuICAgIGFwcC5xdWl0KCk7XG59KTtcblxuYXBwLm9uKCd3aWxsLXF1aXQnLCAoKSA9PiB7ICAvLyBpZiB3aW5kb3cgaXMgY2xvc2VkXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bihmYWxzZSlcbn0pXG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIEJyb3dzZXJWaWV3LCBkaWFsb2csIHNjcmVlbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgeyBhY3RpdmVXaW5kb3cgfSBmcm9tICdnZXQtd2luZG93cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gUmVuZGVyZXIgYnVpbHQgaW50byBwdWJsaWMvIChvbmUgY29weSk7IHdoZW4gcGFja2FnZWQgdXNlIGFwcC5hc2FyLnVucGFja2VkL3B1YmxpY1xuZnVuY3Rpb24gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSB7XG4gIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCAnaW5kZXguaHRtbCcpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHVucGFja2VkKSkgcmV0dXJuIHVucGFja2VkO1xuICB9XG4gIGNvbnN0IHB1YmxpY1BhdGggPSBqb2luKF9fZGlybmFtZSwgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHB1YmxpY1BhdGgpKSByZXR1cm4gcHVibGljUGF0aDtcbiAgY29uc3QgZGlzdFJlbmRlcmVyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnZGlzdCcsICdyZW5kZXJlcicsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKGRpc3RSZW5kZXJlclBhdGgpKSByZXR1cm4gZGlzdFJlbmRlcmVyUGF0aDtcbiAgY29uc3QgcXVhc2FyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpO1xuICBpZiAoZnMuZXhpc3RzU3luYyhxdWFzYXJQYXRoKSkgcmV0dXJuIHF1YXNhclBhdGg7XG4gIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbn1cblxuXG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBXaW5kb3cgaGFuZGxpbmcgKGlwY1JlbmRlcmVyIFByb2Nlc3MgLSBGcm9udGVuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2NrV2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXJ2ZWQgZGlzcGxheSBJRCBmb3IgZXhhbSB3aW5kb3cgKHNldCBpbW1lZGlhdGVseSB3aGVuIHdpbmRvdyBpcyBjcmVhdGVkKVxuICAgICAgdGhpcy5zcGxhc2h3aW4gPSBudWxsXG4gICAgICB0aGlzLmJpcHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgXG4gICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHF1ZXN0aW9uIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgbWluaW1pemUgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLndpbmRvd1RyYWNrZXIuYmluZCh0aGlzKSwgMTAwMClcbiAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGVsZWN0cm9uIHdpbmRvdyBpbiBmb2N1cyBvciBhbiBvdGhlciBlbGVjdHJvbiB3aW5kb3cgZGVwZW5kaW5nIG9uIHRoZSBoaWVyYWNoeVxuICAgIGdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkge1xuICAgICAgICBjb25zdCBmb2N1c2VkV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICAgIGlmIChmb2N1c2VkV2luZG93KSB7XG4gICAgICAgICAgcmV0dXJuIGZvY3VzZWRXaW5kb3dcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbmxvY2tXaW5kb3cpe3JldHVybiB0aGlzLnNjcmVlbmxvY2tXaW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmV4YW13aW5kb3cpe3JldHVybiB0aGlzLmV4YW13aW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1haW53aW5kb3cpe3JldHVybiB0aGlzLm1haW53aW5kb3d9XG4gICAgICAgICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIGNlbnRlcjp0cnVlLFxuICAgICAgICAgICAgd2lkdGg6IDEwMDAsXG4gICAgICAgICAgICBoZWlnaHQ6ODAwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAvLyByZXNpemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgLy8gZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgIC8vIHRyYW5zcGFyZW50OiB0cnVlXG4gICAgICAgIH0pXG4gICAgIFxuICAgICAgICBpZiAoYmlwdGVzdCl7ICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly9xLmJpbGR1bmcuZ3YuYXQvYWRtaW4vdG9vbC9tb2JpbGUvbGF1bmNoLnBocD9zZXJ2aWNlPW1vb2RsZV9tb2JpbGVfYXBwJnBhc3Nwb3J0PW5leHQtZXhhbWApICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgdGhpcy5iaXB3aW5kb3cubG9hZFVSTChgaHR0cHM6Ly93d3cuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJpcHdpbmRvdyAmJiAhdGhpcy5iaXB3aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5zaG93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7ICAgIC8vIGEgcGRmIGNvdWxkIGNvbnRhaW4gYSBsaW5rIF5eXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogZGlkLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiB3aWxsLW5hdmlnYXRlXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgIH0pXG5cbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IG5ldy13aW5kb3dcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcbiAgICAgXG4gICAgICAgICBcbiAgICAgICAgIHRoaXMuYmlwd2luZG93LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiB0YXJnZXQ6IF9ibGFua1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICB9KTsgXG5cbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtcmVkaXJlY3QnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogUmVkaXJlY3RpbmcgdG86JywgdXJsKTtcbiAgICAgICAgICAgIC8vIFByXHUwMEZDZmVuLCBvYiBkaWUgVVJMIGRhcyBnZXdcdTAwRkNuc2NodGUgRm9ybWF0IGhhdFxuICAgICAgICAgICAgaWYgKHVybC5zdGFydHNXaXRoKCdiaWxkdW5nc3BvcnRhbDovLycpKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gVmVyaGluZGVydCBkZW4gU3RhbmRhcmQtUmVkaXJlY3RcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSAnYmlsZHVuZ3Nwb3J0YWw6Ly90b2tlbj0nO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9rZW4gPSB1cmwuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IENhcHR1cmVkIFRva2VuOicpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKCd3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46ICcgKyB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2JpcFRva2VuJywgdG9rZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHRoaXMgaXMgYW4gZWFzdGVyIGVnZ1xuICAgICAqL1xuICAgIGNyZWF0ZUVhc3RlcldpbigpIHtcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ05leHQtRXhhbScsXG4gICAgICAgICAgICBpY29uOiBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICBjZW50ZXI6dHJ1ZSxcbiAgICAgICAgICAgIHdpZHRoOiA3NjgsXG4gICAgICAgICAgICBoZWlnaHQ6NDgwLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IHRydWUsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50OiBmYWxzZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgdGhpcy5lYXN0ZXJ3aW4ubG9hZEZpbGUoam9pbihwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCksICdjb3dzb25pY2UnLCAnaW5kZXguaHRtbCcpKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICBsZXQgdXJsID0gXCJub3Rmb3VuZFwiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgYmxvY2t3aW4ubG9hZEZpbGUoZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYmxvY2t3aW4ucmVtb3ZlTWVudSgpIFxuICAgICAgICBibG9ja3dpbi5zZXRNaW5pbWl6YWJsZShmYWxzZSlcblxuICAgICAgICAvLyBQb3NpdGlvbiB3aW5kb3cgb24gc3BlY2lmaWMgZGlzcGxheSBCRUZPUkUgc2hvd2luZyBpdFxuICAgICAgICBibG9ja3dpbi5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnksXG4gICAgICAgICAgICB3aWR0aDogZGlzcGxheS5ib3VuZHMud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRpc3BsYXkuYm91bmRzLmhlaWdodFxuICAgICAgICB9KTtcblxuICAgICAgICBibG9ja3dpbi5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgYmxvY2t3aW4uc2hvdygpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRGdWxsU2NyZWVuKHRydWUpO1xuICAgICAgICAgICAgYmxvY2t3aW4ub24oJ2xlYXZlLWZ1bGwtc2NyZWVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7IC8vIHNvZm9ydCB3aWVkZXIgenVyXHUwMEZDY2tzZXR6ZW5cbiAgICAgICAgICAgIH0pOyBcbiAgICAgICAgfSAgXG4gICAgICAgIGVsc2UgeyAgIFxuICAgICAgICAgICAgYmxvY2t3aW4uc2V0S2lvc2sodHJ1ZSk7IC8vIEtpb3NrID0gXCJ0YWtlIG92ZXIgbWFpbiBzY3JlZW5cIi4gb24gbWFjb3MgdGhhdCdzIHdoeSB3ZSB1c2UgZnVsbFNjcmVlbiB3b3JrYXJvdW5kIHdpdGggZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgfVxuICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgIGJsb2Nrd2luLmRpc3BsYXkgPSBkaXNwbGF5XG4gICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLnB1c2goYmxvY2t3aW4pXG4gICAgfVxuXG5cbiAgICAvLyBibG9jayBhbGwgc2NyZWVucyB3aXRoIGEgYmxvY2t3aW5kb3dcbiAgICBhc3luYyBpbml0QmxvY2tXaW5kb3dzKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIC8vbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBmb3VuZCAke2Rpc3BsYXlzLmxlbmd0aH0gZGlzcGxheXNgKVxuICAgICAgICBcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyAgLy8gbG9jayBhbGwgc2NyZWVuc1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZXhhbSB3aW5kb3cgdG8gYmUgdmlzaWJsZSBhbmQgcG9zaXRpb25lZCAoaW1wb3J0YW50IGZvciBXYXlsYW5kL0tXaW4pXG4gICAgICAgICAgICBpZiAodGhpcy5leGFtd2luZG93ICYmICF0aGlzLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGxldCByZXRyaWVzID0gMFxuICAgICAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMFxuICAgICAgICAgICAgICAgIHdoaWxlICghdGhpcy5leGFtd2luZG93LmlzVmlzaWJsZSgpICYmIHJldHJpZXMgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKVxuICAgICAgICAgICAgICAgICAgICByZXRyaWVzKytcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQWRkaXRpb25hbCB3YWl0IHRvIGVuc3VyZSBwb3NpdGlvbmluZyBpcyBjb21wbGV0ZSBvbiBXYXlsYW5kXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBibG9jayB3aW5kb3dzIGZyb20gYXJyYXlcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gdGhpcy5ibG9ja3dpbmRvd3MuZmlsdGVyKGJsb2Nrd2luID0+IGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgYWxsIGV4aXN0aW5nIHdpbmRvd3MgYW5kIGRldGVybWluZSB0aGVpciBkaXNwbGF5c1xuICAgICAgICAgICAgY29uc3QgdXNlZERpc3BsYXlJZHMgPSBuZXcgU2V0KClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmlyc3QsIHVzZSB0aGUgcmVzZXJ2ZWQgZXhhbSBkaXNwbGF5IElEIChzZXQgaW1tZWRpYXRlbHkgd2hlbiBleGFtIHdpbmRvdyB3YXMgY3JlYXRlZClcbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgc2NyZWVuIGlzIHJlc2VydmVkIGV2ZW4gaWYgdGhlIHdpbmRvdyBpc24ndCBmdWxseSBpbml0aWFsaXplZCB5ZXRcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1EaXNwbGF5SWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQodGhpcy5leGFtRGlzcGxheUlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBbHdheXMgZXhjbHVkZSBwcmltYXJ5IGRpc3BsYXkgKGV4YW0gd2luZG93IGxvY2F0aW9uKVxuICAgICAgICAgICAgY29uc3QgcHJpbWFyeURpc3BsYXkgPSBzY3JlZW4uZ2V0UHJpbWFyeURpc3BsYXkoKVxuICAgICAgICAgICAgaWYgKHByaW1hcnlEaXNwbGF5ICYmIHByaW1hcnlEaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKHByaW1hcnlEaXNwbGF5LmlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBleGFtIHdpbmRvdyBkaXNwbGF5IChhcyBmYWxsYmFjay92ZXJpZmljYXRpb24sIGJ1dCByZXNlcnZlZCBJRCB0YWtlcyBwcmlvcml0eSlcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXhhbSB3aW5kb3cgaXMgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBleGFtIHdpbmRvdyBkaXNwbGF5OiAke2Vycn1gKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgYmxvY2sgd2luZG93cyBkaXNwbGF5c1xuICAgICAgICAgICAgZm9yIChjb25zdCBibG9ja3dpbiBvZiB0aGlzLmJsb2Nrd2luZG93cykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IGJsb2Nrd2luLmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgdXNlZERpc3BsYXlJZHMuYWRkKGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogYmxvY2sgd2luZG93IGZvdW5kIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgYmxvY2sgd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgYmxvY2sgd2luZG93cyBmb3IgZGlzcGxheXMgdGhhdCBkb24ndCBoYXZlIGV4YW0gb3IgYmxvY2sgd2luZG93c1xuICAgICAgICAgICAgZm9yIChsZXQgZGlzcGxheSBvZiBkaXNwbGF5cyl7XG4gICAgICAgICAgICAgICAgaWYgKHVzZWREaXNwbGF5SWRzLmhhcyhkaXNwbGF5LmlkKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IHNraXBwaW5nIGRpc3BsYXkgJHtkaXNwbGF5LmlkfSAtIGFscmVhZHkgaGFzIGV4YW0gb3IgYmxvY2sgd2luZG93YClcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogY3JlYXRlIGJsb2Nrd2luIG9uOlwiLGRpc3BsYXkuaWQpXG4gICAgICAgICAgICAgICAgdGhpcy5uZXdCbG9ja1dpbihkaXNwbGF5KSAgLy8gYWRkIGJsb2Nrd2luZG93cyBmb3IgZGlzcGxheXMgd2l0aG91dCBleGFtIHdpbmRvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApXG4gICAgICAgICAgICB0aGlzLmJsb2Nrd2luZG93cy5mb3JFYWNoKCAoYmxvY2t3aW4pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW4ubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTY3JlZW5sb2NrIFdpbmRvdyAodG8gY292ZXIgdGhlIG1haW5zY3JlZW4pIC0gYmxvY2sgc3R1ZGVudHMgZnJvbSB3b3JraW5nXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSB7XG4gICAgICAgIGxldCBzY3JlZW5sb2NrV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgLy8gcGFyZW50OiB0aGlzLm1haW53aW5kb3csICAgLy8gbGVhZHMgdG8gdmlzaWJsZSB0aXRsZWJhciBpbiBnbm9tZS1kZXNrdG9wXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdTY3JlZW5sb2NrJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICAvL2ZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCB1cmwgPSBcImxvY2tcIlxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZEZpbGUoZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSwge2hhc2g6IGAjLyR7dXJsfS9gfSlcbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS9gXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgLy8gQWRkIHdpbmRvdyB0byBhcnJheSBmaXJzdCwgYmVmb3JlIGFkZGluZyBibHVyIGxpc3RlbmVyXG4gICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MucHVzaChzY3JlZW5sb2NrV2luZG93KVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICBzY3JlZW5sb2NrV2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICghc2NyZWVubG9ja1dpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnJlbW92ZU1lbnUoKSBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0TWluaW1pemFibGUoZmFsc2UpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwicG9wLXVwLW1lbnVcIiwgMSkgICAvL2Fib3ZlIGV4YW0gd2luZG93IChwb3AtdXAtbWVudSwgMClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2hvdygpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0Q2xvc2FibGUodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlKTsgLy8gcHV0IHRoZSB3aW5kb3cgb24gYWxsIHZpcnR1YWwgd29ya3NwYWNlc1xuICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoXCJzY3JlZW5sb2NrXCIpXG4gICAgICAgIH0pXG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyB3aW5kb3cgc2hvdWxkIG5vdCBiZSBjbG9zZWQgbWFudWFsbHkuLiBldmVyISBidXQgaWYgeW91IGRvIG1ha2Ugc3VyZSB0byBjbGVhbiBleGFtd2luZG93IHZhcmlhYmxlIGFuZCBlbmQgZXhhbSBmb3IgdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0gIFxuICAgICAgICB9KTtcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZWQnLCAoKSA9PiB7ICAgLy8gcmVtb3ZlIHdpbmRvdyBmcm9tIGFycmF5IHdoZW4gYWN0dWFsbHkgY2xvc2VkXG4gICAgICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzID0gdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiB3aW4gIT09IHNjcmVlbmxvY2tXaW5kb3cgJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogRXhhbXdpbmRvd1xuICAgICAqIEBwYXJhbSBleGFtdHlwZSBlZHV2aWR1YWwsIG1hdGgsIGxhbmd1YWdlXG4gICAgICogQHBhcmFtIHRva2VuIHN0dWRlbnQgdG9rZW5cbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIHRoZSBzZXJ2ZXJzdGF0dXMgb2JqZWN0IGNvbnRhaW5pbmcgaW5mbyBhYm91dCBzcGVsbGNoZWNrIGxhbmd1YWdlIGV0Yy4gXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlRXhhbVdpbmRvdyhleGFtdHlwZSwgdG9rZW4sIHNlcnZlcnN0YXR1cywgcHJpbWFyeWRpc3BsYXkpIHtcbiAgICAgICAgLy8ganVzdCB0byBiZSBzdXJlIHdlIGNoZWNrIHNvbWUgaW1wb3J0YW50IHZhcnMgaGVyZVxuICAgICAgICBpZiAoZXhhbXR5cGUgIT09IFwicmRwXCIgJiYgZXhhbXR5cGUgIT09IFwid2Vic2l0ZVwiICYmICBleGFtdHlwZSAhPT0gXCJnZm9ybXNcIiAmJiBleGFtdHlwZSAhPT0gXCJlZHV2aWR1YWxcIiAmJiBleGFtdHlwZSAhPT0gXCJlZGl0b3JcIiAmJiBleGFtdHlwZSAhPT0gXCJtYXRoXCIgJiYgZXhhbXR5cGUgIT09IFwibWljcm9zb2Z0MzY1XCIgJiYgZXhhbXR5cGUgIT09IFwiYWN0aXZlc2hlZXRzXCIgfHwgIXRva2VuKXsgIC8vIGZvciBub3cuLiB3ZSBwcm9iYWJseSBzaG91bGQgc3RvcCBldmVyeXRoaW5nIGhlcmVcbiAgICAgICAgICAgIGxvZy53YXJuKFwibWlzc2luZyBwYXJhbWV0ZXJzIGZvciBleGFtLW1vZGUgb3IgbW9kZSBub3QgaW4gYWxsb3dlZCBsaXN0IVwiKVxuICAgICAgICAgICAgZXhhbXR5cGUgPSBcImVkaXRvclwiIFxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgLy8gQWx3YXlzIHVzZSBwcmltYXJ5IGRpc3BsYXkgZm9yIGV4YW0gd2luZG93XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcyB8fCAhcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IGRpc3BsYXlzWzBdIHx8IHByaW1hcnlkaXNwbGF5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEltbWVkaWF0ZWx5IHJlc2VydmUgdGhlIGRpc3BsYXkgSUQgZm9yIHRoZSBleGFtIHdpbmRvdyAoYmVmb3JlIHdpbmRvdyBpcyBmdWxseSBpbml0aWFsaXplZClcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBibG9jayB3aW5kb3dzIGZyb20gYmVpbmcgY3JlYXRlZCBvbiB0aGUgc2FtZSBzY3JlZW5cbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBwcmltYXJ5ZGlzcGxheS5pZFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiByZXNlcnZpbmcgZGlzcGxheSAke3RoaXMuZXhhbURpc3BsYXlJZH0gZm9yIGV4YW0gd2luZG93YClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHB4ID0gMFxuICAgICAgICBsZXQgcHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzLngpIHtcbiAgICAgICAgICAgIHB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnhcbiAgICAgICAgICAgIHB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IHB4ICsgMCxcbiAgICAgICAgICAgIHk6IHB5ICsgMCxcbiAgICAgICAgICAgIHRpdGxlOiAnRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogMTQ0MCxcbiAgICAgICAgICAgIGhlaWdodDogNzY4LFxuICAgICAgICAgICAgLy8gcGFyZW50OiB3aW4sICAvL3RoaXMgZG9lc250IHdvcmsgdG9nZXRoZXIgd2l0aCBraW9zayBvbiB1YnVudHUgZ25vbWUgPz8gd3RmXG4gICAgICAgICAgICAvLyBtb2RhbDogdHJ1ZSwgIC8vIHRoaXMgYmxvY2tzIHRoZSBtYWluIHdpbmRvdyBvbiB3aW5kb3dzIHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBvcGVuXG4gICAgICAgICAgICAvLyBjbG9zYWJsZTogZmFsc2UsICAvLyBpZiB3ZSBjYW4ndCBkZWZpbmUgJ3BhcmVudCcgdGhpcyB3aW5kb3cgaGFzIHRvIGJlIGNsb3NhYmxlIC0gd2h5P1xuICAgICAgICAgICAgLy9hbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIGtpb3NrOiB0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZXhhbXdpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZU1lbnUoKSAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvYmFibHkgbm90IG5lZWRlZCBiZWNhdXNlIHdlIGRpc2FibGUgbWlzc2lvbmNvbnRyb2wgYW55d2F5cyAtIHNlZW1zIHRvIGludGVyZmVyZSB3aXRoIGtpb3NrIG1vZGUgb24gbWFjb3MgKGFnYWluKVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLmV4YW13aW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlLCB7IHZpc2libGVPbkZ1bGxTY3JlZW46IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzV2F5bGFuZCl7IHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdGFydCgpIH0gLy8gY29uc3RhbnRseSBjaGVjayBpZiB0aGUgYWN0aXZlIHdpbmRvdyBpcyB0aGUgZXhhbXdpbmRvdyAtIGlmIG5vdCwgYnJpbmcgaXQgdG8gZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKHRoaXMpICAvLyBkaXNhYmxlIGtleWJvYXJkIHNob3J0Y3V0cyBldGMuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAvLyBkbyBub3Qgc2V0IGJsdXIgbGlzdGVuZXIgdG9vIGVhcmx5XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKCkgIC8vIGFkZCBibHVyIGxpc3RlbmVyIHRvIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgZGlkLWZpbmlzaC1sb2FkOiBlcnJvciBpbiBleGFtd2luZG93IHNldHVwXCIsIGUpfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cyAvL3dlIGtlZXAgaXQgdGhlcmUgdG8gbWFrZSBpdCBhY2Nlc3NhYmxlIHZpYSBleGFtd2luZG93IGluIGlwY0hhbmRsZXJcbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQgPSA5NCAgIC8vIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgY29udGVudCB2aWV3XG4gICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNaWNyb3NvZnQgMzY1IGVtZWJlZHMgaXRzIGVkaXRvciBpbiBhbiBpZnJhbWUgd2l0aCBhY3RpdmUgQ29udGVudCBTZWN1cml0eSBQb2xpY3kgKENTUClcbiAgICAgICAgICogVGhlIG9ubHkgd2F5IHRvIGJlIGFibGUgdG8gaW5qZWN0IGNvZGUgaXMgdG8gbG9hZCBpdCBkaXJlY3RseSBpbiB0aGUgbWFpbiB3aW5kb3cgPGVtYmVkPiA8aWZyYW1lPiBvciBldmVuIDx3ZWJ2aWV3PiBvZmZlcnMgbm8gd29ya2Fyb3VuZFxuICAgICAgICAgKiB0aGVyZWZvcmUgd2UgdXNlIFwiQnJvd3NlclZpZXdcIiBpbiBvcmRlciB0byBkaXNwbGF5IHR3byBwYWdlcyBpbiBvbmUgd2luZG93OiBvbiB0b3AgPiBleGFtIGhlYWRlciwgb24gYm90dG9tID4gb2ZmaWNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlmIChleGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIiAgKSB7IC8vZXh0ZXJuYWwgcGFnZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJzdGFydGluZyBtaWNyb3NvZnQzNjUgZXhhbS4uLlwiKVxuICAgICAgICAgICAgbGV0IHVybHZpZXcgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgICBcbiAgICAgICAgICAgIGlmICghdXJsdmlldykgey8vIHdlIHdhaXQgZm9yIHRoZSBuZXh0IHVwZGF0ZSB0aWNrIC0gbXNvZmZpY2VzaGFyZSBuZWVkcyB0byBiZSBzZXQgISAoY291bGQgaGFwcGVuIHdoZW4gYSBzdHVkZW50IGNvbm5lY3RzIGxhdGVyIHRoZW4gZXhhbSBtb2RlIGlzIHNldCBidXQgaGlzIHNoYXJlIHVybCBuZWVkcyBzb21lIHRpbWUpXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogbm8gdXJsIGZvciBtaWNyb3NvZnQzNjUgd2FzIHNldCB5ZXQgLSB3YWl0aW5nIGZvciBuZXh0IHVwZGF0ZSB0aWNrXCIpXG4gICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBkZXN0cm95ZWRcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbG9hZCB0b3AgbWVudSBpbiBNYWluUGFnZVxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgZWR1dmlkdWFsIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGJhY2tncm91bmR1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwoYmFja2dyb3VuZHVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBEZWZpbmUgdGhlIE1haW5Db250ZW50UGFnZSB2aWV3XG4gICAgICAgICAgICBsZXQgY29udGVudFZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSwgIFxuICAgICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRBdXRvUmVzaXplKHsgd2lkdGg6IHRydWUsIGhlaWdodDogdHJ1ZSwgaG9yaXpvbnRhbDogdHJ1ZSwgdmVydGljYWw6IHRydWUgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybHZpZXcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSB9XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignZW50ZXItZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbigncmVzaXplJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgbm9ybWFsIGV4YW0gbW9kZSAoZWRpdG9yLCBtYXRoLCBlZHV2aWR1YWwsIHdlYnNpdGUsIGdmb3JtcylcbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGUgc3BlY2lhbCBOQVZJR0FUSU9OIHNpdHVhdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBGb3JtcywgV2Vic2l0ZSwgRWR1dmlkdWFsLCBFZGl0b3IsIFJEUCwgTWljcm9zb2Z0MzY1XG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gZXhhbXdpbmRvdy53ZWJDb250ZW50cyBsZXZlbCBmb3IgYWxsIG1vZGVzIHRoYXQgY2FuIGRpc3BsYXkgUERGcyBpbiBleGFtaGVhZGVyXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgbmF2aWdhdGlvbiB3aGVuIGNsaWNraW5nIGxpbmtzIGluIFBERnMgZGlzcGxheWVkIGluIHRoZSBleGFtaGVhZGVyXG4gICAgICAgIC8vIFdlYnZpZXcvQnJvd3NlclZpZXcgYmxvY2tpbmcgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5IHZpYSBJUEMgaW4gaXBjaGFuZGxlci5qcyBvciBtb2RlLXNwZWNpZmljIGhhbmRsZXJzIGJlbG93XG4gICAgICAgIGNvbnN0IGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlciA9IFtcImdmb3Jtc1wiLCBcIndlYnNpdGVcIiwgXCJlZHV2aWR1YWxcIiwgXCJlZGl0b3JcIiwgXCJyZHBcIiwgXCJtaWNyb3NvZnQzNjVcIiwgXCJhY3RpdmVzaGVldHNcIiwgXCJtYXRoXCJdO1xuICAgICAgICBpZiAoZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyLmluY2x1ZGVzKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBWdWUgYXBwIChlLmcuIGZyb20gUERGIGxpbmtzIGluIGV4YW1oZWFkZXIpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gUHJldmVudCBuZXcgd2luZG93cyBmcm9tIG9wZW5pbmcgaW4gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgbmV3LXdpbmRvd1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBzZXRXaW5kb3dPcGVuSGFuZGxlclwiLCB1cmwpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIE1pY3Jvc29mdCBFeGNlbC9Xb3JkXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIpeyAgLy8gZG8gbm90IHVuZGVyIGFueSBjaXJjdW1zdGFuY2VzIGFsbG93IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBjdXJyZW50IGV4YW0gdXJsXG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHVzZXIgd2FudHMgdG8gbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgcGFnZVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJkbyBub3QgbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgdGVzdC4uIFwiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0ZUNvZGUgPSAgYFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBsb2NrKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAnV0FDRGlhbG9nT3V0ZXJDb250YWluZXInLCdXQUNEaWFsb2dJbm5lckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ1BhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZGV1c0J5SUQgPSBbJ1Nob3dIaWRlRXF1YXRpb25Ub29sc1BhbmUnLCdMaW5rR3JvdXAnLCdHcmFwaGljc0VkaXRvcicsJ0luc2VydFRhYmxlT2ZDb250ZW50c0luSW5zZXJ0VGFiJywnSW5zZXJ0T25saW5ldmlkZW8nLCdQaWN0dXJlJywnUmliYm9uLVBpY3R1cmVNZW51TUxSRHJvcGRvd24nLCdJbnNlcnRBZGRJbkZseW91dCcsJ0Rlc2lnbmVyJywnRWRpdG9yJywnRmFyUGFuZScsJ0hlbHAnLCdJbnNlcnRBcHBzRm9yT2ZmaWNlJywnRmlsZU1lbnVMYXVuY2hlckNvbnRhaW5lcicsJ0hlbHAtd3JhcHBlcicsJ1Jldmlldy13cmFwcGVyJywnSGVhZGVyJywnRmFyUGVyaXBoZXJhbENvbnRyb2xzQ29udGFpbmVyJywnQnVzaW5lc3NCYXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChlbnRyeSBvZiBoaWRldXNCeUlEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJkaXNwbGF5XCIsIFwibm9uZVwiLCBcImltcG9ydGFudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBidXR0b25BcHBzT3ZlcmZsb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnQWRkLUlucycpWzBdOyAgLy8gdGhpcyBidXR0b24gaXMgcmVkcmF3biBvbiByZXNpemUgKGRvZXNuJ3QgaGFwcGVuIGluIGV4YW0gbW9kZSBidXQgc3RpbGwgdGhlcmUgbXVzdCBiZSBhIGNsZWFuZXIgd2F5IC0gaW5zZXJ0aW5nIGNzcyBiZWZvcmUgaXQgYXBwZWFycyBpcyBub3Qgd29ya2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidXR0b25BcHBzT3ZlcmZsb3cpeyBidXR0b25BcHBzT3ZlcmZsb3cuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJTdWNoZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJcdTAwRENiZXJzZXR6ZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJDb3BpbG90XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkFkZC1JbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwQ29udGV4dE1lbnVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cFN5bm9ueW1zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlJpYmJvbi1SZWZlcmVuY2VzU21hcnRMb29rVXBcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJEaWN0YXRpb25cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkdldEFkZGluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUGljdHVyZXNfTUxSXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pOyAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9jaygpICAvL2ZvciBzb21lIHJlYXNvbiBleGNlbCBkZWxheXMgdGhhdCBjYWxsLi4gZG9lc250IGhhcHBlbiBvbiBwYWdlIGZpbmlzaCBsb2FkXG4gICAgICAgICAgICAgICAgICAgIGBcblxuICAgICAgICAgICAgbGV0IHNjaGVkdWxlckluc3RhbmNlID0gbnVsbFxuICAgICAgICAgICAgdGhpcy5sb2NrQ2FsbGJhY2sgPSAoKSA9PiB0aGlzLmxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSk7IFxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmxvY2tDYWxsYmFjaywgNDAwKVxuICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gc2NoZWR1bGVySW5zdGFuY2VcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0YXJ0KClcbiAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgdGhlIHdlYkNvbnRlbnRzIGlzIGZ1bGx5IGxvYWRlZCAgLy8gdGhpcyBpcyBub3Qgd29ya2luZyByZWxpYWJseSBiZWNhdXNlIHRoZSBwYWdlIGlzIGxvYWRlZCBpbiBtYW55IHN0ZXBzIGFuZCB0aGUgdWkgZWxlbWVudHMgYXJlIG5vdCBhdmFpbGFibGUgeWV0XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2FwcC1jb21tYW5kJywgKGUsIGNtZCkgPT4ge1xuICAgICAgICAgICAgLy8gJ2Jyb3dzZXItYmFja3dhcmQnIHVuZCAnYnJvd3Nlci1mb3J3YXJkJyBzaW5kIGRpZSBCZWZlaGxlLCBkaWUgYmVpbSBLbGljayBhdWYgZGllIE1hdXN0YXN0ZW4gZ2VzZW5kZXQgd2VyZGVuXG4gICAgICAgICAgICBpZiAoY21kID09PSAnYnJvd3Nlci1iYWNrd2FyZCcgfHwgY21kID09PSAnYnJvd3Nlci1mb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwibm8gbmF2aWdhdGlvbiBhbGxvd2VkXCIpXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJuIFNpZSBkYXMgU3RhbmRhcmR2ZXJoYWx0ZW5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICAvL2Rpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KSAgLy9kbyBub3QgZGlzYWJsZSB0d2ljZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgbG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKXtcbiAgICAgICAgaWYgKGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzICYmIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZSl7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIiwgZnJhbWUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUgJiYgKGZyYW1lLm5hbWUgPT09ICdXZWJBcHBsaWNhdGlvbkZyYW1lJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfV29yZF8wJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfRXhjZWxfMCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiKVxuICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IHN0b3BwaW5nIGxvY2tTY2hlZHVsZXJcIilcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0b3AoKVxuICAgICAgICAgICAgaWYgKHRoaXMubG9ja1NjaGVkdWxlciA9PT0gc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogbm8gYnJvd3NlclZpZXcgb3IgbG9ja1NjaGVkdWxlciBmb3VuZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTUFJTiBXSU5ET1dcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGFzeW5jIGNyZWF0ZU1haW5XaW5kb3coKSB7XG4gICAgICAgIGxldCBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpWzBdXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaW5kb3cgZGltZW5zaW9ucyAtIGRlZmluZWQgb25jZSwgdXNlZCBldmVyeXdoZXJlXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gMTAyNFxuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSA2NDBcblxuICAgICAgICAvLyBDYWxjdWxhdGUgY2VudGVyIHBvc2l0aW9uIG9uIHByaW1hcnkgZGlzcGxheVxuICAgICAgICBsZXQgeCA9IDBcbiAgICAgICAgbGV0IHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy53aWR0aCAtIHdpbmRvd1dpZHRoKSAvIDIpXG4gICAgICAgICAgICB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnkgKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMuaGVpZ2h0IC0gd2luZG93SGVpZ2h0KSAvIDIpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ01haW4gd2luZG93JyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICB5OiB5LFxuICAgICAgICAgICAgd2lkdGg6IHdpbmRvd1dpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB3aW5kb3dIZWlnaHQsXG4gICAgICAgICAgICBtaW5XaWR0aDogODUwLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiA2MDAsXG4gICAgICAgICAgICByZXNpemFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRhcyBcdTAwQzRuZGVybiBkZXIgR3JcdTAwRjZcdTAwREZlICBcbiAgICAgICAgICAgIGZ1bGxzY3JlZW5hYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkZW4gVm9sbGJpbGRtb2R1cyAtIHdpY2h0aWcgZlx1MDBGQ3IgbWFjb3MgZGVubiB3ZW5uIGF1ZiBtYWNvcyBkYXMgbWFpbndpbmRvdyBhdWYgZnVsbHNjcmVlbiBpc3QgZ3JlaWZ0IGJlaW0gZXhhbXdpbmRvdyBkZXIga2lvc2sgbW9kZSBuaWNodCAgLSBlbGVjdHJvbiBidWcgKG5lZWRzIGV4YW1wbGUgY29kZSk6ID4+IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvNDQ3NTVcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICAvL3Zpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IHBhdGgucmVzb2x2ZShcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudERpcixcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5qb2luKHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0ZPTERFUiwgJ2VsZWN0cm9uLXByZWxvYWQnICsgcHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRVhURU5TSU9OKVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZFRocm90dGxpbmc6IHRydWUgIC8vIGFsbG93IHRocm90dGxpbmcgd2hlbiB3aW5kb3cgaXMgaW4gYmFja2dyb3VuZFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzIGJlZm9yZSBsb2FkaW5nXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5vbignY2xvc2UnLCBhc3luYyAgKGUpID0+IHsgICAvLyBhc2sgYmVmb3JlIGNsb3NpbmdcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgIXRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQpIHsgIC8vIGFsbG93ZXhpdCBpc3QgZWluIG92ZXJyaWRlIHZvbSBjb250ZXh0IG1lbnUgb2RlciBzY3JlZW5zaG90IHRlc3QuIGRpZXNlciBrYW5uIGRpZSBhcHAgc2NobGllc3NlblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxsb3dUcmF5ID0gIXBsYXRmb3JtRGlzcGF0Y2hlci5faXNHTk9NRSgpOyAvLyBHTk9NRSBoYXMgbm8gbGVnYWN5IHRyYXlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhbGxvd1RyYXkpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IEdOT01FIGRldGVjdGVkLCBxdWl0dGluZyBpbnN0ZWFkIG9mIHRyYXkgbWluaW1pemVgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyAgLy8gYWxsb3cgY2xvc2UgZmxvd1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zaG93TWluaW1pemVXYXJuaW5nKClcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBNaW5pbWl6aW5nIE5leHQtRXhhbSB0byBTeXN0ZW10cmF5YCkgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuaGlkZSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFNldCB3aW5kb3cgcHJvcGVydGllcyBpbW1lZGlhdGVseSBhZnRlciBjcmVhdGlvblxuICAgICAgICB0aGlzLm1haW53aW5kb3cucmVtb3ZlTWVudSgpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5mb2N1cygpXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgLy90aGlzLm1haW53aW5kb3cuc2V0SGlkZGVuSW5NaXNzaW9uQ29udHJvbCh0cnVlKVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5tYWlud2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG5cbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkIHx8IHByb2Nlc3MuZW52W1wiREVCVUdcIl0pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKTtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBmaWxlOiAke2ZpbGVQYXRofWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZEZpbGUoZmlsZVBhdGgpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfWBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTG9hZGluZyBVUkw6ICR7dXJsfWApXG4gICAgICAgICAgICB0aGlzLm1haW53aW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgYXN5bmMgc2hvd0V4aXRXYXJuaW5nKG1lc3NhZ2Upe1xuICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnd2FybmluZycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPayddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gQmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93RXhpdFF1ZXN0aW9uKCl7XG4gICAgICAgIGlmICh0aGlzLmV4aXRRdWVzdGlvbk9wZW4pIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRpYWxvZyBhbHJlYWR5IG9wZW4sIHNraXBwaW5nXCIpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydKYScsICdOZWluJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBiZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnV29sbGVuIHNpZSBkaWUgQW53ZW5kdW5nIE5leHQtRXhhbSBiZWVuZGVuPycsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYoY2hvaWNlLnJlc3BvbnNlID09IDEpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiV2luZG93aGFuZGxlciBAIHNob3dFeGl0UXVlc3Rpb246IGRvIG5vdCBjbG9zZSBOZXh0LUV4YW0gYWZ0ZXIgZmluaXNoZWQgRXhhbVwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWVcbiAgICAgICAgICAgICAgICBhcHAucXVpdCgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmV4aXRRdWVzdGlvbk9wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd01pbmltaXplV2FybmluZygpe1xuICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2luZm8nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ01pbmltaXplIHRvIFN5c3RlbSBUcmF5JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRGllIEFud2VuZHVuZyBOZXh0LUV4YW0gd3VyZGUgbWluaW1pZXJ0IScsXG4gICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIC8qKlxuICAgICAqIEFkZGl0aW9uYWwgRnVuY3Rpb25zXG4gICAgICovXG5cbiAgICBpc1dheWxhbmQoKXtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3MuZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJzsgXG4gICAgfVxuXG4gICAgLy8gdGhpcyBmdW5jdGlvbiB1c2VzIGFjdGl2ZS13aW4gdG8gcmVjZWl2ZSBuYW1lIGFuZCB1cmwgZnJvbSBhY3RpdmUgd2luZG93IC0geWV0IGFub3RoZXIgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhlIGZvY3VzIGlzIHN0aWxsIG9uIG5leHRleGFtXG4gICAgLy8gdGhpcyBpcyB1c2VkIHRvIGludHJvZHVjZSBleGVtcHRpb25zIGZvciB0aGUgYmx1ciBsaXN0ZW5lclxuICAgIC8vIChkb3duZ3JhZGVkIGZyb20gZ2V0LXdpbmRvd3MgYmVjYXVzZSBvZiBuYXBpIHY5IGlzc3VlKSBodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL2dldC13aW5kb3dzL2lzc3Vlcy8xODZcbiAgICBhc3luYyB3aW5kb3dUcmFja2VyKCl7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgIC8vIGNvbnN0IGdldHdpbiA9IGF3YWl0IHRoaXMuZ2V0QWN0aXZlV2luZG93KCk7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVXaW4gPSBhd2FpdCBhY3RpdmVXaW5kb3coKVxuICAgICAgICAgXG4gICAgICAgICAgICBpZiAoYWN0aXZlV2luICYmIGFjdGl2ZVdpbi5vd25lciAmJiBhY3RpdmVXaW4ub3duZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIGxldCBuYW1lID0gYWN0aXZlV2luLm93bmVyLm5hbWVcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGggPSBhY3RpdmVXaW4ub3duZXIucGF0aFxuICAgICAgICAgICAgICAgIGxldCBuYW1lTG93ZXIgPSBuYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgICAgICBsZXQgd3BhdGhMb3dlciA9IHdwYXRoLnRvTG93ZXJDYXNlKClcblxuICAgICAgICAgICAgICAgIGlmIChuYW1lTG93ZXIuaW5jbHVkZXMoXCJleGFtXCIpIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcIm5leHRcIikgIHx8IG5hbWVMb3dlci5pbmNsdWRlcyhcImVsZWN0cm9uXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZWFzZW9mYWNjZXNzZGlhbG9nXCIpIHx8ICB3cGF0aExvd2VyLmluY2x1ZGVzKFwiZGlzYWJsZS1zaG9ydGN1dHNcIikgKXsgIFxuICAgICAgICAgICAgICAgICAgICAvLyBmb2t1cyBpcyBvbiBhbGxvd2VkIHdpbmRvdyBpbnN0YW5jZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IC8vZm9jdXMgaXMgbm90IG9uIG5leHQtZXhhbSBvciBhbnkgb3RoZXIgYWxsb3dlZCB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkKXsgIC8vbG9nIGp1c3Qgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiBmb2N1cyBsb3N0IGV2ZW50IHdhcyB0cmlnZ2VyZWQuIGFwcDogJHt3cGF0aH0gLSAke25hbWV9IGApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6ICR7ZXJyfWApIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9hZGRzIGJsdXIgbGlzdGVuZXIgd2hlbiBlbnRlcmluZyBleGFtbW9kZSAgIC8vIGJsdXIgZXZlbnQgaXNudCBmaXJlZCBvbiBtYWNvcyBNSVNTSU9OQ09OVFJPTCAod2hpY2ggY2FudCBiZSBkZWFjdGl2YXRlZCBhbnltb3JlKSAtIGRhbW4geW91IGFwcGxlIVxuICAgIGFkZEJsdXJMaXN0ZW5lcih3aW5kb3cgPSBcImV4YW13aW5kb3dcIil7XG4gICAgICAgIGlmICh3aW5kb3cgPT09IFwiZXhhbXdpbmRvd1wiKXsgXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd31gKVxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnQodGhpcykpIFxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHdpbmRvdyA9PT0gXCJzY3JlZW5sb2NrXCIpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fXdpbmRvd2ApXG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIHRoaXMuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudFNjcmVlbmxvY2sodGhpcykpICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy9yZW1vdmVzIGJsdXIgbGlzdGVuZXIgd2hlbiBsZWF2aW5nIGV4YW0gbW9kZVxuICAgIHJlbW92ZUJsdXJMaXN0ZW5lcigpe1xuICAgICAgICBpZiAodGhpcy5leGFtd2luZG93KXtcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2JsdXInKVxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgcmVtb3ZlQmx1ckxpc3RlbmVyOiByZW1vdmluZyBibHVyIGxpc3RlbmVyXCIpXG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gaW1wbGVtZW50aW5nIGEgc2xlZXAgKHdhaXQpIGZ1bmN0aW9uXG4gICAgc2xlZXAobXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIH1cbiAgICAvL3N0dWRlbnQgZm9ndXMgd2VudCB0byBhbm90aGVyIHdpbmRvd1xuICAgIGFzeW5jIGJsdXJldmVudCh3aW5oYW5kbGVyKSB7IFxuXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudDogc3R1ZGVudCB0cmllZCB0byBsZWF2ZSBleGFtIHdpbmRvd1wiKVxuXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnbGludXgnKXtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMud2luZG93VHJhY2tlcigpICAvL2NoZWNrcyBpZiBuZXcgZm9jdXMgd2luZG93IGlzIGFsbG93ZWRcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93dHJhY2tlciBjaGVjayBkb25lLi4uXCIpXG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIHNjcmVlbmxvY2sgd2luZG93cyBmcm9tIGFycmF5IGFuZCBjaGVjayBpZiBhbnkgc3RpbGwgZXhpc3RcbiAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICBjb25zdCBoYXNBY3RpdmVTY3JlZW5sb2NrID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5zb21lKHdpbiA9PiB3aW4gJiYgIXdpbi5pc0Rlc3Ryb3llZCgpICYmIHdpbi5pc1Zpc2libGUoKSlcbiAgICAgICAgLy8gQWxzbyBjaGVjayBjbGllbnRpbmZvLnNjcmVlbmxvY2sgZmxhZyBhcyBmYWxsYmFjayBpbiBjYXNlIGFycmF5IHdhcyBjbGVhcmVkIGJ1dCB3aW5kb3dzIHN0aWxsIGV4aXN0XG4gICAgICAgIGlmIChoYXNBY3RpdmVTY3JlZW5sb2NrIHx8IHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvPy5zY3JlZW5sb2NrKSB7IHJldHVybiB9Ly8gZG8gbm90aGluZyBpZiBzY3JlZW5sb2Nrd2luZG93IHN0b2xlIGZvY3VzIC8vIGRvIG5vdCB0cmlnZ2VyIGFuIGluZmluaXRlIGxvb3AgYmV0d2VlbiBleGFtIHdpbmRvdyBhbmQgc2NyZWVubG9jayB3aW5kb3cgKHN0ZWFsaW5nIGVhY2ggb3RoZXJzIGZvY3VzIGJlY2F1c2Ugc2NyZWVubG9ja3dpbmRvdyBhcHBlYXJzIGFib3ZlIGV4YW0gd2luZG93IGFuZCB3aWxsIGNhcHR1cmUgYSBrbGljayBhbmQgdGhlcmVmb3JlIHN0ZWFsIGZvY3VzKVxuICAgICAgICBpZiAod2luaGFuZGxlci5mb2N1c1RhcmdldEFsbG93ZWQpeyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyBcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAvL3Ryb3R6ZGVtIGZvY3VzIHp1clx1MDBGQ2NrIGF1ZiBkaWUgYXBwXG4gICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudDogYmx1cmV2ZW50IHdhcyB0cmlnZ2VyZWQgYnV0IHRhcmdldCBpcyBhbGxvd2VkYClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlICAgLy9pbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcblxuICAgICAgICAvL3R1cm4gdm9sdW1lIHVwIF5eXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7IHNwYXduKCdwb3dlcnNoZWxsJywgWydTZXQtVm9sdW1lTGV2ZWwgLUxldmVsIDEwMDsgU2V0LVZvbHVtZU11dGUgLU11dGUgJGZhbHNlJ10pOyB9XG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7IGV4ZWMoJ29zYXNjcmlwdCAtZSBcInNldCB2b2x1bWUgb3V0cHV0IHZvbHVtZSAxMDBcIiAtZSBcInNldCB2b2x1bWUgb3V0cHV0IG11dGVkIGZhbHNlXCInKTsgfSAgXG4gICAgICAgIC8vIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7IFxuICAgICAgICAvLyAgICAgZXhlYygnYW1peGVyIHNldCBNYXN0ZXIgMTAwJSAnKTtcbiAgICAgICAgLy8gICAgIGV4ZWMoJ3BhY3RsIHNldC1zaW5rLW11dGUgYHBhY3RsIGdldC1kZWZhdWx0LXNpbmtgIDAnKTtcbiAgICAgICAgLy8gfVxuICAgICAgICBcbiAgICAgICAgLy93ZSBjb3VsZCBwbGF5IGEgc291bmQgZmlsZSBoZXJlLi4gdGJkLiAgXG4gICAgfVxuICAgIC8vc3BlY2lhbCBibHVyIGV2ZW50IGZvciB0ZW1wb3JhcnkgbG93IHNlY3VyaXR5IHNjcmVlbmxvY2tcbiAgICBibHVyZXZlbnRTY3JlZW5sb2NrKHdpbmhhbmRsZXIpIHsgXG4gICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6IGJsdXItc2NyZWVubG9jayB0cmlnZ2VyZWRcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vZG9uJ3QgY3ljbGUgdGhyb3VnaCBhbGwgb2YgdGhlbSAuLiBpdCB3aWxsIGNyZWF0ZSBhbiBpbmZpbml0ZSBmb2N1cyByYWNlXG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLnNob3coKTsgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGJsdXJldmVudFNjcmVlbmxvY2s6ICR7ZXJyfWApXG4gICAgICAgIH1cbiAgICBcbiAgICB9XG4gICAgXG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IFdpbmRvd0hhbmRsZXIoKVxuIFxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0XG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBtb3N0IG9mIHRoZSBrZXlib2FyZCByZXN0cmljdGlvbnMgY291bGQgYmUgaGFuZGxlZCBieSBcImlvaG9va1wiIGZvciBhbGwgcGxhdGZvcm1zXG4gKiB1bmZvcnR1bmFsZXR5IGl0J3Mgbm90IHlldCByZWxlYXNlZCBmb3Igbm9kZSB2MTYueCBhbmQgZWxlY3Ryb24gdjE2LnggIChhbHNvIGl0J3MgXCJiaWcgc3VyXCIgaW50ZWwgb25seSBvbiBtYWNzKVxuICogaHR0cHM6Ly93aWxpeC10ZWFtLmdpdGh1Yi5pby9pb2hvb2svaW5zdGFsbGF0aW9uLmh0bWxcbiAqXG4gKiBcIm5vZGUtZ2xvYmFsLWtleS1saXN0ZW5lclwiIHdvdWxkIGJlIGFub3RoZXIgc29sdXRpb24gZm9yIHdpbmRvd3MgYW5kIG1hY29zIChhbHRob3VnaCBpdCByZXF1aXJlcyBcImFjY2Vzc2FiaWxpdHlcIiBwZXJtaXNzaW9ucyBvbiBtYWMpXG4gKiBidXQgZm9yIG5vdyBpdCBzZWVtcyB0aGUgbW9kdWxlIGNhbiBub3QgcnVuIGluIGEgZmluYWwgZWxlY3Ryb24gYnVpbGRcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9MYXVuY2hNZW51L25vZGUtZ2xvYmFsLWtleS1saXN0ZW5lci9pc3N1ZXMvMThcbiAqXG4gKiBoYXJkY29kaW5nIHRoZSBrZXlib2FyZHNob3J0Y3V0cyB3ZSB3YW50IHRvIGNhcHR1cmUgaW50byBpb2hvb2sob3Igbi1nLWstbCkgYW5kIG1hbnVhbGx5IGNvbXBpbGluZyBpdCBmb3IgbWFjIGFuZCB3aW5kb3dzIGNvdWxkIGJlIGRvbmUgLSAoYnV0IG5vdCB1bnRpbCBpIGdldCBwYWlkIGZvciB0aGlzIGFtb3VudCBvZiB3b3JrIDstKVxuICovXG5cblxuLyoqXG4gKiB0aGUgbmV4dCBiZXN0IHNvbHV0aW9uIGkgY2FtZSB1cCB3aXRoIGlzIHRvIGtpbGwgYWxsIG9mIHRoZSBzaGVsbHMgLSBzdGFydGluZyB3aXRoIGV4cGxvcmVyLmV4ZSBiZWNhdXNlIGl0cyBhYnNvbHV0ZWx5IGltcG9zc2libGUgdG9cbiAqIGRlYWN0aXZhdGUgdGhpcyBuYXN0eSBcIndpbmRvd3NcIiBidXR0b24gb3IgM0ZpbmdlclNsaWRlVXAgR2VzdHVyZSBpbiB3aW5kb3dzIDExIC0geW91IGNvdWxkIGVkaXQgdGhlIHJlZ2lzdHJ5IGFuZCByZWJvb3QgYnV0IHRoYXRzIG9idmlvdXNseSBub3Qgd2hhdCB3ZSB3YW50XG4gKi9cblxuaW1wb3J0IGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGNsaXBib2FyZCwgZ2xvYmFsU2hvcnRjdXQgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBTY2hlZHVsZXJTZXJ2aWNlIH0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgZW5hYmxlTGludXhSZXN0cmljdGlvbnMsIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL2xpbi5qcyc7XG5pbXBvcnQgeyBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zLCBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucyB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL3dpbi5qcyc7XG5pbXBvcnQgeyBlbmFibGVNYWNSZXN0cmljdGlvbnMsIGRpc2FibGVNYWNSZXN0cmljdGlvbnMsIHRvZ2dsZU1hY09TTG9ja2Rvd24gYXMgdG9nZ2xlTWFjT1NMb2NrZG93bkltcGwgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9tYWMuanMnO1xuXG5sZXQgY2xpcGJvYXJkSW50ZXJ2YWw7XG5sZXQgY29uZmlnU3RvcmUgPSB7XG4gICAgbGludXg6IHt9LFxuICAgIHdpbmRvd3M6IHt9LFxuICAgIG1hY29zOiB7fVxufTtcblxuLy8gbGlzdCBvZiBhcHBzIHdlIGRvIG5vdCB3YW50IHRvIHJ1biBpbiBiYWNrZ3JvdW5kXG5jb25zdCBhcHBzVG9DbG9zZSA9IFsnR29vZ2xlIENocm9tZScsICdjaHJvbWUnLCAnZ29vZ2xlLWNocm9tZScsICdNaWNyb3NvZnQgRWRnZScsICdtc2VkZ2UnLCAnZmlyZWZveCcsICdzYWZhcmknLCAnYnJhdmUnLCAnb3BlcmEnLCAnY2hhdGdwdCcsICdDaGF0R1BUJywgJ05vcnRvblNlY3VyaXR5JywgJ05BVicsICdUZWFtcycsICdtcy10ZWFtcycsICd6b29tLnVzJywgJ01pY3Jvc29mdCBUZWFtcycsICdkaXNjb3JkJywgJ3pvb20nLCAndGVhbXMnLCAndGVhbXZpZXdlcicsICdza3lwZWZvcmxpbnV4JywgJ3NreXBlJywgJ2FueWRlc2snXTtcblxuYXN5bmMgZnVuY3Rpb24gZW5hYmxlUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuXG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgcGxhdGZvcm0gcmVzdHJpY3Rpb25zXCIpO1xuXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGNsaXBib2FyZC5jbGVhcigpO1xuICAgIGNsaXBib2FyZEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UoKCkgPT4geyBjbGlwYm9hcmQuY2xlYXIoKTsgfSwgMTAwMCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RhcnQoKTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNLREUsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0dOT01FKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGF3YWl0IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGVuYWJsZU1hY1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXNhYmxlUmVzdHJpY3Rpb25zKCkge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHJlbW92aW5nIHJlc3RyaWN0aW9ucy4uLlwiKTtcblxuICAgIGlmIChjbGlwYm9hcmRJbnRlcnZhbCkge1xuICAgICAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdG9wKCk7XG4gICAgfVxuXG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMoKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVNYWNPU0xvY2tkb3duKGVuYWJsZSkge1xuICAgIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsKGVuYWJsZSk7XG59XG5cbmV4cG9ydCB7IGVuYWJsZVJlc3RyaWN0aW9ucywgZGlzYWJsZVJlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biB9O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBMaW51eC1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlKS5cbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyB1bmZvcnR1bmF0ZWx5IHRoZXJlIGlzIG5vIGNvbnZlbmllbnQgd2F5IGZvciBnbm9tZS1zaGVsbCB0byB1bi1zZXQgQUxMIHNob3J0Y3V0cyBhdCBvbmNlXG5jb25zdCBnbm9tZUtleWJpbmRpbmdzID0gW1xuICAgICdhY3RpdmF0ZS13aW5kb3ctbWVudScsJ21heGltaXplLWhvcml6b250YWxseScsJ21vdmUtdG8tc2lkZS1uJywnbW92ZS10by13b3Jrc3BhY2UtOCcsJ3N3aXRjaC1hcHBsaWNhdGlvbnMnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTMnLCdzd2l0Y2gtd2luZG93cy1iYWNrd2FyZCcsXG4gICAgJ2Fsd2F5cy1vbi10b3AnLCdtYXhpbWl6ZS12ZXJ0aWNhbGx5JywnbW92ZS10by1zaWRlLXMnLCdtb3ZlLXRvLXdvcmtzcGFjZS05Jywnc3dpdGNoLWFwcGxpY2F0aW9ucy1iYWNrd2FyZCcsJyAgc3dpdGNoLXRvLXdvcmtzcGFjZS00JywndG9nZ2xlLWFib3ZlJyxcbiAgICAnYmVnaW4tbW92ZScsJ21pbmltaXplJywnbW92ZS10by1zaWRlLXcnLCdtb3ZlLXRvLXdvcmtzcGFjb2UtZG93bicsJ3N3aXRjaC1ncm91cCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNScsJ3RvZ2dsZS1mdWxsc2NyZWVuJyxcbiAgICAnYmVnaW4tcmVzaXplJywnbW92ZS10by1jZW50ZXInLCdtb3ZlLXRvLXdvcmtzcGFjZS0xJywnbW92ZS10by13b3Jrc3BhY2UtbGFzdCcsJ3N3aXRjaC1ncm91cC1iYWNrd2FyZCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNicsJ3RvZ2dsZS1tYXhpbWl6ZWQnLFxuICAgICdjbG9zZScsJ21vdmUtdG8tY29ybmVyLW5lJywnbW92ZS10by13b3Jrc3BhY2UtMTAnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sZWZ0Jywnc3dpdGNoLWlucHV0LXNvdXJjZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtNycsJ3RvZ2dsZS1vbi1hbGwtd29ya3NwYWNlcycsXG4gICAgJ2N5Y2xlLWdyb3VwJywnbW92ZS10by1jb3JuZXItbncnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMScsJ21vdmUtdG8td29ya3NwYWNlLXJpZ2h0Jywnc3dpdGNoLWlucHV0LXNvdXJjZS1iYWNrd2FyZCAgc3dpdGNoLXRvLXdvcmtzcGFjZS04JywndG9nZ2xlLXNoYWRlZCcsXG4gICAgJ2N5Y2xlLWdyb3VwLWJhY2t3YXJkJywnbW92ZS10by1jb3JuZXItc2UnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMicsJ21vdmUtdG8td29ya3NwYWNlLXVwJywnc3dpdGNoLXBhbmVscycsJ3N3aXRjaC10by13b3Jrc3BhY2UtOScsJ3VubWF4aW1pemUnLFxuICAgICdjeWNsZS1wYW5lbHMnLCdtb3ZlLXRvLWNvcm5lci1zdycsJ21vdmUtdG8td29ya3NwYWNlLTInLCdwYW5lbC1tYWluLW1lbnUnLCdzd2l0Y2gtcGFuZWxzLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1kb3duJyxcbiAgICAnY3ljbGUtcGFuZWxzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLWRvd24nLCdtb3ZlLXRvLXdvcmtzcGFjZS0zJywncGFuZWwtcnVuLWRpYWxvZycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGFzdCcsXG4gICAgJ2N5Y2xlLXdpbmRvd3MnLCdtb3ZlLXRvLW1vbml0b3ItbGVmdCcsJ21vdmUtdG8td29ya3NwYWNlLTQnLCdyYWlzZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxlZnQnLFxuICAgICdjeWNsZS13aW5kb3dzLWJhY2t3YXJkJywnbW92ZS10by1tb25pdG9yLXJpZ2h0JywnbW92ZS10by13b3Jrc3BhY2UtNScsJ3JhaXNlLW9yLWxvd2VyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMScsJ3N3aXRjaC10by13b3Jrc3BhY2UtcmlnaHQnLFxuICAgICdsb3dlcicsJ21vdmUtdG8tbW9uaXRvci11cCcsJ21vdmUtdG8td29ya3NwYWNlLTYnLCdzZXQtc3Bldy1tYXJrJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMicsJ3N3aXRjaC10by13b3Jrc3BhY2UtdXAnLFxuICAgICdtYXhpbWl6ZScsJ21vdmUtdG8tc2lkZS1lJywnbW92ZS10by13b3Jrc3BhY2UtNycsJ3Nob3ctZGVza3RvcCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtMicsJ3N3aXRjaC13aW5kb3dzJ1xuXTtcbmNvbnN0IGdub21lU2hlbGxLZXliaW5kaW5ncyA9IFsnZm9jdXMtYWN0aXZlLW5vdGlmaWNhdGlvbicsJ29wZW4tYXBwbGljYXRpb24tbWVudScsJ3NjcmVlbnNob3QnLCdzY3JlZW5zaG90LXdpbmRvdycsJ3NoaWZ0LW92ZXJ2aWV3LWRvd24nLFxuICAgICdzaGlmdC1vdmVydmlldy11cCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0xJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTInLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi00Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTUnLFxuICAgICdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi03Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTgnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOScsJ3Nob3ctc2NyZWVuc2hvdC11aScsJ3Nob3ctc2NyZWVuLXJlY29yZGluZy11aScsXG4gICAgJ3RvZ2dsZS1hcHBsaWNhdGlvbi12aWV3JywndG9nZ2xlLW1lc3NhZ2UtdHJheScsJ3RvZ2dsZS1vdmVydmlldyddO1xuY29uc3QgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncyA9IFsncm90YXRlLW1vbml0b3InLCdzd2l0Y2gtbW9uaXRvcicsJ3RhYi1wb3B1cC1jYW5jZWwnLCd0YWItcG9wdXAtc2VsZWN0JywndG9nZ2xlLXRpbGVkLWxlZnQnLCd0b2dnbGUtdGlsZWQtcmlnaHQnXTtcbmNvbnN0IGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzID0gWydhcHAtY3RybC1ob3RrZXktMScsJ2FwcC1jdHJsLWhvdGtleS0xMCcsJ2FwcC1jdHJsLWhvdGtleS0yJywnYXBwLWN0cmwtaG90a2V5LTMnLCdhcHAtY3RybC1ob3RrZXktNCcsJ2FwcC1jdHJsLWhvdGtleS01JyxcbiAgICAnYXBwLWN0cmwtaG90a2V5LTYnLCdhcHAtY3RybC1ob3RrZXktNycsJ2FwcC1jdHJsLWhvdGtleS04JywnYXBwLWN0cmwtaG90a2V5LTknLFxuICAgICdhcHAtaG90a2V5LTEnLCdhcHAtaG90a2V5LTEwJywnYXBwLWhvdGtleS0yJywnYXBwLWhvdGtleS0zJywnYXBwLWhvdGtleS00JywnYXBwLWhvdGtleS01JywnYXBwLWhvdGtleS02JywnYXBwLWhvdGtleS03JywnYXBwLWhvdGtleS04JywnYXBwLWhvdGtleS05JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS0xJywnYXBwLXNoaWZ0LWhvdGtleS0xMCcsJ2FwcC1zaGlmdC1ob3RrZXktMicsJ2FwcC1zaGlmdC1ob3RrZXktMycsJ2FwcC1zaGlmdC1ob3RrZXktNCcsJ2FwcC1zaGlmdC1ob3RrZXktNScsXG4gICAgJ2FwcC1zaGlmdC1ob3RrZXktNicsJ2FwcC1zaGlmdC1ob3RrZXktNycsJ2FwcC1zaGlmdC1ob3RrZXktOCcsJ2FwcC1zaGlmdC1ob3RrZXktOScsJ3Nob3J0Y3V0J107XG5jb25zdCBnbm9tZVdheWxhbmRLZXliaW5kaW5ncyA9IFsnc3dpdGNoLXRvLXNlc3Npb24tMScsJ3N3aXRjaC10by1zZXNzaW9uLTInLCdzd2l0Y2gtdG8tc2Vzc2lvbi0zJywnc3dpdGNoLXRvLXNlc3Npb24tNCcsJ3N3aXRjaC10by1zZXNzaW9uLTUnLCdzd2l0Y2gtdG8tc2Vzc2lvbi02Jywnc3dpdGNoLXRvLXNlc3Npb24tNycsJ3N3aXRjaC10by1zZXNzaW9uLTgnLCdzd2l0Y2gtdG8tc2Vzc2lvbi05Jywnc3dpdGNoLXRvLXNlc3Npb24tMTAnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMScsJ3N3aXRjaC10by1zZXNzaW9uLTEyJ107XG5cbi8qKlxuICogRW5hYmxlIExpbnV4LXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoS0RFL0dOT01FLCBjbG9zZSBhcHBzLCBjbGlwYm9hcmQpLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZ1N0b3JlIC0gc2hhcmVkIHN0b3JlIChjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzKVxuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICogQHBhcmFtIHtib29sZWFufSBpc0tERVxuICogQHBhcmFtIHtib29sZWFufSBpc0dOT01FXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSwgYXBwc1RvQ2xvc2UsIGlzS0RFLCBpc0dOT01FKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCJgLCAocGdyZXBFcnJvciwgc3Rkb3V0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwZ3JlcEVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiIHwgeGFyZ3MgLXIga2lsbCAtOWAsIChraWxsRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgha2lsbEVycm9yKSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgaWYgKGlzS0RFKSB7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEtERSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3JlYWRjb25maWc1JywgWyctLWZpbGUnLCAna3dpbnJjJywgJy0tZ3JvdXAnLCAnRGVza3RvcHMnLCAnLS1rZXknLCAnTnVtYmVyJ10sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKGtyZWFkY29uZmlnKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSAxO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMgPSBzdGRvdXQudHJpbSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogcmVjb25maWd1cmluZyBrd2luXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsIGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCAnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnXCJcIiddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCdrd2lucmMnLCctLWdyb3VwJywnRGVza3RvcHMnLCctLWtleScsJ051bWJlcicsJzEnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywncmVjb25maWd1cmUnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9LV2luJywnc2V0Q3VycmVudERlc2t0b3AnLCcxJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZWZmZWN0c1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnZGVza3RvcGdyaWQnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ3NjcmVlbmVkZ2UnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ292ZXJ2aWV3J10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBhZGRpdGlvbmFsIHR0eSdzXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICdzcnZya2V5czpub25lJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsZWFyaW5nIGNsaXBib2FyZCBoaXN0b3J5XCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBnbG9iYWwga2V5Ym9hcmRzaG9ydGN1dHNcIik7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ29yZy5rZGUuS0dsb2JhbEFjY2VsLmJsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ3RydWUnXSk7XG4gICAgICAgIH0sIDIwMDApO1xuICAgIH1cblxuICAgIGlmIChpc0dOT01FKSB7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGVuYWJsaW5nIEdOT01FIHJlc3RyaWN0aW9uc1wiKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2F5bGFuZDogZGlzYWJsZSBWVC9UVFkgc3dpdGNoIChDdHJsK0FsdCtGMS4uRjEyKSB2aWEgbXV0dGVyIGtleWJpbmRpbmdzXG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsICdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBiaW5kaW5nLCBgWycnXWBdKTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2Rjb25mJywgWyd3cml0ZScsIGAvb3JnL2dub21lL211dHRlci93YXlsYW5kL2tleWJpbmRpbmdzLyR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCAnb3ZlcmxheS1rZXknLCBgJydgXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUubXV0dGVyIGR5bmFtaWMtd29ya3NwYWNlcyBmYWxzZScpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2dzZXR0aW5ncyBzZXQgb3JnLmdub21lLmRlc2t0b3Aud20ucHJlZmVyZW5jZXMgbnVtLXdvcmtzcGFjZXMgMScpO1xuICAgICAgICAgICAgLy8gWDExIG9ubHk6IGRpc2FibGUgVFRZIHN3aXRjaCB2aWEgc2V0eGtibWFwIChvbiBXYXlsYW5kIHdlIHJlbHkgb24gbXV0dGVyIGtleWJpbmRpbmdzIGFib3ZlKVxuICAgICAgICAgICAgaWYgKCFwbGF0Zm9ybURpc3BhdGNoZXIuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5zcnZya2V5c05vbmVTZXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdzZXR4a2JtYXAgLW9wdGlvbiBzcnZya2V5czpub25lJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBsb2cud2FybigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKEdOT01FKTogc2V0eGtibWFwIHNydnJrZXlzOm5vbmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCk7IH1cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLWkgL2Rldi9udWxsJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoZ3NldHRpbmdzKTogJHtlcnJ9YCk7IH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIExpbnV4LXNwZWNpZmljIHJlc3RyaWN0aW9ucyBhbmQgcmVzdG9yZSBLREUvR05PTUUgc2V0dGluZ3MuXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnU3RvcmUgLSBzaGFyZWQgc3RvcmUgKGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUpIHtcbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3dsLWNvcHknLCBbJy1jJ10pO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneGNsaXAgLXNlbGVjdGlvbiBjbGlwYm9hcmQnKTtcbiAgICBjaGlsZFByb2Nlc3MuZXhlYygneHNlbCAtYmMnKTtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IGV4ZWMgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0ZG91dC50cmltKCkgPT09ICdLREUnKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAobGludXgpOiBLREUgZGV0ZWN0ZWRcIik7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtsaXBwZXInICwnL2tsaXBwZXInLCAnb3JnLmtkZS5rbGlwcGVyLmtsaXBwZXIuY2xlYXJDbGlwYm9hcmRIaXN0b3J5J10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdibG9ja0dsb2JhbFNob3J0Y3V0cycsICdmYWxzZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicgLCcvQ29tcG9zaXRvcicsICdvcmcua2RlLmt3aW4uQ29tcG9zaXRpbmcucmVzdW1lJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUga2dsb2JhbGFjY2VsNSYnKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJyxgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywnTW9kaWZpZXJPbmx5U2hvcnRjdXRzJywnLS1rZXknLCdNZXRhJywnLS1kZWxldGUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsJ2t3aW5yYycsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wc10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKTtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ2tzdGFydDUgcGxhc21hc2hlbGwgJicsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVdheWxhbmRLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnLCAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJywgYmluZGluZ10pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lU2hlbGxLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLnNoZWxsLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVNdXR0ZXJLZXliaW5kaW5ncykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlci5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lRGFzaFRvRG9ja0tleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwuZXh0ZW5zaW9ucy5kYXNoLXRvLWRvY2snLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXInLCAnb3ZlcmxheS1rZXknXSk7XG4gICAgLy8gcmVzdG9yZSBUVFkgc3dpdGNoIGlmIHdlIGhhZCBkaXNhYmxlZCBpdCB2aWEgc2V0eGtibWFwIChHTk9NRSBYMTEpXG4gICAgaWYgKGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhcInNldHhrYm1hcCAtb3B0aW9uICcnXCIsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGxvZy53YXJuKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHNldHhrYm1hcCByZXN0b3JlIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCA9IGZhbHNlO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogV2luZG93cy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4vKipcbiAqIEVuYWJsZSBXaW5kb3dzLXNwZWNpZmljIHJlc3RyaWN0aW9ucyAoc2hvcnRjdXRzLCBjbG9zZSBhcHBzLCBraWxsIGV4cGxvcmVyKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIG9uZSBtb3JlIGxldmVsIHVwOiByZXN0cmljdGlvbnMvIC0+IHNjcmlwdHMvIC0+IG1haW4vIC0+IHBhY2thZ2VzLyAoc2FtZSB0YXJnZXQgYXMgb3JpZ2luYWwgcGxhdGZvcm1yZXN0cmljdGlvbnMuanMgaW4gc2NyaXB0cy8pXG4gICAgICAgIGNvbnN0IGV4ZWN1dGFibGUxID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9wdWJsaWMvZGlzYWJsZS1zaG9ydGN1dHMuZXhlJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZShleGVjdXRhYmxlMSwgW10sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJywgc2hlbGw6IGZhbHNlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luZG93cyBzaG9ydGN1dHMgZGlzYWJsZWRcIik7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnMgKHdpbiBzaG9ydGN1dHMpOiAke2Vycn1gKTsgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHAgb2YgYXBwc1RvQ2xvc2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRBcHAgPSBhcHAucmVwbGFjZSgvJy9nLCBcIicnXCIpO1xuICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIkYXBwTmFtZSA9ICcke2VzY2FwZWRBcHB9JzsgdHJ5IHsgJHByb2NzID0gR2V0LVByb2Nlc3MgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUgfCBXaGVyZS1PYmplY3QgeyAkXy5Qcm9jZXNzTmFtZSAtaWxpa2UgKCcqJyArICRhcHBOYW1lICsgJyonKSB9OyBpZiAoJHByb2NzIC1hbmQgJHByb2NzLkNvdW50IC1ndCAwKSB7ICRwcm9jcyB8IFN0b3AtUHJvY2VzcyAtRm9yY2UgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWU7IFdyaXRlLU91dHB1dCAna2lsbGVkJyB9IH0gY2F0Y2ggeyB9XCJgO1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmVBcHApID0+IHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkuaW5jbHVkZXMoJ2tpbGxlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCAke2FwcH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlQXBwKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgaWYgKCF3aW5oYW5kbGVyKSB7XG4gICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogd2luaGFuZGxlciBpcyBub3QgcHJvdmlkZWQgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCByZXRyeUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwMDtcbiAgICAgICAgY29uc3Qga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cyA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5oYW5kbGVyLmV4YW13aW5kb3cgJiYgIXdpbmhhbmRsZXIuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygndGFza2tpbGwgL2YgL2ltIGV4cGxvcmVyLmV4ZScsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBleHBsb3Jlci5leGVgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJldHJ5Q291bnQgPCBtYXhSZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgcmV0cnlDb3VudCsrO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoa2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cywgMTAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBleGFtd2luZG93IG5vdCBmb3VuZCBhZnRlciAke21heFJldHJpZXMgKiAxMDB9bXMgLSBza2lwcGluZyBleHBsb3Jlci5leGUga2lsbGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBraWxsRXhwbG9yZXJXaGVuV2luZG93RXhpc3RzKCk7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgV2luZG93cy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHVuYmxvY2sgc2hvcnRjdXRzLCByZXN0YXJ0IGV4cGxvcmVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zKCkge1xuICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiB1bmJsb2NraW5nIHNob3J0Y3V0cy4uLlwiKTtcbiAgICB0cnkge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgdGFza2tpbGwgIC9JTSBcImRpc2FibGUtc2hvcnRjdXRzLmV4ZVwiIC9UIC9GYCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnJvciAmJiBzdGRvdXQpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IGNsb3NlZCBkaXNhYmxlLXNob3J0Y3V0cy5leGVgKTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2tsaXN0IC9GSSBcIklNQUdFTkFNRSBlcSBleHBsb3Jlci5leGVcIicsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgdGFza2xpc3QgZXJyb3I6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMoJ2V4cGxvcmVyLmV4ZScpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKHdpbik6IHJlc3RhcnRpbmcgZXhwbG9yZXIuLi5cIik7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygnc3RhcnQgZXhwbG9yZXIuZXhlJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgICAgIGNoaWxkLnVucmVmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHsgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVyZXN0cmljdGlvbnMgKHdpbiBleHBsb3Jlcik6ICR7ZS5tZXNzYWdlfWApOyB9XG59XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIG1hY09TLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUsIHRvZ2dsZU1hY09TTG9ja2Rvd24pLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgVG91Y2hCYXIsIHN5c3RlbVByZWZlcmVuY2VzLCBwb3dlck1vbml0b3IgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHN0b3JlZCByZWZzIGZvciBjbGVhbnVwIHdoZW4gZGlzYWJsaW5nIG1hY09TIHJlc3RyaWN0aW9uc1xubGV0IHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbmxldCBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbmxldCBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG5cbi8qKiBTaW5nbGUgaGFuZGxlciBmb3IgYWxsIG1hY09TIHJlc3RyaWN0aW9uIHNpZ25hbHM6IGxvZyBhbmQgcmUtZm9jdXMgZXhhbSB3aW5kb3cgLyBpbmZvcm0gdGVhY2hlci4gKi9cbmZ1bmN0aW9uIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoc2lnbmFsTmFtZSkge1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogJHtzaWduYWxOYW1lfSBkZXRlY3RlZGApO1xuICAgIGlmICghY3VycmVudFdpbmhhbmRsZXI/LmV4YW13aW5kb3c/LmlzRGVzdHJveWVkPy4oKSkge1xuICAgICAgICBpZiAoY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50Py5jbGllbnRpbmZvKSBjdXJyZW50V2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBpbmZvcm0gdGhlIHRlYWNoZXJcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7XG4gICAgfVxufVxuXG5jb25zdCBsb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ2xvY2stc2NyZWVuJyk7XG5jb25zdCB1bmxvY2tTY3JlZW5IYW5kbGVyID0gKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgndW5sb2NrLXNjcmVlbicpO1xuXG4vKipcbiAqIEVuYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKFRvdWNoQmFyLCBjbGlwYm9hcmQsIGNsb3NlIGFwcHMsIHdvcmtzcGFjZS9sb2NrIG1vbml0b3JpbmcpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVNYWNSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpIHtcbiAgICBjb25zdCB7IFRvdWNoQmFyTGFiZWwsIFRvdWNoQmFyU3BhY2VyIH0gPSBUb3VjaEJhcjtcbiAgICBjb25zdCB0ZXh0bGFiZWwgPSBuZXcgVG91Y2hCYXJMYWJlbCh7IGxhYmVsOiBcIk5leHQtRXhhbVwiIH0pO1xuICAgIGNvbnN0IHRvdWNoQmFyID0gbmV3IFRvdWNoQmFyKHtcbiAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgIG5ldyBUb3VjaEJhclNwYWNlcih7IHNpemU6ICdmbGV4aWJsZScgfSksXG4gICAgICAgICAgICB0ZXh0bGFiZWwsXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICBdXG4gICAgfSk7XG4gICAgd2luaGFuZGxlci5leGFtd2luZG93Py5zZXRUb3VjaEJhcih0b3VjaEJhcik7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSB3aW5oYW5kbGVyO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3BiY29weSA8IC9kZXYvbnVsbCcpO1xuXG4gICAgYXBwc1RvQ2xvc2UuZm9yRWFjaChhcHAgPT4ge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGtpbGwgLTkgLWYgXCIke2FwcH1cImAsIChlcnJvciwgc3RkZXJyLCBzdGRvdXQpID0+IHt9KTtcbiAgICB9KTtcblxuICAgIC8vIHdvcmtzcGFjZS9zcGFjZSBzd2l0Y2ggYW5kIGxvY2svdW5sb2NrIG1vbml0b3JpbmcgKG1hY09TIG9ubHkpXG4gICAgdHJ5IHtcbiAgICAgICAgd29ya3NwYWNlTm90aWZpY2F0aW9uSWQgPSBzeXN0ZW1QcmVmZXJlbmNlcy5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24oJ05TV29ya3NwYWNlQWN0aXZlU3BhY2VEaWRDaGFuZ2VOb3RpZmljYXRpb24nLCAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdkZXNrdG9wL3NwYWNlIHN3aXRjaCcpKTtcbiAgICB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuXG4gICAgcG93ZXJNb25pdG9yLm9uKCdsb2NrLXNjcmVlbicsIGxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBwb3dlck1vbml0b3Iub24oJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcblxuICAgIGxvZ1N0cmVhbVByb2Nlc3MgPSBzcGF3bignbG9nJywgWydzdHJlYW0nLCAnLS1wcmVkaWNhdGUnLCAnc3Vic3lzdGVtID09IFwiY29tLmFwcGxlLmRvY2tcIiBBTkQgY2F0ZWdvcnkgPT0gXCJtaXNzaW9uY29udHJvbFwiJ10pO1xuICAgIGxvZ1N0cmVhbVByb2Nlc3Muc3Rkb3V0Py5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgIGlmIChkYXRhLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ21vZGUnKSkgb25NYWNSZXN0cmljdGlvblNpZ25hbCgnTWlzc2lvbiBDb250cm9sJyk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogRGlzYWJsZSBtYWNPUy1zcGVjaWZpYyByZXN0cmljdGlvbnMgKHRvdWNoYmFyLCBtb25pdG9yaW5nIGxpc3RlbmVycyBhbmQgbG9nIHByb2Nlc3MpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucygpIHtcbiAgICBjdXJyZW50V2luaGFuZGxlciA9IG51bGw7XG4gICAgaWYgKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkICE9IG51bGwpIHtcbiAgICAgICAgdHJ5IHsgc3lzdGVtUHJlZmVyZW5jZXMudW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24od29ya3NwYWNlTm90aWZpY2F0aW9uSWQpOyB9IGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIG1hYzogdW5zdWJzY3JpYmVXb3Jrc3BhY2VOb3RpZmljYXRpb24nLCBlcnIpOyB9XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gbnVsbDtcbiAgICB9XG4gICAgcG93ZXJNb25pdG9yLm9mZignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9mZigndW5sb2NrLXNjcmVlbicsIHVubG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIGlmIChsb2dTdHJlYW1Qcm9jZXNzKSB7XG4gICAgICAgIGxvZ1N0cmVhbVByb2Nlc3Mua2lsbCgpO1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzID0gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogRGlzYWJsZXMvZW5hYmxlcyBtaXNzaW9uIGNvbnRyb2wsIHNwYWNlcyBhbmQgdHJhY2twYWQgZ2VzdHVyZXMuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAtIHRydWUgcmVzdG9yZXMgZXZlcnl0aGluZywgZmFsc2UgbG9ja3MgZXZlcnl0aGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlTWFjT1NMb2NrZG93bihlbmFibGUpIHtcbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuICAgIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIHRvZ2dsZU1hY09TTG9ja2Rvd246ICR7ZW5hYmxlID8gJ2VuYWJsZScgOiAnZGlzYWJsZSd9IG1pc3Npb24gY29udHJvbCBsb2NrZG93bmApO1xuXG4gICAgY29uc3QgbWNJZHMgPSBbMzIsIDMzLCAzNCwgMzUsIDc5LCA4MCwgODEsIDgyLCAxMTgsIDExOSwgMTIwLCAxMjFdO1xuICAgIGNvbnN0IHBsaXN0UGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3RvcnksICdMaWJyYXJ5L1ByZWZlcmVuY2VzL2NvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMucGxpc3QnKTtcbiAgICBjb25zdCBiYWNrdXBQYXRoID0gam9pbihwbGF0Zm9ybURpc3BhdGNoZXIudGVtcGRpcmVjdG9yeSwgJ25leHRfZXhhbV9ob3RrZXlzX2JhY2t1cC5wbGlzdCcpO1xuXG4gICAgaWYgKGVuYWJsZSkge1xuICAgICAgICBjb25zdCBob3RrZXlDb21tYW5kcyA9IG1jSWRzLm1hcChpZCA9PlxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5zeW1ib2xpY2hvdGtleXMgQXBwbGVTeW1ib2xpY0hvdEtleXMgLWRpY3QtYWRkICR7aWR9IFwiPGRpY3Q+PGtleT5lbmFibGVkPC9rZXk+PGZhbHNlLz48L2RpY3Q+XCJgXG4gICAgICAgICkuam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0Rlc2t0b3BHZXN0dXJlRW5hYmxlZCAtYm9vbCBmYWxzZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbICEgLWYgXCIke2JhY2t1cFBhdGh9XCIgXTsgdGhlbiBjcCBcIiR7cGxpc3RQYXRofVwiIFwiJHtiYWNrdXBQYXRofVwiOyBmaTtcbiAgICAgICAgJHtob3RrZXlDb21tYW5kc307XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuXG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBFbmFibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBnZXN0dXJlQ29tbWFuZHMgPSBbXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd01pc3Npb25Db250cm9sR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWAsXG4gICAgICAgICAgICBgZGVmYXVsdHMgd3JpdGUgY29tLmFwcGxlLmRvY2sgc2hvd0FwcEV4cG9zZUdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgdHJ1ZWBcbiAgICAgICAgXS5qb2luKCc7ICcpO1xuXG4gICAgICAgIGNvbnN0IGZ1bGxDb21tYW5kID0gYFxuICAgICAgICBpZiBbIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gXG4gICAgICAgICAgY3AgXCIke2JhY2t1cFBhdGh9XCIgXCIke3BsaXN0UGF0aH1cIjsgXG4gICAgICAgICAgcm0gXCIke2JhY2t1cFBhdGh9XCI7IFxuICAgICAgICBmaTtcbiAgICAgICAgJHtnZXN0dXJlQ29tbWFuZHN9O1xuICAgICAgICBraWxsYWxsIC05IGNmcHJlZnNkO1xuICAgICAgICBzbGVlcCAxO1xuICAgICAgICAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvU3lzdGVtQWRtaW5pc3RyYXRpb24uZnJhbWV3b3JrL1Jlc291cmNlcy9hY3RpdmF0ZVNldHRpbmdzIC11O1xuICAgICAgICBraWxsYWxsIERvY2tcbiAgICAgIGA7XG4gICAgICAgIGxvZy5pbmZvKCdtYWluIEAgdG9nZ2xlTWFjT1NMb2NrZG93bjogRW5hYmxlIE1pc3Npb25Db250b2wnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoZnVsbENvbW1hbmQsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0xvY2tkb3duIERpc2FibGUgRXJyb3I6JywgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbid1c2Ugc3RyaWN0J1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zLCBlbmFibGVSZXN0cmljdGlvbnN9IGZyb20gJy4vcGxhdGZvcm1yZXN0cmljdGlvbnMuanMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJyBcbmltcG9ydCBhcmNoaXZlciBmcm9tICdhcmNoaXZlcicgICAvLyBkYXMgbWFjaHQga3Jhc3Nlc3RlIHJhY2Vjb2RpdGlvbnMgbWl0IGVsZWN0cm9uIGVpZ2VuZW4gdmVyc2lvbmVuIC0gdW5iZWRpbmd0IGRpZSBzZWxiZSB2ZXJzaW9uIGJlaGFsdGVuIHdpZSBlbGVjdHJvblxuaW1wb3J0IGV4dHJhY3QgZnJvbSAnZXh0cmFjdC16aXAnXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IHNjcmVlbiwgaXBjTWFpbiwgYXBwLCBCcm93c2VyV2luZG93LCB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJ1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9pcGNoYW5kbGVyLmpzJ1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7U2NoZWR1bGVyU2VydmljZX0gZnJvbSAnLi9zY2hlZHVsZXJzZXJ2aWNlLnRzJ1xuaW1wb3J0IFRlc3NlcmFjdCBmcm9tICd0ZXNzZXJhY3QuanMnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0IHNjcmVlbnNob3QgZnJvbSAnc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQnO1xuaW1wb3J0IHsgV29ya2VyIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBydW5SZW1vdGVDaGVjayB9IGZyb20gJy4vcmVtb3RlQ2hlY2suanMnXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyLmpzJztcblxuY29uc3Qgc2hlbGwgPSAoY21kKSA9PiB7ICAgcmV0dXJuIGV4ZWNTeW5jKGNtZCwgeyBlbmNvZGluZzogJ3V0ZjgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSk7IH07ICAvLyBzdGRlcnIgdW50ZXJkclx1MDBGQ2NrdCBcbmNvbnN0IGFnZW50ID0gbmV3IGh0dHBzLkFnZW50KHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9KTtcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7IFxuXG4gLyoqXG4gICogSGFuZGxlcyBpbmZvcm1hdGlvbiBmZXRjaGluZyBmcm9tIHRoZSBzZXJ2ZXIgYW5kIGFjdHMgb24gc3RhdHVzIHVwZGF0ZXNcbiAgKi9cbiBcbiBjbGFzcyBDb21tSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudCA9IG51bGxcbiAgICAgICAgdGhpcy5jb25maWcgPSBudWxsXG4gICAgICAgIHRoaXMudXBkYXRlU3R1ZGVudEludGVydmFsbCA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gZmFsc2VcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwIC8vIHdlIGNvdW50IGZhaWxzIGFuZCBkZWFjdGl2YXRlIG9uIDQgY29uc2VxdWVudCBmYWlsc1xuICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gdHJ1ZVxuICAgICAgICB0aGlzLnRpbWVyID0gMFxuICAgICAgICB0aGlzLndvcmtlciA9IG51bGxcbiAgICAgICAgdGhpcy51c2VXb3JrZXIgPSB0cnVlXG4gICAgICAgIHRoaXMud29ya2VyRmFpbHMgPSAwXG4gICAgfVxuIFxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMucmVxdWVzdFVwZGF0ZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnVwZGF0ZVNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlciA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMuc2VuZFNjcmVlbnNob3QuYmluZCh0aGlzKSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwpXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdGFydCgpXG4gICAgICAgIGlmICghdGhpcy53b3JrZXIgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7ICB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKSAgfVxuICAgIH1cbiBcblxuICAgIC8qKlxuICAgICAqIFNldHVwIHRoZSBpbWFnZSB3b3JrZXJcbiAgICAgKiB1c2VzIGZvcmsgdG8gY3JlYXRlIGEgbmV3IGNoaWxkIHByb2Nlc3NcbiAgICAgKiB1c2VzIHRoZSBpbWFnZVdvcmtlckxpbnV4LmpzIG9yIGltYWdlV29ya2VyU2hhcnAuanMgZmlsZVxuICAgICAqIHRoZSB3b3JrZXIgaXMgdXNlZCB0byBwcm9jZXNzIHRoZSBzY3JlZW5zaG90IGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHNldHVwSW1hZ2VXb3JrZXIoKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlclVSTCA9IHBsYXRmb3JtRGlzcGF0Y2hlci53b3JrZXJVUkw7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyVVJMLCB7IHR5cGU6ICdtb2R1bGUnLCBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYgfSB9KTtcbiAgICAgICAgbG9nLmRlYnVnKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBJbWFnZVdvcmtlciBpbml0aWFsaXplZC4gVXNpbmcgXCIgKyBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyRmlsZU5hbWUpXG4gICAgICAgIFxuXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdlcnJvcicsIGVycm9yID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMud29ya2VyLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyRmFpbHMgKz0gMVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLndvcmtlckZhaWxzID4gNCl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNldHVwSW1hZ2VXb3JrZXI6IFdvcmtlciBmYWlsZWQgNSB0aW1lcyAtIHN3aXRjaGluZyB0byBubyBwcm9jZXNzaW5nJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7IHRoaXMuc2V0dXBJbWFnZVdvcmtlcigpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBzY3JlZW5zaG90IFxuICAgICAqIGlmIHVzZVdvcmtlciBpcyB0cnVlLCB0aGUgc2NyZWVuc2hvdCBpcyBwcm9jZXNzZWQgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICogb3RoZXJ3aXNlIHRoZSBzY3JlZW5zaG90IGlzIG5vdCBwcm9jZXNzZWQgYW5kIHRoZSBvcmlnaW5hbCBzY3JlZW5zaG90IGlzIHJldHVybmVkXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikge1xuICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLndvcmtlcikgeyAvL3RyaXBsZSBjaGVjayBpZiB3b3JrZXIgaXMgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dvcmtlciBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHsgaW1nQnVmZmVyOiBBcnJheS5mcm9tKGltZ0J1ZmZlciksIGltVmVyc2lvbjogcGxhdGZvcm1EaXNwYXRjaGVyLmltVmVyc2lvbiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyLm9uY2UoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmYWxsYmFjayB0byBubyBwcm9jZXNzaW5nICAgXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gQnVmZmVyLmZyb20oaW1nQnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJCYXNlNjQgPSBzY3JlZW5zaG90QmFzZTY0XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBzY3JlZW5zaG90QmFzZTY0OiBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQ6IGhlYWRlckJhc2U2NCwgaXNibGFjazogZmFsc2UsIGltZ0J1ZmZlcjogaW1nQnVmZmVyIH07XG5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuICAgIC8qKiBcbiAgICAgKiBVcGRhdGUgY3VycmVudCBTZXJ2ZXJzdGF0dXMgKyBTdHVkZW50dHN0YXR1cyAoZXZlcnkgNSBzZWNvbmRzKVxuICAgICAqL1xuICAgIGFzeW5jIHJlcXVlc3RVcGRhdGUoKXtcblxuICAgICAgICB0aGlzLnRpbWVyKysgICAvLyB3ZSB1c2UgdGltZXIgdG8gdGltZSBsb29wcyB3aXRoIGRpZmZlcmVudCBpbnRlcnZhbHMgd2l0aG91dCBpbnRyb2R1Y2luZyBuZXcgdW5uZWNjZXNhcnkgc2NoZWR1bGVyc1xuICAgICAgICBpZiAodGhpcy50aW1lciAlIDIwID09PSAwICl7ICAvLyBydW4gZXZlcnkgMjAqNSAodXBkYXRlbG9vcCkgc2Vjb25kc1xuXG4gICAgICAgICAgICBjb25zdCB1c2VzUmVtb3RlQXNzaXN0YW50ID0gYXdhaXQgcnVuUmVtb3RlQ2hlY2socHJvY2Vzcy5wbGF0Zm9ybSlcblxuICAgICAgICAgICAgaWYgKHVzZXNSZW1vdGVBc3Npc3RhbnQpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlYWR5OiBQb3NzaWJsZSByZW1vdGUgYXNzaXN0YW5jZSBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LmtleXdvcmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IEtleXdvcmQgJHtrZXl3b3JkfSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvcnQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5wb3J0cykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBQb3J0ICR7cG9ydH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnQgPSB1c2VzUmVtb3RlQXNzaXN0YW50XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKSAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgc2NyZWVuIHRoYXQgbmVlZHMgdG8gYmUgYmxvY2tlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZCAgbm8gc2VydmVyc2lnbmFsIGZvciAyMCBzZWNvbmRzXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7ICBcbiAgICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IENvbm5lY3Rpb24gdG8gVGVhY2hlciBsb3N0ISBSZW1vdmluZyByZWdpc3RyYXRpb24uXCIpIC8vcmVtb3ZlIHNlcnZlciByZWdpc3RyYXRpb24gbG9jYWxseSAoc2FtZSBhcyAna2ljaycpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSAgIC8vIHRoaXMgYWxzbyByZXNldHMgc2VydmVyaXAgdGhlcmVmb3JlIG5vIGFwaSBjYWxscyBhcmUgbWFkZSBhZnRlcndhcmRzXG4gICAgICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpICAgICAgIC8vIGp1c3QgaW4gY2FzZSBzY3JlZW5zIGFyZSBibG9ja2VkLi4gbGV0IHN0dWRlbnRzIHdvcmtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgXG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7Y2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb31cblxuICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsgdGhyb3cgbmV3IEVycm9yKCdOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgICAgICAoZGF0YS5tZXNzYWdlID09PSBcIm5vdGF2YWlsYWJsZVwiKXsgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogRXhhbSBJbnN0YW5jZSBub3QgZm91bmQhJyk7ICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDU7IH0gICAgLy8gZXhhbSBpbnN0YW5jZSBub3QgYXZhaWxhYmxlIGJ1dCBzZXJ2ZXIgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdGEubWVzc2FnZSA9PT0gXCJyZW1vdmVkXCIpeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogU3R1ZGVudCByZWdpc3RyYXRpb24gbm90IGZvdW5kIScpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoKVxuICAgICAgICAgICAgICAgICAgICB9ICAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIC0gd2UgaGFuZGxlIHRoaXMgZGlmZmVyZW50bHkgbm93LiB0ZWFjaGVyIHN0b3JlcyBcImtpY2tlZFwiIGZvciBzdHVkZW50IHRvIGNvbGxlY3QuIHN0dWRlbnQgaXMgcmVtb3ZlZCBmcm9tIHNlcnZlciB3aGVuIGNvbGxlY3Rpbmcga2lja2VkIGluZm8uIHN0dWRlbnQgY2xvc2VzIGV4YW0gYW5kIGNsZWFucyB1cC5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9IEhlYXJ0YmVhdCBsb3N0Li5gKTsgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7fSAgIC8vIGhlYXJ0YmVhdCBsb3N0IHNlcnZlciBub3QgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwOyAvLyBEaWVzIHpcdTAwRTRobHQgZWJlbmZhbGxzIGFscyBlcmZvbGdyZWljaGVyIEhlYXJ0YmVhdCAtIFZlcmJpbmR1bmcgaGFsdGVuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc2VydmVyc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zdHVkZW50c3RhdHVzKSk7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlclN0YXR1c0RlZXBDb3B5LCBzdHVkZW50U3RhdHVzRGVlcENvcHkpOy8vIFZlcmFyYmVpdHVuZyBkZXIgZW1wZmFuZ2VuZW4gRGF0ZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAoJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0pICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgLy8gcHJldmVudCBmb2N1cyB3YXJuaW5nIGJsb2NrIGlmIG5vIGNvbm5lY3Rpb24gXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gaWYgbm90IGNvbm5lY3RlZCBidXQgc3RpbGwgaW4gZXhhbSBtb2RlIHlvdSBjb3VsZCB0cmlnZ2VyIGEgZm9jdXMgd2FybmluZyBhbmQgbm9ib2R5IGlzIGFibGUgdG8gdW5sb2NrIHlvdVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIGFzeW5jIHNlbmRTY3JlZW5zaG90KCl7XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXtyZXR1cm59ICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjazsgLy8gVmFyaWFibGVuIGF1XHUwMERGZXJoYWxiIGRlcyBpZi1CbG9ja3MgZGVmaW5pZXJlblxuICAgICAgICAgICAgbGV0IGltZ0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIHNjcmVlbnNob3QgZnJvbSBkZXNrdG9wIHZpYSBzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCAoZmxhbWVzaG90LCBpbWFnZW1hZ2ljLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3QoeyBmb3JtYXQ6ICdwbmcnIH0pO1xuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2ssIGltZ0J1ZmZlciB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7ICAvLyBrZWluIGltYWdlQnVmZmVyIG1pdGdlZ2ViZW4gYmVkZXV0ZXQgbnV0emUgc2NyZWVuc2hvdC1kZXNrdG9wIGltIHdvcmtlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcykgeyB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDA7fVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbWFnZSBwcm9jZXNzaW5nIGZhaWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIFwic2NyZWVuc2hvdFwiIGZyb20gYXBwd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Rm9jdXNlZE1pbmRvdyA9IFdpbmRvd0hhbmRsZXIuZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSAgLy9yZXR1cm5zIGV4YW0gd2luZG93IGlmIG5vdGhpbmcgaW4gZm9jdXMgb3IgbWFpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRGb2N1c2VkTWluZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY3VycmVudEZvY3VzZWRNaW5kb3cud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKSAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIHdvcmsgYmVjYXVzZSBpdCdzIG9uYm9hcmQgZWxlY3Ryb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IHJlc3VsdC50b1BORygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgLy8gYXR0ZW50aW9uIHByb2Nlc3NJbWFnZSAgY29udmVydHMgYnVmZmVyIHRvIHVpbnQ4YXJyYXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzICs9MTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IHByb2Nlc3NJbWFnZSBmYWlsZWQ6ICR7ZXJyfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNQUNPUyBXT1JLQVJPVU5EIC0gc3dpdGNoIHRvIHBhZ2VjYXB0dXJlIGlmIG5vIHBlcm1pc3NvbnMgYXJlIGdyYW50ZWRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09IFwiZGFyd2luXCIgJiYgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCAmJiBpbWdCdWZmZXIgIT09IG51bGwpeyAgLy90aGlzIGlzIGZvciBtYWNPUyBiZWNhdXNlIGl0IGRlbGl2ZXJzIGEgYmxhbmsgYmFja2dyb3VuZCBzY3JlZW5zaG90IHdpdGhvdXQgcGVybWlzc2lvbnMuIHdlIGNhdGNoIHRoYXQgY2FzZSB3aXRoIGEgd29ya2Fyb3VuZFxuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSBmYWxzZSAgIC8vbmV2ZXIgZG8gdGhpcyBhZ2FpblxuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGRhdGE6IHsgdGV4dCB9IH0gICA9IGF3YWl0IFRlc3NlcmFjdC5yZWNvZ25pemUoaW1nQnVmZmVyICwgJ2VuZycseyBsYW5nUGF0aDogcHVibGljUGF0aCwgY2FjaGVQYXRoOiB0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5IH0gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFwcFdpbmRvd1Zpc2libGUgPSB0ZXh0LmluY2x1ZGVzKFwiRXhhbVwiKSAgIC8vY2hlY2sgaWYgdGhlIHdvcmQgXCJFeGFtXCIgY2FuIGJlIGZvdW5kIGluIHNjcmVlbnNob3QgLSBvdGhlcndpc2UgaXQgaXMgbW9zdCBsaWtlbHkgYSBibGFuayBkZXNrdG9wIC0gbWFjb3MgcXVpcmtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBXaW5kb3dWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBQbGVhc2UgY2hlY2sgeW91ciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIC0gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogTWFjT1Mgc2NyZWVuc2hvdHBlcm1pc3Npb25zIGNoZWNrIE9LXCIpO31cbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXJyKXsgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nIHdlIGRvIG5vdCBoYXZlIGEgc2NyZWVuc2hvdCAtIHNvIGRvIG5vdCB1cGRhdGUgdGhlIHNlcnZlclxuICAgICAgICAgICAgaWYgKCFzY3JlZW5zaG90QmFzZTY0KXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFNjcmVlbnNob3QgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlYCkgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBQYWdlQ2FwdHVyZSBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gTm8tUHJvY2Vzc2luZ2ApIH0gICBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogbm8gc2NyZWVuc2hvdCBhdmFpbGFibGUgLSBwbGVhc2UgZml4IHlvdXIgc2V0dXBgKSB9XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIC8vZG8gbm90IHJ1biBjb2xvcmNoZWNrIGlmIGFscmVhZHkgbG9ja2VkXG4gICAgICAgICAgICBpZiAoIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMpe1xuICAgICAgICAgICAgICAgIGlmIChpc2JsYWNrKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGZpdCByZXF1aXJlbWVudHMgKGFsbGJsYWNrKVwiKTtcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RoYXNoID0gbnVsbFxuICAgICAgICAgICAgdHJ5IHsgc2NyZWVuc2hvdGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgfSAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IGNyZWF0aW5nIGhhc2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90OiBzY3JlZW5zaG90QmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RoYXNoOiBzY3JlZW5zaG90aGFzaCxcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGhlYWRlckJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90ZmlsZW5hbWU6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gKyBcIi5qcGdcIixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzZW5kIHNjcmVlbnNob3QgdG8gc2VydmVyIHZpYSBlbWFpbCBmZXRjaCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMjtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVzY3JlZW5zaG90YDtcbiAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQsIG1heFJldHJpZXMpOyAvLyBFcnN0ZSBBbmZyYWdlIHN0YXJ0ZW5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG4gICAgZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgPSAwLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogU3RhdHVzIEVycm9yOlwiLCBkYXRhLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgaWYgKGF0dGVtcHQgPCBtYXhSZXRyaWVzIC0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgKyAxLCBtYXhSZXRyaWVzKTsgLy8gUmV0cnlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcyAtIDEgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlIChmZXRjaCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cbiAgICBhc3luYyBraWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKXtcbiAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpY2tTdHVkZW50OiBTdHVkZW50IGdvdCBraWNrZWQgYnkgVGVhY2hlclwiKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlfSAgLy8gZG8gbm90IGRlbGV0ZSBmb2xkZXIgb24gZXhpdCBiZWNhdXNlIHN0dWRlbnQgZ290IGtpY2tlZFxuICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cyAmJiBzdHVkZW50c3RhdHVzLmRlbGZvbGRlcil7IHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPSB0cnVlfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIHJlYWN0IHRvIHNlcnZlciBzdGF0dXMgXG4gICAgICogdGhpcyBjdXJyZW50bHkgb25seSBoYW5kbGUgc3RhcnRleGFtICYgZW5kZXhhbVxuICAgICAqIGNvdWxkIGFsc28gaGFuZGxlIGtpY2ssIGZvY3VzcmVzdG9yZSwgYW5kIGV2ZW4gdHJpZ2dlciBmaWxlIHJlcXVlc3RzXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyc3RhdHVzLCBzdHVkZW50c3RhdHVzKXtcbiAgICAgICBcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBpbmRpdmlkdWFsIHN0YXR1cyB1cGRhdGVzXG5cbiAgICAgICAgaWYgKCBzdHVkZW50c3RhdHVzICYmIE9iamVjdC5rZXlzKHN0dWRlbnRzdGF0dXMpLmxlbmd0aCAhPT0gMCkgeyAgLy8gd2UgaGF2ZSBzdGF0dXMgdXBkYXRlcyAodGFza3MpIC0gZG8gaXQhXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5wcmludGRlbmllZCkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdkZW5pZWQnKSAgIC8vdHJpZ2dlciwgd2h5XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmtpY2tlZCkgeyAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIGJ5IHRlYWNoZXJcbiAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlclwiKVxuICAgICAgICAgICAgICAgIGxldCBkZWxmb2xkZXIgPSB0cnVlXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBcbiAgICAgICAgICAgICAgICAgICAgZGVsZm9sZGVyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycm9yKSAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ2FuIG5vdCBkZWxldGUgZGlyZWN0b3J5IC0gJHtlcnJvcn0gYClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyID09IGZhbHNlKXsgIC8vdHJ5IGRlbGV0aW5nIGZpbGUgYnkgZmlsZSAodGhlIG9uZSB0aGF0IGNhdXNlcyB0aGUgcHJvYmxlbSB3aWxsIHN0YXkgaW4gdGhlIGZvbGRlcilcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkgeyBmcy5ybVN5bmMoZmlsZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBWZXJzdWNoZSwgZGFzIFZlcnplaWNobmlzIHJla3Vyc2l2IHp1IGxcdTAwRjZzY2hlblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZnMudW5saW5rU3luYyhmaWxlUGF0aCk7ICB9Ly8gVmVyc3VjaGUsIGRpZSBEYXRlaSB6dSBsXHUwMEY2c2NoZW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IChkZWxmb2xkZXIpIEZlaGxlciBiZWltIExcdTAwRjZzY2hlbiBkZXIgRGF0ZWkvVmVyemVpY2huaXM6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZm9jdXMgPT0gZmFsc2Upe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiByZXN0b3JpbmcgZm9jdXMgc3RhdGUgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KXsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gdHJ1ZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSBmYWxzZSAgKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSB0cnVlICAvL2NsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2sgd2lsbCBiZSBwdXQgb24gdGhpcy5wcml2YXRlU3BlbGxjaGVjayBpbiBlZGl0b3IgdXBkYXRlZCB2aWEgZmV0Y2hJbmZvKClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBpcGNNYWluLmVtaXQoXCJzdGFydExhbmd1YWdlVG9vbFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSBmYWxzZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSB0cnVlICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogZGUtYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSBmYWxzZSBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5zdWdnZXN0aW9ucyA9IHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuc2VuZGV4YW0gPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEV4YW1Ub1RlYWNoZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZmV0Y2hmaWxlcyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoc3R1ZGVudHN0YXR1cy5maWxlcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdldG1hdGVyaWFscyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdGhpcyBpcyBhbiBtaWNyb3NvZnQzNjUgdGhpbmcuIGNoZWNrIGlmIGV4YW0gbW9kZSBpcyBvZmZpY2UsIGNoZWNrIGlmIHRoaXMgaXMgc2V0IC0gb3RoZXJ3aXNlIGRvIG5vdCBlbnRlciBleGFtbW9kZSAtIGl0IHdpbGwgZmFpbFxuICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIHNoYXJpbmcgbGluayAtIGl0IHdpbGwgYmUgdXNlZCBpbiBcIm1pY3Jvc29mdDM2NVwiIGV4YW0gbW9kZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gc3R1ZGVudHN0YXR1cy5tc29mZmljZXNoYXJlICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIGdyb3VwIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IHN0dWRlbnRzdGF0dXMuZ3JvdXAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIFxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGdsb2JhbCBzdGF0dXMgdXBkYXRlc1xuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIFxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgU1RBUlRcbiAgICAgICAgICogQVRURU5USU9OOiBtb3ZlIHRoaXMgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiAtIGl0IGlzIHRvbyBjb21wbGV4IGFuZCBzaG91bGQgYmUgc3BsaXQgdXBcbiAgICAgICAgICogaW4gdGhlIGZ1dHVyZSB3ZSB3ZWxsIGRldGVybWluZSBpZiBzZWN0aW9uIHN3aXRjaCBpcyBoYW5kbGVkIGJ5IHRoZSB0ZWFjaGVyIG9yIGJ5IHRoZSBzdHVkZW50IGFuZCBhY3QgYWNjb3JkaW5nbHlcbiAgICAgICAgICogaWYgaGFuZGxlZCBieSBzdHVkZW50IHRoZSB0ZWFjaGVyIHN0dHR1cyBpcyBpZ25vcmVkIGFuZCB0aGUgc3dpY2ggc2VjdGlvbiBmdW5jdGlvbiBpcyBjYWxsZWQgZGlyZWN0bHkgKHByb2JhYmx5IG1vdmUgdG8gaXBjaGFuZGxlci5qcylcbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBjdXJyZW50IGFjdGl2ZSBzZWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBvbmUgaW4gdGhlIHNlcnZlcnN0YXR1cyAtIGlmIG5vdCBjaGFuZ2UgdG8gdGhlIG5ldyBzZWN0aW9uXG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNoYW5naW5nIHNlY3Rpb24gdG8gJHtzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbn0gJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZX1gIClcblxuICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TG9ja2VkU2VjdGlvbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbjsgLy8gQ3VycmVudCBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBzYXZpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uOyAvLyBOZXcgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3IgbG9hZGluZylcbiAgICAgICAgICAgICAgICBjb25zdCBleGFtRGlyID0gdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeTtcblxuXG4gICAgICAgICAgICAgICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID09PSBcImVkaXRvclwiKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBzZW5kaW5nIGV4YW0gdG8gdGVhY2hlciAoZmluYWwgc3VibWl0KVwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgY3VycmVudCB3b3JrIGFzIGJhc2U2NCB0byB0ZWFjaGVyIChzdG9yZXMgcGRmIGluIEFCR0FCRSBmb2xkZXIgd2l0aCBzdWJtaXNzaW9uIG51bWJlcilcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBkZiA9IGF3YWl0IHRoaXMuZ2V0QmFzZTY0UERGKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciwgc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tjdXJyZW50TG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWUpICAvLyBsb2NhbCBmdW5jdGlvbiB0byBnZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAocGRmLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQmFzZTY0UERGdG9UZWFjaGVyKHBkZi5iYXNlNjRwZGYsIGN1cnJlbnRMb2NrZWRTZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpIC8vYmFja3VwIGxvY2FsIGZpbGVzIGFuZCBzZW5kIHRvIHRlYWNoZXIgKGFyY2hpdmUgd2l0aCB0aW1lc3RhbXApXG5cblxuICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhhbXR5cGUgaW4gY2xpZW50aW5mb1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbG9ja2VkIHNlY3Rpb24gQUZURVIgc2F2aW5nIHRoZSBvbGQgc3RhdGVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBuZXdMb2NrZWRTZWN0aW9uO1xuXG5cblxuICAgICAgICAgICAgICAgIC8vIE1PVkUgU2VjdGlvbiBGaWxlcyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMTogU0FWRSBDVVJSRU5UIEVYQU1ESVIgRklMRVMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhleGFtRGlyKSAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHsgLy8gQ2hlY2sgaWYgbWFpbiBkaXIgZXhpc3RzIGFuZCBhIHNlY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlUGF0aCA9IGAke2V4YW1EaXJ9LyR7Y3VycmVudExvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzYXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoc2F2ZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAvLyBDcmVhdGUgc2F2ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhleGFtRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gaXRlbXMgaW4gZXhhbURpciB0byBzYXZlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc1NhdmVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob2xkUGF0aCk7IC8vIEdldCBmaWxlIHN0YXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBwcm9jZXNzIGFjdHVhbCBGSUxFUywgbm90IGRpcmVjdG9yaWVzIChsaWtlIHRoZSBzZWN0aW9uIGZvbGRlcnMgdGhlbXNlbHZlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7c2F2ZVBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7IC8vIENvcHkgZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZFBhdGgpOyAvLyBEZWxldGUgb3JpZ2luYWwgZmlsZSBmcm9tIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNTYXZlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgKGZvbGRlcikgaXRlbSAke2ZpbGV9IGluIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IHNhdmVkICR7ZmlsZXNTYXZlZH0gZmlsZXMgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAyOiBMT0FEIEZJTEVTIGZyb20gdGhlIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgTkVXIGxvY2tlZCBzZWN0aW9uIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBuZXdMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRQYXRoID0gYCR7ZXhhbURpcn0vJHtuZXdMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2FkUGF0aCkpIHsgLy8gQ2hlY2sgaWYgdGhlIG5ldyBzZWN0aW9uIGZvbGRlciBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc1RvTG9hZCA9IGZzLnJlYWRkaXJTeW5jKGxvYWRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENvcGllZCBmaWxlICR7ZmlsZX0gZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIGl0ZW0gJHtmaWxlfSBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IG5ld0xvY2tlZFNlY3Rpb24gaXMgZmFsc3kgKCR7bmV3TG9ja2VkU2VjdGlvbn0pLCBza2lwcGluZyBmaWxlIGxvYWRgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3IgZHVyaW5nIGZvbGRlciBvcGVyYXRpb24gLSAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufSwgbmV3TG9ja2VkU2VjdGlvbjogJHtuZXdMb2NrZWRTZWN0aW9ufSwgZXhhbURpcjogJHtleGFtRGlyfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBBY3R1YWxseSBTV0lUQ0ggRVhBTSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBvciByZWxlYWQgdGhlIG5ldyBleGFtIHNlY3Rpb24gaW4gdGhlIHNhbWUgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93IC0gaWYgeW91IGRvbid0IG5leHQtZXhhbSB3aWxsIGNyYXNoIHNpbGVudGx5IG9uIHJlbG9hZCBhbmQgc2VjdGlvbiBzd2l0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKS5mb3JFYWNoKHdjID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgRU5EXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICBcblxuXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrKSB7ICB0aGlzLmFjdGl2YXRlU2NyZWVubG9jaygpIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICkgeyB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgfVxuXG4gICAgICAgIC8vIHNjcmVlbnNob3Qgc2FmZXR5IChPQ1Igc2VhcmNoZXMgZm9yIG5leHQtZXhhbSBzdHJpbmcpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jcikgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSB0cnVlICB9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSBmYWxzZSAgIH1cblxuICAgICAgICAvLyBHcm91cHMgaGFuZGxpbmdcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmdyb3Vwcyl7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZX1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gZmFsc2V9XG5cbiAgICAgICAgLy91cGRhdGUgc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsIHx8IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT09IDApIHsgLy8wIGlzIHRoZSBzYW1lIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCBidXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCAhPT0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGNoYW5nZWQgdG9cIiwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwXG4gICAgICAgICAgICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBkaXNhYmxlZCFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgb2xkIGludGVydmFsIGFuZCBzdGFydCBuZXcgaW50ZXJ2YWwgaWYgc2V0IHRvIHNvbWV0aGluZyBiaWdnZXIgdGhhbiB6ZXJvXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuaW50ZXJ2YWwgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgLy8gcmVtb3ZlIGxvY2tzY3JlZW4gaW1tZWRpYXRlbHkgLSBkb24ndCB3YWl0IGZvciBzZXJ2ZXIgaW5mb1xuICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgXG4gICAgICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBzZW5kIGJhc2U2NCBwZGYgdG8gdGVhY2hlclxuICAgIHNlbmRCYXNlNjRQREZ0b1RlYWNoZXIoYmFzZTY0cGRmLCBzZWN0aW9uPTEpe1xuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcHJpbnRyZXF1ZXN0LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfS8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59YDtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBiYXNlNjRwZGYsXG4gICAgICAgICAgICBwcmludHJlcXVlc3Q6IGZhbHNlLCAgICBcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcixcbiAgICAgICAgICAgIGxvY2tlZHNlY3Rpb246IHNlY3Rpb25cbiAgICAgICAgfVxuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7IHJldHVybiByZXNwb25zZS5qc29uKCk7ICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1lc3NhZ2UgPT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcisrICAgLy8gc3VjY2Vzc2Z1bCBzdWJtaXNzaW9uIC0+IGluY3JlbWVudCBudW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHsgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlZGl0b3IgQCBwcmludGJhc2U2NDpcIixlcnJvci5tZXNzYWdlKSAgICBcbiAgICAgICAgfSk7IFxuICAgIH1cbiAgICBcblxuXG5cbiAgICAvL2dldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgLy8gQVRURU5USU9OOiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGlwY2hhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgc3RvcmVzIGl0IGFzIGZpbGUgaW4gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgYXN5bmMgZ2V0QmFzZTY0UERGKHN1Ym1pc3Npb25udW1iZXIsIHNlY3Rpb25uYW1lLCBwcmludEJhY2tncm91bmQ9ZmFsc2Upe1xuICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBmb3IgYW55IG9uZ29pbmcgcHJpbnQgb3BlcmF0aW9uIHRvIGZpbmlzaCAobWF4IDMwIHNlY29uZHMpXG4gICAgICAgIGxldCB3YWl0Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhXYWl0ID0gMzAwOyAvLyAzMCBzZWNvbmRzIHdpdGggMTAwbXMgaW50ZXJ2YWxzXG4gICAgICAgIHdoaWxlIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgJiYgd2FpdENvdW50IDwgbWF4V2FpdCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApO1xuICAgICAgICAgICAgd2FpdENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBwcmludFRvUERGIGxvY2sgdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIHN0aWxsIHJ1bm5pbmdcIik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiUERGIGdlbmVyYXRpb24gdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIGluIHByb2dyZXNzXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHByaW50QmFja2dyb3VuZCxcbiAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuXG4gIFxuICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3NlY3Rpb25uYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7QWJnYWJlOiAke3N1Ym1pc3Npb25udW1iZXJ9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGVcbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9IC0gVmVyc2lvbiAke3N1Ym1pc3Npb25udW1iZXJ9XCJgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNldCBsb2NrIGJlZm9yZSBzdGFydGluZyBQREYgZ2VuZXJhdGlvblxuICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NHBkZiA9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtiYXNlNjRwZGZ9YDtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIlBERiBnZW5lcmF0ZWRcIiwgZGF0YVVybDpkYXRhVXJsLCBiYXNlNjRwZGY6IGJhc2U2NHBkZiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IEVycm9yIGdlbmVyYXRpbmcgUERGOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXJyb3IgZ2VuZXJhdGluZyBQREZcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIEFsd2F5cyByZWxlYXNlIHRoZSBsb2NrLCBldmVuIGlmIGFuIGVycm9yIG9jY3VycmVkXG4gICAgICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNob3cgdGVtcG9yYXJ5IHNjcmVlbmxvY2sgd2luZG93XG4gICAgYWN0aXZhdGVTY3JlZW5sb2NrKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcbiAgICAgICBcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID09IDApeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IHRydWVcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSAgLy8gYWRkIHNjcmVlbmxvY2sgd2luZG93cyBmb3IgYWRkaXRpb25hbCBkaXNwbGF5c1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSB0ZW1wb3Jhcnkgc2NyZWVubG9ja3dpbmRvd1xuICAgIGtpbGxTY3JlZW5sb2NrKCl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5sb2Nrd2luZG93ICYmICFzY3JlZW5sb2Nrd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lsbFNjcmVlbmxvY2s6IG5vIGZ1bmN0aW9uYWwgc2NyZWVubG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgfSBcbiAgICAgICAgLy8gQ2xlYXIgYXJyYXkgY29tcGxldGVseSBhZnRlciBhdHRlbXB0aW5nIHRvIGRlc3Ryb3kgYWxsIHdpbmRvd3NcbiAgICAgICAgLy8gVGhlIGNsb3NlZCBldmVudCBoYW5kbGVyIHdpbGwgYWxzbyBjbGVhbiB1cCwgYnV0IHRoaXMgZW5zdXJlcyB0aGUgYXJyYXkgaXMgZW1wdHlcbiAgICAgICAgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IGZhbHNlXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTdGFydHMgZXhhbSBtb2RlIGZvciBzdHVkZW50XG4gICAgICogZGVsZXRlcyB3b3JrZm9sZGVyIGNvbnRlbnRzIChpZiBzZXQpXG4gICAgICogb3BlbnMgYSBuZXcgd2luZG93IGluIGtpb3NrIG1vZGUgd2l0aCB0aGUgZ2l2ZW4gZXhhbXR5cGVcbiAgICAgKiBlbmFibGVzIHRoZSBibHVyIGxpc3RlbmVyIGFuZCBhY3RpdmF0ZXMgcmVzdHJpY3Rpb25zIChkaXNhYmxlIGtleWJvYXJzaG9ydGN1dHMgZXRjLilcbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGV4YW1tb2RlLCBleGFtdHlwZSwgYW5kIG90aGVyIHNldHRpbmdzIGZyb20gdGhlIHRlYWNoZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IGRpYWxvZyBpcyBvcGVuIGFuZCBsb2cgd2FybmluZ1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGl0V2FybmluZ09wZW4gfHwgV2luZG93SGFuZGxlci5leGl0UXVlc3Rpb25PcGVuIHx8IFdpbmRvd0hhbmRsZXIubWluaW1pemVXYXJuaW5nT3Blbikge1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogRGlhbG9nIGlzIHN0aWxsIG9wZW4gLSBleGFtIHdpbGwgc3RhcnQgYW55d2F5XCIpXG4gICAgICAgIH1cbiAgXG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICBcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5jbWFyZ2luICAvLyB0aGlzIGlzIHVzZWQgdG8gY29uZmlndXJlIG1hcmdpbiBzZXR0aW5ncyBmb3IgdGhlIGVkaXRvclxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxpbmVzcGFjaW5nID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0ubGluZXNwYWNpbmcgLy8gd2UgdHJ5IHRvIGRvdWJsZSBsaW5lc3BhY2luZyBvbiBkZW1hbmQgaW4gcGRmIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uYXVkaW9SZXBlYXQgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgaWYgKCFXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGNyZWF0aW5nIGV4YW0gd2luZG93XCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBtYW1tb3RoIGZyb20gJ21hbW1vdGgnO1xuXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vdHJheW1lbnUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTmV0d29ya09yUmVzZXQgfSBmcm9tICcuL3Rlc3RwZXJtaXNzaW9uc01hYy5qcyc7XG5pbXBvcnQgeyBnZXRXbGFuSW5mbyB9IGZyb20gJy4vZ2V0d2xhbmluZm8uanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25zdCBjaGVja1BvcnRPcGVuID0gKHBvcnQsIGhvc3QgPSAnMTI3LjAuMC4xJywgdGltZW91dCA9IDE1MDApID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgY29uc3QgZmluaXNoID0gKHJ1bm5pbmcsIGVycm9yID0gbnVsbCkgPT4ge1xuICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHJlc29sdmUoeyBydW5uaW5nLCBwb3J0LCBob3N0LCBlcnJvciB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0LnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdjb25uZWN0JywgKCkgPT4gZmluaXNoKHRydWUpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ3RpbWVvdXQnLCAoKSA9PiBmaW5pc2goZmFsc2UsICd0aW1lb3V0JykpO1xuICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoZXJyKSA9PiBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb2NrZXQuY29ubmVjdChwb3J0LCBob3N0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIElQQyBoYW5kbGluZyAoQmFja2VuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlIC8vIGZsYWcgdG8gcHJldmVudCBjbG9zaW5nIHdpbmRvdyB3aGlsZSBwcmludGluZ1xuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuICAgICAgICBcblxuICAgICAgICBpcGNNYWluLm9uKCdzZXQtbmV3LWxvY2FsZScsIChldmVudCwgbG9jYWxlKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNldC1uZXctbG9jYWxlOiBzZXR0aW5nIG5ldyBsb2NhbGUgdG8gJHtsb2NhbGV9YClcbiAgICAgICAgICAgIGkxOG4ubG9jYWxlID0gbG9jYWxlXG4gICAgICAgICAgICB1cGRhdGVTeXN0ZW1UcmF5KGkxOG4ubG9jYWxlKTtcbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRFeGFtTWF0ZXJpYWxzJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgXG4gICAgICAgICAgICBsZXQgY2xpZW50aW5mbyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm9cbiAgICAgICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBsZXQgc2VydmVyaXAgPSBjbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7IFxuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhhbU1hdGVyaWFscyA9IGZhbHNlXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgICAgICAgICAgZXhhbU1hdGVyaWFscyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZ2V0ZXhhbW1hdGVyaWFscy8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6IHJlY2VpdmVkIGRhdGFcIiwgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogJHtlcnJ9YCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBleGFtTWF0ZXJpYWxzXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICBcbiAgICAgICAgfSkgXG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlc3luZGljYXRpb24uY29tXCIpKSByZXR1cm4gdHJ1ZTsgXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVudGZlcm5lIGFsdGUgTGlzdGVuZXIsIHVtIERvcHBlbC1SZWdpc3RyaWVydW5nZW4genUgdmVybWVpZGVuXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ID0gYWxsb3dlZFVybHMubWFwKHMgPT4gU3RyaW5nKHMpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY2hlY2sgaWYgVVJMIG1hdGNoZXMgYWxsb3dlZCBkb21haW4gKHN1cHBvcnRzIHN1YmRvbWFpbnMgYW5kIHBhdGhzKVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHRhcmdldFVybCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBjb21tb24gZXhjZXB0aW9ucyBmaXJzdFxuICAgICAgICAgICAgICAgIGlmIChjaGVja0NvbW1vbkV4Y2VwdGlvbnModXJsU3RyKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZWFjaCBhbGxvd2VkIFVSTFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWxsb3dlZFVybCBvZiBhbGxvdykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHBhcnNlIGFzIFVSTCB0byBleHRyYWN0IGhvc3RuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRIb3N0bmFtZSA9IHVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBhbGxvd2VkIFVSTCB0byBleHRyYWN0IGRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRVcmxPYmogPSBuZXcgVVJMKGFsbG93ZWRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbG93ZWRVcmwuaW5jbHVkZXMoJy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3MgYSBwYXRoIHdpdGhvdXQgcHJvdG9jb2wsIGV4dHJhY3QgZG9tYWluIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGFsbG93ZWRVcmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkRG9tYWluID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhhY3QgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGFsbG93ZWREb21haW4gaXMgYSBzcGVjaWZpYyBzdWJkb21haW4gKGNvbnRhaW5zIGRvdHMpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NwZWNpZmljU3ViZG9tYWluID0gYWxsb3dlZERvbWFpbi5pbmNsdWRlcygnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGVjaWZpY1N1YmRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgc3BlY2lmaWMgc3ViZG9tYWluIGlzIHNwZWNpZmllZCwgb25seSBhbGxvdyB0aGF0IGV4YWN0IHN1YmRvbWFpbiBhbmQgd3d3LiB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBhbGxvdyBvdGhlciBzdWJkb21haW5zIHdoZW4gYSBzcGVjaWZpYyBvbmUgaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIG9ubHkgYmFzZSBkb21haW4gaXMgc3BlY2lmaWVkIChlLmcuLCBcIm9yZi5hdFwiKSwgYWxsb3cgYWxsIHN1YmRvbWFpbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyB3d3cuIHN1YmRvbWFpbiBleHBsaWNpdGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBvdGhlciBzdWJkb21haW5zIChlLmcuLCBzdWIuZHVkZW4uZGUgaWYgZHVkZW4uZGUgaXMgYWxsb3dlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUuZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gdGFyZ2V0SG9zdG5hbWUuc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgcHJlZml4OiBtdXN0IGJlIHZhbGlkIHN1YmRvbWFpbiBuYW1lIChhbHBoYW51bWVyaWMgYW5kIGh5cGhlbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgVVJMIHBhcnNpbmcgZmFpbHMsIGZhbGwgYmFjayB0byBzaW1wbGUgaW5jbHVkZXMgY2hlY2sgZm9yIHBhdGhzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsU3RyLmluY2x1ZGVzKGFsbG93ZWRVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmIChpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBhbGxvd2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmICghaXNBbGxvd2VkKSB7IFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFVuaWZpZWQgSVBDIGhhbmRsZXIgZm9yIHdlYnZpZXcgYmxvY2tpbmcgLSBzdXBwb3J0cyB3ZWJzaXRlLCBlZHV2aWR1YWwsIGZvcm1zLCByZHAgbW9kZXNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZSwgYWxsb3dlZERvbWFpbiwgYmFzZVVybCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIHRvIHByZXZlbnQgZHVwbGljYXRlIHJlZ2lzdHJhdGlvbnNcbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVUkwgdmFsaWRhdGlvbiBmdW5jdGlvbiAtIGRpZmZlcmVudCBsb2dpYyBiYXNlZCBvbiBtb2RlXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdFQlNJVEUgbW9kZTogY2hlY2sgZG9tYWluIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsIHx8IHRhcmdldFVybC5pbmNsdWRlcyhiYXNlVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG9tYWluID0gdXJsT2JqLmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4cGxpY2l0bHkgYWxsb3cgd3d3LiBzdWJkb21haW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbi5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGRvbWFpbi5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVEVVZJRFVBTC9NT09ETEUgbW9kZTogY2hlY2sgbW9vZGxlVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vb2RsZS1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJzdGFydGF0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInByb2Nlc3NhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJlZHV2aWR1YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ0aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZm9ybXNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBGT1JNUyBtb2RlOiBjaGVjayBnZm9ybXNUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEZvcm1zLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJmb3JtUmVzcG9uc2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJyZHBcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSRFAgbW9kZTogYWxsb3cgYWxsIChvciBpbXBsZW1lbnQgc3BlY2lmaWMgbG9naWMgaWYgbmVlZGVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBtb2RlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hlY2tDb21tb25FeGNlcHRpb25zKHRhcmdldFVybCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0PVwiX2JsYW5rXCIgbGlua3MgYW5kIHdpbmRvdy5vcGVuIC0gYmxvY2sgQkVGT1JFIG5hdmlnYXRpb25cbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgd2lsbC1uYXZpZ2F0ZSBvbiB3ZWJDb250ZW50cyBsZXZlbCAtIHRoaXMgZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEJsb2NrIG5hdmlnYXRpb24gY29tcGxldGVseSAtIHRoaXMgaGFwcGVucyBCRUZPUkUgcGFnZSBsb2Fkc1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7IC8vIFN0b3AgYW55IGxvYWRpbmcgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbGlhcyBmb3IgZWR1dmlkdWFsIG1vZGUgLSByZWRpcmVjdHMgdG8gdW5pZmllZCBoYW5kbGVyXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3ItZWR1dmlkdWFsLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSkgPT4ge1xuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgdW5pZmllZCBoYW5kbGVyIHdpdGggZWR1dmlkdWFsIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IHVuaWZpZWRIYW5kbGVyID0gaXBjTWFpbi5saXN0ZW5lcnMoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnKVswXTtcbiAgICAgICAgICAgIGlmICh1bmlmaWVkSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmlmaWVkSGFuZGxlcihldmVudCwgeyBndWVzdElkLCBtb2RlOiAnZWR1dmlkdWFsJywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWxvYWQgdGhlIGJyb3dzZXIgdmlld1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3JlbG9hZC1icm93c2VyLXZpZXcnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsKTtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBsYW5ndWFnZVRvb2wgQVBJIFNlcnZlciAod2l0aCBKYXZhIEpSRSlcbiAgICAgICAgICogUnVucyBhdCBsb2NhbGhvc3QgODA4OFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdGl2YXRlIHNwZWxsY2hlY2sgb24gZGVtYW5kIGZvciBzcGVjaWZpYyBzdHVkZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIExhbmd1YWdlVG9vbCBzZXJ2ZXIgcmVzcG9uZHMgb24gY29uZmlndXJlZCBwb3J0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2lzTGFuZ3VhZ2VUb29sUnVubmluZycsIGFzeW5jICgpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gbGFuZ3VhZ2VUb29sU2VydmVyLnBvcnQgfHwgODA4ODtcbiAgICAgICAgICAgIGNvbnN0IGhvc3RzID0gWycxMjcuMC4wLjEnLCAnOjoxJywgJ2xvY2FsaG9zdCddO1xuICAgICAgICAgICAgLy8gUnVuIGFsbCBjaGVja3MgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZSwgdXNlIGxvbmdlciB0aW1lb3V0IGZvciBzZXJ2ZXIgc3RhcnR1cCBkZXRlY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChob3N0cy5tYXAoaG9zdCA9PiBjaGVja1BvcnRPcGVuKHBvcnQsIGhvc3QsIDI1MDApKSk7XG4gICAgICAgICAgICAvLyBSZXR1cm4gZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHQsIG9yIGxhc3QgcmVzdWx0IGlmIG5vbmUgc3VjY2VlZGVkXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzUmVzdWx0ID0gcmVzdWx0cy5maW5kKHJlc3VsdCA9PiByZXN1bHQucnVubmluZyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCB8fCByZXN1bHRzW3Jlc3VsdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBMT0NBTCBMb2NrZG93blxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9jYWxsb2NrZG93bicsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9jYWxsb2NrZG93bjogbG9ja2luZyBkb3duIGNsaWVudCB3aXRob3V0IHRlYWNoZXIgY29ubmVjdGlvblwiKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge1xuICAgICAgICAgICAgICAgIGV4YW1tb2RlOiB0cnVlLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGVsZm9sZGVyb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiAnZGUtREUnLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0VHlwZTogJycsXG4gICAgICAgICAgICAgICAgbW9vZGxlRG9tYWluOiAnJyxcbiBcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDAsXG4gICAgICAgICAgICAgICAgbXNPZmZpY2VGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zbG9ja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwaW46ICcwMDAwJyxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVubG9ja29uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZm9udGZhbWlseTogJ3NhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RJZDogJycsXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXJncy5wYXNzd29yZCxcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVzZUV4YW1TZWN0aW9uczogZmFsc2UsIC8vaWYgZmFsc2UgZXhhbSBzZWN0aW9uIDEgaXMgdXNlZCBhbmQgbm8gdGFicyBhcmUgZGlzcGxheWVkXG4gICAgICAgICAgICAgICAgYWN0aXZlU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBsb2NrZWRTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGV4YW1TZWN0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAxOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtdHlwZTogYXJncy5leGFtbW9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNtYXJnaW46IHsgc2lkZTogJ3JpZ2h0Jywgc2l6ZTogMyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXNwYWNpbmc6ICcyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvUmVwZWF0OiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBhcmdzLmxhbmd1YWdldG9vbCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiBhcmdzLnNwZWxsY2hlY2tsYW5nIHx8ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogYXJncy5zdWdnZXN0aW9ucyB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBhcmdzLmNsaWVudG5hbWU7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gXCIxMjcuMC4wLjFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IFwibG9jYWxob3N0XCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IFwiYVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gdHJ1ZTsgLy8gdGhpcyBtdXN0IGJlIHNldCB0byB0cnVlIGluIG9yZGVyIHRvIHN0b3AgdHlwaWNhbCBuZXh0LWV4YW0gY2xpZW50L3RlYWNoZXIgYWN0aW9uc1xuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGxvY2FsbG9ja2Rvd25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHZpcnR1YWxpemVkIHN0YXR1c1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ZpcnR1YWxpemVkJywgKCkgPT4geyAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IHRydWU7IH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBGT0NVUyBzdGF0ZSB0byBmYWxzZSAobW91c2UgbGVmdCBleGFtIHdpbmRvdylcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZm9jdXNsb3N0JywgKGV2ZW50LCBjdHJsYWx0PWZhbHNlKSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFuc3dlciA9IGZhbHNlIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8ICF0aGlzLm11bHRpY2FzdENsaWVudC5leGFtbW9kZSkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWV9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID4gMCkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCAmJiBjdHJsYWx0ID09IGZhbHNlKXsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBmb2N1c2xvc3Q6IG1vdXNlbGVhdmUgZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBibG9jayBldmVyeXRoaW5nIGFuZCBpbmZvcm0gdGVhY2hlciAgKHByb2JhYmx5IGFuIG92ZXJraWxsIG9uIG1vdXNlbGVhdmUgLSBuZWVkcyB0ZXN0aW5nKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBhbnN3ZXJcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBtYWluIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29uZmlnICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIFVubG9jayBDb21wdXRlclxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ3JhY2VmdWxseWV4aXQnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ3JhY2VmdWxseWV4aXQ6IGdyYWNlZnVsbHkgbGVhdmluZyBsb2NrZWQgZXhhbSBtb2RlYClcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5ncmFjZWZ1bGx5RW5kRXhhbSgpIFxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgfSApXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogc3RvcCByZXN0cmljdGlvbnNcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RyaWN0aW9ucycsICgpID0+IHsgIFxuICAgICAgICAgICAgLy90aGlzIGFsc28gc3RvcHMgdGhlIGNsZWFyQ2xpcGJvYXJkIGludGVydmFsXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSBcbiAgICAgICAgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBjb3B5IHRvIGdsb2JhbCBjbGlwYm9hcmRcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NsaXBib2FyZCcsIChldmVudCwgdGV4dCkgPT4geyAgXG4gICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGxldCBhZGRyZXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkgeyAgICBhZGRyZXNzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogbXVsdGljYXN0Y2xpZW50IG5vdCBydW5uaW5nXCIpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMgYmVyZWl0cyBlaW5lIEFkcmVzc2Ugdm9yaGFuZGVuIGlzdCwgbGllZmVybiB3aXIgc2llIHp1clx1MDBGQ2NrLlxuICAgICAgICAgICAgaWYgKGFkZHJlc3MpIHsgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7ICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcnN1Y2hlLCBhbiBkaWUga29ycmVrdGUgU2Nobml0dHN0ZWxsZSB6dSBiaW5kZW5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRmFsbHMgZ2F0ZXdheTRzeW5jKCkgYmxvY2tpZXJlbmQgaXN0LCBrYW5uc3QgZHUgZGllc2VuIEF1ZnJ1ZiBpbiBlaW4gUHJvbWlzZSBwYWNrZW46XG4gICAgICAgICAgICAgICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlIH0gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnYXRld2F5NHN5bmMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHsgIHJlamVjdChlcnIpOyAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKTsgLy8gTGllZmVydCBkaWUgSVAgZGVyIFNjaG5pdHRzdGVsbGUsIHdlbGNoZSBkYXMgRGVmYXVsdCBHYXRld2F5IGhhdFxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGtlaW5lIElQIChtaXQgR2F0ZXdheSkgdmVyZlx1MDBGQ2diYXIgaXN0LCBob2xlIGVpbmUgYWx0ZXJuYXRpdmUgQWRyZXNzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCk7IC8vIExpZWZlcnQgYXVjaCBlaW5lIElQLCB3ZW5uIGtlaW4gR2F0ZXdheSB2ZXJmXHUwMEZDZ2JhciBpc3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJmXHUwMEU0bHNjaHRlIEFkcmVzc2VuICh6LiBCLiBsb2NhbGhvc3QpIGlnbm9yaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT09IFwiMTI3LjAuMC4xXCIpIHsgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7ICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBXZW5uIGRpZSBNdWx0aWNhc3QtQ2xpZW50IG5pY2h0IGxcdTAwRTR1ZnQsIGluaXRpYWxpc2llcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmICFhZGRyZXNzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmFsbHMgaW5pdCgpIGFzeW5jaHJvbiB1bWdlc2V0enQgd2VyZGVuIGthbm4sIHdhcnRlbiB3aXIgaGllciBkYXJhdWYuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBFcnJvciBpbml0aWFsaXppbmcgbXVsdGljYXN0IGNsaWVudFwiLCBlcnIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIGVkaXRvciBhcyBodG1sIGZpbGUgLSBhcyBiYWNrdXAgLSBvbmx5IHRyaWdnZXJlZCBieSB0aGUgdGVhY2hlciBmb3Igbm93IChhbGxvdyBtYW51YWwgYmFja3VwICEhKVxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAge2NsaWVudG5hbWU6dGhpcy5jbGllbnRuYW1lLCBmaWxlbmFtZTpgJHtmaWxlbmFtZX0uaHRtbGAsIGVkaXRvcmNvbnRlbnQ6IGVkaXRvcmNvbnRlbnQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVIVE1MJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBodG1sQ29udGVudCA9IGFyZ3MuZWRpdG9yY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBsZXQgaHRtbGZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSl7XG4gICAgICAgICAgICAgICAgaHRtbGZpbGVuYW1lID0gYCR7ZmlsZW5hbWV9LmJha2BcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaHRtbGZpbGUgPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgaHRtbGZpbGVuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGh0bWxDb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGh0bWxmaWxlLCBodG1sQ29udGVudCwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6ICR7ZXJyLm1lc3NhZ2V9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsdGVybmF0ZXBhdGggPSBgJHtodG1sZmlsZX0tJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufS5iYWtgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiB0cnlpbmcgdG8gd3JpdGUgZmlsZSBhczpcIiwgYWx0ZXJuYXRlcGF0aCApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGh0bWxDb250ZW50LCBmdW5jdGlvbiAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGJhc2U2NCBlbmNvZGVkIHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQREZiYXNlNjQnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldFBERmJhc2U2NDogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciA9IGFyZ3Muc3VibWlzc2lvbm51bWJlcisxIC8vIGNsaWVudGluZm8ga2VlcHMgdHJhY2sgb2Ygc3VibWlzc2lvbnMgZm9yIGF1dG9tYXRlZCBzdWJtaXNzaW9ubnVtYmVycyBhdCBzZWN0aW9uIGNoYW5nZSAtIGJ1dCB0aGlzIG9idmlvdXNseSBoYXBwZW5zIGFmdGVyIG1hbnVhbCBzdWJtaXRcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdldEJhc2U2NFBERihhcmdzLnN1Ym1pc3Npb25udW1iZXIsIGFyZ3Muc2VjdGlvbm5hbWUsIGFyZ3MucHJpbnRCYWNrZ3JvdW5kKSAgIC8vIHdoeSB0aGUgaGVsbCBpcyB0aGlzIGZ1bmN0aW9uIGxvY2F0ZWQgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgYW5kIG5vdCBpbiBpcGNoYW5kbGVyLmpzID8gRklYTUUgIVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgdGhlIEV4YW1XaW5kb3cgY29udGVudCBhcyBQREZcbiAgICAgICAgICogQVRURU5USU9OIHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgcmV0dW5zIGEgYmFzZTY0IHZlcnNpb24gb2YgdGhlIHBkZlxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ByaW50cGRmJywgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgLy8gZG8gbm90IHByaW50IGlmIGV4YW0gbW9kZSBpcyBub3QgYWN0aXZlIGFueW1vcmVcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZXhhbW1vZGUgaXMgZmFsc2UgLSBza2lwcGluZyBwcmludFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogcHJpbnQgYWxyZWFkeSBpbiBwcm9ncmVzcyAtIHNraXBwaW5nIG5ldyByZXF1ZXN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgLy8gZGVmaW5lIHByaW50IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBhcmdzLmxhbmRzY2FwZSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuICAgICAgICAgICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHthcmdzLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke2FyZ3MuY2xpZW50bmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHBkZmZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5wZGZgICAvLyBkZWZhdWx0IGZpbGVuYW1lID0gY2xpZW50bmFtZS5wZGZcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5maWxlbmFtZSl7ICAvLyBpbiBjYXNlIG9mIG1hbnVhbCBiYWNrdXAgdGhlIHVzZXIgY2FuIHNldCBhIGN1c3RvbSBmaWxlbmFtZVxuICAgICAgICAgICAgICAgICAgICBwZGZmaWxlbmFtZSA9IGAke2FyZ3MuZmlsZW5hbWV9LnBkZmBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZmZpbGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHBkZmZpbGVuYW1lKTsgIC8vIHBhdGggcG9pbnRzIHRvIHRoZSBjdXJyZW50IGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tYXV4LnBkZmAgICAgLy90aG9tYXMucGRmLWF1eC5wZGYgXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tb2xkLnBkZmA7ICAgLy90aG9tYXMucGRmLW9sZC5wZGZcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWZpbGVuYW1lKTsgIC8vIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nIHdlIHRyeSB0byB3cml0ZSBhIGRpZmZlcmVudCBmaWxlXG5cblxuICAgICAgICAgICAgICAgIC8vIGF1eCBmaWxlcyBhcmUgZmlsZXMgY3JlYXRlZCBpZiB0aGUgbWFpbiBwZGZmaWxlcGF0aCBpcyBub3Qgd3JpdGVhYmxlIChvcGVuZWQgb24gd2luZG93cykgXG4gICAgICAgICAgICAgICAgdHJ5IHsgIC8vIGFsd2F5cyBjaGVjayBmb3Igb2xkIGF1eCBmaWxlcyBhbmQgcmVuYW1lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBhbHRlcm5hdGVmaWxlbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoYWx0ZXJuYXRlcGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbVdpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICAgICAgY29uc3Qgd2ViQ29udGVudHMgPSBleGFtV2luZG93Py53ZWJDb250ZW50c1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3ZWJDb250ZW50cyl7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogbm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGUgZm9yIFBERiBtZXRhZGF0YVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZlRpdGxlID0gYXJncy5maWxlbmFtZSA/IGFyZ3MuZmlsZW5hbWUgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHthcmdzLnNlcnZlcm5hbWUgfHwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lIHx8ICcnfWBcbiAgICAgICAgICAgICAgICAvLyBlc2NhcGUgcXVvdGVzIGFuZCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIEphdmFTY3JpcHQgc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZFRpdGxlID0gcGRmVGl0bGUucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke2VzY2FwZWRUaXRsZX1cImApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcmludCB0aGUgZXhhbSB3aW5kb3cgdG8gcGRmXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgfSkudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgcGRmIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKHBkZmZpbGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKHBkZmZpbGVwYXRoKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUocGRmZmlsZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX0gLSB3cml0aW5nIGZpbGUgYXM6ICR7YWx0ZXJuYXRlcGF0aH0gYCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIGF1eCBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0ZXBhdGgpKSB7IGZzLnVubGlua1N5bmMoYWx0ZXJuYXRlcGF0aCk7IH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGYgKGFsdGVybmF0aXZlciBQZmFkKTogJHtlcnIubWVzc2FnZX1gKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGFsdGVybmF0ZSBwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKSAgIC8vbWFrZSBzdXJlIHN0dWRlbnRzIHNlZSB0aGUgbmV3IGZpbGUgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVycm9yLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlcyBBY3RpdmUgU2hlZXRzIGZvcm0gZGF0YSB0byAuYmFrIGZpbGVcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3NhdmVBY3RpdmVzaGVldHNCYWsnLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lID8gYCR7YXJncy5maWxlbmFtZX0uYmFrYCA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBiYWtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBmb3JtRGF0YSB0byBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25EYXRhID0gSlNPTi5zdHJpbmdpZnkoYXJncy5mb3JtRGF0YSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gLmJhayBmaWxlXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYWtGaWxlUGF0aCwganNvbkRhdGEsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiBzYXZlZCBmb3JtIGRhdGEgdG8gJHtiYWtGaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0JhazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgZm91bmQgU2VydmVycyBhbmQgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGluZm9hc3luYycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IGZhbHNlICAgXG4gICAgICAgICAgICAvLyBzZXJ2ZXJzdGF0dXMgb2JqZWt0IHdpcmQgbnVyIGJlaSBiZWdpbm4gZGVzIGV4YW1zIGFuIGRhcyBleGFtIHdpbmRvdyBkdXJjaGdlcmVpY2h0IGZcdTAwRkNyIGJhc2lzIGVpbnN0ZWxsdW5nZW5cbiAgICAgICAgICAgIC8vIGFsbGUgd2VpdGVyZW4gdXBkYXRlcyBcdTAwRkNiZXIgZGFzIHNlcnZlcnN0YXR1cyBvYmplY3Qgd2VyZGVuIGltIGNvbW11bmljYXRpb24gaGFuZGxlciBnZWxlc2VuIHVuZCBnZ2YuIGF1ZiBkYXMgY2xpZW50aW5mbyBvYmplY3QgZ2VsZWd0XG4gICAgICAgICAgICAvLyBkaWVzZXIga29tbXVuaWthdGlvbnNmbHVzcyBtdXNzIGluIDIuMCBnZXN0cmVhbWxpbmVkIHdlcmRlbiAjRklYTUVcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNlcnZlcnN0YXR1cyB9XG5cbiAgICAgICAgICAgIC8vY291bnQgbnVtYmVyIG9mIGZpbGVzIGluIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAvLyBlcnN0ZWxsdCBmYWxscyBuXHUwMEY2dGlnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVsaXN0ID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgcmV0dXJuIHsgICBcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsaXN0OiB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCxcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYmVjYXVzZSBvZiBtaWNyb3NvZnQgMzY1IHdlIG5lZWQgdG8gd29yayB3aXRoIFwiQnJvd3NlclZpZXdcIiBcbiAgICAgICAgICogaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBkaXNsYXkgZnVsbHNjcmVlbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBFeGFtIGhlYWRlciB3ZSB0ZW1wb3JhcmlseSBjb2xsYXBzZSB0aGUgQnJvd3NlclZpZXcgZm9yIE9mZmljZVxuICAgICAgICAgKiBhbmQgcmVzdG9yZSBpdCBhZnRlcndhcmRzIC0gbm90IHBlcmZlY3QgYnV0IGxvb2tzIG9rXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY29sbGFwc2UtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7IHg6IDAsIHk6IDAsIHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RvcmUtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IG1lbnVIZWlnaHQgPSBtYWluV2luZG93Lm1lbnVIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpOyAvLyBHZXQgdGhlIGN1cnJlbnQgYm91bmRzIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5ldyBib3VuZHMgb2YgdGhlIGNvbnRlbnRWaWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogbWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLCAvLyBmdWxsIHdpZHRoIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gbWVudUhlaWdodCAvLyByZW1haW5pbmcgaGVpZ2h0IGFmdGVyIHRoZSBtZW51XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZSBtZW51IGhlaWdodCBkeW5hbWljYWxseSB3aGVuIGhlYWRlciBjb250ZW50IGNoYW5nZXNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3VwZGF0ZS1tZW51LWhlaWdodCcsIChldmVudCwgaGVpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3c7XG4gICAgICAgICAgICBpZiAobWFpbldpbmRvdyAmJiBoZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBzdG9yZWQgbWVudSBoZWlnaHRcbiAgICAgICAgICAgICAgICBtYWluV2luZG93Lm1lbnVIZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVwb3NpdGlvbiB0aGUgYnJvd3NlciB2aWV3IHdpdGggbmV3IGhlaWdodFxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50Vmlldykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlbmRzIGEgcmVnaXN0ZXIgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gc2VydmVyIGlwXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICBjbGllbnRuYW1lOnRoaXMudXNlcm5hbWUsIHNlcnZlcm5hbWU6c2VydmVybmFtZSwgc2VydmVyaXAsIHNlcnZlcmlwLCBwaW46dGhpcy5waW5jb2RlIFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigncmVnaXN0ZXInLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSBhcmdzLmNsaWVudG5hbWVcbiAgICAgICAgICAgIGNvbnN0IHBpbiA9IGFyZ3MucGluXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJpcCA9IGFyZ3Muc2VydmVyaXBcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudGlwID0gaXAuYWRkcmVzcygpXG4gICAgICAgICAgICBjb25zdCBob3N0bmFtZSA9IG9zLmhvc3RuYW1lKClcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmNvbmZpZy52ZXJzaW9uXG4gICAgICAgICAgICBjb25zdCBiaXB1c2VySUQgPSBhcmdzLmJpcHVzZXJJRFxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7IC8vI0ZJWE1FIGRhcyBzb2xsdGUgZWlnZW50bGljaCB2b20gc2VydmVyIGtvbW1lbiBcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3JlZ2lzdGVyY2xpZW50LyR7c2VydmVybmFtZX0vJHtwaW59LyR7Y2xpZW50bmFtZX0vJHtjbGllbnRpcH0vJHtob3N0bmFtZX0vJHt2ZXJzaW9ufS8ke2JpcHVzZXJJRH1gO1xuICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gQWJvcnRTaWduYWwudGltZW91dCg4MDAwKTsgLy8gODAwMCBNaWxsaXNla3VuZGVuID0gOCBTZWt1bmRlbiBBYm9ydFNpZ25hbCBtaXQgZWluZW0gVGltZW91dFxuXG5cbiAgICAgICAgICAgIGZldGNoKHVybCwgeyBtZXRob2Q6ICdHRVQnLCBzaWduYWwgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PSBcInN1Y2Nlc3NcIikgeyAgLy8gcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWxsIG90aGVyd2lzZSBkYXRhIHdvdWxkIGJlIFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAvLyBFcmZvbGdyZWljaGUgUmVnaXN0cmllcnVuZ1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBjbGllbnRuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gc2VydmVyaXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IHNlcnZlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBjbGllbnRpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZGF0YS50b2tlbjsgLy8gd2UgbmVlZCB0byBzdG9yZSB0aGUgY2xpZW50IHRva2VuIGluIG9yZGVyIHRvIGNoZWNrIGFnYWluc3QgaXQgYmVmb3JlIHByb2Nlc3NpbmcgY3JpdGljYWwgYXBpIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IHBpbjtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCByZWdpc3Rlcjogc3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgYXQgJHtzZXJ2ZXJuYW1lfSBAICR7c2VydmVyaXB9IGFzICR7Y2xpZW50bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBkYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGV4YW0gZm9sZGVyIGluIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHVuaXF1ZWV4YW1OYW1lID0gYCR7c2VydmVybmFtZX0tJHtwaW59YFxuICAgICAgICAgICAgICAgICAgICBjb25maWcuZXhhbWRpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgdW5pcXVlZXhhbU5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudmVyc2lvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHZlcnNpb25zIGFuZCBkaXNwbGF5IG1lc3NhZ2UgKHRlYWNoZXIgbmVlZHMgdXBncmFkZS4uIGNsaWVudCBuZWVkcyB1cGdyYWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcGFyaXNvblJlc3VsdCA9IHRoaXMuY29tcGFyZVNvZnR3YXJlKGNvbmZpZy52ZXJzaW9uLCBjb25maWcuaW5mbyAsIGRhdGEudmVyc2lvbiwgZGF0YS52ZXJzaW9uaW5mbyApIC8vc2VydmVyVmVyc2lvbiwgc2VydmVyU3RhdHVzLCBsb2NhbFZlcnNpb24sIGxvY2FsU3RhdHVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHsgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCBuZXVlciBhbHMgZGllIGRlciBMZWhycGVyc29uIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IHp1IGFsdC4gTGFkZW4gc2llIHNpY2ggZWluZSBha3R1ZWxsZSBWZXJzaW9uIGhlcnVudGVyIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW5iZWthbm50ZXIgRmVobGVyIGJlaW0gVmVyYmluZHVuZ3NhdWZiYXUuXCIgfTsgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChhc3luYyBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmVobGVyYmVoYW5kbHVuZ1xuICAgICAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHsgZXJyb3JNZXNzYWdlID0gXCJUaGUgcmVxdWVzdCB0aW1lZCBvdXRcIjsgICB9IC8vIFRpbWVvdXQtTmFjaHJpY2h0IGFucGFzc2VuIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBvbiBtYWNvcyB0aGUgcGVybWlzc2lvbiBzZXR0aW5ncyBpbiByYXJlIGNhc2VzIG1lc3MgdXAgdGhlIGFiaWxpdHkgdG8gZmV0Y2ggdGhlIHRlYWNoZXIgYXBpIFxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKXsgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCB0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0KTsgXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZSA9PT0gXCJyZXNldFwiKSB7ICAgLy8gcXVpdCB0aGUgYXBwIGlmIHRoZSB1c2VyIHdhbnRzIHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNob3cgd2FybmluZyBtZXNzYWdlIGlmIHRoZSB1c2VyIGRvZXMgbm90IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcyBnaWJ0IGVpbiBQcm9ibGVtIG1pdCBkZW0gTmV0endlcmssIGRlbiBGaXJld2FsbHJlZ2VsbiBvZGVyIGRlbiBOZXR6d2Vya2JlcmVjaHRpZ3VuZ2VuISBCaXR0ZSBiZWhlYmVuIHNpZSBkaWVzZXMgUHJvYmxlbSB1bmQgc3RhcnRlbiBTaWUgTmV4dC1FeGFtIG5ldSFcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgICAgICAgICByZXR1cm47ICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBHZW9nZWJyYSBhcyBnZ2IgZmlsZSAtIGFzIGJhY2t1cCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgLCBjb250ZW50OiBiYXNlNjQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NhdmVHR0InLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhcmdzLmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgY29uc3QgcmVhc29uID0gYXJncy5yZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2F2ZUdHQjogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gQnVmZmVyLmZyb20oY29udGVudCwgJ2Jhc2U2NCcpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhnZ2JGaWxlUGF0aCwgZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVzdG9yZWRcIikgLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnIpICBcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVHR0I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBsb2FkIGNvbnRlbnQgZnJvbSBnZ2IgZmlsZSBhbmQgc2VuZCBpdCB0byB0aGUgZnJvbnRlbmQgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnbG9hZEdHQicsIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhZCB0aGUgZmlsZSBhbmQgY29udmVydCBpdCB0byBiYXNlNjRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhnZ2JGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZTY0R2diRmlsZSA9IGZpbGVEYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6YmFzZTY0R2diRmlsZSwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9ICAgICBcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHRVQgUERGIG9yIElNQUdFIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwZGZhc3luYycsIChldmVudCwgZmlsZW5hbWUsIGltYWdlID0gZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbWFnZSl7IHJldHVybiBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBiYXNlNjQgc3RyaW5nIG9mIGF1ZGlvZmlsZSBmcm9tIHdvcmtkaXJlY3Rvcnkgb3IgcHVibGljIGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEF1ZGlvRmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIHB1YmxpY2Rpcj1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpO1xuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiAhcHVibGljZGlyKSB7IC8vIFJldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvclxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgcHVibGljZGlyKSB7XG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi8uLi9wdWJsaWNcIixmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgRklMRS1MSVNUIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGZpbGVzYXN5bmMnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBhdWRpbz1mYWxzZSwgZG9jeD1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXJndW1lbnRzOlwiLCBmaWxlbmFtZSwgYXVkaW8sIGRvY3gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG5cbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gPT0gdHJ1ZSl7IC8vIGF1ZGlvIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRvY3gpeyAgLy9vZmZpY2Ugb3BlbiB4bWwgZmlsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbWFtbW90aC5jb252ZXJ0VG9IdG1sKHtwYXRoOiBmaWxlcGF0aH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgICAvL2JhayBmaWxlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgLy8gcmV0dXJuIGZpbGUgbGlzdCBvZiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7IGZzLm1rZGlyU3luYyh3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH0gLy9kbyBub3QgY3Jhc2ggaWYgdGhlIGRpcmVjdG9yeSBpcyBkZWxldGVkIGFmdGVyIHRoZSBhcHAgaXMgc3RhcnRlZCBeXlxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZWxpc3QgPSAgZnMucmVhZGRpclN5bmMod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgICAgICAgICAgICAgZmlsZWxpc3QuZm9yRWFjaCggZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kaWZpZWQgPSBmcy5zdGF0U3luYyggICBwYXRoLmpvaW4od29ya2RpcixmaWxlKSAgKS5tdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZCA9IG1vZGlmaWVkLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucGRmXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJwZGZcIiwgbW9kOiBtb2R9KSAgIH0gICAgICAgICAvL3BkZlxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5iYWtcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImJha1wiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgYmFja3VwIGZpbGUgdG8gcmVwbGFjZSBlZGl0b3IgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5kb2N4XCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJkb2N4XCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBjb250ZW50IGZpbGUgKGZyb20gdGVhY2hlcikgdG8gcmVwbGFjZSBjb250ZW50IGFuZCBjb250aW51ZSB3cml0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdnYlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZ2diXCIsIG1vZDogbW9kfSkgICB9ICAvLyBnZW9nZWJyYVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5tcDNcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIub2dnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLndhdlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImF1ZGlvXCIsIG1vZDogbW9kfSkgICB9ICAvLyBhdWRpb1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5qcGdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucG5nXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdpZlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImltYWdlXCIsIG1vZDogbW9kfSkgICB9ICAvLyBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEJBQ0tVUCBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZmlsZW5hbWUgd2l0aG91dFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRiYWNrdXBmaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBSZXF1ZXN0IHJlY2VpdmVkIGZvciBmaWxlbmFtZTogJHtmaWxlbmFtZX1gKVxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEZ1bGwgZmlsZSBwYXRoOiAke2ZpbGVwYXRofWApXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVwYXRoKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIG5vdCBmb3VuZDogJHtmaWxlcGF0aH1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBleGlzdHMsIHJlYWRpbmcgY29udGVudGApXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogU3VjY2Vzc2Z1bGx5IHJlYWQgYmFja3VwIGZpbGUsIGNvbnRlbnQgbGVuZ3RoOiAke2RhdGEubGVuZ3RofWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3IgcmVhZGluZyBiYWNrdXAgZmlsZTogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciBzdGFjazogJHtlcnIuc3RhY2t9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBubyBmaWxlbmFtZSBwcm92aWRlZGApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigncmVsb2FkLXVybCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUVhc3RlcldpbigpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQXBwZW5kIFByaW50UmVxdWVzdCB0byBjbGllbnRpbmZvICBcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzZW5kUHJpbnRSZXF1ZXN0JywgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IHRydWUgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0LWNwdS1pbmZvJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuaXNWaXJ0dWFsTWFjaGluZSgpXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdsYW4taW5mbycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2xhbkluZm8gPSBhd2FpdCBnZXRXbGFuSW5mbygpO1xuICAgICAgICAgICAgcmV0dXJuIHdsYW5JbmZvO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFxuICAgICAgICAvLyBOZXcgaGFuZGxlciB0byBnZXQgUERGIGZyb20gcHVibGljIGRpcmVjdG9yeSBmb3IgZnJvbnRlbmQgcGFyc2luZ1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UGRmRnJvbVB1YmxpYycsIGFzeW5jIChldmVudCwgcGRmRmlsZW5hbWUgKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEdldCBkaXJlY3RvcnkgbmFtZSBpbiBFU01cbiAgICAgICAgICAgICAgICBjb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBwZGZQYXRoO1xuICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLmdldFBhY2thZ2VkUHVibGljQmFzZSgpLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBkZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogUERGIG5vdCBmb3VuZCBhdDogJHtwZGZQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBkZlBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuICAgIGlzVmlydHVhbE1hY2hpbmUoKSB7XG4gICAgICAgIGNvbnN0IFZFTkRPUlMgPSAvKG9yYWNsZXx2aXJ0dWFsYm94fHZtd2FyZXxrdm18cWVtdXx4ZW58aW5ub3Rla3xwYXJhbGxlbHN8bWljcm9zb2Z0fGh5cGVyLXZ8Ymh5dmV8cmVkIGhhdHxyZWRoYXR8Ym9jaHN8Ymh5dmV8b3BlbnN0YWNrfGNsb3VkfGFtYXpvbnxnb29nbGV8YXp1cmUpL2kgLy8gY29tbW9uIFZNIGlkc1xuICAgICAgICBjb25zdCB3YXJuQW5kUmV0dXJuID0gcmVhc29uID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgaXNWaXJ0dWFsTWFjaGluZTogVmVyZGFjaHQgYXVmIFZNIC0gJHtyZWFzb259YClcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIExpbnV4IC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3B1aW5mbyA9IHJlYWRGaWxlU3luYygnL3Byb2MvY3B1aW5mbycsICd1dGY4JykgICAgICAvLyBDUFUgZmxhZ3NcbiAgICAgICAgICAgIGlmICgvXmZsYWdzLipcXGJoeXBlcnZpc29yXFxiL20udGVzdChjcHVpbmZvKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ2h5cGVydmlzb3IgZmxhZyBpbiAvcHJvYy9jcHVpbmZvJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBbXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9zeXNfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfbmFtZScsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X3ZlcnNpb24nLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYm9hcmRfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2Jpb3NfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2NoYXNzaXNfdmVuZG9yJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgZG1pID0gZmlsZXMubWFwKHAgPT4geyB0cnkgeyByZXR1cm4gcmVhZEZpbGVTeW5jKHAsICd1dGY4JykgfSBjYXRjaCB7IHJldHVybiAnJyB9IH0pLmpvaW4oJyAnKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChkbWkpKSByZXR1cm4gd2FybkFuZFJldHVybignRE1JLVZlbmRvci1NYXRjaCcpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdzeXN0ZW1kLWRldGVjdC12aXJ0IC1xJywgeyBzdGRpbzogJ2lnbm9yZScgfSkgICAgLy8gZXhpdCAwID0+IFZNXG4gICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignc3lzdGVtZC1kZXRlY3QtdmlydCBtZWxkZXQgVmlydHVhbGlzaWVydW5nJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cblxuICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtUHJvemVzc2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPSBleGVjU3luYygncHMgYXV4IHwgZ3JlcCAtaSBxZW11JywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAocHMuaW5jbHVkZXMoJ3FlbXUnKSAmJiAhcHMuaW5jbHVkZXMoJ2dyZXAnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIGxcdTAwRTR1ZnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gV2luZG93cyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIoR2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtIHwgRm9yRWFjaC1PYmplY3QgeyAkXy5NYW51ZmFjdHVyZXIsICRfLk1vZGVsIH0pIC1qb2luIFxcJyBcXCdcIidcbiAgICAgICAgICAgIGNvbnN0IGJhc2ljID0gZXhlY1N5bmMocHMsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKCkgICAgLy8gbWFudWZhY3R1cmVyICsgbW9kZWxcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoYmFzaWMpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL01vZGVsbCBwYXNzdCB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwc1JvYnVzdCA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRvPUAoKTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW07JG8rPUAoJGNzLk1hbnVmYWN0dXJlciwkY3MuTW9kZWwpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmI9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0Jhc2VCb2FyZDskbys9QCgkYmIuTWFudWZhY3R1cmVyLCRiYi5Qcm9kdWN0KX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJpb3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0JJT1M7JG8rPUAoJGJpb3MuU01CSU9TQklPU1ZlcnNpb24pfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3NwPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3Q7JG8rPUAoJGNzcC5OYW1lKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICdXcml0ZS1PdXRwdXQgKCgkbyAtam9pbiBcXCcgXFwnKS5UcmltKCkpXCInXG4gICAgICAgICAgICBjb25zdCByb2J1c3QgPSBleGVjU3luYyhwc1JvYnVzdCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChyb2J1c3QpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL0JJT1MtSW5mb3MgcGFzc2VuIHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLUVya2VubnVuZyBmXHUwMEZDciBXaW5kb3dzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHFlbXVQcm9jZXNzZXMgPSBleGVjU3luYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIHFlbXUqXCInLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgICAgICBpZiAocWVtdVByb2Nlc3Nlcy5pbmNsdWRlcygncWVtdScpKSByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIHVudGVyIFdpbmRvd3MnKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cblxuICAgICAgICAgLy8gLS0tLS0tLS0tLSBtYWNPUyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGh3TW9kZWwgPSBleGVjU3luYygnc3lzY3RsIC1uIGh3Lm1vZGVsJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoL152aXJ0dWFsL2kudGVzdChod01vZGVsKSB8fCBWRU5ET1JTLnRlc3QoaHdNb2RlbCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBIYXJkd2FyZW1vZGVsbCBkZXV0ZXQgYXVmIFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gZXhlY1N5bmMoJ3N5c3RlbV9wcm9maWxlciBTUEhhcmR3YXJlRGF0YVR5cGUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qoc3ApKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1Mgc3lzdGVtX3Byb2ZpbGVyIG1lbGRldCBWTS1WZW5kb3InKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlICAgICAgIFxuICAgIH1cblxuICAgIGNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpIHtcbiAgICAgICAgY29uc3QgcGFydHNBID0gdmVyc2lvbkEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgY29uc3QgcGFydHNCID0gdmVyc2lvbkIuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBudW1BID0gcGFydHNBW2ldIHx8IDA7IC8vIEZhbGxiYWNrIGF1ZiAwLCBmYWxscyBrZWluIFdlcnQgdm9yaGFuZGVuXG4gICAgICAgICAgICBjb25zdCBudW1CID0gcGFydHNCW2ldIHx8IDA7XG4gICAgXG4gICAgICAgICAgICBpZiAobnVtQSA8IG51bUIpIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmIChudW1BID4gbnVtQikgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IG51bWJlckEgPSBwYXJzZUludChzdGF0dXNBLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgICAgICBjb25zdCBudW1iZXJCID0gcGFyc2VJbnQoc3RhdHVzQi5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICBcbiAgICAgICAgaWYgKG51bWJlckEgPCBudW1iZXJCKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChudW1iZXJBID4gbnVtYmVyQikgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGNvbXBhcmVTb2Z0d2FyZSh2ZXJzaW9uQSwgc3RhdHVzQSwgdmVyc2lvbkIsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkNvbXBhcmlzb24gPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpO1xuICAgICAgICBpZiAodmVyc2lvbkNvbXBhcmlzb24gIT09IDApIHJldHVybiB2ZXJzaW9uQ29tcGFyaXNvbjtcbiAgICBcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpO1xuICAgIH1cblxuXG59XG4gXG5leHBvcnQgZGVmYXVsdCBuZXcgSXBjSGFuZGxlcigpXG4iLCAiaW1wb3J0IHtjcmVhdGVJMThufSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbWVzc2FnZXM6IHtcbiAgICAgICAgZW4sXG4gICAgICAgIGRlXG4gICAgICB9XG4gIH0pXG5cbmV4cG9ydCBkZWZhdWx0IGkxOG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiUmVzdG9yZVwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiRGlzY29ubmVjdFwiLFxuICAgICAgICAgICAgXCJleGl0XCI6IFwiRXhpdFwiXG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwic3R1ZGVudFwiIDoge1xuICAgICAgICBcInBhc3N3b3JkXCI6IFwiUGFzc3dvcmRcIixcbiAgICAgICAgXCJleGFtc1wiOiBcIkV4YW1zXCIsXG4gICAgICAgIFwidXNlcm5hbWVcIjogXCJVc2VybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyIGFkZHJlc3NcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiRXhhbSBOYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJyZWdpc3RlclwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwicmVnaXN0ZXJpbmcuLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwicmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcImRpc2Nvbm5lY3RlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgb24gc2VydmVyISBcXG5cXG5QbGVhc2Ugd2FpdCBmb3IgdGhlIGFjdGl2YXRpb24gb2YgdGhlIGV4YW0gbW9kZSBieSB0aGUgdGVhY2hlciFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwic2VhcmNoIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJub3B3XCI6IFwid3JvbmcgdXNlcm5hbWUgb3IgcGluXCIsXG4gICAgICAgIFwibm91c2VyXCI6XCJubyB1c2VybmFtZSBnaXZlblwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZGRyZXNzZSBvZGVyIEV4YW1uYW1lIG1pc3NpbmdcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJubyBwaW5jb2RlIGdpdmVuXCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjpcIlNlcnZlciBBUEkgdW5yZWFjaGFibGVcIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgaXMgYmVoaW5kIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiTm8gVGVhY2hlciBBUEkgZm91bmQgb24gdGhlIGdpdmVuIGFkZHJlc3NcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2NhbCBsb2NrZG93blwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWFsIHNlYXJjaFwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIk5vIGV4YW1zIGZvdW5kXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nb3V0P1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJhY3RpdmF0ZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlc1wiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGljc1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiU2VsZWN0IGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIlBsZWFzZSBpbnN0YWxsIHRoZSBzYW1lIHZlcnNpb24gYXMgdGhlIGV4YW0gc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyBub3QgdmFsaWRcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcInNhZmUgZXhhbSBzdGF0dXMgY2hhbmdlZFwiLFxuICAgICAgICBcImFscmVhZHlyZWdpc3RlcmVkXCI6IFwic3R1ZGVudCBhbHJlYWR5IHJlZ2lzdGVyZWRcIixcbiAgICAgICAgXCJleGFtaW5pdFwiOlwic3RhcnRlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJzdG9wcGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwibm9leGFtXCI6IFwic2FmZSBleGFtIG1vZGUgbm90IGFjdGl2ZVwiLFxuICAgICAgICBcImNsaWVudHVuc3Vic2NyaWJlXCI6IFwic3R1ZGVudCByZW1vdmVkIGZyb20gc2VydmVyXCJcbiAgICAgICBcbiAgICB9LFxuICAgIFwiZGF0YVwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiZmlsZXMgcmVjZWl2ZWRcIixcbiAgICAgICAgXCJmaWxlc3RvcmVkXCI6IFwiZmlsZXMgc3RvcmVkXCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIm5vIGZpbGVzIHdlcmUgdXBsb2FkZWRcIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJmaWxlIGVycm9yXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcInBsZWFzZSBjaGVjayBpZiB0aGUgJ0VYQU0tU1RVREVOVCcgZGlyZWN0b3J5IGlzIHdyaXRlYWJsZSBhbmQgaGFzIGVub3VnaCBzcGFjZVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm8yXCI6IFwiQSBsb2NhbCBiYWNrdXAgY291bGQgbm90IGJlIGNyZWF0ZWQuIFBsZWFzZSB1c2UgdGhlIG1hbnVhbCBzdWJtaXNzaW9uIG9wdGlvbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcImRvbid0IHNob3cgYWdhaW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGZvdW5kXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiR2V0IG1hdGVyaWFsc1wiLFxuICAgICAgICBcInNlbmRmaW5hbGV4YW1cIjogXCJTZW5kIGZpbmFsIGV4YW1cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkZpbmFsIHN1Ym1pdFwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsczpcIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9jYWwgZmlsZXM6XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiVXBkYXRlXCIsXG4gICAgICAgIFwic3BsaXR2aWV3XCI6IFwiU3BsaXR2aWV3XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiWW91IGhhdmUgbGVmdCB0aGUgc2FmZSBleGFtIG1vZGUhXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJQbGVhc2UgaW5mb3JtIGEgdGVhY2hlciFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJEbyB5b3Ugd2FudCB0byByZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoZSBlZGl0b3Igd2l0aCB0aGUgY29udGVudCBvZiBcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCI/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJDYW5jZWxcIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJSZXBsYWNlXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAgZmlsZSBjb3VsZCBub3QgYmUgcmVhZFwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBzdWNjZXNzZnVsbHkgbG9hZGVkXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJFcnJvciBsb2FkaW5nIGJhY2t1cCBmaWxlXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJTdWNjZXNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJjaGFyc1wiLFxuICAgICAgICBcIndvcmRzXCI6IFwid29yZHNcIixcbiAgICAgICAgXCJyZWNvbm5lY3RcIjogXCJyZWNvbm5lY3RcIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJ1bmxvY2tcIixcbiAgICAgICAgXCJleGl0XCI6IFwiRXhpdCBzYWZlIGV4YW0gbW9kZT9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJEbyBub3QgbGVhdmUgc2FmZSBleGFtIG1vZGUgd2l0aG91dCBwZXJtaXNzaW9uLlwiLFxuICAgICAgICBcImluZm9cIjogXCJJZiB0aGlzIHByb2Nlc3MgZmFpbHMgdW5sb2NrIGFuZCB0cnkgYWdhaW4hXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJDcmVhdGluZyBiYWNrdXBcIixcbiAgICAgICAgXCJzYXZlZGNsaXBcIjogXCJDcmVhdGluZyBiYWNrdXAgYW5kIGNsaXBib2FyZCBjb3B5XCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkxlYXZpbmcgRXhhbSBtb2RlXCIsXG4gICAgICAgIFwiYmFja3VwXCI6IFwiYmFja3VwXCIsXG4gICAgICAgIFwidW5kb1wiOlwidW5kb1wiLFxuICAgICAgICBcInJlZG9cIjpcInJlZG9cIixcbiAgICAgICAgXCJjbGVhclwiOlwiY2xlYXJcIixcbiAgICAgICAgXCJib2xkXCI6XCJib2xkXCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJpdGFsaWNcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVuZGVybGluZVwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJoZWFkaW5nMVwiLFxuICAgICAgICBcImhlYWRpbmcyXCI6XCJoZWFkaW5nMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJoZWFkaW5nM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJoZWFkaW5nNFwiLFxuICAgICAgICBcImhlYWRpbmc1XCI6XCJoZWFkaW5nNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJoZWFkaW5nNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwic3Vic2NyaXB0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcInN1cGVyc2NyaXB0XCIsXG4gICAgICAgIFwiYnVsbGV0bGlzdFwiOlwiYnVsbGV0bGlzdFwiLFxuICAgICAgICBcImxpc3RcIjpcImxpc3RcIixcbiAgICAgICAgXCJjb2RlYmxvY2tcIjpcImNvZGVibG9ja1wiLFxuICAgICAgICBcImNvZGVcIjpcImNvZGVcIixcbiAgICAgICAgXCJibG9ja3F1b3RlXCI6XCJibG9ja3F1b3RlXCIsXG4gICAgICAgIFwibGluZVwiOlwicGFnZWJyZWFrXCIsXG4gICAgICAgIFwibGVmdFwiOlwibGVmdFwiLFxuICAgICAgICBcImNlbnRlclwiOlwiY2VudGVyXCIsXG4gICAgICAgIFwicmlnaHRcIjpcInJpZ2h0XCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJ0ZXh0Y29sb3JcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcImxpbmVicmVha1wiLFxuICAgICAgICBcIm1vcmVcIjpcIm1vcmVcIixcbiAgICAgICAgXCJpbnNlcnR0YWJsZVwiOlwiaW5zZXJ0dGFibGVcIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiZGVsZXRldGFibGVcIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiY29sdW1uYWZ0ZXJcIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwicm93YWZ0ZXJcIixcbiAgICAgICAgXCJkZWxjb2x1bW5cIjpcImRlbGNvbHVtblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiZGVscm93XCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJtZXJnZW9yc3BsaXRcIixcbiAgICAgICAgXCJoZWFkZXJjb2x1bW5cIjpcImhlYWRlcmNvbHVtblwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiaGVhZGVycm93XCIsXG4gICAgICAgIFwic2VsZWN0ZWRcIjpcInNlbGVjdGVkIHdvcmRzL2NoYXJzXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcInByaW50IHJlcXVlc3Qgc2VudFwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcInByaW50IHJlcXVlc3QgZGVuaWVkXCIsXG4gICAgICAgIFwicGFzdGVcIjpcInBhc3RlXCIsXG4gICAgICAgIFwiY29weVwiOlwiY29weVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJzcGVsbGNoZWNrXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJkZWFjdGl2YXRlIHNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJyZWxvYWRcIjogXCJSZWxvYWRcIixcbiAgICAgICAgXCJyZWxvYWR0ZXh0XCI6IFwiV291bGQgeW91IGxpa2UgdG8gcmVpbml0aWFsaXplIHRoZSBFZGl0b3I/XCIsXG4gICAgICAgIFwicmVsb2FkY29udGVudFwiOiBcImtlZXAgY29udGVudFwiLFxuICAgICAgICBcInNwZWNpYWxjaGFyXCI6XCJJbnNlcnQgc3BlY2lhbGNoYXJhY3RlclwiLFxuICAgICAgICBcInByaW50XCI6IFwicHJpbnRcIixcbiAgICAgICAgXCJwbGF5YXVkaW9cIjpcIlBsYXkgQXVkaW9cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJEbyB5b3Ugd2FudCB0byBwbGF5IHRoZSBhdWRpb2ZpbGU/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlJlbWFpbmluZyBwbGF5YmFja3M6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJZb3UgZG9uJ3QgaGF2ZSB0aGUgcGVybWlzc2lvbiB0byBwbGF5IHRoaXMgZmlsZSFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkluc2VydCBJbWFnZVwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiSW5zZXJ0IE11Z3Nob3RcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJTZW5kIHdvcmsgdG8gdGVhY2hlclwiLFxuICAgICAgICBcInpvb21JblwiOlwiWm9vbSBpblwiLFxuICAgICAgICBcInpvb21PdXRcIjpcIlpvb20gb3V0XCIsXG4gICAgICAgIFwiY2xvc2VcIjpcIkNsb3NlXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiRXhpdCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRmlsZW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJQbGVhc2UgZW50ZXIgb25seSBsZXR0ZXJzIGFuZCBudW1iZXJzIHdpdGhvdXQgc3BlY2lhbCBjaGFyYWN0ZXJzXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJjbGVhciBjb250ZW50P1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiTm8gdmFsaWQgUERGIEZpbGVcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiV3JvbmcgcGFzc3dvcmRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiUmVsb2FkIHdlYnZpZXdcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiV2llZGVyaGVyc3RlbGxlblwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJCZWVuZGVuXCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIkJlbnV0emVybmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcIm1lbGRlIGFuLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcImFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJWZXJiaW5kdW5nIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU2llIGhhYmVuIHNpY2ggZXJmb2xncmVpY2ggYW0gU2VydmVyIHJlZ2lzdHJpZXJ0ISBcXG5cXG5CaXR0ZSB3YXJ0ZW4gU2llIGF1ZiBkaWUgQWt0aXZpZXJ1bmcgZGVzIFByXHUwMEZDZnVuZ3Ntb2R1cyBkdXJjaCBkaWUgTGVocnBlcnNvbiFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwiU3VjaGUgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkZhbHNjaGVyIEJlbnV0emVybmFtZSBvZGVyIFBpbmNvZGVcIixcbiAgICAgICAgXCJub3VzZXJcIjogXCJCZW51dHplcm5hbWUgZmVobHRcIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRyZXNzZSBvZGVyIFByXHUwMEZDZnVuZ3NuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiLFxuICAgICAgICBcIm5vcGluXCI6IFwiUGluY29kZSBmZWhsdFwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6IFwiU2VydmVyIEFQSSBuaWNodCBlcnJlaWNoYmFyLlwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBiZWZpbmRldCBzaWNoIG1cdTAwRjZnbGljaGVyd2Vpc2UgaGludGVyIGVpbmVyIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiS2VpbmUgUHJcdTAwRkNmdW5nc3NlcnZlciBhbiBhbmdlZ2ViZW5lciBBZHJlc3NlXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9rYWwgYWJzcGVycmVuXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51ZWxsIHN1Y2hlblwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIktlaW5lIFByXHUwMEZDZnVuZ2VuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiUHJcdTAwRkNmdW5nc21vZHVzIGF1c3dcdTAwRTRobGVuXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiQml0dGUgaW5zdGFsbGllcmVuIHNpZSBkaWUgc2VsYmUgVmVyc2lvbiB3aWUgYW0gUHJcdTAwRkNmdW5nc3NlcnZlciFcIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGdlc3RhcnRldFwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIG5pY2h0IGFrdGl2XCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gZW50ZmVybnRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJEYXRlaWVuIGdlc3BlaWNoZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiRmVobGVyIGJlaW0gU2NocmVpYmVuIGRlciBEYXRlaVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJCaXR0ZSBzdGVsbGVuIFNpZSBzaWNoZXIsIGRhc3MgZGFzICdFWEFNLVNUVURFTlQnIFZlcnplaWNobmlzIGZcdTAwRkNyIE5leHQtRXhhbSBzY2hyZWliYmFyIGlzdCB1bmQgZ2VuXHUwMEZDZ2VuZCBTcGVpY2hlcnBsYXR6IHZvcmhhbmRlbiBpc3QuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJFaW5lIGxva2FsZSBTaWNoZXJ1bmcga29ubnRlIG5pY2h0IGVyc3RlbGx0IHdlcmRlbi4gTnV0emVuIFNpZSBkaWUgbWFudWVsbGUgQWJnYWJlIHVtIElocmUgQXJiZWl0IGRpcmVrdCBhbiBkaWUgTGVocnBlcnNvbiB6dSBzZW5kZW4uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJOaWNodCBtZWhyIGFuemVpZ2VuXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBnZWZ1bmRlblwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuIGhvbGVuXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIkZpbmFsZSBBYmdhYmUgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkFiZ2FiZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIkFrdHVhbGlzaWVyZW5cIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9rYWxlIERhdGVpZW46XCIsXG5cbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGFsdGVuYW5zaWNodFwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIlNpZSBoYWJlbiBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJNZWxkZW4gU2llIHNpY2ggdW1nZWhlbmQgYmVpIGRlciBBdWZzaWNodHNwZXJzb24hXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiV29sbGVuIFNpZSBkZW4gSW5oYWx0IGRlcyBFZGl0b3JzIGR1cmNoIGRlbiBJbmhhbHQgZGVyIERhdGVpXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJFcnNldHplblwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwLURhdGVpIGtvbm50ZSBuaWNodCBnZWxlc2VuIHdlcmRlblwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBlcmZvbGdyZWljaCBnZWxhZGVuXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBMYWRlbiBkZXIgQmFja3VwLURhdGVpXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiRXJmb2xnXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJaZWljaGVuXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJXXHUwMEY2cnRlclwiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcIm5ldSB2ZXJiaW5kZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJlbnRzcGVycmVuXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJWZXJsYXNzZW4gU2llIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIG5pZSBvaG5lIEZyZWlnYWJlIGVpbmVyIExlaHJwZXJzb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIlNvbGx0ZSBkZXIgVm9yZ2FuZyBmZWhsc2NobGFnZW4gYmVlbmRlbiBTaWUgYml0dGUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdW5kIHZlcnN1Y2hlbiBTaWUgZXMgZXJuZXV0IVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiSWhyZSBBcmJlaXQgd3VyZGUgZXJmb2xncmVpY2ggZ2VzaWNoZXJ0IVwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkRpZSBha3R1ZWxsZSBBcmJlaXQgd2lyZCBnZXNpY2hlcnQgdW5kIGluIGRpZSBad2lzY2hlbmFibGFnZSBrb3BpZXJ0IVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJzaWNoZXJuXCIsXG4gICAgICAgIFwidW5kb1wiOlwiclx1MDBGQ2NrZ1x1MDBFNG5naWdcIixcbiAgICAgICAgXCJyZWRvXCI6XCJ3aWVkZXJob2xlblwiLFxuICAgICAgICBcImNsZWFyXCI6XCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJib2xkXCI6XCJmZXR0XCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJrdXJzaXZcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVudGVyc3RyaWNoZW5cIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiXHUwMERDYmVyc2NocmlmdCAxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiXHUwMERDYmVyc2NocmlmdCA0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInRpZWZnZXN0ZWxsdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJob2NoZ2VzdGVsbHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJ1bmdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImxpc3RcIjpcImdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiQ29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiQ29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcIlppdGF0XCIsXG4gICAgICAgIFwibGluZVwiOlwiU2VpdGVudW1icnVjaFwiLFxuICAgICAgICBcImxlZnRcIjpcIkxpbmtzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcIlplbnRyaWVydFwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJSZWNodHNiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwiVGV4dGZhcmJlXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJaZWlsZW51bWJydWNoXCIsXG4gICAgICAgIFwibW9yZVwiOlwibWVoclwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJUYWJlbGxlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiVGFiZWxsZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiU3BhbHRlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwiUmVpaGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiU3BhbHRlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiUmVpaGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJWZXJlaW5lbiBvZGVyIFRlaWxlblwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiVGl0ZWxzcGFsdGVcIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcIlRpdGVscmVpaGVcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwiV1x1MDBGNnJ0ZXIvWmVpY2hlbiBpbiBBdXN3YWhsXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcIkRydWNrYW5mcmFnZSBnZXNlbmRldCFcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJEcnVja2FuZnJhZ2UgYWJnZWxlaG50LiBCaXR0ZSB3YXJ0ZW4gdW5kIGVybmV1dCBzZW5kZW4uXCIsXG4gICAgICAgIFwicGFzdGVcIjpcImVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJjb3B5XCI6XCJrb3BpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGRlYWt0aXZpZXJlblwiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIk5ldSBsYWRlblwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb2xsZW4gU2llIGRlbiBUZXh0ZWRpdG9yIG5ldSBpbml0aWFsaXNpZXJlbj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwiSW5oYWx0IGJlaWJlaGFsdGVuXCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIlNvbmRlcnplaWNoZW4gZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiQXVkaW8gYWJzcGllbGVuXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiV29sbGVuIFNpZSBkYXMgSFx1MDBGNnJiZWlzcGllbCBqZXR6dCBhYnNwaWVsZW4/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlZlcmJsZWliZW5kZSBEdXJjaGxcdTAwRTR1ZmU6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJTaWUgaGFiZW4ga2VpbmUgQmVyZWNodGlndW5nIGRpZSBBdWRpb2RhdGVpIGVybmV1dCBhYnp1c3BpZWxlbiFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkJpbGQgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiTXVnc2hvdCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiQXJiZWl0IGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiU2NobGllXHUwMERGZW5cIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJEYXRlaW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJCaXR0ZSBnZWJlbiBTaWUgbnVyIEJ1Y2hzdGFiZW4gb2RlciBaYWhsZW4gZWluLlwiLFxuICAgICAgICBcImNsZWFyXCI6IFwiQWxsZSBCZXJlY2hudW5nZW4gbFx1MDBGNnNjaGVuP1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIGdcdTAwRkNsdGlnZSBQREYgRGF0ZWlcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiRmFsc2NoZXMgUGFzc3dvcnRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiV2VidmlldyBuZXUgbGFkZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIlxuICAgIH1cbn1cbiIsICJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vanJlLWhhbmRsZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuY29uc3QgcHVibGljQmFzZSA9ICgpID0+IChhcHAuaXNQYWNrYWdlZCA/IHBsYXRmb3JtRGlzcGF0Y2hlci5nZXRQYWNrYWdlZFB1YmxpY0Jhc2UoKSA6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKSk7XG5cbmxldCBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKHB1YmxpY0Jhc2UoKSwgJ0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpO1xubGV0IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJyk7XG5cblxuXG5cblxuY2xhc3MgTGFuZ3VhZ2VUb29sU2VydmVyIHtcbiAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBJbml0aWFsaXNpZXJ0IGRpZSBQcm96ZXNzdmFyaWFibGVcbiAgICAgICAgIHRoaXMucG9ydCA9IDgwODhcbiAgICAgfVxuIFxuICAgICBzdGFydFNlcnZlcigpIHtcbiAgICAgICAgIGlmICh0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgJiYgIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nLicpO1xuICAgICAgICAgICAgIHJldHVybjsgLy8gVmVyaGluZGVydCBkYXMgZXJuZXV0ZSBTdGFydGVuLCB3ZW5uIGRlciBTZXJ2ZXIgYmVyZWl0cyBsXHUwMEU0dWZ0XG4gICAgICAgICB9XG4gICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gSnJlSGFuZGxlci5qU3Bhd24oXG4gICAgICAgICAgICAgICAgW2xhbmd1YWdlVG9vbEphclBhdGhdLCAvLyBLbGFzc2VucGZhZFxuICAgICAgICAgICAgICAgICdvcmcubGFuZ3VhZ2V0b29sLnNlcnZlci5IVFRQU2VydmVyJywgLy8gSGF1cHRrbGFzc2UgZGVyIExhbmd1YWdlVG9vbCBBUElcbiAgICAgICAgICAgICAgICBbJy0tcG9ydCcsIHRoaXMucG9ydCwnLS1jb25maWcnLGxhbmd1YWdlVG9vbENvbmZpZ1BhdGgsICctLWFsbG93LW9yaWdpbicsIFwiJyonXCIgXSAvLyBadXNcdTAwRTR0emxpY2hlIEFyZ3VtZW50ZSwgei5CLiBQb3J0IHVuZCBDT1JTLUVybGF1Ym5pc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcylcbiAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIEFQSSBydW5uaW5nIGF0IGxvY2FsaG9zdDo4MDg4Jyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCBkYXRhID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhOiBSZWNlaXZlZCBkYXRhIGZyb20gTGFuZ3VhZ2VUb29sIEFQSScsIGRhdGEudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXJyb3InKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtZXJyb3I6Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdGFydGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY2hlY2sgZG9uZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFuZGxlZCByZXF1ZXN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIEFjY3VtdWxhdGUgc3RkZXJyIGRhdGEgdG8gaGFuZGxlIGNodW5rZWQgb3V0cHV0XG4gICAgICAgICAgICBsZXQgc3RkZXJyQnVmZmVyID0gJyc7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyICs9IGNodW5rO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcodGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBib3RoIGN1cnJlbnQgY2h1bmsgYW5kIGFjY3VtdWxhdGVkIGJ1ZmZlciBmb3IgcG9ydC1yZWxhdGVkIGVycm9yc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXNwb25zZSA9IHN0ZGVyckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcnRFcnJvciA9IGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhwb3J0U3RyKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRyZXNzZSB3aXJkIGJlcmVpdHMgdmVyd2VuZGV0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJNYXliZSBzb21ldGhpbmcgZWxzZSBpcyBydW5uaW5nIG9uIHRoYXQgcG9ydFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoaXNQb3J0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBhbm90aGVyIExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgcHJvYmFibHkgYWxyZWFkeSBydW5uaW5nIG9uIHBvcnQ6JywgdGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsuaW5jbHVkZXMoJ1xcbicpIHx8IGZ1bGxSZXNwb25zZS5sZW5ndGggPiAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIHdlIGhhdmUgYSBuZXdsaW5lIChsaWtlbHkgY29tcGxldGUgbWVzc2FnZSkgb3IgYnVmZmVyIGlzIGdldHRpbmcgbGFyZ2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhLWVycm9yOicsIGZ1bGxSZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBTZXR6dCBkZW4gUHJvemVzcyB6dXJcdTAwRkNjaywgd2VubiBlciBiZWVuZGV0IHdpcmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGdlbmVyYWwtZXJyb3I6JywgZXJyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgfVxuXG4gICAgIHN0b3BTZXJ2ZXIoKSB7XG4gICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcykge1xuICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkLCBub3RoaW5nIHRvIHN0b3AnKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZpcnN0IHRyeSB0byBraWxsIHRoZSBwcm9jZXNzIGRpcmVjdGx5IGlmIHdlIGhhdmUgYSByZWZlcmVuY2VcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mga2lsbGVkJyk7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGZhaWxlZCB0byBraWxsIHByb2Nlc3MgZGlyZWN0bHksIHRyeWluZyBwbGF0Zm9ybS1zcGVjaWZpYyBtZXRob2Q6JywgZXJyKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgcGxhdGZvcm0tc3BlY2lmaWMgY29tbWFuZHMgdG8ga2lsbCB0aGUgcHJvY2VzcyAob25seSBpZiB3ZSBoYWQgYSBwcm9jZXNzIHJlZmVyZW5jZSlcbiAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgIGxldCBjb21tYW5kO1xuXG4gICAgICAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAvLyBXaW5kb3dzOiBmaW5kIGFuZCBraWxsIGphdmEgcHJvY2Vzc2VzIHJ1bm5pbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgd21pYyAod29ya3Mgb24gb2xkZXIgV2luZG93cyksIHRoZW4gdHJ5IFBvd2VyU2hlbGwsIHRoZW4gZmFsbGJhY2sgdG8gcG9ydC1iYXNlZCBraWxsXG4gICAgICAgICAgICAgY29tbWFuZCA9IGB3bWljIHByb2Nlc3Mgd2hlcmUgXCJjb21tYW5kbGluZSBsaWtlICclbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIlJ1wiIGRlbGV0ZSAyPm51bCB8fCBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgamF2YSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7JF8uQ29tbWFuZExpbmUgLWxpa2UgJypsYW5ndWFnZXRvb2wtc2VydmVyLmphcionfSB8IFN0b3AtUHJvY2VzcyAtRm9yY2VcIiAyPm51bCB8fCBmb3IgL2YgXCJ0b2tlbnM9NVwiICVhIGluICgnbmV0c3RhdCAtYW5vIF58IGZpbmRzdHIgOjgwODgnKSBkbyB0YXNra2lsbCAvRiAvUElEICVhIDI+bnVsYDtcbiAgICAgICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8IHBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgICAgLy8gbWFjT1MgYW5kIExpbnV4OiB1c2UgcGtpbGwgdG8ga2lsbCBwcm9jZXNzZXMgbWF0Y2hpbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICBjb21tYW5kID0gJ3BraWxsIC1mIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJztcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IHVuc3VwcG9ydGVkIHBsYXRmb3JtOicsIHBsYXRmb3JtKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIGV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAvLyBJdCdzIG9rYXkgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGZvdW5kIChhbHJlYWR5IGtpbGxlZClcbiAgICAgICAgICAgICAgICAgLy8gcGtpbGwgcmV0dXJucyBjb2RlIDEgd2hlbiBubyBwcm9jZXNzIGlzIGZvdW5kLCB3aGljaCBpcyBleHBlY3RlZFxuICAgICAgICAgICAgICAgICBpZiAoZXJyb3IuY29kZSAhPT0gMSAmJiAhZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnbm90IGZvdW5kJykgJiYgIXN0ZGVyci50b1N0cmluZygpLmluY2x1ZGVzKCdObyBzdWNoIHByb2Nlc3MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGVycm9yIGtpbGxpbmcgTGFuZ3VhZ2VUb29sIHNlcnZlcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mgbm90IGZvdW5kIChtYXkgYWxyZWFkeSBiZSBzdG9wcGVkKScpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgc3RvcHBlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgIH0pO1xuICAgICB9XG4gfVxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTGFuZ3VhZ2VUb29sU2VydmVyKClcblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBwcm9jZXNzIGZyb20gJ3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4gLy8gZXZlcnkgcGxhdGZvcm0gbmVlZHMgaXQncyBvd24ganJlIChsaW51eCwgd2luMzIsIGRhcndpbikgLy9maXhtZTogdXNlIEdyYWFsVk0gdG8gcHJlY29tcGlsZSBsYW5ndWFnZXRvb2wgaW4gb3JkZXIgdG8gc2F2ZSBzcGFjZSBhbmQgZ2V0IHJpZCBvZiBqcmU/XG5jbGFzcyBKcmVIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7IH1cblxuICAgIGluaXQoKXsgXG4gICAgICAgIHRoaXMualRlc3QoKVxuICAgIH1cblxuXG4gICAgalRlc3QoKXtcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKTsgLy8gJy9wZmFkL3p1ci9qYXZhJ1xuICAgICAgICBjb25zdCBwcm9jID0gc3Bhd24oamF2YXBhdGgsIFsnLXZlcnNpb24nXSk7XG4gICAgXG4gICAgICAgIHByb2Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGRhdGEudG9TdHJpbmcoKS5zcGxpdCgnXFxuJyk7IC8vIGluIFplaWxlbiBzcGxpdHRlblxuICAgICAgICAgICAgbG9nLmRlYnVnKGBqcmUtaGFuZGxlciBAIGpUZXN0OiAke2xpbmVzWzBdfWApOyAvLyBudXIgZGllIGVyc3RlIFplaWxlIGxvZ2dlblxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZmFpbChyZWFzb24pIHtcbiAgICAgICAgbG9nLmVycm9yKHJlYXNvbik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBnZXREaXJlY3RvcmllcyhkaXJQYXRoKSB7XG4gICAgICAgIGxldCBkaXJzID0gZnMucmVhZGRpclN5bmMoZGlyUGF0aCkuZmlsdGVyKFxuICAgICAgICAgICAgZmlsZSA9PiBmcy5zdGF0U3luYyhwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZSkpLmlzRGlyZWN0b3J5KClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGRpcnNcbiAgICB9IFxuXG4gICAgZHJpdmVyKCl7XG4gICAgICAgIHZhciBkID0gcGxhdGZvcm1EaXNwYXRjaGVyLmphdmFCaW4uc2xpY2UoKTtcbiAgICAgICAgZC51bnNoaWZ0KHBsYXRmb3JtRGlzcGF0Y2hlci5qcmVEaXIpO1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luLmFwcGx5KHBhdGgsIGQpO1xuICAgIH1cblxuICAgIGdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKS5zbGljZSgpO1xuICAgICAgICBjbGFzc3BhdGggPSBjbGFzc3BhdGggfHwgW107XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc25hbWUpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NwYXRoLmpvaW4odGhpcy5fcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOicpKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KCctY3AnKTtcbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgalNwYXduKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIFxuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpXG4gICAgICAgIGxldCBqYXZhYXJncyA9IHRoaXMuZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncylcbiAgICAgICAgbGV0IGphdmFjbWRsaW5lID0gIGAke2phdmFwYXRofSAke2phdmFhcmdzLmpvaW4oJyAnKX0gYFxuXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogJyR7cGxhdGZvcm1EaXNwYXRjaGVyLmpyZX0nIHNlbGVjdGVkYClcbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiBzcGF3bmluZyBqYXZhIHByb2Nlc3M6ICR7amF2YWNtZGxpbmV9YClcbiAgICAgICAgcmV0dXJuIHNwYXduKGphdmFwYXRoLCBqYXZhYXJncywge3NoZWxsOmZhbHNlfSk7XG4gICAgICAgLy8gcmV0dXJuIHNwYXduKGphdmFjbWRsaW5lKTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IEpyZUhhbmRsZXIoKVxuIiwgIi8vIHNjcmlwdHMvU3lzdGVtVHJheU1hbmFnZXIuanNcbmltcG9ydCB7IGFwcCwgVHJheSwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmxldCB0cmF5ID0gbnVsbDtcblxuLy8gUmVzb2x2ZSBpY29uIHBhdGg6IHBhY2thZ2VkIGFwcCB1c2VzIHVucGFja2VkIHB1YmxpYyBkaXIsIGRldiB1c2VzIHByb2plY3QgcHVibGljXG5mdW5jdGlvbiBnZXRUcmF5SWNvblBhdGgoKSB7XG4gIGNvbnN0IHB1YmxpY0Jhc2UgPSBwbGF0Zm9ybURpc3BhdGNoZXIuZ2V0UGFja2FnZWRQdWJsaWNCYXNlKCk7XG4gIHJldHVybiBwYXRoLmpvaW4ocHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24yNHgyNC5wbmcnKTtcbn0gXG5cbi8vID09PSByZXBsYWNlIHRoZSBoZWxwZXIgc2V0TG9jYWxlIChleGFjdCBibG9jaykgPT09XG5jb25zdCBzZXRMb2NhbGUgPSAobG9jKSA9PiB7XG4gICAgY29uc3QgZ2wgPSBpMThuLmdsb2JhbDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCBnbG9iYWwgY29tcG9zZXJcbiAgICBpZiAoZ2wgJiYgdHlwZW9mIGdsLmxvY2FsZSA9PT0gJ29iamVjdCcgJiYgZ2wubG9jYWxlKSB7XG4gICAgICAvLyB2dWUtaTE4biBjb21wb3NpdGlvbiBtb2RlXG4gICAgICBpZiAoJ3ZhbHVlJyBpbiBnbC5sb2NhbGUpIGdsLmxvY2FsZS52YWx1ZSA9IGxvYzsgICAgIC8vIHNldCByZWFjdGl2ZSB2YWx1ZVxuICAgICAgZWxzZSBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmYWxsYmFja1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBsZWdhY3kgbW9kZSBvciBwbGFpbiBzdHJpbmdcbiAgICAgIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHN0cmluZyBsb2NhbGVcbiAgICB9XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgXG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHRyYXkgaWNvbiBpZiBpdCBkb2Vzbid0IGV4aXN0IGFuZCB1cGRhdGVzIGl0cyBjb250ZXh0IG1lbnUuXG4gKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIG5ldyBsb2NhbGUgdG8gYXBwbHkuXG4gKi9cblxuXG5cbmV4cG9ydCBjb25zdCB1cGRhdGVTeXN0ZW1UcmF5ID0gKGxvY2FsZSkgPT4ge1xuICAgIHNldExvY2FsZShsb2NhbGUpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgdCA9IChrKSA9PiBpMThuLmdsb2JhbC50KGspOyAgICAgICAgICAgICAgICAgICAgICAvLyBhbHdheXMgcmVzb2x2ZSBsaXZlXG4gIFxuICAgIGlmICghdHJheSkge1xuICAgICAgdHJheSA9IG5ldyBUcmF5KGdldFRyYXlJY29uUGF0aCgpKTtcbiAgICAgIHRyYXkub24oJ2NsaWNrJywgKCkgPT4geyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2dsZSB3aW5kb3dcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmlzVmlzaWJsZSgpIFxuICAgICAgICAgID8gV2luZG93SGFuZGxlci5tYWlud2luZG93LmhpZGUoKSBcbiAgICAgICAgICA6IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIFxuICAgIC8vIGJ1aWxkIGNvbnRleHQgbWVudSB3aXRoIGN1cnJlbnQgbG9jYWxlXG4gICAgY29uc3QgY29udGV4dE1lbnUgPSBNZW51LmJ1aWxkRnJvbVRlbXBsYXRlKFtcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5yZXN0b3JlJyksIGNsaWNrOiAoKSA9PiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpIH0sIC8vIHNob3cgd2luZG93XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZGlzY29ubmVjdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cuaW5mbyhcIm1haW4gQCBzeXN0ZW10cmF5OiByZW1vdmluZyByZWdpc3RyYXRpb25cIik7IFxuICAgICAgICAgIENvbW1IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpOyBcbiAgICAgICAgfSBcbiAgICAgIH0sIC8vIGRpc2Nvbm5lY3RcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5leGl0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IENsb3NpbmcgTmV4dC1FeGFtXCIpOyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXCIpOyBcbiAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgXG4gICAgICAgICAgYXBwLnF1aXQoKTsgXG4gICAgICAgIH0gXG4gICAgICB9IC8vIGV4aXRcbiAgICBdKTtcbiAgXG4gICAgdHJheS5zZXRUb29sVGlwKCdOZXh0LUV4YW0gU3R1ZGVudCcpOyAgICAgICAgICAgICAgICAgICAvLyBzZXQgdG9vbHRpcFxuICAgIHRyYXkuc2V0Q29udGV4dE1lbnUoY29udGV4dE1lbnUpOyAgICAgICAgICAgICAgICAgICAgICAgLy8gYXBwbHkgbWVudVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gICIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogVGhpcyBzY3JpcHQgaXMgdXNlZCB0byB0ZXN0IHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICogSXQgdXNlcyB0aGUgdGNjdXRpbCBjb21tYW5kIHRvIHRlc3QgYW5kIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICogSXQgcmV0dXJucyB0cnVlIGlmIHRoZSBuZXR3b3JrIHBlcm1pc3Npb25zIGFyZSBhbGxvd2VkIGFuZCBmYWxzZSBpZiB0aGV5IGFyZSBub3RcbiAqIFxuICogVGhpcyBjb3VsZCBhbHNvIGJlIHVzZWQgdG8gdGVzdCBvdGhlciBwZXJtaXNzaW9ucyBsaWtlIGFjY2Vzc2liaWxpdHksIHNjcmVlbiBjYXB0dXJlLCBldGMuIFxuICogc2VlIGNvbW11bmljYXRpb25oYW5kbGVyLmpzIGZvciBtb3JlIGRldGFpbHMgb24gaG93IHRvIHRlc3QgZm9yIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgKGl0cyBub3QgcG9zc2libGUgdG8gdGVzdCBmb3Igc2NyZWVuIGNhcHR1cmUgcGVybWlzc2lvbnMgb24gbWFjb3MgYmVjYXVzZSB3aXRob3V0IHBlcm1pc3Npb25zIGl0IHdpbGwgYWx3YXlzIHJldHVybiBhIGJsYW5rIHNjcmVlbnNob3QgLSB3ZSB1c2UgYSB3b3JrYXJvdW5kIHRvIGRldGVjdCB0aGlzKVxuICogXG4gKi9cblxuXG5cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBydW4gdGNjdXRpbFxuaW1wb3J0IHsgZGlhbG9nLCBhcHAgfSBmcm9tICdlbGVjdHJvbicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2hvdyBkaWFsb2cgYW5kIHF1aXRcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuXG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAgICAgICAgICAgICAgICAvLyByZXR1cm5zIHRydWUgaWYgZmV0Y2ggd29ya3NcbiAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHtzZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9wb25nYCwgeyBtZXRob2Q6ICdHRVQnLCBjYWNoZTogJ25vLXN0b3JlJyB9KSAvLyB0ZXN0IHJlcXVlc3RcbiAgICAgICAgICAgIHJldHVybiByZXMub2tcbiAgICB9IGNhdGNoIHsgIHJldHVybiBmYWxzZSB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNldFRDQygpIHsgICAgICAvLyByZXNldCBUQ0MgcGVybWlzc2lvbnNcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvL2FwcElkXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS5zdHVkZW50YCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcbiAgICAgICAgLy9hcHBCdW5kbGVJZCAoc2V0IHZpYSBub3Rhcml6ZSlcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLXN0dWRlbnQuYXBwYCwgKGVyciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoeyBlcnIsIHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgICAgICByZXNvbHZlKHsgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgfSlcblxuXG4gICAgfSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7IC8vIGNoZWNrIG9yIHJlc2V0XG4gICAgY29uc3Qgb2sgPSBhd2FpdCB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpXG4gICAgaWYgKG9rKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5ldHdvcmsgYWNjZXNzIGlzIGFsbG93ZWRgKTtcbiAgICAgICAgICAgIHJldHVybiBcIm9rXCI7XG4gICAgfVxuICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTm8gSFRUUCByZXF1ZXN0cyBhbGxvd2VkIWAgKVxuXG4gICAgdHJ5IHtcblxuICAgICAgICAvLyBhc2sgdGhlIHVzZXJzIGlmIHRoZXkgd2FudCB0byByZXNldCB0aGUgcGVybWlzc2lvbnMgYW5kIGV4aXQgdGhlIGFwcCBpZiB0aGV5IGRvXG4gICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEZXIgU2VydmVyIGlzdCBuaWNodCBlcnJlaWNoYmFyLiBNXHUwMEY2Y2h0ZW4gU2llIGRpZSBCZXJlY2h0aWd1bmdlbiB6dXJcdTAwRkNja3NldHplbiB1bmQgTmV4dC1FeGFtIG1hbnVlbGwgbmV1IHN0YXJ0ZW4/JyxcbiAgICAgICAgICAgIGJ1dHRvbnM6IFsnT0snLCAnQWJicmVjaGVuJ10sXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChjaG9pY2UucmVzcG9uc2UgPT09IDApIHsgICAgLy8gcmVzZXQgcGVybWlzc2lvbnMgYW5kIHJldHVybiB0cnVlIHRvIHF1aXQgdGhlIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBSZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9ucyBhbmQgcXVpdHRpbmcgYXBwYCk7XG4gICAgICAgICAgICBhd2FpdCByZXNldFRDQygpOyBcbiAgICAgICAgICAgIHJldHVybiBcInJlc2V0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlIFxuICAgICAgICB9ICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gXG4gICAgfSBcbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBsb2cuZXJyb3IoYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBFcnJvciByZXNldHRpbmcgbmV0d29yayBwZXJtaXNzaW9uczogJHtlfWApO1xuICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3goe1xuICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdGZWhsZXIgYmVpbSBadXJcdTAwRkNja3NldHplbiBkZXIgQmVyZWNodGlndW5nZW4nLFxuICAgICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZS5lcnIgfHwgZSksXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBmYWxzZSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuICAgIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gQ291bnRlciBmb3IgZmFpbGVkIGF0dGVtcHRzIC0gc2tpcCBleGVjdXRpb24gYWZ0ZXIgNCBjb25zZWN1dGl2ZSBmYWlsdXJlc1xubGV0IGZhaWx1cmVDb3VudGVyID0gMDtcbmNvbnN0IE1BWF9GQUlMVVJFUyA9IDM7XG5cbi8vIENvbnZlcnQgUlNTSSBpbiBkQm0gdG8gYSBxdWFsaXR5IHBlcmNlbnRhZ2UgYmV0d2VlbiAwIGFuZCAxMDAuXG5mdW5jdGlvbiBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSkge1xuICAgIGlmIChkYm0gPT09IG51bGwgfHwgTnVtYmVyLmlzTmFOKGRibSkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IG1pbkRibSA9IC0xMDA7XG4gICAgY29uc3QgbWF4RGJtID0gLTMwO1xuICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heChtaW5EYm0sIE1hdGgubWluKG1heERibSwgZGJtKSk7XG4gICAgY29uc3QgcGVyY2VudCA9ICgoY2xhbXBlZCAtIG1pbkRibSkgLyAobWF4RGJtIC0gbWluRGJtKSkgKiAxMDA7XG4gICAgcmV0dXJuIE1hdGgucm91bmQocGVyY2VudCk7XG59XG5cbi8qKlxuICogR2V0IGN1cnJlbnQgV0xBTiBpbmZvcm1hdGlvbiAoU1NJRCwgQlNTSUQsIFF1YWxpdHkpXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7c3NpZDogc3RyaW5nfG51bGwsIGJzc2lkOiBzdHJpbmd8bnVsbCwgcXVhbGl0eTogbnVtYmVyfG51bGwsIG1lc3NhZ2U6IHN0cmluZ3xudWxsfT59XG4gKiBAZGVzY3JpcHRpb24gbWVzc2FnZSBjYW4gYmU6IFwiZXJyb3JcIiAob24gZXJyb3IpLCBcIm5vaW50ZXJmYWNlXCIgKG5vIGludGVyZmFjZSBhdmFpbGFibGUpLCBcIm5vcGVybWlzc2lvbnNcIiAobG9jYXRpb24gcGVybWlzc2lvbnMgbWlzc2luZyBvbiBXaW5kb3dzKSwgb3IgbnVsbCAoc3VjY2VzcylcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvKCkge1xuICAgIC8vIFNraXAgZXhlY3V0aW9uIGlmIHdlJ3ZlIGhhZCB0b28gbWFueSBjb25zZWN1dGl2ZSBmYWlsdXJlc1xuICAgIGlmIChmYWlsdXJlQ291bnRlciA+PSBNQVhfRkFJTFVSRVMpIHtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICB9XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICBcbiAgICAgICAgc3dpdGNoIChwbGF0Zm9ybSkge1xuICAgICAgICAgICAgY2FzZSAnbGludXgnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTGludXgoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9NYWNPUygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEVuc3VyZSByZXN1bHQgaXMgYWx3YXlzIGFuIG9iamVjdFxuICAgICAgICBpZiAoIXJlc3VsdCB8fCB0eXBlb2YgcmVzdWx0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlc2V0IGNvdW50ZXIgb24gc3VjY2Vzc2Z1bCByZXN1bHQgKGhhcyBkYXRhKVxuICAgICAgICBpZiAocmVzdWx0LnNzaWQgfHwgcmVzdWx0LmJzc2lkIHx8IHJlc3VsdC5xdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlciA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbmNyZW1lbnQgY291bnRlciBvbiBmYWlsdXJlXG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIFJldHVybiBlbXB0eSBvYmplY3QgaW5zdGVhZCBvZiB0aHJvd2luZyB0byBwcmV2ZW50IGFwcCBjcmFzaFxuICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIExpbnV4IHVzaW5nIG5tY2xpICh3aXRoIGZhbGxiYWNrIHRvIGl3L2l3Y29uZmlnKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb0xpbnV4KCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBubWNsaSBmaXJzdCAobW9zdCBjb21tb24gb24gbW9kZXJuIExpbnV4KVxuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZ2V0IGFjdGl2ZSBkZXZpY2UgZGlyZWN0bHkgKGZhc3RlciB0aGFuIGxpc3RpbmcgYWxsIG5ldHdvcmtzKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHN0ZG91dCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYygnbm1jbGkgLXQgLWYgYWN0aXZlLHNzaWQsYnNzaWQsc2lnbmFsIGRldmljZSB3aWZpIGxpc3QnLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDQwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3Rkb3V0ID0gcmVzdWx0LnN0ZG91dDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBjYXRjaCAoZXhlY0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gRXZlbiBpZiBleGVjQXN5bmMgdGhyb3dzIGFuIGVycm9yLCBjaGVjayBpZiBzdGRvdXQgY29udGFpbnMgdmFsaWQgZGF0YVxuICAgICAgICAgICAgICAgIC8vIG5tY2xpIHNvbWV0aW1lcyByZXR1cm5zIG5vbi16ZXJvIGV4aXQgY29kZSBidXQgc3RpbGwgcHJvdmlkZXMgdmFsaWQgb3V0cHV0XG4gICAgICAgICAgICAgICAgaWYgKGV4ZWNFcnJvci5zdGRvdXQgJiYgZXhlY0Vycm9yLnN0ZG91dC50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzdGRvdXQgPSBleGVjRXJyb3Iuc3Rkb3V0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4ZWNFcnJvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvdXRwdXQgZnJvbSBubWNsaScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQudHJpbSgpLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmluZCBhY3RpdmUgY29ubmVjdGlvblxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICAgICAgaWYgKChwYXJ0c1swXSA9PT0gJ3llcycgfHwgcGFydHNbMF0gPT09ICdqYScpICYmIHBhcnRzLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBwYXJ0c1sxXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgLy8gQlNTSUQgaXMgYSBNQUMgYWRkcmVzcyAoNiBoZXggYnl0ZXMgc2VwYXJhdGVkIGJ5IGNvbG9ucywgcG9zc2libHkgZXNjYXBlZClcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCB1c2luZyByZWdleCAtIGhhbmRsZSBlc2NhcGVkIGNvbG9ucyAoXFw6KSBhcyBzaG93biBpbiBubWNsaSBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gcmVnZXggc3RyaW5nLCBcXFxcOiBtYXRjaGVzIGEgbGl0ZXJhbCBiYWNrc2xhc2ggZm9sbG93ZWQgYnkgY29sb25cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86XFxcXDpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZXNjYXBlIGJhY2tzbGFzaGVzIGFuZCBub3JtYWxpemUgdG8gdXBwZXJjYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2hbMF0ucmVwbGFjZSgvXFxcXDovZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBub3JtYWwgY29sb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxNYXRjaCA9IGxpbmUubWF0Y2goL1thLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbm9ybWFsTWF0Y2hbMF0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBwYXJ0c1syXSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTaWduYWwgaXMgdGhlIGxhc3QgbnVtZXJpYyBwYXJ0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbFN0ciA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID8gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0udHJpbSgpIDogJyc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IHNpZ25hbFN0ciA/IChwYXJzZUludChzaWduYWxTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChubWNsaUVycm9yKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQsIGV0Yy4pLCBub3QgaWYganVzdCBubyBXTEFOIGFjdGl2ZVxuICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBubWNsaUVycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChubWNsaUVycm9yLm1lc3NhZ2UgJiYgIW5tY2xpRXJyb3IubWVzc2FnZS5pbmNsdWRlcygnTm8gb3V0cHV0JykpO1xuICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBubWNsaSBjb21tYW5kIGZhaWxlZDonLCBubWNsaUVycm9yLm1lc3NhZ2UgfHwgbm1jbGlFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGl3IChpd2NvbmZpZyBpcyBkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtRSBcIl5cXHMqc3NpZHxeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXdsaW5rU3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUEgNSBcIl5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgU1NJRFxuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGl3U3Rkb3V0ID8gaXdTdGRvdXQubWF0Y2goL3NzaWRcXHMrKC4rKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gc3NpZE1hdGNoID8gc3NpZE1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBCU1NJRCBhbmQgc2lnbmFsIGZyb20gbGluayBpbmZvXG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvYWRkcjpcXHMrKFthLWYwLTk6XXsxN30pL2kpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9zaWduYWw6XFxzKygtP1xcZCspLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbERibSA9IHNpZ25hbE1hdGNoID8gKHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1YWxpdHkgPSBzaWduYWxEYm0gIT09IG51bGwgPyBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbERibSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGl3RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IGl3IGNvbW1hbmQgZmFpbGVkOicsIGl3RXJyb3IubWVzc2FnZSB8fCBpd0Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gTGFzdCBmYWxsYmFjazogaXdjb25maWcgKGRlcHJlY2F0ZWQgYnV0IHdpZGVseSBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXdjb25maWcgMj4vZGV2L251bGwgfCBncmVwIC1FIFwiRVNTSUR8QWNjZXNzIFBvaW50fFNpZ25hbCBsZXZlbFwiJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9FU1NJRDpcIihbXlwiXSspXCIvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzc2lkTWF0Y2gpIHNzaWQgPSBzc2lkTWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9BY2Nlc3MgUG9pbnQ6XFxzKyhbYS1mMC05Ol17MTd9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChic3NpZE1hdGNoKSBic3NpZCA9IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9TaWduYWwgbGV2ZWw9KC0/XFxkKykvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5OiBkYm1Ub1F1YWxpdHlQZXJjZW50KHNpZ25hbCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaXdjb25maWdFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IGxvZyBpZiBhbGwgbWV0aG9kcyBmYWlsZWQgd2l0aCByZWFsIGVycm9ycyAoY29tbWFuZCBub3QgZm91bmQsIHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gaXdjb25maWdFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFVElNRURPVVQnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogQWxsIG1ldGhvZHMgKG5tY2xpLCBpdywgaXdjb25maWcpIGZhaWxlZC4gTGFzdCBlcnJvcjonLCBpd2NvbmZpZ0Vycm9yLm1lc3NhZ2UgfHwgaXdjb25maWdFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdlcnJvcidcbiAgICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3NpZDogbnVsbCxcbiAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgIG1lc3NhZ2U6ICdub2ludGVyZmFjZSdcbiAgICB9O1xufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBuZXRzaFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzaCB3bGFuIHNob3cgaW50ZXJmYWNlcycsIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIHN0ZGVyciBmb3Igc2VydmljZSBlcnJvcnNcbiAgICAgICAgY29uc3QgZXJyb3JPdXRwdXQgPSAoc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBvdXRwdXQgPSAoc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZE91dHB1dCA9IG91dHB1dCArICcgJyArIGVycm9yT3V0cHV0O1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgV0xBTiBzZXJ2aWNlIGlzIG5vdCBydW5uaW5nICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW5zdmMnKSB8fCBcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuIGF1dG9jb25maWcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2F1dG9tYXRpc2NoIHdsYW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4ta29uZmlndXJhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2lzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzZXJ2aWNlIGlzIG5vdCBydW5uaW5nJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkZXIgZGllbnN0JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlIGFyZSBubyBpbnRlcmZhY2VzIGF2YWlsYWJsZVxuICAgICAgICBpZiAoc3Rkb3V0LmluY2x1ZGVzKCdUaGVyZSBpcyBubyB3aXJlbGVzcyBpbnRlcmZhY2UnKSB8fCBcbiAgICAgICAgICAgIHN0ZG91dC5pbmNsdWRlcygnRXMgZ2lidCBrZWluZSBEcmFodGxvcy1TY2huaXR0c3RlbGxlJykgfHxcbiAgICAgICAgICAgIHN0ZG91dC5tYXRjaCgvTm8gd2lyZWxlc3MvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSkuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUsIGhhbmRsZXMgdmFyaW91cyBmb3JtYXRzXG4gICAgICAgICAgICAvLyBVc2UgbmVnYXRpdmUgbG9va2JlaGluZCB0byBlbnN1cmUgd2UgZG9uJ3QgbWF0Y2ggXCJCU1NJRFwiICh3aGljaCBjb250YWlucyBcIlNTSURcIilcbiAgICAgICAgICAgIGlmIChsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOlxccyooLispL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0ZWQgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgc2V0IGlmIG5vdCBlbXB0eSBhbmQgbm90IFwiTi9BXCIgb3Igc2ltaWxhclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkICYmIGV4dHJhY3RlZC5sZW5ndGggPiAwICYmICFleHRyYWN0ZWQubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkID0gZXh0cmFjdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQlNTSUQgcGFyc2luZyAtIG1vcmUgZmxleGlibGUgcGF0dGVybiBtYXRjaGluZ1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvQlNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiAoaGFuZGxlcyBib3RoIC0gYW5kIDogc2VwYXJhdG9ycywgd2l0aCBvciB3aXRob3V0IHNwYWNlcylcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEXFxzKjpcXHMqKFthLWYwLTldezJ9KD86Wy06XFxzXVthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gbWF0Y2hbMV0ucmVwbGFjZSgvWy0gXS9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gU2lnbmFsIHBhcnNpbmcgLSBoYW5kbGUgdmFyaW91cyBsb2NhbGl6ZWQgZm9ybWF0cyBhbmQgcGF0dGVybnNcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL1NpZ25hbHxTaWduYWxzdFx1MDBFNHJrZXxJbnRlbnNpdFx1MDBFOXxTZVx1MDBGMWFsL2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHBlcmNlbnRhZ2UgcGF0dGVybiBmaXJzdCAobW9zdCBjb21tb24pXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooXFxkKylcXHMqJS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihwYXJzZWQpICYmIHBhcnNlZCA+PSAwICYmIHBhcnNlZCA8PSAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSBkQm0gcGF0dGVybiAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gbGluZS5tYXRjaCgvOlxccyooLT9cXGQrKVxccypkQm0vaSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGJtID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4oZGJtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTm9ybWFsaXplIGVtcHR5IHN0cmluZ3MgdG8gbnVsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogKHNzaWQgJiYgc3NpZC5sZW5ndGggPiAwKSA/IHNzaWQgOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IChic3NpZCAmJiBic3NpZC5sZW5ndGggPiAwKSA/IGJzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBDaGVjayBpZiBlcnJvciBpcyBkdWUgdG8gbG9jYXRpb24gcGVybWlzc2lvbnMgKG1pZ2h0IGJlIGluIHN0ZGVyciBvciBlcnJvciBtZXNzYWdlKVxuICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSAoZXJyb3IubWVzc2FnZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRvdXQgPSAoZXJyb3Iuc3Rkb3V0IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZGVyciA9IChlcnJvci5zdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkRXJyb3JPdXRwdXQgPSBlcnJvck1lc3NhZ2UgKyAnICcgKyBlcnJvclN0ZG91dCArICcgJyArIGVycm9yU3RkZXJyO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSAmJiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbiBwZXJtaXNzaW9ucycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3Bvc2l0aW9uc2RpZW5zdGUnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwcml2YWN5JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBQb3dlclNoZWxsIG1ldGhvZCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gTG9nIGVycm9yIHdoZW4gY29tbWFuZCBleGVjdXRpb24gZmFpbHMgKHRpbWVvdXQsIHBlcm1pc3Npb24sIGV0Yy4pXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzOiBFcnJvciBleGVjdXRpbmcgbmV0c2ggY29tbWFuZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIFBvd2VyU2hlbGwgKGZhbGxiYWNrIHdoZW4gbmV0c2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGwoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIChkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24pXG4gICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgYWN0aXZlIFdpLUZpIGNvbm5lY3Rpb24gcHJvZmlsZVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncG93ZXJzaGVsbCAtQ29tbWFuZCBcIiRwcm9maWxlID0gR2V0LU5ldENvbm5lY3Rpb25Qcm9maWxlIHwgV2hlcmUtT2JqZWN0IHskXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2ktRmkqXFwnIC1vciAkXy5JbnRlcmZhY2VBbGlhcyAtbGlrZSBcXCcqV2lyZWxlc3MqXFwnfSB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDE7IGlmICgkcHJvZmlsZSkgeyAkcHJvZmlsZS5OYW1lIH1cIicsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHNzaWRTdHIgPSBzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIGlmIChzc2lkU3RyICYmIHNzaWRTdHIubGVuZ3RoID4gMCAmJiAhc3NpZFN0ci5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZFN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEJTU0lEIGNhbm5vdCBiZSBlYXNpbHkgcmV0cmlldmVkIHdpdGhvdXQgbmV0c2ggKHdoaWNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICAgICAgICAvLyBTZXR0aW5nIHRvIG51bGwgYXMgZmFsbGJhY2sgLSBTU0lEIGlzIHRoZSBtb3N0IGltcG9ydGFudCBpbmZvcm1hdGlvbiBhbnl3YXlcbiAgICAgICAgY29uc3QgYnNzaWQgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIFBvd2VyU2hlbGwgZmFsbGJhY2sgKGNhbid0IGVhc2lseSBnZXQgc2lnbmFsIHN0cmVuZ3RoIHdpdGhvdXQgbmV0c2gpXG4gICAgICAgIC8vIFJldHVybiBub3Blcm1pc3Npb25zIG1lc3NhZ2Ugc28gZnJvbnRlbmQgY2FuIHNob3cgdGhlIHdhcm5pbmdcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdub3Blcm1pc3Npb25zJ1xuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyBlcnJvciBpZiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxzXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbDogUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsZWQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gbWFjT1MgdXNpbmcgYWlycG9ydCBvciBuZXR3b3Jrc2V0dXBcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9NYWNPUygpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgYWlycG9ydCBjb21tYW5kIGZpcnN0IChkZXByZWNhdGVkIGJ1dCBzdGlsbCBhdmFpbGFibGUgb24gc29tZSBzeXN0ZW1zKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYWlycG9ydCBpcyBhdmFpbGFibGUgKHVzdWFsbHkgYXQgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQpXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYWlycG9ydFBhdGggfSA9IGF3YWl0IGV4ZWNBc3luYygnd2hpY2ggYWlycG9ydCAyPi9kZXYvbnVsbCB8fCBlY2hvIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0Jywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDEwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgYWlycG9ydCA9IGFpcnBvcnRQYXRoLnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgJHthaXJwb3J0fSAtSWAsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBsaW5lLnRyaW0oKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcnNzaURibSA9IG51bGw7XG4gICAgICAgICAgICBsZXQgc2lnbmFsUGVyY2VudCA9IG51bGw7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ1NTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGxpbmUucmVwbGFjZSgnU1NJRDonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdCU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gdG8gZW5zdXJlIHdlIGdldCB0aGUgZnVsbCBCU1NJRFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQlNTSUQ6XFxzKihbYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkTWF0Y2ggPyBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdhZ3JDdGxSU1NJOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJTU0kgaW4gZEJtIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaVN0ciA9IGxpbmUucmVwbGFjZSgnYWdyQ3RsUlNTSTonLCAnJykudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpID0gcnNzaVN0ciA/IChwYXJzZUludChyc3NpU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICByc3NpRGJtID0gcnNzaTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnbGluayBhdXRoOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFsdGVybmF0aXZlOiBzaWduYWwgc3RyZW5ndGggYXMgcGVyY2VudGFnZSAoaWYgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goLyhcXGQrKSUvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoICYmIHNpZ25hbFBlcmNlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KHNpZ25hbE1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxQZXJjZW50ID0gaXNOYU4ocGFyc2VkKSA/IG51bGwgOiBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBxdWFsaXR5ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChzaWduYWxQZXJjZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IHNpZ25hbFBlcmNlbnQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJzc2lEYm0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gZGJtVG9RdWFsaXR5UGVyY2VudChyc3NpRGJtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHNzaWQgfHwgYnNzaWQgfHwgcXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChhaXJwb3J0RXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIG5ldHdvcmtzZXR1cCAtIG9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChub3QganVzdCBubyBwZXJtaXNzaW9uKVxuICAgICAgICAgICAgaWYgKGFpcnBvcnRFcnJvci5jb2RlICE9PSAnRU5PRU5UJyAmJiBhaXJwb3J0RXJyb3IubWVzc2FnZSAmJiAhYWlycG9ydEVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ3Blcm1pc3Npb24nKSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogYWlycG9ydCBjb21tYW5kIGZhaWxlZDonLCBhaXJwb3J0RXJyb3IubWVzc2FnZSB8fCBhaXJwb3J0RXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjazogbmV0d29ya3NldHVwIGFuZCBpcGNvbmZpZyAoZm9yIG5ld2VyIG1hY09TIHdoZXJlIGFpcnBvcnQgaXMgbm90IGF2YWlsYWJsZSkgIC8vIHN5c3RlbV9wcm9maWxlciBpcyB3YXkgdG8gaGVhdnkgYW5kIG5lZWRzIGEgbG9vb29vdCBvZiB0aW1lIHRvIHByb2Nlc3NcbiAgICAgICAgLy8gdGhpcyBpcyBhIHNpbXBsZSBjYWxjdWxhdGlvbi4uIHdlIGNhbid0IHJlbHkgb24gYSBwcm9jZXNzIHRoYXQgdGFrZXMgMTBzIHRvIGNvbXBsZXRlIGFuZCBibG9ja3MgdGhlIHdob2xlIHN5c3RlbVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIFdMQU4gaW50ZXJmYWNlIHVzaW5nIG5ldHdvcmtzZXR1cFxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGludGVyZmFjZU91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXR3b3Jrc2V0dXAgLWxpc3RhbGxoYXJkd2FyZXBvcnRzIHwgYXdrIFxcJy9XaS1GaXxBaXJQb3J0L3tnZXRsaW5lOyBwcmludCAkTkZ9XFwnJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgaW50ZXJmYWNlTmFtZSA9IGludGVyZmFjZU91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghaW50ZXJmYWNlTmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIE5vIFdpLUZpIGludGVyZmFjZSBmb3VuZFxuICAgICAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGF3ayAtRicgU1NJRCA6ICcgJy8gU1NJRCA6IC8ge3ByaW50ICQyfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRPdXRwdXQudHJpbSgpIHx8IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBTU0lEIGV4dHJhY3Rpb24gZmFpbGVkLCBjb250aW51ZSB3aXRoIEJTU0lEXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBCU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogYnNzaWRPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgaXBjb25maWcgZ2V0c3VtbWFyeSBcIiR7aW50ZXJmYWNlTmFtZX1cIiB8IGdyZXAgJ0JTU0lEIDonIHwgYXdrICd7cHJpbnQgJDN9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZFN0ciA9IGJzc2lkT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBCU1NJRCBmb3JtYXQgKE1BQyBhZGRyZXNzKVxuICAgICAgICAgICAgICAgIGlmIChic3NpZFN0ciAmJiAvXlthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSQvaS50ZXN0KGJzc2lkU3RyKSkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IGJzc2lkU3RyLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoYnNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEJTU0lEIGV4dHJhY3Rpb24gZmFpbGVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBmYWxsYmFjayAoYWlycG9ydCBub3QgYXZhaWxhYmxlLCBjYW4ndCBnZXQgc2lnbmFsIHN0cmVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChuZXR3b3Jrc2V0dXBFcnJvcikge1xuICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIG5ldHdvcmtzZXR1cCBmYWlscyB3aXRoIGEgcmVhbCBlcnJvclxuICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBuZXR3b3Jrc2V0dXAvaXBjb25maWcgZmFsbGJhY2sgZmFpbGVkOicsIG5ldHdvcmtzZXR1cEVycm9yLm1lc3NhZ2UgfHwgbmV0d29ya3NldHVwRXJyb3IpO1xuICAgICAgICAgICAgLy8gSWYgZmFsbGJhY2sgY29tcGxldGVseSBmYWlscywgcmV0dXJuIGVycm9yIG9iamVjdFxuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHsgZ2V0V2xhbkluZm8gfTtcblxuXG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgLy8gRXhlY3V0ZSAndGFza2xpc3QgL2ZvIGNzdicgKHN0cnVjdHVyZWQgZm9ybWF0LCBmYXN0ZXIgdGhhbiAvdiwgc3RpbGwgc2hvd3MgcHJvY2VzcyBuYW1lcylcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd0YXNrbGlzdCAvZm8gY3N2JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICduZXRzdGF0IC1hbm8nIChzaG93cyBhbGwgY29ubmVjdGlvbiBzdGF0ZXMgaW5jbHVkaW5nIEVTVEFCTElTSEVEIGZvciBzY3JlZW5zaGFyaW5nIGRldGVjdGlvbilcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCduZXRzdGF0IC1hbm8nLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gUmVnZXggdG8gZmluZCA6UE9SVCBmb2xsb3dlZCBieSBhIHNwYWNlIChlbnN1cmVzIGV4YWN0IHBvcnQgbWF0Y2gsIGUuZy4sIDo1OTM4IClcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9XFxcXHNgLCAnZycpIFxuICAgICAgaWYgKHJlZ2V4LnRlc3Qoc3Rkb3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsJ2NvbS5taWNyb3NvZnQudGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLCdjaGF0Z3B0JyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1J1xuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNlxuXTtcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywgJ3RlYW1zJyxcbiAgJ2Nocm9tZXJlbW90ZWRlc2t0b3AnLCAnc3BsYXNodG9wJywgJ2R3YWdlbnQnLFxuICAnbG9nbWVpbicsICdzY3JlZW5jb25uZWN0JywgJ3pvaG8nLCAncGFyYWxsZWxzJyxcbiAgJ3JlbW90ZXV0aWxpdGllcycsICdnMmNvbW0nLCAncGN2aXNpdCcsICdwY3Zpc2l0X3N1cHBvcnQnLCAncGN2aXNpdF9jdXN0b21lcicsICdzdXBwb3J0IDE1Jyxcbl1cblxuY29uc3Qgc3VzcGljaW91c1BvcnRzID0gW1xuICAyMDAyLCA1MjIyLCA1NjUwLCA1OTAwLCA1OTAxLCA1OTAyLCA1OTM4LFxuICA3MDcwLCA2NzgzLCA2Nzg0LCA2Nzg1LCA4MDQwLCA4MDQxLCA4MDQyLCAyMTExNSwgMjExMTYsXG5dXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJvY2Vzc2VzKCkge1xuICBjb25zdCBmb3VuZEtleXdvcmRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3BzIGF1eCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBzdXNwaWNpb3VzS2V5d29yZHMpIHtcbiAgICAgIGlmIChvdXQuaW5jbHVkZXMoa2V5d29yZCkpIHtcbiAgICAgICAgZm91bmRLZXl3b3Jkcy5wdXNoKGtleXdvcmQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZEtleXdvcmRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUG9ydHMoKSB7XG4gIGNvbnN0IGZvdW5kUG9ydHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbHNvZiAtaSAtbiAtUCcsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBjb25zdCBvdXQgPSBzdGRvdXQudG9Mb3dlckNhc2UoKVxuICAgIFxuICAgIGZvciAoY29uc3QgcG9ydCBvZiBzdXNwaWNpb3VzUG9ydHMpIHtcbiAgICAgIC8vIE1hdGNoIGV4YWN0IHBvcnQgbnVtYmVyOiA6UE9SVCBmb2xsb3dlZCBieSBzcGFjZSwgLT4sICgsIG9yIGVuZCBvZiBsaW5lXG4gICAgICAvLyBUaGlzIHByZXZlbnRzIG1hdGNoaW5nIDo1MyBpbnNpZGUgOjUzNTU0M1xuICAgICAgY29uc3QgcG9ydFJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH0oPzpcXFxcc3wtPnxcXFxcKHwkKWAsICdpJyk7XG4gICAgICBpZiAocG9ydFJlZ2V4LnRlc3Qob3V0KSkge1xuICAgICAgICBmb3VuZFBvcnRzLnB1c2gocG9ydClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kUG9ydHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKCkge1xuICB0cnkge1xuICAgIC8vIFJ1biBib3RoIGNoZWNrcyBpbiBwYXJhbGxlbCB3aXRoIHRpbWVvdXRcbiAgICBjb25zdCBbZm91bmRLZXl3b3JkcywgZm91bmRQb3J0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBjaGVja1Byb2Nlc3NlcygpLFxuICAgICAgY2hlY2tQb3J0cygpXG4gICAgXSlcbiAgICBcbiAgICBpZiAoZm91bmRLZXl3b3Jkcy5sZW5ndGggPT09IDAgJiYgZm91bmRQb3J0cy5sZW5ndGggPT09IDApIHsgXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgLy8gUmV0dXJuIGZvdW5kIGtleXdvcmRzIGFuZCBwb3J0c1xuICAgICAga2V5d29yZHM6IGZvdW5kS2V5d29yZHMsXG4gICAgICBwb3J0czogZm91bmRQb3J0cyxcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlICAvLyBSZXR1cm4gZmFsc2Ugb24gYW55IGVycm9yXG4gIH1cbn1cbiIsICJpbXBvcnQgKiBhcyB3aW4gZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVXaW4uanMnXG5pbXBvcnQgKiBhcyBtYWMgZnJvbSAnLi9yZW1vdGVjaGVjay9yZW1vdGVNYWMuanMnXG5pbXBvcnQgKiBhcyBsaW51eCBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blJlbW90ZUNoZWNrKHBsYXRmb3JtID0gJ3dpbjMyJykge1xuICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHJldHVybiBhd2FpdCB3aW4ucnVuUmVtb3RlQ2hlY2soKVxuICBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nKSByZXR1cm4gYXdhaXQgbWFjLnJ1blJlbW90ZUNoZWNrKClcbiAgcmV0dXJuIGF3YWl0IGxpbnV4LnJ1blJlbW90ZUNoZWNrKClcbn1cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIEV4cGFuZGVkIGJyb3dzZXIga2V5d29yZHMgdG8gY2F0Y2ggbW9yZSB2YXJpYW50c1xuY29uc3QgYnJvd3NlcktleXdvcmRzID0gW1xuICAgICdjaHJvbScsICdjaHJvbWUuZXhlJyxcbiAgICAnZWRnZScsICdtc2VkZ2UuZXhlJyxcbiAgICAnZmlyZScsICdmaXJlZm94LmV4ZScsXG4gICAgJ2JyYXZlJywgJ2JyYXZlLmV4ZScsXG4gICAgJ29wZXJhJywgJ29wZXJhLmV4ZScsXG4gICAgJ2Jyb3dzZXInLCAvLyBHZW5lcmljIGJyb3dzZXIgcHJvY2Vzc1xuICAgICdpZXhwbG9yZScsIC8vIEludGVybmV0IEV4cGxvcmVyXG4gICAgJ3NhZmFyaScsIC8vIEZvciBtYWNPU1xuXTtcblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9jZXNzSW5mb1dpbmRvd3MocGlkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwb3dlcnNoZWxsLmV4ZSAtTm9Mb2dvIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCImIHsgJHByb2MgPSBHZXQtQ2ltSW5zdGFuY2UgLUNsYXNzIFdpbjMyX1Byb2Nlc3MgLUZpbHRlciAnUHJvY2Vzc0lkPSR7cGlkfSc7IGlmICgkcHJvYykgeyAkcHJvYy5QYXJlbnRQcm9jZXNzSWQ7ICRwcm9jLk5hbWUgfSB9XCJgO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lKTtcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQobGluZXNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IGxpbmVzWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvV2luZG93czogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gVW5peCBzeXN0ZW1zIChMaW51eC9tYWNPUylcbiAqIFRyaWVzIC9wcm9jIGZpcnN0IChMaW51eCBvbmx5LCBmYXN0ZXN0KSwgZmFsbHMgYmFjayB0byBwcyBjb21tYW5kXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvVW5peChwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QgbWV0aG9kIH40bXMsIG5vIHByb2Nlc3Mgc3Bhd24pXG4gICAgICAgIGNvbnN0IFtzdGF0Q29udGVudCwgY29tbUNvbnRlbnRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9zdGF0YCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKSxcbiAgICAgICAgICAgIHJlYWRGaWxlKGAvcHJvYy8ke3BpZH0vY29tbWAsICd1dGY4JykuY2F0Y2goKCkgPT4gbnVsbClcbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhdENvbnRlbnQpIHtcbiAgICAgICAgICAgIC8vIFBhcnNlIC9wcm9jL3BpZC9zdGF0OiBwaWQgKGNvbW0pIHN0YXRlIHBwaWQgLi4uXG4gICAgICAgICAgICBjb25zdCBzdGF0TWF0Y2ggPSBzdGF0Q29udGVudC5tYXRjaCgvXlxcZCtcXHMrXFwoKFteKV0rKVxcKVxccytcXFMrXFxzKyhcXGQrKS8pO1xuICAgICAgICAgICAgaWYgKHN0YXRNYXRjaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSAoY29tbUNvbnRlbnQgfHwgc3RhdE1hdGNoWzFdKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQoc3RhdE1hdGNoWzJdLCAxMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBwcyBjb21tYW5kICh3b3JrcyBvbiBib3RoIExpbnV4IGFuZCBtYWNPUylcbiAgICAgICAgY29uc3QgY29tbWFuZCA9IGBwcyAtcCAke3BpZH0gLW8gcHBpZD0sY29tbT1gO1xuICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGNvbW1hbmQsIHtcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHN0ZG91dC50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwcGlkID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzTmFOKHBwaWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHsgcHBpZCwgbmFtZSB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcihgY2hlY2twYXJlbnQgQCBnZXRQcm9jZXNzSW5mb1VuaXg6IEVycm9yIGZvciBQSUQgJHtwaWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgcHJvY2VzcyBpbmZvIGJhc2VkIG9uIHBsYXRmb3JtXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvKHBpZCkge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICBcbiAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpO1xuICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdsaW51eCcgfHwgcGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9jZXNzSW5mb1VuaXgocGlkKTsgLy8gTGludXgvbWFjT1M6IHRyaWVzIC9wcm9jLCBmYWxscyBiYWNrIHRvIHBzXG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHBhcmVudCBwcm9jZXNzZXMgZm9yIGJyb3dzZXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZmluZFBhcmVudFByb2Nlc3MocGlkLCBtYXhEZXB0aCwgdmlzaXRlZFBpZHMpIHtcbiAgICBpZiAocGlkID09PSAxIHx8IHBpZCA9PT0gMCkge1xuICAgICAgICBsb2cuaW5mbygnY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUm9vdCBQSUQgcmVhY2hlZC4gTm8gd2ViIGJyb3dzZXIgZm91bmQuJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKG1heERlcHRoIDw9IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIHdoZW4gbWF4IGRlcHRoIHJlYWNoZWRcbiAgICB9XG4gICAgXG4gICAgaWYgKHZpc2l0ZWRQaWRzLmhhcyhwaWQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gU2lsZW50IHJldHVybiBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlc1xuICAgIH1cbiAgICBcbiAgICB2aXNpdGVkUGlkcy5hZGQocGlkKTtcbiAgICBcbiAgICAvLyBHZXQgcHJvY2VzcyBpbmZvIChnZXRQcm9jZXNzSW5mbyBhbHJlYWR5IGhhcyBpdHMgb3duIHRpbWVvdXQgcHJvdGVjdGlvbilcbiAgICBjb25zdCBwcm9jZXNzSW5mbyA9IGF3YWl0IGdldFByb2Nlc3NJbmZvKHBpZCk7XG4gICAgXG4gICAgaWYgKCFwcm9jZXNzSW5mbykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHsgcHBpZCwgbmFtZSB9ID0gcHJvY2Vzc0luZm87XG4gICAgXG4gICAgLy8gTG9nIHRoZSBwcm9jZXNzIGluZm8gZm9yIGRlYnVnZ2luZ1xuICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBDaGVja2luZyBwcm9jZXNzOiAke25hbWV9IChQSUQ6ICR7cGlkfSwgUFBJRDogJHtwcGlkfSlgKTtcbiAgICBcbiAgICAvLyBNb3JlIHRob3JvdWdoIGJyb3dzZXIgZGV0ZWN0aW9uXG4gICAgaWYgKGJyb3dzZXJLZXl3b3Jkcy5zb21lKGJyb3dzZXIgPT4gbmFtZS5pbmNsdWRlcyhicm93c2VyKSkpIHtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IEJyb3dzZXIgZm91bmQ6ICR7bmFtZX1gKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIGlmIChuYW1lLmluY2x1ZGVzKCdleHBsb3JlcicpIHx8IHBwaWQgPD0gMSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogUmVhY2hlZCBzeXN0ZW0gcHJvY2VzcyBvciBleHBsb3JlcmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHBwaWQsIG1heERlcHRoIC0gMSwgdmlzaXRlZFBpZHMpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBwYXJlbnQgcHJvY2VzcyBpcyBhIGJyb3dzZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrUGFyZW50UHJvY2VzcygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBmb3VuZEJyb3dzZXIgPSBhd2FpdCBmaW5kUGFyZW50UHJvY2Vzcyhwcm9jZXNzLnBwaWQsIDYsIG5ldyBTZXQoKSk7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogQnJvd3NlciBkZXRlY3Rpb24gcmVzdWx0OiAke2ZvdW5kQnJvd3Nlcn1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZm91bmRCcm93c2VyIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGNoZWNrUGFyZW50UHJvY2VzczogRXJyb3IgaW4gYnJvd3NlciBkZXRlY3Rpb246ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGZvdW5kQnJvd3NlcjogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgfVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBdUJBLFNBQVMsWUFBQUEsaUJBQWdCO0FBQ3pCLE9BQU8sUUFBUTtBQUNmLFNBQVMsWUFBWTtBQUNyQixTQUFTLFdBQVc7QUFDcEIsT0FBTyxTQUFTOzs7QUN0QmhCLElBQU0sU0FBUztBQUFBLEVBQ1gsYUFBYTtBQUFBO0FBQUEsRUFDYixjQUFjO0FBQUEsRUFDZCxlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixXQUFXO0FBQUEsRUFFWCxlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIs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QVksTUFBTTtBQUFHLFdBQU87QUFBQSxFQUFNLENBQUM7QUFDL0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZXhlY1N5bmMiLCAiZXhlY1N5bmMiLCAibG9nIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgImdsb2JhbFNob3J0Y3V0IiwgIlRyYXkiLCAiTWVudSIsICJkaWFsb2ciLCAibG9nIiwgImxvZyIsICJwYXRoIiwgImZzIiwgImlwIiwgImdhdGV3YXk0c3luYyIsICJmcyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAibG9nIiwgImNvbmZpZ1N0b3JlIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJsb2ciLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgIl9fZGlybmFtZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgImxvZyIsICJhcHBzVG9DbG9zZSIsICJjaGlsZFByb2Nlc3MiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAibG9nIiwgInBhdGgiLCAiX19kaXJuYW1lIiwgImFwcCIsICJqb2luIiwgImZzIiwgImNvbmZpZyIsICJsb2ciLCAiZnMiLCAiam9pbiIsICJzY3JlZW4iLCAiaXBjTWFpbiIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJ3ZWJDb250ZW50cyIsICJwYXRoIiwgImZzIiwgImNsaXBib2FyZCIsICJhcHAiLCAib3MiLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImFwcCIsICJmcyIsICJwYXRoIiwgInByb2Nlc3MiLCAic3Bhd24iLCAiYXBwIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAic3Bhd24iLCAibG9nIiwgInByb2Nlc3MiLCAiZnMiLCAicGF0aCIsICJvcyIsICJfX2Rpcm5hbWUiLCAiYXBwIiwgInBhdGgiLCAibG9nIiwgImFwcCIsICJwYXRoIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAicHVibGljQmFzZSIsICJwYXRoIiwgInQiLCAibG9nIiwgImFwcCIsICJleGVjIiwgImRpYWxvZyIsICJhcHAiLCAibG9nIiwgImV4ZWMiLCAib3MiLCAibG9nIiwgImlzUmVhbEVycm9yIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgImNsaXBib2FyZCIsICJwYXRoIiwgImZzIiwgImVyciIsICJ3ZWJDb250ZW50cyIsICJvcyIsICJhcHAiLCAibG9nIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgIndlYkNvbnRlbnRzIiwgInNjcmVlbiIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
