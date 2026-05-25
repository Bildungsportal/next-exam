@memV1
# Agent rules
RULE^agent^claudeMdFirst^first tool Read CLAUDE.md every session+subagent; @ attach ≠ Read; see .cursor/rules/00-read-claude-md-first.mdc+AGENTS.md
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
RULE^agent^gitSafety^never run git restore/reset/clean/rebase/stash/pop/checkout/switch unless user explicitly asks
RULE^agent^userEdits^never revert intentional user manual edits; assume user changes intentional unless explicitly asked
RULE^agent^uxDeps^never change UX or add external deps without user agrees first; diagnose→options→wait
RULE^agent^utils^noSingleUseFiles^never new file for one function solvable in ~2 lines at caller; colocate; reuse module only if 2+ call sites
RULE^agent^minimalDiffs^prefer smallest possible diff that solves the problem; do not refactor adjacent code; do not rewrite control flow when an extra line in existing branch suffices
RULE^agent^windowsInternals^never guess/change Windows registry semantics (ProfileList State, AssignedAccess CSP, GPO keys, etc.); these are undocumented or vary per build; ask user before touching values present in a working setup; "plausible explanation" ≠ verified behavior

# Coding conventions
RULE^dev^noBackCompat^unstable dev; no legacy migrations/workarounds/backward-compat; schema breaks ok
RULE^ui^noJsWorkarounds^fix layout via CSS/layout first; no JS workaround for layout/scroll issues
RULE^i18n^alphabetical^keep keys in teacher/src/locales/de.json+en.json alphabetically sorted within each object
RULE^i18n^intlifyPipe^vue-i18n/intlify treats | in messages as plural delimiter; literal pipe write {'|'}
RULE^ui^colors^shared^btn-cyan+swal confirm=$cyan-600^shared/css/nxe-theme.scss; app.scss imports nxe-bootstrap-config+nxe-theme
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates

# Build pipeline
TECH^quasar^vite^@quasar/app-vite bundles Vite 8; server.forwardConsole=false in student+teacher quasar.config.ts extendViteConf stops browser console mirroring to dev terminal
TECH^vite^pdfjsLegacyAlias^student+teacher quasar extendViteConf resolve.alias pdfjs-dist/legacy/build/pdf.mjs+pdf.worker.mjs -> each app node_modules/pdfjs-dist/legacy/build/ (shared/pdfparser imports)^quasar.config.ts
TECH^vite^fsAllowShared^student+teacher extendViteConf server.fs.allow repoRoot+sharedDir; dev must serve shared/pdfparser/fonts or @font-face fails+measureText drifts
TECH^build^protectMain^electron-main.js in dist/electron/UnPackaged; protect via electron-builder beforePack^teacher+student scripts/protect-main.mjs+beforepack.js+quasar.config.ts
TECH^build^electronAssets^prod electron: copy src/assets→public/src/assets; rewrite `/src/assets`→`./src/assets` incl. Vue backtick literals in generateBundle; CSS url() often Vite-inlined^quasar.config.ts
RULE^student^devtoolsInstaller^electron-devtools-installer devDep only; dynamic import in windowhandler installVueJsDevTools when !app.isPackaged—no top-level require

# Kiosk architecture (cross-platform)
RULE^kiosk^sharedFields^platformDispatcher win32 reuses linux cage field names (runningInCage, cageInstalled, cageKioskAppImageInstalled, cageKioskDesktopInstalled, needsCageKioskSetup); runningInCage on win32 = os.userInfo().username===next-exam-kiosk; renderer linuxCageKiosk.js+student.vue unchanged
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs

# Linux cage
PATH^linux^cageInstall^install-cage-kiosk.sh pkexec; needsCageKioskSetup=!(cage on PATH+AppImage+/opt/next-exam+desktop); UI if needsCageKioskSetup&&!runningInCage
TECH^linux^cage^platformDispatcher.runningInCage; lin.js appsToClose then skip gsettings; renderer linuxCageKiosk.js; quit-app; exit sidebar student.vue
TECH^linux^cageScreenshot^registerClient skip stream+fullDesktop in Cage; capturePage IPC; useSystemPicker true initDisplayStreamOnce at scheduler
RULE^kiosk^screenshotPath^Linux cage=capturePage window-only (electron-main setDisplayMediaRequestHandler types:['window']+useSystemPicker:false; setCageWindowCaptureFallback(true)); Win32 kiosk=normal getDisplayMedia full screen (types:['screen']+useSystemPicker:true); gate via runningInCage && displayServer!=='windows' (NOT runningInCage alone - that field is shared between both kiosk types)

