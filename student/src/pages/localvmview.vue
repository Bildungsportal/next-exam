<template>
  <div class="column" style="height: 100%">
    <exam-header
      :serverstatus="serverstatus"
      :clientinfo="clientinfo"
      :online="online"
      :clientname="clientname"
      :exammode="exammode"
      :servername="servername"
      :pincode="pincode"
      :battery="battery"
      :currenttime="currenttime"
      :timesinceentry="timesinceentry"
      :componentName="componentName"
      :localLockdown="localLockdown"
      :wlanInfo="wlanInfo"
      :hostip="hostip"
      @reconnect="reconnect"
      @gracefullyExit="gracefullyExit"
    ></exam-header>

    <div id="content" class="column q-pa-none" style="flex: 1; overflow: hidden;">
      <!-- focus warning start -->
      <div v-if="!focus" class="focus-container">
        <div v-if="!showVmOverlay" id="focuswarning" class="infodiv p-4 d-block focuswarning">
          <div class="mb-3 row">
            <div class="mb-3 "> {{ $t('editor.leftkiosk') }} <br> {{ $t('editor.tellsomeone') }}</div>
            <img src="/src/assets/img/svg/eye-slash-fill.svg" class=" me-2" width="32" height="32">
            <div class="mt-3"> {{ timesinceentry }}</div>
          </div>
        </div>
      </div>
      <!-- focuswarning end  -->
      <div class="vnc-wrapper">
        <div ref="vncContainer" class="vnc-container"></div>
        <div class="vnc-overlay" v-if="showVmOverlay">
          <div class="status-text q-mb-sm">
            <div v-if="isMissingVm">VM-Disk nicht gefunden</div>
            <div v-else-if="isHashMismatch">SHA-256 Hash Missmatch</div>
            <div v-else-if="isVerifyingHash" class="localvm-hash-verify-layout">
              <div class="localvm-hash-spinner" aria-hidden="true"></div>
              <div class="text-subtitle1">{{ $t('student.vmVerifyingHash') }}</div>
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
import moment from 'moment-timezone';
import ExamHeader from '../components/ExamHeader.vue';
import {SchedulerService} from '../utils/schedulerservice.js';
import {gracefullyExit, reconnect} from '../utils/commonMethods.js';
import {SignalBridge} from '../utils/signalBridge.js';

const signalBridge = new SignalBridge(window);
const logPrefix = 'localvmview';

