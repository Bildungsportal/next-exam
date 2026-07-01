<template>

    <div id="apphead" class="bg-dark">
        <div v-if="showSectionSwitchOverlay" class="section-switch-backdrop">
            <div class="section-switch-card">
                <div class="section-switch-spinner" aria-hidden="true"></div>
                <div class="section-switch-text">{{ $t('editor.switchingSection') }}</div>
            </div>
        </div>

        <div class="header-left">
            <div v-if="online && !localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <button v-if="groups  && group === 'a'" type="button" class="header-item btn btn-info btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> A  </button>
                <button v-if="groups  && group === 'b'" type="button" class="header-item btn btn-warning btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> B  </button>
                <span class="fs-5 align-middle me-4 header-meta" style="float: left;">
                    {{clientname}} @ {{servername}}
                    <span class="header-sep" aria-hidden="true">·</span>
                    {{pincode}}
                    <span class="header-sep" aria-hidden="true">·</span>
                    <span class="teal">{{$t('student.connected')}}</span>
                </span>
                <span v-if="kioskLauncherApps.length" class="kiosk-launcher-bar ms-1">
                    <button v-for="app in kioskLauncherApps" :key="app.path" type="button"
                            class="btn btn-outline-cyan btn-sm py-1 px-3 ms-2 kiosk-launcher-btn"
                            :title="app.path" @click="launchKioskApp(app.path)">{{ app.name }}</button>
                </span>
            </div>
            <div v-if="!online && !localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style=" float: left;" />
                <span class="fs-5 align-middle me-4 header-meta" style="float: left;">
                    {{clientname}}
                    <span class="header-sep" aria-hidden="true">·</span>
                    <span class="red">{{ $t("student.disconnected") }}</span>
                </span>
            </div>
            <div v-if="localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <span class="fs-5 align-middle me-4 header-meta" style="float: left;">
                    {{clientname}}
                    <span class="header-sep" aria-hidden="true">·</span>
                    <span v-if="localLockdown && exammode" class="green">Lokal abgesichert</span>
                    <span v-if="localLockdown && !exammode" class="red">nicht abgesichert</span>
                </span>
            </div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-success p-1 me-1 btn-sm" @click="reconnect()"><img src="/src/assets/img/svg/gtk-convert.svg" class="" width="22" height="20"> {{ $t("editor.reconnect")}}</div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyExit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.endexam")}} </div>
            <div v-if="localLockdown && exammode" class="header-item btn btn-danger p-1 pe-2 me-1 btn-sm"  @click="gracefullyExit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.endexam") }}  </div>
        </div>

        <div class="header-right">
        <!-- Exam sections: show all 4 section buttons and current section; if allowSectionSwitch, buttons trigger switch-exam-section IPC -->
        <div v-if="serverstatus?.useExamSections" class="header-sections me-2">
            <div v-for="n in 4" :key="n"
                class="btn btn-sm ms-1 p-0 pe-1 ps-1"
                :class="(lockedSection === n ? 'btn-teal' : 'btn-outline-secondary') + (!serverstatus?.allowSectionSwitch ? ' disabledbtn' : '') "
                @click="switchExamSection(n)">
                {{ serverstatus?.examSections?.[n]?.sectionname || n }}
            </div>
        </div>

        <div class="header-item">

            <!-- Show WLAN SSID -->
            <div v-if="showWlanSsid" style="font-size: 0.8rem;" class="me-1"> {{ wlanInfo.ssid }}  </div>


            <!-- WiFi icon (mutually exclusive states: never show 2 WiFi icons at once) -->
            <!-- Show WLAN quality -->
            <div v-if="showWlanQuality" class="me-2">
                <img v-if="wlanInfo.quality > 80" src="/src/assets/img/svg/network-wireless-connected-100.svg"  :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" class="" width="24" height="24" style="vertical-align: bottom;" />
                <img v-else-if="wlanInfo.quality > 50" src="/src/assets/img/svg/network-wireless-connected-80.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 30" src="/src/assets/img/svg/network-wireless-connected-60.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 10" src="/src/assets/img/svg/network-wireless-connected-40.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 5" src="/src/assets/img/svg/network-wireless-connected-20.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" src="/src/assets/img/svg/network-wireless-connected-00.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN permission not available -->
            <div v-else-if="showWlanNoPermissions" class="me-2">
                <img :title="$t('student.wlanNopermissionsText')" :alt="$t('student.wlanNopermissionsText')" src="/src/assets/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>

            <!-- WLAN not connected (no interface, givingup, or idle adapter) -->
            <div v-else-if="showWlanDisconnected" class="me-2">
                <img title="WLAN disconnected" alt="WLAN disconnected" src="/src/assets/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>

            <!-- Redacted SSID on WiFi (e.g. macOS privacy) while IP is known -->
            <div v-else-if="showWlanRedactedHint" class="me-2">
              <img :title="'WiFi Information not available \nIP: '+hostipDisplay" :alt="'WiFi Information not available'" src="/src/assets/img/svg/network-wireless-connected-20.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- LAN connected whenever host IP is known (independent of WiFi state) -->
            <div v-if="showLanConnected" class="me-2">
                <img :title="'Connected: '+hostipDisplay" alt="Connected" src="/src/assets/img/svg/network-wired-available.svg" width="24" height="24" >
            </div>

            <!-- LAN disconnected only after network poll, when no host IP -->
            <div v-else-if="showLanDisconnected" class="me-2">
                <img title="Disconnected" alt="Disconnected" src="/src/assets/img/svg/network-wired-unavailable.svg" width="24" height="24" >
            </div>





            
            <div v-if="battery && battery.level" style="font-size: 0.8rem;"> {{ Math.round(battery.level*100)}}%  </div>
            <div v-if="battery && battery.level" class="me-2">
                <img v-if="battery && battery.level > 0.9" src="/src/assets/img/svg/battery-100.svg"  :title="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.8 && battery.level <= 0.9 " src="/src/assets/img/svg/battery-090.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.7 && battery.level <= 0.8 " src="/src/assets/img/svg/battery-080.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.6 && battery.level <= 0.7 " src="/src/assets/img/svg/battery-070.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.5 && battery.level <= 0.6 " src="/src/assets/img/svg/battery-060.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.4 && battery.level <= 0.5 " src="/src/assets/img/svg/battery-050.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.3 && battery.level <= 0.4 " src="/src/assets/img/svg/battery-040.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.2 && battery.level <= 0.3 " src="/src/assets/img/svg/battery-030.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.1 && battery.level <= 0.2 " src="/src/assets/img/svg/battery-020.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level <= 0.1" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" src="/src/assets/img/svg/battery-010.svg" width="32" height="32" >
            </div>
            <span ref="headerClock" class="fs-5 d-inline-block" style="width:90px;"></span>
            <div class="fs-5" >{{componentName}}</div>
        </div>
        </div>
    </div>
  
