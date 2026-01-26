// scripts/SystemTrayManager.js
import { app, Tray, Menu } from 'electron'; 
import path from 'path'; // Path module import
import log from 'electron-log'; // Logging module
import WindowHandler from './windowhandler.js'; // Window manager
import CommHandler from './communicationhandler.js'; // Communication logic
import i18n from '../../../src/locales/locales.js'; // I18n instance



const __dirname = import.meta.dirname; // Get current directory

let tray = null; // Private tray instance

// Path to the app icon
const iconPath = path.join(__dirname, '../../public/icons','icon24x24.png'); 

// === replace the helper setLocale (exact block) ===
const setLocale = (loc) => {
    const gl = i18n.global;                                // get global composer
    if (gl && typeof gl.locale === 'object' && gl.locale) {
      // vue-i18n composition mode
      if ('value' in gl.locale) gl.locale.value = loc;     // set reactive value
      else gl.locale = loc;                                // fallback
    } else {
      // legacy mode or plain string
      gl.locale = loc;                                     // assign string locale
    }
  };
  // === end replace ===
  

/**
 * Initializes the tray icon if it doesn't exist and updates its context menu.
 * @param {string} locale - The new locale to apply.
 */



export const updateSystemTray = (locale) => {
    setLocale(locale);                                      // set current locale
    const t = (k) => i18n.global.t(k);                      // always resolve live
  
    if (!tray) {                                            // create tray once
      tray = new Tray(iconPath);                            // create tray icon
      tray.on('click', () => {                              // toggle window
        WindowHandler.mainwindow.isVisible() 
          ? WindowHandler.mainwindow.hide() 
          : WindowHandler.mainwindow.show();
      });
    }
  
    // build context menu with current locale
    const contextMenu = Menu.buildFromTemplate([
      { label: t('main.tray.restore'), click: () => WindowHandler.mainwindow.show() }, // show window
      { label: t('main.tray.disconnect'), click: () => { 
          log.info("main @ systemtray: removing registration"); 
          CommHandler.resetConnection(); 
        } 
      }, // disconnect
      { label: t('main.tray.exit'), click: () => { 
          log.warn("main @ systemtray: Closing Next-Exam"); 
          log.warn("main @ systemtray: ----------------------------------------"); 
          WindowHandler.mainwindow.allowexit = true; 
          app.quit(); 
        } 
      } // exit
    ]);
  
    tray.setToolTip('Next-Exam Student');                   // set tooltip
    tray.setContextMenu(contextMenu);                       // apply menu
  };
  // === end replace ===
  