<template>


    <div v-if="enteringExamModeOverlay" class="exam-enter-backdrop">
        <div class="exam-enter-card">
            <div class="exam-enter-spinner" aria-hidden="true"></div>
            <div class="exam-enter-text">{{ $t('student.enteringExamMode') }}</div>
        </div>
    </div>

    <!-- Header START -->
    <div v-show="!isLoading" class="w-100 p-3 text-white bg-dark text-left" style="height: 66px; z-index: 1000;">
    <span class="text-white m-1 d-inline-flex align-items-center flex-wrap ms-1">
        <img src='/src/assets/img/svg/speedometer.svg' class="white me-2" width="32" height="32">
        <span class="fs-4 align-middle me-2" @click="handleClick">Next-Exam</span>
        <span v-if="cageLauncherApps.length" class="d-inline-flex align-items-center flex-wrap gap-2 cage-launcher-group">
            <button v-for="app in cageLauncherApps" :key="app.path" type="button"
                    class="btn btn-outline-cyan btn-sm mt-0 px-3"
                    @click="launchCageApp(app.path)">{{ app.name }}</button>
        </span>
    </span>

        <span class="fs-4 align-middle ms-3" style="float: right">Student</span>
        <div v-if="token && !localLockdown" id="adv" class="btn btn-success btn-sm m-0  mt-1 "
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
        <!-- LocalVM preflight overlay (must stay in student.vue; exam window opens only after checks pass) -->
        <div v-if="showLocalVmPreflightOverlay" class="localvm-preflight-backdrop">
            <div class="localvm-preflight-card">
                <div class="localvm-preflight-title">LocalVM</div>

                <div v-if="localVmIsVerifying" class="localvm-preflight-verify">
                    <div class="localvm-preflight-spinner" aria-hidden="true"></div>
                    <div class="localvm-preflight-text">{{ localVmVerifyingText }}</div>
                    <div class="localvm-preflight-subtext">{{ $t('student.vmVerifyingHashHint') }}</div>
                </div>

                <div v-else-if="localVmFixPhase === 'waiting_for_start'" class="localvm-preflight-text">
                    {{ $t('student.localvmFixWaitingForStart') }}
                </div>

                <div v-else-if="localVmIsMissing" class="localvm-preflight-text">
                    {{ $t('student.localvmMissingDisk') }}
                </div>

                <div v-else-if="localVmIsMismatch" class="localvm-preflight-text">
                    {{ $t('student.localvmDiskMismatch') }}
                </div>

                <div v-else class="localvm-preflight-text">
                    {{ $t('student.localvmStartError') }}
                </div>

                <div class="localvm-preflight-actions">
                    <button v-if="localVmCanRetryStart && !localVmFixPhase" class="btn btn-success btn-sm" @click="retryLocalVmStart" :disabled="localVmBusy">
                        {{ $t('student.localvmRetryStartButton') }}
                    </button>
                    <button v-if="localVmCanFix && !localVmFixPhase" class="btn btn-primary btn-sm" @click="downloadVm" :disabled="localVmBusy">
                        {{ $t('student.localvmDownloadButton') }}
                    </button>
                    <button v-if="localVmCanFix && !localVmFixPhase" class="btn btn-cyan btn-sm" @click="browseVm" :disabled="localVmBusy">
                        {{ $t('student.localvmBrowseButton') }}
                    </button>
                </div>

                <div v-if="localVmFixPhase && localVmCanFix && !localVmIsVerifying" class="localvm-preflight-verify" style="margin-top: 12px;">
                    <div class="localvm-preflight-spinner" aria-hidden="true"></div>
                    <div class="localvm-preflight-text">
                        {{ localVmFixPhase === 'waiting_for_start' ? $t('student.localvmWaitingForStart') : (localVmFixPhase === 'importing' ? $t('student.localvmImporting') : $t('student.localvmDownloading')) }}
                    </div>
                    <div v-if="localVmFixPhase !== 'waiting_for_start' && localVmDownloadPercent != null" class="localvm-preflight-subtext">{{ localVmDownloadPercent }}%</div>
                </div>
            </div>
        </div>

        <!-- SIDEBAR START -->
        <div class="p-3 text-white bg-dark h-100 student-sidebar" style="width: 240px; min-width: 240px;">
            <div class="btn btn-light ms-1 text-start infobutton nobutton">
                <img src='/src/assets/img/svg/server.svg' class="me-2" width="16" height="16"> {{ $t('student.exams') }}
            </div>
            <br>


            <div :class="(token)? 'disabledexam':''" class="form-check form-switch m-1 mb-2 mt-2">
                <input id="manualsearch" type="checkbox" v-model="advanced" class="form-check-input"
                       @change="toggleAdvanced">
                <label for="manualsearch" class="form-check-label">{{ $t('student.manualsearch') }}</label>
            </div>


            <!-- BIP Section START -->
            <div v-if="bipIntegration" class="mt-4">
                <span class="small m-1 me-0">{{ $t("student.bildungsportal") }}</span> <span v-if="bipToken"
                                                                                             class="small m-1 me-0 text-secondary">(verbunden)</span>
                <div v-if="bipToken" title="logout" id="biploginbutton" @click="logoutBiP()"
                     class="btn btn-success m-1 " :class="(token)? 'disabledexam':''" style="padding:0;">
                    <img id="biplogo"
                         style="filter: hue-rotate(140deg);  width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; "
                         src="/src/assets/img/login_students.jpg">
                    <span v-if="bipUsername" id="biploginbuttonlabel">{{ bipUsername }}</span>
                    <span v-else id="biploginbuttonlabel">Logout</span>
                </div>
                <div v-else id="biploginbutton" title="login" @click="loginBiP()" class="btn btn-info m-1 "
                     style="padding:0;" :class="(token)? 'disabledexam':''">
                    <img id="biplogo"
                         style="width:100%; border-top-left-radius:3px;border-top-right-radius:3px; margin:0; "
                         src="/src/assets/img/login_students.jpg">
                    <span v-if="bipUsername" id="biploginbuttonlabel">{{ bipUsername }}</span><span v-else
                                                                                                    id="biploginbuttonlabel">Login</span>
                </div>
            </div>
            <!-- BIP Section END -->


            <div @click="setupLocalLockdown()" class="btn btn-sm btn-outline-secondary ms-1 mt-3 mb-1"
                 :class="(token)? 'disabledexam':''" style="font-size:0.9em"> {{ $t("student.localLockdown") }}
            </div>
            <button v-if="showCageKioskInstallBtn"
                    type="button"
                    class="btn btn-sm btn-outline-secondary ms-1 mb-4 d-block"
                    :class="(token) ? 'disabledexam' : ''"
                    :disabled="!!token"
                    style="font-size:0.9em"
                    :title="$t(kioskI18n('Text'))"
                    @click="promptCageKioskSetup">
                {{ $t(kioskI18n('Button')) }}
            </button>

            <div><br>
                <div id="statusdiv" class="btn btn-warning m-1"></div>
            </div>
            <br>

            <div class="sidebar-bottom-btns ms-3">
                <button type="button" class="btn btn-outline-secondary btn-sm sidebar-locale-btn ms-1"
                        @click="toggleLocale">{{ inactivelocale }}
                </button>
                <button type="button"
                        class="btn btn-outline-danger btn-sm sidebar-exit-btn"
                        :class="token ? 'disabledexam' : ''"
                        :disabled="!!token"
                        :title="$t('student.cageExit')" :aria-label="$t('student.cageExit')"
                        @click="quitNextExam">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
                        <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
                    </svg>
                </button>
            </div>

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
                    <input ref="userInput" :value="username" @input="onUsernameInput" @paste.prevent @drop.prevent type="text"
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
                            <img v-if="!server.reachable" src="/src/assets/img/svg/emblem-warning.svg"
                                 :title="$t('student.unreachable')"
                                 style="width:20px;height:20px;vertical-align:top;cursor: help;position: absolute; margin-top:8px; margin-left:8px; ">


                            <div v-if="!token" style="margin-top:2px; padding:0px; ">
                                <!-- not logged in, no bip server --> <input v-if="!server.bip" style="width:200px;"
                                                                             :id="server.servername" type="button"
                                                                             name="register" class="btn btn-sm btn-info"
                                                                             :value="$t('student.register')"
                                                                             @click="registerClient(server.serverip,server.servername)">
                                <!-- not logged in, bip server, BiP required --> <input v-if="server.bip && server.requireBiP" style="width:200px;"
                                                                                       :id="server.servername" type="button"
                                                                                       name="register" class="btn btn-sm btn-secondary"
                                                                                       value="restricted"/>
                                <!-- not logged in, bip server, exam closed/offline (only if not restricted) --> <input v-if="server.bip && !server.requireBiP && server.examStatus && server.examStatus !== 'open'" style="width:200px;"
                                                                                                                      :id="server.servername" type="button"
                                                                                                                      name="register" class="btn btn-sm btn-secondary"
                                                                                                                      :value="server.examStatus"/>
                                <!-- not logged in, bip server, BiP NOT required --> <input v-if="server.bip && !server.requireBiP && (!server.examStatus || server.examStatus === 'open')" style="width:200px;"
                                                                                           :id="server.servername" type="button"
                                                                                           name="register" class="btn btn-sm btn-info"
                                                                                           :value="$t('student.register')"
                                                                                           @click="registerClient(server.serverip,server.servername)">
                            </div>
                            <div v-if="token" style="margin-top:2px; padding:0px;">
                                <!-- logged in, not on this server --> <input
                                v-if="clientinfo.servername !== server.servername && !server.bip" style="width:200px;"
                                :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-secondary"
                                :value="server.examStatus ? server.examStatus : $t('student.register')"/>
                                <!-- logged in, not on this server, bip server --> <input
                                v-if="clientinfo.servername !== server.servername && server.bip"
                                style="width:200px;" :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-secondary"
                                :value="server.examStatus ? server.examStatus : (server.requireBiP ? 'restricted' : $t('student.register'))"/>
                                <!-- logged in, on this server       --> <input
                                v-if="clientinfo.servername === server.servername" style="width:200px;"
                                :id="server.servername" disabled type="button" name="register"
                                class="btn btn-sm btn-success" :value="$t('student.registered')"/>
                            </div>

                        </div>

                    </div>

                    <div v-if="serverlist.length === 0"><h6 class="text-muted ms-1">{{ $t('student.noexams') }}</h6>
                    </div>
                </div>
            </div>

        </div>
    </div>


