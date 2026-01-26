import path from 'path';
import log from 'electron-log';
import { app } from 'electron'
import JreHandler from './jre-handler.js';
import { exec } from 'child_process';
import os from 'os';
const __dirname = import.meta.dirname;


let languageToolJarPath = path.join(__dirname, '../../public/LanguageTool/languagetool-server.jar')
if (app.isPackaged) { languageToolJarPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public/LanguageTool/languagetool-server.jar') }

let languageToolConfigPath = path.join(__dirname, '../../public/LanguageTool/server.properties')
if (app.isPackaged) { languageToolConfigPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'public/LanguageTool/server.properties') }





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
                ['--port', this.port,'--config',languageToolConfigPath, '--allow-origin', "'*'" ] // Zusätzliche Argumente, z.B. Port und CORS-Erlaubnis
            );
            //console.log( this.languageToolProcess)
            log.info('lt-server @ startserver: LanguageTool API running at localhost:8088');

            this.languageToolProcess.stdout.on('data', data => {

                // log.info('lt-server @ startserver data: Received data from LanguageTool API', data.toString());
                
                const output = data.toString();
                if (output.toLowerCase().includes('error')) {
                    log.info('lt-server @ startserver  data-error:', output);
                }
                if (output.toLowerCase().includes('starting')) {
                    log.info('lt-server @ startserver  data-info:', output);
                }
                if (output.toLowerCase().includes('check done')) {
                    log.info('lt-server @ startserver  data-info:', output);
                }
                if (output.toLowerCase().includes('handled request')) {
                    log.info('lt-server @ startserver  data-info:', output);
                }
            });
    
            // Accumulate stderr data to handle chunked output
            let stderrBuffer = '';
            this.languageToolProcess.stderr.on('data', data => {
                const chunk = data.toString();
                stderrBuffer += chunk;
                const portStr = String(this.port);
                // Check both current chunk and accumulated buffer for port-related errors
                const fullResponse = stderrBuffer;
                const isPortError = fullResponse.includes(portStr) || 
                                   fullResponse.includes("Adresse wird bereits verwendet") || 
                                   fullResponse.includes("Maybe something else is running on that port") || 
                                   fullResponse.includes("Address already in use");
                
                if (isPortError) {
                    log.warn('lt-server @ startserver: another LanguageTool server is probably already running on port:', this.port);
                    stderrBuffer = ''; // Reset buffer after handling
                } else if (chunk.includes('\n') || fullResponse.length > 200) {
                    // Log error if we have a newline (likely complete message) or buffer is getting large
                    log.error('lt-server @ startserver data-error:', fullResponse.trim());
                    stderrBuffer = ''; // Reset buffer after logging
                }
            });
    
            this.languageToolProcess.on('exit', code => {
                log.warn(`lt-server @ startserver: LanguageTool server exited with code ${code}`);
                this.languageToolProcess = null; // Setzt den Prozess zurück, wenn er beendet wird
            });
        }
        catch(err){
            log.error('lt-server @ startserver general-error:', err);
        }


     }

     stopServer() {
         // Early return if server was never started
         if (!this.languageToolProcess) {
             log.info('lt-server @ stopServer: LanguageTool server was never started, nothing to stop');
             return;
         }

         // First try to kill the process directly if we have a reference
         if (!this.languageToolProcess.killed) {
             try {
                 this.languageToolProcess.kill();
                 log.info('lt-server @ stopServer: LanguageTool server process killed');
                 this.languageToolProcess = null;
                 return;
             } catch (err) {
                 log.warn('lt-server @ stopServer: failed to kill process directly, trying platform-specific method:', err);
             }
         }

         // Fallback: use platform-specific commands to kill the process (only if we had a process reference)
         const platform = os.platform();
         let command;

         if (platform === 'win32') {
             // Windows: find and kill java processes running languagetool-server.jar
             // First try wmic (works on older Windows), then try PowerShell, then fallback to port-based kill
             command = `wmic process where "commandline like '%languagetool-server.jar%'" delete 2>nul || powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*languagetool-server.jar*'} | Stop-Process -Force" 2>nul || for /f "tokens=5" %a in ('netstat -ano ^| findstr :8088') do taskkill /F /PID %a 2>nul`;
         } else if (platform === 'darwin' || platform === 'linux') {
             // macOS and Linux: use pkill to kill processes matching languagetool-server.jar
             command = 'pkill -f languagetool-server.jar';
         } else {
             log.warn('lt-server @ stopServer: unsupported platform:', platform);
             return;
         }

         exec(command, (error, stdout, stderr) => {
             if (error) {
                 // It's okay if the process is not found (already killed)
                 // pkill returns code 1 when no process is found, which is expected
                 if (error.code !== 1 && !error.message.includes('not found') && !stderr.toString().includes('No such process')) {
                     log.warn('lt-server @ stopServer: error killing LanguageTool server:', error.message);
                 } else {
                     log.info('lt-server @ stopServer: LanguageTool server process not found (may already be stopped)');
                 }
             } else {
                 log.info('lt-server @ stopServer: LanguageTool server stopped successfully');
             }
             this.languageToolProcess = null;
         });
     }
 }







export default new LanguageToolServer()