export default {
  components: { ExamHeader },
  data() {
    return {
      componentName: 'LocalVM',
      online: true,
      focus: true,
      exammode: false,
      examtype: this.$route.params.examtype,
      servername: this.$route.params.servername,
      servertoken: this.$route.params.servertoken,
      serverip: this.$route.params.serverip,
      token: this.$route.params.token,
      clientname: this.$route.params.clientname,
      serverApiPort: this.$route.params.serverApiPort,
      electron: this.$route.params.electron,
      pincode: this.$route.params.pincode,
      serverstatus: this.$route.params.serverstatus,
      config: this.$route.params.config,
      localLockdown: this.$route.params.localLockdown,
      clientinfo: null,
      entrytime: 0,
      timesinceentry: 0,
      currenttime: 0,
      now: new Date().getTime(),
      battery: null,
      wlanInfo: null,
      hostip: null,
      internetCheckCounter: 0,
      statusMessage: '',
      connectAttempts: 0,
      maxAttempts: 10,
      showRetry: false,
      vmStateText: '',
      rfb: null,
      connectScheduler: null,
      lastLocalVmState: null,
      lastFocusState: true,
      isUnmounted: false
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
    }
    ,
    isMissingVm() {
      return this.clientinfo?.localVMState === 'missing';
    },
    isHashMismatch() {
      return this.clientinfo?.localVMState === 'hash_mismatch';
    },
    isVerifyingHash() {
      return this.clientinfo?.localVMState === 'verifying_hash';
    },
    expectedVmDiskName() {
      const sectionIndex = this.clientinfo?.lockedSection || 1;
      const section = this.serverstatus?.examSections?.[sectionIndex] || {};
      const group = this.clientinfo?.group === 'b' ? 'b' : 'a';
      const cfg = group === 'b' ? (section?.groupB?.examConfig?.localvm || {}) : (section?.groupA?.examConfig?.localvm || {});
      return cfg.qcow2Name || '';
    }
  },
  mounted() {
    this.entrytime = new Date().getTime();
    this.fetchinfointerval = new SchedulerService(5000);
    this.fetchinfointerval.addEventListener('action', this.fetchInfo);
    this.fetchinfointerval.start();
    this.$nextTick(async () => {
      try {
        this.wlanInfo = await signalBridge.invoke('get-wlan-info');
        this.hostip = await signalBridge.invoke('checkhostip');
        this.internetCheckCounter = 0;
      } catch (err) {
        console.error('localvmview @ mounted: initial wlan/host ip error', err);
      }
    });
    this.clockinterval = new SchedulerService(1000);
    this.clockinterval.addEventListener('action', this.clock);
    this.clockinterval.start();

    if (!this.config.development) {
      document.body.addEventListener('mouseleave', this.sendFocuslost);
    }

    this.tryConnectLoop();
  },
  beforeUnmount() {
    this.isUnmounted = true;
    if (this.fetchinfointerval) {
      this.fetchinfointerval.removeEventListener('action', this.fetchInfo);
      this.fetchinfointerval.stop();
    }
    if (this.clockinterval) {
      this.clockinterval.removeEventListener('action', this.clock);
      this.clockinterval.stop();
    }
    if (this.connectScheduler) {
      this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
      this.connectScheduler.stop();
      this.connectScheduler = null;
    }
    document.body.removeEventListener('mouseleave', this.sendFocuslost);
    this.teardownRfb();
  },
  methods: {
    gracefullyExit,
    reconnect,

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
        // transient during re-render/unmount; don't escalate retry state
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
        compressionLevel: 1,
        resizeSession: true,
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
      this.rfb.scaleViewport = true;
      this.rfb.resizeSession = true;
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
        const detail = event?.detail || null;
        console.error('localvmview @ RFB disconnect: VNC Connection disabled');
        if (this.shouldBlockVnc()) {
          this.teardownRfb();
          return;
        }
        this.onConnectError();
        // Nach einer Trennung erneut Verbindungsversuche starten, solange maxAttempts nicht erreicht und kein manueller Retry-Bildschirm aktiv ist
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
      if (!getinfo?.clientinfo) {
        return;
      }
      this.clientinfo = getinfo.clientinfo;
      const nextVmState = this.clientinfo?.localVMState || null;
      const prevVmState = this.lastLocalVmState;
      this.lastLocalVmState = nextVmState;
      this.token = this.clientinfo.token;
      const prevFocus = this.lastFocusState;
      this.focus = this.clientinfo.focus;
      this.lastFocusState = !!this.focus;
      this.clientname = this.clientinfo.name;
      this.exammode = this.clientinfo.exammode;
      this.pincode = this.clientinfo.pin;
      if (getinfo.serverstatus) {
        this.serverstatus = getinfo.serverstatus;
      }
      if ((nextVmState === 'hash_mismatch' && prevVmState !== 'hash_mismatch')
          || (nextVmState === 'missing' && prevVmState !== 'missing')) {
        console.warn(`${logPrefix} @ applyGetinfoPayload: ${nextVmState} -> reset VNC UI`);
        this.showRetry = false;
        this.statusMessage = '';
        this.vmStateText = '';
        this.stopConnectLoop();
        this.teardownRfb();
      }
      if (prevFocus && !this.focus) {
        this.entrytime = new Date().getTime();
      }
      this.online = !!(this.clientinfo && this.clientinfo.token);
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

    async sendFocuslost(){
      const response = await signalBridge.invoke('focuslost');
      if (!this.config.development && response && !response.focus){
        this.focus = false;
      }
    },

    clock(){
      this.now = new Date().getTime();
      this.timesinceentry =  new Date(this.now - this.entrytime).toISOString().substr(11, 8);
      this.currenttime = moment().tz('Europe/Vienna').format('HH:mm:ss');
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
      if (this.internetCheckCounter % 5 === 0){
        try {
          this.wlanInfo = await signalBridge.invoke('get-wlan-info');
          this.hostip = await signalBridge.invoke('checkhostip');
        } catch (err) {
          console.error('localvmview @ fetchInfo: wlan/host ip error', err);
        }
        this.internetCheckCounter = 0;
      }
    }
  }
};
</script>

<style scoped>
#content {
  border-radius: 0px !important;
}

.vnc-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  min-height: 0;
}

.vnc-container {
  width: 100%;
  height: 100%;
  flex: 1;
  background: #000;
  overflow: hidden;
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
  background: rgba(15, 23, 42, 0.9); /* dark slate with slight transparency */
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

