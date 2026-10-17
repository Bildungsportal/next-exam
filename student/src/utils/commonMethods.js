// gracefullyExit.js
// ES module: import { gracefullyExit } from 'commonMethods.js'
import { useInfoStore } from '../stores/infoStore.ts'
import {isIOS} from "../types/platform.ts";
import {Filesystem} from "@capacitor/filesystem";

export async function getBatteryStatus(initialBatteryStatus) {
    let batteryStatus = initialBatteryStatus;
    if (!isIOS()) {
        // safari does not support navigator.getBattery() and gets battery info from swift
        batteryStatus = await navigator.getBattery().then(battery => battery)
            .catch(error => { console.error("Error accessing the Battery API:", error); });
        // same level → keep reference (no store write → no ExamHeader re-render); else plain copy
        if (batteryStatus && batteryStatus.level === initialBatteryStatus?.level) return initialBatteryStatus;
        if (batteryStatus) batteryStatus = { level: batteryStatus.level };
    }
    return batteryStatus;
}

export async function checkPathExists(getUriOptions) {
    try {
        await Filesystem.stat(getUriOptions);
        return true;
    } catch (exception) {
        if ((exception).message.includes('does not exist')) {
            return false;
        } else {
            console.error("pdfHelper @ checkFileExists: Exception during exists check: ", exception);
        }
    }
}

/**
 * Reads a file and returns its bytes. On iOS large files are read in chunks via readFile's
 * offset/length so a single huge base64 string is never materialized in native memory
 * (avoids the Swift allocation abort seen in FilesystemPlugin.readFile serialization).
 */
export async function readUint8Array(getUriOptions) {
    const toBytes = async (res) => typeof res.data === 'string'
        ? Uint8Array.from(atob(res.data), c => c.charCodeAt(0))
        : new Uint8Array(await res.data.arrayBuffer());

    if (!isIOS()) {
        return toBytes(await Filesystem.readFile(getUriOptions));
    }

    const chunkSize = 2 * 1024 * 1024; // 2 MiB
    let size = null;
    try {
        size = (await Filesystem.stat(getUriOptions)).size;
    } catch (e) {
        // stat failed (e.g. ENOENT) -> let the read surface the original error as before
    }
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
        return toBytes(await Filesystem.readFile(getUriOptions));
    }

    const chunks = [];
    let offset = 0;
    while (offset < size) {
        const length = Math.min(chunkSize, size - offset);
        const res = await Filesystem.readFile({ ...getUriOptions, offset, length });
        chunks.push(await toBytes(res));
        offset += length;
    }
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
        result.set(c, pos);
        pos += c.length;
    }
    return result;
}

export function gracefullyExit() {
    if (this.examtype == 'microsoft365'){
        window.ipcRenderer.send('collapse-browserview')
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
        if (!needsPw) { window.ipcRenderer.send('gracefullyexit'); return; }    // no password needed
        const value = document.getElementById('localpassword')?.value || ""; // entered password
        if (value === expected) { window.ipcRenderer.send('gracefullyexit'); return; } // correct
        this.$swal.showValidationMessage(this.$t("general.wrongpassword"));          // warning
      }
    }).then(() => {
        if (this.examtype == 'microsoft365'){
            window.ipcRenderer.send('restore-browserview')
        }
    });
  }


