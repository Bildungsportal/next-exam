@memV1
RULE^agent^memRW^read CLAUDE §5+this file before nontrivial; append atoms post-learn; dedup; prune
TECH^vue^api^Options API teacher/src; mirror sibling file; no script setup unless user migrates
PATH^print^pdf^teacher/src-electron/main/scripts/printjobhandler.js+teacher/src/pages/SystemPrintPdf.vue
BUG^print^firstCold^pdfjs+raster+silent;logs success;only after full app restart;vs old plugin path=regr surface
TECH^teacherCli^examModes^--exam-modes=csv overrides config.exammodes at runtime^teacher/src-electron/electron-main.js
TECH^build^protectMain^main bundle path=teacher/dist/electron/UnPackaged/electron-main.js;run protect via electron-builder beforePack^teacher/scripts/protect-main.mjs+teacher/quasar.config.ts
BUG^build^protectMainImportMeta^bytenode+esbuild cjs makes import_meta.url undef→new URL('.',import.meta.url) crash;fix replace import_meta.url with pathToFileURL(__filename).href^teacher/scripts/protect-main.mjs
PATH^platform^dispatcher^teacher/src-electron/main/scripts/platformDispatcher.js used by teacher main startup logs^teacher/src-electron/electron-main.js
BUG^pdfparser^textItemWidth^item.width=text-space;viewport extent via tx[0]*width+hypot scale;textItemRunWidthPx+geom bounds;pdfjs5 vs4^teacher src/utils/pdfparser/shared/filters.js+legacy|v5/detectors.js
PATH^pdfparser^teacherRouter^index.js→legacy|v5 by pdfjs major;VITE_PDF_PARSER=legacy|v5^teacher/src/utils/pdfparser/
TECH^activesheets^picker^configureActivesheets(preset only from sidebar);exam type switch does not open picker;pickPdfFilesFromUser;swal invalid/size^teacher/src/utils/examsetup.js
TECH^pdfparser^tableText^isTableCell drop via overlap bbox+font metrics;cloze prune vs checkbox/table-checkbox before merge;resolveSmallerWinsAmongOverlappingFields on cloze+box post-merge^teacher/src/utils/pdfparser/shared/filters.js+v5|legacy/index.js
BUG^pdfparser^tableCellVsArtifact^resolveSmallerWins:isTableCell immune(never removed);mergeBoxes tableCell w/ inner checkbox→drop checkbox ONLY if cell.area>=3*cb.area(real grading grid);else drop phantom cell keep checkbox(checkbox drawn as 4 lineTos);tableCell→type never textarea^teacher/src/utils/pdfparser/shared/filters.js+v5|legacy/detectors.js
TECH^pdfparser^degenCloze^filterDegenerateInteractiveFields minWxH from computePageMinFontPx+aspect cap text;mergeVerticalLineSegments before buildRectangles^shared/filters.js+v5|legacy/detectors.js+index.js
BUG^pdfparser^tableCellCombinatoric^buildRectanglesFromLines MUST pair adjacent x-sorted verticals (k,k+1) only; all pairs C(V,2) produces spanning phantom hulls^teacher/src/utils/pdfparser/v5|legacy/detectors.js
BUG^pdfparser^angabeCenter^filterBoxesWithTextPrecise Angabe-detect: use computeTextItemViewportBounds center, NOT tx2[0]*item.width (wrong across pdfjs majors)^teacher/src/utils/pdfparser/shared/filters.js
TECH^pdfparser^isolatedLineScope^reject isolated lines only when inside a reconstructed table-cell bbox (tableCellRects), not page-wide skip^teacher/src/utils/pdfparser/v5|legacy/detectors.js+index.js
BUG^pdfparser^resolveSpeckVsCb^resolveSmallerWins oaOverSm=min-area denom; tiny kept cloze erased checkbox^skip if curCb && !kCb && k.area<=220^teacher/src/utils/pdfparser/shared/filters.js
TECH^pdfparser^runWidthPx^computeTextItemViewportBounds+precise overlap use textItemRunWidthPx only^shared/filters.js
TECH^pdfparser^tableCellText^tableCellHasMeaningfulPrintedText: overlap+ratio check, then baseline must be in inner zone (deadZone=min(fontSize*0.5,cellHeight*0.3) from each edge); prevents text from row N bleeding into empty row N-1^shared/filters.js
BUG^pdfparser^tableCellPageHull^filterDegenerateInteractiveFields drop isTableCell when style bbox area>22% viewport^teacher/src/utils/pdfparser/shared/filters.js
BUG^pdfparser^pdfjs5DupGeom^constructPath: inner addBox+processLinePath duplicate rects;skip processLinePath if no lineTo;rect branch dIndex only;buildRectangles H adjacent(i,i+1);angabe after isTableCell^teacher v5|legacy/detectors.js+shared/filters.js
BUG^pdfparser^tableCellVsTableCell^mergeBoxes pass2: both isTableCell+contains→remove i only if areaRatio>=1.5 else continue^peer border tolerance vs spanning hull^teacher/src/utils/pdfparser/shared/filters.js
BUG^pdfparser^deselectVsCellMuch^mergeBoxes cellMuchLarger: keep[j]=false only for checkbox never deselect^teacher/src/utils/pdfparser/shared/filters.js
BUG^pdfparser^runWidthMax^computeTextItemViewportBounds+filterBoxesWithTextPrecise: runWidth=textItemRunWidthPx only no Math.max inflate^shared/filters.js
TECH^pdfparser^dupPass1markCell^mergeBoxes pass1 samePos+size: skip dup if mark+isTableCell pair^shared/filters.js
TECH^pdfparser^resolveMarkVsHull^resolveSmallerWins: mark evicts hull by center-in-hull; hull skips if mark center inside; mark vs hull overlap never removes mark^shared/filters.js
TECH^pdfparser^inferMissingCells^inferMissingTableCells(boxFields,lineStore) called after buildRectanglesFromLines; fills hgaps between cells in same row; fills vgap row below using min(rowHeight,totalGap)^v5/detectors.js
