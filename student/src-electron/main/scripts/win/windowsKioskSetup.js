/**
 * Windows counterpart to Linux Cage kiosk setup.
 * - detectRunningInWindowsKiosk(): kiosk OS user + provisioned SID + live AA (cmd spawn blocked and/or RestrictRun reg / MDM)
 * - detectWindowsKioskInstalled(): true when provisioning artifacts exist
 * - needsWindowsKioskSetup(): inverse, used by UI install button
 * - initiateKioskSetup(appPath): platform switch + UAC elevation + PowerShell payload
 *
 * Shares public field names with cage (runningInCage etc.) so renderer logic is unchanged.
 */
import { execFileSync, execSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import log from 'electron-log';

export const KIOSK_USERNAME = 'next-exam-kiosk';
export const KIOSK_INSTALL_DIR = 'C:\\NextExam';
// written only when install-windows-kiosk.ps1 finishes (incl. MDM); partial runs must not hide the UI button
export const KIOSK_PROVISION_MARKER = 'C:\\NextExam\\.kiosk-provision-complete';
const KIOSK_ACCOUNT_SID_MARKER = path.join(KIOSK_INSTALL_DIR, '.kiosk-account-sid');
const KIOSK_LAUNCH_EXE_MARKER = 'C:\\NextExam\\.kiosk-launch-exe.txt';
const KIOSK_LAUNCHER_APPS_JSON = path.join(KIOSK_INSTALL_DIR, 'kiosk-launcher-apps.json');
// Must match install-windows-kiosk.ps1 AssignedAccess Profile Id
export const KIOSK_AA_PROFILE_ID = '{9A2A490F-10F6-4764-974A-43B19E722C23}';
const INTERNAL_KIOSK_ALLOWED_EXE_NAMES = new Set([
    'java.exe', 'javaw.exe', 'disable-shortcuts.exe', 'netsh.exe',
    'powershell.exe', 'reg.exe', 'whoami.exe', 'next-exam-student.exe',
]);
const KIOSK_BUNDLE_LAUNCH_EXE_CANDIDATES = ['Next-Exam-Student.exe', 'next-exam.exe'];
const KIOSK_BUNDLE_PORTABLE_UNPACK_DIR = path.join(os.tmpdir(), 'next-exam-student');
const KIOSK_BUNDLE_MSI_INSTALL_DIR = 'C:\\Program Files\\Next-Exam-Student';

/**
 * Wipe leftover student data on kiosk app quit so the next student starts fresh.
 * - wipes contents of workdirectory (EXAM-STUDENT) entry-by-entry; active logfile is skipped
 *   because electron-log keeps it open and rmSync(recursive) would fail EPERM/EBUSY otherwise.
 * - empties common user folders (Desktop, Documents, Downloads, Pictures, Videos, Music) so
 *   nothing dropped via the Downloads namespace survives the session.
 * Locked files are logged and skipped, not raised. Caller may skip the workdir wipe via
 * { skipWorkdir: true } to keep behaviour focused on one or the other.
 */
export function wipeKioskUserFiles({ workdirectory, activeLogFile = 'next-exam-student.log', skipWorkdir = false } = {}) {
    if (process.platform !== 'win32') return;
    const removeEntries = (dir, skipName = '') => {
        if (!existsSync(dir)) return { removed: 0, skipped: 0 };
        let removed = 0, skipped = 0;
        for (const entry of readdirSync(dir)) {
            if (skipName && entry === skipName) { skipped++; continue; }
            try {
                rmSync(path.join(dir, entry), { recursive: true, force: true });
                removed++;
            } catch (err) {
                skipped++;
                log.warn(`wipeKioskUserFiles: skip ${path.join(dir, entry)}: ${err.code || err.message}`);
            }
        }
        return { removed, skipped };
    };
    if (!skipWorkdir && workdirectory) {
        const r = removeEntries(workdirectory, path.basename(activeLogFile));
        log.info(`wipeKioskUserFiles: workdirectory ${workdirectory} (${r.removed} removed, ${r.skipped} skipped)`);
    }
    const home = os.homedir();
    for (const folder of ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music']) {
        const dir = path.join(home, folder);
        const r = removeEntries(dir);
        if (r.removed || r.skipped) {
            log.info(`wipeKioskUserFiles: ${folder} (${r.removed} removed, ${r.skipped} skipped)`);
        }
    }
}

/** True when dir looks like a packaged Electron app (portable unpack or MSI install folder). */
function isElectronAppBundleDir(dir) {
    if (!dir || !existsSync(dir)) return false;
    return existsSync(path.join(dir, 'resources', 'app.asar'))
        || existsSync(path.join(dir, 'resources', 'app'))
        || existsSync(path.join(dir, 'locales'));
}

/** First launch exe name present in a valid Electron bundle dir. */
function findLaunchExeInBundleDir(appDir) {
    for (const name of KIOSK_BUNDLE_LAUNCH_EXE_CANDIDATES) {
        if (existsSync(path.join(appDir, name))) return name;
    }
    return null;
}

/** Resolve bundle dir + launch exe when dir contains resources\\ (Electron unpack or MSI install). */
function tryResolveBundleFromDir(appDir) {
    if (!appDir || !isElectronAppBundleDir(appDir)) return null;
    const launchExe = findLaunchExeInBundleDir(appDir);
    if (!launchExe) return null;
    return { appDir: path.resolve(appDir), launchExe };
}

/** Resolves the full app tree to copy (not the NSIS portable launcher in Downloads). */
export function resolveWindowsKioskAppBundle() {
    if (!app.isPackaged) {
        return { ok: false, error: 'Kiosk setup requires a packaged Next-Exam build (not dev/quasar).' };
    }
    const candidates = [];
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
    if (portableDir) candidates.push(portableDir);
    candidates.push(path.dirname(process.execPath));
    candidates.push(KIOSK_BUNDLE_PORTABLE_UNPACK_DIR);
    candidates.push(KIOSK_BUNDLE_MSI_INSTALL_DIR);
    const seen = new Set();
    for (const dir of candidates) {
        const key = path.resolve(dir).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const hit = tryResolveBundleFromDir(dir);
        if (hit) {
            log.info(`windowsKioskSetup: detected source bundle=${hit.appDir} launch=${hit.launchExe}`);
            return { ok: true, appDir: hit.appDir, launchExe: hit.launchExe };
        }
    }
    return {
        ok: false,
        error: 'Could not locate Next-Exam app folder (portable unpack, running exe dir, or MSI Program Files).',
    };
}

/** IPC success payload including paths copied from (for log + optional UI). */
function kioskSetupSuccessResult(bundle) {
    log.info(`windowsKioskSetup: provisioning from ${bundle.appDir} (${bundle.launchExe}) → ${KIOSK_INSTALL_DIR}`);
    return { ok: true, kioskSourceDir: bundle.appDir, kioskLaunchExe: bundle.launchExe };
}

/** Absolute path to the kiosk-installed launch exe, if provisioned. */
export function resolveKioskInstalledLaunchExe() {
    if (process.platform !== 'win32') return null;
    if (existsSync(KIOSK_LAUNCH_EXE_MARKER)) {
        try {
            const name = readFileSync(KIOSK_LAUNCH_EXE_MARKER, 'utf8').trim();
            const p = path.join(KIOSK_INSTALL_DIR, name);
            if (name && existsSync(p)) return p;
        } catch { /* fall through */ }
    }
    for (const name of ['Next-Exam-Student.exe', 'next-exam.exe']) {
        const p = path.join(KIOSK_INSTALL_DIR, name);
        if (existsSync(p)) return p;
    }
    return null;
}

// resolve packaged vs dev path to the PowerShell payload
function resolveProvisioningScript() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'win32', 'install-windows-kiosk.ps1');
    }
    return path.join(process.cwd(), 'src-electron', 'resources', 'win32', 'install-windows-kiosk.ps1');
}

