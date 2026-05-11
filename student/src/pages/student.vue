<template>


    <!-- Header START -->
    <div v-show="!isLoading" class="w-100 p-3 text-white bg-dark text-left" style="height: 66px; z-index: 1000;">
    <span class="text-white m-1">
        <img :src='speedometer_img' class="white me-2  " width="32" height="32">
        <span class="fs-4 align-middle me-4" @click="handleClick">Next-Exam</span>
    </span>

        <span class="fs-4 align-middle  ms-3" style="float: right">Student</span>
        <div v-if="token && !localLockdown" id="adv" class="btn btn-success btn-sm m-0  mt-1"
             style="cursor: unset; float: right">{{ $t("student.connected") }}
        </div>
        <button v-if="clientinfo.groups && clientinfo.group == 'a' && token && !localLockdown" type="button"
                class="btn btn-info btn-sm  m-1 mt-1" style="cursor: unset; width: 32px; float: right"> A
        </button>
        <button v-if="clientinfo.groups && clientinfo.group == 'b' && token && !localLockdown" type="button"
                class="btn btn-warning btn-sm m-1 mt-1" style="cursor: unset; width: 32px; float: right"> B
        </button>
        <div v-if="!hostipDisplay && !token" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">
            {{ $t("student.offline") }}
        </div>
        <div v-if="hostipDisplay && !token" id="adv" class="btn btn-sm btn-outline-success m-0 mt-1" :style="canSelectInterface ? 'cursor: pointer; float: right' : 'cursor: unset; float: right'" @click="canSelectInterface && reconfigurePreferredInterface()">{{ hostip?.interface ? hostip.interface + ' : ' + hostip.hostip : hostipDisplay }}</div>
        <div v-if="networkerror" id="adv" class="btn btn-danger btn-sm m-0  mt-1 " style="cursor: unset; float: right">
            {{ $t("student.noapi") }}
        </div>
    </div>
    <!-- Header END -->

    <div v-show="!isLoading" id="wrapper" class="w-100 h-100 d-flex">

        <!-- SIDEBAR START -->
        <div class="p-3 text-white bg-dark h-100" style="width: 240px; min-width: 240px;">
            <div class="btn btn-light ms-1 text-start infobutton nobutton">
                <img :src='server_img' class="me-2" width="16" height="16"> {{ $t('student.exams') }}
            </div>
            <br>


            <div :class="(token)? 'disabledexam':''" class="form-check form-switch m-1 mb-2 mt-2">
                <input id="manualsearch" type="checkbox" v-model="advanced" class="form-check-input"
                       @change="toggleAdvanced">
                <label for="manualsearch" class="form-check-label">{{ $t('student.manualsearch') }}</label>
            </div>


            <!-- BIP Section START -->
            <div v-if="config.bipIntegration" class="mt-4">
                <span class="small m-1 me-0">{{ $t("student.bildungsportal") }}</span> <span v-if="bipToken"
                                                                                             class="small m-1 me-0 text-secondary">(verbunden)</span>
                <div v-if="bipToken" title="logout" id="biploginbutton" @click="logoutBiP()"
                     class="btn btn-success m-1 " :class="(token)? 'disabledexam':''" style="padding:0;">
                    <img id="biplogo"
                         style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; "
                         :src="login_students_img">
                    <span v-if="bipUsername" id="biploginbuttonlabel">{{ bipUsername }}</span>
                    <span v-else id="biploginbuttonlabel">Logout</span>
                </div>
                <div v-else id="biploginbutton" title="login" @click="loginBiP()" class="btn btn-info m-1 "
                     style="padding:0;" :class="(token)? 'disabledexam':''">
                    <img id="biplogo"
                         style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; "
                         :src="login_students_img">
                    <span v-if="bipUsername" id="biploginbuttonlabel">{{ bipUsername }}</span><span v-else
                                                                                                    id="biploginbuttonlabel">Login</span>
                </div>
            </div>
            <!-- BIP Section END -->


            <div @click="setupLocalLockdown()" class="btn btn-sm btn-outline-secondary ms-1 mt-3 mb-4"
                 :class="(token)? 'disabledexam':''" style="font-size:0.9em"> {{ $t("student.localLockdown") }}
            </div>


            <div><br>
                <div id="statusdiv" class="btn btn-warning m-1"></div>
            </div>
            <br>

            <button class="btn btn-outline-secondary btn-sm ms-1 mt-3 mb-2" style="position: absolute; bottom:32px;"
                    @click="toggleLocale">{{ inactivelocale }}
            </button>

            <span @click="showCopyleft()"
                  style="position: absolute; bottom:2px; left: 6px; font-size:0.8em;cursor: pointer;">
            <span style=" display:inline-block; transform: scaleX(-1);font-size:1.2em; ">&copy; </span> 
            <span style="vertical-align: text-bottom;">&nbsp;{{ version }} {{ info }}</span>
        </span>
        </div>
        <!-- SIDEBAR END  -->


        <!-- CONTENT START -->
        <div id="content" class="fadeinfast p-3">


            <div class="col-8 mb-2" :class="(token)? 'disabledtext':''">
                <div v-if="!bipToken" class="input-group  mb-1">
                    <span class="input-group-text col-3" style="width:135px;"
                          id="inputGroup-sizing-lg">{{ $t("student.username") }}</span>
                    <input ref="userInput" v-model="username" @paste.prevent @drop.prevent type="text"
                           required="required" maxlength="25" class="form-control" id="user" placeholder=""
                           style="width:200px;max-width:200px;min-width:135px;">
                </div>
                <div v-if="bipToken" class="input-group  mb-1">
                    <span class="input-group-text col-3" style="width:135px;"
                          id="inputGroup-sizing-lg">{{ $t("student.name") }}</span>
                    <span v-if="username" class="input-group-text col-3" style="width:200px;" id="inputGroup-sizing-lg"> {{
                            username
                        }} </span>
                    <span v-else class="input-group-text col-3 " style="width:200px;"
                          id="inputGroup-sizing-lg">  </span>
                </div>
                <div class="input-group  mb-1">
                    <span class="input-group-text col-3" style="width:135px;"
                          id="inputGroup-sizing-lg">{{ $t("student.pin") }}</span>
                    <input v-model="pincode" type="number" min="0" oninput="validity.valid||(value='')"
                           class="form-control" id="pin" placeholder=""
                           style="width:135px;max-width:135px;min-width:135px;">
                </div>
                <div v-if="advanced" class="input-group  mb-1">
                    <span class="input-group-text col-3" style="width:135px;"
                          id="inputGroup-sizing-lg">{{ $t("student.ip") }}</span>
                    <input :class="{'form-control': validip, 'form-control is-invalid': !validip}" v-model="serverip"
                           class="form-control" id="serverip" placeholder=""
                           style="width:135px;max-width:135px;min-width:135px;">
                </div>
            </div>


            <div style="position: absolute; top: 205px !important;">
                <h4 class="mt-3 ms-1">{{ $t("student.exams") }}</h4>
                <div id="list" class=""
                     style="overflow-y:auto; height: 369px; display:flex; flex-wrap: wrap; flex-direction: row; padding-bottom: 10%;">

                    <div v-for="server in serverlist" :key="server.id || server.servername"
                         class="row p-3 m-0 mb-2 border bg-light"
                         style="border-radius: 4px; margin-right: 10px !important; min-height:100px; max-height:100px;  min-width:234px; max-width: 234px;">

                        <div style="display:flex; flex-direction: row; justify-content: space-between; padding:0px;">
                            <div
                                style="width:130px; display:inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                {{ server.servername }}
                            </div>

                            <div v-if="server.version !== version" class="badge btn-warning "
                                 style="width:170px; height:20px; vertical-align: text-bottom; margin-top: 2px; display: inline;"
                                 :title="$t('student.outdatedinfo')"> {{ $t('student.outdated') }} {{ server.version }}
                            </div>
                            <div v-else-if="server.bip" class="badge btn-teal"
                                 style="width:70px; height:20px; vertical-align: text-bottom; margin-top: 2px; display: inline;">
                                BiP Exam
                            </div>
                            <div v-else
                                 style="width:70px; height:20px; vertical-align: text-bottom; margin-top: 2px; display: inline;"></div>
                        </div>


                        <div
                            style="display:flex; flex-direction: row; justify-content: space-between; padding:0px; margin:0px;">
                            <img v-if="!server.reachable" :src="emblem_warning_img"
                                 :title="$t('student.unreachable')"
                                 style="width:20px;height:20px;vertical-align:top;cursor: help;position: absolute; margin-top:8px; margin-left:8px; ">


                            <div v-if="!token" style="margin-top:2px; padding:0px; ">
                                <!-- not logged in, no bip server --> <input v-if="!server.bip" style="width:200px;"
                                                                             :id="server.servername" type="button"
                                                                             name="register" class="btn btn-sm btn-info"
                                                                             :value="$t('student.register')"
                                                                             @click="registerClient(server.serverip,server.servername)">

                              <router-link :to="{ name: 'math', params: { token: 'csrf-cf20e998-3ba7-4867-bc3e-94609d665cd6' } }">
                                Test Page
                              </router-link>
                              <router-link to="math/csrf-cf20e998-3ba7-4867-bc3e-94609d665cd6">
                                Test Page Static
                              </router-link>
                              
                              <!-- not logged in, bip server      --> <input v-if="server.bip" style="width:200px;"
                                                                               :id="server.servername" type="button"
                                                                               name="register" class="btn btn-sm"
                                                                               :value="server.examStatus ? server.examStatus : 'restricted'"
                                                                               :class="{'btn-teal': server.examStatus == 'open', 'btn-warning': server.examStatus == 'closed' || !server.examStatus, 'btn-secondary': server.examStatus == 'offline' }"/>
                            </div>
                            <div v-if="token" style="margin-top:2px; padding:0px;">
                                <!-- logged in, not on this server --> <input
                                v-if="clientinfo.servername !== server.servername && !server.bip" style="width:200px;"
                                :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-secondary"
                                :value="server.examStatus ? server.examStatus : $t('student.register')"/>
                                <!-- logged in, not on this server, bip server, restricted --> <input
                                v-if="clientinfo.servername !== server.servername && server.bip && !server.examStatus"
                                style="width:200px;" :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-secondary" value="restricted"/>
                                <!-- logged in, not on this server, bip server  --> <input
                                v-if="clientinfo.servername !== server.servername && server.bip && server.examStatus"
                                style="width:200px;" :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-secondary" :value="server.examStatus"/>
                                <!-- logged in, on this server       --> <input
                                v-if="clientinfo.servername === server.servername" style="width:200px;"
                                :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-success" :value="$t('student.registered')"/>
                            </div>

                        </div>

                    </div>

                    <div v-if="serverlist.length === 0"><h6 class="text-muted ms-1">{{ $t('student.noexams') }}</h6>
                      <router-link :to="{ name: 'math', params: { token: 'csrf-cf20e998-3ba7-4867-bc3e-94609d665cd6' } }">
                        Test Page
                      </router-link>

                      <router-link to="math/csrf-cf20e998-3ba7-4867-bc3e-94609d665cd6">
                        Test Page Static
                      </router-link>
                    </div>
                </div>
            </div>

        </div>
    </div>


