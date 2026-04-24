@memV1
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates
RULE^i18n^alphabetical^keep keys in teacher/src/locales/de.json+en.json alphabetically sorted within each object
RULE^dashboard^setupLogic^exam setup funcs live in teacher/src/utils/examsetup.js; dashboard.vue should mostly import+map
RULE^dev^noBackCompat^unstable dev; no legacy migrations/workarounds/backward-compat; schema breaks ok
RULE^ui^noJsWorkarounds^fix layout via CSS/layout first; no JS workaround for layout/scroll issues
RULE^agent^assumeUserEditsIntentional^never revert incidental diffs; assume user made changes intentionally unless explicitly asked
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
TECH^teacherCli^examModes^--exam-modes=csv overrides config.exammodes at runtime^teacher/src-electron/electron-main.js
TECH^build^protectMain^main bundle path=teacher/dist/electron/UnPackaged/electron-main.js;run protect via electron-builder beforePack^teacher/scripts/protect-main.mjs+teacher/quasar.config.ts
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs^teacher/src-electron/electron-main.js
PATH^pdfparser^root^pdf parser code lives in teacher/src/utils/pdfparser/ and student/src/utils/pdfparser/ (versioned subdirs)
