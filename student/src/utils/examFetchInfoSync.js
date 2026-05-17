// fetchInfo polls getinfoasync every ~5s; IPC always returns new object references even when data is unchanged.
// Assigning those to Vue reactive data (this.serverstatus / this.clientinfo) triggers re-renders — avoid unless UI-relevant fields differ.

// True when privateSpellcheck activate/activated/suggestions differ between two clientinfo snapshots.
// Shared by clientinfoUiChanged and editor applyClientinfoFromFetch (trackPrivateSpellcheck).
export function privateSpellcheckFlagsDiffer(a, b) {
    const x = a || {};
    const y = b || {};
    return x.activate !== y.activate || x.activated !== y.activated || x.suggestions !== y.suggestions;
}

// True when any UI-relevant clientinfo field changed (token, focus, group, VM, msofficeshare, …).
// Exam pages call this before Object.assign so unchanged IPC payloads skip Vue re-renders.
export function clientinfoUiChanged(next, cur) {
    if (!cur) return true;
    if (!next) return false;
    return next.token !== cur.token
        || next.focus !== cur.focus
        || next.name !== cur.name
        || next.exammode !== cur.exammode
        || next.pin !== cur.pin
        || next.group !== cur.group
        || !!next.groups !== !!cur.groups
        || next.lockedSection !== cur.lockedSection
        || (next.focusLockReason || '') !== (cur.focusLockReason || '')
        || (next.focusLockMessage || '') !== (cur.focusLockMessage || '')
        || privateSpellcheckFlagsDiffer(next.privateSpellcheck, cur.privateSpellcheck)
        || (next.localVMState || '') !== (cur.localVMState || '')
        || (next.localVMHost || '') !== (cur.localVMHost || '')
        || (next.localVMPort ?? '') !== (cur.localVMPort ?? '')
        || (next.msofficeshare ?? '') !== (cur.msofficeshare ?? '')
        || (next.examtype || '') !== (cur.examtype || '')
        || (next.servername || '') !== (cur.servername || '')
        || (next.serverip || '') !== (cur.serverip || '');
}

// Copy focusLockReason/Message onto the page vm when teacher focus-lock IPC changes.
// Editor overlay reads these; kept separate from generic clientinfo merge.
export function syncFocusLockToVm(vm, clientinfo) {
    const reason = clientinfo?.focusLockReason || '';
    const message = clientinfo?.focusLockMessage || '';
    if (reason !== vm.focusLockReason) vm.focusLockReason = reason;
    if (message !== vm.focusLockMessage) vm.focusLockMessage = message;
}

// Merge getinfo.clientinfo into a page vm: in-place Object.assign only if clientinfoUiChanged.
// Also syncs token/focus/name/exammode/pin/online (and optional privateSpellcheck on editor).
export function applyClientinfoFromFetch(vm, ci, { trackPrivateSpellcheck = false } = {}) {
    if (!ci) return;
    if (!vm.clientinfo) {
        vm.clientinfo = ci;
    } else if (clientinfoUiChanged(ci, vm.clientinfo)) {
        Object.assign(vm.clientinfo, ci);
    }
    if (ci.token !== vm.token) vm.token = ci.token;
    if (ci.focus !== vm.focus) vm.focus = ci.focus;
    syncFocusLockToVm(vm, ci);
    if (ci.name !== vm.clientname) vm.clientname = ci.name;
    if (ci.exammode !== vm.exammode) vm.exammode = ci.exammode;
    if (ci.pin !== vm.pincode) vm.pincode = ci.pin;
    if (trackPrivateSpellcheck) {
        const nextPs = ci.privateSpellcheck;
        if (nextPs && privateSpellcheckFlagsDiffer(nextPs, vm.privateSpellcheck)) {
            vm.privateSpellcheck = nextPs;
        }
    }
    const nextOnline = !!ci.token;
    if (nextOnline !== vm.online) vm.online = nextOnline;
}

// True when serverstatus root fields used by ExamHeader / section switch changed.
// Checked before per-mode examSections compare strings (see examSectionsUiCompareString).
export function serverstatusTopLevelChanged(next, cur) {
    if (!cur) return true;
    if (!next) return false;
    return !!next.allowSectionSwitch !== !!cur.allowSectionSwitch
        || !!next.useExamSections !== !!cur.useExamSections
        || next.lockedSection !== cur.lockedSection
        || next.activeSection !== cur.activeSection
        || (next.password ?? '') !== (cur.password ?? '');
}