# Windows kiosk
PATH^win32^kioskInstall^src-electron/resources/win32/install-windows-kiosk.ps1 (extraResources→win32/) + src-electron/main/scripts/win/windowsKioskSetup.js; UAC Start-Process -Verb RunAs; edition gate Pro|Edu|Ent; copy full Electron bundle dirname(process.execPath)→C:\NextExam; ProfileList State=128 REQUIRED for AssignedAccess kiosk (without it OOBE+normal desktop, NOT kiosk shell); persistent profile C:\Users\next-exam-kiosk; AllowedApps must include next-exam exe + bundled java.exe/javaw.exe + disable-shortcuts.exe (child spawn blocked otherwise)
RULE^win32^kioskAssignedAccessXml^do NOT add <v5:StartPins> nor xmlns:v5 (2022/config) to AssignedAccess XML; CONFIRMED Microsoft bug: Win11 26100.6584-26100.7705 + 26200.7171-26200.7705 v5 schema regression → MDM CSP returns 0x80004005/0x86000005 (fix in 26100.7705+ / Feb 2026 Patch Tuesday); empirical: desktopAppLink with abs/env paths all rejected on lenovo-class HW; if revisiting after Win update, desktopAppId with KnownFolder GUID format (e.g. {6D809377-6AF0-444B-8957-A3773F02200E}\\...) is reported to work where desktopAppLink fails; alternative is OEM provisioning (Lenovo Vantage proof that pins technically work); for now use kiosk-launcher-apps.json in-app bar - keep rs5 namespace+<StartLayout> only
RULE^win32^kioskStartUi^launchers via strict JSON {"apps":[{name,path}]} at C:\NextExam\kiosk-launcher-apps.json; rendered in student.vue + ExamHeader.vue via loadWinKioskLauncherApps; $skipLauncherUi (java/javaw/disable-shortcuts/netsh/powershell) hides internals; netsh+powershell are AllowedApps for next-exam spawn only, never student-facing buttons
RULE^win32^kioskExam^skipElectronKiosk=win32&&runningInCage; no setKiosk/setAlwaysOnTop/win enable|disable restrictions/fullscreen/reconnect restrictions+blur; AssignedAccess shell handles focus/z-order
RULE^win32^kioskNoSpawn^under AssignedAccess any spawn of exe not in AllowedApps triggers blue "diese app wurde vom systemadministrator gesperrt" warning; when runningInCage SKIP: runParentProcessCheck (checkparent.js spawns powershell), detectWindowsKioskUserExists powershell.exe (return true since we are the user); be wary of any periodic powershell/cmd spawn (networkActiveProcesses, vmDetection, lt-server)
RULE^win32^kioskAutoLogoff^no auto-logoff from app (shutdown.exe/logoff.exe/cmd.exe all blocked by AllowedApps whitelist, all attempts fail); user logs off manually; will-quit does only workdirectory wipe (per-entry loop, skip active logfile - rmSync(recursive) fails EPERM on locked log); BACKUP wipe: NextExam-KioskWipeUserHome scheduled task -AtStartup
TECH^win32^kioskI18n^student.vue kioskI18nPrefix=winKioskSetup on platformKiosk.displayServer==='windows' else cageSetup; kioskI18n(suffix) helper with fallback to cage key
IPC^win32^kioskExitCodes^ps1 exit 10/11/12/13; UAC -EncodedCommand+exitFile; MDM admin Set-CimInstance first else SYSTEM scheduled task with files in C:\NextExam\mdm-staging (NOT admin %TEMP% - SYSTEM cannot write back→timeout); mdm-helper-*.log
IPC^student^kioskShared^get-linux-kiosk-info + install-linux-cage-kiosk channel names kept; win32 routes to windowsKioskSetup; displayServer='windows' on win32 so showCageKioskInstallBtn gate works^student ipchandler.js

