@memV1
# Agent rules
RULE^agent^claudeMdFirst^first tool Read CLAUDE.md every session+subagent; @ attach ≠ Read; see .cursor/rules/00-read-claude-md-first.mdc+AGENTS.md
RULE^agent^caveman^ALWAYS ON default every reply no trigger; ≤3 lines/Stichworte; NO tables/matrix/Zusammenfassung/soll-ich-Listen; answer literal question only; only analysiere/explain/why/ausführlich lifts that one reply
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
PATH^student^appleHelpers^scripts/apple/build.sh builds {assessment.swift→assessment-helper.app, wifi.swift→wifi-helper(plain CLI)}; assessment-helper.app embeds nextexamstudent.provisionprofile(grants AAC)+Info.plist CFBundleIdentifier=com.nextexam.student; wifi-helper=no profile/no entitlement; entitlements: mac.plist=Electron only; mac.assessment.plist=AAC; afterpack copies provisionprofile only; helpers re-signed in student/scripts/notarize.cjs after electron-builder signing
RULE^student^macWifiInfo^SSID/BSSID on macOS14+ need com.apple.developer.networking.wifi-info entitlement + Location auth (BOTH, apple-documented for CWInterface.ssid()); shell tools (airport/networksetup/ipconfig/system_profiler) return redacted. wifi-info IS anhakbar+aktiv on App-ID but Developer ID profile type does NOT write networking restricted entitlements into exported profile (account/checkbox fine, profile-type is the wall); only App Store/MAS profile carries it→requires Store distribution (no DMG/GitHub). So on Dev-ID DMG build wifi-info impossible→wifi-helper returns ssid:null on mac14+, accepted. 2nd profile just for helper=pointless (also Dev-ID)
RULE^student^macEntitlementsSplit^main .app embeds scripts/apple/nextexamstudent.provisionprofile (quasar.config mac, present-only) granting ONLY automatic-assessment-configuration; with embedded profile macOS STRICTLY requires every restricted entitlement in binary be profile-granted else invalid sig→app CRASHES on launch (same as multicast). Fix: keep restricted entitlements OFF main entitlements.mac.plist; main only spawns helpers, never calls CoreWLAN/AEAssessment directly. assessment-helper=entitlements.mac.assessment.plist (AAC) embedded in .app bundle; wifi-helper=no entitlement/no profile; helper signatures must survive electron-builder deep-sign → re-sign in student/scripts/notarize.cjs afterSign
IPC^student^assessment^darwin; CommHandler.startExam→ensureAssessmentForExamStart+abortExamModeStart; before exam UI; toggleMacOSLockdown off
TECH^student^aacV8Conflict^AAC entitlement on Electron app = V8 JIT blocked → EXC_BREAKPOINT/SIGTRAP at launch (Apple fwd thread/742980, eb#6637, both unresolved). So AAC CANNOT live in electron process; runs in separate assessment-helper (swift). AAC locks SYSTEM-WIDE not per-window; lock bound to process calling begin(), parent/child irrelevant → helper need NOT be foreground/window, just long-lived holding the session
RULE^student^assessmentHelperProto^scripts/apple/assessment.swift = ONE long-lived process: AEAssessmentSessionDelegate emits line-JSON on stdout {event:begin|failed|end|interrupted}; failed also dumps NSError domain+code+underlying (generic localizedDescription "operation couldn't be completed" useless); start=begin()+RunLoop; stop=SIGTERM(or stdin EOF)→session.end()→didEnd→exit (NOT a 2nd `stop` process - separate process builds new session, cannot end the first). assessmentSession.js: startAssessmentSession waits for begin event=ok / failed|exit|5s-timeout=fail (was: silently ok if not-exited 2.5s → masked failures); stopAssessmentSession SIGTERMs the live child (no new spawn), SIGKILL fallback 5s
RULE^student^assessmentHelperBundle^CONFIRMED on mac: AAC works from helper IF helper is a .app bundle carrying its OWN Contents/embedded.provisionprofile + Info.plist CFBundleIdentifier==profile App-ID (com.nextexam.student). Bare CLI w/ AAC entitlement → AMFI kills it SIGKILL "no matching profile" err 413 (=zsh: killed). build.sh builds assessment-helper.app (executable Contents/MacOS/assessment-helper); wifi-helper stays plain CLI. extraResources/beforepack/afterpack/build-apple all key on 'assessment-helper.app'; assessmentSession.js helperPath = assessment-helper.app/Contents/MacOS/assessment-helper. NO embedded profile on main .app (holds no restricted entitlement). Test w/o full build: scripts/apple/testbuild/test-assessment.sh. electron-builder deep-sign strips helper AAC→notarize.cjs+notarize-app-only.cjs resignAppleHelpers Resources/apple/assessment-helper.app (not bare assessment-helper)
RULE^student^assessmentPermittedApp^AAC always has a "main" app = begin() caller = the windowless helper → bare AEAssessmentConfiguration() locks to BLANK GREY screen (confirmed: ran helper from Cursor terminal, everything vanished, Cursor NOT kept front). Fix: helper adds Next-Exam as permitted SECONDARY app via configuration.setConfiguration(AEAssessmentParticipantConfiguration(), for: AEAssessmentApplication(bundleIdentifier:"com.nextexam.student", teamIdentifier:"89V82RD7XY")) [macOS12+]. Permitted app needs valid signature + notarized (requiresSignatureValidation default true) → realistic test needs NOTARIZED Next-Exam installed, not just helper alone. After start ok, electron must pull its window front (app.focus{steal:true}+show/moveTop/focus in ensureAssessmentForExamStart darwin) else AAC shows helper's empty main screen. OPEN: unverified whether windowless main-app + permitted GUI app fully avoids grey - needs mac test w/ notarized app

# Kiosk architecture (cross-platform)
RULE^kiosk^sharedFields^platformDispatcher win32 reuses linux cage field names (runningInCage, cageInstalled, cageKioskAppImageInstalled, cageKioskDesktopInstalled, needsCageKioskSetup); runningInCage on win32 = kioskOsUser && provisionedSid && (aaProof || profileState128); not username-only
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs

# Linux cage
PATH^linux^cageInstall^install-cage-kiosk.sh pkexec; APPIMAGE mount=noexec→resolveRunnableCageKioskInstallScript copies to tmp; needsCageKioskSetup=!(cage on PATH+AppImage+/opt/next-exam+desktop); UI if needsCageKioskSetup&&!runningInCage
TECH^linux^cage^platformDispatcher.runningInCage; lin.js appsToClose then skip gsettings; renderer linuxCageKiosk.js; quit-app; exit sidebar student.vue
TECH^linux^cageScreenshot^registerClient skip stream+fullDesktop in Cage; capturePage IPC; useSystemPicker true initDisplayStreamOnce at scheduler
RULE^kiosk^screenshotPath^Linux cage=capturePage window-only (electron-main setDisplayMediaRequestHandler types:['window']+useSystemPicker:false; setCageWindowCaptureFallback(true)); Win32 kiosk=normal getDisplayMedia full screen (types:['screen']+useSystemPicker:true); gate via runningInCage && displayServer!=='windows' (NOT runningInCage alone - that field is shared between both kiosk types)

# Windows kiosk
PATH^win32^kioskInstall^src-electron/resources/win32/install-windows-kiosk.ps1 (extraResources→win32/) + windowsKioskSetup.js; UAC Start-Process -Verb RunAs; edition gate Pro|Edu|Ent; bundle source fallback: explicit -AppDir then %TEMP%\\next-exam-student then C:\\Program Files\\Next-Exam-Student (MSI); copy full Electron bundle→C:\\NextExam; ProfileList State=128 REQUIRED for AssignedAccess kiosk; persistent profile C:\\Users\\next-exam-kiosk; AllowedApps must include next-exam exe + java/javaw + disable-shortcuts + netsh + powershell + reg.exe + whoami.exe
TECH^win32^kioskKnownFolders^offline NTUSER User Shell Folders+Shell Folders redirect Desktop/Documents/Downloads/Pictures/Music/Videos→%USERPROFILE%\\EXAM-STUDENT; AA FileExplorer still Downloads-only
TECH^win32^kioskFirewallHook^optional EXAM-STUDENT/firewall-rules.ps1 via -FirewallRulesScript; auto-detect same dir as kiosk-allowed-apps.txt; runs elevated near end of install-windows-kiosk.ps1; non-zero exit=warning only
RULE^win32^kioskAssignedAccessXml^do NOT add <v5:StartPins> nor xmlns:v5 (2022/config) to AssignedAccess XML; CONFIRMED Microsoft bug: Win11 26100.6584-26100.7705 + 26200.7171-26200.7705 v5 schema regression → MDM CSP returns 0x80004005/0x86000005 (fix in 26100.7705+ / Feb 2026 Patch Tuesday); empirical: desktopAppLink with abs/env paths all rejected on lenovo-class HW; if revisiting after Win update, desktopAppId with KnownFolder GUID format (e.g. {6D809377-6AF0-444B-8957-A3773F02200E}\\...) is reported to work where desktopAppLink fails; alternative is OEM provisioning (Lenovo Vantage proof that pins technically work); for now use kiosk-launcher-apps.json in-app bar - keep rs5 namespace+<StartLayout> only
RULE^win32^kioskStartUi^launchers via strict JSON {"apps":[{name,path}]} at C:\NextExam\kiosk-launcher-apps.json; rendered in student.vue + ExamHeader.vue via loadWinKioskLauncherApps; $skipLauncherUi (java/javaw/disable-shortcuts/netsh/powershell/reg.exe/whoami.exe) hides internals; those AllowedApps are next-exam spawn-only, never student-facing buttons
RULE^win32^kioskExam^skipElectronKiosk=win32&&runningInCage; no setKiosk/setAlwaysOnTop/win enable|disable restrictions/fullscreen/reconnect restrictions+blur; AssignedAccess shell handles focus/z-order
RULE^win32^kioskDetect^runningInCage=kioskOsUser&&provisionedSid(live sid===.kiosk-account-sid)&&aaProof; aaProof=assignedAccessActive|mdm|shell; assignedAccessActive=RestrictRun AssignedAccess_* via reg OR cmd.exe spawn blocked (cmd not on allow list); profileState128 diagnostic only not sufficient alone
RULE^win32^kioskAllowedAppsDrift^read once at startup; clientinfo.allowedKioskApps={startLayoutReadable,appNames[]}; appNames=launcher.json names+pin drift names (Get-StartApps); teacher /update stores student.allowedKioskApps
RULE^win32^kioskNoSpawn^under AssignedAccess any spawn of exe not in AllowedApps triggers spawn UNKNOWN; do NOT whitelist cmd.exe; windowsKioskSetup must use execFileSync to powershell/reg/whoami directly (Node execSync string→cmd.exe wrapper); when runningInCage SKIP checkparent; beware tasklist in vmDetection/remoteWin
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
BUG^print^swal2MultiPage^body.swal2-shown setzt im @media print "[aria-hidden=true] { display:none }" auf alle body-children → killt multi-page print bei activesheets previewSigned. Fix in activesheets.vue @media print: body.swal2-shown > [aria-hidden="true"] { display:block !important }

# Exam schema
RULE^exam^sectionSchema^mode config only group.examConfig.{editor|website|eduvidual|forms|rdp|localvm|activeSheets|microsoft365}; section has examtype+sectionname+timelimit+locked+startTs+groups only
RULE^student^sectionSwitch^switchExamSection: teardownExamChrome+rerouteToExamSection; keep examwindow+blur; no createExamWindow re-bind
RULE^student^examWin^listeners^close once on mainwindow; app-command once; blur idempotent; teardown clears route listeners only
RULE^student^examWin^state: clientinfo.exammode+mainwindow via mainWin/inExamMode; examServerstatus for IPC cache
PATH^shared^editorExamConfig^shared/editorExamConfig.js DEFAULT_EDITOR_EXAM_CONFIG+resolveEditorExamConfig+resolveGroupKey
RULE^student^clientname^trim+lowercase canonical id; shared/normalizeStudentClientName.js; student.vue @input+register; teacher control.js registerclient+workdir rename case-only mismatch
RULE^student^registerExamMismatch^client exammode=true and !serverstatus.exammode→deny+t(control.exammismatchregistration); registerSecurePayload requires !examServerList[servername] before processSecurePayload (empty sessionRef→Wrong PIN)
TECH^exam^editorBackupExt^editor/activesheets HTML backup filename <name>.htm + type htm in getfilesasync; teacher getLatestBakFile reads <student>.htm in latest backup dir

RULE^materials^pushOrder^teacher: await setServerStatus before setStudentStatus getmaterials; flag one-shot else student fetches stale list
RULE^dashboard^setupLogic^exam setup funcs live in teacher/src/utils/examsetup.js; dashboard.vue should mostly import+map
TECH^dashboard^overlayZ^StudentView 4000; DashboardExplorer 4100; StudentEditorTimelineDiffViewer 1003 (below StudentView unless raised)
PATH^examlog^settings^examLogSettings.js snapshot on examstart→event.settings; ExamLog.vue UI+print; examEventBus.push meta.settings
BUG^examlog^dupSubmission^dashboard mounted stacked ipcRenderer.on('submission'); rule: removeListener before on; examEventBus.push dedupe ≤1ms same type+student

# Student exam lifecycle (load, focus, security)
TECH^student^examWin^re-lock: clientinfo.exammode=true only after createExamWindow; handleGlobalServerStatus start/end on exammode flag only; createExamWindow duplicate→focus+lockdown; _startExamRunning+routeSuperseded
TECH^student^examWinReuse^createExamWindow: examwindow=mainwindow for all examtypes except microsoft365 (own BrowserWindow); mainwindow webPreferences MUST keep webviewTag:true else eduvidual/website <webview> not upgraded (shadowRoot null + no page load)^windowhandler.js
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
RULE^student^webviewHostDisplay^never set <webview> host display:block; overrides Electron :host{display:flex} so internal iframe(flex:1) collapses (content not full height). Use display:flex + flex:1 1 0 to fill; CSS cannot pierce webview shadow DOM so no iframe-height JS hack^eduvidual.vue #webviewmain
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
PATH^teacher^showPDFPreview^teacher/src/utils/filemanager.js: single entry for PDF preview ({filepath?, filename, base64?}); filepath=>readWorkdir+isValidPdf+loadActivesheetsCorrectionContext; base64=>direct bytes; replaced loadPDF+showBase64FilePreview
PATH^pdfAnnotations^mixin^shared/pdfPageAnnotationsMixin.js (both student+teacher import via next-exam-shared); state+draw+undo+resetAnnotations+cancelDraw. Tools: highlight-yellow/green/blue (kind:highlight box), underline-red (kind:underline line), pen-red (kind:pen freehand polyline via draftPenPath.points). Hooks: onAnnotationsChange() (student=>queueSave) + onAnnotationUndoRestore(prev). Toolbar+render+mouse-events bleiben inline in jeweiligem PdfviewPaneRendered.vue
RULE^teacher^submissionPreviewPath^submission preview muss filepath mitgeben (loadActivesheetsCorrectionContext filtert /ABGABE/+examtype=activesheets) sonst kein annotation toolbar+kein autocorrect button im PdfviewPaneRendered
TECH^print^activesheetsScale^pdfparser rendert page CSS-px=PDF-pt*1.5; Chromium printToPDF mappt 1pt=96/72=1.333px → wrapper 12% breiter als A4. activesheets nutzt pageMode='fullpage' (margins 0+kein header/footer) + :deep(.pdf-overlay-root){zoom:calc(8/9)} im @media print für 1:1 PDF-Seite ↔ A4-Druckseite
TECH^print^activesheetsHeader^pageMode='fullpage' margins 0+chromium header/footer off; getBase64PDF injiziert headerTemplate als #__fullpageHeaderOverlay__ div (position:absolute top:0) per executeJavaScript vor printToPDF, finally-Block entfernt es → Wrapper bleibt 1:1, Header ueberdeckt obere ~14px der 1. Druckseite, kein neuer Header-String
IPC^student^getPDFbase64^args.pageMode='fullpage' (optional) => margins 0+displayHeaderFooter false+DOM overlay header; default behält editor-Verhalten (top/bottom 0.5"+header/footer)
PATH^student^odtTiptap^student/src/utils/odtToTiptapHtml.js+filehandler loadODT+editor.vue materials+localfiles
TECH^teacherCli^overrides^applyCliOverrides.js consumes --exam-modes=csv (override config.exammodes) + --expose-students (GET connectedstudentips→text/plain); needs running examServerList[0]
TECH^macRosetta^check^platformDispatcher.macRosettaEmulation{runningUnderRosetta,nativeHostArch,processArch,procTranslated}; arm64 host+x64+sysctl.proc_translated; student.vue warnMacRosettaArch swal on mount
RULE^teacher^logViewerTruncate^loadTextFile truncateLogTextForViewer keeps tail (max 200k chars); scroll bottom on open+dashboard serverlog
TECH^languagetool^studentToggle^editor.vue ltExternalHost+ltUseExternal default external; sidebar Lokal/Extern btns beside update; LThost/LTport via applyLtActiveEndpoint; isLanguageToolRunning IPC opts host+port
