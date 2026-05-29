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

import crypto from 'crypto';
import { Router } from 'express';
import log from 'electron-log';
import config from '../../../main/config.js';
import { NEXT_EXAM_API_SECRET, NEXT_EXAM_API_SECRET_HEADER } from '../../../../../shared/nextExamApiSecret.js';
import controlRoutes from './server/control.js';
import dataRoutes from './server/data.js';

export const serverRouter = Router();

/** Reject /server/* unless caller sends shared app secret (OAuth browser redirects exempt). */
function requireNextExamAppSecret(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }
    const p = req.path || '';
    if (p === '/control/oauth' || p === '/control/msauth' || (config.exposeStudents && p === '/control/connectedstudentips')) {
        return next();
    }
    const got = req.get(NEXT_EXAM_API_SECRET_HEADER);
    if (!got || typeof got !== 'string') {
        log.warn(`serverroutes @ requireNextExamAppSecret: missing header (${req.method} ${p})`);
        return res.status(403).json({ status: 'error', sender: 'server', message: 'forbidden' });
    }
    const a = Buffer.from(NEXT_EXAM_API_SECRET, 'utf8');
    const b = Buffer.from(got, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        log.warn(`serverroutes @ requireNextExamAppSecret: invalid secret (${req.method} ${p})`);
        return res.status(403).json({ status: 'error', sender: 'server', message: 'forbidden' });
    }
    return next();
}

serverRouter.use(requireNextExamAppSecret);  //this requires the shared app secret to be sent in the header of the request
serverRouter.use('/control/', controlRoutes);
serverRouter.use('/data/', dataRoutes);