</template>


<script lang="ts">
import validator from 'validator'
import {SignalBridge} from '../utils/signalBridge.js'
import speedometer_img from 'src/assets/img/svg/speedometer.svg'
import server_img from 'src/assets/img/svg/server.svg'
import login_students_img from 'src/assets/img/login_students.jpg'
import emblem_warning_img from '/src/assets/img/svg/emblem-warning.svg'
import { initScreenshotScheduler, hasActiveScreenshotStream, isFullDesktopCaptureLikely, ensureDisplayStreamAsync } from '../utils/screenshotCapture.js'
import { Exam } from '../types/api'
import loggingBridge from "../utils/loggingBridge.js";
import { autoCleanupMixin } from "../mixins/autoCleanupMixin.js";

function unhandledRejectionFunction() {
  const reason = event?.reason;
  const msg = typeof reason === 'string' ? reason : reason && reason.message;
  if (msg && (msg.includes('GUEST_VIEW_MANAGER_CALL') || msg.includes('ERR_FAILED'))) {
    event.preventDefault(); // swallow guest view clone errors and ERR_FAILED
    return;
  }
}

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', unhandledRejectionFunction);

//Object.assign(console, loggingBridge.functions);  // Replace all console logs with logger

// signalBridge instance centralizes ipc send calls with platform checks
const signalBridge = new SignalBridge(window);

