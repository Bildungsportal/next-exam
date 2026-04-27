<template>

    <div id="apphead" class="bg-dark">
        <div class="header-left">
            <div v-if="online && !localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'a'" type="button" class="header-item btn btn-info btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> A  </button>
                <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'b'" type="button" class="header-item btn btn-warning btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> B  </button>
                <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}} @ {{servername}} | {{pincode}}</span>
                <span class="fs-5 align-middle me-4 teal" style="float: left;" >| {{$t('student.connected')}}</span>
            </div>
            <div v-if="!online && !localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style=" float: left;" />
                <span class="fs-5 align-middle me-1" style=" float: left;"> {{clientname}} </span>
                <span class="fs-5 align-middle me-4 red" style="float: left;"> | {{ $t("student.disconnected") }} </span>
            </div>
            <div v-if="localLockdown" class="header-item">
                <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
                <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}}</span>
                <span v-if="localLockdown && exammode"  class="fs-5 align-middle me-4 green" style="float: left;" >| Lokal abgesichert</span>
                <span v-if="localLockdown && !exammode"  class="fs-5 align-middle me-4 red" style="float: left;" >| nicht abgesichert</span>
            </div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-success p-1 me-1 btn-sm" @click="reconnect()"><img src="/src/assets/img/svg/gtk-convert.svg" class="" width="22" height="20"> {{ $t("editor.reconnect")}}</div>
            <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyExit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.unlock")}} </div>
            <div v-if="localLockdown && exammode" class="header-item btn btn-danger p-1 pe-2 me-1 btn-sm"  @click="gracefullyExit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.unlock") }}  </div>
        </div>
        
     

        <!-- Exam sections: show all 4 section buttons and current section; if allowSectionSwitch, buttons trigger switch-exam-section IPC -->
        <div v-if="serverstatus?.useExamSections" class="header-item me-2">
            <div v-for="n in 4" :key="n"
                class="header-item btn btn-sm ms-1 p-0 pe-1 ps-1"
                :class="(clientinfo?.lockedSection === n ? 'btn-teal' : 'btn-outline-secondary') + (!serverstatus?.allowSectionSwitch ? ' disabledbtn' : '') "
                @click="switchExamSection(n)">
                {{ serverstatus?.examSections?.[n]?.sectionname || n }}
            </div>
        </div>

        <div class="header-item">

            <!-- Show WLAN SSID -->
            <div v-if="wlanInfo && wlanInfo?.ssid && !wlanInfo.ssid.includes('redacted') && !wlanInfo.ssid.includes('<') " style="font-size: 0.8rem;" class="me-1"> {{ wlanInfo.ssid }}  </div>


            <!-- Shows WIFI ICON if IP is available and no WLAN info available-->

            <!-- WLAN quality not available and SSID set to <redacted>  (happens on MacOS >= sequoia) -->
            <div v-if="wlanInfo && wlanInfo.ssid && !wlanInfo.quality && hostipDisplay" class="me-2">
              <img :title="'WiFi Information not available \nIP: '+hostipDisplay" :alt="'WiFi Information not available'" src="/src/assets/img/svg/network-wireless-connected-20.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN SSID and quality not available (happens on windows without location services) -->
            <div v-if="wlanInfo && !wlanInfo.ssid && !wlanInfo.quality && hostipDisplay" class="me-2">
              <img :title="'WiFi Information not available \nIP: '+hostipDisplay" :alt="'WiFi Information not available'" src="/src/assets/img/svg/network-wireless-connected-20.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>
            <!-- WLAN permission not available -->
            <div v-else-if="wlanInfo && wlanInfo?.message == 'nopermissions'" class="me-2">
                <img :title="$t('student.wlanNopermissionsText')" :alt="$t('student.wlanNopermissionsText')" src="/src/assets/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>



            <!-- Show WLAN quality -->
            <div v-if="wlanInfo && wlanInfo?.quality" class="me-2">
                <img v-if="wlanInfo && wlanInfo.quality > 80" src="/src/assets/img/svg/network-wireless-connected-100.svg"  :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" class="" width="24" height="24" style="vertical-align: bottom;" />
                <img v-if="wlanInfo && wlanInfo.quality > 50 && wlanInfo.quality <= 80" src="/src/assets/img/svg/network-wireless-connected-80.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-if="wlanInfo && wlanInfo.quality > 30 && wlanInfo.quality <= 50" src="/src/assets/img/svg/network-wireless-connected-60.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-if="wlanInfo && wlanInfo.quality > 10 && wlanInfo.quality <= 30" src="/src/assets/img/svg/network-wireless-connected-40.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-if="wlanInfo && wlanInfo.quality > 5  && wlanInfo.quality <= 10" src="/src/assets/img/svg/network-wireless-connected-20.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-if="wlanInfo && wlanInfo.quality <= 5" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostipDisplay" :alt="wlanInfo.quality+'%'" src="/src/assets/img/svg/network-wireless-connected-00.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN disconnected - no interface available -->
            <div v-if="wlanInfo && wlanInfo?.message == 'nointerface'" class="me-2">
                <img title="WLAN disconnected" alt="WLAN disconnected" src="/src/assets/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>
   

            <!-- Show LAN connected if IP is available and no WLAN info available -->
            <div v-if="hostipDisplay && wlanInfo?.message == 'nointerface'" class="me-2">
                <img :title="'Connected: '+hostipDisplay" alt="Connected" src="/src/assets/img/svg/network-wired-available.svg" width="24" height="24" >
            </div>

            <!-- Show LAN disconnected if IP is not available and no WLAN info available -->
            <div v-if="!hostipDisplay && (!wlanInfo?.ssid && !wlanInfo?.quality)" class="me-2">
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
            <div class="fs-5" style="width:90px;" :title="'Exam: '+timesinceentry" >{{currenttime}}</div>
            <div class="fs-5" >{{componentName}}</div>
        </div>
    </div>
  
