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
  showdevtools: false,
  useBundledJRE: true,
  bipIntegration: true,
  bipDemo: true,
  bipApiUrl: "https://localhost:8444",
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
  multicastServerAdrr: "239.1.1.1",
  hostip: "",
  // server.js
  gateway: true,
  virtualized: false,
  isPuavo: false,
  version: "2.0.0.1",
  buildDate: "20260306",
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
import log18 from "electron-log";
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
    this.serverstatus = {};
    this.clientinfo = {
      name: "DemoUser",
      token: false,
      lockedSection: 1,
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
      submissionnumber: 0,
      localVMHost: null,
      localVMState: null
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
        try {
          this.client.addMembership(this.MULTICAST_ADDR, config_default.hostip);
          log2.info(`multicastclient @ init: joined ${this.MULTICAST_ADDR} on iface ${config_default.hostip}`);
        } catch (e) {
          log2.error(`multicastclient @ init: addMembership failed for ${this.MULTICAST_ADDR} on ${config_default.hostip}`, e);
        }
        if (!this.gateway) {
          log2.warn("multicastclient @ init: No default gateway detected \u2013 joined multicast group on local interface");
        }
        log2.info(`multicastclient @ init: UDP MC Client listening on 0.0.0.0:${this.client.address().port} (hostip=${config_default.hostip})`);
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
import fs8 from "fs";
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
var gnomeShortcutConfig = {
  // window manager shortcuts (workspaces, window movement, app switcher, show desktop, etc.)
  wm: {
    schema: "org.gnome.desktop.wm.keybindings",
    critical: [
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
      "switch-to-workspace-4",
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
      "switch-input-source-backward",
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
    ],
    niceToHave: []
  },
  // shell level shortcuts (overview, app view, screenshots, notifications, etc.)
  shell: {
    schema: "org.gnome.shell.keybindings",
    critical: [
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
    ],
    niceToHave: []
  },
  // mutter compositor shortcuts that affect window tiling or monitor layout
  mutter: {
    schema: "org.gnome.mutter.keybindings",
    critical: ["rotate-monitor", "switch-monitor", "tab-popup-cancel", "tab-popup-select", "toggle-tiled-left", "toggle-tiled-right"],
    niceToHave: []
  },
  // wayland specific mutter shortcuts for switching virtual terminals or sessions (Ctrl+Alt+Fn)
  mutterWayland: {
    schema: "org.gnome.mutter.wayland.keybindings",
    critical: [
      "switch-to-session-1",
      "switch-to-session-2",
      "switch-to-session-3",
      "switch-to-session-4",
      "switch-to-session-5",
      "switch-to-session-6",
      "switch-to-session-7",
      "switch-to-session-8",
      "switch-to-session-9",
      "switch-to-session-10",
      "switch-to-session-11",
      "switch-to-session-12"
    ],
    niceToHave: []
  },
  // common dash-to-dock extension shortcuts for switching or raising apps
  dashToDock: {
    schema: "org.gnome.shell.extensions.dash-to-dock",
    critical: [
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
    ],
    niceToHave: []
  }
};
var isGnomeKeybindingDebugEnabled = process.env.NEXT_EXAM_DEBUG_GNOME === "1";
function logGsettingsValue(schema, key, phase) {
  if (!isGnomeKeybindingDebugEnabled) return;
  childProcess.execFile("gsettings", ["get", schema, key], (err, stdout) => {
    if (err) {
      log3.debug(`platformrestrictions @ ${phase}: failed to read ${schema} ${key}: ${err.message}`);
      return;
    }
    log3.debug(`platformrestrictions @ ${phase}: ${schema} ${key} = ${stdout.trim()}`);
  });
}
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
      const wmKeys = [...gnomeShortcutConfig.wm.critical, ...gnomeShortcutConfig.wm.niceToHave];
      for (let binding of wmKeys) {
        logGsettingsValue(gnomeShortcutConfig.wm.schema, binding, "enable-gnome-wm-before-set");
        childProcess.execFile("gsettings", ["set", gnomeShortcutConfig.wm.schema, binding, `['']`]);
        logGsettingsValue(gnomeShortcutConfig.wm.schema, binding, "enable-gnome-wm-after-set");
      }
      const waylandKeys = [...gnomeShortcutConfig.mutterWayland.critical, ...gnomeShortcutConfig.mutterWayland.niceToHave];
      for (let binding of waylandKeys) {
        logGsettingsValue(gnomeShortcutConfig.mutterWayland.schema, binding, "enable-gnome-wayland-before-set");
        childProcess.execFile("gsettings", ["set", gnomeShortcutConfig.mutterWayland.schema, binding, `['']`]);
        childProcess.execFile("dconf", ["write", `/org/gnome/mutter/wayland/keybindings/${binding}`, `['']`]);
        logGsettingsValue(gnomeShortcutConfig.mutterWayland.schema, binding, "enable-gnome-wayland-after-set");
      }
      const shellKeys = [...gnomeShortcutConfig.shell.critical, ...gnomeShortcutConfig.shell.niceToHave];
      for (let binding of shellKeys) {
        logGsettingsValue(gnomeShortcutConfig.shell.schema, binding, "enable-gnome-shell-before-set");
        childProcess.execFile("gsettings", ["set", gnomeShortcutConfig.shell.schema, binding, `['']`]);
        logGsettingsValue(gnomeShortcutConfig.shell.schema, binding, "enable-gnome-shell-after-set");
      }
      const mutterKeys = [...gnomeShortcutConfig.mutter.critical, ...gnomeShortcutConfig.mutter.niceToHave];
      for (let binding of mutterKeys) {
        logGsettingsValue(gnomeShortcutConfig.mutter.schema, binding, "enable-gnome-mutter-before-set");
        childProcess.execFile("gsettings", ["set", gnomeShortcutConfig.mutter.schema, binding, `['']`]);
        logGsettingsValue(gnomeShortcutConfig.mutter.schema, binding, "enable-gnome-mutter-after-set");
      }
      const dockKeys = [...gnomeShortcutConfig.dashToDock.critical, ...gnomeShortcutConfig.dashToDock.niceToHave];
      for (let binding of dockKeys) {
        logGsettingsValue(gnomeShortcutConfig.dashToDock.schema, binding, "enable-gnome-dock-before-set");
        childProcess.execFile("gsettings", ["set", gnomeShortcutConfig.dashToDock.schema, binding, `['']`]);
        logGsettingsValue(gnomeShortcutConfig.dashToDock.schema, binding, "enable-gnome-dock-after-set");
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
      const child2 = childProcess.exec("kstart5 plasmashell &", { detached: true, stdio: "ignore" });
      child2.unref();
    }
  });
  const wmKeys = [...gnomeShortcutConfig.wm.critical, ...gnomeShortcutConfig.wm.niceToHave];
  for (let binding of wmKeys) {
    childProcess.execFile("gsettings", ["reset", gnomeShortcutConfig.wm.schema, `${binding}`]);
  }
  const waylandKeys = [...gnomeShortcutConfig.mutterWayland.critical, ...gnomeShortcutConfig.mutterWayland.niceToHave];
  for (let binding of waylandKeys) {
    childProcess.execFile("gsettings", ["reset", gnomeShortcutConfig.mutterWayland.schema, binding]);
    childProcess.execFile("dconf", ["reset", `/org/gnome/mutter/wayland/keybindings/${binding}`]);
  }
  const shellKeys = [...gnomeShortcutConfig.shell.critical, ...gnomeShortcutConfig.shell.niceToHave];
  for (let binding of shellKeys) {
    childProcess.execFile("gsettings", ["reset", gnomeShortcutConfig.shell.schema, `${binding}`]);
  }
  const mutterKeys = [...gnomeShortcutConfig.mutter.critical, ...gnomeShortcutConfig.mutter.niceToHave];
  for (let binding of mutterKeys) {
    childProcess.execFile("gsettings", ["reset", gnomeShortcutConfig.mutter.schema, `${binding}`]);
  }
  const dockKeys = [...gnomeShortcutConfig.dashToDock.critical, ...gnomeShortcutConfig.dashToDock.niceToHave];
  for (let binding of dockKeys) {
    childProcess.execFile("gsettings", ["reset", gnomeShortcutConfig.dashToDock.schema, `${binding}`]);
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
        const child2 = childProcess2.exec("start explorer.exe", { detached: true, stdio: "ignore" });
        child2.unref();
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
var appsToClose = ["whatsapp", "Google Chrome", "chrome", "google-chrome", "Microsoft Edge", "msedge", "firefox", "safari", "brave", "opera", "chatgpt", "ChatGPT", "NortonSecurity", "NAV", "Teams", "ms-teams", "zoom.us", "Microsoft Teams", "discord", "zoom", "teams", "teamviewer", "skypeforlinux", "skype", "anydesk"];
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
      if (displays.length <= 1) return;
      let examReady = false;
      if (this.examwindow && !this.examwindow.isDestroyed()) {
        let retries = 0;
        const maxRetries = 10;
        while (!this.examwindow.isVisible() && retries < maxRetries) {
          await this.sleep(100);
          retries++;
        }
        if (this.examwindow.isVisible()) {
          examReady = true;
          await this.sleep(200);
        }
      }
      if (!examReady) {
        log7.info("windowhandler @ initBlockWindows: exam window not ready, skipping block window creation");
        return;
      }
      this.blockwindows = this.blockwindows.filter((blockwin) => blockwin && !blockwin.isDestroyed());
      const usedDisplayIds = /* @__PURE__ */ new Set();
      if (this.examDisplayId !== void 0 && this.examDisplayId !== null) {
        usedDisplayIds.add(this.examDisplayId);
      }
      if (this.examwindow && !this.examwindow.isDestroyed()) {
        try {
          const bounds = this.examwindow.getBounds();
          const display = screen.getDisplayMatching(bounds);
          if (display && display.id !== void 0 && display.id !== null) {
            usedDisplayIds.add(display.id);
            log7.info(`windowhandler @ initBlockWindows: exam window is on display ${display.id}`);
          }
        } catch (err) {
          log7.error(`windowhandler @ initBlockWindows: error getting exam window display: ${err}`);
        }
      }
      for (const blockwin of this.blockwindows) {
        try {
          const bounds = blockwin.getBounds();
          const display = screen.getDisplayMatching(bounds);
          if (display && display.id !== void 0 && display.id !== null) {
            usedDisplayIds.add(display.id);
            log7.info(`windowhandler @ initBlockWindows: block window found on display ${display.id}`);
          }
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
    if (examtype !== "rdp" && examtype !== "website" && examtype !== "gforms" && examtype !== "eduvidual" && examtype !== "editor" && examtype !== "math" && examtype !== "microsoft365" && examtype !== "activesheets" && examtype !== "localvm" || !token) {
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
    const examTypesWithPdfInHeader = ["gforms", "website", "eduvidual", "editor", "rdp", "microsoft365", "activesheets", "math", "localvm"];
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
    let effectiveSection = serverstatus.allowSectionSwitch ? this.multicastClient.clientinfo.lockedSection : serverstatus.lockedSection;
    if (serverstatus.examSections[effectiveSection].examtype === "microsoft365") {
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
      title: "Next-Exam-Student",
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
          path2.join("/home/valueerror/STUFF/DEV/00-Next-Exam-DEV/next-exam/student/.quasar/dev-electron/preload", "electron-preload.cjs")
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
import fs7 from "fs";
import archiver from "archiver";
import extract from "extract-zip";
import { join as join5 } from "path";
import { screen as screen2, ipcMain as ipcMain2, app as app7, BrowserWindow as BrowserWindow2, webContents as webContents3 } from "electron";

// src-electron/main/scripts/ipchandler.js
import path7 from "path";
import fs6 from "fs";
import ip from "ip";
import net2 from "net";

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
    username: "Your name",
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
    outdatedinfo: "Please install the same version as the exam server!",
    wlanNopermissionsTitle: "Location permission required",
    wlanNopermissionsText: "Windows requires location permissions to retrieve WLAN information. Please enable location services in Privacy & Security settings."
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
    justify: "justify",
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
    close: "Close",
    sectionSwitchTitle: "Switch section",
    sectionSwitchText: "Are you sure you want to switch to the new section?",
    lang_de: "German",
    lang_en_gb: "English (UK)",
    lang_en_us: "English (US)",
    lang_fr: "French",
    lang_es: "Spanish",
    lang_it: "Italian",
    lang_sl: "Slovenian"
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
  },
  dashboard: {
    retry: "Retry"
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
    username: "Dein Name",
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
    outdatedinfo: "Bitte installieren sie die selbe Version wie am Pr\xFCfungsserver!",
    wlanNopermissionsTitle: "Standortberechtigung erforderlich",
    wlanNopermissionsText: "Windows ben\xF6tigt Standortberechtigungen, um WLAN-Informationen abzurufen. Bitte aktivieren Sie die Positionsdienste in den Datenschutz- und Sicherheitseinstellungen."
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
    justify: "Blocksatz",
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
    close: "Schlie\xDFen",
    sectionSwitchTitle: "Pr\xFCfungsabschnitt wechseln",
    sectionSwitchText: "Sind Sie sicher, dass Sie zum neuen Abschnitt wechseln m\xF6chten?",
    lang_de: "Deutsch",
    lang_en_gb: "Englisch (UK)",
    lang_en_us: "Englisch (US)",
    lang_fr: "Franz\xF6sisch",
    lang_es: "Spanisch",
    lang_it: "Italienisch",
    lang_sl: "Slowenisch"
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
  },
  dashboard: {
    retry: "Erneut versuchen"
  }
};

// src/locales/locales.ts
var i18n = createI18n({
  locale: "de",
  fallbackLocale: "en",
  legacy: false,
  messages: {
    en: en_default,
    de: de_default
  }
});
var locales_default = i18n;

// src-electron/main/scripts/ipchandler.js
import { ipcMain, clipboard as clipboard2, app as app6, webContents as webContents2 } from "electron";
import { gateway4sync } from "default-gateway";
import os4 from "os";
import log15 from "electron-log";

// src-electron/main/scripts/webFilter.js
function getUrlAllowResult(targetUrl, allowedUrl, blockSubdomains, blockSubfolders) {
  if (!targetUrl || !allowedUrl) {
    return { allowed: false, reason: "missing or invalid target or allowed URL", domainMatched: false };
  }
  let allowedUrlObj;
  let targetUrlObj;
  try {
    let normalizedAllowed = allowedUrl;
    if (!normalizedAllowed.startsWith("http://") && !normalizedAllowed.startsWith("https://")) {
      normalizedAllowed = "https://" + normalizedAllowed;
    }
    allowedUrlObj = new URL(normalizedAllowed);
  } catch (error) {
    return { allowed: false, reason: "invalid allowed URL", domainMatched: false };
  }
  try {
    targetUrlObj = new URL(targetUrl);
  } catch (error) {
    return { allowed: false, reason: "invalid target URL", domainMatched: false };
  }
  const allowedHostname = allowedUrlObj.hostname.toLowerCase();
  const targetHostname = targetUrlObj.hostname.toLowerCase();
  const allowedBase = allowedHostname.replace(/^www\./, "");
  const targetBase = targetHostname.replace(/^www\./, "");
  const targetIsSameOrSubdomainOfAllowed = targetBase === allowedBase || targetBase.endsWith("." + allowedBase);
  if (blockSubdomains) {
    if (targetHostname !== allowedHostname && targetHostname !== "www." + allowedHostname && allowedHostname !== "www." + targetHostname) {
      return { allowed: false, reason: "subdomain or different domain not allowed (blockSubdomains)", domainMatched: targetIsSameOrSubdomainOfAllowed };
    }
  } else {
    if (targetBase !== allowedBase && !targetBase.endsWith("." + allowedBase)) {
      return { allowed: false, reason: "domain not in allowed URLs", domainMatched: false };
    }
  }
  if (blockSubfolders) {
    const allowedPath = allowedUrlObj.pathname.replace(/\/+$/, "") || "/";
    const targetPath = targetUrlObj.pathname.replace(/\/+$/, "") || "/";
    if (allowedPath === "/") {
      if (targetPath !== "/") {
        return { allowed: false, reason: "subfolder not allowed (only root allowed, blockSubfolders)", domainMatched: true };
      }
    } else {
      if (!targetPath.startsWith(allowedPath)) {
        return { allowed: false, reason: "path not under allowed path (blockSubfolders)", domainMatched: true };
      }
    }
  }
  return { allowed: true };
}

// src-electron/main/scripts/ipchandler.js
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

// src-electron/main/scripts/switchExamSection.js
import log13 from "electron-log";
import fs4 from "fs";
import { webContents } from "electron";
async function switchExamSection(CommunicationHandler, serverstatus, newSectionNumber) {
  const currentLockedSection = multicastclient_default.clientinfo.lockedSection;
  const newLockedSection = newSectionNumber;
  const examDir = config_default.examdirectory;
  log13.warn(`switchExamSection: changing section to ${newLockedSection} ${serverstatus.examSections[newLockedSection].sectionname} , Examtype: ${serverstatus.examSections[newLockedSection].examtype}`);
  if (multicastclient_default.clientinfo.examtype === "editor") {
    log13.info("switchExamSection: sending exam to teacher (final submit)");
    let pdf = await CommunicationHandler.getBase64PDF(multicastclient_default.clientinfo.submissionnumber, serverstatus.examSections[currentLockedSection].sectionname);
    if (pdf.status === "success") {
      CommunicationHandler.sendBase64PDFtoTeacher(pdf.base64pdf, currentLockedSection);
    }
  }
  CommunicationHandler.sendToTeacher();
  await CommunicationHandler.sleep(2e3);
  multicastclient_default.clientinfo.examtype = serverstatus.examSections[newLockedSection].examtype;
  multicastclient_default.clientinfo.lockedSection = newLockedSection;
  try {
    if (fs4.existsSync(examDir) && currentLockedSection != null && currentLockedSection !== void 0) {
      log13.debug(`switchExamSection: Saving content from examDir to section ${currentLockedSection}`);
      const savePath = `${examDir}/${currentLockedSection}`;
      if (!fs4.existsSync(savePath)) {
        fs4.mkdirSync(savePath, { recursive: true });
      }
      const files = fs4.readdirSync(examDir);
      log13.info(`switchExamSection: Found ${files.length} items in examDir to save`);
      let filesSaved = 0;
      for (const file of files) {
        const oldPath = `${examDir}/${file}`;
        const stat = fs4.statSync(oldPath);
        if (stat.isFile()) {
          const newPath = `${savePath}/${file}`;
          fs4.copyFileSync(oldPath, newPath);
          fs4.unlinkSync(oldPath);
          filesSaved++;
          log13.info(`switchExamSection: Saved file ${file} to section ${currentLockedSection}`);
        } else {
          log13.info(`switchExamSection: Skipping non-file (folder) item ${file} in examDir`);
        }
      }
      log13.info(`switchExamSection: Successfully saved ${filesSaved} files to section ${currentLockedSection}`);
    } else {
      log13.warn(`switchExamSection: Skipping save - examDir exists: ${fs4.existsSync(examDir)}, currentLockedSection: ${currentLockedSection}`);
    }
    if (newLockedSection != null && newLockedSection !== void 0) {
      log13.debug(`switchExamSection: Loading content from section ${newLockedSection} to examDir`);
      const loadPath = `${examDir}/${newLockedSection}`;
      if (fs4.existsSync(loadPath)) {
        const filesToLoad = fs4.readdirSync(loadPath);
        log13.info(`switchExamSection: Found ${filesToLoad.length} items in section ${newLockedSection} directory`);
        let filesCopied = 0;
        for (const file of filesToLoad) {
          const sourcePath = `${loadPath}/${file}`;
          const destPath = `${examDir}/${file}`;
          const stat = fs4.statSync(sourcePath);
          if (stat.isFile()) {
            fs4.copyFileSync(sourcePath, destPath);
            filesCopied++;
            log13.info(`switchExamSection: Copied file ${file} from section ${newLockedSection} to examDir`);
          } else {
            log13.warn(`switchExamSection: Skipping non-file item ${file} in section ${newLockedSection} directory`);
          }
        }
        log13.info(`switchExamSection: Successfully copied ${filesCopied} files from section ${newLockedSection} to examDir`);
      } else {
        log13.info(`switchExamSection: New locked section directory ${newLockedSection} does not exist. Starting with a clean state.`);
      }
    } else {
      log13.warn(`switchExamSection: newLockedSection is falsy (${newLockedSection}), skipping file load`);
    }
  } catch (error) {
    log13.error(`switchExamSection: Error during folder operation - ${error}`);
    log13.error(`switchExamSection: Error stack: ${error.stack}`);
    log13.error(`switchExamSection: currentLockedSection: ${currentLockedSection}, newLockedSection: ${newLockedSection}, examDir: ${examDir}`);
  }
  if (windowhandler_default.examwindow) {
    if (config_default.development) {
      webContents.getAllWebContents().forEach((wc) => {
        if (wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
          log13.info("switchExamSection: destroying devtools window");
          wc.closeDevTools();
        }
      });
    }
    windowhandler_default.examwindow.once("closed", () => {
      windowhandler_default.examwindow = null;
      CommunicationHandler.startExam(serverstatus);
    });
    windowhandler_default.examwindow.close();
    windowhandler_default.examwindow.destroy();
  }
}

// src-electron/main/scripts/vncproxy.js
import { spawn as spawn3 } from "child_process";
import net from "net";
import { fileURLToPath as fileURLToPath2 } from "url";
import path6 from "path";
import fs5 from "fs";
import log14 from "electron-log";
var child = null;
var currentPort = null;
function getHelperPath() {
  const __filename = fileURLToPath2(import.meta.url);
  const __dirname10 = path6.dirname(__filename);
  const nextToMain = path6.join(__dirname10, "vncproxy-helper.cjs");
  if (fs5.existsSync(nextToMain)) return nextToMain;
  return path6.join(process.cwd(), "src-electron", "main", "scripts", "vncproxy-helper.cjs");
}
async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", (err) => {
      server.close();
      reject(err);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}
async function waitForPort(port, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = new net.Socket();
      const finish = (open) => {
        socket.destroy();
        resolve(open);
      };
      socket.setTimeout(300);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
      try {
        socket.connect(port, "127.0.0.1");
      } catch (err) {
        finish(false);
      }
    });
    if (isOpen) return true;
  }
  return false;
}
async function startProxy({ host, port }) {
  const scriptPath = getHelperPath();
  if (child && !child.killed && currentPort) {
    log14.info("vncproxy @ startProxy: reusing existing helper on ws port", currentPort);
    return currentPort;
  }
  try {
    currentPort = await getFreePort();
  } catch (err) {
    log14.error("vncproxy @ startProxy: failed to obtain free port", err);
    currentPort = null;
    return null;
  }
  if (!currentPort) {
    log14.error("vncproxy @ startProxy: no free port available for proxy");
    return null;
  }
  try {
    child = spawn3(process.execPath, [scriptPath, host, String(port), String(currentPort)], {
      stdio: "inherit"
    });
    child.on("exit", (code, signal) => {
      log14.info(`vncproxy-helper exited with code ${code}, signal ${signal}`);
      child = null;
      currentPort = null;
    });
    log14.info("vncproxy @ startProxy: helper spawned for target", host, port, "on ws port", currentPort);
  } catch (err) {
    log14.error("vncproxy @ startProxy: failed to spawn helper", err);
    child = null;
    currentPort = null;
    return null;
  }
  const ready = await waitForPort(currentPort, 3e3);
  if (!ready) {
    log14.error("vncproxy @ startProxy: helper did not start listening on port", currentPort);
    if (child && !child.killed) {
      try {
        child.kill();
      } catch (e) {
        log14.error("vncproxy @ startProxy: error killing non-listening helper", e);
      }
    }
    child = null;
    currentPort = null;
    return null;
  }
  return currentPort;
}

// src-electron/main/scripts/ipchandler.js
var { t } = locales_default.global;
var __dirname7 = import.meta.dirname;
var checkPortOpen = (port, host = "127.0.0.1", timeout = 1500) => {
  return new Promise((resolve) => {
    const socket = new net2.Socket();
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
      log15.info(`ipchandler @ set-new-locale: setting new locale to ${locale}`);
      locales_default.locale = locale;
      updateSystemTray(locales_default.locale);
    });
    ipcMain.handle("getExamMaterials", async (event) => {
      let clientinfo = this.multicastClient.clientinfo;
      let servername = clientinfo.servername;
      let serverip = clientinfo.serverip;
      let token = clientinfo.token;
      let payload = {
        group: clientinfo.group,
        lockedSection: clientinfo.lockedSection
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
        }).catch((err) => log15.error(`ipchandler @ getExamMaterials: ${err}`));
        return examMaterials;
      }
    });
    ipcMain.handle("start-proxy", async (event, payload) => {
      try {
        const { host, port } = payload || {};
        if (!host || !port) {
          throw new Error("Invalid proxy target");
        }
        const result = await startProxy({ host, port });
        return { port: result };
      } catch (err) {
        log15.error("ipchandler @ start-proxy:", err);
        return { port: null, error: err.message };
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
      const guest = webContents2.fromId(Number(guestId));
      if (!guest || guest.isDestroyed?.()) return false;
      guest.removeAllListeners("will-navigate");
      const normalizedUrls = allowedUrls.map((entry) => {
        if (typeof entry === "object" && entry.url) {
          return entry;
        }
        return { url: String(entry), blockSubdomains: false, blockSubfolders: false };
      });
      const getAllowResult = (targetUrl) => {
        if (!targetUrl) return { allowed: false, reason: "no target URL" };
        if (checkCommonExceptions(String(targetUrl).toLowerCase())) return { allowed: true };
        let reasonFromMatchingEntry = null;
        for (const entry of normalizedUrls) {
          const result = getUrlAllowResult(targetUrl, entry.url, entry.blockSubdomains, entry.blockSubfolders);
          if (result.allowed) return { allowed: true };
          if (result.domainMatched) {
            reasonFromMatchingEntry = result.reason;
            break;
          }
        }
        return { allowed: false, reason: reasonFromMatchingEntry || "domain not in allowed URLs" };
      };
      guest.setWindowOpenHandler(({ url }) => {
        const { allowed, reason } = getAllowResult(url);
        if (allowed) {
          log15.info("ipchandler @ start-blocking-for-webview: allowed window.open to", url);
          guest.loadURL(url);
          return { action: "deny" };
        } else {
          log15.warn("ipchandler @ start-blocking-for-webview: blocked window.open to", url, "-", reason);
          return { action: "deny" };
        }
      });
      guest.on("will-navigate", (e, url) => {
        const { allowed, reason } = getAllowResult(url);
        if (!allowed) {
          log15.warn("ipchandler @ start-blocking-for-webview: blocked navigation to", url, "-", reason);
          e.preventDefault();
          guest.stop();
        } else {
          log15.info("ipchandler @ start-blocking-for-webview: allowed navigation to", url);
        }
      });
      return true;
    });
    ipcMain.handle("start-blocking-for-website-webview", (event, { guestId, mode, allowedDomain, baseUrl, blockSubdomains, blockSubfolders, moodleTestId, moodleDomain, gformsTestId }) => {
      const guest = webContents2.fromId(Number(guestId));
      if (!guest || guest.isDestroyed?.()) return false;
      guest.removeAllListeners("will-navigate");
      const getAllowResult = (targetUrl) => {
        if (mode === "website") {
          if (!targetUrl) return { allowed: true };
          if (checkCommonExceptions(String(targetUrl).toLowerCase())) return { allowed: true };
          const result = getUrlAllowResult(targetUrl, baseUrl || allowedDomain, !!blockSubdomains, !!blockSubfolders);
          return result;
        } else if (mode === "eduvidual") {
          if (targetUrl.includes(moodleTestId)) return { allowed: true };
          if (targetUrl.includes("startattempt.php") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("processattempt.php") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("logout") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("login") && targetUrl.includes("eduvidual")) return { allowed: true };
          if (targetUrl.includes("login") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("policy") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("auth") && targetUrl.includes(moodleDomain)) return { allowed: true };
          if (targetUrl.includes("SAML2") && targetUrl.includes("portal.tirol.gv.at")) return { allowed: true };
          if (targetUrl.includes("login") && targetUrl.includes("portal.tirol.gv.at")) return { allowed: true };
          if (targetUrl.includes("login") && targetUrl.includes("tirol.gv.at")) return { allowed: true };
          return { allowed: false, reason: "not in eduvidual allow list" };
        } else if (mode === "forms") {
          if (targetUrl.includes(gformsTestId)) return { allowed: true };
          if (targetUrl.includes("docs.google.com") && targetUrl.includes("formResponse")) return { allowed: true };
          if (targetUrl.includes("docs.google.com") && targetUrl.includes("viewscore")) return { allowed: true };
          return { allowed: false, reason: "not in forms allow list" };
        } else if (mode === "rdp") {
          return { allowed: true };
        }
        const allowed = checkCommonExceptions(targetUrl);
        return allowed ? { allowed: true } : { allowed: false, reason: "not in common exceptions" };
      };
      guest.setWindowOpenHandler(({ url }) => {
        const { allowed, reason } = getAllowResult(url);
        if (allowed) {
          log15.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed window.open to`, url);
          guest.loadURL(url);
          return { action: "deny" };
        } else {
          log15.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked window.open to`, url, "-", reason);
          return { action: "deny" };
        }
      });
      guest.on("will-navigate", (e, url) => {
        const { allowed, reason } = getAllowResult(url);
        if (!allowed) {
          log15.warn(`ipchandler @ start-blocking-for-website-webview [${mode}]: blocked navigation to`, url, "-", reason);
          e.preventDefault();
          guest.stop();
        } else {
          log15.info(`ipchandler @ start-blocking-for-website-webview [${mode}]: allowed navigation to`, url);
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
      log15.info("ipchandler @ locallockdown: locking down client without teacher connection", args);
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
      this.multicastClient.serverstatus = serverstatus;
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
      log15.info("ipchandler @ loginBiP: opening bip window. testenvironment:", biptest);
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
        log15.warn(`ipchandler @ focuslost: mouseleave event was triggered but target is allowed`);
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
      log15.info(`ipchandler @ gracefullyexit: gracefully leaving locked exam mode`);
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
        log15.error("ipcHandler @ checkhostip: multicastclient not running");
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
          log15.error("ipcHandler @ checkhostip: Unable to determine ip address", e);
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
          log15.error("ipcHandler @ checkhostip: Error initializing multicast client", err);
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
      const htmlfile = path7.join(this.config.examdirectory, htmlfilename);
      if (htmlContent) {
        try {
          fs6.writeFile(htmlfile, htmlContent, (err) => {
            if (err) {
              log15.error(`ipchandler @ storeHTML: ${err.message}`);
              let alternatepath = `${htmlfile}-${this.multicastClient.clientinfo.token}.bak`;
              log15.warn("ipchandler @ storeHTML: trying to write file as:", alternatepath);
              fs6.writeFile(alternatepath, htmlContent, function(err2) {
                if (err2) {
                  log15.error(err2.message);
                  log15.error("ipchandler @ storeHTML: giving up");
                  event.reply("fileerror", { sender: "client", message: err2, status: "error" });
                } else {
                  log15.info("ipchandler @ storeHTML: success!");
                  event.reply("loadfilelist");
                }
              });
            }
            event.reply("loadfilelist");
          });
        } catch (err) {
          log15.error(err);
          event.returnValue = { sender: "client", message: err, status: "error" };
        }
      }
    });
    ipcMain.handle("getPDFbase64", async (event, args) => {
      log15.info("ipchandler @ getPDFbase64: getting base64 encoded pdf");
      this.multicastClient.clientinfo.submissionnumber = args.submissionnumber + 1;
      let result = await this.CommunicationHandler.getBase64PDF(args.submissionnumber, args.sectionname, args.printBackground);
      return result;
    });
    ipcMain.on("printpdf", (event, args) => {
      if (!this.multicastClient?.clientinfo?.exammode) {
        log15.warn("ipchandler @ printpdf: exammode is false - skipping print");
        return;
      }
      if (this.isPrintingPdf) {
        log15.warn("ipchandler @ printpdf: print already in progress - skipping new request");
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
        const pdffilepath = path7.join(this.config.examdirectory, pdffilename);
        const alternatefilename = `${pdffilename}-aux.pdf`;
        const alternatebackupfilename = `${pdffilename}-old.pdf`;
        const alternatepath = path7.join(this.config.examdirectory, alternatefilename);
        try {
          const files = fs6.readdirSync(this.config.examdirectory);
          files.forEach((file) => {
            if (file === alternatefilename) {
              const newPath = path7.join(this.config.examdirectory, alternatebackupfilename);
              fs6.renameSync(alternatepath, newPath);
            }
          });
        } catch (err) {
          log15.error(`ipchandler @ printpdf: ${err.message}`);
        }
        const examWindow = this.WindowHandler.examwindow;
        const webContents4 = examWindow?.webContents;
        if (!webContents4) {
          log15.error("ipchandler @ printpdf: no webContents found for examwindow");
          event.reply("fileerror", { sender: "client", message: "no webContents found for examwindow", status: "error" });
          return;
        }
        this.isPrintingPdf = true;
        const pdfTitle = args.filename ? args.filename : `${this.multicastClient.clientinfo.name} - ${args.servername || this.multicastClient.clientinfo.servername || ""}`;
        const escapedTitle = pdfTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'");
        webContents4.executeJavaScript(`document.title = "${escapedTitle}"`).then(() => {
          return webContents4.printToPDF(options);
        }).then((data) => {
          try {
            if (fs6.existsSync(pdffilepath)) {
              fs6.unlinkSync(pdffilepath);
            }
          } catch (err) {
            log15.error(`ipchandler @ printpdf: ${err.message}`);
          }
          fs6.writeFile(pdffilepath, data, (err) => {
            if (err) {
              log15.warn(`ipchandler @ printpdf: ${err.message} - writing file as: ${alternatepath} `);
              try {
                if (fs6.existsSync(alternatepath)) {
                  fs6.unlinkSync(alternatepath);
                }
              } catch (err2) {
                log15.error(`ipchandler @ printpdf (alternativer Pfad): ${err2.message}`);
              }
              fs6.writeFile(alternatepath, data, (err2) => {
                if (err2) {
                  log15.error(err2.message);
                  log15.error("ipchandler @ printpdf: giving up");
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
          log15.error(`ipchandler @ printpdf: ${error.message}`);
          event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
        }).finally(() => {
          this.isPrintingPdf = false;
        });
      }
    });
    ipcMain.on("saveActivesheetsBak", (event, args) => {
      try {
        const bakFilename = args.filename ? `${args.filename}.bak` : `${this.multicastClient.clientinfo.name}.bak`;
        const bakFilePath = path7.join(this.config.examdirectory, bakFilename);
        const jsonData = JSON.stringify(args.formData, null, 2);
        fs6.writeFileSync(bakFilePath, jsonData, "utf8");
        log15.info(`ipchandler @ saveActivesheetsBak: saved form data to ${bakFilename}`);
      } catch (error) {
        log15.error(`ipchandler @ saveActivesheetsBak: ${error.message}`);
        event.reply("fileerror", { sender: "client", message: error.message, status: "error" });
      }
    });
    ipcMain.handle("getinfoasync", async (event) => {
      let serverstatus = false;
      if (this.WindowHandler.examwindow) {
        serverstatus = this.multicastClient.serverstatus;
      }
      if (!this.multicastClient.clientinfo.exammode) {
        const workdir = path7.join(config2.examdirectory, "/");
        try {
          await fs6.promises.mkdir(workdir, { recursive: true });
          const filelist = (await fs6.promises.readdir(workdir, { withFileTypes: true })).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
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
    ipcMain.handle("switch-exam-section", async (event, sectionNumber) => {
      const serverstatus = this.WindowHandler.examwindow?.serverstatus;
      if (!serverstatus?.useExamSections || !serverstatus?.allowSectionSwitch) return;
      if (this.multicastClient.clientinfo.lockedSection === sectionNumber) return;
      log15.info(`ipchandler @ switch-exam-section: switching to section ${sectionNumber}`);
      await switchExamSection(this.CommunicationHandler, serverstatus, sectionNumber);
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
          log15.info(`ipchandler @ register: successfully registered at ${servername} @ ${serverip} as ${clientname}`);
          event.returnValue = data;
          let uniqueexamName = `${servername}-${pin}`;
          config2.examdirectory = path7.join(config2.workdirectory, uniqueexamName);
          if (!fs6.existsSync(config2.examdirectory)) {
            fs6.mkdirSync(config2.examdirectory, { recursive: true });
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
        log15.error(`ipchandler @ register: ${errorMessage}`);
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
      const ggbFilePath = path7.join(this.config.examdirectory, filename);
      if (content) {
        const fileData = Buffer.from(content, "base64");
        try {
          fs6.writeFileSync(ggbFilePath, fileData);
          if (reason === "teacherrequest") {
            this.CommunicationHandler.sendToTeacher();
          }
          return { sender: "client", message: t("data.filestored"), status: "success" };
        } catch (err) {
          this.WindowHandler.examwindow.webContents.send("fileerror", err);
          log15.error(`ipchandler @ saveGGB: ${err}`);
          return { sender: "client", message: err, status: "error" };
        }
      }
    });
    ipcMain.handle("loadGGB", (event, filename) => {
      const ggbFilePath = path7.join(this.config.examdirectory, filename);
      try {
        const fileData = fs6.readFileSync(ggbFilePath);
        const base64GgbFile = fileData.toString("base64");
        return { sender: "client", content: base64GgbFile, status: "success" };
      } catch (error) {
        return { sender: "client", content: false, status: "error" };
      }
    });
    ipcMain.handle("getpdfasync", (event, filename, image = false) => {
      const workdir = path7.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path7.join(workdir, filename);
        try {
          let data = fs6.readFileSync(filepath);
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
      const workdir = path7.join(config2.examdirectory, "/");
      if (filename && !publicdir) {
        let filepath = path7.join(workdir, filename);
        const audioData = fs6.readFileSync(filepath);
        return audioData.toString("base64");
      }
      if (filename && publicdir) {
        const publicBase2 = platformDispatcher_default.publicBase;
        let filepath = path7.join(publicBase2, filename);
        const audioData = fs6.readFileSync(filepath);
        return audioData.toString("base64");
      }
      return false;
    });
    ipcMain.handle("getfilesasync", async (event, filename, audio = false, docx = false) => {
      const workdir = path7.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path7.join(workdir, filename);
        if (audio == true) {
          const audioData = fs6.readFileSync(filepath);
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
            let data = fs6.readFileSync(filepath, "utf8");
            return data;
          } catch (err) {
            log15.error(`ipchandler @ getfilesasync: ${err}`);
            return false;
          }
        }
      } else {
        try {
          if (!fs6.existsSync(workdir)) {
            fs6.mkdirSync(workdir, { recursive: true });
          }
          let filelist = fs6.readdirSync(workdir, { withFileTypes: true }).filter((dirent) => dirent.isFile()).map((dirent) => dirent.name);
          let files = [];
          filelist.forEach((file) => {
            let modified = fs6.statSync(path7.join(workdir, file)).mtime;
            let mod = modified.getTime();
            if (path7.extname(file).toLowerCase() === ".pdf") {
              files.push({ name: file, type: "pdf", mod });
            } else if (path7.extname(file).toLowerCase() === ".bak") {
              files.push({ name: file, type: "bak", mod });
            } else if (path7.extname(file).toLowerCase() === ".docx") {
              files.push({ name: file, type: "docx", mod });
            } else if (path7.extname(file).toLowerCase() === ".ggb") {
              files.push({ name: file, type: "ggb", mod });
            } else if (path7.extname(file).toLowerCase() === ".mp3" || path7.extname(file).toLowerCase() === ".ogg" || path7.extname(file).toLowerCase() === ".wav") {
              files.push({ name: file, type: "audio", mod });
            } else if (path7.extname(file).toLowerCase() === ".jpg" || path7.extname(file).toLowerCase() === ".png" || path7.extname(file).toLowerCase() === ".gif") {
              files.push({ name: file, type: "image", mod });
            }
          });
          this.multicastClient.clientinfo.numberOfFiles = filelist.length;
          return files;
        } catch (err) {
          log15.error(`ipchandler @ getfilesasync: ${err}`);
          return false;
        }
      }
    });
    ipcMain.handle("getbackupfile", async (event, filename) => {
      log15.info(`ipchandler @ getbackupfile: Request received for filename: ${filename}`);
      const workdir = path7.join(config2.examdirectory, "/");
      if (filename) {
        let filepath = path7.join(workdir, filename);
        log15.info(`ipchandler @ getbackupfile: Full file path: ${filepath}`);
        try {
          if (!fs6.existsSync(filepath)) {
            log15.warn(`ipchandler @ getbackupfile: backup file not found: ${filepath}`);
            return false;
          }
          log15.info(`ipchandler @ getbackupfile: backup file exists, reading content`);
          let data = fs6.readFileSync(filepath, "utf8");
          log15.info(`ipchandler @ getbackupfile: Successfully read backup file, content length: ${data.length}`);
          return data;
        } catch (err) {
          log15.error(`ipchandler @ getbackupfile: Error reading backup file: ${err}`);
          log15.error(`ipchandler @ getbackupfile: Error stack: ${err.stack}`);
          return false;
        }
      } else {
        log15.warn(`ipchandler @ getbackupfile: no filename provided`);
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
        pdfPath = path7.join(platformDispatcher_default.publicBase, pdfFilename);
        if (!fs6.existsSync(pdfPath)) {
          log15.warn(`ipchandler @ getPdfFromPublic: PDF not found at: ${pdfPath}`);
          return null;
        }
        const buffer = fs6.readFileSync(pdfPath);
        return buffer.toString("base64");
      } catch (error) {
        log15.error(`ipchandler @ getPdfFromPublic: Error: ${error.message}`, error);
        return null;
      }
    });
  }
  isVirtualMachine() {
    const VENDORS = /(oracle|virtualbox|vmware|kvm|qemu|xen|innotek|parallels|microsoft|hyper-v|bhyve|red hat|redhat|bochs|bhyve|openstack|cloud|amazon|google|azure)/i;
    const warnAndReturn = (reason) => {
      log15.warn(`ipchandler @ isVirtualMachine: Verdacht auf VM - ${reason}`);
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
import { execSync as execSync3 } from "child_process";
import log16 from "electron-log";
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
var shell = (cmd) => {
  return execSync3(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
};
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
    log16.debug("communicationhandler @ setupImageWorker: ImageWorker initialized. Using " + platformDispatcher_default.workerFileName);
    this.worker.on("error", (error) => {
      log16.error("communicationhandler @ setupImageWorker: Worker error:", error);
    });
    this.worker.on("exit", (code) => {
      if (code !== 0) {
        this.workerFails += 1;
        if (this.workerFails > 4) {
          this.useWorker = false;
          log16.error("communicationhandler @ setupImageWorker: Worker failed 5 times - switching to no processing");
        } else {
          this.setupImageWorker();
        }
      }
    });
  }
  // start local VirtualBox VM and update clientinfo.localVMHost/localVMState
  async startLocalVMAndResolveHost(vmName) {
    this.multicastClient.clientinfo.localVMHost = null;
    this.multicastClient.clientinfo.localVMState = null;
    try {
      const listOutput = shell("VBoxManage list vms");
      const vmExists = listOutput.split("\n").some((line) => line.includes(`"${vmName}"`));
      if (!vmExists) {
        log16.error(`communicationhandler @ startLocalVMAndResolveHost: VM '${vmName}' not found on client`);
        throw new Error("VM not installed on client");
      }
    } catch (err) {
      log16.error("communicationhandler @ startLocalVMAndResolveHost: list vms failed", err);
      throw err;
    }
    try {
      shell(`VBoxManage startvm "${vmName}" --type headless`);
      this.multicastClient.clientinfo.localVMState = "starting";
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "";
      if (/already running|VBOX_E_INVALID_VM_STATE/i.test(msg)) {
        log16.info("communicationhandler @ startLocalVMAndResolveHost: VM already running, continuing");
      } else {
        log16.warn("communicationhandler @ startLocalVMAndResolveHost: startvm failed (continuing anyway)", err?.message || err);
      }
    }
    let ipAddress = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        ipAddress = await this.resolveVmIp(vmName);
        if (ipAddress) {
          this.multicastClient.clientinfo.localVMHost = ipAddress;
          this.multicastClient.clientinfo.localVMState = "running";
          log16.info(`communicationhandler @ startLocalVMAndResolveHost: VM IP resolved to ${ipAddress}`);
          return;
        }
      } catch (err) {
        log16.error("communicationhandler @ startLocalVMAndResolveHost: resolveVmIp attempt failed", err);
      }
      await this.sleep(2e3);
    }
    log16.error("communicationhandler @ startLocalVMAndResolveHost: could not resolve VM IP");
    throw new Error("Could not resolve VM IP");
  }
  async resolveVmIp(vmName) {
    try {
      const guestProp = shell(`VBoxManage guestproperty get "${vmName}" "/VirtualBox/GuestInfo/Net/0/V4/IP"`).trim();
      const parts = guestProp.split(" ");
      const last = parts[parts.length - 1];
      if (last && last !== "value" && last !== "No" && last !== "None") {
        return last;
      }
    } catch (err) {
      log16.error("communicationhandler @ resolveVmIp: guestproperty failed", err);
    }
    try {
      const info = shell(`VBoxManage showvminfo "${vmName}"`);
      const nicLine = info.split("\n").find((line) => line.includes("NIC 1"));
      if (!nicLine) {
        return null;
      }
      const macMatch = nicLine.match(/MAC address: ([0-9A-Fa-f]+)/);
      if (!macMatch || !macMatch[1]) {
        return null;
      }
      const mac = macMatch[1].toLowerCase();
      const arpOutput = shell("arp -an");
      const arpLine = arpOutput.split("\n").find((line) => line.toLowerCase().includes(mac));
      if (!arpLine) {
        return null;
      }
      const ipMatch = arpLine.match(/\(([^)]+)\)/);
      if (ipMatch && ipMatch[1]) {
        return ipMatch[1];
      }
    } catch (err) {
      log16.error("communicationhandler @ resolveVmIp: fallback resolution failed", err);
    }
    return null;
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
        log16.warn("main @ ready: Possible remote assistance detected");
        for (const keyword of usesRemoteAssistant.keywords) {
          log16.warn(`main @ ready: Keyword ${keyword} detected`);
        }
        for (const port of usesRemoteAssistant.ports) {
          log16.warn(`main @ ready: Port ${port} detected`);
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
        log16.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.");
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
            log16.warn("communicationhandler @ requestUpdate: Exam Instance not found!");
            this.multicastClient.beaconsLost = 5;
          } else if (data.message === "removed") {
            log16.warn("communicationhandler @ requestUpdate: Student registration not found!");
            this.kickStudent();
          } else {
            log16.warn(`communicationhandler @ requestUpdate: ${this.multicastClient.beaconsLost} Heartbeat lost..`);
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
        log16.error(`communicationhandler @ requestUpdate: (${this.multicastClient.beaconsLost}) ${error}`);
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
        log16.error(`communicationhandler @ sendScreenshot: processImage failed: ${err}`);
      }
      if (process.platform === "darwin" && this.firstCheckScreenshot && imgBuffer !== null) {
        this.firstCheckScreenshot = false;
        const publicPath = platformDispatcher_default.publicBase;
        try {
          const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng", { langPath: publicPath, cachePath: this.config.tempdirectory });
          let appWindowVisible = text.includes("Exam");
          if (!appWindowVisible) {
            platformDispatcher_default.screenshotAbility = false;
            log16.warn("communicationhandler @ sendScreenshot (macos): Please check your screenshot permissions - Switching to PageCapture");
          } else {
            log16.info("communicationhandler @ sendScreenshot (macos): MacOS screenshotpermissions check OK");
          }
        } catch (err) {
          log16.error(`communicationhandler @ sendScreenshot (macos): ${err}`);
        }
      }
      if (!screenshotBase64) {
        if (this.screenshotFails > 4 && platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.screenshotAbility = false;
          log16.error(`communicationhandler @ sendScreenshot: Screenshot error -> Switching to PageCapture`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility) {
          platformDispatcher_default.useWorker = false;
          log16.error(`communicationhandler @ sendScreenshot: PageCapture error -> Switching to No-Processing`);
        } else if (this.screenshotFails > 4 && !platformDispatcher_default.screenshotAbility && !platformDispatcher_default.useWorker) {
          log16.error(`communicationhandler @ sendScreenshot: no screenshot available - please fix your setup`);
        }
        return;
      }
      if (this.multicastClient.clientinfo.exammode && !this.config.development && this.multicastClient.clientinfo.focus) {
        if (isblack) {
          this.multicastClient.clientinfo.focus = false;
          log16.info("communicationhandler @ sendScreenshot: Student Screenshot does not fit requirements (allblack)");
        }
      }
      let screenshothash = null;
      try {
        screenshothash = crypto.createHash("md5").update(Buffer.from(screenshotBase64, "base64")).digest("hex");
      } catch (err) {
        log16.error(`communicationhandler @ sendScreenshot: creating hash failed: ${err.message}`);
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
        log16.error("communicationhandler @ doScreenshotUpdate: Status Error:", data.message);
      }
    }).catch((error) => {
      if (attempt < maxRetries - 1) {
        this.doScreenshotUpdate(url, payload, agent2, attempt + 1, maxRetries);
      } else if (attempt === maxRetries - 1 && this.multicastClient.beaconsLost === 0) {
        log16.error(`communicationhandler @ doScreenshotUpdate (fetch): ${error.message}`);
      }
    });
  }
  async kickStudent(studentstatus) {
    log16.warn("communicationhandler @ kickStudent: Student got kicked by Teacher");
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
    this.multicastClient.serverstatus = serverstatus;
    if (studentstatus && Object.keys(studentstatus).length !== 0) {
      if (studentstatus.printdenied) {
        windowhandler_default.examwindow.webContents.send("denied");
      }
      if (studentstatus.kicked) {
        this.kickStudent(studentstatus);
        return;
      }
      if (studentstatus.delfolder === true) {
        log16.info("communicationhandler @ processUpdatedServerstatus: cleaning exam workfolder");
        let delfolder = true;
        try {
          if (fs7.existsSync(this.config.examdirectory)) {
            fs7.rmSync(this.config.examdirectory, { recursive: true });
            fs7.mkdirSync(this.config.examdirectory);
          }
        } catch (error) {
          delfolder = false;
          windowhandler_default.examwindow.webContents.send("fileerror", error);
          log16.error(`communicationhandler @ processUpdatedServerstatus: Can not delete directory - ${error} `);
        }
        if (delfolder == false) {
          if (fs7.existsSync(this.config.examdirectory)) {
            const files = fs7.readdirSync(this.config.examdirectory);
            files.forEach((file) => {
              const filePath = join5(this.config.examdirectory, file);
              try {
                const stats = fs7.statSync(filePath);
                if (stats.isDirectory()) {
                  fs7.rmSync(filePath, { recursive: true });
                } else {
                  fs7.unlinkSync(filePath);
                }
              } catch (error) {
                log16.error(`communicationhandler @ processUpdatedServerstatus: (delfolder) Fehler beim L\xF6schen der Datei/Verzeichnis: ${filePath}`, error);
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
        log16.info("communicationhandler @ processUpdatedServerstatus: restoring focus state for student");
        this.multicastClient.clientinfo.focus = true;
        if (windowhandler_default.examwindow && !this.config.development) {
          windowhandler_default.examwindow.setKiosk(true);
          windowhandler_default.examwindow.focus();
        }
      }
      if (studentstatus.activatePrivateSpellcheck == true && this.multicastClient.clientinfo.privateSpellcheck.activated == false) {
        log16.info("communicationhandler @ processUpdatedServerstatus: activating spellcheck for student");
        this.multicastClient.clientinfo.privateSpellcheck.activate = true;
        this.multicastClient.clientinfo.privateSpellcheck.activated = true;
        ipcMain2.emit("startLanguageTool");
      }
      if (studentstatus.activatePrivateSpellcheck == false && this.multicastClient.clientinfo.privateSpellcheck.activated == true) {
        log16.info("communicationhandler @ processUpdatedServerstatus: de-activating spellcheck for student");
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
    if (windowhandler_default.examwindow) {
      if (serverstatus.allowSectionSwitch !== windowhandler_default.examwindow.serverstatus.allowSectionSwitch) {
        log16.info("communicationhandler @ processUpdatedServerstatus: permission to switch exam section changed");
        windowhandler_default.examwindow.serverstatus.allowSectionSwitch = serverstatus.allowSectionSwitch;
      }
    }
    if (serverstatus.exammode && this.multicastClient.clientinfo.exammode) {
      if (serverstatus.useExamSections) {
        if (!serverstatus.allowSectionSwitch) {
          if (serverstatus.lockedSection !== this.multicastClient.clientinfo.lockedSection) {
            switchExamSection(this, serverstatus, serverstatus.lockedSection);
          }
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
    const sectionForSync = serverstatus.allowSectionSwitch ? this.multicastClient.clientinfo.lockedSection : serverstatus.lockedSection;
    const section = serverstatus.examSections[sectionForSync];
    if (section?.groups) {
      this.multicastClient.clientinfo.groups = true;
      const clientname = this.multicastClient.clientinfo.name;
      const groupA = section.groupA?.users ?? [];
      const groupB = section.groupB?.users ?? [];
      const prevGroup = this.multicastClient.clientinfo.group;
      if (groupB.includes(clientname)) this.multicastClient.clientinfo.group = "b";
      else if (groupA.includes(clientname)) this.multicastClient.clientinfo.group = "a";
      else this.multicastClient.clientinfo.group = "a";
      if (this.multicastClient.clientinfo.group !== prevGroup && windowhandler_default.examwindow) {
        windowhandler_default.examwindow.webContents.send("getmaterials");
      }
    } else {
      this.multicastClient.clientinfo.groups = false;
    }
    if (serverstatus.screenshotinterval || serverstatus.screenshotinterval === 0) {
      if (this.multicastClient.clientinfo.screenshotinterval !== serverstatus.screenshotinterval * 1e3) {
        log16.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to", serverstatus.screenshotinterval * 1e3);
        this.multicastClient.clientinfo.screenshotinterval = serverstatus.screenshotinterval * 1e3;
        if (serverstatus.screenshotinterval == 0) {
          log16.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!");
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
    log16.info("communicationhandler @ getBase64PDF: getting base64 encoded pdf");
    let waitCount = 0;
    const maxWait = 300;
    while (ipchandler_default.isPrintingPdf && waitCount < maxWait) {
      await this.sleep(100);
      waitCount++;
    }
    if (ipchandler_default.isPrintingPdf) {
      log16.error("communicationhandler @ getBase64PDF: printToPDF lock timeout - another print operation is still running");
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
      log16.error("communicationhandler @ getBase64PDF: Error generating PDF:", error);
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
      log16.error("communicationhandler @ killScreenlock: no functional screenlockwindow to handle");
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
      log16.warn("communicationhandler @ startExam: Dialog is still open - exam will start anyway");
    }
    let displays = screen2.getAllDisplays();
    let primary = screen2.getPrimaryDisplay();
    if (!primary || primary === "" || !primary.id) {
      primary = displays[0];
    }
    this.multicastClient.clientinfo.exammode = true;
    if (!serverstatus.allowSectionSwitch || !this.multicastClient.clientinfo.lockedSection) {
      this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection;
    }
    const effectiveSection = this.multicastClient.clientinfo.lockedSection;
    this.multicastClient.clientinfo.cmargin = serverstatus.examSections[effectiveSection].cmargin;
    this.multicastClient.clientinfo.linespacing = serverstatus.examSections[effectiveSection].linespacing;
    this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[effectiveSection].audioRepeat;
    const examtype = serverstatus.examSections[effectiveSection].examtype;
    if (!windowhandler_default.examwindow) {
      log16.info("communicationhandler @ startExam: creating exam window");
      this.multicastClient.clientinfo.examtype = examtype;
      if (examtype === "localvm") {
        try {
          const vmConfig = serverstatus.examSections[effectiveSection].localVMConfig || {};
          const vmName = vmConfig.vmName;
          if (!vmName) {
            log16.error("communicationhandler @ startExam: no vmName configured for localvm examtype");
            this.multicastClient.clientinfo.exammode = false;
            return;
          }
          await this.startLocalVMAndResolveHost(vmName);
        } catch (err) {
          log16.error("communicationhandler @ startExam: LocalVM start failed", err);
          this.multicastClient.clientinfo.exammode = false;
          return;
        }
      }
      windowhandler_default.createExamWindow(examtype, this.multicastClient.clientinfo.token, serverstatus, primary);
    } else if (windowhandler_default.examwindow) {
      log16.error("communicationhandler @ startExam: found existing Examwindow..");
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
        log16.error("communicationhandler @ startExam: no functional examwindow found.. resetting");
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
      log16.info("communicationhandler @ endExam: cleaning exam workfolder on exit");
      try {
        if (fs7.existsSync(this.config.examdirectory)) {
          fs7.rmSync(this.config.examdirectory, { recursive: true });
          fs7.mkdirSync(this.config.examdirectory);
        }
      } catch (error) {
        log16.error("communicationhandler @ endExam: ", error);
      }
    }
    if (windowhandler_default.examwindow) {
      try {
        if (this.config.development || this.config.showdevtools) {
          const allWebContents = webContents3.getAllWebContents();
          for (const wc of allWebContents) {
            if (windowhandler_default.examwindow && wc.hostWebContents?.id === windowhandler_default.examwindow.webContents.id && wc.isDevToolsOpened?.()) {
              log16.info("communicationhandler @ endExam: destroying devtools window");
              wc.closeDevTools();
            }
          }
          await this.sleep(1e3);
        }
        this.closeExamWindowSafely();
      } catch (e) {
        log16.error("communicationhandler @ endExam: ", e);
      }
      try {
        for (let blockwindow of windowhandler_default.blockwindows) {
          blockwindow.close();
          blockwindow.destroy();
          blockwindow = null;
        }
      } catch (e) {
        windowhandler_default.blockwindows = [];
        log16.error("communicationhandler @ endExam: no functional blockwindow to handle");
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
      log16.warn("communicationhandler @ closeExamWindowSafely: printToPDF in progress - retry in 1s");
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
      log16.error("communicationhandler @ closeExamWindowSafely: error while closing examwindow", e);
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
      fs7.writeFile(absoluteFilepath, Buffer.from(buffer), (err) => {
        if (err) {
          log16.error(err);
        } else {
          extract(absoluteFilepath, { dir: this.config.examdirectory }).then(() => {
            log16.info("CommunicationHandler @ requestFileFromServer: files received and extracted");
            return fs7.promises.unlink(absoluteFilepath);
          }).then(() => {
            if (backupfile && windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("backup", backupfile);
              log16.warn("CommunicationHandler @ requestFileFromServer: Trigger Replace Event");
            }
            if (windowhandler_default.examwindow) {
              windowhandler_default.examwindow.webContents.send("loadfilelist");
            }
          }).catch((err2) => {
            log16.error(err2);
          });
        }
      });
    }).catch((err) => log16.error(`CommunicationHandler - requestFileFromServer: ${err}`));
  }
  async sendExamToTeacher() {
    if (windowhandler_default.examwindow) {
      try {
        windowhandler_default.examwindow.webContents.send("save", "teacherrequest");
      } catch (err) {
        log16.error(`Communication handler @ sendExamToTeacher: Could not save students work. Is exammode active?`);
      }
    } else {
      this.sendToTeacher();
    }
  }
  //zip config.work directory and send to teacher
  async sendToTeacher() {
    try {
      if (!fs7.existsSync(this.config.tempdirectory)) {
        fs7.mkdirSync(this.config.tempdirectory);
      }
    } catch (e) {
      log16.error(e);
    }
    let logfilepath = platformDispatcher_default.logfile;
    if (fs7.existsSync(logfilepath)) {
      try {
        fs7.copyFileSync(logfilepath, join5(this.config.examdirectory, "next-exam-student.log"));
      } catch (e) {
        log16.error("communicationhandler @ sendToTeacher: could not copy logfile to examdirectory");
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
      const fileContent = fs7.readFileSync(zipfilepath);
      base64File = fileContent.toString("base64");
    } catch (e) {
      log16.error(e);
    }
    const url = `https://${serverip}:${this.config.serverApiPort}/server/data/receive/${servername}/${token}`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: base64File, filename: zipfilename })
    }).then((response) => response.json()).then((data) => {
      log16.info(`communicationhandler @ sendExamToTeacher: teacher response: ${data.message}`);
    }).catch((error) => {
      log16.error(`communicationhandler @ sendExamToTeacher: ${error}`);
    });
  }
  /**
   * @param {String} sourceDir: /some/folder/to/compress
   * @param {String} outPath: /path/to/created.zip
   * @returns {Promise}
   */
  zipDirectory(sourceDir, outPath) {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = fs7.createWriteStream(outPath);
    return new Promise((resolve, reject) => {
      archive.directory(sourceDir, false).on("error", (err) => reject(err)).pipe(stream);
      stream.on("close", () => resolve());
      archive.finalize();
    }).catch((error) => {
      log16.error(error);
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
import log17 from "electron-log";
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
    log17.error(`checkparent @ getProcessInfoWindows: Error for PID ${pid}: ${error.message}`);
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
    log17.error(`checkparent @ getProcessInfoUnix: Error for PID ${pid}: ${error.message}`);
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
    log17.info("checkparent @ findParentProcess: Root PID reached. No web browser found.");
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
  log17.info(`checkparent @ findParentProcess: Checking process: ${name} (PID: ${pid}, PPID: ${ppid})`);
  if (browserKeywords.some((browser) => name.includes(browser))) {
    log17.info(`checkparent @ findParentProcess: Browser found: ${name}`);
    return true;
  } else if (name.includes("explorer") || ppid <= 1) {
    log17.info(`checkparent @ findParentProcess: Reached system process or explorer`);
    return false;
  } else {
    return await findParentProcess(ppid, maxDepth - 1, visitedPids);
  }
}
async function checkParentProcess() {
  try {
    const foundBrowser = await findParentProcess(process.ppid, 6, /* @__PURE__ */ new Set());
    log17.info(`checkparent @ checkParentProcess: Browser detection result: ${foundBrowser}`);
    return { success: true, foundBrowser };
  } catch (error) {
    log17.error(`checkparent @ checkParentProcess: Error in browser detection: ${error.message}`);
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
log18.initialize();
log18.eventLogger.startLogging();
log18.errorHandler.startCatching();
log18.transports.file.resolvePathFn = () => {
  return platformDispatcher_default.logfile;
};
log18.transports.console.format = (message) => {
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
log18.verbose();
log18.verbose(`main: -------------------`);
log18.verbose(`main: starting Next-Exam Student "${config_default.version} ${config_default.info}" (${process.platform})${config_default.development ? " (devmode on)" : ""}`);
log18.verbose(`main: -------------------`);
log18.info(`main: Logfilelocation at ${platformDispatcher_default.logfile}`);
platformDispatcher_default.messages.forEach((message) => {
  log18.debug(message);
});
log18.debug(`main: Electron version: ${process.versions.electron}`);
log18.debug(`main: Chromium version: ${process.versions.chrome}`);
log18.debug(`main: Node version: ${process.versions.node}`);
log18.debug(`main: V8 version: ${process.versions.v8}`);
log18.debug(`main: OS: ${process.platform} ${process.arch}`);
log18.debug(`main: Arch: ${process.arch}`);
windowhandler_default.init(multicastclient_default, config_default);
communicationhandler_default.init(multicastclient_default, config_default);
ipchandler_default.init(multicastclient_default, config_default, windowhandler_default, communicationhandler_default);
Menu2.setApplicationMenu(null);
if (!app8.requestSingleInstanceLock()) {
  log18.warn("main @ singleinstance: next-exam already running.");
  app8.quit();
  process.exit(0);
}
app8.on("second-instance", () => {
  log18.warn("main @ singleinstance: prevented second start of next-exam. Restoring existing Next-Exam window.");
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
if (!fs8.existsSync(config_default.workdirectory)) {
  fs8.mkdirSync(config_default.workdirectory, { recursive: true });
}
if (!fs8.existsSync(config_default.tempdirectory)) {
  fs8.mkdirSync(config_default.tempdirectory, { recursive: true });
}
if (!fs8.existsSync(platformDispatcher_default.desktopPath)) {
  fs8.mkdirSync(platformDispatcher_default.desktopPath, { recursive: true });
}
var linkPath = path8.join(platformDispatcher_default.desktopPath, config_default.clientdirectory);
try {
  fs8.unlinkSync(linkPath);
} catch (e) {
}
try {
  if (!fs8.existsSync(linkPath)) {
    fs8.symlinkSync(config_default.workdirectory, linkPath, "junction");
  }
} catch (e) {
  log18.error("main @ create-symlink: can't create symlink");
}
try {
  const { gateway, interface: iface } = gateway4sync2();
  config_default.hostip = ip2.address(iface);
  config_default.gateway = true;
} catch (e) {
  log18.error("main @ gateway4sync: unable to determine default gateway");
  config_default.hostip = ip2.address();
  log18.info(`main: IP ${config_default.hostip}`);
  config_default.gateway = false;
}
fsExtra.emptyDirSync(config_default.tempdirectory);
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") {
    log18.transports.console.level = false;
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
    log18.transports.console.level = false;
    log18.warn("main @ uncaughtException: EPIPE Error: The stdout stream of the ElectronLogger will be disabled.");
  } else if (err.message?.includes("Render frame was disposed")) return;
  else {
    log18.error("main @ uncaughtException:", err.message);
  }
});
process.on("unhandledRejection", (reason, promise) => {
  log18.error("main @ unhandledRejection: Unhandled promise rejection:", reason);
  if (reason instanceof Error) {
    log18.error("main @ unhandledRejection: Stack:", reason.stack);
  }
});
app8.on("render-process-gone", (event, webContents4, details) => {
  log18.error("main @ render-process-gone: Renderer process crashed");
  log18.error("main @ render-process-gone: Reason:", details.reason);
  log18.error("main @ render-process-gone: Exit code:", details.exitCode);
  const allWindows = BrowserWindow3.getAllWindows();
  const crashedWindow = allWindows.find((win) => win.webContents.id === webContents4.id);
  if (crashedWindow) {
    log18.error(`main @ render-process-gone: Window title: ${crashedWindow.getTitle()}`);
    if (crashedWindow === windowhandler_default.examwindow) {
      log18.warn("main @ render-process-gone: Exam window crashed, attempting to close gracefully");
      try {
        if (!crashedWindow.isDestroyed()) {
          crashedWindow.destroy();
        }
        windowhandler_default.examwindow = null;
        windowhandler_default.examDisplayId = null;
      } catch (err) {
        log18.error("main @ render-process-gone: Error closing exam window:", err);
      }
    }
  }
  event.preventDefault();
});
app8.on("child-process-gone", (event, details) => {
  log18.error("main @ child-process-gone: Child process crashed");
  log18.error("main @ child-process-gone: Type:", details.type);
  log18.error("main @ child-process-gone: Reason:", details.reason);
  log18.error("main @ child-process-gone: Exit code:", details.exitCode);
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
app8.on("certificate-error", (event, webContents4, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
app8.on("web-contents-created", (event, webContents4) => {
  const suppressCodes = [-3, -100, -101, -105];
  if (webContents4._errorSuppressionSetup) return;
  webContents4._errorSuppressionSetup = true;
  const setupErrorSuppression = () => {
    webContents4.removeAllListeners("did-fail-provisional-load");
    webContents4.removeAllListeners("did-fail-load");
    webContents4.on("did-fail-provisional-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
      if (!isMainFrame || suppressCodes.includes(errorCode)) {
        event2.preventDefault();
        return;
      }
      log18.warn(`main @ did-fail-provisional-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
    });
    webContents4.on("did-fail-load", (event2, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
      if (!isMainFrame || suppressCodes.includes(errorCode)) {
        event2.preventDefault();
        return;
      }
      log18.warn(`main @ did-fail-load: Error ${errorCode} - ${errorDescription} for URL: ${validatedURL}`);
    });
  };
  setupErrorSuppression();
  webContents4.on("did-start-navigation", setupErrorSuppression);
  webContents4.on("did-frame-navigate", setupErrorSuppression);
  webContents4.on("render-process-gone", (event2, details) => {
    log18.error("main @ webContents render-process-gone: Renderer process crashed for specific webContents");
    log18.error("main @ webContents render-process-gone: Reason:", details.reason);
    log18.error("main @ webContents render-process-gone: Exit code:", details.exitCode);
    const allWindows = BrowserWindow3.getAllWindows();
    const crashedWindow = allWindows.find((win) => win.webContents.id === webContents4.id);
    if (crashedWindow) {
      log18.error(`main @ webContents render-process-gone: Window title: ${crashedWindow.getTitle()}`);
      log18.error(`main @ webContents render-process-gone: Window URL: ${crashedWindow.webContents.getURL()}`);
      if (crashedWindow === windowhandler_default.examwindow) {
        log18.warn("main @ webContents render-process-gone: Exam window crashed, attempting to close gracefully");
        try {
          if (!crashedWindow.isDestroyed()) {
            crashedWindow.destroy();
          }
          windowhandler_default.examwindow = null;
          windowhandler_default.examDisplayId = null;
        } catch (err) {
          log18.error("main @ webContents render-process-gone: Error closing exam window:", err);
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
    log18.error("main @ window-all-closed: Error clearing storage:", err);
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
      log18.error("main @ checkParent:", result.error);
      return;
    }
    if (result.foundBrowser) {
      log18.warn("main @ checkParent: The app was started directly from a browser");
      dialog3.showMessageBoxSync(windowhandler_default.mainwindow, {
        type: "question",
        buttons: ["OK"],
        title: "Terminate Program",
        message: "Unerlaubter Programmstart aus einem Webbrowser erkannt.\nNext-Exam wird beendet!"
      });
      windowhandler_default.mainwindow.allowexit = true;
      app8.quit();
    } else {
      log18.info("main @ checkparent: Parent Process Check OK");
    }
  } catch (error) {
    log18.error("main @ checkParent error:", error);
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
      log18.info("main @ tray: GNOME detected, skipping system tray");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybURpc3BhdGNoZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vY29uZmlnLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9lbGVjdHJvbi1tYWluLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvbXVsdGljYXN0Y2xpZW50LmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvc2NoZWR1bGVyc2VydmljZS50cyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dpbmRvd2hhbmRsZXIuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9wbGF0Zm9ybXJlc3RyaWN0aW9ucy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3Jlc3RyaWN0aW9ucy9saW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZXN0cmljdGlvbnMvd2luLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvcmVzdHJpY3Rpb25zL21hYy5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcyIsICIuLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLnRzIiwgIi4uLy4uL3NyYy9sb2NhbGVzL2VuLmpzb24iLCAiLi4vLi4vc3JjL2xvY2FsZXMvZGUuanNvbiIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3dlYkZpbHRlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2x0LXNlcnZlci5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdHJheW1lbnUuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy90ZXN0cGVybWlzc2lvbnNNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9nZXR3bGFuaW5mby5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL3N3aXRjaEV4YW1TZWN0aW9uLmpzIiwgIi4uLy4uL3NyYy1lbGVjdHJvbi9tYWluL3NjcmlwdHMvdm5jcHJveHkuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZW1vdGVjaGVjay9yZW1vdGVXaW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZW1vdGVjaGVjay9yZW1vdGVNYWMuanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZW1vdGVjaGVjay9yZW1vdGVMaW4uanMiLCAiLi4vLi4vc3JjLWVsZWN0cm9uL21haW4vc2NyaXB0cy9yZW1vdGVDaGVjay5qcyIsICIuLi8uLi9zcmMtZWxlY3Ryb24vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8vIHRoaXMgZmlsZSBpcyB1c2VkIHRvIHN0b3JlIHRoZSBjb25maWcgZm9yIHRoZSBlbnZpcm9ubWVudFxuLy8gaXQgcXVlcmllcyB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFuZCB0aGUgcGxhdGZvcm0gYW5kIHNldHMgdGhlIGNvbmZpZyBhY2NvcmRpbmdseVxuXG5cblxuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qcyc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBkb3RlbnYgZnJvbSAnZG90ZW52JztcbmRvdGVudi5jb25maWcoKTtcbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbmNsYXNzIFBsYXRmb3JtRGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgdGhpcy5fYXJjaCA9IHByb2Nlc3MuYXJjaDtcbiAgICB0aGlzLl9lbnYgPSBwcm9jZXNzLmVudjtcblxuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMuYXJjaCA9IHRoaXMuX25vcm1hbGl6ZUFyY2goKTtcbiAgICB0aGlzLmRpc3BsYXlTZXJ2ZXIgPSB0aGlzLl9nZXREaXNwbGF5U2VydmVyKCk7XG4gICAgdGhpcy5pc0tERSA9IHRoaXMuX2lzS0RFKCk7XG4gICAgdGhpcy5pc0dOT01FID0gdGhpcy5faXNHTk9NRSgpO1xuICAgIHRoaXMuZmxhbWVzaG90ID0gdGhpcy5fZ2V0VmVyc2lvbignZmxhbWVzaG90Jyk7XG4gICAgdGhpcy5pbWFnZW1hZ2ljayA9IHRoaXMuX2dldFZlcnNpb24oJ2NvbnZlcnQnKTtcbiAgICB0aGlzLmltVmVyc2lvbiA9IHRoaXMuX2dldEltYWdlTWFnaWNrVmVyc2lvbigpO1xuICAgIHRoaXMud29ya2VyRmlsZU5hbWUgPSB0aGlzLl9nZXRXb3JrZXJGaWxlTmFtZSgpO1xuICAgIHRoaXMudXNlV29ya2VyID0gdGhpcy5fZ2V0VXNlV29ya2VyKCk7XG4gICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IHRoaXMuX2dldFNjcmVlbnNob3RBYmlsaXR5KCk7XG4gICAgdGhpcy5qcmUgPSB0aGlzLl9kZXRlY3RKUkVJZCgpO1xuICAgIHRoaXMucHVibGljQmFzZSA9IHRoaXMuX2dldFB1YmxpY0Jhc2UoKTtcbiAgICB0aGlzLmpyZURpciA9IHRoaXMuX3Jlc29sdmVKUkVEaXIoKTtcbiAgICB0aGlzLmphdmFCaW4gPSB0aGlzLl9yZXNvbHZlSmF2YUJpbigpO1xuICAgIHRoaXMuanJlSW5mbyA9IHRoaXMuX2dldEpSRSgpO1xuICAgIFxuICAgIHRoaXMuaG9tZWRpcmVjdG9yeSA9IG9zLmhvbWVkaXIoKTtcbiAgICB0aGlzLmRlc2t0b3BQYXRoID0gdGhpcy5fZ2V0RGVza3RvcFBhdGgoKTtcbiAgICB0aGlzLndvcmtlclVSTCA9IHRoaXMuX2dldFdvcmtlclVSTCgpO1xuICAgIHRoaXMudGVtcGRpcmVjdG9yeSA9IHRoaXMuX2dldFRlbXBkaXJlY3RvcnkoKTtcbiAgICB0aGlzLndvcmtkaXJlY3RvcnkgPSB0aGlzLl9nZXRXb3JrZGlyZWN0b3J5KCk7XG4gICAgdGhpcy5sb2dmaWxlID0gdGhpcy5fZ2V0TG9nZmlsZSgpO1xuXG4gIH1cblxuICBfZ2V0UHVibGljQmFzZSgpIHtcbiAgICBpZiAoYXBwLmlzUGFja2FnZWQpIHtcbiAgICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcpO1xuICAgICAgY29uc3Qgd2l0aFB1YmxpYyA9IGpvaW4odW5wYWNrZWQsICdwdWJsaWMnKTtcbiAgICAgIHJldHVybiBmcy5leGlzdHNTeW5jKHdpdGhQdWJsaWMpID8gd2l0aFB1YmxpYyA6IHVucGFja2VkO1xuICAgIH1cbiAgICByZXR1cm4gam9pbihfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKTtcbiAgfVxuXG4gIF9nZXRXb3JrZGlyZWN0b3J5KCkge1xuICAgIHJldHVybiBqb2luKHRoaXMuaG9tZWRpcmVjdG9yeSwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7XG4gIH1cblxuICBfZ2V0VGVtcGRpcmVjdG9yeSgpIHtcbiAgICByZXR1cm4gam9pbihvcy50bXBkaXIoKSwgJ2V4YW0tdG1wJyk7XG4gIH1cblxuXG4gIF9nZXRMb2dmaWxlKCkge1xuICAgIHJldHVybiBqb2luKHRoaXMud29ya2RpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpO1xuICB9XG5cbiAgX25vcm1hbGl6ZUFyY2goKSB7XG4gICAgaWYgKHRoaXMuX2FyY2ggPT09ICdpYTMyJykgcmV0dXJuICdpNTg2JztcbiAgICBpZiAoWyd4NjQnLCAnYXJtNjQnXS5pbmNsdWRlcyh0aGlzLl9hcmNoKSkgcmV0dXJuIHRoaXMuX2FyY2g7XG4gICAgdGhpcy5fZmFpbChgdW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlOiAke3RoaXMuX2FyY2h9YCk7XG4gIH1cblxuICBfZGV0ZWN0SlJFSWQoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gPT09ICdsaW51eCcpIHJldHVybiAnbWluaW1hbC1qcmUtMTEtbGluJztcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuICdtaW5pbWFsLWpyZS0xMS13aW4nO1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgcmV0dXJuIHRoaXMuX2FyY2ggPT09ICdhcm02NCcgPyAnbWluaW1hbC1qcmUtMTEtbWFjLWFybTY0JyA6ICdtaW5pbWFsLWpyZS0xMS1tYWMnO1xuICAgIH1cbiAgfVxuXG5cblxuXG5cbiAgLyoqXG4gICAqIFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBAZGVzY3JpcHRpb24gdGhpcyBmdW5jdGlvbiByZXNvbHZlcyB0aGUganJlIGRpcmVjdG9yeVxuICAgKiBpdCBmaXJzdCBjaGVja3MgaWYgdGhlIHVzZUJ1bmRsZWRKUkUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0IHRvIHRydWVcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIGJ1bmRsZWQganJlIGRpcmVjdG9yeVxuICAgKiBpZiBpdCBpcyBub3QsIGl0IGNoZWNrcyBpZiB0aGUgc3lzdGVtIGpyZSBpcyBpbnN0YWxsZWRcbiAgICogaWYgaXQgaXMsIGl0IHJldHVybnMgdGhlIHN5c3RlbSBqcmUgZGlyZWN0b3J5XG4gICAqIGlmIGl0IGlzIG5vdCwgaXQgcmV0dXJucyB0aGUgYnVuZGxlZCBqcmUgZGlyZWN0b3J5XG4gICAqIHRoZSBidW5kbGVkIGpyZSBpcyBsb2NhdGVkIGluIHRoZSBwdWJsaWMgZGlyZWN0b3J5IG9mIHRoZSBhcHBcbiAgICogXG4gICAqIEZJWE1FOiBpZiBzeXN0ZW0ganJlIGlzIHNlbGVjdGVkIGJ5IEVOViBkbyBub3QgaW5jbHVkZSB0aGUganJlIGRpcmVjdG9yeSBpbiB0aGUgZmluYWwgYnVpbGRcbiAgICovXG5cbiAgX3Jlc29sdmVKUkVEaXIoKSB7XG4gICAgLy8gdXNlIGJ1bmRsZWQganJlIGJlY2F1c2UgaXRzIHNtYWxsZXIgYW5kIHByb3ZpZGVzIG9ubHkgdGhlIG5lZWRlZCBqYXZhIG1vZHVsZXNcbiAgICBpZiAoY29uZmlnLnVzZUJ1bmRsZWRKUkUpIHtcbiAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfcmVzb2x2ZUpSRURpcjogYXBwLmlzUGFja2FnZWQ6IFwiICsgam9pbih0aGlzLnB1YmxpY0Jhc2UsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKHRoaXMucHVibGljQmFzZSwgdGhpcy5qcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX3Jlc29sdmVKUkVEaXI6ICFhcHAuaXNQYWNrYWdlZDogXCIgKyBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHRoaXMuanJlKSk7XG4gICAgICAgIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycsIHRoaXMuanJlKTtcbiAgICAgIH1cbiAgICB9IFxuICAgIGVsc2UgeyAgLy8gdXNlIHN5c3RlbSBqcmVcbiAgICAgIC8vIFRyeSB0byBmaW5kIEphdmEgaW5zdGFsbGF0aW9uIHVzaW5nIHdoaWNoL3doZXJlIGNvbW1hbmRcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGphdmFDb21tYW5kID0gdGhpcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICd3aGVyZSBqYXZhJyA6ICd3aGljaCBqYXZhJztcbiAgICAgICAgY29uc3QgamF2YVBhdGggPSBleGVjU3luYyhqYXZhQ29tbWFuZCwgeyBlbmNvZGluZzogJ3V0Zi04Jywgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ2lnbm9yZSddIH0pLnRyaW0oKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChqYXZhUGF0aCkge1xuICAgICAgICAgIC8vIEdldCB0aGUgZGlyZWN0b3J5IGNvbnRhaW5pbmcgdGhlIGphdmEgZXhlY3V0YWJsZVxuICAgICAgICAgIGNvbnN0IGphdmFEaXIgPSBwYXRoLmRpcm5hbWUoamF2YVBhdGgpO1xuICAgICAgICAgIC8vIEdvIHVwIHRvIHRoZSBKUkUvSkRLIHJvb3QgKHVzdWFsbHkgMiBsZXZlbHMgdXAgZnJvbSBiaW4vKVxuICAgICAgICAgIGNvbnN0IGpyZVJvb3QgPSBwYXRoLmRpcm5hbWUocGF0aC5kaXJuYW1lKGphdmFEaXIpKTtcbiAgICAgICAgICByZXR1cm4ganJlUm9vdDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIEphdmEgbm90IGZvdW5kIGluIFBBVEhcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSWYgbm8gSmF2YSBmb3VuZCwgZmFsbCBiYWNrIHRvIGJ1bmRsZWQgSlJFXG4gICAgICBsb2cud2FybihcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9yZXNvbHZlSlJFRGlyOiBObyBzeXN0ZW0gSmF2YSBmb3VuZCwgZmFsbGluZyBiYWNrIHRvIGJ1bmRsZWQgSlJFXCIpO1xuICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgIHJldHVybiBqb2luKHRoaXMucHVibGljQmFzZSwgdGhpcy5qcmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcHVibGljJywgdGhpcy5qcmUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9yZXNvbHZlSmF2YUJpbigpIHtcbiAgICBzd2l0Y2ggKHRoaXMucGxhdGZvcm0pIHtcbiAgICAgIGNhc2UgJ2Rhcndpbic6IHJldHVybiBbJ2JpbicsICdqYXZhJ107XG4gICAgICBjYXNlICd3aW4zMic6IHJldHVybiBbJ2JpbicsICdqYXZhdy5leGUnXTtcbiAgICAgIGNhc2UgJ2xpbnV4JzogcmV0dXJuIFsnYmluJywgJ2phdmEnXTtcbiAgICAgIGRlZmF1bHQ6IHRoaXMuX2ZhaWwoYHVuc3VwcG9ydGVkIHBsYXRmb3JtOiAke3RoaXMucGxhdGZvcm19YCk7XG4gICAgfVxuICB9XG5cbiAgX2dldERpc3BsYXlTZXJ2ZXIoKSB7XG4gICAgaWYgKHRoaXMucGxhdGZvcm0gIT09ICdsaW51eCcpIHJldHVybiAnbi9hJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd3YXlsYW5kJykgcmV0dXJuICd3YXlsYW5kJztcbiAgICBpZiAodGhpcy5fZW52LlhER19TRVNTSU9OX1RZUEUgPT09ICd4MTEnIHx8IHRoaXMuX2Vudi5ESVNQTEFZKSByZXR1cm4gJ3gxMSc7XG4gICAgcmV0dXJuICd1bmtub3duJztcbiAgfVxuXG4gIF9nZXRWZXJzaW9uKGNtZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYyhgJHtjbWR9IC0tdmVyc2lvbmAsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KS5zcGxpdCgnXFxuJylbMF07XG4gICAgICBjb25zdCB2ZXJzaW9uID0gb3V0cHV0Lm1hdGNoKC9bXFxkXSsoXFwuW1xcZF0rKSsvKTtcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uOiB2ZXJzaW9uPy5bMF0gfHwgJ3Vua25vd24nIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZlcnNpb246IG51bGwgfTtcbiAgICB9XG4gIH1cblxuICBfZ2V0SlJFKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBleGVjU3luYygnamF2YSAtdmVyc2lvbicsIHsgZW5jb2Rpbmc6ICd1dGYtOCcsIHN0ZGlvOiBbJ3BpcGUnLCAnaWdub3JlJywgJ3BpcGUnXSB9KTtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBvdXRwdXQubWF0Y2goL3ZlcnNpb24gXCIoW1xcZC5fXSspXCIvKT8uWzFdIHx8ICd1bmtub3duJztcbiAgICAgIGNvbnN0IGphdmFIb21lID0gdGhpcy5fZW52LkpBVkFfSE9NRSB8fCAnJztcbiAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2ZXJzaW9uLCBwYXRoOiBqYXZhSG9tZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2ZXJzaW9uOiBudWxsLCBwYXRoOiBudWxsIH07XG4gICAgfVxuICB9XG5cbiAgX2dldFdvcmtlckZpbGVOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLnBsYXRmb3JtID09PSAnbGludXgnID8gJ2ltYWdlV29ya2VyTGludXgubWpzJyA6ICdpbWFnZVdvcmtlclNoYXJwLm1qcyc7XG4gIH1cblxuICBfZ2V0V29ya2VyVVJMKCkge1xuICAgIGNvbnN0IHdvcmtlclBhdGggPSBqb2luKHRoaXMucHVibGljQmFzZSwgdGhpcy53b3JrZXJGaWxlTmFtZSk7XG4gICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwod29ya2VyUGF0aCk7XG4gIH1cblxuICBpc1dheWxhbmQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Vudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7XG4gIH1cblxuICBfaXNLREUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpO1xuICAgICAgcmV0dXJuIG91dCA9PT0gJ0tERSc7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNLREU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzR05PTUUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCdnbm9tZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2lzR05PTUU6IG5vIGRhdGFcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgX2lzVU5JVFkoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKCdlY2hvICRYREdfQ1VSUkVOVF9ERVNLVE9QJywgeyBzaGVsbDogJy9iaW4vYmFzaCcsIGVuY29kaW5nOiAndXRmLTgnLCBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAnaWdub3JlJ10gfSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gb3V0LmluY2x1ZGVzKCd1bml0eScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nLndhcm4oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaXNVTklUWTogbm8gZGF0YVwiLCBlcnIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9pbWFnZW1hZ2lja0F2YWlsYWJsZSgpIHtcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoXCJtYWdpY2sgLXZlcnNpb25cIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAvL2xvZy5pbmZvKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2ltYWdlbWFnaWNrQXZhaWxhYmxlOiBGb3VuZCBJbWFnZU1hZ2ljayB2NyAobWFnaWNrKVwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIC8vbG9nLmluZm8oXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfaW1hZ2VtYWdpY2tBdmFpbGFibGU6IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mbGFtZXNob3RBdmFpbGFibGUoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWNTeW5jKFwid2hpY2ggZmxhbWVzaG90XCIsIHsgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goXCJwbGF0Zm9ybURpc3BhdGNoZXIgQCBfZmxhbWVzaG90QXZhaWxhYmxlOiBGbGFtZXNob3Qgbm90IGZvdW5kXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIF9zZXR1cERlc2t0b3BQYXRoKCkge1xuICAgIHRoaXMuZGVza3RvcFBhdGggPSB0aGlzLl9nZXREZXNrdG9wUGF0aCgpO1xuICB9XG5cbiAgX2dldERlc2t0b3BQYXRoKCkge1xuICAgIGlmICh0aGlzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52WydVU0VSUFJPRklMRSddLCAnRGVza3RvcCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0Rlc2t0b3AnKTtcbiAgICB9XG4gIH1cblxuICBfZmFpbChtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgW3BsYXRmb3JtRGlzcGF0Y2hlcl0gJHttc2d9YCk7XG4gIH1cblxuICBfZ2V0SW1hZ2VNYWdpY2tWZXJzaW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhcIm1hZ2ljayAtdmVyc2lvblwiLCB7IHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIHY3IChtYWdpY2spXCIpO1xuICAgICAgcmV0dXJuIFwiN1wiO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXhlY1N5bmMoXCJ3aGljaCBpbXBvcnRcIiwgeyBzdGRpbzogJ2lnbm9yZScgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEZvdW5kIEltYWdlTWFnaWNrIDw3IChpbXBvcnQpXCIpO1xuICAgICAgICByZXR1cm4gXCI8N1wiO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRJbWFnZU1hZ2lja1ZlcnNpb246IEltYWdlTWFnaWNrIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldFVzZVdvcmtlcigpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlbWFnaWNrQXZhaWxhYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRTY3JlZW5zaG90QWJpbGl0eSgpIHtcbiAgICBpZiAodGhpcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgaWYgKCh0aGlzLl9pc0dOT01FKCkgfHwgdGhpcy5faXNVTklUWSgpKSAmJiB0aGlzLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogR05PTUUvVW5pdHkgKyBXYXlsYW5kIFx1MjAxMyBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2VcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNLREUoKSAmJiB0aGlzLmlzV2F5bGFuZCgpICYmIHRoaXMuX2ZsYW1lc2hvdEF2YWlsYWJsZSgpKSB7XG4gICAgICAgIHRoaXMubWVzc2FnZXMucHVzaChcInBsYXRmb3JtRGlzcGF0Y2hlciBAIF9nZXRTY3JlZW5zaG90QWJpbGl0eTogS0RFL1dheWxhbmQgKyBGbGFtZXNob3QgXHUyMDEzIFNjcmVlbnNob3RBYmlsaXR5IHNldCB0byB0cnVlXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNXYXlsYW5kKCkgJiYgdGhpcy51c2VXb3JrZXIpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBYMTEgKyBJbWFnZU1hZ2ljayBcdTIwMTMgU2NyZWVuc2hvdEFiaWxpdHkgc2V0IHRvIHRydWVcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKFwicGxhdGZvcm1EaXNwYXRjaGVyIEAgX2dldFNjcmVlbnNob3RBYmlsaXR5OiBTY3JlZW5zaG90QWJpbGl0eSBzZXQgdG8gZmFsc2UgXHUyMDEzIGZhbGxiYWNrIHRvIHBhZ2VjYXB0dXJlXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG59XG5cbmNvbnN0IHBsYXRmb3JtRGlzcGF0Y2hlciA9IG5ldyBQbGF0Zm9ybURpc3BhdGNoZXIoKTtcbmV4cG9ydCBkZWZhdWx0IHBsYXRmb3JtRGlzcGF0Y2hlcjtcbiIsICJcbi8qKlxuICogRE8gTk9UIEVESVQgLSB0aGlzIGZpbGUgaXMgd3JpdHRlbiBieSBwcmVidWlsZC5qcyBmcm9tIC5lbnYgLSBlZGl0IHZhcnMgaW4gLmVudiBmaWxlIVxuICovXG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgICBkZXZlbG9wbWVudDogdHJ1ZSwgIC8vIGRpc2FibGUga2lvc2sgbW9kZSBvbiBleGFtIG1vZGUgYW5kIG90aGVyIHN0dWZmIChhdXRvZmlsbCBpbnB1dCBmaWVsZHMpXG4gICAgc2hvd2RldnRvb2xzOiBmYWxzZSxcbiAgICB1c2VCdW5kbGVkSlJFOiB0cnVlLFxuICAgIGJpcEludGVncmF0aW9uOiB0cnVlLFxuICAgIGJpcERlbW86IHRydWUsXG4gICAgYmlwQXBpVXJsOiAnaHR0cHM6Ly9sb2NhbGhvc3Q6ODQ0NCcsXG5cbiAgICB3b3JrZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICB0ZW1wZGlyZWN0b3J5IDogXCJcIiwgICAvLyAoZGVza3RvcCBwYXRoICsgJ3RtcCcpXG4gICAgaG9tZWRpcmVjdG9yeSA6IFwiXCIsICAgLy8gc2V0IGluIG1haW4udHNcbiAgICBleGFtZGlyZWN0b3J5IDogXCJcIiwgICAgLy8gc2V0IGFmdGVyIHJlZ2lzdGVyaW5nIGluIGlwY0hhbmRsZXJcbiAgICBjbGllbnRkaXJlY3Rvcnk6ICdFWEFNLVNUVURFTlQnLFxuXG4gICAgc2VydmVyQXBpUG9ydDogMjI0MjIsICAvLyB0aGlzIGlzIG5lZWRlZCB0byBiZSByZWFjaGFibGUgb24gdGhlIHRlYWNoZXJzIHBjIGZvciBiYXNpYyBmdW5jdGlvbmFsaXR5XG4gICAgbXVsdGljYXN0Q2xpZW50UG9ydDogNjAyNCwgIC8vIG9ubHkgbmVlZGVkIGZvciBleGFtIGF1dG9kaXNjb3ZlcnlcblxuICAgIG11bHRpY2FzdFNlcnZlckFkcnI6ICcyMzkuMS4xLjEnLFxuICAgIGhvc3RpcDogXCJcIiwgICAgICAgLy8gc2VydmVyLmpzXG4gICAgZ2F0ZXdheTogdHJ1ZSxcbiAgICB2aXJ0dWFsaXplZDogZmFsc2UsXG4gICAgaXNQdWF2bzogZmFsc2UsXG4gICAgXG4gICAgdmVyc2lvbjogJzIuMC4wLjEnLFxuICAgIGJ1aWxkRGF0ZTogJzIwMjYwMzA2JyxcbiAgICBidWlsZE51bWJlcjogJzEnLFxuICAgIGluZm86ICdSZWxlYXNlJ1xufVxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBFTEVDVFJPTiBtYWluIGZpbGUgdGhhdCBhY3R1YWxseSBvcGVucyB0aGUgZWxlY3Ryb24gd2luZG93XG4gKi9cbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCBjaGFsayBmcm9tICdjaGFsayc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHBvd2VyU2F2ZUJsb2NrZXIsIG5hdGl2ZVRoZW1lLCBnbG9iYWxTaG9ydGN1dCwgVHJheSwgTWVudSwgZGlhbG9nLCBzZXNzaW9ufSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBjb25maWcgZnJvbSAnLi9tYWluL2NvbmZpZy5qcyc7XG5pbXBvcnQgbXVsdGljYXN0Q2xpZW50IGZyb20gJy4vbWFpbi9zY3JpcHRzL211bHRpY2FzdGNsaWVudC5qcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBmc0V4dHJhIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCBpcCBmcm9tICdpcCdcbmltcG9ydCB7IGdhdGV3YXk0c3luYyB9IGZyb20gJ2RlZmF1bHQtZ2F0ZXdheSc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL21haW4vc2NyaXB0cy93aW5kb3doYW5kbGVyLmpzJ1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2NvbW11bmljYXRpb25oYW5kbGVyLmpzJ1xuaW1wb3J0IElwY0hhbmRsZXIgZnJvbSAnLi9tYWluL3NjcmlwdHMvaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL21haW4vc2NyaXB0cy90cmF5bWVudS5qcydcbmltcG9ydCBKcmVIYW5kbGVyIGZyb20gJy4vbWFpbi9zY3JpcHRzL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCB7IGNoZWNrUGFyZW50UHJvY2VzcyB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL2NoZWNrcGFyZW50LmpzJztcblxuaW1wb3J0IHsgdG9nZ2xlTWFjT1NMb2NrZG93biB9IGZyb20gJy4vbWFpbi9zY3JpcHRzL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJ1xuSnJlSGFuZGxlci5pbml0KClcblxuXG5cbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xhbmcnLCAnZGUnKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2VuYWJsZS11bnNhZmUtc3dpZnRzaGFkZXInKTtcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2xvZy1sZXZlbCcsICczJyk7IC8vIDMgPSBXQVJOLCAyID0gRVJST1IsIDEgPSBJTkZPXG5cbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKXtcbiAgICBhcHAuY29tbWFuZExpbmUuYXBwZW5kU3dpdGNoKCdkaXNhYmxlLWZlYXR1cmVzJywgJ1ZhYXBpVmlkZW9EZWNvZGVyLE91dE9mUHJvY2Vzc1Jhc3Rlcml6YXRpb24sQ2FudmFzT29wUmFzdGVyaXphdGlvbicpOyAvLyBkaXNhYmxlIGZyYWdpbGUgR1BVIGZlYXR1cmVzXG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZGlzYWJsZS16ZXJvLWNvcHknKTsgXG59XG5lbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyl7XG4gICAgYXBwLmNvbW1hbmRMaW5lLmFwcGVuZFN3aXRjaCgnZW5hYmxlLWZlYXR1cmVzJywgJ01ldGFsLENhbnZhc09vcFJhc3Rlcml6YXRpb24nKTsgIC8vIG1hY29zIG9ubHlcbn1cblxuXG5cblxuXG5sb2cuaW5pdGlhbGl6ZSgpOyAvLyBpbml0aWFsaXplIHRoZSBsb2dnZXIgZm9yIGFueSByZW5kZXJlciBwcm9jZXNzXG5sb2cuZXZlbnRMb2dnZXIuc3RhcnRMb2dnaW5nKCk7XG5sb2cuZXJyb3JIYW5kbGVyLnN0YXJ0Q2F0Y2hpbmcoKTtcbmxvZy50cmFuc3BvcnRzLmZpbGUucmVzb2x2ZVBhdGhGbiA9ICgpID0+IHsgcmV0dXJuIHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlICB9XG5cbmxvZy50cmFuc3BvcnRzLmNvbnNvbGUuZm9ybWF0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAvLyBBbHdheXMgcmV0dXJuIGFuIGFycmF5LCBub3Qgc3RyaW5ncyFcbiAgICBzd2l0Y2ggKG1lc3NhZ2UubGV2ZWwpIHtcbiAgICAgIGNhc2UgJ2luZm8nOiByZXR1cm4gW2NoYWxrLmdyZWVuKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd3YXJuJzogcmV0dXJuIFtjaGFsay55ZWxsb3cobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIFtjaGFsay5yZWQobWVzc2FnZS5kYXRhLmpvaW4gPyBtZXNzYWdlLmRhdGEuam9pbignICcpIDogU3RyaW5nKG1lc3NhZ2UuZGF0YSkpXTtcbiAgICAgIGNhc2UgJ2RlYnVnJzogcmV0dXJuIFtjaGFsay5ibHVlKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBjYXNlICd2ZXJib3NlJzogcmV0dXJuIFtjaGFsay5tYWdlbnRhKG1lc3NhZ2UuZGF0YS5qb2luID8gbWVzc2FnZS5kYXRhLmpvaW4oJyAnKSA6IFN0cmluZyhtZXNzYWdlLmRhdGEpKV07XG4gICAgICBkZWZhdWx0OiAgICAgcmV0dXJuIFtTdHJpbmcobWVzc2FnZS5kYXRhKV07XG4gICAgfVxufTtcblxubG9nLnZlcmJvc2UoKVxubG9nLnZlcmJvc2UoYG1haW46IC0tLS0tLS0tLS0tLS0tLS0tLS1gKVxubG9nLnZlcmJvc2UoYG1haW46IHN0YXJ0aW5nIE5leHQtRXhhbSBTdHVkZW50IFwiJHtjb25maWcudmVyc2lvbn0gJHtjb25maWcuaW5mb31cIiAoJHtwcm9jZXNzLnBsYXRmb3JtfSkke2NvbmZpZy5kZXZlbG9wbWVudCA/ICcgKGRldm1vZGUgb24pJyA6ICcnfWApXG5sb2cudmVyYm9zZShgbWFpbjogLS0tLS0tLS0tLS0tLS0tLS0tLWApXG5sb2cuaW5mbyhgbWFpbjogTG9nZmlsZWxvY2F0aW9uIGF0ICR7cGxhdGZvcm1EaXNwYXRjaGVyLmxvZ2ZpbGV9YClcbnBsYXRmb3JtRGlzcGF0Y2hlci5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4geyBsb2cuZGVidWcobWVzc2FnZSkgfSk7XG5cbi8vIGxvZyBlbGVjdHJvbiB2ZXJzaW9uIGFuZCBvdGhlciBwbGF0Zm9ybSBpbmZvcm1hdGlvblxubG9nLmRlYnVnKGBtYWluOiBFbGVjdHJvbiB2ZXJzaW9uOiAke3Byb2Nlc3MudmVyc2lvbnMuZWxlY3Ryb259YClcbmxvZy5kZWJ1ZyhgbWFpbjogQ2hyb21pdW0gdmVyc2lvbjogJHtwcm9jZXNzLnZlcnNpb25zLmNocm9tZX1gKVxubG9nLmRlYnVnKGBtYWluOiBOb2RlIHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy5ub2RlfWApXG5sb2cuZGVidWcoYG1haW46IFY4IHZlcnNpb246ICR7cHJvY2Vzcy52ZXJzaW9ucy52OH1gKVxubG9nLmRlYnVnKGBtYWluOiBPUzogJHtwcm9jZXNzLnBsYXRmb3JtfSAke3Byb2Nlc3MuYXJjaH1gKVxubG9nLmRlYnVnKGBtYWluOiBBcmNoOiAke3Byb2Nlc3MuYXJjaH1gKVxuXG5cbldpbmRvd0hhbmRsZXIuaW5pdChtdWx0aWNhc3RDbGllbnQsIGNvbmZpZykgIC8vIG1haW53aW5kb3csIGV4YW13aW5kb3csIGJsb2Nrd2luZG93XG5Db21tSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnKSAgICAvLyBzdGFydHMgXCJiZWFjb25cIiBpbnRlcnZhbGwgYW5kIGZldGNoZXMgaW5mb3JtYXRpb24gZnJvbSB0aGUgdGVhY2hlciAtIGFjdHMgb24gaXQgKHN0YXJ0ZXhhbSwgc3RvcGV4YW0sIHNlbmRmaWxlLCBnZXRmaWxlKVxuSXBjSGFuZGxlci5pbml0KG11bHRpY2FzdENsaWVudCwgY29uZmlnLCBXaW5kb3dIYW5kbGVyLCBDb21tSGFuZGxlcikgIC8vY29udHJvbGwgYWxsIEludGVyIFByb2Nlc3MgQ29tbXVuaWNhdGlvblxuXG4vLyBQcmV2ZW50cyBFbGVjdHJvbiBmcm9tIGNyZWF0aW5nIHRoZSBkZWZhdWx0IG1lbnVcbk1lbnUuc2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXG5cbmlmICghYXBwLnJlcXVlc3RTaW5nbGVJbnN0YW5jZUxvY2soKSkgeyAgLy8gYWxsb3cgb25seSBvbmUgaW5zdGFuY2Ugb2YgdGhlIGFwcCBwZXIgY2xpZW50XG4gICAgbG9nLndhcm4oXCJtYWluIEAgc2luZ2xlaW5zdGFuY2U6IG5leHQtZXhhbSBhbHJlYWR5IHJ1bm5pbmcuXCIpXG4gICAgYXBwLnF1aXQoKVxuICAgIHByb2Nlc3MuZXhpdCgwKVxufVxuXG5hcHAub24oJ3NlY29uZC1pbnN0YW5jZScsICgpID0+IHtcbiAgICBsb2cud2FybihcIm1haW4gQCBzaW5nbGVpbnN0YW5jZTogcHJldmVudGVkIHNlY29uZCBzdGFydCBvZiBuZXh0LWV4YW0uIFJlc3RvcmluZyBleGlzdGluZyBOZXh0LUV4YW0gd2luZG93LlwiKVxuICAgIGlmIChXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cpIHtcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc01pbmltaXplZCgpIHx8ICFXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5zaG93KClcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5yZXN0b3JlKClcbiAgICAgICAgfSBcbiAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmZvY3VzKCkgLy8gRm9jdXMgb24gdGhlIG1haW4gd2luZG93IGlmIHRoZSB1c2VyIHRyaWVkIHRvIG9wZW4gYW5vdGhlclxuICAgIH1cbn0pXG5cblxuLyoqXG4gKiBhZGRpdGlvbmFsIGNvbmZpZyBzZXR0aW5ncyBhbmQgcGF0aCBjaGVja3NcbiAqL1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBpbXBvcnQubWV0YS5kaXJuYW1lO1xuXG5jb25maWcuaG9tZWRpcmVjdG9yeSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5O1xuY29uZmlnLndvcmtkaXJlY3RvcnkgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2RpcmVjdG9yeTtcbmNvbmZpZy50ZW1wZGlyZWN0b3J5ID0gcGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3Rvcnk7XG5jb25maWcuZXhhbWRpcmVjdG9yeSA9IGNvbmZpZy53b3JrZGlyZWN0b3J5ICAgIC8vIHdlIG5lZWQgdGhpcyB2YXJpYWJsZSBzZXR1cCBldmVuIGlmIHdlIGRvIG5vdCBjb25uZWN0IHRvIGEgdGVhY2hlciBpbnN0YW5jZVxuXG5cbmlmICghZnMuZXhpc3RzU3luYyhjb25maWcud29ya2RpcmVjdG9yeSkpeyBmcy5ta2RpclN5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9XG5pZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy50ZW1wZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuaWYgKCFmcy5leGlzdHNTeW5jKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCkpIHsgIGZzLm1rZGlyU3luYyhwbGF0Zm9ybURpc3BhdGNoZXIuZGVza3RvcFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9ICAvLyBDaGVjayBpZiB0aGUgZGVza3RvcCBmb2xkZXIgZXhpc3RzIGFuZCBjcmVhdGUgaWYgaXQgZG9lc24ndFxuXG4vLyBDcmVhdGUgdGhlIHN5bWJvbGljIGxpbmsgdG8gdGhlIHdvcmtkaXJlY3Rvcnkgb24gdGhlIGRlc2t0b3BcbmNvbnN0IGxpbmtQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5kZXNrdG9wUGF0aCwgY29uZmlnLmNsaWVudGRpcmVjdG9yeSk7ICAvLyBEZWZpbmUgdGhlIHBhdGggZm9yIHRoZSBzeW1ib2xpYyBsaW5rXG50cnkge2ZzLnVubGlua1N5bmMobGlua1BhdGgpIH1jYXRjaChlKXt9XG50cnkgeyAgIGlmICghZnMuZXhpc3RzU3luYyhsaW5rUGF0aCkpIHsgZnMuc3ltbGlua1N5bmMoY29uZmlnLndvcmtkaXJlY3RvcnksIGxpbmtQYXRoLCAnanVuY3Rpb24nKTsgfX1cbmNhdGNoKGUpe2xvZy5lcnJvcihcIm1haW4gQCBjcmVhdGUtc3ltbGluazogY2FuJ3QgY3JlYXRlIHN5bWxpbmtcIil9XG5cblxudHJ5IHsgLy9iaW5kIHRvIHRoZSBjb3JyZWN0IGludGVyZmFjZVxuICAgIGNvbnN0IHsgZ2F0ZXdheSwgaW50ZXJmYWNlOiBpZmFjZX0gPSBnYXRld2F5NHN5bmMoKTsgXG4gICAgY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpICAgIC8vIHRoaXMgcmV0dXJucyB0aGUgaXAgb2YgdGhlIGludGVyZmFjZSB0aGF0IGhhcyBhIGRlZmF1bHQgZ2F0ZXdheS4uICBzaG91bGQgd29yayBpbiBNT1NUIGNhc2VzLiAgcHJvYmFibHkgcHJvdmlkZSBcImlwLW9wdGlvbnNcIiBpbiBVSSA/XG4gICAgY29uZmlnLmdhdGV3YXkgPSB0cnVlXG59XG4gY2F0Y2ggKGUpIHtcbiAgIGxvZy5lcnJvcihcIm1haW4gQCBnYXRld2F5NHN5bmM6IHVuYWJsZSB0byBkZXRlcm1pbmUgZGVmYXVsdCBnYXRld2F5XCIpXG4gICBjb25maWcuaG9zdGlwID0gaXAuYWRkcmVzcygpIFxuICAgbG9nLmluZm8oYG1haW46IElQICR7Y29uZmlnLmhvc3RpcH1gKVxuICAgY29uZmlnLmdhdGV3YXkgPSBmYWxzZVxuIH1cblxuXG5mc0V4dHJhLmVtcHR5RGlyU3luYyhjb25maWcudGVtcGRpcmVjdG9yeSkgIC8vIGNsZWFuIHRlbXAgZGlyZWN0b3J5XG5cblxuXG5cblxuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBzcGVjaWZpY2FsbHkgY2hlY2tzIGZvciBFUElQRSBlcnJvcnMgYW5kIGRpc2FibGVzIHRoZSBjb25zb2xlIHRyYW5zcG9ydCBmb3IgdGhlIEVsZWN0cm9uTG9nZ2VyIGlmIHN1Y2ggYW4gZXJyb3Igb2NjdXJzLlxuICogRVBJUEUgZXJyb3JzIHR5cGljYWxseSBoYXBwZW4gd2hlbiB0cnlpbmcgdG8gd3JpdGUgdG8gYSBjbG9zZWQgcGlwZSwgd2hpY2ggY2FuIG9jY3VyIGlmIHRoZSBzdGRvdXQgc3RyZWFtIGlzIHVuZXhwZWN0ZWRseSBjbG9zZWQuXG4gKi9cbnByb2Nlc3Muc3Rkb3V0Lm9uKCdlcnJvcicsIChlcnIpID0+IHsgaWYgKGVyci5jb2RlID09PSAnRVBJUEUnKSB7IGxvZy50cmFuc3BvcnRzLmNvbnNvbGUubGV2ZWwgPSBmYWxzZSB9IH0pO1xuXG4vLyBGaWx0ZXIgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIGFuZCBXZWJDb250ZW50cyBzdWJmcmFtZSBlcnJvcnMgZnJvbSBzdGRlcnIvc3Rkb3V0XG5jb25zdCBvcmlnaW5hbFN0ZGVycldyaXRlID0gcHJvY2Vzcy5zdGRlcnIud3JpdGU7XG5jb25zdCBvcmlnaW5hbFN0ZG91dFdyaXRlID0gcHJvY2Vzcy5zdGRvdXQud3JpdGU7XG5cbnByb2Nlc3Muc3RkZXJyLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3RkZXJyV3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Muc3Rkb3V0LndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBmZCkge1xuICAgIGNvbnN0IGNodW5rU3RyID0gY2h1bms/LnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgLy8gU3VwcHJlc3MgR1VFU1RfVklFV19NQU5BR0VSX0NBTEwgZXJyb3JzIChFUlJfQUJPUlRFRCBmcm9tIHdlYnZpZXcgbmF2aWdhdGlvbiBibG9ja2luZylcbiAgICBpZiAoY2h1bmtTdHIuaW5jbHVkZXMoJ0dVRVNUX1ZJRVdfTUFOQUdFUl9DQUxMJykgJiYgKGNodW5rU3RyLmluY2x1ZGVzKCdFUlJfQUJPUlRFRCcpIHx8IGNodW5rU3RyLmluY2x1ZGVzKCcoLTMpJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBEcm9wIHRoaXMgZXJyb3JcbiAgICB9XG4gICAgLy8gU3VwcHJlc3MgV2ViQ29udGVudHMgc3ViZnJhbWUgZXJyb3JzXG4gICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdXZWJDb250ZW50cyNkaWQtZmFpbC1sb2FkJykgfHwgY2h1bmtTdHIuaW5jbHVkZXMoJ1dlYkNvbnRlbnRzI2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnKSkge1xuICAgICAgICBjb25zdCBzdXBwcmVzc0NvZGVzID0gWy0zLCAtMTAwLCAtMTAxLCAtMTA1XTtcbiAgICAgICAgaWYgKGNodW5rU3RyLmluY2x1ZGVzKCdpc01haW5GcmFtZTogZmFsc2UnKSB8fCBzdXBwcmVzc0NvZGVzLnNvbWUoY29kZSA9PiBjaHVua1N0ci5pbmNsdWRlcyhgZXJyb3JDb2RlOiAke2NvZGV9YCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRHJvcCB0aGlzIGVycm9yXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsU3Rkb3V0V3JpdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgKGVycikgPT4ge1xuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VQSVBFJykge1xuICAgICAgICBsb2cudHJhbnNwb3J0cy5jb25zb2xlLmxldmVsID0gZmFsc2U7XG4gICAgICAgIGxvZy53YXJuKCdtYWluIEAgdW5jYXVnaHRFeGNlcHRpb246IEVQSVBFIEVycm9yOiBUaGUgc3Rkb3V0IHN0cmVhbSBvZiB0aGUgRWxlY3Ryb25Mb2dnZXIgd2lsbCBiZSBkaXNhYmxlZC4nKTtcbiAgICB9IFxuICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlPy5pbmNsdWRlcygnUmVuZGVyIGZyYW1lIHdhcyBkaXNwb3NlZCcpKSByZXR1cm47XG4gICAgZWxzZSB7ICBsb2cuZXJyb3IoJ21haW4gQCB1bmNhdWdodEV4Y2VwdGlvbjonLCBlcnIubWVzc2FnZSk7IH0gIC8vIExvZyBvciBkaXNwbGF5IG90aGVyIGVycm9yc1xufSk7XG5cbi8vIEhhbmRsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb25zIHRvIHByZXZlbnQgY3Jhc2hlc1xucHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgKHJlYXNvbiwgcHJvbWlzZSkgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIHJlYXNvbik7XG4gICAgaWYgKHJlYXNvbiBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHVuaGFuZGxlZFJlamVjdGlvbjogU3RhY2s6JywgcmVhc29uLnN0YWNrKTtcbiAgICB9XG59KTtcblxuLy8gSGFuZGxlIHJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlcyAoVjggZmF0YWwgZXJyb3JzLCBldGMuKVxuYXBwLm9uKCdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCB3ZWJDb250ZW50cywgZGV0YWlscykgPT4ge1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlbmRlcmVyIHByb2Nlc3MgY3Jhc2hlZCcpO1xuICAgIGxvZy5lcnJvcignbWFpbiBAIHJlbmRlci1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhpdCBjb2RlOicsIGRldGFpbHMuZXhpdENvZGUpO1xuICAgIFxuICAgIC8vIFRyeSB0byBpZGVudGlmeSB3aGljaCB3aW5kb3cgY3Jhc2hlZFxuICAgIGNvbnN0IGFsbFdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCBjcmFzaGVkV2luZG93ID0gYWxsV2luZG93cy5maW5kKHdpbiA9PiB3aW4ud2ViQ29udGVudHMuaWQgPT09IHdlYkNvbnRlbnRzLmlkKTtcbiAgICBcbiAgICBpZiAoY3Jhc2hlZFdpbmRvdykge1xuICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgdGl0bGU6ICR7Y3Jhc2hlZFdpbmRvdy5nZXRUaXRsZSgpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGV4YW0gd2luZG93IGNyYXNoZXMsIHRyeSB0byBjbG9zZSBpdCBncmFjZWZ1bGx5XG4gICAgICAgIGlmIChjcmFzaGVkV2luZG93ID09PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghY3Jhc2hlZFdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCByZW5kZXItcHJvY2Vzcy1nb25lOiBFcnJvciBjbG9zaW5nIGV4YW0gd2luZG93OicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2VzcyAtIGxldCBpdCBjb250aW51ZVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gSGFuZGxlIGNoaWxkIHByb2Nlc3MgY3Jhc2hlcyAod29ya2VycywgZXRjLilcbmFwcC5vbignY2hpbGQtcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiB7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBDaGlsZCBwcm9jZXNzIGNyYXNoZWQnKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFR5cGU6JywgZGV0YWlscy50eXBlKTtcbiAgICBsb2cuZXJyb3IoJ21haW4gQCBjaGlsZC1wcm9jZXNzLWdvbmU6IFJlYXNvbjonLCBkZXRhaWxzLnJlYXNvbik7XG4gICAgbG9nLmVycm9yKCdtYWluIEAgY2hpbGQtcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgXG4gICAgLy8gRG9uJ3QgY3Jhc2ggdGhlIG1haW4gcHJvY2Vzc1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG59KTtcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG5hbWUgZm9yIFdpbmRvd3MgMTArIG5vdGlmaWNhdGlvbnNcbmlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7ICBhcHAuc2V0QXBwVXNlck1vZGVsSWQoYXBwLmdldE5hbWUoKSl9XG4vL2lmIChwcm9jZXNzLnBsYXRmb3JtID09PSdkYXJ3aW4nKSB7ICBhcHAuZG9jay5oaWRlKCkgfSAgLy8gdGhpcyBidWcgc3RhdGVzIHRoYXQgaXQga2luZGEgbWVzc2VzIHVwIGtpb3NrIG1vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjA3XG5cblxuXG4vLyBoaWRlIGNlcnRpZmljYXRlIHdhcm5pbmdzIGluIGNvbnNvbGUuLiB3ZSBrbm93IHdlIHVzZSBhIHNlbGYgc2lnbmVkIGNlcnQgYW5kIGRvIG5vdCB2YWxpZGF0ZSBpdFxucHJvY2Vzcy5lbnZbXCJOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEXCJdID0gXCIwXCI7XG5wcm9jZXNzLmVudi5OT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEID0gXCIwXCI7XG5jb25zdCBvcmlnaW5hbEVtaXRXYXJuaW5nID0gcHJvY2Vzcy5lbWl0V2FybmluZ1xucHJvY2Vzcy5lbWl0V2FybmluZyA9ICh3YXJuaW5nLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKHdhcm5pbmcgJiYgd2FybmluZy5pbmNsdWRlcyAmJiB3YXJuaW5nLmluY2x1ZGVzKCdOT0RFX1RMU19SRUpFQ1RfVU5BVVRIT1JJWkVEJykpIHsgIHJldHVybiB9XG4gICAgcmV0dXJuIG9yaWdpbmFsRW1pdFdhcm5pbmcuY2FsbChwcm9jZXNzLCB3YXJuaW5nLCBvcHRpb25zKVxufVxuXG5hcHAub24oJ2NlcnRpZmljYXRlLWVycm9yJywgKGV2ZW50LCB3ZWJDb250ZW50cywgdXJsLCBlcnJvciwgY2VydGlmaWNhdGUsIGNhbGxiYWNrKSA9PiB7IC8vIFNTTC9UTFM6IHRoaXMgaXMgdGhlIHNlbGYgc2lnbmVkIGNlcnRpZmljYXRlIHN1cHBvcnRcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBPbiBjZXJ0aWZpY2F0ZSBlcnJvciB3ZSBkaXNhYmxlIGRlZmF1bHQgYmVoYXZpb3VyIChzdG9wIGxvYWRpbmcgdGhlIHBhZ2UpXG4gICAgY2FsbGJhY2sodHJ1ZSk7ICAvLyBhbmQgd2UgdGhlbiBzYXkgXCJpdCBpcyBhbGwgZmluZSAtIHRydWVcIiB0byB0aGUgY2FsbGJhY2tcbn0pO1xuXG4vLyBIYW5kbGUgV2ViQ29udGVudHMgbG9hZCBmYWlsdXJlcyB0byBwcmV2ZW50IGFwcCBjcmFzaGVzXG5hcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCB3ZWJDb250ZW50cykgPT4ge1xuICAgIGNvbnN0IHN1cHByZXNzQ29kZXMgPSBbLTMsIC0xMDAsIC0xMDEsIC0xMDVdO1xuXG4gICAgLy8gU3RvcmUgaWYgd2UndmUgYWxyZWFkeSBzZXQgdXAgbGlzdGVuZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBpZiAod2ViQ29udGVudHMuX2Vycm9yU3VwcHJlc3Npb25TZXR1cCkgcmV0dXJuO1xuICAgIHdlYkNvbnRlbnRzLl9lcnJvclN1cHByZXNzaW9uU2V0dXAgPSB0cnVlO1xuXG4gICAgLy8gU2V0IHVwIGxpc3RlbmVycyB0aGF0IHBlcnNpc3QgYWNyb3NzIG5hdmlnYXRpb25cbiAgICBjb25zdCBzZXR1cEVycm9yU3VwcHJlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzIGZpcnN0IHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgd2ViQ29udGVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCdkaWQtZmFpbC1wcm92aXNpb25hbC1sb2FkJyk7XG4gICAgICAgIHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGlkLWZhaWwtbG9hZCcpO1xuICAgICAgICBcbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLXByb3Zpc2lvbmFsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtcHJvdmlzaW9uYWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2ViQ29udGVudHMub24oJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGVycm9yQ29kZSwgZXJyb3JEZXNjcmlwdGlvbiwgdmFsaWRhdGVkVVJMLCBpc01haW5GcmFtZSwgZnJhbWVQcm9jZXNzSWQsIGZyYW1lUm91dGluZ0lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBzdXBwcmVzcyBzdWJmcmFtZSBlcnJvcnMgYW5kIGNvbW1vbiBlcnJvciBjb2Rlc1xuICAgICAgICAgICAgaWYgKCFpc01haW5GcmFtZSB8fCBzdXBwcmVzc0NvZGVzLmluY2x1ZGVzKGVycm9yQ29kZSkpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgZGlkLWZhaWwtbG9hZDogRXJyb3IgJHtlcnJvckNvZGV9IC0gJHtlcnJvckRlc2NyaXB0aW9ufSBmb3IgVVJMOiAke3ZhbGlkYXRlZFVSTH1gKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB1cCBpbW1lZGlhdGVseVxuICAgIHNldHVwRXJyb3JTdXBwcmVzc2lvbigpO1xuXG4gICAgLy8gUmUtc2V0dXAgb24gbmF2aWdhdGlvbiB0byBlbnN1cmUgbGlzdGVuZXJzIHBlcnNpc3RcbiAgICB3ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIHdlYkNvbnRlbnRzLm9uKCdkaWQtZnJhbWUtbmF2aWdhdGUnLCBzZXR1cEVycm9yU3VwcHJlc3Npb24pO1xuICAgIFxuICAgIC8vIEhhbmRsZSByZW5kZXJlciBwcm9jZXNzIGNyYXNoZXMgZm9yIHNwZWNpZmljIHdlYkNvbnRlbnRzIChWOCBmYXRhbCBlcnJvcnMsIGV0Yy4pXG4gICAgd2ViQ29udGVudHMub24oJ3JlbmRlci1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogUmVuZGVyZXIgcHJvY2VzcyBjcmFzaGVkIGZvciBzcGVjaWZpYyB3ZWJDb250ZW50cycpO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBSZWFzb246JywgZGV0YWlscy5yZWFzb24pO1xuICAgICAgICBsb2cuZXJyb3IoJ21haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBFeGl0IGNvZGU6JywgZGV0YWlscy5leGl0Q29kZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBUcnkgdG8gaWRlbnRpZnkgd2hpY2ggd2luZG93IHRoaXMgd2ViQ29udGVudHMgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBhbGxXaW5kb3dzID0gQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCk7XG4gICAgICAgIGNvbnN0IGNyYXNoZWRXaW5kb3cgPSBhbGxXaW5kb3dzLmZpbmQod2luID0+IHdpbi53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IFdpbmRvdyB0aXRsZTogJHtjcmFzaGVkV2luZG93LmdldFRpdGxlKCl9YCk7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYG1haW4gQCB3ZWJDb250ZW50cyByZW5kZXItcHJvY2Vzcy1nb25lOiBXaW5kb3cgVVJMOiAke2NyYXNoZWRXaW5kb3cud2ViQ29udGVudHMuZ2V0VVJMKCl9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZvciBleGFtIHdpbmRvdyBjcmFzaGVzLCB0cnkgdG8gY2xvc2UgaXQgZ3JhY2VmdWxseVxuICAgICAgICAgICAgaWYgKGNyYXNoZWRXaW5kb3cgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKCdtYWluIEAgd2ViQ29udGVudHMgcmVuZGVyLXByb2Nlc3MtZ29uZTogRXhhbSB3aW5kb3cgY3Jhc2hlZCwgYXR0ZW1wdGluZyB0byBjbG9zZSBncmFjZWZ1bGx5Jyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFzaGVkV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyYXNoZWRXaW5kb3cuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbURpc3BsYXlJZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdlYkNvbnRlbnRzIHJlbmRlci1wcm9jZXNzLWdvbmU6IEVycm9yIGNsb3NpbmcgZXhhbSB3aW5kb3c6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIERvbid0IGNyYXNoIHRoZSBtYWluIHByb2Nlc3MgLSBsZXQgaXQgY29udGludWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9KTtcbn0pO1xuXG5hcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgYXN5bmMgKCkgPT4geyAgLy8gbGFzdCB3aW5kb3cgY2xvc2VkIFx1MjAxMyBjbGVhciBzdG9yYWdlIGhlcmUgdG8gYXZvaWQgTGludXggc2VnZmF1bHQgaW4gYmVmb3JlLXF1aXRcbiAgICBjbGVhckludGVydmFsKCBDb21tSGFuZGxlci51cGRhdGVTdHVkZW50SW50ZXJ2YWxsIClcbiAgICBpZiAoV2luZG93SGFuZGxlci5jaGVja1dpbmRvd0ludGVydmFsPy5zdG9wKSBXaW5kb3dIYW5kbGVyLmNoZWNrV2luZG93SW50ZXJ2YWwuc3RvcCgpXG4gICAgaWYgKENvbW1IYW5kbGVyLnVwZGF0ZVNjaGVkdWxlcj8uc3RvcCkgQ29tbUhhbmRsZXIudXBkYXRlU2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyPy5zdG9wKSBDb21tSGFuZGxlci5zY3JlZW5zaG90U2NoZWR1bGVyLnN0b3AoKVxuICAgIGlmIChtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyPy5zdG9wKSBtdWx0aWNhc3RDbGllbnQucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0b3AoKVxuICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdyA9IG51bGxcblxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlc3Npb24uZGVmYXVsdFNlc3Npb24uY2xlYXJTdG9yYWdlRGF0YSh7fSk7IC8vIGNsZWFyIGNvb2tpZXMsIGNhY2hlLCBsb2NhbFN0b3JhZ2UgZXRjLiB3aGlsZSBzZXNzaW9uIHN0aWxsIHZhbGlkXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy5lcnJvcignbWFpbiBAIHdpbmRvdy1hbGwtY2xvc2VkOiBFcnJvciBjbGVhcmluZyBzdG9yYWdlOicsIGVycik7XG4gICAgfVxuICAgIGFwcC5xdWl0KCk7XG59KTtcblxuYXBwLm9uKCd3aWxsLXF1aXQnLCAoKSA9PiB7ICAvLyBpZiB3aW5kb3cgaXMgY2xvc2VkXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bihmYWxzZSlcbn0pXG5cbmFwcC5vbignYWN0aXZhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgYWxsV2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpXG4gICAgaWYgKGFsbFdpbmRvd3MubGVuZ3RoKSB7IGFsbFdpbmRvd3NbMF0uZm9jdXMoKSB9IFxuICAgIGVsc2UgeyBXaW5kb3dIYW5kbGVyLmNyZWF0ZU1haW5XaW5kb3coKSB9XG59KVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBhcHAgd2FzIHN0YXJ0ZWQgZnJvbSB3aXRoaW4gYSBicm93c2VyIGFuZCBxdWl0IGlmIGRldGVjdGVkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1BhcmVudFByb2Nlc3MoKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQ6JywgcmVzdWx0LmVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZm91bmRCcm93c2VyKSB7XG4gICAgICAgICAgICBsb2cud2FybignbWFpbiBAIGNoZWNrUGFyZW50OiBUaGUgYXBwIHdhcyBzdGFydGVkIGRpcmVjdGx5IGZyb20gYSBicm93c2VyJyk7XG4gICAgICAgICAgICBkaWFsb2cuc2hvd01lc3NhZ2VCb3hTeW5jKFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICAgICAgYnV0dG9uczogWydPSyddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVGVybWluYXRlIFByb2dyYW0nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdVbmVybGF1YnRlciBQcm9ncmFtbXN0YXJ0IGF1cyBlaW5lbSBXZWJicm93c2VyIGVya2FubnQuXFxuTmV4dC1FeGFtIHdpcmQgYmVlbmRldCEnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTtcbiAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuaW5mbygnbWFpbiBAIGNoZWNrcGFyZW50OiBQYXJlbnQgUHJvY2VzcyBDaGVjayBPSycpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKCdtYWluIEAgY2hlY2tQYXJlbnQgZXJyb3I6JywgZXJyb3IpO1xuICAgIH1cbn1cblxuYXBwLndoZW5SZWFkeSgpXG4udGhlbihhc3luYyAoKT0+e1xuXG4gICAgbmF0aXZlVGhlbWUudGhlbWVTb3VyY2UgPSAnbGlnaHQnICAvLyBwcmV2ZW50IHRoZW1lIHNldHRpbmdzIGZyb20gYmVpbmcgYWRvcHRlZCBmcm9tIHdpbmRvd3NcbiAgICBzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLnNldFVzZXJBZ2VudChgTmV4dC1FeGFtLyR7Y29uZmlnLnZlcnNpb259ICgke2NvbmZpZy5pbmZvfSkgJHtwcm9jZXNzLnBsYXRmb3JtfWApOyAgLy8gc2V0IHVzZXIgYWdlbnQgZm9yIGFsbCBzZXNzaW9uc1xuICAgIHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0Q2VydGlmaWNhdGVWZXJpZnlQcm9jKChyZXF1ZXN0LCBjYWxsYmFjaykgPT4geyBjYWxsYmFjaygwKTsgfSk7ICAgLy8gc2V0IGNlcnRpZmljYXRlIHZlcmlmaWNhdGlvbiBnbG9iYWxseSBmb3IgYWxsIHNlc3Npb25zXG4gICAgXG4gICAgdG9nZ2xlTWFjT1NMb2NrZG93bih0cnVlKTtcbiAgIFxuICAgIC8qKioqKioqIENyZWF0ZSBtYWluIHdpbmRvdyAqKioqKioqL1xuICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlTWFpbldpbmRvdygpXG5cblxuICAgIGlmIChjb25maWcuaG9zdGlwID09IFwiMTI3LjAuMC4xXCIpIHsgY29uZmlnLmhvc3RpcCA9IGZhbHNlIH1cbiAgICBpZiAoY29uZmlnLmhvc3RpcCkgeyBtdWx0aWNhc3RDbGllbnQuaW5pdChjb25maWcuZ2F0ZXdheSkgIH0gLy9tdWx0aWNhc3QgY2xpZW50IG9ubHkgdHJhY2tzIG90aGVyIGV4YW0gaW5zdGFuY2VzIG9uIHRoZSBuZXR3b3JrXG5cbiAgICBjb25zdCBhbGxvd1RyYXkgPSAhcGxhdGZvcm1EaXNwYXRjaGVyLl9pc0dOT01FKCk7IC8vIEdOT01FIGhpZGVzIGxlZ2FjeSB0cmF5XG4gICAgaWYgKCFjb25maWcuZGV2ZWxvcG1lbnQpe1xuICAgICAgICBwb3dlclNhdmVCbG9ja2VyLnN0YXJ0KCdwcmV2ZW50LWRpc3BsYXktc2xlZXAnKSAgIC8vIHByZXZlbnQgdGhlIGRldmljZSBmcm9tIGdvaW5nIHRvIHNsZWVwXG4gICAgICAgIGlmIChhbGxvd1RyYXkpIHsgdXBkYXRlU3lzdGVtVHJheSgnZGUnKTsgfSAgICAgICAgLy8gc2tpcCB0cmF5IG9uIEdOT01FXG4gICAgICAgIGVsc2UgeyBsb2cuaW5mbygnbWFpbiBAIHRyYXk6IEdOT01FIGRldGVjdGVkLCBza2lwcGluZyBzeXN0ZW0gdHJheScpOyB9XG4gICAgICAgIHJ1blBhcmVudFByb2Nlc3NDaGVjaygpOyAgLy8gdGhpcyBjaGVja3MgaWYgdGhlIGFwcCB3YXMgc3RhcnRlZCBmcm9tIHdpdGhpbiBhIGJyb3dzZXIgKGRpcmVjdGx5IGFmdGVyIGRvd25sb2FkKVxuICAgIH1cbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrRycsICgpID0+IHsgIGlmIChnbG9iYWwgJiYgZ2xvYmFsLmdjKXsgZ2xvYmFsLmdjKHt0eXBlOidtYXlvcicsZXhlY3V0aW9uOiAnYXN5bmMnfSk7IGdsb2JhbC5nYyh7dHlwZTonbWlub3InLGV4ZWN1dGlvbjogJ2FzeW5jJ30pOyAgfX0pO1xuICAgICAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtUJywgKCkgPT4geyAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7IGlmICh3aW4pIHsgd2luLndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCkgfX0pO1xuICAgIH1cblxuICAgIC8vdGhlc2UgYXJlIHNvbWUgc2hvcnRjdXRzIHdlIHRyeSB0byBjYXB0dXJlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignRjUnLCAoKSA9PiB7fSk7ICAvL3JlbG9hZCBwYWdlXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrUicsICgpID0+IHt9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQWx0K0Y0JywgKCkgPT4ge30pOyAgLy9leGl0IGFwcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1cnLCAoKSA9PiB7fSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrUScsICgpID0+IHt9KTsgIC8vcXVpdFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0QnLCAoKSA9PiB7fSk7ICAvL3Nob3cgZGVza3RvcFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0wnLCAoKSA9PiB7fSk7ICAvL2xvY2tzY3JlZW5cbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtQJywgKCkgPT4ge30pOyAgLy9jaGFuZ2Ugc2NyZWVuIGxheW91dFxuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdBbHQrTGVmdCcsICgpID0+IHsgIHJldHVybiBmYWxzZSB9KTsgIC8vIE5hdmlnYXRpb24gYXR0ZW1wdCBibG9ja2VkXG59KVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cblxuaW1wb3J0IGRncmFtIGZyb20gJ2RncmFtJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vY29uZmlnLmpzJzsgIC8vIG5vZGUgbm90IHZ1ZSAocmVsYXRpdmUgcGF0aCBuZWVkZWQpXG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcblxuLyoqXG4gKiBTVE9SRVMgQUxMIENMSUVOVC9TZXJ2ZXIgSU5GT1JNQVRJT05cbiAqIFN0YXJ0cyBhIGRncmFtICh1ZHApIHNvY2tldCB0aGF0IGxpc3RlbnMgZm9yIG11bGl0Y2FzdCBtZXNzYWdlc1xuICovXG5cbmNsYXNzIE11bHRpY2FzdENsaWVudCB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLlBPUlQgPSBjb25maWcubXVsdGljYXN0Q2xpZW50UG9ydFxuICAgICAgICB0aGlzLk1VTFRJQ0FTVF9BRERSID0gY29uZmlnLm11bHRpY2FzdFNlcnZlckFkcnJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3QgPSBbXVxuICAgICAgICB0aGlzLnNlcnZlcnN0YXR1cyA9IHt9XG4gICAgICAgIHRoaXMuY2xpZW50aW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IFwiRGVtb1VzZXJcIixcbiAgICAgICAgICAgIHRva2VuOiBmYWxzZSxcbiAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IDEsXG4gICAgICAgICAgICBpcDogZmFsc2UsICAvLyBpcCBhZGRyZXNzIHdpcmQgdm9tIG11bHRpY2FzdHNlcnZlciB0ZWFjaGVyIG1pdCBnZXNjaGlja3RcbiAgICAgICAgICAgIGhvc3RuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHNlcnZlcmlwOiBmYWxzZSwgICAvLyB3aXJkIGxva2FsIGdlc2V0enQgKGlzdCBhYmVyIGxvZ2lzY2hlcndlaXNlIGdsZWljaCBkZXIgaXAgZGVzIG11bHRpY2FzdHNlcnZlcnMpXG4gICAgICAgICAgICBzZXJ2ZXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlLFxuICAgICAgICAgICAgZXhhbW1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBmYWxzZSxcbiAgICAgICAgICAgIHZpcnR1YWxpemVkOiBmYWxzZSwgIC8vIHRoaXMgY29uZmlnIHNldHRpbmcgaXMgc2V0IGJ5IHNpbXBsZXZtZGV0ZWN0LmpzIChlbGVjdHJvbiBwcmVsb2FkKVxuICAgICAgICAgICAgZXhhbXR5cGUgOiBmYWxzZSxcbiAgICAgICAgICAgIHBpbjogZmFsc2UsXG4gICAgICAgICAgICBzY3JlZW5sb2NrOiBmYWxzZSxcbiAgICAgICAgICAgIG1zb2ZmaWNlc2hhcmU6IGZhbHNlLFxuICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiA0MDAwLCAgIC8vbWlsbGlzZWNvbmRzXG4gICAgICAgICAgICBwcmludHJlcXVlc3QgOiBmYWxzZSxcbiAgICAgICAgICAgIHByaXZhdGVTcGVsbGNoZWNrOiB7YWN0aXZhdGVkOiBmYWxzZX0sXG4gICAgICAgICAgICBsb2NhbExvY2tkb3duOiBmYWxzZSxcbiAgICAgICAgICAgIGdyb3VwOiAnYScsXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiAwLFxuICAgICAgICAgICAgbG9jYWxWTUhvc3Q6IG51bGwsXG4gICAgICAgICAgICBsb2NhbFZNU3RhdGU6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlY2VpdmVzIG1lc3NhZ2VzIGFuZCBzdG9yZXMgbmV3IGV4YW0gaW5zdGFuY2VzIGluIHRoaXMuZXhhbVNlcnZlckxpc3RbXVxuICAgICAqIHN0YXJ0cyBhbiBpbnRlcnZhbGwgdG8gY2hlY2sgc2VydmVyIHN0YXR1cyBhbmQgcmVhY3RzIG9uIGluZm9ybWF0aW9uIGdpdmVuIGJ5IHRoZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbml0IChnYXRld2F5KSB7XG4gICAgICAgIHRoaXMuZ2F0ZXdheSA9IGdhdGV3YXlcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZ3JhbS5jcmVhdGVTb2NrZXQoJ3VkcDQnKSAgLy8gbW92aW5nIHRoaXMgaGVyZSB3aWxsIGFsbG93IHRvIHJlc3Bhd24gaXQgaWYgYmluZGluZyBmYWlsc1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogVURQIE1DIENsaWVudCBlcnJvcjpcXG4ke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LmNsb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBCaW5kIGF1ZiAwLjAuMC4wLCBkYW1pdCB3aXIgYXVmIGFsbGVuIEludGVyZmFjZXMgbGF1c2NoZW47IEludGVyZmFjZS1BdXN3YWhsIGVyZm9sZ3QgXHUwMEZDYmVyIGFkZE1lbWJlcnNoaXAoKVxuICAgICAgICAgICAgdGhpcy5jbGllbnQuYmluZCh0aGlzLlBPUlQsICcwLjAuMC4wJywgICgpID0+IHsgXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0QnJvYWRjYXN0KHRydWUpXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuc2V0TXVsdGljYXN0VFRMKDEyOCk7IFxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGpvaW4gbXVsdGljYXN0IGdyb3VwIGF1ZiBkZXIgdGF0c1x1MDBFNGNobGljaCBlcm1pdHRlbHRlbiBJbnRlcmZhY2UtSVBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGllbnQuYWRkTWVtYmVyc2hpcCh0aGlzLk1VTFRJQ0FTVF9BRERSLCBjb25maWcuaG9zdGlwKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIGluaXQ6IGpvaW5lZCAke3RoaXMuTVVMVElDQVNUX0FERFJ9IG9uIGlmYWNlICR7Y29uZmlnLmhvc3RpcH1gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgbXVsdGljYXN0Y2xpZW50IEAgaW5pdDogYWRkTWVtYmVyc2hpcCBmYWlsZWQgZm9yICR7dGhpcy5NVUxUSUNBU1RfQUREUn0gb24gJHtjb25maWcuaG9zdGlwfWAsIGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ2F0ZXdheSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcIm11bHRpY2FzdGNsaWVudCBAIGluaXQ6IE5vIGRlZmF1bHQgZ2F0ZXdheSBkZXRlY3RlZCBcdTIwMTMgam9pbmVkIG11bHRpY2FzdCBncm91cCBvbiBsb2NhbCBpbnRlcmZhY2VcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBtdWx0aWNhc3RjbGllbnQgQCBpbml0OiBVRFAgTUMgQ2xpZW50IGxpc3RlbmluZyBvbiAwLjAuMC4wOiR7dGhpcy5jbGllbnQuYWRkcmVzcygpLnBvcnR9IChob3N0aXA9JHtjb25maWcuaG9zdGlwfSlgKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSl7IFxuICAgICAgICAgICAgbG9nLmVycm9yKGBtdWxpdGNhc3RjbGllbnQgQCBpbml0OiAke2V9YCkgXG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZScsIChtZXNzYWdlLCByaW5mbykgPT4geyB0aGlzLm1lc3NhZ2VSZWNlaXZlZChtZXNzYWdlLCByaW5mbykgfSlcbiBcbiAgICAgICAgLy9jaGVjayBmb3IgZGVwcmVjYXRlZCBpbnN0YW5jZSBpbiBhIGxvb3BcbiAgICAgICAgdGhpcy5yZWZyZXNoRXhhbXNTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLmlzRGVwcmVjYXRlZEluc3RhbmNlLmJpbmQodGhpcyksIDUwMDApXG4gICAgICAgIHRoaXMucmVmcmVzaEV4YW1zU2NoZWR1bGVyLnN0YXJ0KClcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZWNlaXZlcyBtZXNzYWdlcyBhbmQgc3RvcmVzIG5ldyBleGFtIGluc3RhbmNlcyBpbiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W11cbiAgICAgKi9cbiAgICAgbWVzc2FnZVJlY2VpdmVkIChtZXNzYWdlLCByaW5mbykge1xuICAgICAgICBjb25zdCBzZXJ2ZXJJbmZvID0gSlNPTi5wYXJzZShTdHJpbmcobWVzc2FnZSkpXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVyaXAgPSByaW5mby5hZGRyZXNzXG4gICAgICAgIHNlcnZlckluZm8uc2VydmVycG9ydCA9IHJpbmZvLnBvcnRcbiAgICAgICAgc2VydmVySW5mby5yZWFjaGFibGUgPSB0cnVlXG4gICAgICAgIHNlcnZlckluZm8udGltZXN0YW1wID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgICAvL3JlY29yZCB0aW1lc3RhbXAgb2YgbGFzdCBtZXNzYWdlIGZyb20gc2VydmVyIChpZ25vcmUgc2VydmVydGltZXN0YW1wIGJlY2F1c2UgaXQgbWF5IGhhdmUgYSBkaWZmZXJlbnQgc3lzdGVtIHRpbWUpXG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5pc05ld0V4YW1JbnN0YW5jZShzZXJ2ZXJJbmZvKSkge1xuICAgICAgICAgICAgbG9nLmluZm8oYG11bHRpY2FzdGNsaWVudCBAIG1lc3NhZ2VSZWNlaXZlZDogQWRkaW5nIG5ldyBFeGFtIEluc3RhbmNlIFwiJHtzZXJ2ZXJJbmZvLnNlcnZlcm5hbWV9XCIgdG8gU2VydmVybGlzdGApXG4gICAgICAgICAgICB0aGlzLmV4YW1TZXJ2ZXJMaXN0LnB1c2goc2VydmVySW5mbylcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0aGUgbWVzc2FnZSBjYW1lIGZyb20gYSBuZXcgZXhhbSBpbnN0YW5jZSBvciBhbiBvbGQgb25lIHRoYXQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICovXG4gICAgaXNOZXdFeGFtSW5zdGFuY2UgKG9iaikge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZXhhbVNlcnZlckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLmlkID09PSBvYmouaWQpIHtcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKCdleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGluZyB0aW1lc3RhbXAnKVxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbVNlcnZlckxpc3RbaV0udGltZXN0YW1wID0gb2JqLnRpbWVzdGFtcCAvLyBleGlzdGluZyBzZXJ2ZXIgLSB1cGRhdGUgdGltZXN0YW1wXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3Mgc2VydmVydGltZXN0YW1wIGFuZCByZW1vdmVzIHNlcnZlciBmcm9tIGxpc3QgaWYgb2xkZXIgdGhhbiAxIG1pbnV0ZVxuICAgICAqL1xuICAgIGlzRGVwcmVjYXRlZEluc3RhbmNlICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV4YW1TZXJ2ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuXG4gICAgICAgICAgICBpZiAobm93IC0gMTYwMDAgPiB0aGlzLmV4YW1TZXJ2ZXJMaXN0W2ldLnRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtdWx0aWNhc3RjbGllbnQgQCBpc0RlcHJlY2F0ZWRJbnN0YW5jZTogUmVtb3ZpbmcgaW5hY3RpdmUgc2VydmVyICcke3RoaXMuZXhhbVNlcnZlckxpc3RbaV0uc2VydmVybmFtZX0nIGZyb20gbGlzdGApXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtU2VydmVyTGlzdC5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11bHRpY2FzdENsaWVudCgpXG4iLCAiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNsYXNzIFNjaGVkdWxlclNlcnZpY2UgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgYWN0aW9uOiAoKSA9PiB2b2lkO1xuICAgIGhhbmRsZTogTm9kZUpTLlRpbWVyO1xuICAgIGludGVydmFsOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihhY3Rpb246ICgpID0+IHZvaWQsIG1zOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hY3Rpb24gPSBhY3Rpb247XG4gICAgICAgIHRoaXMuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmludGVydmFsID0gbXM7XG4gICAgICAgIHRoaXMuYWRkTGlzdGVuZXIoJ3RpbWVvdXQnLCB0aGlzLmFjdGlvbik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHRoaXMuZW1pdCgndGltZW91dCcpLCB0aGlzLmludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5oYW5kbGUpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5oYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59IiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCwgYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZO1xuICogd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS5cbiAqIFNlZSB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqIFxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZyB3aXRoIHRoaXMgcHJvZ3JhbS5cbiAqIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPlxuICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIEJyb3dzZXJWaWV3LCBkaWFsb2csIHNjcmVlbn0gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJ1xuaW1wb3J0IHtTY2hlZHVsZXJTZXJ2aWNlfSBmcm9tICcuL3NjaGVkdWxlcnNlcnZpY2UudHMnXG5pbXBvcnQgeyBhY3RpdmVXaW5kb3cgfSBmcm9tICdnZXQtd2luZG93cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuLy8gUmVuZGVyZXIgYnVpbHQgaW50byBwdWJsaWMvIChvbmUgY29weSk7IHdoZW4gcGFja2FnZWQgdXNlIGFwcC5hc2FyLnVucGFja2VkL3B1YmxpY1xuZnVuY3Rpb24gZ2V0UmVuZGVyZXJJbmRleFBhdGgoKSB7XG4gIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgIGNvbnN0IHVucGFja2VkID0gam9pbihwcm9jZXNzLnJlc291cmNlc1BhdGgsICdhcHAuYXNhci51bnBhY2tlZCcsICdwdWJsaWMnLCAnaW5kZXguaHRtbCcpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHVucGFja2VkKSkgcmV0dXJuIHVucGFja2VkO1xuICB9XG4gIGNvbnN0IHB1YmxpY1BhdGggPSBqb2luKF9fZGlybmFtZSwgJ3B1YmxpYycsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHB1YmxpY1BhdGgpKSByZXR1cm4gcHVibGljUGF0aDtcbiAgY29uc3QgZGlzdFJlbmRlcmVyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnZGlzdCcsICdyZW5kZXJlcicsICdpbmRleC5odG1sJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKGRpc3RSZW5kZXJlclBhdGgpKSByZXR1cm4gZGlzdFJlbmRlcmVyUGF0aDtcbiAgY29uc3QgcXVhc2FyUGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpO1xuICBpZiAoZnMuZXhpc3RzU3luYyhxdWFzYXJQYXRoKSkgcmV0dXJuIHF1YXNhclBhdGg7XG4gIHJldHVybiBqb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbn1cblxuXG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBXaW5kb3cgaGFuZGxpbmcgKGlwY1JlbmRlcmVyIFByb2Nlc3MgLSBGcm9udGVuZCkgU1RBUlRcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbmNsYXNzIFdpbmRvd0hhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgdGhpcy5zY3JlZW5sb2NrV2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5tYWlud2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbFxuICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXJ2ZWQgZGlzcGxheSBJRCBmb3IgZXhhbSB3aW5kb3cgKHNldCBpbW1lZGlhdGVseSB3aGVuIHdpbmRvdyBpcyBjcmVhdGVkKVxuICAgICAgdGhpcy5zcGxhc2h3aW4gPSBudWxsXG4gICAgICB0aGlzLmJpcHdpbmRvdyA9IG51bGxcbiAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgXG4gICAgICB0aGlzLmV4aXRXYXJuaW5nT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHdhcm5pbmcgZGlhbG9nIGlzIG9wZW5cbiAgICAgIHRoaXMuZXhpdFF1ZXN0aW9uT3BlbiA9IGZhbHNlICAvLyB0cmFjayBpZiBleGl0IHF1ZXN0aW9uIGRpYWxvZyBpcyBvcGVuXG4gICAgICB0aGlzLm1pbmltaXplV2FybmluZ09wZW4gPSBmYWxzZSAgLy8gdHJhY2sgaWYgbWluaW1pemUgd2FybmluZyBkaWFsb2cgaXMgb3BlblxuICAgIH1cblxuICAgIGluaXQgKG1jLCBjb25maWcpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBtY1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZ1xuICAgICAgICB0aGlzLmNoZWNrV2luZG93SW50ZXJ2YWwgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLndpbmRvd1RyYWNrZXIuYmluZCh0aGlzKSwgMTAwMClcbiAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGVsZWN0cm9uIHdpbmRvdyBpbiBmb2N1cyBvciBhbiBvdGhlciBlbGVjdHJvbiB3aW5kb3cgZGVwZW5kaW5nIG9uIHRoZSBoaWVyYWNoeVxuICAgIGdldEN1cnJlbnRGb2N1c2VkV2luZG93KCkge1xuICAgICAgICBjb25zdCBmb2N1c2VkV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICAgIGlmIChmb2N1c2VkV2luZG93KSB7XG4gICAgICAgICAgcmV0dXJuIGZvY3VzZWRXaW5kb3dcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbmxvY2tXaW5kb3cpe3JldHVybiB0aGlzLnNjcmVlbmxvY2tXaW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmV4YW13aW5kb3cpe3JldHVybiB0aGlzLmV4YW13aW5kb3d9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1haW53aW5kb3cpe3JldHVybiB0aGlzLm1haW53aW5kb3d9XG4gICAgICAgICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdCkge1xuICAgICAgICB0aGlzLmJpcHdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogMTAwMCxcbiAgICAgICAgICAgIGhlaWdodDo4MDAsXG4gICAgICAgICAgICBhbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIHNraXBUYXNrYmFyOnRydWUsXG4gICAgICAgICAgICBhdXRvSGlkZU1lbnVCYXI6IHRydWUsXG4gICAgICAgICAgIC8vIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgIC8vIG1vdmFibGU6IGZhbHNlLFxuICAgICAgICAgICAvLyBmcmFtZTogZmFsc2UsXG4gICAgICAgICAgICBzaG93OiBmYWxzZSxcbiAgICAgICAgICAgLy8gdHJhbnNwYXJlbnQ6IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlmIChiaXB0ZXN0KXsgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3EuYmlsZHVuZy5ndi5hdC9hZG1pbi90b29sL21vYmlsZS9sYXVuY2gucGhwP3NlcnZpY2U9bW9vZGxlX21vYmlsZV9hcHAmcGFzc3BvcnQ9bmV4dC1leGFtYCkgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICB0aGlzLmJpcHdpbmRvdy5sb2FkVVJMKGBodHRwczovL3d3dy5iaWxkdW5nLmd2LmF0L2FkbWluL3Rvb2wvbW9iaWxlL2xhdW5jaC5waHA/c2VydmljZT1tb29kbGVfbW9iaWxlX2FwcCZwYXNzcG9ydD1uZXh0LWV4YW1gKSAgIH1cblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYmlwd2luZG93ICYmICF0aGlzLmJpcHdpbmRvdy5pc1Zpc2libGUoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmlwd2luZG93LnNob3coKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignZGlkLW5hdmlnYXRlJywgKGV2ZW50LCB1cmwpID0+IHsgICAgLy8gYSBwZGYgY291bGQgY29udGFpbiBhIGxpbmsgXl5cbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBkaWQtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4geyAgICAvLyBhIHBkZiBjb3VsZCBjb250YWluIGEgbGluayBeXlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHdpbGwtbmF2aWdhdGVcIilcbiAgICAgICAgICAgIGxvZy5pbmZvKHVybClcbiAgICAgICAgfSlcblxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyAgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB3aW5kb3cub3BlbigpXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogbmV3LXdpbmRvd1wiKVxuICAgICAgICAgICAgbG9nLmluZm8odXJsKVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICAgLy8gUHJldmVudCB0aGUgbmV3IHdpbmRvdyBmcm9tIG9wZW5pbmdcbiAgICAgICAgfSk7IFxuICAgICBcbiAgICAgICAgIFxuICAgICAgICAgdGhpcy5iaXB3aW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHsgLy8gaWYgYSBuZXcgd2luZG93IHNob3VsZCBvcGVuIHRyaWdnZXJlZCBieSB0YXJnZXQ9XCJfYmxhbmtcIlxuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgY3JlYXRlQmlQTG9naW5XaW46IHRhcmdldDogX2JsYW5rXCIpXG4gICAgICAgICAgICBsb2cuaW5mbyh1cmwpXG4gICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9OyAgIC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgIH0pOyBcblxuICAgICAgICB0aGlzLmJpcHdpbmRvdy53ZWJDb250ZW50cy5vbignd2lsbC1yZWRpcmVjdCcsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbygnd2luZG93aGFuZGxlciBAIGNyZWF0ZUJpUExvZ2luV2luOiBSZWRpcmVjdGluZyB0bzonLCB1cmwpO1xuICAgICAgICAgICAgLy8gUHJcdTAwRkNmZW4sIG9iIGRpZSBVUkwgZGFzIGdld1x1MDBGQ25zY2h0ZSBGb3JtYXQgaGF0XG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2JpbGR1bmdzcG9ydGFsOi8vJykpIHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBWZXJoaW5kZXJ0IGRlbiBTdGFuZGFyZC1SZWRpcmVjdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9ICdiaWxkdW5nc3BvcnRhbDovL3Rva2VuPSc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHVybC5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogQ2FwdHVyZWQgVG9rZW46Jyk7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ3dpbmRvd2hhbmRsZXIgQCBjcmVhdGVCaVBMb2dpbldpbjogJyArIHRva2VuKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmlwVG9rZW4nLCB0b2tlbik7XG4gICAgICAgICAgICAgICAgdGhpcy5iaXB3aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhbiBlYXN0ZXIgZWdnXG4gICAgICovXG4gICAgY3JlYXRlRWFzdGVyV2luKCkge1xuICAgICAgICB0aGlzLmVhc3RlcndpbiA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgY2VudGVyOnRydWUsXG4gICAgICAgICAgICB3aWR0aDogNzY4LFxuICAgICAgICAgICAgaGVpZ2h0OjQ4MCxcbiAgICAgICAgICAgIGFsd2F5c09uVG9wOiB0cnVlLFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIGF1dG9IaWRlTWVudUJhcjogdHJ1ZSxcbiAgICAgICAgICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiB0cnVlLFxuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIHRoaXMuZWFzdGVyd2luLmxvYWRGaWxlKGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdjb3dzb25pY2UnLCAnaW5kZXguaHRtbCcpKVxuXG4gICAgICAgIC8vIEVsZWN0cm9uIDM5OiByZWFkeS10by1zaG93IGZpcmVzIEFGVEVSIHNob3coKSBpcyBjYWxsZWQsIHNvIHVzZSBkaWQtZmluaXNoLWxvYWQgaW5zdGVhZFxuICAgICAgICB0aGlzLmVhc3Rlcndpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5lYXN0ZXJ3aW4gJiYgIXRoaXMuZWFzdGVyd2luLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lYXN0ZXJ3aW4uc2hvdygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBCbG9ja1dpbmRvdyAodG8gY292ZXIgYWRkaXRpb25hbCBzY3JlZW5zKVxuICAgICAqIEBwYXJhbSBkaXNwbGF5IFxuICAgICAqL1xuICAgIG5ld0Jsb2NrV2luKGRpc3BsYXkpIHtcbiAgICAgICAgbGV0IGJsb2Nrd2luID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgeDogZGlzcGxheS5ib3VuZHMueCArIDAsXG4gICAgICAgICAgICB5OiBkaXNwbGF5LmJvdW5kcy55ICsgMCxcbiAgICAgICAgICAgIHBhcmVudDogdGhpcy5leGFtd2luZG93LFxuICAgICAgICAgICAgc2tpcFRhc2tiYXI6dHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICBmb2N1c2FibGU6IGZhbHNlLCAgIC8vZG9lc24ndCB3b3JrIHdpdGgga2lvc2sgbW9kZSAobm8ga2lvc2sgbW9kZSBwb3NzaWJsZS4uIHdoeT8pXG4gICAgICAgICAgICBtaW5pbWl6YWJsZTogZmFsc2UsXG4gICAgICAgICAgICAvLyByZXNpemFibGU6ZmFsc2UsICAgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICAgIGxldCB1cmwgPSBcIm5vdGZvdW5kXCJcbiAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICBibG9ja3dpbi5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIGJsb2Nrd2luLmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBibG9ja3dpbi5yZW1vdmVNZW51KCkgXG4gICAgICAgIGJsb2Nrd2luLnNldE1pbmltaXphYmxlKGZhbHNlKVxuXG4gICAgICAgIC8vIFBvc2l0aW9uIHdpbmRvdyBvbiBzcGVjaWZpYyBkaXNwbGF5IEJFRk9SRSBzaG93aW5nIGl0XG4gICAgICAgIGJsb2Nrd2luLnNldEJvdW5kcyh7XG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54LFxuICAgICAgICAgICAgeTogZGlzcGxheS5ib3VuZHMueSxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGJsb2Nrd2luLnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICBibG9ja3dpbi5zaG93KClcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBcbiAgICAgICAgICAgIGJsb2Nrd2luLnNldEZ1bGxTY3JlZW4odHJ1ZSk7XG4gICAgICAgICAgICBibG9ja3dpbi5vbignbGVhdmUtZnVsbC1zY3JlZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYmxvY2t3aW4uc2V0RnVsbFNjcmVlbih0cnVlKTsgLy8gc29mb3J0IHdpZWRlciB6dXJcdTAwRkNja3NldHplblxuICAgICAgICAgICAgfSk7IFxuICAgICAgICB9ICBcbiAgICAgICAgZWxzZSB7ICAgXG4gICAgICAgICAgICBibG9ja3dpbi5zZXRLaW9zayh0cnVlKTsgLy8gS2lvc2sgPSBcInRha2Ugb3ZlciBtYWluIHNjcmVlblwiLiBvbiBtYWNvcyB0aGF0J3Mgd2h5IHdlIHVzZSBmdWxsU2NyZWVuIHdvcmthcm91bmQgd2l0aCBldmVudCBsaXN0ZW5lclxuICAgICAgICB9XG4gICAgICAgIGJsb2Nrd2luLm1vdmVUb3AoKTtcbiAgICAgICAgYmxvY2t3aW4uZGlzcGxheSA9IGRpc3BsYXlcbiAgICAgICAgdGhpcy5ibG9ja3dpbmRvd3MucHVzaChibG9ja3dpbilcbiAgICB9XG5cblxuICAgIC8vIGJsb2NrIGFsbCBzY3JlZW5zIHdpdGggYSBibG9ja3dpbmRvd1xuICAgIGFzeW5jIGluaXRCbG9ja1dpbmRvd3MoKXtcbiAgICAgICAgbGV0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgLy9sb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGZvdW5kICR7ZGlzcGxheXMubGVuZ3RofSBkaXNwbGF5c2ApXG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7ICAvLyBsb2NrIGFsbCBzY3JlZW5zXG4gICAgICAgICAgICBpZiAoZGlzcGxheXMubGVuZ3RoIDw9IDEpIHJldHVyblxuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZXhhbSB3aW5kb3cgdG8gYmUgdmlzaWJsZSBhbmQgcG9zaXRpb25lZDsgbmV2ZXIgY3JlYXRlIGJsb2NrIHdpbmRvd3MgYmVmb3JlIHRoYXRcbiAgICAgICAgICAgIGxldCBleGFtUmVhZHkgPSBmYWxzZVxuICAgICAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyAmJiAhdGhpcy5leGFtd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0cmllcyA9IDBcbiAgICAgICAgICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gMTBcbiAgICAgICAgICAgICAgICB3aGlsZSAoIXRoaXMuZXhhbXdpbmRvdy5pc1Zpc2libGUoKSAmJiByZXRyaWVzIDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMClcbiAgICAgICAgICAgICAgICAgICAgcmV0cmllcysrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cuaXNWaXNpYmxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhhbVJlYWR5ID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAvLyBBZGRpdGlvbmFsIHdhaXQgdG8gZW5zdXJlIHBvc2l0aW9uaW5nIGlzIGNvbXBsZXRlIG9uIFdheWxhbmRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWV4YW1SZWFkeSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGV4YW0gd2luZG93IG5vdCByZWFkeSwgc2tpcHBpbmcgYmxvY2sgd2luZG93IGNyZWF0aW9uXCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBibG9jayB3aW5kb3dzIGZyb20gYXJyYXlcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzID0gdGhpcy5ibG9ja3dpbmRvd3MuZmlsdGVyKGJsb2Nrd2luID0+IGJsb2Nrd2luICYmICFibG9ja3dpbi5pc0Rlc3Ryb3llZCgpKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgYWxsIGV4aXN0aW5nIHdpbmRvd3MgYW5kIGRldGVybWluZSB0aGVpciBkaXNwbGF5c1xuICAgICAgICAgICAgY29uc3QgdXNlZERpc3BsYXlJZHMgPSBuZXcgU2V0KClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmlyc3QsIHVzZSB0aGUgcmVzZXJ2ZWQgZXhhbSBkaXNwbGF5IElEIChzZXQgaW1tZWRpYXRlbHkgd2hlbiBleGFtIHdpbmRvdyB3YXMgY3JlYXRlZClcbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgc2NyZWVuIGlzIHJlc2VydmVkIGV2ZW4gaWYgdGhlIHdpbmRvdyBpc24ndCBmdWxseSBpbml0aWFsaXplZCB5ZXRcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW1EaXNwbGF5SWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLmV4YW1EaXNwbGF5SWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQodGhpcy5leGFtRGlzcGxheUlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDaGVjayBleGFtIHdpbmRvdyBkaXNwbGF5IChhcyBmYWxsYmFjay92ZXJpZmljYXRpb24sIGJ1dCByZXNlcnZlZCBJRCB0YWtlcyBwcmlvcml0eSlcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YW13aW5kb3cgJiYgIXRoaXMuZXhhbXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBzY3JlZW4uZ2V0RGlzcGxheU1hdGNoaW5nKGJvdW5kcylcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRpc3BsYXkgJiYgZGlzcGxheS5pZCAhPT0gdW5kZWZpbmVkICYmIGRpc3BsYXkuaWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZWREaXNwbGF5SWRzLmFkZChkaXNwbGF5LmlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBleGFtIHdpbmRvdyBpcyBvbiBkaXNwbGF5ICR7ZGlzcGxheS5pZH1gKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgd2luZG93aGFuZGxlciBAIGluaXRCbG9ja1dpbmRvd3M6IGVycm9yIGdldHRpbmcgZXhhbSB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGJsb2NrIHdpbmRvd3MgZGlzcGxheXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgYmxvY2t3aW4gb2YgdGhpcy5ibG9ja3dpbmRvd3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBibG9ja3dpbi5nZXRCb3VuZHMoKVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5ID0gc2NyZWVuLmdldERpc3BsYXlNYXRjaGluZyhib3VuZHMpXG4gICAgICAgICAgICAgICAgICAgIGlmIChkaXNwbGF5ICYmIGRpc3BsYXkuaWQgIT09IHVuZGVmaW5lZCAmJiBkaXNwbGF5LmlkICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VkRGlzcGxheUlkcy5hZGQoZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogYmxvY2sgd2luZG93IGZvdW5kIG9uIGRpc3BsYXkgJHtkaXNwbGF5LmlkfWApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogZXJyb3IgZ2V0dGluZyBibG9jayB3aW5kb3cgZGlzcGxheTogJHtlcnJ9YClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBibG9jayB3aW5kb3dzIGZvciBkaXNwbGF5cyB0aGF0IGRvbid0IGhhdmUgZXhhbSBvciBibG9jayB3aW5kb3dzXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBpZiAodXNlZERpc3BsYXlJZHMuaGFzKGRpc3BsYXkuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGB3aW5kb3doYW5kbGVyIEAgaW5pdEJsb2NrV2luZG93czogc2tpcHBpbmcgZGlzcGxheSAke2Rpc3BsYXkuaWR9IC0gYWxyZWFkeSBoYXMgZXhhbSBvciBibG9jayB3aW5kb3dgKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBpbml0QmxvY2tXaW5kb3dzOiBjcmVhdGUgYmxvY2t3aW4gb246XCIsZGlzcGxheS5pZClcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0Jsb2NrV2luKGRpc3BsYXkpICAvLyBhZGQgYmxvY2t3aW5kb3dzIGZvciBkaXNwbGF5cyB3aXRob3V0IGV4YW0gd2luZG93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMClcbiAgICAgICAgICAgIHRoaXMuYmxvY2t3aW5kb3dzLmZvckVhY2goIChibG9ja3dpbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChibG9ja3dpbiAmJiAhYmxvY2t3aW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbi5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBTY3JlZW5sb2NrIFdpbmRvdyAodG8gY292ZXIgdGhlIG1haW5zY3JlZW4pIC0gYmxvY2sgc3R1ZGVudHMgZnJvbSB3b3JraW5nXG4gICAgICogQHBhcmFtIGRpc3BsYXkgXG4gICAgICovXG4gICAgY3JlYXRlU2NyZWVubG9ja1dpbmRvdyhkaXNwbGF5KSB7XG4gICAgICAgIGxldCBzY3JlZW5sb2NrV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgICAgICAgICAgc2hvdzogZmFsc2UsXG4gICAgICAgICAgICB4OiBkaXNwbGF5LmJvdW5kcy54ICsgMCxcbiAgICAgICAgICAgIHk6IGRpc3BsYXkuYm91bmRzLnkgKyAwLFxuICAgICAgICAgICAgLy8gcGFyZW50OiB0aGlzLm1haW53aW5kb3csICAgLy8gbGVhZHMgdG8gdmlzaWJsZSB0aXRsZWJhciBpbiBnbm9tZS1kZXNrdG9wXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgdGl0bGU6ICdTY3JlZW5sb2NrJyxcbiAgICAgICAgICAgIHdpZHRoOiBkaXNwbGF5LmJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGlzcGxheS5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgY2xvc2FibGU6IGZhbHNlLFxuICAgICAgICAgICAgYWx3YXlzT25Ub3A6IHRydWUsXG4gICAgICAgICAgICAvL2ZvY3VzYWJsZTogZmFsc2UsICAgLy9kb2Vzbid0IHdvcmsgd2l0aCBraW9zayBtb2RlIChubyBraW9zayBtb2RlIHBvc3NpYmxlLi4gd2h5PylcbiAgICAgICAgICAgIG1pbmltaXphYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIC8vIHJlc2l6YWJsZTpmYWxzZSwgLy8gbGVhZHMgdG8gd2VpcmQgMjBweCBib3R0b21zcGFjZSBvbiB3aW5kb3dzXG4gICAgICAgICAgICBtb3ZhYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIGZyYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIGljb246IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uLnBuZycpLFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBqb2luKF9fZGlybmFtZSwgJy4vcHJlbG9hZC9lbGVjdHJvbi1wcmVsb2FkLmNqcycpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHVybCA9IFwibG9ja1wiXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9L2B9KVxuICAgICAgICB9IFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9L2BcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubG9hZFVSTCh1cmwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgIH1cblxuICAgICAgICAvLyBBZGQgd2luZG93IHRvIGFycmF5IGZpcnN0LCBiZWZvcmUgYWRkaW5nIGJsdXIgbGlzdGVuZXJcbiAgICAgICAgdGhpcy5zY3JlZW5sb2Nrd2luZG93cy5wdXNoKHNjcmVlbmxvY2tXaW5kb3cpXG5cbiAgICAgICAgLy8gRWxlY3Ryb24gMzk6IHJlYWR5LXRvLXNob3cgZmlyZXMgQUZURVIgc2hvdygpIGlzIGNhbGxlZCwgc28gdXNlIGRpZC1maW5pc2gtbG9hZCBpbnN0ZWFkXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cud2ViQ29udGVudHMub25jZSgnZGlkLWZpbmlzaC1sb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFzY3JlZW5sb2NrV2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cucmVtb3ZlTWVudSgpIFxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRNaW5pbWl6YWJsZShmYWxzZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0S2lvc2sodHJ1ZSlcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJwb3AtdXAtbWVudVwiLCAxKSAgIC8vYWJvdmUgZXhhbSB3aW5kb3cgKHBvcC11cC1tZW51LCAwKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHNjcmVlbmxvY2tXaW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRDbG9zYWJsZSh0cnVlKVxuICAgICAgICAgICAgc2NyZWVubG9ja1dpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUpOyAvLyBwdXQgdGhlIHdpbmRvdyBvbiBhbGwgdmlydHVhbCB3b3Jrc3BhY2VzXG4gICAgICAgICAgICB0aGlzLmFkZEJsdXJMaXN0ZW5lcihcInNjcmVlbmxvY2tcIilcbiAgICAgICAgfSlcblxuICAgICAgICBzY3JlZW5sb2NrV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jICAoZSkgPT4geyAgIC8vIHdpbmRvdyBzaG91bGQgbm90IGJlIGNsb3NlZCBtYW51YWxseS4uIGV2ZXIhIGJ1dCBpZiB5b3UgZG8gbWFrZSBzdXJlIHRvIGNsZWFuIGV4YW13aW5kb3cgdmFyaWFibGUgYW5kIGVuZCBleGFtIGZvciB0aGUgY2xpZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50KSB7IGUucHJldmVudERlZmF1bHQoKTsgfSAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNjcmVlbmxvY2tXaW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHsgICAvLyByZW1vdmUgd2luZG93IGZyb20gYXJyYXkgd2hlbiBhY3R1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIHRoaXMuc2NyZWVubG9ja3dpbmRvd3MgPSB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmIHdpbiAhPT0gc2NyZWVubG9ja1dpbmRvdyAmJiAhd2luLmlzRGVzdHJveWVkKCkpXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiAgICAvKipcbiAgICAgKiBFeGFtd2luZG93XG4gICAgICogQHBhcmFtIGV4YW10eXBlIGVkdXZpZHVhbCwgbWF0aCwgbGFuZ3VhZ2VcbiAgICAgKiBAcGFyYW0gdG9rZW4gc3R1ZGVudCB0b2tlblxuICAgICAqIEBwYXJhbSBzZXJ2ZXJzdGF0dXMgdGhlIHNlcnZlcnN0YXR1cyBvYmplY3QgY29udGFpbmluZyBpbmZvIGFib3V0IHNwZWxsY2hlY2sgbGFuZ3VhZ2UgZXRjLiBcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVFeGFtV2luZG93KGV4YW10eXBlLCB0b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5ZGlzcGxheSkge1xuICAgICAgICAvLyBqdXN0IHRvIGJlIHN1cmUgd2UgY2hlY2sgc29tZSBpbXBvcnRhbnQgdmFycyBoZXJlXG4gICAgICAgIGlmIChleGFtdHlwZSAhPT0gXCJyZHBcIiAmJiBleGFtdHlwZSAhPT0gXCJ3ZWJzaXRlXCIgJiYgIGV4YW10eXBlICE9PSBcImdmb3Jtc1wiICYmIGV4YW10eXBlICE9PSBcImVkdXZpZHVhbFwiICYmIGV4YW10eXBlICE9PSBcImVkaXRvclwiICYmIGV4YW10eXBlICE9PSBcIm1hdGhcIiAmJiBleGFtdHlwZSAhPT0gXCJtaWNyb3NvZnQzNjVcIiAmJiBleGFtdHlwZSAhPT0gXCJhY3RpdmVzaGVldHNcIiAmJiBleGFtdHlwZSAhPT0gXCJsb2NhbHZtXCIgfHwgIXRva2VuKXsgIC8vIGZvciBub3cuLiB3ZSBwcm9iYWJseSBzaG91bGQgc3RvcCBldmVyeXRoaW5nIGhlcmVcbiAgICAgICAgICAgIGxvZy53YXJuKFwibWlzc2luZyBwYXJhbWV0ZXJzIGZvciBleGFtLW1vZGUgb3IgbW9kZSBub3QgaW4gYWxsb3dlZCBsaXN0IVwiKVxuICAgICAgICAgICAgZXhhbXR5cGUgPSBcImVkaXRvclwiIFxuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgLy8gQWx3YXlzIHVzZSBwcmltYXJ5IGRpc3BsYXkgZm9yIGV4YW0gd2luZG93XG4gICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcyB8fCAhcHJpbWFyeWRpc3BsYXkuaWQpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgICAgIGlmICghcHJpbWFyeWRpc3BsYXkgfHwgIXByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlzID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClcbiAgICAgICAgICAgICAgICBwcmltYXJ5ZGlzcGxheSA9IGRpc3BsYXlzWzBdIHx8IHByaW1hcnlkaXNwbGF5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEltbWVkaWF0ZWx5IHJlc2VydmUgdGhlIGRpc3BsYXkgSUQgZm9yIHRoZSBleGFtIHdpbmRvdyAoYmVmb3JlIHdpbmRvdyBpcyBmdWxseSBpbml0aWFsaXplZClcbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBibG9jayB3aW5kb3dzIGZyb20gYmVpbmcgY3JlYXRlZCBvbiB0aGUgc2FtZSBzY3JlZW5cbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmlkKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBwcmltYXJ5ZGlzcGxheS5pZFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiByZXNlcnZpbmcgZGlzcGxheSAke3RoaXMuZXhhbURpc3BsYXlJZH0gZm9yIGV4YW0gd2luZG93YClcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHB4ID0gMFxuICAgICAgICBsZXQgcHkgPSAwXG4gICAgICAgIGlmIChwcmltYXJ5ZGlzcGxheSAmJiBwcmltYXJ5ZGlzcGxheS5ib3VuZHMgJiYgcHJpbWFyeWRpc3BsYXkuYm91bmRzLngpIHtcbiAgICAgICAgICAgIHB4ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnhcbiAgICAgICAgICAgIHB5ID0gcHJpbWFyeWRpc3BsYXkuYm91bmRzLnlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHg6IHB4ICsgMCxcbiAgICAgICAgICAgIHk6IHB5ICsgMCxcbiAgICAgICAgICAgIHRpdGxlOiAnRXhhbScsXG4gICAgICAgICAgICB3aWR0aDogMTQ0MCxcbiAgICAgICAgICAgIGhlaWdodDogNzY4LFxuICAgICAgICAgICAgLy8gcGFyZW50OiB3aW4sICAvL3RoaXMgZG9lc250IHdvcmsgdG9nZXRoZXIgd2l0aCBraW9zayBvbiB1YnVudHUgZ25vbWUgPz8gd3RmXG4gICAgICAgICAgICAvLyBtb2RhbDogdHJ1ZSwgIC8vIHRoaXMgYmxvY2tzIHRoZSBtYWluIHdpbmRvdyBvbiB3aW5kb3dzIHdoaWxlIHRoZSBleGFtIHdpbmRvdyBpcyBvcGVuXG4gICAgICAgICAgICAvLyBjbG9zYWJsZTogZmFsc2UsICAvLyBpZiB3ZSBjYW4ndCBkZWZpbmUgJ3BhcmVudCcgdGhpcyB3aW5kb3cgaGFzIHRvIGJlIGNsb3NhYmxlIC0gd2h5P1xuICAgICAgICAgICAgLy9hbHdheXNPblRvcDogdHJ1ZSxcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXG4gICAgICAgICAgICBza2lwVGFza2Jhcjp0cnVlLFxuICAgICAgICAgICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgICAgICAgICAgbWluaW1pemFibGU6IGZhbHNlLFxuICAgICAgICAgICAgdmlzaWJsZU9uQWxsV29ya3NwYWNlczogdHJ1ZSxcbiAgICAgICAgICAgIGtpb3NrOiB0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCA/IGZhbHNlIDogdHJ1ZSxcbiAgICAgICAgICAgIHNob3c6IHRydWUsXG4gICAgICAgICAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgICAgICAgICBpY29uOiBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlLCAnaWNvbnMnLCAnaWNvbi5wbmcnKSxcbiAgICAgICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZDogam9pbihfX2Rpcm5hbWUsICcuL3ByZWxvYWQvZWxlY3Ryb24tcHJlbG9hZC5janMnKSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdlYnZpZXdUYWc6IHRydWUsXG4gICAgICAgICAgICAgICAgd2ViU2VjdXJpdHk6IGZhbHNlICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbGVjdHJvbiAzOTogcmVhZHktdG8tc2hvdyBmaXJlcyBBRlRFUiBzaG93KCkgaXMgY2FsbGVkLCBzbyB1c2UgZGlkLWZpbmlzaC1sb2FkIGluc3RlYWRcbiAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uY2UoJ2RpZC1maW5pc2gtbG9hZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5leGFtd2luZG93KSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5zaG93ZGV2dG9vbHMpIHsgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlTWVudSgpICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LnNldEFsd2F5c09uVG9wKHRydWUsIFwic2NyZWVuLXNhdmVyXCIsIDEpIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoNTAwKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRCbG9ja1dpbmRvd3MoKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubW92ZVRvcCgpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBwcm9iYWJseSBub3QgbmVlZGVkIGJlY2F1c2Ugd2UgZGlzYWJsZSBtaXNzaW9uY29udHJvbCBhbnl3YXlzIC0gc2VlbXMgdG8gaW50ZXJmZXJlIHdpdGgga2lvc2sgbW9kZSBvbiBtYWNvcyAoYWdhaW4pXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMuZXhhbXdpbmRvdy5zZXRWaXNpYmxlT25BbGxXb3Jrc3BhY2VzKHRydWUsIHsgdmlzaWJsZU9uRnVsbFNjcmVlbjogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNXYXlsYW5kKXsgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0YXJ0KCkgfSAvLyBjb25zdGFudGx5IGNoZWNrIGlmIHRoZSBhY3RpdmUgd2luZG93IGlzIHRoZSBleGFtd2luZG93IC0gaWYgbm90LCBicmluZyBpdCB0byBmcm9udFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVSZXN0cmljdGlvbnModGhpcykgIC8vIGRpc2FibGUga2V5Ym9hcmQgc2hvcnRjdXRzIGV0Yy5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwMCkgIC8vIGRvIG5vdCBzZXQgYmx1ciBsaXN0ZW5lciB0b28gZWFybHlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRCbHVyTGlzdGVuZXIoKSAgLy8gYWRkIGJsdXIgbGlzdGVuZXIgdG8gdGhlIGV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBkaWQtZmluaXNoLWxvYWQ6IGVycm9yIGluIGV4YW13aW5kb3cgc2V0dXBcIiwgZSl9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzID0gc2VydmVyc3RhdHVzIC8vd2Uga2VlcCBpdCB0aGVyZSB0byBtYWtlIGl0IGFjY2Vzc2FibGUgdmlhIGV4YW13aW5kb3cgaW4gaXBjSGFuZGxlclxuICAgICAgICB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCA9IDk0ICAgLy8gc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBjb250ZW50IHZpZXdcbiAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1pY3Jvc29mdCAzNjUgZW1lYmVkcyBpdHMgZWRpdG9yIGluIGFuIGlmcmFtZSB3aXRoIGFjdGl2ZSBDb250ZW50IFNlY3VyaXR5IFBvbGljeSAoQ1NQKVxuICAgICAgICAgKiBUaGUgb25seSB3YXkgdG8gYmUgYWJsZSB0byBpbmplY3QgY29kZSBpcyB0byBsb2FkIGl0IGRpcmVjdGx5IGluIHRoZSBtYWluIHdpbmRvdyA8ZW1iZWQ+IDxpZnJhbWU+IG9yIGV2ZW4gPHdlYnZpZXc+IG9mZmVycyBubyB3b3JrYXJvdW5kXG4gICAgICAgICAqIHRoZXJlZm9yZSB3ZSB1c2UgXCJCcm93c2VyVmlld1wiIGluIG9yZGVyIHRvIGRpc3BsYXkgdHdvIHBhZ2VzIGluIG9uZSB3aW5kb3c6IG9uIHRvcCA+IGV4YW0gaGVhZGVyLCBvbiBib3R0b20gPiBvZmZpY2VcbiAgICAgICAgICovXG5cbiAgICAgICAgaWYgKGV4YW10eXBlID09PSBcIm1pY3Jvc29mdDM2NVwiICApIHsgLy9leHRlcm5hbCBwYWdlXG4gICAgICAgICAgICBsb2cuaW5mbyhcInN0YXJ0aW5nIG1pY3Jvc29mdDM2NSBleGFtLi4uXCIpXG4gICAgICAgICAgICBsZXQgdXJsdmlldyA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSAgIFxuICAgICAgICAgICAgaWYgKCF1cmx2aWV3KSB7Ly8gd2Ugd2FpdCBmb3IgdGhlIG5leHQgdXBkYXRlIHRpY2sgLSBtc29mZmljZXNoYXJlIG5lZWRzIHRvIGJlIHNldCAhIChjb3VsZCBoYXBwZW4gd2hlbiBhIHN0dWRlbnQgY29ubmVjdHMgbGF0ZXIgdGhlbiBleGFtIG1vZGUgaXMgc2V0IGJ1dCBoaXMgc2hhcmUgdXJsIG5lZWRzIHNvbWUgdGltZSlcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBjcmVhdGVFeGFtV2luZG93OiBubyB1cmwgZm9yIG1pY3Jvc29mdDM2NSB3YXMgc2V0IHlldCAtIHdhaXRpbmcgZm9yIG5leHQgdXBkYXRlIHRpY2tcIilcbiAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5kZXN0cm95KCk7IFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdyA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtRGlzcGxheUlkID0gbnVsbCAgLy8gcmVzZXQgcmVzZXJ2ZWQgZGlzcGxheSBJRCB3aGVuIGV4YW0gd2luZG93IGlzIGRlc3Ryb3llZFxuICAgICAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5leGFtd2luZG93KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsb2FkIHRvcCBtZW51IGluIE1haW5QYWdlXG4gICAgICAgICAgICBsZXQgdXJsID0gZXhhbXR5cGUgICAvLyBlZGl0b3IgfHwgbWF0aCB8fCBlZHV2aWR1YWwgfHwgdGJkLlxuICAgICAgICAgICAgaWYgKGFwcC5pc1BhY2thZ2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmxvYWRGaWxlKGdldFJlbmRlcmVySW5kZXhQYXRoKCksIHtoYXNoOiBgIy8ke3VybH0vJHt0b2tlbn1gfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgYmFja2dyb3VuZHVybCA9IGAke3Byb2Nlc3MuZW52LkFQUF9VUkx9LyMvJHt1cmx9LyR7dG9rZW59L2BcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cubG9hZFVSTChiYWNrZ3JvdW5kdXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlZmluZSB0aGUgTWFpbkNvbnRlbnRQYWdlIHZpZXdcbiAgICAgICAgICAgIGxldCBjb250ZW50VmlldyA9IG5ldyBCcm93c2VyVmlldyh7XG4gICAgICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLCAgXG4gICAgICAgICAgICAgICAgICBjb250ZXh0SXNvbGF0aW9uOiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEJvdW5kcyh7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiB0aGlzLmV4YW13aW5kb3cubWVudUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5leGFtd2luZG93LmdldEJvdW5kcygpLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LnNldEF1dG9SZXNpemUoeyB3aWR0aDogdHJ1ZSwgaGVpZ2h0OiB0cnVlLCBob3Jpem9udGFsOiB0cnVlLCB2ZXJ0aWNhbDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLmxvYWRVUkwodXJsdmlldyk7XG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7ICAgICAgIGNvbnRlbnRWaWV3LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpIH1cblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmFkZEJyb3dzZXJWaWV3KGNvbnRlbnRWaWV3KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdlbnRlci1mdWxsLXNjcmVlbicsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cuc2V0QnJvd3NlclZpZXcoY29udGVudFZpZXcpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93Lm9uKCdyZXNpemUnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG5ld0JvdW5kcyA9IHRoaXMuZXhhbXdpbmRvdy5nZXRCb3VuZHMoKTtcbiAgICAgICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoe1xuICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgIHk6IHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIHRoaXMuZXhhbXdpbmRvdy5tZW51SGVpZ2h0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSBub3JtYWwgZXhhbSBtb2RlIChlZGl0b3IsIG1hdGgsIGVkdXZpZHVhbCwgd2Vic2l0ZSwgZ2Zvcm1zLCBhY3RpdmVzaGVldHMsIGxvY2Fsdm0pXG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIGxldCB1cmwgPSBleGFtdHlwZSAgIC8vIGVkaXRvciB8fCBtYXRoIHx8IHRiZC5cbiAgICAgICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkRmlsZShnZXRSZW5kZXJlckluZGV4UGF0aCgpLCB7aGFzaDogYCMvJHt1cmx9LyR7dG9rZW59YH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH0vIy8ke3VybH0vJHt0b2tlbn0vYFxuICAgICAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5sb2FkVVJMKHVybClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogSGFuZGxlIHNwZWNpYWwgTkFWSUdBVElPTiBzaXR1YXRpb25zXG4gICAgICAgICAqL1xuXG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgRm9ybXMsIFdlYnNpdGUsIEVkdXZpZHVhbCwgRWRpdG9yLCBSRFAsIE1pY3Jvc29mdDM2NVxuICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgICAgICAvLyBCbG9jayBuYXZpZ2F0aW9uIG9uIGV4YW13aW5kb3cud2ViQ29udGVudHMgbGV2ZWwgZm9yIGFsbCBtb2RlcyB0aGF0IGNhbiBkaXNwbGF5IFBERnMgaW4gZXhhbWhlYWRlclxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIG5hdmlnYXRpb24gd2hlbiBjbGlja2luZyBsaW5rcyBpbiBQREZzIGRpc3BsYXllZCBpbiB0aGUgZXhhbWhlYWRlclxuICAgICAgICAvLyBXZWJ2aWV3L0Jyb3dzZXJWaWV3IGJsb2NraW5nIGlzIGhhbmRsZWQgc2VwYXJhdGVseSB2aWEgSVBDIGluIGlwY2hhbmRsZXIuanMgb3IgbW9kZS1zcGVjaWZpYyBoYW5kbGVycyBiZWxvd1xuICAgICAgICBjb25zdCBleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIgPSBbXCJnZm9ybXNcIiwgXCJ3ZWJzaXRlXCIsIFwiZWR1dmlkdWFsXCIsIFwiZWRpdG9yXCIsIFwicmRwXCIsIFwibWljcm9zb2Z0MzY1XCIsIFwiYWN0aXZlc2hlZXRzXCIsIFwibWF0aFwiLCBcImxvY2Fsdm1cIl07XG4gICAgICAgIGlmIChleGFtVHlwZXNXaXRoUGRmSW5IZWFkZXIuaW5jbHVkZXMoc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbl0uZXhhbXR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cud2ViQ29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCAoZXZlbnQsIHVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIFZ1ZSBhcHAgKGUuZy4gZnJvbSBQREYgbGlua3MgaW4gZXhhbWhlYWRlcilcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IG5ldyB3aW5kb3dzIGZyb20gb3BlbmluZyBpbiB0aGUgZXhhbXdpbmRvd1xuICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LndlYkNvbnRlbnRzLm9uKCduZXctd2luZG93JywgKGV2ZW50LCB1cmwpID0+IHsgXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJ3aW5kb3doYW5kbGVyIEAgZXhhbXdpbmRvdzogYmxvY2tlZCBuZXctd2luZG93XCIsIHVybCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICBcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcigoeyB1cmwgfSkgPT4geyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIndpbmRvd2hhbmRsZXIgQCBleGFtd2luZG93OiBibG9ja2VkIHNldFdpbmRvd09wZW5IYW5kbGVyXCIsIHVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWN0aW9uOiAnZGVueScgfTsgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiAgTWljcm9zb2Z0IEV4Y2VsL1dvcmRcbiAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAgICAgbGV0IGVmZmVjdGl2ZVNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMuYWxsb3dTZWN0aW9uU3dpdGNoID8gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uIDogc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb247XG4gICAgICAgIGlmICggc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tlZmZlY3RpdmVTZWN0aW9uXS5leGFtdHlwZSA9PT0gXCJtaWNyb3NvZnQzNjVcIil7ICAvLyBkbyBub3QgdW5kZXIgYW55IGNpcmN1bXN0YW5jZXMgYWxsb3cgbmF2aWdhdGlvbiBhd2F5IGZyb20gdGhlIGN1cnJlbnQgZXhhbSB1cmxcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5leGFtd2luZG93LmdldEJyb3dzZXJWaWV3KDApO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YW50cyB0byBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyBwYWdlXG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5vbignd2lsbC1uYXZpZ2F0ZScsIChldmVudCwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5tc29mZmljZXNoYXJlICkge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImRvIG5vdCBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhpcyB0ZXN0Li4gXCIpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB9ICBcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgd2luZG93Lm9wZW4oKVxuICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMub24oJ25ldy13aW5kb3cnLCAoZXZlbnQsIHVybCkgPT4geyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAgIH0pOyAvLyBQcmV2ZW50IHRoZSBuZXcgd2luZG93IGZyb20gb3BlbmluZ1xuICAgICBcbiAgICAgICAgICAgIC8vIGlmIGEgbmV3IHdpbmRvdyBzaG91bGQgb3BlbiB0cmlnZ2VyZWQgYnkgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCh7IHVybCB9KSA9PiB7IHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07ICAgfSk7IC8vIFByZXZlbnQgdGhlIG5ldyB3aW5kb3cgZnJvbSBvcGVuaW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBleGVjdXRlQ29kZSA9ICBgXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGxvY2soKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICdXQUNEaWFsb2dPdXRlckNvbnRhaW5lcicsJ1dBQ0RpYWxvZ0lubmVyQ29udGFpbmVyJywnV0FDRGlhbG9nUGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGlkZXVzQnlJRCA9IFsnU2hvd0hpZGVFcXVhdGlvblRvb2xzUGFuZScsJ0xpbmtHcm91cCcsJ0dyYXBoaWNzRWRpdG9yJywnSW5zZXJ0VGFibGVPZkNvbnRlbnRzSW5JbnNlcnRUYWInLCdJbnNlcnRPbmxpbmV2aWRlbycsJ1BpY3R1cmUnLCdSaWJib24tUGljdHVyZU1lbnVNTFJEcm9wZG93bicsJ0luc2VydEFkZEluRmx5b3V0JywnRGVzaWduZXInLCdFZGl0b3InLCdGYXJQYW5lJywnSGVscCcsJ0luc2VydEFwcHNGb3JPZmZpY2UnLCdGaWxlTWVudUxhdW5jaGVyQ29udGFpbmVyJywnSGVscC13cmFwcGVyJywnUmV2aWV3LXdyYXBwZXInLCdIZWFkZXInLCdGYXJQZXJpcGhlcmFsQ29udHJvbHNDb250YWluZXInLCdCdXNpbmVzc0JhciddXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGVudHJ5IG9mIGhpZGV1c0J5SUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudHJ5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImRpc3BsYXlcIiwgXCJub25lXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJ1dHRvbkFwcHNPdmVyZmxvdyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCdBZGQtSW5zJylbMF07ICAvLyB0aGlzIGJ1dHRvbiBpcyByZWRyYXduIG9uIHJlc2l6ZSAoZG9lc24ndCBoYXBwZW4gaW4gZXhhbSBtb2RlIGJ1dCBzdGlsbCB0aGVyZSBtdXN0IGJlIGEgY2xlYW5lciB3YXkgLSBpbnNlcnRpbmcgY3NzIGJlZm9yZSBpdCBhcHBlYXJzIGlzIG5vdCB3b3JraW5nKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1dHRvbkFwcHNPdmVyZmxvdyl7IGJ1dHRvbkFwcHNPdmVyZmxvdy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCIgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlN1Y2hlblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIlx1MDBEQ2JlcnNldHplblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbD1cIkNvcGlsb3RcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsPVwiQWRkLUluc1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiQ29udGV4dE1lbnUtU21hcnRMb29rdXBDb250ZXh0TWVudVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkNvbnRleHRNZW51LVNtYXJ0TG9va3VwU3lub255bXNcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7ZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiUmliYm9uLVJlZmVyZW5jZXNTbWFydExvb2tVcFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXVuaXF1ZS1pZD1cIkRpY3RhdGlvblwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHsgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdW5pcXVlLWlkPVwiR2V0QWRkaW5zXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4geyBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS11bmlxdWUtaWQ9XCJQaWN0dXJlc19NTFJcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7IGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2NrKCkgIC8vZm9yIHNvbWUgcmVhc29uIGV4Y2VsIGRlbGF5cyB0aGF0IGNhbGwuLiBkb2VzbnQgaGFwcGVuIG9uIHBhZ2UgZmluaXNoIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgYFxuXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGVySW5zdGFuY2UgPSBudWxsXG4gICAgICAgICAgICB0aGlzLmxvY2tDYWxsYmFjayA9ICgpID0+IHRoaXMubG9jazM2NShicm93c2VyVmlldywgZXhlY3V0ZUNvZGUsIHNjaGVkdWxlckluc3RhbmNlKTsgXG4gICAgICAgICAgICBzY2hlZHVsZXJJbnN0YW5jZSA9IG5ldyBTY2hlZHVsZXJTZXJ2aWNlKHRoaXMubG9ja0NhbGxiYWNrLCA0MDApXG4gICAgICAgICAgICB0aGlzLmxvY2tTY2hlZHVsZXIgPSBzY2hlZHVsZXJJbnN0YW5jZVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RhcnQoKVxuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgd2ViQ29udGVudHMgaXMgZnVsbHkgbG9hZGVkICAvLyB0aGlzIGlzIG5vdCB3b3JraW5nIHJlbGlhYmx5IGJlY2F1c2UgdGhlIHBhZ2UgaXMgbG9hZGVkIGluIG1hbnkgc3RlcHMgYW5kIHRoZSB1aSBlbGVtZW50cyBhcmUgbm90IGF2YWlsYWJsZSB5ZXRcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lLmZyYW1lcy5maWx0ZXIoKGZyYW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuZXhlY3V0ZUphdmFTY3JpcHQoZXhlY3V0ZUNvZGUpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZXhhbXdpbmRvdy5vbignYXBwLWNvbW1hbmQnLCAoZSwgY21kKSA9PiB7XG4gICAgICAgICAgICAvLyAnYnJvd3Nlci1iYWNrd2FyZCcgdW5kICdicm93c2VyLWZvcndhcmQnIHNpbmQgZGllIEJlZmVobGUsIGRpZSBiZWltIEtsaWNrIGF1ZiBkaWUgTWF1c3Rhc3RlbiBnZXNlbmRldCB3ZXJkZW5cbiAgICAgICAgICAgIGlmIChjbWQgPT09ICdicm93c2VyLWJhY2t3YXJkJyB8fCBjbWQgPT09ICdicm93c2VyLWZvcndhcmQnKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJubyBuYXZpZ2F0aW9uIGFsbG93ZWRcIilcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIFZlcmhpbmRlcm4gU2llIGRhcyBTdGFuZGFyZHZlcmhhbHRlblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmV4YW13aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gd2luZG93IHNob3VsZCBub3QgYmUgY2xvc2VkIG1hbnVhbGx5Li4gZXZlciEgYnV0IGlmIHlvdSBkbyBtYWtlIHN1cmUgdG8gY2xlYW4gZXhhbXdpbmRvdyB2YXJpYWJsZSBhbmQgZW5kIGV4YW0gZm9yIHRoZSBjbGllbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93LmRlc3Ryb3koKTsgXG4gICAgICAgICAgICAgICAgdGhpcy5leGFtd2luZG93ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmV4YW1EaXNwbGF5SWQgPSBudWxsICAvLyByZXNldCByZXNlcnZlZCBkaXNwbGF5IElEIHdoZW4gZXhhbSB3aW5kb3cgaXMgY2xvc2VkXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1dpbmRvd0ludGVydmFsLnN0b3AoKVxuICAgICAgICAgICAgICAgIC8vZGlzYWJsZVJlc3RyaWN0aW9ucyh0aGlzLmV4YW13aW5kb3cpICAvL2RvIG5vdCBkaXNhYmxlIHR3aWNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWVcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cbiAgICBhc3luYyBsb2NrMzY1KGJyb3dzZXJWaWV3LCBleGVjdXRlQ29kZSwgc2NoZWR1bGVySW5zdGFuY2Upe1xuICAgICAgICBpZiAoYnJvd3NlclZpZXcud2ViQ29udGVudHMgJiYgYnJvd3NlclZpZXcud2ViQ29udGVudHMubWFpbkZyYW1lKXtcbiAgICAgICAgICAgIGJyb3dzZXJWaWV3LndlYkNvbnRlbnRzLm1haW5GcmFtZS5mcmFtZXMuZmlsdGVyKChmcmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nLmluZm8oXCJmb3VuZCBmcmFtZVwiLCBmcmFtZS5uYW1lKVxuICAgICAgICAgICAgICAgIGlmIChmcmFtZSAmJiAoZnJhbWUubmFtZSA9PT0gJ1dlYkFwcGxpY2F0aW9uRnJhbWUnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9Xb3JkXzAnIHx8IGZyYW1lLm5hbWUgPT09ICdXYWNGcmFtZV9FeGNlbF8wJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9sb2cuaW5mbyhcImZvdW5kIGZyYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lLmV4ZWN1dGVKYXZhU2NyaXB0KGV4ZWN1dGVDb2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJ3aW5kb3doYW5kbGVyIEAgbG9jazM2NTogc3RvcHBpbmcgbG9ja1NjaGVkdWxlclwiKVxuICAgICAgICAgICAgc2NoZWR1bGVySW5zdGFuY2Uuc3RvcCgpXG4gICAgICAgICAgICBpZiAodGhpcy5sb2NrU2NoZWR1bGVyID09PSBzY2hlZHVsZXJJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9ja1NjaGVkdWxlciA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIndpbmRvd2hhbmRsZXIgQCBsb2NrMzY1OiBubyBicm93c2VyVmlldyBvciBsb2NrU2NoZWR1bGVyIGZvdW5kXCIpXG4gICAgICAgIH1cbiAgICB9XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIFxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBNQUlOIFdJTkRPV1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgYXN5bmMgY3JlYXRlTWFpbldpbmRvdygpIHtcbiAgICAgICAgbGV0IHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldFByaW1hcnlEaXNwbGF5KClcbiAgICAgICAgY29uc3QgY3VycmVudERpciA9IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLicsIGltcG9ydC5tZXRhLnVybCkpO1xuICAgICAgICBpZiAoIXByaW1hcnlkaXNwbGF5IHx8ICFwcmltYXJ5ZGlzcGxheS5ib3VuZHMpIHtcbiAgICAgICAgICAgIHByaW1hcnlkaXNwbGF5ID0gc2NyZWVuLmdldEFsbERpc3BsYXlzKClbMF1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdpbmRvdyBkaW1lbnNpb25zIC0gZGVmaW5lZCBvbmNlLCB1c2VkIGV2ZXJ5d2hlcmVcbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSAxMDI0XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IDY0MFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBjZW50ZXIgcG9zaXRpb24gb24gcHJpbWFyeSBkaXNwbGF5XG4gICAgICAgIGxldCB4ID0gMFxuICAgICAgICBsZXQgeSA9IDBcbiAgICAgICAgaWYgKHByaW1hcnlkaXNwbGF5ICYmIHByaW1hcnlkaXNwbGF5LmJvdW5kcykge1xuICAgICAgICAgICAgeCA9IHByaW1hcnlkaXNwbGF5LmJvdW5kcy54ICsgTWF0aC5mbG9vcigocHJpbWFyeWRpc3BsYXkuYm91bmRzLndpZHRoIC0gd2luZG93V2lkdGgpIC8gMilcbiAgICAgICAgICAgIHkgPSBwcmltYXJ5ZGlzcGxheS5ib3VuZHMueSArIE1hdGguZmxvb3IoKHByaW1hcnlkaXNwbGF5LmJvdW5kcy5oZWlnaHQgLSB3aW5kb3dIZWlnaHQpIC8gMilcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWFpbndpbmRvdyA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICAgICAgICAgIHRpdGxlOiAnTmV4dC1FeGFtLVN0dWRlbnQnLFxuICAgICAgICAgICAgaWNvbjogam9pbihwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZSwgJ2ljb25zJywgJ2ljb24ucG5nJyksXG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeSxcbiAgICAgICAgICAgIHdpZHRoOiB3aW5kb3dXaWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogd2luZG93SGVpZ2h0LFxuICAgICAgICAgICAgbWluV2lkdGg6IDg1MCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogNjAwLFxuICAgICAgICAgICAgcmVzaXphYmxlOiBmYWxzZSwgLy8gdmVyaGluZGVydCBkYXMgXHUwMEM0bmRlcm4gZGVyIEdyXHUwMEY2XHUwMERGZSAgXG4gICAgICAgICAgICBmdWxsc2NyZWVuYWJsZTogZmFsc2UsIC8vIHZlcmhpbmRlcnQgZGVuIFZvbGxiaWxkbW9kdXMgLSB3aWNodGlnIGZcdTAwRkNyIG1hY29zIGRlbm4gd2VubiBhdWYgbWFjb3MgZGFzIG1haW53aW5kb3cgYXVmIGZ1bGxzY3JlZW4gaXN0IGdyZWlmdCBiZWltIGV4YW13aW5kb3cgZGVyIGtpb3NrIG1vZGUgbmljaHQgIC0gZWxlY3Ryb24gYnVnIChuZWVkcyBleGFtcGxlIGNvZGUpOiA+PiBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzQ0NzU1XG4gICAgICAgICAgICBzaG93OiB0cnVlLFxuICAgICAgICAgICAgLy92aXNpYmxlT25BbGxXb3Jrc3BhY2VzOiB0cnVlLFxuICAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkOiBwYXRoLnJlc29sdmUoXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnREaXIsXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihwcm9jZXNzLmVudi5RVUFTQVJfRUxFQ1RST05fUFJFTE9BRF9GT0xERVIsICdlbGVjdHJvbi1wcmVsb2FkJyArIHByb2Nlc3MuZW52LlFVQVNBUl9FTEVDVFJPTl9QUkVMT0FEX0VYVEVOU0lPTilcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNwZWxsY2hlY2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRUaHJvdHRsaW5nOiB0cnVlICAvLyBhbGxvdyB0aHJvdHRsaW5nIHdoZW4gd2luZG93IGlzIGluIGJhY2tncm91bmRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBoYW5kbGVycyBiZWZvcmUgbG9hZGluZ1xuICAgICAgICB0aGlzLm1haW53aW5kb3cub24oJ2Nsb3NlJywgYXN5bmMgIChlKSA9PiB7ICAgLy8gYXNrIGJlZm9yZSBjbG9zaW5nXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmRldmVsb3BtZW50ICYmICF0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0KSB7ICAvLyBhbGxvd2V4aXQgaXN0IGVpbiBvdmVycmlkZSB2b20gY29udGV4dCBtZW51IG9kZXIgc2NyZWVuc2hvdCB0ZXN0LiBkaWVzZXIga2FubiBkaWUgYXBwIHNjaGxpZXNzZW5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbil7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93VHJheSA9ICFwbGF0Zm9ybURpc3BhdGNoZXIuX2lzR05PTUUoKTsgLy8gR05PTUUgaGFzIG5vIGxlZ2FjeSB0cmF5XG4gICAgICAgICAgICAgICAgICAgIGlmICghYWxsb3dUcmF5KSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBjcmVhdGVNYWluV2luZG93OiBHTk9NRSBkZXRlY3RlZCwgcXVpdHRpbmcgaW5zdGVhZCBvZiB0cmF5IG1pbmltaXplYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW53aW5kb3cuYWxsb3dleGl0ID0gdHJ1ZTsgIC8vIGFsbG93IGNsb3NlIGZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2hvd01pbmltaXplV2FybmluZygpXG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgY3JlYXRlTWFpbldpbmRvdzogTWluaW1pemluZyBOZXh0LUV4YW0gdG8gU3lzdGVtdHJheWApICBcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgd2luZG93IHByb3BlcnRpZXMgaW1tZWRpYXRlbHkgYWZ0ZXIgY3JlYXRpb25cbiAgICAgICAgdGhpcy5tYWlud2luZG93LnJlbW92ZU1lbnUoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cuZm9jdXMoKVxuICAgICAgICB0aGlzLm1haW53aW5kb3cubW92ZVRvcCgpXG4gICAgICAgIC8vdGhpcy5tYWlud2luZG93LnNldEhpZGRlbkluTWlzc2lvbkNvbnRyb2wodHJ1ZSlcblxuICAgICAgICBpZiAodGhpcy5jb25maWcuc2hvd2RldnRvb2xzKSB7IHRoaXMubWFpbndpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoKSAgfVxuXG4gICAgICAgIGlmIChhcHAuaXNQYWNrYWdlZCB8fCBwcm9jZXNzLmVudltcIkRFQlVHXCJdKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGdldFJlbmRlcmVySW5kZXhQYXRoKCk7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgZmlsZTogJHtmaWxlUGF0aH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRGaWxlKGZpbGVQYXRoKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYCR7cHJvY2Vzcy5lbnYuQVBQX1VSTH1gXG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGNyZWF0ZU1haW5XaW5kb3c6IExvYWRpbmcgVVJMOiAke3VybH1gKVxuICAgICAgICAgICAgdGhpcy5tYWlud2luZG93LmxvYWRVUkwodXJsKVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgIGFzeW5jIHNob3dFeGl0V2FybmluZyhtZXNzYWdlKXtcbiAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSB0cnVlXG4gICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3godGhpcy5tYWlud2luZG93LCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnT2snXSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2dyYW1tIEJlZW5kZW4nLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgY2FuY2VsSWQ6IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0V2FybmluZ09wZW4gPSBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvd0V4aXRRdWVzdGlvbigpe1xuICAgICAgICBpZiAodGhpcy5leGl0UXVlc3Rpb25PcGVuKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkaWFsb2cgYWxyZWFkeSBvcGVuLCBza2lwcGluZ1wiKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGNob2ljZSA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveCh0aGlzLm1haW53aW5kb3csIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncXVlc3Rpb24nLFxuICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsnSmEnLCAnTmVpbiddLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJvZ3JhbW0gYmVlbmRlbicsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1dvbGxlbiBzaWUgZGllIEFud2VuZHVuZyBOZXh0LUV4YW0gYmVlbmRlbj8nLFxuICAgICAgICAgICAgICAgIGNhbmNlbElkOiAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmKGNob2ljZS5yZXNwb25zZSA9PSAxKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIldpbmRvd2hhbmRsZXIgQCBzaG93RXhpdFF1ZXN0aW9uOiBkbyBub3QgY2xvc2UgTmV4dC1FeGFtIGFmdGVyIGZpbmlzaGVkIEV4YW1cIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbndpbmRvdy5hbGxvd2V4aXQgPSB0cnVlXG4gICAgICAgICAgICAgICAgYXBwLnF1aXQoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5leGl0UXVlc3Rpb25PcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHNob3dNaW5pbWl6ZVdhcm5pbmcoKXtcbiAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gdHJ1ZVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHRoaXMubWFpbndpbmRvdywge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbJ09LJ10sXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNaW5pbWl6ZSB0byBTeXN0ZW0gVHJheScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0RpZSBBbndlbmR1bmcgTmV4dC1FeGFtIHd1cmRlIG1pbmltaWVydCEnLFxuICAgICAgICBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZVdhcm5pbmdPcGVuID0gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBBZGRpdGlvbmFsIEZ1bmN0aW9uc1xuICAgICAqL1xuXG4gICAgaXNXYXlsYW5kKCl7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmVudi5YREdfU0VTU0lPTl9UWVBFID09PSAnd2F5bGFuZCc7IFxuICAgIH1cblxuICAgIC8vIHRoaXMgZnVuY3Rpb24gdXNlcyBhY3RpdmUtd2luIHRvIHJlY2VpdmUgbmFtZSBhbmQgdXJsIGZyb20gYWN0aXZlIHdpbmRvdyAtIHlldCBhbm90aGVyIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoZSBmb2N1cyBpcyBzdGlsbCBvbiBuZXh0ZXhhbVxuICAgIC8vIHRoaXMgaXMgdXNlZCB0byBpbnRyb2R1Y2UgZXhlbXB0aW9ucyBmb3IgdGhlIGJsdXIgbGlzdGVuZXJcbiAgICAvLyAoZG93bmdyYWRlZCBmcm9tIGdldC13aW5kb3dzIGJlY2F1c2Ugb2YgbmFwaSB2OSBpc3N1ZSkgaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9nZXQtd2luZG93cy9pc3N1ZXMvMTg2XG4gICAgYXN5bmMgd2luZG93VHJhY2tlcigpe1xuICAgICAgICB0cnl7XG4gICAgICAgICAgICAvLyBjb25zdCBnZXR3aW4gPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVdpbmRvdygpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlV2luID0gYXdhaXQgYWN0aXZlV2luZG93KClcbiAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGFjdGl2ZVdpbiAmJiBhY3RpdmVXaW4ub3duZXIgJiYgYWN0aXZlV2luLm93bmVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IGFjdGl2ZVdpbi5vd25lci5uYW1lXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoID0gYWN0aXZlV2luLm93bmVyLnBhdGhcbiAgICAgICAgICAgICAgICBsZXQgbmFtZUxvd2VyID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICAgbGV0IHdwYXRoTG93ZXIgPSB3cGF0aC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZUxvd2VyLmluY2x1ZGVzKFwiZXhhbVwiKSB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJuZXh0XCIpICB8fCBuYW1lTG93ZXIuaW5jbHVkZXMoXCJlbGVjdHJvblwiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImVhc2VvZmFjY2Vzc2RpYWxvZ1wiKSB8fCAgd3BhdGhMb3dlci5pbmNsdWRlcyhcImRpc2FibGUtc2hvcnRjdXRzXCIpICl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9rdXMgaXMgb24gYWxsb3dlZCB3aW5kb3cgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2N1c1RhcmdldEFsbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyAvL2ZvY3VzIGlzIG5vdCBvbiBuZXh0LWV4YW0gb3IgYW55IG90aGVyIGFsbG93ZWQgd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCl7ICAvL2xvZyBqdXN0IG9uY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGB3aW5kb3doYW5kbGVyIEAgd2luZG93VHJhY2tlcjogZm9jdXMgbG9zdCBldmVudCB3YXMgdHJpZ2dlcmVkLiBhcHA6ICR7d3BhdGh9IC0gJHtuYW1lfSBgKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzVGFyZ2V0QWxsb3dlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCB3aW5kb3dUcmFja2VyOiAke2Vycn1gKSBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vYWRkcyBibHVyIGxpc3RlbmVyIHdoZW4gZW50ZXJpbmcgZXhhbW1vZGUgICAvLyBibHVyIGV2ZW50IGlzbnQgZmlyZWQgb24gbWFjb3MgTUlTU0lPTkNPTlRST0wgKHdoaWNoIGNhbnQgYmUgZGVhY3RpdmF0ZWQgYW55bW9yZSkgLSBkYW1uIHlvdSBhcHBsZSFcbiAgICBhZGRCbHVyTGlzdGVuZXIod2luZG93ID0gXCJleGFtd2luZG93XCIpe1xuICAgICAgICBpZiAod2luZG93ID09PSBcImV4YW13aW5kb3dcIil7IFxuICAgICAgICAgICAgbG9nLmluZm8oYHdpbmRvd2hhbmRsZXIgQCBhZGRCbHVyTGlzdGVuZXI6IFNldHRpbmcgQmx1ciBFdmVudCBmb3IgJHt3aW5kb3d9YClcbiAgICAgICAgICAgIHRoaXMuZXhhbXdpbmRvdy5hZGRMaXN0ZW5lcignYmx1cicsICgpID0+IHRoaXMuYmx1cmV2ZW50KHRoaXMpKSBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3aW5kb3cgPT09IFwic2NyZWVubG9ja1wiKSB7XG4gICAgICAgICAgICBsb2cuaW5mbyhgd2luZG93aGFuZGxlciBAIGFkZEJsdXJMaXN0ZW5lcjogU2V0dGluZyBCbHVyIEV2ZW50IGZvciAke3dpbmRvd313aW5kb3dgKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiB0aGlzLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBzY3JlZW5sb2Nrd2luZG93LmFkZExpc3RlbmVyKCdibHVyJywgKCkgPT4gdGhpcy5ibHVyZXZlbnRTY3JlZW5sb2NrKHRoaXMpKSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vcmVtb3ZlcyBibHVyIGxpc3RlbmVyIHdoZW4gbGVhdmluZyBleGFtIG1vZGVcbiAgICByZW1vdmVCbHVyTGlzdGVuZXIoKXtcbiAgICAgICAgaWYgKHRoaXMuZXhhbXdpbmRvdyl7XG4gICAgICAgICAgICB0aGlzLmV4YW13aW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdibHVyJylcbiAgICAgICAgICAgIGxvZy5pbmZvKFwid2luZG93aGFuZGxlciBAIHJlbW92ZUJsdXJMaXN0ZW5lcjogcmVtb3ZpbmcgYmx1ciBsaXN0ZW5lclwiKVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGltcGxlbWVudGluZyBhIHNsZWVwICh3YWl0KSBmdW5jdGlvblxuICAgIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy9zdHVkZW50IGZvZ3VzIHdlbnQgdG8gYW5vdGhlciB3aW5kb3dcbiAgICBhc3luYyBibHVyZXZlbnQod2luaGFuZGxlcikgeyBcblxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IHN0dWRlbnQgdHJpZWQgdG8gbGVhdmUgZXhhbSB3aW5kb3dcIilcblxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ2xpbnV4Jyl7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndpbmRvd1RyYWNrZXIoKSAgLy9jaGVja3MgaWYgbmV3IGZvY3VzIHdpbmRvdyBpcyBhbGxvd2VkXG4gICAgICAgICAgICBsb2cuaW5mbyhcIndpbmRvd3RyYWNrZXIgY2hlY2sgZG9uZS4uLlwiKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIGRlc3Ryb3llZCBzY3JlZW5sb2NrIHdpbmRvd3MgZnJvbSBhcnJheSBhbmQgY2hlY2sgaWYgYW55IHN0aWxsIGV4aXN0XG4gICAgICAgIHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmZpbHRlcih3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSlcbiAgICAgICAgY29uc3QgaGFzQWN0aXZlU2NyZWVubG9jayA9IHdpbmhhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3Muc29tZSh3aW4gPT4gd2luICYmICF3aW4uaXNEZXN0cm95ZWQoKSAmJiB3aW4uaXNWaXNpYmxlKCkpXG4gICAgICAgIC8vIEFsc28gY2hlY2sgY2xpZW50aW5mby5zY3JlZW5sb2NrIGZsYWcgYXMgZmFsbGJhY2sgaW4gY2FzZSBhcnJheSB3YXMgY2xlYXJlZCBidXQgd2luZG93cyBzdGlsbCBleGlzdFxuICAgICAgICBpZiAoaGFzQWN0aXZlU2NyZWVubG9jayB8fCB3aW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uc2NyZWVubG9jaykgeyByZXR1cm4gfS8vIGRvIG5vdGhpbmcgaWYgc2NyZWVubG9ja3dpbmRvdyBzdG9sZSBmb2N1cyAvLyBkbyBub3QgdHJpZ2dlciBhbiBpbmZpbml0ZSBsb29wIGJldHdlZW4gZXhhbSB3aW5kb3cgYW5kIHNjcmVlbmxvY2sgd2luZG93IChzdGVhbGluZyBlYWNoIG90aGVycyBmb2N1cyBiZWNhdXNlIHNjcmVlbmxvY2t3aW5kb3cgYXBwZWFycyBhYm92ZSBleGFtIHdpbmRvdyBhbmQgd2lsbCBjYXB0dXJlIGEga2xpY2sgYW5kIHRoZXJlZm9yZSBzdGVhbCBmb2N1cylcbiAgICAgICAgaWYgKHdpbmhhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkKXsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTsgXG4gICAgICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgLy90cm90emRlbSBmb2N1cyB6dXJcdTAwRkNjayBhdWYgZGllIGFwcFxuICAgICAgICAgICAgbG9nLndhcm4oYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnQ6IGJsdXJldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIHdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZSAgIC8vaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIFxuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICB3aW5oYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCk7ICBcbiAgICAgICAgd2luaGFuZGxlci5leGFtd2luZG93LmZvY3VzKCk7ICAgIC8vIHdlIGtlZXAgZm9jdXMgb24gdGhlIHdpbmRvdy4uIG5vIG1hdHRlciB3aGF0XG5cbiAgICAgICAgLy90dXJuIHZvbHVtZSB1cCBeXlxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykgeyBzcGF3bigncG93ZXJzaGVsbCcsIFsnU2V0LVZvbHVtZUxldmVsIC1MZXZlbCAxMDA7IFNldC1Wb2x1bWVNdXRlIC1NdXRlICRmYWxzZSddKTsgfVxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0nZGFyd2luJykgeyBleGVjKCdvc2FzY3JpcHQgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCB2b2x1bWUgMTAwXCIgLWUgXCJzZXQgdm9sdW1lIG91dHB1dCBtdXRlZCBmYWxzZVwiJyk7IH0gIFxuICAgICAgICAvLyBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JykgeyBcbiAgICAgICAgLy8gICAgIGV4ZWMoJ2FtaXhlciBzZXQgTWFzdGVyIDEwMCUgJyk7XG4gICAgICAgIC8vICAgICBleGVjKCdwYWN0bCBzZXQtc2luay1tdXRlIGBwYWN0bCBnZXQtZGVmYXVsdC1zaW5rYCAwJyk7XG4gICAgICAgIC8vIH1cbiAgICAgICAgXG4gICAgICAgIC8vd2UgY291bGQgcGxheSBhIHNvdW5kIGZpbGUgaGVyZS4uIHRiZC4gIFxuICAgIH1cbiAgICAvL3NwZWNpYWwgYmx1ciBldmVudCBmb3IgdGVtcG9yYXJ5IGxvdyBzZWN1cml0eSBzY3JlZW5sb2NrXG4gICAgYmx1cmV2ZW50U2NyZWVubG9jayh3aW5oYW5kbGVyKSB7IFxuICAgICAgICBsb2cuaW5mbyhcIndpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiBibHVyLXNjcmVlbmxvY2sgdHJpZ2dlcmVkXCIpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvL2Rvbid0IGN5Y2xlIHRocm91Z2ggYWxsIG9mIHRoZW0gLi4gaXQgd2lsbCBjcmVhdGUgYW4gaW5maW5pdGUgZm9jdXMgcmFjZVxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5zaG93KCk7ICAvLyB3ZSBrZWVwIGZvY3VzIG9uIHRoZSB3aW5kb3cuLiBubyBtYXR0ZXIgd2hhdFxuICAgICAgICAgICAgd2luaGFuZGxlci5zY3JlZW5sb2Nrd2luZG93c1swXS5tb3ZlVG9wKCk7XG4gICAgICAgICAgICB3aW5oYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycil7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHdpbmRvd2hhbmRsZXIgQCBibHVyZXZlbnRTY3JlZW5sb2NrOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgXG4gICAgfVxuICAgIFxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBXaW5kb3dIYW5kbGVyKClcbiBcblxuXG5cblxuXG5cblxuXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdFxuICogdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnkgdGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbixcbiAqIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5cbi8qKlxuICogbW9zdCBvZiB0aGUga2V5Ym9hcmQgcmVzdHJpY3Rpb25zIGNvdWxkIGJlIGhhbmRsZWQgYnkgXCJpb2hvb2tcIiBmb3IgYWxsIHBsYXRmb3Jtc1xuICogdW5mb3J0dW5hbGV0eSBpdCdzIG5vdCB5ZXQgcmVsZWFzZWQgZm9yIG5vZGUgdjE2LnggYW5kIGVsZWN0cm9uIHYxNi54ICAoYWxzbyBpdCdzIFwiYmlnIHN1clwiIGludGVsIG9ubHkgb24gbWFjcylcbiAqIGh0dHBzOi8vd2lsaXgtdGVhbS5naXRodWIuaW8vaW9ob29rL2luc3RhbGxhdGlvbi5odG1sXG4gKlxuICogXCJub2RlLWdsb2JhbC1rZXktbGlzdGVuZXJcIiB3b3VsZCBiZSBhbm90aGVyIHNvbHV0aW9uIGZvciB3aW5kb3dzIGFuZCBtYWNvcyAoYWx0aG91Z2ggaXQgcmVxdWlyZXMgXCJhY2Nlc3NhYmlsaXR5XCIgcGVybWlzc2lvbnMgb24gbWFjKVxuICogYnV0IGZvciBub3cgaXQgc2VlbXMgdGhlIG1vZHVsZSBjYW4gbm90IHJ1biBpbiBhIGZpbmFsIGVsZWN0cm9uIGJ1aWxkXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTGF1bmNoTWVudS9ub2RlLWdsb2JhbC1rZXktbGlzdGVuZXIvaXNzdWVzLzE4XG4gKlxuICogaGFyZGNvZGluZyB0aGUga2V5Ym9hcmRzaG9ydGN1dHMgd2Ugd2FudCB0byBjYXB0dXJlIGludG8gaW9ob29rKG9yIG4tZy1rLWwpIGFuZCBtYW51YWxseSBjb21waWxpbmcgaXQgZm9yIG1hYyBhbmQgd2luZG93cyBjb3VsZCBiZSBkb25lIC0gKGJ1dCBub3QgdW50aWwgaSBnZXQgcGFpZCBmb3IgdGhpcyBhbW91bnQgb2Ygd29yayA7LSlcbiAqL1xuXG5cbi8qKlxuICogdGhlIG5leHQgYmVzdCBzb2x1dGlvbiBpIGNhbWUgdXAgd2l0aCBpcyB0byBraWxsIGFsbCBvZiB0aGUgc2hlbGxzIC0gc3RhcnRpbmcgd2l0aCBleHBsb3Jlci5leGUgYmVjYXVzZSBpdHMgYWJzb2x1dGVseSBpbXBvc3NpYmxlIHRvXG4gKiBkZWFjdGl2YXRlIHRoaXMgbmFzdHkgXCJ3aW5kb3dzXCIgYnV0dG9uIG9yIDNGaW5nZXJTbGlkZVVwIEdlc3R1cmUgaW4gd2luZG93cyAxMSAtIHlvdSBjb3VsZCBlZGl0IHRoZSByZWdpc3RyeSBhbmQgcmVib290IGJ1dCB0aGF0cyBvYnZpb3VzbHkgbm90IHdoYXQgd2Ugd2FudFxuICovXG5cbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBjbGlwYm9hcmQsIGdsb2JhbFNob3J0Y3V0IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHsgU2NoZWR1bGVyU2VydmljZSB9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IGVuYWJsZUxpbnV4UmVzdHJpY3Rpb25zLCBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy9saW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlV2luZG93c1Jlc3RyaWN0aW9ucywgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMgfSBmcm9tICcuL3Jlc3RyaWN0aW9ucy93aW4uanMnO1xuaW1wb3J0IHsgZW5hYmxlTWFjUmVzdHJpY3Rpb25zLCBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zLCB0b2dnbGVNYWNPU0xvY2tkb3duIGFzIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsIH0gZnJvbSAnLi9yZXN0cmljdGlvbnMvbWFjLmpzJztcblxubGV0IGNsaXBib2FyZEludGVydmFsO1xubGV0IGNvbmZpZ1N0b3JlID0ge1xuICAgIGxpbnV4OiB7fSxcbiAgICB3aW5kb3dzOiB7fSxcbiAgICBtYWNvczoge31cbn07XG5cbi8vIGxpc3Qgb2YgYXBwcyB3ZSBkbyBub3Qgd2FudCB0byBydW4gaW4gYmFja2dyb3VuZFxuY29uc3QgYXBwc1RvQ2xvc2UgPSBbJ3doYXRzYXBwJywnR29vZ2xlIENocm9tZScsICdjaHJvbWUnLCAnZ29vZ2xlLWNocm9tZScsICdNaWNyb3NvZnQgRWRnZScsICdtc2VkZ2UnLCAnZmlyZWZveCcsICdzYWZhcmknLCAnYnJhdmUnLCAnb3BlcmEnLCAnY2hhdGdwdCcsICdDaGF0R1BUJywgJ05vcnRvblNlY3VyaXR5JywgJ05BVicsICdUZWFtcycsICdtcy10ZWFtcycsICd6b29tLnVzJywgJ01pY3Jvc29mdCBUZWFtcycsICdkaXNjb3JkJywgJ3pvb20nLCAndGVhbXMnLCAndGVhbXZpZXdlcicsICdza3lwZWZvcmxpbnV4JywgJ3NreXBlJywgJ2FueWRlc2snXTtcblxuYXN5bmMgZnVuY3Rpb24gZW5hYmxlUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIpIHtcbiAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KSB7IHJldHVybjsgfVxuXG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZW5hYmxpbmcgcGxhdGZvcm0gcmVzdHJpY3Rpb25zXCIpO1xuXG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrVicsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnbm8gY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK1gnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdubyBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrQycsICgpID0+IHsgY29uc29sZS5sb2coJ25vIGNsaXBib2FyZCcpOyB9KTtcblxuICAgIGNsaXBib2FyZC5jbGVhcigpO1xuICAgIGNsaXBib2FyZEludGVydmFsID0gbmV3IFNjaGVkdWxlclNlcnZpY2UoKCkgPT4geyBjbGlwYm9hcmQuY2xlYXIoKTsgfSwgMTAwMCk7XG4gICAgY2xpcGJvYXJkSW50ZXJ2YWwuc3RhcnQoKTtcblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBwbGF0Zm9ybURpc3BhdGNoZXIuaXNLREUsIHBsYXRmb3JtRGlzcGF0Y2hlci5pc0dOT01FKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGF3YWl0IGVuYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMod2luaGFuZGxlciwgYXBwc1RvQ2xvc2UpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgICAgIGVuYWJsZU1hY1Jlc3RyaWN0aW9ucyh3aW5oYW5kbGVyLCBhcHBzVG9DbG9zZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXNhYmxlUmVzdHJpY3Rpb25zKCkge1xuICAgIGlmIChjb25maWcuZGV2ZWxvcG1lbnQpIHsgcmV0dXJuOyB9XG4gICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnM6IHJlbW92aW5nIHJlc3RyaWN0aW9ucy4uLlwiKTtcblxuICAgIGlmIChjbGlwYm9hcmRJbnRlcnZhbCkge1xuICAgICAgICBjbGlwYm9hcmRJbnRlcnZhbC5zdG9wKCk7XG4gICAgfVxuXG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtWJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuICAgIGdsb2JhbFNob3J0Y3V0LnVucmVnaXN0ZXIoJ0NvbW1hbmRPckNvbnRyb2wrU2hpZnQrVicsICgpID0+IHsgY29uc29sZS5sb2coJ2FjdGl2YXRlIGNsaXBib2FyZCcpOyB9KTtcbiAgICBnbG9iYWxTaG9ydGN1dC51bnJlZ2lzdGVyKCdDb21tYW5kT3JDb250cm9sK0MnLCAoKSA9PiB7IGNvbnNvbGUubG9nKCdhY3RpdmF0ZSBjbGlwYm9hcmQnKTsgfSk7XG4gICAgZ2xvYmFsU2hvcnRjdXQudW5yZWdpc3RlcignQ29tbWFuZE9yQ29udHJvbCtYJywgKCkgPT4geyBjb25zb2xlLmxvZygnYWN0aXZhdGUgY2xpcGJvYXJkJyk7IH0pO1xuXG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgICAgICBkaXNhYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUpO1xuICAgIH1cblxuICAgIGlmIChwbGF0Zm9ybURpc3BhdGNoZXIucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgZGlzYWJsZVdpbmRvd3NSZXN0cmljdGlvbnMoKTtcbiAgICB9XG5cbiAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICBkaXNhYmxlTWFjUmVzdHJpY3Rpb25zKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVNYWNPU0xvY2tkb3duKGVuYWJsZSkge1xuICAgIHRvZ2dsZU1hY09TTG9ja2Rvd25JbXBsKGVuYWJsZSk7XG59XG5cbmV4cG9ydCB7IGVuYWJsZVJlc3RyaWN0aW9ucywgZGlzYWJsZVJlc3RyaWN0aW9ucywgdG9nZ2xlTWFjT1NMb2NrZG93biB9O1xuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBMaW51eC1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlKS5cbiAqL1xuXG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyB1bmZvcnR1bmF0ZWx5IHRoZXJlIGlzIG5vIGNvbnZlbmllbnQgd2F5IGZvciBnbm9tZS1zaGVsbCB0byB1bi1zZXQgQUxMIHNob3J0Y3V0cyBhdCBvbmNlXG4vLyBzbyB3ZSBtYWludGFpbiBhbiBleHBsaWNpdCBsaXN0IG9mIHNjaGVtYXMgYW5kIGtleXMgdGhhdCBtdXN0IGJlIGNsZWFyZWQgaW4gZXhhbSBtb2RlLlxuY29uc3QgZ25vbWVTaG9ydGN1dENvbmZpZyA9IHtcbiAgICAvLyB3aW5kb3cgbWFuYWdlciBzaG9ydGN1dHMgKHdvcmtzcGFjZXMsIHdpbmRvdyBtb3ZlbWVudCwgYXBwIHN3aXRjaGVyLCBzaG93IGRlc2t0b3AsIGV0Yy4pXG4gICAgd206IHtcbiAgICAgICAgc2NoZW1hOiAnb3JnLmdub21lLmRlc2t0b3Aud20ua2V5YmluZGluZ3MnLFxuICAgICAgICBjcml0aWNhbDogW1xuICAgICAgICAgICAgJ2FjdGl2YXRlLXdpbmRvdy1tZW51JywnbWF4aW1pemUtaG9yaXpvbnRhbGx5JywnbW92ZS10by1zaWRlLW4nLCdtb3ZlLXRvLXdvcmtzcGFjZS04Jywnc3dpdGNoLWFwcGxpY2F0aW9ucycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMycsJ3N3aXRjaC13aW5kb3dzLWJhY2t3YXJkJyxcbiAgICAgICAgICAgICdhbHdheXMtb24tdG9wJywnbWF4aW1pemUtdmVydGljYWxseScsJ21vdmUtdG8tc2lkZS1zJywnbW92ZS10by13b3Jrc3BhY2UtOScsJ3N3aXRjaC1hcHBsaWNhdGlvbnMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTQnLCd0b2dnbGUtYWJvdmUnLFxuICAgICAgICAgICAgJ2JlZ2luLW1vdmUnLCdtaW5pbWl6ZScsJ21vdmUtdG8tc2lkZS13JywnbW92ZS10by13b3Jrc3BhY2UtZG93bicsJ3N3aXRjaC1ncm91cCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtNScsJ3RvZ2dsZS1mdWxsc2NyZWVuJyxcbiAgICAgICAgICAgICdiZWdpbi1yZXNpemUnLCdtb3ZlLXRvLWNlbnRlcicsJ21vdmUtdG8td29ya3NwYWNlLTEnLCdtb3ZlLXRvLXdvcmtzcGFjZS1sYXN0Jywnc3dpdGNoLWdyb3VwLWJhY2t3YXJkJywnc3dpdGNoLXRvLXdvcmtzcGFjZS02JywndG9nZ2xlLW1heGltaXplZCcsXG4gICAgICAgICAgICAnY2xvc2UnLCdtb3ZlLXRvLWNvcm5lci1uZScsJ21vdmUtdG8td29ya3NwYWNlLTEwJywnbW92ZS10by13b3Jrc3BhY2UtbGVmdCcsJ3N3aXRjaC1pbnB1dC1zb3VyY2UnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTcnLCd0b2dnbGUtb24tYWxsLXdvcmtzcGFjZXMnLFxuICAgICAgICAgICAgJ2N5Y2xlLWdyb3VwJywnbW92ZS10by1jb3JuZXItbncnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMScsJ21vdmUtdG8td29ya3NwYWNlLXJpZ2h0Jywnc3dpdGNoLWlucHV0LXNvdXJjZS1iYWNrd2FyZCcsJ3RvZ2dsZS1zaGFkZWQnLFxuICAgICAgICAgICAgJ2N5Y2xlLWdyb3VwLWJhY2t3YXJkJywnbW92ZS10by1jb3JuZXItc2UnLCdtb3ZlLXRvLXdvcmtzcGFjZS0xMicsJ21vdmUtdG8td29ya3NwYWNlLXVwJywnc3dpdGNoLXBhbmVscycsJ3N3aXRjaC10by13b3Jrc3BhY2UtOScsJ3VubWF4aW1pemUnLFxuICAgICAgICAgICAgJ2N5Y2xlLXBhbmVscycsJ21vdmUtdG8tY29ybmVyLXN3JywnbW92ZS10by13b3Jrc3BhY2UtMicsJ3BhbmVsLW1haW4tbWVudScsJ3N3aXRjaC1wYW5lbHMtYmFja3dhcmQnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWRvd24nLFxuICAgICAgICAgICAgJ2N5Y2xlLXBhbmVscy1iYWNrd2FyZCcsJ21vdmUtdG8tbW9uaXRvci1kb3duJywnbW92ZS10by13b3Jrc3BhY2UtMycsJ3BhbmVsLXJ1bi1kaWFsb2cnLCdzd2l0Y2gtdG8td29ya3NwYWNlLTEnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxhc3QnLFxuICAgICAgICAgICAgJ2N5Y2xlLXdpbmRvd3MnLCdtb3ZlLXRvLW1vbml0b3ItbGVmdCcsJ21vdmUtdG8td29ya3NwYWNlLTQnLCdyYWlzZScsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTAnLCdzd2l0Y2gtdG8td29ya3NwYWNlLWxlZnQnLFxuICAgICAgICAgICAgJ2N5Y2xlLXdpbmRvd3MtYmFja3dhcmQnLCdtb3ZlLXRvLW1vbml0b3ItcmlnaHQnLCdtb3ZlLXRvLXdvcmtzcGFjZS01JywncmFpc2Utb3ItbG93ZXInLCdzd2l0Y2gtdG8td29ya3NwYWNlLTExJywnc3dpdGNoLXRvLXdvcmtzcGFjZS1yaWdodCcsXG4gICAgICAgICAgICAnbG93ZXInLCdtb3ZlLXRvLW1vbml0b3ItdXAnLCdtb3ZlLXRvLXdvcmtzcGFjZS02Jywnc2V0LXNwZXctbWFyaycsJ3N3aXRjaC10by13b3Jrc3BhY2UtMTInLCdzd2l0Y2gtdG8td29ya3NwYWNlLXVwJyxcbiAgICAgICAgICAgICdtYXhpbWl6ZScsJ21vdmUtdG8tc2lkZS1lJywnbW92ZS10by13b3Jrc3BhY2UtNycsJ3Nob3ctZGVza3RvcCcsJ3N3aXRjaC10by13b3Jrc3BhY2UtMicsJ3N3aXRjaC13aW5kb3dzJ1xuICAgICAgICBdLFxuICAgICAgICBuaWNlVG9IYXZlOiBbXVxuICAgIH0sXG4gICAgLy8gc2hlbGwgbGV2ZWwgc2hvcnRjdXRzIChvdmVydmlldywgYXBwIHZpZXcsIHNjcmVlbnNob3RzLCBub3RpZmljYXRpb25zLCBldGMuKVxuICAgIHNoZWxsOiB7XG4gICAgICAgIHNjaGVtYTogJ29yZy5nbm9tZS5zaGVsbC5rZXliaW5kaW5ncycsXG4gICAgICAgIGNyaXRpY2FsOiBbXG4gICAgICAgICAgICAnZm9jdXMtYWN0aXZlLW5vdGlmaWNhdGlvbicsJ29wZW4tYXBwbGljYXRpb24tbWVudScsJ3NjcmVlbnNob3QnLCdzY3JlZW5zaG90LXdpbmRvdycsJ3NoaWZ0LW92ZXJ2aWV3LWRvd24nLFxuICAgICAgICAgICAgJ3NoaWZ0LW92ZXJ2aWV3LXVwJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTEnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tMicsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi0zJywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTQnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNScsXG4gICAgICAgICAgICAnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTYnLCdzd2l0Y2gtdG8tYXBwbGljYXRpb24tNycsJ3N3aXRjaC10by1hcHBsaWNhdGlvbi04Jywnc3dpdGNoLXRvLWFwcGxpY2F0aW9uLTknLCdzaG93LXNjcmVlbnNob3QtdWknLCdzaG93LXNjcmVlbi1yZWNvcmRpbmctdWknLFxuICAgICAgICAgICAgJ3RvZ2dsZS1hcHBsaWNhdGlvbi12aWV3JywndG9nZ2xlLW1lc3NhZ2UtdHJheScsJ3RvZ2dsZS1vdmVydmlldydcbiAgICAgICAgXSxcbiAgICAgICAgbmljZVRvSGF2ZTogW11cbiAgICB9LFxuICAgIC8vIG11dHRlciBjb21wb3NpdG9yIHNob3J0Y3V0cyB0aGF0IGFmZmVjdCB3aW5kb3cgdGlsaW5nIG9yIG1vbml0b3IgbGF5b3V0XG4gICAgbXV0dGVyOiB7XG4gICAgICAgIHNjaGVtYTogJ29yZy5nbm9tZS5tdXR0ZXIua2V5YmluZGluZ3MnLFxuICAgICAgICBjcml0aWNhbDogWydyb3RhdGUtbW9uaXRvcicsJ3N3aXRjaC1tb25pdG9yJywndGFiLXBvcHVwLWNhbmNlbCcsJ3RhYi1wb3B1cC1zZWxlY3QnLCd0b2dnbGUtdGlsZWQtbGVmdCcsJ3RvZ2dsZS10aWxlZC1yaWdodCddLFxuICAgICAgICBuaWNlVG9IYXZlOiBbXVxuICAgIH0sXG4gICAgLy8gd2F5bGFuZCBzcGVjaWZpYyBtdXR0ZXIgc2hvcnRjdXRzIGZvciBzd2l0Y2hpbmcgdmlydHVhbCB0ZXJtaW5hbHMgb3Igc2Vzc2lvbnMgKEN0cmwrQWx0K0ZuKVxuICAgIG11dHRlcldheWxhbmQ6IHtcbiAgICAgICAgc2NoZW1hOiAnb3JnLmdub21lLm11dHRlci53YXlsYW5kLmtleWJpbmRpbmdzJyxcbiAgICAgICAgY3JpdGljYWw6IFtcbiAgICAgICAgICAgICdzd2l0Y2gtdG8tc2Vzc2lvbi0xJywnc3dpdGNoLXRvLXNlc3Npb24tMicsJ3N3aXRjaC10by1zZXNzaW9uLTMnLCdzd2l0Y2gtdG8tc2Vzc2lvbi00Jywnc3dpdGNoLXRvLXNlc3Npb24tNScsJ3N3aXRjaC10by1zZXNzaW9uLTYnLFxuICAgICAgICAgICAgJ3N3aXRjaC10by1zZXNzaW9uLTcnLCdzd2l0Y2gtdG8tc2Vzc2lvbi04Jywnc3dpdGNoLXRvLXNlc3Npb24tOScsJ3N3aXRjaC10by1zZXNzaW9uLTEwJywnc3dpdGNoLXRvLXNlc3Npb24tMTEnLCdzd2l0Y2gtdG8tc2Vzc2lvbi0xMidcbiAgICAgICAgXSxcbiAgICAgICAgbmljZVRvSGF2ZTogW11cbiAgICB9LFxuICAgIC8vIGNvbW1vbiBkYXNoLXRvLWRvY2sgZXh0ZW5zaW9uIHNob3J0Y3V0cyBmb3Igc3dpdGNoaW5nIG9yIHJhaXNpbmcgYXBwc1xuICAgIGRhc2hUb0RvY2s6IHtcbiAgICAgICAgc2NoZW1hOiAnb3JnLmdub21lLnNoZWxsLmV4dGVuc2lvbnMuZGFzaC10by1kb2NrJyxcbiAgICAgICAgY3JpdGljYWw6IFtcbiAgICAgICAgICAgICdhcHAtY3RybC1ob3RrZXktMScsJ2FwcC1jdHJsLWhvdGtleS0xMCcsJ2FwcC1jdHJsLWhvdGtleS0yJywnYXBwLWN0cmwtaG90a2V5LTMnLCdhcHAtY3RybC1ob3RrZXktNCcsJ2FwcC1jdHJsLWhvdGtleS01JyxcbiAgICAgICAgICAgICdhcHAtY3RybC1ob3RrZXktNicsJ2FwcC1jdHJsLWhvdGtleS03JywnYXBwLWN0cmwtaG90a2V5LTgnLCdhcHAtY3RybC1ob3RrZXktOScsXG4gICAgICAgICAgICAnYXBwLWhvdGtleS0xJywnYXBwLWhvdGtleS0xMCcsJ2FwcC1ob3RrZXktMicsJ2FwcC1ob3RrZXktMycsJ2FwcC1ob3RrZXktNCcsJ2FwcC1ob3RrZXktNScsJ2FwcC1ob3RrZXktNicsJ2FwcC1ob3RrZXktNycsJ2FwcC1ob3RrZXktOCcsJ2FwcC1ob3RrZXktOScsXG4gICAgICAgICAgICAnYXBwLXNoaWZ0LWhvdGtleS0xJywnYXBwLXNoaWZ0LWhvdGtleS0xMCcsJ2FwcC1zaGlmdC1ob3RrZXktMicsJ2FwcC1zaGlmdC1ob3RrZXktMycsJ2FwcC1zaGlmdC1ob3RrZXktNCcsJ2FwcC1zaGlmdC1ob3RrZXktNScsXG4gICAgICAgICAgICAnYXBwLXNoaWZ0LWhvdGtleS02JywnYXBwLXNoaWZ0LWhvdGtleS03JywnYXBwLXNoaWZ0LWhvdGtleS04JywnYXBwLXNoaWZ0LWhvdGtleS05Jywnc2hvcnRjdXQnXG4gICAgICAgIF0sXG4gICAgICAgIG5pY2VUb0hhdmU6IFtdXG4gICAgfVxufTtcblxuLy8gb3B0aW9uYWwgZGlhZ25vc3RpY3MgZm9yIHJlYWRpbmcgY3VycmVudCBnc2V0dGluZ3MgdmFsdWVzIHdoZW4gZGVidWdnaW5nIEdOT01FIHJlc3RyaWN0aW9uc1xuY29uc3QgaXNHbm9tZUtleWJpbmRpbmdEZWJ1Z0VuYWJsZWQgPSBwcm9jZXNzLmVudi5ORVhUX0VYQU1fREVCVUdfR05PTUUgPT09ICcxJztcblxuZnVuY3Rpb24gbG9nR3NldHRpbmdzVmFsdWUoc2NoZW1hLCBrZXksIHBoYXNlKSB7XG4gICAgaWYgKCFpc0dub21lS2V5YmluZGluZ0RlYnVnRW5hYmxlZCkgcmV0dXJuO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydnZXQnLCBzY2hlbWEsIGtleV0sIChlcnIsIHN0ZG91dCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBsb2cuZGVidWcoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgJHtwaGFzZX06IGZhaWxlZCB0byByZWFkICR7c2NoZW1hfSAke2tleX06ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbG9nLmRlYnVnKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAICR7cGhhc2V9OiAke3NjaGVtYX0gJHtrZXl9ID0gJHtzdGRvdXQudHJpbSgpfWApO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIEVuYWJsZSBMaW51eC1zcGVjaWZpYyByZXN0cmljdGlvbnMgKEtERS9HTk9NRSwgY2xvc2UgYXBwcywgY2xpcGJvYXJkKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqIEBwYXJhbSB7c3RyaW5nW119IGFwcHNUb0Nsb3NlIC0gYXBwIG5hbWVzIHRvIGtpbGxcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNLREVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNHTk9NRVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTGludXhSZXN0cmljdGlvbnMoY29uZmlnU3RvcmUsIGFwcHNUb0Nsb3NlLCBpc0tERSwgaXNHTk9NRSkge1xuICAgIHRyeSB7XG4gICAgICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGBwZ3JlcCAtaSBcIiR7YXBwfVwiYCwgKHBncmVwRXJyb3IsIHN0ZG91dCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcGdyZXBFcnJvciAmJiBzdGRvdXQgJiYgc3Rkb3V0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhgcGdyZXAgLWkgXCIke2FwcH1cIiB8IHhhcmdzIC1yIGtpbGwgLTlgLCAoa2lsbEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWtpbGxFcnJvcikgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmIChpc0tERSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBLREUgcmVzdHJpY3Rpb25zXCIpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2tyZWFkY29uZmlnNScsIFsnLS1maWxlJywgJ2t3aW5yYycsICctLWdyb3VwJywgJ0Rlc2t0b3BzJywgJy0ta2V5JywgJ051bWJlciddLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChrcmVhZGNvbmZpZyk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gMTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzID0gc3Rkb3V0LnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHJlY29uZmlndXJpbmcga3dpblwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCBgJHtwbGF0Zm9ybURpc3BhdGNoZXIuaG9tZWRpcmVjdG9yeX0vLmNvbmZpZy9rd2lucmNgLCctLWdyb3VwJywgJ01vZGlmaWVyT25seVNob3J0Y3V0cycsJy0ta2V5JywnTWV0YScsJ1wiXCInXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCcxJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3NldEN1cnJlbnREZXNrdG9wJywnMSddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZGlzYWJsaW5nIGVmZmVjdHNcIik7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUuS1dpbicsJy9FZmZlY3RzJywnb3JnLmtkZS5rd2luLkVmZmVjdHMudW5sb2FkRWZmZWN0JywgJ2Rlc2t0b3BncmlkJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdzY3JlZW5lZGdlJ10pO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvRWZmZWN0cycsJ29yZy5rZGUua3dpbi5FZmZlY3RzLnVubG9hZEVmZmVjdCcsICdvdmVydmlldyddKTtcbiAgICAgICAgbG9nLmluZm8oXCJwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogYWRkaXRpb25hbCB0dHknc1wiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLCAna3hrYnJjJywgJy0tZ3JvdXAnLCAnTGF5b3V0JywgJy0ta2V5JywgJ09wdGlvbnMnLCAnc3J2cmtleXM6bm9uZSddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkYnVzLXNlbmQnLCBbJy0tc2Vzc2lvbicsICctLXR5cGU9c2lnbmFsJywgJy0tZGVzdD1vcmcua2RlLmtleWJvYXJkJywgJy9MYXlvdXRzJywgJ29yZy5rZGUua2V5Ym9hcmQucmVsb2FkQ29uZmlnJ10pO1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbGVhcmluZyBjbGlwYm9hcmQgaGlzdG9yeVwiKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rbGlwcGVyJyAsJy9rbGlwcGVyJywgJ29yZy5rZGUua2xpcHBlci5rbGlwcGVyLmNsZWFyQ2xpcGJvYXJkSGlzdG9yeSddKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBkaXNhYmxpbmcgZ2xvYmFsIGtleWJvYXJkc2hvcnRjdXRzXCIpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5rZ2xvYmFsYWNjZWwnICwnL2tnbG9iYWxhY2NlbCcsICdvcmcua2RlLktHbG9iYWxBY2NlbC5ibG9ja0dsb2JhbFNob3J0Y3V0cycsICd0cnVlJ10pO1xuICAgICAgICB9LCAyMDAwKTtcbiAgICB9XG5cbiAgICBpZiAoaXNHTk9NRSkge1xuICAgICAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBlbmFibGluZyBHTk9NRSByZXN0cmljdGlvbnNcIik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB3bUtleXMgPSBbLi4uZ25vbWVTaG9ydGN1dENvbmZpZy53bS5jcml0aWNhbCwgLi4uZ25vbWVTaG9ydGN1dENvbmZpZy53bS5uaWNlVG9IYXZlXTtcbiAgICAgICAgICAgIGZvciAobGV0IGJpbmRpbmcgb2Ygd21LZXlzKSB7XG4gICAgICAgICAgICAgICAgbG9nR3NldHRpbmdzVmFsdWUoZ25vbWVTaG9ydGN1dENvbmZpZy53bS5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtd20tYmVmb3JlLXNldCcpO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnLCBnbm9tZVNob3J0Y3V0Q29uZmlnLndtLnNjaGVtYSwgYmluZGluZywgYFsnJ11gXSk7XG4gICAgICAgICAgICAgICAgbG9nR3NldHRpbmdzVmFsdWUoZ25vbWVTaG9ydGN1dENvbmZpZy53bS5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtd20tYWZ0ZXItc2V0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXYXlsYW5kOiBkaXNhYmxlIFZUL1RUWSBzd2l0Y2ggKEN0cmwrQWx0K0YxLi5GMTIpIHZpYSBtdXR0ZXIga2V5YmluZGluZ3NcbiAgICAgICAgICAgIGNvbnN0IHdheWxhbmRLZXlzID0gWy4uLmdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5jcml0aWNhbCwgLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5tdXR0ZXJXYXlsYW5kLm5pY2VUb0hhdmVdO1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiB3YXlsYW5kS2V5cykge1xuICAgICAgICAgICAgICAgIGxvZ0dzZXR0aW5nc1ZhbHVlKGdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtd2F5bGFuZC1iZWZvcmUtc2V0Jyk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsIGdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5zY2hlbWEsIGJpbmRpbmcsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZGNvbmYnLCBbJ3dyaXRlJywgYC9vcmcvZ25vbWUvbXV0dGVyL3dheWxhbmQva2V5YmluZGluZ3MvJHtiaW5kaW5nfWAsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGxvZ0dzZXR0aW5nc1ZhbHVlKGdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtd2F5bGFuZC1hZnRlci1zZXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHNoZWxsS2V5cyA9IFsuLi5nbm9tZVNob3J0Y3V0Q29uZmlnLnNoZWxsLmNyaXRpY2FsLCAuLi5nbm9tZVNob3J0Y3V0Q29uZmlnLnNoZWxsLm5pY2VUb0hhdmVdO1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBzaGVsbEtleXMpIHtcbiAgICAgICAgICAgICAgICBsb2dHc2V0dGluZ3NWYWx1ZShnbm9tZVNob3J0Y3V0Q29uZmlnLnNoZWxsLnNjaGVtYSwgYmluZGluZywgJ2VuYWJsZS1nbm9tZS1zaGVsbC1iZWZvcmUtc2V0Jyk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsIGdub21lU2hvcnRjdXRDb25maWcuc2hlbGwuc2NoZW1hLCBiaW5kaW5nLCBgWycnXWBdKTtcbiAgICAgICAgICAgICAgICBsb2dHc2V0dGluZ3NWYWx1ZShnbm9tZVNob3J0Y3V0Q29uZmlnLnNoZWxsLnNjaGVtYSwgYmluZGluZywgJ2VuYWJsZS1nbm9tZS1zaGVsbC1hZnRlci1zZXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG11dHRlcktleXMgPSBbLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5tdXR0ZXIuY3JpdGljYWwsIC4uLmdub21lU2hvcnRjdXRDb25maWcubXV0dGVyLm5pY2VUb0hhdmVdO1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBtdXR0ZXJLZXlzKSB7XG4gICAgICAgICAgICAgICAgbG9nR3NldHRpbmdzVmFsdWUoZ25vbWVTaG9ydGN1dENvbmZpZy5tdXR0ZXIuc2NoZW1hLCBiaW5kaW5nLCAnZW5hYmxlLWdub21lLW11dHRlci1iZWZvcmUtc2V0Jyk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsIGdub21lU2hvcnRjdXRDb25maWcubXV0dGVyLnNjaGVtYSwgYmluZGluZywgYFsnJ11gXSk7XG4gICAgICAgICAgICAgICAgbG9nR3NldHRpbmdzVmFsdWUoZ25vbWVTaG9ydGN1dENvbmZpZy5tdXR0ZXIuc2NoZW1hLCBiaW5kaW5nLCAnZW5hYmxlLWdub21lLW11dHRlci1hZnRlci1zZXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRvY2tLZXlzID0gWy4uLmdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5jcml0aWNhbCwgLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5kYXNoVG9Eb2NrLm5pY2VUb0hhdmVdO1xuICAgICAgICAgICAgZm9yIChsZXQgYmluZGluZyBvZiBkb2NrS2V5cykge1xuICAgICAgICAgICAgICAgIGxvZ0dzZXR0aW5nc1ZhbHVlKGdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtZG9jay1iZWZvcmUtc2V0Jyk7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3NldCcsIGdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5zY2hlbWEsIGJpbmRpbmcsIGBbJyddYF0pO1xuICAgICAgICAgICAgICAgIGxvZ0dzZXR0aW5nc1ZhbHVlKGdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5zY2hlbWEsIGJpbmRpbmcsICdlbmFibGUtZ25vbWUtZG9jay1hZnRlci1zZXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydzZXQnLCAnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleScsIGAnJ2BdKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdnc2V0dGluZ3Mgc2V0IG9yZy5nbm9tZS5tdXR0ZXIgZHluYW1pYy13b3Jrc3BhY2VzIGZhbHNlJyk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnZ3NldHRpbmdzIHNldCBvcmcuZ25vbWUuZGVza3RvcC53bS5wcmVmZXJlbmNlcyBudW0td29ya3NwYWNlcyAxJyk7XG4gICAgICAgICAgICAvLyBYMTEgb25seTogZGlzYWJsZSBUVFkgc3dpdGNoIHZpYSBzZXR4a2JtYXAgKG9uIFdheWxhbmQgd2UgcmVseSBvbiBtdXR0ZXIgd2F5bGFuZCBrZXliaW5kaW5ncyBhYm92ZSlcbiAgICAgICAgICAgIGlmICghcGxhdGZvcm1EaXNwYXRjaGVyLmlzV2F5bGFuZCgpKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygnc2V0eGtibWFwIC1vcHRpb24gc3J2cmtleXM6bm9uZScsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChHTk9NRSk6IHNldHhrYm1hcCBzcnZya2V5czpub25lIGZhaWxlZCcsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtaSAvZGV2L251bGwnKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1zZWxlY3Rpb24gY2xpcGJvYXJkJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zIChnc2V0dGluZ3MpOiAke2Vycn1gKTsgfVxufVxuXG4vKipcbiAqIERpc2FibGUgTGludXgtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIGFuZCByZXN0b3JlIEtERS9HTk9NRSBzZXR0aW5ncy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWdTdG9yZSAtIHNoYXJlZCBzdG9yZSAoY29uZmlnU3RvcmUubGludXgubnVtYmVyT2ZEZXNrdG9wcylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVMaW51eFJlc3RyaWN0aW9ucyhjb25maWdTdG9yZSkge1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnd2wtY29weScsIFsnLWMnXSk7XG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3hjbGlwIC1pIC9kZXYvbnVsbCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4Y2xpcCAtc2VsZWN0aW9uIGNsaXBib2FyZCcpO1xuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd4c2VsIC1iYycpO1xuXG4gICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ2VjaG8gJFhER19DVVJSRU5UX0RFU0tUT1AnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgbG9nLmVycm9yKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGRpc2FibGVSZXN0cmljdGlvbnMgKGxpbnV4KTogZXhlYyBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3Rkb3V0LnRyaW0oKSA9PT0gJ0tERScpIHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zIChsaW51eCk6IEtERSBkZXRlY3RlZFwiKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgncWRidXMnLCBbJ29yZy5rZGUua2xpcHBlcicgLCcva2xpcHBlcicsICdvcmcua2RlLmtsaXBwZXIua2xpcHBlci5jbGVhckNsaXBib2FyZEhpc3RvcnknXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLmtnbG9iYWxhY2NlbCcgLCcva2dsb2JhbGFjY2VsJywgJ2Jsb2NrR2xvYmFsU2hvcnRjdXRzJywgJ2ZhbHNlJ10pO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdxZGJ1cycsIFsnb3JnLmtkZS5LV2luJyAsJy9Db21wb3NpdG9yJywgJ29yZy5rZGUua3dpbi5Db21wb3NpdGluZy5yZXN1bWUnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBrZ2xvYmFsYWNjZWw1JicpO1xuICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdrd3JpdGVjb25maWc1JywgWyctLWZpbGUnLGAke3BsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5fS8uY29uZmlnL2t3aW5yY2AsJy0tZ3JvdXAnLCdNb2RpZmllck9ubHlTaG9ydGN1dHMnLCctLWtleScsJ01ldGEnLCctLWRlbGV0ZSddKTtcbiAgICAgICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgna3dyaXRlY29uZmlnNScsIFsnLS1maWxlJywna3dpbnJjJywnLS1ncm91cCcsJ0Rlc2t0b3BzJywnLS1rZXknLCdOdW1iZXInLCBjb25maWdTdG9yZS5saW51eC5udW1iZXJPZkRlc2t0b3BzXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2t3cml0ZWNvbmZpZzUnLCBbJy0tZmlsZScsICdreGticmMnLCAnLS1ncm91cCcsICdMYXlvdXQnLCAnLS1rZXknLCAnT3B0aW9ucycsICcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2RidXMtc2VuZCcsIFsnLS1zZXNzaW9uJywgJy0tdHlwZT1zaWduYWwnLCAnLS1kZXN0PW9yZy5rZGUua2V5Ym9hcmQnLCAnL0xheW91dHMnLCAnb3JnLmtkZS5rZXlib2FyZC5yZWxvYWRDb25maWcnXSk7XG4gICAgICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ3FkYnVzJywgWydvcmcua2RlLktXaW4nLCcvS1dpbicsJ3JlY29uZmlndXJlJ10pO1xuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZFByb2Nlc3MuZXhlYygna3N0YXJ0NSBwbGFzbWFzaGVsbCAmJywgeyBkZXRhY2hlZDogdHJ1ZSwgc3RkaW86ICdpZ25vcmUnIH0pO1xuICAgICAgICAgICAgY2hpbGQudW5yZWYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3Qgd21LZXlzID0gWy4uLmdub21lU2hvcnRjdXRDb25maWcud20uY3JpdGljYWwsIC4uLmdub21lU2hvcnRjdXRDb25maWcud20ubmljZVRvSGF2ZV07XG4gICAgZm9yIChsZXQgYmluZGluZyBvZiB3bUtleXMpIHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdnc2V0dGluZ3MnLCBbJ3Jlc2V0JywgZ25vbWVTaG9ydGN1dENvbmZpZy53bS5zY2hlbWEsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjb25zdCB3YXlsYW5kS2V5cyA9IFsuLi5nbm9tZVNob3J0Y3V0Q29uZmlnLm11dHRlcldheWxhbmQuY3JpdGljYWwsIC4uLmdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5uaWNlVG9IYXZlXTtcbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIHdheWxhbmRLZXlzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcsIGdub21lU2hvcnRjdXRDb25maWcubXV0dGVyV2F5bGFuZC5zY2hlbWEsIGJpbmRpbmddKTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWNGaWxlKCdkY29uZicsIFsncmVzZXQnLCBgL29yZy9nbm9tZS9tdXR0ZXIvd2F5bGFuZC9rZXliaW5kaW5ncy8ke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjb25zdCBzaGVsbEtleXMgPSBbLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5zaGVsbC5jcml0aWNhbCwgLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5zaGVsbC5uaWNlVG9IYXZlXTtcbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIHNoZWxsS2V5cykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnLCBnbm9tZVNob3J0Y3V0Q29uZmlnLnNoZWxsLnNjaGVtYSwgYCR7YmluZGluZ31gXSk7XG4gICAgfVxuICAgIGNvbnN0IG11dHRlcktleXMgPSBbLi4uZ25vbWVTaG9ydGN1dENvbmZpZy5tdXR0ZXIuY3JpdGljYWwsIC4uLmdub21lU2hvcnRjdXRDb25maWcubXV0dGVyLm5pY2VUb0hhdmVdO1xuICAgIGZvciAobGV0IGJpbmRpbmcgb2YgbXV0dGVyS2V5cykge1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnLCBnbm9tZVNob3J0Y3V0Q29uZmlnLm11dHRlci5zY2hlbWEsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjb25zdCBkb2NrS2V5cyA9IFsuLi5nbm9tZVNob3J0Y3V0Q29uZmlnLmRhc2hUb0RvY2suY3JpdGljYWwsIC4uLmdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5uaWNlVG9IYXZlXTtcbiAgICBmb3IgKGxldCBiaW5kaW5nIG9mIGRvY2tLZXlzKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjRmlsZSgnZ3NldHRpbmdzJywgWydyZXNldCcsIGdub21lU2hvcnRjdXRDb25maWcuZGFzaFRvRG9jay5zY2hlbWEsIGAke2JpbmRpbmd9YF0pO1xuICAgIH1cbiAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoJ2dzZXR0aW5ncycsIFsncmVzZXQnLCAnb3JnLmdub21lLm11dHRlcicsICdvdmVybGF5LWtleSddKTtcbiAgICAvLyByZXN0b3JlIFRUWSBzd2l0Y2ggaWYgd2UgaGFkIGRpc2FibGVkIGl0IHZpYSBzZXR4a2JtYXAgKEdOT01FIFgxMSlcbiAgICBpZiAoY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0KSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKFwic2V0eGtibWFwIC1vcHRpb24gJydcIiwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgbG9nLndhcm4oJ3BsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9uczogc2V0eGtibWFwIHJlc3RvcmUgZmFpbGVkJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uZmlnU3RvcmUubGludXguc3J2cmtleXNOb25lU2V0ID0gZmFsc2U7XG4gICAgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBXaW5kb3dzLXNwZWNpZmljIHBsYXRmb3JtIHJlc3RyaWN0aW9ucyAoZW5hYmxlL2Rpc2FibGUpLlxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4uL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbi8qKlxuICogRW5hYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChzaG9ydGN1dHMsIGNsb3NlIGFwcHMsIGtpbGwgZXhwbG9yZXIpLlxuICogQHBhcmFtIHtvYmplY3R9IHdpbmhhbmRsZXIgLSBtdXN0IGhhdmUgd2luaGFuZGxlci5leGFtd2luZG93XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcHBzVG9DbG9zZSAtIGFwcCBuYW1lcyB0byBraWxsXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbmFibGVXaW5kb3dzUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlO1xuICAgICAgICBjb25zdCBleGVjdXRhYmxlMSA9IGpvaW4ocHVibGljQmFzZSwgJ2Rpc2FibGUtc2hvcnRjdXRzLmV4ZScpO1xuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlY0ZpbGUoZXhlY3V0YWJsZTEsIFtdLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogJ2lnbm9yZScsIHNoZWxsOiBmYWxzZSwgd2luZG93c0hpZGU6IHRydWUgfSk7XG4gICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmRvd3Mgc2hvcnRjdXRzIGRpc2FibGVkXCIpO1xuICAgIH0gY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zICh3aW4gc2hvcnRjdXRzKTogJHtlcnJ9YCk7IH1cblxuICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgYXBwIG9mIGFwcHNUb0Nsb3NlKSB7XG4gICAgICAgICAgICBjb25zdCBlc2NhcGVkQXBwID0gYXBwLnJlcGxhY2UoLycvZywgXCInJ1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgcG93ZXJzaGVsbCAtTm9Qcm9maWxlIC1Db21tYW5kIFwiJGFwcE5hbWUgPSAnJHtlc2NhcGVkQXBwfSc7IHRyeSB7ICRwcm9jcyA9IEdldC1Qcm9jZXNzIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHsgJF8uUHJvY2Vzc05hbWUgLWlsaWtlICgnKicgKyAkYXBwTmFtZSArICcqJykgfTsgaWYgKCRwcm9jcyAtYW5kICRwcm9jcy5Db3VudCAtZ3QgMCkgeyAkcHJvY3MgfCBTdG9wLVByb2Nlc3MgLUZvcmNlIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlOyBXcml0ZS1PdXRwdXQgJ2tpbGxlZCcgfSB9IGNhdGNoIHsgfVwiYDtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlQXBwKSA9PiB7XG4gICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCAmJiBzdGRvdXQudHJpbSgpLmluY2x1ZGVzKCdraWxsZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgJHthcHB9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZUFwcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIGlmICghd2luaGFuZGxlcikge1xuICAgICAgICBsb2cud2FybihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBlbmFibGVSZXN0cmljdGlvbnM6IHdpbmhhbmRsZXIgaXMgbm90IHByb3ZpZGVkIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcmV0cnlDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAxMDA7XG4gICAgICAgIGNvbnN0IGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAod2luaGFuZGxlci5leGFtd2luZG93ICYmICF3aW5oYW5kbGVyLmV4YW13aW5kb3cuaXNEZXN0cm95ZWQ/LigpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoJ3Rhc2traWxsIC9mIC9pbSBleHBsb3Jlci5leGUnLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycm9yICYmIHN0ZG91dCkgbG9nLmluZm8oYHBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZW5hYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZXhwbG9yZXIuZXhlYCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXRyeUNvdW50IDwgbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgIHJldHJ5Q291bnQrKztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGtpbGxFeHBsb3JlcldoZW5XaW5kb3dFeGlzdHMsIDEwMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBwbGF0Zm9ybXJlc3RyaWN0aW9ucyBAIGVuYWJsZVJlc3RyaWN0aW9uczogZXhhbXdpbmRvdyBub3QgZm91bmQgYWZ0ZXIgJHttYXhSZXRyaWVzICogMTAwfW1zIC0gc2tpcHBpbmcgZXhwbG9yZXIuZXhlIGtpbGxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAga2lsbEV4cGxvcmVyV2hlbldpbmRvd0V4aXN0cygpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIFdpbmRvd3Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh1bmJsb2NrIHNob3J0Y3V0cywgcmVzdGFydCBleHBsb3JlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlV2luZG93c1Jlc3RyaWN0aW9ucygpIHtcbiAgICBsb2cuaW5mbyhcInBsYXRmb3JtcmVzdHJpY3Rpb25zIEAgZGlzYWJsZVJlc3RyaWN0aW9ucyAod2luKTogdW5ibG9ja2luZyBzaG9ydGN1dHMuLi5cIik7XG4gICAgdHJ5IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHRhc2traWxsICAvSU0gXCJkaXNhYmxlLXNob3J0Y3V0cy5leGVcIiAvVCAvRmAsIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgICAgICAgIGlmICghZXJyb3IgJiYgc3Rkb3V0KSBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zOiBjbG9zZWQgZGlzYWJsZS1zaG9ydGN1dHMuZXhlYCk7XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGVycm9yc1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKCd0YXNrbGlzdCAvRkkgXCJJTUFHRU5BTUUgZXEgZXhwbG9yZXIuZXhlXCInLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYHRhc2tsaXN0IGVycm9yOiAke2Vycm9yfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKCdleHBsb3Jlci5leGUnKSkge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwicGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlUmVzdHJpY3Rpb25zICh3aW4pOiByZXN0YXJ0aW5nIGV4cGxvcmVyLi4uXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRQcm9jZXNzLmV4ZWMoJ3N0YXJ0IGV4cGxvcmVyLmV4ZScsIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiAnaWdub3JlJyB9KTtcbiAgICAgICAgICAgICAgICBjaGlsZC51bnJlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7IGxvZy5lcnJvcihgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBkaXNhYmxlcmVzdHJpY3Rpb25zICh3aW4gZXhwbG9yZXIpOiAke2UubWVzc2FnZX1gKTsgfVxufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgR1BMIExJQ0VOU0VcbiAqIENvcHlyaWdodCAoYykgMjAyMSBUaG9tYXMgTWljaGFlbCBXZWlzc2VsXG4gKiBtYWNPUy1zcGVjaWZpYyBwbGF0Zm9ybSByZXN0cmljdGlvbnMgKGVuYWJsZS9kaXNhYmxlLCB0b2dnbGVNYWNPU0xvY2tkb3duKS5cbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IFRvdWNoQmFyLCBzeXN0ZW1QcmVmZXJlbmNlcywgcG93ZXJNb25pdG9yIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuXG4vLyBzdG9yZWQgcmVmcyBmb3IgY2xlYW51cCB3aGVuIGRpc2FibGluZyBtYWNPUyByZXN0cmljdGlvbnNcbmxldCB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG5sZXQgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG5sZXQgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuXG4vKiogU2luZ2xlIGhhbmRsZXIgZm9yIGFsbCBtYWNPUyByZXN0cmljdGlvbiBzaWduYWxzOiBsb2cgYW5kIHJlLWZvY3VzIGV4YW0gd2luZG93IC8gaW5mb3JtIHRlYWNoZXIuICovXG5mdW5jdGlvbiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKHNpZ25hbE5hbWUpIHtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6ICR7c2lnbmFsTmFtZX0gZGV0ZWN0ZWRgKTtcbiAgICBpZiAoIWN1cnJlbnRXaW5oYW5kbGVyPy5leGFtd2luZG93Py5pc0Rlc3Ryb3llZD8uKCkpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRXaW5oYW5kbGVyLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbykgY3VycmVudFdpbmhhbmRsZXIubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSBmYWxzZTsgLy8gaW5mb3JtIHRoZSB0ZWFjaGVyXG4gICAgICAgIGN1cnJlbnRXaW5oYW5kbGVyLmV4YW13aW5kb3cubW92ZVRvcCgpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpO1xuICAgICAgICBjdXJyZW50V2luaGFuZGxlci5leGFtd2luZG93LnNob3coKTtcbiAgICAgICAgY3VycmVudFdpbmhhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpO1xuICAgIH1cbn1cblxuY29uc3QgbG9ja1NjcmVlbkhhbmRsZXIgPSAoKSA9PiBvbk1hY1Jlc3RyaWN0aW9uU2lnbmFsKCdsb2NrLXNjcmVlbicpO1xuY29uc3QgdW5sb2NrU2NyZWVuSGFuZGxlciA9ICgpID0+IG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ3VubG9jay1zY3JlZW4nKTtcblxuLyoqXG4gKiBFbmFibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zIChUb3VjaEJhciwgY2xpcGJvYXJkLCBjbG9zZSBhcHBzLCB3b3Jrc3BhY2UvbG9jayBtb25pdG9yaW5nKS5cbiAqIEBwYXJhbSB7b2JqZWN0fSB3aW5oYW5kbGVyIC0gbXVzdCBoYXZlIHdpbmhhbmRsZXIuZXhhbXdpbmRvd1xuICogQHBhcmFtIHtzdHJpbmdbXX0gYXBwc1RvQ2xvc2UgLSBhcHAgbmFtZXMgdG8ga2lsbFxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlTWFjUmVzdHJpY3Rpb25zKHdpbmhhbmRsZXIsIGFwcHNUb0Nsb3NlKSB7XG4gICAgY29uc3QgeyBUb3VjaEJhckxhYmVsLCBUb3VjaEJhclNwYWNlciB9ID0gVG91Y2hCYXI7XG4gICAgY29uc3QgdGV4dGxhYmVsID0gbmV3IFRvdWNoQmFyTGFiZWwoeyBsYWJlbDogXCJOZXh0LUV4YW1cIiB9KTtcbiAgICBjb25zdCB0b3VjaEJhciA9IG5ldyBUb3VjaEJhcih7XG4gICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICBuZXcgVG91Y2hCYXJTcGFjZXIoeyBzaXplOiAnZmxleGlibGUnIH0pLFxuICAgICAgICAgICAgdGV4dGxhYmVsLFxuICAgICAgICAgICAgbmV3IFRvdWNoQmFyU3BhY2VyKHsgc2l6ZTogJ2ZsZXhpYmxlJyB9KSxcbiAgICAgICAgXVxuICAgIH0pO1xuICAgIHdpbmhhbmRsZXIuZXhhbXdpbmRvdz8uc2V0VG91Y2hCYXIodG91Y2hCYXIpO1xuICAgIGN1cnJlbnRXaW5oYW5kbGVyID0gd2luaGFuZGxlcjtcblxuICAgIGNoaWxkUHJvY2Vzcy5leGVjKCdwYmNvcHkgPCAvZGV2L251bGwnKTtcblxuICAgIGFwcHNUb0Nsb3NlLmZvckVhY2goYXBwID0+IHtcbiAgICAgICAgY2hpbGRQcm9jZXNzLmV4ZWMoYHBraWxsIC05IC1mIFwiJHthcHB9XCJgLCAoZXJyb3IsIHN0ZGVyciwgc3Rkb3V0KSA9PiB7fSk7XG4gICAgfSk7XG5cbiAgICAvLyB3b3Jrc3BhY2Uvc3BhY2Ugc3dpdGNoIGFuZCBsb2NrL3VubG9jayBtb25pdG9yaW5nIChtYWNPUyBvbmx5KVxuICAgIHRyeSB7XG4gICAgICAgIHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkID0gc3lzdGVtUHJlZmVyZW5jZXMuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKCdOU1dvcmtzcGFjZUFjdGl2ZVNwYWNlRGlkQ2hhbmdlTm90aWZpY2F0aW9uJywgKCkgPT4gb25NYWNSZXN0cmljdGlvblNpZ25hbCgnZGVza3RvcC9zcGFjZSBzd2l0Y2gnKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHN1YnNjcmliZVdvcmtzcGFjZU5vdGlmaWNhdGlvbicsIGVycik7IH1cblxuICAgIHBvd2VyTW9uaXRvci5vbignbG9jay1zY3JlZW4nLCBsb2NrU2NyZWVuSGFuZGxlcik7XG4gICAgcG93ZXJNb25pdG9yLm9uKCd1bmxvY2stc2NyZWVuJywgdW5sb2NrU2NyZWVuSGFuZGxlcik7XG5cbiAgICBsb2dTdHJlYW1Qcm9jZXNzID0gc3Bhd24oJ2xvZycsIFsnc3RyZWFtJywgJy0tcHJlZGljYXRlJywgJ3N1YnN5c3RlbSA9PSBcImNvbS5hcHBsZS5kb2NrXCIgQU5EIGNhdGVnb3J5ID09IFwibWlzc2lvbmNvbnRyb2xcIiddKTtcbiAgICBsb2dTdHJlYW1Qcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuICAgICAgICBpZiAoZGF0YS50b1N0cmluZygpLmluY2x1ZGVzKCdtb2RlJykpIG9uTWFjUmVzdHJpY3Rpb25TaWduYWwoJ01pc3Npb24gQ29udHJvbCcpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIERpc2FibGUgbWFjT1Mtc3BlY2lmaWMgcmVzdHJpY3Rpb25zICh0b3VjaGJhciwgbW9uaXRvcmluZyBsaXN0ZW5lcnMgYW5kIGxvZyBwcm9jZXNzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVNYWNSZXN0cmljdGlvbnMoKSB7XG4gICAgY3VycmVudFdpbmhhbmRsZXIgPSBudWxsO1xuICAgIGlmICh3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCAhPSBudWxsKSB7XG4gICAgICAgIHRyeSB7IHN5c3RlbVByZWZlcmVuY2VzLnVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uKHdvcmtzcGFjZU5vdGlmaWNhdGlvbklkKTsgfSBjYXRjaCAoZXJyKSB7IGxvZy5lcnJvcigncGxhdGZvcm1yZXN0cmljdGlvbnMgQCBtYWM6IHVuc3Vic2NyaWJlV29ya3NwYWNlTm90aWZpY2F0aW9uJywgZXJyKTsgfVxuICAgICAgICB3b3Jrc3BhY2VOb3RpZmljYXRpb25JZCA9IG51bGw7XG4gICAgfVxuICAgIHBvd2VyTW9uaXRvci5vZmYoJ2xvY2stc2NyZWVuJywgbG9ja1NjcmVlbkhhbmRsZXIpO1xuICAgIHBvd2VyTW9uaXRvci5vZmYoJ3VubG9jay1zY3JlZW4nLCB1bmxvY2tTY3JlZW5IYW5kbGVyKTtcbiAgICBpZiAobG9nU3RyZWFtUHJvY2Vzcykge1xuICAgICAgICBsb2dTdHJlYW1Qcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgbG9nU3RyZWFtUHJvY2VzcyA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIERpc2FibGVzL2VuYWJsZXMgbWlzc2lvbiBjb250cm9sLCBzcGFjZXMgYW5kIHRyYWNrcGFkIGdlc3R1cmVzLlxuICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSB0cnVlIHJlc3RvcmVzIGV2ZXJ5dGhpbmcsIGZhbHNlIGxvY2tzIGV2ZXJ5dGhpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZU1hY09TTG9ja2Rvd24oZW5hYmxlKSB7XG4gICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5wbGF0Zm9ybSAhPT0gJ2RhcndpbicpIHJldHVybjtcbiAgICBsb2cuaW5mbyhgcGxhdGZvcm1yZXN0cmljdGlvbnMgQCB0b2dnbGVNYWNPU0xvY2tkb3duOiAke2VuYWJsZSA/ICdlbmFibGUnIDogJ2Rpc2FibGUnfSBtaXNzaW9uIGNvbnRyb2wgbG9ja2Rvd25gKTtcblxuICAgIGNvbnN0IG1jSWRzID0gWzMyLCAzMywgMzQsIDM1LCA3OSwgODAsIDgxLCA4MiwgMTE4LCAxMTksIDEyMCwgMTIxXTtcbiAgICBjb25zdCBwbGlzdFBhdGggPSBqb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5ob21lZGlyZWN0b3J5LCAnTGlicmFyeS9QcmVmZXJlbmNlcy9jb20uYXBwbGUuc3ltYm9saWNob3RrZXlzLnBsaXN0Jyk7XG4gICAgY29uc3QgYmFja3VwUGF0aCA9IGpvaW4ocGxhdGZvcm1EaXNwYXRjaGVyLnRlbXBkaXJlY3RvcnksICduZXh0X2V4YW1faG90a2V5c19iYWNrdXAucGxpc3QnKTtcblxuICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgY29uc3QgaG90a2V5Q29tbWFuZHMgPSBtY0lkcy5tYXAoaWQgPT5cbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuc3ltYm9saWNob3RrZXlzIEFwcGxlU3ltYm9saWNIb3RLZXlzIC1kaWN0LWFkZCAke2lkfSBcIjxkaWN0PjxrZXk+ZW5hYmxlZDwva2V5PjxmYWxzZS8+PC9kaWN0PlwiYFxuICAgICAgICApLmpvaW4oJzsgJyk7XG5cbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIGZhbHNlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93QXBwRXhwb3NlR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dEZXNrdG9wR2VzdHVyZUVuYWJsZWQgLWJvb2wgZmFsc2VgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAhIC1mIFwiJHtiYWNrdXBQYXRofVwiIF07IHRoZW4gY3AgXCIke3BsaXN0UGF0aH1cIiBcIiR7YmFja3VwUGF0aH1cIjsgZmk7XG4gICAgICAgICR7aG90a2V5Q29tbWFuZHN9O1xuICAgICAgICAke2dlc3R1cmVDb21tYW5kc307XG4gICAgICAgIGtpbGxhbGwgLTkgY2ZwcmVmc2Q7XG4gICAgICAgIHNsZWVwIDE7XG4gICAgICAgIC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9TeXN0ZW1BZG1pbmlzdHJhdGlvbi5mcmFtZXdvcmsvUmVzb3VyY2VzL2FjdGl2YXRlU2V0dGluZ3MgLXU7XG4gICAgICAgIGtpbGxhbGwgRG9ja1xuICAgICAgYDtcblxuICAgICAgICBjaGlsZFByb2Nlc3MuZXhlYyhmdWxsQ29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcignTG9ja2Rvd24gRW5hYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZ2VzdHVyZUNvbW1hbmRzID0gW1xuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dNaXNzaW9uQ29udHJvbEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgLFxuICAgICAgICAgICAgYGRlZmF1bHRzIHdyaXRlIGNvbS5hcHBsZS5kb2NrIHNob3dBcHBFeHBvc2VHZXN0dXJlRW5hYmxlZCAtYm9vbCB0cnVlYCxcbiAgICAgICAgICAgIGBkZWZhdWx0cyB3cml0ZSBjb20uYXBwbGUuZG9jayBzaG93RGVza3RvcEdlc3R1cmVFbmFibGVkIC1ib29sIHRydWVgXG4gICAgICAgIF0uam9pbignOyAnKTtcblxuICAgICAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGBcbiAgICAgICAgaWYgWyAtZiBcIiR7YmFja3VwUGF0aH1cIiBdOyB0aGVuIFxuICAgICAgICAgIGNwIFwiJHtiYWNrdXBQYXRofVwiIFwiJHtwbGlzdFBhdGh9XCI7IFxuICAgICAgICAgIHJtIFwiJHtiYWNrdXBQYXRofVwiOyBcbiAgICAgICAgZmk7XG4gICAgICAgICR7Z2VzdHVyZUNvbW1hbmRzfTtcbiAgICAgICAga2lsbGFsbCAtOSBjZnByZWZzZDtcbiAgICAgICAgc2xlZXAgMTtcbiAgICAgICAgL1N5c3RlbS9MaWJyYXJ5L1ByaXZhdGVGcmFtZXdvcmtzL1N5c3RlbUFkbWluaXN0cmF0aW9uLmZyYW1ld29yay9SZXNvdXJjZXMvYWN0aXZhdGVTZXR0aW5ncyAtdTtcbiAgICAgICAga2lsbGFsbCBEb2NrXG4gICAgICBgO1xuICAgICAgICBsb2cuaW5mbygnbWFpbiBAIHRvZ2dsZU1hY09TTG9ja2Rvd246IEVuYWJsZSBNaXNzaW9uQ29udG9sJyk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5leGVjKGZ1bGxDb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKCdMb2NrZG93biBEaXNhYmxlIEVycm9yOicsIGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG4ndXNlIHN0cmljdCdcbmltcG9ydCB7ZGlzYWJsZVJlc3RyaWN0aW9ucywgZW5hYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCBmcyBmcm9tICdmcycgXG5pbXBvcnQgYXJjaGl2ZXIgZnJvbSAnYXJjaGl2ZXInICAgLy8gZGFzIG1hY2h0IGtyYXNzZXN0ZSByYWNlY29kaXRpb25zIG1pdCBlbGVjdHJvbiBlaWdlbmVuIHZlcnNpb25lbiAtIHVuYmVkaW5ndCBkaWUgc2VsYmUgdmVyc2lvbiBiZWhhbHRlbiB3aWUgZWxlY3Ryb25cbmltcG9ydCBleHRyYWN0IGZyb20gJ2V4dHJhY3QtemlwJ1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBzY3JlZW4sIGlwY01haW4sIGFwcCwgQnJvd3NlcldpbmRvdywgd2ViQ29udGVudHMgfSBmcm9tICdlbGVjdHJvbidcbmltcG9ydCBXaW5kb3dIYW5kbGVyIGZyb20gJy4vd2luZG93aGFuZGxlci5qcydcbmltcG9ydCBJcGNIYW5kbGVyIGZyb20gJy4vaXBjaGFuZGxlci5qcydcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQge1NjaGVkdWxlclNlcnZpY2V9IGZyb20gJy4vc2NoZWR1bGVyc2VydmljZS50cydcbmltcG9ydCBUZXNzZXJhY3QgZnJvbSAndGVzc2VyYWN0LmpzJztcbmltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCBzY3JlZW5zaG90IGZyb20gJ3NjcmVlbnNob3QtZGVza3RvcC13YXlsYW5kJztcbmltcG9ydCB7IFdvcmtlciB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgcnVuUmVtb3RlQ2hlY2sgfSBmcm9tICcuL3JlbW90ZUNoZWNrLmpzJ1xuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlci5qcyc7XG5jb25zdCBzaGVsbCA9IChjbWQpID0+IHsgICByZXR1cm4gZXhlY1N5bmMoY21kLCB7IGVuY29kaW5nOiAndXRmOCcsIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdpZ25vcmUnXSB9KTsgfTsgIC8vIHN0ZGVyciB1bnRlcmRyXHUwMEZDY2t0IFxuY29uc3QgYWdlbnQgPSBuZXcgaHR0cHMuQWdlbnQoeyByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlIH0pO1xuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTsgXG5pbXBvcnQgeyBzd2l0Y2hFeGFtU2VjdGlvbiB9IGZyb20gJy4vc3dpdGNoRXhhbVNlY3Rpb24uanMnO1xuIC8qKlxuICAqIEhhbmRsZXMgaW5mb3JtYXRpb24gZmV0Y2hpbmcgZnJvbSB0aGUgc2VydmVyIGFuZCBhY3RzIG9uIHN0YXR1cyB1cGRhdGVzXG4gICovXG4gXG4gY2xhc3MgQ29tbUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQgPSBudWxsXG4gICAgICAgIHRoaXMuY29uZmlnID0gbnVsbFxuICAgICAgICB0aGlzLnVwZGF0ZVN0dWRlbnRJbnRlcnZhbGwgPSBudWxsXG4gICAgICAgIHRoaXMuV2luZG93SGFuZGxlciA9IG51bGxcbiAgICAgICAgdGhpcy5zY3JlZW5zaG90QWJpbGl0eSA9IGZhbHNlXG4gICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzID0gMCAvLyB3ZSBjb3VudCBmYWlscyBhbmQgZGVhY3RpdmF0ZSBvbiA0IGNvbnNlcXVlbnQgZmFpbHNcbiAgICAgICAgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCA9IHRydWVcbiAgICAgICAgdGhpcy50aW1lciA9IDBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBudWxsXG4gICAgICAgIHRoaXMudXNlV29ya2VyID0gdHJ1ZVxuICAgICAgICB0aGlzLndvcmtlckZhaWxzID0gMFxuICAgIH1cbiBcbiAgICBpbml0IChtYywgY29uZmlnKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnJlcXVlc3RVcGRhdGUuYmluZCh0aGlzKSwgNTAwMClcbiAgICAgICAgdGhpcy51cGRhdGVTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIgPSBuZXcgU2NoZWR1bGVyU2VydmljZSh0aGlzLnNlbmRTY3JlZW5zaG90LmJpbmQodGhpcyksIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdGludGVydmFsKVxuICAgICAgICB0aGlzLnNjcmVlbnNob3RTY2hlZHVsZXIuc3RhcnQoKVxuICAgICAgICBpZiAoIXRoaXMud29ya2VyICYmIHBsYXRmb3JtRGlzcGF0Y2hlci51c2VXb3JrZXIpeyAgdGhpcy5zZXR1cEltYWdlV29ya2VyKCkgIH1cbiAgICB9XG4gXG5cbiAgICAvKipcbiAgICAgKiBTZXR1cCB0aGUgaW1hZ2Ugd29ya2VyXG4gICAgICogdXNlcyBmb3JrIHRvIGNyZWF0ZSBhIG5ldyBjaGlsZCBwcm9jZXNzXG4gICAgICogdXNlcyB0aGUgaW1hZ2VXb3JrZXJMaW51eC5qcyBvciBpbWFnZVdvcmtlclNoYXJwLmpzIGZpbGVcbiAgICAgKiB0aGUgd29ya2VyIGlzIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2NyZWVuc2hvdCBpbiBhIHNlcGFyYXRlIHByb2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzZXR1cEltYWdlV29ya2VyKCkge1xuICAgICAgICBjb25zdCB3b3JrZXJVUkwgPSBwbGF0Zm9ybURpc3BhdGNoZXIud29ya2VyVVJMO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53b3JrZXIgPSBuZXcgV29ya2VyKHdvcmtlclVSTCwgeyB0eXBlOiAnbW9kdWxlJywgZW52OiB7IC4uLnByb2Nlc3MuZW52IH0gfSk7XG4gICAgICAgIGxvZy5kZWJ1ZyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogSW1hZ2VXb3JrZXIgaW5pdGlhbGl6ZWQuIFVzaW5nIFwiICsgcGxhdGZvcm1EaXNwYXRjaGVyLndvcmtlckZpbGVOYW1lKVxuICAgICAgICBcblxuICAgICAgICB0aGlzLndvcmtlci5vbignZXJyb3InLCBlcnJvciA9PiB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2V0dXBJbWFnZVdvcmtlcjogV29ya2VyIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLndvcmtlci5vbignZXhpdCcsIGNvZGUgPT4ge1xuICAgICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmtlckZhaWxzICs9IDFcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53b3JrZXJGYWlscyA+IDQpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZVdvcmtlciA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZXR1cEltYWdlV29ya2VyOiBXb3JrZXIgZmFpbGVkIDUgdGltZXMgLSBzd2l0Y2hpbmcgdG8gbm8gcHJvY2Vzc2luZycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgeyB0aGlzLnNldHVwSW1hZ2VXb3JrZXIoKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBzdGFydCBsb2NhbCBWaXJ0dWFsQm94IFZNIGFuZCB1cGRhdGUgY2xpZW50aW5mby5sb2NhbFZNSG9zdC9sb2NhbFZNU3RhdGVcbiAgICBhc3luYyBzdGFydExvY2FsVk1BbmRSZXNvbHZlSG9zdCh2bU5hbWUpe1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsVk1Ib3N0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbFZNU3RhdGUgPSBudWxsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0T3V0cHV0ID0gc2hlbGwoJ1ZCb3hNYW5hZ2UgbGlzdCB2bXMnKTtcbiAgICAgICAgICAgIGNvbnN0IHZtRXhpc3RzID0gbGlzdE91dHB1dC5zcGxpdCgnXFxuJykuc29tZShsaW5lID0+IGxpbmUuaW5jbHVkZXMoYFwiJHt2bU5hbWV9XCJgKSk7XG4gICAgICAgICAgICBpZiAoIXZtRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0TG9jYWxWTUFuZFJlc29sdmVIb3N0OiBWTSAnJHt2bU5hbWV9JyBub3QgZm91bmQgb24gY2xpZW50YCk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWTSBub3QgaW5zdGFsbGVkIG9uIGNsaWVudCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydExvY2FsVk1BbmRSZXNvbHZlSG9zdDogbGlzdCB2bXMgZmFpbGVkJywgZXJyKTtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzaGVsbChgVkJveE1hbmFnZSBzdGFydHZtIFwiJHt2bU5hbWV9XCIgLS10eXBlIGhlYWRsZXNzYCk7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsVk1TdGF0ZSA9ICdzdGFydGluZyc7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLy8gVk0gbWlnaHQgYWxyZWFkeSBiZSBydW5uaW5nOyBsb2cgYXQgaW5mbyBsZXZlbCBhbmQgY29udGludWVcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IGVyciAmJiBlcnIubWVzc2FnZSA/IFN0cmluZyhlcnIubWVzc2FnZSkgOiAnJztcbiAgICAgICAgICAgIGlmICgvYWxyZWFkeSBydW5uaW5nfFZCT1hfRV9JTlZBTElEX1ZNX1NUQVRFL2kudGVzdChtc2cpKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRMb2NhbFZNQW5kUmVzb2x2ZUhvc3Q6IFZNIGFscmVhZHkgcnVubmluZywgY29udGludWluZycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydExvY2FsVk1BbmRSZXNvbHZlSG9zdDogc3RhcnR2bSBmYWlsZWQgKGNvbnRpbnVpbmcgYW55d2F5KScsIGVycj8ubWVzc2FnZSB8fCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHJ5IHRvIHJlc29sdmUgSVAgc2V2ZXJhbCB0aW1lc1xuICAgICAgICBsZXQgaXBBZGRyZXNzID0gbnVsbDtcbiAgICAgICAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCAxMDsgYXR0ZW1wdCsrKXtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaXBBZGRyZXNzID0gYXdhaXQgdGhpcy5yZXNvbHZlVm1JcCh2bU5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChpcEFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbFZNSG9zdCA9IGlwQWRkcmVzcztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbFZNU3RhdGUgPSAncnVubmluZyc7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0TG9jYWxWTUFuZFJlc29sdmVIb3N0OiBWTSBJUCByZXNvbHZlZCB0byAke2lwQWRkcmVzc31gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydExvY2FsVk1BbmRSZXNvbHZlSG9zdDogcmVzb2x2ZVZtSXAgYXR0ZW1wdCBmYWlsZWQnLCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCgyMDAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydExvY2FsVk1BbmRSZXNvbHZlSG9zdDogY291bGQgbm90IHJlc29sdmUgVk0gSVAnKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgcmVzb2x2ZSBWTSBJUCcpO1xuICAgIH1cblxuICAgIGFzeW5jIHJlc29sdmVWbUlwKHZtTmFtZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBndWVzdFByb3AgPSBzaGVsbChgVkJveE1hbmFnZSBndWVzdHByb3BlcnR5IGdldCBcIiR7dm1OYW1lfVwiIFwiL1ZpcnR1YWxCb3gvR3Vlc3RJbmZvL05ldC8wL1Y0L0lQXCJgKS50cmltKCk7XG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGd1ZXN0UHJvcC5zcGxpdCgnICcpO1xuICAgICAgICAgICAgY29uc3QgbGFzdCA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgaWYgKGxhc3QgJiYgbGFzdCAhPT0gJ3ZhbHVlJyAmJiBsYXN0ICE9PSAnTm8nICYmIGxhc3QgIT09ICdOb25lJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXNvbHZlVm1JcDogZ3Vlc3Rwcm9wZXJ0eSBmYWlsZWQnLCBlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBzaGVsbChgVkJveE1hbmFnZSBzaG93dm1pbmZvIFwiJHt2bU5hbWV9XCJgKTtcbiAgICAgICAgICAgIGNvbnN0IG5pY0xpbmUgPSBpbmZvLnNwbGl0KCdcXG4nKS5maW5kKGxpbmUgPT4gbGluZS5pbmNsdWRlcygnTklDIDEnKSk7XG4gICAgICAgICAgICBpZiAoIW5pY0xpbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1hY01hdGNoID0gbmljTGluZS5tYXRjaCgvTUFDIGFkZHJlc3M6IChbMC05QS1GYS1mXSspLyk7XG4gICAgICAgICAgICBpZiAoIW1hY01hdGNoIHx8ICFtYWNNYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWFjID0gbWFjTWF0Y2hbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IGFycE91dHB1dCA9IHNoZWxsKCdhcnAgLWFuJyk7XG4gICAgICAgICAgICBjb25zdCBhcnBMaW5lID0gYXJwT3V0cHV0LnNwbGl0KCdcXG4nKS5maW5kKGxpbmUgPT4gbGluZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKG1hYykpO1xuICAgICAgICAgICAgaWYgKCFhcnBMaW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBpcE1hdGNoID0gYXJwTGluZS5tYXRjaCgvXFwoKFteKV0rKVxcKS8pO1xuICAgICAgICAgICAgaWYgKGlwTWF0Y2ggJiYgaXBNYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpcE1hdGNoWzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXNvbHZlVm1JcDogZmFsbGJhY2sgcmVzb2x1dGlvbiBmYWlsZWQnLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuXG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBzY3JlZW5zaG90IFxuICAgICAqIGlmIHVzZVdvcmtlciBpcyB0cnVlLCB0aGUgc2NyZWVuc2hvdCBpcyBwcm9jZXNzZWQgaW4gYSBzZXBhcmF0ZSBwcm9jZXNzXG4gICAgICogb3RoZXJ3aXNlIHRoZSBzY3JlZW5zaG90IGlzIG5vdCBwcm9jZXNzZWQgYW5kIHRoZSBvcmlnaW5hbCBzY3JlZW5zaG90IGlzIHJldHVybmVkXG4gICAgICovXG4gICAgYXN5bmMgcHJvY2Vzc0ltYWdlKGltZ0J1ZmZlcikge1xuICAgICAgICBpZiAocGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLndvcmtlcikgeyAvL3RyaXBsZSBjaGVjayBpZiB3b3JrZXIgaXMgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dvcmtlciBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHsgaW1nQnVmZmVyOiBBcnJheS5mcm9tKGltZ0J1ZmZlciksIGltVmVyc2lvbjogcGxhdGZvcm1EaXNwYXRjaGVyLmltVmVyc2lvbiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud29ya2VyLm9uY2UoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmYWxsYmFjayB0byBubyBwcm9jZXNzaW5nICAgXG4gICAgICAgICAgICBjb25zdCBzY3JlZW5zaG90QmFzZTY0ID0gQnVmZmVyLmZyb20oaW1nQnVmZmVyKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJCYXNlNjQgPSBzY3JlZW5zaG90QmFzZTY0XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBzY3JlZW5zaG90QmFzZTY0OiBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQ6IGhlYWRlckJhc2U2NCwgaXNibGFjazogZmFsc2UsIGltZ0J1ZmZlcjogaW1nQnVmZmVyIH07XG5cbiAgICAgICAgfVxuICAgIH1cblxuXG5cblxuXG5cblxuICAgIC8qKiBcbiAgICAgKiBVcGRhdGUgY3VycmVudCBTZXJ2ZXJzdGF0dXMgKyBTdHVkZW50dHN0YXR1cyAoZXZlcnkgNSBzZWNvbmRzKVxuICAgICAqL1xuICAgIGFzeW5jIHJlcXVlc3RVcGRhdGUoKXtcblxuICAgICAgICB0aGlzLnRpbWVyKysgICAvLyB3ZSB1c2UgdGltZXIgdG8gdGltZSBsb29wcyB3aXRoIGRpZmZlcmVudCBpbnRlcnZhbHMgd2l0aG91dCBpbnRyb2R1Y2luZyBuZXcgdW5uZWNjZXNhcnkgc2NoZWR1bGVyc1xuICAgICAgICBpZiAodGhpcy50aW1lciAlIDIwID09PSAwICl7ICAvLyBydW4gZXZlcnkgMjAqNSAodXBkYXRlbG9vcCkgc2Vjb25kc1xuXG4gICAgICAgICAgICBjb25zdCB1c2VzUmVtb3RlQXNzaXN0YW50ID0gYXdhaXQgcnVuUmVtb3RlQ2hlY2socHJvY2Vzcy5wbGF0Zm9ybSlcblxuICAgICAgICAgICAgaWYgKHVzZXNSZW1vdGVBc3Npc3RhbnQpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybignbWFpbiBAIHJlYWR5OiBQb3NzaWJsZSByZW1vdGUgYXNzaXN0YW5jZSBkZXRlY3RlZCcpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiB1c2VzUmVtb3RlQXNzaXN0YW50LmtleXdvcmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBtYWluIEAgcmVhZHk6IEtleXdvcmQgJHtrZXl3b3JkfSBkZXRlY3RlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvcnQgb2YgdXNlc1JlbW90ZUFzc2lzdGFudC5wb3J0cykge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgbWFpbiBAIHJlYWR5OiBQb3J0ICR7cG9ydH0gZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5yZW1vdGVhc3Npc3RhbnQgPSB1c2VzUmVtb3RlQXNzaXN0YW50XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmluaXRCbG9ja1dpbmRvd3MoKSAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSBuZXcgc2NyZWVuIHRoYXQgbmVlZHMgdG8gYmUgYmxvY2tlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NhbExvY2tkb3duKXtyZXR1cm59XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbiBsb3N0IHJlc2V0IHRyaWdnZXJlZCAgbm8gc2VydmVyc2lnbmFsIGZvciAyMCBzZWNvbmRzXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA+PSA1ICl7ICBcbiAgICAgICAgICAgICBpZiAoIXRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCl7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6IENvbm5lY3Rpb24gdG8gVGVhY2hlciBsb3N0ISBSZW1vdmluZyByZWdpc3RyYXRpb24uXCIpIC8vcmVtb3ZlIHNlcnZlciByZWdpc3RyYXRpb24gbG9jYWxseSAoc2FtZSBhcyAna2ljaycpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldENvbm5lY3Rpb24oKSAgIC8vIHRoaXMgYWxzbyByZXNldHMgc2VydmVyaXAgdGhlcmVmb3JlIG5vIGFwaSBjYWxscyBhcmUgbWFkZSBhZnRlcndhcmRzXG4gICAgICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpICAgICAgIC8vIGp1c3QgaW4gY2FzZSBzY3JlZW5zIGFyZSBibG9ja2VkLi4gbGV0IHN0dWRlbnRzIHdvcmtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgXG5cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXApIHsgIC8vY2hlY2sgaWYgc2VydmVyIGNvbm5lY3RlZCAtIGdldCBpcFxuICAgICAgICAgICAgbGV0IHBheWxvYWQgPSB7Y2xpZW50aW5mbzogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mb31cblxuICAgICAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBcIm5vLXN0b3JlXCIsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsgdGhyb3cgbmV3IEVycm9yKCdOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTsgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgICAgICAoZGF0YS5tZXNzYWdlID09PSBcIm5vdGF2YWlsYWJsZVwiKXsgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogRXhhbSBJbnN0YW5jZSBub3QgZm91bmQhJyk7ICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9IDU7IH0gICAgLy8gZXhhbSBpbnN0YW5jZSBub3QgYXZhaWxhYmxlIGJ1dCBzZXJ2ZXIgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdGEubWVzc2FnZSA9PT0gXCJyZW1vdmVkXCIpeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgcmVxdWVzdFVwZGF0ZTogU3R1ZGVudCByZWdpc3RyYXRpb24gbm90IGZvdW5kIScpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoKVxuICAgICAgICAgICAgICAgICAgICB9ICAgLy8gc3R1ZGVudCBnb3Qga2lja2VkIC0gd2UgaGFuZGxlIHRoaXMgZGlmZmVyZW50bHkgbm93LiB0ZWFjaGVyIHN0b3JlcyBcImtpY2tlZFwiIGZvciBzdHVkZW50IHRvIGNvbGxlY3QuIHN0dWRlbnQgaXMgcmVtb3ZlZCBmcm9tIHNlcnZlciB3aGVuIGNvbGxlY3Rpbmcga2lja2VkIGluZm8uIHN0dWRlbnQgY2xvc2VzIGV4YW0gYW5kIGNsZWFucyB1cC5cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHJlcXVlc3RVcGRhdGU6ICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3R9IEhlYXJ0YmVhdCBsb3N0Li5gKTsgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ICs9IDE7fSAgIC8vIGhlYXJ0YmVhdCBsb3N0IHNlcnZlciBub3QgcmVhY2hhYmxlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuYmVhY29uc0xvc3QgPSAwOyAvLyBEaWVzIHpcdTAwRTRobHQgZWJlbmZhbGxzIGFscyBlcmZvbGdyZWljaGVyIEhlYXJ0YmVhdCAtIFZlcmJpbmR1bmcgaGFsdGVuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpbnRyZXF1ZXN0ID0gZmFsc2UgIC8vc2V0IHRoaXMgdG8gZmFsc2UgYWZ0ZXIgdGhlIHJlcXVlc3QgbGVmdCB0aGUgY2xpZW50IHRvIHByZXZlbnQgZG91YmxlIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzRGVlcENvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEuc2VydmVyc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRTdGF0dXNEZWVwQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZGF0YS5zdHVkZW50c3RhdHVzKSk7IFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzKHNlcnZlclN0YXR1c0RlZXBDb3B5LCBzdHVkZW50U3RhdHVzRGVlcENvcHkpOy8vIFZlcmFyYmVpdHVuZyBkZXIgZW1wZmFuZ2VuZW4gRGF0ZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCArPSAxO1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCByZXF1ZXN0VXBkYXRlOiAoJHt0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdH0pICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgLy8gcHJldmVudCBmb2N1cyB3YXJuaW5nIGJsb2NrIGlmIG5vIGNvbm5lY3Rpb24gXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZSAgLy8gaWYgbm90IGNvbm5lY3RlZCBidXQgc3RpbGwgaW4gZXhhbSBtb2RlIHlvdSBjb3VsZCB0cmlnZ2VyIGEgZm9jdXMgd2FybmluZyBhbmQgbm9ib2R5IGlzIGFibGUgdG8gdW5sb2NrIHlvdVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuICAgIGFzeW5jIHNlbmRTY3JlZW5zaG90KCl7XG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24pe3JldHVybn1cbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID49IDUgKXtyZXR1cm59ICAvLyBjb25uZWN0aW9uIGxvc3QgcmVzZXQgdHJpZ2dlcmVkXG4gICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwKSB7ICAvL2NoZWNrIGlmIHNlcnZlciBjb25uZWN0ZWQgLSBnZXQgaXBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3MsIHNjcmVlbnNob3RCYXNlNjQsIGhlYWRlckJhc2U2NCwgaXNibGFjazsgLy8gVmFyaWFibGVuIGF1XHUwMERGZXJoYWxiIGRlcyBpZi1CbG9ja3MgZGVmaW5pZXJlblxuICAgICAgICAgICAgbGV0IGltZ0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXRmb3JtRGlzcGF0Y2hlci5zY3JlZW5zaG90QWJpbGl0eSl7ICBcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIHNjcmVlbnNob3QgZnJvbSBkZXNrdG9wIHZpYSBzY3JlZW5zaG90LWRlc2t0b3Atd2F5bGFuZCAoZmxhbWVzaG90LCBpbWFnZW1hZ2ljLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3QoeyBmb3JtYXQ6ICdwbmcnIH0pO1xuICAgICAgICAgICAgICAgICAgICAoeyBzdWNjZXNzLCBzY3JlZW5zaG90QmFzZTY0LCBoZWFkZXJCYXNlNjQsIGlzYmxhY2ssIGltZ0J1ZmZlciB9ID0gYXdhaXQgdGhpcy5wcm9jZXNzSW1hZ2UoaW1nQnVmZmVyKSk7ICAvLyBrZWluIGltYWdlQnVmZmVyIG1pdGdlZ2ViZW4gYmVkZXV0ZXQgbnV0emUgc2NyZWVuc2hvdC1kZXNrdG9wIGltIHdvcmtlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcykgeyB0aGlzLnNjcmVlbnNob3RGYWlscyA9IDA7fVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbWFnZSBwcm9jZXNzaW5nIGZhaWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ncmFiIFwic2NyZWVuc2hvdFwiIGZyb20gYXBwd2luZG93XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdXJyZW50Rm9jdXNlZE1pbmRvdyA9IFdpbmRvd0hhbmRsZXIuZ2V0Q3VycmVudEZvY3VzZWRXaW5kb3coKSAgLy9yZXR1cm5zIGV4YW0gd2luZG93IGlmIG5vdGhpbmcgaW4gZm9jdXMgb3IgbWFpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRGb2N1c2VkTWluZG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY3VycmVudEZvY3VzZWRNaW5kb3cud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKSAgLy8gdGhpcyBzaG91bGQgYWx3YXlzIHdvcmsgYmVjYXVzZSBpdCdzIG9uYm9hcmQgZWxlY3Ryb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGltZ0J1ZmZlciA9IHJlc3VsdC50b1BORygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKHsgc3VjY2Vzcywgc2NyZWVuc2hvdEJhc2U2NCwgaGVhZGVyQmFzZTY0LCBpc2JsYWNrIH0gPSBhd2FpdCB0aGlzLnByb2Nlc3NJbWFnZShpbWdCdWZmZXIpKTsgLy8gYXR0ZW50aW9uIHByb2Nlc3NJbWFnZSAgY29udmVydHMgYnVmZmVyIHRvIHVpbnQ4YXJyYXlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaChlcnIpe1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdEZhaWxzICs9MTtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IHByb2Nlc3NJbWFnZSBmYWlsZWQ6ICR7ZXJyfWApXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNQUNPUyBXT1JLQVJPVU5EIC0gc3dpdGNoIHRvIHBhZ2VjYXB0dXJlIGlmIG5vIHBlcm1pc3NvbnMgYXJlIGdyYW50ZWRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgJiYgdGhpcy5maXJzdENoZWNrU2NyZWVuc2hvdCAmJiBpbWdCdWZmZXIgIT09IG51bGwpeyAgLy90aGlzIGlzIGZvciBtYWNPUyBiZWNhdXNlIGl0IGRlbGl2ZXJzIGEgYmxhbmsgYmFja2dyb3VuZCBzY3JlZW5zaG90IHdpdGhvdXQgcGVybWlzc2lvbnMuIHdlIGNhdGNoIHRoYXQgY2FzZSB3aXRoIGEgd29ya2Fyb3VuZFxuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDaGVja1NjcmVlbnNob3QgPSBmYWxzZSAgIC8vbmV2ZXIgZG8gdGhpcyBhZ2FpblxuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcbiAgICAgICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZGF0YTogeyB0ZXh0IH0gfSAgID0gYXdhaXQgVGVzc2VyYWN0LnJlY29nbml6ZShpbWdCdWZmZXIgLCAnZW5nJyx7IGxhbmdQYXRoOiBwdWJsaWNQYXRoLCBjYWNoZVBhdGg6IHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkgfSApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwV2luZG93VmlzaWJsZSA9IHRleHQuaW5jbHVkZXMoXCJFeGFtXCIpICAgLy9jaGVjayBpZiB0aGUgd29yZCBcIkV4YW1cIiBjYW4gYmUgZm91bmQgaW4gc2NyZWVuc2hvdCAtIG90aGVyd2lzZSBpdCBpcyBtb3N0IGxpa2VseSBhIGJsYW5rIGRlc2t0b3AgLSBtYWNvcyBxdWlya1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFwcFdpbmRvd1Zpc2libGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5PWZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6IFBsZWFzZSBjaGVjayB5b3VyIHNjcmVlbnNob3QgcGVybWlzc2lvbnMgLSBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7IGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdCAobWFjb3MpOiBNYWNPUyBzY3JlZW5zaG90cGVybWlzc2lvbnMgY2hlY2sgT0tcIik7fVxuICAgICAgICAgICAgICAgIH1jYXRjaChlcnIpeyAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90IChtYWNvcyk6ICR7ZXJyfWApOyB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLy8gaWYgc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2UgZG8gbm90IGhhdmUgYSBzY3JlZW5zaG90IC0gc28gZG8gbm90IHVwZGF0ZSB0aGUgc2VydmVyXG4gICAgICAgICAgICBpZiAoIXNjcmVlbnNob3RCYXNlNjQpe1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHkpeyBwbGF0Zm9ybURpc3BhdGNoZXIuc2NyZWVuc2hvdEFiaWxpdHk9ZmFsc2U7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogU2NyZWVuc2hvdCBlcnJvciAtPiBTd2l0Y2hpbmcgdG8gUGFnZUNhcHR1cmVgKSB9IFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5KXsgcGxhdGZvcm1EaXNwYXRjaGVyLnVzZVdvcmtlciA9IGZhbHNlOyBsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFNjcmVlbnNob3Q6IFBhZ2VDYXB0dXJlIGVycm9yIC0+IFN3aXRjaGluZyB0byBOby1Qcm9jZXNzaW5nYCkgfSAgIFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuc2NyZWVuc2hvdEZhaWxzID4gNCAmJiAhcGxhdGZvcm1EaXNwYXRjaGVyLnNjcmVlbnNob3RBYmlsaXR5ICYmICFwbGF0Zm9ybURpc3BhdGNoZXIudXNlV29ya2VyKXsgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBubyBzY3JlZW5zaG90IGF2YWlsYWJsZSAtIHBsZWFzZSBmaXggeW91ciBzZXR1cGApIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuXG5cblxuICAgICAgICAgICAgLy9kbyBub3QgcnVuIGNvbG9yY2hlY2sgaWYgYWxyZWFkeSBsb2NrZWRcbiAgICAgICAgICAgIGlmICggdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyl7XG4gICAgICAgICAgICAgICAgaWYgKGlzYmxhY2spe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRTY3JlZW5zaG90OiBTdHVkZW50IFNjcmVlbnNob3QgZG9lcyBub3QgZml0IHJlcXVpcmVtZW50cyAoYWxsYmxhY2spXCIpO1xuICAgICAgICAgICAgICAgIH0gICBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQmVyZWNobmVuIGRlcyBNRDUtSGFzaHMgZGVzIEJhc2U2NC1TdHJpbmdzXG4gICAgICAgICAgICBsZXQgc2NyZWVuc2hvdGhhc2ggPSBudWxsXG4gICAgICAgICAgICB0cnkgeyBzY3JlZW5zaG90aGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoQnVmZmVyLmZyb20oc2NyZWVuc2hvdEJhc2U2NCwgJ2Jhc2U2NCcpKS5kaWdlc3QoXCJoZXhcIik7ICB9ICAvLyBCZXJlY2huZW4gZGVzIE1ENS1IYXNocyBkZXMgQmFzZTY0LVN0cmluZ3NcbiAgICAgICAgICAgIGNhdGNoKGVycil7IGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzZW5kU2NyZWVuc2hvdDogY3JlYXRpbmcgaGFzaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCkgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgICAgICAgICBjbGllbnRpbmZvOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3Q6IHNjcmVlbnNob3RCYXNlNjQsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGhhc2g6IHNjcmVlbnNob3RoYXNoLFxuICAgICAgICAgICAgICAgIGhlYWRlcjogaGVhZGVyQmFzZTY0LFxuICAgICAgICAgICAgICAgIHNjcmVlbnNob3RmaWxlbmFtZTogdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiArIFwiLmpwZ1wiLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIHNlbmQgc2NyZWVuc2hvdCB0byBzZXJ2ZXIgdmlhIGVtYWlsIGZldGNoIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBhdHRlbXB0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSAyO1xuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3VwZGF0ZXNjcmVlbnNob3RgO1xuICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCwgbWF4UmV0cmllcyk7IC8vIEVyc3RlIEFuZnJhZ2Ugc3RhcnRlblxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG5cbiAgICBkb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCA9IDAsIG1heFJldHJpZXMpIHtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgY2FjaGU6IFwibm8tc3RvcmVcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgICAgYWdlbnQsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBOZXR3b3JrIHJlc3BvbnNlIHdhcyBub3Qgb2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZG9TY3JlZW5zaG90VXBkYXRlOiBTdGF0dXMgRXJyb3I6XCIsIGRhdGEubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICBpZiAoYXR0ZW1wdCA8IG1heFJldHJpZXMgLSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1NjcmVlbnNob3RVcGRhdGUodXJsLCBwYXlsb2FkLCBhZ2VudCwgYXR0ZW1wdCArIDEsIG1heFJldHJpZXMpOyAvLyBSZXRyeVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRlbXB0ID09PSBtYXhSZXRyaWVzIC0gMSAmJiB0aGlzLm11bHRpY2FzdENsaWVudC5iZWFjb25zTG9zdCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBkb1NjcmVlbnNob3RVcGRhdGUgKGZldGNoKTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cblxuXG5cblxuICAgIGFzeW5jIGtpY2tTdHVkZW50KHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICBsb2cud2FybihcImNvbW11bmljYXRpb25oYW5kbGVyIEAga2lja1N0dWRlbnQ6IFN0dWRlbnQgZ290IGtpY2tlZCBieSBUZWFjaGVyXCIpXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmtpY2tlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmJlYWNvbnNMb3N0ID0gMFxuICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0ge2RlbGZvbGRlcm9uZXhpdDogZmFsc2V9ICAvLyBkbyBub3QgZGVsZXRlIGZvbGRlciBvbiBleGl0IGJlY2F1c2Ugc3R1ZGVudCBnb3Qga2lja2VkXG4gICAgICAgIGlmIChzdHVkZW50c3RhdHVzICYmIHN0dWRlbnRzdGF0dXMuZGVsZm9sZGVyKXsgc2VydmVyc3RhdHVzLmRlbGZvbGRlcm9uZXhpdCA9IHRydWV9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmVuZEV4YW0oc2VydmVyc3RhdHVzKVxuICAgICAgICB0aGlzLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgIH1cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogcmVhY3QgdG8gc2VydmVyIHN0YXR1cyBcbiAgICAgKiB0aGlzIGN1cnJlbnRseSBvbmx5IGhhbmRsZSBzdGFydGV4YW0gJiBlbmRleGFtXG4gICAgICogY291bGQgYWxzbyBoYW5kbGUga2ljaywgZm9jdXNyZXN0b3JlLCBhbmQgZXZlbiB0cmlnZ2VyIGZpbGUgcmVxdWVzdHNcbiAgICAgKi9cbiAgICBhc3luYyBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1cyhzZXJ2ZXJzdGF0dXMsIHN0dWRlbnRzdGF0dXMpe1xuICAgICAgICAvLyB1cGRhdGUgc2VydmVyc3RhdHVzIGluIG11bHRpY2FzdGNsaWVudCBzbyBnZXRpbmZvYXN5bmMgKGFuZCB0aHVzIHRoZSBmcm9udGVuZCkgcmV0dXJucyBjdXJyZW50IHNlcnZlcnN0YXR1cyBvbiBuZXh0IGZldGNoXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LnNlcnZlcnN0YXR1cyA9IHNlcnZlcnN0YXR1cztcbiAgICAgICAgXG4gICAgICAgIFxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgIC8vIGluZGl2aWR1YWwgc3RhdHVzIHVwZGF0ZXNcblxuICAgICAgICBpZiAoIHN0dWRlbnRzdGF0dXMgJiYgT2JqZWN0LmtleXMoc3R1ZGVudHN0YXR1cykubGVuZ3RoICE9PSAwKSB7ICAvLyB3ZSBoYXZlIHN0YXR1cyB1cGRhdGVzICh0YXNrcykgLSBkbyBpdCFcbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnByaW50ZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2RlbmllZCcpICAgLy90cmlnZ2VyLCB3aHlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMua2lja2VkKSB7ICAvLyBzdHVkZW50IGdvdCBraWNrZWQgYnkgdGVhY2hlclxuICAgICAgICAgICAgICAgIHRoaXMua2lja1N0dWRlbnQoc3R1ZGVudHN0YXR1cylcbiAgICAgICAgICAgICAgICByZXR1cm4gICAvL3RoaXMgZW5kcyBoZXJlIGJlY2F1c2Ugd2UgZ290IGtpY2tlZCBieSB0aGUgdGVhY2hlclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5kZWxmb2xkZXIgPT09IHRydWUpe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogY2xlYW5pbmcgZXhhbSB3b3JrZm9sZGVyXCIpXG4gICAgICAgICAgICAgICAgbGV0IGRlbGZvbGRlciA9IHRydWVcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSl7ICAgLy8gc2V0IGJ5IHNlcnZlci5qcyAoZGVza3RvcCBwYXRoICsgZXhhbWRpcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJtU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxuICAgICAgICAgICAgICAgICAgICBkZWxmb2xkZXIgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyb3IpICBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBDYW4gbm90IGRlbGV0ZSBkaXJlY3RvcnkgLSAke2Vycm9yfSBgKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkZWxmb2xkZXIgPT0gZmFsc2UpeyAgLy90cnkgZGVsZXRpbmcgZmlsZSBieSBmaWxlICh0aGUgb25lIHRoYXQgY2F1c2VzIHRoZSBwcm9ibGVtIHdpbGwgc3RheSBpbiB0aGUgZm9sZGVyKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7IGZzLnJtU3luYyhmaWxlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gIC8vIFZlcnN1Y2hlLCBkYXMgVmVyemVpY2huaXMgcmVrdXJzaXYgenUgbFx1MDBGNnNjaGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyBmcy51bmxpbmtTeW5jKGZpbGVQYXRoKTsgIH0vLyBWZXJzdWNoZSwgZGllIERhdGVpIHp1IGxcdTAwRjZzY2hlbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogKGRlbGZvbGRlcikgRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuIGRlciBEYXRlaS9WZXJ6ZWljaG5pczogJHtmaWxlUGF0aH1gLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mb2N1cyA9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLnJlc3RvcmVmb2N1c3N0YXRlID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IHJlc3RvcmluZyBmb2N1cyBzdGF0ZSBmb3Igc3R1ZGVudFwiKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyAmJiAhdGhpcy5jb25maWcuZGV2ZWxvcG1lbnQpeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEtpb3NrKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5mb2N1cygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuYWN0aXZhdGVQcml2YXRlU3BlbGxjaGVjayA9PSB0cnVlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IGZhbHNlICApe1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBwcm9jZXNzVXBkYXRlZFNlcnZlcnN0YXR1czogYWN0aXZhdGluZyBzcGVsbGNoZWNrIGZvciBzdHVkZW50XCIpXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjay5hY3RpdmF0ZSA9IHRydWUgIC8vY2xpZW50aW5mby5wcml2YXRlU3BlbGxjaGVjayB3aWxsIGJlIHB1dCBvbiB0aGlzLnByaXZhdGVTcGVsbGNoZWNrIGluIGVkaXRvciB1cGRhdGVkIHZpYSBmZXRjaEluZm8oKVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGlwY01haW4uZW1pdChcInN0YXJ0TGFuZ3VhZ2VUb29sXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTcGVsbGNoZWNrID09IGZhbHNlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucHJpdmF0ZVNwZWxsY2hlY2suYWN0aXZhdGVkID09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBkZS1hY3RpdmF0aW5nIHNwZWxsY2hlY2sgZm9yIHN0dWRlbnRcIilcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLmFjdGl2YXRlZCA9IGZhbHNlIFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnByaXZhdGVTcGVsbGNoZWNrLnN1Z2dlc3Rpb25zID0gc3R1ZGVudHN0YXR1cy5hY3RpdmF0ZVByaXZhdGVTdWdnZXN0aW9uc1xuXG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5zZW5kZXhhbSA9PT0gdHJ1ZSl7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRXhhbVRvVGVhY2hlcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R1ZGVudHN0YXR1cy5mZXRjaGZpbGVzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RGaWxlRnJvbVNlcnZlcihzdHVkZW50c3RhdHVzLmZpbGVzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0dWRlbnRzdGF0dXMuZ2V0bWF0ZXJpYWxzID09PSB0cnVlKXtcbiAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIFxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGFuIG1pY3Jvc29mdDM2NSB0aGluZy4gY2hlY2sgaWYgZXhhbSBtb2RlIGlzIG9mZmljZSwgY2hlY2sgaWYgdGhpcyBpcyBzZXQgLSBvdGhlcndpc2UgZG8gbm90IGVudGVyIGV4YW1tb2RlIC0gaXQgd2lsbCBmYWlsXG4gICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgc2hhcmluZyBsaW5rIC0gaXQgd2lsbCBiZSB1c2VkIGluIFwibWljcm9zb2Z0MzY1XCIgZXhhbSBtb2RlXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm1zb2ZmaWNlc2hhcmUgPSBzdHVkZW50c3RhdHVzLm1zb2ZmaWNlc2hhcmUgIFxuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGlmIChzdHVkZW50c3RhdHVzLmdyb3VwKXtcbiAgICAgICAgICAgICAgICAvL3NldCBvciB1cGRhdGUgZ3JvdXAgXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXAgIT09IHN0dWRlbnRzdGF0dXMuZ3JvdXApe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gc3R1ZGVudHN0YXR1cy5ncm91cCAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgXG4gICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZ2V0bWF0ZXJpYWxzJykgIC8vIGlmIHdlIGNoYW5nZSBncm91cCB3ZSBuZWVkIHRvIGdldCB0aGUgbWF0ZXJpYWxzIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgXG5cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgLy8gZ2xvYmFsIHN0YXR1cyB1cGRhdGVzXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgXG4gICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgKiBTV0lUQ0ggRVhBTSBTRUNUSU9OICBTVEFSVFxuICAgICAgICAgKiBBVFRFTlRJT046IG1vdmUgdGhpcyB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIC0gaXQgaXMgdG9vIGNvbXBsZXggYW5kIHNob3VsZCBiZSBzcGxpdCB1cFxuICAgICAgICAgKiBpbiB0aGUgZnV0dXJlIHdlIHdlbGwgZGV0ZXJtaW5lIGlmIHNlY3Rpb24gc3dpdGNoIGlzIGhhbmRsZWQgYnkgdGhlIHRlYWNoZXIgb3IgYnkgdGhlIHN0dWRlbnQgYW5kIGFjdCBhY2NvcmRpbmdseVxuICAgICAgICAgKiBpZiBoYW5kbGVkIGJ5IHN0dWRlbnQgdGhlIHRlYWNoZXIgc3R0dHVzIGlzIGlnbm9yZWQgYW5kIHRoZSBzd2ljaCBzZWN0aW9uIGZ1bmN0aW9uIGlzIGNhbGxlZCBkaXJlY3RseSAocHJvYmFibHkgbW92ZSB0byBpcGNoYW5kbGVyLmpzKVxuICAgICAgICAgKi9cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuYWxsb3dTZWN0aW9uU3dpdGNoICE9PSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2VydmVyc3RhdHVzLmFsbG93U2VjdGlvblN3aXRjaCl7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIHNlcnZlcnN0YXR1cyBpbiBleGFtd2luZG93IHNvIGl0IGlzIGF2YWlsYWJsZSBmb3IgdGhlIGZyb250ZW5kXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBwZXJtaXNzaW9uIHRvIHN3aXRjaCBleGFtIHNlY3Rpb24gY2hhbmdlZFwiKVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zZXJ2ZXJzdGF0dXMuYWxsb3dTZWN0aW9uU3dpdGNoID0gc2VydmVyc3RhdHVzLmFsbG93U2VjdGlvblN3aXRjaFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgc3R1ZGVudCBpcyBpbiBsb2NrZWQgc3RhdGUgaW4gZXhhbSBtb2RlXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnVzZUV4YW1TZWN0aW9ucyl7ICAvLyBleGFtIHNlY3Rpb25zIGFyZSBlbmFibGVkXG4gICAgICAgICAgICAgICAgaWYgKCFzZXJ2ZXJzdGF0dXMuYWxsb3dTZWN0aW9uU3dpdGNoKXsgIC8vIHNlcnZlciBoYW5kbGVzIHNlY3Rpb24gc3dpdGNoXG4gICAgICAgICAgICAgICAgICAgIC8vY2hlY2sgaWYgdGhlIGN1cnJlbnQgYWN0aXZlIHNlY3Rpb24gaXMgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgc2VydmVyc3RhdHVzIC0gaWYgbm90IGNoYW5nZSB0byB0aGUgbmV3IHNlY3Rpb24gYW5kIHNlbmQgdG8gdGVhY2hlclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24gIT09IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbil7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjYWxsIHN3aXRjaEV4YW1TZWN0aW9uIGZ1bmN0aW9uIHRvIHN3aXRjaCB0byB0aGUgbmV3IHNlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaEV4YW1TZWN0aW9uKHRoaXMsIHNlcnZlcnN0YXR1cywgc2VydmVyc3RhdHVzLmxvY2tlZFNlY3Rpb24pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgIFxuICAgICAgXG5cbiAgICAgICAgXG5cbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zbG9ja2VkICYmICF0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2spIHsgIHRoaXMuYWN0aXZhdGVTY3JlZW5sb2NrKCkgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLnNjcmVlbnNsb2NrZWQgKSB7IHRoaXMua2lsbFNjcmVlbmxvY2soKSB9XG5cbiAgICAgICAgLy8gc2NyZWVuc2hvdCBzYWZldHkgKE9DUiBzZWFyY2hlcyBmb3IgbmV4dC1leGFtIHN0cmluZylcbiAgICAgICAgaWYgKHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90b2NyKSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IHRydWUgIH1cbiAgICAgICAgZWxzZSB7IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2NyZWVuc2hvdG9jciA9IGZhbHNlICAgfVxuXG4gICAgICAgIC8vIEdyb3VwcyBoYW5kbGluZzogdXNlIGNsaWVudCdzIHNlY3Rpb24gd2hlbiBhbGxvd1NlY3Rpb25Td2l0Y2gsIGVsc2Ugc2VydmVyJ3M7IGdyb3VwIG1lbWJlcnNoaXAgZnJvbSB0aGF0IHNlY3Rpb24ncyBncm91cEEvZ3JvdXBCLnVzZXJzXG4gICAgICAgIGNvbnN0IHNlY3Rpb25Gb3JTeW5jID0gc2VydmVyc3RhdHVzLmFsbG93U2VjdGlvblN3aXRjaCA/IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA6IHNlcnZlcnN0YXR1cy5sb2NrZWRTZWN0aW9uO1xuICAgICAgICBjb25zdCBzZWN0aW9uID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tzZWN0aW9uRm9yU3luY107XG4gICAgICAgIGlmIChzZWN0aW9uPy5ncm91cHMpIHtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZ3JvdXBzID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudG5hbWUgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWU7XG4gICAgICAgICAgICBjb25zdCBncm91cEEgPSBzZWN0aW9uLmdyb3VwQT8udXNlcnMgPz8gW107XG4gICAgICAgICAgICBjb25zdCBncm91cEIgPSBzZWN0aW9uLmdyb3VwQj8udXNlcnMgPz8gW107XG4gICAgICAgICAgICBjb25zdCBwcmV2R3JvdXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwO1xuICAgICAgICAgICAgaWYgKGdyb3VwQi5pbmNsdWRlcyhjbGllbnRuYW1lKSkgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9ICdiJztcbiAgICAgICAgICAgIGVsc2UgaWYgKGdyb3VwQS5pbmNsdWRlcyhjbGllbnRuYW1lKSkgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9ICdhJztcbiAgICAgICAgICAgIGVsc2UgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cCA9ICdhJztcbiAgICAgICAgICAgIGlmICh0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwICE9PSBwcmV2R3JvdXAgJiYgV2luZG93SGFuZGxlci5leGFtd2luZG93KSB7XG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2dldG1hdGVyaWFscycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5ncm91cHMgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vdXBkYXRlIHNjcmVlbnNob3RpbnRlcnZhbFxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzLnNjcmVlbnNob3RpbnRlcnZhbCB8fCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09PSAwKSB7IC8vMCBpcyB0aGUgc2FtZSBhcyBmYWxzZSBvciB1bmRlZmluZWQgYnV0IHNob3VsZCBiZSB0cmVhdGVkIGFzIG51bWJlclxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgIT09IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMCApIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgcHJvY2Vzc1VwZGF0ZWRTZXJ2ZXJzdGF0dXM6IFNjcmVlbnNob3RJbnRlcnZhbCBjaGFuZ2VkIHRvXCIsIHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMClcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbnNob3RpbnRlcnZhbCA9IHNlcnZlcnN0YXR1cy5zY3JlZW5zaG90aW50ZXJ2YWwqMTAwMFxuICAgICAgICAgICAgICAgICAgaWYgKCBzZXJ2ZXJzdGF0dXMuc2NyZWVuc2hvdGludGVydmFsID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHByb2Nlc3NVcGRhdGVkU2VydmVyc3RhdHVzOiBTY3JlZW5zaG90SW50ZXJ2YWwgZGlzYWJsZWQhXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNsZWFyIG9sZCBpbnRlcnZhbCBhbmQgc3RhcnQgbmV3IGludGVydmFsIGlmIHNldCB0byBzb21ldGhpbmcgYmlnZ2VyIHRoYW4gemVyb1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuc2hvdFNjaGVkdWxlci5zdG9wKClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWwgPiAwKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLmludGVydmFsID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zY3JlZW5zaG90aW50ZXJ2YWxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY3JlZW5zaG90U2NoZWR1bGVyLnN0YXJ0KClcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChzZXJ2ZXJzdGF0dXMuZXhhbW1vZGUgJiYgIXRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIC8vIHJlbW92ZSBsb2Nrc2NyZWVuIGltbWVkaWF0ZWx5IC0gZG9uJ3Qgd2FpdCBmb3Igc2VydmVyIGluZm9cbiAgICAgICAgICAgIHRoaXMuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghc2VydmVyc3RhdHVzLmV4YW1tb2RlICYmIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5raWxsU2NyZWVubG9jaygpIFxuICAgICAgICAgICAgdGhpcy5lbmRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gc2VuZCBiYXNlNjQgcGRmIHRvIHRlYWNoZXJcbiAgICBzZW5kQmFzZTY0UERGdG9UZWFjaGVyKGJhc2U2NHBkZiwgc2VjdGlvbj0xKXtcbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9jb250cm9sL3ByaW50cmVxdWVzdC8ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZX0vJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VufWA7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgICAgICBkb2N1bWVudDogYmFzZTY0cGRmLFxuICAgICAgICAgICAgcHJpbnRyZXF1ZXN0OiBmYWxzZSwgICAgXG4gICAgICAgICAgICBzdWJtaXNzaW9ubnVtYmVyOiB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsXG4gICAgICAgICAgICBsb2NrZWRzZWN0aW9uOiBzZWN0aW9uXG4gICAgICAgIH1cbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4geyByZXR1cm4gcmVzcG9uc2UuanNvbigpOyAgfSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tZXNzYWdlID09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIrKyAgIC8vIHN1Y2Nlc3NmdWwgc3VibWlzc2lvbiAtPiBpbmNyZW1lbnQgbnVtYmVyXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7ICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZWRpdG9yIEAgcHJpbnRiYXNlNjQ6XCIsZXJyb3IubWVzc2FnZSkgICAgXG4gICAgICAgIH0pOyBcbiAgICB9XG4gICAgXG5cblxuXG4gICAgLy9nZXQgYmFzZTY0IHBkZiBmcm9tIGVkaXRvclxuICAgIC8vIEFUVEVOVElPTjogdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBpcGNoYW5kbGVyLmpzIHRoYXQgYWxzbyBnZW5lcmF0ZXMgYSBwZGYgYnV0IHN0b3JlcyBpdCBhcyBmaWxlIGluIHRoZSBleGFtIGRpcmVjdG9yeVxuICAgIGFzeW5jIGdldEJhc2U2NFBERihzdWJtaXNzaW9ubnVtYmVyLCBzZWN0aW9ubmFtZSwgcHJpbnRCYWNrZ3JvdW5kPWZhbHNlKXtcbiAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogZ2V0dGluZyBiYXNlNjQgZW5jb2RlZCBwZGZcIilcbiAgICAgICAgXG4gICAgICAgIC8vIFdhaXQgZm9yIGFueSBvbmdvaW5nIHByaW50IG9wZXJhdGlvbiB0byBmaW5pc2ggKG1heCAzMCBzZWNvbmRzKVxuICAgICAgICBsZXQgd2FpdENvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbWF4V2FpdCA9IDMwMDsgLy8gMzAgc2Vjb25kcyB3aXRoIDEwMG1zIGludGVydmFsc1xuICAgICAgICB3aGlsZSAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmICYmIHdhaXRDb3VudCA8IG1heFdhaXQpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xlZXAoMTAwKTtcbiAgICAgICAgICAgIHdhaXRDb3VudCsrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGdldEJhc2U2NFBERjogcHJpbnRUb1BERiBsb2NrIHRpbWVvdXQgLSBhbm90aGVyIHByaW50IG9wZXJhdGlvbiBpcyBzdGlsbCBydW5uaW5nXCIpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIlBERiBnZW5lcmF0aW9uIHRpbWVvdXQgLSBhbm90aGVyIHByaW50IG9wZXJhdGlvbiBpcyBpbiBwcm9ncmVzc1wiLCBzdGF0dXM6IFwiZXJyb3JcIiB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIG1hcmdpbnM6IHt0b3A6MC41LCByaWdodDowLCBib3R0b206MC41LCBsZWZ0OjAgfSxcbiAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgcHJpbnRCYWNrZ3JvdW5kOiBwcmludEJhY2tncm91bmQsXG4gICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgbGFuZHNjYXBlOiBmYWxzZSxcbiAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJGb290ZXI6dHJ1ZSxcblxuICBcbiAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICBoZWFkZXJUZW1wbGF0ZTogYDxkaXYgc3R5bGU9J2Rpc3BsYXk6IGlubGluZS1ibG9jazsgaGVpZ2h0OjEycHg7IGZvbnQtc2l6ZToxMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgd2lkdGg6MTAwJTsgbWFyZ2luLXJpZ2h0OiAzMHB4O21hcmdpbi1sZWZ0OiAzMHB4OyBtYXJnaW4tdG9wOjEwcHg7Jz48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWV9PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4mbmJzcDt8Jm5ic3A7IDwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JHtzZWN0aW9ubmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+Jm5ic3A7fCZuYnNwO0FiZ2FiZTogJHtzdWJtaXNzaW9ubnVtYmVyfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgcHJlZmVyQ1NTUGFnZVNpemU6IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIHNldCB0aGUgdGl0bGUgb2YgdGhlIGV4YW0gd2luZG93IGFuZCB0aGVyZWZvcmUgdGhlIGRvY3VtZW50IHRpdGxlXG4gICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfSAtICR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lfSAtIFZlcnNpb24gJHtzdWJtaXNzaW9ubnVtYmVyfVwiYCk7XG4gICAgICAgIFxuICAgICAgICAvLyBTZXQgbG9jayBiZWZvcmUgc3RhcnRpbmcgUERGIGdlbmVyYXRpb25cbiAgICAgICAgSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBiYXNlNjRwZGYgPSBkYXRhLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFVcmwgPSBgZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LCR7YmFzZTY0cGRmfWA7XG4gICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6XCJQREYgZ2VuZXJhdGVkXCIsIGRhdGFVcmw6ZGF0YVVybCwgYmFzZTY0cGRmOiBiYXNlNjRwZGYsIHN0YXR1czogXCJzdWNjZXNzXCIgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZ2V0QmFzZTY0UERGOiBFcnJvciBnZW5lcmF0aW5nIFBERjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOiBcIkVycm9yIGdlbmVyYXRpbmcgUERGXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAvLyBBbHdheXMgcmVsZWFzZSB0aGUgbG9jaywgZXZlbiBpZiBhbiBlcnJvciBvY2N1cnJlZFxuICAgICAgICAgICAgSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzaG93IHRlbXBvcmFyeSBzY3JlZW5sb2NrIHdpbmRvd1xuICAgIGFjdGl2YXRlU2NyZWVubG9jaygpe1xuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG4gICAgICAgXG4gICAgICAgIGlmIChXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzLmxlbmd0aCA9PSAwKXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSB0cnVlXG4gICAgICAgICAgICBmb3IgKGxldCBkaXNwbGF5IG9mIGRpc3BsYXlzKXtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmNyZWF0ZVNjcmVlbmxvY2tXaW5kb3coZGlzcGxheSkgIC8vIGFkZCBzY3JlZW5sb2NrIHdpbmRvd3MgZm9yIGFkZGl0aW9uYWwgZGlzcGxheXNcbiAgICAgICAgICAgIH0gXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgdGVtcG9yYXJ5IHNjcmVlbmxvY2t3aW5kb3dcbiAgICBraWxsU2NyZWVubG9jaygpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChsZXQgc2NyZWVubG9ja3dpbmRvdyBvZiBXaW5kb3dIYW5kbGVyLnNjcmVlbmxvY2t3aW5kb3dzKXtcbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVubG9ja3dpbmRvdyAmJiAhc2NyZWVubG9ja3dpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuY2xvc2UoKTsgXG4gICAgICAgICAgICAgICAgICAgIHNjcmVlbmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGtpbGxTY3JlZW5sb2NrOiBubyBmdW5jdGlvbmFsIHNjcmVlbmxvY2t3aW5kb3cgdG8gaGFuZGxlXCIpXG4gICAgICAgIH0gXG4gICAgICAgIC8vIENsZWFyIGFycmF5IGNvbXBsZXRlbHkgYWZ0ZXIgYXR0ZW1wdGluZyB0byBkZXN0cm95IGFsbCB3aW5kb3dzXG4gICAgICAgIC8vIFRoZSBjbG9zZWQgZXZlbnQgaGFuZGxlciB3aWxsIGFsc28gY2xlYW4gdXAsIGJ1dCB0aGlzIGVuc3VyZXMgdGhlIGFycmF5IGlzIGVtcHR5XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuc2NyZWVubG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNjcmVlbmxvY2sgPSBmYWxzZVxuICAgIH1cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIGV4YW0gbW9kZSBmb3Igc3R1ZGVudFxuICAgICAqIGRlbGV0ZXMgd29ya2ZvbGRlciBjb250ZW50cyAoaWYgc2V0KVxuICAgICAqIG9wZW5zIGEgbmV3IHdpbmRvdyBpbiBraW9zayBtb2RlIHdpdGggdGhlIGdpdmVuIGV4YW10eXBlXG4gICAgICogZW5hYmxlcyB0aGUgYmx1ciBsaXN0ZW5lciBhbmQgYWN0aXZhdGVzIHJlc3RyaWN0aW9ucyAoZGlzYWJsZSBrZXlib2Fyc2hvcnRjdXRzIGV0Yy4pXG4gICAgICogQHBhcmFtIHNlcnZlcnN0YXR1cyBjb250YWlucyBpbmZvcm1hdGlvbiBhYm91dCBleGFtbW9kZSwgZXhhbXR5cGUsIGFuZCBvdGhlciBzZXR0aW5ncyBmcm9tIHRoZSB0ZWFjaGVyIGluc3RhbmNlXG4gICAgICovXG4gICAgYXN5bmMgc3RhcnRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBkaWFsb2cgaXMgb3BlbiBhbmQgbG9nIHdhcm5pbmdcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhpdFdhcm5pbmdPcGVuIHx8IFdpbmRvd0hhbmRsZXIuZXhpdFF1ZXN0aW9uT3BlbiB8fCBXaW5kb3dIYW5kbGVyLm1pbmltaXplV2FybmluZ09wZW4pIHtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBzdGFydEV4YW06IERpYWxvZyBpcyBzdGlsbCBvcGVuIC0gZXhhbSB3aWxsIHN0YXJ0IGFueXdheVwiKVxuICAgICAgICB9XG4gIFxuICAgICAgICBsZXQgZGlzcGxheXMgPSBzY3JlZW4uZ2V0QWxsRGlzcGxheXMoKVxuICAgICAgICBsZXQgcHJpbWFyeSA9IHNjcmVlbi5nZXRQcmltYXJ5RGlzcGxheSgpXG4gICAgICAgXG4gICAgICAgIGlmICghcHJpbWFyeSB8fCBwcmltYXJ5ID09PSBcIlwiIHx8ICFwcmltYXJ5LmlkKXsgcHJpbWFyeSA9IGRpc3BsYXlzWzBdIH0gICAgICAgXG5cbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IHRydWVcbiAgICAgICAgLy8gd2hlbiBhbGxvd1NlY3Rpb25Td2l0Y2g6IGNsaWVudCBjaG9vc2VzIHNlY3Rpb24sIGNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiBpcyBhdXRob3JpdGF0aXZlOyBkbyBub3Qgb3ZlcndyaXRlIHdpdGggc2VydmVyXG4gICAgICAgIGlmICghc2VydmVyc3RhdHVzLmFsbG93U2VjdGlvblN3aXRjaCB8fCAhdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2tlZFNlY3Rpb24gPSBzZXJ2ZXJzdGF0dXMubG9ja2VkU2VjdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlZmZlY3RpdmVTZWN0aW9uID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uO1xuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmNtYXJnaW4gPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2VmZmVjdGl2ZVNlY3Rpb25dLmNtYXJnaW4gIC8vIHRoaXMgaXMgdXNlZCB0byBjb25maWd1cmUgbWFyZ2luIHNldHRpbmdzIGZvciB0aGUgZWRpdG9yXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubGluZXNwYWNpbmcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2VmZmVjdGl2ZVNlY3Rpb25dLmxpbmVzcGFjaW5nIC8vIHdlIHRyeSB0byBkb3VibGUgbGluZXNwYWNpbmcgb24gZGVtYW5kIGluIHBkZiBjcmVhdGlvblxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmF1ZGlvUmVwZWF0ID0gc2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tlZmZlY3RpdmVTZWN0aW9uXS5hdWRpb1JlcGVhdCAvLyByZXN0cmljdCByZXBldGl0aW9uIG9mIGF1ZGlvIGZpbGVzIChmb3IgbGlzdGVuaW5nIGNvbXByZWhlbnNpb24pXG5cbiAgICAgICAgY29uc3QgZXhhbXR5cGUgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2VmZmVjdGl2ZVNlY3Rpb25dLmV4YW10eXBlO1xuXG4gICAgICAgIGlmICghV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgIC8vIHdoeSBkbyB3ZSBjaGVjaz8gYmVjYXVzZSBleGFtbW9kZSBpcyBsZWZ0IGlmIHRoZSBzZXJ2ZXIgY29ubmVjdGlvbiBnZXRzIGxvc3QgYnV0IHN0dWRlbnRzIGNvdWxkIHJlY29ubmVjdCB3aGlsZSB0aGUgZXhhbSB3aW5kb3cgaXMgc3RpbGwgb3BlbiBhbmQgd2UgZG9uJ3Qgd2FudCB0byBjcmVhdGUgYSBzZWNvbmQgb25lXG4gICAgICAgICAgICBsb2cuaW5mbyhcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBjcmVhdGluZyBleGFtIHdpbmRvd1wiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IGV4YW10eXBlXG5cbiAgICAgICAgICAgIGlmIChleGFtdHlwZSA9PT0gJ2xvY2Fsdm0nKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdm1Db25maWcgPSBzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW2VmZmVjdGl2ZVNlY3Rpb25dLmxvY2FsVk1Db25maWcgfHwge307XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZtTmFtZSA9IHZtQ29uZmlnLnZtTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF2bU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBubyB2bU5hbWUgY29uZmlndXJlZCBmb3IgbG9jYWx2bSBleGFtdHlwZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnN0YXJ0TG9jYWxWTUFuZFJlc29sdmVIb3N0KHZtTmFtZSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgc3RhcnRFeGFtOiBMb2NhbFZNIHN0YXJ0IGZhaWxlZFwiLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmV4YW1tb2RlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuY3JlYXRlRXhhbVdpbmRvdyhleGFtdHlwZSwgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiwgc2VydmVyc3RhdHVzLCBwcmltYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpeyAgLy9yZWNvbm5lY3QgaW50byBhY3RpdmUgZXhhbSBzZXNzaW9uIHdpdGggZXhhbSB3aW5kb3cgYWxyZWFkeSBvcGVuXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogZm91bmQgZXhpc3RpbmcgRXhhbXdpbmRvdy4uXCIpXG4gICAgICAgICAgICB0cnkgeyAgLy8gc3dpdGNoIGV4aXN0aW5nIHdpbmRvdyBiYWNrIHRvIGV4YW0gbW9kZVxuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5zaG93KCkgXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5kZXZlbG9wbWVudCkgeyBcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LnNldEZ1bGxTY3JlZW4odHJ1ZSkgIC8vZ28gZnVsbHNjcmVlbiBhZ2FpblxuICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0QWx3YXlzT25Ub3AodHJ1ZSwgXCJzY3JlZW4tc2F2ZXJcIiwgMSkgIC8vbWFrZSBzdXJlIHRoZSB3aW5kb3cgaXMgMSBsZXZlbCBhYm92ZSBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVuYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDIwMDApIC8vIHdhaXQgYW4gYWRkaXRpb25hbCAyIHNlYyBmb3Igd2luZG93cyByZXN0cmljdGlvbnMgdG8ga2ljayBpbiAodGhleSBzdGVhbCBmb2N1cylcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5hZGRCbHVyTGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHJlY29ubmVjdDogaW5pdGlhbGl6ZSBibG9jayB3aW5kb3dzIGFmdGVyIHdpbmRvdyBpcyByZXBvc2l0aW9uZWRcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MDApXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFdpbmRvd0hhbmRsZXIuaW5pdEJsb2NrV2luZG93cygpXG4gICAgICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKClcbiAgICAgICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93LmZvY3VzKClcbiAgICAgICAgICAgICAgICB9ICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyAvL2V4YW13aW5kb3cgdmFyaWFibGUgaXMgc3RpbGwgc2V0IGJ1dCB0aGUgd2luZG93IGlzIG5vdCBtYW5hZ2FibGUgYW55bW9yZSAobWFudWFsbHkgY2xvc2VkIGluIGRldiBtb2RlPylcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIHN0YXJ0RXhhbTogbm8gZnVuY3Rpb25hbCBleGFtd2luZG93IGZvdW5kLi4gcmVzZXR0aW5nXCIpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGlzYWJsZVJlc3RyaWN0aW9ucyhXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpICAvL2V4YW13aW5kb3cgaXMgZ2l2ZW4gYnV0IG5vdCB1c2VkIGluIGRpc2FibGVSZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuICAvLyBpbiB0aGF0IGNhc2UuLiB3ZSBhcmUgZmluaXNoZWQgaGVyZSAhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90ZTogRm9yIG5ldyBleGFtIHdpbmRvd3MsIGluaXRCbG9ja1dpbmRvd3MoKSBpcyBjYWxsZWQgaW4gZGlkLWZpbmlzaC1sb2FkIGhhbmRsZXJcbiAgICAgICAgLy8gdG8gZW5zdXJlIHdpbmRvdyBpcyBmdWxseSBwb3NpdGlvbmVkIChpbXBvcnRhbnQgZm9yIFdheWxhbmQvS1dpbilcbiAgICB9XG5cblxuXG5cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIEV4YW0gbW9kZVxuICAgICAqIGNsb3NlcyBleGFtIHdpbmRvd1xuICAgICAqIGRpc2FibGVzIHJlc3RyaWN0aW9ucyBhbmQgYmx1ciBcbiAgICAgKi9cbiAgICBhc3luYyBlbmRFeGFtKHNlcnZlcnN0YXR1cyl7XG4gICAgICAgIFxuICAgICAgICBXaW5kb3dIYW5kbGVyLnJlbW92ZUJsdXJMaXN0ZW5lcigpO1xuICAgICAgXG4gICAgICAgIC8vb25seSBkaXNhYmxlIHJlc3RyaWN0aW9ucyBpZiBub3QgaW4gZXhhbSBtb2RlICggc2VyaW9zdWx5Li4gaG93IGNvdWxkIHRoaXMgZXZlciBoYXBwZW4/IClcbiAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSA9IGZhbHNlXG4gICAgICAgICAgICBkaXNhYmxlUmVzdHJpY3Rpb25zKClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBzdHVkZW50cyB3b3JrIG9uIHN0dWRlbnRzIHBjIChtYWtlcyBzZW5zZSBpZiBleGFtIGlzIHdyaXR0ZW4gb24gc2Nob29sIHByb3BlcnR5KVxuICAgICAgICBpZiAoc2VydmVyc3RhdHVzICYmIHNlcnZlcnN0YXR1cy5kZWxmb2xkZXJvbmV4aXQgPT09IHRydWUpe1xuICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGNsZWFuaW5nIGV4YW0gd29ya2ZvbGRlciBvbiBleGl0XCIpXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgICAvLyBzZXQgYnkgc2VydmVyLmpzIChkZXNrdG9wIHBhdGggKyBleGFtZGlyKVxuICAgICAgICAgICAgICAgICAgICBmcy5ybVN5bmModGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyBsb2cuZXJyb3IoXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IFwiLGVycm9yKTsgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93KXsgLy8gaW4gc29tZSBlZGdlIGNhc2VzIGluIGRldmVsb3BtZW50IHRoaXMgaXMgc2V0IGJ1dCBzdGlsbCB1bnVzYWJsZSAtIHVzZSB0cnkvY2F0Y2ggICBcbiAgICAgICAgICAgIHRyeSB7IFxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgZGV2dG9vbHMgd2luZG93XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmRldmVsb3BtZW50IHx8IHRoaXMuY29uZmlnLnNob3dkZXZ0b29scyl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFdlYkNvbnRlbnRzID0gd2ViQ29udGVudHMuZ2V0QWxsV2ViQ29udGVudHMoKSAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHdjIG9mIGFsbFdlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoV2luZG93SGFuZGxlci5leGFtd2luZG93ICYmIHdjLmhvc3RXZWJDb250ZW50cz8uaWQgPT09IFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5pZCAmJiB3Yy5pc0RldlRvb2xzT3BlbmVkPy4oKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJjb21tdW5pY2F0aW9uaGFuZGxlciBAIGVuZEV4YW06IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2MuY2xvc2VEZXZUb29scygpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERUIGRlcyBXZWJWaWV3cyBzY2hsaWVcdTAwREZlbiAoYXVjaCBkZXRhY2hlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGZvciBhbGwgRGV2VG9vbHMgdG8gYmUgY2xvc2VkIGJlZm9yZSBjbG9zaW5nIHRoZSBleGFtIHdpbmRvd1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBhbGwgY2xvc2VEZXZUb29scygpIGNhbGxzIGFyZSBjb21wbGV0ZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBjbG9zZSB0aGUgZXhhbSB3aW5kb3cgc2FmZWx5IGFmdGVyIGRldnRvb2xzIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZUV4YW1XaW5kb3dTYWZlbHkoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZSl7IGxvZy5lcnJvcignY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBlbmRFeGFtOiAnLGUpfVxuICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYmxvY2t3aW5kb3cgb2YgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3Mpe1xuICAgICAgICAgICAgICAgICAgICBibG9ja3dpbmRvdy5jbG9zZSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cuZGVzdHJveSgpOyBcbiAgICAgICAgICAgICAgICAgICAgYmxvY2t3aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgXG4gICAgICAgICAgICAgICAgV2luZG93SGFuZGxlci5ibG9ja3dpbmRvd3MgPSBbXVxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgZW5kRXhhbTogbm8gZnVuY3Rpb25hbCBibG9ja3dpbmRvdyB0byBoYW5kbGVcIilcbiAgICAgICAgICAgIH0gIFxuICAgICAgICB9XG4gICAgICAgIFdpbmRvd0hhbmRsZXIuYmxvY2t3aW5kb3dzID0gW11cbiAgICAgICAgXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubXNvZmZpY2VzaGFyZSA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZm9jdXMgPSB0cnVlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93biA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsYW5ndWFnZVRvb2xTZXJ2ZXIubGFuZ3VhZ2VUb29sUHJvY2Vzcyl7XG4gICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RvcFNlcnZlcigpOyAvLyBLaWxsIExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2hlbiBleGFtIHdpbmRvdyBpcyBjbG9zZWRcbiAgICAgICAgfVxuICAgICAgICAvLyBhc2sgc3R1ZGVudCB0byBxdWl0IGFwcCBhZnRlciBmaW5pc2hpbmcgZXhhbVxuICAgICAgICBhd2FpdCBXaW5kb3dIYW5kbGVyLnNob3dFeGl0UXVlc3Rpb24oKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyBleGFtd2luZG93IG9ubHkgd2hlbiBubyBwcmludFRvUERGIG9wZXJhdGlvbiBpcyBydW5uaW5nXG4gICAgICovXG4gICAgY2xvc2VFeGFtV2luZG93U2FmZWx5KCl7XG4gICAgICAgIGNvbnN0IGV4YW1XaW4gPSBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgaWYgKCFleGFtV2luKXsgcmV0dXJuIH1cblxuICAgICAgICBpZiAoSXBjSGFuZGxlci5pc1ByaW50aW5nUGRmKXtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiY29tbXVuaWNhdGlvbmhhbmRsZXIgQCBjbG9zZUV4YW1XaW5kb3dTYWZlbHk6IHByaW50VG9QREYgaW4gcHJvZ3Jlc3MgLSByZXRyeSBpbiAxc1wiKVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMuY2xvc2VFeGFtV2luZG93U2FmZWx5KCkgfSwgMTAwMCkgLy8gcmV0cnkgdW50aWwgcHJpbnRpbmcgaXMgZmluaXNoZWRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZXhhbVdpbi5pc0Rlc3Ryb3llZD8uKCkpe1xuICAgICAgICAgICAgICAgIGV4YW1XaW4uY2xvc2UoKSAvLyBub3JtYWwgY2xvc2UsIG9uKCdjbG9zZScpIGhhbmRsZXIgZG9lcyB0aGUgcmVzdFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcImNvbW11bmljYXRpb25oYW5kbGVyIEAgY2xvc2VFeGFtV2luZG93U2FmZWx5OiBlcnJvciB3aGlsZSBjbG9zaW5nIGV4YW13aW5kb3dcIiwgZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyA9IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gdGhpcyBpcyBtYW51YWxseSB0cmlnZ2VyZWQgaWYgY29ubmVjdGlvbiBpcyBsb3N0IGR1cmluZyBleGFtIC0gd2UgYWxsb3cgdGhlIHN0dWRlbnQgdG8gZ2V0IG91dCBvZiB0aGUga2lvc2sgbW9kZSBcbiAgICAvLyBJTkZPOiB0aGlzIGlzIGJhc2ljYWxseSByZWR1bmRhbnQgXG4gICAgYXN5bmMgZ3JhY2VmdWxseUVuZEV4YW0oKXtcbiAgICAgICAgdGhpcy5lbmRFeGFtKClcbiAgICB9XG5cbiAgICAvLyByZXNldCBhbGwgdmFyaWFibGVzIHRoYXQgc2lnbmFsIG9yIG5lZWQgYSB2YWxpZCB0ZWFjaGVyIGNvbm5lY3Rpb25cbiAgICByZXNldENvbm5lY3Rpb24oKXtcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGZhbHNlXG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gZmFsc2VcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5mb2N1cyA9IHRydWUgIC8vIHdlIGFyZSBmb2N1c2VkIFxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uZXhhbW1vZGUgPSBmYWxzZSAgIC8vIGRvIG5vdCBzZXQgdG8gZmFsc2UgdW50aWwgZXhhbSB3aW5kb3cgaXMgYWN0dWFsbHkgY2xvc2VkICAodGhpcyBpcyBkb25lIGluIGVuZEV4YW0oKSlcbiAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50aW1lc3RhbXAgPSBmYWxzZVxuICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSBmYWxzZVxuICAgICAgICAvL3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udmlydHVhbGl6ZWQgPSBmYWxzZSAgLy8gdGhpcyBjaGVjayBoYXBwZW5zIG9ubHkgYXQgdGhlIGFwcGxpY2F0aW9uIHN0YXJ0Li4gZG8gbm90IHJlc2V0IG9uY2Ugc2V0XG4gICAgfVxuIFxuXG5cblxuICAgIC8qKlxuICAgICAqIGRpZXNlIG1ldGhvZGUgaG9sdCBzaWNoLCBkaWUgdm9tIHRlYWNoZXIgenVtIGRvd25sb2FkIGJlcmVpdGdlbGVndGVuIGRhdGVpZW5cbiAgICAgKiBcdTAwRkNiZXIgZGFzIHVwZGF0ZSBpbnRlcnZhbCB3aXJkIGRlciB0cmlnZ2VyIHp1bSBkb3dubG9hZCB1bmQgZGllIGZpbGVsaXN0IGVyaGFsdGVuXG4gICAgICogQHBhcmFtIHsqfSBmaWxlcyBcbiAgICAgKi9cbiAgICByZXF1ZXN0RmlsZUZyb21TZXJ2ZXIoZmlsZXMpe1xuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IGJhY2t1cGZpbGUgPSBmYWxzZVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChmaWxlLm5hbWUgJiYgZmlsZS5uYW1lLmluY2x1ZGVzKCdiYWsnKSl7ICAgLy8gdGhpcyB3aWxsIGFsd2F5cyBzZXQgdGhlIGxhc3QgYmFrIGZpbGUgYXMgYmFja3VwIGZpbGUgaWYgdGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBiYWsgZmlsZVxuICAgICAgICAgICAgICAgIGJhY2t1cGZpbGUgPSBmaWxlLm5hbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcblxuICAgICAgICAvLyBEYXRlbiBmXHUwMEZDciBkZW4gUE9TVC1SZXF1ZXN0IHZvcmJlcmVpdGVuXG4gICAgICAgIGxldCBkYXRhID0gSlNPTi5zdHJpbmdpZnkoeyAnZmlsZXMnOiBmaWxlcywgJ3R5cGUnOiAnc3R1ZGVudGZpbGVyZXF1ZXN0JyB9KTtcblxuICAgICAgICAvLyBGZXRjaC1SZXF1ZXN0IG1pdCBkZW4gZW50c3ByZWNoZW5kZW4gT3B0aW9uZW5cbiAgICAgICAgZmV0Y2goYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvZGF0YS9kb3dubG9hZC8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgLy8gQW50d29ydCBhbHMgQXJyYXlCdWZmZXIgZXJoYWx0ZW5cbiAgICAgICAgLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGxldCBhYnNvbHV0ZUZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB0b2tlbi5jb25jYXQoJy56aXAnKSk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGUoYWJzb2x1dGVGaWxlcGF0aCwgQnVmZmVyLmZyb20oYnVmZmVyKSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHsgbG9nLmVycm9yKGVycik7ICB9IFxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHRyYWN0KGFic29sdXRlRmlsZXBhdGgsIHsgZGlyOiB0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5IH0pIFxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcIkNvbW11bmljYXRpb25IYW5kbGVyIEAgcmVxdWVzdEZpbGVGcm9tU2VydmVyOiBmaWxlcyByZWNlaXZlZCBhbmQgZXh0cmFjdGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZzLnByb21pc2VzLnVubGluayhhYnNvbHV0ZUZpbGVwYXRoKTsgLy8gVmVyd2VuZHVuZyBkZXIgUHJvbWlzZS1iYXNpZXJ0ZW4gQVBJIHZvbiBmc1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmFja3VwZmlsZSAmJiBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnYmFja3VwJywgYmFja3VwZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oXCJDb21tdW5pY2F0aW9uSGFuZGxlciBAIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogVHJpZ2dlciBSZXBsYWNlIEV2ZW50XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdykgeyAgV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xvYWRmaWxlbGlzdCcpOyAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnIgPT4gbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uSGFuZGxlciAtIHJlcXVlc3RGaWxlRnJvbVNlcnZlcjogJHtlcnJ9YCkpO1xuICAgIH1cblxuXG5cblxuICAgIGFzeW5jIHNlbmRFeGFtVG9UZWFjaGVyKCl7XG4gICAgICAgIC8vc2VuZCBzYXZlIHRyaWdnZXIgdG8gZXhhbSB3aW5kb3dcbiAgICAgICAgaWYgKFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdyl7ICAvL3RoZXJlIGlzIGEgcnVubmluZyBleGFtIC0gc2F2ZSBjdXJyZW50IHdvcmsgZmlyc3QhXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdzYXZlJywndGVhY2hlcnJlcXVlc3QnKSAgIC8vdHJpZ2dlciwgd2h5ICAodGVhY2hlcnJlcXVlc3Qgd2lsbCBhbHNvIHRyaWdnZXIgc2VuZFRvVGVhY2hlcigpIGJ1dCBvbmx5IGFmdGVyIHNhdmluZyB0aGUgcGRmIGlzIGNvbXBsZXRlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2goZXJyKXsgXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKGBDb21tdW5pY2F0aW9uIGhhbmRsZXIgQCBzZW5kRXhhbVRvVGVhY2hlcjogQ291bGQgbm90IHNhdmUgc3R1ZGVudHMgd29yay4gSXMgZXhhbW1vZGUgYWN0aXZlP2ApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7ICAvLyBub3QgcnVubmluZyBleGFtIChwcm9iYWJseSB1c2luZyBuZXh0LWV4YW0gYXMgY2xhc3Nyb29tbWFuYWdtZW50IHRvb2wpXG4gICAgICAgICAgICB0aGlzLnNlbmRUb1RlYWNoZXIoKSAgIC8vemlwIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyIGFwaVxuICAgICAgICB9XG5cbiAgICAgfVxuXG5cbiAgICAgIC8vemlwIGNvbmZpZy53b3JrIGRpcmVjdG9yeSBhbmQgc2VuZCB0byB0ZWFjaGVyXG4gICAgIGFzeW5jIHNlbmRUb1RlYWNoZXIoKXtcbiAgICAgICAgdHJ5IHsgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKHRoaXMuY29uZmlnLnRlbXBkaXJlY3RvcnkpOyB9XG4gICAgICAgIH1jYXRjaCAoZSl7IGxvZy5lcnJvcihlKX1cblxuICAgICAgICAvLyAgdGhpcyBpcyB0aGUgbG9nZmlsZSBwYXRoIHRyeSB0byBjb3B5IHRoZSBsb2dmaWxlIHRvIHRoZSBleGFtZGlyZWN0b3J5IGJlZm9yZSBtYWtpbmcgdGhlIHppcCBmaWxlXG4gICAgICAgIGxldCBsb2dmaWxlcGF0aCA9IHBsYXRmb3JtRGlzcGF0Y2hlci5sb2dmaWxlO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2dmaWxlcGF0aCkpe1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmcy5jb3B5RmlsZVN5bmMobG9nZmlsZXBhdGgsIGpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgJ25leHQtZXhhbS1zdHVkZW50LmxvZycpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpeyBsb2cuZXJyb3IoJ2NvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZFRvVGVhY2hlcjogY291bGQgbm90IGNvcHkgbG9nZmlsZSB0byBleGFtZGlyZWN0b3J5Jyk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB6aXBmaWxlbmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZS5jb25jYXQoJy56aXAnKVxuICAgICAgICBsZXQgc2VydmVybmFtZSA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICBsZXQgc2VydmVyaXAgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcmlwXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW5cbiAgICAgICAgbGV0IHppcGZpbGVwYXRoID0gam9pbih0aGlzLmNvbmZpZy50ZW1wZGlyZWN0b3J5LCB6aXBmaWxlbmFtZSk7XG4gICAgIFxuXG4gICAgICAgIGxldCBiYXNlNjRGaWxlID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy56aXBEaXJlY3RvcnkodGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgemlwZmlsZXBhdGgpXG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh6aXBmaWxlcGF0aCk7XG4gICAgICAgICAgICBiYXNlNjRGaWxlID0gZmlsZUNvbnRlbnQudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICB9Y2F0Y2ggKGUpeyAgbG9nLmVycm9yKGUpICB9XG5cbiAgICAgICAgLy8gc2VuZGluZyB0aGUgd2hvbGUgZGlyZWN0b3J5IGFzIHppcCBmaWxlIGJhc2U2NGVuY29kZWQgdmlhIEpTT04gaXNuJ3QgcHJvYmFibHkgdGhlIGJlc3QgbWV0aG9kIGJ1dCBpdCB3b3JrcyB3aGlsZSBhbGwgZm9ybURhdGEgYXBwcm9hY2hlcyBmYWlsZWQgd2l0aFxuICAgICAgICAvLyBmZXRjaCgpIHdoaWxlIHRoZXkgd29ya2VkIHdpdGggYXggaW9zKCkgLSBub3QgZXZlbiBjaGF0Z3B0IG9yIHN0YWNrb3ZlcmZsb3cgY291bGQgaGVscCBeXiBpIHRoaW5rIGl0IGlzIHJlbGF0ZWQgdG8gdGhlIHNwZWNpZmljIGZvcm1EYXRhIG1vZHVsZSB0aGF0IGNhbnQgYmUgaW1wb3J0ZWQgd2l0aG91dCBcIndpbmRvdyBlcnJvclwiXG4gICAgICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7c2VydmVyaXB9OiR7dGhpcy5jb25maWcuc2VydmVyQXBpUG9ydH0vc2VydmVyL2RhdGEvcmVjZWl2ZS8ke3NlcnZlcm5hbWV9LyR7dG9rZW59YDtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWxlOiBiYXNlNjRGaWxlLCBmaWxlbmFtZTogemlwZmlsZW5hbWUgfSksXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7IGxvZy5pbmZvKGBjb21tdW5pY2F0aW9uaGFuZGxlciBAIHNlbmRFeGFtVG9UZWFjaGVyOiB0ZWFjaGVyIHJlc3BvbnNlOiAke2RhdGEubWVzc2FnZX1gKTsgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtsb2cuZXJyb3IoYGNvbW11bmljYXRpb25oYW5kbGVyIEAgc2VuZEV4YW1Ub1RlYWNoZXI6ICR7ZXJyb3J9YCk7IH0pO1xuICAgICB9XG5cblxuXG5cblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHNvdXJjZURpcjogL3NvbWUvZm9sZGVyL3RvL2NvbXByZXNzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG91dFBhdGg6IC9wYXRoL3RvL2NyZWF0ZWQuemlwXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgemlwRGlyZWN0b3J5KHNvdXJjZURpciwgb3V0UGF0aCkge1xuICAgICAgICBjb25zdCBhcmNoaXZlID0gYXJjaGl2ZXIoJ3ppcCcsIHsgemxpYjogeyBsZXZlbDogOSB9fSk7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKG91dFBhdGgpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBhcmNoaXZlXG4gICAgICAgICAgICAuZGlyZWN0b3J5KHNvdXJjZURpciwgZmFsc2UpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxuICAgICAgICAgICAgLnBpcGUoc3RyZWFtKVxuICAgICAgICA7XG4gICAgICAgIHN0cmVhbS5vbignY2xvc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICBhcmNoaXZlLmZpbmFsaXplKCk7XG4gICAgICAgIH0pLmNhdGNoKCBlcnJvciA9PiB7IGxvZy5lcnJvcihlcnJvcil9KTtcbiAgICB9XG5cblxuXG5cblxuXG4gICAgLy8gdGltZW91dCBcbiAgICBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgXG4gfVxuIFxuIGV4cG9ydCBkZWZhdWx0IG5ldyBDb21tSGFuZGxlcigpXG4gXG4iLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IGlwIGZyb20gJ2lwJ1xuaW1wb3J0IG5ldCBmcm9tICduZXQnXG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJ1xuY29uc3Qge3R9ID0gaTE4bi5nbG9iYWxcbmltcG9ydHtpcGNNYWluLCBjbGlwYm9hcmQsYXBwLCB3ZWJDb250ZW50c30gZnJvbSAnZWxlY3Ryb24nXG5pbXBvcnQgeyBnYXRld2F5NHN5bmMgfSBmcm9tICdkZWZhdWx0LWdhdGV3YXknO1xuaW1wb3J0IG9zIGZyb20gJ29zJ1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHtkaXNhYmxlUmVzdHJpY3Rpb25zfSBmcm9tICcuL3BsYXRmb3JtcmVzdHJpY3Rpb25zLmpzJztcbmltcG9ydCAqIGFzIHdlYkZpbHRlciBmcm9tICcuL3dlYkZpbHRlci5qcyc7XG5pbXBvcnQgbWFtbW90aCBmcm9tICdtYW1tb3RoJztcblxuaW1wb3J0IGxhbmd1YWdlVG9vbFNlcnZlciBmcm9tICcuL2x0LXNlcnZlcic7XG5pbXBvcnQgcGxhdGZvcm1EaXNwYXRjaGVyIGZyb20gJy4vcGxhdGZvcm1EaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IHVwZGF0ZVN5c3RlbVRyYXkgfSBmcm9tICcuL3RyYXltZW51LmpzJztcbmltcG9ydCB7IGVuc3VyZU5ldHdvcmtPclJlc2V0IH0gZnJvbSAnLi90ZXN0cGVybWlzc2lvbnNNYWMuanMnO1xuaW1wb3J0IHsgZ2V0V2xhbkluZm8gfSBmcm9tICcuL2dldHdsYW5pbmZvLmpzJztcbmltcG9ydCB7IHN3aXRjaEV4YW1TZWN0aW9uIH0gZnJvbSAnLi9zd2l0Y2hFeGFtU2VjdGlvbi5qcyc7XG5pbXBvcnQgeyBzdGFydFByb3h5LCBzdG9wUHJveHkgfSBmcm9tICcuL3ZuY3Byb3h5LmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxuY29uc3QgY2hlY2tQb3J0T3BlbiA9IChwb3J0LCBob3N0ID0gJzEyNy4wLjAuMScsIHRpbWVvdXQgPSAxNTAwKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBuZXQuU29ja2V0KCk7XG4gICAgICAgIGNvbnN0IGZpbmlzaCA9IChydW5uaW5nLCBlcnJvciA9IG51bGwpID0+IHtcbiAgICAgICAgICAgIHNvY2tldC5kZXN0cm95KCk7XG4gICAgICAgICAgICByZXNvbHZlKHsgcnVubmluZywgcG9ydCwgaG9zdCwgZXJyb3IgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHNvY2tldC5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBzb2NrZXQub25jZSgnY29ubmVjdCcsICgpID0+IGZpbmlzaCh0cnVlKSk7XG4gICAgICAgIHNvY2tldC5vbmNlKCd0aW1lb3V0JywgKCkgPT4gZmluaXNoKGZhbHNlLCAndGltZW91dCcpKTtcbiAgICAgICAgc29ja2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4gZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSkpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc29ja2V0LmNvbm5lY3QocG9ydCwgaG9zdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZmluaXNoKGZhbHNlLCBlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAvLyBJUEMgaGFuZGxpbmcgKEJhY2tlbmQpIFNUQVJUXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5jbGFzcyBJcGNIYW5kbGVyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbnVsbFxuICAgICAgICB0aGlzLmNvbmZpZyA9IG51bGxcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gbnVsbFxuICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSBmYWxzZSAvLyBmbGFnIHRvIHByZXZlbnQgY2xvc2luZyB3aW5kb3cgd2hpbGUgcHJpbnRpbmdcbiAgICB9XG4gICAgaW5pdCAobWMsIGNvbmZpZywgd2gsIGNoKSB7XG4gICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50ID0gbWNcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb25maWdcbiAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyID0gd2ggIFxuICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyID0gY2hcbiAgICAgICAgXG5cbiAgICAgICAgaXBjTWFpbi5vbignc2V0LW5ldy1sb2NhbGUnLCAoZXZlbnQsIGxvY2FsZSkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzZXQtbmV3LWxvY2FsZTogc2V0dGluZyBuZXcgbG9jYWxlIHRvICR7bG9jYWxlfWApXG4gICAgICAgICAgICBpMThuLmxvY2FsZSA9IGxvY2FsZVxuICAgICAgICAgICAgdXBkYXRlU3lzdGVtVHJheShpMThuLmxvY2FsZSk7XG4gICAgICAgIH0pXG5cblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0RXhhbU1hdGVyaWFscycsIGFzeW5jIChldmVudCkgPT4geyBcbiAgICAgIFxuICAgICAgICAgICAgbGV0IGNsaWVudGluZm8gPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvXG4gICAgICAgICAgICBsZXQgc2VydmVybmFtZSA9IGNsaWVudGluZm8uc2VydmVybmFtZVxuICAgICAgICAgICAgbGV0IHNlcnZlcmlwID0gY2xpZW50aW5mby5zZXJ2ZXJpcFxuICAgICAgICAgICAgbGV0IHRva2VuID0gY2xpZW50aW5mby50b2tlblxuICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCBwYXlsb2FkID0ge1xuICAgICAgICAgICAgICAgIGdyb3VwOiBjbGllbnRpbmZvLmdyb3VwLFxuICAgICAgICAgICAgICAgIGxvY2tlZFNlY3Rpb246IGNsaWVudGluZm8ubG9ja2VkU2VjdGlvbixcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGV4YW1NYXRlcmlhbHMgPSBmYWxzZVxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9jYWxMb2NrZG93bil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgIC8vIEZldGNoLVJlcXVlc3QgbWl0IGRlbiBlbnRzcHJlY2hlbmRlbiBPcHRpb25lblxuICAgICAgICAgICAgICAgIGV4YW1NYXRlcmlhbHMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly8ke3NlcnZlcmlwfToke3RoaXMuY29uZmlnLnNlcnZlckFwaVBvcnR9L3NlcnZlci9kYXRhL2dldGV4YW1tYXRlcmlhbHMvJHtzZXJ2ZXJuYW1lfS8ke3Rva2VufWAsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKSAvLyBBbnR3b3J0IGFscyBBcnJheUJ1ZmZlciBlcmhhbHRlblxuICAgICAgICAgICAgICAgIC50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBnZXRFeGFtTWF0ZXJpYWxzOiByZWNlaXZlZCBkYXRhXCIsIGRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldEV4YW1NYXRlcmlhbHM6ICR7ZXJyfWApKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhhbU1hdGVyaWFsc1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSBcblxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtcHJveHknLCBhc3luYyAoZXZlbnQsIHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBob3N0LCBwb3J0IH0gPSBwYXlsb2FkIHx8IHt9O1xuICAgICAgICAgICAgICAgIGlmICghaG9zdCB8fCAhcG9ydCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJveHkgdGFyZ2V0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHN0YXJ0UHJveHkoeyBob3N0LCBwb3J0IH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHBvcnQ6IHJlc3VsdCB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKCdpcGNoYW5kbGVyIEAgc3RhcnQtcHJveHk6JywgZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwb3J0OiBudWxsLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIGZvciBjb21tb24gZXhjZXB0aW9uIFVSTHMgKHVzZWQgYnkgYWxsIGV4YW0gbW9kZXMpXG4gICAgICAgIGNvbnN0IGNoZWNrQ29tbW9uRXhjZXB0aW9ucyA9ICh0YXJnZXRVcmwpID0+IHtcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJNaWNyb3NvZnRcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIkdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudHNcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlLmNvbVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibXlzaWduaW5zXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdFwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWNjb3VudFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJ3aW5kb3dzYXp1cmVcIikpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9va3VwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImdvb2dsZVwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYmlsZHVuZy5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU2hpYmJvbGV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJTQU1MMlwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiaWQtYXVzdHJpYS5ndi5hdFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJhdXRoSGFuZGxlclwiKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJldS1tb2JpbGUuZXZlbnRzLmRhdGFcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibWljcm9zb2Z0XCIpKSByZXR1cm4gdHJ1ZTsgICAvLyBMTVNcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJnc3RhdGljLmNvbVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1pY3Jvc29mdG9ubGluZVwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwibGl2ZS5jb21cIikpIHJldHVybiB0cnVlOyAgIC8vIExNU1xuICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYWFkY2RuXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcIm1zZnRhdXRoLm5ldFwiKSkgcmV0dXJuIHRydWU7ICAgLy8gTE1TXG4gICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiZ29vZ2xlc3luZGljYXRpb24uY29tXCIpKSByZXR1cm4gdHJ1ZTsgXG5cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBhbGxvd2VkVXJscyB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgLy8gRW50ZmVybmUgYWx0ZSBMaXN0ZW5lciwgdW0gRG9wcGVsLVJlZ2lzdHJpZXJ1bmdlbiB6dSB2ZXJtZWlkZW5cbiAgICAgICAgICAgIGd1ZXN0LnJlbW92ZUFsbExpc3RlbmVycygnd2lsbC1uYXZpZ2F0ZScpO1xuXG4gICAgICAgICAgICAvLyBOb3JtYWxpemUgYWxsb3dlZFVybHMgdG8gb2JqZWN0IGZvcm1hdCBmb3Igd2ViRmlsdGVyIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgIC8vIFN1cHBvcnRzIGJvdGggbGVnYWN5IHN0cmluZyBmb3JtYXQgYW5kIG5ldyBvYmplY3QgZm9ybWF0IHt1cmwsIGJsb2NrU3ViZG9tYWlucywgYmxvY2tTdWJmb2xkZXJzfVxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFVybHMgPSBhbGxvd2VkVXJscy5tYXAoZW50cnkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnICYmIGVudHJ5LnVybCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZW50cnk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIExlZ2FjeSBzdHJpbmcgZm9ybWF0IC0gZGVmYXVsdCB0byBub3QgYmxvY2tpbmcgc3ViZG9tYWlucy9zdWJmb2xkZXJzXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdXJsOiBTdHJpbmcoZW50cnkpLCBibG9ja1N1YmRvbWFpbnM6IGZhbHNlLCBibG9ja1N1YmZvbGRlcnM6IGZhbHNlIH07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gSGVscGVyOiBpcyB0YXJnZXQgaW4gYWxsb3dlZCBsaXN0PyBPbmx5IHRoZSBlbnRyeSB3aG9zZSBkb21haW4gbWF0Y2hlcyB0aGUgdGFyZ2V0IGFwcGxpZXM7IHVzZSBvbmx5IHRoYXQgZW50cnkncyByZWFzb25cbiAgICAgICAgICAgIGNvbnN0IGdldEFsbG93UmVzdWx0ID0gKHRhcmdldFVybCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4geyBhbGxvd2VkOiBmYWxzZSwgcmVhc29uOiAnbm8gdGFyZ2V0IFVSTCcgfTtcbiAgICAgICAgICAgICAgICBpZiAoY2hlY2tDb21tb25FeGNlcHRpb25zKFN0cmluZyh0YXJnZXRVcmwpLnRvTG93ZXJDYXNlKCkpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG5cbiAgICAgICAgICAgICAgICBsZXQgcmVhc29uRnJvbU1hdGNoaW5nRW50cnkgPSBudWxsO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2Ygbm9ybWFsaXplZFVybHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gd2ViRmlsdGVyLmdldFVybEFsbG93UmVzdWx0KHRhcmdldFVybCwgZW50cnkudXJsLCBlbnRyeS5ibG9ja1N1YmRvbWFpbnMsIGVudHJ5LmJsb2NrU3ViZm9sZGVycyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuYWxsb3dlZCkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmRvbWFpbk1hdGNoZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbkZyb21NYXRjaGluZ0VudHJ5ID0gcmVzdWx0LnJlYXNvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrOyAvLyB0aGlzIGVudHJ5IGFwcGxpZXMgKGRvbWFpbiBtYXRjaGVzKTsgdXNlIGl0cyByZWFzb24gb25seVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246IHJlYXNvbkZyb21NYXRjaGluZ0VudHJ5IHx8ICdkb21haW4gbm90IGluIGFsbG93ZWQgVVJMcycgfTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEhhbmRsZSB0YXJnZXQ9XCJfYmxhbmtcIiBsaW5rcyBhbmQgd2luZG93Lm9wZW4gLSBibG9jayBCRUZPUkUgbmF2aWdhdGlvblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFsbG93ZWQsIHJlYXNvbiB9ID0gZ2V0QWxsb3dSZXN1bHQodXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoYWxsb3dlZCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2VidmlldzogYWxsb3dlZCB3aW5kb3cub3BlbiB0b1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5sb2FkVVJMKHVybCk7IC8vIE9wZW4gaW4gc2FtZSB3ZWJ2aWV3XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07IC8vIFByZXZlbnQgbmV3IHdpbmRvd1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIHdpbmRvdy5vcGVuIHRvXCIsIHVybCwgXCItXCIsIHJlYXNvbik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFjdGlvbjogJ2RlbnknIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIEhhbmRsZSB3aWxsLW5hdmlnYXRlIG9uIHdlYkNvbnRlbnRzIGxldmVsIC0gZmlyZXMgQkVGT1JFIG5hdmlnYXRpb24gaGFwcGVuc1xuICAgICAgICAgICAgZ3Vlc3Qub24oJ3dpbGwtbmF2aWdhdGUnLCAoZSwgdXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBhbGxvd2VkLCByZWFzb24gfSA9IGdldEFsbG93UmVzdWx0KHVybCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhbGxvd2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJ2aWV3OiBibG9ja2VkIG5hdmlnYXRpb24gdG9cIiwgdXJsLCBcIi1cIiwgcmVhc29uKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBCbG9jayBuYXZpZ2F0aW9uIGNvbXBsZXRlbHlcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3Quc3RvcCgpOyAvLyBTdG9wIGFueSBsb2FkaW5nIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXc6IGFsbG93ZWQgbmF2aWdhdGlvbiB0b1wiLCB1cmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSVBDIGhhbmRsZXIgZm9yIG1vZGUtc3BlY2lmaWMgd2VidmlldyBibG9ja2luZyAtIHN1cHBvcnRzIGVkdXZpZHVhbCwgZm9ybXMsIHJkcCBtb2Rlc1xuICAgICAgICAvLyBGb3Igd2Vic2l0ZSBtb2RlLCBwcmVmZXIgdXNpbmcgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnZpZXcgd2l0aCB3ZWJGaWx0ZXIuanMgaW5zdGVhZFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldycsIChldmVudCwgeyBndWVzdElkLCBtb2RlLCBhbGxvd2VkRG9tYWluLCBiYXNlVXJsLCBibG9ja1N1YmRvbWFpbnMsIGJsb2NrU3ViZm9sZGVycywgbW9vZGxlVGVzdElkLCBtb29kbGVEb21haW4sIGdmb3Jtc1Rlc3RJZCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBndWVzdCA9IHdlYkNvbnRlbnRzLmZyb21JZChOdW1iZXIoZ3Vlc3RJZCkpO1xuICAgICAgICAgICAgaWYgKCFndWVzdCB8fCBndWVzdC5pc0Rlc3Ryb3llZD8uKCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBsaXN0ZW5lcnMgdG8gcHJldmVudCBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgICAgZ3Vlc3QucmVtb3ZlQWxsTGlzdGVuZXJzKCd3aWxsLW5hdmlnYXRlJyk7XG5cbiAgICAgICAgICAgIC8vIFVSTCB2YWxpZGF0aW9uIGZ1bmN0aW9uIC0gZGlmZmVyZW50IGxvZ2ljIGJhc2VkIG9uIG1vZGU7IHJldHVybnMgeyBhbGxvd2VkLCByZWFzb24/IH0gZm9yIHdlYnNpdGUgbW9kZVxuICAgICAgICAgICAgY29uc3QgZ2V0QWxsb3dSZXN1bHQgPSAodGFyZ2V0VXJsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09IFwid2Vic2l0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGVja0NvbW1vbkV4Y2VwdGlvbnMoU3RyaW5nKHRhcmdldFVybCkudG9Mb3dlckNhc2UoKSkpIHJldHVybiB7IGFsbG93ZWQ6IHRydWUgfTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB3ZWJGaWx0ZXIuZ2V0VXJsQWxsb3dSZXN1bHQodGFyZ2V0VXJsLCBiYXNlVXJsIHx8IGFsbG93ZWREb21haW4sICEhYmxvY2tTdWJkb21haW5zLCAhIWJsb2NrU3ViZm9sZGVycyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImVkdXZpZHVhbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlVGVzdElkKSkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwic3RhcnRhdHRlbXB0LnBocFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwicHJvY2Vzc2F0dGVtcHQucGhwXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhtb29kbGVEb21haW4pKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dvdXRcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHJldHVybiB7IGFsbG93ZWQ6IHRydWUgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcImVkdXZpZHVhbFwiKSkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwibG9naW5cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKG1vb2RsZURvbWFpbikpIHJldHVybiB7IGFsbG93ZWQ6IHRydWUgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcInBvbGljeVwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiYXV0aFwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMobW9vZGxlRG9tYWluKSkgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0VXJsLmluY2x1ZGVzKFwiU0FNTDJcIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwicG9ydGFsLnRpcm9sLmd2LmF0XCIpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJsb2dpblwiKSAmJiB0YXJnZXRVcmwuaW5jbHVkZXMoXCJwb3J0YWwudGlyb2wuZ3YuYXRcIikpIHJldHVybiB7IGFsbG93ZWQ6IHRydWUgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhcImxvZ2luXCIpICYmIHRhcmdldFVybC5pbmNsdWRlcyhcInRpcm9sLmd2LmF0XCIpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246ICdub3QgaW4gZWR1dmlkdWFsIGFsbG93IGxpc3QnIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2RlID09PSBcImZvcm1zXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFVybC5pbmNsdWRlcyhnZm9ybXNUZXN0SWQpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwiZm9ybVJlc3BvbnNlXCIpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRVcmwuaW5jbHVkZXMoXCJkb2NzLmdvb2dsZS5jb21cIikgJiYgdGFyZ2V0VXJsLmluY2x1ZGVzKFwidmlld3Njb3JlXCIpKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlIH07XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246ICdub3QgaW4gZm9ybXMgYWxsb3cgbGlzdCcgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZGUgPT09IFwicmRwXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ZWQgPSBjaGVja0NvbW1vbkV4Y2VwdGlvbnModGFyZ2V0VXJsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYWxsb3dlZCA/IHsgYWxsb3dlZDogdHJ1ZSB9IDogeyBhbGxvd2VkOiBmYWxzZSwgcmVhc29uOiAnbm90IGluIGNvbW1vbiBleGNlcHRpb25zJyB9O1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZ3Vlc3Quc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFsbG93ZWQsIHJlYXNvbiB9ID0gZ2V0QWxsb3dSZXN1bHQodXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoYWxsb3dlZCkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHN0YXJ0LWJsb2NraW5nLWZvci13ZWJzaXRlLXdlYnZpZXcgWyR7bW9kZX1dOiBhbGxvd2VkIHdpbmRvdy5vcGVuIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZ3Vlc3QubG9hZFVSTCh1cmwpOyAvLyBPcGVuIGluIHNhbWUgd2Vidmlld1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgc3RhcnQtYmxvY2tpbmctZm9yLXdlYnNpdGUtd2VidmlldyBbJHttb2RlfV06IGJsb2NrZWQgd2luZG93Lm9wZW4gdG9gLCB1cmwsIFwiLVwiLCByZWFzb24pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBndWVzdC5vbignd2lsbC1uYXZpZ2F0ZScsIChlLCB1cmwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFsbG93ZWQsIHJlYXNvbiB9ID0gZ2V0QWxsb3dSZXN1bHQodXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoIWFsbG93ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYmxvY2tlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsLCBcIi1cIiwgcmVhc29uKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBndWVzdC5zdG9wKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3IFske21vZGV9XTogYWxsb3dlZCBuYXZpZ2F0aW9uIHRvYCwgdXJsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxpYXMgZm9yIGVkdXZpZHVhbCBtb2RlIC0gcmVkaXJlY3RzIHRvIHVuaWZpZWQgaGFuZGxlclxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnc3RhcnQtYmxvY2tpbmctZm9yLWVkdXZpZHVhbC13ZWJ2aWV3JywgKGV2ZW50LCB7IGd1ZXN0SWQsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pID0+IHtcbiAgICAgICAgICAgIC8vIENhbGwgdGhlIHVuaWZpZWQgaGFuZGxlciB3aXRoIGVkdXZpZHVhbCBtb2RlXG4gICAgICAgICAgICBjb25zdCB1bmlmaWVkSGFuZGxlciA9IGlwY01haW4ubGlzdGVuZXJzKCdzdGFydC1ibG9ja2luZy1mb3Itd2Vic2l0ZS13ZWJ2aWV3JylbMF07XG4gICAgICAgICAgICBpZiAodW5pZmllZEhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5pZmllZEhhbmRsZXIoZXZlbnQsIHsgZ3Vlc3RJZCwgbW9kZTogJ2VkdXZpZHVhbCcsIG1vb2RsZVRlc3RJZCwgbW9vZGxlRG9tYWluIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgICBcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVsb2FkIHRoZSBicm93c2VyIHZpZXdcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdyZWxvYWQtYnJvd3Nlci12aWV3JywgKGV2ZW50LCB1cmwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJyb3dzZXJWaWV3ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7XG4gICAgICAgICAgICBicm93c2VyVmlldy53ZWJDb250ZW50cy5sb2FkVVJMKHVybCk7XG4gICAgICAgIH0pO1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgbGFuZ3VhZ2VUb29sIEFQSSBTZXJ2ZXIgKHdpdGggSmF2YSBKUkUpXG4gICAgICAgICAqIFJ1bnMgYXQgbG9jYWxob3N0IDgwODhcbiAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzdGFydExhbmd1YWdlVG9vbCcsIChldmVudCkgPT4geyBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KSBcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhY3RpdmF0ZSBzcGVsbGNoZWNrIG9uIGRlbWFuZCBmb3Igc3BlY2lmaWMgc3R1ZGVudFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ3N0YXJ0TGFuZ3VhZ2VUb29sJywgKGV2ZW50KSA9PiB7ICBcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZVRvb2xTZXJ2ZXIuc3RhcnRTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoKGVycil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVjayBpZiBMYW5ndWFnZVRvb2wgc2VydmVyIHJlc3BvbmRzIG9uIGNvbmZpZ3VyZWQgcG9ydFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdpc0xhbmd1YWdlVG9vbFJ1bm5pbmcnLCBhc3luYyAoKSA9PiB7IFxuICAgICAgICAgICAgY29uc3QgcG9ydCA9IGxhbmd1YWdlVG9vbFNlcnZlci5wb3J0IHx8IDgwODg7XG4gICAgICAgICAgICBjb25zdCBob3N0cyA9IFsnMTI3LjAuMC4xJywgJzo6MScsICdsb2NhbGhvc3QnXTtcbiAgICAgICAgICAgIC8vIFJ1biBhbGwgY2hlY2tzIGluIHBhcmFsbGVsIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UsIHVzZSBsb25nZXIgdGltZW91dCBmb3Igc2VydmVyIHN0YXJ0dXAgZGV0ZWN0aW9uXG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoaG9zdHMubWFwKGhvc3QgPT4gY2hlY2tQb3J0T3Blbihwb3J0LCBob3N0LCAyNTAwKSkpO1xuICAgICAgICAgICAgLy8gUmV0dXJuIGZpcnN0IHN1Y2Nlc3NmdWwgcmVzdWx0LCBvciBsYXN0IHJlc3VsdCBpZiBub25lIHN1Y2NlZWRlZFxuICAgICAgICAgICAgY29uc3Qgc3VjY2Vzc1Jlc3VsdCA9IHJlc3VsdHMuZmluZChyZXN1bHQgPT4gcmVzdWx0LnJ1bm5pbmcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQgfHwgcmVzdWx0c1tyZXN1bHRzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgTE9DQUwgTG9ja2Rvd25cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ2xvY2FsbG9ja2Rvd24nLCAoZXZlbnQsIGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIGxvY2FsbG9ja2Rvd246IGxvY2tpbmcgZG93biBjbGllbnQgd2l0aG91dCB0ZWFjaGVyIGNvbm5lY3Rpb25cIiwgYXJncylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IHNlcnZlcnN0YXR1cyA9IHtcbiAgICAgICAgICAgICAgICBleGFtbW9kZTogdHJ1ZSxcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGRlbGZvbGRlcm9uZXhpdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3BlbGxjaGVjazogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogJ2RlLURFJyxcbiAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbW9vZGxlVGVzdFR5cGU6ICcnLFxuICAgICAgICAgICAgICAgIG1vb2RsZURvbWFpbjogJycsXG4gXG4gICAgICAgICAgICAgICAgc2NyZWVuc2hvdGludGVydmFsOiAwLFxuICAgICAgICAgICAgICAgIG1zT2ZmaWNlRmlsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgc2NyZWVuc2xvY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGluOiAnMDAwMCcsXG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB1bmxvY2tvbmV4aXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZvbnRmYW1pbHk6ICdzYW5zLXNlcmlmJyxcbiAgICAgICAgICAgICAgICBtb29kbGVUZXN0SWQ6ICcnLFxuICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGFzc3dvcmQ6IGFyZ3MucGFzc3dvcmQsXG4gICAgICAgICBcbiAgICAgICAgICAgICAgICB1c2VFeGFtU2VjdGlvbnM6IGZhbHNlLCAvL2lmIGZhbHNlIGV4YW0gc2VjdGlvbiAxIGlzIHVzZWQgYW5kIG5vIHRhYnMgYXJlIGRpc3BsYXllZFxuICAgICAgICAgICAgICAgIGFjdGl2ZVNlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgbG9ja2VkU2VjdGlvbjogMSxcbiAgICAgICAgICAgICAgICBleGFtU2VjdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgMToge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhhbXR5cGU6IGFyZ3MuZXhhbW1vZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbWFyZ2luOiB7IHNpZGU6ICdyaWdodCcsIHNpemU6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzcGFjaW5nOiAnMicsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdWRpb1JlcGVhdDogMyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmd1YWdldG9vbDogYXJncy5sYW5ndWFnZXRvb2wgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGVsbGNoZWNrbGFuZzogYXJncy5zcGVsbGNoZWNrbGFuZyB8fCAnZGUtREUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IGFyZ3Muc3VnZ2VzdGlvbnMgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gbWFrZSBzZXJ2ZXJzdGF0dXMgYXZhaWxhYmxlIGZvciBnZXRpbmZvYXN5bmMoKSBzbyB0aGUgcmVuZGVyZXIgKGVkaXRvcikgc2VlcyBwYXNzd29yZCBhbmQgZXhhbVNlY3Rpb25zXG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5zZXJ2ZXJzdGF0dXMgPSBzZXJ2ZXJzdGF0dXM7XG5cbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZSA9IGFyZ3MuY2xpZW50bmFtZTtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uc2VydmVyaXAgPSBcIjEyNy4wLjAuMVwiO1xuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJuYW1lID0gXCJsb2NhbGhvc3RcIjtcbiAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ucGluID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnRva2VuID0gXCIwMDAwXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmdyb3VwID0gXCJhXCI7XG4gICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmxvY2FsTG9ja2Rvd24gPSB0cnVlOyAvLyB0aGlzIG11c3QgYmUgc2V0IHRvIHRydWUgaW4gb3JkZXIgdG8gc3RvcCB0eXBpY2FsIG5leHQtZXhhbSBjbGllbnQvdGVhY2hlciBhY3Rpb25zXG5cbiAgICAgICAgICAgIHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc3RhcnRFeGFtKHNlcnZlcnN0YXR1cylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSBcImhlbGxvIGZyb20gbG9jYWxsb2NrZG93blwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgU3RhcnQgQklQIExvZ2luIFNlcXVlbmNlXG4gICAgICAgICAqL1xuXG4gICAgICAgIGlwY01haW4ub24oJ2xvZ2luQmlQJywgKGV2ZW50LCBiaXB0ZXN0KSA9PiB7XG4gICAgICAgICAgICBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBsb2dpbkJpUDogb3BlbmluZyBiaXAgd2luZG93LiB0ZXN0ZW52aXJvbm1lbnQ6XCIsIGJpcHRlc3QpXG4gICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuY3JlYXRlQmlQTG9naW5XaW4oYmlwdGVzdClcbiAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gXCJoZWxsbyBmcm9tIGJpcCBsb2dvblwiXG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdmlydHVhbGl6ZWQgc3RhdHVzXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigndmlydHVhbGl6ZWQnLCAoKSA9PiB7ICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnZpcnR1YWxpemVkID0gdHJ1ZTsgfSApXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IEZPQ1VTIHN0YXRlIHRvIGZhbHNlIChtb3VzZSBsZWZ0IGV4YW0gd2luZG93KVxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdmb2N1c2xvc3QnLCAoZXZlbnQsIGN0cmxhbHQ9ZmFsc2UpID0+IHsgXG4gICAgICAgICAgICBsZXQgYW5zd2VyID0gZmFsc2UgXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuZGV2ZWxvcG1lbnQgfHwgIXRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1tb2RlKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZX1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuV2luZG93SGFuZGxlci5zY3JlZW5sb2Nrd2luZG93cy5sZW5ndGggPiAwKSB7IFxuICAgICAgICAgICAgICAgIGFuc3dlciA9IHsgc2VuZGVyOiBcImNsaWVudFwiLCBmb2N1czogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLldpbmRvd0hhbmRsZXIuZm9jdXNUYXJnZXRBbGxvd2VkICYmIGN0cmxhbHQgPT0gZmFsc2UpeyBcbiAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIGZvY3VzbG9zdDogbW91c2VsZWF2ZSBldmVudCB3YXMgdHJpZ2dlcmVkIGJ1dCB0YXJnZXQgaXMgYWxsb3dlZGApXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiB0cnVlIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLldpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5tb3ZlVG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2V0S2lvc2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuc2hvdygpOyAgXG4gICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuZm9jdXMoKTsgICAgLy8gd2Uga2VlcCBmb2N1cyBvbiB0aGUgd2luZG93Li4gbm8gbWF0dGVyIHdoYXRcbiAgICBcbiAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gZmFsc2U7IC8vIGJsb2NrIGV2ZXJ5dGhpbmcgYW5kIGluZm9ybSB0ZWFjaGVyICAocHJvYmFibHkgYW4gb3ZlcmtpbGwgb24gbW91c2VsZWF2ZSAtIG5lZWRzIHRlc3RpbmcpXG4gICAgICAgICAgICAgICAgYW5zd2VyID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIGZvY3VzOiBmYWxzZSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGFuc3dlclxuICAgICAgICB9IClcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIG1haW4gY29uZmlnIG9iamVjdFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2dldGNvbmZpZycsIChldmVudCkgPT4geyAgIGV2ZW50LnJldHVyblZhbHVlID0gdGhpcy5jb25maWcgICB9KVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICogVW5sb2NrIENvbXB1dGVyXG4gICAgICAgICovIFxuICAgICAgICBpcGNNYWluLm9uKCdncmFjZWZ1bGx5ZXhpdCcsICgpID0+IHsgIFxuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBncmFjZWZ1bGx5ZXhpdDogZ3JhY2VmdWxseSBsZWF2aW5nIGxvY2tlZCBleGFtIG1vZGVgKVxuXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLmdyYWNlZnVsbHlFbmRFeGFtKCkgXG4gICAgICAgICAgICB0aGlzLkNvbW11bmljYXRpb25IYW5kbGVyLnJlc2V0Q29ubmVjdGlvbigpIFxuICAgICAgICB9IClcblxuICAgICAgICAvKipcbiAgICAgICAgKiBzdG9wIHJlc3RyaWN0aW9uc1xuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncmVzdHJpY3Rpb25zJywgKCkgPT4geyAgXG4gICAgICAgICAgICAvL3RoaXMgYWxzbyBzdG9wcyB0aGUgY2xlYXJDbGlwYm9hcmQgaW50ZXJ2YWxcbiAgICAgICAgICAgIGRpc2FibGVSZXN0cmljdGlvbnModGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIFxuICAgICAgICB9IClcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAqIGNvcHkgdG8gZ2xvYmFsIGNsaXBib2FyZFxuICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignY2xpcGJvYXJkJywgKGV2ZW50LCB0ZXh0KSA9PiB7ICBcbiAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgfSApXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZS1jaGVjayBob3N0aXAgYW5kIGVuYWJsZSBtdWx0aWNhc3QgY2xpZW50XG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2NoZWNraG9zdGlwJywgYXN5bmMgKGV2ZW50KSA9PiB7IFxuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7ICAgIGFkZHJlc3MgPSB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnQuYWRkcmVzcygpOyAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7ICAgbG9nLmVycm9yKFwiaXBjSGFuZGxlciBAIGNoZWNraG9zdGlwOiBtdWx0aWNhc3RjbGllbnQgbm90IHJ1bm5pbmdcIik7ICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxscyBiZXJlaXRzIGVpbmUgQWRyZXNzZSB2b3JoYW5kZW4gaXN0LCBsaWVmZXJuIHdpciBzaWUgenVyXHUwMEZDY2suXG4gICAgICAgICAgICBpZiAoYWRkcmVzcykgeyAgcmV0dXJuIHRoaXMuY29uZmlnLmhvc3RpcDsgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmVyc3VjaGUsIGFuIGRpZSBrb3JyZWt0ZSBTY2huaXR0c3RlbGxlIHp1IGJpbmRlblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBGYWxscyBnYXRld2F5NHN5bmMoKSBibG9ja2llcmVuZCBpc3QsIGthbm5zdCBkdSBkaWVzZW4gQXVmcnVmIGluIGVpbiBQcm9taXNlIHBhY2tlbjpcbiAgICAgICAgICAgICAgICBjb25zdCB7IGdhdGV3YXksIGludGVyZmFjZTogaWZhY2UgfSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdhdGV3YXk0c3luYygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGVycikgeyAgcmVqZWN0KGVycik7ICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoaWZhY2UpOyAvLyBMaWVmZXJ0IGRpZSBJUCBkZXIgU2Nobml0dHN0ZWxsZSwgd2VsY2hlIGRhcyBEZWZhdWx0IEdhdGV3YXkgaGF0XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuZ2F0ZXdheSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmFsbHMga2VpbmUgSVAgKG1pdCBHYXRld2F5KSB2ZXJmXHUwMEZDZ2JhciBpc3QsIGhvbGUgZWluZSBhbHRlcm5hdGl2ZSBBZHJlc3NlXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmhvc3RpcCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmhvc3RpcCA9IGlwLmFkZHJlc3MoKTsgLy8gTGllZmVydCBhdWNoIGVpbmUgSVAsIHdlbm4ga2VpbiBHYXRld2F5IHZlcmZcdTAwRkNnYmFyIGlzdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IFVuYWJsZSB0byBkZXRlcm1pbmUgaXAgYWRkcmVzc1wiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25maWcuaG9zdGlwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLmdhdGV3YXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFZlcmZcdTAwRTRsc2NodGUgQWRyZXNzZW4gKHouIEIuIGxvY2FsaG9zdCkgaWdub3JpZXJlblxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmhvc3RpcCA9PT0gXCIxMjcuMC4wLjFcIikgeyAgICB0aGlzLmNvbmZpZy5ob3N0aXAgPSBmYWxzZTsgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFdlbm4gZGllIE11bHRpY2FzdC1DbGllbnQgbmljaHQgbFx1MDBFNHVmdCwgaW5pdGlhbGlzaWVyZW5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5ob3N0aXAgJiYgIWFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGYWxscyBpbml0KCkgYXN5bmNocm9uIHVtZ2VzZXR6dCB3ZXJkZW4ga2Fubiwgd2FydGVuIHdpciBoaWVyIGRhcmF1Zi5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tdWx0aWNhc3RDbGllbnQuaW5pdCh0aGlzLmNvbmZpZy5nYXRld2F5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7ICBsb2cuZXJyb3IoXCJpcGNIYW5kbGVyIEAgY2hlY2tob3N0aXA6IEVycm9yIGluaXRpYWxpemluZyBtdWx0aWNhc3QgY2xpZW50XCIsIGVycik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25maWcuaG9zdGlwO1xuICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gZWRpdG9yIGFzIGh0bWwgZmlsZSAtIGFzIGJhY2t1cCAtIG9ubHkgdHJpZ2dlcmVkIGJ5IHRoZSB0ZWFjaGVyIGZvciBub3cgKGFsbG93IG1hbnVhbCBiYWNrdXAgISEpXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7Y2xpZW50bmFtZTp0aGlzLmNsaWVudG5hbWUsIGZpbGVuYW1lOmAke2ZpbGVuYW1lfS5odG1sYCwgZWRpdG9yY29udGVudDogZWRpdG9yY29udGVudCB9XG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCdzdG9yZUhUTUwnLCAoZXZlbnQsIGFyZ3MpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IGh0bWxDb250ZW50ID0gYXJncy5lZGl0b3Jjb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGxldCBodG1sZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LmJha2BcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKXtcbiAgICAgICAgICAgICAgICBodG1sZmlsZW5hbWUgPSBgJHtmaWxlbmFtZX0uYmFrYFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBodG1sZmlsZSA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBodG1sZmlsZW5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaHRtbENvbnRlbnQpIHsgXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyOiBzdG9yZUhUTUw6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoaHRtbGZpbGUsIGh0bWxDb250ZW50LCAoZXJyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogJHtlcnIubWVzc2FnZX1gKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYWx0ZXJuYXRlcGF0aCA9IGAke2h0bWxmaWxlfS0ke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW59LmJha2BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihcImlwY2hhbmRsZXIgQCBzdG9yZUhUTUw6IHRyeWluZyB0byB3cml0ZSBmaWxlIGFzOlwiLCBhbHRlcm5hdGVwYXRoIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgaHRtbENvbnRlbnQsIGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJpcGNoYW5kbGVyIEAgc3RvcmVIVE1MOiBnaXZpbmcgdXBcIik7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHN0b3JlSFRNTDogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImxvYWRmaWxlbGlzdFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfSApOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTplcnIgLCBzdGF0dXM6XCJlcnJvclwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgYmFzZTY0IGVuY29kZWQgcGRmIGZyb20gZWRpdG9yXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBERmJhc2U2NCcsIGFzeW5jIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgZ2V0UERGYmFzZTY0OiBnZXR0aW5nIGJhc2U2NCBlbmNvZGVkIHBkZlwiKVxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zdWJtaXNzaW9ubnVtYmVyID0gYXJncy5zdWJtaXNzaW9ubnVtYmVyKzEgLy8gY2xpZW50aW5mbyBrZWVwcyB0cmFjayBvZiBzdWJtaXNzaW9ucyBmb3IgYXV0b21hdGVkIHN1Ym1pc3Npb25udW1iZXJzIGF0IHNlY3Rpb24gY2hhbmdlIC0gYnV0IHRoaXMgb2J2aW91c2x5IGhhcHBlbnMgYWZ0ZXIgbWFudWFsIHN1Ym1pdFxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKGFyZ3Muc3VibWlzc2lvbm51bWJlciwgYXJncy5zZWN0aW9ubmFtZSwgYXJncy5wcmludEJhY2tncm91bmQpICAgLy8gd2h5IHRoZSBoZWxsIGlzIHRoaXMgZnVuY3Rpb24gbG9jYXRlZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBhbmQgbm90IGluIGlwY2hhbmRsZXIuanMgPyBGSVhNRSAhXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyB0aGUgRXhhbVdpbmRvdyBjb250ZW50IGFzIFBERlxuICAgICAgICAgKiBBVFRFTlRJT04gdGhlcmUgaXMgYSBzaW1pbGFyIG1ldGhvZCBpbiBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyB0aGF0IGFsc28gZ2VuZXJhdGVzIGEgcGRmIGJ1dCByZXR1bnMgYSBiYXNlNjQgdmVyc2lvbiBvZiB0aGUgcGRmXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbigncHJpbnRwZGYnLCAoZXZlbnQsIGFyZ3MpID0+IHsgXG4gICAgICAgICAgICAvLyBkbyBub3QgcHJpbnQgaWYgZXhhbSBtb2RlIGlzIG5vdCBhY3RpdmUgYW55bW9yZVxuICAgICAgICAgICAgaWYgKCF0aGlzLm11bHRpY2FzdENsaWVudD8uY2xpZW50aW5mbz8uZXhhbW1vZGUpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBleGFtbW9kZSBpcyBmYWxzZSAtIHNraXBwaW5nIHByaW50XCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUHJpbnRpbmdQZGYpe1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBwcmludCBhbHJlYWR5IGluIHByb2dyZXNzIC0gc2tpcHBpbmcgbmV3IHJlcXVlc3RcIilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93KXtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyAvLyBkZWZpbmUgcHJpbnQgb3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICBtYXJnaW5zOiB7dG9wOjAuNSwgcmlnaHQ6MCwgYm90dG9tOjAuNSwgbGVmdDowIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhZ2VTaXplOiAnQTQnLFxuICAgICAgICAgICAgICAgICAgICBwcmludEJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwcmludFNlbGVjdGlvbk9ubHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsYW5kc2NhcGU6IGFyZ3MubGFuZHNjYXBlLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVyRm9vdGVyOnRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZvb3RlclRlbXBsYXRlOiBcIjxkaXYgc3R5bGU9J2hlaWdodDoxMnB4OyBmb250LXNpemU6MTBweDsgdGV4dC1hbGlnbjogcmlnaHQ7IHdpZHRoOjEwMCU7IG1hcmdpbi1yaWdodDogMzBweDttYXJnaW4tYm90dG9tOjEwcHg7Jz48c3BhbiBjbGFzcz1wYWdlTnVtYmVyPjwvc3Bhbj58PHNwYW4gY2xhc3M9dG90YWxQYWdlcz48L3NwYW4+PC9kaXY+XCIsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRlbXBsYXRlOiBgPGRpdiBzdHlsZT0nZGlzcGxheTogaW5saW5lLWJsb2NrOyBoZWlnaHQ6MTJweDsgZm9udC1zaXplOjEwcHg7IHRleHQtYWxpZ246IHJpZ2h0OyB3aWR0aDoxMDAlOyBtYXJnaW4tcmlnaHQ6IDMwcHg7bWFyZ2luLWxlZnQ6IDMwcHg7IG1hcmdpbi10b3A6MTBweDsnPjxzcGFuIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4ke2FyZ3Muc2VydmVybmFtZX08L3NwYW4+PHNwYW4gc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPiZuYnNwO3wmbmJzcDsgPC9zcGFuPjxzcGFuIGNsYXNzPWRhdGUgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsb2F0OnJpZ2h0O1wiPiR7YXJncy5jbGllbnRuYW1lfTwvc3Bhbj48L2Rpdj5gLFxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJDU1NQYWdlU2l6ZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgcGRmZmlsZW5hbWUgPSBgJHt0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLm5hbWV9LnBkZmAgIC8vIGRlZmF1bHQgZmlsZW5hbWUgPSBjbGllbnRuYW1lLnBkZlxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmZpbGVuYW1lKXsgIC8vIGluIGNhc2Ugb2YgbWFudWFsIGJhY2t1cCB0aGUgdXNlciBjYW4gc2V0IGEgY3VzdG9tIGZpbGVuYW1lXG4gICAgICAgICAgICAgICAgICAgIHBkZmZpbGVuYW1lID0gYCR7YXJncy5maWxlbmFtZX0ucGRmYFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGRmZmlsZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgcGRmZmlsZW5hbWUpOyAgLy8gcGF0aCBwb2ludHMgdG8gdGhlIGN1cnJlbnQgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGVmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1hdXgucGRmYCAgICAvL3Rob21hcy5wZGYtYXV4LnBkZiBcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSA9IGAke3BkZmZpbGVuYW1lfS1vbGQucGRmYDsgICAvL3Rob21hcy5wZGYtb2xkLnBkZlxuICAgICAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0ZXBhdGggPSBwYXRoLmpvaW4odGhpcy5jb25maWcuZXhhbWRpcmVjdG9yeSwgYWx0ZXJuYXRlZmlsZW5hbWUpOyAgLy8gaWYgc29tZXRoaW5nIGdvZXMgd3Jvbmcgd2UgdHJ5IHRvIHdyaXRlIGEgZGlmZmVyZW50IGZpbGVcblxuXG4gICAgICAgICAgICAgICAgLy8gYXV4IGZpbGVzIGFyZSBmaWxlcyBjcmVhdGVkIGlmIHRoZSBtYWluIHBkZmZpbGVwYXRoIGlzIG5vdCB3cml0ZWFibGUgKG9wZW5lZCBvbiB3aW5kb3dzKSBcbiAgICAgICAgICAgICAgICB0cnkgeyAgLy8gYWx3YXlzIGNoZWNrIGZvciBvbGQgYXV4IGZpbGVzIGFuZCByZW5hbWUgdGhlbVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnkpO1xuICAgICAgICAgICAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IGFsdGVybmF0ZWZpbGVuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBhbHRlcm5hdGViYWNrdXBmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhhbHRlcm5hdGVwYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGFtV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV4YW1XaW5kb3c/LndlYkNvbnRlbnRzXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdlYkNvbnRlbnRzKXtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiaXBjaGFuZGxlciBAIHByaW50cGRmOiBubyB3ZWJDb250ZW50cyBmb3VuZCBmb3IgZXhhbXdpbmRvd1wiKVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXBseShcImZpbGVlcnJvclwiLCB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTpcIm5vIHdlYkNvbnRlbnRzIGZvdW5kIGZvciBleGFtd2luZG93XCIgLCBzdGF0dXM6XCJlcnJvclwiIH0gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzUHJpbnRpbmdQZGYgPSB0cnVlXG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRpdGxlIG9mIHRoZSBleGFtIHdpbmRvdyBhbmQgdGhlcmVmb3JlIHRoZSBkb2N1bWVudCB0aXRsZSBmb3IgUERGIG1ldGFkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgcGRmVGl0bGUgPSBhcmdzLmZpbGVuYW1lID8gYXJncy5maWxlbmFtZSA6IGAke3RoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubmFtZX0gLSAke2FyZ3Muc2VydmVybmFtZSB8fCB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgfHwgJyd9YFxuICAgICAgICAgICAgICAgIC8vIGVzY2FwZSBxdW90ZXMgYW5kIHNwZWNpYWwgY2hhcmFjdGVycyBmb3IgSmF2YVNjcmlwdCBzdHJpbmdcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkVGl0bGUgPSBwZGZUaXRsZS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5leGVjdXRlSmF2YVNjcmlwdChgZG9jdW1lbnQudGl0bGUgPSBcIiR7ZXNjYXBlZFRpdGxlfVwiYCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByaW50IHRoZSBleGFtIHdpbmRvdyB0byBwZGZcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdlYkNvbnRlbnRzLnByaW50VG9QREYob3B0aW9ucylcbiAgICAgICAgICAgICAgICB9KS50aGVuKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZWxldGUgdGhlIG9sZCBwZGYgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMocGRmZmlsZXBhdGgpKSB7IGZzLnVubGlua1N5bmMocGRmZmlsZXBhdGgpOyB9fVxuICAgICAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHsgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgcHJpbnRwZGY6ICR7ZXJyLm1lc3NhZ2V9YCk7ICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHdyaXRlIHRoZSBwZGYgdG8gdGhlIGV4YW0gZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZShwZGZmaWxlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2cud2FybihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vyci5tZXNzYWdlfSAtIHdyaXRpbmcgZmlsZSBhczogJHthbHRlcm5hdGVwYXRofSBgKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBvbGQgYXV4IGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRlcGF0aCkpIHsgZnMudW5saW5rU3luYyhhbHRlcm5hdGVwYXRoKTsgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBwcmludHBkZiAoYWx0ZXJuYXRpdmVyIFBmYWQpOiAke2Vyci5tZXNzYWdlfWApOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHBkZiB0byB0aGUgYWx0ZXJuYXRlIHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGUoYWx0ZXJuYXRlcGF0aCwgZGF0YSwgKGVycikgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcImlwY2hhbmRsZXIgQCBwcmludHBkZjogZ2l2aW5nIHVwXCIpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwiZmlsZWVycm9yXCIsIHsgc2VuZGVyOiBcImNsaWVudFwiLCBtZXNzYWdlOmVyci5tZXNzYWdlICwgc3RhdHVzOlwiZXJyb3JcIiB9IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgLy8gbG9nLmluZm8oXCJpcGNoYW5kbGVyIEAgcHJpbnRwZGY6IHN1Y2Nlc3MhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJsb2FkZmlsZWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgeyAvLyBsb2cuaW5mbyhcImlwY2hhbmRsZXIgQCBwcmludHBkZjogc3VjY2VzcyFcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MucmVhc29uID09PSBcInRlYWNoZXJyZXF1ZXN0XCIpIHsgdGhpcy5Db21tdW5pY2F0aW9uSGFuZGxlci5zZW5kVG9UZWFjaGVyKCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LnJlcGx5KFwibG9hZGZpbGVsaXN0XCIpICAgLy9tYWtlIHN1cmUgc3R1ZGVudHMgc2VlIHRoZSBuZXcgZmlsZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9ICk7IFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIHByaW50cGRmOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyb3IubWVzc2FnZSAsIHN0YXR1czpcImVycm9yXCIgfSApXG4gICAgICAgICAgICAgICAgfSkuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNQcmludGluZ1BkZiA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNhdmVzIEFjdGl2ZSBTaGVldHMgZm9ybSBkYXRhIHRvIC5iYWsgZmlsZVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5vbignc2F2ZUFjdGl2ZXNoZWV0c0JhaycsIChldmVudCwgYXJncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWtGaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWUgPyBgJHthcmdzLmZpbGVuYW1lfS5iYWtgIDogYCR7dGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lfS5iYWtgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJha0ZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLmV4YW1kaXJlY3RvcnksIGJha0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IGZvcm1EYXRhIHRvIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShhcmdzLmZvcm1EYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byAuYmFrIGZpbGVcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGJha0ZpbGVQYXRoLCBqc29uRGF0YSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIHNhdmVBY3RpdmVzaGVldHNCYWs6IHNhdmVkIGZvcm0gZGF0YSB0byAke2Jha0ZpbGVuYW1lfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlQWN0aXZlc2hlZXRzQmFrOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgZXZlbnQucmVwbHkoXCJmaWxlZXJyb3JcIiwgeyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsIHN0YXR1czogXCJlcnJvclwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFsbCBmb3VuZCBTZXJ2ZXJzIGFuZCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjbGllbnRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0aW5mb2FzeW5jJywgYXN5bmMgKGV2ZW50KSA9PiB7ICAgXG4gICAgICAgICAgICBsZXQgc2VydmVyc3RhdHVzID0gZmFsc2UgICBcbiAgICAgICAgICAgIC8vIHNlcnZlcnN0YXR1cyBvYmpla3Qgd2lyZCBudXIgYmVpIGJlZ2lubiBkZXMgZXhhbXMgYW4gZGFzIGV4YW0gd2luZG93IGR1cmNoZ2VyZWljaHQgZlx1MDBGQ3IgYmFzaXMgZWluc3RlbGx1bmdlblxuICAgICAgICAgICAgLy8gYWxsZSB3ZWl0ZXJlbiB1cGRhdGVzIFx1MDBGQ2JlciBkYXMgc2VydmVyc3RhdHVzIG9iamVjdCB3ZXJkZW4gaW0gY29tbXVuaWNhdGlvbiBoYW5kbGVyIGdlbGVzZW4gdW5kIGdnZi4gYXVmIGRhcyBjbGllbnRpbmZvIG9iamVjdCBnZWxlZ3RcbiAgICAgICAgICAgIC8vIGRpZXNlciBrb21tdW5pa2F0aW9uc2ZsdXNzIG11c3MgaW4gMi4wIGdlc3RyZWFtbGluZWQgd2VyZGVuICNGSVhNRVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpIHsgc2VydmVyc3RhdHVzID0gdGhpcy5tdWx0aWNhc3RDbGllbnQuc2VydmVyc3RhdHVzIH1cblxuICAgICAgICAgICAgLy9jb3VudCBudW1iZXIgb2YgZmlsZXMgaW4gZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGlmICghdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtbW9kZSl7XG4gICAgICAgICAgICAgICAgY29uc3Qgd29ya2RpciA9IHBhdGguam9pbihjb25maWcuZXhhbWRpcmVjdG9yeSwgXCIvXCIpXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSkgIC8vIGVyc3RlbGx0IGZhbGxzIG5cdTAwRjZ0aWdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZWxpc3QgPSAoYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcih3b3JrZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGRpcmVudCA9PiBkaXJlbnQuaXNGaWxlKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGRpcmVudCA9PiBkaXJlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5udW1iZXJPZkZpbGVzID0gZmlsZWxpc3QubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICByZXR1cm4geyAgIFxuICAgICAgICAgICAgICAgIHNlcnZlcmxpc3Q6IHRoaXMubXVsdGljYXN0Q2xpZW50LmV4YW1TZXJ2ZXJMaXN0LFxuICAgICAgICAgICAgICAgIGNsaWVudGluZm86IHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8sXG4gICAgICAgICAgICAgICAgc2VydmVyc3RhdHVzOiBzZXJ2ZXJzdGF0dXNcbiAgICAgICAgICAgIH0gICBcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBTdHVkZW50LWluaXRpYXRlZCBzZWN0aW9uIHN3aXRjaCB3aGVuIGFsbG93U2VjdGlvblN3aXRjaCBpcyB0cnVlOyBhbHdheXMgdXNlcyBjdXJyZW50IHNlcnZlcnN0YXR1cyBhbmQgc2VjdGlvbiBudW1iZXJcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ3N3aXRjaC1leGFtLXNlY3Rpb24nLCBhc3luYyAoZXZlbnQsIHNlY3Rpb25OdW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcnN0YXR1cyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93Py5zZXJ2ZXJzdGF0dXM7XG4gICAgICAgICAgICBpZiAoIXNlcnZlcnN0YXR1cz8udXNlRXhhbVNlY3Rpb25zIHx8ICFzZXJ2ZXJzdGF0dXM/LmFsbG93U2VjdGlvblN3aXRjaCkgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9PT0gc2VjdGlvbk51bWJlcikgcmV0dXJuO1xuICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBzd2l0Y2gtZXhhbS1zZWN0aW9uOiBzd2l0Y2hpbmcgdG8gc2VjdGlvbiAke3NlY3Rpb25OdW1iZXJ9YClcbiAgICAgICAgICAgIGF3YWl0IHN3aXRjaEV4YW1TZWN0aW9uKHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIsIHNlcnZlcnN0YXR1cywgc2VjdGlvbk51bWJlcik7XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGJlY2F1c2Ugb2YgbWljcm9zb2Z0IDM2NSB3ZSBuZWVkIHRvIHdvcmsgd2l0aCBcIkJyb3dzZXJWaWV3XCIgXG4gICAgICAgICAqIGluIG9yZGVyIHRvIGJlIGFibGUgdG8gZGlzbGF5IGZ1bGxzY3JlZW4gaW5mb3JtYXRpb24gZnJvbSB0aGUgRXhhbSBoZWFkZXIgd2UgdGVtcG9yYXJpbHkgY29sbGFwc2UgdGhlIEJyb3dzZXJWaWV3IGZvciBPZmZpY2VcbiAgICAgICAgICogYW5kIHJlc3RvcmUgaXQgYWZ0ZXJ3YXJkcyAtIG5vdCBwZXJmZWN0IGJ1dCBsb29rcyBva1xuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4ub24oJ2NvbGxhcHNlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBjb250ZW50VmlldyA9IG1haW5XaW5kb3cuZ2V0QnJvd3NlclZpZXcoMCk7IC8vIGFzc3VtaW5nIGl0J3MgdGhlIDFzdCBhZGRlZCB2aWV3XG4gICAgICAgICAgICBjb250ZW50Vmlldy5zZXRCb3VuZHMoeyB4OiAwLCB5OiAwLCB3aWR0aDogMCwgaGVpZ2h0OiAwIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgICAgICBpcGNNYWluLm9uKCdyZXN0b3JlLWJyb3dzZXJ2aWV3JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3dcbiAgICAgICAgICAgIGlmICghbWFpbldpbmRvdyl7IHJldHVybiB9XG4gICAgICAgICAgICBjb25zdCBtZW51SGVpZ2h0ID0gbWFpbldpbmRvdy5tZW51SGVpZ2h0O1xuICAgICAgICAgICAgY29uc3QgbmV3Qm91bmRzID0gbWFpbldpbmRvdy5nZXRCb3VuZHMoKTsgLy8gR2V0IHRoZSBjdXJyZW50IGJvdW5kcyBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgY29uc3QgY29udGVudFZpZXcgPSBtYWluV2luZG93LmdldEJyb3dzZXJWaWV3KDApOyAvLyBhc3N1bWluZyBpdCdzIHRoZSAxc3QgYWRkZWQgdmlld1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBuZXcgYm91bmRzIG9mIHRoZSBjb250ZW50Vmlld1xuICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IG1lbnVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IG5ld0JvdW5kcy53aWR0aCwgLy8gZnVsbCB3aWR0aCBvZiB0aGUgbWFpbldpbmRvd1xuICAgICAgICAgICAgICAgIGhlaWdodDogbmV3Qm91bmRzLmhlaWdodCAtIG1lbnVIZWlnaHQgLy8gcmVtYWluaW5nIGhlaWdodCBhZnRlciB0aGUgbWVudVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGUgbWVudSBoZWlnaHQgZHluYW1pY2FsbHkgd2hlbiBoZWFkZXIgY29udGVudCBjaGFuZ2VzXG4gICAgICAgICAqL1xuICAgICAgICBpcGNNYWluLm9uKCd1cGRhdGUtbWVudS1oZWlnaHQnLCAoZXZlbnQsIGhlaWdodCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHRoaXMuV2luZG93SGFuZGxlci5leGFtd2luZG93O1xuICAgICAgICAgICAgaWYgKG1haW5XaW5kb3cgJiYgaGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc3RvcmVkIG1lbnUgaGVpZ2h0XG4gICAgICAgICAgICAgICAgbWFpbldpbmRvdy5tZW51SGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFJlcG9zaXRpb24gdGhlIGJyb3dzZXIgdmlldyB3aXRoIG5ldyBoZWlnaHRcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdCb3VuZHMgPSBtYWluV2luZG93LmdldEJvdW5kcygpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRWaWV3ID0gbWFpbldpbmRvdy5nZXRCcm93c2VyVmlldygwKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudFZpZXcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFZpZXcuc2V0Qm91bmRzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB5OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbmV3Qm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBuZXdCb3VuZHMuaGVpZ2h0IC0gaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZW5kcyBhIHJlZ2lzdGVyIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHNlcnZlciBpcFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3Qgd2l0aCAgY2xpZW50bmFtZTp0aGlzLnVzZXJuYW1lLCBzZXJ2ZXJuYW1lOnNlcnZlcm5hbWUsIHNlcnZlcmlwLCBzZXJ2ZXJpcCwgcGluOnRoaXMucGluY29kZSBcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4ub24oJ3JlZ2lzdGVyJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjbGllbnRuYW1lID0gYXJncy5jbGllbnRuYW1lXG4gICAgICAgICAgICBjb25zdCBwaW4gPSBhcmdzLnBpblxuICAgICAgICAgICAgY29uc3Qgc2VydmVyaXAgPSBhcmdzLnNlcnZlcmlwXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJuYW1lID0gYXJncy5zZXJ2ZXJuYW1lXG4gICAgICAgICAgICBjb25zdCBjbGllbnRpcCA9IGlwLmFkZHJlc3MoKVxuICAgICAgICAgICAgY29uc3QgaG9zdG5hbWUgPSBvcy5ob3N0bmFtZSgpXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gdGhpcy5jb25maWcudmVyc2lvblxuICAgICAgICAgICAgY29uc3QgYmlwdXNlcklEID0gYXJncy5iaXB1c2VySURcblxuICAgICAgICAgICAgaWYgKHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8udG9rZW4peyAvLyNGSVhNRSBkYXMgc29sbHRlIGVpZ2VudGxpY2ggdm9tIHNlcnZlciBrb21tZW4gXG4gICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTogdChcImNvbnRyb2wuYWxyZWFkeXJlZ2lzdGVyZWRcIiksIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHtzZXJ2ZXJpcH06JHt0aGlzLmNvbmZpZy5zZXJ2ZXJBcGlQb3J0fS9zZXJ2ZXIvY29udHJvbC9yZWdpc3RlcmNsaWVudC8ke3NlcnZlcm5hbWV9LyR7cGlufS8ke2NsaWVudG5hbWV9LyR7Y2xpZW50aXB9LyR7aG9zdG5hbWV9LyR7dmVyc2lvbn0vJHtiaXB1c2VySUR9YDtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IEFib3J0U2lnbmFsLnRpbWVvdXQoODAwMCk7IC8vIDgwMDAgTWlsbGlzZWt1bmRlbiA9IDggU2VrdW5kZW4gQWJvcnRTaWduYWwgbWl0IGVpbmVtIFRpbWVvdXRcblxuXG4gICAgICAgICAgICBmZXRjaCh1cmwsIHsgbWV0aG9kOiAnR0VUJywgc2lnbmFsIH0pXG4gICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpIFxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5zdGF0dXMgPT0gXCJzdWNjZXNzXCIpIHsgIC8vIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsbCBvdGhlcndpc2UgZGF0YSB3b3VsZCBiZSBcImZhbHNlXCJcbiAgICAgICAgICAgICAgICAgICAgLy8gRXJmb2xncmVpY2hlIFJlZ2lzdHJpZXJ1bmdcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5uYW1lID0gY2xpZW50bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5zZXJ2ZXJpcCA9IHNlcnZlcmlwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnNlcnZlcm5hbWUgPSBzZXJ2ZXJuYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmlwID0gY2xpZW50aXA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8uaG9zdG5hbWUgPSBob3N0bmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby50b2tlbiA9IGRhdGEudG9rZW47IC8vIHdlIG5lZWQgdG8gc3RvcmUgdGhlIGNsaWVudCB0b2tlbiBpbiBvcmRlciB0byBjaGVjayBhZ2FpbnN0IGl0IGJlZm9yZSBwcm9jZXNzaW5nIGNyaXRpY2FsIGFwaSBjYWxsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLmZvY3VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5waW4gPSBwaW47XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgcmVnaXN0ZXI6IHN1Y2Nlc3NmdWxseSByZWdpc3RlcmVkIGF0ICR7c2VydmVybmFtZX0gQCAke3NlcnZlcmlwfSBhcyAke2NsaWVudG5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0gZGF0YTtcblxuICAgICAgICAgICAgICAgICAgICAvL2NyZWF0ZSBleGFtIGZvbGRlciBpbiB3b3JrZm9sZGVyXG4gICAgICAgICAgICAgICAgICAgIGxldCB1bmlxdWVleGFtTmFtZSA9IGAke3NlcnZlcm5hbWV9LSR7cGlufWBcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnLmV4YW1kaXJlY3RvcnkgPSBwYXRoLmpvaW4oY29uZmlnLndvcmtkaXJlY3RvcnksIHVuaXF1ZWV4YW1OYW1lKVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29uZmlnLmV4YW1kaXJlY3RvcnkpKXsgZnMubWtkaXJTeW5jKGNvbmZpZy5leGFtZGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsgfVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLnZlcnNpb24pe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29tcGFyZSB2ZXJzaW9ucyBhbmQgZGlzcGxheSBtZXNzYWdlICh0ZWFjaGVyIG5lZWRzIHVwZ3JhZGUuLiBjbGllbnQgbmVlZHMgdXBncmFkZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhcmlzb25SZXN1bHQgPSB0aGlzLmNvbXBhcmVTb2Z0d2FyZShjb25maWcudmVyc2lvbiwgY29uZmlnLmluZm8gLCBkYXRhLnZlcnNpb24sIGRhdGEudmVyc2lvbmluZm8gKSAvL3NlcnZlclZlcnNpb24sIHNlcnZlclN0YXR1cywgbG9jYWxWZXJzaW9uLCBsb2NhbFN0YXR1c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7ICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJJaHJlIFZlcnNpb24gdm9uIE5leHQtRXhhbSBpc3QgbmV1ZXIgYWxzIGRpZSBkZXIgTGVocnBlcnNvbiFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkgeyAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIklocmUgVmVyc2lvbiB2b24gTmV4dC1FeGFtIGlzdCB6dSBhbHQuIExhZGVuIHNpZSBzaWNoIGVpbmUgYWt0dWVsbGUgVmVyc2lvbiBoZXJ1bnRlciFcIiB9OyAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB7IHN0YXR1czogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVuYmVrYW5udGVyIEZlaGxlciBiZWltIFZlcmJpbmR1bmdzYXVmYmF1LlwiIH07ICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHsgc3RhdHVzOiBcImVycm9yXCIsIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goYXN5bmMgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEZlaGxlcmJlaGFuZGx1bmdcbiAgICAgICAgICAgICAgICBsZXQgZXJyb3JNZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7IGVycm9yTWVzc2FnZSA9IFwiVGhlIHJlcXVlc3QgdGltZWQgb3V0XCI7ICAgfSAvLyBUaW1lb3V0LU5hY2hyaWNodCBhbnBhc3NlbiBcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCByZWdpc3RlcjogJHtlcnJvck1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gb24gbWFjb3MgdGhlIHBlcm1pc3Npb24gc2V0dGluZ3MgaW4gcmFyZSBjYXNlcyBtZXNzIHVwIHRoZSBhYmlsaXR5IHRvIGZldGNoIHRoZSB0ZWFjaGVyIGFwaSBcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBmb3IgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIil7ICAgIFxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBhd2FpdCBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgdGhpcy5jb25maWcuc2VydmVyQXBpUG9ydCk7IFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UgPT09IFwicmVzZXRcIikgeyAgIC8vIHF1aXQgdGhlIGFwcCBpZiB0aGUgdXNlciB3YW50cyB0byByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzaG93IHdhcm5pbmcgbWVzc2FnZSBpZiB0aGUgdXNlciBkb2VzIG5vdCB3YW50IHRvIHJlc2V0IHRoZSBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgICAgIGV2ZW50LnJldHVyblZhbHVlID0geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6IFwiRXMgZ2lidCBlaW4gUHJvYmxlbSBtaXQgZGVtIE5ldHp3ZXJrLCBkZW4gRmlyZXdhbGxyZWdlbG4gb2RlciBkZW4gTmV0endlcmtiZXJlY2h0aWd1bmdlbiEgQml0dGUgYmVoZWJlbiBzaWUgZGllc2VzIFByb2JsZW0gdW5kIHN0YXJ0ZW4gU2llIE5leHQtRXhhbSBuZXUhXCIsIHN0YXR1czogXCJlcnJvclwiIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG5cblxuXG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZSBjb250ZW50IGZyb20gR2VvZ2VicmEgYXMgZ2diIGZpbGUgLSBhcyBiYWNrdXAgXG4gICAgICAgICAqIEBwYXJhbSBhcmdzIGNvbnRhaW5zIGFuIG9iamVjdCB3aXRoICB7IGZpbGVuYW1lOmAke3RoaXMuY2xpZW50bmFtZX0uZ2diYCwgY29udGVudDogYmFzZTY0IH1cbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdzYXZlR0dCJywgKGV2ZW50LCBhcmdzKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXJncy5jb250ZW50XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGFyZ3MuZmlsZW5hbWVcbiAgICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IGFyZ3MucmVhc29uXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICBpZiAoY29udGVudCkgeyBcbiAgICAgICAgICAgICAgICAvL2xvZy5pbmZvKFwiaXBjaGFuZGxlciBAIHNhdmVHR0I6IHNhdmluZyBzdHVkZW50cyB3b3JrIHRvIGRpc2suLi5cIilcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IEJ1ZmZlci5mcm9tKGNvbnRlbnQsICdiYXNlNjQnKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoZ2diRmlsZVBhdGgsIGZpbGVEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gXCJ0ZWFjaGVycmVxdWVzdFwiKSB7IHRoaXMuQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICB7IHNlbmRlcjogXCJjbGllbnRcIiwgbWVzc2FnZTp0KFwiZGF0YS5maWxlc3RvcmVkXCIpICwgc3RhdHVzOlwic3VjY2Vzc1wiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5XaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cud2ViQ29udGVudHMuc2VuZCgnZmlsZWVycm9yJywgZXJyKSAgXG4gICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBzYXZlR0dCOiAke2Vycn1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzZW5kZXI6IFwiY2xpZW50XCIsIG1lc3NhZ2U6ZXJyICwgc3RhdHVzOlwiZXJyb3JcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogbG9hZCBjb250ZW50IGZyb20gZ2diIGZpbGUgYW5kIHNlbmQgaXQgdG8gdGhlIGZyb250ZW5kIFxuICAgICAgICAgKiBAcGFyYW0gYXJncyBjb250YWlucyBhbiBvYmplY3QgeyBmaWxlbmFtZTpgJHt0aGlzLmNsaWVudG5hbWV9LmdnYmAgfVxuICAgICAgICAgKi9cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2xvYWRHR0InLCAoZXZlbnQsIGZpbGVuYW1lKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCBnZ2JGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmNvbmZpZy5leGFtZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFJlYWQgdGhlIGZpbGUgYW5kIGNvbnZlcnQgaXQgdG8gYmFzZTY0XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZ2diRmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2U2NEdnYkZpbGUgPSBmaWxlRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OmJhc2U2NEdnYkZpbGUsIHN0YXR1czpcInN1Y2Nlc3NcIiB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgfSAgICAgXG4gICAgICAgIH0pXG5cblxuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogR0VUIFBERiBvciBJTUFHRSBmcm9tIEVYQU0gZGlyZWN0b3J5XG4gICAgICAgICAqIEBwYXJhbSBmaWxlbmFtZSBpZiBzZXQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUgaXMgcmV0dXJuZWRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0cGRmYXN5bmMnLCAoZXZlbnQsIGZpbGVuYW1lLCBpbWFnZSA9IGZhbHNlKSA9PiB7ICAgXG4gICAgICAgICAgICBjb25zdCB3b3JrZGlyID0gcGF0aC5qb2luKGNvbmZpZy5leGFtZGlyZWN0b3J5LFwiL1wiKVxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lKSB7IC8vcmV0dXJuIGNvbnRlbnQgb2Ygc3BlY2lmaWMgZmlsZVxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gZnMucmVhZEZpbGVTeW5jKGZpbGVwYXRoKVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoaW1hZ2UpeyByZXR1cm4gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7ICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VuZGVyOiBcImNsaWVudFwiLCBjb250ZW50OiBmYWxzZSAsIHN0YXR1czpcImVycm9yXCIgfVxuICAgICAgICAgICAgICAgIH0gICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJldHVybnMgYmFzZTY0IHN0cmluZyBvZiBhdWRpb2ZpbGUgZnJvbSB3b3JrZGlyZWN0b3J5IG9yIHB1YmxpYyBkaXJlY3RvcnlcbiAgICAgICAgICovXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRBdWRpb0ZpbGUnLCBhc3luYyAoZXZlbnQsIGZpbGVuYW1lLCBwdWJsaWNkaXI9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksIFwiL1wiKTtcbiAgICAgICAgXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUgJiYgIXB1YmxpY2RpcikgeyAvLyBSZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3JcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4od29ya2RpciwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbGVuYW1lICYmIHB1YmxpY2Rpcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHB1YmxpY0Jhc2UgPSBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXBhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSwgZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1ZGlvRGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiBcblxuICAgICAgICAvKipcbiAgICAgICAgICogQVNZTkMgR0VUIEZJTEUtTElTVCBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGlmIHNldCB0aGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyByZXR1cm5lZFxuICAgICAgICAgKi8gXG4gICAgICAgIGlwY01haW4uaGFuZGxlKCdnZXRmaWxlc2FzeW5jJywgYXN5bmMgKGV2ZW50LCBmaWxlbmFtZSwgYXVkaW89ZmFsc2UsIGRvY3g9ZmFsc2UpID0+IHsgICBcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG5cbiAgICAgICAgICAgIGlmIChmaWxlbmFtZSkgeyAvL3JldHVybiBjb250ZW50IG9mIHNwZWNpZmljIGZpbGUgYXMgc3RyaW5nIChodG1sKSB0byByZXBsYWNlIGluIGVkaXRvcilcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlJlY2VpdmVkIGFyZ3VtZW50czpcIiwgZmlsZW5hbWUsIGF1ZGlvLCBkb2N4KTtcblxuICAgICAgICAgICAgICAgIGxldCBmaWxlcGF0aCA9IHBhdGguam9pbih3b3JrZGlyLGZpbGVuYW1lKVxuXG4gICAgICAgICAgICAgICAgaWYgKGF1ZGlvID09IHRydWUpeyAvLyBhdWRpbyBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhdWRpb0RhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkb2N4KXsgIC8vb2ZmaWNlIG9wZW4geG1sIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IG1hbW1vdGguY29udmVydFRvSHRtbCh7cGF0aDogZmlsZXBhdGh9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7ICAgLy9iYWsgZmlsZVxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZXBhdGgsICd1dGY4JylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHsgIC8vIHJldHVybiBmaWxlIGxpc3Qgb2YgZXhhbSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya2RpcikpeyBmcy5ta2RpclN5bmMod29ya2RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7ICB9IC8vZG8gbm90IGNyYXNoIGlmIHRoZSBkaXJlY3RvcnkgaXMgZGVsZXRlZCBhZnRlciB0aGUgYXBwIGlzIHN0YXJ0ZWQgXl5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGZpbGVsaXN0ID0gIGZzLnJlYWRkaXJTeW5jKHdvcmtkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihkaXJlbnQgPT4gZGlyZW50LmlzRmlsZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChkaXJlbnQgPT4gZGlyZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaWxlcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgIGZpbGVsaXN0LmZvckVhY2goIGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1vZGlmaWVkID0gZnMuc3RhdFN5bmMoICAgcGF0aC5qb2luKHdvcmtkaXIsZmlsZSkgICkubXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtb2QgPSBtb2RpZmllZC5nZXRUaW1lKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICAocGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBkZlwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwicGRmXCIsIG1vZDogbW9kfSkgICB9ICAgICAgICAgLy9wZGZcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuYmFrXCIpeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJiYWtcIiwgbW9kOiBtb2R9KSAgIH0gICAvLyBlZGl0b3J8IGJhY2t1cCBmaWxlIHRvIHJlcGxhY2UgZWRpdG9yIGNvbnRlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuZG9jeFwiKXsgZmlsZXMucHVzaCgge25hbWU6IGZpbGUsIHR5cGU6IFwiZG9jeFwiLCBtb2Q6IG1vZH0pICAgfSAgIC8vIGVkaXRvcnwgY29udGVudCBmaWxlIChmcm9tIHRlYWNoZXIpIHRvIHJlcGxhY2UgY29udGVudCBhbmQgY29udGludWUgd3JpdGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAgKHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5nZ2JcIil7IGZpbGVzLnB1c2goIHtuYW1lOiBmaWxlLCB0eXBlOiBcImdnYlwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gZ2VvZ2VicmFcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIubXAzXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLm9nZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi53YXZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJhdWRpb1wiLCBtb2Q6IG1vZH0pICAgfSAgLy8gYXVkaW9cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgIChwYXRoLmV4dG5hbWUoZmlsZSkudG9Mb3dlckNhc2UoKSA9PT0gXCIuanBnXCIgfHwgcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkgPT09IFwiLnBuZ1wiIHx8IHBhdGguZXh0bmFtZShmaWxlKS50b0xvd2VyQ2FzZSgpID09PSBcIi5naWZcIiApeyBmaWxlcy5wdXNoKCB7bmFtZTogZmlsZSwgdHlwZTogXCJpbWFnZVwiLCBtb2Q6IG1vZH0pICAgfSAgLy8gaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubnVtYmVyT2ZGaWxlcyA9IGZpbGVsaXN0Lmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0ZmlsZXNhc3luYzogJHtlcnJ9YCk7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFTWU5DIEdFVCBCQUNLVVAgRklMRSBmcm9tIGV4YW1kaXJlY3RvcnlcbiAgICAgICAgICogQHBhcmFtIGZpbGVuYW1lIGZpbGVuYW1lIHdpdGhvdXRcbiAgICAgICAgICovIFxuICAgICAgICBpcGNNYWluLmhhbmRsZSgnZ2V0YmFja3VwZmlsZScsIGFzeW5jIChldmVudCwgZmlsZW5hbWUpID0+IHsgICBcbiAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogUmVxdWVzdCByZWNlaXZlZCBmb3IgZmlsZW5hbWU6ICR7ZmlsZW5hbWV9YClcbiAgICAgICAgICAgIGNvbnN0IHdvcmtkaXIgPSBwYXRoLmpvaW4oY29uZmlnLmV4YW1kaXJlY3RvcnksXCIvXCIpXG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUpIHsgLy9yZXR1cm4gY29udGVudCBvZiBzcGVjaWZpYyBmaWxlIGFzIHN0cmluZyAoaHRtbCkgdG8gcmVwbGFjZSBpbiBlZGl0b3IpXG4gICAgICAgICAgICAgICAgbGV0IGZpbGVwYXRoID0gcGF0aC5qb2luKHdvcmtkaXIsZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgbG9nLmluZm8oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBGdWxsIGZpbGUgcGF0aDogJHtmaWxlcGF0aH1gKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlcGF0aCkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLndhcm4oYGlwY2hhbmRsZXIgQCBnZXRiYWNrdXBmaWxlOiBiYWNrdXAgZmlsZSBub3QgZm91bmQ6ICR7ZmlsZXBhdGh9YCk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogYmFja3VwIGZpbGUgZXhpc3RzLCByZWFkaW5nIGNvbnRlbnRgKVxuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IGZzLnJlYWRGaWxlU3luYyhmaWxlcGF0aCwgJ3V0ZjgnKVxuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IFN1Y2Nlc3NmdWxseSByZWFkIGJhY2t1cCBmaWxlLCBjb250ZW50IGxlbmd0aDogJHtkYXRhLmxlbmd0aH1gKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcihgaXBjaGFuZGxlciBAIGdldGJhY2t1cGZpbGU6IEVycm9yIHJlYWRpbmcgYmFja3VwIGZpbGU6ICR7ZXJyfWApOyBcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogRXJyb3Igc3RhY2s6ICR7ZXJyLnN0YWNrfWApXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0YmFja3VwZmlsZTogbm8gZmlsZW5hbWUgcHJvdmlkZWRgKTsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGlwY01haW4ub24oJ3JlbG9hZC11cmwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuV2luZG93SGFuZGxlci5jcmVhdGVFYXN0ZXJXaW4oKVxuICAgICAgICB9KTtcblxuICAgICAgICAgLyoqXG4gICAgICAgICAqIEFwcGVuZCBQcmludFJlcXVlc3QgdG8gY2xpZW50aW5mbyAgXG4gICAgICAgICAqLyBcbiAgICAgICAgaXBjTWFpbi5vbignc2VuZFByaW50UmVxdWVzdCcsIChldmVudCkgPT4geyAgIFxuICAgICAgICAgICAgdGhpcy5tdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5wcmludHJlcXVlc3QgPSB0cnVlICAvL3NldCB0aGlzIHRvIGZhbHNlIGFmdGVyIHRoZSByZXF1ZXN0IGxlZnQgdGhlIGNsaWVudCB0byBwcmV2ZW50IGRvdWJsZSB0cmlnZ2VyaW5nXG4gICAgICAgICAgICBldmVudC5yZXR1cm5WYWx1ZSA9IHRydWVcbiAgICAgICAgfSlcbiAgICAgXG4gICAgICAgIGlwY01haW4ub24oJ2dldC1jcHUtaW5mbycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucmV0dXJuVmFsdWUgPSB0aGlzLmlzVmlydHVhbE1hY2hpbmUoKVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldC13bGFuLWluZm8nLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdsYW5JbmZvID0gYXdhaXQgZ2V0V2xhbkluZm8oKTtcbiAgICAgICAgICAgIHJldHVybiB3bGFuSW5mbztcbiAgICAgICAgfSk7XG5cblxuICAgICAgICBcbiAgICAgICAgLy8gTmV3IGhhbmRsZXIgdG8gZ2V0IFBERiBmcm9tIHB1YmxpYyBkaXJlY3RvcnkgZm9yIGZyb250ZW5kIHBhcnNpbmdcbiAgICAgICAgaXBjTWFpbi5oYW5kbGUoJ2dldFBkZkZyb21QdWJsaWMnLCBhc3luYyAoZXZlbnQsIHBkZkZpbGVuYW1lICkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBHZXQgZGlyZWN0b3J5IG5hbWUgaW4gRVNNXG4gICAgICAgICAgICAgICAgY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgcGRmUGF0aDtcbiAgICAgICAgICAgICAgICBwZGZQYXRoID0gcGF0aC5qb2luKHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlLCBwZGZGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBkZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgZ2V0UGRmRnJvbVB1YmxpYzogUERGIG5vdCBmb3VuZCBhdDogJHtwZGZQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBkZlBhdGgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoYGlwY2hhbmRsZXIgQCBnZXRQZGZGcm9tUHVibGljOiBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuICAgIGlzVmlydHVhbE1hY2hpbmUoKSB7XG4gICAgICAgIGNvbnN0IFZFTkRPUlMgPSAvKG9yYWNsZXx2aXJ0dWFsYm94fHZtd2FyZXxrdm18cWVtdXx4ZW58aW5ub3Rla3xwYXJhbGxlbHN8bWljcm9zb2Z0fGh5cGVyLXZ8Ymh5dmV8cmVkIGhhdHxyZWRoYXR8Ym9jaHN8Ymh5dmV8b3BlbnN0YWNrfGNsb3VkfGFtYXpvbnxnb29nbGV8YXp1cmUpL2kgLy8gY29tbW9uIFZNIGlkc1xuICAgICAgICBjb25zdCB3YXJuQW5kUmV0dXJuID0gcmVhc29uID0+IHtcbiAgICAgICAgICAgIGxvZy53YXJuKGBpcGNoYW5kbGVyIEAgaXNWaXJ0dWFsTWFjaGluZTogVmVyZGFjaHQgYXVmIFZNIC0gJHtyZWFzb259YClcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tIExpbnV4IC0tLS0tLS0tLS1cbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3B1aW5mbyA9IHJlYWRGaWxlU3luYygnL3Byb2MvY3B1aW5mbycsICd1dGY4JykgICAgICAvLyBDUFUgZmxhZ3NcbiAgICAgICAgICAgIGlmICgvXmZsYWdzLipcXGJoeXBlcnZpc29yXFxiL20udGVzdChjcHVpbmZvKSkgcmV0dXJuIHdhcm5BbmRSZXR1cm4oJ2h5cGVydmlzb3IgZmxhZyBpbiAvcHJvYy9jcHVpbmZvJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBbXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9zeXNfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL3Byb2R1Y3RfbmFtZScsXG4gICAgICAgICAgICAgICcvc3lzL2NsYXNzL2RtaS9pZC9wcm9kdWN0X3ZlcnNpb24nLFxuICAgICAgICAgICAgICAnL3N5cy9jbGFzcy9kbWkvaWQvYm9hcmRfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2Jpb3NfdmVuZG9yJyxcbiAgICAgICAgICAgICAgJy9zeXMvY2xhc3MvZG1pL2lkL2NoYXNzaXNfdmVuZG9yJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgZG1pID0gZmlsZXMubWFwKHAgPT4geyB0cnkgeyByZXR1cm4gcmVhZEZpbGVTeW5jKHAsICd1dGY4JykgfSBjYXRjaCB7IHJldHVybiAnJyB9IH0pLmpvaW4oJyAnKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChkbWkpKSByZXR1cm4gd2FybkFuZFJldHVybignRE1JLVZlbmRvci1NYXRjaCcpXG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdzeXN0ZW1kLWRldGVjdC12aXJ0IC1xJywgeyBzdGRpbzogJ2lnbm9yZScgfSkgICAgLy8gZXhpdCAwID0+IFZNXG4gICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignc3lzdGVtZC1kZXRlY3QtdmlydCBtZWxkZXQgVmlydHVhbGlzaWVydW5nJylcbiAgICAgICAgICB9IGNhdGNoIHt9XG5cblxuICAgICAgICAgIC8vIFByXHUwMEZDZmUgYXVmIFFFTVUtUHJvemVzc2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPSBleGVjU3luYygncHMgYXV4IHwgZ3JlcCAtaSBxZW11JywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAocHMuaW5jbHVkZXMoJ3FlbXUnKSAmJiAhcHMuaW5jbHVkZXMoJ2dyZXAnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIGxcdTAwRTR1ZnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0gV2luZG93cyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHMgPVxuICAgICAgICAgICAgICAgICdwb3dlcnNoZWxsIC1Ob1Byb2ZpbGUgLUNvbW1hbmQgXCIoR2V0LUNpbUluc3RhbmNlIFdpbjMyX0NvbXB1dGVyU3lzdGVtIHwgRm9yRWFjaC1PYmplY3QgeyAkXy5NYW51ZmFjdHVyZXIsICRfLk1vZGVsIH0pIC1qb2luIFxcJyBcXCdcIidcbiAgICAgICAgICAgIGNvbnN0IGJhc2ljID0gZXhlY1N5bmMocHMsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS50cmltKCkgICAgLy8gbWFudWZhY3R1cmVyICsgbW9kZWxcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3QoYmFzaWMpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL01vZGVsbCBwYXNzdCB6dSBWTScpXG4gICAgICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwc1JvYnVzdCA9XG4gICAgICAgICAgICAgICAgJ3Bvd2Vyc2hlbGwgLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiRvPUAoKTsnICtcbiAgICAgICAgICAgICAgICAndHJ5eyRjcz1HZXQtQ2ltSW5zdGFuY2UgV2luMzJfQ29tcHV0ZXJTeXN0ZW07JG8rPUAoJGNzLk1hbnVmYWN0dXJlciwkY3MuTW9kZWwpfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskYmI9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0Jhc2VCb2FyZDskbys9QCgkYmIuTWFudWZhY3R1cmVyLCRiYi5Qcm9kdWN0KX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICd0cnl7JGJpb3M9R2V0LUNpbUluc3RhbmNlIFdpbjMyX0JJT1M7JG8rPUAoJGJpb3MuU01CSU9TQklPU1ZlcnNpb24pfWNhdGNoe307JyArXG4gICAgICAgICAgICAgICAgJ3RyeXskY3NwPUdldC1DaW1JbnN0YW5jZSBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3Q7JG8rPUAoJGNzcC5OYW1lKX1jYXRjaHt9OycgK1xuICAgICAgICAgICAgICAgICdXcml0ZS1PdXRwdXQgKCgkbyAtam9pbiBcXCcgXFwnKS5UcmltKCkpXCInXG4gICAgICAgICAgICBjb25zdCByb2J1c3QgPSBleGVjU3luYyhwc1JvYnVzdCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLnRyaW0oKVxuICAgICAgICAgICAgaWYgKFZFTkRPUlMudGVzdChyb2J1c3QpKSByZXR1cm4gd2FybkFuZFJldHVybignV2luZG93cyBIZXJzdGVsbGVyL0JJT1MtSW5mb3MgcGFzc2VuIHp1IFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgLy8gWnVzXHUwMEU0dHpsaWNoZSBRRU1VLUVya2VubnVuZyBmXHUwMEZDciBXaW5kb3dzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHFlbXVQcm9jZXNzZXMgPSBleGVjU3luYygndGFza2xpc3QgL0ZJIFwiSU1BR0VOQU1FIGVxIHFlbXUqXCInLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgICAgICBpZiAocWVtdVByb2Nlc3Nlcy5pbmNsdWRlcygncWVtdScpKSByZXR1cm4gd2FybkFuZFJldHVybignUUVNVS1Qcm96ZXNzIHVudGVyIFdpbmRvd3MnKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cblxuICAgICAgICAgLy8gLS0tLS0tLS0tLSBtYWNPUyAtLS0tLS0tLS0tXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGh3TW9kZWwgPSBleGVjU3luYygnc3lzY3RsIC1uIGh3Lm1vZGVsJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG4gICAgICAgICAgICBpZiAoL152aXJ0dWFsL2kudGVzdChod01vZGVsKSB8fCBWRU5ET1JTLnRlc3QoaHdNb2RlbCkpIHJldHVybiB3YXJuQW5kUmV0dXJuKCdtYWNPUyBIYXJkd2FyZW1vZGVsbCBkZXV0ZXQgYXVmIFZNJylcbiAgICAgICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gZXhlY1N5bmMoJ3N5c3RlbV9wcm9maWxlciBTUEhhcmR3YXJlRGF0YVR5cGUnLCB7IGVuY29kaW5nOiAndXRmOCcgfSlcbiAgICAgICAgICAgIGlmIChWRU5ET1JTLnRlc3Qoc3ApKSByZXR1cm4gd2FybkFuZFJldHVybignbWFjT1Mgc3lzdGVtX3Byb2ZpbGVyIG1lbGRldCBWTS1WZW5kb3InKVxuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlICAgICAgIFxuICAgIH1cblxuICAgIGNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpIHtcbiAgICAgICAgY29uc3QgcGFydHNBID0gdmVyc2lvbkEuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgY29uc3QgcGFydHNCID0gdmVyc2lvbkIuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKTtcbiAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1heChwYXJ0c0EubGVuZ3RoLCBwYXJ0c0IubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBudW1BID0gcGFydHNBW2ldIHx8IDA7IC8vIEZhbGxiYWNrIGF1ZiAwLCBmYWxscyBrZWluIFdlcnQgdm9yaGFuZGVuXG4gICAgICAgICAgICBjb25zdCBudW1CID0gcGFydHNCW2ldIHx8IDA7XG4gICAgXG4gICAgICAgICAgICBpZiAobnVtQSA8IG51bUIpIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmIChudW1BID4gbnVtQikgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIFxuICAgIGNvbXBhcmVSZWxlYXNlTnVtYmVycyhzdGF0dXNBLCBzdGF0dXNCKSB7XG4gICAgICAgIGNvbnN0IG51bWJlckEgPSBwYXJzZUludChzdGF0dXNBLm1hdGNoKC9cXGQrLyksIDEwKSB8fCAwO1xuICAgICAgICBjb25zdCBudW1iZXJCID0gcGFyc2VJbnQoc3RhdHVzQi5tYXRjaCgvXFxkKy8pLCAxMCkgfHwgMDtcbiAgICBcbiAgICAgICAgaWYgKG51bWJlckEgPCBudW1iZXJCKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChudW1iZXJBID4gbnVtYmVyQikgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGNvbXBhcmVTb2Z0d2FyZSh2ZXJzaW9uQSwgc3RhdHVzQSwgdmVyc2lvbkIsIHN0YXR1c0IpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkNvbXBhcmlzb24gPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyh2ZXJzaW9uQSwgdmVyc2lvbkIpO1xuICAgICAgICBpZiAodmVyc2lvbkNvbXBhcmlzb24gIT09IDApIHJldHVybiB2ZXJzaW9uQ29tcGFyaXNvbjtcbiAgICBcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcGFyZVJlbGVhc2VOdW1iZXJzKHN0YXR1c0EsIHN0YXR1c0IpO1xuICAgIH1cblxuXG59XG4gXG5leHBvcnQgZGVmYXVsdCBuZXcgSXBjSGFuZGxlcigpXG4iLCAiaW1wb3J0IHtjcmVhdGVJMThufSBmcm9tICd2dWUtaTE4bidcblxuaW1wb3J0IGVuIGZyb20gJy4vZW4uanNvbidcbmltcG9ydCBkZSBmcm9tICcuL2RlLmpzb24nXG5cbmNvbnN0IGkxOG4gPSBjcmVhdGVJMThuKHtcbiAgICBsb2NhbGU6ICdkZScsXG4gICAgZmFsbGJhY2tMb2NhbGU6ICdlbicsXG4gICAgbGVnYWN5OiBmYWxzZSxcbiAgICBtZXNzYWdlczoge1xuICAgICAgICBlbixcbiAgICAgICAgZGVcbiAgICAgIH1cbiAgfSlcblxuZXhwb3J0IGRlZmF1bHQgaTE4biIsICJ7IFxuICAgIFwibWFpblwiOiB7XG4gICAgICAgIFwidHJheVwiOiB7XG4gICAgICAgICAgICBcInJlc3RvcmVcIjogXCJSZXN0b3JlXCIsXG4gICAgICAgICAgICBcImRpc2Nvbm5lY3RcIjogXCJEaXNjb25uZWN0XCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJFeGl0XCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29yZFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiRXhhbXNcIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIllvdXIgbmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyIGFkZHJlc3NcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiRXhhbSBOYW1lXCIsXG4gICAgICAgIFwiYWR2YW5jZWRcIjogXCJhZHZhbmNlZFwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcInNpbXBsZVwiLFxuICAgICAgICBcIm5hbWVcIjogXCJOYW1lXCIsXG4gICAgICAgIFwicmVnaXN0ZXJcIjogXCJyZWdpc3RlclwiLFxuICAgICAgICBcInJlZ2lzdGVyaW5nXCI6IFwicmVnaXN0ZXJpbmcuLi5cIixcbiAgICAgICAgXCJyZWdpc3RlcmVkXCI6IFwicmVnaXN0ZXJlZFwiLFxuICAgICAgICBcImNvbm5lY3RlZFwiOiBcImNvbm5lY3RlZFwiLFxuICAgICAgICBcImRpc2Nvbm5lY3RlZFwiOiBcImRpc2Nvbm5lY3RlZFwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgb24gc2VydmVyISBcXG5cXG5QbGVhc2Ugd2FpdCBmb3IgdGhlIGFjdGl2YXRpb24gb2YgdGhlIGV4YW0gbW9kZSBieSB0aGUgdGVhY2hlciFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwic2VhcmNoIHN0YXJ0ZWRcIixcbiAgICAgICAgXCJub3B3XCI6IFwid3JvbmcgdXNlcm5hbWUgb3IgcGluXCIsXG4gICAgICAgIFwibm91c2VyXCI6XCJubyB1c2VybmFtZSBnaXZlblwiLFxuICAgICAgICBcIm5vaXBcIjogXCJTZXJ2ZXJhZGRyZXNzZSBvZGVyIEV4YW1uYW1lIG1pc3NpbmdcIixcbiAgICAgICAgXCJvZmZsaW5lXCI6IFwiTm8gTmV0d29yayBDb25uZWN0aW9uXCIsXG4gICAgICAgIFwibm9waW5cIjogXCJubyBwaW5jb2RlIGdpdmVuXCIsXG4gICAgICAgIFwidW5yZWFjaGFibGVcIjpcIlNlcnZlciBBUEkgdW5yZWFjaGFibGVcIixcbiAgICAgICAgXCJ0aW1lb3V0XCI6XCJUaW1lb3V0ISBFeGFtLVRlYWNoZXIgaXMgYmVoaW5kIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiTm8gVGVhY2hlciBBUEkgZm91bmQgb24gdGhlIGdpdmVuIGFkZHJlc3NcIixcbiAgICAgICAgXCJiaWxkdW5nc3BvcnRhbFwiOlwiQmlsZHVuZ3Nwb3J0YWxcIixcbiAgICAgICAgXCJsb2NhbExvY2tkb3duXCI6XCJMb2NhbCBsb2NrZG93blwiLFxuICAgICAgICBcIm1hbnVhbHNlYXJjaFwiOlwiTWFudWFsIHNlYXJjaFwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIk5vIGV4YW1zIGZvdW5kXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbG9nb3V0P1wiLFxuICAgICAgICBcImRlXCI6IFwiR2VybWFuXCIsXG4gICAgICAgIFwiZW5cIjpcIkVuZ2xpc2hcIixcbiAgICAgICAgXCJlc1wiOlwiU3BhbmlzaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmVuY2hcIixcbiAgICAgICAgXCJpdFwiOlwiSXRhbGlhblwiLFxuICAgICAgICBcInNsXCI6XCJTbG92ZW5pYW5cIixcbiAgICAgICAgXCJub25lXCI6IFwibm9uZVwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJTcGVsbGNoZWNrXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJhY3RpdmF0ZVwiLFxuICAgICAgICBcInN1Z2dlc3RcIjpcIlNob3cgc3VnZ2VzdGlvbnNcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrY2hvb3NlXCI6IFwiUGxlYXNlIGNob29zZSBhIGxhbmd1YWdlXCIsXG4gICAgICAgIFwibGFuZ1wiOiBcIkxhbmd1YWdlc1wiLFxuICAgICAgICBcIm1hdGhcIjogXCJNYXRoZW1hdGljc1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiU2VsZWN0IGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm91dGRhdGVkXCI6IFwiVmVyc2lvblwiLFxuICAgICAgICBcIm91dGRhdGVkaW5mb1wiOiBcIlBsZWFzZSBpbnN0YWxsIHRoZSBzYW1lIHZlcnNpb24gYXMgdGhlIGV4YW0gc2VydmVyIVwiLFxuICAgICAgICBcIndsYW5Ob3Blcm1pc3Npb25zVGl0bGVcIjogXCJMb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVkXCIsXG4gICAgICAgIFwid2xhbk5vcGVybWlzc2lvbnNUZXh0XCI6IFwiV2luZG93cyByZXF1aXJlcyBsb2NhdGlvbiBwZXJtaXNzaW9ucyB0byByZXRyaWV2ZSBXTEFOIGluZm9ybWF0aW9uLiBQbGVhc2UgZW5hYmxlIGxvY2F0aW9uIHNlcnZpY2VzIGluIFByaXZhY3kgJiBTZWN1cml0eSBzZXR0aW5ncy5cIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwidG9rZW4gaXMgbm90IHZhbGlkXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcInRva2VuIGlzIHZhbGlkXCIsXG4gICAgICAgIFwic3RhdGVjaGFuZ2VcIjogXCJzYWZlIGV4YW0gc3RhdHVzIGNoYW5nZWRcIixcbiAgICAgICAgXCJhbHJlYWR5cmVnaXN0ZXJlZFwiOiBcInN0dWRlbnQgYWxyZWFkeSByZWdpc3RlcmVkXCIsXG4gICAgICAgIFwiZXhhbWluaXRcIjpcInN0YXJ0ZWQgc2FmZSBleGFtIG1vZGVcIixcbiAgICAgICAgXCJleGFtZXhpdFwiOlwic3RvcHBlZCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcIm5vZXhhbVwiOiBcInNhZmUgZXhhbSBtb2RlIG5vdCBhY3RpdmVcIixcbiAgICAgICAgXCJjbGllbnR1bnN1YnNjcmliZVwiOiBcInN0dWRlbnQgcmVtb3ZlZCBmcm9tIHNlcnZlclwiXG4gICAgICAgXG4gICAgfSxcbiAgICBcImRhdGFcIjoge1xuICAgICAgICBcInRva2Vubm90dmFsaWRcIjogXCJ0b2tlbiBpcyB2YWxpZFwiLFxuICAgICAgICBcImZpbGVyZWNlaXZlZFwiOiBcImZpbGVzIHJlY2VpdmVkXCIsXG4gICAgICAgIFwiZmlsZXN0b3JlZFwiOiBcImZpbGVzIHN0b3JlZFwiLFxuICAgICAgICBcIm5vZmlsZXNcIjogXCJubyBmaWxlcyB3ZXJlIHVwbG9hZGVkXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiZmlsZSBlcnJvclwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJwbGVhc2UgY2hlY2sgaWYgdGhlICdFWEFNLVNUVURFTlQnIGRpcmVjdG9yeSBpcyB3cml0ZWFibGUgYW5kIGhhcyBlbm91Z2ggc3BhY2VcIixcbiAgICAgICAgXCJmaWxlZXJyb3JpbmZvMlwiOiBcIkEgbG9jYWwgYmFja3VwIGNvdWxkIG5vdCBiZSBjcmVhdGVkLiBQbGVhc2UgdXNlIHRoZSBtYW51YWwgc3VibWlzc2lvbiBvcHRpb24uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJkb24ndCBzaG93IGFnYWluXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBmb3VuZFwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIkdldCBtYXRlcmlhbHNcIixcbiAgICAgICAgXCJzZW5kZmluYWxleGFtXCI6IFwiU2VuZCBmaW5hbCBleGFtXCIsXG4gICAgICAgIFwiZmluYWxzdWJtaXRcIjogXCJGaW5hbCBzdWJtaXRcIixcbiAgICAgICAgXCJtYXRlcmlhbHNcIjogXCJNYXRlcmlhbHM6XCIsXG4gICAgICAgIFwibG9jYWxmaWxlc1wiOiBcIkxvY2FsIGZpbGVzOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIlVwZGF0ZVwiLFxuICAgICAgICBcInNwbGl0dmlld1wiOiBcIlNwbGl0dmlld1wiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIllvdSBoYXZlIGxlZnQgdGhlIHNhZmUgZXhhbSBtb2RlIVwiLFxuICAgICAgICBcInRlbGxzb21lb25lXCI6IFwiUGxlYXNlIGluZm9ybSBhIHRlYWNoZXIhXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiRG8geW91IHdhbnQgdG8gcmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGUgZWRpdG9yIHdpdGggdGhlIGNvbnRlbnQgb2YgXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiP1wiLFxuICAgICAgICBcImNhbmNlbFwiOlwiQ2FuY2VsXCIsXG4gICAgICAgIFwicmVwbGFjZVwiOlwiUmVwbGFjZVwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwIGZpbGUgY291bGQgbm90IGJlIHJlYWRcIixcbiAgICAgICAgXCJiYWNrdXBsb2FkZWRcIjogXCJCYWNrdXAgc3VjY2Vzc2Z1bGx5IGxvYWRlZFwiLFxuICAgICAgICBcImJhY2t1cGVycm9yXCI6IFwiRXJyb3IgbG9hZGluZyBiYWNrdXAgZmlsZVwiLFxuICAgICAgICBcImVycm9yXCI6IFwiRXJyb3JcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiU3VjY2Vzc1wiLFxuICAgICAgICBcImNoYXJzXCI6IFwiY2hhcnNcIixcbiAgICAgICAgXCJ3b3Jkc1wiOiBcIndvcmRzXCIsXG4gICAgICAgIFwicmVjb25uZWN0XCI6IFwicmVjb25uZWN0XCIsXG4gICAgICAgIFwidW5sb2NrXCI6IFwidW5sb2NrXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkV4aXQgc2FmZSBleGFtIG1vZGU/XCIsXG4gICAgICAgIFwiZXhpdGtpb3NrXCI6IFwiRG8gbm90IGxlYXZlIHNhZmUgZXhhbSBtb2RlIHdpdGhvdXQgcGVybWlzc2lvbi5cIixcbiAgICAgICAgXCJpbmZvXCI6IFwiSWYgdGhpcyBwcm9jZXNzIGZhaWxzIHVubG9jayBhbmQgdHJ5IGFnYWluIVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiQ3JlYXRpbmcgYmFja3VwXCIsXG4gICAgICAgIFwic2F2ZWRjbGlwXCI6IFwiQ3JlYXRpbmcgYmFja3VwIGFuZCBjbGlwYm9hcmQgY29weVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJMZWF2aW5nIEV4YW0gbW9kZVwiLFxuICAgICAgICBcImJhY2t1cFwiOiBcImJhY2t1cFwiLFxuICAgICAgICBcInVuZG9cIjpcInVuZG9cIixcbiAgICAgICAgXCJyZWRvXCI6XCJyZWRvXCIsXG4gICAgICAgIFwiY2xlYXJcIjpcImNsZWFyXCIsXG4gICAgICAgIFwiYm9sZFwiOlwiYm9sZFwiLFxuICAgICAgICBcIml0YWxpY1wiOlwiaXRhbGljXCIsXG4gICAgICAgIFwidW5kZXJsaW5lXCI6XCJ1bmRlcmxpbmVcIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiaGVhZGluZzFcIixcbiAgICAgICAgXCJoZWFkaW5nMlwiOlwiaGVhZGluZzJcIixcbiAgICAgICAgXCJoZWFkaW5nM1wiOlwiaGVhZGluZzNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiaGVhZGluZzRcIixcbiAgICAgICAgXCJoZWFkaW5nNVwiOlwiaGVhZGluZzVcIixcbiAgICAgICAgXCJoZWFkaW5nNlwiOlwiaGVhZGluZzZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInN1YnNjcmlwdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJzdXBlcnNjcmlwdFwiLFxuICAgICAgICBcImJ1bGxldGxpc3RcIjpcImJ1bGxldGxpc3RcIixcbiAgICAgICAgXCJsaXN0XCI6XCJsaXN0XCIsXG4gICAgICAgIFwiY29kZWJsb2NrXCI6XCJjb2RlYmxvY2tcIixcbiAgICAgICAgXCJjb2RlXCI6XCJjb2RlXCIsXG4gICAgICAgIFwiYmxvY2txdW90ZVwiOlwiYmxvY2txdW90ZVwiLFxuICAgICAgICBcImxpbmVcIjpcInBhZ2VicmVha1wiLFxuICAgICAgICBcImxlZnRcIjpcImxlZnRcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcImNlbnRlclwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJyaWdodFwiLFxuICAgICAgICBcImp1c3RpZnlcIjpcImp1c3RpZnlcIixcbiAgICAgICAgXCJ0ZXh0Y29sb3JcIjpcInRleHRjb2xvclwiLFxuICAgICAgICBcImxpbmVicmVha1wiOlwibGluZWJyZWFrXCIsXG4gICAgICAgIFwibW9yZVwiOlwibW9yZVwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJpbnNlcnR0YWJsZVwiLFxuICAgICAgICBcImRlbGV0ZXRhYmxlXCI6XCJkZWxldGV0YWJsZVwiLFxuICAgICAgICBcImNvbHVtbmFmdGVyXCI6XCJjb2x1bW5hZnRlclwiLFxuICAgICAgICBcInJvd2FmdGVyXCI6XCJyb3dhZnRlclwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiZGVsY29sdW1uXCIsXG4gICAgICAgIFwiZGVscm93XCI6XCJkZWxyb3dcIixcbiAgICAgICAgXCJtZXJnZW9yc3BsaXRcIjpcIm1lcmdlb3JzcGxpdFwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiaGVhZGVyY29sdW1uXCIsXG4gICAgICAgIFwiaGVhZGVycm93XCI6XCJoZWFkZXJyb3dcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwic2VsZWN0ZWQgd29yZHMvY2hhcnNcIixcbiAgICAgICAgXCJyZXF1ZXN0c2VudFwiOlwicHJpbnQgcmVxdWVzdCBzZW50XCIsXG4gICAgICAgIFwicmVxdWVzdGRlbmllZFwiOlwicHJpbnQgcmVxdWVzdCBkZW5pZWRcIixcbiAgICAgICAgXCJwYXN0ZVwiOlwicGFzdGVcIixcbiAgICAgICAgXCJjb3B5XCI6XCJjb3B5XCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcInNwZWxsY2hlY2tcIixcbiAgICAgICAgXCJzcGVsbGNoZWNrZGVhY3RpdmF0ZVwiOiBcImRlYWN0aXZhdGUgc3BlbGxjaGVja1wiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIlJlbG9hZFwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb3VsZCB5b3UgbGlrZSB0byByZWluaXRpYWxpemUgdGhlIEVkaXRvcj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwia2VlcCBjb250ZW50XCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIkluc2VydCBzcGVjaWFsY2hhcmFjdGVyXCIsXG4gICAgICAgIFwicHJpbnRcIjogXCJwcmludFwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiUGxheSBBdWRpb1wiLFxuICAgICAgICBcInJlYWxseXBsYXlcIjpcIkRvIHlvdSB3YW50IHRvIHBsYXkgdGhlIGF1ZGlvZmlsZT9cIixcbiAgICAgICAgXCJhdWRpb3JlbWFpbmluZ1wiOlwiUmVtYWluaW5nIHBsYXliYWNrczpcIixcbiAgICAgICAgXCJhdWRpb25vdGFsbG93ZWRcIjpcIllvdSBkb24ndCBoYXZlIHRoZSBwZXJtaXNzaW9uIHRvIHBsYXkgdGhpcyBmaWxlIVwiLFxuICAgICAgICBcImluc2VydFwiOlwiSW5zZXJ0IEltYWdlXCIsXG4gICAgICAgIFwiaW5zZXJ0bXVnXCI6XCJJbnNlcnQgTXVnc2hvdFwiLFxuICAgICAgICBcImJpbGR1bmdzcG9ydGFsXCI6XCJCaWxkdW5nc3BvcnRhbFwiLFxuICAgICAgICBcInNlbmRcIjpcIlNlbmQgd29yayB0byB0ZWFjaGVyXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiQ2xvc2VcIixcbiAgICAgICAgXCJzZWN0aW9uU3dpdGNoVGl0bGVcIjogXCJTd2l0Y2ggc2VjdGlvblwiLFxuICAgICAgICBcInNlY3Rpb25Td2l0Y2hUZXh0XCI6IFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHN3aXRjaCB0byB0aGUgbmV3IHNlY3Rpb24/XCIsXG4gICAgICAgIFwibGFuZ19kZVwiOiBcIkdlcm1hblwiLFxuICAgICAgICBcImxhbmdfZW5fZ2JcIjogXCJFbmdsaXNoIChVSylcIixcbiAgICAgICAgXCJsYW5nX2VuX3VzXCI6IFwiRW5nbGlzaCAoVVMpXCIsXG4gICAgICAgIFwibGFuZ19mclwiOiBcIkZyZW5jaFwiLFxuICAgICAgICBcImxhbmdfZXNcIjogXCJTcGFuaXNoXCIsXG4gICAgICAgIFwibGFuZ19pdFwiOiBcIkl0YWxpYW5cIixcbiAgICAgICAgXCJsYW5nX3NsXCI6IFwiU2xvdmVuaWFuXCJcbiAgICB9LFxuICAgIFwibWF0aFwiOiB7XG4gICAgICAgIFwiZXhpdFwiOlwiRXhpdCBzYWZlIGV4YW0gbW9kZVwiLFxuICAgICAgICBcImZpbGVuYW1lXCI6IFwiRmlsZW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJQbGVhc2UgZW50ZXIgb25seSBsZXR0ZXJzIGFuZCBudW1iZXJzIHdpdGhvdXQgc3BlY2lhbCBjaGFyYWN0ZXJzXCIsXG4gICAgICAgIFwiY2xlYXJcIjogXCJjbGVhciBjb250ZW50P1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJFcnJvclwiLFxuICAgICAgICBcIm5vcGRmXCI6IFwiTm8gdmFsaWQgUERGIEZpbGVcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiV3JvbmcgcGFzc3dvcmRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiUmVsb2FkIHdlYnZpZXdcIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIlBvc3NpYmx5IHNjYW5uZWQgUERGXCIsXG4gICAgICAgIFwid2FybmluZ1ByZWZpeFwiOiBcIk9uXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJsZXNzIHRoYW4gMiBpbnRlcmFjdGl2ZSBmb3JtIGZpZWxkcyB3ZXJlIGZvdW5kLlwiLFxuICAgICAgICBcIndhcm5pbmdNZXNzYWdlMlwiOiBcIlRoaXMgaW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIHNjYW5uZWQgUERGIHRoYXQgZG9lcyBub3QgY29udGFpbiBhY3RpdmUgZm9ybSBmaWVsZHMgb3IgdGFibGVzLlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJVbmRlcnN0b29kXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlBhZ2VcIixcbiAgICAgICAgXCJwYWdlc1wiOiBcIlBhZ2VzXCJcbiAgICB9LFxuICAgIFwiZGFzaGJvYXJkXCI6IHtcbiAgICAgICAgXCJyZXRyeVwiOiBcIlJldHJ5XCJcbiAgICB9XG59XG4iLCAieyBcbiAgICBcIm1haW5cIjoge1xuICAgICAgICBcInRyYXlcIjoge1xuICAgICAgICAgICAgXCJyZXN0b3JlXCI6IFwiV2llZGVyaGVyc3RlbGxlblwiLFxuICAgICAgICAgICAgXCJkaXNjb25uZWN0XCI6IFwiVmVyYmluZHVuZyB0cmVubmVuXCIsXG4gICAgICAgICAgICBcImV4aXRcIjogXCJCZWVuZGVuXCJcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJzdHVkZW50XCIgOiB7XG4gICAgICAgIFwicGFzc3dvcmRcIjogXCJQYXNzd29ydFwiLFxuICAgICAgICBcImV4YW1zXCI6IFwiUHJcdTAwRkNmdW5nZW5cIixcbiAgICAgICAgXCJ1c2VybmFtZVwiOiBcIkRlaW4gTmFtZVwiLFxuICAgICAgICBcInBpblwiOiBcIlBpbmNvZGVcIixcbiAgICAgICAgXCJpcFwiOlwiU2VydmVyLUFkcmVzc2VcIixcbiAgICAgICAgXCJleGFtbmFtZVwiOlwiUHJcdTAwRkNmdW5nc25hbWVcIixcbiAgICAgICAgXCJhZHZhbmNlZFwiOiBcImZvcnRnZXNjaHJpdHRlblwiLFxuICAgICAgICBcInNpbXBsZVwiOiBcImVpbmZhY2hcIixcbiAgICAgICAgXCJuYW1lXCI6IFwiTmFtZVwiLFxuICAgICAgICBcInJlZ2lzdGVyXCI6IFwiYW5tZWxkZW5cIixcbiAgICAgICAgXCJyZWdpc3RlcmluZ1wiOiBcIm1lbGRlIGFuLi4uXCIsXG4gICAgICAgIFwicmVnaXN0ZXJlZFwiOiBcImFuZ2VtZWxkZXRcIixcbiAgICAgICAgXCJjb25uZWN0ZWRcIjogXCJ2ZXJidW5kZW5cIixcbiAgICAgICAgXCJkaXNjb25uZWN0ZWRcIjogXCJWZXJiaW5kdW5nIHVudGVyYnJvY2hlblwiLFxuICAgICAgICBcInJlZ2lzdGVyZWRpbmZvXCI6IFwiU2llIGhhYmVuIHNpY2ggZXJmb2xncmVpY2ggYW0gU2VydmVyIHJlZ2lzdHJpZXJ0ISBcXG5cXG5CaXR0ZSB3YXJ0ZW4gU2llIGF1ZiBkaWUgQWt0aXZpZXJ1bmcgZGVzIFByXHUwMEZDZnVuZ3Ntb2R1cyBkdXJjaCBkaWUgTGVocnBlcnNvbiFcIixcbiAgICAgICAgXCJzdGFydGVkXCI6IFwiU3VjaGUgZ2VzdGFydGV0XCIsXG4gICAgICAgIFwibm9wd1wiOiBcIkZhbHNjaGVyIEJlbnV0emVybmFtZSBvZGVyIFBpbmNvZGVcIixcbiAgICAgICAgXCJub3VzZXJcIjogXCJCZW51dHplcm5hbWUgZmVobHRcIixcbiAgICAgICAgXCJub2lwXCI6IFwiU2VydmVyYWRyZXNzZSBvZGVyIFByXHUwMEZDZnVuZ3NuYW1lIGZlaGx0XCIsXG4gICAgICAgIFwib2ZmbGluZVwiOiBcIktlaW5lIE5ldHp3ZXJrdmVyYmluZHVuZ1wiLFxuICAgICAgICBcIm5vcGluXCI6IFwiUGluY29kZSBmZWhsdFwiLFxuICAgICAgICBcInVucmVhY2hhYmxlXCI6IFwiU2VydmVyIEFQSSBuaWNodCBlcnJlaWNoYmFyLlwiLFxuICAgICAgICBcInRpbWVvdXRcIjpcIlRpbWVvdXQhIEV4YW0tVGVhY2hlciBiZWZpbmRldCBzaWNoIG1cdTAwRjZnbGljaGVyd2Vpc2UgaGludGVyIGVpbmVyIEZpcmV3YWxsLlwiLFxuICAgICAgICBcIm5vYXBpXCI6IFwiS2VpbmUgUHJcdTAwRkNmdW5nc3NlcnZlciBhbiBhbmdlZ2ViZW5lciBBZHJlc3NlXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwibG9jYWxMb2NrZG93blwiOlwiTG9rYWwgYWJzcGVycmVuXCIsXG4gICAgICAgIFwibWFudWFsc2VhcmNoXCI6XCJNYW51ZWxsIHN1Y2hlblwiLFxuICAgICAgICBcIm5vZXhhbXNcIjpcIktlaW5lIFByXHUwMEZDZnVuZ2VuIGdlZnVuZGVuXCIsXG4gICAgICAgIFwibG9nb3V0QmlQXCI6XCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHNpY2ggYWJtZWxkZW4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImRlXCI6IFwiRGV1dHNjaFwiLFxuICAgICAgICBcImVuXCI6XCJFbmdsaXNjaFwiLFxuICAgICAgICBcImVzXCI6XCJTcGFuaXNjaFwiLFxuICAgICAgICBcImZyXCI6XCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwiaXRcIjpcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwic2xcIjpcIlNsb3dlbmlzY2hcIixcbiAgICAgICAgXCJub25lXCI6IFwiYW5kZXJlXCIsXG4gICAgICAgIFwic3BlbGxjaGVja1wiOiBcIlJlY2h0c2NocmVpYmhpbGZlXCIsXG4gICAgICAgIFwiYWN0aXZhdGVcIjogXCJha3RpdmllcmVuXCIsXG4gICAgICAgIFwic3VnZ2VzdFwiOlwiVm9yc2NobFx1MDBFNGdlIHplaWdlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tjaG9vc2VcIjogXCJCaXR0ZSB3XHUwMEU0aGxlbiBTaWUgZWluZSBTcHJhY2hlIGZcdTAwRkNyIGRpZSBQclx1MDBGQ2Z1bmdcIixcbiAgICAgICAgXCJsYW5nXCI6IFwiU3ByYWNoZW5cIixcbiAgICAgICAgXCJtYXRoXCI6IFwiTWF0aGVtYXRpa1wiLFxuICAgICAgICBcInNlbGVjdGV4YW1tb2RlXCI6IFwiUHJcdTAwRkNmdW5nc21vZHVzIGF1c3dcdTAwRTRobGVuXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRcIjogXCJWZXJzaW9uXCIsXG4gICAgICAgIFwib3V0ZGF0ZWRpbmZvXCI6IFwiQml0dGUgaW5zdGFsbGllcmVuIHNpZSBkaWUgc2VsYmUgVmVyc2lvbiB3aWUgYW0gUHJcdTAwRkNmdW5nc3NlcnZlciFcIixcbiAgICAgICAgXCJ3bGFuTm9wZXJtaXNzaW9uc1RpdGxlXCI6IFwiU3RhbmRvcnRiZXJlY2h0aWd1bmcgZXJmb3JkZXJsaWNoXCIsXG4gICAgICAgIFwid2xhbk5vcGVybWlzc2lvbnNUZXh0XCI6IFwiV2luZG93cyBiZW5cdTAwRjZ0aWd0IFN0YW5kb3J0YmVyZWNodGlndW5nZW4sIHVtIFdMQU4tSW5mb3JtYXRpb25lbiBhYnp1cnVmZW4uIEJpdHRlIGFrdGl2aWVyZW4gU2llIGRpZSBQb3NpdGlvbnNkaWVuc3RlIGluIGRlbiBEYXRlbnNjaHV0ei0gdW5kIFNpY2hlcmhlaXRzZWluc3RlbGx1bmdlbi5cIlxuICAgIH0sXG4gICAgXCJjb250cm9sXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwidG9rZW52YWxpZFwiOiBcImRhcyB0b2tlbiBpc3QgZ1x1MDBGQ2x0aWdcIixcbiAgICAgICAgXCJzdGF0ZWNoYW5nZVwiOiBcIlZlcnRyYXVlbnNzdGVsbHVuZyBnZVx1MDBFNG5kZXJ0XCIsXG4gICAgICAgIFwiYWxyZWFkeXJlZ2lzdGVyZWRcIjogXCJTY2hcdTAwRkNsZXI6aW4gdW50ZXIgZGllc2VtIE5hbWVuIGJlcmVpdHMgYW5nZW1lbGRldFwiLFxuICAgICAgICBcImV4YW1pbml0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGdlc3RhcnRldFwiLFxuICAgICAgICBcImV4YW1leGl0XCI6XCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJub2V4YW1cIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIG5pY2h0IGFrdGl2XCIsXG4gICAgICAgIFwiY2xpZW50dW5zdWJzY3JpYmVcIjogXCJTY2hcdTAwRkNsZXI6aW4gZW50ZmVybnRcIlxuICAgICAgIFxuICAgIH0sXG4gICAgXCJkYXRhXCI6IHtcbiAgICAgICAgXCJ0b2tlbm5vdHZhbGlkXCI6IFwiZGFzIHRva2VuIGlzdCB1bmdcdTAwRkNsdGlnXCIsXG4gICAgICAgIFwiZmlsZXJlY2VpdmVkXCI6IFwiRGF0ZWllbiBlcmhhbHRlblwiLFxuICAgICAgICBcImZpbGVzdG9yZWRcIjogXCJEYXRlaWVuIGdlc3BlaWNoZXJ0XCIsXG4gICAgICAgIFwibm9maWxlc1wiOiBcIkVzIHd1cmRlbiBrZWluZSBEYXRlaWVuIGhvY2hnZWxhZGVuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yXCI6IFwiRmVobGVyIGJlaW0gU2NocmVpYmVuIGRlciBEYXRlaVwiLFxuICAgICAgICBcImZpbGVlcnJvcmluZm9cIjogXCJCaXR0ZSBzdGVsbGVuIFNpZSBzaWNoZXIsIGRhc3MgZGFzICdFWEFNLVNUVURFTlQnIFZlcnplaWNobmlzIGZcdTAwRkNyIE5leHQtRXhhbSBzY2hyZWliYmFyIGlzdCB1bmQgZ2VuXHUwMEZDZ2VuZCBTcGVpY2hlcnBsYXR6IHZvcmhhbmRlbiBpc3QuXCIsXG4gICAgICAgIFwiZmlsZWVycm9yaW5mbzJcIjogXCJFaW5lIGxva2FsZSBTaWNoZXJ1bmcga29ubnRlIG5pY2h0IGVyc3RlbGx0IHdlcmRlbi4gTnV0emVuIFNpZSBkaWUgbWFudWVsbGUgQWJnYWJlIHVtIElocmUgQXJiZWl0IGRpcmVrdCBhbiBkaWUgTGVocnBlcnNvbiB6dSBzZW5kZW4uXCIsXG4gICAgICAgIFwiZG9udHNob3dcIjogXCJOaWNodCBtZWhyIGFuemVpZ2VuXCJcbiAgICB9LFxuICAgIFwiZWRpdG9yXCI6IHtcbiAgICAgICAgXCJiYWNrdXBmb3VuZFwiOiBcIkJhY2t1cCBnZWZ1bmRlblwiLFxuICAgICAgICBcImdldG1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuIGhvbGVuXCIsXG4gICAgICAgIFwic2VuZGZpbmFsZXhhbVwiOiBcIkZpbmFsZSBBYmdhYmUgYW4gTGVocnBlcnNvbiBzZW5kZW5cIixcbiAgICAgICAgXCJmaW5hbHN1Ym1pdFwiOiBcIkFiZ2FiZVwiLFxuICAgICAgICBcIm1hdGVyaWFsc1wiOiBcIk1hdGVyaWFsaWVuOlwiLFxuICAgICAgICBcInVwZGF0ZVwiOiBcIkFrdHVhbGlzaWVyZW5cIixcbiAgICAgICAgXCJsb2NhbGZpbGVzXCI6IFwiTG9rYWxlIERhdGVpZW46XCIsXG5cbiAgICAgICAgXCJzcGxpdHZpZXdcIjogXCJTcGFsdGVuYW5zaWNodFwiLFxuICAgICAgICBcImxlZnRraW9za1wiOiBcIlNpZSBoYWJlbiBkZW4gYWJnZXNpY2hlcnRlbiBNb2R1cyB2ZXJsYXNzZW4hXCIsXG4gICAgICAgIFwidGVsbHNvbWVvbmVcIjogXCJNZWxkZW4gU2llIHNpY2ggdW1nZWhlbmQgYmVpIGRlciBBdWZzaWNodHNwZXJzb24hXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQxXCI6IFwiV29sbGVuIFNpZSBkZW4gSW5oYWx0IGRlcyBFZGl0b3JzIGR1cmNoIGRlbiBJbmhhbHQgZGVyIERhdGVpXCIsXG4gICAgICAgIFwicmVwbGFjZWNvbnRlbnQyXCI6IFwiZXJzZXR6ZW4/XCIsXG4gICAgICAgIFwiY2FuY2VsXCI6XCJBYmJyZWNoZW5cIixcbiAgICAgICAgXCJyZXBsYWNlXCI6XCJFcnNldHplblwiLFxuICAgICAgICBcImJhY2t1cG5vdGZvdW5kXCI6IFwiQmFja3VwLURhdGVpIGtvbm50ZSBuaWNodCBnZWxlc2VuIHdlcmRlblwiLFxuICAgICAgICBcImJhY2t1cGxvYWRlZFwiOiBcIkJhY2t1cCBlcmZvbGdyZWljaCBnZWxhZGVuXCIsXG4gICAgICAgIFwiYmFja3VwZXJyb3JcIjogXCJGZWhsZXIgYmVpbSBMYWRlbiBkZXIgQmFja3VwLURhdGVpXCIsXG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJzdWNjZXNzXCI6IFwiRXJmb2xnXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCJaZWljaGVuXCIsXG4gICAgICAgIFwid29yZHNcIjogXCJXXHUwMEY2cnRlclwiLFxuICAgICAgICBcInJlY29ubmVjdFwiOiBcIm5ldSB2ZXJiaW5kZW5cIixcbiAgICAgICAgXCJ1bmxvY2tcIjogXCJlbnRzcGVycmVuXCIsXG4gICAgICAgIFwiZXhpdFwiOiBcIkFiZ2VzaWNoZXJ0ZW4gTW9kdXMgYmVlbmRlbj9cIixcbiAgICAgICAgXCJleGl0a2lvc2tcIjogXCJWZXJsYXNzZW4gU2llIGRlbiBhYmdlc2ljaGVydGVuIE1vZHVzIG5pZSBvaG5lIEZyZWlnYWJlIGVpbmVyIExlaHJwZXJzb24uXCIsXG4gICAgICAgIFwiaW5mb1wiOiBcIlNvbGx0ZSBkZXIgVm9yZ2FuZyBmZWhsc2NobGFnZW4gYmVlbmRlbiBTaWUgYml0dGUgZGVuIGFiZ2VzaWNoZXJ0ZW4gTW9kdXMgdW5kIHZlcnN1Y2hlbiBTaWUgZXMgZXJuZXV0IVwiLFxuICAgICAgICBcInNhdmVkXCI6IFwiSWhyZSBBcmJlaXQgd3VyZGUgZXJmb2xncmVpY2ggZ2VzaWNoZXJ0IVwiLFxuICAgICAgICBcInNhdmVkY2xpcFwiOiBcIkRpZSBha3R1ZWxsZSBBcmJlaXQgd2lyZCBnZXNpY2hlcnQgdW5kIGluIGRpZSBad2lzY2hlbmFibGFnZSBrb3BpZXJ0IVwiLFxuICAgICAgICBcImxlYXZpbmdcIjogXCJBYmdlc2ljaGVydGVyIE1vZHVzIGJlZW5kZXRcIixcbiAgICAgICAgXCJiYWNrdXBcIjogXCJzaWNoZXJuXCIsXG4gICAgICAgIFwidW5kb1wiOlwiclx1MDBGQ2NrZ1x1MDBFNG5naWdcIixcbiAgICAgICAgXCJyZWRvXCI6XCJ3aWVkZXJob2xlblwiLFxuICAgICAgICBcImNsZWFyXCI6XCJsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJib2xkXCI6XCJmZXR0XCIsXG4gICAgICAgIFwiaXRhbGljXCI6XCJrdXJzaXZcIixcbiAgICAgICAgXCJ1bmRlcmxpbmVcIjpcInVudGVyc3RyaWNoZW5cIixcbiAgICAgICAgXCJoZWFkaW5nMVwiOlwiXHUwMERDYmVyc2NocmlmdCAxXCIsXG4gICAgICAgIFwiaGVhZGluZzJcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgMlwiLFxuICAgICAgICBcImhlYWRpbmczXCI6XCJcdTAwRENiZXJzY2hyaWZ0IDNcIixcbiAgICAgICAgXCJoZWFkaW5nNFwiOlwiXHUwMERDYmVyc2NocmlmdCA0XCIsXG4gICAgICAgIFwiaGVhZGluZzVcIjpcIlx1MDBEQ2JlcnNjaHJpZnQgNVwiLFxuICAgICAgICBcImhlYWRpbmc2XCI6XCJcdTAwRENiZXJzY2hyaWZ0IDZcIixcbiAgICAgICAgXCJzdWJzY3JpcHRcIjpcInRpZWZnZXN0ZWxsdFwiLFxuICAgICAgICBcInN1cGVyc2NyaXB0XCI6XCJob2NoZ2VzdGVsbHRcIixcbiAgICAgICAgXCJidWxsZXRsaXN0XCI6XCJ1bmdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImxpc3RcIjpcImdlb3JkbmV0ZSBMaXN0ZVwiLFxuICAgICAgICBcImNvZGVibG9ja1wiOlwiQ29kZWJsb2NrXCIsXG4gICAgICAgIFwiY29kZVwiOlwiQ29kZVwiLFxuICAgICAgICBcImJsb2NrcXVvdGVcIjpcIlppdGF0XCIsXG4gICAgICAgIFwibGluZVwiOlwiU2VpdGVudW1icnVjaFwiLFxuICAgICAgICBcImxlZnRcIjpcIkxpbmtzYlx1MDBGQ25kaWdcIixcbiAgICAgICAgXCJjZW50ZXJcIjpcIlplbnRyaWVydFwiLFxuICAgICAgICBcInJpZ2h0XCI6XCJSZWNodHNiXHUwMEZDbmRpZ1wiLFxuICAgICAgICBcImp1c3RpZnlcIjpcIkJsb2Nrc2F0elwiLFxuICAgICAgICBcInRleHRjb2xvclwiOlwiVGV4dGZhcmJlXCIsXG4gICAgICAgIFwibGluZWJyZWFrXCI6XCJaZWlsZW51bWJydWNoXCIsXG4gICAgICAgIFwibW9yZVwiOlwibWVoclwiLFxuICAgICAgICBcImluc2VydHRhYmxlXCI6XCJUYWJlbGxlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJkZWxldGV0YWJsZVwiOlwiVGFiZWxsZSBsXHUwMEY2c2NoZW5cIixcbiAgICAgICAgXCJjb2x1bW5hZnRlclwiOlwiU3BhbHRlIGVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJyb3dhZnRlclwiOlwiUmVpaGUgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImRlbGNvbHVtblwiOlwiU3BhbHRlIGxcdTAwRjZzY2hlblwiLFxuICAgICAgICBcImRlbHJvd1wiOlwiUmVpaGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgICAgIFwibWVyZ2VvcnNwbGl0XCI6XCJWZXJlaW5lbiBvZGVyIFRlaWxlblwiLFxuICAgICAgICBcImhlYWRlcmNvbHVtblwiOlwiVGl0ZWxzcGFsdGVcIixcbiAgICAgICAgXCJoZWFkZXJyb3dcIjpcIlRpdGVscmVpaGVcIixcbiAgICAgICAgXCJzZWxlY3RlZFwiOlwiV1x1MDBGNnJ0ZXIvWmVpY2hlbiBpbiBBdXN3YWhsXCIsXG4gICAgICAgIFwicmVxdWVzdHNlbnRcIjpcIkRydWNrYW5mcmFnZSBnZXNlbmRldCFcIixcbiAgICAgICAgXCJyZXF1ZXN0ZGVuaWVkXCI6XCJEcnVja2FuZnJhZ2UgYWJnZWxlaG50LiBCaXR0ZSB3YXJ0ZW4gdW5kIGVybmV1dCBzZW5kZW4uXCIsXG4gICAgICAgIFwicGFzdGVcIjpcImVpbmZcdTAwRkNnZW5cIixcbiAgICAgICAgXCJjb3B5XCI6XCJrb3BpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tcIjogXCJSZWNodHNjaHJlaWJwclx1MDBGQ2Z1bmcgYWt0aXZpZXJlblwiLFxuICAgICAgICBcInNwZWxsY2hlY2tkZWFjdGl2YXRlXCI6IFwiUmVjaHRzY2hyZWlicHJcdTAwRkNmdW5nIGRlYWt0aXZpZXJlblwiLFxuICAgICAgICBcInJlbG9hZFwiOiBcIk5ldSBsYWRlblwiLFxuICAgICAgICBcInJlbG9hZHRleHRcIjogXCJXb2xsZW4gU2llIGRlbiBUZXh0ZWRpdG9yIG5ldSBpbml0aWFsaXNpZXJlbj9cIixcbiAgICAgICAgXCJyZWxvYWRjb250ZW50XCI6IFwiSW5oYWx0IGJlaWJlaGFsdGVuXCIsXG4gICAgICAgIFwic3BlY2lhbGNoYXJcIjpcIlNvbmRlcnplaWNoZW4gZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcInByaW50XCI6IFwiZHJ1Y2tlblwiLFxuICAgICAgICBcInBsYXlhdWRpb1wiOlwiQXVkaW8gYWJzcGllbGVuXCIsXG4gICAgICAgIFwicmVhbGx5cGxheVwiOlwiV29sbGVuIFNpZSBkYXMgSFx1MDBGNnJiZWlzcGllbCBqZXR6dCBhYnNwaWVsZW4/XCIsXG4gICAgICAgIFwiYXVkaW9yZW1haW5pbmdcIjpcIlZlcmJsZWliZW5kZSBEdXJjaGxcdTAwRTR1ZmU6XCIsXG4gICAgICAgIFwiYXVkaW9ub3RhbGxvd2VkXCI6XCJTaWUgaGFiZW4ga2VpbmUgQmVyZWNodGlndW5nIGRpZSBBdWRpb2RhdGVpIGVybmV1dCBhYnp1c3BpZWxlbiFcIixcbiAgICAgICAgXCJpbnNlcnRcIjpcIkJpbGQgZWluZlx1MDBGQ2dlblwiLFxuICAgICAgICBcImluc2VydG11Z1wiOlwiTXVnc2hvdCBlaW5mXHUwMEZDZ2VuXCIsXG4gICAgICAgIFwiYmlsZHVuZ3Nwb3J0YWxcIjpcIkJpbGR1bmdzcG9ydGFsXCIsXG4gICAgICAgIFwic2VuZFwiOlwiQXJiZWl0IGFuIExlaHJwZXJzb24gc2VuZGVuXCIsXG4gICAgICAgIFwiem9vbUluXCI6XCJab29tIGluXCIsXG4gICAgICAgIFwiem9vbU91dFwiOlwiWm9vbSBvdXRcIixcbiAgICAgICAgXCJjbG9zZVwiOlwiU2NobGllXHUwMERGZW5cIixcbiAgICAgICAgXCJzZWN0aW9uU3dpdGNoVGl0bGVcIjogXCJQclx1MDBGQ2Z1bmdzYWJzY2huaXR0IHdlY2hzZWxuXCIsXG4gICAgICAgIFwic2VjdGlvblN3aXRjaFRleHRcIjogXCJTaW5kIFNpZSBzaWNoZXIsIGRhc3MgU2llIHp1bSBuZXVlbiBBYnNjaG5pdHQgd2VjaHNlbG4gbVx1MDBGNmNodGVuP1wiLFxuICAgICAgICBcImxhbmdfZGVcIjogXCJEZXV0c2NoXCIsXG4gICAgICAgIFwibGFuZ19lbl9nYlwiOiBcIkVuZ2xpc2NoIChVSylcIixcbiAgICAgICAgXCJsYW5nX2VuX3VzXCI6IFwiRW5nbGlzY2ggKFVTKVwiLFxuICAgICAgICBcImxhbmdfZnJcIjogXCJGcmFuelx1MDBGNnNpc2NoXCIsXG4gICAgICAgIFwibGFuZ19lc1wiOiBcIlNwYW5pc2NoXCIsXG4gICAgICAgIFwibGFuZ19pdFwiOiBcIkl0YWxpZW5pc2NoXCIsXG4gICAgICAgIFwibGFuZ19zbFwiOiBcIlNsb3dlbmlzY2hcIlxuICAgIH0sXG4gICAgXCJtYXRoXCI6IHtcbiAgICAgICAgXCJleGl0XCI6XCJBYmdlc2ljaGVydGVuIE1vZHVzIGJlZW5kZW4/XCIsXG4gICAgICAgIFwiZmlsZW5hbWVcIjogXCJEYXRlaW5hbWVcIixcbiAgICAgICAgXCJub3NwZWNpYWxcIjogXCJCaXR0ZSBnZWJlbiBTaWUgbnVyIEJ1Y2hzdGFiZW4gb2RlciBaYWhsZW4gZWluLlwiLFxuICAgICAgICBcImNsZWFyXCI6IFwiQWxsZSBCZXJlY2hudW5nZW4gbFx1MDBGNnNjaGVuP1wiXG4gICAgfSxcbiAgICBcImdlbmVyYWxcIjp7XG4gICAgICAgIFwiZXJyb3JcIjogXCJGZWhsZXJcIixcbiAgICAgICAgXCJub3BkZlwiOiBcIktlaW5lIGdcdTAwRkNsdGlnZSBQREYgRGF0ZWlcIixcbiAgICAgICAgXCJ3cm9uZ3Bhc3N3b3JkXCI6IFwiRmFsc2NoZXMgUGFzc3dvcnRcIlxuICAgIH0sXG4gICAgXCJ3ZWJzaXRlXCI6IHtcbiAgICAgICAgXCJyZWxvYWR3ZWJ2aWV3XCI6IFwiV2VidmlldyBuZXUgbGFkZW5cIlxuICAgIH0sXG4gICAgXCJwZGZcIjoge1xuICAgICAgICBcIndhcm5pbmdUaXRsZVwiOiBcIk1cdTAwRjZnbGljaGVyd2Vpc2UgZ2VzY2FubnRlcyBQREZcIixcbiAgICAgICAgXCJ3YXJuaW5nUHJlZml4XCI6IFwiQXVmXCIsXG4gICAgICAgIFwid2FybmluZ01lc3NhZ2VcIjogXCJ3dXJkZW4gd2VuaWdlciBhbHMgMiBpbnRlcmFrdGl2ZSBGb3JtdWxhcmZlbGRlciBnZWZ1bmRlbi5cIixcbiAgICAgICAgXCJ3YXJuaW5nTWVzc2FnZTJcIjogXCJEaWVzIGRldXRldCBkYXJhdWYgaGluLCBkYXNzIGVzIHNpY2ggdW0gZWluIGdlc2Nhbm50ZXMgUERGIGhhbmRlbHQsIGRhcyBrZWluZSBha3RpdmVuIEZvcm11bGFyZmVsZGVyIG9kZXIgVGFiZWxsZW4gZW50aFx1MDBFNGx0LlwiLFxuICAgICAgICBcInVuZGVyc3Rvb2RcIjogXCJWZXJzdGFuZGVuXCIsXG4gICAgICAgIFwicGFnZVwiOiBcIlNlaXRlXCIsXG4gICAgICAgIFwicGFnZXNcIjogXCJTZWl0ZW5cIlxuICAgIH0sXG4gICAgXCJkYXNoYm9hcmRcIjoge1xuICAgICAgICBcInJldHJ5XCI6IFwiRXJuZXV0IHZlcnN1Y2hlblwiXG4gICAgfVxufVxuIiwgIi8qKlxuICogd2ViRmlsdGVyLmpzIC0gVVJMIGZpbHRlcmluZyBtb2R1bGUgZm9yIGV4YW0gd2Vic2l0ZSBuYXZpZ2F0aW9uXG4gKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIG5hdmlnYXRpb24gdG8gYSB0YXJnZXQgVVJMIHNob3VsZCBiZSBhbGxvd2VkIG9yIGJsb2NrZWRcbiAqIGJhc2VkIG9uIHRoZSBjb25maWd1cmVkIGFsbG93ZWQgVVJMIGFuZCBpdHMgYmxvY2tpbmcgc2V0dGluZ3MuXG4gKlxuICogQG1vZHVsZSB3ZWJGaWx0ZXJcbiAqL1xuXG4vKipcbiAqIENoZWNrIGlmIG5hdmlnYXRpb24gdG8gYSB0YXJnZXQgVVJMIHNob3VsZCBiZSBhbGxvd2VkOyByZXR1cm5zIHJlc3VsdCB3aXRoIG9wdGlvbmFsIGJsb2NrIHJlYXNvbi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGFyZ2V0VXJsIC0gVGhlIFVSTCB0aGUgc3R1ZGVudCBpcyB0cnlpbmcgdG8gbmF2aWdhdGUgdG9cbiAqIEBwYXJhbSB7c3RyaW5nfSBhbGxvd2VkVXJsIC0gVGhlIGJhc2UgYWxsb3dlZCBVUkwgKGUuZy4gXCJodHRwczovL3d3dy5leGFtcGxlLmNvbS9wYXRoXCIpXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGJsb2NrU3ViZG9tYWlucyAtIElmIHRydWUsIG9ubHkgdGhlIGV4YWN0IGRvbWFpbiBpcyBhbGxvd2VkIChubyBzdWJkb21haW5zKVxuICogQHBhcmFtIHtib29sZWFufSBibG9ja1N1YmZvbGRlcnMgLSBJZiB0cnVlLCBvbmx5IHRoZSBleGFjdCBwYXRoIChhbmQgYmVsb3cpIG9mIHRoZSBhbGxvd2VkIFVSTCBpcyBwZXJtaXR0ZWRcbiAqIEByZXR1cm5zIHt7IGFsbG93ZWQ6IGJvb2xlYW4sIHJlYXNvbj86IHN0cmluZywgZG9tYWluTWF0Y2hlZD86IGJvb2xlYW4gfX1cbiAqL1xuZnVuY3Rpb24gZ2V0VXJsQWxsb3dSZXN1bHQodGFyZ2V0VXJsLCBhbGxvd2VkVXJsLCBibG9ja1N1YmRvbWFpbnMsIGJsb2NrU3ViZm9sZGVycykge1xuICAgIGlmICghdGFyZ2V0VXJsIHx8ICFhbGxvd2VkVXJsKSB7XG4gICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246ICdtaXNzaW5nIG9yIGludmFsaWQgdGFyZ2V0IG9yIGFsbG93ZWQgVVJMJywgZG9tYWluTWF0Y2hlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBsZXQgYWxsb3dlZFVybE9iajtcbiAgICBsZXQgdGFyZ2V0VXJsT2JqO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IG5vcm1hbGl6ZWRBbGxvd2VkID0gYWxsb3dlZFVybDtcbiAgICAgICAgaWYgKCFub3JtYWxpemVkQWxsb3dlZC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiYgIW5vcm1hbGl6ZWRBbGxvd2VkLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpIHtcbiAgICAgICAgICAgIG5vcm1hbGl6ZWRBbGxvd2VkID0gJ2h0dHBzOi8vJyArIG5vcm1hbGl6ZWRBbGxvd2VkO1xuICAgICAgICB9XG4gICAgICAgIGFsbG93ZWRVcmxPYmogPSBuZXcgVVJMKG5vcm1hbGl6ZWRBbGxvd2VkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXR1cm4geyBhbGxvd2VkOiBmYWxzZSwgcmVhc29uOiAnaW52YWxpZCBhbGxvd2VkIFVSTCcsIGRvbWFpbk1hdGNoZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgdGFyZ2V0VXJsT2JqID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIHRhcmdldCBVUkwnLCBkb21haW5NYXRjaGVkOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IGFsbG93ZWRIb3N0bmFtZSA9IGFsbG93ZWRVcmxPYmouaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB0YXJnZXRIb3N0bmFtZSA9IHRhcmdldFVybE9iai5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGFsbG93ZWRCYXNlID0gYWxsb3dlZEhvc3RuYW1lLnJlcGxhY2UoL153d3dcXC4vLCAnJyk7XG4gICAgY29uc3QgdGFyZ2V0QmFzZSA9IHRhcmdldEhvc3RuYW1lLnJlcGxhY2UoL153d3dcXC4vLCAnJyk7XG4gICAgY29uc3QgdGFyZ2V0SXNTYW1lT3JTdWJkb21haW5PZkFsbG93ZWQgPSAodGFyZ2V0QmFzZSA9PT0gYWxsb3dlZEJhc2UgfHwgdGFyZ2V0QmFzZS5lbmRzV2l0aCgnLicgKyBhbGxvd2VkQmFzZSkpO1xuXG4gICAgLy8gLS0tIERvbWFpbiBjaGVjayAtLS1cbiAgICBpZiAoYmxvY2tTdWJkb21haW5zKSB7XG4gICAgICAgIGlmICh0YXJnZXRIb3N0bmFtZSAhPT0gYWxsb3dlZEhvc3RuYW1lICYmIHRhcmdldEhvc3RuYW1lICE9PSAnd3d3LicgKyBhbGxvd2VkSG9zdG5hbWUgJiYgYWxsb3dlZEhvc3RuYW1lICE9PSAnd3d3LicgKyB0YXJnZXRIb3N0bmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgYWxsb3dlZDogZmFsc2UsIHJlYXNvbjogJ3N1YmRvbWFpbiBvciBkaWZmZXJlbnQgZG9tYWluIG5vdCBhbGxvd2VkIChibG9ja1N1YmRvbWFpbnMpJywgZG9tYWluTWF0Y2hlZDogdGFyZ2V0SXNTYW1lT3JTdWJkb21haW5PZkFsbG93ZWQgfTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0YXJnZXRCYXNlICE9PSBhbGxvd2VkQmFzZSAmJiAhdGFyZ2V0QmFzZS5lbmRzV2l0aCgnLicgKyBhbGxvd2VkQmFzZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZWFzb246ICdkb21haW4gbm90IGluIGFsbG93ZWQgVVJMcycsIGRvbWFpbk1hdGNoZWQ6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAtLS0gUGF0aCBjaGVjayAtLS1cbiAgICBpZiAoYmxvY2tTdWJmb2xkZXJzKSB7XG4gICAgICAgIGNvbnN0IGFsbG93ZWRQYXRoID0gYWxsb3dlZFVybE9iai5wYXRobmFtZS5yZXBsYWNlKC9cXC8rJC8sICcnKSB8fCAnLyc7XG4gICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0YXJnZXRVcmxPYmoucGF0aG5hbWUucmVwbGFjZSgvXFwvKyQvLCAnJykgfHwgJy8nO1xuXG4gICAgICAgIGlmIChhbGxvd2VkUGF0aCA9PT0gJy8nKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0UGF0aCAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgYWxsb3dlZDogZmFsc2UsIHJlYXNvbjogJ3N1YmZvbGRlciBub3QgYWxsb3dlZCAob25seSByb290IGFsbG93ZWQsIGJsb2NrU3ViZm9sZGVycyknLCBkb21haW5NYXRjaGVkOiB0cnVlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRhcmdldFBhdGguc3RhcnRzV2l0aChhbGxvd2VkUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBhbGxvd2VkOiBmYWxzZSwgcmVhc29uOiAncGF0aCBub3QgdW5kZXIgYWxsb3dlZCBwYXRoIChibG9ja1N1YmZvbGRlcnMpJywgZG9tYWluTWF0Y2hlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSB9O1xufVxuXG4vKipcbiAqIENoZWNrIGlmIG5hdmlnYXRpb24gdG8gYSB0YXJnZXQgVVJMIHNob3VsZCBiZSBhbGxvd2VkIChib29sZWFuKS5cbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBpc1VybEFsbG93ZWQodGFyZ2V0VXJsLCBhbGxvd2VkVXJsLCBibG9ja1N1YmRvbWFpbnMsIGJsb2NrU3ViZm9sZGVycykge1xuICAgIHJldHVybiBnZXRVcmxBbGxvd1Jlc3VsdCh0YXJnZXRVcmwsIGFsbG93ZWRVcmwsIGJsb2NrU3ViZG9tYWlucywgYmxvY2tTdWJmb2xkZXJzKS5hbGxvd2VkO1xufVxuXG5leHBvcnQgeyBpc1VybEFsbG93ZWQsIGdldFVybEFsbG93UmVzdWx0IH07XG4iLCAiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgSnJlSGFuZGxlciBmcm9tICcuL2pyZS1oYW5kbGVyLmpzJztcbmltcG9ydCBwbGF0Zm9ybURpc3BhdGNoZXIgZnJvbSAnLi9wbGF0Zm9ybURpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcbmNvbnN0IHB1YmxpY0Jhc2UgPSAoKSA9PiBwbGF0Zm9ybURpc3BhdGNoZXIucHVibGljQmFzZTtcblxubGV0IGxhbmd1YWdlVG9vbEphclBhdGggPSBwYXRoLmpvaW4ocHVibGljQmFzZSgpLCAnTGFuZ3VhZ2VUb29sL2xhbmd1YWdldG9vbC1zZXJ2ZXIuamFyJyk7XG5sZXQgbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCA9IHBhdGguam9pbihwdWJsaWNCYXNlKCksICdMYW5ndWFnZVRvb2wvc2VydmVyLnByb3BlcnRpZXMnKTtcblxuXG5cblxuXG5jbGFzcyBMYW5ndWFnZVRvb2xTZXJ2ZXIge1xuICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIEluaXRpYWxpc2llcnQgZGllIFByb3plc3N2YXJpYWJsZVxuICAgICAgICAgdGhpcy5wb3J0ID0gODA4OFxuICAgICB9XG4gXG4gICAgIHN0YXJ0U2VydmVyKCkge1xuICAgICAgICAgaWYgKHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyAmJiAhdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICAgICAgIGxvZy53YXJuKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcuJyk7XG4gICAgICAgICAgICAgcmV0dXJuOyAvLyBWZXJoaW5kZXJ0IGRhcyBlcm5ldXRlIFN0YXJ0ZW4sIHdlbm4gZGVyIFNlcnZlciBiZXJlaXRzIGxcdTAwRTR1ZnRcbiAgICAgICAgIH1cbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBKcmVIYW5kbGVyLmpTcGF3bihcbiAgICAgICAgICAgICAgICBbbGFuZ3VhZ2VUb29sSmFyUGF0aF0sIC8vIEtsYXNzZW5wZmFkXG4gICAgICAgICAgICAgICAgJ29yZy5sYW5ndWFnZXRvb2wuc2VydmVyLkhUVFBTZXJ2ZXInLCAvLyBIYXVwdGtsYXNzZSBkZXIgTGFuZ3VhZ2VUb29sIEFQSVxuICAgICAgICAgICAgICAgIFsnLS1wb3J0JywgdGhpcy5wb3J0LCctLWNvbmZpZycsbGFuZ3VhZ2VUb29sQ29uZmlnUGF0aCwgJy0tYWxsb3ctb3JpZ2luJywgXCInKidcIiBdIC8vIFp1c1x1MDBFNHR6bGljaGUgQXJndW1lbnRlLCB6LkIuIFBvcnQgdW5kIENPUlMtRXJsYXVibmlzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKVxuICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgQVBJIHJ1bm5pbmcgYXQgbG9jYWxob3N0OjgwODgnKTtcblxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIGRhdGEgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGE6IFJlY2VpdmVkIGRhdGEgZnJvbSBMYW5ndWFnZVRvb2wgQVBJJywgZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdlcnJvcicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKCdsdC1zZXJ2ZXIgQCBzdGFydHNlcnZlciAgZGF0YS1lcnJvcjonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3V0cHV0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3N0YXJ0aW5nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjaGVjayBkb25lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyICBkYXRhLWluZm86Jywgb3V0cHV0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdoYW5kbGVkIHJlcXVlc3QnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgIGRhdGEtaW5mbzonLCBvdXRwdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gQWNjdW11bGF0ZSBzdGRlcnIgZGF0YSB0byBoYW5kbGUgY2h1bmtlZCBvdXRwdXRcbiAgICAgICAgICAgIGxldCBzdGRlcnJCdWZmZXIgPSAnJztcbiAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9ydFN0ciA9IFN0cmluZyh0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGJvdGggY3VycmVudCBjaHVuayBhbmQgYWNjdW11bGF0ZWQgYnVmZmVyIGZvciBwb3J0LXJlbGF0ZWQgZXJyb3JzXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFJlc3BvbnNlID0gc3RkZXJyQnVmZmVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUG9ydEVycm9yID0gZnVsbFJlc3BvbnNlLmluY2x1ZGVzKHBvcnRTdHIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZHJlc3NlIHdpcmQgYmVyZWl0cyB2ZXJ3ZW5kZXRcIikgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZS5pbmNsdWRlcyhcIk1heWJlIHNvbWV0aGluZyBlbHNlIGlzIHJ1bm5pbmcgb24gdGhhdCBwb3J0XCIpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdWxsUmVzcG9uc2UuaW5jbHVkZXMoXCJBZGRyZXNzIGFscmVhZHkgaW4gdXNlXCIpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpc1BvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXI6IGFub3RoZXIgTGFuZ3VhZ2VUb29sIHNlcnZlciBpcyBwcm9iYWJseSBhbHJlYWR5IHJ1bm5pbmcgb24gcG9ydDonLCB0aGlzLnBvcnQpO1xuICAgICAgICAgICAgICAgICAgICBzdGRlcnJCdWZmZXIgPSAnJzsgLy8gUmVzZXQgYnVmZmVyIGFmdGVyIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuay5pbmNsdWRlcygnXFxuJykgfHwgZnVsbFJlc3BvbnNlLmxlbmd0aCA+IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgZXJyb3IgaWYgd2UgaGF2ZSBhIG5ld2xpbmUgKGxpa2VseSBjb21wbGV0ZSBtZXNzYWdlKSBvciBidWZmZXIgaXMgZ2V0dGluZyBsYXJnZVxuICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2x0LXNlcnZlciBAIHN0YXJ0c2VydmVyIGRhdGEtZXJyb3I6JywgZnVsbFJlc3BvbnNlLnRyaW0oKSk7XG4gICAgICAgICAgICAgICAgICAgIHN0ZGVyckJ1ZmZlciA9ICcnOyAvLyBSZXNldCBidWZmZXIgYWZ0ZXIgbG9nZ2luZ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oYGx0LXNlcnZlciBAIHN0YXJ0c2VydmVyOiBMYW5ndWFnZVRvb2wgc2VydmVyIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xuICAgICAgICAgICAgICAgIHRoaXMubGFuZ3VhZ2VUb29sUHJvY2VzcyA9IG51bGw7IC8vIFNldHp0IGRlbiBQcm96ZXNzIHp1clx1MDBGQ2NrLCB3ZW5uIGVyIGJlZW5kZXQgd2lyZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZXJyKXtcbiAgICAgICAgICAgIGxvZy5lcnJvcignbHQtc2VydmVyIEAgc3RhcnRzZXJ2ZXIgZ2VuZXJhbC1lcnJvcjonLCBlcnIpO1xuICAgICAgICB9XG5cblxuICAgICB9XG5cbiAgICAgc3RvcFNlcnZlcigpIHtcbiAgICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWRcbiAgICAgICAgIGlmICghdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzKSB7XG4gICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgd2FzIG5ldmVyIHN0YXJ0ZWQsIG5vdGhpbmcgdG8gc3RvcCcpO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGtpbGwgdGhlIHByb2Nlc3MgZGlyZWN0bHkgaWYgd2UgaGF2ZSBhIHJlZmVyZW5jZVxuICAgICAgICAgaWYgKCF0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBraWxsZWQnKTtcbiAgICAgICAgICAgICAgICAgdGhpcy5sYW5ndWFnZVRvb2xQcm9jZXNzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZmFpbGVkIHRvIGtpbGwgcHJvY2VzcyBkaXJlY3RseSwgdHJ5aW5nIHBsYXRmb3JtLXNwZWNpZmljIG1ldGhvZDonLCBlcnIpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBwbGF0Zm9ybS1zcGVjaWZpYyBjb21tYW5kcyB0byBraWxsIHRoZSBwcm9jZXNzIChvbmx5IGlmIHdlIGhhZCBhIHByb2Nlc3MgcmVmZXJlbmNlKVxuICAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBvcy5wbGF0Zm9ybSgpO1xuICAgICAgICAgbGV0IGNvbW1hbmQ7XG5cbiAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgIC8vIFdpbmRvd3M6IGZpbmQgYW5kIGtpbGwgamF2YSBwcm9jZXNzZXMgcnVubmluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB3bWljICh3b3JrcyBvbiBvbGRlciBXaW5kb3dzKSwgdGhlbiB0cnkgUG93ZXJTaGVsbCwgdGhlbiBmYWxsYmFjayB0byBwb3J0LWJhc2VkIGtpbGxcbiAgICAgICAgICAgICBjb21tYW5kID0gYHdtaWMgcHJvY2VzcyB3aGVyZSBcImNvbW1hbmRsaW5lIGxpa2UgJyVsYW5ndWFnZXRvb2wtc2VydmVyLmphciUnXCIgZGVsZXRlIDI+bnVsIHx8IHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCJHZXQtUHJvY2VzcyBqYXZhIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlIHwgV2hlcmUtT2JqZWN0IHskXy5Db21tYW5kTGluZSAtbGlrZSAnKmxhbmd1YWdldG9vbC1zZXJ2ZXIuamFyKid9IHwgU3RvcC1Qcm9jZXNzIC1Gb3JjZVwiIDI+bnVsIHx8IGZvciAvZiBcInRva2Vucz01XCIgJWEgaW4gKCduZXRzdGF0IC1hbm8gXnwgZmluZHN0ciA6ODA4OCcpIGRvIHRhc2traWxsIC9GIC9QSUQgJWEgMj5udWxgO1xuICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICAgICAgICAgICAvLyBtYWNPUyBhbmQgTGludXg6IHVzZSBwa2lsbCB0byBraWxsIHByb2Nlc3NlcyBtYXRjaGluZyBsYW5ndWFnZXRvb2wtc2VydmVyLmphclxuICAgICAgICAgICAgIGNvbW1hbmQgPSAncGtpbGwgLWYgbGFuZ3VhZ2V0b29sLXNlcnZlci5qYXInO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogdW5zdXBwb3J0ZWQgcGxhdGZvcm06JywgcGxhdGZvcm0pO1xuICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cblxuICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIC8vIEl0J3Mgb2theSBpZiB0aGUgcHJvY2VzcyBpcyBub3QgZm91bmQgKGFscmVhZHkga2lsbGVkKVxuICAgICAgICAgICAgICAgICAvLyBwa2lsbCByZXR1cm5zIGNvZGUgMSB3aGVuIG5vIHByb2Nlc3MgaXMgZm91bmQsIHdoaWNoIGlzIGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAxICYmICFlcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSAmJiAhc3RkZXJyLnRvU3RyaW5nKCkuaW5jbHVkZXMoJ05vIHN1Y2ggcHJvY2VzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICBsb2cud2FybignbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogZXJyb3Iga2lsbGluZyBMYW5ndWFnZVRvb2wgc2VydmVyOicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oJ2x0LXNlcnZlciBAIHN0b3BTZXJ2ZXI6IExhbmd1YWdlVG9vbCBzZXJ2ZXIgcHJvY2VzcyBub3QgZm91bmQgKG1heSBhbHJlYWR5IGJlIHN0b3BwZWQpJyk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBsb2cuaW5mbygnbHQtc2VydmVyIEAgc3RvcFNlcnZlcjogTGFuZ3VhZ2VUb29sIHNlcnZlciBzdG9wcGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB0aGlzLmxhbmd1YWdlVG9vbFByb2Nlc3MgPSBudWxsO1xuICAgICAgICAgfSk7XG4gICAgIH1cbiB9XG5cblxuXG5cblxuXG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBMYW5ndWFnZVRvb2xTZXJ2ZXIoKVxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsICIvKipcbiAqIEBsaWNlbnNlIEdQTCBMSUNFTlNFXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjEgVGhvbWFzIE1pY2hhZWwgV2Vpc3NlbFxuICogXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCBcbiAqIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sXG4gKiBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvciBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTtcbiAqIHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuXG4gKiBTZWUgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG4gKiBcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICogWW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uXG4gKiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuXG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHByb2Nlc3MgZnJvbSAncHJvY2Vzcyc7XG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XG5cbiAvLyBldmVyeSBwbGF0Zm9ybSBuZWVkcyBpdCdzIG93biBqcmUgKGxpbnV4LCB3aW4zMiwgZGFyd2luKSAvL2ZpeG1lOiB1c2UgR3JhYWxWTSB0byBwcmVjb21waWxlIGxhbmd1YWdldG9vbCBpbiBvcmRlciB0byBzYXZlIHNwYWNlIGFuZCBnZXQgcmlkIG9mIGpyZT9cbmNsYXNzIEpyZUhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHsgfVxuXG4gICAgaW5pdCgpeyBcbiAgICAgICAgdGhpcy5qVGVzdCgpXG4gICAgfVxuXG5cbiAgICBqVGVzdCgpe1xuICAgICAgICBsZXQgamF2YXBhdGggPSB0aGlzLmRyaXZlcigpOyAvLyAnL3BmYWQvenVyL2phdmEnXG4gICAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihqYXZhcGF0aCwgWyctdmVyc2lvbiddKTtcbiAgICBcbiAgICAgICAgcHJvYy5zdGRlcnIub24oJ2RhdGEnLCBkYXRhID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTsgLy8gaW4gWmVpbGVuIHNwbGl0dGVuXG4gICAgICAgICAgICBsb2cuZGVidWcoYGpyZS1oYW5kbGVyIEAgalRlc3Q6ICR7bGluZXNbMF19YCk7IC8vIG51ciBkaWUgZXJzdGUgWmVpbGUgbG9nZ2VuXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmYWlsKHJlYXNvbikge1xuICAgICAgICBsb2cuZXJyb3IocmVhc29uKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cblxuICAgIGdldERpcmVjdG9yaWVzKGRpclBhdGgpIHtcbiAgICAgICAgbGV0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKS5maWx0ZXIoXG4gICAgICAgICAgICBmaWxlID0+IGZzLnN0YXRTeW5jKHBhdGguam9pbihkaXJQYXRoLCBmaWxlKSkuaXNEaXJlY3RvcnkoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZGlyc1xuICAgIH0gXG5cbiAgICBkcml2ZXIoKXtcbiAgICAgICAgdmFyIGQgPSBwbGF0Zm9ybURpc3BhdGNoZXIuamF2YUJpbi5zbGljZSgpO1xuICAgICAgICBkLnVuc2hpZnQocGxhdGZvcm1EaXNwYXRjaGVyLmpyZURpcik7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4uYXBwbHkocGF0aCwgZCk7XG4gICAgfVxuXG4gICAgZ2V0QXJncyhjbGFzc3BhdGgsIGNsYXNzbmFtZSwgYXJncykge1xuICAgICAgICBhcmdzID0gKGFyZ3MgfHwgW10pLnNsaWNlKCk7XG4gICAgICAgIGNsYXNzcGF0aCA9IGNsYXNzcGF0aCB8fCBbXTtcbiAgICAgICAgYXJncy51bnNoaWZ0KGNsYXNzbmFtZSk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChjbGFzc3BhdGguam9pbih0aGlzLl9wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JykpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoJy1jcCcpO1xuICAgICAgICByZXR1cm4gYXJncztcbiAgICB9XG5cbiAgICBqU3Bhd24oY2xhc3NwYXRoLCBjbGFzc25hbWUsIGFyZ3MpIHtcbiAgICAgICAgXG4gICAgICAgIGxldCBqYXZhcGF0aCA9IHRoaXMuZHJpdmVyKClcbiAgICAgICAgbGV0IGphdmFhcmdzID0gdGhpcy5nZXRBcmdzKGNsYXNzcGF0aCwgY2xhc3NuYW1lLCBhcmdzKVxuICAgICAgICBsZXQgamF2YWNtZGxpbmUgPSAgYCR7amF2YXBhdGh9ICR7amF2YWFyZ3Muam9pbignICcpfSBgXG5cbiAgICAgICAgbG9nLmluZm8oYGpyZS1oYW5kbGVyIEAgalNwYXduOiAnJHtwbGF0Zm9ybURpc3BhdGNoZXIuanJlfScgc2VsZWN0ZWRgKVxuICAgICAgICBsb2cuaW5mbyhganJlLWhhbmRsZXIgQCBqU3Bhd246IHNwYXduaW5nIGphdmEgcHJvY2VzczogJHtqYXZhY21kbGluZX1gKVxuICAgICAgICByZXR1cm4gc3Bhd24oamF2YXBhdGgsIGphdmFhcmdzLCB7c2hlbGw6ZmFsc2V9KTtcbiAgICAgICAvLyByZXR1cm4gc3Bhd24oamF2YWNtZGxpbmUpO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBuZXcgSnJlSGFuZGxlcigpXG4iLCAiLy8gc2NyaXB0cy9TeXN0ZW1UcmF5TWFuYWdlci5qc1xuaW1wb3J0IHsgYXBwLCBUcmF5LCBNZW51IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnO1xuaW1wb3J0IENvbW1IYW5kbGVyIGZyb20gJy4vY29tbXVuaWNhdGlvbmhhbmRsZXIuanMnO1xuaW1wb3J0IHBsYXRmb3JtRGlzcGF0Y2hlciBmcm9tICcuL3BsYXRmb3JtRGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgaTE4biBmcm9tICcuLi8uLi8uLi9zcmMvbG9jYWxlcy9sb2NhbGVzLmpzJztcblxuY29uc3QgX19kaXJuYW1lID0gaW1wb3J0Lm1ldGEuZGlybmFtZTtcblxubGV0IHRyYXkgPSBudWxsO1xuXG4vLyBSZXNvbHZlIGljb24gcGF0aDogcGFja2FnZWQgYXBwIHVzZXMgdW5wYWNrZWQgcHVibGljIGRpciwgZGV2IHVzZXMgcHJvamVjdCBwdWJsaWNcbmZ1bmN0aW9uIGdldFRyYXlJY29uUGF0aCgpIHtcbiAgY29uc3QgcHVibGljQmFzZSA9IHBsYXRmb3JtRGlzcGF0Y2hlci5wdWJsaWNCYXNlO1xuICByZXR1cm4gcGF0aC5qb2luKHB1YmxpY0Jhc2UsICdpY29ucycsICdpY29uMjR4MjQucG5nJyk7XG59IFxuXG4vLyA9PT0gcmVwbGFjZSB0aGUgaGVscGVyIHNldExvY2FsZSAoZXhhY3QgYmxvY2spID09PVxuY29uc3Qgc2V0TG9jYWxlID0gKGxvYykgPT4ge1xuICAgIGNvbnN0IGdsID0gaTE4bi5nbG9iYWw7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZ2xvYmFsIGNvbXBvc2VyXG4gICAgaWYgKGdsICYmIHR5cGVvZiBnbC5sb2NhbGUgPT09ICdvYmplY3QnICYmIGdsLmxvY2FsZSkge1xuICAgICAgLy8gdnVlLWkxOG4gY29tcG9zaXRpb24gbW9kZVxuICAgICAgaWYgKCd2YWx1ZScgaW4gZ2wubG9jYWxlKSBnbC5sb2NhbGUudmFsdWUgPSBsb2M7ICAgICAvLyBzZXQgcmVhY3RpdmUgdmFsdWVcbiAgICAgIGVsc2UgZ2wubG9jYWxlID0gbG9jOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmFsbGJhY2tcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbGVnYWN5IG1vZGUgb3IgcGxhaW4gc3RyaW5nXG4gICAgICBnbC5sb2NhbGUgPSBsb2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbiBzdHJpbmcgbG9jYWxlXG4gICAgfVxuICB9O1xuICAvLyA9PT0gZW5kIHJlcGxhY2UgPT09XG4gIFxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB0cmF5IGljb24gaWYgaXQgZG9lc24ndCBleGlzdCBhbmQgdXBkYXRlcyBpdHMgY29udGV4dCBtZW51LlxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBuZXcgbG9jYWxlIHRvIGFwcGx5LlxuICovXG5cblxuXG5leHBvcnQgY29uc3QgdXBkYXRlU3lzdGVtVHJheSA9IChsb2NhbGUpID0+IHtcbiAgICBzZXRMb2NhbGUobG9jYWxlKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IHQgPSAoaykgPT4gaTE4bi5nbG9iYWwudChrKTsgICAgICAgICAgICAgICAgICAgICAgLy8gYWx3YXlzIHJlc29sdmUgbGl2ZVxuICBcbiAgICBpZiAoIXRyYXkpIHtcbiAgICAgIHRyYXkgPSBuZXcgVHJheShnZXRUcmF5SWNvblBhdGgoKSk7XG4gICAgICB0cmF5Lm9uKCdjbGljaycsICgpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2dnbGUgd2luZG93XG4gICAgICAgIFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5pc1Zpc2libGUoKSBcbiAgICAgICAgICA/IFdpbmRvd0hhbmRsZXIubWFpbndpbmRvdy5oaWRlKCkgXG4gICAgICAgICAgOiBXaW5kb3dIYW5kbGVyLm1haW53aW5kb3cuc2hvdygpO1xuICAgICAgfSk7XG4gICAgfVxuICBcbiAgICAvLyBidWlsZCBjb250ZXh0IG1lbnUgd2l0aCBjdXJyZW50IGxvY2FsZVxuICAgIGNvbnN0IGNvbnRleHRNZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZShbXG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkucmVzdG9yZScpLCBjbGljazogKCkgPT4gV2luZG93SGFuZGxlci5tYWlud2luZG93LnNob3coKSB9LCAvLyBzaG93IHdpbmRvd1xuICAgICAgeyBsYWJlbDogdCgnbWFpbi50cmF5LmRpc2Nvbm5lY3QnKSwgY2xpY2s6ICgpID0+IHsgXG4gICAgICAgICAgbG9nLmluZm8oXCJtYWluIEAgc3lzdGVtdHJheTogcmVtb3ZpbmcgcmVnaXN0cmF0aW9uXCIpOyBcbiAgICAgICAgICBDb21tSGFuZGxlci5yZXNldENvbm5lY3Rpb24oKTsgXG4gICAgICAgIH0gXG4gICAgICB9LCAvLyBkaXNjb25uZWN0XG4gICAgICB7IGxhYmVsOiB0KCdtYWluLnRyYXkuZXhpdCcpLCBjbGljazogKCkgPT4geyBcbiAgICAgICAgICBsb2cud2FybihcIm1haW4gQCBzeXN0ZW10cmF5OiBDbG9zaW5nIE5leHQtRXhhbVwiKTsgXG4gICAgICAgICAgbG9nLndhcm4oXCJtYWluIEAgc3lzdGVtdHJheTogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiKTsgXG4gICAgICAgICAgV2luZG93SGFuZGxlci5tYWlud2luZG93LmFsbG93ZXhpdCA9IHRydWU7IFxuICAgICAgICAgIGFwcC5xdWl0KCk7IFxuICAgICAgICB9IFxuICAgICAgfSAvLyBleGl0XG4gICAgXSk7XG4gIFxuICAgIHRyYXkuc2V0VG9vbFRpcCgnTmV4dC1FeGFtIFN0dWRlbnQnKTsgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRvb2x0aXBcbiAgICB0cmF5LnNldENvbnRleHRNZW51KGNvbnRleHRNZW51KTsgICAgICAgICAgICAgICAgICAgICAgIC8vIGFwcGx5IG1lbnVcbiAgfTtcbiAgLy8gPT09IGVuZCByZXBsYWNlID09PVxuICAiLCAiLyoqXG4gKiBAbGljZW5zZSBHUEwgTElDRU5TRVxuICogQ29weXJpZ2h0IChjKSAyMDIxIFRob21hcyBNaWNoYWVsIFdlaXNzZWxcbiAqIFxuICogVGhpcyBwcm9ncmFtIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXQgXG4gKiB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLFxuICogZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3IgYW55IGxhdGVyIHZlcnNpb24uXG4gKiBcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7XG4gKiB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLlxuICogU2VlIHRoZSBHTlUgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICogXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLlxuICogSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cblxuXG4vKipcbiAqIFRoaXMgc2NyaXB0IGlzIHVzZWQgdG8gdGVzdCB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBvbiBtYWNPUyBhbmQgcmVzZXQgdGhlbSBpZiBuZWVkZWRcbiAqIEl0IHVzZXMgdGhlIHRjY3V0aWwgY29tbWFuZCB0byB0ZXN0IGFuZCByZXNldCB0aGUgcGVybWlzc2lvbnNcbiAqIEl0IHJldHVybnMgdHJ1ZSBpZiB0aGUgbmV0d29yayBwZXJtaXNzaW9ucyBhcmUgYWxsb3dlZCBhbmQgZmFsc2UgaWYgdGhleSBhcmUgbm90XG4gKiBcbiAqIFRoaXMgY291bGQgYWxzbyBiZSB1c2VkIHRvIHRlc3Qgb3RoZXIgcGVybWlzc2lvbnMgbGlrZSBhY2Nlc3NpYmlsaXR5LCBzY3JlZW4gY2FwdHVyZSwgZXRjLiBcbiAqIHNlZSBjb21tdW5pY2F0aW9uaGFuZGxlci5qcyBmb3IgbW9yZSBkZXRhaWxzIG9uIGhvdyB0byB0ZXN0IGZvciBzY3JlZW5zaG90IHBlcm1pc3Npb25zIChpdHMgbm90IHBvc3NpYmxlIHRvIHRlc3QgZm9yIHNjcmVlbiBjYXB0dXJlIHBlcm1pc3Npb25zIG9uIG1hY29zIGJlY2F1c2Ugd2l0aG91dCBwZXJtaXNzaW9ucyBpdCB3aWxsIGFsd2F5cyByZXR1cm4gYSBibGFuayBzY3JlZW5zaG90IC0gd2UgdXNlIGEgd29ya2Fyb3VuZCB0byBkZXRlY3QgdGhpcylcbiAqIFxuICovXG5cblxuXG5cbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcnVuIHRjY3V0aWxcbmltcG9ydCB7IGRpYWxvZywgYXBwIH0gZnJvbSAnZWxlY3Ryb24nICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNob3cgZGlhbG9nIGFuZCBxdWl0XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cblxuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0ZXN0TmV0d29ya1Blcm1pc3Npb24oc2VydmVyaXAsIHNlcnZlckFwaVBvcnQpIHsgICAgICAgICAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGZldGNoIHdvcmtzXG4gICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwczovLyR7c2VydmVyaXB9OiR7c2VydmVyQXBpUG9ydH0vc2VydmVyL2NvbnRyb2wvcG9uZ2AsIHsgbWV0aG9kOiAnR0VUJywgY2FjaGU6ICduby1zdG9yZScgfSkgLy8gdGVzdCByZXF1ZXN0XG4gICAgICAgICAgICByZXR1cm4gcmVzLm9rXG4gICAgfSBjYXRjaCB7ICByZXR1cm4gZmFsc2UgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzZXRUQ0MoKSB7ICAgICAgLy8gcmVzZXQgVENDIHBlcm1pc3Npb25zXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy9hcHBJZFxuICAgICAgICBleGVjKGB0Y2N1dGlsIHJlc2V0IEFsbCBjb20ubmV4dGV4YW0uc3R1ZGVudGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vYXBwQnVuZGxlSWQgKHNldCB2aWEgbm90YXJpemUpXG4gICAgICAgIGV4ZWMoYHRjY3V0aWwgcmVzZXQgQWxsIGNvbS5uZXh0ZXhhbS1zdHVkZW50LmFwcGAsIChlcnIsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KHsgZXJyLCBzdGRvdXQsIHN0ZGVyciB9KVxuICAgICAgICAgICAgcmVzb2x2ZSh7IHN0ZG91dCwgc3RkZXJyIH0pXG4gICAgICAgIH0pXG5cblxuICAgIH0pXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVOZXR3b3JrT3JSZXNldChzZXJ2ZXJpcCwgc2VydmVyQXBpUG9ydCkgeyAvLyBjaGVjayBvciByZXNldFxuICAgIGNvbnN0IG9rID0gYXdhaXQgdGVzdE5ldHdvcmtQZXJtaXNzaW9uKHNlcnZlcmlwLCBzZXJ2ZXJBcGlQb3J0KVxuICAgIGlmIChvaykge1xuICAgICAgICAgICAgbG9nLmluZm8oYHRlc3RwZXJtaXNzaW9uc01hYyBAIGVuc3VyZU5ldHdvcmtPclJlc2V0OiBOZXR3b3JrIGFjY2VzcyBpcyBhbGxvd2VkYCk7XG4gICAgICAgICAgICByZXR1cm4gXCJva1wiO1xuICAgIH1cbiAgICBsb2cud2FybihgdGVzdHBlcm1pc3Npb25zTWFjIEAgZW5zdXJlTmV0d29ya09yUmVzZXQ6IE5vIEhUVFAgcmVxdWVzdHMgYWxsb3dlZCFgIClcblxuICAgIHRyeSB7XG5cbiAgICAgICAgLy8gYXNrIHRoZSB1c2VycyBpZiB0aGV5IHdhbnQgdG8gcmVzZXQgdGhlIHBlcm1pc3Npb25zIGFuZCBleGl0IHRoZSBhcHAgaWYgdGhleSBkb1xuICAgICAgICBsZXQgY2hvaWNlID0gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdxdWVzdGlvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRGVyIFNlcnZlciBpc3QgbmljaHQgZXJyZWljaGJhci4gTVx1MDBGNmNodGVuIFNpZSBkaWUgQmVyZWNodGlndW5nZW4genVyXHUwMEZDY2tzZXR6ZW4gdW5kIE5leHQtRXhhbSBtYW51ZWxsIG5ldSBzdGFydGVuPycsXG4gICAgICAgICAgICBidXR0b25zOiBbJ09LJywgJ0FiYnJlY2hlbiddLFxuICAgICAgICB9KVxuICAgICAgICBpZiAoY2hvaWNlLnJlc3BvbnNlID09PSAwKSB7ICAgIC8vIHJlc2V0IHBlcm1pc3Npb25zIGFuZCByZXR1cm4gdHJ1ZSB0byBxdWl0IHRoZSBhcHBcbiAgICAgICAgICAgIGxvZy53YXJuKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogUmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnMgYW5kIHF1aXR0aW5nIGFwcGApO1xuICAgICAgICAgICAgYXdhaXQgcmVzZXRUQ0MoKTsgXG4gICAgICAgICAgICByZXR1cm4gXCJyZXNldFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZSBcbiAgICAgICAgfSAgICAvLyBkbyBub3QgcXVpdCB0aGUgYXBwIC0ganVzdCBzaG93IHdhcm5pbmcgbWVzc2FnZVxuIFxuICAgIH0gXG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nLmVycm9yKGB0ZXN0cGVybWlzc2lvbnNNYWMgQCBlbnN1cmVOZXR3b3JrT3JSZXNldDogRXJyb3IgcmVzZXR0aW5nIG5ldHdvcmsgcGVybWlzc2lvbnM6ICR7ZX1gKTtcbiAgICAgICAgYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KHtcbiAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRmVobGVyIGJlaW0gWnVyXHUwMEZDY2tzZXR6ZW4gZGVyIEJlcmVjaHRpZ3VuZ2VuJyxcbiAgICAgICAgICAgIGRldGFpbDogU3RyaW5nKGUuZXJyIHx8IGUpLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gZmFsc2UgICAgLy8gZG8gbm90IHF1aXQgdGhlIGFwcCAtIGp1c3Qgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IGxvZyBmcm9tICdlbGVjdHJvbi1sb2cnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8vIENvdW50ZXIgZm9yIGZhaWxlZCBhdHRlbXB0cyAtIHNraXAgZXhlY3V0aW9uIGFmdGVyIDQgY29uc2VjdXRpdmUgZmFpbHVyZXNcbmxldCBmYWlsdXJlQ291bnRlciA9IDA7XG5jb25zdCBNQVhfRkFJTFVSRVMgPSAzO1xuXG4vLyBDb252ZXJ0IFJTU0kgaW4gZEJtIHRvIGEgcXVhbGl0eSBwZXJjZW50YWdlIGJldHdlZW4gMCBhbmQgMTAwLlxuZnVuY3Rpb24gZGJtVG9RdWFsaXR5UGVyY2VudChkYm0pIHtcbiAgICBpZiAoZGJtID09PSBudWxsIHx8IE51bWJlci5pc05hTihkYm0pKSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBtaW5EYm0gPSAtMTAwO1xuICAgIGNvbnN0IG1heERibSA9IC0zMDtcbiAgICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgobWluRGJtLCBNYXRoLm1pbihtYXhEYm0sIGRibSkpO1xuICAgIGNvbnN0IHBlcmNlbnQgPSAoKGNsYW1wZWQgLSBtaW5EYm0pIC8gKG1heERibSAtIG1pbkRibSkpICogMTAwO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHBlcmNlbnQpO1xufVxuXG4vKipcbiAqIEdldCBjdXJyZW50IFdMQU4gaW5mb3JtYXRpb24gKFNTSUQsIEJTU0lELCBRdWFsaXR5KVxuICogQHJldHVybnMge1Byb21pc2U8e3NzaWQ6IHN0cmluZ3xudWxsLCBic3NpZDogc3RyaW5nfG51bGwsIHF1YWxpdHk6IG51bWJlcnxudWxsLCBtZXNzYWdlOiBzdHJpbmd8bnVsbH0+fVxuICogQGRlc2NyaXB0aW9uIG1lc3NhZ2UgY2FuIGJlOiBcImVycm9yXCIgKG9uIGVycm9yKSwgXCJub2ludGVyZmFjZVwiIChubyBpbnRlcmZhY2UgYXZhaWxhYmxlKSwgXCJub3Blcm1pc3Npb25zXCIgKGxvY2F0aW9uIHBlcm1pc3Npb25zIG1pc3Npbmcgb24gV2luZG93cyksIG9yIG51bGwgKHN1Y2Nlc3MpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mbygpIHtcbiAgICAvLyBTa2lwIGV4ZWN1dGlvbiBpZiB3ZSd2ZSBoYWQgdG9vIG1hbnkgY29uc2VjdXRpdmUgZmFpbHVyZXNcbiAgICBpZiAoZmFpbHVyZUNvdW50ZXIgPj0gTUFYX0ZBSUxVUkVTKSB7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZ2l2aW5ndXAnIH07XG4gICAgfVxuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcbiAgICAgICAgbGV0IHJlc3VsdDtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBnZXRXbGFuSW5mb0xpbnV4KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZ2V0V2xhbkluZm9XaW5kb3dzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGdldFdsYW5JbmZvTWFjT1MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2dpdmluZ3VwJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBFbnN1cmUgcmVzdWx0IGlzIGFsd2F5cyBhbiBvYmplY3RcbiAgICAgICAgaWYgKCFyZXN1bHQgfHwgdHlwZW9mIHJlc3VsdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGZhaWx1cmVDb3VudGVyKys7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZXNldCBjb3VudGVyIG9uIHN1Y2Nlc3NmdWwgcmVzdWx0IChoYXMgZGF0YSlcbiAgICAgICAgaWYgKHJlc3VsdC5zc2lkIHx8IHJlc3VsdC5ic3NpZCB8fCByZXN1bHQucXVhbGl0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSW5jcmVtZW50IGNvdW50ZXIgb24gZmFpbHVyZVxuICAgICAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBSZXR1cm4gZW1wdHkgb2JqZWN0IGluc3RlYWQgb2YgdGhyb3dpbmcgdG8gcHJldmVudCBhcHAgY3Jhc2hcbiAgICAgICAgZmFpbHVyZUNvdW50ZXIrKztcbiAgICAgICAgcmV0dXJuIHsgc3NpZDogbnVsbCwgYnNzaWQ6IG51bGwsIHF1YWxpdHk6IG51bGwsIG1lc3NhZ2U6ICdlcnJvcicgfTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IFdMQU4gaW5mbyBvbiBMaW51eCB1c2luZyBubWNsaSAod2l0aCBmYWxsYmFjayB0byBpdy9pd2NvbmZpZylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9MaW51eCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUcnkgbm1jbGkgZmlyc3QgKG1vc3QgY29tbW9uIG9uIG1vZGVybiBMaW51eClcbiAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIGdldCBhY3RpdmUgZGV2aWNlIGRpcmVjdGx5IChmYXN0ZXIgdGhhbiBsaXN0aW5nIGFsbCBuZXR3b3JrcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBzdGRvdXQgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoJ25tY2xpIC10IC1mIGFjdGl2ZSxzc2lkLGJzc2lkLHNpZ25hbCBkZXZpY2Ugd2lmaSBsaXN0Jywge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA0MDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0ZG91dCA9IHJlc3VsdC5zdGRvdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4ZWNFcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIEV2ZW4gaWYgZXhlY0FzeW5jIHRocm93cyBhbiBlcnJvciwgY2hlY2sgaWYgc3Rkb3V0IGNvbnRhaW5zIHZhbGlkIGRhdGFcbiAgICAgICAgICAgICAgICAvLyBubWNsaSBzb21ldGltZXMgcmV0dXJucyBub24temVybyBleGl0IGNvZGUgYnV0IHN0aWxsIHByb3ZpZGVzIHZhbGlkIG91dHB1dFxuICAgICAgICAgICAgICAgIGlmIChleGVjRXJyb3Iuc3Rkb3V0ICYmIGV4ZWNFcnJvci5zdGRvdXQudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc3Rkb3V0ID0gZXhlY0Vycm9yLnN0ZG91dDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBleGVjRXJyb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXN0ZG91dCB8fCBzdGRvdXQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3V0cHV0IGZyb20gbm1jbGknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpbmQgYWN0aXZlIGNvbm5lY3Rpb25cbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gbGluZS5zcGxpdCgnOicpO1xuICAgICAgICAgICAgICAgIGlmICgocGFydHNbMF0gPT09ICd5ZXMnIHx8IHBhcnRzWzBdID09PSAnamEnKSAmJiBwYXJ0cy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzc2lkID0gcGFydHNbMV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIC8vIEJTU0lEIGlzIGEgTUFDIGFkZHJlc3MgKDYgaGV4IGJ5dGVzIHNlcGFyYXRlZCBieSBjb2xvbnMsIHBvc3NpYmx5IGVzY2FwZWQpXG4gICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgdXNpbmcgcmVnZXggLSBoYW5kbGUgZXNjYXBlZCBjb2xvbnMgKFxcOikgYXMgc2hvd24gaW4gbm1jbGkgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHJlZ2V4IHN0cmluZywgXFxcXDogbWF0Y2hlcyBhIGxpdGVyYWwgYmFja3NsYXNoIGZvbGxvd2VkIGJ5IGNvbG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OlxcXFw6W2EtZjAtOV17Mn0pezV9L2kpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGVzY2FwZSBiYWNrc2xhc2hlcyBhbmQgbm9ybWFsaXplIHRvIHVwcGVyY2FzZVxuICAgICAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoWzBdLnJlcGxhY2UoL1xcXFw6L2csICc6JykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB0cnkgbm9ybWFsIGNvbG9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsTWF0Y2ggPSBsaW5lLm1hdGNoKC9bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0vaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG5vcm1hbE1hdGNoWzBdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkID0gcGFydHNbMl0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gU2lnbmFsIGlzIHRoZSBsYXN0IG51bWVyaWMgcGFydFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxTdHIgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA/IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdLnRyaW0oKSA6ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWduYWwgPSBzaWduYWxTdHIgPyAocGFyc2VJbnQoc2lnbmFsU3RyLCAxMCkgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNzaWQ6IHNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogc2lnbmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAobm1jbGlFcnJvcikge1xuICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3IgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0LCBldGMuKSwgbm90IGlmIGp1c3Qgbm8gV0xBTiBhY3RpdmVcbiAgICAgICAgICAgIGNvbnN0IGlzUmVhbEVycm9yID0gbm1jbGlFcnJvci5jb2RlID09PSAnRU5PRU5UJyB8fCBubWNsaUVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobm1jbGlFcnJvci5tZXNzYWdlICYmICFubWNsaUVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoJ05vIG91dHB1dCcpKTtcbiAgICAgICAgICAgIGlmIChpc1JlYWxFcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogbm1jbGkgY29tbWFuZCBmYWlsZWQ6Jywgbm1jbGlFcnJvci5tZXNzYWdlIHx8IG5tY2xpRXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBpdyAoaXdjb25maWcgaXMgZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3U3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3IGRldiB8IGdyZXAgLUUgXCJeXFxzKnNzaWR8XlxccypsaW5rXCInLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGl3bGlua1N0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdpdyBkZXYgfCBncmVwIC1BIDUgXCJeXFxzKmxpbmtcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IFNTSURcbiAgICAgICAgICAgICAgICBjb25zdCBzc2lkTWF0Y2ggPSBpd1N0ZG91dCA/IGl3U3Rkb3V0Lm1hdGNoKC9zc2lkXFxzKyguKykvKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3NpZCA9IHNzaWRNYXRjaCA/IHNzaWRNYXRjaFsxXS50cmltKCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQlNTSUQgYW5kIHNpZ25hbCBmcm9tIGxpbmsgaW5mb1xuICAgICAgICAgICAgICAgIGNvbnN0IGJzc2lkTWF0Y2ggPSBpd2xpbmtTdGRvdXQgPyBpd2xpbmtTdGRvdXQubWF0Y2goL2FkZHI6XFxzKyhbYS1mMC05Ol17MTd9KS9pKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxNYXRjaCA9IGl3bGlua1N0ZG91dCA/IGl3bGlua1N0ZG91dC5tYXRjaCgvc2lnbmFsOlxccysoLT9cXGQrKS8pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaWduYWxEYm0gPSBzaWduYWxNYXRjaCA/IChwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zdCBxdWFsaXR5ID0gc2lnbmFsRGJtICE9PSBudWxsID8gZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWxEYm0pIDogbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkLFxuICAgICAgICAgICAgICAgICAgICBic3NpZCxcbiAgICAgICAgICAgICAgICAgICAgcXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGNhdGNoIChpd0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgaXQncyBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3RXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICBpZiAoaXNSZWFsRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb0xpbnV4OiBpdyBjb21tYW5kIGZhaWxlZDonLCBpd0Vycm9yLm1lc3NhZ2UgfHwgaXdFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIExhc3QgZmFsbGJhY2s6IGl3Y29uZmlnIChkZXByZWNhdGVkIGJ1dCB3aWRlbHkgYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2l3Y29uZmlnIDI+L2Rldi9udWxsIHwgZ3JlcCAtRSBcIkVTU0lEfEFjY2VzcyBQb2ludHxTaWduYWwgbGV2ZWxcIicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2lnbmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3NpZE1hdGNoID0gbGluZS5tYXRjaCgvRVNTSUQ6XCIoW15cIl0rKVwiLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3NpZE1hdGNoKSBzc2lkID0gc3NpZE1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBic3NpZE1hdGNoID0gbGluZS5tYXRjaCgvQWNjZXNzIFBvaW50OlxccysoW2EtZjAtOTpdezE3fSkvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnNzaWRNYXRjaCkgYnNzaWQgPSBic3NpZE1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZ25hbE1hdGNoID0gbGluZS5tYXRjaCgvU2lnbmFsIGxldmVsPSgtP1xcZCspLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2lnbmFsTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJzc2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbGl0eTogZGJtVG9RdWFsaXR5UGVyY2VudChzaWduYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGl3Y29uZmlnRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSBsb2cgaWYgYWxsIG1ldGhvZHMgZmFpbGVkIHdpdGggcmVhbCBlcnJvcnMgKGNvbW1hbmQgbm90IGZvdW5kLCB0aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1JlYWxFcnJvciA9IGl3Y29uZmlnRXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcgfHwgaXdjb25maWdFcnJvci5jb2RlID09PSAnRVRJTUVET1VUJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmVhbEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTGludXg6IEFsbCBtZXRob2RzIChubWNsaSwgaXcsIGl3Y29uZmlnKSBmYWlsZWQuIExhc3QgZXJyb3I6JywgaXdjb25maWdFcnJvci5tZXNzYWdlIHx8IGl3Y29uZmlnRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gTG9nIHVuZXhwZWN0ZWQgZXJyb3JzIGR1cmluZyBXTEFOIGluZm8gcmV0cmlldmFsXG4gICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9MaW51eDogVW5leHBlY3RlZCBlcnJvcjonLCBlcnJvci5tZXNzYWdlIHx8IGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgICAgICBic3NpZDogbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnZXJyb3InXG4gICAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIHNzaWQ6IG51bGwsXG4gICAgICAgIGJzc2lkOiBudWxsLFxuICAgICAgICBxdWFsaXR5OiBudWxsLFxuICAgICAgICBtZXNzYWdlOiAnbm9pbnRlcmZhY2UnXG4gICAgfTtcbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIFdpbmRvd3MgdXNpbmcgbmV0c2hcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0V2xhbkluZm9XaW5kb3dzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0c2ggd2xhbiBzaG93IGludGVyZmFjZXMnLCB7XG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogNjRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBzdGRlcnIgZm9yIHNlcnZpY2UgZXJyb3JzXG4gICAgICAgIGNvbnN0IGVycm9yT3V0cHV0ID0gKHN0ZGVyciB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gKHN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgY29tYmluZWRPdXRwdXQgPSBvdXRwdXQgKyAnICcgKyBlcnJvck91dHB1dDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIFdMQU4gc2VydmljZSBpcyBub3QgcnVubmluZyAodmFyaW91cyBsYW5ndWFnZSB2ZXJzaW9ucylcbiAgICAgICAgaWYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuc3ZjJykgfHwgXG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnd2xhbiBhdXRvY29uZmlnJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdhdXRvbWF0aXNjaCB3bGFuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3bGFuLWtvbmZpZ3VyYXRpb24nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3dpcmQgbmljaHQgYXVzZ2VmXHUwMEZDaHJ0JykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc2VydmljZSBpcyBub3QgcnVubmluZycpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnZGVyIGRpZW5zdCcpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCd3aXJkIG5pY2h0IGF1c2dlZlx1MDBGQ2hydCcpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgV2luZG93cyAxMSBsb2NhdGlvbiBwZXJtaXNzaW9uIHJlcXVpcmVtZW50ICh2YXJpb3VzIGxhbmd1YWdlIHZlcnNpb25zKVxuICAgICAgICBpZiAoY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0YmVyZWNodGlndW5nZW4nKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWdlbicpIHx8IGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdiZW5cdTAwRjZ0aWd0JykpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgJiYgY29tYmluZWRPdXRwdXQuaW5jbHVkZXMoJ3JlcXVpcmVkJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdkYXRlbnNjaHV0eicpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkT3V0cHV0LmluY2x1ZGVzKCdsb2NhdGlvbicpIHx8XG4gICAgICAgICAgICBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnbmV0endlcmtzaGVsbGJlZmVobGUnKSAmJiBjb21iaW5lZE91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmICghc3Rkb3V0IHx8IHN0ZG91dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgbm8gaW50ZXJmYWNlcyBhdmFpbGFibGVcbiAgICAgICAgaWYgKHN0ZG91dC5pbmNsdWRlcygnVGhlcmUgaXMgbm8gd2lyZWxlc3MgaW50ZXJmYWNlJykgfHwgXG4gICAgICAgICAgICBzdGRvdXQuaW5jbHVkZXMoJ0VzIGdpYnQga2VpbmUgRHJhaHRsb3MtU2Nobml0dHN0ZWxsZScpIHx8XG4gICAgICAgICAgICBzdGRvdXQubWF0Y2goL05vIHdpcmVsZXNzL2kpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUubGVuZ3RoID4gMCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBic3NpZCA9IG51bGw7XG4gICAgICAgIGxldCBzaWduYWwgPSBudWxsO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgICAvLyBTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlLCBoYW5kbGVzIHZhcmlvdXMgZm9ybWF0c1xuICAgICAgICAgICAgLy8gVXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmQgdG8gZW5zdXJlIHdlIGRvbid0IG1hdGNoIFwiQlNTSURcIiAod2hpY2ggY29udGFpbnMgXCJTU0lEXCIpXG4gICAgICAgICAgICBpZiAobGluZS5tYXRjaCgvKD88IUIpU1NJRFxccyo6L2kpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC8oPzwhQilTU0lEXFxzKjpcXHMqKC4rKS9pKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkID0gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHNldCBpZiBub3QgZW1wdHkgYW5kIG5vdCBcIk4vQVwiIG9yIHNpbWlsYXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dHJhY3RlZCAmJiBleHRyYWN0ZWQubGVuZ3RoID4gMCAmJiAhZXh0cmFjdGVkLm1hdGNoKC9eKE5cXC9BfG5cXC9hfG5vbmV8a2VpbmUpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3NpZCA9IGV4dHJhY3RlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEJTU0lEIHBhcnNpbmcgLSBtb3JlIGZsZXhpYmxlIHBhdHRlcm4gbWF0Y2hpbmdcbiAgICAgICAgICAgIGVsc2UgaWYgKGxpbmUubWF0Y2goL0JTU0lEXFxzKjovaSkpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IE1BQyBhZGRyZXNzIHBhdHRlcm4gKGhhbmRsZXMgYm90aCAtIGFuZCA6IHNlcGFyYXRvcnMsIHdpdGggb3Igd2l0aG91dCBzcGFjZXMpXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9CU1NJRFxccyo6XFxzKihbYS1mMC05XXsyfSg/OlstOlxcc11bYS1mMC05XXsyfSl7NX0pL2kpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBic3NpZCA9IG1hdGNoWzFdLnJlcGxhY2UoL1stIF0vZywgJzonKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNpZ25hbCBwYXJzaW5nIC0gaGFuZGxlIHZhcmlvdXMgbG9jYWxpemVkIGZvcm1hdHMgYW5kIHBhdHRlcm5zXG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lLm1hdGNoKC9TaWduYWx8U2lnbmFsc3RcdTAwRTRya2V8SW50ZW5zaXRcdTAwRTl8U2VcdTAwRjFhbC9pKSkge1xuICAgICAgICAgICAgICAgIC8vIFRyeSBwZXJjZW50YWdlIHBhdHRlcm4gZmlyc3QgKG1vc3QgY29tbW9uKVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKFxcZCspXFxzKiUvaSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPj0gMCAmJiBwYXJzZWQgPD0gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBwYXJzZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgZEJtIHBhdHRlcm4gKG5lZ2F0aXZlIHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IGxpbmUubWF0Y2goLzpcXHMqKC0/XFxkKylcXHMqZEJtL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRibSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGRibSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWwgPSBkYm1Ub1F1YWxpdHlQZXJjZW50KGRibSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBlbXB0eSBzdHJpbmdzIHRvIG51bGxcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNzaWQ6IChzc2lkICYmIHNzaWQubGVuZ3RoID4gMCkgPyBzc2lkIDogbnVsbCxcbiAgICAgICAgICAgIGJzc2lkOiAoYnNzaWQgJiYgYnNzaWQubGVuZ3RoID4gMCkgPyBic3NpZCA6IG51bGwsXG4gICAgICAgICAgICBxdWFsaXR5OiBzaWduYWwsXG4gICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgZXJyb3IgaXMgZHVlIHRvIGxvY2F0aW9uIHBlcm1pc3Npb25zIChtaWdodCBiZSBpbiBzdGRlcnIgb3IgZXJyb3IgbWVzc2FnZSlcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gKGVycm9yLm1lc3NhZ2UgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IGVycm9yU3Rkb3V0ID0gKGVycm9yLnN0ZG91dCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZXJyb3JTdGRlcnIgPSAoZXJyb3Iuc3RkZXJyIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBjb21iaW5lZEVycm9yT3V0cHV0ID0gZXJyb3JNZXNzYWdlICsgJyAnICsgZXJyb3JTdGRvdXQgKyAnICcgKyBlcnJvclN0ZGVycjtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBXaW5kb3dzIDExIGxvY2F0aW9uIHBlcm1pc3Npb24gcmVxdWlyZW1lbnQgKHZhcmlvdXMgbGFuZ3VhZ2UgdmVyc2lvbnMpXG4gICAgICAgIGlmIChjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdzdGFuZG9ydGJlcmVjaHRpZ3VuZ2VuJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ3N0YW5kb3J0JykgJiYgKGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2Jlblx1MDBGNnRpZ2VuJykgfHwgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnYmVuXHUwMEY2dGlndCcpKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24gcGVybWlzc2lvbnMnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnbG9jYXRpb24nKSAmJiBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdyZXF1aXJlZCcpIHx8XG4gICAgICAgICAgICBjb21iaW5lZEVycm9yT3V0cHV0LmluY2x1ZGVzKCdwb3NpdGlvbnNkaWVuc3RlJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2RhdGVuc2NodXR6JykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSB8fFxuICAgICAgICAgICAgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygncHJpdmFjeScpICYmIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ2xvY2F0aW9uJykgfHxcbiAgICAgICAgICAgIGNvbWJpbmVkRXJyb3JPdXRwdXQuaW5jbHVkZXMoJ25ldHp3ZXJrc2hlbGxiZWZlaGxlJykgJiYgY29tYmluZWRFcnJvck91dHB1dC5pbmNsdWRlcygnc3RhbmRvcnQnKSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gUG93ZXJTaGVsbCBtZXRob2QgdGhhdCBkb2Vzbid0IHJlcXVpcmUgZ2VvbG9jYXRpb24gcGVybWlzc2lvbnNcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIExvZyBlcnJvciB3aGVuIGNvbW1hbmQgZXhlY3V0aW9uIGZhaWxzICh0aW1lb3V0LCBwZXJtaXNzaW9uLCBldGMuKVxuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93czogRXJyb3IgZXhlY3V0aW5nIG5ldHNoIGNvbW1hbmQ6JywgZXJyb3IubWVzc2FnZSB8fCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBXTEFOIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsIChmYWxsYmFjayB3aGVuIG5ldHNoIHJlcXVpcmVzIGdlb2xvY2F0aW9uIHBlcm1pc3Npb25zKVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRXbGFuSW5mb1dpbmRvd3NQb3dlclNoZWxsKCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEdldCBTU0lEIHVzaW5nIEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSAoZG9lc24ndCByZXF1aXJlIGdlb2xvY2F0aW9uKVxuICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGFjdGl2ZSBXaS1GaSBjb25uZWN0aW9uIHByb2ZpbGVcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Bvd2Vyc2hlbGwgLUNvbW1hbmQgXCIkcHJvZmlsZSA9IEdldC1OZXRDb25uZWN0aW9uUHJvZmlsZSB8IFdoZXJlLU9iamVjdCB7JF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpLUZpKlxcJyAtb3IgJF8uSW50ZXJmYWNlQWxpYXMgLWxpa2UgXFwnKldpcmVsZXNzKlxcJ30gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxOyBpZiAoJHByb2ZpbGUpIHsgJHByb2ZpbGUuTmFtZSB9XCInLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBzc2lkU3RyID0gc3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICBpZiAoc3NpZFN0ciAmJiBzc2lkU3RyLmxlbmd0aCA+IDAgJiYgIXNzaWRTdHIubWF0Y2goL14oTlxcL0F8blxcL2F8bm9uZXxrZWluZSkkL2kpKSB7XG4gICAgICAgICAgICAgICAgc3NpZCA9IHNzaWRTdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKHNzaWRFcnJvcikge1xuICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBCU1NJRCBjYW5ub3QgYmUgZWFzaWx5IHJldHJpZXZlZCB3aXRob3V0IG5ldHNoICh3aGljaCByZXF1aXJlcyBnZW9sb2NhdGlvbiBwZXJtaXNzaW9ucylcbiAgICAgICAgLy8gU2V0dGluZyB0byBudWxsIGFzIGZhbGxiYWNrIC0gU1NJRCBpcyB0aGUgbW9zdCBpbXBvcnRhbnQgaW5mb3JtYXRpb24gYW55d2F5XG4gICAgICAgIGNvbnN0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgXG4gICAgICAgIC8vIFF1YWxpdHkgc2V0IHRvIG51bGwgd2hlbiB1c2luZyBQb3dlclNoZWxsIGZhbGxiYWNrIChjYW4ndCBlYXNpbHkgZ2V0IHNpZ25hbCBzdHJlbmd0aCB3aXRob3V0IG5ldHNoKVxuICAgICAgICAvLyBSZXR1cm4gbm9wZXJtaXNzaW9ucyBtZXNzYWdlIHNvIGZyb250ZW5kIGNhbiBzaG93IHRoZSB3YXJuaW5nXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICBic3NpZDogYnNzaWQgfHwgbnVsbCxcbiAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICBtZXNzYWdlOiAnbm9wZXJtaXNzaW9ucydcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgZXJyb3IgaWYgUG93ZXJTaGVsbCBmYWxsYmFjayBmYWlsc1xuICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvV2luZG93c1Bvd2VyU2hlbGw6IFBvd2VyU2hlbGwgZmFsbGJhY2sgZmFpbGVkOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbn1cblxuLyoqXG4gKiBHZXQgV0xBTiBpbmZvIG9uIG1hY09TIHVzaW5nIGFpcnBvcnQgb3IgbmV0d29ya3NldHVwXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFdsYW5JbmZvTWFjT1MoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVHJ5IGFpcnBvcnQgY29tbWFuZCBmaXJzdCAoZGVwcmVjYXRlZCBidXQgc3RpbGwgYXZhaWxhYmxlIG9uIHNvbWUgc3lzdGVtcylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGFpcnBvcnQgaXMgYXZhaWxhYmxlICh1c3VhbGx5IGF0IC9TeXN0ZW0vTGlicmFyeS9Qcml2YXRlRnJhbWV3b3Jrcy9BcHBsZTgwMjExLmZyYW1ld29yay9WZXJzaW9ucy9DdXJyZW50L1Jlc291cmNlcy9haXJwb3J0KVxuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGFpcnBvcnRQYXRoIH0gPSBhd2FpdCBleGVjQXN5bmMoJ3doaWNoIGFpcnBvcnQgMj4vZGV2L251bGwgfHwgZWNobyAvU3lzdGVtL0xpYnJhcnkvUHJpdmF0ZUZyYW1ld29ya3MvQXBwbGU4MDIxMS5mcmFtZXdvcmsvVmVyc2lvbnMvQ3VycmVudC9SZXNvdXJjZXMvYWlycG9ydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAxMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFpcnBvcnQgPSBhaXJwb3J0UGF0aC50cmltKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYCR7YWlycG9ydH0gLUlgLCB7XG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IHN0ZG91dC5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgYnNzaWQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IHJzc2lEYm0gPSBudWxsO1xuICAgICAgICAgICAgbGV0IHNpZ25hbFBlcmNlbnQgPSBudWxsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdTU0lEOicpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNzaWQgPSBsaW5lLnJlcGxhY2UoJ1NTSUQ6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnQlNTSUQ6JykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBNQUMgYWRkcmVzcyBwYXR0ZXJuIHRvIGVuc3VyZSB3ZSBnZXQgdGhlIGZ1bGwgQlNTSURcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnNzaWRNYXRjaCA9IGxpbmUubWF0Y2goL0JTU0lEOlxccyooW2EtZjAtOV17Mn0oPzo6W2EtZjAtOV17Mn0pezV9KS9pKTtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZE1hdGNoID8gYnNzaWRNYXRjaFsxXS50b1VwcGVyQ2FzZSgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnYWdyQ3RsUlNTSTonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBSU1NJIGluIGRCbSAobmVnYXRpdmUgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJzc2lTdHIgPSBsaW5lLnJlcGxhY2UoJ2FnckN0bFJTU0k6JywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnNzaSA9IHJzc2lTdHIgPyAocGFyc2VJbnQocnNzaVN0ciwgMTApIHx8IG51bGwpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgcnNzaURibSA9IHJzc2k7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2xpbmsgYXV0aDonKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBbHRlcm5hdGl2ZTogc2lnbmFsIHN0cmVuZ3RoIGFzIHBlcmNlbnRhZ2UgKGlmIGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2lnbmFsTWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxkKyklLyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWduYWxNYXRjaCAmJiBzaWduYWxQZXJjZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludChzaWduYWxNYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsUGVyY2VudCA9IGlzTmFOKHBhcnNlZCkgPyBudWxsIDogcGFyc2VkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBsZXQgcXVhbGl0eSA9IG51bGw7XG4gICAgICAgICAgICBpZiAoc2lnbmFsUGVyY2VudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHF1YWxpdHkgPSBzaWduYWxQZXJjZW50O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyc3NpRGJtICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcXVhbGl0eSA9IGRibVRvUXVhbGl0eVBlcmNlbnQocnNzaURibSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzc2lkIHx8IGJzc2lkIHx8IHF1YWxpdHkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzc2lkOiBzc2lkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBudWxsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoYWlycG9ydEVycm9yKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBuZXR3b3Jrc2V0dXAgLSBvbmx5IGxvZyBpZiBpdCdzIGEgcmVhbCBlcnJvciAobm90IGp1c3Qgbm8gcGVybWlzc2lvbilcbiAgICAgICAgICAgIGlmIChhaXJwb3J0RXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcgJiYgYWlycG9ydEVycm9yLm1lc3NhZ2UgJiYgIWFpcnBvcnRFcnJvci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ2dldFdsYW5JbmZvTWFjT1M6IGFpcnBvcnQgY29tbWFuZCBmYWlsZWQ6JywgYWlycG9ydEVycm9yLm1lc3NhZ2UgfHwgYWlycG9ydEVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmFsbGJhY2s6IG5ldHdvcmtzZXR1cCBhbmQgaXBjb25maWcgKGZvciBuZXdlciBtYWNPUyB3aGVyZSBhaXJwb3J0IGlzIG5vdCBhdmFpbGFibGUpICAvLyBzeXN0ZW1fcHJvZmlsZXIgaXMgd2F5IHRvIGhlYXZ5IGFuZCBuZWVkcyBhIGxvb29vb3Qgb2YgdGltZSB0byBwcm9jZXNzXG4gICAgICAgIC8vIHRoaXMgaXMgYSBzaW1wbGUgY2FsY3VsYXRpb24uLiB3ZSBjYW4ndCByZWx5IG9uIGEgcHJvY2VzcyB0aGF0IHRha2VzIDEwcyB0byBjb21wbGV0ZSBhbmQgYmxvY2tzIHRoZSB3aG9sZSBzeXN0ZW1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSBXTEFOIGludGVyZmFjZSB1c2luZyBuZXR3b3Jrc2V0dXBcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpbnRlcmZhY2VPdXRwdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbmV0d29ya3NldHVwIC1saXN0YWxsaGFyZHdhcmVwb3J0cyB8IGF3ayBcXCcvV2ktRml8QWlyUG9ydC97Z2V0bGluZTsgcHJpbnQgJE5GfVxcJycsIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGludGVyZmFjZU5hbWUgPSBpbnRlcmZhY2VPdXRwdXQudHJpbSgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWludGVyZmFjZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBXaS1GaSBpbnRlcmZhY2UgZm91bmRcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgU1NJRCB1c2luZyBpcGNvbmZpZyBnZXRzdW1tYXJ5XG4gICAgICAgICAgICBsZXQgc3NpZCA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBhd2sgLUYnIFNTSUQgOiAnICcvIFNTSUQgOiAvIHtwcmludCAkMn0nYCwge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNzaWQgPSBzc2lkT3V0cHV0LnRyaW0oKSB8fCBudWxsO1xuICAgICAgICAgICAgfSBjYXRjaCAoc3NpZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgLy8gU1NJRCBleHRyYWN0aW9uIGZhaWxlZCwgY29udGludWUgd2l0aCBCU1NJRFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgQlNTSUQgdXNpbmcgaXBjb25maWcgZ2V0c3VtbWFyeVxuICAgICAgICAgICAgbGV0IGJzc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGJzc2lkT3V0cHV0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGlwY29uZmlnIGdldHN1bW1hcnkgXCIke2ludGVyZmFjZU5hbWV9XCIgfCBncmVwICdCU1NJRCA6JyB8IGF3ayAne3ByaW50ICQzfSdgLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDY0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYnNzaWRTdHIgPSBic3NpZE91dHB1dC50cmltKCk7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgQlNTSUQgZm9ybWF0IChNQUMgYWRkcmVzcylcbiAgICAgICAgICAgICAgICBpZiAoYnNzaWRTdHIgJiYgL15bYS1mMC05XXsyfSg/OjpbYS1mMC05XXsyfSl7NX0kL2kudGVzdChic3NpZFN0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgYnNzaWQgPSBic3NpZFN0ci50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGJzc2lkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAvLyBCU1NJRCBleHRyYWN0aW9uIGZhaWxlZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBRdWFsaXR5IHNldCB0byBudWxsIHdoZW4gdXNpbmcgZmFsbGJhY2sgKGFpcnBvcnQgbm90IGF2YWlsYWJsZSwgY2FuJ3QgZ2V0IHNpZ25hbCBzdHJlbmd0aClcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3NpZDogc3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGJzc2lkOiBic3NpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIHF1YWxpdHk6IG51bGwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAobmV0d29ya3NldHVwRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIExvZyBlcnJvciBpZiBuZXR3b3Jrc2V0dXAgZmFpbHMgd2l0aCBhIHJlYWwgZXJyb3JcbiAgICAgICAgICAgIGxvZy5lcnJvcignZ2V0V2xhbkluZm9NYWNPUzogbmV0d29ya3NldHVwL2lwY29uZmlnIGZhbGxiYWNrIGZhaWxlZDonLCBuZXR3b3Jrc2V0dXBFcnJvci5tZXNzYWdlIHx8IG5ldHdvcmtzZXR1cEVycm9yKTtcbiAgICAgICAgICAgIC8vIElmIGZhbGxiYWNrIGNvbXBsZXRlbHkgZmFpbHMsIHJldHVybiBlcnJvciBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IG51bGwsIGJzc2lkOiBudWxsLCBxdWFsaXR5OiBudWxsLCBtZXNzYWdlOiAnZXJyb3InIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBMb2cgdW5leHBlY3RlZCBlcnJvcnMgZHVyaW5nIFdMQU4gaW5mbyByZXRyaWV2YWxcbiAgICAgICAgbG9nLmVycm9yKCdnZXRXbGFuSW5mb01hY09TOiBVbmV4cGVjdGVkIGVycm9yOicsIGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ2Vycm9yJyB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyBzc2lkOiBudWxsLCBic3NpZDogbnVsbCwgcXVhbGl0eTogbnVsbCwgbWVzc2FnZTogJ25vaW50ZXJmYWNlJyB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCB7IGdldFdsYW5JbmZvIH07XG5cblxuIiwgImltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgV2luZG93SGFuZGxlciBmcm9tICcuL3dpbmRvd2hhbmRsZXIuanMnO1xuaW1wb3J0IGNvbmZpZyBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IG11bHRpY2FzdENsaWVudCBmcm9tICcuL211bHRpY2FzdGNsaWVudC5qcyc7XG5pbXBvcnQgeyB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN3aXRjaEV4YW1TZWN0aW9uKENvbW11bmljYXRpb25IYW5kbGVyLCBzZXJ2ZXJzdGF0dXMsIG5ld1NlY3Rpb25OdW1iZXIpe1xuXG4gICAgY29uc3QgY3VycmVudExvY2tlZFNlY3Rpb24gPSBtdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5sb2NrZWRTZWN0aW9uOyAvLyBDdXJyZW50IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIHNhdmluZylcbiAgICBjb25zdCBuZXdMb2NrZWRTZWN0aW9uID0gbmV3U2VjdGlvbk51bWJlcjsgLy8gTmV3IHNlY3Rpb24gbnVtYmVyIChzb3VyY2UgZm9yIGxvYWRpbmcpXG4gICAgY29uc3QgZXhhbURpciA9IGNvbmZpZy5leGFtZGlyZWN0b3J5O1xuXG4gICAgbG9nLndhcm4oYHN3aXRjaEV4YW1TZWN0aW9uOiBjaGFuZ2luZyBzZWN0aW9uIHRvICR7bmV3TG9ja2VkU2VjdGlvbiB9ICR7c2VydmVyc3RhdHVzLmV4YW1TZWN0aW9uc1tuZXdMb2NrZWRTZWN0aW9uXS5zZWN0aW9ubmFtZX0gLCBFeGFtdHlwZTogJHtzZXJ2ZXJzdGF0dXMuZXhhbVNlY3Rpb25zW25ld0xvY2tlZFNlY3Rpb25dLmV4YW10eXBlfWAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgLy9zYXZlIGFsbCBmaWxlcyBmcm9tIHRoZSBvbGQgc2VjdGlvbiAoaWYgZXhhbSBtb2RlIGlzIFwiZWRpdG9yXCIpIGFuZCBzZW5kIHRvIHRlYWNoZXIgLSB0cmlnZ2VyIHNlbmRUb1RlYWNoZXIoKVxuICAgIGlmIChtdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9PT0gXCJlZGl0b3JcIil7XG4gICAgICAgIGxvZy5pbmZvKFwic3dpdGNoRXhhbVNlY3Rpb246IHNlbmRpbmcgZXhhbSB0byB0ZWFjaGVyIChmaW5hbCBzdWJtaXQpXCIpXG5cbiAgICAgICAgLy8gc2VuZCBjdXJyZW50IHdvcmsgYXMgYmFzZTY0IHRvIHRlYWNoZXIgKHN0b3JlcyBwZGYgaW4gQUJHQUJFIGZvbGRlciB3aXRoIHN1Ym1pc3Npb24gbnVtYmVyKVxuICAgICAgICBsZXQgcGRmID0gYXdhaXQgQ29tbXVuaWNhdGlvbkhhbmRsZXIuZ2V0QmFzZTY0UERGKG11bHRpY2FzdENsaWVudC5jbGllbnRpbmZvLnN1Ym1pc3Npb25udW1iZXIsIHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbY3VycmVudExvY2tlZFNlY3Rpb25dLnNlY3Rpb25uYW1lKSAgLy8gbG9jYWwgZnVuY3Rpb24gdG8gZ2V0IGJhc2U2NCBwZGYgZnJvbSBlZGl0b3JcbiAgICAgICAgaWYgKHBkZi5zdGF0dXMgPT09IFwic3VjY2Vzc1wiKXtcbiAgICAgICAgICAgIENvbW11bmljYXRpb25IYW5kbGVyLnNlbmRCYXNlNjRQREZ0b1RlYWNoZXIocGRmLmJhc2U2NHBkZiwgY3VycmVudExvY2tlZFNlY3Rpb24pXG4gICAgICAgIH1cbiAgICB9XG4gICAgQ29tbXVuaWNhdGlvbkhhbmRsZXIuc2VuZFRvVGVhY2hlcigpOyAvL2JhY2t1cCBsb2NhbCBmaWxlcyBhbmQgc2VuZCB0byB0ZWFjaGVyIChhcmNoaXZlIHdpdGggdGltZXN0YW1wKVxuXG5cblxuXG4gICAgLy93YWl0IDEgc2Vjb25kIGFuZCBjbGVhbnVwIE5FWFQtRVhBTS1TVFVERU5ULVdPUktESVJcbiAgICBhd2FpdCBDb21tdW5pY2F0aW9uSGFuZGxlci5zbGVlcCgyMDAwKTtcblxuXG4gICAgLy8gdXBkYXRlIGV4YW10eXBlIGluIGNsaWVudGluZm9cbiAgICBtdWx0aWNhc3RDbGllbnQuY2xpZW50aW5mby5leGFtdHlwZSA9IHNlcnZlcnN0YXR1cy5leGFtU2VjdGlvbnNbbmV3TG9ja2VkU2VjdGlvbl0uZXhhbXR5cGVcbiAgICAvLyBVcGRhdGUgdGhlIGxvY2tlZCBzZWN0aW9uIEFGVEVSIHNhdmluZyB0aGUgb2xkIHN0YXRlXG4gICAgbXVsdGljYXN0Q2xpZW50LmNsaWVudGluZm8ubG9ja2VkU2VjdGlvbiA9IG5ld0xvY2tlZFNlY3Rpb247XG5cblxuXG4gICAgLy8gTU9WRSBTZWN0aW9uIEZpbGVzIHRvIGEgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBDVVJSRU5UIGxvY2tlZCBzZWN0aW9uXG4gICAgdHJ5IHtcbiAgICAgICAgLy8gUEFSVCAxOiBTQVZFIENVUlJFTlQgRVhBTURJUiBGSUxFUyB0byBhIHN1YmRpcmVjdG9yeSBuYW1lZCBieSB0aGUgQ1VSUkVOVCBsb2NrZWQgc2VjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGV4YW1EaXIpICYmIGN1cnJlbnRMb2NrZWRTZWN0aW9uICE9IG51bGwgJiYgY3VycmVudExvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkgeyAvLyBDaGVjayBpZiBtYWluIGRpciBleGlzdHMgYW5kIGEgc2VjdGlvbiBpcyBjdXJyZW50bHkgYWN0aXZlXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxvZy5kZWJ1Zyhgc3dpdGNoRXhhbVNlY3Rpb246IFNhdmluZyBjb250ZW50IGZyb20gZXhhbURpciB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNhdmVQYXRoID0gYCR7ZXhhbURpcn0vJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNhdmVQYXRoKSkge1xuICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhzYXZlUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7IC8vIENyZWF0ZSBzYXZlIGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZnMucmVhZGRpclN5bmMoZXhhbURpcik7XG4gICAgICAgICAgICBsb2cuaW5mbyhgc3dpdGNoRXhhbVNlY3Rpb246IEZvdW5kICR7ZmlsZXMubGVuZ3RofSBpdGVtcyBpbiBleGFtRGlyIHRvIHNhdmVgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGZpbGVzU2F2ZWQgPSAwO1xuICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhvbGRQYXRoKTsgLy8gR2V0IGZpbGUgc3RhdHNcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgYWN0dWFsIEZJTEVTLCBub3QgZGlyZWN0b3JpZXMgKGxpa2UgdGhlIHNlY3Rpb24gZm9sZGVycyB0aGVtc2VsdmVzKVxuICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtzYXZlUGF0aH0vJHtmaWxlfWA7XG4gICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhvbGRQYXRoLCBuZXdQYXRoKTsgLy8gQ29weSBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkUGF0aCk7IC8vIERlbGV0ZSBvcmlnaW5hbCBmaWxlIGZyb20gZXhhbURpclxuICAgICAgICAgICAgICAgICAgICBmaWxlc1NhdmVkKys7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBzd2l0Y2hFeGFtU2VjdGlvbjogU2F2ZWQgZmlsZSAke2ZpbGV9IHRvIHNlY3Rpb24gJHtjdXJyZW50TG9ja2VkU2VjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2cuaW5mbyhgc3dpdGNoRXhhbVNlY3Rpb246IFNraXBwaW5nIG5vbi1maWxlIChmb2xkZXIpIGl0ZW0gJHtmaWxlfSBpbiBleGFtRGlyYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nLmluZm8oYHN3aXRjaEV4YW1TZWN0aW9uOiBTdWNjZXNzZnVsbHkgc2F2ZWQgJHtmaWxlc1NhdmVkfSBmaWxlcyB0byBzZWN0aW9uICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cud2Fybihgc3dpdGNoRXhhbVNlY3Rpb246IFNraXBwaW5nIHNhdmUgLSBleGFtRGlyIGV4aXN0czogJHtmcy5leGlzdHNTeW5jKGV4YW1EaXIpfSwgY3VycmVudExvY2tlZFNlY3Rpb246ICR7Y3VycmVudExvY2tlZFNlY3Rpb259YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQQVJUIDI6IExPQUQgRklMRVMgZnJvbSB0aGUgc3ViZGlyZWN0b3J5IG5hbWVkIGJ5IHRoZSBORVcgbG9ja2VkIHNlY3Rpb24gdG8gZXhhbURpclxuICAgICAgICBpZiAobmV3TG9ja2VkU2VjdGlvbiAhPSBudWxsICYmIG5ld0xvY2tlZFNlY3Rpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbG9nLmRlYnVnKGBzd2l0Y2hFeGFtU2VjdGlvbjogTG9hZGluZyBjb250ZW50IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcblxuICAgICAgICAgICAgY29uc3QgbG9hZFBhdGggPSBgJHtleGFtRGlyfS8ke25ld0xvY2tlZFNlY3Rpb259YDtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGxvYWRQYXRoKSkgeyAvLyBDaGVjayBpZiB0aGUgbmV3IHNlY3Rpb24gZm9sZGVyIGV4aXN0c1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzVG9Mb2FkID0gZnMucmVhZGRpclN5bmMobG9hZFBhdGgpO1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKGBzd2l0Y2hFeGFtU2VjdGlvbjogRm91bmQgJHtmaWxlc1RvTG9hZC5sZW5ndGh9IGl0ZW1zIGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZXQgZmlsZXNDb3BpZWQgPSAwO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlc1RvTG9hZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VQYXRoID0gYCR7bG9hZFBhdGh9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXN0UGF0aCA9IGAke2V4YW1EaXJ9LyR7ZmlsZX1gO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoc291cmNlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgeyAvLyBFbnN1cmUgb25seSBmaWxlcyBhcmUgY29waWVkIGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzb3VyY2VQYXRoLCBkZXN0UGF0aCk7IC8vIENvcHkgZmlsZSB0byBleGFtRGlyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0NvcGllZCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nLmluZm8oYHN3aXRjaEV4YW1TZWN0aW9uOiBDb3BpZWQgZmlsZSAke2ZpbGV9IGZyb20gc2VjdGlvbiAke25ld0xvY2tlZFNlY3Rpb259IHRvIGV4YW1EaXJgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy53YXJuKGBzd2l0Y2hFeGFtU2VjdGlvbjogU2tpcHBpbmcgbm9uLWZpbGUgaXRlbSAke2ZpbGV9IGluIHNlY3Rpb24gJHtuZXdMb2NrZWRTZWN0aW9ufSBkaXJlY3RvcnlgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgc3dpdGNoRXhhbVNlY3Rpb246IFN1Y2Nlc3NmdWxseSBjb3BpZWQgJHtmaWxlc0NvcGllZH0gZmlsZXMgZnJvbSBzZWN0aW9uICR7bmV3TG9ja2VkU2VjdGlvbn0gdG8gZXhhbURpcmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuaW5mbyhgc3dpdGNoRXhhbVNlY3Rpb246IE5ldyBsb2NrZWQgc2VjdGlvbiBkaXJlY3RvcnkgJHtuZXdMb2NrZWRTZWN0aW9ufSBkb2VzIG5vdCBleGlzdC4gU3RhcnRpbmcgd2l0aCBhIGNsZWFuIHN0YXRlLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nLndhcm4oYHN3aXRjaEV4YW1TZWN0aW9uOiBuZXdMb2NrZWRTZWN0aW9uIGlzIGZhbHN5ICgke25ld0xvY2tlZFNlY3Rpb259KSwgc2tpcHBpbmcgZmlsZSBsb2FkYCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYHN3aXRjaEV4YW1TZWN0aW9uOiBFcnJvciBkdXJpbmcgZm9sZGVyIG9wZXJhdGlvbiAtICR7ZXJyb3J9YCk7XG4gICAgICAgIGxvZy5lcnJvcihgc3dpdGNoRXhhbVNlY3Rpb246IEVycm9yIHN0YWNrOiAke2Vycm9yLnN0YWNrfWApO1xuICAgICAgICBsb2cuZXJyb3IoYHN3aXRjaEV4YW1TZWN0aW9uOiBjdXJyZW50TG9ja2VkU2VjdGlvbjogJHtjdXJyZW50TG9ja2VkU2VjdGlvbn0sIG5ld0xvY2tlZFNlY3Rpb246ICR7bmV3TG9ja2VkU2VjdGlvbn0sIGV4YW1EaXI6ICR7ZXhhbURpcn1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiAgQWN0dWFsbHkgU1dJVENIIEVYQU0gU0VDVElPTlxuICAgICAqL1xuICAgIC8vY2xvc2UgZXhhbSB3aW5kb3cgb3IgcmVsZWFkIHRoZSBuZXcgZXhhbSBzZWN0aW9uIGluIHRoZSBzYW1lIHdpbmRvd1xuICAgIGlmIChXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cpe1xuXG5cbiAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGRldnRvb2xzIHdpbmRvdyAtIGlmIHlvdSBkb24ndCBuZXh0LWV4YW0gd2lsbCBjcmFzaCBzaWxlbnRseSBvbiByZWxvYWQgYW5kIHNlY3Rpb24gc3dpdGNoXG4gICAgICAgICAgICBpZiAoY29uZmlnLmRldmVsb3BtZW50KXtcbiAgICAgICAgICAgICAgICB3ZWJDb250ZW50cy5nZXRBbGxXZWJDb250ZW50cygpLmZvckVhY2god2MgPT4geyAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbGUgV2ViVmlld3MgZGVzIENoaWxkc1xuICAgICAgICAgICAgICAgICAgICBpZiAod2MuaG9zdFdlYkNvbnRlbnRzPy5pZCA9PT0gV2luZG93SGFuZGxlci5leGFtd2luZG93LndlYkNvbnRlbnRzLmlkICYmIHdjLmlzRGV2VG9vbHNPcGVuZWQ/LigpKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZy5pbmZvKFwic3dpdGNoRXhhbVNlY3Rpb246IGRlc3Ryb3lpbmcgZGV2dG9vbHMgd2luZG93XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB3Yy5jbG9zZURldlRvb2xzKCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFQgZGVzIFdlYlZpZXdzIHNjaGxpZVx1MDBERmVuIChhdWNoIGRldGFjaGVkKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAvL2Nsb3NlIGV4YW0gd2luZG93IGFuZCByZW9wZW4gaXQgd2l0aCB0aGUgbmV3IGV4YW0gc2VjdGlvblxuICAgICAgICAgICAgV2luZG93SGFuZGxlci5leGFtd2luZG93Lm9uY2UoJ2Nsb3NlZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cgPSBudWxsO1xuICAgICAgICAgICAgICAgIENvbW11bmljYXRpb25IYW5kbGVyLnN0YXJ0RXhhbShzZXJ2ZXJzdGF0dXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBXaW5kb3dIYW5kbGVyLmV4YW13aW5kb3cuY2xvc2UoKTtcbiAgICAgICAgICAgIFdpbmRvd0hhbmRsZXIuZXhhbXdpbmRvdy5kZXN0cm95KCk7XG5cbiAgICB9XG59IiwgImltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgbmV0IGZyb20gJ25ldCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAndXJsJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBsb2cgZnJvbSAnZWxlY3Ryb24tbG9nJztcblxubGV0IGNoaWxkID0gbnVsbDtcbmxldCBjdXJyZW50UG9ydCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldEhlbHBlclBhdGgoKSB7XG4gICAgY29uc3QgX19maWxlbmFtZSA9IGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKTtcbiAgICBjb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoX19maWxlbmFtZSk7XG4gICAgY29uc3QgbmV4dFRvTWFpbiA9IHBhdGguam9pbihfX2Rpcm5hbWUsICd2bmNwcm94eS1oZWxwZXIuY2pzJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMobmV4dFRvTWFpbikpIHJldHVybiBuZXh0VG9NYWluO1xuICAgIC8vIERldjogbWFpbiBpcyBidW5kbGVkIGluIC5xdWFzYXIvZGV2LWVsZWN0cm9uLCBoZWxwZXIgbGl2ZXMgaW4gc291cmNlIHRyZWVcbiAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICdzcmMtZWxlY3Ryb24nLCAnbWFpbicsICdzY3JpcHRzJywgJ3ZuY3Byb3h5LWhlbHBlci5janMnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RnJlZVBvcnQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3Qgc2VydmVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuICAgICAgICBzZXJ2ZXIub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgc2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlcnZlci5saXN0ZW4oMCwgJzEyNy4wLjAuMScsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGFkZHJlc3MgPSBzZXJ2ZXIuYWRkcmVzcygpO1xuICAgICAgICAgICAgY29uc3QgcG9ydCA9IHR5cGVvZiBhZGRyZXNzID09PSAnb2JqZWN0JyAmJiBhZGRyZXNzID8gYWRkcmVzcy5wb3J0IDogbnVsbDtcbiAgICAgICAgICAgIHNlcnZlci5jbG9zZSgoKSA9PiByZXNvbHZlKHBvcnQpKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JQb3J0KHBvcnQsIHRpbWVvdXRNcyA9IDE1MDApIHtcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydCA8IHRpbWVvdXRNcykge1xuICAgICAgICBjb25zdCBpc09wZW4gPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQoKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbmlzaCA9IChvcGVuKSA9PiB7XG4gICAgICAgICAgICAgICAgc29ja2V0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKG9wZW4pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNvY2tldC5zZXRUaW1lb3V0KDMwMCk7XG4gICAgICAgICAgICBzb2NrZXQub25jZSgnY29ubmVjdCcsICgpID0+IGZpbmlzaCh0cnVlKSk7XG4gICAgICAgICAgICBzb2NrZXQub25jZSgndGltZW91dCcsICgpID0+IGZpbmlzaChmYWxzZSkpO1xuICAgICAgICAgICAgc29ja2V0Lm9uY2UoJ2Vycm9yJywgKCkgPT4gZmluaXNoKGZhbHNlKSk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KHBvcnQsICcxMjcuMC4wLjEnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGZpbmlzaChmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaXNPcGVuKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RhcnRQcm94eSh7IGhvc3QsIHBvcnQgfSkge1xuICAgIGNvbnN0IHNjcmlwdFBhdGggPSBnZXRIZWxwZXJQYXRoKCk7XG5cbiAgICAvLyBXZW5uIGRlciBIZWxwZXIgYmVyZWl0cyBsXHUwMEU0dWZ0LCBlaW5mYWNoIGRlbiBiZXN0ZWhlbmRlbiBQcm94eS1Qb3J0IHp1clx1MDBGQ2NrZ2ViZW5cbiAgICBpZiAoY2hpbGQgJiYgIWNoaWxkLmtpbGxlZCAmJiBjdXJyZW50UG9ydCkge1xuICAgICAgICBsb2cuaW5mbygndm5jcHJveHkgQCBzdGFydFByb3h5OiByZXVzaW5nIGV4aXN0aW5nIGhlbHBlciBvbiB3cyBwb3J0JywgY3VycmVudFBvcnQpO1xuICAgICAgICByZXR1cm4gY3VycmVudFBvcnQ7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY3VycmVudFBvcnQgPSBhd2FpdCBnZXRGcmVlUG9ydCgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2cuZXJyb3IoJ3ZuY3Byb3h5IEAgc3RhcnRQcm94eTogZmFpbGVkIHRvIG9idGFpbiBmcmVlIHBvcnQnLCBlcnIpO1xuICAgICAgICBjdXJyZW50UG9ydCA9IG51bGw7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmICghY3VycmVudFBvcnQpIHtcbiAgICAgICAgbG9nLmVycm9yKCd2bmNwcm94eSBAIHN0YXJ0UHJveHk6IG5vIGZyZWUgcG9ydCBhdmFpbGFibGUgZm9yIHByb3h5Jyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNoaWxkID0gc3Bhd24ocHJvY2Vzcy5leGVjUGF0aCwgW3NjcmlwdFBhdGgsIGhvc3QsIFN0cmluZyhwb3J0KSwgU3RyaW5nKGN1cnJlbnRQb3J0KV0sIHtcbiAgICAgICAgICAgIHN0ZGlvOiAnaW5oZXJpdCdcbiAgICAgICAgfSk7XG4gICAgICAgIGNoaWxkLm9uKCdleGl0JywgKGNvZGUsIHNpZ25hbCkgPT4ge1xuICAgICAgICAgICAgbG9nLmluZm8oYHZuY3Byb3h5LWhlbHBlciBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX0sIHNpZ25hbCAke3NpZ25hbH1gKTtcbiAgICAgICAgICAgIGNoaWxkID0gbnVsbDtcbiAgICAgICAgICAgIGN1cnJlbnRQb3J0ID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZy5pbmZvKCd2bmNwcm94eSBAIHN0YXJ0UHJveHk6IGhlbHBlciBzcGF3bmVkIGZvciB0YXJnZXQnLCBob3N0LCBwb3J0LCAnb24gd3MgcG9ydCcsIGN1cnJlbnRQb3J0KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKCd2bmNwcm94eSBAIHN0YXJ0UHJveHk6IGZhaWxlZCB0byBzcGF3biBoZWxwZXInLCBlcnIpO1xuICAgICAgICBjaGlsZCA9IG51bGw7XG4gICAgICAgIGN1cnJlbnRQb3J0ID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcmVhZHkgPSBhd2FpdCB3YWl0Rm9yUG9ydChjdXJyZW50UG9ydCwgMzAwMCk7XG4gICAgaWYgKCFyZWFkeSkge1xuICAgICAgICBsb2cuZXJyb3IoJ3ZuY3Byb3h5IEAgc3RhcnRQcm94eTogaGVscGVyIGRpZCBub3Qgc3RhcnQgbGlzdGVuaW5nIG9uIHBvcnQnLCBjdXJyZW50UG9ydCk7XG4gICAgICAgIGlmIChjaGlsZCAmJiAhY2hpbGQua2lsbGVkKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNoaWxkLmtpbGwoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoJ3ZuY3Byb3h5IEAgc3RhcnRQcm94eTogZXJyb3Iga2lsbGluZyBub24tbGlzdGVuaW5nIGhlbHBlcicsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNoaWxkID0gbnVsbDtcbiAgICAgICAgY3VycmVudFBvcnQgPSBudWxsO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gY3VycmVudFBvcnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdG9wUHJveHkoKSB7XG4gICAgaWYgKGNoaWxkICYmICFjaGlsZC5raWxsZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNoaWxkLmtpbGwoKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nLmVycm9yKCd2bmNwcm94eSBAIHN0b3BQcm94eTogZXJyb3Iga2lsbGluZyBoZWxwZXInLCBlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjaGlsZCA9IG51bGw7XG59XG5cbiIsICJpbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnXG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKVxuXG5jb25zdCBzdXNwaWNpb3VzS2V5d29yZHMgPSBbXG4gICd0ZWFtdmlld2VyJywgJ2FueWRlc2snLCAncnVzdGRlc2snLCAndm5jJywgJ3pvb20nLCAnZGlzY29yZCcsICdza3lwZScsICd0ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICAvLyBFeGVjdXRlICd0YXNrbGlzdCAvZm8gY3N2JyAoc3RydWN0dXJlZCBmb3JtYXQsIGZhc3RlciB0aGFuIC92LCBzdGlsbCBzaG93cyBwcm9jZXNzIG5hbWVzKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ3Rhc2tsaXN0IC9mbyBjc3YnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIC8vIEV4ZWN1dGUgJ25ldHN0YXQgLWFubycgKHNob3dzIGFsbCBjb25uZWN0aW9uIHN0YXRlcyBpbmNsdWRpbmcgRVNUQUJMSVNIRUQgZm9yIHNjcmVlbnNoYXJpbmcgZGV0ZWN0aW9uKVxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25ldHN0YXQgLWFubycsIHsgXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgdGltZW91dDogMzAwMCwgIC8vIDMgc2Vjb25kIHRpbWVvdXRcbiAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAyICAvLyAyTUIgYnVmZmVyXG4gICAgfSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBSZWdleCB0byBmaW5kIDpQT1JUIGZvbGxvd2VkIGJ5IGEgc3BhY2UgKGVuc3VyZXMgZXhhY3QgcG9ydCBtYXRjaCwgZS5nLiwgOjU5MzggKVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgOiR7cG9ydH1cXFxcc2AsICdnJykgXG4gICAgICBpZiAocmVnZXgudGVzdChzdGRvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCdcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpXG5cbmNvbnN0IHN1c3BpY2lvdXNLZXl3b3JkcyA9IFtcbiAgJ3RlYW12aWV3ZXInLCAnYW55ZGVzaycsICdydXN0ZGVzaycsICd2bmMnLCAnem9vbScsICdkaXNjb3JkJywgJ3NreXBlJywnY29tLm1pY3Jvc29mdC50ZWFtcycsXG4gICdjaHJvbWVyZW1vdGVkZXNrdG9wJywgJ3NwbGFzaHRvcCcsICdkd2FnZW50JyxcbiAgJ2xvZ21laW4nLCAnc2NyZWVuY29ubmVjdCcsICd6b2hvJywgJ3BhcmFsbGVscycsJ2NoYXRncHQnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnXG5dXG5cbmNvbnN0IHN1c3BpY2lvdXNQb3J0cyA9IFtcbiAgMjAwMiwgNTIyMiwgNTY1MCwgNTkwMCwgNTkwMSwgNTkwMiwgNTkzOCxcbiAgNzA3MCwgNjc4MywgNjc4NCwgNjc4NSwgODA0MCwgODA0MSwgODA0MiwgMjExMTUsIDIxMTE2XG5dO1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1Byb2Nlc3NlcygpIHtcbiAgY29uc3QgZm91bmRLZXl3b3JkcyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdwcyBhdXgnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2Ygc3VzcGljaW91c0tleXdvcmRzKSB7XG4gICAgICBpZiAob3V0LmluY2x1ZGVzKGtleXdvcmQpKSB7XG4gICAgICAgIGZvdW5kS2V5d29yZHMucHVzaChrZXl3b3JkKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRLZXl3b3Jkc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja1BvcnRzKCkge1xuICBjb25zdCBmb3VuZFBvcnRzID0gW11cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ2xzb2YgLWkgLW4gLVAnLCB7IFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgIHRpbWVvdXQ6IDMwMDAsICAvLyAzIHNlY29uZCB0aW1lb3V0XG4gICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMiAgLy8gMk1CIGJ1ZmZlclxuICAgIH0pXG4gICAgXG4gICAgY29uc3Qgb3V0ID0gc3Rkb3V0LnRvTG93ZXJDYXNlKClcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvcnQgb2Ygc3VzcGljaW91c1BvcnRzKSB7XG4gICAgICAvLyBNYXRjaCBleGFjdCBwb3J0IG51bWJlcjogOlBPUlQgZm9sbG93ZWQgYnkgc3BhY2UsIC0+LCAoLCBvciBlbmQgb2YgbGluZVxuICAgICAgLy8gVGhpcyBwcmV2ZW50cyBtYXRjaGluZyA6NTMgaW5zaWRlIDo1MzU1NDNcbiAgICAgIGNvbnN0IHBvcnRSZWdleCA9IG5ldyBSZWdFeHAoYDoke3BvcnR9KD86XFxcXHN8LT58XFxcXCh8JClgLCAnaScpO1xuICAgICAgaWYgKHBvcnRSZWdleC50ZXN0KG91dCkpIHtcbiAgICAgICAgZm91bmRQb3J0cy5wdXNoKHBvcnQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmb3VuZFBvcnRzXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIFtdICAvLyBSZXR1cm4gZW1wdHkgb24gZXJyb3IvdGltZW91dFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5SZW1vdGVDaGVjaygpIHtcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYm90aCBjaGVja3MgaW4gcGFyYWxsZWwgd2l0aCB0aW1lb3V0XG4gICAgY29uc3QgW2ZvdW5kS2V5d29yZHMsIGZvdW5kUG9ydHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgY2hlY2tQcm9jZXNzZXMoKSxcbiAgICAgIGNoZWNrUG9ydHMoKVxuICAgIF0pXG4gICAgXG4gICAgaWYgKGZvdW5kS2V5d29yZHMubGVuZ3RoID09PSAwICYmIGZvdW5kUG9ydHMubGVuZ3RoID09PSAwKSB7IFxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IC8vIFJldHVybiBmb3VuZCBrZXl3b3JkcyBhbmQgcG9ydHNcbiAgICAgIGtleXdvcmRzOiBmb3VuZEtleXdvcmRzLFxuICAgICAgcG9ydHM6IGZvdW5kUG9ydHMsXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBmYWxzZSAgLy8gUmV0dXJuIGZhbHNlIG9uIGFueSBlcnJvclxuICB9XG59XG4iLCAiaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJ1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYylcblxuY29uc3Qgc3VzcGljaW91c0tleXdvcmRzID0gW1xuICAndGVhbXZpZXdlcicsICdhbnlkZXNrJywgJ3J1c3RkZXNrJywgJ3ZuYycsICd6b29tJywgJ2Rpc2NvcmQnLCAnc2t5cGUnLCAndGVhbXMnLFxuICAnY2hyb21lcmVtb3RlZGVza3RvcCcsICdzcGxhc2h0b3AnLCAnZHdhZ2VudCcsXG4gICdsb2dtZWluJywgJ3NjcmVlbmNvbm5lY3QnLCAnem9obycsICdwYXJhbGxlbHMnLFxuICAncmVtb3RldXRpbGl0aWVzJywgJ2cyY29tbScsICdwY3Zpc2l0JywgJ3BjdmlzaXRfc3VwcG9ydCcsICdwY3Zpc2l0X2N1c3RvbWVyJywgJ3N1cHBvcnQgMTUnLFxuXVxuXG5jb25zdCBzdXNwaWNpb3VzUG9ydHMgPSBbXG4gIDIwMDIsIDUyMjIsIDU2NTAsIDU5MDAsIDU5MDEsIDU5MDIsIDU5MzgsXG4gIDcwNzAsIDY3ODMsIDY3ODQsIDY3ODUsIDgwNDAsIDgwNDEsIDgwNDIsIDIxMTE1LCAyMTExNixcbl1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQcm9jZXNzZXMoKSB7XG4gIGNvbnN0IGZvdW5kS2V5d29yZHMgPSBbXVxuXG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygncHMgYXV4JywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBrZXl3b3JkIG9mIHN1c3BpY2lvdXNLZXl3b3Jkcykge1xuICAgICAgaWYgKG91dC5pbmNsdWRlcyhrZXl3b3JkKSkge1xuICAgICAgICBmb3VuZEtleXdvcmRzLnB1c2goa2V5d29yZClcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZvdW5kS2V5d29yZHNcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gW10gIC8vIFJldHVybiBlbXB0eSBvbiBlcnJvci90aW1lb3V0XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tQb3J0cygpIHtcbiAgY29uc3QgZm91bmRQb3J0cyA9IFtdXG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdsc29mIC1pIC1uIC1QJywgeyBcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICB0aW1lb3V0OiAzMDAwLCAgLy8gMyBzZWNvbmQgdGltZW91dFxuICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDIgIC8vIDJNQiBidWZmZXJcbiAgICB9KVxuICAgIFxuICAgIGNvbnN0IG91dCA9IHN0ZG91dC50b0xvd2VyQ2FzZSgpXG4gICAgXG4gICAgZm9yIChjb25zdCBwb3J0IG9mIHN1c3BpY2lvdXNQb3J0cykge1xuICAgICAgLy8gTWF0Y2ggZXhhY3QgcG9ydCBudW1iZXI6IDpQT1JUIGZvbGxvd2VkIGJ5IHNwYWNlLCAtPiwgKCwgb3IgZW5kIG9mIGxpbmVcbiAgICAgIC8vIFRoaXMgcHJldmVudHMgbWF0Y2hpbmcgOjUzIGluc2lkZSA6NTM1NTQzXG4gICAgICBjb25zdCBwb3J0UmVnZXggPSBuZXcgUmVnRXhwKGA6JHtwb3J0fSg/OlxcXFxzfC0+fFxcXFwofCQpYCwgJ2knKTtcbiAgICAgIGlmIChwb3J0UmVnZXgudGVzdChvdXQpKSB7XG4gICAgICAgIGZvdW5kUG9ydHMucHVzaChwb3J0KVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZm91bmRQb3J0c1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBbXSAgLy8gUmV0dXJuIGVtcHR5IG9uIGVycm9yL3RpbWVvdXRcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2soKSB7XG4gIHRyeSB7XG4gICAgLy8gUnVuIGJvdGggY2hlY2tzIGluIHBhcmFsbGVsIHdpdGggdGltZW91dFxuICAgIGNvbnN0IFtmb3VuZEtleXdvcmRzLCBmb3VuZFBvcnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGNoZWNrUHJvY2Vzc2VzKCksXG4gICAgICBjaGVja1BvcnRzKClcbiAgICBdKVxuICAgIFxuICAgIGlmIChmb3VuZEtleXdvcmRzLmxlbmd0aCA9PT0gMCAmJiBmb3VuZFBvcnRzLmxlbmd0aCA9PT0gMCkgeyBcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4geyAvLyBSZXR1cm4gZm91bmQga2V5d29yZHMgYW5kIHBvcnRzXG4gICAgICBrZXl3b3JkczogZm91bmRLZXl3b3JkcyxcbiAgICAgIHBvcnRzOiBmb3VuZFBvcnRzLFxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2UgIC8vIFJldHVybiBmYWxzZSBvbiBhbnkgZXJyb3JcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIHdpbiBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZVdpbi5qcydcbmltcG9ydCAqIGFzIG1hYyBmcm9tICcuL3JlbW90ZWNoZWNrL3JlbW90ZU1hYy5qcydcbmltcG9ydCAqIGFzIGxpbnV4IGZyb20gJy4vcmVtb3RlY2hlY2svcmVtb3RlTGluLmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuUmVtb3RlQ2hlY2socGxhdGZvcm0gPSAnd2luMzInKSB7XG4gIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykgcmV0dXJuIGF3YWl0IHdpbi5ydW5SZW1vdGVDaGVjaygpXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHJldHVybiBhd2FpdCBtYWMucnVuUmVtb3RlQ2hlY2soKVxuICByZXR1cm4gYXdhaXQgbGludXgucnVuUmVtb3RlQ2hlY2soKVxufVxuIiwgImltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgbG9nIGZyb20gJ2VsZWN0cm9uLWxvZyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLy8gRXhwYW5kZWQgYnJvd3NlciBrZXl3b3JkcyB0byBjYXRjaCBtb3JlIHZhcmlhbnRzXG5jb25zdCBicm93c2VyS2V5d29yZHMgPSBbXG4gICAgJ2Nocm9tJywgJ2Nocm9tZS5leGUnLFxuICAgICdlZGdlJywgJ21zZWRnZS5leGUnLFxuICAgICdmaXJlJywgJ2ZpcmVmb3guZXhlJyxcbiAgICAnYnJhdmUnLCAnYnJhdmUuZXhlJyxcbiAgICAnb3BlcmEnLCAnb3BlcmEuZXhlJyxcbiAgICAnYnJvd3NlcicsIC8vIEdlbmVyaWMgYnJvd3NlciBwcm9jZXNzXG4gICAgJ2lleHBsb3JlJywgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICAnc2FmYXJpJywgLy8gRm9yIG1hY09TXG5dO1xuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gb24gV2luZG93cyB1c2luZyBQb3dlclNoZWxsXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFByb2Nlc3NJbmZvV2luZG93cyhwaWQpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBvd2Vyc2hlbGwuZXhlIC1Ob0xvZ28gLU5vUHJvZmlsZSAtQ29tbWFuZCBcIiYgeyAkcHJvYyA9IEdldC1DaW1JbnN0YW5jZSAtQ2xhc3MgV2luMzJfUHJvY2VzcyAtRmlsdGVyICdQcm9jZXNzSWQ9JHtwaWR9JzsgaWYgKCRwcm9jKSB7ICRwcm9jLlBhcmVudFByb2Nlc3NJZDsgJHByb2MuTmFtZSB9IH1cImA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykubWFwKGxpbmUgPT4gbGluZS50cmltKCkpLmZpbHRlcihsaW5lID0+IGxpbmUpO1xuICAgICAgICBpZiAobGluZXMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChsaW5lc1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gbGluZXNbMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc05hTihwcGlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7IHBwaWQsIG5hbWUgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzOiBFcnJvciBmb3IgUElEICR7cGlkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHByb2Nlc3MgaW5mbyBvbiBVbml4IHN5c3RlbXMgKExpbnV4L21hY09TKVxuICogVHJpZXMgL3Byb2MgZmlyc3QgKExpbnV4IG9ubHksIGZhc3Rlc3QpLCBmYWxscyBiYWNrIHRvIHBzIGNvbW1hbmRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm9Vbml4KHBpZCkge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFRyeSAvcHJvYyBmaXJzdCAoTGludXggb25seSwgZmFzdGVzdCBtZXRob2QgfjRtcywgbm8gcHJvY2VzcyBzcGF3bilcbiAgICAgICAgY29uc3QgW3N0YXRDb250ZW50LCBjb21tQ29udGVudF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICByZWFkRmlsZShgL3Byb2MvJHtwaWR9L3N0YXRgLCAndXRmOCcpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICAgICAgICAgcmVhZEZpbGUoYC9wcm9jLyR7cGlkfS9jb21tYCwgJ3V0ZjgnKS5jYXRjaCgoKSA9PiBudWxsKVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChzdGF0Q29udGVudCkge1xuICAgICAgICAgICAgLy8gUGFyc2UgL3Byb2MvcGlkL3N0YXQ6IHBpZCAoY29tbSkgc3RhdGUgcHBpZCAuLi5cbiAgICAgICAgICAgIGNvbnN0IHN0YXRNYXRjaCA9IHN0YXRDb250ZW50Lm1hdGNoKC9eXFxkK1xccytcXCgoW14pXSspXFwpXFxzK1xcUytcXHMrKFxcZCspLyk7XG4gICAgICAgICAgICBpZiAoc3RhdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChjb21tQ29udGVudCB8fCBzdGF0TWF0Y2hbMV0pLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChzdGF0TWF0Y2hbMl0sIDEwKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEZhbGxiYWNrIHRvIHBzIGNvbW1hbmQgKHdvcmtzIG9uIGJvdGggTGludXggYW5kIG1hY09TKVxuICAgICAgICBjb25zdCBjb21tYW5kID0gYHBzIC1wICR7cGlkfSAtbyBwcGlkPSxjb21tPWA7XG4gICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoY29tbWFuZCwge1xuICAgICAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiA2NFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBwaWQgPSBwYXJzZUludChwYXJ0c1swXSwgMTApO1xuICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNOYU4ocHBpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4geyBwcGlkLCBuYW1lIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nLmVycm9yKGBjaGVja3BhcmVudCBAIGdldFByb2Nlc3NJbmZvVW5peDogRXJyb3IgZm9yIFBJRCAke3BpZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCBwcm9jZXNzIGluZm8gYmFzZWQgb24gcGxhdGZvcm1cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvY2Vzc0luZm8ocGlkKSB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuICAgIFxuICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZ2V0UHJvY2Vzc0luZm9XaW5kb3dzKHBpZCk7XG4gICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fCBwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2Nlc3NJbmZvVW5peChwaWQpOyAvLyBMaW51eC9tYWNPUzogdHJpZXMgL3Byb2MsIGZhbGxzIGJhY2sgdG8gcHNcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY2hlY2sgcGFyZW50IHByb2Nlc3NlcyBmb3IgYnJvd3NlclxuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kUGFyZW50UHJvY2VzcyhwaWQsIG1heERlcHRoLCB2aXNpdGVkUGlkcykge1xuICAgIGlmIChwaWQgPT09IDEgfHwgcGlkID09PSAwKSB7XG4gICAgICAgIGxvZy5pbmZvKCdjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSb290IFBJRCByZWFjaGVkLiBObyB3ZWIgYnJvd3NlciBmb3VuZC4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWF4RGVwdGggPD0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIFNpbGVudCByZXR1cm4gd2hlbiBtYXggZGVwdGggcmVhY2hlZFxuICAgIH1cbiAgICBcbiAgICBpZiAodmlzaXRlZFBpZHMuaGFzKHBpZCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBTaWxlbnQgcmV0dXJuIGZvciBjaXJjdWxhciByZWZlcmVuY2VzXG4gICAgfVxuICAgIFxuICAgIHZpc2l0ZWRQaWRzLmFkZChwaWQpO1xuICAgIFxuICAgIC8vIEdldCBwcm9jZXNzIGluZm8gKGdldFByb2Nlc3NJbmZvIGFscmVhZHkgaGFzIGl0cyBvd24gdGltZW91dCBwcm90ZWN0aW9uKVxuICAgIGNvbnN0IHByb2Nlc3NJbmZvID0gYXdhaXQgZ2V0UHJvY2Vzc0luZm8ocGlkKTtcbiAgICBcbiAgICBpZiAoIXByb2Nlc3NJbmZvKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgeyBwcGlkLCBuYW1lIH0gPSBwcm9jZXNzSW5mbztcbiAgICBcbiAgICAvLyBMb2cgdGhlIHByb2Nlc3MgaW5mbyBmb3IgZGVidWdnaW5nXG4gICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgZmluZFBhcmVudFByb2Nlc3M6IENoZWNraW5nIHByb2Nlc3M6ICR7bmFtZX0gKFBJRDogJHtwaWR9LCBQUElEOiAke3BwaWR9KWApO1xuICAgIFxuICAgIC8vIE1vcmUgdGhvcm91Z2ggYnJvd3NlciBkZXRlY3Rpb25cbiAgICBpZiAoYnJvd3NlcktleXdvcmRzLnNvbWUoYnJvd3NlciA9PiBuYW1lLmluY2x1ZGVzKGJyb3dzZXIpKSkge1xuICAgICAgICBsb2cuaW5mbyhgY2hlY2twYXJlbnQgQCBmaW5kUGFyZW50UHJvY2VzczogQnJvd3NlciBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKG5hbWUuaW5jbHVkZXMoJ2V4cGxvcmVyJykgfHwgcHBpZCA8PSAxKSB7XG4gICAgICAgIGxvZy5pbmZvKGBjaGVja3BhcmVudCBAIGZpbmRQYXJlbnRQcm9jZXNzOiBSZWFjaGVkIHN5c3RlbSBwcm9jZXNzIG9yIGV4cGxvcmVyYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmluZFBhcmVudFByb2Nlc3MocHBpZCwgbWF4RGVwdGggLSAxLCB2aXNpdGVkUGlkcyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIHBhcmVudCBwcm9jZXNzIGlzIGEgYnJvd3NlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tQYXJlbnRQcm9jZXNzKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZvdW5kQnJvd3NlciA9IGF3YWl0IGZpbmRQYXJlbnRQcm9jZXNzKHByb2Nlc3MucHBpZCwgNiwgbmV3IFNldCgpKTtcbiAgICAgICAgbG9nLmluZm8oYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBCcm93c2VyIGRldGVjdGlvbiByZXN1bHQ6ICR7Zm91bmRCcm93c2VyfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBmb3VuZEJyb3dzZXIgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoYGNoZWNrcGFyZW50IEAgY2hlY2tQYXJlbnRQcm9jZXNzOiBFcnJvciBpbiBicm93c2VyIGRldGVjdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZm91bmRCcm93c2VyOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICB9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7QUF1QkEsU0FBUyxZQUFBQSxpQkFBZ0I7QUFDekIsT0FBTyxRQUFRO0FBQ2YsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixPQUFPLFNBQVM7OztBQ3RCaEIsSUFBTSxTQUFTO0FBQUEsRUFDWCxhQUFhO0FBQUE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGVBQWU7QUFBQSxFQUNmLGdCQUFnQjtBQUFBLEVBQ2hCLFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUVYLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixlQUFnQjtBQUFBO0FBQUEsRUFDaEIsZUFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGVBQWdCO0FBQUE7QUFBQSxFQUNoQixpQkFBaUI7QUFBQSxFQUVqQixlQUFlO0FBQUE7QUFBQSxFQUNmLHFCQUFxQjtBQUFBO0FBQUEsRUFFckIscUJBQXFCO0FBQUEsRUFDckIsUUFBUTtBQUFBO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxhQUFhO0FBQUEsRUFDYixTQUFTO0FB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QUMvRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJleGVjU3luYyIsICJleGVjU3luYyIsICJsb2ciLCAiYXBwIiwgIkJyb3dzZXJXaW5kb3ciLCAiZ2xvYmFsU2hvcnRjdXQiLCAiVHJheSIsICJNZW51IiwgImRpYWxvZyIsICJsb2ciLCAibG9nIiwgInBhdGgiLCAiZnMiLCAiaXAiLCAiZ2F0ZXdheTRzeW5jIiwgImZzIiwgImFwcCIsICJqb2luIiwgImxvZyIsICJsb2ciLCAibG9nIiwgImNvbmZpZ1N0b3JlIiwgImFwcHNUb0Nsb3NlIiwgImFwcCIsICJjaGlsZCIsICJqb2luIiwgImNoaWxkUHJvY2VzcyIsICJsb2ciLCAiX19kaXJuYW1lIiwgImFwcHNUb0Nsb3NlIiwgInB1YmxpY0Jhc2UiLCAiam9pbiIsICJjaGlsZFByb2Nlc3MiLCAibG9nIiwgImFwcCIsICJjaGlsZCIsICJqb2luIiwgImNoaWxkUHJvY2VzcyIsICJsb2ciLCAibG9nIiwgImFwcHNUb0Nsb3NlIiwgImNoaWxkUHJvY2VzcyIsICJhcHAiLCAiam9pbiIsICJsb2ciLCAidG9nZ2xlTWFjT1NMb2NrZG93biIsICJsb2ciLCAicGF0aCIsICJfX2Rpcm5hbWUiLCAiYXBwIiwgImpvaW4iLCAiZnMiLCAiY29uZmlnIiwgImxvZyIsICJmcyIsICJqb2luIiwgInNjcmVlbiIsICJpcGNNYWluIiwgImFwcCIsICJCcm93c2VyV2luZG93IiwgIndlYkNvbnRlbnRzIiwgInBhdGgiLCAiZnMiLCAibmV0IiwgImNsaXBib2FyZCIsICJhcHAiLCAid2ViQ29udGVudHMiLCAib3MiLCAibG9nIiwgInBhdGgiLCAibG9nIiwgImZzIiwgInBhdGgiLCAicHJvY2VzcyIsICJzcGF3biIsICJhcHAiLCAibG9nIiwgIl9fZGlybmFtZSIsICJzcGF3biIsICJsb2ciLCAicHJvY2VzcyIsICJmcyIsICJwYXRoIiwgIm9zIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImxvZyIsICJhcHAiLCAicGF0aCIsICJsb2ciLCAiX19kaXJuYW1lIiwgInB1YmxpY0Jhc2UiLCAicGF0aCIsICJ0IiwgImxvZyIsICJhcHAiLCAiZXhlYyIsICJkaWFsb2ciLCAiYXBwIiwgImxvZyIsICJleGVjIiwgIm9zIiwgImxvZyIsICJpc1JlYWxFcnJvciIsICJsb2ciLCAiZnMiLCAibG9nIiwgImZzIiwgInNwYXduIiwgImZpbGVVUkxUb1BhdGgiLCAicGF0aCIsICJmcyIsICJsb2ciLCAiX19kaXJuYW1lIiwgIl9fZGlybmFtZSIsICJuZXQiLCAiY29uZmlnIiwgImxvZyIsICJ3ZWJDb250ZW50cyIsICJjbGlwYm9hcmQiLCAicGF0aCIsICJmcyIsICJlcnIiLCAib3MiLCAiYXBwIiwgInB1YmxpY0Jhc2UiLCAiZXhlY1N5bmMiLCAibG9nIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJleGVjIiwgInByb21pc2lmeSIsICJleGVjQXN5bmMiLCAic3VzcGljaW91c0tleXdvcmRzIiwgInN1c3BpY2lvdXNQb3J0cyIsICJjaGVja1Byb2Nlc3NlcyIsICJjaGVja1BvcnRzIiwgInJ1blJlbW90ZUNoZWNrIiwgImV4ZWMiLCAicHJvbWlzaWZ5IiwgImV4ZWNBc3luYyIsICJzdXNwaWNpb3VzS2V5d29yZHMiLCAic3VzcGljaW91c1BvcnRzIiwgImNoZWNrUHJvY2Vzc2VzIiwgImNoZWNrUG9ydHMiLCAicnVuUmVtb3RlQ2hlY2siLCAicnVuUmVtb3RlQ2hlY2siLCAiZXhlY1N5bmMiLCAiX19kaXJuYW1lIiwgImNvbmZpZyIsICJsb2ciLCAicnVuUmVtb3RlQ2hlY2siLCAiYWdlbnQiLCAiZnMiLCAiam9pbiIsICJpcGNNYWluIiwgInNjcmVlbiIsICJ3ZWJDb250ZW50cyIsICJlcnIiLCAiZXhlYyIsICJwcm9taXNpZnkiLCAibG9nIiwgImV4ZWNBc3luYyIsICJuYW1lIiwgInBwaWQiLCAiYXBwIiwgImxvZyIsICJNZW51IiwgIl9fZGlybmFtZSIsICJmcyIsICJwYXRoIiwgImdhdGV3YXk0c3luYyIsICJpcCIsICJ3ZWJDb250ZW50cyIsICJCcm93c2VyV2luZG93IiwgImV2ZW50IiwgInRvZ2dsZU1hY09TTG9ja2Rvd24iLCAiZGlhbG9nIiwgImdsb2JhbFNob3J0Y3V0Il0KfQo=
