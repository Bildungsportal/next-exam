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

import fs from 'fs';
import os from 'os';
import path, { join } from 'path';
import { app } from 'electron';
import config from '../config.js';

const __dirname = import.meta.dirname;

class PlatformDispatcher {
    constructor() {
        this.platform = process.platform;
        this.arch = process.arch;
        this._env = process.env;

        this.messages = [];
        this.displayServer = this._getDisplayServer();
        this.publicBase = this._getPublicBase();

        this.homedirectory = os.homedir();
        this.desktopPath = this._getDesktopPath();
        this.tempdirectory = this._getTempdirectory();
        this.workdirectory = this._getWorkdirectory();
        this.logfile = this._getLogfile();
        this.desktopName = this._whichDesktopName();
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
        const base = config.serverdirectory || 'EXAM-TEACHER';
        return join(this.homedirectory, base);
    }

    _getTempdirectory() {
        return join(os.tmpdir(), 'exam-tmp');
    }

    _getLogfile() {
        return join(this.workdirectory, 'next-exam-teacher.log');
    }

    _getDisplayServer() {
        if (this.platform !== 'linux') return 'n/a';
        if (this._env.XDG_SESSION_TYPE === 'wayland') return 'wayland';
        if (this._env.XDG_SESSION_TYPE === 'x11' || this._env.DISPLAY) return 'x11';
        return 'unknown';
    }

    _whichDesktopName() {
        if (this.platform === 'win32') return 'explorer.exe';
        if (this.platform === 'darwin') return 'Aqua';
        if (this.platform !== 'linux') return 'unknown-desktop';

        const cur = String(this._env.XDG_CURRENT_DESKTOP || '').toLowerCase();
        if (cur.includes('gnome')) return 'gnome-shell';
        if (cur.includes('kde')) return 'plasma-shell';
        if (cur.includes('unity')) return 'unity-shell';
        return 'unknown-desktop';
    }

    _getDesktopPath() {
        if (this.platform === 'win32') return path.join(process.env['USERPROFILE'], 'Desktop');
        return path.join(os.homedir(), 'Desktop');
    }
}

const platformDispatcher = new PlatformDispatcher();
export default platformDispatcher;
