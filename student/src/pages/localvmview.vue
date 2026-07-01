<template>
    <div class="column nx-localvm-root" style="height: 100%; position: relative;">
        <exam-header
            @reconnect="reconnect"
            @gracefullyExit="gracefullyExit"
        ></exam-header>

        <div id="toolbar" class="d-inline p-1 pt-0">
            <button
                class="btn btn-primary p-0 pe-2 ps-1 me-1 mb-0 btn-sm"
                @click="confirmHardResetVm"
                :disabled="vmResetBusy"
                title="VM hart zurücksetzen"
            ><img src="/src/assets/img/svg/edit-redo.svg" class="" width="22" height="20">Reset VM</button>

            <div id="getmaterialsbutton" class="invisible-button btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="getExamMaterials()" :title="$t('editor.getmaterials')"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ $t('editor.materials') }}</div>

            <div v-for="file in examMaterials" :key="file.filename" class="d-inline" style="text-align:left">
                <div v-if="(file.filetype == 'htm')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ file.filename }}</div>
                <div v-if="(file.filetype == 'docx')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/games-solve.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ file.filename }}</div>
                <div v-if="(file.filetype == 'pdf')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{ file.filename }} </div>
                <div v-if="(file.filetype == 'audio')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="loadBase64file(file)"><img src="/src/assets/img/svg/im-google-talk.svg" class="" width="22" height="22" style="vertical-align: top;"> {{ file.filename }} </div>
                <div v-if="(file.filetype == 'image')" class="btn btn-outline-cyan p-0 pe-2 ps-1 me-1 mb-0 btn-sm" @click="selectedFile=file.filename; loadBase64file(file)"><img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{ file.filename }}</div>
            </div>
            <div v-if="allowedUrls.length !== 0" v-for="(allowedUrl, urlIdx) in allowedUrls" :key="'localvm-allowed-' + urlIdx" class="btn btn-outline-success p-0 pe-2 ps-1 me-1 mb-0 btn-sm allowed-url-button" :title="getUrlDisplay(allowedUrl)" @click="showUrl(getUrlDisplay(allowedUrl))">
                <img src="/src/assets/img/svg/eye-fill.svg" class="grey" width="22" height="22" style="vertical-align: top;"> {{ getUrlDisplay(allowedUrl) }}
            </div>

            <div class="white text-muted me-2 ms-2 small d-inline-block mb-0" style="vertical-align: middle;">{{ $t('editor.localfiles') }} </div>
            <div v-for="file in localfiles" :key="file.name" class="d-inline mb-0">
                <div v-if="(file.type == 'pdf')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="selectedFile=file.name; loadPDF(file.name)"><img src="/src/assets/img/svg/document-replace.svg" class="" width="20" height="20"> {{ file.name }} </div>
                <div v-if="(file.type == 'image')" class="btn btn-info p-0 pe-2 ps-1 ms-1 mb-0 btn-sm" @click="loadImage(file.name)"><img src="/src/assets/img/svg/eye-fill.svg" class="white" width="22" height="22" style="vertical-align: top;"> {{ file.name }} </div>
            </div>
        </div>

        <div
            id="preview"
            class="fadeinfast p-4"
            style="--nx-preview-chrome-top: 80px; --nx-preview-top-offset: 0px;"
        >
            <WebviewPane
                id="webview"
                :src="urlForWebview || ''"
                :visible="webviewVisible"
                :allowed-url="urlForWebview"
                :block-external="true"
                @close="hidepreview"
            />
            <PdfviewPaneRendered
                :localLockdown="localLockdown"
                :examtype="examtype"
                :toolbar="pdfPreviewUi"
                :preview="pdfPreviewState"
                @close="hidepreview"
            />
        </div>

        <div id="content" class="column q-pa-none" style="flex: 1; overflow: hidden;">
            <!-- focus warning start -->
            <div v-if="!focus" class="focus-container">
                <div v-if="!showVmOverlay" id="focuswarning" class="infodiv p-4 d-block focuswarning">
                    <div class="mb-3 row">
                        <div class="mb-3 "> {{ $t('editor.leftkiosk') }} <br> {{ $t('editor.tellsomeone') }}</div>
                        <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
                    </div>
                </div>
            </div>
            <!-- focuswarning end  -->
            <div class="vnc-wrapper">
                <div ref="vncContainer" class="vnc-container"></div>
                <div class="vnc-overlay" v-if="showVmOverlay">
                    <div class="status-text q-mb-sm">
                        <div v-if="isMissingVm">VM-Disk nicht gefunden</div>
                        <div v-else-if="isHashMismatch">{{ $t('student.localvmDiskMismatch') }}</div>
                        <div v-else-if="isVerifyingHash" class="localvm-hash-verify-layout">
                            <div class="localvm-hash-spinner" aria-hidden="true"></div>
                            <div class="text-subtitle1">{{ vmVerifyingText }}</div>
                            <div class="text-subtitle2 text-grey-5 q-mt-xs">{{ $t('student.vmVerifyingHashHint') }}</div>
                        </div>
                        <div v-else>{{ statusMessage }}</div>
                        <div v-if="vmStateText && !isHashMismatch && !isVerifyingHash" class="text-subtitle2 text-grey-5 q-mt-xs">
                            {{ vmStateText }}
                        </div>
                    </div>
                    <div v-if="showRetry" class="q-mt-sm">
                        <button class="btn btn-primary btn-sm q-mr-sm" @click="retryConnect">
                            {{ $t('dashboard.retry') || 'Erneut versuchen' }}
                        </button>
                        <button class="btn btn-danger btn-sm" @click="gracefullyExit">
                            {{ $t('editor.unlock') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js';
import {gracefullyExit, reconnect, showUrl} from '../utils/commonMethods.js';
import {attachExamMouseleaveGuardBoolean, shouldSkipEdgeFocusLost} from '../utils/linuxCageKiosk.js';
import {getExamMaterials, loadPDF, loadImage, resetPdfPreviewToolbar} from '../utils/filehandler.js';
import PdfviewPaneRendered from '../components/PdfviewPaneRendered.vue';
import WebviewPane from '../components/WebviewPane.vue';
import {SignalBridge} from '../utils/signalBridge.js';
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
    applyFocusLostFromIpc,
} from '../utils/examFetchInfoSync.js';
import {ref} from "vue";
import {useConfigStore} from "../stores/configStore.ts";
import {useInfoStore} from "../stores/infoStore.ts";
import {autoCleanupMixin} from "../mixins/autoCleanupMixin.ts";

const signalBridge = new SignalBridge(window);
const logPrefix = 'localvmview';

export default {
    mixins: [autoCleanupMixin],

    components: { ExamHeader, PdfviewPaneRendered, WebviewPane },

    setup() {
        const configStore = useConfigStore();
        let development = ref(configStore.development);
        let serverApiPort = ref(configStore.serverApiPort);
        let electron = ref(configStore.electron);
        let hostip = ref(configStore.hostip);

        const infoStore = useInfoStore();
        infoStore.online = true;
        infoStore.componentName = "LocalVM";

        let examtype = ref(infoStore.examtype);
        let servername = ref(infoStore.servername);
        let servertoken = ref(infoStore.servertoken);
        let serverip = ref(infoStore.serverip);
        let token = ref(infoStore.token);
        let clientname = ref(infoStore.clientname);
        let serverstatus = ref(infoStore.serverstatus);
        let pincode = ref(infoStore.pincode);
        let localLockdown = ref(infoStore.localLockdown);
        let online = ref(infoStore.online);
        let battery = ref(infoStore.battery);
        let wlanInfo = ref(infoStore.wlanInfo);
        let entrytime = ref(infoStore.entryTime);

        return { development, serverApiPort, electron, hostip,
            examtype, servername, servertoken, serverip, token, clientname, serverstatus,
            pincode, localLockdown, online, battery, wlanInfo, entrytime };
    },

    data() {
        return {
            focus: true,
            exammode: false,
            clientinfo: null,
            internetCheckCounter: 0,
            examMaterials: [],
            localfiles: null,
            allowedUrls: [],
            urlForWebview: null,
            webviewVisible: false,
            pdfPreviewUi: { showInsert: false, showPrint: false, showSend: false, showZoom: false },
            pdfPreviewState: null,
            currentpreview: null,
            selectedFile: null,
            statusMessage: '',
            connectAttempts: 0,
            maxAttempts: 10,
            showRetry: false,
            vmStateText: '',
            rfb: null,
            connectScheduler: null,
            lastLocalVmState: null,
            lastFocusState: true,
            isUnmounted: false,
            vmResetBusy: false
        };
    },

    computed: {
        showVmOverlay() {
            if (this.showRetry) {
                return true;
            }
            const st = this.clientinfo?.localVMState;
            if (st && ['missing', 'hash_mismatch', 'missing_hash', 'error', 'verifying_hash'].includes(st)) {
                return true;
            }
            return !!(this.statusMessage && String(this.statusMessage).trim().length);
        },
        isMissingVm() {
            return this.clientinfo?.localVMState === 'missing';
        },
        isHashMismatch() {
            return this.clientinfo?.localVMState === 'hash_mismatch';
        },
        isVerifyingHash() {
            return this.clientinfo?.localVMState === 'verifying_hash';
        },
        vmVerifyingText() {
            const sectionIndex = this.clientinfo?.lockedSection || 1;
            const section = this.serverstatus?.examSections?.[sectionIndex] || {};
            const group = this.clientinfo?.group === 'b' ? 'b' : 'a';
            const cfg = group === 'b' ? (section?.groupB?.examConfig?.localvm || {}) : (section?.groupA?.examConfig?.localvm || {});
            return cfg.calculateSha256 === true ? this.$t('student.vmVerifyingHash') : this.$t('student.vmVerifyingSize');
        }
    },

    mounted() {
        this.entrytime = new Date().getTime();

        this.autoSchedulerService(this.fetchInfo, 5000);

        this.$nextTick(async () => {
            try {
                this.wlanInfo = await signalBridge.invoke('get-wlan-info');
                this.hostip = await signalBridge.invoke('checkhostip');
                this.internetCheckCounter = 0;
            } catch (err) {
                console.error('localvmview @ mounted: initial wlan/host ip error', err);
            }
        });

        attachExamMouseleaveGuardBoolean(signalBridge, this.development, this.sendFocuslost);

        this.tryConnectLoop();

        this.autoSchedulerService(this.loadFilelist, 20000);

        this.loadFilelist();
        this.getExamMaterials();
        signalBridge.on('getmaterials', () => {
            this.getExamMaterials();
        });
    },

    beforeUnmount() {
        this.isUnmounted = true;
        signalBridge.removeAllListeners('getmaterials');

        if (this.connectScheduler) {
            this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
            this.connectScheduler.stop();
            this.connectScheduler = null;
        }

        document.body.removeEventListener('mouseleave', this.sendFocuslost);
        this.teardownRfb();
        // make sure the vncproxy-helper does not survive when leaving the localvm view
        signalBridge.invoke('stop-proxy').catch((err) => {
            console.warn('localvmview @ beforeUnmount: stop-proxy failed', err);
        });
    },

    methods: {
        gracefullyExit,
        reconnect,
        showUrl,
        getExamMaterials,
        loadPDF,
        loadImage,

        getUrlDisplay(allowedUrl) {
            return typeof allowedUrl === 'object' ? allowedUrl.url : allowedUrl;
        },

        hidepreview() {
            resetPdfPreviewToolbar(this);
            this.pdfPreviewState = null;
            this.webviewVisible = false;
            const preview = document.querySelector('#preview');
            if (preview) {
                preview.style.display = 'none';
            }
            URL.revokeObjectURL(this.currentpreview);
        },

        loadBase64file(file) {
            this.webviewVisible = false;
            if (file.filetype === 'pdf') {
                this.loadPDF(file, true);
                return;
            }
            if (file.filetype === 'image') {
                this.loadImage(file, true);
            }
        },

        async loadFilelist() {
            const filelist = await signalBridge.invoke('getfilesasync', null);
            this.localfiles = filelist;
        },

        shouldBlockVnc() {
            const st = this.clientinfo?.localVMState;
            return st === 'hash_mismatch';
        },

        stopConnectLoop() {
            if (this.connectScheduler) {
                this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
                this.connectScheduler.stop();
                this.connectScheduler = null;
            }
        },

        ensureConnectLoopRunning() {
            if (this.connectScheduler) {
                return;
            }
            this.connectAttempts = 0;
            this.showRetry = false;
            this.statusMessage = this.$t('student.vmWaiting');
            this.connectScheduler = new SchedulerService(2000);
            this.connectScheduler.addEventListener('action', this.tryConnectLoop);
            this.connectScheduler.start();
        },

        teardownRfb() {
            if (this.rfb) {
                try {
                    this.rfb.disconnect();
                } catch (e) {
                    console.error('localvmview @ teardownRfb:', e);
                }
                this.rfb = null;
            }
        },

        async tryConnectLoop() {
            if (this.isUnmounted) {
                return;
            }
            if (!this.connectScheduler) {
                this.connectScheduler = new SchedulerService(2000);
                this.connectScheduler.addEventListener('action', this.tryConnectLoop);
                this.connectScheduler.start();
            }

            if (this.shouldBlockVnc()) {
                this.stopConnectLoop();
                return;
            }

            if (this.showRetry) {
                return;
            }

            if (this.clientinfo && !this.clientinfo.localVMHost) {
                const st = this.clientinfo.localVMState;
                if (st === 'missing' || (st === 'error' && !this.clientinfo.localVMHost)) {
                    this.stopConnectLoop();
                    return;
                }
                if (st === 'verifying_hash') {
                    this.vmStateText = this.$t('student.vmVerifyingHash');
                    this.statusMessage = '';
                    return;
                }
            }

            this.connectAttempts += 1;

            if (!this.clientinfo || !this.clientinfo.localVMHost) {
                this.statusMessage = this.$t('student.vmConnecting', { attempt: this.connectAttempts, max: this.maxAttempts });
                if (this.connectAttempts >= this.maxAttempts) {
                    this.statusMessage = this.$t('student.vmFailed');
                    this.showRetry = true;
                }
                return;
            }

            if (this.clientinfo.localVMState === 'verifying_hash') {
                this.vmStateText = this.$t('student.vmVerifyingHash');
            } else if (this.clientinfo.localVMState === 'starting') {
                this.vmStateText = this.$t('student.vmStarting');
            } else if (this.clientinfo.localVMState === 'running') {
                this.vmStateText = this.$t('student.vmRunning');
            } else {
                this.vmStateText = '';
            }

            if (this.clientinfo.localVMState === 'verifying_hash') {
                this.statusMessage = '';
            } else {
                this.statusMessage = this.$t('student.vmConnecting', { attempt: this.connectAttempts, max: this.maxAttempts });
            }
            await this.connectVnc();
        },

        async connectVnc() {
            if (this.isUnmounted) {
                return;
            }
            if (this.shouldBlockVnc()) {
                this.teardownRfb();
                return;
            }
            this.teardownRfb();

            const host = this.clientinfo?.localVMHost;
            if (!host) {
                return;
            }
            const target = this.$refs?.vncContainer;
            if (!target) {
                return;
            }

            let proxyInfo = null;
            try {
                const port = this.clientinfo?.localVMPort ? Number(this.clientinfo.localVMPort) : 5901;
                proxyInfo = await signalBridge.invoke('start-proxy', { host, port });
            } catch (err) {
                console.error('localvmview @ connectVnc: start-proxy failed', err);
                proxyInfo = null;
            }
            const proxyPort = proxyInfo && proxyInfo.port ? proxyInfo.port : null;
            if (!proxyPort) {
                console.warn(`${logPrefix} @ connectVnc: no proxy port (host=${host})`);
                this.onConnectError();
                return;
            }

      const url = `ws://127.0.0.1:${proxyPort}`;
      const options = {
        credentials: { password: '1234' },
        // favour smoothness over bandwidth (lokale VM)
        qualityLevel: 8,
        compressionLevel: 0,
        alwaysUseDotCursor: false,
        shared: true,
        viewport: true
      };

            let RFBModule = null;
            try {
                RFBModule = await import('../novnc-core/rfb.js');
            } catch (err) {
                console.error('localvmview @ connectVnc: dynamic import of RFB failed', err);
                this.onConnectError();
                return;
            }

            const RFB = RFBModule && (RFBModule.default || RFBModule.RFB || RFBModule);

      try {
        this.rfb = new RFB(target, url, options);
      } catch (err) {
        console.error('localvmview @ connectVnc: RFB constructor failed', err);
        this.onConnectError();
        return;
      }
      this.rfb.showDotCursor = false;
      this.rfb.scaleViewport = true;
      // QEMU VNC rejects SetDesktopSize; scale viewport locally instead of resizeSession.
      this.rfb.resizeSession = false;
      this.rfb.clipViewport = false;

            this.rfb.addEventListener('connect', () => {
                const st = this.clientinfo?.localVMState;
                this.showRetry = false;
                this.connectAttempts = 0;
                if (this.connectScheduler) {
                    this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
                    this.connectScheduler.stop();
                    this.connectScheduler = null;
                }
                this.statusMessage = '';
                if (st !== 'verifying_hash') {
                    this.vmStateText = '';
                }
            });
            this.rfb.addEventListener('disconnect', (event) => {
                console.error('localvmview @ RFB disconnect: VNC Connection disabled');
                if (this.shouldBlockVnc()) {
                    this.teardownRfb();
                    return;
                }
                this.onConnectError();
                if (!this.showRetry && !this.connectScheduler && this.connectAttempts < this.maxAttempts) {
                    this.connectScheduler = new SchedulerService(2000);
                    this.connectScheduler.addEventListener('action', this.tryConnectLoop);
                    this.connectScheduler.start();
                }
            });
            this.rfb.addEventListener('securityfailure', (event) => {
                console.error('localvmview @ RFB securityfailure', event?.detail);
                this.onConnectError();
            });
        },

        onConnectError() {
            if (this.connectAttempts >= this.maxAttempts) {
                this.statusMessage = this.$t('student.vmFailed');
                this.showRetry = true;
                this.stopConnectLoop();
            } else {
                this.statusMessage = this.$t('student.vmRetrying', { attempt: this.connectAttempts + 1, max: this.maxAttempts });
            }
        },

        applyGetinfoPayload(getinfo) {
            if (!getinfo?.clientinfo) return;
            const prevFocus = this.lastFocusState;

            applyClientinfoFromFetch(this, getinfo.clientinfo);
            if (getinfo.serverstatus) {
                applyServerstatusFromFetch(this, getinfo.serverstatus);
            }

            const nextVmState = this.clientinfo?.localVMState || null;
            if (nextVmState !== this.lastLocalVmState) {
                const was = this.lastLocalVmState;
                this.lastLocalVmState = nextVmState;
                if ((nextVmState === 'hash_mismatch' && was !== 'hash_mismatch')
                    || (nextVmState === 'missing' && was !== 'missing')) {
                    console.warn(`${logPrefix} @ applyGetinfoPayload: ${nextVmState} -> reset VNC UI`);
                    this.showRetry = false;
                    this.statusMessage = '';
                    this.vmStateText = '';
                    this.stopConnectLoop();
                    this.teardownRfb();
                }
            }
            this.lastFocusState = !!this.focus;
        },

        async retryConnect() {
            try {
                this.showRetry = false;
                this.statusMessage = this.$t('student.vmWaiting');
                this.connectAttempts = 0;
                await this.tryConnectLoop();
            } catch (e) {
                console.error('localvmview @ retryConnect', e);
                this.statusMessage = this.$t('student.vmFailed');
                this.showRetry = true;
            }
        },

        async sendFocuslost() {
            if (await shouldSkipEdgeFocusLost(signalBridge, this.development)) return;
            const response = await signalBridge.invoke('focuslost');
            applyFocusLostFromIpc(this, response, this.development);
        },

        async fetchInfo() {
            const getinfo = await signalBridge.invoke('getinfoasync');
            if (!getinfo) return;

            this.applyGetinfoPayload(getinfo);

            if (this.clientinfo?.localVMState === 'verifying_hash' && !this.clientinfo?.localVMHost) {
                this.ensureConnectLoopRunning();
            }

            try {
                this.battery = await navigator.getBattery().then(battery => battery);
            } catch (error) {
                console.error("localvmview @ fetchInfo: Battery API error", error);
            }

            this.internetCheckCounter++;
            if (this.internetCheckCounter % 5 === 0) {
                try {
                    this.wlanInfo = await signalBridge.invoke('get-wlan-info');
                    this.hostip = await signalBridge.invoke('checkhostip');
                } catch (err) {
                    console.error('localvmview @ fetchInfo: wlan/host ip error', err);
                }
                this.internetCheckCounter = 0;
            }
        },

        async confirmHardResetVm() {
            if (this.vmResetBusy) return;
            const result = await this.$swal.fire({
                title: 'VM hart zurücksetzen?',
                text: 'Die VM wird sofort neu gestartet (Reset-Knopf). Ungespeicherte Daten in der VM können verloren gehen.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Reset',
                cancelButtonText: 'Abbrechen',
                reverseButtons: true,
            });
            if (!result?.isConfirmed) return;
            try {
                this.vmResetBusy = true;
                const res = await signalBridge.invoke('qemu-reset-hard');
                if (!res?.ok) {
                    throw new Error(res?.error || 'reset failed');
                }
                await this.$swal.fire({ title: 'Reset ausgelöst', icon: 'success', timer: 1200, showConfirmButton: false });
            } catch (e) {
                await this.$swal.fire({ title: 'Reset fehlgeschlagen', text: String(e?.message || e), icon: 'error' });
            } finally {
                this.vmResetBusy = false;
            }
        }
    }
};
</script>

<style scoped>
#toolbar {
    z-index: 10001;
    background-color: rgba(var(--bs-dark-rgb));
    flex-shrink: 0;
}

