@memV1
RULE^agent^claudeMdFirst^first tool Read CLAUDE.md every session+subagent; @ attach ≠ Read; see .cursor/rules/00-read-claude-md-first.mdc+AGENTS.md
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates
IPC^teacher^writeTeacherWorkdirUtf8File^invoke({servername,filepath,utf8})→write UTF-8; basename must end _editor_timeline.json; servername must exist in examServerList^teacher ipchandler.js+studentEditorTimeline.js
PATH^dashboard^editorTimeline^teacher/src/utils/studentEditorTimeline.js + teacher/src/components/StudentEditorTimelineDiffViewer.vue; explorer button DashboardExplorer.vue; dashboard.vue wires @timeline-diff
TECH^dashboard^overlayZ^StudentView 4000; DashboardExplorer 4100; StudentEditorTimelineDiffViewer 1003 (below StudentView unless raised)
PATH^examlog^settings^examLogSettings.js snapshot on examstart→event.settings; ExamLog.vue UI+print; examEventBus.push meta.settings
BUG^examlog^dupSubmission^dashboard mounted stacked ipcRenderer.on('submission'); fix removeListener before on; examEventBus.push dedupe ≤1ms same type+student
TECH^exam^editorTimelineJson^workdir student folder `<Student>_editor_timeline.json` (listed in explorer); schema {version,kind,studentFolder,generatedAt,jsonPath,entries[{timestamp_name,timestamp,text,sourceHtm}]}
RULE^i18n^alphabetical^keep keys in teacher/src/locales/de.json+en.json alphabetically sorted within each object
RULE^i18n^intlifyPipe^vue-i18n/intlify treats | in messages as plural delimiter; literal pipe write {'|'}^teacher+student locales
RULE^dashboard^setupLogic^exam setup funcs live in teacher/src/utils/examsetup.js; dashboard.vue should mostly import+map
RULE^dashboard^kickStop^kick()+stopserver() getSubmissions+swal yellow banner only if activeSection examtype editor|activesheets; missing ABGABE PDF^teacher/src/utils/exammanagement.js
RULE^dev^noBackCompat^unstable dev; no legacy migrations/workarounds/backward-compat; schema breaks ok
TECH^quasar^vite^@quasar/app-vite bundles Vite 8; server.forwardConsole=false in student+teacher quasar.config.ts extendViteConf stops browser console.warn mirroring to dev terminal ([vite] client dupes)
TECH^vite^pdfjsLegacyAlias^student+teacher quasar extendViteConf resolve.alias pdfjs-dist/legacy/build/pdf.mjs+pdf.worker.mjs -> each app node_modules/pdfjs-dist/legacy/build/ (shared/pdfparser imports)^quasar.config.ts
RULE^ui^noJsWorkarounds^fix layout via CSS/layout first; no JS workaround for layout/scroll issues
RULE^agent^assumeUserEditsIntentional^never revert incidental diffs; assume user made changes intentionally unless explicitly asked
RULE^agent^gitSafety^never run git restore/reset/clean/rebase/stash/pop/checkout/switch unless user explicitly asks
RULE^agent^utils^noSingleUseFiles^never new file for one function solvable in ~2 lines at caller; colocate; reuse module only if 2+ call sites; after each new fn check minimize/inline/delete
PATH^linux^cageInstall^install-cage-kiosk.sh pkexec; needsCageKioskSetup=!(cage on PATH+AppImage+/opt/next-exam+desktop); UI if needsCageKioskSetup&&!runningInCage
RULE^agent^userEdits^never revert intentional user manual edits (e.g. removed v-if) unless user asks
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
TECH^teacherCli^examModes^--exam-modes=csv overrides config.exammodes at runtime^teacher/src-electron/electron-main.js
TECH^build^protectMain^electron-main.js in dist/electron/UnPackaged; protect via electron-builder beforePack^teacher+student scripts/protect-main.mjs+beforepack.js+quasar.config.ts
RULE^student^devtoolsInstaller^electron-devtools-installer devDep only; dynamic import in windowhandler installVueJsDevTools when !app.isPackaged—no top-level require^student/src-electron/main/scripts/windowhandler.js
TECH^build^electronAssets^prod electron: copy src/assets→public/src/assets; rewrite `/src/assets`→`./src/assets` incl. Vue backtick literals in generateBundle; CSS url() often Vite-inlined^teacher+student quasar.config.ts
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs^teacher/src-electron/electron-main.js
PATH^pdfparser^root^shared/pdfparser/ (v5+shared); renderer import next-exam-shared/pdfparser/index.js (quasar alias next-exam-shared->shared/)
IPC^teacher^getServerInfoForDashboard^invoke(servername)→{status,data:{pin,servertoken,serverip,id}}|error; dashboard beforeEnter (replaces GET /control/getserverinfo)^teacher ipchandler.js+router/index.js
IPC^teacher^startExamServer^invoke({servername,passwd,bip,bipId})→{status,message,sender}; replaces POST /control/start^teacher ipchandler.js+startserver.vue
IPC^teacher^getServerStatusFromDisk^invoke(servername)→{status,serverstatus}|serverstatus:false; resume read serverstatus.json; replaces POST /control/getserverstatus^teacher ipchandler.js+dashboard.vue
IPC^teacher^saveStudentScreenshot^invoke({servername,clientname,imageDataUrl}) writes workdir/<server>/<student>/screenshots/screenshot-YYYYMMDD_HH_MM_SS.ext^teacher/src-electron/main/scripts/ipchandler.js
IPC^teacher^setServerStatus^invoke({servername,serverstatus})→{status,message,sender}; pin /^\d{4}$/; validate examSections[activeSection] before assign; disk+backup mirror^teacher ipchandler.js+dashboard.vue
IPC^exam^studentLog^teacher setStudentStatus sendexam+sendlog→student.status.sendlog; student POST /server/data/studentlog/:srv + Authorization Bearer→workdir/<srv>/<client>/logfiles/next-exam-student.log^teacher ipchandler.js+exammanagement.js;teacher control.js+data.js;student communicationhandler.js
IPC^teacher^setStudentStatus^invoke({servername,studenttoken,...flags}); sendexam+sendlog; fetchfiles+files→client download queue; msofficeshare; restorefocus; spellcheck if activatePrivateSpellcheck key^teacher ipchandler.js+dashboard.vue+exammanagement.js+msalutils/onedrive.js+utils/filemanager.js
IPC^teacher^deleteWorkdirItem^invoke({servername,filepath})→unlink/rm under workdir/<servername>; rejects path outside exam root; replaces POST /server/data/delete^teacher ipchandler.js+filemanager.js
IPC^teacher^workdownloadExplorerItem^invoke({servername,servertoken,type,filename,path})→Buffer file or zipped dir under exam root; replaces POST /server/data/workdownload^ipchandler+filemanager.js
IPC^teacher^uploadTeacherFiles^invoke({servername,servertoken,who,files:[{name,data}]})→UPLOADS+setStudentStatus fetchfiles; replaces POST /server/data/upload^ipchandler+exammanagement.js
IPC^teacher^readTeacherWorkdirFile^invoke({servername,servertoken,filepath})→bytes decrypt NXE1 when needed; teacher/src/utils/filemanager.js loadPDF+loadTextFile+loadImage^ipchandler.js
RULE^teacher^logViewerTruncate^loadTextFile truncateLogTextForViewer keeps tail (max 200k chars); scroll bottom on open+dashboard serverlog^filemanager.js+dashboard.vue
IPC^teacher^listTeacherWorkdir^invoke({servername,servertoken,dir})→{status,filelist}|error; dashboard explorer dir list; replaces POST /server/data/getfiles^ipchandler.js+filemanager.js loadFilelist
IPC^teacher^buildTeacherCombinedLatestPdf^invoke({servername,servertoken,submissions})→{warning,pdfBuffer,pdfPath} index+combined on disk+backup mirror; replaces POST /server/data/getlatest^ipchandler.js+getLatestCombinedPdf.js+filemanager.js getLatest
TECH^teacher^combinedPdf^stripSig^getLatestCombinedPdf preparePdfBytesForMerge drops PKCS#7+Sig widgets before merge; combined.pdf print-only unsigned^getLatestCombinedPdf.js
TECH^student^previewWebview^applyPreviewWebviewHostLayout(splitview) sets #preview #webview box; showUrl calls it; WebviewPane host no Vue inline style (re-render wiped 80vw); inner nx-webview-pane-fill; guest no d-block; setZoomFactor dom-ready+try/catch; pass splitview prop editor+activesheets^student/src/utils/commonMethods.js+student/src/components/WebviewPane.vue
TECH^student^examHeaderClock^ExamHeader :entrytime ms; tickHeaderClock updates ref headerClock textContent+title (no reactive tick); pages drop clockinterval/currenttime/timesinceentry props^student/src/components/ExamHeader.vue
TECH^student^editorStatusCounts^editor.vue statusWordCount/statusCharCount refs+updateEditorStatusCounts SchedulerService 1Hz (no parent re-render)^student/src/pages/editor.vue
PATH^student^examFetchInfoSync^student/src/utils/examFetchInfoSync.js applyClientinfoFromFetch+applyServerstatusFromFetch; serverstatus compare JSON replacer activeSheets→filename+len+checksum not filecontent
RULE^student^pin^noFetchSync^applyClientinfoFromFetch must not set vm.pincode; lobby=user input; exam=router params from register mirror
TECH^student^activesheets^fetchInfo^maybeReloadActiveSheetPdf activeSheetLoadKey; no clientinfo watcher PDF reload
TECH^student^geogebra^fetchInfo^injectCSS only on exammode change
TECH^student^eduvidual^fetchInfo^applyEduvidualConfigFromSection; webview src only on url change
TECH^student^website^fetchInfo^applyWebsiteConfigFromSection; webview src only on url change
TECH^student^localvm^fetchInfo^clientinfo localVM* in clientinfoUiChanged; VNC reset only on vm state transition
TECH^student^forms^fetchInfo^applyFormsUrlFromSection; webview src only on url change
TECH^student^ms365^fetchInfo^msofficeshare in clientinfoUiChanged; collapse/restore browserview only on focus transition
TECH^student^rdp^fetchInfo^applyRdpConfigFromSection; webview src only on url change
RULE^student^typingRhythm^editor.vue isTypingRhythmExemptKey clears deltas for Backspace Delete Space Enter NumpadEnter (OS key-repeat)^student/src/pages/editor.vue handleTypingRhythmKeydown
RULE^ui^colors^shared^btn-cyan+swal confirm=$cyan-600^shared/css/nxe-theme.scss; app.scss imports nxe-bootstrap-config+nxe-theme
RULE^ui^swal2^teacher+student layout+btn colors^shared/css/nxe-theme.scss
TECH^localvm^qemuBundled^public/qemu/{win|lin|mac}; copy distro HW modules → <platform>/lib/qemu (e.g. /usr/lib/qemu); spawn sets QEMU_MODULE_DIR via buildQemuSpawnEnv; probe -vga virtio; QEMU_GUEST_VGA=virtio; install ISO -vga std^shared/qemuAvailability.js
RULE^localvm^display^teacher bootDisk/install=-display gtk (bundled default none; needs lib/qemu ui-gtk.so); student startHeadless=-display none+-vnc^teacher+student qemuService.js
RULE^localvm^teacherBoot^killExistingQemuInstances before teacher interactive spawn; stale -display none holds qcow2 lock^teacher qemuService.js
TECH^localvm^isoDl^teacher downloadFile uses stream pipeline to .part then rename; skip if dest>=MIN_COMPLETE_BYTES; cleanup stale .part^teacher qemuService.js
BUG^localvm^whpx^win32 -cpu max,vmx=off (not host); -accel whpx,kernel-irqchip=off; teacher display sdl; win std vga preview^shared/qemuHostArgs.js
TECH^localvm^qemuAvail^fallback PATH+win ProgramFiles if bundled missing; renderer qemuMissingWarningHtml.js only^shared+ipchandler
TECH^student^localvmHash^sha256 base qcow2 before qemu start (runLocalVmPreStartVerify); avoids guest freeze from parallel full read^student/src-electron/main/scripts/communicationhandler.js+ipchandler.js
TECH^student^localvmStart^localVmStartState idle|starting|blocked; qemu-download/import must not set idle while starting (parallel startExam)^student/src-electron/main/scripts/communicationhandler.js+ipchandler.js
TECH^student^examWin^createExamWindow no-op if examwindow exists (orphan second BrowserWindow)^student/src-electron/main/scripts/windowhandler.js
TECH^student^displayInfo^clientinfo.displayCount+multiMonitor via displayInfo.syncClientDisplayInfo; register blocked if multiMonitor&&!development^student displayInfo.js+ipchandler+student.vue; teacher /update persists on student
TECH^teacher^localvmVerify^localvm calculateSha256(default false); when false, use qcow2SizeBytes stat.size verify; when true, use qcow2Sha256 verify^teacher/src/utils/examsetup.js+exammanagement.js;student/src-electron/main/scripts/communicationhandler.js
TECH^student^localvmWebdav^WebDAV 0.0.0.0:1900 /share -> workdir; guest http://10.0.2.2:1900/share; blockInternet uses restrict=on+guestfwd tcp:10.0.2.2:1900-tcp:127.0.0.1:1900; start WebDAV before QEMU^student/src-electron/main/scripts/examWebdavServer.js+qemuService.js
PATH^student^netScan^networkActiveProcesses.js scans non-loopback TCP established + TCP LISTEN; excludes next-exam subtree + LT pid + LT cmdline markers + sys-critical allowlist; findNonLanguageToolOn8088=listen on 8088 not LT; win32 collectWin32 1 PS JSON
TECH^student^netScanLifecycle^requestUpdate timer%20: findNonLanguageToolOn8088→log warn+applySecurityFocusLost(exammode)+remoteassistant.languagetoolFake for teacher badge; logNetworkActiveProcesses+runRemoteCheck parallel^communicationhandler.js
IPC^student^focusLock^main sets clientinfo.focusLockReason+focusLockMessage; examwindow webContents.send('focusLock'); editor listens+overlay; i18n editor.focusLockReason_<code>^focusLockState.js+communicationhandler.js+editor.vue
IPC^student^stopProxy^ipcMain.handle('stop-proxy') -> vncproxy.stopProxy(); called by localvmview.vue beforeUnmount + electron-main.js window-all-closed^student/src-electron/main/scripts/ipchandler.js+vncproxy.js
RULE^student^appsToClose^single source of truth in student/src-electron/main/scripts/platformrestrictions.js (exported); consumed by restrictions/{lin,win,mac}.js (kill) + remotecheck/remote{Lin,Win,Mac}.js (detect+report via clientinfo.remoteassistant); macOS TitleCase duplicates intentional (pkill -f case-sensitive); never add bare 'vnc' (would kill vncproxy-helper)
RULE^student^screenshotStream^resetConnection must not stop getDisplayMedia stream; capture persists until app quit so kiosk reconnect avoids OS picker^student communicationhandler resetConnection; resetDisplayStream not on disconnect
TECH^linux^cage^platformDispatcher.runningInCage; lin.js appsToClose then skip gsettings; renderer linuxCageKiosk.js; quit-app; exit sidebar student.vue
IPC^student^cageHeartbeat^requestUpdate sets clientinfo.isRunningInCage (linux detectRunningInCage); teacher /update→student.isRunningInCage; dashboard shield-lock-fill before name^communicationhandler.js+control.js+dashboard.vue
TECH^linux^cageScreenshot^registerClient skip stream+fullDesktop in Cage; capturePage IPC; desktop path unchanged vs pre-cage (screen handler useSystemPicker true initDisplayStreamOnce at scheduler)
IPC^student^getMacArchInfo^invoke get-mac-arch-info→platformDispatcher.macRosettaEmulation{runningUnderRosetta,nativeHostArch,processArch,procTranslated}; arm64 host+x64+sysctl.proc_translated; student.vue warnMacRosettaArch swal on mount
TECH^exam^fileCrypto^NXE1 v1 AES-256-GCM+scrypt; key=serverstatus.encryptionPassword (64 hex auto); examPassword=human exit only; student encrypt/decrypt+teacher decrypt use encryptionPassword^student ipchandler+communicationhandler; teacher examFileCryptoContext+data.js+control.js+ipchandler getSpecificSubmissionBase64+pickEncryptedPdfForPreview
IPC^teacher^pickEncryptedPdfForPreview^invoke(encryptionPassword)->dialog .pdf read; if NXE1 unwrap else raw; %PDF- check; {ok,base64,filename,filePath}|codes NEEDS_PASSWORD|BAD_PASSWORD|NOT_PDF|ERROR^teacher ipchandler.js+dashboard openEncryptedPdfPreview
TECH^exam^editorBackupExt^editor/activesheets HTML backup filename <name>.htm + type htm in getfilesasync; teacher getLatestBakFile reads <student>.htm in latest backup dir (IPC name unchanged)^student+teacher ipchandler; Vue filetype htm
IPC^student^registerSecurePayload^registerclient: teacher must !examServerList[servername] before processSecurePayload (empty sessionRef→Wrong PIN); decrypt JSON may include exammode bool; teacher sets student.exammode on create+reconnect; if client exammode true and !serverstatus.exammode deny+t(control.exammismatchregistration); success may set reconnected:true→student swal reconnectedinfo; heartbeat POST /update clientinfo.exammode^student ipchandler+student.vue; teacher control.js registerclient
RULE^student^clientname^trim+lowercase canonical id; shared/normalizeStudentClientName.js; student.vue @input+register; student ipchandler register+locallockdown; teacher control.js registerclient+workdir rename case-only mismatch
IPC^student^controlBearer^POST /server/control/update|updatescreenshot|submission/:srv|printjob/:srv require Authorization Bearer=registered student token; exempt GET pong+GET serverlist (pre-register); registerclient PIN; oauth+msauth^control.js+communicationhandler+editor.vue+activesheets.vue+screenshotCapture.js
PATH^student^odtTiptap^student/src/utils/odtToTiptapHtml.js+filehandler loadODT+editor.vue materials+localfiles
IPC^student^getfilesasync^odtRaw 5th arg true→base64 .odt (decrypt like htm); dir list type odt^student/src-electron/main/scripts/ipchandler.js
TECH^exam^editorTemplate^examConfig.editor.editorTemplate odt/docx base64; setEditorExamConfigPatch keeps groupB.editorTemplate when section.groups; student reads after backup^teacher+student
RULE^api^appSecret^shared/nextExamApiSecret.js (edit before release); header x-next-exam-app-secret; teacher serverroutes middleware timingSafeEqual; skip OPTIONS+/control/oauth+/control/msauth; renderer import examApiFetch from next-exam-shared/examApiFetch.js (quasar alias next-exam-shared->shared/); electron main import ../../../../shared/examApiFetch.js; student data calls add Authorization Bearer; qemu POST sets secret+Bearer^teacher+student
TECH^moodle^proof^shared/nextExamMoodleProofSecret.js+buildNextExamMoodleProof.js HMAC-SHA256 hex(secret, quizId|UTC YYYY-MM-DD); header X-Next-Exam-Moodle-Proof+X-Next-Exam-Client:1; eduvidual guest webRequest ipchandler attach/detach; exammode required^student eduvidual.vue+ipchandler.js
TECH^submissionSign^pades^auto always; bip=userprivateaccesskey; local=sha256(pin|token|timeMs); rewritePdfForPlainSignpdf before plainAddPlaceholder; swal inline editor+activesheets sendExamToTeacher/printBase64^shared/submissionPdfSign.js
BUG^submissionPdf^footerGrayBands^printBackground:true on submit painted #editormaincontainer #eeeefa in PDF side margins; stats-rule row shows gray bands; fix editor @media print white bg+submissionSigningUi printBackground false^editor.vue+submissionSigningUi.js
TECH^submissionPdf^visibleStamp^addSubmissionStampToPdf last page center; logo student/public/icons/icon.png; name+datetime+BiP signed; before plainAddPlaceholder^shared/submissionPdfSign.js+communicationhandler resolveSubmissionStampIconPath
BUG^submissionPdf^sigWidgetLine^plainAddPlaceholder default widgetRect [0,0,0,0]; fix HIDDEN_SIG_WIDGET_RECT^shared/submissionPdfSign.js
BUG^submissionPdf^bottomGrayLine^signed printToPDF bottom margin+footer band; fix isSigningExport bottom:0 empty footer printBackground:false; keep editor #statusbar border in print^communicationhandler
