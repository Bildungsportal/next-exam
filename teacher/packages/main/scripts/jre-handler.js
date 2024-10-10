
import os from 'os';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawn } from 'child_process';
import { app } from 'electron';
import log from 'electron-log';


const __dirname = import.meta.dirname;


class JreHandler {
    constructor () {
        this.jreDir = ""
        this._arch = os.arch();
        this._platform = os.platform();
        this._driver = null
        this.jre = "minimal-jre-11-lin"   // every platform needs it's own jre (linux, win32, darwin) //fixme: use GraalVM to precompile languagetool in order to save space and get rid of jre?
    }

    init(){
        
        if (os.platform() == "linux") {  this.jre = "minimal-jre-11-lin"  }
        else if (os.platform() == "win32") {  this.jre = "minimal-jre-11-win"  }
        else if (os.platform() == "darwin") {  this.jre = "minimal-jre-11-mac"  }


        if (app.isPackaged) { this.jreDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'public', this.jre)   }
        else {                this.jreDir = path.join(__dirname, '../../public', this.jre)  }
       // log.info(this.jreDir)


        switch (this._arch) {
            case 'x64': break;
            case 'ia32': this._arch = 'i586'; break;
            default:
                this.fail('unsupported architecture: ' + this._arch);
        }

        // we obviously need a different jre installation for every plattform build... damn languagetool.. why java?
        switch (this._platform) {  
            case 'darwin': this._platform = 'macosx'; this._driver = ['Contents', 'Home', 'bin', 'java']; break;
            case 'win32': this._platform = 'windows'; this._driver = ['bin', 'javaw.exe']; break;
            case 'linux': this._driver = ['bin', 'java']; break;
            default:
                this.fail('unsupported platform: ' + this._platform);
         }
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
        var jreDirs = this.getDirectories(this.jreDir);
        if (jreDirs.length < 1){
            this.fail('no jre found in archive');
        }
        var d = this._driver.slice();
        //d.unshift(jreDirs[0]);
        d.unshift(this.jreDir);
        return path.join.apply(path, d);
    }

    getArgs(classpath, classname, args) {
        args = (args || []).slice();
        classpath = classpath || [];
        args.unshift(classname);
        args.unshift(classpath.join(this._platform === 'windows' ? ';' : ':'));
        args.unshift('-cp');
        return args;
    }

    jSpawn(classpath, classname, args) {
        
        let javapath = this.driver()
        let javaargs = this.getArgs(classpath, classname, args)
        let javacmdline =  `${javapath} ${javaargs.join(' ')} `

        log.info(`jre-handler @ jSpawn: spawning java process: ${javacmdline}`)
        return spawn(javapath, javaargs);
       // return spawn(javacmdline);
    }
}


export default new JreHandler()
