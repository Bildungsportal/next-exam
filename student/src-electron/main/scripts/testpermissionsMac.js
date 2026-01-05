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
 * This script is used to test the network permissions on macOS and reset them if needed
 * It uses the tccutil command to test and reset the permissions
 * It returns true if the network permissions are allowed and false if they are not
 * 
 * This could also be used to test other permissions like accessibility, screen capture, etc. 
 * see communicationhandler.js for more details on how to test for screenshot permissions (its not possible to test for screen capture permissions on macos because without permissions it will always return a blank screenshot - we use a workaround to detect this)
 * 
 */




import { exec } from 'child_process'                          // run tccutil
import { dialog, app } from 'electron'                         // show dialog and quit
import log from 'electron-log';




export async function testNetworkPermission(serverip, serverApiPort) {                // returns true if fetch works
    try {
            const res = await fetch(`https://${serverip}:${serverApiPort}/server/control/pong`, { method: 'GET', cache: 'no-store' }) // test request
            return res.ok
    } catch {  return false }
}

export async function resetTCC() {      // reset TCC permissions
    return new Promise((resolve, reject) => {
        //appId
        exec(`tccutil reset All com.nextexam.student`, (err, stdout, stderr) => {
            if (err) return reject({ err, stdout, stderr })
            resolve({ stdout, stderr })
        })
        //appBundleId (set via notarize)
        exec(`tccutil reset All com.nextexam-student.app`, (err, stdout, stderr) => {
            if (err) return reject({ err, stdout, stderr })
            resolve({ stdout, stderr })
        })


    })
}

export async function ensureNetworkOrReset(serverip, serverApiPort) { // check or reset
    const ok = await testNetworkPermission(serverip, serverApiPort)
    if (ok) {
            log.info(`testpermissionsMac @ ensureNetworkOrReset: Network access is allowed`);
            return "ok";
    }
    log.warn(`testpermissionsMac @ ensureNetworkOrReset: No HTTP requests allowed!` )

    try {

        // ask the users if they want to reset the permissions and exit the app if they do
        let choice = await dialog.showMessageBox({
            type: 'question',
            message: 'Der Server ist nicht erreichbar. Möchten Sie die Berechtigungen zurücksetzen und Next-Exam manuell neu starten?',
            buttons: ['OK', 'Abbrechen'],
        })
        if (choice.response === 0) {    // reset permissions and return true to quit the app
            log.warn(`testpermissionsMac @ ensureNetworkOrReset: Resetting network permissions and quitting app`);
            await resetTCC(); 
            return "reset";
        }
        else { 
            return false 
        }    // do not quit the app - just show warning message
 
    } 
    catch (e) {
        log.error(`testpermissionsMac @ ensureNetworkOrReset: Error resetting network permissions: ${e}`);
        await dialog.showMessageBox({
            type: 'error',
            message: 'Fehler beim Zurücksetzen der Berechtigungen',
            detail: String(e.err || e),
        })
        return false    // do not quit the app - just show warning message
    }
}