/** Register and require explicit confirmation before accepting a changed Teacher certificate. */
export async function registerWithTeacherCertificate(vm, args) {
    const response = isIOS() ? window.ipcRenderer.sendSync('register', args) : await window.ipcRenderer.invoke('register', args)
    if (response?.status !== 'fingerprint-changed') return response
    const result = await vm.$swal.fire({
        title: vm.$t('student.fingerprintChangeTitle'),
        text: vm.$t('student.fingerprintChangeText'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: vm.$t('student.fingerprintChangeConfirm'),
        cancelButtonText: vm.$t('editor.cancel'),
    })
    if (!result.isConfirmed) return null
    const accepted = await window.ipcRenderer.invoke('accept-teacher-certificate', { serverip: args.serverip })
    if (!accepted?.ok) return { status: 'error', message: vm.$t('student.registerCertError') }
    return isIOS() ? window.ipcRenderer.sendSync('register', args) : window.ipcRenderer.invoke('register', args)
}

/** Resolve locally translated registration errors returned with a stable server code. */
export function registrationErrorText(vm, response) {
    if (response?.code === 'RECONNECT_AUTH_FAILED') return vm.$t('student.reconnectFailed')
    if (response?.code === 'CLOCK_SKEW') return vm.$t('student.clockSkew')
    return response?.message
}




 export function reconnect() {
    const ms365 = this.examtype == 'microsoft365'
    const restoreMs365 = () => { if (ms365) window.ipcRenderer.send('restore-browserview') }
    if (ms365) window.ipcRenderer.send('collapse-browserview')

    const infoStore = useInfoStore();
    // Page setup copies store once; header uses storeToRefs — prefer store pin, keep page IP after disconnect reset.
    // servername can be undefined on some exam pages (eduvidual/website) or nulled by a reset — fall back to the store.
    const displayIp = this.serverip || infoStore.serverip || '';
    const displayPin = this.pincode || infoStore.pincode || '';
    const servername = this.servername || infoStore.servername || '';

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
                <input id="swal-input-ip" class="swal2-input nx-swal-input" type="text" value="${displayIp}" placeholder="${this.$t("student.ip")}">
                <label for="swal-input-pin" class="form-label mb-1 mt-2">${this.$t("student.pin")}</label>
                <input id="swal-input-pin" class="swal2-input nx-swal-input" type="number" value="${displayPin}" placeholder="${this.$t("student.pin")}">
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
    }).then(async (result) => {
        if (!result.isConfirmed) { restoreMs365(); return }

        this.serverip = result.value.ip; // Set new IP
        this.pincode = result.value.pin; // Set new PIN

        const IPCresponse = await registerWithTeacherCertificate(this, {clientname:this.clientname, servername:servername, serverip: this.serverip, pin:this.pincode })
        if (!IPCresponse) { restoreMs365(); return }

        this.token = IPCresponse.token; // set token (used to determine server connection status)

        // Show success or error swal
        // Success copy: use reconnect text when server set reconnected or UI still shows exam mode (register path may be "new" on server).
        const successText = (IPCresponse.reconnected || this.exammode) ? this.$t("student.reconnectedinfo") : this.$t("student.registeredinfo")
        this.$swal.fire({
            title: IPCresponse.status === "success" ? "OK" : "Error", // Title based on status
            text: IPCresponse.status === "success" ? successText : registrationErrorText(this, IPCresponse), // Text based on status
            icon: IPCresponse.status, // Icon is 'success' or 'error'
            showCancelButton: false, // No cancel button
        }).then(() => restoreMs365());
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

export async function showUrl(entry){
    const url = typeof entry === 'object' && entry != null && typeof entry.url === 'string' ? entry.url : entry;
    const blockSubdomains = typeof entry === 'object' && entry != null ? !!entry.blockSubdomains : false;
    const blockSubfolders = typeof entry === 'object' && entry != null ? !!entry.blockSubfolders : false;

    if (isIOS()) {
        // On iOS, use native WKWebView overlay - no Vue DOM elements needed
        // Calculate modal dimensions (matching Electron modal: 90vw × 80vh, centered)
        const modalWidth = window.innerWidth * 0.9;
        const modalHeight = window.innerHeight * 0.8;
        const modalX = (window.innerWidth - modalWidth) / 2;
        const modalY = (window.innerHeight - modalHeight) / 2;

        try {
            await window.ipcRenderer.invoke('open-allowed-url', {
                url: url,
                frame: {
                    x: modalX,
                    y: modalY,
                    width: modalWidth,
                    height: modalHeight
                },
                blockSubdomains: blockSubdomains,
                blockSubfolders: blockSubfolders
            });
        } catch (err) {
            console.error('IPC error opening URL:', err);
        }
        return;
    }

    this.webviewVisible = true;
    this.urlForWebview = url;

    if (this.examtype === 'microsoft365'){
        window.ipcRenderer.send('collapse-browserview');
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
