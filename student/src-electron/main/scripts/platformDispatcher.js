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


// this file is used to store the config for the environment
// it queries the environment variables and the platform and sets the config accordingly



import { execSync } from 'child_process';
import fs from 'fs';
import { join } from 'path';
import { app } from 'electron';
import log from 'electron-log';
import config from '../config.js';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import {
    detectCageInstalled,
    detectCageKioskAppImageInstalled,
    detectCageKioskDesktopInstalled,
    detectRunningInCage,
    needsCageKioskSetup,
} from './cageDetect.js';
import {
    detectRunningInWindowsKiosk,
    detectWindowsKioskInstalled,
    detectWindowsKioskProvisionComplete,
    needsWindowsKioskSetup,
} from './win/windowsKioskSetup.js';
dotenv.config();
const __dirname = import.meta.dirname;

class PlatformDispatcher {
  constructor() {

    this.platform = process.platform;
    this._arch = process.arch;
    this._env = process.env;

    this.messages = []
    this.arch = this._normalizeArch();
    this.displayServer = this._getDisplayServer();
    this.isKDE = this._isKDE();
    this.isGNOME = this._isGNOME();
    this.isUnity = this._isUNITY();
    this.isWayland = this._isWayland();
    // Linux + Windows share the same field names so the renderer/IPC layer is one code path.
    // runningInCage on win32 = process runs as the dedicated kiosk OS user.
    if (this.platform === 'linux') {
      this.cageInstalled = detectCageInstalled();
      this.runningInCage = detectRunningInCage();
      this.cageKioskAppImageInstalled = detectCageKioskAppImageInstalled();
      this.cageKioskDesktopInstalled = detectCageKioskDesktopInstalled();
      this.needsCageKioskSetup = needsCageKioskSetup();
    } else if (this.platform === 'win32') {
      this.cageInstalled = detectWindowsKioskProvisionComplete();
      this.runningInCage = detectRunningInWindowsKiosk();
      this.cageKioskAppImageInstalled = detectWindowsKioskInstalled();
      this.cageKioskDesktopInstalled = detectWindowsKioskProvisionComplete();
      this.needsCageKioskSetup = needsWindowsKioskSetup();
    } else {
      this.cageInstalled = false;
      this.runningInCage = false;
      this.cageKioskAppImageInstalled = false;
      this.cageKioskDesktopInstalled = false;
      this.needsCageKioskSetup = false;
    }
    this.isCageSession = this.runningInCage;
    // Win Assigned Access already shells the session; Electron setKiosk(true) + taskkill explorer breaks it.
    this.skipElectronKiosk = (this.platform === 'win32' && this.runningInCage);
    this.jre = this._detectJREId();
    this.publicBase = this._getPublicBase();
    this.jreDir = this._resolveJREDir();
    this.javaBin = this._resolveJavaBin();
    this.jreInfo = this._getJRE();
    
    this.homedirectory = os.homedir();
    this.desktopPath = this._getDesktopPath();
    this.tempdirectory = this._getTempdirectory();
    this.workdirectory = this._getWorkdirectory();
    this.logfile = this._getLogfile();
    this.desktopName = this._whichDesktopName();
    this.macRosettaEmulation = this._detectMacRosettaEmulation();
    this.runningUnderMacRosetta = this.macRosettaEmulation.runningUnderRosetta;
  }

