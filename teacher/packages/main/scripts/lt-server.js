import path from 'path';
import log from 'electron-log';
import { app } from 'electron'

const __dirname = import.meta.dirname;




let languageToolJarPath = path.join(__dirname, '../../public/LanguageTool/languagetool-server.jar')
if (app.isPackaged) { languageToolJarPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public/LanguageTool/languagetool-server.jar') }

let languageToolConfigPath = path.join(__dirname, '../../public/LanguageTool/server.properties')
if (app.isPackaged) { languageToolConfigPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public/LanguageTool/server.properties') }


import JreHandler from './jre-handler.js';
JreHandler.init()


class LanguageToolServer {
     constructor() {
         this.languageToolProcess = null; // Initialisiert die Prozessvariable
         this.port = 8088
     }
 
     startServer() {
         if (this.languageToolProcess && !this.languageToolProcess.killed) {
             log.warn('lt-server @ startserver: LanguageTool server is already running.');
             return; // Verhindert das erneute Starten, wenn der Server bereits läuft
         }
         try {
            this.languageToolProcess = JreHandler.jSpawn(
                [languageToolJarPath], // Klassenpfad
                'org.languagetool.server.HTTPServer', // Hauptklasse der LanguageTool API
                ['--port', this.port,'--config',languageToolConfigPath, '--allow-origin', '`*`'] // Zusätzliche Argumente, z.B. Port und CORS-Erlaubnis
            );
            //console.log( this.languageToolProcess)
            log.info('lt-server @ startserver: LanguageTool API running at localhost:8088');

            this.languageToolProcess.stdout.on('data', data => {
                log.info('lt-server @ startserver  output:', data.toString());
            });
    
            this.languageToolProcess.stderr.on('data', data => {
                if (data.toString().includes(this.port) || data.toString().includes("Adresse wird bereits verwendet")){
                    log.warn('lt-server @ startserver error: another LanguageTool server is probably already running on port:', this.port);
                }else {
                     log.error('lt-server @ startserver error:', data.toString());
                }
               
            });
    
            this.languageToolProcess.on('exit', code => {
                log.warn(`t-server @ startserver: LanguageTool server exited with code ${code}`);
                this.languageToolProcess = null; // Setzt den Prozess zurück, wenn er beendet wird
            });
        }
        catch(err){
            log.error('lt-server @ startserver error:', err);
        }


     }
 }







export default new LanguageToolServer()