</template>
  
<script>
  import moment from 'moment-timezone';
  import {SignalBridge} from '../utils/signalBridge.js'
  import {SchedulerService} from '../utils/schedulerservice.js'
  import {autoCleanupMixin} from "../mixins/autoCleanupMixin.ts";
  import {storeToRefs} from "pinia";
  import {useInfoStore} from "../stores/infoStore.ts";
  import {useConfigStore} from "../stores/configStore.ts";
  import { loadWinKioskLauncherApps } from '../utils/kioskLauncher.js'

  // signalBridge instance centralizes ipc calls with platform checks
  const signalBridge = new SignalBridge(window);

  // Match wlan/wlp/wifi interface names from checkhostip — not a link-type probe.
  function isWirelessInterfaceName(name) {
    if (!name) return false;
    const n = String(name).toLowerCase();
    if (n.includes('wifi') || n.includes('wlan') || n.includes('wireless') || n.includes('wi-fi')) return true;
    return /^wl(p|x|an|o)?[\d]/.test(n) || n.startsWith('wl-');
  }

  export default {
    name: 'ExamHeader',
    mixins: [autoCleanupMixin],

    setup() {
      const configStore = useConfigStore();
      const infoStore = useInfoStore();
      const { hostip } = storeToRefs(configStore);
      const {
        groups, group, examtype, servername, clientname, serverstatus, pincode,
        localLockdown, online, battery, entryTime, componentName, wlanInfo,
        exammode, lockedSection, switchingToSection,
      } = storeToRefs(infoStore);

      return {
        hostip, groups, group, examtype, servername, clientname, serverstatus, pincode,
        localLockdown, online, battery, entryTime, componentName, wlanInfo, exammode, lockedSection,
        switchingToSection,
      };
    },
    data() {
      return {
        lastShownMessage: null,
        _nxHeaderResizeObs: null,
        _clockInterval: null,
        _entrytimeMs: 0,
        _sectionSwitchOverlayTimer: null,
        kioskLauncherApps: [],
      };
    },
    computed: {
      showSectionSwitchOverlay() {
        return this.switchingToSection != null;
      },
      warning() {
        return this.wlanInfo?.message === 'nopermissions' ? this.$t('student.wlanNopermissionsText') : null;
      },
      hostipDisplay() {
        return this.hostip && (typeof this.hostip === 'object' ? this.hostip.hostip : this.hostip);
      },
      hostInterfaceName() {
        const h = this.hostip;
        return (h && typeof h === 'object' && h.interface) ? String(h.interface) : '';
      },
      hostIpOnWirelessInterface() {
        return isWirelessInterfaceName(this.hostInterfaceName);
      },
      // True when WiFi is connected with usable SSID or signal.
      hasActiveWlan() {
        const w = this.wlanInfo;
        if (!w) return false;
        if (w.quality != null && w.quality > 0) return true;
        const ssid = w.ssid;
        return !!(ssid && !ssid.includes('redacted') && !ssid.includes('<') && ssid !== 'off/any');
      },
      // macOS-style redacted SSID while an IP is present.
      wifiSsidRedacted() {
        const ssid = this.wlanInfo?.ssid;
        return !!(ssid && (ssid.includes('redacted') || ssid.includes('<')));
      },
      showWlanQuality() {
        return this.hasActiveWlan && this.wlanInfo?.quality != null;
      },
      showWlanNoPermissions() {
        return this.wlanInfo?.message === 'nopermissions';
      },
      showWlanDisconnected() {
        const w = this.wlanInfo;
        if (!w || this.hasActiveWlan || this.showWlanNoPermissions || this.wifiSsidRedacted) return false;
        return true;
      },
      showWlanRedactedHint() {
        return this.wifiSsidRedacted && !!this.hostipDisplay;
      },
      showLanConnected() {
        if (!this.hostipDisplay || this.hasActiveWlan || this.hostIpOnWirelessInterface) return false;
        return true;
      },
      showLanDisconnected() {
        if (this.hostipDisplay || this.hasActiveWlan || this.wlanInfo == null) return false;
        return !this.hostIpOnWirelessInterface;
      },
      showWlanSsid() {
        const ssid = this.wlanInfo?.ssid;
        return !!(ssid && !ssid.includes('redacted') && !ssid.includes('<'));
      },
    },
    mounted() {
      this._entrytimeMs = Number(this.entrytime) || Date.now();
      this._clockInterval = new SchedulerService(1000);
      this._clockInterval.addEventListener('action', this.tickHeaderClock);
      this._clockInterval.start();
      this._nxSetHeaderHeightVar(); // keep --nx-apphead-h synced for overlays
      if (typeof ResizeObserver !== 'undefined') {
        this._nxHeaderResizeObs = new ResizeObserver(() => this._nxSetHeaderHeightVar());
        this._nxHeaderResizeObs.observe(this.$el);
      }
      window.addEventListener('resize', this._nxSetHeaderHeightVar);
      this.$nextTick(() => this.tickHeaderClock());
      loadWinKioskLauncherApps(signalBridge).then((apps) => { this.kioskLauncherApps = apps; });
      this._onSwitchingExamSection = (_event, sectionNumber) => {
        useInfoStore().beginSectionSwitch(Number(sectionNumber) || 1);
      };
      signalBridge.on('switching-exam-section', this._onSwitchingExamSection);
      useInfoStore().updateInfo();
      this.autoSchedulerService(() => useInfoStore().updateInfo(), 5000);
      this._scheduleEndSectionSwitchOverlay();
    },
    beforeUnmount() {
      if (this._sectionSwitchOverlayTimer) {
        clearTimeout(this._sectionSwitchOverlayTimer);
        this._sectionSwitchOverlayTimer = null;
      }
      signalBridge.removeAllListeners('switching-exam-section');
      if (this._clockInterval) {
        this._clockInterval.removeEventListener('action', this.tickHeaderClock);
        this._clockInterval.stop();
        this._clockInterval = null;
      }
      window.removeEventListener('resize', this._nxSetHeaderHeightVar);
      if (this._nxHeaderResizeObs) {
        this._nxHeaderResizeObs.disconnect();
        this._nxHeaderResizeObs = null;
      }
    },
    watch: {
      entrytime(ms) {
        this._entrytimeMs = Number(ms) || 0;
        this.tickHeaderClock();
      },
      'wlanInfo.message'(newMessage) {
        if (newMessage && newMessage !== this.lastShownMessage) {
          this.lastShownMessage = newMessage;
        } else if (!newMessage) {
          this.lastShownMessage = null;
        }
      },
      lockedSection() {
        this._scheduleEndSectionSwitchOverlay();
      },
      switchingToSection() {
        this._scheduleEndSectionSwitchOverlay();
      },
    },
    methods: {
      // Update clock DOM only — no reactive state, avoids header re-render each tick.
      tickHeaderClock() {
        const el = this.$refs.headerClock;
        if (!el) return;
        const now = Date.now();
        const base = this._entrytimeMs || now;
        const elapsed = new Date(now - base).toISOString().substr(11, 8);
        el.textContent = moment().tz('Europe/Vienna').format('HH:mm:ss');
        el.title = `Exam: ${elapsed}`;
      },
      _nxSetHeaderHeightVar() {
        this.$nextTick(() => {
          const h = Math.max(0, Math.round(this.$el?.offsetHeight || 0));
          document.documentElement.style.setProperty('--nx-apphead-h', `${h || 60}px`);
        });
      },
      reconnect() {
        // Restore connection
        this.$emit('reconnect');
      },
      gracefullyExit() {
        // Clean exit from safe exam mode
        this.$emit('gracefullyExit');
      },
      async launchKioskApp(exePath) {
        const p = String(exePath || '').trim();
        if (!p) return;
        const res = await signalBridge.invoke('launch-kiosk-allowed-app', p);
        if (res?.ok) return;
        this.$swal.fire({ title: 'Error', text: res?.error || 'launch failed', icon: 'error', showCancelButton: false });
      },
      async switchExamSection(sectionNumber) {
        if (!this.serverstatus?.allowSectionSwitch || this.lockedSection === sectionNumber) return;

        if (this.serverstatus.examSections[this.lockedSection].examtype == 'microsoft365'){
          signalBridge.send('collapse-browserview');
        }
        //  ask if the user wants to switch to the new section via swal2dialog
        this.$swal.fire({
          title: this.$t('editor.sectionSwitchTitle'),
          text: this.$t('editor.sectionSwitchText'),
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Ok',
          cancelButtonText: this.$t('editor.cancel'),
        }).then( (result) => {
          if (result.isConfirmed) {
            console.log(`switchExamSection: calling switch-exam-section`)
            const infoStore = useInfoStore();
            infoStore.beginSectionSwitch(sectionNumber);
            signalBridge.invoke('switch-exam-section', sectionNumber)
              .finally(() => {
                this._scheduleEndSectionSwitchOverlay();
                setTimeout(() => {
                  if (infoStore.switchingToSection === sectionNumber) infoStore.endSectionSwitchOverlay();
                }, 12000);
              });
          }
          else {
            if (this.serverstatus.examSections[this.lockedSection].examtype == 'microsoft365'){
              signalBridge.send('restore-browserview');
            }
          }
        });
      },
      // Hide overlay after min display once lockedSection matches the switch target.
      _scheduleEndSectionSwitchOverlay() {
        const infoStore = useInfoStore();
        const target = infoStore.switchingToSection;
        if (target == null || this.lockedSection !== target) return;
        if (this._sectionSwitchOverlayTimer) clearTimeout(this._sectionSwitchOverlayTimer);
        const minMs = 450;
        const elapsed = Date.now() - (infoStore.switchingStartedAt || 0);
        const delay = Math.max(0, minMs - elapsed);
        this._sectionSwitchOverlayTimer = setTimeout(() => {
          this._sectionSwitchOverlayTimer = null;
          infoStore.endSectionSwitchOverlay();
        }, delay);
      },
    },
  }
