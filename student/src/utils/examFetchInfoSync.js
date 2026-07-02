// fetchInfo polls getinfoasync ~5s; IPC clones new refs — only assign when content differs (avoid Vue re-renders).

function privateSpellcheckFlagsDiffer(a, b) {
    const x = a || {};
    const y = b || {};
    return x.activate !== y.activate || x.activated !== y.activated || x.suggestions !== y.suggestions;
}

/** True when UI-relevant clientinfo fields differ. */
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

/** Merge getinfo.clientinfo into page vm when clientinfoUiChanged. */
export function applyClientinfoFromFetch(vm, ci, { trackPrivateSpellcheck = false } = {}) {
    if (!ci) return;
    if (!vm.clientinfo) {
        vm.clientinfo = ci;
    } 
    else if (clientinfoUiChanged(ci, vm.clientinfo)) {
        Object.assign(vm.clientinfo, ci);
    }
    if (ci.token !== vm.token) vm.token = ci.token;
    if (ci.focus !== vm.focus) {
        if (!ci.focus && vm.focus && 'entrytime' in vm) vm.entrytime = Date.now();
        vm.focus = ci.focus;
    }
    const reason = ci.focusLockReason || '';
    const message = ci.focusLockMessage || '';
    if (reason !== vm.focusLockReason) vm.focusLockReason = reason;
    if (message !== vm.focusLockMessage) vm.focusLockMessage = message;
    if (ci.name !== vm.clientname) vm.clientname = ci.name;
    if (ci.exammode !== vm.exammode) vm.exammode = ci.exammode;
    if (trackPrivateSpellcheck) {
        const nextPs = ci.privateSpellcheck;
        if (nextPs && privateSpellcheckFlagsDiffer(nextPs, vm.privateSpellcheck)) {
            vm.privateSpellcheck = nextPs;
        }
    }
    const nextOnline = !!ci.token;
    if (nextOnline !== vm.online) vm.online = nextOnline;
}

// Compare fingerprint for activeSheets: filename + payload size, not base64 body (assign still uses full object).
function activeSheetsCompareSlice(sheets) {
    if (!sheets) return null;
    const content = sheets.filecontent;
    return {
        filename: sheets.filename || '',
        filecontentLen: typeof content === 'string' ? content.length : 0,
        filetype: sheets.filetype || '',
        checksum: sheets.checksum || '',
        customFieldsLen: sheets.customFields?.length ?? 0,
        blacklistLen: sheets.blacklist?.length ?? 0,
    };
}

function serverstatusCompareJson(status) {
    return JSON.stringify(status, (key, value) => {
        if (key === 'activeSheets' && value && typeof value === 'object') {
            return activeSheetsCompareSlice(value);
        }
        if (key === 'filecontent' && typeof value === 'string') {
            return value.length;
        }
        return value;
    });
}

/** Deep content compare (IPC always returns new object references). */
export function serverstatusUiChanged(next, cur) {
    if (!cur) return true;
    if (!next) return false;
    return serverstatusCompareJson(next) !== serverstatusCompareJson(cur);
}

/** Assign getinfo.serverstatus when serverstatusUiChanged. */
export function applyServerstatusFromFetch(vm, next) {
    if (!next) return false;
    if (!vm.serverstatus) {
        vm.serverstatus = next;
        return true;
    }
    if (!serverstatusUiChanged(next, vm.serverstatus)) return false;
    vm.serverstatus = next;
    return true;
}

/** allowSectionSwitch ? clientinfo.lockedSection : serverstatus.lockedSection */
export function resolveLockedSection(serverstatus, clientinfo) {
    if (!serverstatus) return null;
    return (serverstatus.allowSectionSwitch && clientinfo?.lockedSection != null)
        ? clientinfo.lockedSection
        : serverstatus.lockedSection;
}

/** Section/group/filename key for activesheets PDF reload. */
export function activeSheetLoadKey(serverstatus, clientinfo, lockedSection) {
    const section = serverstatus?.examSections?.[lockedSection];
    if (!section) return '';
    const groupKey = section.groups && clientinfo?.group === 'b' ? 'groupB' : 'groupA';
    const filename = section[groupKey]?.examConfig?.activeSheets?.filename || '';
    return `${lockedSection}:${groupKey}:${filename}`;
}

/** Wall-clock HH:mm:ss when focus was lost (entrytime stored as Date.now() ms). */
export function formatFocusLostTime(ms) {
    const date = new Date(Number(ms) || 0);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/** Apply focuslost IPC: stamp entrytime once and block UI when teacher lock is active. */
export function applyFocusLostFromIpc(vm, response, development) {
    if (response && !development && !response.focus) {
        if (vm.focus && 'entrytime' in vm) vm.entrytime = Date.now();
        vm.focus = false;
    }
}
