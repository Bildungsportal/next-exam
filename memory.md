@memV1
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
BUG^print^firstCold^pdfjs+raster+silent;logs success;only after full app restart;vs old plugin path=regr surface
TECH^teacherCli^examModes^--exam-modes=csv overrides config.exammodes at runtime^teacher/src-electron/electron-main.js
TECH^build^protectMain^main bundle path=teacher/dist/electron/UnPackaged/electron-main.js;run protect via electron-builder beforePack^teacher/scripts/protect-main.mjs+teacher/quasar.config.ts
