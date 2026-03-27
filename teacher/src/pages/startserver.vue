<template>
<div class="startserver-page d-flex flex-column overflow-hidden" style="height: 100vh;">
<!-- Header START -->
<div class="w-100 p-3 text-white bg-dark text-left flex-shrink-0" style="height: 63px; z-index: 1000;">
    <span class="text-white m-1">
        <img src="/src/assets/img/svg/shield-lock-fill.svg" class="white me-2  " width="32" height="32" >
        <span style="font-size:23px;" class="align-middle me-1 ">Next-Exam</span>
    </span>
    <span class="align-middle ms-3 " style="float: right; font-size:23px;">Teacher</span>
    <div v-if="!hostip" id="adv" class="btn btn-sm btn-outline-danger  " style="cursor: unset; float: right">{{ $t("general.offline") }}</div>
    <div v-if="hostip && hostip.interface" id="adv" class="btn btn-sm btn-outline-success " style=" float: right" @click="reconfigurePreferredInterface()">{{ hostip.interface }} :   {{ hostip.hostip }}</div>
</div>
<!-- Header END -->
 


<div id="wrapper" class="w-100 d-flex flex-grow-1" style="min-height: 0;">

    <!-- sidebar -->
    <div id="sidebar" class="p-3 text-white bg-dark h-100 d-flex flex-column position-relative overflow-hidden" style="width: 240px; min-width: 240px;">
        <div class="flex-shrink-0">
        <div class="btn btn-light ms-1 text-start infobutton" @click="activeTab = 'pruefung'; selectedExam = null; servername = ''; password = ''; advanced = false; checkExistingExam();" :style="activeTab !== 'pruefung' ? 'border-right: 2px solid #aaa; box-shadow: -6px -3px 10px -12px inset #000; color: #666;' : ''">
            <img src='/src/assets/img/svg/server.svg' class="me-2"  width="16" height="16" :style="activeTab !== 'pruefung' ? 'opacity: 0.5;' : ''">
            {{$t("general.startserver")}}
        </div>
        <div v-if="config.bipIntegration" class="btn btn-light ms-1 mt-1 text-start infobutton" @click="activeTab = 'bildungsportal'; selectedExam = null; servername = ''; password = ''; advanced = false; checkExistingExam();" :style="activeTab !== 'bildungsportal' ? 'border-right: 2px solid #aaa; box-shadow: -6px 0px 10px -12px inset #000; color: #666;' : ''">
            <img src='/src/assets/img/svg/shield-lock-fill.svg' class="me-2 "  width="16" height="16"  :style="activeTab !== 'bildungsportal' ? 'opacity: 0.5;' : ''">
            {{$t("dashboard.bildungsportal")}}
        </div><br v-if="config.bipIntegration">

        <div v-if="freeDiscspace < 0.1" class="warning">  {{ $t("startserver.freespacewarning") }}   </div>

        <!-- Extended Settings START -->
        <div class="form-check form-switch m-1 mb-2 mt-2">
            <label for="advanced" class="form-check-label">{{$t('startserver.extendedsettings')}}</label>
            <input id="advanced" type="checkbox"  v-model="advanced" class="form-check-input" @change="toggleAdvanced">
        </div>
        <!-- Extended Settings END -->
 

        <!-- BIP Section START -->
        <div v-if="config.bipIntegration && activeTab === 'bildungsportal'" class="m-0 mt-3" style="">

            <div v-if="bipToken" title="logout" id="biploginbutton" @click="logoutBiP()" class="btn btn-success m-1" style="padding:0px;">
                <img id="biplogo" style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span style="padding:2px; font-size:0.9em;"  id="biploginbuttonlabel">Logout</span>
            </div>
            <div v-else title="login" id="biploginbutton" @click="loginBiP()" class="btn btn-info m-1" style="padding:0px;">
                <img id="biplogo" style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span style="padding:2px; font-size:0.9em;"  id="biploginbuttonlabel">Login</span>
            </div>
        </div>
        <!-- BIP Section END -->
        </div>

        <!-- scrollable exam lists -->
        <div id="sidebar-scroll" class="flex-grow-1 overflow-auto pb-2" style="min-height: 0;">
            <div v-if="activeTab === 'pruefung'">

            <!-- headings for previous exam list -->
            <div class="flex-shrink-0 mt-2" v-if="previousLocalExams && previousLocalExams.length > 0">
                <span class="small d-block m-1 mt-2">{{$t("startserver.previousexams")}}</span>
            </div>

            <!-- previous exams -->
            <div id="previous" class="m-1 mt-2" v-if="previousLocalExams && previousLocalExams.length > 0">
                <div v-for="exam of previousLocalExams">
                    <div class="input-group" style="display:inline;">
                        <div class="btn btn-sm btn-warning mt-1" @click="delPreviousExam(exam.examName)">x</div>
                        <div  class="btn btn-sm mt-1" :id="exam.examName" 
                            :class="[ servername === exam.examName ? 
                                (exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? 'btn-cyan cursornotallowed' : 'btn-cyan ')  : 
                                (exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? 'btn-secondary cursornotallowed' : 'btn-secondary ')
                            ]"
                            @click="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? '' : setPreviousExam(exam)"
                            :title="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? $t('startserver.incompatible') : ''"
                            >
                            {{ exam.examName }}
                        </div>
                    </div>
                    <img v-if="servername === exam.examName" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" >
                </div>
            </div>
            </div>

            <div v-if="activeTab === 'bildungsportal'">
            <!-- headings for previous bip exam list -->
            <div class="flex-shrink-0 mt-2" v-if="previousBipExams && previousBipExams.length > 0">
                <span class="small d-block m-1 mt-2">{{$t("startserver.previousexams")}}</span>
            </div>

            <!-- previous bip exams -->
            <div id="previous-bip" class="m-1 mt-2" v-if="previousBipExams && previousBipExams.length > 0">
                <div v-for="exam of previousBipExams">
                    <div class="input-group" style="display:inline;">
                        <div class="btn btn-sm btn-warning mt-1" @click="delPreviousExam(exam.examName)">x</div>
                        <div  class="btn btn-sm mt-1" :id="exam.examName" 
                            :class="[ servername === exam.examName ?
                                (exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? 'btn-success cursornotallowed' : 'btn-success ')  :
                                (exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? 'btn-secondary cursornotallowed' : 'btn-secondary ')
                            ]"
                            @click="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? '' : setPreviousExam(exam)"
                            :title="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? $t('startserver.incompatible') : ''"
                            >
                            {{ exam.examName }}
                        </div>
                        <div class="btn btn-sm btn-cyan mt-1" style="width:14px; height: 31px;">
                            <div style="writing-mode:vertical-rl; font-size:0.8em; margin-left:-10px; margin-top:2px;color: whitesmoke;">BiP</div>
                        </div>
                    </div>
                    <img v-if="servername === exam.examName" src="/src/assets/img/svg/games-solve.svg" class="printercheck" width="22" height="22" >
                </div>
            </div>
            </div>
        </div>
        <!-- sidebar-scroll end -->
        
        <div id="statusdiv" class="m-0 ms-1 btn btn-warning" style="bottom: 0; left: 0; width: 206px;">{{$t("startserver.connected")}}</div>

        <div id="sidebar-bottom" class="flex-shrink-0 mt-auto position-relative">
            <button class="btn btn-outline-secondary btn-sm ms-1 mt-2 mb-1" @click="toggleLocale">{{ inactivelocale }}</button>
            <div class="small mt-1 ms-1">
                <span @click="showCopyleft()" style="font-size:0.8em; cursor: pointer;">
                    <span style="display:inline-block; transform: scaleX(-1);font-size:1.2em;">&copy;</span> 
                    <span style="vertical-align: text-bottom;">&nbsp;{{version}} {{ info }}</span>
                </span>
            </div>
        </div>
    </div>

    <!-- maincontent -->
    <div id="content" class="fadeinslow p-3">
        <div class="col8">

            <!-- Prüfung anlegen START -->
            <div v-if="activeTab === 'pruefung'">
                <div class="input-group  mb-1 mt-0">
                    <span class="input-group-text col-2 grayback" id="inputGroup-sizing-lg" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.examname")}}</span>
                    <input v-model="servername" @paste.prevent @drop.prevent @click="servername = ''; checkExistingExam()" maxlength="20" type="text" class="form-control" id="servername" placeholder="5a-mathematik" style="width:200px;max-width:200px;min-width:135px;">
                </div>

                <!-- could be used to set an ESCAPE PASSWORD for students to make it harder to leave on connection loss -->
                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content">
                    <span id="pwd" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.pwd")}}</span>
                    <input v-model="password" :type="showPassword ? 'text' : 'password'" class="form-control" id="examPassword" style="width:200px;">
                    <button @click="togglePasswordVisibility" class="password-visibility-btn" type="button">
                        <img :src="showPassword ? '/src/assets/img/svg/eye-slash-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" class="password-visibility-icon" width="16" height="16">
                    </button>
                </div>

                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content">
                    <span id="backupdir" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.backupfolder")}}</span>
                    <span class="form-control text-truncate" style="width:360px;  font-size: 0.9em; padding-top: 8px; white-space: pre;">{{ backupdir }}</span>
                    <button @click="setBackupdir()" id="backupdirbutton" class="btn btn-info p-0" style="width:40px;" :title="$t('startserver.backupfolderinfo')" >
                        <img src="/src/assets/img/svg/settings.svg" style="vertical-align: sub;" class="" width="18" height="18" >
                    </button>
                </div>

                <button @click="startServer()" :class="(!hostip) ? 'disabledstart':''" id="examstart" class="ps-1 pe-1 mb-3 btn btn-cyan" value="start exam" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.start")}}</button>

                <!-- Lokale Prüfungen Widget-Grid START -->
                <div v-if="previousLocalExams && previousLocalExams.length > 0" class="text-secondary" style="margin-left: 2px; margin-top: 12px;">
                    <span>{{$t("startserver.previousexams")}}</span>
                </div>
                <div v-if="previousLocalExams && previousLocalExams.length > 0" class="bip-widget-grid">
                    <div
                        v-for="exam of previousLocalExams"
                        :key="`local-main-${exam.examName}`"
                        class="bip-exam-card"
                        :class="{ 'bg-cyan-transparent': servername === exam.examName, 'cursornotallowed': exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion }"
                        @click="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? '' : setPreviousExam(exam)"
                        :title="exam.nextexamVersion && exam.nextexamVersion.slice(0, 3) !== version.slice(0, 3) || !exam.nextexamVersion ? $t('startserver.incompatible') : ''"
                    >
                        <!-- Name -->
                        <div class="bip-exam-card-head">
                            <span class="badge text-white flex-shrink-0 bg-cyan">local</span>
                            <div class="bip-exam-name fw-semibold small">{{ exam.examName }}</div>
                            <span v-if="exam.pin" class="badge bg-secondary-subtle text-secondary bip-status-pill">{{ exam.pin }}</span>
                        </div>

                        <!-- Date / Duration -->
                        <div class="bip-exam-info-row text-secondary">
                            <span v-if="exam.examDate">{{ exam.examDate.slice(8,10) }}.{{ exam.examDate.slice(5,7) }}.{{ exam.examDate.slice(0,4) }} {{ exam.examDate.slice(11,16) }}</span>
                            <span class="text-muted" v-if="exam.examDate && exam.examDurationMinutes">·</span>
                            <span v-if="exam.examDurationMinutes">{{ exam.examDurationMinutes }} min</span>
                        </div>

                        <!-- Feature badges -->
                        <div class="bip-feature-badges">
                            <span v-if="exam.examSections && exam.examSections[exam.activeSection]"
                                  class="badge bip-type-badge"
                                  :class="`bip-type-${exam.examSections[exam.activeSection].examtype}`">
                                {{ {math:'Mathematik', editor:'Sprachen', eduvidual:'Eduvidual', website:'Website', activesheets:'Active Sheets', microsoft365:'Microsoft 365'}[exam.examSections[exam.activeSection].examtype] || exam.examSections[exam.activeSection].examtype }}
                            </span>
                            <span v-if="exam.examSections && exam.examSections[exam.activeSection] && exam.examSections[exam.activeSection].groups" class="badge bip-type-sus">A/B</span>
                            <span v-if="exam.screenslocked" class="badge bg-danger-subtle text-danger border border-danger-subtle">gesperrt</span>
                            <span v-if="exam.useExamSections" class="badge bg-secondary">§ {{ exam.activeSection }}/{{ exam.lockedSection }}</span>
                        </div>
                    </div>
                </div>
                <!-- Lokale Prüfungen Widget-Grid END -->
            </div>
            <!-- Prüfung anlegen END -->

            <!-- Bildungsportal START -->
            <div v-if="activeTab === 'bildungsportal'" class="">
            
                <div v-if="!bipToken" class="text-secondary mt-1" style=" margin-left: 2px; margin-bottom: 14px;">
                    <span>{{$t("startserver.bippleaselogin")}}</span>
                </div>
                <div v-if="bipToken" class="text-secondary mt-1" style=" margin-left: 2px; margin-bottom: 14px;">
                    <span>{{$t("startserver.bipwelcome")}} {{bipUsername}}!</span>
                </div>

                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content">
                    <span id="pwd" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.pwd")}}</span>
                    <input v-model="password" :type="showPassword ? 'text' : 'password'" class="form-control" id="examPassword" style="width:200px;">
                    <button @click="togglePasswordVisibility" class="password-visibility-btn" type="button">
                        <img :src="showPassword ? '/src/assets/img/svg/eye-slash-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" class="password-visibility-icon" width="16" height="16">
                    </button>
                </div>

                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content">
                    <span id="backupdir" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.backupfolder")}}</span>
                    <span class="form-control text-truncate" style="width:360px;  font-size: 0.9em; padding-top: 8px; white-space: pre;">{{ backupdir }}</span>
                    <button @click="setBackupdir()" id="backupdirbutton" class="btn btn-info p-0" style="width:40px;" :title="$t('startserver.backupfolderinfo')" >
                        <img src="/src/assets/img/svg/settings.svg" style="vertical-align: sub;" class="" width="18" height="18" >
                    </button>
                </div>

                <button @click="startServer()" :class="(!hostip || !bipToken || !servername) ? 'disabledstart':''" class="ps-1 pe-1 mb-3 btn btn-success" value="start exam" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.start")}}</button>





                <!-- BiP Prüfungen START -->
                <div v-if="bipToken" class="text-secondary " style=" margin-left: 2px; margin-top: 6px;">
                    <span>BiP Prüfungen</span>
                    <button v-if="bipToken" class="btn p-0 white ms-1 mb-1" @click="fetchBipExams" title="Aktualisieren">
                        <img src="/src/assets/img/svg/gtk-convert.svg" width="16" height="16">
                    </button>
                </div>

                <div v-if="onlineExams && onlineExams.length > 0" class="bip-widget-grid">
                    <div
                        v-for="exam of onlineExams"
                        :key="`bip-main-${exam.id}-${exam.examName}`"
                        class="bip-exam-card"
                        :class="{ 'bip-exam-card-active': servername === exam.examName }"
                        @click="setOnlineExam(exam)"
                    >
                        <!-- Name + PIN -->
                        <div class="bip-exam-card-head">
                            <span v-if="exam.requireBiP" class="badge text-white flex-shrink-0 bg-success">BiP</span>
                            <div class="bip-exam-name fw-semibold small">{{ exam.examName }}</div>
                            <span v-if="exam.pin" class="badge bg-secondary-subtle text-secondary bip-status-pill">{{ exam.pin }}</span>
                        </div>

                        <!-- Date / Duration -->
                        <div class="bip-exam-info-row text-secondary">
                            <span v-if="exam.examDate">{{ exam.examDate.slice(8,10) }}.{{ exam.examDate.slice(5,7) }}.{{ exam.examDate.slice(0,4) }} {{ exam.examDate.slice(11,16) }}</span>
                            <span class="text-muted" v-if="exam.examDate && exam.examDurationMinutes">·</span>
                            <span v-if="exam.examDurationMinutes">{{ exam.examDurationMinutes }} min</span>
                        </div>

                        <!-- Feature badges -->
                        <div class="bip-feature-badges">
                            <span v-if="exam.examSections && exam.examSections[exam.activeSection]"
                                  class="badge bip-type-badge"
                                  :class="`bip-type-${exam.examSections[exam.activeSection].examtype}`">
                                {{ {math:'Mathematik', editor:'Sprachen', eduvidual:'Eduvidual', website:'Website', activesheets:'Active Sheets', microsoft365:'Microsoft 365'}[exam.examSections[exam.activeSection].examtype] || exam.examSections[exam.activeSection].examtype }}
                            </span>
                            <span v-if="exam.examSections && exam.examSections[exam.activeSection] && exam.examSections[exam.activeSection].groups" class="badge bip-type-sus">A/B</span>
                            <span v-if="exam.screenslocked" class="badge bg-danger-subtle text-danger border border-danger-subtle">gesperrt</span>
                            <span v-if="exam.useExamSections" class="badge bg-secondary">§ {{ exam.activeSection }}/{{ exam.lockedSection }}</span>
                            <span v-if="exam.examStudents && exam.examStudents.length" class="badge bip-type-sus">{{ exam.examStudents.length }} SuS</span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Bildungsportal END -->

        </div>

        


    </div>
