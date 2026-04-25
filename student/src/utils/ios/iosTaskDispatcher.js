/**
 * @license GPL LICENSE
 * Copyright (c) 2021 Thomas Michael Weissel
 * 
 * This program is free software: you can redistribute it and modify it 
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
 * IosTaskDispatcher is a class that dispatches tasks to the ios capacitor plugin
*/

import { Device } from '@capacitor/device';
//import { MyCustomNativePlugin } from './plugins/MyCustomNativePlugin'; 

export const IosTaskDispatcher = {
    async dispatch(signal, payload) {
        switch (signal) {
        
        /** 
         * fetches clientinfo and serverstatus from the multicastclient and returns them as an object
         * @returns {Object} {clientinfo: Object, serverstatus: Object}
         */
        case 'getinfoasync':
            return

        /**
         * fetches exam materials from the teacher and returns them as an object
         * @returns {Object} {exammaterials: Object}
         */
        case 'getmaterials':
            return 

        /**
         * submits the exam to the teacher and returns a boolean
         * @returns {Boolean} true if the exam was submitted successfully, false otherwise
         */
        case 'finalsubmit':
            return 

        /**
         * fetches the wlan info and returns it as an object
         * @returns {Object} {wlanInfo: Object}
         */
        case 'get-wlan-info':
            return await Device.getInfo(); 



        case 'submitexam':
            return 
        case 'getPDFbase64':
            return 
        case 'getbackupfile':
            return 
        case 'getfilesasync':
            return 
        case 'storeHTML':
            return 
        case 'printpdf':
            return 
        case 'checkhostip':
            return 
        case 'getScreenshotConfig':
            return { serverip: null, serverApiPort: null, clientinfo: {}, screenshotinterval: 0 }
        default:
            throw new Error(`Signal ${signal} not implemented for iOS.`);
        }
    }
};