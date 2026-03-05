class NavigationHandler {
    constructor() {
        this.mainwindow = null
        this.authwindow = null
        this.config = null
        this.multicastClient = null
        this.multicastServer = null


    }

    init(mc, config) {
        this.multicastClient = mc
        this.config = config
    }

    createBiPLoginWin(biptest) {
        //Show Swal2 dialog

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
}