# Security / API auth
RULE^api^appSecret^shared/nextExamApiSecret.js (edit before release); header x-next-exam-app-secret; teacher serverroutes middleware timingSafeEqual; skip OPTIONS+/control/oauth+/control/msauth; renderer import examApiFetch from next-exam-shared/examApiFetch.js; electron main import ../../../../shared/examApiFetch.js; student data calls add Authorization Bearer
IPC^student^controlBearer^POST /server/control/update|updatescreenshot|submission/:srv|printjob/:srv require Authorization Bearer=registered student token; exempt GET pong+GET serverlist (pre-register); registerclient PIN; oauth+msauth
TECH^moodle^proof^shared/nextExamMoodleProofSecret.js+buildNextExamMoodleProof.js HMAC-SHA256 hex(secret, quizId|UTC YYYY-MM-DD); header X-Next-Exam-Moodle-Proof+X-Next-Exam-Client:1; eduvidual guest webRequest ipchandler attach/detach; exammode required
TECH^exam^fileCrypto^NXE1 v1 AES-256-GCM+scrypt; key=serverstatus.encryptionPassword (64 hex auto); examPassword=human exit only
TECH^submissionSign^pades^auto always; bip=userprivateaccesskey; local=sha256(pin|token|timeMs); rewritePdfForPlainSignpdf before plainAddPlaceholder; HIDDEN_SIG_WIDGET_RECT to suppress widget line; visible stamp last page center; printBackground:false on signed export (else gray bands)^shared/submissionPdfSign.js

# Exam schema
RULE^exam^sectionSchema^mode config only group.examConfig.{editor|website|eduvidual|forms|rdp|localvm|activeSheets|microsoft365}; section has examtype+sectionname+timelimit+locked+startTs+groups only
PATH^shared^editorExamConfig^shared/editorExamConfig.js DEFAULT_EDITOR_EXAM_CONFIG+resolveEditorExamConfig+resolveGroupKey
RULE^student^clientname^trim+lowercase canonical id; shared/normalizeStudentClientName.js; student.vue @input+register; teacher control.js registerclient+workdir rename case-only mismatch
RULE^student^registerExamMismatch^client exammode=true and !serverstatus.exammode→deny+t(control.exammismatchregistration); registerSecurePayload requires !examServerList[servername] before processSecurePayload (empty sessionRef→Wrong PIN)
TECH^exam^editorBackupExt^editor/activesheets HTML backup filename <name>.htm + type htm in getfilesasync; teacher getLatestBakFile reads <student>.htm in latest backup dir

# Dashboard architecture
RULE^dashboard^setupLogic^exam setup funcs live in teacher/src/utils/examsetup.js; dashboard.vue should mostly import+map
TECH^dashboard^overlayZ^StudentView 4000; DashboardExplorer 4100; StudentEditorTimelineDiffViewer 1003 (below StudentView unless raised)
PATH^examlog^settings^examLogSettings.js snapshot on examstart→event.settings; ExamLog.vue UI+print; examEventBus.push meta.settings
BUG^examlog^dupSubmission^dashboard mounted stacked ipcRenderer.on('submission'); rule: removeListener before on; examEventBus.push dedupe ≤1ms same type+student

# Student exam lifecycle (load, focus, security)
TECH^student^examWin^dup startExam race: processUpdatedServerstatus+5s poll before clientinfo.exammode; gate with _startExamRunning+localVmStartState early+_examWindowCreating
TECH^student^examHeaderClock^ExamHeader :entrytime ms; tickHeaderClock updates ref headerClock textContent+title (no reactive tick)
IPC^student^focusLock^main sets clientinfo.focusLockReason+focusLockMessage; examwindow webContents.send('focusLock'); editor listens+overlay; i18n editor.focusLockReason_<code>
RULE^student^pin^noFetchSync^applyClientinfoFromFetch must not set vm.pincode; lobby=user input; exam=router params from register mirror
PATH^student^examFetchInfoSync^student/src/utils/examFetchInfoSync.js applyClientinfoFromFetch+applyServerstatusFromFetch; serverstatus compare JSON replacer activeSheets→filename+len+checksum not filecontent
RULE^student^typingRhythm^editor.vue isTypingRhythmExemptKey clears deltas for Backspace Delete Space Enter NumpadEnter (OS key-repeat)
RULE^student^appsToClose^single source of truth in student/src-electron/main/scripts/platformrestrictions.js (exported); consumed by restrictions/{lin,win,mac}.js (kill) + remotecheck/remote{Lin,Win,Mac}.js (detect+report via clientinfo.remoteassistant); macOS TitleCase duplicates intentional; never add bare 'vnc' (would kill vncproxy-helper)
RULE^student^screenshotStream^resetConnection must not stop getDisplayMedia stream; upload-fail pause must not stopSharedStream; stopSharedStream clears initAttempted; ensureDisplayStreamAsync re-acquires on Connect after track loss
PATH^student^netScan^networkActiveProcesses.js scans non-loopback TCP established + TCP LISTEN; excludes next-exam subtree + LT pid + LT cmdline markers + sys-critical allowlist
RULE^student^vncproxyHelper^spawn vncproxy-helper.cjs with ELECTRON_RUN_AS_NODE=1 (packaged electron else hits requestSingleInstanceLock and exits 0 without listening)
TECH^student^previewWebview^applyPreviewWebviewHostLayout(splitview); WebviewPane host no Vue inline style (re-render wiped 80vw); inner nx-webview-pane-fill; setZoomFactor dom-ready+try/catch
TECH^student^displayInfo^clientinfo.displayCount+multiMonitor via displayInfo.syncClientDisplayInfo; register blocked if multiMonitor&&!development

