<template>

    <div id="apphead" class="bg-dark">
        <div v-if="online && !localLockdown" class="header-item">
            <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
            <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'a'" type="button" class="header-item btn btn-info btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> A  </button>
            <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'b'" type="button" class="header-item btn btn-warning btn-sm ms-2 me-2" style="cursor: unset; width: 32px; justify-content:center; "> B  </button>
            <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}} @ {{servername}} | {{pincode}}</span>


            <span class="fs-5 align-middle me-4 green" style="float: left;" >| {{$t('student.connected')}}</span> 
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
        <div v-if="localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyExit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.unlock")}} </div>
        
     

      
        <div class="header-item">

            <!-- WLAN: SSID text (when not redacted) -->
            <div v-if="showWlanSsid" style="font-size: 0.8rem;" class="me-1"> {{ wlanInfo.ssid }}  </div>

            <!-- WLAN: quality bars (when we have signal strength) -->
            <div v-if="wlanInfo && wlanInfo?.quality != null" class="me-2">
                <img v-if="wlanInfo.quality > 80" src="/src/assets/img/svg/network-wireless-connected-100.svg"  :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" class="" width="24" height="24" style="vertical-align: bottom;" />
                <img v-else-if="wlanInfo.quality > 50" src="/src/assets/img/svg/network-wireless-connected-80.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 30" src="/src/assets/img/svg/network-wireless-connected-60.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 10" src="/src/assets/img/svg/network-wireless-connected-40.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else-if="wlanInfo.quality > 5" src="/src/assets/img/svg/network-wireless-connected-20.svg" :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" :alt="wlanInfo.quality+'%'" class="" width="24" height="24" style="vertical-align: bottom;"/>
                <img v-else :title="'Quality: '+wlanInfo.quality+'% \nIP: '+hostip" :alt="wlanInfo.quality+'%'" src="/src/assets/img/svg/network-wireless-connected-00.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN: "info not available" (WLAN exists but SSID/quality missing, e.g. macOS redacted, Windows without location) – only when we have WLAN context, never when no interface -->
            <div v-if="showWlanInfoNotAvailable" class="me-2">
              <img :title="'WiFi Information not available \nIP: '+hostip" :alt="'WiFi Information not available'" src="/src/assets/img/svg/network-wireless-connected-20.svg" width="24" height="24" style="vertical-align: bottom;" />
            </div>

            <!-- WLAN disconnected (no WLAN interface / giving up) -->
            <div v-if="noWlanInterface" class="me-2">
                <img title="WLAN disconnected" alt="WLAN disconnected" src="/src/assets/img/svg/network-wireless-disconnected.svg" width="24" height="24" >
            </div>

            <!-- LAN: show when no WLAN data (no interface, or wlanInfo not loaded, or error). Connected if hostip, disconnected otherwise. -->
            <div v-if="showLanConnected" class="me-2">
                <img :title="'Connected: '+hostip" alt="LAN connected" src="/src/assets/img/svg/network-wired-available.svg" width="24" height="24" >
            </div>
            <div v-if="showLanDisconnected" class="me-2">
                <img title="Disconnected" alt="LAN disconnected" src="/src/assets/img/svg/network-wired-unavailable.svg" width="24" height="24" >
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
  export default {
    name: 'ExamHeader',
    props: ['serverstatus','clientinfo','online', 'clientname', 'exammode', 'servername', 'pincode', 'battery', 'currenttime','timesinceentry','componentName','localLockdown','wlanInfo','hostip'],
    data() {
      return {
        lastShownMessage: null
      };
    },
    computed: {
      // No WLAN interface (LAN-only or giving up after repeated no-interface)
      noWlanInterface() {
        return this.wlanInfo && (this.wlanInfo.message === 'nointerface' || this.wlanInfo.message === 'givingup');
      },
      // We have WLAN data to show (SSID or quality or "info not available" context) – then we do not show LAN icons
      hasWlanData() {
        if (!this.wlanInfo) return false;
        const hasSsid = this.wlanInfo.ssid && !this.wlanInfo.ssid.includes('redacted') && !this.wlanInfo.ssid.includes('<');
        const hasQuality = this.wlanInfo.quality != null;
        const infoNotAvailableContext = !this.noWlanInterface && !this.wlanInfo.ssid && (this.wlanInfo.quality === null || this.wlanInfo.quality === undefined);
        return hasSsid || hasQuality || (infoNotAvailableContext && this.hostip);
      },
      showWlanSsid() {
        return this.wlanInfo && this.wlanInfo.ssid && !this.wlanInfo.ssid.includes('redacted') && !this.wlanInfo.ssid.includes('<');
      },
      // WLAN exists but SSID/quality missing (macOS redacted, Windows without location) – never when no interface
      showWlanInfoNotAvailable() {
        if (!this.wlanInfo || this.noWlanInterface) return false;
        const ssidUsable = this.wlanInfo.ssid && !this.wlanInfo.ssid.includes('redacted') && !this.wlanInfo.ssid.includes('<');
        const hasSsidNoQuality = ssidUsable && (this.wlanInfo.quality === null || this.wlanInfo.quality === undefined);
        const noSsidNoQuality = !this.wlanInfo.ssid && (this.wlanInfo.quality === null || this.wlanInfo.quality === undefined);
        return (hasSsidNoQuality || (noSsidNoQuality && this.hostip));
      },
      // Show LAN icon when we do not have WLAN data (so LAN state is relevant)
      showLanConnected() {
        return this.hostip && !this.hasWlanData;
      },
      showLanDisconnected() {
        return !this.hostip && !this.hasWlanData;
      }
    },
    watch: {
      'wlanInfo.message'(newMessage) {
        if (newMessage && newMessage !== this.lastShownMessage) {
          this.showWlanMessage(newMessage);
          this.lastShownMessage = newMessage;
        } else if (!newMessage) {
          this.lastShownMessage = null;
        }
      }
    },
    methods: {
      reconnect() {
        // Methode zur Wiederherstellung der Verbindung
        this.$emit('reconnect');
      },
      gracefullyExit() {
   
        // Methode zum sauberen Beenden des abgesicherten Modus
        this.$emit('gracefullyExit');
      },
      showWlanMessage(message) {
        let title = '';
        let text = '';
        let icon = 'warning';
        
        // additional messages: 'nointerface', 'givingup'  - not handled here for now - just silently ignore them

        switch (message) {

          case 'nopermissions':
            title = 'Standortberechtigung erforderlich';
            text = 'Windows benötigt Standortberechtigungen, um WLAN-Informationen abzurufen. Bitte aktivieren Sie die Positionsdienste in den Datenschutz- und Sicherheitseinstellungen.';
            icon = 'warning';
            break;
          default:
            return;
        }
        
        this.$swal.fire({
          title: title,
          text: text,
          icon: icon,
          confirmButtonText: 'OK',
          allowEscapeKey: true,
          didOpen: (popup) => {
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

.header-item {
    display: flex;
    flex-grow: 0;
    flex-shrink: 1;
    flex-basis: auto;
    align-self: auto;
    order: 0;
    align-items: center;
}


</style>
  