</template>

<script lang="ts">
import validator, {isEmpty} from 'validator'
import log from 'electron-log/renderer'
import {SchedulerService} from '../utils/schedulerservice.js'
import {isElectronWindow} from "../types/platform.ts";
import {SignalBridge} from '../utils/signalBridge.js'
import { initScreenshotScheduler, hasActiveScreenshotStream, isFullDesktopCaptureLikely, ensureDisplayStreamAsync, setCageWindowCaptureFallback, setLinuxKioskRunningInCage, isCageWindowCaptureFallback } from '../utils/screenshotCapture.js'
import { getLinuxKioskInfo } from '../utils/linuxCageKiosk.js'
import { loadWinKioskLauncherApps } from '../utils/kioskLauncher.js'
import { Exam } from '../types/api'
import { examApiFetch } from 'next-exam-shared/examApiFetch.js'
import { normalizeStudentClientName } from 'next-exam-shared/normalizeStudentClientName.js'
import {
    applyClientinfoFromFetch,
    applyServerstatusFromFetch,
} from '../utils/examFetchInfoSync.js'
import { autoCleanupMixin } from "../mixins/autoCleanupMixin.ts";
import { useConfigStore } from "stores/configStore.ts";
import { ref } from 'vue';
import { showLocalVmQemuIssueDialog } from 'next-exam-shared/qemuLocalVmDialogs.js'