/** True when the interactive account name matches the provisioned kiosk user (not sufficient alone). */
export function isWindowsKioskOsUser() {
    if (process.platform !== 'win32') return false;
    try {
        const u = (os.userInfo().username || '').toLowerCase();
        return u === KIOSK_USERNAME.toLowerCase();
    } catch {
        return false;
    }
}

/** Spawn a System32 exe directly (no cmd.exe wrapper — AA blocks cmd even when powershell is allowed). */
function winSystem32ExecFile(exeName, args, timeoutMs = 8000) {
    const exePath = path.join(process.env.windir || 'C:\\Windows', 'System32', exeName);
    return execFileSync(exePath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: timeoutMs,
        windowsHide: true,
    });
}

/** PowerShell from its real path (same as install-windows-kiosk.ps1 AllowedApps entry). */
function winPowerShellExecFile(args, timeoutMs = 15000) {
    const exePath = path.join(
        process.env.windir || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
    );
    return execFileSync(exePath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: timeoutMs,
        windowsHide: true,
    });
}

/**
 * Live session SID: whoami /user (token) first, then ProfileList+USERPROFILE via reg.exe (both must be AllowedApps under AA).
 */
function getCurrentUserSid() {
    if (process.platform !== 'win32') return '';
    try {
        const out = winSystem32ExecFile('whoami.exe', ['/user']);
        const m = String(out || '').match(/S-1-\d+(-\d+)+/);
        if (m) return m[0].trim();
    } catch { /* fall through to reg */ }
    const userProfile = (process.env.USERPROFILE || '').trim().toLowerCase();
    if (!userProfile) return '';
    const listOut = String(runRegQuery('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList') || '');
    const sids = [...listOut.matchAll(/(S-1-5-21-[0-9-]+)/g)].map((m) => m[1]);
    const seen = new Set();
    for (const sid of sids) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        const pathOut = String(runRegQuery(`HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\${sid}`, 'ProfileImagePath') || '');
        const pm = pathOut.match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/im);
        const profilePath = pm ? pm[1].trim().toLowerCase() : '';
        if (profilePath && profilePath === userProfile) return sid;
    }
    return '';
}

/** reg.exe query; returns stdout string ('' if key/value missing or stdout is empty/null). */
function runRegQuery(keyPath, valueName = '') {
    const args = valueName ? ['query', keyPath, '/v', valueName] : ['query', keyPath];
    try {
        const out = winSystem32ExecFile('reg.exe', args);
        return typeof out === 'string' ? out : (out == null ? '' : String(out));
    } catch (err) {
        return err && err.stdout != null ? String(err.stdout) : '';
    }
}

/** Parse DWORD from reg.exe /v output (0x80 or decimal). */
function parseRegDword(regOutput) {
    const hex = regOutput.match(/REG_DWORD\s+0x([0-9a-f]+)/i);
    if (hex) return parseInt(hex[1], 16);
    const dec = regOutput.match(/REG_DWORD\s+(\d+)/i);
    return dec ? parseInt(dec[1], 10) : NaN;
}

/** One-line reg output for logs (avoid multi-line spam). */
function regSnippet(regOutput, maxLen = 280) {
    return String(regOutput || '').replace(/\r?\n/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, maxLen) || '(empty)';
}

// HKCU RestrictRun AssignedAccess_* — reg.exe (same execFileSync path as ProfileList; key missing = not AA RestrictRun).
function readRestrictRunAaFromReg() {
    const restrictRunKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun';
    const explorerKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer';
    const restrictRunOut = runRegQuery(restrictRunKey);
    const explorerRestrictRunValueOut = runRegQuery(explorerKey, 'RestrictRun');
    const explorerOut = runRegQuery(explorerKey);
    return {
        restrictRunKeyHasAssignedAccess: /AssignedAccess_/i.test(restrictRunOut),
        explorerRestrictRunDwordIs1: parseRegDword(explorerRestrictRunValueOut) === 1,
        explorerKeyHasAssignedAccess: /AssignedAccess_/i.test(explorerOut),
        restrictRunOut,
        explorerRestrictRunValueOut,
        explorerOut,
    };
}