</script>
  
<style scoped>
/* Header spezifisches CSS */

#apphead {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    
    align-items: center;
    align-content: flex-start;
    z-index:10000000 !important;
    color: #fff;
    padding: 10px;
}

.header-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 1;
    min-width: 0;
}

.header-right {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
}

.header-sections {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
}

.header-meta {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
}

.header-sep {
    font-weight: 900;
    font-size: 1.25em;
    line-height: 1;
    padding: 0 0.45em;
    color: #fff;
}

.header-item {
    display: flex;
    flex-grow: 0;
    flex-shrink: 1;
    flex-basis: auto;
    align-self: auto;
    order: 0;
    align-items: center;
}

.disabledbtn {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
}

.kiosk-launcher-bar {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    max-width: min(42vw, 280px);
    vertical-align: middle;
}

.kiosk-launcher-btn {
    max-width: 4.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.68rem;
    line-height: 1.15;
    color: #fff;
}

.section-switch-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
    z-index: 200001;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.section-switch-card {
    background: rgba(33, 37, 41, 0.94);
    border-radius: 10px;
    padding: 22px 28px;
    text-align: center;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.section-switch-spinner {
    width: 28px;
    height: 28px;
    margin: 0 auto;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: #0aa2c0;
    border-radius: 50%;
    animation: section-switch-spin 0.85s linear infinite;
}

@keyframes section-switch-spin {
    to { transform: rotate(360deg); }
}

.section-switch-text {
    margin-top: 12px;
    font-size: 0.95rem;
    opacity: 0.92;
}

</style>
  