#content {
    border-radius: 0px !important;
}

#preview {
    display: none;
    position: absolute;
    top: var(--nx-preview-chrome-top, 148px);
    left: 0;
    width: 100%;
    box-sizing: border-box;
    height: calc(100% - var(--nx-preview-chrome-top, 148px));
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 100000;
    backdrop-filter: blur(2px);
}

.vnc-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  min-height: 0;
  min-width: 0;
}

.vnc-container {
  width: 100%;
  height: 100%;
  flex: 1;
  background: #000;
  overflow: hidden;
  /* fix px canvas inside must not dictate min content width → let it shrink */
  min-width: 0;
  position: relative;
}

/* noVNC injects a flex <div> (_screen) holding the canvas. Take it out of flow
   (absolute) so its fixed-px canvas can never inflate the container width →
   container follows the window, autoscale gets real width → contain on both axes. */
.vnc-container :deep(> div) {
  position: absolute;
  inset: 0;
  width: auto !important;
  height: auto !important;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.vnc-container :deep(canvas) {
    cursor: none;
}

.vnc-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 260px;
    max-width: 480px;
    z-index: 1000;
    padding: 16px 20px;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.9);
    color: #e5e7eb;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.focus-container {
    z-index: 900 !important;
}

.status-text {
    text-align: center;
    color: #e5e7eb;
}

.localvm-hash-verify-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
}

.localvm-hash-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #93c5fd;
    border-radius: 50%;
    animation: localvm-hash-spin 0.85s linear infinite;
}

@keyframes localvm-hash-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
