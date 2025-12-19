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

import os from 'os';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawn } from 'child_process';
import { app } from 'electron';
import log from 'electron-log';
import platformDispatcher from './platformDispatcher.js';

const __dirname = import.meta.dirname;

 // every platform needs it's own jre (linux, win32, darwin) //fixme: use GraalVM to precompile languagetool in order to save space and get rid of jre?
class JreHandler {
    constructor () { }

    init(){ 
        this.jTest()
    }

    jTest(){
        let javapath = this.driver()
        let javacmdline =  `${javapath}  -version`
        log.info(`jre-handler @ jTest: testing java process: ${javacmdline}`)
        return spawn(javacmdline);
    }

    fail(reason) {
        log.error(reason);
        process.exit(1);
    }

    getDirectories(dirPath) {
        let dirs = fs.readdirSync(dirPath).filter(
            file => fs.statSync(path.join(dirPath, file)).isDirectory()
        );
        return dirs
    } 

    driver(){
        var d = platformDispatcher.javaBin.slice();
        d.unshift(platformDispatcher.jreDir);
        return path.join.apply(path, d);
    }

    getArgs(classpath, classname, args) {
        args = (args || []).slice();
        classpath = classpath || [];
        args.unshift(classname);
        args.unshift(classpath.join(this._platform === 'win32' ? ';' : ':'));
        args.unshift('-cp');
        return args;
    }

    jSpawn(classpath, classname, args) {
        
        let javapath = this.driver()
        let javaargs = this.getArgs(classpath, classname, args)
        let javacmdline =  `${javapath} ${javaargs.join(' ')} `

        log.info(`jre-handler @ jSpawn: '${platformDispatcher.jre}' selected`)
        log.info(`jre-handler @ jSpawn: spawning java process: ${javacmdline}`)
        return spawn(javapath, javaargs, {shell:false});
       // return spawn(javacmdline);
    }
    jTest(){
        let javapath = this.driver(); // '/pfad/zur/java'
        const proc = spawn(javapath, ['-version']);
    
        proc.stderr.on('data', data => {
            const lines = data.toString().split('\n'); // in Zeilen splitten
            log.debug(`jre-handler @ jTest: ${lines[0]}`); // nur die erste Zeile loggen
        });
    }
}


export default new JreHandler()
