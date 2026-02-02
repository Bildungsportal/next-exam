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
import { join } from 'path';
import { app } from 'electron';
import log from 'electron-log';
import config from '../config.js';
import { pathToFileURL } from 'url';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: 'electron-builder.env' });
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
    this.flameshot = this._getVersion('flameshot');
    this.imagemagick = this._getVersion('convert');
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
        this.messages.push("platformDispatcher @ _resolveJREDir: app.isPackaged: " + join(process.resourcesPath, 'app.asar.unpacked', 'public', this.jre));
        return join(process.resourcesPath, 'app.asar.unpacked', 'public', this.jre);
      } else {
        this.messages.push("platformDispatcher @ _resolveJREDir: !app.isPackaged: " + join(__dirname, '../../public', this.jre));
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
        return join(process.resourcesPath, 'app.asar.unpacked', 'public', this.jre);
      } else {
        return join(__dirname, '../../public', this.jre);
      }
    }
  }

  _resolveJavaBin() {
    switch (this.platform) {
      case 'darwin': return ['bin', 'java'];
      case 'win32': return ['bin', 'javaw.exe'];
      case 'linux': return ['bin', 'java'];
      default: this._fail(`unsupported platform: ${this.platform}`);
    }
  }

  _getDisplayServer() {
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

  _getWorkerFileName() {
    return this.platform === 'linux' ? 'imageWorkerLinux.mjs' : 'imageWorkerSharp.mjs';
  }

  _getWorkerURL() {
    // Worker-Logik direkt anschließen
    const baseDir = app.isPackaged ? process.resourcesPath : import.meta.dirname;
    const workerPath = app.isPackaged
      ? join(baseDir, 'app.asar.unpacked', 'public', this.workerFileName)
      : join(baseDir, '../../public', this.workerFileName);
  
    return pathToFileURL(workerPath);
  }

  isWayland() {
    return this._env.XDG_SESSION_TYPE === 'wayland';
  }

  _isKDE() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      return out === 'KDE';
    } catch {
      this.messages.push("platformDispatcher @ _isKDE: no data");
      return false;
    }
  }

  _isGNOME() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().toLowerCase();
      return out.includes('gnome');
    } catch (err) {
      this.messages.push("platformDispatcher @ _isGNOME: no data");
      return false;
    }
  }

  _isUNITY() {
    try {
      const out = execSync('echo $XDG_CURRENT_DESKTOP', { shell: '/bin/bash', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().toLowerCase();
      return out.includes('unity');
    } catch (err) {
      log.warn("platformDispatcher @ _isUNITY: no data", err);
      return false;
    }
  }

  _imagemagickAvailable() {
    try {
      execSync("magick -version", { stdio: 'ignore' });
      //log.info("platformDispatcher @ _imagemagickAvailable: Found ImageMagick v7 (magick)");
      return true;
    } catch {
      try {
        execSync("which import", { stdio: 'ignore' });
        //log.info("platformDispatcher @ _imagemagickAvailable: Found ImageMagick <7 (import)");
        return true;
      } catch (err) {
        this.messages.push("platformDispatcher @ _imagemagickAvailable: ImageMagick not found");
        return false;
      }
    }
  }

  _flameshotAvailable() {
    try {
      execSync("which flameshot", { stdio: 'ignore' });
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
    if (this.platform === 'win32') {
      return path.join(process.env['USERPROFILE'], 'Desktop');
    } else {
      return path.join(os.homedir(), 'Desktop');
    }
  }

  _fail(msg) {
      throw new Error(`[platformDispatcher] ${msg}`);
  }

  _getImageMagickVersion() {
    try {
      execSync("magick -version", { stdio: 'ignore' });
      this.messages.push("platformDispatcher @ _getImageMagickVersion: Found ImageMagick v7 (magick)");
      return "7";
    } catch {
      try {
        execSync("which import", { stdio: 'ignore' });
        this.messages.push("platformDispatcher @ _getImageMagickVersion: Found ImageMagick <7 (import)");
        return "<7";
      } catch (err) {
        this.messages.push("platformDispatcher @ _getImageMagickVersion: ImageMagick not found");
        return null;
      }
    }
  }

  _getUseWorker() {
    if (this.platform === 'linux') {
      return this._imagemagickAvailable();
    } else {
      return true;
    }
  }

  _getScreenshotAbility() {
    if (this.platform === 'linux') {
      if ((this._isGNOME() || this._isUNITY()) && this.isWayland()) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: GNOME/Unity + Wayland – ScreenshotAbility set to false");
        return false;
      } else if (this._isKDE() && this.isWayland() && this._flameshotAvailable()) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: KDE/Wayland + Flameshot – ScreenshotAbility set to true");
        return true;
      } else if (!this.isWayland() && this.useWorker) {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: X11 + ImageMagick – ScreenshotAbility set to true");
        return true;
      } else {
        this.messages.push("platformDispatcher @ _getScreenshotAbility: ScreenshotAbility set to false – fallback to pagecapture");
        return false;
      }
    } else {
      return true;
    }
  }
}

const platformDispatcher = new PlatformDispatcher();
export default platformDispatcher;