// cmd.exe is intentionally not on the AA allow list — spawn failure (UNKNOWN) indicates live allow-list enforcement.
let aaCmdSpawnProbeCache = null;
function probeCmdSpawnBlockedByAssignedAccess() {
    if (process.platform !== 'win32') return { blocked: false, reason: 'non-win32' };
    if (aaCmdSpawnProbeCache) return aaCmdSpawnProbeCache;
    try {
        winSystem32ExecFile('cmd.exe', ['/c', 'exit', '0'], 2500);
        aaCmdSpawnProbeCache = { blocked: false, reason: 'cmd.exe ran (AA allow-list not blocking)' };
    } catch (err) {
        const reason = String(err && err.message ? err.message : err);
        aaCmdSpawnProbeCache = { blocked: true, reason };
    }
    return aaCmdSpawnProbeCache;
}

/** Parse AssignedAccess_* value names from reg.exe query output. */
function parseAssignedAccessExeNamesFromReg(regOut) {
    const names = [];
    for (const line of String(regOut || '').split(/\r?\n/)) {
        const m = line.match(/AssignedAccess_\S+\s+REG_\w+\s+(.+?)\s*$/i);
        if (m) names.push(m[1].trim());
    }
    return [...new Set(names)];
}

// MDM_AssignedAccess CSP only (needs System.Web + CIM; separate from RestrictRun reg reads).
function readMdmConfigurationFromPs() {
    const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$cfg = ''
$mdmOk = $false
$err = ''
try {
  Add-Type -AssemblyName System.Web | Out-Null
  $filter = "InstanceID='AssignedAccess' AND ParentID='./Vendor/MSFT/'"
  $obj = Get-CimInstance -Namespace 'root\\cimv2\\mdm\\dmmap' -ClassName 'MDM_AssignedAccess' -Filter $filter -ErrorAction SilentlyContinue
  if (-not $obj) {
    $obj = Get-CimInstance -Namespace 'root\\cimv2\\mdm\\dmmap' -ClassName 'MDM_AssignedAccess' -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if ($obj -and $obj.Configuration) {
    $mdmOk = $true
    $cfg = [System.Web.HttpUtility]::HtmlDecode([string]$obj.Configuration)
  }
} catch { $err = $_.Exception.Message }
@{ mdmOk = $mdmOk; configuration = $cfg; error = $err } | ConvertTo-Json -Compress
exit 0
`;
    const data = runPowerShellJson(ps, 8000);
    if (!data) {
        return { mdmOk: false, configuration: '', psError: 'powershell spawn or JSON parse failed (see runPowerShellJson)' };
    }
    const psError = String(data.error || '').trim();
    if (psError) {
        log.debug(`windowsKioskSetup: MDM PS: ${psError}`);
    }
    return {
        mdmOk: !!data.mdmOk,
        configuration: String(data.configuration || ''),
        psError,
    };
}

let aaSessionSignalsCache = null;
function readWindowsAaSessionSignals() {
    if (process.platform !== 'win32') {
        return {
            restrictRunKeyHasAssignedAccess: false, explorerRestrictRunDwordIs1: false,
            explorerKeyHasAssignedAccess: false, mdmOk: false, configuration: '', mdmPsError: 'non-win32',
            regSnippets: { restrictRunOut: '', explorerRestrictRunValueOut: '', explorerOut: '' },
        };
    }
    if (aaSessionSignalsCache) return aaSessionSignalsCache;
    const regAa = readRestrictRunAaFromReg();
    const mdm = readMdmConfigurationFromPs();
    aaSessionSignalsCache = {
        restrictRunKeyHasAssignedAccess: regAa.restrictRunKeyHasAssignedAccess,
        explorerRestrictRunDwordIs1: regAa.explorerRestrictRunDwordIs1,
        explorerKeyHasAssignedAccess: regAa.explorerKeyHasAssignedAccess,
        mdmOk: mdm.mdmOk,
        configuration: mdm.configuration,
        mdmPsError: mdm.psError,
        regSnippets: {
            restrictRunOut: regSnippet(regAa.restrictRunOut),
            explorerRestrictRunValueOut: regSnippet(regAa.explorerRestrictRunValueOut),
            explorerOut: regSnippet(regAa.explorerOut),
        },
    };
    return aaSessionSignalsCache;
}

function readMdmAssignedAccessForCurrentUser() {
    if (process.platform !== 'win32') return { ok: false, configured: false, reason: 'non-win32' };
    const s = readWindowsAaSessionSignals();
    const xml = s.configuration;
    const re = new RegExp(`<Account>[^<]*\\\\${KIOSK_USERNAME}<\\/Account>`, 'i');
    const configured = !!xml && re.test(xml);
    return {
        ok: s.mdmOk,
        configured,
        reason: configured
            ? 'MDM AA policy lists kiosk user'
            : (s.mdmOk ? 'MDM AA policy present but does not target kiosk user'
                : (s.mdmPsError || 'MDM_AssignedAccess CSP unreadable')),
    };
}

// Detection snapshot: reg.exe RestrictRun + optional MDM PS (cached per session).
// State=128, SID, MDM config, Winlogon Shell, username don't change within a session, and RestrictRun
// is set at logon and stays — so cache aggressively.
const DETECTION_CACHE_TTL_MS = 60_000;
let detectionCache = null;
let detectionCachedAt = 0;

/** Full Win AA / kiosk detection snapshot (single reg/whoami pass, cached for DETECTION_CACHE_TTL_MS). */
function evaluateWindowsKioskDetection({ force = false } = {}) {
    if (process.platform !== 'win32') {
        return { runningInCage: false, kioskOsUser: false, username: '', sid: '', assignedAccessActive: false,
            aaCheck: {}, aaProof: false, mdm: { ok: false, configured: false, reason: 'non-win32' },
            winlogonShellMatch: false, regSnippets: {}, provisionedSid: false, provisionedSidReason: 'non-win32',
            provisionMarkerExists: false, sidMarkerExists: false, sidMarkerValue: '',
            profileStateDword: null, profilePathMatch: false, profileState128: false };
    }
    const now = Date.now();
    if (!force && detectionCache && now - detectionCachedAt < DETECTION_CACHE_TTL_MS) {
        return detectionCache;
    }
    const snapshot = evaluateWindowsKioskDetectionUncached();
    detectionCache = snapshot;
    detectionCachedAt = now;
    return snapshot;
}

function evaluateWindowsKioskDetectionUncached() {
    const username = (() => {
        try { return os.userInfo().username || ''; } catch { return ''; }
    })();
    const kioskOsUser = process.platform === 'win32' && username.toLowerCase() === KIOSK_USERNAME.toLowerCase();
    const sid = getCurrentUserSid();

    const aaSig = readWindowsAaSessionSignals();
    const aaCheck = {
        restrictRunKeyHasAssignedAccess: aaSig.restrictRunKeyHasAssignedAccess,
        explorerRestrictRunDwordIs1: aaSig.explorerRestrictRunDwordIs1,
        explorerKeyHasAssignedAccess: aaSig.explorerKeyHasAssignedAccess,
    };
    const cmdProbe = probeCmdSpawnBlockedByAssignedAccess();
    const assignedAccessActive = aaSig.restrictRunKeyHasAssignedAccess
        || (aaSig.explorerRestrictRunDwordIs1 && aaSig.explorerKeyHasAssignedAccess)
        || cmdProbe.blocked;
    const mdm = readMdmAssignedAccessForCurrentUser();
    const restrictRunOut = aaSig.regSnippets.restrictRunOut;
    const explorerRestrictRunValueOut = aaSig.regSnippets.explorerRestrictRunValueOut;
    const explorerOut = aaSig.regSnippets.explorerOut;

    // Winlogon Shell override: AA sets the kiosk app as the user's shell. Secondary confirmation that
    // the session is currently under AA control rather than a fake account that just happens to match.
    const winlogonShellOut = runRegQuery('HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', 'Shell');
    const winlogonShellMatch = /next-exam-student\.exe|nextexam/i.test(winlogonShellOut);

    const provisionMarkerExists = existsSync(KIOSK_PROVISION_MARKER);
    const sidMarkerExists = existsSync(KIOSK_ACCOUNT_SID_MARKER);
    let sidMarkerValue = '';
    if (sidMarkerExists) {
        try { sidMarkerValue = readFileSync(KIOSK_ACCOUNT_SID_MARKER, 'utf8').trim(); } catch { /* ignore */ }
    }
    let provisionedSid = false;
    let provisionedSidReason = '';
    if (sid && sidMarkerExists) {
        provisionedSid = sidMarkerValue === sid;
        provisionedSidReason = provisionedSid
            ? 'live sid matches .kiosk-account-sid'
            : `live sid mismatch file=${sidMarkerValue || '(empty)'} current=${sid}`;
    } else if (sid && !sidMarkerExists) {
        provisionedSid = provisionMarkerExists;
        provisionedSidReason = provisionedSid
            ? 'live sid ok but no .kiosk-account-sid; fallback provision marker'
            : 'live sid but no .kiosk-account-sid and no provision marker';
    } else if (!sid) {
        provisionedSid = kioskOsUser && provisionMarkerExists;
        provisionedSidReason = provisionedSid
            ? 'sid lookup (whoami + ProfileList) failed; fallback kiosk user + provision marker'
            : 'sid lookup (whoami + ProfileList) failed';
    }

    // When live SID lookup fails (reg/whoami blocked), use install-time marker for ProfileList reads.
    const sidForProfile = sid || sidMarkerValue;
    const profileKey = sidForProfile ? `HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\${sidForProfile}` : '';
    const profileStateOut = profileKey ? runRegQuery(profileKey, 'State') : '';
    const profileStateDword = parseRegDword(profileStateOut);
    const profilePathOut = profileKey ? runRegQuery(profileKey, 'ProfileImagePath') : '';
    const profilePathMatch = /\\next-exam-kiosk\b/i.test(profilePathOut);
    const profileEnvMatch = /\\next-exam-kiosk$/i.test(
        (process.env.USERPROFILE || os.homedir() || '').replace(/\//g, '\\'),
    );
    const profileState128 = profileStateDword === 128 || profilePathMatch || profileEnvMatch;

    // Live AA: RestrictRun reg and/or cmd blocked (not on allow list). MDM/shell are optional extras.
    const aaProof = assignedAccessActive || mdm.configured || winlogonShellMatch;
    // Kiosk session: correct account + provisioned SID + live AA (cmd probe alone is never sufficient).
    const runningInCage = kioskOsUser && provisionedSid && aaProof;

    return {
        runningInCage,
        kioskOsUser,
        username,
        sid,
        assignedAccessActive,
        cmdSpawnBlocked: cmdProbe.blocked,
        cmdSpawnProbeReason: cmdProbe.reason,
        aaCheck,
        aaSig,
        aaProof,
        mdm,
        winlogonShellMatch,
        regSnippets: {
            restrictRunOut: regSnippet(restrictRunOut),
            explorerRestrictRunValueOut: regSnippet(explorerRestrictRunValueOut),
            explorerOut: regSnippet(explorerOut),
            profileStateOut: regSnippet(profileStateOut),
            profilePathOut: regSnippet(profilePathOut),
            winlogonShellOut: regSnippet(winlogonShellOut),
        },
        provisionedSid,
        provisionedSidReason,
        provisionMarkerExists,
        sidMarkerExists,
        sidMarkerValue,
        profileStateDword: Number.isFinite(profileStateDword) ? profileStateDword : null,
        profilePathMatch,
        profileEnvMatch,
        profileState128,
    };
}

/** One-line Win AA kiosk session verdict with reason. */
function formatKioskAaDetectionLine(d) {
    if (d.runningInCage) {
        const aaVia = [];
        if (d.cmdSpawnBlocked) aaVia.push('cmd blocked');
        if (d.aaCheck.restrictRunKeyHasAssignedAccess) aaVia.push('RestrictRun');
        if (d.aaCheck.explorerRestrictRunDwordIs1 && d.aaCheck.explorerKeyHasAssignedAccess) aaVia.push('Explorer RestrictRun');
        if (d.mdm.configured) aaVia.push('MDM');
        if (d.winlogonShellMatch) aaVia.push('Winlogon shell');
        return `windowsKioskSetup: Win AA kiosk=YES — ${d.username || KIOSK_USERNAME}, sid ok, AA via ${aaVia.join(', ') || 'unknown'}`;
    }
    const why = [];
    if (!d.kioskOsUser) why.push(`user≠${KIOSK_USERNAME}`);
    if (!d.provisionedSid) why.push(d.provisionedSidReason || 'sid not provisioned');
    if (!d.aaProof) why.push('AA inactive (no cmd block, RestrictRun, MDM, or shell)');
    return `windowsKioskSetup: Win AA kiosk=NO — ${why.join('; ') || 'unknown'}`;
}

/** Warn line for external Start pins only; null when none. */
function formatExtraKioskAppsLine(data) {
    if (!data?.ok) return null;
    const pinNames = (data.notInLauncherJsonPins || []).map((p) => p.name).filter(Boolean);
    if (!pinNames.length) return null;
    return `windowsKioskSetup: extra kiosk apps=${pinNames.length} — ${pinNames.join('; ')}`;
}

/** SID written at provisioning; blocks renaming another account to next-exam-kiosk. */
function isProvisionedKioskAccountSid() {
    return evaluateWindowsKioskDetection().provisionedSid;
}

/** True when AA applied RestrictRun allow-list values to this session. */
export function isWindowsAssignedAccessSessionActive() {
    return evaluateWindowsKioskDetection().assignedAccessActive;
}

/** Kiosk profile: State=128 (0x80) or ProfileImagePath under next-exam-kiosk. */
function isKioskProfileState128() {
    return evaluateWindowsKioskDetection().profileState128;
}

/** Win AA kiosk session: kiosk OS user + provisioned account + AA signal or profile-128 (username alone never enough). */
export function detectRunningInWindowsKiosk() {
    if (process.platform !== 'win32') return false;
    return evaluateWindowsKioskDetection().runningInCage;
}

/** Read Start pins + HKLM AllowedApps once per session; returns read result for startup log line. */
function initAllowedKioskAppsAtSessionStart(runningInCage) {
    if (process.platform !== 'win32') return null;
    if (!runningInCage) {
        allowedKioskAppsCache = null;
        allowedKioskAppsCachedAt = 0;
        return null;
    }
    if (allowedKioskAppsCache) {
        if (allowedKioskAppsCache.error) return { ok: false, error: allowedKioskAppsCache.error };
        return {
            ok: true,
            notInLauncherJsonPins: (allowedKioskAppsCache.pinDriftNames || []).map((name) => ({ name })),
        };
    }
    const data = readKioskSystemAllowedApps();
    if (data.ok) {
        allowedKioskAppsCache = {
            startLayoutReadable: data.startLayoutReadable,
            appNames: buildKioskHumanAppNames(data.notInLauncherJsonPins),
            pinDriftNames: (data.notInLauncherJsonPins || []).map((p) => p.name).filter(Boolean),
        };
    } else {
        allowedKioskAppsCache = { error: data.error || 'read failed' };
    }
    allowedKioskAppsCachedAt = Date.now();
    return data;
}

/** Startup: AA verdict (info) + extra pins drift (warn, only when found). */
export function getWindowsKioskDetectionLogLines() {
    if (process.platform !== 'win32') return [];
    const d = evaluateWindowsKioskDetection();
    log.info(formatKioskAaDetectionLine(d));
    const appsData = initAllowedKioskAppsAtSessionStart(d.runningInCage);
    const extraAppsLine = formatExtraKioskAppsLine(appsData);
    if (extraAppsLine) log.warn(extraAppsLine);
    return [];
}

/** True when the full app bundle was copied to C:\NextExam (launch exe present). */
export function detectWindowsKioskInstalled() {
    if (process.platform !== 'win32') return false;
    return !!resolveKioskInstalledLaunchExe();
}

/** True when elevated provisioning completed end-to-end (not merely user+exe from a failed run). */
export function detectWindowsKioskProvisionComplete() {
    if (process.platform !== 'win32') return false;
    return existsSync(KIOSK_PROVISION_MARKER);
}

/** True when the local kiosk OS user already exists (best-effort, swallow errors). */
export function detectWindowsKioskUserExists() {
    if (process.platform !== 'win32') return false;
    // If we're already running as the kiosk user, the account exists by definition.
    if (isWindowsKioskOsUser()) return true;
    try {
        // Get-LocalUser exits non-zero when missing; swallow stderr to avoid noise
        execSync(`powershell.exe -NoProfile -NonInteractive -Command "Get-LocalUser -Name '${KIOSK_USERNAME}' | Out-Null"`,
            { stdio: ['ignore', 'ignore', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}

/** Drop main exam exe from launcher bar entries (autolaunch only, no button). */
function withoutMainExamLauncherApps(list) {
    return list.filter((a) => !/next-exam-student/i.test(a.name || '') && !/next-exam-student\.exe$/i.test(a.path || ''));
}

/**
 * Run a PowerShell script and parse its JSON stdout (UTF-16LE -EncodedCommand).
 * Caller-safe: returns null on any spawn/JSON failure instead of throwing — every call site
 * lives in detection paths that run on the main thread and an uncaught throw kills the renderer.
 */
function runPowerShellJson(script, timeoutMs = 15000) {
    if (process.platform !== 'win32') return null;
    try {
        const b64 = Buffer.from(String(script), 'utf16le').toString('base64');
        const out = winPowerShellExecFile([
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64,
        ], timeoutMs);
        const text = String(out || '').trim();
        if (!text) return null;
        return JSON.parse(text);
    } catch (err) {
        const stdout = err && err.stdout != null ? String(err.stdout).trim() : '';
        if (stdout) {
            try { return JSON.parse(stdout); } catch { /* fall through */ }
        }
        const detail = [err && err.message, err && err.stderr != null ? String(err.stderr).trim() : '']
            .filter(Boolean).join(' | ');
        log.warn(`runPowerShellJson: ${detail || err}`);
        return null;
    }
}

/** Expand %VAR% segments using the current process environment. */
function expandWinEnvPath(raw) {
    return String(raw).replace(/%([^%]+)%/g, (_, n) => process.env[n] || `%${n}%`);
}

/** True for install-time internal AllowedApps (never student-facing launcher buttons). */
function isInternalKioskAllowedPath(p) {
    return INTERNAL_KIOSK_ALLOWED_EXE_NAMES.has(path.basename(String(p)).toLowerCase());
}

/** Live AA Start pins: %LOCALAPPDATA%\\Microsoft\\Windows\\Shell\\LayoutModification.xml */
function liveShellLayoutModificationPath() {
    return path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Shell', 'LayoutModification.xml');
}

/** Extract Start/taskbar pin paths and AUMIDs from LayoutModification.xml. */
function parseStartLayoutPinsFromXml(xml) {
    const desktopPaths = [];
    const appUserModelIds = [];
    const s = String(xml || '');
    for (const m of s.matchAll(/DesktopApplicationLinkPath="([^"]+)"/gi)) {
        desktopPaths.push(path.resolve(expandWinEnvPath(m[1])));
    }
    for (const m of s.matchAll(/DesktopApplicationLink="([^"]+)"/gi)) {
        desktopPaths.push(path.resolve(expandWinEnvPath(m[1])));
    }
    for (const m of s.matchAll(/AppUserModelID="([^"]+)"/gi)) {
        appUserModelIds.push(m[1]);
    }
    return {
        desktopPaths: [...new Set(desktopPaths)],
        appUserModelIds: [...new Set(appUserModelIds)],
    };
}

/** Read live Start pins from the kiosk user shell layout file (no MDM/CIM). */
function readLiveStartLayoutPins() {
    const layoutPath = liveShellLayoutModificationPath();
    if (!existsSync(layoutPath)) {
        return { ok: false, layoutPath, desktopPaths: [], appUserModelIds: [], error: 'LayoutModification.xml missing' };
    }
    try {
        const xml = readFileSync(layoutPath, 'utf8');
        const parsed = parseStartLayoutPinsFromXml(xml);
        return { ok: true, layoutPath, ...parsed, error: '' };
    } catch (err) {
        return { ok: false, layoutPath, desktopPaths: [], appUserModelIds: [], error: err.message || String(err) };
    }
}

/** Parse AppId REG_SZ paths from reg.exe query /s on AssignedAccess AllowedApps. */
function parseAssignedAccessAppIdsFromReg(regOut) {
    const paths = [];
    for (const line of String(regOut || '').split(/\r?\n/)) {
        const m = line.match(/^\s*AppId\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/i);
        if (m) paths.push(path.resolve(expandWinEnvPath(m[1].trim())));
    }
    return [...new Set(paths)];
}

/** HKLM AssignedAccess AllowedApps for the provisioned profile (reg.exe /s, no MDM). */
function readAssignedAccessAllowedAppsFromReg() {
    const key = `HKLM\\SOFTWARE\\Microsoft\\Windows\\AssignedAccessConfiguration\\Profiles\\${KIOSK_AA_PROFILE_ID}\\AllowedApps`;
    try {
        const out = winSystem32ExecFile('reg.exe', ['query', key, '/s']);
        const desktopPaths = parseAssignedAccessAppIdsFromReg(out);
        return { ok: desktopPaths.length > 0, desktopPaths, regSnippet: regSnippet(out) };
    } catch (err) {
        const partial = parseAssignedAccessAppIdsFromReg(err && err.stdout != null ? String(err.stdout) : '');
        return {
            ok: partial.length > 0,
            desktopPaths: partial,
            regSnippet: regSnippet(err && err.stdout != null ? String(err.stdout) : ''),
            error: err.message || String(err),
        };
    }
}

/** OS paths not in kiosk-launcher-apps.json, excluding internal AllowedApps. */
function pathsNotInLauncherJson(paths, launcherJsonPaths) {
    const jsonNorm = new Set(launcherJsonPaths.map((p) => path.resolve(p).toLowerCase()));
    return paths.filter((p) => {
        const resolved = path.resolve(p);
        if (isInternalKioskAllowedPath(resolved)) return false;
        return !jsonNorm.has(resolved.toLowerCase());
    });
}

/** AUMID pins are always drift (we never write Start pins). */
function aumidsNotInLauncherJson(appUserModelIds) {
    return [...new Set((appUserModelIds || []).map((x) => String(x).trim()).filter(Boolean))];
}

/** Basename without extension for path-based drift labels. */
function pathDriftDisplayName(p) {
    const base = path.basename(String(p));
    const stem = path.basename(base, path.extname(base));
    return stem || base;
}

/** Best-effort label from PackageFamilyName when Get-StartApps misses (e.g. E046963F.LenovoCompanion_…!App). */
function aumidHeuristicLabel(aumid) {
    const s = String(aumid).trim();
    const pkg = s.split('!')[0] || s;
    const tail = pkg.includes('.') ? pkg.slice(pkg.indexOf('.') + 1) : pkg;
    const stem = tail.split('_')[0] || tail;
    if (!stem || stem === s) return s;
    return stem.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
}

/** Resolve Start-pin AUMIDs to shell display names via Get-StartApps (powershell.exe is on AA allow list). */
function readAumidDisplayNameMap(aumids) {
    if (process.platform !== 'win32' || !aumids.length) return {};
    const psIds = aumids.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
    const ps = `
$ErrorActionPreference='SilentlyContinue'
$ids=@(${psIds})
$out=@()
try {
  $apps=@(Get-StartApps)
  foreach($id in $ids){
    $m=$apps|Where-Object{$_.AppID -eq $id}|Select-Object -First 1
    if($m){$out+=@{aumid=$id;name=[string]$m.Name}}
  }
}catch{}
@{entries=$out}|ConvertTo-Json -Compress
`;
    const data = runPowerShellJson(ps, 12000);
    const map = {};
    for (const e of (data?.entries || [])) {
        if (e?.aumid && e?.name) map[e.aumid] = String(e.name).trim();
    }
    return map;
}

/** Build { aumid, name } entries for drift pins (OS name first, heuristic fallback). */
function buildPinDisplayEntries(aumids) {
    const ids = aumidsNotInLauncherJson(aumids);
    if (!ids.length) return [];
    const nameMap = readAumidDisplayNameMap(ids);
    return ids.map((aumid) => ({
        aumid,
        name: nameMap[aumid] || aumidHeuristicLabel(aumid),
    }));
}

/** Paths from kiosk-launcher-apps.json (install-time UI list), unfiltered. */
function readKioskLauncherJsonPathsRaw() {
    if (!existsSync(KIOSK_LAUNCHER_APPS_JSON)) return [];
    try {
        const { apps } = JSON.parse(readFileSync(KIOSK_LAUNCHER_APPS_JSON, 'utf8'));
        if (!Array.isArray(apps)) return [];
        return apps.filter((e) => e?.path).map((e) => path.resolve(String(e.path)));
    } catch {
        return [];
    }
}

/**
 * Live Assigned Access allow-list from the OS (kiosk user, no admin): RestrictRun + Start pins + HKLM AllowedApps.
 * Use to detect apps an admin added to policy but not in kiosk-launcher-apps.json (e.g. Start pins).
 */
export function readKioskSystemAllowedApps() {
    if (process.platform !== 'win32' || !isWindowsKioskOsUser()) {
        return { ok: false, error: 'win32 kiosk user only' };
    }
    const regAa = readRestrictRunAaFromReg();
    const restrictRunExeNames = parseAssignedAccessExeNamesFromReg(regAa.restrictRunOut);
    try {
        const startPins = readLiveStartLayoutPins();
        const aaPolicy = readAssignedAccessAllowedAppsFromReg();
        const launcherJsonPaths = readKioskLauncherJsonPathsRaw();
        const mergedPaths = [...new Set([...startPins.desktopPaths, ...aaPolicy.desktopPaths])];
        const notInLauncherJson = [...new Set(pathsNotInLauncherJson(mergedPaths, launcherJsonPaths))];
        const notInLauncherJsonAumids = aumidsNotInLauncherJson(startPins.appUserModelIds);
        const notInLauncherJsonPins = buildPinDisplayEntries(notInLauncherJsonAumids);
        return {
            ok: true,
            restrictRunExeNames,
            startLayoutPath: startPins.layoutPath,
            startLayoutReadable: startPins.ok,
            startPinDesktopPaths: startPins.desktopPaths,
            startPinAppUserModelIds: startPins.appUserModelIds,
            policyAllowedDesktopPaths: aaPolicy.desktopPaths,
            launcherJsonPaths,
            notInLauncherJson,
            notInLauncherJsonAumids,
            notInLauncherJsonPins,
            startLayoutError: startPins.error || '',
            aaPolicyRegSnippet: aaPolicy.regSnippet || '',
        };
    } catch (err) {
        return { ok: false, error: err.message || String(err) };
    }
}

let allowedKioskAppsCache = null;
let allowedKioskAppsCachedAt = 0;

/** Attach session-cached allow-list to clientinfo (read once at startup via getWindowsKioskDetectionLogLines). */
export function syncAllowedKioskAppsClientinfo(clientinfo) {
    if (!clientinfo || process.platform !== 'win32') return;
    if (!allowedKioskAppsCache || allowedKioskAppsCache.error) {
        delete clientinfo.allowedKioskApps;
        return;
    }
    clientinfo.allowedKioskApps = {
        startLayoutReadable: !!allowedKioskAppsCache.startLayoutReadable,
        appNames: allowedKioskAppsCache.appNames || [],
        collectedAt: allowedKioskAppsCachedAt,
    };
}

/** Human-readable names: kiosk-launcher-apps.json buttons + external Start pins (no internals). */
function buildKioskHumanAppNames(notInLauncherJsonPins) {
    const names = readKioskLauncherApps().map((a) => String(a.name || '').trim()).filter(Boolean);
    for (const p of notInLauncherJsonPins || []) {
        const n = String(p.name || '').trim();
        if (n) names.push(n);
    }
    return [...new Set(names)];
}

/** Win Assigned Access only: strict {"apps":[{"name","path"},...]} from install-windows-kiosk.ps1. */
export function readKioskLauncherApps() {
    if (process.platform !== 'win32' || !existsSync(KIOSK_LAUNCHER_APPS_JSON)) return [];
    try {
        const { apps } = JSON.parse(readFileSync(KIOSK_LAUNCHER_APPS_JSON, 'utf8'));
        if (!Array.isArray(apps)) return [];
        const list = withoutMainExamLauncherApps(apps
            .filter((e) => e?.path)
            .map((e) => ({
                name: String(e.name || path.basename(e.path, path.extname(e.path))),
                path: String(e.path),
            })));
        if (list.length) log.debug(`windowsKioskSetup: ${list.length} launcher app(s) from ${KIOSK_LAUNCHER_APPS_JSON}`);
        return list;
    } catch (err) {
        log.warn(`windowsKioskSetup: launcher json unreadable: ${KIOSK_LAUNCHER_APPS_JSON}`, err);
        return [];
    }
}

/** Spawn a whitelisted exe from kiosk-launcher-apps.json. */
export function launchKioskAllowedApp(exePath) {
    const target = path.resolve(String(exePath || ''));
    const allowed = readKioskLauncherApps().some((a) => path.resolve(a.path) === target);
    if (!allowed || !existsSync(target)) {
        return { ok: false, error: 'not allowed or missing' };
    }
    try {
        spawn(target, [], { detached: true, stdio: 'ignore', cwd: path.dirname(target), windowsHide: false }).unref();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/** UI should offer install when not yet provisioned and not already running as kiosk user. */
export function needsWindowsKioskSetup() {
    if (process.platform !== 'win32') return false;
    if (detectRunningInWindowsKiosk()) return false;
    return !detectWindowsKioskProvisionComplete();
}

/** True when this process already runs with administrator token (avoids unneeded UAC prompt). */
function isProcessElevated() {
    try {
        // net session requires admin; exit 0 means elevated
        execSync('net session', { stdio: ['ignore', 'ignore', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}

/**
 * relaunches the PowerShell payload via `Start-Process -Verb RunAs` (UAC).
 * extraAppsFile (optional) = absolute path to kiosk-allowed-apps.txt
 * firewallRulesScript (optional) = absolute path to firewall-rules.ps1 (same EXAM-STUDENT folder)
 * Returns Promise<{ok:boolean,error?:string,code?:string,skipped?:boolean}>.
 */
export async function initiateKioskSetup(_appPathIgnored, extraAppsFile = '', firewallRulesScript = '') {
    if (process.platform !== 'win32') {
        // Linux/macOS callers should use their own setup path; signal no-op here
        return { ok: false, skipped: true, error: 'initiateKioskSetup: non-win32 handled elsewhere' };
    }

    const bundle = resolveWindowsKioskAppBundle();
    if (!bundle.ok) {
        return { ok: false, error: bundle.error };
    }
    const script = resolveProvisioningScript();
    if (!existsSync(script)) {
        return { ok: false, error: `provisioning script not found: ${script}` };
    }
    // optional: only pass ExtraAppsFile if it actually exists (avoid PS errors on stale paths)
    const extraFile = extraAppsFile && existsSync(extraAppsFile) ? extraAppsFile : '';
    const firewallFile = firewallRulesScript && existsSync(firewallRulesScript) ? firewallRulesScript : '';

    // when already elevated (rare for a portable app) skip Start-Process and run inline
    if (isProcessElevated()) {
        log.info('windowsKioskSetup: already elevated, running provisioning inline');
        const inline = await runPowerShellInline(script, bundle.appDir, bundle.launchExe, extraFile, firewallFile);
        return inline.ok ? kioskSetupSuccessResult(bundle) : inline;
    }

    // Start-Process -Verb RunAs returns a Process handle without PROCESS_QUERY_INFORMATION rights when
    // crossing the elevation boundary -> .ExitCode throws "Access denied". Workaround: elevated child
    // writes its exit code into a temp file, parent reads it back after -Wait.
    const exitFile = path.join(os.tmpdir(), `next-exam-kiosk-exit-${Date.now()}-${process.pid}.txt`);
    const logFile = path.join(os.tmpdir(), `next-exam-kiosk-log-${Date.now()}-${process.pid}.txt`);
    try { if (existsSync(exitFile)) unlinkSync(exitFile); } catch {}

    // child PS command: run provisioning script, transcript stdout/stderr to logFile, persist $LASTEXITCODE
    const psEscape = (s) => String(s).replace(/'/g, "''");
    const extraArg = extraFile ? ` -ExtraAppsFile '${psEscape(extraFile)}'` : '';
    const firewallArg = firewallFile ? ` -FirewallRulesScript '${psEscape(firewallFile)}'` : '';
    const childCommand =
        `try { ` +
        `& '${psEscape(script)}' -AppDir '${psEscape(bundle.appDir)}' -LaunchExe '${psEscape(bundle.launchExe)}'${extraArg}${firewallArg} *>&1 | Tee-Object -FilePath '${psEscape(logFile)}'; ` +
        `Set-Content -Path '${psEscape(exitFile)}' -Value $LASTEXITCODE -Encoding ASCII ` +
        `} catch { ` +
        `($_ | Out-String) | Tee-Object -FilePath '${psEscape(logFile)}' -Append; ` +
        `Set-Content -Path '${psEscape(exitFile)}' -Value 9999 -Encoding ASCII ` +
        `}`;

    // PowerShell -EncodedCommand expects UTF-16 LE base64 -> no quoting issues at all
    const encoded = Buffer.from(childCommand, 'utf16le').toString('base64');

    // launcher: spawn elevated child, wait for it, then exit with code 0 (we read exitFile ourselves)
    const launcher =
        `$p = Start-Process -FilePath 'powershell.exe' ` +
        `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}' ` +
        `-Verb RunAs -Wait -PassThru; ` +
        `exit 0`;

    return new Promise((resolve) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launcher], { windowsHide: true });
        let launcherStderr = '';
        child.stderr?.on('data', (c) => { launcherStderr += String(c); });
        child.on('error', (err) => resolve({ ok: false, error: err.message }));
        child.on('close', () => {
            // exit code of the LAUNCHER tells us only whether the UAC prompt itself succeeded;
            // the actual provisioning exit code comes from the temp file written by the elevated child
            if (!existsSync(exitFile)) {
                // UAC denied or elevated process never wrote the file
                resolve({ ok: false, error: `UAC denied or elevated process aborted before completion. ${launcherStderr.trim()}` });
                return;
            }
            let childExit = NaN;
            try { childExit = parseInt(readFileSync(exitFile, 'utf8').trim(), 10); } catch {}
            const transcript = (() => { try { return readFileSync(logFile, 'utf8'); } catch { return ''; } })();
            try { unlinkSync(exitFile); } catch {}
            try { unlinkSync(logFile); } catch {}
            if (Number.isFinite(childExit) && childExit === 0) {
                resolve(kioskSetupSuccessResult(bundle));
            } else if (childExit === 10) {
                // distinct code so renderer shows the friendly edition-unsupported dialog
                resolve({ ok: false, code: 'EDITION_UNSUPPORTED', error: transcript.trim() });
            } else if (childExit === 11) {
                // missing extra-app path -> renderer shows friendly hint with the offending line from transcript
                resolve({ ok: false, code: 'MISSING_APP_PATH', error: transcript.trim() });
            } else if (childExit === 12) {
                resolve({ ok: false, code: 'INVALID_APP_BUNDLE', error: transcript.trim() });
            } else if (childExit === 13) {
                resolve({ ok: false, code: 'MDM_APPLY_FAILED', error: transcript.trim() });
            } else {
                resolve({
                    ok: false,
                    error: `elevated provisioning exited ${Number.isFinite(childExit) ? childExit : 'unknown'}\n${transcript.trim()}`,
                });
            }
        });
    });
}

// fallback path when host is already admin (e.g. dev box with elevated electron)
function runPowerShellInline(script, appDir, launchExe, extraFile = '', firewallFile = '') {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-AppDir', appDir, '-LaunchExe', launchExe];
    if (extraFile) { args.push('-ExtraAppsFile', extraFile); }
    if (firewallFile) { args.push('-FirewallRulesScript', firewallFile); }
    return new Promise((resolve) => {
        const child = spawn('powershell.exe', args, { windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (c) => { stdout += String(c); });
        child.stderr?.on('data', (c) => { stderr += String(c); });
        child.on('error', (err) => resolve({ ok: false, error: err.message }));
        child.on('close', (code) => {
            if (code === 0) resolve({ ok: true });
            else resolve({ ok: false, error: `exit ${code}\n${stderr.trim()}\n${stdout.trim()}` });
        });
    });
}