</div>



 <!-- BIB Infos START -->
 <div id="bipinfo">
    <div id="bipcheck" @click="fetchBiPNews();"> <div id="eye" class="darkgreen eyeopen"></div> &nbsp;BiP News</div>
    <div class="bipscrollarea">     
        <div v-if="bipnews.length == 0"  style="text-align: left; font-size: 0.8em; margin-left:10px;"> {{ $t('startserver.noNews') }}</div> 
        <div v-for="entry in bipnews" :key="entry.id" class="bipentry">
            <div class="color-circle" style="width: 10px; height: 10px;"></div>
            <div class="subject">{{ entry.subject }} </div>
            <div class="message" v-if="entry.message" v-external-links v-html="entry.message"></div>
            <div class="created">
                <div style=" padding-top:1px; display:inline-block;">{{ formatUnixDate(entry.timecreated) }} | {{ entry.author.fullname }}</div> <img :src="entry.author.urls.profileimage" style="float:right; width: 20px; height: 20px; border-radius: 50%;">
            </div> 
        </div> 
    </div>
</div>
<!-- BIB Infos END -->

</div>
</template>



<script lang="ts">
import log from 'electron-log/renderer';
import {SchedulerService} from '../utils/schedulerservice.js'
import {Exam} from "../types/api";