</template>
  
<script>
  import {SignalBridge} from '../utils/signalBridge.js'

  // signalBridge instance centralizes ipc calls with platform checks
  const signalBridge = new SignalBridge(window);
  

  export default {
    name: 'ExamHeader',
    props: ['serverstatus','clientinfo','online', 'clientname', 'exammode', 'servername', 'pincode', 'battery', 'currenttime','timesinceentry','componentName','localLockdown','wlanInfo','hostip'],
    data() {
      return {
        lastShownMessage: null,
        _nxHeaderResizeObs: null
      };
    },
    computed: {
      warning() {
        return this.wlanInfo?.message === 'nopermissions' ? this.$t('student.wlanNopermissionsText') : null;
      },
      hostipDisplay() {
        return this.hostip && (typeof this.hostip === 'object' ? this.hostip.hostip : this.hostip);
      }
    },
    mounted() {
      this._nxSetHeaderHeightVar(); // keep --nx-apphead-h synced for overlays
      if (typeof ResizeObserver !== 'undefined') {
        this._nxHeaderResizeObs = new ResizeObserver(() => this._nxSetHeaderHeightVar());
        this._nxHeaderResizeObs.observe(this.$el);
      }
      window.addEventListener('resize', this._nxSetHeaderHeightVar);
    },
    beforeUnmount() {
      window.removeEventListener('resize', this._nxSetHeaderHeightVar);
      if (this._nxHeaderResizeObs) {
        this._nxHeaderResizeObs.disconnect();
        this._nxHeaderResizeObs = null;
      }
    },
    watch: {
      'wlanInfo.message'(newMessage) {
        if (newMessage && newMessage !== this.lastShownMessage) {
          this.lastShownMessage = newMessage;
        } else if (!newMessage) {
          this.lastShownMessage = null;
        }
      }
    },
    methods: {
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
      async switchExamSection(sectionNumber) {
        if (!this.serverstatus?.allowSectionSwitch || this.clientinfo?.lockedSection === sectionNumber) return;
        
        if (this.serverstatus.examSections[this.clientinfo.lockedSection].examtype == 'microsoft365'){
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
            signalBridge.invoke('switch-exam-section', sectionNumber);
          }
          else {
            if (this.serverstatus.examSections[this.clientinfo.lockedSection].examtype == 'microsoft365'){
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


</style>
  
