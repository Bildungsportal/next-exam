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
      icon: join4(platformDispatcher_default.publicBase, "icons", "icon.png"),
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZWNoZWNrL3JlbW90ZUxpbi5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3JlbW90ZUNoZWNrLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvY2hlY2twYXJlbnQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLy8gdGhpcyBmaWxlIGlzIHVzZWQgdG8gc3RvcmUgdGhlIGNvbmZpZyBmb3IgdGhlIGVudmlyb25tZW50XG4vLyBpdCBxdWVyaWVzIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHRoZSBwbGF0Zm9ybSBhbmQgc2V0cyB0aGUgY29uZmlnIGFjY29yZGluZ2x5XG5cblxuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuZG90ZW52LmNvbmZpZygpO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY2xhc3MgUGxhdGZvcm1EaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG5cbiAgICB0aGlzLnBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICB0aGlzLl9hcmNoID0gcHJvY2Vzcy5hcmNoO1xuICAgIHRoaXMuX2VudiA9IHByb2Nlc3MuZW52O1xuXG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy5hcmNoID0gdGhpcy5fbm9ybWFsaXplQXJjaCgpO1xuICAgIHRoaXMuZGlzcGxheVNlcnZlciA9IHRoaXMuX2dldERpc3BsYXlTZXJ2ZXIoKTtcbiAgICB0aGlzLmlzS0RFID0gdGhpcy5faXNLREUoKTtcbiAgICB0aGlzLmlzR05PTUUgPSB0aGlzLl9pc0dOT01FKCk7XG4gICAgdGhpcy5mbGFtZXNob3QgPSB0aGlzLl9nZXRWZXJzaW9uKCdmbGFtZXNob3QnKTtcbiAgICB0aGlzLmltYWdlbWFnaWNrID0gdGhpcy5fZ2V0VmVyc2lvbignY29udmVydCcpO1xuICAgIHRoaXMuaW1WZXJzaW9uID0gdGhpcy5fZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCk7XG4gICAgdGhpcy53b3JrZXJGaWxlTmFtZSA9IHRoaXMuX2dldFdvcmtlckZpbGVOYW1lKCk7XG4gICAgdGhpcy51c2VXb3JrZXIgPSB0aGlzLl9nZXRVc2VXb3JrZXIoKTtcbiAgICB0aGlzLnNjcmVlbnNob3RBYmlsaXR5ID0gdGhpcy5fZ2V0U2NyZWVuc2hvdEFiaWxpdHkoKTtcbiAgICB0aGlzLmpyZSA9IHRoaXMuX2RldGVjdEpSRUlkKCk7XG4gICAgdGhpcy5wdWJsaWNCYXNlID0gdGhpcy5fZ2V0UHVibGljQmFzZSgpO1xuICAgIHRoaXMuanJlRGlyID0gdGhpcy5fcmVzb2x2ZUpSRURpcigpO1xuICAgIHRoaXMuamF2YUJpbiA9IHRoaXMuX3Jlc29sdmVKYXZhQmluKCk7XG4gICAgdGhpcy5qcmVJbmZvID0gdGhpcy5fZ2V0SlJFKCk7XG4gICAgXG4gICAgdGhpcy5ob21lZGlyZWN0b3J5ID0gb3MuaG9tZWRpcigpO1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICAgIHRoaXMud29ya2VyVVJMID0gdGhpcy5fZ2V0V29ya2VyVVJMKCk7XG4gICAgdGhpcy50ZW1wZGlyZWN0b3J5ID0gdGhpcy5fZ2V0VGVtcGRpcmVjdG9yeSgpO1xuICAgIHRoaXMud29ya2RpcmVjdG9yeSA9IHRoaXMuX2dldFdvcmtkaXJlY3RvcnkoKTtcbiAgICB0aGlzLmxvZ2ZpbGUgPSB0aGlzLl9nZXRMb2dmaWxlKCk7XG5cbiAgfVxuXG4gIF9nZXRQdWJsaWNCYXNlKCkge1xuICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgY29uc3QgdW5wYWNrZWQgPSBqb2luKHByb2Nlc3MucmVzb3VyY2VzUGF0aCwgJ2FwcC5hc2FyLnVucGFja2VkJyk7XG4gICAgICBjb25zdCB3aXRoUHVibGljID0gam9pbih1bnBhY2tlZCwgJ3B1YmxpYycpO1xuICAgICAgcmV0dXJuIGZzLmV4aXN0c1N5bmMod2l0aFB1YmxpYykgPyB3aXRoUHVibGljIDogdW5wYWNrZWQ7XG4gICAgfVxuICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICB9XG5cbiAgX2dldFdvcmtkaXJlY3RvcnkoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5ob21lZGlyZWN0b3J5LCBjb25maWcuY2xpZW50ZGlyZWN0b3J5KTtcbiAgfVxuXG4gIF9nZXRUZW1wZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKG9zLnRtcGRpcigpLCAnZXhhbS10bXAnKTtcbiAgfVxuXG5cbiAgX2dldExvZ2ZpbGUoKSB7XG4gICAgcmV0dXJuIGpvaW4odGhpcy53b3JrZGlyZWN0b3J5LCAnbmV4dC1leGFtLXN0dWRlbnQubG9nJyk7XG4gIH1cblxuICBfbm9ybWFsaXplQXJjaCgpIHtcbiAgICBpZiAodGhpcy5fYXJjaCA9PT0gJ2lhMzInKSByZXR1cm4gJ2k1ODYnO1xuICAgIGlmIChbJ3g2NCcsICdhcm02NCddLmluY2x1ZGVzKHRoaXMuX2FyY2gpKSByZXR1cm4gdGhpcy5fYXJjaDtcbiAgICB0aGlzLl9mYWlsKGB1bnN1cHBvcnRlZCBhcmNoaXRlY3R1cmU6ICR7dGhpcy5fYXJjaH1gKTtcbiAgfVxuXG4gIF9kZXRlY3RKUkVJZCgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS1saW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSByZXR1cm4gJ21pbmltYWwtanJlLTExLXdpbic7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXJjaCA9PT0gJ2FybTY0JyA/ICdtaW5pbWFsLWpyZS0xMS1tYWMtYXJtNjQnIDogJ21pbmltYWwtanJlLTExLW1hYyc7XG4gICAgfVxuICB9XG5cblxuXG5cblxuICAvKipcbiAgICogXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIEBkZXNjcmlwdGlvbiB0aGlzIGZ1bmN0aW9uIHJlc29sdmVzIHRoZSBqcmUgZGlyZWN0b3J5XG4gICAqIGl0IGZpcnN0IGNoZWNrcyBpZiB0aGUgdXNlQnVuZGxlZEpSRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZVxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgY2hlY2tzIGlmIHRoZSBzeXN0ZW0ganJlIGlzIGluc3RhbGxlZFxuICAgKiBpZiBpdCBpcywgaXQgcmV0dXJucyB0aGUgc3lzdGVtIGpyZSBkaXJlY3RvcnlcbiAgICogaWYgaXQgaXMgbm90LCBpdCByZXR1cm5zIHRoZSBidW5kbGVkIGpyZSBkaXJlY3RvcnlcbiAgICogdGhlIGJ1bmRsZWQganJlIGlzIGxvY2F0ZWQgaW4gdGhlIHB1YmxpYyBkaXJlY3Rvcnkgb2YgdGhlIGFwcFxuICAgKiBcbiAgICogRklYTUU6IGlmIHN5c3RlbSBqcmUgaXMgc2VsZWN0ZWQgYnkgRU5WIGRvIG5vdCBpbmNsdWRlIHRoZSBqcmUgZGlyZWN0b3J5IGluIHRoZSBmaW5hbCBidWlsZFxuICAgKi9cblxuICBfcmVzb2x2ZUpSRURpcigpIHtcbiAgICAvLyB1c2UgYnVuZGxlZCBqcmUgYmVjYXVzZSBpdHMgc21hbGxlciBhbmQgcHJvdmlkZXMgb25seSB0aGUgbmVlZGVkIGphdmEgbW9kdWxlc1xuICAgIGlmIChjb25maWcudXNlQnVuZGxlZEpSRSkge1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKHRoaXMucHVibGljQmFzZSwgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogIWFwcC5pc1BhY2thZ2VkOiBcIiArIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpKTtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH0gXG4gICAgZWxzZSB7ICAvLyB1c2Ugc3lzdGVtIGpyZVxuICAgICAgLy8gVHJ5IHRvIGZpbmQgSmF2YSBpbnN0YWxsYXRpb24gdXNpbmcgd2hpY2gvd2hlcmUgY29tbWFuZFxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgamF2YUNvbW1hbmQgPSB0aGlzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ3doZXJlIGphdmEnIDogJ3doaWNoIGphdmEnO1xuICAgICAgICBjb25zdCBqYXZhUGF0aCA9IGV4ZWNTeW5jKGphdmFDb21tYW5kLCB7IGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGphdmFQYXRoKSB7XG4gICAgICAgICAgLy8gR2V0IHRoZSBkaXJlY3RvcnkgY29udGFpbmluZyB0aGUgamF2YSBleGVjdXRhYmxlXG4gICAgICAgICAgY29uc3QgamF2YURpciA9IHBhdGguZGlybmFtZShqYXZhUGF0aCk7XG4gICAgICAgICAgLy8gR28gdXAgdG8gdGhlIEpSRS9KREsgcm9vdCAodXN1YWxseSAyIGxldmVscyB1cCBmcm9tIGJpbi8pXG4gICAgICAgICAgY29uc3QganJlUm9vdCA9IHBhdGguZGlybmFtZShwYXRoLmRpcm5hbWUoamF2YURpcikpO1xuICAgICAgICAgIHJldHVybiBqcmVSb290O1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gSmF2YSBub3QgZm91bmQgaW4gUEFUSFxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBJZiBubyBKYXZhIGZvdW5kLCBmYWxsIGJhY2sgdG8gYnVuZGxlZCBKUkVcbiAgICAgIGxvZy53YXJuKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX3Jlc29sdmVKUkVEaXI6IE5vIHN5c3RlbSBKYXZhIGZvdW5kLCBmYWxsaW5nIGJhY2sgdG8gYnVuZGxlZCBKUkVcIik7XG4gICAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgICAgcmV0dXJuIGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLmpyZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnLCB0aGlzLmpyZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX3Jlc29sdmVKYXZhQmluKCkge1xuICAgIHN3aXRjaCAodGhpcy5wbGF0Zm9ybSkge1xuICAgICAgY2FzZSAnZGFyd2luJzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGNhc2UgJ3dpbjMyJzogcmV0dXJuIFsnYmluJywgJ2phdmF3LmV4ZSddO1xuICAgICAgY2FzZSAnbGludXgnOiByZXR1cm4gWydiaW4nLCAnamF2YSddO1xuICAgICAgZGVmYXVsdDogdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgcGxhdGZvcm06ICR7dGhpcy5wbGF0Zm9ybX1gKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0RGlzcGxheVNlcnZlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4JykgcmV0dXJuICduL2EnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnKSByZXR1cm4gJ3dheWxhbmQnO1xuICAgIGlmICh0aGlzLl9lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3gxMScgfHwgdGhpcy5fZW52LkRJU1BMQVkpIHJldHVybiAneDExJztcbiAgICByZXR1cm4gJ3Vua25vd24nO1xuICB9XG5cbiAgX2dldFZlcnNpb24oY21kKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke2NtZH0gLS12ZXJzaW9uYCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnNwbGl0KCdcXG4nKVswXTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL1tcXGRdKyhcXC5bXFxkXSspKy8pO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb246IHZlcnNpb24/LlswXSB8fCAndW5rbm93bicgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmVyc2lvbjogbnVsbCB9O1xuICAgIH1cbiAgfVxuXG4gIF9nZXRKUkUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdqYXZhIC12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdpZ25vcmUnLCAncGlwZSddIH0pO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG91dHB1dC5tYXRjaCgvdmVyc2lvbiBcIihbXFxkLl9dKylcIi8pPy5bMV0gfHwgJ3Vua25vd24nO1xuICAgICAgY29uc3QgamF2YUhvbWUgPSB0aGlzLl9lbnYuSkFWQV9IT01FIHx8ICcnO1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZlcnNpb24sIHBhdGg6IGphdmFIb21lIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwsIHBhdGg6IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0V29ya2VyRmlsZU5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcgPyAnaW1hZ2VXb3JrZXJMaW51eC5tanMnIDogJ2ltYWdlV29ya2VyU2hhcnAubWpzJztcbiAgfVxuXG4gIF9nZXRXb3JrZXJVUkwoKSB7XG4gICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4odGhpcy5wdWJsaWNCYXNlLCB0aGlzLndvcmtlckZpbGVOYW1lKTtcbiAgICByZXR1cm4gcGF0aFRvRmlsZVVSTCh3b3JrZXJQYXRoKTtcbiAgfVxuXG4gIGlzV2F5bGFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJztcbiAgfVxuXG4gIF9pc0tERSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCk7XG4gICAgICByZXR1cm4gb3V0ID09PSAnS0RFJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc0tERTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNHTk9NRSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ2dub21lJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNHTk9NRTogbm8gZGF0YVwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBfaXNVTklUWSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCB7IHNoZWxsOiAnL2Jpbi9iYXNoJywgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBvdXQuaW5jbHVkZXMoJ3VuaXR5Jyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pc1VOSVRZOiBubyBkYXRhXCIsIGVycik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgLy9sb2cuaW5mbyhcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9pbWFnZW1hZ2lja0F2YWlsYWJsZTogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2ZsYW1lc2hvdEF2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJ3aGljaCBmbGFtZXNob3RcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9mbGFtZXNob3RBdmFpbGFibGU6IEZsYW1lc2hvdCBub3QgZm91bmRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX3NldHVwRGVza3RvcFBhdGgoKSB7XG4gICAgdGhpcy5kZXNrdG9wUGF0aCA9IHRoaXMuX2dldERlc2t0b3BQYXRoKCk7XG4gIH1cblxuICBfZ2V0RGVza3RvcFBhdGgoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4ocHJvY2Vzcy5lbnZbJ1VTRVJQUk9GSUxFJ10sICdEZXNrdG9wJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnRGVza3RvcCcpO1xuICAgIH1cbiAgfVxuXG4gIF9mYWlsKG1zZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBbcGxhdGZvcm1EaXNwYXRjaGVyXSAke21zZ31gKTtcbiAgfVxuXG4gIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwibWFnaWNrIC12ZXJzaW9uXCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogRm91bmQgSW1hZ2VNYWdpY2sgdjcgKG1hZ2ljaylcIik7XG4gICAgICByZXR1cm4gXCI3XCI7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICBleGVjU3luYyhcIndoaWNoIGltcG9ydFwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogRm91bmQgSW1hZ2VNYWdpY2sgPDcgKGltcG9ydClcIik7XG4gICAgICAgIHJldHVybiBcIjw3XCI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldEltYWdlTWFnaWNrVmVyc2lvbjogSW1hZ2VNYWdpY2sgbm90IGZvdW5kXCIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZ2V0VXNlV29ya2VyKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1hZ2VtYWdpY2tBdmFpbGFibGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgX2dldFNjcmVlbnNob3RBYmlsaXR5KCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBpZiAoKHRoaXMuX2lzR05PTUUoKSB8fCB0aGlzLl9pc1VOSVRZKCkpICYmIHRoaXMuaXNXYXlsYW5kKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBHTk9NRS9Vbml0eSArIFdheWxhbmQgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZVwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc0tERSgpICYmIHRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy5fZmxhbWVzaG90QXZhaWxhYmxlKCkpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBLREUvV2F5bGFuZCArIEZsYW1lc2hvdCBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5pc1dheWxhbmQoKSAmJiB0aGlzLnVzZVdvcmtlcikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFgxMSArIEltYWdlTWFnaWNrIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gdHJ1ZVwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZ2V0U2NyZWVuc2hvdEFiaWxpdHk6IFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byBmYWxzZSBcdTIwMTMgZmFsbGJhY2sgdG8gcGFnZWNhcHR1cmVcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbn1cblxuY29uc3QgcGxhdGZvcm1EaXNwYXRjaGVyID0gbmV3IFBsYXRmb3JtRGlzcGF0Y2hlcigpO1xuZXhwb3J0IGRlZmF1bHQgcGxhdGZvcm1EaXNwYXRjaGVyO1xuIiwgIlxuLyoqXG4gKiBETyBOT1QgRURJVCAtIHRoaXMgZmlsZSBpcyB3cml0dGVuIGJ5IHByZWJ1aWxkLmpzIGZyb20gLmVudiAtIGVkaXQgdmFycyBpbiAuZW52IGZpbGUhXG4gKi9cblxuY29uc3QgY29uZmlnID0ge1xuICAgIGRldmVsb3BtZW50OiB0cnVlLCAgLy8gZGlzYWJsZSBraW9zayBtb2RlIG9uIGV4YW0gbW9kZSBhbmQgb3RoZXIgc3R1ZmYgKGF1dG9maWxsIGlucHV0IGZpZWxkcylcbiAgICBzaG93ZGV2dG9vbHM6IHRydWUsXG4gICAgdXNlQnVuZGxlZEpSRTogdHJ1ZSxcbiAgICBiaXBJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICBiaXBBcGlVcmw6ICdodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L3dlYnNlcnZpY2UvcmVzdC9uZXh0LWV4YW0vc3R1ZGVudCcsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMjU1LjI1NS4yNTAnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMjA1JyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBFTEVDVFJPTiBtYWluIGZpbGUgdGhhdCBhY3R1YWxseSBvcGVucyB0aGUgZWxlY3Ryb24gd2luZG93XG4gKi9cbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgVHJheSwgTWVudSwgZGlhbG9nLCBzZXNzaW9ufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBmc0V4dHJhIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL21haW4vc2NyaXB0cy90cmF5bWVudS5qcydcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGNoZWNrUGFyZW50UHJvY2VzcyB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzJztcblxuaW1wb3J0IHsgdG9nZ2xlTWFjT1NMb2NrZG93biB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJ1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgYXN5bmMgKCkgPT4geyAgLy8gbGFzdCB3aW5kb3cgY2xvc2VkIFx1MjAxMyBjbGVhciBzdG9yYWdlIGhlcmUgdG8gYXZvaWQgTGludXggc2VnZmF1bHQgaW4gYmVmb3JlLXF1aXRcbiAgICBjbGVhckludGVydmFsKCBDb21tSGFuZGxlci51cGRhdGVTdHVkZW50SW50ZXJ2YWxsIClcbiAgICBpZiAoV2luZG93SGFuZGxlci5jaGVja1dpbmRvd0ludGVydmFsPy5zdG9wKSBXaW5kb3dIYW5kbGVyLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RvcCgpXG4gICAgaWYgKENvbW1IYW5kbGVyLnVwZGF0ZVNjaGVkdWxlcj8uc3RvcCkgQ29tbUhhbmRsZXIudXBkYXRlU2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyPy5zdG9wKSBDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyPy5zdG9wKSBtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0b3AoKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcblxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7fSk7IC8vIGNsZWFyIGNvb2tpZXMsIGNhY2hlLCBsb2NhbFN0b3JhZ2UgZXRjLiB3aGlsZSBzZXNzaW9uIHN0aWxsIHZhbGlkXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdpbmRvdy1hbGwtY2xvc2VkOiBFcnJvciBjbGVhcmluZyBzdG9yYWdlOicsIGVycik7XG4gICAgfVxuICAgIGFwcC5xdWl0KCk7XG59KTtcblxuYXBwLm9uKCd3aWxsLXF1aXQnLCAoKSA9PiB7ICAvLyBpZiB3aW5kb3cgaXMgY2xvc2VkXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bihmYWxzZSlcbn0pXG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLmNsaWVudGluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBcIkRlbW9Vc2VyXCIsXG4gICAgICAgICAgICB0b2tlbjogZmFsc2UsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKiBzdGFydHMgYW4gaW50ZXJ2YWxsIHRvIGNoZWNrIHNlcnZlciBzdGF0dXMgYW5kIHJlYWN0cyBvbiBpbmZvcm1hdGlvbiBnaXZlbiBieSB0aGUgc2VydmVyIGluc3RhbmNlXG4gICAgICovXG4gICAgaW5pdCAoZ2F0ZXdheSkge1xuICAgICAgICB0aGlzLmdhdGV3YXkgPSBnYXRld2F5XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGdyYW0uY3JlYXRlU29ja2V0KCd1ZHA0JykgIC8vIG1vdmluZyB0aGlzIGhlcmUgd2lsbCBhbGxvdyB0byByZXNwYXduIGl0IGlmIGJpbmRpbmcgZmFpbHNcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgZXJyb3I6XFxuJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmdhdGV3YXkpIHt0aGlzLmNsaWVudC5hZGRNZW1iZXJzaGlwKHRoaXMuTVVMVElDQVNUX0FERFIpfSAvLyBlcyBpc3QgZlx1MDBGQ3IgZWluIHZlcmxcdTAwRTRzc2xpY2hlcyBtdWx0aWNhc3Qgc2lubnZvbGwgZGVyIGdydXBwZSBiZWl6dXRyZXRlblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5nYXRld2F5KSB7bG9nLndhcm4oXCJtY2NsaWVudDogTm8gR2F0ZXdheSEgU3RhcnRpbmcgTXVsdGljYXN0Q2xpZW50IHdpdGhvdXQgYWRkaW5nIGdyb3VwIG1lbWJlcnNoaXBcIil9XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IFVEUCBNQyBDbGllbnQgbGlzdGVuaW5nIG9uIGh0dHA6Ly8ke2NvbmZpZy5ob3N0aXB9OiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9YClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsaXRjYXN0Y2xpZW50IEAgaW5pdDogJHtlfWApIFxuICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZSwgcmluZm8pID0+IHsgdGhpcy5tZXNzYWdlUmVjZWl2ZWQobWVzc2FnZSwgcmluZm8pIH0pXG4gXG4gICAgICAgIC8vY2hlY2sgZm9yIGRlcHJlY2F0ZWQgaW5zdGFuY2UgaW4gYSBsb29wXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyID0gbmV3IFNjaGVkdWxlclNlcnZpY2UodGhpcy5pc0RlcHJlY2F0ZWRJbnN0YW5jZS5iaW5kKHRoaXMpLCA1MDAwKVxuICAgICAgICB0aGlzLnJlZnJlc2hFeGFtc1NjaGVkdWxlci5zdGFydCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjZWl2ZXMgbWVzc2FnZXMgYW5kIHN0b3JlcyBuZXcgZXhhbSBpbnN0YW5jZXMgaW4gdGhpcy5leGFtU2VydmVyTGlzdFtdXG4gICAgICovXG4gICAgIG1lc3NhZ2VSZWNlaXZlZCAobWVzc2FnZSwgcmluZm8pIHtcbiAgICAgIFxuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIEJyb3dzZXJWaWV3LCBkaWFsb2csIHNjcmVlbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgeyBhY3RpdmVXaW5kb3cgfSBmcm9tICdnZXQtd2luZG93cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gUmVuZGVyZXIgYnVpbHQgaW50byBwdWJsaWMvIChvbmUgY29weSk7IHdoZW4gcGFja2FnZWQgdXNlIGFwcC5hc2FyLnVucGFja2VkL3B1YmxpY1xuZnVuY3Rpb24gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSB7XG4gIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCAnaW5kZXguaHRtbCcpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHVucGFja2VkKSkgcmV0dXJuIHVucGFja2VkO1xuICB9XG4gIGNvbnN0IHB1YmxpY1BhdGggPSBqb2luKF9fZGlybmFtZSwgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHB1YmxpY1BhdGgpKSByZXR1cm4gcHVibGljUGF0aDtcbiAgY29uc3QgZGlzdFJlbmRlcmVyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnZGlzdCcsICdyZW5kZXJlcicsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKGRpc3RSZW5kZXJlclBhdGgpKSByZXR1cm4gZGlzdFJlbmRlcmVyUGF0aDtcbiAgY29uc3QgcXVhc2FyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpO1xuICBpZiAoZnMuZXhpc3RzU3luYyhxdWFzYXJQYXRoKSkgcmV0dXJuIHF1YXNhclBhdGg7XG4gIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbn1cblxuXG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBXaW5kb3cgaGFuZGxpbmcgKGlwY1JlbmRlcmVyIFByb2Nlc3MgLSBGcm9udGVuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2NrV2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXJ2ZWQgZGlzcGxheSBJRCBmb3IgZXhhbSB3aW5kb3cgKHNldCBpbW1lZGlhdGVseSB3aGVuIHdpbmRvdyBpcyBjcmVhdGVkKVxuICAgICAgdGhpcy5zcGxhc2h3aW4gPSBudWxsXG4gICAgICB0aGlzLmJpcHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgXG4gICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHF1ZXN0aW9uIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgbWluaW1pemUgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLndpbmRvd1RyYWNrZXIuYmluZCh0aGlzKSwgMTAwMClcbiAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGVsZWN0cm9uIHdpbmRvdyBpbiBmb2N1cyBvciBhbiBvdGhlciBlbGVjdHJvbiB3aW5kb3cgZGVwZW5kaW5nIG9uIHRoZSBoaWVyYWNoeVxuICAgIGdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkge1xuICAgICAgICBjb25zdCBmb2N1c2VkV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICAgIGlmIChmb2N1c2VkV2luZG93KSB7XG4gICAgICAgICAgcmV0dXJuIGZvY3VzZWRXaW5kb3dcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbmxvY2tXaW5kb3cpe3JldHVybiB0aGlzLnNjcmVlbmxvY2tXaW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmV4YW13aW5kb3cpe3JldHVybiB0aGlzLmV4YW13aW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1haW53aW5kb3cpe3JldHVybiB0aGlzLm1haW53aW5kb3d9XG4gICAgICAgICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTAwMCxcbiAgICAgICAgICAgIGhlaWdodDo4MDAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBkaWQtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHdpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogbmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHRhcmdldDogX2JsYW5rXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1yZWRpcmVjdCcsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogJyArIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhbiBlYXN0ZXIgZWdnXG4gICAgICovXG4gICAgY3JlYXRlRWFzdGVyV2luKCkge1xuICAgICAgICB0aGlzLmVhc3RlcndpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogNzY4LFxuICAgICAgICAgICAgaGVpZ2h0OjQ4MCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLmxvYWRGaWxlKGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdjb3dzb25pY2UnLCAnaW5kZXguaHRtbCcpKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBcIm5vdGZvdW5kXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBibG9ja3dpbi5yZW1vdmVNZW51KCkgXG4gICAgICAgIGJsb2Nrd2luLnNldE1pbmltaXphYmxlKGZhbHNlKVxuXG4gICAgICAgIC8vIFBvc2l0aW9uIHdpbmRvdyBvbiBzcGVjaWZpYyBkaXNwbGF5IEJFRk9SRSBzaG93aW5nIGl0XG4gICAgICAgIGJsb2Nrd2luLnNldEJvdW5kcyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54LFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJsb2Nrd2luLnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICBibG9ja3dpbi5zaG93KClcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7XG4gICAgICAgICAgICBibG9ja3dpbi5vbignbGVhdmUtZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTsgLy8gc29mb3J0IHdpZWRlciB6dXJcdTAwRkNja3NldHplblxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9ICBcbiAgICAgICAgZWxzZSB7ICAgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRLaW9zayh0cnVlKTsgLy8gS2lvc2sgPSBcInRha2Ugb3ZlciBtYWluIHNjcmVlblwiLiBvbiBtYWNvcyB0aGF0J3Mgd2h5IHdlIHVzZSBmdWxsU2NyZWVuIHdvcmthcm91bmQgd2l0aCBldmVudCBsaXN0ZW5lclxuICAgICAgICB9XG4gICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgYmxvY2t3aW4uZGlzcGxheSA9IGRpc3BsYXlcbiAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MucHVzaChibG9ja3dpbilcbiAgICB9XG5cblxuICAgIC8vIGJsb2NrIGFsbCBzY3JlZW5zIHdpdGggYSBibG9ja3dpbmRvd1xuICAgIGFzeW5jIGluaXRCbG9ja1dpbmRvd3MoKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgLy9sb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGZvdW5kICR7ZGlzcGxheXMubGVuZ3RofSBkaXNwbGF5c2ApXG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7ICAvLyBsb2NrIGFsbCBzY3JlZW5zXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBleGFtIHdpbmRvdyB0byBiZSB2aXNpYmxlIGFuZCBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldHJpZXMgPSAwXG4gICAgICAgICAgICAgICAgY29uc3QgbWF4UmV0cmllcyA9IDEwXG4gICAgICAgICAgICAgICAgd2hpbGUgKCF0aGlzLmV4YW13aW5kb3cuaXNWaXNpYmxlKCkgJiYgcmV0cmllcyA8IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApXG4gICAgICAgICAgICAgICAgICAgIHJldHJpZXMrK1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHdhaXQgdG8gZW5zdXJlIHBvc2l0aW9uaW5nIGlzIGNvbXBsZXRlIG9uIFdheWxhbmRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZGVzdHJveWVkIGJsb2NrIHdpbmRvd3MgZnJvbSBhcnJheVxuICAgICAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MgPSB0aGlzLmJsb2Nrd2luZG93cy5maWx0ZXIoYmxvY2t3aW4gPT4gYmxvY2t3aW4gJiYgIWJsb2Nrd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBhbGwgZXhpc3Rpbmcgd2luZG93cyBhbmQgZGV0ZXJtaW5lIHRoZWlyIGRpc3BsYXlzXG4gICAgICAgICAgICBjb25zdCB1c2VkRGlzcGxheUlkcyA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaXJzdCwgdXNlIHRoZSByZXNlcnZlZCBleGFtIGRpc3BsYXkgSUQgKHNldCBpbW1lZGlhdGVseSB3aGVuIGV4YW0gd2luZG93IHdhcyBjcmVhdGVkKVxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBzY3JlZW4gaXMgcmVzZXJ2ZWQgZXZlbiBpZiB0aGUgd2luZG93IGlzbid0IGZ1bGx5IGluaXRpYWxpemVkIHlldFxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbURpc3BsYXlJZCkge1xuICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZCh0aGlzLmV4YW1EaXNwbGF5SWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFsd2F5cyBleGNsdWRlIHByaW1hcnkgZGlzcGxheSAoZXhhbSB3aW5kb3cgbG9jYXRpb24pXG4gICAgICAgICAgICBjb25zdCBwcmltYXJ5RGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAocHJpbWFyeURpc3BsYXkgJiYgcHJpbWFyeURpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQocHJpbWFyeURpc3BsYXkuaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGV4YW0gd2luZG93IGRpc3BsYXkgKGFzIGZhbGxiYWNrL3ZlcmlmaWNhdGlvbiwgYnV0IHJlc2VydmVkIElEIHRha2VzIHByaW9yaXR5KVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBleGFtIHdpbmRvdyBpcyBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBlcnJvciBnZXR0aW5nIGV4YW0gd2luZG93IGRpc3BsYXk6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBibG9jayB3aW5kb3dzIGRpc3BsYXlzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGJsb2Nrd2luIG9mIHRoaXMuYmxvY2t3aW5kb3dzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gYmxvY2t3aW4uZ2V0Qm91bmRzKClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcoYm91bmRzKVxuICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBibG9jayB3aW5kb3cgZm91bmQgb24gZGlzcGxheSAke2Rpc3BsYXkuaWR9YClcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBibG9jayB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBibG9jayB3aW5kb3dzIGZvciBkaXNwbGF5cyB0aGF0IGRvbid0IGhhdmUgZXhhbSBvciBibG9jayB3aW5kb3dzXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBpZiAodXNlZERpc3BsYXlJZHMuaGFzKGRpc3BsYXkuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogc2tpcHBpbmcgZGlzcGxheSAke2Rpc3BsYXkuaWR9IC0gYWxyZWFkeSBoYXMgZXhhbSBvciBibG9jayB3aW5kb3dgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBjcmVhdGUgYmxvY2t3aW4gb246XCIsZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0Jsb2NrV2luKGRpc3BsYXkpICAvLyBhZGQgYmxvY2t3aW5kb3dzIGZvciBkaXNwbGF5cyB3aXRob3V0IGV4YW0gd2luZG93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMClcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLmZvckVhY2goIChibG9ja3dpbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIFNjcmVlbmxvY2sgV2luZG93ICh0byBjb3ZlciB0aGUgbWFpbnNjcmVlbikgLSBibG9jayBzdHVkZW50cyBmcm9tIHdvcmtpbmdcbiAgICAgKiBAcGFyYW0gZGlzcGxheSBcbiAgICAgKi9cbiAgICBjcmVhdGVTY3JlZW5sb2NrV2luZG93KGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IHNjcmVlbmxvY2tXaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgIHg6IGRpc3BsYXkuYm91bmRzLnggKyAwLFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSArIDAsXG4gICAgICAgICAgICAvLyBwYXJlbnQ6IHRoaXMubWFpbndpbmRvdywgICAvLyBsZWFkcyB0byB2aXNpYmxlIHRpdGxlYmFyIGluIGdub21lLWRlc2t0b3BcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICB0aXRsZTogJ1NjcmVlbmxvY2snLFxuICAgICAgICAgICAgd2lkdGg6IGRpc3BsYXkuYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBkaXNwbGF5LmJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICBjbG9zYWJsZTogZmFsc2UsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIC8vZm9jdXNhYmxlOiBmYWxzZSwgICAvL2RvZXNuJ3Qgd29yayB3aXRoIGtpb3NrIG1vZGUgKG5vIGtpb3NrIG1vZGUgcG9zc2libGUuLiB3aHk/KVxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgLy8gcmVzaXphYmxlOmZhbHNlLCAvLyBsZWFkcyB0byB3ZWlyZCAyMHB4IGJvdHRvbXNwYWNlIG9uIHdpbmRvd3NcbiAgICAgICAgICAgIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgZnJhbWU6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgdXJsID0gXCJsb2NrXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vYH0pXG4gICAgICAgIH0gXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vYFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIC8vIEFkZCB3aW5kb3cgdG8gYXJyYXkgZmlyc3QsIGJlZm9yZSBhZGRpbmcgYmx1ciBsaXN0ZW5lclxuICAgICAgICB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLnB1c2goc2NyZWVubG9ja1dpbmRvdylcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXNjcmVlbmxvY2tXaW5kb3cpIHJldHVybjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5yZW1vdmVNZW51KCkgXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldE1pbmltaXphYmxlKGZhbHNlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInBvcC11cC1tZW51XCIsIDEpICAgLy9hYm92ZSBleGFtIHdpbmRvdyAocG9wLXVwLW1lbnUsIDApXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNob3coKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldENsb3NhYmxlKHRydWUpXG4gICAgICAgICAgICBzY3JlZW5sb2NrV2luZG93LnNldFZpc2libGVPbkFsbFdvcmtzcGFjZXModHJ1ZSk7IC8vIHB1dCB0aGUgd2luZG93IG9uIGFsbCB2aXJ0dWFsIHdvcmtzcGFjZXNcbiAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKFwic2NyZWVubG9ja1wiKVxuICAgICAgICB9KVxuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9ICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5vbignY2xvc2VkJywgKCkgPT4geyAgIC8vIHJlbW92ZSB3aW5kb3cgZnJvbSBhcnJheSB3aGVuIGFjdHVhbGx5IGNsb3NlZFxuICAgICAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyA9IHRoaXMuc2NyZWVubG9ja3dpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4gJiYgd2luICE9PSBzY3JlZW5sb2NrV2luZG93ICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIEV4YW13aW5kb3dcbiAgICAgKiBAcGFyYW0gZXhhbXR5cGUgZWR1dmlkdWFsLCBtYXRoLCBsYW5ndWFnZVxuICAgICAqIEBwYXJhbSB0b2tlbiBzdHVkZW50IHRva2VuXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyB0aGUgc2VydmVyc3RhdHVzIG9iamVjdCBjb250YWluaW5nIGluZm8gYWJvdXQgc3BlbGxjaGVjayBsYW5ndWFnZSBldGMuIFxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUV4YW1XaW5kb3coZXhhbXR5cGUsIHRva2VuLCBzZXJ2ZXJzdGF0dXMsIHByaW1hcnlkaXNwbGF5KSB7XG4gICAgICAgIC8vIGp1c3QgdG8gYmUgc3VyZSB3ZSBjaGVjayBzb21lIGltcG9ydGFudCB2YXJzIGhlcmVcbiAgICAgICAgaWYgKGV4YW10eXBlICE9PSBcInJkcFwiICYmIGV4YW10eXBlICE9PSBcIndlYnNpdGVcIiAmJiAgZXhhbXR5cGUgIT09IFwiZ2Zvcm1zXCIgJiYgZXhhbXR5cGUgIT09IFwiZWR1dmlkdWFsXCIgJiYgZXhhbXR5cGUgIT09IFwiZWRpdG9yXCIgJiYgZXhhbXR5cGUgIT09IFwibWF0aFwiICYmIGV4YW10eXBlICE9PSBcIm1pY3Jvc29mdDM2NVwiICYmIGV4YW10eXBlICE9PSBcImFjdGl2ZXNoZWV0c1wiIHx8ICF0b2tlbil7ICAvLyBmb3Igbm93Li4gd2UgcHJvYmFibHkgc2hvdWxkIHN0b3AgZXZlcnl0aGluZyBoZXJlXG4gICAgICAgICAgICBsb2cud2FybihcIm1pc3NpbmcgcGFyYW1ldGVycyBmb3IgZXhhbS1tb2RlIG9yIG1vZGUgbm90IGluIGFsbG93ZWQgbGlzdCFcIilcbiAgICAgICAgICAgIGV4YW10eXBlID0gXCJlZGl0b3JcIiBcbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIC8vIEFsd2F5cyB1c2UgcHJpbWFyeSBkaXNwbGF5IGZvciBleGFtIHdpbmRvd1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMgfHwgIXByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgICAgICAgICAgcHJpbWFyeWRpc3BsYXkgPSBkaXNwbGF5c1swXSB8fCBwcmltYXJ5ZGlzcGxheVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBJbW1lZGlhdGVseSByZXNlcnZlIHRoZSBkaXNwbGF5IElEIGZvciB0aGUgZXhhbSB3aW5kb3cgKGJlZm9yZSB3aW5kb3cgaXMgZnVsbHkgaW5pdGlhbGl6ZWQpXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYmxvY2sgd2luZG93cyBmcm9tIGJlaW5nIGNyZWF0ZWQgb24gdGhlIHNhbWUgc2NyZWVuXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5pZCkge1xuICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gcHJpbWFyeWRpc3BsYXkuaWRcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogcmVzZXJ2aW5nIGRpc3BsYXkgJHt0aGlzLmV4YW1EaXNwbGF5SWR9IGZvciBleGFtIHdpbmRvd2ApXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBweCA9IDBcbiAgICAgICAgbGV0IHB5ID0gMFxuICAgICAgICBpZiAocHJpbWFyeWRpc3BsYXkgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcy54KSB7XG4gICAgICAgICAgICBweCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54XG4gICAgICAgICAgICBweSA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy55XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB4OiBweCArIDAsXG4gICAgICAgICAgICB5OiBweSArIDAsXG4gICAgICAgICAgICB0aXRsZTogJ0V4YW0nLFxuICAgICAgICAgICAgd2lkdGg6IDE0NDAsXG4gICAgICAgICAgICBoZWlnaHQ6IDc2OCxcbiAgICAgICAgICAgIC8vIHBhcmVudDogd2luLCAgLy90aGlzIGRvZXNudCB3b3JrIHRvZ2V0aGVyIHdpdGgga2lvc2sgb24gdWJ1bnR1IGdub21lID8/IHd0ZlxuICAgICAgICAgICAgLy8gbW9kYWw6IHRydWUsICAvLyB0aGlzIGJsb2NrcyB0aGUgbWFpbiB3aW5kb3cgb24gd2luZG93cyB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgb3BlblxuICAgICAgICAgICAgLy8gY2xvc2FibGU6IGZhbHNlLCAgLy8gaWYgd2UgY2FuJ3QgZGVmaW5lICdwYXJlbnQnIHRoaXMgd2luZG93IGhhcyB0byBiZSBjbG9zYWJsZSAtIHdoeT9cbiAgICAgICAgICAgIC8vYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBvcGFjaXR5OiAxLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIHZpc2libGVPbkFsbFdvcmtzcGFjZXM6IHRydWUsXG4gICAgICAgICAgICBraW9zazogdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgPyBmYWxzZSA6IHRydWUsXG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgICAgIHByZWxvYWQ6IGpvaW4oX19kaXJuYW1lLCAnLi9wcmVsb2FkL2VsZWN0cm9uLXByZWxvYWQuY2pzJyksXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3ZWJ2aWV3VGFnOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYlNlY3VyaXR5OiBmYWxzZSAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuZXhhbXdpbmRvdykgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZU1lbnUoKSAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5zZXRBbHdheXNPblRvcCh0cnVlLCBcInNjcmVlbi1zYXZlclwiLCAxKSBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDUwMClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0QmxvY2tXaW5kb3dzKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvYmFibHkgbm90IG5lZWRlZCBiZWNhdXNlIHdlIGRpc2FibGUgbWlzc2lvbmNvbnRyb2wgYW55d2F5cyAtIHNlZW1zIHRvIGludGVyZmVyZSB3aXRoIGtpb3NrIG1vZGUgb24gbWFjb3MgKGFnYWluKVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLmV4YW13aW5kb3cuc2V0VmlzaWJsZU9uQWxsV29ya3NwYWNlcyh0cnVlLCB7IHZpc2libGVPbkZ1bGxTY3JlZW46IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzV2F5bGFuZCl7IHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdGFydCgpIH0gLy8gY29uc3RhbnRseSBjaGVjayBpZiB0aGUgYWN0aXZlIHdpbmRvdyBpcyB0aGUgZXhhbXdpbmRvdyAtIGlmIG5vdCwgYnJpbmcgaXQgdG8gZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUmVzdHJpY3Rpb25zKHRoaXMpICAvLyBkaXNhYmxlIGtleWJvYXJkIHNob3J0Y3V0cyBldGMuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAvLyBkbyBub3Qgc2V0IGJsdXIgbGlzdGVuZXIgdG9vIGVhcmx5XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQmx1ckxpc3RlbmVyKCkgIC8vIGFkZCBibHVyIGxpc3RlbmVyIHRvIHRoZSBleGFtd2luZG93XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGUpeyBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgZGlkLWZpbmlzaC1sb2FkOiBlcnJvciBpbiBleGFtd2luZG93IHNldHVwXCIsIGUpfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cyAvL3dlIGtlZXAgaXQgdGhlcmUgdG8gbWFrZSBpdCBhY2Nlc3NhYmxlIHZpYSBleGFtd2luZG93IGluIGlwY0hhbmRsZXJcbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQgPSA5NCAgIC8vIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgY29udGVudCB2aWV3XG4gICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNaWNyb3NvZnQgMzY1IGVtZWJlZHMgaXRzIGVkaXRvciBpbiBhbiBpZnJhbWUgd2l0aCBhY3RpdmUgQ29udGVudCBTZWN1cml0eSBQb2xpY3kgKENTUClcbiAgICAgICAgICogVGhlIG9ubHkgd2F5IHRvIGJlIGFibGUgdG8gaW5qZWN0IGNvZGUgaXMgdG8gbG9hZCBpdCBkaXJlY3RseSBpbiB0aGUgbWFpbiB3aW5kb3cgPGVtYmVkPiA8aWZyYW1lPiBvciBldmVuIDx3ZWJ2aWV3PiBvZmZlcnMgbm8gd29ya2Fyb3VuZFxuICAgICAgICAgKiB0aGVyZWZvcmUgd2UgdXNlIFwiQnJvd3NlclZpZXdcIiBpbiBvcmRlciB0byBkaXNwbGF5IHR3byBwYWdlcyBpbiBvbmUgd2luZG93OiBvbiB0b3AgPiBleGFtIGhlYWRlciwgb24gYm90dG9tID4gb2ZmaWNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlmIChleGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIiAgKSB7IC8vZXh0ZXJuYWwgcGFnZVxuICAgICAgICAgICAgbG9nLmluZm8oXCJzdGFydGluZyBtaWNyb3NvZnQzNjUgZXhhbS4uLlwiKVxuICAgICAgICAgICAgbGV0IHVybHZpZXcgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgICBcbiAgICAgICAgICAgIGlmICghdXJsdmlldykgey8vIHdlIHdhaXQgZm9yIHRoZSBuZXh0IHVwZGF0ZSB0aWNrIC0gbXNvZmZpY2VzaGFyZSBuZWVkcyB0byBiZSBzZXQgISAoY291bGQgaGFwcGVuIHdoZW4gYSBzdHVkZW50IGNvbm5lY3RzIGxhdGVyIHRoZW4gZXhhbSBtb2RlIGlzIHNldCBidXQgaGlzIHNoYXJlIHVybCBuZWVkcyBzb21lIHRpbWUpXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlRXhhbVdpbmRvdzogbm8gdXJsIGZvciBtaWNyb3NvZnQzNjUgd2FzIHNldCB5ZXQgLSB3YWl0aW5nIGZvciBuZXh0IHVwZGF0ZSB0aWNrXCIpXG4gICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbURpc3BsYXlJZCA9IG51bGwgIC8vIHJlc2V0IHJlc2VydmVkIGRpc3BsYXkgSUQgd2hlbiBleGFtIHdpbmRvdyBpcyBkZXN0cm95ZWRcbiAgICAgICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuZXhhbXdpbmRvdylcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbG9hZCB0b3AgbWVudSBpbiBNYWluUGFnZVxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgZWR1dmlkdWFsIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGJhY2tncm91bmR1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwoYmFja2dyb3VuZHVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBEZWZpbmUgdGhlIE1haW5Db250ZW50UGFnZSB2aWV3XG4gICAgICAgICAgICBsZXQgY29udGVudFZpZXcgPSBuZXcgQnJvd3NlclZpZXcoe1xuICAgICAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSwgIFxuICAgICAgICAgICAgICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogdGhpcy5leGFtd2luZG93Lm1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKS5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRBdXRvUmVzaXplKHsgd2lkdGg6IHRydWUsIGhlaWdodDogdHJ1ZSwgaG9yaXpvbnRhbDogdHJ1ZSwgdmVydGljYWw6IHRydWUgfSk7XG4gICAgICAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybHZpZXcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyAgICAgICBjb250ZW50Vmlldy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSB9XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRCcm93c2VyVmlldyhjb250ZW50Vmlldyk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignZW50ZXItZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbigncmVzaXplJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBuZXdCb3VuZHMgPSB0aGlzLmV4YW13aW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgbm9ybWFsIGV4YW0gbW9kZSAoZWRpdG9yLCBtYXRoLCBlZHV2aWR1YWwsIHdlYnNpdGUsIGdmb3JtcylcbiAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgbGV0IHVybCA9IGV4YW10eXBlICAgLy8gZWRpdG9yIHx8IG1hdGggfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1cmwgPSBgJHtwcm9jZXNzLmVudi5BUFBfVVJMfS8jLyR7dXJsfS8ke3Rva2VufS9gXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGUgc3BlY2lhbCBOQVZJR0FUSU9OIHNpdHVhdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAqICBGb3JtcywgV2Vic2l0ZSwgRWR1dmlkdWFsLCBFZGl0b3IsIFJEUCwgTWljcm9zb2Z0MzY1XG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIC8vIEJsb2NrIG5hdmlnYXRpb24gb24gZXhhbXdpbmRvdy53ZWJDb250ZW50cyBsZXZlbCBmb3IgYWxsIG1vZGVzIHRoYXQgY2FuIGRpc3BsYXkgUERGcyBpbiBleGFtaGVhZGVyXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgbmF2aWdhdGlvbiB3aGVuIGNsaWNraW5nIGxpbmtzIGluIFBERnMgZGlzcGxheWVkIGluIHRoZSBleGFtaGVhZGVyXG4gICAgICAgIC8vIFdlYnZpZXcvQnJvd3NlclZpZXcgYmxvY2tpbmcgaXMgaGFuZGxlZCBzZXBhcmF0ZWx5IHZpYSBJUEMgaW4gaXBjaGFuZGxlci5qcyBvciBtb2RlLXNwZWNpZmljIGhhbmRsZXJzIGJlbG93XG4gICAgICAgIGNvbnN0IGV4YW1UeXBlc1dpdGhQZGZJbkhlYWRlciA9IFtcImdmb3Jtc1wiLCBcIndlYnNpdGVcIiwgXCJlZHV2aWR1YWxcIiwgXCJlZGl0b3JcIiwgXCJyZHBcIiwgXCJtaWNyb3NvZnQzNjVcIiwgXCJhY3RpdmVzaGVldHNcIiwgXCJtYXRoXCJdO1xuICAgICAgICBpZiAoZXhhbVR5cGVzV2l0aFBkZkluSGVhZGVyLmluY2x1ZGVzKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmV4YW10eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBWdWUgYXBwIChlLmcuIGZyb20gUERGIGxpbmtzIGluIGV4YW1oZWFkZXIpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gUHJldmVudCBuZXcgd2luZG93cyBmcm9tIG9wZW5pbmcgaW4gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5vbignbmV3LXdpbmRvdycsIChldmVudCwgdXJsKSA9PiB7IFxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwid2luZG93aGFuZGxlciBAIGV4YW13aW5kb3c6IGJsb2NrZWQgbmV3LXdpbmRvd1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBzZXRXaW5kb3dPcGVuSGFuZGxlclwiLCB1cmwpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogIE1pY3Jvc29mdCBFeGNlbC9Xb3JkXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUgPT09IFwibWljcm9zb2Z0MzY1XCIpeyAgLy8gZG8gbm90IHVuZGVyIGFueSBjaXJjdW1zdGFuY2VzIGFsbG93IG5hdmlnYXRpb24gYXdheSBmcm9tIHRoZSBjdXJyZW50IGV4YW0gdXJsXG4gICAgICAgICAgICBjb25zdCBicm93c2VyVmlldyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHVzZXIgd2FudHMgdG8gbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgcGFnZVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJkbyBub3QgbmF2aWdhdGUgYXdheSBmcm9tIHRoaXMgdGVzdC4uIFwiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHdpbmRvdy5vcGVuKClcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICB9KTsgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgXG4gICAgICAgICAgICAvLyBpZiBhIG5ldyB3aW5kb3cgc2hvdWxkIG9wZW4gdHJpZ2dlcmVkIGJ5IHRhcmdldD1cIl9ibGFua1wiXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgZXhlY3V0ZUNvZGUgPSAgYFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBsb2NrKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAnV0FDRGlhbG9nT3V0ZXJDb250YWluZXInLCdXQUNEaWFsb2dJbm5lckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ1BhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZGV1c0J5SUQgPSBbJ1Nob3dIaWRlRXF1YXRpb25Ub29sc1BhbmUnLCdMaW5rR3JvdXAnLCdHcmFwaGljc0VkaXRvcicsJ0luc2VydFRhYmxlT2ZDb250ZW50c0luSW5zZXJ0VGFiJywnSW5zZXJ0T25saW5ldmlkZW8nLCdQaWN0dXJlJywnUmliYm9uLVBpY3R1cmVNZW51TUxSRHJvcGRvd24nLCdJbnNlcnRBZGRJbkZseW91dCcsJ0Rlc2lnbmVyJywnRWRpdG9yJywnRmFyUGFuZScsJ0hlbHAnLCdJbnNlcnRBcHBzRm9yT2ZmaWNlJywnRmlsZU1lbnVMYXVuY2hlckNvbnRhaW5lcicsJ0hlbHAtd3JhcHBlcicsJ1Jldmlldy13cmFwcGVyJywnSGVhZGVyJywnRmFyUGVyaXBoZXJhbENvbnRyb2xzQ29udGFpbmVyJywnQnVzaW5lc3NCYXInXVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChlbnRyeSBvZiBoaWRldXNCeUlEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRyeSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJkaXNwbGF5XCIsIFwibm9uZVwiLCBcImltcG9ydGFudFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBidXR0b25BcHBzT3ZlcmZsb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZSgnQWRkLUlucycpWzBdOyAgLy8gdGhpcyBidXR0b24gaXMgcmVkcmF3biBvbiByZXNpemUgKGRvZXNuJ3QgaGFwcGVuIGluIGV4YW0gbW9kZSBidXQgc3RpbGwgdGhlcmUgbXVzdCBiZSBhIGNsZWFuZXIgd2F5IC0gaW5zZXJ0aW5nIGNzcyBiZWZvcmUgaXQgYXBwZWFycyBpcyBub3Qgd29ya2luZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidXR0b25BcHBzT3ZlcmZsb3cpeyBidXR0b25BcHBzT3ZlcmZsb3cuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJTdWNoZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJcdTAwRENiZXJzZXR6ZW5cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzt9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtbGFiZWw9XCJDb3BpbG90XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkFkZC1JbnNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwQ29udGV4dE1lbnVcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJDb250ZXh0TWVudS1TbWFydExvb2t1cFN5bm9ueW1zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge2VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIlJpYmJvbi1SZWZlcmVuY2VzU21hcnRMb29rVXBcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJEaWN0YXRpb25cIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkdldEFkZGluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUGljdHVyZXNfTUxSXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pOyAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9jaygpICAvL2ZvciBzb21lIHJlYXNvbiBleGNlbCBkZWxheXMgdGhhdCBjYWxsLi4gZG9lc250IGhhcHBlbiBvbiBwYWdlIGZpbmlzaCBsb2FkXG4gICAgICAgICAgICAgICAgICAgIGBcblxuICAgICAgICAgICAgbGV0IHNjaGVkdWxlckluc3RhbmNlID0gbnVsbFxuICAgICAgICAgICAgdGhpcy5sb2NrQ2FsbGJhY2sgPSAoKSA9PiB0aGlzLmxvY2szNjUoYnJvd3NlclZpZXcsIGV4ZWN1dGVDb2RlLCBzY2hlZHVsZXJJbnN0YW5jZSk7IFxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2UgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmxvY2tDYWxsYmFjaywgNDAwKVxuICAgICAgICAgICAgdGhpcy5sb2NrU2NoZWR1bGVyID0gc2NoZWR1bGVySW5zdGFuY2VcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0YXJ0KClcbiAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgdGhlIHdlYkNvbnRlbnRzIGlzIGZ1bGx5IGxvYWRlZCAgLy8gdGhpcyBpcyBub3Qgd29ya2luZyByZWxpYWJseSBiZWNhdXNlIHRoZSBwYWdlIGlzIGxvYWRlZCBpbiBtYW55IHN0ZXBzIGFuZCB0aGUgdWkgZWxlbWVudHMgYXJlIG5vdCBhdmFpbGFibGUgeWV0XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignZGlkLWZpbmlzaC1sb2FkJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2FwcC1jb21tYW5kJywgKGUsIGNtZCkgPT4ge1xuICAgICAgICAgICAgLy8gJ2Jyb3dzZXItYmFja3dhcmQnIHVuZCAnYnJvd3Nlci1mb3J3YXJkJyBzaW5kIGRpZSBCZWZlaGxlLCBkaWUgYmVpbSBLbGljayBhdWYgZGllIE1hdXN0YXN0ZW4gZ2VzZW5kZXQgd2VyZGVuXG4gICAgICAgICAgICBpZiAoY21kID09PSAnYnJvd3Nlci1iYWNrd2FyZCcgfHwgY21kID09PSAnYnJvd3Nlci1mb3J3YXJkJykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwibm8gbmF2aWdhdGlvbiBhbGxvd2VkXCIpXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJuIFNpZSBkYXMgU3RhbmRhcmR2ZXJoYWx0ZW5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGNsb3NlZFxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tXaW5kb3dJbnRlcnZhbC5zdG9wKClcbiAgICAgICAgICAgICAgICAvL2Rpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KSAgLy9kbyBub3QgZGlzYWJsZSB0d2ljZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICB9ICBcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG4gICAgYXN5bmMgbG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKXtcbiAgICAgICAgaWYgKGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzICYmIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZSl7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5tYWluRnJhbWUuZnJhbWVzLmZpbHRlcigoZnJhbWUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiZm91bmQgZnJhbWVcIiwgZnJhbWUubmFtZSlcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUgJiYgKGZyYW1lLm5hbWUgPT09ICdXZWJBcHBsaWNhdGlvbkZyYW1lJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfV29yZF8wJyB8fCBmcmFtZS5uYW1lID09PSAnV2FjRnJhbWVfRXhjZWxfMCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiKVxuICAgICAgICAgICAgICAgICAgICBmcmFtZS5leGVjdXRlSmF2YVNjcmlwdChleGVjdXRlQ29kZSk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGxvY2szNjU6IHN0b3BwaW5nIGxvY2tTY2hlZHVsZXJcIilcbiAgICAgICAgICAgIHNjaGVkdWxlckluc3RhbmNlLnN0b3AoKVxuICAgICAgICAgICAgaWYgKHRoaXMubG9ja1NjaGVkdWxlciA9PT0gc2NoZWR1bGVySW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogbm8gYnJvd3NlclZpZXcgb3IgbG9ja1NjaGVkdWxlciBmb3VuZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTUFJTiBXSU5ET1dcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGFzeW5jIGNyZWF0ZU1haW5XaW5kb3coKSB7XG4gICAgICAgIGxldCBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgaWYgKCFwcmltYXJ5ZGlzcGxheSB8fCAhcHJpbWFyeWRpc3BsYXkuYm91bmRzKSB7XG4gICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpWzBdXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaW5kb3cgZGltZW5zaW9ucyAtIGRlZmluZWQgb25jZSwgdXNlZCBldmVyeXdoZXJlXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gMTAyNFxuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSA2NDBcblxuICAgICAgICAvLyBDYWxjdWxhdGUgY2VudGVyIHBvc2l0aW9uIG9uIHByaW1hcnkgZGlzcGxheVxuICAgICAgICBsZXQgeCA9IDBcbiAgICAgICAgbGV0IHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHggPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueCArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy53aWR0aCAtIHdpbmRvd1dpZHRoKSAvIDIpXG4gICAgICAgICAgICB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnkgKyBNYXRoLmZsb29yKChwcmltYXJ5ZGlzcGxheS5ib3VuZHMuaGVpZ2h0IC0gd2luZG93SGVpZ2h0KSAvIDIpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1haW53aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgICAgICAgICB0aXRsZTogJ01haW4gd2luZG93JyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHksXG4gICAgICAgICAgICB3aWR0aDogd2luZG93V2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHdpbmRvd0hlaWdodCxcbiAgICAgICAgICAgIG1pbldpZHRoOiA4NTAsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IDYwMCxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGFzIFx1MDBDNG5kZXJuIGRlciBHclx1MDBGNlx1MDBERmUgIFxuICAgICAgICAgICAgZnVsbHNjcmVlbmFibGU6IGZhbHNlLCAvLyB2ZXJoaW5kZXJ0IGRlbiBWb2xsYmlsZG1vZHVzIC0gd2ljaHRpZyBmXHUwMEZDciBtYWNvcyBkZW5uIHdlbm4gYXVmIG1hY29zIGRhcyBtYWlud2luZG93IGF1ZiBmdWxsc2NyZWVuIGlzdCBncmVpZnQgYmVpbSBleGFtd2luZG93IGRlciBraW9zayBtb2RlIG5pY2h0ICAtIGVsZWN0cm9uIGJ1ZyAobmVlZHMgZXhhbXBsZSBjb2RlKTogPj4gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy80NDc1NVxuICAgICAgICAgICAgc2hvdzogdHJ1ZSxcbiAgICAgICAgICAgIC8vdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIFxuICAgICAgICAgICBcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogcGF0aC5yZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50RGlyLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuUVVBU0FSX0VMRUNUUk9OX1BSRUxPQURfRk9MREVSLCAnZWxlY3Ryb24tcHJlbG9hZCcgKyBwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9FWFRFTlNJT04pXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kVGhyb3R0bGluZzogdHJ1ZSAgLy8gYWxsb3cgdGhyb3R0bGluZyB3aGVuIHdpbmRvdyBpcyBpbiBiYWNrZ3JvdW5kXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnMgYmVmb3JlIGxvYWRpbmdcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIGFzayBiZWZvcmUgY2xvc2luZ1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCAmJiAhdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCkgeyAgLy8gYWxsb3dleGl0IGlzdCBlaW4gb3ZlcnJpZGUgdm9tIGNvbnRleHQgbWVudSBvZGVyIHNjcmVlbnNob3QgdGVzdC4gZGllc2VyIGthbm4gZGllIGFwcCBzY2hsaWVzc2VuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4pe1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhhcyBubyBsZWdhY3kgdHJheVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsbG93VHJheSkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogR05PTUUgZGV0ZWN0ZWQsIHF1aXR0aW5nIGluc3RlYWQgb2YgdHJheSBtaW5pbWl6ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7ICAvLyBhbGxvdyBjbG9zZSBmbG93XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNob3dNaW5pbWl6ZVdhcm5pbmcoKVxuICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IE1pbmltaXppbmcgTmV4dC1FeGFtIHRvIFN5c3RlbXRyYXlgKSAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2V0IHdpbmRvdyBwcm9wZXJ0aWVzIGltbWVkaWF0ZWx5IGFmdGVyIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5yZW1vdmVNZW51KClcbiAgICAgICAgdGhpcy5tYWlud2luZG93LmZvY3VzKClcbiAgICAgICAgdGhpcy5tYWlud2luZG93Lm1vdmVUb3AoKVxuICAgICAgICAvL3RoaXMubWFpbndpbmRvdy5zZXRIaWRkZW5Jbk1pc3Npb25Db250cm9sKHRydWUpXG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLnNob3dkZXZ0b29scykgeyB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICBpZiAoYXBwLmlzUGFja2FnZWQgfHwgcHJvY2Vzcy5lbnZbXCJERUJVR1wiXSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBnZXRSZW5kZXJlckluZGV4UGF0aCgpO1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIGZpbGU6ICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkRmlsZShmaWxlUGF0aClcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9YFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBMb2FkaW5nIFVSTDogJHt1cmx9YClcbiAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICBhc3luYyBzaG93RXhpdFdhcm5pbmcobWVzc2FnZSl7XG4gICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09rJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9ncmFtbSBCZWVuZGVuJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dFeGl0UXVlc3Rpb24oKXtcbiAgICAgICAgaWYgKHRoaXMuZXhpdFF1ZXN0aW9uT3Blbikge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZGlhbG9nIGFscmVhZHkgb3Blbiwgc2tpcHBpbmdcIilcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBjaG9pY2UgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3F1ZXN0aW9uJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ0phJywgJ05laW4nXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIGJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdXb2xsZW4gc2llIGRpZSBBbndlbmR1bmcgTmV4dC1FeGFtIGJlZW5kZW4/JyxcbiAgICAgICAgICAgICAgICBjYW5jZWxJZDogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZihjaG9pY2UucmVzcG9uc2UgPT0gMSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJXaW5kb3doYW5kbGVyIEAgc2hvd0V4aXRRdWVzdGlvbjogZG8gbm90IGNsb3NlIE5leHQtRXhhbSBhZnRlciBmaW5pc2hlZCBFeGFtXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGFwcC5xdWl0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzaG93TWluaW1pemVXYXJuaW5nKCl7XG4gICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IHRydWVcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW5mbycsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWluaW1pemUgdG8gU3lzdGVtIFRyYXknLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdEaWUgQW53ZW5kdW5nIE5leHQtRXhhbSB3dXJkZSBtaW5pbWllcnQhJyxcbiAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIHRoaXMubWluaW1pemVXYXJuaW5nT3BlbiA9IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogQWRkaXRpb25hbCBGdW5jdGlvbnNcbiAgICAgKi9cblxuICAgIGlzV2F5bGFuZCgpe1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5lbnYuWERHX1NFU1NJT05fVFlQRSA9PT0gJ3dheWxhbmQnOyBcbiAgICB9XG5cbiAgICAvLyB0aGlzIGZ1bmN0aW9uIHVzZXMgYWN0aXZlLXdpbiB0byByZWNlaXZlIG5hbWUgYW5kIHVybCBmcm9tIGFjdGl2ZSB3aW5kb3cgLSB5ZXQgYW5vdGhlciB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGUgZm9jdXMgaXMgc3RpbGwgb24gbmV4dGV4YW1cbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gaW50cm9kdWNlIGV4ZW1wdGlvbnMgZm9yIHRoZSBibHVyIGxpc3RlbmVyXG4gICAgLy8gKGRvd25ncmFkZWQgZnJvbSBnZXQtd2luZG93cyBiZWNhdXNlIG9mIG5hcGkgdjkgaXNzdWUpIGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvZ2V0LXdpbmRvd3MvaXNzdWVzLzE4NlxuICAgIGFzeW5jIHdpbmRvd1RyYWNrZXIoKXtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICAgLy8gY29uc3QgZ2V0d2luID0gYXdhaXQgdGhpcy5nZXRBY3RpdmVXaW5kb3coKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZVdpbiA9IGF3YWl0IGFjdGl2ZVdpbmRvdygpXG4gICAgICAgICBcbiAgICAgICAgICAgIGlmIChhY3RpdmVXaW4gJiYgYWN0aXZlV2luLm93bmVyICYmIGFjdGl2ZVdpbi5vd25lci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgbGV0IG5hbWUgPSBhY3RpdmVXaW4ub3duZXIubmFtZVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aCA9IGFjdGl2ZVdpbi5vd25lci5wYXRoXG4gICAgICAgICAgICAgICAgbGV0IG5hbWVMb3dlciA9IG5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgICAgIGxldCB3cGF0aExvd2VyID0gd3BhdGgudG9Mb3dlckNhc2UoKVxuXG4gICAgICAgICAgICAgICAgaWYgKG5hbWVMb3dlci5pbmNsdWRlcyhcImV4YW1cIikgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwibmV4dFwiKSAgfHwgbmFtZUxvd2VyLmluY2x1ZGVzKFwiZWxlY3Ryb25cIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJlYXNlb2ZhY2Nlc3NkaWFsb2dcIikgfHwgIHdwYXRoTG93ZXIuaW5jbHVkZXMoXCJkaXNhYmxlLXNob3J0Y3V0c1wiKSApeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vIGZva3VzIGlzIG9uIGFsbG93ZWQgd2luZG93IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXNUYXJnZXRBbGxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgLy9mb2N1cyBpcyBub3Qgb24gbmV4dC1leGFtIG9yIGFueSBvdGhlciBhbGxvd2VkIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5mb2N1c1RhcmdldEFsbG93ZWQpeyAgLy9sb2cganVzdCBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2Fybihgd2luZG93aGFuZGxlciBAIHdpbmRvd1RyYWNrZXI6IGZvY3VzIGxvc3QgZXZlbnQgd2FzIHRyaWdnZXJlZC4gYXBwOiAke3dwYXRofSAtICR7bmFtZX0gYClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogJHtlcnJ9YCkgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2FkZHMgYmx1ciBsaXN0ZW5lciB3aGVuIGVudGVyaW5nIGV4YW1tb2RlICAgLy8gYmx1ciBldmVudCBpc250IGZpcmVkIG9uIG1hY29zIE1JU1NJT05DT05UUk9MICh3aGljaCBjYW50IGJlIGRlYWN0aXZhdGVkIGFueW1vcmUpIC0gZGFtbiB5b3UgYXBwbGUhXG4gICAgYWRkQmx1ckxpc3RlbmVyKHdpbmRvdyA9IFwiZXhhbXdpbmRvd1wiKXtcbiAgICAgICAgaWYgKHdpbmRvdyA9PT0gXCJleGFtd2luZG93XCIpeyBcbiAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgYWRkQmx1ckxpc3RlbmVyOiBTZXR0aW5nIEJsdXIgRXZlbnQgZm9yICR7d2luZG93fWApXG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuYWRkTGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLmJsdXJldmVudCh0aGlzKSkgXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2luZG93ID09PSBcInNjcmVlbmxvY2tcIikge1xuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9d2luZG93YClcbiAgICAgICAgICAgIGZvciAobGV0IHNjcmVlbmxvY2t3aW5kb3cgb2YgdGhpcy5zY3JlZW5sb2Nrd2luZG93cyl7XG4gICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50U2NyZWVubG9jayh0aGlzKSkgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvL3JlbW92ZXMgYmx1ciBsaXN0ZW5lciB3aGVuIGxlYXZpbmcgZXhhbSBtb2RlXG4gICAgcmVtb3ZlQmx1ckxpc3RlbmVyKCl7XG4gICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cpe1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnJlbW92ZUFsbExpc3RlbmVycygnYmx1cicpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCByZW1vdmVCbHVyTGlzdGVuZXI6IHJlbW92aW5nIGJsdXIgbGlzdGVuZXJcIilcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBpbXBsZW1lbnRpbmcgYSBzbGVlcCAod2FpdCkgZnVuY3Rpb25cbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgIC8vc3R1ZGVudCBmb2d1cyB3ZW50IHRvIGFub3RoZXIgd2luZG93XG4gICAgYXN5bmMgYmx1cmV2ZW50KHdpbmhhbmRsZXIpIHsgXG5cbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBzdHVkZW50IHRyaWVkIHRvIGxlYXZlIGV4YW0gd2luZG93XCIpXG5cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcpe1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53aW5kb3dUcmFja2VyKCkgIC8vY2hlY2tzIGlmIG5ldyBmb2N1cyB3aW5kb3cgaXMgYWxsb3dlZFxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3d0cmFja2VyIGNoZWNrIGRvbmUuLi5cIilcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhbiB1cCBkZXN0cm95ZWQgc2NyZWVubG9jayB3aW5kb3dzIGZyb20gYXJyYXkgYW5kIGNoZWNrIGlmIGFueSBzdGlsbCBleGlzdFxuICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzID0gd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5maWx0ZXIod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIGNvbnN0IGhhc0FjdGl2ZVNjcmVlbmxvY2sgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLnNvbWUod2luID0+IHdpbiAmJiAhd2luLmlzRGVzdHJveWVkKCkgJiYgd2luLmlzVmlzaWJsZSgpKVxuICAgICAgICAvLyBBbHNvIGNoZWNrIGNsaWVudGluZm8uc2NyZWVubG9jayBmbGFnIGFzIGZhbGxiYWNrIGluIGNhc2UgYXJyYXkgd2FzIGNsZWFyZWQgYnV0IHdpbmRvd3Mgc3RpbGwgZXhpc3RcbiAgICAgICAgaWYgKGhhc0FjdGl2ZVNjcmVlbmxvY2sgfHwgd2luaGFuZGxlci5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LnNjcmVlbmxvY2spIHsgcmV0dXJuIH0vLyBkbyBub3RoaW5nIGlmIHNjcmVlbmxvY2t3aW5kb3cgc3RvbGUgZm9jdXMgLy8gZG8gbm90IHRyaWdnZXIgYW4gaW5maW5pdGUgbG9vcCBiZXR3ZWVuIGV4YW0gd2luZG93IGFuZCBzY3JlZW5sb2NrIHdpbmRvdyAoc3RlYWxpbmcgZWFjaCBvdGhlcnMgZm9jdXMgYmVjYXVzZSBzY3JlZW5sb2Nrd2luZG93IGFwcGVhcnMgYWJvdmUgZXhhbSB3aW5kb3cgYW5kIHdpbGwgY2FwdHVyZSBhIGtsaWNrIGFuZCB0aGVyZWZvcmUgc3RlYWwgZm9jdXMpXG4gICAgICAgIGlmICh3aW5oYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCl7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7IFxuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7IC8vdHJvdHpkZW0gZm9jdXMgenVyXHUwMEZDY2sgYXVmIGRpZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50OiBibHVyZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2UgICAvL2luZm9ybSB0aGUgdGVhY2hlclxuICAgICAgICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93Lm1vdmVUb3AoKTtcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpOyAgICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuXG4gICAgICAgIC8vdHVybiB2b2x1bWUgdXAgXl5cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHsgc3Bhd24oJ3Bvd2Vyc2hlbGwnLCBbJ1NldC1Wb2x1bWVMZXZlbCAtTGV2ZWwgMTAwOyBTZXQtVm9sdW1lTXV0ZSAtTXV0ZSAkZmFsc2UnXSk7IH1cbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09J2RhcndpbicpIHsgZXhlYygnb3Nhc2NyaXB0IC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgdm9sdW1lIDEwMFwiIC1lIFwic2V0IHZvbHVtZSBvdXRwdXQgbXV0ZWQgZmFsc2VcIicpOyB9ICBcbiAgICAgICAgLy8gaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHsgXG4gICAgICAgIC8vICAgICBleGVjKCdhbWl4ZXIgc2V0IE1hc3RlciAxMDAlICcpO1xuICAgICAgICAvLyAgICAgZXhlYygncGFjdGwgc2V0LXNpbmstbXV0ZSBgcGFjdGwgZ2V0LWRlZmF1bHQtc2lua2AgMCcpO1xuICAgICAgICAvLyB9XG4gICAgICAgIFxuICAgICAgICAvL3dlIGNvdWxkIHBsYXkgYSBzb3VuZCBmaWxlIGhlcmUuLiB0YmQuICBcbiAgICB9XG4gICAgLy9zcGVjaWFsIGJsdXIgZXZlbnQgZm9yIHRlbXBvcmFyeSBsb3cgc2VjdXJpdHkgc2NyZWVubG9ja1xuICAgIGJsdXJldmVudFNjcmVlbmxvY2sod2luaGFuZGxlcikgeyBcbiAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogYmx1ci1zY3JlZW5sb2NrIHRyaWdnZXJlZFwiKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9kb24ndCBjeWNsZSB0aHJvdWdoIGFsbCBvZiB0aGVtIC4uIGl0IHdpbGwgY3JlYXRlIGFuIGluZmluaXRlIGZvY3VzIHJhY2VcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0uc2hvdygpOyAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3NbMF0ubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpe1xuICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgYmx1cmV2ZW50U2NyZWVubG9jazogJHtlcnJ9YClcbiAgICAgICAgfVxuICAgIFxuICAgIH1cbiAgICBcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgV2luZG93SGFuZGxlcigpXG4gXG5cblxuXG5cblxuXG5cblxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKlxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXRcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIG1vc3Qgb2YgdGhlIGtleWJvYXJkIHJlc3RyaWN0aW9ucyBjb3VsZCBiZSBoYW5kbGVkIGJ5IFwiaW9ob29rXCIgZm9yIGFsbCBwbGF0Zm9ybXNcbiAqIHVuZm9ydHVuYWxldHkgaXQncyBub3QgeWV0IHJlbGVhc2VkIGZvciBub2RlIHYxNi54IGFuZCBlbGVjdHJvbiB2MTYueCAgKGFsc28gaXQncyBcImJpZyBzdXJcIiBpbnRlbCBvbmx5IG9uIG1hY3MpXG4gKiBodHRwczovL3dpbGl4LXRlYW0uZ2l0aHViLmlvL2lvaG9vay9pbnN0YWxsYXRpb24uaHRtbFxuICpcbiAqIFwibm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyXCIgd291bGQgYmUgYW5vdGhlciBzb2x1dGlvbiBmb3Igd2luZG93cyBhbmQgbWFjb3MgKGFsdGhvdWdoIGl0IHJlcXVpcmVzIFwiYWNjZXNzYWJpbGl0eVwiIHBlcm1pc3Npb25zIG9uIG1hYylcbiAqIGJ1dCBmb3Igbm93IGl0IHNlZW1zIHRoZSBtb2R1bGUgY2FuIG5vdCBydW4gaW4gYSBmaW5hbCBlbGVjdHJvbiBidWlsZFxuICogaHR0cHM6Ly9naXRodWIuY29tL0xhdW5jaE1lbnUvbm9kZS1nbG9iYWwta2V5LWxpc3RlbmVyL2lzc3Vlcy8xOFxuICpcbiAqIGhhcmRjb2RpbmcgdGhlIGtleWJvYXJkc2hvcnRjdXRzIHdlIHdhbnQgdG8gY2FwdHVyZSBpbnRvIGlvaG9vayhvciBuLWctay1sKSBhbmQgbWFudWFsbHkgY29tcGlsaW5nIGl0IGZvciBtYWMgYW5kIHdpbmRvd3MgY291bGQgYmUgZG9uZSAtIChidXQgbm90IHVudGlsIGkgZ2V0IHBhaWQgZm9yIHRoaXMgYW1vdW50IG9mIHdvcmsgOy0pXG4gKi9cblxuXG4vKipcbiAqIHRoZSBuZXh0IGJlc3Qgc29sdXRpb24gaSBjYW1lIHVwIHdpdGggaXMgdG8ga2lsbCBhbGwgb2YgdGhlIHNoZWxscyAtIHN0YXJ0aW5nIHdpdGggZXhwbG9yZXIuZXhlIGJlY2F1c2UgaXRzIGFic29sdXRlbHkgaW1wb3NzaWJsZSB0b1xuICogZGVhY3RpdmF0ZSB0aGlzIG5hc3R5IFwid2luZG93c1wiIGJ1dHRvbiBvciAzRmluZ2VyU2xpZGVVcCBHZXN0dXJlIGluIHdpbmRvd3MgMTEgLSB5b3UgY291bGQgZWRpdCB0aGUgcmVnaXN0cnkgYW5kIHJlYm9vdCBidXQgdGhhdHMgb2J2aW91c2x5IG5vdCB3aGF0IHdlIHdhbnRcbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgY2xpcGJvYXJkLCBnbG9iYWxTaG9ydGN1dCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCB7IFNjaGVkdWxlclNlcnZpY2UgfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBlbmFibGVMaW51eFJlc3RyaWN0aW9ucywgZGlzYWJsZUxpbnV4UmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbGluLmpzJztcbmltcG9ydCB7IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMsIGRpc2FibGVXaW5kb3dzUmVzdHJpY3Rpb25zIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvd2luLmpzJztcbmltcG9ydCB7IGVuYWJsZU1hY1Jlc3RyaWN0aW9ucywgZGlzYWJsZU1hY1Jlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biBhcyB0b2dnbGVNYWNPU0xvY2tkb3duSW1wbCB9IGZyb20gJy4vcmVzdHJpY3Rpb25zL21hYy5qcyc7XG5cbmxldCBjbGlwYm9hcmRJbnRlcnZhbDtcbmxldCBjb25maWdTdG9yZSA9IHtcbiAgICBsaW51eDoge30sXG4gICAgd2luZG93czoge30sXG4gICAgbWFjb3M6IHt9XG59O1xuXG4vLyBsaXN0IG9mIGFwcHMgd2UgZG8gbm90IHdhbnQgdG8gcnVuIGluIGJhY2tncm91bmRcbmNvbnN0IGFwcHNUb0Nsb3NlID0gWydHb29nbGUgQ2hyb21lJywgJ2Nocm9tZScsICdnb29nbGUtY2hyb21lJywgJ01pY3Jvc29mdCBFZGdlJywgJ21zZWRnZScsICdmaXJlZm94JywgJ3NhZmFyaScsICdicmF2ZScsICdvcGVyYScsICdjaGF0Z3B0JywgJ0NoYXRHUFQnLCAnTm9ydG9uU2VjdXJpdHknLCAnTkFWJywgJ1RlYW1zJywgJ21zLXRlYW1zJywgJ3pvb20udXMnLCAnTWljcm9zb2Z0IFRlYW1zJywgJ2Rpc2NvcmQnLCAnem9vbScsICd0ZWFtcycsICd0ZWFtdmlld2VyJywgJ3NreXBlZm9ybGludXgnLCAnc2t5cGUnLCAnYW55ZGVzayddO1xuXG5hc3luYyBmdW5jdGlvbiBlbmFibGVSZXN0cmljdGlvbnMod2luaGFuZGxlcikge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG5cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBwbGF0Zm9ybSByZXN0cmljdGlvbnNcIik7XG5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrWCcsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtDJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgY2xpcGJvYXJkLmNsZWFyKCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSgoKSA9PiB7IGNsaXBib2FyZC5jbGVhcigpOyB9LCAxMDAwKTtcbiAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdGFydCgpO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBlbmFibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSwgYXBwc1RvQ2xvc2UsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0tERSwgcGxhdGZvcm1EaXNwYXRjaGVyLmlzR05PTUUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgYXdhaXQgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpc2FibGVSZXN0cmljdGlvbnMoKSB7XG4gICAgaWYgKGNvbmZpZy5kZXZlbG9wbWVudCkgeyByZXR1cm47IH1cbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogcmVtb3ZpbmcgcmVzdHJpY3Rpb25zLi4uXCIpO1xuXG4gICAgaWYgKGNsaXBib2FyZEludGVydmFsKSB7XG4gICAgICAgIGNsaXBib2FyZEludGVydmFsLnN0b3AoKTtcbiAgICB9XG5cbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1YnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSk7XG4gICAgfVxuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bkltcGwoZW5hYmxlKTtcbn1cblxuZXhwb3J0IHsgZW5hYmxlUmVzdHJpY3Rpb25zLCBkaXNhYmxlUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIH07XG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIExpbnV4LXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbi8vIHVuZm9ydHVuYXRlbHkgdGhlcmUgaXMgbm8gY29udmVuaWVudCB3YXkgZm9yIGdub21lLXNoZWxsIHRvIHVuLXNldCBBTEwgc2hvcnRjdXRzIGF0IG9uY2VcbmNvbnN0IGdub21lS2V5YmluZGluZ3MgPSBbXG4gICAgJ2FjdGl2YXRlLXdpbmRvdy1tZW51JywnbWF4aW1pemUtaG9yaXpvbnRhbGx5JywnbW92ZS10by1zaWRlLW4nLCdtb3ZlLXRvLXdvcmtzcGFjZS04Jywnc3dpdGNoLWFwcGxpY2F0aW9ucycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMycsJ3N3aXRjaC13aW5kb3dzLWJhY2t3YXJkJyxcbiAgICAnYWx3YXlzLW9uLXRvcCcsJ21heGltaXplLXZlcnRpY2FsbHknLCdtb3ZlLXRvLXNpZGUtcycsJ21vdmUtdG8td29ya3NwYWNlLTknLCdzd2l0Y2gtYXBwbGljYXRpb25zLWJhY2t3YXJkJywnICBzd2l0Y2gtdG8td29ya3NwYWNlLTQnLCd0b2dnbGUtYWJvdmUnLFxuICAgICdiZWdpbi1tb3ZlJywnbWluaW1pemUnLCdtb3ZlLXRvLXNpZGUtdycsJ21vdmUtdG8td29ya3NwYWNvZS1kb3duJywnc3dpdGNoLWdyb3VwJywnc3dpdGNoLXRvLXdvcmtzcGFjZS01JywndG9nZ2xlLWZ1bGxzY3JlZW4nLFxuICAgICdiZWdpbi1yZXNpemUnLCdtb3ZlLXRvLWNlbnRlcicsJ21vdmUtdG8td29ya3NwYWNlLTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sYXN0Jywnc3dpdGNoLWdyb3VwLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS02JywndG9nZ2xlLW1heGltaXplZCcsXG4gICAgJ2Nsb3NlJywnbW92ZS10by1jb3JuZXItbmUnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMCcsJ21vdmUtdG8td29ya3NwYWNlLWxlZnQnLCdzd2l0Y2gtaW5wdXQtc291cmNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS03JywndG9nZ2xlLW9uLWFsbC13b3Jrc3BhY2VzJyxcbiAgICAnY3ljbGUtZ3JvdXAnLCdtb3ZlLXRvLWNvcm5lci1udycsJ21vdmUtdG8td29ya3NwYWNlLTExJywnbW92ZS10by13b3Jrc3BhY2UtcmlnaHQnLCdzd2l0Y2gtaW5wdXQtc291cmNlLWJhY2t3YXJkICBzd2l0Y2gtdG8td29ya3NwYWNlLTgnLCd0b2dnbGUtc2hhZGVkJyxcbiAgICAnY3ljbGUtZ3JvdXAtYmFja3dhcmQnLCdtb3ZlLXRvLWNvcm5lci1zZScsJ21vdmUtdG8td29ya3NwYWNlLTEyJywnbW92ZS10by13b3Jrc3BhY2UtdXAnLCdzd2l0Y2gtcGFuZWxzJywnc3dpdGNoLXRvLXdvcmtzcGFjZS05JywndW5tYXhpbWl6ZScsXG4gICAgJ2N5Y2xlLXBhbmVscycsJ21vdmUtdG8tY29ybmVyLXN3JywnbW92ZS10by13b3Jrc3BhY2UtMicsJ3BhbmVsLW1haW4tbWVudScsJ3N3aXRjaC1wYW5lbHMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWRvd24nLFxuICAgICdjeWNsZS1wYW5lbHMtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItZG93bicsJ21vdmUtdG8td29ya3NwYWNlLTMnLCdwYW5lbC1ydW4tZGlhbG9nJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1sYXN0JyxcbiAgICAnY3ljbGUtd2luZG93cycsJ21vdmUtdG8tbW9uaXRvci1sZWZ0JywnbW92ZS10by13b3Jrc3BhY2UtNCcsJ3JhaXNlJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0xMCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtbGVmdCcsXG4gICAgJ2N5Y2xlLXdpbmRvd3MtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItcmlnaHQnLCdtb3ZlLXRvLXdvcmtzcGFjZS01JywncmFpc2Utb3ItbG93ZXInLCdzd2l0Y2gtdG8td29ya3NwYWNlLTExJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1yaWdodCcsXG4gICAgJ2xvd2VyJywnbW92ZS10by1tb25pdG9yLXVwJywnbW92ZS10by13b3Jrc3BhY2UtNicsJ3NldC1zcGV3LW1hcmsnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEyJywnc3dpdGNoLXRvLXdvcmtzcGFjZS11cCcsXG4gICAgJ21heGltaXplJywnbW92ZS10by1zaWRlLWUnLCdtb3ZlLXRvLXdvcmtzcGFjZS03Jywnc2hvdy1kZXNrdG9wJywnc3dpdGNoLXRvLXdvcmtzcGFjZS0yJywnc3dpdGNoLXdpbmRvd3MnXG5dO1xuY29uc3QgZ25vbWVTaGVsbEtleWJpbmRpbmdzID0gWydmb2N1cy1hY3RpdmUtbm90aWZpY2F0aW9uJywnb3Blbi1hcHBsaWNhdGlvbi1tZW51Jywnc2NyZWVuc2hvdCcsJ3NjcmVlbnNob3Qtd2luZG93Jywnc2hpZnQtb3ZlcnZpZXctZG93bicsXG4gICAgJ3NoaWZ0LW92ZXJ2aWV3LXVwJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTEnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0zJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTQnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNScsXG4gICAgJ3N3aXRjaC10by1hcHBsaWNhdGlvbi02Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTcnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tOCcsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi05Jywnc2hvdy1zY3JlZW5zaG90LXVpJywnc2hvdy1zY3JlZW4tcmVjb3JkaW5nLXVpJyxcbiAgICAndG9nZ2xlLWFwcGxpY2F0aW9uLXZpZXcnLCd0b2dnbGUtbWVzc2FnZS10cmF5JywndG9nZ2xlLW92ZXJ2aWV3J107XG5jb25zdCBnbm9tZU11dHRlcktleWJpbmRpbmdzID0gWydyb3RhdGUtbW9uaXRvcicsJ3N3aXRjaC1tb25pdG9yJywndGFiLXBvcHVwLWNhbmNlbCcsJ3RhYi1wb3B1cC1zZWxlY3QnLCd0b2dnbGUtdGlsZWQtbGVmdCcsJ3RvZ2dsZS10aWxlZC1yaWdodCddO1xuY29uc3QgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MgPSBbJ2FwcC1jdHJsLWhvdGtleS0xJywnYXBwLWN0cmwtaG90a2V5LTEwJywnYXBwLWN0cmwtaG90a2V5LTInLCdhcHAtY3RybC1ob3RrZXktMycsJ2FwcC1jdHJsLWhvdGtleS00JywnYXBwLWN0cmwtaG90a2V5LTUnLFxuICAgICdhcHAtY3RybC1ob3RrZXktNicsJ2FwcC1jdHJsLWhvdGtleS03JywnYXBwLWN0cmwtaG90a2V5LTgnLCdhcHAtY3RybC1ob3RrZXktOScsXG4gICAgJ2FwcC1ob3RrZXktMScsJ2FwcC1ob3RrZXktMTAnLCdhcHAtaG90a2V5LTInLCdhcHAtaG90a2V5LTMnLCdhcHAtaG90a2V5LTQnLCdhcHAtaG90a2V5LTUnLCdhcHAtaG90a2V5LTYnLCdhcHAtaG90a2V5LTcnLCdhcHAtaG90a2V5LTgnLCdhcHAtaG90a2V5LTknLFxuICAgICdhcHAtc2hpZnQtaG90a2V5LTEnLCdhcHAtc2hpZnQtaG90a2V5LTEwJywnYXBwLXNoaWZ0LWhvdGtleS0yJywnYXBwLXNoaWZ0LWhvdGtleS0zJywnYXBwLXNoaWZ0LWhvdGtleS00JywnYXBwLXNoaWZ0LWhvdGtleS01JyxcbiAgICAnYXBwLXNoaWZ0LWhvdGtleS02JywnYXBwLXNoaWZ0LWhvdGtleS03JywnYXBwLXNoaWZ0LWhvdGtleS04JywnYXBwLXNoaWZ0LWhvdGtleS05Jywnc2hvcnRjdXQnXTtcbmNvbnN0IGdub21lV2F5bGFuZEtleWJpbmRpbmdzID0gWydzd2l0Y2gtdG8tc2Vzc2lvbi0xJywnc3dpdGNoLXRvLXNlc3Npb24tMicsJ3N3aXRjaC10by1zZXNzaW9uLTMnLCdzd2l0Y2gtdG8tc2Vzc2lvbi00Jywnc3dpdGNoLXRvLXNlc3Npb24tNScsJ3N3aXRjaC10by1zZXNzaW9uLTYnLCdzd2l0Y2gtdG8tc2Vzc2lvbi03Jywnc3dpdGNoLXRvLXNlc3Npb24tOCcsJ3N3aXRjaC10by1zZXNzaW9uLTknLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMCcsJ3N3aXRjaC10by1zZXNzaW9uLTExJywnc3dpdGNoLXRvLXNlc3Npb24tMTInXTtcblxuLyoqXG4gKiBFbmFibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChLREUvR05PTUUsIGNsb3NlIGFwcHMsIGNsaXBib2FyZCkuXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnU3RvcmUgLSBzaGFyZWQgc3RvcmUgKGNvbmZpZ1N0b3JlLmxpbnV4Lm51bWJlck9mRGVza3RvcHMpXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzS0RFXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzR05PTUVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zKGNvbmZpZ1N0b3JlLCBhcHBzVG9DbG9zZSwgaXNLREUsIGlzR05PTUUpIHtcbiAgICB0cnkge1xuICAgICAgICBhcHBzVG9DbG9zZS5mb3JFYWNoKGFwcCA9PiB7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cImAsIChwZ3JlcEVycm9yLCBzdGRvdXQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBncmVwRXJyb3IgJiYgc3Rkb3V0ICYmIHN0ZG91dC50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBncmVwIC1pIFwiJHthcHB9XCIgfCB4YXJncyAtciBraWxsIC05YCwgKGtpbGxFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFraWxsRXJyb3IpIGxvZy5pbmZvKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xvc2VkICR7YXBwfWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBlcnJvcnNcbiAgICB9XG5cbiAgICBpZiAoaXNLREUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgS0RFIHJlc3RyaWN0aW9uc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrcmVhZGNvbmZpZzUnLCBbJy0tZmlsZScsICdrd2lucmMnLCAnLS1ncm91cCcsICdEZXNrdG9wcycsICctLWtleScsICdOdW1iZXInXSwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoa3JlYWRjb25maWcpOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IDE7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcyA9IHN0ZG91dC50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiByZWNvbmZpZ3VyaW5nIGt3aW5cIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgYCR7cGxhdGZvcm1EaXNwYXRjaGVyLmhvbWVkaXJlY3Rvcnl9Ly5jb25maWcva3dpbnJjYCwnLS1ncm91cCcsICdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCdcIlwiJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsJ2t3aW5yYycsJy0tZ3JvdXAnLCdEZXNrdG9wcycsJy0ta2V5JywnTnVtYmVyJywnMSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdyZWNvbmZpZ3VyZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0tXaW4nLCdzZXRDdXJyZW50RGVza3RvcCcsJzEnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGRpc2FibGluZyBlZmZlY3RzXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdkZXNrdG9wZ3JpZCddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnc2NyZWVuZWRnZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJywnL0VmZmVjdHMnLCdvcmcua2RlLmt3aW4uRWZmZWN0cy51bmxvYWRFZmZlY3QnLCAnb3ZlcnZpZXcnXSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IGFkZGl0aW9uYWwgdHR5J3NcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywgJ2t4a2JyYycsICctLWdyb3VwJywgJ0xheW91dCcsICctLWtleScsICdPcHRpb25zJywgJ3NydnJrZXlzOm5vbmUnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGJ1cy1zZW5kJywgWyctLXNlc3Npb24nLCAnLS10eXBlPXNpZ25hbCcsICctLWRlc3Q9b3JnLmtkZS5rZXlib2FyZCcsICcvTGF5b3V0cycsICdvcmcua2RlLmtleWJvYXJkLnJlbG9hZENvbmZpZyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogY2xlYXJpbmcgY2xpcGJvYXJkIGhpc3RvcnlcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGdsb2JhbCBrZXlib2FyZHNob3J0Y3V0c1wiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2dsb2JhbGFjY2VsJyAsJy9rZ2xvYmFsYWNjZWwnLCAnb3JnLmtkZS5LR2xvYmFsQWNjZWwuYmxvY2tHbG9iYWxTaG9ydGN1dHMnLCAndHJ1ZSddKTtcbiAgICAgICAgfSwgMjAwMCk7XG4gICAgfVxuXG4gICAgaWYgKGlzR05PTUUpIHtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgR05PTUUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXYXlsYW5kOiBkaXNhYmxlIFZUL1RUWSBzd2l0Y2ggKEN0cmwrQWx0K0YxLi5GMTIpIHZpYSBtdXR0ZXIga2V5YmluZGluZ3NcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVXYXlsYW5kS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JywgJ29yZy5nbm9tZS5tdXR0ZXIud2F5bGFuZC5rZXliaW5kaW5ncycsIGJpbmRpbmcsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGNvbmYnLCBbJ3dyaXRlJywgYC9vcmcvZ25vbWUvbXV0dGVyL3dheWxhbmQva2V5YmluZGluZ3MvJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZVNoZWxsS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YCwgYFsnJ11gXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lTXV0dGVyS2V5YmluZGluZ3MpIHtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsnc2V0JyAsJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZURhc2hUb0RvY2tLZXliaW5kaW5ncykge1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJywgYCR7YmluZGluZ31gLCBgWycnXWBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleScsIGAnJ2BdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5tdXR0ZXIgZHluYW1pYy13b3Jrc3BhY2VzIGZhbHNlJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUuZGVza3RvcC53bS5wcmVmZXJlbmNlcyBudW0td29ya3NwYWNlcyAxJyk7XG4gICAgICAgICAgICAvLyBYMTEgb25seTogZGlzYWJsZSBUVFkgc3dpdGNoIHZpYSBzZXR4a2JtYXAgKG9uIFdheWxhbmQgd2UgcmVseSBvbiBtdXR0ZXIga2V5YmluZGluZ3MgYWJvdmUpXG4gICAgICAgICAgICBpZiAoIXBsYXRmb3JtRGlzcGF0Y2hlci5pc1dheWxhbmQoKSkge1xuICAgICAgICAgICAgICAgIGNvbmZpZ1N0b3JlLmxpbnV4LnNydnJrZXlzTm9uZVNldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3NldHhrYm1hcCAtb3B0aW9uIHNydnJrZXlzOm5vbmUnLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZy53YXJuKCdwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9ucyAoR05PTUUpOiBzZXR4a2JtYXAgc3J2cmtleXM6bm9uZSBmYWlsZWQnLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxufVxuXG4vKipcbiAqIERpc2FibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIGFuZCByZXN0b3JlIEtERS9HTk9NRSBzZXR0aW5ncy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSkge1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IEtERSBkZXRlY3RlZFwiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ2Jsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ2ZhbHNlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJyAsJy9Db21wb3NpdG9yJywgJ29yZy5rZGUua3dpbi5Db21wb3NpdGluZy5yZXN1bWUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBrZ2xvYmFsYWNjZWw1JicpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCctLWRlbGV0ZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBwbGFzbWFzaGVsbCAmJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZUtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuZGVza3RvcC53bS5rZXliaW5kaW5ncycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGdub21lV2F5bGFuZEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcsICdvcmcuZ25vbWUubXV0dGVyLndheWxhbmQua2V5YmluZGluZ3MnLCBiaW5kaW5nXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVTaGVsbEtleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUuc2hlbGwua2V5YmluZGluZ3MnLCBgJHtiaW5kaW5nfWBdKTtcbiAgICB9XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiBnbm9tZU11dHRlcktleWJpbmRpbmdzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcgLCdvcmcuZ25vbWUubXV0dGVyLmtleWJpbmRpbmdzJywgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgZ25vbWVEYXNoVG9Eb2NrS2V5YmluZGluZ3MpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JyAsJ29yZy5nbm9tZS5zaGVsbC5leHRlbnNpb25zLmRhc2gtdG8tZG9jaycsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnICwnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleSddKTtcbiAgICAvLyByZXN0b3JlIFRUWSBzd2l0Y2ggaWYgd2UgaGFkIGRpc2FibGVkIGl0IHZpYSBzZXR4a2JtYXAgKEdOT01FIFgxMSlcbiAgICBpZiAoY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0KSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKFwic2V0eGtibWFwIC1vcHRpb24gJydcIiwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogc2V0eGtibWFwIHJlc3RvcmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gZmFsc2U7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBXaW5kb3dzLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbi8qKlxuICogRW5hYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChzaG9ydGN1dHMsIGNsb3NlIGFwcHMsIGtpbGwgZXhwbG9yZXIpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlO1xuICAgICAgICBjb25zdCBleGVjdXRhYmxlMSA9IGpvaW4ocHVibGljQmFzZSwgJ2Rpc2FibGUtc2hvcnRjdXRzLmV4ZScpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTEsIFtdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScsIHNoZWxsOiBmYWxzZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmRvd3Mgc2hvcnRjdXRzIGRpc2FibGVkXCIpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gc2hvcnRjdXRzKTogJHtlcnJ9YCk7IH1cblxuICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgYXBwIG9mIGFwcHNUb0Nsb3NlKSB7XG4gICAgICAgICAgICBjb25zdCBlc2NhcGVkQXBwID0gYXBwLnJlcGxhY2UoLycvZywgXCInJ1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJGFwcE5hbWUgPSAnJHtlc2NhcGVkQXBwfSc7IHRyeSB7ICRwcm9jcyA9IEdldC1Qcm9jZXNzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHsgJF8uUHJvY2Vzc05hbWUgLWlsaWtlICgnKicgKyAkYXBwTmFtZSArICcqJykgfTsgaWYgKCRwcm9jcyAtYW5kICRwcm9jcy5Db3VudCAtZ3QgMCkgeyAkcHJvY3MgfCBTdG9wLVByb2Nlc3MgLUZvcmNlIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlOyBXcml0ZS1PdXRwdXQgJ2tpbGxlZCcgfSB9IGNhdGNoIHsgfVwiYDtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlQXBwKSA9PiB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpLmluY2x1ZGVzKCdraWxsZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZUFwcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmICghd2luaGFuZGxlcikge1xuICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmhhbmRsZXIgaXMgbm90IHByb3ZpZGVkIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcmV0cnlDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMDA7XG4gICAgICAgIGNvbnN0IGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAod2luaGFuZGxlci5leGFtd2luZG93ICYmICF3aW5oYW5kbGVyLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2traWxsIC9mIC9pbSBleHBsb3Jlci5leGUnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZXhwbG9yZXIuZXhlYCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXRyeUNvdW50IDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgIHJldHJ5Q291bnQrKztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMsIDEwMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZXhhbXdpbmRvdyBub3QgZm91bmQgYWZ0ZXIgJHttYXhSZXRyaWVzICogMTAwfW1zIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cygpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh1bmJsb2NrIHNob3J0Y3V0cywgcmVzdGFydCBleHBsb3JlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpIHtcbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogdW5ibG9ja2luZyBzaG9ydGN1dHMuLi5cIik7XG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHRhc2traWxsICAvSU0gXCJkaXNhYmxlLXNob3J0Y3V0cy5leGVcIiAvVCAvRmAsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZGlzYWJsZS1zaG9ydGN1dHMuZXhlYCk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgZXhwbG9yZXIuZXhlXCInLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHRhc2tsaXN0IGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKCdleHBsb3Jlci5leGUnKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiByZXN0YXJ0aW5nIGV4cGxvcmVyLi4uXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ3N0YXJ0IGV4cGxvcmVyLmV4ZScsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gZXhwbG9yZXIpOiAke2UubWVzc2FnZX1gKTsgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBtYWNPUy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlLCB0b2dnbGVNYWNPU0xvY2tkb3duKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IFRvdWNoQmFyLCBzeXN0ZW1QcmVmZXJlbmNlcywgcG93ZXJNb25pdG9yIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyBzdG9yZWQgcmVmcyBmb3IgY2xlYW51cCB3aGVuIGRpc2FibGluZyBtYWNPUyByZXN0cmljdGlvbnNcbmxldCB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG5sZXQgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG5sZXQgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuXG4vKiogU2luZ2xlIGhhbmRsZXIgZm9yIGFsbCBtYWNPUyByZXN0cmljdGlvbiBzaWduYWxzOiBsb2cgYW5kIHJlLWZvY3VzIGV4YW0gd2luZG93IC8gaW5mb3JtIHRlYWNoZXIuICovXG5mdW5jdGlvbiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKHNpZ25hbE5hbWUpIHtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6ICR7c2lnbmFsTmFtZX0gZGV0ZWN0ZWRgKTtcbiAgICBpZiAoIWN1cnJlbnRXaW5oYW5kbGVyPy5leGFtd2luZG93Py5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbykgY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpO1xuICAgIH1cbn1cblxuY29uc3QgbG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdsb2NrLXNjcmVlbicpO1xuY29uc3QgdW5sb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ3VubG9jay1zY3JlZW4nKTtcblxuLyoqXG4gKiBFbmFibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChUb3VjaEJhciwgY2xpcGJvYXJkLCBjbG9zZSBhcHBzLCB3b3Jrc3BhY2UvbG9jayBtb25pdG9yaW5nKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgY29uc3QgeyBUb3VjaEJhckxhYmVsLCBUb3VjaEJhclNwYWNlciB9ID0gVG91Y2hCYXI7XG4gICAgY29uc3QgdGV4dGxhYmVsID0gbmV3IFRvdWNoQmFyTGFiZWwoeyBsYWJlbDogXCJOZXh0LUV4YW1cIiB9KTtcbiAgICBjb25zdCB0b3VjaEJhciA9IG5ldyBUb3VjaEJhcih7XG4gICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgdGV4dGxhYmVsLFxuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgXVxuICAgIH0pO1xuICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdz8uc2V0VG91Y2hCYXIodG91Y2hCYXIpO1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gd2luaGFuZGxlcjtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdwYmNvcHkgPCAvZGV2L251bGwnKTtcblxuICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBraWxsIC05IC1mIFwiJHthcHB9XCJgLCAoZXJyb3IsIHN0ZGVyciwgc3Rkb3V0KSA9PiB7fSk7XG4gICAgfSk7XG5cbiAgICAvLyB3b3Jrc3BhY2Uvc3BhY2Ugc3dpdGNoIGFuZCBsb2NrL3VubG9jayBtb25pdG9yaW5nIChtYWNPUyBvbmx5KVxuICAgIHRyeSB7XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gc3lzdGVtUHJlZmVyZW5jZXMuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKCdOU1dvcmtzcGFjZUFjdGl2ZVNwYWNlRGlkQ2hhbmdlTm90aWZpY2F0aW9uJywgKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnZGVza3RvcC9zcGFjZSBzd2l0Y2gnKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cblxuICAgIHBvd2VyTW9uaXRvci5vbignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9uKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG5cbiAgICBsb2dTdHJlYW1Qcm9jZXNzID0gc3Bhd24oJ2xvZycsIFsnc3RyZWFtJywgJy0tcHJlZGljYXRlJywgJ3N1YnN5c3RlbSA9PSBcImNvbS5hcHBsZS5kb2NrXCIgQU5EIGNhdGVnb3J5ID09IFwibWlzc2lvbmNvbnRyb2xcIiddKTtcbiAgICBsb2dTdHJlYW1Qcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuICAgICAgICBpZiAoZGF0YS50b1N0cmluZygpLmluY2x1ZGVzKCdtb2RlJykpIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ01pc3Npb24gQ29udHJvbCcpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIERpc2FibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh0b3VjaGJhciwgbW9uaXRvcmluZyBsaXN0ZW5lcnMgYW5kIGxvZyBwcm9jZXNzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKSB7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuICAgIGlmICh3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7IHN5c3RlbVByZWZlcmVuY2VzLnVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkKTsgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG4gICAgfVxuICAgIHBvd2VyTW9uaXRvci5vZmYoJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vZmYoJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBpZiAobG9nU3RyZWFtUHJvY2Vzcykge1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGVzL2VuYWJsZXMgbWlzc2lvbiBjb250cm9sLCBzcGFjZXMgYW5kIHRyYWNrcGFkIGdlc3R1cmVzLlxuICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSB0cnVlIHJlc3RvcmVzIGV2ZXJ5dGhpbmcsIGZhbHNlIGxvY2tzIGV2ZXJ5dGhpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIHJldHVybjtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCB0b2dnbGVNYWNPU0xvY2tkb3duOiAke2VuYWJsZSA/ICdlbmFibGUnIDogJ2Rpc2FibGUnfSBtaXNzaW9uIGNvbnRyb2wgbG9ja2Rvd25gKTtcblxuICAgIGNvbnN0IG1jSWRzID0gWzMyLCAzMywgMzQsIDM1LCA3OSwgODAsIDgxLCA4MiwgMTE4LCAxMTksIDEyMCwgMTIxXTtcbiAgICBjb25zdCBwbGlzdFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5LCAnTGlicmFyeS9QcmVmZXJlbmNlcy9jb20uYXBwbGUuc3ltYm9saWNob3RrZXlzLnBsaXN0Jyk7XG4gICAgY29uc3QgYmFja3VwUGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3RvcnksICduZXh0X2V4YW1faG90a2V5c19iYWNrdXAucGxpc3QnKTtcblxuICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgY29uc3QgaG90a2V5Q29tbWFuZHMgPSBtY0lkcy5tYXAoaWQgPT5cbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuc3ltYm9saWNob3RrZXlzIEFwcGxlU3ltYm9saWNIb3RLZXlzIC1kaWN0LWFkZCAke2lkfSBcIjxkaWN0PjxrZXk+ZW5hYmxlZDwva2V5PjxmYWxzZS8+PC9kaWN0PlwiYFxuICAgICAgICApLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAhIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gY3AgXCIke3BsaXN0UGF0aH1cIiBcIiR7YmFja3VwUGF0aH1cIjsgZmk7XG4gICAgICAgICR7aG90a2V5Q29tbWFuZHN9O1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcblxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRW5hYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIFxuICAgICAgICAgIGNwIFwiJHtiYWNrdXBQYXRofVwiIFwiJHtwbGlzdFBhdGh9XCI7IFxuICAgICAgICAgIHJtIFwiJHtiYWNrdXBQYXRofVwiOyBcbiAgICAgICAgZmk7XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuICAgICAgICBsb2cuaW5mbygnbWFpbiBAIHRvZ2dsZU1hY09TTG9ja2Rvd246IEVuYWJsZSBNaXNzaW9uQ29udG9sJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBEaXNhYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4ndXNlIHN0cmljdCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInICAgLy8gZGFzIG1hY2h0IGtyYXNzZXN0ZSByYWNlY29kaXRpb25zIG1pdCBlbGVjdHJvbiBlaWdlbmVuIHZlcnNpb25lbiAtIHVuYmVkaW5ndCBkaWUgc2VsYmUgdmVyc2lvbiBiZWhhbHRlbiB3aWUgZWxlY3Ryb25cbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBzY3JlZW4sIGlwY01haW4sIGFwcCwgQnJvd3NlcldpbmRvdywgd2ViQ29udGVudHMgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBzY3JlZW5zaG90IGZyb20gJ3NjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kJztcbmltcG9ydCB7IFdvcmtlciB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgcnVuUmVtb3RlQ2hlY2sgfSBmcm9tICcuL3JlbW90ZUNoZWNrLmpzJ1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5cbmNvbnN0IHNoZWxsID0gKGNtZCkgPT4geyAgIHJldHVybiBleGVjU3luYyhjbWQsIHsgZW5jb2Rpbmc6ICd1dGY4Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pOyB9OyAgLy8gc3RkZXJyIHVudGVyZHJcdTAwRkNja3QgXG5jb25zdCBhZ2VudCA9IG5ldyBodHRwcy5BZ2VudCh7IHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UgfSk7XG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lOyBcblxuIC8qKlxuICAqIEhhbmRsZXMgaW5mb3JtYXRpb24gZmV0Y2hpbmcgZnJvbSB0aGUgc2VydmVyIGFuZCBhY3RzIG9uIHN0YXR1cyB1cGRhdGVzXG4gICovXG4gXG4gY2xhc3MgQ29tbUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IGZhbHNlXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMCAvLyB3ZSBjb3VudCBmYWlscyBhbmQgZGVhY3RpdmF0ZSBvbiA0IGNvbnNlcXVlbnQgZmFpbHNcbiAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IHRydWVcbiAgICAgICAgdGhpcy50aW1lciA9IDBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBudWxsXG4gICAgICAgIHRoaXMudXNlV29ya2VyID0gdHJ1ZVxuICAgICAgICB0aGlzLndvcmtlckZhaWxzID0gMFxuICAgIH1cbiBcbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnJlcXVlc3RVcGRhdGUuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRTY3JlZW5zaG90LmJpbmQodGhpcyksIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICBpZiAoIXRoaXMud29ya2VyICYmIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyAgdGhpcy5zZXR1cEltYWdlV29ya2VyKCkgIH1cbiAgICB9XG4gXG5cbiAgICAvKipcbiAgICAgKiBTZXR1cCB0aGUgaW1hZ2Ugd29ya2VyXG4gICAgICogdXNlcyBmb3JrIHRvIGNyZWF0ZSBhIG5ldyBjaGlsZCBwcm9jZXNzXG4gICAgICogdXNlcyB0aGUgaW1hZ2VXb3JrZXJMaW51eC5qcyBvciBpbWFnZVdvcmtlclNoYXJwLmpzIGZpbGVcbiAgICAgKiB0aGUgd29ya2VyIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzZXR1cEltYWdlV29ya2VyKCkge1xuICAgICAgICBjb25zdCB3b3JrZXJVUkwgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyVVJMO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlclVSTCwgeyB0eXBlOiAnbW9kdWxlJywgZW52OiB7IC4uLnByb2Nlc3MuZW52IH0gfSk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogSW1hZ2VXb3JrZXIgaW5pdGlhbGl6ZWQuIFVzaW5nIFwiICsgcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlckZpbGVOYW1lKVxuICAgICAgICBcblxuICAgICAgICB0aGlzLndvcmtlci5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlci5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlckZhaWxzICs9IDFcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53b3JrZXJGYWlscyA+IDQpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZmFpbGVkIDUgdGltZXMgLSBzd2l0Y2hpbmcgdG8gbm8gcHJvY2Vzc2luZycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBcbiAgICAgKiBpZiB1c2VXb3JrZXIgaXMgdHJ1ZSwgdGhlIHNjcmVlbnNob3QgaXMgcHJvY2Vzc2VkIGluIGEgc2VwYXJhdGUgcHJvY2Vzc1xuICAgICAqIG90aGVyd2lzZSB0aGUgc2NyZWVuc2hvdCBpcyBub3QgcHJvY2Vzc2VkIGFuZCB0aGUgb3JpZ2luYWwgc2NyZWVuc2hvdCBpcyByZXR1cm5lZFxuICAgICAqL1xuICAgIGFzeW5jIHByb2Nlc3NJbWFnZShpbWdCdWZmZXIpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy53b3JrZXIpIHsgLy90cmlwbGUgY2hlY2sgaWYgd29ya2VyIGlzIGluaXRpYWxpemVkXG4gICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXb3JrZXIgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7IGltZ0J1ZmZlcjogQXJyYXkuZnJvbShpbWdCdWZmZXIpLCBpbVZlcnNpb246IHBsYXRmb3JtRGlzcGF0Y2hlci5pbVZlcnNpb24gfSk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlci5vbmNlKCdtZXNzYWdlJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7IFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmFsbGJhY2sgdG8gbm8gcHJvY2Vzc2luZyAgIFxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuc2hvdEJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltZ0J1ZmZlcikudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyQmFzZTY0ID0gc2NyZWVuc2hvdEJhc2U2NFxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgc2NyZWVuc2hvdEJhc2U2NDogc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0OiBoZWFkZXJCYXNlNjQsIGlzYmxhY2s6IGZhbHNlLCBpbWdCdWZmZXI6IGltZ0J1ZmZlciB9O1xuXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cbiAgICAvKiogXG4gICAgICogVXBkYXRlIGN1cnJlbnQgU2VydmVyc3RhdHVzICsgU3R1ZGVudHRzdGF0dXMgKGV2ZXJ5IDUgc2Vjb25kcylcbiAgICAgKi9cbiAgICBhc3luYyByZXF1ZXN0VXBkYXRlKCl7XG5cbiAgICAgICAgdGhpcy50aW1lcisrICAgLy8gd2UgdXNlIHRpbWVyIHRvIHRpbWUgbG9vcHMgd2l0aCBkaWZmZXJlbnQgaW50ZXJ2YWxzIHdpdGhvdXQgaW50cm9kdWNpbmcgbmV3IHVubmVjY2VzYXJ5IHNjaGVkdWxlcnNcbiAgICAgICAgaWYgKHRoaXMudGltZXIgJSAyMCA9PT0gMCApeyAgLy8gcnVuIGV2ZXJ5IDIwKjUgKHVwZGF0ZWxvb3ApIHNlY29uZHNcblxuICAgICAgICAgICAgY29uc3QgdXNlc1JlbW90ZUFzc2lzdGFudCA9IGF3YWl0IHJ1blJlbW90ZUNoZWNrKHByb2Nlc3MucGxhdGZvcm0pXG5cbiAgICAgICAgICAgIGlmICh1c2VzUmVtb3RlQXNzaXN0YW50KSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ21haW4gQCByZWFkeTogUG9zc2libGUgcmVtb3RlIGFzc2lzdGFuY2UgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5rZXl3b3Jkcykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBLZXl3b3JkICR7a2V5d29yZH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb3J0IG9mIHVzZXNSZW1vdGVBc3Npc3RhbnQucG9ydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYG1haW4gQCByZWFkeTogUG9ydCAke3BvcnR9IGRldGVjdGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucmVtb3RlYXNzaXN0YW50ID0gdXNlc1JlbW90ZUFzc2lzdGFudFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5pbml0QmxvY2tXaW5kb3dzKCkgIC8vIGNoZWNrIGlmIHRoZXJlIGlzIGEgbmV3IHNjcmVlbiB0aGF0IG5lZWRzIHRvIGJlIGJsb2NrZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7cmV0dXJufVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb24gbG9zdCByZXNldCB0cmlnZ2VyZWQgIG5vIHNlcnZlcnNpZ25hbCBmb3IgMjAgc2Vjb25kc1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPj0gNSApeyAgXG4gICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiBDb25uZWN0aW9uIHRvIFRlYWNoZXIgbG9zdCEgUmVtb3ZpbmcgcmVnaXN0cmF0aW9uLlwiKSAvL3JlbW92ZSBzZXJ2ZXIgcmVnaXN0cmF0aW9uIGxvY2FsbHkgKHNhbWUgYXMgJ2tpY2snKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICAgICAgICAgIHRoaXMucmVzZXRDb25uZWN0aW9uKCkgICAvLyB0aGlzIGFsc28gcmVzZXRzIHNlcnZlcmlwIHRoZXJlZm9yZSBubyBhcGkgY2FsbHMgYXJlIG1hZGUgYWZ0ZXJ3YXJkc1xuICAgICAgICAgICAgICAgIHRoaXMua2lsbFNjcmVlbmxvY2soKSAgICAgICAvLyBqdXN0IGluIGNhc2Ugc2NyZWVucyBhcmUgYmxvY2tlZC4uIGxldCBzdHVkZW50cyB3b3JrXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gIFxuXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0ge2NsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm99XG5cbiAgICAgICAgICAgIGZldGNoKGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVgLCB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICBjYWNoZTogXCJuby1zdG9yZVwiLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7IHRocm93IG5ldyBFcnJvcignTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7IH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJlcnJvclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICAgICAgKGRhdGEubWVzc2FnZSA9PT0gXCJub3RhdmFpbGFibGVcIil7IGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IEV4YW0gSW5zdGFuY2Ugbm90IGZvdW5kIScpOyAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSA1OyB9ICAgIC8vIGV4YW0gaW5zdGFuY2Ugbm90IGF2YWlsYWJsZSBidXQgc2VydmVyIHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChkYXRhLm1lc3NhZ2UgPT09IFwicmVtb3ZlZFwiKXsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IFN0dWRlbnQgcmVnaXN0cmF0aW9uIG5vdCBmb3VuZCEnKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KClcbiAgICAgICAgICAgICAgICAgICAgfSAgIC8vIHN0dWRlbnQgZ290IGtpY2tlZCAtIHdlIGhhbmRsZSB0aGlzIGRpZmZlcmVudGx5IG5vdy4gdGVhY2hlciBzdG9yZXMgXCJraWNrZWRcIiBmb3Igc3R1ZGVudCB0byBjb2xsZWN0LiBzdHVkZW50IGlzIHJlbW92ZWQgZnJvbSBzZXJ2ZXIgd2hlbiBjb2xsZWN0aW5nIGtpY2tlZCBpbmZvLiBzdHVkZW50IGNsb3NlcyBleGFtIGFuZCBjbGVhbnMgdXAuXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAke3RoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0fSBIZWFydGJlYXQgbG9zdC4uYCk7ICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO30gICAvLyBoZWFydGJlYXQgbG9zdCBzZXJ2ZXIgbm90IHJlYWNoYWJsZVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMDsgLy8gRGllcyB6XHUwMEU0aGx0IGViZW5mYWxscyBhbHMgZXJmb2xncmVpY2hlciBIZWFydGJlYXQgLSBWZXJiaW5kdW5nIGhhbHRlblxuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IGZhbHNlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlclN0YXR1c0RlZXBDb3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhLnNlcnZlcnN0YXR1cykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHVkZW50U3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc3R1ZGVudHN0YXR1cykpOyBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJTdGF0dXNEZWVwQ29weSwgc3R1ZGVudFN0YXR1c0RlZXBDb3B5KTsvLyBWZXJhcmJlaXR1bmcgZGVyIGVtcGZhbmdlbmVuIERhdGVuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgKz0gMTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogKCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9KSAke2Vycm9yfWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IC8vIHByZXZlbnQgZm9jdXMgd2FybmluZyBibG9jayBpZiBubyBjb25uZWN0aW9uIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIGlmIG5vdCBjb25uZWN0ZWQgYnV0IHN0aWxsIGluIGV4YW0gbW9kZSB5b3UgY291bGQgdHJpZ2dlciBhIGZvY3VzIHdhcm5pbmcgYW5kIG5vYm9keSBpcyBhYmxlIHRvIHVubG9jayB5b3VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICBhc3luYyBzZW5kU2NyZWVuc2hvdCgpe1xuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7cmV0dXJufSAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZFxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCkgeyAgLy9jaGVjayBpZiBzZXJ2ZXIgY29ubmVjdGVkIC0gZ2V0IGlwXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2s7IC8vIFZhcmlhYmxlbiBhdVx1MDBERmVyaGFsYiBkZXMgaWYtQmxvY2tzIGRlZmluaWVyZW5cbiAgICAgICAgICAgIGxldCBpbWdCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyAgXG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBzY3JlZW5zaG90IGZyb20gZGVza3RvcCB2aWEgc2NyZWVuc2hvdC1kZXNrdG9wLXdheWxhbmQgKGZsYW1lc2hvdCwgaW1hZ2VtYWdpYywgZXRjKVxuICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90KHsgZm9ybWF0OiAncG5nJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrLCBpbWdCdWZmZXIgfSA9IGF3YWl0IHRoaXMucHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikpOyAgLy8ga2VpbiBpbWFnZUJ1ZmZlciBtaXRnZWdlYmVuIGJlZGV1dGV0IG51dHplIHNjcmVlbnNob3QtZGVza3RvcCBpbSB3b3JrZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHsgdGhpcy5zY3JlZW5zaG90RmFpbHMgPSAwO31cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW1hZ2UgcHJvY2Vzc2luZyBmYWlsZWRcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vZ3JhYiBcInNjcmVlbnNob3RcIiBmcm9tIGFwcHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEZvY3VzZWRNaW5kb3cgPSBXaW5kb3dIYW5kbGVyLmdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkgIC8vcmV0dXJucyBleGFtIHdpbmRvdyBpZiBub3RoaW5nIGluIGZvY3VzIG9yIG1haW4gd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Rm9jdXNlZE1pbmRvdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGN1cnJlbnRGb2N1c2VkTWluZG93LndlYkNvbnRlbnRzLmNhcHR1cmVQYWdlKCkgIC8vIHRoaXMgc2hvdWxkIGFsd2F5cyB3b3JrIGJlY2F1c2UgaXQncyBvbmJvYXJkIGVsZWN0cm9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWdCdWZmZXIgPSByZXN1bHQudG9QTkcoKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICh7IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjayB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7IC8vIGF0dGVudGlvbiBwcm9jZXNzSW1hZ2UgIGNvbnZlcnRzIGJ1ZmZlciB0byB1aW50OGFycmF5XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RGYWlscyArPTE7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBwcm9jZXNzSW1hZ2UgZmFpbGVkOiAke2Vycn1gKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTUFDT1MgV09SS0FST1VORCAtIHN3aXRjaCB0byBwYWdlY2FwdHVyZSBpZiBubyBwZXJtaXNzb25zIGFyZSBncmFudGVkXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSBcImRhcndpblwiICYmIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgJiYgaW1nQnVmZmVyICE9PSBudWxsKXsgIC8vdGhpcyBpcyBmb3IgbWFjT1MgYmVjYXVzZSBpdCBkZWxpdmVycyBhIGJsYW5rIGJhY2tncm91bmQgc2NyZWVuc2hvdCB3aXRob3V0IHBlcm1pc3Npb25zLiB3ZSBjYXRjaCB0aGF0IGNhc2Ugd2l0aCBhIHdvcmthcm91bmRcbiAgICAgICAgICAgICAgICB0aGlzLmZpcnN0Q2hlY2tTY3JlZW5zaG90ID0gZmFsc2UgICAvL25ldmVyIGRvIHRoaXMgYWdhaW5cbiAgICAgICAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gcGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2U7XG4gICAgICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGRhdGE6IHsgdGV4dCB9IH0gICA9IGF3YWl0IFRlc3NlcmFjdC5yZWNvZ25pemUoaW1nQnVmZmVyICwgJ2VuZycseyBsYW5nUGF0aDogcHVibGljUGF0aCwgY2FjaGVQYXRoOiB0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5IH0gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGFwcFdpbmRvd1Zpc2libGUgPSB0ZXh0LmluY2x1ZGVzKFwiRXhhbVwiKSAgIC8vY2hlY2sgaWYgdGhlIHdvcmQgXCJFeGFtXCIgY2FuIGJlIGZvdW5kIGluIHNjcmVlbnNob3QgLSBvdGhlcndpc2UgaXQgaXMgbW9zdCBsaWtlbHkgYSBibGFuayBkZXNrdG9wIC0gbWFjb3MgcXVpcmtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhcHBXaW5kb3dWaXNpYmxlKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eT1mYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBQbGVhc2UgY2hlY2sgeW91ciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIC0gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3QgKG1hY29zKTogTWFjT1Mgc2NyZWVuc2hvdHBlcm1pc3Npb25zIGNoZWNrIE9LXCIpO31cbiAgICAgICAgICAgICAgICB9Y2F0Y2goZXJyKXsgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiAke2Vycn1gKTsgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nIHdlIGRvIG5vdCBoYXZlIGEgc2NyZWVuc2hvdCAtIHNvIGRvIG5vdCB1cGRhdGUgdGhlIHNlcnZlclxuICAgICAgICAgICAgaWYgKCFzY3JlZW5zaG90QmFzZTY0KXtcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFNjcmVlbnNob3QgZXJyb3IgLT4gU3dpdGNoaW5nIHRvIFBhZ2VDYXB0dXJlYCkgfSBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7IHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIgPSBmYWxzZTsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBQYWdlQ2FwdHVyZSBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gTm8tUHJvY2Vzc2luZ2ApIH0gICBcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnNjcmVlbnNob3RGYWlscyA+IDQgJiYgIXBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogbm8gc2NyZWVuc2hvdCBhdmFpbGFibGUgLSBwbGVhc2UgZml4IHlvdXIgc2V0dXBgKSB9XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIC8vZG8gbm90IHJ1biBjb2xvcmNoZWNrIGlmIGFscmVhZHkgbG9ja2VkXG4gICAgICAgICAgICBpZiAoIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMpe1xuICAgICAgICAgICAgICAgIGlmIChpc2JsYWNrKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU3R1ZGVudCBTY3JlZW5zaG90IGRvZXMgbm90IGZpdCByZXF1aXJlbWVudHMgKGFsbGJsYWNrKVwiKTtcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJlcmVjaG5lbiBkZXMgTUQ1LUhhc2hzIGRlcyBCYXNlNjQtU3RyaW5nc1xuICAgICAgICAgICAgbGV0IHNjcmVlbnNob3RoYXNoID0gbnVsbFxuICAgICAgICAgICAgdHJ5IHsgc2NyZWVuc2hvdGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmVlbnNob3RCYXNlNjQsICdiYXNlNjQnKSkuZGlnZXN0KFwiaGV4XCIpOyAgfSAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBjYXRjaChlcnIpeyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IGNyZWF0aW5nIGhhc2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgY2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mbyxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90OiBzY3JlZW5zaG90QmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RoYXNoOiBzY3JlZW5zaG90aGFzaCxcbiAgICAgICAgICAgICAgICBoZWFkZXI6IGhlYWRlckJhc2U2NCxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90ZmlsZW5hbWU6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4gKyBcIi5qcGdcIixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzZW5kIHNjcmVlbnNob3QgdG8gc2VydmVyIHZpYSBlbWFpbCBmZXRjaCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMjtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC91cGRhdGVzY3JlZW5zaG90YDtcbiAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQsIG1heFJldHJpZXMpOyAvLyBFcnN0ZSBBbmZyYWdlIHN0YXJ0ZW5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG4gICAgZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgPSAwLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogTmV0d29yayByZXNwb25zZSB3YXMgbm90IG9rJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhICYmIGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGRvU2NyZWVuc2hvdFVwZGF0ZTogU3RhdHVzIEVycm9yOlwiLCBkYXRhLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgaWYgKGF0dGVtcHQgPCBtYXhSZXRyaWVzIC0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9TY3JlZW5zaG90VXBkYXRlKHVybCwgcGF5bG9hZCwgYWdlbnQsIGF0dGVtcHQgKyAxLCBtYXhSZXRyaWVzKTsgLy8gUmV0cnlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcyAtIDEgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlIChmZXRjaCk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG5cblxuXG5cbiAgICBhc3luYyBraWNrU3R1ZGVudChzdHVkZW50c3RhdHVzKXtcbiAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpY2tTdHVkZW50OiBTdHVkZW50IGdvdCBraWNrZWQgYnkgVGVhY2hlclwiKVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5raWNrZWQgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDBcbiAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtkZWxmb2xkZXJvbmV4aXQ6IGZhbHNlfSAgLy8gZG8gbm90IGRlbGV0ZSBmb2xkZXIgb24gZXhpdCBiZWNhdXNlIHN0dWRlbnQgZ290IGtpY2tlZFxuICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cyAmJiBzdHVkZW50c3RhdHVzLmRlbGZvbGRlcil7IHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPSB0cnVlfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIHJlYWN0IHRvIHNlcnZlciBzdGF0dXMgXG4gICAgICogdGhpcyBjdXJyZW50bHkgb25seSBoYW5kbGUgc3RhcnRleGFtICYgZW5kZXhhbVxuICAgICAqIGNvdWxkIGFsc28gaGFuZGxlIGtpY2ssIGZvY3VzcmVzdG9yZSwgYW5kIGV2ZW4gdHJpZ2dlciBmaWxlIHJlcXVlc3RzXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXMoc2VydmVyc3RhdHVzLCBzdHVkZW50c3RhdHVzKXtcbiAgICAgICBcbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAvLyBpbmRpdmlkdWFsIHN0YXR1cyB1cGRhdGVzXG5cbiAgICAgICAgaWYgKCBzdHVkZW50c3RhdHVzICYmIE9iamVjdC5rZXlzKHN0dWRlbnRzdGF0dXMpLmxlbmd0aCAhPT0gMCkgeyAgLy8gd2UgaGF2ZSBzdGF0dXMgdXBkYXRlcyAodGFza3MpIC0gZG8gaXQhXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5wcmludGRlbmllZCkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdkZW5pZWQnKSAgIC8vdHJpZ2dlciwgd2h5XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmtpY2tlZCkgeyAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIGJ5IHRlYWNoZXJcbiAgICAgICAgICAgICAgICB0aGlzLmtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuICAgLy90aGlzIGVuZHMgaGVyZSBiZWNhdXNlIHdlIGdvdCBraWNrZWQgYnkgdGhlIHRlYWNoZXJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlclwiKVxuICAgICAgICAgICAgICAgIGxldCBkZWxmb2xkZXIgPSB0cnVlXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpeyAgIC8vIHNldCBieSBzZXJ2ZXIuanMgKGRlc2t0b3AgcGF0aCArIGV4YW1kaXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBcbiAgICAgICAgICAgICAgICAgICAgZGVsZm9sZGVyID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2ZpbGVlcnJvcicsIGVycm9yKSAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogQ2FuIG5vdCBkZWxldGUgZGlyZWN0b3J5IC0gJHtlcnJvcn0gYClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVsZm9sZGVyID09IGZhbHNlKXsgIC8vdHJ5IGRlbGV0aW5nIGZpbGUgYnkgZmlsZSAodGhlIG9uZSB0aGF0IGNhdXNlcyB0aGUgcHJvYmxlbSB3aWxsIHN0YXkgaW4gdGhlIGZvbGRlcilcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBqb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkgeyBmcy5ybVN5bmMoZmlsZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBWZXJzdWNoZSwgZGFzIFZlcnplaWNobmlzIHJla3Vyc2l2IHp1IGxcdTAwRjZzY2hlblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgZnMudW5saW5rU3luYyhmaWxlUGF0aCk7ICB9Ly8gVmVyc3VjaGUsIGRpZSBEYXRlaSB6dSBsXHUwMEY2c2NoZW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IChkZWxmb2xkZXIpIEZlaGxlciBiZWltIExcdTAwRjZzY2hlbiBkZXIgRGF0ZWkvVmVyemVpY2huaXM6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsb2FkZmlsZWxpc3QnKTsgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZm9jdXMgPT0gZmFsc2Upe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5yZXN0b3JlZm9jdXNzdGF0ZSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiByZXN0b3JpbmcgZm9jdXMgc3RhdGUgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgJiYgIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KXsgXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXRLaW9zayh0cnVlKVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmFjdGl2YXRlUHJpdmF0ZVNwZWxsY2hlY2sgPT0gdHJ1ZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSBmYWxzZSAgKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGFjdGl2YXRpbmcgc3BlbGxjaGVjayBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGUgPSB0cnVlICAvL2NsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2sgd2lsbCBiZSBwdXQgb24gdGhpcy5wcml2YXRlU3BlbGxjaGVjayBpbiBlZGl0b3IgdXBkYXRlZCB2aWEgZmV0Y2hJbmZvKClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBpcGNNYWluLmVtaXQoXCJzdGFydExhbmd1YWdlVG9vbFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSBmYWxzZSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9PSB0cnVlICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogZGUtYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZWQgPSBmYWxzZSBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5zdWdnZXN0aW9ucyA9IHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3VnZ2VzdGlvbnNcblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuc2VuZGV4YW0gPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEV4YW1Ub1RlYWNoZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZmV0Y2hmaWxlcyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoc3R1ZGVudHN0YXR1cy5maWxlcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdldG1hdGVyaWFscyA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdGhpcyBpcyBhbiBtaWNyb3NvZnQzNjUgdGhpbmcuIGNoZWNrIGlmIGV4YW0gbW9kZSBpcyBvZmZpY2UsIGNoZWNrIGlmIHRoaXMgaXMgc2V0IC0gb3RoZXJ3aXNlIGRvIG5vdCBlbnRlciBleGFtbW9kZSAtIGl0IHdpbGwgZmFpbFxuICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIHNoYXJpbmcgbGluayAtIGl0IHdpbGwgYmUgdXNlZCBpbiBcIm1pY3Jvc29mdDM2NVwiIGV4YW0gbW9kZVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlID0gc3R1ZGVudHN0YXR1cy5tc29mZmljZXNoYXJlICBcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5ncm91cCl7XG4gICAgICAgICAgICAgICAgLy9zZXQgb3IgdXBkYXRlIGdyb3VwIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IHN0dWRlbnRzdGF0dXMuZ3JvdXAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpICAvLyBpZiB3ZSBjaGFuZ2UgZ3JvdXAgd2UgbmVlZCB0byBnZXQgdGhlIG1hdGVyaWFscyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIFxuXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGdsb2JhbCBzdGF0dXMgdXBkYXRlc1xuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIFxuICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgU1RBUlRcbiAgICAgICAgICogQVRURU5USU9OOiBtb3ZlIHRoaXMgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiAtIGl0IGlzIHRvbyBjb21wbGV4IGFuZCBzaG91bGQgYmUgc3BsaXQgdXBcbiAgICAgICAgICogaW4gdGhlIGZ1dHVyZSB3ZSB3ZWxsIGRldGVybWluZSBpZiBzZWN0aW9uIHN3aXRjaCBpcyBoYW5kbGVkIGJ5IHRoZSB0ZWFjaGVyIG9yIGJ5IHRoZSBzdHVkZW50IGFuZCBhY3QgYWNjb3JkaW5nbHlcbiAgICAgICAgICogaWYgaGFuZGxlZCBieSBzdHVkZW50IHRoZSB0ZWFjaGVyIHN0dHR1cyBpcyBpZ25vcmVkIGFuZCB0aGUgc3dpY2ggc2VjdGlvbiBmdW5jdGlvbiBpcyBjYWxsZWQgZGlyZWN0bHkgKHByb2JhYmx5IG1vdmUgdG8gaXBjaGFuZGxlci5qcylcbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgIFxuXG4gICAgICAgICAgICAvL2NoZWNrIGlmIHRoZSBjdXJyZW50IGFjdGl2ZSBzZWN0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBvbmUgaW4gdGhlIHNlcnZlcnN0YXR1cyAtIGlmIG5vdCBjaGFuZ2UgdG8gdGhlIG5ldyBzZWN0aW9uXG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGNoYW5naW5nIHNlY3Rpb24gdG8gJHtzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbn0gJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZX1gIClcblxuICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TG9ja2VkU2VjdGlvbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbjsgLy8gQ3VycmVudCBzZWN0aW9uIG51bWJlciAoc291cmNlIGZvciBzYXZpbmcpXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9ja2VkU2VjdGlvbiA9IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uOyAvLyBOZXcgc2VjdGlvbiBudW1iZXIgKHNvdXJjZSBmb3IgbG9hZGluZylcbiAgICAgICAgICAgICAgICBjb25zdCBleGFtRGlyID0gdGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeTtcblxuXG4gICAgICAgICAgICAgICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID09PSBcImVkaXRvclwiKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBzZW5kaW5nIGV4YW0gdG8gdGVhY2hlciAoZmluYWwgc3VibWl0KVwiKVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgY3VycmVudCB3b3JrIGFzIGJhc2U2NCB0byB0ZWFjaGVyIChzdG9yZXMgcGRmIGluIEFCR0FCRSBmb2xkZXIgd2l0aCBzdWJtaXNzaW9uIG51bWJlcilcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBkZiA9IGF3YWl0IHRoaXMuZ2V0QmFzZTY0UERGKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciwgc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tjdXJyZW50TG9ja2VkU2VjdGlvbl0uc2VjdGlvbm5hbWUpICAvLyBsb2NhbCBmdW5jdGlvbiB0byBnZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAocGRmLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQmFzZTY0UERGdG9UZWFjaGVyKHBkZi5iYXNlNjRwZGYsIGN1cnJlbnRMb2NrZWRTZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFRvVGVhY2hlcigpIC8vYmFja3VwIGxvY2FsIGZpbGVzIGFuZCBzZW5kIHRvIHRlYWNoZXIgKGFyY2hpdmUgd2l0aCB0aW1lc3RhbXApXG5cblxuICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhhbXR5cGUgaW4gY2xpZW50aW5mb1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbG9ja2VkIHNlY3Rpb24gQUZURVIgc2F2aW5nIHRoZSBvbGQgc3RhdGVcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBuZXdMb2NrZWRTZWN0aW9uO1xuXG5cblxuICAgICAgICAgICAgICAgIC8vIE1PVkUgU2VjdGlvbiBGaWxlcyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFBBUlQgMTogU0FWRSBDVVJSRU5UIEVYQU1ESVIgRklMRVMgdG8gYSBzdWJkaXJlY3RvcnkgbmFtZWQgYnkgdGhlIENVUlJFTlQgbG9ja2VkIHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhleGFtRGlyKSAmJiBjdXJyZW50TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHsgLy8gQ2hlY2sgaWYgbWFpbiBkaXIgZXhpc3RzIGFuZCBhIHNlY3Rpb24gaXMgY3VycmVudGx5IGFjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlUGF0aCA9IGAke2V4YW1EaXJ9LyR7Y3VycmVudExvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzYXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoc2F2ZVBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyAvLyBDcmVhdGUgc2F2ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhleGFtRGlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBGb3VuZCAke2ZpbGVzLmxlbmd0aH0gaXRlbXMgaW4gZXhhbURpciB0byBzYXZlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmaWxlc1NhdmVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBgJHtleGFtRGlyfS8ke2ZpbGV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMob2xkUGF0aCk7IC8vIEdldCBmaWxlIHN0YXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBwcm9jZXNzIGFjdHVhbCBGSUxFUywgbm90IGRpcmVjdG9yaWVzIChsaWtlIHRoZSBzZWN0aW9uIGZvbGRlcnMgdGhlbXNlbHZlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gYCR7c2F2ZVBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7IC8vIENvcHkgZmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZFBhdGgpOyAvLyBEZWxldGUgb3JpZ2luYWwgZmlsZSBmcm9tIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNTYXZlZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2tpcHBpbmcgbm9uLWZpbGUgKGZvbGRlcikgaXRlbSAke2ZpbGV9IGluIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU3VjY2Vzc2Z1bGx5IHNhdmVkICR7ZmlsZXNTYXZlZH0gZmlsZXMgdG8gc2VjdGlvbiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gUEFSVCAyOiBMT0FEIEZJTEVTIGZyb20gdGhlIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgTkVXIGxvY2tlZCBzZWN0aW9uIHRvIGV4YW1EaXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xvY2tlZFNlY3Rpb24gIT0gbnVsbCAmJiBuZXdMb2NrZWRTZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRQYXRoID0gYCR7ZXhhbURpcn0vJHtuZXdMb2NrZWRTZWN0aW9ufWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2FkUGF0aCkpIHsgLy8gQ2hlY2sgaWYgdGhlIG5ldyBzZWN0aW9uIGZvbGRlciBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc1RvTG9hZCA9IGZzLnJlYWRkaXJTeW5jKGxvYWRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IENvcGllZCBmaWxlICR7ZmlsZX0gZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNraXBwaW5nIG5vbi1maWxlIGl0ZW0gJHtmaWxlfSBpbiBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gZGlyZWN0b3J5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IG5ld0xvY2tlZFNlY3Rpb24gaXMgZmFsc3kgKCR7bmV3TG9ja2VkU2VjdGlvbn0pLCBza2lwcGluZyBmaWxlIGxvYWRgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogRXJyb3IgZHVyaW5nIGZvbGRlciBvcGVyYXRpb24gLSAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IGN1cnJlbnRMb2NrZWRTZWN0aW9uOiAke2N1cnJlbnRMb2NrZWRTZWN0aW9ufSwgbmV3TG9ja2VkU2VjdGlvbjogJHtuZXdMb2NrZWRTZWN0aW9ufSwgZXhhbURpcjogJHtleGFtRGlyfWApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBBY3R1YWxseSBTV0lUQ0ggRVhBTSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBleGFtIHdpbmRvdyBvciByZWxlYWQgdGhlIG5ldyBleGFtIHNlY3Rpb24gaW4gdGhlIHNhbWUgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93IC0gaWYgeW91IGRvbid0IG5leHQtZXhhbSB3aWxsIGNyYXNoIHNpbGVudGx5IG9uIHJlbG9hZCBhbmQgc2VjdGlvbiBzd2l0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKS5mb3JFYWNoKHdjID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbGxlIFdlYlZpZXdzIGRlcyBDaGlsZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogU1dJVENIIEVYQU0gU0VDVElPTiAgRU5EXG4gICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgICBcblxuXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2xvY2tlZCAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5sb2NrKSB7ICB0aGlzLmFjdGl2YXRlU2NyZWVubG9jaygpIH1cbiAgICAgICAgZWxzZSBpZiAoIXNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICkgeyB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgfVxuXG4gICAgICAgIC8vIHNjcmVlbnNob3Qgc2FmZXR5IChPQ1Igc2VhcmNoZXMgZm9yIG5leHQtZXhhbSBzdHJpbmcpXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdG9jcikgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSB0cnVlICB9XG4gICAgICAgIGVsc2UgeyB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RvY3IgPSBmYWxzZSAgIH1cblxuICAgICAgICAvLyBHcm91cHMgaGFuZGxpbmdcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb25dLmdyb3Vwcyl7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZX1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gZmFsc2V9XG5cbiAgICAgICAgLy91cGRhdGUgc2NyZWVuc2hvdGludGVydmFsXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsIHx8IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT09IDApIHsgLy8wIGlzIHRoZSBzYW1lIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCBidXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCAhPT0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwICkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogU2NyZWVuc2hvdEludGVydmFsIGNoYW5nZWQgdG9cIiwgc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsID0gc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCoxMDAwXG4gICAgICAgICAgICAgICAgICBpZiAoIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBkaXNhYmxlZCFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2xlYXIgb2xkIGludGVydmFsIGFuZCBzdGFydCBuZXcgaW50ZXJ2YWwgaWYgc2V0IHRvIHNvbWV0aGluZyBiaWdnZXIgdGhhbiB6ZXJvXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA+IDApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuaW50ZXJ2YWwgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5leGFtbW9kZSAmJiAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgLy8gcmVtb3ZlIGxvY2tzY3JlZW4gaW1tZWRpYXRlbHkgLSBkb24ndCB3YWl0IGZvciBzZXJ2ZXIgaW5mb1xuICAgICAgICAgICAgdGhpcy5zdGFydEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICB0aGlzLmtpbGxTY3JlZW5sb2NrKCkgXG4gICAgICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBzZW5kIGJhc2U2NCBwZGYgdG8gdGVhY2hlclxuICAgIHNlbmRCYXNlNjRQREZ0b1RlYWNoZXIoYmFzZTY0cGRmLCBzZWN0aW9uPTEpe1xuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcHJpbnRyZXF1ZXN0LyR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfS8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59YDtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgIGRvY3VtZW50OiBiYXNlNjRwZGYsXG4gICAgICAgICAgICBwcmludHJlcXVlc3Q6IGZhbHNlLCAgICBcbiAgICAgICAgICAgIHN1Ym1pc3Npb25udW1iZXI6IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcixcbiAgICAgICAgICAgIGxvY2tlZHNlY3Rpb246IHNlY3Rpb25cbiAgICAgICAgfVxuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7IHJldHVybiByZXNwb25zZS5qc29uKCk7ICB9KVxuICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1lc3NhZ2UgPT0gXCJzdWNjZXNzXCIpe1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlcisrICAgLy8gc3VjY2Vzc2Z1bCBzdWJtaXNzaW9uIC0+IGluY3JlbWVudCBudW1iZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHsgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlZGl0b3IgQCBwcmludGJhc2U2NDpcIixlcnJvci5tZXNzYWdlKSAgICBcbiAgICAgICAgfSk7IFxuICAgIH1cbiAgICBcblxuXG5cbiAgICAvL2dldCBiYXNlNjQgcGRmIGZyb20gZWRpdG9yXG4gICAgLy8gQVRURU5USU9OOiB0aGVyZSBpcyBhIHNpbWlsYXIgbWV0aG9kIGluIGlwY2hhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgc3RvcmVzIGl0IGFzIGZpbGUgaW4gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgYXN5bmMgZ2V0QmFzZTY0UERGKHN1Ym1pc3Npb25udW1iZXIsIHNlY3Rpb25uYW1lLCBwcmludEJhY2tncm91bmQ9ZmFsc2Upe1xuICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICBcbiAgICAgICAgLy8gV2FpdCBmb3IgYW55IG9uZ29pbmcgcHJpbnQgb3BlcmF0aW9uIHRvIGZpbmlzaCAobWF4IDMwIHNlY29uZHMpXG4gICAgICAgIGxldCB3YWl0Q291bnQgPSAwO1xuICAgICAgICBjb25zdCBtYXhXYWl0ID0gMzAwOyAvLyAzMCBzZWNvbmRzIHdpdGggMTAwbXMgaW50ZXJ2YWxzXG4gICAgICAgIHdoaWxlIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgJiYgd2FpdENvdW50IDwgbWF4V2FpdCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgxMDApO1xuICAgICAgICAgICAgd2FpdENvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBwcmludFRvUERGIGxvY2sgdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIHN0aWxsIHJ1bm5pbmdcIik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiUERGIGdlbmVyYXRpb24gdGltZW91dCAtIGFub3RoZXIgcHJpbnQgb3BlcmF0aW9uIGlzIGluIHByb2dyZXNzXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgcGFnZVNpemU6ICdBNCcsXG4gICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IHByaW50QmFja2dyb3VuZCxcbiAgICAgICAgICAgIHByaW50U2VsZWN0aW9uT25seTogZmFsc2UsXG4gICAgICAgICAgICBsYW5kc2NhcGU6IGZhbHNlLFxuICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuXG4gIFxuICAgICAgICAgICAgZm9vdGVyVGVtcGxhdGU6IFwiPGRpdiBzdHlsZT0naGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1ib3R0b206MTBweDsnPjxzcGFuIGNsYXNzPXBhZ2VOdW1iZXI+PC9zcGFuPnw8c3BhbiBjbGFzcz10b3RhbFBhZ2VzPjwvc3Bhbj48L2Rpdj5cIixcbiAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke3NlY3Rpb25uYW1lfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwOyA8L3NwYW4+PHNwYW4gY2xhc3M9ZGF0ZSBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7QWJnYWJlOiAke3N1Ym1pc3Npb25udW1iZXJ9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6cmlnaHQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9PC9zcGFuPjwvZGl2PmAsXG4gICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGVcbiAgICAgICAgYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmV4ZWN1dGVKYXZhU2NyaXB0KGBkb2N1bWVudC50aXRsZSA9IFwiJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9IC0gVmVyc2lvbiAke3N1Ym1pc3Npb25udW1iZXJ9XCJgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNldCBsb2NrIGJlZm9yZSBzdGFydGluZyBQREYgZ2VuZXJhdGlvblxuICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMucHJpbnRUb1BERihvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2U2NHBkZiA9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVVybCA9IGBkYXRhOmFwcGxpY2F0aW9uL3BkZjtiYXNlNjQsJHtiYXNlNjRwZGZ9YDtcbiAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIlBERiBnZW5lcmF0ZWRcIiwgZGF0YVVybDpkYXRhVXJsLCBiYXNlNjRwZGY6IGJhc2U2NHBkZiwgc3RhdHVzOiBcInN1Y2Nlc3NcIiB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBnZXRCYXNlNjRQREY6IEVycm9yIGdlbmVyYXRpbmcgUERGOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXJyb3IgZ2VuZXJhdGluZyBQREZcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIEFsd2F5cyByZWxlYXNlIHRoZSBsb2NrLCBldmVuIGlmIGFuIGVycm9yIG9jY3VycmVkXG4gICAgICAgICAgICBJcGNIYW5kbGVyLmlzUHJpbnRpbmdQZGYgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNob3cgdGVtcG9yYXJ5IHNjcmVlbmxvY2sgd2luZG93XG4gICAgYWN0aXZhdGVTY3JlZW5sb2NrKCl7XG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcbiAgICAgICBcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID09IDApeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IHRydWVcbiAgICAgICAgICAgIGZvciAobGV0IGRpc3BsYXkgb2YgZGlzcGxheXMpe1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSAgLy8gYWRkIHNjcmVlbmxvY2sgd2luZG93cyBmb3IgYWRkaXRpb25hbCBkaXNwbGF5c1xuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSB0ZW1wb3Jhcnkgc2NyZWVubG9ja3dpbmRvd1xuICAgIGtpbGxTY3JlZW5sb2NrKCl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzY3JlZW5sb2Nrd2luZG93IG9mIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5sb2Nrd2luZG93ICYmICFzY3JlZW5sb2Nrd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgc2NyZWVubG9ja3dpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyBcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lsbFNjcmVlbmxvY2s6IG5vIGZ1bmN0aW9uYWwgc2NyZWVubG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgfSBcbiAgICAgICAgLy8gQ2xlYXIgYXJyYXkgY29tcGxldGVseSBhZnRlciBhdHRlbXB0aW5nIHRvIGRlc3Ryb3kgYWxsIHdpbmRvd3NcbiAgICAgICAgLy8gVGhlIGNsb3NlZCBldmVudCBoYW5kbGVyIHdpbGwgYWxzbyBjbGVhbiB1cCwgYnV0IHRoaXMgZW5zdXJlcyB0aGUgYXJyYXkgaXMgZW1wdHlcbiAgICAgICAgV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cyA9IFtdXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVubG9jayA9IGZhbHNlXG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTdGFydHMgZXhhbSBtb2RlIGZvciBzdHVkZW50XG4gICAgICogZGVsZXRlcyB3b3JrZm9sZGVyIGNvbnRlbnRzIChpZiBzZXQpXG4gICAgICogb3BlbnMgYSBuZXcgd2luZG93IGluIGtpb3NrIG1vZGUgd2l0aCB0aGUgZ2l2ZW4gZXhhbXR5cGVcbiAgICAgKiBlbmFibGVzIHRoZSBibHVyIGxpc3RlbmVyIGFuZCBhY3RpdmF0ZXMgcmVzdHJpY3Rpb25zIChkaXNhYmxlIGtleWJvYXJzaG9ydGN1dHMgZXRjLilcbiAgICAgKiBAcGFyYW0gc2VydmVyc3RhdHVzIGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGV4YW1tb2RlLCBleGFtdHlwZSwgYW5kIG90aGVyIHNldHRpbmdzIGZyb20gdGhlIHRlYWNoZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEV4YW0oc2VydmVyc3RhdHVzKXtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IGRpYWxvZyBpcyBvcGVuIGFuZCBsb2cgd2FybmluZ1xuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGl0V2FybmluZ09wZW4gfHwgV2luZG93SGFuZGxlci5leGl0UXVlc3Rpb25PcGVuIHx8IFdpbmRvd0hhbmRsZXIubWluaW1pemVXYXJuaW5nT3Blbikge1xuICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogRGlhbG9nIGlzIHN0aWxsIG9wZW4gLSBleGFtIHdpbGwgc3RhcnQgYW55d2F5XCIpXG4gICAgICAgIH1cbiAgXG4gICAgICAgIGxldCBkaXNwbGF5cyA9IHNjcmVlbi5nZXRBbGxEaXNwbGF5cygpXG4gICAgICAgIGxldCBwcmltYXJ5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICBcbiAgICAgICAgaWYgKCFwcmltYXJ5IHx8IHByaW1hcnkgPT09IFwiXCIgfHwgIXByaW1hcnkuaWQpeyBwcmltYXJ5ID0gZGlzcGxheXNbMF0gfSAgICAgICBcblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gdHJ1ZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5jbWFyZ2luICAvLyB0aGlzIGlzIHVzZWQgdG8gY29uZmlndXJlIG1hcmdpbiBzZXR0aW5ncyBmb3IgdGhlIGVkaXRvclxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxpbmVzcGFjaW5nID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0ubGluZXNwYWNpbmcgLy8gd2UgdHJ5IHRvIGRvdWJsZSBsaW5lc3BhY2luZyBvbiBkZW1hbmQgaW4gcGRmIGNyZWF0aW9uXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uYXVkaW9SZXBlYXQgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgaWYgKCFXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy8gd2h5IGRvIHdlIGNoZWNrPyBiZWNhdXNlIGV4YW1tb2RlIGlzIGxlZnQgaWYgdGhlIHNlcnZlciBjb25uZWN0aW9uIGdldHMgbG9zdCBidXQgc3R1ZGVudHMgY291bGQgcmVjb25uZWN0IHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBzdGlsbCBvcGVuIGFuZCB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIHNlY29uZCBvbmVcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IGNyZWF0aW5nIGV4YW0gd2luZG93XCIpXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW10eXBlID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW3NlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uXS5leGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBtYW1tb3RoIGZyb20gJ21hbW1vdGgnO1xuXG5pbXBvcnQgbGFuZ3VhZ2VUb29sU2VydmVyIGZyb20gJy4vbHQtc2VydmVyJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgdXBkYXRlU3lzdGVtVHJheSB9IGZyb20gJy4vdHJheW1lbnUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTmV0d29ya09yUmVzZXQgfSBmcm9tICcuL3Rlc3RwZXJtaXNzaW9uc01hYy5qcyc7XG5pbXBvcnQgeyBnZXRXbGFuSW5mbyB9IGZyb20gJy4vZ2V0d2xhbmluZm8uanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25zdCBjaGVja1BvcnRPcGVuID0gKHBvcnQsIGhvc3QgPSAnMTI3LjAuMC4xJywgdGltZW91dCA9IDE1MDApID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgY29uc3QgZmluaXNoID0gKHJ1bm5pbmcsIGVycm9yID0gbnVsbCkgPT4ge1xuICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHJlc29sdmUoeyBydW5uaW5nLCBwb3J0LCBob3N0LCBlcnJvciB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0LnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNvY2tldC5vbmNlKCdjb25uZWN0JywgKCkgPT4gZmluaXNoKHRydWUpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ3RpbWVvdXQnLCAoKSA9PiBmaW5pc2goZmFsc2UsICd0aW1lb3V0JykpO1xuICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoZXJyKSA9PiBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb2NrZXQuY29ubmVjdChwb3J0LCBob3N0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBmaW5pc2goZmFsc2UsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuIC8vIElQQyBoYW5kbGluZyAoQmFja2VuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNsYXNzIElwY0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSBudWxsXG4gICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlIC8vIGZsYWcgdG8gcHJldmVudCBjbG9zaW5nIHdpbmRvdyB3aGlsZSBwcmludGluZ1xuICAgIH1cbiAgICBpbml0IChtYywgY29uZmlnLCB3aCwgY2gpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIgPSB3aCAgXG4gICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIgPSBjaFxuICAgICAgICBcblxuICAgICAgICBpcGNNYWluLm9uKCdzZXQtbmV3LWxvY2FsZScsIChldmVudCwgbG9jYWxlKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNldC1uZXctbG9jYWxlOiBzZXR0aW5nIG5ldyBsb2NhbGUgdG8gJHtsb2NhbGV9YClcbiAgICAgICAgICAgIGkxOG4ubG9jYWxlID0gbG9jYWxlXG4gICAgICAgICAgICB1cGRhdGVTeXN0ZW1UcmF5KGkxOG4ubG9jYWxlKTtcbiAgICAgICAgfSlcblxuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRFeGFtTWF0ZXJpYWxzJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgXG4gICAgICAgICAgICBsZXQgY2xpZW50aW5mbyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm9cbiAgICAgICAgICAgIGxldCBzZXJ2ZXJuYW1lID0gY2xpZW50aW5mby5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBsZXQgc2VydmVyaXAgPSBjbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBjbGllbnRpbmZvLnRva2VuXG4gICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7IFxuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZXhhbU1hdGVyaWFscyA9IGZhbHNlXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgLy8gRmV0Y2gtUmVxdWVzdCBtaXQgZGVuIGVudHNwcmVjaGVuZGVuIE9wdGlvbmVuXG4gICAgICAgICAgICAgICAgZXhhbU1hdGVyaWFscyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvZ2V0ZXhhbW1hdGVyaWFscy8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIC8vIEFudHdvcnQgYWxzIEFycmF5QnVmZmVyIGVyaGFsdGVuXG4gICAgICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6IHJlY2VpdmVkIGRhdGFcIiwgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0RXhhbU1hdGVyaWFsczogJHtlcnJ9YCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBleGFtTWF0ZXJpYWxzXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICBcbiAgICAgICAgfSkgXG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlc3luZGljYXRpb24uY29tXCIpKSByZXR1cm4gdHJ1ZTsgXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVudGZlcm5lIGFsdGUgTGlzdGVuZXIsIHVtIERvcHBlbC1SZWdpc3RyaWVydW5nZW4genUgdmVybWVpZGVuXG4gICAgICAgICAgICBndWVzdC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3dpbGwtbmF2aWdhdGUnKTtcbiAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ID0gYWxsb3dlZFVybHMubWFwKHMgPT4gU3RyaW5nKHMpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY2hlY2sgaWYgVVJMIG1hdGNoZXMgYWxsb3dlZCBkb21haW4gKHN1cHBvcnRzIHN1YmRvbWFpbnMgYW5kIHBhdGhzKVxuICAgICAgICAgICAgY29uc3QgaXNVcmxBbGxvd2VkID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsU3RyID0gU3RyaW5nKHRhcmdldFVybCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBjb21tb24gZXhjZXB0aW9ucyBmaXJzdFxuICAgICAgICAgICAgICAgIGlmIChjaGVja0NvbW1vbkV4Y2VwdGlvbnModXJsU3RyKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZWFjaCBhbGxvd2VkIFVSTFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWxsb3dlZFVybCBvZiBhbGxvdykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHBhcnNlIGFzIFVSTCB0byBleHRyYWN0IGhvc3RuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHRhcmdldFVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRIb3N0bmFtZSA9IHVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBhbGxvd2VkIFVSTCB0byBleHRyYWN0IGRvbWFpblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGFsbG93ZWRVcmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRVcmxPYmogPSBuZXcgVVJMKGFsbG93ZWRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWREb21haW4gPSBhbGxvd2VkVXJsT2JqLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbG93ZWRVcmwuaW5jbHVkZXMoJy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3MgYSBwYXRoIHdpdGhvdXQgcHJvdG9jb2wsIGV4dHJhY3QgZG9tYWluIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGFsbG93ZWRVcmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkRG9tYWluID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhhY3QgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSA9PT0gYWxsb3dlZERvbWFpbikgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGFsbG93ZWREb21haW4gaXMgYSBzcGVjaWZpYyBzdWJkb21haW4gKGNvbnRhaW5zIGRvdHMpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NwZWNpZmljU3ViZG9tYWluID0gYWxsb3dlZERvbWFpbi5pbmNsdWRlcygnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGVjaWZpY1N1YmRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgc3BlY2lmaWMgc3ViZG9tYWluIGlzIHNwZWNpZmllZCwgb25seSBhbGxvdyB0aGF0IGV4YWN0IHN1YmRvbWFpbiBhbmQgd3d3LiB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBhbGxvdyBvdGhlciBzdWJkb21haW5zIHdoZW4gYSBzcGVjaWZpYyBvbmUgaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIG9ubHkgYmFzZSBkb21haW4gaXMgc3BlY2lmaWVkIChlLmcuLCBcIm9yZi5hdFwiKSwgYWxsb3cgYWxsIHN1YmRvbWFpbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyB3d3cuIHN1YmRvbWFpbiBleHBsaWNpdGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEhvc3RuYW1lID09PSAnd3d3LicgKyBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBvdGhlciBzdWJkb21haW5zIChlLmcuLCBzdWIuZHVkZW4uZGUgaWYgZHVkZW4uZGUgaXMgYWxsb3dlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0SG9zdG5hbWUuZW5kc1dpdGgoJy4nICsgYWxsb3dlZERvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gdGFyZ2V0SG9zdG5hbWUuc2xpY2UoMCwgLShhbGxvd2VkRG9tYWluLmxlbmd0aCArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgcHJlZml4OiBtdXN0IGJlIHZhbGlkIHN1YmRvbWFpbiBuYW1lIChhbHBoYW51bWVyaWMgYW5kIGh5cGhlbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgVVJMIHBhcnNpbmcgZmFpbHMsIGZhbGwgYmFjayB0byBzaW1wbGUgaW5jbHVkZXMgY2hlY2sgZm9yIHBhdGhzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsU3RyLmluY2x1ZGVzKGFsbG93ZWRVcmwpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBndWVzdC5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmIChpc0FsbG93ZWQpIHsgXG4gICAgICAgICAgICAgICAgICAgIGd1ZXN0LmxvYWRVUkwodXJsKTsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBhbGxvd2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsKSBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGd1ZXN0Lm9uKCd3aWxsLW5hdmlnYXRlJywgKGUsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQWxsb3dlZCA9IGlzVXJsQWxsb3dlZCh1cmwpO1xuICAgICAgICAgICAgICAgIGlmICghaXNBbGxvd2VkKSB7IFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvXCIsIHVybCkgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFVuaWZpZWQgSVBDIGhhbmRsZXIgZm9yIHdlYnZpZXcgYmxvY2tpbmcgLSBzdXBwb3J0cyB3ZWJzaXRlLCBlZHV2aWR1YWwsIGZvcm1zLCByZHAgbW9kZXNcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZSwgYWxsb3dlZERvbWFpbiwgYmFzZVVybCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIHRvIHByZXZlbnQgZHVwbGljYXRlIHJlZ2lzdHJhdGlvbnNcbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVUkwgdmFsaWRhdGlvbiBmdW5jdGlvbiAtIGRpZmZlcmVudCBsb2dpYyBiYXNlZCBvbiBtb2RlXG4gICAgICAgICAgICBjb25zdCBpc1VybEFsbG93ZWQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdFQlNJVEUgbW9kZTogY2hlY2sgZG9tYWluIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsIHx8IHRhcmdldFVybC5pbmNsdWRlcyhiYXNlVXJsKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZG9tYWluID0gdXJsT2JqLmhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluID09PSBhbGxvd2VkRG9tYWluKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4cGxpY2l0bHkgYWxsb3cgd3d3LiBzdWJkb21haW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb21haW4gPT09ICd3d3cuJyArIGFsbG93ZWREb21haW4pIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbi5lbmRzV2l0aCgnLicgKyBhbGxvd2VkRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGRvbWFpbi5zbGljZSgwLCAtKGFsbG93ZWREb21haW4ubGVuZ3RoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggJiYgIXByZWZpeC5pbmNsdWRlcygnLicpICYmIC9eW2EtekEtWjAtOV0oW2EtekEtWjAtOS1dKlthLXpBLVowLTldKT8kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVEVVZJRFVBTC9NT09ETEUgbW9kZTogY2hlY2sgbW9vZGxlVGVzdElkXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vb2RsZS1zcGVjaWZpYyBleGNlcHRpb25zXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJzdGFydGF0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gbW9vZGxlZG9tYWluIG9obmUgdGVzdGlkXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInByb2Nlc3NhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIG1vb2RsZWRvbWFpbiBvaG5lIHRlc3RpZFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJlZHV2aWR1YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImF1dGhcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ0aXJvbC5ndi5hdFwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiZm9ybXNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBGT1JNUyBtb2RlOiBjaGVjayBnZm9ybXNUZXN0SWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gR29vZ2xlIEZvcm1zLXNwZWNpZmljIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImRvY3MuZ29vZ2xlLmNvbVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJmb3JtUmVzcG9uc2VcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJyZHBcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSRFAgbW9kZTogYWxsb3cgYWxsIChvciBpbXBsZW1lbnQgc3BlY2lmaWMgbG9naWMgaWYgbmVlZGVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29tbW9uIGV4Y2VwdGlvbiBVUkxzICh1c2VkIGJ5IGFsbCBtb2RlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hlY2tDb21tb25FeGNlcHRpb25zKHRhcmdldFVybCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0PVwiX2JsYW5rXCIgbGlua3MgYW5kIHdpbmRvdy5vcGVuIC0gYmxvY2sgQkVGT1JFIG5hdmlnYXRpb25cbiAgICAgICAgICAgIGd1ZXN0LnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVXJsQWxsb3dlZCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGFsbG93ZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBIYW5kbGUgd2lsbC1uYXZpZ2F0ZSBvbiB3ZWJDb250ZW50cyBsZXZlbCAtIHRoaXMgZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybEFsbG93ZWQodXJsKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBibG9ja2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIEJsb2NrIG5hdmlnYXRpb24gY29tcGxldGVseSAtIHRoaXMgaGFwcGVucyBCRUZPUkUgcGFnZSBsb2Fkc1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7IC8vIFN0b3AgYW55IGxvYWRpbmcgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIG5hdmlnYXRpb24gdG9gLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbGlhcyBmb3IgZWR1dmlkdWFsIG1vZGUgLSByZWRpcmVjdHMgdG8gdW5pZmllZCBoYW5kbGVyXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3ItZWR1dmlkdWFsLXdlYnZpZXcnLCAoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSkgPT4ge1xuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgdW5pZmllZCBoYW5kbGVyIHdpdGggZWR1dmlkdWFsIG1vZGVcbiAgICAgICAgICAgIGNvbnN0IHVuaWZpZWRIYW5kbGVyID0gaXBjTWFpbi5saXN0ZW5lcnMoJ3N0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcnKVswXTtcbiAgICAgICAgICAgIGlmICh1bmlmaWVkSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmlmaWVkSGFuZGxlcihldmVudCwgeyBndWVzdElkLCBtb2RlOiAnZWR1dmlkdWFsJywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWxvYWQgdGhlIGJyb3dzZXIgdmlld1xuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3JlbG9hZC1icm93c2VyLXZpZXcnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnJvd3NlclZpZXcgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsKTtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBsYW5ndWFnZVRvb2wgQVBJIFNlcnZlciAod2l0aCBKYXZhIEpSRSlcbiAgICAgICAgICogUnVucyBhdCBsb2NhbGhvc3QgODA4OFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pIFxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdGl2YXRlIHNwZWxsY2hlY2sgb24gZGVtYW5kIGZvciBzcGVjaWZpYyBzdHVkZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc3RhcnRMYW5ndWFnZVRvb2wnLCAoZXZlbnQpID0+IHsgIFxuICAgICAgICAgICAgdHJ5e1xuICAgICAgICAgICAgICAgIGxhbmd1YWdlVG9vbFNlcnZlci5zdGFydFNlcnZlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIExhbmd1YWdlVG9vbCBzZXJ2ZXIgcmVzcG9uZHMgb24gY29uZmlndXJlZCBwb3J0XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2lzTGFuZ3VhZ2VUb29sUnVubmluZycsIGFzeW5jICgpID0+IHsgXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gbGFuZ3VhZ2VUb29sU2VydmVyLnBvcnQgfHwgODA4ODtcbiAgICAgICAgICAgIGNvbnN0IGhvc3RzID0gWycxMjcuMC4wLjEnLCAnOjoxJywgJ2xvY2FsaG9zdCddO1xuICAgICAgICAgICAgLy8gUnVuIGFsbCBjaGVja3MgaW4gcGFyYWxsZWwgZm9yIGJldHRlciBwZXJmb3JtYW5jZSwgdXNlIGxvbmdlciB0aW1lb3V0IGZvciBzZXJ2ZXIgc3RhcnR1cCBkZXRlY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChob3N0cy5tYXAoaG9zdCA9PiBjaGVja1BvcnRPcGVuKHBvcnQsIGhvc3QsIDI1MDApKSk7XG4gICAgICAgICAgICAvLyBSZXR1cm4gZmlyc3Qgc3VjY2Vzc2Z1bCByZXN1bHQsIG9yIGxhc3QgcmVzdWx0IGlmIG5vbmUgc3VjY2VlZGVkXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzUmVzdWx0ID0gcmVzdWx0cy5maW5kKHJlc3VsdCA9PiByZXN1bHQucnVubmluZyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCB8fCByZXN1bHRzW3Jlc3VsdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBTdGFydCBMT0NBTCBMb2NrZG93blxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignbG9jYWxsb2NrZG93bicsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9jYWxsb2NrZG93bjogbG9ja2luZyBkb3duIGNsaWVudCB3aXRob3V0IHRlYWNoZXIgY29ubmVjdGlvblwiKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge1xuICAgICAgICAgICAgICAgIGV4YW1tb2RlOiB0cnVlLFxuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGVsZm9sZGVyb25leGl0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiAnZGUtREUnLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0VHlwZTogJycsXG4gICAgICAgICAgICAgICAgbW9vZGxlRG9tYWluOiAnJyxcbiBcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90aW50ZXJ2YWw6IDAsXG4gICAgICAgICAgICAgICAgbXNPZmZpY2VGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zbG9ja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwaW46ICcwMDAwJyxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVubG9ja29uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZm9udGZhbWlseTogJ3NhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgIG1vb2RsZVRlc3RJZDogJycsXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXJncy5wYXNzd29yZCxcbiAgICAgICAgIFxuICAgICAgICAgICAgICAgIHVzZUV4YW1TZWN0aW9uczogZmFsc2UsIC8vaWYgZmFsc2UgZXhhbSBzZWN0aW9uIDEgaXMgdXNlZCBhbmQgbm8gdGFicyBhcmUgZGlzcGxheWVkXG4gICAgICAgICAgICAgICAgYWN0aXZlU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBsb2NrZWRTZWN0aW9uOiAxLFxuICAgICAgICAgICAgICAgIGV4YW1TZWN0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAxOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGFtdHlwZTogYXJncy5leGFtbW9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNtYXJnaW46IHsgc2lkZTogJ3JpZ2h0Jywgc2l6ZTogMyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZXNwYWNpbmc6ICcyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvUmVwZWF0OiAzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2V0b29sOiBhcmdzLmxhbmd1YWdldG9vbCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2tsYW5nOiBhcmdzLnNwZWxsY2hlY2tsYW5nIHx8ICdkZS1ERScsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogYXJncy5zdWdnZXN0aW9ucyB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBhcmdzLmNsaWVudG5hbWU7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gXCIxMjcuMC4wLjFcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IFwibG9jYWxob3N0XCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IFwiMDAwMFwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9IFwiYVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duID0gdHJ1ZTsgLy8gdGhpcyBtdXN0IGJlIHNldCB0byB0cnVlIGluIG9yZGVyIHRvIHN0b3AgdHlwaWNhbCBuZXh0LWV4YW0gY2xpZW50L3RlYWNoZXIgYWN0aW9uc1xuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGxvY2FsbG9ja2Rvd25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFN0YXJ0IEJJUCBMb2dpbiBTZXF1ZW5jZVxuICAgICAgICAgKi9cblxuICAgICAgICBpcGNNYWluLm9uKCdsb2dpbkJpUCcsIChldmVudCwgYmlwdGVzdCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgbG9naW5CaVA6IG9wZW5pbmcgYmlwIHdpbmRvdy4gdGVzdGVudmlyb25tZW50OlwiLCBiaXB0ZXN0KVxuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUJpUExvZ2luV2luKGJpcHRlc3QpXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IFwiaGVsbG8gZnJvbSBiaXAgbG9nb25cIlxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHZpcnR1YWxpemVkIHN0YXR1c1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ZpcnR1YWxpemVkJywgKCkgPT4geyAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby52aXJ0dWFsaXplZCA9IHRydWU7IH0gKVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBGT0NVUyBzdGF0ZSB0byBmYWxzZSAobW91c2UgbGVmdCBleGFtIHdpbmRvdylcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZm9jdXNsb3N0JywgKGV2ZW50LCBjdHJsYWx0PWZhbHNlKSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFuc3dlciA9IGZhbHNlIFxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8ICF0aGlzLm11bHRpY2FzdENsaWVudC5leGFtbW9kZSkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWV9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MubGVuZ3RoID4gMCkgeyBcbiAgICAgICAgICAgICAgICBhbnN3ZXIgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgZm9jdXM6IHRydWUgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmZvY3VzVGFyZ2V0QWxsb3dlZCAmJiBjdHJsYWx0ID09IGZhbHNlKXsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBmb2N1c2xvc3Q6IG1vdXNlbGVhdmUgZXZlbnQgd2FzIHRyaWdnZXJlZCBidXQgdGFyZ2V0IGlzIGFsbG93ZWRgKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNob3coKTsgIFxuICAgICAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG4gICAgXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlOyAvLyBibG9jayBldmVyeXRoaW5nIGFuZCBpbmZvcm0gdGVhY2hlciAgKHByb2JhYmx5IGFuIG92ZXJraWxsIG9uIG1vdXNlbGVhdmUgLSBuZWVkcyB0ZXN0aW5nKVxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogZmFsc2UgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBhbnN3ZXJcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBtYWluIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdnZXRjb25maWcnLCAoZXZlbnQpID0+IHsgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuY29uZmlnICAgfSlcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIFVubG9jayBDb21wdXRlclxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignZ3JhY2VmdWxseWV4aXQnLCAoKSA9PiB7ICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ3JhY2VmdWxseWV4aXQ6IGdyYWNlZnVsbHkgbGVhdmluZyBsb2NrZWQgZXhhbSBtb2RlYClcblxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5ncmFjZWZ1bGx5RW5kRXhhbSgpIFxuICAgICAgICAgICAgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKSBcbiAgICAgICAgfSApXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogc3RvcCByZXN0cmljdGlvbnNcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RyaWN0aW9ucycsICgpID0+IHsgIFxuICAgICAgICAgICAgLy90aGlzIGFsc28gc3RvcHMgdGhlIGNsZWFyQ2xpcGJvYXJkIGludGVydmFsXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSBcbiAgICAgICAgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgKiBjb3B5IHRvIGdsb2JhbCBjbGlwYm9hcmRcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NsaXBib2FyZCcsIChldmVudCwgdGV4dCkgPT4geyAgXG4gICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgIH0gKVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmUtY2hlY2sgaG9zdGlwIGFuZCBlbmFibGUgbXVsdGljYXN0IGNsaWVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdjaGVja2hvc3RpcCcsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIGxldCBhZGRyZXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkgeyAgICBhZGRyZXNzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50LmFkZHJlc3MoKTsgICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAgIGxvZy5lcnJvcihcImlwY0hhbmRsZXIgQCBjaGVja2hvc3RpcDogbXVsdGljYXN0Y2xpZW50IG5vdCBydW5uaW5nXCIpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMgYmVyZWl0cyBlaW5lIEFkcmVzc2Ugdm9yaGFuZGVuIGlzdCwgbGllZmVybiB3aXIgc2llIHp1clx1MDBGQ2NrLlxuICAgICAgICAgICAgaWYgKGFkZHJlc3MpIHsgIHJldHVybiB0aGlzLmNvbmZpZy5ob3N0aXA7ICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcnN1Y2hlLCBhbiBkaWUga29ycmVrdGUgU2Nobml0dHN0ZWxsZSB6dSBiaW5kZW5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRmFsbHMgZ2F0ZXdheTRzeW5jKCkgYmxvY2tpZXJlbmQgaXN0LCBrYW5uc3QgZHUgZGllc2VuIEF1ZnJ1ZiBpbiBlaW4gUHJvbWlzZSBwYWNrZW46XG4gICAgICAgICAgICAgICAgY29uc3QgeyBnYXRld2F5LCBpbnRlcmZhY2U6IGlmYWNlIH0gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBnYXRld2F5NHN5bmMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlcnIpIHsgIHJlamVjdChlcnIpOyAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKGlmYWNlKTsgLy8gTGllZmVydCBkaWUgSVAgZGVyIFNjaG5pdHRzdGVsbGUsIHdlbGNoZSBkYXMgRGVmYXVsdCBHYXRld2F5IGhhdFxuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZhbGxzIGtlaW5lIElQIChtaXQgR2F0ZXdheSkgdmVyZlx1MDBGQ2diYXIgaXN0LCBob2xlIGVpbmUgYWx0ZXJuYXRpdmUgQWRyZXNzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5ob3N0aXApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBpcC5hZGRyZXNzKCk7IC8vIExpZWZlcnQgYXVjaCBlaW5lIElQLCB3ZW5uIGtlaW4gR2F0ZXdheSB2ZXJmXHUwMEZDZ2JhciBpc3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBVbmFibGUgdG8gZGV0ZXJtaW5lIGlwIGFkZHJlc3NcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5nYXRld2F5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWZXJmXHUwMEU0bHNjaHRlIEFkcmVzc2VuICh6LiBCLiBsb2NhbGhvc3QpIGlnbm9yaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgPT09IFwiMTI3LjAuMC4xXCIpIHsgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7ICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBXZW5uIGRpZSBNdWx0aWNhc3QtQ2xpZW50IG5pY2h0IGxcdTAwRTR1ZnQsIGluaXRpYWxpc2llcmVuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuaG9zdGlwICYmICFhZGRyZXNzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRmFsbHMgaW5pdCgpIGFzeW5jaHJvbiB1bWdlc2V0enQgd2VyZGVuIGthbm4sIHdhcnRlbiB3aXIgaGllciBkYXJhdWYuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubXVsdGljYXN0Q2xpZW50LmluaXQodGhpcy5jb25maWcuZ2F0ZXdheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikgeyAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBFcnJvciBpbml0aWFsaXppbmcgbXVsdGljYXN0IGNsaWVudFwiLCBlcnIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDtcbiAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgY29udGVudCBmcm9tIGVkaXRvciBhcyBodG1sIGZpbGUgLSBhcyBiYWNrdXAgLSBvbmx5IHRyaWdnZXJlZCBieSB0aGUgdGVhY2hlciBmb3Igbm93IChhbGxvdyBtYW51YWwgYmFja3VwICEhKVxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAge2NsaWVudG5hbWU6dGhpcy5jbGllbnRuYW1lLCBmaWxlbmFtZTpgJHtmaWxlbmFtZX0uaHRtbGAsIGVkaXRvcmNvbnRlbnQ6IGVkaXRvcmNvbnRlbnQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc3RvcmVIVE1MJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBodG1sQ29udGVudCA9IGFyZ3MuZWRpdG9yY29udGVudFxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lXG4gICAgICAgICAgICBsZXQgaHRtbGZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSl7XG4gICAgICAgICAgICAgICAgaHRtbGZpbGVuYW1lID0gYCR7ZmlsZW5hbWV9LmJha2BcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaHRtbGZpbGUgPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgaHRtbGZpbGVuYW1lKTtcblxuICAgICAgICAgICAgaWYgKGh0bWxDb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlcjogc3RvcmVIVE1MOiBzYXZpbmcgc3R1ZGVudHMgd29yayB0byBkaXNrLi4uXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGh0bWxmaWxlLCBodG1sQ29udGVudCwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6ICR7ZXJyLm1lc3NhZ2V9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFsdGVybmF0ZXBhdGggPSBgJHtodG1sZmlsZX0tJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufS5iYWtgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiB0cnlpbmcgdG8gd3JpdGUgZmlsZSBhczpcIiwgYWx0ZXJuYXRlcGF0aCApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGh0bWxDb250ZW50LCBmdW5jdGlvbiAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyciAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH0gKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGJhc2U2NCBlbmNvZGVkIHBkZiBmcm9tIGVkaXRvclxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRQREZiYXNlNjQnLCBhc3luYyAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGdldFBERmJhc2U2NDogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc3VibWlzc2lvbm51bWJlciA9IGFyZ3Muc3VibWlzc2lvbm51bWJlcisxIC8vIGNsaWVudGluZm8ga2VlcHMgdHJhY2sgb2Ygc3VibWlzc2lvbnMgZm9yIGF1dG9tYXRlZCBzdWJtaXNzaW9ubnVtYmVycyBhdCBzZWN0aW9uIGNoYW5nZSAtIGJ1dCB0aGlzIG9idmlvdXNseSBoYXBwZW5zIGFmdGVyIG1hbnVhbCBzdWJtaXRcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdldEJhc2U2NFBERihhcmdzLnN1Ym1pc3Npb25udW1iZXIsIGFyZ3Muc2VjdGlvbm5hbWUsIGFyZ3MucHJpbnRCYWNrZ3JvdW5kKSAgIC8vIHdoeSB0aGUgaGVsbCBpcyB0aGlzIGZ1bmN0aW9uIGxvY2F0ZWQgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgYW5kIG5vdCBpbiBpcGNoYW5kbGVyLmpzID8gRklYTUUgIVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgdGhlIEV4YW1XaW5kb3cgY29udGVudCBhcyBQREZcbiAgICAgICAgICogQVRURU5USU9OIHRoZXJlIGlzIGEgc2ltaWxhciBtZXRob2QgaW4gY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgdGhhdCBhbHNvIGdlbmVyYXRlcyBhIHBkZiBidXQgcmV0dW5zIGEgYmFzZTY0IHZlcnNpb24gb2YgdGhlIHBkZlxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3ByaW50cGRmJywgKGV2ZW50LCBhcmdzKSA9PiB7IFxuICAgICAgICAgICAgLy8gZG8gbm90IHByaW50IGlmIGV4YW0gbW9kZSBpcyBub3QgYWN0aXZlIGFueW1vcmVcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQ/LmNsaWVudGluZm8/LmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZXhhbW1vZGUgaXMgZmFsc2UgLSBza2lwcGluZyBwcmludFwiKVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogcHJpbnQgYWxyZWFkeSBpbiBwcm9ncmVzcyAtIHNraXBwaW5nIG5ldyByZXF1ZXN0XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgLy8gZGVmaW5lIHByaW50IG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luczoge3RvcDowLjUsIHJpZ2h0OjAsIGJvdHRvbTowLjUsIGxlZnQ6MCB9LFxuICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogJ0E0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcHJpbnRTZWxlY3Rpb25Pbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZHNjYXBlOiBhcmdzLmxhbmRzY2FwZSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlckZvb3Rlcjp0cnVlLFxuICAgICAgICAgICAgICAgICAgICBmb290ZXJUZW1wbGF0ZTogXCI8ZGl2IHN0eWxlPSdoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWJvdHRvbToxMHB4Oyc+PHNwYW4gY2xhc3M9cGFnZU51bWJlcj48L3NwYW4+fDxzcGFuIGNsYXNzPXRvdGFsUGFnZXM+PC9zcGFuPjwvZGl2PlwiLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHthcmdzLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBjbGFzcz1kYXRlIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpyaWdodDtcIj4ke2FyZ3MuY2xpZW50bmFtZX08L3NwYW4+PC9kaXY+YCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHBkZmZpbGVuYW1lID0gYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5wZGZgICAvLyBkZWZhdWx0IGZpbGVuYW1lID0gY2xpZW50bmFtZS5wZGZcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5maWxlbmFtZSl7ICAvLyBpbiBjYXNlIG9mIG1hbnVhbCBiYWNrdXAgdGhlIHVzZXIgY2FuIHNldCBhIGN1c3RvbSBmaWxlbmFtZVxuICAgICAgICAgICAgICAgICAgICBwZGZmaWxlbmFtZSA9IGAke2FyZ3MuZmlsZW5hbWV9LnBkZmBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZmZpbGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIHBkZmZpbGVuYW1lKTsgIC8vIHBhdGggcG9pbnRzIHRvIHRoZSBjdXJyZW50IGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tYXV4LnBkZmAgICAgLy90aG9tYXMucGRmLWF1eC5wZGYgXG4gICAgICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUgPSBgJHtwZGZmaWxlbmFtZX0tb2xkLnBkZmA7ICAgLy90aG9tYXMucGRmLW9sZC5wZGZcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVwYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGFsdGVybmF0ZWZpbGVuYW1lKTsgIC8vIGlmIHNvbWV0aGluZyBnb2VzIHdyb25nIHdlIHRyeSB0byB3cml0ZSBhIGRpZmZlcmVudCBmaWxlXG5cblxuICAgICAgICAgICAgICAgIC8vIGF1eCBmaWxlcyBhcmUgZmlsZXMgY3JlYXRlZCBpZiB0aGUgbWFpbiBwZGZmaWxlcGF0aCBpcyBub3Qgd3JpdGVhYmxlIChvcGVuZWQgb24gd2luZG93cykgXG4gICAgICAgICAgICAgICAgdHJ5IHsgIC8vIGFsd2F5cyBjaGVjayBmb3Igb2xkIGF1eCBmaWxlcyBhbmQgcmVuYW1lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlID09PSBhbHRlcm5hdGVmaWxlbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlYmFja3VwZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMoYWx0ZXJuYXRlcGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZXhhbVdpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93XG4gICAgICAgICAgICAgICAgY29uc3Qgd2ViQ29udGVudHMgPSBleGFtV2luZG93Py53ZWJDb250ZW50c1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3ZWJDb250ZW50cyl7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogbm8gd2ViQ29udGVudHMgZm91bmQgZm9yIGV4YW13aW5kb3dcIilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pc1ByaW50aW5nUGRmID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoZSB0aXRsZSBvZiB0aGUgZXhhbSB3aW5kb3cgYW5kIHRoZXJlZm9yZSB0aGUgZG9jdW1lbnQgdGl0bGUgZm9yIFBERiBtZXRhZGF0YVxuICAgICAgICAgICAgICAgIGNvbnN0IHBkZlRpdGxlID0gYXJncy5maWxlbmFtZSA/IGFyZ3MuZmlsZW5hbWUgOiBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9IC0gJHthcmdzLnNlcnZlcm5hbWUgfHwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lIHx8ICcnfWBcbiAgICAgICAgICAgICAgICAvLyBlc2NhcGUgcXVvdGVzIGFuZCBzcGVjaWFsIGNoYXJhY3RlcnMgZm9yIEphdmFTY3JpcHQgc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZFRpdGxlID0gcGRmVGl0bGUucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgd2ViQ29udGVudHMuZXhlY3V0ZUphdmFTY3JpcHQoYGRvY3VtZW50LnRpdGxlID0gXCIke2VzY2FwZWRUaXRsZX1cImApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcmludCB0aGUgZXhhbSB3aW5kb3cgdG8gcGRmXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3ZWJDb250ZW50cy5wcmludFRvUERGKG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgfSkudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgcGRmIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKHBkZmZpbGVwYXRoKSkgeyBmcy51bmxpbmtTeW5jKHBkZmZpbGVwYXRoKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfWApOyAgfVxuICAgICAgICAgICAgICAgICAgICAvLyB3cml0ZSB0aGUgcGRmIHRvIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUocGRmZmlsZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnIubWVzc2FnZX0gLSB3cml0aW5nIGZpbGUgYXM6ICR7YWx0ZXJuYXRlcGF0aH0gYCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgb2xkIGF1eCBmaWxlIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0ZXBhdGgpKSB7IGZzLnVubGlua1N5bmMoYWx0ZXJuYXRlcGF0aCk7IH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGYgKGFsdGVybmF0aXZlciBQZmFkKTogJHtlcnIubWVzc2FnZX1gKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGFsdGVybmF0ZSBwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlKGFsdGVybmF0ZXBhdGgsIGRhdGEsIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IGdpdmluZyB1cFwiKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7IC8vIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBzdWNjZXNzIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLnJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKSAgIC8vbWFrZSBzdXJlIHN0dWRlbnRzIHNlZSB0aGUgbmV3IGZpbGUgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZjogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVycm9yLm1lc3NhZ2UgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTYXZlcyBBY3RpdmUgU2hlZXRzIGZvcm0gZGF0YSB0byAuYmFrIGZpbGVcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3NhdmVBY3RpdmVzaGVldHNCYWsnLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFrRmlsZW5hbWUgPSBhcmdzLmZpbGVuYW1lID8gYCR7YXJncy5maWxlbmFtZX0uYmFrYCA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0uYmFrYDtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBiYWtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ29udmVydCBmb3JtRGF0YSB0byBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGpzb25EYXRhID0gSlNPTi5zdHJpbmdpZnkoYXJncy5mb3JtRGF0YSwgbnVsbCwgMik7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gLmJhayBmaWxlXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhiYWtGaWxlUGF0aCwganNvbkRhdGEsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiBzYXZlZCBmb3JtIGRhdGEgdG8gJHtiYWtGaWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgc2F2ZUFjdGl2ZXNoZWV0c0JhazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLCBzdGF0dXM6IFwiZXJyb3JcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgZm91bmQgU2VydmVycyBhbmQgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoaXMgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGluZm9hc3luYycsIGFzeW5jIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IGZhbHNlICAgXG4gICAgICAgICAgICAvLyBzZXJ2ZXJzdGF0dXMgb2JqZWt0IHdpcmQgbnVyIGJlaSBiZWdpbm4gZGVzIGV4YW1zIGFuIGRhcyBleGFtIHdpbmRvdyBkdXJjaGdlcmVpY2h0IGZcdTAwRkNyIGJhc2lzIGVpbnN0ZWxsdW5nZW5cbiAgICAgICAgICAgIC8vIGFsbGUgd2VpdGVyZW4gdXBkYXRlcyBcdTAwRkNiZXIgZGFzIHNlcnZlcnN0YXR1cyBvYmplY3Qgd2VyZGVuIGltIGNvbW11bmljYXRpb24gaGFuZGxlciBnZWxlc2VuIHVuZCBnZ2YuIGF1ZiBkYXMgY2xpZW50aW5mbyBvYmplY3QgZ2VsZWd0XG4gICAgICAgICAgICAvLyBkaWVzZXIga29tbXVuaWthdGlvbnNmbHVzcyBtdXNzIGluIDIuMCBnZXN0cmVhbWxpbmVkIHdlcmRlbiAjRklYTUVcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93LnNlcnZlcnN0YXR1cyB9XG5cbiAgICAgICAgICAgIC8vY291bnQgbnVtYmVyIG9mIGZpbGVzIGluIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHdvcmtkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pICAvLyBlcnN0ZWxsdCBmYWxscyBuXHUwMEY2dGlnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVsaXN0ID0gKGF3YWl0IGZzLnByb21pc2VzLnJlYWRkaXIod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm51bWJlck9mRmlsZXMgPSAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgcmV0dXJuIHsgICBcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsaXN0OiB0aGlzLm11bHRpY2FzdENsaWVudC5leGFtU2VydmVyTGlzdCxcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNlcnZlcnN0YXR1czogc2VydmVyc3RhdHVzXG4gICAgICAgICAgICB9ICAgXG4gICAgICAgIH0pXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYmVjYXVzZSBvZiBtaWNyb3NvZnQgMzY1IHdlIG5lZWQgdG8gd29yayB3aXRoIFwiQnJvd3NlclZpZXdcIiBcbiAgICAgICAgICogaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBkaXNsYXkgZnVsbHNjcmVlbiBpbmZvcm1hdGlvbiBmcm9tIHRoZSBFeGFtIGhlYWRlciB3ZSB0ZW1wb3JhcmlseSBjb2xsYXBzZSB0aGUgQnJvd3NlclZpZXcgZm9yIE9mZmljZVxuICAgICAgICAgKiBhbmQgcmVzdG9yZSBpdCBhZnRlcndhcmRzIC0gbm90IHBlcmZlY3QgYnV0IGxvb2tzIG9rXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY29sbGFwc2UtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTsgLy8gYXNzdW1pbmcgaXQncyB0aGUgMXN0IGFkZGVkIHZpZXdcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7IHg6IDAsIHk6IDAsIHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgICAgIGlwY01haW4ub24oJ3Jlc3RvcmUtYnJvd3NlcnZpZXcnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvd1xuICAgICAgICAgICAgaWYgKCFtYWluV2luZG93KXsgcmV0dXJuIH1cbiAgICAgICAgICAgIGNvbnN0IG1lbnVIZWlnaHQgPSBtYWluV2luZG93Lm1lbnVIZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpOyAvLyBHZXQgdGhlIGN1cnJlbnQgYm91bmRzIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5ldyBib3VuZHMgb2YgdGhlIGNvbnRlbnRWaWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogbWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLCAvLyBmdWxsIHdpZHRoIG9mIHRoZSBtYWluV2luZG93XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gbWVudUhlaWdodCAvLyByZW1haW5pbmcgaGVpZ2h0IGFmdGVyIHRoZSBtZW51XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZSBtZW51IGhlaWdodCBkeW5hbWljYWxseSB3aGVuIGhlYWRlciBjb250ZW50IGNoYW5nZXNcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3VwZGF0ZS1tZW51LWhlaWdodCcsIChldmVudCwgaGVpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3c7XG4gICAgICAgICAgICBpZiAobWFpbldpbmRvdyAmJiBoZWlnaHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBzdG9yZWQgbWVudSBoZWlnaHRcbiAgICAgICAgICAgICAgICBtYWluV2luZG93Lm1lbnVIZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gUmVwb3NpdGlvbiB0aGUgYnJvd3NlciB2aWV3IHdpdGggbmV3IGhlaWdodFxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0JvdW5kcyA9IG1haW5XaW5kb3cuZ2V0Qm91bmRzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZW50Vmlldykge1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBuZXdCb3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IG5ld0JvdW5kcy5oZWlnaHQgLSBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNlbmRzIGEgcmVnaXN0ZXIgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gc2VydmVyIGlwXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICBjbGllbnRuYW1lOnRoaXMudXNlcm5hbWUsIHNlcnZlcm5hbWU6c2VydmVybmFtZSwgc2VydmVyaXAsIHNlcnZlcmlwLCBwaW46dGhpcy5waW5jb2RlIFxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbigncmVnaXN0ZXInLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSBhcmdzLmNsaWVudG5hbWVcbiAgICAgICAgICAgIGNvbnN0IHBpbiA9IGFyZ3MucGluXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJpcCA9IGFyZ3Muc2VydmVyaXBcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcm5hbWUgPSBhcmdzLnNlcnZlcm5hbWVcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudGlwID0gaXAuYWRkcmVzcygpXG4gICAgICAgICAgICBjb25zdCBob3N0bmFtZSA9IG9zLmhvc3RuYW1lKClcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmNvbmZpZy52ZXJzaW9uXG4gICAgICAgICAgICBjb25zdCBiaXB1c2VySUQgPSBhcmdzLmJpcHVzZXJJRFxuXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7IC8vI0ZJWE1FIGRhcyBzb2xsdGUgZWlnZW50bGljaCB2b20gc2VydmVyIGtvbW1lbiBcbiAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiB0KFwiY29udHJvbC5hbHJlYWR5cmVnaXN0ZXJlZFwiKSwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3JlZ2lzdGVyY2xpZW50LyR7c2VydmVybmFtZX0vJHtwaW59LyR7Y2xpZW50bmFtZX0vJHtjbGllbnRpcH0vJHtob3N0bmFtZX0vJHt2ZXJzaW9ufS8ke2JpcHVzZXJJRH1gO1xuICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gQWJvcnRTaWduYWwudGltZW91dCg4MDAwKTsgLy8gODAwMCBNaWxsaXNla3VuZGVuID0gOCBTZWt1bmRlbiBBYm9ydFNpZ25hbCBtaXQgZWluZW0gVGltZW91dFxuXG5cbiAgICAgICAgICAgIGZldGNoKHVybCwgeyBtZXRob2Q6ICdHRVQnLCBzaWduYWwgfSlcbiAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSkgXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLnN0YXR1cyA9PSBcInN1Y2Nlc3NcIikgeyAgLy8gcmVnaXN0cmF0aW9uIHN1Y2Nlc3NmdWxsIG90aGVyd2lzZSBkYXRhIHdvdWxkIGJlIFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAvLyBFcmZvbGdyZWljaGUgUmVnaXN0cmllcnVuZ1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWUgPSBjbGllbnRuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gc2VydmVyaXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZSA9IHNlcnZlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBjbGllbnRpcDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gZGF0YS50b2tlbjsgLy8gd2UgbmVlZCB0byBzdG9yZSB0aGUgY2xpZW50IHRva2VuIGluIG9yZGVyIHRvIGNoZWNrIGFnYWluc3QgaXQgYmVmb3JlIHByb2Nlc3NpbmcgY3JpdGljYWwgYXBpIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnBpbiA9IHBpbjtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCByZWdpc3Rlcjogc3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgYXQgJHtzZXJ2ZXJuYW1lfSBAICR7c2VydmVyaXB9IGFzICR7Y2xpZW50bmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBkYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGV4YW0gZm9sZGVyIGluIHdvcmtmb2xkZXJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHVuaXF1ZWV4YW1OYW1lID0gYCR7c2VydmVybmFtZX0tJHtwaW59YFxuICAgICAgICAgICAgICAgICAgICBjb25maWcuZXhhbWRpcmVjdG9yeSA9IHBhdGguam9pbihjb25maWcud29ya2RpcmVjdG9yeSwgdW5pcXVlZXhhbU5hbWUpXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWcuZXhhbWRpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudmVyc2lvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21wYXJlIHZlcnNpb25zIGFuZCBkaXNwbGF5IG1lc3NhZ2UgKHRlYWNoZXIgbmVlZHMgdXBncmFkZS4uIGNsaWVudCBuZWVkcyB1cGdyYWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcGFyaXNvblJlc3VsdCA9IHRoaXMuY29tcGFyZVNvZnR3YXJlKGNvbmZpZy52ZXJzaW9uLCBjb25maWcuaW5mbyAsIGRhdGEudmVyc2lvbiwgZGF0YS52ZXJzaW9uaW5mbyApIC8vc2VydmVyVmVyc2lvbiwgc2VydmVyU3RhdHVzLCBsb2NhbFZlcnNpb24sIGxvY2FsU3RhdHVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHsgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCBuZXVlciBhbHMgZGllIGRlciBMZWhycGVyc29uIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7ICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiSWhyZSBWZXJzaW9uIHZvbiBOZXh0LUV4YW0gaXN0IHp1IGFsdC4gTGFkZW4gc2llIHNpY2ggZWluZSBha3R1ZWxsZSBWZXJzaW9uIGhlcnVudGVyIVwiIH07ICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW5iZWthbm50ZXIgRmVobGVyIGJlaW0gVmVyYmluZHVuZ3NhdWZiYXUuXCIgfTsgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChhc3luYyBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gRmVobGVyYmVoYW5kbHVuZ1xuICAgICAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHsgZXJyb3JNZXNzYWdlID0gXCJUaGUgcmVxdWVzdCB0aW1lZCBvdXRcIjsgICB9IC8vIFRpbWVvdXQtTmFjaHJpY2h0IGFucGFzc2VuIFxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHJlZ2lzdGVyOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBvbiBtYWNvcyB0aGUgcGVybWlzc2lvbiBzZXR0aW5ncyBpbiByYXJlIGNhc2VzIG1lc3MgdXAgdGhlIGFiaWxpdHkgdG8gZmV0Y2ggdGhlIHRlYWNoZXIgYXBpIFxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBuZXR3b3JrIHBlcm1pc3Npb25zIG9uIG1hY09TIGFuZCByZXNldCB0aGVtIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKXsgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGVuc3VyZU5ldHdvcmtPclJlc2V0KHNlcnZlcmlwLCB0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0KTsgXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZSA9PT0gXCJyZXNldFwiKSB7ICAgLy8gcXVpdCB0aGUgYXBwIGlmIHRoZSB1c2VyIHdhbnRzIHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnF1aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNob3cgd2FybmluZyBtZXNzYWdlIGlmIHRoZSB1c2VyIGRvZXMgbm90IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogXCJFcyBnaWJ0IGVpbiBQcm9ibGVtIG1pdCBkZW0gTmV0endlcmssIGRlbiBGaXJld2FsbHJlZ2VsbiBvZGVyIGRlbiBOZXR6d2Vya2JlcmVjaHRpZ3VuZ2VuISBCaXR0ZSBiZWhlYmVuIHNpZSBkaWVzZXMgUHJvYmxlbSB1bmQgc3RhcnRlbiBTaWUgTmV4dC1FeGFtIG5ldSFcIiwgc3RhdHVzOiBcImVycm9yXCIgfTtcbiAgICAgICAgICAgICAgICByZXR1cm47ICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcblxuXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIGNvbnRlbnQgZnJvbSBHZW9nZWJyYSBhcyBnZ2IgZmlsZSAtIGFzIGJhY2t1cCBcbiAgICAgICAgICogQHBhcmFtIGFyZ3MgY29udGFpbnMgYW4gb2JqZWN0IHdpdGggIHsgZmlsZW5hbWU6YCR7dGhpcy5jbGllbnRuYW1lfS5nZ2JgLCBjb250ZW50OiBiYXNlNjQgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3NhdmVHR0InLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhcmdzLmNvbnRlbnRcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gYXJncy5maWxlbmFtZVxuICAgICAgICAgICAgY29uc3QgcmVhc29uID0gYXJncy5yZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7IFxuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc2F2ZUdHQjogc2F2aW5nIHN0dWRlbnRzIHdvcmsgdG8gZGlzay4uLlwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVEYXRhID0gQnVmZmVyLmZyb20oY29udGVudCwgJ2Jhc2U2NCcpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhnZ2JGaWxlUGF0aCwgZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOnQoXCJkYXRhLmZpbGVzdG9yZWRcIikgLCBzdGF0dXM6XCJzdWNjZXNzXCIgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdmaWxlZXJyb3InLCBlcnIpICBcbiAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHNhdmVHR0I6ICR7ZXJyfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBsb2FkIGNvbnRlbnQgZnJvbSBnZ2IgZmlsZSBhbmQgc2VuZCBpdCB0byB0aGUgZnJvbnRlbmQgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnbG9hZEdHQicsIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGdnYkZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGZpbGVuYW1lKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhZCB0aGUgZmlsZSBhbmQgY29udmVydCBpdCB0byBiYXNlNjRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhnZ2JGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZTY0R2diRmlsZSA9IGZpbGVEYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6YmFzZTY0R2diRmlsZSwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICB9ICAgICBcbiAgICAgICAgfSlcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHRVQgUERGIG9yIElNQUdFIGZyb20gRVhBTSBkaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRwZGZhc3luYycsIChldmVudCwgZmlsZW5hbWUsIGltYWdlID0gZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgpXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbWFnZSl7IHJldHVybiBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTsgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIGNvbnRlbnQ6IGZhbHNlICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfSAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyBiYXNlNjQgc3RyaW5nIG9mIGF1ZGlvZmlsZSBmcm9tIHdvcmtkaXJlY3Rvcnkgb3IgcHVibGljIGRpcmVjdG9yeVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldEF1ZGlvRmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUsIHB1YmxpY2Rpcj1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpO1xuICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSAmJiAhcHVibGljZGlyKSB7IC8vIFJldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvclxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgcHVibGljZGlyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlO1xuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbihwdWJsaWNCYXNlLCBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXVkaW9EYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBU1lOQyBHRVQgRklMRS1MSVNUIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgaWYgc2V0IHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIGlzIHJldHVybmVkXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldGZpbGVzYXN5bmMnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBhdWRpbz1mYWxzZSwgZG9jeD1mYWxzZSkgPT4geyAgIFxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcblxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZSBhcyBzdHJpbmcgKGh0bWwpIHRvIHJlcGxhY2UgaW4gZWRpdG9yKVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUmVjZWl2ZWQgYXJndW1lbnRzOlwiLCBmaWxlbmFtZSwgYXVkaW8sIGRvY3gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG5cbiAgICAgICAgICAgICAgICBpZiAoYXVkaW8gPT0gdHJ1ZSl7IC8vIGF1ZGlvIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXVkaW9EYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRvY3gpeyAgLy9vZmZpY2Ugb3BlbiB4bWwgZmlsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgbWFtbW90aC5jb252ZXJ0VG9IdG1sKHtwYXRoOiBmaWxlcGF0aH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHsgICAvL2JhayBmaWxlXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgLy8gcmV0dXJuIGZpbGUgbGlzdCBvZiBleGFtIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrZGlyKSl7IGZzLm1rZGlyU3luYyh3b3JrZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgIH0gLy9kbyBub3QgY3Jhc2ggaWYgdGhlIGRpcmVjdG9yeSBpcyBkZWxldGVkIGFmdGVyIHRoZSBhcHAgaXMgc3RhcnRlZCBeXlxuICAgICAgICAgICAgICAgICAgICBsZXQgZmlsZWxpc3QgPSAgZnMucmVhZGRpclN5bmMod29ya2RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVzID0gW11cbiAgICAgICAgICAgICAgICAgICAgZmlsZWxpc3QuZm9yRWFjaCggZmlsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbW9kaWZpZWQgPSBmcy5zdGF0U3luYyggICBwYXRoLmpvaW4od29ya2RpcixmaWxlKSAgKS5tdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZCA9IG1vZGlmaWVkLmdldFRpbWUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucGRmXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJwZGZcIiwgbW9kOiBtb2R9KSAgIH0gICAgICAgICAvL3BkZlxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5iYWtcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImJha1wiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgYmFja3VwIGZpbGUgdG8gcmVwbGFjZSBlZGl0b3IgY29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5kb2N4XCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJkb2N4XCIsIG1vZDogbW9kfSkgICB9ICAgLy8gZWRpdG9yfCBjb250ZW50IGZpbGUgKGZyb20gdGVhY2hlcikgdG8gcmVwbGFjZSBjb250ZW50IGFuZCBjb250aW51ZSB3cml0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdnYlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZ2diXCIsIG1vZDogbW9kfSkgICB9ICAvLyBnZW9nZWJyYVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5tcDNcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIub2dnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLndhdlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImF1ZGlvXCIsIG1vZDogbW9kfSkgICB9ICAvLyBhdWRpb1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5qcGdcIiB8fCBwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIucG5nXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLmdpZlwiICl7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImltYWdlXCIsIG1vZDogbW9kfSkgICB9ICAvLyBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWxlc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRmaWxlc2FzeW5jOiAke2Vycn1gKTsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEJBQ0tVUCBGSUxFIGZyb20gZXhhbWRpcmVjdG9yeVxuICAgICAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZmlsZW5hbWUgd2l0aG91dFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRiYWNrdXBmaWxlJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSkgPT4geyAgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBSZXF1ZXN0IHJlY2VpdmVkIGZvciBmaWxlbmFtZTogJHtmaWxlbmFtZX1gKVxuICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSxcIi9cIilcbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpcixmaWxlbmFtZSlcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEZ1bGwgZmlsZSBwYXRoOiAke2ZpbGVwYXRofWApXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVwYXRoKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IGJhY2t1cCBmaWxlIG5vdCBmb3VuZDogJHtmaWxlcGF0aH1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBleGlzdHMsIHJlYWRpbmcgY29udGVudGApXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoLCAndXRmOCcpXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogU3VjY2Vzc2Z1bGx5IHJlYWQgYmFja3VwIGZpbGUsIGNvbnRlbnQgbGVuZ3RoOiAke2RhdGEubGVuZ3RofWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3IgcmVhZGluZyBiYWNrdXAgZmlsZTogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBFcnJvciBzdGFjazogJHtlcnIuc3RhY2t9YClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBubyBmaWxlbmFtZSBwcm92aWRlZGApOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaXBjTWFpbi5vbigncmVsb2FkLXVybCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmNyZWF0ZUVhc3RlcldpbigpXG4gICAgICAgIH0pO1xuXG4gICAgICAgICAvKipcbiAgICAgICAgICogQXBwZW5kIFByaW50UmVxdWVzdCB0byBjbGllbnRpbmZvICBcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdzZW5kUHJpbnRSZXF1ZXN0JywgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaW50cmVxdWVzdCA9IHRydWUgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gdHJ1ZVxuICAgICAgICB9KVxuICAgICBcbiAgICAgICAgaXBjTWFpbi5vbignZ2V0LWNwdS1pbmZvJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRoaXMuaXNWaXJ0dWFsTWFjaGluZSgpXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdsYW4taW5mbycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2xhbkluZm8gPSBhd2FpdCBnZXRXbGFuSW5mbygpO1xuICAgICAgICAgICAgcmV0dXJuIHdsYW5JbmZvO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFxuICAgICAgICAvLyBOZXcgaGFuZGxlciB0byBnZXQgUERGIGZyb20gcHVibGljIGRpcmVjdG9yeSBmb3IgZnJvbnRlbmQgcGFyc2luZ1xuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0UGRmRnJvbVB1YmxpYycsIGFzeW5jIChldmVudCwgcGRmRmlsZW5hbWUgKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEdldCBkaXJlY3RvcnkgbmFtZSBpbiBFU01cbiAgICAgICAgICAgICAgICBjb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxldCBwZGZQYXRoO1xuICAgICAgICAgICAgICAgIHBkZlBhdGggPSBwYXRoLmpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsIHBkZkZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocGRmUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBQREYgbm90IGZvdW5kIGF0OiAke3BkZlBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGRmUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldFBkZkZyb21QdWJsaWM6IEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG4gICAgaXNWaXJ0dWFsTWFjaGluZSgpIHtcbiAgICAgICAgY29uc3QgVkVORE9SUyA9IC8ob3JhY2xlfHZpcnR1YWxib3h8dm13YXJlfGt2bXxxZW11fHhlbnxpbm5vdGVrfHBhcmFsbGVsc3xtaWNyb3NvZnR8aHlwZXItdnxiaHl2ZXxyZWQgaGF0fHJlZGhhdHxib2Noc3xiaHl2ZXxvcGVuc3RhY2t8Y2xvdWR8YW1hem9ufGdvb2dsZXxhenVyZSkvaSAvLyBjb21tb24gVk0gaWRzXG4gICAgICAgIGNvbnN0IHdhcm5BbmRSZXR1cm4gPSByZWFzb24gPT4ge1xuICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBpc1ZpcnR1YWxNYWNoaW5lOiBWZXJkYWNodCBhdWYgVk0gLSAke3JlYXNvbn1gKVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gTGludXggLS0tLS0tLS0tLVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjcHVpbmZvID0gcmVhZEZpbGVTeW5jKCcvcHJvYy9jcHVpbmZvJywgJ3V0ZjgnKSAgICAgIC8vIENQVSBmbGFnc1xuICAgICAgICAgICAgaWYgKC9eZmxhZ3MuKlxcYmh5cGVydmlzb3JcXGIvbS50ZXN0KGNwdWluZm8pKSByZXR1cm4gd2FybkFuZFJldHVybignaHlwZXJ2aXNvciBmbGFnIGluIC9wcm9jL2NwdWluZm8nKVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IFtcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3N5c192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvcHJvZHVjdF9uYW1lJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfdmVyc2lvbicsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9ib2FyZF92ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYmlvc192ZW5kb3InLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvY2hhc3Npc192ZW5kb3InXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBjb25zdCBkbWkgPSBmaWxlcy5tYXAocCA9PiB7IHRyeSB7IHJldHVybiByZWFkRmlsZVN5bmMocCwgJ3V0ZjgnKSB9IGNhdGNoIHsgcmV0dXJuICcnIH0gfSkuam9pbignICcpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KGRtaSkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdETUktVmVuZG9yLU1hdGNoJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXhlY1N5bmMoJ3N5c3RlbWQtZGV0ZWN0LXZpcnQgLXEnLCB7IHN0ZGlvOiAnaWdub3JlJyB9KSAgICAvLyBleGl0IDAgPT4gVk1cbiAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdzeXN0ZW1kLWRldGVjdC12aXJ0IG1lbGRldCBWaXJ0dWFsaXNpZXJ1bmcnKVxuICAgICAgICAgIH0gY2F0Y2gge31cblxuXG4gICAgICAgICAgLy8gUHJcdTAwRkNmZSBhdWYgUUVNVS1Qcm96ZXNzZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9IGV4ZWNTeW5jKCdwcyBhdXggfCBncmVwIC1pIHFlbXUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChwcy5pbmNsdWRlcygncWVtdScpICYmICFwcy5pbmNsdWRlcygnZ3JlcCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgbFx1MDBFNHVmdCcpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLSBXaW5kb3dzIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcyA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIihHZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW0gfCBGb3JFYWNoLU9iamVjdCB7ICRfLk1hbnVmYWN0dXJlciwgJF8uTW9kZWwgfSkgLWpvaW4gXFwnIFxcJ1wiJ1xuICAgICAgICAgICAgY29uc3QgYmFzaWMgPSBleGVjU3luYyhwcywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKSAgICAvLyBtYW51ZmFjdHVyZXIgKyBtb2RlbFxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChiYXNpYykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvTW9kZWxsIHBhc3N0IHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBzUm9idXN0ID1cbiAgICAgICAgICAgICAgICAncG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJG89QCgpOycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGNzPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbTskbys9QCgkY3MuTWFudWZhY3R1cmVyLCRjcy5Nb2RlbCl9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRiYj1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQmFzZUJvYXJkOyRvKz1AKCRiYi5NYW51ZmFjdHVyZXIsJGJiLlByb2R1Y3QpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmlvcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQklPUzskbys9QCgkYmlvcy5TTUJJT1NCSU9TVmVyc2lvbil9Y2F0Y2h7fTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjc3A9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtUHJvZHVjdDskbys9QCgkY3NwLk5hbWUpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ1dyaXRlLU91dHB1dCAoKCRvIC1qb2luIFxcJyBcXCcpLlRyaW0oKSlcIidcbiAgICAgICAgICAgIGNvbnN0IHJvYnVzdCA9IGV4ZWNTeW5jKHBzUm9idXN0LCB7IGVuY29kaW5nOiAndXRmOCcgfSkudHJpbSgpXG4gICAgICAgICAgICBpZiAoVkVORE9SUy50ZXN0KHJvYnVzdCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdXaW5kb3dzIEhlcnN0ZWxsZXIvQklPUy1JbmZvcyBwYXNzZW4genUgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICAvLyBadXNcdTAwRTR0emxpY2hlIFFFTVUtRXJrZW5udW5nIGZcdTAwRkNyIFdpbmRvd3NcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcWVtdVByb2Nlc3NlcyA9IGV4ZWNTeW5jKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgcWVtdSpcIicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgICAgIGlmIChxZW11UHJvY2Vzc2VzLmluY2x1ZGVzKCdxZW11JykpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdRRU1VLVByb3plc3MgdW50ZXIgV2luZG93cycpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuXG4gICAgICAgICAvLyAtLS0tLS0tLS0tIG1hY09TIC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaHdNb2RlbCA9IGV4ZWNTeW5jKCdzeXNjdGwgLW4gaHcubW9kZWwnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmICgvXnZpcnR1YWwvaS50ZXN0KGh3TW9kZWwpIHx8IFZFTkRPUlMudGVzdChod01vZGVsKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ21hY09TIEhhcmR3YXJlbW9kZWxsIGRldXRldCBhdWYgVk0nKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3AgPSBleGVjU3luYygnc3lzdGVtX3Byb2ZpbGVyIFNQSGFyZHdhcmVEYXRhVHlwZScsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChzcCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBzeXN0ZW1fcHJvZmlsZXIgbWVsZGV0IFZNLVZlbmRvcicpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2UgICAgICAgXG4gICAgfVxuXG4gICAgY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQikge1xuICAgICAgICBjb25zdCBwYXJ0c0EgPSB2ZXJzaW9uQS5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgICAgICBjb25zdCBwYXJ0c0IgPSB2ZXJzaW9uQi5zcGxpdCgnLicpLm1hcChOdW1iZXIpO1xuICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWF4KHBhcnRzQS5sZW5ndGgsIHBhcnRzQi5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG51bUEgPSBwYXJ0c0FbaV0gfHwgMDsgLy8gRmFsbGJhY2sgYXVmIDAsIGZhbGxzIGtlaW4gV2VydCB2b3JoYW5kZW5cbiAgICAgICAgICAgIGNvbnN0IG51bUIgPSBwYXJ0c0JbaV0gfHwgMDtcbiAgICBcbiAgICAgICAgICAgIGlmIChudW1BIDwgbnVtQikgcmV0dXJuIC0xO1xuICAgICAgICAgICAgaWYgKG51bUEgPiBudW1CKSByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgXG4gICAgY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyQSA9IHBhcnNlSW50KHN0YXR1c0EubWF0Y2goL1xcZCsvKSwgMTApIHx8IDA7XG4gICAgICAgIGNvbnN0IG51bWJlckIgPSBwYXJzZUludChzdGF0dXNCLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgIFxuICAgICAgICBpZiAobnVtYmVyQSA8IG51bWJlckIpIHJldHVybiAtMTtcbiAgICAgICAgaWYgKG51bWJlckEgPiBudW1iZXJCKSByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgY29tcGFyZVNvZnR3YXJlKHZlcnNpb25BLCBzdGF0dXNBLCB2ZXJzaW9uQiwgc3RhdHVzQikge1xuICAgICAgICBjb25zdCB2ZXJzaW9uQ29tcGFyaXNvbiA9IHRoaXMuY29tcGFyZVZlcnNpb25zKHZlcnNpb25BLCB2ZXJzaW9uQik7XG4gICAgICAgIGlmICh2ZXJzaW9uQ29tcGFyaXNvbiAhPT0gMCkgcmV0dXJuIHZlcnNpb25Db21wYXJpc29uO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcy5jb21wYXJlUmVsZWFzZU51bWJlcnMoc3RhdHVzQSwgc3RhdHVzQik7XG4gICAgfVxuXG5cbn1cbiBcbmV4cG9ydCBkZWZhdWx0IG5ldyBJcGNIYW5kbGVyKClcbiIsICJpbXBvcnQge2NyZWF0ZUkxOG59IGZyb20gJ3Z1ZS1pMThuJ1xuXG5pbXBvcnQgZW4gZnJvbSAnLi9lbi5qc29uJ1xuaW1wb3J0IGRlIGZyb20gJy4vZGUuanNvbidcblxuY29uc3QgaTE4biA9IGNyZWF0ZUkxOG4oe1xuICAgIGxvY2FsZTogJ2RlJyxcbiAgICBmYWxsYmFja0xvY2FsZTogJ2VuJyxcbiAgICBtZXNzYWdlczoge1xuICAgICAgICBlbixcbiAgICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4biIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJSZXN0b3JlXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJEaXNjb25uZWN0XCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJFeGl0XCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiRXhhbXNcIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIlVzZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXIgYWRkcmVzc1wiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJFeGFtIE5hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImFkdmFuY2VkXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwic2ltcGxlXCIsXG4gICAgICAgIFwibmFtZVwiOiBcIk5hbWVcIixcbiAgICAgICAgXCJyZWdpc3RlclwiOiBcInJlZ2lzdGVyXCIsXG4gICAgICAgIFwicmVnaXN0ZXJpbmdcIjogXCJyZWdpc3RlcmluZy4uLlwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRcIjogXCJyZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiY29ubmVjdGVkXCI6IFwiY29ubmVjdGVkXCIsXG4gICAgICAgIFwiZGlzY29ubmVjdGVkXCI6IFwiZGlzY29ubmVjdGVkXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTdWNjZXNzZnVsbHkgcmVnaXN0ZXJlZCBvbiBzZXJ2ZXIhIFxcblxcblBsZWFzZSB3YWl0IGZvciB0aGUgYWN0aXZhdGlvbiBvZiB0aGUgZXhhbSBtb2RlIGJ5IHRoZSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJzZWFyY2ggc3RhcnRlZFwiLFxuICAgICAgICBcIm5vcHdcIjogXCJ3cm9uZyB1c2VybmFtZSBvciBwaW5cIixcbiAgICAgICAgXCJub3VzZXJcIjpcIm5vIHVzZXJuYW1lIGdpdmVuXCIsXG4gICAgICAgIFwibm9pcFwiOiBcIlNlcnZlcmFkZHJlc3NlIG9kZXIgRXhhbW5hbWUgbWlzc2luZ1wiLFxuICAgICAgICBcIm9mZmxpbmVcIjogXCJObyBOZXR3b3JrIENvbm5lY3Rpb25cIixcbiAgICAgICAgXCJub3BpblwiOiBcIm5vIHBpbmNvZGUgZ2l2ZW5cIixcbiAgICAgICAgXCJ1bnJlYWNoYWJsZVwiOlwiU2VydmVyIEFQSSB1bnJlYWNoYWJsZVwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBpcyBiZWhpbmQgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJObyBUZWFjaGVyIEFQSSBmb3VuZCBvbiB0aGUgZ2l2ZW4gYWRkcmVzc1wiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcImxvY2FsTG9ja2Rvd25cIjpcIkxvY2FsIGxvY2tkb3duXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51YWwgc2VhcmNoXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiTm8gZXhhbXMgZm91bmRcIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBsb2dvdXQ/XCIsXG4gICAgICAgIFwiZGVcIjogXCJHZXJtYW5cIixcbiAgICAgICAgXCJlblwiOlwiRW5nbGlzaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyZW5jaFwiLFxuICAgICAgICBcIml0XCI6XCJJdGFsaWFuXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3ZlbmlhblwiLFxuICAgICAgICBcIm5vbmVcIjogXCJub25lXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFjdGl2YXRlXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiU2hvdyBzdWdnZXN0aW9uc1wiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJQbGVhc2UgY2hvb3NlIGEgbGFuZ3VhZ2VcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiTGFuZ3VhZ2VzXCIsXG4gICAgICAgIFwibWF0aFwiOiBcIk1hdGhlbWF0aWNzXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJTZWxlY3QgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiUGxlYXNlIGluc3RhbGwgdGhlIHNhbWUgdmVyc2lvbiBhcyB0aGUgZXhhbSBzZXJ2ZXIhXCJcbiAgICB9LFxuICAgIFwiY29udHJvbFwiOiB7XG4gICAgICAgIFwidG9rZW5ub3R2YWxpZFwiOiBcInRva2VuIGlzIG5vdCB2YWxpZFwiLFxuICAgICAgICBcInRva2VudmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwic2FmZSBleGFtIHN0YXR1cyBjaGFuZ2VkXCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJzdHVkZW50IGFscmVhZHkgcmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJzdGFydGVkIHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcInN0b3BwZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJzYWZlIGV4YW0gbW9kZSBub3QgYWN0aXZlXCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJzdHVkZW50IHJlbW92ZWQgZnJvbSBzZXJ2ZXJcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgdmFsaWRcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJmaWxlcyByZWNlaXZlZFwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJmaWxlcyBzdG9yZWRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwibm8gZmlsZXMgd2VyZSB1cGxvYWRlZFwiLFxuICAgICAgICBcImZpbGVlcnJvclwiOiBcImZpbGUgZXJyb3JcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvXCI6IFwicGxlYXNlIGNoZWNrIGlmIHRoZSAnRVhBTS1TVFVERU5UJyBkaXJlY3RvcnkgaXMgd3JpdGVhYmxlIGFuZCBoYXMgZW5vdWdoIHNwYWNlXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJBIGxvY2FsIGJhY2t1cCBjb3VsZCBub3QgYmUgY3JlYXRlZC4gUGxlYXNlIHVzZSB0aGUgbWFudWFsIHN1Ym1pc3Npb24gb3B0aW9uLlwiLFxuICAgICAgICBcImRvbnRzaG93XCI6IFwiZG9uJ3Qgc2hvdyBhZ2FpblwiXG4gICAgfSxcbiAgICBcImVkaXRvclwiOiB7XG4gICAgICAgIFwiYmFja3VwZm91bmRcIjogXCJCYWNrdXAgZm91bmRcIixcbiAgICAgICAgXCJnZXRtYXRlcmlhbHNcIjogXCJHZXQgbWF0ZXJpYWxzXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIlNlbmQgZmluYWwgZXhhbVwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiRmluYWwgc3VibWl0XCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxzOlwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2NhbCBmaWxlczpcIixcbiAgICAgICAgXCJ1cGRhdGVcIjogXCJVcGRhdGVcIixcbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGxpdHZpZXdcIixcbiAgICAgICAgXCJsZWZ0a2lvc2tcIjogXCJZb3UgaGF2ZSBsZWZ0IHRoZSBzYWZlIGV4YW0gbW9kZSFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIlBsZWFzZSBpbmZvcm0gYSB0ZWFjaGVyIVwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MVwiOiBcIkRvIHlvdSB3YW50IHRvIHJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhlIGVkaXRvciB3aXRoIHRoZSBjb250ZW50IG9mIFwiLFxuICAgICAgICBcInJlcGxhY2Vjb250ZW50MlwiOiBcIj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkNhbmNlbFwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIlJlcGxhY2VcIixcbiAgICAgICAgXCJiYWNrdXBub3Rmb3VuZFwiOiBcIkJhY2t1cCBmaWxlIGNvdWxkIG5vdCBiZSByZWFkXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIHN1Y2Nlc3NmdWxseSBsb2FkZWRcIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkVycm9yIGxvYWRpbmcgYmFja3VwIGZpbGVcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwic3VjY2Vzc1wiOiBcIlN1Y2Nlc3NcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcImNoYXJzXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJ3b3Jkc1wiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcInJlY29ubmVjdFwiLFxuICAgICAgICBcInVubG9ja1wiOiBcInVubG9ja1wiLFxuICAgICAgICBcImV4aXRcIjogXCJFeGl0IHNhZmUgZXhhbSBtb2RlP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIkRvIG5vdCBsZWF2ZSBzYWZlIGV4YW0gbW9kZSB3aXRob3V0IHBlcm1pc3Npb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIklmIHRoaXMgcHJvY2VzcyBmYWlscyB1bmxvY2sgYW5kIHRyeSBhZ2FpbiFcIixcbiAgICAgICAgXCJzYXZlZFwiOiBcIkNyZWF0aW5nIGJhY2t1cFwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkNyZWF0aW5nIGJhY2t1cCBhbmQgY2xpcGJvYXJkIGNvcHlcIixcbiAgICAgICAgXCJsZWF2aW5nXCI6IFwiTGVhdmluZyBFeGFtIG1vZGVcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJiYWNrdXBcIixcbiAgICAgICAgXCJ1bmRvXCI6XCJ1bmRvXCIsXG4gICAgICAgIFwicmVkb1wiOlwicmVkb1wiLFxuICAgICAgICBcImNsZWFyXCI6XCJjbGVhclwiLFxuICAgICAgICBcImJvbGRcIjpcImJvbGRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcIml0YWxpY1wiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW5kZXJsaW5lXCIsXG4gICAgICAgIFwiaGVhZGluZzFcIjpcImhlYWRpbmcxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcImhlYWRpbmcyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcImhlYWRpbmczXCIsXG4gICAgICAgIFwiaGVhZGluZzRcIjpcImhlYWRpbmc0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcImhlYWRpbmc1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcImhlYWRpbmc2XCIsXG4gICAgICAgIFwic3Vic2NyaXB0XCI6XCJzdWJzY3JpcHRcIixcbiAgICAgICAgXCJzdXBlcnNjcmlwdFwiOlwic3VwZXJzY3JpcHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJidWxsZXRsaXN0XCIsXG4gICAgICAgIFwibGlzdFwiOlwibGlzdFwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiY29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiY29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcImJsb2NrcXVvdGVcIixcbiAgICAgICAgXCJsaW5lXCI6XCJwYWdlYnJlYWtcIixcbiAgICAgICAgXCJsZWZ0XCI6XCJsZWZ0XCIsXG4gICAgICAgIFwiY2VudGVyXCI6XCJjZW50ZXJcIixcbiAgICAgICAgXCJyaWdodFwiOlwicmlnaHRcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcInRleHRjb2xvclwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwibGluZWJyZWFrXCIsXG4gICAgICAgIFwibW9yZVwiOlwibW9yZVwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJpbnNlcnR0YWJsZVwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJkZWxldGV0YWJsZVwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJjb2x1bW5hZnRlclwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJyb3dhZnRlclwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiZGVsY29sdW1uXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJkZWxyb3dcIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIm1lcmdlb3JzcGxpdFwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiaGVhZGVyY29sdW1uXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJoZWFkZXJyb3dcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwic2VsZWN0ZWQgd29yZHMvY2hhcnNcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwicHJpbnQgcmVxdWVzdCBzZW50XCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwicHJpbnQgcmVxdWVzdCBkZW5pZWRcIixcbiAgICAgICAgXCJwYXN0ZVwiOlwicGFzdGVcIixcbiAgICAgICAgXCJjb3B5XCI6XCJjb3B5XCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcInNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcImRlYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIlJlbG9hZFwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb3VsZCB5b3UgbGlrZSB0byByZWluaXRpYWxpemUgdGhlIEVkaXRvcj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwia2VlcCBjb250ZW50XCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIkluc2VydCBzcGVjaWFsY2hhcmFjdGVyXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiUGxheSBBdWRpb1wiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIkRvIHlvdSB3YW50IHRvIHBsYXkgdGhlIGF1ZGlvZmlsZT9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiUmVtYWluaW5nIHBsYXliYWNrczpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIllvdSBkb24ndCBoYXZlIHRoZSBwZXJtaXNzaW9uIHRvIHBsYXkgdGhpcyBmaWxlIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiSW5zZXJ0IEltYWdlXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJJbnNlcnQgTXVnc2hvdFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIlNlbmQgd29yayB0byB0ZWFjaGVyXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiQ2xvc2VcIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJFeGl0IHNhZmUgZXhhbSBtb2RlXCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJGaWxlbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIlBsZWFzZSBlbnRlciBvbmx5IGxldHRlcnMgYW5kIG51bWJlcnMgd2l0aG91dCBzcGVjaWFsIGNoYXJhY3RlcnNcIixcbiAgICAgICAgXCJjbGVhclwiOiBcImNsZWFyIGNvbnRlbnQ/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkVycm9yXCIsXG4gICAgICAgIFwibm9wZGZcIjogXCJObyB2YWxpZCBQREYgRmlsZVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJXcm9uZyBwYXNzd29yZFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJSZWxvYWQgd2Vidmlld1wiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiUG9zc2libHkgc2Nhbm5lZCBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiT25cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcImxlc3MgdGhhbiAyIGludGVyYWN0aXZlIGZvcm0gZmllbGRzIHdlcmUgZm91bmQuXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2UyXCI6IFwiVGhpcyBpbmRpY2F0ZXMgdGhhdCB0aGlzIGlzIGEgc2Nhbm5lZCBQREYgdGhhdCBkb2VzIG5vdCBjb250YWluIGFjdGl2ZSBmb3JtIGZpZWxkcyBvciB0YWJsZXMuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlVuZGVyc3Rvb2RcIixcbiAgICAgICAgXCJwYWdlXCI6IFwiUGFnZVwiLFxuICAgICAgICBcInBhZ2VzXCI6IFwiUGFnZXNcIlxuICAgIH1cbn1cbiIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJXaWVkZXJoZXJzdGVsbGVuXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJWZXJiaW5kdW5nIHRyZW5uZW5cIixcbiAgICAgICAgICAgIFwiZXhpdFwiOiBcIkJlZW5kZW5cIlxuICAgICAgICB9XG4gICAgfSxcbiAgICBcInN0dWRlbnRcIiA6IHtcbiAgICAgICAgXCJwYXNzd29yZFwiOiBcIlBhc3N3b3J0XCIsXG4gICAgICAgIFwiZXhhbXNcIjogXCJQclx1MDBGQ2Z1bmdlblwiLFxuICAgICAgICBcInVzZXJuYW1lXCI6IFwiQmVudXR6ZXJuYW1lXCIsXG4gICAgICAgIFwicGluXCI6IFwiUGluY29kZVwiLFxuICAgICAgICBcImlwXCI6XCJTZXJ2ZXItQWRyZXNzZVwiLFxuICAgICAgICBcImV4YW1uYW1lXCI6XCJQclx1MDBGQ2Z1bmdzbmFtZVwiLFxuICAgICAgICBcImFkdmFuY2VkXCI6IFwiZm9ydGdlc2Nocml0dGVuXCIsXG4gICAgICAgIFwic2ltcGxlXCI6IFwiZWluZmFjaFwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJhbm1lbGRlblwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwibWVsZGUgYW4uLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwiYW5nZW1lbGRldFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcInZlcmJ1bmRlblwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcIlZlcmJpbmR1bmcgdW50ZXJicm9jaGVuXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZGluZm9cIjogXCJTaWUgaGFiZW4gc2ljaCBlcmZvbGdyZWljaCBhbSBTZXJ2ZXIgcmVnaXN0cmllcnQhIFxcblxcbkJpdHRlIHdhcnRlbiBTaWUgYXVmIGRpZSBBa3RpdmllcnVuZyBkZXMgUHJcdTAwRkNmdW5nc21vZHVzIGR1cmNoIGRpZSBMZWhycGVyc29uIVwiLFxuICAgICAgICBcInN0YXJ0ZWRcIjogXCJTdWNoZSBnZXN0YXJ0ZXRcIixcbiAgICAgICAgXCJub3B3XCI6IFwiRmFsc2NoZXIgQmVudXR6ZXJuYW1lIG9kZXIgUGluY29kZVwiLFxuICAgICAgICBcIm5vdXNlclwiOiBcIkJlbnV0emVybmFtZSBmZWhsdFwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZHJlc3NlIG9kZXIgUHJcdTAwRkNmdW5nc25hbWUgZmVobHRcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiS2VpbmUgTmV0endlcmt2ZXJiaW5kdW5nXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJQaW5jb2RlIGZlaGx0XCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjogXCJTZXJ2ZXIgQVBJIG5pY2h0IGVycmVpY2hiYXIuXCIsXG4gICAgICAgIFwidGltZW91dFwiOlwiVGltZW91dCEgRXhhbS1UZWFjaGVyIGJlZmluZGV0IHNpY2ggbVx1MDBGNmdsaWNoZXJ3ZWlzZSBoaW50ZXIgZWluZXIgRmlyZXdhbGwuXCIsXG4gICAgICAgIFwibm9hcGlcIjogXCJLZWluZSBQclx1MDBGQ2Z1bmdzc2VydmVyIGFuIGFuZ2VnZWJlbmVyIEFkcmVzc2VcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2thbCBhYnNwZXJyZW5cIixcbiAgICAgICAgXCJtYW51YWxzZWFyY2hcIjpcIk1hbnVlbGwgc3VjaGVuXCIsXG4gICAgICAgIFwibm9leGFtc1wiOlwiS2VpbmUgUHJcdTAwRkNmdW5nZW4gZ2VmdW5kZW5cIixcbiAgICAgICAgXCJsb2dvdXRCaVBcIjpcIlNpbmQgU2llIHNpY2hlciwgZGFzcyBTaWUgc2ljaCBhYm1lbGRlbiBtXHUwMEY2Y2h0ZW4/XCIsXG4gICAgICAgIFwiZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2NoXCIsXG4gICAgICAgIFwiZXNcIjpcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwiZnJcIjpcIkZyYW56XHUwMEY2c2lzY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGllbmlzY2hcIixcbiAgICAgICAgXCJzbFwiOlwiU2xvd2VuaXNjaFwiLFxuICAgICAgICBcIm5vbmVcIjogXCJhbmRlcmVcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrXCI6IFwiUmVjaHRzY2hyZWliaGlsZmVcIixcbiAgICAgICAgXCJhY3RpdmF0ZVwiOiBcImFrdGl2aWVyZW5cIixcbiAgICAgICAgXCJzdWdnZXN0XCI6XCJWb3JzY2hsXHUwMEU0Z2UgemVpZ2VuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2Nob29zZVwiOiBcIkJpdHRlIHdcdTAwRTRobGVuIFNpZSBlaW5lIFNwcmFjaGUgZlx1MDBGQ3IgZGllIFByXHUwMEZDZnVuZ1wiLFxuICAgICAgICBcImxhbmdcIjogXCJTcHJhY2hlblwiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGlrXCIsXG4gICAgICAgIFwic2VsZWN0ZXhhbW1vZGVcIjogXCJQclx1MDBGQ2Z1bmdzbW9kdXMgYXVzd1x1MDBFNGhsZW5cIixcbiAgICAgICAgXCJvdXRkYXRlZFwiOiBcIlZlcnNpb25cIixcbiAgICAgICAgXCJvdXRkYXRlZGluZm9cIjogXCJCaXR0ZSBpbnN0YWxsaWVyZW4gc2llIGRpZSBzZWxiZSBWZXJzaW9uIHdpZSBhbSBQclx1MDBGQ2Z1bmdzc2VydmVyIVwiXG4gICAgfSxcbiAgICBcImNvbnRyb2xcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJ0b2tlbnZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCBnXHUwMEZDbHRpZ1wiLFxuICAgICAgICBcInN0YXRlY2hhbmdlXCI6IFwiVmVydHJhdWVuc3N0ZWxsdW5nIGdlXHUwMEU0bmRlcnRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcIlNjaFx1MDBGQ2xlcjppbiB1bnRlciBkaWVzZW0gTmFtZW4gYmVyZWl0cyBhbmdlbWVsZGV0XCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwiZXhhbWV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgbmljaHQgYWt0aXZcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcIlNjaFx1MDBGQ2xlcjppbiBlbnRmZXJudFwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJkYXMgdG9rZW4gaXN0IHVuZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJmaWxlcmVjZWl2ZWRcIjogXCJEYXRlaWVuIGVyaGFsdGVuXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcIkRhdGVpZW4gZ2VzcGVpY2hlcnRcIixcbiAgICAgICAgXCJub2ZpbGVzXCI6IFwiRXMgd3VyZGVuIGtlaW5lIERhdGVpZW4gaG9jaGdlbGFkZW5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBTY2hyZWliZW4gZGVyIERhdGVpXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mb1wiOiBcIkJpdHRlIHN0ZWxsZW4gU2llIHNpY2hlciwgZGFzcyBkYXMgJ0VYQU0tU1RVREVOVCcgVmVyemVpY2huaXMgZlx1MDBGQ3IgTmV4dC1FeGFtIHNjaHJlaWJiYXIgaXN0IHVuZCBnZW5cdTAwRkNnZW5kIFNwZWljaGVycGxhdHogdm9yaGFuZGVuIGlzdC5cIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkVpbmUgbG9rYWxlIFNpY2hlcnVuZyBrb25udGUgbmljaHQgZXJzdGVsbHQgd2VyZGVuLiBOdXR6ZW4gU2llIGRpZSBtYW51ZWxsZSBBYmdhYmUgdW0gSWhyZSBBcmJlaXQgZGlyZWt0IGFuIGRpZSBMZWhycGVyc29uIHp1IHNlbmRlbi5cIixcbiAgICAgICAgXCJkb250c2hvd1wiOiBcIk5pY2h0IG1laHIgYW56ZWlnZW5cIlxuICAgIH0sXG4gICAgXCJlZGl0b3JcIjoge1xuICAgICAgICBcImJhY2t1cGZvdW5kXCI6IFwiQmFja3VwIGdlZnVuZGVuXCIsXG4gICAgICAgIFwiZ2V0bWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW4gaG9sZW5cIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiRmluYWxlIEFiZ2FiZSBhbiBMZWhycGVyc29uIHNlbmRlblwiLFxuICAgICAgICBcImZpbmFsc3VibWl0XCI6IFwiQWJnYWJlXCIsXG4gICAgICAgIFwibWF0ZXJpYWxzXCI6IFwiTWF0ZXJpYWxpZW46XCIsXG4gICAgICAgIFwidXBkYXRlXCI6IFwiQWt0dWFsaXNpZXJlblwiLFxuICAgICAgICBcImxvY2FsZmlsZXNcIjogXCJMb2thbGUgRGF0ZWllbjpcIixcblxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwYWx0ZW5hbnNpY2h0XCIsXG4gICAgICAgIFwibGVmdGtpb3NrXCI6IFwiU2llIGhhYmVuIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIHZlcmxhc3NlbiFcIixcbiAgICAgICAgXCJ0ZWxsc29tZW9uZVwiOiBcIk1lbGRlbiBTaWUgc2ljaCB1bWdlaGVuZCBiZWkgZGVyIEF1ZnNpY2h0c3BlcnNvbiFcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDFcIjogXCJXb2xsZW4gU2llIGRlbiBJbmhhbHQgZGVzIEVkaXRvcnMgZHVyY2ggZGVuIEluaGFsdCBkZXIgRGF0ZWlcIixcbiAgICAgICAgXCJyZXBsYWNlY29udGVudDJcIjogXCJlcnNldHplbj9cIixcbiAgICAgICAgXCJjYW5jZWxcIjpcIkFiYnJlY2hlblwiLFxuICAgICAgICBcInJlcGxhY2VcIjpcIkVyc2V0emVuXCIsXG4gICAgICAgIFwiYmFja3Vwbm90Zm91bmRcIjogXCJCYWNrdXAtRGF0ZWkga29ubnRlIG5pY2h0IGdlbGVzZW4gd2VyZGVuXCIsXG4gICAgICAgIFwiYmFja3VwbG9hZGVkXCI6IFwiQmFja3VwIGVyZm9sZ3JlaWNoIGdlbGFkZW5cIixcbiAgICAgICAgXCJiYWNrdXBlcnJvclwiOiBcIkZlaGxlciBiZWltIExhZGVuIGRlciBCYWNrdXAtRGF0ZWlcIixcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcInN1Y2Nlc3NcIjogXCJFcmZvbGdcIixcbiAgICAgICAgXCJjaGFyc1wiOiBcIlplaWNoZW5cIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIldcdTAwRjZydGVyXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwibmV1IHZlcmJpbmRlblwiLFxuICAgICAgICBcInVubG9ja1wiOiBcImVudHNwZXJyZW5cIixcbiAgICAgICAgXCJleGl0XCI6IFwiQWJnZXNpY2hlcnRlbiBNb2R1cyBiZWVuZGVuP1wiLFxuICAgICAgICBcImV4aXRraW9za1wiOiBcIlZlcmxhc3NlbiBTaWUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgbmllIG9obmUgRnJlaWdhYmUgZWluZXIgTGVocnBlcnNvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiU29sbHRlIGRlciBWb3JnYW5nIGZlaGxzY2hsYWdlbiBiZWVuZGVuIFNpZSBiaXR0ZSBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB1bmQgdmVyc3VjaGVuIFNpZSBlcyBlcm5ldXQhXCIsXG4gICAgICAgIFwic2F2ZWRcIjogXCJJaHJlIEFyYmVpdCB3dXJkZSBlcmZvbGdyZWljaCBnZXNpY2hlcnQhXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiRGllIGFrdHVlbGxlIEFyYmVpdCB3aXJkIGdlc2ljaGVydCB1bmQgaW4gZGllIFp3aXNjaGVuYWJsYWdlIGtvcGllcnQhXCIsXG4gICAgICAgIFwibGVhdmluZ1wiOiBcIkFiZ2VzaWNoZXJ0ZXIgTW9kdXMgYmVlbmRldFwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcInNpY2hlcm5cIixcbiAgICAgICAgXCJ1bmRvXCI6XCJyXHUwMEZDY2tnXHUwMEU0bmdpZ1wiLFxuICAgICAgICBcInJlZG9cIjpcIndpZWRlcmhvbGVuXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImJvbGRcIjpcImZldHRcIixcbiAgICAgICAgXCJpdGFsaWNcIjpcImt1cnNpdlwiLFxuICAgICAgICBcInVuZGVybGluZVwiOlwidW50ZXJzdHJpY2hlblwiLFxuICAgICAgICBcImhlYWRpbmcxXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiXHUwMERDYmVyc2NocmlmdCAyXCIsXG4gICAgICAgIFwiaGVhZGluZzNcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgM1wiLFxuICAgICAgICBcImhlYWRpbmc0XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiXHUwMERDYmVyc2NocmlmdCA1XCIsXG4gICAgICAgIFwiaGVhZGluZzZcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNlwiLFxuICAgICAgICBcInN1YnNjcmlwdFwiOlwidGllZmdlc3RlbGx0XCIsXG4gICAgICAgIFwic3VwZXJzY3JpcHRcIjpcImhvY2hnZXN0ZWxsdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcInVuZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwibGlzdFwiOlwiZ2VvcmRuZXRlIExpc3RlXCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJDb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJDb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiWml0YXRcIixcbiAgICAgICAgXCJsaW5lXCI6XCJTZWl0ZW51bWJydWNoXCIsXG4gICAgICAgIFwibGVmdFwiOlwiTGlua3NiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcImNlbnRlclwiOlwiWmVudHJpZXJ0XCIsXG4gICAgICAgIFwicmlnaHRcIjpcIlJlY2h0c2JcdTAwRkNuZGlnXCIsXG4gICAgICAgIFwidGV4dGNvbG9yXCI6XCJUZXh0ZmFyYmVcIixcbiAgICAgICAgXCJsaW5lYnJlYWtcIjpcIlplaWxlbnVtYnJ1Y2hcIixcbiAgICAgICAgXCJtb3JlXCI6XCJtZWhyXCIsXG4gICAgICAgIFwiaW5zZXJ0dGFibGVcIjpcIlRhYmVsbGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJUYWJlbGxlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJTcGFsdGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJSZWloZSBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiZGVsY29sdW1uXCI6XCJTcGFsdGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJSZWloZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIlZlcmVpbmVuIG9kZXIgVGVpbGVuXCIsXG4gICAgICAgIFwiaGVhZGVyY29sdW1uXCI6XCJUaXRlbHNwYWx0ZVwiLFxuICAgICAgICBcImhlYWRlcnJvd1wiOlwiVGl0ZWxyZWloZVwiLFxuICAgICAgICBcInNlbGVjdGVkXCI6XCJXXHUwMEY2cnRlci9aZWljaGVuIGluIEF1c3dhaGxcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwiRHJ1Y2thbmZyYWdlIGdlc2VuZGV0IVwiLFxuICAgICAgICBcInJlcXVlc3RkZW5pZWRcIjpcIkRydWNrYW5mcmFnZSBhYmdlbGVobnQuIEJpdHRlIHdhcnRlbiB1bmQgZXJuZXV0IHNlbmRlbi5cIixcbiAgICAgICAgXCJwYXN0ZVwiOlwiZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImNvcHlcIjpcImtvcGllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYnByXHUwMEZDZnVuZyBha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3BlbGxjaGVja2RlYWN0aXZhdGVcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgZGVha3RpdmllcmVuXCIsXG4gICAgICAgIFwicmVsb2FkXCI6IFwiTmV1IGxhZGVuXCIsXG4gICAgICAgIFwicmVsb2FkdGV4dFwiOiBcIldvbGxlbiBTaWUgZGVuIFRleHRlZGl0b3IgbmV1IGluaXRpYWxpc2llcmVuP1wiLFxuICAgICAgICBcInJlbG9hZGNvbnRlbnRcIjogXCJJbmhhbHQgYmVpYmVoYWx0ZW5cIixcbiAgICAgICAgXCJzcGVjaWFsY2hhclwiOlwiU29uZGVyemVpY2hlbiBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJkcnVja2VuXCIsXG4gICAgICAgIFwicGxheWF1ZGlvXCI6XCJBdWRpbyBhYnNwaWVsZW5cIixcbiAgICAgICAgXCJyZWFsbHlwbGF5XCI6XCJXb2xsZW4gU2llIGRhcyBIXHUwMEY2cmJlaXNwaWVsIGpldHp0IGFic3BpZWxlbj9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiVmVyYmxlaWJlbmRlIER1cmNobFx1MDBFNHVmZTpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIlNpZSBoYWJlbiBrZWluZSBCZXJlY2h0aWd1bmcgZGllIEF1ZGlvZGF0ZWkgZXJuZXV0IGFienVzcGllbGVuIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiQmlsZCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJNdWdzaG90IGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJzZW5kXCI6XCJBcmJlaXQgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJ6b29tSW5cIjpcIlpvb20gaW5cIixcbiAgICAgICAgXCJ6b29tT3V0XCI6XCJab29tIG91dFwiLFxuICAgICAgICBcImNsb3NlXCI6XCJTY2hsaWVcdTAwREZlblwiXG4gICAgfSxcbiAgICBcIm1hdGhcIjoge1xuICAgICAgICBcImV4aXRcIjpcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJmaWxlbmFtZVwiOiBcIkRhdGVpbmFtZVwiLFxuICAgICAgICBcIm5vc3BlY2lhbFwiOiBcIkJpdHRlIGdlYmVuIFNpZSBudXIgQnVjaHN0YWJlbiBvZGVyIFphaGxlbiBlaW4uXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJBbGxlIEJlcmVjaG51bmdlbiBsXHUwMEY2c2NoZW4/XCJcbiAgICB9LFxuICAgIFwiZ2VuZXJhbFwiOntcbiAgICAgICAgXCJlcnJvclwiOiBcIkZlaGxlclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiS2VpbmUgZ1x1MDBGQ2x0aWdlIFBERiBEYXRlaVwiLFxuICAgICAgICBcIndyb25ncGFzc3dvcmRcIjogXCJGYWxzY2hlcyBQYXNzd29ydFwiXG4gICAgfSxcbiAgICBcIndlYnNpdGVcIjoge1xuICAgICAgICBcInJlbG9hZHdlYnZpZXdcIjogXCJXZWJ2aWV3IG5ldSBsYWRlblwiXG4gICAgfSxcbiAgICBcInBkZlwiOiB7XG4gICAgICAgIFwid2FybmluZ1RpdGxlXCI6IFwiTVx1MDBGNmdsaWNoZXJ3ZWlzZSBnZXNjYW5udGVzIFBERlwiLFxuICAgICAgICBcIndhcm5pbmdQcmVmaXhcIjogXCJBdWZcIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZVwiOiBcInd1cmRlbiB3ZW5pZ2VyIGFscyAyIGludGVyYWt0aXZlIEZvcm11bGFyZmVsZGVyIGdlZnVuZGVuLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIkRpZXMgZGV1dGV0IGRhcmF1ZiBoaW4sIGRhc3MgZXMgc2ljaCB1bSBlaW4gZ2VzY2FubnRlcyBQREYgaGFuZGVsdCwgZGFzIGtlaW5lIGFrdGl2ZW4gRm9ybXVsYXJmZWxkZXIgb2RlciBUYWJlbGxlbiBlbnRoXHUwMEU0bHQuXCIsXG4gICAgICAgIFwidW5kZXJzdG9vZFwiOiBcIlZlcnN0YW5kZW5cIixcbiAgICAgICAgXCJwYWdlXCI6IFwiU2VpdGVcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlNlaXRlblwiXG4gICAgfVxufVxuIiwgImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IEpyZUhhbmRsZXIgZnJvbSAnLi9qcmUtaGFuZGxlci5qcyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5jb25zdCBwdWJsaWNCYXNlID0gKCkgPT4gcGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2U7XG5cbmxldCBsYW5ndWFnZVRvb2xKYXJQYXRoID0gcGF0aC5qb2luKHB1YmxpY0Jhc2UoKSwgJ0xhbmd1YWdlVG9vbC9sYW5ndWFnZXRvb2wtc2VydmVyLmphcicpO1xubGV0IGxhbmd1YWdlVG9vbENvbmZpZ1BhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL3NlcnZlci5wcm9wZXJ0aWVzJyk7XG5cblxuXG5cblxuY2xhc3MgTGFuZ3VhZ2VUb29sU2VydmVyIHtcbiAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBJbml0aWFsaXNpZXJ0IGRpZSBQcm96ZXNzdmFyaWFibGVcbiAgICAgICAgIHRoaXMucG9ydCA9IDgwODhcbiAgICAgfVxuIFxuICAgICBzdGFydFNlcnZlcigpIHtcbiAgICAgICAgIGlmICh0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgJiYgIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nLicpO1xuICAgICAgICAgICAgIHJldHVybjsgLy8gVmVyaGluZGVydCBkYXMgZXJuZXV0ZSBTdGFydGVuLCB3ZW5uIGRlciBTZXJ2ZXIgYmVyZWl0cyBsXHUwMEU0dWZ0XG4gICAgICAgICB9XG4gICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gSnJlSGFuZGxlci5qU3Bhd24oXG4gICAgICAgICAgICAgICAgW2xhbmd1YWdlVG9vbEphclBhdGhdLCAvLyBLbGFzc2VucGZhZFxuICAgICAgICAgICAgICAgICdvcmcubGFuZ3VhZ2V0b29sLnNlcnZlci5IVFRQU2VydmVyJywgLy8gSGF1cHRrbGFzc2UgZGVyIExhbmd1YWdlVG9vbCBBUElcbiAgICAgICAgICAgICAgICBbJy0tcG9ydCcsIHRoaXMucG9ydCwnLS1jb25maWcnLGxhbmd1YWdlVG9vbENvbmZpZ1BhdGgsICctLWFsbG93LW9yaWdpbicsIFwiJyonXCIgXSAvLyBadXNcdTAwRTR0emxpY2hlIEFyZ3VtZW50ZSwgei5CLiBQb3J0IHVuZCBDT1JTLUVybGF1Ym5pc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcylcbiAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIEFQSSBydW5uaW5nIGF0IGxvY2FsaG9zdDo4MDg4Jyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCBkYXRhID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhOiBSZWNlaXZlZCBkYXRhIGZyb20gTGFuZ3VhZ2VUb29sIEFQSScsIGRhdGEudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXJyb3InKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtZXJyb3I6Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdGFydGluZycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY2hlY2sgZG9uZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1pbmZvOicsIG91dHB1dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvdXRwdXQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFuZGxlZCByZXF1ZXN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIEFjY3VtdWxhdGUgc3RkZXJyIGRhdGEgdG8gaGFuZGxlIGNodW5rZWQgb3V0cHV0XG4gICAgICAgICAgICBsZXQgc3RkZXJyQnVmZmVyID0gJyc7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyICs9IGNodW5rO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcnRTdHIgPSBTdHJpbmcodGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBib3RoIGN1cnJlbnQgY2h1bmsgYW5kIGFjY3VtdWxhdGVkIGJ1ZmZlciBmb3IgcG9ydC1yZWxhdGVkIGVycm9yc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXNwb25zZSA9IHN0ZGVyckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcnRFcnJvciA9IGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhwb3J0U3RyKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRyZXNzZSB3aXJkIGJlcmVpdHMgdmVyd2VuZGV0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJNYXliZSBzb21ldGhpbmcgZWxzZSBpcyBydW5uaW5nIG9uIHRoYXQgcG9ydFwiKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVsbFJlc3BvbnNlLmluY2x1ZGVzKFwiQWRkcmVzcyBhbHJlYWR5IGluIHVzZVwiKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoaXNQb3J0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBhbm90aGVyIExhbmd1YWdlVG9vbCBzZXJ2ZXIgaXMgcHJvYmFibHkgYWxyZWFkeSBydW5uaW5nIG9uIHBvcnQ6JywgdGhpcy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgc3RkZXJyQnVmZmVyID0gJyc7IC8vIFJlc2V0IGJ1ZmZlciBhZnRlciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsuaW5jbHVkZXMoJ1xcbicpIHx8IGZ1bGxSZXNwb25zZS5sZW5ndGggPiAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTG9nIGVycm9yIGlmIHdlIGhhdmUgYSBuZXdsaW5lIChsaWtlbHkgY29tcGxldGUgbWVzc2FnZSkgb3IgYnVmZmVyIGlzIGdldHRpbmcgbGFyZ2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciBkYXRhLWVycm9yOicsIGZ1bGxSZXNwb25zZS50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGxvZ2dpbmdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsOyAvLyBTZXR6dCBkZW4gUHJvemVzcyB6dXJcdTAwRkNjaywgd2VubiBlciBiZWVuZGV0IHdpcmRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGdlbmVyYWwtZXJyb3I6JywgZXJyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgfVxuXG4gICAgIHN0b3BTZXJ2ZXIoKSB7XG4gICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkXG4gICAgICAgICBpZiAoIXRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcykge1xuICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHdhcyBuZXZlciBzdGFydGVkLCBub3RoaW5nIHRvIHN0b3AnKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZpcnN0IHRyeSB0byBraWxsIHRoZSBwcm9jZXNzIGRpcmVjdGx5IGlmIHdlIGhhdmUgYSByZWZlcmVuY2VcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mga2lsbGVkJyk7XG4gICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGZhaWxlZCB0byBraWxsIHByb2Nlc3MgZGlyZWN0bHksIHRyeWluZyBwbGF0Zm9ybS1zcGVjaWZpYyBtZXRob2Q6JywgZXJyKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgcGxhdGZvcm0tc3BlY2lmaWMgY29tbWFuZHMgdG8ga2lsbCB0aGUgcHJvY2VzcyAob25seSBpZiB3ZSBoYWQgYSBwcm9jZXNzIHJlZmVyZW5jZSlcbiAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgIGxldCBjb21tYW5kO1xuXG4gICAgICAgICBpZiAocGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAvLyBXaW5kb3dzOiBmaW5kIGFuZCBraWxsIGphdmEgcHJvY2Vzc2VzIHJ1bm5pbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgd21pYyAod29ya3Mgb24gb2xkZXIgV2luZG93cyksIHRoZW4gdHJ5IFBvd2VyU2hlbGwsIHRoZW4gZmFsbGJhY2sgdG8gcG9ydC1iYXNlZCBraWxsXG4gICAgICAgICAgICAgY29tbWFuZCA9IGB3bWljIHByb2Nlc3Mgd2hlcmUgXCJjb21tYW5kbGluZSBsaWtlICclbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXIlJ1wiIGRlbGV0ZSAyPm51bCB8fCBwb3dlcnNoZWxsIC1Db21tYW5kIFwiR2V0LVByb2Nlc3MgamF2YSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSB8IFdoZXJlLU9iamVjdCB7JF8uQ29tbWFuZExpbmUgLWxpa2UgJypsYW5ndWFnZXRvb2wtc2VydmVyLmphcionfSB8IFN0b3AtUHJvY2VzcyAtRm9yY2VcIiAyPm51bCB8fCBmb3IgL2YgXCJ0b2tlbnM9NVwiICVhIGluICgnbmV0c3RhdCAtYW5vIF58IGZpbmRzdHIgOjgwODgnKSBkbyB0YXNra2lsbCAvRiAvUElEICVhIDI+bnVsYDtcbiAgICAgICAgIH0gZWxzZSBpZiAocGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8IHBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICAgICAgICAgLy8gbWFjT1MgYW5kIExpbnV4OiB1c2UgcGtpbGwgdG8ga2lsbCBwcm9jZXNzZXMgbWF0Y2hpbmcgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXJcbiAgICAgICAgICAgICBjb21tYW5kID0gJ3BraWxsIC1mIGxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJztcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IHVuc3VwcG9ydGVkIHBsYXRmb3JtOicsIHBsYXRmb3JtKTtcbiAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG5cbiAgICAgICAgIGV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAvLyBJdCdzIG9rYXkgaWYgdGhlIHByb2Nlc3MgaXMgbm90IGZvdW5kIChhbHJlYWR5IGtpbGxlZClcbiAgICAgICAgICAgICAgICAgLy8gcGtpbGwgcmV0dXJucyBjb2RlIDEgd2hlbiBubyBwcm9jZXNzIGlzIGZvdW5kLCB3aGljaCBpcyBleHBlY3RlZFxuICAgICAgICAgICAgICAgICBpZiAoZXJyb3IuY29kZSAhPT0gMSAmJiAhZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnbm90IGZvdW5kJykgJiYgIXN0ZGVyci50b1N0cmluZygpLmluY2x1ZGVzKCdObyBzdWNoIHByb2Nlc3MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IGVycm9yIGtpbGxpbmcgTGFuZ3VhZ2VUb29sIHNlcnZlcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdG9wU2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIHByb2Nlc3Mgbm90IGZvdW5kIChtYXkgYWxyZWFkeSBiZSBzdG9wcGVkKScpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgc3RvcHBlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgIH0pO1xuICAgICB9XG4gfVxuXG5cblxuXG5cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTGFuZ3VhZ2VUb29sU2VydmVyKClcblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBwcm9jZXNzIGZyb20gJ3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG4gLy8gZXZlcnkgcGxhdGZvcm0gbmVlZHMgaXQncyBvd24ganJlIChsaW51eCwgd2luMzIsIGRhcndpbikgLy9maXhtZTogdXNlIEdyYWFsVk0gdG8gcHJlY29tcGlsZSBsYW5ndWFnZXRvb2wgaW4gb3JkZXIgdG8gc2F2ZSBzcGFjZSBhbmQgZ2V0IHJpZCBvZiBqcmU/XG5jbGFzcyBKcmVIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7IH1cblxuICAgIGluaXQoKXsgXG4gICAgICAgIHRoaXMualRlc3QoKVxuICAgIH1cblxuXG4gICAgalRlc3QoKXtcbiAgICAgICAgbGV0IGphdmFwYXRoID0gdGhpcy5kcml2ZXIoKTsgLy8gJy9wZmFkL3p1ci9qYXZhJ1xuICAgICAgICBjb25zdCBwcm9jID0gc3Bhd24oamF2YXBhdGgsIFsnLXZlcnNpb24nXSk7XG4gICAgXG4gICAgICAgIHByb2Muc3RkZXJyLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGRhdGEudG9TdHJpbmcoKS5zcGxpdCgnXFxuJyk7IC8vIGluIFplaWxlbiBzcGxpdHRlblxuICAgICAgICAgICAgbG9nLmRlYnVnKGBqcmUtaGFuZGxlciBAIGpUZXN0OiAke2xpbmVzWzBdfWApOyAvLyBudXIgZGllIGVyc3RlIFplaWxlIGxvZ2dlblxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZmFpbChyZWFzb24pIHtcbiAgICAgICAgbG9nLmVycm9yKHJlYXNvbik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICBnZXREaXJlY3RvcmllcyhkaXJQYXRoKSB7XG4gICAgICAgIGxldCBkaXJzID0gZnMucmVhZGRpclN5bmMoZGlyUGF0aCkuZmlsdGVyKFxuICAgICAgICAgICAgZmlsZSA9PiBmcy5zdGF0U3luYyhwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZSkpLmlzRGlyZWN0b3J5KClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGRpcnNcbiAgICB9IFxuXG4gICAgZHJpdmVyKCl7XG4gICAgICAgIHZhciBkID0gcGxhdGZvcm1EaXNwYXRjaGVyLmphdmFCaW4uc2xpY2UoKTtcbiAgICAgICAgZC51bnNoaWZ0KHBsYXRmb3JtRGlzcGF0Y2hlci5qcmVEaXIpO1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luLmFwcGx5KHBhdGgsIGQpO1xuICAgIH1cblxuICAgIGdldEFyZ3MoY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKS5zbGljZSgpO1xuICAgICAgICBjbGFzc3BhdGggPSBjbGFzc3BhdGggfHwgW107XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc25hbWUpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoY2xhc3NwYXRoLmpvaW4odGhpcy5fcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOicpKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KCctY3AnKTtcbiAgICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfVxuXG4gICAgalNwYXduKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKSB7XG4gICAgICAgIFxuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpXG4gICAgICAgIGxldCBqYXZhYXJncyA9IHRoaXMuZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncylcbiAgICAgICAgbGV0IGphdmFjbWRsaW5lID0gIGAke2phdmFwYXRofSAke2phdmFhcmdzLmpvaW4oJyAnKX0gYFxuXG4gICAgICAgIGxvZy5pbmZvKGBqcmUtaGFuZGxlciBAIGpTcGF3bjogJyR7cGxhdGZvcm1EaXNwYXRjaGVyLmpyZX0nIHNlbGVjdGVkYClcbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiBzcGF3bmluZyBqYXZhIHByb2Nlc3M6ICR7amF2YWNtZGxpbmV9YClcbiAgICAgICAgcmV0dXJuIHNwYXduKGphdmFwYXRoLCBqYXZhYXJncywge3NoZWxsOmZhbHNlfSk7XG4gICAgICAgLy8gcmV0dXJuIHNwYXduKGphdmFjbWRsaW5lKTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgbmV3IEpyZUhhbmRsZXIoKVxuIiwgIi8vIHNjcmlwdHMvU3lzdGVtVHJheU1hbmFnZXIuanNcbmltcG9ydCB7IGFwcCwgVHJheSwgTWVudSB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IFdpbmRvd0hhbmRsZXIgZnJvbSAnLi93aW5kb3doYW5kbGVyLmpzJztcbmltcG9ydCBDb21tSGFuZGxlciBmcm9tICcuL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IGkxOG4gZnJvbSAnLi4vLi4vLi4vc3JjL2xvY2FsZXMvbG9jYWxlcy5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmxldCB0cmF5ID0gbnVsbDtcblxuLy8gUmVzb2x2ZSBpY29uIHBhdGg6IHBhY2thZ2VkIGFwcCB1c2VzIHVucGFja2VkIHB1YmxpYyBkaXIsIGRldiB1c2VzIHByb2plY3QgcHVibGljXG5mdW5jdGlvbiBnZXRUcmF5SWNvblBhdGgoKSB7XG4gIGNvbnN0IHB1YmxpY0Jhc2UgPSBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcbiAgcmV0dXJuIHBhdGguam9pbihwdWJsaWNCYXNlLCAnaWNvbnMnLCAnaWNvbjI0eDI0LnBuZycpO1xufSBcblxuLy8gPT09IHJlcGxhY2UgdGhlIGhlbHBlciBzZXRMb2NhbGUgKGV4YWN0IGJsb2NrKSA9PT1cbmNvbnN0IHNldExvY2FsZSA9IChsb2MpID0+IHtcbiAgICBjb25zdCBnbCA9IGkxOG4uZ2xvYmFsOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IGdsb2JhbCBjb21wb3NlclxuICAgIGlmIChnbCAmJiB0eXBlb2YgZ2wubG9jYWxlID09PSAnb2JqZWN0JyAmJiBnbC5sb2NhbGUpIHtcbiAgICAgIC8vIHZ1ZS1pMThuIGNvbXBvc2l0aW9uIG1vZGVcbiAgICAgIGlmICgndmFsdWUnIGluIGdsLmxvY2FsZSkgZ2wubG9jYWxlLnZhbHVlID0gbG9jOyAgICAgLy8gc2V0IHJlYWN0aXZlIHZhbHVlXG4gICAgICBlbHNlIGdsLmxvY2FsZSA9IGxvYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZhbGxiYWNrXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGxlZ2FjeSBtb2RlIG9yIHBsYWluIHN0cmluZ1xuICAgICAgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gc3RyaW5nIGxvY2FsZVxuICAgIH1cbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICBcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgdHJheSBpY29uIGlmIGl0IGRvZXNuJ3QgZXhpc3QgYW5kIHVwZGF0ZXMgaXRzIGNvbnRleHQgbWVudS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbmV3IGxvY2FsZSB0byBhcHBseS5cbiAqL1xuXG5cblxuZXhwb3J0IGNvbnN0IHVwZGF0ZVN5c3RlbVRyYXkgPSAobG9jYWxlKSA9PiB7XG4gICAgc2V0TG9jYWxlKGxvY2FsZSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCB0ID0gKGspID0+IGkxOG4uZ2xvYmFsLnQoayk7ICAgICAgICAgICAgICAgICAgICAgIC8vIGFsd2F5cyByZXNvbHZlIGxpdmVcbiAgXG4gICAgaWYgKCF0cmF5KSB7XG4gICAgICB0cmF5ID0gbmV3IFRyYXkoZ2V0VHJheUljb25QYXRoKCkpO1xuICAgICAgdHJheS5vbignY2xpY2snLCAoKSA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9nZ2xlIHdpbmRvd1xuICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkgXG4gICAgICAgICAgPyBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaGlkZSgpIFxuICAgICAgICAgIDogV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgXG4gICAgLy8gYnVpbGQgY29udGV4dCBtZW51IHdpdGggY3VycmVudCBsb2NhbGVcbiAgICBjb25zdCBjb250ZXh0TWVudSA9IE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUoW1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LnJlc3RvcmUnKSwgY2xpY2s6ICgpID0+IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KCkgfSwgLy8gc2hvdyB3aW5kb3dcbiAgICAgIHsgbGFiZWw6IHQoJ21haW4udHJheS5kaXNjb25uZWN0JyksIGNsaWNrOiAoKSA9PiB7IFxuICAgICAgICAgIGxvZy5pbmZvKFwibWFpbiBAIHN5c3RlbXRyYXk6IHJlbW92aW5nIHJlZ2lzdHJhdGlvblwiKTsgXG4gICAgICAgICAgQ29tbUhhbmRsZXIucmVzZXRDb25uZWN0aW9uKCk7IFxuICAgICAgICB9IFxuICAgICAgfSwgLy8gZGlzY29ubmVjdFxuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmV4aXQnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogQ2xvc2luZyBOZXh0LUV4YW1cIik7IFxuICAgICAgICAgIGxvZy53YXJuKFwibWFpbiBAIHN5c3RlbXRyYXk6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIik7IFxuICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlOyBcbiAgICAgICAgICBhcHAucXVpdCgpOyBcbiAgICAgICAgfSBcbiAgICAgIH0gLy8gZXhpdFxuICAgIF0pO1xuICBcbiAgICB0cmF5LnNldFRvb2xUaXAoJ05leHQtRXhhbSBTdHVkZW50Jyk7ICAgICAgICAgICAgICAgICAgIC8vIHNldCB0b29sdGlwXG4gICAgdHJheS5zZXRDb250ZXh0TWVudShjb250ZXh0TWVudSk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBhcHBseSBtZW51XG4gIH07XG4gIC8vID09PSBlbmQgcmVwbGFjZSA9PT1cbiAgIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIHNjcmlwdCBpcyB1c2VkIHRvIHRlc3QgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgb24gbWFjT1MgYW5kIHJlc2V0IHRoZW0gaWYgbmVlZGVkXG4gKiBJdCB1c2VzIHRoZSB0Y2N1dGlsIGNvbW1hbmQgdG8gdGVzdCBhbmQgcmVzZXQgdGhlIHBlcm1pc3Npb25zXG4gKiBJdCByZXR1cm5zIHRydWUgaWYgdGhlIG5ldHdvcmsgcGVybWlzc2lvbnMgYXJlIGFsbG93ZWQgYW5kIGZhbHNlIGlmIHRoZXkgYXJlIG5vdFxuICogXG4gKiBUaGlzIGNvdWxkIGFsc28gYmUgdXNlZCB0byB0ZXN0IG90aGVyIHBlcm1pc3Npb25zIGxpa2UgYWNjZXNzaWJpbGl0eSwgc2NyZWVuIGNhcHR1cmUsIGV0Yy4gXG4gKiBzZWUgY29tbXVuaWNhdGlvbmhhbmRsZXIuanMgZm9yIG1vcmUgZGV0YWlscyBvbiBob3cgdG8gdGVzdCBmb3Igc2NyZWVuc2hvdCBwZXJtaXNzaW9ucyAoaXRzIG5vdCBwb3NzaWJsZSB0byB0ZXN0IGZvciBzY3JlZW4gY2FwdHVyZSBwZXJtaXNzaW9ucyBvbiBtYWNvcyBiZWNhdXNlIHdpdGhvdXQgcGVybWlzc2lvbnMgaXQgd2lsbCBhbHdheXMgcmV0dXJuIGEgYmxhbmsgc2NyZWVuc2hvdCAtIHdlIHVzZSBhIHdvcmthcm91bmQgdG8gZGV0ZWN0IHRoaXMpXG4gKiBcbiAqL1xuXG5cblxuXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcycgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJ1biB0Y2N1dGlsXG5pbXBvcnQgeyBkaWFsb2csIGFwcCB9IGZyb20gJ2VsZWN0cm9uJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaG93IGRpYWxvZyBhbmQgcXVpdFxuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KSB7ICAgICAgICAgICAgICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBmZXRjaCB3b3Jrc1xuICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3NlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3BvbmdgLCB7IG1ldGhvZDogJ0dFVCcsIGNhY2hlOiAnbm8tc3RvcmUnIH0pIC8vIHRlc3QgcmVxdWVzdFxuICAgICAgICAgICAgcmV0dXJuIHJlcy5va1xuICAgIH0gY2F0Y2ggeyAgcmV0dXJuIGZhbHNlIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc2V0VENDKCkgeyAgICAgIC8vIHJlc2V0IFRDQyBwZXJtaXNzaW9uc1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vYXBwSWRcbiAgICAgICAgZXhlYyhgdGNjdXRpbCByZXNldCBBbGwgY29tLm5leHRleGFtLnN0dWRlbnRgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuICAgICAgICAvL2FwcEJ1bmRsZUlkIChzZXQgdmlhIG5vdGFyaXplKVxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0tc3R1ZGVudC5hcHBgLCAoZXJyLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdCh7IGVyciwgc3Rkb3V0LCBzdGRlcnIgfSlcbiAgICAgICAgICAgIHJlc29sdmUoeyBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICB9KVxuXG5cbiAgICB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlTmV0d29ya09yUmVzZXQoc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgLy8gY2hlY2sgb3IgcmVzZXRcbiAgICBjb25zdCBvayA9IGF3YWl0IHRlc3ROZXR3b3JrUGVybWlzc2lvbihzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydClcbiAgICBpZiAob2spIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogTmV0d29yayBhY2Nlc3MgaXMgYWxsb3dlZGApO1xuICAgICAgICAgICAgcmV0dXJuIFwib2tcIjtcbiAgICB9XG4gICAgbG9nLndhcm4oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBObyBIVFRQIHJlcXVlc3RzIGFsbG93ZWQhYCApXG5cbiAgICB0cnkge1xuXG4gICAgICAgIC8vIGFzayB0aGUgdXNlcnMgaWYgdGhleSB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9ucyBhbmQgZXhpdCB0aGUgYXBwIGlmIHRoZXkgZG9cbiAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0RlciBTZXJ2ZXIgaXN0IG5pY2h0IGVycmVpY2hiYXIuIE1cdTAwRjZjaHRlbiBTaWUgZGllIEJlcmVjaHRpZ3VuZ2VuIHp1clx1MDBGQ2Nrc2V0emVuIHVuZCBOZXh0LUV4YW0gbWFudWVsbCBuZXUgc3RhcnRlbj8nLFxuICAgICAgICAgICAgYnV0dG9uczogWydPSycsICdBYmJyZWNoZW4nXSxcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGNob2ljZS5yZXNwb25zZSA9PT0gMCkgeyAgICAvLyByZXNldCBwZXJtaXNzaW9ucyBhbmQgcmV0dXJuIHRydWUgdG8gcXVpdCB0aGUgYXBwXG4gICAgICAgICAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IFJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zIGFuZCBxdWl0dGluZyBhcHBgKTtcbiAgICAgICAgICAgIGF3YWl0IHJlc2V0VENDKCk7IFxuICAgICAgICAgICAgcmV0dXJuIFwicmVzZXRcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICByZXR1cm4gZmFsc2UgXG4gICAgICAgIH0gICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiBcbiAgICB9IFxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGxvZy5lcnJvcihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IEVycm9yIHJlc2V0dGluZyBuZXR3b3JrIHBlcm1pc3Npb25zOiAke2V9YCk7XG4gICAgICAgIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ZlaGxlciBiZWltIFp1clx1MDBGQ2Nrc2V0emVuIGRlciBCZXJlY2h0aWd1bmdlbicsXG4gICAgICAgICAgICBkZXRhaWw6IFN0cmluZyhlLmVyciB8fCBlKSxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGZhbHNlICAgIC8vIGRvIG5vdCBxdWl0IHRoZSBhcHAgLSBqdXN0IHNob3cgd2FybmluZyBtZXNzYWdlXG4gICAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vLyBDb3VudGVyIGZvciBmYWlsZWQgYXR0ZW1wdHMgLSBza2lwIGV4ZWN1dGlvbiBhZnRlciA0IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG5sZXQgZmFpbHVyZUNvdW50ZXIgPSAwO1xuY29uc3QgTUFYX0ZBSUxVUkVTID0gMztcblxuLy8gQ29udmVydCBSU1NJIGluIGRCbSB0byBhIHF1YWxpdHkgcGVyY2VudGFnZSBiZXR3ZWVuIDAgYW5kIDEwMC5cbmZ1bmN0aW9uIGRibVRvUXVhbGl0eVBlcmNlbnQoZGJtKSB7XG4gICAgaWYgKGRibSA9PT0gbnVsbCB8fCBOdW1iZXIuaXNOYU4oZGJtKSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgbWluRGJtID0gLTEwMDtcbiAgICBjb25zdCBtYXhEYm0gPSAtMzA7XG4gICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KG1pbkRibSwgTWF0aC5taW4obWF4RGJtLCBkYm0pKTtcbiAgICBjb25zdCBwZXJjZW50ID0gKChjbGFtcGVkIC0gbWluRGJtKSAvIChtYXhEYm0gLSBtaW5EYm0pKSAqIDEwMDtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChwZXJjZW50KTtcbn1cblxuLyoqXG4gKiBHZXQgY3VycmVudCBXTEFOIGluZm9ybWF0aW9uIChTU0lELCBCU1NJRCwgUXVhbGl0eSlcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtzc2lkOiBzdHJpbmd8bnVsbCwgYnNzaWQ6IHN0cmluZ3xudWxsLCBxdWFsaXR5OiBudW1iZXJ8bnVsbCwgbWVzc2FnZTogc3RyaW5nfG51bGx9Pn1cbiAqIEBkZXNjcmlwdGlvbiBtZXNzYWdlIGNhbiBiZTogXCJlcnJvclwiIChvbiBlcnJvciksIFwibm9pbnRlcmZhY2VcIiAobm8gaW50ZXJmYWNlIGF2YWlsYWJsZSksIFwibm9wZXJtaXNzaW9uc1wiIChsb2NhdGlvbiBwZXJtaXNzaW9ucyBtaXNzaW5nIG9uIFdpbmRvd3MpLCBvciBudWxsIChzdWNjZXNzKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm8oKSB7XG4gICAgLy8gU2tpcCBleGVjdXRpb24gaWYgd2UndmUgaGFkIHRvbyBtYW55IGNvbnNlY3V0aXZlIGZhaWx1cmVzXG4gICAgaWYgKGZhaWx1cmVDb3VudGVyID49IE1BWF9GQUlMVVJFUykge1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgIH1cbiAgICBcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHBsYXRmb3JtKSB7XG4gICAgICAgICAgICBjYXNlICdsaW51eCc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9MaW51eCgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvV2luZG93cygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb01hY09TKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdnaXZpbmd1cCcgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRW5zdXJlIHJlc3VsdCBpcyBhbHdheXMgYW4gb2JqZWN0XG4gICAgICAgIGlmICghcmVzdWx0IHx8IHR5cGVvZiByZXN1bHQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmYWlsdXJlQ291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gUmVzZXQgY291bnRlciBvbiBzdWNjZXNzZnVsIHJlc3VsdCAoaGFzIGRhdGEpXG4gICAgICAgIGlmIChyZXN1bHQuc3NpZCB8fCByZXN1bHQuYnNzaWQgfHwgcmVzdWx0LnF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluY3JlbWVudCBjb3VudGVyIG9uIGZhaWx1cmVcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gUmV0dXJuIGVtcHR5IG9iamVjdCBpbnN0ZWFkIG9mIHRocm93aW5nIHRvIHByZXZlbnQgYXBwIGNyYXNoXG4gICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gTGludXggdXNpbmcgbm1jbGkgKHdpdGggZmFsbGJhY2sgdG8gaXcvaXdjb25maWcpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTGludXgoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IG5tY2xpIGZpcnN0IChtb3N0IGNvbW1vbiBvbiBtb2Rlcm4gTGludXgpXG4gICAgICAgIC8vIEZpcnN0IHRyeSB0byBnZXQgYWN0aXZlIGRldmljZSBkaXJlY3RseSAoZmFzdGVyIHRoYW4gbGlzdGluZyBhbGwgbmV0d29ya3MpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgc3Rkb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKCdubWNsaSAtdCAtZiBhY3RpdmUsc3NpZCxic3NpZCxzaWduYWwgZGV2aWNlIHdpZmkgbGlzdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNDAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGNhdGNoIChleGVjRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBFdmVuIGlmIGV4ZWNBc3luYyB0aHJvd3MgYW4gZXJyb3IsIGNoZWNrIGlmIHN0ZG91dCBjb250YWlucyB2YWxpZCBkYXRhXG4gICAgICAgICAgICAgICAgLy8gbm1jbGkgc29tZXRpbWVzIHJldHVybnMgbm9uLXplcm8gZXhpdCBjb2RlIGJ1dCBzdGlsbCBwcm92aWRlcyB2YWxpZCBvdXRwdXRcbiAgICAgICAgICAgICAgICBpZiAoZXhlY0Vycm9yLnN0ZG91dCAmJiBleGVjRXJyb3Iuc3Rkb3V0LnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ZG91dCA9IGV4ZWNFcnJvci5zdGRvdXQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhlY0Vycm9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFzdGRvdXQgfHwgc3Rkb3V0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG91dHB1dCBmcm9tIG5tY2xpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC50cmltKCkuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaW5kIGFjdGl2ZSBjb25uZWN0aW9uXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKTtcbiAgICAgICAgICAgICAgICBpZiAoKHBhcnRzWzBdID09PSAneWVzJyB8fCBwYXJ0c1swXSA9PT0gJ2phJykgJiYgcGFydHMubGVuZ3RoID49IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHBhcnRzWzFdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAvLyBCU1NJRCBpcyBhIE1BQyBhZGRyZXNzICg2IGhleCBieXRlcyBzZXBhcmF0ZWQgYnkgY29sb25zLCBwb3NzaWJseSBlc2NhcGVkKVxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIHVzaW5nIHJlZ2V4IC0gaGFuZGxlIGVzY2FwZWQgY29sb25zIChcXDopIGFzIHNob3duIGluIG5tY2xpIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAvLyBJbiByZWdleCBzdHJpbmcsIFxcXFw6IG1hdGNoZXMgYSBsaXRlcmFsIGJhY2tzbGFzaCBmb2xsb3dlZCBieSBjb2xvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzpcXFxcOlthLWYwLTldezJ9KXs1fS9pKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlc2NhcGUgYmFja3NsYXNoZXMgYW5kIG5vcm1hbGl6ZSB0byB1cHBlcmNhc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaFswXS5yZXBsYWNlKC9cXFxcOi9nLCAnOicpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjazogdHJ5IG5vcm1hbCBjb2xvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbE1hdGNoID0gbGluZS5tYXRjaCgvW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vcm1hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBub3JtYWxNYXRjaFswXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IHBhcnRzWzJdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpZ25hbCBpcyB0aGUgbGFzdCBudW1lcmljIHBhcnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsU3RyID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0gPyBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXS50cmltKCkgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsID0gc2lnbmFsU3RyID8gKHBhcnNlSW50KHNpZ25hbFN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IHNpZ25hbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKG5tY2xpRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dCwgZXRjLiksIG5vdCBpZiBqdXN0IG5vIFdMQU4gYWN0aXZlXG4gICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IG5tY2xpRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgbm1jbGlFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG5tY2xpRXJyb3IubWVzc2FnZSAmJiAhbm1jbGlFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdObyBvdXRwdXQnKSk7XG4gICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IG5tY2xpIGNvbW1hbmQgZmFpbGVkOicsIG5tY2xpRXJyb3IubWVzc2FnZSB8fCBubWNsaUVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gaXcgKGl3Y29uZmlnIGlzIGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1FIFwiXlxccypzc2lkfF5cXHMqbGlua1wiJywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpd2xpbmtTdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnaXcgZGV2IHwgZ3JlcCAtQSA1IFwiXlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBTU0lEXG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gaXdTdGRvdXQgPyBpd1N0ZG91dC5tYXRjaCgvc3NpZFxccysoLispLykgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNzaWQgPSBzc2lkTWF0Y2ggPyBzc2lkTWF0Y2hbMV0udHJpbSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEJTU0lEIGFuZCBzaWduYWwgZnJvbSBsaW5rIGluZm9cbiAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gaXdsaW5rU3Rkb3V0ID8gaXdsaW5rU3Rkb3V0Lm1hdGNoKC9hZGRyOlxccysoW2EtZjAtOTpdezE3fSkvaSkgOiBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL3NpZ25hbDpcXHMrKC0/XFxkKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsRGJtID0gc2lnbmFsTWF0Y2ggPyAocGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgcXVhbGl0eSA9IHNpZ25hbERibSAhPT0gbnVsbCA/IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsRGJtKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQsXG4gICAgICAgICAgICAgICAgICAgIHF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoaXdFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGl0J3MgYSByZWFsIGVycm9yXG4gICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3RXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogaXcgY29tbWFuZCBmYWlsZWQ6JywgaXdFcnJvci5tZXNzYWdlIHx8IGl3RXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGZhbGxiYWNrOiBpd2NvbmZpZyAoZGVwcmVjYXRlZCBidXQgd2lkZWx5IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpd2NvbmZpZyAyPi9kZXYvbnVsbCB8IGdyZXAgLUUgXCJFU1NJRHxBY2Nlc3MgUG9pbnR8U2lnbmFsIGxldmVsXCInLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNpZ25hbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0VTU0lEOlwiKFteXCJdKylcIi8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNzaWRNYXRjaCkgc3NpZCA9IHNzaWRNYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0FjY2VzcyBQb2ludDpcXHMrKFthLWYwLTk6XXsxN30pL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJzc2lkTWF0Y2gpIGJzc2lkID0gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGxpbmUubWF0Y2goL1NpZ25hbCBsZXZlbD0oLT9cXGQrKS8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpZ25hbE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWxpdHk6IGRibVRvUXVhbGl0eVBlcmNlbnQoc2lnbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChpd2NvbmZpZ0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgbG9nIGlmIGFsbCBtZXRob2RzIGZhaWxlZCB3aXRoIHJlYWwgZXJyb3JzIChjb21tYW5kIG5vdCBmb3VuZCwgdGltZW91dClcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNSZWFsRXJyb3IgPSBpd2NvbmZpZ0Vycm9yLmNvZGUgPT09ICdFTk9FTlQnIHx8IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCc7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBBbGwgbWV0aG9kcyAobm1jbGksIGl3LCBpd2NvbmZpZykgZmFpbGVkLiBMYXN0IGVycm9yOicsIGl3Y29uZmlnRXJyb3IubWVzc2FnZSB8fCBpd2NvbmZpZ0Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIExvZyB1bmV4cGVjdGVkIGVycm9ycyBkdXJpbmcgV0xBTiBpbmZvIHJldHJpZXZhbFxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IFVuZXhwZWN0ZWQgZXJyb3I6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ2Vycm9yJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBzc2lkOiBudWxsLFxuICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgcXVhbGl0eTogbnVsbCxcbiAgICAgICAgbWVzc2FnZTogJ25vaW50ZXJmYWNlJ1xuICAgIH07XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBXaW5kb3dzIHVzaW5nIG5ldHNoXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvV2luZG93cygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHNoIHdsYW4gc2hvdyBpbnRlcmZhY2VzJywge1xuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgc3RkZXJyIGZvciBzZXJ2aWNlIGVycm9yc1xuICAgICAgICBjb25zdCBlcnJvck91dHB1dCA9IChzdGRlcnIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IChzdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkT3V0cHV0ID0gb3V0cHV0ICsgJyAnICsgZXJyb3JPdXRwdXQ7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiBXTEFOIHNlcnZpY2UgaXMgbm90IHJ1bm5pbmcgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbnN2YycpIHx8IFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dsYW4gYXV0b2NvbmZpZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYXV0b21hdGlzY2ggd2xhbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbi1rb25maWd1cmF0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3NlcnZpY2UgaXMgbm90IHJ1bm5pbmcnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2RlciBkaWVuc3QnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2lyZCBuaWNodCBhdXNnZWZcdTAwRkNocnQnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgZm9yIFdpbmRvd3MgMTEgbG9jYXRpb24gcGVybWlzc2lvbiByZXF1aXJlbWVudCAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlnZW4nKSB8fCBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGF0ZW5zY2h1dHonKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIG5vIGludGVyZmFjZXMgYXZhaWxhYmxlXG4gICAgICAgIGlmIChzdGRvdXQuaW5jbHVkZXMoJ1RoZXJlIGlzIG5vIHdpcmVsZXNzIGludGVyZmFjZScpIHx8IFxuICAgICAgICAgICAgc3Rkb3V0LmluY2x1ZGVzKCdFcyBnaWJ0IGtlaW5lIERyYWh0bG9zLVNjaG5pdHRzdGVsbGUnKSB8fFxuICAgICAgICAgICAgc3Rkb3V0Lm1hdGNoKC9ObyB3aXJlbGVzcy9pKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKS5maWx0ZXIobGluZSA9PiBsaW5lLmxlbmd0aCA+IDApO1xuICAgICAgICBcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgLy8gU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSwgaGFuZGxlcyB2YXJpb3VzIGZvcm1hdHNcbiAgICAgICAgICAgIC8vIFVzZSBuZWdhdGl2ZSBsb29rYmVoaW5kIHRvIGVuc3VyZSB3ZSBkb24ndCBtYXRjaCBcIkJTU0lEXCIgKHdoaWNoIGNvbnRhaW5zIFwiU1NJRFwiKVxuICAgICAgICAgICAgaWYgKGxpbmUubWF0Y2goLyg/PCFCKVNTSURcXHMqOi9pKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6XFxzKiguKykvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBzZXQgaWYgbm90IGVtcHR5IGFuZCBub3QgXCJOL0FcIiBvciBzaW1pbGFyXG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRyYWN0ZWQgJiYgZXh0cmFjdGVkLmxlbmd0aCA+IDAgJiYgIWV4dHJhY3RlZC5tYXRjaCgvXihOXFwvQXxuXFwvYXxub25lfGtlaW5lKSQvaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQgPSBleHRyYWN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBCU1NJRCBwYXJzaW5nIC0gbW9yZSBmbGV4aWJsZSBwYXR0ZXJuIG1hdGNoaW5nXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9CU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIChoYW5kbGVzIGJvdGggLSBhbmQgOiBzZXBhcmF0b3JzLCB3aXRoIG9yIHdpdGhvdXQgc3BhY2VzKVxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvQlNTSURcXHMqOlxccyooW2EtZjAtOV17Mn0oPzpbLTpcXHNdW2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBtYXRjaFsxXS5yZXBsYWNlKC9bLSBdL2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTaWduYWwgcGFyc2luZyAtIGhhbmRsZSB2YXJpb3VzIGxvY2FsaXplZCBmb3JtYXRzIGFuZCBwYXR0ZXJuc1xuICAgICAgICAgICAgZWxzZSBpZiAobGluZS5tYXRjaCgvU2lnbmFsfFNpZ25hbHN0XHUwMEU0cmtlfEludGVuc2l0XHUwMEU5fFNlXHUwMEYxYWwvaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgcGVyY2VudGFnZSBwYXR0ZXJuIGZpcnN0IChtb3N0IGNvbW1vbilcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKihcXGQrKVxccyolL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKHBhcnNlZCkgJiYgcGFyc2VkID49IDAgJiYgcGFyc2VkIDw9IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IGRCbSBwYXR0ZXJuIChuZWdhdGl2ZSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBsaW5lLm1hdGNoKC86XFxzKigtP1xcZCspXFxzKmRCbS9pKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYm0gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihkYm0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsID0gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBOb3JtYWxpemUgZW1wdHkgc3RyaW5ncyB0byBudWxsXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiAoc3NpZCAmJiBzc2lkLmxlbmd0aCA+IDApID8gc3NpZCA6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogKGJzc2lkICYmIGJzc2lkLmxlbmd0aCA+IDApID8gYnNzaWQgOiBudWxsLFxuICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIGVycm9yIGlzIGR1ZSB0byBsb2NhdGlvbiBwZXJtaXNzaW9ucyAobWlnaHQgYmUgaW4gc3RkZXJyIG9yIGVycm9yIG1lc3NhZ2UpXG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IChlcnJvci5tZXNzYWdlIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBlcnJvclN0ZG91dCA9IChlcnJvci5zdGRvdXQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3RkZXJyID0gKGVycm9yLnN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRFcnJvck91dHB1dCA9IGVycm9yTWVzc2FnZSArICcgJyArIGVycm9yU3Rkb3V0ICsgJyAnICsgZXJyb3JTdGRlcnI7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnRiZXJlY2h0aWd1bmdlbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpICYmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ3QnKSkgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uIHBlcm1pc3Npb25zJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncmVxdWlyZWQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncG9zaXRpb25zZGllbnN0ZScpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3ByaXZhY3knKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCduZXR6d2Vya3NoZWxsYmVmZWhsZScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIFBvd2VyU2hlbGwgbWV0aG9kIHRoYXQgZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBMb2cgZXJyb3Igd2hlbiBjb21tYW5kIGV4ZWN1dGlvbiBmYWlscyAodGltZW91dCwgcGVybWlzc2lvbiwgZXRjLilcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3M6IEVycm9yIGV4ZWN1dGluZyBuZXRzaCBjb21tYW5kOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgUG93ZXJTaGVsbCAoZmFsbGJhY2sgd2hlbiBuZXRzaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzUG93ZXJTaGVsbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgKGRvZXNuJ3QgcmVxdWlyZSBnZW9sb2NhdGlvbilcbiAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBhY3RpdmUgV2ktRmkgY29ubmVjdGlvbiBwcm9maWxlXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwb3dlcnNoZWxsIC1Db21tYW5kIFwiJHByb2ZpbGUgPSBHZXQtTmV0Q29ubmVjdGlvblByb2ZpbGUgfCBXaGVyZS1PYmplY3QgeyRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaS1GaSpcXCcgLW9yICRfLkludGVyZmFjZUFsaWFzIC1saWtlIFxcJypXaXJlbGVzcypcXCd9IHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMTsgaWYgKCRwcm9maWxlKSB7ICRwcm9maWxlLk5hbWUgfVwiJywge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3NpZFN0ciA9IHNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHNzaWRTdHIgJiYgc3NpZFN0ci5sZW5ndGggPiAwICYmICFzc2lkU3RyLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkU3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQlNTSUQgY2Fubm90IGJlIGVhc2lseSByZXRyaWV2ZWQgd2l0aG91dCBuZXRzaCAod2hpY2ggcmVxdWlyZXMgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnMpXG4gICAgICAgIC8vIFNldHRpbmcgdG8gbnVsbCBhcyBmYWxsYmFjayAtIFNTSUQgaXMgdGhlIG1vc3QgaW1wb3J0YW50IGluZm9ybWF0aW9uIGFueXdheVxuICAgICAgICBjb25zdCBic3NpZCA9IG51bGw7XG4gICAgICAgIFxuICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgUG93ZXJTaGVsbCBmYWxsYmFjayAoY2FuJ3QgZWFzaWx5IGdldCBzaWduYWwgc3RyZW5ndGggd2l0aG91dCBuZXRzaClcbiAgICAgICAgLy8gUmV0dXJuIG5vcGVybWlzc2lvbnMgbWVzc2FnZSBzbyBmcm9udGVuZCBjYW4gc2hvdyB0aGUgd2FybmluZ1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgYnNzaWQ6IGJzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgbWVzc2FnZTogJ25vcGVybWlzc2lvbnMnXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIGVycm9yIGlmIFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbHNcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsOiBQb3dlclNoZWxsIGZhbGxiYWNrIGZhaWxlZDonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBtYWNPUyB1c2luZyBhaXJwb3J0IG9yIG5ldHdvcmtzZXR1cFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb01hY09TKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSBhaXJwb3J0IGNvbW1hbmQgZmlyc3QgKGRlcHJlY2F0ZWQgYnV0IHN0aWxsIGF2YWlsYWJsZSBvbiBzb21lIHN5c3RlbXMpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBhaXJwb3J0IGlzIGF2YWlsYWJsZSAodXN1YWxseSBhdCAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydClcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBhaXJwb3J0UGF0aCB9ID0gYXdhaXQgZXhlY0FzeW5jKCd3aGljaCBhaXJwb3J0IDI+L2Rldi9udWxsIHx8IGVjaG8gL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL0FwcGxlODAyMTEuZnJhbWV3b3JrL1ZlcnNpb25zL0N1cnJlbnQvUmVzb3VyY2VzL2FpcnBvcnQnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMTAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhaXJwb3J0ID0gYWlycG9ydFBhdGgudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGAke2FpcnBvcnR9IC1JYCwge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIGxldCByc3NpRGJtID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBzaWduYWxQZXJjZW50ID0gbnVsbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnU1NJRDonKSkge1xuICAgICAgICAgICAgICAgICAgICBzc2lkID0gbGluZS5yZXBsYWNlKCdTU0lEOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ0JTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgTUFDIGFkZHJlc3MgcGF0dGVybiB0byBlbnN1cmUgd2UgZ2V0IHRoZSBmdWxsIEJTU0lEXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRDpcXHMqKFthLWYwLTldezJ9KD86OlthLWYwLTldezJ9KXs1fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRNYXRjaCA/IGJzc2lkTWF0Y2hbMV0udG9VcHBlckNhc2UoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2FnckN0bFJTU0k6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUlNTSSBpbiBkQm0gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByc3NpU3RyID0gbGluZS5yZXBsYWNlKCdhZ3JDdGxSU1NJOicsICcnKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2kgPSByc3NpU3RyID8gKHBhcnNlSW50KHJzc2lTdHIsIDEwKSB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHJzc2lEYm0gPSByc3NpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCdsaW5rIGF1dGg6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWx0ZXJuYXRpdmU6IHNpZ25hbCBzdHJlbmd0aCBhcyBwZXJjZW50YWdlIChpZiBhdmFpbGFibGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvKFxcZCspJS8pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2ggJiYgc2lnbmFsUGVyY2VudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQoc2lnbmFsTWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbFBlcmNlbnQgPSBpc05hTihwYXJzZWQpID8gbnVsbCA6IHBhcnNlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHF1YWxpdHkgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHNpZ25hbFBlcmNlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBxdWFsaXR5ID0gc2lnbmFsUGVyY2VudDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocnNzaURibSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KHJzc2lEYm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc3NpZCB8fCBic3NpZCB8fCBxdWFsaXR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGFpcnBvcnRFcnJvcikge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gbmV0d29ya3NldHVwIC0gb25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKG5vdCBqdXN0IG5vIHBlcm1pc3Npb24pXG4gICAgICAgICAgICBpZiAoYWlycG9ydEVycm9yLmNvZGUgIT09ICdFTk9FTlQnICYmIGFpcnBvcnRFcnJvci5tZXNzYWdlICYmICFhaXJwb3J0RXJyb3IubWVzc2FnZS5pbmNsdWRlcygncGVybWlzc2lvbicpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBhaXJwb3J0IGNvbW1hbmQgZmFpbGVkOicsIGFpcnBvcnRFcnJvci5tZXNzYWdlIHx8IGFpcnBvcnRFcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrOiBuZXR3b3Jrc2V0dXAgYW5kIGlwY29uZmlnIChmb3IgbmV3ZXIgbWFjT1Mgd2hlcmUgYWlycG9ydCBpcyBub3QgYXZhaWxhYmxlKSAgLy8gc3lzdGVtX3Byb2ZpbGVyIGlzIHdheSB0byBoZWF2eSBhbmQgbmVlZHMgYSBsb29vb290IG9mIHRpbWUgdG8gcHJvY2Vzc1xuICAgICAgICAvLyB0aGlzIGlzIGEgc2ltcGxlIGNhbGN1bGF0aW9uLi4gd2UgY2FuJ3QgcmVseSBvbiBhIHByb2Nlc3MgdGhhdCB0YWtlcyAxMHMgdG8gY29tcGxldGUgYW5kIGJsb2NrcyB0aGUgd2hvbGUgc3lzdGVtXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgV0xBTiBpbnRlcmZhY2UgdXNpbmcgbmV0d29ya3NldHVwXG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaW50ZXJmYWNlT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHdvcmtzZXR1cCAtbGlzdGFsbGhhcmR3YXJlcG9ydHMgfCBhd2sgXFwnL1dpLUZpfEFpclBvcnQve2dldGxpbmU7IHByaW50ICRORn1cXCcnLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VOYW1lID0gaW50ZXJmYWNlT3V0cHV0LnRyaW0oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFpbnRlcmZhY2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gV2ktRmkgaW50ZXJmYWNlIGZvdW5kXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IFNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogc3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgYXdrIC1GJyBTU0lEIDogJyAnLyBTU0lEIDogLyB7cHJpbnQgJDJ9J2AsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzc2lkID0gc3NpZE91dHB1dC50cmltKCkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIFNTSUQgZXh0cmFjdGlvbiBmYWlsZWQsIGNvbnRpbnVlIHdpdGggQlNTSURcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IEJTU0lEIHVzaW5nIGlwY29uZmlnIGdldHN1bW1hcnlcbiAgICAgICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBic3NpZE91dHB1dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBpcGNvbmZpZyBnZXRzdW1tYXJ5IFwiJHtpbnRlcmZhY2VOYW1lfVwiIHwgZ3JlcCAnQlNTSUQgOicgfCBhd2sgJ3twcmludCAkM30nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkU3RyID0gYnNzaWRPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIEJTU0lEIGZvcm1hdCAoTUFDIGFkZHJlc3MpXG4gICAgICAgICAgICAgICAgaWYgKGJzc2lkU3RyICYmIC9eW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9JC9pLnRlc3QoYnNzaWRTdHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJzc2lkID0gYnNzaWRTdHIudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChic3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gQlNTSUQgZXh0cmFjdGlvbiBmYWlsZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUXVhbGl0eSBzZXQgdG8gbnVsbCB3aGVuIHVzaW5nIGZhbGxiYWNrIChhaXJwb3J0IG5vdCBhdmFpbGFibGUsIGNhbid0IGdldCBzaWduYWwgc3RyZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKG5ldHdvcmtzZXR1cEVycm9yKSB7XG4gICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgbmV0d29ya3NldHVwIGZhaWxzIHdpdGggYSByZWFsIGVycm9yXG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IG5ldHdvcmtzZXR1cC9pcGNvbmZpZyBmYWxsYmFjayBmYWlsZWQ6JywgbmV0d29ya3NldHVwRXJyb3IubWVzc2FnZSB8fCBuZXR3b3Jrc2V0dXBFcnJvcik7XG4gICAgICAgICAgICAvLyBJZiBmYWxsYmFjayBjb21wbGV0ZWx5IGZhaWxzLCByZXR1cm4gZXJyb3Igb2JqZWN0XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdub2ludGVyZmFjZScgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBnZXRXbGFuSW5mbyB9O1xuXG5cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICd0YXNrbGlzdCAvZm8gY3N2JyAoc3RydWN0dXJlZCBmb3JtYXQsIGZhc3RlciB0aGFuIC92LCBzdGlsbCBzaG93cyBwcm9jZXNzIG5hbWVzKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Rhc2tsaXN0IC9mbyBjc3YnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ25ldHN0YXQgLWFubycgKHNob3dzIGFsbCBjb25uZWN0aW9uIHN0YXRlcyBpbmNsdWRpbmcgRVNUQUJMSVNIRUQgZm9yIHNjcmVlbnNoYXJpbmcgZGV0ZWN0aW9uKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHN0YXQgLWFubycsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBSZWdleCB0byBmaW5kIDpQT1JUIGZvbGxvd2VkIGJ5IGEgc3BhY2UgKGVuc3VyZXMgZXhhY3QgcG9ydCBtYXRjaCwgZS5nLiwgOjU5MzggKVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH1cXFxcc2AsICdnJykgXG4gICAgICBpZiAocmVnZXgudGVzdChzdGRvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywnY29tLm1pY3Jvc29mdC50ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnLFxuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNixcbl1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHdpbiBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcydcbmltcG9ydCAqIGFzIG1hYyBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcydcbmltcG9ydCAqIGFzIGxpbnV4IGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTGluLmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2socGxhdGZvcm0gPSAnd2luMzInKSB7XG4gIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuIGF3YWl0IHdpbi5ydW5SZW1vdGVDaGVjaygpXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHJldHVybiBhd2FpdCBtYWMucnVuUmVtb3RlQ2hlY2soKVxuICByZXR1cm4gYXdhaXQgbGludXgucnVuUmVtb3RlQ2hlY2soKVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gRXhwYW5kZWQgYnJvd3NlciBrZXl3b3JkcyB0byBjYXRjaCBtb3JlIHZhcmlhbnRzXG5jb25zdCBicm93c2VyS2V5d29yZHMgPSBbXG4gICAgJ2Nocm9tJywgJ2Nocm9tZS5leGUnLFxuICAgICdlZGdlJywgJ21zZWRnZS5leGUnLFxuICAgICdmaXJlJywgJ2ZpcmVmb3guZXhlJyxcbiAgICAnYnJhdmUnLCAnYnJhdmUuZXhlJyxcbiAgICAnb3BlcmEnLCAnb3BlcmEuZXhlJyxcbiAgICAnYnJvd3NlcicsIC8vIEdlbmVyaWMgYnJvd3NlciBwcm9jZXNzXG4gICAgJ2lleHBsb3JlJywgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAnc2FmYXJpJywgLy8gRm9yIG1hY09TXG5dO1xuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwuZXhlIC1Ob0xvZ28gLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiYgeyAkcHJvYyA9IEdldC1DaW1JbnN0YW5jZSAtQ2xhc3MgV2luMzJfUHJvY2VzcyAtRmlsdGVyICdQcm9jZXNzSWQ9JHtwaWR9JzsgaWYgKCRwcm9jKSB7ICRwcm9jLlBhcmVudFByb2Nlc3NJZDsgJHByb2MuTmFtZSB9IH1cImA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChsaW5lc1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gbGluZXNbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzOiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBVbml4IHN5c3RlbXMgKExpbnV4L21hY09TKVxuICogVHJpZXMgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QpLCBmYWxscyBiYWNrIHRvIHBzIGNvbW1hbmRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCBtZXRob2QgfjRtcywgbm8gcHJvY2VzcyBzcGF3bilcbiAgICAgICAgY29uc3QgW3N0YXRDb250ZW50LCBjb21tQ29udGVudF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L3N0YXRgLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9jb21tYCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzdGF0Q29udGVudCkge1xuICAgICAgICAgICAgLy8gUGFyc2UgL3Byb2MvcGlkL3N0YXQ6IHBpZCAoY29tbSkgc3RhdGUgcHBpZCAuLi5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRNYXRjaCA9IHN0YXRDb250ZW50Lm1hdGNoKC9eXFxkK1xccytcXCgoW14pXSspXFwpXFxzK1xcUytcXHMrKFxcZCspLyk7XG4gICAgICAgICAgICBpZiAoc3RhdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChjb21tQ29udGVudCB8fCBzdGF0TWF0Y2hbMV0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChzdGF0TWF0Y2hbMl0sIDEwKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIHBzIGNvbW1hbmQgKHdvcmtzIG9uIGJvdGggTGludXggYW5kIG1hY09TKVxuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBzIC1wICR7cGlkfSAtbyBwcGlkPSxjb21tPWA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvVW5peDogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gYmFzZWQgb24gcGxhdGZvcm1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm8ocGlkKSB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuICAgIFxuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCk7XG4gICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fCBwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvVW5peChwaWQpOyAvLyBMaW51eC9tYWNPUzogdHJpZXMgL3Byb2MsIGZhbGxzIGJhY2sgdG8gcHNcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY2hlY2sgcGFyZW50IHByb2Nlc3NlcyBmb3IgYnJvd3NlclxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kUGFyZW50UHJvY2VzcyhwaWQsIG1heERlcHRoLCB2aXNpdGVkUGlkcykge1xuICAgIGlmIChwaWQgPT09IDEgfHwgcGlkID09PSAwKSB7XG4gICAgICAgIGxvZy5pbmZvKCdjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSb290IFBJRCByZWFjaGVkLiBObyB3ZWIgYnJvd3NlciBmb3VuZC4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWF4RGVwdGggPD0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gd2hlbiBtYXggZGVwdGggcmVhY2hlZFxuICAgIH1cbiAgICBcbiAgICBpZiAodmlzaXRlZFBpZHMuaGFzKHBpZCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG4gICAgfVxuICAgIFxuICAgIHZpc2l0ZWRQaWRzLmFkZChwaWQpO1xuICAgIFxuICAgIC8vIEdldCBwcm9jZXNzIGluZm8gKGdldFByb2Nlc3NJbmZvIGFscmVhZHkgaGFzIGl0cyBvd24gdGltZW91dCBwcm90ZWN0aW9uKVxuICAgIGNvbnN0IHByb2Nlc3NJbmZvID0gYXdhaXQgZ2V0UHJvY2Vzc0luZm8ocGlkKTtcbiAgICBcbiAgICBpZiAoIXByb2Nlc3NJbmZvKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgeyBwcGlkLCBuYW1lIH0gPSBwcm9jZXNzSW5mbztcbiAgICBcbiAgICAvLyBMb2cgdGhlIHByb2Nlc3MgaW5mbyBmb3IgZGVidWdnaW5nXG4gICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IENoZWNraW5nIHByb2Nlc3M6ICR7bmFtZX0gKFBJRDogJHtwaWR9LCBQUElEOiAke3BwaWR9KWApO1xuICAgIFxuICAgIC8vIE1vcmUgdGhvcm91Z2ggYnJvd3NlciBkZXRlY3Rpb25cbiAgICBpZiAoYnJvd3NlcktleXdvcmRzLnNvbWUoYnJvd3NlciA9PiBuYW1lLmluY2x1ZGVzKGJyb3dzZXIpKSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQnJvd3NlciBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuaW5jbHVkZXMoJ2V4cGxvcmVyJykgfHwgcHBpZCA8PSAxKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSZWFjaGVkIHN5c3RlbSBwcm9jZXNzIG9yIGV4cGxvcmVyYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHBpZCwgbWF4RGVwdGggLSAxLCB2aXNpdGVkUGlkcyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIHBhcmVudCBwcm9jZXNzIGlzIGEgYnJvd3NlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQYXJlbnRQcm9jZXNzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZvdW5kQnJvd3NlciA9IGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHByb2Nlc3MucHBpZCwgNiwgbmV3IFNldCgpKTtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGRldGVjdGlvbiByZXN1bHQ6ICR7Zm91bmRCcm93c2VyfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBmb3VuZEJyb3dzZXIgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBFcnJvciBpbiBicm93c2VyIGRldGVjdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZm91bmRCcm93c2VyOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICB9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7QUF1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QztBQUN0RCxFQUFBQSxnQkFBZSxTQUFTLHNCQUFzQixNQUFNO0FBQUEsRUFBQyxDQUFDO0FBQ3RELEVBQUFBLGdCQUFlLFNBQVMsc0JBQXNCLE1BQU07QUFBQSxFQUFDLENBQUM7QUFDdEQsRUFBQUEsZ0JBQWUsU0FBUyxZQUFZLE1BQU07QUFBRyxXQUFPO0FBQUEsRUFBTSxDQUFDO0FBQy9ELENBQUM7IiwKICAibmFtZXMiOiBbImV4ZWNTeW5jIiwgImV4ZWNTeW5jIiwgImxvZyIsICJhcHAiLCAiQnJvd3NlcldpbmRvdyIsICJnbG9iYWxTaG9ydGN1dCIsICJUcmF5IiwgIk1lbnUiLCAiZGlhbG9nIiwgImxvZyIsICJsb2ciLCAicGF0aCIsICJmcyIsICJpcCIsICJnYXRld2F5NHN5bmMiLCAiZnMiLCAiYXBwIiwgImpvaW4iLCAibG9nIiwgImxvZyIsICJjb25maWdTdG9yZSIsICJhcHBzVG9DbG9zZSIsICJhcHAiLCAibG9nIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAiYXBwc1RvQ2xvc2UiLCAicHVibGljQmFzZSIsICJqb2luIiwgImNoaWxkUHJvY2VzcyIsICJsb2ciLCAiYXBwIiwgImpvaW4iLCAiY2hpbGRQcm9jZXNzIiwgImxvZyIsICJsb2ciLCAiYXBwc1RvQ2xvc2UiLCAiY2hpbGRQcm9jZXNzIiwgImFwcCIsICJqb2luIiwgImxvZyIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImxvZyIsICJwYXRoIiwgIl9fZGlybmFtZSIsICJhcHAiLCAiam9pbiIsICJmcyIsICJjb25maWciLCAibG9nIiwgImZzIiwgImpvaW4iLCAic2NyZWVuIiwgImlwY01haW4iLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAid2ViQ29udGVudHMiLCAicGF0aCIsICJmcyIsICJjbGlwYm9hcmQiLCAiYXBwIiwgIm9zIiwgImxvZyIsICJwYXRoIiwgImxvZyIsICJmcyIsICJwYXRoIiwgInByb2Nlc3MiLCAic3Bhd24iLCAiYXBwIiwgImxvZyIsICJfX2Rpcm5hbWUiLCAic3Bhd24iLCAibG9nIiwgInByb2Nlc3MiLCAiZnMiLCAicGF0aCIsICJvcyIsICJfX2Rpcm5hbWUiLCAicGF0aCIsICJsb2ciLCAiYXBwIiwgInBhdGgiLCAibG9nIiwgIl9fZGlybmFtZSIsICJwdWJsaWNCYXNlIiwgInBhdGgiLCAidCIsICJsb2ciLCAiYXBwIiwgImV4ZWMiLCAiZGlhbG9nIiwgImFwcCIsICJsb2ciLCAiZXhlYyIsICJvcyIsICJsb2ciLCAiaXNSZWFsRXJyb3IiLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAiY2xpcGJvYXJkIiwgInBhdGgiLCAiZnMiLCAiZXJyIiwgIndlYkNvbnRlbnRzIiwgIm9zIiwgImFwcCIsICJwdWJsaWNCYXNlIiwgImxvZyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAiZXhlY0FzeW5jIiwgInN1c3BpY2lvdXNLZXl3b3JkcyIsICJzdXNwaWNpb3VzUG9ydHMiLCAiY2hlY2tQcm9jZXNzZXMiLCAiY2hlY2tQb3J0cyIsICJydW5SZW1vdGVDaGVjayIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgInJ1blJlbW90ZUNoZWNrIiwgIl9fZGlybmFtZSIsICJjb25maWciLCAibG9nIiwgInJ1blJlbW90ZUNoZWNrIiwgImFnZW50IiwgImZzIiwgImpvaW4iLCAiaXBjTWFpbiIsICJ3ZWJDb250ZW50cyIsICJzY3JlZW4iLCAiZXJyIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImxvZyIsICJleGVjQXN5bmMiLCAibmFtZSIsICJwcGlkIiwgImFwcCIsICJsb2ciLCAiTWVudSIsICJfX2Rpcm5hbWUiLCAiZnMiLCAicGF0aCIsICJnYXRld2F5NHN5bmMiLCAiaXAiLCAid2ViQ29udGVudHMiLCAiQnJvd3NlcldpbmRvdyIsICJldmVudCIsICJ0b2dnbGVNYWNPU0xvY2tkb3duIiwgImRpYWxvZyIsICJnbG9iYWxTaG9ydGN1dCJdCn0K