  // True when Apple Silicon runs this x64 binary under Rosetta (sysctl.proc_translated).
  _detectMacRosettaEmulation() {
    const processArch = this.arch;
    if (this.platform !== 'darwin') {
      return { runningUnderRosetta: false, nativeHostArch: null, processArch, procTranslated: false };
    }
    let nativeHostArch = null;
    try {
      nativeHostArch = execSync('uname -m', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      return { runningUnderRosetta: false, nativeHostArch: null, processArch, procTranslated: false };
    }
    let procTranslated = false;
    try {
      procTranslated = Number(
        execSync('sysctl -n sysctl.proc_translated', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
      ) === 1;
    } catch {
      procTranslated = false;
    }
    const runningUnderRosetta =
      nativeHostArch === 'arm64' && processArch === 'x64' && procTranslated;
    if (runningUnderRosetta) {
      this.messages.push(
        `platformDispatcher @ _detectMacRosettaEmulation: x64 process on arm64 host (Rosetta); native=${nativeHostArch} process=${processArch}`
      );
    }
    return { runningUnderRosetta, nativeHostArch, processArch, procTranslated };
  }

  _isIOS() {
    return process.ios === true || process.env.IOS === 'true';
  }

  _whichDesktopName() {
    if (this.platform === 'win32') {
      return "explorer.exe";
    } 
    
    else if (this.platform === 'linux') {
      if (this.runningInCage) {
        return "cage";
      }
      if (this._isGNOME()) {
        return "gnome-shell";
      } else if (this._isKDE()) {
        return "plasma-shell";
      } else if (this._isUNITY()) {
        return "unity-shell";
      } else {
        return "unknown-desktop";
      }
    }
    else if (this.platform === 'darwin') {
      if (this._isIOS()) {
        return "UIKit";
      }
      return "Aqua";
    }
    else {
      return "unknown-desktop";
    }
  }

  _getPublicBase() {
    if (app.isPackaged) {
      const unpacked = join(process.resourcesPath, 'app.asar.unpacked');
      const withPublic = join(unpacked, 'public');
      return fs.existsSync(withPublic) ? withPublic : unpacked;
    }
    return join(__dirname, '../../public');
  }

  _getWorkdirectory() {
    return join(this.homedirectory, config.clientdirectory);
  }

  _getTempdirectory() {
    return join(os.tmpdir(), 'exam-tmp');
  }


  _getLogfile() {
    return join(this.workdirectory, 'next-exam-student.log');
  }

  _normalizeArch() {
    if (this._arch === 'ia32') return 'i586';
    if (['x64', 'arm64'].includes(this._arch)) return this._arch;
    this._fail(`unsupported architecture: ${this._arch}`);
  }

  _detectJREId() {
    if (this.platform === 'linux') return 'minimal-jre-11-lin';
    if (this.platform === 'win32') return 'minimal-jre-11-win';
    if (this.platform === 'darwin') {
      return this._arch === 'arm64' ? 'minimal-jre-11-mac-arm64' : 'minimal-jre-11-mac';
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
    // use bundled jre because its smaller and provides only the needed java modules
    if (config.useBundledJRE) {
      if (app.isPackaged) {
        //this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(this.publicBase, this.jre));
        return join(this.publicBase, this.jre);
      } else {
        //this.messages.push("platformDispatcher @ _resolveJREDir: !app.isPackaged: " + join(__dirname, '../../public', this.jre));
        return join(__dirname, '../../public', this.jre);
      }
    } 
    else {  // use system jre
      // Try to find Java installation using which/where command
      try {
        const javaCommand = this.platform === 'win32' ? 'where java' : 'which java';
        const javaPath = execSync(javaCommand, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        
        if (javaPath) {
          // Get the directory containing the java executable
          const javaDir = path.dirname(javaPath);
          // Go up to the JRE/JDK root (usually 2 levels up from bin/)
          const jreRoot = path.dirname(path.dirname(javaDir));
          return jreRoot;
        }
      } catch (err) {
        // Java not found in PATH
      }
      
      // If no Java found, fall back to bundled JRE
      log.warn("platformDispatcher @ _resolveJREDir: No system Java found, falling back to bundled JRE");
      if (app.isPackaged) {
        return join(this.publicBase, this.jre);
      } else {
        return join(__dirname, '../../public', this.jre);
      }
    }
  }

  _resolveJavaBin() {
    switch (this.platform) {
      case 'darwin': return ['bin', 'java'];
      case 'win32': return ['bin', 'java.exe'];
      case 'linux': return ['bin', 'java'];
      default: this._fail(`unsupported platform: ${this.platform}`);
    }
  }

  _getDisplayServer() {
    if (this.platform === 'win32') return 'windows';
    if (this.platform !== 'linux') return 'n/a';
    if (this._env.XDG_SESSION_TYPE === 'wayland') return 'wayland';
    if (this._env.XDG_SESSION_TYPE === 'x11' || this._env.DISPLAY) return 'x11';
    return 'unknown';
  }

  _getVersion(cmd) {
    try {
      const output = execSync(`${cmd} --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).split('\n')[0];
      const version = output.match(/[\d]+(\.[\d]+)+/);
      return { found: true, version: version?.[0] || 'unknown' };
    } catch {
      return { found: false, version: null };
    }
  }

  _getJRE() {
    try {
      const output = execSync('java -version', { encoding: 'utf-8', stdio: ['pipe', 'ignore', 'pipe'] });
      const version = output.match(/version "([\d._]+)"/)?.[1] || 'unknown';
      const javaHome = this._env.JAVA_HOME || '';
      return { found: true, version, path: javaHome };
    } catch {
      return { found: false, version: null, path: null };
    }
  }

  _isWayland() {
    return this._env.XDG_SESSION_TYPE === 'wayland';
  }

  _isKDE() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      return out === 'KDE';
    } catch {
      //this.messages.push("platformDispatcher @ _isKDE: no data");
      return false;
    }
  }

  _isGNOME() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().toLowerCase();
      return out.includes('gnome');
    } catch (err) {
      //this.messages.push("platformDispatcher @ _isGNOME: no data");
      return false;
    }
  }

  _isUNITY() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().toLowerCase();
      return out.includes('unity');
    } catch (err) {
      //this.messages.push("platformDispatcher @ _isUNITY: no data");
      return false;
    }
  }

  _setupDesktopPath() {
    this.desktopPath = this._getDesktopPath();
  }

  _getDesktopPath() {
    if (this.platform === 'win32') {
      return path.join(process.env['USERPROFILE'], 'Desktop');
    } else {
      return path.join(os.homedir(), 'Desktop');
    }
  }

  _fail(msg) {
      throw new Error(`[platformDispatcher] ${msg}`);
  }

}

const platformDispatcher = new PlatformDispatcher();
export default platformDispatcher;
