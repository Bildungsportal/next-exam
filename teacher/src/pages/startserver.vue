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
        <div class="btn btn-light ms-1 text-start infobutton" @click="activeTab = 'pruefung'; selectedExam = null; servername = ''; password = ''; passwordConfirm = ''; advanced = false; checkExistingExam();" :style="activeTab !== 'pruefung' ? 'border-right: 2px solid #aaa; box-shadow: -6px -3px 10px -12px inset #000; color: #666;' : ''">
            <img src='/src/assets/img/svg/server.svg' class="me-2"  width="16" height="16" :style="activeTab !== 'pruefung' ? 'opacity: 0.5;' : ''">
            {{$t("general.startserver")}}
        </div>
        <div v-if="config.bipIntegration" class="btn btn-light ms-1 mt-1 text-start infobutton" @click="activeTab = 'bildungsportal'; selectedExam = null; servername = ''; password = ''; passwordConfirm = ''; advanced = false; checkExistingExam();" :style="activeTab !== 'bildungsportal' ? 'border-right: 2px solid #aaa; box-shadow: -6px 0px 10px -12px inset #000; color: #666;' : ''">
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
            <div v-else title="login" id="biploginbutton" @click="loginBiP()" class="btn btn-success m-1" style="padding:0px;">
                <img id="biplogo" style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; " src="/src/assets/img/login_students.jpg">
                <span style="padding:2px; font-size:0.9em;"  id="biploginbuttonlabel">Login</span>
            </div>
        </div>
        <!-- BIP Section END -->
        </div>
        
        <div id="sidebar-bottom" class="flex-shrink-0 mt-auto position-relative">
            <button class="btn btn-outline-secondary btn-sm ms-1 mt-2 mb-1" @click="toggleLocale">{{ inactivelocale }}</button>
        </div>
    </div>

    <!-- maincontent -->
    <div id="content" class="fadeinslow p-3 d-flex flex-column flex-grow-1" style="min-height: 0;">
        <div class="col8 d-flex flex-column flex-grow-1" style="min-height: 0;">

            <!-- Create exam START -->
            <div v-if="activeTab === 'pruefung'" class="d-flex flex-column flex-grow-1" style="min-height: 0;">
                <div class="flex-shrink-0">
                <div class="input-group mb-1 mt-0 examname-input-row">
                    <span class="input-group-text col-2 grayback" id="inputGroup-sizing-lg" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.examname")}}</span>
                    <input v-model="servername" @paste="onServernamePasteOrDrop" @drop="onServernamePasteOrDrop" @dragover.prevent @click="servername = ''; checkExistingExam()" maxlength="20" type="text" class="form-control" id="servername" placeholder="5a-mathematik" style="width:200px;max-width:200px;min-width:135px;">
                    <Transition name="servername-charset-hint">
                        <span v-if="showServernameCharsetHint" class="servername-charset-hint ms-2 align-self-center">{{ $t("startserver.examnameCharsetHint") }}</span>
                    </Transition>
                    <span v-if="bipNameConflict" class="text-warning ms-2 align-self-center text-nowrap text-truncate examname-bip-conflict-hint">⚠ {{$t("startserver.bipNameConflictShort")}}</span>
                </div>

                <!-- could be used to set an ESCAPE PASSWORD for students to make it harder to leave on connection loss -->
                <template v-if="advanced">
                <div class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.pwdinfo'))" @mouseout="hideDescription">
                    <span id="pwd" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.pwd")}}</span>
                    <input v-model="password" :type="showPassword ? 'text' : 'password'" class="form-control" id="examPassword" style="width:200px;">
                    <button @click="togglePasswordVisibility" class="password-visibility-btn" type="button">
                        <img :src="showPassword ? '/src/assets/img/svg/eye-slash-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" class="password-visibility-icon" width="16" height="16">
                    </button>
                </div>
                <div class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.pwdinfo'))" @mouseout="hideDescription">
                    <span class="input-group-text col-2 grayback" style="width:170px;">{{$t("startserver.pwdconfirm")}}</span>
                    <input v-model="passwordConfirm" :type="showPassword ? 'text' : 'password'" class="form-control" :class="passwordMismatch ? 'is-invalid' : (passwordConfirm !== '' ? 'is-valid' : '')" style="width:200px;">
                    <span v-if="passwordMismatch" class="text-danger ms-2 align-self-center" style="font-size:0.8em;">⚠ {{$t("startserver.pwdmismatch")}}</span>
                </div>
                </template>

                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.backupfolderinfo'))" @mouseout="hideDescription">
                    <span id="backupdir" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.backupfolder")}}</span>
                    <span class="form-control text-truncate" style="width:360px;  font-size: 0.9em; padding-top: 8px; white-space: pre;">{{ backupdir }}</span>
                    <button @click="setBackupdir()" id="backupdirbutton" class="btn btn-cyan p-0" style="width:40px;" :title="$t('startserver.backupfolderinfo')" >
                        <img src="/src/assets/img/svg/settings.svg" style="vertical-align: sub;" class="snowwhite" width="18" height="18" >
                    </button>
                </div>

                <button @click="startServer()" :class="(!hostip || (advanced && (!password || !passwordConfirm || passwordMismatch))) ? 'disabledstart':''" id="examstart" class="ps-1 pe-1 mb-3 btn btn-cyan" value="start exam" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.start")}}</button>
                </div><!-- /flex-shrink-0 -->

                <!-- Local exams widget grid START -->
                <div class="flex-grow-1 exam-list-scroll">
                <div v-if="previousLocalExams && previousLocalExams.length > 0" class="text-secondary" style="margin-left: 2px; margin-top: 12px;">
                    <span>{{$t("startserver.previousexams")}}</span>
                </div>
                <div v-if="previousLocalExams && previousLocalExams.length > 0" class="bip-widget-grid">
                    <div
                        v-for="exam of previousLocalExams"
                        :key="`local-main-${exam.examName}`"
                        class="bip-exam-card bip-exam-card-local"
                        :class="{ 'bg-cyan-transparent': servername === exam.examName, 'cursornotallowed': !isExamVersionCompatible(exam) }"
                        @click="isExamVersionCompatible(exam) ? setPreviousExam(exam) : ''"
                        :title="!isExamVersionCompatible(exam) ? $t('startserver.incompatible') : ''"
                    >
                        <!-- Name -->
                        <div class="bip-exam-card-head">
                            <span class="badge text-white flex-shrink-0 bg-cyan">local</span>
                            <div class="bip-exam-name fw-semibold small">{{ exam.examName }}</div>
                            <button @click.stop="delPreviousExam(exam.examName)" class="btn btn-sm btn-warning p-0 ms-auto" style="width:18px; height:18px; font-size:0.7em; line-height:1;">✕</button>
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
                            <span v-if="exam.useExamSections" class="badge bg-secondary" :title="exam.allowSectionSwitch ? $t('startserver.sectionByStudent') : $t('startserver.sectionByTeacher')">§ {{ exam.allowSectionSwitch ? 'S' : 'T' }}</span>
                            <span v-if="exam.pin" class="badge bg-secondary-subtle text-secondary bip-status-pill ms-auto">{{ exam.pin }}</span>
                        </div>
                    </div>
                </div>
                <!-- Local exams widget grid END -->
                </div><!-- /exam-list-scroll -->
            </div>
            <!-- Create exam END -->

            <!-- Bildungsportal START -->
            <div v-if="activeTab === 'bildungsportal'" class="d-flex flex-column flex-grow-1" style="min-height: 0;">
                <div class="flex-shrink-0">
                <div v-if="!bipToken" class="text-secondary mt-1" style=" margin-left: 2px; margin-bottom: 14px;">
                    <span>{{$t("startserver.bippleaselogin")}}</span>
                </div>
                <div v-if="bipToken" class="text-secondary mt-1" style=" margin-left: 2px; margin-bottom: 14px;">
                    <span>{{$t("startserver.bipwelcome")}} {{bipUsername}}!</span>
                </div>

                <template v-if="advanced">
                <div class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.pwdinfo'))" @mouseout="hideDescription">
                    <span id="pwd" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.pwd")}}</span>
                    <input v-model="password" :type="showPassword ? 'text' : 'password'" class="form-control" id="examPassword" style="width:200px;">
                    <button @click="togglePasswordVisibility" class="password-visibility-btn" type="button">
                        <img :src="showPassword ? '/src/assets/img/svg/eye-slash-fill.svg' : '/src/assets/img/svg/eye-fill.svg'" class="password-visibility-icon" width="16" height="16">
                    </button>
                </div>
                <div class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.pwdinfo'))" @mouseout="hideDescription">
                    <span class="input-group-text col-2 grayback" style="width:170px;">{{$t("startserver.pwdconfirm")}}</span>
                    <input v-model="passwordConfirm" :type="showPassword ? 'text' : 'password'" class="form-control" :class="passwordMismatch ? 'is-invalid' : (passwordConfirm !== '' ? 'is-valid' : '')" style="width:200px;">
                    <span v-if="passwordMismatch" class="text-danger ms-2 align-self-center" style="font-size:0.8em;">⚠ {{$t("startserver.pwdmismatch")}}</span>
                </div>
                </template>

                <div v-if="advanced" class="input-group mb-1" style="max-width: fit-content" @mouseover="showDescription($t('startserver.backupfolderinfo'))" @mouseout="hideDescription">
                    <span id="backupdir" class="input-group-text col-2 grayback"  style="width:170px;">{{$t("startserver.backupfolder")}}</span>
                    <span class="form-control text-truncate" style="width:360px;  font-size: 0.9em; padding-top: 8px; white-space: pre;">{{ backupdir }}</span>
                    <button @click="setBackupdir()" id="backupdirbutton" class="btn btn-info p-0" style="width:40px;" :title="$t('startserver.backupfolderinfo')" >
                        <img src="/src/assets/img/svg/settings.svg" style="vertical-align: sub;" class="" width="18" height="18" >
                    </button>
                </div>

                <button @click="startServer()" :class="(!hostip || !bipToken || !servername || (advanced && (!password || !passwordConfirm || passwordMismatch))) ? 'disabledstart':''" id="examstart" class="ps-1 pe-1 mb-3 btn btn-success" value="start exam" style="width:170px;max-width:170px;min-width:170px;">{{$t("startserver.start")}}</button>
                </div><!-- /flex-shrink-0 -->

                <!-- BiP exams START -->
                <div class="flex-grow-1 exam-list-scroll">
                <div v-if="bipToken" class="text-secondary " style=" margin-left: 2px; margin-top: 6px;">
                    <span>{{$t("startserver.onlineexams")}}</span>
                    <button v-if="bipToken" class="btn p-0 white ms-1 mb-1" @click="fetchBipExams" title="Aktualisieren">
                        <img src="/src/assets/img/svg/gtk-convert.svg" width="16" height="16">
                    </button>
                </div>

                <div v-if="onlineExams && onlineExams.length > 0" class="bip-widget-grid">
                    <div
                        v-for="exam of onlineExams"
                        :key="`bip-main-${exam.id}-${exam.examName}`"
                        class="bip-exam-card bip-exam-card-bip"
                        :class="{ 'bip-exam-card-active': servername === exam.examName, 'cursornotallowed': !isExamVersionCompatible(exam) }"
                        @click="isExamVersionCompatible(exam) ? setOnlineExam(exam) : ''"
                        :title="!isExamVersionCompatible(exam) ? $t('startserver.incompatible') : ''"
                    >
                        <!-- Name + PIN -->
                        <div class="bip-exam-card-head">
                            <span v-if="exam.requireBiP" class="badge text-white flex-shrink-0 bg-success">BiP</span>
                            <div class="bip-exam-name fw-semibold small">{{ exam.examName }}</div>
                            <button v-if="previousBipExams.some(p => p.examName === exam.examName)" @click.stop="delPreviousExam(exam.examName)" class="btn btn-sm btn-warning p-0 ms-auto" style="width:18px; height:18px; font-size:0.7em; line-height:1;">✕</button>
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
                            <span v-if="exam.useExamSections" class="badge bip-type-sus" :title="exam.allowSectionSwitch ? $t('startserver.sectionByStudent') : $t('startserver.sectionByTeacher')">§ {{ exam.allowSectionSwitch ? 'S' : 'T' }}</span>
                            <span v-if="exam.examStudents && exam.examStudents.length" class="badge bip-type-sus">{{ exam.examStudents.length }} SuS</span>
                            <span v-if="exam.pin" class="badge bg-secondary-subtle text-secondary bip-status-pill ms-auto">{{ exam.pin }}</span>
                        </div>
                    </div>
                </div>
                </div><!-- /exam-list-scroll -->
            </div>
            <!-- Bildungsportal END -->

        </div>

        


    </div>
