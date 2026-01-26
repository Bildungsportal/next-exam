// gracefullyExit.js
// ES module: import { gracefullyExit } from 'commonMethods.js'

export function gracefullyExit() {
    if (this.examtype == 'microsoft365'){
        ipcRenderer.send('collapse-browserview')
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
        <div class="m-2 mt-4">
          <div class="input-group m-1 mb-1">
            <span class="input-group-text col-3" style="width:140px;">Passwort</span>
            <input class="form-control" type="password" id="localpassword" placeholder="Passwort">
          </div>
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
        if (!needsPw) { ipcRenderer.send('gracefullyexit'); return; }    // no password needed
        const value = document.getElementById('localpassword')?.value || ""; // entered password
        if (value === expected) { ipcRenderer.send('gracefullyexit'); return; } // correct
        this.$swal.showValidationMessage(this.$t("general.wrongpassword"));          // warning
      }
    }).then(() => {
        if (this.examtype == 'microsoft365'){
            ipcRenderer.send('restore-browserview')
        }
    });
  }




 export function reconnect() {
    if (this.examtype == 'microsoft365'){
        ipcRenderer.send('collapse-browserview')
    }


    this.$swal.fire({
        title: this.$t("editor.reconnect"), // Dialog title
        icon: 'info', // Info icon
        showCancelButton: true, // Show cancel button
        confirmButtonText: "OK", // Confirm button text
        // Use HTML for multiple inputs
        html: `
            <input id="swal-input-ip" class="swal2-input" type="text" value="${this.serverip}" placeholder="IP-Adresse">
            <input id="swal-input-pin" class="swal2-input" type="number" value="${this.pincode}" placeholder="PIN">
        `,
        preConfirm: () => {
            const ip = document.getElementById('swal-input-ip').value.trim();    // Get IP value
            const pin = document.getElementById('swal-input-pin').value.trim(); // Get PIN value
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/; // Simple IP regex

            if (!ip || !ipRegex.test(ip)) {
                this.$swal.showValidationMessage("Ungültige IP-Adresse."); // Show IP error message
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

        let IPCresponse = ipcRenderer.sendSync('register', {clientname:this.clientname, servername:this.servername, serverip: this.serverip, pin:this.pincode }); // Send IPC message

        this.token = IPCresponse.token; // set token (used to determine server connection status)

        // Show success or error swal
        this.$swal.fire({
            title: IPCresponse.status === "success" ? "OK" : "Error", // Title based on status
            text: IPCresponse.status === "success" ? this.$t("student.registeredinfo") : IPCresponse.message, // Text based on status
            icon: IPCresponse.status, // Icon is 'success' or 'error'
            showCancelButton: false, // No cancel button
        });
        if (this.examtype == 'microsoft365'){
            ipcRenderer.send('restore-browserview')
        }
    });
}


export function showUrl(url){
    this.webviewVisible = true
    this.urlForWebview = url;

    if (this.examtype == 'microsoft365'){
        ipcRenderer.send('collapse-browserview')
    }


    const webview = document.querySelector("#webview");
    //console.log(webview)
    if (!this.splitview){
        webview.style.height = "80vh";
        webview.style.width = "80vw";
        webview.style.position = "relative";
        webview.style.top = "10%";
    }
    else {
        webview.style.height = "100%";
        webview.style.width = "100%";
        webview.style.position = "relative";
        webview.style.top = "0%";
    }



    const embedcontainer = document.querySelector(".embed-container");
    embedcontainer.style.display = 'none';
    document.querySelector("#preview").style.display = 'block'; 
}
  