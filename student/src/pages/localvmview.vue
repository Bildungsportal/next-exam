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
      <div class="vnc-wrapper">
        <div ref="vncContainer" class="vnc-container"></div>
        <div class="vnc-overlay" v-if="statusMessage || showRetry">
          <div class="status-text q-mb-sm">
            <div>{{ statusMessage }}</div>
            <div v-if="vmStateText" class="text-subtitle2 text-grey-5 q-mt-xs">
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
      statusMessage: 'Warte auf virtuelle Maschine …',
      connectAttempts: 0,
      maxAttempts: 10,
      showRetry: false,
      vmStateText: '',
      rfb: null,
      connectScheduler: null
    };
  },
  mounted() {
    this.entrytime = new Date().getTime();
    this.fetchinfointerval = new SchedulerService(5000);
    this.fetchinfointerval.addEventListener('action', this.fetchInfo);
    this.fetchinfointerval.start();
    this.clockinterval = new SchedulerService(1000);
    this.clockinterval.addEventListener('action', this.clock);
    this.clockinterval.start();

    document.body.addEventListener('mouseleave', this.sendFocuslost);

    this.tryConnectLoop();
  },
  beforeUnmount() {
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
    }
    document.body.removeEventListener('mouseleave', this.sendFocuslost);
    this.teardownRfb();
  },
  methods: {
    gracefullyExit,
    reconnect,

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
      if (!this.connectScheduler) {
        this.connectScheduler = new SchedulerService(2000);
        this.connectScheduler.addEventListener('action', this.tryConnectLoop);
        this.connectScheduler.start();
      }

      if (this.showRetry) {
        return;
      }

      this.connectAttempts += 1;

      if (!this.clientinfo || !this.clientinfo.localVMHost) {
        this.statusMessage = `Warte auf virtuelle Maschine … (Versuch ${this.connectAttempts}/${this.maxAttempts})`;
        if (this.connectAttempts >= this.maxAttempts) {
          this.statusMessage = 'Virtuelle Maschine konnte nicht erreicht werden.';
          this.showRetry = true;
        }
        return;
      }

      if (this.clientinfo.localVMState === 'starting') {
        this.vmStateText = 'Status: startet …';
      } else if (this.clientinfo.localVMState === 'running') {
        this.vmStateText = 'Status: läuft';
      } else {
        this.vmStateText = '';
      }

      this.statusMessage = `Verbinde zur virtuellen Maschine … (Versuch ${this.connectAttempts}/${this.maxAttempts})`;
      await this.connectVnc();
    },

    async connectVnc() {
      this.teardownRfb();

      const host = this.clientinfo?.localVMHost;
      if (!host) {
        return;
      }

      let proxyInfo = null;
      try {
        proxyInfo = await signalBridge.invoke('start-proxy', { host, port: 5900 });
      } catch (err) {
        console.error('localvmview @ connectVnc: start-proxy failed', err);
        proxyInfo = null;
      }
      const proxyPort = proxyInfo && proxyInfo.port ? proxyInfo.port : null;
      if (!proxyPort) {
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
        this.rfb = new RFB(this.$refs.vncContainer, url, options);
      } catch (err) {
        console.error('localvmview @ connectVnc: RFB constructor failed', err);
        this.onConnectError();
        return;
      }

      this.rfb.addEventListener('connect', () => {
        // Verbindung steht – Overlay ausblenden
        this.statusMessage = '';
        this.vmStateText = '';
        this.showRetry = false;
        this.connectAttempts = 0;
        if (this.connectScheduler) {
          this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
          this.connectScheduler.stop();
          this.connectScheduler = null;
        }
      });
      this.rfb.addEventListener('disconnect', (event) => {
        console.error('localvmview @ RFB disconnect', event?.detail);
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
        this.statusMessage = 'Virtuelle Maschine konnte nicht erreicht werden.';
        this.showRetry = true;
        if (this.connectScheduler) {
          this.connectScheduler.removeEventListener('action', this.tryConnectLoop);
          this.connectScheduler.stop();
        }
      } else {
        this.statusMessage = `Verbindungsfehler, neuer Versuch ${this.connectAttempts + 1}/${this.maxAttempts} …`;
      }
    },

    retryConnect() {
      this.connectAttempts = 0;
      this.showRetry = false;
      this.statusMessage = 'Warte auf virtuelle Maschine …';
      if (!this.connectScheduler) {
        this.connectScheduler = new SchedulerService(2000);
        this.connectScheduler.addEventListener('action', this.tryConnectLoop);
        this.connectScheduler.start();
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

      this.clientinfo = getinfo.clientinfo;
      this.token = this.clientinfo.token;
      this.focus = this.clientinfo.focus;
      this.clientname = this.clientinfo.name;
      this.exammode = this.clientinfo.exammode;
      this.pincode = this.clientinfo.pin;
      this.serverstatus = getinfo.serverstatus;

      if (!this.focus){
        this.entrytime = new Date().getTime();
      }
      this.online = !!(this.clientinfo && this.clientinfo.token);

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
.vnc-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.vnc-container {
  width: 100%;
  height: 100%;
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
  padding: 16px 20px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9); /* dark slate with slight transparency */
  color: #e5e7eb;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.status-text {
  text-align: center;
  color: #e5e7eb;
}
</style>