export default {

    mixins: [autoCleanupMixin],
    data() {
        return {
            version: this.$route.params.version,
            token: "",
            username: this.$route.params.config.development ? "Thomas" : "" as string | boolean,
            pincode: this.$route.params.config.development ? "1111" : "" as string,
            clientinfo: {},
            serverlist: [],
            serverlistAdvanced: [],
            serverApiPort: this.$route.params.serverApiPort,
            clientApiPort: this.$route.params.clientApiPort,
            electron: this.$route.params.electron,
            config: this.$route.params.config,
            info: this.$route.params.config.info,
            buildDate: this.$route.params.config.buildDate,
            startExamEvent: null,
            advanced: false,
            serverip: "" as string,
            servername: "",
            hostip: this.$route.params.config.hostip,
            clickCount: 0,
            networkerror: false,
            localLockdown: false,
            isLoading: true,

            biptest: true,
            bipToken: false,
            bipUsername: false,
            bipuserID: false,
            servertimeout: false,
            bipData: null,
            onlineExams: [] as Exam[],
            validip: true,
            serverFailureCount: {}, // Track failed ping attempts for manually added servers
            activeDialog: false,

            timer: null,

            speedometer_img,
            server_img,
            login_students_img,
            emblem_warning_img
        };
    },
    computed: {
        inactivelocale() { // Display current language code
            return this.$i18n.locale === 'de' ? 'en' : 'de';
        },
        hostipDisplay() {
            return this.hostip && (typeof this.hostip === 'object' ? this.hostip.hostip : this.hostip);
        },
        canSelectInterface() {
            return !this.token && this.hostip?.availableInterfaces?.length > 1;
        }
    },


    methods: {
        toggleLocale() {
            // Switch between 'de' and 'en'
            this.$i18n.locale = this.$i18n.locale === 'de' ? 'en' : 'de';
            signalBridge.send('set-new-locale', this.$i18n.locale);
        },

        async selectPreferredInterface() {
            loggingBridge.info('selectPreferredInterface');
            if (this.activeDialog || !this.hostip?.availableInterfaces?.length) return;
            this.activeDialog = true;
            this.$swal.fire({
                customClass: {
                    popup: 'my-popup',
                    title: 'my-title',
                    content: 'my-content',
                    input: 'my-custom-input',
                    inputLabel: 'my-input-label',
                    actions: 'my-swal2-actions'
                },
                title: this.$t("student.selectinterface"),
                html: "<div class='my-content'>" + this.$t("student.selectinterfaceinfo") + "<br><br>" +
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
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await signalBridge.invoke('setPreferredInterface', result.value);
                    const updated = await signalBridge.invoke('checkhostip');
                    this.safeAssign('hostip', updated);
                }
                this.activeDialog = false;
            });
        },

        reconfigurePreferredInterface() {
            if (this.token) return;
            this.activeDialog = false;
            this.selectPreferredInterface();
        },

        async loginBiP() {
            /*if (this.config.bipDemo) {   // skip bip logon and fake bip info
                this.bipUsername = "Marie Curie"
                this.bipuserID = 8
                this.bipToken = btoa("Token:4fce5b97fe36cb42313621ebf3ff2a1a")
                this.username = this.bipUsername

                await this.fetchBipExams()
                this.bipAutoconnect()
                return  //skip real login
            }*/
            let IPCresponse = signalBridge.sendSync('loginBiP', this.biptest)
            if (IPCresponse && IPCresponse.status === "success") {

            }
            console.log(IPCresponse)
        },

        logoutBiP() {
            this.$swal({
                title: this.$t("student.bildungsportal"),
                text: this.$t("student.logoutBiP"),
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("editor.cancel"),
                focusConfirm: false,
                icon: 'question',
            }).then((result) => {
                if (result.isConfirmed) {
                    this.bipToken = false
                    this.bipUsername = false
                    this.bipuserID = false
                    this.username = ""
                    this.pincode = ""
                    this.bipData = null
                    this.onlineExams = []
                    const loginBtn = document.querySelector('#biploginbutton')
                    if (loginBtn) {
                        loginBtn.classList.remove('disabledbutton')
                    }
                }
            });
        },

        /**
         * Checks if there are online exams and attempts to connect to them
         */
        bipAutoconnect() {
            if (this.onlineExams.length > 0) {
                this.onlineExams.forEach((exam: Exam) => {
                    if (exam.examStatus == "open") {
                        exam.examTeachers.forEach(teacher => {
                            if (teacher.teacherIP) {
                                //console.log(exam)
                                this.serverip = teacher.teacherIP
                                this.username = this.bipUsername
                                this.pincode = exam.examPin.toString()     // Set the pin to the exam pin for auto connect
                                console.log(`connecting to exam: ${exam.examName} with teacher: ${teacher.teacherID} and pin: ${exam.examPin}`)
                                this.registerClient(teacher.teacherIP, exam.examName)
                            }
                        })
                    }
                })
            }
        },

        handleClick() {
            this.clickCount++;
            if (this.clickCount > 6) {
                this.clickCount = 0
                console.log("Easter Egg");
                signalBridge.send('reload-url');
            }
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
         * Loads pre-configured exams from the education portal via bip/api
         */
        async fetchBipExams() {
            let token = this.decodeBase64AndExtractTokens(this.bipToken)?.[1];
            if (!token) {
                console.error("student.vue@fetchBipExams: cannot fetch from bip api without valid token")
                return;
            }

            const url = this.getBiPUrl() + '/webservice/rest/server.php?wstoken=' + token + '&wsfunction=local_dpu_get_exams_student&moodlewsrestformat=json';

            await this.autoFetch(url, { method: "GET" })
            .then(response => {
                return response.json();
            })
            .then(data => {
                this.bipData = data
                this.onlineExams = Array.isArray(data?.exams) ? data.exams : []
            })
            .catch(error => {
                console.error("Error during API call:", error);
            });
        },


        fetchBiPData(base64String) {
            const tokens = this.decodeBase64AndExtractTokens(base64String);
            let token = tokens[1]
            console.log("token"+token);
            let url = this.getBiPUrl()+'/webservice/rest/server.php?wstoken='+token+'&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json';

            this.autoFetch(url, {method: 'POST'})
                .then(res => res.json())
                .then(async (response) => {
                    if (response.fullname){
                        this.$swal.fire({
                            title: "BiP Response",
                            text: "Verbindung hergestellt",
                            icon: 'info',
                            showCancelButton: false,
                        })

                        this.bipUsername = response.fullname
                        this.bipuserID = response.userid


                        document.querySelector("#biploginbutton").classList.remove('btn-info')
                        document.querySelector("#biploginbutton").classList.add('btn-success')
                        document.querySelector("#biplogo").style.filter = "hue-rotate(140deg)"

                        await this.fetchBipExams()
                        await this.fetchInfo()
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
                .catch(err => {
                    console.warn(err)
                })
        },


        setupLocalLockdown() {

            signalBridge.send('locallockdown', {
                password: "Test",
                exammode: "ggb",
                clientname: "username",
                languagetool: false,
                spellchecklang: "german",
                suggestions: true
            })

            const inputOptions = {
                'de-DE': this.$t("student.de"),
                'en-GB': this.$t("student.en"),
                'fr-FR': this.$t("student.fr"),
                'es-ES': this.$t("student.es"),
                'it-IT': this.$t("student.it"),
                'sl-SI': this.$t("student.sl"),
                'none': this.$t("student.none"),
            }

            let savedUsername = ''; // Store input values before dialog closes (Electron 39 compatibility)
            let savedPassword = '';
            let savedLanguagetool = false;
            let savedSuggestions = false;
            let savedExammode = '';

            this.$swal({
                customClass: {
                    input: 'my-select',
                },
                title: this.$t("student.localLockdown"),
                html: `
                    ${this.$t("student.selectexammode")} <br> <br>
                    <div style="text-align: left; width: 150px; margin: auto auto;">
                            <input class="form-check-input" name=etesttype type="radio" id="editor" value="editor" checked>
                            <label class="form-check-label" for="editor"> ${this.$t("student.lang")} </label>
                            <br>
                            <input class="form-check-input"  name=etesttype type="radio" id="math" value="math">
                            <label class="form-check-label" for="math"> ${this.$t("student.math")} </label>
                    </div>
                    <div class=" m-2 mt-4"> 
                        <div class="input-group  m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">${this.$t("student.username")} </span>
                            <input class="form-control" type=text id=localuser placehoder='Username'>
                        </div>
                        <div class="input-group m-1 mb-1"> 
                            <span class="input-group-text col-3" style="width:140px;">${this.$t("student.password")}</span>
                            <input class="form-control" type=password id=localpassword placehoder='Password'>
                        </div>
                    </div>
                    <hr id="spellcheckSeparator" style="display: block;">
                    <div id="spellcheckSection" style="text-align: left; margin-left: 16px; display: block;">
                        <h6>${this.$t("student.spellcheck")}</h6>
                        <input class="form-check-input" type="checkbox" id="checkboxLT">
                        <label class="form-check-label" for="checkboxLT" style="font-size: 1rem; font-weight: 500;"> LanguageTool ${this.$t("student.activate")} </label> <br>
                        <input class="form-check-input" type="checkbox" id="checkboxsuggestions">
                        <label class="form-check-label" for="checkboxsuggestions" style="font-size: 1rem; font-weight: 500;"> ${this.$t("student.suggest")} </label><br><br>
                        <h6 style="margin-bottom:0px">${this.$t("student.spellcheckchoose")}</h6>
                    </div>`,
                input: 'select',
                inputOptions: inputOptions,
                showCancelButton: true,
                confirmButtonText: 'Ok',
                cancelButtonText: this.$t("editor.cancel"),
                focusConfirm: false,
                icon: false,
                didOpen: () => {
                    const localUserElement = document.getElementById("localuser");
                    const localPasswordElement = document.getElementById("localpassword");

                    this.autoEventListener(localUserElement,"keypress", function (e) {
                        // var lettersOnly = /^[a-zA-Z ]+$/;
                        var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
                        var key = e.key || String.fromCharCode(e.which);
                        // Allow Enter key to pass through
                        if (e.key === 'Enter') {
                            return;
                        }
                        if (!lettersOnly.test(key)) {
                            e.preventDefault();
                        }
                    });

                    // Add Enter key listener to confirm dialog - attach to both input fields and document
                    const swalInstance = this.$swal;
                    const handleEnterKey = (e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                            e.preventDefault();
                            swalInstance.clickConfirm();
                        }
                    };

                    // Add listener to document for general Enter key handling
                    this.autoEventListener(document,'keydown', handleEnterKey);
                    // Add listener directly to input fields to catch Enter when focused
                    this.autoEventListener(localUserElement,'keydown', handleEnterKey);
                    this.autoEventListener(localPasswordElement,'keydown', handleEnterKey);

                    // Store handler reference for cleanup (will be cleaned up when dialog closes)
                    this._enterKeyHandler = handleEnterKey;
                    this._enterKeyHandlerUser = handleEnterKey;
                    this._enterKeyHandlerPassword = handleEnterKey;

                    const checkboxLT = document.getElementById('checkboxLT');
                    const checkboxSuggestions = document.getElementById('checkboxsuggestions');
                    const spellcheckSection = document.getElementById('spellcheckSection');
                    const spellcheckSeparator = document.getElementById('spellcheckSeparator');
                    const editorRadio = document.getElementById('editor');
                    const mathRadio = document.getElementById('math');
                    const selectElement = document.querySelector('.swal2-select');

                    // Function to toggle spellcheck section visibility
                    const toggleSpellcheckSection = () => {
                        const isEditor = editorRadio.checked;
                        if (isEditor) {
                            spellcheckSection.style.display = 'block';
                            spellcheckSeparator.style.display = 'block';
                            if (selectElement) {
                                selectElement.style.display = 'block';
                            }
                        } else {
                            spellcheckSection.style.display = 'none';
                            spellcheckSeparator.style.display = 'none';
                            if (selectElement) {
                                selectElement.style.display = 'none';
                            }
                        }
                    };

                    // Initial: suggestions-Checkbox deaktivieren, falls LT nicht gecheckt ist
                    checkboxSuggestions.disabled = !checkboxLT.checked;

                    // Event Listener für checkboxLT, um den Status von checkboxsuggestions anzupassen
                  this.autoEventListener(checkboxLT,'change', () => {
                        checkboxSuggestions.disabled = !checkboxLT.checked;
                        // Wenn checkboxLT abgewählt wird, soll suggestions zusätzlich zurückgesetzt werden:
                        if (!checkboxLT.checked) {
                            checkboxSuggestions.checked = false;
                        }
                    });

                    // Event Listener für Radio-Buttons, um Spellcheck-Sektion ein/auszublenden
                    this.autoEventListener(editorRadio,'change', toggleSpellcheckSection);
                    this.autoEventListener(mathRadio,'change', toggleSpellcheckSection);

                    // Initial visibility based on selected radio button
                    toggleSpellcheckSection();

                    // Setze Standard-Sprache auf de-DE
                    if (selectElement) {
                        setTimeout(() => {
                            selectElement.value = 'de-DE';
                        }, 100);
                    }
                },
                didClose: () => {
                    // Remove Enter key listener when dialog closes
                    if (this._enterKeyHandler) {
                        document.removeEventListener('keydown', this._enterKeyHandler);
                        this._enterKeyHandler = null;
                    }
                    // Remove listeners from input fields if they still exist
                    const localUserElement = document.getElementById("localuser");
                    const localPasswordElement = document.getElementById("localpassword");
                    if (localUserElement && this._enterKeyHandlerUser) {
                        localUserElement.removeEventListener('keydown', this._enterKeyHandlerUser);
                        this._enterKeyHandlerUser = null;
                    }
                    if (localPasswordElement && this._enterKeyHandlerPassword) {
                        localPasswordElement.removeEventListener('keydown', this._enterKeyHandlerPassword);
                        this._enterKeyHandlerPassword = null;
                    }
                },
                preConfirm: () => {
                    // Save all input values before dialog closes (Electron 39 compatibility)
                    const localUserElement = document.getElementById('localuser');
                    const localPasswordElement = document.getElementById('localpassword');
                    const checkboxLTElement = document.getElementById('checkboxLT');
                    const checkboxSuggestionsElement = document.getElementById('checkboxsuggestions');
                    const radioButtons = document.querySelectorAll('input[name="etesttype"]');

                    savedUsername = localUserElement ? localUserElement.value.trim() : '';
                    savedPassword = localPasswordElement ? localPasswordElement.value : '';
                    savedLanguagetool = checkboxLTElement ? checkboxLTElement.checked : false;
                    savedSuggestions = checkboxSuggestionsElement ? checkboxSuggestionsElement.checked : false;

                    radioButtons.forEach((radio) => {
                        if (radio.checked) {
                            savedExammode = radio.value;
                        }
                    });

                    // Validate mandatory fields
                    if (!savedUsername || savedUsername === '') {
                        this.$swal.showValidationMessage(this.$t("student.nouser") || 'Username is required');
                        return false;
                    }
                    if (!savedPassword || savedPassword === '') {
                        this.$swal.showValidationMessage(this.$t("student.nopin") || 'Password is required');
                        return false;
                    }
                }
            }).then((result) => {
                if (result.isConfirmed) {

                    let exammode = savedExammode; // Use saved value instead of reading from DOM
                    let username = savedUsername; // Use saved value instead of reading from DOM
                    username = username.replace(/^\s+|\s+$/g, '');  // Check username - remove leading and trailing spaces
                    let password = savedPassword; // Use saved value instead of reading from DOM

                    if (username == "" || password == "") {
                        this.localLockdown = false
                        return;
                    }

                    // Read checkbox values and language selection
                    const spellchecklang = result.value || 'de-DE';
                    let languagetool = savedLanguagetool; // Use saved value instead of reading from DOM
                    let suggestions = savedSuggestions; // Use saved value instead of reading from DOM

                    // If language is 'none', disable languagetool
                    if (spellchecklang === 'none') {
                        languagetool = false;
                    }

                    this.localLockdown = true
                    signalBridge.send('locallockdown', {
                        password: password,
                        exammode: exammode,
                        clientname: username,
                        languagetool: languagetool,
                        spellchecklang: spellchecklang,
                        suggestions: suggestions
                    })
                } else {
                    this.localLockdown = false
                    return;
                }
            });
        },


        clearUser() {
            this.username = ""
        },

        // Check if the string is Base64-encoded
        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (err) {
                return false;
            }
        },

        // Decode Base64 string and extract possible tokens
        decodeBase64AndExtractTokens(base64Str) {
            if (!this.isBase64(base64Str)) {
                return null;
            }
            const decodedStr = atob(base64Str);
            const tokens = decodedStr.split(/[:\s,]+/); // Adjust separators if necessary
            return tokens;
        },

        /**
         * Helper: Sets a reactive property only if the value changes
         * Prevents unnecessary re-renders
         */
        safeAssign(key, newValue) {
            if (this[key] !== newValue) {
                this[key] = newValue;
            }
        },

        /**
         * Helper: Compares two server objects based on relevant properties
         * Ignores timestamp as it constantly changes
         */
        compareServerObjects(server1, server2) {
            if (!server1 || !server2) return false;
            return (
                (server1.id || server1.servername) === (server2.id || server2.servername) &&
                server1.examStatus === server2.examStatus &&
                server1.bip === server2.bip &&
                server1.reachable === server2.reachable &&
                server1.serverip === server2.serverip
            );
        },

        /**
         * Helper: Checks if two server lists are identical (relevant for updates)
         */
        isServerlistEqual(list1, list2) {
            if (list1.length !== list2.length) return false;
            const names1 = this.extractServerNames(list1);
            const names2 = this.extractServerNames(list2);
            if (JSON.stringify(names1) !== JSON.stringify(names2)) return false;

            // Additionally compare relevant properties
            for (let i = 0; i < list1.length; i++) {
                const s1 = list1.find(s => (s.id || s.servername) === (list2[i].id || list2[i].servername));
                const s2 = list2[i];
                if (s1 && !this.compareServerObjects(s1, s2)) {
                    return false;
                }
            }
            return true;
        },

        /**
         * Helper: Check if a server was manually added (exists in serverlistAdvanced)
         */
        isManuallyAddedServer(server) {
            if (!server || !server.serverip) return false;
            return this.serverlistAdvanced.some(s =>
                (s.id === server.id) ||
                (s.serverip === server.serverip) ||
                (s.servername === server.servername)
            );
        },

        /**
         * Helper: Get server identifier for failure tracking
         */
        getServerIdentifier(server) {
            return server.id || server.serverip || server.servername;
        },

        /**
         * Helper: Remove server from serverlistAdvanced after multiple failures
         */
        removeFailedManualServer(serverIdentifier) {
            this.serverlistAdvanced = this.serverlistAdvanced.filter(s => {
                const id = this.getServerIdentifier(s);
                return id !== serverIdentifier;
            });
            // Remove from failure count tracking
            delete this.serverFailureCount[serverIdentifier];
        },

        /** Merge BiP portal exams into a server list (works with or without multicast / manual IP servers). */
        mergeBipExamsIntoServerlist(newServerlist) {
            if (!this.onlineExams?.length) {
                return newServerlist;
            }
            this.onlineExams.forEach(exam => {
                const examId = exam.id || exam.examName;
                const existingInNewList = newServerlist.find(s => (s.id || s.servername) === examId);
                const existingInCurrentList = this.serverlist.find(s => (s.id || s.servername) === examId);

                if (existingInNewList) {
                    if (existingInNewList.examStatus !== exam.examStatus) {
                        existingInNewList.examStatus = exam.examStatus;
                    }
                } else if (existingInCurrentList) {
                    const updatedServer = {
                        ...existingInCurrentList,
                        examStatus: exam.examStatus,
                    };
                    newServerlist.push(updatedServer);
                } else {
                    const newServer = {
                        id: exam.id,
                        servername: exam.examName,
                        reachable: true,
                        serverport: this.serverApiPort,
                        timestamp: Date.now(),
                        bip: true,
                        examStatus: exam.examStatus,
                        version: exam.version
                    };
                    newServerlist.push(newServer);
                }
            });
            return newServerlist;
        },

        dedupeServerlistById(newServerlist) {
            return newServerlist.reduce((unique, server) => {
                if (!unique.some(u => u.id === server.id)) {
                    unique.push(server);
                }
                return unique;
            }, []);
        },

        applyOnlineExamStatusToServerlist() {
            if (!this.onlineExams?.length) {
                return;
            }
            let hasChanges = false;
            this.onlineExams.forEach(exam => {
                const existingServer = this.serverlist.find(server => server.id === exam.id);
                if (existingServer) {
                    if (existingServer.examStatus !== exam.examStatus) {
                        existingServer.examStatus = exam.examStatus;
                        hasChanges = true;
                    }
                }
            });
            if (hasChanges) {
                this.serverlist = [...this.serverlist];
            }
        },


        async fetchInfo() {
            let getinfo = await signalBridge.invoke('getinfoasync')  // gets serverlist and clientinfo from multicastclient


            if (getinfo.clientinfo.exammode) {
                return;
            }  // do not stress ui updates if exammode is active

            // Only update if clientinfo has actually changed
            const clientInfoStr = JSON.stringify(getinfo.clientinfo);
            const currentClientInfoStr = JSON.stringify(this.clientinfo);
            if (clientInfoStr !== currentClientInfoStr) {
                this.clientinfo = getinfo.clientinfo;
            }

            // Only set token if changed
            const newToken = this.clientinfo.token;
            if (this.token !== newToken) {
                this.token = newToken;
            }

            // Only set localLockdown if necessary
            if ((this.token && this.token != "0000") || !this.token) {
                if (this.localLockdown) {
                    this.localLockdown = false;
                }
            }

            // Only set advanced if necessary
            if (this.servertimeout > 2 && !this.advanced) {
                this.advanced = true;
            }

            /**
             * Fetch serverlist from server via direct ip polling
             * advanced search for exams in local network
             */
            if (this.advanced && !this.token) {
                if (this.serverip !== "") {
                    if (validator.isIP(this.serverip) || validator.isFQDN(this.serverip)) {
                        this.safeAssign('validip', true);
                        // Give some user feedback here
                        if (this.serverlistAdvanced.length == 0) {
                            this.status("Suche nach Prüfungen...")
                        }
                        this.autoFetch(`https://${this.serverip}:${this.serverApiPort}/server/control/serverlist`)
                            .then(response => response.json()) // Parse JSON response
                            .then(data => {
                                if (data && data.status === "success") {
                                    // Only update if the list has changed
                                    const newListStr = JSON.stringify(data.serverlist);
                                    const currentListStr = JSON.stringify(this.serverlistAdvanced);
                                    if (newListStr !== currentListStr) {
                                        this.serverlistAdvanced = data.serverlist;
                                    }
                                    this.safeAssign('networkerror', false);
                                }
                            }).catch(err => {
                            loggingBridge.error(`student.vue @ fetchInfo (advanced): ${err.message}`);
                            this.safeAssign('networkerror', true);
                        });
                    } else {
                        this.safeAssign('validip', false);
                    }
                } else {
                    this.safeAssign('networkerror', false);
                    this.safeAssign('validip', true);
                }
            } else {
                this.safeAssign('networkerror', false);
                this.safeAssign('validip', true);
            }


            /**
             * Fetch serverlist from server via multicast
             * if no serverlist is found via multicast we use the serverlist coming from direct ip polling
             * otherwise we add all found servers to the serverlist and combine multicasted servers with direct ip polled servers
             */
            if (getinfo.serverlist.length !== 0) {
                let newServerlist = getinfo.serverlist;

                this.safeAssign('servertimeout', 0); // Reset servertimeout (if more than 2 requests return without servers we display serveraddress field - probably multicast blocked)
                if (this.serverlistAdvanced.length !== 0) {  // Add servers coming from direct ip polling
                    newServerlist = [...newServerlist, ...this.serverlistAdvanced];

                }
                newServerlist = this.mergeBipExamsIntoServerlist(newServerlist);
                newServerlist = this.dedupeServerlistById(newServerlist);

                // Optimized: Update serverlist only if relevant data has changed
                if (!this.isServerlistEqual(this.serverlist, newServerlist)) {
                    console.log("student.vue @ fetchInfo: updating serverlist with new servers")
                    this.serverlist = newServerlist // update serverlist - but only if there are new servers or relevant changes
                }

                this.applyOnlineExamStatusToServerlist();


            }
            else {  // No multicast: still show manual IP servers and BiP exams from the portal
                let newServerlist = this.serverlistAdvanced.length !== 0 ? [...this.serverlistAdvanced] : [];
                newServerlist = this.mergeBipExamsIntoServerlist(newServerlist);
                newServerlist = this.dedupeServerlistById(newServerlist);

                if (newServerlist.length > 0) {
                    this.safeAssign('servertimeout', 0);
                } else {
                    if (this.servertimeout <= 2) {
                        this.servertimeout++;
                    }
                }

                if (!this.isServerlistEqual(this.serverlist, newServerlist)) {
                    this.serverlist = newServerlist;
                }
                this.applyOnlineExamStatusToServerlist();
            }


            /**
             * Check if network connection is still alive or if we are already connected and received a token
             * If not we exit here
             */
            const newHostip = await signalBridge.invoke('checkhostip');
            this.safeAssign('hostip', newHostip);
            const hasIp = this.hostip && (typeof this.hostip === 'object' ? this.hostip.hostip : this.hostip);
            if (!hasIp) return;
            if (this.hostip?.availableInterfaces?.length > 1 && !this.hostip?.preferredInterface) {
                this.selectPreferredInterface();
            }
            if (this.clientinfo.token) return;   // stop spamming the api if already connected


            /**
             * Optimized: Check if server is still alive otherwise mark with attention sign
             * This is done by pinging the server with a timeout of 2 seconds
             * Only set server.reachable if the value actually changes
             * For manually added servers: remove after more than 2 failures
             */
            for (let server of this.serverlist) {
                //loggingBridge.info(`student.vue @ fetchinfo: checking server ${server.servername} (${server.serverip})`)
                if (!server.serverip) continue;
                const serverIdentifier = this.getServerIdentifier(server);
                const isManual = this.isManuallyAddedServer(server);
                const signal = AbortSignal.timeout(4000); // 4000 milliseconds = 4 seconds
                this.autoFetch(`https://${server.serverip}:${this.serverApiPort}/server/control/pong`, {
                    method: 'GET',
                    signal
                })
                    .then(response => {
                        if (!response.ok) throw new Error('Response not OK');
                        // Optimized: Only set if value changes
                        if (server.reachable !== true) {
                            server.reachable = true;
                        }
                        // Reset failure count if server is reachable again
                        if (isManual && this.serverFailureCount[serverIdentifier] !== undefined) {
                            this.serverFailureCount[serverIdentifier] = 0;
                        }
                    })
                    .catch(err => {
                        if (err.name === 'AbortError') {
                            console.warn('student.vue @ fetchinfo (ping): Fetch request was aborted due to timeout');
                        } else {
                            console.warn(`student.vue @ fetchinfo: ${err.message} - Server unavailable `);
                        }
                        // Optimized: Only set if value changes
                        if (server.reachable !== false) {
                            server.reachable = false;
                        }
                        // Track failures for manually added servers
                        if (isManual) {
                            // Initialize counter if not exists
                            if (this.serverFailureCount[serverIdentifier] === undefined) {
                                this.serverFailureCount[serverIdentifier] = 0;
                            }
                            // Increment failure count
                            this.serverFailureCount[serverIdentifier]++;
                            // Remove server if more than 2 failures
                            if (this.serverFailureCount[serverIdentifier] > 2) {
                                console.log(`student.vue @ fetchinfo: Removing manually added server ${serverIdentifier} after ${this.serverFailureCount[serverIdentifier]} failures`);
                                this.removeFailedManualServer(serverIdentifier);
                            }
                        }
                    });
            }
        },


        extractServerNames(list) {
            return list.map(item => item.servername).sort();
        },

        toggleAdvanced() {
            if (!this.advanced) {
                this.servertimeout = 0
                this.serverip = ""
            }
        },


        //show status message
        async status(text) {
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

        /** register client on the server **/
        async registerClient(serverip, servername) {
            if (this.username === "") {
                this.$swal.fire({ title: "Error", text: this.$t("student.nouser"), icon: 'error', showCancelButton: false });
                return;
            }
            if (this.pincode === "") {
                this.$swal.fire({ title: "Error", text: this.$t("student.nopin"), icon: 'error', showCancelButton: false });
                return;
            }
            // if (!hasActiveScreenshotStream()) {
            //     const ok = await ensureDisplayStreamAsync();
            //     if (!ok) {
            //         this.$swal.fire({ title: "Error", text: this.$t("student.screenshotpermission"), icon: 'error', showCancelButton: false });
            //         return;
            //     }
            // }
            // if (!isFullDesktopCaptureLikely() && !this.$route.params.config.development) {
            //     this.$swal.fire({ title: "Error", text: this.$t("student.screenshotarea"), icon: 'error', showCancelButton: false });
            //     return;
            // }

            const charMap = {
                    'ć': 'c',
                    'č': 'c',
                    'š': 's',
                    'ž': 'z',
                    'đ': 'd',
                    // Add more mappings as needed
                };


                //check username - remove leading and trailing spaces
                this.username = this.username
                    .replace(/^\s+|\s+$/g, '')
                    .replace(/[^\x00-\x7F]/g, char => charMap[char] || char); // Replace using the map


                //  console.log({clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode, bipuserID:this.bipuserID })
                IPCresponse = signalBridge.sendSync('register', {
                    clientname: this.username,
                    servername: servername,
                    serverip,
                    serverip,
                    pin: this.pincode,
                    bipuserID: this.bipuserID
                })
                if (IPCresponse) {
                    console.log(`student @ registerClient: ${IPCresponse.message}`)
                    if (IPCresponse.token) {
                        this.token = IPCresponse.token  // set token (used to determine server connection status)
                    }
                }

                if (IPCresponse && IPCresponse.status === "success") {
                    this.$swal.fire({
                        title: "OK",
                        html: `<div style="white-space: pre-line;">${this.$t("student.registeredinfo")}</div>`,
                        icon: 'success',
                        timer: 6000,
                        showCancelButton: false,
                        didOpen: () => {
                            this.$swal.showLoading();
                        },
                    })


                }
                if (IPCresponse && IPCresponse.status === "error") {
                    this.$swal.fire({
                        title: "Error",
                        text: IPCresponse.message,
                        icon: 'error',
                        showCancelButton: false,
                    })
                }
        },
        showCopyleft() {
            this.$swal.fire({
                title: "<span id='cpleft' class='active' style='display:inline-block; transform: scaleX(-1); vertical-align: middle; cursor: pointer;'>&copy;</span> <span style='font-size:0.7em'>Thomas Michael Weissel </span>",
                icon: 'info',
                html: `
                <a href="https://www.bmb.gv.at/Themen/schule/zrp/dibi/foss.html" target="_blank"><img style="width: 230px; opacity:1;" src="./BMB_Logo_srgb.png"></a>
                <br>
                <br>
                <a href="https://linux-bildung.at" target="_blank"><img style="width: 50px; opacity:0.7;" src="./osos.svg"></a>   <br>
                <span style="font-size:0.8em"> <a href="https://next-exam.at" target="_blank">next-exam.at</a> </span> <br>
                <span style="font-size:0.8em">Version: ${this.version} ${this.info}</span> <br>
                <span style="font-size:0.8em">Build: ${this.buildDate}</span>
                `,
                didOpen: () => {

                },
                didRender: () => {
                    document.getElementById('cpleft').onclick = () => this.easter();
                }
            })
        },
        easter() {
            if (this.biptest) {
                this.biptest = false
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
            } else {
                this.biptest = true
                document.getElementById('cpleft').classList.toggle('active');
                document.getElementById('cpleft').classList.toggle('inactive');
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


        async bipAutoUpdate() {
            if (this.bipToken) {
                this.username = this.bipUsername
                await this.fetchBipExams()
                if (!this.token) {
                    this.bipAutoconnect()
                }
            } else {
                this.onlineExams = []
            }
        }

    },
    async mounted() {
        document.querySelector("#statusdiv").style.visibility = "hidden";

        // 2️⃣ Timer
        this.autoSchedulerService(() => {
          console.log('The interval still runs');
        }, 1000);

// this.lastFrameTime = performance.now(); // Initialize timing

// const checkFrameGap = () => {
//   const currentTime = performance.now(); // Get high-res timestamp
//   const delta = currentTime - this.lastFrameTime; // Calculate time since last frame


//   if (delta > 200) { // Threshold for macOS occlusion/suspension

//     this.$swal({
//       title: 'Ausbruch erkannt!',
//       text: `Die App wurde für ${Math.round(delta)}ms unterbrochen.`,
//       icon: 'warning',
//       confirmButtonText: 'Verstanden'
//     });
//   }

//   this.lastFrameTime = currentTime; // Update last frame reference
//   requestAnimationFrame(checkFrameGap); // Schedule next frame check
// };

// requestAnimationFrame(checkFrameGap); // Start the loop


        this.isLoading = false;

        // Focus username input field when component is mounted
        this.$nextTick(() => {
            if (this.$refs.userInput && !this.bipToken) {
                this.$refs.userInput.focus();
            }

        });
       // Fetch info asynchronously without blocking
        this.fetchInfo();

        this.autoSchedulerService(this.fetchInfo, 4000);
        this.autoSchedulerService(this.bipAutoUpdate, 10000);

      // add event listener to user input field to supress all special 1chars
        this.autoEventListener(document.getElementById("user"), "keypress", function (e) {
          // var lettersOnly = /^[a-zA-Z ]+$/;
          var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
          var key = e.key || String.fromCharCode(e.which);
          if (!lettersOnly.test(key)) {
            e.preventDefault();
          }
        });

        // TODO: Modify windowhandling and token saving
        signalBridge.on('bipToken', (event, token) => {
            console.log("token received: ", token)
            this.bipToken = token
            this.fetchBiPData(token)
        });

        // Screenshot scheduler only in main window (this page); exam window never loads student.vue
        initScreenshotScheduler(signalBridge);

        // Set locale to system locale or fallback to 'en'
        const systemLocale = navigator.language.split('-')[0] // e.g. "de" from "de-DE"
        const locale = ['de', 'en'].includes(systemLocale) ? systemLocale : 'en' // Fallback to 'en'
        this.$i18n.locale = locale

    },
    beforeUnmount() {
      window.removeEventListener('unhandledrejection', unhandledRejectionFunction);
    }
}
</script>

<style>

.active {
    filter: contrast(100%) grayscale(100%) brightness(80%) !important;
}

.inactive {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px) !important;
}

/**in order to override swal settings the css needs to be global not scoped*/
.swal2-popup {
    opacity: 0.9 !important;
}

.swal2-container {
    backdrop-filter: blur(2px);
}

.my-select {
    margin-left: 2.3em !important;
    width: 439px !important;
    margin-top: 0px !important;
}

.swal2-container {
    z-index: 100001 !important;
}

</style>

<style scoped>

body {
    background-color: rgb(33, 37, 41) !important;
}

.nobutton {
    pointer-events: none;
}


.disabledbutton {
    /* intentionally left blank: class kept for compatibility */
}

.disabledexam {
    filter: contrast(100%) grayscale(100%) brightness(80%) blur(0.6px);
    pointer-events: none;
}

.disabledtext {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px);
    pointer-events: none;
}

#content {
    background-color: whitesmoke;
    min-width: 680px;
}

.infobutton {
    width: 224px;
    min-width: 224px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background-color: whitesmoke;
}


#statusdiv {
    display: block !important;
    width: 200px;
}

/* CSS classes for fade-in and fade-out */
.fade-in {
    animation: fadeInAnimation 2s;
}

.fade-out {
    animation: fadeOutAnimation 2s forwards; /* 'forwards' keeps the final state after the animation */
}

@keyframes fadeInAnimation {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes fadeOutAnimation {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
        visibility: hidden;
    }
}

</style>