// Pick client vs server lockedSection index (allowSectionSwitch + clientinfo.lockedSection).
// Shared section-resolution rule across all exam modes.
export function resolveLockedSection(serverstatus, clientinfo) {
    if (!serverstatus) return null;
    return (serverstatus.allowSectionSwitch && clientinfo?.lockedSection != null)
        ? clientinfo.lockedSection
        : serverstatus.lockedSection;
}

// Assign getinfo.serverstatus only when uiChangedFn says UI-relevant data changed (avoids pointless re-renders).
// Pages still use the full serverstatus object; uiChangedFn only gates whether we replace the reactive reference.
export function applyServerstatusFromFetch(vm, next, uiChangedFn) {
    if (!next) return false;
    if (!vm.serverstatus) {
        vm.serverstatus = next;
        return true;
    }
    if (!uiChangedFn(next, vm.serverstatus)) return false;
    vm.serverstatus = next;
    return true;
}

// Small plain object: editor examConfig fields that can change what editor.vue shows (LT host/port/lang, …).
// Folded into examSectionsUiCompareString; not returned to the page as data.
export function editorExamConfigSlice(cfg) {
    if (!cfg) return null;
    return {
        languagetool: !!cfg.languagetool,
        languagetoolhost: cfg.languagetoolhost || '',
        languagetoolport: cfg.languagetoolport || '',
        spellchecklang: cfg.spellchecklang || '',
        suggestions: !!cfg.suggestions,
    };
}

// Build a compare-only string for examSections: small object (UI subset per mode) → JSON.stringify → string compare.
// mapSection(sec) picks which serverstatus fields matter for that exam mode; unchanged string ⇒ skip this.serverstatus = next.
function examSectionsUiCompareString(status, mapSection) {
    const es = status?.examSections;
    if (!es) return 'null';
    const out = {};
    for (const key of Object.keys(es)) {
        const sec = es[key];
        if (!sec) continue;
        const n = Number(key);
        if (Number.isNaN(n)) continue;
        out[n] = {
            sectionname: sec.sectionname,
            examtype: sec.examtype,
            groups: !!sec.groups,
            ...mapSection(sec),
        };
    }
    return JSON.stringify(out);
}

// Compare string for editor: LT config + audioRepeat per group (see editorExamConfigSlice).
// Used only inside serverstatusEditorUiChanged — not a substitute for this.serverstatus.
export function examSectionsEditorUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        audioRepeat: sec.audioRepeat,
        editorA: editorExamConfigSlice(sec.groupA?.examConfig?.editor),
        editorB: editorExamConfigSlice(sec.groupB?.examConfig?.editor),
    }));
}

// True if assigning the next serverstatus would change anything editor.vue cares about.
export function serverstatusEditorUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsEditorUiJson(next) !== examSectionsEditorUiJson(cur);
}

// activeSheets fields that affect activesheets UI (filename, list sizes — not PDF base64).
function activeSheetsMetaSlice(activeSheets) {
    if (!activeSheets) return null;
    return {
        filename: activeSheets.filename || '',
        customFieldsLen: activeSheets.customFields?.length ?? 0,
        blacklistLen: activeSheets.blacklist?.length ?? 0,
    };
}

// Compare string for activesheets: per section/group only activeSheets metadata (see activeSheetsMetaSlice).
// activesheets.vue still reads full serverstatus; this only decides whether fetchInfo may replace the reactive ref.
export function examSectionsActivesheetsUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        sheetsA: activeSheetsMetaSlice(sec.groupA?.examConfig?.activeSheets),
        sheetsB: activeSheetsMetaSlice(sec.groupB?.examConfig?.activeSheets),
    }));
}

// True if assigning the next serverstatus would change anything activesheets.vue cares about.
export function serverstatusActivesheetsUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsActivesheetsUiJson(next) !== examSectionsActivesheetsUiJson(cur);
}

// Compare string when fetchInfo only needs ExamHeader section labels (geogebra, ms365, …).
export function examSectionsHeaderOnlyUiJson(status) {
    return examSectionsUiCompareString(status, () => ({}));
}

// True if assigning the next serverstatus would change ExamHeader / section metadata for light poll modes.
export function serverstatusExamHeaderUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsHeaderOnlyUiJson(next) !== examSectionsHeaderOnlyUiJson(cur);
}