# PDF parser
PATH^pdfparser^root^shared/pdfparser/ (v5+shared); renderer import next-exam-shared/pdfparser/index.js (quasar alias next-exam-shared->shared/)
PATH^pdfparser^fonts^shared/pdfparser/fonts/; pdfOverlayFonts.css+pdfOverlayFonts.js; ArialMT→liberation-sans; TimesNewRomanPSMT→liberation-serif
RULE^pdfparser^isClozeField^all clozeFields.push set isClozeField:true; filterDegenerateInteractiveFields exempts isClozeField (like checkbox/deselect) so narrow markers ("__10__" 2-underscore math worksheets) survive 22px minW gate; underscore push allows ≥6px
TECH^pdfparser^clozeWidth^extractClozeFields scans showText ops→glyphRunsByY map per item (x0,y0); when glyphRun.str.length>item.str.length pdfjs collapsed whitespace→switch text+measureSubstringWidth to advances*fontSize/1000

# LocalVM (QEMU)
PATH^localvm^qemu^shared/qemuHostArgs.js+qemuLocalVmDialogs.js+qemuAvailability.js; teacher qemuService.js+examsetup; student communicationhandler+ipchandler
RULE^localvm^teacherBoot^killExistingQemuInstances+400ms before spawn; detached stdio=ignore (piped stderr freezes WHPX guest); useOverlay=true → teacher-boot.overlay.qcow2 fresh each boot
RULE^localvm^display^presets 1920x1080,1680x1050,1440x900,1280x700,1024x768; default 1920x1080; examConfig.localvm.displayResolution→EDID xres/yres; teacher must re-save LocalVM once
RULE^localvm^gpu^standard viogpudo+virtio-vga; autounattend FirstLogon pnputil; do not diagnose choppy VNC as missing GPU; FB cursor lag in VNC stream not missing viogpu
RULE^localvm^rclone^setup-rclone runs at FirstLogon; failure usually in mount-rclone autostart not setup
TECH^localvm^whpx^HypervisorPresent (NOT Get-WindowsOptionalFeature - needs admin, false negatives); win32 cpu Skylake,+nx,+popcnt no hv_* runtime; smp cores=4,threads=1; rtc localtime; disk cache=writeback (not none on QEMU11)
TECH^localvm^webdav^WebDAV 0.0.0.0:1900 /share→workdir; guest http://10.0.2.2:1900/share; blockInternet uses restrict=on+guestfwd tcp:10.0.2.2:1900-tcp:127.0.0.1:1900; start WebDAV before QEMU
TECH^localvm^qmp^student graceful shutdown via QMP; win tcp:47043 linux unix sock
TECH^localvm^verify^calculateSha256 (default false); when false stat.size verify; when true sha256 verify; sha256 base qcow2 BEFORE qemu start (runLocalVmPreStartVerify) avoids guest freeze
TECH^localvm^startState^localVmStartState idle|starting|blocked; qemu-download/import must not set idle while starting (parallel startExam)
BUG^localvm^firstBootRegistry^autounattend SPI+UserPreferencesMask at FirstLogon AFTER pnputil triggers 640x480 on new qcow2 only; old image=inline registry OK

# Misc utilities
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
PATH^student^odtTiptap^student/src/utils/odtToTiptapHtml.js+filehandler loadODT+editor.vue materials+localfiles
TECH^teacherCli^overrides^applyCliOverrides.js consumes --exam-modes=csv (override config.exammodes) + --expose-students (GET connectedstudentips→text/plain); needs running examServerList[0]
TECH^macRosetta^check^platformDispatcher.macRosettaEmulation{runningUnderRosetta,nativeHostArch,processArch,procTranslated}; arm64 host+x64+sysctl.proc_translated; student.vue warnMacRosettaArch swal on mount
RULE^teacher^logViewerTruncate^loadTextFile truncateLogTextForViewer keeps tail (max 200k chars); scroll bottom on open+dashboard serverlog
TECH^exam^editorTimelineJson^workdir student folder `<Student>_editor_timeline.json` (listed in explorer); schema {version,kind,studentFolder,generatedAt,jsonPath,entries[{timestamp_name,timestamp,text,sourceHtm}]}
