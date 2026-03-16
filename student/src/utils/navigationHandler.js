
import {useRouter} from "vue-router";

class NavigationHandler {
    constructor() {
        this.mainwindow = null
        this.authwindow = null
        this.config = null
        this.multicastClient = null
        this.multicastServer = null
        this.router = null;
        this.loggingBridge = null;
    }

    init(loggingBridge, mc, config, router) {
        this.multicastClient = mc
        this.config = config
        this.router = router;
        this.loggingBridge = loggingBridge;
    }

    createBiPLoginWin(biptest) {
        //Show Swal2 dialog
        // WebView

        if (biptest){   this.bipwindow.loadURL(`https://q.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`)   }
        else {          this.bipwindow.loadURL(`https://www.bildung.gv.at/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam`)   }

        // Electron 39: ready-to-show fires AFTER show() is called, so use did-finish-load instead
        this.bipwindow.webContents.once('did-finish-load', () => {
            if (this.bipwindow && !this.bipwindow.isVisible()) {
                this.bipwindow.show()
            }
        });

        this.bipwindow.webContents.on('did-navigate', (event, url) => {    // a pdf could contain a link ^^
            console.info("did-navigate")
            console.info(url)
        })
        this.bipwindow.webContents.on('will-navigate', (event, url) => {    // a pdf could contain a link ^^
            console.info("will-navigate")
            console.info(url)
        })

        this.bipwindow.webContents.on('new-window', (event, url) => {  // if a new window should open triggered by window.open()
            console.info("new-window")
            console.info(url)
            event.preventDefault();    // Prevent the new window from opening
        });


        this.bipwindow.webContents.setWindowOpenHandler(({ url }) => { // if a new window should open triggered by target="_blank"
            console.info("target: _blank")
            console.info(url)
            return { action: 'deny' };   // Prevent the new window from opening
        });

        this.bipwindow.webContents.on('will-redirect', (event, url) => {
            console.info('Redirecting to:', url);
            // Prüfen, ob die URL das gewünschte Format hat
            if (url.startsWith('bildungsportal://')) {
                event.preventDefault(); // Verhindert den Standard-Redirect
                const prefix = 'bildungsportal://token=';

                const token = url.substring(prefix.length);


                console.info('Captured Token:');
                console.info(token);
                this.mainwindow.webContents.send('bipToken', token);
                this.bipwindow.close();
            }
        });
    }

    startExam(serverstatus) {
        this.loggingBridge.log("NavigationHandler @ startExam: redirecting to exam page");
        this.multicastClient.clientinfo.exammode = true
        // when allowSectionSwitch: client chooses section, clientinfo.lockedSection is authoritative; do not overwrite with server
        if (!serverstatus.allowSectionSwitch || !this.multicastClient.clientinfo.lockedSection) {
            this.multicastClient.clientinfo.lockedSection = serverstatus.lockedSection;
        }
        const effectiveSection = this.multicastClient.clientinfo.lockedSection;
        this.multicastClient.clientinfo.cmargin = serverstatus.examSections[effectiveSection].cmargin  // this is used to configure margin settings for the editor
        this.multicastClient.clientinfo.linespacing = serverstatus.examSections[effectiveSection].linespacing // we try to double linespacing on demand in pdf creation
        this.multicastClient.clientinfo.audioRepeat = serverstatus.examSections[effectiveSection].audioRepeat // restrict repetition of audio files (for listening comprehension)

        this.router.push(`/${serverstatus.examSections[effectiveSection].examtype}/${this.multicastClient.clientinfo.token}/`)
        this.loggingBridge.log("After route");
        //else if (WindowHandler.examwindow){  //reconnect into active exam session with exam window already open
        //    log.error("communicationhandler @ startExam: found existing Examwindow..")
        //    try {  // switch existing window back to exam mode
        //        WindowHandler.examwindow.show()
        //        if (!this.config.development) {
        //            WindowHandler.examwindow.setFullScreen(true)  //go fullscreen again
        //            WindowHandler.examwindow.setAlwaysOnTop(true, "screen-saver", 1)  //make sure the window is 1 level above everything
        //            await enableRestrictions(WindowHandler)
        //           await this.sleep(2000) // wait an additional 2 sec for windows restrictions to kick in (they steal focus)
        //           WindowHandler.addBlurListener();
        //            // For reconnect: initialize block windows after window is repositioned
        //            await this.sleep(500)
        //            await WindowHandler.initBlockWindows()
        //           WindowHandler.examwindow.moveTop()
        //            WindowHandler.examwindow.focus()
        //        }
        //    }
        //    catch (e) { //examwindow variable is still set but the window is not managable anymore (manually closed in dev mode?)
        //        log.error("communicationhandler @ startExam: no functional examwindow found.. resetting")

        //        disableRestrictions(WindowHandler.examwindow)  //examwindow is given but not used in disableRestrictions
        //        WindowHandler.examwindow = null;
        //        this.multicastClient.clientinfo.exammode = false
        //        this.multicastClient.clientinfo.focus = true
        //        this.multicastClient.clientinfo.token = false
        //       return  // in that case.. we are finished here !
        //    }
        //}
    }
}

export default new NavigationHandler();