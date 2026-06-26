<template>

    <div id="apphead" class="bg-dark">
        <div class="header-left">
            <div v-if="online && !localLockdown" class="header-item">
                <img src="/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <button v-if="groups  && group === 'a'" type="button" class="header-item btn btn-info btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> A  </button>
                <button v-if="groups  && group === 'b'" type="button" class="header-item btn btn-warning btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> B  </button>
                <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}} @ {{servername}} | {{pincode}}</span>
                <span class="fs-5 align-middle me-4 teal" style="float: left;" >| {{$t('student.connected')}}</span>
                <span v-if="kioskLauncherApps.length" class="kiosk-launcher-bar ms-1">
                    <button v-for="app in kioskLauncherApps" :key="app.path" type="button"
                            class="btn btn-outline-cyan btn-sm py-1 px-3 ms-2 kiosk-launcher-btn"
                            :title="app.path" @click="launchKioskApp(app.path)">{{ app.name }}</button>
                </span>
            </div>
            <div v-if="!online && !localLockdown" class="header-item">
                <img src="/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style=" float: left;" />
                <span class="fs-5 align-middle me-1" style=" float: left;"> {{clientname}} </span>
                <span class="fs-5 align-middle me-4 red" style="float: left;"> | {{ $t("student.disconnected") }} </span>
            </div>
            <div v-if="localLockdown" class="header-item">
                <img src="/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}}</span>
                <span v-if="localLockdown && exammode"  class="fs-5 align-middle me-4 green" style="float: left;" >| Lokal abgesichert</span>
                <span v-if="localLockdown && !exammode"  class="fs-5 align-middle me-4 red" style="float: left;" >| nicht abgesichert</span>
            </div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-success p-1 me-1 btn-sm" @click="reconnect()"><img src="/img/svg/gtk-convert.svg" class="" width="22" height="20"> {{ $t("editor.reconnect")}}</div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyExit()"><img src="/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.endexam")}} </div>
            <div v-if="localLockdown && exammode" class="header-item btn btn-danger p-1 pe-2 me-1 btn-sm"  @click="gracefullyExit()"><img src="/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.endexam") }}  </div>
        </div>
        
     

        <!-- Exam sections: show all 4 section buttons and current section; if allowSectionSwitch, buttons trigger switch-exam-section IPC -->
        <div v-if="serverstatus?.useExamSections" class="header-item me-2">
            <div v-for="n in 4" :key="n"
                class="header-item btn btn-sm ms-1 p-0 pe-1 ps-1"
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
                <img v-if="wlanInfo.quality > 80" src="/img/svg/network-wireless-connected-100.svg"  :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" class="" width="24" height="24" style="vertical-align: bottom;" />
                <img v-else-if="wlanInfo.quality > 50" src="/img/svg/network-wireless-connected-80.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 30" src="/img/svg/network-wireless-connected-60.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 10" src="/img/svg/network-wireless-connected-40.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 5" src="/img/svg/network-wireless-connected-20.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" src="/img/svg/network-wireless-connected-00.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN permission not available -->
            <div v-else-if="showWlanNoPermissions" class="me-2">
                <img :title="$t('student.wlanNopermissionsText')" :alt="$t('student.wlanNopermissionsText')" src="/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>

            <!-- WLAN not connected (no interface, givingup, or idle adapter) -->
            <div v-else-if="showWlanDisconnected" class="me-2">
                <img title="WLAN disconnected" alt="WLAN disconnected" src="/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>

            <!-- Redacted SSID on WiFi (e.g. macOS privacy) while IP is known -->
            <div v-else-if="showWlanRedactedHint" class="me-2">
              <img :title="'WiFi Information not available \nIP: '+hostipDisplay" :alt="'WiFi Information not available'" src="/img/svg/network-wireless-connected-20.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- LAN connected whenever host IP is known (independent of WiFi state) -->
            <div v-if="showLanConnected" class="me-2">
                <img :title="'Connected: '+hostipDisplay" alt="Connected" src="/img/svg/network-wired-available.svg" width="24" height="24" >
            </div>

            <!-- LAN disconnected only after network poll, when no host IP -->
            <div v-else-if="showLanDisconnected" class="me-2">
                <img title="Disconnected" alt="Disconnected" src="/img/svg/network-wired-unavailable.svg" width="24" height="24" >
            </div>





            
            <div v-if="battery && battery.level" style="font-size: 0.8rem;"> {{ Math.round(battery.level*100)}}%  </div>
            <div v-if="battery && battery.level" class="me-2">
                <img v-if="battery && battery.level > 0.9" src="/img/svg/battery-100.svg"  :title="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.8 && battery.level <= 0.9 " src="/img/svg/battery-090.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.7 && battery.level <= 0.8 " src="/img/svg/battery-080.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.6 && battery.level <= 0.7 " src="/img/svg/battery-070.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.5 && battery.level <= 0.6 " src="/img/svg/battery-060.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.4 && battery.level <= 0.5 " src="/img/svg/battery-050.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.3 && battery.level <= 0.4 " src="/img/svg/battery-040.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.2 && battery.level <= 0.3 " src="/img/svg/battery-030.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.1 && battery.level <= 0.2 " src="/img/svg/battery-020.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level <= 0.1" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" src="/img/svg/battery-010.svg" width="32" height="32" >
            </div>
            <span ref="headerClock" class="fs-5 d-inline-block" style="width:90px;"></span>
            <div class="fs-5" >{{componentName}}</div>
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
  import { switchExamSectionFiles } from '../utils/switchExamSection.ts'
  import {isIOS} from "../types/platform.ts";
  import iosUpdateListener from "../utils/ios/iosUpdateListener.ts";

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
      const { hostip, examdirectory } = storeToRefs(configStore);
      const {
        groups, group, examtype, servername, clientname, serverstatus, pincode,
        localLockdown, online, battery, entryTime, componentName, wlanInfo,
        exammode, lockedSection,
      } = storeToRefs(infoStore);

      return {
        hostip, examdirectory, groups, group, examtype, servername, clientname, serverstatus, pincode,
        localLockdown, online, battery, entryTime, componentName, wlanInfo, exammode, lockedSection,
      };
    },
    data() {
      return {
        lastShownMessage: null,
        _nxHeaderResizeObs: null,
        _clockInterval: null,
        _entrytimeMs: 0,
        kioskLauncherApps: [],
      };
    },
    computed: {
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
      useInfoStore().updateInfo();
      this.autoSchedulerService(() => useInfoStore().updateInfo(), 5000);
    },
    beforeUnmount() {
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
      }
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
        }).then( async (result) => {
          if (result.isConfirmed) {
            console.log(`switchExamSection: running file ops then calling switch-exam-section`)
            await switchExamSectionFiles(this.examdirectory, this.lockedSection, sectionNumber);
            await signalBridge.invoke('switch-exam-section', sectionNumber);
            if (isIOS()) {
                iosUpdateListener.handleUpdateReceived(true, sectionNumber);
            }
          }
          else {
            if (this.serverstatus.examSections[this.lockedSection].examtype == 'microsoft365'){
              signalBridge.send('restore-browserview');
            }
          }
        });
      }
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

</style>
  