</div>



 <span @click="showCopyleft()" id="release" class="bg-dark text-white">
    <span style="display:inline-block; transform: scaleX(-1); font-size:1.2em; vertical-align: middle;">&copy;</span>
    <span >&nbsp;{{version}} {{ info }}</span>
</span>
<div v-if="showDesc" id="description" class="bg-dark text-white">{{ currentDescription }}</div>
<div id="statusdiv" class="bg-dark text-white">{{$t("startserver.connected")}}</div>

 <!-- BIB Infos START -->
 <div id="bipinfo">
    <div id="bipcheck" @click="fetchBiPNews();"> <div id="eye" class="darkgreen eyeopen"></div> &nbsp;BiP News</div>
    <div class="bipscrollarea">     
        <div v-if="bipnewsSorted.length == 0"  style="text-align: left; font-size: 0.8em; margin-left:10px;"> {{ $t('startserver.noNews') }}</div> 
        <div v-for="entry in bipnewsSorted" :key="entry.id" class="bipentry">
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
import {extractDomainAndId} from '../utils/examsetup.js'


// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  log.error('Unhandled promise rejection:', event.reason);
});

Object.assign(console, log.functions);





export default {
    data() {
        return {
            version: this.$route.params.version,
            info: config.info,
            config: this.$route.params.config,  // warning: config contains recursive elements, copied in ipchandler.copyConfig()
            buildDate: this.$route.params.config.buildDate,
            title: document.title,
            servername : this.$route.params.config.development ? "test-exam":"",
            password: "",
            passwordConfirm: "",
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
            bipNameConflict: false,
            showServernameCharsetHint: false,
            servernameCharsetHintTimer: null,

            bipToken:this.$route.params.bipToken === 'false' || !this.$route.params.bipToken ?  false : this.$route.params.bipToken,   // params are always passed as string "false", convert to bool
            bipuserID: this.$route.params.bipuserID === 'false' || !this.$route.params.bipuserID ?  false : this.$route.params.bipuserID,
            bipUsername:this.$route.params.bipUsername === 'false' || !this.$route.params.bipUsername ?  false : this.$route.params.bipUsername,


            bipnews: [],
            BipInfoActive: false,
            activeTab: 'pruefung',
            showDesc: false,
            currentDescription: '',
        };
    },
    components: {},
    directives: {
        // Finds all <a> tags and adds target="_blank" (e.g. for Digi4school books that must open in a popup)
        externalLinks: {
            mounted(el) {
                // Runs on first render (Vue 3 uses "mounted" instead of "inserted")
                const links = el.querySelectorAll("a");
                links.forEach(link => {
                    link.setAttribute("target", "_blank");
                    link.setAttribute("rel", "noopener noreferrer");
                });

            },
            updated(el) {
                // Also runs on content updates
                const links = el.querySelectorAll("a");
                links.forEach(link => {
                    link.setAttribute("target", "_blank");
                    link.setAttribute("rel", "noopener noreferrer");
                });
            }
        }
    },
    computed: {
        inactivelocale() { // Returns the inactive locale code
             return this.$i18n.locale === 'de' ? 'en' : 'de';
        },
        previousLocalExams() {
            return (this.previousExams || []).filter(exam => !exam?.bip);
        },
        previousBipExams() {
            return (this.previousExams || []).filter(exam => !!exam?.bip);
        },
        passwordMismatch() {
            return this.passwordConfirm !== '' && this.password !== this.passwordConfirm;
        },
        // BiP forum posts newest first (timecreated is Unix seconds from Moodle API).
        bipnewsSorted() {
            return [...(this.bipnews || [])].sort(
                (a, b) => (Number(b.timecreated) || 0) - (Number(a.timecreated) || 0)
            );
        },
        // Password sent to control API / dashboard when the user leaves advanced empty (legacy default).
        effectiveExamPassword() {
            if (this.password) return this.password;
            if (!this.advanced) return "next-exam";
            return "";
        }
    },

    methods: {
        // True when exam nextexamVersion major matches the running teacher build.
        isExamVersionCompatible(exam) {
            const examVersion = exam?.nextexamVersion;
            if (!examVersion || !this.version) return false;
            return examVersion.slice(0, 3) === this.version.slice(0, 3);
        },

        formatUnixDate(value) {
            if (!value) return "";
            // If timestamp is in seconds (10 digits), multiply by 1000
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
            // Toggle between 'de' and 'en'
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
            this.$swal.fire({
                title: this.$t("dashboard.bildungsportal"),
                text:  this.$t("dashboard.logoutBiP"),
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("dashboard.cancel"),
                focusConfirm: false,
                icon: 'question',
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await ipcRenderer.invoke('clearBipPortalSession', this.biptest)
                    } catch (e) {
                        console.warn('startserver @ logoutBiP: clearBipPortalSession', e)
                    }
                    this.bipToken = false
                    this.bipUsername = false
                    this.bipuserID = false
                    this.bipData = null
                    this.onlineExams = []
                    const loginBtn = document.querySelector('#biploginbutton')
                    if (loginBtn) {
                        loginBtn.classList.remove('disabledbutton')
                    }
                    this.$router.replace({ path: '/' })
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
         * Fetches user data once the login token has been received.
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

                    //log.info('startserver @ fetchBiPData: BiP data fetched', response)

                    
                    this.bipUsername = response.fullname
                    this.bipuserID = response.userid

                    const loginBtn = document.querySelector("#biploginbutton")
                    const bipLogo = document.querySelector("#biplogo")
                    if (loginBtn) {
                        loginBtn.classList.remove('btn-info')
                        loginBtn.classList.add('btn-success')
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
         * Fetches pre-configured exams from the Bildungsportal via BiP API.
         */
        fetchBipExams(){
            let token = this.decodeBase64AndExtractTokens(this.bipToken)?.[1];
            if (!token) {
                return;
            }

            const url = this.getBiPUrl() + '/webservice/rest/server.php';
            const body = new URLSearchParams({
                wstoken: token,
                wsfunction: 'local_dpu_get_exams_teacher',
                moodlewsrestformat: 'json',
            });

            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            })
            .then(response => response.json())
            .then(data => {
                if (data?.exception || data?.errorcode) {
                    console.error('startserver @ fetchBipExams: Moodle API error', data);
                    this.$swal.fire({
                        title: this.$t('startserver.bipExamListFailedTitle'),
                        html: `${this.$t('startserver.bipExamListFailedBody')}<br><br><small class="text-muted">${data.message || ''} (${data.errorcode || ''})</small>`,
                        icon: 'error',
                    });
                    return;
                }
                this.bipData = data;
                this.onlineExams.splice(0);
                this.onlineExams.push(...(Array.isArray(data.exams) ? data.exams : []));

                this.computeSebConfigForOnlineExams();
                 
            })
            .catch(error => { console.error('startserver @ fetchBipExams:', error); });
        },
        
        computeSebConfigForOnlineExams() {
            for (const [examkey, exam] of Object.entries(this.onlineExams)) {
                for (let i = 1; i <= 4; i++) {
                    if (exam.examSections[i].examtype === 'eduvidual') {
                        for (let group of ['groupA', 'groupB']) {
                            const config = exam.examSections[i][group].examConfig.eduvidual;
                            if (config.sebConfigFile != null) {
                                window.ipcRenderer?.invoke?.('loadSEBConfig', config.sebConfigFile, config.sebConfigPassword, config.sebConfigBek).then((sebConfig) => {
                                    if (sebConfig != null) {
                                        const url = sebConfig.sebConfig.startURL;
                                        const {moodledomain, testid} = extractDomainAndId(url);
                                        Object.assign(this.onlineExams[examkey].examSections[i][group].examConfig.eduvidual, {...sebConfig, url, moodleDomain: moodledomain, moodleTestId: testid});
                                    } else {
                                        let html = this.$t('startserver.bipExamSebConfigLoadingFailed') + `<br><br>${this.onlineExams[examkey].examName}`;
                                        if (this.onlineExams[examkey].useExamSections) html += ' -> ' + this.onlineExams[examkey].examSections[i].sectionname;
                                        if (this.onlineExams[examkey].examSections[i].groups) html += ' -> ' + this.$t('dashboard.' + group);
                                        html += '<br><br>' + this.$t('startserver.bipExamSebConfigLoadingFailedReason');
                                        this.$swal.fire({title: this.$t('startserver.bipExamSebConfigLoadingFailedTitle'), html: html, icon: 'error'});
                                    }
                                });
                            }
                        }
                    }
                }
            }
        },

        async setOnlineExam(exam){
            if (!this.isExamVersionCompatible(exam)) {
                this.status(this.$t('startserver.incompatible'));
                return;
            }
            this.servername = exam.examName

            this.selectedExam = { ...exam, bip: true }  // mark as bip exam for consistent tab-based start logic

            // save the selected exam information to local serverstatus.json / create local exam folder
            this.bipData.exams.forEach(bipexam =>{
                if (bipexam.examName === exam.examName){
                    ipcRenderer.invoke('createBipExamdirectory', bipexam)
                }
            }) 

            // keep button state consistent with "Local Exam" tab
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




        // Check if a string is Base64-encoded
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },

        // Decode a Base64 string and extract tokens
        decodeBase64AndExtractTokens(base64Str) {
            if (base64Str == null || !this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // adjust separators if needed
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
            this.hostip = await ipcRenderer.invoke('checkhostip')
            if (this.hostip?.availableInterfaces?.length > 1 && !this.hostip.preferredInterface){
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




        async checkDiscspace(){   // note: custom workdir conflicts with running teacher as pure web instance - wontfix
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
            this.workdir = this.config.workdirectory   // reflect any backend changes to workdir
            this.backupdir = this.config.backupdirectory || ''
        },


        /** Sets the exam name field to the clicked exam directory name. */
        async setPreviousExam(exam){
            if (!this.isExamVersionCompatible(exam)) {
                this.status(this.$t('startserver.incompatible'));
                return;
            }
            this.servername = exam.examName
            this.selectedExam = exam

            this.checkExistingExam()  // updates start button label
        },


        /** Checks if the selected exam already exists and updates the start button accordingly. */
        async checkExistingExam(){
            const examstart = document.getElementById('examstart')
            const examPasswordDiv = document.getElementById('examPassword')
            const servernameLower = (this.servername || '').toLowerCase()

            for (let i = 0; i < this.previousExams.length; i++) {
                const previousExam = this.previousExams[i] // current exam object
                if ((previousExam.examName || '').toLowerCase() === servernameLower) {

                    // BiP exam with same name: block if we are in the local tab
                    if (previousExam.bip && this.activeTab !== 'bildungsportal') {
                        this.backupdir = ''
                        this.bipNameConflict = true
                        if (examstart) examstart.classList.add('disabledstart')
                        if (examPasswordDiv) examPasswordDiv.disabled = false
                        return
                    }

                    if (!this.isExamVersionCompatible(previousExam)) {
                        this.bipNameConflict = false
                        this.backupdir = previousExam.backupdirectory || ''
                        if (examstart) {
                            examstart.innerHTML = this.$t("startserver.resume")
                            examstart.classList.add('disabledstart')
                        }
                        if (examPasswordDiv) examPasswordDiv.disabled = false
                        return
                    }

                    this.bipNameConflict = false
                    this.password = ""
                    this.passwordConfirm = ""
                    this.advanced = false
                    this.backupdir = previousExam.backupdirectory || ''
                    let hasExamPassword = typeof previousExam.examPassword === 'string' && previousExam.examPassword.trim() !== ''

                    if (hasExamPassword) {
                        this.password = previousExam.examPassword
                        this.passwordConfirm = previousExam.examPassword
                        await this.$nextTick();

                    }
                    if (examstart) {
                        examstart.innerHTML = this.$t("startserver.resume")
                        examstart.classList.remove('disabledstart')
                    }
                    if (examPasswordDiv){
                        examPasswordDiv.disabled = hasExamPassword  // lock only if a real password is set
                    }
                    return
                }
            }

            // no match found
            this.bipNameConflict = false
            this.backupdir = ''
            if (examstart) {
                examstart.innerHTML = this.$t("startserver.start")
                examstart.classList.remove('disabledstart')
            }
            if (examPasswordDiv){
                examPasswordDiv.disabled = false
            }
        },

        /** Deletes the selected exam. */
        delPreviousExam(name){
            // Ask for confirmation!
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
            else if (this.advanced && (this.password === "" || this.passwordConfirm === "" || this.passwordMismatch)){
                this.status(this.$t("startserver.emptypw"));
            }
            else {
                // Block if a BiP exam with this name exists locally but we're in the local tab
                const servernameLower = (this.servername || '').toLowerCase()
                const conflictingBipExam = this.previousExams.find(e => (e.examName || '').toLowerCase() === servernameLower && e.bip)
                if (conflictingBipExam && this.activeTab !== 'bildungsportal') {
                    this.status(this.$t("startserver.bipNameConflictInfo"))
                    return
                }

                let isBip = this.selectedExam && this.selectedExam.bip && (this.selectedExam.examName || '').toLowerCase() === servernameLower ? true : false
                let bipId = this.selectedExam && this.selectedExam.id ? this.selectedExam.id : null

                // Enforce tab separation: local exams only in local tab, bip exams only in bip tab
                if (isBip && this.activeTab !== 'bildungsportal') { this.status("BiP exams can only be started in the Bildungsportal tab."); return; }
                if (!isBip && this.activeTab === 'bildungsportal') { this.status("Local exams can only be started in the Local Exam tab."); return; }

                if (isBip && !this.bipToken){
                    this.status(this.$t("startserver.bipnotloggedin")); 
                    return;
                }
                
                // check if the servername equals a previous exam
                if (this.previousExams.some(exam => (exam.examName || '').toLowerCase() === servernameLower)){
                    this.selectedExam = this.previousExams.find(exam => (exam.examName || '').toLowerCase() === servernameLower)
                }
                else {
                    this.selectedExam = null
                }
           

                // check if the exam is compatible with the current version
                if (this.selectedExam && !this.isExamVersionCompatible(this.selectedExam)) {
                    this.status(this.$t("startserver.incompatible"));
                    return;
                }

                try {
                    const response = await ipcRenderer.invoke('startExamServer', {
                        servername: this.servername.toLowerCase(),
                        passwd: this.effectiveExamPassword,
                        bip: isBip,
                        bipId: bipId,
                    })
                    if (response.status === "success") {  //directly log in
                        this.status(response.message);
                        await this.sleep(1000);
                      
                        this.$router.push({  // for some reason this doesn't work on mobile
                            name: 'dashboard', 
                            params:{
                                servername: this.servername.toLowerCase(), 
                                passwd: this.effectiveExamPassword,
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
                } catch (err) { this.status(err); console.warn(err) }
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
        // Shows a short hint next to the exam name field when a disallowed character is rejected or paste/drop is blocked.
        flashServernameCharsetHint() {
            this.showServernameCharsetHint = true;
            if (this.servernameCharsetHintTimer) {
                clearTimeout(this.servernameCharsetHintTimer);
            }
            this.servernameCharsetHintTimer = setTimeout(() => {
                this.showServernameCharsetHint = false;
                this.servernameCharsetHintTimer = null;
            }, 1600);
        },
        onServernamePasteOrDrop(e) {
            e.preventDefault();
            this.flashServernameCharsetHint();
        },
        validateInput(e) {
            const lettersOnly = /^[a-zA-Z0-9-_]+$/;
            const key = e.key || String.fromCharCode(e.which);
            if (!lettersOnly.test(key)) {
                e.preventDefault();
                // Avoid hint for navigation/control keys (single printable chars and space are the usual mistakes).
                if (key.length === 1 || e.code === 'Space' || key === ' ') {
                    this.flashServernameCharsetHint();
                }
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
        },

        showDescription(description) {
            this.currentDescription = description;
            this.showDesc = true;
        },
        hideDescription() {
            this.showDesc = false;
        },

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



        // do not use setInterval() for intervals as it keeps all objects of the callbacks including fetch() responses in memory until the interval is stopped
        this.fetchinterval = new SchedulerService(4000);
        this.fetchinterval.addEventListener('action',  this.fetchInfo);  // event listener that reacts to the 'action' event (only reacts to 'action' from this instance and does not interfere)
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
        if (this.servernameCharsetHintTimer) {
            clearTimeout(this.servernameCharsetHintTimer);
            this.servernameCharsetHintTimer = null;
        }
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

.examname-input-row {
    flex-wrap: nowrap;
    align-items: center;
    min-width: 0;
}

.servername-charset-hint {
    flex: 1 1 auto;
    min-width: 0;
    max-width: min(480px, 42vw);
    font-size: 0.8em;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #198754;
}

.examname-bip-conflict-hint {
    max-width: min(280px, 28vw);
}

.servername-charset-hint-enter-active,
.servername-charset-hint-leave-active {
    transition: opacity 0.19s ease, transform 0.19s ease;
}

.servername-charset-hint-enter-from,
.servername-charset-hint-leave-to {
    opacity: 0;
    transform: translateX(6px);
}

.disabledstart {
    filter: contrast(100%) grayscale(60%) brightness(130%) blur(0.6px);
    pointer-events: none; 
}



.cursornotallowed {
    cursor: not-allowed !important;
   
}

#description {
    position: fixed;
    left: 240px;
    right: 0;
    bottom: 0;
    height: 1.5rem;
    line-height: 1.5rem;
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 6rem;
    z-index: 1500;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8em;
    text-align: left;
    margin: 0;
    padding-left: 0.5rem;
}

#release {
    position: fixed;
    left: 0;
    bottom: 0;
    height: 1.5rem;
    line-height: 1.5rem;
    padding: 0 0.5rem;
    z-index: 1500;
    box-sizing: border-box;
    font-size: 0.8em;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
}

#statusdiv {
    position: fixed;
    right: 0;
    bottom: 0;
    height: 1.5rem;
    line-height: 1.5rem;
    padding: 0 0.5rem;
    z-index: 1501;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    margin: 0;
    font-size: 0.8rem;
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
    margin-bottom: 1.5rem;
    border-bottom-left-radius: 16px;
}



.exam-list-scroll {
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,0.2) transparent;
}

.bip-widget-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.37rem;
}

.bip-exam-card {
    width: 300px;
    background: #f8f9fa;
    border: 1px solid;
    border-radius: 5px;
    padding: 7px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

/* match btn-cyan (Prüfung starten, local tab) */
.bip-exam-card-local {
    border-color: var(--bs-cyan);
}

.bip-exam-card-local:hover {
    border-color: var(--bs-cyan);
}

/* match btn-success (Prüfung starten, Bildungsportal tab) */
.bip-exam-card-bip {
    border-color: var(--bs-success);
}

.bip-exam-card-bip:hover {
    border-color: var(--bs-success);
}

.bip-exam-card-active {
    background: #d1e7dd;
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
    margin-left: auto;
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
    height: calc(100% - 1.5rem - 62px);
    right: -482px;
    top: 62px;
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
    height: calc(100vh - 1.5rem - 62px);
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

#sidebar-bottom {
    margin-bottom: 10px;
}


</style>
