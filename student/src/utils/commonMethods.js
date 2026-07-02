// gracefullyExit.js
// ES module: import { gracefullyExit } from 'commonMethods.js'
import {SignalBridge} from './signalBridge.js'

// signalBridge instance centralizes ipc calls with platform checks
const signalBridge = new SignalBridge(window);

export function gracefullyExit() {
    if (this.examtype == 'microsoft365'){
        signalBridge.send('collapse-browserview')
    }
    console.log("commonMethods.js @ gracefullyExit: gracefully exiting")

    const needsPw = !!(this.localLockdown || (this.serverstatus?.examPassword ?? "") !== ""); // is password needed
    const expected = this.localLockdown ? (this.serverstatus?.password ?? "") : (this.serverstatus?.examPassword ?? ""); // expected password
  
    this.$swal.fire({
      title: this.$t("editor.exit"),                             // title
      text: this.$t("editor.exitkiosk"),                         // text
      icon: "question",                                    // icon
      showCancelButton: true,                              // show cancel button
      cancelButtonText: this.$t("editor.cancel"),                // cancel button text
      html: needsPw ? `
        <div class="m-2 mt-4 text-start">
          <label for="localpassword" class="form-label mb-1">${this.$t("student.password")}</label>
          <input class="form-control" type="password" id="localpassword" placeholder="${this.$t("student.password")}">
        </div>
      ` : "",
      didOpen: (popup) => {
        document.getElementById('localpassword')?.focus(); // focus on password input
        
        // Transitions deaktivieren (wie im globalen Hook)
        const elementsToControl = [
          popup,
          document.querySelector('.swal2-container'),
        ];
        
        elementsToControl
          .filter(el => el)
          .forEach(el => {
            el.style.transition = 'none';
            el.style.animation = 'none';
            el.style.webkitAnimation = 'none';
            el.style.webkitTransition = 'none';
          });
      },
      preConfirm: () => {
        if (!needsPw) { signalBridge.send('gracefullyexit'); return; }    // no password needed
        const value = document.getElementById('localpassword')?.value || ""; // entered password
        if (value === expected) { signalBridge.send('gracefullyexit'); return; } // correct
        this.$swal.showValidationMessage(this.$t("general.wrongpassword"));          // warning
      }
    }).then(() => {
        if (this.examtype == 'microsoft365'){
            signalBridge.send('restore-browserview')
        }
    });
  }




 export function reconnect() {
    if (this.examtype == 'microsoft365'){
        signalBridge.send('collapse-browserview')
    }


    this.$swal.fire({
        title: this.$t("editor.reconnect"), // Dialog title
        icon: 'info', // Info icon
        showCancelButton: true, // Show cancel button
        confirmButtonText: this.$t("general.ok"), // Confirm button text
        cancelButtonText: this.$t("editor.cancel"), // Cancel button text
        // Use HTML for multiple inputs
        html: `
            <div class="nx-swal-form text-start">
                <label for="swal-input-ip" class="form-label mb-1">${this.$t("student.ip")}</label>
                <input id="swal-input-ip" class="swal2-input nx-swal-input" type="text" value="${this.serverip}" placeholder="${this.$t("student.ip")}">
                <label for="swal-input-pin" class="form-label mb-1 mt-2">${this.$t("student.pin")}</label>
                <input id="swal-input-pin" class="swal2-input nx-swal-input" type="number" value="${this.pincode}" placeholder="${this.$t("student.pin")}">
            </div>
        `,
        preConfirm: () => {
            const ip = document.getElementById('swal-input-ip').value.trim();    // Get IP value
            const pin = document.getElementById('swal-input-pin').value.trim(); // Get PIN value
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/; // Simple IP regex

            if (!ip || !ipRegex.test(ip)) {
                this.$swal.showValidationMessage(this.$t("student.invalidip")); // Show IP error message
                return false;
            }
            if (!pin) {
                this.$swal.showValidationMessage(this.$t("student.nopin")); // Show PIN error message
                return false;
            }
            return { ip: ip, pin: pin }; // Return collected values
        }
    }).then((result) => {
        if (!result.isConfirmed) {return} // User cancelled

        this.serverip = result.value.ip; // Set new IP
        this.pincode = result.value.pin; // Set new PIN

        let IPCresponse = signalBridge.sendSync('register', {clientname:this.clientname, servername:this.servername, serverip: this.serverip, pin:this.pincode }); // Send IPC message

        this.token = IPCresponse.token; // set token (used to determine server connection status)

        // Show success or error swal
        // Success copy: use reconnect text when server set reconnected or UI still shows exam mode (register path may be "new" on server).
        const successText = (IPCresponse.reconnected || this.exammode) ? this.$t("student.reconnectedinfo") : this.$t("student.registeredinfo")
        this.$swal.fire({
            title: IPCresponse.status === "success" ? "OK" : "Error", // Title based on status
            text: IPCresponse.status === "success" ? successText : IPCresponse.message, // Text based on status
            icon: IPCresponse.status, // Icon is 'success' or 'error'
            showCancelButton: false, // No cancel button
        });
        if (this.examtype == 'microsoft365'){
            signalBridge.send('restore-browserview')
        }
    });
}


export function applyPreviewWebviewHostLayout(splitview) {
    const webview = document.querySelector('#preview #webview') || document.querySelector('#webview');
    if (!webview) return;
    if (!splitview) {
        // Match PdfviewPaneRendered .embed-container: same width token + horizontal centering (avoid 80vw + top:10% drift).
        webview.style.display = 'block';
        webview.style.boxSizing = 'border-box';
        webview.style.position = 'relative';
        webview.style.top = '0';
        webview.style.height = '100%';
        webview.style.width = 'var(--nx-preview-content-width, 100%)';
        webview.style.maxWidth = '100%';
        webview.style.marginLeft = 'auto';
        webview.style.marginRight = 'auto';
    } else {
        webview.style.height = '100%';
        webview.style.width = '100%';
        webview.style.position = 'relative';
        webview.style.top = '0%';
        webview.style.display = '';
        webview.style.boxSizing = '';
        webview.style.maxWidth = '';
        webview.style.marginLeft = '';
        webview.style.marginRight = '';
    }
}

export function showUrl(url){
    this.webviewVisible = true;
    this.urlForWebview = url;

    if (this.examtype === 'microsoft365'){
        signalBridge.send('collapse-browserview');
    }

    const applyDomChanges = () => {
        const preview = document.querySelector('#preview');
        if (preview) {
            preview.style.display = 'block';
        }

        const embedcontainer = document.querySelector('#preview .embed-container');
        if (embedcontainer) {
            embedcontainer.style.display = 'none';
        }

        applyPreviewWebviewHostLayout(this.splitview);
    };

    this.$nextTick(() => applyDomChanges());
 
}
  