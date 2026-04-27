@memV1
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates
RULE^i18n^alphabetical^keep keys in teacher/src/locales/de.json+en.json alphabetically sorted within each object
RULE^dashboard^setupLogic^exam setup funcs live in teacher/src/utils/examsetup.js; dashboard.vue should mostly import+map
RULE^dev^noBackCompat^unstable dev; no legacy migrations/workarounds/backward-compat; schema breaks ok
RULE^ui^noJsWorkarounds^fix layout via CSS/layout first; no JS workaround for layout/scroll issues
RULE^agent^assumeUserEditsIntentional^never revert incidental diffs; assume user made changes intentionally unless explicitly asked
RULE^agent^gitSafety^never run git restore/reset/clean/rebase/stash/pop/checkout/switch unless user explicitly asks
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
TECH^teacherCli^examModes^--exam-modes=csv overrides config.exammodes at runtime^teacher/src-electron/electron-main.js
TECH^build^protectMain^main bundle path=teacher/dist/electron/UnPackaged/electron-main.js;run protect via electron-builder beforePack^teacher/scripts/protect-main.mjs+teacher/quasar.config.ts
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs^teacher/src-electron/electron-main.js
PATH^pdfparser^root^pdf parser code lives in teacher/src/utils/pdfparser/ and student/src/utils/pdfparser/ (versioned subdirs)
IPC^teacher^saveStudentScreenshot^invoke({servername,clientname,imageDataUrl}) writes workdir/<server>/<student>/screenshots/screenshot-YYYYMMDD_HH_MM_SS.ext^teacher/src-electron/main/scripts/ipchandler.js
IPC^exam^studentLog^GET /server/control/fetch/...?log=true sets sendlog; student POST /server/data/studentlog/:server/:token {file,clientname} -> workdir/<server>/<client>/logfiles/next-exam-student.log^teacher/src-electron/server/src/routes/server/control.js+data.js;student communicationhandler.js
