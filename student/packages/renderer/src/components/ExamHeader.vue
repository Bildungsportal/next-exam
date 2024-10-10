<template>

    <div id="apphead" class="bg-dark">
        <div v-if="online && !localLockdown" class="header-item">
            <img src="/src/assets/img/svg/speedometer.svg" class="white me-2" width="32" height="32" style="float: left;" />
            <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'a'" type="button" class="header-item btn btn-info btn-sm ms-2 me-1" style="cursor: unset; width: 32px; justify-content:center; "> A  </button>
            <button v-if="clientinfo && clientinfo.groups  && clientinfo.group == 'b'" type="button" class="header-item btn btn-warning btn-sm ms-2 me-1" style="cursor: unset; width: 32px; justify-content:center; "> B  </button>
            <span class="fs-5 align-middle me-1" style="float: left;">{{clientname}}</span>
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
        <div v-if="!online && !localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyexit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.unlock")}} </div>
        <div v-if="localLockdown && exammode" class="header-item btn btn-danger p-1 me-1 btn-sm"  @click="gracefullyexit()"><img src="/src/assets/img/svg/dialog-cancel.svg" class="" width="22" height="20"> {{ $t("editor.unlock")}} </div>
        
     

        <div class="header-item fs-5" v-if="servername" style="margin: auto auto;">{{servername}}|{{pincode}}</div>

        <div class="header-item">
            <div v-if="battery && battery.level" style="font-size: 0.8rem;"> {{ Math.round(battery.level*100)}}%  </div>
            <div v-if="battery && battery.level" class="me-2">
                <img v-if="battery && battery.level > 0.9" src="/src/assets/img/svg/battery-100.svg"  :title="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.8 && battery.level < 0.9 " src="/src/assets/img/svg/battery-090.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.7 && battery.level < 0.8 " src="/src/assets/img/svg/battery-080.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.6 && battery.level < 0.7 " src="/src/assets/img/svg/battery-070.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.5 && battery.level < 0.6 " src="/src/assets/img/svg/battery-060.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.4 && battery.level < 0.5 " src="/src/assets/img/svg/battery-050.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.3 && battery.level < 0.4 " src="/src/assets/img/svg/battery-040.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.2 && battery.level < 0.3 " src="/src/assets/img/svg/battery-030.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
                <img v-if="battery && battery.level > 0.1 && battery.level < 0.2 " src="/src/assets/img/svg/battery-020.svg" :title="battery.level*100+'%'" :alt="battery.level*100+'%'" class="white" width="32" height="32" />
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
    props: ['serverstatus','clientinfo','online', 'clientname', 'exammode', 'servername', 'pincode', 'battery', 'currenttime','timesinceentry','componentName','localLockdown'],
    methods: {
      reconnect() {
        // Methode zur Wiederherstellung der Verbindung
        this.$emit('reconnect');
      },
      gracefullyexit() {
        // Methode zum sauberen Beenden des abgesicherten Modus
        this.$emit('gracefullyexit');
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
    z-index:10000 !important;
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
  