function unhandledRejectionFunction(event: PromiseRejectionEvent) {
  const reason = event?.reason;
  const msg = typeof reason === 'string' ? reason : reason && reason.message;
  if (msg && (msg.includes('GUEST_VIEW_MANAGER_CALL') || msg.includes('ERR_FAILED'))) {
    event.preventDefault(); // swallow guest view clone errors and ERR_FAILED
    return;
  }
  log.error('Unhandled promise rejection:', reason); // log all other errors
}


// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', event => unhandledRejectionFunction(event));

Object.assign(console, log.functions);  // Replace all console logs with logger

// signalBridge instance centralizes ipc send calls with platform checks
const signalBridge = new SignalBridge(window);

export default {
    mixins: [autoCleanupMixin],

    setup() {
      const configStore = useConfigStore();
      const username = ref(configStore.development ? "thomas" : "");
      const pincode = ref(configStore.development ? "1111" : "");
      let development = ref(configStore.development);
      let version = ref(configStore.version);
      let serverApiPort = ref(configStore.serverApiPort);
      let electron = ref(configStore.electron);
      let info = ref(configStore.info);
      let buildDate = ref(configStore.buildDate);
      let hostip = ref(configStore.hostIp);
      let bipIntegration = ref(configStore.bipIntegration);
      let bipApiUrl = ref(configStore.bipApiUrl);
      let bipDemo = ref(configStore.bipDemo);
      return { username, pincode, development, version, serverApiPort, electron, info, buildDate, hostip, bipIntegration, bipApiUrl, bipDemo };
    },

    data() {
        return {
            token: "",
            clientinfo: {},
            serverstatus: null,
            serverlist: [],
            serverlistAdvanced: [],
            fetchinterval: null as SchedulerService,
            autoUpdateInterval: null as SchedulerService,
            startExamEvent: null,
            advanced: false,
            serverip: "" as string,
            servername: "",
            clickCount: 0,
            networkerror: false,
            localLockdown: false,
            isLoading: true,
            enteringExamModeOverlay: false,
            platformKiosk: {
                cageInstalled: false,
                runningInCage: false,
                isWindowsKioskUser: false,
                assignedAccessActive: false,
                cageKioskAppImageInstalled: false,
                cageKioskDesktopInstalled: false,
                needsCageKioskSetup: false,
            },
            cageLauncherApps: [],

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
            localVmBusy: false,
            localVmDownloadPercent: null,
            localVmFixPhase: null,
            localVmCompatCheckSwalOpen: false,

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
        },

        showLocalVmPreflightOverlay() {
            const st = this.clientinfo?.localVMState;
            const inPreflightState = st === 'missing' || st === 'hash_mismatch' || st === 'verifying_hash' || st === 'error';
            return !!this.token && !this.clientinfo?.exammode && this.clientinfo?.examtype === 'localvm' && inPreflightState;
        },
        localVmIsMissing() {
            return this.clientinfo?.localVMState === 'missing';
        },
        localVmIsMismatch() {
            return this.clientinfo?.localVMState === 'hash_mismatch';
        },
        localVmIsVerifying() {
            return this.clientinfo?.localVMState === 'verifying_hash';
        },
        localVmCanFix() {
            return this.localVmIsMissing || this.localVmIsMismatch || this.clientinfo?.localVMState === 'error';
        },
        localVmCanRetryStart() {
            return this.clientinfo?.localVMState === 'error' && !!this.serverstatus?.exammode;
        },
        localVmVerifyingText() {
            const cfg = this.getLocalVmConfig?.() || {};
            return cfg.calculateSha256 === true ? this.$t('student.vmVerifyingHash') : this.$t('student.vmVerifyingSize');
        },
        showCageKioskInstallBtn() {
            const k = this.platformKiosk;
            // displayServer set to 'windows' on win32 by ipchandler so the same gate works for both OSes
            return isElectronWindow(window) && k.displayServer !== 'n/a' && !k.runningInCage && k.needsCageKioskSetup;
        },
        kioskI18nPrefix() {
            // win32 uses winKioskSetup* keys, linux keeps the legacy cageSetup* keys
            return this.platformKiosk?.displayServer === 'windows' ? 'winKioskSetup' : 'cageSetup';
        },
    },
    watch: {
        'clientinfo.localVMState'(nextState) {
            const st = String(nextState || '');
            if (st !== 'checking_compat') {
                this.closeLocalVmCompatCheckDialog();
            }
            const inPreflightState = st === 'missing' || st === 'hash_mismatch' || st === 'verifying_hash' || st === 'error';
            if (!inPreflightState) {
                this.localVmFixPhase = null;
                this.localVmDownloadPercent = null;
                this.localVmBusy = false;
            }
        },
    },


    methods: {
        // Lowercase on input; :value not v-model so v-model cannot overwrite from DOM after normalize.
        onUsernameInput(event) {
            const el = event.target;
            const normalized = normalizeStudentClientName(el.value);
            if (this.username !== normalized) {
                this.username = normalized;
            }
            if (el.value !== normalized) {
                const pos = el.selectionStart;
                el.value = normalized;
                const nextPos = pos != null ? Math.min(pos, normalized.length) : normalized.length;
                el.setSelectionRange(nextPos, nextPos);
            }
        },

        async showQemuMissingWarning(payload = {}) {
            this.closeLocalVmCompatCheckDialog();
            await showLocalVmQemuIssueDialog({
                swal: this.$swal,
                t: this.$t.bind(this),
                invoke: (channel, ...args) => signalBridge.invoke(channel, ...args),
                i18nPrefix: 'student',
                check: payload || {},
                cancelKey: 'cancel',
            });
        },

        // Swal while main runs QEMU / hypervisor compatibility probes before LocalVM exam start.
        showLocalVmCompatCheckDialog() {
            if (this.localVmCompatCheckSwalOpen) {
                return;
            }
            this.localVmCompatCheckSwalOpen = true;
            const text = String(this.$t('student.localvmCompatCheckText') || '');
            void this.$swal.fire({
                title: this.$t('student.localvmCompatCheckTitle'),
                html: text.replace(/\n/g, '<br>'),
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    this.$swal.showLoading();
                },
            }).finally(() => {
                this.localVmCompatCheckSwalOpen = false;
            });
        },

        closeLocalVmCompatCheckDialog() {
            try {
                if (this.$swal.isVisible()) {
                    this.$swal.close();
                }
            } catch (e) {}
            this.localVmCompatCheckSwalOpen = false;
        },

        kioskI18n(suffix) {
            // helper: prefix=cageSetup on linux, winKioskSetup on windows; falls back to cage key for shared suffixes
            const key = `student.${this.kioskI18nPrefix}${suffix}`;
            // i18n returns the key itself when missing -> fallback to cage variant
            const t = this.$t(key);
            return t === key ? `student.cageSetup${suffix}` : key;
        },

        async promptCageKioskSetup() {
            // linux uses cageSetupTextRoot, win32 uses winKioskSetupRoot; pick whichever exists
            const rootHintKey = this.platformKiosk?.displayServer === 'windows'
                ? 'student.winKioskSetupRoot'
                : 'student.cageSetupTextRoot';
            const result = await this.$swal.fire({
                title: this.$t(this.kioskI18n('Title')),
                html: `${this.$t(this.kioskI18n('Text'))}<br><br>${this.$t(rootHintKey)}<br><br>
                    <label><input type="checkbox" id="cage-setup-dismiss"> ${this.$t(this.kioskI18n('DontShow'))}</label>`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: this.$t(this.kioskI18n('Install')),
                cancelButtonText: this.$t(this.kioskI18n('Later')),
                willClose: (popup) => {
                    if (popup.querySelector('#cage-setup-dismiss')?.checked) {
                        localStorage.setItem('next-exam-cage-kiosk-setup-dismissed', '1');
                    }
                },
            });
            if (!result.isConfirmed) return;
            const install = await signalBridge.invoke('install-linux-cage-kiosk');
            if (install?.ok) {
                this.platformKiosk = await signalBridge.invoke('get-platform-info');
                let successHtml = `${this.$t(this.kioskI18n('Success'))}<br><br>${this.$t(this.kioskI18n('SuccessHint'))}`;
                if (install.kioskSourceDir && this.platformKiosk?.displayServer === 'windows') {
                    const src = this.$t('student.winKioskSetupSuccessSource', {
                        appDir: install.kioskSourceDir,
                        launchExe: install.kioskLaunchExe || '',
                    });
                    successHtml += `<br><br><small style="font-family:monospace;word-break:break-all;">${src}</small>`;
                }
                await this.$swal.fire({
                    html: successHtml,
                    icon: 'success',
                });
            } else {
                await this.showKioskSetupErrorDialog(install);
            }
        },

        // Pretty error: structured code from main triggers friendly hint; otherwise mono-font scrollable transcript
        async showKioskSetupErrorDialog(install) {
            const raw = String(install?.error || '');
            if (install?.code === 'EDITION_UNSUPPORTED') {
                await this.$swal.fire({
                    icon: 'warning',
                    title: this.$t('student.winKioskSetupEditionFailed'),
                    html: this.$t('student.winKioskSetupEditionHint'),
                    confirmButtonText: 'OK',
                });
                return;
            }
            const escaped = raw
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            await this.$swal.fire({
                icon: 'error',
                title: this.$t(this.kioskI18n('Failed')),
                html: `<pre style="text-align:left;max-height:50vh;overflow:auto;font-size:0.8em;white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:0.5rem;border-radius:4px;">${escaped}</pre>`,
                confirmButtonText: 'OK',
                width: '46rem',
            });
        },

        async maybeOfferCageKioskSetup() {
            const k = this.platformKiosk;
            if (!isElectronWindow(window) || this.development) return;
            if (k.runningInCage || !k.needsCageKioskSetup) return;
            if (localStorage.getItem('next-exam-cage-kiosk-setup-dismissed') === '1') return;
            await this.promptCageKioskSetup();
        },

        async maybeShowWinKioskSessionInfo() {
            const k = this.platformKiosk;
            if (!isElectronWindow(window) || this.development) return;
            if (!k.runningInCage || k.displayServer !== 'windows') return;
            if (this.activeDialog) return;
            if (sessionStorage.getItem('next-exam-win-kiosk-session-info') === '1') return;
            if (this.hostip?.availableInterfaces?.length > 1 && !this.hostip?.preferredInterface) return;
            sessionStorage.setItem('next-exam-win-kiosk-session-info', '1');
            await this.$swal.fire({
                title: this.$t('student.winKioskSessionInfoTitle'),
                html: this.$t('student.winKioskSessionInfoText'),
                icon: 'info',
                confirmButtonText: this.$t('general.ok'),
                showCancelButton: false,
            });
        },

        async launchCageApp(exePath) {
            const p = String(exePath || '').trim();
            if (!p) return;
            const res = await signalBridge.invoke('launch-kiosk-allowed-app', p);
            if (res?.ok) return;
            this.$swal.fire({ title: 'Error', text: res?.error || 'launch failed', icon: 'error', showCancelButton: false });
        },

        async warnMacRosettaArch() {
            await this.$swal.fire({
                title: this.$t('student.macRosettaArchTitle'),
                html: this.$t('student.macRosettaArchText'),
                icon: 'warning',
                confirmButtonText: this.$t('student.macRosettaArchOk'),
            });
        },

        quitNextExam() {
            if (this.token) return;
            // Kiosk: main-process close handler shows the native cage exit warning (single source of truth).
            // Non-kiosk: simple inline confirm.
            if (this.platformKiosk?.runningInCage) {
                signalBridge.invoke('quit-app');
                return;
            }
            this.$swal.fire({
                title: this.$t('student.cageExit'),
                html: this.$t('student.cageExitConfirm'),
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: this.$t('student.cageExit'),
                cancelButtonText: this.$t('dashboard.cancel'),
            }).then((result) => {
                if (result.isConfirmed) signalBridge.invoke('quit-app');
            });
        },

        toggleLocale() {
            // Switch between 'de' and 'en'
            this.$i18n.locale = this.$i18n.locale === 'de' ? 'en' : 'de';
            signalBridge.send('set-new-locale', this.$i18n.locale);
        },

        async selectPreferredInterface() {
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
                    this.safeAssignHostip(updated);
                }
                this.activeDialog = false;
                void this.maybeShowWinKioskSessionInfo();
            });
        },

        reconfigurePreferredInterface() {
            if (this.token) return;
            this.activeDialog = false;
            this.selectPreferredInterface();
        },

        async loginBiP() {

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
                    signalBridge.invoke('clearBipSiteInfo')
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
            if (this.bipDemo) {
                return this.bipApiUrl;
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
                        const displayName = normalizeStudentClientName(response.fullname)
                        this.$swal.fire({
                            title: "BiP Response",
                            html: `${this.$t('student.bipLoginConnected')}<br>${this.$t('student.bipLoginWelcome', { name: displayName })}`,
                            icon: 'info',
                            showCancelButton: false,
                        })

                        this.bipUsername = displayName
                        this.bipuserID = response.userid
                        if (response.userprivateaccesskey) {
                            await signalBridge.invoke('setBipSiteInfo', {
                                userprivateaccesskey: response.userprivateaccesskey,
                                userid: response.userid,
                                fullname: response.fullname,
                            })
                            signalBridge.invoke('prewarmSubmissionSigningP12').catch(() => {})
                        }

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
                            <span class="input-group-text col-3" style="width:175px;">${this.$t("student.username")} </span>
                            <input class="form-control" type=text id=localuser placehoder='Username' style="width:200px;">
                        </div>
                        <div class="input-group m-1 mb-1">
                            <span class="input-group-text col-3" style="width:175px;">${this.$t("student.password")}</span>
                            <input class="form-control" type=password id=localpassword placeholder='Passwort' style="width:200px;">
                        </div>
                        <div class="input-group m-1 mb-1">
                            <span class="input-group-text col-3" style="width:175px;">${this.$t("student.passwordconfirm")}</span>
                            <input class="form-control" type=password id=localpasswordconfirm placeholder='Passwort' style="width:200px;">
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
                didOpen:() => {
                    const localUserElement = document.getElementById("localuser");
                    const localPasswordElement = document.getElementById("localpassword");
                    const localPasswordConfirmElement = document.getElementById("localpasswordconfirm");

                    this.autoEventListener(localUserElement,"input", () => {
                        const normalized = normalizeStudentClientName(localUserElement.value);
                        if (normalized !== localUserElement.value) {
                            localUserElement.value = normalized;
                        }
                    });

                  this.autoEventListener(localUserElement,"keypress", function(e) {
                         // var lettersOnly = /^[a-zA-Z ]+$/;
                        var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
                        var key = e.key || String.fromCharCode(e.which);
                        // Allow Enter key to pass through
                        if (e.key === 'Enter') { return; }
                        if (!lettersOnly.test(key)) { e.preventDefault(); }
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
                    this.autoEventListener(document,"keydown", handleEnterKey);
                    // Add listener directly to input fields to catch Enter when focused
                    this.autoEventListener(localUserElement,"keydown", handleEnterKey);
                    this.autoEventListener(localPasswordElement,"keydown", handleEnterKey);
                    this.autoEventListener(localPasswordConfirmElement,"keydown", handleEnterKey);

                    // Store handler reference for cleanup (will be cleaned up when dialog closes)
                    this._enterKeyHandler = handleEnterKey;
                    this._enterKeyHandlerUser = handleEnterKey;
                    this._enterKeyHandlerPassword = handleEnterKey;
                    this._enterKeyHandlerPasswordConfirm = handleEnterKey;
                    
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

                    // Event listener for checkboxLT to adjust the state of checkboxsuggestions
                  this.autoEventListener(checkboxLT,"change", () => {
                        checkboxSuggestions.disabled = !checkboxLT.checked;
                        // When checkboxLT is unchecked, suggestions should also be reset:
                        if (!checkboxLT.checked) {
                            checkboxSuggestions.checked = false;
                        }
                    });

                    // Event listener for radio buttons to show/hide the spellcheck section
                    this.autoEventListener(editorRadio, "change", toggleSpellcheckSection);
                    this.autoEventListener(mathRadio, "change", toggleSpellcheckSection);

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
                    const localPasswordConfirmElement = document.getElementById("localpasswordconfirm");
                    if (localUserElement && this._enterKeyHandlerUser) {
                        localUserElement.removeEventListener('keydown', this._enterKeyHandlerUser);
                        this._enterKeyHandlerUser = null;
                    }
                    if (localPasswordElement && this._enterKeyHandlerPassword) {
                        localPasswordElement.removeEventListener('keydown', this._enterKeyHandlerPassword);
                        this._enterKeyHandlerPassword = null;
                    }
                    if (localPasswordConfirmElement && this._enterKeyHandlerPasswordConfirm) {
                        localPasswordConfirmElement.removeEventListener('keydown', this._enterKeyHandlerPasswordConfirm);
                        this._enterKeyHandlerPasswordConfirm = null;
                    }
                },
                preConfirm: () => {
                    // Save all input values before dialog closes (Electron 39 compatibility)
                    const localUserElement = document.getElementById('localuser');
                    const localPasswordElement = document.getElementById('localpassword');
                    const localPasswordConfirmElement = document.getElementById('localpasswordconfirm');
                    const checkboxLTElement = document.getElementById('checkboxLT');
                    const checkboxSuggestionsElement = document.getElementById('checkboxsuggestions');
                    const radioButtons = document.querySelectorAll('input[name="etesttype"]');

                    savedUsername = localUserElement ? normalizeStudentClientName(localUserElement.value) : '';
                    savedPassword = localPasswordElement ? localPasswordElement.value : '';
                    const passwordConfirm = localPasswordConfirmElement ? localPasswordConfirmElement.value : '';
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
                        this.$swal.showValidationMessage(this.$t("student.nopassword") || 'Password is required');
                        return false;
                    }
                    if (savedPassword !== passwordConfirm) {
                        this.$swal.showValidationMessage(this.$t("student.pwdmismatch") || 'Passwords do not match');
                        return false;
                    }
                }
            }).then((result) => {
                if (result.isConfirmed) {

                    let exammode = savedExammode; // Use saved value instead of reading from DOM
                    let username = normalizeStudentClientName(savedUsername);
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


        // Restore name/pin inputs from main-process clientinfo after remount while still connected.
        syncLoginFieldsFromClientinfo() {
            if (!this.token || this.token === '0000') return;
            const name = this.clientinfo?.name;
            const pin = this.clientinfo?.pin;
            if (name && this.username !== name) this.username = name;
            if (pin != null && pin !== '' && String(this.pincode) !== String(pin)) {
                this.pincode = String(pin);
            }
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

        // checkhostip returns a new object each poll — compare fields, not reference
        safeAssignHostip(newHostip) {
            const cur = this.hostip;
            if (!cur && !newHostip) return;
            const curIp = cur && typeof cur === 'object' ? cur.hostip : cur;
            const newIp = newHostip && typeof newHostip === 'object' ? newHostip.hostip : newHostip;
            if (curIp !== newIp) {
                this.hostip = newHostip;
                return;
            }
            if (typeof cur !== 'object' || typeof newHostip !== 'object') return;
            if ((cur.interface || '') !== (newHostip.interface || '')) {
                this.hostip = newHostip;
                return;
            }
            if ((cur.preferredInterface || '') !== (newHostip.preferredInterface || '')) {
                this.hostip = newHostip;
                return;
            }
            if (JSON.stringify(cur.availableInterfaces || []) !== JSON.stringify(newHostip.availableInterfaces || [])) {
                this.hostip = newHostip;
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
                !!server1.requireBiP === !!server2.requireBiP &&
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
                    if (typeof exam.requireBiP !== 'undefined' && !!existingInNewList.requireBiP !== !!exam.requireBiP) {
                        existingInNewList.requireBiP = !!exam.requireBiP;
                    }
                } else if (existingInCurrentList) {
                    const updatedServer = {
                        ...existingInCurrentList,
                        examStatus: exam.examStatus,
                        ...(typeof exam.requireBiP !== 'undefined' ? { requireBiP: !!exam.requireBiP } : {}),
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
                        requireBiP: typeof exam.requireBiP !== 'undefined' ? !!exam.requireBiP : false,
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


            applyClientinfoFromFetch(this, getinfo.clientinfo);
            this.syncLoginFieldsFromClientinfo();
            applyServerstatusFromFetch(this, getinfo.serverstatus || null);

            if (getinfo.clientinfo.exammode) {
                return;
            }  // do not stress ui updates if exammode is active

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
                            this.status("Searching for exams...")
                        }
                        examApiFetch(`https://${this.serverip}:${this.serverApiPort}/server/control/serverlist`)
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
                            log.error(`student.vue @ fetchInfo (advanced): ${err.message}`);
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
            this.safeAssignHostip(newHostip);
            const hasIp = this.hostip && (typeof this.hostip === 'object' ? this.hostip.hostip : this.hostip);
            if (!hasIp) return;
            if (this.hostip?.availableInterfaces?.length > 1 && !this.hostip?.preferredInterface) {
                this.selectPreferredInterface();
            } else {
                void this.maybeShowWinKioskSessionInfo();
            }
            if (this.clientinfo.token) return;   // stop spamming the api if already connected


            /**
             * Optimized: Check if server is still alive otherwise mark with attention sign
             * This is done by pinging the server with a timeout of 2 seconds
             * Only set server.reachable if the value actually changes
             * For manually added servers: remove after more than 2 failures
             */
            for (let server of this.serverlist) {
                //log.info(`student.vue @ fetchinfo: checking server ${server.servername} (${server.serverip})`)
                if (!server.serverip) continue;
                const serverIdentifier = this.getServerIdentifier(server);
                const isManual = this.isManuallyAddedServer(server);
                const signal = AbortSignal.timeout(4000); // 4000 milliseconds = 4 seconds
                examApiFetch(`https://${server.serverip}:${this.serverApiPort}/server/control/pong`, {
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

        getLocalVmConfig() {
            const sectionIndex = Number(this.clientinfo?.lockedSection || 1);
            const section = this.serverstatus?.examSections?.[sectionIndex] || {};
            const group = this.clientinfo?.group === 'b' ? 'b' : 'a';
            const cfg = group === 'b' ? (section?.groupB?.examConfig?.localvm || {}) : (section?.groupA?.examConfig?.localvm || {});
            return cfg || {};
        },

        async retryLocalVmStart() {
            if (this.localVmBusy) return;
            try {
                this.localVmBusy = true;
                this.localVmFixPhase = null;
                const res = await signalBridge.invoke('localvm-retry-start');
                if (!res?.ok) {
                    await this.status(this.$t('student.localvmStartError'));
                }
            } catch (e) {
                log.error('student.vue @ retryLocalVmStart', e);
                await this.status(this.$t('student.localvmStartError'));
            } finally {
                this.localVmBusy = false;
            }
        },

        async downloadVm() {
            if (this.localVmBusy) return;
            try {
                this.localVmBusy = true;
                this.localVmDownloadPercent = null;
                this.localVmFixPhase = 'downloading';
                const cfg = this.getLocalVmConfig();
                const filename = cfg.qcow2Name;
                const overwrite = this.clientinfo?.localVMState === 'hash_mismatch';
                if (!filename) {
                await this.status(this.$t('student.localvmNoVmConfigured'));
                    return;
                }
            await this.status(this.$t('student.localvmDownloadingFromTeacher'));
                const res = await signalBridge.invoke('qemu-download-disk', {
                    serverip: this.clientinfo?.serverip,
                    serverApiPort: this.serverApiPort,
                    servername: this.clientinfo?.servername,
                    studenttoken: this.token,
                    filename,
                    overwrite
                });
                if (!res || !res.ok) {
                await this.status(this.$t('student.localvmDownloadFailed'));
                    this.localVmFixPhase = null;
                    return;
                }
            await this.status(this.$t('student.localvmDownloadDoneWaiting'));
                this.localVmFixPhase = 'waiting_for_start';
            } catch (e) {
                log.error('student.vue @ downloadVm', e);
            await this.status(this.$t('student.localvmDownloadFailed'));
                this.localVmFixPhase = null;
            } finally {
                this.localVmBusy = false;
                if (this.localVmFixPhase !== 'waiting_for_start') {
                    this.localVmDownloadPercent = null;
                }
            }
        },

        async browseVm() {
            if (this.localVmBusy) return;
            try {
                this.localVmBusy = true;
                const pick = await signalBridge.invoke('qemu-pick-disk-file');
                if (!pick?.ok || pick.cancelled) {
                    await this.status(this.$t('student.localvmImportCancelled'));
                    this.localVmFixPhase = null;
                    return;
                }
                this.localVmFixPhase = 'importing';
                this.localVmDownloadPercent = null;
                const res = await signalBridge.invoke('qemu-import-disk', { sourcePath: pick.sourcePath });
                const filename = res && res.ok ? res.filename : null;
                if (!filename) {
                    await this.status(this.$t('student.localvmImportFailed'));
                    this.localVmFixPhase = null;
                    return;
                }
                await this.status(this.$t('student.localvmImportDoneWaiting', { filename }));
                this.localVmFixPhase = 'waiting_for_start';
            } catch (e) {
                log.error('student.vue @ browseVm', e);
                await this.status(this.$t('student.localvmImportFailed'));
                this.localVmFixPhase = null;
            } finally {
                this.localVmBusy = false;
                if (this.localVmFixPhase !== 'waiting_for_start') {
                    this.localVmDownloadPercent = null;
                }
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
            // capturePage path (macOS + Linux Cage) was already selected at init via setCageWindowCaptureFallback;
            // Win32 AssignedAccess and plain desktop use getDisplayMedia.
            if (!isCageWindowCaptureFallback()) {
                if (!hasActiveScreenshotStream()) {
                    const ok = await ensureDisplayStreamAsync();
                    if (!ok) {
                        this.$swal.fire({ title: "Error", text: this.$t("student.screenshotpermission"), icon: 'error', showCancelButton: false });
                        return;
                    }
                }
                // Win AA kiosk auto-grants sources[0]=screen via main-process handler, so the picker-misclick
                // heuristic does not apply; skip the check there.
                const winKiosk = this.platformKiosk.runningInCage && this.platformKiosk.displayServer === 'windows';
                if (!winKiosk && !isFullDesktopCaptureLikely() && !this.development) {
                    this.$swal.fire({ title: "Error", text: this.$t("student.screenshotarea"), icon: 'error', showCancelButton: false });
                    return;
                }
            }
            const displayInfo = await signalBridge.invoke('getinfoasync');
            if (displayInfo?.clientinfo?.multiMonitor && !this.development) {
                this.$swal.fire({ title: "Error", text: this.$t("student.multimonitor"), icon: 'error', showCancelButton: false });
                return;
            }

            const charMap = {
                    'ć': 'c',
                    'č': 'c',
                    'š': 's',
                    'ž': 'z',
                    'đ': 'd',
                    // Add more mappings as needed
                };


                //check username - remove leading and trailing spaces
                this.username = normalizeStudentClientName(
                    this.username
                        .replace(/[^\x00-\x7F]/g, char => charMap[char] || char)
                );


                //  console.log({clientname:this.username, servername:servername, serverip, serverip, pin:this.pincode, bipuserID:this.bipuserID })
                let IPCresponse = signalBridge.sendSync('register', {
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
                    const okBody = IPCresponse.reconnected ? this.$t("student.reconnectedinfo") : this.$t("student.registeredinfo")
                    this.$swal.fire({
                        title: "OK",
                        html: `<div style="white-space: pre-line;">${okBody}</div>`,
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
        this.isLoading = false;

        if (isElectronWindow(window)) {
            if (!this.development) {
                const macArch = await signalBridge.invoke('get-mac-arch-info');
                if (macArch?.runningUnderRosetta) {
                    await this.warnMacRosettaArch();
                }
            }
            this.platformKiosk = await getLinuxKioskInfo(signalBridge);
            setLinuxKioskRunningInCage(this.platformKiosk.runningInCage);
            // capturePage path (no getDisplayMedia/picker): macOS always, plus Linux Cage. Win32 kiosk uses normal full-desktop getDisplayMedia.
            const isMac = this.platformKiosk.platform === 'darwin';
            const linuxCage = this.platformKiosk.runningInCage && this.platformKiosk.displayServer !== 'windows';
            setCageWindowCaptureFallback(isMac || linuxCage);
            this.cageLauncherApps = await loadWinKioskLauncherApps(signalBridge);
            await this.maybeOfferCageKioskSetup();
        }

        await this.fetchInfo();

        // Focus username only when not on BiP and not already connected to a teacher
        this.$nextTick(() => {
            if (this.$refs.userInput && !this.bipToken && !this.token) {
                this.$refs.userInput.focus();
            }
        });

        this.fetchinterval = this.autoSchedulerService(this.fetchInfo, 4000)

        this.autoUpdateInterval = this.autoSchedulerService(this.bipAutoUpdate, 10000)

        // add event listener to user input field to supress all special chars
        this.autoEventListener(document.getElementById("user"), "keypress", function (e) {
          // var lettersOnly = /^[a-zA-Z ]+$/;
          var lettersOnly = /^[a-zA-ZäöüÄÖÜß ]+$/;  //give some special chars for german a chance
          var key = e.key || String.fromCharCode(e.which);
          if (!lettersOnly.test(key)) {
            e.preventDefault();
          }
        });

        signalBridge.on('entering-exam-mode', () => {
            this.enteringExamModeOverlay = true;
        });

        signalBridge.on('bipToken', (event, token) => {
            console.log("token received: ", token)
            this.bipToken = token
            this.fetchBiPData(token)
        });

        signalBridge.on('qemu-download-progress', (_event, payload) => {
            const pct = payload && typeof payload.percent === 'number' ? payload.percent : null;
            this.localVmDownloadPercent = pct;
        });

        signalBridge.on('localvm-compat-check-start', () => {
            if (!this.clientinfo) {
                this.clientinfo = {};
            }
            this.clientinfo.examtype = 'localvm';
            this.clientinfo.localVMState = 'checking_compat';
            this.showLocalVmCompatCheckDialog();
        });

        signalBridge.on('localvm-compat-check-end', () => {
            if (this.clientinfo?.localVMState === 'checking_compat') {
                this.clientinfo.localVMState = null;
            }
            this.closeLocalVmCompatCheckDialog();
        });

        signalBridge.on('qemu-not-available', (_event, payload) => {
            this.showQemuMissingWarning(payload || {});
        });

        // Screenshot scheduler only in main window (this page); exam window never loads student.vue
        initScreenshotScheduler(signalBridge);

        // Set locale to system locale or fallback to 'en'
        const systemLocale = navigator.language.split('-')[0] // e.g. "de" from "de-DE"
        const locale = ['de', 'en'].includes(systemLocale) ? systemLocale : 'en' // Fallback to 'en'
        this.$i18n.locale = locale

    },
    beforeUnmount() {

        window.removeEventListener('unhandledrejection', event => unhandledRejectionFunction(event));

        signalBridge.removeAllListeners('qemu-download-progress');
        signalBridge.removeAllListeners('localvm-compat-check-start');
        signalBridge.removeAllListeners('localvm-compat-check-end');
        signalBridge.removeAllListeners('qemu-not-available');
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
    display: inherit;
}

.disabledexam {
    filter: contrast(100%) grayscale(100%) brightness(80%) blur(0.6px);
    pointer-events: none;
}

.disabledtext {
    filter: contrast(40%) grayscale(100%) brightness(130%) blur(0.6px);
    pointer-events: none;
}

.exam-enter-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
    z-index: 200001;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.exam-enter-card {
    background: rgba(33, 37, 41, 0.94);
    border-radius: 10px;
    padding: 22px 28px;
    text-align: center;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.exam-enter-spinner {
    width: 28px;
    height: 28px;
    margin: 0 auto;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: #0aa2c0;
    border-radius: 50%;
    animation: exam-enter-spin 0.85s linear infinite;
}

@keyframes exam-enter-spin {
    to { transform: rotate(360deg); }
}

.exam-enter-text {
    margin-top: 12px;
    font-size: 0.95rem;
    opacity: 0.92;
}

.localvm-preflight-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 200000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.localvm-preflight-card {
    width: 100%;
    max-width: 520px;
    border-radius: 10px;
    background: rgba(33, 37, 41, 0.95);
    color: #f8f9fa;
    padding: 16px 18px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    text-align: center;
}

.localvm-preflight-title {
    font-weight: 700;
    margin-bottom: 10px;
}

.localvm-preflight-verify {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
}

.localvm-preflight-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #93c5fd;
    border-radius: 50%;
    animation: localvm-preflight-spin 0.85s linear infinite;
}

@keyframes localvm-preflight-spin {
    to {
        transform: rotate(360deg);
    }
}

.localvm-preflight-text {
    font-size: 0.95em;
}

.localvm-preflight-subtext {
    font-size: 0.85em;
    color: rgba(248, 249, 250, 0.75);
}

.localvm-preflight-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
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

.cage-launcher-group {
    margin-left: 4.4rem;
}

.bg-dark .btn-outline-cyan {
    color: #fff;
}

.student-sidebar {
    position: relative;
}

.sidebar-bottom-btns {
    position: absolute;
    bottom: 32px;
    left: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

.sidebar-bottom-btns .btn {
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.125rem;
    line-height: 1;
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
}

.sidebar-bottom-btns .sidebar-locale-btn {
    line-height: 1;
}

.sidebar-bottom-btns .sidebar-exit-btn {
    width: 2.125rem;
    min-width: 2.125rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
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