// eduvidual/Moodle fields that can change eduvidual webview URL or toolbar labels.
function eduvidualConfigSlice(edu) {
    if (!edu) return null;
    return {
        url: edu.url || '',
        moodleDomain: edu.moodleDomain || '',
        moodleTestId: edu.moodleTestId || '',
    };
}

// Compare string for eduvidual mode (Moodle URL slice per group).
export function examSectionsEduvidualUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        eduvidualA: eduvidualConfigSlice(sec.groupA?.examConfig?.eduvidual),
        eduvidualB: eduvidualConfigSlice(sec.groupB?.examConfig?.eduvidual),
    }));
}

// True if assigning the next serverstatus would change anything eduvidual.vue cares about.
export function serverstatusEduvidualUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsEduvidualUiJson(next) !== examSectionsEduvidualUiJson(cur);
}

// website URL + block flags that affect website webview / allowed domain.
function websiteConfigSlice(wc) {
    if (!wc || typeof wc.url !== 'string') return null;
    return {
        url: wc.url,
        blockSubdomains: !!wc.blockSubdomains,
        blockSubfolders: !!wc.blockSubfolders,
    };
}

// Compare string for website mode.
export function examSectionsWebsiteUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        websiteA: websiteConfigSlice(sec.groupA?.examConfig?.website),
        websiteB: websiteConfigSlice(sec.groupB?.examConfig?.website),
    }));
}

// True if assigning the next serverstatus would change anything website.vue cares about.
export function serverstatusWebsiteUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsWebsiteUiJson(next) !== examSectionsWebsiteUiJson(cur);
}

// localvm disk name + verify mode (hash vs size) for VM preflight / download UI.
function localvmConfigSlice(cfg) {
    if (!cfg) return null;
    return {
        qcow2Name: cfg.qcow2Name || '',
        calculateSha256: !!cfg.calculateSha256,
    };
}

// Compare string for localvm mode.
export function examSectionsLocalvmUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        localvmA: localvmConfigSlice(sec.groupA?.examConfig?.localvm),
        localvmB: localvmConfigSlice(sec.groupB?.examConfig?.localvm),
    }));
}

// True if assigning the next serverstatus would change anything localvmview.vue cares about.
export function serverstatusLocalvmUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsLocalvmUiJson(next) !== examSectionsLocalvmUiJson(cur);
}

// student.vue lobby: same compare subset as localvm (VM download overlay reads qcow2 from serverstatus).
export function serverstatusStudentLobbyUiChanged(next, cur) {
    return serverstatusLocalvmUiChanged(next, cur);
}

// Compare string for forms mode (formsUrl per section).
export function examSectionsFormsUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        formsUrl: sec.formsUrl || '',
    }));
}

// True if assigning the next serverstatus would change anything forms.vue cares about.
export function serverstatusFormsUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsFormsUiJson(next) !== examSectionsFormsUiJson(cur);
}

// RDP domain + protocol fields that determine RD webclient URL.
function rdpConfigSlice(rdp) {
    if (!rdp) return null;
    return {
        domain: rdp.domain || '',
        protocol: rdp.protocol === 'http' ? 'http' : 'https',
    };
}

// Compare string for rdpview mode.
export function examSectionsRdpUiJson(status) {
    return examSectionsUiCompareString(status, (sec) => ({
        rdpA: rdpConfigSlice(sec.groupA?.examConfig?.rdp),
        rdpB: rdpConfigSlice(sec.groupB?.examConfig?.rdp),
    }));
}

// True if assigning the next serverstatus would change anything rdpview.vue cares about.
export function serverstatusRdpUiChanged(next, cur) {
    if (serverstatusTopLevelChanged(next, cur)) return true;
    return examSectionsRdpUiJson(next) !== examSectionsRdpUiJson(cur);
}

// Runtime key for which PDF to load (section + group + filename) — separate from serverstatus compare strings.
export function activeSheetLoadKey(serverstatus, clientinfo, lockedSection) {
    const section = serverstatus?.examSections?.[lockedSection];
    if (!section) return '';
    const groupKey = section.groups && clientinfo?.group === 'b' ? 'groupB' : 'groupA';
    const filename = section[groupKey]?.examConfig?.activeSheets?.filename || '';
    return `${lockedSection}:${groupKey}:${filename}`;
}