// Erfassen von unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  log.error('Unhandled promise rejection:', event.reason); // Loggen des Fehlers
});

Object.assign(console, log.functions);





export default {
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            config: this.$route.params.config,  //achtung: config enthält rekursive elemente und wird daher in ipchandler.copyConfig() kopiert
            buildDate: this.$route.params.config.buildDate,
            title: document.title,
            servername : this.$route.params.config.development ? "5a-mathematik":"",
            password: "",   //we use this password to allow students to manually leave exam mode 
            prod : false,
            serverApiPort: this.$route.params.serverApiPort,
            electron: this.$route.params.electron,
            hostname: window.location.hostname,
            hostip: this.$route.params.config.hostip,
            advanced: false,
            showPassword: false,
            workdir: this.$route.params.config.workdirectory,
            backupdir: '',
            freeDiscspace: 100,
            previousExams: [],
            onlineExams: [] as Exam[],
            biptest:true,   //switches between production and q
            selectedExam: null,

            bipToken:this.$route.params.bipToken === 'false' || !this.$route.params.bipToken ?  false : this.$route.params.bipToken,   // parameter werden immer als string "false" übergeben, convert to bool
            bipuserID: this.$route.params.bipuserID === 'false' || !this.$route.params.bipuserID ?  false : this.$route.params.bipuserID,
            bipUsername:this.$route.params.bipUsername === 'false' || !this.$route.params.bipUsername ?  false : this.$route.params.bipUsername,


            bipnews: [],
            BipInfoActive: false,
            activeTab: 'pruefung'
        };
    },
    components: {},
    directives: {
        // Diese Direktive sucht alle <a>-Tags in dem Element und fügt target="_blank" hinzu. (zb. für Digi4school Schulbücher die ausschliesslich in einem Popup angezeigt werden sollen)
        externalLinks: {
            mounted(el) {
                // Wird beim ersten Rendern ausgeführt (in Vue 3 ist "mounted" anstelle von "inserted")
                const links = el.querySelectorAll("a");
                links.forEach(link => {
                    link.setAttribute("target", "_blank");
                    link.setAttribute("rel", "noopener noreferrer");
                });

            },
            updated(el) {
                // Wird auch bei Aktualisierungen des Inhalts ausgeführt
                const links = el.querySelectorAll("a");
                links.forEach(link => {
                    link.setAttribute("target", "_blank");
                    link.setAttribute("rel", "noopener noreferrer");
                });
            }
        }
    },
    computed: {
        inactivelocale() { // Zeigt aktuellen Sprachcode
             return this.$i18n.locale === 'de' ? 'en' : 'de';
        },
        previousLocalExams() {
            return (this.previousExams || []).filter(exam => !exam?.bip);
        },
        previousBipExams() {
            return (this.previousExams || []).filter(exam => !!exam?.bip);
        }
    },

    methods: {
        formatUnixDate(value) {
            if (!value) return "";
            // Falls der Unix-Timestamp in Sekunden vorliegt (typischerweise 10-stellig), multiplizieren wir ihn mit 1000.
            let timestamp = Number(value);
            if (timestamp < 10000000000) {
                timestamp *= 1000;
            }
            const date = new Date(timestamp);
            const day = date.getDate().toString().padStart(2, "0");
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        },


        toggleLocale() {
            // Umschalte zwischen 'de' und 'en'
            this.$i18n.locale = this.$i18n.locale === 'de' ? 'en' : 'de';
        },

        loginBiP(){
            //console.log("loginBiP", this.config)
            /*if (this.config.bipDemo){   // skip bip logon and fake bip info
                // fake bip info
                this.bipUsername = "Katherine Johnson"
                this.bipuserID = 6
                this.bipToken = btoa("Token:fddc0086a4db83e57f44fa40504452ad")
                
                this.fetchBipExams()
                return  //skip real login
            }*/

            let IPCresponse = ipcRenderer.sendSync('loginBiP', this.biptest)
            console.log(IPCresponse)
        },

        logoutBiP(){
            this.$swal({
                title: this.$t("dashboard.bildungsportal"),
                text:  this.$t("dashboard.logoutBiP"),
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("dashboard.cancel"),
                focusConfirm: false,
                icon: 'question',
            }).then((result) => {
                if (result.isConfirmed) {
                    this.bipToken = false
                    this.bipUsername = false
                    this.bipuserID = false
                    this.bipData = null
                    this.onlineExams = []
                } 
            });
        },

        getBiPUrl(): string {
            if (this.config.bipDemo) {
                return this.config.bipApiUrl;
            } else if (this.biptest) {
                return `https://q.bildung.gv.at`;
            } else {
                return `https://bildung.gv.at`;
            }
        },

        /**
         * holt userdaten sobald das login token erhalten wurde
         * @param base64String contains 2 base64 encoded tokens
         */
        fetchBiPData(base64String){
            let token = this.decodeBase64AndExtractTokens(base64String)?.[1];
            if (!token) {
                throw Error("cannot fetch from bip api without valid token")
            }

            const url = this.getBiPUrl() + '/webservice/rest/server.php?wstoken=' + token + '&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json';

            fetch(url, { method: 'POST'})
            .then( res => res.json() )
            .then( response => {
                if (response.fullname){
                    this.$swal.fire({
                        title: "BiP Response",
                        text: "Verbindung hergestellt",
                        icon: 'info',
                        showCancelButton: false,
                    })

                    this.bipUsername = response.fullname
                    this.bipuserID = response.userid

                    const loginBtn = document.querySelector("#biploginbutton")
                    const bipLogo = document.querySelector("#biplogo")
                    if (loginBtn) {
                        loginBtn.classList.remove('btn-info')
                        loginBtn.classList.add('btn-success')
                        loginBtn.classList.add("disabledbutton")
                    }
                    if (bipLogo) {
                        bipLogo.style.filter = "hue-rotate(140deg)"
                    }


                    this.fetchBipExams()
                }
                else {
                    this.$swal.fire({
                        title: "BiP Response",
                        text: "Verbindung konnte nicht hergestellt werden",
                        icon: 'info',
                        showCancelButton: false,
                    })

                }
            })
            .catch(err => { console.warn(err) })
        },

        /**
         * lädt vorkonfigurierte exams vom bildungsportal via bip/api
         */
        fetchBipExams(){
            let token = this.decodeBase64AndExtractTokens(this.bipToken)?.[1];
            if (!token) {
                // No valid token -> silently skip to avoid unhandled click errors
                return;
            }
            
            const url = this.getBiPUrl() + '/webservice/rest/server.php?wstoken=' + token + '&wsfunction=local_dpu_get_exams_teacher&moodlewsrestformat=json';

            fetch(url, { method: "GET" })
            .then(response => { return response.json(); } )                  
            .then(data => {
                //console.log("Daten von der API:", data);
                this.bipData = data   // store all of the information in data
                this.onlineExams = data.exams;
            })
            .catch(error => { console.error("Fehler beim API-Aufruf:", error);});
        },


        async setOnlineExam(exam){
            this.servername = exam.examName

            this.selectedExam = { ...exam, bip: true }  // mark as bip exam for consistent tab-based start logic

            // save the selected exam information to local serverstatus.json / create local exam folder
            this.bipData.exams.forEach(bipexam =>{
                if (bipexam.examName === exam.examName){
                    ipcRenderer.invoke('createBipExamdirectory', bipexam)
                }
            }) 

            // keep button state consistent with "Lokale Prüfung" tab
            await this.checkExistingExam()
        },



        fetchBiPNews(){
            let token = "6ca93a5f05a4d08a6c85fbeba707cc45"
            let forumid = 4
            let cmid = 40
            let groupid = 10
            let url = `https://www.bildung.gv.at/webservice/rest/server.php?wstoken=${token}&wsfunction=mod_forum_get_forum_discussions&moodlewsrestformat=json&forumid=${forumid}&groupid=${groupid}`

            //get moodle information about the forum with the given cmid (id on website) to get the actual forumid for the api call
            //let url = `https://www.bildung.gv.at/webservice/rest/server.php?wstoken=${token}&wsfunction=core_course_get_course_module&moodlewsrestformat=json&cmid=${cmid}`

            // First get all discussions from the forum
            fetch(url, { method: 'POST'})
            .then(res => res.json())
            .then(discussionsResponse => {
                if (discussionsResponse.discussions && discussionsResponse.discussions.length > 0) {
                    // Initialize empty array for all posts
                    let allPosts = [];
                    
                    // Process each discussion one by one
                    let processedDiscussions = 0;

                    discussionsResponse.discussions.forEach(discussion => {
                        let discussionid = discussion.discussion; // Use discussion.discussion instead of discussion.id
                        let url1 = `https://www.bildung.gv.at/webservice/rest/server.php?wstoken=${token}&wsfunction=mod_forum_get_discussion_posts&moodlewsrestformat=json&discussionid=${discussionid}`;
                        
                        fetch(url1, { method: 'POST'})
                        .then(res => res.json())
                        .then(response => {
                            if (response.posts && response.posts.length > 0) {
                                // Add all posts from this discussion to our array
                                allPosts = allPosts.concat(response.posts);
                            }
                            
                            processedDiscussions++;
                            
                            // When all discussions are processed, update bipnews
                            if (processedDiscussions === discussionsResponse.discussions.length) {
                                this.bipnews = allPosts;
                                
                                // Toggle UI visibility
                                let bipdiv = document.getElementById(`bipinfo`)    // the div is not existant if lt is disabled
                                let eye = document.getElementById('eye')               // the div is not existant if lt is disabled

                                if (this.BipInfoActive){
                                    if (bipdiv && bipdiv.style.right == "0px"){
                                        bipdiv.style.right = "-482px";
                                        bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0)";
                                    }
                                    eye.classList.add('eyeopen');
                                    eye.classList.add('darkgreen');
                                    eye.classList.remove('eyeclose');
                                    eye.classList.remove('darkred');
                                    this.BipInfoActive = false; 
                                }
                                else {
                                    bipdiv.style.right = "0px"
                                    bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0.2)"; 
                                    eye.classList.remove('eyeopen');
                                    eye.classList.remove('darkgreen');
                                    eye.classList.add('eyeclose');
                                    eye.classList.add('darkred');
                                    this.BipInfoActive = true;
                                }
                            }
                        })
                        .catch(err => { 
                            console.warn(`Error fetching posts for discussion ${discussionid}:`, err);
                            processedDiscussions++;
                            
                            // Still check if all discussions are processed
                            if (processedDiscussions === discussionsResponse.discussions.length) {
                                this.bipnews = allPosts;
                                
                                // Toggle UI visibility
                                let bipdiv = document.getElementById(`bipinfo`)
                                let eye = document.getElementById('eye')

                                if (this.BipInfoActive){
                                    if (bipdiv && bipdiv.style.right == "0px"){
                                        bipdiv.style.right = "-482px";
                                        bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0)";
                                    }
                                    eye.classList.add('eyeopen');
                                    eye.classList.add('darkgreen');
                                    eye.classList.remove('eyeclose');
                                    eye.classList.remove('darkred');
                                    this.BipInfoActive = false; 
                                }
                                else {
                                    bipdiv.style.right = "0px"
                                    bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0.2)"; 
                                    eye.classList.remove('eyeopen');
                                    eye.classList.remove('darkgreen');
                                    eye.classList.add('eyeclose');
                                    eye.classList.add('darkred');
                                    this.BipInfoActive = true;
                                }
                            }
                        });
                    });
                } else {
                    this.bipnews = [];
                    
                    // Toggle UI visibility
                    let bipdiv = document.getElementById(`bipinfo`)
                    let eye = document.getElementById('eye')

                    if (this.BipInfoActive){
                        if (bipdiv && bipdiv.style.right == "0px"){
                            bipdiv.style.right = "-482px";
                            bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0)";
                        }
                        eye.classList.add('eyeopen');
                        eye.classList.add('darkgreen');
                        eye.classList.remove('eyeclose');
                        eye.classList.remove('darkred');
                        this.BipInfoActive = false; 
                    }
                    else {
                        bipdiv.style.right = "0px"
                        bipdiv.style.boxShadow = "-2px 1px 2px rgba(0,0,0,0.2)"; 
                        eye.classList.remove('eyeopen');
                        eye.classList.remove('darkgreen');
                        eye.classList.add('eyeclose');
                        eye.classList.add('darkred');
                        this.BipInfoActive = true;
                    }
                }
            })
            .catch(err => { console.warn(err) })
        },




        // Überprüfen, ob der String Base64-codiert ist
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },

        // Base64-String dekodieren und mögliche Tokens extrahieren
        decodeBase64AndExtractTokens(base64Str) {
            if (base64Str == null || !this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // Trennzeichen anpassen, falls nötig
            return tokens;
        },

        easter(){
            if (this.biptest){
                this.biptest = false
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
            } 
            else { 
                this.biptest = true
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
            }
            console.log("biptest:", this.biptest)
        },

        async fetchInfo() {
            this.hostip = ipcRenderer.sendSync('checkhostip')
            if (this.hostip && this.hostip.availableInterfaces.length > 1 && !this.hostip.preferredInterface){
                this.selectPreferredInterface()
            }
        },

        async selectPreferredInterface(){
          
                if (this.activeDialog) return;
                //first block dialog to prevent multiple dialogs 
                this.activeDialog = true

                //ask user to select a preferred interface
                this.$swal.fire({
                    customClass: {
                        popup: 'my-popup',
                        title: 'my-title',
                        content: 'my-content',
                        input: 'my-custom-input',
                        inputLabel: 'my-input-label',
                        actions: 'my-swal2-actions'
                    },
                    title: this.$t("startserver.selectinterface"),
                    html: "<div class='my-content'>" + this.$t("startserver.selectinterfaceinfo") + "<br><br>" + 
                          this.hostip.availableInterfaces.map(netInterface => 
                            `<div style="margin: 5px 0; padding: 5px; background-color: #f8f9fa; border-radius: 3px;">
                                <strong>${netInterface.name}</strong>: ${netInterface.address}
                            </div>`
                          ).join('') + "</div>",
                    showCancelButton: true,
                    cancelButtonText: this.$t("dashboard.cancel"),
                    input: "select",
                    inputOptions: this.hostip.availableInterfaces.reduce((acc, curr) => {
                        acc[curr.name] = curr.name;
                        return acc;
                    }, {}),
                    inputPlaceholder: "",
                }).then((result) => {
                    if (result.isConfirmed) {
                        ipcRenderer.invoke('setPreferredInterface', result.value);
                        this.activeDialog = false;
                    }
                });
            
        },



        // by unsetting the preferred interface, the system will automatically show the dialog again to select a new preferred interface
        reconfigurePreferredInterface(){
            this.activeDialog = false;
            this.selectPreferredInterface()
            
        },




        async checkDiscspace(){   // achtung: custom workdir spreizt sich mit der idee die teacher instanz als reine webversion laufen zulassen - wontfix?
           this.freeDiscspace = await ipcRenderer.invoke('checkDiscspace')
        },

        async getPreviousExams(){
            // get previously created exams from workdir
            let previousExams = await ipcRenderer.invoke('scanWorkdir')

            // filter out exams that are not compatible with the current version
           // previousExams = previousExams.filter(exam => exam.nextexamVersion === this.version)

            this.previousExams = previousExams
           // console.log("previousExams:", this.previousExams)


            this.config = await ipcRenderer.invoke('getconfigasync') 
            this.workdir = this.config.workdirectory   // just in case this is already altered in the backend make sure to display current settings
            this.backupdir = this.config.backupdirectory || ''
        },


        /**  setzt das feld prüfungsname auf den namen des angeklickten prüfungsverzeichnisses */
        async setPreviousExam(exam){
            this.servername = exam.examName
            this.selectedExam = exam

            this.checkExistingExam()  //ändert den text am startbutton
        },


        /** überprüft ob die ausgewählte prüfung bereits existiert und ändert den text am startbutton */
        async checkExistingExam(){
            for (let i = 0; i < this.previousExams.length; i++) {
                const previousExam = this.previousExams[i] // current exam object
                if (previousExam.examName === this.servername) {
                    this.password = ""
                    this.advanced = false
                    this.backupdir = previousExam.backupdirectory || ''
                    let hasExamPassword = typeof previousExam.examPassword === 'string' && previousExam.examPassword.trim() !== ''

                    if (hasExamPassword) {
                        // make password field visible to signal the user that a password is set   
                        this.password = previousExam.examPassword
                        this.advanced = true
                        await this.$nextTick();

                    }
                    const examstart = document.getElementById('examstart')
                    if (examstart) examstart.innerHTML = this.$t("startserver.resume")
                    let examPasswordDiv = document.getElementById('examPassword')
               
                    if (examPasswordDiv){
                        examPasswordDiv.disabled = hasExamPassword  // lock only if a real password is set
                    }
                    break
                } 
                else {
                    this.backupdir = ''
                    const examstart = document.getElementById('examstart')
                    if (examstart) examstart.innerHTML = this.$t("startserver.start")

                    let examPasswordDiv = document.getElementById('examPassword')
                    if (examPasswordDiv){
                        examPasswordDiv.disabled = false  // unlock password input field if no existing exam is found
                    }
                }
            }        
        },

        /** löscht die ausgewählte prüfung */
        delPreviousExam(name){
            // ASK for confirmation!
            this.$swal.fire({
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    input: 'my-custom-input',
                    inputLabel: 'my-input-label',
                    actions: 'my-swal2-actions'
                },
                title: this.$t("startserver.previousexams"),
                html: `<div class="my-content">${this.$t("startserver.folderdelete")} <br> <br> <span style="font-weight:bold; text-align:left;">${name}</span></div>`,
                icon: "warning",
                showCancelButton: true,
                cancelButtonText: this.$t("dashboard.cancel"),
              
            })
            .then(async (result) => {
                if (result.isConfirmed) { 
                    let response = await ipcRenderer.invoke('delPrevious', name)
                    console.log(response)
                    this.getPreviousExams()
                } 
            });  
        },


        async setBackupdir(){
            let response = await ipcRenderer.invoke('setbackupdir')
            this.backupdir = response.backupdir
            this.config.backupdirectory = response.backupdir

            if (response.message == "error"){
                this.status(this.$t("startserver.directoryerror"))
            }
        },

        toggleAdvanced(){
            if (!this.advanced){
                this.password = ""
                this.showPassword = false
            }
        },

        togglePasswordVisibility(){
            this.showPassword = !this.showPassword
        },

        async startServer(){
            if (this.servername === "" ){
                this.status(this.$t("startserver.emptyname")); 
            }
            // else if (this.password === ""){
            //     this.status(this.$t("startserver.emptypw")); 
            // }
            else {
                let isBip = this.selectedExam && this.selectedExam.bip && this.servername === this.selectedExam.examName ? true : false
                let bipId = this.selectedExam && this.selectedExam.id ? this.selectedExam.id : null

                // Enforce tab separation: local exams only in local tab, bip exams only in bip tab
                if (isBip && this.activeTab !== 'bildungsportal') { this.status("BiP-Prüfungen können nur im Tab Bildungsportal gestartet werden."); return; }
                if (!isBip && this.activeTab === 'bildungsportal') { this.status("Lokale Prüfungen können nur im Tab Lokale Prüfung gestartet werden."); return; }

                if (isBip && !this.bipToken){
                    this.status(this.$t("startserver.bipnotloggedin")); 
                    return;
                }
                
                // check if the servername equals a previous exam
                if (this.previousExams.some(exam => exam.examName === this.servername)){
                    this.selectedExam = this.previousExams.find(exam => exam.examName === this.servername)
                }
                else {
                    this.selectedExam = null
                }
           

                // check if the exam is compatible with the current version
                if (this.selectedExam && this.selectedExam.nextexamVersion && this.selectedExam.nextexamVersion.slice(0, 3) !== this.version.slice(0, 3) || (this.selectedExam && !this.selectedExam.nextexamVersion)){
                    this.status(this.$t("startserver.incompatible")); 
                    return;
                }

                let payload = {
                    bip: isBip,
                    bipId: bipId
                }

                fetch(`https://${this.hostname}:${this.serverApiPort}/server/control/start/${this.servername.toLowerCase()}/${this.password}`, { 
                    method: 'POST',
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then( res => res.json())
                .then( async response => { 
                   
                    if (response.status === "success") {  //directly log in
                        this.status(response.message);
                        await this.sleep(1000);
                      
                        this.$router.push({  // for some reason this doesn't work on mobile
                            name: 'dashboard', 
                            params:{
                                servername: this.servername.toLowerCase(), 
                                passwd: this.password,
                                bipToken: this.bipToken,
                                bipUsername: this.bipUsername,
                                bipuserID:this.bipuserID,
                                biptest: this.biptest
                            }
                        })
                        
                    }
                    else { 
                        this.status(response.message); 
                    }
                })
                .catch(err => { this.status(err); console.warn(err) })
            } 
        },
        showCopyleft(){
            this.$swal.fire({     
                customClass: {
                    'icon': 'custom-swal2-icon'
              
                },
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle;cursor: pointer;'>&copy;</span> <span style='font-size:0.8em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
                <a href="https://www.bmbwf.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMB_Logo_srgb.png"></a>
                <br>
                <br>
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a>   <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at" target="_blank">next-exam.at</a> </span> <br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span> <br>
                <span style="font-size:0.8em">Build: ${this.buildDate}</span>
                `,
                didRender: () => {
                    document.getElementById('cpleft').onclick = () => this.easter();
                }
            })
        },
        //show status message
        async status(text){  
            const statusDiv = document.querySelector("#statusdiv");
            statusDiv.textContent = text;
            statusDiv.style.visibility = "visible";
            this.fadeIn(statusDiv);
            await this.sleep(2000);
            this.fadeOut(statusDiv)
        },

        // implementing a sleep (wait) function
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        handleKeyupEvent(e) {
            this.servername = document.getElementById('servername').value;
            this.checkExistingExam();
        },
        validateInput(e) {
            var lettersOnly = /^[a-zA-Z0-9-_]+$/;
            var key = e.key || String.fromCharCode(e.which);
            if (!lettersOnly.test(key)) {
                e.preventDefault();
            }
        },
        // Function to add fade-in effect
        fadeIn(element) {
            element.classList.add('fade-in');
            element.classList.remove('fade-out');
        },

        // Function to add fade-out effect
        fadeOut(element) {
            element.classList.add('fade-out');
            element.classList.remove('fade-in');
        }


    },
    async mounted() {  // when ready
        log.info('startserver @ mounted: next-exam ready!');
        document.querySelector("#statusdiv").style.visibility = "hidden";  //do not show on first mount of ui
        

        if (this.prod) {  //clear input fields in production mode
            document.querySelector("#servername").value = "";
            document.querySelector("#pin").value = "";
            document.querySelector("#password").value = "";
        }
      
        this.hostname = "localhost"
        this.checkDiscspace()
        await this.getPreviousExams()
        this.checkExistingExam()

        ipcRenderer.on('bipToken', (event, token) => {  
            console.log("token received: ",token)
            this.bipToken = token
            this.fetchBiPData(token)
        });



        // intervalle nicht mit setInterval() da dies sämtliche objekte der callbacks inklusive fetch() antworten im speicher behält bis das interval gestoppt wird
        this.fetchinterval = new SchedulerService(4000);
        this.fetchinterval.addEventListener('action',  this.fetchInfo);  // Event-Listener hinzufügen, der auf das 'action'-Event reagiert (reagiert nur auf 'action' von dieser instanz und interferiert nicht)
        this.fetchinterval.start(); 


        if (this.bipToken !== false){ 
            this.fetchBipExams();
            //console.log(this.bipToken) 
        }


        // set the locale to the system locale
        const systemLocale = navigator.language.split('-')[0] // z.B. "de" aus "de-DE"
        const locale = ['de', 'en'].includes(systemLocale) ? systemLocale : 'en' // Fallback zu 'en'
        this.$i18n.locale = locale
        //console.log("locale:", systemLocale, locale)

        // add event listener to exam input field to suppress all special chars
        const servernameEl = document.getElementById("servername");
        if (servernameEl) {
            servernameEl.addEventListener("keypress", this.validateInput);
            servernameEl.addEventListener("keyup", this.handleKeyupEvent);
        }
    },
    beforeUnmount() {
        const servernameEl = document.getElementById("servername");
        if (servernameEl) {
            // should be safe for SPA unmount when element might already be gone
            servernameEl.removeEventListener("keyup",  this.handleKeyupEvent);
            servernameEl.removeEventListener("keypress",  this.validateInput);
        }
    },
}
</script>



<style>
.active {
    filter: contrast(100%) grayscale(100%) brightness(80%) !important;
}
.inactive {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px) !important;
}

</style>



<style scoped>

.disabledbutton {
    pointer-events: none; 
}

.disabledstart {
    filter: contrast(100%) grayscale(60%) brightness(130%) blur(0.6px);
    pointer-events: none; 
}



.cursornotallowed {
    cursor: not-allowed !important;
   
}

#statusdiv {
    display: block !important;
    width: 200px;
}

/* minimal scrollbar: thumb only, no track, no arrows */
#sidebar-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
#sidebar-scroll::-webkit-scrollbar {
    width: 8px;
}
#sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
}
#sidebar-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 4px;
}
#sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
}
#sidebar-scroll::-webkit-scrollbar-button {
    display: none;
}

#content {
    background-color: whitesmoke;
    min-width: 680px;
}



.bip-widget-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.37rem;
}

.bip-exam-card {
    width: 300px;
    background: #f8f9fa;
    border: 1px solid #198754;
    border-left: 1px solid #198754;
    border-radius: 5px;
    padding: 7px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.bip-exam-card:hover {
    border-color: var
}

.bip-exam-card-active {
    background: #d1e7dd;
    /* box-shadow: 0 2px 8px rgba(25, 135, 84, 0.25); */
}


.bip-exam-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}

.bip-exam-name {
    line-height: 1.3;
    word-break: break-word;
    text-align: left;
    margin-right: auto; /* keep the PIN badge on the right */
}

.bip-status-pill {
    flex-shrink: 0;
    letter-spacing: 0.03em;
    text-transform: uppercase;
}

.bip-exam-info-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    margin-bottom: 5px;
    font-size: 0.77em;
}

.bip-feature-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
}

.bip-feature-badges .badge,
.bip-exam-card-head .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* exam type badges — all same neutral gray */
.bip-type-math,
.bip-type-editor,
.bip-type-eduvidual,
.bip-type-website,
.bip-type-activesheets,
.bip-type-microsoft365,
.bip-type-sus          { background: #e9ecef; color: #343a40; border: 1px solid #dee2e6; }

.infobutton{
    width: 221px;
    min-width: 221px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: whitesmoke;
}

.warning {
    margin-top: 10px;
    border-radius: 3px;
    padding: 2px;
    text-align: center;
    font-size: 0.8em;
    color: #fff;
    background-color:  #dc3545c7;
}

#previous .printercheck {
    margin-left:4px;
    margin-top: 4px;
    filter: saturate(100%) hue-rotate(90deg) ;
}

/* CSS classes for fade-in and fade-out */
.fade-in {
    animation: fadeInAnimation 2s;
}
.fade-out {
    animation: fadeOutAnimation 2s forwards; /* 'forwards' keeps the final state after the animation */
}
@keyframes fadeInAnimation {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes fadeOutAnimation {
    from { opacity: 1; }
    to { opacity: 0; visibility: hidden; }
}


.nobutton {
   pointer-events: none;
}



#bipinfo {
    position: fixed;
    z-index: 100; 
    width: 480px;
    height: 100%;
    right: -482px;
    top: 65px;
    background-color: var(--bs-gray-100);
    box-shadow: -2px 1px 2px rgba(0, 0, 0, 0);
    transition: 0.3s;
    padding: 6px;
    padding-bottom: 100px;
}

#bipcheck {
    position: absolute;
    margin-left: -6px;
    margin-top: 58px;
    padding: 10px;
    background-color: var(--bs-gray-100);
    box-shadow: 1px 2px 2px rgba(0,0,0,0.2);
    
    width: 126px;
    height: 44px;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    cursor: pointer;
    color:#616161;
    transition: all 0.3s ease;
    transform: rotate(90deg); 
    transform-origin: top left; 
}
#bipcheck:hover{
    background-color: var(--bs-gray-200);

    height: 52px;
   
    box-shadow: 1px 2px 4px rgba(0,0,0,0.3);
    padding-top: 16px;

}
#bipcheck img{
    vertical-align: bottom;

}
#bipcheck #eye {
    width: 20px;
    height: 20px;
    background-size: cover;
    display:inline-block;
    vertical-align: text-bottom;
}

#bipcheck .eyeopen {
    background-image: url('/src/assets/img/svg/eye-fill.svg');
}
#bipcheck .eyeclose {
    background-image: url('/src/assets/img/svg/eye-slash-fill.svg');
}


#bipinfo .bipscrollarea {
    height: calc(100vh - 52px);
    width: 468px;
    overflow-x: hidden;
    overflow-y: auto;
    position: absolute;
    top: 0px;
    padding-top: 20px;
    padding-bottom: 20px;
}

#bipinfo .color-circle {
  height: 10px;
  width: 10px;
  border-radius: 50%;
  display: inline-block;
  background-color: #0dcaf0;
  margin-left:-5px;
}

.darkgreen {
    filter: invert(36%) sepia(100%) saturate(2200%) hue-rotate(95deg) brightness(75%);
}
.darkred {
    filter: invert(28%) sepia(99%) saturate(7476%) hue-rotate(345deg) brightness(65%);

}
#bipinfo .bipentry {
    margin: 14px;
    padding: 10px;
    border-radius: 8px;
    background-color:   rgba(238, 238, 250, 0.37);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 0.8em;
    cursor: pointer;
}

#bipinfo .bipentry:hover {
  background-color:   rgba(238, 238, 250, 0.508);
}

.darkgreen {
    filter: invert(36%) sepia(100%) saturate(2200%) hue-rotate(95deg) brightness(75%);
}
.darkred {
    filter: invert(28%) sepia(99%) saturate(7476%) hue-rotate(345deg) brightness(65%);

}
#bipinfo .subject {
  padding: 5px;
  border: none;
  background-color: transparent;
  color: var(--bs-info-text-emphasis);
  font-size: 1.1em;
  display: inline-block;
 
}

#bipinfo .message {
    padding:  0px 10px 0px 10px;
    border-radius: 0px;
}
#bipinfo .created {
    padding: 2px;
    padding-left: 0px;
    margin:10px;
    margin-top: 4px;
    border-top: 1px solid var(--bs-cyan);
    color: var(--bs-green);
    border-radius: 0px;
}

.custom-swal2-icon {
    margin: 3em auto 1em auto !important
}

.password-visibility-btn {
    width: 40px;
    border: 0;
    background: transparent;
    box-shadow: none;
    padding: 0;
}

.password-visibility-btn:focus,
.password-visibility-btn:active {
    border: 0;
    outline: 0;
    box-shadow: none;
}

.password-visibility-icon {
    opacity: 0.55;
}


</style>
